import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DecisionEngine from './DecisionEngine'
import * as repoApi from '../repo/repoApi'
import * as lobbyApi from '../../shared/lobbyApi'

// Component tests on the Decision Engine's core user-visible behavior, per
// spec.md's "Decision engine — spin wheel detail" and its two ADRs.
// repoApi/lobbyApi are mocked; weighting.js's pure math is covered by its
// own unit tests, so tests here mostly use single-movie pools to make the
// pick deterministic without mocking Math.random.
vi.mock('../repo/repoApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchMovies: vi.fn(), setSpotlighted: vi.fn() }
})

vi.mock('../../shared/lobbyApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchLobby: vi.fn(), startSpin: vi.fn(), useVeto: vi.fn() }
})

const emptyLobby = {
  id: 'current_session',
  active_veto_user: null,
  veto_used: false,
  round_high_score: 0,
  chosen_movie_id: null,
  spin_started_at: null,
}

const fightClub = { id: 1, title: 'Fight Club', genres: ['Drama'], watched: false, spotlighted: false }
const inception = { id: 2, title: 'Inception', genres: ['Sci-Fi'], watched: false, spotlighted: false }

// Real animation timing, shrunk for test speed — same code path as
// production, just a shorter wait. Bumped from 10ms to 50ms (design-review
// fix follow-up): 10ms was fine in isolation but flaked under full-suite
// parallel load — the "shows Spinning…" assertion raced against the reveal
// timer firing before the query even ran. Same pattern as an earlier Arena
// test flake: the fix is a wider window for a test that's checking behavior,
// not exact timing, not a change to production code.
const testAnimationMs = 50

beforeEach(() => {
  vi.clearAllMocks()
  lobbyApi.fetchLobby.mockResolvedValue(emptyLobby)
})

describe('DecisionEngine', () => {
  it('disables Spin and shows a muted prompt when the pool is empty', async () => {
    repoApi.fetchMovies.mockResolvedValue([])

    render(<DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} />)

    expect(await screen.findByText(/nothing showing in this genre tonight/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^spin$/i })).toBeDisabled()
  })

  it('spinning a one-movie pool writes the pick and reveals it after the animation', async () => {
    const user = userEvent.setup()
    repoApi.fetchMovies.mockResolvedValue([fightClub])
    lobbyApi.startSpin.mockResolvedValue(undefined)

    render(<DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} />)

    const spinButton = await screen.findByRole('button', { name: /^spin$/i })
    expect(spinButton).toBeEnabled()
    await user.click(spinButton)

    expect(await screen.findByText(/spinning/i)).toBeInTheDocument()
    expect(lobbyApi.startSpin).toHaveBeenCalledWith(1, expect.any(String))

    expect(await screen.findByRole('status')).toHaveTextContent('Fight Club')
  })

  it('does not replay the spin when a poll returns the same instant in a different timestamp format', async () => {
    // Bug repro: "why is it spinning twice?" — the dedup check compared
    // lobby.spin_started_at against lastSeenSpinStartedAt.current as raw
    // strings. The client writes new Date().toISOString() (e.g. an "Z"
    // suffix, millisecond precision); Postgres/PostgREST can echo the same
    // instant back in a different string form (e.g. a "+00:00" offset).
    // Same instant, different string — the dedup check saw that as an
    // unseen spin and replayed the whole thing a second time.
    const user = userEvent.setup()
    repoApi.fetchMovies.mockResolvedValue([fightClub])
    let writtenSpinStartedAt = null
    lobbyApi.startSpin.mockImplementation((_movieId, spinStartedAt) => {
      writtenSpinStartedAt = spinStartedAt
      return Promise.resolve(undefined)
    })
    lobbyApi.fetchLobby.mockImplementation(() => {
      if (!writtenSpinStartedAt) return Promise.resolve(emptyLobby)
      return Promise.resolve({
        ...emptyLobby,
        chosen_movie_id: 1,
        spin_started_at: writtenSpinStartedAt.replace('Z', '+00:00'),
      })
    })

    // The poll has to land *after* the real spin has already finished
    // (animationMs) for this to reproduce — that's the actual production
    // shape of the bug: isSpinInProgress's 4-second window outlives the
    // (much shorter) animation, so a poll arriving in that gap re-triggers
    // a "catch up" on a spin that already resolved. A poll faster than
    // animationMs would hit the mismatch *during* the legitimate spin,
    // which is silently idempotent (spinning is already true) and doesn't
    // reproduce the bug at all.
    render(
      <DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} pollIntervalMs={90} />
    )

    await user.click(await screen.findByRole('button', { name: /^spin$/i }))
    await screen.findByRole('status') // the first, legitimate reveal lands

    // Sample the DOM repeatedly rather than checking once after a delay —
    // a second "Spinning…" phase could start *and finish* between two
    // single point-in-time checks, hiding exactly the bug this test exists
    // to catch. Same sampling technique ArenaGame.test.jsx already uses
    // for its own real-timer relocation assertions.
    let spinningReappearances = 0
    let wasSpinning = false
    const deadline = Date.now() + 300
    while (Date.now() < deadline) {
      const isSpinning = screen.queryByText(/spinning/i) !== null
      if (isSpinning && !wasSpinning) spinningReappearances += 1
      wasSpinning = isSpinning
      await new Promise((resolve) => setTimeout(resolve, 5))
    }

    expect(spinningReappearances).toBe(0)
  })

  it('shows an already-resolved pick immediately without replaying the animation', async () => {
    repoApi.fetchMovies.mockResolvedValue([fightClub])
    lobbyApi.fetchLobby.mockResolvedValue({
      ...emptyLobby,
      chosen_movie_id: 1,
      spin_started_at: new Date(Date.now() - 60_000).toISOString(),
    })

    render(<DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} />)

    expect(await screen.findByRole('status')).toHaveTextContent('Fight Club')
    expect(screen.queryByText(/spinning/i)).not.toBeInTheDocument()
  })

  it('disables Spin while a spin is in progress for anyone', async () => {
    repoApi.fetchMovies.mockResolvedValue([fightClub])
    lobbyApi.fetchLobby.mockResolvedValue({
      ...emptyLobby,
      chosen_movie_id: 1,
      spin_started_at: new Date(Date.now() - 1000).toISOString(), // 1s ago, still "in progress"
    })

    render(<DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} />)

    expect(await screen.findByRole('button', { name: /^spin$/i })).toBeDisabled()
  })

  it('the genre filter narrows the pool before spinning', async () => {
    const user = userEvent.setup()
    repoApi.fetchMovies.mockResolvedValue([fightClub, inception])

    render(<DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} />)

    await screen.findByText('Fight Club')
    expect(screen.getByText('Inception')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/filter by genre/i), 'Drama')

    expect(screen.getByText('Fight Club')).toBeInTheDocument()
    expect(screen.queryByText('Inception')).not.toBeInTheDocument()
  })

  it('toggling spotlight calls setSpotlighted with the new state', async () => {
    const user = userEvent.setup()
    repoApi.fetchMovies.mockResolvedValue([fightClub])

    render(<DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} />)

    const spotlightButton = await screen.findByRole('button', {
      name: /spotlight fight club/i,
    })
    await user.click(spotlightButton)

    expect(repoApi.setSpotlighted).toHaveBeenCalledWith(1, true)
  })

  it('shows a Veto button only for the person currently holding the veto', async () => {
    repoApi.fetchMovies.mockResolvedValue([fightClub, inception])
    lobbyApi.fetchLobby.mockResolvedValue({
      ...emptyLobby,
      chosen_movie_id: 1,
      spin_started_at: new Date(Date.now() - 60_000).toISOString(),
      active_veto_user: 'Vikram',
    })

    render(<DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} />)

    expect(await screen.findByRole('button', { name: /veto/i })).toBeInTheDocument()
  })

  it('does not show a Veto button for someone who does not hold it', async () => {
    repoApi.fetchMovies.mockResolvedValue([fightClub])
    lobbyApi.fetchLobby.mockResolvedValue({
      ...emptyLobby,
      chosen_movie_id: 1,
      spin_started_at: new Date(Date.now() - 60_000).toISOString(),
      active_veto_user: 'SomeoneElse',
    })

    render(<DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} />)

    await screen.findByRole('status')
    expect(screen.queryByRole('button', { name: /veto/i })).not.toBeInTheDocument()
  })

  it('vetoing excludes the previous pick and spends the veto', async () => {
    const user = userEvent.setup()
    repoApi.fetchMovies.mockResolvedValue([fightClub, inception])
    lobbyApi.fetchLobby.mockResolvedValue({
      ...emptyLobby,
      chosen_movie_id: 1, // Fight Club already chosen
      spin_started_at: new Date(Date.now() - 60_000).toISOString(),
      active_veto_user: 'Vikram',
    })
    lobbyApi.useVeto.mockResolvedValue(undefined)

    render(<DecisionEngine addedBy="Vikram" animationMs={testAnimationMs} />)

    const vetoButton = await screen.findByRole('button', { name: /veto/i })
    await user.click(vetoButton)

    // Only Inception is left once Fight Club (the previous pick) is
    // excluded, so the re-spin is deterministic here too.
    expect(lobbyApi.useVeto).toHaveBeenCalledWith(2, expect.any(String))
  })
})

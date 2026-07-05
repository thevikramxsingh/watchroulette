import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArenaGame from './ArenaGame'
import * as lobbyApi from '../../shared/lobbyApi'
import * as repoApi from '../repo/repoApi'

// Component tests on the Arena's core user-visible behavior, per spec.md's
// "Arena — detail (Module 3)": one attempt per round, the whack-a-mole
// scoring rule (one hit per 0.7s relocation window), a new high score
// unlocking the veto, and "New Round" resetting things for everyone.
//
// Real timers, shrunk for test speed (same pattern as Module 1's debounce
// and Module 2's animation) rather than fake timers — this component
// mixes setInterval/setTimeout with async mocked network calls, and real
// short delays proved simpler and more reliable here than getting fake
// timers to cooperate with both at once.
vi.mock('../../shared/lobbyApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchLobby: vi.fn(), submitScoreIfHighest: vi.fn(), resetRound: vi.fn() }
})

vi.mock('../repo/repoApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, clearAllSpotlights: vi.fn() }
})

const baseLobby = {
  id: 'current_session',
  active_veto_user: null,
  veto_used: false,
  round_high_score: 0,
  round_number: 1,
  chosen_movie_id: null,
  spin_started_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  lobbyApi.fetchLobby.mockResolvedValue(baseLobby)
  lobbyApi.submitScoreIfHighest.mockResolvedValue(undefined)
  lobbyApi.resetRound.mockResolvedValue(undefined)
  repoApi.clearAllSpotlights.mockResolvedValue(undefined)
})

function setup(props = {}) {
  const user = userEvent.setup()
  render(
    <ArenaGame
      addedBy="Vikram"
      tickMs={30}
      roundDurationMs={150}
      // Bonus cells and speed bursts are off by default in these tests —
      // both are randomized (per game.js), and most tests here predate
      // the tweak and assert exact scores that a random bonus hit or a
      // burst-shortened window would make flaky. Tests for the tweak
      // itself turn these back on explicitly.
      bonusChance={0}
      burstCount={0}
      {...props}
    />
  )
  return user
}

function findActiveCell() {
  const cells = screen.getAllByRole('button', { name: /^cell \d$/i })
  return cells.find((cell) => cell.getAttribute('aria-pressed') === 'true')
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('ArenaGame', () => {
  it('starting a round lights up exactly one cell', async () => {
    const user = setup()
    await user.click(await screen.findByRole('button', { name: /^play$/i }))

    const cells = screen.getAllByRole('button', { name: /^cell \d$/i })
    const active = cells.filter((cell) => cell.getAttribute('aria-pressed') === 'true')
    expect(active).toHaveLength(1)
  })

  it('scores once per relocation window, ignoring extra clicks in the same window', async () => {
    // A long tick here on purpose: the point of this test is "does a
    // second click in the same window get ignored," not "can we win a
    // race against the relocation timer" — that timing question belongs
    // to the spam-click test below.
    const user = setup({ tickMs: 1000, roundDurationMs: 5000 })
    await user.click(await screen.findByRole('button', { name: /^play$/i }))

    const active = findActiveCell()
    await user.click(active)
    await user.click(active) // same window — shouldn't add a second point

    expect(await screen.findByRole('status')).toHaveTextContent('Score: 1')
  })

  it('ends the round after roundDurationMs, shows the final score, and locks further play', async () => {
    const user = setup()
    await user.click(await screen.findByRole('button', { name: /^play$/i }))

    await waitFor(
      () => expect(screen.getByRole('status')).toHaveTextContent(/final score/i),
      { timeout: 1000 }
    )

    expect(
      screen.getByRole('button', { name: /already played this round/i })
    ).toBeDisabled()
  })

  it('submits a score that beats the current high score', async () => {
    const user = setup()
    await user.click(await screen.findByRole('button', { name: /^play$/i }))

    // Spam-click whichever cell is currently active for the whole round —
    // clicking far faster than the 30ms relocation tick guarantees at
    // least one hit per window without needing exact synchronization with
    // the timer. The assertion only cares that *some* positive score got
    // submitted, not the exact count.
    const deadline = Date.now() + 300
    while (Date.now() < deadline) {
      const active = findActiveCell()
      if (active) await user.click(active)
      await wait(5)
    }

    await waitFor(
      () => expect(lobbyApi.submitScoreIfHighest).toHaveBeenCalled(),
      { timeout: 1000 }
    )
    const [name, score] = lobbyApi.submitScoreIfHighest.mock.calls[0]
    expect(name).toBe('Vikram')
    expect(score).toBeGreaterThan(0)
  })

  it('shows "Already played this round" on load if localStorage says this device already has', async () => {
    window.localStorage.setItem('watchroulette:arena:lastPlayedRound', JSON.stringify(1))
    setup()

    expect(
      await screen.findByRole('button', { name: /already played this round/i })
    ).toBeDisabled()
  })

  it('New Round resets both the lobby round state and movie spotlights', async () => {
    const user = setup()

    await user.click(await screen.findByRole('button', { name: /new round/i }))

    // resetRound now takes the whole lobby row (Module 5c: it logs the
    // round to round_history before clearing it), not just round_number.
    expect(lobbyApi.resetRound).toHaveBeenCalledWith(baseLobby)
    expect(repoApi.clearAllSpotlights).toHaveBeenCalled()
  })

  // --- Arena tweak: bonus cell, speed bursts, combo streak ---

  it('a bonus-window hit scores BONUS_SCORE points and marks the cell as bonus', async () => {
    // bonusChance: 1 forces every window to be a bonus window — the point
    // here is "does a bonus hit score correctly," not "does the ~15%
    // chance work" (that's covered in game.test.js already).
    const user = setup({ tickMs: 1000, roundDurationMs: 5000, bonusChance: 1 })
    await user.click(await screen.findByRole('button', { name: /^play$/i }))

    const bonusCell = await screen.findByRole('button', { name: /\(bonus\)/i })
    await user.click(bonusCell)

    expect(await screen.findByRole('status')).toHaveTextContent('Score: 3')
  })

  it('a missed window resets the combo streak', async () => {
    const user = setup({ tickMs: 40, roundDurationMs: 2000 })
    await user.click(await screen.findByRole('button', { name: /^play$/i }))

    // Hit the first window to start a streak.
    await user.click(findActiveCell())
    expect(await screen.findByRole('status')).toHaveTextContent('🔥 1')

    // Let a couple of windows elapse without clicking — the streak should
    // drop back out of the status text (only shown once streak > 1).
    await wait(150)
    expect(screen.getByRole('status')).not.toHaveTextContent('🔥')
  })

  it('a speed burst relocates the target faster than the base tick rate', async () => {
    // The whole round is one continuous burst (burstDurationMs ==
    // roundDurationMs) at a much faster tick than the base rate. Rather
    // than scoring via clicks (which conflates relocation speed with
    // click-timing/userEvent overhead), this counts actual relocations by
    // sampling which cell is active over time — a direct test of the
    // thing this mechanic is supposed to do.
    const user = setup({
      tickMs: 1000,
      roundDurationMs: 500,
      burstCount: 1,
      burstDurationMs: 500,
      burstTickMs: 50,
    })
    await user.click(await screen.findByRole('button', { name: /^play$/i }))

    let relocations = 0
    let lastSeen = findActiveCell()?.getAttribute('aria-label')
    const deadline = Date.now() + 400
    while (Date.now() < deadline) {
      const current = findActiveCell()?.getAttribute('aria-label')
      if (current !== lastSeen) {
        relocations += 1
        lastSeen = current
      }
      await wait(5)
    }

    // At the 1000ms base tick, essentially zero relocations would happen
    // in 400ms — seeing several confirms the burst's 50ms tick is what
    // actually drove the target, not the base rate.
    expect(relocations).toBeGreaterThan(2)
  })
})

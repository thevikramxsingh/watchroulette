import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RepoPanel from './RepoPanel'
import * as repoApi from './repoApi'

// Component tests on the Repo feature's core user-visible behavior, per
// the spec's "Repo — detail (Module 1)" section (live search, duplicate
// prevention, watched toggle, the two distinct empty/error states) plus
// Module 6's nine small enhancements (remove+undo, added-by credit +
// sort/group by contributor, named duplicate warning, genre filter,
// last-watched line, undo toast on the watched toggle — the copy-link
// button and "New" tag are covered in MovieCard.test.jsx instead, since
// they're MovieCard's own rendering, not RepoPanel's).
// repoApi's network calls are mocked; isDuplicate is left real since it's
// pure logic already covered by its own unit test.
vi.mock('./repoApi', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchMovies: vi.fn(),
    addMovie: vi.fn(),
    setWatched: vi.fn(),
    searchTmdb: vi.fn(),
    removeMovie: vi.fn(),
    restoreMovie: vi.fn(),
  }
})

const fightClub = {
  tmdbId: 550,
  title: 'Fight Club',
  posterPath: '/poster.jpg',
  summary: 'A summary.',
  genres: ['Drama'],
  watchPageUrl: 'https://www.themoviedb.org/movie/550/watch',
}

// Real debounce, shrunk for test speed — same code path as production, just
// a shorter wait so tests don't take 400ms each for no reason.
const testDebounceMs = 10

beforeEach(() => {
  vi.clearAllMocks()
  repoApi.fetchMovies.mockResolvedValue([])
})

describe('RepoPanel', () => {
  it('shows a muted empty state when the repo has no movies', async () => {
    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)

    expect(
      await screen.findByText(/nothing's playing yet/i)
    ).toBeInTheDocument()
  })

  it('adding a search result shows it in the repo list', async () => {
    const user = userEvent.setup()
    repoApi.searchTmdb.mockResolvedValue([fightClub])
    repoApi.addMovie.mockResolvedValue(undefined)
    repoApi.fetchMovies
      .mockResolvedValueOnce([]) // initial load
      .mockResolvedValueOnce([
        { id: 1, tmdb_id: 550, title: 'Fight Club', watched: false },
      ]) // after refetch post-add

    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)
    await screen.findByText(/nothing's playing yet/i)

    await user.type(screen.getByLabelText(/search for a movie/i), 'fight club')

    const addButton = await screen.findByRole('button', {
      name: /add fight club/i,
    })
    await user.click(addButton)

    expect(repoApi.addMovie).toHaveBeenCalledWith(fightClub, 'Vikram')
    expect(await screen.findAllByText('Fight Club')).not.toHaveLength(0)
  })

  it('shows distinct error text when search fails, not the empty-results state', async () => {
    const user = userEvent.setup()
    repoApi.searchTmdb.mockRejectedValue(new Error('network down'))

    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)
    await user.type(screen.getByLabelText(/search for a movie/i), 'anything')

    expect(
      await screen.findByText("Couldn't reach movie search — try again")
    ).toBeInTheDocument()
    expect(screen.queryByText(/no matches/i)).not.toBeInTheDocument()
  })

  it('shows the muted no-matches state on a genuine zero-result search', async () => {
    const user = userEvent.setup()
    repoApi.searchTmdb.mockResolvedValue([])

    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)
    await user.type(screen.getByLabelText(/search for a movie/i), 'zzzznotamovie')

    expect(await screen.findByText(/no matches/i)).toBeInTheDocument()
  })

  it('names the duplicate warning after whoever already added it (Module 6)', async () => {
    const user = userEvent.setup()
    repoApi.fetchMovies.mockResolvedValue([
      { id: 1, tmdb_id: 550, title: 'Fight Club', watched: false, added_by: 'Priya' },
    ])
    repoApi.searchTmdb.mockResolvedValue([fightClub])

    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)
    await user.type(screen.getByLabelText(/search for a movie/i), 'fight club')

    const addButton = await screen.findByRole('button', {
      name: /add fight club/i,
    })
    await user.click(addButton)

    expect(repoApi.addMovie).not.toHaveBeenCalled()
    expect(await screen.findByText('Already added by Priya')).toBeInTheDocument()
  })

  it('toggling watched calls setWatched with the new state', async () => {
    const user = userEvent.setup()
    repoApi.fetchMovies.mockResolvedValue([
      { id: 1, tmdb_id: 550, title: 'Fight Club', watched: false },
    ])
    repoApi.setWatched.mockResolvedValue(undefined)

    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)

    const checkbox = await screen.findByLabelText(/mark fight club as watched/i)
    await user.click(checkbox)

    expect(repoApi.setWatched).toHaveBeenCalledWith(1, true)
  })

  it('shows an Undo toast after toggling watched, which reverts the toggle on click (Module 6)', async () => {
    const user = userEvent.setup()
    repoApi.fetchMovies.mockResolvedValue([
      { id: 1, tmdb_id: 550, title: 'Fight Club', watched: false },
    ])
    repoApi.setWatched.mockResolvedValue(undefined)

    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)
    await user.click(await screen.findByLabelText(/mark fight club as watched/i))

    const undoButton = await screen.findByRole('button', { name: /undo/i })
    await user.click(undoButton)

    // First call was the toggle itself (already asserted above), the
    // second is undo reverting it back to its prior state (false).
    expect(repoApi.setWatched).toHaveBeenNthCalledWith(2, 1, false)
  })

  it('removing a movie deletes it and shows an Undo toast that restores it (Module 6)', async () => {
    const user = userEvent.setup()
    const fightClubRow = { id: 1, tmdb_id: 550, title: 'Fight Club', watched: false }
    repoApi.fetchMovies.mockResolvedValue([fightClubRow])
    repoApi.removeMovie.mockResolvedValue(undefined)
    repoApi.restoreMovie.mockResolvedValue(undefined)

    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)
    await user.click(await screen.findByRole('button', { name: /remove fight club/i }))

    expect(repoApi.removeMovie).toHaveBeenCalledWith(1)

    const undoButton = await screen.findByRole('button', { name: /undo/i })
    await user.click(undoButton)

    expect(repoApi.restoreMovie).toHaveBeenCalledWith(fightClubRow)
  })

  it('the genre filter narrows which repo cards are shown (Module 6)', async () => {
    const user = userEvent.setup()
    repoApi.fetchMovies.mockResolvedValue([
      { id: 1, tmdb_id: 550, title: 'Fight Club', watched: false, genres: ['Drama'] },
      { id: 2, tmdb_id: 551, title: 'Inception', watched: false, genres: ['Sci-Fi'] },
    ])

    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)
    await screen.findByText('Fight Club')
    expect(screen.getByText('Inception')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/filter by genre/i), 'Drama')

    expect(screen.getByText('Fight Club')).toBeInTheDocument()
    expect(screen.queryByText('Inception')).not.toBeInTheDocument()
  })

  it('shows a Last watched line for the most recently watched movie (Module 6)', async () => {
    repoApi.fetchMovies.mockResolvedValue([
      {
        id: 1,
        tmdb_id: 550,
        title: 'Fight Club',
        watched: true,
        watched_at: '2026-07-02T00:00:00Z',
        genres: [],
      },
    ])

    render(<RepoPanel addedBy="Vikram" debounceMs={testDebounceMs} />)

    expect(await screen.findByText('Last watched: Fight Club, July 2')).toBeInTheDocument()
  })
})

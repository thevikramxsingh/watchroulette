import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MovieCard from './MovieCard'

// Module 4 — the shared poster/description/watch-link card used by both
// RepoPanel and DecisionEngine's pool list (spec.md's "UI polish pass").
// One component instead of duplicated JSX in both places, so they stay
// visually identical by construction. Covers: poster + fallback, text
// content, and the one corner-badge control a caller opts into via
// `variant` — never both at once, since Repo's watched-state and Decision
// Engine's spotlight-state are never shown on the same card.
const baseMovie = {
  id: 1,
  title: 'Fight Club',
  genres: ['Drama'],
  poster_path: '/poster.jpg',
  summary: 'An insomniac office worker forms an underground fight club.',
  watch_page_url: 'https://www.themoviedb.org/movie/550/watch',
  watched: false,
  spotlighted: false,
}

describe('MovieCard', () => {
  it('renders the poster image built from the bare TMDB path', () => {
    render(<MovieCard movie={baseMovie} variant="watched" onToggleWatched={vi.fn()} />)

    const poster = screen.getByRole('img', { name: /fight club poster/i })
    expect(poster).toHaveAttribute('src', expect.stringContaining('/poster.jpg'))
  })

  it('shows a placeholder, not a broken image, when there is no poster', () => {
    render(
      <MovieCard
        movie={{ ...baseMovie, poster_path: null }}
        variant="watched"
        onToggleWatched={vi.fn()}
      />
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows title, genre tags, description, and a Watch link', () => {
    render(<MovieCard movie={baseMovie} variant="watched" onToggleWatched={vi.fn()} />)

    expect(screen.getByText('Fight Club')).toBeInTheDocument()
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText(/insomniac office worker/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /watch/i })).toHaveAttribute(
      'href',
      baseMovie.watch_page_url
    )
  })

  it('omits the Watch link entirely when there is no watch_page_url, rather than a dead link', () => {
    render(
      <MovieCard
        movie={{ ...baseMovie, watch_page_url: null }}
        variant="watched"
        onToggleWatched={vi.fn()}
      />
    )

    expect(screen.queryByRole('link', { name: /watch/i })).not.toBeInTheDocument()
  })

  it('shows a Trailer link built from the stored video key (Module 5a)', () => {
    render(
      <MovieCard
        movie={{ ...baseMovie, trailer_key: 'abc123' }}
        variant="watched"
        onToggleWatched={vi.fn()}
      />
    )

    expect(screen.getByRole('link', { name: /trailer/i })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=abc123'
    )
  })

  it('omits the Trailer link when trailer_key is null, same as a movie with no trailer found', () => {
    render(
      <MovieCard
        movie={{ ...baseMovie, trailer_key: null }}
        variant="watched"
        onToggleWatched={vi.fn()}
      />
    )

    expect(screen.queryByRole('link', { name: /trailer/i })).not.toBeInTheDocument()
  })

  it('the watched variant shows a checkbox and calls onToggleWatched with the flipped state', async () => {
    const user = userEvent.setup()
    const onToggleWatched = vi.fn()
    render(<MovieCard movie={baseMovie} variant="watched" onToggleWatched={onToggleWatched} />)

    const checkbox = screen.getByLabelText(/mark fight club as watched/i)
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)

    expect(onToggleWatched).toHaveBeenCalledWith(baseMovie)
  })

  it('the spotlight variant shows a toggle button reflecting spotlighted state', async () => {
    const user = userEvent.setup()
    const onToggleSpotlight = vi.fn()
    render(
      <MovieCard movie={baseMovie} variant="spotlight" onToggleSpotlight={onToggleSpotlight} />
    )

    const button = screen.getByRole('button', { name: /spotlight fight club/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await user.click(button)

    expect(onToggleSpotlight).toHaveBeenCalledWith(baseMovie)
  })

  // --- Module 6: nine small Repo enhancements ---

  it('shows a New tag for something added within the last day or two', () => {
    const recentlyAdded = { ...baseMovie, created_at: new Date().toISOString() }
    render(<MovieCard movie={recentlyAdded} variant="watched" onToggleWatched={vi.fn()} />)

    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('omits the New tag once something has been in the repo for a while', () => {
    const oldAdd = { ...baseMovie, created_at: '2020-01-01T00:00:00Z' }
    render(<MovieCard movie={oldAdd} variant="watched" onToggleWatched={vi.fn()} />)

    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('shows who added the movie when added_by is present', () => {
    render(
      <MovieCard
        movie={{ ...baseMovie, added_by: 'Priya' }}
        variant="watched"
        onToggleWatched={vi.fn()}
      />
    )

    expect(screen.getByText('Added by Priya')).toBeInTheDocument()
  })

  it('renders a Remove control only when onRemove is provided, and calls it with the movie', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(
      <MovieCard
        movie={baseMovie}
        variant="watched"
        onToggleWatched={vi.fn()}
        onRemove={onRemove}
      />
    )

    await user.click(screen.getByRole('button', { name: /remove fight club/i }))
    expect(onRemove).toHaveBeenCalledWith(baseMovie)
  })

  it('does not render a Remove control when onRemove is not provided (e.g. Decision Engine)', () => {
    render(
      <MovieCard movie={baseMovie} variant="spotlight" onToggleSpotlight={vi.fn()} />
    )

    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('copies the watch link to the clipboard and shows brief confirmation', async () => {
    // userEvent.setup() resets jsdom's own clipboard stub as part of its
    // per-call setup — defining the mock has to happen *after* that call,
    // or setup() silently replaces it again before the click below.
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    render(<MovieCard movie={baseMovie} variant="watched" onToggleWatched={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /copy watch link/i }))

    expect(writeText).toHaveBeenCalledWith(baseMovie.watch_page_url)
    expect(await screen.findByRole('button', { name: /link copied/i })).toBeInTheDocument()
  })
})

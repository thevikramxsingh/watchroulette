import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatsPage from './StatsPage'
import * as repoApi from '../repo/repoApi'
import * as lobbyApi from '../../shared/lobbyApi'

// Component tests on Module 5c's stats page — this is deliberately thin
// since the actual stat computation is covered by statsMath.test.js; this
// file just checks the page fetches from the right places and renders what
// those functions produce, per the two-layer testing strategy in
// TRACKER.md.
vi.mock('../repo/repoApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchMovies: vi.fn() }
})

vi.mock('../../shared/lobbyApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchLobby: vi.fn(), fetchRoundHistory: vi.fn() }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StatsPage', () => {
  it('shows watched count, most-watched genre, champion, most wins, and highest score', async () => {
    repoApi.fetchMovies.mockResolvedValue([
      { watched: true, genres: ['Drama'] },
      { watched: true, genres: ['Drama'] },
      { watched: false, genres: ['Comedy'] },
    ])
    lobbyApi.fetchLobby.mockResolvedValue({
      round_high_score_holder: 'Vikram',
      round_high_score: 12,
    })
    lobbyApi.fetchRoundHistory.mockResolvedValue([
      { high_score: 40, high_score_holder: 'Priya' },
      { high_score: 8, high_score_holder: 'Priya' },
    ])

    render(<StatsPage />)

    expect(await screen.findByText('2')).toBeInTheDocument() // total watched
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Vikram')).toBeInTheDocument() // reigning champion
    expect(screen.getByText('Priya (2)')).toBeInTheDocument() // most rounds won
    expect(screen.getByText('40')).toBeInTheDocument() // highest score ever
  })

  it('shows muted placeholders instead of blank stats before there is any real data', async () => {
    repoApi.fetchMovies.mockResolvedValue([])
    lobbyApi.fetchLobby.mockResolvedValue({ round_high_score_holder: null, round_high_score: 0 })
    lobbyApi.fetchRoundHistory.mockResolvedValue([])

    render(<StatsPage />)

    expect(await screen.findByText('Nobody has watched anything yet')).toBeInTheDocument()
    expect(screen.getAllByText('Nobody yet')).toHaveLength(2) // champion + most rounds won
  })
})

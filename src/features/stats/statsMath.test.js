import { describe, it, expect } from 'vitest'
import { mostWatchedGenre, totalWatchedCount, mostRoundsWonBy, highestScoreEver } from './statsMath'

describe('mostWatchedGenre', () => {
  it('returns null when nothing has been watched yet', () => {
    const movies = [{ watched: false, genres: ['Drama'] }]
    expect(mostWatchedGenre(movies)).toBeNull()
  })

  it('picks the genre with the most watched movies, ignoring unwatched ones', () => {
    const movies = [
      { watched: true, genres: ['Drama'] },
      { watched: true, genres: ['Drama', 'Thriller'] },
      { watched: false, genres: ['Comedy', 'Comedy'] }, // unwatched — shouldn't count
      { watched: true, genres: ['Comedy'] },
    ]
    expect(mostWatchedGenre(movies)).toBe('Drama')
  })

  it('treats a movie with no genres as contributing nothing', () => {
    const movies = [
      { watched: true, genres: [] },
      { watched: true, genres: ['Horror'] },
    ]
    expect(mostWatchedGenre(movies)).toBe('Horror')
  })
})

describe('totalWatchedCount', () => {
  it('counts only watched movies', () => {
    const movies = [{ watched: true }, { watched: false }, { watched: true }]
    expect(totalWatchedCount(movies)).toBe(2)
  })

  it('is 0 for an empty repo', () => {
    expect(totalWatchedCount([])).toBe(0)
  })
})

describe('mostRoundsWonBy', () => {
  it('returns null when no round has ever had a holder', () => {
    const history = [{ high_score_holder: null }, { high_score_holder: null }]
    expect(mostRoundsWonBy(history)).toBeNull()
  })

  it('picks whoever holds the most rounds', () => {
    const history = [
      { high_score_holder: 'Vikram' },
      { high_score_holder: 'Priya' },
      { high_score_holder: 'Vikram' },
    ]
    expect(mostRoundsWonBy(history)).toEqual({ name: 'Vikram', count: 2 })
  })

  it('breaks a tie alphabetically, deterministically', () => {
    const history = [{ high_score_holder: 'Zara' }, { high_score_holder: 'Amir' }]
    expect(mostRoundsWonBy(history)).toEqual({ name: 'Amir', count: 1 })
  })
})

describe('highestScoreEver', () => {
  it('is 0 when nothing has ever been scored', () => {
    expect(highestScoreEver([], 0)).toBe(0)
  })

  it('picks the highest score out of round_history alone', () => {
    const history = [{ high_score: 12 }, { high_score: 40 }, { high_score: 8 }]
    expect(highestScoreEver(history, 0)).toBe(40)
  })

  it('includes the round still in progress, not just already-logged rounds', () => {
    const history = [{ high_score: 12 }, { high_score: 40 }]
    // The current round has already beaten every past round but hasn't
    // been logged to round_history yet (that only happens on New Round) —
    // this stat still has to reflect it right now.
    expect(highestScoreEver(history, 55)).toBe(55)
  })
})

import { describe, it, expect } from 'vitest'
import { deriveGenres } from './deriveGenres'

describe('deriveGenres', () => {
  it('returns a sorted, de-duplicated list of every genre across the movies', () => {
    const movies = [
      { genres: ['Drama', 'Thriller'] },
      { genres: ['Comedy'] },
      { genres: ['Drama'] },
    ]
    expect(deriveGenres(movies)).toEqual(['Comedy', 'Drama', 'Thriller'])
  })

  it('treats a missing genres field as contributing nothing', () => {
    const movies = [{ genres: ['Drama'] }, {}]
    expect(deriveGenres(movies)).toEqual(['Drama'])
  })

  it('is empty for an empty list', () => {
    expect(deriveGenres([])).toEqual([])
  })
})

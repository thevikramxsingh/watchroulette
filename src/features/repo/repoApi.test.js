import { describe, it, expect } from 'vitest'
import { isDuplicate } from './repoApi'

// Unit tests on the one piece of pure logic in this module. Everything else
// in repoApi.js is a thin network wrapper (Supabase / our TMDB proxy) —
// covered indirectly through RepoPanel's component tests instead, per the
// two-layer testing strategy in TRACKER.md.
describe('isDuplicate', () => {
  it('returns true when a movie with the same tmdb_id is already in the list', () => {
    const movies = [{ id: 1, tmdb_id: 550, title: 'Fight Club' }]
    expect(isDuplicate(movies, 550)).toBe(true)
  })

  it('returns false when no movie in the list matches', () => {
    const movies = [{ id: 1, tmdb_id: 550, title: 'Fight Club' }]
    expect(isDuplicate(movies, 999)).toBe(false)
  })

  it('returns false for an empty repo', () => {
    expect(isDuplicate([], 550)).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { mostRecentlyWatched, formatShortDate } from './lastWatched'

describe('mostRecentlyWatched', () => {
  it('returns null when nothing has been watched yet', () => {
    const movies = [{ watched: false, watched_at: null, title: 'Fight Club' }]
    expect(mostRecentlyWatched(movies)).toBeNull()
  })

  it('picks whichever watched movie has the latest watched_at', () => {
    const movies = [
      { watched: true, watched_at: '2026-06-01T00:00:00Z', title: 'Older' },
      { watched: true, watched_at: '2026-07-02T00:00:00Z', title: 'Newest' },
      { watched: false, watched_at: null, title: 'Unwatched' },
    ]
    expect(mostRecentlyWatched(movies)?.title).toBe('Newest')
  })
})

describe('formatShortDate', () => {
  it('formats as "Month Day", pinned to UTC regardless of local timezone', () => {
    expect(formatShortDate('2026-07-02T00:00:00Z')).toBe('July 2')
  })
})

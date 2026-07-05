import { describe, it, expect } from 'vitest'
import { isRecentlyAdded } from './isRecentlyAdded'

describe('isRecentlyAdded', () => {
  it('is false when there is no created_at at all', () => {
    expect(isRecentlyAdded(null)).toBe(false)
  })

  it('is true for something added a few hours ago', () => {
    const now = Date.now()
    const createdAt = new Date(now - 3 * 60 * 60 * 1000).toISOString() // 3h ago
    expect(isRecentlyAdded(createdAt, now)).toBe(true)
  })

  it('is false for something added over two days ago', () => {
    const now = Date.now()
    const createdAt = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
    expect(isRecentlyAdded(createdAt, now)).toBe(false)
  })
})

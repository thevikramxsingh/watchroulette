import { describe, it, expect } from 'vitest'
import { selectTrailer } from './tmdb-videos'

// Unit tests on the one piece of judgment in this proxy — which video, out
// of TMDB's often-messy list, counts as "the trailer." Everything else in
// this file is a thin network wrapper, same testing boundary as
// tmdb-search.js/repoApi.js.
describe('selectTrailer', () => {
  it('returns null when there are no videos at all', () => {
    expect(selectTrailer([])).toBeNull()
    expect(selectTrailer(undefined)).toBeNull()
  })

  it('returns null when nothing matches Trailer+YouTube', () => {
    const videos = [
      { key: 'a1', site: 'YouTube', type: 'Clip', official: true, published_at: '2020-01-01' },
      { key: 'a2', site: 'Vimeo', type: 'Trailer', official: true, published_at: '2020-01-01' },
    ]
    expect(selectTrailer(videos)).toBeNull()
  })

  it('picks the only Trailer+YouTube video, ignoring clips and other sites', () => {
    const videos = [
      { key: 'clip', site: 'YouTube', type: 'Clip', official: true, published_at: '2020-01-01' },
      { key: 'vimeo-trailer', site: 'Vimeo', type: 'Trailer', official: true, published_at: '2020-01-01' },
      { key: 'the-one', site: 'YouTube', type: 'Trailer', official: true, published_at: '2020-01-01' },
    ]
    expect(selectTrailer(videos)).toBe('the-one')
  })

  it('prefers an official trailer over an unofficial one, regardless of date', () => {
    const videos = [
      { key: 'unofficial-earlier', site: 'YouTube', type: 'Trailer', official: false, published_at: '2019-01-01' },
      { key: 'official-later', site: 'YouTube', type: 'Trailer', official: true, published_at: '2020-06-01' },
    ]
    expect(selectTrailer(videos)).toBe('official-later')
  })

  it('among multiple official trailers, picks the earliest by published_at', () => {
    const videos = [
      { key: 'later-recut', site: 'YouTube', type: 'Trailer', official: true, published_at: '2020-06-01' },
      { key: 'original-theatrical', site: 'YouTube', type: 'Trailer', official: true, published_at: '2020-01-15' },
    ]
    expect(selectTrailer(videos)).toBe('original-theatrical')
  })

  it('falls back to the earliest unofficial trailer when none are official', () => {
    const videos = [
      { key: 'regional-recut', site: 'YouTube', type: 'Trailer', official: false, published_at: '2020-06-01' },
      { key: 'earliest-unofficial', site: 'YouTube', type: 'Trailer', official: false, published_at: '2020-01-01' },
    ]
    expect(selectTrailer(videos)).toBe('earliest-unofficial')
  })
})

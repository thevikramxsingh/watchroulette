// "New" tag on recent adds (Module 6) — computed client-side from the
// existing created_at timestamp, no new column, no read-tracking/
// notification system. "Roughly the last day or two" is spec's own phrase,
// not pinned to an exact cutoff — two full days is a reasonable reading of
// that and simple to reason about.
const RECENT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

export function isRecentlyAdded(createdAt, now = Date.now()) {
  if (!createdAt) return false
  return now - new Date(createdAt).getTime() < RECENT_WINDOW_MS
}

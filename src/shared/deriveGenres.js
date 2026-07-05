// Shared genre-list derivation — used by both the Decision Engine's genre
// filter (Module 2) and the Repo panel's genre filter (Module 6's spec
// explicitly calls for reusing this rather than writing it twice). Pure,
// so it's unit-testable without a network call.
export function deriveGenres(movies) {
  return [...new Set(movies.flatMap((movie) => movie.genres ?? []))].sort()
}

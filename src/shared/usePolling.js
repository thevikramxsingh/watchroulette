import { useCallback, useEffect, useRef, useState } from 'react'

// 4-second polling instead of Supabase Realtime, per the spec's
// architecture call: same user-facing effect for a handful of friends,
// with no websocket connection lifecycle to manage/debug. Generic so every
// feature (Repo, Decision Engine, Arena) shares one implementation instead
// of three copies of the same setInterval logic.
export function usePolling(fetchFn, intervalMs = 4000) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  // Kept in a ref so the interval doesn't need to be torn down and
  // recreated every time the caller passes a new function reference.
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const refetch = useCallback(async () => {
    try {
      const result = await fetchFnRef.current()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => {
    refetch()
    const id = setInterval(refetch, intervalMs)
    return () => clearInterval(id)
  }, [refetch, intervalMs])

  return { data, error, refetch }
}

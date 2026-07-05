import { useCallback, useState } from 'react'

// Generic localStorage-backed state — the same pattern the spec calls for
// in three separate places: the "name typed once" identity (Architecture),
// the sound mute toggle, and per-device Arena "already played" flags. One
// implementation instead of three copies.
export function useLocalStorageState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setAndStore = useCallback(
    (next) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // localStorage unavailable (e.g. private browsing) — state still
        // works in-memory for this session, it just won't survive a reload.
      }
    },
    [key]
  )

  return [value, setAndStore]
}

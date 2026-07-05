import { useEffect, useState } from 'react'
import { useLocalStorageState } from '../shared/useLocalStorageState'
import Curtain from '../shared/Curtain'

const ENTRANCE_DURATION_MS = 900

// The app's one-time "curtains open" first impression (spec.md's "Entrance
// moment", part of Module 5b since it reuses the curtain component built
// for the spin wheel's reveal, rather than a second implementation of the
// same visual idea).
//
// Plays once ever per browser, not once per tab session — deliberately
// `localStorage`, not `sessionStorage`. A fresh browser *session* happens
// every time someone opens the site for movie night, which is exactly the
// audience this is supposed to feel rare for; sessionStorage would have
// replayed it constantly for real users and only once for a long-lived
// interview-demo tab — backwards from the intent.
//
// `children` render the whole time, underneath — this is chrome layered on
// top, not a mount gate, so skipping doesn't remount the app underneath it.
export default function Entrance({ children }) {
  const [hasEntered, setHasEntered] = useLocalStorageState('watchroulette:entranceShown', false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (hasEntered) return
    // One tick after mount, not on mount itself — starting already-open
    // would skip the "closed" beat entirely.
    const openTimer = setTimeout(() => setOpen(true), 50)
    return () => clearTimeout(openTimer)
  }, [hasEntered])

  useEffect(() => {
    if (!open || hasEntered) return
    const finishTimer = setTimeout(() => setHasEntered(true), ENTRANCE_DURATION_MS)
    return () => clearTimeout(finishTimer)
  }, [open, hasEntered, setHasEntered])

  if (hasEntered) return children

  return (
    <div className="relative min-h-screen">
      {children}

      {/* Click-to-skip — covers the real content while the intro plays, so
          any click anywhere jumps straight to the app instead of waiting
          out the full animation. */}
      <button
        type="button"
        onClick={() => setHasEntered(true)}
        aria-label="Skip intro"
        className="fixed inset-0 z-50 cursor-pointer"
      />

      <Curtain open={open} durationMs={ENTRANCE_DURATION_MS} className="fixed inset-0 z-40" />
    </div>
  )
}

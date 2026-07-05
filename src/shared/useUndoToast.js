import { useCallback, useRef, useState } from 'react'

// Shared "brief toast with an Undo action" mechanism (Module 6) — used by
// both the Repo panel's remove action and its watched-toggle, per spec's
// explicit call for the watched-toggle undo to reuse the same mechanism
// remove uses, rather than a second implementation. Only one toast shown
// at a time; a new one replaces whatever's currently showing, same as most
// toast systems.
const TOAST_DURATION_MS = 5000

export function useUndoToast() {
  const [toast, setToast] = useState(null) // { message, onUndo } | null
  const timerRef = useRef(null)

  const showUndoToast = useCallback((message, onUndo) => {
    clearTimeout(timerRef.current)
    setToast({ message, onUndo })
    timerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }, [])

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  const handleUndo = useCallback(() => {
    toast?.onUndo()
    dismiss()
  }, [toast, dismiss])

  return { toast, showUndoToast, handleUndo }
}

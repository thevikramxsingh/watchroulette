// Presentational half of the shared undo-toast mechanism (Module 6) — see
// useUndoToast.js for the state/timer logic. Deliberately has no state of
// its own: renders nothing when there's no active toast, so callers don't
// need a separate visibility check.
export default function Toast({ toast, onUndo }) {
  if (!toast) return null

  return (
    <div role="status" className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-lg bg-card px-4 py-2 text-sm text-cream shadow-lg ring-1 ring-gold/30">
        <span>{toast.message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="font-medium text-gold hover:text-gold-hover"
        >
          Undo
        </button>
      </div>
    </div>
  )
}

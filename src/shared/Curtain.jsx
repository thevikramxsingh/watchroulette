// Shared "theater curtain" — two velvet panels that slide apart to the
// edges when `open`. Reused for both the spin wheel's reveal (Module 5b)
// and the one-time app entrance moment (Entrance.jsx), per spec's explicit
// call for the entrance beat to reuse this exact component rather than a
// second implementation of the same visual idea.
//
// Renders no content of its own — purely the two panels, positioned via
// `className` (default covers an absolutely-positioned parent; callers
// needing a viewport-fixed overlay, like Entrance.jsx, pass their own).
// Callers stack this on top of whatever it's covering; Curtain doesn't need
// to know or care what that is.
//
// Curtain-panel red is material, not a status color (see spec.md's Visual
// design system note) — real velvet curtains are red; that's what's being
// drawn, not a signal about app state.
export default function Curtain({ open, durationMs = 700, className = 'absolute inset-0' }) {
  return (
    <div className={`pointer-events-none ${className} flex overflow-hidden`} aria-hidden="true">
      <div
        className="w-1/2 bg-theater-red shadow-[inset_-10px_0_24px_rgba(0,0,0,0.45)] transition-transform ease-in-out"
        style={{
          transform: open ? 'translateX(-100%)' : 'translateX(0)',
          transitionDuration: `${durationMs}ms`,
        }}
      />
      <div
        className="w-1/2 bg-theater-red shadow-[inset_10px_0_24px_rgba(0,0,0,0.45)] transition-transform ease-in-out"
        style={{
          transform: open ? 'translateX(100%)' : 'translateX(0)',
          transitionDuration: `${durationMs}ms`,
        }}
      />
    </div>
  )
}

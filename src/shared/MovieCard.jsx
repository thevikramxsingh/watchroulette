import { useState } from 'react'
import { isRecentlyAdded } from './isRecentlyAdded'

// Module 4 — the shared poster/description/watch-link card. Used by both
// RepoPanel and DecisionEngine's pool list so they stay visually identical
// by construction rather than by convention (spec.md's "UI polish pass").
// All detail shown at once — poster, title, genre tags, description, watch
// link — no expand-on-click interaction, so this stays a pure
// presentational component with no state of its own beyond the copy-link
// button's own transient "Copied" feedback (Module 6).
//
// `variant` controls which single corner-badge control renders: Repo's
// persistent watched-state ('watched') or Decision Engine's ephemeral
// spotlight-for-tonight state ('spotlight') — never both, since a given
// card is only ever shown in one of those two contexts. `onRemove` is
// Repo-only too (Module 6) — DecisionEngine never passes it, so the trash
// affordance simply doesn't render there.
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342'
const COPIED_FEEDBACK_MS = 1500

export default function MovieCard({ movie, variant, onToggleWatched, onToggleSpotlight, onRemove }) {
  const hasPoster = Boolean(movie.poster_path)
  const [copied, setCopied] = useState(false)

  function handleCopyLink() {
    navigator.clipboard?.writeText(movie.watch_page_url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    })
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-gold/20">
      <div className="relative aspect-[2/3] bg-page">
        {hasPoster ? (
          <img
            src={`${POSTER_BASE_URL}${movie.poster_path}`}
            alt={`${movie.title} poster`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-warmgray/40">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}

        {isRecentlyAdded(movie.created_at) && (
          <span className="absolute top-2 left-2 rounded bg-gold px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gold-ink uppercase">
            New
          </span>
        )}

        {variant === 'watched' && (
          <label
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-card/90 ring-1 ring-gold/40"
            title={movie.watched ? 'Watched' : 'Mark watched'}
          >
            <input
              type="checkbox"
              aria-label={`Mark ${movie.title} as watched`}
              checked={Boolean(movie.watched)}
              onChange={() => onToggleWatched(movie)}
              className="h-4 w-4 accent-[var(--color-gold)] focus:ring-2 focus:ring-gold"
            />
          </label>
        )}

        {variant === 'spotlight' && (
          <button
            type="button"
            aria-label={`Spotlight ${movie.title}`}
            aria-pressed={Boolean(movie.spotlighted)}
            onClick={() => onToggleSpotlight(movie)}
            className={`absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-sm transition duration-150 ease-out ${
              movie.spotlighted
                ? 'bg-gold text-gold-ink'
                : 'bg-card/90 text-warmgray ring-1 ring-gold/40 hover:text-gold'
            }`}
          >
            ★
          </button>
        )}
      </div>

      <div className="border-t border-dashed border-gold/30 px-3 py-2.5">
        <p className="font-display text-[15px] font-semibold leading-tight text-cream">
          {movie.title}
        </p>

        {movie.genres?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {movie.genres.map((genre) => (
              <span
                key={genre}
                className="rounded border border-gold/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-gold uppercase"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {movie.summary && (
          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-warmgray">
            {movie.summary}
          </p>
        )}

        {(movie.watch_page_url || movie.trailer_key) && (
          <div className="mt-1.5 flex items-center gap-3">
            {movie.watch_page_url && (
              <>
                <a
                  href={movie.watch_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:text-gold-hover"
                >
                  Watch
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </a>

                {/* Copy-link button (Module 6) — the group already
                    discusses movie night in its own chat outside this app;
                    this lets a suggestion leave the app easily instead of
                    requiring everyone to be in-app to see it. */}
                <button
                  type="button"
                  aria-label={copied ? 'Link copied' : `Copy watch link for ${movie.title}`}
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 text-xs font-medium text-warmgray hover:text-gold"
                >
                  {copied ? (
                    'Copied'
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="11" height="11" rx="1.5" />
                      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
                    </svg>
                  )}
                </button>
              </>
            )}

            {movie.trailer_key && (
              <a
                href={`https://www.youtube.com/watch?v=${movie.trailer_key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-warmgray hover:text-gold"
              >
                Trailer
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Attribution + remove (Module 6) — added_by is captured on every
            insert and was never rendered anywhere before this; the trash
            affordance is Repo-only in practice, since only RepoPanel ever
            passes onRemove. */}
        {(movie.added_by || onRemove) && (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            {movie.added_by ? (
              <p className="text-[11px] text-warmgray/70">Added by {movie.added_by}</p>
            ) : (
              <span />
            )}

            {onRemove && (
              <button
                type="button"
                aria-label={`Remove ${movie.title}`}
                onClick={() => onRemove(movie)}
                className="text-warmgray/60 transition duration-150 ease-out hover:text-theater-red"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

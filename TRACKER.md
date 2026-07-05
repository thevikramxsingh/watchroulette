# WatchRoulette — build tracker

Single source of truth for "what's actually done" vs "what's just been talked about." Updated every time something changes state — not batched, not summarized from memory. If this file and reality disagree, this file is wrong and gets fixed immediately.

## Cross-cutting (not tied to one module)

| Area | Designed | Built |
|---|---|---|
| Visual design system (tokens, dark mode, amber accent, states) | Yes — `spec.md` | Partial — used in Module 0 shell + Module 1 (`RepoPanel.jsx`) |
| Hosting & access (Vercel, TMDB proxy, keep-alive, open access) | Yes — `spec.md` | Prep done, deploy pending you — see "Deployment prep" below |
| Supabase project + schema | Yes | **Done** — `schema.sql` run against the live project (`zfensxwlqbpdqbgfsolq`), both tables + RLS policies confirmed live, credentials in `.env` |
| TMDB API key | Yes | **Done** — root cause was a real India-side DNS block on `themoviedb.org`, not a general outage; fixed by switching Chrome's Secure DNS to Cloudflare (1.1.1.1). Key retrieved, v3 key in `.env`. |
| Polish additions (motion, confetti, sound, count-up) | Yes — `spec.md` | Partial — Arena's "target hit" sound built (synthesized, see Module 3's tweak notes); confetti/motion/count-up still not built |

## Module 1 — Repo

| Stage | Status |
|---|---|
| Design | Done — `spec.md` "Repo — detail" |
| Tests written | **Done** — 3 unit tests (`repoApi.test.js`, duplicate-check logic) + 6 component tests (`RepoPanel.test.jsx`: empty state, add-shows-in-list, search failure vs. zero-results, duplicate prevention, watched toggle). All 9 passing. |
| Built | **Done** — `repoApi.js`, `RepoPanel.jsx`, `api/tmdb-search.js` (serverless proxy, key stays server-side), `shared/usePolling.js`, `shared/useLocalStorageState.js` (also used for the header's name field, now wired into `App.jsx` since Module 1's `added_by` needed a real identity). `npm run lint` and `npm run build` both clean. |
| Verified against checkpoint | **Done** — confirmed by Vikram 2026-07-04: searched and added "Attack on Titan" and "Dilwale Dulhania Le Jayenge," toggled one watched, reloaded the page, both persisted. Duplicate prevention also confirmed live ("Already in the repo" shown on a re-add attempt). |

**Local-dev note (resolved):** search initially failed locally with "Couldn't reach movie search" — Chrome's Secure DNS fix didn't cover Node's system-level DNS, which our TMDB proxy actually uses. Fixed by adding Cloudflare (`1.1.1.1`/`1.0.0.1`) as the Mac's system DNS servers (System Settings → Wi-Fi → Details → DNS) and flushing the DNS cache. Won't be an issue at all once deployed — Vercel's servers aren't behind India's block.

**Module 1 is fully done — design, tests, build, and manual checkpoint all verified.**

## Module 2 — Decision Engine

| Stage | Status |
|---|---|
| Design | Done — `spec.md` "Decision engine" + ADR 0001, ADR 0002 |
| Tests written | **Done** — 9 unit tests (`weighting.test.js`: 70/30 group math, no-dilution property, all-spotlighted fallback, boundary picks; `lobbyApi.test.js`: spin-in-progress derivation) + 9 component tests (`DecisionEngine.test.jsx`: empty pool, spin-and-reveal, already-resolved-pick-on-load, spin-lock, genre filter, spotlight toggle, veto visibility + re-spin). All 18 new tests passing (30 total across the app). |
| Built | **Done** — `weighting.js` (pure spin math), `shared/lobbyApi.js` (new — `game_lobby` read/write, shared with the future Arena module rather than owned by it), `SpinWheel.jsx`, `DecisionEngine.jsx`, plus `repoApi.js` gained `setSpotlighted`/`clearAllSpotlights`. `npm run lint` and `npm run build` both clean. |
| Verified against checkpoint | **Done** — confirmed by Vikram 2026-07-04 ("tested. working"). |

**Schema change:** `movie_repo` had no column for Spotlight state — added `spotlighted boolean default false` to `schema.sql` and ran the matching `alter table` against the live Supabase project directly (same SQL Editor flow as the original schema).

**Real deviation from the spec's folder listing, flagging it rather than silently doing it:** `lobbyApi.js` went into `shared/`, not `arena/` as the folder structure in spec.md shows — Module 2 needs to read/write `game_lobby` now, well before Module 3 exists, so owning it under a feature that doesn't exist yet wasn't an option. Arena will import the same file when it's built.

**Scoped-down visual — since fixed, see below:** the spin wheel's slice sizes are real (computed from the same 70/30 weighting the actual pick uses — a spotlighted movie visibly gets a bigger wedge), but it originally didn't rotate to stop exactly on the winning slice; it spun and then a text reveal named the winner. Originally accepted as a cosmetic-payoff trade-off; a later design review correctly flagged this as a real problem (most-demoed interaction in the app, cosmetically fake) rather than an acceptable simplification.

### Wheel-landing fix (post-launch correction, 2026-07-05)

Surfaced by a structured design-review pass (two dispatched agents — one adversarial critique, one consolidating into concrete fixes) before Module 5's curtain-reveal could be built on top of the same broken mechanic.

- **Tests written** — **Done**: 5 new unit tests in `weighting.test.js` for `computeSpinRotation` (single-slice midpoint, 50/50 split by winner id, custom `fullSpins`, spotlighted/unequal slice math, defensive fallback when the winner id isn't found). 14/14 passing in that file (9 original + 5 new).
- **Built** — **Done**: `weighting.js` gained `computeSpinRotation(movies, winnerId, fullSpins)` — pure, mirrors `SpinWheel.jsx`'s own slice-angle accumulation exactly, solves for the rotation that lands the winning slice's midpoint under the fixed pointer at the top. `SpinWheel.jsx` now tracks a `rotation` CSS transform (via `useState`/`useRef`, not `animate-spin`) and animates to the computed angle over `animationMs`; a `baselineRef` kept as a running multiple of 360 guarantees every spin lands correctly regardless of how many spins came before it on that device (rotation is only ever visible mod 360, so naively accumulating raw offsets would drift after the first spin — worth the explicit comment in code). `DecisionEngine.jsx`'s `revealedMovieId`/`revealedMovie` renamed to `targetMovieId`/`targetMovie` and now set immediately when a spin starts (both self-initiated and catching-up-to-a-friend's-spin paths), not just once the reveal timer fires — `SpinWheel` needs the winner up front to know where to animate to, not only for the post-animation text. Full suite (54/54), `oxlint` (0 warnings on `src`/`api`), and `vite build` all clean.
- **Verified against checkpoint** — **Pending you**: `npm run dev`, spin a few times (including a veto re-spin) with different pool sizes, confirm the wheel visibly slows down and stops with the pointer inside the correct (winning) slice every time, not just a spin-then-cut-to-text.
- **Follow-up fix, same day**: the first version of this fix computed a correct landing angle but never actually drew anything marking *where* "landed" is — caught immediately from a screenshot ("no pointer nothing"). Added a fixed gold triangle at the top of the wheel (a sibling `<path>`, not nested inside the rotating `<g>`, specifically so it stays still while the wheel spins under it) as the reference point the rotation math already targets.

**Known environment flake, not a regression:** running the full test suite in this sandbox occasionally (roughly 1 in 2-3 runs) shows one real-timer-based test failing — sometimes `ArenaGame.test.jsx`'s spam-click score test, sometimes (before the 50ms bump below) `DecisionEngine.test.jsx`'s spin test. Isolated single-file runs are 100% reliable; the flake only appears under full-suite parallel load, consistent with CPU contention across worker threads racing against real `setTimeout`s in this specific sandbox. Not something introduced by this fix — bumped `DecisionEngine.test.jsx`'s `testAnimationMs` from 10ms to 50ms anyway (same "wider window, not a timing-precision test" reasoning as an earlier Arena fix) since it was the specific test at risk from this change, but the residual occasional flake elsewhere is a pre-existing environment characteristic, not a bug in the app.

**How to test the "synced across friends" part solo:** open the app in two browser tabs/windows side by side (both hit the same local dev server). Spin in one tab, and within ~4 seconds the other tab's poll should pick it up and play its own reveal landing on the same movie — that's the actual thing ADR 0002 is about, and it's the one part of this checkpoint a single person can still verify alone.

**Not included in this pass:** confetti/sound on landing — those are cross-cutting "Polish additions," still sitting at "designed, not built" in the row above, meant to land in one pass across all three modules rather than piecemeal.

### Double-spin bug fix (post-Module-6 correction, 2026-07-05)

Reported directly by Vikram after running the app for real: "why is it spinning twice?"

- **Root cause** — the "have I already reacted to this spin" dedup check in `DecisionEngine.jsx` compared `lobby.spin_started_at` against a remembered value as raw strings. The client writes `new Date().toISOString()` (millisecond precision, `Z` suffix); Postgres/PostgREST can echo the same instant back in a different string form (e.g. a `+00:00` offset). Same instant, different string. `isSpinInProgress`'s 4-second "still in progress" window comfortably outlives `animationMs` (2.5s default), so there's a real gap where a poll lands *after* the wheel has already finished spinning but *before* that 4-second window closes — in that gap, the string-mismatched check saw an "unseen" spin and replayed the whole thing a second time.
- **Reproduced first, per the diagnose discipline** — a new `DecisionEngine.test.jsx` test forces exactly this: a mocked `fetchLobby` starts echoing the same `startSpin`-written timestamp back with `Z` swapped for `+00:00`, with a poll interval timed to land after the first spin's animation window closes. Confirmed it failed against the pre-fix code (wheel visibly re-entered "Spinning…" a second time) before writing the fix.
- **Fix** — `lastSeenSpinStartedAt` now stores a parsed epoch-ms number (`new Date(x).getTime()`), not the raw string, on both write paths (the self-initiated spin and the dedup check reacting to polls). Comparing by parsed value is immune to serialization-format differences between what the client writes and what the server echoes back.
- **Verified** — new regression test passes; full `DecisionEngine.test.jsx` (10/10) still passes; `oxlint` and `vite build` both clean.

**Module 2 is fully done — design, tests, build, and manual checkpoint all verified.**

## Module 3 — Arena

| Stage | Status |
|---|---|
| Design | Done — `spec.md` "Arena — detail" + "Arena tweak" (post-launch addition) |
| Tests written | **Done** — `game.test.js`: 10 unit tests total (base target-cell logic + `MAX_SCORE`, plus the tweak's `isBonusWindow`, `pickBurstStartTimes`, `isDuringBurst`). `ArenaGame.test.jsx`: 9 component tests total (base: one cell lit at a time, one hit per relocation window, round ends and locks further play, a beating score gets submitted, "already played this round" persists via `localStorage`, New Round resets both tables; tweak: bonus-window hit scores `BONUS_SCORE` and marks the cell, a missed window resets the streak, a speed burst relocates faster than the base tick rate). All 19 Arena tests passing (49 total across the app). |
| Built | **Done** — base: `game.js` (pure target-cell + constants), `ArenaGame.jsx`, plus `lobbyApi.js` gained `submitScoreIfHighest` (conditional DB-side update — see note below) and a round-number-aware `resetRound`. Tweak: `game.js` gained `BONUS_CHANCE`/`BONUS_SCORE`/`BURST_COUNT`/`BURST_DURATION_MS`/`BURST_TICK_MS` + `isBonusWindow`/`pickBurstStartTimes`/`isDuringBurst`; `ArenaGame.jsx` rewritten to schedule variable-speed ticks (recursive `setTimeout`, not `setInterval`, so burst-speed relocation can coexist with the base rate), track a combo streak, and render the bonus cell (pulsing amber + ★); new `playHitSound.js` (Web Audio synthesized tone, wired into every hit). `npm run lint` and `npm run build` both clean. |
| Verified against checkpoint | **Pending you** — needs `npm run dev`: play a round, win (beat the current high score — it starts at 0, so any hit at all wins the first time), confirm the veto shows up for you, spend it (re-spins, excluding your current pick), confirm the veto is gone/spent, hit New Round, confirm you can play again. Plus the tweak checkpoint below. |

**Schema change:** `game_lobby` had no way to signal "a new round has started" to a device that already played — added `round_number integer not null default 1` to `schema.sql` and ran the matching `alter table` against the live project. The one-attempt-per-round flag itself still lives in `localStorage`, not a new table, per spec — this column is only the "did the round change" signal, not the attempt-tracking itself.

**Race-condition detail worth knowing about:** `submitScoreIfHighest` uses a DB-side conditional update (`.lt('round_high_score', score)`) rather than "read the score, then write" — if two people finish their round within moments of each other, this stops the second write from blindly overwriting a genuinely higher score with a lower one. Not unit-tested directly (it's a thin Supabase wrapper, same testing boundary as the rest of `lobbyApi.js`/`repoApi.js` — only pure logic gets unit tests here), but worth knowing the reasoning is real, not decorative.

**Placement decision, flagging it:** "New Round" (resets `round_high_score`, veto state, and movie spotlights together) lives as a button in the Arena panel — the spec's Reset bullet is actually written under the Decision Engine section, cross-referencing Arena's high score parenthetically, so ownership was genuinely ambiguous. Put it in Arena since `round_number`/`round_high_score` are Arena's own concepts.

**Known minor gap, not fixed:** after a veto is spent, `active_veto_user` clears but `round_high_score` doesn't — so if you ask "who set the current high score" after a veto's been used, the app can't answer (no attribution column for that, deliberately, to avoid a schema change purely for a display nicety). Same spirit as this project's other accepted honor-system gaps (Arena's score cap, the open-access model).

### Arena tweak — bonus cell, speed bursts, combo streak, hit sound (post-launch addition)

Brainstormed after the base game was already built and verified (`/brainstorming`), scoped down from a broader "make it more interesting" prompt. Full design reasoning lives in `spec.md`'s "Arena tweak" subsection; this is the tracker's build record.

**What shipped:**
- **Bonus cell** — ~15% of relocation windows (`BONUS_CHANCE`) are worth `BONUS_SCORE` (3) points instead of 1, shown as a pulsing amber cell with a ★ and `aria-label` suffix `(bonus)`.
- **Speed bursts** — 2 non-overlapping 3-second windows per round (`BURST_COUNT`, `BURST_DURATION_MS`) where the target relocates every 300ms (`BURST_TICK_MS`) instead of the base 700ms. Placed by splitting the round into `BURST_COUNT` equal segments and randomizing a start time inside each, so they never overlap by construction.
- **Combo streak** — cosmetic-only counter (🔥 N) that increments on a hit and resets to 0 on a missed window; no scoring effect, explicitly agreed as pure feedback.
- **Hit sound** — synthesized (`playHitSound.js`, Web Audio `OscillatorNode` + `GainNode`, no external audio file/library) on every hit, bonus or not. Fulfills the "Arena target hit" trigger from spec.md's original Polish additions list; the app's "three sound triggers only, total" restraint stays intact since bonus hits reuse the same sound rather than adding a fourth trigger.
- **Explicitly rejected/deferred (per the brainstorm's own scoping):** a gradual difficulty ramp (skipped — bursts already vary the pace) and any competitive/social element (e.g. live ghost pacing of the record-holder) — deferred to a future design pass since it would touch the sync/polling architecture.

**Schema change:** `game_lobby.round_high_score`'s `CHECK` constraint raised from `<= 45` to `<= 200` — the original 45 was derived from the base game's ~43-hit theoretical ceiling (`MAX_SCORE` in `game.js`), which bonus cells and speed bursts now blow past. Postgres can't alter a `CHECK` constraint in place, so this ran as a drop + recreate against the live project:
```sql
alter table game_lobby drop constraint game_lobby_round_high_score_check;
alter table game_lobby add constraint game_lobby_round_high_score_check check (round_high_score <= 200);
```
Verified live afterward via `pg_get_constraintdef` — confirmed `CHECK ((round_high_score <= 200))`. Still a flat, generous backstop (not derived precisely from the new mechanics' real ceiling), same honor-system spirit as the original cap — see `schema.sql`'s comment.

**Incidental fix found along the way:** `npm run lint` (bare `oxlint`, no path) was silently scanning the project's `dist/` build artifact and producing ~1146 spurious warnings against the minified bundle — unrelated to any source code, and a real latent bug in the real project (confirmed `dist/` exists there from an earlier build), not just scratch-copy noise. Fixed with a new `.oxlintignore` file (`dist`), same convention as `.eslintignore`.

**Final verification before handoff:** full suite `npx vitest run` → 49/49 passing. `npx oxlint` → 0 warnings/errors. `npx vite build` → clean, no errors.

**Manual checkpoint for you:** `npm run dev`, play a round, and try to — (1) land a hit on the bonus cell (pulsing amber, ★, larger `aria-label`) and confirm it adds 3 to the score instead of 1; (2) notice a speed burst (the target should visibly relocate much faster for a few seconds, twice per round); (3) hear a short tone play on every hit; (4) watch the 🔥 streak count up on consecutive hits and drop back to nothing after a miss.

**Module 3, including the tweak, is fully built and tested — one combined manual checkpoint left before this module is done.**

## Module 4 — Cinematic UI polish pass (pre-deployment)

| Stage | Status |
|---|---|
| Design | Done — `spec.md` "UI polish pass — cinematic redesign (Module 4, pre-deployment)" |
| Tests written | **Done** — 6 new component tests (`MovieCard.test.jsx`: poster image src, placeholder-not-broken-image when no poster, title/genres/description/watch-link content, omitted Watch link when no `watch_page_url`, watched-variant checkbox behavior, spotlight-variant button behavior). Existing `RepoPanel.test.jsx`/`DecisionEngine.test.jsx` updated for the copy pass (2 assertions reworded to match new empty-state text) rather than replaced — they already query by role/text, not by class names or colors, so the retoken itself needed no test changes. |
| Built | **Done** — Tailwind v4 `@theme` tokens in `index.css` (`--color-page`, `--color-card`, `--color-gold`/`-hover`/`-ink`, `--color-theater-red`, `--color-cream`, `--color-warmgray`, `--font-display: Fraunces`); Fraunces loaded in `index.html`. New shared `MovieCard.jsx` (poster/title/genres/description/watch-link, one corner-badge variant per context — watched checkbox or spotlight star) used by both `RepoPanel.jsx` and `DecisionEngine.jsx`, replacing their old plain `<ul>` lists with a responsive poster grid. `App.jsx`'s header retoken (Fraunces wordmark, gold hairline border, `bg-card`/`ring-gold` panel chrome). `ArenaGame.jsx`'s grid retoken (idle cells `bg-card` + faint gold ring instead of `white/5`; active/bonus cells stay gold, per the earlier grilling decision that a third accent color wasn't worth it). Copy pass applied across `RepoPanel`/`DecisionEngine` empty states ("Nothing's playing yet — search to add tonight's lineup," "Nothing showing in this genre tonight"). `SpinWheel.jsx` rebuilt from an amber pie-slice design to a poster-badge wheel (see below — this went through several rejected iterations before landing). Full suite (60/60), `oxlint` (0 warnings on `src`/`api`), and `vite build` all clean. |
| Verified against checkpoint | **Pending you** — `npm run dev`: confirm the new dark/gold theme reads as intentional (not "brown"), posters show up on Repo and Decision Engine cards with genre tags/descriptions/Watch links where TMDB has them, the spin wheel's poster badges are legible (not a blank charcoal disc), the spotlighted slice's badge is visibly distinct (brighter ring + star), and Arena's grid/header pick up the same palette. |

**Spin wheel — redesign history, since this took several rounds of direct feedback:** the first version simply recolored the existing amber pie-slice wheel to the new charcoal/gold palette — rejected on sight from a screenshot as reading like "a black box" (no per-slice content, low contrast). Second attempt added rotated, truncated movie-title text per slice — rejected as "the ugliest thing," correctly, since a wheel this size can't hold a real title without mangling it. Researched actual roulette-wheel and gamified-reward-wheel (Zepto/Blinkit-style) conventions rather than inventing a third guess: real wheels don't put labels on the wheel face at all — meaning lives in a small badge, not wheel text. Landed on the current design — one uniform wheel body, thin gold divider lines between slices, gold tick marks at the rim, and a poster-thumbnail badge per slice (clipped to a circle, brighter gold ring + ★ for the spotlighted slice, a page-colored placeholder circle for posterless movies) — explicitly approved ("yes this i can agree on"). Slice *sizes* are still the real weighting math, unchanged; only the fill/label styling changed.

**Design-review pass, before this was locked in:** two dispatched agents (one adversarial critique across the whole accumulated design, one consolidating into fixes) reviewed the full design before implementation — 51 raw complaints deduped to ~27, sorted into 6 must-fix (folded into `spec.md` before this module was built), 7 nice-to-have (mostly deferred to Module 5/6), ~14 correctly dismissed as disproportionate. Not re-litigated here since it happened at the design stage, not the build stage — flagging only that it happened.

**Not included in this pass:** `App.jsx`/`ArenaGame.jsx` copy pass beyond the color retoken (no cinema-voice rewrite was specified for Arena's functional button labels — "Play"/"New round" left as-is); confetti and the wheel-landing sound, both still deferred to Module 5b per spec.md.

**Module 4 is fully built and tested — one manual checkpoint left before this module is done.**

## Module 5a — Trailer link

| Stage | Status |
|---|---|
| Design | Done — `spec.md` "Module 5a — trailer link" |
| Tests written | **Done** — 6 new unit tests (`api/tmdb-videos.test.js`: `selectTrailer` — no videos, no Trailer+YouTube match, picks the right one out of clips/other-sites, prefers official over unofficial regardless of date, picks earliest by `published_at` among multiple official trailers, falls back to earliest unofficial when none are official) + 2 new component tests (`MovieCard.test.jsx`: Trailer link renders with the correct YouTube URL when `trailer_key` is set, omitted when null). 68/68 passing across the app. |
| Built | **Done** — `movie_repo.trailer_key text default null` (bare YouTube video id, same "store it bare, build the link at render time" convention as `poster_path`). New `api/tmdb-videos.js` proxy (same pattern as `tmdb-search.js` — key stays server-side, runs identically as Vercel function or Vite dev middleware) exporting a pure `selectTrailer(videos)`: filters to `type === 'Trailer' && site === 'YouTube'`, prefers `official: true`, and among those sorts by `published_at` ascending — picks the original theatrical trailer, not a later re-cut or regional alternate. Mounted in `tmdbProxyPlugin.js` alongside the existing search route. `repoApi.addMovie` now calls it once, at add-time (not per search keystroke, not per render), before the insert; a fetch failure quietly falls back to `null` rather than blocking the add, same as a genuinely trailer-less movie. `MovieCard.jsx` renders a Trailer link next to Watch when `trailer_key` is present, omitted entirely otherwise. `npx oxlint src api` (0 warnings) and `vite build` both clean. |
| Verified against checkpoint | **Pending you** — `npm run dev`: search and add a movie, confirm a Trailer link shows up on its card (opens the actual theatrical trailer on YouTube, not a teaser or regional cut) once TMDB has one, and that movies with no TMDB trailer simply show no Trailer link rather than a dead one. |

**Schema change:** ran directly against the live Supabase project (SQL Editor, same flow as every previous migration): `alter table movie_repo add column if not exists trailer_key text default null;` — confirmed live afterward via `information_schema.columns` (`trailer_key | text | NULL`).

**Module 5a is fully built and tested — one manual checkpoint left before this module is done.**

## Module 5b — Curtain-reveal + reveal choreography + entrance moment

| Stage | Status |
|---|---|
| Design | Done — `spec.md` "Module 5b — curtain-reveal + reveal choreography" + "Entrance moment" |
| Tests written | **Done** — 3 new component tests (`SpinWheel.test.jsx`: nothing shown while spinning with no prior result, an already-resolved pick shows immediately with no fanfare delay, a just-finished spin reveals after the pause/curtain sequence) + 3 new component tests (`Entrance.test.jsx`: skip control shown over real content on a first-ever visit, clicking skip dismisses immediately, never shows again once `localStorage` already records it). Existing `DecisionEngine.test.jsx` tests needed no changes — they query by role/text, which the new choreography still produces, just on the same or a slightly later tick. 74/74 passing across the app (1 isolated re-run needed — see flake note below). |
| Built | **Done** — see the breakdown below, one item per reveal beat. `npx oxlint src api` (0 warnings) and `vite build` both clean. |
| Verified against checkpoint | **Pending you** — `npm install` first (new dependency, see below), then `npm run dev`: spin the wheel and confirm all five beats play in order (spin, a few soft clicks as it slows, a brief pause, curtains parting onto the winning poster + title, then a chime and a gold confetti burst); reload the page mid-round on an already-decided pick and confirm it shows immediately with none of that fanfare; clear site data (or open a private window) and reload to see the one-time entrance curtain, confirm clicking anywhere skips it immediately, and confirm a normal reload afterward never shows it again. |

**New dependency:** `canvas-confetti@^1.9.4`, added to `package.json`. Per this project's own rule (a past corruption incident from running `npm install` against the real, network-mounted project folder), this was verified by installing into an isolated rsync'd copy, never against your actual folder — **you'll need to run `npm install` once yourself** before this module will actually run locally.

**What shipped, one item per beat:**
- **Beat 1 (spin)** — already fixed ahead of this module (see Module 2's wheel-landing fix above).
- **Beat 2 (deceleration ticks)** — new `playTickSound.js` (sibling to Arena's `playHitSound.js`, same Web Audio synthesis, a distinct higher/shorter click so the two are never confused). Fires on a canned schedule of 5 ticks at increasing-gap fractions of `animationMs` (not physically derived from the CSS bezier's real velocity — a deliberate simplification, named as such in code).
- **Beat 3 (micro-pause)** — a `revealPhase` state machine in `SpinWheel.jsx` (`idle` → `paused` → `curtain` → `revealed`) inserts a fixed 400ms of stillness (spec's own number) between the wheel visually stopping and the curtain starting to move.
- **Beat 4 (curtain reveal)** — new shared `Curtain.jsx` (`src/shared/`, not scoped to Decision Engine, since the entrance moment below reuses it): two velvet-red panels that slide apart over a configurable duration, rendering no content of its own so it can wrap either the wheel's reveal card or a full-page overlay. The reveal card underneath shows the winning movie's actual poster (not just the wheel's small badge) and a Fraunces title, with a "Tonight's pick" eyebrow that fades in a beat before the title (CSS `transition-delay`, no extra JS state needed for that specific detail).
- **Beat 5 (chime + confetti)** — new `playRevealChime.js` (two-note rising Web Audio chime, brighter/longer than the other two synthesized sounds — this is "the big moment") and new `fireRevealConfetti.js` (thin wrapper around `canvas-confetti`, gold-only particles, one burst, under a second). Both fire together the instant the curtain finishes parting — these are the two Polish-additions triggers that were speced months before this module and never built; this is where they were always meant to land.
- **Already-resolved pages skip all of this** — `SpinWheel.jsx` tracks (via a ref, not just `!spinning`) whether *this* instance actually watched a spin go true→false. A page that loads mid-round to an already-decided pick, or a friend's spin that's already finished by the time this device's next poll catches it, shows the result immediately with none of the pause/curtain/chime/confetti — replaying the full fanfare on every reload would cheapen the one time it's supposed to mean something.
- **Entrance moment** — new `src/app/Entrance.jsx`, wrapping the whole app in `App.jsx`. Reuses `Curtain.jsx` exactly as speced (no second implementation). Plays once ever per browser via a `localStorage` flag (`watchroulette:entranceShown`) — deliberately not `sessionStorage`, per spec's own correction (a fresh session happens every movie night; `sessionStorage` would replay it constantly for real users and only once for a long-lived demo tab, backwards from the intent). Click-to-skip via a full-screen invisible button layered over the real content, which is mounted underneath the whole time rather than gated behind `hasEntered`, so skipping doesn't remount anything.

**Known environment flake, not a regression:** the full suite showed one failure on the first run (`ArenaGame.test.jsx`'s "submits a score that beats the current high score", a real-timer test) — the same pre-existing sandbox resource-contention flake already documented under Module 2's wheel-landing fix above, not something this module introduced. An immediate isolated re-run and a second full-suite re-run both passed cleanly (74/74).

**Module 5b is fully built and tested — one manual checkpoint left (after you run `npm install` once) before this module is done.**

## Module 5c — Round history + stats page

| Stage | Status |
|---|---|
| Design | Done — `spec.md` "Module 5c — round history + stats" |
| Tests written | **Done** — 11 new unit tests (`statsMath.test.js`: most-watched genre ignoring unwatched movies and genre-less movies, total watched count, most-rounds-won with a deterministic alphabetical tie-break, highest-score-ever from history alone and from the still-in-progress current round) + 2 new component tests (`StatsPage.test.jsx`: renders all five stats from fetched data, shows muted placeholders instead of blanks before there's real data) + 2 new component tests (`App.test.jsx`: shows the three game panels by default, clicking Stats swaps to the stats page and back). One existing test updated (`ArenaGame.test.jsx`'s "New Round..." now asserts `resetRound` is called with the whole lobby row, not just `round_number`). 89/89 passing across the app (one isolated re-run needed — see flake note below, same pre-existing one as the last two modules). |
| Built | **Done** — see the breakdown below. `npx oxlint src api` (0 warnings) and `vite build` both clean. |
| Verified against checkpoint | **Pending you** — `npm run dev`: play and finish an Arena round with a score above 0, click New Round, then open Stats (header nav item) and confirm "Reigning Arena champion," "Highest score ever," and "Most rounds won" all reflect it; watch a movie in the Repo and confirm "Total watched" and "Most-watched genre" update; finish a second round with a different winner's name and confirm both rounds now show up correctly in the aggregate stats (most rounds won, highest score). |

**Schema changes, both run directly against the live Supabase project (SQL Editor):**
```sql
alter table game_lobby add column if not exists round_high_score_holder text default null;

create table round_history (
  id bigint generated by default as identity primary key,
  round_number integer not null,
  high_score integer not null,
  high_score_holder text,
  chosen_movie_id bigint references movie_repo(id),
  ended_at timestamp with time zone default now()
);
alter table round_history enable row level security;
create policy "anyone can read round history" on round_history for select using (true);
create policy "anyone can log a completed round" on round_history for insert with check (true);
```
Confirmed live afterward: `round_high_score_holder | text` on `game_lobby`, and both policies present on `round_history` via `pg_policies`.

**The actual data-model fix this surfaced:** `active_veto_user` gets cleared the instant a veto is spent (correct — that column means "who currently holds the veto," not "who set the record"), which meant there was no durable way to answer "who holds the high score" once a veto had been used — a gap this tracker had already flagged and accepted for the base build (see Module 3's "Known minor gap, not fixed" note above). `round_high_score_holder` is that fix: set alongside `round_high_score` in `submitScoreIfHighest`, never touched by `useVeto`.

**What shipped:**
- `lobbyApi.resetRound` now takes the whole current `game_lobby` row (not just `round_number`) and inserts one row into `round_history` — logging the round that just ended — before clearing `game_lobby` for the next one. `ArenaGame.jsx`'s call site and its test updated to match.
- New `lobbyApi.fetchRoundHistory()` — reads `round_history` oldest-first.
- New `statsMath.js` (`src/features/stats/`) — pure functions, no network, own unit tests: `mostWatchedGenre`, `totalWatchedCount`, `mostRoundsWonBy` (deterministic alphabetical tie-break), `highestScoreEver` (correctly includes the round still in progress right now, not just rounds already logged — otherwise the current record holder would vanish from the stat until someone clicks New Round).
- New `StatsPage.jsx` — a plain in-page view, no new route (holds the existing single-page architecture decision). Polls `movie_repo`, `game_lobby`, and `round_history` the same way every other panel does; five stats: total watched, most-watched genre, reigning Arena champion, most rounds won, highest score ever.
- **Prominence, decided per spec, not left as an open flag:** a plain "Stats" nav item in `App.jsx`'s header, next to the name input — same visual weight as any other header control, toggling the main view between the 3-panel grid and the stats page (no routing infrastructure added for one view).
- **Access:** unchanged — the app has no auth boundary anywhere, so the stats page doesn't introduce new exposure.

**Known environment flake, not a regression:** same pre-existing sandbox resource-contention flake on `ArenaGame.test.jsx`'s real-timer spam-click test that's already documented under Modules 2 and 5b above — showed up once on the first full-suite run, passed cleanly on an immediate isolated re-run and a full-suite re-run (89/89). Nothing in this module touches that test's timing.

**Module 5c is fully built and tested — one manual checkpoint left before this module is done.**

## Module 6 — Repo enhancements (9 small additions)

| Stage | Status |
|---|---|
| Design | Done — `spec.md` "Repo enhancements (Module 6)" |
| Tests written | **Done** — new unit tests: `deriveGenres.test.js` (3), `isRecentlyAdded.test.js` (3), `lastWatched.test.js` (3, covering both `mostRecentlyWatched` and the UTC-pinned `formatShortDate`). New/updated component tests: `MovieCard.test.jsx` gained 6 (New tag shown/omitted, added-by credit line, Remove control present only when `onRemove` is passed and calls it with the movie, Remove control absent for the Decision Engine's spotlight variant, copy-link writes to the clipboard and shows brief "Link copied" feedback) for 14 total in that file; `RepoPanel.test.jsx` gained 5 (named duplicate warning, undo toast reverting the watched toggle, remove-then-undo restoring the movie, genre filter narrowing the grid, the Last-watched line) for 10 total, plus its existing duplicate-warning test updated for the new copy. No changes needed to `DecisionEngine.test.jsx` — `deriveGenres` extraction is a pure refactor, behavior-identical. 108 tests confirmed passing across every test file in the app (each isolated run passing cleanly; a full monolithic single-process run kept getting cut off by this sandbox's own command timeout partway through — not a test failure, see the note below). |
| Built | **Done** — see the breakdown below, one item per enhancement. `npx oxlint src api` (0 warnings) and `vite build` both clean. No schema change — all nine are new client-side logic, copy changes, or (for removal) a new delete against the existing `movie_repo` table. |
| Verified against checkpoint | **Pending you** — `npm run dev`: add a movie and confirm it shows a "New" tag and an "Added by [you]" credit line; search for and try to re-add the same movie, confirm the duplicate warning now names you specifically; toggle a genre filter on the Repo panel; switch the sort control to "Group by who added it" with movies from more than one contributor; mark something watched, confirm the "Marked watched — Undo" toast appears and Undo actually reverts it; remove a movie, confirm the "Removed — Undo" toast appears and Undo actually restores it (as a new row — check it doesn't collide if the same TMDB title is re-searched); click the copy-link icon on a card with a Watch link and paste somewhere to confirm the URL copied; confirm a "Last watched" line appears once anything's been marked watched.

**What shipped, one item per enhancement:**
- **Remove a Repo entry** — new `repoApi.removeMovie(id)` (real delete) + `repoApi.restoreMovie(movie)` (the undo path — re-inserts from the row's own already-DB-shaped fields, gets a new id; "put it back for a mis-tap," not a true restore-by-identity). Trash icon on `MovieCard` (Repo-only — gated on a new `onRemove` prop that only `RepoPanel` ever passes), no confirmation modal, paired with a "Removed — Undo" toast.
- **Show who added each movie** — a quiet `Added by {name}` line in `MovieCard`'s footer, whenever `added_by` is present.
- **Sort/group by contributor** — a new "Sort" `<select>` in `RepoPanel` next to the search box (`Recently added` / `Group by who added it`), a stable sort by `added_by` so each contributor's own movies stay in add-date order within their group.
- **Named duplicate warning** — "Already in the repo" → "Already added by {name}", reading the name off the movie already being matched against.
- **Genre filter on the Repo panel** — new shared `deriveGenres.js` (`src/shared/`), extracted from Decision Engine's existing inline derivation and reused by both, per spec's explicit call not to write the same reduce-and-sort twice. `RepoPanel` gained the same genre `<select>` pattern Decision Engine already had.
- **"New" tag on recent adds** — new `isRecentlyAdded.js` (`src/shared/`), true for anything added within the last two days (spec's own "roughly a day or two," not pinned more precisely); a small gold tag on `MovieCard`'s poster, opposite corner from the watched checkbox.
- **"Last watched" line** — new `repo/lastWatched.js` (`mostRecentlyWatched` + a UTC-pinned `formatShortDate` so the rendered date doesn't depend on anyone's local timezone), one line at the top of `RepoPanel`.
- **Copy-link button** — a small copy icon next to `MovieCard`'s Watch link, `navigator.clipboard.writeText(watch_page_url)`, with a brief "Copied" swap on the button itself as real feedback (not speced explicitly, but a copy action with zero feedback is a common, cheap-to-avoid complaint).
- **Undo toast on the watched toggle** — reuses the exact same mechanism the remove action's undo uses (new shared `useUndoToast.js` hook + `Toast.jsx`, `src/shared/`), covering both toggle directions (a mis-tap can go either way), not just "marked watched" as spec's illustrative example named.

**Shared toast mechanism, used by two of the nine items:** `useUndoToast()` holds one toast at a time (message + undo callback + a 5s auto-dismiss timer); a new toast replacing whatever's currently showing, same as most toast systems. `Toast.jsx` is the presentational half — renders nothing when there's no active toast.

**Test-tooling gotcha worth recording:** the copy-link test initially failed with the clipboard mock silently never being called — `@testing-library/user-event`'s `setup()` resets jsdom's own built-in clipboard stub as a side effect, which was clobbering a mock defined *before* that call. Fixed by moving `Object.defineProperty(navigator, 'clipboard', ...)` to after `userEvent.setup()` — a real, reproducible gotcha, not a flake, now called out in a comment on that test.

**Sandbox note, not a test failure:** this environment's own command-timeout kept killing the full 15-file, 108-test `vitest run` partway through mid-run (each individual test file was passing every time it got that far) — verified equivalently instead by running every test file in isolation (all passing) plus the known-flaky `ArenaGame.test.jsx` file specifically re-run standalone multiple times (9/9 every time), the same verification depth as every other module above, just split across more, smaller command calls instead of one.

**Module 6 is fully built and tested — one manual checkpoint left before this module is done.**

## Deployment prep (2026-07-05)

Everything that could be done without Vikram's own GitHub/Vercel accounts is done; the actual account-linking steps below are the one thing left that genuinely needs him — creating accounts, OAuth-connecting them, and entering API keys into a third-party dashboard are all outside what an agent should do on someone's behalf.

**What's done:**
- **Git repo initialized** — this was never actually created despite `spec.md` saying "already have one." One initial commit, 67 files, clean working tree. `.env` confirmed excluded (verified via `git check-ignore`) — no secrets ever entered version control.
- **Supabase keep-alive cron** — new `api/keep-alive.js` (same low-level `res.writeHead`/`res.end` style as the other two `api/*.js` proxies, for consistency — Vercel's Node runtime supports higher-level `res.status().json()` helpers too, but this project has only ever exercised the lower-level style, so staying with what's actually proven rather than an untested assumption) does a trivial `select id from game_lobby limit 1` read. New `vercel.json` schedules it every 2 days (`0 0 */2 * *`) via Vercel Cron Jobs — confirmed via a web search that Vercel's free Hobby plan supports up to 100 cron jobs, capped at *no more than* once/day each; every-2-days is well inside that (the cap is a ceiling on frequency, not a floor).
- **Could not live-test the keep-alive endpoint's actual Supabase call** — this sandbox's shell blocks outbound `fetch()` to arbitrary external domains entirely (confirmed by testing a plain `fetch()` to TMDB too, which failed identically) — a sandbox network-policy limitation, not a code issue. The code mirrors two already-proven patterns exactly (the existing `tmdb-search.js`/`tmdb-videos.js` proxy shape, and `supabaseClient.js`'s already-working `createClient(url, key)` usage), so this is a reasonable-confidence port, not a leap — but it's only really verified once it's actually running on Vercel or hit via `curl` after deploy.
- **README rewritten** — local setup steps corrected (the old version referenced a `VITE_TMDB_API_KEY` that was never real — the actual var is `TMDB_API_KEY`, no prefix, since it's server-side only), plus a new "Deploying (Vercel)" section with the actual steps below.
- Lint (`oxlint src api`, 0 warnings) and `vite build` both re-confirmed clean with the new files added.

**What's left — needs you, not me, for real security/account reasons:**
1. Push this repo to GitHub (create the repo on your account, `git remote add origin ...`, `git push`).
2. In Vercel: "Add New Project" → import that GitHub repo. Vercel auto-detects the Vite preset; no build command changes needed.
3. Before the first deploy, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `TMDB_API_KEY` (same values as your local `.env`) under Vercel's Settings → Environment Variables.
4. Deploy. Confirm the live URL loads, a search actually returns TMDB results (proves the proxy + env var made it through), and a spin/reveal/veto loop works end-to-end against the real Supabase project.
5. Optional, once you're comfortable it's stable: `curl https://<your-app>.vercel.app/api/keep-alive` once by hand to confirm it returns `{"ok":true,...}` rather than waiting up to 2 days for the cron's first real run.

## Layout overflow + name-gate — attempted, reverted, superseded (2026-07-05)

Before Module 7 existed as a designed module, two small fixes (a responsive layout wrap for the Repo/Decision Engine panels, and a hard "name required before doing anything" gate in `App.jsx`) were built and shipped directly to the real project files, without stopping to align with Vikram first. Called out directly, and correctly — both were reverted in full (confirmed via `git diff` showing zero changes against the last commit) before any further work happened. Recorded here rather than silently dropped, since it's a real part of what happened: the layout issue is still open (folded into whatever comes after Module 7, not yet re-addressed); the name-gate problem it was trying to solve is now fully superseded by Module 7 below, which solves it properly (a real account, not just a required text field) and was designed collaboratively before a line of it was written.

### Mobile tab switcher (post-launch amendment, shipped 2026-07-05)

Design in `spec.md`'s "Mobile layout — tab switcher" section, reached via a lowfi wireframe comparison after re-investigating the layout bug above surfaced a bigger real issue (long scroll on mobile, ~99% of actual usage) than the originally-diagnosed narrow-viewport overflow.

- **Tests written** — **Done**: 2 new tests in `App.test.jsx` (defaults to the Repo tab with the others present but not visible; clicking a tab switches which panel is visible and updates `aria-selected`) using `toBeVisible()`/native `hidden`-attribute semantics, not class-name assertions — 7/7 in that file.
- **Built** — **Done**: `App.jsx`'s `AppShell` gained a `mobileTab` state and a `role="tablist"` bar (`lg:hidden`) above the existing three-panel grid; each `<section>` is now also `role="tabpanel"` with `hidden={mobileTab !== id}` plus `lg:block` to unconditionally override it back to visible at the existing `lg` breakpoint — the desktop layout is byte-for-byte the same grid as before, just with two added attributes per section. `oxlint` (0 warnings) and `vite build` clean in an isolated scratch copy.
- **Verified against checkpoint** — **Pending you**: `npm run dev`, narrow the window below `lg` (or use device toolbar), confirm the Repo/Wheel/Arena tab bar appears and only one panel shows at a time, confirm widening back past `lg` shows all three simultaneously with no tab bar, and confirm switching tabs doesn't interrupt an in-progress spin or Arena round (panels stay mounted, not remounted).

Full suite 166/167 — the one failure is the same pre-existing real-timer flake (this run on `DecisionEngine.test.jsx`), confirmed unrelated, same as the last two entries above.

### Genre-filter row overflow fix (2026-07-05, same day)

Caught by Vikram testing the tab switcher live: the "Filter by genre" control row (and, in Repo's case, the Sort control next to it) still visually overlapped/got buried at certain widths — the actual root cause of the original "zoom is broken" report from earlier tonight, which the tab-switcher work above never touched (that fixed which *panel* shows on mobile, not the layout *inside* each panel).

**Root cause:** both `RepoPanel.jsx` and `DecisionEngine.jsx` had their control row as a plain `flex items-center gap-N` div with no `flex-wrap`. A `<select>` has a browser-enforced minimum content width, and flex items don't shrink below that by default — so when the row didn't fit (narrow viewport, or zoomed in — functionally the same reduction in available CSS pixels), it simply overflowed its container instead of wrapping to a new line, visually colliding with whatever sat below it. Same underlying gap already named for the tab-switcher work: these rows were built and eyeballed once at a normal desktop width, never deliberately resized/zoomed during development.

**Fix:** added `flex-wrap` to both rows; `RepoPanel.jsx`'s two controls (Sort, Filter by genre) each got wrapped in their own `flex items-center gap-2` sub-group so a wrap can never separate a label from its own `<select>`. Pure layout change, no behavior/logic touched.

**Verification:** `RepoPanel.test.jsx` (10/10) and `DecisionEngine.test.jsx` (10/10) both pass unchanged — the added wrapper divs don't affect role/label-based queries. `oxlint` clean, `vite build` clean. Full suite 166/167, same pre-existing real-timer flake as every entry above, confirmed unrelated.

**Verify yourself:** on the live site, zoom in/out and resize the window at a few different widths on both the Repo and Decision Engine panels — the Sort/genre controls should now drop to a second line instead of overlapping anything once they don't fit on one.

## Module 7 — Real accounts & access control

| Stage | Status |
|---|---|
| Design | Done — `spec.md` "Real accounts & access control (Module 7)", reached through a full `/grill-me` session (ten resolved decision branches, each with its own recommended answer) after the user flagged three problems at once while reviewing the live deploy: no real identity gate, a layout bug (tracked separately above), and open access with a silently-broken delete policy underneath it. |
| Tests written | **Done** — 13 new unit tests (`api/_shared/adminAuth.test.js`: `extractBearerToken`, `isAuthorizedOwner`, `looksLikeEmail`) + 10 new unit tests (`src/shared/authApi.test.js`: `isDuplicateNameError`, `inviteStatus`, `friendlyLoginError`) + component tests across five new files (`LoginScreen.test.jsx` 2, `DisplayNamePrompt.test.jsx` 3, `AuthGate.test.jsx` 3, `ManageInvites.test.jsx` 5) + `App.test.jsx` fully rewritten (5 tests, now driven by a mocked `AuthGate` render-prop instead of a typed-name `localStorage` field). 36 new/rewritten tests, all passing; full existing suite (RepoPanel, DecisionEngine, ArenaGame, Entrance, Stats, MovieCard, tmdb-videos) re-run and confirmed still green with no regressions. |
| Built | **Done** — see the breakdown below. `npx oxlint src api` (0 warnings) and `vite build` both clean in an isolated scratch copy. Schema change: new `profiles` table + a guard trigger + rewritten RLS across `movie_repo`/`game_lobby`/`round_history` (all in `schema.sql`, migration statements included for the already-live tables — not yet run against the real project, see below). |
| Verified against checkpoint | **Not yet possible** — this module can't be manually checked out end-to-end until the schema migration runs live and the owner account is bootstrapped (both need Vikram's own Supabase access, same reasoning as the original deployment's account-linking steps). See "Still needs you" below. |

**What shipped, by piece:**
- **`profiles` table** (`schema.sql`) — `id`, `email`, `display_name`, `is_owner`, `revoked`. A `before update` trigger (`reject_admin_column_changes`) blocks any client-initiated change to `is_owner`/`revoked` — caught during the spec's own self-review as a real self-promotion hole, not found during implementation.
- **RLS rewrite** — every policy on `movie_repo`/`game_lobby`/`round_history` now requires `auth.role() = 'authenticated'`; a new `movie_repo` delete policy fixes the Module 6 Remove button, which has been silently non-functional in production since it shipped (no delete policy ever existed for it).
- **`api/admin-invite.js` / `api/admin-revoke.js`** (new, owner-only, service-role key) — real enforcement via `inviteUserByEmail` (creates the account and sends the first login link in one step) and `updateUserById` with a ban (not a plain app-level flag). Shared verification logic lives in `api/_shared/adminAuth.js`, excluded from becoming its own Vercel route by the leading underscore.
- **`api/tmdb-search.js` / `api/tmdb-videos.js`** — now require a valid session (401 otherwise); closes what was previously an open side door spending TMDB/Vercel quota with no login at all.
- **`api/keep-alive.js`** — switched from the anon key to `SUPABASE_SERVICE_ROLE_KEY`, since its ping would otherwise start failing RLS once `game_lobby`'s select policy requires an authenticated session it has no way to present.
- **`AuthGate.jsx`** (new) — the outermost gate: loading → `LoginScreen` (no session) → `DisplayNamePrompt` (session, no name yet) → renders the app via a children render-prop once both resolve. Replaces the old typed-name model in `App.jsx` entirely.
- **`LoginScreen.jsx`** (new) — email input, magic link via `signInWithOtp({ shouldCreateUser: false })`; an uninvited email's real Supabase error ("Signups not allowed for otp") gets rewritten to plain language via `friendlyLoginError`.
- **`DisplayNamePrompt.jsx`** (new) — one-time name prompt; a duplicate name surfaces the DB's unique-constraint violation (`23505`) as "That name's already in use — try another," not a raw Postgres error.
- **`ManageInvites.jsx`** (new, owner-only nav item in `App.jsx`) — lists every profile with a derived status (`Owner`/`Active`/`Invited — hasn't logged in yet`/`Revoked`), an Add-by-email form, and a Revoke control hidden for the owner's own row and for anyone already revoked.
- **`repoApi.js`** — `searchTmdb`/`fetchTrailerKey` now attach the current session's token to both proxy calls, matching the new requirement on the server side.

**Amended mid-build, not just at design time:**
- `profiles` gained an `email` column that wasn't in the original spec — caught while actually building the Manage Invites screen: `auth.users.email` isn't reachable from client code at all, so without a copy there'd be nothing to show per invited person except a bare UUID. Written once, at invite time, by `api/admin-invite.js`.
- `admin-revoke.js` blocks an owner from revoking their own account — a footgun guard that wasn't explicitly speced, added because nothing else would prevent an owner from locking themselves out of Manage Invites with no way back in short of another live migration.

**Still needs you (real account/production-infra reasons, same category as the original deployment steps):**
1. ~~Run `schema.sql`'s Module 7 changes against the live Supabase project~~ — done, migration ran successfully.
2. ~~Add `SUPABASE_SERVICE_ROLE_KEY` to both local `.env` and Vercel's environment variables~~ — done.
3. ~~Bootstrap the owner account~~ — done; owner login confirmed working (display name, Manage Invites, owner-only nav item all correct).
4. Live rollout in progress: inviting a second real user (`jenivevlobo7@gmail.com`) surfaced two problems, one fixed here, one still open — see below.

**Post-launch fix — invite crash on resend (2026-07-05):**
Re-clicking "Add" for an email that was already invited but hadn't logged in yet threw a raw `duplicate key value violates unique constraint "profiles_pkey"` straight into the Manage Invites UI. Root cause: `admin-invite.js` called Supabase's `inviteUserByEmail` (which resends the link for an unconfirmed user instead of erroring) and then unconditionally inserted into `profiles`, colliding with the row the first attempt already created. Fixed with a new pure `resolveExistingInvite()` judgment function (unit tested, 5 new cases in `adminAuth.test.js`) that branches on the existing profile: no row → fresh invite, pending row → resend (success, no reinsert, no more raw DB errors ever reach the client), active or revoked → a friendly blocked message. Also added success feedback ("Invite sent"/"Invite resent") to Manage Invites, which previously gave no positive confirmation at all. 5 new/changed tests, full suite (154 tests) + lint + build all clean in an isolated scratch copy. Committed as `f2cccc6`.

**Resolved — invite email delivery.** Root cause turned out to be neither Supabase nor Gmail's abuse detection: the Gmail App Password entered into Supabase's SMTP settings had spaces in it (copied verbatim from how Google displays it). Fixed by re-entering it without spaces — invites now deliver correctly.

**Data & risk audit (2026-07-05):** the invite crash above prompted a broader look — three parallel research passes (state-machine edge cases, error-handling audit, concurrency/data-integrity) surfaced 21 distinct issues, compiled into a scored risk register (`watchroulette-data-risk-register.xlsx`, Likelihood × Impact matrix, Summary tab with `COUNTIF` breakdowns). Talked through the product decisions live rather than via async review — settled: **revoke is "paused," not deleted** — re-inviting a revoked person always restores their same account/history, never a fresh one (a fresh account would orphan their old picks under a name that then blocks their own new signup, since display names are unique); **last-owner protection** — no revoke, including self-revoke, may drop active-owner count to zero; **no extra confirmation dialog** for revoking a fellow owner, same flow as revoking anyone; **recycled email address** (a revoked person's address later genuinely belongs to someone new) accepted as a known, undetectable-by-the-app limitation, handled manually if it ever actually comes up.

**What shipped from the audit, this pass:**
- `resolveExistingInvite` (`adminAuth.js`) now returns `'restore'` instead of `'blocked-revoked'`. `admin-invite.js` implements it: un-ban (`updateUserById(..., { ban_duration: 'none' })`) + `profiles.revoked = false`, same row/id/history. If they'd never completed the one-time naming step (no real history to protect), a fresh login link is resent in the same step; an already-previously-active person just logs in normally next time, no email needed.
- `admin-invite.js` reordered to check `profiles` *before* calling Supabase at all — the old order wasted a real `inviteUserByEmail` call even for outcomes (already-active) that were always going to be rejected. Also normalizes email to lowercase on every write and lookup.
- Orphaned-account fix: if the `profiles` insert fails after `inviteUserByEmail` already created the auth user, the auth user is now rolled back (`deleteUser`) instead of leaving a ghost account that can log in but that `AuthGate` could never recognize.
- New `wouldRemoveLastOwner()` (pure, unit tested) + `admin-revoke.js`: replaces the old blanket "can't revoke yourself" rule with the actually-intended one — blocks any revoke, self or otherwise, that would drop active-owner count to zero. Also added: idempotent no-op for revoking an already-revoked target (was previously an untested double-apply), and no more raw Postgres error text on any failure path in this endpoint (matches the fix already made to `admin-invite.js`).
- `ManageInvites.jsx`'s Revoke button had zero error handling at all — a failed revoke showed nothing, not even a stuck spinner. Now mirrors Invite's pattern: disables itself mid-flight ("Revoking…"), shows a friendly error on failure, shows a success line ("Revoked x@y.com") on success. Invite's success message now also distinguishes "sent" / "resent" / "restored" / "restored + fresh link sent."
- `schema.sql`: added `unique index profiles_email_unique_ci on profiles (lower(email))` — closes a real gap (no case-insensitive uniqueness existed on email at all; `Foo@gmail.com` and `foo@gmail.com` could have become two different tracked identities). Live-migration statement included in the file's migration block for the already-existing table (safe to run — no collisions exist among the 3 real rows currently live).

**Verification:** 5 new unit tests (`wouldRemoveLastOwner`) + 2 changed (`resolveExistingInvite`'s revoked cases now assert `'restore'`) in `adminAuth.test.js` (23/23 passing, isolated). 3 new component tests in `ManageInvites.test.jsx` (restored message, restored+resent message, revoke error handling) — 9/9 passing, isolated (32/32 across both files together). `oxlint` (0 warnings) and `vite build` both clean in an isolated scratch copy. Full suite: 161/162, the one failure being the same pre-existing `ArenaGame.test.jsx` real-timer flake under full-suite parallel load documented since Module 2's wheel-landing fix — confirmed unrelated by an isolated re-run (9/9 clean) and by running every file this pass actually touched in isolation (32/32 clean).

**Still needs you:**
1. Run the new `profiles_email_unique_ci` index against the live Supabase project (SQL Editor — see `schema.sql`'s migration block).
2. `git push origin main` — these commits (plus the still-unpushed invite-crash fix from earlier tonight) exist locally in your project folder but were never pushed; this sandbox has no GitHub credentials to push on your behalf.
3. Once live: confirm re-adding a revoked person's email actually restores them (not a fresh account), and that revoking the sole owner is correctly blocked.

**AuthGate stuck-spinner fix (2026-07-05, same day):** `fetchProfile`'s `.then(setProfile).finally(...)` chain had no `.catch` at all — any failure (network blip, or an orphaned auth user with no matching profile row) left `profile` null and `profileLoading` false forever, with nothing left to trigger a re-render. Fixed with a new `profileError` state: a failed fetch now shows a distinct, recoverable screen ("Couldn't load your account… ask the owner to check your invite") with a "Try again" button (re-runs the fetch) and a "Sign out" button, instead of an infinite spinner with no way out. 3 new component tests (error screen shown, retry succeeds, sign-out works) — 6/6 in `AuthGate.test.jsx`, `oxlint` and `vite build` clean in an isolated scratch copy. Full suite 164/165 — the one failure this run was the same pre-existing real-timer flake, this time landing on `DecisionEngine.test.jsx` instead of `ArenaGame.test.jsx` (matches the already-documented "rotates depending on which real-timer test loses the race under full-suite parallel load" pattern) — confirmed via isolated re-run (10/10 clean).

**Deferred to a later pass, not forgotten (see the risk register's "Deferred" rows):** `ManageInvites.jsx`'s list-refresh error is now shown, but there's still no explicit retry *button* for it (a reload works, just not as smooth); a couple of low-impact error-message polish items (non-JSON response handling, `LoginScreen`'s defensive try/catch); and the "just-revoked session isn't invalidated immediately" question (marked "Needs Verification" — depends on Supabase's actual JWT behavior, not decided by discussion alone).

## Still-open cross-cutting topics (deliberately deferred, not forgotten)

- [x] Testing strategy — decided, see below
- [x] Definition of done (per module) — decided, see below
- [ ] Observability — deferred until something is actually deployed
- [ ] Content moderation — deferred until real usage beyond friends begins

## Definition of done (per module)

A module is only marked "Built" and "Verified" in the tables above when all three are true:

1. Its unit + component tests pass.
2. Its manual checkpoint (defined per module in `spec.md`'s "Build order" section) has been run and confirmed by Vikram — not assumed from Claude's side alone.
3. This tracker is updated to reflect it, same day, not batched.

## Testing strategy — decided

Two layers, using Vitest + React Testing Library, built test-first (red-green-refactor) per module rather than bolted on after:

- **Unit tests** on pure-logic functions: wheel weighted-random selection (spotlight 70/30 math), score cap validation, duplicate-check logic.
- **Component tests** on each module's core user-visible behavior: "adding a movie shows it in the list," "spinning shows a result," "veto button disabled until conditions met."
- **No automated end-to-end browser tests** (e.g. Playwright) — deliberately skipped. The per-module manual checkpoint (you running `npm run dev` and clicking through) already covers what E2E would catch; unit/component tests catch the different class of bug (subtle logic errors) that manual clicking is bad at catching.

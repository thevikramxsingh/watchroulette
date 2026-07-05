# WatchRoulette — spec

This is the source of truth for the build. If we change the approach mid-module, this file gets updated first — the code is generated from this, not the other way around.

## Problem

Friend group can never agree on what to watch, and re-litigating it wastes time. Need: a shared, curated repo of options, a fast way to land on one pick, and a fair (gamified, not argued) way to override the pick when needed.

## Architecture

- **Frontend**: Vite + React + Tailwind v4. Single-page, no routing needed.
- **Backend**: Supabase (Postgres + auto REST API). No hand-built server for app logic — the server layer isn't the differentiated part of this app, and skipping it is a deliberate scope cut for a one-day build. (One small exception: a serverless function to proxy TMDB calls — see Hosting & access below.)
- **Movie data**: TMDB API (search, genres, watch providers), called through our own serverless proxy rather than directly from the browser. Free, has watch-provider data (OMDb/IMDb don't), proven at production scale (Plex/Kodi/Jellyfin run on it).
- **Sync**: 4-second polling of the two Supabase tables, not Realtime subscriptions. Same user-facing effect for a handful of friends, no websocket connection lifecycle to manage/debug in a day.
- **Identity**: a name typed once, stored in `localStorage`. Not real auth — stated explicitly, not implied to be more. **Superseded 2026-07-05** by real accounts — see "Real accounts & access control (Module 7)" below. Kept here for the record: this was a deliberate simplicity trade-off for a one-day build, revisited once the app was actually live and "anyone can type any name" stopped being theoretical.

## Data model

`movie_repo` — the shared curated list.
`game_lobby` — single row (`id = 'current_session'`), tracks who holds the veto and the current spin pick.

Full DDL: `schema.sql`. RLS is on with open policies (no per-user auth exists to scope policies tighter); documented in the SQL file itself.

## Known limitation

TMDB's watch/providers endpoint does not return deep links into Netflix/Prime/etc (blocked by TMDB's JustWatch data agreement). We store TMDB's own `/watch` page link instead — accurate, still one click from watching.

## Hosting & access

Needs to be always live — this doubles as a friend-group tool and an interview/portfolio demo, so it can't depend on a laptop being open.

- **Frontend host**: Vercel, connected to a GitHub repo (already have one). Free subdomain (`watchroulette.vercel.app`-style) — no custom domain, no cost.
- **Deploy flow**: one branch per module/feature, each gets its own private Vercel preview URL for testing the real deployed build. Merging to `main` is the moment it goes live to everyone. Straight-to-main pushes are intentionally avoided so a half-finished module never reaches friends live.
- **TMDB key**: never shipped to the browser. A Vercel serverless function proxies TMDB calls (`/api/tmdb-search`, `/api/tmdb-watch-providers`); the frontend calls our own API, not TMDB directly.
- **Supabase uptime**: free tier auto-pauses after ~7 days with no activity. A Vercel Cron Job pings the database every couple of days to prevent that — no extra service to sign up for, stays inside Vercel.
- **Access control**: open — anyone with the link reads/writes the same shared repo and lobby. No login, no room codes. Deliberate simplicity trade-off, not an oversight; revisit with room codes only if it's ever actually abused. **Superseded 2026-07-05** — see "Real accounts & access control (Module 7)" below. Not "actually abused" in the sense originally meant, but the user reviewing the live deploy correctly flagged that the promise itself ("no outsiders") wasn't true, and a real delete operation had shipped (Module 6) with no matching RLS policy at all — worth fixing before this app gets used as a portfolio demo, not after something goes wrong.
- **Mobile**: responsive website only, opened via browser. No PWA/install step, no home-screen icon — not worth the extra config for a site that already works fine in a phone browser.
- **Rollback**: Vercel keeps every previous deploy and supports one-click instant rollback if a bad merge goes live.

## Folder structure

Feature-based, not type-based — each feature owns its components and its own API calls:

```
api/
  tmdb-search.js       serverless function, holds TMDB key server-side (Module 1)
  tmdb-watch-providers.js
src/
  app/
    App.jsx           shell layout, wires features together
  features/
    repo/
      RepoPanel.jsx
      repoApi.js        (Module 1)
    decision-engine/
      DecisionEngine.jsx
      SpinWheel.jsx      (Module 2)
    arena/
      ArenaGame.jsx
      lobbyApi.js        (Module 3)
  shared/
    supabaseClient.js
    usePolling.js        (added when Module 1 needs it)
  main.jsx
  index.css
```

## Visual design system

Decided deliberately, not inherited from defaults — every value below has a reason, documented so nobody has to guess later.

**Superseded 2026-07-05** by the cinematic redesign below (brainstormed once all three modules were built, tested, and verified — see "UI polish pass" section) — kept here struck through in spirit, replaced in full rather than patched, since the palette, typography, and single-accent rule all changed together as one coherent decision, not a series of independent tweaks. Original values for the record: accent was a single amber/gold (`#e3a53d`, hover `#f0b94f`), surfaces were plain white-alpha (`rgba(255,255,255,0.05)`/`0.1`) over `#0b0b0d`, and typography was system-ui only with no custom web font.

- **Tokens**: defined via Tailwind v4 `@theme` as CSS custom properties, not scattered inline utility values. One place to change if the palette ever moves.
- **Mode**: dark-only, permanently. No light mode, no toggle — matches every major streaming app, and doubles the design/test surface for zero benefit here.
- **Accent — two colors now, each with one meaning**: marquee gold `#D4A24C` (hover `#E0B468`, on-accent text `#1F1811`) for active/interactive states — buttons, links, spin wheel spotlighted slices, Arena's active cell; theater red `#8C2F2F` reserved for exactly one *status* meaning, "already resolved/watched," so it never competes with gold for attention. This replaces the original single-accent rule (see superseded note above) — flagging that reversal explicitly since it was a stated principle before. Still deliberately not purple (the "AI-generated app" tell called out originally still applies). Red also appears as literal set-dressing, not a status color, on the Module 5 curtain-reveal — the curtain panels themselves render in this same red because that's what velvet theater curtains are, the same way a "sky" element in some other app might just be blue without that being a semantic token. Doesn't conflict with the one-status-meaning rule above; it's not signaling app state, it's the material.
- **Surfaces, revised same day**: page `#0B0A09`, card/panel `#171412`. The first pass at this (`#14100D`/`#1F1811`) was called out as reading like brown, not black — correctly; those values sat too close to coffee on the color wheel once rendered at real scale. Pushed darker and less saturated so black actually reads as black, with gold and the (now more visible) red doing the work of signaling "warm"/"cinema," rather than asking the base surface color to do it.
- **Text hierarchy**: primary `#F3ECE0` (warm ivory), secondary/muted `#A69C8E` (warm gray).
- **Error color**: readable red `#ef4444`, plain inline text only — no alert banners/boxes. Deliberately not the same red as the new theater-red accent (`#8C2F2F`) — an error and a "you've already watched this" state must never look like the same kind of thing.
- **Typography**: two faces, each with one job. **Fraunces** (serif, weight 500/600) for movie titles and section headings only — the one characterful face, used with restraint. The existing sans stack stays for all UI chrome (buttons, labels, body copy, form fields) — it was never the boring choice that needed replacing, just the one voice that shouldn't compete with Fraunces. Genre tags and other small labels use the sans stack in small tracked-out uppercase (letter-spacing ~0.08em) — a "ticket stub" label treatment, not a third typeface.
- **Icons**: `@tabler/icons-react` — matches the icon family already used in the approved mockups, tree-shakeable.
- **Signature element — the ticket-stub divider**: a dashed 1px gold-tinted rule wherever a piece of content splits into two zones (poster vs. info on a movie card, to start). Structural, not decorative — it marks a real boundary in the content, same reasoning the spec's own writing style uses for structural devices elsewhere.
- **Component states** (applies to every interactive element, not redesigned per-component):
  - hover → next surface level up
  - focus → 2px gold ring (accessibility requirement, not optional)
  - disabled → 40% opacity, `cursor: not-allowed`
  - loading → in-place text change ("Adding…", "Spinning…"), no spinners/skeletons
  - empty → muted one-line prompt text
  - error → red inline text under the control (the original `#ef4444`, not the new theater-red accent — see Error color above)
- **Spacing/radius**: Tailwind defaults, unchanged — no custom scale.

## Polish additions

Small, deliberately cheap additions that add a considered/premium feel without new features. Cross-cutting — touches multiple modules.

- **Consistent motion timing**: every hover/focus/state transition uses the same duration/easing (150ms ease-out) everywhere. Cheapest, highest-leverage "polished" tell there is.
- **Number count-up**: scores and the wheel's landing tick up over ~200ms instead of snapping instantly. Applies to Arena's scoreboard and the Decision Engine's reveal.
- **Card hover lift**: cards shift up 2px on hover instead of only changing color. Stays flat — a transform, not a shadow/glow.
- **Staggered list fade-in**: Repo movie cards fade in ~30ms apart on load instead of all popping in at once.
- **Confetti on wheel landing only**: `canvas-confetti` library, gold-only particles (amber originally, updated to match the revised palette), under a second, triggered once when the wheel reveals its pick. Scheduled to actually get built in Module 5b's reveal sequence, not here — see that section for why. Deliberately not used anywhere else — restraint is what makes it feel like a moment, not decoration.
- **Sound effects, implementation corrected**: built as synthesized tones via the Web Audio API (`OscillatorNode`/`GainNode`), not the `use-sound`/Howler/`soundcn` asset-based approach originally planned here — a real deviation, flagged when it happened (see `TRACKER.md`'s Arena tweak notes and `src/features/arena/playHitSound.js`'s own comments): avoided fetching third-party audio assets without a deliberate yes, and Web Audio needed no new dependency. Arena target hit (Module 3) is built; wheel landing gets built in Module 5b (as ticks + a reveal chime, more than the single trigger originally scoped here — see that section). Veto unlocking is still open, same "designed, not built" status as the rest of this section. Mute toggle is also still open — not built yet, since it'd be muting a mute of just two triggers; revisit once veto unlocking ships too.
- **Arena "Spotlight" motif reuse**: the Arena's target cell (including the bonus cell) visually echoes the Decision Engine's Spotlight feature — same accent, same icon language — rather than a generic colored square. Considered giving the bonus cell its own third accent color during the UI polish pass grilling below, then rolled back: it would have meant one color (red) carrying two unrelated meanings ("already watched" and "bonus/jackpot"), which breaks the polish pass's own "one color, one meaning" rule harder than reusing gold ever did. Bonus stays gold + pulse + star, exactly as the original tweak shipped.
- **Arena scoreboard treatment**: large `ui-monospace` score number (not a custom font — a system monospace stack), circular SVG countdown ring instead of plain "12s" text, crown icon next to the current high scorer, one-line flavor text by score tier at round end.

## Repo — detail (Module 1)

Being fleshed out decision-by-decision before Module 1 starts, same as the wheel below.

- **Duplicates**: `movie_repo.tmdb_id` has a unique DB constraint — the same movie can't be added twice, since a duplicate would silently double that title's odds in the spin wheel. A client-side "already in the repo" check also runs before add, as a UX nicety; the DB constraint is the real backstop against a race between two people adding the same movie at once.
- **Watched movies**: a `watched` toggle per movie (anyone can set it, matches the open-access model). Watched movies drop out of the wheel's pool automatically but stay visible in the Repo list — becomes a shared history of what the group's watched together, not just a queue that gets stale. No hard delete.
- **Search**: live-as-you-type, debounced ~400ms, shows up to 8 candidate results. Zero results reuses the existing muted empty-state pattern, not a new one.
- **Search failure**: distinct red error-state text ("Couldn't reach movie search — try again"), not folded into the "no results" empty state — an outage shouldn't look like the movie doesn't exist. No auto-retry; typing further re-triggers the debounced search anyway.

Repo design is now fully specified; nothing left open for Module 1 on this front.

## Decision engine — spin wheel detail (Module 2)

The centerpiece mechanic: turning "everyone stares at a list" into one fair pick. Being fleshed out decision-by-decision before Module 2 starts (see ADRs for the load-bearing calls).

- **Baseline**: every unwatched movie in the filtered pool (post genre-filter, excluding anything marked watched — see Repo detail above) has equal odds by default. Nobody has to touch anything for it to work.
- **Spotlight**: tap a movie card to mark it "spotlighted for tonight" (shared across everyone polling, not just local). No sliders, no filter form — one tap toggle per movie.
- **Weighting algorithm**: spotlighted movies as a *group* always get a fixed 70% combined chance of winning, split evenly among however many are spotlighted; non-spotlighted movies split the remaining 30%. Zero spotlighted → falls back to plain equal odds automatically. See `docs/adr/0001-spotlight-weighting.md` for why this beats a flat per-movie multiplier.
- **Reset**: spotlights clear automatically when a "new round" starts (same reset action already designed for the Arena's high score in Module 3) — a whim for tonight, not a permanent boost.
- **Synced reveal**: the spinner's client decides the winner immediately and writes it to `game_lobby` before its own animation finishes; every other client plays the same fixed-duration animation on its next poll, landing on the same pre-decided winner. Everyone "watches the spin," nobody needs a live connection. See `docs/adr/0002-synced-spin-without-realtime.md`.
- **Concurrent spins**: the Spin button is disabled for everyone while a spin is in flight, derived for free from `spin_started_at` (in progress = within the last 4 seconds, no new schema). Prevents the confusing "it changed on me" scenario from two near-simultaneous clicks, rather than just tolerating it.
- **Empty pool**: Spin button disabled + muted prompt ("No movies in this genre yet") when the genre filter leaves zero movies. Reuses the existing disabled/empty-state patterns from the visual system, not a new pattern.
- **One movie in pool**: spins normally, full animation, lands on the only option. No special-cased instant reveal — kept simple on purpose.
- **Wheel landing, revised**: the shipped wheel spins via a plain CSS `animate-spin` loop and then swaps to a text reveal once the timer ends — it never actually rotates to stop on the winning slice, which `TRACKER.md` already flagged as a deliberately scoped-down visual. Revisited after a design review surfaced it as a real problem, not an acceptable simplification: this is the single most-demoed interaction in the app, and Module 5b (below) is about to layer a second reveal animation (curtains) on top of the same mechanic, which would compound rather than fix it. Since the winner is already decided the instant `spinWheel()` runs (that's the entire premise of ADR 0002's synced reveal), the target angle is knowable up front — compute the winning slice's angle from the same `computeWeights` data already driving slice sizes, and animate to a fixed rotation (some number of full turns plus the offset that lands a fixed pointer inside that slice) instead of an open-ended spin. Scheduled as a fix ahead of Module 5b, not its own module — it's a correction to Module 2's existing code, not new scope.
- **Veto re-spin**: excludes the just-chosen movie from the re-spin pool (a veto that could re-land on the same movie would feel broken). The veto-holder *can* change the genre filter before re-spinning — the real reason someone vetoes is usually "no more of this category tonight," not "I disliked that one title," so locking the filter would let someone spend their one veto without fixing their actual complaint. Spotlights carry over unchanged (they're a per-round state, not consumed by a spin).
- **Veto monopoly**: no anti-monopoly rule. If the same friend keeps winning the Arena game, they keep earning veto — skill-based outcomes are accepted as-is.
- **Nobody plays Arena**: the wheel's pick simply stands as final. Nothing about watching the movie is blocked on the mini-game being played.

The wheel/veto design is now fully specified; nothing left open for Module 2 on this front.

## Arena — detail (Module 3)

Being fleshed out decision-by-decision before Module 3 starts, same treatment as Repo and the wheel.

- **Device model**: everyone plays on their own device — matches the existing per-device `localStorage` identity model already in place elsewhere. No pass-the-phone flow.
- **Attempts**: one attempt per person per round, locked in once played. Enforced client-side (an "already played this round" flag), no new table — matches the app's existing honor-system trust level, and keeps with the core premise (save time deciding, don't add a new way to burn it).
- **The game**: whack-a-mole style — researched rather than invented (see Sources in conversation history: Smashing Magazine's React tutorial, multiple GitHub reference implementations). 3×3 grid, one cell lit at a time, target moves to a new random cell every 0.7s (fixed, not scaling in difficulty — keeps the score math consistent turn to turn), 30-second timer.
- **Score integrity**: theoretical max score is 30s ÷ 0.7s ≈ 43 hits. `round_high_score` has a DB-level `CHECK` constraint rejecting anything above 45 (43 + small buffer) — closes the "type 999999 in dev tools" hole. Not full anti-cheat (a scripted fast-tapper could still get close to 43 legitimately-ish), which is an accepted gap — full validation would need a server-authoritative game, out of scope for a friend app.

Arena's base design (above) shipped and was verified against its checkpoint. The tweaks below were brainstormed afterward, once the base game was already live, to make it "more interesting" — same fully-specified status, just added later.

### Arena tweak — bonus cell, speed bursts, feedback (post-launch addition)

- **Bonus cell**: ~15% of relocation windows are randomly marked "bonus" — same single target cell, no new cell added, no new failure mode. Worth 3 points instead of 1 if hit within that window. Visual: can't introduce a new color (single-accent design system rule already in place) — distinguished from a normal target by a pulse/glow animation + a star icon, still amber.
- **Speed burst**: 2 bursts per 30-second round, each 3 seconds long, relocation drops from 700ms → 300ms for the burst's duration. Burst timing is randomized (not a fixed schedule) so it can't be memorized/anticipated. Independent of the bonus-cell system — a bonus window can land during a burst, which is the single biggest score swing the game can produce.
- **Difficulty ramp (a base relocation speed that gradually increases over the round, independent of bursts) was considered and explicitly rejected** — bursts already give the round a variable pace; a second, separate speed system on top would be redundant tuning surface for no clear added value.
- **Feedback — hit sound**: one sound on every scoring hit (bonus or not) — this is the "Arena target hit" trigger already named in the Polish additions section below; this addition is what actually builds it. Deliberately not a distinct second sound for bonus hits — keeps the app's "three sound triggers only, total" restraint intact.
- **Feedback — combo streak**: a small counter next to the score (e.g. "🔥 5") tracking consecutive hit windows, resets the moment a window elapses with zero hits. Cosmetic only, does not affect scoring — kept out of the scoring math on purpose, to avoid three interacting scoring systems (base + bonus + streak) at once.
- **Score integrity, revisited**: bonus cells and speed bursts both invalidate the old "43 hits, cap at 45" math — there are now more possible relocation windows in a round (bursts pack more in) and some are worth 3x. Recomputing an exact new worst-case is more precision than this constraint needs (it's a soft "block the obvious dev-tools cheat" backstop, not real anti-cheat, same accepted-gap reasoning as above) — the `CHECK` constraint moves to a comfortably generous round number, `200`, instead of a tightly derived one (old ceiling was ~43; even a generous read of the new mechanics — every window a burst window, every window a bonus — doesn't get close to 200).
- **Explicitly out of scope for this pass**: any competitive/social element (e.g. a live ghost of the current record-holder's pace) — that would touch the sync/polling architecture, not just the local game loop, and got deliberately deferred to its own future design pass rather than bundled in here.

Arena tweak design is now fully specified; nothing left open on this front before implementation.

## UI polish pass — cinematic redesign (Module 4, pre-deployment)

Brainstormed after all three feature modules were built, tested, and manually verified, and before deployment — the user's own framing was "what we have is an MVP, now add professionalism before we deploy." Scoped through `/brainstorming` with the `frontend-design` skill's token-system process (color/type/layout/signature) providing the design method. Called "Module 4" here for the same reason cross-cutting work like Hosting & access gets tracked explicitly — it's a real, sequenced build step with its own checkpoint, even though it isn't owned by one feature.

- **What triggered this**: `movie_repo` has stored `poster_path`, `summary`, and `watch_page_url` since Module 1 — TMDB's search response already returns all three (see `api/tmdb-search.js`) and `repoApi.addMovie` already persists them. None of it has ever been rendered; `RepoPanel.jsx` and `DecisionEngine.jsx` show title-only rows. This pass is mostly a rendering gap, not new data plumbing — no schema change, no new API calls.
- **Vibe chosen**: cinematic/theatrical (explicitly chosen over playful/arcade and minimal/editorial, from mockups reacted to live). See the revised Visual design system section above for the actual token values (surfaces, accent, type).
- **Movie card**: new shared `shared/MovieCard.jsx`, used by both `RepoPanel` and `DecisionEngine`'s pool list — one component instead of duplicated JSX in two files, since the card needs to look identical in both places by construction, not by convention. All detail shown at once (poster, title, genre tags, description, Watch link) — no expand-on-click/hover interaction, so this stays a pure presentational component with no new state.
  - Poster: TMDB image, 2:3 aspect ratio, from `https://image.tmdb.org/t/p/w342${poster_path}` — `poster_path` is stored as TMDB's bare path (e.g. `/abc123.jpg`), so the base URL gets prepended at render time, not stored pre-built (keeps the DB value swappable if the image size ever needs to change).
  - Missing poster (TMDB doesn't have one for every title): falls back to the same charcoal placeholder block shown in the approved mockup, not a broken-image icon.
  - Existing per-panel controls (Repo's watched checkbox, Decision Engine's Spotlight star toggle) move onto the card as a small badge in the poster's corner, replacing the separate checkbox/button row each panel used before.
- **Header + layout**: "WatchRoulette" wordmark set in Fraunces, thin gold hairline rule beneath the header (was plain `border-white/10`). The existing 3-panel grid layout is unchanged — only the panel chrome (surface color, border tint) moves to the new tokens.
- **Spin wheel, redesigned (revised after the wheel-landing fix shipped and looked "like a black box")**: the original plan here — recolor slices from amber to gold/charcoal — was tried in the current amber palette first and rejected on sight: non-spotlighted slices at low-alpha-white-on-near-black were visually indistinguishable from the page itself, and the pointer fix (see Module 2 fix) made that *more* obvious, not less, since now there was something to actually look at landing on nothing. Replaced with a design grounded in how real wheels solve this:
  - Researched real roulette wheels first (alternating high-contrast pockets, meaning lives in a separate legend, never in on-wheel text) and gamified reward-wheel apps (Zepto/Blinkit-style: one calm wheel body, a small badge per slice carrying the actual content, not text). Both converge on the same lesson: a wheel this size can't hold a movie title, and trying to (truncated labels, rotated text) produced something the user correctly called "the ugliest thing" — solved by not needing text at all.
  - Final design: one uniform charcoal wheel body (not alternating slice colors), thin gold radial divider lines between slices, and a small circular badge per slice — a cropped poster thumbnail (same `image.tmdb.org` source `MovieCard` uses), not a generic icon or text. The poster itself carries recognition; nobody needs to read a label to know which slice is which movie.
  - Spotlighted slice's badge gets a visibly brighter gold ring (vs. a plain cream ring on the rest) plus a small star marker — reuses the same "gold ring + star = spotlighted" language `MovieCard`'s corner badge already establishes, rather than inventing a new visual meaning for the wheel specifically.
  - A small gold coin/hub sits at the center (a film-reel mark inside it), and short gold tick marks sit at the rim at each slice boundary — cheap, purely decorative details that make the wheel read as a physical object rather than a flat pie chart.
  - Reveal text (title, once the wheel resolves) drops the 🎬 emoji in favor of Fraunces-set type — see Module 5b below for the full reveal sequence this is now part of, which goes further than a plain text swap.
- **Arena grid**: idle cells move from `white/5` to charcoal with a faint gold hairline border. Active cell and bonus cell both stay gold (see the Polish additions section's revised note above on why a third accent color was considered and rejected). Streak counter, score text, and buttons inherit the same tokens as the rest of the app — no separate treatment.
- **Copy pass, cinema voice**: every empty state, placeholder, and status line gets rewritten in the theater's own vocabulary instead of generic SaaS phrasing — this is a text-only change (no new components, no new tests break, existing `getByText`/`getByRole` queries that assert exact strings are the only thing that needs touching). Examples: "No movies in the repo yet" → "Nothing's playing yet — search to add tonight's lineup"; "Search for a movie…" → "Search tonight's lineup…"; "No movies in this genre yet" → "Nothing showing in this genre tonight." Buttons stay verb-first and plain (`Play`, `Spin`, `Watch`) rather than getting cute — the bit that carries the voice is the empty/idle states, not the controls, so the controls stay instantly scannable.
- **Explicitly not touched in this pass**: no new features, no behavior changes to any of the three modules' actual logic (spin math, scoring, polling, veto rules all untouched) — this is a rendering/token pass only. Count-up and one sound trigger (veto unlocking) from the original Polish additions section stay exactly as open as they were before this pass; nothing here builds them. Confetti and the wheel-landing sound trigger, both originally listed here as untouched, ended up getting built after all — not in Module 4, but in Module 5b's reveal sequence below, which turned out to be their actual intended home ("triggered once when the wheel reveals its pick" was always the plan; Module 5b is just where that plan finally landed). Trailers, the curtain-reveal, and round history/stats were all raised during this same brainstorm but are genuinely new capabilities, not polish — they're specified separately below as Module 5, not folded in here.
- **Test impact expected**: existing component tests assert on text content and ARIA roles/labels, not on class names or colors — the restyle itself shouldn't break any of them. Extracting `MovieCard` does change the DOM structure `RepoPanel.test.jsx`/`DecisionEngine.test.jsx` render against, so those two test files get a pass to make sure their queries (`getByRole`, `getByLabelText`, etc.) still resolve correctly against the new markup — expected to need minor updates, not a rewrite.

UI polish pass design is now fully specified; nothing left open on this front before implementation.

## Cinematic feature additions (Module 5, same brainstorm as the polish pass)

While grilling the polish pass, the user pushed for more than a coat of paint — three real features came out of that, each with its own scope and (for two of them) its own schema change. Kept separate from Module 4 on purpose: Module 4 is a pure rendering pass with no schema or behavior change; everything below changes what the app actually stores or does.

**Split into 5a/5b/5c, revised after a design review**: originally written as one "Module 5" with one shared checkpoint. A structured critique pass (two dispatched agents — one adversarial, one consolidating) correctly flagged that bundling three unrelated features under one checkpoint breaks the "one coherent thing per module" discipline Modules 1–3 followed, right when two new schema changes make isolated verification more valuable, not less. Same total scope, now three independently-checkpointed steps.

### Module 5a — trailer link

- `movie_repo` gains `trailer_key text default null` — a YouTube video ID, not a full URL, so the link gets built at render time (`https://www.youtube.com/watch?v=${trailer_key}`), same reasoning as `poster_path` already being stored bare. Fetched once, at add-time, not per search keystroke and not per render — a new proxy endpoint `api/tmdb-videos.js` (same pattern as `tmdb-search.js`: holds no extra secret, just another TMDB call) is called from `repoApi.addMovie` right before the insert, keyed on the candidate's `tmdbId`. Filters TMDB's video list for `type === 'Trailer' && site === 'YouTube'`, prefers `official: true`, and among those sorts by `published_at` ascending rather than taking the raw first match — the oldest official trailer is usually the real theatrical one, not a regional re-cut or a teaser posted alongside it. No trailer found → `trailer_key` stays null, `MovieCard` simply doesn't render a trailer link for that movie (same "quietly omit" pattern as the missing-poster fallback). Link rot (a trailer taken down months later) is accepted as a non-issue — worst case is a dead link someone notices and re-searches TMDB directly for; not worth a revalidation job.

### Module 5b — curtain-reveal + reveal choreography (blocked on the wheel landing fix above)

`SpinWheel.jsx`'s reveal changes from a plain text pop to a full sequenced moment — researched against how slot-machine and prize-wheel design actually builds anticipation (a three-beat "anticipation / movement / resolution" structure, sound tied to motion rather than decorating it, a deliberate pause before payoff), borrowing the craft of that literature, not its manipulative intent — this app's spin happens once, fairly, per ADR 0002; there's no "keep spinning" mechanic to worry about corrupting. Sequenced after the Decision Engine's wheel-landing fix on purpose: building a reveal on top of a wheel that didn't actually land on its result would have compounded the original problem instead of fixing it.

Five beats, in order:

1. **Spin** (already fixed in Module 2's fix) — wheel eases out over `animationMs` to the exact winning angle.
2. **Deceleration ticks** — soft synthesized clicks as the wheel slows, spaced at increasing intervals to mimic losing momentum (a canned timing sequence, not physically derived from the exact CSS easing curve — good enough to feel right without the engineering cost of deriving tick timing from the bezier's instantaneous velocity). New `playTickSound.js`, sibling to Arena's `playHitSound.js` — same Web Audio synthesis approach, a different pitch/timbre so the two are never confused.
3. **Micro-pause** — once the rotation transition ends, ~400ms of deliberate stillness before anything else happens. This is the "held breath" beat the anticipation research specifically names; skipping straight from stop to reveal is what makes a reveal feel flat, per that same research.
4. **Curtain reveal** — two panels slide open from the edges, revealing the winning movie's actual poster (now that `targetMovie` carries the full `movie_repo` row, including `poster_path`) and a Fraunces-set title, not text alone. A small "Tonight's pick" eyebrow label fades in a beat before the title, echoing a real movie's studio-card-then-title sequence.
5. **Reveal chime + confetti** — the instant the curtains finish parting, a bright synthesized chime plays (`playRevealChime.js`, same Web Audio pattern) and a brief gold-only confetti burst fires (`canvas-confetti`, under a second, triggered once). Both of these were *already speced* in the original Polish additions section months ago and never built — this is the moment they were always meant to trigger at, not new scope invented here.

**Explicitly deferred, not decided against**: a bigger flourish (denser confetti / richer chime) specifically when the winning movie was spotlighted — a nice payoff for the odds-favored pick actually winning, but it's conditional branching on top of a sequence that already has five new moving parts, and wasn't asked for as a must-have. Revisit if the plain version feels like it needs more once it's actually running.

Once the wheel lands correctly, `spinWheel`/`weighting.js`'s math, `spin_started_at`-driven sync (ADR 0002), and the disabled-while-spinning behavior are all still untouched by any of this — every beat above is rendering/audio layered on a now-correct mechanic, not a change to the mechanic itself.

### Module 5c — round history + stats

- The actual data-model gap this surfaced — `game_lobby` is a single current-state row with no memory of past rounds, and `round_high_score`'s holder (`active_veto_user`) already gets silently cleared the moment a veto is spent (a gap `TRACKER.md` had already flagged and accepted for the base build, now worth actually fixing since a stats page depends on it).
- New column `game_lobby.round_high_score_holder text default null` — set alongside `round_high_score` in `submitScoreIfHighest`, never cleared by `useVeto` (unlike `active_veto_user`). This is the attribution fix; it also becomes the source of truth `resetRound` reads from before logging a round below.
- New table `round_history` — one row per completed round, written by `resetRound` right before it clears `game_lobby` for the next round:
  ```sql
  create table round_history (
    id bigint generated by default as identity primary key,
    round_number integer not null,
    high_score integer not null,
    high_score_holder text,
    chosen_movie_id bigint references movie_repo(id),
    ended_at timestamp with time zone default now()
  );
  ```
  `chosen_movie_id` is carried over from `game_lobby` at the same moment — cheap, already there, and turns "which movie won the most spins" into a real query instead of something nobody can ever answer.
- New in-page view, not a new route — the existing single-page/no-routing architecture decision (see Architecture) holds; a real route would add routing infrastructure this app has deliberately never needed, just for one view.
- **Prominence, decided (no longer an open flag)**: a plain nav item in the header, next to the name input — same visual weight as any other header control, not a hidden/buried toggle. Punting this decision until the page existed was itself flagged as a mistake during review (shipping a feature's existence without deciding its own visibility); the fix costs nothing, so it's decided now instead of deferred again.
- Stats shown, all computed client-side from data already fetched by that point — no new "analytics" backend: most-watched genre (reduce over `movie_repo` where `watched`), total watched count, current Arena champion (`game_lobby.round_high_score_holder`), and — since `round_history` now exists — most rounds won by name and highest score ever recorded. Open door for more later (explicitly requested): anything else answerable by a simple query over `round_history`/`movie_repo` is fair game to add without another design pass, since the data's already there once this table exists. No pagination/retention design added preemptively — this table grows one row per movie night, which would take years to become a real performance question.
- **Access**: no change — the app is already fully open-access with no auth boundary (see Hosting & access), so "public stats page" doesn't introduce a new exposure, it's just another view of data anyone with the link could already see.

### Entrance moment (part of Module 5b, since it reuses the curtain component)

- A one-time "curtains open on the app" beat, reusing the same curtain component built for the spin wheel's reveal — plays once ever per browser (`localStorage` flag, not `sessionStorage`). This was originally speced with `sessionStorage`, which was wrong: a fresh browser session happens every time someone opens the site for movie night, which is exactly the audience this was supposed to feel rare for — `sessionStorage` would have replayed it constantly for the real users and only once for a long-lived interview-demo tab, the opposite of the intent. `localStorage` actually matches "first impression."

Module 5 is now specified; nothing left open on this front before implementation.

## Repo enhancements (Module 6)

A batch of small, cheap additions to the Repo feature — eight from a dedicated "small features" brainstorm, plus one (remove a Repo entry) carried over from the earlier design-review critique since it shares the undo-toast mechanism with one of the eight. Bundled into one module deliberately (unlike Module 5's original bundling mistake) because these genuinely are one coherent thing — small enhancements to a single already-shipped feature, not unrelated capabilities. None of the nine need a schema change: they're new client-side logic, copy changes, or (for removal) a new delete operation against the existing `movie_repo` table, not a new column or table.

- **Remove a Repo entry**: `repoApi.js` currently only has `addMovie`/`setWatched` — a mis-added movie (wrong TMDB match, duplicate title, joke entry) has no way back except direct database editing. New `removeMovie(id)` — a real delete, not a hidden flag, since a mistaken add isn't "shared history" the way a watched movie is. Small trash-icon affordance on `MovieCard`, no confirmation modal (matches the app's existing no-modal style), paired with a brief "Removed — Undo" toast (see the undo pattern below) as the actual safety net instead of a blocking confirm dialog.
- **Show who added each movie**: `added_by` is captured on every insert and has never been rendered anywhere. Add a quiet secondary-text credit line to `MovieCard` ("Added by Priya"). No schema change — this is the same "captured but unrendered" pattern Module 4's poster/description work already covers, just for a different column.
- **Sort/group by contributor**: a sort control next to Repo's search box (same visual treatment as Decision Engine's genre dropdown), with a "group by who added it" option alongside the existing add-date order. This is also what makes a future "top contributor" stat (considered and shelved during the Module 5c stats brainstorm) effectively free to add later — the counting logic would already exist.
- **Name the duplicate warning**: the existing "Already in the repo" message becomes "Already added by Priya" — the name is already available on the movie being matched against, this is a one-line copy change, not new logic.
- **Genre filter on the Repo panel**: Decision Engine already derives its genre list and filter dropdown from `movie_repo.genres`; Repo has no equivalent despite holding the same data. Reuse that existing derivation logic in `RepoPanel.jsx` rather than writing it twice.
- **"New" tag on recent adds**: `created_at` is stored and used only for sort order today. A small "New" label on anything added within roughly the last day or two (computed client-side from the existing timestamp, no new column, no read-tracking/notification system).
- **"Last watched" line**: `watched_at` is stored and never shown. One line at the top of the Repo panel — "Last watched: Fight Club, July 2" — computed from data already being fetched. A cheap taste of shared history ahead of Module 5c's full stats page, not a replacement for it.
- **Copy-link button**: a small copy-icon next to each card's Watch link, copying `watch_page_url` to the clipboard. The group already discusses movie night in its own chat outside this app — this lets a suggestion leave the app easily instead of requiring everyone to be in-app to see it.
- **Undo toast on the watched toggle**: the watched checkbox is instant, shared, and has no confirmation — a mis-tap has no way back today. A brief "Marked watched — Undo" toast for a few seconds after toggling, reusing the same toast mechanism the remove action above uses. This is also the concrete answer to a design-review concern about the open-access trust model having no correction path for personal mistakes — the fix is a small UI affordance, not an access-control change.

Module 6 is now specified; nothing left open on this front before implementation.

## Real accounts & access control (Module 7)

Triggered by the user reviewing the live deployment and flagging three things at once: nobody was ever actually required to type a real name before acting, the layout broke at some zoom levels (tracked separately, not part of this module), and — the one that changed scope here — anyone with the link could act as anyone, with no way to keep outsiders out. Investigating that third point surfaced a real bug underneath the design question: `movie_repo` had never had a `delete` RLS policy at all, so Module 6's Remove feature has been silently non-functional in production since it shipped. Fixing that properly meant deciding the actual access model first, not just adding a policy — worked through decision-by-decision (grilled one branch at a time, each with its concrete UI/security/functioning implications spelled out before being locked in) since it touches identity, security, and every existing panel simultaneously. This supersedes the "no login" decisions in Architecture and Hosting & access above.

- **Sign-up is closed, not open**: nobody gets an account unless the owner invites them. The first draft of this module allowed open sign-up (any email could request access) — revisited once its actual implication ("a stranger who finds the link can get in, just by owning an email address") was made concrete rather than left abstract. Closed sign-up is the one requirement that was non-negotiable once understood.
- **Login method**: Supabase Auth's magic link (`signInWithOtp`), no passwords anywhere. Chosen for the lowest friction for a small, infrequent-login friend group — no password-reset flow to build or for anyone to forget. Known wrinkle, accepted as-is: clicking the emailed link on a different device than the one trying to log in logs that *other* device in instead, which can confuse someone the first time.
- **Enforcement is real, not cosmetic**: the naive version of "invite-only" — a plain table of allowed emails that the login screen checks before calling Supabase — was rejected specifically because Supabase Auth has its own address on the internet, independent of this app's UI. A determined user could call it directly and bypass an app-level-only check entirely. Instead, inviting someone actually creates their Supabase account ahead of time (via `supabase.auth.admin.inviteUserByEmail`, called from a new server-only endpoint using the service-role key, never the browser), and the login screen's `signInWithOtp` call passes `shouldCreateUser: false` — Supabase itself refuses to send a link for an email with no existing account. The lock lives inside Supabase's own gears, not bolted on beside them.
- **Inviting sends the link immediately**: `inviteUserByEmail` creates the account and emails the first login link in one step — the invited person doesn't need to be separately told to go find the app; they get pulled in with one click, same as an invite email in Slack/Notion.
- **Manage Invites screen, owner-only**: a new in-app view listing everyone invited (status: invited-but-never-logged-in vs. active vs. revoked), with an email field + Add button and a Revoke button per active person. Visible only when the logged-in account's `profiles.is_owner` is true — nobody else ever sees this screen exists.
- **`profiles` rows are created at invite time, not at first login (caught in spec self-review)**: the earlier draft assumed the client creates its own `profiles` row after logging in — but the Manage Invites list needs to show "invited, never logged in yet" as a real status, and there's no row to query for that if one only appears once someone actually logs in and sets a name. Fixed by having `api/admin-invite.js` create the `profiles` row itself (server-side, service role) at the same moment it calls `inviteUserByEmail`, with `display_name` left `null` until that person completes the one-time naming prompt. This also means clients never need permission to insert their own row at all — the only client-facing write to `profiles` is updating `display_name` on a row that already exists.
- **Revoke blocks future access, not past contributions**: revoking calls `supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' })` — Supabase's ban API has no literal "permanent" value, so a duration of roughly 100 years is the idiomatic stand-in for "indefinitely," a real ban inside Supabase's own auth system, immediately blocking new sign-ins and, within that session's short-lived access-token window (Supabase's default is on the order of an hour), blocking continued use of an already-open session too. Not instantaneous same-second logout — accepted as a known, named gap rather than an overstated guarantee. Whatever the revoked person already added to `movie_repo` or logged in `round_history` is untouched — their name stays on those rows exactly as it was, the same way a removed friend's old messages don't vanish from a group chat. Built from the start, not deferred — the user explicitly asked for this at design time rather than later. Un-revoking (setting `ban_duration: 'none'`) is not being built in this module — nobody's asked for it yet, and the same endpoint could support it later without any design change if that need shows up.
- **Bootstrap (chicken-and-egg)**: the Manage Invites screen only appears to a logged-in owner, but nothing can log anyone in until an account exists — including the owner's own. Solved with a one-off script (run once against the live Supabase project, not shipped as part of the app) that invites `thevikramxsingh@gmail.com` directly via the same admin API, then sets that row's `profiles.is_owner = true`. Every invite after that one goes through the in-app screen like anyone else's.
- **`is_owner` as data, not code**: a boolean column on `profiles`, not an email hardcoded into the app — checking a flag scales to ever needing a second owner without editing source; checking a literal email string would not.
- **Self-promotion, closed off (caught in spec self-review)**: the obvious RLS policy — "a user can update their own profile row" — only restricts *which row* someone can update, not *which columns*. Left as just that, any logged-in member could call a normal update on their own row and set `is_owner: true` on themselves. Closed with a `before update` trigger on `profiles` that rejects any client-initiated change to `is_owner` or `revoked` (the mirrored ban-status flag described below), regardless of what RLS would otherwise allow — the one exception is a request made with the service-role key, which is how `api/admin-invite.js`/`api/admin-revoke.js` themselves legitimately set these columns. A first version of this trigger blocked all updates to those columns unconditionally, which would have also blocked the app's own admin endpoints — fixed by checking `auth.role() = 'service_role'` and only enforcing the restriction for everyone else.
- **`revoked` mirrors the real ban, purely for display**: the actual access control is the Supabase-level ban `api/admin-revoke.js` sets (see below) — a client can't read that directly, so a `profiles.revoked boolean` column gets set alongside it, in the same request, purely so the Manage Invites screen has something to query for its status list. This flag enforces nothing on its own; even if it were somehow wrong, the real ban is what actually blocks access, not this column.
- **Display name, unique and DB-enforced**: prompted once, at first login only (a `profiles` row with no `display_name` yet triggers the prompt; saving it is a one-way action, not editable later in this module's scope). Uniqueness is enforced with a case-insensitive unique index on `profiles.display_name`, not just a client-side check before saving — matches this app's own existing pattern for `movie_repo.tmdb_id` (client check as a nicety, DB constraint as the real backstop). Attempting a taken name shows "That name's already in use — try another" and re-prompts.
- **Read access requires login too**: browsing the Repo, watching a spin, viewing stats — all of it — requires an active session, not just the actions that write data. Chosen for one consistent rule instead of two different ones to maintain.
- **No per-user ownership walls on actions**: any authenticated (i.e., currently-invited-and-not-revoked) member can add, remove, toggle watched, spin, veto, or play — matching how the app already behaved before accounts existed. Real accounts answer "who can get in," not "who's allowed to touch what once they're in."
- **RLS rewrite**: every `select`/`insert`/`update` policy on `movie_repo`, `game_lobby`, and `round_history` changes from `using (true)` to `using (auth.role() = 'authenticated')`. A new `delete` policy (same condition) is added to `movie_repo` — this is the fix for the Remove button that's been silently broken since Module 6.
- **The two TMDB proxies get the same treatment**: `api/tmdb-search.js` and `api/tmdb-videos.js` currently accept requests from anyone, logged in or not — an open "side door" that spends this app's TMDB quota and Vercel function time regardless of whether the caller ever goes through the login screen. Both now require the caller to include a valid Supabase session token, verified server-side (`supabase.auth.getUser(token)`) before proxying to TMDB; no token, no valid session → `401`.
- **`api/keep-alive.js` switches keys**: the cron ping currently uses the public anon key, which will start failing the moment `game_lobby`'s select policy requires an authenticated session — an internal health check has no user session to present. Fixed by switching it to a new server-only `SUPABASE_SERVICE_ROLE_KEY` env var (bypasses RLS by design; appropriate here since this endpoint isn't a user action, and the key never reaches the browser).
- **Attribution fields stay plain text**: `added_by`, `active_veto_user`, `round_high_score_holder` etc. are not becoming foreign keys to `profiles` — they stay exactly the text-snapshot columns they already are, just populated from `profile.display_name` at write time instead of a typed string. Consistent with this app's existing convention (`round_history` was already explicitly built as "one row per movie night," not for referential integrity) and avoids a much larger relational rework nobody asked for. Trade-off, carried forward rather than newly introduced: a later display-name change won't retroactively relabel old cards.
- **Rollout is reactive, by choice**: no attempt to pre-seed the allowlist with everyone already using the app today. Friends who are mid-use when this ships will hit an "invite only" wall the next time they try to log in, until the owner notices and adds them via Manage Invites. Considered and explicitly accepted, not an oversight — the alternative (collecting everyone's email up front before shipping) was offered and declined.
- **The old typed-name `localStorage` key is simply abandoned**: no migration needed — accounts replace it outright, and there's no meaningful data in it worth carrying forward (it was never anything but a display string).

**New tables/columns** (full DDL goes in `schema.sql` alongside the existing tables, same as every prior module):

**Amended while actually building this** (caught assembling the Manage Invites screen, not during design): `profiles` also needs an `email` column. `auth.users.email` isn't reachable from client code at all, even under RLS, so without a copy here the invite list would have nothing to show per person except a bare UUID. Written once, by `api/admin-invite.js` at invite time (it already has the email in hand); never updated afterward, so it can't drift from what the account was actually invited under. Not the source of truth for anything auth-related — Supabase's own `auth.users` row is and remains that.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_owner boolean not null default false,
  revoked boolean not null default false,
  created_at timestamp with time zone default now()
);
create unique index profiles_display_name_unique_ci on profiles (lower(display_name));

alter table profiles enable row level security;
create policy "authenticated can read all profiles" on profiles
  for select using (auth.role() = 'authenticated');
create policy "a user can set their own profile" on profiles
  for update using (auth.uid() = id);
-- No insert policy: rows are only ever created server-side, by
-- api/admin-invite.js (at invite time) and the one-off bootstrap script
-- (for the owner) — both run with the service role, which bypasses RLS
-- entirely, so a client-facing insert policy isn't needed and isn't added.

-- Closes the self-promotion gap above: the update policy alone can't stop
-- someone from changing their own is_owner/revoked columns, since RLS only
-- sees "is this my row?", not "which columns is this request touching?".
-- Blocks any client-initiated change to either column; the service-role
-- check is what lets api/admin-invite.js/api/admin-revoke.js themselves
-- still legitimately set them.
create or replace function reject_admin_column_changes() returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.is_owner is distinct from old.is_owner
     or new.revoked is distinct from old.revoked then
    raise exception 'is_owner/revoked cannot be changed by a client update';
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger profiles_guard_admin_columns
  before update on profiles
  for each row execute function reject_admin_column_changes();
```

Existing tables' policies get replaced (not added alongside) — `using (true)` → `using (auth.role() = 'authenticated')` on every `select`/`insert`/`update` policy across `movie_repo`, `game_lobby`, `round_history`, plus the new `movie_repo` delete policy described above.

**New server-only endpoints** (service-role key, never exposed to the browser, same pattern as `api/keep-alive.js` already establishes for using elevated access from a serverless function):
- `api/admin-invite.js` — owner-only (verifies the caller's own session + `profiles.is_owner` first), takes an email, calls `inviteUserByEmail`.
- `api/admin-revoke.js` — owner-only, takes a user id, calls `updateUserById` with a ban and, in the same request, sets that user's `profiles.revoked = true` so the Manage Invites list reflects it immediately.

**Testing approach**: same conventions as every other module — pure logic (e.g., the owner-check, invite validation) gets unit tests; UI states (login screen, "check your email," display-name prompt, Manage Invites list, revoke confirmation) get component tests mocking `supabase.auth` calls, the same way `RepoPanel.test.jsx`/`DecisionEngine.test.jsx` already mock `repoApi`/`lobbyApi`. RLS correctness itself isn't unit-tested in this stack — consistent with how Modules 1–6 verified their own policies, this gets checked live against the real Supabase project (`information_schema`/`pg_policies` queries) after migration, not through a new automated layer invented just for this module.

Module 7 is now specified; nothing left open on this front before implementation.

## Build order (checkpointed)

- [x] **Module 0** — scaffold, Tailwind, Supabase client, empty three-panel shell. Checkpoint: app runs, panels render, no console errors.
- [ ] **Module 1** — `repo` feature: TMDB search, save to `movie_repo`, list with polling. Checkpoint: add a movie, it persists, shows up on refresh.
- [ ] **Module 2** — `decision-engine` feature: genre filter + canvas spin wheel, writes result to `game_lobby.chosen_movie_id`. Checkpoint: spin picks a movie from the repo, everyone polling sees the same pick.
- [ ] **Module 2 fix** — wheel landing: spin animates to the exact angle of the pre-decided winning slice instead of an open-ended spin + disconnected text reveal. Checkpoint: spin visibly stops with the pointer inside the correct slice, every time, across several spins with different pool sizes.
- [ ] **Module 3** — `arena` feature: 30s reaction mini-game, winner unlocks veto, veto triggers re-spin and gets spent. Checkpoint: full loop — play, win, veto unlocks, re-spin, veto locks again.
- [ ] **Module 4** — UI polish pass: cinematic token system, shared `MovieCard` (poster/description/watch link), header/panel/spin-wheel/Arena restyle, cinema-voice copy pass. Checkpoint: posters/descriptions/watch links visible and correct on real movies, whole app reflects the new palette/type consistently, no behavior regressions (existing manual checkpoints for Modules 1–3 still pass).
- [ ] **Module 5a** — trailer link. Checkpoint: a movie added after this ships has a working trailer link (or none, if TMDB genuinely has none), and it's the theatrical trailer, not a teaser/regional cut.
- [ ] **Module 5b** — curtain-reveal + reveal choreography (ticks, micro-pause, chime, confetti, eyebrow text) + entrance moment (after the Module 2 wheel fix). Checkpoint: winning a spin plays all five reveal beats in order and lands on the correct poster; a fresh browser (cleared storage) shows the entrance curtain once and never again on reload.
- [ ] **Module 5c** — round history + stats page. Checkpoint: finishing a round and clicking New Round produces a new row in `round_history`; the stats page (reachable from a visible header nav item) shows correct numbers matching what's actually in the DB.
- [ ] **Module 6** — Repo enhancements: remove action, added-by + sort, named duplicate warning, Repo genre filter, "New" tag, last-watched line, copy-link button, undo toast. Checkpoint: each of the eight additions works on real data with no regressions to existing Repo tests.
- [ ] **Module 7** — real accounts & access control: Supabase Auth magic-link login, owner-only invite/revoke via `inviteUserByEmail`/`updateUserById`, `profiles` table with unique display names, RLS rewritten to authenticated-only across all three tables plus a new `movie_repo` delete policy, both TMDB proxies and the keep-alive cron updated to match. Checkpoint: an uninvited email cannot log in; an invited email gets a working magic link and can set a unique display name; every panel is unreachable without a session; the owner revoking a member locks that member out of new logins while leaving their past contributions untouched.

## Working agreement

- One module at a time, small scope per step.
- You run and check off each module's checkpoint before the next one starts.
- Review focuses on assumptions/edge cases, not syntax.
- Every non-obvious trade-off gets a code comment explaining *why*, not just *what*.
- RLS policies get extra scrutiny any time they change — it's the one place a wrong assumption silently over-exposes data.
- Testing: unit tests on pure logic + component tests on core behavior, built test-first per module. No automated end-to-end tests — manual checkpoints already cover that. Full reasoning in `TRACKER.md`.
- Live status of every module (designed/tested/built/verified) lives in `TRACKER.md`, not just in conversation — check there, not memory, if unsure what's actually done.

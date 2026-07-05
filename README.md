# WatchRoulette

A gamified movie-picker for movie nights with friends: search and stock a shared repo of candidates, spin a weighted wheel to pick tonight's movie, and play a quick reaction game to win a veto.

See `spec.md` for architecture, data model, and the full build order — that's the source of truth. `TRACKER.md` is the live status dashboard for what's actually built, tested, and verified per module.

## Local setup

1. `npm install`
2. Create a free Supabase project. In the SQL Editor, run `schema.sql`.
3. Get a free TMDB API key (account Settings > API, the v3 key).
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (all three from Supabase Project Settings > API), and `TMDB_API_KEY` (no `VITE_` prefix — this one is read server-side only, by `api/*.js` and the Vite dev middleware that mounts it locally; see `src/shared/tmdbProxyPlugin.js`).
5. The app requires a real account (Module 7) — nobody, including you locally, can sign up on their own. Run the one-off owner bootstrap below once against your Supabase project before `npm run dev` will let anyone actually in.
6. `npm run dev`
7. `npm test` runs the full test suite; `npm run lint` runs oxlint.

## Accounts & access

No open sign-up, no passwords — see `spec.md`'s "Real accounts & access control (Module 7)" for the full design. In short: the owner invites people by email from the in-app Manage Invites screen, they get a magic-link login email immediately, and everything in the app requires being logged in as an invited, non-revoked member.

**Bootstrapping the very first (owner) account** — there's a chicken-and-egg problem: Manage Invites only appears to a logged-in owner, but nothing can log anyone in until an account exists, including the owner's own. This is a one-time, run-it-yourself step, not something built into the app:

1. In the Supabase dashboard: Authentication > Users > Invite user, using the owner's email.
2. In the SQL Editor, find that user's id (`select id from auth.users where email = '...'`) and insert their profile row directly: `insert into profiles (id, email, is_owner) values ('<uid>', '<email>', true);`
3. Log in as usual (magic link) — the display-name prompt still applies once, then the Manage Invites screen is there to invite everyone else the normal way.

## Deploying (Vercel)

The app is a standard Vite + React frontend with five serverless functions under `api/` (TMDB search/videos proxies, the Supabase keep-alive ping, and the owner-only admin-invite/admin-revoke endpoints) — Vercel's zero-config Vite + Node Functions presets handle both without extra build settings.

1. Push this repo to GitHub.
2. In Vercel, "Add New Project" → import the GitHub repo. Vercel auto-detects the Vite framework preset; no build command overrides needed.
3. Before the first deploy, add the same four environment variables from your `.env` to the Vercel project (Settings → Environment Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY`.
4. Deploy. The `api/keep-alive` cron (configured in `vercel.json`, runs every 2 days) pings Supabase automatically so the free-tier database doesn't auto-pause from inactivity — no extra setup needed.
5. Per spec's deploy flow: push feature branches for preview URLs, merge to `main` to go live. Vercel keeps every previous deploy, so a bad merge is a one-click rollback.

The app requires a real, owner-invited account for everything — see "Accounts & access" above. This replaces the earlier open-link/no-login model (deliberate at the time for a small friend group; revisited once it was live and the actual implications of "anyone with the link" were made concrete — see `spec.md`'s Module 7 section).

## Status

All planned modules (Repo, Decision Engine, Arena, the Module 4 cinematic UI pass, trailer links, the curtain-reveal choreography, round history/stats, the Module 6 Repo enhancements, and Module 7's real accounts & access control) are built and tested. See `TRACKER.md` for the module-by-module detail and any outstanding manual checkpoints.

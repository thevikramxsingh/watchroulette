# WatchRoulette

A gamified movie-picker for movie nights with friends: search and stock a shared repo of candidates, spin a weighted wheel to pick tonight's movie, and play a quick reaction game to win a veto.

See `spec.md` for architecture, data model, and the full build order — that's the source of truth. `TRACKER.md` is the live status dashboard for what's actually built, tested, and verified per module.

## Local setup

1. `npm install`
2. Create a free Supabase project. In the SQL Editor, run `schema.sql`.
3. Get a free TMDB API key (account Settings > API, the v3 key).
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase Project Settings > API), and `TMDB_API_KEY` (no `VITE_` prefix — this one is read server-side only, by `api/*.js` and the Vite dev middleware that mounts it locally; see `src/shared/tmdbProxyPlugin.js`).
5. `npm run dev`
6. `npm test` runs the full test suite; `npm run lint` runs oxlint.

## Deploying (Vercel)

The app is a standard Vite + React frontend with three serverless functions under `api/` (TMDB search/videos proxies, plus a Supabase keep-alive ping) — Vercel's zero-config Vite + Node Functions presets handle both without extra build settings.

1. Push this repo to GitHub.
2. In Vercel, "Add New Project" → import the GitHub repo. Vercel auto-detects the Vite framework preset; no build command overrides needed.
3. Before the first deploy, add the same three environment variables from your `.env` to the Vercel project (Settings → Environment Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `TMDB_API_KEY`.
4. Deploy. The `api/keep-alive` cron (configured in `vercel.json`, runs every 2 days) pings Supabase automatically so the free-tier database doesn't auto-pause from inactivity — no extra setup needed.
5. Per spec's deploy flow: push feature branches for preview URLs, merge to `main` to go live. Vercel keeps every previous deploy, so a bad merge is a one-click rollback.

The app has no login/auth — anyone with the deployed link can read and write the shared repo and lobby (a deliberate simplicity trade-off for a small friend group; see spec.md's "Hosting & access").

## Status

All planned modules (Repo, Decision Engine, Arena, the Module 4 cinematic UI pass, trailer links, the curtain-reveal choreography, round history/stats, and the Module 6 Repo enhancements) are built and tested. See `TRACKER.md` for the module-by-module detail and any outstanding manual checkpoints.

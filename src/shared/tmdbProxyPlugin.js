import { config as loadDotenv } from 'dotenv'
import tmdbSearchHandler from '../../api/tmdb-search.js'
import tmdbVideosHandler from '../../api/tmdb-videos.js'

// api/*.js only run as real serverless functions once deployed to Vercel.
// This Vite plugin mounts the exact same handlers as dev middleware on the
// same /api/* paths, so `npm run dev` exercises the identical code path
// production will use — no Vercel CLI, no Vercel account, needed just to
// build and test locally.
export function tmdbProxyPlugin() {
  // Vite only loads .env into import.meta.env for client code; server-side
  // code (this file, api/*.js) reads process.env directly, so it needs its
  // own load step. On Vercel, process.env is populated by Vercel itself —
  // this call is a local-dev-only convenience and a no-op in production.
  loadDotenv()

  return {
    name: 'tmdb-proxy-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/tmdb-search', (req, res) => {
        tmdbSearchHandler(req, res)
      })
      // Added for Module 5a (trailer link) — same mount pattern as
      // tmdb-search above, one middleware per api/*.js file.
      server.middlewares.use('/api/tmdb-videos', (req, res) => {
        tmdbVideosHandler(req, res)
      })
    },
  }
}

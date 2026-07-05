// Serverless proxy for TMDB movie search. Keeps TMDB_API_KEY server-side —
// never shipped to the browser bundle. Deliberately does NOT use the VITE_
// prefix (see src/shared/supabaseClient.js's comment on why that prefix is
// the real client/server boundary in this project).
//
// Runs two ways with the exact same code, unmodified: as a real Vercel
// serverless function once deployed, and mounted as Vite dev middleware
// locally (see src/shared/tmdbProxyPlugin.js) — no Vercel CLI or account
// needed just to develop Module 1.
const TMDB_BASE = 'https://api.themoviedb.org/3'

// TMDB's movie genre list is fixed and rarely changes — hardcoding it here
// avoids a second network round trip (GET /genre/movie/list) on every
// keystroke of a live search.
// https://developer.themoviedb.org/reference/genre-movie-list
const GENRE_NAMES = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  // Parsed straight off req.url rather than req.query — req.query only
  // exists on Vercel's Node runtime, not on the plain http.IncomingMessage
  // Vite's dev middleware hands us. Reading the querystring this way works
  // identically in both places.
  const { query } = Object.fromEntries(
    new URL(req.url, 'http://localhost').searchParams
  )

  if (!query || !query.trim()) {
    sendJson(res, 400, { error: 'Missing query' })
    return
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    sendJson(res, 500, { error: 'TMDB_API_KEY not configured' })
    return
  }

  try {
    const url = `${TMDB_BASE}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`
    const tmdbRes = await fetch(url)

    if (!tmdbRes.ok) {
      sendJson(res, 502, { error: 'TMDB request failed' })
      return
    }

    const data = await tmdbRes.json()

    // Reshaped to exactly what the Repo feature needs — the frontend never
    // sees TMDB's raw response shape and never touches the API key.
    // Capped at 8 to match the spec ("shows up to 8 candidate results").
    //
    // watchPageUrl is a plain constructed link, not a second API call to
    // TMDB's watch/providers endpoint: that endpoint can't return deep
    // links into Netflix/Prime/etc (see spec's "Known limitation"), so all
    // it would buy us here is a list of provider names — not part of the
    // Module 1 spec — for the cost of a second network round trip per
    // candidate. Skipped api/tmdb-watch-providers.js for that reason; can
    // add it later if we decide provider names are worth showing.
    const results = (data.results || []).slice(0, 8).map((movie) => ({
      tmdbId: movie.id,
      title: movie.title,
      posterPath: movie.poster_path,
      summary: movie.overview,
      genres: (movie.genre_ids || []).map((id) => GENRE_NAMES[id]).filter(Boolean),
      watchPageUrl: `https://www.themoviedb.org/movie/${movie.id}/watch`,
    }))

    sendJson(res, 200, { results })
  } catch {
    sendJson(res, 502, { error: 'TMDB request failed' })
  }
}

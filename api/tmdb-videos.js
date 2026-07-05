// Serverless proxy for TMDB's per-movie videos endpoint — same pattern as
// tmdb-search.js (holds no extra secret, TMDB_API_KEY stays server-side,
// runs identically as a Vercel function or as Vite dev middleware via
// tmdbProxyPlugin.js). Called once from repoApi.addMovie, at add-time, not
// on every render or search keystroke — see spec.md's "Module 5a" section.
const TMDB_BASE = 'https://api.themoviedb.org/3'

// Pure — picks the single best trailer out of TMDB's raw video list, if any.
// Extracted from the handler so this decision (the actual judgment call) has
// its own unit tests, same "pure logic gets tested, thin network calls
// don't" boundary as weighting.js.
//
// TMDB's video list mixes trailers, teasers, clips, and behind-the-scenes
// videos across every site that's ever hosted one (YouTube, Vimeo, etc.),
// often including regional dubs and re-releases. Filtering to
// YouTube+Trailer isn't enough on its own — among real trailers, `official`
// (TMDB-curated flag) plus "earliest published" reliably picks the original
// theatrical trailer over a later re-cut or a regional alternate, which a
// raw "first result" would not.
export function selectTrailer(videos) {
  const trailers = (videos || []).filter(
    (video) => video.site === 'YouTube' && video.type === 'Trailer'
  )
  if (trailers.length === 0) return null

  const official = trailers.filter((video) => video.official === true)
  const pool = official.length > 0 ? official : trailers

  const [earliest] = [...pool].sort(
    (a, b) => new Date(a.published_at) - new Date(b.published_at)
  )
  return earliest.key
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  // Same req.url-based parsing as tmdb-search.js, for the same reason:
  // req.query only exists on Vercel's Node runtime, not on Vite's dev
  // middleware's plain http.IncomingMessage.
  const { id } = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)

  if (!id) {
    sendJson(res, 400, { error: 'Missing id' })
    return
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    sendJson(res, 500, { error: 'TMDB_API_KEY not configured' })
    return
  }

  try {
    const url = `${TMDB_BASE}/movie/${encodeURIComponent(id)}/videos?api_key=${apiKey}`
    const tmdbRes = await fetch(url)

    if (!tmdbRes.ok) {
      sendJson(res, 502, { error: 'TMDB request failed' })
      return
    }

    const data = await tmdbRes.json()
    sendJson(res, 200, { trailerKey: selectTrailer(data.results) })
  } catch {
    sendJson(res, 502, { error: 'TMDB request failed' })
  }
}

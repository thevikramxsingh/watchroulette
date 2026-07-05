import { createClient } from '@supabase/supabase-js'

// Vercel Cron Job (see vercel.json's `crons`) — pings the database every
// couple of days so Supabase's free tier doesn't auto-pause it after ~7
// days of no activity (spec.md's "Hosting & access"). A trivial read is
// enough; nothing here needs to write anything or care what comes back,
// only that the request reaches Supabase at all.
//
// Same low-level res.writeHead/res.end style as tmdb-search.js/
// tmdb-videos.js, not Vercel's higher-level res.status().json() helpers —
// this project has never exercised those in this sandbox against real
// Vercel infra, so staying with the one pattern that's actually been
// tested (as Vite dev middleware) avoids a untested assumption. This
// endpoint has no dev-middleware use itself (nothing local ever needs to
// hit it — it only exists for the cron), but matching the sibling files'
// shape keeps the whole api/ folder consistent.
//
// Module 7: switched from the anon key to the service-role key. Once
// game_lobby's select policy requires auth.role() = 'authenticated', a
// plain anon-key request (which this cron has no way to attach a real user
// session to) would start failing RLS — the service-role key bypasses RLS
// entirely, which is the correct fit here since this is an internal health
// check, not a user action, and the key never reaches the browser.
function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(res, 500, { error: 'Supabase env vars not configured' })
    return
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { error } = await supabase.from('game_lobby').select('id').limit(1)

    if (error) {
      sendJson(res, 502, { error: error.message })
      return
    }

    sendJson(res, 200, { ok: true, pingedAt: new Date().toISOString() })
  } catch {
    sendJson(res, 502, { error: 'Keep-alive ping failed' })
  }
}

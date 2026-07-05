import { createClient } from '@supabase/supabase-js'

// Shared by every Module 7 server endpoint that needs to check "is this
// caller actually logged in / actually the owner" — one implementation
// instead of copies in admin-invite.js, admin-revoke.js, and the two TMDB
// proxies. Lives under api/_shared/ specifically because Vercel excludes
// underscore-prefixed files/directories under api/ from becoming routes of
// their own (confirmed via Vercel's docs) — this file must never be
// reachable as its own endpoint.

// Pure — extracts the raw token out of an `Authorization: Bearer <token>`
// header, or null if it's missing/malformed. Unit tested directly.
export function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') return null
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim())
  return match ? match[1].trim() || null : null
}

// Pure — decides whether a profiles row (or its absence) counts as an
// authorized owner. A revoked owner (shouldn't normally happen, but not
// impossible if ownership is ever transferred) is deliberately not
// authorized — revoked always wins over is_owner.
export function isAuthorizedOwner(profile) {
  return Boolean(profile) && profile.is_owner === true && profile.revoked !== true
}

// Pure — good-enough email shape check for the invite form. Not trying to
// be a full RFC 5322 validator (same "client check is a nicety" philosophy
// as isDuplicate/selectTrailer elsewhere in this codebase) — Supabase's own
// inviteUserByEmail call is the real backstop against a genuinely invalid
// address.
export function looksLikeEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// Pure — decides what admin-invite.js should do when a profiles row already
// exists for the invited email's auth user id. inviteUserByEmail is
// idempotent: calling it again for an unconfirmed user resends their invite
// link instead of erroring, so "Add" on an already-pending email is really a
// resend request, not a fresh invite. Extracted and unit tested separately
// (same "pure judgment call gets tested, thin network wrapper doesn't"
// boundary as isAuthorizedOwner/inviteStatus elsewhere in this codebase) —
// this is the piece that was missing and caused a raw unique-constraint
// error to reach the Manage Invites UI on a second "Add" click.
export function resolveExistingInvite(existingProfile) {
  if (!existingProfile) return 'invite'
  if (existingProfile.revoked) return 'blocked-revoked'
  if (existingProfile.display_name) return 'blocked-active'
  return 'resend'
}

// A service-role client — bypasses RLS entirely, so it must only ever be
// constructed inside a server-only file (api/*.js), never anything that
// ships to the browser. Reads the URL from the same VITE_-prefixed var the
// browser client uses (that prefix only controls *client bundle* exposure —
// Vercel injects every project env var into process.env for serverless
// functions regardless of prefix, same reasoning already documented in
// api/keep-alive.js) but the key itself is the new, server-only
// SUPABASE_SERVICE_ROLE_KEY, deliberately with no VITE_ prefix so it's
// never eligible to reach the browser bundle even by mistake.
export function createAdminClient() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(url, serviceRoleKey)
}

// Verifies a caller's session token and confirms they're the owner, in one
// step — used identically by admin-invite.js and admin-revoke.js. Returns
// the caller's user id on success, or null on any failure (missing token,
// invalid token, no profile row, not an owner, revoked). Not a pure
// function (it's a network call), so this part isn't unit tested directly —
// same "thin network wrapper" boundary as the TMDB proxy handlers; the
// judgment calls it depends on (extractBearerToken, isAuthorizedOwner) are
// what's actually tested.
export async function requireOwner(req, adminClient) {
  const token = extractBearerToken(req.headers.authorization)
  if (!token) return null

  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData?.user) return null

  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_owner, revoked')
    .eq('id', userData.user.id)
    .single()

  return isAuthorizedOwner(profile) ? userData.user.id : null
}

// Lighter-weight than requireOwner — used by the TMDB proxies, which need
// "is anyone actually logged in" (Module 7's "login required for
// everything" rule), not "is this specifically the owner." Returns the
// caller's user id on success, null on any failure (missing/invalid token).
// No profiles lookup at all — a valid Supabase session is sufficient; a
// revoked user's session stops being valid on its own once their ban takes
// effect (see admin-revoke.js), so there's nothing extra to check here.
export async function requireSession(req, adminClient) {
  const token = extractBearerToken(req.headers.authorization)
  if (!token) return null

  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData?.user) return null

  return userData.user.id
}

// Reads and JSON-parses a request body from a raw Node request stream —
// needed because these two endpoints are POSTs with a JSON body, and (like
// every other api/*.js file here) they also run as Vite dev middleware via
// tmdbProxyPlugin.js, which hands over a plain http.IncomingMessage with no
// body-parsing done for us, unlike Vercel's own Node runtime defaults.
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

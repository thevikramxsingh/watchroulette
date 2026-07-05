// Owner-only endpoint (Module 7) — the server-side half of Manage Invites'
// "Revoke" button. Blocks future access via a real Supabase-level ban (not
// an app-level flag alone), and mirrors that onto profiles.revoked purely
// so the Manage Invites list has something to read — see spec.md's "Real
// accounts & access control (Module 7)" section for the full reasoning.
// Deliberately does not delete or alter anything in movie_repo/
// round_history: past contributions stay exactly as they are.
import { createAdminClient, readJsonBody, requireOwner } from './_shared/adminAuth.js'

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

// Supabase's ban API has no literal "permanent" value — this is the
// idiomatic stand-in (roughly 100 years). Un-revoking (ban_duration: 'none')
// is intentionally not built here — nobody's asked for it yet, and this
// same endpoint could support it later without a design change.
const PERMANENT_BAN_DURATION = '876000h'

export default async function handler(req, res) {
  const admin = createAdminClient()

  const ownerId = await requireOwner(req, admin)
  if (!ownerId) {
    sendJson(res, 403, { error: 'Owner only' })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(res, 400, { error: 'Invalid request body' })
    return
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!userId) {
    sendJson(res, 400, { error: 'A userId is required' })
    return
  }

  // An owner revoking their own only account would lock everyone out of
  // Manage Invites with no way back in (short of another live migration) —
  // blocked as a basic footgun guard, not because self-revocation is a
  // meaningful concept otherwise.
  if (userId === ownerId) {
    sendJson(res, 400, { error: "You can't revoke your own access" })
    return
  }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: PERMANENT_BAN_DURATION,
  })
  if (banError) {
    sendJson(res, 502, { error: banError.message })
    return
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ revoked: true })
    .eq('id', userId)

  if (profileError) {
    sendJson(res, 502, { error: profileError.message })
    return
  }

  sendJson(res, 200, { revoked: true, userId })
}

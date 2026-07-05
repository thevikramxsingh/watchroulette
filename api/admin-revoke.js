// Owner-only endpoint (Module 7) — the server-side half of Manage Invites'
// "Revoke" button. Blocks future access via a real Supabase-level ban (not
// an app-level flag alone), and mirrors that onto profiles.revoked purely
// so the Manage Invites list has something to read — see spec.md's "Real
// accounts & access control (Module 7)" section for the full reasoning.
// Deliberately does not delete or alter anything in movie_repo/
// round_history: past contributions stay exactly as they are.
import {
  createAdminClient,
  readJsonBody,
  requireOwner,
  wouldRemoveLastOwner,
} from './_shared/adminAuth.js'

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

// Supabase's ban API has no literal "permanent" value — this is the
// idiomatic stand-in (roughly 100 years). The un-ban side of this
// (ban_duration: 'none') lives in admin-invite.js's restore path — revoke
// is "paused," not deleted, so coming back through the same Add flow is how
// access is restored, not a separate un-revoke endpoint here.
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

  const { data: targetProfile, error: targetError } = await admin
    .from('profiles')
    .select('is_owner, revoked')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) {
    sendJson(res, 502, { error: 'Could not check that account. Try again.' })
    return
  }

  // Already revoked: a no-op, not an error — makes double-clicking Revoke
  // (or revoking someone twice for any other reason) harmless instead of
  // silently re-applying the same ban.
  if (targetProfile?.revoked) {
    sendJson(res, 200, { revoked: true, userId, alreadyRevoked: true })
    return
  }

  // Blocks revoking (including revoking yourself, which is why the old
  // blanket "userId === ownerId" check is gone) whenever the target is an
  // active owner and doing so would leave zero active owners — that would
  // permanently lock everyone out of Manage Invites with no way back in
  // short of a live migration. Deliberately not "owners can never leave";
  // just "don't drop to zero."
  if (targetProfile?.is_owner) {
    const { count, error: countError } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_owner', true)
      .eq('revoked', false)

    if (countError) {
      sendJson(res, 502, { error: 'Could not verify owner count. Try again.' })
      return
    }

    if (wouldRemoveLastOwner(targetProfile, count)) {
      sendJson(res, 409, {
        error: "Can't revoke the last remaining owner — add another owner first.",
      })
      return
    }
  }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: PERMANENT_BAN_DURATION,
  })
  if (banError) {
    sendJson(res, 502, { error: 'Could not revoke access. Try again.' })
    return
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ revoked: true })
    .eq('id', userId)

  if (profileError) {
    sendJson(res, 502, {
      error: 'Access was revoked, but the list may be out of date — refresh to check.',
    })
    return
  }

  sendJson(res, 200, { revoked: true, userId })
}

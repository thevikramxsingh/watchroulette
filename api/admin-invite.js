// Owner-only endpoint (Module 7) — the server-side half of Manage Invites'
// "Add" button. Real enforcement lives here, not in the UI: this is what
// actually creates the invited person's Supabase account (so the login
// screen's shouldCreateUser:false check has an account to find) and sends
// their first magic link in the same step (inviteUserByEmail does both).
// See spec.md's "Real accounts & access control (Module 7)" for the full
// reasoning, especially why this can't just be a plain allowed-emails table
// checked client-side.
import {
  createAdminClient,
  looksLikeEmail,
  readJsonBody,
  requireOwner,
  resolveExistingInvite,
} from './_shared/adminAuth.js'

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

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

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!looksLikeEmail(email)) {
    sendJson(res, 400, { error: 'A valid email is required' })
    return
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
  if (error || !data?.user) {
    // Supabase returns a real error (e.g. "already registered") rather
    // than a generic failure for most invite problems — passed through
    // as-is so Manage Invites can show something meaningful, not a bare
    // "something went wrong."
    sendJson(res, 502, { error: error?.message || 'Invite failed' })
    return
  }

  // inviteUserByEmail above is idempotent for an unconfirmed user — a
  // second "Add" for the same still-pending email lands here having just
  // resent the invite link, not created anything new. Without this check,
  // the insert below would collide with the profiles row the first attempt
  // already created and throw a raw Postgres unique-violation straight at
  // the owner (the actual bug this fixes). See resolveExistingInvite's own
  // comment for the full reasoning.
  const { data: existingProfile, error: lookupError } = await admin
    .from('profiles')
    .select('revoked, display_name')
    .eq('id', data.user.id)
    .maybeSingle()

  if (lookupError) {
    sendJson(res, 502, { error: 'Could not check invite status. Try again.' })
    return
  }

  const outcome = resolveExistingInvite(existingProfile)

  if (outcome === 'blocked-revoked') {
    sendJson(res, 409, {
      error: 'This person was revoked. Re-inviting them isn’t supported yet.',
    })
    return
  }

  if (outcome === 'blocked-active') {
    sendJson(res, 409, { error: 'This person already has an account.' })
    return
  }

  if (outcome === 'resend') {
    sendJson(res, 200, { invited: true, resent: true, userId: data.user.id })
    return
  }

  // outcome === 'invite' — no profiles row yet, so this is a genuinely new
  // invite. Created here, at invite time, not left for the client to create
  // on first login — see spec.md's self-review note on why: Manage Invites
  // needs "invited, never logged in" to be a real, queryable status, which
  // means the row has to exist before that first login ever happens.
  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, email, display_name: null, is_owner: false, revoked: false })

  if (profileError) {
    // Never leak raw Postgres text (e.g. constraint names) to the client —
    // it reveals schema details and isn't something an owner clicking
    // "Add" can act on.
    sendJson(res, 502, { error: 'Could not save the invite. Try again.' })
    return
  }

  sendJson(res, 200, { invited: true, resent: false, userId: data.user.id })
}

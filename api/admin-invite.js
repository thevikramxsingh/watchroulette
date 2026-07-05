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

  // The profiles row is created here, at invite time, not left for the
  // client to create on first login — see spec.md's self-review note on
  // why: Manage Invites needs "invited, never logged in" to be a real,
  // queryable status, which means the row has to exist before that first
  // login ever happens.
  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, email, display_name: null, is_owner: false, revoked: false })

  if (profileError) {
    sendJson(res, 502, { error: profileError.message })
    return
  }

  sendJson(res, 200, { invited: true, userId: data.user.id })
}

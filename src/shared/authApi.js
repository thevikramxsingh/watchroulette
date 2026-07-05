import { supabase } from './supabaseClient'

// Module 7 — real accounts. Thin wrapper around supabase.auth/profiles, same
// "one API file per concern" convention as repoApi.js/lobbyApi.js. Pure
// judgment calls (isDuplicateNameError, inviteStatus) are extracted and
// exported separately so they get their own unit tests, same "pure logic
// gets tested, thin network calls don't" boundary used throughout this
// codebase (weighting.js, repoApi.isDuplicate, tmdb-videos.selectTrailer).

export function getSession() {
  return supabase.auth.getSession().then(({ data }) => data.session)
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return data.subscription
}

// shouldCreateUser: false is the actual enforcement point for "closed
// sign-up, invite-only" — Supabase itself refuses to send a link (and
// returns an error) for an email with no existing account, rather than
// this app's UI being the only thing standing between a stranger and a new
// account. See spec.md's "Real accounts & access control (Module 7)".
export async function requestMagicLink(email) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
}

export async function signOut() {
  return supabase.auth.signOut()
}

// Pure — Supabase's real error for an uninvited email under
// shouldCreateUser: false is something like "Signups not allowed for otp,"
// accurate but not something a friend trying to log in should have to
// parse. Maps the known case to plain language; anything unrecognized
// falls through to Supabase's own message rather than being swallowed.
export function friendlyLoginError(error) {
  if (!error) return null
  const message = error.message || ''
  if (/not allowed/i.test(message)) {
    return "This app is invite-only — ask the owner to add you first."
  }
  return message
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// Postgres's unique-violation error code — stable across Postgres versions,
// not a Supabase-specific detail. Extracted so the display-name prompt can
// tell "this name's taken" apart from any other failure without repeating
// the raw code inline.
export function isDuplicateNameError(error) {
  return Boolean(error) && error.code === '23505'
}

export async function setDisplayName(userId, displayName) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
  return { error }
}

// Pure — derives what the Manage Invites list should label a given
// profile row as. Order matters: revoked overrides everything else (an
// owner-flagged-and-revoked row, however that happened, should never read
// as "Owner"), then owner, then whether they've actually completed the
// one-time naming step yet.
export function inviteStatus(profile) {
  if (profile.revoked) return 'revoked'
  if (profile.is_owner) return 'owner'
  if (!profile.display_name) return 'invited'
  return 'active'
}

// Two failure modes handled separately here, both previously collapsed into
// one generic message: fetch itself throwing (offline, DNS failure, the
// request never reaching a server at all — a TypeError, not an HTTP
// response) vs. a server response that isn't JSON (a proxy/edge error page,
// a cold-start timeout, anything upstream of this app's own handlers). The
// status code is included in the second case so "Request failed" isn't the
// only signal if this ever needs debugging from a user's bug report.
async function callAdminEndpoint(path, accessToken, body) {
  let res
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the server — check your connection and try again.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data ?? {}
}

export function inviteMember(accessToken, email) {
  return callAdminEndpoint('/api/admin-invite', accessToken, { email })
}

export function revokeMember(accessToken, userId) {
  return callAdminEndpoint('/api/admin-revoke', accessToken, { userId })
}

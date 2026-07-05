import { describe, it, expect } from 'vitest'
import { isDuplicateNameError, inviteStatus, friendlyLoginError } from './authApi'

describe('isDuplicateNameError', () => {
  it('recognizes a Postgres unique-violation error', () => {
    expect(isDuplicateNameError({ code: '23505' })).toBe(true)
  })

  it('rejects any other error code', () => {
    expect(isDuplicateNameError({ code: '23502' })).toBe(false)
  })

  it('rejects a missing error', () => {
    expect(isDuplicateNameError(null)).toBe(false)
    expect(isDuplicateNameError(undefined)).toBe(false)
  })
})

describe('inviteStatus', () => {
  it('labels an owner profile', () => {
    expect(inviteStatus({ is_owner: true, revoked: false, display_name: 'Vikram' })).toBe('owner')
  })

  it('labels a revoked profile, even if it was also the owner', () => {
    expect(inviteStatus({ is_owner: true, revoked: true, display_name: 'Vikram' })).toBe(
      'revoked'
    )
  })

  it('labels an invited-but-not-yet-named profile', () => {
    expect(inviteStatus({ is_owner: false, revoked: false, display_name: null })).toBe('invited')
  })

  it('labels an active member who has set a display name', () => {
    expect(inviteStatus({ is_owner: false, revoked: false, display_name: 'Jenivev' })).toBe(
      'active'
    )
  })
})

describe('friendlyLoginError', () => {
  it('rewrites Supabase\'s "signups not allowed" message into plain language', () => {
    expect(friendlyLoginError({ message: 'Signups not allowed for otp' })).toBe(
      "This app is invite-only — ask the owner to add you first."
    )
  })

  it('passes through an unrecognized error message as-is', () => {
    expect(friendlyLoginError({ message: 'Network request failed' })).toBe(
      'Network request failed'
    )
  })

  it('returns null when there is no error', () => {
    expect(friendlyLoginError(null)).toBeNull()
  })
})

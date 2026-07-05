import { describe, it, expect } from 'vitest'
import {
  extractBearerToken,
  isAuthorizedOwner,
  looksLikeEmail,
  resolveExistingInvite,
} from './adminAuth'

describe('extractBearerToken', () => {
  it('extracts the token from a well-formed header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('is case-insensitive on the "Bearer" keyword', () => {
    expect(extractBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('returns null when the header is missing', () => {
    expect(extractBearerToken(undefined)).toBeNull()
    expect(extractBearerToken(null)).toBeNull()
  })

  it('returns null when the header has no Bearer prefix', () => {
    expect(extractBearerToken('abc.def.ghi')).toBeNull()
  })

  it('returns null when the header is just "Bearer" with nothing after it', () => {
    expect(extractBearerToken('Bearer ')).toBeNull()
    expect(extractBearerToken('Bearer')).toBeNull()
  })
})

describe('isAuthorizedOwner', () => {
  it('authorizes a profile that is an owner and not revoked', () => {
    expect(isAuthorizedOwner({ is_owner: true, revoked: false })).toBe(true)
  })

  it('rejects a non-owner profile', () => {
    expect(isAuthorizedOwner({ is_owner: false, revoked: false })).toBe(false)
  })

  it('rejects a revoked owner — revoked always wins over is_owner', () => {
    expect(isAuthorizedOwner({ is_owner: true, revoked: true })).toBe(false)
  })

  it('rejects a missing profile entirely', () => {
    expect(isAuthorizedOwner(null)).toBe(false)
    expect(isAuthorizedOwner(undefined)).toBe(false)
  })
})

describe('looksLikeEmail', () => {
  it('accepts an ordinary email address', () => {
    expect(looksLikeEmail('vikram@example.com')).toBe(true)
  })

  it('rejects a value with no @', () => {
    expect(looksLikeEmail('not-an-email')).toBe(false)
  })

  it('rejects a value with no domain suffix', () => {
    expect(looksLikeEmail('vikram@localhost')).toBe(false)
  })

  it('rejects empty/non-string input', () => {
    expect(looksLikeEmail('')).toBe(false)
    expect(looksLikeEmail(undefined)).toBe(false)
    expect(looksLikeEmail(42)).toBe(false)
  })
})

describe('resolveExistingInvite', () => {
  it('treats no existing profile as a genuinely new invite', () => {
    expect(resolveExistingInvite(null)).toBe('invite')
    expect(resolveExistingInvite(undefined)).toBe('invite')
  })

  it('treats a pending (never logged in, not revoked) profile as a resend', () => {
    expect(resolveExistingInvite({ revoked: false, display_name: null })).toBe('resend')
  })

  it('blocks re-inviting someone who already has an account', () => {
    expect(resolveExistingInvite({ revoked: false, display_name: 'Jenivev' })).toBe(
      'blocked-active'
    )
  })

  it('blocks re-inviting a revoked profile, even if they never logged in', () => {
    expect(resolveExistingInvite({ revoked: true, display_name: null })).toBe('blocked-revoked')
  })

  it('revoked wins over display_name if both are somehow set', () => {
    expect(resolveExistingInvite({ revoked: true, display_name: 'Jenivev' })).toBe(
      'blocked-revoked'
    )
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ManageInvites from './ManageInvites'
import { fetchAllProfiles, inviteMember, revokeMember } from '../shared/authApi'

vi.mock('../shared/authApi', async () => {
  const actual = await vi.importActual('../shared/authApi')
  return {
    ...actual,
    fetchAllProfiles: vi.fn(),
    inviteMember: vi.fn(),
    revokeMember: vi.fn(),
  }
})

const baseProfiles = [
  { id: 'owner-1', email: 'vikram@example.com', display_name: 'Vikram', is_owner: true, revoked: false },
  { id: 'active-1', email: 'jenivev@example.com', display_name: 'Jenivev', is_owner: false, revoked: false },
  { id: 'invited-1', email: 'new@example.com', display_name: null, is_owner: false, revoked: false },
  { id: 'revoked-1', email: 'gone@example.com', display_name: 'Old Friend', is_owner: false, revoked: true },
]

beforeEach(() => {
  fetchAllProfiles.mockReset().mockResolvedValue(baseProfiles)
  inviteMember.mockReset()
  revokeMember.mockReset()
})

describe('ManageInvites', () => {
  it('lists every profile with its status label', async () => {
    render(<ManageInvites accessToken="token-123" />)

    expect(await screen.findByText('vikram@example.com')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Invited — hasn’t logged in yet')).toBeInTheDocument()
    expect(screen.getByText('Revoked')).toBeInTheDocument()
  })

  it('does not show a Revoke control for the owner', async () => {
    render(<ManageInvites accessToken="token-123" />)
    await screen.findByText('vikram@example.com')

    expect(screen.queryByLabelText('Revoke vikram@example.com')).not.toBeInTheDocument()
  })

  it('does not show a Revoke control for an already-revoked member', async () => {
    render(<ManageInvites accessToken="token-123" />)
    await screen.findByText('gone@example.com')

    expect(screen.queryByLabelText('Revoke gone@example.com')).not.toBeInTheDocument()
  })

  it('invites a new email and refreshes the list', async () => {
    inviteMember.mockResolvedValue({ invited: true, resent: false })
    const user = userEvent.setup()
    render(<ManageInvites accessToken="token-123" />)
    await screen.findByText('vikram@example.com')

    await user.type(screen.getByLabelText('Email to invite'), 'brandnew@example.com')
    await user.click(screen.getByRole('button', { name: /add/i }))

    expect(inviteMember).toHaveBeenCalledWith('token-123', 'brandnew@example.com')
    expect(fetchAllProfiles).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Invite sent to brandnew@example.com')).toBeInTheDocument()
  })

  it('shows a resend message when Add targets an already-pending invite', async () => {
    inviteMember.mockResolvedValue({ invited: true, resent: true })
    const user = userEvent.setup()
    render(<ManageInvites accessToken="token-123" />)
    await screen.findByText('vikram@example.com')

    await user.type(screen.getByLabelText('Email to invite'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /add/i }))

    expect(await screen.findByText('Invite resent to new@example.com')).toBeInTheDocument()
  })

  it('shows a restored message when Add targets a revoked account', async () => {
    inviteMember.mockResolvedValue({ invited: true, restored: true, resent: false })
    const user = userEvent.setup()
    render(<ManageInvites accessToken="token-123" />)
    await screen.findByText('vikram@example.com')

    await user.type(screen.getByLabelText('Email to invite'), 'gone@example.com')
    await user.click(screen.getByRole('button', { name: /add/i }))

    expect(await screen.findByText('Access restored for gone@example.com')).toBeInTheDocument()
  })

  it('notes a fresh login link when restoring someone who never logged in before', async () => {
    inviteMember.mockResolvedValue({ invited: true, restored: true, resent: true })
    const user = userEvent.setup()
    render(<ManageInvites accessToken="token-123" />)
    await screen.findByText('vikram@example.com')

    await user.type(screen.getByLabelText('Email to invite'), 'gone@example.com')
    await user.click(screen.getByRole('button', { name: /add/i }))

    expect(
      await screen.findByText('Access restored for gone@example.com — a fresh login link was sent')
    ).toBeInTheDocument()
  })

  it('revokes an active member and refreshes the list', async () => {
    revokeMember.mockResolvedValue({ revoked: true })
    const user = userEvent.setup()
    render(<ManageInvites accessToken="token-123" />)
    await screen.findByText('jenivev@example.com')

    await user.click(screen.getByLabelText('Revoke jenivev@example.com'))

    expect(revokeMember).toHaveBeenCalledWith('token-123', 'active-1')
    expect(fetchAllProfiles).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Revoked jenivev@example.com')).toBeInTheDocument()
  })

  it('shows a friendly error and re-enables the button when revoke fails', async () => {
    revokeMember.mockRejectedValue(new Error("Can't revoke the last remaining owner — add another owner first."))
    const user = userEvent.setup()
    render(<ManageInvites accessToken="token-123" />)
    await screen.findByText('jenivev@example.com')

    await user.click(screen.getByLabelText('Revoke jenivev@example.com'))

    expect(
      await screen.findByText("Can't revoke the last remaining owner — add another owner first.")
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Revoke jenivev@example.com')).not.toBeDisabled()
  })

  it('shows a Try again button when the list fails to load, which recovers it', async () => {
    fetchAllProfiles.mockReset().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(baseProfiles)
    const user = userEvent.setup()
    render(<ManageInvites accessToken="token-123" />)

    expect(await screen.findByText('Could not load the invite list.')).toBeInTheDocument()
    expect(screen.queryByText('vikram@example.com')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('vikram@example.com')).toBeInTheDocument()
    expect(screen.queryByText('Could not load the invite list.')).not.toBeInTheDocument()
  })
})

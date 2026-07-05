import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginScreen from './LoginScreen'
import { requestMagicLink } from '../shared/authApi'

vi.mock('../shared/authApi', () => ({
  requestMagicLink: vi.fn(),
  friendlyLoginError: (error) => error?.message ?? null,
}))

beforeEach(() => {
  requestMagicLink.mockReset()
})

describe('LoginScreen', () => {
  it('sends a magic link and shows the check-your-email state', async () => {
    requestMagicLink.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginScreen />)

    await user.type(screen.getByLabelText('Email'), 'vikram@example.com')
    await user.click(screen.getByRole('button', { name: /send me a link/i }))

    expect(requestMagicLink).toHaveBeenCalledWith('vikram@example.com')
    expect(screen.getByRole('status')).toHaveTextContent(/check your email/i)
  })

  it('shows a friendly error and stays on the form when the email is not invited', async () => {
    requestMagicLink.mockResolvedValue({ error: { message: 'Signups not allowed for otp' } })
    const user = userEvent.setup()
    render(<LoginScreen />)

    await user.type(screen.getByLabelText('Email'), 'stranger@example.com')
    await user.click(screen.getByRole('button', { name: /send me a link/i }))

    expect(screen.getByText('Signups not allowed for otp')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('recovers from a thrown network failure instead of hanging on Sending…', async () => {
    requestMagicLink.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    render(<LoginScreen />)

    await user.type(screen.getByLabelText('Email'), 'vikram@example.com')
    await user.click(screen.getByRole('button', { name: /send me a link/i }))

    expect(screen.getByText(/could not reach the server/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send me a link/i })).toBeEnabled()
  })
})

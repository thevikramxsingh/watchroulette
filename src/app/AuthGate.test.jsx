import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthGate from './AuthGate'
import { getSession, fetchProfile, signOut } from '../shared/authApi'

// Same isolation pattern App.test.jsx uses for the three feature panels —
// this file only tests AuthGate's own orchestration (which of the five
// states to show), not LoginScreen's or DisplayNamePrompt's own behavior
// (covered by their own test files).
vi.mock('./LoginScreen', () => ({ default: () => <div>Login screen stub</div> }))
vi.mock('./DisplayNamePrompt', () => ({
  default: ({ onSaved }) => (
    <button onClick={() => onSaved('Vikram')}>Display name prompt stub</button>
  ),
}))
// onAuthStateChange's callback is captured (not just stubbed) so tests below
// can simulate Supabase firing a background session event — a token
// refresh or a tab-visibility revalidation, the two real triggers behind
// the "Manage Invites silently kicks me back to the game view" bug this
// file's newest tests guard against.
let authStateCallback = null
vi.mock('../shared/authApi', () => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn((callback) => {
    authStateCallback = callback
    return { unsubscribe: vi.fn() }
  }),
  fetchProfile: vi.fn(),
  signOut: vi.fn(),
}))

beforeEach(() => {
  getSession.mockReset()
  fetchProfile.mockReset()
  signOut.mockReset()
  authStateCallback = null
})

describe('AuthGate', () => {
  it('shows the login screen when there is no session', async () => {
    getSession.mockResolvedValue(null)
    render(<AuthGate>{() => <div>App content</div>}</AuthGate>)

    expect(await screen.findByText('Login screen stub')).toBeInTheDocument()
    expect(screen.queryByText('App content')).not.toBeInTheDocument()
  })

  it('shows the display-name prompt when a session exists but display_name is null', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    fetchProfile.mockResolvedValue({ id: 'user-1', display_name: null, is_owner: false })
    render(<AuthGate>{() => <div>App content</div>}</AuthGate>)

    expect(await screen.findByText('Display name prompt stub')).toBeInTheDocument()
    expect(screen.queryByText('App content')).not.toBeInTheDocument()
  })

  it('renders the children render-prop once session and a named profile both resolve', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    fetchProfile.mockResolvedValue({ id: 'user-1', display_name: 'Vikram', is_owner: false })
    render(<AuthGate>{({ profile }) => <div>Welcome, {profile.display_name}</div>}</AuthGate>)

    expect(await screen.findByText('Welcome, Vikram')).toBeInTheDocument()
  })

  it('shows a recoverable error instead of loading forever when the profile fetch fails', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    fetchProfile.mockRejectedValue(new Error('boom'))
    render(<AuthGate>{() => <div>App content</div>}</AuthGate>)

    expect(await screen.findByText('Couldn’t load your account.')).toBeInTheDocument()
    expect(screen.queryByText('App content')).not.toBeInTheDocument()
  })

  it('retries the profile fetch when Try again is clicked', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    fetchProfile
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ id: 'user-1', display_name: 'Vikram', is_owner: false })
    const user = userEvent.setup()
    render(<AuthGate>{({ profile }) => <div>Welcome, {profile.display_name}</div>}</AuthGate>)

    await screen.findByText('Couldn’t load your account.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Welcome, Vikram')).toBeInTheDocument()
  })

  it('signs out from the error state instead of leaving the user stuck', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    fetchProfile.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<AuthGate>{() => <div>App content</div>}</AuthGate>)

    await screen.findByText('Couldn’t load your account.')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(signOut).toHaveBeenCalled()
  })

  it('does not reload the profile or re-show the loading screen for a background session refresh of the same user', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' }, access_token: 'token-a' })
    fetchProfile.mockResolvedValue({ id: 'user-1', display_name: 'Vikram', is_owner: false })
    render(<AuthGate>{({ profile }) => <div>Welcome, {profile.display_name}</div>}</AuthGate>)

    expect(await screen.findByText('Welcome, Vikram')).toBeInTheDocument()
    expect(fetchProfile).toHaveBeenCalledTimes(1)

    // Simulate Supabase's own background refresh: same user, a new session
    // object (fresh access_token), fired with no user action at all.
    authStateCallback({ user: { id: 'user-1' }, access_token: 'token-b' })

    // If this regressed, AuthGate would briefly render <LoadingScreen/>
    // instead of `children` here — unmounting (and, in the real app,
    // resetting the state of) whatever the child tree was showing.
    expect(screen.getByText('Welcome, Vikram')).toBeInTheDocument()
    expect(fetchProfile).toHaveBeenCalledTimes(1)
  })

  it('still reloads the profile when the session event is a genuinely different user', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    fetchProfile
      .mockResolvedValueOnce({ id: 'user-1', display_name: 'Vikram', is_owner: false })
      .mockResolvedValueOnce({ id: 'user-2', display_name: 'Jenivev', is_owner: false })
    render(<AuthGate>{({ profile }) => <div>Welcome, {profile.display_name}</div>}</AuthGate>)

    expect(await screen.findByText('Welcome, Vikram')).toBeInTheDocument()

    authStateCallback({ user: { id: 'user-2' } })

    expect(await screen.findByText('Welcome, Jenivev')).toBeInTheDocument()
    expect(fetchProfile).toHaveBeenCalledTimes(2)
  })
})

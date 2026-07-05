import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AuthGate from './AuthGate'
import { getSession, fetchProfile } from '../shared/authApi'

// Same isolation pattern App.test.jsx uses for the three feature panels —
// this file only tests AuthGate's own orchestration (which of the four
// states to show), not LoginScreen's or DisplayNamePrompt's own behavior
// (covered by their own test files).
vi.mock('./LoginScreen', () => ({ default: () => <div>Login screen stub</div> }))
vi.mock('./DisplayNamePrompt', () => ({
  default: ({ onSaved }) => (
    <button onClick={() => onSaved('Vikram')}>Display name prompt stub</button>
  ),
}))
vi.mock('../shared/authApi', () => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ unsubscribe: vi.fn() })),
  fetchProfile: vi.fn(),
}))

beforeEach(() => {
  getSession.mockReset()
  fetchProfile.mockReset()
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
})

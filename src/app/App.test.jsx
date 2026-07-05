import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { signOut } from '../shared/authApi'

// Component test on App's own responsibility: given a resolved profile from
// AuthGate, does it show the right header controls and swap between the
// three views. AuthGate's own login/name-prompt states are covered by
// AuthGate.test.jsx — mocked here to a plain pass-through so this file only
// exercises what App itself does with the profile once AuthGate hands it
// over (same "mock the rest, test this unit's own job" convention as every
// other component test in this codebase).
//
// authGateState is mutable (not a fixed object in the mock factory) so the
// "as the owner" tests below can flip is_owner per-test without needing a
// second test file — vi.hoisted is required here since vi.mock's factory
// is itself hoisted above regular imports/const declarations.
const authGateState = vi.hoisted(() => ({
  profile: { display_name: 'Vikram', is_owner: false },
  session: { access_token: 'token-abc' },
}))

vi.mock('./AuthGate', () => ({
  default: ({ children }) => children(authGateState),
}))
vi.mock('../shared/authApi', () => ({ signOut: vi.fn() }))
vi.mock('../features/repo/RepoPanel', () => ({
  default: ({ addedBy }) => <div>Repo panel stub — {addedBy}</div>,
}))
vi.mock('../features/decision-engine/DecisionEngine', () => ({
  default: ({ addedBy }) => <div>Decision engine stub — {addedBy}</div>,
}))
vi.mock('../features/arena/ArenaGame', () => ({
  default: ({ addedBy }) => <div>Arena stub — {addedBy}</div>,
}))
vi.mock('../features/stats/StatsPage', () => ({ default: () => <div>Stats page stub</div> }))
vi.mock('./ManageInvites', () => ({ default: () => <div>Manage invites stub</div> }))

beforeEach(() => {
  window.localStorage.clear()
  // Entrance.jsx's one-time overlay is unrelated to what this file tests
  // (covered by its own Entrance.test.jsx) — pre-marking it as shown keeps
  // its full-screen skip button from intercepting clicks meant for the nav.
  window.localStorage.setItem('watchroulette:entranceShown', 'true')
  signOut.mockReset()
  authGateState.profile = { display_name: 'Vikram', is_owner: false }
})

describe('App', () => {
  it('shows the three game panels by default, sourced from the real profile name', () => {
    render(<App />)

    expect(screen.getByText('Repo panel stub — Vikram')).toBeInTheDocument()
    expect(screen.getByText('Decision engine stub — Vikram')).toBeInTheDocument()
    expect(screen.getByText('Arena stub — Vikram')).toBeInTheDocument()
    expect(screen.queryByText('Stats page stub')).not.toBeInTheDocument()
  })

  it('shows the display name and a working Sign out button in the header', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('Vikram')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(signOut).toHaveBeenCalled()
  })

  it('clicking the Stats nav item swaps to the stats page and back', async () => {
    const user = userEvent.setup()
    render(<App />)

    const statsButton = screen.getByRole('button', { name: /^stats$/i })
    await user.click(statsButton)

    expect(screen.getByText('Stats page stub')).toBeInTheDocument()
    expect(screen.queryByText(/repo panel stub/i)).not.toBeInTheDocument()
    expect(statsButton).toHaveAttribute('aria-pressed', 'true')

    await user.click(statsButton)

    expect(screen.getByText(/repo panel stub/i)).toBeInTheDocument()
    expect(screen.queryByText('Stats page stub')).not.toBeInTheDocument()
  })

  it('does not show a Manage Invites nav item for a non-owner', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: /manage invites/i })).not.toBeInTheDocument()
  })

  // Panel visibility below the lg breakpoint is driven by Tailwind's own
  // hidden/block classes (see App.jsx's comment on why, after a native
  // `hidden`-attribute approach passed every test here but failed in the
  // real deployed build) — this project's test setup doesn't load real CSS
  // into jsdom (no `css: true` in vite.config.js's test block), so
  // `toBeVisible()` can't observe a class-driven show/hide at all. Asserting
  // on `aria-hidden` instead — a real DOM attribute this component sets
  // directly, not something that depends on a stylesheet actually being
  // parsed — is what's actually testable here, and still a legitimate,
  // accessibility-meaningful check, not a class-name assertion.
  it('mobile tab switcher shows only the Repo panel by default', () => {
    render(<App />)

    expect(screen.getByText('Repo panel stub — Vikram').closest('[role="tabpanel"]')).toHaveAttribute(
      'aria-hidden',
      'false'
    )
    expect(
      screen.getByText('Decision engine stub — Vikram').closest('[role="tabpanel"]')
    ).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Arena stub — Vikram').closest('[role="tabpanel"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(screen.getByRole('tab', { name: 'Repo' })).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking a mobile tab switches which panel is marked visible', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Wheel' }))

    expect(
      screen.getByText('Decision engine stub — Vikram').closest('[role="tabpanel"]')
    ).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByText('Repo panel stub — Vikram').closest('[role="tabpanel"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(screen.getByRole('tab', { name: 'Wheel' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Repo' })).toHaveAttribute('aria-selected', 'false')

    await user.click(screen.getByRole('tab', { name: 'Arena' }))

    expect(screen.getByText('Arena stub — Vikram').closest('[role="tabpanel"]')).toHaveAttribute(
      'aria-hidden',
      'false'
    )
    expect(
      screen.getByText('Decision engine stub — Vikram').closest('[role="tabpanel"]')
    ).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('App — as the owner', () => {
  it('shows a Manage Invites nav item that opens the screen', async () => {
    authGateState.profile = { display_name: 'Vikram', is_owner: true }

    const user = userEvent.setup()
    render(<App />)

    const inviteButton = screen.getByRole('button', { name: /manage invites/i })
    await user.click(inviteButton)

    expect(screen.getByText('Manage invites stub')).toBeInTheDocument()
    expect(inviteButton).toHaveAttribute('aria-pressed', 'true')
  })
})

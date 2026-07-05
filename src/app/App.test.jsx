import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

// Component test on App's own responsibility: switching between the three
// game panels and Module 5c's stats page via the header nav item. The
// panels/stats page's own behavior is covered by their own test files, so
// they're stubbed out here — this file only tests App's layout/toggle
// logic, not what's inside each view.
vi.mock('../features/repo/RepoPanel', () => ({ default: () => <div>Repo panel stub</div> }))
vi.mock('../features/decision-engine/DecisionEngine', () => ({
  default: () => <div>Decision engine stub</div>,
}))
vi.mock('../features/arena/ArenaGame', () => ({ default: () => <div>Arena stub</div> }))
vi.mock('../features/stats/StatsPage', () => ({ default: () => <div>Stats page stub</div> }))

beforeEach(() => {
  window.localStorage.clear()
  // Entrance.jsx's one-time overlay is unrelated to what this file tests
  // (covered by its own Entrance.test.jsx) — pre-marking it as shown keeps
  // its full-screen skip button from intercepting clicks meant for the nav.
  window.localStorage.setItem('watchroulette:entranceShown', 'true')
})

describe('App', () => {
  it('shows the three game panels by default, not the stats page', () => {
    render(<App />)

    expect(screen.getByText('Repo panel stub')).toBeInTheDocument()
    expect(screen.getByText('Decision engine stub')).toBeInTheDocument()
    expect(screen.getByText('Arena stub')).toBeInTheDocument()
    expect(screen.queryByText('Stats page stub')).not.toBeInTheDocument()
  })

  it('clicking the Stats nav item swaps to the stats page and back', async () => {
    const user = userEvent.setup()
    render(<App />)

    const statsButton = screen.getByRole('button', { name: /^stats$/i })
    await user.click(statsButton)

    expect(screen.getByText('Stats page stub')).toBeInTheDocument()
    expect(screen.queryByText('Repo panel stub')).not.toBeInTheDocument()
    expect(statsButton).toHaveAttribute('aria-pressed', 'true')

    await user.click(statsButton)

    expect(screen.getByText('Repo panel stub')).toBeInTheDocument()
    expect(screen.queryByText('Stats page stub')).not.toBeInTheDocument()
  })
})

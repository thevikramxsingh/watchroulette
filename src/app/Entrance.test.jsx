import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Entrance from './Entrance'

// Component tests on the one-time entrance moment (spec.md's "Entrance
// moment"). The interesting behavior here is entirely about *when* it
// shows, not the curtain animation itself (Curtain.jsx has no state of its
// own to test — it's driven entirely by the `open` prop, same boundary as
// SpinWheel's earlier CSS-transform-only pieces).
beforeEach(() => {
  window.localStorage.clear()
})

describe('Entrance', () => {
  it('shows a skip control on a first-ever visit, over the real content underneath', () => {
    render(
      <Entrance>
        <button>Real app content</button>
      </Entrance>
    )

    expect(screen.getByRole('button', { name: /real app content/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip intro/i })).toBeInTheDocument()
  })

  it('clicking skip dismisses the intro immediately, without waiting out the full animation', async () => {
    const user = userEvent.setup()
    render(
      <Entrance>
        <button>Real app content</button>
      </Entrance>
    )

    await user.click(screen.getByRole('button', { name: /skip intro/i }))

    expect(screen.queryByRole('button', { name: /skip intro/i })).not.toBeInTheDocument()
  })

  it('never shows the intro again once localStorage already records it as shown', () => {
    window.localStorage.setItem('watchroulette:entranceShown', 'true')

    render(
      <Entrance>
        <button>Real app content</button>
      </Entrance>
    )

    expect(screen.queryByRole('button', { name: /skip intro/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /real app content/i })).toBeInTheDocument()
  })
})

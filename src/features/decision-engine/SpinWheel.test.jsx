import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SpinWheel from './SpinWheel'

// Component tests on Module 5b's reveal choreography — specifically the
// part that's easy to get backwards: an *already*-resolved pick (someone
// loading the page mid-round, or a friend's spin already caught up on a
// previous poll) must show immediately, with none of the pause/curtain/
// chime fanfare that a *just-finished* spin gets. weighting.js's rotation
// math and the synthesized sounds/confetti themselves are covered
// elsewhere (weighting.test.js; sounds are the same "thin, untested
// directly" boundary as playHitSound.js).
const pool = [{ id: 1, title: 'Fight Club', genres: ['Drama'], watched: false, spotlighted: false }]
const fightClub = pool[0]

describe('SpinWheel reveal choreography', () => {
  it('shows nothing yet while spinning, before any result exists', () => {
    render(<SpinWheel pool={pool} spinning={false} targetMovie={null} animationMs={20} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the pick immediately when it arrives already resolved, skipping the pause/curtain fanfare', async () => {
    render(<SpinWheel pool={pool} spinning={false} targetMovie={fightClub} animationMs={20} />)

    // No spinning->false transition was ever observed by this instance —
    // same "arrived already decided" case DecisionEngine hits on a fresh
    // page load mid-round. Should be visible right away, not after a delay.
    expect(await screen.findByRole('status')).toHaveTextContent('Fight Club')
  })

  it('reveals the pick after a real spin ends, following the pause/curtain sequence', async () => {
    const { rerender } = render(
      <SpinWheel pool={pool} spinning={true} targetMovie={fightClub} animationMs={20} />
    )

    // Still mid-spin — nothing revealed yet.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<SpinWheel pool={pool} spinning={false} targetMovie={fightClub} animationMs={20} />)

    // Has to clear the micro-pause + curtain-parting beats (fixed at 400ms
    // + 650ms in the component) before the status text lands — a longer
    // findBy timeout than the default 1000ms accounts for that real delay.
    expect(await screen.findByRole('status', {}, { timeout: 2000 })).toHaveTextContent(
      'Fight Club'
    )
  })
})

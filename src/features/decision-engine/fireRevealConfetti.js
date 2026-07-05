import confetti from 'canvas-confetti'

// Spec's "confetti on wheel landing only" (Polish additions, built for real
// in Module 5b) — gold-only particles, under a second, triggered once per
// reveal, the instant the curtains finish parting. Restraint (one trigger,
// one moment, nowhere else in the app) is what makes it read as a payoff
// rather than decoration.
export function fireRevealConfetti() {
  try {
    confetti({
      particleCount: 60,
      spread: 70,
      startVelocity: 35,
      gravity: 1.1,
      ticks: 90, // ~1.5s of fall at 60fps, reads as "under a second" of actual burst
      colors: ['#D4A24C', '#E0B468'],
      origin: { y: 0.6 },
      disableForReducedMotion: true,
    })
  } catch {
    // canvas-confetti can't do anything meaningful in some environments
    // (e.g. jsdom in tests has no real canvas 2d context) — same defensive
    // posture as the synthesized sounds; a failure here shouldn't break the
    // actual reveal.
  }
}

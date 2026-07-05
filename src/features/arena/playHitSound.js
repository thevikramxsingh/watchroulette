// The "Arena target hit" sound trigger named in spec.md's Polish additions
// — synthesized with the Web Audio API rather than an external audio file.
// Avoided fetching a file from a third-party sound library for this first
// pass (a licensing/trust question worth a deliberate yes, not a default);
// see spec.md's "Arena tweak" section. Deliberately one sound for every
// hit, bonus or not — keeps the app's "three sound triggers only, total"
// restraint intact rather than adding a fourth for bonus hits.
//
// One AudioContext, created lazily on first hit and reused — browsers cap
// how many a page can have, and there's no reason to pay creation cost on
// every single hit.
let audioContext = null

export function playHitSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioContext ??= new Ctx()

    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = 880 // A5 — short and bright, not harsh
    gain.gain.setValueAtTime(0.2, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)

    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.12)
  } catch {
    // Web Audio unavailable/blocked (old browser, some autoplay-policy
    // edge case, jsdom in tests) — sound is a nice-to-have, never worth
    // breaking the game over.
  }
}

// Deceleration-tick sound for the wheel's reveal choreography (spec.md's
// Module 5b, beat 2 — "soft synthesized clicks as the wheel slows"). Sibling
// to Arena's playHitSound.js: same Web Audio synthesis approach (no external
// audio file/library), deliberately a different pitch/timbre so the two are
// never confused if both happen to be audible around the same time (Arena
// and the Decision Engine can both be active in the same lobby).
let audioContext = null

export function playTickSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioContext ??= new Ctx()

    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'square'
    oscillator.frequency.value = 1400 // higher and much shorter than playHitSound's 880Hz sine — a click, not a note
    gain.gain.setValueAtTime(0.08, audioContext.currentTime) // quiet — this repeats several times per spin, a hit sound doesn't
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.03)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)

    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.03)
  } catch {
    // Web Audio unavailable/blocked — same defensive no-op as playHitSound;
    // sound is a nice-to-have, never worth breaking the reveal over.
  }
}

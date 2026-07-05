// Reveal-chime sound for the wheel's reveal choreography (spec.md's Module
// 5b, beat 5) — fires once, the instant the curtains finish parting. Named
// in the original Polish additions section months before it actually got
// built; this is that trigger's real home. Same Web Audio synthesis
// approach as playHitSound.js/playTickSound.js, but a two-note rising
// chime rather than a single tone, deliberately brighter and longer than
// either — this is "the big moment," not another incidental blip.
let audioContext = null

export function playRevealChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioContext ??= new Ctx()

    const notes = [
      { freq: 1319, delay: 0 }, // E6
      { freq: 1760, delay: 0.09 }, // A6 — a beat after, not simultaneous
    ]

    for (const { freq, delay } of notes) {
      const startTime = audioContext.currentTime + delay
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = freq
      gain.gain.setValueAtTime(0.001, startTime)
      gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4)

      oscillator.connect(gain)
      gain.connect(audioContext.destination)

      oscillator.start(startTime)
      oscillator.stop(startTime + 0.4)
    }
  } catch {
    // Same defensive no-op as the other synthesized sounds.
  }
}

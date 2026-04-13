/**
 * Notification sound engine.
 *
 * Whistle sounds (kickoff / halfTime / fullTime) use the file at
 *   /sounds/whistle.mp3   ← drop your whistle file there
 *
 * Goal, redCard, and cancelledGoal are synthesized with the Web Audio API.
 */

// ── Web Audio helpers ─────────────────────────────────────────────────────────

let audioCtx = null

function getCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function tone(ctx, freq, start, duration, type = 'sine', volume = 0.28) {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

// ── Synthesized sounds ────────────────────────────────────────────────────────

function playGoal() {
  try {
    const ctx = getCtx()
    const t   = ctx.currentTime
    // Fast ascending high-pitch fanfare: C6 → E6 → G6 → C7 (held) + E7 shimmer
    tone(ctx, 1047, t,        0.09, 'sine', 0.30)   // C6
    tone(ctx, 1319, t + 0.08, 0.09, 'sine', 0.30)   // E6
    tone(ctx, 1568, t + 0.16, 0.09, 'sine', 0.30)   // G6
    tone(ctx, 2093, t + 0.24, 0.40, 'sine', 0.32)   // C7 – held
    tone(ctx, 2637, t + 0.24, 0.28, 'sine', 0.13)   // E7 – shimmer overtone
  } catch { /* Web Audio unavailable */ }
}

function playRedCard() {
  try {
    const ctx = getCtx()
    const t   = ctx.currentTime
    // Sharp urgent double sting, then a drop — feels alarming
    tone(ctx, 1760, t,        0.13, 'sawtooth', 0.22)  // A5
    tone(ctx, 1760, t + 0.16, 0.13, 'sawtooth', 0.22)  // A5 repeat
    tone(ctx, 1397, t + 0.32, 0.28, 'sawtooth', 0.18)  // F5 – dramatic drop
  } catch { /* Web Audio unavailable */ }
}

function playCancelledGoal() {
  try {
    const ctx = getCtx()
    const t   = ctx.currentTime
    // Descending "reversal" motif — high to low, feels like a decision overturned
    tone(ctx, 1568, t,        0.13, 'sine', 0.28)   // G6
    tone(ctx, 1319, t + 0.11, 0.13, 'sine', 0.25)   // E6
    tone(ctx, 1047, t + 0.22, 0.13, 'sine', 0.22)   // C6
    tone(ctx, 784,  t + 0.33, 0.35, 'sine', 0.20)   // G5 – held low resolution
  } catch { /* Web Audio unavailable */ }
}

// ── File-based sound ──────────────────────────────────────────────────────────

function playFile(path) {
  try {
    const audio = new Audio(path)
    audio.play().catch(() => {})
  } catch { /* unavailable */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Play the sound assigned to a notification type key.
 * @param {'goals'|'redCards'|'kickoff'|'halfTime'|'fullTime'|'cancelledGoal'} notifKey
 */
export function playSound(notifKey) {
  switch (notifKey) {
    case 'kickoff':
    case 'halfTime':
    case 'fullTime':
      playFile('/sounds/whistle.mp3')
      break
    case 'goals':
      playGoal()
      break
    case 'redCards':
      playRedCard()
      break
    case 'cancelledGoal':
      playCancelledGoal()
      break
    default:
      break
  }
}

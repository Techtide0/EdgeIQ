/**
 * Notification sound engine.
 *
 * Whistle sounds (kickoff / halfTime / fullTime) use the file at
 *   /sounds/78508__joedeshon__referee_whistle_01 (1).wav
 *
 * Goal, redCard, cancelledGoal, and prematch are synthesized with the Web Audio API.
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
    // Fast ascending fanfare: C6 → E6 → G6 → C7 (held) + E7 shimmer
    tone(ctx, 1047, t,        0.09, 'sine', 0.30)
    tone(ctx, 1319, t + 0.08, 0.09, 'sine', 0.30)
    tone(ctx, 1568, t + 0.16, 0.09, 'sine', 0.30)
    tone(ctx, 2093, t + 0.24, 0.40, 'sine', 0.32)
    tone(ctx, 2637, t + 0.24, 0.28, 'sine', 0.13)
  } catch { /* Web Audio unavailable */ }
}

function playRedCard() {
  try {
    const ctx = getCtx()
    const t   = ctx.currentTime
    // Sharp urgent double sting + dramatic drop
    tone(ctx, 1760, t,        0.13, 'sawtooth', 0.22)
    tone(ctx, 1760, t + 0.16, 0.13, 'sawtooth', 0.22)
    tone(ctx, 1397, t + 0.32, 0.28, 'sawtooth', 0.18)
  } catch { /* Web Audio unavailable */ }
}

function playCancelledGoal() {
  try {
    const ctx = getCtx()
    const t   = ctx.currentTime
    // Descending "reversal" — feels like a decision overturned
    tone(ctx, 1568, t,        0.13, 'sine', 0.28)
    tone(ctx, 1319, t + 0.11, 0.13, 'sine', 0.25)
    tone(ctx, 1047, t + 0.22, 0.13, 'sine', 0.22)
    tone(ctx, 784,  t + 0.33, 0.35, 'sine', 0.20)
  } catch { /* Web Audio unavailable */ }
}

/**
 * Pre-match countdown alert — a gentle two-tone "heads-up" chime.
 * Distinct from the whistle; feels like a calendar reminder.
 */
function playPrematch() {
  try {
    const ctx = getCtx()
    const t   = ctx.currentTime
    // Soft rising pair: E5 → A5, then a second slightly louder repeat
    tone(ctx, 659,  t,        0.18, 'sine', 0.22)   // E5
    tone(ctx, 880,  t + 0.20, 0.28, 'sine', 0.26)   // A5 — held
    tone(ctx, 659,  t + 0.55, 0.14, 'sine', 0.18)   // E5 echo
    tone(ctx, 880,  t + 0.70, 0.36, 'sine', 0.22)   // A5 — softer tail
  } catch { /* Web Audio unavailable */ }
}

// ── File-based sound ──────────────────────────────────────────────────────────

const WHISTLE_PATH = '/sounds/78508__joedeshon__referee_whistle_01 (1).wav'

function playWhistle() {
  try {
    const audio = new Audio(WHISTLE_PATH)
    audio.volume = 0.7
    audio.play().catch(() => {
      // Autoplay policy blocked it — ignore silently
    })
  } catch { /* unavailable */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Play the sound assigned to a notification type key.
 * @param {'goals'|'redCards'|'kickoff'|'halfTime'|'fullTime'|'cancelledGoal'|'prematch'} notifKey
 */
export function playSound(notifKey) {
  switch (notifKey) {
    case 'kickoff':
    case 'halfTime':
    case 'fullTime':
      playWhistle()
      break
    case 'prematch':
      playPrematch()
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

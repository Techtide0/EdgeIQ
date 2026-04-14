/**
 * Shared API-Football client with automatic key rotation.
 *
 * Priority order:
 *   1. Primary   — api-sports.io direct  (APIFOOTBALL_KEY / APIFOOTBALL_HOST)
 *   2. Secondary — Football98 / RapidAPI (FOOTBALL98_KEY  / FOOTBALL98_HOST)
 *
 * If the primary key hits a rate-limit or quota error (HTTP 429, or
 * API-Football's 200-with-errors pattern), the call is automatically
 * retried with the secondary key.  The primary is put into a 60-second
 * cooldown so subsequent calls go straight to secondary until it recovers.
 */

const fetch = require('node-fetch')

// ── Key cooldown state ────────────────────────────────────────────────────────
const COOLDOWN_MS = 60 * 1000   // 60 s before trying primary again after failure
let primaryCooldownUntil = 0    // epoch ms; 0 = not in cooldown

function isPrimaryCooling() {
  return Date.now() < primaryCooldownUntil
}
function coolDownPrimary() {
  primaryCooldownUntil = Date.now() + COOLDOWN_MS
  console.warn('[apiClient] primary key rate-limited — using secondary for 60 s')
}

// ── Per-key fetch helpers ─────────────────────────────────────────────────────

function primaryHeaders() {
  const isRapidAPI = process.env.APIFOOTBALL_HOST?.includes('rapidapi.com')
  return isRapidAPI
    ? { 'x-rapidapi-key': process.env.APIFOOTBALL_KEY, 'x-rapidapi-host': process.env.APIFOOTBALL_HOST }
    : { 'x-apisports-key': process.env.APIFOOTBALL_KEY }
}

function secondaryHeaders() {
  return {
    'x-rapidapi-key':  process.env.FOOTBALL98_KEY,
    'x-rapidapi-host': process.env.FOOTBALL98_HOST,
  }
}

async function fetchWithKey(path, headers) {
  const host = headers['x-rapidapi-host'] || process.env.APIFOOTBALL_HOST
  const url  = `https://${host}${path}`
  const res  = await fetch(url, { headers })

  if (res.status === 429) throw Object.assign(new Error('Rate limited (429)'), { isRateLimit: true })
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`)

  const json = await res.json()

  // API-Football returns HTTP 200 with errors:{} on quota/auth issues
  if (json.errors && Object.keys(json.errors).length > 0) {
    const msg = Object.values(json.errors).join(', ')
    const isQuota = /rate|limit|quota|request/i.test(msg)
    throw Object.assign(new Error(msg), { isRateLimit: isQuota })
  }

  return json
}

// ── Public apiFetch ───────────────────────────────────────────────────────────

/**
 * Fetch an API-Football compatible endpoint.
 * Returns the full JSON response (including .response array).
 *
 * @param {string} path  e.g. '/standings?league=39&season=2025'
 */
async function apiFetch(path) {
  const hasSecondary = process.env.FOOTBALL98_KEY && process.env.FOOTBALL98_HOST

  // Skip primary if it's in cooldown and we have a secondary
  if (!isPrimaryCooling()) {
    try {
      return await fetchWithKey(path, primaryHeaders())
    } catch (err) {
      if (hasSecondary) {
        // Any error from primary — rate-limit OR auth/quota — try secondary
        if (err.isRateLimit) coolDownPrimary()
        else console.warn(`[apiClient] primary failed (${err.message}) — trying secondary`)
        // fall through to secondary
      } else {
        throw err   // no secondary configured — propagate
      }
    }
  }

  // Secondary key
  if (hasSecondary) {
    return await fetchWithKey(path, secondaryHeaders())
  }

  throw new Error('All API keys exhausted or unavailable')
}

module.exports = { apiFetch }

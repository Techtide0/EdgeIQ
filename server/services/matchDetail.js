const { apiFetch }  = require('../config/apiClient')
const MatchSnapshot = require('../models/MatchSnapshot')

const FINALIZED     = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])
const LIVE          = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'])

// Cache TTLs (server-side; client auto-refreshes every 60s)
const TTL_LIVE_MS    = 5  * 60 * 1000   // 5 min  — live score/events
const TTL_PREMATCH_MS = 60 * 60 * 1000  // 1 h    — NS match (only status changes)
const TTL_OTHER_MS   = 30 * 60 * 1000   // 30 min — postponed / unknown

async function apiFetchResponse(path) {
  const json = await apiFetch(path)
  return json.response || []
}

// ─── Smart fetch — only request what's actually missing or stale ──────────────

async function fetchAndSave(matchId, existingDoc) {
  const id = Number(matchId)

  // Lineups: set once before kickoff, never change during a match.
  // Skip the API call if we already have them stored.
  const hasLineups  = Array.isArray(existingDoc?.lineups) && existingDoc.lineups.length > 0
  const existingSt  = existingDoc?.status || 'NS'
  const isPreMatch  = existingSt === 'NS'

  // For NS matches we only need the fixture (to detect kickoff / status change).
  // Skip events & stats — they're always empty pre-match.
  const [fixtures, lineups, events, statistics] = await Promise.all([
    apiFetchResponse(`/fixtures?id=${id}`),

    // Lineups: fetch only if not cached
    hasLineups
      ? Promise.resolve(existingDoc.lineups)
      : apiFetchResponse(`/fixtures/lineups?fixture=${id}`).catch(() => []),

    // Events & stats: skip entirely for pre-match (saves 2 calls)
    isPreMatch
      ? Promise.resolve(existingDoc?.events || [])
      : apiFetchResponse(`/fixtures/events?fixture=${id}`).catch(() => []),

    isPreMatch
      ? Promise.resolve(existingDoc?.statistics || [])
      : apiFetchResponse(`/fixtures/statistics?fixture=${id}`).catch(() => []),
  ])

  const f = fixtures[0]
  if (!f) throw new Error(`Match ${id} not found`)

  const status    = f.fixture.status.short
  const finalized = FINALIZED.has(status)

  const doc = {
    matchId:   id,
    homeTeam:  { id: f.teams.home.id,  name: f.teams.home.name,  logo: f.teams.home.logo  },
    awayTeam:  { id: f.teams.away.id,  name: f.teams.away.name,  logo: f.teams.away.logo  },
    league:    { id: f.league.id,      name: f.league.name,      logo: f.league.logo      },
    status,
    minute:    f.fixture.status.elapsed ?? null,
    half:      f.fixture.status.long ?? '',
    scoreHome: f.goals.home  ?? 0,
    scoreAway: f.goals.away  ?? 0,
    scoreHT:   { home: f.score?.halftime?.home ?? null, away: f.score?.halftime?.away ?? null },
    lineups,
    events,
    statistics,
    startTime: new Date(f.fixture.date),
    finalized,
    fetchedAt: new Date(),
  }

  await MatchSnapshot.findOneAndUpdate({ matchId: id }, doc, { upsert: true, returnDocument: 'after' })
  return doc
}

// ─── Public entry point ───────────────────────────────────────────────────────

async function getMatchDetail(matchId) {
  const id     = Number(matchId)
  const cached = await MatchSnapshot.findOne({ matchId: id })

  if (cached) {
    // Finalized matches never change
    if (cached.finalized) return cached

    const age     = Date.now() - new Date(cached.fetchedAt).getTime()
    const isLive  = LIVE.has(cached.status)
    const isNS    = cached.status === 'NS'
    const ttl     = isLive ? TTL_LIVE_MS : isNS ? TTL_PREMATCH_MS : TTL_OTHER_MS

    if (age < ttl) return cached
  }

  return fetchAndSave(id, cached)
}

module.exports = { getMatchDetail }

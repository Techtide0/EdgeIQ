const { apiFetch }  = require('../config/apiClient')
const UpcomingCache = require('../models/UpcomingCache')
const MatchSnapshot = require('../models/MatchSnapshot')

const LEAGUE_IDS = new Set([
  // Top 5 European
  39, 40, 140, 135, 78, 61,
  // Other major domestic
  88, 203, 253, 307,
  // European competitions
  2, 3, 848,
  // International
  1, 4,
  // Domestic cups
  45, 48, 143, 137, 81, 66,
])
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000   // 4 h  → ~3 req/day (3 dates × 1 refresh per 4h)
const DAYS_AHEAD        = 3

// In-memory layer — avoids hitting MongoDB on every request
let memCache = { data: null, fetchedAt: null }

function memValid() {
  return memCache.data !== null && memCache.fetchedAt &&
    (Date.now() - memCache.fetchedAt < CACHE_DURATION_MS)
}

function dateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function fetchForDate(date) {
  const json = await apiFetch(`/fixtures?date=${date}`)
  return json.response
    .filter(f => LEAGUE_IDS.has(f.league.id) && f.fixture.status.short === 'NS')
    .map(f => ({
      matchId:   f.fixture.id,
      leagueId:  f.league.id,
      league:    f.league.name,
      teamA:     f.teams.home.name,
      teamAId:   f.teams.home.id,
      teamB:     f.teams.away.name,
      teamBId:   f.teams.away.id,
      startTime: f.fixture.date,
    }))
}

// Upsert each upcoming match into MatchSnapshot so they're indexed by team name
async function saveToSnapshots(matches) {
  await Promise.all(matches.map(m =>
    MatchSnapshot.findOneAndUpdate(
      { matchId: m.matchId },
      {
        matchId:  m.matchId,
        homeTeam: { id: m.teamAId, name: m.teamA },
        awayTeam: { id: m.teamBId, name: m.teamB },
        league:   { id: m.leagueId, name: m.league },
        status:   'NS',
        startTime: new Date(m.startTime),
        fetchedAt: new Date(),
      },
      { upsert: true, setDefaultsOnInsert: true }
    ).catch(() => {})
  ))
}

async function fetchFromAPI() {
  const dates   = Array.from({ length: DAYS_AHEAD }, (_, i) => dateOffset(i))
  const results = await Promise.all(dates.map(fetchForDate))
  return results.flat().sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
}

async function getUpcomingMatches() {
  // 1. Serve from memory if still fresh
  if (memValid()) return { data: memCache.data, fromCache: true }

  // 2. Try MongoDB (survives server restarts)
  try {
    const dbCache = await UpcomingCache.findOne({ key: 'upcoming' })
    if (dbCache && dbCache.expiresAt > new Date()) {
      memCache = { data: dbCache.matches, fetchedAt: dbCache.fetchedAt.getTime() }
      return { data: dbCache.matches, fromCache: true }
    }
  } catch { /* DB not ready yet — fall through */ }

  // 3. Fetch from API-Football
  const data = await fetchFromAPI()

  const expiresAt = new Date(Date.now() + CACHE_DURATION_MS)

  // Persist to MongoDB (async — don't block response)
  UpcomingCache.findOneAndUpdate(
    { key: 'upcoming' },
    { key: 'upcoming', matches: data, fetchedAt: new Date(), expiresAt },
    { upsert: true }
  ).catch(() => {})

  // Index every match by team name for analytics
  saveToSnapshots(data).catch(() => {})

  memCache = { data, fetchedAt: Date.now() }
  return { data, fromCache: false }
}

function getLastKnown()     { return memCache.data }
function getLastUpdatedMs() { return memCache.fetchedAt }

module.exports = { getUpcomingMatches, getLastKnown, getLastUpdatedMs }

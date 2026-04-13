const fetch         = require('node-fetch')
const MatchSnapshot = require('../models/MatchSnapshot')
const { getLogo }   = require('./teamLogos')

const LEAGUE_IDS = [
  // ── Top 5 European ──────────────────────────────
  39, 40,        // Premier League, Championship
  140,           // La Liga
  135,           // Serie A
  78,            // Bundesliga
  61,            // Ligue 1
  // ── Other major domestic ─────────────────────────
  88,            // Eredivisie
  203,           // Süper Lig
  253,           // MLS
  307,           // Saudi Pro League
  // ── European club competitions ───────────────────
  2,             // UEFA Champions League
  3,             // UEFA Europa League
  848,           // UEFA Europa Conference League
  // ── International ───────────────────────────────
  1,             // FIFA World Cup
  4,             // UEFA Euro
  // ── Domestic cups ───────────────────────────────
  45, 48,        // FA Cup, EFL Cup
  143,           // Copa del Rey
  137,           // Coppa Italia
  81,            // DFB-Pokal
  66,            // Coupe de France
]
const CACHE_DURATION_MS = 5 * 60 * 1000          // 5 min → ~40 req/day during live hours
const FINALIZED         = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])

let cache = { data: null, fetchedAt: null }

function isCacheValid() {
  return cache.data !== null && cache.fetchedAt &&
    (Date.now() - cache.fetchedAt < CACHE_DURATION_MS)
}

function apiHeaders() {
  const isRapidAPI = process.env.APIFOOTBALL_HOST?.includes('rapidapi.com')
  return isRapidAPI
    ? { 'x-rapidapi-key': process.env.APIFOOTBALL_KEY, 'x-rapidapi-host': process.env.APIFOOTBALL_HOST }
    : { 'x-apisports-key': process.env.APIFOOTBALL_KEY }
}

// Upsert live match summary into MatchSnapshot — indexed by team name for analytics
async function saveToSnapshots(matches) {
  await Promise.all(matches.map(m =>
    MatchSnapshot.findOneAndUpdate(
      { matchId: m.matchId },
      {
        matchId:   m.matchId,
        homeTeam:  { id: m.teamAId, name: m.teamA },
        awayTeam:  { id: m.teamBId, name: m.teamB },
        league:    { id: m.leagueId, name: m.league },
        status:    m.status,
        minute:    m.minute,
        scoreHome: m.scoreA,
        scoreAway: m.scoreB,
        finalized: FINALIZED.has(m.status),
        fetchedAt: new Date(),
      },
      { upsert: true, setDefaultsOnInsert: true }
    ).catch(() => {})
  ))
}

async function fetchFromAPI() {
  const res = await fetch(
    `https://${process.env.APIFOOTBALL_HOST}/fixtures?live=all`,
    { headers: apiHeaders() }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API-Football ${res.status}: ${body.slice(0, 120)}`)
  }
  const json = await res.json()
  return json.response
    .filter(f => LEAGUE_IDS.includes(f.league.id))
    .map(f => ({
      matchId:  f.fixture.id,
      leagueId: f.league.id,
      league:   f.league.name,
      teamA:    f.teams.home.name,
      teamAId:  f.teams.home.id,
      teamB:    f.teams.away.name,
      teamBId:  f.teams.away.id,
      scoreA:   f.goals.home,
      scoreB:   f.goals.away,
      minute:   f.fixture.status.elapsed,
      status:   f.fixture.status.short,
    }))
}

async function getLiveMatches() {
  if (isCacheValid()) return { data: cache.data, fromCache: true }

  const data = await fetchFromAPI()
  cache = { data, fetchedAt: Date.now() }

  // Save to DB asynchronously — don't block the response
  saveToSnapshots(data).catch(() => {})

  return { data, fromCache: false }
}

function getLastKnown()     { return cache.data }
function getLastUpdatedMs() { return cache.fetchedAt }

module.exports = { getLiveMatches, getLastKnown, getLastUpdatedMs }

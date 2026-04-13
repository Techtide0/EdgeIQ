const router        = require('express').Router()
const fetch         = require('node-fetch')
const authMiddleware = require('../middleware/authMiddleware')
const { getLiveMatches, getLastKnown, getLastUpdatedMs }           = require('../services/liveMatches')
const { getUpcomingMatches, getLastKnown: getUpcomingLastKnown }   = require('../services/upcomingMatches')
const { getAnalysis, computeAndSave }                              = require('../services/analysis')
const { getMatchDetail }                                           = require('../services/matchDetail')
const OddsCache     = require('../models/OddsCache')
const StandingCache = require('../models/StandingCache')
const MatchSnapshot = require('../models/MatchSnapshot')
const DayCache      = require('../models/DayCache')
const { getLogo }   = require('../services/teamLogos')

router.use(authMiddleware)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function apiHeaders() {
  const isRapidAPI = process.env.APIFOOTBALL_HOST?.includes('rapidapi.com')
  return isRapidAPI
    ? { 'x-rapidapi-key': process.env.APIFOOTBALL_KEY, 'x-rapidapi-host': process.env.APIFOOTBALL_HOST }
    : { 'x-apisports-key': process.env.APIFOOTBALL_KEY }
}

async function apiFetch(path) {
  const url = `https://${process.env.APIFOOTBALL_HOST}${path}`
  const res = await fetch(url, { headers: apiHeaders() })
  if (!res.ok) throw new Error(`API-Football ${res.status} on ${path}`)
  const json = await res.json()
  return json
}

function lastUpdatedLabel(ms) {
  if (!ms) return null
  const mins = Math.floor((Date.now() - ms) / 60000)
  return mins === 0 ? 'Just now' : `${mins} min ago`
}

// ─── Live matches ─────────────────────────────────────────────────────────────

router.get('/live', async (req, res) => {
  try {
    const { data, fromCache } = await getLiveMatches()
    const enriched = data.map(m => ({
      ...m,
      teamALogo: getLogo(m.teamAId) || null,
      teamBLogo: getLogo(m.teamBId) || null,
    }))
    res.json({ matches: enriched, fromCache, lastUpdated: lastUpdatedLabel(getLastUpdatedMs()) })
  } catch (err) {
    console.error('[live]', err.message)
    const fallback = getLastKnown()
    if (fallback) return res.json({ matches: fallback, fromCache: true, stale: true, lastUpdated: lastUpdatedLabel(getLastUpdatedMs()) })
    res.json({ matches: [], fromCache: false, error: err.message })
  }
})

// ─── Upcoming matches ─────────────────────────────────────────────────────────

router.get('/upcoming', async (req, res) => {
  try {
    const { data, fromCache } = await getUpcomingMatches()

    // Enrich with logos from in-memory team logo map (zero DB/API cost)
    const enriched = data.map(m => ({
      ...m,
      teamALogo: getLogo(m.teamAId) || null,
      teamBLogo: getLogo(m.teamBId) || null,
    }))

    res.json({ matches: enriched, fromCache })
  } catch (err) {
    console.error('[upcoming]', err.message)
    res.json({ matches: [], fromCache: false, error: err.message })
  }
})

// ─── Matches by date (all statuses — past, live, upcoming) ───────────────────
// GET /api/matches/day/2025-04-13
router.get('/day/:date', async (req, res) => {
  const date = req.params.date   // YYYY-MM-DD

  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' })
  }

  const today    = new Date().toISOString().split('T')[0]
  const isPast   = date < today
  const isToday  = date === today
  const isFuture = date > today

  try {
    // ── 1. Serve from DayCache if still valid ─────────────────────────────────
    const cached = await DayCache.findOne({ date })
    if (cached) {
      const expired = cached.expiresAt && cached.expiresAt < new Date()
      if (!expired) {
        return res.json({ matches: cached.matches, fromCache: true })
      }
    }

    // ── 2. Fetch from API-Football ────────────────────────────────────────────
    const json = await apiFetch(`/fixtures?date=${date}`)

    // API-Football returns 200 OK with errors:{} when rate-limited — detect it
    if (json.errors && Object.keys(json.errors).length > 0) {
      const errMsg = Object.values(json.errors).join(', ')
      console.error('[day] API-Football error:', errMsg)
      throw new Error(`API-Football: ${errMsg}`)
    }

    const DAY_LEAGUE_IDS = new Set([
      39, 40, 140, 135, 78, 61,
      88, 203, 253, 307,
      2, 3, 848,
      1, 4,
      45, 48, 143, 137, 81, 66,
    ])

    const matches = (json.response || [])
      .filter(f => DAY_LEAGUE_IDS.has(f.league.id))
      .map(f => ({
        matchId:    f.fixture.id,
        leagueId:   f.league.id,
        league:     f.league.name,
        leagueLogo: f.league.logo,
        teamA:      f.teams.home.name,
        teamAId:    f.teams.home.id,
        teamALogo:  getLogo(f.teams.home.id) || f.teams.home.logo,
        teamB:      f.teams.away.name,
        teamBId:    f.teams.away.id,
        teamBLogo:  getLogo(f.teams.away.id) || f.teams.away.logo,
        scoreA:     f.goals.home,
        scoreB:     f.goals.away,
        status:     f.fixture.status.short,
        minute:     f.fixture.status.elapsed,
        startTime:  f.fixture.date,
        venue:      f.fixture.venue?.name || null,
      }))
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))

    // Don't cache empty results — likely a rate-limit false-negative
    if (matches.length === 0) {
      return res.json({ matches: [], fromCache: false })
    }

    // ── 3. Cache TTL strategy ─────────────────────────────────────────────────
    let expiresAt = null
    if (isToday)  expiresAt = new Date(Date.now() + 5  * 60 * 1000)
    if (isFuture) expiresAt = new Date(Date.now() + 4  * 60 * 60 * 1000)

    await DayCache.findOneAndUpdate(
      { date },
      { date, matches, fetchedAt: new Date(), expiresAt },
      { upsert: true }
    )

    // Also upsert every match into MatchSnapshot for analytics
    Promise.all(matches.map(m =>
      MatchSnapshot.findOneAndUpdate(
        { matchId: m.matchId },
        {
          matchId:   m.matchId,
          homeTeam:  { id: m.teamAId, name: m.teamA, logo: m.teamALogo },
          awayTeam:  { id: m.teamBId, name: m.teamB, logo: m.teamBLogo },
          league:    { id: m.leagueId, name: m.league, logo: m.leagueLogo },
          status:    m.status,
          scoreHome: m.scoreA,
          scoreAway: m.scoreB,
          startTime: new Date(m.startTime),
          finalized: ['FT','AET','PEN','AWD','WO'].includes(m.status),
          fetchedAt: new Date(),
        },
        { upsert: true, setDefaultsOnInsert: true }
      ).catch(() => {})
    )).catch(() => {})

    res.json({ matches, fromCache: false })
  } catch (err) {
    console.error('[day]', err.message)

    // Fallback 1: stale DayCache entry
    const stale = await DayCache.findOne({ date }).catch(() => null)
    if (stale?.matches?.length) {
      return res.json({ matches: stale.matches, fromCache: true, stale: true })
    }

    // Fallback 2: pull whatever MatchSnapshot has for this date
    try {
      const start = new Date(date)
      const end   = new Date(date)
      end.setDate(end.getDate() + 1)

      const snaps = await MatchSnapshot.find(
        { startTime: { $gte: start, $lt: end } },
        { matchId:1, homeTeam:1, awayTeam:1, league:1,
          status:1, minute:1, scoreHome:1, scoreAway:1, startTime:1 }
      ).sort({ startTime: 1 })

      if (snaps.length > 0) {
        const matches = snaps.map(s => ({
          matchId:   s.matchId,
          leagueId:  s.league?.id,
          league:    s.league?.name,
          leagueLogo: s.league?.logo,
          teamA:     s.homeTeam?.name,
          teamAId:   s.homeTeam?.id,
          teamALogo: getLogo(s.homeTeam?.id) || s.homeTeam?.logo,
          teamB:     s.awayTeam?.name,
          teamBId:   s.awayTeam?.id,
          teamBLogo: getLogo(s.awayTeam?.id) || s.awayTeam?.logo,
          scoreA:    s.scoreHome,
          scoreB:    s.scoreAway,
          status:    s.status,
          minute:    s.minute,
          startTime: s.startTime,
        }))
        return res.json({ matches, fromCache: true, stale: true })
      }
    } catch { /* ignore */ }

    // Nothing available — return empty rather than 500
    res.json({ matches: [], fromCache: false, error: err.message })
  }
})

// ─── Analysis ─────────────────────────────────────────────────────────────────

router.get('/analysis/:matchId', async (req, res) => {
  try {
    const matchId = req.params.matchId

    let insight = await getAnalysis(matchId)
    if (insight) return res.json(insight)

    const id = Number(matchId)

    // 1. Check in-memory caches first (fastest)
    const allMatches = [
      ...(getLastKnown()         || []),
      ...(getUpcomingLastKnown() || []),
    ]
    let match = allMatches.find(m => m.matchId === id)

    // 2. Fall back to MatchSnapshot in MongoDB (survives restarts + direct deep links)
    if (!match) {
      const snap = await MatchSnapshot.findOne({ matchId: id }, {
        matchId: 1, homeTeam: 1, awayTeam: 1, league: 1,
      })
      if (snap) {
        match = {
          matchId:  snap.matchId,
          teamA:    snap.homeTeam?.name,
          teamAId:  snap.homeTeam?.id,
          teamB:    snap.awayTeam?.name,
          teamBId:  snap.awayTeam?.id,
          league:   snap.league?.name,
          leagueId: snap.league?.id,
        }
      }
    }

    // 3. Last resort — fetch bare fixture from API-Football (1 call) to get team info
    if (!match) {
      try {
        const json = await apiFetch(`/fixtures?id=${id}`)
        const f    = json.response?.[0]
        if (f) {
          match = {
            matchId:  f.fixture.id,
            teamA:    f.teams.home.name,
            teamAId:  f.teams.home.id,
            teamB:    f.teams.away.name,
            teamBId:  f.teams.away.id,
            league:   f.league.name,
            leagueId: f.league.id,
          }
          // Persist to MatchSnapshot so next time it's free
          MatchSnapshot.findOneAndUpdate(
            { matchId: id },
            {
              matchId:  f.fixture.id,
              homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
              awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
              league:   { id: f.league.id,     name: f.league.name,     logo: f.league.logo     },
              status:   f.fixture.status.short,
              startTime: new Date(f.fixture.date),
              fetchedAt: new Date(),
            },
            { upsert: true }
          ).catch(() => {})
        }
      } catch { /* API call failed — fall through to 404 */ }
    }

    if (!match) {
      return res.status(404).json({ error: 'Match not found' })
    }

    insight = await computeAndSave(match)
    if (!insight) return res.status(503).json({ error: 'Could not compute analysis for this match' })

    res.json(insight)
  } catch (err) {
    console.error('[analysis]', err.message)
    res.status(500).json({ error: 'Analysis failed' })
  }
})

// ─── Standings (MongoDB-cached 24 h) ─────────────────────────────────────────

router.get('/:leagueId/standings', async (req, res) => {
  const leagueId = Number(req.params.leagueId)
  const season   = Number(req.query.season) || (new Date().getFullYear())

  try {
    // 1. Serve from DB if still valid
    const cached = await StandingCache.findOne({ leagueId, season })
    if (cached && cached.expiresAt > new Date()) {
      return res.json({ name: cached.name, season: cached.season, standings: cached.standings })
    }

    // 2. Fetch from API-Football
    const json     = await apiFetch(`/standings?league=${leagueId}&season=${season}`)
    const league   = json.response?.[0]?.league
    const standings = league?.standings?.[0] || []

    // 3. Save to MongoDB (24 h TTL)
    StandingCache.findOneAndUpdate(
      { leagueId, season },
      {
        leagueId, season,
        name:      league?.name,
        standings,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { upsert: true }
    ).catch(() => {})

    res.json({ name: league?.name, season, standings })
  } catch (err) {
    console.error('[standings]', err.message)
    // Fallback: serve stale DB data rather than an error
    const stale = await StandingCache.findOne({ leagueId, season }).catch(() => null)
    if (stale) return res.json({ name: stale.name, season: stale.season, standings: stale.standings })
    res.status(500).json({ error: err.message })
  }
})

// ─── Odds (MongoDB-cached 2 h) ────────────────────────────────────────────────

router.get('/:matchId/odds', async (req, res) => {
  const matchId = Number(req.params.matchId)

  try {
    // 1. Serve from DB if still valid
    const cached = await OddsCache.findOne({ matchId })
    if (cached && cached.expiresAt > new Date()) {
      return res.json({ bookmakers: cached.bookmakers })
    }

    // 2. Fetch from API-Football
    const json       = await apiFetch(`/odds?fixture=${matchId}&bookmaker=1`)
    const bookmakers = json.response?.[0]?.bookmakers || []

    // 3. Cache: 2 h for live/upcoming, permanent-ish for finished matches
    const snapshot  = await MatchSnapshot.findOne({ matchId }, { finalized: 1 }).catch(() => null)
    const ttlMs     = snapshot?.finalized
      ? 365 * 24 * 60 * 60 * 1000   // 1 year — finished match odds don't change
      : 2   * 60 * 60 * 1000        // 2 h

    OddsCache.findOneAndUpdate(
      { matchId },
      { matchId, bookmakers, fetchedAt: new Date(), expiresAt: new Date(Date.now() + ttlMs) },
      { upsert: true }
    ).catch(() => {})

    res.json({ bookmakers })
  } catch (err) {
    console.error('[odds]', err.message)
    // Fallback: stale DB data
    const stale = await OddsCache.findOne({ matchId }).catch(() => null)
    if (stale) return res.json({ bookmakers: stale.bookmakers })
    res.json({ bookmakers: [] })
  }
})

// ─── Match detail ─────────────────────────────────────────────────────────────

router.get('/:matchId/detail', async (req, res) => {
  try {
    const data = await getMatchDetail(req.params.matchId)
    res.json(data)
  } catch (err) {
    console.error('[match-detail]', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

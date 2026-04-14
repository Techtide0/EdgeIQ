const { apiFetch } = require('../config/apiClient')
const TeamLogo     = require('../models/TeamLogo')

// Domestic leagues only — cup teams are the same clubs, European comps covered by domestic leagues
const LEAGUE_IDS = [
  39, 40,   // Premier League, Championship
  140,      // La Liga
  135,      // Serie A
  78,       // Bundesliga
  61,       // Ligue 1
  88,       // Eredivisie
  203,      // Süper Lig
  253,      // MLS
  307,      // Saudi Pro League
  2,        // Champions League (includes non-domestic teams)
  3,        // Europa League
  848,      // Conference League
]
const SEASON     = 2024

// In-memory map: teamId → logo URL  (populated once from DB)
let logoMap = null

async function fetchLeagueTeams(leagueId) {
  const json = await apiFetch(`/teams?league=${leagueId}&season=${SEASON}`)
  return (json.response || []).map(entry => ({
    teamId:   entry.team.id,
    name:     entry.team.name,
    logo:     entry.team.logo,
    leagueId,
  }))
}

// Called once on startup — fetches teams for any league not yet in DB
async function initTeamLogos() {
  // Find which leagues already have teams stored
  const stored = await TeamLogo.find({}, { leagueId: 1 })
  const storedLeagues = new Set(stored.map(t => t.leagueId))

  // Always load what we have into memory first
  if (stored.length > 0) {
    const all = await TeamLogo.find({})
    logoMap = Object.fromEntries(all.map(t => [t.teamId, t.logo]))
    console.log(`[teamLogos] loaded ${all.length} team logos from DB`)
  } else {
    logoMap = {}
  }

  // Fetch only leagues not yet in DB
  const missing = LEAGUE_IDS.filter(id => !storedLeagues.has(id))
  if (missing.length === 0) return

  console.log(`[teamLogos] fetching logos for ${missing.length} new leagues…`)
  try {
    const results = await Promise.all(missing.map(fetchLeagueTeams))
    const teams   = results.flat()

    await Promise.all(teams.map(t =>
      TeamLogo.findOneAndUpdate({ teamId: t.teamId }, t, { upsert: true })
    ))

    teams.forEach(t => { logoMap[t.teamId] = t.logo })
    console.log(`[teamLogos] cached ${teams.length} new team logos`)
  } catch (err) {
    console.warn('[teamLogos] fetch failed:', err.message)
  }
}

// Returns logo URL for a team ID (null if unknown)
function getLogo(teamId) {
  return logoMap?.[teamId] ?? null
}

// Returns the full map (for bulk enrichment)
function getLogoMap() {
  return logoMap || {}
}

module.exports = { initTeamLogos, getLogo, getLogoMap }

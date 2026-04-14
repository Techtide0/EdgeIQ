const { apiFetch } = require('../config/apiClient')
const TeamStats    = require('../models/TeamStats')

const SEASON        = 2024
const TTL_MS        = 7 * 24 * 60 * 60 * 1000   // 7 days

function sumCardPeriods(cardObj) {
  if (!cardObj) return 0
  return Object.values(cardObj).reduce((sum, p) => sum + (p?.total || 0), 0)
}

function formLast5(formStr) {
  if (!formStr) return ''
  return formStr.slice(-5)
}

async function fetchAndCacheTeamStats(teamId, leagueId) {
  // Return cached version if it exists (MongoDB TTL handles expiry)
  const cached = await TeamStats.findOne({ teamId: String(teamId) })
  if (cached) return cached

  const json  = await apiFetch(`/teams/statistics?team=${teamId}&league=${leagueId}&season=${SEASON}`)
  const s     = json.response
  const games    = s.fixtures?.played?.total || 1
  const homePlayed = s.fixtures?.played?.home || 1
  const awayPlayed = s.fixtures?.played?.away || 1
  const homeWins   = s.fixtures?.wins?.home   || 0
  const awayWins   = s.fixtures?.wins?.away   || 0

  const totalYellow = sumCardPeriods(s.cards?.yellow)
  const totalRed    = sumCardPeriods(s.cards?.red)

  const doc = {
    teamId:            String(teamId),
    teamName:          s.team?.name,
    leagueId,
    season:            SEASON,
    gamesPlayed:       games,
    avgGoalsScored:    parseFloat(s.goals?.for?.average?.total)     || 0,
    avgGoalsConceded:  parseFloat(s.goals?.against?.average?.total) || 0,
    form:              formLast5(s.form),
    totalYellowCards:  totalYellow,
    totalRedCards:     totalRed,
    avgYellowCards:    parseFloat((totalYellow / games).toFixed(2)),
    avgRedCards:       parseFloat((totalRed    / games).toFixed(2)),
    cleanSheets:       s.clean_sheet?.total    || 0,
    cleanSheetRate:    parseFloat(((s.clean_sheet?.total    || 0) / games * 100).toFixed(1)),
    failedToScore:     s.failed_to_score?.total || 0,
    failedToScoreRate: parseFloat(((s.failed_to_score?.total || 0) / games * 100).toFixed(1)),
    // Home / Away split
    homeGamesPlayed:      homePlayed,
    awayGamesPlayed:      awayPlayed,
    homeWins,
    awayWins,
    homeWinRate:          parseFloat(((homeWins / homePlayed) * 100).toFixed(1)),
    awayWinRate:          parseFloat(((awayWins / awayPlayed) * 100).toFixed(1)),
    avgGoalsScoredHome:   parseFloat(s.goals?.for?.average?.home)     || 0,
    avgGoalsScoredAway:   parseFloat(s.goals?.for?.average?.away)     || 0,
    avgGoalsConcededHome: parseFloat(s.goals?.against?.average?.home) || 0,
    avgGoalsConcededAway: parseFloat(s.goals?.against?.average?.away) || 0,
    fetchedAt:         new Date(),
    expiresAt:         new Date(Date.now() + TTL_MS),
  }

  await TeamStats.findOneAndUpdate(
    { teamId: String(teamId) },
    doc,
    { upsert: true }
  )

  return doc
}

module.exports = { fetchAndCacheTeamStats }

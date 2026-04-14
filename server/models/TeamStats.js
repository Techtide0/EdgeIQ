const { Schema, model } = require('mongoose')

const TeamStatsSchema = new Schema({
  teamId:   { type: String, required: true, unique: true },
  teamName: String,
  leagueId: Number,
  season:   Number,

  gamesPlayed:       Number,

  // Goals
  avgGoalsScored:    Number,
  avgGoalsConceded:  Number,

  // Form — last 5 as string e.g. "WWDLW"
  form: String,

  // Discipline
  avgYellowCards:    Number,
  avgRedCards:       Number,
  totalYellowCards:  Number,
  totalRedCards:     Number,

  // Defense
  cleanSheets:       Number,
  cleanSheetRate:    Number,   // percentage 0–100
  failedToScore:     Number,
  failedToScoreRate: Number,   // percentage 0–100

  // Home / Away split
  homeGamesPlayed:      Number,
  awayGamesPlayed:      Number,
  homeWins:             Number,
  awayWins:             Number,
  homeWinRate:          Number,   // percentage 0–100
  awayWinRate:          Number,   // percentage 0–100
  avgGoalsScoredHome:   Number,
  avgGoalsScoredAway:   Number,
  avgGoalsConcededHome: Number,
  avgGoalsConcededAway: Number,

  fetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, expires: 0 },          // TTL: 7 days (set on write)
})

module.exports = model('TeamStats', TeamStatsSchema)

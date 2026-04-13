const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  matchId:  { type: Number, unique: true, index: true },
  homeTeam: { id: Number, name: String, logo: String },
  awayTeam: { id: Number, name: String, logo: String },
  league:   { id: Number, name: String, logo: String },
  status:   String,   // NS, 1H, HT, 2H, FT, AET, PEN…
  minute:   Number,
  half:     String,   // "First Half", "Second Half", etc.
  scoreHome: { type: Number, default: 0 },
  scoreAway: { type: Number, default: 0 },
  scoreHT:  { home: Number, away: Number },
  lineups:    mongoose.Schema.Types.Mixed,
  events:     mongoose.Schema.Types.Mixed,
  statistics: mongoose.Schema.Types.Mixed,
  startTime:  Date,
  finalized:  { type: Boolean, default: false },
  fetchedAt:  Date,
}, { timestamps: true })

// Team-name indexes — allow querying all matches by team for analytics
schema.index({ 'homeTeam.name': 1 })
schema.index({ 'awayTeam.name': 1 })
// Composite: find all matches for a team across home+away
schema.index({ 'homeTeam.id': 1, startTime: -1 })
schema.index({ 'awayTeam.id': 1, startTime: -1 })
// Analytics: finished matches by league
schema.index({ 'league.id': 1, finalized: 1, startTime: -1 })
schema.index({ startTime: -1 })

module.exports = mongoose.model('MatchSnapshot', schema)

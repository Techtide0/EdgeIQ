const { Schema, model } = require('mongoose')

const schema = new Schema({
  leagueId:  { type: Number },
  season:    { type: Number },
  name:      String,
  standings: Schema.Types.Mixed,
  fetchedAt: Date,
  expiresAt: Date,
})

schema.index({ leagueId: 1, season: 1 }, { unique: true })
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = model('StandingCache', schema)

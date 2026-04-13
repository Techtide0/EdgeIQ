const { Schema, model } = require('mongoose')

const schema = new Schema({
  matchId:    { type: Number, unique: true, index: true },
  bookmakers: Schema.Types.Mixed,
  fetchedAt:  Date,
  expiresAt:  Date,
})

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = model('OddsCache', schema)

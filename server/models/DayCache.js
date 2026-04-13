const { Schema, model } = require('mongoose')

const schema = new Schema({
  date:      { type: String, unique: true, index: true }, // YYYY-MM-DD
  matches:   Schema.Types.Mixed,
  fetchedAt: Date,
  expiresAt: Date,   // null = never expire (past dates are immutable)
})

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true })

module.exports = model('DayCache', schema)

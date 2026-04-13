const { Schema, model } = require('mongoose')

const schema = new Schema({
  key:       { type: String, unique: true, default: 'upcoming' },
  matches:   Schema.Types.Mixed,
  fetchedAt: Date,
  expiresAt: Date,
})

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = model('UpcomingCache', schema)

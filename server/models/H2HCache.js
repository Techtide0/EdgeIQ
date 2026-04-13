const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  teamPair:   { type: String, unique: true, required: true }, // 'smallerId-largerId'
  matchCount: { type: Number, default: 0 },
  avgGoals:   { type: Number, default: 0 },
  over25Rate: { type: Number, default: 0 }, // fraction 0–1
  bttsRate:   { type: Number, default: 0 }, // fraction 0–1
  fetchedAt:  Date,
  expiresAt:  Date,
})

// TTL index — auto-deleted when expiresAt passes (24 h TTL set at write time)
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true })

module.exports = mongoose.model('H2HCache', schema)

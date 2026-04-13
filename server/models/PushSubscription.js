const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  userId:           { type: String, required: true, index: true },
  matchId:          { type: Number, required: true, index: true },
  subscription:     { type: mongoose.Schema.Types.Mixed, required: true }, // PushSubscription JSON
  lastNotifiedAt:   { type: Date, default: null },  // last time we fired a notification
  lastEventCount:   { type: Number, default: 0 },   // events already notified about
  notifiedKickoff:  { type: Boolean, default: false },
  notifiedHT:       { type: Boolean, default: false },
  notifiedFT:       { type: Boolean, default: false },
}, { timestamps: true })

schema.index({ userId: 1, matchId: 1 }, { unique: true })

module.exports = mongoose.model('PushSubscription', schema)

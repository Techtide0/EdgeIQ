const mongoose = require('mongoose')

// Stores a user's push subscription for app-wide alerts (AI insights, odds movement).
// Unlike PushSubscription (which is per-match), one document = one device per user.
const schema = new mongoose.Schema({
  userId:       { type: String, required: true },
  subscription: { type: mongoose.Schema.Types.Mixed, required: true }, // Web Push JSON
}, { timestamps: true })

// One document per userId — if a user registers multiple devices, keep only the latest
schema.index({ userId: 1 }, { unique: true })

module.exports = mongoose.model('GlobalPushSubscription', schema)

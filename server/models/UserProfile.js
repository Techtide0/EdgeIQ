const mongoose = require('mongoose')

const NotifPrefSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
}, { _id: false })

const schema = new mongoose.Schema({
  userId:      { type: String, required: true, unique: true },
  nickname:    { type: String, default: '', maxlength: 30 },
  avatarColor: {
    type: String, default: 'green',
    enum: ['green', 'blue', 'purple', 'orange', 'red', 'teal', 'gold', 'pink'],
  },
  avatarEmoji: { type: String, default: '', maxlength: 8 },   // emoji is max 2 chars (some are 2 code points)
  avatarUrl:   { type: String, default: '', maxlength: 500 }, // Firebase Storage photo URL

  notificationPrefs: {
    prematch:      { type: NotifPrefSchema, default: () => ({ enabled: true  }) },
    goals:         { type: NotifPrefSchema, default: () => ({ enabled: true  }) },
    redCards:      { type: NotifPrefSchema, default: () => ({ enabled: true  }) },
    cancelledGoal: { type: NotifPrefSchema, default: () => ({ enabled: true  }) },
    kickoff:       { type: NotifPrefSchema, default: () => ({ enabled: true  }) },
    halfTime:      { type: NotifPrefSchema, default: () => ({ enabled: true  }) },
    fullTime:      { type: NotifPrefSchema, default: () => ({ enabled: true  }) },
  },

  updatedAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('UserProfile', schema)

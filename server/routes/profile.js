const router      = require('express').Router()
const auth        = require('../middleware/authMiddleware')
const UserProfile = require('../models/UserProfile')

router.use(auth)

const VALID_NOTIF_KEYS = ['goals', 'redCards', 'cancelledGoal', 'kickoff', 'halfTime', 'fullTime']

const DEFAULT_PREFS = Object.fromEntries(VALID_NOTIF_KEYS.map(k => [k, { enabled: true }]))

function serialize(doc) {
  return {
    nickname:          doc.nickname    || '',
    avatarColor:       doc.avatarColor || 'green',
    avatarEmoji:       doc.avatarEmoji || '',
    avatarUrl:         doc.avatarUrl   || '',
    notificationPrefs: doc.notificationPrefs || DEFAULT_PREFS,
  }
}

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const doc = await UserProfile.findOne({ userId: req.user.uid })
    if (!doc) return res.json({ nickname: '', avatarColor: 'green', avatarEmoji: '', avatarUrl: '', notificationPrefs: DEFAULT_PREFS })
    res.json(serialize(doc))
  } catch (err) {
    console.error('[profile GET]', err.message)
    res.status(500).json({ error: 'Failed to load profile' })
  }
})

// PUT /api/profile
router.put('/', async (req, res) => {
  try {
    const { nickname, avatarColor, avatarEmoji, avatarUrl, notificationPrefs } = req.body
    const VALID_COLORS = ['green', 'blue', 'purple', 'orange', 'red', 'teal', 'gold', 'pink']

    const update = { updatedAt: new Date() }

    if (typeof nickname === 'string')
      update.nickname = nickname.slice(0, 30).trim()

    if (typeof avatarColor === 'string' && VALID_COLORS.includes(avatarColor))
      update.avatarColor = avatarColor

    if (typeof avatarEmoji === 'string')
      update.avatarEmoji = avatarEmoji.slice(0, 4)

    if (typeof avatarUrl === 'string') {
      const isFirebase = avatarUrl === '' ||
        avatarUrl.startsWith('https://firebasestorage.googleapis.com/') ||
        avatarUrl.startsWith('https://storage.googleapis.com/')
      if (isFirebase) update.avatarUrl = avatarUrl
    }

    if (notificationPrefs && typeof notificationPrefs === 'object') {
      const prefs = {}
      for (const [key, val] of Object.entries(notificationPrefs)) {
        if (VALID_NOTIF_KEYS.includes(key) && typeof val?.enabled === 'boolean') {
          prefs[key] = { enabled: val.enabled }
        }
      }
      if (Object.keys(prefs).length) update.notificationPrefs = prefs
    }

    const doc = await UserProfile.findOneAndUpdate(
      { userId: req.user.uid },
      { $set: update },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )

    res.json(serialize(doc))
  } catch (err) {
    console.error('[profile PUT]', err.message)
    res.status(500).json({ error: 'Failed to save profile' })
  }
})

module.exports = router

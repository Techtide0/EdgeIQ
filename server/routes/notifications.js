const router        = require('express').Router()
const webpush       = require('web-push')
const authMiddleware = require('../middleware/authMiddleware')
const PushSubscription = require('../models/PushSubscription')

// Configure VAPID — keys must be in .env
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@edgeiq.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

router.use(authMiddleware)

// GET /api/notifications/vapid-public-key
router.get('/vapid-public-key', (_req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' })
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
})

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res) => {
  const { subscription, matchId } = req.body
  if (!subscription || !matchId) return res.status(400).json({ error: 'subscription and matchId required' })

  await PushSubscription.findOneAndUpdate(
    { userId: req.user.uid, matchId: Number(matchId) },
    { userId: req.user.uid, matchId: Number(matchId), subscription, lastEventCount: 0,
      notifiedKickoff: false, notifiedHT: false, notifiedFT: false },
    { upsert: true, returnDocument: 'after' }
  )
  res.json({ ok: true })
})

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', async (req, res) => {
  const { matchId } = req.body
  if (!matchId) return res.status(400).json({ error: 'matchId required' })
  await PushSubscription.deleteOne({ userId: req.user.uid, matchId: Number(matchId) })
  res.json({ ok: true })
})

// GET /api/notifications/subscribed/:matchId  — check if user is subscribed
router.get('/subscribed/:matchId', async (req, res) => {
  const doc = await PushSubscription.findOne({ userId: req.user.uid, matchId: Number(req.params.matchId) })
  res.json({ subscribed: !!doc })
})

module.exports = router

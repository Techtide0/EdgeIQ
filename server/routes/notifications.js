const router        = require('express').Router()
const webpush       = require('web-push')
const authMiddleware = require('../middleware/authMiddleware')
const PushSubscription       = require('../models/PushSubscription')
const GlobalPushSubscription = require('../models/GlobalPushSubscription')

// Configure VAPID — keys must be in .env
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@edgeiq.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

router.use(authMiddleware)

// Safely convert a matchId value to a positive integer, or return null.
// Number("abc") = NaN, Number("") = 0 — both are invalid.
function parseMatchId(raw) {
  const n = parseInt(String(raw), 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

// ─── VAPID public key ────────────────────────────────────────────────────────

// GET /api/notifications/vapid-public-key
router.get('/vapid-public-key', (_req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' })
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
})

// ─── Per-match subscriptions ─────────────────────────────────────────────────

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res) => {
  const { subscription, matchId } = req.body
  const mid = parseMatchId(matchId)
  if (!subscription || !mid) return res.status(400).json({ error: 'valid subscription and matchId required' })
  // Only store the standard Web Push Subscription fields — never trust arbitrary objects
  if (typeof subscription !== 'object' || !subscription.endpoint || typeof subscription.endpoint !== 'string') {
    return res.status(400).json({ error: 'Invalid push subscription object' })
  }

  await PushSubscription.findOneAndUpdate(
    { userId: req.user.uid, matchId: mid },
    { userId: req.user.uid, matchId: mid, subscription, lastEventCount: 0,
      notifiedPrematch: false, notifiedKickoff: false, notifiedHT: false, notifiedFT: false },
    { upsert: true, returnDocument: 'after' }
  )
  res.json({ ok: true })
})

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', async (req, res) => {
  const mid = parseMatchId(req.body.matchId)
  if (!mid) return res.status(400).json({ error: 'valid matchId required' })
  await PushSubscription.deleteOne({ userId: req.user.uid, matchId: mid })
  res.json({ ok: true })
})

// GET /api/notifications/subscribed/:matchId
router.get('/subscribed/:matchId', async (req, res) => {
  const mid = parseMatchId(req.params.matchId)
  if (!mid) return res.json({ subscribed: false })
  const doc = await PushSubscription.findOne({ userId: req.user.uid, matchId: mid })
  res.json({ subscribed: !!doc })
})

// ─── Global (AI insight) subscriptions ──────────────────────────────────────

// POST /api/notifications/global-subscribe
// Registers the device for app-wide AI insight & odds alerts.
router.post('/global-subscribe', async (req, res) => {
  const { subscription } = req.body
  if (!subscription) return res.status(400).json({ error: 'subscription required' })

  await GlobalPushSubscription.findOneAndUpdate(
    { userId: req.user.uid },
    { userId: req.user.uid, subscription },
    { upsert: true, returnDocument: 'after' }
  )
  res.json({ ok: true })
})

// POST /api/notifications/global-unsubscribe
router.post('/global-unsubscribe', async (req, res) => {
  await GlobalPushSubscription.deleteOne({ userId: req.user.uid })
  res.json({ ok: true })
})

// GET /api/notifications/global-subscribed
router.get('/global-subscribed', async (req, res) => {
  const doc = await GlobalPushSubscription.findOne({ userId: req.user.uid })
  res.json({ subscribed: !!doc })
})

module.exports = router

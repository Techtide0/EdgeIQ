const cron    = require('node-cron')
const webpush = require('web-push')
const { getLastKnown }           = require('../services/liveMatches')
const { getUpcomingMatches }     = require('../services/upcomingMatches')
const { precomputeInsights }     = require('../services/analysis')
const Analysis                   = require('../models/Analysis')
const GlobalPushSubscription     = require('../models/GlobalPushSubscription')

const HIGH_CONFIDENCE_THRESHOLD = 75  // % — notify users when we're this confident

// ── VAPID — configure once; reuses the same keys as notificationJob ────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@edgeiq.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await GlobalPushSubscription.deleteOne({ 'subscription.endpoint': subscription.endpoint })
        .catch(() => {})
    }
  }
}

// ── AI Insight alert dispatcher ────────────────────────────────────────────────
// Called after precomputeInsights so we only alert on freshly computed docs.
async function dispatchInsightAlerts(matchIds) {
  if (!process.env.VAPID_PUBLIC_KEY) return

  // Find newly computed insights that meet the confidence threshold
  const highConf = await Analysis.find({
    matchId:    { $in: matchIds.map(String) },
    confidence: { $gte: HIGH_CONFIDENCE_THRESHOLD },
  }).lean()

  if (!highConf.length) return

  // Get all global subscribers
  const subscribers = await GlobalPushSubscription.find({}).lean()
  if (!subscribers.length) return

  for (const insight of highConf) {
    const valueTag = insight.valueBet ? ' 💰 Value Bet' : ''
    const payload = {
      title: `🔥 ${insight.confidence}% Confidence Pick${valueTag}`,
      body:  `${insight.teamA} vs ${insight.teamB} — ${insight.prediction}`,
      matchId: insight.matchId,
      type:  'INSIGHT_ALERT',
      sound: 'insight',
    }

    for (const sub of subscribers) {
      await sendPush(sub.subscription, payload)
    }
  }

  console.log(`[insightsCron] Dispatched AI alerts for ${highConf.length} high-confidence matches to ${subscribers.length} subscribers`)
}

// ── Main cron function ─────────────────────────────────────────────────────────

function startInsightsCron() {
  cron.schedule('0 */4 * * *', async () => {
    console.log('[cron] Precomputing AI insights...')
    try {
      const live = getLastKnown() || []
      const { data: upcoming } = await getUpcomingMatches()

      const matches = [...live, ...(upcoming || [])]

      if (matches.length === 0) {
        console.log('[cron] No matches to analyze')
        return
      }

      // Track which matchIds were new (precomputeInsights skips existing ones)
      const existingIds = new Set(
        (await Analysis.find({ matchId: { $in: matches.map(m => String(m.matchId)) } }, 'matchId').lean())
          .map(d => d.matchId)
      )
      const newMatchIds = matches
        .map(m => String(m.matchId))
        .filter(id => !existingIds.has(id))

      await precomputeInsights(matches)
      console.log(`[cron] Insights precomputed for ${matches.length} matches`)

      // Only alert on freshly computed insights (not ones that already existed)
      if (newMatchIds.length) {
        await dispatchInsightAlerts(newMatchIds)
      }
    } catch (err) {
      console.error('[cron] Insight precompute failed:', err.message)
    }
  })

  console.log('[cron] Insights cron scheduled (every 4 hours)')
}

module.exports = startInsightsCron

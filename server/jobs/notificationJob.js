const webpush  = require('web-push')
const cron     = require('node-cron')
const PushSubscription = require('../models/PushSubscription')
const UserProfile      = require('../models/UserProfile')
const { getMatchDetail }  = require('../services/matchDetail')

// ── Per-user preference cache (5-min TTL) ─────────────────────────────────────
const prefCache = new Map()
const PREF_TTL  = 5 * 60 * 1000

async function getUserPrefs(userId) {
  const hit = prefCache.get(userId)
  if (hit && Date.now() - hit.ts < PREF_TTL) return hit.prefs
  const doc   = await UserProfile.findOne({ userId }).lean().catch(() => null)
  const prefs = doc?.notificationPrefs || {}
  prefCache.set(userId, { prefs, ts: Date.now() })
  return prefs
}

function isPrefEnabled(prefs, key) {
  const p = prefs?.[key]
  return p === undefined ? true : p.enabled !== false   // default on
}

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'])

const EVENT_EMOJI = {
  Goal:  '⚽',
  Card:  '🟨',
  subst: '🔄',
  Var:   '🚫',
}

function eventTitle(ev) {
  if (ev.type === 'Goal')   return `${EVENT_EMOJI.Goal} GOAL!`
  if (ev.type === 'Card')   return ev.detail === 'Red Card' ? '🟥 RED CARD' : '🟨 Yellow Card'
  if (ev.type === 'subst')  return '🔄 Substitution'
  return ev.type
}

function eventBody(ev, homeTeam, awayTeam) {
  const team   = ev.team?.name || ''
  const player = ev.player?.name || ''
  const min    = ev.time?.elapsed || ''
  if (ev.type === 'Goal') return `${player} scores for ${team} — ${min}'`
  if (ev.type === 'Card') return `${player} (${team}) — ${min}'`
  if (ev.type === 'subst') return `${ev.assist?.name} → ${player} (${team})`
  return `${player} (${team}) ${min}'`
}

async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — delete it
      await PushSubscription.deleteOne({ 'subscription.endpoint': subscription.endpoint })
    }
    // Other errors are transient — ignore
  }
}

async function processSubscriptions() {
  if (!process.env.VAPID_PUBLIC_KEY) return  // Notifications not configured

  const subs = await PushSubscription.find({})
  if (!subs.length) return

  // Group by matchId to avoid fetching the same match multiple times
  const byMatch = {}
  subs.forEach(s => {
    if (!byMatch[s.matchId]) byMatch[s.matchId] = []
    byMatch[s.matchId].push(s)
  })

  for (const [matchId, matchSubs] of Object.entries(byMatch)) {
    try {
      const match = await getMatchDetail(matchId)
      const events = match.events || []
      const isLive = LIVE_STATUSES.has(match.status)

      for (const sub of matchSubs) {
        const newEvents = events.slice(sub.lastEventCount)
        const prefs     = await getUserPrefs(sub.userId)
        let updated = false

        // Kickoff notification
        if (!sub.notifiedKickoff && isPrefEnabled(prefs, 'kickoff') &&
            (isLive || match.status === '1H') && match.minute <= 2) {
          await sendPush(sub.subscription, {
            title: '🏁 Kick Off!',
            body: `${match.homeTeam.name} vs ${match.awayTeam.name} has started`,
            matchId: match.matchId,
            sound: 'kickoff',
          })
          sub.notifiedKickoff = true
          updated = true
        }

        // New match events
        for (const ev of newEvents) {
          if (ev.type === 'Goal') {
            if (!isPrefEnabled(prefs, 'goals')) continue
            await sendPush(sub.subscription, {
              title: eventTitle(ev),
              body:  eventBody(ev, match.homeTeam, match.awayTeam),
              matchId: match.matchId,
              sound: 'goals',
            })
          } else if (ev.type === 'Card' && ev.detail === 'Red Card') {
            if (!isPrefEnabled(prefs, 'redCards')) continue
            await sendPush(sub.subscription, {
              title: '🟥 RED CARD',
              body:  eventBody(ev, match.homeTeam, match.awayTeam),
              matchId: match.matchId,
              sound: 'redCards',
            })
          } else if (ev.type === 'Var') {
            const isCancelled = ev.detail?.toLowerCase().includes('goal cancelled') ||
                                ev.detail?.toLowerCase().includes('goal disallowed')
            if (!isCancelled || !isPrefEnabled(prefs, 'cancelledGoal')) continue
            await sendPush(sub.subscription, {
              title: '🚫 Goal Cancelled!',
              body:  `VAR overturns goal — ${ev.team?.name || ''} ${ev.time?.elapsed || ''}'`,
              matchId: match.matchId,
              sound: 'cancelledGoal',
            })
          }
        }

        if (newEvents.length) {
          sub.lastEventCount = events.length
          updated = true
        }

        // Half time
        if (!sub.notifiedHT && isPrefEnabled(prefs, 'halfTime') && match.status === 'HT') {
          await sendPush(sub.subscription, {
            title: '⏸ Half Time',
            body: `${match.homeTeam.name} ${match.scoreHome} – ${match.scoreAway} ${match.awayTeam.name}`,
            matchId: match.matchId,
            sound: 'halfTime',
          })
          sub.notifiedHT = true
          updated = true
        }

        // Full time — auto-clean subscription
        if (!sub.notifiedFT && isPrefEnabled(prefs, 'fullTime') && ['FT', 'AET', 'PEN'].includes(match.status)) {
          await sendPush(sub.subscription, {
            title: '🏆 Full Time',
            body: `${match.homeTeam.name} ${match.scoreHome} – ${match.scoreAway} ${match.awayTeam.name}`,
            matchId: match.matchId,
            sound: 'fullTime',
          })
          sub.notifiedFT = true
          updated = true
          // Clean up finished match subscription after 30s
          setTimeout(() => PushSubscription.deleteOne({ _id: sub._id }).catch(() => {}), 30_000)
        }

        if (updated) {
          await PushSubscription.updateOne({ _id: sub._id }, {
            lastEventCount:  sub.lastEventCount,
            notifiedKickoff: sub.notifiedKickoff,
            notifiedHT:      sub.notifiedHT,
            notifiedFT:      sub.notifiedFT,
            lastNotifiedAt:  new Date(),
          })
        }
      }
    } catch {
      // One match failure doesn't block others
    }
  }
}

module.exports = function startNotificationJob() {
  // Run every 30 seconds — only when there are active subscriptions
  cron.schedule('*/30 * * * * *', processSubscriptions)
  console.log('[notificationJob] started — polling every 30s')
}

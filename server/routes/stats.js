const router = require('express').Router()
const authMiddleware = require('../middleware/authMiddleware')
const Bet = require('../models/Bet')

router.use(authMiddleware)

// GET /api/stats — full betting analytics for the authenticated user
router.get('/', async (req, res) => {
  try {
    const bets = await Bet.find({ userId: req.user.uid }).sort({ createdAt: -1 })

    const won     = bets.filter(b => b.status === 'won')
    const lost    = bets.filter(b => b.status === 'lost')
    const cashout = bets.filter(b => b.status === 'cashout')
    const pending = bets.filter(b => b.status === 'pending')

    // Resolved bets sorted newest→oldest
    const resolved = [...won, ...lost, ...cashout].sort(
      (a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt)
    )

    // ── Financials ─────────────────────────────────────────────────────────
    const totalSpent = bets.reduce((s, b) => s + (b.stake || 0), 0)
    const totalWon   = [
      ...won.map(b => b.potentialWin || 0),
      ...cashout.map(b => b.cashoutAmount || 0),
    ].reduce((s, v) => s + v, 0)

    const profit  = totalWon - totalSpent
    const roi     = totalSpent === 0 ? 0 : (profit / totalSpent) * 100
    const winRate = resolved.length === 0 ? 0 : (won.length / resolved.length) * 100
    const avgOdds = bets.length === 0 ? 0
      : bets.reduce((s, b) => s + (b.odds || 0), 0) / bets.length

    // ── Current streak (most recent resolved first) ────────────────────────
    let streakCount = 0, streakType = null
    for (const b of resolved) {
      const type = (b.status === 'won' || b.status === 'cashout') ? 'won' : 'lost'
      if (streakCount === 0) { streakCount = 1; streakType = type; continue }
      if (type === streakType) streakCount++
      else break
    }

    // ── Best ever win streak ──────────────────────────────────────────────
    let bestStreak = 0, cur = 0
    for (const b of resolved.slice().reverse()) {  // oldest → newest
      const isWin = b.status === 'won' || b.status === 'cashout'
      if (isWin) { cur++; if (cur > bestStreak) bestStreak = cur }
      else cur = 0
    }

    // ── Largest single profit ─────────────────────────────────────────────
    const largestWin = won.reduce(
      (max, b) => Math.max(max, (b.potentialWin || 0) - (b.stake || 0)), 0
    )

    // ── Activity: bets per day, last 30 days ──────────────────────────────
    const now = Date.now()
    const activity = Array.from({ length: 30 }, (_, i) => {
      const d       = new Date(now - (29 - i) * 86_400_000)
      const dateStr = d.toISOString().split('T')[0]
      const dayBets = bets.filter(
        b => new Date(b.createdAt).toISOString().split('T')[0] === dateStr
      )
      return {
        date:  dateStr,
        total: dayBets.length,
        won:   dayBets.filter(b => b.status === 'won' || b.status === 'cashout').length,
        lost:  dayBets.filter(b => b.status === 'lost').length,
      }
    })

    // ── Risk profile from average odds ────────────────────────────────────
    let riskProfile = 'balanced'
    if (bets.length >= 3) {
      if (avgOdds < 1.6)    riskProfile = 'conservative'
      else if (avgOdds > 2.5) riskProfile = 'aggressive'
    }

    res.json({
      // Financials
      totalSpent,
      totalWon,
      profit,
      roi:         parseFloat(roi.toFixed(2)),
      largestWin,
      // Counts
      totalBets:   bets.length,
      wonBets:     won.length,
      lostBets:    lost.length,
      cashoutBets: cashout.length,
      pendingBets: pending.length,
      // Performance
      winRate:     parseFloat(winRate.toFixed(1)),
      avgOdds:     parseFloat(avgOdds.toFixed(2)),
      streak:      { count: streakCount, type: streakType },
      bestStreak,
      // Misc
      activity,
      riskProfile,
    })
  } catch (err) {
    console.error('[stats]', err.message)
    res.status(500).json({ error: 'Failed to compute stats' })
  }
})

module.exports = router

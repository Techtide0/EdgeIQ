/**
 * Unit tests for stats calculation logic (mirrors routes/stats.js).
 * Pure functions — no DB, no network.
 */

function calcStats(bets) {
  const won     = bets.filter(b => b.status === 'won')
  const lost    = bets.filter(b => b.status === 'lost')
  const cashout = bets.filter(b => b.status === 'cashout')
  const pending = bets.filter(b => b.status === 'pending')
  const resolved = [...won, ...lost, ...cashout].sort(
    (a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt)
  )
  const totalSpent = bets.reduce((s, b) => s + (b.stake || 0), 0)
  const totalWon   = [
    ...won.map(b => b.potentialWin || 0),
    ...cashout.map(b => b.cashoutAmount || 0),
  ].reduce((s, v) => s + v, 0)
  const profit  = totalWon - totalSpent
  const roi     = totalSpent === 0 ? 0 : (profit / totalSpent) * 100
  const winRate = resolved.length === 0 ? 0 : (won.length / resolved.length) * 100
  const avgOdds = bets.length === 0 ? 0 : bets.reduce((s, b) => s + (b.odds || 0), 0) / bets.length
  let streakCount = 0, streakType = null
  for (const b of resolved) {
    const type = (b.status === 'won' || b.status === 'cashout') ? 'won' : 'lost'
    if (streakCount === 0) { streakCount = 1; streakType = type; continue }
    if (type === streakType) streakCount++
    else break
  }
  let bestStreak = 0, cur = 0
  for (const b of resolved.slice().reverse()) {
    const isWin = b.status === 'won' || b.status === 'cashout'
    if (isWin) { cur++; if (cur > bestStreak) bestStreak = cur }
    else cur = 0
  }
  const largestWin = won.reduce((max, b) => Math.max(max, (b.potentialWin || 0) - (b.stake || 0)), 0)
  return {
    totalSpent, totalWon, profit,
    roi:     parseFloat(roi.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    avgOdds: parseFloat(avgOdds.toFixed(2)),
    streak:  { count: streakCount, type: streakType },
    bestStreak, largestWin,
    totalBets: bets.length, wonBets: won.length,
    lostBets: lost.length, cashoutBets: cashout.length, pendingBets: pending.length,
  }
}

function bet(status, stake, odds, extra = {}) {
  return { status, stake, odds, potentialWin: stake * odds, cashoutAmount: null,
    resolvedAt: status !== 'pending' ? new Date('2025-01-01') : null,
    createdAt: new Date('2025-01-01'), ...extra }
}

describe('Win rate', () => {
  test('6W 4L = 60%', () => {
    const bets = [...Array(6).fill(null).map(() => bet('won', 10, 2)), ...Array(4).fill(null).map(() => bet('lost', 10, 2))]
    expect(calcStats(bets).winRate).toBe(60.0)
  })
  test('all wins = 100%', () => expect(calcStats(Array(5).fill(null).map(() => bet('won', 10, 2))).winRate).toBe(100.0))
  test('all losses = 0%', () => expect(calcStats(Array(5).fill(null).map(() => bet('lost', 10, 2))).winRate).toBe(0.0))
  test('pending excluded from denominator', () => {
    expect(calcStats([bet('won', 10, 2), bet('pending', 10, 2)]).winRate).toBe(100.0)
  })
  test('cashout in resolved denominator but NOT in win numerator → 33.3%', () => {
    expect(calcStats([bet('won', 10, 2), bet('cashout', 10, 2, { cashoutAmount: 15 }), bet('lost', 10, 2)]).winRate).toBeCloseTo(33.3, 0)
  })
  test('no resolved bets = 0 (no divide by zero)', () => {
    expect(calcStats([bet('pending', 10, 2)]).winRate).toBe(0)
  })
})

describe('Profit & ROI', () => {
  test('win: spent 100, won 200 → profit = +100', () => {
    const s = calcStats([bet('won', 100, 2.0)])
    expect(s.totalSpent).toBe(100); expect(s.totalWon).toBe(200); expect(s.profit).toBe(100)
  })
  test('loss: spent 50 → profit = -50', () => expect(calcStats([bet('lost', 50, 2)]).profit).toBe(-50))
  test('ROI = 0 when profit = 0', () => {
    expect(calcStats([bet('won', 100, 2), bet('lost', 100, 2)]).roi).toBe(0.0)
  })
  test('ROI = 0 with no bets', () => expect(calcStats([]).roi).toBe(0))
  test('cashout uses cashoutAmount not potentialWin', () => {
    const s = calcStats([bet('cashout', 10, 5.0, { cashoutAmount: 20 })])
    expect(s.totalWon).toBe(20); expect(s.profit).toBe(10)
  })
})

describe('Streaks', () => {
  test('3 wins in a row → { count: 3, type: "won" }', () => {
    const bets = [
      bet('won', 10, 2, { resolvedAt: new Date('2025-01-03') }),
      bet('won', 10, 2, { resolvedAt: new Date('2025-01-02') }),
      bet('won', 10, 2, { resolvedAt: new Date('2025-01-01') }),
    ]
    expect(calcStats(bets).streak).toEqual({ count: 3, type: 'won' })
  })
  test('streak breaks on loss', () => {
    const bets = [
      bet('lost', 10, 2, { resolvedAt: new Date('2025-01-03') }),
      bet('won',  10, 2, { resolvedAt: new Date('2025-01-02') }),
    ]
    expect(calcStats(bets).streak).toEqual({ count: 1, type: 'lost' })
  })
  test('WWLWWW → bestStreak = 3', () => {
    const bets = [
      bet('won',  10, 2, { resolvedAt: new Date('2025-01-06') }),
      bet('won',  10, 2, { resolvedAt: new Date('2025-01-05') }),
      bet('won',  10, 2, { resolvedAt: new Date('2025-01-04') }),
      bet('lost', 10, 2, { resolvedAt: new Date('2025-01-03') }),
      bet('won',  10, 2, { resolvedAt: new Date('2025-01-02') }),
      bet('won',  10, 2, { resolvedAt: new Date('2025-01-01') }),
    ]
    expect(calcStats(bets).bestStreak).toBe(3)
  })
  test('all losses → bestStreak = 0', () => {
    expect(calcStats(Array(5).fill(null).map(() => bet('lost', 10, 2))).bestStreak).toBe(0)
  })
})

describe('Average odds & largest win', () => {
  test('correctly averages odds', () => {
    expect(calcStats([bet('won', 10, 1.5), bet('lost', 10, 2.5), bet('won', 10, 3.0)]).avgOdds).toBeCloseTo(2.33, 1)
  })
  test('no bets → avgOdds = 0', () => expect(calcStats([]).avgOdds).toBe(0))
  test('largestWin picks biggest net profit', () => {
    const bets = [bet('won', 10, 3.0), bet('won', 50, 2.0), bet('won', 100, 1.5)]
    expect(calcStats(bets).largestWin).toBe(50)
  })
})

jest.mock('../../config/firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockImplementation((token) => {
      if (token === 'token-user-a') return Promise.resolve({ uid: 'user-a', email: 'a@test.com' })
      if (token === 'token-user-b') return Promise.resolve({ uid: 'user-b', email: 'b@test.com' })
      return Promise.reject(new Error('Invalid token'))
    }),
  }),
}))

const request  = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const app = require('../../app')
const Bet = require('../../models/Bet')

let mongod
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()) }, 600000)
afterAll(async () => { await mongoose.disconnect(); await mongod.stop() })
afterEach(async () => { await Bet.deleteMany({}) })

const authA = { Authorization: 'Bearer token-user-a' }
const authB = { Authorization: 'Bearer token-user-b' }

async function seedBets(bets) {
  return Bet.insertMany(bets)
}

function makeBet(userId, overrides = {}) {
  return {
    userId,
    stake: 10,
    odds: 2.0,
    potentialWin: 20,
    status: 'pending',
    cashoutAmount: null,
    createdAt: new Date(),
    resolvedAt: null,
    ...overrides,
  }
}

describe('GET /api/stats — no bets', () => {
  test('empty stats for new user', async () => {
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.status).toBe(200)
    expect(res.body.totalBets).toBe(0)
    expect(res.body.totalSpent).toBe(0)
    expect(res.body.profit).toBe(0)
    expect(res.body.roi).toBe(0)
    expect(res.body.winRate).toBe(0)
    expect(res.body.avgOdds).toBe(0)
    expect(res.body.streak).toEqual({ count: 0, type: null })
    expect(res.body.bestStreak).toBe(0)
    expect(res.body.activity).toHaveLength(30)
  })
})

describe('GET /api/stats — win rate', () => {
  test('6W 4L = 60% winRate', async () => {
    const now = new Date()
    const bets = [
      ...Array(6).fill(null).map(() => makeBet('user-a', { status: 'won',  potentialWin: 20, resolvedAt: now })),
      ...Array(4).fill(null).map(() => makeBet('user-a', { status: 'lost', potentialWin: 20, resolvedAt: now })),
    ]
    await seedBets(bets)
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.status).toBe(200)
    expect(res.body.winRate).toBe(60.0)
    expect(res.body.wonBets).toBe(6)
    expect(res.body.lostBets).toBe(4)
    expect(res.body.totalBets).toBe(10)
  })

  test('pending bets excluded from win rate denominator', async () => {
    await seedBets([
      makeBet('user-a', { status: 'won',     potentialWin: 20, resolvedAt: new Date() }),
      makeBet('user-a', { status: 'pending', potentialWin: 20 }),
    ])
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.winRate).toBe(100.0)
    expect(res.body.pendingBets).toBe(1)
  })
})

describe('GET /api/stats — financials', () => {
  test('profit and ROI correct for mix of wins and losses', async () => {
    // 2 wins: stake 10 × odds 2.0 = potentialWin 20 each → totalWon = 40
    // 2 losses: stake 10 each
    // totalSpent = 40, totalWon = 40, profit = 0, roi = 0
    await seedBets([
      makeBet('user-a', { status: 'won',  stake: 10, odds: 2.0, potentialWin: 20, resolvedAt: new Date() }),
      makeBet('user-a', { status: 'won',  stake: 10, odds: 2.0, potentialWin: 20, resolvedAt: new Date() }),
      makeBet('user-a', { status: 'lost', stake: 10, odds: 2.0, potentialWin: 20, resolvedAt: new Date() }),
      makeBet('user-a', { status: 'lost', stake: 10, odds: 2.0, potentialWin: 20, resolvedAt: new Date() }),
    ])
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.totalSpent).toBe(40)
    expect(res.body.totalWon).toBe(40)
    expect(res.body.profit).toBe(0)
    expect(res.body.roi).toBe(0.0)
  })

  test('positive profit: 1 win at 3.0 odds, stake 20 → profit = 40', async () => {
    await seedBets([makeBet('user-a', { status: 'won', stake: 20, odds: 3.0, potentialWin: 60, resolvedAt: new Date() })])
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.totalSpent).toBe(20)
    expect(res.body.totalWon).toBe(60)
    expect(res.body.profit).toBe(40)
    expect(res.body.roi).toBe(200.0)
  })

  test('cashout uses cashoutAmount not potentialWin', async () => {
    await seedBets([makeBet('user-a', { status: 'cashout', stake: 10, odds: 5.0, potentialWin: 50, cashoutAmount: 25, resolvedAt: new Date() })])
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.totalWon).toBe(25)
    expect(res.body.profit).toBe(15)   // 25 - 10
    expect(res.body.cashoutBets).toBe(1)
  })
})

describe('GET /api/stats — streak', () => {
  test('3 consecutive wins → streak { count: 3, type: "won" }', async () => {
    await seedBets([
      makeBet('user-a', { status: 'won', resolvedAt: new Date('2025-01-03') }),
      makeBet('user-a', { status: 'won', resolvedAt: new Date('2025-01-02') }),
      makeBet('user-a', { status: 'won', resolvedAt: new Date('2025-01-01') }),
    ])
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.streak).toEqual({ count: 3, type: 'won' })
  })

  test('streak breaks on loss → only 1-loss streak', async () => {
    await seedBets([
      makeBet('user-a', { status: 'lost', resolvedAt: new Date('2025-01-03') }),
      makeBet('user-a', { status: 'won',  resolvedAt: new Date('2025-01-02') }),
      makeBet('user-a', { status: 'won',  resolvedAt: new Date('2025-01-01') }),
    ])
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.streak).toEqual({ count: 1, type: 'lost' })
  })

  test('WWLWWW bestStreak = 3', async () => {
    await seedBets([
      makeBet('user-a', { status: 'won',  resolvedAt: new Date('2025-01-06') }),
      makeBet('user-a', { status: 'won',  resolvedAt: new Date('2025-01-05') }),
      makeBet('user-a', { status: 'won',  resolvedAt: new Date('2025-01-04') }),
      makeBet('user-a', { status: 'lost', resolvedAt: new Date('2025-01-03') }),
      makeBet('user-a', { status: 'won',  resolvedAt: new Date('2025-01-02') }),
      makeBet('user-a', { status: 'won',  resolvedAt: new Date('2025-01-01') }),
    ])
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.bestStreak).toBe(3)
  })
})

describe('GET /api/stats — avgOdds & riskProfile', () => {
  test('correctly averages odds', async () => {
    await seedBets([
      makeBet('user-a', { odds: 1.5, potentialWin: 15 }),
      makeBet('user-a', { odds: 2.5, potentialWin: 25 }),
      makeBet('user-a', { odds: 3.0, potentialWin: 30 }),
    ])
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.avgOdds).toBeCloseTo(2.33, 1)
  })

  test('avgOdds < 1.6 with ≥3 bets → conservative', async () => {
    await seedBets(Array(3).fill(null).map(() => makeBet('user-a', { odds: 1.4, potentialWin: 14 })))
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.riskProfile).toBe('conservative')
  })

  test('avgOdds > 2.5 with ≥3 bets → aggressive', async () => {
    await seedBets(Array(3).fill(null).map(() => makeBet('user-a', { odds: 3.0, potentialWin: 30 })))
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.riskProfile).toBe('aggressive')
  })

  test('< 3 bets → balanced regardless of odds', async () => {
    await seedBets([makeBet('user-a', { odds: 5.0, potentialWin: 50 })])
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.riskProfile).toBe('balanced')
  })
})

describe('GET /api/stats — activity chart', () => {
  test('always returns exactly 30 entries', async () => {
    const res = await request(app).get('/api/stats').set(authA)
    expect(res.body.activity).toHaveLength(30)
    res.body.activity.forEach(entry => {
      expect(entry).toHaveProperty('date')
      expect(entry).toHaveProperty('total')
      expect(entry).toHaveProperty('won')
      expect(entry).toHaveProperty('lost')
    })
  })

  test('today\'s bet appears in activity', async () => {
    await seedBets([makeBet('user-a', { status: 'won', potentialWin: 20, resolvedAt: new Date() })])
    const res = await request(app).get('/api/stats').set(authA)
    const today = new Date().toISOString().split('T')[0]
    const todayEntry = res.body.activity.find(e => e.date === today)
    expect(todayEntry).toBeDefined()
    expect(todayEntry.total).toBe(1)
  })
})

describe('GET /api/stats — data isolation', () => {
  test('user A stats unaffected by user B bets', async () => {
    await seedBets([
      makeBet('user-a', { status: 'won', potentialWin: 20, resolvedAt: new Date() }),
      makeBet('user-b', { status: 'won', stake: 100, odds: 5.0, potentialWin: 500, resolvedAt: new Date() }),
      makeBet('user-b', { status: 'won', stake: 100, odds: 5.0, potentialWin: 500, resolvedAt: new Date() }),
    ])
    const resA = await request(app).get('/api/stats').set(authA)
    expect(resA.body.totalBets).toBe(1)
    expect(resA.body.totalSpent).toBe(10)

    const resB = await request(app).get('/api/stats').set(authB)
    expect(resB.body.totalBets).toBe(2)
    expect(resB.body.totalSpent).toBe(200)
  })
})

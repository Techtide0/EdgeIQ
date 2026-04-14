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
const post  = (body) => request(app).post('/api/bets').set(authA).send(body)

describe('POST /api/bets — create', () => {
  test('valid bet → 201 with server-calculated potentialWin', async () => {
    const res = await post({ stake: 20, odds: 3.0 })
    expect(res.status).toBe(201)
    expect(res.body.potentialWin).toBe(60)   // 20 × 3.0, not whatever client sends
    expect(res.body.userId).toBe('user-a')
    expect(res.body.status).toBe('pending')
  })
  test('client cannot override potentialWin', async () => {
    const res = await post({ stake: 10, odds: 2.0, potentialWin: 9999 })
    expect(res.status).toBe(201)
    expect(res.body.potentialWin).toBe(20)   // server recalculates, ignores 9999
  })
  test('missing stake → 400',   async () => expect((await post({ odds: 2 })).status).toBe(400))
  test('missing odds → 400',    async () => expect((await post({ stake: 10 })).status).toBe(400))
  test('stake = 0 → 400',       async () => expect((await post({ stake: 0, odds: 2 })).status).toBe(400))
  test('negative odds → 400',   async () => expect((await post({ stake: 10, odds: -1 })).status).toBe(400))
})

describe('GET /api/bets — fetch', () => {
  test('returns only own bets', async () => {
    await post({ stake: 10, odds: 2 })
    await post({ stake: 20, odds: 3 })
    await request(app).post('/api/bets').set(authB).send({ stake: 5, odds: 1.5 })
    const res = await request(app).get('/api/bets').set(authA)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    res.body.forEach(b => expect(b.userId).toBe('user-a'))
  })
  test('empty when no bets', async () => {
    const res = await request(app).get('/api/bets').set(authA)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('PUT /api/bets/:id — update', () => {
  test('can mark won; resolvedAt is set', async () => {
    const { body: created } = await post({ stake: 10, odds: 2 })
    const res = await request(app).put(`/api/bets/${created._id}`).set(authA).send({ status: 'won' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('won')
    expect(res.body.resolvedAt).not.toBeNull()
  })
  test('recalculates potentialWin when stake changes', async () => {
    const { body: created } = await post({ stake: 10, odds: 2 })
    const res = await request(app).put(`/api/bets/${created._id}`).set(authA).send({ stake: 50 })
    expect(res.body.potentialWin).toBe(100)   // 50 × 2.0
  })
  test('cashout requires cashoutAmount > 0', async () => {
    const { body: created } = await post({ stake: 10, odds: 3 })
    const res = await request(app).put(`/api/bets/${created._id}`).set(authA).send({ status: 'cashout', cashoutAmount: 0 })
    expect(res.status).toBe(400)
  })
  test('cashout cannot exceed potentialWin', async () => {
    const { body: created } = await post({ stake: 10, odds: 2 })  // potentialWin = 20
    const res = await request(app).put(`/api/bets/${created._id}`).set(authA).send({ status: 'cashout', cashoutAmount: 999 })
    expect(res.status).toBe(400)
  })
  test('malformed ObjectId → 400 (not 500)', async () => {
    const res = await request(app).put('/api/bets/not-a-real-id').set(authA).send({ status: 'won' })
    expect(res.status).toBe(400)
  })
  test('user B cannot update user A bet → 404', async () => {
    const { body: created } = await post({ stake: 10, odds: 2 })
    const res = await request(app).put(`/api/bets/${created._id}`).set(authB).send({ status: 'won' })
    expect(res.status).toBe(404)
  })
  test('non-existent bet → 404', async () => {
    const fakeId = new mongoose.Types.ObjectId()
    expect((await request(app).put(`/api/bets/${fakeId}`).set(authA).send({ status: 'won' })).status).toBe(404)
  })
})

describe('DELETE /api/bets/:id', () => {
  test('owner can delete their bet', async () => {
    const { body: created } = await post({ stake: 10, odds: 2 })
    const res = await request(app).delete(`/api/bets/${created._id}`).set(authA)
    expect(res.status).toBe(200)
    expect(await Bet.findById(created._id)).toBeNull()
  })
  test('user B cannot delete user A bet → 404; bet still exists', async () => {
    const { body: created } = await post({ stake: 10, odds: 2 })
    expect((await request(app).delete(`/api/bets/${created._id}`).set(authB)).status).toBe(404)
    expect(await Bet.findById(created._id)).not.toBeNull()
  })
  test('malformed ObjectId → 400', async () => {
    expect((await request(app).delete('/api/bets/not-an-id').set(authA)).status).toBe(400)
  })
})

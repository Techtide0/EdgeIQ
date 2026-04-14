jest.mock('../../config/firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockImplementation((token) => {
      if (token === 'valid-token')
        return Promise.resolve({ uid: 'user-123', email: 'user@test.com' })
      return Promise.reject(new Error('Firebase: invalid token'))
    }),
  }),
}))

const request  = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const app = require('../../app')

let mongod

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
}, 600000)

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('No token', () => {
  test('GET /api/me → 401', async () => {
    const res = await request(app).get('/api/me')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('No token provided')
  })
  test('wrong scheme → 401', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Basic abc')
    expect(res.status).toBe(401)
  })
  test('invalid token → 401', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer bad-token')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid or expired token')
  })
})

describe('Valid token', () => {
  test('GET /api/me → 200 with uid', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer valid-token')
    expect(res.status).toBe(200)
    expect(res.body.uid).toBe('user-123')
  })
})

describe('Protected routes enforce auth', () => {
  test('GET /api/bets without token → 401',  async () => expect((await request(app).get('/api/bets')).status).toBe(401))
  test('GET /api/stats without token → 401', async () => expect((await request(app).get('/api/stats')).status).toBe(401))
  test('POST /api/bets without token → 401', async () => {
    expect((await request(app).post('/api/bets').send({ stake: 10, odds: 2 })).status).toBe(401)
  })
})

describe('Health check', () => {
  test('GET /health → 200', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

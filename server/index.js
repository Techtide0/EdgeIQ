require('dotenv').config()
require('./config/firebase')   // initialise Firebase Admin

const express   = require('express')
const cors      = require('cors')
const rateLimit = require('express-rate-limit')
const { connectWithRetry } = require('./config/db')

const app = express()

// ─── Security headers ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})

// ─── CORS — only allow your own frontend origin ───────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.CLIENT_ORIGIN,   // set in production .env
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server / curl requests (no origin) in dev
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

app.use(express.json({ limit: '50kb' }))   // prevent large body attacks

// ─── Rate limiting ────────────────────────────────────────────────────────────
// General API limit — 120 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

app.use('/api/', apiLimiter)

// ─── Health check — no auth required ─────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ─── Routes ───────────────────────────────────────────────────────────────────
const authMiddleware = require('./middleware/authMiddleware')
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email })
})

app.use('/api/bets',          require('./routes/bets'))
app.use('/api/stats',         require('./routes/stats'))
app.use('/api/profile',       require('./routes/profile'))
app.use('/api/matches',       require('./routes/matches'))
app.use('/api/notifications', require('./routes/notifications'))

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
const mongoose = require('mongoose')

// Start HTTP server immediately — don't wait for DB
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

// Connect to MongoDB with retry; start cron jobs once connected
connectWithRetry()
mongoose.connection.once('open', () => {
  console.log('[DB] Connected — starting background services')
  require('./services/teamLogos').initTeamLogos()
  require('./jobs/insightsCron')()
  require('./jobs/notificationJob')()
})

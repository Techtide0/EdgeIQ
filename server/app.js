/**
 * Express app — exported separately from index.js so tests can import it
 * without starting the HTTP server or connecting to MongoDB/Firebase.
 *
 * Security measures applied here:
 *  - trust proxy (fixes rate-limiting behind Nginx / cloud load-balancers)
 *  - helmet (comprehensive HTTP security headers)
 *  - CORS whitelist
 *  - JSON body-size limit
 *  - per-IP rate limiting
 *  - global JSON error handler (prevents stack-trace leakage)
 */

const express        = require('express')
const cors           = require('cors')
const rateLimit      = require('express-rate-limit')
const authMiddleware = require('./middleware/authMiddleware')

const app = express()

// ─── Trust proxy ──────────────────────────────────────────────────────────────
// Required so express-rate-limit sees real client IPs, not the proxy IP,
// when deployed behind Nginx, Render, Railway, Fly.io, Heroku etc.
app.set('trust proxy', 1)

// ─── HTTP security headers ────────────────────────────────────────────────────
// Try to use helmet if installed; fall back to manual headers if not.
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  const helmet = require('helmet')
  app.use(helmet({
    // Allow Firebase Storage images and your own frontend origin in CSP
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'"],   // Vite dev needs this
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", 'data:', 'https://firebasestorage.googleapis.com', 'https://media.api-sports.io'],
        connectSrc:  ["'self'", 'https://*.firebaseapp.com', 'https://*.googleapis.com'],
        fontSrc:     ["'self'"],
        objectSrc:   ["'none'"],
        frameSrc:    ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }))
} catch {
  // helmet not installed yet — fall back to manual headers
  // Run: npm install helmet   to enable full protection
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options',    'nosniff')
    res.setHeader('X-Frame-Options',           'DENY')
    res.setHeader('X-XSS-Protection',          '1; mode=block')
    res.setHeader('Referrer-Policy',           'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy',        'camera=(), microphone=(), geolocation=()')
    // Force HTTPS in production
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }
    next()
  })
}

// ─── CORS — only allow your own frontend origin ───────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.CLIENT_ORIGIN,
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server / curl requests (no origin header) in dev only
    if (!origin) {
      if (process.env.NODE_ENV === 'production') return cb(new Error('Origin required in production'))
      return cb(null, true)
    }
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

app.use(express.json({ limit: '50kb' }))

// ─── Rate limiting ────────────────────────────────────────────────────────────
// 120 requests per minute per REAL IP (trust proxy must be set above)
const apiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             120,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many requests, please try again later.' },
  // keyGenerator uses req.ip which respects trust proxy
})
app.use('/api/', apiLimiter)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ─── Identity endpoint ────────────────────────────────────────────────────────
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email })
})

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/bets',          require('./routes/bets'))
app.use('/api/stats',         require('./routes/stats'))
app.use('/api/profile',       require('./routes/profile'))
app.use('/api/matches',       require('./routes/matches'))
app.use('/api/notifications', require('./routes/notifications'))

// ─── Global error handler (MUST be last, after all routes) ────────────────────
// Catches any thrown error or rejected promise from route handlers.
// Returns clean JSON — never leaks stack traces to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log internally (swap for a proper logger like winston in prod)
  console.error(`[error] ${req.method} ${req.path} —`, err.message)

  const status  = err.status || err.statusCode || 500
  // In production: hide internal details. In dev: show the message.
  const message = process.env.NODE_ENV === 'production'
    ? (status < 500 ? err.message : 'Internal server error')
    : err.message

  res.status(status).json({ error: message })
})

module.exports = app

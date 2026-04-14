require('dotenv').config()

// Enforce production mode — prevents stack traces leaking in error responses
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production'

require('./config/firebase')   // initialise Firebase Admin

const { connectWithRetry } = require('./config/db')
const app      = require('./app')
const mongoose = require('mongoose')

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000

app.listen(PORT, () => console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`))

// Connect to MongoDB with retry; start cron jobs once connected
connectWithRetry()
mongoose.connection.once('open', () => {
  console.log('[DB] Connected — starting background services')
  require('./services/teamLogos').initTeamLogos()
  require('./jobs/insightsCron')()
  require('./jobs/notificationJob')()
})

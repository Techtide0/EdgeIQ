const mongoose = require('mongoose')

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })
  console.log(`MongoDB connected: ${mongoose.connection.host}`)
}

// Retry loop — keeps trying every 15s if Atlas is unreachable
async function connectWithRetry(attempt = 1) {
  try {
    await connectDB()
  } catch (err) {
    console.error(`[DB] Connection failed (attempt ${attempt}): ${err.message}`)
    console.error('[DB] Retrying in 15s… (check MongoDB Atlas → Network Access → allow 0.0.0.0/0)')
    setTimeout(() => connectWithRetry(attempt + 1), 15_000)
  }
}

module.exports = { connectDB, connectWithRetry }

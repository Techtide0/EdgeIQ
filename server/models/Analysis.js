const { Schema, model } = require('mongoose')

const MarketSchema = new Schema({
  pick:       String,
  confidence: Number,
}, { _id: false })

const AnalysisSchema = new Schema({
  matchId:    { type: String, required: true, unique: true },
  teamA:      { type: String, required: true },
  teamB:      { type: String, required: true },
  league:     { type: String, required: true },

  prediction: { type: String, required: true },   // top market pick
  confidence: { type: Number, required: true },   // 0–100

  reasoning:  [String],

  // ── Probabilities (Poisson-based) ────────────────────────────────────────
  outcome:       Schema.Types.Mixed,   // { home, draw, away } as 0–100 integers
  goalProbs:     Schema.Types.Mixed,   // { over15, over25, over35 } as 0–100 integers
  bttsProb:      Number,               // 0–100
  firstHalfGoal: Number,              // 0–100 (over 0.5 in 1H)
  scoreRange:    Schema.Types.Mixed,   // { low, medium, high, pick }

  // ── Head-to-Head ────────────────────────────────────────────────────────
  h2h:        Schema.Types.Mixed,      // { matchCount, avgGoals, over25Rate, bttsRate, avgCards, teamAWins, teamBWins, draws, pattern }

  // ── Team form & strength ─────────────────────────────────────────────────
  form:     Schema.Types.Mixed,        // { teamA, teamB, teamAName, teamBName }
  strength: Schema.Types.Mixed,        // { teamA: { homeWinRate, avgGoals, avgConceded, csRate }, teamB: { awayWinRate, ... } }

  // ── First half winner ────────────────────────────────────────────────────
  firstHalfWinner: Schema.Types.Mixed, // { home, draw, away } as 0–100 integers

  // ── Value / risk signals ─────────────────────────────────────────────────
  valueBet:   Schema.Types.Mixed,      // { market, description } | null
  upsetAlert: Schema.Types.Mixed,      // { description } | null
  risk:       String,                  // 'low' | 'medium' | 'high'

  markets: {
    result:       MarketSchema,
    doubleChance: MarketSchema,
    goals:        MarketSchema,
    btts:         MarketSchema,
    cards:        MarketSchema,
    cleanSheet:   MarketSchema,
    corners:      MarketSchema,
  },

  generatedAt: { type: Date, default: Date.now },
  expiresAt:   { type: Date, expires: 0 },
})

module.exports = model('Analysis', AnalysisSchema)

const fetch                    = require('node-fetch')
const Analysis                 = require('../models/Analysis')
const H2HCache                 = require('../models/H2HCache')
const { fetchAndCacheTeamStats } = require('./teamStats')

// In-memory league table cache — shared across all matches in a cron run
const tableCache = new Map()
const TABLE_CACHE_MS  = 6 * 60 * 60 * 1000
const INSIGHT_TTL_MS  = 12 * 60 * 60 * 1000

// Maps API-Football league name → football98 RapidAPI slug (for league table lookup)
const LEAGUE_SLUG_MAP = {
  'Premier League':              'premierleague',
  'Championship':                'championship',
  'La Liga':                     'laliga',
  'Serie A':                     'seriea',
  'Bundesliga':                  'bundesliga',
  'Ligue 1':                     'ligue1',
  'Eredivisie':                  'eredivisie',
  'Süper Lig':                   'superlig',
  'Major League Soccer':         'mls',
  'Saudi Pro League':            'saudi-professional-league',
}

// ─── API HEADERS ──────────────────────────────────────────────────────────────

function apiHeaders() {
  const isRapidAPI = process.env.APIFOOTBALL_HOST?.includes('rapidapi.com')
  return isRapidAPI
    ? { 'x-rapidapi-key': process.env.APIFOOTBALL_KEY, 'x-rapidapi-host': process.env.APIFOOTBALL_HOST }
    : { 'x-apisports-key': process.env.APIFOOTBALL_KEY }
}

// ─── FOOTBALL98 LEAGUE TABLE ──────────────────────────────────────────────────

async function fetchLeagueTable(leagueSlug) {
  const cached = tableCache.get(leagueSlug)
  if (cached && Date.now() - cached.fetchedAt < TABLE_CACHE_MS) return cached.table

  try {
    const res = await fetch(
      `https://${process.env.FOOTBALL98_HOST}/${leagueSlug}/table`,
      {
        headers: {
          'x-rapidapi-key':  process.env.FOOTBALL98_KEY,
          'x-rapidapi-host': process.env.FOOTBALL98_HOST,
          'Content-Type':    'application/json',
        },
      }
    )
    if (!res.ok) throw new Error(`football98 error: ${res.status}`)
    const table = await res.json()
    tableCache.set(leagueSlug, { table, fetchedAt: Date.now() })
    return table
  } catch (err) {
    console.warn('[analysis] league table unavailable:', err.message)
    return []
  }
}

const FALLBACK_TABLE_ROW = { pos: 10, pts: 30, p: 20, w: 8, gf: 20, ga: 20 }

function findTeam(table, teamName) {
  if (!Array.isArray(table) || !table.length) return FALLBACK_TABLE_ROW
  const keyword = teamName.split(' ')[0].toLowerCase()
  return table.find(row =>
    row.squadname?.toLowerCase().includes(keyword) ||
    row.team?.toLowerCase().includes(keyword)
  ) || FALLBACK_TABLE_ROW
}

function extractTableStats(row) {
  return {
    pos: row.pos ?? row.position ?? row.rank ?? 10,
    pts: row.pts ?? row.points   ?? 0,
    p:   row.p   ?? row.played   ?? row.gp   ?? 1,
    w:   row.w   ?? row.won      ?? row.wins  ?? 0,
    gf:  row.gf  ?? row.goalsFor ?? row.scored    ?? 0,
    ga:  row.ga  ?? row.goalsAgainst ?? row.conceded ?? 0,
  }
}

// ─── FORM HELPERS ─────────────────────────────────────────────────────────────

function formWins(form) {
  if (!form) return 0
  return [...form].filter(c => c === 'W').length
}

function formPoints(form) {
  if (!form) return 0
  return [...form].reduce((acc, c) => acc + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0)
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

// ─── MATH / PROBABILITY HELPERS ───────────────────────────────────────────────

// Poisson probability P(X = k) where X ~ Poisson(lambda)
function poissonProb(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let p = Math.exp(-lambda)
  for (let i = 0; i < k; i++) p *= lambda / (i + 1)
  return p
}

// P(X > threshold) — e.g. overProb(lambda, 2) = P(goals >= 3) = P(over 2.5)
function overProb(lambda, threshold) {
  let cumP = 0
  for (let k = 0; k <= threshold; k++) cumP += poissonProb(lambda, k)
  return Math.round(Math.max(0, Math.min(1, 1 - cumP)) * 100)
}

// Convert a raw score (positive = home favoured) to home/draw/away %
function scoreToOutcome(totalScore) {
  const x       = totalScore / 18   // normalize: ±18 → ±1
  const rawHome = 1 / (1 + Math.exp(-x * 1.5))
  const rawAway = 1 / (1 + Math.exp(x  * 1.5))
  const drawPk  = Math.exp(-(x * x) * 2.5) * 0.30
  const total   = rawHome + rawAway + drawPk
  const home    = Math.round(rawHome / total * 100)
  const away    = Math.round(rawAway / total * 100)
  return { home, draw: Math.max(0, 100 - home - away), away }
}

// ─── HEAD-TO-HEAD CACHE ───────────────────────────────────────────────────────

async function fetchH2H(teamAId, teamBId) {
  const ids      = [Number(teamAId), Number(teamBId)].sort((a, b) => a - b)
  const teamPair = ids.join('-')

  try {
    const cached = await H2HCache.findOne({ teamPair }).lean()
    if (cached && cached.expiresAt > new Date()) return cached

    const res = await fetch(
      `https://${process.env.APIFOOTBALL_HOST}/fixtures/headtohead?h2h=${teamAId}-${teamBId}&last=6`,
      { headers: apiHeaders() }
    )
    if (!res.ok) throw new Error(`H2H ${res.status}`)

    const json = await res.json()
    if (json.errors && Object.keys(json.errors).length > 0) {
      // Rate limited — silently skip H2H; analysis still runs without it
      return null
    }

    const fixtures = json.response || []
    const count    = fixtures.length
    if (count === 0) return { matchCount: 0, avgGoals: 0, over25Rate: 0, bttsRate: 0 }

    let totalGoals = 0, over25Count = 0, bttsCount = 0
    for (const f of fixtures) {
      const home = f.goals?.home ?? 0
      const away = f.goals?.away ?? 0
      totalGoals += home + away
      if ((home + away) >= 3) over25Count++ // 3+ = over 2.5
      if (home > 0 && away > 0) bttsCount++
    }

    const stats = {
      teamPair,
      matchCount: count,
      avgGoals:   parseFloat((totalGoals / count).toFixed(2)),
      over25Rate: parseFloat((over25Count / count).toFixed(2)),
      bttsRate:   parseFloat((bttsCount   / count).toFixed(2)),
      fetchedAt:  new Date(),
      expiresAt:  new Date(Date.now() + 24 * 60 * 60 * 1000),
    }

    await H2HCache.findOneAndUpdate({ teamPair }, stats, { upsert: true })
    return stats
  } catch {
    return null   // silently skip H2H — analysis still runs without it
  }
}

// ─── RULE ENGINE ──────────────────────────────────────────────────────────────

function computeInsight(teamA, teamB, tableRowA, tableRowB, statsA, statsB, h2h) {
  const t       = { a: extractTableStats(tableRowA), b: extractTableStats(tableRowB) }
  const posDiff = t.b.pos - t.a.pos
  const ptsDiff = t.a.pts - t.b.pts

  const avgGoalsA  = statsA?.avgGoalsScored   ?? t.a.gf / t.a.p
  const avgGoalsB  = statsB?.avgGoalsScored   ?? t.b.gf / t.b.p
  const avgConcA   = statsA?.avgGoalsConceded ?? t.a.ga / t.a.p
  const avgConcB   = statsB?.avgGoalsConceded ?? t.b.ga / t.b.p
  const avgYellowA = statsA?.avgYellowCards   ?? 1.5
  const avgYellowB = statsB?.avgYellowCards   ?? 1.5
  const avgRedA    = statsA?.avgRedCards      ?? 0.1
  const avgRedB    = statsB?.avgRedCards      ?? 0.1
  const csRateA    = statsA?.cleanSheetRate   ?? 0
  const csRateB    = statsB?.cleanSheetRate   ?? 0
  const formA      = statsA?.form ?? ''
  const formB      = statsB?.form ?? ''
  const winRateA   = t.a.w / t.a.p
  const winRateB   = t.b.w / t.b.p
  const formPtsA   = formPoints(formA)
  const formPtsB   = formPoints(formB)

  // Expected goals per match (home, away)
  const lambdaA        = (avgGoalsA + avgConcB) / 2
  const lambdaB        = (avgGoalsB + avgConcA) / 2
  const combinedLambda = lambdaA + lambdaB

  // ── Outcome score ──────────────────────────────────────────────────────────
  const posScore   = posDiff * 2
  const ptsScore   = ptsDiff * 0.5
  const formScore  = (formPtsA - formPtsB) * 1.5
  const totalScore = posScore + ptsScore + formScore

  // ── Outcome probabilities ─────────────────────────────────────────────────
  const outcome = scoreToOutcome(totalScore)

  // ── 1X2 market ────────────────────────────────────────────────────────────
  let resultPick, resultConf
  if (totalScore >= 14) {
    resultPick = `${teamA} Win`
    resultConf = totalScore >= 22 ? 74 : 64
  } else if (totalScore <= -14) {
    resultPick = `${teamB} Win`
    resultConf = totalScore <= -22 ? 74 : 64
  } else {
    resultPick = 'Draw'
    resultConf = 48
  }

  // ── Double Chance ─────────────────────────────────────────────────────────
  let dcPick, dcConf
  if (totalScore >= 8) {
    dcPick = `${teamA} or Draw (1X)`;  dcConf = Math.min(resultConf + 10, 88)
  } else if (totalScore <= -8) {
    dcPick = `${teamB} or Draw (X2)`;  dcConf = Math.min(resultConf + 10, 88)
  } else {
    dcPick = `${teamA} or ${teamB} (12)`;  dcConf = 60
  }

  // ── Goals (Poisson) ───────────────────────────────────────────────────────
  const over15Prob = overProb(combinedLambda, 1)   // P(goals >= 2)
  const over25Prob = overProb(combinedLambda, 2)   // P(goals >= 3)
  const over35Prob = overProb(combinedLambda, 3)   // P(goals >= 4)

  let goalsPick, goalsConf
  if (over25Prob >= 65) {
    goalsPick = 'Over 2.5 Goals';  goalsConf = over25Prob
  } else if (over15Prob >= 75) {
    goalsPick = 'Over 1.5 Goals';  goalsConf = over15Prob
  } else {
    goalsPick = 'Under 2.5 Goals'; goalsConf = 100 - over25Prob
  }

  // ── BTTS (Poisson: P(A≥1) × P(B≥1)) ─────────────────────────────────────
  const bttsProb = Math.round(
    (1 - Math.exp(-lambdaA)) * (1 - Math.exp(-lambdaB)) * 100
  )
  const bttsYes  = bttsProb >= 50
  const bttsPick = bttsYes ? 'BTTS: Yes' : 'BTTS: No'
  const bttsConf = bttsYes ? bttsProb : 100 - bttsProb

  // ── First Half Goal (Over 0.5 in 1H) ─────────────────────────────────────
  const firstHalfGoal = Math.round((1 - Math.exp(-combinedLambda / 2)) * 100)

  // ── Score Range ───────────────────────────────────────────────────────────
  const p0 = poissonProb(combinedLambda, 0)
  const p1 = poissonProb(combinedLambda, 1)
  const p2 = poissonProb(combinedLambda, 2)
  const p3 = poissonProb(combinedLambda, 3)
  const scoreLow    = Math.round((p0 + p1) * 100)
  const scoreMedium = Math.round((p2 + p3) * 100)
  const scoreHigh   = Math.max(0, 100 - scoreLow - scoreMedium)
  const scoreRangePick = scoreLow >= scoreMedium && scoreLow >= scoreHigh ? '0–1 Goals'
    : scoreMedium >= scoreHigh ? '2–3 Goals' : '4+ Goals'

  // ── Cards ─────────────────────────────────────────────────────────────────
  const combinedCards = avgYellowA + avgYellowB + avgRedA + avgRedB
  let cardsPick, cardsConf
  if (combinedCards >= 5.5)      { cardsPick = 'Over 4.5 Cards';  cardsConf = 70 }
  else if (combinedCards >= 4.2) { cardsPick = 'Over 3.5 Cards';  cardsConf = 65 }
  else                           { cardsPick = 'Under 3.5 Cards'; cardsConf = 60 }

  // ── Clean Sheet ───────────────────────────────────────────────────────────
  let csPick, csConf
  if (csRateA >= 35 && avgGoalsB < 1.2)      { csPick = `${teamA} Clean Sheet`; csConf = 62 }
  else if (csRateB >= 35 && avgGoalsA < 1.2) { csPick = `${teamB} Clean Sheet`; csConf = 62 }
  else                                        { csPick = 'No Clean Sheet';      csConf = 55 }

  // ── H2H Insight ───────────────────────────────────────────────────────────
  let h2hInsight = null
  if (h2h && h2h.matchCount >= 3) {
    const g = h2h.avgGoals
    let pattern
    if      (g >= 3.0 && combinedCards >= 4.2)  pattern = 'High-scoring and aggressive'
    else if (g >= 3.0)                           pattern = 'High-scoring fixture'
    else if (g <= 1.8 && combinedCards < 3.5)    pattern = 'Low-scoring, defensive'
    else if (combinedCards >= 4.5)               pattern = 'Aggressive, physical battle'
    else                                         pattern = 'Balanced fixture'

    h2hInsight = {
      matchCount: h2h.matchCount,
      avgGoals:   h2h.avgGoals,
      over25Rate: h2h.over25Rate,
      bttsRate:   h2h.bttsRate,
      avgCards:   parseFloat(combinedCards.toFixed(1)),
      pattern,
    }
  }

  // ── Value Bet ─────────────────────────────────────────────────────────────
  let valueBet = null
  const h2hOver25 = h2h?.over25Rate ?? 0
  if (over25Prob >= 68 && h2hOver25 >= 0.6) {
    valueBet = {
      market: 'Over 2.5 Goals',
      description: `Model: ${over25Prob}% · H2H: ${Math.round(h2hOver25 * 100)}% of recent meetings went over`,
    }
  } else if (bttsProb >= 68) {
    valueBet = {
      market: 'BTTS Yes',
      description: `Model: ${bttsProb}% · Both teams averaging strong goal output this season`,
    }
  } else if (outcome.home >= 65) {
    valueBet = {
      market: `${teamA} Win`,
      description: `Model gives ${teamA} a ${outcome.home}% home win probability`,
    }
  } else if (outcome.away >= 65) {
    valueBet = {
      market: `${teamB} Win`,
      description: `Model gives ${teamB} a ${outcome.away}% away win probability`,
    }
  }

  // ── Upset Alert ───────────────────────────────────────────────────────────
  let upsetAlert = null
  const posGap    = Math.abs(t.a.pos - t.b.pos)
  const formWinsA = formWins(formA)
  const formWinsB = formWins(formB)
  if (t.a.pos < t.b.pos && formWinsB >= 4 && posGap >= 5) {
    upsetAlert = {
      description: `${teamB} (${t.b.pos}${ordinal(t.b.pos)}) riding ${formWinsB}/5 recent wins — upset potential against higher-ranked ${teamA}`,
    }
  } else if (t.b.pos < t.a.pos && formWinsA >= 4 && posGap >= 5) {
    upsetAlert = {
      description: `${teamA} (${t.a.pos}${ordinal(t.a.pos)}) riding ${formWinsA}/5 recent wins — upset potential against higher-ranked ${teamB}`,
    }
  }

  // ── Risk Level ────────────────────────────────────────────────────────────
  const avgConf = (resultConf + goalsConf + bttsConf) / 3
  let risk = 'medium'
  if (avgConf >= 68 && !upsetAlert) risk = 'low'
  else if (avgConf < 55 || (upsetAlert && posGap >= 8)) risk = 'high'

  // ── Primary pick ──────────────────────────────────────────────────────────
  const primary = [
    { pick: resultPick, confidence: resultConf },
    { pick: goalsPick,  confidence: goalsConf  },
    { pick: cardsPick,  confidence: cardsConf  },
  ].reduce((best, m) => m.confidence > best.confidence ? m : best)

  // ── Reasoning ─────────────────────────────────────────────────────────────
  const reasoning = [
    `${teamA}: avg ${avgGoalsA.toFixed(1)} scored, ${avgConcA.toFixed(1)} conceded/game | form: ${formA || 'N/A'}`,
    `${teamB}: avg ${avgGoalsB.toFixed(1)} scored, ${avgConcB.toFixed(1)} conceded/game | form: ${formB || 'N/A'}`,
    `Expected goals: ${lambdaA.toFixed(1)} (${teamA}) + ${lambdaB.toFixed(1)} (${teamB}) = ${combinedLambda.toFixed(1)} total`,
    `${teamA}: ${t.a.pos}${ordinal(t.a.pos)} place (${t.a.pts} pts, ${(winRateA * 100).toFixed(0)}% win rate)`,
    `${teamB}: ${t.b.pos}${ordinal(t.b.pos)} place (${t.b.pts} pts, ${(winRateB * 100).toFixed(0)}% win rate)`,
    `Cards/game: ${combinedCards.toFixed(1)} combined | Clean sheet — ${teamA}: ${csRateA.toFixed(0)}%, ${teamB}: ${csRateB.toFixed(0)}%`,
  ]
  if (avgConcA > 1.5) reasoning.push(`${teamA} leaky defence — ${avgConcA.toFixed(1)} conceded/game`)
  if (avgConcB > 1.5) reasoning.push(`${teamB} leaky defence — ${avgConcB.toFixed(1)} conceded/game`)
  if (h2hInsight)     reasoning.push(`H2H last ${h2hInsight.matchCount}: avg ${h2hInsight.avgGoals} goals, ${Math.round(h2hInsight.over25Rate * 100)}% over 2.5`)

  return {
    prediction:    primary.pick,
    confidence:    primary.confidence,
    reasoning,
    outcome,
    goalProbs:     { over15: over15Prob, over25: over25Prob, over35: over35Prob },
    bttsProb,
    firstHalfGoal,
    scoreRange:    { low: scoreLow, medium: scoreMedium, high: scoreHigh, pick: scoreRangePick },
    h2h:           h2hInsight,
    valueBet,
    upsetAlert,
    risk,
    markets: {
      result:       { pick: resultPick,             confidence: resultConf },
      doubleChance: { pick: dcPick,                 confidence: dcConf     },
      goals:        { pick: goalsPick,              confidence: goalsConf  },
      btts:         { pick: bttsPick,               confidence: bttsConf   },
      cards:        { pick: cardsPick,              confidence: cardsConf  },
      cleanSheet:   { pick: csPick,                 confidence: csConf     },
      corners:      { pick: 'Data unavailable',     confidence: 0          },
    },
  }
}

// ─── COMPUTE + SAVE (single match, called from route on user request) ─────────

async function computeAndSave(match) {
  if (!match.teamAId || !match.teamBId) return null

  const leagueSlug = LEAGUE_SLUG_MAP[match.league]

  const [table, statsA, statsB, h2h] = await Promise.all([
    leagueSlug ? fetchLeagueTable(leagueSlug) : Promise.resolve([]),
    fetchAndCacheTeamStats(match.teamAId, match.leagueId).catch(() => null),
    fetchAndCacheTeamStats(match.teamBId, match.leagueId).catch(() => null),
    fetchH2H(match.teamAId, match.teamBId),
  ])

  const rowA    = findTeam(table, match.teamA)
  const rowB    = findTeam(table, match.teamB)
  const insight = computeInsight(match.teamA, match.teamB, rowA, rowB, statsA, statsB, h2h)

  await Analysis.findOneAndUpdate(
    { matchId: String(match.matchId) },
    {
      ...insight,
      matchId:     String(match.matchId),
      teamA:       match.teamA,
      teamB:       match.teamB,
      league:      match.league || '',
      generatedAt: new Date(),
      expiresAt:   new Date(Date.now() + INSIGHT_TTL_MS),
    },
    { upsert: true }
  )

  return {
    prediction:    insight.prediction,
    confidence:    insight.confidence,
    reasoning:     insight.reasoning,
    markets:       insight.markets,
    outcome:       insight.outcome,
    goalProbs:     insight.goalProbs,
    bttsProb:      insight.bttsProb,
    firstHalfGoal: insight.firstHalfGoal,
    scoreRange:    insight.scoreRange,
    h2h:           insight.h2h,
    valueBet:      insight.valueBet,
    upsetAlert:    insight.upsetAlert,
    risk:          insight.risk,
    teamA:         match.teamA,
    teamB:         match.teamB,
    ageMinutes:    0,
  }
}

// ─── PRECOMPUTE (called by cron — skip H2H to preserve API budget) ────────────

async function precomputeInsights(matches) {
  for (const match of matches) {
    try {
      const existing = await Analysis.findOne({ matchId: String(match.matchId) })
      if (existing) continue

      const leagueSlug = LEAGUE_SLUG_MAP[match.league]
      const [table, statsA, statsB] = await Promise.all([
        leagueSlug ? fetchLeagueTable(leagueSlug) : Promise.resolve([]),
        fetchAndCacheTeamStats(match.teamAId, match.leagueId).catch(() => null),
        fetchAndCacheTeamStats(match.teamBId, match.leagueId).catch(() => null),
      ])

      const rowA    = findTeam(table, match.teamA)
      const rowB    = findTeam(table, match.teamB)
      const insight = computeInsight(match.teamA, match.teamB, rowA, rowB, statsA, statsB, null)

      await Analysis.findOneAndUpdate(
        { matchId: String(match.matchId) },
        {
          ...insight,
          matchId:     String(match.matchId),
          teamA:       match.teamA,
          teamB:       match.teamB,
          league:      match.league || '',
          generatedAt: new Date(),
          expiresAt:   new Date(Date.now() + INSIGHT_TTL_MS),
        },
        { upsert: true }
      )
    } catch {
      // One failure doesn't block the rest
    }
  }
}

// ─── READ (called by route) ───────────────────────────────────────────────────

async function getAnalysis(matchId) {
  const doc = await Analysis.findOne({ matchId: String(matchId) })
  if (!doc) return null
  return {
    prediction:    doc.prediction,
    confidence:    doc.confidence,
    reasoning:     doc.reasoning,
    markets:       doc.markets,
    outcome:       doc.outcome,
    goalProbs:     doc.goalProbs,
    bttsProb:      doc.bttsProb,
    firstHalfGoal: doc.firstHalfGoal,
    scoreRange:    doc.scoreRange,
    h2h:           doc.h2h,
    valueBet:      doc.valueBet,
    upsetAlert:    doc.upsetAlert,
    risk:          doc.risk,
    teamA:         doc.teamA,
    teamB:         doc.teamB,
    ageMinutes:    Math.floor((Date.now() - doc.generatedAt) / 60000),
  }
}

module.exports = { precomputeInsights, computeAndSave, getAnalysis }

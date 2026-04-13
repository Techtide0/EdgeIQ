const cron = require('node-cron')
const { getLastKnown }           = require('../services/liveMatches')
const { getUpcomingMatches }     = require('../services/upcomingMatches')
const { precomputeInsights }     = require('../services/analysis')

// Runs every 4 hours
function startInsightsCron() {
  cron.schedule('0 */4 * * *', async () => {
    console.log('[cron] Precomputing AI insights...')
    try {
      const live = getLastKnown() || []
      const { data: upcoming } = await getUpcomingMatches()

      // Pass full match objects — analysis service needs teamA, teamB, league
      const matches = [...live, ...(upcoming || [])]

      if (matches.length === 0) {
        console.log('[cron] No matches to analyze')
        return
      }

      await precomputeInsights(matches)
      console.log(`[cron] Insights precomputed for ${matches.length} matches`)
    } catch (err) {
      console.error('[cron] Insight precompute failed:', err.message)
    }
  })

  console.log('[cron] Insights cron scheduled (every 4 hours)')
}

module.exports = startInsightsCron

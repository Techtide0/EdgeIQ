import { motion } from 'framer-motion'
import { Lightbulb, ChevronRight, TrendingUp } from 'lucide-react'
import { useMatches } from '../hooks/useMatches'
import { useAuth } from '../hooks/useAuth'
import { apiFetch } from '../api/client'
import { useState, useEffect, useRef } from 'react'
import AnimatedLoadingSkeleton, { SkeletonBar } from '../components/ui/AnimatedLoadingSkeleton'

function confColor(c) {
  return c >= 70 ? 'var(--accent)' : c >= 55 ? 'var(--warning)' : 'var(--text-muted)'
}

// Compact preview card — fetches top pick in background, navigates to PDP on click
function InsightCard({ match, openMatch, index }) {
  const { getToken }  = useAuth()
  const [top, setTop] = useState(null)   // { prediction, confidence, risk, valueBet }
  const fetched       = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    apiFetch(`/api/matches/analysis/${match.matchId}`, getToken)
      .then(d => setTop({ prediction: d.prediction, confidence: d.confidence, risk: d.risk, valueBet: d.valueBet }))
      .catch(() => {})
  }, [match.matchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const riskColors = {
    low:    { bg: 'rgba(34,197,94,0.14)',  text: '#22c55e' },
    medium: { bg: 'rgba(245,158,11,0.14)', text: '#f59e0b' },
    high:   { bg: 'rgba(239,68,68,0.14)',  text: '#ef4444' },
  }
  const riskStyle = top?.risk ? riskColors[top.risk] : null

  const time = match.startTime
    ? new Date(match.startTime).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => openMatch?.(match.matchId, 'AI Insights')}
      whileHover={{ y: -2, boxShadow: '0 8px 28px rgba(0,0,0,0.13)' }}
      whileTap={{ scale: 0.98 }}
      className="card p-4 flex items-center gap-3 cursor-pointer"
      style={{ transition: 'box-shadow 0.15s' }}>

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--accent-dim)' }}>
        <Lightbulb size={18} style={{ color: 'var(--accent)' }} />
      </div>

      {/* Match info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium mb-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
          {match.league}{time ? ` · ${time}` : ''}
        </p>
        <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>
          {match.teamA} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span> {match.teamB}
        </p>

        {/* Prediction preview */}
        {top ? (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: confColor(top.confidence) }}>
              {top.prediction} · {top.confidence}%
            </span>
            {riskStyle && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: riskStyle.bg, color: riskStyle.text }}>
                {top.risk === 'low' ? 'Low Risk' : top.risk === 'high' ? 'High Risk' : 'Med Risk'}
              </span>
            )}
            {top.valueBet && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.14)', color: '#22c55e' }}>
                💰 Value
              </span>
            )}
          </div>
        ) : (
          <div className="mt-1.5">
            <SkeletonBar width="60%" height={10} delay={0} />
          </div>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight size={16} style={{ color: 'var(--text-muted)', shrink: 0 }} />
    </motion.div>
  )
}

export default function Insights({ openMatch }) {
  const { live, upcoming, loading } = useMatches()

  // Deduplicate: live matches take priority
  const liveIds = new Set(live.map(m => m.matchId))
  const allMatches = [
    ...live,
    ...upcoming.filter(m => !liveIds.has(m.matchId)),
  ]

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-8">

      <div>
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>AI Match Insights</h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Tap any match to open the full AI analysis — outcome probabilities, H2H trends, value bets & more.
        </p>
      </div>

      {loading && <AnimatedLoadingSkeleton numCards={6} label="Loading fixtures…" />}

      {!loading && allMatches.length === 0 && (
        <div className="card p-10 text-center flex flex-col items-center gap-3">
          <TrendingUp size={32} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No matches available right now</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {allMatches.map((m, i) => (
          <InsightCard key={m.matchId} match={m} openMatch={openMatch} index={i} />
        ))}
      </div>
    </div>
  )
}

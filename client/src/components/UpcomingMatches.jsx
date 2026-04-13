import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import { Clock } from 'lucide-react'

function formatKickoff(isoString) {
  const d = new Date(isoString)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth() &&
    a.getDate()     === b.getDate()

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (sameDay(d, today))    return time
  if (sameDay(d, tomorrow)) return `${time} · Tmrw`
  return `${time} · ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

export default function UpcomingMatches({ matches, compact }) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming fixtures in the next 3 days</p>
      </div>
    )
  }

  const list = compact ? matches.slice(0, 4) : matches

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {compact ? 'Upcoming Fixtures' : `Upcoming — ${matches.length} matches`}
        </span>
      </div>

      {list.map((m, i) => (
        <motion.div key={m.matchId}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
          style={{ background: 'var(--surface2)' }}>
          <span className="text-xs font-bold tabular-nums w-20 shrink-0"
            style={{ color: 'var(--accent)' }}>
            {formatKickoff(m.startTime)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
              {m.teamA} <span style={{ color: 'var(--text-muted)' }}>vs</span> {m.teamB}
            </p>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{m.league}</p>
          </div>
        </motion.div>
      ))}

      {compact && matches.length > 4 && (
        <p className="text-xs text-center pt-1" style={{ color: 'var(--text-muted)' }}>
          +{matches.length - 4} more on Matches page
        </p>
      )}
    </div>
  )
}

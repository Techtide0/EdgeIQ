import { motion } from 'framer-motion'

function MatchCard({ m, i, openMatch }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="card overflow-hidden card-hover"
      style={{ cursor: 'pointer' }}
      onClick={() => openMatch?.(m.matchId)}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>{m.league}</p>
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
              {m.teamA} <span style={{ color: 'var(--text-muted)' }}>vs</span> {m.teamB}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
              {m.scoreA ?? 0} – {m.scoreB ?? 0}
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ background: 'var(--danger)' }}>
              <span className="live-dot" style={{ width: 5, height: 5 }} />
              {m.minute}'
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function LiveMatches({ matches, lastUpdated, stale, openMatch }) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No matches live right now</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Live Now</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
            {matches.length}
          </span>
        </div>
        {lastUpdated && (
          <span className="text-[10px]" style={{ color: stale ? 'var(--warning)' : 'var(--text-muted)' }}>
            {stale ? '⚠ ' : ''}Updated {lastUpdated}
          </span>
        )}
      </div>

      {matches.map((m, i) => (
        <MatchCard key={m.matchId} m={m} i={i} openMatch={openMatch} />
      ))}
    </div>
  )
}

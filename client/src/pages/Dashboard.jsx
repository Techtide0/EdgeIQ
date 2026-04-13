import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Wallet, Trophy, AlertCircle, ArrowRight, Lightbulb, ChevronRight } from 'lucide-react'
import { useStats } from '../hooks/useStats'
import { useBets } from '../hooks/useBets'
import { useMatches } from '../hooks/useMatches'
import { useAuth } from '../hooks/useAuth'
import { apiFetch } from '../api/client'
import { useState, useEffect, useMemo } from 'react'
import BetCard from '../components/BetCard'
import LiveMatches from '../components/LiveMatches'
import UpcomingMatches from '../components/UpcomingMatches'
import AddBetForm from '../components/AddBetForm'
import PendingAlert from '../components/PendingAlert'
import AnimatedLoadingSkeleton, { SkeletonStatCard, SkeletonBetCard, SkeletonBar } from '../components/ui/AnimatedLoadingSkeleton'

function fmt(n = 0) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

function StatCard({ label, value, icon: Icon, color, colorDim, delta, delay = 0 }) {
  const positive = delta >= 0
  return (
    <motion.div
      className="card card-hover p-5 flex flex-col gap-3 fade-up"
      style={{ animationDelay: `${delay}s` }}
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: colorDim }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>{value}</p>
      {delta !== undefined && (
        <div className="flex items-center gap-1 text-xs font-medium"
          style={{ color: positive ? 'var(--accent)' : 'var(--danger)' }}>
          {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {positive ? '+' : ''}{delta}% vs last week
        </div>
      )}
    </motion.div>
  )
}

// ─── Confidence color helper ──────────────────────────────────────────────────
function confColor(c) {
  return c >= 70 ? 'var(--accent)' : c >= 55 ? 'var(--warning)' : 'var(--text-muted)'
}

// ─── Single insight snapshot card ─────────────────────────────────────────────
function InsightSnapshotCard({ match, openMatch, delay = 0 }) {
  const { getToken } = useAuth()
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      apiFetch(`/api/matches/analysis/${match.matchId}`, getToken)
        .then(data => { if (!cancelled) { setInsight(data); setLoading(false) } })
        .catch(() => { if (!cancelled) setLoading(false) })
    }, delay)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [match.matchId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => openMatch?.(match.matchId, 'AI Insights')}
      className="card p-4 flex flex-col gap-3 min-w-0 cursor-pointer"
      style={{ transition: 'box-shadow 0.15s' }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      whileTap={{ scale: 0.98 }}>
      {/* Match label */}
      <div>
        <p className="text-[10px] font-medium truncate" style={{ color: 'var(--text-muted)' }}>{match.league}</p>
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
          {match.teamA} <span style={{ color: 'var(--text-muted)' }}>vs</span> {match.teamB}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {new Date(match.startTime).toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {loading && (
        <div className="flex flex-col gap-2">
          <SkeletonBar width="80%" height={11} delay={0} />
          <SkeletonBar width="50%" height={18} delay={0.1} />
          <SkeletonBar width="100%" height={4} rounded="rounded-full" delay={0.15} />
        </div>
      )}

      <AnimatePresence>
        {!loading && insight && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2">
            {/* Top pick */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--text-muted)' }}>Top Pick</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold leading-snug" style={{ color: 'var(--text)' }}>{insight.prediction}</p>
                <span className="text-base font-bold shrink-0" style={{ color: confColor(insight.confidence) }}>
                  {insight.confidence}%
                </span>
              </div>
              {/* Confidence bar */}
              <div className="w-full h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--border)' }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${insight.confidence}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: confColor(insight.confidence) }} />
              </div>
            </div>

            {/* Key secondary market */}
            {insight.markets?.goals?.pick && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                style={{ background: 'var(--surface2)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Goals</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{insight.markets.goals.pick}</span>
              </div>
            )}
          </motion.div>
        )}

        {!loading && !insight && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No analysis available
          </motion.p>
        )}
      </AnimatePresence>

      {/* Clickable hint */}
      {!loading && insight && (
        <div className="flex items-center justify-end gap-1 mt-1"
          style={{ color: 'var(--accent)' }}>
          <span className="text-[10px] font-semibold">Full analysis</span>
          <ChevronRight size={11} />
        </div>
      )}
    </motion.div>
  )
}

// ─── Quick insights section ───────────────────────────────────────────────────
function QuickInsights({ matches, setPage, openMatch }) {
  // Pick 3 random matches from the pool (stable across re-renders)
  const picks = useMemo(() => {
    if (!matches.length) return []
    const seen = new Set()
    const unique = matches.filter(m => {
      if (seen.has(m.matchId)) return false
      seen.add(m.matchId)
      return true
    })
    return [...unique].sort(() => Math.random() - 0.5).slice(0, 3)
  }, [matches.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!matches.length) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-dim)' }}>
            <Lightbulb size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI Match Insights</h2>
        </div>
        <button onClick={() => setPage('insights')}
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
          See all <ChevronRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {picks.map((m, i) => (
          <motion.div key={m.matchId}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.08 }}>
            <InsightSnapshotCard match={m} openMatch={openMatch} delay={i * 400} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

export default function Dashboard({ onAddBet, statsKey, bumpStats, setPage, openMatch }) {
  const { stats, loading: statsLoading } = useStats(statsKey)
  const { bets, loading: betsLoading, updateBet, deleteBet, createBet } = useBets()
  const { live, upcoming, lastUpdated, stale, loading: matchLoading } = useMatches()

  const pending = bets.filter(b => b.status === 'pending')

  async function handleCreate(payload) { await createBet(payload); bumpStats() }
  async function handleUpdate(id, p)   { await updateBet(id, p);   bumpStats() }
  async function handleDelete(id)      { await deleteBet(id);       bumpStats() }

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-8">

      {/* Pending alert */}
      <PendingAlert bets={bets} />

      {/* Stat cards */}
      <section>
        {statsLoading
          ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 0.06, 0.12, 0.18].map((delay, i) => (
                <SkeletonStatCard key={i} delay={delay} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Spent"  value={fmt(stats?.totalSpent)} icon={Wallet}    color="var(--info)"    colorDim="var(--info-dim)"    delay={0} />
              <StatCard label="Total Won"    value={fmt(stats?.totalWon)}   icon={Trophy}    color="var(--accent)"  colorDim="var(--accent-dim)"  delay={0.06} />
              <StatCard label="Profit"       value={fmt(stats?.profit)}     icon={TrendingUp} color={stats?.profit >= 0 ? 'var(--accent)' : 'var(--danger)'} colorDim={stats?.profit >= 0 ? 'var(--accent-dim)' : 'var(--danger-dim)'} delay={0.12} />
              <StatCard label="ROI"          value={`${stats?.roi ?? 0}%`}  icon={TrendingUp} color={stats?.roi >= 0 ? 'var(--accent)' : 'var(--danger)'}    colorDim={stats?.roi >= 0 ? 'var(--accent-dim)' : 'var(--danger-dim)'}   delay={0.18} />
            </div>
          )
        }
      </section>

      {/* Two-column layout (desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Active bets */}
        <motion.section className="card p-5 flex flex-col gap-4"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Active Bets
              {pending.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
                  <AlertCircle size={11} />{pending.length}
                </span>
              )}
            </h2>
            <button onClick={() => setPage('bets')}
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              View all <ArrowRight size={13} />
            </button>
          </div>

          <AddBetForm onAdd={handleCreate} compact />

          <div className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: '340px' }}>
            {betsLoading && [0, 0.08, 0.16].map((delay, i) => (
              <SkeletonBetCard key={i} delay={delay} />
            ))}
            {!betsLoading && bets.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No bets yet — add your first one above</p>
            )}
            {bets.slice(0, 5).map(bet => (
              <BetCard key={bet._id} bet={bet} onUpdate={handleUpdate} onDelete={handleDelete} compact />
            ))}
          </div>
        </motion.section>

        {/* Live matches */}
        <motion.section className="card p-5 flex flex-col gap-4"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          {matchLoading
            ? <AnimatedLoadingSkeleton numCards={3} label="Loading matches…" />
            : <>
                <LiveMatches matches={live} lastUpdated={lastUpdated} stale={stale} openMatch={openMatch} />
                {live.length === 0 && <UpcomingMatches matches={upcoming.slice(0, 4)} compact />}
              </>
          }
        </motion.section>
      </div>

      {/* Random AI insights from upcoming matches */}
      {!matchLoading && (
        <QuickInsights matches={[...live, ...upcoming]} setPage={setPage} openMatch={openMatch} />
      )}
    </div>
  )
}

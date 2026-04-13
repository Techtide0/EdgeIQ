import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, RefreshCw, Bell, BellOff,
  TrendingUp, Lightbulb,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiFetch } from '../api/client'
import { useNotifications } from '../hooks/useNotifications'
import { SkeletonBar } from '../components/ui/AnimatedLoadingSkeleton'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function confColor(c) {
  return c >= 70 ? 'var(--accent)' : c >= 55 ? 'var(--warning)' : 'var(--text-muted)'
}

function ConfBar({ value, color }) {
  const c = color || confColor(value)
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="h-full rounded-full" style={{ background: c }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Details (events)
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_META = {
  Goal:  { emoji: '⚽', color: '#22c55e' },
  Card:  { emoji: '🟨', color: '#fbbf24' },
  subst: { emoji: '🔄', color: '#60a5fa' },
  Var:   { emoji: '📺', color: '#a78bfa' },
}

function EventRow({ ev, homeId }) {
  const isHome = ev.team?.id === homeId
  const meta   = EVENT_META[ev.type] || { emoji: '•', color: 'var(--text-muted)' }
  const cardColor = ev.detail === 'Red Card' ? '#ef4444' : meta.color

  return (
    <div className={`flex items-center gap-3 py-3 px-4 ${isHome ? '' : 'flex-row-reverse'}`}
      style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
        style={{ background: `${cardColor}20` }}>
        {ev.type === 'Card' && ev.detail === 'Red Card' ? '🟥' : meta.emoji}
      </div>
      <div className={`flex-1 min-w-0 ${isHome ? '' : 'text-right'}`}>
        <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>
          {ev.player?.name || ''}
          {ev.type === 'subst' && ev.assist?.name &&
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}> → {ev.assist.name}</span>}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {ev.detail}
          {ev.type === 'Goal' && ev.assist?.name && ` · Assist: ${ev.assist.name}`}
        </p>
      </div>
      <span className="text-xs font-bold tabular-nums shrink-0"
        style={{ color: 'var(--accent)' }}>{ev.time?.elapsed}'</span>
    </div>
  )
}

function DetailsTab({ events, homeId }) {
  if (!events?.length) return (
    <div className="card p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
      No match events yet
    </div>
  )
  return (
    <div className="card overflow-hidden divide-y" style={{ '--tw-divide-color': 'var(--border)' }}>
      {events.map((ev, i) => <EventRow key={i} ev={ev} homeId={homeId} />)}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Odds
// ─────────────────────────────────────────────────────────────────────────────

const MARKET_ICONS = {
  'Match Winner':          '1X2',
  'Double Chance':         '1X2',
  'Both Teams Score':      'BTTS',
  'Goals Over/Under':      'O/U',
  'Asian Handicap':        'AH',
  'Exact Score':           'EX',
  'First Half Winner':     '1HW',
  'Correct Score - First Half': '1HCS',
}

function OddsTab({ matchId, getToken }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    apiFetch(`/api/matches/${matchId}/odds`, getToken)
      .then(setData)
      .catch(() => setData({ bookmakers: [] }))
      .finally(() => setLoading(false))
  }, [matchId, getToken])

  if (loading) return (
    <div className="card p-5 flex flex-col gap-3">
      {[0, 0.08, 0.16, 0.24, 0.32].map((d, i) => (
        <SkeletonBar key={i} width="100%" height={36} rounded="rounded-xl" delay={d} />
      ))}
    </div>
  )

  const bk = data?.bookmakers?.[0]
  if (!bk) return (
    <div className="card p-8 text-center">
      <TrendingUp size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Odds not available</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        Live odds require a premium API plan
      </p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
        {bk.name}
      </p>
      {bk.bets?.map((bet, bi) => (
        <div key={bi} className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-muted)' }}>
            {MARKET_ICONS[bet.name] || ''} {bet.name}
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(bet.values?.length, 3)}, 1fr)` }}>
            {bet.values?.map((v, vi) => (
              <div key={vi} className="flex flex-col items-center gap-1 p-3 rounded-xl"
                style={{ background: 'var(--surface2)' }}>
                <span className="text-[10px] font-medium uppercase tracking-wide text-center leading-tight"
                  style={{ color: 'var(--text-muted)' }}>{v.value}</span>
                <span className="text-lg font-black" style={{ color: 'var(--accent)' }}>{v.odd}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Lineups (pitch visualization)
// ─────────────────────────────────────────────────────────────────────────────

function PitchLines() {
  return (
    <svg viewBox="0 0 320 480" className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.22 }}>
      <rect x="14" y="10" width="292" height="460" fill="none" stroke="white" strokeWidth="2" />
      <line x1="14" y1="240" x2="306" y2="240" stroke="white" strokeWidth="2" />
      <circle cx="160" cy="240" r="46" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="160" cy="240" r="3" fill="white" />
      <rect x="72" y="10" width="176" height="66" fill="none" stroke="white" strokeWidth="2" />
      <rect x="114" y="10" width="92" height="26" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="160" cy="58" r="3" fill="white" />
      <path d="M 128 76 A 46 46 0 0 1 192 76" fill="none" stroke="white" strokeWidth="2" />
      <rect x="72" y="404" width="176" height="66" fill="none" stroke="white" strokeWidth="2" />
      <rect x="114" y="444" width="92" height="26" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="160" cy="422" r="3" fill="white" />
      <path d="M 128 404 A 46 46 0 0 0 192 404" fill="none" stroke="white" strokeWidth="2" />
    </svg>
  )
}

function PlayerPin({ player, primary, number }) {
  const bg   = primary ? `#${primary}` : '#ffffff'
  const text = number  ? `#${number}`  : '#111111'
  const last = (player.name || '').split(' ').pop()
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ width: 46 }}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="flex items-center justify-center rounded-full font-bold shadow-lg text-xs"
        style={{ width: 28, height: 28, background: bg, color: text, border: '2px solid rgba(255,255,255,0.55)' }}>
        {player.number}
      </motion.div>
      <span className="text-[9px] font-medium text-center leading-tight"
        style={{ color: 'rgba(255,255,255,0.92)', maxWidth: 42, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {last}
      </span>
    </div>
  )
}

function FootballPitch({ lineup }) {
  if (!lineup?.startXI?.length) return (
    <div className="flex items-center justify-center rounded-xl" style={{ height: 260, background: '#1e6e2e' }}>
      <p className="text-sm text-white opacity-50">Lineup not submitted yet</p>
    </div>
  )

  const rowMap = {}
  lineup.startXI.forEach(({ player }) => {
    if (!player?.grid) return
    const [row] = player.grid.split(':').map(Number)
    if (!rowMap[row]) rowMap[row] = []
    rowMap[row].push(player)
  })

  const rows   = Object.keys(rowMap).map(Number).sort((a, b) => a - b)
  const maxRow = Math.max(...rows)
  const pColors = lineup.team?.colors?.player      || {}
  const gColors = lineup.team?.colors?.goalkeeper  || {}

  const yPct = row => 88 - ((row - 1) / (maxRow - 1 || 1)) * 80

  return (
    <div className="relative w-full rounded-xl overflow-hidden"
      style={{ aspectRatio: '3/4', background: 'linear-gradient(180deg, #1a6130 0%, #2a8040 40%, #2a8040 60%, #1a6130 100%)' }}>
      {[0,1,2,3,4,5,6].map(i => (
        <div key={i} className="absolute w-full" style={{ top: `${i * 14.3}%`, height: '14.3%', background: i%2===0 ? 'rgba(0,0,0,0.04)' : 'transparent' }} />
      ))}
      <PitchLines />
      {rows.map(row => {
        const players = rowMap[row].sort((a, b) => {
          const ac = Number(a.grid?.split(':')[1] || 1)
          const bc = Number(b.grid?.split(':')[1] || 1)
          return ac - bc
        })
        return players.map((player, i) => {
          const x   = ((i + 0.5) / players.length) * 100
          const y   = yPct(row)
          const isGk = player.pos === 'G'
          return (
            <div key={player.id || player.name}
              className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
              <PlayerPin player={player}
                primary={isGk ? gColors.primary : pColors.primary}
                number={isGk  ? gColors.number  : pColors.number} />
            </div>
          )
        })
      })}
      <div className="absolute bottom-2 right-3 text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {lineup.formation}
      </div>
    </div>
  )
}

function LineupsTab({ lineups, homeTeam, awayTeam }) {
  const [side, setSide] = useState(0)
  const lu = lineups?.[side]

  return (
    <div className="flex flex-col gap-4">
      {lineups?.length > 0 && (
        <div className="flex gap-2 p-1 rounded-xl w-fit" style={{ background: 'var(--surface2)' }}>
          {lineups.map((l, idx) => (
            <button key={idx} onClick={() => setSide(idx)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: side === idx ? 'var(--surface)' : 'transparent',
                color: side === idx ? 'var(--text)' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer',
                boxShadow: side === idx ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              {l.team?.name || (idx === 0 ? homeTeam?.name : awayTeam?.name)}
            </button>
          ))}
        </div>
      )}

      <FootballPitch lineup={lu} />

      {lu?.substitutes?.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Substitutes
          </p>
          <div className="flex flex-wrap gap-2">
            {lu.substitutes.map(({ player }) => (
              <span key={player.id || player.name}
                className="px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ background: 'var(--surface2)', color: 'var(--text)' }}>
                {player.number} · {player.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Statistics
// ─────────────────────────────────────────────────────────────────────────────

function StatBar({ label, homeVal, awayVal }) {
  const h = Number(homeVal) || 0
  const a = Number(awayVal) || 0
  const t = h + a || 1
  return (
    <div className="flex flex-col gap-1.5 py-2.5">
      <div className="flex justify-between items-center text-sm">
        <span className="font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{homeVal ?? '—'}</span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="font-semibold tabular-nums" style={{ color: 'var(--info)' }}>{awayVal ?? '—'}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5" style={{ background: 'var(--surface2)' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${(h / t) * 100}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="h-full rounded-l-full" style={{ background: 'var(--accent)' }} />
        <motion.div initial={{ width: 0 }} animate={{ width: `${(a / t) * 100}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="h-full rounded-r-full" style={{ background: 'var(--info)' }} />
      </div>
    </div>
  )
}

function StatisticsTab({ statistics, homeTeam, awayTeam }) {
  const homeStats = statistics?.[0]?.statistics || []
  const awayStats = statistics?.[1]?.statistics || []
  const map = homeStats.map((s, i) => ({ label: s.type, home: s.value, away: awayStats[i]?.value }))

  if (!map.length) return (
    <div className="card p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
      Statistics not available yet
    </div>
  )

  return (
    <div className="card px-4 py-2">
      <div className="flex justify-between text-xs font-bold pb-2 pt-1" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--accent)' }}>{homeTeam?.name}</span>
        <span style={{ color: 'var(--info)' }}>{awayTeam?.name}</span>
      </div>
      {map.map((s, i) => (
        <div key={i} style={{ borderBottom: i < map.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <StatBar label={s.label} homeVal={s.home} awayVal={s.away} />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: AI Insights (pro model)
// ─────────────────────────────────────────────────────────────────────────────

const MARKET_LABELS = {
  result: '1X2', doubleChance: 'Double Chance', goals: 'Goals O/U',
  btts: 'BTTS', cards: 'Cards', cleanSheet: 'Clean Sheet', corners: 'Corners',
}

const RISK_META = {
  low:    { label: 'Low Risk',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  medium: { label: 'Medium Risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  high:   { label: 'High Risk',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
}

// 1. Top Pick card
function TopPickCard({ insight }) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Top Pick
      </p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-xl font-black leading-tight" style={{ color: 'var(--text)' }}>{insight.prediction}</p>
        <p className="text-3xl font-black shrink-0" style={{ color: confColor(insight.confidence) }}>
          {insight.confidence}%
        </p>
      </div>
      <ConfBar value={insight.confidence} />
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        Generated {insight.ageMinutes} min ago
      </p>
    </div>
  )
}

// 2. Outcome probabilities (3-way bar)
function OutcomeCard({ outcome, teamA, teamB }) {
  const sections = [
    { label: teamA, value: outcome.home, color: 'var(--accent)' },
    { label: 'Draw',  value: outcome.draw, color: 'rgba(255,255,255,0.3)' },
    { label: teamB, value: outcome.away, color: 'var(--info)' },
  ]
  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Match Outcome
      </p>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {sections.map((s, i) => (
          <motion.div key={i}
            initial={{ width: 0 }} animate={{ width: `${s.value}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.1 }}
            style={{ background: s.color }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        {sections.map((s, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span className="text-sm font-black tabular-nums" style={{ color: s.color }}>{s.value}%</span>
            <span className="text-[10px] leading-tight truncate" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 3. Goals market (Over 1.5 / 2.5 / 3.5)
function GoalsCard({ goalProbs }) {
  const markets = [
    { label: 'Over 1.5', value: goalProbs.over15 },
    { label: 'Over 2.5', value: goalProbs.over25 },
    { label: 'Over 3.5', value: goalProbs.over35 },
  ]
  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Goals Market
      </p>
      <div className="grid grid-cols-3 gap-2">
        {markets.map((m, i) => (
          <div key={i} className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: 'var(--surface2)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {m.label}
            </span>
            <span className="text-2xl font-black" style={{ color: confColor(m.value) }}>{m.value}%</span>
            <ConfBar value={m.value} color={confColor(m.value)} />
          </div>
        ))}
      </div>
    </div>
  )
}

// 4. Mini stat card (BTTS / Score Range / 1H Goal)
function MiniStatCard({ label, value, sub, color }) {
  return (
    <div className="card p-3 flex flex-col gap-1.5 items-center text-center">
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-black leading-tight" style={{ color: color || 'var(--text)' }}>{value}</span>
      <span className="text-[11px] font-semibold" style={{ color: color || 'var(--text-muted)' }}>{sub}</span>
    </div>
  )
}

// 5. H2H Analysis
function H2HCard({ h2h }) {
  const patternColor = {
    'High-scoring and aggressive': '#ef4444',
    'High-scoring fixture':        '#f97316',
    'Low-scoring, defensive':      '#60a5fa',
    'Aggressive, physical battle': '#f59e0b',
    'Balanced fixture':            'var(--text-muted)',
  }[h2h.pattern] || 'var(--text-muted)'

  const stats = [
    {
      emoji: '⚽', label: 'Avg Goals',
      value: h2h.avgGoals.toFixed(1),
      sub:   `${Math.round(h2h.over25Rate * 100)}% over 2.5`,
    },
    {
      emoji: '🔄', label: 'BTTS Rate',
      value: `${Math.round(h2h.bttsRate * 100)}%`,
      sub:   `in last ${h2h.matchCount}`,
    },
    {
      emoji: '🟨', label: 'Avg Cards',
      value: h2h.avgCards?.toFixed(1) ?? '—',
      sub:   h2h.avgCards >= 4.2 ? 'HIGH' : h2h.avgCards >= 3 ? 'MED' : 'LOW',
    },
  ]

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Head-to-Head Analysis
        </p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>
          Last {h2h.matchCount}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s, i) => (
          <div key={i} className="flex flex-col gap-1 p-2.5 rounded-lg" style={{ background: 'var(--surface2)' }}>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{s.emoji} {s.label}</span>
            <span className="text-xl font-black" style={{ color: 'var(--text)' }}>{s.value}</span>
            <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>{s.sub}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 p-2.5 rounded-lg"
        style={{ background: `${patternColor}18`, border: `1px solid ${patternColor}35` }}>
        <span>⚔️</span>
        <span className="text-xs font-semibold" style={{ color: patternColor }}>{h2h.pattern}</span>
      </div>
    </div>
  )
}

// 6. Value Bet
function ValueBetCard({ valueBet }) {
  return (
    <div className="card p-4 flex flex-col gap-2"
      style={{ border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.06)' }}>
      <div className="flex items-center gap-2">
        <span>💰</span>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#22c55e' }}>
          Value Bet Detected
        </p>
      </div>
      <p className="text-sm font-black" style={{ color: 'var(--text)' }}>{valueBet.market}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{valueBet.description}</p>
    </div>
  )
}

// 7. Upset Alert
function UpsetAlertCard({ upsetAlert }) {
  return (
    <div className="card p-4 flex flex-col gap-2"
      style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.06)' }}>
      <div className="flex items-center gap-2">
        <span>⚠️</span>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
          Upset Alert
        </p>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{upsetAlert.description}</p>
    </div>
  )
}

// 8. Confidence & Risk
function RiskCard({ confidence, risk }) {
  const meta = RISK_META[risk] || RISK_META.medium
  return (
    <div className="card p-4 flex items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Overall Confidence
        </p>
        <p className="text-2xl font-black" style={{ color: confColor(confidence) }}>{confidence}%</p>
      </div>
      <div className="px-4 py-2 rounded-xl font-bold text-sm" style={{ background: meta.bg, color: meta.color }}>
        {meta.label}
      </div>
    </div>
  )
}

// 9. Markets grid
function MarketsGrid({ markets }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(markets).map(([key, m]) => {
        if (!m?.pick || m.confidence === 0) return null
        const c = confColor(m.confidence)
        return (
          <div key={key} className="card p-3.5 flex flex-col gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}>{MARKET_LABELS[key] || key}</p>
            <p className="text-sm font-bold leading-snug" style={{ color: 'var(--text)' }}>{m.pick}</p>
            <ConfBar value={m.confidence} color={c} />
            <p className="text-[10px] font-semibold" style={{ color: c }}>{m.confidence}%</p>
          </div>
        )
      })}
    </div>
  )
}



function InsightsTab({ matchId, getToken }) {
  const [insight, setInsight]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    apiFetch(`/api/matches/analysis/${matchId}`, getToken)
      .then(d => { setInsight(d); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [matchId, getToken])

  if (loading) return (
    <div className="card p-5 flex flex-col gap-3">
      <SkeletonBar width="70%" height={14} delay={0} />
      <SkeletonBar width="50%" height={36} delay={0.08} rounded="rounded-lg" />
      <SkeletonBar width="100%" height={6}  delay={0.14} rounded="rounded-full" />
      <SkeletonBar width="100%" height={80} delay={0.18} rounded="rounded-xl" />
      <div className="grid grid-cols-3 gap-2 mt-1">
        {[0.22, 0.26, 0.30].map((d, i) => (
          <SkeletonBar key={i} width="100%" height={88} delay={d} rounded="rounded-xl" />
        ))}
      </div>
      <SkeletonBar width="100%" height={120} delay={0.34} rounded="rounded-xl" />
    </div>
  )

  if (error) return (
    <div className="card p-6 text-center">
      <Lightbulb size={28} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
    </div>
  )

  if (!insight) return null

  const { outcome, goalProbs, bttsProb, firstHalfGoal, scoreRange, h2h, valueBet, upsetAlert, risk } = insight

  // Map score range pick to its percentage
  const scoreRangePct = scoreRange
    ? (scoreRange.pick === '0–1 Goals' ? scoreRange.low
       : scoreRange.pick === '2–3 Goals' ? scoreRange.medium : scoreRange.high)
    : null

  return (
    <div className="flex flex-col gap-4">

      {/* 1. Top Pick */}
      <TopPickCard insight={insight} />

      {/* 2. Match Outcome */}
      {outcome && <OutcomeCard outcome={outcome} teamA={insight.teamA} teamB={insight.teamB} />}

      {/* 3. Goals Market */}
      {goalProbs && <GoalsCard goalProbs={goalProbs} />}

      {/* 4. Mini stats row */}
      <div className="grid grid-cols-3 gap-3">
        {bttsProb != null && (
          <MiniStatCard
            label="BTTS"
            value={bttsProb >= 50 ? 'Yes' : 'No'}
            sub={`${bttsProb}%`}
            color={bttsProb >= 60 ? 'var(--accent)' : bttsProb < 40 ? 'var(--info)' : 'var(--text-muted)'}
          />
        )}
        {scoreRange && (
          <MiniStatCard label="Score Range" value={scoreRange.pick} sub={`${scoreRangePct ?? '—'}%`} />
        )}
        {firstHalfGoal != null && (
          <MiniStatCard label="1H Goal" value="Over 0.5" sub={`${firstHalfGoal}%`} color={confColor(firstHalfGoal)} />
        )}
      </div>

      {/* 5. H2H */}
      {h2h && h2h.matchCount >= 3 && <H2HCard h2h={h2h} />}

      {/* 6. Value Bet */}
      {valueBet && <ValueBetCard valueBet={valueBet} />}

      {/* 7. Upset Alert */}
      {upsetAlert && <UpsetAlertCard upsetAlert={upsetAlert} />}

      {/* 8. Confidence & Risk */}
      <RiskCard confidence={insight.confidence} risk={risk || 'medium'} />

      {/* 9. Markets Grid */}
      {insight.markets && <MarketsGrid markets={insight.markets} />}

      {/* 10. Reasoning */}
      {insight.reasoning?.length > 0 && (
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-muted)' }}>Analysis Breakdown</p>
          <ul className="flex flex-col gap-2">
            {insight.reasoning.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Standings  (proxied through our server → API-Football /standings)
// ─────────────────────────────────────────────────────────────────────────────

// Derive season start year from a match date (season starts in July/Aug)
function matchSeason(isoDate) {
  const d = new Date(isoDate || Date.now())
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
}

function nameMatch(a = '', b = '') {
  a = a.toLowerCase(); b = b.toLowerCase()
  return a.includes(b.split(' ')[0]) || b.includes(a.split(' ')[0])
}

function fmtGD(n) {
  if (n == null) return '—'
  return n > 0 ? `+${n}` : String(n)
}

// Derive zone color from API-Football description string
function zoneColor(description = '') {
  const d = description.toLowerCase()
  if (d.includes('champions league'))              return '#3b82f6'  // blue
  if (d.includes('europa league') &&
      !d.includes('conference'))                   return '#f97316'  // orange
  if (d.includes('conference league') ||
      d.includes('conference'))                    return '#a78bfa'  // purple
  if (d.includes('world cup') ||
      d.includes('promotion playoff') ||
      d.includes('promotion'))                     return '#22c55e'  // green
  if (d.includes('relegation playoff'))            return '#fb923c'  // amber
  if (d.includes('relegation'))                    return '#ef4444'  // red
  return null
}

function StandingsTab({ leagueId, startTime, homeTeamName, awayTeamName }) {
  const { getToken }      = useAuth()
  const [rows, setRows]   = useState(null)
  const [meta, setMeta]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetched = useRef(false)

  const season = useMemo(() => matchSeason(startTime), [startTime])

  useEffect(() => {
    if (fetched.current || !leagueId) return
    fetched.current = true

    apiFetch(`/api/matches/${leagueId}/standings?season=${season}`, getToken)
      .then(json => {
        if (json.standings?.length) {
          setRows(json.standings)
          setMeta({ name: json.name, season: json.season })
        } else {
          setError('No standings data available')
        }
      })
      .catch(() => setError('Could not load standings'))
      .finally(() => setLoading(false))
  }, [leagueId, season]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="card p-4 flex flex-col gap-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <SkeletonBar key={i} width="100%" height={32} rounded="rounded-lg" delay={i * 0.04} />
      ))}
    </div>
  )

  if (error) return (
    <div className="card p-8 text-center">
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Standings unavailable</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{error}</p>
    </div>
  )

  // Collect zone legend from descriptions
  const legend = {}
  rows.forEach(r => {
    const color = zoneColor(r.description)
    if (color && r.description && !legend[color]) {
      // Shorten description for display
      const d = r.description.replace(/\s*\(.*\)/, '').trim()
      legend[color] = d
    }
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{meta?.name}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{meta?.season}/{String(meta?.season + 1).slice(2)}</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <span className="w-7 shrink-0">#</span>
          <span className="flex-1">Club</span>
          <span className="w-7 text-center shrink-0">P</span>
          <span className="w-7 text-center shrink-0">W</span>
          <span className="w-7 text-center shrink-0">D</span>
          <span className="w-7 text-center shrink-0">L</span>
          <span className="w-9 text-center shrink-0">GD</span>
          <span className="w-9 text-center shrink-0 font-black" style={{ color: 'var(--text)' }}>Pts</span>
        </div>

        {/* Rows */}
        {rows.map((entry, i) => {
          const isHome    = nameMatch(entry.team?.name, homeTeamName)
          const isAway    = nameMatch(entry.team?.name, awayTeamName)
          const highlight = isHome || isAway
          const color     = zoneColor(entry.description)
          const all       = entry.all || {}
          const gd        = entry.goalsDiff

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.025 }}
              className="flex items-center px-3 py-2.5 relative"
              style={{
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                background: highlight ? 'var(--accent-dim)' : 'transparent',
              }}>
              {/* Zone color bar */}
              {color && (
                <div className="absolute left-0 top-0 bottom-0 w-0.75 rounded-r-full"
                  style={{ background: color }} />
              )}

              {/* Position */}
              <span className="w-7 text-xs font-bold tabular-nums shrink-0 pl-1"
                style={{ color: highlight ? 'var(--accent)' : 'var(--text-muted)' }}>
                {entry.rank}
              </span>

              {/* Team */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {entry.team?.logo
                  ? <img src={entry.team.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
                  : <div className="w-5 h-5 rounded-full shrink-0" style={{ background: 'var(--surface2)' }} />
                }
                <span className="text-xs font-semibold truncate"
                  style={{ color: highlight ? 'var(--accent)' : 'var(--text)' }}>
                  {entry.team?.name}
                </span>
                {(isHome || isAway) && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {isHome ? 'H' : 'A'}
                  </span>
                )}
              </div>

              {/* Stats */}
              <span className="w-7 text-[11px] text-center tabular-nums shrink-0"
                style={{ color: 'var(--text-muted)' }}>{all.played ?? '—'}</span>
              <span className="w-7 text-[11px] text-center tabular-nums font-medium shrink-0"
                style={{ color: 'var(--text)' }}>{all.win ?? '—'}</span>
              <span className="w-7 text-[11px] text-center tabular-nums shrink-0"
                style={{ color: 'var(--text-muted)' }}>{all.draw ?? '—'}</span>
              <span className="w-7 text-[11px] text-center tabular-nums shrink-0"
                style={{ color: 'var(--text-muted)' }}>{all.lose ?? '—'}</span>
              <span className="w-9 text-[11px] text-center tabular-nums font-medium shrink-0"
                style={{ color: gd >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                {fmtGD(gd)}
              </span>
              <span className="w-9 text-[11px] text-center tabular-nums font-black shrink-0"
                style={{ color: highlight ? 'var(--accent)' : 'var(--text)' }}>
                {entry.points ?? '—'}
              </span>
            </motion.div>
          )
        })}
      </div>

      {/* Zone legend */}
      {Object.keys(legend).length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
          {Object.entries(legend).map(([color, desc]) => (
            <div key={color} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bell button
// ─────────────────────────────────────────────────────────────────────────────

function NotificationBell({ matchId, getToken }) {
  const { subscribed, supported, permission, loading, toggle } = useNotifications(matchId, getToken)

  if (!supported) return null

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={toggle}
      disabled={loading || permission === 'denied'}
      title={
        permission === 'denied' ? 'Notifications blocked in browser settings'
        : subscribed ? 'Turn off match notifications'
        : 'Get notified for goals, cards & more'
      }
      className="relative flex items-center justify-center w-9 h-9 rounded-full transition-colors"
      style={{
        background: subscribed ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.12)',
        border: 'none', cursor: permission === 'denied' ? 'not-allowed' : 'pointer',
      }}>
      <AnimatePresence mode="wait">
        <motion.div key={subscribed ? 'on' : 'off'}
          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
          {subscribed
            ? <Bell size={16} color="#22c55e" fill="#22c55e" />
            : <BellOff size={16} color="rgba(255,255,255,0.65)" />
          }
        </motion.div>
      </AnimatePresence>
      {subscribed && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
          style={{ background: '#22c55e', borderColor: 'transparent' }} />
      )}
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
      )}
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const TABS = ['Details', 'Odds', 'Lineups', 'Statistics', 'AI Insights', 'Standings']
const LIVE = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'])

export default function MatchDetail({ matchId, onBack, defaultTab }) {
  const { getToken } = useAuth()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [tab, setTab]         = useState(defaultTab || 'Lineups')

  const load = useCallback(async () => {
    try {
      setError(null)
      const d = await apiFetch(`/api/matches/${matchId}/detail`, getToken)
      setData(d)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [matchId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // Auto-refresh every 60s while live
  useEffect(() => {
    if (!data || !LIVE.has(data.status)) return
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [data?.status, load])

  const isLive = data && LIVE.has(data.status)

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Green header ── */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(155deg, #14532d 0%, #15803d 55%, #166534 100%)' }}>

        {/* League logo watermark */}
        {data?.league?.logo && (
          <img src={data.league.logo} alt=""
            className="absolute pointer-events-none select-none"
            style={{ width: 160, height: 160, objectFit: 'contain', opacity: 0.08,
              top: '50%', left: '50%', transform: 'translate(-50%, -55%)' }} />
        )}

        {/* Top bar */}
        <div className="relative flex items-center justify-between px-4 pt-4 pb-2">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: 'rgba(255,255,255,0.8)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={20} /> Back
          </motion.button>
          <div className="flex items-center gap-2">
            <NotificationBell matchId={matchId} getToken={getToken} />
            <motion.button whileTap={{ scale: 0.9 }} onClick={load}
              style={{ background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={15} />
            </motion.button>
          </div>
        </div>

        {/* Match core info */}
        <div className="relative px-5 pt-1 pb-6">
          {loading && !data && (
            <div className="flex justify-center gap-4 py-4">
              <SkeletonBar width={56} height={56} rounded="rounded-full" style={{ opacity: 0.2 }} />
              <SkeletonBar width={80} height={48} rounded="rounded-xl" style={{ opacity: 0.2 }} />
              <SkeletonBar width={56} height={56} rounded="rounded-full" style={{ opacity: 0.2 }} />
            </div>
          )}
          {error && !data && (
            <p className="text-center text-sm text-white/60 py-4">{error}</p>
          )}
          {data && (
            <>
              <p className="text-center text-[10px] font-medium uppercase tracking-widest mb-4"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                {data.league?.name}
              </p>
              <div className="flex items-center justify-between gap-3">
                {/* Home */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  {data.homeTeam?.logo
                    ? <img src={data.homeTeam.logo} alt={data.homeTeam.name} className="w-14 h-14 object-contain drop-shadow-lg" />
                    : <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-black">
                        {data.homeTeam?.name?.[0]}
                      </div>
                  }
                  <span className="text-xs font-bold text-white text-center leading-tight">{data.homeTeam?.name}</span>
                </div>

                {/* Score */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-black text-white tabular-nums">{data.scoreHome}</span>
                    <div className="flex flex-col items-center gap-1">
                      {isLive
                        ? <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
                            className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                            style={{ background: 'rgba(239,68,68,0.9)' }}>
                            {data.minute}'
                          </motion.span>
                        : <span className="text-white/50 text-xs font-bold px-2 py-1">{data.status}</span>
                      }
                    </div>
                    <span className="text-4xl font-black text-white tabular-nums">{data.scoreAway}</span>
                  </div>
                  {data.half && <span className="text-[10px] text-white/40">{data.half}</span>}
                  {data.scoreHT?.home != null && (
                    <span className="text-[10px] text-white/35">
                      HT: {data.scoreHT.home} – {data.scoreHT.away}
                    </span>
                  )}
                </div>

                {/* Away */}
                <div className="flex-1 flex flex-col items-center gap-2">
                  {data.awayTeam?.logo
                    ? <img src={data.awayTeam.logo} alt={data.awayTeam.name} className="w-14 h-14 object-contain drop-shadow-lg" />
                    : <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-black">
                        {data.awayTeam?.name?.[0]}
                      </div>
                  }
                  <span className="text-xs font-bold text-white text-center leading-tight">{data.awayTeam?.name}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tab bar — scrollable */}
        <div className="flex overflow-x-auto no-scrollbar"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="relative flex-shrink-0 px-5 py-3 text-sm font-semibold transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? 'white' : 'rgba(255,255,255,0.4)' }}>
              {t}
              {tab === t && (
                <motion.div layoutId="match-tab-line"
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-white"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
          className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full pb-24 md:pb-8">

          {tab === 'Details'    && <DetailsTab   events={data?.events}      homeId={data?.homeTeam?.id} />}
          {tab === 'Odds'       && <OddsTab      matchId={matchId}           getToken={getToken} />}
          {tab === 'Lineups'    && <LineupsTab   lineups={data?.lineups}     homeTeam={data?.homeTeam} awayTeam={data?.awayTeam} />}
          {tab === 'Statistics' && <StatisticsTab statistics={data?.statistics} homeTeam={data?.homeTeam} awayTeam={data?.awayTeam} />}
          {tab === 'AI Insights'&& <InsightsTab  matchId={matchId}           getToken={getToken} />}
          {tab === 'Standings'  && <StandingsTab leagueId={data?.league?.id} startTime={data?.startTime} homeTeamName={data?.homeTeam?.name} awayTeamName={data?.awayTeam?.name} />}

        </motion.div>
      </AnimatePresence>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, Moon, Sun, TrendingUp, Zap, Shield, Target,
  Pencil, Check, X, ChevronDown, ChevronUp, Volume2,
} from 'lucide-react'
import { useAuth }  from '../hooks/useAuth'
import { useStats } from '../hooks/useStats'
import { useTheme } from '../context/ThemeContext'
import { apiFetch } from '../api/client'
import { playSound } from '../utils/sounds'
import { SkeletonBar } from '../components/ui/AnimatedLoadingSkeleton'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n = 0) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
  }).format(n)
}

function joinDate(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleDateString([], { month: 'long', year: 'numeric' })
}

function confColor(c) {
  return c >= 60 ? '#22c55e' : c >= 45 ? '#f59e0b' : '#ef4444'
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar color presets
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = {
  green:  'linear-gradient(135deg, #16a34a, #15803d)',
  blue:   'linear-gradient(135deg, #2563eb, #1d4ed8)',
  purple: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
  orange: 'linear-gradient(135deg, #ea580c, #c2410c)',
  red:    'linear-gradient(135deg, #dc2626, #b91c1c)',
  teal:   'linear-gradient(135deg, #0d9488, #0f766e)',
  gold:   'linear-gradient(135deg, #d97706, #b45309)',
  pink:   'linear-gradient(135deg, #db2777, #be185d)',
}

const AVATAR_EMOJIS = ['', '⚽', '🏆', '🎯', '🔥', '⚡', '🦁', '🐺', '🦅', '🎲']

// ─────────────────────────────────────────────────────────────────────────────
// Notification types config
// ─────────────────────────────────────────────────────────────────────────────

const NOTIF_TYPES = [
  { key: 'prematch',       emoji: '⏰', label: 'Pre-Match Alert', desc: '~15 min before kickoff'         },
  { key: 'goals',          emoji: '⚽', label: 'Goals',           desc: 'When a goal is scored'          },
  { key: 'redCards',       emoji: '🟥', label: 'Red Cards',       desc: 'Player sent off'                },
  { key: 'cancelledGoal',  emoji: '🚫', label: 'Cancelled Goal',  desc: 'Goal ruled out by VAR'          },
  { key: 'kickoff',        emoji: '🏁', label: 'Kick Off',        desc: 'Match starts'                   },
  { key: 'halfTime',       emoji: '⏸', label: 'Half Time',       desc: 'First half ends'                },
  { key: 'fullTime',       emoji: '🏆', label: 'Full Time',       desc: 'Final whistle'                  },
]

const DEFAULT_PREFS = Object.fromEntries(
  NOTIF_TYPES.map(({ key }) => [key, { enabled: true }])
)

// ─────────────────────────────────────────────────────────────────────────────
// Radial Win Rate Ring
// ─────────────────────────────────────────────────────────────────────────────

function RadialRing({ value = 0, size = 96, stroke = 9 }) {
  const r    = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const color = confColor(value)
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (value / 100) * circ }}
        transition={{ duration: 1.3, ease: 'easeOut' }} />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk badge meta
// ─────────────────────────────────────────────────────────────────────────────

const RISK_META = {
  conservative: { label: 'Conservative', color: '#60a5fa', bg: 'rgba(96,165,250,0.2)',  Icon: Shield },
  balanced:     { label: 'Balanced',     color: '#f59e0b', bg: 'rgba(245,158,11,0.2)',  Icon: Target },
  aggressive:   { label: 'Aggressive',   color: '#ef4444', bg: 'rgba(239,68,68,0.2)',   Icon: Zap   },
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Header + Edit Panel
// ─────────────────────────────────────────────────────────────────────────────

function ProfileHeader({ user, stats, profile, onProfileSaved }) {
  const { getToken }          = useAuth()
  const [editing, setEditing] = useState(false)
  const [nick, setNick]       = useState(profile?.nickname || '')
  const [color, setColor]     = useState(profile?.avatarColor || 'green')
  const [emoji, setEmoji]     = useState(profile?.avatarEmoji || '')
  const [saving, setSaving]   = useState(false)

  // Sync when profile loads
  useEffect(() => {
    setNick(profile?.nickname || '')
    setColor(profile?.avatarColor || 'green')
    setEmoji(profile?.avatarEmoji || '')
  }, [profile])

  async function save() {
    setSaving(true)
    try {
      const saved = await apiFetch('/api/profile', getToken, {
        method: 'PUT',
        body: JSON.stringify({ nickname: nick, avatarColor: color, avatarEmoji: emoji }),
      })
      onProfileSaved(saved)
      setEditing(false)
    } catch {}
    finally { setSaving(false) }
  }

  const displayName = profile?.nickname || user?.email?.split('@')[0] || 'User'
  const initials    = emoji || displayName.slice(0, 2).toUpperCase()
  const gradient    = AVATAR_COLORS[color] || AVATAR_COLORS.green
  const risk        = stats?.riskProfile || 'balanced'
  const rm          = RISK_META[risk] || RISK_META.balanced

  return (
    <div className="relative overflow-hidden"
      style={{ background: 'linear-gradient(155deg, #14532d 0%, #15803d 55%, #166534 100%)' }}>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style={{ opacity: 0.04 }}>
        <TrendingUp size={220} color="white" />
      </div>

      <div className="relative px-5 pt-6 pb-5 flex flex-col gap-4">
        {/* Avatar + info row */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg shrink-0"
            style={{ background: gradient }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base truncate">{displayName}</p>
            <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {user?.email}
            </p>
            {user?.metadata?.creationTime && (
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Since {joinDate(user.metadata.creationTime)}
              </p>
            )}
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing(e => !e)}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}>
            <Pencil size={13} color="white" />
          </motion.button>
        </div>

        {/* Risk badge */}
        {stats && (
          <div className="flex items-center gap-2 w-fit px-3 py-1.5 rounded-full"
            style={{ background: rm.bg, border: `1px solid ${rm.color}40` }}>
            <rm.Icon size={11} style={{ color: rm.color }} />
            <span className="text-xs font-bold" style={{ color: rm.color }}>
              {rm.label} Risk Profile
            </span>
          </div>
        )}
      </div>

      {/* Edit Panel */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="overflow-hidden"
            style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="px-5 py-4 flex flex-col gap-4">

              {/* Nickname */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>Nickname</label>
                <input
                  value={nick} onChange={e => setNick(e.target.value)} maxLength={30}
                  placeholder="Your display name"
                  className="w-full px-3 py-2 rounded-xl text-sm font-medium outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.12)', color: 'white',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }} />
              </div>

              {/* Avatar colour */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>Avatar Colour</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(AVATAR_COLORS).map(([key, grad]) => (
                    <button key={key} onClick={() => setColor(key)}
                      className="w-8 h-8 rounded-full shrink-0 transition-transform"
                      style={{
                        background: grad, border: 'none', cursor: 'pointer',
                        transform: color === key ? 'scale(1.25)' : 'scale(1)',
                        boxShadow: color === key ? '0 0 0 2px white' : 'none',
                      }} />
                  ))}
                </div>
              </div>

              {/* Emoji / icon */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>Avatar Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_EMOJIS.map((em, i) => (
                    <button key={i} onClick={() => setEmoji(em)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                      style={{
                        background: emoji === em ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                        border: emoji === em ? '1px solid rgba(255,255,255,0.6)' : '1px solid transparent',
                        cursor: 'pointer',
                      }}>
                      {em || <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>AB</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2">
                <button onClick={save} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#22c55e', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  <Check size={14} /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  <X size={14} /> Cancel
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Win Rate Hero
// ─────────────────────────────────────────────────────────────────────────────

function WinRateHero({ stats, loading }) {
  const rate  = stats?.winRate ?? 0
  const color = confColor(rate)
  return (
    <motion.div className="card p-5 flex items-center gap-5"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="relative shrink-0">
        <RadialRing value={rate} size={96} stroke={9} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading
            ? <SkeletonBar width={36} height={14} delay={0} />
            : <span className="text-xl font-black" style={{ color }}>{rate}%</span>
          }
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Win Rate</p>
        {loading ? <SkeletonBar width="60%" height={20} delay={0.05} /> : (
          <>
            <p className="text-2xl font-black" style={{ color }}>{rate}%</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {stats?.wonBets ?? 0}W · {stats?.lostBets ?? 0}L · {stats?.cashoutBets ?? 0} cashout
            </p>
          </>
        )}
      </div>
      {!loading && stats?.streak?.count > 0 && (
        <div className="shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl"
          style={{ background: stats.streak.type === 'won' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
          <span className="text-xl">{stats.streak.type === 'won' ? '🔥' : '❄️'}</span>
          <span className="text-xs font-black"
            style={{ color: stats.streak.type === 'won' ? '#22c55e' : '#ef4444' }}>
            {stats.streak.count}
          </span>
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>streak</span>
        </div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats 2×2 grid
// ─────────────────────────────────────────────────────────────────────────────

function StatsGrid({ stats, loading }) {
  const tiles = [
    { label: 'Profit/Loss', value: fmt(stats?.profit),              sub: `Staked: ${fmt(stats?.totalSpent)}`, color: (stats?.profit ?? 0) >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'ROI',         value: `${stats?.roi ?? 0}%`,           sub: 'Return on investment',              color: (stats?.roi ?? 0) >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Total Bets',  value: stats?.totalBets ?? 0,           sub: `${stats?.pendingBets ?? 0} pending` },
    { label: 'Avg Odds',    value: stats?.avgOdds > 0 ? `${stats.avgOdds}x` : '—', sub: `Best streak: ${stats?.bestStreak ?? 0}W` },
  ]
  if (loading) return (
    <div className="grid grid-cols-2 gap-3">
      {[0, 0.05, 0.1, 0.15].map((d, i) => (
        <div key={i} className="card p-4 flex flex-col gap-2">
          <SkeletonBar width="60%" height={9} delay={d} />
          <SkeletonBar width="80%" height={20} delay={d + 0.05} />
        </div>
      ))}
    </div>
  )
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((t, i) => (
        <motion.div key={i} className="card p-4 flex flex-col gap-1"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 + i * 0.04 }}>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t.label}</p>
          <p className="text-lg font-black" style={{ color: t.color || 'var(--text)' }}>{t.value}</p>
          {t.sub && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.sub}</p>}
        </motion.div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity chart (30 days)
// ─────────────────────────────────────────────────────────────────────────────

function ActivityChart({ activity, loading }) {
  const max     = Math.max(...(activity || []).map(d => d.total), 1)
  const hasData = (activity || []).some(d => d.total > 0)
  return (
    <motion.div className="card p-4 flex flex-col gap-3"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Activity · Last 30 Days
      </p>
      {loading || !hasData ? (
        <div className="h-14 flex items-center justify-center">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Loading…' : 'No activity yet'}
          </p>
        </div>
      ) : (
        <div className="flex items-end gap-0.5" style={{ height: 56 }}>
          {(activity || []).map((d, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end" style={{ height: '100%' }}>
              {d.total > 0 && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: `${(d.total / max) * 100}%` }}
                  transition={{ duration: 0.45, delay: i * 0.01, ease: 'easeOut' }}
                  className="w-full rounded-t-sm"
                  style={{ background: d.won > 0 ? 'var(--accent)' : 'var(--border)', minHeight: 4 }} />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between text-[9px]" style={{ color: 'var(--text-muted)' }}>
        <span>30 days ago</span><span>Today</span>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Achievements
// ─────────────────────────────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: 'first_bet',  emoji: '🎯', label: 'First Bet',     desc: 'Placed first bet',            unlock: s => s.totalBets >= 1 },
  { id: 'first_win',  emoji: '🏆', label: 'First Win',     desc: 'Won first bet',               unlock: s => s.wonBets >= 1 },
  { id: 'ten_bets',   emoji: '🎲', label: '10 Bets',       desc: '10 bets placed',              unlock: s => s.totalBets >= 10 },
  { id: 'fifty_bets', emoji: '💯', label: '50 Bets',       desc: '50 bets placed',              unlock: s => s.totalBets >= 50 },
  { id: 'streak3',    emoji: '🔥', label: 'On Fire',       desc: '3-win streak achieved',       unlock: s => s.bestStreak >= 3 },
  { id: 'streak5',    emoji: '🚀', label: 'Hot Streak',    desc: '5-win streak achieved',       unlock: s => s.bestStreak >= 5 },
  { id: 'in_profit',  emoji: '📈', label: 'In Profit',     desc: 'Positive ROI, 5+ bets',       unlock: s => s.roi > 0 && s.totalBets >= 5 },
  { id: 'sharp',      emoji: '🎖️', label: 'Sharp Bettor',  desc: '60%+ win rate, 10+ bets',     unlock: s => s.winRate >= 60 && (s.wonBets + s.lostBets) >= 10 },
  { id: 'big_win',    emoji: '💰', label: 'Big Win',       desc: '₦5k+ profit in one bet',      unlock: s => s.largestWin >= 5000 },
]

function AchievementsSection({ stats, loading }) {
  const s        = stats || {}
  const unlocked = ACHIEVEMENTS.filter(a => a.unlock(s))
  const locked   = ACHIEVEMENTS.filter(a => !a.unlock(s))

  return (
    <motion.div className="card p-4 flex flex-col gap-3"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Achievements
        </p>
        <span className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
          {loading ? '…' : `${unlocked.length}/${ACHIEVEMENTS.length}`}
        </span>
      </div>
      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBar key={i} width="100%" height={68} delay={i * 0.04} rounded="rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {unlocked.map((a, i) => (
            <motion.div key={a.id}
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22 + i * 0.06 }}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-center"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <span className="text-2xl">{a.emoji}</span>
              <span className="text-[10px] font-bold leading-tight" style={{ color: '#22c55e' }}>{a.label}</span>
              <span className="text-[9px] leading-snug" style={{ color: 'var(--text-muted)' }}>{a.desc}</span>
            </motion.div>
          ))}
          {locked.map(a => (
            <div key={a.id} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-center opacity-35"
              style={{ background: 'var(--surface2)' }}>
              <span className="text-2xl grayscale">{a.emoji}</span>
              <span className="text-[10px] font-bold leading-tight" style={{ color: 'var(--text-muted)' }}>{a.label}</span>
              <span className="text-[9px] leading-snug" style={{ color: 'var(--text-muted)' }}>{a.desc}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Betting Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function BettingInsight({ stats }) {
  if (!stats || stats.totalBets < 3) return null
  const lines = []
  if (stats.winRate >= 65 && (stats.wonBets + stats.lostBets) >= 5)
    lines.push({ icon: '🎯', text: `${stats.winRate}% win rate — above-market accuracy.` })
  else if (stats.winRate < 45 && (stats.wonBets + stats.lostBets) >= 5)
    lines.push({ icon: '⚠️', text: 'Win rate below 45% — try higher-confidence AI picks.' })
  if (stats.roi > 15)
    lines.push({ icon: '📈', text: `${stats.roi}% ROI — your selections generate strong value.` })
  else if (stats.roi < -10)
    lines.push({ icon: '📉', text: 'Negative ROI — smaller stakes on uncertain markets until form improves.' })
  if (stats.streak?.type === 'won' && stats.streak.count >= 3)
    lines.push({ icon: '🔥', text: `${stats.streak.count}-win streak — stay disciplined, avoid overconfidence.` })
  else if (stats.streak?.type === 'lost' && stats.streak.count >= 3)
    lines.push({ icon: '❄️', text: `${stats.streak.count}-loss run — review AI analysis before the next bet.` })
  if (stats.riskProfile === 'aggressive')
    lines.push({ icon: '⚡', text: 'High-odds player. Mix in safer markets for long-term stability.' })
  else if (stats.riskProfile === 'conservative')
    lines.push({ icon: '🛡️', text: 'Conservative style — consistent foundation for long-term profit.' })
  if (!lines.length) return null
  return (
    <motion.div className="card p-4 flex flex-col gap-3"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Betting Intelligence
      </p>
      <div className="flex flex-col gap-2.5">
        {lines.map((l, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-base shrink-0 mt-0.5">{l.icon}</span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{l.text}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Settings
// ─────────────────────────────────────────────────────────────────────────────

function NotificationSettings({ prefs, onChange, saving }) {
  const [open, setOpen] = useState(false)
  const enabledCount    = NOTIF_TYPES.filter(t => prefs?.[t.key]?.enabled !== false).length

  function toggle(key) {
    const current = prefs?.[key]?.enabled !== false
    onChange({ ...prefs, [key]: { ...(prefs?.[key] || {}), enabled: !current } })
  }

  return (
    <motion.div className="card overflow-hidden"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.29 }}>

      {/* Header row */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--surface2)' }}>
            <Volume2 size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Notifications</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {enabledCount} of {NOTIF_TYPES.length} types enabled
              {saving && ' · Saving…'}
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
              : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="overflow-hidden">
            <div className="flex flex-col divide-y" style={{ borderTop: '1px solid var(--border)' }}>
              {NOTIF_TYPES.map(({ key, emoji, label, desc }) => {
                const enabled = prefs?.[key]?.enabled !== false
                return (
                  <div key={key} className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => playSound(key)}
                      className="text-xl w-8 text-center shrink-0 rounded-lg py-0.5 transition-opacity"
                      title="Preview sound"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: enabled ? 1 : 0.4 }}>
                      {emoji}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                    </div>
                    <button onClick={() => toggle(key)}
                      className="relative w-10 h-5 rounded-full shrink-0 transition-colors"
                      style={{ background: enabled ? 'var(--accent)' : 'var(--surface2)', border: 'none', cursor: 'pointer' }}>
                      <motion.div
                        animate={{ x: enabled ? 18 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow" />
                    </button>
                  </div>
                )
              })}
              <div className="px-4 py-2.5">
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Tap an emoji to preview its sound · Changes saved automatically
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function Profile() {
  const { currentUser, logout, getToken } = useAuth()
  const { stats, loading: statsLoading }  = useStats(0)
  const { theme, toggle }                 = useTheme()

  const [profile, setProfile]     = useState(null)
  const [prefs, setPrefs]         = useState(DEFAULT_PREFS)
  const [prefSaving, setPrefSaving] = useState(false)
  const saveTimer = useRef(null)

  // Load profile on mount
  useEffect(() => {
    apiFetch('/api/profile', getToken)
      .then(p => { setProfile(p); setPrefs(p.notificationPrefs || DEFAULT_PREFS) })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save notification prefs with 800ms debounce
  useEffect(() => {
    if (!profile) return  // don't save before initial load
    clearTimeout(saveTimer.current)
    setPrefSaving(true)
    saveTimer.current = setTimeout(async () => {
      try {
        await apiFetch('/api/profile', getToken, {
          method: 'PUT',
          body: JSON.stringify({ notificationPrefs: prefs }),
        })
      } catch {}
      finally { setPrefSaving(false) }
    }, 800)
  }, [prefs]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col pb-24 md:pb-8 -mx-4 -mt-5 md:-mx-8 md:-mt-6">

      {/* Full-bleed header + edit panel */}
      <ProfileHeader
        user={currentUser}
        stats={stats}
        profile={profile}
        onProfileSaved={p => { setProfile(p); setPrefs(p.notificationPrefs || DEFAULT_PREFS) }}
      />

      <div className="flex flex-col gap-4 px-4 pt-4 max-w-lg mx-auto w-full">

        {/* Win Rate */}
        <WinRateHero stats={stats} loading={statsLoading} />

        {/* Stats grid */}
        <StatsGrid stats={stats} loading={statsLoading} />

        {/* Activity */}
        <ActivityChart activity={stats?.activity} loading={statsLoading} />

        {/* Achievements */}
        <AchievementsSection stats={stats} loading={statsLoading} />

        {/* Derived insight */}
        <BettingInsight stats={stats} />

        {/* Notification settings */}
        <NotificationSettings prefs={prefs} onChange={setPrefs} saving={prefSaving} />

        {/* Dark mode */}
        <motion.div className="card p-4"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--surface2)' }}>
                {theme === 'dark'
                  ? <Sun  size={15} style={{ color: '#f59e0b' }} />
                  : <Moon size={15} style={{ color: '#6366f1' }} />
                }
              </div>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              </span>
            </div>
            <button onClick={toggle}
              className="relative w-11 h-6 rounded-full transition-colors duration-300"
              style={{ background: theme === 'dark' ? 'var(--surface2)' : 'var(--accent)', border: 'none', cursor: 'pointer' }}>
              <motion.div
                animate={{ x: theme === 'dark' ? 2 : 22 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow" />
            </button>
          </div>
        </motion.div>

        {/* Logout */}
        <motion.button onClick={logout} whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="card p-4 flex items-center gap-3 w-full text-left"
          style={{ cursor: 'pointer', color: 'var(--danger)', border: '1px solid var(--danger-dim)' }}>
          <LogOut size={17} />
          <span className="text-sm font-semibold">Log out</span>
        </motion.button>

      </div>
    </div>
  )
}

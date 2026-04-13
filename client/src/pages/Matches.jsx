import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMatches } from '../hooks/useMatches'
import { useAuth } from '../hooks/useAuth'
import { apiFetch } from '../api/client'
import { SkeletonBar } from '../components/ui/AnimatedLoadingSkeleton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function teamInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth() &&
    a.getDate()     === b.getDate()
}

// Build a 10-day strip: 3 past + today + 6 ahead
function buildDays() {
  const days = []
  for (let i = -3; i <= 6; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

function toDateStr(d) {
  return d.toISOString().split('T')[0]
}

const FINALIZED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])
const LIVE_ST   = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'])

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Team avatar (logo or coloured initials) ──────────────────────────────────

function TeamAvatar({ logo, name, size = 44 }) {
  if (logo) {
    return (
      <img src={logo} alt={name}
        style={{ width: size, height: size, objectFit: 'contain' }} />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--surface2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.28, fontWeight: 800, color: 'var(--text-muted)',
    }}>
      {teamInitials(name)}
    </div>
  )
}

// ─── Date strip ───────────────────────────────────────────────────────────────

function DateStrip({ selected, onChange }) {
  const days = useMemo(buildDays, [])
  const today = new Date()

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {days.map((d, i) => {
        const active = sameDay(d, selected)
        const isToday = sameDay(d, today)
        return (
          <motion.button key={i} onClick={() => onChange(d)}
            whileTap={{ scale: 0.92 }}
            style={{
              flexShrink: 0, width: 52, height: 64,
              borderRadius: 16, border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              background: active ? 'var(--accent)' : 'var(--surface2)',
              transition: 'background 0.18s',
            }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
              color: active ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
            }}>
              {DAY_LABELS[d.getDay()]}
            </span>
            <span style={{
              fontSize: 18, fontWeight: 800, lineHeight: 1,
              color: active ? '#fff' : isToday ? 'var(--accent)' : 'var(--text)',
            }}>
              {String(d.getDate()).padStart(2, '0')}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Live hero card ───────────────────────────────────────────────────────────

function LiveHeroCard({ m, openMatch }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => openMatch?.(m.matchId)}
      style={{
        borderRadius: 24, overflow: 'hidden', cursor: 'pointer', position: 'relative',
        background: 'linear-gradient(135deg, #0f3460 0%, #16213e 40%, #1a1a2e 100%)',
        minHeight: 160,
      }}>

      {/* Decorative circles */}
      <div style={{
        position: 'absolute', width: 200, height: 200, borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)', top: -60, left: -40, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 160, height: 160, borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)', bottom: -50, right: -30, pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', padding: '20px 24px' }}>
        {/* Top row: live badge + league */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
            style={{
              background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 20,
            }}>
            {m.minute}'
          </motion.span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
            {m.league}
          </span>
        </div>

        {/* Teams + score */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {/* Home */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <TeamAvatar logo={m.teamALogo} name={m.teamA} size={52} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>
              {m.teamA}
            </span>
          </div>

          {/* Score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: -1, lineHeight: 1 }}>
              {m.scoreA ?? 0} : {m.scoreB ?? 0}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              LIVE
            </span>
          </div>

          {/* Away */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <TeamAvatar logo={m.teamBLogo} name={m.teamB} size={52} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>
              {m.teamB}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── League filter pills ──────────────────────────────────────────────────────

const LEAGUE_ABBR = {
  // Top 5
  'Premier League':                    'EPL',
  'Championship':                      'Championship',
  'La Liga':                           'La Liga',
  'Serie A':                           'Serie A',
  'Bundesliga':                        'Bundesliga',
  'Ligue 1':                           'Ligue 1',
  // Other domestic
  'Eredivisie':                        'Eredivisie',
  'Süper Lig':                         'Süper Lig',
  'Major League Soccer':               'MLS',
  'Saudi Pro League':                  'Saudi PL',
  // European competitions
  'UEFA Champions League':             'UCL',
  'UEFA Europa League':                'UEL',
  'UEFA Europa Conference League':     'UECL',
  // International
  'FIFA World Cup':                    'World Cup',
  'UEFA European Championship':        'Euros',
  // Domestic cups
  'FA Cup':                            'FA Cup',
  'EFL Cup':                           'EFL Cup',
  'Copa del Rey':                      'Copa del Rey',
  'Coppa Italia':                      'Coppa Italia',
  'DFB-Pokal':                         'DFB-Pokal',
  'Coupe de France':                   'Coupe de France',
}

function LeagueFilter({ leagues, selected, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      <button onClick={() => onChange(null)}
        style={{
          flexShrink: 0, padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
          fontWeight: 700, fontSize: 12,
          background: !selected ? 'var(--accent)' : 'var(--surface2)',
          color: !selected ? '#fff' : 'var(--text-muted)',
          transition: 'background 0.15s, color 0.15s',
        }}>
        All
      </button>
      {leagues.map(league => (
        <button key={league} onClick={() => onChange(league)}
          style={{
            flexShrink: 0, padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12,
            background: selected === league ? 'var(--accent)' : 'var(--surface2)',
            color: selected === league ? '#fff' : 'var(--text-muted)',
            transition: 'background 0.15s, color 0.15s',
          }}>
          {LEAGUE_ABBR[league] || league}
        </button>
      ))}
    </div>
  )
}

// ─── Match row (handles NS / live / finished) ─────────────────────────────────

function MatchRow({ m, i, openMatch }) {
  const time     = new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const isLive   = LIVE_ST.has(m.status)
  const isDone   = FINALIZED.has(m.status)
  const hasScore = isLive || isDone

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      onClick={() => openMatch?.(m.matchId)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        borderRadius: 16, cursor: 'pointer',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
      whileHover={{ background: 'var(--surface2)' }}
      whileTap={{ scale: 0.98 }}>

      <TeamAvatar logo={m.teamALogo} name={m.teamA} size={40} />

      <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        {/* Status badge */}
        {isLive ? (
          <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.3, repeat: Infinity }}
            style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#ef4444',
              padding: '1px 7px', borderRadius: 10, display: 'inline-block', marginBottom: 3 }}>
            {m.minute}' LIVE
          </motion.span>
        ) : isDone ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            display: 'block', marginBottom: 2 }}>FT</span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            display: 'block', marginBottom: 2 }}>{time}</span>
        )}

        {/* Score or team names */}
        {hasScore ? (
          <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.5 }}>
            {m.scoreA ?? 0} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>–</span> {m.scoreB ?? 0}
          </p>
        ) : (
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.teamA} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>vs</span> {m.teamB}
          </p>
        )}

        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          {LEAGUE_ABBR[m.league] || m.league}
        </p>
      </div>

      <TeamAvatar logo={m.teamBLogo} name={m.teamB} size={40} />
    </motion.div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
      borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <SkeletonBar width={40} height={40} rounded="rounded-full" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <SkeletonBar width={60} height={10} />
        <SkeletonBar width={140} height={13} />
        <SkeletonBar width={80} height={10} />
      </div>
      <SkeletonBar width={40} height={40} rounded="rounded-full" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Matches({ openMatch }) {
  const { live, lastUpdated, stale } = useMatches()
  const { getToken } = useAuth()

  const [selectedDate, setSelectedDate]     = useState(new Date())
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [dayMatches, setDayMatches] = useState([])
  const [loading, setLoading]       = useState(true)

  const isToday = sameDay(selectedDate, new Date())

  // Fetch matches for the selected date — cancel in-flight request on date change
  useEffect(() => {
    let cancelled = false
    const dateStr = toDateStr(selectedDate)

    setLoading(true)
    setDayMatches([])

    apiFetch(`/api/matches/day/${dateStr}`, getToken)
      .then(json  => { if (!cancelled) setDayMatches(json.matches || []) })
      .catch(()   => { if (!cancelled) setDayMatches([]) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // On today, merge live scores into dayMatches (live data is fresher)
  const mergedMatches = useMemo(() => {
    if (!isToday || !live.length) return dayMatches
    const liveMap = Object.fromEntries(live.map(m => [m.matchId, m]))
    return dayMatches.map(m => liveMap[m.matchId]
      ? { ...m, ...liveMap[m.matchId], teamALogo: m.teamALogo, teamBLogo: m.teamBLogo }
      : m
    )
  }, [dayMatches, live, isToday])

  // Live matches from today's day data (for hero cards)
  const liveMatches = useMemo(() =>
    isToday ? live : [],
    [live, isToday]
  )

  // Unique leagues in the day's matches
  const leagues = useMemo(() => {
    const seen = new Set()
    return mergedMatches.filter(m => {
      if (seen.has(m.league)) return false
      seen.add(m.league); return true
    }).map(m => m.league)
  }, [mergedMatches])

  const filteredMatches = useMemo(() =>
    selectedLeague ? mergedMatches.filter(m => m.league === selectedLeague) : mergedMatches,
    [mergedMatches, selectedLeague]
  )

  function handleDateChange(d) {
    setSelectedDate(d)
    setSelectedLeague(null)
  }

  const headingLabel = isToday
    ? "Today's Matches"
    : selectedDate < new Date(toDateStr(new Date()))
      ? selectedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
      : selectedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-8">

      {/* Date strip */}
      <DateStrip selected={selectedDate} onChange={handleDateChange} />

      {/* Live hero cards — today only */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="live-dot" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Live Now</h2>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
              background: 'var(--danger-dim)', color: 'var(--danger)',
            }}>{liveMatches.length}</span>
            {lastUpdated && (
              <span style={{ fontSize: 10, marginLeft: 'auto',
                color: stale ? 'var(--warning)' : 'var(--text-muted)' }}>
                {stale ? '⚠ ' : ''}Updated {lastUpdated}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {liveMatches.map(m => <LiveHeroCard key={m.matchId} m={m} openMatch={openMatch} />)}
          </div>
        </section>
      )}

      {/* Day match list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {headingLabel}
          </h2>
          {!loading && filteredMatches.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filteredMatches.length} matches</span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {[60, 70, 80, 65].map((w, i) => (
                <SkeletonBar key={i} width={w} height={32} rounded="rounded-full" delay={i * 0.06} />
              ))}
            </div>
            {[0, 0.06, 0.12, 0.18].map((d, i) => <SkeletonRow key={i} delay={d} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {leagues.length > 1 && (
              <LeagueFilter leagues={leagues} selected={selectedLeague} onChange={setSelectedLeague} />
            )}

            <AnimatePresence mode="wait">
              <motion.div key={`${toDateStr(selectedDate)}-${selectedLeague || 'all'}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-3">
                {filteredMatches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No matches on this day</p>
                  </div>
                ) : (
                  filteredMatches.map((m, i) => (
                    <MatchRow key={m.matchId} m={m} i={i} openMatch={openMatch} />
                  ))
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  )
}

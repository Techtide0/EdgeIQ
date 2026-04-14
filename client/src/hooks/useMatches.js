import { useState, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { apiFetch } from '../api/client'
import { playSound } from '../utils/sounds'

const LIVE_INTERVAL_MS     = 90 * 1000       // 90 seconds
const UPCOMING_INTERVAL_MS = 30 * 60 * 1000  // 30 minutes

const FINALIZED  = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])
const LIVE_ST    = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'])

// Window for pre-match chime: alert when 10–20 min before kickoff
const PREMATCH_ALERT_MIN_LO = 10
const PREMATCH_ALERT_MIN_HI = 20

export function useMatches() {
  const { getToken } = useAuth()
  const [live, setLive]         = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [stale, setStale]       = useState(false)
  const [loading, setLoading]   = useState(true)

  // Previous state refs — used to detect status changes between polls
  const prevLiveRef      = useRef([])          // previous live array
  const prematchAlertsRef = useRef(new Set())  // matchIds we've already chimed for

  const liveTimerRef     = useRef(null)
  const upcomingTimerRef = useRef(null)

  // ── Sound trigger logic ───────────────────────────────────────────────────────
  function detectSounds(newLive) {
    const prevMap = new Map(prevLiveRef.current.map(m => [m.matchId, m]))

    for (const match of newLive) {
      const prev = prevMap.get(match.matchId)
      const prevStatus = prev?.status || 'NS'
      const currStatus = match.status

      if (prevStatus === currStatus) continue  // no change

      // Kickoff — match transitioned into live for the first time
      if (!LIVE_ST.has(prevStatus) && LIVE_ST.has(currStatus) && currStatus !== 'HT') {
        playSound('kickoff')
        continue
      }

      // Half time
      if (prevStatus !== 'HT' && currStatus === 'HT') {
        playSound('halfTime')
        continue
      }

      // Full time
      if (!FINALIZED.has(prevStatus) && FINALIZED.has(currStatus)) {
        playSound('fullTime')
      }
    }
  }

  function detectPrematchSounds(upcomingMatches) {
    const now = Date.now()
    for (const match of upcomingMatches) {
      if (!match.startTime) continue
      if (prematchAlertsRef.current.has(match.matchId)) continue

      const minsUntil = (new Date(match.startTime) - now) / 60_000
      if (minsUntil >= PREMATCH_ALERT_MIN_LO && minsUntil <= PREMATCH_ALERT_MIN_HI) {
        playSound('prematch')
        prematchAlertsRef.current.add(match.matchId)
      }
    }
  }

  // ── Fetch helpers ─────────────────────────────────────────────────────────────
  async function fetchLive() {
    try {
      const res = await apiFetch('/api/matches/live', getToken)
      const newLive = res.matches || []

      // Only trigger sounds after the initial load (prevLiveRef is populated)
      if (prevLiveRef.current.length > 0) {
        detectSounds(newLive)
      }

      prevLiveRef.current = newLive
      setLive(newLive)
      setLastUpdated(res.lastUpdated)
      setStale(res.stale || false)
    } catch {
      // Keep previous data on failure
    }
  }

  async function fetchUpcoming() {
    try {
      const res = await apiFetch('/api/matches/upcoming', getToken)
      const newUpcoming = res.matches || []
      detectPrematchSounds(newUpcoming)
      setUpcoming(newUpcoming)
    } catch {
      // Keep previous data on failure
    }
  }

  useEffect(() => {
    async function init() {
      await Promise.all([fetchLive(), fetchUpcoming()])
      setLoading(false)
    }
    init()

    // Poll live only when tab is visible
    liveTimerRef.current = setInterval(() => {
      if (!document.hidden) fetchLive()
    }, LIVE_INTERVAL_MS)

    upcomingTimerRef.current = setInterval(() => {
      if (!document.hidden) fetchUpcoming()
    }, UPCOMING_INTERVAL_MS)

    return () => {
      clearInterval(liveTimerRef.current)
      clearInterval(upcomingTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { live, upcoming, lastUpdated, stale, loading }
}

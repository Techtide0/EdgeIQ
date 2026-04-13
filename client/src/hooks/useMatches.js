import { useState, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { apiFetch } from '../api/client'

const LIVE_INTERVAL_MS     = 90 * 1000   // 90 seconds
const UPCOMING_INTERVAL_MS = 30 * 60 * 1000   // 30 minutes

export function useMatches() {
  const { getToken } = useAuth()
  const [live, setLive]         = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [stale, setStale]       = useState(false)
  const [loading, setLoading]   = useState(true)

  const liveTimerRef     = useRef(null)
  const upcomingTimerRef = useRef(null)

  async function fetchLive() {
    try {
      const res = await apiFetch('/api/matches/live', getToken)
      setLive(res.matches || [])
      setLastUpdated(res.lastUpdated)
      setStale(res.stale || false)
    } catch {
      // Keep previous data on failure
    }
  }

  async function fetchUpcoming() {
    try {
      const res = await apiFetch('/api/matches/upcoming', getToken)
      setUpcoming(res.matches || [])
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

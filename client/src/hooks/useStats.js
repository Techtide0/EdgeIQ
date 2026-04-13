import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { apiFetch } from '../api/client'

export function useStats(refreshKey) {
  const { getToken } = useAuth()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/api/stats', getToken)
      setStats(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { fetchStats() }, [fetchStats, refreshKey])

  return { stats, loading, error }
}

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { apiFetch } from '../api/client'

export function useBets() {
  const { getToken } = useAuth()
  const [bets, setBets]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const fetchBets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/api/bets', getToken)
      setBets(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { fetchBets() }, [fetchBets])

  async function createBet(payload) {
    const newBet = await apiFetch('/api/bets', getToken, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setBets(prev => [newBet, ...prev])
  }

  async function updateBet(id, payload) {
    const updated = await apiFetch(`/api/bets/${id}`, getToken, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    setBets(prev => prev.map(b => (b._id === id ? updated : b)))
  }

  async function deleteBet(id) {
    await apiFetch(`/api/bets/${id}`, getToken, { method: 'DELETE' })
    setBets(prev => prev.filter(b => b._id !== id))
  }

  return { bets, loading, error, createBet, updateBet, deleteBet }
}

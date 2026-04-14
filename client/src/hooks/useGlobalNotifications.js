import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api/client'

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

/**
 * Manages a user's subscription to app-wide AI insight alerts.
 * Distinct from useNotifications (which is per-match).
 */
export function useGlobalNotifications(getToken) {
  const [subscribed,  setSubscribed]  = useState(false)
  const [supported,   setSupported]   = useState(false)
  const [permission,  setPermission]  = useState('default')
  const [loading,     setLoading]     = useState(false)

  useEffect(() => {
    const ok = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    setSupported(ok)
    if (ok) setPermission(Notification.permission)

    if (ok) {
      apiFetch('/api/notifications/global-subscribed', getToken)
        .then(d => setSubscribed(d.subscribed))
        .catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(async () => {
    if (!supported || loading) return
    setLoading(true)

    try {
      if (subscribed) {
        await apiFetch('/api/notifications/global-unsubscribe', getToken, { method: 'POST', body: '{}' })
        setSubscribed(false)
        return
      }

      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const { publicKey } = await apiFetch('/api/notifications/vapid-public-key', getToken)

      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await apiFetch('/api/notifications/global-subscribe', getToken, {
        method: 'POST',
        body: JSON.stringify({ subscription: pushSub.toJSON() }),
      })

      setSubscribed(true)
    } catch (err) {
      console.error('[globalNotifications]', err.message)
    } finally {
      setLoading(false)
    }
  }, [subscribed, supported, loading, getToken])

  return { subscribed, supported, permission, loading, toggle }
}

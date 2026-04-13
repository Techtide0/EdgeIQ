import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api/client'

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function useNotifications(matchId, getToken) {
  const [subscribed, setSubscribed] = useState(false)
  const [supported, setSupported]   = useState(false)
  const [permission, setPermission] = useState('default')
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    const ok = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    setSupported(ok)
    if (ok) setPermission(Notification.permission)

    // Check server for existing subscription
    if (ok && matchId) {
      apiFetch(`/api/notifications/subscribed/${matchId}`, getToken)
        .then(d => setSubscribed(d.subscribed))
        .catch(() => {})
    }
  }, [matchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(async () => {
    if (!supported || loading) return
    setLoading(true)

    try {
      if (subscribed) {
        // Unsubscribe
        await apiFetch('/api/notifications/unsubscribe', getToken, {
          method: 'POST',
          body: JSON.stringify({ matchId }),
        })
        setSubscribed(false)
        return
      }

      // Request permission
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Get VAPID public key
      const { publicKey } = await apiFetch('/api/notifications/vapid-public-key', getToken)

      // Create push subscription
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      // Send to server
      await apiFetch('/api/notifications/subscribe', getToken, {
        method: 'POST',
        body: JSON.stringify({ subscription: pushSub.toJSON(), matchId }),
      })

      setSubscribed(true)
    } catch (err) {
      console.error('[notifications]', err.message)
    } finally {
      setLoading(false)
    }
  }, [subscribed, supported, loading, matchId, getToken])

  return { subscribed, supported, permission, loading, toggle }
}

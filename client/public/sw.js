/* EdgeIQ Service Worker — Push Notifications */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', function (event) {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}

  const title   = data.title  || 'EdgeIQ'
  const options = {
    body:    data.body || '',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [100, 50, 200],
    tag:     `match-${data.matchId || 'general'}`,
    renotify: true,
    data:    { matchId: data.matchId, url: '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    })
  )
})

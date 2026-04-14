/* EdgeIQ Service Worker — PWA caching + Push Notifications */

const CACHE_NAME    = 'edgeiq-v1'
const API_PREFIX    = '/api/'

// Static assets to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/edgeiq.png',
  '/edgeiq.ico',
  '/edge.png',
  '/edge-removebg-preview.png',
]

// ── Install — cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate — delete old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch — caching strategies ────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // API calls — network-first, no caching (always fresh data)
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Static assets (JS/CSS bundles, images, fonts) — cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|wav|mp3)$/)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // HTML navigation — network-first, fall back to cached index.html (SPA shell)
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match('/index.html')
      )
  )
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}

  const title   = data.title  || 'EdgeIQ'
  const options = {
    body:     data.body || '',
    icon:     '/edgeiq.png',
    badge:    '/edgeiq.png',
    vibrate:  [100, 50, 200],
    tag:      `match-${data.matchId || 'general'}`,
    renotify: true,
    data:     { matchId: data.matchId, type: data.type || null, url: '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click — open / focus the app and deep-link to match ─────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const { matchId } = event.notification.data || {}

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (matchId) client.postMessage({ type: 'OPEN_MATCH', matchId })
          return client.focus()
        }
      }
      const url = matchId ? `/?match=${matchId}` : '/'
      return self.clients.openWindow(url)
    })
  )
})

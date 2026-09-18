const CACHE_PREFIX = 'funding-decision-hub-'
const CACHE = `${CACHE_PREFIX}v1.1.1`
const BASE = new URL(self.registration.scope).pathname
const INDEX = `${BASE}index.html`
const CURRENT_SCRIPT = `${BASE}assets/app.js`
const CURRENT_STYLE = `${BASE}assets/app.css`
const SHELL = [BASE, INDEX, `${BASE}manifest.webmanifest`, `${BASE}app-icon.svg`, CURRENT_SCRIPT, CURRENT_STYLE]

function legacyAssetTarget(url) {
  if (!url.pathname.startsWith(`${BASE}assets/index-`)) return null
  if (url.pathname.endsWith('.js')) return CURRENT_SCRIPT
  if (url.pathname.endsWith('.css')) return CURRENT_STYLE
  return null
}

async function fetchAndCache(request, cacheKey = request) {
  const response = await fetch(request, { cache: 'no-store' })
  if (response.ok) {
    const cache = await caches.open(CACHE)
    await cache.put(cacheKey, response.clone())
  }
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      const legacyTarget = legacyAssetTarget(url)
      if (legacyTarget) {
        try { return await fetchAndCache(legacyTarget, legacyTarget) } catch {
          return (await caches.match(legacyTarget)) || Response.error()
        }
      }

      if (event.request.mode === 'navigate') {
        try { return await fetchAndCache(event.request, INDEX) } catch {
          return (await caches.match(INDEX)) || Response.error()
        }
      }

      const cached = await caches.match(event.request)
      if (cached) return cached
      try { return await fetchAndCache(event.request) } catch {
        return Response.error()
      }
    })(),
  )
})

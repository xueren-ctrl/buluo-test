/**
 * Service Worker — Cache assets for offline PWA
 * Uses CacheFirst for static assets, NetworkFirst for API calls
 */
const CACHE_NAME = 'coc-upgrade-assistant-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/loading.html',
];

// ---------- Install ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ---------- Activate ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// ---------- Fetch ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // API calls: NetworkFirst
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: CacheFirst
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.destination === 'document') {
          return caches.match('/');
        }
      });
    })
  );
});

// ---------- Background Sync ----------
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-upgrades') {
    event.waitUntil(syncUpgrades());
  }
});

async function syncUpgrades() {
  // If backend is available, re-fetch upgrades
  try {
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      await client.postMessage({ type: 'SYNC_TRIGGERED' });
    }
  } catch (e) {
    // Silent fail
  }
}

// ---------- Push Notifications ----------
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🏰 升级完成通知';
  const options = {
    body: data.body || '你的某个建筑/法术升级已完成了!',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      createdAt: Date.now(),
    },
    actions: [
      { action: 'view', title: '查看' },
      { action: 'dismiss', title: '忽略' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view') {
    event.waitUntil(
      self.clients.openWindow(event.notification.data.url || '/')
    );
  }
});

self.addEventListener('notificationclose', (event) => {
  // Track dismissed notifications if needed
});

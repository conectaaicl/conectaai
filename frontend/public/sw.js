// ConectaAI PWA Service Worker — Push + Offline Cache
const CACHE_NAME = 'conectaai-v2';
const OFFLINE_URLS = ['/', '/portal/dashboard', '/portal/cuenta', '/portal/avisos'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS)).catch(() => null)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests for same origin
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Skip API calls — always fresh
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); }
  catch { data = { titulo: 'ConectaAI', mensaje: event.data.text(), url: '/portal/avisos' }; }

  const options = {
    body: data.mensaje || '',
    icon: data.icono || '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: data.url || '/portal/avisos' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: data.tag || 'conectaai-notif',
    actions: [
      { action: 'open', title: 'Ver ahora' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  event.waitUntil(self.registration.showNotification(data.titulo || 'ConectaAI', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  const url = (event.notification.data && event.notification.data.url) || '/portal/avisos';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

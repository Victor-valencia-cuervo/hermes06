/* Hermes offline: App Shell + assets en caché.
 * Si cambias mascotas/videos/css/js, sube la versión para forzar actualización. */
const CACHE = 'hermes-v10';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/robots.txt', '/sitemap.xml', '/icon/hermes-icon.png', '/icon/Roxy-img-white.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  // SEO: robots/sitemap/manifest siempre frescos, sin interceptar.
  if (url.origin === self.location.origin && ['/robots.txt', '/sitemap.xml', '/favicon.svg'].includes(url.pathname)) return;
  // Los audios/videos con Range los deja al navegador (si no, se rompe la reproducción).
  if (request.headers.has('range')) return;

  // Navegación: red primero, si no hay wifi usa el index guardado.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((r) => {
          if (r && r.ok) {
            const cp = r.clone();
            caches.open(CACHE).then((c) => c.put('/index.html', cp));
          }
          return r;
        })
        .catch(() => caches.match('/index.html').then((m) => m || caches.match('/'))),
    );
    return;
  }

  // Archivos propios (assets, pets, caritas, icon, videos): caché primero + revalidar.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then((hit) => {
        const net = fetch(request)
          .then((r) => {
            if (r && r.ok) {
              const cp = r.clone();
              caches.open(CACHE).then((c) => c.put(request, cp));
            }
            return r;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  // Terceros (fuentes, clima, streaming): red primero, caché como respaldo.
  e.respondWith(
    fetch(request)
      .then((r) => {
        if (r && (r.ok || r.type === 'opaque')) {
          const cp = r.clone();
          caches.open(CACHE).then((c) => c.put(request, cp)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(request)),
  );
});

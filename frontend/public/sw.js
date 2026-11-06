/* SpaceOne Service Worker — offline shell + font cache */
const SHELL = 'cv-shell-v1';
const FONTS = 'cv-fonts-v1';

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== FONTS).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API calls — always network only (never cache sensitive data)
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') return;

  // Google Fonts — cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(cache =>
        cache.match(request).then(hit => hit || fetch(request).then(res => {
          cache.put(request, res.clone()); return res;
        }))
      )
    );
    return;
  }

  // Cross-origin (other) — skip
  if (url.origin !== self.location.origin) return;

  // Static assets (/static/js, /static/css, icons, manifest) — cache-first (content-hashed)
  if (url.pathname.includes('/static/') ||
      url.pathname.match(/\.(png|ico|json|webmanifest)$/)) {
    e.respondWith(
      caches.open(SHELL).then(cache =>
        cache.match(request).then(hit => hit || fetch(request).then(res => {
          if (res.ok) cache.put(request, res.clone()); return res;
        }))
      )
    );
    return;
  }

  // HTML / navigation — network-first; fall back to the cached app both
  // when offline AND when the server answers an error (e.g. hosting down),
  // so an installed app keeps opening from cache.
  const cachedApp = () =>
    caches.match(request).then(hit =>
      hit ||
      caches.match(self.registration.scope) ||
      caches.match(self.registration.scope + 'index.html')
    );
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(SHELL).then(c => c.put(request, clone));
          return res;
        }
        return cachedApp().then(hit => hit || res);
      })
      .catch(() => cachedApp())
  );
});

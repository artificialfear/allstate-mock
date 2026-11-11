/* All-State Mock Audition — offline service worker.
   build.py writes this file to /sw.js with VERSION = a hash of the built index.html, so every push makes
   browsers fetch the new app. Pages: network first (newest app when online), cache when offline.
   Fonts, the recorded instructions and icons: cache first. Share links (#view=...) work offline too. */
const VERSION = '70bccaa78c70';
const CACHE = 'asm-' + VERSION;
const CORE = ['./', './index.html', './manifest.webmanifest',
  './assets/oswald-latin-600-normal.woff2', './vendor/first-sight/music.woff2', './assets/sight-reading-instructions.mp3',
  './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('asm-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html', { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});

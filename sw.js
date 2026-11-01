/* CdC Finance — service worker (copie d'abord, mise à jour automatique à chaque nouvelle VERSION) */
var VERSION = '2.2';
var CACHE = 'cdcfin-' + VERSION;
var FILES = ['./', 'index.html', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png', 'icons/paw.png',
  'fonts/figtree-latin-400-normal.woff2', 'fonts/figtree-latin-500-normal.woff2', 'fonts/figtree-latin-600-normal.woff2',
  'fonts/nunito-latin-700-normal.woff2', 'fonts/nunito-latin-800-normal.woff2'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.endsWith('/config.js')) {   // l'adresse du script doit toujours être la plus récente
    e.respondWith(fetch(r).then(function (res) {
      var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); return res;
    }).catch(function () { return caches.match(r); }));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(function (m) { return m || fetch(r); }));
});

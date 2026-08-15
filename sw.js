/* Higher Self service worker.
   Problema pe care o rezolva: versiunea veche a lui index.html ramanea in cache,
   deci un build nou urcat pe server nu ajungea niciodata la om.

   Regulile:
   1. index.html si sw.js NU se servesc niciodata din cache. Merg pe retea,
      cu cache-ul doar ca plasa de siguranta cand nu e internet (network first).
   2. restul fisierelor (iconite, muzica) raman cache first, ca aplicatia sa
      porneasca instant si sa mearga offline.
   3. NU punem in cache raspunsuri cu eroare (404), altfel un fisier urcat mai
      tarziu nu apare niciodata.
   4. la SKIP_WAITING trecem imediat pe versiunea noua.
   Cand schimbi ceva aici, urca numarul din CACHE. */
const CACHE = 'hs-v317';
const MUSIC = 'hs-music-v1';
const CORE = ['./', './index.html', './icon-192.png', './icon-512.png', './manifest.json'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(CORE.map(function (u) {
        return fetch(u, { cache: 'no-store' })
          .then(function (r) { if (r.ok) return c.put(u, r); })
          .catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.map(function (k) {
          if (k !== CACHE && k !== MUSIC) return caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isDoc = req.mode === 'navigate' ||
                url.pathname.endsWith('/') ||
                url.pathname.endsWith('/index.html') ||
                url.pathname.endsWith('/sw.js');

  if (isDoc) {
    /* reteaua are ultimul cuvant: asa ajunge buildul nou din prima */
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(function (r) {
          if (r && r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
          }
          return r;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) {
        if (r && r.ok) {
          const copy = r.clone();
          const box = url.pathname.indexOf('/music/') >= 0 ? MUSIC : CACHE;
          caches.open(box).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return r;
      });
    })
  );
});

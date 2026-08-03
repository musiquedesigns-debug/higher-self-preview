/* Higher Self PWA - service worker de development */
const CACHE='hs-v4';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS).catch(function(){}); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;          /* apelurile catre API nu se cache-uiesc */
  const isDoc = req.mode==='navigate' || (req.headers.get('accept')||'').indexOf('text/html')>=0;
  if(isDoc){
    e.respondWith(
      fetch(req).then(function(r){
        if(r.ok){ const copy=r.clone(); caches.open(CACHE).then(function(c){ c.put('./index.html', copy); }); }
        return r;
      }).catch(function(){ return caches.match('./index.html'); })
    );
    return;
  }
  if(/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(url.pathname)) return;   /* audio: doar descarcare explicita */
  if(/\.json(\?|$)/i.test(url.pathname)) return;                  /* liste de piese: mereu proaspete */
  e.respondWith(caches.match(req).then(function(hit){
    return hit || fetch(req).then(function(r){
      if(r.ok){ const copy=r.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); }); }
      return r;
    });
  }));
});

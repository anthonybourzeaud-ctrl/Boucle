/* Boucles D+ — hors ligne : l'appli et les morceaux de carte déjà vus restent disponibles sans réseau.
   À déposer à côté de index.html. */
const APP = 'boucles-app-v1';
const TILES = 'boucles-tiles-v1';
const TILE_HOST = /(^|\.)(tile\.opentopomap\.org|data\.geopf\.fr|wmts\.geo\.admin\.ch|tile\.openstreetmap\.org)$/;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(APP).then(c => c.add('./')).catch(() => {}));
});

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Les tuiles OpenTopoMap viennent de a., b. ou c. : une seule clé par tuile
const tileKey = u => u.replace(/:\/\/[abc]\.tile\.opentopomap\.org/, '://a.tile.opentopomap.org');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // L'appli : réseau d'abord (pour les mises à jour), copie enregistrée si pas de réseau
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate' || /\/$|\.html$/.test(url.pathname)) {
      e.respondWith(
        fetch(req).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(APP).then(c => c.put('./', copy)).catch(() => {});
          }
          return res;
        }).catch(() => caches.open(APP).then(c => c.match('./')).then(r => r || Response.error()))
      );
    }
    return;
  }

  // Fonds de carte : la copie enregistrée tout de suite, et une mise à jour en arrière-plan quand il y a du réseau
  // (une tuile ratée ne reste donc jamais coincée dans le cache)
  if (TILE_HOST.test(url.hostname)) {
    const key = tileKey(req.url);
    const work = caches.open(TILES).then(c => c.match(key).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') c.put(key, res.clone()).catch(() => {});
        return res;
      });
      return { hit, net };
    }));
    e.respondWith(work.then(w => w.hit || w.net));
    e.waitUntil(work.then(w => w.net.catch(() => {})));
  }
});

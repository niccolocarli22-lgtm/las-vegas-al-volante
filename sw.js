/*
 * Las Vegas al volante: service worker.
 * Lo completa scripts/pacchetto-sito.mjs, che al posto dei due segnaposto mette l'impronta della versione e l'elenco
 * dei file. Dopo la prima apertura tutto il sito sta nella memoria del dispositivo: l'app parte anche quando non
 * c'è rete. Quando il sito cambia, la versione cambia e la prossima apertura usa i file nuovi.
 */
const VERSION = '890ec26fee28';
const CACHE = `guida-${VERSION}`;
const CARATTERI = 'guida-caratteri';
const FILES = [
  "assets/guida-CVcYgKn2.css",
  "assets/guida-CrVK0tcV.js",
  "cities/152.json",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.json",
  "models/152/eiffel-lite.glb",
  "models/152/eiffel.glb",
  "models/152/highroller-lite.glb",
  "models/152/highroller.glb",
  "models/152/luxor-lite.glb",
  "models/152/luxor.glb",
  "models/152/strat-lite.glb",
  "models/152/strat.glb"
];
const PAGINA = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  // tutto o niente: se un file manca, la versione nuova non parte e resta quella vecchia
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomi) => Promise.all(
        nomi.filter((n) => n.startsWith('guida-') && n !== CACHE && n !== CARATTERI).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(dalSito(req));
  else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(caratteri(event, req));
});

/** File del sito: prima dalla memoria (parte subito, anche senza rete), poi dalla rete. */
async function dalSito(req) {
  const cache = await caches.open(CACHE);
  // ogni apertura della pagina (anche con ?qualcosa o #qualcosa) è index.html
  const trovato = req.mode === 'navigate' ? await cache.match(PAGINA) : await cache.match(req, { ignoreSearch: true });
  if (trovato) return trovato;
  try {
    return await fetch(req);
  } catch (e) {
    return Response.error();
  }
}

/** Caratteri di Google: la prima volta si scaricano, poi restano in memoria e si aggiornano in sottofondo. */
async function caratteri(event, req) {
  const cache = await caches.open(CARATTERI);
  const vecchio = await cache.match(req);
  const rete = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (vecchio) {
    event.waitUntil(rete);
    return vecchio;
  }
  return (await rete) || Response.error();
}

/*
 * Las Vegas al volante: service worker.
 * Lo completa scripts/pacchetto-sito.mjs, che al posto dei due segnaposto mette l'impronta della versione e l'elenco
 * dei file. Dopo la prima apertura tutto il sito sta nella memoria del dispositivo: l'app parte anche quando non
 * c'è rete. Quando il sito cambia, la versione cambia e la prossima apertura usa i file nuovi.
 */
const VERSION = 'a2d0b4fce3ed';
const CACHE = `guida-${VERSION}`;
const CARATTERI = 'guida-caratteri';
const VALLE = 'guida-valle';
const FILES = [
  "assets/guida-CJNgD3sj.css",
  "assets/guida-DScMXUh5.js",
  "assets/tile.worker-DK32ckyO.js",
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
        nomi.filter((n) => n.startsWith('guida-') && n !== CACHE && n !== CARATTERI && n !== VALLE).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(url.pathname.includes('/valle/') ? daiTasselli(event, req, url) : dalSito(req));
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

/**
 * La città grande del giro libero (valle/): l'indice sempre dalla rete se c'è (porta l'impronta dei dati), altrimenti dalla
 * memoria; i tasselli (che hanno l'impronta nell'indirizzo) prima dalla memoria, poi dalla rete, e restano. Quando
 * l'impronta cambia si buttano i tasselli vecchi.
 */
async function daiTasselli(event, req, url) {
  const cache = await caches.open(VALLE);
  if (url.pathname.endsWith('/valle/index.json')) {
    try {
      const res = await fetch(req);
      if (res.ok) {
        const copia = res.clone();
        event.waitUntil((async () => {
          const build = (await copia.clone().json()).build;
          await cache.put(req, copia);
          for (const k of await cache.keys()) {
            if (!k.url.endsWith('/valle/index.json') && build && !k.url.includes('v=' + build)) await cache.delete(k);
          }
        })().catch(() => undefined));
      }
      return res;
    } catch (e) {
      return (await cache.match(req)) || Response.error();
    }
  }
  const trovato = await cache.match(req);
  if (trovato) return trovato;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
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

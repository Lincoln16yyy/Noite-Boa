/*
 * Service worker do Noite Boa (issue #37).
 *
 * Estratégia:
 * - navegações (SPA): rede primeiro, com cache de index.html para abrir offline;
 * - assets do mesmo domínio (JS/CSS/imagens com hash): cache primeiro;
 * - API (outro domínio) e requisições não-GET: sempre rede, sem cache
 *   (nada de dado pessoal guardado no dispositivo).
 */
const CACHE = 'noiteboa-v1';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/mark-light.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL);

      // O primeiro carregamento pede os assets antes do SW controlar a página,
      // então eles ainda não estão no cache. Aqui pegamos o index.html fresco e
      // guardamos os JS/CSS referenciados nele (nomes têm hash) — é o que faz
      // o app abrir offline.
      const html = await fetch('/index.html');
      if (html.ok) {
        const texto = await html.clone().text();
        await cache.put('/index.html', html);
        const assets = [...texto.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
        await Promise.all(
          assets.map((url) => fetch(url).then((res) => (res.ok ? cache.put(url, res) : null))),
        );
      }
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API: rede

  // áudios de relaxamento (issue #91): carregamento sob demanda direto pela rede nativa.
  // Nunca entram no cache ou precache do SW (evita estourar cota e erro 206 no Cache.put).
  if (url.pathname.startsWith('/audio/')) return;

  // SPA: rede primeiro, offline devolve o index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html', { ignoreVary: true })),
    );
    return;
  }

  // assets: cache primeiro (nomes têm hash, então nunca envelhecem).
  // ignoreVary: o servidor envia "Vary: Origin" e as requisições do <script
  // crossorigin> carregam Origin — sem isso o cache nunca casa e o app não abre offline.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

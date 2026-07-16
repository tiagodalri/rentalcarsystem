// GoDrive — Service Worker
// Strategy (v9 — admin-safe shell):
//  - HTML navigations: NetworkFirst com timeout de 2s. Online = sempre fresco.
//    Offline ou rede travada = cai pro cache imediatamente. Sem race condition.
//  - Static assets: cache only images/fonts. JS/CSS are pass-through to avoid
//    stale dynamic chunks after deploys.
//  - v8: precacheia rotas-shell (/, /frota, /buscar, /contato, /minha-conta)
//    pra que abrir essas URLs offline funcione mesmo sem ter visitado antes.
//  - Tudo o mais: pass-through.
//  - /admin: always pass-through. Back-office must be online and never receive
//    stale app shells/chunks from PWA cache.

const VERSION = "v9";
const HTML_CACHE = `zeus-html-${VERSION}`;
const ASSET_CACHE = `zeus-assets-${VERSION}`;
const OFFLINE_URL = "/";
const HTML_NETWORK_TIMEOUT_MS = 2000;

const PRECACHE_ASSETS = [
  "/",
  "/frota",
  "/buscar",
  "/contato",
  "/minha-conta",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];


self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(HTML_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== HTML_CACHE && n !== ASSET_CACHE)
          .map((n) => caches.delete(n))
      );
      // v7: claim immediately so the new SW handles fetches right away.
      // Without claim(), an open tab can keep serving deleted chunks from
      // the OLD SW's cache after a deploy, causing the "white screen until
      // I close and reopen the app" symptom.
      try { await self.clients.claim(); } catch (_) {}
    })()
  );
});

const isAsset = (request) => {
  const dest = request.destination;
  return (
    dest === "font" ||
    dest === "image"
  );
};

// Helper: NetworkFirst com timeout — se rede não responder em N ms, usa cache.
async function networkFirstWithTimeout(request, cache) {
  return new Promise((resolve) => {
    let settled = false;

    const timeoutId = setTimeout(async () => {
      if (settled) return;
      settled = true;
      const cached = (await cache.match(request)) || (await cache.match(OFFLINE_URL));
      if (cached) resolve(cached);
      // se não há cache, deixa a rede continuar (não resolve aqui).
    }, HTML_NETWORK_TIMEOUT_MS);

    fetch(request)
      .then(async (res) => {
        if (settled) {
          // resposta chegou tarde — atualiza cache em background
          if (res && res.ok) cache.put(OFFLINE_URL, res.clone());
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        if (res && res.ok) cache.put(OFFLINE_URL, res.clone());
        resolve(res);
      })
      .catch(async () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        const cached = (await cache.match(request)) || (await cache.match(OFFLINE_URL));
        resolve(cached || Response.error());
      });
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return;

  // 1) HTML navigations -> NetworkFirst com fallback rápido para cache.
  //    Resolve "carregamento do nada" porque online sempre serve a versão fresca.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(HTML_CACHE);
        return networkFirstWithTimeout(request, cache);
      })()
    );
    return;
  }

  // 2) Images/fonts -> StaleWhileRevalidate. JS/CSS ficam fora do SW para evitar
  //    version skew em imports dinâmicos no mobile/Safari após deploy.
  if (isAsset(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      })()
    );
    return;
  }
  // 3) Resto: network default.
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

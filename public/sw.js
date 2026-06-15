// Zeus Rental Car — Service Worker
// Strategy (v7 — fix lentidão e "recarregamento do nada"):
//  - HTML navigations: NetworkFirst com timeout de 2s. Online = sempre fresco.
//    Offline ou rede travada = cai pro cache imediatamente. Sem race condition.
//  - Static assets (JS/CSS/fonts/images): StaleWhileRevalidate.
//  - Tudo o mais: pass-through.
//  - Atualização: SKIP_WAITING via mensagem; SEM auto-reload (vide useSwUpdateOnNavigate).

const VERSION = "v7";
const HTML_CACHE = `zeus-html-${VERSION}`;
const ASSET_CACHE = `zeus-assets-${VERSION}`;
const OFFLINE_URL = "/";
const HTML_NETWORK_TIMEOUT_MS = 2000;

const PRECACHE_ASSETS = [
  "/",
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
  // Não chamamos skipWaiting() automático — a ativação é coordenada pelo app
  // (useSwUpdateOnNavigate) numa troca de rota, sem interromper o usuário.
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
      // sem clients.claim() — tabs existentes seguem com o SW atual até navegação completa.
    })()
  );
});

const isAsset = (request) => {
  const dest = request.destination;
  return (
    dest === "style" ||
    dest === "script" ||
    dest === "worker" ||
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

  // 2) Static assets -> StaleWhileRevalidate (hashes garantem invalidação).
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
          .catch(() => cached);
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

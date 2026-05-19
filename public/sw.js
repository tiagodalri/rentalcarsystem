// Zeus Rental Car — Service Worker
// Strategy:
//  - HTML navigations: NetworkFirst (so new deploys are seen immediately;
//    cached shell only serves as offline fallback).
//  - Static assets (JS/CSS/fonts/images): StaleWhileRevalidate.
//  - Everything else: pass-through.

const VERSION = "v4";
const HTML_CACHE = `zeus-html-${VERSION}`;
const ASSET_CACHE = `zeus-assets-${VERSION}`;
const OFFLINE_URL = "/";

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
      await self.clients.claim();
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

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip cross-origin (Supabase, fonts.googleapis, etc.)
  if (url.origin !== self.location.origin) return;

  // 1) HTML navigations -> NetworkFirst (3s timeout) -> offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(HTML_CACHE);
          cache.put(OFFLINE_URL, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(HTML_CACHE);
          const cached = await cache.match(request);
          return cached || (await cache.match(OFFLINE_URL));
        }
      })()
    );
    return;
  }

  // 2) Static assets -> StaleWhileRevalidate.
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
  // 3) Everything else: default network.
});

// Allow page to trigger immediate activation of a waiting SW.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

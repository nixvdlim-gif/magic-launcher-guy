// ChaleBid Service Worker — fast repeat loads
// Strategy:
//  - HTML navigations: NetworkFirst (always try fresh, fall back to cache offline)
//  - Static assets (JS/CSS/fonts/images): CacheFirst (instant on repeat visit)
//  - On new SW version: skipWaiting + clients.claim → auto-update

const VERSION = "v2-20260625";
const STATIC_CACHE = `static-${VERSION}`;
const HTML_CACHE = `html-${VERSION}`;

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => ![STATIC_CACHE, HTML_CACHE].includes(k)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Skip API / server functions / auth callbacks — always live
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn/") ||
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // HTML navigations → NetworkFirst
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(HTML_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(HTML_CACHE);
          const cached = await cache.match(req);
          if (cached) return cached;
          return cache.match("/") || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets → CacheFirst
  const dest = req.destination;
  if (["script", "style", "font", "image"].includes(dest) || url.pathname.startsWith("/_build/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })()
    );
  }
});

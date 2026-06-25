// Temporary service worker cleanup after deploy migration.
// Clears old cached app bundles, unregisters itself, then reloads open tabs.
const CLEANUP_VERSION = "cleanup-20260625-2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      const registrations = await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        client.navigate(client.url);
      }
    })(),
  );
});

self.addEventListener("fetch", () => {
  // Do not intercept anything; let the network fetch the current deployment.
});
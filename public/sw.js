// xPortal service worker. Deliberately conservative for an authenticated app:
// cache-first for immutable static assets (hashed Next chunks, icons, fonts),
// network-only for pages and API so private data is never served stale or
// cached on shared devices. Bump VERSION to invalidate.
const VERSION = "xportal-v1";
const STATIC = `${VERSION}-static`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const STATIC_PATHS = [/^\/_next\/static\//, /^\/icons\//, /^\/_next\/image/];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!STATIC_PATHS.some((re) => re.test(url.pathname))) return; // pages/API: network only

  event.respondWith(
    caches.open(STATIC).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
  );
});

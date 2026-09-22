const CACHE_VERSION = "lcg-pwa-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline";
const LOGIN_URL = "/auth/personnel";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll([LOGIN_URL, "/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/apple-touch-icon.png"])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isPageRequest(request) {
  return request.mode === "navigate" || (request.method === "GET" && !request.url.includes("._next/"));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  if (isApiRequest(url)) {
    event.respondWith(fetch(request).then((res) => res).catch(() => new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/");

  if (isPageRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch((err) => caches.match(request).then((cached) => cached || Promise.reject(err)))
  );
});
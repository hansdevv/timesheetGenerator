// Service Worker for Adidata DocGen PWA
// Provides 100% offline document generation and asset caching

const CACHE_NAME = "adidata-docgen-v1.0.0";

// Derive base path from registration scope (handles both root and GitHub Pages subpath)
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");

const PRECACHE_ASSETS = [
  `${SCOPE_PATH}/`,
  `${SCOPE_PATH}/timesheet/`,
  `${SCOPE_PATH}/spl/`,
  `${SCOPE_PATH}/izin/`,
  `${SCOPE_PATH}/profil/`,
  `${SCOPE_PATH}/riwayat/`,
  `${SCOPE_PATH}/manifest.webmanifest`,
  `${SCOPE_PATH}/theme-init.js`,
  `${SCOPE_PATH}/favicon.ico`,
  `${SCOPE_PATH}/templates/template_timesheet.xlsx`,
  `${SCOPE_PATH}/templates/template_spl.xlsx`,
  `${SCOPE_PATH}/templates/template_izin.xlsx`,
  `${SCOPE_PATH}/data/holidays-2026.json`,
  `${SCOPE_PATH}/images/adidata-logo.png`,
  `${SCOPE_PATH}/images/adidata-logo-izin.png`,
  `${SCOPE_PATH}/images/default-signature.png`,
  `${SCOPE_PATH}/icons/icon-192x192.png`,
  `${SCOPE_PATH}/icons/icon-512x512.png`,
  `${SCOPE_PATH}/icons/icon-maskable-192x192.png`,
  `${SCOPE_PATH}/icons/icon-maskable-512x512.png`,
  `${SCOPE_PATH}/icons/apple-touch-icon.png`
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_ASSETS.map((url) =>
            fetch(url).then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
              return null;
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip chrome-extension or external domains
  if (url.origin !== self.location.origin) return;

  // Navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // If offline, check exact URL first, then fallback to root page
          const cached = await caches.match(request);
          if (cached) return cached;
          return (await caches.match(`${SCOPE_PATH}/`)) || (await caches.match(`${SCOPE_PATH}/timesheet/`));
        })
    );
    return;
  }

  // Static assets (Next.js chunks, templates, json, images) - Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});


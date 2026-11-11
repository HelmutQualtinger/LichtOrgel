// Service Worker: macht die LichtOrgel offline nutzbar.
// Seite: zuerst Netz, offline aus dem Cache. Übrige Dateien (Icons, Manifest):
// „stale-while-revalidate“, sofort aus dem Cache antworten und im Hintergrund aktualisieren.
const CACHE = "lichtorgel-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // Die Seite selbst: zuerst aus dem Netz (am HTTP-Cache vorbei), damit neue Versionen sofort erscheinen;
  // der Cache dient nur noch offline als Ersatz
  if (request.mode === "navigate") {
    event.respondWith(caches.open(CACHE).then((cache) =>
      fetch(request, { cache: "no-cache" })
        .then((response) => {
          if (response.ok) cache.put("./index.html", response.clone());
          return response;
        })
        .catch(async () => (await cache.match(request, { ignoreSearch: true })) ?? cache.match("./index.html"))
    ));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => cached);
    return cached ?? network;
  }));
});

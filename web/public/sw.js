// Service worker mínimo do Quad₿lock — habilita a instalação (PWA) e um
// funcionamento básico offline do "casco" do app. Dados de mercado (/api)
// NUNCA são cacheados: são sempre buscados na rede (evita cotação velha).

const CACHE = "quadblock-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/")));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // cross-origin passa direto
  if (url.pathname.startsWith("/api")) return; // dados ao vivo: sempre rede

  // navegação: rede primeiro (index fresco), casco do cache se estiver offline
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  // assets: devolve do cache na hora e revalida em segundo plano
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

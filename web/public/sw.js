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

// Web Push: mostra a notificação do sistema mesmo com o app fechado
self.addEventListener("push", (e) => {
  let data = { title: "🔔 Alerta Quad₿lock", body: "", url: "/alertas" };
  try { data = { ...data, ...e.data.json() }; }
  catch { if (e.data) data.body = e.data.text(); }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      tag: "quadblock-alert",
      data: { url: data.url || "/alertas" },
    }).then(() =>
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
        cs.forEach((c) => c.postMessage({ type: "alert-push", title: data.title, body: data.body }));
      })
    )
  );
});

// clicar na notificação abre/foca o app na página de alertas
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/alertas";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ("focus" in c) { if (c.navigate) c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
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

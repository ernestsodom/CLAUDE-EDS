// Service worker de TeVendoElAuto.cl: permite instalar el sitio como app y abrirlo sin conexión
const VERSION = 'tva-v1';
const CORE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/img/hero-truck.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const put = (req, res) => { if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res)); return res; };

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const same = url.origin === self.location.origin;

  // El back office y los envíos de datos nunca se guardan
  if (same && (url.pathname.startsWith('/admin') || url.pathname === '/api/admin' || url.pathname === '/api/track' || url.pathname === '/api/lead')) return;

  // Páginas y datos del sitio: primero la red (siempre lo más nuevo), si no hay conexión, la copia guardada
  if (req.mode === 'navigate' || (same && url.pathname === '/api/site')) {
    e.respondWith(fetch(req).then(res => put(req, res.clone()) && res)
      .catch(() => caches.match(req).then(r => r || caches.match('/'))));
    return;
  }

  // Fotos, íconos y tipografías: la copia guardada al instante y se actualiza en segundo plano
  if ((same && /^\/(img|icons|api\/media)/.test(url.pathname)) || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => put(req, res.clone()) && res).catch(() => hit);
      return hit || net;
    }));
  }
});

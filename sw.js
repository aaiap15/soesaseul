// 폼클럽 서비스워커 — 네트워크 우선(항상 최신) + 오프라인 폴백
// 개발 중 '옛 버전 고착'을 피하려고 캐시 우선이 아니라 네트워크 우선을 쓴다.
const CACHE = 'formclub-v2';
const SHELL = ['./', './index.html', './db.js', './config.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase 등 외부는 SW 미개입 → 데이터 항상 실시간
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, net.clone());
      return net;
    } catch (_) {
      const cached = await caches.match(req);
      return cached || caches.match('./index.html');
    }
  })());
});

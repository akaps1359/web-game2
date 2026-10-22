// 오프라인 캐시: 처음 받은 파일을 저장해 두고, 다음 실행부터는 캐시를 먼저 쓰면서 백그라운드로 갱신한다.
const CACHE = 'chulhyeol-v1';
const CORE = ['./', 'index.html', 'css/main.css', 'js/main.js', 'data/map.json', 'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

// 오프라인 캐시: 온라인이면 항상 서버의 최신 파일을 쓰고(업데이트가 바로 반영되도록), 받은 파일은 저장해 두었다가 오프라인일 때 쓴다.
const CACHE = 'chulhyeol-v2';
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
  // no-cache: 브라우저 HTTP 캐시도 서버에 바뀌었는지 확인하게 한다(바뀌지 않았으면 304로 가볍게 끝난다)
  const net = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
  e.respondWith(net.then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
});

// 오프라인 캐시: 온라인이면 항상 서버의 최신 파일을 쓰고(업데이트가 바로 반영되도록), 받은 파일은 저장해 두었다가 오프라인일 때 쓴다.
const CACHE = 'hollow-crown-v13';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-180.png',
  'css/main.css',
  'fonts/Galmuri11.woff2',
  'fonts/Galmuri11-Bold.woff2',
  'js/audio/ambience.js',
  'js/audio/audio.js',
  'js/audio/bank.js',
  'js/audio/cache.js',
  'js/audio/compose.js',
  'js/audio/dsp.js',
  'js/audio/instruments.js',
  'js/audio/music.js',
  'js/audio/sfx-combat.js',
  'js/audio/sfx-items.js',
  'js/audio/sfx-kit.js',
  'js/audio/sfx-monsters.js',
  'js/audio/sfx-spells.js',
  'js/audio/sfx-world.js',
  'js/audio/tracks-dungeon.js',
  'js/audio/tracks-town.js',
  'js/audio/tracks.js',
  'js/audio/wa.js',
  'js/audio/worker.js',
  'js/core/rng.js',
  'js/core/save.js',
  'js/core/store.js',
  'js/core/util.js',
  'js/core/viewport.js',
  'js/data/affixes.js',
  'js/data/classes.js',
  'js/data/items.js',
  'js/data/monsters.js',
  'js/data/uniques.js',
  'js/game/actor.js',
  'js/game/ai.js',
  'js/game/buffs.js',
  'js/game/combat.js',
  'js/game/fov.js',
  'js/game/game.js',
  'js/game/gen/dungeon.js',
  'js/game/gen/town.js',
  'js/game/hero.js',
  'js/game/items.js',
  'js/game/level.js',
  'js/game/loot.js',
  'js/game/npcs.js',
  'js/game/objects.js',
  'js/game/path.js',
  'js/game/quests.js',
  'js/game/shop.js',
  'js/game/skills.js',
  'js/game/world.js',
  'js/main.js',
  'js/render/fig/beasts.js',
  'js/render/fig/core.js',
  'js/render/fig/gear.js',
  'js/render/fig/head.js',
  'js/render/fig/human.js',
  'js/render/fig/pose.js',
  'js/render/fig/tex.js',
  'js/render/figures.js',
  'js/render/fx.js',
  'js/render/icons.js',
  'js/render/noise.js',
  'js/render/pixel.js',
  'js/render/pixart.js',
  'js/render/props.js',
  'js/render/renderer.js',
  'js/render/skillicons.js',
  'js/render/tiles.js',
  'js/ui/app.js',
  'js/ui/dialog.js',
  'js/ui/dom.js',
  'js/ui/hud.js',
  'js/ui/input.js',
  'js/ui/panels.js',
  'js/ui/pixui.js',
  'js/ui/title.js',
];

self.addEventListener('install', (e) => {
  // 하나라도 못 받으면 설치 전체가 실패하지 않도록 따로따로 담는다
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
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
  }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

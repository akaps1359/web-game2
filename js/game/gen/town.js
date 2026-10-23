// 마을 애쉬폴: 손으로 짠 배치(광장·우물·대성당·대장간·치유사·여관·마녀의 오두막·개울)
import { Level, F_SOLID, F_OPAQUE, F_WATER } from '../level.js';

// 바닥 종류: 1 풀, 2 흙길, 3 자갈, 4 짙은 풀, 5 물, 6 다리
export function generateTown(rng) {
  const W = 52, H = 52;
  const L = new Level(W, H, 'town', 0);
  L.name = '애쉬폴 마을';
  for (let i = 0; i < W * H; i++) L.floor[i] = rng.chance(0.25) ? 4 : 1;
  const set = (x, y, f) => { if (L.inb(x, y)) L.floor[L.idx(x, y)] = f; };
  const rect = (x0, y0, x1, y1, f) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, f); };
  const solid = (x, y) => { if (L.inb(x, y)) L.flags[L.idx(x, y)] |= F_SOLID; };
  // 길과 광장
  rect(20, 20, 30, 30, 3);
  rect(24, 4, 26, 20, 2); // 대성당 길(북쪽)
  rect(6, 24, 20, 26, 2); // 서쪽 길(대장간)
  rect(30, 24, 44, 26, 2); // 동쪽 길(치유사)
  rect(24, 30, 26, 44, 2); // 남쪽 길(여관)
  rect(26, 40, 40, 42, 2); // 개울 건너 마녀의 길
  // 개울(동남쪽): 물은 지나갈 수 없다
  for (let y = 30; y < H; y++) {
    const cx = 36 + Math.round(Math.sin(y * 0.35) * 1.5);
    for (let x = cx - 1; x <= cx + 1; x++) { set(x, y, 5); L.flags[L.idx(x, y)] |= F_SOLID | F_WATER; }
  }
  for (let x = 32; x <= 40; x++) for (let y = 40; y <= 42; y++) if (L.floor[L.idx(x, y)] === 5) { set(x, y, 6); L.flags[L.idx(x, y)] &= ~(F_SOLID | F_WATER); }
  // 가장자리: 숲(나무로 막는다)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) solid(x, y);
  }
  const house = (x, y, w, h, extra) => {
    // (x, y) = 발판 왼쪽 위, 그림은 가장 앞 칸 기준
    const o = L.addObject({ type: 'house', x: x + w - 1, y: y + h - 1, w, h, solid: true, ...extra });
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      solid(xx, yy); L.flags[L.idx(xx, yy)] |= F_OPAQUE;
      if (!(xx === x + w - 1 && yy === y + h - 1)) L.objAt[L.idx(xx, yy)] = 0;
    }
    return o;
  };
  // 대성당(북쪽 끝): 큰 석조 건물, 문 앞에 지하로 내려가는 계단
  house(20, 4, 10, 8, { wallCol: '#6a6258', roofCol: '#2e2a30', wallH: 90, roofH: 60, cathedral: true, door: [4, 7] });
  const st = L.addObject({ type: 'stairs_down', x: 25, y: 13, face: 'y', solid: true, town: true });
  L.flags[L.idx(25, 13)] |= F_SOLID;
  rect(23, 12, 27, 14, 3);
  // 묘지(대성당 옆)
  for (const [x, y] of [[16, 8], [17, 10], [15, 11], [33, 9], [34, 11], [32, 12], [17, 13]]) {
    L.addObject({ type: 'tomb', x, y, solid: true }); solid(x, y);
  }
  // 대장간(서쪽)
  house(6, 18, 6, 5, { wallCol: '#7a6a54', roofCol: '#4a3428', chimney: true, sign: '대장간', door: [3, 4] });
  L.addObject({ type: 'anvil', x: 13, y: 22, solid: true }); solid(13, 22);
  L.addObject({ type: 'fire', x: 11, y: 24, solid: true }); solid(11, 24);
  // 치유사(동쪽)
  house(40, 18, 6, 5, { wallCol: '#8a7e6a', roofCol: '#3a4a34', sign: '치유', door: [2, 4] });
  // 여관(남쪽)
  house(17, 33, 7, 6, { wallCol: '#7a6650', roofCol: '#5a2a20', chimney: true, sign: '잿빛 술잔', door: [6, 3] });
  // 현자의 집(광장 북서)
  house(13, 13, 4, 4, { wallCol: '#6e665a', roofCol: '#3a3440', door: [3, 3] });
  // 마녀의 오두막(개울 건너)
  house(42, 36, 4, 4, { wallCol: '#4a3e34', roofCol: '#2a2a1a', chimney: true, door: [0, 3] });
  L.addObject({ type: 'cauldron', x: 41, y: 41, solid: true }); solid(41, 41);
  // 광장: 우물·보관함·순간 이동 지점
  L.addObject({ type: 'well', x: 25, y: 25, solid: true }); solid(25, 25);
  L.addObject({ type: 'stash', x: 22, y: 31, solid: true }); solid(22, 31);
  const wp = L.addObject({ type: 'waypoint', x: 28, y: 22, active: true });
  L.wpAt = { x: 28, y: 23 };
  // 등불
  for (const [x, y] of [[20, 20], [30, 20], [20, 30], [30, 30], [25, 15], [12, 25], [38, 25], [25, 38]]) {
    L.addObject({ type: 'lamp', x, y, solid: true }); solid(x, y);
    L.lights.push({ tx: x, ty: y, x, y, r: 5, color: [255, 190, 110] });
  }
  // 울타리와 상자
  for (let x = 6; x <= 11; x++) { L.addObject({ type: 'fence', x, y: 28, ori: 'x', solid: true }); solid(x, 28); }
  for (const [x, y] of [[31, 21], [19, 27], [29, 33]]) { L.addObject({ type: 'crate', x, y, solid: true }); solid(x, y); }
  L.addObject({ type: 'gibbet', x: 31, y: 14, solid: true }); solid(31, 14);
  // 나무
  for (let i = 0; i < 160; i++) {
    const x = rng.int(1, W - 2), y = rng.int(1, H - 2);
    const k = L.idx(x, y);
    const edge = x < 5 || y < 5 || x > W - 6 || y > H - 6;
    if (!edge && !rng.chance(0.18)) continue;
    if (L.flags[k] & F_SOLID && !edge) continue;
    if (L.floor[k] === 2 || L.floor[k] === 3 || L.floor[k] === 5 || L.floor[k] === 6 || L.obj(x, y)) continue;
    if (!edge && (Math.abs(x - 25) < 8 && Math.abs(y - 25) < 8)) continue;
    L.addObject({ type: 'tree', x, y, solid: true, size: rng.range(0.8, 1.3), pine: rng.chance(0.4), dead: rng.chance(0.3) });
    solid(x, y);
  }
  L.start = { x: 25, y: 16 };
  L.portalAt = { x: 27, y: 27 };
  L.downAt = { x: 25, y: 15 };
  // NPC 자리
  L.npcSpots = {
    smith: { x: 14, y: 23 }, healer: { x: 40, y: 24 }, witch: { x: 41, y: 39 }, sage: { x: 23, y: 23 },
    inn: { x: 25, y: 34 }, maid: { x: 22, y: 36 }, boy: { x: 46, y: 22 }, drunk: { x: 19, y: 30 }, wounded: { x: 26, y: 16 },
  };
  L.rooms = [];
  return L;
}

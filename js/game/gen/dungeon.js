// 던전 생성기: 방과 복도(성당·카타콤·지옥), 세포 자동자 동굴(동굴)
import { Level, F_SOLID, F_OPAQUE, F_LAVA, F_ROOM, F_NOSPAWN } from '../level.js';
import { DIRS, DIR4 } from '../../core/util.js';

// 테마별 생성 설정
export const THEMES = {
  crypt: { kind: 'rooms', size: 60, rooms: [9, 13], rw: [5, 12], rh: [5, 11], cw: [2, 3], loops: 0.25, pillars: 0.6, doors: 0.35, floorVar: 6, wallVar: 4 },
  catacombs: { kind: 'rooms', size: 62, rooms: [13, 18], rw: [4, 9], rh: [4, 8], cw: [1, 2], loops: 0.35, pillars: 0.15, doors: 0.8, floorVar: 6, wallVar: 4 },
  caves: { kind: 'caves', size: 64, fill: 0.46, lava: 0.035, floorVar: 6, wallVar: 4 },
  hell: { kind: 'rooms', size: 64, rooms: [8, 11], rw: [7, 14], rh: [7, 13], cw: [3, 3], loops: 0.4, pillars: 0.35, doors: 0.25, floorVar: 6, wallVar: 4, lavaPools: 0.5 },
};

export function generateDungeon(rng, theme, depth, opts = {}) {
  const T = THEMES[theme];
  for (let attempt = 0; attempt < 20; attempt++) {
    const L = T.kind === 'caves' ? caves(rng, T, theme, depth, opts) : roomsAndCorridors(rng, T, theme, depth, opts);
    if (!L) continue;
    finishWalls(L, rng, T);
    if (!placeStairs(L, rng, opts)) continue;
    if (T.kind === 'rooms') placeDoors(L, rng, T);
    decorate(L, rng, theme, depth);
    return L;
  }
  throw new Error('던전 생성 실패');
}

// ───────── 방과 복도 ─────────
function roomsAndCorridors(rng, T, theme, depth, opts) {
  const W = T.size, H = T.size;
  const L = new Level(W, H, theme, depth);
  const want = rng.int(T.rooms[0], T.rooms[1]);
  const rooms = [];
  // 특별한 방(보스 방 등)을 먼저 놓는다
  for (const sp of opts.special || []) {
    for (let a = 0; a < 300; a++) {
      const x = rng.int(3, W - sp.w - 4), y = rng.int(3, H - sp.h - 4);
      const r = { x, y, w: sp.w, h: sp.h, special: sp.id };
      if (rooms.some((o) => overlap(o, r, 3))) continue;
      rooms.push(r); break;
    }
  }
  for (let a = 0; a < 600 && rooms.length < want; a++) {
    const w = rng.int(T.rw[0], T.rw[1]), h = rng.int(T.rh[0], T.rh[1]);
    const x = rng.int(2, W - w - 3), y = rng.int(2, H - h - 3);
    const r = { x, y, w, h };
    if (rooms.some((o) => overlap(o, r, 2))) continue;
    rooms.push(r);
  }
  if (rooms.length < Math.min(5, want)) return null;
  rooms.forEach((r, i) => {
    r.id = i; r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const k = L.idx(x, y);
      L.floor[k] = 1; L.room[k] = i; L.flags[k] |= F_ROOM;
    }
  });
  // 최소 신장 트리로 잇고, 고리를 조금 더한다
  const n = rooms.length, inTree = new Array(n).fill(false), edges = [];
  inTree[0] = true;
  for (let c = 1; c < n; c++) {
    let best = null, bd = 1e9;
    for (let i = 0; i < n; i++) if (inTree[i]) for (let j = 0; j < n; j++) if (!inTree[j]) {
      const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    inTree[best[1]] = true; edges.push(best);
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy);
    if (d < 26 && rng.chance(T.loops * 0.5) && !edges.some((e) => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) edges.push([i, j]);
  }
  for (const [i, j] of edges) {
    if (rooms[i].special || rooms[j].special) {
      // 특별한 방은 입구 하나만: 가까운 일반 방과만 잇는다
    }
    corridor(L, rng, rooms[i], rooms[j], rng.int(T.cw[0], T.cw[1]));
  }
  // 기둥: 큰 방에 규칙적으로
  for (const r of rooms) {
    if (r.special || r.w < 7 || r.h < 7 || !rng.chance(T.pillars)) continue;
    const step = rng.pick([3, 4]);
    for (let y = r.y + 2; y < r.y + r.h - 2; y += step) for (let x = r.x + 2; x < r.x + r.w - 2; x += step) {
      if (x === r.cx || y === r.cy || x === r.cx - 1 || y === r.cy - 1) continue;
      const k = L.idx(x, y);
      L.floor[k] = 0; L.room[k] = -1; L.flags[k] &= ~F_ROOM;
    }
  }
  // 지옥: 용암 웅덩이(방 안쪽, 길은 막지 않는다)
  if (T.lavaPools) for (const r of rooms) {
    if (r.special || r.w < 9 || r.h < 9 || !rng.chance(T.lavaPools)) continue;
    const lx = r.x + 2 + rng.int(0, r.w - 7), ly = r.y + 2 + rng.int(0, r.h - 7), lw = rng.int(2, 3), lh = rng.int(2, 3);
    for (let y = ly; y < ly + lh; y++) for (let x = lx; x < lx + lw; x++) {
      if (x === r.cx || y === r.cy) continue;
      L.flags[L.idx(x, y)] |= F_LAVA;
    }
  }
  L.rooms = rooms;
  if (!connected(L)) return null;
  return L;
}

function overlap(a, b, m) {
  return a.x - m < b.x + b.w && b.x - m < a.x + a.w && a.y - m < b.y + b.h && b.y - m < a.y + a.h;
}

function carve(L, x, y, w) {
  for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 2 || ny < 2 || nx >= L.w - 2 || ny >= L.h - 2) continue;
    const k = L.idx(nx, ny);
    if (!L.floor[k]) L.floor[k] = 1;
  }
}

function corridor(L, rng, a, b, w) {
  let x = a.cx, y = a.cy;
  const tx = b.cx, ty = b.cy, o = w >> 1;
  const hFirst = rng.chance(0.5);
  const walkX = () => { while (x !== tx) { carve(L, x - o, y - o, w); x += Math.sign(tx - x); } };
  const walkY = () => { while (y !== ty) { carve(L, x - o, y - o, w); y += Math.sign(ty - y); } };
  if (hFirst) { walkX(); walkY(); } else { walkY(); walkX(); }
  carve(L, x - o, y - o, w);
}

// ───────── 동굴 ─────────
function caves(rng, T, theme, depth, opts = {}) {
  const W = T.size, H = T.size;
  const L = new Level(W, H, theme, depth);
  let g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = x < 3 || y < 3 || x >= W - 3 || y >= H - 3;
    g[y * W + x] = edge || rng.chance(T.fill) ? 1 : 0;
  }
  const count = (gg, x, y, r) => {
    let c = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || gg[ny * W + nx]) c++;
    }
    return c;
  };
  for (let it = 0; it < 6; it++) {
    const ng = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = x < 3 || y < 3 || x >= W - 3 || y >= H - 3;
      if (edge) { ng[y * W + x] = 1; continue; }
      const c1 = count(g, x, y, 1);
      ng[y * W + x] = it < 4 ? (c1 >= 5 || count(g, x, y, 2) <= 2 ? 1 : 0) : (c1 >= 5 ? 1 : 0);
    }
    g = ng;
  }
  for (let i = 0; i < W * H; i++) L.floor[i] = g[i] ? 0 : 1;
  // 퀘스트 무대: 동굴 안에 네모난 방을 판다
  const specials = [];
  for (const sp of opts.special || []) {
    for (let a = 0; a < 200; a++) {
      const x = rng.int(4, W - sp.w - 5), y = rng.int(4, H - sp.h - 5);
      const r = { x, y, w: sp.w, h: sp.h, special: sp.id };
      if (specials.some((o) => overlap(o, r, 4))) continue;
      for (let yy = y; yy < y + sp.h; yy++) for (let xx = x; xx < x + sp.w; xx++) L.floor[L.idx(xx, yy)] = 1;
      specials.push(r); break;
    }
  }
  // 가장 큰 영역만 남기고 나머지는 이어 붙이거나 메운다
  const regions = floodRegions(L);
  if (!regions.length) return null;
  regions.sort((a, b) => b.length - a.length);
  const main = regions[0];
  if (main.length < W * H * 0.28) return null;
  for (let r = 1; r < regions.length; r++) {
    const reg = regions[r];
    const hasSpecial = specials.some((sp) => reg.includes(L.idx(sp.x + 1, sp.y + 1)));
    if (reg.length < 25 && !hasSpecial) { for (const k of reg) L.floor[k] = 0; continue; }
    // 가까운 본 영역 칸으로 굴을 판다
    const k0 = reg[(reg.length / 2) | 0], x0 = k0 % W, y0 = (k0 / W) | 0;
    let best = null, bd = 1e9;
    for (let s = 0; s < main.length; s += 7) {
      const k = main[s], d = Math.abs(k % W - x0) + Math.abs(((k / W) | 0) - y0);
      if (d < bd) { bd = d; best = k; }
    }
    let x = x0, y = y0;
    const tx = best % W, ty = (best / W) | 0;
    while (x !== tx || y !== ty) {
      if (x !== tx && (y === ty || rng.chance(0.5))) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      carve(L, x, y, 2);
    }
    main.push(...reg);
  }
  // 용암 웅덩이: 연결이 끊기지 않을 때만
  const lavaWant = Math.floor(W * H * T.lava);
  let placed = 0;
  for (let a = 0; a < 60 && placed < lavaWant; a++) {
    const cx = rng.int(6, W - 7), cy = rng.int(6, H - 7), rad = rng.range(1.5, 3.2);
    const cells = [];
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (Math.hypot(x - cx, y - cy) > rad + rng.range(-0.4, 0.4)) continue;
      if (specials.some((sp) => x >= sp.x - 1 && x <= sp.x + sp.w && y >= sp.y - 1 && y <= sp.y + sp.h)) continue;
      const k = L.idx(x, y);
      if (L.floor[k] && !(L.flags[k] & F_LAVA)) cells.push(k);
    }
    if (cells.length < 4) continue;
    for (const k of cells) L.flags[k] |= F_LAVA;
    if (!connected(L)) { for (const k of cells) L.flags[k] &= ~F_LAVA; continue; }
    placed += cells.length;
  }
  // 동굴의 '방': 스폰·장식용으로 넓은 지점들을 고른다
  const rooms = [];
  for (const sp of specials) { sp.id = rooms.length; sp.cx = sp.x + (sp.w >> 1); sp.cy = sp.y + (sp.h >> 1); rooms.push(sp); }
  for (let a = 0; a < 400 && rooms.length < 14 + specials.length; a++) {
    const x = rng.int(4, W - 5), y = rng.int(4, H - 5);
    let open = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (L.passable(x + dx, y + dy)) open++;
    if (open < 20 || rooms.some((r) => Math.abs(r.cx - x) + Math.abs(r.cy - y) < 10)) continue;
    if (specials.some((sp) => x >= sp.x - 3 && x <= sp.x + sp.w + 2 && y >= sp.y - 3 && y <= sp.y + sp.h + 2)) continue;
    rooms.push({ id: rooms.length, x: x - 2, y: y - 2, w: 5, h: 5, cx: x, cy: y, cave: true });
  }
  if (rooms.length < 5 + specials.length) return null;
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const k = L.idx(x, y);
    if (L.floor[k]) { L.room[k] = r.id; L.flags[k] |= F_ROOM; }
  }
  L.rooms = rooms;
  return L;
}

function floodRegions(L) {
  const W = L.w, seen = new Uint8Array(L.w * L.h), out = [];
  for (let i = 0; i < W * L.h; i++) {
    if (!L.floor[i] || seen[i]) continue;
    const reg = [i], stack = [i]; seen[i] = 1;
    while (stack.length) {
      const k = stack.pop(), x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of DIR4) {
        const nx = x + dx, ny = y + dy;
        if (!L.inb(nx, ny)) continue;
        const nk = ny * W + nx;
        if (!L.floor[nk] || seen[nk]) continue;
        seen[nk] = 1; reg.push(nk); stack.push(nk);
      }
    }
    out.push(reg);
  }
  return out;
}

// 통행 가능한 바닥이 모두 이어져 있는가(물체가 막은 칸은 빼고, 문은 열고 지나갈 수 있다고 본다)
function openTile(L, k) {
  if (!L.floor[k] || L.flags[k] & F_LAVA) return false;
  if (!(L.flags[k] & F_SOLID)) return true;
  const o = L.objAt[k] ? L.objects[L.objAt[k] - 1] : null;
  return !!(o && o.type === 'door' && !o.locked);
}
function reachCount(L) {
  const W = L.w, N = W * L.h;
  let start = -1, total = 0;
  for (let i = 0; i < N; i++) if (openTile(L, i)) { total++; if (start < 0) start = i; }
  if (start < 0) return [0, 0];
  // 입구(오르는 계단 앞)가 정해졌으면 거기서부터 센다
  if (L.inb(L.start.x, L.start.y) && openTile(L, L.idx(L.start.x, L.start.y))) start = L.idx(L.start.x, L.start.y);
  const seen = new Uint8Array(N), stack = [start]; seen[start] = 1;
  let c = 1;
  while (stack.length) {
    const k = stack.pop(), x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (!L.inb(nx, ny)) continue;
      const nk = ny * W + nx;
      if (seen[nk] || !openTile(L, nk)) continue;
      seen[nk] = 1; c++; stack.push(nk);
    }
  }
  return [c, total];
}
export function connected(L) { const [c, total] = reachCount(L); return total > 0 && c === total; }

// 길을 끊지 않을 때만 단단한 물체를 놓는다
export function placeSolid(L, o) {
  if (L.obj(o.x, o.y) || !L.passable(o.x, o.y)) return null;
  L.addObject(o);
  o.solid = true;
  L.flags[L.idx(o.x, o.y)] |= F_SOLID;
  if (connected(L)) return o;
  L.flags[L.idx(o.x, o.y)] &= ~F_SOLID; L.objAt[L.idx(o.x, o.y)] = 0; L.objects.pop();
  return null;
}

// 마지막 점검: 그래도 막힌 곳이 있으면 길을 막은 장식 물체를 치운다
const REMOVABLE = new Set(['barrel', 'chest', 'sarc', 'bookcase', 'rack', 'brazier', 'gibbet', 'shrine', 'altar']);
export function repairReach(L) {
  if (connected(L)) return 0;
  let removed = 0;
  for (let pass = 0; pass < 3; pass++) {
    for (const o of L.objects) {
      if (!REMOVABLE.has(o.type) || o.gone) continue;
      const k = L.idx(o.x, o.y);
      const before = reachCount(L)[0];
      L.flags[k] &= ~F_SOLID;
      const [c, total] = reachCount(L);
      // 치워서 닿는 칸이 늘면(막고 있던 물체) 치운다. 늘지 않으면 되돌린다
      if (c > before + 1 || c === total) { o.gone = true; removed++; if (c === total) break; } else L.flags[k] |= F_SOLID;
    }
    if (connected(L)) break;
  }
  if (removed) {
    L.objects = L.objects.filter((o) => !o.gone);
    L.objAt.fill(0);
    L.objects.forEach((o, i) => { o.idx = i; if (o.x != null) L.objAt[L.idx(o.x, o.y)] = i + 1; });
  }
  return removed;
}

// 바닥 둘레의 바위를 벽으로
function finishWalls(L, rng, T) {
  const W = L.w, H = L.h;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (L.floor[k]) {
      L.floor[k] = 1 + (rng.chance(0.55) ? 0 : rng.int(1, T.floorVar - 1));
      continue;
    }
    let near = false;
    for (const [dx, dy] of DIRS) if (L.isFloor(x + dx, y + dy)) { near = true; break; }
    if (near) { L.wall[k] = 1 + (rng.chance(0.7) ? 0 : rng.int(1, T.wallVar - 1)); L.flags[k] |= F_SOLID | F_OPAQUE; }
    else L.flags[k] |= F_SOLID | F_OPAQUE;
  }
}

// BFS 거리(벽·용암 제외)
export function bfsDist(L, sx, sy, passFn = (x, y) => L.passable(x, y)) {
  const W = L.w, d = new Int32Array(W * L.h).fill(-1), q = [sy * W + sx];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (!L.inb(nx, ny)) continue;
      const nk = ny * W + nx;
      if (d[nk] >= 0 || !passFn(nx, ny)) continue;
      d[nk] = d[k] + 1; q.push(nk);
    }
  }
  return d;
}

// 벽에 붙은 칸 중 눈에 보이는 면(+x 또는 +y 방향 벽)이 있는 곳: 계단·횃불을 걸 자리
function backWallSpot(L, x, y) {
  if (!L.passable(x, y)) return null;
  if (L.wall[L.idx(x - 1, y)] && L.passable(x + 1, y)) return { wx: x - 1, wy: y, face: 'x' };
  if (L.wall[L.idx(x, y - 1)] && L.passable(x, y + 1)) return { wx: x, wy: y - 1, face: 'y' };
  return null;
}

function roomTiles(L, r, inner = 0) {
  const out = [];
  for (let y = r.y + inner; y < r.y + r.h - inner; y++) for (let x = r.x + inner; x < r.x + r.w - inner; x++) if (L.passable(x, y) && !L.obj(x, y)) out.push([x, y]);
  return out;
}

function placeStairs(L, rng, opts) {
  const rooms = L.rooms.filter((r) => !r.special);
  if (rooms.length < 2) return false;
  // 오르는 계단: 아무 방의 뒤쪽 벽
  const tryStairs = (room, type) => {
    const cand = [];
    for (const [x, y] of roomTiles(L, room)) {
      const s = backWallSpot(L, x, y);
      if (s && L.passable(x + (s.face === 'x' ? 1 : 0), y + (s.face === 'y' ? 1 : 0))) cand.push([x, y, s]);
    }
    if (!cand.length) return null;
    const [x, y, s] = rng.pick(cand);
    return L.addObject({ type, x, y, face: s.face, solid: true });
  };
  const upRoom = rng.pick(rooms);
  const up = opts.noUp ? null : tryStairs(upRoom, 'stairs_up');
  if (!opts.noUp && !up) return false;
  if (up) markSolid(L, up);
  const sx = up ? up.x + (up.face === 'x' ? 1 : 0) : upRoom.cx, sy = up ? up.y + (up.face === 'y' ? 1 : 0) : upRoom.cy;
  L.start = { x: sx, y: sy };
  if (!L.passable(sx, sy)) return false;
  const d = bfsDist(L, sx, sy);
  if (!opts.noDown) {
    const far = rooms.slice().sort((a, b) => (d[L.idx(b.cx, b.cy)] || 0) - (d[L.idx(a.cx, a.cy)] || 0));
    let down = null;
    for (const r of far.slice(0, 4)) { if (r === upRoom) continue; down = tryStairs(r, 'stairs_down'); if (down) break; }
    if (!down) return false;
    markSolid(L, down);
    L.downAt = { x: down.x + (down.face === 'x' ? 1 : 0), y: down.y + (down.face === 'y' ? 1 : 0) };
  }
  // 계단 주변은 몬스터가 생기지 않게
  for (let y = sy - 7; y <= sy + 7; y++) for (let x = sx - 7; x <= sx + 7; x++) if (L.inb(x, y)) L.flags[L.idx(x, y)] |= F_NOSPAWN;
  return connected(L);
}

function markSolid(L, o) {
  L.flags[L.idx(o.x, o.y)] |= F_SOLID;
}

// 좁은 통로가 방과 만나는 곳에 문
function placeDoors(L, rng, T) {
  const W = L.w;
  for (let y = 2; y < L.h - 2; y++) for (let x = 2; x < W - 2; x++) {
    const k = y * W + x;
    if (!L.passable(x, y) || L.room[k] >= 0 || L.obj(x, y)) continue;
    const wallAt = (xx, yy) => !!L.wall[L.idx(xx, yy)] || !L.floor[L.idx(xx, yy)];
    let ori = null;
    if (wallAt(x, y - 1) && wallAt(x, y + 1) && L.passable(x - 1, y) && L.passable(x + 1, y)) ori = 'y'; // 위아래가 벽: x 방향 통로
    else if (wallAt(x - 1, y) && wallAt(x + 1, y) && L.passable(x, y - 1) && L.passable(x, y + 1)) ori = 'x';
    if (!ori) continue;
    // 방에 바로 붙은 칸만
    const nb = ori === 'y' ? [[x - 1, y], [x + 1, y]] : [[x, y - 1], [x, y + 1]];
    if (!nb.some(([a, b]) => L.room[L.idx(a, b)] >= 0)) continue;
    // 문 옆에 또 문이 없게
    let near = false;
    for (const [dx, dy] of DIRS) { const o = L.obj(x + dx, y + dy); if (o && o.type === 'door') near = true; }
    if (near || !rng.chance(T.doors)) continue;
    const door = L.addObject({ type: 'door', x, y, ori, open: false, solid: true });
    L.flags[k] |= F_SOLID | F_OPAQUE;
    door.locked = false;
  }
}

// 장식·물체: 통, 상자, 석관, 책장, 무기 걸이, 횃불, 성소
function decorate(L, rng, theme, depth) {
  const rooms = L.rooms.filter((r) => !r.special);
  // 벽 횃불(빛)
  const torchEvery = theme === 'caves' ? 0.03 : 0.06;
  for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) {
    const k = L.idx(x, y);
    if (!L.wall[k] || L.obj(x, y)) continue;
    const fx = L.passable(x + 1, y), fy = L.passable(x, y + 1);
    if (!(fx || fy) || !rng.chance(torchEvery)) continue;
    if (L.lights.some((l) => Math.abs(l.tx - x) + Math.abs(l.ty - y) < 6)) continue;
    const face = fx && fy ? rng.pick(['x', 'y']) : fx ? 'x' : 'y';
    L.lights.push({ tx: x, ty: y, x: x + (face === 'x' ? 0.75 : 0), y: y + (face === 'y' ? 0.75 : 0), face, r: 4.2, color: theme === 'hell' ? [255, 90, 40] : [255, 160, 70], torch: true, flick: rng.next() * 10 });
  }
  // 계단 앞과 둘레는 비워 둔다
  const stairs = L.objects.filter((o) => o.type === 'stairs_up' || o.type === 'stairs_down');
  const reserved = (x, y) => stairs.some((s) => Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) <= 1) || (L.downAt && Math.max(Math.abs(L.downAt.x - x), Math.abs(L.downAt.y - y)) <= 1) || Math.max(Math.abs(L.start.x - x), Math.abs(L.start.y - y)) <= 1;
  const put = (type, x, y, extra = {}) => {
    if (L.obj(x, y) || !L.passable(x, y) || reserved(x, y)) return null;
    const o = L.addObject({ type, x, y, ...extra });
    if (o.solid) L.flags[L.idx(x, y)] |= F_SOLID;
    // 물체가 길을 끊으면 되돌린다
    if (o.solid && !connected(L)) { L.flags[L.idx(x, y)] &= ~F_SOLID; L.objAt[L.idx(x, y)] = 0; L.objects.pop(); return null; }
    return o;
  };
  // 벽에 붙은 칸 고르기
  const wallSide = (r) => roomTiles(L, r).filter(([x, y]) => {
    let w = 0;
    for (const [dx, dy] of DIR4) if (L.wall[L.idx(x + dx, y + dy)]) w++;
    return w >= 1 && !(L.flags[L.idx(x, y)] & F_NOSPAWN && rng.chance(0.5));
  });
  for (const r of rooms) {
    const side = rng.shuffle(wallSide(r));
    if (!side.length) continue;
    const roll = rng.next();
    // 통 무더기
    if (roll < 0.45) {
      const n = rng.int(1, 4);
      for (let i = 0; i < n && side.length; i++) {
        const [x, y] = side.pop();
        put('barrel', x, y, { solid: true, explosive: theme === 'caves' || theme === 'hell' ? rng.chance(0.3) : rng.chance(0.08) });
      }
    }
    if (rng.chance(0.35) && side.length) { const [x, y] = side.pop(); put('chest', x, y, { solid: true, big: rng.chance(0.25) }); }
    if ((theme === 'crypt' || theme === 'catacombs') && rng.chance(0.3) && side.length) { const [x, y] = side.pop(); put('sarc', x, y, { solid: true }); }
    if ((theme === 'catacombs' || theme === 'crypt') && rng.chance(0.2) && side.length) { const [x, y] = side.pop(); put('bookcase', x, y, { solid: true }); }
    if (rng.chance(0.12) && side.length) { const [x, y] = side.pop(); put('rack', x, y, { solid: true, kind: rng.chance(0.5) ? 'weapon' : 'armor' }); }
    if (theme !== 'caves' && rng.chance(0.25)) {
      const t = roomTiles(L, r, 1);
      if (t.length) { const [x, y] = rng.pick(t); put('brazier', x, y, { solid: true }); }
    }
    // 바닥 장식(뼈·핏자국·잔해)
    for (const [x, y] of roomTiles(L, r)) if (rng.chance(0.05)) L.decals.push({ x: x + rng.range(-0.3, 0.3), y: y + rng.range(-0.3, 0.3), kind: rng.pick(theme === 'hell' ? ['blood', 'bones', 'crack'] : theme === 'caves' ? ['rocks', 'bones', 'crack'] : ['bones', 'blood', 'rubble', 'crack']), rot: rng.next() * 6.28, s: rng.range(0.7, 1.2), keep: true });
  }
  // 성소 1~2개
  const nShrine = rng.chance(0.6) ? 2 : 1;
  for (let i = 0; i < nShrine; i++) {
    const r = rng.pick(rooms), t = roomTiles(L, r, 1);
    if (t.length) { const [x, y] = rng.pick(t); put('shrine', x, y, { solid: true, used: false }); }
  }
}

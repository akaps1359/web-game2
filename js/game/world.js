// 세계: 16층 던전과 마을. 층마다 테마·괴물 종류·퀘스트 무대를 정하고 채운다
import { generateDungeon, bfsDist, repairReach, placeSolid } from './gen/dungeon.js';
import { generateTown } from './gen/town.js';
import { MONSTERS } from '../data/monsters.js';
import { spawnMonster, spawnBoss, makeUniquePack, makeChampionPack } from './ai.js';
import { F_NOSPAWN, F_ROOM, F_SOLID, F_OPAQUE, F_LAVA } from './level.js';
import { spawnNPCs } from './npcs.js';
import { QUESTS } from './quests.js';
import { makeItem } from './items.js';

export const LEVELS = [];
for (let d = 1; d <= 16; d++) {
  const theme = d <= 4 ? 'crypt' : d <= 8 ? 'catacombs' : d <= 12 ? 'caves' : 'hell';
  const area = d <= 4 ? '대성당 지하' : d <= 8 ? '카타콤' : d <= 12 ? '불타는 동굴' : '지옥';
  const n = d <= 4 ? d : d <= 8 ? d - 4 : d <= 12 ? d - 8 : d - 12;
  LEVELS[d] = { depth: d, theme, name: d === 16 ? '공허의 옥좌' : `${area} ${n}층`, waypoint: d % 2 === 1 && d > 1 && d < 16 };
}
export function levelName(d) { return d === 0 ? '애쉬폴 마을' : LEVELS[d]?.name || `${d}층`; }
export function themeOf(d) { return d === 0 ? 'town' : LEVELS[d].theme; }

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export function buildLevel(game, depth, rng) {
  if (depth === 0) {
    const L = generateTown(rng);
    spawnNPCs(game, L);
    return L;
  }
  const def = LEVELS[depth];
  // 퀘스트 무대(특별한 방)
  const special = [];
  for (const q of Object.values(QUESTS)) if (q.depth === depth && q.room) special.push({ id: q.id, w: q.room[0], h: q.room[1] });
  if (depth === 16) special.push({ id: 'throne', w: 13, h: 13 });
  const L = generateDungeon(rng, def.theme, depth, { special, noDown: depth === 16 });
  L.name = def.name;
  L.depth = depth;
  // 순간 이동 지점(오르는 계단 근처)
  if (def.waypoint) {
    const p = L.nearestFree(L.start.x + 2, L.start.y + 2, 6) || L.start;
    L.addObject({ type: 'waypoint', x: p.x, y: p.y, active: (game.hero?.data.wps || []).includes(depth), depth });
    L.wpAt = { x: p.x + 1, y: p.y };
  }
  // 마을로 가는 계단(1층은 오르는 계단이 곧 마을)
  for (const o of L.objects) if (o.type === 'stairs_up') o.toTown = depth === 1;
  populate(game, L, depth, rng);
  // 퀘스트 무대 꾸미기
  for (const q of Object.values(QUESTS)) if (q.depth === depth && q.build) q.build(game, L, rng);
  if (depth === 16) buildThrone(game, L, rng);
  repairReach(L);
  return L;
}

// ───────── 괴물 채우기(디아블로 1: 층에 맞는 종류 몇 가지, 바닥 30칸에 한 마리꼴) ─────────
function populate(game, L, depth, rng) {
  const elig = Object.values(MONSTERS).filter((m) => depth >= m.dl[0] && depth <= m.dl[1] && !(depth === 16 && !['black_knight', 'blood_knight', 'advocate'].includes(m.id)));
  if (!elig.length) return;
  const nTypes = depth <= 4 ? rng.int(4, 5) : depth <= 8 ? rng.int(3, 4) : depth <= 12 ? rng.int(3, 4) : 3;
  rng.shuffle(elig);
  // 같은 계열은 한 번만
  const types = [], fams = new Set();
  for (const m of elig) { if (types.length >= nTypes) break; if (fams.has(m.fam) && elig.length > nTypes * 2) continue; types.push(m); fams.add(m.fam); }
  L.monTypes = types.map((t) => t.id);
  let floor = 0;
  for (let i = 0; i < L.w * L.h; i++) if (L.passable(i % L.w, (i / L.w) | 0)) floor++;
  const N = Math.min(110, Math.floor(floor / 32));
  const spots = [];
  for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) {
    const k = L.idx(x, y);
    if (!L.passable(x, y) || L.flags[k] & F_NOSPAWN || L.obj(x, y)) continue;
    const r = L.room[k];
    if (r >= 0 && L.rooms[r]?.special) continue;
    spots.push([x, y]);
  }
  rng.shuffle(spots);
  let placed = 0, si = 0;
  const free = (x, y) => L.free(x, y) && !(L.flags[L.idx(x, y)] & F_NOSPAWN);
  while (placed < N && si < spots.length) {
    const [x, y] = spots[si++];
    if (!free(x, y)) continue;
    const t = rng.pick(types);
    const groupN = depth === 1 ? 1 : depth === 2 ? (rng.chance(0.5) ? 1 : rng.int(2, 3)) : (rng.chance(0.5) ? 1 : rng.int(3, 5));
    for (let g = 0; g < groupN && placed < N; g++) {
      const p = g === 0 ? { x, y } : L.nearestFree(x + rng.int(-2, 2), y + rng.int(-2, 2), 3);
      if (!p || !free(p.x, p.y)) continue;
      spawnMonster(game, L, t.id, p.x, p.y);
      placed++;
    }
  }
  // 이름 붙은 괴물(우두머리)과 용사 무리
  const nUnique = depth === 1 ? (rng.chance(0.4) ? 1 : 0) : rng.int(1, 2);
  for (let i = 0; i < nUnique; i++) {
    const s = spots[rng.int(0, spots.length - 1)];
    if (!s || !free(s[0], s[1])) continue;
    const t = rng.pick(types);
    makeUniquePack(game, L, t.id, s[0], s[1], depth >= 9 ? 2 : 1);
  }
  if (depth >= 3 && rng.chance(0.6)) {
    const s = spots[rng.int(0, spots.length - 1)];
    if (s && free(s[0], s[1])) makeChampionPack(game, L, rng.pick(types).id, s[0], s[1]);
  }
}

// 16층 옥좌의 방: 오각형 문양과 최종 보스
function buildThrone(game, L, rng) {
  const r = L.rooms.find((x) => x.special === 'throne');
  if (!r) return;
  L.decals.push({ x: r.cx, y: r.cy, kind: 'pent', rot: 0, s: 1.8, keep: true });
  for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
    const x = r.cx + dx, y = r.cy + dy;
    placeSolid(L, { type: 'brazier', x, y });
  }
  L.throneRoom = r;
  if (game.hero?.data.quests.velgath?.st !== 'done') {
    const b = spawnBoss(game, L, 'velgath', r.cx, r.cy - 2);
    for (let i = 0; i < 4; i++) {
      const p = L.nearestFree(r.cx + rnd(-4, 4), r.cy + rnd(-3, 4), 3);
      if (p) spawnMonster(game, L, i % 2 ? 'blood_knight' : 'advocate', p.x, p.y);
    }
  }
}

// 방 안의 빈 칸
export function roomSpots(L, r, inner = 1) {
  const out = [];
  for (let y = r.y + inner; y < r.y + r.h - inner; y++) for (let x = r.x + inner; x < r.x + r.w - inner; x++) if (L.passable(x, y) && !L.obj(x, y)) out.push([x, y]);
  return out;
}

// 해군: 함대 이동·제해권·해전·통상 파괴, 해상 수송·상륙 작전
import { SHIPS, SHIP_KEYS } from '../data/units.js';
import { M } from './mods.js';
import { atWar, allied, news } from './world.js';
import { blocked } from './supply.js';

const SHIP_FUEL = { dd: 4, cl: 7, ca: 11, bb: 24, cv: 18, ss: 2 };

export function fleetPower(G, F) {
  const C = G.countries[F.tag];
  let atk = 0, hp = 0;
  for (const k of SHIP_KEYS) { const n = F.ships[k] || 0; if (!n) continue; atk += SHIPS[k].atk * n; hp += SHIPS[k].hp * n; }
  atk *= 1 + (C ? M(C, 'navy.atk') : 0);
  return { atk, hp, ships: SHIP_KEYS.reduce((s, k) => s + (F.ships[k] || 0), 0) };
}
export function fleetSize(F) { return SHIP_KEYS.reduce((s, k) => s + (F.ships[k] || 0), 0); }

export function createFleet(G, tag, base, ships, name) {
  const id = G.nextId++;
  const C = G.countries[tag];
  C.fleetNum = (C.fleetNum || 0) + 1;
  const zone = G.map.coast[base]?.[0] ?? 0;
  const F = { id, tag, name: name || `제${C.fleetNum} 함대`, ships: { ...ships }, base, loc: zone, target: zone, mission: 'patrol', dmg: 0, path: [], prog: 0, rest: 0 };
  G.fleets[id] = F;
  return F;
}

export function seaPath(G, tag, from, to) {
  if (from === to) return [];
  const map = G.map; const prev = new Int32Array(map.seas.length).fill(-1); const seen = new Uint8Array(map.seas.length);
  const q = [from]; seen[from] = 1;
  while (q.length) {
    const z = q.shift(); if (z === to) break;
    for (const w of map.seas[z].nb) {
      if (seen[w]) continue;
      const via = map.seas[z].via[w];
      if (via != null) { const c = G.st[via].ctrl; if (c !== tag && !allied(G, tag, c) && atWar(G, tag, c)) continue; }
      seen[w] = 1; prev[w] = z; q.push(w);
    }
  }
  if (!seen[to]) return null;
  const path = []; for (let z = to; z !== from; z = prev[z]) path.unshift(z);
  return path;
}

export function dailyNaval(G) {
  const map = G.map;
  // 이동
  for (const id in G.fleets) {
    const F = G.fleets[id];
    const C = G.countries[F.tag];
    if (!C?.alive || fleetSize(F) === 0) { delete G.fleets[id]; continue; }
    if (F.rest > 0) { F.rest--; F.dmg = Math.max(0, F.dmg * 0.85 - 5); continue; }
    if (F.loc !== F.target) {
      if (!F.path?.length || F.path[F.path.length - 1] !== F.target) F.path = seaPath(G, F.tag, F.loc, F.target) || [];
      if (F.path.length) { F.prog = (F.prog || 0) + 650; const d = map.seaDist(F.loc, F.path[0]); if (F.prog >= d) { F.loc = F.path.shift(); F.prog = 0; } }
    } else if (F.mission === 'idle' || F.mission === 'repair') {
      F.dmg = Math.max(0, F.dmg * 0.9 - 10);
    }
    if (F.mission !== 'idle' && C.fuel > 0) {
      // 함종별 하루 연료 소모, 평시 훈련 항해는 15%
      let use = 0; for (const k of SHIP_KEYS) use += (F.ships[k] || 0) * SHIP_FUEL[k];
      if (!G.warRel[F.tag] || !Object.keys(G.warRel[F.tag]).length) use *= 0.15;
      C.fuel = Math.max(0, C.fuel - use);
    }
  }
  // 제해권
  G.navSup = {};
  for (const id in G.fleets) {
    const F = G.fleets[id];
    if (F.rest > 0 || F.mission === 'idle') continue;
    const p = fleetPower(G, F);
    const surface = SHIP_KEYS.filter((k) => k !== 'ss').reduce((s, k) => s + (F.ships[k] || 0) * (SHIPS[k].atk + SHIPS[k].hp / 20), 0);
    const subs = (F.ships.ss || 0) * 3;
    const val = F.mission === 'raid' ? subs + surface * 0.3 : surface + subs * 0.3;
    (G.navSup[F.loc] ||= {})[F.tag] = ((G.navSup[F.loc] || {})[F.tag] || 0) + val;
  }
  // 해전
  const byZone = {};
  for (const id in G.fleets) { const F = G.fleets[id]; if (F.rest > 0) continue; (byZone[F.loc] ||= []).push(F); }
  for (const z in byZone) {
    const list = byZone[z];
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (!atWar(G, A.tag, B.tag)) continue;
      if (A.mission === 'idle' && B.mission === 'idle') continue;
      navalBattle(G, A, B, +z);
    }
  }
  // 통상 파괴: 잠수함 활동 → 적국 수입 손실률
  G.raid = {};
  for (const id in G.fleets) {
    const F = G.fleets[id];
    if (F.mission !== 'raid' || F.rest > 0) continue;
    const C = G.countries[F.tag];
    const pow = (F.ships.ss || 0) * (1 + M(C, 'sub.atk')) + (F.ships.cl || 0) * 0.3 + (F.ships.ca || 0) * 0.5;
    for (const e of Object.keys(G.warRel[F.tag] || {})) G.raid[e] = (G.raid[e] || 0) + pow;
  }
  for (const t in G.raid) {
    // 호위 전력
    let esc = 0; for (const id in G.fleets) { const F = G.fleets[id]; if (F.tag === t || allied(G, t, F.tag)) esc += ((F.ships.dd || 0) * 1.2 + (F.ships.cl || 0) * 0.5) * (F.mission === 'escort' ? 2 : 0.5); }
    G.raid[t] = Math.min(0.5, G.raid[t] / (G.raid[t] + esc + 40));
  }
}

function navalBattle(G, A, B, z) {
  const rng = G.rng;
  const pa = fleetPower(G, A), pb = fleetPower(G, B);
  const hitA = pb.atk * (0.6 + rng() * 0.8) * 0.6; // A가 입는 피해
  const hitB = pa.atk * (0.6 + rng() * 0.8) * 0.6;
  const sunkA = applyNavalDamage(G, A, hitA), sunkB = applyNavalDamage(G, B, hitB);
  const nameA = G.countries[A.tag].name, nameB = G.countries[B.tag].name;
  const zn = G.map.seas[z].name;
  if (sunkA + sunkB > 0) news(G, `${zn} 해전: ${nameA} ${sunkA}척, ${nameB} ${sunkB}척 격침`, { kind: 'naval', tags: [A.tag, B.tag], big: sunkA + sunkB >= 4 ? 1 : 0 });
  // 약한 쪽은 귀항
  const ra = fleetPower(G, A).atk, rb = fleetPower(G, B).atk;
  const loser = ra < rb ? A : B;
  returnToPort(G, loser);
}

function applyNavalDamage(G, F, dmg) {
  F.dmg = (F.dmg || 0) + dmg;
  let sunk = 0;
  for (let guard = 0; guard < 50; guard++) {
    const list = SHIP_KEYS.filter((k) => (F.ships[k] || 0) > 0);
    if (!list.length) break;
    // 작은 함선부터 피격
    list.sort((a, b) => SHIPS[a].hp - SHIPS[b].hp);
    const k = G.rng() < 0.6 ? list[0] : list[Math.floor(G.rng() * list.length)];
    if (F.dmg < SHIPS[k].hp) break;
    F.dmg -= SHIPS[k].hp; F.ships[k]--; sunk++;
    const C = G.countries[F.tag]; C.stats.shipsLost = (C.stats.shipsLost || 0) + 1;
  }
  return sunk;
}

export function returnToPort(G, F) {
  const zone = G.map.coast[F.base]?.[0];
  if (G.st[F.base]?.ctrl !== F.tag && !allied(G, F.tag, G.st[F.base]?.ctrl)) {
    // 다른 항구 탐색
    for (let i = 0; i < G.st.length; i++) if (G.st[i].ctrl === F.tag && G.st[i].port > 0) { F.base = i; break; }
  }
  F.target = G.map.coast[F.base]?.[0] ?? F.loc;
  F.loc = F.target;
  F.rest = 5;
}

// 신조 함선 → 본국 예비 함대
export function addShip(G, C, ship) {
  let F = Object.values(G.fleets).find((f) => f.tag === C.tag && f.reserve);
  if (!F) {
    const base = C.navalBase >= 0 && G.st[C.navalBase]?.ctrl === C.tag ? C.navalBase : (() => { for (let i = 0; i < G.st.length; i++) if (G.st[i].ctrl === C.tag && G.st[i].port > 0) return i; return -1; })();
    if (base < 0) return;
    F = createFleet(G, C.tag, base, {}, '예비 함대'); F.reserve = true; F.mission = 'idle';
  }
  F.ships[ship] = (F.ships[ship] || 0) + 1;
}

// ───────── 해상 수송 / 상륙 ─────────
// 아군 항구 → 아군 항구 수송: 도착 시각 반환
export function transportTime(G, tag, from, to) {
  const map = G.map;
  let best = Infinity;
  for (const za of map.coast[from]) for (const zb of map.coast[to]) {
    const p = seaPath(G, tag, za, zb); if (!p) continue;
    if (p.some((z) => blocked(G, tag, z))) continue;
    let d = map.stateSeaDist(from, za); let prev = za; for (const z of p) { d += map.seaDist(prev, z); prev = z; } d += map.stateSeaDist(to, zb);
    best = Math.min(best, d);
  }
  return best === Infinity ? null : Math.max(24, best / 18); // 약 18 km/h
}

export function canInvade(G, tag, target) {
  const map = G.map;
  if (!map.coastal[target] || map.virtual[target]) return '해안 주가 아닙니다';
  const c = G.st[target].ctrl;
  if (!atWar(G, tag, c)) return '전쟁 중인 적국 영토가 아닙니다';
  // 대상 해역 제해권
  const zs = map.coast[target];
  let ok = false;
  for (const z of zs) {
    const ns = G.navSup?.[z] || {};
    let own = 0, en = 0;
    for (const t in ns) { if (t === tag || allied(G, tag, t)) own += ns[t]; else if (atWar(G, tag, t)) en += ns[t]; }
    if (en === 0 || own / (own + en) >= 0.5) ok = true;
  }
  if (!ok) return '대상 해역의 제해권이 50% 미만입니다';
  return null;
}

// 매 시간: 승선 중인 사단 처리
export function hourlyEmbarked(G) {
  for (const id in G.divs) {
    const D = G.divs[id];
    if (!D.sea) continue;
    if (G.hour < D.sea.eta) continue;
    const t = D.sea.to;
    const kind = D.sea.kind;
    const from = D.loc;
    D.sea = null;
    if (kind === 'invade') {
      const c = G.st[t].ctrl;
      if (!atWar(G, D.tag, c)) { // 평화가 되었으면 귀환
        continue;
      }
      // 적이 있으면 상륙 공격, 없으면 바로 점령
      const enemies = (G.divsAt[t] || []).filter((x) => G.divs[x] && atWar(G, D.tag, G.divs[x].tag));
      if (enemies.length) { D.amphib = t; D.att = t; D.path = [t]; }
      else { D.path = [t]; D.prog = 1e9; D.amphib = t; }
    } else {
      // 수송 완료
      const a = G.divsAt[from]; if (a) { const k = a.indexOf(D.id); if (k >= 0) a.splice(k, 1); }
      D.loc = t; (G.divsAt[t] ||= []).push(D.id);
      D.path = []; D.prog = 0;
    }
  }
}

// 공군: 비행단 임무, 제공권, 근접 항공 지원, 전략 폭격 (매일 계산)
import { EQUIPMENT, AIR_TYPES } from '../data/units.js';
import { M } from './mods.js';
import { atWar, allied, news } from './world.js';
import { haversine } from './mapdata.js';

export const WING_SIZE = 100;
const MISSION_RADIUS = 450;

export function wingStats(C, type) {
  const E = EQUIPMENT[type]; const lv = Math.max(1, Math.min(C.eq[type] || 1, E.st.length - 1));
  return E.st[lv];
}

export function createWing(G, tag, type, n, base, mission = 'none', target = -1) {
  const id = G.nextId++;
  const C = G.countries[tag];
  C.wingNum ||= {};
  C.wingNum[type] = (C.wingNum[type] || 0) + 1;
  const W = { id, tag, type, n, base, mission, target: target >= 0 ? target : base, name: `제${C.wingNum[type]} ${AIR_TYPES[type].name} 비행단` };
  G.wings[id] = W;
  return W;
}

// 비행단이 담당하는 주 목록
export function wingCoverage(G, W) {
  const map = G.map;
  const range = AIR_TYPES[W.type].range;
  const tlon = map.lon[W.target], tlat = map.lat[W.target];
  if (haversine(map.lon[W.base], map.lat[W.base], tlon, tlat) > range) return [];
  const out = [];
  for (let i = 0; i < map.nGeo; i++) if (haversine(map.lon[i], map.lat[i], tlon, tlat) <= MISSION_RADIUS) out.push(i);
  return out;
}

export function dailyAir(G) {
  const map = G.map;
  const fighter = {}; // tag -> Float32Array 공중 전력
  const cas = {};
  const ensure = (obj, tag) => (obj[tag] ||= new Float32Array(map.n));
  const active = [];
  for (const id in G.wings) {
    const W = G.wings[id];
    const C = G.countries[W.tag];
    if (!C?.alive) { delete G.wings[id]; continue; }
    // 기지 상실 시 수도로 귀환
    if (G.st[W.base]?.ctrl !== W.tag && !allied(G, W.tag, G.st[W.base]?.ctrl)) { W.base = C.capital >= 0 ? C.capital : W.base; W.mission = 'none'; }
    // 보충
    if (W.n < WING_SIZE && (C.stock[W.type] || 0) >= 1) { const add = Math.min(WING_SIZE - W.n, Math.floor(C.stock[W.type]), 15); W.n += add; C.stock[W.type] -= add; }
    if (W.mission === 'none' || W.n < 1) continue;
    const st = wingStats(C, W.type);
    const fuelOk = C.fuel > 0 ? 1 : 0.2;
    const cov = wingCoverage(G, W);
    if (!cov.length) continue;
    W.cov = cov.length;
    const planes = W.n * fuelOk;
    C.fuel = Math.max(0, C.fuel - planes * 0.5 * (W.mission === 'none' ? 0 : 1));
    const aAtk = (st.atk || 0) * (1 + M(C, 'air.atk')) * (1 + (st.agi || 0) / 200) * (1 + M(C, 'air.agi'));
    active.push({ W, C, st, cov, planes, aAtk });
    if (W.mission === 'sup' || W.type === 'fighter') { const arr = ensure(fighter, W.tag); for (const s of cov) arr[s] += planes * aAtk / cov.length * 6; }
    else { const arr = ensure(fighter, W.tag); for (const s of cov) arr[s] += planes * aAtk * 0.15 / cov.length * 6; }
  }
  // 제공권
  G.airSup = {}; G.airPen = {};
  const tags = Object.keys(G.countries).filter((t) => G.countries[t].alive);
  for (const t of tags) {
    const enemies = Object.keys(G.warRel[t] || {});
    if (!enemies.length) continue;
    const sup = (G.airSup[t] = new Float32Array(map.n));
    const pen = (G.airPen[t] = new Float32Array(map.n));
    for (let i = 0; i < map.n; i++) {
      let own = 0, en = 0;
      for (const f in fighter) { const v = fighter[f][i]; if (!v) continue; if (f === t || allied(G, t, f)) own += v; else if (atWar(G, t, f)) en += v; }
      // 대공포 건물
      const S = G.st[i];
      if (S.aa) { if (S.ctrl === t || allied(G, t, S.ctrl)) own += S.aa * 15; else if (atWar(G, t, S.ctrl)) en += S.aa * 15; }
      if (own + en <= 0) { sup[i] = 0.5; continue; }
      sup[i] = own / (own + en);
      pen[i] = Math.max(0, (1 - sup[i]) - 0.4) * 0.35 / 0.6;
    }
  }
  // 공중전 손실: 적 전투기가 있는 담당 구역에서 제공권 열세만큼 잃는다.
  // 지상전이 벌어지는 구역이 있으면 출격이 격렬해진다(가짜 전쟁 같은 소강기에는 손실이 적다)
  for (const a of active) {
    const enemies = Object.keys(G.warRel[a.W.tag] || {});
    if (!enemies.length) continue;
    const sup = G.airSup[a.W.tag];
    let contested = 0, inferior = 0, hot = 0;
    for (const s of a.cov) {
      let en = 0; for (const e of enemies) en += fighter[e]?.[s] || 0;
      if (en <= 0) continue;
      contested++; inferior += 1 - (sup ? sup[s] : 0.5);
      if (G.battles[s]) hot++;
    }
    if (!contested) continue;
    const share = inferior / contested; // 0(우세) ~ 1(열세)
    const intensity = 0.15 + 0.85 * Math.min(1, hot / Math.max(1, contested * 0.1));
    const def = (a.st.def || 10) * (1 + M(a.C, 'air.def')) * (1 + (a.st.agi || 30) / 100);
    const loss = a.W.n * Math.min(0.08, 0.025 * share * intensity / Math.max(0.6, def / 12)) * (contested / a.cov.length * 0.5 + 0.5);
    a.W.n = Math.max(0, a.W.n - loss);
    a.C.stats.planesLost = (a.C.stats.planesLost || 0) + loss;
  }
  // CAS 위력 (전투 판정에서 사용)
  G.casPower = {};
  for (const a of active) {
    if (a.W.mission !== 'cas') continue;
    const gnd = (a.st.gnd || 0) * (1 + M(a.C, 'cas.dmg'));
    const arr = (G.casPower[a.W.tag] ||= new Float32Array(map.n));
    for (const s of a.cov) {
      const sup = G.airSup[a.W.tag]?.[s] ?? 0.5;
      arr[s] += (a.planes * gnd * Math.max(0.15, sup)) / Math.max(1, Math.sqrt(a.cov.length)) * 0.03;
    }
    // 대공 피해
    let aa = 0; for (const s of a.cov) aa += G.st[s].aa || 0;
    a.W.n = Math.max(0, a.W.n - a.W.n * Math.min(0.05, aa * 0.002));
  }
  // 전략 폭격
  for (const a of active) {
    if (a.W.mission !== 'bomb') continue;
    const S = G.st[a.W.target];
    if (!atWar(G, a.W.tag, S.ctrl)) continue;
    const sup = G.airSup[a.W.tag]?.[a.W.target] ?? 0.5;
    const dmg = a.planes * (a.st.bomb || 0) * (1 + M(a.C, 'bomb.dmg')) * sup * 0.00002 * Math.max(0.3, 1 - (S.aa || 0) * 0.12);
    S.dmg = Math.min(0.8, (S.dmg || 0) + dmg);
    const V = G.countries[S.ctrl]; if (V) V.baseWs -= dmg * 0.02;
  }
  // 복구
  for (const S of G.st) if (S.dmg) S.dmg = Math.max(0, S.dmg - 0.01);
}

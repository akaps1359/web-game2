// 지상 전투 — HOI4 방식(시간당 공격 횟수/방어 판정, 10%·40% 명중, 조직력·내구도 피해)
import { TERRAIN, BATTALIONS } from '../data/units.js';
import { M } from './mods.js';
import { atWar, ymd, news } from './world.js';
import { divStats, retreatDivision, getTpl } from './military.js';

export const COMBAT_K = 1.25; // 주 단위 전투 가속 계수

const xpF = (xp) => 0.85 + 0.35 * xp;
const strF = (str) => Math.max(0.1, Math.ceil(str * 10) / 10);

function clsBonus(C, st, kind) {
  // kind: 'atk' | 'def'
  let b = 0;
  const n = st.nBat || 1;
  if (kind === 'atk') {
    b += M(C, 'arm.atk') * ((st.cls.arm || 0) / n) * 2.5;
    b += M(C, 'mot.atk') * ((st.cls.mot || 0) / n) * 2;
    b += M(C, 'cav.atk') * ((st.cls.cav || 0) / n);
    b += M(C, 'inf.atk') * ((st.cls.inf || 0) / n);
    b += M(C, 'art.atk') * Math.min(1, ((st.cls.art || 0) / n) * 3);
  } else {
    b += M(C, 'inf.def') * ((st.cls.inf || 0) / n);
  }
  return b;
}

function terrBonus(C, D, st, terrain, extra) {
  const tpl = getTpl(C, D.tpl); let sum = 0, n = 0;
  for (const b in tpl.bats) { const B = BATTALIONS[b]; const cnt = tpl.bats[b]; n += cnt; let v = B.terr?.[terrain] || 0; for (const e of extra) v += B.terr?.[e] || 0; sum += v * cnt; }
  return n ? sum / n : 0;
}

function generalSkill(G, D) {
  const A = D.army && G.armies[D.army]; if (!A || !A.gen) return 0;
  const C = G.countries[D.tag]; const g = C.generals.find((x) => x.id === A.gen); return g ? g.skill : 0;
}

function winterFactor(G, C, st) {
  const { m } = ymd(G.hour);
  if (m !== 12 && m !== 1 && m !== 2) return 1;
  const lat = G.map.lat[st];
  if (lat < 47 || G.map.lon[st] < 20) return 1;
  const res = Math.min(1, M(C, 'winter'));
  return 1 - 0.25 * (1 - res);
}

export function hourlyCombat(G) {
  const map = G.map;
  const groups = {};
  for (const id in G.divs) {
    const D = G.divs[id];
    if (D.att < 0) continue;
    const t = D.att;
    if ((!map.adjSet[D.loc].has(t) && D.amphib !== t) || D.retreat) { D.att = -1; if (D.amphib === t) D.amphib = -1; continue; }
    (groups[t] ||= { atk: [], def: [], dirs: new Set() });
    groups[t].atk.push(D); groups[t].dirs.add(D.loc);
  }
  const active = {};
  for (const tk in groups) {
    const t = +tk;
    const Gp = groups[t];
    const atkTags = [...new Set(Gp.atk.map((d) => d.tag))];
    for (const id of G.divsAt[t] || []) {
      const E = G.divs[id]; if (!E || E.retreat) continue;
      if (atkTags.some((a) => atWar(G, a, E.tag))) Gp.def.push(E);
    }
    if (!Gp.def.length) {
      for (const D of Gp.atk) { D.att = -1; D.won = true; if (!D.path.length || D.path[0] !== t) D.path = [t]; }
      continue;
    }
    const prev = G.battles[t];
    active[t] = resolve(G, t, Gp, prev);
  }
  // 종료된 전투
  for (const tk in G.battles) if (!active[tk]) { const B = G.battles[tk]; if (G.onBattleEnd) G.onBattleEnd(B); }
  G.battles = active;
}

function resolve(G, t, Gp, prev) {
  const map = G.map;
  const terrain = map.terrain[t];
  const T = TERRAIN[terrain] || TERRAIN.plains;
  const S = G.st[t];
  const dirs = Gp.dirs.size;
  const width = Math.min(T.width * 2, T.width + T.extra * (dirs - 1));
  const rng = G.rng;

  const prep = (D, side) => {
    const C = G.countries[D.tag];
    const st = divStats(G, D);
    const air = (G.airPen && G.airPen[D.tag] && G.airPen[D.tag][t]) || 0; // 적 제공권에 의한 감소(0~0.35)
    const sup = D.sup;
    const gen = 1 + 0.025 * generalSkill(G, D);
    const w = winterFactor(G, C, t);
    const fuelPen = st.fuel > 0 && C.fuel <= 0 ? 0.6 : 1;
    const u = { D, C, st, side };
    const baseAtk = (1 + M(C, 'land.atk') + clsBonus(C, st, 'atk')) * (1 - air) * gen * xpF(D.xp) * strF(D.str) * w * fuelPen;
    if (side === 'atk') {
      const amphib = D.amphib === t;
      const e = amphib ? null : map.edge(D.loc, t);
      const riverKey = e ? (e.river === 2 || e.river === 3 ? 'river' : e.river === 1 ? 'river' : null) : null;
      const riverPen = amphib ? 0.3 : e ? (e.river === 2 ? 0.4 : e.river === 1 ? 0.7 : e.river === 3 ? 0.5 : 1) : 1;
      const tb = terrBonus(C, D, st, terrain, riverKey ? [riverKey] : amphib ? ['amphib'] : []);
      const fortLv = Math.max(0, (S.fort || 0) - (dirs - 1));
      const fortPen = Math.max(0.25, 1 - 0.15 * fortLv);
      const supPen = 0.75 + 0.25 * Math.min(1, sup);
      u.atk = baseAtk * (1 + T.atk) * (1 + tb) * riverPen * fortPen * supPen * (1 + D.plan) * (st.mods.artAtk ? 1 + st.mods.artAtk * 0.3 : 1);
      u.dfn = st.brk * (1 + M(C, 'land.brk')) * (1 - air) * (0.35 + 0.65 * Math.min(1, sup)) * gen * xpF(D.xp);
    } else {
      const supPen = 0.65 + 0.35 * Math.min(1, sup);
      const engDef = ['forest', 'marsh', 'jungle'].includes(terrain) ? (st.mods.terrDef || 0) : 0;
      const coreBonus = S.cores.includes(D.tag) ? Math.max(0, (C.warSupport - 0.5) * 0.2) : 0;
      const encircled = sup <= 0.05 ? 0.7 : 1;
      u.atk = baseAtk * supPen * encircled;
      u.dfn = st.def * (1 + M(C, 'land.def') + clsBonus(C, st, 'def') + coreBonus) * (1 + 0.02 * D.ent) * (1 + engDef) * (1 - air) * (0.85 + 0.15 * Math.min(1, sup)) * gen * xpF(D.xp) * encircled;
    }
    u.orgDmg = 0; u.hpDmg = 0;
    return u;
  };
  const pickFront = (list, side) => {
    const units = list.map((D) => prep(D, side));
    units.sort((a, b) => (b.D.org / Math.max(1, b.st.org) + b.D.str) - (a.D.org / Math.max(1, a.st.org) + a.D.str));
    const front = []; let used = 0;
    for (const u of units) {
      if (front.length && used + u.st.w > width * 1.1) continue;
      if (u.D.org <= 0.5 && front.length) continue;
      front.push(u); used += u.st.w;
    }
    return { front, used, all: units };
  };
  const A = pickFront(Gp.atk, 'atk');
  const Dd = pickFront(Gp.def, 'def');

  const strike = (attackers, defenders) => {
    const pool = new Map(defenders.map((u) => [u, u.dfn / 10]));
    for (const a of attackers) {
      if (!defenders.length) break;
      let t;
      if (rng() < 0.5) { t = defenders[0]; for (const d of defenders) if (d.D.org < t.D.org) t = d; }
      else t = defenders[Math.floor(rng() * defenders.length)];
      const hard = t.st.hard;
      let attacks = ((a.st.sa * (1 - hard) + a.st.ha * hard) * a.atk) / 10;
      attacks *= 0.85 + rng() * 0.3;
      const p = pool.get(t);
      const blocked = Math.min(attacks, p);
      pool.set(t, p - blocked);
      const hits = blocked * 0.1 + (attacks - blocked) * 0.4;
      let dmgF = 1;
      if (t.st.arm > a.st.prc) { const r = a.st.prc / Math.max(1, t.st.arm); dmgF = r >= 0.75 ? 0.8 : r >= 0.5 ? 0.65 : 0.5; }
      const orgDie = a.st.arm > t.st.prc ? 3.5 : 2.5;
      t.orgDmg += hits * 0.053 * orgDie * dmgF * COMBAT_K;
      t.hpDmg += hits * 0.09 * dmgF * COMBAT_K;
    }
  };
  strike(A.front, Dd.front);
  strike(Dd.front, A.front);

  // 근접 항공 지원
  if (G.casPower) {
    for (const [side, enemyFront] of [['atk', Dd.front], ['def', A.front]]) {
      const tags = (side === 'atk' ? A.front : Dd.front).map((u) => u.D.tag);
      let pow = 0; for (const tag of new Set(tags)) pow += G.casPower[tag]?.[t] || 0;
      if (pow <= 0 || !enemyFront.length) continue;
      let aa = 0; for (const u of enemyFront) aa += u.st.aa;
      const aaRed = Math.max(0.25, 1 - aa / 120);
      const per = (pow * aaRed) / enemyFront.length;
      for (const u of enemyFront) { u.orgDmg += per * 0.06; u.hpDmg += per * 0.03; }
    }
  }

  // 피해 적용
  const apply = (u) => {
    if (!u.orgDmg && !u.hpDmg) return;
    const D = u.D;
    D.org = Math.max(0, D.org - u.orgDmg);
    const dStr = Math.min(D.str - 0.01, u.hpDmg / Math.max(1, u.st.hp));
    if (dStr > 0) {
      D.str -= dStr;
      const cas = u.st.mp * dStr * (1 + (u.st.mods.casualty || 0));
      u.C.mp.dead += cas; u.C.mp.inDivs -= u.st.mp * dStr;
      u.C.stats.casualties = (u.C.stats.casualties || 0) + cas;
    }
    D.xp = Math.min(1, D.xp + 0.0006);
    D.plan = Math.max(0, D.plan - 0.01);
  };
  for (const u of A.front) apply(u);
  for (const u of Dd.front) apply(u);

  // 조직력 소진 처리
  const defIds = [], atkIds = [];
  for (const u of Dd.all) {
    if (u.D.org <= 0.5) { retreatDivision(G, u.D); }
    else defIds.push(u.D.id);
  }
  for (const u of A.all) {
    if (u.D.org <= 0.5) { u.D.att = -1; u.D.path = []; if (u.D.amphib === t) { u.D.amphib = -1; u.D.str = Math.max(0.05, u.D.str * 0.7); } }
    else atkIds.push(u.D.id);
  }
  // 승리 확률 근사(조직력 합 비율)
  const orgSum = (list) => list.reduce((s, u) => s + (u.D.org / Math.max(1, u.st.org)) * u.D.str * (u.atk + u.dfn / 4), 0);
  const ao = orgSum(A.all.filter((u) => G.divs[u.D.id])), dd = orgSum(Dd.all.filter((u) => G.divs[u.D.id]));
  const win = ao + dd > 0 ? ao / (ao + dd) : 0.5;
  const atkTag = A.all[0]?.D.tag, defTag = S.ctrl;
  const B = prev || { st: t, start: G.hour, atkTag, defTag, losses: [0, 0] };
  B.atkTag = atkTag; B.defTag = defTag; B.atkIds = atkIds; B.defIds = defIds; B.dirs = [...Gp.dirs]; B.win = win; B.width = width;
  B.frontA = A.front.length; B.frontD = Dd.front.length;
  if (!prev && G.onBattleStart) G.onBattleStart(B);
  return B;
}

// 사단·편제·이동·회복·보충·훈련
import { BATTALIONS, SUPPORT, EQUIPMENT, TERRAIN } from '../data/units.js';
import { M } from './mods.js';
import { atWar, allied, friendlyCtrl, news } from './world.js';

const STAT_KEYS = ['sa', 'ha', 'def', 'brk', 'aa'];

export function eqLevel(C, eq) {
  if (eq === 'sup_eq' || eq === 'mot') return 1;
  return C.eq[eq] || 0;
}
export function eqCost(C, eq) {
  const E = EQUIPMENT[eq]; const lv = Math.max(1, eqLevel(C, eq));
  return E.ic[Math.min(lv, E.ic.length - 1)];
}

// 편제가 현재 기술로 편성 가능한가
export function tplAvailable(C, tpl) {
  for (const b in tpl.bats) { const B = BATTALIONS[b]; if (!B) return false; if (B.need && !C.unlock[B.need]) return false; for (const e in B.eq) if (eqLevel(C, e) < 1) return false; }
  for (const s of tpl.sup || []) { const S = SUPPORT[s]; if (!S) return false; if (S.need && !C.unlock[S.need]) return false; }
  return true;
}

// 편제 능력치 (HOI4 합산 규칙)
export function tplStats(C, tpl) {
  const key = tpl.id;
  const cache = (C._tpl ||= {});
  if (cache[key] && cache[key].ver === C.techVer) return cache[key];
  const s = { ver: C.techVer, w: 0, hp: 0, org: 0, sa: 0, ha: 0, def: 0, brk: 0, aa: 0, arm: 0, prc: 0, hard: 0, spd: 99, sup: 0, fuel: 0, mp: 0, eq: {}, train: 0, nBat: 0, mods: {}, cls: {}, ic: 0 };
  const arms = [], prcs = [];
  let orgSum = 0, hardSum = 0, n = 0;
  const addEq = (eq, cnt) => { s.eq[eq] = (s.eq[eq] || 0) + cnt; };
  for (const b in tpl.bats) {
    const cnt = tpl.bats[b]; if (!cnt) continue;
    const B = BATTALIONS[b];
    // 장비 능력치 합
    const st = { sa: 0, ha: 0, def: 0, brk: 0, aa: 0, arm: 0, prc: 0, hard: 0, spd: 0 };
    let maxSpd = 0;
    for (const e in B.eq) {
      const E = EQUIPMENT[e]; const lv = Math.max(0, Math.min(eqLevel(C, e), E.st.length - 1));
      const es = E.st[lv] || {};
      for (const k in es) { if (k === 'spd') maxSpd = Math.max(maxSpd, es[k]); else if (k === 'hard' || k === 'arm' || k === 'prc') st[k] = Math.max(st[k], es[k]); else st[k] += es[k]; }
    }
    const bonus = B.bonus || {};
    for (const k of STAT_KEYS) st[k] *= 1 + (bonus[k] || 0);
    const spd = B.spd || maxSpd || 4;
    for (const k of STAT_KEYS) s[k] += st[k] * cnt;
    s.w += B.w * cnt; s.hp += B.hp * cnt; s.sup += B.sup * cnt; s.fuel += (B.fuel || 0) * cnt; s.mp += B.mp * cnt;
    orgSum += B.org * cnt; hardSum += st.hard * cnt; n += cnt;
    for (let i = 0; i < cnt; i++) { arms.push(st.arm); prcs.push(st.prc); }
    s.spd = Math.min(s.spd, spd);
    s.train = Math.max(s.train, B.train);
    for (const e in B.eq) addEq(e, B.eq[e] * cnt);
    s.cls[B.cls || 'inf'] = (s.cls[B.cls || 'inf'] || 0) + cnt;
  }
  for (const sid of tpl.sup || []) {
    const S = SUPPORT[sid]; if (!S) continue;
    if (S.st) for (const k in S.st) s[k] += S.st[k];
    if (S.eqst) for (const e in S.eqst) {
      const E = EQUIPMENT[e]; const lv = Math.max(0, Math.min(eqLevel(C, e), E.st.length - 1)); const es = E.st[lv] || {};
      for (const k of STAT_KEYS) s[k] += (es[k] || 0) * S.eqst[e];
      if (es.prc) prcs.push(es.prc * (S.prcMult || 1));
    }
    s.hp += S.hp; s.mp += S.mp;
    for (const e in S.eq) addEq(e, S.eq[e]);
    for (const k in S.mods || {}) s.mods[k] = (s.mods[k] || 0) + S.mods[k];
  }
  s.nBat = n;
  s.org = n ? orgSum / n : 0;
  s.hard = n ? hardSum / n : 0;
  if (arms.length) { const mx = Math.max(...arms), av = arms.reduce((a, b) => a + b, 0) / arms.length; s.arm = mx * 0.3 + av * 0.7; }
  if (prcs.length) { const mx = Math.max(...prcs), av = prcs.reduce((a, b) => a + b, 0) / prcs.length; s.prc = mx * 0.4 + av * 0.6; }
  if (s.spd === 99) s.spd = 4;
  s.sup *= 1 + (s.mods.supply || 0);
  for (const e in s.eq) s.ic += s.eq[e] * eqCost(C, e);
  s.armored = (s.cls.arm || 0) > 0;
  s.motorized = (s.cls.mot || 0) + (s.cls.arm || 0) >= n * 0.6;
  cache[key] = s;
  return s;
}

export function getTpl(C, id) { return C.templates.find((t) => t.id === id); }
export function divStats(G, D) { const C = G.countries[D.tag]; return tplStats(C, getTpl(C, D.tpl)); }

// 사단 아이콘 종류
export function divKind(st) { if (st.cls.arm) return 'arm'; if (st.cls.mot) return 'mot'; if (st.cls.cav && st.cls.cav >= st.nBat / 2) return 'cav'; return 'inf'; }

const ORD = (n) => `제${n}`;
const KIND_NAME = { arm: '기갑 사단', mot: '차량화 사단', cav: '기병 사단', inf: '보병 사단', mtn: '산악 사단', gar: '수비 사단' };
export function nextDivName(C, tpl, st) {
  const kind = tpl.key === 'gar' ? 'gar' : tpl.bats.mtn ? 'mtn' : divKind(st);
  C.divNum ||= {};
  C.divNum[kind] = (C.divNum[kind] || 0) + 1;
  return `${ORD(C.divNum[kind])} ${KIND_NAME[kind]}`;
}

export function createDivision(G, tag, tplId, loc, opts = {}) {
  const C = G.countries[tag];
  const tpl = getTpl(C, tplId);
  const st = tplStats(C, tpl);
  const id = G.nextId++;
  const D = {
    id, tag, tpl: tplId, name: opts.name || nextDivName(C, tpl, st), loc,
    path: [], prog: 0, org: st.org * (opts.orgFrac ?? 1), str: opts.str ?? 1, xp: opts.xp ?? 0.1,
    ent: 0, plan: 0, att: -1, retreat: false, army: opts.army ?? 0, sup: 1, amphib: -1, sea: null,
  };
  G.divs[id] = D;
  return D;
}

export function destroyDivision(G, D, reason) {
  const C = G.countries[D.tag];
  if (C) {
    const st = divStats(G, D);
    C.mp.dead += st.mp * D.str;
    C.stats.lostDivs = (C.stats.lostDivs || 0) + 1;
  }
  if (D.army && G.armies[D.army]) { const A = G.armies[D.army]; A.divs = A.divs.filter((x) => x !== D.id); }
  delete G.divs[D.id];
  if (G.onDivDestroyed) G.onDivDestroyed(D, reason);
}

// ───────── 이동 비용 ─────────
export function moveCost(G, from, to) {
  // km 단위 유효 거리 (지형·하천 반영)
  const map = G.map;
  const d = map.dist(from, to);
  const T = TERRAIN[map.terrain[to]] || TERRAIN.plains;
  const e = map.edge(from, to);
  const river = e ? (e.river === 2 ? 1.5 : e.river === 1 ? 1.25 : e.river === 3 ? 1.6 : 1) : 1;
  const infra = G.st[to].infra || 1;
  const infraF = 1 + (5 - Math.min(5, infra)) * 0.05;
  return d * T.move * river * infraF;
}

export function divSpeed(G, D, st) {
  const C = G.countries[D.tag];
  let spd = st.spd * (1 + M(C, 'land.speed') + (st.mods.speed || 0));
  if (st.fuel > 0 && C.fuel <= 0) spd *= 0.5;
  if (D.retreat) spd *= 1.25;
  if (D.sup < 0.3) spd *= 0.6;
  const air = G.airPen ? G.airPen[D.tag]?.[D.loc] || 0 : 0;
  spd *= 1 - air * 0.3 / 0.35;
  return Math.max(0.5, spd);
}

// ───────── 경로 탐색 (다익스트라, 시간 비용) ─────────
// mode: 'friendly' 아군 영토만, 'attack' 적 영토 진입 허용
export function findPath(G, tag, from, to, mode = 'attack') {
  if (from === to) return [];
  const map = G.map, n = map.n;
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  dist[from] = 0;
  const open = [from];
  const inOpen = new Uint8Array(n); inOpen[from] = 1;
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const u = open[bi]; open.splice(bi, 1); inOpen[u] = 0;
    if (u === to) break;
    for (const v of map.nb[u]) {
      const c = G.st[v].ctrl;
      const friendly = c === tag || allied(G, tag, c) || G.countries[tag].access?.includes(c);
      const hostile = atWar(G, tag, c);
      if (!friendly && !(hostile && mode === 'attack')) continue;
      // 적 영토를 지나 계속 가는 것은 허용하되 비용 가중
      const w = moveCost(G, u, v) * (hostile ? 1.6 : 1);
      if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; if (!inOpen[v]) { open.push(v); inOpen[v] = 1; } }
    }
  }
  if (prev[to] < 0) return null;
  const path = [];
  for (let v = to; v !== from; v = prev[v]) path.unshift(v);
  return path;
}

export function orderMove(G, D, target, mode = 'attack') {
  if (D.retreat) return false;
  if (target === D.loc) { D.path = []; D.prog = 0; D.att = -1; return true; }
  const path = findPath(G, D.tag, D.loc, target, mode);
  if (!path) return false;
  // 현재 진행 중인 구간과 같으면 진행도 유지
  if (!(D.path.length && path[0] === D.path[0])) D.prog = 0;
  D.path = path;
  D.att = -1;
  return true;
}

export function enemyDivsIn(G, tag, st) {
  const out = [];
  for (const id of G.divsAt[st] || []) { const E = G.divs[id]; if (E && E.tag !== tag && atWar(G, tag, E.tag) && !E.retreat) out.push(E); }
  return out;
}

// 위치 색인 재구성 (매 시간)
export function rebuildDivIndex(G) {
  const at = {};
  for (const id in G.divs) { const D = G.divs[id]; (at[D.loc] ||= []).push(D.id); }
  G.divsAt = at;
}

// 점령 처리
export function captureState(G, st, byTag) {
  const S = G.st[st];
  const prevCtrl = S.ctrl;
  let newCtrl = byTag;
  // 아군 소유 영토(또는 아군 핵심)는 원 소유국에 반환
  if (S.owner !== byTag && allied(G, byTag, S.owner) && G.countries[S.owner]?.alive && !G.countries[S.owner].capitulated) newCtrl = S.owner;
  else {
    for (const c of S.cores) { if (c !== byTag && allied(G, byTag, c) && G.countries[c]?.alive && !G.countries[c].capitulated) { newCtrl = c; break; } }
  }
  if (prevCtrl === newCtrl) return;
  S.ctrl = newCtrl;
  S.ctrlSince = G.hour;
  // 남아 있던 적 사단 유린(퇴각 중이거나 조직력 0)
  for (const id of [...(G.divsAt[st] || [])]) {
    const E = G.divs[id];
    if (E && atWar(G, newCtrl, E.tag)) {
      if (E.retreat || E.org <= 0.5) { destroyDivision(G, E, 'overrun'); news(G, `${E.name}(${G.countries[E.tag].name})이(가) ${G.map.name[st]}에서 유린당해 궤멸했습니다.`, { tags: [E.tag, newCtrl], kind: 'mil' }); }
      else retreatDivision(G, E);
    }
  }
  G.mapDirty = true;
  if (G.onCapture) G.onCapture(st, prevCtrl, newCtrl);
}

// 퇴각: 적이 없는 인접 아군 주로. 없으면 궤멸
export function retreatDivision(G, D) {
  const map = G.map;
  let best = -1, bestScore = -Infinity;
  for (const v of map.nb[D.loc]) {
    if (!friendlyCtrl(G, D.tag, v)) continue;
    if (enemyDivsIn(G, D.tag, v).length) continue;
    const underAtk = G.battles[v] ? 1 : 0;
    const score = (G.supplyOf?.[D.tag]?.[v] ?? 0.5) * 2 - underAtk * 2 + Math.random() * 0.1;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  if (best < 0) {
    news(G, `${D.name}(${G.countries[D.tag].name})이(가) 포위되어 궤멸했습니다.`, { tags: [D.tag], kind: 'mil', st: D.loc });
    destroyDivision(G, D, 'encircled');
    return false;
  }
  D.path = [best]; D.prog = 0; D.att = -1; D.retreat = true; D.ent = 0; D.plan = 0;
  return true;
}

// ───────── 매 시간: 이동·조직력 회복·참호·계획 ─────────
export function hourlyDivisions(G) {
  const map = G.map;
  for (const id in G.divs) {
    const D = G.divs[id];
    if (D.sea) continue;
    const C = G.countries[D.tag];
    const st = divStats(G, D);
    const inBattle = D.att >= 0 || (G.battles[D.loc] && G.battles[D.loc].defIds?.includes(D.id));
    const maxOrg = st.org * (1 + M(C, 'land.org')) * (D.sup < 0.25 ? 0.35 + D.sup : 1);
    // 이동
    if (D.path.length && D.att < 0) {
      const next = D.path[0];
      const nctrl = G.st[next].ctrl;
      const hostile = atWar(G, D.tag, nctrl);
      if (hostile && !D.retreat) {
        const enemies = enemyDivsIn(G, D.tag, next);
        if (enemies.length) { D.att = next; D.prog = 0; continue; }
      }
      if (!hostile && !friendlyCtrl(G, D.tag, next) && !C.access?.includes(nctrl)) { D.path = []; D.prog = 0; continue; }
      const L = D.amphib === next ? 30 : moveCost(G, D.loc, next);
      const spd = divSpeed(G, D, st) * (D.won ? 1.5 : 1);
      D.prog += spd;
      D.ent = 0;
      if (st.fuel > 0 && C.fuel > 0) C.fuel -= st.fuel * D.str * 0.5;
      if (D.prog >= L) {
        // 도착 직전 적이 들어왔으면 공격으로 전환
        if (hostile && enemyDivsIn(G, D.tag, next).length && !D.retreat) { D.att = next; D.prog = 0; continue; }
        const from = D.loc;
        D.loc = next; D.path.shift(); D.prog = 0; D.won = false; D.amphib = -1;
        moveIndex(G, D, from);
        if (D.retreat) D.retreat = false;
        if (hostile) captureState(G, next, D.tag);
      }
      if (!D.retreat) D.org = Math.min(maxOrg, D.org + 0.1);
      D.plan = Math.max(0, D.plan - 0.01);
      continue;
    }
    if (inBattle) { D.ent = D.att >= 0 ? 0 : D.ent; continue; }
    // 정지: 회복
    if (D.retreat) { D.retreat = false; }
    const rec = (0.25 + st.org * 0.004) * (1 + M(C, 'land.recovery')) * Math.max(0.2, D.sup);
    D.org = Math.min(maxOrg, D.org + rec);
    if (D.org > maxOrg) D.org = maxOrg;
    const maxEnt = 5 + (st.mods.entrench || 0) + M(C, 'land.entrench') * 5;
    D.ent = Math.min(maxEnt, D.ent + 1 / 24);
    if (D.army && G.armies[D.army]?.order === 'attack') {
      const maxPlan = 0.3 + M(C, 'land.planning');
      D.plan = Math.min(maxPlan, D.plan + 0.3 / (10 * 24));
    }
    // 보급 부족 소모
    if (D.sup < 0.2) D.str = Math.max(0.05, D.str - 0.0004 * (1 - D.sup));
    // 사막·산악 등 지형 소모
    const attr = TERRAIN[map.terrain[D.loc]]?.attr || 0;
    if (attr && D.sup < 0.6) D.str = Math.max(0.05, D.str - 0.0001 * attr);
  }
}

function moveIndex(G, D, from) {
  const a = G.divsAt[from]; if (a) { const i = a.indexOf(D.id); if (i >= 0) a.splice(i, 1); }
  (G.divsAt[D.loc] ||= []).push(D.id);
}

// ───────── 매일: 보충·인력 정산·훈련 ─────────
export function dailyMilitary(G, C) {
  const tag = C.tag;
  const divs = [];
  for (const id in G.divs) { const D = G.divs[id]; if (D.tag === tag) divs.push(D); }
  // 인력 정산
  let inDivs = 0;
  for (const D of divs) inDivs += divStats(G, D).mp * D.str;
  C.mp.inDivs = inDivs;
  // 보충: 약한 사단부터
  divs.sort((a, b) => a.str - b.str);
  const rate = 0.05 * (1 + M(C, 'land.reinforce'));
  for (const D of divs) {
    if (D.str >= 0.999 || D.retreat || D.sup < 0.15) continue;
    const st = divStats(G, D);
    const frac = Math.min(rate * Math.min(1, D.sup + 0.2) * (1 + (st.mods.reinforce || 0)), 1 - D.str);
    let ratio = 1;
    const avail = manpowerAvailable(C);
    if (st.mp * frac > avail) ratio = Math.min(ratio, avail / (st.mp * frac));
    for (const e in st.eq) { const need = st.eq[e] * frac; if (need > 0) ratio = Math.min(ratio, (C.stock[e] || 0) / need); }
    if (ratio <= 0.001) continue;
    ratio = Math.min(1, ratio);
    for (const e in st.eq) C.stock[e] = Math.max(0, (C.stock[e] || 0) - st.eq[e] * frac * ratio);
    C.mp.inDivs += st.mp * frac * ratio;
    D.str = Math.min(1, D.str + frac * ratio);
  }
  // 훈련
  const speed = 1 / (1 + M(C, 'training'));
  for (let i = 0; i < C.training.length; i++) {
    const T = C.training[i];
    const tpl = getTpl(C, T.tpl);
    if (!tpl) { C.training.splice(i--, 1); continue; }
    const st = tplStats(C, tpl);
    if (!T.started) {
      if (manpowerAvailable(C) < st.mp) continue;
      T.started = true; T.mp = st.mp; C.mp.training += st.mp;
    }
    T.prog += speed;
    if (T.prog >= st.train) {
      // 장비 확인: 최소 40%
      let ratio = 1;
      for (const e in st.eq) ratio = Math.min(ratio, (C.stock[e] || 0) / st.eq[e]);
      if (ratio < 0.4 && !T.force) { T.wait = true; continue; }
      ratio = Math.min(1, ratio);
      for (const e in st.eq) C.stock[e] = Math.max(0, (C.stock[e] || 0) - st.eq[e] * ratio);
      let loc = T.loc;
      if (loc == null || G.st[loc].ctrl !== tag) loc = C.capital >= 0 && G.st[C.capital].ctrl === tag ? C.capital : firstControlled(G, tag);
      if (loc < 0) continue;
      C.mp.training -= T.mp;
      let army = T.army && G.armies[T.army] ? T.army : 0;
      if (!army && !C.isAI) { // 플레이어: 가장 작은 군에 편입
        let best = null; for (const id in G.armies) { const A = G.armies[id]; if (A.tag === tag && (!best || A.divs.length < best.divs.length)) best = A; }
        if (best) army = best.id;
      }
      const D = createDivision(G, tag, T.tpl, loc, { str: ratio, xp: 0.1, army });
      (G.divsAt[loc] ||= []).push(D.id);
      if (army) G.armies[army].divs.push(D.id);
      C.mp.inDivs += st.mp * ratio;
      C.training.splice(i--, 1);
      if (G.onDivTrained) G.onDivTrained(D);
    }
  }
}

export function firstControlled(G, tag) { for (let i = 0; i < G.st.length; i++) if (G.st[i].ctrl === tag && G.st[i].owner === tag) return i; for (let i = 0; i < G.st.length; i++) if (G.st[i].ctrl === tag) return i; return -1; }

export function manpowerAvailable(C) { return Math.max(0, C.mp.total - C.mp.inDivs - C.mp.training); }

export function divsOf(G, tag) { const out = []; for (const id in G.divs) if (G.divs[id].tag === tag) out.push(G.divs[id]); return out; }

export function divPower(G, D) {
  const st = divStats(G, D);
  return (st.sa + st.ha * 1.2 + st.def * 0.25 + st.brk * 0.3) * D.str * (0.3 + 0.7 * (st.org > 0 ? D.org / st.org : 1));
}

// ───────── 군(플레이어 지휘 단위) ─────────
export function createArmy(G, tag, name) {
  const C = G.countries[tag];
  C.armyNum = (C.armyNum || 0) + 1;
  const id = G.nextId++;
  const A = { id, tag, name: name || `제${C.armyNum}군`, divs: [], auto: true, order: 'hold', front: [], enemy: null, gen: null, player: true };
  G.armies[id] = A;
  return A;
}
export function assignArmy(G, D, armyId) {
  if (D.army && G.armies[D.army]) { const A = G.armies[D.army]; A.divs = A.divs.filter((x) => x !== D.id); }
  D.army = armyId || 0;
  const A = armyId && G.armies[armyId];
  if (A && !A.divs.includes(D.id)) A.divs.push(D.id);
}
export function deleteArmy(G, id) {
  const A = G.armies[id]; if (!A) return;
  for (const did of A.divs) { const D = G.divs[did]; if (D && D.army === id) D.army = 0; }
  delete G.armies[id];
}
export function armiesOf(G, tag) { return Object.values(G.armies).filter((A) => A.tag === tag); }
// 시작 시 사단을 지역별로 묶어 군 편성 (경도 순으로 최대 per개씩)
export function setupArmies(G, tag, per = 24) {
  const map = G.map, C = G.countries[tag];
  for (const A of armiesOf(G, tag)) deleteArmy(G, A.id);
  C.armyNum = 0;
  const divs = divsOf(G, tag).sort((a, b) => (map.lon[a.loc] - map.lon[b.loc]) || (map.lat[b.loc] - map.lat[a.loc]));
  const groups = Math.max(1, Math.ceil(divs.length / per));
  const size = Math.ceil(divs.length / groups);
  const gens = (C.generals || []).slice().sort((a, b) => b.skill - a.skill);
  for (let g = 0; g < groups; g++) {
    const A = createArmy(G, tag);
    if (gens[g]) A.gen = gens[g].id;
    for (const D of divs.slice(g * size, (g + 1) * size)) assignArmy(G, D, A.id);
  }
}
// 사단 해산: 인력과 장비 일부 반환
export function disbandDivision(G, D) {
  const C = G.countries[D.tag];
  const st = divStats(G, D);
  for (const e in st.eq) C.stock[e] = (C.stock[e] || 0) + st.eq[e] * D.str * 0.8;
  C.mp.inDivs = Math.max(0, C.mp.inDivs - st.mp * D.str);
  if (D.army && G.armies[D.army]) { const A = G.armies[D.army]; A.divs = A.divs.filter((x) => x !== D.id); }
  delete G.divs[D.id];
  const a = G.divsAt?.[D.loc]; if (a) { const i = a.indexOf(D.id); if (i >= 0) a.splice(i, 1); }
}
// 편제 변경 (장비가 부족하면 전력이 떨어진 채로 보충됨)
export function changeTemplate(G, D, tplId) {
  const C = G.countries[D.tag];
  const old = divStats(G, D);
  const tpl = getTpl(C, tplId); if (!tpl) return false;
  for (const e in old.eq) C.stock[e] = (C.stock[e] || 0) + old.eq[e] * D.str;
  D.tpl = tplId;
  const st = tplStats(C, tpl);
  let ratio = 1;
  for (const e in st.eq) ratio = Math.min(ratio, (C.stock[e] || 0) / st.eq[e]);
  ratio = Math.max(0.1, Math.min(1, ratio));
  for (const e in st.eq) C.stock[e] = Math.max(0, (C.stock[e] || 0) - st.eq[e] * ratio);
  D.str = ratio; D.org = Math.min(D.org, st.org * 0.5);
  return true;
}

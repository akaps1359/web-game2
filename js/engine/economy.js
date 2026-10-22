// 경제: 공장·자원·무역·소비재·건설·생산·연료·인력
import { EQUIPMENT, SHIPS, RES_KEYS, RES_SCALE, SHIP_UNLOCK } from '../data/units.js';
import { LAW_GROUPS } from '../data/ideas.js';
import { M } from './mods.js';
import { atWar, allied, news } from './world.js';
import { eqLevel, eqCost } from './military.js';
import { addShip } from './naval.js';

export const BUILDINGS = {
  civ: { name: '민간 공장', cost: 10800, slot: true, icon: 'civ' },
  mil: { name: '군수 공장', cost: 7200, slot: true, icon: 'mil' },
  dock: { name: '조선소', cost: 6400, slot: true, coastal: true, icon: 'dock' },
  ref: { name: '합성 정유소', cost: 14500, slot: true, need: 'refinery', icon: 'ref', max: 3 },
  infra: { name: '기반 시설', cost: 6000, max: 5, icon: 'infra' },
  fort: { name: '요새', cost: 500, max: 10, icon: 'fort', step: 500 },
  aa: { name: '대공포 진지', cost: 2500, max: 5, icon: 'aa' },
  air: { name: '공군 기지', cost: 1250, max: 10, icon: 'air' },
  port: { name: '해군 기지', cost: 5000, max: 10, coastal: true, icon: 'port', step: 1000 },
};
export const CAT_SLOTS = { mega: 12, metro: 10, large_city: 8, city: 6, large_town: 5, town: 4, rural: 2, pastoral: 1, waste: 0 };

export function buildCost(G, C, type, st) {
  const B = BUILDINGS[type];
  let c = B.cost;
  if (B.step) { const lv = type === 'fort' ? G.st[st].fort || 0 : G.st[st].port || 0; c += B.step * lv; }
  if (type === 'mil') c *= 1 + M(C, 'milfac.cost');
  if (type === 'civ') c *= 1 + M(C, 'civfac.cost');
  return Math.round(c);
}

export function stateSlots(G, C, st) {
  const S = G.st[st];
  return Math.floor((CAT_SLOTS[S.cat] ?? 2) * (1 + (C ? M(C, 'slots') : 0)));
}
export function stateUsedSlots(S) { return (S.civ || 0) + (S.mil || 0) + (S.dock || 0) + (S.ref || 0); }

// 건설 가능 여부 → null 이면 가능, 아니면 사유 문자열
export function canBuild(G, C, type, st) {
  const S = G.st[st];
  const B = BUILDINGS[type];
  if (!B) return '알 수 없는 건물';
  if (S.owner !== C.tag || S.ctrl !== C.tag) return '자국이 통제하는 주가 아닙니다';
  if (G.map.virtual[st] && type !== 'civ' && type !== 'mil' && type !== 'dock') return '불가';
  if (B.need && !C.unlock[B.need]) return '기술 필요';
  if (B.coastal && !G.map.coastal[st]) return '해안 주가 아닙니다';
  const queued = C.cons.filter((q) => q.st === st);
  if (B.slot) {
    const used = stateUsedSlots(S) + queued.filter((q) => BUILDINGS[q.type].slot).length;
    if (used >= stateSlots(G, C, st)) return '건설 슬롯 부족';
    if (B.max && (S[type] || 0) + queued.filter((q) => q.type === type).length >= B.max) return '최대 수준';
  } else {
    const lv = (S[type] || 0) + queued.filter((q) => q.type === type).length;
    if (lv >= B.max) return '최대 수준';
  }
  if (S.demil && (type === 'fort' || type === 'mil')) return '비무장 지대';
  return null;
}

// 상태별 공장 반영률
function facShare(S, tag) {
  if (S.ctrl !== tag) return 0;
  // 핵심 영토 100%, 병합한 비핵심 영토 35%, 점령지 15% (저항과 낮은 순응도)
  if (S.owner === tag) return (S.cores.includes(tag) ? 1 : 0.35) * (1 - (S.dmg || 0));
  return 0.15 * (1 - (S.dmg || 0));
}
function resShare(S, tag) {
  if (S.ctrl !== tag) return 0;
  if (S.owner === tag) return S.cores.includes(tag) ? 1 : 0.8;
  return 0.5;
}

// 1단계: 공장·자원 집계 (매일)
export function tallyEconomy(G, C) {
  const tag = C.tag;
  let civ = 0, mil = 0, dock = 0, ref = 0;
  const res = Object.fromEntries(RES_KEYS.map((r) => [r, 0]));
  for (const i of G.ownCtrl?.[tag] || []) {
    const S = G.st[i];
    const f = facShare(S, tag);
    civ += (S.civ || 0) * f; mil += (S.mil || 0) * f; dock += (S.dock || 0) * f; ref += (S.ref || 0) * f;
    const rf = resShare(S, tag);
    if (S.res) for (const r in S.res) res[r] += S.res[r] * RES_SCALE * rf;
  }
  const off = C.offmap;
  if (off) {
    civ += off.civ || 0; mil += off.mil || 0; dock += off.dock || 0;
    for (const r in off.res || {}) res[r] += off.res[r];
  }
  const rmod = 1 + M(C, 'resources');
  for (const r of RES_KEYS) res[r] *= rmod;
  res.rub += ref * 4; res.oil += ref * 2;
  C.eco.civ = civ; C.eco.mil = mil; C.eco.dock = dock; C.eco.ref = ref;
  C.eco.res = res;
  // 소비재
  const law = LAW_GROUPS.economy.laws[C.laws.economy];
  const stabCg = C.stability > 0.5 ? -(C.stability - 0.5) * 0.4 : 0;
  const cgFrac = Math.max(0.05, (law?.cg ?? 0.35) * (1 + stabCg) + M(C, 'consumerGoods'));
  C.eco.cg = Math.max(1, Math.round((civ + mil) * cgFrac));
  C.eco.cgFrac = cgFrac;
  // 자원 수요 (생산 라인)
  const need = Object.fromEntries(RES_KEYS.map((r) => [r, 0]));
  const totalAssigned = C.lines.reduce((s, l) => s + l.fac, 0);
  const milScale = totalAssigned > 0 ? Math.min(1, mil / totalAssigned) : 1;
  for (const L of C.lines) {
    const E = EQUIPMENT[L.eq]; if (!E) continue;
    for (const r in E.res) need[r] += E.res[r] * L.fac * milScale;
  }
  const dockAssigned = C.shipLines.reduce((s, l) => s + l.docks, 0);
  const dockScale = dockAssigned > 0 ? Math.min(1, dock / dockAssigned) : 1;
  for (const L of C.shipLines) { const Sh = SHIPS[L.ship]; for (const r in Sh.res) need[r] += (Sh.res[r] * L.docks * dockScale) / 2; }
  C.eco.need = need; C.eco.milScale = milScale; C.eco.dockScale = dockScale;
  // 연료 비축이 부족하면 석유 수입 희망
  C.eco.oilWant = (C.fuel || 0) < (C.fuelCap || 40000) * 0.6 ? Math.max(0, (C.major ? 40 : 10) - Math.max(0, res.oil - need.oil)) : 0;
  // 수출 가능량
  const exp = LAW_GROUPS.trade.laws[C.laws.trade]?.exp ?? 0.5;
  C.eco.offer = Object.fromEntries(RES_KEYS.map((r) => [r, Math.max(0, Math.floor((res[r] - need[r] * 0.0) * exp))]));
}

// 2단계: 국제 무역 시장
export function runMarket(G) {
  const tags = Object.keys(G.countries).filter((t) => G.countries[t].alive && !G.countries[t].capitulated);
  // 판매자 잔량
  const left = {};
  for (const t of tags) { const C = G.countries[t]; left[t] = { ...C.eco.offer }; C.eco.sold = Object.fromEntries(RES_KEYS.map((r) => [r, 0])); C.eco.imports = Object.fromEntries(RES_KEYS.map((r) => [r, 0])); C.eco.tradeCiv = 0; C.eco.importCiv = 0; C.eco.worldCiv = 0; }
  // 구매: 큰 나라부터
  const buyers = tags.slice().sort((a, b) => (G.countries[b].eco.civ + G.countries[b].eco.mil) - (G.countries[a].eco.civ + G.countries[a].eco.mil));
  for (const t of buyers) {
    const C = G.countries[t];
    if (C.autoTrade === false && !C.tradeOrders) continue;
    const reach = tradeReach(G, t);
    const freeCiv = Math.max(0, C.eco.civ - C.eco.cg) * 0.5; // 최대 절반을 무역에 사용
    let civBudget = freeCiv;
    for (const r of RES_KEYS) {
      const own = C.eco.res[r];
      let want = Math.ceil(Math.max(0, C.eco.need[r] - own) + (r === 'oil' ? Math.max(0, C.eco.oilWant || 0) : 0));
      if (C.tradeOrders && C.tradeOrders[r] != null) want = C.tradeOrders[r];
      if (want <= 0) continue;
      // 판매자 순회
      const sellers = reach.countries.filter((s) => s !== t && left[s] && left[s][r] > 0).sort((a, b) => left[b][r] - left[a][r]);
      for (const s of sellers) {
        if (want <= 0 || civBudget < 0.125) break;
        const amt = Math.min(want, left[s][r], Math.floor(civBudget * 8));
        if (amt <= 0) continue;
        left[s][r] -= amt; want -= amt; civBudget -= amt / 8;
        C.eco.imports[r] += amt; C.eco.importCiv += amt / 8;
        G.countries[s].eco.sold[r] += amt; G.countries[s].eco.tradeCiv += amt / 8;
      }
      // 세계 시장(지도 밖)
      if (want > 0 && reach.world && civBudget >= 1 / 6) {
        const amt = Math.min(want, Math.floor(civBudget * 6));
        C.eco.imports[r] += amt; civBudget -= amt / 6; C.eco.importCiv += amt / 6; C.eco.worldCiv += amt / 6;
      }
    }
  }
}

const WORLD_SEAS = ['natl', 'wapp', 'azores', 'iberia', 'canary', 'wafr', 'arabian', 'somali', 'denstr'];
export function tradeReach(G, tag) {
  const map = G.map;
  const cache = (G._tradeCache ||= {});
  const key = tag + ':' + Math.floor(G.hour / (24 * 7)) + ':' + G.wars.length;
  if (cache[tag]?.key === key) return cache[tag].v;
  const v = tradeReachCalc(G, tag);
  cache[tag] = { key, v };
  return v;
}
function tradeReachCalc(G, tag) {
  const map = G.map;
  const out = new Set();
  const peace = !G.warRel[tag] || !Object.keys(G.warRel[tag]).length;
  const hasPort = (G.ctrlBy?.[tag] || []).some((i) => G.st[i].port > 0);
  if (peace && hasPort) {
    for (const t in G.countries) if (G.countries[t].alive && !atWar(G, tag, t)) out.add(t);
    return { countries: [...out], world: true };
  }
  // 육로: 적이 통제하지 않는 주를 통한 연결
  const seen = new Uint8Array(map.n);
  const q = [];
  for (const i of G.ctrlBy?.[tag] || []) { seen[i] = 1; q.push(i); }
  let qi = 0;
  while (qi < q.length) {
    const u = q[qi++];
    out.add(G.st[u].ctrl);
    for (const v of map.nb[u]) { if (seen[v]) continue; const c = G.st[v].ctrl; if (atWar(G, tag, c)) continue; seen[v] = 1; q.push(v); }
  }
  // 해로
  const reach = G.seaReach?.[tag];
  let world = false;
  if (reach) {
    for (const z of reach) {
      if (WORLD_SEAS.includes(map.seas[z].key)) world = true;
      for (const st of map.seas[z].coast) { const c = G.st[st].ctrl; if (G.st[st].port > 0 && !atWar(G, tag, c)) out.add(c); }
    }
  }
  return { countries: [...out], world };
}

// 3단계: 건설·생산·연료·인력
export function runEconomy(G, C) {
  const tag = C.tag;
  const eco = C.eco;
  // 가용 자원
  const avail = {};
  for (const r of RES_KEYS) avail[r] = eco.res[r] - (eco.sold?.[r] || 0) + (eco.imports?.[r] || 0);
  eco.avail = avail;
  // 안정도 보정
  const stab = C.stability;
  const stabOut = stab >= 0.5 ? (stab - 0.5) * 0.4 : (stab - 0.5) * 1.0;
  // 민간 공장 → 건설
  const civFree = Math.max(0, eco.civ + (eco.tradeCiv || 0) - eco.cg - (eco.importCiv || 0));
  eco.civFree = civFree;
  let civLeft = civFree;
  const tradeLawMods = 0;
  const conMult = (1 + M(C, 'construction') + tradeLawMods) * (1 + stabOut * 0.5);
  for (let qi = 0; qi < C.cons.length && civLeft > 0; qi++) {
    const P = C.cons[qi];
    const S = G.st[P.st];
    if (S.ctrl !== tag || S.owner !== tag) { C.cons.splice(qi--, 1); continue; }
    const use = Math.min(15, civLeft);
    civLeft -= use;
    P.civ = use;
    P.acc += use * 5 * conMult * (1 + 0.1 * Math.min(5, S.infra || 1));
    const cost = buildCost(G, C, P.type, P.st);
    if (P.acc >= cost) {
      S[P.type] = (S[P.type] || 0) + 1;
      if (P.type === 'fort') S.fort = Math.min(10, S.fort);
      C.cons.splice(qi--, 1);
      if (G.onBuilt) G.onBuilt(C, P);
      if (P.repeat > 1) { C.cons.splice(qi + 1, 0, { id: G.nextId++, type: P.type, st: P.st, acc: 0, repeat: P.repeat - 1 }); }
    }
  }
  for (const P of C.cons) if (P.civ && civLeft >= 0 && P.acc === 0) P.civ = 0;
  // 군수 생산
  const outMult = (1 + M(C, 'factoryOutput')) * (1 + stabOut) * (1 + lawTradeOutput(C));
  const cap = 50 + M(C, 'prodEffCap') * 100;
  const gain = 1 + M(C, 'prodEffGain');
  eco.milOut = 0;
  for (const L of C.lines) {
    const E = EQUIPMENT[L.eq];
    if (!E || (eqLevel(C, L.eq) < 1 && L.eq !== 'inf_eq')) continue;
    const fac = L.fac * eco.milScale;
    // 자원 충족률
    let rf = 1;
    for (const r in E.res) { const needR = eco.need[r]; if (needR > 0 && avail[r] < needR) rf = Math.min(rf, Math.max(0, avail[r]) / needR); }
    const resF = 0.3 + 0.7 * rf;
    // 효율
    L.eff = L.eff ?? 10;
    if (fac > 0) L.eff = Math.min(cap, L.eff + (gain * (cap / 100) ** 2) / (0.1 * Math.max(1, L.eff)));
    const ic = fac * 4.5 * (L.eff / 100) * outMult * resF;
    eco.milOut += ic;
    L.acc = (L.acc || 0) + ic;
    const unit = eqCost(C, L.eq);
    if (L.acc >= unit) { const nUnits = Math.floor(L.acc / unit); L.acc -= nUnits * unit; C.stock[L.eq] = (C.stock[L.eq] || 0) + nUnits; C.stats.produced = (C.stats.produced || 0) + nUnits * unit; }
    L.rf = rf;
  }
  // 조선
  const dockMult = (1 + M(C, 'dockOutput') + M(C, 'factoryOutput') * 0.5) * (1 + stabOut);
  for (const L of C.shipLines) {
    const Sh = SHIPS[L.ship];
    if (!C.unlock[L.ship]) continue;
    const docks = L.docks * eco.dockScale;
    let rf = 1; for (const r in Sh.res) { const needR = eco.need[r]; if (needR > 0 && avail[r] < needR) rf = Math.min(rf, Math.max(0, avail[r]) / needR); }
    L.prog = (L.prog || 0) + docks * 2.5 * dockMult * (0.3 + 0.7 * rf);
    if (L.prog >= Sh.ic) {
      L.prog -= Sh.ic;
      addShip(G, C, L.ship);
      if (G.onShipBuilt) G.onShipBuilt(C, L.ship);
      if (L.count != null) { L.count--; if (L.count <= 0) { C.shipLines = C.shipLines.filter((x) => x !== L); } }
    }
  }
  // 연료
  const fuelGain = (Math.max(0, avail.oil) * 100 + (eco.ref || 0) * 400) * (1 + M(C, 'fuelGain'));
  C.fuelCap = Math.round((40000 + Math.max(0, eco.res.oil) * 400) * (1 + M(C, 'fuelCap')));
  C.fuel = Math.min(C.fuelCap, (C.fuel || 0) + fuelGain);
  eco.fuelGain = fuelGain;
  // 인력
  const pct = LAW_GROUPS.conscription.laws[C.laws.conscription]?.mp ?? 0.015;
  const mpMod = 1 + M(C, 'manpower');
  let total = 0;
  for (const i of G.ownCtrl?.[tag] || []) {
    const S = G.st[i];
    if (S.owner !== tag || S.ctrl !== tag) continue;
    total += S.pop * 1000 * pct * mpMod * (S.cores.includes(tag) ? 1 : 0.15);
  }
  if (C.offmap) total += (C.offmap.pop || 0) * 1e6 * (C.offmap.mpFactor || 0) * pct * mpMod;
  C.mp.total = Math.max(0, total - C.mp.dead);
}

function lawTradeOutput(C) {
  const t = C.laws.trade;
  return t === 'free' ? 0.15 : t === 'export' ? 0.1 : t === 'limited' ? 0.05 : 0;
}

export function queueBuild(G, C, type, st, repeat = 1) {
  const why = canBuild(G, C, type, st);
  if (why) return why;
  C.cons.push({ id: G.nextId++, type, st, acc: 0, repeat });
  return null;
}

export function setLine(G, C, eq, fac) {
  let L = C.lines.find((l) => l.eq === eq);
  if (!L) { if (fac <= 0) return; L = { id: G.nextId++, eq, fac: 0, eff: 10, acc: 0 }; C.lines.push(L); }
  L.fac = Math.max(0, Math.round(fac));
  if (L.fac === 0 && !L.keep) C.lines = C.lines.filter((x) => x !== L);
}

export function shipUnlocked(C, ship) { return !!C.unlock[ship] || !!C.techs[SHIP_UNLOCK[ship]]; }

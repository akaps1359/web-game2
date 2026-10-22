// 게임 생성·시간 진행·저장/불러오기
import { COUNTRIES, COLONY_POP, FACTIONS0, WARS0, FACTION_DEFS } from '../data/countries.js';
import { DEFAULT_TEMPLATES, SHIP_KEYS } from '../data/units.js';
import { TECH_SETS, TECH } from '../data/techs.js';
import { FOCUS_TREES } from '../data/focus.js';
import { EVENTS, CAPITULATIONS } from '../data/events.js';
import { makeRng } from './rng.js';
import { refreshMods } from './mods.js';
import { rebuildWarCache, news, atWar, allied, fmtDate } from './world.js';
import { grantTech, dailyResearch } from './research.js';
import { createDivision, tplAvailable, tplStats, hourlyDivisions, dailyMilitary, rebuildDivIndex } from './military.js';
import { hourlyCombat } from './combat.js';
import { computeSupply, assignDivSupply, computeSeaReach } from './supply.js';
import { tallyEconomy, runMarket, runEconomy } from './economy.js';
import { dailyPolitics } from './politics.js';
import { dailyJustify, dailyCapitulation, dailyLiberation, cleanupWars, declareWar } from './diplomacy.js';
import { dailyAir, createWing } from './air.js';
import { dailyNaval, createFleet, addShip, hourlyEmbarked } from './naval.js';
import { applyEffects, checkTrigger } from './effects.js';
import { aiDaily, aiHourly, aiSetup, aiChooseEventOption } from './ai.js';

export const SAVE_VERSION = 1;

const INFRA = { GER: 4, ENG: 4, FRA: 4, BEL: 4, HOL: 4, LUX: 4, SWI: 4, DEN: 4, ITA: 3, AUS: 3, CZE: 3, SWE: 3, HUN: 3, SPR: 3, POR: 3, IRE: 3, EST: 3, LAT: 3, DAN: 4, NOR: 2, FIN: 2, POL: 2, SOV: 2, ROM: 2, YUG: 2, BUL: 2, GRE: 2, ALB: 1, TUR: 2, LIT: 2, ICE: 1, USA: 5 };

export function makeCountry(G, tag, def) {
  const techs = [];
  for (const t of def.techs || []) { if (TECH_SETS[t]) techs.push(...TECH_SETS[t]); else techs.push(t); }
  const C = {
    tag, alive: !def.dynamic, capitulated: false, exiled: false, isAI: true,
    name: def.name, full: def.full, color: def.color, flag: def.flag, ideology: def.ideology, gov: def.gov,
    leader: def.leader, title: def.title, party: def.party, major: !!def.major,
    capital: -1, pp: def.pp ?? 25, baseStab: def.stability ?? 0.5, baseWs: def.warSupport ?? 0.2,
    stability: def.stability ?? 0.5, warSupport: def.warSupport ?? 0.2,
    pop: { dem: 0.25, fas: 0.25, com: 0.25, neu: 0.25, ...(def.pop0 || {}) },
    laws: { conscription: 'volunteer', economy: 'civilian', trade: 'export', ...(def.laws || {}) },
    advisors: { pol: [], army: null, navy: null, air: null }, advisorNames: def.advisors || {},
    spirits: (def.spirits || []).map((id) => ({ id })),
    focus: { tree: FOCUS_TREES[tag] ? tag : 'generic', cur: null, prog: 0, done: {} },
    research: { slots: def.rslots ?? 2, cur: [], saved: {} }, techs: {}, eq: {}, unlock: {}, techVer: 1, rBonus: [],
    lines: [], shipLines: [], cons: [], stock: {}, fuel: 0, fuelCap: 30000,
    mp: { total: 0, inDivs: 0, training: 0, dead: 0 },
    templates: [], training: [],
    faction: null, master: null, guarantees: [], naps: {}, access: [], justify: [], wargoals: [],
    surrender: 0, offmap: def.offmap ? { ...def.offmap } : null, offmapVP: def.offmapVP || 0,
    generals: (def.generals || []).map(([name, skill, type]) => ({ id: G.nextId++, name, skill, type: type || 'gen' })),
    eco: { civ: 0, mil: 0, dock: 0, res: {}, need: {}, offer: {} }, stats: {}, flags: {}, decCd: {}, extraMods: {},
    aiState: {}, autoTrade: true, navalBase: -1, tensionCaused: 0,
  };
  for (const id of techs) grantTech(G, C, id, true);
  C.research.cur = new Array(C.research.slots).fill(null);
  // 기본 편제
  for (const T of DEFAULT_TEMPLATES) {
    const tpl = { id: G.nextId++, key: T.key, name: T.name, bats: { ...T.bats }, sup: [...T.sup] };
    if (tplAvailable(C, tpl)) C.templates.push(tpl);
    else {
      // 지원 중대 제외하고라도 가능하면 사용
      const t2 = { ...tpl, sup: tpl.sup.filter((s) => s === 'eng' || s === 'rec') };
      if (tplAvailable(C, t2)) C.templates.push(t2);
    }
  }
  refreshMods(C);
  return C;
}

function stateCategory(p, vp, virtual) {
  if (virtual) return 'mega';
  if (p.cat) return p.cat;
  const ind = p.ind ?? 0.5;
  if (ind >= 5 || vp >= 30) return 'metro';
  if (ind >= 3 || vp >= 15) return 'large_city';
  if (ind >= 1.5) return 'city';
  if (ind >= 0.8) return 'large_town';
  if (ind >= 0.3) return 'town';
  if (p.t === 'desert' && ind < 0.1) return 'pastoral';
  return 'rural';
}

// 최대 나머지 방식 분배
function distribute(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < order.length && left > 0; k++, left--) out[order[k][1]]++;
  return out;
}

export function createGame(map, opts = {}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const G = {
    ver: SAVE_VERSION, seed, hour: 0, player: opts.player || 'GER', speed: 0,
    countries: {}, st: [], divs: {}, armies: {}, wings: {}, fleets: {}, battles: {}, wars: [], factions: {},
    tension: 0.06, flags: {}, news: [], nextId: 1, events: { fired: {}, scheduled: [] }, pending: [],
    stats: { start: Date.now() }, difficulty: opts.difficulty || 'normal',
  };
  attachRuntime(G, map, seed);
  // 국가
  for (const tag in COUNTRIES) G.countries[tag] = makeCountry(G, tag, COUNTRIES[tag]);
  // 주
  const n = map.n;
  for (let i = 0; i < n; i++) {
    const [key, , owner, , , p0] = map.def[i];
    const p = p0 || {};
    const vp = p.vp ?? 1;
    const cores = p.col ? [...(p.cores || [])] : [owner, ...(p.cores || [])];
    let infra = INFRA[owner] ?? 1;
    if (p.col) infra = map.terrain[i] === 'desert' ? 1 : 2;
    if (vp >= 10) infra = Math.min(5, infra + 1);
    if (map.terrain[i] === 'desert' && !p.col) infra = Math.max(1, infra - 1);
    G.st.push({
      owner, ctrl: p.ctl || owner, cores, claims: [...(p.claims || [])], vp,
      civ: 0, mil: 0, dock: 0, ref: 0, infra, fort: p.fort || 0, aa: 0, air: 0,
      port: p.port ?? 0, res: p.res ? { ...p.res } : null, cat: stateCategory(p, vp, map.virtual[i]), demil: p.demil || 0,
      pop: 0, dmg: 0, ctrlSince: 0,
    });
  }
  // 수도
  for (const tag in COUNTRIES) {
    const def = COUNTRIES[tag]; const C = G.countries[tag];
    const cap = def.capital ? map.idx[def.capital] : tag === 'USA' ? map.idx.usa : -1;
    C.capital = cap ?? -1;
    if (C.capital >= 0) { G.st[C.capital].air = Math.max(G.st[C.capital].air, 5); G.st[C.capital].aa = Math.max(G.st[C.capital].aa, 1); }
    if (def.port) { const pi = map.idx[def.port]; if (pi != null) C.navalBase = pi; }
  }
  // 공장·인구 분배
  for (const tag in COUNTRIES) {
    const def = COUNTRIES[tag]; if (def.dynamic) continue;
    const home = [], cols = [];
    for (let i = 0; i < n; i++) { const S = G.st[i]; if (S.owner !== tag || map.virtual[i]) continue; (map.props[i].col ? cols : home).push(i); }
    const fac = def.fac || [0, 0, 0];
    const wInd = home.map((i) => map.props[i].ind ?? 0.5);
    const civ = distribute(fac[0], wInd), mil = distribute(fac[1], wInd.map((w, k) => w * (map.props[home[k]].ind >= 2 ? 1.3 : 1)));
    const dockW = home.map((i, k) => ((G.st[i].port || 0) >= 2 ? wInd[k] * G.st[i].port : 0));
    const dock = distribute(fac[2], dockW);
    home.forEach((i, k) => { G.st[i].civ = civ[k]; G.st[i].mil = mil[k]; G.st[i].dock = dock[k]; });
    // 인구 (천 명)
    const popK = (def.pop || 0) * 1000;
    const areaSum = home.reduce((s, i) => s + map.area[i], 0) || 1;
    const upSum = home.reduce((s, i) => s + map.upop[i], 0);
    const w = home.map((i) => 0.4 * (map.area[i] / areaSum) + (upSum > 0 ? 0.6 * (map.upop[i] / upSum) : 0.6 * (map.area[i] / areaSum)));
    const ws = w.reduce((a, b) => a + b, 0) || 1;
    home.forEach((i, k) => { G.st[i].pop = Math.round((popK * w[k]) / ws); });
    for (const i of cols) { const k = map.key[i]; G.st[i].pop = Math.round((COLONY_POP[k] ?? Math.min(2, 0.05 + map.area[i] / 400000)) * 1000); }
  }
  for (let i = 0; i < n; i++) {
    const S = G.st[i];
    if (S.vp >= 5 && !S.air) S.air = 2;
    if (map.coastal[i] && !S.port && S.vp >= 2) S.port = 1;
  }
  rebuildIndexes(G);
  // 진영·전쟁
  for (const F of FACTIONS0) { G.factions[F.id] = { id: F.id, name: F.name, color: F.color, leader: F.leader, members: [...F.members] }; for (const t of F.members) G.countries[t].faction = F.id; }
  rebuildWarCache(G);
  // 부대 배치
  for (const tag in COUNTRIES) {
    const def = COUNTRIES[tag]; const C = G.countries[tag];
    if (def.dynamic) continue;
    placeOOB(G, C, def);
    // 공군
    const air = def.air || {};
    for (const type of ['fighter', 'cas', 'tac']) {
      let left = air[type] || 0;
      if (!left || !(C.eq[type] >= 1)) continue;
      while (left > 0) { const k = Math.min(100, left); left -= k; if (C.capital >= 0) createWing(G, tag, type, k, C.capital, 'none'); }
    }
    // 해군
    if (def.navy && C.navalBase >= 0) createFleet(G, tag, C.navalBase, def.navy, '본국 함대');
    if (def.navy2) { const b = map.idx[def.navy2.at]; if (b != null) { const ships = { ...def.navy2 }; delete ships.at; createFleet(G, tag, b, ships, '지중해 함대'); } }
    // 비축 장비
    const reserve = C.major ? 0.3 : 0.15;
    const need = {};
    for (const id in G.divs) { const D = G.divs[id]; if (D.tag !== tag) continue; const st = tplStats(C, C.templates.find((t) => t.id === D.tpl)); for (const e in st.eq) need[e] = (need[e] || 0) + st.eq[e]; }
    for (const e in need) C.stock[e] = Math.round(need[e] * reserve);
    C.stock.inf_eq = (C.stock.inf_eq || 0) + (C.major ? 3000 : 600);
    C.fuel = C.major ? 60000 : 15000;
  }
  for (const W of WARS0) { const war = declareWar(G, W.attackers[0], W.defenders[0], { name: W.name, forced: true, silentTension: true }); }
  G.news = [];
  // 초기 계산
  for (const tag in G.countries) { const C = G.countries[tag]; if (C.alive) { tallyEconomy(G, C); runEconomyInit(G, C); } }
  rebuildDivIndex(G);
  computeSeaReach(G); computeSupply(G); assignDivSupply(G);
  for (const tag in G.countries) { const C = G.countries[tag]; C.isAI = tag !== G.player; if (C.alive) aiSetup(G, C); }
  for (const tag in G.countries) { const C = G.countries[tag]; if (C.alive) dailyPolitics(G, C); }
  return G;
}

function runEconomyInit(G, C) {
  // 인력 총량만 계산
  const save = { ...C.eco }, fuel = C.fuel, lines = C.lines.map((l) => ({ ...l })), cons = C.cons.map((p) => ({ ...p })), stock = { ...C.stock };
  runEconomy(G, C);
  C.fuel = fuel; C.lines = lines; C.cons = cons; C.stock = stock;
  Object.assign(C.eco, save);
}

function placeOOB(G, C, def) {
  const map = G.map;
  const tag = C.tag;
  const home = [];
  for (let i = 0; i < map.n; i++) if (G.st[i].owner === tag && !map.props[i].col) home.push(i);
  if (!home.length) for (let i = 0; i < map.n; i++) if (G.st[i].owner === tag) home.push(i);
  // 국경 가중치
  const weight = home.map((i) => {
    let w = 1;
    for (const v of map.nb[i]) { const o = G.st[v].owner; if (o !== tag) w += COUNTRIES[o]?.major ? 4 : 1.5; }
    if (i === C.capital) w += 3;
    return w;
  });
  for (const [tplKey, count, locKey] of def.div || []) {
    const tpl = C.templates.find((t) => t.key === tplKey) || C.templates.find((t) => t.key === 'inf9') || C.templates[0];
    if (!tpl) continue;
    let locs;
    if (locKey) { const li = map.idx[locKey]; locs = new Array(count).fill(li); }
    else {
      const per = distribute(count, weight);
      locs = []; home.forEach((i, k) => { for (let j = 0; j < per[k]; j++) locs.push(i); });
    }
    for (const li of locs) if (li != null && li >= 0) createDivision(G, tag, tpl.id, li, { xp: 0.15, str: 0.95 });
  }
}

export function rebuildIndexes(G) {
  const own = {}, ctrl = {};
  for (let i = 0; i < G.st.length; i++) {
    const S = G.st[i];
    (own[S.owner] ||= []).push(i);
    if (S.ctrl !== S.owner) (own[S.ctrl] ||= []).push(i);
    (ctrl[S.ctrl] ||= []).push(i);
  }
  G.ownCtrl = own; G.ctrlBy = ctrl;
  G.indexDirty = false;
}

// 비직렬화 런타임 필드 부착
export function attachRuntime(G, map, rngState) {
  Object.defineProperty(G, 'map', { value: map, enumerable: false, writable: true });
  const rng = makeRng(rngState ?? G.seed);
  Object.defineProperty(G, 'rng', { value: rng, enumerable: false, writable: true });
  G.focusNode = (C, id) => (FOCUS_TREES[C.focus.tree] || FOCUS_TREES.generic).find((n) => n.id === id);
  G.focusTree = (C) => FOCUS_TREES[C.focus.tree] || FOCUS_TREES.generic;
  G.queueEvent = (id, tag, days = 0) => { G.events.scheduled.push({ id, tag, at: G.hour + Math.round(days * 24) }); };
  G.makeCountry = (tag, def) => makeCountry(G, tag, def);
  // 항복 특수 처리(비시 프랑스, 내전 종결, 분할 등): 데이터의 이벤트가 처리
  G.onCapitulate = (tag, victor, enemies) => {
    const H = CAPITULATIONS.find((h) => h.tag === tag && (!h.by || h.by.includes(victor) || (h.anyEnemy && enemies.some((e) => h.by.includes(e)))) && (!h.trig || checkTrigger(G, G.countries[tag], h.trig)));
    if (!H || !EVENT_INDEX[H.event]) return null;
    G.capVictor = victor;
    fireEvent(G, H.event, H.who === 'victor' ? victor : tag);
    G.capVictor = null;
    return 'handled';
  };
  for (const k of ['focusNode', 'focusTree', 'queueEvent', 'makeCountry', 'onCapitulate']) Object.defineProperty(G, k, { enumerable: false, value: G[k], writable: true });
  for (const k of ['warRel', 'supplyOf', 'supRatio', 'seaReach', 'airSup', 'airPen', 'casPower', 'navSup', 'raid', 'divsAt', 'ownCtrl', 'ctrlBy', 'battles', 'onNews', 'onCapture', 'onWar', 'onDivDestroyed'])
    if (!(k in G)) Object.defineProperty(G, k, { enumerable: false, writable: true, value: undefined });
  G.battles = G.battles || {};
}

// ───────── 시간 진행 ─────────
export function tick(G) {
  if (G.hour % 24 === 0) daily(G);
  rebuildDivIndex(G);
  assignDivSupply(G);
  hourlyEmbarked(G);
  hourlyDivisions(G); // 이동은 divsAt를 직접 갱신한다
  hourlyCombat(G);
  aiHourly(G);
  if (G.indexDirty) rebuildIndexes(G);
  G.hour++;
}

export function daily(G) {
  if (G.indexDirty || !G.ownCtrl) rebuildIndexes(G);
  { const m = new Date(Date.UTC(1936, 0, 1) + G.hour * 3600e3).getUTCMonth(); G.winter = m === 11 || m === 0 || m === 1; }
  rebuildWarCache(G);
  const alive = Object.values(G.countries).filter((C) => C.alive);
  for (const C of alive) if (C.modsDirty || G.hour % (24 * 7) === 0) refreshMods(C);
  computeSeaReach(G);
  computeSupply(G);
  for (const C of alive) tallyEconomy(G, C);
  runMarket(G);
  for (const C of alive) {
    if (C.capitulated) continue;
    runEconomy(G, C);
    dailyResearch(G, C);
    dailyPolitics(G, C);
    dailyMilitary(G, C);
    dailyJustify(G, C);
    if (C.modsDirty) refreshMods(C);
  }
  dailyAir(G);
  dailyNaval(G);
  dailyCapitulation(G);
  dailyLiberation(G);
  cleanupWars(G);
  runEvents(G);
  aiDaily(G);
  if (G.indexDirty) rebuildIndexes(G);
  if (G.onDay) G.onDay();
}

// ───────── 이벤트 ─────────
export const EVENT_INDEX = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

function runEvents(G) {
  // 예약 이벤트
  const due = G.events.scheduled.filter((s) => s.at <= G.hour);
  G.events.scheduled = G.events.scheduled.filter((s) => s.at > G.hour);
  for (const s of due) fireEvent(G, s.id, s.tag);
  // 조건 이벤트
  for (const E of EVENTS) {
    if (!E.trig || E.manual) continue;
    const tags = E.who ? [].concat(E.who) : [];
    for (const tag of tags) {
      const key = E.id + ':' + tag;
      if (G.events.fired[key] && !E.repeat) continue;
      const C = G.countries[tag]; if (!C?.alive) continue;
      if (E.mtth && G.rng() > 1 / E.mtth) continue;
      if (!checkTrigger(G, C, E.trig)) continue;
      fireEvent(G, E.id, tag);
    }
  }
}

export function fireEvent(G, id, tag) {
  const E = EVENT_INDEX[id];
  const C = G.countries[tag];
  if (!E || !C?.alive) return;
  const key = id + ':' + tag;
  G.events.fired[key] = (G.events.fired[key] || 0) + 1;
  if (E.immediate) applyEffects(G, C, E.immediate);
  if (E.news) news(G, E.newsText || E.title, { kind: 'event', big: 1, ev: id, tags: [tag] });
  if (!C.isAI) {
    G.pending.push({ id, tag, h: G.hour });
    if (G.onEvent) G.onEvent(id, tag);
  } else {
    const k = aiChooseEventOption(G, C, E);
    resolveEvent(G, id, tag, k);
  }
}

export function resolveEvent(G, id, tag, optIndex) {
  const E = EVENT_INDEX[id]; const C = G.countries[tag];
  const opt = E.opts?.[optIndex] || E.opts?.[0];
  G.pending = G.pending.filter((p) => !(p.id === id && p.tag === tag));
  if (opt) applyEffects(G, C, opt.fx || []);
}

// ───────── 저장 / 불러오기 ─────────
export function serialize(G) {
  const data = {};
  for (const k of Object.keys(G)) {
    if (['map', 'rng'].includes(k) || k[0] === '_' || typeof G[k] === 'function') continue;
    data[k] = G[k];
  }
  data.rngState = G.rng.state();
  // 국가 캐시 제거
  const countries = {};
  for (const t in G.countries) { const { _tpl, m, ...rest } = G.countries[t]; countries[t] = rest; }
  data.countries = countries;
  return JSON.stringify(data);
}

export function deserialize(str, map) {
  const data = JSON.parse(str);
  const G = data;
  const rs = data.rngState; delete G.rngState;
  attachRuntime(G, map, rs);
  G.rng.setState(rs);
  for (const t in G.countries) refreshMods(G.countries[t]);
  rebuildIndexes(G);
  rebuildWarCache(G);
  rebuildDivIndex(G);
  computeSeaReach(G); computeSupply(G); assignDivSupply(G);
  G.battles = G.battles || {};
  return G;
}

export function setPlayer(G, tag) {
  for (const t in G.countries) G.countries[t].isAI = t !== tag;
  G.player = tag;
}

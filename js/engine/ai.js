// 인공지능: 경제·연구·중점·정치·징집·공군·해군·외교·전선 운용
import { TECHS, TECH } from '../data/techs.js';
import { EQUIPMENT, SHIPS, LAND_EQ } from '../data/units.js';
import { LAW_GROUPS, ADVISOR_ROLES, DECISIONS } from '../data/ideas.js';
import { COUNTRIES } from '../data/countries.js';
import { M } from './mods.js';
import { atWar, atWarAny, allied, enemiesOf, friendlyCtrl, yearFrac, ymd } from './world.js';
import { techAvailable, startResearch } from './research.js';
import { focusBlocked, selectFocus, lawBlocked, enactLaw, advisorBlocked, hireAdvisor, decisionBlocked, takeDecision } from './politics.js';
import { canBuild, queueBuild, setLine, stateSlots, stateUsedSlots, shipUnlocked } from './economy.js';
import { tplStats, tplAvailable, divsOf, divPower, orderMove, findPath, moveCost, manpowerAvailable, enemyDivsIn, divStats } from './military.js';
import { canDeclareWar, declareWar, canJustify, startJustify, joinFaction, guarantee, canGuarantee, signNap } from './diplomacy.js';
import { createWing, WING_SIZE, wingCoverage } from './air.js';
import { transportTime, seaPath, returnToPort } from './naval.js';
import { checkTrigger } from './effects.js';

const LAND_DOC = { GER: 'mw1', SOV: 'ma1', ENG: 'sf1', FRA: 'gb1', ITA: 'sf1', USA: 'sf1', POL: 'gb1', JAP: 'ma1', FIN: 'gb1', CZE: 'gb1', ROM: 'ma1', TUR: 'ma1', SPR: 'gb1', NSP: 'ma1' };
const IND_DOC = { SOV: 'disp1', USA: 'disp1', ENG: 'disp1' };
const NAV_DOC = { GER: 'td1', ITA: 'fib1', ENG: 'fib1', FRA: 'fib1', USA: 'fib1', SOV: 'td1' };
const AIR_DOC = { GER: 'bat1', ENG: 'bmb1', USA: 'bmb1', SOV: 'bat1', ITA: 'asup1', FRA: 'asup1' };
const NAVAL_POWERS = { ENG: 1, USA: 1, ITA: 0.7, FRA: 0.6, GER: 0.5, SOV: 0.3, SPR: 0.2, TUR: 0.1, GRE: 0.1, HOL: 0.2, SWE: 0.15 };

const hashTag = (t) => [...t].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;

export function aiSetup(G, C) {
  C.aiProfile = COUNTRIES[C.tag]?.ai || { aggr: 0.1 };
  aiResearch(G, C, true);
  aiProduction(G, C, true);
  if (C.isAI) aiConstruction(G, C);
  else { aiConstruction(G, C); }
}

// ───────── 매일 ─────────
export function aiDaily(G) {
  const day = Math.floor(G.hour / 24);
  for (const tag in G.countries) {
    const C = G.countries[tag];
    if (!C.alive || C.capitulated) continue;
    const h = hashTag(tag);
    if (!C.isAI) { // 플레이어 보조: 자동 설정이 켜진 항목만
      if (C.autoResearch) aiResearch(G, C);
      continue;
    }
    aiResearch(G, C);
    if (!C.focus.cur) aiFocus(G, C);
    if ((day + h) % 3 === 0) aiConstruction(G, C);
    if ((day + h) % 7 === 0) aiProduction(G, C);
    if ((day + h) % 5 === 0) aiPolitics(G, C);
    if ((day + h) % 4 === 0) aiRecruit(G, C);
    if ((day + h) % 3 === 1) aiAir(G, C);
    if ((day + h) % 2 === 0) aiNavy(G, C);
    if ((day + h) % 7 === 3) aiDiplomacy(G, C);
    if (!atWarAny(G, tag) && (day + h) % 10 === 0) peacetimeDeploy(G, C);
  }
}

// ───────── 매 시간: 전시 전선 운용 ─────────
export function aiHourly(G) {
  for (const tag in G.countries) {
    const C = G.countries[tag];
    if (!C.alive || C.capitulated) continue;
    const h = hashTag(tag) % 6;
    if ((G.hour % 6) !== h) continue;
    if (C.isAI) { if (atWarAny(G, tag)) militaryAI(G, C); }
    // 플레이어 군(자동 전선)
    for (const id in G.armies) {
      const A = G.armies[id];
      if (A.tag !== tag || C.isAI || !A.auto) continue;
      if (atWarAny(G, tag)) armyAI(G, C, A);
    }
  }
}

// ───────── 연구 ─────────
function catWeight(G, C, cat) {
  const y = yearFrac(G.hour);
  const major = C.major;
  const naval = NAVAL_POWERS[C.tag] || 0;
  switch (cat) {
    case 'ind': return y < 1939 ? 1.6 : 1.1;
    case 'land': return 1.25;
    case 'inf': return 1.15;
    case 'art': return 0.9;
    case 'arm': return major ? 1.05 : 0.35;
    case 'sup': return 0.7;
    case 'air': return major ? 0.95 : 0.45;
    case 'ele': return 0.7;
    case 'nav': return 0.15 + naval * 0.9;
    case 'navd': return naval * 0.7;
    case 'aird': return major ? 0.55 : 0.25;
    default: return 0.5;
  }
}
function exclAllowed(C, T) {
  if (!T.excl) return true;
  const pref = T.excl === 'land' ? LAND_DOC[C.tag] : T.excl === 'industry' ? (IND_DOC[C.tag] || 'conc1') : T.excl === 'naval' ? (NAV_DOC[C.tag] || 'fib1') : T.excl === 'air' ? (AIR_DOC[C.tag] || 'asup1') : null;
  if (!pref) { // 무작위지만 국가별로 고정
    const opts = TECHS.filter((t) => t.excl === T.excl).map((t) => t.id);
    return opts[hashTag(C.tag) % opts.length] === T.id;
  }
  return pref === T.id;
}
export function aiResearch(G, C) {
  const R = C.research;
  const y = yearFrac(G.hour);
  for (let i = 0; i < R.slots; i++) {
    if (R.cur[i]) continue;
    let best = null, bs = -Infinity;
    for (const T of TECHS) {
      if (!techAvailable(C, T.id) || !exclAllowed(C, T)) continue;
      const ahead = Math.max(0, T.year - y);
      if (ahead > 1.5) continue;
      let s = catWeight(G, C, T.cat) / (1 + 2.2 * ahead) / Math.pow(T.cost, 0.35);
      if (T.id === 'synth' && (C.eco.res?.oil || 0) > 30) s *= 0.3;
      if (T.cat === 'arm' && (C.tag === 'GER' || C.tag === 'SOV')) s *= 1.3;
      s *= 1 + ((hashTag(C.tag + T.id) % 100) / 1000);
      if (s > bs) { bs = s; best = T; }
    }
    if (best) startResearch(G, C, i, best.id);
  }
}

// ───────── 국가 중점 ─────────
export function aiFocus(G, C) {
  const tree = G.focusTree(C);
  let best = null, bs = -Infinity;
  for (const node of tree) {
    if (focusBlocked(G, C, node)) continue;
    let s = node.ai ?? 1;
    if (node.aiIf && !checkTrigger(G, C, node.aiIf)) s *= 0.05;
    s += G.rng() * 0.3;
    if (s > bs) { bs = s; best = node; }
  }
  if (best && bs > 0) selectFocus(G, C, best.id);
}

// ───────── 정치 ─────────
function aiPolitics(G, C) {
  const war = atWarAny(G, C.tag);
  const order = LAW_GROUPS.economy.order;
  // 경제법 상향
  const cur = order.indexOf(C.laws.economy);
  const wantEco = war ? 'war' : G.tension > 0.35 || C.ideology === 'fas' ? 'partial' : 'early';
  const want = order.indexOf(wantEco);
  if (cur < want) { for (let k = want; k > cur; k--) if (!lawBlocked(G, C, 'economy', order[k])) { enactLaw(G, C, 'economy', order[k]); return; } }
  if (war && C.warSupport > 0.85 && C.laws.economy !== 'total' && !lawBlocked(G, C, 'economy', 'total') && C.surrender > 0.2) { enactLaw(G, C, 'economy', 'total'); return; }
  // 징병법
  const corder = LAW_GROUPS.conscription.order;
  const ci = corder.indexOf(C.laws.conscription);
  const lowMp = manpowerAvailable(C) < 30000 + divsOf(G, C.tag).length * 1500;
  if ((lowMp || (war && ci < 3)) && ci < corder.length - 1) { for (let k = Math.min(corder.length - 1, ci + 1); k > ci; k--) if (!lawBlocked(G, C, 'conscription', corder[k])) { enactLaw(G, C, 'conscription', corder[k]); return; } }
  if (C.laws.conscription === 'disarmed' && G.tension > 0.2) { if (!lawBlocked(G, C, 'conscription', 'volunteer')) { enactLaw(G, C, 'conscription', 'volunteer', false); return; } }
  // 고문
  if (C.pp > 220) {
    const prefs = war ? ['armament', 'army', 'propaganda', 'security', 'air', 'construction', 'economy', 'navy', 'workhorse'] : ['construction', 'armament', 'economy', 'workhorse', 'army', 'propaganda', 'science', 'air', 'security'];
    for (const r of prefs) { if ((NAVAL_POWERS[C.tag] || 0) < 0.3 && r === 'navy') continue; if (!advisorBlocked(G, C, r)) { hireAdvisor(G, C, r); return; } }
  }
  // 결정
  if (C.pp > 300) {
    const choices = war ? ['armsdrive', 'propaganda', 'warbonds', 'mobilize'] : ['industrial', 'science', 'propaganda'];
    for (const id of choices) { const D = DECISIONS.find((d) => d.id === id); if (D && !decisionBlocked(G, C, D)) { takeDecision(G, C, id); return; } }
  }
  if (war && C.stability < 0.3 && C.pp > 80) { const D = DECISIONS.find((d) => d.id === 'martial'); if (D && !decisionBlocked(G, C, D)) takeDecision(G, C, 'martial'); }
}

// ───────── 건설 ─────────
function aiConstruction(G, C) {
  const tag = C.tag;
  const free = C.eco.civFree ?? 10;
  const want = Math.max(2, Math.ceil(free / 15) + 1);
  if (C.cons.length >= want) return;
  const y = yearFrac(G.hour);
  const war = atWarAny(G, tag);
  const civShare = war ? 0.1 : y < 1938 ? 0.7 : y < 1939.5 ? 0.35 : 0.15;
  const owned = [];
  for (const i of G.ownCtrl?.[tag] || []) { const S = G.st[i]; if (S.owner === tag && S.ctrl === tag && S.cores.includes(tag) && !G.map.virtual[i]) owned.push(i); }
  if (!owned.length) return;
  let guard = 0;
  while (C.cons.length < want && guard++ < 10) {
    const r = G.rng();
    let type = r < civShare ? 'civ' : 'mil';
    // 정유소: 석유 부족한 산업국
    if (C.unlock.refinery && (C.eco.res?.oil || 0) < (C.eco.need?.oil || 0) + 15 && G.rng() < 0.25) type = 'ref';
    // 인프라 / 요새 / 조선소 가끔
    const q = G.rng();
    if (q < 0.08) type = 'infra';
    else if (q < 0.12 && (NAVAL_POWERS[tag] || 0) > 0.4) type = 'dock';
    let best = -1, bs = -Infinity;
    for (const i of owned) {
      if (canBuild(G, C, type, i)) continue;
      const S = G.st[i];
      let s = (G.map.props[i].ind ?? 0.5) + (S.infra || 1) * 0.3 + G.rng() * 0.5;
      if (type === 'infra') s = (S.civ + S.mil) * 0.5 - (S.infra || 1) * 2 + (S.vp || 0) * 0.05;
      if (s > bs) { bs = s; best = i; }
    }
    if (best < 0 && type !== 'civ') { type = 'civ'; for (const i of owned) { if (!canBuild(G, C, type, i)) { best = i; break; } } }
    if (best < 0) break;
    queueBuild(G, C, type, best);
  }
  // 위협 국경 요새
  if (G.tension > 0.3 && C.cons.length < want + 1 && G.rng() < 0.15) {
    const rivals = threatTags(G, C);
    for (const i of owned) {
      if (G.st[i].fort >= 4) continue;
      if (G.map.nb[i].some((v) => rivals.includes(G.st[v].owner))) { if (!canBuild(G, C, 'fort', i)) { queueBuild(G, C, 'fort', i); break; } }
    }
  }
}

// ───────── 생산 ─────────
export function desiredMix(G, C) {
  const y = yearFrac(G.hour);
  const war = atWarAny(G, C.tag);
  const mix = { inf_eq: 30, sup_eq: 6, art: 11, at: 5, aa: 3, mot: 4, fighter: 14, cas: 5, tac: 4 };
  if (C.eq.ltank >= 1) mix.ltank = y < 1939 ? 7 : 3;
  if (C.eq.mtank >= 1) { mix.mtank = C.major ? 12 : 4; mix.ltank = 1; }
  if (C.eq.htank >= 1 && C.major && y > 1941) mix.htank = 2;
  if (C.eq.mech >= 1 && C.major) mix.mech = 4;
  if (!C.major) { mix.fighter = 8; mix.cas = 2; mix.tac = 1; mix.inf_eq = 40; mix.mot = 2; }
  if (war) mix.inf_eq += 8;
  // 부족분 반영
  const need = {};
  for (const D of divsOf(G, C.tag)) { const st = divStats(G, D); for (const e in st.eq) need[e] = (need[e] || 0) + st.eq[e] * (1 - D.str); }
  for (const T of C.training) { const tpl = C.templates.find((t) => t.id === T.tpl); if (!tpl) continue; const st = tplStats(C, tpl); for (const e in st.eq) need[e] = (need[e] || 0) + st.eq[e]; }
  for (const e in need) { const deficit = need[e] - (C.stock[e] || 0); if (deficit > 0 && mix[e] != null) mix[e] *= 1 + Math.min(2, deficit * EQUIPMENT[e].ic[1] / 3000); }
  // 해당 장비 사용 불가 제거
  for (const e in mix) if ((e === 'sup_eq' || e === 'mot' ? 1 : C.eq[e] || 0) < 1) delete mix[e];
  return mix;
}
export function aiProduction(G, C, init) {
  const mil = Math.floor(C.eco.mil || 0) || totalStateFac(G, C, 'mil');
  if (mil <= 0) { C.lines = []; }
  else {
    const mix = desiredMix(G, C);
    const keys = Object.keys(mix);
    const sum = keys.reduce((s, k) => s + mix[k], 0);
    const alloc = {};
    let used = 0;
    for (const k of keys) { alloc[k] = Math.floor((mix[k] / sum) * mil); used += alloc[k]; }
    keys.sort((a, b) => mix[b] - mix[a]);
    for (let i = 0; used < mil; i = (i + 1) % keys.length) { alloc[keys[i]]++; used++; }
    // 기존 라인 유지: 차이가 작으면 변경하지 않음
    for (const k of keys) {
      const L = C.lines.find((l) => l.eq === k);
      if (L && Math.abs(L.fac - alloc[k]) <= 1 && !init) continue;
      setLine(G, C, k, alloc[k]);
    }
    for (const L of [...C.lines]) if (!keys.includes(L.eq)) setLine(G, C, L.eq, 0);
  }
  // 조선
  const dock = Math.floor(C.eco.dock || 0) || totalStateFac(G, C, 'dock');
  const naval = NAVAL_POWERS[C.tag] || 0.05;
  if (dock > 0) {
    const plan = [];
    if (C.tag === 'GER') plan.push(['ss', 0.6], ['dd', 0.2], ['bb', 0.2]);
    else if (naval >= 0.6) plan.push(['dd', 0.35], ['cl', 0.2], ['ss', 0.15], ['bb', 0.15], ['cv', 0.15]);
    else plan.push(['dd', 0.5], ['ss', 0.5]);
    const avail = plan.filter(([k]) => shipUnlocked(C, k));
    const total = avail.reduce((s, [, w]) => s + w, 0);
    const lines = [];
    let left = dock;
    for (const [k, w] of avail) { const d = Math.max(1, Math.min(10, Math.round((w / total) * dock))); if (left <= 0) break; const use = Math.min(d, left); left -= use; lines.push({ id: G.nextId++, ship: k, docks: use, prog: C.shipLines.find((l) => l.ship === k)?.prog || 0 }); }
    C.shipLines = lines;
  }
}
function totalStateFac(G, C, type) { let n = 0; for (const S of G.st) if (S.owner === C.tag && S.ctrl === C.tag) n += S[type] || 0; return n + (C.offmap?.[type] || 0); }

// ───────── 징집 ─────────
function aiRecruit(G, C) {
  const divs = divsOf(G, C.tag).length + C.training.length;
  const war = atWarAny(G, C.tag);
  const mil = C.eco.mil || 0;
  let target = Math.round(6 + mil * (C.major ? 2.4 : 2.0) + (war ? 10 : 0) + G.tension * 20);
  if (C.tag === 'SOV') target += 40;
  if (C.tag === 'USA') target = Math.round(target * (atWarAny(G, 'USA') ? 1 : 0.4));
  const mp = manpowerAvailable(C);
  if (divs >= target || mp < 12000) return;
  if (C.training.length >= (war ? 10 : 6)) return;
  // 장비가 충분한지
  const tpls = C.templates.filter((t) => tplAvailable(C, t) && t.key !== 'gar');
  if (!tpls.length) return;
  const y = yearFrac(G.hour);
  const armorShare = C.major ? (y > 1939 ? 0.22 : 0.12) : 0.05;
  const arm = tpls.find((t) => t.key === 'arm' || (t.bats.lt || t.bats.mt));
  const inf = tpls.find((t) => t.key === 'inf72') || tpls.find((t) => t.key === 'inf9') || tpls[0];
  const mot = tpls.find((t) => t.key === 'mot');
  const nArm = divsOf(G, C.tag).filter((D) => divStats(G, D).armored).length;
  let pick = inf;
  if (arm && nArm < divs * armorShare && (C.stock.ltank || 0) + (C.stock.mtank || 0) > 100) pick = arm;
  else if (mot && C.major && G.rng() < 0.15 && (C.stock.mot || 0) > 150) pick = mot;
  const st = tplStats(C, pick);
  // 대기 중인 훈련의 장비 수요를 합산해 비축량이 감당할 때만 추가
  const queued = {};
  for (const T of C.training) { const tp = C.templates.find((t) => t.id === T.tpl); if (!tp) continue; const s2 = tplStats(C, tp); for (const e in s2.eq) queued[e] = (queued[e] || 0) + s2.eq[e]; }
  const minCover = war ? 0.45 : 0.7;
  let n = 0;
  const maxN = Math.min(war ? 6 : 4, target - divs, Math.floor(mp / Math.max(1, st.mp)));
  while (n < maxN) {
    let ok = true;
    for (const e in st.eq) if ((C.stock[e] || 0) < ((queued[e] || 0) + st.eq[e]) * minCover) { ok = false; break; }
    if (!ok) break;
    for (const e in st.eq) queued[e] = (queued[e] || 0) + st.eq[e];
    C.training.push({ id: G.nextId++, tpl: pick.id, prog: 0, loc: C.capital });
    n++;
  }
}

// ───────── 공군 ─────────
function aiAir(G, C) {
  // 비축 기체로 새 비행단 창설
  for (const type of ['fighter', 'cas', 'tac']) {
    if ((C.stock[type] || 0) >= 40 && C.capital >= 0) { const n = Math.min(WING_SIZE, Math.floor(C.stock[type])); C.stock[type] -= n; createWing(G, C.tag, type, n, airBaseNear(G, C, C.capital), 'none'); }
  }
  const wings = Object.values(G.wings).filter((W) => W.tag === C.tag);
  if (!wings.length) return;
  if (!atWarAny(G, C.tag)) { for (const W of wings) W.mission = 'none'; return; }
  // 주요 전선 지점
  const fronts = frontStates(G, C.tag);
  if (!fronts.length) return;
  // 가장 위협이 큰 전선
  const scored = fronts.map((f) => [f, (G.battles[f] ? 5 : 0) + G.map.nb[f].reduce((s, v) => s + (atWar(G, C.tag, G.st[v].ctrl) ? enemyDivsIn(G, C.tag, v).length : 0), 0)]).sort((a, b) => b[1] - a[1]);
  wings.forEach((W, k) => {
    const target = scored[k % Math.min(scored.length, 3)][0];
    W.base = airBaseNear(G, C, target);
    W.target = target;
    W.mission = W.type === 'fighter' ? 'sup' : W.type === 'cas' ? 'cas' : (G.rng() < 0.6 ? 'cas' : 'bomb');
    if (W.mission === 'bomb') { const t = bombTarget(G, C); if (t >= 0) W.target = t; else W.mission = 'cas'; }
    if (!wingCoverage(G, W).length) W.mission = 'none';
  });
}
function airBaseNear(G, C, st) {
  const map = G.map; let best = C.capital, bd = Infinity;
  for (const i of G.ctrlBy?.[C.tag] || []) { if ((G.st[i].air || 0) < 1) continue; const d = map.dist(i, st); if (d < bd) { bd = d; best = i; } }
  return best;
}
function bombTarget(G, C) {
  let best = -1, bs = 0;
  for (const e of enemiesOf(G, C.tag)) for (const i of G.ctrlBy?.[e] || []) { const S = G.st[i]; const v = (S.civ + S.mil * 1.5) / (1 + G.map.dist(i, C.capital) / 800); if (v > bs) { bs = v; best = i; } }
  return best;
}

// ───────── 해군 ─────────
function aiNavy(G, C) {
  const fleets = Object.values(G.fleets).filter((F) => F.tag === C.tag);
  if (!fleets.length) return;
  const war = atWarAny(G, C.tag);
  for (const F of fleets) {
    if (F.rest > 0) continue;
    const home = G.map.coast[F.base]?.[0];
    if (!war) { F.mission = F.reserve ? 'idle' : 'patrol'; F.target = home ?? F.loc; continue; }
    const subsOnly = (F.ships.ss || 0) > 0 && Object.keys(F.ships).every((k) => k === 'ss' || !F.ships[k]);
    if (F.reserve) {
      // 예비 함대 → 주력 함대에 합류
      const main = fleets.find((x) => !x.reserve && x.loc === F.loc);
      if (main) { for (const k in F.ships) { main.ships[k] = (main.ships[k] || 0) + F.ships[k]; F.ships[k] = 0; } }
      continue;
    }
    if (subsOnly || (F.ships.ss || 0) > 10 && C.tag === 'GER') {
      F.mission = 'raid';
      F.target = G.map.seaIdx[C.tag === 'GER' ? 'wapp' : 'natl'] ?? F.loc;
    } else {
      F.mission = 'patrol';
      F.target = home ?? F.loc;
    }
  }
}

// ───────── 외교 ─────────
export function threatTags(G, C) {
  const out = new Set();
  for (const t in G.countries) {
    const X = G.countries[t]; if (!X.alive || t === C.tag) continue;
    if (atWar(G, C.tag, t)) out.add(t);
    if (X.wargoals.some((w) => w.target === C.tag) || X.justify.some((j) => j.target === C.tag)) out.add(t);
    if (C.wargoals.some((w) => w.target === t)) out.add(t);
  }
  for (const r of C.aiState.rivals || []) out.add(r);
  return [...out];
}

function aiDiplomacy(G, C) {
  const tag = C.tag;
  // 전쟁 목표가 있으면 준비되었을 때 선전포고 (역사 경로는 중점/이벤트가 제공)
  for (const w of [...C.wargoals]) {
    if (canDeclareWar(G, tag, w.target)) continue;
    const T = G.countries[w.target];
    const ready = militaryRatio(G, tag, w.target) > (C.aiProfile.aggr > 0.6 ? 1.2 : 1.6);
    const timing = !w.after || G.hour >= w.after;
    if (ready && timing && (C.aiState.warOk?.[w.target] ?? true)) { declareWar(G, tag, w.target); break; }
  }
  // 진영 가입: 위협받는 소국
  if (!C.faction && !C.master && G.tension > 0.45 && !C.major) {
    const threats = threatTags(G, C);
    if (threats.length) {
      for (const fid in G.factions) {
        const F = G.factions[fid]; const L = G.countries[F.leader];
        if (!L || threats.includes(F.leader)) continue;
        if (threats.some((t) => F.members.includes(t))) continue;
        if (L.ideology === C.ideology || (C.ideology === 'neu' && L.ideology === 'dem' && G.tension > 0.7)) {
          if (L.isAI && aiAcceptsMember(G, L, C)) { joinFaction(G, tag, fid); break; }
        }
      }
    }
  }
  // 보장: 강대국 민주주의가 위협받는 소국 보장
  if (C.major && C.ideology === 'dem' && G.tension > 0.3 && C.pp > 100 && C.isAI) {
    for (const t in G.countries) {
      const X = G.countries[t];
      if (!X.alive || X.major || X.faction || X.master || allied(G, tag, t)) continue;
      const threatened = Object.values(G.countries).some((Y) => Y.alive && Y.ideology !== 'dem' && (Y.wargoals.some((w) => w.target === t) || Y.justify.some((j) => j.target === t)));
      if (!threatened) continue;
      if (!canGuarantee(G, tag, t) && G.map) { guarantee(G, tag, t); break; }
    }
  }
  // 기회주의적 정당화 (공격적 비민주 국가, 중점 경로가 없을 때)
  if (C.aiProfile.aggr >= 0.5 && C.ideology !== 'dem' && !C.justify.length && !C.wargoals.length && G.rng() < 0.08) {
    const neighbors = new Set();
    for (const i of G.ownCtrl?.[tag] || []) for (const v of G.map.nb[i]) { const o = G.st[v].owner; if (o !== tag) neighbors.add(o); }
    const weak = [...neighbors].filter((t) => G.countries[t]?.alive && !G.countries[t].major && !G.countries[t].faction && !allied(G, tag, t) && militaryRatio(G, tag, t) > 3);
    if (weak.length && !C.aiState.noOpportunism) { const t = weak[Math.floor(G.rng() * weak.length)]; if (!canJustify(G, tag, t)) startJustify(G, tag, t); }
  }
}

export function aiAcceptsMember(G, L, C) {
  if (atWarAny(G, C.tag) && !atWarAny(G, L.tag)) return false;
  return L.ideology === C.ideology || G.tension > 0.6;
}
export function aiAcceptsNap(G, A, B) { return !atWar(G, A.tag, B.tag) && !A.wargoals.some((w) => w.target === B.tag) && A.ideology !== 'fas' ? true : A.aiProfile?.aggr < 0.5; }
export function aiAcceptsAccess(G, A, B) { return allied(G, A.tag, B.tag) || A.ideology === B.ideology; }

export function militaryRatio(G, a, b) {
  let pa = 0, pb = 0;
  for (const id in G.divs) { const D = G.divs[id]; if (D.tag === a) pa += divPower(G, D); else if (D.tag === b || allied(G, b, D.tag) && atWar(G, a, D.tag)) pb += divPower(G, D); }
  return pa / Math.max(1, pb);
}

// ───────── 이벤트 선택지 ─────────
export function aiChooseEventOption(G, C, E) {
  const opts = E.opts || [];
  if (opts.length <= 1) return 0;
  const w = opts.map((o) => { let x = o.ai ?? 1; if (o.aiIf && !checkTrigger(G, C, o.aiIf)) x *= 0.01; return Math.max(0, x); });
  const s = w.reduce((a, b) => a + b, 0);
  if (s <= 0) return 0;
  let r = G.rng() * s;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}

// ═════════ 전선 운용 ═════════
export function frontStates(G, tag) {
  const map = G.map, out = [];
  for (let s = 0; s < map.nGeo; s++) {
    if (G.st[s].ctrl !== tag) continue;
    if (map.nb[s].some((v) => atWar(G, tag, G.st[v].ctrl))) out.push(s);
  }
  return out;
}

const TERR_DEF = { mountain: 2.0, hills: 1.35, forest: 1.2, marsh: 1.7, urban: 1.45, jungle: 1.4, desert: 1, plains: 1 };

// 국가 전체 전선 운용 (AI)
function militaryAI(G, C) {
  const divs = divsOf(G, C.tag).filter((D) => !D.sea && !(D.army && G.armies[D.army] && !G.armies[D.army].aiOwned && !C.isAI));
  runFront(G, C, divs, { aggr: C.aiProfile?.aggr ?? 0.3, whole: true });
}

// 플레이어 자동 군
function armyAI(G, C, A) {
  const divs = A.divs.map((id) => G.divs[id]).filter((D) => D && !D.sea);
  runFront(G, C, divs, { aggr: A.order === 'attack' ? 0.8 : 0, only: A.front?.length ? new Set(A.front) : null, enemy: A.enemy || null });
}

export function runFront(G, C, divs, opts) {
  const tag = C.tag;
  const map = G.map;
  if (!divs.length) return;
  let fronts = frontStates(G, tag);
  if (opts.enemy) fronts = fronts.filter((f) => map.nb[f].some((v) => G.st[v].ctrl === opts.enemy || allied(G, opts.enemy, G.st[v].ctrl) && atWar(G, tag, G.st[v].ctrl)));
  if (opts.only) { const f2 = fronts.filter((f) => opts.only.has(f)); if (f2.length) fronts = f2; }
  if (!fronts.length) return;
  // 적 전력 (주별)
  const enemyPow = new Float32Array(map.n);
  for (const id in G.divs) { const E = G.divs[id]; if (atWar(G, tag, E.tag)) enemyPow[E.loc] += divPower(G, E); }
  // 위협
  const threat = new Map();
  for (const f of fronts) {
    let t = 0.4 + (G.st[f].vp || 0) * 0.03;
    for (const v of map.nb[f]) {
      if (!atWar(G, tag, G.st[v].ctrl)) continue;
      const share = map.nb[v].filter((u) => G.st[u].ctrl === tag).length || 1;
      t += enemyPow[v] / share / 40 + 0.3;
    }
    if (G.battles[f]) t += 2;
    threat.set(f, t);
  }
  const usable = divs.filter((D) => !D.retreat && D.att < 0);
  const totalThreat = [...threat.values()].reduce((a, b) => a + b, 0);
  // 공세 예비대 비율
  const reserveFrac = opts.aggr >= 0.6 ? 0.3 : opts.aggr >= 0.3 ? 0.15 : 0.05;
  const forFront = Math.max(Math.min(usable.length, fronts.length), Math.round(usable.length * (1 - reserveFrac)));
  const desired = new Map();
  for (const f of fronts) desired.set(f, Math.max(1, Math.round((threat.get(f) / totalThreat) * forFront)));
  // 현재 배치 집계
  const at = new Map();
  for (const D of usable) { const tgt = D.path.length ? D.path[D.path.length - 1] : D.loc; at.set(tgt, (at.get(tgt) || 0) + 1); }
  // 넘치는 사단 → 자유
  const free = [];
  const count = new Map();
  for (const D of usable) {
    const tgt = D.path.length ? D.path[D.path.length - 1] : D.loc;
    const need = desired.get(tgt) || 0;
    const c = count.get(tgt) || 0;
    if (c < need) count.set(tgt, c + 1);
    else free.push(D);
  }
  // 부족한 전선 주에 가까운 자유 사단 배치
  const lacking = fronts.filter((f) => (count.get(f) || 0) < desired.get(f)).sort((a, b) => threat.get(b) - threat.get(a));
  for (const f of lacking) {
    let need = desired.get(f) - (count.get(f) || 0);
    if (!free.length) break;
    const dist = friendlyDistances(G, tag, f);
    free.sort((a, b) => dist[a.loc] - dist[b.loc]);
    for (let k = 0; k < free.length && need > 0; k++) {
      const D = free[k];
      if (!isFinite(dist[D.loc])) continue;
      if (orderMove(G, D, f, 'friendly')) { free.splice(k--, 1); need--; count.set(f, (count.get(f) || 0) + 1); }
    }
  }
  // 바다 건너 전선(본토와 육로 단절): 해상 수송
  if (opts.whole && free.length > 2) overseasReinforce(G, C, fronts, free, threat);
  // 공세
  if (opts.aggr > 0) offensive(G, C, fronts, usable, enemyPow, opts);
  // 남은 자유 사단: 가장 위협 큰 전선 근처로
  if (free.length && opts.whole) {
    const top = fronts.slice().sort((a, b) => threat.get(b) - threat.get(a))[0];
    for (const D of free) if (!D.path.length && D.loc !== top && G.rng() < 0.5) orderMove(G, D, top, 'friendly');
  }
}

function friendlyDistances(G, tag, src) {
  const map = G.map, n = map.n;
  const dist = new Float64Array(n).fill(Infinity);
  dist[src] = 0;
  const q = [src];
  while (q.length) {
    let bi = 0; for (let i = 1; i < q.length; i++) if (dist[q[i]] < dist[q[bi]]) bi = i;
    const u = q[bi]; q.splice(bi, 1);
    for (const v of map.nb[u]) {
      if (!friendlyCtrl(G, tag, v)) continue;
      const nd = dist[u] + moveCost(G, u, v);
      if (nd < dist[v]) { dist[v] = nd; q.push(v); }
    }
  }
  return dist;
}

function offensive(G, C, fronts, usable, enemyPow, opts) {
  const tag = C.tag, map = G.map;
  const aggr = opts.aggr;
  const threshold = aggr >= 0.8 ? 1.15 : aggr >= 0.6 ? 1.3 : aggr >= 0.3 ? 1.6 : 2.2;
  const targets = new Map();
  for (const f of fronts) for (const v of map.nb[f]) {
    if (!atWar(G, tag, G.st[v].ctrl)) continue;
    if (opts.enemy && G.st[v].ctrl !== opts.enemy && !allied(G, opts.enemy, G.st[v].ctrl)) continue;
    if (!targets.has(v)) targets.set(v, []);
    targets.get(v).push(f);
  }
  const busy = new Set();
  const list = [];
  for (const [t, from] of targets) {
    const S = G.st[t];
    const terr = TERR_DEF[map.terrain[t]] || 1;
    const fort = 1 + 0.15 * Math.max(0, (S.fort || 0) - (from.length - 1));
    let river = 1;
    for (const f of from) { const e = map.edge(f, t); if (e?.river === 2) river = Math.max(river, 1.8); else if (e?.river) river = Math.max(river, 1.35); }
    const def = enemyPow[t] * terr * fort * river;
    const atkDivs = [];
    for (const f of from) for (const id of G.divsAt[f] || []) {
      const D = G.divs[id];
      if (!D || D.tag !== tag || !usable.includes(D) || D.path.length) continue;
      const st = divStats(G, D);
      if (D.org < st.org * 0.7 || D.str < 0.55 || D.sup < 0.3) continue;
      atkDivs.push(D);
    }
    if (!atkDivs.length) continue;
    const pow = atkDivs.reduce((s, D) => s + divPower(G, D) * (1 + D.plan), 0);
    const ratio = def > 0 ? pow / def : 99;
    let score = ratio * (2 + (S.vp || 0) * 0.3 + (G.countries[S.ctrl]?.capital === t ? 15 : 0) + from.length * 1.5 + (S.cores.includes(tag) ? 4 : 0));
    // 포위 가능성: 적 주의 아군 이웃 비율
    const own = map.nb[t].filter((u) => G.st[u].ctrl === tag || allied(G, tag, G.st[u].ctrl)).length;
    score *= 1 + own / Math.max(1, map.nb[t].length);
    list.push({ t, from, def, ratio, score, atkDivs });
  }
  list.sort((a, b) => b.score - a.score);
  let launched = 0;
  const maxOps = Math.max(1, Math.round(fronts.length * (0.15 + aggr * 0.35)));
  for (const o of list) {
    if (launched >= maxOps) break;
    if (o.ratio < threshold && o.def > 0) continue;
    // 공격 사단 선택: 남겨둘 방어 사단 고려
    const sending = [];
    let pow = 0;
    const need = o.def > 0 ? o.def * threshold * 1.15 : 1;
    const left = new Map();
    for (const D of o.atkDivs.sort((a, b) => divPower(G, b) - divPower(G, a))) {
      if (busy.has(D.id)) continue;
      const f = D.loc;
      const othersThreat = map.nb[f].some((u) => u !== o.t && atWar(G, tag, G.st[u].ctrl) && enemyPow[u] > 0);
      const stay = (G.divsAt[f] || []).filter((id) => G.divs[id]?.tag === tag).length - (left.get(f) || 0);
      if (othersThreat && stay <= 1 && aggr < 0.9) continue;
      sending.push(D); pow += divPower(G, D) * (1 + D.plan); left.set(f, (left.get(f) || 0) + 1);
      if (o.def <= 0 && sending.length >= 1) break;
      if (pow >= need) break;
    }
    if (!sending.length) continue;
    for (const D of sending) { D.path = [o.t]; D.prog = 0; busy.add(D.id); }
    launched++;
  }
}

function overseasReinforce(G, C, fronts, free, threat) {
  const tag = C.tag;
  if (C.capital < 0) return;
  const connected = friendlyDistances(G, tag, C.capital);
  const over = fronts.filter((f) => !isFinite(connected[f]));
  if (!over.length) return;
  // 해당 지역 항구
  for (const f of over.sort((a, b) => threat.get(b) - threat.get(a))) {
    const local = friendlyDistances(G, tag, f);
    let port = -1, pd = Infinity;
    for (let i = 0; i < G.map.n; i++) if (isFinite(local[i]) && G.st[i].ctrl === tag && G.st[i].port > 0 && local[i] < pd) { pd = local[i]; port = i; }
    if (port < 0) continue;
    let sent = 0;
    for (const D of free) {
      if (sent >= 3) break;
      if (D.sea || !isFinite(connected[D.loc]) || !(G.st[D.loc].port > 0)) {
        // 항구로 이동 지시
        if (!D.sea && isFinite(connected[D.loc]) && !D.path.length) {
          const homePort = nearestPort(G, tag, D.loc, connected);
          if (homePort >= 0 && homePort !== D.loc) orderMove(G, D, homePort, 'friendly');
        }
        continue;
      }
      const tt = transportTime(G, tag, D.loc, port);
      if (tt == null) continue;
      D.sea = { kind: 'move', to: port, eta: G.hour + tt, from: D.loc };
      sent++;
    }
    break;
  }
}
function nearestPort(G, tag, from, connected) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < G.map.n; i++) if (G.st[i].ctrl === tag && G.st[i].port > 0 && isFinite(connected[i])) { const d = G.map.dist(from, i); if (d < bd) { bd = d; best = i; } }
  return best;
}

// ───────── 평시 배치 ─────────
function peacetimeDeploy(G, C) {
  const tag = C.tag, map = G.map;
  const rivals = threatTags(G, C);
  const divs = divsOf(G, tag).filter((D) => !D.sea && !D.path.length && !(D.army && G.armies[D.army]?.player));
  if (!divs.length) return;
  const border = [];
  for (const i of G.ctrlBy?.[tag] || []) {
    if (map.props[i].col) continue;
    const w = map.nb[i].reduce((s, v) => s + (rivals.includes(G.st[v].owner) ? (G.countries[G.st[v].owner].major ? 3 : 1.5) : 0), 0);
    if (w > 0) border.push([i, w]);
  }
  if (!border.length) return;
  const total = border.reduce((s, [, w]) => s + w, 0);
  const share = Math.round(divs.length * 0.75);
  const want = new Map(border.map(([i, w]) => [i, Math.max(1, Math.round((w / total) * share))]));
  const have = new Map();
  for (const D of divs) have.set(D.loc, (have.get(D.loc) || 0) + 1);
  const spare = divs.filter((D) => !want.has(D.loc) || have.get(D.loc) > want.get(D.loc));
  for (const [i, w] of want) {
    let need = w - (have.get(i) || 0);
    while (need-- > 0 && spare.length) {
      const D = spare.shift();
      if (want.has(D.loc) && have.get(D.loc) <= want.get(D.loc)) continue;
      if (orderMove(G, D, i, 'friendly')) { have.set(D.loc, (have.get(D.loc) || 1) - 1); have.set(i, (have.get(i) || 0) + 1); }
    }
  }
}

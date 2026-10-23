// 인공지능: 경제·연구·중점·정치·징집·공군·해군·외교·전선 운용
import { TECHS, TECH } from '../data/techs.js';
import { EQUIPMENT, SHIPS, LAND_EQ, BATTALIONS, TERRAIN } from '../data/units.js';
import { LAW_GROUPS, ADVISOR_ROLES, DECISIONS } from '../data/ideas.js';
import { COUNTRIES } from '../data/countries.js';
import { M } from './mods.js';
import { atWar, atWarAny, allied, enemiesOf, friendlyCtrl, yearFrac, ymd, hourOfDate, news } from './world.js';
import { techAvailable, startResearch } from './research.js';
import { focusBlocked, selectFocus, lawBlocked, enactLaw, advisorBlocked, hireAdvisor, decisionBlocked, takeDecision } from './politics.js';
import { canBuild, queueBuild, setLine, stateSlots, stateUsedSlots, shipUnlocked, sendEquipment } from './economy.js';
import { tplStats, tplAvailable, divsOf, divPower, orderMove, findPath, moveCost, manpowerAvailable, enemyDivsIn, divStats, eqLevel, eqCost, editTemplate, MinHeap } from './military.js';
import { canDeclareWar, declareWar, canJustify, startJustify, joinFaction, guarantee, canGuarantee, signNap } from './diplomacy.js';
import { createWing, WING_SIZE, wingCoverage } from './air.js';
import { transportTime, seaPath, returnToPort, canInvade, fleetPower } from './naval.js';
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
    if (!C.aiProfile) aiSetup(G, C); // 이벤트로 새로 생긴 국가
    const h = hashTag(tag);
    if (!C.isAI) { // 플레이어 보조: 자동 설정이 켜진 항목만
      if (C.autoResearch) aiResearch(G, C);
      if (C.autoCons && (day + h) % 3 === 0) aiConstruction(G, C);
      if (C.autoProd && (day + h) % 7 === 0) aiProduction(G, C);
      if (C.autoRecruit && (day + h) % 4 === 0) aiRecruit(G, C);
      if (C.autoAir && (day + h) % 3 === 1) aiAir(G, C);
      if (C.autoNavy && (day + h) % 2 === 0) aiNavy(G, C);
      continue;
    }
    aiResearch(G, C);
    if (!C.focus.cur) aiFocus(G, C);
    else if ((day + h) % 3 === 0) aiUrgentFocus(G, C);
    if (C.wargoals.length) aiWargoals(G, C);
    if ((day + h) % 3 === 0) aiConstruction(G, C);
    if ((day + h) % 7 === 0) { aiTemplates(G, C); aiProduction(G, C); }
    if ((day + h) % 5 === 0) aiPolitics(G, C);
    if ((day + h) % 4 === 0) aiRecruit(G, C);
    if ((day + h) % 3 === 1) aiAir(G, C);
    if ((day + h) % 2 === 0) aiNavy(G, C);
    if ((day + h) % 5 === 2 && atWarAny(G, tag)) aiInvasion(G, C);
    if ((day + h) % 7 === 3) aiDiplomacy(G, C);
    if ((day + h) % 7 === 5) aiLendLease(G, C);
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
function aiUrgentFocus(G, C) {
  const cur = G.focusNode(C, C.focus.cur);
  if (!cur || (cur.ai ?? 1) >= 10) return;
  for (const node of G.focusTree(C)) {
    if ((node.ai ?? 1) < 15 || focusBlocked(G, C, node)) continue;
    if (node.aiIf && !checkTrigger(G, C, node.aiIf)) continue;
    selectFocus(G, C, node.id); // 진행도는 사라진다
    return;
  }
}

export function aiFocus(G, C) {
  const tree = G.focusTree(C);
  let best = null, bs = -Infinity;
  for (const node of tree) {
    if (focusBlocked(G, C, node)) continue;
    // aiIf 조건(대개 역사적 날짜)이 맞지 않으면 기다린다
    if (node.aiIf && !checkTrigger(G, C, node.aiIf)) continue;
    let s = node.ai ?? 1;
    if (s <= 0.2) continue; // 대체 역사 경로: 플레이어 전용
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
  // 지도 밖 본토만 있는 나라(미국)는 그곳에 짓는다
  if (!owned.length) for (const i of G.ownCtrl?.[tag] || []) if (G.map.virtual[i] && G.st[i].owner === tag && G.st[i].ctrl === tag) owned.push(i);
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
      if (G.st[i].fort >= (C.major ? 4 : 3)) continue;
      if (G.map.nb[i].some((v) => rivals.includes(G.st[v].owner))) { if (!canBuild(G, C, 'fort', i)) { queueBuild(G, C, 'fort', i); break; } }
    }
  }
}

// ───────── 생산 ─────────
export function desiredMix(G, C) {
  const y = yearFrac(G.hour);
  // 공군: 기종 비율과 공장 비중
  const air = { fighter: 14, cas: C.tag === 'GER' || C.tag === 'JAP' || (C.tag === 'SOV' && y >= 1940) ? 9 : 5, tac: 4 };
  if (!C.major) { air.fighter = 8; air.cas = 2; air.tac = 1; }
  const airShare = C.major ? (C.aiProfile?.air ?? 0.28) : 0.12;
  // 육군 장비 수요 = 지금 군대의 구성(사단·훈련 중) + 새로 만들 보병·기갑 사단 + 부족분
  const U = {}, need = {};
  const add = (st, k, miss) => { for (const e in st.eq) { U[e] = (U[e] || 0) + st.eq[e] * k; if (miss) need[e] = (need[e] || 0) + st.eq[e] * miss; } };
  const divs = divsOf(G, C.tag);
  for (const D of divs) add(divStats(G, D), 1, 1 - D.str);
  for (const T of C.training) { const tpl = C.templates.find((t) => t.id === T.tpl); if (tpl) add(tplStats(C, tpl), 1, 1); }
  const inf = C.templates.find((t) => t.key === 'inf72' && tplAvailable(C, t)) || C.templates.find((t) => t.key === 'inf9' && tplAvailable(C, t));
  if (inf) add(tplStats(C, inf), Math.max(3, divs.length * 0.15), 0);
  const arm = C.templates.find((t) => t.key === 'arm');
  if (arm && C.major && tplAvailable(C, arm)) {
    // 기갑 사단은 전체의 8% 안팎, 많아도 30개(1941년 독일 기갑 사단 21개, 1944년 약 40개)
    const want = Math.min(30, Math.round(divs.length * (y > 1939 ? 0.09 : 0.06)));
    const have = divs.filter((D) => divStats(G, D).armored).length;
    add(tplStats(C, arm), Math.max(1, want - have + 1), 0);
  }
  // 경전차 편제를 중형 전차로 바꿀 준비
  if (arm?.bats.lt && C.unlock.mtank1 && eqLevel(C, 'mtank') >= 1) U.mtank = (U.mtank || 0) + (U.ltank || 0) * 0.8;
  const land = {};
  for (const e in U) {
    if (EQUIPMENT[e]?.air || (eqLevel(C, e) < 1 && e !== 'inf_eq')) continue;
    const cost = eqCost(C, e);
    let w = U[e] * cost;
    const deficit = (need[e] || 0) - (C.stock[e] || 0);
    if (deficit > 0) w *= 1 + Math.min(3, (deficit / Math.max(1, U[e])) * 6);
    // 비축이 군대 보유량의 30%를 넘으면 감산
    const ref = U[e] * 0.3 + 1000 / cost, have = C.stock[e] || 0;
    if (have > ref) w *= Math.max(0.05, ref / have);
    if (w > 0) land[e] = w;
  }
  // 전차는 비싸서 수요만 따르면 공장 절반을 삼킨다: 지상 장비의 30%까지만
  const TANKS = ['ltank', 'mtank', 'htank'];
  const tsum = TANKS.reduce((s, e) => s + (land[e] || 0), 0), all = Object.values(land).reduce((a, b) => a + b, 0);
  if (tsum > 0 && tsum > all * 0.3) { const k = (0.3 * (all - tsum)) / (0.7 * tsum); for (const e of TANKS) if (land[e]) land[e] *= k; }
  const mix = {};
  const lsum = Object.values(land).reduce((a, b) => a + b, 0) || 1;
  for (const e in land) mix[e] = (land[e] / lsum) * (1 - airShare) * 100;
  const airOk = Object.keys(air).filter((e) => (C.eq[e] || 0) >= 1);
  const asum = airOk.reduce((a, e) => a + air[e], 0) || 1;
  for (const e of airOk) mix[e] = (air[e] / asum) * airShare * 100;
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

// ───────── 무기 대여 ─────────
// 미국(무기 대여법 이후)과 영국은 자국 군대에 필요한 양을 넘는 비축 장비를, 독일과 싸우며 장비가 모자란 우방에 보낸다.
// 실제 무기 대여처럼 트럭·항공기·전차가 먼저이고 소총은 마지막이며, 받는 나라마다 한 주에 공업력 1,000 상당까지(소련 생산의 10~15%)
const LL_EQ = ['mot', 'fighter', 'mtank', 'ltank', 'sup_eq', 'cas', 'tac', 'art', 'at', 'aa', 'inf_eq'];
const LL_WEEK_IC = 1000;
function armyNeed(G, C) { const U = {}; for (const D of divsOf(G, C.tag)) { const st = divStats(G, D); for (const e in st.eq) U[e] = (U[e] || 0) + st.eq[e]; } return U; }
function aiLendLease(G, C) {
  if (!(C.flags?.lendlease || (C.tag === 'ENG' && atWarAny(G, C.tag)))) return;
  const foes = enemiesOf(G, C.tag);
  const recips = [];
  for (const t in G.countries) {
    const X = G.countries[t];
    if (t === C.tag || !X.alive || X.capitulated || X.ideology === 'fas' || atWar(G, C.tag, t)) continue;
    if (!atWar(G, t, 'GER') && !foes.some((e) => atWar(G, t, e))) continue;
    recips.push(X);
  }
  if (!recips.length) return;
  const mine = armyNeed(G, C);
  const needs = new Map(recips.map((X) => [X, armyNeed(G, X)]));
  const spent = new Map();
  for (const e of LL_EQ) {
    const air = EQUIPMENT[e]?.air, cost = Math.max(0.5, eqCost(C, e));
    const keep = air ? 400 : (mine[e] || 0) * 0.5 + 1000 / cost;
    const surplus = (C.stock[e] || 0) - keep;
    if (surplus <= 0) continue;
    let budget = surplus * 0.2; // 한 주에 남는 양의 5분의 1
    // 모자란 양이 큰 나라부터(비축 목표: 군대 보유량의 20%, 항공기 200대)
    const list = recips.map((X) => [X, (air ? 200 : (needs.get(X)[e] || 0) * 0.2) - (X.stock[e] || 0)]).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]);
    for (const [X, d] of list) {
      if (budget < 1) break;
      const room = (LL_WEEK_IC - (spent.get(X) || 0)) / cost;
      if (room < 1) continue;
      const n = sendEquipment(G, C, X, e, Math.min(budget, d, room));
      budget -= n; spent.set(X, (spent.get(X) || 0) + n * cost);
    }
  }
}

// ───────── 편제 개선 ─────────
// 중형 전차가 생기고 비축분이 충분하면 기갑 사단의 경전차 대대를 중형 전차로 바꾼다
function aiTemplates(G, C) {
  const arm = C.templates.find((t) => t.key === 'arm');
  if (!arm || !arm.bats.lt || !C.unlock.mtank1 || eqLevel(C, 'mtank') < 1) return;
  const divs = divsOf(G, C.tag).filter((D) => D.tpl === arm.id);
  const need = divs.reduce((s, D) => s + D.str, 0) * BATTALIONS.mt.eq.mtank * arm.bats.lt;
  if ((C.stock.mtank || 0) < need * 0.6) return;
  const bats = { ...arm.bats, mt: (arm.bats.mt || 0) + arm.bats.lt }; delete bats.lt;
  editTemplate(G, C, arm.id, bats, arm.sup, arm.name);
}

// ───────── 징집 ─────────
const CAV_NATIONS = new Set(['SOV', 'POL', 'HUN', 'ROM', 'TUR', 'YUG', 'MON', 'CHI', 'MAN', 'BUL', 'IRN', 'IRQ', 'SAU', 'AFG', 'ETH', 'NSP', 'SPR', 'LIT', 'LAT', 'EST', 'GRE']);
function aiRecruit(G, C) {
  const divs = divsOf(G, C.tag);
  const nDiv = divs.length + C.training.length;
  const war = atWarAny(G, C.tag);
  const mil = C.eco.mil || 0;
  // 강대국: 전쟁 초기에는 공장 하나당 2.2개 사단까지 동원하고, 총력전 단계(1941년~)에는 장비를 감당할 수 있는 1.6개로
  let target = 6 + mil * (C.major ? (yearFrac(G.hour) < 1941 ? 2.2 : 1.6) : 2.0) + (war ? 10 : 0) + G.tension * 20;
  if (C.tag === 'SOV') target += 40;
  target *= C.aiProfile?.army ?? 1; // 해양 강국(영국)은 육군 규모가 작다
  if (C.tag === 'USA') target *= war ? 1 : 0.4;
  // 소국: 인구 상한 (평시 100만 명당 1.6개, 전시 2.4개 사단)
  if (!C.major) { let pop = 0; for (const i of G.ownCtrl?.[C.tag] || []) { const S = G.st[i]; if (S.owner === C.tag && S.cores.includes(C.tag)) pop += S.pop; } target = Math.min(target, 2 + (pop / 1000) * (war ? 2.4 : 1.6)); }
  target = Math.round(target);
  const mp = manpowerAvailable(C);
  if (nDiv >= target || mp < 12000) return;
  const qCap = war ? Math.max(10, Math.min(40, Math.round(mil / 4))) : 6;
  if (C.training.length >= qCap) return;
  const tpls = C.templates.filter((t) => tplAvailable(C, t) && t.key !== 'gar');
  if (!tpls.length) return;
  // 기존 사단 결손 장비는 비축분에서 먼저 뺀다 (보충이 우선)
  const avail = { ...C.stock };
  for (const D of divs) { if (D.str >= 0.98) continue; const st = divStats(G, D); for (const e in st.eq) avail[e] = (avail[e] || 0) - st.eq[e] * (1 - D.str); }
  for (const T of C.training) { const tp = C.templates.find((t) => t.id === T.tpl); if (!tp) continue; const s2 = tplStats(C, tp); for (const e in s2.eq) avail[e] = (avail[e] || 0) - s2.eq[e]; }
  const y = yearFrac(G.hour);
  const armorShare = C.major ? (y > 1939 ? 0.09 : 0.06) : 0.03; // desiredMix의 기갑 목표와 같게
  const arm = tpls.find((t) => t.key === 'arm' || (t.bats.lt || t.bats.mt));
  const mot = tpls.find((t) => t.key === 'mot');
  const nArm = divs.filter((D) => divStats(G, D).armored).length;
  // 선호 순서: 기갑(비율 미달 시) → 차량화(가끔) → 포병 보강 보병 → 보병 → 기타
  const order = [];
  if (arm && nArm < Math.min(30, nDiv * armorShare)) order.push(arm);
  if (mot && C.major && G.rng() < 0.15) order.push(mot);
  // 기병은 기병 전통이 있는 나라만, 전체의 20%까지
  const cavOk = CAV_NATIONS.has(C.tag) && divs.filter((D) => divStats(G, D).cls.cav).length < nDiv * 0.2;
  for (const k of ['inf72', 'inf9', 'mtn', 'cav']) { const t = tpls.find((x) => x.key === k); if (t && !order.includes(t) && (k !== 'cav' || cavOk)) order.push(t); }
  for (const t of tpls) if (!order.includes(t) && !t.bats.lt && !t.bats.mt && !t.bats.ht && t.key !== 'cav') order.push(t);
  // 장비 충족(가치 가중): 소총은 반드시 있어야 하고, 지원 장비 등은 일부 모자라도 편성
  const minCover = war ? 0.75 : 0.85;
  const fits = (st) => {
    if (st.eq.inf_eq && (avail.inf_eq || 0) < st.eq.inf_eq * 0.9) return false;
    let tot = 0, got = 0;
    for (const e in st.eq) { const n = st.eq[e], w = n * eqCost(C, e); tot += w; got += w * Math.min(1, Math.max(0, avail[e] || 0) / n); }
    return tot <= 0 || got / tot >= minCover;
  };
  let n = 0;
  const maxN = Math.min(war ? Math.max(6, qCap - C.training.length) : 4, target - nDiv);
  for (const pick of order) {
    const st = tplStats(C, pick);
    while (n < maxN && mp - n * st.mp > st.mp && fits(st)) {
      for (const e in st.eq) avail[e] = (avail[e] || 0) - st.eq[e];
      C.training.push({ id: G.nextId++, tpl: pick.id, prog: 0, loc: C.capital, minEq: 0.75 });
      n++;
    }
    if (n >= maxN) break;
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
  const weak = war && navyPower(G, C.tag) < enemiesOf(G, C.tag).reduce((s, e) => s + navyPower(G, e), 0) * 0.5;
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
    } else if (weak) {
      // 열세 해군: 현존 함대 전략 — 항구에 머문다
      F.mission = 'idle';
      F.target = home ?? F.loc;
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

// 전쟁 목표 실행 (매일): 역사 경로는 중점·이벤트가 wargoalAt으로 일정을 준다
function aiWargoals(G, C) {
  const tag = C.tag;
  for (const w of [...C.wargoals]) {
    if (canDeclareWar(G, tag, w.target)) continue;
    if (w.after && G.hour < w.after) continue;
    // 역사적 일정(force)이 있는 전쟁 목표는 준비와 무관하게 실행, 그 밖은 전력 우위가 있을 때(주 1회 판단)
    const ready = w.force || ((Math.floor(G.hour / 24) + hashTag(tag)) % 7 === 3 && militaryRatio(G, tag, w.target) > (C.aiProfile.aggr > 0.6 ? 1.2 : 1.6));
    if (ready && (C.aiState.warOk?.[w.target] ?? true)) { declareWar(G, tag, w.target, { name: w.name }); break; }
  }
}

// 1939년 영국·프랑스가 실제로 독립을 보장한 나라들
const GUARANTEE_OK = new Set(['POL', 'ROM', 'GRE', 'TUR']);
function aiDiplomacy(G, C) {
  const tag = C.tag;
  // 소국의 진영 가입은 이벤트(침공당했을 때 등)로만 — 자동 가입은 연쇄 참전을 일으킨다
  // 보장: 강대국 민주주의가 위협받는 소국 보장
  if ((tag === 'ENG' || tag === 'FRA') && G.tension > 0.3 && C.pp > 100 && C.isAI && yearFrac(G.hour) >= 1939) {
    for (const t in G.countries) {
      const X = G.countries[t];
      if (!GUARANTEE_OK.has(t) || !X.alive || X.major || X.faction || X.master || allied(G, tag, t)) continue;
      // 파시즘 국가의 위협만 (소련의 요구에는 개입하지 않는다)
      const threatened = Object.values(G.countries).some((Y) => Y.alive && Y.ideology === 'fas' && (Y.wargoals.some((w) => w.target === t) || Y.justify.some((j) => j.target === t)));
      if (!threatened) continue;
      if (!canGuarantee(G, tag, t) && G.map) { guarantee(G, tag, t); break; }
    }
  }
  // 기회주의적 정당화: 1938년 이후, 긴장도가 높을 때, 우리가 영유권을 주장하는 땅을 가진 약한 이웃만
  // (역사적 침공은 국가 중점·이벤트가 담당한다)
  if (C.aiProfile.aggr >= 0.5 && !C.aiProfile.plan && C.ideology !== 'dem' && !C.justify.length && !C.wargoals.length && !atWarAny(G, tag)
    && yearFrac(G.hour) >= 1938 && G.tension >= 0.4 && G.rng() < 0.04 && !C.aiState.noOpportunism) {
    const claimed = new Set();
    for (const S of G.st) if (S.owner !== tag && (S.claims.includes(tag) || S.cores.includes(tag))) claimed.add(S.owner);
    const weak = [...claimed].filter((t) => G.countries[t]?.alive && !G.countries[t].major && !G.countries[t].faction && !allied(G, tag, t)
      && !Object.values(G.countries).some((X) => X.alive && X.major && X.tag !== tag && X.guarantees?.includes(t)) && militaryRatio(G, tag, t) > 3);
    if (weak.length) { const t = weak[Math.floor(G.rng() * weak.length)]; if (!canJustify(G, tag, t)) startJustify(G, tag, t); }
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
  if (!divs.length) return;
  let only = A.front?.length ? new Set(A.front) : null;
  if (!only) {
    // 같은 적을 맡은 다른 자동 군과 전선을 나눔: 각 전선 주를 가장 가까운 군에 배정
    const peers = Object.values(G.armies).filter((B) => B.tag === C.tag && B.auto && !B.front?.length && (B.enemy || null) === (A.enemy || null) && B.divs.some((id) => G.divs[id]));
    if (peers.length > 1) {
      const map = G.map;
      const centers = peers.map((B) => {
        let x = 0, y = 0, n = 0;
        for (const id of B.divs) { const D = G.divs[id]; if (!D) continue; const t = D.path.length ? D.path[D.path.length - 1] : D.loc; x += map.cx[t]; y += map.cy[t]; n++; }
        return [x / n, y / n, B];
      });
      let fronts = frontStates(G, C.tag);
      if (A.enemy) fronts = fronts.filter((f) => map.nb[f].some((v) => G.st[v].ctrl === A.enemy || (allied(G, A.enemy, G.st[v].ctrl) && atWar(G, C.tag, G.st[v].ctrl))));
      const mine = fronts.filter((f) => {
        let best = null, bd = Infinity;
        for (const [x, y, B] of centers) { const d = (map.cx[f] - x) ** 2 + (map.cy[f] - y) ** 2; if (d < bd) { bd = d; best = B; } }
        return best === A;
      });
      if (mine.length) only = new Set(mine);
    }
  }
  // 자동 방어도 가만히 맞기만 하지 않는다: 적 공세가 꺾이면 빼앗긴 땅을 되찾는 반격까지(counter)
  const hold = A.order !== 'attack';
  runFront(G, C, divs, { aggr: hold ? 0.3 : 0.8, counter: hold, only, enemy: A.enemy || null });
}

// 같은 진영 동맹국의 전선(우리 적과 맞닿은 동맹국 주) — 원정군 파견용
// 바다 건너 원정은 해양 강국(영국·미국)만. 나머지는 육로로 이어진 동맹국 전선에만 간다
function alliedFrontStates(G, C) {
  const tag = C.tag, map = G.map, out = [];
  if (!C.faction) return out;
  // 육로 연결: 본토 + 각본으로 보낸 원정 거점(아프리카 군단의 트리폴리 등)
  let land = null;
  if ((NAVAL_POWERS[tag] || 0) < 0.9 && C.capital >= 0) {
    land = friendlyDistances(G, tag, C.capital);
    for (const a of C.aiState?.anchors || []) {
      if (!friendlyCtrl(G, tag, a)) continue;
      const d = friendlyDistances(G, tag, a);
      for (let i = 0; i < map.n; i++) if (d[i] < land[i]) land[i] = d[i];
    }
  }
  for (let s = 0; s < map.nGeo; s++) {
    const c = G.st[s].ctrl;
    if (c === tag || G.countries[c]?.faction !== C.faction) continue;
    if (land && !isFinite(land[s])) continue;
    if (map.nb[s].some((v) => atWar(G, tag, G.st[v].ctrl) && atWar(G, c, G.st[v].ctrl))) out.push(s);
  }
  return out;
}

export function runFront(G, C, divs, opts) {
  const tag = C.tag;
  const map = G.map;
  if (!divs.length) return;
  // 공격 중이거나 적 영토로 진군 중인 사단은 그대로 둔다(빈 주 점령·승리 후 진입)
  const usable = divs.filter((D) => !D.retreat && D.att < 0 && !D.sea && !(D.path.length && atWar(G, tag, G.st[D.path[D.path.length - 1]].ctrl)));
  let fronts = frontStates(G, tag);
  // 3주 안에 선전포고가 예정된 나라(역사적 일정)와의 국경도 미리 전선으로 취급해 병력을 모은다
  const soon = new Set(opts.whole ? C.wargoals.filter((w) => w.after && w.after - G.hour < 21 * 24 && G.countries[w.target]?.alive).map((w) => w.target) : []);
  const hostile = (c) => atWar(G, tag, c) || soon.has(c);
  if (soon.size) for (let s2 = 0; s2 < map.nGeo; s2++) if (G.st[s2].ctrl === tag && !fronts.includes(s2) && map.nb[s2].some((v) => soon.has(G.st[v].ctrl))) fronts.push(s2);
  if (opts.enemy) fronts = fronts.filter((f) => map.nb[f].some((v) => G.st[v].ctrl === opts.enemy || allied(G, opts.enemy, G.st[v].ctrl) && atWar(G, tag, G.st[v].ctrl)));
  if (opts.only) { const f2 = fronts.filter((f) => opts.only.has(f)); if (f2.length) fronts = f2; }
  // 원정군: 우리 전선이 적은데 사단이 남으면 같은 진영 동맹국 전선에 가세(가까운 순 최대 10곳)
  const allyFront = new Set();
  if (opts.whole && (C.major || C.master) && usable.length > fronts.length * 3 + 6) {
    const cap = C.capital >= 0 ? C.capital : usable[0].loc;
    const af = alliedFrontStates(G, C).sort((a, b) => map.dist(cap, a) - map.dist(cap, b)).slice(0, 10);
    for (const f of af) { fronts.push(f); allyFront.add(f); }
  }
  if (!fronts.length) return;
  // 적 전력 (주별)
  const enemyPow = new Float32Array(map.n);
  for (const id in G.divs) { const E = G.divs[id]; if (hostile(E.tag)) enemyPow[E.loc] += divPower(G, E); }
  // 위협과 전선 길이
  const threat = new Map(), frontage = new Map();
  for (const f of fronts) {
    let t = 0.4 + (G.st[f].vp || 0) * 0.08, fl = 0;
    for (const v of map.nb[f]) {
      if (!hostile(G.st[v].ctrl)) continue;
      fl++;
      const share = map.nb[v].filter((u) => friendlyCtrl(G, tag, u)).length || 1;
      t += enemyPow[v] / share / 40 + 0.3;
    }
    if (G.battles[f]) t += 2;
    if (f === C.capital) t = t * 1.5 + 2; // 수도 사수
    if (allyFront.has(f)) t *= 0.5;
    threat.set(f, t); frontage.set(f, fl * (allyFront.has(f) ? 0.5 : 1));
  }
  const totalThreat = [...threat.values()].reduce((a, b) => a + b, 0);
  const totalFrontage = [...frontage.values()].reduce((a, b) => a + b, 0) || 1;
  // 해안 수비대: 강한 해군국과 싸우는 동안 항구·주요 해안 주에 일부를 남긴다(대서양 방벽)
  const guard = opts.whole ? coastGuard(G, C, usable, fronts) : null;
  const avail = guard?.size ? usable.filter((D) => !guard.has(D.id)) : usable;
  // 기갑 집중: 기동 사단은 전선 배치에서 빼서 돌파 지점에 모은다
  const spear = opts.whole ? spearhead(G, C, fronts, avail, enemyPow, opts) : null;
  const line = spear ? avail.filter((D) => !spear.ids.has(D.id)) : avail;
  // 공세 예비대 비율
  const reserveFrac = opts.counter ? 0.1 : opts.aggr >= 0.6 ? 0.3 : opts.aggr >= 0.3 ? 0.15 : 0.05;
  const forFront = Math.max(Math.min(line.length, fronts.length), Math.round(line.length * (1 - reserveFrac)));
  // 배치 목표: 전선 길이(고르게)와 위협(집중)을 반씩
  const desired = new Map();
  for (const f of fronts) desired.set(f, Math.max(1, Math.round(forFront * (0.5 * frontage.get(f) / totalFrontage + 0.5 * threat.get(f) / totalThreat))));
  // 보급 수용량을 넘겨 쌓지 않음
  const so = G.supplyOf?.[tag];
  const capDivs = (s) => { const S = G.st[s]; const v = so ? so[s] : 1; const cap = v * (3 + (S.infra || 1) * 2.5 + (S.port || 0) * 0.8 + (S.vp >= 10 ? 4 : 0)); return Math.max(1, Math.floor((cap / 0.55) * 1.2)); };
  for (const f of fronts) desired.set(f, Math.min(desired.get(f), capDivs(f)));
  // 원정군 상한: 전체 사단의 일정 비율(영국 25% 등)
  if (allyFront.size) {
    let s = 0; for (const f of allyFront) s += desired.get(f);
    const capE = Math.round(usable.length * (C.aiProfile?.exp ?? 0.3));
    if (s > capE) for (const f of allyFront) desired.set(f, Math.floor(desired.get(f) * capE / s));
  }
  // 넘치는 사단 → 자유
  const free = [];
  const count = new Map();
  for (const D of line) {
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
    // 멈춰 있는 사단을 먼저 쓴다(이동 중인 사단을 계속 돌려세우면 아무 데도 도착하지 못한다)
    free.sort((a, b) => (a.path.length > 0) - (b.path.length > 0) || dist[a.loc] - dist[b.loc]);
    for (let k = 0; k < free.length && need > 0; k++) {
      const D = free[k];
      if (!isFinite(dist[D.loc])) continue;
      if (orderMove(G, D, f, 'friendly')) { free.splice(k--, 1); need--; count.set(f, (count.get(f) || 0) + 1); }
    }
  }
  if (G.dbg) G.dbg('front', tag, { fronts: fronts.map((f) => `${map.key[f]}:${count.get(f) || 0}/${desired.get(f)}${allyFront.has(f) ? '*' : ''}`).join(' '), free: free.map((D) => map.key[D.loc] + (D.path.length ? '>' + map.key[D.path[D.path.length - 1]] : '')).join(','), lacking: lacking.map((f) => map.key[f]).join(',') });
  // 바다 건너 전선(본토와 육로 단절, 동맹국 전선 포함): 해상 수송
  if (opts.whole && free.length > 2 && lacking.length) overseasReinforce(G, C, lacking, free, threat, desired, count, allyFront);
  // 본토 전선에 병력이 모자라면 전선 없는 해외 영토의 사단을 불러들인다(아프리카군 공수 등)
  if (opts.whole && lacking.length && free.length) repatriate(G, C, free, lacking, fronts);
  // 공세 (동맹국 전선 포함)
  // 공세에 동시에 투입할 수 있는 사단 수(나머지는 전선 방어)
  if (opts.aggr > 0) offensive(G, C, fronts, avail, enemyPow, { ...opts, spear: spear?.sp, room: Math.floor(divs.length * (opts.counter ? 0.25 : 0.3 + opts.aggr * 0.4)) - (divs.length - usable.length) });
  // 남은 자유 사단: 수용 여력이 있는 위협 큰 전선으로, 과밀한 주에 있으면 보급이 나은 후방으로
  const occ = new Map();
  for (const D of usable) { const t2 = D.path.length ? D.path[D.path.length - 1] : D.loc; occ.set(t2, (occ.get(t2) || 0) + 1); }
  const tops = fronts.slice().sort((a, b) => threat.get(b) - threat.get(a));
  const onFront = new Set(fronts);
  for (const D of free) {
    if (D.path.length || D.att >= 0 || D.sea) continue;
    // 남는 사단: 절반 확률로 수용 여력이 있는 위협 큰 전선으로(이동 중인 사단은 건드리지 않는다).
    // 이미 전선에 있는 예비대는 위협이 1.5배 넘게 큰 곳으로만 옮긴다 — 비슷한 전선 사이를 오가기만 하면 아무 데서도 싸우지 못한다
    if (opts.whole && G.rng() < 0.5) {
      const here = onFront.has(D.loc) ? threat.get(D.loc) * 1.5 : 0;
      const f = tops.find((x) => x !== D.loc && (occ.get(x) || 0) < capDivs(x) && threat.get(x) > here);
      if (f != null && orderMove(G, D, f, 'friendly')) { occ.set(f, (occ.get(f) || 0) + 1); occ.set(D.loc, (occ.get(D.loc) || 1) - 1); continue; }
    }
    if ((occ.get(D.loc) || 0) > capDivs(D.loc)) {
      const dest = roomyRear(G, tag, D.loc, occ, capDivs);
      if (dest >= 0 && orderMove(G, D, dest, 'friendly')) { occ.set(dest, (occ.get(dest) || 0) + 1); occ.set(D.loc, (occ.get(D.loc) || 1) - 1); }
    }
  }
}

// 기갑 집중(슈베어풍크트): 기동 사단을 한 곳에 모아 가장 약한 지점을 뚫는다. 목표는 12일마다 또는 점령 후 다시 고른다
function spearhead(G, C, fronts, usable, enemyPow, opts) {
  const tag = C.tag, map = G.map;
  if ((opts.aggr ?? 0) < 0.5) return null;
  const mob = usable.filter((D) => { const st = divStats(G, D); return st.armored || st.motorized; });
  if (mob.length < 3) return null;
  const AS = (C.aiState ||= {});
  const hold = AS.hold;
  let sp = AS.spear;
  const valid = sp && G.hour < sp.until && atWar(G, tag, G.st[sp.t].ctrl) && G.st[sp.from].ctrl === tag && fronts.includes(sp.from) && !(hold && hold[G.st[sp.t].ctrl] > G.hour);
  if (!valid) {
    sp = null; let best = 0;
    for (const f of fronts) {
      if (G.st[f].ctrl !== tag) continue;
      for (const v of map.nb[f]) {
        const c = G.st[v].ctrl;
        if (!atWar(G, tag, c) || (hold && hold[c] > G.hour)) continue;
        if (opts.enemy && c !== opts.enemy && !allied(G, opts.enemy, c)) continue;
        const e = map.edge(f, v); const river = e?.river === 2 ? 1.8 : e?.river ? 1.35 : 1;
        const def = enemyPow[v] * (TERR_DEF[map.terrain[v]] || 1) * (1 + 0.2 * (G.st[v].fort || 0)) * river;
        const terr = map.terrain[v];
        const bad = ['mountain', 'marsh', 'jungle', 'urban'].includes(terr) ? 0.5 : terr === 'forest' || terr === 'hills' ? 0.8 : 1;
        const val = (3 + (G.st[v].vp || 0) * 0.3 + (G.countries[c]?.capital === v ? 6 : 0)) * bad / (def + 300);
        if (val > best) { best = val; sp = { t: v, from: f }; }
      }
    }
    if (!sp) return null;
    sp.until = G.hour + 12 * 24;
    AS.spear = sp;
  }
  const ids = new Set();
  for (const D of mob) {
    ids.add(D.id);
    const dest = D.path.length ? D.path[D.path.length - 1] : D.loc;
    if (dest === sp.from || D.loc === sp.t) continue;
    orderMove(G, D, sp.from, 'friendly');
  }
  return { ids, sp };
}

// 해안 수비(대서양 방벽): 영·미와 싸우는 동안 그 항구에서 1,200km 안의 항구·주요 해안 주에 보병 수비대를 둔다.
// 배치는 C.aiState.guard(사단 → 주)에 남겨 매번 바꾸지 않는다
function coastGuard(G, C, usable, fronts) {
  const tag = C.tag, map = G.map;
  const AS = (C.aiState ||= {});
  // 대규모 상륙을 할 수 있는 해군국(영국·미국)만 위협으로 본다
  const foes = Object.keys(G.warRel[tag] || {}).filter((e) => (NAVAL_POWERS[e] || 0) >= 0.9 && G.countries[e]?.alive && !G.countries[e].capitulated);
  const bases = [];
  for (const e of foes) for (const i of G.ctrlBy?.[e] || []) if (i < map.nGeo && G.st[i].port > 0) bases.push(i);
  if (!bases.length) { AS.guard = null; return null; }
  const frontSet = new Set(fronts);
  const want = new Map(), prio = new Map();
  for (const i of G.ctrlBy?.[tag] || []) {
    const S = G.st[i];
    if (i >= map.nGeo || !map.coastal[i] || frontSet.has(i) || (!(S.port > 0) && (S.vp || 0) < 5)) continue;
    let d = Infinity; for (const b of bases) d = Math.min(d, map.dist(i, b));
    if (d > 1200) continue;
    want.set(i, (S.vp || 0) >= 10 ? 2 : 1);
    prio.set(i, (S.vp || 0) + (S.port > 0 ? 3 : 0) + (C.capital === i ? 10 : 0) + (1200 - d) / 200);
  }
  const y = yearFrac(G.hour);
  let foeDivs = 0; for (const e of foes) foeDivs += divsOf(G, e).length;
  const budget = Math.min(Math.round(usable.length * (y < 1941.5 ? 0.06 : y < 1943 ? 0.1 : 0.15)), Math.round(foeDivs * 0.6));
  const target = new Map(); let total = 0;
  for (const s of [...want.keys()].sort((a, b) => prio.get(b) - prio.get(a))) { if (total >= budget) break; const n = Math.min(want.get(s), budget - total); target.set(s, n); total += n; }
  const byId = new Map(usable.map((D) => [D.id, D]));
  const keep = {}, cnt = new Map();
  for (const id in AS.guard || {}) {
    const D = byId.get(+id), s = AS.guard[id];
    if (!D || !target.has(s) || (cnt.get(s) || 0) >= target.get(s)) continue;
    keep[id] = s; cnt.set(s, (cnt.get(s) || 0) + 1);
  }
  const comp = landComponents(map);
  let pool = null;
  for (const [s, n] of target) {
    let need = n - (cnt.get(s) || 0);
    if (need <= 0) continue;
    pool ||= usable.filter((D) => !(D.id in keep) && !divStats(G, D).motorized && !divStats(G, D).armored);
    // 전선 밖에 있는 가까운 보병부터
    const cands = pool.filter((D) => !(D.id in keep) && comp[D.loc] === comp[s]).sort((a, b) => (frontSet.has(a.loc) - frontSet.has(b.loc)) || map.dist(a.loc, s) - map.dist(b.loc, s));
    for (const D of cands) { if (need <= 0) break; keep[D.id] = s; need--; }
  }
  const ids = new Set();
  for (const id in keep) {
    const D = byId.get(+id), s = keep[id];
    const dest = D.path.length ? D.path[D.path.length - 1] : D.loc;
    if (dest !== s && !orderMove(G, D, s, 'friendly')) { delete keep[id]; continue; }
    ids.add(D.id);
  }
  AS.guard = keep;
  return ids;
}

// 과밀한 주 근처에서 보급 여유가 있는 아군 주 (최대 4칸)
function roomyRear(G, tag, from, occ, capDivs) {
  const map = G.map, so = G.supplyOf?.[tag];
  const seen = new Set([from]); let frontier = [from]; let best = -1, bs = -1;
  for (let depth = 0; depth < 4 && frontier.length; depth++) {
    const next = [];
    for (const u of frontier) for (const v of map.nb[u]) {
      if (seen.has(v) || !friendlyCtrl(G, tag, v)) continue;
      seen.add(v); next.push(v);
      if ((occ.get(v) || 0) >= capDivs(v)) continue;
      const sc = (so ? so[v] : 1) - depth * 0.05;
      if (sc > bs) { bs = sc; best = v; }
    }
    frontier = next;
  }
  return best;
}

function friendlyDistances(G, tag, src) {
  const map = G.map, n = map.n;
  const dist = new Float64Array(n).fill(Infinity);
  dist[src] = 0;
  const heap = new MinHeap(); heap.push(src, 0);
  while (heap.size) {
    const [u, du] = heap.pop();
    if (du > dist[u]) continue;
    for (const v of map.nb[u]) {
      if (!friendlyCtrl(G, tag, v)) continue;
      const nd = du + moveCost(G, u, v);
      if (nd < dist[v]) { dist[v] = nd; heap.push(v, nd); }
    }
  }
  return dist;
}

function offensive(G, C, fronts, usable, enemyPow, opts) {
  const tag = C.tag, map = G.map;
  const aggr = opts.aggr;
  let threshold = aggr >= 0.8 ? 1.15 : aggr >= 0.6 ? 1.3 : aggr >= 0.3 ? 1.6 : 2.2;
  // 전체 전력이 압도적이면 소모전을 감수하고 공격(포위된 적 거점 정리)
  let ours = 0, theirs = 0;
  for (const D of usable) ours += divPower(G, D);
  for (let i = 0; i < map.n; i++) theirs += enemyPow[i];
  if (theirs > 0 && ours / theirs >= 2.5) threshold *= 0.65;
  else if (theirs > 0 && ours / theirs >= 1.6) threshold *= 0.85;
  // 보충할 소총이 바닥나면 무리한 공세를 줄인다(병력 보존)
  {
    let field = 0; for (const D of usable) field += (divStats(G, D).eq.inf_eq || 0);
    if (field > 0 && (C.stock.inf_eq || 0) < field * 0.03) threshold *= 1.35;
  }
  // 교착: 공세적인 나라 가운데 전선에 맞닿은 적보다 전력이 대등하거나 우세한 쪽은, 마지막으로 땅을 빼앗은 지
  // (또는 전쟁이 시작된 지) 석 달이 넘으면 한 달에 5%씩, 최대 25%까지 문턱을 낮춘다
  // (밀리는 쪽은 무리한 반격을 하지 않고, 신중한 서방 연합국은 계획된 상륙 작전으로 움직인다)
  let near = 0;
  { const seen = new Set(); for (const f of fronts) for (const v of map.nb[f]) if (!seen.has(v)) { seen.add(v); near += enemyPow[v]; } }
  if (aggr >= 0.3 && !opts.counter && near > 0 && ours / near >= 0.9) {
    let since = C.aiState?.lastCap ?? 0;
    for (const w of G.wars) if ((w.att.includes(tag) || w.def.includes(tag)) && w.start > since) since = w.start;
    const months = (G.hour - since) / (24 * 30);
    if (months > 3) threshold *= Math.max(0.75, 1 - 0.05 * (months - 3));
  }
  // 반격(자동 방어): 유리할 때만 — 빼앗긴 우리·동맹국 땅을 되찾거나, 공세가 꺾인(조직력이 바닥난) 적을 국경 바로 너머까지 밀어낸다
  if (opts.counter) threshold = Math.max(threshold, 1.3);
  const counterOk = (v) => {
    const S = G.st[v];
    if (S.owner === tag || S.cores.includes(tag) || (allied(G, tag, S.owner) && G.countries[S.owner]?.alive)) return true;
    if (!map.nb[v].some((u) => G.st[u].owner === tag && G.st[u].ctrl === tag)) return false;
    let org = 0, max = 0;
    for (const id of G.divsAt[v] || []) { const E = G.divs[id]; if (E && atWar(G, tag, E.tag)) { org += E.org; max += divStats(G, E).org; } }
    return max > 0 && org / max < 0.4;
  };
  const targets = new Map();
  const hold = C.isAI ? C.aiState.hold : null;
  for (const f of fronts) for (const v of map.nb[f]) {
    if (!atWar(G, tag, G.st[v].ctrl)) continue;
    if (opts.enemy && G.st[v].ctrl !== opts.enemy && !allied(G, opts.enemy, G.st[v].ctrl)) continue;
    if (hold && hold[G.st[v].ctrl] > G.hour) continue; // 공세 보류(가짜 전쟁 등)
    if (opts.counter && !counterOk(v)) continue;
    if (!targets.has(v)) targets.set(v, []);
    targets.get(v).push(f);
  }
  // 이미 공격 중인(또는 진입 중인) 우리 사단: 같은 곳에 끝없이 쌓지 않는다
  const engaged = new Map();
  for (const id in G.divs) {
    const D = G.divs[id]; if (D.tag !== tag) continue;
    const t = D.att >= 0 ? D.att : D.path.length && atWar(G, tag, G.st[D.path[0]].ctrl) ? D.path[0] : -1;
    if (t < 0) continue;
    const e = engaged.get(t) || { n: 0, pow: 0, list: [] }; e.n++; e.pow += divPower(G, D) * (1 + D.plan); e.list.push(D); engaged.set(t, e);
  }
  // 너비를 크게 넘겨 쌓인 공격 사단은 전열에 있지 않은 것부터 풀어 준다
  for (const [t, e] of engaged) {
    const T = TERRAIN[map.terrain[t]] || TERRAIN.plains;
    const cap = Math.ceil((T.width + T.extra) / 18 * 3.5);
    if (e.n <= cap) continue;
    const fa = new Set(G.battles[t]?.fa || []);
    for (const D of e.list) { if (e.n <= cap) break; if (fa.has(D.id) || D.att < 0) continue; D.att = -1; D.path = []; D.prog = 0; e.n--; }
  }
  const busy = new Set();
  const list = [];
  for (const [t, from] of targets) {
    const S = G.st[t];
    const terr = TERR_DEF[map.terrain[t]] || 1;
    const fort = 1 + 0.2 * Math.max(0, (S.fort || 0) - (from.length - 1));
    let river = 1;
    for (const f of from) { const e = map.edge(f, t); if (e?.river === 2) river = Math.max(river, 1.8); else if (e?.river) river = Math.max(river, 1.35); }
    const def = enemyPow[t] * terr * fort * river;
    const atkDivs = [];
    for (const f of from) for (const id of G.divsAt[f] || []) {
      const D = G.divs[id];
      if (!D || D.tag !== tag || !usable.includes(D) || D.path.length) continue;
      const st = divStats(G, D);
      const maxNow = st.org * (1 + M(C, 'land.org')) * (D.sup < 0.25 ? 0.5 + 2 * D.sup : 1);
      if (D.org < maxNow * 0.75 || D.str < 0.5 || D.sup < 0.12) continue;
      atkDivs.push(D);
    }
    if (!atkDivs.length) continue;
    const pow = atkDivs.reduce((s, D) => s + divPower(G, D) * (1 + D.plan), 0);
    const ratio = def > 0 ? pow / def : 99;
    let score = ratio * (2 + (S.vp || 0) * 0.3 + (G.countries[S.ctrl]?.capital === t ? 15 : 0) + from.length * 1.5 + (S.cores.includes(tag) ? 4 : 0));
    if (opts.spear && opts.spear.t === t) score *= 5;
    // 포위 가능성: 적 주의 아군 이웃 비율
    const own = map.nb[t].filter((u) => G.st[u].ctrl === tag || allied(G, tag, G.st[u].ctrl)).length;
    score *= 1 + own / Math.max(1, map.nb[t].length);
    list.push({ t, from, def, ratio, score, atkDivs });
  }
  list.sort((a, b) => b.score - a.score);
  if (G.dbg) G.dbg('offensive', C.tag, { threshold, ours, theirs, fronts: fronts.length, usable: usable.length, list: list.slice(0, 12).map((o) => ({ t: map.key[o.t], ratio: +o.ratio.toFixed(2), def: Math.round(o.def), atk: o.atkDivs.length, score: +o.score.toFixed(1) })) });
  let launched = 0;
  const maxOps = Math.max(2, Math.ceil(fronts.length * (0.3 + aggr * 0.5)));
  let room = opts.room ?? Infinity;
  for (const o of list) {
    if (launched >= maxOps || room <= 0) break;
    if (o.ratio < threshold && o.def > 0) continue;
    // 공격 사단 선택: 남겨둘 방어 사단 고려
    const sending = [];
    const eng = engaged.get(o.t);
    // 전장 너비의 두 배(교대 병력 포함)를 넘게는 보내지 않는다
    const widthCap = Math.ceil(((TERRAIN[map.terrain[o.t]]?.width || 105) + (TERRAIN[map.terrain[o.t]]?.extra || 52) * (o.from.length - 1)) / 18 * 3);
    if (eng && eng.n >= widthCap) continue;
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
      if (o.def <= 0 && sending.length + (eng?.n || 0) >= 1) break;
      if (pow >= need || sending.length + (eng?.n || 0) >= widthCap) break;
    }
    if (!sending.length || (o.def > 0 && sending.length > room && pow < need)) continue;
    for (const D of sending) { D.path = [o.t]; D.prog = 0; busy.add(D.id); }
    room -= sending.length;
    launched++;
  }
}

function overseasReinforce(G, C, fronts, free, threat, desired, count, allyFront) {
  const tag = C.tag;
  if (C.capital < 0) return;
  const connected = friendlyDistances(G, tag, C.capital);
  const over = fronts.filter((f) => !isFinite(connected[f]));
  if (!over.length) return;
  // 이미 그 지역으로 항해 중인 사단도 셈에 넣는다(같은 곳에 끝없이 보내지 않게)
  const sailing = [];
  for (const id in G.divs) { const D = G.divs[id]; if (D.tag === tag && D.sea?.kind === 'move') sailing.push(D.sea.to); }
  // 본국 방위: 본토에 남은 사단이 전체의 35% 아래로 내려가면 더 보내지 않음
  let home = 0, total = 0;
  for (const id in G.divs) { const D = G.divs[id]; if (D.tag !== tag) continue; total++; if (!D.sea && isFinite(connected[D.loc])) home++; }
  if (home <= total * 0.35) return;
  // 해당 지역의 아군·동맹국 항구
  for (const f of over.sort((a, b) => threat.get(b) - threat.get(a))) {
    const local = friendlyDistances(G, tag, f);
    let port = -1, pd = Infinity;
    for (let i = 0; i < G.map.n; i++) if (isFinite(local[i]) && friendlyCtrl(G, tag, i) && G.st[i].port > 0 && local[i] < pd) { pd = local[i]; port = i; }
    if (port < 0) continue;
    let need = (desired.get(f) || 0) - (count.get(f) || 0) - sailing.filter((to) => isFinite(local[to])).length;
    // 해양 강국이 아니면 바다 건너 동맹국 전선에는 소규모 원정군(5개 사단)만
    if (allyFront?.has(f) && (NAVAL_POWERS[tag] || 0) < 0.9) {
      let there = sailing.filter((to) => isFinite(local[to])).length;
      for (const id in G.divs) { const D = G.divs[id]; if (D.tag === tag && !D.sea && isFinite(local[D.loc])) there++; }
      need = Math.min(need, 5 - there);
    }
    if (need <= 0) continue;
    let sent = 0;
    for (const D of free) {
      if (sent >= Math.min(3, need) || home - sent <= total * 0.35) break;
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
function repatriate(G, C, free, lacking, fronts) {
  const tag = C.tag, map = G.map;
  if (C.capital < 0) return;
  const home = friendlyDistances(G, tag, C.capital);
  if (!lacking.some((f) => isFinite(home[f]))) return;
  const myFronts = fronts; // 동맹국 전선(원정지)도 포함
  // 아군 영토로 이어진 지역별: 그 지역에 전선이 있으면 그대로 두고, 지역마다 1개 사단은 남긴다
  const region = new Map(); // 주 → { local, hot, kept }
  let sent = 0;
  for (const D of free) {
    if (D.sea || D.path.length || isFinite(home[D.loc])) continue;
    let R = region.get(D.loc);
    if (!R) {
      const local = friendlyDistances(G, tag, D.loc);
      R = { local, hot: myFronts.some((f) => isFinite(local[f])), kept: false };
      for (let i = 0; i < map.n; i++) if (isFinite(local[i])) region.set(i, R);
    }
    if (R.hot) continue;
    if (!R.kept) { R.kept = true; continue; }
    if (G.st[D.loc].port > 0 && G.st[D.loc].ctrl === tag) {
      const to = nearestPort(G, tag, D.loc, home);
      if (to < 0) continue;
      const tt = transportTime(G, tag, D.loc, to);
      if (tt == null) continue;
      D.sea = { kind: 'move', to, eta: G.hour + tt, from: D.loc };
      if (++sent >= 4) break;
    } else {
      const local = friendlyDistances(G, tag, D.loc);
      let port = -1, pd = Infinity;
      for (let i = 0; i < map.n; i++) if (isFinite(local[i]) && G.st[i].ctrl === tag && G.st[i].port > 0 && local[i] < pd) { pd = local[i]; port = i; }
      if (port >= 0 && port !== D.loc) orderMove(G, D, port, 'friendly');
    }
  }
}
function nearestPort(G, tag, from, connected) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < G.map.n; i++) if (G.st[i].ctrl === tag && G.st[i].port > 0 && isFinite(connected[i])) { const d = G.map.dist(from, i); if (d < bd) { bd = d; best = i; } }
  return best;
}

// ───────── 상륙 작전 ─────────
// 역사적 시기 제한(AI 전용): 영미의 유럽 상륙은 오버로드/이탈리아 전역 이후, 북아프리카는 횃불 작전 이후
function invasionAllowed(G, C, t) {
  const map = G.map, S = G.st[t];
  if (C.tag !== 'ENG' && C.tag !== 'USA') return true;
  const europe = map.lat[t] >= 36.4 && map.lon[t] > -12;
  if (!europe) return !!(G.flags.torch || G.hour >= hourOfDate(1942, 10, 15));
  const italy = (S.owner === 'ITA' || S.owner === 'RSI') && map.lat[t] < 46.5;
  if (italy) return G.hour >= hourOfDate(1943, 6, 15);
  return !!(G.flags.overlord || G.hour >= hourOfDate(1944, 5, 20));
}
function aiInvasion(G, C) {
  const tag = C.tag, map = G.map;
  const st = C.aiState;
  if (st.inv) {
    const T = G.st[st.inv.t];
    if (G.hour > st.inv.until || !atWar(G, tag, T.ctrl)) st.inv = null; // 성공했거나 시한 초과
  }
  // 놀고 있는 사단: 적과 맞닿지 않은 곳에서 대기 중. 지상 전선이 바쁘면 상륙은 미룬다
  const all = divsOf(G, tag);
  const guard = st.guard || {};
  const idle = all.filter((D) => !(D.id in guard) && !D.sea && !D.path.length && D.att < 0 && !D.retreat && D.str > 0.7 && !map.nb[D.loc].some((v) => atWar(G, tag, G.st[v].ctrl)));
  const fronts = frontStates(G, tag);
  if (idle.length < 6 || idle.length < all.length * 0.3 || (fronts.length && idle.length < fronts.length * 3)) { if (st.inv && !st.inv.sent) st.inv = null; return; }
  if (!st.inv) {
    // 육로로 닿는 곳(아군·적 영토를 따라)은 지상전에 맡긴다
    const reach = new Uint8Array(map.n), q = [];
    for (const i of G.ctrlBy?.[tag] || []) { reach[i] = 1; q.push(i); }
    for (let qi = 0; qi < q.length; qi++) for (const v of map.nb[q[qi]]) { if (reach[v]) continue; const c = G.st[v].ctrl; if (c === tag || allied(G, tag, c) || atWar(G, tag, c)) { reach[v] = 1; q.push(v); } }
    // 섬 단위(육지 연결 요소) — 적 강대국 본토 상륙은 압도적 전력일 때만
    const comp = landComponents(map);
    const ourNavy = navyPower(G, tag), enemyNavy = enemiesOf(G, tag).reduce((s, e) => s + navyPower(G, e), 0);
    let best = -1, bs = 0;
    for (let t = 0; t < map.nGeo; t++) {
      const S = G.st[t];
      if (!map.coastal[t] || !atWar(G, tag, S.ctrl) || reach[t]) continue;
      if (!invasionAllowed(G, C, t) || canInvade(G, tag, t)) continue;
      const T0 = G.countries[S.ctrl];
      if (T0?.major && T0.capital >= 0 && comp[T0.capital] === comp[t]) {
        let enemyDivs = 0; for (const id in G.divs) { const E = G.divs[id]; if (comp[E.loc] === comp[t] && atWar(G, tag, E.tag)) enemyDivs++; }
        if (idle.length < enemyDivs * 2 || ourNavy < enemyNavy * 0.8) continue;
      }
      const def = enemyDivsIn(G, tag, t).length;
      if (def > 4) continue;
      let near = 0; for (const v of map.nb[t]) if (atWar(G, tag, G.st[v].ctrl)) near += (G.divsAt[v] || []).length;
      const T = G.countries[S.ctrl];
      const sc = (S.vp || 0) * 2 + 4 + (S.port > 0 ? 6 : 0) + (T?.capital === t ? 10 : 0) - def * 5 - near * 0.8 + (map.nb[t].some((v) => allied(G, tag, G.st[v].ctrl)) ? 6 : 0);
      if (sc > bs) { bs = sc; best = t; }
    }
    if (best < 0) return;
    st.inv = { t: best, until: G.hour + 30 * 24, sent: 0 };
  }
  const t = st.inv.t;
  // 2주 동안 한 사단도 못 보냈으면(해로 차단 등) 포기
  if (!st.inv.sent && G.hour > st.inv.until - 16 * 24) { st.inv = null; return; }
  let sent = 0, staged = 0;
  const maxSend = Math.min(18, Math.floor(idle.length * 0.6));
  for (const D of idle) {
    if (sent >= maxSend) break;
    if (G.st[D.loc].port > 0 && G.st[D.loc].ctrl === tag) {
      const tt = transportTime(G, tag, D.loc, t);
      if (tt == null) continue;
      D.sea = { kind: 'invade', to: t, eta: G.hour + 5 * 24 + Math.round(tt), from: D.loc }; D.path = [];
      sent++;
    } else if (staged < 12) {
      const p = nearestPort(G, tag, D.loc, friendlyDistances(G, tag, D.loc));
      if (p >= 0 && p !== D.loc && transportTime(G, tag, p, t) != null && orderMove(G, D, p, 'friendly')) staged++;
    }
  }
  st.inv.sent += sent;
  if (sent) news(G, `${C.name}이(가) ${map.name[t]}에 상륙 작전을 개시합니다.`, { kind: 'war', tags: [tag, G.st[t].ctrl], st: t, big: sent >= 6 ? 1 : 0 });
}

function landComponents(map) {
  if (map._comp) return map._comp;
  const comp = new Int32Array(map.n).fill(-1); let id = 0;
  for (let s = 0; s < map.n; s++) {
    if (comp[s] >= 0) continue;
    const q = [s]; comp[s] = id;
    for (let qi = 0; qi < q.length; qi++) for (const v of map.nb[q[qi]]) if (comp[v] < 0) { comp[v] = id; q.push(v); }
    id++;
  }
  return (map._comp = comp);
}
function navyPower(G, tag) { let p = 0; for (const id in G.fleets) { const F = G.fleets[id]; if (F.tag === tag) p += fleetPower(G, F).atk; } return p; }

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

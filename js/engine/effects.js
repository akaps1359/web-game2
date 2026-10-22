// 효과·조건 해석기 (국가 중점·이벤트·결정 데이터에서 사용)
// 효과: [연산, ...인수] 배열의 목록. 조건도 같은 형식(모두 참이어야 함)
import { atWar, atWarAny, allied, news, hourOfDate, yearFrac } from './world.js';
import { addTension, declareWar, transferStates, annexCountry, setPuppet, createFaction, joinFaction, leaveFaction, signNap, grantAccess, civilWar, spawnCountry, relocateCapital, joinWar, warBetween, settleCapitulation, cleanupWars, capitulate, restoreGovernment } from './diplomacy.js';
import { rebuildWarCache } from './world.js';
import { addSpirit, removeSpirit, enactLaw } from './politics.js';
import { grantTech } from './research.js';
import { createDivision, getTpl, divStats } from './military.js';
import { stateSlots, stateUsedSlots } from './economy.js';
import { LAW_GROUPS } from '../data/ideas.js';

const idxOf = (G, k) => (typeof k === 'number' ? k : G.map.idx[k]);

export function addBuildings(G, C, type, n, key) {
  if (key) { const i = idxOf(G, key); if (i != null) G.st[i][type] = (G.st[i][type] || 0) + n; return; }
  for (let k = 0; k < n; k++) {
    let best = -1, bs = -Infinity;
    for (let i = 0; i < G.st.length; i++) {
      const S = G.st[i];
      if (S.owner !== C.tag || S.ctrl !== C.tag || !S.cores.includes(C.tag)) continue;
      if (type === 'dock' && !(S.port > 0)) continue;
      const free = stateSlots(G, C, i) - stateUsedSlots(S);
      if (['civ', 'mil', 'dock', 'ref'].includes(type) && free <= 0) continue;
      const sc = (G.map.props[i].ind ?? 0.5) + free * 0.1 + (type === 'infra' ? -(S.infra || 0) : 0);
      if (sc > bs) { bs = sc; best = i; }
    }
    if (best < 0) return;
    G.st[best][type] = Math.min(type === 'infra' ? 5 : 99, (G.st[best][type] || 0) + 1);
  }
}

export function applyEffects(G, C, fx, ctx = {}) {
  if (!fx) return;
  for (const e of fx) applyOne(G, C, e, ctx);
  C.modsDirty = true;
}

function T(G, t, C) { return t === 'THIS' || t == null ? C : G.countries[t]; }

function applyOne(G, C, e, ctx) {
  const op = e[0];
  const th = (x) => (x === 'THIS' ? C.tag : x);
  const a = th(e[1]), b = th(e[2]), c = th(e[3]);
  switch (op) {
    case 'pp': C.pp += a; break;
    case 'stab': C.baseStab += a; break;
    case 'ws': C.baseWs += a; break;
    case 'spirit': addSpirit(G, C, a, b, c); break;
    case 'rmSpirit': removeSpirit(G, C, a); break;
    case 'mods': C.extraMods = { ...(C.extraMods || {}) }; for (const k in a) C.extraMods[k] = (C.extraMods[k] || 0) + a[k]; break;
    case 'civ': case 'mil': case 'dock': case 'ref': case 'infra': addBuildings(G, C, op, a, b); break;
    case 'fort': { const i = idxOf(G, b); if (i != null) G.st[i].fort = Math.min(10, (G.st[i].fort || 0) + a); break; }
    case 'airbase': { const i = idxOf(G, b) ?? C.capital; if (i >= 0) G.st[i].air = Math.min(10, (G.st[i].air || 0) + a); break; }
    case 'rbonus': (C.rBonus ||= []).push({ cat: a, bonus: b, uses: c || 1 }); break;
    case 'tech': grantTech(G, C, a); break;
    case 'rslot': C.research.slots += a; while (C.research.cur.length < C.research.slots) C.research.cur.push(null); break;
    case 'claim': { for (const k of [].concat(a)) { const i = idxOf(G, k); if (i != null && !G.st[i].claims.includes(C.tag)) G.st[i].claims.push(C.tag); } break; }
    case 'core': { for (const k of [].concat(a)) { const i = idxOf(G, k); if (i != null && !G.st[i].cores.includes(C.tag)) G.st[i].cores.push(C.tag); } break; }
    case 'wargoal': { const t = a; if (G.countries[t]?.alive && !C.wargoals.some((w) => w.target === t)) C.wargoals.push({ target: t, type: 'conquer', forced: true }); break; }
    case 'annex': { const X = G.countries[a]; if (X?.alive) annexCountry(G, C.tag, a, { noTension: true }); break; }
    case 'annexBy': { const X = G.countries[b]; if (X?.alive) annexCountry(G, a, b, { noTension: true }); break; }
    case 'transfer': { const to = b === 'THIS' || b == null ? C.tag : b; transferStates(G, [].concat(a), to, { core: !!c }); break; }
    case 'puppet': { const X = G.countries[a]; if (X?.alive) setPuppet(G, C.tag, a); break; }
    case 'unpuppet': { const X = G.countries[a]; if (X) X.master = null; G._ally = null; break; }
    case 'war': { const t = a; if (G.countries[t]?.alive && !atWar(G, C.tag, t) && !allied(G, C.tag, t)) { if (C.naps) delete C.naps[t]; declareWar(G, C.tag, t, { forced: true, name: b, ...(c || {}) }); } break; }
    case 'warOn': { const att = a, def = b; if (G.countries[att]?.alive && G.countries[def]?.alive && !atWar(G, att, def)) { if (G.countries[att].naps) delete G.countries[att].naps[def]; declareWar(G, att, def, { forced: true, name: c, ...(e[4] || {}) }); } break; }
    case 'joinWarOf': { // [joinWarOf, ally, enemy]
      const w = warBetween(G, a, b); if (w) joinWar(G, w, C.tag, w.att.includes(a) ? 'att' : 'def'); break;
    }
    case 'createFaction': createFaction(G, C.tag, a); break;
    case 'joinFaction': { const L = G.countries[a]; if (L?.faction) joinFaction(G, C.tag, L.faction); break; }
    case 'addToFaction': { const X = G.countries[a]; if (X?.alive && C.faction) joinFaction(G, a, C.faction); break; }
    case 'leaveFaction': if (C.faction) leaveFaction(G, C.tag); break;
    case 'nap': if (G.countries[a]?.alive) signNap(G, C.tag, a, b || 48); break;
    case 'access': if (G.countries[a]?.alive) grantAccess(G, a, C.tag); break; // a가 C에게 통행권 허가
    case 'guaranteeFree': (C.guarantees ||= []).includes(a) || C.guarantees.push(a); break;
    case 'tension': addTension(G, a, C.tag); break;
    case 'ideology': C.pop[a] = Math.max(0, (C.pop[a] || 0) + b); { let s = 0; for (const k in C.pop) s += C.pop[k]; for (const k in C.pop) C.pop[k] /= s; } break;
    case 'gov': Object.assign(C, a); C.modsDirty = true; break; // {ideology, leader, title, gov, party}
    case 'flag': G.flags[a] = b ?? G.hour; break;
    case 'cflag': (C.flags ||= {})[a] = b ?? G.hour; break;
    case 'equip': C.stock[a] = Math.max(0, (C.stock[a] || 0) + b); break;
    case 'manpower': C.mp.total += a; C.mp.bonus = (C.mp.bonus || 0) + a; break;
    case 'fuel': C.fuel = (C.fuel || 0) + a; break;
    case 'law': { // 징병·경제 법은 효과로 내려가지 않는다(늦게 끝난 중점이 이미 올린 법을 되돌리지 않도록)
      const ord = a !== 'trade' && LAW_GROUPS[a]?.order;
      if (ord && ord.indexOf(b) < ord.indexOf(C.laws[a])) break;
      enactLaw(G, C, a, b, true); break;
    }
    case 'unlock': C.unlock[a] = 1; C.techVer++; break;
    case 'demil': { const i = idxOf(G, a); if (i != null) G.st[i].demil = b ?? 0; break; }
    case 'demilAll': for (const S of G.st) if (S.owner === C.tag) S.demil = 0; break;
    case 'news': news(G, a.replace(/\{country\}/g, C.name).replace(/\{leader\}/g, C.leader), { kind: 'event', tags: [C.tag], big: b ? 1 : 0 }); break;
    case 'event': G.queueEvent(a, b || C.tag, c || 0); break;
    case 'units': {
      for (const [tplKey, n, loc] of a) {
        let tpl = C.templates.find((t) => t.key === tplKey) || C.templates[0];
        let li = loc ? idxOf(G, loc) : C.capital;
        if (li == null || li < 0 || G.st[li].ctrl !== C.tag) li = C.capital >= 0 && G.st[C.capital].ctrl === C.tag ? C.capital : G.st.findIndex((S) => S.ctrl === C.tag && S.owner === C.tag);
        if (li == null || li < 0) continue;
        for (let k = 0; k < n; k++) { const D = createDivision(G, C.tag, tpl.id, li, { xp: 0.2 }); (G.divsAt[li] ||= []).push(D.id); }
      }
      break;
    }
    case 'civilWar': civilWar(G, C.tag, a, b, c || {}); break;
    case 'spawn': spawnCountry(G, a, b, c || {}); break;
    case 'capital': { const i = idxOf(G, a); if (i != null && G.st[i].owner === C.tag) C.capital = i; break; }
    case 'relocateCapital': relocateCapital(G, C); break;
    case 'shock': { // 기습: [조직력 배율, 전력 배율, 항공기 배율] — 준비되지 않은 군대
      for (const id in G.divs) {
        const D = G.divs[id]; if (D.tag !== C.tag) continue;
        D.org *= a;
        if (b != null && b < 1) { const lost = D.str * (1 - b); D.str -= lost; C.mp.dead += divStats(G, D).mp * lost; }
      }
      if (c != null) for (const id in G.wings) { const W = G.wings[id]; if (W.tag === C.tag) W.n = Math.floor(W.n * c); }
      break;
    }
    case 'xp': break;
    case 'opinion': break;
    case 'popAdd': C.pop[a] = (C.pop[a] || 0) + b; break;
    case 'aiPlan': (C.aiState ||= {})[a] = b; break;
    case 'if': if (checkTrigger(G, C, a)) applyEffects(G, C, b, ctx); else if (c) applyEffects(G, C, c, ctx); break;
    case 'for': { const X = G.countries[a]; if (X?.alive || b?.[0]?.[0] === 'spawn') applyEffects(G, X || C, b, ctx); break; }
    case 'random': { const r = G.rng(); if (r < a) applyEffects(G, C, b, ctx); else if (c) applyEffects(G, C, c, ctx); break; }
    // 새 국가를 세우고 괴뢰국으로 둔다: [spawnPuppet, 태그, [주], 종주국(생략 시 THIS)]
    case 'spawnPuppet': { const N = spawnCountry(G, a, [].concat(b).filter((k) => idxOf(G, k) != null)); const m = c || C.tag; if (G.countries[m]?.alive && m !== a) setPuppet(G, m, a); N.isAI = G.player !== a; break; }
    // 두 나라 사이의 전쟁만 끝낸다(다른 참전국은 계속): [peace, 상대]
    case 'peace': { endWarPair(G, C.tag, a); break; }
    // 이 나라가 모든 전쟁에서 빠진다
    case 'leaveWar': { for (const w of G.wars) { w.att = w.att.filter((t) => t !== C.tag); w.def = w.def.filter((t) => t !== C.tag); } returnOccupied(G, C.tag); rebuildWarCache(G); cleanupWars(G); G.mapDirty = true; break; }
    // 영토 할양(소유국과 무관): [cede, [주], 받는 나라]
    case 'cede': { const to = b || C.tag; if (!G.countries[to]?.alive) break; transferStates(G, [].concat(a).filter((k) => idxOf(G, k) != null), to, { core: !!c }); break; }
    // 플레이어가 이 나라라면 다른 나라로 갈아탄다
    case 'playAs': if (G.player === C.tag && G.countries[a]?.alive) { for (const t in G.countries) G.countries[t].isAI = t !== a; G.player = a; G.onPlayerChange?.(a); } break;
    // 항복 처리: [settleCap, 승전국, 옵션]
    case 'settleCap': {
      const enemies = Object.keys(G.warRel[C.tag] || {});
      const v = a && G.countries[a]?.alive ? a : G.capVictor && G.countries[G.capVictor]?.alive ? G.capVictor : enemies[0];
      if (v) settleCapitulation(G, C.tag, v, enemies, b || {});
      break;
    }
    // AI가 지정일 이후에 쓰는 전쟁 목표
    // AI가 지정일 이후 실행할 전쟁 목표: [wargoalAt, 대상, '1939-09-01' | {at, name, force}]
    case 'wargoalAt': {
      if (!G.countries[a]?.alive) break;
      const o = typeof b === 'object' && b ? b : { at: b };
      C.wargoals = C.wargoals.filter((w) => w.target !== a);
      C.wargoals.push({ target: a, type: 'conquer', forced: true, after: hourOf(o.at), force: o.force !== false, name: o.name });
      break;
    }
    case 'guarantee': if (G.countries[a]?.alive) { (C.guarantees ||= []); if (!C.guarantees.includes(a)) C.guarantees.push(a); } break;
    case 'fleetsTo': { for (const id in G.fleets) { const F = G.fleets[id]; if (F.tag === C.tag) { F.tag = a; F.mission = 'idle'; F.reserve = false; } } break; }
    case 'stockTo': { const X = G.countries[a]; if (X) for (const k in C.stock) { const amt = C.stock[k] * (b ?? 0.5); X.stock[k] = (X.stock[k] || 0) + amt; C.stock[k] -= amt; } break; }
    // 현재 이 나라가 통제 중인 주만 골라 새 나라로: [spawnCtrl, 태그, [주], 종주국?]
    case 'spawnCtrl': {
      const keys = [].concat(b).filter((k) => { const i = idxOf(G, k); return i != null && G.st[i].owner === C.tag && G.st[i].ctrl === C.tag; });
      if (!keys.length) break;
      const N = spawnCountry(G, a, keys); if (c && G.countries[c]?.alive) setPuppet(G, c, a); N.isAI = G.player !== a; break;
    }
    case 'breakNap': { const X = G.countries[a]; if (C.naps) delete C.naps[a]; if (X?.naps) delete X.naps[C.tag]; break; }
    case 'offmapAdd': { C.offmap ||= { civ: 0, mil: 0, dock: 0, res: {} }; C.offmap[a] = (C.offmap[a] || 0) + b; break; }
    // 국경 주 중 이웃 수가 많은 n개에 요새 +lv: [fortBorder, n, lv, 상대국?]
    case 'fortBorder': {
      const map = G.map; const rows = [];
      for (let i = 0; i < map.nGeo; i++) { const S = G.st[i]; if (S.owner !== C.tag || S.ctrl !== C.tag) continue; const k = map.nb[i].filter((v) => G.st[v].owner !== C.tag && (!c || G.st[v].owner === c)).length; if (k) rows.push([i, k + (S.vp || 0) * 0.1]); }
      rows.sort((x, y) => y[1] - x[1]);
      for (const [i] of rows.slice(0, a)) G.st[i].fort = Math.max(G.st[i].fort || 0, Math.min(4, (G.st[i].fort || 0) + (b || 1)));
      break;
    }
    // 각본 상륙: [amphib, {주: 사단 수}] — 전선에 있지 않은 아군 사단을 해상·공수로 해당 주에 투입(제해권 무시)
    case 'amphib': {
      const pool = [];
      for (const id in G.divs) { const D = G.divs[id]; if (D.tag === C.tag && !D.sea && D.att < 0 && !D.retreat && !G.map.nb[D.loc].some((v) => atWar(G, C.tag, G.st[v].ctrl))) pool.push(D); }
      pool.sort((x, y) => y.str + y.org / 100 - (x.str + x.org / 100));
      let k = 0;
      for (const key in a) {
        const i = idxOf(G, key); if (i == null) continue;
        for (let n = 0; n < a[key] && pool.length; n++) { const D = pool.shift(); D.path = []; D.prog = 0; D.sea = { kind: 'invade', to: i, eta: G.hour + 12 + (k++ % 6) * 2, from: D.loc }; }
      }
      break;
    }
    // 원정 파견: [deploy, 사단 수, 주, 'mob'] — 전선에 있지 않은 사단을 바다 건너 동맹국 항구로 보낸다(아프리카 군단 등)
    case 'deploy': {
      const to = idxOf(G, b); if (to == null) break;
      const pool = [];
      for (const id in G.divs) { const D = G.divs[id]; if (D.tag === C.tag && !D.sea && D.att < 0 && !D.retreat && !G.map.nb[D.loc].some((v) => atWar(G, C.tag, G.st[v].ctrl))) pool.push(D); }
      const mob = (D) => { const st = G.countries[D.tag].templates.find((t) => t.id === D.tpl); return st && (st.bats.lt || st.bats.mt || st.bats.ht || st.bats.mot) ? 1 : 0; };
      pool.sort((x, y) => (c === 'mob' ? mob(y) - mob(x) : 0) || y.str - x.str);
      for (const D of pool.slice(0, a)) { D.path = []; D.prog = 0; D.sea = { kind: 'move', to, eta: G.hour + 72, from: D.loc }; }
      C.aiState ||= {}; C.aiState.anchors = [...new Set([...(C.aiState.anchors || []), to])];
      break;
    }
    // 망명 정부가 영토를 되찾아 복귀: [returnGov, 수도]
    case 'returnGov': { if (a) { const i = idxOf(G, a); if (i != null && G.st[i].owner === C.tag) C.capital = i; } restoreGovernment(G, C, G.factions[C.faction]?.leader); break; }
    // 강제 항복(정부 붕괴 등)
    case 'capitulate': if (G.warRel[C.tag] && Object.keys(G.warRel[C.tag]).length) capitulate(G, C.tag); break;
    // AI 공세 보류: [aiHold, [태그], '1940-05-10']
    case 'aiHold': {
      C.aiState ||= {}; C.aiState.hold ||= {};
      const tags = [].concat(a);
      for (const t of tags) C.aiState.hold[t] = hourOf(b);
      // 진행 중인 공격도 멈춘다
      if (C.isAI) for (const id in G.divs) { const D = G.divs[id]; if (D.tag !== C.tag) continue; const tgt = D.att >= 0 ? D.att : D.path[0]; if (tgt != null && tags.includes(G.st[tgt].ctrl)) { D.att = -1; D.path = []; D.prog = 0; } }
      break;
    }
    case 'removeWargoal': C.wargoals = C.wargoals.filter((w) => w.target !== a); C.justify = C.justify.filter((j) => j.target !== a); break;
    case 'ownCores': { // 자국이 통제 중인 이 나라 핵심 주를 소유
      for (const S of G.st) if (S.cores.includes(a) && S.ctrl === C.tag && S.owner !== C.tag) S.owner = C.tag; G.mapDirty = true; G.indexDirty = true; break;
    }
    default: console.warn('unknown effect', op);
  }
}

const hourOf = (d) => { if (!d) return 0; const [y, m, dd] = d.split('-').map(Number); return hourOfDate(y, m, dd); };

// 두 나라 사이 전쟁 종료: 둘만 남은 전쟁이면 전쟁 자체를 끝내고, 아니면 한쪽을 빼낸다
function endWarPair(G, a, b) {
  const w = warBetween(G, a, b); if (!w) return;
  const sideA = w.att.includes(a) ? 'att' : 'def';
  const mine = w[sideA], theirs = w[sideA === 'att' ? 'def' : 'att'];
  if (mine.length <= 1 || theirs.length <= 1) {
    const leaving = mine.length <= 1 ? a : b;
    w.att = w.att.filter((t) => t !== leaving); w.def = w.def.filter((t) => t !== leaving);
  } else { w.att = w.att.filter((t) => t !== a); w.def = w.def.filter((t) => t !== a); }
  rebuildWarCache(G);
  returnOccupied(G, a); returnOccupied(G, b);
  cleanupWars(G);
  G.mapDirty = true;
}
// 더 이상 전쟁 중이 아닌 점령지는 원래 소유국에게
function returnOccupied(G, tag) {
  for (const S of G.st) {
    if (S.ctrl === S.owner) continue;
    if ((S.owner === tag || S.ctrl === tag) && !atWar(G, S.ctrl, S.owner) && G.countries[S.owner]?.alive) { S.ctrl = S.owner; S.ctrlSince = G.hour; }
  }
  G.indexDirty = true;
}

export function checkTrigger(G, C, trig) {
  if (!trig) return true;
  for (const t of trig) if (!checkOne(G, C, t)) return false;
  return true;
}
function checkOne(G, C, t) {
  const op = t[0];
  const th = (x) => (x === 'THIS' ? C.tag : x);
  const a = th(t[1]), b = th(t[2]), c = t[3];
  const idx = (k) => idxOf(G, k);
  switch (op) {
    case 'after': { const [y, m, d] = a.split('-').map(Number); return G.hour >= hourOfDate(y, m, d); }
    case 'before': { const [y, m, d] = a.split('-').map(Number); return G.hour < hourOfDate(y, m, d); }
    case 'year': return yearFrac(G.hour) >= a;
    case 'tag': return C.tag === a;
    case 'flag': return G.flags[a] != null;
    case 'notFlag': return G.flags[a] == null;
    case 'cflag': return (T(G, b, C)?.flags || {})[a] != null;
    case 'focus': return !!G.countries[b || C.tag]?.focus.done[a];
    case 'atWar': return b ? atWar(G, a, b) : atWarAny(G, a === 'THIS' ? C.tag : a);
    case 'notAtWar': return b ? !atWar(G, a, b) : !atWarAny(G, a === 'THIS' ? C.tag : a);
    case 'controls': { const X = a === 'THIS' ? C.tag : a; return [].concat(b).every((k) => G.st[idx(k)]?.ctrl === X); }
    case 'controlsAny': { const X = a === 'THIS' ? C.tag : a; return [].concat(b).some((k) => G.st[idx(k)]?.ctrl === X); }
    case 'owns': { const X = a === 'THIS' ? C.tag : a; return [].concat(b).every((k) => G.st[idx(k)]?.owner === X); }
    case 'alive': return !!G.countries[a]?.alive && !G.countries[a].capitulated;
    case 'dead': return !G.countries[a]?.alive || !!G.countries[a].capitulated;
    case 'exists': return !!G.countries[a]?.alive;
    case 'tension': return G.tension >= a;
    case 'tensionBelow': return G.tension < a;
    case 'faction': { const X = G.countries[a === 'THIS' ? C.tag : a]; return b ? X?.faction === b : !!X?.faction; }
    case 'noFaction': return !G.countries[a === 'THIS' ? C.tag : a]?.faction;
    case 'ideology': return G.countries[a === 'THIS' ? C.tag : a]?.ideology === b;
    case 'isAI': return G.countries[a]?.isAI !== false;
    case 'isPlayer': return G.player === a;
    case 'puppetOf': return G.countries[a]?.master === b;
    case 'surrender': return (G.countries[a]?.surrender || 0) >= b;
    case 'ws': return C.warSupport >= a;
    case 'stab': return C.stability >= a;
    case 'pp': return C.pp >= a;
    case 'random': return G.rng() < a;
    case 'or': return a.some((x) => checkOne(G, C, x));
    case 'not': return !checkOne(G, C, a);
    case 'and': return a.every((x) => checkOne(G, C, x));
    case 'allied': return allied(G, a, b);
    case 'hasWargoal': return C.wargoals.some((w) => w.target === a);
    case 'fired': return !!G.events.fired[a + ':' + (b || C.tag)];
    case 'notFired': return !G.events.fired[a + ':' + (b || C.tag)];
    case 'master': return G.countries[a === 'THIS' ? C.tag : a]?.master === b;
    case 'notPuppet': return !G.countries[a === 'THIS' ? C.tag : a]?.master;
    case 'controlsCount': { // [controlsCount, 나라, [주], 최소 개수]
      const X = a === 'THIS' ? C.tag : a; let n = 0; for (const k of [].concat(b)) if (G.st[idx(k)]?.ctrl === X) n++; return n >= c;
    }
    case 'enemyControls': { // [enemyControls, 나라, [주]] — 그 나라의 적이 하나라도 통제
      const X = a === 'THIS' ? C.tag : a; return [].concat(b).some((k) => { const S = G.st[idx(k)]; return S && S.ctrl !== X && atWar(G, X, S.ctrl); });
    }
    case 'player': return G.player === (a === 'THIS' ? C.tag : a);
    case 'spirit': return C.spirits.some((x) => x.id === a);
    case 'leader': return G.countries[b || C.tag]?.leader === a;
    case 'major': return !!G.countries[a]?.major;
    case 'numDivsRatio': { // [numDivsRatio, other, ratio] 자국 사단 수 / 상대 사단 수 ≥ ratio
      let mine = 0, theirs = 0; for (const id in G.divs) { const D = G.divs[id]; if (D.tag === C.tag) mine++; else if (D.tag === a) theirs++; } return mine >= theirs * b;
    }
    default: console.warn('unknown trigger', op); return false;
  }
}

// 조건을 사람이 읽을 수 있는 문장으로 (UI 표시용)
export function describeTrigger(G, trig) {
  if (!trig) return [];
  const nm = (t) => G.countries[t]?.name || t;
  const st = (k) => G.map.name[idxOf(G, k)] || k;
  return trig.map((t) => {
    const [op, a, b] = t;
    switch (op) {
      case 'after': return `${a.replace(/-/g, '.')} 이후`;
      case 'before': return `${a.replace(/-/g, '.')} 이전`;
      case 'focus': return `중점 완료: ${a}`;
      case 'atWar': return b ? `${nm(a)}와(과) ${nm(b)}가 전쟁 중` : `${nm(a)} 전쟁 중`;
      case 'notAtWar': return b ? `${nm(a)}와(과) ${nm(b)}가 평화` : `${nm(a)} 평화 상태`;
      case 'controls': return `${nm(a)}이(가) ${[].concat(b).map(st).join(', ')} 통제`;
      case 'owns': return `${nm(a)}이(가) ${[].concat(b).map(st).join(', ')} 소유`;
      case 'alive': return `${nm(a)} 존재`;
      case 'dead': return `${nm(a)} 소멸 또는 항복`;
      case 'tension': return `세계 긴장도 ${Math.round(a * 100)}% 이상`;
      case 'faction': return b ? `${nm(a)}이(가) 진영 소속` : `${nm(a)} 진영 소속`;
      case 'noFaction': return `${nm(a)} 진영 없음`;
      case 'ideology': return `${nm(a)} 이념: ${b}`;
      case 'ws': return `전쟁 지지도 ${Math.round(a * 100)}% 이상`;
      case 'or': return '다음 중 하나: ' + describeTrigger(G, a).join(' / ');
      case 'not': return '아님: ' + describeTrigger(G, [a]).join('');
      default: return op;
    }
  });
}

// 효과·조건 해석기 (국가 중점·이벤트·결정 데이터에서 사용)
// 효과: [연산, ...인수] 배열의 목록. 조건도 같은 형식(모두 참이어야 함)
import { atWar, atWarAny, allied, news, hourOfDate, yearFrac } from './world.js';
import { addTension, declareWar, transferStates, annexCountry, setPuppet, createFaction, joinFaction, leaveFaction, signNap, grantAccess, civilWar, spawnCountry, relocateCapital, joinWar, warBetween } from './diplomacy.js';
import { addSpirit, removeSpirit, enactLaw } from './politics.js';
import { grantTech } from './research.js';
import { createDivision, getTpl } from './military.js';
import { stateSlots, stateUsedSlots } from './economy.js';

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
  const [op, a, b, c] = e;
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
    case 'unpuppet': { const X = G.countries[a]; if (X) X.master = null; break; }
    case 'war': { const t = a; if (G.countries[t]?.alive && !atWar(G, C.tag, t) && !allied(G, C.tag, t)) declareWar(G, C.tag, t, { forced: true, name: b }); break; }
    case 'warOn': { const att = a, def = b; if (G.countries[att]?.alive && G.countries[def]?.alive && !atWar(G, att, def)) declareWar(G, att, def, { forced: true, name: c }); break; }
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
    case 'equip': C.stock[a] = (C.stock[a] || 0) + b; break;
    case 'manpower': C.mp.total += a; C.mp.bonus = (C.mp.bonus || 0) + a; break;
    case 'fuel': C.fuel = (C.fuel || 0) + a; break;
    case 'law': enactLaw(G, C, a, b, true); break;
    case 'unlock': C.unlock[a] = 1; C.techVer++; break;
    case 'demil': { const i = idxOf(G, a); if (i != null) G.st[i].demil = b ?? 0; break; }
    case 'demilAll': for (const S of G.st) if (S.owner === C.tag) S.demil = 0; break;
    case 'news': news(G, a, { kind: 'event', tags: [C.tag], big: b ? 1 : 0 }); break;
    case 'event': G.queueEvent(a, b || C.tag, c || 0); break;
    case 'units': {
      for (const [tplKey, n, loc] of a) {
        let tpl = C.templates.find((t) => t.key === tplKey) || C.templates[0];
        const li = loc ? idxOf(G, loc) : C.capital;
        if (li == null || li < 0) continue;
        for (let k = 0; k < n; k++) { const D = createDivision(G, C.tag, tpl.id, li, { xp: 0.2 }); (G.divsAt[li] ||= []).push(D.id); }
      }
      break;
    }
    case 'civilWar': civilWar(G, C.tag, a, b, c || {}); break;
    case 'spawn': spawnCountry(G, a, b, c || {}); break;
    case 'capital': { const i = idxOf(G, a); if (i != null && G.st[i].owner === C.tag) C.capital = i; break; }
    case 'relocateCapital': relocateCapital(G, C); break;
    case 'xp': break;
    case 'opinion': break;
    case 'popAdd': C.pop[a] = (C.pop[a] || 0) + b; break;
    case 'aiPlan': (C.aiState ||= {})[a] = b; break;
    case 'if': if (checkTrigger(G, C, a)) applyEffects(G, C, b, ctx); else if (c) applyEffects(G, C, c, ctx); break;
    case 'for': { const X = G.countries[a]; if (X?.alive || b?.[0]?.[0] === 'spawn') applyEffects(G, X || C, b, ctx); break; }
    case 'random': { const r = G.rng(); if (r < a) applyEffects(G, C, b, ctx); else if (c) applyEffects(G, C, c, ctx); break; }
    default: console.warn('unknown effect', op);
  }
}

export function checkTrigger(G, C, trig) {
  if (!trig) return true;
  for (const t of trig) if (!checkOne(G, C, t)) return false;
  return true;
}
function checkOne(G, C, t) {
  const [op, a, b, c] = t;
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

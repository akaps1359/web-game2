// 정치: 정치력·안정도·전쟁 지지도·이념·법률·고문·결정·국가 중점
import { LAW_GROUPS, LAW_COST, ADVISOR_ROLES, ADVISOR_SLOTS, ADVISOR_COST, SPIRITS, DECISIONS } from '../data/ideas.js';
import { M } from './mods.js';
import { atWarAny, news } from './world.js';
import { warsOf } from './diplomacy.js';
import { applyEffects, checkTrigger } from './effects.js';

export const FOCUS_DAYS = 70;

export function dailyPolitics(G, C) {
  // 국가 정신 만료
  for (let i = 0; i < C.spirits.length; i++) { const s = C.spirits[i]; if (s.until && s.until <= G.hour) { C.spirits.splice(i--, 1); C.modsDirty = true; } }
  // 안정도·전쟁 지지도 (기본값 + 수정치)
  const atWar = atWarAny(G, C.tag);
  const ruling = C.pop[C.ideology] ?? 0.5;
  let stab = C.baseStab + M(C, 'stability') + (ruling - 0.5) * 0.15;
  let ws = C.baseWs + M(C, 'warSupport') + G.tension * (C.ideology === 'dem' ? 0.25 : 0.35);
  if (atWar) {
    const defensive = warsOf(G, C.tag).some((w) => w.def.includes(C.tag));
    ws += defensive ? 0.15 : C.ideology === 'dem' ? -0.15 : 0;
    stab -= 0.12 * (1 - Math.min(1, ws));
    // 사상자
    const casRatio = (C.stats.casualties || 0) / Math.max(1, C.mp.total + C.mp.inDivs + C.mp.dead);
    ws -= Math.min(0.3, casRatio * 0.5);
  }
  if (C.capital >= 0 && G.st[C.capital].ctrl !== C.tag) stab -= 0.15;
  C.stability = Math.max(0, Math.min(1, stab));
  C.warSupport = Math.max(0, Math.min(1, ws));
  // 정치력
  const stabPP = C.stability >= 0.5 ? (C.stability - 0.5) * 0.2 : (C.stability - 0.5) * 0.4;
  const gain = (2 + M(C, 'pp')) * Math.max(0.1, 1 + M(C, 'ppFactor') + stabPP);
  C.ppGain = gain;
  C.pp = Math.min(2000, C.pp + gain);
  // 이념 지지율: 집권당 쪽으로 소폭 이동
  const drift = 0.0004 + (M(C, 'drift') || 0);
  for (const k in C.pop) {
    if (k === C.ideology) C.pop[k] = Math.min(1, C.pop[k] + drift);
    else C.pop[k] = Math.max(0, C.pop[k] - drift / 3);
  }
  normalizePop(C);
  // 국가 중점
  const F = C.focus;
  if (F.cur) {
    F.prog += 1 + M(C, 'focusSpeed');
    const node = G.focusNode(C, F.cur);
    const need = node ? (node.days || FOCUS_DAYS) : FOCUS_DAYS;
    if (!node) { F.cur = null; F.prog = 0; }
    else if (F.prog >= need) completeFocus(G, C, node);
  }
}

export function normalizePop(C) {
  let s = 0; for (const k in C.pop) s += C.pop[k];
  if (s > 0) for (const k in C.pop) C.pop[k] /= s;
}

export function completeFocus(G, C, node) {
  const F = C.focus;
  F.done[node.id] = 1; F.cur = null; F.prog = 0;
  if (C.major || C.tag === G.player) news(G, `${C.name}: 국가 중점 「${node.name}」 완료`, { kind: 'focus', tags: [C.tag], quiet: C.tag !== G.player });
  applyEffects(G, C, node.fx || [], { src: 'focus:' + node.id });
  C.modsDirty = true;
  if (G.onFocusDone) G.onFocusDone(C, node);
}

// 중점 선택 가능 여부 → null 가능 / 사유
export function focusBlocked(G, C, node) {
  if (!node) return '없음';
  if (C.focus.done[node.id]) return '완료됨';
  if (C.focus.cur === node.id) return '진행 중';
  if (node.req && !node.req.every((r) => (Array.isArray(r) ? r.some((x) => C.focus.done[x]) : C.focus.done[r]))) return '선행 중점 필요';
  if (node.excl && node.excl.some((x) => C.focus.done[x] || C.focus.cur === x)) return '상호 배타 중점 선택됨';
  if (node.avail && !checkTrigger(G, C, node.avail)) return node.availText || '조건 미충족';
  return null;
}
export function selectFocus(G, C, id) {
  const node = G.focusNode(C, id);
  if (focusBlocked(G, C, node)) return false;
  if (C.focus.cur && C.focus.cur !== id) C.focus.prog = 0;
  C.focus.cur = id;
  return true;
}

// ───────── 법률 ─────────
export function lawBlocked(G, C, group, id) {
  const L = LAW_GROUPS[group]?.laws[id];
  if (!L) return '없음';
  if (C.laws[group] === id) return '현재 법률';
  if (C.pp < LAW_COST) return `정치력 ${LAW_COST} 필요`;
  const r = L.req || {};
  const war = atWarAny(G, C.tag);
  if (r.ws && C.warSupport < r.ws) return `전쟁 지지도 ${Math.round(r.ws * 100)}% 필요`;
  if (r.war && !war) return '전쟁 중이어야 함';
  if (r.warOrFas && !war && C.ideology === 'dem') return '전쟁 중이거나 비민주 국가';
  if (r.tension && C.ideology === 'dem' && G.tension < (r.demTension ?? r.tension) && !war) return `세계 긴장도 ${Math.round((r.demTension ?? r.tension) * 100)}% 필요`;
  if (group === 'economy' && id === 'isolation') return '이벤트로만';
  if (group === 'conscription' && id === 'disarmed') return '이벤트로만';
  return null;
}
export function enactLaw(G, C, group, id, free = false) {
  if (!free && lawBlocked(G, C, group, id)) return false;
  if (!free) C.pp -= LAW_COST;
  C.laws[group] = id;
  C.modsDirty = true;
  return true;
}

// ───────── 고문 ─────────
export function advisorBlocked(G, C, role) {
  const R = ADVISOR_ROLES[role]; if (!R) return '없음';
  const slot = R.slot;
  const cur = C.advisors[slot];
  if (slot === 'pol') { if (cur.includes(role)) return '이미 임명'; if (cur.length >= ADVISOR_SLOTS.pol) return '빈 자리 없음(해임 필요)'; }
  else if (cur === role) return '이미 임명';
  if (C.pp < ADVISOR_COST) return `정치력 ${ADVISOR_COST} 필요`;
  if (C.firedAdvisors?.[role]) return '해임된 고문';
  return null;
}
export function hireAdvisor(G, C, role) {
  if (advisorBlocked(G, C, role)) return false;
  const slot = ADVISOR_ROLES[role].slot;
  C.pp -= ADVISOR_COST;
  if (slot === 'pol') C.advisors.pol.push(role); else C.advisors[slot] = role;
  C.modsDirty = true;
  return true;
}
export function fireAdvisor(G, C, role) {
  const slot = ADVISOR_ROLES[role].slot;
  if (slot === 'pol') C.advisors.pol = C.advisors.pol.filter((r) => r !== role); else if (C.advisors[slot] === role) C.advisors[slot] = null;
  C.modsDirty = true;
}
export function advisorName(C, role) { return C.advisorNames?.[role] || ADVISOR_ROLES[role].name; }

// ───────── 국가 정신 ─────────
export function addSpirit(G, C, id, days, mods) {
  const ex = C.spirits.find((s) => s.id === id);
  const until = days ? G.hour + days * 24 : 0;
  if (ex) { if (until) ex.until = Math.max(ex.until || 0, until); else ex.until = 0; }
  else C.spirits.push({ id, until, ...(mods ? { mods } : {}) });
  C.modsDirty = true;
}
export function removeSpirit(G, C, id) { C.spirits = C.spirits.filter((s) => s.id !== id); C.modsDirty = true; }
export function spiritInfo(s) { const d = SPIRITS[s.id] || {}; return { name: s.name || d.name || s.id, desc: s.desc || d.desc || '', mods: s.mods || d.mods || {} }; }

// ───────── 결정 ─────────
export function decisionBlocked(G, C, D) {
  if (C.pp < D.cost) return `정치력 ${D.cost} 필요`;
  if (C.decCd?.[D.id] > G.hour) return '재사용 대기';
  if (D.req?.war && !atWarAny(G, C.tag)) return '전쟁 중에만';
  if (D.req?.tension && G.tension < D.req.tension) return `세계 긴장도 ${Math.round(D.req.tension * 100)}% 필요`;
  return null;
}
export function takeDecision(G, C, id) {
  const D = DECISIONS.find((d) => d.id === id);
  if (!D || decisionBlocked(G, C, D)) return false;
  C.pp -= D.cost;
  (C.decCd ||= {})[D.id] = G.hour + (D.cd || 0) * 24;
  if (D.spirit) addSpirit(G, C, D.spirit, D.days);
  if (D.fx) {
    if (D.fx.warSupport) C.baseWs += D.fx.warSupport;
    if (D.fx.stability) C.baseStab += D.fx.stability;
    if (D.fx.fuel) C.fuel = Math.min(C.fuelCap || 1e9, C.fuel + D.fx.fuel);
  }
  return true;
}

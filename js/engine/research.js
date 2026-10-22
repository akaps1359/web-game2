// 연구
import { TECH, TECHS } from '../data/techs.js';
import { M } from './mods.js';
import { yearFrac } from './world.js';

export const DAYS_PER_COST = 110;

export function techAvailable(C, id) {
  const T = TECH[id];
  if (!T || C.techs[id]) return false;
  if (T.req && !T.req.every((r) => C.techs[r])) return false;
  if (T.excl) {
    // 같은 배타 그룹의 다른 '시작' 기술을 이미 연구했으면 불가
    for (const t of TECHS) if (t.excl === T.excl && t.id !== id && C.techs[t.id]) return false;
    for (const s of C.research.cur) if (s && TECH[s.id]?.excl === T.excl && s.id !== id) return false;
  }
  if (C.research.cur.some((s) => s && s.id === id)) return false;
  return true;
}

export function techDays(G, C, id) {
  const T = TECH[id];
  const ahead = Math.max(0, T.year - yearFrac(G.hour));
  const bonus = researchBonus(C, T.cat);
  const speed = Math.max(0.1, 1 + M(C, 'research') + bonus);
  return (T.cost * DAYS_PER_COST * (1 + 2 * ahead)) / speed;
}

export function researchBonus(C, cat) {
  let b = 0;
  for (const rb of C.rBonus || []) if (rb.cat === cat || rb.cat === 'any') b = Math.max(b, rb.bonus);
  return b;
}

export function startResearch(G, C, slot, id) {
  if (slot < 0 || slot >= C.research.slots) return false;
  const cur = C.research.cur[slot];
  if (cur && cur.id === id) return true;
  if (!techAvailable(C, id)) return false;
  // 이전 진행은 저장(같은 기술로 돌아오면 이어서)
  if (cur) C.research.saved[cur.id] = cur.prog;
  C.research.cur[slot] = { id, prog: C.research.saved[id] || 0 };
  delete C.research.saved[id];
  return true;
}

export function grantTech(G, C, id, silent) {
  const T = TECH[id]; if (!T || C.techs[id]) return;
  C.techs[id] = 1;
  const fx = T.fx || {};
  if (fx.eq) for (const e in fx.eq) C.eq[e] = Math.max(C.eq[e] || 0, fx.eq[e]);
  if (fx.unlock) for (const u of fx.unlock) C.unlock[u] = 1;
  if (fx.rslot) { C.research.slots += fx.rslot; while (C.research.cur.length < C.research.slots) C.research.cur.push(null); }
  C.techVer = (C.techVer || 0) + 1;
  C.modsDirty = true;
  if (!silent && G.onTech) G.onTech(C, id);
}

export function dailyResearch(G, C) {
  const R = C.research;
  while (R.cur.length < R.slots) R.cur.push(null);
  for (let i = 0; i < R.slots; i++) {
    const s = R.cur[i];
    if (!s) continue;
    if (C.techs[s.id]) { R.cur[i] = null; continue; }
    const T = TECH[s.id];
    const bonus = researchBonus(C, T.cat);
    const speed = Math.max(0.1, 1 + M(C, 'research') + bonus);
    s.prog += speed;
    const ahead = Math.max(0, T.year - yearFrac(G.hour));
    const need = T.cost * DAYS_PER_COST * (1 + 2 * ahead);
    if (s.prog >= need) {
      grantTech(G, C, s.id);
      R.cur[i] = null;
      // 연구 보너스 소모
      if (bonus > 0) {
        const idx = (C.rBonus || []).findIndex((rb) => (rb.cat === T.cat || rb.cat === 'any') && rb.bonus === bonus);
        if (idx >= 0) { C.rBonus[idx].uses--; if (C.rBonus[idx].uses <= 0) C.rBonus.splice(idx, 1); }
      }
      if (C.ai || C.autoResearch) { /* AI가 다음 기술 선택 */ }
      if (G.onResearchDone) G.onResearchDone(C, s.id, i);
    }
  }
}

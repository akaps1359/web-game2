// 국가 수정치(modifier) 합산
// 키: pp, ppFactor, stability, warSupport, research, construction, factoryOutput, dockOutput,
//     prodEffCap, prodEffGain, consumerGoods, manpower, slots, resources, fuelCap, fuelGain,
//     'milfac.cost', training, justify, tension, surrender, winter,
//     land.atk/def/org/brk/speed/planning/entrench/supply/reinforce/recovery,
//     inf.atk/def, arm.atk, art.atk, mot.atk, cav.atk, width.pen,
//     air.atk/def/agi, cas.dmg, bomb.dmg, navy.atk/def, sub.atk/def
import { LAW_GROUPS, ADVISOR_ROLES, SPIRITS } from '../data/ideas.js';
import { TECH } from '../data/techs.js';

const ALIAS = { 'warSupport.target': 'warSupport', 'stability.target': 'stability' };

export function computeMods(C) {
  const m = {};
  const add = (mods, f = 1) => { if (!mods) return; for (const k in mods) { const kk = ALIAS[k] || k; m[kk] = (m[kk] || 0) + mods[k] * f; } };
  for (const g in C.laws) { const L = LAW_GROUPS[g]?.laws[C.laws[g]]; if (L) add(L.mods); }
  for (const slot in C.advisors) {
    const v = C.advisors[slot];
    const roles = Array.isArray(v) ? v : v ? [v] : [];
    for (const r of roles) add(ADVISOR_ROLES[r]?.mods);
  }
  for (const s of C.spirits) add(s.mods || SPIRITS[s.id]?.mods);
  for (const id in C.techs) add(TECH[id]?.fx?.mods);
  add(C.extraMods);
  return m;
}

export const M = (C, k) => (C.m && C.m[k]) || 0;

export function refreshMods(C) { C.m = computeMods(C); C.modsDirty = false; }

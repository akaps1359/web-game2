// 아이템 한 개: 만들기·이름·색·능력치 합산·가격·설명 줄
import { BASE } from '../data/items.js';
import { AFFIX, PREFIXES, SUFFIXES, RARE_A, RARE_B } from '../data/affixes.js';
import { UNIQUE, UNIQUES } from '../data/uniques.js';
import { RNG } from '../core/rng.js';

let UID = 1;
export const newUid = () => (Date.now() % 1e9) * 1000 + (UID++ % 1000);
export const ITEM_BASE = BASE;

const rand = new RNG();
const R = (rng) => rng || rand;

export function baseOf(it) { return BASE[it.b]; }

// 기본 아이템(일반 등급)
export function makeItem(baseId, opts = {}) {
  const b = BASE[baseId];
  if (!b) throw new Error('아이템 없음: ' + baseId);
  const rng = R(opts.rng);
  const it = { uid: newUid(), b: baseId, q: 'normal', ilvl: opts.ilvl || b.q || 1, id: true };
  if (b.cat === 'potion' || b.cat === 'scroll' || b.cat === 'elixir') it.q = 'use';
  if (b.quest) it.q = 'quest';
  if (b.ac) it.ac = rng.int(b.ac[0], b.ac[1]);
  if (b.dur) {
    it.durMax = b.dur;
    // 던전에서 찾은 물건은 내구도가 덜 차 있다(디아블로 1)
    it.dur = opts.found ? rng.int(1 + Math.floor(b.dur / 4), Math.floor((3 * b.dur) / 4)) : b.dur;
  }
  return it;
}

// 접사 고르기: 아이템 종류와 레벨 창에 맞는 것
function affixPool(list, b, lo, hi, opts) {
  const slot = b.slot;
  return list.filter((a) => {
    if (a.q > hi || a.q < lo) return false;
    if (!a.types.includes(b.aff)) return false;
    if (a.slots && !a.slots.includes(slot)) return false;
    if (a.curse && !opts.cursed) return false;
    // 장신구는 명중 접사를 '황금'까지만
    return true;
  });
}

function rollAffix(a, rng) {
  if (a.range) {
    // 범위형(원소 피해 등): [최소, 최대]를 그대로 둔다
    return [a.v[0], a.v[1]];
  }
  return rng.int(Math.min(a.v[0], a.v[1]), Math.max(a.v[0], a.v[1]));
}

// 마법 아이템으로 만든다. opts: rng, ilvl, cursed(저주 허용), window: [lo, hi]
export function enchantMagic(it, opts = {}) {
  const b = BASE[it.b], rng = R(opts.rng);
  const ilvl = opts.ilvl ?? it.ilvl;
  let hi = ilvl + (opts.bonus || 0), lo = Math.min(25, Math.floor(hi / 2));
  if (opts.window) [lo, hi] = opts.window;
  const roll = rng.next();
  // 디아블로 1: 접두만 20.8%, 접미만 62.5%, 둘 다 16.7%
  let wantPre = roll < 0.208 || roll >= 0.833, wantSuf = roll >= 0.208;
  let pre = null, suf = null;
  for (let tries = 0; tries < 3 && !pre && !suf; tries++) {
    if (wantPre) {
      const pool = affixPool(PREFIXES, b, lo, hi, opts);
      if (pool.length) pre = rng.weighted(pool, (a) => (a.dbl ? 2 : 1));
    }
    if (wantSuf) {
      // 선한 접두와 악한 접미는 함께 붙지 않는다
      const pool = affixPool(SUFFIXES, b, lo, hi, opts).filter((a) => !pre || !((pre.goe === 'g' && a.goe === 'e') || (pre.goe === 'e' && a.goe === 'g')));
      if (pool.length) suf = rng.pick(pool);
    }
    if (!pre && !suf) { lo = 0; wantPre = true; wantSuf = true; }
  }
  if (!pre && !suf) return it;
  it.q = 'magic';
  it.pre = pre ? [{ a: pre.id, v: rollAffix(pre, rng), r: rng.next() }] : [];
  it.suf = suf ? [{ a: suf.id, v: rollAffix(suf, rng), r: rng.next() }] : [];
  // 명중+피해 접두는 명중 값도 굴린다
  for (const x of it.pre) { const A = AFFIX[x.a]; if (A.tohit) x.t = rng.int(Math.min(...A.tohit), Math.max(...A.tohit)); }
  it.id = !!opts.identified || b.jewel && false;
  if (!opts.identified) it.id = false;
  finishDur(it);
  return it;
}

// 희귀(노란색): 접사 2~6개, 접두·접미 최대 3개씩, 같은 효과 중복 금지
export function enchantRare(it, opts = {}) {
  const b = BASE[it.b], rng = R(opts.rng);
  const ilvl = opts.ilvl ?? it.ilvl;
  const n = rng.weighted([{ n: 2, w: 2 }, { n: 3, w: 4 }, { n: 4, w: 4 }, { n: 5, w: 2 }, { n: 6, w: 1 }]).n;
  it.pre = []; it.suf = [];
  const used = new Set();
  for (let i = 0; i < n * 3 && it.pre.length + it.suf.length < n; i++) {
    const isPre = rng.chance(0.5);
    const arr = isPre ? it.pre : it.suf;
    if (arr.length >= 3) continue;
    const pool = affixPool(isPre ? PREFIXES : SUFFIXES, b, 0, ilvl + 2, {}).filter((a) => !used.has(a.mod) && !a.curse);
    if (!pool.length) continue;
    const a = rng.weighted(pool, (x) => (x.dbl ? 2 : 1) * (1 + x.q / 20));
    used.add(a.mod);
    const e = { a: a.id, v: rollAffix(a, rng), r: rng.next() };
    if (a.tohit) e.t = rng.int(Math.min(...a.tohit), Math.max(...a.tohit));
    arr.push(e);
  }
  if (it.pre.length + it.suf.length < 2) return enchantMagic(it, opts);
  it.q = 'rare';
  const words = RARE_B[b.cat] || RARE_B[b.slot] || RARE_B.amulet;
  it.rn = `${rng.pick(RARE_A)} ${rng.pick(words)}`;
  it.id = !!opts.identified;
  finishDur(it);
  return it;
}

// 고유 아이템: 기본 종류에 맞는 것 중 품질 레벨이 허락하는 가장 높은 것(디아블로 1)
export function pickUnique(baseId, ilvl, found = new Set(), rng) {
  const cands = UNIQUES.filter((u) => !u.quest && u.base === baseId && u.q <= ilvl && !found.has(u.id));
  if (!cands.length) return null;
  cands.sort((a, b) => b.q - a.q);
  return cands[0];
}
export function makeUnique(uid, opts = {}) {
  const u = UNIQUE[uid];
  const it = makeItem(u.base, { rng: opts.rng });
  it.q = 'unique'; it.u = uid; it.ilvl = u.q;
  if (u.ac) it.ac = u.ac;
  if (u.dur) it.durMax = u.dur;
  if (it.durMax) it.dur = it.durMax;
  it.id = !!opts.identified;
  finishDur(it);
  return it;
}

function finishDur(it) {
  const m = itemMods(it, true);
  const b = BASE[it.b];
  if (!b.dur) return;
  if (m.indestr) { it.indestr = true; return; }
  if (m.fragile) { it.durMax = 1; it.dur = 1; return; }
  if (m.durPct && !it._durDone) {
    const nm = Math.max(1, Math.round((it.durMax || b.dur) * (1 + m.durPct / 100)));
    it.dur = Math.max(1, Math.round((it.dur / (it.durMax || 1)) * nm));
    it.durMax = nm;
    it._durDone = 1;
  }
}

// 아이템의 모든 효과를 합친다(감정 여부와 무관한 실제 효과)
export function itemMods(it, raw = false) {
  if (!raw && it._m) return it._m;
  const m = {};
  const add = (k, v) => {
    if (Array.isArray(v)) { const o = m[k] || [0, 0]; m[k] = [o[0] + v[0], o[1] + v[1]]; }
    else m[k] = (m[k] || 0) + v;
  };
  for (const list of [it.pre, it.suf]) if (list) for (const x of list) {
    const A = AFFIX[x.a];
    if (!A) continue;
    if (A.mod === 'tohitDmg') { add('dmgPct', x.v); add('tohit', x.t || 0); }
    else if (A.mod === 'durPct' && A.fragile) add('fragile', 1);
    else add(A.mod, x.v);
  }
  if (it.u) { const U = UNIQUE[it.u]; for (const k in U.mods) add(k, U.mods[k]); }
  if (!raw) it._m = m;
  return m;
}
export function invalidate(it) { delete it._m; }

// 이름
export function itemName(it, short = false) {
  if (!it) return '';
  const b = BASE[it.b];
  if (it.q === 'unique' && it.id) return UNIQUE[it.u].name;
  if (it.q === 'unique' && !it.id) return b.name;
  if (it.q === 'rare' && it.id) return it.rn;
  if (it.q === 'magic' && it.id) {
    const p = it.pre?.[0] ? AFFIX[it.pre[0].a].name + ' ' : '';
    const s = it.suf?.[0] ? AFFIX[it.suf[0].a].name + ' ' : '';
    return `${p}${s}${b.name}`;
  }
  return b.name;
}
export function itemColor(it) {
  if (!it) return '#ddd';
  if (it.q === 'quest' || BASE[it.b]?.quest) return '#ff9a40';
  if (it.q === 'unique' && UNIQUE[it.u]?.quest) return '#c7a45c';
  if (it.q === 'unique') return '#c7a45c';
  if (it.q === 'rare') return '#ffff6e';
  if (it.q === 'magic') return '#8a98ff';
  if (BASE[it.b]?.cat === 'potion' || BASE[it.b]?.cat === 'scroll' || BASE[it.b]?.cat === 'elixir') return '#e8e4dc';
  return '#e8e4dc';
}
export function qualityClass(it) {
  if (!it) return '';
  if (it.q === 'quest') return 'quest';
  return it.q === 'use' ? 'normal' : it.q;
}

// 요구 능력치
export function itemReq(it) {
  const b = BASE[it.b], m = itemMods(it);
  const r = { ...(b.req || {}) };
  if (m.noStrReq) delete r.str;
  return r;
}
export function meetsReq(it, stats) {
  const r = itemReq(it);
  return (!r.str || stats.str >= r.str) && (!r.dex || stats.dex >= r.dex) && (!r.mag || stats.mag >= r.mag);
}

// 실제 방어도(감정되지 않았어도 효과는 있다)
export function itemAC(it) {
  if (it.ac == null) return 0;
  const m = itemMods(it);
  let ac = it.ac;
  if (m.acPct) ac = Math.max(ac + (m.acPct > 0 ? 1 : 0), Math.floor((ac * (100 + m.acPct)) / 100));
  if (m.acFlat) ac += m.acFlat;
  return Math.max(0, ac);
}
export function itemDmg(it) {
  const b = BASE[it.b];
  if (it.u && UNIQUE[it.u].dmg) return UNIQUE[it.u].dmg;
  return b.dmg || [1, 1];
}
export function isTwoHanded(it) {
  const b = BASE[it.b];
  if (!b || b.slot !== 'weapon') return false;
  return (b.hands === 2) && !itemMods(it).oneHand;
}

// 가격(살 때). 팔 때는 1/4, 감정 안 된 마법 물건은 기본값
export function itemPrice(it) {
  const b = BASE[it.b];
  let I = b.price || 0;
  if (it.q === 'unique') {
    const U = UNIQUE[it.u];
    return Math.round(I * 2 + (U.q || 1) * 900 + 2000);
  }
  if ((it.q === 'magic' || it.q === 'rare') && it.id !== undefined) {
    let B = 0, M = 0;
    for (const list of [it.pre, it.suf]) if (list) for (const x of list) {
      const A = AFFIX[x.a];
      B += A.pmin + (A.pmax - A.pmin) * (x.r ?? 0.5);
      M += A.mult;
    }
    let p = M > 0 ? B + I * M : B + I / Math.max(1, -M);
    if (it.q === 'rare') p *= 1.3;
    return Math.max(1, Math.round(p));
  }
  return I;
}
export function sellPrice(it) {
  const b = BASE[it.b];
  if (b.quest) return 0;
  if ((it.q === 'magic' || it.q === 'rare' || it.q === 'unique') && !it.id) return Math.max(1, Math.floor(b.price / 4));
  let p = itemPrice(it);
  // 닳은 물건은 덜 받는다
  if (it.durMax && !it.indestr) p *= 0.4 + 0.6 * (it.dur / it.durMax);
  return Math.max(1, Math.floor(p / 4));
}
export function repairCost(it) {
  if (!it.durMax || it.indestr || it.dur >= it.durMax) return 0;
  const p = it.id || it.q === 'normal' ? itemPrice(it) : BASE[it.b].price;
  return Math.max(1, Math.ceil(p * (1 - it.dur / it.durMax) * (it.q === 'normal' ? 0.5 : 0.15)));
}

// ───────── 설명 줄 ─────────
const MODTXT = {
  tohit: (v) => `명중률 ${sg(v)}%`, dmgPct: (v) => `피해 ${sg(v)}%`, acPct: (v) => `방어도 ${sg(v)}%`, acFlat: (v) => `방어도 ${sg(v)}`,
  resFire: (v) => `화염 저항 ${sg(v)}%`, resLight: (v) => `번개 저항 ${sg(v)}%`, resCold: (v) => `냉기 저항 ${sg(v)}%`, resPoison: (v) => `독 저항 ${sg(v)}%`, resAll: (v) => `모든 저항 ${sg(v)}%`,
  mana: (v) => `마나 ${sg(v)}`, life: (v) => `생명력 ${sg(v)}`, skills: (v) => `모든 기술 레벨 ${sg(v)}`,
  fireDmg: (v) => `화염 피해 ${v[0]}-${v[1]}`, lightDmg: (v) => `번개 피해 ${v[0]}-${v[1]}`, coldDmg: (v) => `냉기 피해 ${v[0]}-${v[1]}`, poisonDmg: (v) => `독 피해 ${v[0]}-${v[1]} (2초)`,
  dmgFlat: (v) => `피해 ${sg(v)}`, dmgTaken: (v) => (v < 0 ? `받는 피해 ${-v} 감소` : `받는 피해 ${v} 증가`),
  str: (v) => `힘 ${sg(v)}`, dex: (v) => `민첩 ${sg(v)}`, mag: (v) => `마력 ${sg(v)}`, vit: (v) => `활력 ${sg(v)}`, attrs: (v) => `모든 능력치 ${sg(v)}`,
  durPct: (v) => `내구도 ${sg(v)}%`, indestr: () => '파괴되지 않음', light: (v) => `빛 반경 ${sg(v * 10)}%`,
  fireArrow: (v) => `화염 화살 피해 ${v[0]}-${v[1]}`, lightArrow: (v) => `번개 화살 피해 ${v[0]}-${v[1]}`,
  thorns: (v) => `공격자에게 피해 ${Array.isArray(v) ? v[0] + '-' + v[1] : v} 되돌림`, lightThorns: (v) => `공격자에게 번개 피해 1-${v}`,
  noMana: () => '마나를 모두 잃음', halfTrap: () => '함정 피해 절반', knockback: () => '적을 밀쳐냄',
  manaSteal: (v) => `마나 흡수 ${v}%`, lifeSteal: (v) => `생명력 흡수 ${v}%`, targAc: (v) => `대상 방어도 무시 ${v}`,
  ias: (v) => `공격 속도 ${sg(v)}%`, fhr: (v) => `빠른 피격 회복 ${v}%`, fbr: (v) => `빠른 막기 ${v}%`, fcr: (v) => `빠른 시전 ${v}%`, frw: (v) => `빠른 이동 ${v}%`,
  mf: (v) => `마법 아이템 발견 ${sg(v)}%`, gf: (v) => `골드 발견 ${sg(v)}%`, regen: (v) => (v > 0 ? `생명력 재생 초당 ${v}` : `생명력 초당 ${-v} 잃음`), manaRegen: (v) => `마나 재생 ${sg(v)}%`,
  vsDemon: (v) => `악마에게 피해 ${sg(v)}%`, oneHand: () => '한 손으로 휘두름', noStrReq: () => '힘 요구치 없음', zeroRes: () => '모든 저항 0%로 고정', fragile: () => '내구도 1',
};
const sg = (v) => (v > 0 ? '+' + v : '' + v);
export function modText(k, v) { return MODTXT[k] ? MODTXT[k](v) : `${k} ${v}`; }

export const SLOT_NAME = { weapon: '무기', shield: '방패', body: '갑옷', head: '투구', gloves: '장갑', boots: '장화', belt: '허리띠', ring: '반지', amulet: '목걸이' };
const CAT_NAME = { sword: '칼', axe: '도끼', mace: '둔기', bow: '활', staff: '지팡이' };

// 설명창 줄: [{t: 글, c: 종류}]
export function itemLines(it, stats) {
  const b = BASE[it.b], L = [];
  const m = itemMods(it);
  if (b.slot === 'weapon') {
    const d = itemDmg(it);
    L.push({ t: `${isTwoHanded(it) ? '두 손' : '한 손'} ${CAT_NAME[b.cat] || ''} 피해: ${d[0]}-${d[1]}` });
  }
  if (it.ac != null) L.push({ t: `방어도: ${itemAC(it)}` });
  if (b.rows) L.push({ t: `물약 띠 ${b.rows}줄` });
  if (it.durMax) L.push({ t: it.indestr ? '파괴되지 않음' : `내구도: ${it.dur} / ${it.durMax}`, c: it.dur <= Math.max(1, it.durMax * 0.15) && !it.indestr ? 'bad' : '' });
  if (b.cat === 'potion') L.push({ t: POT_TXT[b.use] || '' });
  if (b.cat === 'scroll') L.push({ t: b.use === 'portal' ? '마을로 가는 차원문을 연다' : '아이템 하나를 감정한다' });
  if (b.cat === 'elixir') L.push({ t: `${{ str: '힘', mag: '마력', dex: '민첩', vit: '활력' }[b.stat]} 영구 +1` });
  if ((it.q === 'magic' || it.q === 'rare' || it.q === 'unique') && !it.id) L.push({ t: '감정되지 않음', c: 'bad' });
  else {
    const order = [];
    for (const list of [it.pre, it.suf]) if (list) for (const x of list) {
      const A = AFFIX[x.a];
      if (A.mod === 'tohitDmg') { order.push(['tohit', x.t]); order.push(['dmgPct', x.v]); }
      else if (A.mod === 'durPct' && A.fragile) order.push(['fragile', 1]);
      else order.push([A.mod, x.v]);
    }
    if (it.u) for (const k in UNIQUE[it.u].mods) order.push([k, UNIQUE[it.u].mods[k]]);
    for (const [k, v] of order) L.push({ t: modText(k, v), c: 'mod' });
  }
  const r = itemReq(it);
  const rq = [];
  if (r.str) rq.push({ t: `힘 ${r.str} 필요`, c: stats && stats.str < r.str ? 'bad' : 'req' });
  if (r.dex) rq.push({ t: `민첩 ${r.dex} 필요`, c: stats && stats.dex < r.dex ? 'bad' : 'req' });
  if (r.mag) rq.push({ t: `마력 ${r.mag} 필요`, c: stats && stats.mag < r.mag ? 'bad' : 'req' });
  L.push(...rq);
  if (it.u && UNIQUE[it.u].flav && it.id) L.push({ t: UNIQUE[it.u].flav, c: 'flav' });
  return L;
}
const POT_TXT = { heal: '생명력을 일부 회복', healFull: '생명력을 모두 회복', mana: '마나를 일부 회복', manaFull: '마나를 모두 회복', rejuv: '생명력과 마나를 일부 회복', rejuvFull: '생명력과 마나를 모두 회복' };

export function isEquip(it) { const b = BASE[it.b]; return !!b.slot; }
export function isUsable(it) { const b = BASE[it.b]; return !!b.use; }
export function isBeltable(it) { return !!BASE[it.b].belt; }

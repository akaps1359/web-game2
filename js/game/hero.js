// 영웅: 저장되는 캐릭터 데이터와 능력치 계산(디아블로 1 공식), 인벤토리 격자·장비·물약 띠
import { CLASSES, EXP_TABLE, MAX_LEVEL } from '../data/classes.js';
import { BASE } from '../data/items.js';
import { itemMods, itemAC, itemDmg, meetsReq, isTwoHanded, invalidate, makeItem, itemName } from './items.js';
import { SKILLS, skillDef, passiveMods } from './skills.js';
import { clamp, josa } from '../core/util.js';

export const INV_W = 10, INV_H = 4;
export const STASH_W = 10, STASH_H = 8;
export const EQUIP_SLOTS = ['head', 'amulet', 'body', 'weapon', 'shield', 'ring1', 'ring2', 'gloves', 'belt', 'boots'];

// 새 캐릭터
export function newHeroData(cls, name, hardcore = false) {
  const C = CLASSES[cls];
  const d = {
    v: 1, id: Math.random().toString(36).slice(2, 10), name, cls, hc: !!hardcore, created: Date.now(), played: 0,
    lvl: 1, exp: 0, base: { ...C.base }, statPts: 0, skillPts: 1,
    skills: {}, bar: ['attack', null, null, null, null],
    gold: 100, inv: [], equip: {}, belt: new Array(16).fill(null),
    hp: null, mp: null, quests: {}, wps: [0], maxDepth: 0, deaths: 0, kills: 0,
    found: [], // 이미 나온 고유 아이템(디아블로 1처럼 같은 고유품은 한 번만)
    town: { seen: {} },
  };
  // 시작 장비
  const h = new Hero(d, null);
  for (const id of C.start) {
    const it = makeItem(id, {});
    const b = BASE[id];
    if (b.slot && !d.equip[b.slot === 'ring' ? 'ring1' : b.slot]) { d.equip[b.slot === 'ring' ? 'ring1' : b.slot] = it; continue; }
    if (b.belt && h.beltAdd(it)) continue;
    h.invAdd(it);
  }
  // 직업별 시작 기술
  const first = { warrior: 'bash', rogue: 'magic_arrow', sorcerer: 'fire_bolt' }[cls];
  d.skills[first] = 1; d.skillPts = 0;
  d.bar[1] = first;
  h.recalc();
  d.hp = h.st.hpMax; d.mp = h.st.mpMax;
  return d;
}

export class Hero {
  constructor(data, game) {
    this.data = data; this.game = game;
    this.C = CLASSES[data.cls];
    this.actor = null;
    this.st = {};
    for (const k of ['inv', 'belt']) if (!data[k]) data[k] = k === 'belt' ? new Array(16).fill(null) : [];
    this.recalc();
  }
  bind(a) {
    this.actor = a;
    a.hero = this;
    this.recalc();
    a.hp = this.data.hp ?? this.st.hpMax; a.mp = this.data.mp ?? this.st.mpMax;
    a.hp = Math.min(a.hp, this.st.hpMax); a.mp = Math.min(a.mp, this.st.mpMax);
    if (a.hp <= 0) a.hp = this.st.hpMax;
  }
  get lvl() { return this.data.lvl; }

  // ───────── 능력치 ─────────
  recalc() {
    const d = this.data, C = this.C, st = {};
    const items = EQUIP_SLOTS.map((s) => d.equip[s]).filter(Boolean);
    // 내구도 0인 장비는 효과가 없다(디아블로 1)
    const live = items.filter((it) => !it.durMax || it.dur > 0 || it.indestr);
    const M = {};
    const add = (k, v) => { if (Array.isArray(v)) { const o = M[k] || [0, 0]; M[k] = [o[0] + v[0], o[1] + v[1]]; } else M[k] = (M[k] || 0) + v; };
    for (const it of live) { const m = itemMods(it); for (const k in m) add(k, m[k]); }
    // 패시브 기술·버프
    const pm = passiveMods(this);
    for (const k in pm) add(k, pm[k]);
    const bf = this.actor?.buffs || {};
    for (const k in bf) if (bf[k].mods) for (const m in bf[k].mods) add(m, bf[k].mods[m]);
    this.mods = M;
    const attrs = M.attrs || 0;
    const itemStr = (M.str || 0) + attrs, itemDex = (M.dex || 0) + attrs, itemMag = (M.mag || 0) + attrs, itemVit = (M.vit || 0) + attrs;
    st.baseStr = d.base.str; st.baseDex = d.base.dex; st.baseMag = d.base.mag; st.baseVit = d.base.vit;
    st.str = Math.max(0, d.base.str + itemStr); st.dex = Math.max(0, d.base.dex + itemDex); st.mag = Math.max(0, d.base.mag + itemMag); st.vit = Math.max(0, d.base.vit + itemVit);
    const lv = Math.min(d.lvl, 49);
    st.hpMax = Math.max(1, Math.floor(C.life.vit * d.base.vit + C.life.itemVit * itemVit + C.life.lvl * lv + C.life.k + (M.life || 0) + (d.bonusLife || 0)));
    st.mpMax = Math.max(0, Math.floor(C.mana.mag * d.base.mag + C.mana.itemMag * itemMag + C.mana.lvl * lv + C.mana.k + (M.mana || 0) + (d.bonusMana || 0)));
    if (M.lifePct) st.hpMax = Math.floor(st.hpMax * (1 + M.lifePct / 100));
    if (M.manaPct) st.mpMax = Math.floor(st.mpMax * (1 + M.manaPct / 100));
    if (M.noMana) st.mpMax = 0;
    // 무기
    const w = d.equip.weapon && live.includes(d.equip.weapon) ? d.equip.weapon : null;
    const wb = w ? BASE[w.b] : null;
    st.wcat = wb ? wb.cat : 'hand';
    st.ranged = st.wcat === 'bow';
    const sh = d.equip.shield && live.includes(d.equip.shield) ? d.equip.shield : null;
    let base = w ? itemDmg(w) : sh ? [1, 3] : [1, 1];
    st.wdmg = base;
    const pct = (M.dmgPct || 0), flat = (M.dmgFlat || 0);
    // 직업 피해 보너스(디아블로 1)
    let cd;
    if (d.cls === 'rogue') cd = ((st.str + st.dex) * d.lvl) / 200;
    else cd = st.ranged ? (st.str * d.lvl) / 200 : (st.str * d.lvl) / 100;
    st.charDmg = Math.floor(cd);
    st.dmgMin = Math.max(1, Math.floor(base[0] * (1 + pct / 100)) + flat + st.charDmg);
    st.dmgMax = Math.max(st.dmgMin, Math.floor(base[1] * (1 + pct / 100)) + flat + st.charDmg);
    st.dmgPct = pct; st.dmgFlat = flat;
    // 명중(괴물 방어도 빼기 전)
    st.tohitItems = M.tohit || 0;
    st.tohitMelee = 50 + st.dex / 2 + st.tohitItems + d.lvl + C.meleeHit;
    st.tohitRanged = 50 + st.dex + st.tohitItems + d.lvl + C.rangedHit;
    st.tohitSheet = Math.floor(50 + st.dex / 2 + st.tohitItems);
    // 방어도
    let ac = Math.floor(st.dex / 5);
    for (const it of live) ac += itemAC(it);
    if (M.defPct) ac = Math.floor(ac * (1 + M.defPct / 100));
    st.ac = Math.max(0, ac + (M.defFlat || 0));
    st.block = sh ? st.dex + C.block : 0;
    st.hasShield = !!sh;
    // 저항(최대 75%)
    const ra = M.resAll || 0;
    const resCap = 75 + (M.resMax || 0);
    st.res = {
      fire: clamp((M.resFire || 0) + ra, -100, resCap), cold: clamp((M.resCold || 0) + ra, -100, resCap),
      light: clamp((M.resLight || 0) + ra, -100, resCap), poison: clamp((M.resPoison || 0) + ra, -100, resCap),
    };
    if (M.zeroRes) st.res = { fire: 0, cold: 0, light: 0, poison: 0 };
    // 기타
    st.ias = M.ias || 0; st.fhr = M.fhr || 0; st.fbr = M.fbr || 0; st.fcr = M.fcr || 0; st.frw = M.frw || 0;
    st.lifeSteal = Math.min(15, M.lifeSteal || 0); st.manaSteal = Math.min(15, M.manaSteal || 0);
    st.dmgTaken = M.dmgTaken || 0; st.thorns = M.thorns || null; st.lightThorns = M.lightThorns || 0;
    st.light = M.light || 0; st.mf = M.mf || 0; st.gf = M.gf || 0; st.regen = M.regen || 0; st.manaRegen = M.manaRegen || 0;
    st.skills = M.skills || 0; st.knockback = !!M.knockback; st.targAc = M.targAc || 0; st.halfTrap = !!M.halfTrap;
    st.vsDemon = M.vsDemon || 0; st.crit = M.crit || 0; st.dodge = M.dodge || 0; st.avoid = M.avoid || 0; st.pierce = M.pierce || 0;
    st.elem = { fire: M.fireDmg || null, light: M.lightDmg || null, cold: M.coldDmg || null, poison: M.poisonDmg || null };
    st.arrowElem = { fire: M.fireArrow || null, light: M.lightArrow || null };
    st.tohitPct = M.tohitPct || 0; st.dmgPctSkill = M.dmgPctSkill || 0;
    st.mastery = M.mastery || 0;
    // 속도(초)
    const sp = SPEED[d.cls][st.wcat] || SPEED[d.cls].sword;
    st.atkTime = sp / (1 + st.ias / 100);
    st.castTime = SPEED[d.cls].cast / (1 + st.fcr / 100);
    st.hitRecover = HITREC[d.cls] * (1 - Math.min(0.7, st.fhr / 100));
    st.blockTime = st.fbr ? 0.12 : BLOCKT[d.cls];
    st.walkTime = 0.36 / (1 + (st.frw + (M.speedPct || 0)) / 100);
    this.st = st;
    const a = this.actor;
    if (a) {
      a.hpMax = st.hpMax; a.mpMax = st.mpMax;
      if (a.hp > a.hpMax) a.hp = a.hpMax;
      if (a.mp > a.mpMax) a.mp = a.mpMax;
      a.speed = 1 / st.walkTime;
      a.look = this.buildLook();
      a.ac = st.ac;
    }
    return st;
  }
  ranged() { return this.st.ranged; }
  lightRadius() {
    const r = 7.5 * (1 + (this.st.light || 0) * 0.1);
    return clamp(r, 3, 13) + (this.actor?.buffs?.innerSight ? 1.5 : 0);
  }

  // 겉모습: 장비가 보이게
  buildLook() {
    const C = this.C, eq = this.data.equip;
    const look = { ...C.look, cols: { ...C.look.cols } };
    const w = eq.weapon ? BASE[eq.weapon.b] : null;
    if (w) {
      look.wtype = (eq.weapon.u && eq.weapon.u === 'q_cleaver') ? 'cleaver' : w.wt; look.wlen = w.wlen || 0; look.wcol = w.icon?.c1 || '#c8ccd4'; look.wwide = w.wwide || 1; look.gem = w.gem;
      if (w.cat === 'bow') look.wcol = w.icon?.c2 || '#7a5530';
      if (eq.weapon.q === 'unique') look.wglow = 'rgba(255,200,100,0.6)';
      else if (eq.weapon.q === 'rare') look.wglow = null;
    } else { look.wtype = null; look.wlen = 0; }
    const s = eq.shield ? BASE[eq.shield.b] : null;
    look.shield = s ? { ...s.shield } : null;
    const b = eq.body ? BASE[eq.body.b] : null;
    if (b) {
      if (b.torso) { look.cols.torso = b.torso; look.cols.arms = b.weight === 'L' ? look.cols.arms : b.torso; }
      if (b.pads) { look.pads = true; look.cols.pad = b.pads; }
      if (b.weight === 'H') { look.cols.legs = shadeHex(b.torso, 0.85); look.cols.fore = b.torso; }
      if (b.weight === 'M') look.cols.fore = b.torso;
      if (b.robe) { look.robe = true; look.cols.robe = b.robe; look.cols.torso = b.robe; look.cols.arms = b.robe; look.cols.fore = b.robe; }
      if (b.cape) { look.cape = true; look.cols.cape = b.cape; }
    }
    const h = eq.head ? BASE[eq.head.b] : null;
    look.helm = h ? { ...h.helm } : (this.data.cls === 'rogue' ? null : null);
    if (eq.gloves) look.cols.hands = BASE[eq.gloves.b].hands || look.cols.hands;
    if (eq.boots) look.cols.boots = BASE[eq.boots.b].boots || look.cols.boots;
    if (eq.belt) look.cols.belt = BASE[eq.belt.b].icon.c1;
    return look;
  }

  // ───────── 경험치·레벨 ─────────
  gainExp(n) {
    const d = this.data;
    if (n <= 0 || d.lvl >= MAX_LEVEL) return 0;
    d.exp += Math.floor(n);
    let ups = 0;
    while (d.lvl < MAX_LEVEL && d.exp >= EXP_TABLE[d.lvl]) {
      d.lvl++; d.statPts += 5; d.skillPts += 1; ups++;
    }
    if (ups) {
      this.recalc();
      const a = this.actor;
      if (a) { a.hp = a.hpMax; a.mp = a.mpMax; }
    }
    return ups;
  }
  expProgress() {
    const d = this.data;
    if (d.lvl >= MAX_LEVEL) return 1;
    const a = EXP_TABLE[d.lvl - 1], b = EXP_TABLE[d.lvl];
    return clamp((d.exp - a) / (b - a), 0, 1);
  }
  addStat(k) {
    const d = this.data;
    if (d.statPts <= 0 || d.base[k] >= this.C.max[k]) return false;
    d.base[k]++; d.statPts--;
    const a = this.actor;
    const hp0 = this.st.hpMax, mp0 = this.st.mpMax;
    this.recalc();
    if (a) { a.hp += this.st.hpMax - hp0; a.mp += this.st.mpMax - mp0; }
    return true;
  }

  // ───────── 기술 ─────────
  skillPoints(id) { return this.data.skills[id] || 0; }
  skillLevel(id) {
    const p = this.data.skills[id] || 0;
    if (!p) return 0;
    return p + (this.st.skills || 0) + (this.actor?.buffs?.battleCommand ? 1 : 0);
  }
  canLearn(id) {
    const s = skillDef(id);
    if (!s || s.cls !== this.data.cls) return { ok: false, why: '다른 직업의 기술' };
    if (this.data.skillPts <= 0) return { ok: false, why: '기술 점수가 없습니다' };
    if (this.data.lvl < s.req) return { ok: false, why: `레벨 ${s.req} 필요` };
    if ((this.data.skills[id] || 0) >= 20) return { ok: false, why: '최대 레벨' };
    for (const p of s.pre || []) if (!this.data.skills[p]) return { ok: false, why: `먼저 「${skillDef(p).name}」${josa(skillDef(p).name, '을', '를')} 배워야 합니다` };
    return { ok: true };
  }
  learn(id) {
    const c = this.canLearn(id);
    if (!c.ok) return c;
    this.data.skills[id] = (this.data.skills[id] || 0) + 1;
    this.data.skillPts--;
    // 처음 배운 능동 기술은 빈 칸에 자동으로 넣는다
    const s = skillDef(id);
    if (this.data.skills[id] === 1 && !s.passive && !this.data.bar.includes(id)) {
      const i = this.data.bar.indexOf(null, 1);
      if (i > 0) this.data.bar[i] = id;
    }
    this.recalc();
    return { ok: true };
  }

  // ───────── 인벤토리 격자 ─────────
  invFits(it, x, y, ignore = null, W = INV_W, H = INV_H, list = this.data.inv) {
    const b = BASE[it.b];
    if (x < 0 || y < 0 || x + b.w > W || y + b.h > H) return false;
    for (const o of list) {
      if (o === it || o === ignore) continue;
      const ob = BASE[o.b];
      if (x < o.x + ob.w && o.x < x + b.w && y < o.y + ob.h && o.y < y + b.h) return false;
    }
    return true;
  }
  invFind(it, W = INV_W, H = INV_H, list = this.data.inv) {
    const b = BASE[it.b];
    // 디아블로처럼 위에서 아래, 왼쪽에서 오른쪽(작은 것은 아래부터 채운다)
    for (let x = 0; x <= W - b.w; x++) for (let y = 0; y <= H - b.h; y++) if (this.invFits(it, x, y, null, W, H, list)) return { x, y };
    return null;
  }
  invAdd(it, list = this.data.inv, W = INV_W, H = INV_H) {
    const p = this.invFind(it, W, H, list);
    if (!p) return false;
    it.x = p.x; it.y = p.y;
    list.push(it);
    return true;
  }
  invRemove(it, list = this.data.inv) {
    const i = list.indexOf(it);
    if (i >= 0) list.splice(i, 1);
    return i >= 0;
  }
  // 그 칸에 놓인 아이템
  invAt(x, y, list = this.data.inv) {
    for (const o of list) { const b = BASE[o.b]; if (x >= o.x && x < o.x + b.w && y >= o.y && y < o.y + b.h) return o; }
    return null;
  }

  // ───────── 장비 ─────────
  slotFor(it) {
    const b = BASE[it.b];
    if (!b.slot) return null;
    if (b.slot === 'ring') return this.data.equip.ring1 && !this.data.equip.ring2 ? 'ring2' : 'ring1';
    return b.slot;
  }
  canEquip(it, slot = null) {
    const b = BASE[it.b];
    if (!b.slot) return { ok: false, why: '장착할 수 없습니다' };
    slot = slot || this.slotFor(it);
    if (b.slot === 'ring' ? !slot.startsWith('ring') : b.slot !== slot) return { ok: false, why: '그 자리에 낄 수 없습니다' };
    if (!meetsReq(it, this.st)) return { ok: false, why: '능력치가 부족합니다', soft: true };
    return { ok: true };
  }
  // 장착: 밀려난 물건들을 돌려준다(가방에 넣지 못하면 null)
  equip(it, slot = null) {
    const d = this.data, b = BASE[it.b];
    slot = slot || this.slotFor(it);
    const c = this.canEquip(it, slot);
    if (!c.ok && !c.soft) return { ok: false, why: c.why };
    const out = [];
    if (d.equip[slot]) out.push(d.equip[slot]);
    // 두 손 무기는 방패를 뺀다, 방패는 두 손 무기를 뺀다
    if (slot === 'weapon' && isTwoHanded(it) && d.equip.shield) out.push(d.equip.shield);
    if (slot === 'shield' && d.equip.weapon && isTwoHanded(d.equip.weapon)) out.push(d.equip.weapon);
    // 가방 공간 확인
    const inInv = d.inv.includes(it);
    if (inInv) this.invRemove(it);
    const tmp = d.inv.slice();
    for (const o of out) {
      const p = this.invFind(o, INV_W, INV_H, tmp);
      if (!p) { if (inInv) d.inv.push(it); return { ok: false, why: '가방에 빈자리가 없습니다' }; }
      o._nx = p.x; o._ny = p.y; tmp.push({ ...o, x: p.x, y: p.y });
    }
    for (const o of out) {
      for (const k of EQUIP_SLOTS) if (d.equip[k] === o) delete d.equip[k];
      o.x = o._nx; o.y = o._ny; delete o._nx; delete o._ny;
      d.inv.push(o);
    }
    d.equip[slot] = it;
    this.recalc();
    return { ok: true, warn: c.soft ? c.why : null };
  }
  unequip(slot) {
    const d = this.data, it = d.equip[slot];
    if (!it) return false;
    if (!this.invAdd(it)) return false;
    delete d.equip[slot];
    this.recalc();
    return true;
  }

  // ───────── 물약 띠 ─────────
  beltRows() { const b = this.data.equip.belt; return b ? BASE[b.b].rows || 1 : 1; }
  beltAdd(it) {
    if (!BASE[it.b].belt) return false;
    const rows = this.beltRows();
    // 같은 종류가 있는 열을 먼저, 그다음 빈 열
    const B = this.data.belt;
    for (let pass = 0; pass < 2; pass++) for (let c = 0; c < 4; c++) {
      const bottom = B[c];
      if (pass === 0 && (!bottom || bottom.b !== it.b)) continue;
      for (let r = 0; r < rows; r++) { const k = r * 4 + c; if (!B[k]) { B[k] = it; return true; } }
    }
    return false;
  }
  // 열의 맨 아래 것을 꺼낸다(위의 것이 내려온다)
  beltTake(col) {
    const B = this.data.belt, it = B[col];
    if (!it) return null;
    for (let r = 0; r < 3; r++) B[r * 4 + col] = B[(r + 1) * 4 + col];
    B[12 + col] = null;
    return it;
  }
  // 허리띠가 작아지면 넘치는 것은 가방으로
  beltOverflow() {
    const rows = this.beltRows(), B = this.data.belt, spill = [];
    for (let k = rows * 4; k < 16; k++) if (B[k]) { spill.push(B[k]); B[k] = null; }
    return spill;
  }

  gold(n) { this.data.gold = Math.max(0, this.data.gold + n); }
  durabilityLoss(slot, chanceDen = 1) {
    const it = this.data.equip[slot];
    if (!it || !it.durMax || it.indestr || it.dur <= 0) return;
    if (chanceDen > 1 && Math.random() * chanceDen >= 1) return;
    it.dur--;
    if (it.dur <= 0) {
      it.dur = 0;
      this.recalc();
      this.game?.toast(`${itemName(it)}${josa(itemName(it), '이', '가')} 망가졌습니다! 대장장이에게 수리하세요.`, 'warn');
    } else if (it.dur === Math.max(1, Math.floor(it.durMax * 0.1))) this.game?.toast(`${itemName(it)}의 내구도가 거의 다 닳았습니다`, 'warn');
  }
  save() {
    const a = this.actor;
    if (a) { this.data.hp = Math.max(1, Math.round(a.hp)); this.data.mp = Math.round(a.mp); }
    return this.data;
  }
}

// 공격 동작 시간(초): 디아블로 1의 '타격 프레임'까지 걸리는 시간
const SPEED = {
  warrior: { sword: 0.45, mace: 0.45, hand: 0.45, axe: 0.5, staff: 0.55, bow: 0.55, cast: 0.6 },
  rogue: { sword: 0.5, mace: 0.5, hand: 0.5, axe: 0.65, staff: 0.55, bow: 0.4, cast: 0.55 },
  sorcerer: { sword: 0.6, mace: 0.6, hand: 0.6, axe: 0.8, staff: 0.6, bow: 0.8, cast: 0.42 },
};
const HITREC = { warrior: 0.3, rogue: 0.35, sorcerer: 0.4 };
const BLOCKT = { warrior: 0.1, rogue: 0.2, sorcerer: 0.3 };

function shadeHex(h, k) {
  const n = parseInt(h.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k | 0), g = Math.min(255, ((n >> 8) & 255) * k | 0), b = Math.min(255, (n & 255) * k | 0);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// 전투: 디아블로 1의 명중·피해·막기·경직 공식, 피해 적용, 죽음, 투사체와 장판
import { clamp } from '../core/util.js';
import { F_SOLID, F_OPAQUE } from './level.js';
import { dropLoot } from './loot.js';
import { addBuff } from './buffs.js';
import { onMonsterKilled } from './quests.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const RES_KEY = { fire: 'fire', cold: 'cold', light: 'light', poison: 'poison' };
export const TYPE_NAME = { phys: '물리', fire: '화염', cold: '냉기', light: '번개', poison: '독', magic: '마법' };
export const TYPE_COL = { phys: '#ffffff', fire: '#ff9a40', cold: '#8ad0ff', light: '#ffff80', poison: '#80ff60', magic: '#d080ff' };

// ───────── 플레이어 근접 공격 ─────────
// 손 닿는 거리(액터 중심 사이, 큰 괴물은 조금 더)와 앞쪽 부채꼴 반각
export const MELEE_HIT = 1.9, MELEE_ARC = 1.2;
const angOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// 내려치는 순간 맞을 적: 겨눈 적이 아직 손 닿는 곳·앞쪽에 있으면 그 적, 아니면 앞쪽 부채꼴 안의 가장 가까운 적(없으면 헛손질)
export function swingTarget(game, P, t) {
  const fa = P.faceTo ?? P.face;
  const ok = (a) => a && !a.dead && a.team !== P.team && a.kind !== 'npc' && !a.untargetable
    && Math.hypot(a.x - P.x, a.y - P.y) <= MELEE_HIT + (a.big ? 0.3 : 0) && angOff(Math.atan2(a.y - P.y, a.x - P.x), fa) < MELEE_ARC;
  if (ok(t)) return t;
  let best = null, bd = 1e9;
  for (const a of game.level.actors) { if (!ok(a)) continue; const d = Math.hypot(a.x - P.x, a.y - P.y); if (d < bd) { bd = d; best = a; } }
  return best;
}
// 근접 공격: t(없으면 mod.ang 쪽)로 몸을 돌려 휘두르고, 내려치는 순간 앞쪽 손 닿는 곳의 적을 맞힌다
export function meleeAttack(game, P, t, mod = {}) {
  const st = P.hero.st;
  if (t) P.turnTo(t.x, t.y);
  else if (mod.ang != null) P.turnTo(P.x + Math.cos(mod.ang), P.y + Math.sin(mod.ang));
  const hitT = st.atkTime * (mod.speed || 1), dur = hitT + 0.1;
  const style = mod.style || (st.wcat === 'axe' || st.wcat === 'mace' ? 'swing' : null);
  // 맞을 적이 없으면 앞쪽 손 닿는 곳의 상자·석관을 열고 통을 부순다
  P.setAnim('attack', dur, { hitAt: hitT / dur, style, basic: !!mod.basic, onHit: () => { const tt = swingTarget(game, P, t); if (tt) resolveMelee(game, P, tt, mod); else { P.uninterruptible = false; game.smashFront?.(P); } } });
  P.uninterruptible = !!mod.uninterruptible;
  game.sfx(st.wcat === 'axe' || (st.wcat === 'mace' && st.wdmg[1] > 10) ? 'swing_heavy' : 'swing_light', P.x, P.y);
}

export function resolveMelee(game, P, t, mod = {}) {
  P.uninterruptible = false;
  if (!t || t.dead || t.team === P.team) return false;
  if (Math.hypot(t.x - P.x, t.y - P.y) > 1.9) { game.sfx('swing_light', P.x, P.y, { vol: 0.4 }); return false; }
  const st = P.hero.st;
  const ac = Math.max(0, (t.ac || 0) - st.targAc - (t.buffs?.innerSight?.k || 0) - (t.buffs?.battleCry ? (t.ac || 0) * t.buffs.battleCry.def : 0));
  const chance = clamp(st.tohitMelee * (1 + (st.tohitPct + (mod.tohitPct || 0)) / 100) - ac, 5, 95);
  if (!t.stone && Math.random() * 100 >= chance && !mod.sure) {
    game.fx.text(t.x, t.y, '빗나감', '#aaa', 11, 60, 0.7);
    return false;
  }
  let d = rnd(st.dmgMin, st.dmgMax);
  d = Math.round(d * (1 + ((mod.dmgPct || 0) + (st.mastery || 0)) / 100)) + (mod.dmgFlat || 0);
  // 치명타: 전사는 레벨%만큼 두 배(디아블로 1), 로그는 기술
  let crit = false;
  const critCh = (P.hero.data.cls === 'warrior' ? P.hero.data.lvl : 0) + (st.crit || 0);
  if (Math.random() * 100 < critCh) { d *= 2; crit = true; }
  // 무기와 괴물 종류(디아블로 1): 칼은 언데드에 ×0.5·짐승에 ×1.5, 둔기는 반대
  const mc = t.mdef?.F?.cls || t.mcls;
  if (st.wcat === 'sword') d = mc === 'undead' ? d * 0.5 : mc === 'animal' ? d * 1.5 : d;
  else if (st.wcat === 'mace') d = mc === 'undead' ? d * 1.5 : mc === 'animal' ? d * 0.5 : d;
  if (st.vsDemon && mc === 'demon') d *= 1 + st.vsDemon / 100;
  d = Math.max(1, Math.round(d));
  const type = mod.type || 'phys';
  const dealt = damageActor(game, t, d, type, P, { crit, melee: true, knock: st.knockback || mod.knock, stun: mod.stun });
  // 무기에 붙은 원소 피해
  elementalExtras(game, P, t, st.elem);
  if (dealt > 0) leech(P, dealt);
  P.hero.durabilityLoss('weapon', 30);
  game.sfx(t.mdef?.F?.bones || t.bones ? 'hit_bone' : t.armored ? 'hit_metal' : crit ? 'hit_crit' : 'hit_flesh', t.x, t.y);
  return true;
}

function elementalExtras(game, src, t, elem) {
  if (!elem) return;
  for (const k of ['fire', 'light', 'cold', 'poison']) {
    const e = elem[k];
    if (!e || t.dead) continue;
    const d = rnd(Math.min(e[0], e[1]), Math.max(e[0], e[1]));
    if (k === 'poison') addBuff(t, 'poison', { t: 2, dps: d / 2, src });
    else damageActor(game, t, d, k, src, { noStun: true, quiet: true });
    if (k === 'cold') addBuff(t, 'chill', { t: 2 });
  }
}

function leech(P, dealt) {
  const st = P.hero.st;
  if (st.lifeSteal) P.hp = Math.min(P.hpMax, P.hp + dealt * st.lifeSteal / 100);
  if (st.manaSteal) P.mp = Math.min(P.mpMax, P.mp + dealt * st.manaSteal / 100);
}

// ───────── 플레이어 활 공격 ─────────
export function rangedAttack(game, P, t, mod = {}) {
  const st = P.hero.st;
  const tx = t ? t.x : mod.point.x, ty = t ? t.y : mod.point.y;
  P.turnTo(tx, ty);
  const hitT = st.atkTime * (mod.speed || 1), dur = hitT + 0.12;
  P.setAnim('attack', dur, {
    hitAt: hitT / dur, style: 'bow', basic: !!mod.basic, onHit: () => {
      const n = mod.count || 1, spread = mod.spread ?? 0.16;
      const base = Math.atan2(ty - P.y, tx - P.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * spread;
        fireArrow(game, P, a, t, mod);
      }
      game.sfx(n > 1 ? 'multishot' : 'bow_shoot', P.x, P.y);
      P.hero.durabilityLoss('weapon', 40);
    },
  });
}

export function fireArrow(game, P, ang, target, mod = {}) {
  const st = P.hero.st;
  const sp = 13;
  const m = {
    x: P.x + Math.cos(ang) * 0.4, y: P.y + Math.sin(ang) * 0.4, z: 34, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1.1,
    owner: P, team: P.team, kind: 'arrow', vis: mod.vis || 'arrow', mod, homing: mod.homing ? target : null, hit: new Set(),
    pierce: mod.pierce ?? st.pierce ?? 0, light: mod.light,
  };
  game.level.missiles.push(m);
  return m;
}

// 화살·근접 공용: 화살이 맞았을 때
function arrowHit(game, m, t) {
  const P = m.owner, st = P.hero?.st;
  const mod = m.mod || {};
  if (!st) return monsterMissileHit(game, m, t);
  const flight = Math.hypot(t.x - P.x, t.y - P.y);
  const ac = Math.max(0, (t.ac || 0) - st.targAc - (t.buffs?.innerSight?.k || 0));
  const chance = clamp(st.tohitRanged * (1 + (st.tohitPct + (mod.tohitPct || 0)) / 100) - flight - ac, 5, 95);
  if (!mod.sure && !t.stone && Math.random() * 100 >= chance) { game.fx.text(t.x, t.y, '빗나감', '#aaa', 11, 60, 0.7); return false; }
  let d = rnd(st.dmgMin, st.dmgMax);
  d = Math.round(d * (1 + (mod.dmgPct || 0) / 100) * (mod.mult ?? 1)) + (mod.dmgFlat || 0);
  let crit = false;
  if (Math.random() * 100 < (st.crit || 0)) { d *= 2; crit = true; }
  if (st.vsDemon && t.mdef?.F?.cls === 'demon') d *= 1 + st.vsDemon / 100;
  d = Math.max(1, Math.round(d));
  const dealt = damageActor(game, t, d, mod.type || 'phys', P, { crit, knock: st.knockback, arrow: true });
  // 활 원소 피해·기술 원소
  for (const k of ['fire', 'light']) { const e = st.arrowElem[k]; if (e && !t.dead) damageActor(game, t, rnd(e[0], e[1]), k, P, { noStun: true, quiet: true }); }
  if (mod.elem && !t.dead) {
    const e = mod.elem;
    damageActor(game, t, rnd(e.d[0], e.d[1]), e.type, P, { noStun: false });
    if (e.chill && !t.dead) addBuff(t, 'chill', { t: e.chill });
    if (e.freeze && !t.dead) freeze(t, e.freeze);
  }
  elementalExtras(game, P, t, st.elem);
  if (dealt > 0) leech(P, dealt);
  game.sfx('arrow_hit', t.x, t.y);
  return true;
}

// ───────── 피해 적용 ─────────
// opts: crit, melee, arrow, knock, noStun, stun(초), quiet, pure(저항 무시)
export function damageActor(game, t, amount, type, src, opts = {}) {
  if (!t || t.dead || t.invuln > 0) return 0;
  let d = amount;
  if (t.isPlayer) return damagePlayer(game, t, d, type, src, opts);
  // 괴물 저항
  if (type !== 'phys' && type !== 'magic' && !opts.pure) {
    let r = t.res?.[RES_KEY[type]] || 0;
    // 냉기 숙련은 적의 냉기 저항을 깎는다
    if (type === 'cold' && src?.hero) r -= src.hero.mods?.coldPierce || 0;
    if (r >= 100) { if (!opts.quiet) game.fx.text(t.x, t.y, '면역', '#bbb', 11, 60, 0.7); return 0; }
    d = d * (1 - r / 100);
  }
  if (type === 'phys' && t.physRes) d *= 1 - t.physRes / 100;
  if (src?.hero && t.buffs?.amp) d *= 1.5;
  d = Math.max(type === 'phys' ? 1 : 0, Math.round(d));
  if (d <= 0) return 0;
  t.hp -= d;
  t.flash = 0.12; t.barT = 3;
  if (src && !t.aware) t.aware = true;
  if (src) t.lastHitBy = src;
  if (src?.isPlayer || src?.owner?.isPlayer) game.stats.dmgDealt += d;
  if (game.showDmg && !opts.quietNum) game.fx.text(t.x, t.y, d, opts.crit ? '#ffd040' : TYPE_COL[type], opts.crit ? 15 : 12, 66);
  // 피 튀기기
  const dir = src ? Math.atan2(t.y - src.y, t.x - src.x) : Math.random() * 6.28;
  if (type === 'phys' || type === 'magic') {
    if (t.mdef?.F?.bones || t.bones) game.fx.bone(t.x, t.y, 30, 3);
    else game.fx.blood(t.x, t.y, 34, dir, opts.crit ? 14 : 7, t.look?.bloodCol?.includes('80,160') ? [90, 170, 40] : [150, 10, 8]);
  } else if (type === 'fire') game.fx.fire(t.x, t.y, 30, 4);
  else if (type === 'cold') game.fx.frost(t.x, t.y, 30, 5);
  else if (type === 'light') game.fx.sparks(t.x, t.y, 34, 6, [200, 220, 255]);
  else if (type === 'poison') game.fx.p(t.x, t.y, 30, { vz: 20, life: 0.5, size: 2.5, col: [100, 220, 60], glow: true });
  // 번개 강화 괴물은 맞으면 번개 불똥을 흩뿌린다
  if (t.umods?.includes('light') && Math.random() < 0.6) spawnChargedBolts(game, t, 4, [1, Math.max(2, Math.round(t.mlvl * 0.6))], 1);
  if (t.hp <= 0) { killActor(game, t, src, type); return d; }
  // 숨은 자: 맞으면 몇 걸음 물러나 다시 모습을 감춘다(4초에 한 번)
  if (t.ai === 'sneak' && !(t.hideAt > game.time)) { t.retreat = 2 + Math.floor(Math.random() * 3); t.hideAt = game.time + 4; }
  // 경직: 피해 ≥ 레벨+3 (디아블로 1)
  const stunTh = (t.mlvl || 1) + 3;
  if (!opts.noStun && !t.boss && !t.stone && (d >= stunTh || opts.stun || t.alwaysStun) && t.anim.name !== 'death') {
    if (t.rank !== 'unique' || Math.random() < 0.3) {
      t.setAnim('hit', opts.stun || t.mdef?.F?.rec || 0.3);
      t.act = null;
      if (t.onStun) t.onStun(game, t);
    }
  }
  if (opts.knock && !t.boss && t.anim.name !== 'death') knockback(game, t, src, 1);
  if (!opts.quiet && Math.random() < 0.35) game.sfx(t.big ? 'mon_hit_big' : 'mon_hit_small', t.x, t.y, { vol: 0.6 });
  return d;
}

function damagePlayer(game, P, d, type, src, opts) {
  const h = P.hero, st = h.st;
  if (game.god) return 0;
  // 받는 피해 감소(-N, 최소 1)
  if (type === 'phys' && st.dmgTaken) d = Math.max(1, d + st.dmgTaken);
  if (type !== 'phys' && type !== 'magic' && !opts.pure) d = d * (1 - (st.res[RES_KEY[type]] || 0) / 100);
  if (opts.trap && st.halfTrap) d /= 2;
  if (P.buffs.shoutDef && type === 'phys') d = d;
  d = Math.max(type === 'phys' ? 1 : 0, Math.round(d));
  // 에너지 보호막: 마나로 받아낸다
  const es = P.buffs.energyShield;
  if (es && P.mp > 0) {
    const part = d * es.absorb;
    const cost = part * es.cost;
    const pay = Math.min(P.mp, cost);
    P.mp -= pay;
    d -= Math.round(pay / es.cost);
    game.fx.ring(P.x, P.y, 0.4, 0.8, 0.25, [120, 170, 255], 2);
  }
  if (d <= 0) return 0;
  P.hp -= d;
  P.flash = 0.15;
  game.emit('playerHurt', d, type);
  if (game.showDmg) game.fx.text(P.x, P.y, d, '#ff5040', 13, 70);
  if (type === 'phys' || type === 'magic') game.fx.blood(P.x, P.y, 34, src ? Math.atan2(P.y - src.y, P.x - src.x) : 0, 6);
  if (P.hp <= 0) { P.hp = 0; killPlayer(game, P, src); return d; }
  // 흑사 망자: 최대 생명력 영구 감소(디아블로 1)
  if (src?.mdef?.drainMax && opts.melee) { h.data.bonusLife = (h.data.bonusLife || 0) - 1; h.recalc(); game.toast('최대 생명력이 줄었습니다!', 'warn'); }
  // 경직: 피해 ≥ 레벨
  if (!opts.noStun && d >= h.data.lvl && !P.uninterruptible && !P.whirl) {
    P.setAnim('hit', st.hitRecover);
    P.mv && finishStep(game.level, P);
    game.sfx(h.C.voice === 'female' ? 'hurt_female' : 'hurt_male', P.x, P.y, { vol: 0.8 });
    if (Math.random() < 0.5) h.durabilityLoss(Math.random() < 0.5 ? 'body' : 'head');
  }
  return d;
}

function finishStep(L, a) {
  // 걸음 중에 경직되면 가까운 칸으로 붙인다
  const m = a.mv;
  if (!m) return;
  const k = m.t / m.dur;
  const tx = k > 0.5 ? m.nx : m.fx, ty = k > 0.5 ? m.ny : m.fy;
  a.place(L, tx, ty);
}

export function knockback(game, t, src, n = 1) {
  if (!src) return;
  const L = game.level;
  const dx = Math.sign(Math.round(t.tx - src.tx)), dy = Math.sign(Math.round(t.ty - src.ty));
  if (!dx && !dy) return;
  let x = t.tx, y = t.ty;
  for (let i = 0; i < n; i++) { if (L.canStep(x, y, x + dx, y + dy, t.id)) { x += dx; y += dy; } else break; }
  if (x !== t.tx || y !== t.ty) {
    if (t.mv) finishStep(L, t);
    L.occ[t.ty * L.w + t.tx] === t.id && (L.occ[t.ty * L.w + t.tx] = 0);
    t.step(L, x, y);
    t.mv.dur = 0.12;
  }
}

export function freeze(t, sec) {
  if (t.boss) sec *= 0.4;
  if (t.rank === 'champion' || t.rank === 'unique') { addBuff(t, 'chill', { t: sec * 2 }); return; }
  addBuff(t, 'freeze', { t: sec });
  addBuff(t, 'chill', { t: sec + 2 });
}

// ───────── 죽음 ─────────
export function killActor(game, t, src, type) {
  if (t.dead) return;
  if (t.isPlayer) return killPlayer(game, t, src);
  t.dead = true; t.hp = 0;
  t.release(game.level);
  t.setAnim('death', t.mdef?.F?.bones || t.bones ? 0.7 : 0.9);
  t.fallDir = Math.random() < 0.7 ? 1 : -1;
  t.targeted = false;
  if (game.target === t) game.target = null;
  game.sfx(t.dieSfx || 'mon_die_small', t.x, t.y);
  if (t.mdef?.F?.bones || t.bones) game.fx.bone(t.x, t.y, 30, 10);
  else game.fx.blood(t.x, t.y, 30, Math.random() * 6.28, 16);
  if (t.kind === 'summon' || t.team === 0) { t.noCorpse = t.kind === 'summon'; return; }
  const P = game.player;
  // 경험치(디아블로 1): 기본 × (1 + (괴물 레벨 − 캐릭터 레벨)/10)
  const lvl = P.hero.data.lvl;
  let xp = Math.floor((t.xp || 0) * (1 + ((t.mlvl || 1) - lvl) / 10));
  if (xp > 0) {
    const ups = P.hero.gainExp(xp);
    if (ups) game.emit('levelUp', P.hero.data.lvl);
  }
  P.hero.data.kills = (P.hero.data.kills || 0) + 1;
  // 주변 타락귀 겁먹기
  for (const a of game.level.actors) if (a.mdef?.F?.ai === 'fallen' && !a.dead && a !== t && Math.hypot(a.x - t.x, a.y - t.y) < 5) a.fear = 1.5 + Math.random();
  // 화염 강화: 죽으면 터진다 / 냉기 강화: 서리 노바 / 산성: 웅덩이
  if (t.umods?.includes('fire')) { game.fx.explosion(t.x, t.y, 1.5); areaDamage(game, t.x, t.y, 1.6, [Math.round(t.mlvl), Math.round(t.mlvl * 2)], 'fire', t, 1); game.sfx('fireball_explode', t.x, t.y); }
  if (t.umods?.includes('cold')) { game.fx.ring(t.x, t.y, 0.2, 3, 0.4, [150, 210, 255], 3); areaDamage(game, t.x, t.y, 3, [Math.round(t.mlvl / 2), t.mlvl], 'cold', t, 1, { chill: 3 }); game.sfx('frost_nova', t.x, t.y); }
  if (t.mdef?.F?.ai === 'acid') spawnArea(game, { x: t.x, y: t.y, r: 1.0, dur: 4, vis: 'acidpool', dps: [t.dmg[0], t.dmg[1]], type: 'poison', team: 1, owner: t });
  if (!t.noDrop) dropLoot(game, t);
  onMonsterKilled(game, t);
  game.emit('killed', t);
}

function killPlayer(game, P, src) {
  if (P.dead) return;
  P.dead = true; P.hp = 0;
  P.setAnim('death', 1.2);
  P.fallDir = 1;
  game.sfx(P.hero.C.voice === 'female' ? 'die_female' : 'die_male', P.x, P.y);
  game.fx.blood(P.x, P.y, 30, 0, 20);
  game.stopAll();
  P.hero.data.deaths = (P.hero.data.deaths || 0) + 1;
  setTimeout(() => game.emit('playerDied', src), 1500);
}

// ───────── 괴물 공격 ─────────
export function monsterMeleeHit(game, m, t, mult = 1, extra = {}) {
  if (!t || t.dead) return false;
  if (Math.hypot(t.x - m.x, t.y - m.y) > 1.9 * (m.reach || 1)) return false;
  if (t.isPlayer) {
    const h = t.hero, st = h.st, P = t;
    const clvl = h.data.lvl, ml = m.mlvl || 1;
    const floor = game.depth >= 16 ? 30 : game.depth === 15 ? 25 : game.depth === 14 ? 20 : 15;
    let ch = 30 + (m.hit || 0) * (1 + (m.hitBonus || 0)) + 2 * (ml - clvl) - st.ac * (P.buffs.shout ? 1 : 1);
    ch = Math.max(floor, Math.min(100, ch));
    if (extra.sure) ch = 100;
    if (Math.random() * 100 >= ch) { game.fx.text(P.x, P.y, '회피', '#aaa', 11, 60, 0.6); return false; }
    // 회피(로그 기술)
    if (st.dodge && Math.random() * 100 < st.dodge) { game.fx.text(P.x, P.y, '회피', '#8fe08f', 11, 60, 0.6); P.setAnim('block', 0.15); return false; }
    // 막기: 민첩 + 2×(레벨 차) + 직업 보너스, 방패가 있고 서 있거나 공격 중일 때
    if (st.hasShield && !P.mv && (P.anim.name === 'idle' || P.anim.name === 'attack')) {
      const bl = clamp(st.block + 2 * (clvl - ml), 0, 75);
      if (Math.random() * 100 < bl) {
        P.setAnim('block', st.blockTime + 0.08);
        P.turnTo(m.x, m.y);
        game.sfx('block', P.x, P.y);
        game.fx.sparks(P.x, P.y, 34, 5);
        h.durabilityLoss('shield', 10);
        return false;
      }
    }
    let d = rnd(m.dmg[0], m.dmg[1]) * mult * (1 + (m.dmgBonus || 0));
    if (m.buffs?.battleCry) d *= 1 - m.buffs.battleCry.dmg;
    if (P.buffs.decoyTaunt) d = d;
    const dt = m.dtype && m.dtype !== 'phys' && !m.meleePhys ? m.dtype : 'phys';
    damageActor(game, P, Math.round(d), dt === 'magic' ? 'phys' : dt, m, { melee: true });
    // 강화 괴물의 추가 원소 피해
    if (m.umods) {
      if (m.umods.includes('fire')) damageActor(game, P, rnd(1, Math.max(2, m.mlvl)), 'fire', m, { noStun: true });
      if (m.umods.includes('light')) damageActor(game, P, rnd(1, Math.max(2, m.mlvl + 4)), 'light', m, { noStun: true });
      if (m.umods.includes('cold')) { damageActor(game, P, rnd(1, Math.max(2, m.mlvl)), 'cold', m, { noStun: true }); addBuff(P, 'chill', { t: 3 }); }
      if (m.umods.includes('manaburn')) { P.mp = Math.max(0, P.mp - rnd(m.mlvl, m.mlvl * 2)); game.fx.magic(P.x, P.y, 30, 6, [80, 120, 255]); }
      if (m.umods.includes('cursed') && Math.random() < 0.5) addBuff(P, 'amp', { t: 6 });
      if (m.umods.includes('spectral')) damageActor(game, P, rnd(1, m.mlvl), ['fire', 'cold', 'light', 'poison'][rnd(0, 3)], m, { noStun: true });
    }
    if (m.cold) addBuff(P, 'chill', { t: 2 });
    // 가시: 공격자도 다친다
    if (st.thorns) damageActor(game, m, rnd(st.thorns[0] || 1, st.thorns[1] || 3), 'phys', P, { noStun: true, quiet: true });
    if (st.lightThorns) damageActor(game, m, rnd(1, st.lightThorns), 'light', P, { noStun: true, quiet: true });
    if (P.buffs.frozenArmor && !m.dead) freeze(m, 1.2);
    h.durabilityLoss('body', 4);
    game.sfx(dt === 'phys' ? 'hit_flesh' : 'hit_flesh', P.x, P.y, { vol: 0.7 });
    return true;
  }
  // 소환수·미끼
  let d = rnd(m.dmg[0], m.dmg[1]) * mult * (1 + (m.dmgBonus || 0));
  damageActor(game, t, Math.round(d), 'phys', m, { melee: true });
  return true;
}

// ───────── 투사체 ─────────
export function spawnMissile(game, o) {
  const m = { z: 30, life: 2, hit: new Set(), ...o };
  game.level.missiles.push(m);
  return m;
}
// 괴물·함정의 원거리 공격
export function monsterShoot(game, m, tx, ty, kind, extra = {}) {
  const ang = Math.atan2(ty - m.y, tx - m.x);
  const def = MISSILES[kind];
  const n = extra.count || 1;
  for (let i = 0; i < n; i++) {
    const a = ang + (i - (n - 1) / 2) * 0.22;
    spawnMissile(game, {
      x: m.x + Math.cos(a) * 0.4, y: m.y + Math.sin(a) * 0.4, z: def.z ?? 32, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed,
      life: def.range / def.speed, owner: m, team: m.team, kind, vis: def.vis, dmg: extra.dmg || m.dmg, type: def.type, radius: def.radius || 0, light: def.light,
      tohit: def.tohit, blockable: def.blockable, ...extra,
    });
  }
}
export const MISSILES = {
  arrow: { speed: 11, range: 12, vis: 'arrow', type: 'phys', tohit: 'arrow', blockable: true },
  firebolt: { speed: 9, range: 12, vis: 'fire', type: 'fire', light: 2, blockable: true },
  fireball: { speed: 8, range: 12, vis: 'fireball', type: 'fire', radius: 1.2, light: 3, blockable: true },
  bloodstar: { speed: 8, range: 12, vis: 'blood', type: 'magic', light: 2, blockable: true },
  acid: { speed: 7, range: 9, vis: 'acid', type: 'poison', puddle: true, blockable: true },
  charged: { speed: 7, range: 7, vis: 'charged', type: 'light', light: 1.5 },
  magma: { speed: 8, range: 10, vis: 'fireball', type: 'fire', radius: 0.8, light: 2.5, blockable: true },
  bone: { speed: 9, range: 12, vis: 'bone', type: 'magic' },
  shadow: { speed: 8, range: 12, vis: 'shadow', type: 'magic', light: 1.5 },
};

export function updateMissiles(game, dt) {
  const L = game.level, list = L.missiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.delay > 0) { m.delay -= dt; continue; }
    m.life -= dt;
    if (m.update) m.update(game, m, dt);
    // 유도
    if (m.homing && !m.homing.dead) {
      const a = Math.atan2(m.homing.y - m.y, m.homing.x - m.x), sp = Math.hypot(m.vx, m.vy);
      const cur = Math.atan2(m.vy, m.vx);
      let d = ((a - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const na = cur + clamp(d, -dt * 7, dt * 7);
      m.vx = Math.cos(na) * sp; m.vy = Math.sin(na) * sp;
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(m.vx, m.vy) * dt / 0.3));
    let dead = m.life <= 0;
    for (let s = 0; s < steps && !dead; s++) {
      m.x += m.vx * dt / steps; m.y += m.vy * dt / steps;
      const tx = Math.round(m.x), ty = Math.round(m.y);
      if (!L.inb(tx, ty) || !L.floor[ty * L.w + tx] || (L.flags[ty * L.w + tx] & F_SOLID && L.flags[ty * L.w + tx] & F_OPAQUE && !m.ghost)) {
        dead = true; missileEnd(game, m, null); break;
      }
      // 플레이어 쪽 화살·주문은 통을 부수고 멈춘다
      if (m.team === 0 && game.smash) { const o = L.obj(tx, ty); if (o && o.type === 'barrel' && !o.broken) { game.smash(o); dead = true; missileEnd(game, m, null); break; } }
      // 맞을 대상
      for (const a of L.actors) {
        if (a.dead || a.team === m.team || m.hit.has(a) || a.invuln > 0 || (a.kind === 'npc')) continue;
        if (a.untargetable) continue;
        const r = (m.hitR || 0.45) + (a.big ? 0.2 : 0);
        if (Math.abs(a.x - m.x) > r || Math.abs(a.y - m.y) > r) continue;
        m.hit.add(a);
        const consumed = missileHit(game, m, a);
        if (consumed) { dead = true; break; }
      }
    }
    if (dead || m.life <= 0) {
      if (m.life <= 0 && !m.ended) missileEnd(game, m, null, true);
      list.splice(i, 1);
    }
  }
}

// 맞았을 때. 투사체가 사라지면 true
function missileHit(game, m, a) {
  if (m.onHit) return m.onHit(game, m, a);
  if (m.kind === 'arrow' && m.owner?.isPlayer) {
    const ok = arrowHit(game, m, a);
    if (m.mod?.explode) { missileEnd(game, m, a); return true; }
    if (ok && Math.random() * 100 < (m.pierce || 0)) return false;
    return true;
  }
  return monsterMissileHit(game, m, a) !== 'pass';
}

function monsterMissileHit(game, m, a) {
  if (m.radius) { missileEnd(game, m, a); return true; }
  if (a.isPlayer) {
    const st = a.hero.st, h = a.hero;
    const ml = m.owner?.mlvl || game.depth * 2;
    const floor = game.depth >= 14 ? 20 : 10;
    let ch = m.type === 'phys' ? 30 + (m.owner?.hit || 50) + 2 * (ml - h.data.lvl) - 2 * 3 - st.ac : 40 + 2 * (ml - h.data.lvl);
    if (m.trap) ch = 100 - (st.ac + 2 * h.data.lvl) / 2;
    ch = Math.max(floor, Math.min(100, ch));
    if (Math.random() * 100 >= ch) return true;
    if (st.avoid && Math.random() * 100 < st.avoid) { game.fx.text(a.x, a.y, '회피', '#8fe08f', 11, 60, 0.6); return true; }
    if (m.blockable && st.hasShield && !a.mv && (a.anim.name === 'idle' || a.anim.name === 'attack') && Math.random() * 100 < clamp(st.block + 2 * (h.data.lvl - ml), 0, 75)) {
      a.setAnim('block', st.blockTime + 0.08); game.sfx('block', a.x, a.y); return true;
    }
  }
  const d = rnd(m.dmg[0], m.dmg[1]) * (1 + (m.owner?.dmgBonus || 0));
  damageActor(game, a, Math.round(d), m.type, m.owner, { trap: m.trap, arrow: m.kind === 'arrow' });
  if (m.chill) addBuff(a, 'chill', { t: m.chill });
  if (m.kind === 'arrow') game.sfx('arrow_hit', a.x, a.y);
  if (m.vis === 'acid' && Math.random() < 0.5) spawnArea(game, { x: a.x, y: a.y, r: 0.8, dur: 3, vis: 'acidpool', dps: [Math.ceil(m.dmg[0] / 2), Math.ceil(m.dmg[1] / 2)], type: 'poison', team: m.team, owner: m.owner });
  return true;
}

// 투사체가 벽에 닿거나 대상에 맞아 끝날 때(폭발형)
function missileEnd(game, m, a, timeout = false) {
  if (m.ended) return;
  m.ended = true;
  if (m.onEnd) { m.onEnd(game, m, a, timeout); return; }
  if (m.radius) {
    const fire = m.type === 'fire';
    game.fx.explosion(m.x, m.y, m.radius, fire ? [255, 140, 40] : m.type === 'cold' ? [150, 210, 255] : [200, 120, 255], fire ? 'fire' : 'spark');
    game.sfx(fire ? 'fireball_explode' : 'explode_small', m.x, m.y);
    areaDamage(game, m.x, m.y, m.radius, m.dmg, m.type, m.owner, m.team, { chill: m.chill, freeze: m.freeze });
  } else if (m.vis === 'acid') {
    spawnArea(game, { x: m.x, y: m.y, r: 0.8, dur: 3, vis: 'acidpool', dps: [Math.ceil(m.dmg[0] / 2), Math.ceil(m.dmg[1] / 2)], type: 'poison', team: m.team, owner: m.owner });
  } else if (m.kind === 'arrow' && !timeout) {
    game.fx.sparks(m.x, m.y, m.z, 3, [220, 200, 160]);
  }
}

// 범위 피해(팀이 다른 액터 모두)
export function areaDamage(game, x, y, r, dmg, type, src, team, extra = {}) {
  let n = 0;
  // 플레이어 쪽 폭발·노바 등은 둘레의 통도 부순다
  if (team === 0 && game.smash) for (const o of game.level.objects) if (o.type === 'barrel' && !o.broken && Math.hypot(o.x - x, o.y - y) <= r + 0.3) game.smash(o);
  for (const a of game.level.actors.slice()) {
    if (a.dead || a.team === team || a.kind === 'npc') continue;
    if (Math.hypot(a.x - x, a.y - y) > r + 0.3) continue;
    const d = rnd(dmg[0], dmg[1]);
    if (extra.hitFn) extra.hitFn(a);
    damageActor(game, a, d, type, src, { noStun: extra.noStun, stun: extra.stun, quiet: n > 3 });
    if (extra.chill && !a.dead) addBuff(a, 'chill', { t: extra.chill });
    if (extra.freeze && !a.dead) freeze(a, extra.freeze);
    if (extra.knock && !a.dead) knockback(game, a, { tx: Math.round(x), ty: Math.round(y), x, y }, 1);
    n++;
  }
  return n;
}

// 충전된 번개(제멋대로 튀는 불똥)
export function spawnChargedBolts(game, src, n, dmg, team) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 5 + Math.random() * 2;
    spawnMissile(game, {
      x: src.x, y: src.y, z: 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.2, owner: src, team, kind: 'charged', vis: 'charged', dmg, type: 'light', light: 1,
      update: (g, m, dt) => { m.jit = (m.jit || 0) + dt; if (m.jit > 0.12) { m.jit = 0; const na = Math.atan2(m.vy, m.vx) + (Math.random() - 0.5) * 1.6, s = Math.hypot(m.vx, m.vy); m.vx = Math.cos(na) * s; m.vy = Math.sin(na) * s; } },
    });
  }
}

// ───────── 장판 ─────────
export function spawnArea(game, o) {
  const ar = { t: 0, tick: 0, ...o };
  game.level.areas.push(ar);
  return ar;
}
export function updateAreas(game, dt) {
  const L = game.level, list = L.areas;
  for (let i = list.length - 1; i >= 0; i--) {
    const ar = list[i];
    ar.t += dt;
    if (ar.update) ar.update(game, ar, dt);
    else if (ar.dps) {
      ar.tick += dt;
      if (ar.tick >= 0.25) {
        ar.tick -= 0.25;
        const cells = ar.cells;
        for (const a of L.actors.slice()) {
          if (a.dead || a.team === ar.team || a.kind === 'npc') continue;
          let inside = false;
          if (cells) inside = cells.some((c) => Math.abs(a.x - c[0]) < 0.75 && Math.abs(a.y - c[1]) < 0.75);
          else inside = Math.hypot(a.x - ar.x, a.y - ar.y) <= ar.r + 0.2;
          if (!inside) continue;
          const d = (ar.dps[0] + Math.random() * (ar.dps[1] - ar.dps[0])) * 0.25;
          damageActor(game, a, Math.max(1, Math.round(d)), ar.type, ar.owner, { noStun: true, quiet: true, quietNum: true });
          if (ar.chill && !a.dead) addBuff(a, 'chill', { t: ar.chill });
        }
      }
    }
    if (ar.t >= ar.dur) { ar.onEnd?.(game, ar); list.splice(i, 1); }
  }
}

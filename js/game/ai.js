// 괴물 생성과 인공지능: 디아블로 1 계열별 행동(도망치는 타락귀, 시체 먹는 청소부, 투명한 숨은 자, 돌이 되는 가고일, 돌진하는 뿔 악마 등)
import { Actor } from './actor.js';
import { MONSTERS, FAMILIES, BOSSES, CHAMP_TYPES, UMODS, UNAME_A, UNAME_B, monsterLook } from '../data/monsters.js';
import { monsterMeleeHit, monsterShoot, damageActor, areaDamage, spawnArea, spawnMissile, knockback, MISSILES } from './combat.js';
import { addBuff } from './buffs.js';
import { DIRS } from '../core/util.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = (p) => Math.random() < p;
const RES = { I: 100, R: 75, '-': 0 };

// 저항 문자열 → { poison, fire, light, cold }
function parseRes(s) {
  return { poison: RES[s[0]] || 0, fire: RES[s[1]] || 0, light: RES[s[2]] || 0, cold: RES[s[3] || '-'] || 0 };
}

export function spawnMonster(game, L, defId, x, y, opts = {}) {
  const def = MONSTERS[defId];
  if (!def) throw new Error('괴물 없음 ' + defId);
  const F = def.F;
  const a = new Actor('monster', x, y);
  a.team = 1;
  a.mdef = def; a.F = F;
  a.name = def.name;
  a.mlvl = def.lvl;
  a.hpMax = a.hp = rnd(def.hp[0], def.hp[1]);
  a.ac = def.ac; a.hit = def.hit; a.dmg = def.dmg.slice(); a.xp = def.xp; a.int = def.int;
  a.res = parseRes(def.res);
  a.ai = F.ai;
  a.speed = 1 / F.walk;
  a.atk = F.atk; a.hitT = F.hit;
  a.look = monsterLook(def);
  a.glowCol = def.glow || null;
  a.dtype = F.dtype || 'phys';
  a.meleePhys = true;
  a.dieSfx = F.die;
  a.bones = !!F.bones;
  a.noDrop = !!F.noDrop;
  a.big = (a.look.scale || 1) > 1.05 || (a.look.h || 1) > 1.15;
  a.rank = 'normal';
  a.home = { x, y };
  a.buffs = {};
  a.face = Math.random() * Math.PI * 2; a.faceTo = a.face;
  if (F.ai === 'garg') { a.stone = true; a.setAnim('stone', 1); }
  if (F.ai === 'sneak') a.invis = 0;
  if (F.ai === 'mage') a.invis = 1;
  a.place(L, x, y);
  L.actors.push(a);
  return a;
}

export function spawnBoss(game, L, bossId, x, y) {
  const B = BOSSES[bossId];
  const base = MONSTERS[Object.keys(MONSTERS).find((k) => MONSTERS[k].fam === B.fam)];
  const a = spawnMonster(game, L, base.id, x, y);
  a.name = B.name; a.mlvl = B.lvl; a.ilvl = B.ilvl || B.lvl;
  a.hpMax = a.hp = B.hp; a.ac = B.ac; a.hit = B.hit; a.dmg = B.dmg.slice(); a.xp = B.xp;
  a.res = parseRes(B.res);
  a.ai = B.ai || a.ai;
  if (B.walk) a.speed = 1 / B.walk;
  if (B.atk) { a.atk = B.atk; a.hitT = B.hit2 || B.atk * 0.55; }
  if (B.look) a.look = B.look; else if (B.lookFrom) { const v = FAMILIES[B.lookFrom[0]].v[B.lookFrom[1]]; a.look = FAMILIES[B.lookFrom[0]].look(v[11], {}); a.look.aura = 'rgba(200,40,40,0.6)'; }
  a.look = { ...a.look, aura: a.look.aura || 'rgba(220,160,60,0.55)' };
  a.glowCol = B.glow || a.glowCol;
  a.rank = 'unique'; a.boss = true; a.bossId = bossId; a.quest = B.quest;
  a.spell = B.spell; a.dtype = B.dtype || a.dtype;
  if (B.missile) a.missile = B.missile;
  a.dieSfx = B.die || a.dieSfx; a.roar = B.sfx;
  a.bones = !!B.bones;
  a.stone = false; a.invis = null;
  if (a.anim.name === 'stone') a.setAnim('idle', 1);
  a.big = true;
  a.alwaysDrop = 3;
  if (B.drop) a.questDrop = B.drop;
  return a;
}

// 우두머리 이름(디아블로 2처럼 무작위)
export function uniqueName() { return `${UNAME_A[rnd(0, UNAME_A.length - 1)]} ${UNAME_B[rnd(0, UNAME_B.length - 1)]}`; }

// 이름 붙은 괴물과 졸개들
export function makeUniquePack(game, L, defId, x, y, nMods = 1) {
  const a = spawnMonster(game, L, defId, x, y);
  a.rank = 'unique';
  a.name = uniqueName();
  a.mlvl += 3; a.hpMax = a.hp = Math.round(a.hpMax * 4); a.xp *= 5;
  a.ac += 10; a.hit += 15;
  const pool = UMODS.filter((m) => !m.ranged || a.ai === 'archer' || a.ai === 'kite');
  a.umods = [];
  for (let i = 0; i < nMods; i++) { const m = pool[rnd(0, pool.length - 1)]; if (!a.umods.includes(m.id)) a.umods.push(m.id); }
  applyMods(a);
  a.look = { ...a.look, aura: 'rgba(220,170,60,0.6)' };
  a.alwaysDrop = 1;
  const minions = [];
  for (let i = 0; i < rnd(3, 6); i++) {
    const p = L.nearestFree(x + rnd(-2, 2), y + rnd(-2, 2), 4);
    if (!p) continue;
    const m = spawnMonster(game, L, defId, p.x, p.y);
    m.rank = 'minion'; m.leader = a; m.mlvl += 3; m.hpMax = m.hp = Math.round(m.hpMax * 2); m.xp *= 5;
    if (a.umods.includes('fast')) m.speed *= 1.5;
    if (a.umods.includes('strong')) m.dmgBonus = 0.67;
    minions.push(m);
  }
  return [a, ...minions];
}
function applyMods(a) {
  for (const id of a.umods) {
    if (id === 'strong') { a.dmgBonus = (a.dmgBonus || 0) + 1.35; a.hitBonus = 0.9; }
    if (id === 'fast') { a.speed *= 2; a.atk *= 0.75; a.hitT *= 0.75; }
    if (id === 'magicres') { for (const k of ['fire', 'light', 'cold']) a.res[k] = Math.min(100, a.res[k] < 100 ? a.res[k] + 40 : 100); }
    if (id === 'fire') { a.res.fire = Math.max(a.res.fire, 75); a.glowCol = [255, 110, 40]; }
    if (id === 'light') { a.res.light = Math.max(a.res.light, 75); a.glowCol = [150, 180, 255]; }
    if (id === 'cold') { a.res.cold = Math.max(a.res.cold, 75); a.glowCol = [150, 210, 255]; a.cold = true; }
    if (id === 'stone') { a.physRes = 50; a.ac *= 2; }
    if (id === 'spectral') { for (const k of ['fire', 'light', 'cold']) a.res[k] = Math.max(a.res[k], 40); }
  }
}
export function makeChampionPack(game, L, defId, x, y) {
  const out = [];
  const n = rnd(2, 4);
  const last = CHAMP_TYPES[rnd(0, CHAMP_TYPES.length - 1)];
  for (let i = 0; i < n; i++) {
    const p = i === 0 ? { x, y } : L.nearestFree(x + rnd(-2, 2), y + rnd(-2, 2), 4);
    if (!p) continue;
    const a = spawnMonster(game, L, defId, p.x, p.y);
    const T = i === n - 1 ? last : CHAMP_TYPES[0];
    a.rank = 'champion'; a.champ = T.id;
    a.name = `${T.name} ${a.name}`;
    a.mlvl += 2; a.hpMax = a.hp = Math.round(a.hpMax * T.hp); a.xp *= T.xp || 3;
    a.dmgBonus = T.dmg; a.hitBonus = T.hit;
    if (T.speed) a.speed *= 1 + T.speed * 0.5;
    if (T.def) a.ac = Math.round(a.ac * (1 + T.def));
    if (T.physRes) a.physRes = T.physRes;
    if (T.ghost) a.invis = 0.55;
    if (T.cold) a.cold = true;
    a.look = { ...a.look, aura: 'rgba(80,120,255,0.55)' };
    a.alwaysDrop = 1;
    out.push(a);
  }
  return out;
}

// ───────── 갱신 ─────────
export function updateMonster(game, a, dt) {
  const L = game.level, P = game.player;
  if (a.ai === 'none') return;
  if (a.invuln > 0) a.invuln -= dt;
  const frozen = a.buffs.freeze || a.buffs.stun;
  const rate = a.buffs.chill ? 0.5 : 1;
  if (a.ttl != null) { a.ttl -= dt; if (a.ttl <= 0) { a.dead = true; a.noCorpse = true; a.release(L); a.setAnim('death', 0.3); game.fx.magic(a.x, a.y, 30, 10, [150, 150, 255]); return; } }
  if (a.mv) {
    if (frozen) return;
    a.advance(L, dt * rate * (a.dash || 1));
    a.tickFace(dt);
    if (a.mv) { a.moving = true; return; }
    a.dash = 0;
  }
  a.moving = false;
  a.tickFace(dt);
  const A = a.anim;
  if (A.name === 'stone') { stoneForm(game, a, dt); return; }
  if (A.name !== 'idle' && A.name !== 'walk') {
    if (frozen) return;
    const prev = A.t;
    A.t += dt * rate;
    if (A.hitAt != null && A.onHit && prev < A.hitAt * A.dur && A.t >= A.hitAt * A.dur) { const f = A.onHit; A.onHit = null; f(); }
    if (A.t >= A.dur) a.setAnim('idle', 1); else return;
  }
  if (frozen) return;
  if (a.wait > 0) { a.wait -= dt; return; }
  // 멀리 있는 괴물은 잠든다
  const dP = Math.hypot(a.x - P.x, a.y - P.y);
  if (dP > 24 && a.kind === 'monster') { a.aware = false; return; }
  const fn = AI[a.ai] || AI.melee;
  fn(game, a, dt, dP);
}

// 공격 대상: 플레이어 또는 가까운 소환수(미끼가 있으면 미끼)
function pickTarget(game, a) {
  const P = game.player;
  let best = P.dead ? null : P, bd = P.dead ? 1e9 : Math.hypot(a.x - P.x, a.y - P.y);
  for (const s of game.level.actors) {
    if (s.team !== 0 || s.dead || s === P || s.kind === 'npc') continue;
    let d = Math.hypot(a.x - s.x, a.y - s.y);
    if (s.ai === 'decoy') d -= 4;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// 깨어나기: 빛 반경 안에서 서로 보이면(디아블로 1)
function wake(game, a, dP) {
  if (a.aware) {
    if (dP > 15) { a.lostT = (a.lostT || 0) + 0.1; if (a.lostT > 12) { a.aware = false; a.lostT = 0; } } else a.lostT = 0;
    return true;
  }
  const P = game.player;
  if (P.dead) return false;
  if (dP < Math.min(9.5, game.lightRadius() + 1.5) && game.level.los(a.tx, a.ty, P.tx, P.ty)) {
    a.aware = true;
    if (a.roar) { game.sfx(a.roar, a.x, a.y); a.roar = null; }
    else if (chance(0.4)) game.sfx(a.F?.sfx || 'mon_growl', a.x, a.y, { vol: 0.7 });
    // 무리가 함께 깨어난다
    for (const o of game.level.actors) if (o.team === 1 && !o.aware && Math.hypot(o.x - a.x, o.y - a.y) < 5) o.aware = true;
    return true;
  }
  return false;
}

// 한 걸음: 대상 쪽으로(거리 지도 우선), 막히면 옆으로
function stepToward(game, a, t, flee = false) {
  const L = game.level, P = game.player;
  // 문을 여는 괴물(디아블로 1의 산양족·가고일·마법사 등): 대상 쪽으로 난 닫힌 문이 바로 옆이면 연다
  if (!flee && (a.F?.doors || a.boss)) for (let d = 0; d < 8; d += 2) {
    const nx = a.tx + DIRS[d][0], ny = a.ty + DIRS[d][1], o = L.obj(nx, ny);
    if (o && o.type === 'door' && !o.open && !o.locked && Math.hypot(nx - t.x, ny - t.y) < Math.hypot(a.tx - t.x, a.ty - t.y)) { game.openDoor(o); a.wait = 0.3; return true; }
  }
  let best = null, bs = flee ? -1e9 : 1e9;
  const useMap = t === P && !flee && game.dmap.at(a.tx, a.ty) < 1e8;
  for (let d = 0; d < 8; d++) {
    const nx = a.tx + DIRS[d][0], ny = a.ty + DIRS[d][1];
    if (!L.canStep(a.tx, a.ty, nx, ny, a.id)) continue;
    // 문은 열 수 있는 괴물만(닫힌 문은 막힌 칸이다)
    let s;
    if (useMap) s = game.dmap.at(nx, ny) + Math.hypot(nx - t.x, ny - t.y) * 0.05;
    else s = Math.hypot(nx - t.x, ny - t.y);
    if (flee) { if (s > bs) { bs = s; best = [nx, ny]; } }
    else if (s < bs) { bs = s; best = [nx, ny]; }
  }
  if (!best) return false;
  // 가까워지지 않으면(막혀서 돌아가야 하면) 지도 값이 낮을 때만
  if (!flee && !useMap && bs > Math.hypot(a.tx - t.x, a.ty - t.y) + 0.5) return false;
  if (useMap && bs >= game.dmap.at(a.tx, a.ty) + 0.5 && Math.hypot(a.tx - t.x, a.ty - t.y) < 3) return false;
  a.step(L, best[0], best[1]);
  return true;
}
function wander(game, a) {
  const L = game.level;
  if (chance(0.6)) { a.wait = 0.5 + Math.random() * 2; return; }
  const d = DIRS[rnd(0, 7)];
  const nx = a.tx + d[0], ny = a.ty + d[1];
  if (Math.hypot(nx - a.home.x, ny - a.home.y) > 5) return;
  if (L.canStep(a.tx, a.ty, nx, ny, a.id)) a.step(L, nx, ny);
}
function adjacent(a, t) { return Math.max(Math.abs(a.tx - t.tx), Math.abs(a.ty - t.ty)) <= 1 && Math.hypot(a.x - t.x, a.y - t.y) < 1.6; }

function meleeSwing(game, a, t, mult = 1, extra = {}) {
  a.turnTo(t.x, t.y);
  const dur = a.atk, hit = a.hitT;
  a.setAnim('attack', dur, { hitAt: hit / dur, style: extra.style, onHit: () => { monsterMeleeHit(game, a, t, mult, extra); if (extra.after) extra.after(); } });
  if (chance(0.25)) game.sfx('mon_attack', a.x, a.y, { vol: 0.5 });
}

function shoot(game, a, t, kind, extra = {}) {
  a.turnTo(t.x, t.y);
  const dur = a.atk, hit = a.hitT;
  const style = kind === 'arrow' ? 'bow' : null;
  a.setAnim(kind === 'arrow' ? 'attack' : 'cast', dur, { hitAt: hit / dur, style, onHit: () => {
    const n = a.umods?.includes('multi') ? 3 : 1;
    if (kind === 'lightning') {
      game.fx.bolt(a.x, a.y, 40, t.x, t.y, 30, [180, 200, 255], 0.25, 2);
      if (game.level.los(a.tx, a.ty, t.tx, t.ty)) damageActor(game, t, rnd(a.dmg[0], a.dmg[1]), 'light', a);
      game.sfx('lightning', a.x, a.y, { vol: 0.7 });
    } else if (kind === 'inferno') {
      // 짧은 불길 줄기
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      for (let k = 1; k <= 4; k++) { const x = a.x + Math.cos(ang) * k * 0.8, y = a.y + Math.sin(ang) * k * 0.8; game.fx.fire(x, y, 20, 4); }
      if (Math.hypot(t.x - a.x, t.y - a.y) < 3.6) damageActor(game, t, rnd(a.dmg[0], a.dmg[1]), 'fire', a);
      game.sfx('fire_wall', a.x, a.y, { vol: 0.6 });
    } else if (kind === 'flash') {
      game.fx.ring(a.x, a.y, 0.2, 2, 0.3, [255, 255, 255], 3, true);
      if (Math.hypot(t.x - a.x, t.y - a.y) < 2) damageActor(game, t, rnd(a.dmg[0], a.dmg[1]), 'magic', a);
      game.sfx('nova', a.x, a.y, { vol: 0.6 });
    } else {
      monsterShoot(game, a, t.x, t.y, kind, { count: n, dmg: a.dmg, chill: a.cold ? 2 : 0 });
      game.sfx(kind === 'arrow' ? 'bow_shoot' : kind === 'acid' ? 'acid_spit' : kind === 'charged' ? 'charged_bolt' : 'mon_cast', a.x, a.y, { vol: 0.6 });
    }
  } });
}

const AI = {
  // 기본 근접: 다가가서 친다
  melee(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) { wander(game, a); return; }
    if (a.fear > 0) { a.fear -= 0.3; stepToward(game, a, t, true); a.wait = 0.1; return; }
    if (adjacent(a, t)) { meleeSwing(game, a, t); a.wait = Math.max(0, 0.35 - a.int * 0.08) * Math.random(); return; }
    if (!stepToward(game, a, t)) a.wait = 0.2 + Math.random() * 0.3;
  },
  zombie(game, a, dt, dP) {
    if (!wake(game, a, Math.min(dP, dP * 1.3))) { wander(game, a); return; }
    AI.melee(game, a, dt, dP);
    if (chance(0.01)) game.sfx('mon_zombie', a.x, a.y, { vol: 0.5 });
  },
  // 타락귀: 동료가 죽으면 겁먹고 달아났다가 함성을 지르고 돌아온다
  fallen(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    if (a.fear > 0) {
      a.fear -= 0.25;
      if (!a.fled) { a.fled = true; game.sfx('mon_imp_flee', a.x, a.y, { vol: 0.6 }); }
      stepToward(game, a, t, true);
      if (a.fear <= 0 && chance(0.5)) {
        // 함성: 주변 타락귀가 힘을 얻는다
        a.setAnim('special', 0.6);
        game.sfx('mon_imp', a.x, a.y);
        for (const o of game.level.actors) if (o.team === 1 && o.F?.ai === 'fallen' && Math.hypot(o.x - a.x, o.y - a.y) < 6) { o.fear = 0; o.rage = 6; o.hp = Math.min(o.hpMax, o.hp + 2 * o.int + 2); }
        a.fled = false;
      }
      return;
    }
    if (a.rage > 0) a.rage -= 0.2;
    AI.melee(game, a, dt, dP);
  },
  // 궁수: 가까우면 물러나고, 아니면 쏜다
  archer(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const d = Math.hypot(a.x - t.x, a.y - t.y);
    const los = game.level.los(a.tx, a.ty, t.tx, t.ty);
    if (d < 3 && chance(0.7)) { if (stepToward(game, a, t, true)) return; }
    if (los && d < 11) { shoot(game, a, t, a.missile || a.F.missile || 'arrow'); a.wait = Math.random() * 0.8; return; }
    if (!stepToward(game, a, t)) a.wait = 0.3;
  },
  // 청소부: 생명력이 반 아래면 시체를 먹으러 간다
  scav(game, a, dt, dP) {
    if (a.hp < a.hpMax / 2 && !a.eating) {
      let best = null, bd = 10;
      for (const c of game.level.corpses) { if (c.eaten) continue; const d = Math.hypot(c.x - a.x, c.y - a.y); if (d < bd) { bd = d; best = c; } }
      if (best) {
        if (bd < 1.5) { a.eating = best; a.setAnim('attack', 0.8, { style: 'bite' }); return; }
        if (!stepToward(game, a, best)) a.wait = 0.3;
        return;
      }
    }
    if (a.eating) {
      a.hp = Math.min(a.hpMax, a.hp + Math.max(1.5, a.hpMax * 0.05));
      game.fx.blood(a.eating.x, a.eating.y, 5, Math.random() * 6, 2);
      if (a.hp >= a.hpMax * 0.75) { a.eating.eaten = true; a.eating.fade = 0.5; a.eating = null; }
      else { a.setAnim('attack', 0.6, { style: 'bite' }); return; }
    }
    AI.melee(game, a, dt, dP);
  },
  // 날개 악마: 치고 빠지기
  bat(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    if (a.retreat > 0) { a.retreat--; if (!stepToward(game, a, t, true)) a.retreat = 0; return; }
    if (adjacent(a, t)) {
      meleeSwing(game, a, t, 1, { after: () => { a.retreat = rnd(2, 4); if (a.mdef.zap) monsterShoot(game, a, t.x, t.y, 'charged', { dmg: [1, 10] }); } });
      return;
    }
    if (!stepToward(game, a, t)) a.wait = 0.2;
  },
  // 숨은 자: 가까이 오면 모습을 드러내고, 맞으면 물러나 다시 숨는다
  sneak(game, a, dt, dP) {
    if (!wake(game, a, dP)) { a.invis = 0; wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const d = Math.hypot(a.x - t.x, a.y - t.y);
    const showAt = 4 - a.int * 0.5;
    a.invis = a.retreat > 0 ? Math.max(0, (a.invis ?? 0) - 0.3) : d < showAt ? Math.min(1, (a.invis ?? 0) + 0.35) : Math.max(0, (a.invis ?? 0) - 0.2);
    a.untargetable = a.invis < 0.3;
    if (a.retreat > 0) { a.retreat--; if (!stepToward(game, a, t, true)) a.retreat = 0; return; }
    AI.melee(game, a, dt, dP);
  },
  // 산양족: 빙 돌다가 파고든다
  goat(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const d = Math.hypot(a.x - t.x, a.y - t.y);
    if (d < 3.5 && d > 1.5 && chance(0.35)) {
      // 옆으로 돈다
      const ang = Math.atan2(a.y - t.y, a.x - t.x) + (a.id % 2 ? 0.8 : -0.8);
      const nx = Math.round(t.x + Math.cos(ang) * d), ny = Math.round(t.y + Math.sin(ang) * d);
      const sx = Math.sign(nx - a.tx), sy = Math.sign(ny - a.ty);
      if ((sx || sy) && game.level.canStep(a.tx, a.ty, a.tx + sx, a.ty + sy, a.id)) { a.step(game.level, a.tx + sx, a.ty + sy); return; }
    }
    // 생명력이 낮으면 회전 공격
    if (adjacent(a, t) && a.hp < a.hpMax / 2 && chance(0.25)) { meleeSwing(game, a, t, 1.4, { style: 'spin' }); return; }
    AI.melee(game, a, dt, dP);
  },
  // 가고일: 돌로 있다가 깨어나고, 다치면 날아가 돌이 되어 회복
  garg(game, a, dt, dP) {
    if (!wake(game, a, dP)) return;
    if (a.hp < a.hpMax / 2 && !a.healedOnce) {
      a.healedOnce = true; a.fleeT = 6;
    }
    if (a.fleeT > 0) {
      // 몇 걸음 달아난 뒤(막히면 그 자리에서) 돌이 되어 회복한다
      a.fleeT--;
      const t = pickTarget(game, a);
      if (a.fleeT > 0 && t && stepToward(game, a, t, true)) return;
      a.fleeT = 0; a.stone = true; a.setAnim('stone', 1); a.stoneHeal = true;
      return;
    }
    AI.melee(game, a, dt, dP);
  },
  // 산성 짐승: 거리를 두고 침을 뱉는다
  acid(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const d = Math.hypot(a.x - t.x, a.y - t.y);
    if (adjacent(a, t)) { meleeSwing(game, a, t, 1, { style: 'bite' }); return; }
    if (d < 7 && game.level.los(a.tx, a.ty, t.tx, t.ty) && chance(0.6)) { shoot(game, a, t, 'acid'); a.wait = 0.3 + Math.random() * 0.6; return; }
    if (!stepToward(game, a, t)) a.wait = 0.3;
  },
  // 마그마·폭풍 악마: 멀면 주문, 가까우면 근접
  caster_melee(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const d = Math.hypot(a.x - t.x, a.y - t.y);
    if (adjacent(a, t)) {
      meleeSwing(game, a, t, 1, { after: () => { if (chance(0.5) && adjacent(a, t)) monsterMeleeHit(game, a, t, 0.8); } });
      return;
    }
    if (d < 9 && d > 2 && game.level.los(a.tx, a.ty, t.tx, t.ty) && chance(0.35)) {
      shoot(game, a, t, a.F.missile === 'fireball' ? 'magma' : a.F.missile);
      a.wait = 0.5 + Math.random();
      return;
    }
    if (!stepToward(game, a, t)) a.wait = 0.3;
  },
  // 뿔 악마: 멀리서 돌진
  charge(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const d = Math.hypot(a.x - t.x, a.y - t.y);
    const L = game.level;
    // 돌진 중이면 닿거나 막힐 때까지 곧장 달린다
    if (a.charging) { chargeStep(game, a, t); return; }
    if (d > 4 && d < 10 && L.clearPath(a.x, a.y, t.x, t.y) && chance(0.4)) {
      a.charging = true;
      game.sfx('mon_beast', a.x, a.y);
      chargeStep(game, a, t);
      return;
    }
    AI.melee(game, a, dt, dP);
  },
  // 대악마: 근접 + 불길
  mega(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const d = Math.hypot(a.x - t.x, a.y - t.y);
    if (d < 3.4 && d > 1.4 && chance(0.4) && game.level.los(a.tx, a.ty, t.tx, t.ty)) { shoot(game, a, t, 'inferno'); a.wait = 0.3; return; }
    AI.melee(game, a, dt, dP);
  },
  // 독사: 두 칸 거리에서 덤벼든다
  snake(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const d = Math.hypot(a.x - t.x, a.y - t.y);
    if (d >= 1.8 && d < 2.9 && chance(0.5)) {
      if (stepToward(game, a, t)) { a.dash = 2.5; a.lunge = t; return; }
    }
    if (a.lunge && adjacent(a, a.lunge)) { meleeSwing(game, a, a.lunge, 1.2, { sure: true, style: 'bite' }); a.lunge = null; return; }
    a.lunge = null;
    AI.melee(game, a, dt, dP);
  },
  // 서큐버스: 거리를 두고 핏빛 별
  kite(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const d = Math.hypot(a.x - t.x, a.y - t.y);
    if (d < 3 && chance(0.6) && stepToward(game, a, t, true)) return;
    if (d < 10 && game.level.los(a.tx, a.ty, t.tx, t.ty)) { shoot(game, a, t, a.missile || 'bloodstar'); a.wait = 0.4 + Math.random() * 0.8; return; }
    if (!stepToward(game, a, t)) a.wait = 0.3;
  },
  // 흑마법사: 사라졌다 나타나며 주문, 붙으면 섬광
  mage(game, a, dt, dP) {
    if (!wake(game, a, dP)) { wander(game, a); return; }
    const t = pickTarget(game, a);
    if (!t) return;
    const L = game.level, d = Math.hypot(a.x - t.x, a.y - t.y);
    if (a.invis < 1) a.invis = Math.min(1, (a.invis ?? 1) + 0.25);
    a.untargetable = a.invis < 0.4;
    if (d < 1.8) { shoot(game, a, t, 'flash'); a.wait = 0.4; return; }
    if ((a.hp < a.hpMax / 2 && chance(0.3)) || chance(0.12) || !L.los(a.tx, a.ty, t.tx, t.ty)) {
      // 순간 이동(사라졌다가 다른 곳에)
      const ang = Math.random() * Math.PI * 2, r = 3 + Math.random() * 4;
      const p = L.nearestFree(Math.round(t.x + Math.cos(ang) * r), Math.round(t.y + Math.sin(ang) * r), 2, a.id, (x, y) => L.los(x, y, t.tx, t.ty));
      if (p) { game.fx.magic(a.x, a.y, 30, 10, [150, 120, 255]); a.place(L, p.x, p.y); a.invis = 0; game.fx.magic(a.x, a.y, 30, 10, [150, 120, 255]); game.sfx('teleport', a.x, a.y, { vol: 0.5 }); a.wait = 0.3; return; }
    }
    const spell = a.spell || a.mdef?.spell || 'firebolt';
    if (d < 11) { shoot(game, a, t, spell === 'lightning' ? 'lightning' : spell); a.wait = 0.6 + Math.random() * 0.8; return; }
    stepToward(game, a, t);
  },
  // 망자의 왕: 해골을 일으킨다
  king(game, a, dt, dP) {
    if (!wake(game, a, dP)) return;
    // 깨어난 지 4초 뒤부터 7초마다(판단 횟수가 아니라 시간으로)
    a.raiseAt ??= game.time + 4;
    if (game.time >= a.raiseAt) {
      a.raiseAt = game.time + 7;
      const L = game.level;
      const bones = L.corpses.filter((c) => !c.eaten && c.monRef && MONSTERS[c.type]?.F?.bones && Math.hypot(c.x - a.x, c.y - a.y) < 9).slice(0, 3);
      let n = 0;
      for (const c of bones) {
        const p = L.nearestFree(Math.round(c.x), Math.round(c.y), 2);
        if (!p) continue;
        const s = spawnMonster(game, L, c.type, p.x, p.y);
        s.aware = true; c.eaten = true; c.fade = 0; L.corpses.splice(L.corpses.indexOf(c), 1);
        game.fx.magic(s.x, s.y, 20, 14, [200, 255, 200]); n++;
      }
      if (n < 2) for (let i = 0; i < 2 - n; i++) {
        const p = L.nearestFree(a.tx + rnd(-2, 2), a.ty + rnd(-2, 2), 3);
        if (!p) continue;
        const s = spawnMonster(game, L, game.depth >= 3 ? 'corpseaxe' : 'skeleton', p.x, p.y);
        s.aware = true; game.fx.magic(s.x, s.y, 20, 14, [200, 255, 200]);
      }
      a.setAnim('special', 0.8);
      game.sfx('summon', a.x, a.y);
      return;
    }
    AI.melee(game, a, dt, dP);
  },
  // 최종 보스: 근접(넉백) + 공허의 종말(피할 수 없는 광역) + 하수인 소환
  lord(game, a, dt, dP) {
    if (!wake(game, a, dP)) return;
    const t = pickTarget(game, a);
    if (!t) return;
    a.apoAt ??= game.time + 6;
    a.sumAt ??= game.time + 12;
    if (game.time >= a.apoAt && Math.hypot(a.x - t.x, a.y - t.y) < 12) {
      a.apoAt = game.time + 7 + Math.random() * 3;
      a.setAnim('special', 1.0, { hitAt: 0.7, onHit: () => {
        game.fx.ring(a.x, a.y, 0.5, 9, 0.8, [255, 60, 30], 5, true); game.fx.shake(0.8);
        game.sfx('meteor_impact', a.x, a.y);
        for (const o of game.level.actors) {
          if (o.dead || o.team === a.team || o.kind === 'npc' || Math.hypot(o.x - a.x, o.y - a.y) > 10) continue;
          game.fx.explosion(o.x, o.y, 0.8, [255, 50, 30]);
          damageActor(game, o, rnd(20, 40), 'magic', a, { pure: true });
        }
      } });
      game.sfx('boss_roar', a.x, a.y);
      return;
    }
    if (game.time >= a.sumAt) {
      a.sumAt = game.time + 14;
      for (let i = 0; i < 3; i++) {
        const p = game.level.nearestFree(a.tx + rnd(-3, 3), a.ty + rnd(-3, 3), 3);
        if (p) { const s = spawnMonster(game, game.level, rnd(0, 1) ? 'blood_knight' : 'advocate', p.x, p.y); s.aware = true; game.fx.magic(s.x, s.y, 20, 16, [255, 60, 40]); }
      }
      a.setAnim('special', 0.8);
      return;
    }
    if (adjacent(a, t)) { meleeSwing(game, a, t, 1, { after: () => knockback(game, t, a, 2) }); return; }
    AI.melee(game, a, dt, dP);
  },
  // 그림자 전사(아군)
  ally(game, a, dt) {
    const L = game.level, P = a.owner;
    let best = null, bd = 7;
    for (const o of L.actors) { if (o.team !== 1 || o.dead || o.untargetable) continue; const d = Math.hypot(o.x - a.x, o.y - a.y); if (d < bd && L.los(a.tx, a.ty, o.tx, o.ty)) { bd = d; best = o; } }
    if (best) {
      if (adjacent(a, best)) { a.turnTo(best.x, best.y); a.setAnim('attack', a.atk, { hitAt: a.hitT / a.atk, onHit: () => { if (!best.dead && adjacent(a, best)) { const ch = Math.max(10, Math.min(95, a.hit - (best.ac || 0))); if (Math.random() * 100 < ch) { damageActor(game, best, rnd(a.dmg[0], a.dmg[1]), 'phys', a); game.sfx('hit_flesh', best.x, best.y, { vol: 0.5 }); } } } }); return; }
      if (!stepToward(game, a, best)) a.wait = 0.2;
      return;
    }
    if (P && Math.hypot(P.x - a.x, P.y - a.y) > 3) { if (!stepToward(game, a, P)) a.wait = 0.3; }
    else a.wait = 0.3;
  },
  decoy() {},
  npc(game, a) {
    if (chance(0.7)) { a.wait = 1 + Math.random() * 3; return; }
    const d = DIRS[rnd(0, 7)];
    const nx = a.tx + d[0], ny = a.ty + d[1];
    if (Math.hypot(nx - a.home.x, ny - a.home.y) > 2.5) return;
    if (game.level.canStep(a.tx, a.ty, nx, ny, a.id)) a.step(game.level, nx, ny);
  },
};

function chargeStep(game, a, t) {
  const L = game.level;
  const dx = Math.sign(Math.round(t.x - a.x)), dy = Math.sign(Math.round(t.y - a.y));
  if (adjacent(a, t)) {
    a.charging = false;
    a.setAnim('attack', 0.4, { hitAt: 0.3, onHit: () => {
      const cd = a.mdef?.charge || [a.dmg[0] * 2, a.dmg[1] * 2];
      if (adjacent(a, t)) { damageActor(game, t, rnd(cd[0], cd[1]), 'phys', a, { stun: 0.4 }); knockback(game, t, a, 1); game.fx.shake(0.3); game.sfx('hit_crit', t.x, t.y); }
    } });
    return;
  }
  if ((dx || dy) && L.canStep(a.tx, a.ty, a.tx + dx, a.ty + dy, a.id)) {
    a.step(L, a.tx + dx, a.ty + dy);
    a.dash = 3;
    game.fx.smoke(a.x, a.y, 2, 1, [90, 80, 70]);
  } else a.charging = false;
}

function stoneForm(game, a, dt) {
  // 돌 형태: 가까이 오면 깨어난다. 회복 중이면 생명력이 찬다
  const P = game.player;
  const d = Math.hypot(a.x - P.x, a.y - P.y);
  a.untargetable = true;
  if (a.stoneHeal) {
    a.hp = Math.min(a.hpMax, a.hp + a.hpMax * dt / 4);
    if (a.hp >= a.hpMax) a.stoneHeal = false;
    return;
  }
  if ((d < 4 && game.level.los(a.tx, a.ty, P.tx, P.ty)) || a.hp < a.hpMax) {
    a.stone = false; a.aware = true; a.untargetable = false;
    a.setAnim('special', 0.6);
    game.sfx('mon_demon', a.x, a.y);
  }
}

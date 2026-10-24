// 게임 진행: 층 이동, 플레이어 명령, 매 틱 갱신(괴물·투사체·장판·물체), 물약·주문서
import { RNG, hash } from '../core/rng.js';
import { Actor } from './actor.js';
import { findPath, DistMap } from './path.js';
import { computeFOV, revealAll } from './fov.js';
import { F_VIS, F_SOLID } from './level.js';
import { buildLevel, LEVELS, levelName } from './world.js';
import { Hero } from './hero.js';
import { updateMonster } from './ai.js';
import { updateMissiles, updateAreas, meleeAttack, rangedAttack, damageActor, MELEE_HIT, MELEE_ARC } from './combat.js';
import { castSkill, skillDef, updateWhirl } from './skills.js';
import { updateBuffs, tickRegen, addBuff } from './buffs.js';
import { useObject, objectVerb, SHRINES } from './objects.js';
import { groundItem, pickupItem, autoGold } from './loot.js';
import { itemName, itemColor, makeItem } from './items.js';
import { BASE } from '../data/items.js';
import { setQuest, questState, questsOnEnter } from './quests.js';
import { restock } from './shop.js';
import { clamp } from '../core/util.js';

const NOFX = new Proxy({}, { get: () => () => {} });
// 터치로 내린 명령의 거리: 근접 공격은 이만큼 안의 적에게만 다가가고(이동은 조이스틱으로),
// 아이템·물체·마을 사람은 손 닿는 거리에서만 쓴다
const LEASH = 4.5, REACH = 2.6, TALK = 2.8;
// 공격 단추가 몸을 돌려 겨누는 거리: 근접은 손 닿는 거리보다 조금 더(다가오는 적), 활은 빛이 닿는 데까지
const MELEE_AIM = MELEE_HIT + 0.4, BOW_AIM = 10;
// 시야 반지름: 화면 가장자리 너머까지(한 번 본 곳은 빛 밖에서도 어둡게 남는다)
const FOV_R = 18;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class Game {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.fx = hooks.fx || NOFX;
    this.time = 0;
    this.levels = new Map();
    this.level = null; this.depth = -1;
    this.hero = null; this.player = null;
    this.dmap = new DistMap();
    this.showLabels = true; this.showBars = true; this.showDmg = false; this.autoGold = true;
    this.seed = (Math.random() * 2 ** 32) >>> 0;
    this.paused = false;
    this.portal = null;
    this.target = null;
    this.cmd = null;
    this.stick = null; // 조이스틱 방향 { a: 월드 각도, seq }
    this.focus = null; // 손 닿는 곳의 상호작용 대상 { kind, ref, x, y, verb }
    this.seq = 0; // 입력 순서(나중 입력이 앞선 명령을 이긴다)
    this.stats = { dmgDealt: 0 };
  }
  sfx(name, x, y, opts) { this.hooks.sfx?.(name, x, y, opts); }
  toast(msg, kind) { this.hooks.toast?.(msg, kind); }
  emit(ev, ...args) { this.hooks[ev]?.(...args); }
  damage(a, d, type, src, opts) { return damageActor(this, a, d, type, src, opts); }
  openDoor(o) { if (!o.open) useObject(this, o); }

  // ───────── 시작·층 이동 ─────────
  start(heroData) {
    this.hero = new Hero(heroData, this);
    this.player = new Actor('player', 0, 0);
    this.player.isPlayer = true;
    this.player.team = 0;
    this.hero.bind(this.player);
    // 이 판의 던전 씨앗: 저장할 때마다 새로(디아블로 2처럼 다시 들어오면 새 지도)
    this.seed = (Math.random() * 2 ** 32) >>> 0;
    restock(this, 'smith'); restock(this, 'premium'); restock(this, 'healer'); restock(this, 'witch'); restock(this, 'boy');
    this.enter(0, 'start');
  }
  lightRadius() { return this.hero ? this.hero.lightRadius() : 7; }

  getLevel(depth) {
    let L = this.levels.get(depth);
    if (!L) {
      const rng = new RNG(hash(`${this.seed}:${depth}`));
      L = buildLevel(this, depth, rng);
      // 성소 종류·색
      for (const o of L.objects) if (o.type === 'shrine' && !o.kind) { const S = SHRINES[rnd(0, SHRINES.length - 1)]; o.kind = S.id; o.col = S.col; }
      this.levels.set(depth, L);
    }
    return L;
  }

  // how: 'down' | 'up' | 'portal' | 'waypoint' | 'start' | 'respawn'
  enter(depth, how = 'down', at = null) {
    const P = this.player;
    let carry = [];
    if (this.level) {
      P.release(this.level);
      const i = this.level.actors.indexOf(P);
      if (i >= 0) this.level.actors.splice(i, 1);
      carry = this.level.actors.filter((a) => a.kind === 'summon' && !a.dead && a.owner === P && a.ai === 'ally');
      for (const s of carry) { s.release(this.level); this.level.actors.splice(this.level.actors.indexOf(s), 1); }
      // 떠나는 층의 투사체·장판 정리
      this.level.missiles.length = 0;
      this.level.areas = this.level.areas.filter((a) => !a.trapOf);
    }
    const fromTown = this.depth === 0;
    const L = this.getLevel(depth);
    this.level = L; this.depth = depth;
    this.fx.clear?.();
    let pos = at;
    if (!pos) {
      if (how === 'down' || how === 'start') pos = L.start;
      else if (how === 'up') pos = L.downAt || L.start;
      else if (how === 'waypoint') pos = L.wpAt || L.start;
      else if (how === 'portal' || how === 'respawn') pos = L.portalAt || L.start;
      else pos = L.start;
    }
    pos = L.nearestFree(pos.x, pos.y, 8) || L.nearestFree(L.start.x, L.start.y, 8) || L.start;
    P.mv = null; P.moving = false; P.whirl = null; P.leap = null; P.uninterruptible = false;
    P.place(L, pos.x, pos.y);
    if (!P.dead) P.setAnim('idle', 1);
    P.invuln = 0.6; // 층에 들어선 직후 잠깐 무적(디아블로 1)
    L.actors.push(P);
    for (const s of carry) { const p2 = L.nearestFree(pos.x + 1, pos.y + 1, 6); if (p2) { s.place(L, p2.x, p2.y); L.actors.push(s); } }
    this.cmd = null; this.stick = null; this.focus = null; this.setTarget(null);
    if (L.theme === 'town') revealAll(L); else computeFOV(L, P.tx, P.ty, FOV_R);
    this.dmap.build(L, P.tx, P.ty);
    this.lastTile = -1;
    if (depth > 0) {
      const d = this.hero.data;
      d.maxDepth = Math.max(d.maxDepth || 0, depth);
      if (!L.visited) { L.visited = true; this.emit('discover', depth); questsOnEnter(this, depth); }
    } else if (!fromTown && how !== 'start') {
      // 마을에 돌아오면 가게가 물건을 새로 들인다(디아블로 1)
      restock(this, 'smith'); restock(this, 'healer'); restock(this, 'witch');
    }
    // 마을 차원문 처리
    if (depth === 0) this.syncTownPortal();
    this.emit('levelChanged', depth, how);
    this.emit('save');
  }

  travel(depth, how, at) {
    if (depth < 0) return;
    this.hooks.transition ? this.hooks.transition(() => this.enter(depth, how, at)) : this.enter(depth, how, at);
  }

  // ───────── 차원문(귀환 주문서) ─────────
  openTownPortal() {
    const L = this.level, P = this.player;
    if (this.depth === 0) { this.toast('이미 마을입니다'); return false; }
    // 이전 차원문 지우기
    for (const lv of this.levels.values()) lv.objects = lv.objects.filter((o) => o.type !== 'portal' || o.permanent);
    for (const lv of this.levels.values()) rebuildObjAt(lv);
    const spot = L.nearestFree(P.tx + 1, P.ty + 1, 3) || L.nearestFree(P.tx, P.ty, 3);
    if (!spot) return false;
    const o = L.addObject({ type: 'portal', x: spot.x, y: spot.y, solid: false, age: 0 });
    this.portal = { depth: this.depth, x: spot.x, y: spot.y };
    this.syncTownPortal();
    this.sfx('portal_open', spot.x, spot.y);
    this.fx.magic(spot.x, spot.y, 30, 20, [120, 170, 255]);
    return true;
  }
  syncTownPortal() {
    const T = this.levels.get(0);
    if (!T) return;
    T.objects = T.objects.filter((o) => o.type !== 'portal');
    rebuildObjAt(T);
    if (this.portal) {
      const p = T.portalAt;
      T.addObject({ type: 'portal', x: p.x + 1, y: p.y - 1, solid: false, age: 1 });
    }
  }
  closePortal() {
    this.portal = null;
    for (const lv of this.levels.values()) { lv.objects = lv.objects.filter((o) => o.type !== 'portal'); rebuildObjAt(lv); }
  }

  // ───────── 플레이어 명령(입력에서 부른다) ─────────
  // 고른 것에 대한 행동: 아이템 줍기·괴물 공격·대화·물체 쓰기(상호작용 단추·공격 단추에서). 움직이지는 않는다
  tapAt(wx, wy, picked) {
    const P = this.player;
    if (!P || P.dead || this.paused) return false;
    if (P.whirl) return false;
    if (picked?.item) return this.issue({ type: 'pickup', item: picked.item, near: true });
    if (picked?.actor) {
      const a = picked.actor;
      if (a.kind === 'npc') return this.issue({ type: 'talk', npc: a, near: true });
      if (a.team === 1) { this.setTarget(a); return this.issue({ type: 'attack', target: a, leash: LEASH }); }
    }
    if (picked?.obj) return this.issue({ type: 'use', obj: picked.obj, near: true });
    return false;
  }
  issue(c) { c.seq = ++this.seq; this.cmd = c; return true; }
  setTarget(a) {
    if (this.target && this.target !== a) this.target.targeted = false;
    this.target = a;
    if (a) a.targeted = true;
  }
  stopAll() { this.cmd = null; this.stick = null; }
  // 조이스틱: 월드 방향(길이 무관), 놓으면 null. 처음 밀거나 방향을 크게 틀면 새 입력으로 친다
  setStick(dx, dy) {
    if (dx == null || (!dx && !dy)) { this.stick = null; return; }
    const a = Math.atan2(dy, dx), st = this.stick;
    if (!st || Math.abs(Math.atan2(Math.sin(a - st.a), Math.cos(a - st.a))) > 0.6) this.stick = { a, seq: ++this.seq };
    else st.a = a;
  }

  // 공격 단추: 그 자리에서 바로 휘두르거나 쏜다(적에게 다가가지 않는다). 공격만 한다(줍기·대화는 상호작용 단추로)
  attackNearest() {
    const P = this.player;
    if (!P || P.dead || this.paused || this.depth === 0) return false;
    return this.issue({ type: 'swing' });
  }
  // 조이스틱(없으면 바라보는) 방향
  aimDir() { const P = this.player; return this.stick ? this.stick.a : P.faceTo ?? P.face; }
  // 휘두르기·쏘기: 겨누는 거리 안에 적이 있으면 그쪽으로, 없으면 조이스틱(바라보는) 쪽 빈 곳으로.
  // 근접은 내려치는 순간 앞쪽 손 닿는 곳의 적을, 화살은 날아가다 처음 닿는 적을 맞힌다
  // 겨눌 적이 없으면 손 닿는 곳의 상자·석관·통 쪽으로 휘둘러 열고 부순다(활을 들었으면 상자는 손으로 열고 통은 쏴서 부순다)
  freeAttack() {
    const P = this.player, ranged = this.hero.ranged();
    const t = this.bestEnemy(ranged ? BOW_AIM : MELEE_AIM), o = t ? null : this.bestSmashable();
    const a = t ? Math.atan2(t.y - P.y, t.x - P.x) : o ? Math.atan2(o.y - P.y, o.x - P.x) : this.aimDir();
    if (t) this.setTarget(t);
    if (ranged && o && o.type !== 'barrel') {
      P.turnTo(o.x, o.y);
      P.setAnim('special', 0.3, { hitAt: 0.5, onHit: () => this.smash(o) });
      return;
    }
    if (ranged) rangedAttack(this, P, t, { basic: true, point: { x: P.x + Math.cos(a) * 6, y: P.y + Math.sin(a) * 6 } });
    else meleeAttack(this, P, t, { basic: true, ang: a });
  }
  // 공격으로 여는·부수는 것: 닫힌 상자·석관, 멀쩡한 통
  smashable(o) { return !!o && !o.hidden && (o.type === 'barrel' ? !o.broken : (o.type === 'chest' || o.type === 'sarc') && !o.open); }
  smash(o) { if (!this.smashable(o)) return false; useObject(this, o); return true; }
  // 손 닿는 곳(겨누는 거리)의 상자·석관·통: 조이스틱(바라보는) 쪽 것 먼저
  bestSmashable() {
    const P = this.player, L = this.level, ref = this.aimDir(), w = this.stick ? 2 : 0.8;
    let best = null, bs = 1e9;
    for (const o of L.objects) {
      if (!this.smashable(o) || !(L.flags[o.y * L.w + o.x] & F_VIS)) continue;
      const d = Math.hypot(o.x - P.x, o.y - P.y);
      if (d > MELEE_AIM) continue;
      const sc = d + Math.abs(angDiff(Math.atan2(o.y - P.y, o.x - P.x), ref)) * w;
      if (sc < bs) { bs = sc; best = o; }
    }
    return best;
  }
  // 휘두른 순간 앞쪽 손 닿는 곳의 상자·석관을 열고 통을 부순다
  smashFront(P = this.player) {
    const fa = P.faceTo ?? P.face;
    let best = null, bd = 1e9;
    for (const o of this.level.objects) {
      if (!this.smashable(o)) continue;
      const d = Math.hypot(o.x - P.x, o.y - P.y);
      if (d > MELEE_HIT + 0.35 || Math.abs(angDiff(Math.atan2(o.y - P.y, o.x - P.x), fa)) > MELEE_ARC + 0.2) continue;
      if (d < bd) { bd = d; best = o; }
    }
    return best ? this.smash(best) : false;
  }
  // 거리와 방향으로 고른 적(조이스틱을 밀고 있으면 그 방향을 더 따진다). 지금 대상이 크게 나쁘지 않으면 그대로 둔다(대상이 이리저리 바뀌지 않게)
  bestEnemy(range) {
    const P = this.player, ref = this.aimDir(), w = this.stick ? 2 : 0.8;
    const score = (a) => P.dist(a) + Math.abs(angDiff(Math.atan2(a.y - P.y, a.x - P.x), ref)) * w;
    let best = null, bs = 1e9;
    for (const a of this.level.actors) {
      if (a.team !== 1 || a.dead || a.untargetable || a.stone) continue;
      if (P.dist(a) > range || !this.canSee(a)) continue;
      const sc = score(a);
      if (sc < bs) { bs = sc; best = a; }
    }
    const t = this.target;
    if (t && t !== best && t.team === 1 && !t.dead && !t.untargetable && !t.stone && P.dist(t) <= range && this.canSee(t) && score(t) <= bs + 1.5) return t;
    return best;
  }
  // 손 닿는 곳의 상호작용 대상(상호작용 단추·화면 표시): 가깝고 바라보는 쪽의 것 먼저
  updateFocus() {
    const P = this.player, L = this.level;
    this.focus = null;
    if (!P || P.dead) return;
    // 겨눈 적이 어둠 속으로 사라지거나 멀어지면 고리를 지운다
    const tg = this.target;
    if (tg && (tg.dead || P.dist(tg) > BOW_AIM + 2 || !this.canSee(tg))) this.setTarget(null);
    const ref = this.stick ? this.stick.a : P.faceTo ?? P.face;
    let bs = 1e9;
    // bias: 작을수록 먼저(마을 사람·아이템 > 계단·상자 등 > 우물·책장처럼 살펴보기만 하는 것)
    const consider = (kind, ref2, x, y, reach, verb, bias) => {
      const d = Math.hypot(x - P.x, y - P.y);
      if (d > reach) return;
      const sc = d + bias + (d < 0.3 ? 0 : Math.abs(angDiff(Math.atan2(y - P.y, x - P.x), ref)) * 0.5);
      if (sc < bs) { bs = sc; this.focus = { kind, ref: ref2, x, y, verb }; }
    };
    for (const it of L.items) consider('item', it, it.x, it.y, REACH, '줍기', 0);
    for (const o of L.objects) { const v = objectVerb(o); if (v) consider('obj', o, o.x, o.y, REACH, v, v === '살펴보기' ? 1.2 : 0.3); }
    // 마을 사람은 조금 먼저(마을 사람끼리 가까이 모여 있으니, 더 가까운 아이템·물체를 가리지 않을 만큼만)
    for (const a of L.actors) if (a.kind === 'npc' && !a.dead) consider('npc', a, a.x, a.y, TALK, '대화', -0.15);
  }
  // 상호작용 단추: 줍기·열기·대화·계단 등
  interact() {
    const f = this.focus;
    if (!f || this.player?.dead || this.paused) return false;
    return this.tapAt(f.x, f.y, f.kind === 'item' ? { item: f.ref } : f.kind === 'npc' ? { actor: f.ref } : { obj: f.ref });
  }
  nearestEnemy(range = 10, from = this.player) {
    let best = null, bd = 1e9;
    for (const a of this.level.actors) {
      if (a.team !== 1 || a.dead || a.untargetable || a.stone) continue;
      const d = from.dist(a);
      if (d > range || d >= bd) continue;
      if (!this.canSee(a)) continue;
      bd = d; best = a;
    }
    return best;
  }
  canSee(a) {
    const L = this.level;
    if (L.theme === 'town') return true;
    if (!(L.flags[Math.round(a.y) * L.w + Math.round(a.x)] & F_VIS)) return false;
    // 빛 반경 밖의 어둠 속 괴물은 보이지 않는다(빛나는 괴물·보스는 예외)
    return a.boss || a.glowCol || Math.hypot(a.x - this.player.x, a.y - this.player.y) <= this.lightRadius() + 1.5;
  }

  // 기술 사용: 대상(괴물) 또는 지점. 없으면 사거리 안의 적(근접 기술은 손 닿는 곳)을, 그것도 없으면 조이스틱(바라보는) 쪽을 겨눈다.
  // 공격 단추처럼 그 자리에서 바로 쓴다(다가가지 않는다)
  useSkill(id, aim = null) {
    const P = this.player;
    if (!P || P.dead || this.paused) return false;
    if (id === 'attack') return this.attackNearest();
    const def = skillDef(id);
    if (!def || def.passive) return false;
    if (this.depth === 0) { this.toast('마을에서는 쓸 수 없습니다'); this.sfx('ui_error'); return false; }
    let target = aim?.actor || null, point = aim?.point || null;
    const range = def.range || 10;
    if (!target && !point && def.target !== 'self' && def.kind !== 'buff' && def.kind !== 'shout' && def.kind !== 'nova' && def.kind !== 'static') {
      const melee = def.kind === 'melee' || def.kind === 'cleave';
      const t = def.kind === 'teleport' ? null : this.bestEnemy(melee ? MELEE_AIM : range);
      if (t) { target = t; this.setTarget(t); }
      else {
        const r = melee ? 1 : def.kind === 'teleport' || def.kind === 'leap' ? 5 : Math.min(6, range), a = this.aimDir();
        point = { x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r };
      }
    }
    return this.issue({ type: 'skill', id, target, point });
  }

  // ───────── 갱신 ─────────
  update(dt) {
    if (this.paused || !this.level) return;
    this.time += dt;
    const L = this.level, P = this.player;
    this.hero.data.played = (this.hero.data.played || 0) + dt;
    this.updatePlayer(dt);
    this.updateFocus();
    const pk = P.ty * L.w + P.tx;
    if (pk !== this.lastTile) {
      this.lastTile = pk;
      if (L.theme !== 'town') computeFOV(L, P.tx, P.ty, FOV_R);
      this.dmap.build(L, P.tx, P.ty);
      this.checkTriggers();
      if (this.autoGold) autoGold(this);
    }
    for (let i = L.actors.length - 1; i >= 0; i--) {
      const a = L.actors[i];
      if (a === P || !a) continue;
      if (a.flash > 0) a.flash -= dt;
      if (a.barT > 0) a.barT -= dt * 0.3;
      updateBuffs(this, a, dt);
      if (a.dead) {
        a.anim.t += dt;
        if (a.anim.t >= a.anim.dur) this.toCorpse(a);
        continue;
      }
      updateMonster(this, a, dt);
    }
    updateMissiles(this, dt);
    updateAreas(this, dt);
    for (const it of L.items) if (it.drop > 0) it.drop = Math.max(0, it.drop - dt * 2.2);
    for (const o of L.objects) if (o.type === 'portal') o.age = (o.age || 0) + dt;
    for (let i = L.corpses.length - 1; i >= 0; i--) { const c = L.corpses[i]; if (c.fade != null && c.fade < 1 && c.eaten) { c.fade -= dt * 0.5; if (c.fade <= 0) L.corpses.splice(i, 1); } }
    if (L.corpses.length > 180) L.corpses.splice(0, L.corpses.length - 180);
    this.hooks.tick?.(dt);
  }

  toCorpse(a) {
    const L = this.level;
    const i = L.actors.indexOf(a);
    if (i >= 0) L.actors.splice(i, 1);
    if (!a.noCorpse && a.kind !== 'summon') L.corpses.push({ id: a.id, x: a.x, y: a.y, face: a.face, look: a.look, fallDir: a.fallDir || 1, type: a.mdef?.id, monRef: a.mdef ? true : false });
  }

  updatePlayer(dt) {
    const P = this.player, L = this.level, h = this.hero;
    if (P.flash > 0) P.flash -= dt;
    if (P.invuln > 0) P.invuln -= dt;
    updateBuffs(this, P, dt);
    tickRegen(this, P, dt);
    P.tickFace(dt);
    if (P.dead) { P.anim.t = Math.min(P.anim.dur, P.anim.t + dt); return; }
    const frozen = P.buffs.freeze;
    const rate = P.buffs.chill ? 0.6 : 1;
    if (frozen) return;
    // 도약 중
    if (P.leap) {
      const lp = P.leap;
      lp.t += dt;
      const k = Math.min(1, lp.t / lp.T);
      P.x = lp.sx + (lp.tx - lp.sx) * k; P.y = lp.sy + (lp.ty - lp.sy) * k;
      P.z = Math.sin(k * Math.PI) * 50;
      P.anim.t += dt;
      if (k >= 1) { P.z = 0; const A = P.anim; if (A.onHit) { const f = A.onHit; A.onHit = null; f(); } }
      return;
    }
    P.z = 0;
    if (P.whirl) { updateWhirl(this, P, dt); P.moving = false; return; }
    // 동작 중(공격·시전·피격)
    if (P.anim.name !== 'idle' && P.anim.name !== 'walk') {
      const A = P.anim;
      const prev = A.t;
      A.t += dt * rate;
      if (A.hitAt != null && A.onHit && prev < A.hitAt * A.dur && A.t >= A.hitAt * A.dur) { const f = A.onHit; A.onHit = null; f(); }
      // 타격 뒤에는 새 명령으로 끊을 수 있다(디아블로 1). 기본 공격은 새로 민 조이스틱으로 내려치기 전에도 끊는다(물러나며 싸우기)
      const fresh = this.stick && this.stick.seq > (this.actSeq || 0);
      const canCancel = (A.name === 'attack' || A.name === 'cast') && (!A.onHit && (this.cmd && this.cmd.type !== 'attack' && this.cmd.type !== 'swing' || fresh) || A.basic && fresh);
      if (A.t >= A.dur || canCancel) { P.setAnim('idle', 1); if (A.after) A.after(); }
      else if (!P.mv) return;
    }
    // 조이스틱이 더 나중 입력이면 앞선 명령(다가가 공격 등)을 버리고, 걷던 걸음도 그 자리에서 끊는다
    const st = this.stick;
    if (st && st.seq > (this.actSeq || 0)) { if (this.cmd && (this.cmd.seq || 0) < st.seq) this.cmd = null; P.halt(L); }
    if (P.mv) {
      if (!P.advance(L, dt * rate)) { P.moving = true; return; }
    }
    P.moving = false;
    const c = this.cmd;
    if (!c) { if (st) this.stickMove(dt * rate); return; }
    if (c.seq) this.actSeq = c.seq;
    switch (c.type) {
      case 'move': {
        if (P.tx === c.x && P.ty === c.y) { this.cmd = null; break; }
        const ok = this.stepToward(c.x, c.y, c);
        if (!ok) this.cmd = null;
        if (ok) P.moving = true;
        break;
      }
      case 'attack': {
        const t = c.target;
        if (!t || t.dead || t.team !== 1 || t.untargetable) { this.cmd = null; break; }
        if (h.ranged()) {
          if (P.dist(t) <= 12 && L.los(P.tx, P.ty, t.tx, t.ty)) { rangedAttack(this, P, t, {}); this.cmd = null; }
          else if (!this.approach(t, c)) this.cmd = null;
        } else {
          if (P.tdist(t) <= 1 && P.dist(t) < 1.6) { meleeAttack(this, P, t, {}); this.cmd = null; }
          else if (!this.approach(t, c)) this.cmd = null;
        }
        break;
      }
      case 'swing': this.cmd = null; this.freeAttack(); break;
      case 'skill': {
        const tgt = c.target && !c.target.dead ? c.target : null;
        this.cmd = null;
        castSkill(this, P, c.id, tgt, c.point || (tgt ? { x: tgt.x, y: tgt.y } : null));
        break;
      }
      case 'pickup': {
        const it = c.item;
        if (!L.items.includes(it)) { this.cmd = null; break; }
        const ix = Math.round(it.x), iy = Math.round(it.y);
        if (Math.max(Math.abs(ix - P.tx), Math.abs(iy - P.ty)) <= 1 || c.near && Math.hypot(it.x - P.x, it.y - P.y) <= REACH) { this.cmd = null; pickupItem(this, it); }
        else if (c.near) { this.cmd = null; this.tooFar(); }
        else if (!this.stepToward(ix, iy, c, true)) this.cmd = null;
        break;
      }
      case 'use': {
        const o = c.obj;
        const onTile = o.x === P.tx && o.y === P.ty;
        // 터치 명령은 손 닿는 거리에서 바로 쓴다(문 칸에 서서 문을 닫을 수는 없다)
        const ok = c.near ? Math.hypot(o.x - P.x, o.y - P.y) <= REACH && !(onTile && o.type === 'door')
          : o.type === 'portal' ? Math.hypot(o.x - P.tx, o.y - P.ty) <= 1.5 : Math.max(Math.abs(o.x - P.tx), Math.abs(o.y - P.ty)) <= 1 && !onTile;
        if (ok) { this.cmd = null; P.turnTo(o.x, o.y); useObject(this, o); }
        else if (c.near) { this.cmd = null; if (!onTile) this.tooFar(); }
        else if (!this.stepToward(o.x, o.y, c, o.type !== 'portal')) this.cmd = null;
        break;
      }
      case 'talk': {
        const n = c.npc;
        if (P.tdist(n) <= 1 || c.near && P.dist(n) <= TALK) { this.cmd = null; P.turnTo(n.x, n.y); if (n.anim.name !== 'dead') n.turnTo(P.x, P.y); this.emit('talk', n); }
        else if (c.near) { this.cmd = null; this.tooFar(); }
        else if (!this.stepToward(n.tx, n.ty, c, true)) this.cmd = null;
        break;
      }
    }
  }

  // 공격하러 다가가기: 터치 명령(leash)은 가까운 적에게만 다가간다. 못 가면 false
  approach(t, c) {
    if (c.leash && this.player.dist(t) > c.leash) return false;
    return this.stepToward(t.tx, t.ty, c, true);
  }
  tooFar() {
    if (this.time - (this.farT ?? -9) < 1.5) return;
    this.farT = this.time;
    this.toast('더 가까이 가야 합니다');
  }
  // 조이스틱 걸음: 칸에 매이지 않고 민 방향으로 곧장 움직인다(즉시 출발·정지·방향 바꾸기).
  // 몸은 반지름 R의 원: 막힌 칸(벽·물체·다른 액터)에 더 깊이 들어가는 움직임만 막고, 막히면 축마다 따로 미끄러지며,
  // 모서리에 걸리면 앞이 트인 줄 가운데로 당긴다. 칸 좌표·자리 차지는 가장 가까운 칸을 따른다. 닫힌 문은 밀면 열린다
  stickMove(dt) {
    const P = this.player, L = this.level, a = this.stick.a, R = 0.3;
    const sp = P.moveSpeed() * dt, ux = Math.cos(a), uy = Math.sin(a);
    const rd = (x, y, tx, ty) => Math.hypot(Math.max(0, Math.abs(x - tx) - 0.5), Math.max(0, Math.abs(y - ty) - 0.5));
    const hit = (x, y) => {
      for (let ty = Math.round(y - R); ty <= Math.round(y + R); ty++) for (let tx = Math.round(x - R); tx <= Math.round(x + R); tx++) {
        if (L.free(tx, ty, P.id)) continue;
        const d = rd(x, y, tx, ty);
        if (d < R && d < rd(P.x, P.y, tx, ty) - 1e-6) return { tx, ty };
      }
      return null;
    };
    let x = P.x, y = P.y;
    const full = hit(x + ux * sp, y + uy * sp);
    if (!full) { x += ux * sp; y += uy * sp; }
    else {
      // 바로 앞의 닫힌 문이면 연다
      const dr = L.obj(full.tx, full.ty);
      if (dr && dr.type === 'door' && !dr.open && !dr.locked && full.tx === Math.round(P.x + ux * 0.8) && full.ty === Math.round(P.y + uy * 0.8)) {
        P.turnTo(full.tx, full.ty); useObject(this, dr); P.setAnim('special', 0.25); return;
      }
      if (!hit(x + ux * sp, y)) x += ux * sp;
      if (!hit(x, y + uy * sp)) y += uy * sp;
      if (x === P.x && y === P.y) {
        const ax = Math.abs(ux) >= Math.abs(uy);
        if (L.free(Math.round(P.x + (ax ? Math.sign(ux) : 0)), Math.round(P.y + (ax ? 0 : Math.sign(uy))), P.id)) {
          if (ax) { const d = Math.round(P.y) - P.y, ny = P.y + Math.sign(d) * Math.min(Math.abs(d), sp); if (!hit(P.x, ny)) y = ny; }
          else { const d = Math.round(P.x) - P.x, nx = P.x + Math.sign(d) * Math.min(Math.abs(d), sp); if (!hit(nx, P.y)) x = nx; }
        }
      }
    }
    P.faceTo = a;
    if (x === P.x && y === P.y) return;
    P.walkPh += Math.hypot(x - P.x, y - P.y) * Math.PI * 2 / 1.25;
    P.x = x; P.y = y; P.moving = true;
    const ntx = Math.round(x), nty = Math.round(y);
    if (ntx !== P.tx || nty !== P.ty) {
      const k0 = P.ty * L.w + P.tx;
      if (L.occ[k0] === P.id) L.occ[k0] = 0;
      P.tx = ntx; P.ty = nty;
      L.occ[nty * L.w + ntx] = P.id;
    }
  }
  // 목표로 한 걸음. adjacent면 옆에 닿으면 멈춘다. 못 가면 false
  stepToward(tx, ty, c, adjacent = false) {
    const P = this.player, L = this.level;
    if (adjacent && Math.max(Math.abs(tx - P.tx), Math.abs(ty - P.ty)) <= 1) return false;
    const goal = ty * L.w + tx;
    if (!c.path || c.pathGoal !== goal || !c.path.length || (c.pathAge = (c.pathAge || 0) + 1) > 6) {
      c.pathAge = 0;
      c.path = findPath(L, P.tx, P.ty, tx, ty, { self: P.id, adjacent, avoidActors: true, goalSolid: adjacent, max: 5000, doors: true });
      c.pathGoal = goal;
      if (!c.path || !c.path.length) {
        c.path = findPath(L, P.tx, P.ty, tx, ty, { self: P.id, adjacent, goalSolid: adjacent, max: 5000, doors: true });
        if (!c.path || !c.path.length) return false;
      }
    }
    const [nx, ny] = c.path[0];
    const dr = L.obj(nx, ny);
    if (dr && dr.type === 'door' && !dr.open) { P.turnTo(nx, ny); useObject(this, dr); P.setAnim('special', 0.25); return true; }
    if (!L.canStep(P.tx, P.ty, nx, ny, P.id)) {
      c.path = null;
      c.blocked = (c.blocked || 0) + 1;
      // 막혔다: 닫힌 문이면 연다
      const o = L.obj(nx, ny);
      if (o && o.type === 'door' && !o.open) { useObject(this, o); return true; }
      return c.blocked < 4;
    }
    c.path.shift();
    P.step(L, nx, ny);
    return true;
  }

  checkTriggers() {
    const L = this.level, P = this.player;
    for (const tr of L.triggers || []) {
      if (tr.done) continue;
      if (Math.hypot(tr.x - P.tx, tr.y - P.ty) <= (tr.r || 3)) { tr.done = true; tr.fn?.(this, tr); }
    }
  }

  // ───────── 아이템 쓰기 ─────────
  useItem(it, from = 'inv') {
    const h = this.hero, P = this.player, b = BASE[it.b];
    if (!b.use || P.dead) return false;
    const C = h.C.id;
    const healK = { warrior: 2, rogue: 1.5, sorcerer: 1 }[C], manaK = { warrior: 1, rogue: 1.5, sorcerer: 2 }[C];
    const heal = () => { const v = Math.round((P.hpMax / 8 + Math.random() * P.hpMax / 4) * healK); P.hp = Math.min(P.hpMax, P.hp + v); return v; };
    const mana = () => { const v = Math.round((P.mpMax / 8 + Math.random() * P.mpMax / 4) * manaK); P.mp = Math.min(P.mpMax, P.mp + v); return v; };
    switch (b.use) {
      case 'heal': heal(); this.fx.p(P.x, P.y, 40, { vz: 30, life: 0.6, size: 4, col: [255, 60, 50], glow: true }); break;
      case 'healFull': P.hp = P.hpMax; break;
      case 'mana': mana(); this.fx.p(P.x, P.y, 40, { vz: 30, life: 0.6, size: 4, col: [60, 100, 255], glow: true }); break;
      case 'manaFull': P.mp = P.mpMax; break;
      case 'rejuv': heal(); mana(); break;
      case 'rejuvFull': P.hp = P.hpMax; P.mp = P.mpMax; break;
      case 'elixir': {
        const k = b.stat;
        if (h.data.base[k] >= h.C.max[k]) { this.toast('이미 한계에 이르렀습니다'); return false; }
        h.data.base[k]++; h.recalc();
        this.toast(`${{ str: '힘', mag: '마력', dex: '민첩', vit: '활력' }[k]} +1`, 'big');
        this.fx.levelUp(P.x, P.y);
        break;
      }
      case 'elixirAll': for (const k of ['str', 'mag', 'dex', 'vit']) h.data.base[k] += 3; h.recalc(); this.toast('모든 능력치 +3', 'big'); this.fx.levelUp(P.x, P.y); break;
      case 'portal': if (!this.openTownPortal()) return false; break;
      case 'identify': return this.emit('identifyPick', it), true;
    }
    this.consume(it, from);
    if (b.cat === 'potion' || b.cat === 'elixir') this.sfx('potion_drink', P.x, P.y);
    if (b.cat === 'scroll') this.sfx('drop_scroll', P.x, P.y);
    this.emit('inventoryChanged');
    return true;
  }
  consume(it, from) {
    const h = this.hero;
    if (from === 'inv') h.invRemove(it);
    else if (from === 'belt') {
      const B = h.data.belt, k = B.indexOf(it);
      if (k >= 0) { const col = k % 4; B[k] = null; for (let r = Math.floor(k / 4); r < 3; r++) { B[r * 4 + col] = B[(r + 1) * 4 + col]; B[(r + 1) * 4 + col] = null; } }
    }
  }
  identifyWith(scroll, target, from = 'inv') {
    if (!target || target.id) return false;
    target.id = true;
    this.consume(scroll, from);
    this.sfx('identify');
    this.emit('inventoryChanged');
    return true;
  }
  useBelt(col) {
    const it = this.hero.data.belt[col];
    if (!it) { this.sfx('ui_error'); return false; }
    return this.useItem(it, 'belt');
  }
  // 가장 알맞은 물약 자동 사용(생명력·마나)
  quickPotion(kind) {
    const h = this.hero;
    const want = kind === 'hp' ? ['hp_minor', 'rejuv', 'hp_full', 'rejuv_full'] : ['mp_minor', 'rejuv', 'mp_full', 'rejuv_full'];
    for (const id of want) {
      const k = h.data.belt.findIndex((x) => x && x.b === id);
      if (k >= 0) return this.useItem(h.data.belt[k], 'belt');
      const it = h.data.inv.find((x) => x.b === id);
      if (it) return this.useItem(it, 'inv');
    }
    this.toast(kind === 'hp' ? '치유 물약이 없습니다' : '마나 물약이 없습니다', 'warn');
    this.sfx('ui_error');
    return false;
  }
  dropItem(it) {
    const P = this.player;
    groundItem(this, it, P.x, P.y);
    this.emit('inventoryChanged');
  }

  // 죽은 뒤: 마을에서 되살아난다(디아블로 2: 골드 일부를 잃는다)
  respawn() {
    const P = this.player, h = this.hero;
    const lose = Math.floor(h.data.gold * Math.min(0.2, h.data.lvl / 100));
    h.gold(-lose);
    // 장비 내구도 10% 감소
    for (const it of Object.values(h.data.equip)) if (it.durMax && !it.indestr) it.dur = Math.max(0, Math.floor(it.dur - it.durMax * 0.1));
    P.dead = false; P.hp = P.hpMax; P.mp = P.mpMax;
    P.buffs = {};
    h.recalc();
    this.closePortal();
    this.levels.forEach((L, d) => { if (d !== 0) this.levels.delete(d); });
    this.seed = (Math.random() * 2 ** 32) >>> 0;
    this.enter(0, 'respawn');
    return lose;
  }

  itemLabel(it) { return it.gold ? `${it.gold} 골드` : itemName(it.item, true); }
  itemColor(it) { return it.gold ? '#e8d080' : itemColor(it.item); }
}

function rebuildObjAt(L) {
  L.objAt.fill(0);
  L.objects.forEach((o, i) => { o.idx = i; if (o.x != null && !o.noAt) L.objAt[o.y * L.w + o.x] = i + 1; });
}

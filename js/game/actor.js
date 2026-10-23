// 액터(플레이어·괴물·NPC·소환수): 칸 단위 이동과 동작 상태
import { angLerp } from '../core/util.js';

let NEXT_ID = 1;
export const newId = () => NEXT_ID++;

export class Actor {
  constructor(kind, x, y) {
    this.id = newId();
    this.kind = kind; // 'player' | 'monster' | 'npc' | 'summon'
    this.tx = x; this.ty = y; this.x = x; this.y = y;
    this.face = Math.PI / 4;
    this.faceTo = this.face;
    this.mv = null; // 진행 중인 한 걸음 { fx, fy, nx, ny, t, dur }
    this.moving = false;
    this.walkPh = 0;
    this.anim = { name: 'idle', t: 0, dur: 1 };
    this.team = 0;
    this.hp = 1; this.hpMax = 1; this.mp = 0; this.mpMax = 0;
    this.dead = false;
    this.flash = 0;
    this.speed = 3.6; // 칸/초
    this.buffs = {};
    this.look = null;
  }
  // 걸음 시작: 도착 칸을 미리 차지한다(출발 칸도 도착할 때까지 붙잡아 둔다).
  // 조이스틱으로 칸 사이에 서 있던 플레이어도 있으니 지금 자리(sx, sy)에서 출발한다
  step(L, nx, ny) {
    const len = Math.max(0.2, Math.hypot(nx - this.x, ny - this.y));
    this.mv = { fx: this.tx, fy: this.ty, sx: this.x, sy: this.y, nx, ny, t: 0, dur: len / Math.max(0.3, this.moveSpeed()) };
    L.occ[ny * L.w + nx] = this.id;
    this.faceTo = Math.atan2(ny - this.y, nx - this.x);
    this.moving = true;
  }
  moveSpeed() {
    let s = this.speed;
    if (this.buffs.chill) s *= 0.5;
    if (this.buffs.slow) s *= this.buffs.slow.k ?? 0.6;
    if (this.buffs.haste) s *= 1 + (this.buffs.haste.k ?? 0.3);
    return s;
  }
  // 걸음 진행. 끝나면 true
  advance(L, dt) {
    const m = this.mv;
    if (!m) return true;
    const prevX = this.x, prevY = this.y;
    m.t += dt;
    const k = Math.min(1, m.t / m.dur);
    this.x = m.sx + (m.nx - m.sx) * k;
    this.y = m.sy + (m.ny - m.sy) * k;
    this.walkPh += Math.hypot(this.x - prevX, this.y - prevY) * Math.PI * 2 / 1.25;
    if (k >= 1) {
      const fk = m.fy * L.w + m.fx;
      if (L.occ[fk] === this.id) L.occ[fk] = 0;
      this.tx = m.nx; this.ty = m.ny;
      this.x = m.nx; this.y = m.ny;
      this.mv = null;
      return true;
    }
    return false;
  }
  // 걷던 걸음을 그 자리에서 멈춘다(조이스틱으로 끊을 때). 붙잡아 둔 두 칸 중 가까운 칸만 남긴다
  halt(L) {
    const m = this.mv;
    if (!m) return;
    this.mv = null;
    const near = Math.hypot(this.x - m.nx, this.y - m.ny) < Math.hypot(this.x - m.fx, this.y - m.fy);
    const [kx, ky, dx, dy] = near ? [m.nx, m.ny, m.fx, m.fy] : [m.fx, m.fy, m.nx, m.ny];
    if (L.occ[dy * L.w + dx] === this.id) L.occ[dy * L.w + dx] = 0;
    this.tx = kx; this.ty = ky;
  }
  // 걸음을 즉시 끊는다(넉백·순간 이동 등)
  place(L, x, y) {
    if (this.mv) {
      const a = this.mv.fy * L.w + this.mv.fx, b = this.mv.ny * L.w + this.mv.nx;
      if (L.occ[a] === this.id) L.occ[a] = 0;
      if (L.occ[b] === this.id) L.occ[b] = 0;
      this.mv = null;
    }
    const k0 = this.ty * L.w + this.tx;
    if (L.occ[k0] === this.id) L.occ[k0] = 0;
    this.tx = x; this.ty = y; this.x = x; this.y = y;
    L.occ[y * L.w + x] = this.id;
  }
  release(L) {
    const k0 = this.ty * L.w + this.tx;
    if (L.occ[k0] === this.id) L.occ[k0] = 0;
    if (this.mv) {
      const a = this.mv.fy * L.w + this.mv.fx, b = this.mv.ny * L.w + this.mv.nx;
      if (L.occ[a] === this.id) L.occ[a] = 0;
      if (L.occ[b] === this.id) L.occ[b] = 0;
    }
  }
  setAnim(name, dur, extra) {
    this.anim = { name, t: 0, dur, ...extra };
  }
  get busy() { return this.anim.name !== 'idle' && this.anim.name !== 'walk'; }
  turnTo(x, y) { this.faceTo = Math.atan2(y - this.y, x - this.x); }
  tickFace(dt) { this.face = angLerp(this.face, this.faceTo, Math.min(1, dt * 16)); }
  dist(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  // 칸 기준 체비쇼프 거리(인접 = 1)
  tdist(o) { return Math.max(Math.abs(o.tx - this.tx), Math.abs(o.ty - this.ty)); }
}

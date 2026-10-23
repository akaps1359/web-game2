// 터치 입력: 탭 = 이동·공격·줍기·대화(디아블로의 클릭), 누르고 있기 = 계속 이동·공격, 두 손가락 = 확대
import { isZoomed } from '../core/viewport.js';
import { isInteractive } from '../game/objects.js';

export class TouchInput {
  constructor(app) {
    this.app = app;
    const el = app.cv;
    this.pts = new Map();
    this.holding = false;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('touchstart', (e) => { if (e.touches.length > 1 && !isZoomed()) e.preventDefault(); }, { passive: false });
    el.addEventListener('wheel', (e) => { e.preventDefault(); const r = app.renderer; r.setUserZoom((r.userZoom || 1) * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // 키보드(데스크톱 시험용)
    window.addEventListener('keydown', (e) => this.key(e));
  }
  get game() { return this.app.game; }

  down(e) {
    if (!this.game) return;
    this.app.cv.setPointerCapture?.(e.pointerId);
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    if (this.pts.size === 2) {
      this.cancelHold();
      const [a, b] = [...this.pts.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.app.renderer.userZoom || 1 };
      return;
    }
    if (this.pts.size > 2) return;
    this.pinch = null;
    const p = this.pts.get(e.pointerId);
    p.pick = this.pick(e.clientX, e.clientY);
    clearTimeout(this.holdT);
    this.holdT = setTimeout(() => this.startHold(e.pointerId), 230);
  }
  move(e) {
    const p = this.pts.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pinch && this.pts.size >= 2) {
      const [a, b] = [...this.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.app.renderer.setUserZoom(this.pinch.z * d / Math.max(20, this.pinch.d));
      return;
    }
    if (!this.holding && Math.hypot(p.x - p.x0, p.y - p.y0) > 14) this.startHold(e.pointerId);
    if (this.holding) this.updateHold(p);
  }
  up(e, cancel = false) {
    const p = this.pts.get(e.pointerId);
    this.pts.delete(e.pointerId);
    clearTimeout(this.holdT);
    if (!p) return;
    if (this.pinch) { if (this.pts.size < 2) this.pinch = null; return; }
    const wasHold = this.holding;
    this.cancelHold();
    if (cancel || !this.game) return;
    const quick = performance.now() - p.t0 < 260 && Math.hypot(p.x - p.x0, p.y - p.y0) < 14;
    if (quick || !wasHold) this.tap(p.x0, p.y0, p.pick);
  }
  startHold(id) {
    const p = this.pts.get(id);
    if (!p || this.pts.size !== 1 || !this.game) return;
    // 아이템·물체·NPC를 누른 경우엔 길게 누르기도 탭처럼
    if (p.pick && (p.pick.item || p.pick.obj || (p.pick.actor && p.pick.actor.kind === 'npc'))) return;
    this.holding = true;
    this.holdActor = p.pick?.actor && p.pick.actor.team === 1 ? p.pick.actor : null;
    this.updateHold(p);
  }
  updateHold(p) {
    const r = this.app.renderer, g = this.game;
    const w = r.toWorld(p.x, p.y);
    // 누른 채 괴물에서 손가락이 떠나지 않았으면 그 괴물을 계속 공격
    if (this.holdActor && (this.holdActor.dead || Math.hypot(p.x - p.x0, p.y - p.y0) > 40)) this.holdActor = null;
    g.holdAt(w.x, w.y, this.holdActor);
    this.app.hud.holdMark?.(p.x, p.y);
  }
  cancelHold() {
    if (this.holding) { this.game?.releaseHold(); this.app.hud.holdMark?.(null); }
    this.holding = false; this.holdActor = null;
  }
  tap(x, y, pick) {
    const r = this.app.renderer, g = this.game;
    const w = r.toWorld(x, y);
    pick = pick || this.pick(x, y);
    g.tapAt(w.x, w.y, pick);
    this.app.hud.tapMark?.(x, y, pick);
  }

  // 화면 좌표에서 무엇을 눌렀나: 바닥 아이템 이름표 → 괴물·NPC → 물체
  pick(x, y) {
    const g = this.game, r = this.app.renderer;
    if (!g) return null;
    for (const lb of r.labels) if (x >= lb.x - 4 && x <= lb.x + lb.w + 4 && y >= lb.y - 4 && y <= lb.y + lb.h + 4) return { item: lb.it };
    const L = g.level;
    let best = null, bd = 1e9;
    const s = r.zoom;
    for (const a of L.actors) {
      if (a === g.player || a.dead || a.kind === 'summon') continue;
      if (a.team === 1 && (a.untargetable || a.stone || !g.canSee(a))) continue;
      const p = r.toScreen(a.x, a.y);
      const hgt = 56 * (a.look?.h || 1) * (a.look?.scale || 1) * s;
      const cy = p.y - hgt * 0.5;
      const dx = x - p.x, dy = y - cy;
      const rx = Math.max(24, 22 * s * (a.look?.bulk || 1)), ry = Math.max(30, hgt * 0.62);
      const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (d < 1 && d < bd) { bd = d; best = a; }
    }
    if (best) return { actor: best };
    // 물체: 화면에서 가까운 상호작용 물체
    let bo = null, bod = 1e9;
    for (const o of L.objects) {
      if (!isInteractive(o)) continue;
      if (L.theme !== 'town' && !(L.flags[o.y * L.w + o.x] & 4)) continue;
      const p = r.toScreen(o.x, o.y);
      const tall = o.type === 'door' || o.type === 'bookcase' || o.type === 'rack' || o.type === 'portal' ? 40 : o.type === 'stairs_down' ? 0 : 18;
      const dx = x - p.x, dy = y - (p.y - tall * s * 0.5);
      const d = Math.hypot(dx, dy * 1.3);
      const lim = Math.max(26, 30 * s);
      if (d < lim && d < bod) { bod = d; bo = o; }
    }
    if (bo) return { obj: bo };
    return null;
  }

  key(e) {
    const g = this.game;
    if (!g || e.repeat) return;
    const hud = this.app.hud;
    switch (e.key) {
      case '1': case '2': case '3': case '4': g.useBelt(+e.key - 1); break;
      case 'q': hud.useSlot(1); break;
      case 'w': hud.useSlot(2); break;
      case 'e': hud.useSlot(3); break;
      case 'r': hud.useSlot(4); break;
      case ' ': g.attackNearest(); break;
      case 'i': this.app.panels.toggle('inventory'); break;
      case 'c': this.app.panels.toggle('character'); break;
      case 's': this.app.panels.toggle('skills'); break;
      case 'Tab': e.preventDefault(); hud.toggleMap(); break;
      case 'Escape': this.app.panels.close(); this.app.dialog.close(); break;
    }
  }
}

// 터치 입력: 화면 왼쪽 아래를 누르고 끌면 조이스틱(이동은 조이스틱으로만), 탭 = 공격·줍기·대화·물체 쓰기,
// 괴물을 누르고 있기 = 계속 공격, 두 손가락 = 확대
import { isZoomed } from '../core/viewport.js';
import { isInteractive } from '../game/objects.js';

const STICK_R = 46; // 손잡이가 움직이는 반지름(px)
const STICK_DEAD = 9; // 이만큼은 밀어야 걷기 시작
const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

export class TouchInput {
  constructor(app) {
    this.app = app;
    const el = app.cv;
    this.pts = new Map();
    this.holding = false;
    this.stick = null; // 조이스틱을 잡은 손가락 { id, bx, by(받침), x0, y0, t0, moved, pick }
    this.keys = new Set();
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('touchstart', (e) => { if (e.touches.length > 1 && !isZoomed()) e.preventDefault(); }, { passive: false });
    el.addEventListener('wheel', (e) => { e.preventDefault(); const r = app.renderer; r.setUserZoom((r.userZoom || 1) * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // 키보드(데스크톱 시험용)
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('keyup', (e) => { if (ARROWS[e.key]) { this.keys.delete(e.key); this.arrowStick(); } });
  }
  get game() { return this.app.game; }

  down(e) {
    if (!this.game) return;
    this.app.cv.setPointerCapture?.(e.pointerId);
    // 왼쪽 아래를 누르면 그 자리에 조이스틱이 생긴다
    if (!this.stick && e.clientX < window.innerWidth * 0.5 && e.clientY > window.innerHeight * 0.42) {
      const x = e.clientX, y = e.clientY;
      this.stick = { id: e.pointerId, bx: x, by: y, x0: x, y0: y, t0: performance.now(), moved: 0, pick: this.pick(x, y) };
      this.app.hud.stickShow?.(x, y, 0, 0);
      return;
    }
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
    if (this.stick && e.pointerId === this.stick.id) { this.stickMove(e.clientX, e.clientY); return; }
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
    if (this.stick && e.pointerId === this.stick.id) { this.stickEnd(cancel); return; }
    const p = this.pts.get(e.pointerId);
    this.pts.delete(e.pointerId);
    clearTimeout(this.holdT);
    if (!p) return;
    if (this.pinch) { if (this.pts.size < 2) this.pinch = null; return; }
    const wasHold = this.holding;
    this.cancelHold();
    if (cancel || !this.game) return;
    // 끌지 않고 뗐으면 탭(괴물을 누르고 있다 뗀 경우는 이미 공격 중)
    if (!wasHold && Math.hypot(p.x - p.x0, p.y - p.y0) < 14) this.tap(p.x0, p.y0, p.pick);
  }
  // 조이스틱: 받침에서 손가락까지가 방향. 반지름을 넘어 끌면 받침이 따라온다
  stickMove(x, y) {
    const S = this.stick;
    S.moved = Math.max(S.moved, Math.hypot(x - S.x0, y - S.y0));
    let dx = x - S.bx, dy = y - S.by;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { S.bx = x - dx / d * STICK_R; S.by = y - dy / d * STICK_R; dx = x - S.bx; dy = y - S.by; }
    this.app.hud.stickShow?.(S.bx, S.by, dx, dy);
    this.steer(d < STICK_DEAD ? 0 : dx, d < STICK_DEAD ? 0 : dy);
  }
  stickEnd(cancel) {
    const S = this.stick;
    this.stick = null;
    this.steer(0, 0);
    this.app.hud.stickHide?.();
    // 거의 움직이지 않고 짧게 눌렀으면 탭으로(괴물·아이템 등을 누른 경우)
    if (!cancel && S.moved < 12 && performance.now() - S.t0 < 260 && S.pick) this.tap(S.x0, S.y0, S.pick);
  }
  // 화면 방향(dx, dy) → 게임의 월드 방향
  steer(dx, dy) {
    const g = this.game;
    if (!g) return;
    if (!dx && !dy) { g.setStick(null); return; }
    const r = this.app.renderer, cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const a = r.toWorld(cx, cy), b = r.toWorld(cx + dx, cy + dy);
    g.setStick(b.x - a.x, b.y - a.y);
  }
  // 방향 글쇠(데스크톱 시험용)
  arrowStick() {
    let dx = 0, dy = 0;
    for (const k of this.keys) { dx += ARROWS[k][0]; dy += ARROWS[k][1]; }
    if (!this.stick) this.steer(dx, dy);
  }
  startHold(id) {
    const p = this.pts.get(id);
    if (!p || this.pts.size !== 1 || !this.game) return;
    // 길게 누르기는 괴물을 계속 공격할 때만(바닥을 눌러서는 움직이지 않는다)
    if (!(p.pick?.actor && p.pick.actor.team === 1)) return;
    this.holding = true;
    this.holdActor = p.pick.actor;
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
    if (g.tapAt(w.x, w.y, pick)) { this.app.hud.tapMark?.(x, y, pick); return; }
    // 바닥 탭: 움직이지 않는다는 것을 처음 몇 번만 알려 준다
    if (!pick && (this.hintN || 0) < 3 && performance.now() - (this.hintT || -1e9) > 4000) {
      this.hintN = (this.hintN || 0) + 1; this.hintT = performance.now();
      this.app.toast?.('이동은 왼쪽 아래 조이스틱으로 합니다');
    }
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
    if (ARROWS[e.key]) { e.preventDefault(); this.keys.add(e.key); this.arrowStick(); return; }
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

// 터치 입력(플레이스테이션의 디아블로처럼): 화면 왼쪽을 누르고 끌면 그 자리에 조이스틱이 생겨 움직이고,
// 공격·기술·상호작용·물약은 모두 단추로 한다. 게임 화면의 나머지 곳은 두 손가락 확대·축소만
import { isZoomed } from '../core/viewport.js';

const STICK_R = 46; // 손잡이가 움직이는 반지름(px)
const STICK_DEAD = 6; // 이만큼은 밀어야 걷기 시작
const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

export class TouchInput {
  constructor(app) {
    this.app = app;
    const el = app.cv;
    this.pts = new Map();
    this.stick = null; // 조이스틱을 잡은 손가락 { id, bx, by(받침) }
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
    // 화면 왼쪽(위쪽 단추 줄 아래)을 누르면 그 자리에 조이스틱이 생긴다
    if (!this.stick && e.clientX < window.innerWidth * 0.45 && e.clientY > window.innerHeight * 0.18) {
      const x = e.clientX, y = e.clientY;
      this.stick = { id: e.pointerId, bx: x, by: y };
      this.app.hud.stickShow?.(x, y, 0, 0);
      return;
    }
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (this.pts.size === 2) {
      const [a, b] = [...this.pts.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.app.renderer.userZoom || 1 };
    }
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
    }
  }
  up(e, cancel = false) {
    if (this.stick && e.pointerId === this.stick.id) { this.stickEnd(); return; }
    const p = this.pts.get(e.pointerId);
    this.pts.delete(e.pointerId);
    if (!p) return;
    if (this.pinch) { if (this.pts.size < 2) this.pinch = null; return; }
    // 게임 화면을 눌러서는 아무것도 하지 않는다. 처음 몇 번만 단추를 알려 준다
    if (!cancel && Math.hypot(p.x - p.x0, p.y - p.y0) < 14) this.hint();
  }
  hint() {
    if ((this.hintN || 0) >= 3 || performance.now() - (this.hintT || -1e9) < 4000) return;
    this.hintN = (this.hintN || 0) + 1; this.hintT = performance.now();
    this.app.toast?.('이동은 왼쪽 조이스틱, 공격·줍기·대화는 오른쪽 아래 단추로 합니다');
  }
  // 조이스틱: 받침에서 손가락까지가 방향. 반지름을 넘어 끌면 받침이 따라온다
  stickMove(x, y) {
    const S = this.stick;
    let dx = x - S.bx, dy = y - S.by;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { S.bx = x - dx / d * STICK_R; S.by = y - dy / d * STICK_R; dx = x - S.bx; dy = y - S.by; }
    this.app.hud.stickShow?.(S.bx, S.by, dx, dy);
    this.steer(d < STICK_DEAD ? 0 : dx, d < STICK_DEAD ? 0 : dy);
  }
  stickEnd() {
    this.stick = null;
    this.steer(0, 0);
    this.app.hud.stickHide?.();
  }
  // 손가락 상태를 모두 지운다(앱 전환 등으로 손 뗌을 못 받았을 때)
  reset() {
    if (this.stick) this.stickEnd();
    this.pts.clear(); this.pinch = null;
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

  // 화면 좌표의 괴물(기술 단추에서 끌어 겨눌 때)
  pick(x, y) {
    const g = this.game, r = this.app.renderer;
    if (!g) return null;
    let best = null, bd = 1e9;
    const s = r.zoom;
    for (const a of g.level.actors) {
      if (a.team !== 1 || a.dead || a.untargetable || a.stone || !g.canSee(a)) continue;
      const p = r.toScreen(a.x, a.y);
      const hgt = 56 * (a.look?.h || 1) * (a.look?.scale || 1) * s;
      const dx = x - p.x, dy = y - (p.y - hgt * 0.5);
      const rx = Math.max(24, 22 * s * (a.look?.bulk || 1)), ry = Math.max(30, hgt * 0.62);
      const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (d < 1 && d < bd) { bd = d; best = a; }
    }
    return best ? { actor: best } : null;
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
      case 'f': g.interact(); break;
      case 'i': this.app.panels.toggle('inventory'); break;
      case 'c': this.app.panels.toggle('character'); break;
      case 's': this.app.panels.toggle('skills'); break;
      case 'Tab': e.preventDefault(); hud.toggleMap(); break;
      case 'Escape': this.app.panels.close(); this.app.dialog.close(); break;
    }
  }
}

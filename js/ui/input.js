// 지도 제스처: 드래그·핀치·탭·두 번 탭·길게 누르기·관성
export class MapInput {
  constructor(el, renderer, handlers) {
    this.el = el; this.r = renderer; this.h = handlers;
    this.pts = new Map();
    this.vel = { x: 0, y: 0 };
    this.lastTap = 0;
    this.gesturing = false;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
    // iOS 사파리 기본 제스처 차단
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  }
  down(e) {
    this.el.setPointerCapture?.(e.pointerId);
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    this.vel = { x: 0, y: 0 };
    this.inertia = false;
    if (this.pts.size === 1) {
      this.moved = false;
      this.lastMoveT = performance.now();
      clearTimeout(this.lpTimer);
      this.lpTimer = setTimeout(() => { if (!this.moved && this.pts.size === 1) { this.longPressed = true; this.h.longPress?.(e.clientX, e.clientY); } }, 520);
      this.longPressed = false;
    } else if (this.pts.size === 2) {
      clearTimeout(this.lpTimer);
      const [a, b] = [...this.pts.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      this.moved = true;
    }
    this.gesturing = true;
  }
  move(e) {
    const p = this.pts.get(e.pointerId); if (!p) return;
    const px = p.x, py = p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pts.size === 1) {
      if (!this.moved && Math.hypot(p.x - p.x0, p.y - p.y0) < 8) return;
      this.moved = true; clearTimeout(this.lpTimer);
      const dx = p.x - px, dy = p.y - py;
      const c = this.r.cam;
      c.x -= dx / c.s; c.y -= dy / c.s;
      this.r.clampCam();
      const now = performance.now(); const dt = Math.max(1, now - this.lastMoveT); this.lastMoveT = now;
      this.vel = { x: (dx / dt) * 16, y: (dy / dt) * 16 };
      this.h.changed?.();
    } else if (this.pts.size >= 2) {
      const [a, b] = [...this.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const c = this.r.cam;
      // 중점 이동 → 팬
      c.x -= (mx - this.pinch.mx) / c.s; c.y -= (my - this.pinch.my) / c.s;
      this.zoomAt(mx, my, d / Math.max(1, this.pinch.d), true);
      this.pinch = { d, mx, my };
      this.h.changed?.();
    }
  }
  up(e, cancel) {
    const p = this.pts.get(e.pointerId);
    this.pts.delete(e.pointerId);
    clearTimeout(this.lpTimer);
    if (this.pts.size === 1) { const q = [...this.pts.values()][0]; q.x0 = q.x; q.y0 = q.y; this.pinch = null; return; }
    if (this.pts.size > 0) return;
    this.gesturing = false;
    if (!p || cancel) { this.h.changed?.(true); return; }
    if (!this.moved && !this.longPressed) {
      const now = performance.now();
      if (now - this.lastTap < 300 && Math.hypot(p.x - this.lastTapX, p.y - this.lastTapY) < 30) { this.lastTap = 0; clearTimeout(this.tapTimer); this.zoomAt(p.x, p.y, 2.2); this.h.changed?.(true); return; }
      this.lastTap = now; this.lastTapX = p.x; this.lastTapY = p.y;
      // 단일 탭(두 번 탭 대기 없이 바로 처리, 두 번째 탭이 오면 확대)
      this.h.tap?.(p.x, p.y);
      return;
    }
    // 관성
    if (Math.hypot(this.vel.x, this.vel.y) > 2 && performance.now() - this.lastMoveT < 80) this.startInertia();
    else this.h.changed?.(true);
  }
  startInertia() {
    this.inertia = true;
    const step = () => {
      if (!this.inertia) return;
      const c = this.r.cam;
      c.x -= this.vel.x / c.s; c.y -= this.vel.y / c.s;
      this.r.clampCam();
      this.vel.x *= 0.92; this.vel.y *= 0.92;
      this.h.changed?.();
      if (Math.hypot(this.vel.x, this.vel.y) < 0.4) { this.inertia = false; this.h.changed?.(true); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  zoomAt(sx, sy, f, silent) {
    const r = this.r; const c = r.cam;
    const [wx, wy] = r.toWorld(sx, sy);
    c.s *= f;
    r.clampCam();
    const [wx2, wy2] = r.toWorld(sx, sy);
    c.x += wx - wx2; c.y += wy - wy2;
    r.clampCam();
    if (!silent) this.h.changed?.(true);
  }
}

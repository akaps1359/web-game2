// 한 층의 지도: 바닥·벽·통행·시야 정보와 그 위의 물체들
export const F_SOLID = 1, F_OPAQUE = 2, F_SEEN = 4, F_VIS = 8, F_LAVA = 16, F_ROOM = 32, F_NOSPAWN = 64, F_WATER = 128;

export class Level {
  constructor(w, h, theme, depth) {
    this.w = w; this.h = h; this.theme = theme; this.depth = depth;
    const n = w * h;
    this.floor = new Uint8Array(n); // 0 = 바닥 없음, 그 밖은 무늬 번호
    this.wall = new Uint8Array(n); // 0 = 벽 없음, 그 밖은 벽 무늬 번호
    this.flags = new Uint8Array(n);
    this.room = new Int16Array(n).fill(-1);
    this.occ = new Int32Array(n); // 서 있는 액터 id(0 = 비었음)
    this.objAt = new Int32Array(n); // 물체 번호 + 1
    this.rooms = [];
    this.actors = []; this.objects = []; this.items = []; this.missiles = []; this.corpses = []; this.decals = []; this.areas = [];
    this.lights = []; // 고정 광원(횃불 등)
    this.start = { x: 1, y: 1 };
    this.name = '';
  }
  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  isFloor(x, y) { return this.inb(x, y) && this.floor[y * this.w + x] > 0; }
  // 걸어갈 수 있는가(벽·닫힌 문·물체·용암 제외, 액터는 따로 본다)
  passable(x, y) {
    if (!this.inb(x, y)) return false;
    const i = y * this.w + x;
    return this.floor[i] > 0 && !(this.flags[i] & (F_SOLID | F_LAVA));
  }
  free(x, y, self = 0) {
    if (!this.passable(x, y)) return false;
    const o = this.occ[y * this.w + x];
    return o === 0 || o === self;
  }
  opaque(x, y) {
    if (!this.inb(x, y)) return true;
    const i = y * this.w + x;
    return !!(this.flags[i] & F_OPAQUE) || this.floor[i] === 0;
  }
  // 대각선 이동 시 모서리를 끼고 돌 수 없다
  canStep(x, y, nx, ny, self = 0) {
    if (!this.free(nx, ny, self)) return false;
    if (nx !== x && ny !== y) {
      if (!this.passable(nx, y) || !this.passable(x, ny)) return false;
    }
    return true;
  }
  obj(x, y) {
    if (!this.inb(x, y)) return null;
    const k = this.objAt[y * this.w + x];
    return k ? this.objects[k - 1] : null;
  }
  addObject(o) {
    this.objects.push(o);
    o.idx = this.objects.length - 1;
    if (o.x != null && !o.noAt) this.objAt[this.idx(o.x, o.y)] = this.objects.length;
    return o;
  }
  setFlag(x, y, f, on = true) {
    const i = this.idx(x, y);
    if (on) this.flags[i] |= f; else this.flags[i] &= ~f;
  }
  // (x, y)에서 가장 가까운 빈 바닥 칸
  nearestFree(x, y, maxR = 8, self = 0, ok = null) {
    x = Math.round(x); y = Math.round(y);
    if (this.free(x, y, self) && (!ok || ok(x, y))) return { x, y };
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx, ny = y + dy;
        if (!this.free(nx, ny, self) || (ok && !ok(nx, ny))) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = { x: nx, y: ny }; }
      }
      if (best) return best;
    }
    return null;
  }
  // 두 칸 사이가 트였는가(브레젠험)
  los(x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    let x = x0, y = y0;
    for (let n = 0; n < 200; n++) {
      if (x === x1 && y === y1) return true;
      if (!(x === x0 && y === y0) && this.opaque(x, y)) return false;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return false;
  }
  // 투사체·돌진이 지나갈 수 있는가(벽과 닫힌 문만 막는다)
  clearPath(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d * 3);
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
      if (!this.inb(x, y)) return false;
      const k = y * this.w + x;
      if (this.floor[k] === 0 || (this.flags[k] & F_SOLID && this.flags[k] & F_OPAQUE)) return false;
    }
    return true;
  }
}

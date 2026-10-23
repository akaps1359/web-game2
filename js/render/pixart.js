// 도트 그림 엔진(아이템·기술 그림): 설계 좌표(아이템 한 칸 = 24)로 모양을 짜면 목표 크기의 픽셀마다 모양 안인지 바로 따져
// 찍는다(흐린 가장자리 없음). 재료마다 어두움(0)→밝음(5) 6단 색(그늘은 푸르게, 빛은 노랗게 옮긴 색)으로 명암을 넣고, 부품마다
// 아래 부품 위로·맨 바깥에 1칸 외곽선을 두른다. 빛은 늘 화면 왼쪽 위에서 온다. 같은 설계로 어떤 크기든 또렷하게 나온다
import { makeCanvas } from './noise.js';

// ───────── 색 단계 ─────────
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function rgbHSL([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslRGB(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (!s) return [l * 255, l * 255, l * 255].map(Math.round);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map((v) => Math.round(v * 255));
}
// 색상 h를 목표 색상 쪽으로 최대 d도 옮긴다
const towards = (h, to, d) => { const diff = ((to - h + 540) % 360) - 180; return h + Math.sign(diff) * Math.min(Math.abs(diff), d); };
const RAMPS = new Map();
// 바탕색(3단)에서 6단 색: 0·1·2는 어둡고 푸르게·진하게, 4·5는 밝고 노랗게·옅게
export function ramp(hex) {
  let r = RAMPS.get(hex);
  if (r) return r;
  const [h, s, l] = rgbHSL(hexRGB(hex));
  r = [];
  for (let i = 0; i < 6; i++) {
    const d = i - 3;
    let L, S, H;
    if (d < 0) { L = l * (1 + d * 0.25); S = Math.min(1, Math.max(s * (1 + 0.1 * -d), 0.05 * -d)); H = towards(h, 235, 7 * -d); }
    else if (d > 0) { L = l + (1 - l) * d * (l > 0.6 ? 0.42 : 0.3); S = Math.max(s * (1 - 0.18 * d), 0.04 * d); H = towards(h, 50, 8 * d); }
    else { L = l; S = s; H = h; }
    if (!s && d === 0) S = 0;
    r.push(hslRGB(H, S, Math.max(0.03, Math.min(0.98, L))));
  }
  RAMPS.set(hex, r);
  return r;
}
const pack = (c) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
const colOf = (c) => (typeof c === 'string' ? pack(hexRGB(c)) : pack(c));
// 빛: 왼쪽 위 앞
const LX = -0.48, LY = -0.62, LZ = 0.62;

// ───────── 그림판 ─────────
export class Art {
  // w×h 목표 픽셀, dw×dh 설계 크기. o.rot: 돌림(라디안), o.pad: 가장자리 여백(외곽선 자리)
  constructor(w, h, dw, dh, o = {}) {
    this.w = w; this.h = h;
    const pad = o.pad ?? 1, rot = o.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
    const bw = Math.abs(dw * c) + Math.abs(dh * s), bh = Math.abs(dw * s) + Math.abs(dh * c);
    const k = this.k = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    this.c = c; this.s = s; this.cdx = dw / 2; this.cdy = dh / 2; this.ctx = w / 2; this.cty = h / 2;
    // 픽셀 중심의 설계 좌표
    const n = w * h;
    this.X = new Float32Array(n); this.Y = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const tx = (x + 0.5 - this.ctx) / k, ty = (y + 0.5 - this.cty) / k, i = y * w + x;
      this.X[i] = this.cdx + tx * c + ty * s; this.Y[i] = this.cdy - tx * s + ty * c;
    }
    this.col = new Uint32Array(n); // 0 = 빈칸
    this.part = new Int16Array(n).fill(-1);
    this.np = 0;
  }
  // 설계 → 목표 픽셀(실수)
  tx(x, y) { return this.ctx + ((x - this.cdx) * this.c - (y - this.cdy) * this.s) * this.k; }
  ty(x, y) { return this.cty + ((x - this.cdx) * this.s + (y - this.cdy) * this.c) * this.k; }
  mask() { return new Mask(this); }
  // 모양을 재료로 칠한다. mode: flat·bevel·sphere·cyl·fn. o.lv 바탕 단계(3), o.tex(lv, px, py, x, y) 무늬, o.ol 부품 외곽선(기본 켬)
  paint(m, mat, mode = 'bevel', o = {}) {
    if (!m.any) return this;
    const { w, X, Y } = this, M = m.m, part = this.np++;
    const base = o.lv ?? 3, grad = o.grad ?? (mode === 'bevel' ? 1.1 : 0);
    // 구·원통: 목표 픽셀 공간에서 중심·축
    let scx = 0, scy = 0, sr = 1, ax = 0, ay = 0, nx = 0, ny = 0, cr = 1;
    if (mode === 'sphere') {
      if (o.c) { scx = this.tx(o.c[0], o.c[1]); scy = this.ty(o.c[0], o.c[1]); sr = (o.r ?? 1) * this.k; }
      else { scx = (m.x0 + m.x1 + 1) / 2; scy = (m.y0 + m.y1 + 1) / 2; sr = Math.max(m.x1 - m.x0 + 1, m.y1 - m.y0 + 1) / 2; }
    } else if (mode === 'cyl') {
      const [x0, y0, x1, y1] = o.ax;
      ax = this.tx(x0, y0); ay = this.ty(x0, y0);
      const bx = this.tx(x1, y1) - ax, by = this.ty(x1, y1) - ay, L = Math.hypot(bx, by) || 1;
      nx = -by / L; ny = bx / L;
      // 빛을 받는 쪽이 음수가 되게
      if (nx * LX + ny * LY > 0) { nx = -nx; ny = -ny; }
      cr = (o.r ?? 2) * this.k;
    }
    const gx0 = m.x0, gy0 = m.y0, gw = Math.max(1, m.x1 - m.x0), gh = Math.max(1, m.y1 - m.y0);
    const pal = mat.map(pack);
    for (let py = m.y0; py <= m.y1; py++) for (let px = m.x0; px <= m.x1; px++) {
      const i = py * w + px;
      if (!M[i]) continue;
      let lv = base;
      if (mode === 'bevel' || o.edge) {
        const tl = !M[i - 1] || px === 0 || !M[i - w] || py === 0, br = px === w - 1 || !M[i + 1] || !M[i + w];
        if (tl && !br) lv += 1; else if (br && !tl) lv -= 1;
        lv += (0.5 - ((px - gx0) / gw + (py - gy0) / gh) / 2) * grad;
      }
      if (mode === 'sphere') {
        const ux = (px + 0.5 - scx) / sr, uy = (py + 0.5 - scy) / sr, q = Math.min(1, ux * ux + uy * uy), uz = Math.sqrt(1 - q);
        const d = ux * LX + uy * LY + uz * LZ;
        lv += (d - 0.55) * 4.4 + (o.spec && d > 0.93 ? 1 : 0);
      } else if (mode === 'cyl') {
        const u = Math.max(-1, Math.min(1, ((px + 0.5 - ax) * nx + (py + 0.5 - ay) * ny) / cr)), uz = Math.sqrt(1 - u * u);
        const d = u * (nx * LX + ny * LY) + uz * LZ;
        lv += (d - 0.55) * 4 + (u < -0.2 && u > -0.65 && o.spec ? 1 : 0);
      } else if (mode === 'fn') lv += o.fn(X[i], Y[i], px, py) - base;
      if (o.tex) lv = o.tex(lv, px, py, X[i], Y[i]);
      const k = Math.max(0, Math.min(5, Math.round(lv)));
      this.col[i] = pal[k]; this.part[i] = part;
    }
    // 아래 부품 위로 1칸 외곽선
    if (o.ol !== false) {
      const oc = o.olc ? colOf(o.olc) : pal[0];
      for (let py = Math.max(0, m.y0 - 1); py <= Math.min(this.h - 1, m.y1 + 1); py++) for (let px = Math.max(0, m.x0 - 1); px <= Math.min(w - 1, m.x1 + 1); px++) {
        const i = py * w + px;
        if (M[i] || !this.col[i] || this.part[i] === part) continue;
        if ((px > 0 && M[i - 1]) || (px < w - 1 && M[i + 1]) || (py > 0 && M[i - w]) || (py < this.h - 1 && M[i + w])) { this.col[i] = oc; this.part[i] = part; }
      }
    }
    return this;
  }
  // 1픽셀 선·점(설계 좌표). o.on: 이미 칠한 곳에만
  line(x0, y0, x1, y1, col, o = {}) {
    let ax = Math.floor(this.tx(x0, y0)), ay = Math.floor(this.ty(x0, y0));
    const bx = Math.floor(this.tx(x1, y1)), by = Math.floor(this.ty(x1, y1));
    const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx + dy;
    const c = colOf(col);
    for (let n = 0; n < 400; n++) {
      this.px(ax, ay, c, o.on);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; ax += sx; }
      if (e2 <= dx) { err += dx; ay += sy; }
    }
    return this;
  }
  dot(x, y, col, on = false) { this.px(Math.floor(this.tx(x, y)), Math.floor(this.ty(x, y)), colOf(col), on); return this; }
  px(x, y, c, on) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (on && !this.col[i]) return;
    this.col[i] = typeof c === 'number' ? c : colOf(c);
    if (this.part[i] < 0) this.part[i] = 9999;
  }
  // 맨 바깥 1칸 외곽선
  outline(col = '#0a0705') {
    const { w, h } = this, C = this.col, c = colOf(col), add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (C[i]) continue;
      if ((x > 0 && C[i - 1]) || (x < w - 1 && C[i + 1]) || (y > 0 && C[i - w]) || (y < h - 1 && C[i + w])) add.push(i);
    }
    for (const i of add) C[i] = c;
    return this;
  }
  canvas() {
    const cv = makeCanvas(this.w, this.h), g = cv.getContext('2d'), img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.col);
    g.putImageData(img, 0, 0);
    return cv;
  }
}

// 모양 가림판: 설계 좌표의 모양을 목표 픽셀에 찍는다(픽셀 중심이 모양 안이면 칸이 찬다)
class Mask {
  constructor(A) { this.A = A; this.m = new Uint8Array(A.w * A.h); this.x0 = A.w; this.y0 = A.h; this.x1 = -1; this.y1 = -1; this.any = false; }
  // 설계 상자 → 목표 픽셀 범위
  _box(x0, y0, x1, y1) {
    const A = this.A, xs = [A.tx(x0, y0), A.tx(x1, y0), A.tx(x0, y1), A.tx(x1, y1)], ys = [A.ty(x0, y0), A.ty(x1, y0), A.ty(x0, y1), A.ty(x1, y1)];
    return [Math.max(0, Math.floor(Math.min(...xs)) - 1), Math.max(0, Math.floor(Math.min(...ys)) - 1), Math.min(A.w - 1, Math.ceil(Math.max(...xs)) + 1), Math.min(A.h - 1, Math.ceil(Math.max(...ys)) + 1)];
  }
  _fill(bx, test, val = 1) {
    const A = this.A, w = A.w, X = A.X, Y = A.Y, M = this.m;
    for (let py = bx[1]; py <= bx[3]; py++) for (let px = bx[0]; px <= bx[2]; px++) {
      const i = py * w + px;
      if (!test(X[i], Y[i])) continue;
      M[i] = val;
      if (val) { this.any = true; if (px < this.x0) this.x0 = px; if (px > this.x1) this.x1 = px; if (py < this.y0) this.y0 = py; if (py > this.y1) this.y1 = py; }
    }
    return this;
  }
  poly(p) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    const n = p.length;
    return this._fill(this._box(x0, y0, x1, y1), (x, y) => {
      let ins = false;
      for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
        const yi = p[i + 1], yj = p[j + 1];
        if ((yi > y) !== (yj > y) && x < (p[j] - p[i]) * (y - yi) / (yj - yi) + p[i]) ins = !ins;
      }
      return ins;
    });
  }
  rect(x, y, w, h) { return this._fill(this._box(x, y, x + w, y + h), (px, py) => px >= x && px < x + w && py >= y && py < y + h); }
  ellipse(cx, cy, rx, ry) { return this._fill(this._box(cx - rx, cy - ry, cx + rx, cy + ry), (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1); }
  circle(cx, cy, r) { return this.ellipse(cx, cy, r, r); }
  // 굵은 선(둥근 끝). 너무 가늘면 반 픽셀은 되게
  capsule(x0, y0, x1, y1, r) {
    r = Math.max(r, 0.5 / this.A.k);
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9, r2 = r * r;
    return this._fill(this._box(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r), (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2)), ex = x0 + dx * t - x, ey = y0 + dy * t - y;
      return ex * ex + ey * ey <= r2;
    });
  }
  // 점들을 잇는 굵은 선. r: 수 또는 점마다의 굵기 배열
  path(pts, r) { for (let i = 0; i + 3 < pts.length; i += 2) { const k = i / 2; this.capsule(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], Array.isArray(r) ? (r[k] + r[k + 1]) / 2 : r); } return this; }
  // 타원 띠(바깥 rx·ry, 두께 t)
  ring(cx, cy, rx, ry, t) { return this._fill(this._box(cx - rx, cy - ry, cx + rx, cy + ry), (x, y) => { const a = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2, b = ((x - cx) / Math.max(0.1, rx - t)) ** 2 + ((y - cy) / Math.max(0.1, ry - t)) ** 2; return a <= 1 && b > 1; }); }
  fn(x0, y0, x1, y1, test) { return this._fill(this._box(x0, y0, x1, y1), test); }
  // 다른 가림판과 겹치는 곳만 / 빼기
  and(o) { for (let i = 0; i < this.m.length; i++) if (!o.m[i]) this.m[i] = 0; return this._rebox(); }
  minus(o) { for (let i = 0; i < this.m.length; i++) if (o.m[i]) this.m[i] = 0; return this._rebox(); }
  _rebox() {
    const w = this.A.w;
    this.x0 = this.A.w; this.y0 = this.A.h; this.x1 = -1; this.y1 = -1; this.any = false;
    for (let i = 0; i < this.m.length; i++) if (this.m[i]) { const x = i % w, y = (i / w) | 0; this.any = true; if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y; }
    return this;
  }
}

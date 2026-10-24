// 움직이지 않는 모형(건물·소품·나무)을 도트 그림으로 굽는다.
// 모형 좌표: x·y는 칸(앵커 칸 중심이 0), z는 높이(화면 px). 평면 조각과 공을 깊이 버퍼에 하나씩 그리며 픽셀마다 재질 무늬와
// 빛을 계산하고, 크게(SS배) 그린 그림을 줄여 색을 줄인 뒤 바깥에 1도트 어두운 외곽선을 두른다. 배율(도트 크기)마다 따로 굽는다
import { makeCanvas } from './noise.js';
import { shrink } from './pixel.js';

// 화면이 정투영이 되는 공간(위에서 30도로 내려다본다): 칸 한 변 = KT, 높이 1px = KZ
export const KT = 45.254834, KZ = 1.1547005;
const E1x = 0.70710678, E1y = -0.70710678; // 화면 x축
const E2x = 0.35355339, E2y = 0.35355339, E2z = -0.8660254; // 화면 y축(아래쪽)
const Vx = 0.61237244, Vy = 0.61237244, Vz = 0.5; // 보는 사람 쪽
// 빛(빛이 오는 쪽): 왼쪽 앞 위. 윗면 1.1, 왼쪽(+y) 면 0.95, 오른쪽(+x) 면 0.63
let LX = 0.32, LY = 0.6, LZ = 0.73;
{ const n = Math.hypot(LX, LY, LZ); LX /= n; LY /= n; LZ /= n; }
const AMB = 0.26, DIF = 1.15;
export const lightOf = (nx, ny, nz) => { const d = nx * LX + ny * LY + nz * LZ; return Math.min(1.32, AMB + DIF * (d > 0 ? d : 0)); };

// 모서리 비트(면 가장자리를 어둡게 할 쪽): al=0, al=1, be=0, be=1
export const EA0 = 1, EA1 = 2, EB0 = 4, EB1 = 8, EALL = 15;

export class Model {
  constructor(seed = 1) { this.faces = []; this.balls = []; this.glows = []; this.shadows = []; this.seed = seed; }
  // 평행사변형 면: 꼭짓점 p와 두 변 u·v(모형 좌표). o.shape: 'tri' 또는 (al, be) => 면 안인가,
  // o.edge: 가장자리 1도트 밝기(1이면 그대로), o.edges: 어둡게 할 가장자리 비트, o.n0·o.n1: al을 따라 법선을 부드럽게(원통)
  face(p, u, v, mat, o = {}) {
    const f = {
      px: p[0] * KT, py: p[1] * KT, pz: p[2] * KZ,
      ux: u[0] * KT, uy: u[1] * KT, uz: u[2] * KZ,
      vx: v[0] * KT, vy: v[1] * KT, vz: v[2] * KZ,
      mat, shape: o.shape || null, edge: o.edge ?? 0.8, edges: o.edges ?? EALL, lit: o.lit ?? 1,
      seed: o.seed ?? ((this.faces.length * 7919 + this.seed * 131) & 0xffff), n0: o.n0 || null, n1: o.n1 || null, data: o.data ?? null,
    };
    f.lu = Math.hypot(f.ux, f.uy, f.uz); f.lv = Math.hypot(f.vx, f.vy, f.vz);
    let nx = f.uy * f.vz - f.uz * f.vy, ny = f.uz * f.vx - f.ux * f.vz, nz = f.ux * f.vy - f.uy * f.vx;
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-9) return null;
    nx /= nl; ny /= nl; nz /= nl;
    if (nx * Vx + ny * Vy + nz * Vz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    f.nx = nx; f.ny = ny; f.nz = nz;
    this.faces.push(f);
    return f;
  }
  // 상자 [x0,x1]×[y0,y1]×[z0,z1]: 보이는 세 면(윗면·+x면·+y면). m: { top, x, y, side, all } (null이면 그 면은 없음)
  box(x0, y0, z0, x1, y1, z1, m, o = {}) {
    const side = m.side || m.all, top = m.top === undefined ? m.all : m.top;
    if (top) this.face([x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0], top, o);
    const mx = m.x === undefined ? side : m.x, my = m.y === undefined ? side : m.y;
    if (mx) this.face([x1, y0, z0], [0, y1 - y0, 0], [0, 0, z1 - z0], mx, o);
    if (my) this.face([x0, y1, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], my, o);
  }
  // 박공지붕: 벽 [x0,x1]×[y0,y1], 처마 높이 z0, 용마루까지 높이 h, 용마루 방향 axis. 처마 내밈 ov, 박공 내밈 og, 두께 th
  // m: { roof, end(박공 벽), rake(지붕 끝 판) }
  gable(x0, y0, x1, y1, z0, h, axis, m, o = {}) {
    const ov = o.ov ?? 0.2, og = o.og ?? 0.14, th = o.th ?? 4, E = o.edge ?? 0.78;
    if (axis === 'x') {
      const ym = (y0 + y1) / 2, k = h / (ym - y0), ze = z0 - k * ov, xa = x0 - og, xb = x1 + og, ya = y0 - ov, yb = y1 + ov, zr = z0 + h;
      this.face([xa, yb, ze], [xb - xa, 0, 0], [0, ym - yb, zr - ze], m.roof, { edges: EB0 | EA1, edge: E, data: 1 });
      this.face([xa, ya, ze], [xb - xa, 0, 0], [0, ym - ya, zr - ze], m.roof, { edges: EB0 | EA1, edge: E, data: -1 });
      if (m.end) this.face([x1, y0, z0], [0, y1 - y0, 0], [0, ym - y0, h], m.end, { shape: 'tri', edges: 0 });
      const rk = m.rake || m.roof;
      this.face([xb, yb, ze - th], [0, ym - yb, zr - ze], [0, 0, th], rk, { edge: 0.7 });
      this.face([xb, ya, ze - th], [0, ym - ya, zr - ze], [0, 0, th], rk, { edge: 0.7 });
      this.face([xa, yb, ze - th], [xb - xa, 0, 0], [0, 0, th], rk, { edge: 0.7 });
    } else {
      const xm = (x0 + x1) / 2, k = h / (xm - x0), ze = z0 - k * ov, ya = y0 - og, yb = y1 + og, xa = x0 - ov, xb = x1 + ov, zr = z0 + h;
      this.face([xb, ya, ze], [0, yb - ya, 0], [xm - xb, 0, zr - ze], m.roof, { edges: EB0 | EA1, edge: E, data: 1 });
      this.face([xa, ya, ze], [0, yb - ya, 0], [xm - xa, 0, zr - ze], m.roof, { edges: EB0 | EA1, edge: E, data: -1 });
      if (m.end) this.face([x0, y1, z0], [x1 - x0, 0, 0], [xm - x0, 0, h], m.end, { shape: 'tri', edges: 0 });
      const rk = m.rake || m.roof;
      this.face([xb, yb, ze - th], [xm - xb, 0, zr - ze], [0, 0, th], rk, { edge: 0.7 });
      this.face([xa, yb, ze - th], [xm - xa, 0, zr - ze], [0, 0, th], rk, { edge: 0.7 });
      this.face([xb, ya, ze - th], [0, yb - ya, 0], [0, 0, th], rk, { edge: 0.7 });
    }
  }
  // 외쪽 지붕: 높은 쪽 (hi) 처마 z1에서 낮은 쪽 z0으로. dir: 낮아지는 쪽('+x'|'+y')
  shed(x0, y0, x1, y1, z0, z1, dir, mat, o = {}) {
    const ov = o.ov ?? 0.15, th = o.th ?? 3;
    if (dir === '+x') {
      const k = (z1 - z0) / (x1 - x0), zb = z0 - k * ov;
      this.face([x1 + ov, y0 - ov, zb], [0, y1 - y0 + ov * 2, 0], [x0 - x1 - ov, 0, z1 - zb], mat, { edges: EB0, edge: 0.75 });
      this.face([x1 + ov, y0 - ov, zb - th], [0, y1 - y0 + ov * 2, 0], [0, 0, th], o.rake || mat, { edge: 0.7 });
      this.face([x0, y1 + ov, z1 - th], [x1 + ov - x0, 0, zb - z1], [0, 0, th], o.rake || mat, { edge: 0.7 });
    } else {
      const k = (z1 - z0) / (y1 - y0), zb = z0 - k * ov;
      this.face([x0 - ov, y1 + ov, zb], [x1 - x0 + ov * 2, 0, 0], [0, y0 - y1 - ov, z1 - zb], mat, { edges: EB0, edge: 0.75 });
      this.face([x0 - ov, y1 + ov, zb - th], [x1 - x0 + ov * 2, 0, 0], [0, 0, th], o.rake || mat, { edge: 0.7 });
      this.face([x1 + ov, y0, z1 - th], [0, y1 + ov - y0, zb - z1], [0, 0, th], o.rake || mat, { edge: 0.7 });
    }
  }
  // 피라미드(첨탑·모임지붕): 바닥 [x0,x1]×[y0,y1] 높이 z0, 꼭대기 z1. 보이는 두 면만(+x·+y)과 뒤 두 면
  pyramid(x0, y0, x1, y1, z0, z1, mat, o = {}) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ap = [cx, cy, z1];
    const tri = (a, b) => this.face(a, [b[0] - a[0], b[1] - a[1], b[2] - a[2]], [ap[0] - a[0], ap[1] - a[1], ap[2] - a[2]], mat, { shape: 'tri', edges: EB0 | EA0, edge: o.edge ?? 0.8, data: o.data });
    tri([x0, y1, z0], [x1, y1, z0]); tri([x1, y1, z0], [x1, y0, z0]); tri([x1, y0, z0], [x0, y0, z0]); tri([x0, y0, z0], [x0, y1, z0]);
  }
  // 원기둥(옆면은 n각으로 나누되 법선은 부드럽게): 중심 (cx, cy), 반지름 r(칸), [z0, z1]. m: { side, top }
  cyl(cx, cy, r, z0, z1, m, o = {}) {
    const n = o.n || 14, a0 = o.a0 ?? 0;
    for (let i = 0; i < n; i++) {
      const t0 = a0 + i / n * Math.PI * 2, t1 = a0 + (i + 1) / n * Math.PI * 2, tm = (t0 + t1) / 2;
      if (Math.cos(tm) + Math.sin(tm) < -0.25) continue; // 뒤쪽
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      if (m.side) this.face([cx + r * c0, cy + r * s0, z0], [r * (c1 - c0), r * (s1 - s0), 0], [0, 0, z1 - z0], m.side, { n0: [c0, s0, 0], n1: [c1, s1, 0], edges: o.edges ?? (EB0 | EB1), edge: o.edge ?? 0.8, data: o.data, seed: o.seed });
    }
    if (m.top) this.face([cx - r, cy - r, z1], [r * 2, 0, 0], [0, r * 2, 0], m.top, { shape: disc, edges: 0, data: o.data, seed: o.seed });
  }
  // 원뿔(뾰족지붕): 중심 (cx, cy), 바닥 반지름 r, [z0, z1]
  cone(cx, cy, r, z0, z1, mat, o = {}) {
    const n = o.n || 14, e = Math.atan2(r * KT, (z1 - z0) * KZ), ce = Math.cos(e), se = Math.sin(e);
    for (let i = 0; i < n; i++) {
      const t0 = i / n * Math.PI * 2, t1 = (i + 1) / n * Math.PI * 2, tm = (t0 + t1) / 2;
      if (Math.cos(tm) + Math.sin(tm) < -0.6) continue;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const p = [cx + r * c0, cy + r * s0, z0];
      this.face(p, [r * (c1 - c0), r * (s1 - s0), 0], [cx - p[0], cy - p[1], z1 - z0], mat, { shape: 'tri', n0: [c0 * ce, s0 * ce, se], n1: [c1 * ce, s1 * ce, se], edges: EB0, edge: o.edge ?? 0.8, data: o.data });
    }
  }
  // 공(나뭇잎 덩어리 등): 중심 (x, y, z), 반지름 r(칸)
  ball(x, y, z, r, mat, o = {}) { this.balls.push({ cx: x * KT, cy: y * KT, cz: z * KZ, r: r * KT, mat, lit: o.lit ?? 1, edge: o.edge ?? 0.85, seed: o.seed ?? this.balls.length * 37 + this.seed }); }
  // 밤에 번지는 빛(창문 등): 모형 좌표, 반지름(px), 색, 세기
  glow(x, y, z, r, col, a = 0.3, fl = 0) { this.glows.push({ x, y, z, r, col, a, fl }); }
  // 바닥 그림자 다각형(모형 좌표)
  shade(pts, a = 0.28) { this.shadows.push({ pts, a }); }
}
const disc = (al, be) => (al - 0.5) * (al - 0.5) + (be - 0.5) * (be - 0.5) <= 0.25;

// ───────── 굽기 ─────────
// 재질 함수가 읽고 쓰는 판: a·b(면 위 거리), al·be(0..1), x·y·z(모형 좌표), 법선, 출력 R·G·B·E(스스로 빛남 0..1)
const C = { a: 0, b: 0, al: 0, be: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1, R: 0, G: 0, B: 0, E: 0 };

function rasterFace(f, R, OX, OY, W, H, col, zb, EW) {
  const s0x = (E1x * f.px + E1y * f.py) * R + OX, s0y = (E2x * f.px + E2y * f.py + E2z * f.pz) * R + OY;
  const a11 = (E1x * f.ux + E1y * f.uy) * R, a12 = (E1x * f.vx + E1y * f.vy) * R;
  const a21 = (E2x * f.ux + E2y * f.uy + E2z * f.uz) * R, a22 = (E2x * f.vx + E2y * f.vy + E2z * f.vz) * R;
  const det = a11 * a22 - a12 * a21;
  if (Math.abs(det) < 1e-6) return;
  const i11 = a22 / det, i12 = -a12 / det, i21 = -a21 / det, i22 = a11 / det;
  const bx0 = Math.max(0, Math.floor(Math.min(s0x, s0x + a11, s0x + a12, s0x + a11 + a12)));
  const bx1 = Math.min(W - 1, Math.ceil(Math.max(s0x, s0x + a11, s0x + a12, s0x + a11 + a12)));
  const by0 = Math.max(0, Math.floor(Math.min(s0y, s0y + a21, s0y + a22, s0y + a21 + a22)));
  const by1 = Math.min(H - 1, Math.ceil(Math.max(s0y, s0y + a21, s0y + a22, s0y + a21 + a22)));
  const d0 = f.px * Vx + f.py * Vy + f.pz * Vz, du = f.ux * Vx + f.uy * Vy + f.uz * Vz, dv = f.vx * Vx + f.vy * Vy + f.vz * Vz;
  const ga = Math.hypot(i11, i12) || 1e-9, gb = Math.hypot(i21, i22) || 1e-9, gab = Math.hypot(i11 + i21, i12 + i22) || 1e-9;
  const tri = f.shape === 'tri', fn = typeof f.shape === 'function' ? f.shape : null;
  const flat = lightOf(f.nx, f.ny, f.nz) * f.lit, eg = f.edges, ek = f.edge;
  const n0 = f.n0, n1 = f.n1, mat = f.mat;
  for (let py = by0; py <= by1; py++) {
    const dy = py + 0.5 - s0y;
    for (let px = bx0; px <= bx1; px++) {
      const dx = px + 0.5 - s0x;
      const al = i11 * dx + i12 * dy, be = i21 * dx + i22 * dy;
      if (al < 0 || be < 0 || al > 1 || be > 1) continue;
      if (tri && al + be > 1) continue;
      if (fn && !fn(al, be)) continue;
      const k = py * W + px, dep = d0 + al * du + be * dv;
      if (dep <= zb[k]) continue;
      C.al = al; C.be = be; C.a = al * f.lu; C.b = be * f.lv;
      C.x = (f.px + al * f.ux + be * f.vx) / KT; C.y = (f.py + al * f.uy + be * f.vy) / KT; C.z = (f.pz + al * f.uz + be * f.vz) / KZ;
      let L = flat;
      if (n0) {
        const t = tri ? al / Math.max(1e-6, 1 - be) : al;
        let nx = n0[0] + (n1[0] - n0[0]) * t, ny = n0[1] + (n1[1] - n0[1]) * t, nz = n0[2] + (n1[2] - n0[2]) * t;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        C.nx = nx; C.ny = ny; C.nz = nz; L = lightOf(nx, ny, nz) * f.lit;
      } else { C.nx = f.nx; C.ny = f.ny; C.nz = f.nz; }
      C.E = 0;
      if (!mat(C, f)) continue;
      if (eg && ek !== 1) {
        let ed = 1e9;
        if (tri) {
          if (eg & EA0) ed = al / ga;
          if (eg & EB0) ed = Math.min(ed, be / gb);
          if (eg & EA1) ed = Math.min(ed, (1 - al - be) / gab);
        } else {
          if (eg & EA0) ed = al / ga;
          if (eg & EA1) ed = Math.min(ed, (1 - al) / ga);
          if (eg & EB0) ed = Math.min(ed, be / gb);
          if (eg & EB1) ed = Math.min(ed, (1 - be) / gb);
        }
        if (ed < EW) L *= ek;
      }
      const e = C.E, m = L * (1 - e) + e, o = k * 4;
      col[o] = C.R * m; col[o + 1] = C.G * m; col[o + 2] = C.B * m; col[o + 3] = 255;
      zb[k] = dep;
    }
  }
}

function rasterBall(b, R, OX, OY, W, H, col, zb, EW) {
  const scx = (E1x * b.cx + E1y * b.cy) * R + OX, scy = (E2x * b.cx + E2y * b.cy + E2z * b.cz) * R + OY, rr = b.r * R;
  const d0 = b.cx * Vx + b.cy * Vy + b.cz * Vz, r = b.r, r2 = r * r;
  const bx0 = Math.max(0, Math.floor(scx - rr)), bx1 = Math.min(W - 1, Math.ceil(scx + rr));
  const by0 = Math.max(0, Math.floor(scy - rr)), by1 = Math.min(H - 1, Math.ceil(scy + rr));
  const f = { seed: b.seed, data: null };
  for (let py = by0; py <= by1; py++) {
    const ey = (py + 0.5 - scy) / R;
    for (let px = bx0; px <= bx1; px++) {
      const ex = (px + 0.5 - scx) / R, q = r2 - ex * ex - ey * ey;
      if (q <= 0) continue;
      const h = Math.sqrt(q), k = py * W + px, dep = d0 + h;
      if (dep <= zb[k]) continue;
      const nx = (ex * E1x + ey * E2x + h * Vx) / r, ny = (ex * E1y + ey * E2y + h * Vy) / r, nz = (ey * E2z + h * Vz) / r;
      C.nx = nx; C.ny = ny; C.nz = nz; C.a = ex; C.b = ey; C.al = 0; C.be = 0;
      C.x = (b.cx + nx * r) / KT; C.y = (b.cy + ny * r) / KT; C.z = (b.cz + nz * r) / KZ;
      C.E = 0;
      if (!b.mat(C, f)) continue;
      let L = lightOf(nx, ny, nz) * b.lit;
      if ((r - Math.sqrt(ex * ex + ey * ey)) * R < EW) L *= b.edge;
      const e = C.E, m = L * (1 - e) + e, o = k * 4;
      col[o] = C.R * m; col[o + 1] = C.G * m; col[o + 2] = C.B * m; col[o + 3] = 255;
      zb[k] = dep;
    }
  }
}

// 바깥 1도트 외곽선(투명한 칸 가운데 불투명한 칸과 맞닿은 곳)
function outline(cv, col = [13, 9, 7], a = 235) {
  const w = cv.width, h = cv.height, g = cv.getContext('2d'), img = g.getImageData(0, 0, w, h), d = img.data;
  const src = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) src[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (src[i]) continue;
    if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) {
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  // 열마다 불투명한 범위(가림 판정용)
  const top = new Int16Array(w).fill(-1), bot = new Int16Array(w).fill(-1);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 0) { if (top[x] < 0) top[x] = y; bot[x] = y; }
  return { top, bot };
}

// 모형을 배율 sl(세상 px당 도트)로 굽는 일감: step(ms)를 여러 장면에 나눠 부를 수 있다(면 단위로 끊는다).
// 끝나면 out = { cv, ax, ay(앵커 도트), top·bot(열마다 불투명 범위), sh(바닥 그림자), glows }
export function bakeJob(M, sl, SS = 2) {
  const R = sl * SS;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const acc = (X, Y, Z) => {
    const sx = E1x * X + E1y * Y, sy = E2x * X + E2y * Y + E2z * Z;
    if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
  };
  for (const f of M.faces) {
    acc(f.px, f.py, f.pz); acc(f.px + f.ux, f.py + f.uy, f.pz + f.uz);
    acc(f.px + f.vx, f.py + f.vy, f.pz + f.vz); acc(f.px + f.ux + f.vx, f.py + f.uy + f.vy, f.pz + f.uz + f.vz);
  }
  for (const b of M.balls) {
    const sx = E1x * b.cx + E1y * b.cy, sy = E2x * b.cx + E2y * b.cy + E2z * b.cz;
    x0 = Math.min(x0, sx - b.r); x1 = Math.max(x1, sx + b.r); y0 = Math.min(y0, sy - b.r); y1 = Math.max(y1, sy + b.r);
  }
  if (x0 > x1) { x0 = x1 = y0 = y1 = 0; }
  const ax = Math.ceil(-x0 * sl) + 2, ay = Math.ceil(-y0 * sl) + 2;
  const w = ax + Math.ceil(x1 * sl) + 2, h = ay + Math.ceil(y1 * sl) + 2;
  const W = w * SS, H = h * SS;
  const col = new Uint8ClampedArray(W * H * 4), zb = new Float32Array(W * H).fill(-1e30);
  const EW = SS * 0.95;
  let fi = 0, bi = 0;
  const job = { out: null, done: false };
  job.step = (ms = 1e9) => {
    if (job.done) return true;
    const t0 = performance.now();
    while (fi < M.faces.length) { rasterFace(M.faces[fi++], R, ax * SS, ay * SS, W, H, col, zb, EW); if (performance.now() - t0 > ms) return false; }
    while (bi < M.balls.length) { rasterBall(M.balls[bi++], R, ax * SS, ay * SS, W, H, col, zb, EW); if (performance.now() - t0 > ms) return false; }
    const big = makeCanvas(W, H);
    big.getContext('2d').putImageData(new window.ImageData(col, W, H), 0, 0);
    const cv = shrink(big, SS);
    const ext = outline(cv);
    job.out = { cv, ax, ay, w: cv.width, h: cv.height, top: ext.top, bot: ext.bot, sh: M.shadows.length ? bakeShadow(M.shadows, sl) : null, glows: M.glows, sl };
    job.done = true;
    return true;
  };
  return job;
}
export function bake(M, sl, SS = 2) { const j = bakeJob(M, sl, SS); j.step(); return j.out; }

// 바닥 그림자: 도트 중심이 다각형 안이면 검게(가장자리 딱 끊김)
function bakeShadow(list, sl) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const s of list) for (const [x, y] of s.pts) {
    const sx = (x - y) * 32, sy = (x + y) * 16;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  const ax = Math.ceil(-x0 * sl) + 1, ay = Math.ceil(-y0 * sl) + 1, w = ax + Math.ceil(x1 * sl) + 1, h = ay + Math.ceil(y1 * sl) + 1;
  const cv = makeCanvas(w, h), g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const sx = (px + 0.5 - ax) / sl, sy = (py + 0.5 - ay) / sl;
    const x = sx / 64 + sy / 32, y = sy / 32 - sx / 64;
    let a = 0;
    for (const s of list) if (inPoly(x, y, s.pts)) a = Math.max(a, s.a);
    if (a) d[(py * w + px) * 4 + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  return { cv, ax, ay };
}
function inPoly(x, y, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  }
  return c;
}

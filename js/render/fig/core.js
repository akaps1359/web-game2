// 인물 그리기 공용 도구: 아이소메트릭 투영, 빛(왼쪽 위 주광 + 오른쪽 뒤 테두리광), 색 단계, 음영을 입힌 기본 도형
import { grade, cylTile, ballTile, TS, BS } from './tex.js';
export const PI = Math.PI, TAU = PI * 2;

// ───────── 투영 ─────────
// 몸 좌표: f = 앞, r = 오른쪽, z = 위. 바닥 40u = 한 칸, 세로 1u = 1px(확대 1)
export const PR = { px: 0, py: 0, s: 1, kfx: 0, krx: 0, kfy: 0, kry: 0, kz: 0, df: 0, dr: 0, cf: 1, sf: 0 };
export function setProj(face, px, py, s) {
  const fx = Math.cos(face), fy = Math.sin(face), rx = -fy, ry = fx;
  PR.kfx = (fx - fy) * 0.8 * s; PR.krx = (rx - ry) * 0.8 * s;
  PR.kfy = (fx + fy) * 0.4 * s; PR.kry = (rx + ry) * 0.4 * s;
  PR.kz = s; PR.px = px; PR.py = py; PR.s = s; PR.df = fx + fy; PR.dr = rx + ry; PR.cf = fx; PR.sf = fy;
}
export const X = (f, r) => PR.px + f * PR.kfx + r * PR.krx;
export const Y = (f, r, z) => PR.py + f * PR.kfy + r * PR.kry - z * PR.kz;
// 카메라 쪽으로 얼마나 가까운가(클수록 앞)
export const D = (f, r) => f * PR.df + r * PR.dr;
export const XJ = (j) => PR.px + j.f * PR.kfx + j.r * PR.krx;
export const YJ = (j) => PR.py + j.f * PR.kfy + j.r * PR.kry - j.z * PR.kz;
export const DJ = (j) => j.f * PR.df + j.r * PR.dr;

// 몸 좌표의 방향 → 화면 좌표의 법선(x 오른쪽, y 아래, z 보는 사람 쪽)
export const NRM = { x: 0, y: 0, z: 0 };
export function camNormal(nf, nr, nz) {
  const wx = nf * PR.cf - nr * PR.sf, wy = nf * PR.sf + nr * PR.cf;
  NRM.x = (wx - wy) * 0.7071; NRM.y = 0.3536 * (wx + wy) - 0.866 * nz; NRM.z = 0.6124 * (wx + wy) + 0.5 * nz;
  return NRM;
}

// ───────── 빛 ─────────
export const LX = -0.42, LY = -0.62, LZ = 0.66; // 빛이 오는 쪽(화면 공간)
const HL = Math.hypot(LX, LY, LZ + 1); const HX = LX / HL, HY = LY / HL, HZ = (LZ + 1) / HL; // 반사광 중간 벡터
const RX = 0.78, RY = -0.36; // 테두리광(오른쪽 위 뒤)
export const AMB = 0.3, DIF = 0.95, RIM = 0.1;
// 재질: 반사 세기·날카로움, 질감 종류와 세기(tex), 질감이 반사를 흔드는 정도(stex)
export const MAT = {
  skin: { ks: 0.05, sh: 10, kind: 'skin', tex: 0.24 }, cloth: { ks: 0, sh: 1, kind: 'cloth', tex: 0.34 }, leather: { ks: 0.08, sh: 9, kind: 'leather', tex: 0.4 },
  metal: { ks: 0.55, sh: 20, kind: 'metal', tex: 0.24, stex: 0.35, dk: 0.72 }, bone: { ks: 0.05, sh: 8, kind: 'bone', tex: 0.42 }, wood: { ks: 0.03, sh: 6, kind: 'wood', tex: 0.42 },
  gem: { ks: 1.0, sh: 30, kind: 'gem', tex: 0 }, scale: { ks: 0.32, sh: 14, kind: 'scale', tex: 0.45, stex: 0.6, dk: 0.8 }, chitin: { ks: 0.4, sh: 18, kind: 'chitin', tex: 0.3 },
  fur: { ks: 0, sh: 1, kind: 'fur', tex: 0.5 }, gold: { ks: 0.6, sh: 18, kind: 'gold', tex: 0.22, dk: 0.8 }, hide: { ks: 0.07, sh: 9, kind: 'hide', tex: 0.36 },
};
let FL = 1; // 맞았을 때 번쩍임 배율
export function setFlash(on) { FL = on ? 1.9 : 1; }
// 법선 하나의 밝기와 반사
export function lit(nx, ny, nz, m) {
  const nl = nx * LX + ny * LY + nz * LZ;
  let k = AMB + DIF * (nl > 0 ? nl : 0);
  const nr = nx * RX + ny * RY;
  if (nr > 0) k += RIM * nr * (1 - nz) * (1 - nz);
  LIT.k = k * FL;
  LIT.s = 0;
  if (m && m.ks) { const nh = nx * HX + ny * HY + nz * HZ; if (nh > 0) LIT.s = m.ks * Math.pow(nh, m.sh); }
  return LIT;
}
const LIT = { k: 1, s: 0 };

// ───────── 색 ─────────
const CC = new Map();
function parse(c) {
  if (c[0] === '#') {
    if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16)];
    const n = parseInt(c.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/[\d.]+/g);
  return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
}
// 밝기 k(0~4)와 반사 sp(0~1.5)를 입힌 색(문자열, 캐시)
export function tone(c, k, sp = 0) {
  let e = CC.get(c);
  if (!e) { e = { v: grade(parse(c)), m: new Map() }; CC.set(c, e); if (CC.size > 600) CC.clear(); }
  const kq = Math.max(0, Math.min(160, Math.round(k * 40))), sq = Math.max(0, Math.min(15, Math.round(sp * 10)));
  const key = kq * 16 + sq;
  let s = e.m.get(key);
  if (!s) {
    const v = e.v, kk = kq / 40, ss = sq / 10 * 255;
    s = `rgb(${Math.min(255, v[0] * kk + ss) | 0},${Math.min(255, v[1] * kk + ss) | 0},${Math.min(255, v[2] * kk + ss) | 0})`;
    e.m.set(key, s);
  }
  return s;
}
export function rgbOf(c) { let e = CC.get(c); if (!e) { tone(c, 1); e = CC.get(c); } return e.v; }
export function mixHex(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + h(A[0] + (B[0] - A[0]) * t) + h(A[1] + (B[1] - A[1]) * t) + h(A[2] + (B[2] - A[2]) * t);
}

// ───────── 음영 타일 ─────────
// 음영과 재질 질감을 굳힌 작은 타일(색·재질·방향별)을 무늬로 깔아 칠한다. 경로는 화면 좌표로 만들고,
// 채우기 직전에만 좌표 변환을 바꿔 타일을 그 부위에 맞춘다(캔버스는 채울 때의 변환으로 무늬를 읽는다)
const MATS = Object.values(MAT);
// 맨살 재질: 괴물은 주름진 가죽, 바위 몸은 껍질
export function skinMat(look) { return look.rock ? MAT.chitin : look.hide ? MAT.hide : MAT.skin; }
const TC = new Map(); // 열쇠 → { cv, pat, ctx }
const TMAX = 2400;
const AQ = 24; // 방향 나눔
function tileFor(g, key, make, rep) {
  let e = TC.get(key);
  if (e) { TC.delete(key); TC.set(key, e); }
  else {
    e = { cv: make(), pat: null, ctx: null };
    TC.set(key, e);
    if (TC.size > TMAX) { let n = TMAX >> 3; for (const k of TC.keys()) { TC.delete(k); if (--n <= 0) break; } }
  }
  if (e.ctx !== g) { e.pat = g.createPattern(e.cv, rep); e.ctx = g; }
  return e.pat;
}
// 액터를 그리기 전에 캔버스의 지금 변환을 기억해 둔다
const T0 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
export function beginFig(g) {
  const m = g.getTransform();
  T0.a = m.a; T0.b = m.b; T0.c = m.c; T0.d = m.d; T0.e = m.e; T0.f = m.f;
}
function withLocal(g, a, b, c, d, e, f) {
  g.setTransform(T0.a * a + T0.c * b, T0.b * a + T0.d * b, T0.a * c + T0.c * d, T0.b * c + T0.d * d, T0.a * e + T0.c * f + T0.e, T0.b * e + T0.d * f + T0.f);
}
function resetT(g) { g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f); }
// 지금 경로를 원기둥 음영으로 채운다: (mx,my) 중심, (px,py) 축에 수직인 단위 벡터, R 반지름
export function fillCyl(g, mx, my, px, py, R, c, m) {
  m = m || MAT.cloth;
  let an = Math.atan2(py, px); if (an < 0) an += TAU;
  const ai = Math.round((an / TAU) * AQ) % AQ, fl = FL > 1 ? 1 : 0;
  const pat = tileFor(g, c + '|' + MATS.indexOf(m) + '|' + ai + '|' + fl, () => cylTile(rgbOf(c), m, (ai / AQ) * TAU, FL), 'repeat');
  // 타일 가로(0~TS) → 수직 방향 -1.1R ~ +1.1R, 세로 → 축 방향(한 칸 0.5u)
  const k = (R * 2.2) / TS, vs = 0.5 * PR.s;
  withLocal(g, px * k, py * k, py * vs, -px * vs, mx - px * R * 1.1, my - py * R * 1.1);
  g.fillStyle = pat; g.fill();
  resetT(g);
}
export function fillBall(g, cx, cy, R, c, m, k0 = 1) {
  m = m || MAT.skin;
  const kq = Math.round(k0 * 20), fl = FL > 1 ? 1 : 0;
  const pat = tileFor(g, c + '|' + MATS.indexOf(m) + '|b' + kq + '|' + fl, () => ballTile(rgbOf(c), m, FL, kq / 20), 'no-repeat');
  const k = (R * 2.04) / BS;
  withLocal(g, k, 0, 0, k, cx - R * 1.02, cy - R * 1.02);
  g.fillStyle = pat; g.fill();
  resetT(g);
}

// ───────── 기본 도형 ─────────
// 굵기가 변하는 원기둥(팔다리·뼈·꼬리 마디). bulge: 가운데가 불룩한 정도(근육)
export function seg(g, x1, y1, r1, x2, y2, r2, c, m, bulge = 0, bt = 0.42, bulgeB = bulge) {
  let dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  if (L < 0.02) { dx = 0; dy = 0.02; L = 0.02; }
  const ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const a0 = Math.atan2(py, px);
  g.beginPath();
  g.arc(x1, y1, r1, a0, a0 + PI);
  if (bulge || bulgeB) {
    // 양쪽 옆선의 불룩함을 따로(종아리·이두근처럼 한쪽만 부푼 근육)
    const r0 = r1 + (r2 - r1) * bt, mx = x1 + dx * bt, my = y1 + dy * bt;
    const ra = r0 * (1 + bulge), rb = r0 * (1 + bulgeB);
    const ax = x1 - px * r1, ay = y1 - py * r1, bx = x2 - px * r2, by = y2 - py * r2;
    g.quadraticCurveTo(2 * (mx - px * ra) - (ax + bx) / 2, 2 * (my - py * ra) - (ay + by) / 2, bx, by);
    g.arc(x2, y2, r2, a0 + PI, a0 + TAU);
    const ax2 = x1 + px * r1, ay2 = y1 + py * r1, bx2 = x2 + px * r2, by2 = y2 + py * r2;
    g.quadraticCurveTo(2 * (mx + px * rb) - (ax2 + bx2) / 2, 2 * (my + py * rb) - (ay2 + by2) / 2, ax2, ay2);
  } else g.arc(x2, y2, r2, a0 + PI, a0 + TAU);
  g.closePath();
  fillCyl(g, x1 + dx * 0.45, y1 + dy * 0.45, px, py, Math.max(r1, r2) * (1 + Math.max(bulge, bulgeB)), c, m);
}
// 관절 두 개 사이의 원기둥(몸 좌표 반지름 → 화면). dir(몸 좌표 방향)으로 damt만큼 한쪽을 더 불룩하게
export function segJ(g, A, B, ra, rb, c, m, bulge = 0, bt = 0.42, dir = null, damt = 0) {
  const s = PR.s, x1 = XJ(A), y1 = YJ(A), x2 = XJ(B), y2 = YJ(B);
  let bA = bulge, bB = bulge;
  if (dir && damt) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
    const sx = dir.f * PR.kfx + dir.r * PR.krx, sy = dir.f * PR.kfy + dir.r * PR.kry - dir.z * PR.kz;
    const d = Math.max(-1, Math.min(1, (sx * px + sy * py) / s));
    if (d > 0) bB += damt * d; else bA -= damt * d;
  }
  seg(g, x1, y1, ra * s, x2, y2, rb * s, c, m, bA, bt, bB);
}
// 공(타원)
// 털·머리카락: 투영 타원 둘레를 들쭉날쭉하게(끝이 삐죽한 덩어리). amp 털끝 길이(반지름 비), down 아래로 처지는 정도
export function shaggy(g, E, n, amp, c, m, down = 0, k0 = 1) {
  const cr = Math.cos(E.rot), sr = Math.sin(E.rot), ex = E.x, ey = E.y, rx = E.rx, ry = E.ry;
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const an = (k / n) * TAU, tip = k % 2 ? 1 : 1 + amp * (0.7 + 0.3 * ((k * 5) % 3));
    const x = Math.cos(an) * rx * tip, y = Math.sin(an) * ry * tip;
    const px = ex + x * cr - y * sr, py0 = ey + x * sr + y * cr;
    const py = py0 + (k % 2 ? 0 : Math.max(0, py0 - ey) * down);
    if (k) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
  fillBall(g, ex, ey, Math.max(rx, ry) * (1 + amp), c, m, k0);
}
export function ball(g, cx, cy, rx, ry, c, m, rot = 0, k0 = 1) {
  g.beginPath(); g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  fillBall(g, cx, cy, Math.max(rx, ry), c, m, k0);
}
// 평평한 면 하나의 밝기(몸 좌표 법선)
export function faceTone(c, nf, nr, nz, m, k0 = 1) {
  const n = camNormal(nf, nr, nz);
  const L = lit(n.x, n.y, Math.max(0, n.z), m);
  return tone(c, L.k * k0, L.s);
}
// 다각형 채우기(화면 좌표 배열)
export function poly(g, pts, fill) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath(); g.fillStyle = fill; g.fill();
}
// 몸 좌표 점들의 다각형
const PB = [];
export function poly3(g, pts3, fill) {
  PB.length = 0;
  for (const p of pts3) PB.push(X(p[0], p[1]), Y(p[0], p[1], p[2]));
  poly(g, PB, fill);
}
// 빛나는 점(눈·보석)
export function glowDot(g, x, y, r, col, a = 0.55) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
  gr.addColorStop(0, col); gr.addColorStop(0.3, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  const al = g.globalAlpha;
  g.globalAlpha = al * a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3.2, 0, TAU); g.fill();
  g.globalAlpha = al; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

// ───────── 고리(몸통 단면) ─────────
// 단면 고리를 화면 점으로: 중심 c(몸 좌표), 기준 축 F·R(단위 벡터, 몸 좌표), 반폭 w(R 방향)·반두께 d(F 방향), 앞쪽 불룩함 bf
export const RING_N = 14;
const RCOS = [], RSIN = [];
for (let i = 0; i < RING_N; i++) { RCOS.push(Math.cos((i / RING_N) * TAU)); RSIN.push(Math.sin((i / RING_N) * TAU)); }
export function makeRing() { return { x: new Float64Array(RING_N), y: new Float64Array(RING_N), d: new Float64Array(RING_N), cx: 0, cy: 0, cd: 0 }; }
export function ring(out, c, F, R, w, d, bf = 1, back = 1) {
  for (let i = 0; i < RING_N; i++) {
    const co = RCOS[i], dd = d * (co > 0 ? bf : back);
    const a = co * dd, b = RSIN[i] * w;
    const f = c.f + F.f * a + R.f * b, r = c.r + F.r * a + R.r * b, z = c.z + F.z * a + R.z * b;
    out.x[i] = X(f, r); out.y[i] = Y(f, r, z); out.d[i] = D(f, r);
  }
  out.cx = X(c.f, c.r); out.cy = Y(c.f, c.r, c.z); out.cd = D(c.f, c.r);
  return out;
}
// 고리의 보이는(카메라 쪽) 반 바퀴를 선으로
export function ringFront(g, rg, lw, col, alpha = 1) {
  // 가장 앞에 있는 점에서 양쪽으로, 중심보다 앞인 점들만
  let best = 0;
  for (let i = 1; i < RING_N; i++) if (rg.d[i] > rg.d[best]) best = i;
  g.beginPath();
  let a = best, n = 0;
  while (n < RING_N / 2 && rg.d[(a - 1 + RING_N) % RING_N] > rg.cd - 0.01) { a = (a - 1 + RING_N) % RING_N; n++; }
  g.moveTo(rg.x[a], rg.y[a]);
  for (let k = 1; k <= RING_N; k++) {
    const i = (a + k) % RING_N;
    g.lineTo(rg.x[i], rg.y[i]);
    if (rg.d[(i + 1) % RING_N] < rg.cd - 0.01) break;
  }
  const al = g.globalAlpha;
  g.globalAlpha = al * alpha; g.lineWidth = lw; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.globalAlpha = al;
}
// 고리 여럿(아래→위)을 이어 붙인 몸통 윤곽 경로. 아래는 아래쪽 반원, 위는 위쪽 반원으로 닫는다
const LIX = new Int32Array(16), RIX = new Int32Array(16);
export function loftPath(g, rings, n, topOpen = false, jag = 0) {
  const b = rings[0], t = rings[n - 1];
  let sx = t.cx - b.cx, sy = t.cy - b.cy;
  const sl = Math.hypot(sx, sy) || 1; sx /= sl; sy /= sl;
  const qx = -sy, qy = sx; // 화면에서 등줄기에 수직(오른쪽)
  for (let k = 0; k < n; k++) {
    const rg = rings[k];
    let mn = 1e9, mx = -1e9, il = 0, ir = 0;
    for (let i = 0; i < RING_N; i++) { const v = rg.x[i] * qx + rg.y[i] * qy; if (v < mn) { mn = v; il = i; } if (v > mx) { mx = v; ir = i; } }
    LIX[k] = il; RIX[k] = ir;
  }
  g.beginPath();
  // 첫 고리: 왼쪽 끝 → (등줄기 반대쪽 반원) → 오른쪽 끝(jag면 해진 옷단처럼 들쭉날쭉)
  arcBetween(g, b, LIX[0], RIX[0], -1, true, sx, sy, jag);
  // 오른쪽 옆선(위로)
  for (let k = 1; k < n; k++) {
    const rg = rings[k], p = rings[k - 1], i = RIX[k], j = RIX[k - 1];
    const mx = (rg.x[i] + p.x[j]) / 2, my = (rg.y[i] + p.y[j]) / 2;
    if (k === 1) g.lineTo(mx, my); else g.quadraticCurveTo(p.x[j], p.y[j], mx, my);
  }
  g.lineTo(t.x[RIX[n - 1]], t.y[RIX[n - 1]]);
  // 위 고리: 오른쪽 끝 → (위쪽 반원) → 왼쪽 끝
  if (!topOpen) arcBetween(g, t, RIX[n - 1], LIX[n - 1], 1, false, sx, sy);
  else g.lineTo(t.x[LIX[n - 1]], t.y[LIX[n - 1]]);
  for (let k = n - 2; k >= 0; k--) {
    const rg = rings[k], p = rings[k + 1], i = LIX[k], j = LIX[k + 1];
    const mx = (rg.x[i] + p.x[j]) / 2, my = (rg.y[i] + p.y[j]) / 2;
    if (k === n - 2) g.lineTo(mx, my); else g.quadraticCurveTo(p.x[j], p.y[j], mx, my);
  }
  g.closePath();
  return { qx, qy };
}
// 고리 위 두 점 사이를 잇는 두 반원 중, 등줄기 방향(sx,sy)으로 바깥(dir=+1 앞쪽, -1 뒤쪽)에 있는 쪽으로
function arcBetween(g, rg, i0, i1, dir, move, sx, sy, jag = 0) {
  let pa = 0, na = 0, pb = 0, nb = 0;
  for (let i = i0; i !== i1; i = (i + 1) % RING_N) { pa += rg.x[i] * sx + rg.y[i] * sy; na++; }
  for (let i = i0; i !== i1; i = (i - 1 + RING_N) % RING_N) { pb += rg.x[i] * sx + rg.y[i] * sy; nb++; }
  const A = pa / Math.max(1, na), B = pb / Math.max(1, nb);
  const useA = dir > 0 ? A >= B : A <= B;
  const step = useA ? 1 : -1;
  if (move) g.moveTo(rg.x[i0], rg.y[i0]); else g.lineTo(rg.x[i0], rg.y[i0]);
  let px = rg.x[i0], py = rg.y[i0], k = 0;
  for (let i = (i0 + step + RING_N) % RING_N, guard = 0; guard < RING_N; i = (i + step + RING_N) % RING_N, guard++) {
    if (jag) {
      // 두 점 사이에 뾰족한 자락 하나씩
      const mx = (px + rg.x[i]) / 2, my = (py + rg.y[i]) / 2, a = jag * (0.6 + ((k * 7) % 5) * 0.2);
      g.lineTo(mx - sx * a, my - sy * a);
      k++;
    }
    g.lineTo(rg.x[i], rg.y[i]);
    px = rg.x[i]; py = rg.y[i];
    if (i === i1) break;
  }
}

// ───────── 2관절 역운동학 ─────────
// A(뿌리)에서 T(목표)로, 길이 l1·l2, pole 쪽으로 굽힌다. mid에 가운데 관절, end에 실제 끝(닿지 않으면 줄어든다)
export function ik(mid, end, A, T, l1, l2, pf, pr, pz) {
  let dx = T.f - A.f, dy = T.r - A.r, dz = T.z - A.z;
  let d = Math.hypot(dx, dy, dz);
  const mx = (l1 + l2) * 0.999, mn = Math.abs(l1 - l2) + 0.05;
  if (d < 1e-4) { dx = 0; dy = 0; dz = -1; d = 1e-4; }
  const ux = dx / d, uy = dy / d, uz = dz / d;
  if (d > mx) d = mx; else if (d < mn) d = mn;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pd = pf * ux + pr * uy + pz * uz;
  let qf = pf - pd * ux, qr = pr - pd * uy, qz = pz - pd * uz;
  const ql = Math.hypot(qf, qr, qz);
  if (ql < 1e-5) { qf = 0; qr = 0; qz = 1; } else { qf /= ql; qr /= ql; qz /= ql; }
  mid.f = A.f + ux * a + qf * h; mid.r = A.r + uy * a + qr * h; mid.z = A.z + uz * a + qz * h;
  end.f = A.f + ux * d; end.r = A.r + uy * d; end.z = A.z + uz * d;
}

// ───────── 작은 수학 ─────────
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (x) => x * x * (3 - 2 * x);
export const seg01 = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
export class V3 { constructor(f = 0, r = 0, z = 0) { this.f = f; this.r = r; this.z = z; } set(f, r, z) { this.f = f; this.r = r; this.z = z; return this; } copy(o) { this.f = o.f; this.r = o.r; this.z = o.z; return this; } }
// 기준 축 묶음(회전한 몸통·머리·골반의 앞·오른쪽·위)
export class Frame {
  constructor() { this.F = new V3(1, 0, 0); this.R = new V3(0, 1, 0); this.U = new V3(0, 0, 1); }
  // yaw(위에서 보아 오른쪽으로 돌기), pitch(앞으로 숙이기), roll(오른쪽으로 기울기)
  set(yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    // 돌기
    let Ff = cy, Fr = sy, Fz = 0, Rf = -sy, Rr = cy, Rz = 0, Uf = 0, Ur = 0, Uz = 1;
    // 숙이기(R 축 둘레): 위가 앞으로
    const Uf2 = Uf * cp + Ff * sp, Ur2 = Ur * cp + Fr * sp, Uz2 = Uz * cp + Fz * sp;
    const Ff2 = Ff * cp - Uf * sp, Fr2 = Fr * cp - Ur * sp, Fz2 = Fz * cp - Uz * sp;
    Uf = Uf2; Ur = Ur2; Uz = Uz2; Ff = Ff2; Fr = Fr2; Fz = Fz2;
    // 기울기(F 축 둘레): 위가 오른쪽으로
    const Uf3 = Uf * cr + Rf * sr, Ur3 = Ur * cr + Rr * sr, Uz3 = Uz * cr + Rz * sr;
    const Rf3 = Rf * cr - Uf * sr, Rr3 = Rr * cr - Ur * sr, Rz3 = Rz * cr - Uz * sr;
    this.F.set(Ff, Fr, Fz); this.R.set(Rf3, Rr3, Rz3); this.U.set(Uf3, Ur3, Uz3);
    return this;
  }
  // 이 축으로 표현한 점(a 앞, b 오른쪽, c 위)을 o에 더해 out에
  at(out, o, a, b, c) {
    out.f = o.f + this.F.f * a + this.R.f * b + this.U.f * c;
    out.r = o.r + this.F.r * a + this.R.r * b + this.U.r * c;
    out.z = o.z + this.F.z * a + this.R.z * b + this.U.z * c;
    return out;
  }
}

// ───────── 타원체 ─────────
// 중심 c(몸 좌표), 축 F·R·U(단위 벡터)와 반지름 a·b·cc를 화면 타원으로(정사영이라 정확하다)
export const ELL = { x: 0, y: 0, rx: 0, ry: 0, rot: 0 };
export function projEllipse(c, F, R, U, a, b, cc) {
  const vx = (v) => (v.f * PR.kfx + v.r * PR.krx), vy = (v) => (v.f * PR.kfy + v.r * PR.kry - v.z * PR.kz);
  const Ax = vx(F) * a, Ay = vy(F) * a, Bx = vx(R) * b, By = vy(R) * b, Cx = vx(U) * cc, Cy = vy(U) * cc;
  const m11 = Ax * Ax + Bx * Bx + Cx * Cx, m12 = Ax * Ay + Bx * By + Cx * Cy, m22 = Ay * Ay + By * By + Cy * Cy;
  const tr = (m11 + m22) / 2, det = m11 * m22 - m12 * m12, q = Math.sqrt(Math.max(0, tr * tr - det));
  ELL.x = X(c.f, c.r); ELL.y = Y(c.f, c.r, c.z);
  ELL.rx = Math.sqrt(Math.max(0.01, tr + q)); ELL.ry = Math.sqrt(Math.max(0.01, tr - q));
  ELL.rot = 0.5 * Math.atan2(2 * m12, m11 - m22);
  return ELL;
}
export function ellipsoid(g, c, F, R, U, a, b, cc, col, m, k0 = 1) {
  const E = projEllipse(c, F, R, U, a, b, cc);
  ball(g, E.x, E.y, E.rx, E.ry, col, m, E.rot, k0);
  return E;
}
// 타원체 표면의 점(방위 az: 0 = 앞, +는 오른쪽 / 고도 el: + 위)과 그 점이 보이는가
export const SP = new V3();
export function surf(c, F, R, U, a, b, cc, az, el) {
  const ce = Math.cos(el), x = ce * Math.cos(az), y = ce * Math.sin(az), z = Math.sin(el);
  SP.f = c.f + F.f * a * x + R.f * b * y + U.f * cc * z;
  SP.r = c.r + F.r * a * x + R.r * b * y + U.r * cc * z;
  SP.z = c.z + F.z * a * x + R.z * b * y + U.z * cc * z;
  // 법선(타원체라 축 길이로 나눈다)
  const nf = F.f * x / a + R.f * y / b + U.f * z / cc, nr = F.r * x / a + R.r * y / b + U.r * z / cc, nz = F.z * x / a + R.z * y / b + U.z * z / cc;
  SP.vis = camNormal(nf, nr, nz).z;
  return SP;
}

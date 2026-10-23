// 재질 질감과 음영 타일: 천의 결·가죽 얼룩과 갈라짐·금속의 긁힘과 녹·피부 얼룩·털 결·뼈의 금·나뭇결·사슬 고리를
// 32칸 반복 무늬로 만들어 두고, 원기둥·공의 음영 타일에 섞어 굳힌다(때 묻은 무광 질감, 따뜻한 주광과 푸르스름한 그늘)
import { hash2 } from '../noise.js';

export const TS = 32;
const N = TS * TS;
const wrap = (x) => ((x % TS) + TS) % TS;

// 축마다 주기가 다른 값 잡음(px칸·py칸이 한 바퀴)
function vn2(u, v, px, py, seed) {
  const x = u * px, y = v * py;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (i, j) => hash2(((i % px) + px) % px, ((j % py) + py) % py, seed);
  const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm2(u, v, px, py, seed, oct) {
  let s = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) { s += amp * vn2(u, v, px << o, py << o, seed + o * 31); tot += amp; amp *= 0.5; }
  return s / tot;
}
// 무늬 위에 선(갈라짐·긁힘)을 그어 넣는다
function line(a, x0, y0, ang, len, val, w = 1) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let t = 0; t < len; t += 0.5) {
    const x = Math.round(x0 + dx * t), y = Math.round(y0 + dy * t);
    for (let k = 0; k < w; k++) { const i = wrap(y + k) * TS + wrap(x); a[i] = Math.max(-1, Math.min(1, a[i] + val)); }
  }
}
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// 재질별 무늬(-1 어둡게 ~ +1 밝게)
function makeDetail(kind) {
  const a = new Float32Array(N), R = rnd(kind.length * 977 + 13);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const u = x / TS, v = y / TS, i = y * TS + x;
    const dirt = Math.min(0, fbm2(u, v, 2, 2, 91, 2) * 2 - 1.1) * 1.2; // 군데군데 때
    switch (kind) {
      case 'cloth': a[i] = (fbm2(u, v, 8, 8, 11, 3) * 2 - 1) * 0.45 + (((x >> 0) + (y >> 0)) % 2 ? 0.16 : -0.16) + ((y % 4) === 0 ? -0.12 : 0) + dirt; break;
      case 'leather': a[i] = (fbm2(u, v, 4, 4, 23, 4) * 2 - 1) * 0.75 + dirt; break;
      case 'metal': a[i] = (fbm2(u, v, 2, 16, 37, 2) * 2 - 1) * 0.25 + dirt * 0.8; break;
      case 'gold': a[i] = (fbm2(u, v, 4, 4, 41, 2) * 2 - 1) * 0.2 + dirt * 0.5; break;
      case 'skin': a[i] = (fbm2(u, v, 4, 4, 53, 3) * 2 - 1) * 0.42 + dirt * 0.7; break;
      case 'fur': {
        // 털: 짧은 가닥(세로로 조금 긴 잡음)이 뭉친 다발, 다발 사이는 어둡게
        const strand = fbm2(u, v, 16, 6, 67, 2) * 2 - 1, clump = fbm2(u, v, 4, 3, 73, 2) * 2 - 1;
        a[i] = strand * 0.7 + clump * 0.45 + dirt * 0.5;
        break;
      }
      case 'bone': a[i] = (fbm2(u, v, 6, 6, 71, 3) * 2 - 1) * 0.5 + dirt; break;
      case 'wood': { const g = Math.sin((u * 6 + fbm2(u, v, 2, 8, 83, 3) * 1.6) * Math.PI * 2); a[i] = g * 0.45 + (fbm2(u, v, 8, 2, 89, 2) * 2 - 1) * 0.3 + dirt * 0.6; break; }
      case 'scale': {
        // 사슬 고리: 4칸마다 작은 고리, 줄마다 반 칸 어긋나게
        const row = (y >> 2), cx = ((x + (row % 2) * 2) % 4) - 1.5, cy = (y % 4) - 1.5, r = Math.hypot(cx, cy);
        a[i] = (Math.abs(r - 1.25) < 0.55 ? 0.55 : -0.7) * (cy < 0 ? 1 : 0.7) + dirt * 0.6;
        break;
      }
      case 'chitin': a[i] = (fbm2(u, v, 4, 4, 97, 3) * 2 - 1) * 0.35 + dirt * 0.5; break;
      case 'hide': {
        // 괴물 가죽: 능선 잡음으로 굵은 주름(어두운 골), 사이사이 얼룩
        const r = 1 - Math.abs(fbm2(u, v, 4, 6, 101, 3) * 2 - 1);
        a[i] = -(r * r * 2 - 0.6) * 0.7 + (fbm2(u, v, 8, 8, 107, 2) * 2 - 1) * 0.3 + dirt;
        break;
      }
      default: a[i] = 0;
    }
  }
  // 갈라짐·긁힘
  if (kind === 'leather') for (let k = 0; k < 6; k++) line(a, R() * TS, R() * TS, R() * 6.28, 3 + R() * 6, -0.9);
  if (kind === 'bone') for (let k = 0; k < 5; k++) line(a, R() * TS, R() * TS, R() * 6.28, 4 + R() * 9, -1.1);
  if (kind === 'metal') {
    for (let k = 0; k < 14; k++) line(a, R() * TS, R() * TS, (R() - 0.5) * 1.2 + (R() < 0.5 ? 0 : 1.57), 3 + R() * 10, R() < 0.7 ? 0.7 : -0.8);
    for (let k = 0; k < 18; k++) { const i = wrap(Math.round(R() * TS)) * TS + wrap(Math.round(R() * TS)); a[i] = -1; }
  }
  if (kind === 'chitin' || kind === 'hide') for (let k = 0; k < 10; k++) { const i = wrap(Math.round(R() * TS)) * TS + wrap(Math.round(R() * TS)); a[i] = -0.9; }
  return a;
}
const DET = {};
export function detail(kind) { return DET[kind] || (DET[kind] = makeDetail(kind)); }

// ───────── 빛(타일용) ─────────
// 따뜻한 주광과 푸르스름한 주변광. 가장자리(시선과 비스듬한 면)는 어둡게
const LX = -0.42, LY = -0.62, LZ = 0.66;
const HL = Math.hypot(LX, LY, LZ + 1), HX = LX / HL, HY = LY / HL, HZ = (LZ + 1) / HL;
const KR = 1.0, KG = 0.9, KB = 0.76, AR = 0.5, AG = 0.56, AB = 0.72;
export const AMB_T = 0.3, DIF_T = 1.06;
// 색 보정: 채도를 낮추고 조금 어둡게(때 묻은 판타지 색)
export function grade(rgb) {
  const l = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11, k = 0.72;
  return [(l + (rgb[0] - l) * k) * 0.94, (l + (rgb[1] - l) * k) * 0.94, (l + (rgb[2] - l) * k) * 0.94];
}
function shadePx(out, o, base, nx, ny, nz, m, d, fl) {
  const nl = nx * LX + ny * LY + nz * LZ, dif = nl > 0 ? nl : 0;
  const ao = 0.5 + 0.5 * Math.max(0, nz);
  const tex = 1 + d * (m.tex || 0);
  let sp = 0;
  if (m.ks) { const nh = nx * HX + ny * HY + nz * HZ; if (nh > 0) sp = m.ks * Math.pow(nh, m.sh) * Math.max(0, 1 + d * (m.stex ?? 0.6)) * 255 * ao; }
  const df = DIF_T * dif * (m.dk || 1);
  // 피부는 그늘에서도 핏기가 돌게(붉은 기를 조금 더, 푸른 기를 덜)
  const wr = m.kind === 'skin' ? 1.05 : 1, wb = m.kind === 'skin' ? 0.92 : 1;
  const kr = (AMB_T * AR * wr + df * KR) * ao * tex * fl * wr, kg = (AMB_T * AG + df * KG) * ao * tex * fl, kb = (AMB_T * AB * wb + df * KB) * ao * tex * fl * wb;
  out[o] = Math.min(255, base[0] * kr + sp); out[o + 1] = Math.min(255, base[1] * kg + sp * 0.95); out[o + 2] = Math.min(255, base[2] * kb + sp * 0.88); out[o + 3] = 255;
}

// ───────── 타일 만들기 ─────────
const CYL_W = 1.1; // 타일 가로는 반지름의 1.1배까지(가장자리 넘침 방지)
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// 원기둥 타일: 가로 = 축에 수직(-1.1R ~ +1.1R), 세로 = 축 방향(반복). ang: 수직 방향의 화면 각도
export function cylTile(rgb, m, ang, fl) {
  const cv = canvas(TS, TS), x = cv.getContext('2d'), img = x.createImageData(TS, TS), px = Math.cos(ang), py = Math.sin(ang);
  const det = detail(m.kind), out = img.data;
  for (let i = 0; i < TS; i++) {
    let t = ((i + 0.5) / (TS / 2) - 1) * CYL_W;
    if (t > 0.999) t = 0.999; if (t < -0.999) t = -0.999;
    const nz = Math.sqrt(1 - t * t), u = Math.floor((Math.asin(t) / Math.PI + 0.5) * TS) % TS;
    for (let j = 0; j < TS; j++) shadePx(out, (j * TS + i) * 4, rgb, t * px, t * py, nz, m, det[j * TS + u], fl);
  }
  x.putImageData(img, 0, 0);
  return cv;
}
// 공 타일(48칸, 반복 없음): 빛 쪽으로 밝고 둘레는 어둡게
export const BS = 48;
export function ballTile(rgb, m, fl, k0) {
  const cv = canvas(BS, BS), x = cv.getContext('2d'), img = x.createImageData(BS, BS), out = img.data;
  const det = detail(m.kind), h = BS / 2;
  for (let j = 0; j < BS; j++) for (let i = 0; i < BS; i++) {
    let X = (i + 0.5) / h - 1, Y = (j + 0.5) / h - 1;
    const r = Math.hypot(X, Y);
    if (r > 0.995) { X *= 0.995 / r; Y *= 0.995 / r; }
    const nz = Math.sqrt(Math.max(0, 1 - X * X - Y * Y));
    const u = Math.floor((Math.atan2(X, nz) / Math.PI + 0.5) * TS) % TS, v = Math.floor((Math.asin(Math.max(-1, Math.min(1, Y))) / Math.PI + 0.5) * TS) % TS;
    shadePx(out, (j * BS + i) * 4, rgb, X, Y, nz, m, det[v * TS + u], fl * k0);
  }
  x.putImageData(img, 0, 0);
  return cv;
}

// 바닥 타일·벽 블록을 테마별로 미리 그려 둔다(픽셀 단위 절차 텍스처)
import { fbm, vnoise, hash2, hex, mix, makeCanvas } from './noise.js';
import { TW, TH } from '../core/util.js';
import { shrink } from './pixel.js';

export const WALL_H = 78;

const PAL = {
  crypt: { floor: '#6e665b', floor2: '#5a5249', mortar: '#2c2824', wall: '#7c6c5a', wall2: '#5e5043', mortarW: '#2a231d', top: '#1d1915', pattern: 'slabs' },
  catacombs: { floor: '#5f4a3e', floor2: '#4a372d', mortar: '#241914', wall: '#6e4c3d', wall2: '#553729', mortarW: '#22150f', top: '#1a110d', pattern: 'bricks' },
  caves: { floor: '#6a5038', floor2: '#4f3a28', mortar: '#2e2116', wall: '#5e4936', wall2: '#45331f', mortarW: '#21170e', top: '#1b130c', pattern: 'earth' },
  hell: { floor: '#3c2426', floor2: '#2a1719', mortar: '#140809', wall: '#4a2224', wall2: '#331416', mortarW: '#120607', top: '#0e0506', pattern: 'hell' },
  town: { floor: '#4f5a30', floor2: '#3f4826', mortar: '#2a2416', wall: '#7a6a55', wall2: '#5c4f3e', mortarW: '#2a231d', top: '#1d1915', pattern: 'grass' },
};

const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const SS = 3;

// 마름모 타일 픽셀 → 타일 좌표(u, v ∈ -0.5..0.5)
function diamondPixels(RS, fn) {
  const w = Math.ceil(TW * RS), h = Math.ceil(TH * RS);
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const sx = (px + 0.5) / RS - TW / 2, sy = (py + 0.5) / RS - TH / 2;
    const u = sx / TW + sy / TH, v = sy / TH - sx / TW;
    const e = 0.5 - Math.max(Math.abs(u), Math.abs(v));
    const cov = sat(e * 28.6 * RS + 1.1);
    if (cov <= 0) continue;
    const col = fn(u + 0.5, v + 0.5, e);
    const i = (py * w + px) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255 * cov;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// 선분까지 거리
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? sat(((px - ax) * dx + (py - ay) * dy) / l) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function crackPath(seed) {
  const pts = [[0.15 + hash2(seed, 1, 9) * 0.3, 0.1 + hash2(seed, 2, 9) * 0.3]];
  for (let i = 0; i < 4; i++) {
    const [x, y] = pts[pts.length - 1];
    pts.push([x + 0.1 + hash2(seed, i, 3) * 0.15, y + (hash2(seed, i, 4) - 0.3) * 0.25]);
  }
  return pts;
}
function crackDist(U, V, pts) {
  let m = 9;
  for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segDist(U, V, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return m;
}

// ───────── 바닥 ─────────
export function makeFloor(theme, variant, RS) {
  const P = PAL[theme], base = hex(P.floor), base2 = hex(P.floor2), mort = hex(P.mortar);
  const seed = 101 + variant * 31 + theme.length * 7;
  const crack = variant >= 3 && variant <= 4 ? crackPath(seed) : null;
  return diamondPixels(RS, (U, V, e) => {
    const n = fbm(U, V, 7, 4, 4); // 모든 변형이 공유하는 저주파(이음매 없이)
    const fine = vnoise(U * 32, V * 32, seed, 32);
    let col, k = 1;
    switch (P.pattern) {
      case 'slabs': {
        // 2×2 판석, 판석마다 밝기 다르게
        const cu = Math.floor(U * 2), cv = Math.floor(V * 2);
        const lu = U * 2 - cu, lv = V * 2 - cv;
        const ed = Math.min(lu, 1 - lu, lv, 1 - lv) / 2;
        const sb = 0.82 + hash2(cu + variant * 3, cv, seed) * 0.3;
        col = mix(base2, base, n * 0.8 + 0.2);
        k = sb * (0.85 + fine * 0.25);
        if (ed < 0.018) { col = mort; k = 0.7 + fine * 0.3; } else if (ed < 0.035) k *= 0.82; // 홈과 모서리 그늘
        else if (ed < 0.05) k *= 1.06;
        break;
      }
      case 'bricks': {
        // 엇갈린 벽돌 바닥
        const rows = 4, cols = 2;
        const r = Math.floor(V * rows), off = (r % 2) * 0.5;
        const c = Math.floor(U * cols + off);
        const lu = U * cols + off - c, lv = V * rows - r;
        const ed = Math.min(lu / cols, (1 - lu) / cols, lv / rows, (1 - lv) / rows);
        col = mix(base2, base, n * 0.7 + 0.3 * hash2(c, r, seed));
        k = 0.85 + fine * 0.28;
        if (ed < 0.012) { col = mort; k = 0.8; } else if (ed < 0.025) k *= 0.85;
        break;
      }
      case 'earth': {
        // 울퉁불퉁한 흙바닥, 자갈
        const m = fbm(U, V, seed % 5 + 3, 5, 4);
        col = mix(base2, base, sat(n * 1.4 - 0.2));
        k = 0.75 + m * 0.45 + (fine - 0.5) * 0.12;
        const peb = vnoise(U * 14, V * 14, seed + 5, 14);
        if (peb > 0.82) k *= 1.25; else if (peb < 0.12) k *= 0.7;
        break;
      }
      case 'hell': {
        // 흑요석 판석과 붉은 금
        const cu = Math.floor(U * 2), cv = Math.floor(V * 2);
        const lu = U * 2 - cu, lv = V * 2 - cv;
        const ed = Math.min(lu, 1 - lu, lv, 1 - lv) / 2;
        col = mix(base2, base, n);
        k = 0.8 + hash2(cu + variant, cv, seed) * 0.35 + (fine - 0.5) * 0.2;
        if (ed < 0.02) { col = [120, 24, 10]; k = 0.6 + fine * 0.6; }
        break;
      }
      case 'grass': default: {
        col = mix(base2, base, n);
        k = 0.8 + fine * 0.35;
        break;
      }
    }
    if (crack) {
      const cd = crackDist(U, V, crack);
      if (cd < 0.01) { col = P.pattern === 'hell' ? [200, 50, 15] : mort; k = P.pattern === 'hell' ? 1 : 0.8; }
      else if (cd < 0.02) k *= 0.85;
    }
    // 가장자리 살짝 어둡게(타일 경계가 읽히도록)
    if (e < 0.02 && P.pattern !== 'earth' && P.pattern !== 'grass') k *= 0.88;
    return [col[0] * k, col[1] * k, col[2] * k];
  });
}

// 용암 타일(밝은 부분은 따로 빛을 더한다)
export function makeLava(RS, variant) {
  return diamondPixels(RS, (U, V) => {
    const n = fbm(U + variant * 0.37, V, 77 + variant, 4, 3);
    const crust = fbm(U, V, 91 + variant, 3, 6);
    const hot = sat((n - 0.35) * 2.2);
    let col = mix([90, 15, 5], [255, 170, 40], hot);
    if (crust > 0.62) col = mix(col, [40, 15, 10], sat((crust - 0.62) * 5));
    return col;
  });
}

// 마을 바닥: 1 풀, 2 흙길, 3 자갈길, 4 풀(짙음), 5 물, 6 다리 판자, 7 판석, 8 밭흙
const TOWN_PRI = [0, 0, 2, 3, 0, -1, -1, 3, 1];
function townTex(kind, U, V, seed, n, fine) {
  const grassA = [86, 99, 47], grassB = [60, 71, 34], dirtA = [122, 100, 68], dirtB = [90, 70, 48], stone = [119, 116, 108], stone2 = [91, 88, 80];
  switch (kind) {
    case 2: { const c = mix(dirtB, dirtA, n); const peb = vnoise(U * 18, V * 18, seed + 9, 18); const k = (0.85 + fine * 0.22) * (peb > 0.86 ? 1.18 : peb < 0.1 ? 0.82 : 1); return [c[0] * k, c[1] * k, c[2] * k]; }
    case 3: {
      // 둥근 자갈
      const cu = U * 5, cv = V * 5, iu = Math.floor(cu), iv = Math.floor(cv);
      let md = 9, id = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const gx = iu + dx, gy = iv + dy;
        const ox = gx + 0.2 + hash2(((gx % 5) + 5) % 5, ((gy % 5) + 5) % 5, 5) * 0.6, oy = gy + 0.2 + hash2(((gx % 5) + 5) % 5, ((gy % 5) + 5) % 5, 6) * 0.6;
        const d = Math.hypot(cu - ox, cv - oy);
        if (d < md) { md = d; id = hash2(((gx % 5) + 5) % 5, ((gy % 5) + 5) % 5, 9); }
      }
      const c = mix(stone2, stone, id * 0.7 + n * 0.3), k = md > 0.42 ? 0.55 : 0.85 + fine * 0.2 + (0.42 - md) * 0.3;
      return [c[0] * k, c[1] * k, c[2] * k];
    }
    case 7: {
      // 큰 판석(2×2), 판마다 밝기
      const cu = Math.floor(U * 2), cv = Math.floor(V * 2), lu = U * 2 - cu, lv = V * 2 - cv;
      const ed = Math.min(lu, 1 - lu, lv, 1 - lv);
      const c = mix([96, 92, 86], [128, 124, 116], hash2(cu, cv, 77) * 0.7 + n * 0.3);
      let k = 0.86 + fine * 0.2;
      if (ed < 0.035) k = 0.5; else if (ed < 0.07) k *= 0.86; else if (lu > 0.9 || lv > 0.9) k *= 1.06;
      return [c[0] * k, c[1] * k, c[2] * k];
    }
    case 8: {
      // 밭: 이랑(x 방향 줄)
      const r = (V * 4) % 1, c = mix([70, 52, 34], [96, 74, 50], n);
      const k = (r < 0.3 ? 0.7 : r < 0.5 ? 1.1 : 0.92) * (0.88 + fine * 0.2);
      return [c[0] * k, c[1] * k, c[2] * k];
    }
    case 5: { const w = fbm(U, V, 40, 3, 3); return mix([20, 36, 48], [46, 70, 84], w); }
    case 6: {
      const p = Math.floor(U * 5), lu = U * 5 - p;
      const c = mix([70, 50, 32], [110, 82, 52], hash2(p, 3, seed) * 0.6 + fine * 0.4);
      const k = lu < 0.07 || lu > 0.93 ? 0.5 : 1;
      return [c[0] * k, c[1] * k, c[2] * k];
    }
    case 4: { const c = mix(grassB, grassA, n * 0.7); const k = 0.7 + fine * 0.35; return [c[0] * k, c[1] * k, c[2] * k]; }
    default: {
      const c = mix(grassB, grassA, n);
      const blade = vnoise(U * 60, V * 22, seed + 3, 0);
      let k = 0.8 + fine * 0.2 + (blade > 0.75 ? 0.15 : 0);
      // 드문드문 들꽃(변형마다 자리가 다르다)
      const fl = hash2(Math.floor(U * 24), Math.floor(V * 24), seed + 11);
      if (fl > 0.992) return fl > 0.996 ? [210, 200, 120] : [200, 150, 200];
      return [c[0] * k, c[1] * k, c[2] * k];
    }
  }
}
// key: 바탕 종류, 변형, 그리고 더 높은 바닥(흙길·자갈·판석·밭)이 닿은 모서리 비트(북서·북동·남동·남서).
// 모서리 값을 겹선형으로 잇고 주기 잡음을 더해 경계를 구불구불하게 한다(이웃 칸과 경계가 그대로 이어진다)
export function makeTownFloor(kind, RS, variant = 0, spill = null) {
  const seed = 300 + kind * 13 + variant * 7;
  return diamondPixels(RS, (U, V) => {
    const n = fbm(U, V, 11, 4, 4), fine = vnoise(U * 40, V * 40, seed, 40);
    let col = townTex(kind, U, V, seed, n, fine);
    if (spill) for (const [q, m] of spill) {
      const c0 = m & 1, c1 = (m >> 1) & 1, c2 = (m >> 2) & 1, c3 = (m >> 3) & 1;
      const f = (c0 * (1 - U) + c1 * U) * (1 - V) + (c3 * (1 - U) + c2 * U) * V;
      if (f <= 0) continue;
      const g = f + (fbm(U, V, 23 + q, 3, 4) - 0.5) * 0.55;
      if (g > 0.6) {
        col = townTex(q, U, V, 300 + q * 13, n, fine);
        if (g < 0.66) col = [col[0] * 0.84, col[1] * 0.84, col[2] * 0.84];
      } else if (g > 0.52 && TOWN_PRI[kind] === 0) col = [col[0] * 0.86, col[1] * 0.84, col[2] * 0.8];
    }
    return col;
  });
}
// 마을 칸마다 바닥 열쇠(바탕·변형·넘쳐 들어오는 바닥의 모서리 비트)
export function townFloorKeys(L) {
  const W = L.w, Hh = L.h, keys = new Array(W * Hh), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= Hh ? 0 : L.floor[y * W + x]);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const f = L.floor[y * W + x];
    if (!f) { keys[y * W + x] = null; continue; }
    const p = TOWN_PRI[f] ?? 0;
    const spill = [];
    if (p >= 0) for (const q of [8, 2, 3, 7]) {
      if (TOWN_PRI[q] <= p) continue;
      let m = 0;
      // 모서리마다 닿은 네 칸: 북서(-1,-1),(0,-1),(-1,0) / 북동 / 남동 / 남서
      const cor = [[[-1, -1], [0, -1], [-1, 0]], [[1, -1], [0, -1], [1, 0]], [[1, 1], [0, 1], [1, 0]], [[-1, 1], [0, 1], [-1, 0]]];
      for (let c = 0; c < 4; c++) if (cor[c].some(([dx, dy]) => at(x + dx, y + dy) === q)) m |= 1 << c;
      if (m) spill.push([q, m]);
    }
    const v = f === 1 ? Math.floor(hash2(x, y, 99) * 3) : 0;
    keys[y * W + x] = `${f}|${v}|${spill.map((s) => s.join(':')).join(',')}`;
  }
  return keys;
}
export function townFloorSprite(T, key) {
  let s = T.townFloors.get(key);
  if (!s) {
    const [f, v, sp] = key.split('|');
    const spill = sp ? sp.split(',').map((t) => t.split(':').map(Number)) : null;
    s = shrink(makeTownFloor(+f, T.RS * SS, +v, spill), SS);
    T.townFloors.set(key, s);
  }
  return s;
}

// ───────── 벽 블록 ─────────
// 높이 hgt의 블록: 윗면 마름모 + 왼쪽 면(+y 방향) + 오른쪽 면(+x 방향)
export function makeWall(theme, variant, RS, hgt = WALL_H) {
  const P = PAL[theme], A = hex(P.wall), B = hex(P.wall2), M = hex(P.mortarW), T = hex(P.top);
  const w = Math.ceil(TW * RS), h = Math.ceil((hgt + TH) * RS);
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const seed = 500 + variant * 17 + theme.length;
  const rocky = P.pattern === 'earth';
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const sx = (px + 0.5) / RS - TW / 2, sy = (py + 0.5) / RS - (hgt + TH / 2);
    let col = null, alpha = 1;
    // 윗면
    const tu = sx / TW + (sy + hgt) / TH, tv = (sy + hgt) / TH - sx / TW;
    const te = 0.5 - Math.max(Math.abs(tu), Math.abs(tv));
    if (te >= -0.02) {
      const n = fbm(tu + 0.5, tv + 0.5, seed + 3, 3, 4);
      const k = 0.8 + n * 0.5 + (te < 0.04 ? 0.5 : 0);
      col = [T[0] * k, T[1] * k, T[2] * k];
      alpha = sat(te * 28.6 * RS + 1);
    }
    let face = 0, s = 0, hh = 0;
    if (!col || alpha < 1) {
      if (sx >= -TW / 2 && sx <= 0) {
        const yg = TH / 2 + sx / 2;
        if (sy <= yg + 0.5 && sy >= yg - hgt) { face = 1; s = (sx + TW / 2) / (TW / 2); hh = yg - sy; }
      } else if (sx > 0 && sx <= TW / 2) {
        const yg = TH / 2 - sx / 2;
        if (sy <= yg + 0.5 && sy >= yg - hgt) { face = 2; s = sx / (TW / 2); hh = yg - sy; }
      }
    }
    if (face) {
      const fc = faceColor(face, s, hh, hgt, A, B, M, seed, variant, rocky, theme);
      if (col && alpha < 1) col = mix(fc, col, alpha); else col = fc;
      alpha = 1;
      // 바닥과 닿는 아래 가장자리 부드럽게
      const yg = face === 1 ? TH / 2 + sx / 2 : TH / 2 - sx / 2;
      alpha = sat((yg - sy) * RS + 1);
    }
    if (!col) continue;
    const i = (py * w + px) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255 * alpha;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function faceColor(face, s, hh, hgt, A, B, M, seed, variant, rocky, theme) {
  const light = face === 1 ? 1 : 0.66; // 빛은 왼쪽 위에서
  const fs = face === 1 ? s : s + 7.31; // 면마다 다른 무늬
  let col, k;
  if (rocky) {
    // 바위: 층리와 울퉁불퉁한 덩어리
    const n = fbm(fs * 0.7, hh / 60, seed, 5, 3, false);
    const strata = Math.sin(hh / 9 + n * 6) * 0.5 + 0.5;
    col = mix(B, A, sat(n * 1.3 - 0.15));
    k = 0.65 + strata * 0.25 + (n - 0.5) * 0.5;
    if (vnoise(fs * 6, hh / 8, seed + 9, 0) > 0.8) k *= 0.6;
  } else {
    // 벽돌: 줄마다 엇갈림
    const bh = hgt / 7, row = Math.floor(hh / bh), lv = hh / bh - row;
    const per = 3, off = (row % 2) * 0.5;
    const bu = s * per + off, bi = Math.floor(bu), lu = bu - bi;
    const ed = Math.min(lu * 22, (1 - lu) * 22, lv * bh, (1 - lv) * bh);
    const bk = hash2(bi + face * 50, row, seed);
    const n = vnoise(fs * 24, hh / 3, seed + 1, 0);
    col = mix(B, A, bk * 0.7 + 0.15);
    k = 0.82 + n * 0.3;
    if (ed < 1.1) { col = M; k = 0.9; } else if (ed < 2) k *= 0.8; else if (lv > 0.82) k *= 1.08;
    // 변형: 깨진 벽돌, 벽감(아치), 핏자국/이끼
    if (variant === 2 && bk > 0.8) k *= 0.55;
    if (variant === 3) {
      const ax = Math.abs(s - 0.5), top = hgt * 0.7, rad = 0.2;
      const inArch = ax < rad && (hh < top - rad * 40 || Math.hypot(ax * 40, hh - (top - rad * 40)) < rad * 40);
      if (inArch && hh > 10) { col = [12, 10, 9]; k = 1 + (theme === 'hell' ? 0.8 : 0); if (theme === 'hell') col = [40, 6, 4]; }
      else if (ax < rad + 0.04 && hh < top + 2 && hh > 8) k *= 1.15;
    }
    if (variant === 4) {
      const st = fbm(s, hh / 50, seed + 4, 3, 3, false);
      if (st > 0.6) col = mix(col, theme === 'hell' ? [140, 20, 10] : theme === 'catacombs' ? [90, 20, 14] : [52, 62, 34], sat((st - 0.6) * 4));
    }
  }
  // 아래쪽은 어둡게(바닥 근처 그늘), 위 가장자리 살짝 밝게
  const ao = 0.55 + 0.45 * sat(hh / 22);
  const rim = hh > hgt - 2.5 ? 1.25 : 1;
  k *= light * ao * rim;
  return [col[0] * k, col[1] * k, col[2] * k];
}

// 어둡게 만든 사본(지금 보이지 않는 칸)
export function dimmed(src, a = 0.62) {
  const c = makeCanvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(0,0,0,${a})`;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// 빛 번짐 스프라이트(가산 합성용): 계단진 동심원
const glowCache = new Map();
const GLOW_BANDS = [[0, 1], [0.14, 0.6], [0.3, 0.3], [0.5, 0.13], [0.72, 0.04], [0.92, 0]];
export function glowSprite(r, g, b, size = 64) {
  const key = `${r},${g},${b},${size}`;
  let c = glowCache.get(key);
  if (c) return c;
  c = makeCanvas(size, size);
  const x = c.getContext('2d'), gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  GLOW_BANDS.forEach(([o, a], i) => { gr.addColorStop(o, `rgba(${r},${g},${b},${a})`); gr.addColorStop(GLOW_BANDS[i + 1]?.[0] ?? 1, `rgba(${r},${g},${b},${a})`); });
  x.fillStyle = gr; x.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}

// 테마 한 벌을 만든다: 도트 배율 RS의 3배로 크게 그려 줄인다(가장자리가 딱 끊기고 색이 줄어든다)
export function buildTileset(theme, RS) {
  const T = { theme, RS, floors: [null], walls: [null], wallsDim: [null], floorsDim: [null], lava: [] };
  const R = RS * SS, fin = (c) => shrink(c, SS);
  if (theme === 'town') {
    T.townFloors = new Map();
    for (let k = 1; k <= 8; k++) { const f = fin(makeTownFloor(k, R, 0)); T.floors.push(f); T.floorsDim.push(dimmed(f, 0.5)); }
    for (let v = 1; v <= 2; v++) { const w = fin(makeWall('crypt', v, R)); T.walls.push(w); T.wallsDim.push(dimmed(w)); }
    return T;
  }
  for (let v = 1; v <= 6; v++) { const f = fin(makeFloor(theme, v, R)); T.floors.push(f); T.floorsDim.push(dimmed(f, 0.55)); }
  for (let v = 1; v <= 4; v++) {
    const w = fin(makeWall(theme, v, R)); T.walls.push(w); T.wallsDim.push(dimmed(w));
  }
  for (let v = 0; v < 3; v++) T.lava.push(fin(makeLava(R, v)));
  return T;
}

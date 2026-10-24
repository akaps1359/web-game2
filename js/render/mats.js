// 굽는 모형의 재질: (C, f) => 칠하면 참(거짓이면 구멍). C.R·C.G·C.B에 빛 계산 전 색(0..255), C.E에 스스로 빛남(0..1)
// 벽은 가로 좌표로 화면 x(px)를 써서 +x면과 +y면의 무늬가 모서리에서 이어진다. 지붕은 면 좌표(a: 처마 따라, b: 경사 위로)
import { hash2, vnoise } from './noise.js';

export const hx = (C) => (C.x - C.y) * 32;
export const H = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const put = (C, c, k) => { C.R = c[0] * k; C.G = c[1] * k; C.B = c[2] * k; return true; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// 거의 단색(잔 무늬)
export function flat(c, o = {}) {
  const c0 = H(c), n = o.n ?? 0.08, sc = o.sc ?? 0.5, seed = o.seed ?? 1;
  return (C, f) => put(C, c0, 1 + (vnoise(C.a * sc + f.seed, C.b * sc, seed) - 0.5) * 2 * n);
}
// 스스로 빛나는 색
export function glowc(c, o = {}) {
  const c0 = H(c), c1 = H(o.c2 || c), seed = o.seed ?? 2;
  return (C, f) => { C.E = o.e ?? 1; return put(C, mixc(c0, c1, vnoise(C.a * 0.4, C.b * 0.4 + f.seed, seed)), 1); };
}

// 다듬은 돌 벽(줄마다 엇갈림)
export function ashlar(o) {
  const c = H(o.c), c2 = H(o.c2 || o.c), m = H(o.m || '#2a241e'), bh = o.bh ?? 9, bw = o.bw ?? 16, seed = o.seed ?? 3;
  const moss = o.moss ? H(o.moss) : null;
  return (C) => {
    const z = C.z, row = Math.floor(z / bh), lz = z - row * bh;
    const h = hx(C) + (row & 1) * bw * 0.5 + hash2(row, 7, seed) * 4;
    const col = Math.floor(h / bw), lh = h - col * bw;
    if (lz < 1.4 || lh < 1.6) return put(C, m, 0.85 + hash2(col, row, seed + 5) * 0.25);
    const hb = hash2(col, row, seed), n = vnoise(h * 0.3, z * 0.3, seed + 1);
    let k = 0.8 + hb * 0.28 + (n - 0.5) * 0.18;
    if (lz > bh - 1.8) k *= 1.12; else if (lz < 3) k *= 0.86;
    let cc = mixc(c, c2, hash2(col, row, seed + 2));
    if (moss && z < 16) { const mm = vnoise(h * 0.1, z * 0.18, seed + 9); if (mm > 0.5 + z / 40) cc = mixc(cc, moss, 0.7); }
    return put(C, cc, k);
  };
}
// 막돌 쌓기(기초·우물·담): 보로노이 돌
export function rubble(o) {
  const c = H(o.c), c2 = H(o.c2 || o.c), m = H(o.m || '#2a241e'), s = o.s ?? 8, seed = o.seed ?? 4, top = o.top;
  return (C) => {
    const u = (top ? C.x * 32 : hx(C)) / s, v = (top ? C.y * 32 : C.z) / s * (top ? 1 : 1.35);
    const iu = Math.floor(u), iv = Math.floor(v);
    let d1 = 9, d2 = 9, id = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gx = iu + dx, gy = iv + dy;
      const px = gx + 0.15 + hash2(gx, gy, seed) * 0.7, py = gy + 0.15 + hash2(gx, gy, seed + 1) * 0.7;
      const d = Math.hypot(u - px, v - py);
      if (d < d1) { d2 = d1; d1 = d; id = hash2(gx, gy, seed + 2); } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < 0.16) return put(C, m, 0.9);
    let k = 0.78 + id * 0.3 + (0.3 - d1) * 0.3;
    if (d2 - d1 < 0.3) k *= 0.85;
    return put(C, mixc(c, c2, id), k);
  };
}
// 회벽(얼룩·아래쪽 흙물)
export function plaster(o) {
  const c = H(o.c), seed = o.seed ?? 5, dirt = o.dirt ?? 10;
  return (C) => {
    const h = hx(C), z = C.z;
    const n = vnoise(h * 0.05, z * 0.05, seed) * 0.6 + vnoise(h * 0.18, z * 0.18, seed + 1) * 0.4;
    let k = 0.9 + (n - 0.5) * 0.2;
    if (z < dirt) k *= 0.74 + 0.26 * z / dirt;
    if (vnoise(h * 0.22, z * 0.025, seed + 3) > 0.74) k *= 0.9;
    return put(C, c, k);
  };
}
// 나무(결): dir 'z' 세로 기둥, 'h' 가로 들보, 'a'·'b' 면 좌표 방향
export function wood(o) {
  const c = H(o.c), seed = o.seed ?? 17, dir = o.dir || 'a';
  return (C) => {
    let u, v;
    if (dir === 'z') { u = hx(C); v = C.z; } else if (dir === 'h') { u = C.z; v = hx(C); } else if (dir === 'a') { u = C.b; v = C.a; } else { u = C.a; v = C.b; }
    return put(C, c, 0.8 + vnoise(u * 0.8, v * 0.07, seed) * 0.34);
  };
}
// 널빤지: dir 'v' 세로 판(벽), 'h' 가로 판(벽), 'a'·'b' 면 좌표로 판이 이어지는 방향
export function planks(o) {
  const c = H(o.c), w = o.w ?? 6, seed = o.seed ?? 7, dir = o.dir || 'v', gap = o.gap ?? 1.1;
  return (C) => {
    let across, along;
    if (dir === 'v') { across = hx(C); along = C.z; } else if (dir === 'h') { across = C.z; along = hx(C); } else if (dir === 'a') { across = C.b; along = C.a; } else { across = C.a; along = C.b; }
    const i = Math.floor(across / w), l = across - i * w;
    if (l < gap) return put(C, c, 0.42);
    const hb = hash2(i, 3, seed);
    let k = 0.78 + hb * 0.3 + (vnoise(l * 0.9, along * 0.06 + i * 5, seed) - 0.5) * 0.25;
    if (l > w - 1.4) k *= 0.86;
    if (hash2(i, Math.floor(along / 14), seed + 4) > 0.93) k *= 0.7; // 옹이
    return put(C, c, k);
  };
}
// 너와·기와 지붕: a 처마 따라, b 경사 위로
export function shingles(o) {
  const c = H(o.c), c2 = H(o.c2 || o.c), rh = o.rh ?? 7, sw = o.sw ?? 9, seed = o.seed ?? 11, moss = o.moss ? H(o.moss) : null, mt = o.mt ?? 0.58;
  return (C, f) => {
    const b = C.b, row = Math.floor(b / rh), lb = b - row * rh;
    const a = C.a + (row & 1) * sw * 0.5 + hash2(row, f.seed & 7, seed) * 3;
    const col = Math.floor(a / sw), la = a - col * sw;
    const hb = hash2(col, row, seed);
    let k = 0.8 + hb * 0.28;
    let cc = hb > 0.82 ? c2 : c;
    if (lb > rh - 1.7) k *= 0.56;
    else if (lb < 1.5) k *= 1.12;
    else if (la < 1.2) k *= 0.7;
    if (moss) { const mm = vnoise(C.a * 0.05, b * 0.07, seed + 2 + (f.seed & 3)); if (mm > mt) cc = mixc(cc, moss, sat((mm - mt) * 5)); }
    return put(C, cc, k);
  };
}
// 짚 지붕: 경사 따라 결, 겹마다 그늘, 처마 끝은 들쭉날쭉
export function thatch(o) {
  const c = H(o.c), seed = o.seed ?? 13, moss = o.moss ? H(o.moss) : null;
  return (C, f) => {
    const a = C.a, b = C.b;
    if (b < hash2(Math.floor(a / 2.5), 1, seed) * 3.2) return false;
    const lay = (b + hash2(Math.floor(a / 7), 2, seed) * 3) / 8, li = Math.floor(lay), lb = (lay - li) * 8;
    const str = vnoise(a * 0.85, b * 0.05 + li * 3.1, seed);
    let k = 0.7 + str * 0.45;
    if (lb < 1.7) k *= 0.6;
    let cc = c;
    if (moss) { const mm = vnoise(a * 0.06, b * 0.06, seed + 5 + (f.seed & 3)); if (mm > 0.6) cc = mixc(c, moss, sat((mm - 0.6) * 4)); }
    return put(C, cc, k);
  };
}
// 쇠붙이(반짝임)
export function metal(c, o = {}) {
  const c0 = H(c), sp = o.sp ?? 0.6;
  return (C) => {
    const d = C.nx * 0.2 + C.ny * 0.62 + C.nz * 0.76, s = d > 0.93 ? (d - 0.93) * 14 * sp : 0;
    return put(C, mixc(c0, [255, 250, 235], Math.min(0.8, s)), 1);
  };
}
// 나뭇잎 덩어리(공): 화면 좌표 잡음으로 잎 뭉치, 가장자리는 들쭉날쭉
export function leaves(o) {
  const c = H(o.c), c2 = H(o.c2 || o.c), seed = o.seed ?? 21, sc = o.sc ?? 0.32;
  return (C, f) => {
    const n = vnoise(C.a * sc + f.seed * 3.1, C.b * sc, seed), n2 = vnoise(C.a * sc * 2.3, C.b * sc * 2.3 + f.seed, seed + 1);
    const rim = C.nx * 0.612 + C.ny * 0.612 + C.nz * 0.5;
    if (rim < 0.32 && n2 > 0.5) return false;
    let k = 0.85 + (n - 0.5) * 0.35;
    if (n2 > 0.72) k *= 1.18; else if (n2 < 0.25) k *= 0.72;
    return put(C, mixc(c, c2, sat(n * 1.2 - 0.1)), k);
  };
}
// 나무껍질(세로 결)
export function bark(c, seed = 23) {
  const c0 = H(c);
  return (C) => put(C, c0, 0.72 + vnoise(hx(C) * 0.9, C.z * 0.08, seed) * 0.4);
}
// 천(줄무늬)
export function cloth(o) {
  const c1 = H(o.c1), c2 = H(o.c2 || o.c1), w = o.w ?? 7;
  return (C) => { const i = Math.floor(C.a / w); return put(C, i & 1 ? c2 : c1, 0.9 + vnoise(C.a * 0.3, C.b * 0.3, 31) * 0.15); };
}
// 짚단·건초
export function hay(c, seed = 27) {
  const c0 = H(c);
  return (C) => { const n = vnoise(C.a * 0.9 + C.z * 0.2, C.b * 0.12 + hx(C) * 0.05, seed); return put(C, c0, 0.68 + n * 0.5); };
}
// 숯불(스스로 빛남)
export function coals() {
  return (C) => {
    const n = vnoise(C.a * 0.5, C.b * 0.5, 41), n2 = vnoise(C.a * 1.3, C.b * 1.3, 42);
    C.E = 1;
    if (n2 < 0.3) return put(C, [60, 18, 8], 1);
    return put(C, mixc([200, 50, 10], [255, 200, 90], sat(n * 1.4 - 0.2)), 1);
  };
}
// 작은 도트 그림(간판 등): rows 문자열 배열, pal 문자→색. 면 좌표 al(가로)·be(위로)로 찍는다
export function icon(rows, pal, bg) {
  const P = {}; for (const k in pal) P[k] = H(pal[k]);
  const B = H(bg), h = rows.length, w = rows[0].length;
  return (C) => {
    const x = Math.min(w - 1, Math.floor(C.al * w)), y = Math.min(h - 1, Math.floor((1 - C.be) * h));
    const ch = rows[y][x];
    if (ch === '.' || !P[ch]) return put(C, B, 0.85 + vnoise(C.a * 0.6, C.b * 0.6, 51) * 0.25);
    return put(C, P[ch], 1);
  };
}

// ───────── 벽에 붙는 것(창·문·스테인드글라스) ─────────
// 벽 재질 base 위에 덧붙인다. d: { k, h0, h1, z0, z1, ... } (h는 화면 x px, z는 높이 px)
export function decals(base, list) {
  return (C, f) => {
    const h = hx(C), z = C.z;
    for (const d of list) {
      const m = d.m ?? 3;
      if (h < d.h0 - m || h > d.h1 + m || z < d.z0 - m || z > d.z1 + m) continue;
      const r = DECAL[d.k](C, d, h, z, f);
      if (r !== undefined) return r;
    }
    return base(C, f);
  };
}
const FRAME = H('#3a2818'), BAR = H('#22160c'), SILL = H('#8a7a62'), IRON = H('#2a2826');
const WARM = [[235, 140, 60], [255, 214, 130]];
const GLASS = [[60, 90, 170], [150, 40, 40], [200, 160, 60], [60, 120, 80], [110, 60, 140]];
// 뾰족 아치 안인가(폭 w, 몸통 위쪽 끝 zs, 꼭대기 z1)
function inPoint(h, z, d) {
  const w2 = (d.h1 - d.h0) / 2, zs = d.z1 - w2 * 1.73;
  if (z <= zs) return true;
  return Math.hypot(h - d.h0, z - zs) <= w2 * 2 && Math.hypot(h - d.h1, z - zs) <= w2 * 2;
}
function inRound(h, z, d) {
  const w2 = (d.h1 - d.h0) / 2, zs = d.z1 - w2;
  return z <= zs || Math.hypot(h - (d.h0 + w2), z - zs) <= w2;
}
const DECAL = {
  // 창: lit(불 켜짐), sh(덧창 색), cross(창살)
  win(C, d, h, z) {
    const W = d.h1 - d.h0, Hh = d.z1 - d.z0, ix = h - d.h0, iz = z - d.z0;
    if (z < d.z0 && z >= d.z0 - 2.4 && h >= d.h0 - 1.5 && h <= d.h1 + 1.5) return put(C, SILL, 0.95);
    if (d.sh && iz >= 0 && iz <= Hh) {
      const sw = W * 0.55;
      if ((ix < 0 && ix >= -sw) || (ix > W && ix <= W + sw)) {
        const l = ix < 0 ? -ix : ix - W, i = Math.floor(l / 3);
        return put(C, H(d.sh), (l % 3 < 0.7 ? 0.6 : 0.85 + hash2(i, 9, 3) * 0.2) * (Math.abs(iz - Hh / 2) < 1 ? 0.7 : 1));
      }
    }
    if (ix < 0 || ix > W || iz < 0 || iz > Hh) return undefined;
    const fw = 2.2;
    if (d.round) {
      const r = Math.hypot(ix - W / 2, (iz - Hh / 2) * W / Hh) / (W / 2);
      if (r > 1) return undefined;
      if (r > 0.72) return put(C, FRAME, 0.9);
    } else if (ix < fw || W - ix < fw || iz < fw || Hh - iz < fw) return put(C, FRAME, 0.9);
    if (Math.abs(ix - W / 2) < 0.9 || (d.cross !== false && Math.abs(iz - Hh * 0.55) < 0.9)) return put(C, BAR, 1);
    if (d.lit) { C.E = 1; const gl = d.glass || WARM; return put(C, mixc(gl[0], gl[1], sat(1 - iz / Hh + vnoise(ix * 0.5, iz * 0.5, 61) * 0.3)), 1); }
    const r = (ix + iz) % 9 < 1.5 ? 1.5 : 1;
    return put(C, [34, 38, 46], r);
  },
  // 문: arch 'round'|'point', open(어두운 입구), warm(안쪽 불빛), col(나무 색)
  door(C, d, h, z) {
    const ix = h - d.h0, iz = z - d.z0, W = d.h1 - d.h0;
    const inside = d.arch === 'point' ? inPoint(h, z, d) : d.arch === 'round' ? inRound(h, z, d) : z <= d.z1;
    if (ix < 0 || ix > W || iz < 0 || !inside) return undefined;
    const fw = d.fw ?? 2.2;
    const inner = { h0: d.h0 + fw, h1: d.h1 - fw, z0: d.z0, z1: d.z1 - fw };
    const inI = ix >= fw && W - ix >= fw && (d.arch === 'point' ? inPoint(h, z, inner) : d.arch === 'round' ? inRound(h, z, inner) : z <= inner.z1);
    if (!inI) return put(C, d.frame ? H(d.frame) : FRAME, 0.95);
    if (d.open) {
      const t = sat(iz / (d.z1 - d.z0));
      if (d.warm) { C.E = 0.85; return put(C, mixc([220, 120, 50], [40, 18, 10], t), 1); }
      if (d.red) { C.E = 0.6; return put(C, mixc([90, 20, 10], [8, 6, 6], sat(t * 1.6)), 1); }
      return put(C, [10, 8, 8], 1);
    }
    const pw = 4.2, i = Math.floor((ix - fw) / pw), l = ix - fw - i * pw;
    let k = 0.8 + hash2(i, 5, 9) * 0.25;
    if (l < 0.8) k = 0.45;
    const bz = (d.z1 - d.z0);
    if (Math.abs(iz - bz * 0.22) < 1.2 || Math.abs(iz - bz * 0.68) < 1.2) return put(C, IRON, 1);
    if (Math.abs(ix - W * 0.78) < 1.4 && Math.abs(iz - bz * 0.45) < 1.4) return put(C, [200, 170, 90], 1);
    return put(C, d.col ? H(d.col) : [106, 70, 40], k);
  },
  // 스테인드글라스 뾰족창
  lancet(C, d, h, z) {
    const ix = h - d.h0, W = d.h1 - d.h0;
    if (ix < 0 || ix > W || z < d.z0 || !inPoint(h, z, d)) return undefined;
    const inner = { h0: d.h0 + 1.8, h1: d.h1 - 1.8, z0: d.z0, z1: d.z1 - 1.8 };
    if (ix < 1.8 || W - ix < 1.8 || z < d.z0 + 1.8 || !inPoint(h, z, inner)) return put(C, d.frame ? H(d.frame) : [70, 66, 60], 1);
    const cu = Math.floor((ix + (Math.floor(z / 5) & 1) * 1.5) / 3), cv = Math.floor(z / 5);
    if ((ix + (Math.floor(z / 5) & 1) * 1.5) % 3 < 0.7 || z % 5 < 0.8) return put(C, [26, 22, 24], 1);
    C.E = d.dim ? 0.25 : 0.55;
    return put(C, GLASS[Math.floor(hash2(cu, cv, d.seed || 71) * GLASS.length)], 0.9);
  },
  // 장미창(둥근 스테인드글라스)
  rose(C, d, h, z) {
    const cx = (d.h0 + d.h1) / 2, cz = (d.z0 + d.z1) / 2, R = (d.h1 - d.h0) / 2;
    const dx = h - cx, dz = z - cz, r = Math.hypot(dx, dz);
    if (r > R) return undefined;
    if (r > R - 2.2) return put(C, [74, 70, 64], 1);
    if (r < 2.5) { C.E = 0.6; return put(C, [220, 180, 70], 1); }
    const a = (Math.atan2(dz, dx) / (Math.PI * 2) + 1) * 12, ai = Math.floor(a);
    if (a - ai < 0.14 || Math.abs(r - R * 0.55) < 0.7) return put(C, [26, 22, 24], 1);
    C.E = d.dim ? 0.25 : 0.6;
    return put(C, GLASS[(ai + (r > R * 0.55 ? 2 : 0)) % GLASS.length], 0.9);
  },
};

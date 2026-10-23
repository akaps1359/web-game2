// 절차적 텍스처용 잡음: 격자 값 잡음(주기 반복 가능)과 프랙탈 합
export function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);

// 주기 p(격자 칸 수)로 반복되는 값 잡음. u, v는 격자 단위
export function vnoise(u, v, seed, p = 0) {
  const x0 = Math.floor(u), y0 = Math.floor(v), fx = fade(u - x0), fy = fade(v - y0);
  const w = (n) => (p ? ((n % p) + p) % p : n);
  const a = hash2(w(x0), w(y0), seed), b = hash2(w(x0 + 1), w(y0), seed);
  const c = hash2(w(x0), w(y0 + 1), seed), d = hash2(w(x0 + 1), w(y0 + 1), seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}
// 옥타브 합(0..1). base 주파수에서 시작해 주기를 유지한다
export function fbm(u, v, seed, oct = 4, base = 4, periodic = true) {
  let s = 0, amp = 0.5, tot = 0, f = base;
  for (let o = 0; o < oct; o++) {
    s += amp * vnoise(u * f, v * f, seed + o * 17, periodic ? f : 0);
    tot += amp; amp *= 0.5; f *= 2;
  }
  return s / tot;
}

// 색 도구
export function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
export function rgb(c, k = 1, a = 1) {
  const r = Math.max(0, Math.min(255, c[0] * k | 0)), g = Math.max(0, Math.min(255, c[1] * k | 0)), b = Math.max(0, Math.min(255, c[2] * k | 0));
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
// 문자열 색을 밝게/어둡게(캐시)
const shadeCache = new Map();
export function shade(c, k) {
  const key = c + '|' + k;
  let v = shadeCache.get(key);
  if (!v) {
    const a = c[0] === '#' ? hex(c) : c.match(/\d+/g).map(Number);
    v = rgb(a, k);
    if (shadeCache.size > 4000) shadeCache.clear();
    shadeCache.set(key, v);
  }
  return v;
}

export function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' && false ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

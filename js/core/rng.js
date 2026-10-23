// 시드 난수: 같은 시드면 같은 던전·같은 드롭이 나온다(sfc32)
export class RNG {
  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.seed = seed >>> 0;
    this.a = 0x9e3779b9; this.b = 0x243f6a88; this.c = 0xb7e15162; this.d = this.seed ^ 0xdeadbeef;
    for (let i = 0; i < 15; i++) this.u32();
  }
  u32() {
    let { a, b, c, d } = this;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11); c = (c + t) | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return t >>> 0;
  }
  next() { return this.u32() / 4294967296; }
  // [lo, hi] 정수
  int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
  range(lo, hi) { return lo + this.next() * (hi - lo); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  // 가중치 고르기: w(x) 또는 x.w
  weighted(arr, w = (x) => x.w ?? 1) {
    let tot = 0;
    for (const x of arr) tot += Math.max(0, w(x));
    if (tot <= 0) return null;
    let r = this.next() * tot;
    for (const x of arr) { r -= Math.max(0, w(x)); if (r < 0) return x; }
    return arr[arr.length - 1];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  fork() { return new RNG(this.u32()); }
}

// 전역 비결정 난수(연출용)
export const rnd = (lo = 0, hi = 1) => lo + Math.random() * (hi - lo);
export const irnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 문자열 → 32비트 해시
export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

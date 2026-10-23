// 작곡 도구: 악절(박 단위 이벤트 목록)을 짧은 표기로 만든다
// 이벤트 {t 시작 박, i 악기, m 음높이(MIDI), d 길이(박), v 세기(0~1), cut 길이에서 끊기, r 재생 속도}
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(s) {
  if (typeof s === 'number') return s;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error('음 표기 오류: ' + s);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const R = Math.random;
export const rr = (a, b) => a + (b - a) * R();
export const pick = (a) => a[Math.floor(R() * a.length)];
export const chance = (p) => R() < p;
// 무게를 따라 고르되 바로 앞 것은 피한다: { 이름: 무게 }
export function choose(w, last) {
  const ks = Object.keys(w).filter((k) => k !== last || Object.keys(w).length === 1);
  let s = 0;
  for (const k of ks) s += w[k];
  let x = R() * s;
  for (const k of ks) { x -= w[k]; if (x <= 0) return k; }
  return ks[ks.length - 1];
}

export class Ph {
  constructor(len) { this.len = len; this.ev = []; }
  // 음 하나(m은 'A3' 같은 이름이나 MIDI 수)
  n(i, t, m, d, v = 0.7, x) {
    if (t >= this.len) return this;
    if (t < 0) t = 0;
    this.ev.push(x ? { i, t, m: m == null ? null : midi(m), d, v, ...x } : { i, t, m: m == null ? null : midi(m), d, v });
    return this;
  }
  // 화음: 여러 음을 함께
  ch(i, t, ms, d, v, x) { for (const m of ms) this.n(i, t, m, d, v, x); return this; }
  // 음표 줄 "A3:1 C4:.5 r:1 [A2,E3]:2 ~:1": 길이를 생략하면 앞과 같다, r 쉼표, ~ 앞 음 잇기
  seq(i, t0, str, v = 0.7, x = {}) {
    let t = t0, d = 1, last = null;
    for (const tok of str.split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const [a, b] = tok.split(':');
      if (b) d = +b;
      if (a === 'r') { t += d; last = null; continue; }
      if (a === '~') { if (last) for (const e of last) e.d += d; t += d; continue; }
      const ms = a[0] === '[' ? a.slice(1, -1).split(',') : [a];
      last = [];
      for (const m of ms) { const mm = midi(m) + (x.tr || 0); this.n(i, t + (x.hum ? rr(-x.hum, x.hum) : 0), mm, d, v * (x.vr ? rr(1 - x.vr, 1 + x.vr) : 1), x.cut ? { cut: 1 } : null); last.push(this.ev[this.ev.length - 1]); }
      t += d;
    }
    return this;
  }
  // 타악기 격자: 한 칸 s박, X 세게 · x 보통 · o 여리게 · . 쉼. 악절 끝까지 되풀이(from~to 박)
  grid(i, str, s, v = 0.7, from = 0, to = this.len, x) {
    const g = str.replace(/\s+/g, '');
    for (let j = 0, t = from; t < to - 1e-6; j++, t += s) {
      const c = g[j % g.length];
      if (c === '.') continue;
      this.n(i, t, null, s, v * (c === 'X' ? 1 : c === 'x' ? 0.7 : 0.4) * rr(0.9, 1.08), x);
    }
    return this;
  }
  out() { this.ev.sort((a, b) => a.t - b.t); return this; }
}
// 미리 그려 둘 악기 소리 열쇠: { 악기: [음높이...] 또는 변형 수 }
export function keys(spec) {
  const out = [];
  for (const [i, v] of Object.entries(spec)) {
    if (Array.isArray(v)) for (const m of v) out.push(`mus:${i}:${midi(m)}`);
    else for (let k = 0; k < v; k++) out.push(`mus:${i}:${k}`);
  }
  return out;
}

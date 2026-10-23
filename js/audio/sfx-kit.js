// 효과음 재료: 여러 효과음이 함께 쓰는 소리 조각(동전·삐걱임·발소리·금속·뼈·불·전기)
import { SR, TAU, rnd, rr, N, line, ad, env, mul, mix, noise, osc, hp1, svf, lp, hp, bp, click, modes, boom, crackle, ks, whoosh } from './dsp.js';

// 동전 하나: 얇은 원판의 어긋난 배음
export function coin(x, at, a = 1, f0 = rr(2500, 4300), d = 1) {
  modes(x, at, [[f0, 1, 0.1 * d], [f0 * 1.47, 0.6, 0.08 * d], [f0 * 2.09, 0.45, 0.06 * d], [f0 * 2.63, 0.3, 0.045 * d], [f0 * 3.43, 0.18, 0.03 * d]], a);
  mix(x, click(0.3), at, a * 0.3);
}
// 가죽 주머니가 털썩
export function pouch(x, at, a = 1) {
  const n = noise(0.09, 'p'); lp(n, 900, 0.7); mul(n, ad(0.09, 0.002, 0.02)); mix(x, n, at, a);
  mix(x, boom(0.12, 150, 90, 0.025, 0, 0), at, a * 0.6);
}
// 삐걱: 끈적하게 미끄러지는 마찰 펄스열이 나무 몸통을 울린다(문·경첩·가죽끈). f: [[초, Hz]...] 마찰 빠르기
export function creak(dur, f, res = 900, q = 4, jit = 0.3) {
  const n = N(dur), x = new Float32Array(n), fr = line(f, n, true);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    ph += fr[i] / SR * (1 + (rnd() - 0.5) * jit);
    if (ph >= 1) { ph -= 1; x[i] = 1 - rnd() * 0.6; }
  }
  const y = new Float32Array(n);
  for (const [k, g] of [[1, 1], [2.3, 0.45], [0.47, 0.6], [3.6, 0.2]]) mix(y, svf(x.slice(), 'bp', res * k, q), 0, g);
  return mul(y, env([[0, 0], [Math.min(0.02, dur / 4), 1], [dur * 0.8, 1], [dur, 0]], dur));
}
// 돌바닥 발소리: 뒤꿈치 쿵 + 모래 긁힘. dark 낮을수록 둔하다
export function step(x, at, a = 1, dark = 1) {
  const th = noise(0.07, 'p'); lp(th, 380 * dark, 0.9); mul(th, ad(0.07, 0.003, 0.016)); mix(x, th, at, a * 1.4);
  mix(x, boom(0.08, rr(95, 120), 60, 0.018, 0, 0), at, a * 0.5);
  const gr = crackle(0.09, 900, 1500 * dark, 6000, 0.0006); mul(gr, env([[0, 0.2], [0.02, 1], [0.09, 0]], 0.09)); mix(x, gr, at + 0.008, a * 0.5);
}
// 금속 판·칼날: 자유 막대 배음에 더러운 배음 몇 개(clang)
export function metal(x, at, f, a = 1, d = 1, dirt = 3) {
  const m = [[f, 1, 0.3 * d], [f * 2.756, 0.75, 0.22 * d], [f * 5.404, 0.5, 0.15 * d], [f * 8.933, 0.28, 0.09 * d], [f * 13.34, 0.14, 0.05 * d]];
  for (let i = 0; i < dirt; i++) m.push([f * rr(1.6, 7), rr(0.2, 0.45), rr(0.04, 0.12) * d]);
  modes(x, at, m, a);
  const n = noise(0.03, 'w'); hp(n, 1800); mul(n, ad(0.03, 0.0005, 0.005)); mix(x, n, at, a * 0.7);
}
// 돌·흙에 부딪는 둔탁한 소리
export function thud(x, at, a = 1, f = 100, tau = 0.05, bright = 700) {
  mix(x, boom(tau * 6, f, f * 0.55, tau, 0.9, bright), at, a);
}
// 나무 조각: 짧고 마른 공명(뼈·나무·문)
export function wood(x, at, f, a = 1, tau = 0.03) {
  modes(x, at, [[f, 1, tau], [f * 2.3, 0.6, tau * 0.7], [f * 3.9, 0.35, tau * 0.45], [f * 5.1, 0.2, tau * 0.3]], a);
  const c = noise(0.006, 'w'); hp1(c, 1200); mix(x, c, at, a * 0.5);
}
// 뼈 덜그럭: 짧은 마른 딸깍들(밀도 k, 길이 dur)
export function bones(x, at, dur, k, a = 1, lo = 900, hi = 2600) {
  for (let i = 0; i < k; i++) {
    const t = at + Math.pow(rnd(), 1.3) * dur, f = rr(lo, hi);
    wood(x, t, f, a * rr(0.3, 1) * (1 - 0.6 * (t - at) / dur), rr(0.008, 0.022));
  }
}
// 유리·얼음 조각: 높고 짧은 어긋난 배음 알갱이
export function shards(x, at, dur, k, a = 1, lo = 2200, hi = 9000) {
  for (let i = 0; i < k; i++) {
    const t = at + Math.pow(rnd(), 1.7) * dur, f = rr(lo, hi), tau = rr(0.015, 0.07);
    modes(x, t, [[f, 1, tau], [f * rr(1.3, 1.8), 0.5, tau * 0.7], [f * rr(2.2, 2.9), 0.3, tau * 0.5]], a * rr(0.2, 1) * (1 - 0.7 * (t - at) / dur));
  }
}
// 불길: 낮은 우르릉 + 깜빡이는 띠 잡음 + 탁탁 튀는 불티
export function fire(dur, a = 1, crk = 30, low = 1) {
  const n = N(dur), x = new Float32Array(n);
  const r = noise(dur, 'b'); lp(r, 260 * low, 0.8); mix(x, r, 0, 1.2 * a);
  const m = noise(dur, 'p'); bp(m, 700 * low, 0.8);
  let g = 0.6, tg = 0.6;
  for (let i = 0; i < n; i++) { if ((i & 511) === 0) tg = 0.25 + rnd() * 0.9; g += (tg - g) * 0.004; m[i] *= g; }
  mix(x, m, 0, 0.9 * a);
  if (crk) mix(x, crackle(dur, crk, 1500, 7000, 0.0012), 0, 1.2 * a);
  return x;
}
// 불꽃이 휙 붙는 소리
export function fwoosh(dur, f0, f1, a = 1) {
  const x = whoosh(dur, [[0, f0], [dur * 0.4, f1], [dur, f1 * 0.6]], 0.7, 0.3, 'p');
  const b = noise(dur, 'b'); lp(b, 300); mul(b, env([[0, 0], [dur * 0.3, 1], [dur, 0]], dur)); mix(x, b, 0, 0.8);
  mix(x, mul(crackle(dur, 40, 1500, 7000), env([[0, 0], [dur * 0.3, 1], [dur, 0.2]], dur)), 0, 0.8);
  return x.map((v) => v * a);
}
// 전기 지지직: 불규칙한 방전 + 윙윙거리는 톱니(rate 방전 밀도, hum 웅 소리 Hz)
export function zap(dur, rate = 400, hum = 110, bright = 1) {
  const n = N(dur), x = crackle(dur, rate, 900 * bright, 9000, 0.0004);
  const h = osc(dur, line([[0, hum], [dur, hum * rr(0.9, 1.1)]], n, true), 'saw');
  let g = 1;
  for (let i = 0; i < n; i++) { if ((i & 127) === 0) g = rnd() < 0.3 ? 0.1 : 0.4 + rnd() * 0.6; h[i] *= g; }
  bp(h, 1500 * bright, 0.9);
  mix(x, h, 0, 0.5);
  return x;
}
// 번개 갈래 한 번: 날카로운 딱 + 지글거림
export function crack(x, at, a = 1, len = 0.25) {
  const c = noise(0.012, 'w'); mul(c, ad(0.012, 0.0002, 0.003)); mix(x, c, at, a * 1.5);
  const z = zap(len, 1400, rr(80, 140)); mul(z, ad(len, 0.002, len * 0.3)); mix(x, z, at, a);
  mix(x, boom(0.3, 70, 45, 0.08, 0.6, 1000), at, a * 0.5);
}
// 활시위: 짧게 퉁기는 낮은 현 + 작은 휙
export function twang(x, at, a = 1, f = rr(105, 135)) {
  const s = ks(0.35, f, { t60: 0.25, b: 0.3, soft: 5000, pick: 0.1 }); mix(x, s, at, a * 0.9);
  const s2 = ks(0.2, f * 2.02, { t60: 0.12, b: 0.25 }); mix(x, s2, at, a * 0.3);
  mix(x, whoosh(0.16, [[0, 900], [0.16, 3500]], 1.2, 0.2), at + 0.01, a * 0.5);
  mix(x, click(0.4), at, a * 0.3);
}
// 떨리는 화살대(박힌 뒤 부르르)
export function quiver(x, at, a = 1, f = 170) {
  const d = 0.25, o = osc(d, f, 'tri'); const e = ad(d, 0.002, 0.06);
  for (let i = 0; i < o.length; i++) o[i] *= e[i] * (0.6 + 0.4 * Math.sin(TAU * 32 * i / SR));
  mix(x, o, at, a * 0.4);
}
// 거품: 위로 미끄러지는 짧은 사인(독·산·용암)
export function bubbles(x, at, dur, k, a = 1, lo = 300, hi = 1200) {
  for (let i = 0; i < k; i++) {
    const t = at + rnd() * dur, f = rr(lo, hi), d = rr(0.02, 0.06), o = osc(d, line([[0, f], [d, f * rr(1.6, 2.4)]], N(d), true));
    mul(o, env([[0, 0], [0.003, 1], [d, 0]], d)); mix(x, o, t, a * rr(0.3, 1));
  }
}
// 돌·잔해 쏟아짐: 작은 돌 알갱이들
export function debris(x, at, dur, k, a = 1) {
  for (let i = 0; i < k; i++) {
    const t = at + Math.pow(rnd(), 1.5) * dur, f = rr(300, 1400);
    modes(x, t, [[f, 1, rr(0.01, 0.03)], [f * rr(1.7, 2.6), 0.5, 0.012]], a * rr(0.15, 0.8) * (1 - 0.6 * (t - at) / dur));
  }
  const g = noise(dur, 'p'); bp(g, 1800, 0.7); mul(g, env([[0, 0], [0.02, 1], [dur, 0]], dur)); mix(x, g, at, a * 0.25);
}

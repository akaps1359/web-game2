// 배경음악 악기 소리: 음높이(또는 변형)마다 한 번 그려 두고 버퍼로 다시 튼다
// pitched: 열쇠의 숫자가 음높이(MIDI), 아니면 변형 번호(n개). hi: 원래 표본율로(밝은 소리)
import { SR, rr, N, buf, line, ad, env, mul, mix, noise, osc, bp, lp, ks, modes, bellModes, barModes, boom, finish } from './dsp.js';
import { metal, wood, creak, bones } from './sfx-kit.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 북: 어긋난 막 배음이 처음에 높았다가 내려앉고, 가죽 치는 잡음이 붙는다
function drum(f, dec, o = {}) {
  const d = Math.min(4, dec * 5 + 0.1), x = buf(d), bend = o.bend ?? 1.3;
  for (const [k, a, t] of [[1, 1, dec], [1.59, 0.45, dec * 0.6], [2.14, 0.3, dec * 0.45], [2.65, 0.18, dec * 0.35], [3.16, 0.1, dec * 0.25]]) {
    const s = osc(Math.min(d, t * 7), line([[0, f * k * bend], [0.035, f * k * 1.04], [d, f * k]], N(Math.min(d, t * 7)), true));
    mul(s, ad(Math.min(d, t * 7), 0.0015, t)); mix(x, s, 0, a);
  }
  const s = noise(0.08, 'w'); lp(s, o.skin ?? 1800, 0.7); mul(s, ad(0.08, 0.0005, o.skinT ?? 0.012)); mix(x, s, 0, o.slap ?? 0.5);
  return x;
}

export const INSTR = {
  // 핑거 피킹 기타(카플러스-스트롱 + 몸통 울림): 낮은 음일수록 오래 울린다
  gtr: { pitched: 1, r: (m) => {
    // 되먹임 필터가 기본음을 깎는 양을 초당 3네퍼 안으로: 높은 음일수록 필터를 덜 어둡게(그대로면 높은 줄이 금방 죽는다)
    const f = mtof(m), t60 = clamp(4.6 * Math.pow(110 / f, 0.35), 1.8, 5.5), d = Math.min(4.5, t60 * 0.8 + 0.2);
    const q = Math.min(0.2475, 3 / (f * (1 - Math.cos(2 * Math.PI * f / SR)))), b = (1 - Math.sqrt(1 - 4 * q)) / 2;
    const x = ks(d, f, { t60, b, soft: rr(2600, 3400), pick: rr(0.12, 0.2), body: [[102, 2.5, 0.35], [215, 2.2, 0.25], [440, 1.8, 0.1]] });
    return finish(lp(x, Math.min(6000, SR * 0.4), 0.6), { rms: 0.2 });
  } },
  // 하프: 밝고 길게, 가운데를 뜯어 홀수 배음이 두드러진다
  harp: { pitched: 1, hi: 1, r: (m) => {
    const f = mtof(m), t60 = clamp(3.6 * Math.pow(220 / f, 0.35), 1.2, 4.5);
    return finish(ks(Math.min(4, t60 * 0.8), f, { t60, b: 0.25, soft: 6000, pick: 0.32 }), { rms: 0.2 });
  } },
  // 낮고 어두운 뜯음(지하 묘지·우두머리의 반복 음형)
  pluck: { pitched: 1, r: (m) => {
    const f = mtof(m);
    return finish(ks(1.4, f, { t60: 1.0, b: 0.55, soft: 1800, pick: 0.25, body: [[90, 2, 0.4]] }), { rms: 0.22 });
  } },
  // 교회 종(낮은 조종): 단3도 배음이 구슬프다
  bell: { pitched: 1, r: (m) => {
    const f = mtof(m), d = clamp(7 * Math.pow(110 / f, 0.3), 3, 8), x = buf(d);
    modes(x, 0, bellModes(f, d / 4.2, 0.9), 1);
    const s = noise(0.03, 'w'); bp(s, Math.min(f * 6, SR * 0.4), 1); mul(s, ad(0.03, 0.0005, 0.006)); mix(x, s, 0, 0.3);
    return finish(x, { rms: 0.22 });
  } },
  // 맑은 작은 종
  chime: { pitched: 1, hi: 1, r: (m) => {
    const f = mtof(m), x = buf(3);
    modes(x, 0, barModes(f, 1.4), 1); modes(x, 0, [[f * 1.0025, 0.5, 1.2]], 1);
    return finish(x, { rms: 0.2 });
  } },
  timp: { pitched: 1, r: (m) => {
    const f = mtof(m), x = buf(2.2);
    modes(x, 0, [[f, 1, 0.65], [f * 1.5, 0.45, 0.4], [f * 1.99, 0.25, 0.3], [f * 2.44, 0.12, 0.2]], 1);
    const s = noise(0.15, 'w'); lp(s, 700); mul(s, ad(0.15, 0.001, 0.025)); mix(x, s, 0, 0.6);
    return finish(x, { rms: 0.22 });
  } },
  // 큰 북(타이코): 아주 낮고 길게
  taiko: { n: 3, r: () => {
    const x = drum(rr(54, 62), 0.42, { bend: 1.45, skin: 900, slap: 0.45 });
    mix(x, boom(1.2, 70, 42, 0.18, 0, 0), 0, 0.6);
    return finish(x, { rms: 0.25 });
  } },
  tom: { n: 3, r: () => finish(drum(rr(105, 125), 0.22, { bend: 1.3, skin: 1500 }), { rms: 0.22 }) },
  // 손북(프레임 드럼): 가볍고 마른 소리
  frame: { n: 3, r: () => finish(drum(rr(165, 190), 0.14, { bend: 1.15, skin: 3200, slap: 0.9, skinT: 0.02 }), { rms: 0.2 }) },
  hand: { n: 3, hi: 1, r: () => finish(drum(rr(230, 270), 0.06, { bend: 1.1, skin: 6000, slap: 1.4, skinT: 0.008 }), { rms: 0.2 }) },
  stick: { n: 3, hi: 1, r: () => { const x = buf(0.2); wood(x, 0, rr(1100, 1500), 1, 0.03); return finish(x, { rms: 0.2 }); } },
  shaker: { n: 2, hi: 1, r: () => {
    const d = 0.14, x = noise(d, 'w'); bp(x, 6500, 1.2); mul(x, env([[0, 0], [0.03, 1], [d, 0]], d));
    return finish(x, { rms: 0.18 });
  } },
  // 징(탐탐): 낮고 어긋난 배음이 길게 운다
  gong: { n: 1, r: () => {
    const x = buf(6.5);
    const m = [[62, 1, 2.5], [91, 0.75, 2.2], [129, 0.6, 2], [161, 0.5, 1.8], [214, 0.38, 1.5], [262, 0.3, 1.3], [347, 0.22, 1.1], [431, 0.15, 0.9], [523, 0.1, 0.8], [690, 0.08, 0.6]];
    modes(x, 0, m.map(([f, a, t]) => [f * rr(0.99, 1.01), a, t]), 1);
    const s = noise(3, 'p'); bp(s, 450, 0.7); mul(s, env([[0, 0], [0.4, 1], [3, 0]], 3)); mix(x, s, 0, 0.25);
    return finish(x, { rms: 0.2 });
  } },
  // 모루·쇠붙이 타격(지옥·우두머리)
  anvil: { n: 2, hi: 1, r: () => { const x = buf(1.5); metal(x, 0, rr(820, 980), 1, 1.6, 4); return finish(x, { rms: 0.2 }); } },
  // 쇠 긁는 소리: 끈적한 마찰이 쇠 공명을 울린다
  scrape: { n: 3, hi: 1, r: () => {
    const d = rr(1.6, 2.6), x = creak(d, [[0, rr(120, 200)], [d * 0.5, rr(260, 420)], [d, rr(150, 220)]], rr(900, 1900), 22, 0.12);
    const s = noise(d, 'w'); bp(s, rr(2500, 3500), 3); mul(s, env([[0, 0], [d * 0.4, 0.3], [d, 0]], d)); mix(x, s, 0, 0.4);
    return finish(x, { rms: 0.16 });
  } },
  // 심장 박동: 쿵-쿵
  heart: { n: 2, r: () => {
    const x = buf(0.8);
    mix(x, boom(0.4, 62, 40, 0.07, 0.3, 200), 0, 1);
    mix(x, boom(0.4, 70, 45, 0.06, 0.3, 200), 0.24, 0.7);
    return finish(x, { rms: 0.22 });
  } },
  // 아주 큰 충격(지옥·우두머리의 강박)
  boom: { n: 2, r: () => {
    const x = buf(3);
    mix(x, boom(2.6, 58, 26, 0.55, 0.8, 500), 0, 1);
    const s = noise(2.5, 'b'); lp(s, 200); mul(s, ad(2.5, 0.01, 0.6)); mix(x, s, 0, 0.6);
    return finish(x, { rms: 0.24 });
  } },
  rattle: { n: 2, hi: 1, r: () => { const x = buf(0.5); bones(x, 0, 0.3, 14, 1); return finish(x, { rms: 0.18 }); } },
};

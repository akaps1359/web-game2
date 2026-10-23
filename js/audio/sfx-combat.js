// 효과음: 플레이어 전투(휘두르기·타격·막기·활·비명·발소리)
import { rnd, rr, pick, N, buf, line, ad, env, mul, mix, drive, noise, osc, hp, bp, voice, whoosh, crackle, boom, finish } from './dsp.js';
import { step, metal, thud, wood, twang, quiver } from './sfx-kit.js';

// 짧은 신음: 변형마다 모음과 높이가 조금씩 다르다
function grunt(f, fs, d, o = {}) {
  const [v0, v1] = pick([['@', 'a'], ['u', '@'], ['a', 'o'], ['e', '@']]);
  return voice(d, {
    f0: [[0, f * 1.2], [0.05, f * 1.32], [d, f * 0.82]], vow: [[0, v0], [0.07, v1], [d, '@']],
    amp: [[0, 0], [0.015, 1], [d * 0.55, 0.65], [d, 0]], rough: 0.55, breath: 0.25, fs, ...o,
  });
}
function scream(f, fs, d, o = {}) {
  return voice(d, {
    f0: [[0, f], [0.1, f * 1.12], [d * 0.6, f * 0.78], [d, f * 0.5]], vow: [[0, 'a'], [d * 0.5, 'a'], [d * 0.8, 'o'], [d, '@']],
    amp: [[0, 0], [0.03, 1], [d * 0.5, 0.8], [d * 0.85, 0.35], [d, 0]], rough: 0.6, breath: 0.3, fs, vib: [5.5, 0.012], ...o,
  });
}

export const COMBAT = {
  swing_light: [{ v: 0.5, rev: 0.08, n: 3, p: 0.06 }, () => {
    const d = rr(0.16, 0.22), x = whoosh(d, [[0, rr(350, 500)], [d * 0.45, rr(1800, 2600)], [d, rr(700, 900)]], 1.6, 0.45);
    mix(x, whoosh(d, [[0, 800], [d * 0.45, 3200], [d, 1500]], 8, 0.5, 'w'), 0, 0.3);
    return finish(x, { rms: 0.2 });
  }],
  swing_heavy: [{ v: 0.55, rev: 0.1, n: 2, p: 0.05 }, () => {
    const d = rr(0.36, 0.44), x = whoosh(d, [[0, 160], [d * 0.55, 900], [d, 300]], 1.0, 0.55);
    mix(x, whoosh(d, [[0, 90], [d * 0.55, 350], [d, 120]], 1.5, 0.55, 'b'), 0, 1.2);
    return finish(x, { rms: 0.22 });
  }],
  // 살: 축축한 쿵 + 질척 + 철썩
  hit_flesh: [{ v: 0.65, rev: 0.12, n: 3, p: 0.07 }, () => {
    const x = buf(0.35);
    mix(x, boom(0.25, rr(85, 110), 45, 0.045, 0.6, 700), 0, 1);
    const d = 0.14, s = noise(d, 'w');
    bp(s, line([[0, 1400], [d, 500]], N(d), true), 1.5);
    let g = 1;
    for (let i = 0; i < s.length; i++) { if ((i & 31) === 0) g = 0.3 + rnd(); s[i] *= g; }
    mul(s, ad(d, 0.001, 0.03)); mix(x, s, 0.003, 0.8);
    const sl = noise(0.02, 'w'); hp(sl, 2000); mul(sl, ad(0.02, 0.0003, 0.004)); mix(x, sl, 0, 0.5);
    return finish(x, { rms: 0.24 });
  }],
  // 뼈: 마르고 날카롭게 딱
  hit_bone: [{ v: 0.6, rev: 0.12, hi: 1, n: 3, p: 0.07 }, () => {
    const x = buf(0.3), c = noise(0.03, 'w');
    bp(c, 2500, 0.8); mul(c, ad(0.03, 0.0002, 0.006)); mix(x, c, 0, 1);
    wood(x, 0, rr(700, 950), 0.9, 0.035); wood(x, 0.004, rr(1500, 1900), 0.5, 0.02);
    mix(x, boom(0.12, 160, 90, 0.025, 0.3, 900), 0, 0.5);
    mix(x, crackle(0.06, 900, 1500, 8000, 0.0004), 0.005, 0.6);
    return finish(x, { rms: 0.24 });
  }],
  hit_metal: [{ v: 0.6, rev: 0.15, hi: 1, n: 3, p: 0.05 }, () => {
    const x = buf(0.7);
    metal(x, 0, rr(380, 560), 1, 0.8, 4);
    mix(x, boom(0.15, 140, 80, 0.03, 0.5, 2000), 0, 0.4);
    const n = noise(0.05, 'w'); bp(n, 4000, 0.7); mul(n, ad(0.05, 0.0005, 0.012)); mix(x, n, 0, 0.6);
    return finish(x, { rms: 0.24 });
  }],
  // 치명타: 더 무겁고 으스러지는 소리
  hit_crit: [{ v: 0.8, rev: 0.15, n: 2, p: 0.05 }, () => {
    const x = buf(0.6);
    mix(x, boom(0.4, 120, 40, 0.08, 1.0, 1000), 0, 1.2);
    const c = crackle(0.15, 2500, 600, 6000, 0.0008); mul(c, env([[0, 1], [0.15, 0]], 0.15)); mix(x, c, 0.003, 1.2);
    const s = noise(0.18, 'w'); bp(s, line([[0, 1800], [0.18, 400]], N(0.18), true), 1.2); mul(s, ad(0.18, 0.001, 0.04)); mix(x, s, 0, 0.8);
    wood(x, 0.01, rr(600, 800), 0.6, 0.03);
    drive(x, 2.5);
    return finish(x, { rms: 0.28 });
  }],
  // 방패: 넓고 낮은 쨍 + 나무 쿵
  block: [{ v: 0.65, rev: 0.15, hi: 1, n: 2, p: 0.04 }, () => {
    const x = buf(0.8);
    metal(x, 0, rr(250, 330), 1, 1.2, 5);
    thud(x, 0, 0.8, 140, 0.04, 900);
    wood(x, 0, rr(180, 230), 0.8, 0.06);
    return finish(x, { rms: 0.25 });
  }],
  bow_shoot: [{ v: 0.55, rev: 0.1, n: 2, p: 0.04 }, () => {
    const x = buf(0.5);
    twang(x, 0, 1);
    return finish(x, { rms: 0.2 });
  }],
  // 화살이 박힘: 퍽 + 부르르 떨림
  arrow_hit: [{ v: 0.55, rev: 0.12, n: 2, p: 0.06 }, () => {
    const x = buf(0.4);
    wood(x, 0, rr(250, 330), 1, 0.05);
    mix(x, boom(0.15, 180, 110, 0.03, 0.8, 1500), 0, 0.8);
    quiver(x, 0.01, 0.8);
    return finish(x, { rms: 0.22 });
  }],
  hurt_male: [{ v: 0.6, rev: 0.08, n: 3, p: 0.03 }, () => finish(grunt(rr(112, 132), 1, rr(0.26, 0.34)), { rms: 0.24 })],
  hurt_female: [{ v: 0.6, rev: 0.08, n: 3, p: 0.03 }, () => finish(grunt(rr(235, 270), 1.17, rr(0.24, 0.3)), { rms: 0.24 })],
  die_male: [{ v: 0.75, rev: 0.2, n: 2, p: 0.02 }, () => finish(scream(rr(150, 170), 1, 1.1, { sub: 0.15 }), { rms: 0.26 })],
  die_female: [{ v: 0.75, rev: 0.2, n: 2, p: 0.02 }, () => finish(scream(rr(330, 370), 1.17, 1.15), { rms: 0.26 })],
  footstep: [{ v: 0.26, rev: 0.06, n: 4, p: 0.08 }, () => {
    const x = buf(0.16);
    step(x, 0, 1, rr(0.85, 1.15));
    return finish(x, { rms: 0.2 });
  }],
  // 마나 부족: 힘없이 꺼지는 치익
  no_mana: [{ v: 0.4, ui: 1, p: 0.03 }, () => {
    const d = 0.45, x = noise(d, 'w');
    bp(x, line([[0, 3000], [d, 900]], N(d), true), 1.5); mul(x, env([[0, 0], [0.02, 1], [d, 0]], d));
    mix(x, crackle(d, 60, 2000, 6000), 0, 0.5);
    const t = osc(d, line([[0, 600], [d, 300]], N(d), true), 'tri'); mul(t, env([[0, 0], [0.02, 0.3], [d, 0]], d)); mix(x, t, 0, 0.5);
    return finish(x, { rms: 0.15 });
  }],
};

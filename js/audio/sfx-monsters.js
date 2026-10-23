// 효과음: 괴물 울음·피격·죽음, 우두머리
import { SR, rnd, rr, pick, N, buf, line, ad, env, mul, mix, noise, osc, fm, hp, bp, voice, whoosh, crackle, boom, finish } from './dsp.js';
import { bones, wood, thud, debris, fwoosh } from './sfx-kit.js';

// 음절 여러 개를 한 목소리로: [시작, 길이, 높이, [모음, 모음], 끝 높이] → 높이·모음·세기 꺾은선
export function syllables(syl, fs, o = {}) {
  const last = syl[syl.length - 1], d = last[0] + last[1] + 0.05, f0 = [], vow = [], amp = [[0, 0]];
  for (const [t, len, f, v, f1 = f * 0.85] of syl) {
    f0.push([t, f], [t + len, f1]);
    vow.push([t, v[0]], [t + len, v[1] || v[0]]);
    amp.push([t, 0], [t + Math.min(0.012, len * 0.2), 1], [t + len * 0.7, 0.7], [t + len, 0]);
  }
  return voice(d, { f0, vow, amp, fs, ...o });
}
function trem(x, hz, depth) { for (let i = 0; i < x.length; i++) x[i] *= 1 - depth + depth * Math.sin(2 * Math.PI * hz * i / SR); return x; }

export const MONSTERS = {
  // 임프: 높고 빠른 '킥킥킥'
  mon_imp: [{ v: 0.5, rev: 0.2, n: 3, p: 0.05 }, () => {
    const k = 4 + Math.floor(rnd() * 3), syl = [];
    let t = 0.01;
    for (let i = 0; i < k; i++) {
      const len = rr(0.05, 0.08), f = rr(430, 620) * (1 + i * 0.03);
      syl.push([t, len, f, pick([['e', 'i'], ['a', 'e'], ['i', 'e']]), f * rr(0.75, 0.9)]);
      t += len + rr(0.025, 0.05);
    }
    const x = syllables(syl, 1.5, { rough: 0.45, breath: 0.15 });
    for (const [t0] of syl) { const c = noise(0.006, 'w'); hp(c, 2500); mix(x, c, t0, 0.5); }
    return finish(x, { rms: 0.22 });
  }],
  mon_imp_flee: [{ v: 0.5, rev: 0.2, n: 2, p: 0.05 }, () => {
    const d = 0.55, f = rr(600, 700);
    return finish(voice(d, { f0: [[0, f], [0.15, f * 1.7], [0.4, f * 1.4], [d, f]], vow: [[0, 'i'], [0.25, 'e'], [d, 'i']], amp: [[0, 0], [0.03, 1], [0.4, 0.8], [d, 0]], fs: 1.6, rough: 0.3, vib: [13, 0.04], breath: 0.1 }), { rms: 0.22 });
  }],
  mon_zombie: [{ v: 0.55, rev: 0.22, n: 3, p: 0.04 }, () => {
    const d = rr(1.1, 1.4), f = rr(68, 82);
    return finish(voice(d, {
      f0: [[0, f], [d * 0.35, f * 1.15], [d, f * 0.8]], vow: [[0, 'u'], [d * 0.4, 'o'], [d * 0.8, '@'], [d, 'u']],
      amp: [[0, 0], [0.15, 0.8], [d * 0.4, 1], [d * 0.85, 0.6], [d, 0]], rough: 0.9, sub: 0.45, breath: 0.4, growl: [rr(18, 26), 0.35], fs: 0.88,
    }), { rms: 0.22 });
  }],
  mon_skel: [{ v: 0.5, rev: 0.2, hi: 1, n: 2, p: 0.05 }, () => {
    const x = buf(0.55);
    bones(x, 0, 0.45, 30, 1);
    wood(x, 0, rr(1100, 1400), 0.8, 0.02);
    return finish(x, { rms: 0.2 });
  }],
  mon_beast: [{ v: 0.6, rev: 0.2, n: 3, p: 0.05 }, () => {
    const d = rr(0.65, 0.8), f = rr(100, 120);
    return finish(voice(d, {
      f0: [[0, f], [0.12, f * 1.35], [d, f * 0.85]], vow: [[0, 'ae'], [0.15, 'a'], [d, 'o']], amp: [[0, 0], [0.04, 1], [d * 0.6, 0.8], [d, 0]],
      rough: 1, growl: [rr(48, 62), 0.7], sub: 0.3, breath: 0.5, fs: 0.85, drive: 1.5,
    }), { rms: 0.25 });
  }],
  // 박쥐: 높게 찍찍거리는 주파수 변조 짹짹
  mon_bat: [{ v: 0.45, rev: 0.18, hi: 1, n: 2, p: 0.06 }, () => {
    const x = buf(0.5), k = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < k; i++) {
      const t = i * rr(0.06, 0.09), d = rr(0.03, 0.05), f = rr(2600, 3600);
      const s = fm(d, line([[0, f], [d, f * rr(1.2, 1.5)]], N(d), true), 1.5, rr(1, 2.5)); mul(s, env([[0, 0], [0.004, 1], [d, 0]], d)); mix(x, s, t, rr(0.6, 1));
    }
    const fl = noise(0.4, 'p'); bp(fl, 1200, 1); trem(fl, 18, 0.8); mul(fl, env([[0, 0], [0.05, 1], [0.4, 0]], 0.4)); mix(x, fl, 0, 0.3);
    return finish(x, { rms: 0.18 });
  }],
  mon_demon: [{ v: 0.7, rev: 0.28, n: 2, p: 0.04 }, () => {
    const d = rr(1.0, 1.25), f = rr(52, 62), x = buf(d + 0.1);
    mix(x, voice(d, {
      f0: [[0, f], [0.2, f * 1.3], [d, f * 0.8]], vow: [[0, 'o'], [0.25, 'a'], [d, 'o']], amp: [[0, 0], [0.08, 1], [d * 0.7, 0.85], [d, 0]],
      rough: 1, sub: 0.8, growl: [rr(26, 34), 0.5], breath: 0.3, fs: 0.7, drive: 2.5,
    }), 0, 1);
    mix(x, boom(0.8, 60, 40, 0.25, 0.2, 300), 0, 0.5);
    return finish(x, { rms: 0.27 });
  }],
  // 염소인간: 짧은 콧김 + 떨리는 '매애'
  mon_goat: [{ v: 0.55, rev: 0.2, n: 3, p: 0.04 }, () => {
    const d = rr(0.55, 0.7), f = rr(190, 230), x = buf(d + 0.12);
    mix(x, voice(0.1, { f0: [[0, 120], [0.1, 100]], vow: [[0, '@']], amp: [[0, 0], [0.01, 1], [0.1, 0]], rough: 0.8, breath: 0.4, fs: 0.95 }), 0, 0.6);
    mix(x, voice(d, {
      f0: [[0, f], [0.08, f * 1.15], [d, f * 0.8]], vow: [[0, 'ae'], [0.15, 'e'], [d, '@']], amp: [[0, 0], [0.03, 1], [d * 0.7, 0.8], [d, 0]],
      vib: [rr(8, 11), 0.06], rough: 0.6, sub: 0.3, fs: 1.0, drive: 1.3,
    }), 0.08, 1);
    return finish(x, { rms: 0.24 });
  }],
  mon_hit_small: [{ v: 0.5, rev: 0.12, n: 3, p: 0.06 }, () => {
    const d = rr(0.15, 0.22), f = rr(280, 360);
    return finish(voice(d, { f0: [[0, f * 1.2], [d, f * 0.8]], vow: [[0, 'a'], [d, '@']], amp: [[0, 0], [0.01, 1], [d, 0]], rough: 0.6, breath: 0.2, fs: 1.3 }), { rms: 0.22 });
  }],
  mon_hit_big: [{ v: 0.6, rev: 0.15, n: 3, p: 0.05 }, () => {
    const d = rr(0.26, 0.34), f = rr(95, 120);
    return finish(voice(d, { f0: [[0, f * 1.25], [d, f * 0.75]], vow: [[0, 'a'], [d, 'u']], amp: [[0, 0], [0.015, 1], [d * 0.5, 0.7], [d, 0]], rough: 0.9, sub: 0.4, growl: [40, 0.4], breath: 0.3, fs: 0.82, drive: 1.4 }), { rms: 0.24 });
  }],
  mon_die_small: [{ v: 0.55, rev: 0.2, n: 2, p: 0.05 }, () => {
    const d = rr(0.6, 0.75), f = rr(380, 460);
    return finish(voice(d, { f0: [[0, f], [0.08, f * 1.25], [d, f * 0.45]], vow: [[0, 'a'], [d * 0.5, 'o'], [d, 'u']], amp: [[0, 0], [0.02, 1], [d * 0.5, 0.7], [d, 0]], rough: 0.7, growl: [rr(15, 20), 0.45], breath: 0.25, fs: 1.35 }), { rms: 0.23 });
  }],
  mon_die_big: [{ v: 0.7, rev: 0.25, n: 2, p: 0.04 }, () => {
    const d = 1.35, f = rr(105, 125), x = buf(d + 0.3);
    mix(x, voice(d, { f0: [[0, f], [0.15, f * 1.15], [d, f * 0.42]], vow: [[0, 'a'], [d * 0.5, 'o'], [d, 'u']], amp: [[0, 0], [0.04, 1], [d * 0.6, 0.7], [d, 0]], rough: 1, sub: 0.5, growl: [rr(22, 28), 0.5], breath: 0.4, fs: 0.8, drive: 1.5 }), 0, 1);
    thud(x, 0.95, 0.9, 80, 0.07, 500); debris(x, 0.97, 0.3, 10, 0.3);
    return finish(x, { rms: 0.26 });
  }],
  // 해골이 무너짐: 우르르 + 바닥에서 튀는 뼈들 + 두개골
  mon_die_bone: [{ v: 0.6, rev: 0.22, hi: 1, n: 2, p: 0.04 }, () => {
    const x = buf(1.2);
    bones(x, 0, 0.25, 25, 1);
    for (let k = 0; k < 6; k++) {
      let t = rr(0.15, 0.35), a = rr(0.5, 0.9), g = rr(0.08, 0.14);
      const f = rr(800, 2200);
      for (let b = 0; b < 4 && t < 1.1; b++) { wood(x, t, f * rr(0.97, 1.03), a, 0.02); t += g; g *= 0.6; a *= 0.5; }
    }
    wood(x, 0.45, rr(500, 650), 0.9, 0.05);
    thud(x, 0.12, 0.5, 120, 0.04, 800);
    return finish(x, { rms: 0.24 });
  }],
  mon_die_demon: [{ v: 0.8, rev: 0.32, p: 0.03 }, () => {
    const d = 1.7, x = buf(d + 0.2), f = rr(62, 72);
    mix(x, voice(d, { f0: [[0, f], [0.2, f * 1.25], [d, f * 0.45]], vow: [[0, 'a'], [d * 0.5, 'o'], [d, 'u']], amp: [[0, 0], [0.06, 1], [d * 0.6, 0.8], [d, 0]], rough: 1, sub: 0.9, growl: [rr(24, 30), 0.55], breath: 0.35, fs: 0.68, drive: 2.5 }), 0, 1);
    mix(x, fwoosh(1.2, 150, 900), 0.4, 0.5);
    mix(x, boom(1.0, 70, 30, 0.3, 0.5, 400), 0.5, 0.7);
    return finish(x, { rms: 0.28 });
  }],
  // 할퀴기: 빠른 휙 + 긁힘
  mon_attack: [{ v: 0.5, rev: 0.12, n: 3, p: 0.06 }, () => {
    const d = rr(0.18, 0.24), x = whoosh(d, [[0, 500], [d * 0.5, 2800], [d, 900]], 1.8, 0.5);
    const s = noise(0.08, 'w'); bp(s, 3500, 2); trem(s, 90, 0.6); mul(s, ad(0.08, 0.002, 0.02)); mix(x, s, d * 0.45, 0.5);
    return finish(x, { rms: 0.2 });
  }],
  mon_cast: [{ v: 0.55, rev: 0.3, n: 2, p: 0.04 }, () => {
    const d = 0.9, x = buf(d);
    mix(x, whoosh(0.7, [[0, 200], [0.5, 900], [0.7, 400]], 1.2, 0.6), 0, 0.8);
    for (const f of [698.5, 740]) { const s = osc(d, f * rr(0.99, 1.01)); trem(s, 9, 0.5); mul(s, env([[0, 0], [0.3, 0.4], [d, 0]], d)); mix(x, s, 0, 0.3); }
    mix(x, mul(crackle(d, 40, 1000, 5000), env([[0, 0], [0.4, 1], [d, 0]], d)), 0, 0.5);
    return finish(x, { rms: 0.2 });
  }],
  // 우두머리 포효: 아주 낮은 목소리 세 겹 + 땅울림
  boss_roar: [{ v: 1.0, rev: 0.35, p: 0.02 }, () => {
    const d = 2.6, x = buf(d + 0.3);
    for (const [k, g] of [[1, 1], [1.5, 0.45], [0.5, 0.6]]) {
      const f = 46 * k;
      mix(x, voice(d, {
        f0: [[0, f * 0.85], [0.35, f * 1.3], [1.8, f * 1.1], [d, f * 0.7]], vow: [[0, 'o'], [0.3, 'a'], [1.6, 'a'], [d, 'o']],
        amp: [[0, 0], [0.25, 1], [1.7, 0.9], [d, 0]], rough: 1, sub: 1, growl: [rr(22, 30), 0.6], breath: 0.4, fs: 0.6 + 0.05 * k, drive: 3,
      }), rr(0, 0.05), g);
    }
    mix(x, boom(2.0, 55, 30, 0.6, 0.3, 200), 0.1, 0.6);
    return finish(x, { rms: 0.3 });
  }],
  // 낮게 끊어 웃는 소리: 흐-흐-흐-하아
  boss_laugh: [{ v: 0.9, rev: 0.4, p: 0 }, () => {
    const syl = [[0.0, 0.16, 98, ['a', '@']], [0.26, 0.15, 93, ['a', '@']], [0.5, 0.15, 89, ['a', '@']], [0.73, 0.16, 86, ['a', '@']], [0.98, 0.7, 104, ['a', 'o'], 62]];
    return finish(syllables(syl, 0.75, { rough: 0.8, sub: 0.6, breath: 0.5, growl: [30, 0.3], drive: 2 }), { rms: 0.28 });
  }],
};

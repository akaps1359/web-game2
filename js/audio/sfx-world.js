// 효과음: 세계(문·상자·통·성소·차원문·계단·덫)와 배경 분위기의 가끔 들리는 소리(물방울·신음·까마귀…)
import { SR, rnd, rr, pick, N, buf, line, ad, env, mul, mix, drive, noise, osc, lp1, hp, bp, lp, click, ks, modes, barModes, bellModes, choir, voice, formant, whoosh, sparkle, boom, finish, ping } from './dsp.js';
import { creak, step, metal, thud, wood, bones, debris, fire, fwoosh, bubbles } from './sfx-kit.js';
import { syllables } from './sfx-monsters.js';

// 돌 뚜껑이 긁히며 미끄러짐(거친 갈색 잡음 + 낮은 울림)
function grind(d, a = 1) {
  const n = N(d), g = noise(d, 'b'), g2 = noise(d, 'w');
  bp(g2, 700, 1.2);
  let k = 0.5, tk = 0.5;
  for (let i = 0; i < n; i++) { if ((i & 255) === 0) tk = 0.2 + rnd() * rnd() * 1.6; k += (tk - k) * 0.02; g[i] = (g[i] * 1.2 + g2[i] * 0.6) * k * a; }
  lp(g, 900);
  return mul(g, env([[0, 0], [0.15, 1], [d - 0.2, 0.9], [d, 0]], d));
}
// 속삭임: 숨소리를 모음 모양으로 거른 음절들
function whisper(d, k) {
  const n = N(d), src = noise(d, 'w'), vw = [], amp = [[0, 0]];
  let t = rr(0.05, 0.2);
  for (let i = 0; i < k && t < d - 0.15; i++) {
    const len = rr(0.08, 0.2);
    vw.push([t, pick(['a', 'e', 'i', 'o', 'u', '@'])]);
    amp.push([t, 0], [t + 0.02, rr(0.5, 1)], [t + len, 0]);
    if (rnd() < 0.3) amp.push([t + len + 0.01, 0], [t + len + 0.03, 0.5], [t + len + 0.09, 0]); // ㅅ 소리
    t += len + rr(0.03, 0.12);
  }
  mul(src, line(amp, n, false));
  const y = formant(src, vw.length ? vw : [[0, 'a']], rr(1.0, 1.2));
  const s = noise(d, 'w'); hp(s, 4500); mul(s, line(amp, n, false)); mix(y, s, 0, 0.15);
  return y;
}
// 멀리서 들리게: 높은 소리를 깎는다
const far = (x, f = 2200) => lp(lp1(x, f * 1.5), f, 0.6);

export const WORLD = {
  door_open: [{ v: 0.55, rev: 0.25, n: 2, p: 0.04 }, () => {
    const x = buf(1.2);
    modes(x, 0, [[1800, 1, 0.02], [3300, 0.5, 0.012]], 0.5); mix(x, click(0.4), 0, 0.3);
    mix(x, creak(0.85, [[0, rr(35, 45)], [0.3, rr(80, 100)], [0.6, rr(55, 70)], [0.85, rr(90, 120)]], rr(550, 750), 6), 0.06, 0.8);
    return finish(x, { rms: 0.2 });
  }],
  door_close: [{ v: 0.6, rev: 0.25, n: 2, p: 0.04 }, () => {
    const x = buf(0.9);
    mix(x, creak(0.3, [[0, 90], [0.3, 50]], rr(600, 750), 6), 0, 0.5);
    thud(x, 0.3, 1.2, 110, 0.06, 900); wood(x, 0.3, 230, 0.8, 0.07);
    modes(x, 0.34, [[2100, 1, 0.025], [3700, 0.5, 0.015]], 0.4);
    return finish(x, { rms: 0.24 });
  }],
  // 상자: 자물쇠 철컥 + 경첩 삐걱 + 뚜껑 넘어감
  chest_open: [{ v: 0.6, rev: 0.2, n: 2, p: 0.04 }, () => {
    const x = buf(1.2);
    modes(x, 0, [[2300, 1, 0.03], [3900, 0.6, 0.02], [1500, 0.5, 0.03]], 0.7); mix(x, click(0.3), 0, 0.4);
    mix(x, creak(0.6, [[0, 110], [0.3, 170], [0.6, 120]], rr(1200, 1500), 8), 0.12, 0.6);
    thud(x, 0.8, 0.7, 130, 0.05, 800); wood(x, 0.8, 260, 0.5, 0.06);
    return finish(x, { rms: 0.22 });
  }],
  barrel_break: [{ v: 0.7, rev: 0.22, n: 2, p: 0.05 }, () => {
    const x = buf(0.9);
    thud(x, 0, 1, 120, 0.05, 1200);
    for (let i = 0; i < 30; i++) { const t = Math.pow(rnd(), 2) * 0.5; wood(x, t, rr(220, 1300), rr(0.2, 0.9) * (1 - t), rr(0.02, 0.06)); }
    const n = noise(0.25, 'p'); bp(n, 1500, 0.6); mul(n, ad(0.25, 0.001, 0.05)); mix(x, n, 0, 0.8);
    metal(x, 0.15, rr(500, 600), 0.2, 0.6, 1);
    return finish(x, { rms: 0.26 });
  }],
  barrel_explode: [{ v: 0.9, rev: 0.3, p: 0.04 }, () => {
    const x = buf(1.6);
    mix(x, boom(1.2, 90, 30, 0.28, 1, 1200), 0, 1.3);
    const b = noise(1.0, 'w'); lp(b, line([[0, 6000], [0.2, 1000], [1.0, 300]], N(1.0), true), 0.7); mul(b, ad(1.0, 0.002, 0.15)); mix(x, b, 0, 1);
    for (let i = 0; i < 30; i++) { const t = Math.pow(rnd(), 2) * 0.6; wood(x, t, rr(220, 1300), rr(0.2, 0.7) * (1 - t), 0.04); }
    mix(x, mul(fire(1.5, 1, 50), env([[0, 0], [0.05, 1], [1.5, 0]], 1.5)), 0, 0.6);
    drive(x, 2);
    return finish(x, { rms: 0.3 });
  }],
  // 성소: 신비로운 합창 화음(라 서스) + 종 + 반짝임
  shrine: [{ v: 0.65, rev: 0.4, p: 0 }, () => {
    const x = buf(3.0);
    mix(x, choir(2.8, [146.8, 220, 293.7, 329.6, 440, 587.3], { amp: [[0, 0], [0.5, 1], [1.8, 0.8], [2.8, 0]], vow: [[0, 'o'], [1.0, 'a'], [2.8, 'o']], breath: 0.1 }), 0, 0.6);
    modes(x, 0, bellModes(293.7, 0.8, 0.5), 0.3);
    sparkle(x, 0.3, 2.0, 18, 0, 0, 0.25, 0.25, [1174.7, 1318.5, 1760, 2349.3]);
    return finish(x, { rms: 0.22 });
  }],
  portal_open: [{ v: 0.65, rev: 0.35, hi: 1, p: 0 }, () => {
    const d = 1.9, n = N(d), x = buf(d);
    mix(x, whoosh(1.6, [[0, 200], [1.6, 3000]], 1.2, 0.9), 0, 0.8);
    for (const k of [1, 1.26, 1.5]) {
      const o = osc(d, line([[0, 110 * k], [1.5, 440 * k], [d, 440 * k]], n, true), 'saw');
      lp(o, line([[0, 300], [1.5, 3000], [d, 1500]], n, true), 1.5); mul(o, env([[0, 0], [1.2, 0.8], [1.6, 1], [d, 0]], d)); mix(x, o, 0, 0.18);
    }
    sparkle(x, 0.6, 1.2, 20, 1500, 7000, 0.12, 0.35);
    mix(x, boom(0.6, 80, 50, 0.15, 0.3, 300), 1.35, 0.5);
    return finish(x, { rms: 0.24 });
  }],
  portal_enter: [{ v: 0.65, rev: 0.3, hi: 1, p: 0 }, () => {
    const x = buf(1.1);
    mix(x, whoosh(0.7, [[0, 3500], [0.7, 300]], 1.2, 0.3), 0, 0.9);
    mix(x, boom(0.8, 130, 40, 0.18, 0.4, 300), 0.15, 0.9);
    sparkle(x, 0, 0.6, 14, 1500, 6000, 0.1, 0.3);
    return finish(x, { rms: 0.24 });
  }],
  waypoint: [{ v: 0.65, rev: 0.35, hi: 1, p: 0 }, () => {
    const d = 2.0, x = buf(d), h = osc(d, 82.4);
    mul(h, env([[0, 0], [0.3, 1], [1.2, 0.7], [d, 0]], d)); mix(x, h, 0, 0.5);
    mix(x, whoosh(0.8, [[0, 600], [0.8, 6000]], 1.3, 0.85, 'w'), 0, 0.5);
    [659.3, 987.8, 1318.5, 1661.2, 1975.5].forEach((f, i) => modes(x, 0.55 + i * 0.03, barModes(f, 1.0), 0.45));
    sparkle(x, 0.55, 1.2, 22, 0, 0, 0.2, 0.3, [2637, 3322.4, 3951, 5274]);
    return finish(x, { rms: 0.22 });
  }],
  // 계단: 내려가며 멀어지는 발소리 넷
  stairs: [{ v: 0.55, rev: 0.3, p: 0.03 }, () => {
    const x = buf(1.4);
    for (let i = 0; i < 4; i++) step(x, i * 0.3 + rr(-0.02, 0.02), 1 - i * 0.17, 1 - i * 0.12);
    return finish(x, { rms: 0.2 });
  }],
  lever: [{ v: 0.6, rev: 0.25, p: 0.03 }, () => {
    const x = buf(0.9);
    for (let i = 0; i < 5; i++) modes(x, i * 0.035, [[rr(1800, 2200), 1, 0.012], [3100, 0.5, 0.008]], 0.35 + i * 0.05);
    thud(x, 0.25, 1.1, 90, 0.06, 700); metal(x, 0.25, 280, 0.5, 0.8, 2);
    return finish(x, { rms: 0.24 });
  }],
  sarcophagus: [{ v: 0.7, rev: 0.3, p: 0.03 }, () => {
    const d = 1.9, n = N(d), x = buf(d + 0.4);
    mix(x, grind(d), 0, 1);
    const r = osc(d, line([[0, 55], [d, 48]], n, true), 'saw'); lp(r, 200); mul(r, env([[0, 0], [0.2, 0.4], [d - 0.2, 0.3], [d, 0]], d)); mix(x, r, 0, 0.5);
    thud(x, d - 0.05, 1.4, 70, 0.09, 600); debris(x, d, 0.35, 15, 0.4);
    return finish(x, { rms: 0.24 });
  }],
  trap_trigger: [{ v: 0.6, rev: 0.2, n: 2, p: 0.04 }, () => {
    const x = buf(0.6);
    modes(x, 0, [[1400, 1, 0.03], [2600, 0.6, 0.02], [4100, 0.4, 0.012]], 0.8); mix(x, click(0.4), 0, 0.5);
    mix(x, whoosh(0.3, [[0, 800], [0.12, 4000], [0.3, 1500]], 1.6, 0.4), 0.08, 0.9);
    mix(x, ks(0.25, 180, { t60: 0.2, b: 0.25 }), 0.07, 0.3);
    return finish(x, { rms: 0.22 });
  }],
};

// 배경 분위기의 가끔 들리는 소리(공개 이름 목록에는 넣지 않는다)
export const AMB = {
  amb_drip: [{ hi: 1, n: 4 }, () => {
    const x = buf(0.4), f = rr(900, 2300);
    mix(x, click(0.2, 1), 0, 0.2);
    ping(x, 0.001, f, 1, rr(0.02, 0.04), 0.001, f * rr(1.6, 2.5));
    return finish(x, { rms: 0.15 });
  }],
  amb_moan: [{ n: 3 }, () => {
    const d = rr(2.2, 3), f = rr(140, 200);
    return finish(far(voice(d, { f0: [[0, f], [d * 0.4, f * 1.25], [d * 0.7, f * 1.1], [d, f * 0.8]], vow: [[0, 'u'], [d * 0.5, 'o'], [d, 'u']], amp: [[0, 0], [d * 0.35, 1], [d * 0.7, 0.7], [d, 0]], breath: 0.5, vib: [4, 0.02], rough: 0.3, fs: rr(1, 1.1) }), 1800), { rms: 0.15 });
  }],
  amb_chain: [{ hi: 1, n: 2 }, () => {
    const x = buf(1.0);
    for (let i = 0; i < 35; i++) { const t = Math.pow(rnd(), 1.3) * 0.8, f = rr(1800, 5500); modes(x, t, [[f, 1, rr(0.01, 0.04)], [f * rr(1.4, 2.1), 0.5, 0.015]], rr(0.1, 0.4)); }
    metal(x, 0.05, rr(400, 500), 0.25, 0.4, 1);
    return finish(x, { rms: 0.15 });
  }],
  amb_stone: [{ n: 2 }, () => {
    const x = buf(1.2);
    mix(x, grind(0.7, 0.8), 0, 0.8); debris(x, 0.5, 0.5, 12, 0.5);
    return finish(x, { rms: 0.15 });
  }],
  amb_door: [{ n: 2 }, () => {
    const x = buf(1.6);
    mix(x, creak(1.0, [[0, 30], [0.5, 70], [1.0, 45]], rr(500, 700), 6), 0, 0.7);
    thud(x, 1.05, 0.9, 100, 0.07, 600);
    return finish(far(x, 2500), { rms: 0.15 });
  }],
  amb_whisper: [{ n: 3 }, () => finish(whisper(rr(1.4, 2), 7), { rms: 0.13 })],
  amb_bones: [{ hi: 1, n: 2 }, () => { const x = buf(0.8); bones(x, 0, 0.6, 18, 1); return finish(x, { rms: 0.14 }); }],
  amb_scream: [{ n: 3 }, () => {
    const d = rr(1.0, 1.4), f = rr(420, 600);
    return finish(far(voice(d, { f0: [[0, f], [0.12, f * 1.2], [d * 0.6, f * 0.9], [d, f * 0.6]], vow: [[0, 'a'], [d * 0.6, 'a'], [d, 'o']], amp: [[0, 0], [0.05, 1], [d * 0.6, 0.8], [d, 0]], vib: [6, 0.02], rough: 0.5, breath: 0.2, fs: 1.15 }), 2000), { rms: 0.15 });
  }],
  // 쇠 긁힘: 끈적한 마찰이 금속 공명을 울린다
  amb_scrape: [{ hi: 1, n: 2 }, () => {
    const d = rr(1.0, 1.5), x = creak(d, [[0, rr(150, 250)], [d * 0.5, rr(300, 450)], [d, rr(180, 260)]], rr(1300, 2200), 25, 0.15);
    const y = buf(d); modes(y, 0.02, [[rr(1800, 2400), 0.3, 0.6], [rr(3000, 3800), 0.2, 0.4]], 1); mix(x, y, 0, 0.3);
    return finish(x, { rms: 0.13 });
  }],
  amb_rocks: [{ n: 2 }, () => { const x = buf(1.2); debris(x, 0, 0.9, 30, 1); thud(x, 0.1, 0.6, 90, 0.05, 500); return finish(x, { rms: 0.15 }); }],
  amb_rumble: [{ n: 2 }, () => {
    const d = rr(2.5, 3.5), x = noise(d, 'b');
    lp(x, 110, 0.8); mul(x, env([[0, 0], [d * 0.4, 1], [d, 0]], d));
    return finish(x, { rms: 0.2 });
  }],
  amb_growl: [{ n: 2 }, () => {
    const d = rr(1.2, 1.6), f = rr(65, 80);
    return finish(far(voice(d, { f0: [[0, f], [d * 0.4, f * 1.2], [d, f * 0.8]], vow: [[0, 'o'], [d * 0.5, 'a'], [d, 'u']], amp: [[0, 0], [0.2, 1], [d * 0.7, 0.8], [d, 0]], rough: 1, growl: [rr(28, 36), 0.6], sub: 0.6, breath: 0.4, fs: 0.75, drive: 1.6 }), 1400), { rms: 0.15 });
  }],
  amb_bat: [{ hi: 1, n: 2 }, () => {
    const d = 0.7, x = noise(d, 'p');
    bp(x, 900, 1.2);
    for (let i = 0; i < x.length; i++) x[i] *= Math.max(0, Math.sin(2 * Math.PI * 14 * i / SR));
    mul(x, env([[0, 0], [0.1, 1], [d, 0]], d));
    for (let i = 0; i < 2; i++) ping(x, rr(0.1, 0.5), rr(3500, 5000), 0.3, 0.015, 0.002, rr(4500, 6000));
    return finish(x, { rms: 0.12 });
  }],
  amb_crow: [{ n: 3 }, () => {
    const k = 2 + Math.floor(rnd() * 2), syl = [];
    for (let i = 0; i < k; i++) { const f = rr(430, 520); syl.push([i * rr(0.38, 0.48), rr(0.2, 0.28), f, ['a', 'a'], f * 0.85]); }
    return finish(far(syllables(syl, 1.55, { rough: 1, breath: 0.6, drive: 2 }), 3500), { rms: 0.15 });
  }],
  amb_owl: [{ n: 2 }, () => {
    const syl = [[0, 0.3, 390, ['u', 'u'], 370], [0.45, 0.22, 380, ['u', 'u'], 360], [0.75, 0.45, 385, ['u', 'u'], 350]];
    return finish(far(syllables(syl, 1.25, { breath: 0.35 }), 1500), { rms: 0.12 });
  }],
  amb_bell: [{ n: 2 }, () => {
    const x = buf(6), f = pick([196, 220, 174.6]);
    modes(x, 0, bellModes(f, 1.4, 0.8), 1);
    return finish(far(x, 2500), { rms: 0.15 });
  }],
  amb_gust: [{ n: 2 }, () => {
    const d = rr(2.5, 3.5), x = noise(d, 'p');
    bp(x, line([[0, 350], [d * 0.45, rr(900, 1300)], [d, 450]], N(d), true), 0.9); mul(x, env([[0, 0], [d * 0.45, 1], [d, 0]], d));
    return finish(x, { rms: 0.16 });
  }],
  amb_creak: [{ n: 2 }, () => finish(creak(rr(1.0, 1.4), [[0, rr(18, 25)], [0.5, rr(35, 45)], [1.0, 22]], rr(420, 560), 5), { rms: 0.13 })],
  amb_lava: [{ n: 2 }, () => {
    const x = buf(1.2);
    bubbles(x, 0, 0.8, 8, 1, 60, 180);
    const h = noise(1.0, 'w'); hp(h, 2500); mul(h, env([[0, 0], [0.2, 0.3], [1.0, 0]], 1.0)); mix(x, h, 0.1, 0.3);
    return finish(x, { rms: 0.16 });
  }],
  // 고통받는 영혼들: 여러 목소리가 길게 운다
  amb_wail: [{ n: 2 }, () => {
    const d = rr(2.5, 3.2), x = buf(d);
    for (let k = 0; k < 3; k++) {
      const f = rr(220, 380);
      mix(x, voice(d, { f0: [[0, f], [d * rr(0.3, 0.6), f * rr(1.1, 1.3)], [d, f * 0.75]], vow: [[0, 'o'], [d * 0.5, pick(['a', 'u'])], [d, 'o']], amp: [[0, 0], [d * rr(0.3, 0.5), 1], [d, 0]], breath: 0.4, vib: [rr(4, 6), 0.02], rough: 0.4, fs: rr(1.05, 1.2) }), 0, 0.5);
    }
    return finish(far(x, 2000), { rms: 0.15 });
  }],
  amb_fire: [{ n: 2 }, () => finish(fwoosh(rr(1.0, 1.4), 150, 800), { rms: 0.16 })],
  amb_water: [{ hi: 1, n: 2 }, () => {
    const x = buf(2.2);
    for (let i = 0; i < 30; i++) { const f = rr(700, 2200); ping(x, rnd() * 2, f, rr(0.2, 1), rr(0.008, 0.02), 0.001, f * rr(1.3, 1.8)); }
    return finish(x, { rms: 0.12 });
  }],
};

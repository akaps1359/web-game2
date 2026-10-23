// 효과음: 기술·주문(불·번개·얼음·외침·화살·저주). loop: 1은 이음매 없이 반복되는 소리
import { SR, rnd, rr, N, buf, line, ad, env, mul, mix, drive, noise, osc, fm, lp1, hp, bp, lp, click, ks, modes, barModes, choir, voice, formant, whoosh, crackle, sparkle, boom, finish, loopify, level } from './dsp.js';
import { fire, fwoosh, zap, crack, twang, shards, bubbles, debris, thud } from './sfx-kit.js';

// 반복 소리용: 끝을 넘친 부분은 앞으로 감아 더한다(이음매가 없다)
function wrap(dst, src, at, g = 1) { const L = dst.length, o = Math.round(at * SR) + L; for (let i = 0; i < src.length; i++) dst[(o + i) % L] += src[i] * g; }
// 얼음바람: 분홍 잡음을 높은 띠로 걸러 천천히 일렁이게
function icewind(d) {
  const n = N(d), x = noise(d, 'p'), y = noise(d, 'w');
  bp(x, line([[0, 900], [d * 0.3, 1600], [d * 0.6, 1100], [d, 1400]], n, true), 0.8);
  bp(y, 5000, 1.5);
  let g = 0.7, tg = 0.7;
  for (let i = 0; i < n; i++) { if ((i & 1023) === 0) tg = 0.4 + rnd() * 0.8; g += (tg - g) * 0.0015; x[i] = x[i] * g + y[i] * 0.25 * g; }
  return x;
}
// 떨림(트레몰로)을 곱한다
function trem(x, hz, depth, ph = 0) { for (let i = 0; i < x.length; i++) x[i] *= 1 - depth + depth * Math.sin(2 * Math.PI * hz * i / SR + ph); return x; }

export const SPELLS = {
  cast_fire: [{ v: 0.55, rev: 0.25, n: 2, p: 0.04 }, () => {
    const x = buf(0.8);
    mix(x, fwoosh(0.6, 200, 1500), 0, 1);
    mix(x, boom(0.3, 90, 50, 0.08, 0, 0), 0, 0.4);
    const r = fire(0.7, 0.6, 30); mul(r, env([[0, 0], [0.15, 1], [0.7, 0]], 0.7)); mix(x, r, 0.05, 0.6);
    return finish(x);
  }],
  fire_bolt: [{ v: 0.6, rev: 0.22, n: 2, p: 0.05 }, () => {
    const d = 0.55, x = fwoosh(d, 400, 2200);
    mix(x, whoosh(d, [[0, 1200], [d * 0.3, 3000], [d, 900]], 2, 0.3), 0, 0.5);
    return finish(x);
  }],
  fireball_explode: [{ v: 0.85, rev: 0.3, n: 2, p: 0.05 }, () => {
    const x = buf(1.6);
    mix(x, boom(1.2, 85, 30, 0.3, 1.0, 1200), 0, 1.2);
    const b = noise(1.2, 'w'); lp(b, line([[0, 5000], [0.3, 900], [1.2, 300]], N(1.2), true), 0.7); mul(b, ad(1.2, 0.002, 0.2)); mix(x, b, 0, 1);
    mix(x, mul(fire(1.4, 1, 60), env([[0, 0], [0.05, 1], [1.4, 0]], 1.4)), 0.02, 0.6);
    drive(x, 1.8);
    return finish(x, { rms: 0.3 });
  }],
  fire_wall: [{ v: 0.7, rev: 0.3, p: 0.04 }, () => {
    const d = 1.5, x = buf(d);
    mix(x, fwoosh(0.7, 150, 1200), 0, 1);
    const r = fire(d, 1, 40); mul(r, env([[0, 0], [0.25, 1], [0.9, 0.8], [d, 0]], d)); mix(x, r, 0, 1);
    return finish(x, { rms: 0.26 });
  }],
  fire_loop: [{ v: 0.5, rev: 0.25, loop: 1 }, () => level(loopify(fire(3.4, 1, 25), 0.4), 0.2)],
  // 운석: 아래로 떨어지는 휘파람 + 커지는 불길
  meteor_fall: [{ v: 0.65, rev: 0.3, p: 0.03 }, () => {
    const d = 1.6, n = N(d), x = buf(d);
    const w = noise(d, 'w'); bp(w, line([[0, 2600], [d, 350]], n, true), 9); mul(w, env([[0, 0], [0.3, 0.6], [d * 0.9, 1], [d, 0]], d)); mix(x, w, 0, 1);
    const t = osc(d, line([[0, 1700], [d, 280]], n, true)); mul(t, env([[0, 0], [0.3, 0.12], [d * 0.9, 0.2], [d, 0]], d)); mix(x, t, 0, 1);
    const r = fire(d, 0.8, 20); mul(r, env([[0, 0], [d * 0.95, 1], [d, 0]], d)); mix(x, r, 0, 0.7);
    return finish(x, { rms: 0.22 });
  }],
  meteor_impact: [{ v: 0.95, rev: 0.35, p: 0.03 }, () => {
    const x = buf(3);
    mix(x, boom(2.5, 70, 22, 0.6, 1.0, 900), 0, 1.4);
    const b = noise(2.5, 'w'); lp(b, line([[0, 6000], [0.25, 1200], [2.5, 200]], N(2.5), true), 0.7); mul(b, ad(2.5, 0.003, 0.35)); mix(x, b, 0, 1.2);
    debris(x, 0.1, 1.6, 50, 0.8);
    mix(x, mul(fire(2.8, 1, 50), env([[0, 0], [0.1, 1], [2.8, 0]], 2.8)), 0, 0.6);
    drive(x, 2.2);
    return finish(x, { rms: 0.32 });
  }],
  cast_lightning: [{ v: 0.55, rev: 0.22, hi: 1, n: 2, p: 0.04 }, () => {
    const d = 0.6, n = N(d), x = zap(d, 500, 90);
    mul(x, env([[0, 0.1], [d * 0.8, 1], [d, 0]], d));
    const w = fm(d, line([[0, 400], [d, 1600]], n, true), 1.5, 2); mul(w, env([[0, 0], [d * 0.8, 0.25], [d, 0]], d)); mix(x, w, 0, 1);
    return finish(x, { rms: 0.2 });
  }],
  lightning: [{ v: 0.7, rev: 0.3, hi: 1, n: 2, p: 0.04 }, () => {
    const x = buf(1.2);
    crack(x, 0, 1, 0.5); crack(x, 0.07, 0.6, 0.3);
    mix(x, mul(noise(1.0, 'b'), ad(1.0, 0.05, 0.3)), 0.05, 0.6);
    return finish(x, { rms: 0.26 });
  }],
  charged_bolt: [{ v: 0.55, rev: 0.2, hi: 1, n: 2, p: 0.05 }, () => {
    const x = buf(0.7);
    for (let k = 0; k < 5; k++) {
      const t = k * rr(0.05, 0.08), d = rr(0.07, 0.12), f = rr(1800, 3200);
      const s = fm(d, line([[0, f], [d, f * rr(1.3, 1.8)]], N(d), true), rr(1.4, 2.1), rr(2, 4)); mul(s, ad(d, 0.002, d * 0.4)); mix(x, s, t, 0.5);
      const z = crackle(d, 1500, 2000, 9000, 0.0003); mul(z, ad(d, 0.001, d * 0.3)); mix(x, z, t, 0.8);
    }
    return finish(x, { rms: 0.2 });
  }],
  chain_lightning: [{ v: 0.7, rev: 0.3, hi: 1, p: 0.04 }, () => {
    const x = buf(1.3);
    for (const [t, a] of [[0, 1], [0.16, 0.8], [0.34, 0.65], [0.5, 0.5]]) crack(x, t, a, 0.28);
    return finish(x, { rms: 0.26 });
  }],
  nova: [{ v: 0.75, rev: 0.3, hi: 1, p: 0.04 }, () => {
    const x = buf(1.0);
    crack(x, 0, 1, 0.35);
    const w = noise(0.9, 'w'); bp(w, line([[0, 5000], [0.9, 600]], N(0.9), true), 1.2); mul(w, ad(0.9, 0.01, 0.25)); mix(x, w, 0, 0.9);
    const z = zap(0.8, 900, 100); mul(z, ad(0.8, 0.005, 0.2)); mix(x, z, 0.02, 0.6);
    return finish(x, { rms: 0.26 });
  }],
  static_field: [{ v: 0.65, rev: 0.25, hi: 1, p: 0.04 }, () => {
    const x = buf(0.9);
    mix(x, boom(0.6, 70, 40, 0.12, 0.5, 500), 0, 1);
    const z = zap(0.7, 700, 60, 0.7); mul(z, ad(0.7, 0.003, 0.18)); mix(x, z, 0, 0.8);
    mix(x, whoosh(0.6, [[0, 3000], [0.6, 400]], 1, 0.1, 'w'), 0, 0.5);
    return finish(x, { rms: 0.24 });
  }],
  // 순간이동: 반짝이며 빨려 올라갔다 퐁
  teleport: [{ v: 0.6, rev: 0.25, hi: 1, p: 0.03 }, () => {
    const x = buf(0.75);
    mix(x, whoosh(0.4, [[0, 600], [0.4, 6000]], 2, 0.85, 'w'), 0, 0.8);
    sparkle(x, 0.05, 0.35, 10, 2000, 7000, 0.06, 0.5);
    const p = osc(0.12, line([[0, 900], [0.12, 180]], N(0.12), true)); mul(p, ad(0.12, 0.002, 0.03)); mix(x, p, 0.4, 1);
    mix(x, whoosh(0.25, [[0, 3000], [0.25, 500]], 1.5, 0.2), 0.4, 0.5);
    return finish(x, { rms: 0.22 });
  }],
  cast_ice: [{ v: 0.55, rev: 0.28, hi: 1, n: 2, p: 0.04 }, () => {
    const x = buf(0.8);
    mix(x, whoosh(0.6, [[0, 1500], [0.6, 7000]], 1.5, 0.7, 'w'), 0, 0.6);
    shards(x, 0.05, 0.5, 16, 0.5, 2500, 8000);
    const c = osc(0.7, 260); mul(c, env([[0, 0], [0.2, 0.4], [0.7, 0]], 0.7)); mix(x, c, 0, 0.5);
    return finish(x, { rms: 0.2 });
  }],
  ice_bolt: [{ v: 0.55, rev: 0.22, hi: 1, n: 2, p: 0.05 }, () => {
    const d = 0.5, x = whoosh(d, [[0, 1500], [d * 0.35, 4500], [d, 1200]], 1.5, 0.35);
    shards(x, 0.02, 0.3, 8, 0.35, 3000, 9000);
    return finish(x, { rms: 0.2 });
  }],
  ice_shatter: [{ v: 0.65, rev: 0.25, hi: 1, n: 2, p: 0.05 }, () => {
    const x = buf(0.8), c = noise(0.08, 'w');
    hp(c, 1500); mul(c, ad(0.08, 0.0005, 0.015)); mix(x, c, 0, 1);
    shards(x, 0, 0.55, 45, 0.9, 1800, 9000);
    mix(x, boom(0.2, 150, 90, 0.04, 0.4, 2000), 0, 0.5);
    return finish(x, { rms: 0.24 });
  }],
  frost_nova: [{ v: 0.7, rev: 0.32, hi: 1, p: 0.04 }, () => {
    const x = buf(1.3);
    mix(x, boom(0.5, 110, 50, 0.1, 0.6, 800), 0, 0.8);
    const w = noise(1.0, 'w'); bp(w, line([[0, 6000], [1.0, 800]], N(1.0), true), 1.3); mul(w, ad(1.0, 0.01, 0.3)); mix(x, w, 0, 0.8);
    shards(x, 0.03, 0.8, 35, 0.6, 2500, 9000);
    sparkle(x, 0.1, 0.9, 12, 3000, 8000, 0.15, 0.3);
    return finish(x, { rms: 0.24 });
  }],
  // 얼음 구슬: 윙윙 도는 바람 + 떨리는 높은 음 + 얼음 조각
  frozen_orb: [{ v: 0.6, rev: 0.3, hi: 1, p: 0.03 }, () => {
    const d = 1.8, x = buf(d), w = noise(d, 'p');
    bp(w, 2600, 2); trem(w, 15, 0.5); mul(w, env([[0, 0], [0.2, 1], [d - 0.4, 1], [d, 0]], d)); mix(x, w, 0, 0.8);
    for (const [f, a] of [[2637, 0.3], [3520, 0.25], [4698.6, 0.15]]) {
      const s = osc(d, f * rr(0.998, 1.002)); trem(s, 7.5, 0.4, f); mul(s, env([[0, 0], [0.3, 1], [d - 0.3, 0.8], [d, 0]], d)); mix(x, s, 0, a * 0.4);
    }
    shards(x, 0.1, d - 0.3, 18, 0.3, 3000, 9000);
    return finish(x, { rms: 0.2 });
  }],
  blizzard: [{ v: 0.65, rev: 0.3, hi: 1, p: 0.03 }, () => {
    const d = 2.4, x = icewind(d);
    mul(x, env([[0, 0], [0.4, 1], [d - 0.6, 0.9], [d, 0]], d));
    shards(x, 0.2, d - 0.5, 40, 0.5, 2500, 9000);
    mix(x, boom(0.6, 90, 50, 0.15, 0.4, 500), 0.15, 0.5);
    return finish(x, { rms: 0.22 });
  }],
  blizzard_loop: [{ v: 0.45, rev: 0.25, loop: 1 }, () => {
    const d = 4.4, x = icewind(d);
    shards(x, 0, d, 30, 0.35, 2500, 9000);
    return level(loopify(x, 0.4), 0.18);
  }],
  armor_buff: [{ v: 0.55, rev: 0.3, hi: 1, p: 0 }, () => {
    const x = buf(1.4);
    mix(x, whoosh(0.7, [[0, 800], [0.7, 6000]], 1.2, 0.8, 'w'), 0, 0.5);
    [659.3, 987.8, 1318.5, 1480, 1975.5].forEach((f, i) => modes(x, 0.05 + i * 0.05, barModes(f, 0.7), 0.5));
    sparkle(x, 0.2, 0.9, 18, 0, 0, 0.15, 0.3, [2637, 2960, 3951, 5274]);
    return finish(x, { rms: 0.2 });
  }],
  // 마나 보호막: 웅 하고 차오르는 소리
  mana_shield: [{ v: 0.6, rev: 0.28, hi: 1, p: 0 }, () => {
    const d = 1.5, n = N(d), x = buf(d);
    const h = osc(d, line([[0, 110], [0.5, 220], [d, 220]], n, true), 'saw');
    lp(h, line([[0, 300], [0.5, 1500], [d, 800]], n, true), 2); trem(h, 6, 0.2);
    mul(h, env([[0, 0], [0.4, 1], [1.0, 0.8], [d, 0]], d)); mix(x, h, 0, 0.6);
    const s = osc(d, line([[0, 440], [0.5, 880], [d, 880]], n, true)); mul(s, env([[0, 0], [0.5, 0.4], [d, 0]], d)); mix(x, s, 0, 0.6);
    mix(x, whoosh(0.6, [[0, 500], [0.6, 4000]], 1.5, 0.8, 'w'), 0, 0.5);
    sparkle(x, 0.4, 0.8, 10, 0, 0, 0.2, 0.25, [1760, 2637, 3520]);
    return finish(x, { rms: 0.2 });
  }],
  // 함성: 거친 남자 목소리 셋이 함께 '와아'
  warcry: [{ v: 0.8, rev: 0.3, p: 0.02 }, () => {
    const d = 1.2, x = buf(d);
    for (const f of [88, 99, 112]) {
      mix(x, voice(d, {
        f0: [[0, f * 0.9], [0.12, f * 1.15], [0.8, f], [d, f * 0.8]], vow: [[0, '@'], [0.1, 'a'], [0.7, 'a'], [d, 'o']],
        amp: [[0, 0], [0.06, 1], [0.8, 0.9], [d, 0]], rough: 0.9, growl: [rr(38, 50), 0.45], sub: 0.3, breath: 0.25, fs: rr(0.9, 1.0), drive: 1.6,
      }), rr(0, 0.03), 0.5);
    }
    mix(x, boom(0.6, 70, 50, 0.2, 0.3, 300), 0.05, 0.6);
    return finish(x, { rms: 0.28 });
  }],
  shout_buff: [{ v: 0.7, rev: 0.25, n: 2, p: 0.02 }, () => {
    const d = 0.6, x = buf(d);
    for (const f of [165, 185]) {
      mix(x, voice(d, { f0: [[0, f * 0.85], [0.07, f * 1.2], [d, f * 0.9]], vow: [[0, 'ae'], [0.08, 'a'], [d, 'a']], amp: [[0, 0], [0.03, 1], [0.35, 0.8], [d, 0]], rough: 0.6, breath: 0.2, drive: 1.3 }), rr(0, 0.02), 0.6);
    }
    return finish(x, { rms: 0.26 });
  }],
  leap: [{ v: 0.55, rev: 0.12, p: 0.04 }, () => {
    const x = buf(0.5);
    mix(x, whoosh(0.4, [[0, 250], [0.25, 1600], [0.4, 700]], 1.1, 0.55), 0, 1);
    mix(x, voice(0.14, { f0: [[0, 140], [0.14, 170]], vow: [[0, '@'], [0.14, 'u']], amp: [[0, 0], [0.02, 1], [0.14, 0]], rough: 0.5, breath: 0.4 }), 0, 0.4);
    return finish(x, { rms: 0.2 });
  }],
  leap_land: [{ v: 0.75, rev: 0.18, n: 2, p: 0.04 }, () => {
    const x = buf(0.8);
    thud(x, 0, 1.2, 90, 0.07, 500);
    debris(x, 0.01, 0.45, 25, 0.6);
    const g = noise(0.3, 'p'); lp(g, 1500); mul(g, ad(0.3, 0.002, 0.07)); mix(x, g, 0, 0.6);
    return finish(x, { rms: 0.28 });
  }],
  // 회오리: 2초에 여덟 번 휙(끝이 처음으로 이어진다)
  whirlwind_loop: [{ v: 0.5, rev: 0.15, loop: 1 }, () => {
    const L = 2.0, x = buf(L);
    for (let k = 0; k < 8; k++) {
      const d = rr(0.26, 0.32), w = whoosh(d, [[0, rr(300, 400)], [d * 0.45, rr(1500, 2200)], [d, 600]], 1.4, 0.45);
      mix(w, whoosh(d, [[0, 120], [d * 0.5, 400], [d, 150]], 1.4, 0.5, 'b'), 0, 0.7);
      wrap(x, w, k * 0.25 + rr(-0.01, 0.01), rr(0.8, 1));
    }
    return level(x, 0.2);
  }],
  ground_slam: [{ v: 0.85, rev: 0.25, p: 0.03 }, () => {
    const x = buf(1.4);
    mix(x, boom(1.0, 75, 28, 0.22, 1.0, 600), 0, 1.3);
    const c = noise(0.06, 'w'); lp(c, 3000); mul(c, ad(0.06, 0.0005, 0.012)); mix(x, c, 0, 0.8);
    debris(x, 0.03, 1.0, 45, 0.8);
    drive(x, 1.8);
    return finish(x, { rms: 0.3 });
  }],
  multishot: [{ v: 0.6, rev: 0.12, p: 0.03 }, () => {
    const x = buf(0.7);
    [0, 0.05, 0.095, 0.15, 0.19].forEach((t, i) => twang(x, t, 1 - i * 0.12, rr(105, 140)));
    return finish(x, { rms: 0.22 });
  }],
  arrow_fire: [{ v: 0.6, rev: 0.15, n: 2, p: 0.04 }, () => {
    const x = buf(0.7);
    twang(x, 0, 0.9); mix(x, fwoosh(0.5, 400, 2000), 0.02, 0.7);
    return finish(x, { rms: 0.22 });
  }],
  arrow_ice: [{ v: 0.6, rev: 0.15, hi: 1, n: 2, p: 0.04 }, () => {
    const x = buf(0.7);
    twang(x, 0, 0.9);
    mix(x, whoosh(0.45, [[0, 2000], [0.2, 6000], [0.45, 2500]], 2, 0.3, 'w'), 0.02, 0.4);
    shards(x, 0.03, 0.35, 10, 0.3, 3000, 9000);
    return finish(x, { rms: 0.22 });
  }],
  explode_small: [{ v: 0.7, rev: 0.22, n: 2, p: 0.05 }, () => {
    const x = buf(0.9);
    mix(x, boom(0.7, 120, 40, 0.12, 1.0, 1500), 0, 1);
    const b = noise(0.6, 'w'); lp(b, line([[0, 4000], [0.6, 400]], N(0.6), true), 0.7); mul(b, ad(0.6, 0.001, 0.1)); mix(x, b, 0, 0.9);
    mix(x, mul(crackle(0.7, 50, 1500, 6000), env([[0, 1], [0.7, 0]], 0.7)), 0.02, 0.7);
    drive(x, 1.6);
    return finish(x, { rms: 0.28 });
  }],
  // 덫 설치: 걸쇠 딸깍·철컥 + 용수철
  trap_set: [{ v: 0.5, rev: 0.1, hi: 1, p: 0.03 }, () => {
    const x = buf(0.5);
    const clk = (t, f, a) => { modes(x, t, [[f, 1, 0.025], [f * 1.9, 0.6, 0.015], [f * 3.1, 0.4, 0.01]], a); mix(x, click(0.3), t, a * 0.4); };
    clk(0, 2400, 1); clk(0.11, 1800, 0.9);
    mix(x, ks(0.3, 260, { t60: 0.25, b: 0.2 }), 0.06, 0.25);
    clk(0.2, 3200, 0.4);
    return finish(x, { rms: 0.18 });
  }],
  sentry_zap: [{ v: 0.55, rev: 0.18, hi: 1, n: 2, p: 0.05 }, () => {
    const x = buf(0.35), z = zap(0.25, 1200, 140, 1.2);
    mul(z, ad(0.25, 0.002, 0.06)); mix(x, z, 0, 1);
    const c = fm(0.12, line([[0, 2600], [0.12, 1200]], N(0.12), true), 1.41, 3); mul(c, ad(0.12, 0.001, 0.04)); mix(x, c, 0, 0.4);
    return finish(x, { rms: 0.2 });
  }],
  // 치유: 따뜻하게 오르는 종소리(가장조) + 부드러운 합창
  heal: [{ v: 0.55, rev: 0.3, hi: 1, p: 0 }, () => {
    const x = buf(1.6);
    mix(x, choir(1.5, [220, 277.2, 329.6, 440], { amp: [[0, 0], [0.4, 1], [0.9, 0.7], [1.5, 0]], vow: [[0, 'o'], [1.5, 'o']] }), 0, 0.25);
    [440, 554.4, 659.3, 880, 1108.7].forEach((f, i) => modes(x, i * 0.1, barModes(f, 0.8, 0.6), 0.5));
    sparkle(x, 0.3, 0.9, 12, 0, 0, 0.18, 0.2, [1760, 2217.5, 2637]);
    return finish(x, { rms: 0.2 });
  }],
  // 소환: 어둡게 빨아들이는 소리 → 낮은 쿵
  summon: [{ v: 0.65, rev: 0.32, p: 0.03 }, () => {
    const d = 1.7, n = N(d), x = buf(d);
    const sw = noise(d, 'p'); bp(sw, line([[0, 200], [d * 0.8, 900], [d, 300]], n, true), 1.2); mul(sw, env([[0, 0], [d * 0.8, 1], [d, 0]], d)); mix(x, sw, 0, 0.9);
    for (const f of [55, 58.3, 82.4]) { const o = osc(d, f, 'saw'); lp(o, 400, 1); mul(o, env([[0, 0], [d * 0.7, 1], [d, 0]], d)); mix(x, o, 0, 0.35); }
    mix(x, choir(d, [110, 116.5], { vow: [[0, 'u'], [d, 'o']], fs: 0.8, amp: [[0, 0], [d * 0.75, 1], [d, 0]] }), 0, 0.3);
    mix(x, boom(0.5, 90, 40, 0.12, 0.6, 400), d - 0.45, 0.8);
    return finish(x, { rms: 0.24 });
  }],
  poison: [{ v: 0.55, rev: 0.2, n: 2, p: 0.05 }, () => {
    const d = 0.9, x = buf(d);
    bubbles(x, 0, 0.75, 28, 0.6, 250, 900);
    const h = noise(d, 'w'); hp(h, 3000); mul(h, env([[0, 0], [0.1, 0.4], [0.5, 0.2], [d, 0]], d)); mix(x, h, 0, 0.6);
    return finish(x, { rms: 0.2 });
  }],
  acid_spit: [{ v: 0.55, rev: 0.15, n: 2, p: 0.06 }, () => {
    const x = buf(0.5), s = noise(0.12, 'w');
    bp(s, line([[0, 2500], [0.12, 1000]], N(0.12), true), 1); mul(s, ad(0.12, 0.003, 0.03)); mix(x, s, 0, 1);
    const p = noise(0.03, 'p'); lp(p, 800); mul(p, ad(0.03, 0.001, 0.006)); mix(x, p, 0, 0.8);
    bubbles(x, 0.03, 0.3, 10, 0.5, 400, 1100);
    return finish(x, { rms: 0.2 });
  }],
  // 저주: 반음 부딪는 음들이 함께 아래로 + 속삭임
  curse: [{ v: 0.6, rev: 0.32, p: 0.02 }, () => {
    const d = 1.4, n = N(d), x = buf(d);
    for (const [f0, f1] of [[220, 104], [233.1, 110], [329.6, 155.6]]) {
      const o = osc(d, line([[0, f0], [d, f1]], n, true), 'saw'); lp(o, line([[0, 1500], [d, 300]], n, true), 1.5);
      mul(o, env([[0, 0], [0.15, 1], [d * 0.7, 0.7], [d, 0]], d)); mix(x, o, 0, 0.3);
    }
    const wf = formant(lp1(noise(d, 'w'), 5000), [[0, 'u'], [d, 'o']], 1.1); mul(wf, env([[0, 0], [0.3, 1], [d, 0]], d)); mix(x, wf, 0, 0.25);
    mix(x, boom(0.6, 60, 35, 0.15, 0.3, 300), 0, 0.6);
    return finish(x, { rms: 0.22 });
  }],
};

// 효과음: 인터페이스·아이템. 이름: [재생 정보, 그리기]
// 재생 정보 v 크기, rev 잔향 보내기, hi 원래 표본율(밝은 소리), n 변형 수, p 음높이 흔들림, ui 화면 소리(잔향·위치 없음)
import { SR, rnd, rr, N, buf, line, ad, env, mul, mix, noise, osc, lp1, hp1, lp, hp, bp, click, modes, barModes, bellModes, choir, brass, voice, whoosh, crackle, sparkle, boom, finish, mtof } from './dsp.js';
import { coin, pouch, creak, metal } from './sfx-kit.js';

export const ITEMS = {
  ui_click: [{ v: 0.4, ui: 1, hi: 1, p: 0.03, n: 2 }, () => {
    const x = buf(0.08);
    modes(x, 0, [[rr(1650, 1900), 1, 0.012], [rr(3200, 3500), 0.4, 0.007], [rr(650, 760), 0.5, 0.01]]);
    mix(x, lp1(click(0.5), 5000), 0, 0.4);
    return finish(x, { rms: 0.18 });
  }],
  // 가죽 장정·양피지 창이 펼쳐짐
  ui_open: [{ v: 0.45, ui: 1, hi: 1, p: 0.03 }, () => {
    const x = buf(0.36);
    mix(x, whoosh(0.26, [[0, 700], [0.26, 2600]], 0.9, 0.6), 0, 0.9);
    const fl = noise(0.25, 'w'); bp(fl, 3200, 1.2);
    let g = 0;
    for (let i = 0; i < fl.length; i++) { if ((i & 255) === 0) g = rnd(); fl[i] *= g; }
    mul(fl, env([[0, 0], [0.1, 1], [0.25, 0]], 0.25)); mix(x, fl, 0.02, 0.35);
    mix(x, creak(0.12, [[0, 70], [0.12, 110]], 1300, 5), 0.03, 0.25);
    const th = noise(0.05, 'p'); lp(th, 300); mul(th, ad(0.05, 0.002, 0.012)); mix(x, th, 0.24, 0.9);
    return finish(x, { rms: 0.18 });
  }],
  ui_close: [{ v: 0.42, ui: 1, hi: 1, p: 0.03 }, () => {
    const x = buf(0.3);
    mix(x, whoosh(0.16, [[0, 2600], [0.16, 700]], 0.9, 0.35), 0, 0.9);
    mix(x, boom(0.12, 140, 80, 0.025, 0.9, 500), 0.12, 0.9);
    mix(x, lp1(click(0.4), 3000), 0.12, 0.3);
    return finish(x, { rms: 0.18 });
  }],
  // 안 된다는 둔한 웅·쿵
  ui_error: [{ v: 0.5, ui: 1, p: 0.01 }, () => {
    const x = buf(0.26), d = 0.22, bz = osc(d, 92, 'sq');
    mix(bz, osc(d, 97.5, 'sq'), 0, 0.7); lp(bz, 650, 1);
    mul(bz, env([[0, 0], [0.008, 1], [0.15, 0.7], [d, 0]], d)); mix(x, bz, 0, 0.6);
    modes(x, 0, [[170, 1, 0.05], [410, 0.6, 0.03], [890, 0.3, 0.015]]);
    const c = noise(0.03, 'w'); lp1(c, 1500); mul(c, ad(0.03, 0.001, 0.006)); mix(x, c, 0, 0.4);
    return finish(x, { rms: 0.2 });
  }],
  stat_up: [{ v: 0.45, ui: 1, hi: 1, p: 0 }, () => {
    const x = buf(0.9);
    modes(x, 0, barModes(1760, 0.35), 0.7); modes(x, 0.09, barModes(2637, 0.4), 0.8);
    return finish(x, { rms: 0.16 });
  }],
  gold_pickup: [{ v: 0.5, rev: 0.1, hi: 1, n: 3, p: 0.03 }, () => {
    const x = buf(0.6), k = 6 + Math.floor(rnd() * 4);
    for (let i = 0; i < k; i++) coin(x, 0.01 + Math.pow(rnd(), 1.4) * 0.22, 0.3 + rnd() * 0.7);
    return finish(x);
  }],
  // 돌바닥에 쏟아지는 동전: 튀어 오르는 간격이 점점 짧아지고 마지막 한 닢이 빙글 돌며 눕는다
  gold_drop: [{ v: 0.55, rev: 0.18, hi: 1, n: 2, p: 0.03 }, () => {
    const x = buf(1.0);
    const th = noise(0.06, 'w'); lp(th, 900, 0.7); mul(th, ad(0.06, 0.001, 0.012)); mix(x, th, 0, 0.5);
    for (let c = 0; c < 5; c++) {
      const f0 = rr(2600, 4200);
      let t = rr(0, 0.04), a = rr(0.6, 1), gap = rr(0.07, 0.11);
      for (let b = 0; b < 4 && t < 0.7; b++) { coin(x, t, a, f0 * rr(0.995, 1.005), 1.1); t += gap; gap *= 0.62; a *= 0.5; }
    }
    const f0 = rr(3000, 3800);
    for (let t = 0.35, g = 0.06; g > 0.008 && t < 0.95; t += g, g *= 0.85) coin(x, t, 0.18, f0, 0.4);
    return finish(x);
  }],
  // 천을 움켜쥐는 소리
  item_pickup: [{ v: 0.45, rev: 0.05, hi: 1, n: 2, p: 0.05 }, () => {
    const d = 0.16, x = noise(d, 'p');
    bp(x, line([[0, 900], [0.06, 2400], [d, 1400]], N(d), true), 1.1);
    mul(x, env([[0, 0], [0.015, 1], [0.05, 0.6], [d, 0]], d));
    let g = 1, tg = 1;
    for (let i = 0; i < x.length; i++) { if ((i & 63) === 0) tg = 0.3 + rnd(); g += (tg - g) * 0.05; x[i] *= g; }
    return finish(x, { rms: 0.18 });
  }],
  drop_weapon: [{ v: 0.6, rev: 0.2, hi: 1, n: 2, p: 0.04 }, () => {
    const x = buf(1.1), f = rr(430, 620);
    const th = noise(0.08, 'w'); lp(th, 700); mul(th, ad(0.08, 0.001, 0.015)); mix(x, th, 0, 0.9);
    metal(x, 0, f, 1, 1); metal(x, 0.13, f, 0.45, 0.7, 2); metal(x, 0.21, f, 0.18, 0.5, 1);
    return finish(x);
  }],
  // 묵직한 갑옷: 쿵 + 가죽 철퍽 + 사슬 고리 짤랑
  drop_armor: [{ v: 0.6, rev: 0.18, hi: 1, n: 2, p: 0.04 }, () => {
    const x = buf(0.9);
    mix(x, boom(0.35, 110, 55, 0.07, 0.8, 500), 0, 1);
    const fl = noise(0.12, 'p'); lp(fl, 1200); mul(fl, ad(0.12, 0.002, 0.03)); mix(x, fl, 0, 0.7);
    for (let i = 0; i < 40; i++) {
      const t = 0.005 + Math.pow(rnd(), 1.8) * 0.45, f = rr(2200, 6500);
      modes(x, t, [[f, 1, rr(0.008, 0.03)], [f * rr(1.4, 2.2), 0.5, 0.01]], rr(0.05, 0.25) * (1 - t * 1.5));
    }
    mix(x, boom(0.2, 90, 60, 0.04, 0.5, 400), 0.11, 0.35);
    return finish(x);
  }],
  // 반지: 맑고 높은 '팅' 하나와 작은 되튐 두세 번(겹친 배음이 살짝 맥놀이)
  drop_ring: [{ v: 0.55, rev: 0.2, hi: 1, p: 0.015 }, () => {
    const x = buf(1.2), f = 3150;
    const ring = (at, a) => {
      modes(x, at, [[f, 1, 0.32], [f * 1.0035, 0.6, 0.3], [f * 2.71, 0.38, 0.14], [f * 2.725, 0.2, 0.12], [f * 5.2, 0.12, 0.05]], a);
      mix(x, click(0.25), at, a * 0.25);
    };
    ring(0, 1); ring(0.12, 0.42); ring(0.205, 0.18); ring(0.255, 0.07);
    return finish(x, { rms: 0.2 });
  }],
  // 유리병이 딸깍 + 안에서 출렁
  drop_potion: [{ v: 0.5, rev: 0.18, hi: 1, n: 2, p: 0.04 }, () => {
    const x = buf(0.7), f = rr(1900, 2300);
    const glass = (at, a) => {
      modes(x, at, [[f, 1, 0.09], [f * 2.31, 0.6, 0.06], [f * 3.9, 0.35, 0.035], [f * 5.6, 0.2, 0.02], [f * 1.52, 0.25, 0.05]], a);
      mix(x, hp1(click(0.4), 2000), at, a * 0.4);
    };
    glass(0, 1); glass(0.085, 0.35);
    const sl = noise(0.25, 'p'); bp(sl, line([[0, 500], [0.25, 900]], N(0.25), true), 3); mul(sl, env([[0, 0], [0.03, 1], [0.25, 0]], 0.25));
    for (let i = 0; i < sl.length; i++) sl[i] *= 0.6 + 0.4 * Math.sin(i / SR * Math.PI * 36);
    mix(x, sl, 0.02, 0.35);
    return finish(x);
  }],
  drop_scroll: [{ v: 0.45, rev: 0.12, hi: 1, n: 2, p: 0.05 }, () => {
    const x = buf(0.4), cr = crackle(0.3, 260, 1800, 7000, 0.0015);
    mul(cr, env([[0, 1], [0.08, 0.7], [0.3, 0]], 0.3)); mix(x, cr, 0, 1);
    mix(x, whoosh(0.18, [[0, 1500], [0.18, 3500]], 0.8, 0.3), 0, 0.6);
    const fl = noise(0.05, 'p'); lp(fl, 400); mul(fl, ad(0.05, 0.002, 0.012)); mix(x, fl, 0.05, 0.8);
    return finish(x, { rms: 0.18 });
  }],
  // 마법·희귀·고유 아이템: 기본 떨어지는 소리 위에 얹는 반짝임(고유가 가장 화려하다)
  drop_magic: [{ v: 0.4, rev: 0.3, hi: 1, p: 0 }, () => {
    const x = buf(1.0);
    sparkle(x, 0, 0.55, 14, 0, 0, 0.12, 0.6, [1760, 2093, 2349.3, 2637, 3136, 3520, 4186]);
    mix(x, whoosh(0.7, [[0, 2500], [0.7, 7000]], 1.2, 0.35, 'w'), 0, 0.3);
    return finish(x, { rms: 0.15 });
  }],
  drop_rare: [{ v: 0.45, rev: 0.3, hi: 1, p: 0 }, () => {
    const x = buf(1.3);
    [1318.5, 1661.2, 1975.5, 2637].forEach((f, i) => modes(x, i * 0.06, barModes(f, 0.5), 0.6));
    sparkle(x, 0.15, 0.7, 16, 0, 0, 0.15, 0.4, [2637, 3322.4, 3951, 5274]);
    mix(x, whoosh(0.9, [[0, 3000], [0.9, 9000]], 1, 0.3, 'w'), 0, 0.25);
    return finish(x, { rms: 0.17 });
  }],
  drop_unique: [{ v: 0.55, rev: 0.35, hi: 1, p: 0 }, () => {
    const x = buf(2.4);
    modes(x, 0, bellModes(293.7, 0.9, 0.6), 0.08);
    for (const [f, t] of [[1174.7, 0], [1760, 0.05], [2349.3, 0.1], [2960, 0.16], [3520, 0.22]]) modes(x, t, [[f, 1, 0.9], [f * 1.002, 0.6, 0.8], [f * 2.756, 0.25, 0.3], [f * 5.404, 0.08, 0.1]], 0.45);
    sparkle(x, 0.2, 1.6, 30, 0, 0, 0.22, 0.3, [2349.3, 2637, 2960, 3520, 4698.6, 5274]);
    mix(x, whoosh(1.8, [[0, 1500], [1.8, 9000]], 0.8, 0.4, 'w'), 0, 0.3);
    return finish(x, { rms: 0.2 });
  }],
  // 장비 착용: 가죽끈 삐걱 + 버클 딸깍 + 갑옷 스침
  equip: [{ v: 0.5, rev: 0.05, hi: 1, n: 2, p: 0.04 }, () => {
    const x = buf(0.6);
    mix(x, creak(0.14, [[0, 90], [0.14, 160]], 1100, 4), 0, 0.6);
    const f = rr(2100, 2600);
    modes(x, 0.1, [[f, 1, 0.07], [f * 1.73, 0.6, 0.05], [f * 2.61, 0.4, 0.035]], 0.8); mix(x, click(0.3), 0.1, 0.3);
    modes(x, 0.17, [[f * 1.05, 0.5, 0.05], [f * 1.8, 0.4, 0.03]], 0.5);
    const ru = noise(0.25, 'p'); bp(ru, 2500, 0.8); mul(ru, env([[0, 0], [0.05, 0.6], [0.25, 0]], 0.25)); mix(x, ru, 0.02, 0.5);
    return finish(x, { rms: 0.2 });
  }],
  // 꿀꺽꿀꺽 + 하아
  potion_drink: [{ v: 0.55, rev: 0.05, p: 0.04 }, () => {
    const x = buf(1.1);
    const gulp = (at, a) => {
      const d = 0.09, g = noise(d, 'w');
      bp(g, line([[0, 260], [d, 620]], N(d), true), 7); mul(g, env([[0, 0], [0.01, 1], [0.04, 0.5], [d, 0]], d)); mix(x, g, at, a);
      modes(x, at + 0.01, [[rr(280, 340), 0.6, 0.03]], a);
      for (let i = 0; i < 3; i++) { const t = at + 0.03 + rnd() * 0.06, bd = 0.03, o = osc(bd, line([[0, rr(500, 800)], [bd, rr(1000, 1400)]], N(bd), true)); mul(o, ad(bd, 0.002, 0.01)); mix(x, o, t, a * 0.25); }
    };
    gulp(0.02, 1); gulp(0.3, 0.9); gulp(0.56, 0.8);
    mix(x, voice(0.35, { f0: [[0, 140], [0.35, 110]], vow: [[0, 'a'], [0.35, '@']], amp: [[0, 0], [0.05, 1], [0.35, 0]], breath: 0.9 }), 0.72, 0.35);
    return finish(x);
  }],
  buy: [{ v: 0.5, ui: 1, hi: 1, p: 0.02 }, () => {
    const x = buf(0.6);
    for (let i = 0; i < 3; i++) coin(x, 0.02 + i * 0.075 + rnd() * 0.01, 0.8 - i * 0.1);
    pouch(x, 0.24, 0.6);
    return finish(x);
  }],
  sell: [{ v: 0.5, ui: 1, hi: 1, p: 0.02 }, () => {
    const x = buf(0.9);
    pouch(x, 0, 0.8);
    for (let i = 0; i < 12; i++) coin(x, 0.04 + Math.pow(rnd(), 1.2) * 0.4, rr(0.3, 0.9));
    pouch(x, 0.45, 0.5);
    return finish(x);
  }],
  // 감정: 숨은 이름이 드러나는 반짝임
  identify: [{ v: 0.5, ui: 1, hi: 1, p: 0 }, () => {
    const x = buf(1.3), sc = [1318.5, 1568, 1760, 2093, 2349.3, 2637, 3136, 3520];
    mix(x, whoosh(0.8, [[0, 500], [0.8, 5000]], 1.5, 0.85), 0, 0.7);
    for (let i = 0; i < 14; i++) { const u = i / 14; modes(x, u * 0.7 + rnd() * 0.04, [[sc[Math.min(7, Math.floor(u * 8 + rnd()))], 0.5, 0.12]], 0.6 + u * 0.4); }
    modes(x, 0.75, barModes(1318.5, 0.6), 0.9); modes(x, 0.75, barModes(1975.5, 0.5), 0.6);
    return finish(x, { rms: 0.18 });
  }],
  // 모루에 망치 세 번
  repair: [{ v: 0.55, rev: 0.15, hi: 1, p: 0.01 }, () => {
    const x = buf(1.9);
    const strike = (at, a, df) => {
      const f = 1150 * df;
      modes(x, at, [[f, 1, 0.45], [f * 1.58, 0.45, 0.35], [f * 2.52, 0.7, 0.3], [f * 3.47, 0.35, 0.22], [f * 4.63, 0.28, 0.15], [f * 6.1, 0.15, 0.08], [f * 0.19, 0.5, 0.06]], a);
      const n = noise(0.012, 'w'); hp(n, 2500); mul(n, ad(0.012, 0.0003, 0.002)); mix(x, n, at, a * 1.2);
      mix(x, boom(0.15, 220, 160, 0.03, 0.3, 1500), at, a * 0.5);
    };
    strike(0, 1, 1); strike(0.36, 0.9, 1.004); strike(0.72, 0.6, 0.997);
    return finish(x);
  }],
  // 레벨 업: 오르는 종 아르페지오 + 합창 + 반짝임(라장조, 당당하게)
  levelup: [{ v: 0.7, ui: 1, hi: 1, p: 0 }, () => {
    const x = buf(2.8);
    [587.3, 740, 880, 1174.7, 1480, 1760].forEach((f, i) => modes(x, i * 0.075, barModes(f, 0.9), 0.55 + i * 0.06));
    mix(x, choir(2.4, [146.8, 293.7, 370, 440, 587.3], { amp: [[0, 0], [0.35, 1], [1.4, 0.8], [2.4, 0]], vow: [[0, 'o'], [0.6, 'a']] }), 0.12, 0.35);
    sparkle(x, 0.3, 1.6, 26, 0, 0, 0.18, 0.35, [2349.3, 2960, 3520, 4698.6]);
    mix(x, boom(0.9, 75, 60, 0.35, 0.2, 300), 0, 0.6);
    mix(x, whoosh(1.2, [[0, 2000], [1.2, 8000]], 0.7, 0.6, 'w'), 0.05, 0.25);
    return finish(x, { rms: 0.24 });
  }],
  // 퀘스트 완료: 짧은 금관 팡파르(레-라-레 → 라장조 화음)
  quest_done: [{ v: 0.65, ui: 1, p: 0 }, () => {
    const x = buf(1.9);
    const nt = (at, m, d, a) => mix(x, brass(d, mtof(m), { a: 0.03, r: 0.12, bright: 5 }), at, a);
    nt(0, 62, 0.16, 0.8); nt(0.17, 69, 0.16, 0.8); nt(0.34, 74, 1.3, 1);
    nt(0.34, 66, 1.3, 0.6); nt(0.34, 57, 1.3, 0.6); nt(0.34, 50, 1.3, 0.5);
    mix(x, boom(0.8, 80, 55, 0.25, 0.4, 400), 0.34, 0.7);
    return finish(x, { rms: 0.22 });
  }],
  // 새 퀘스트: 낮고 수상한 화음(라 단조 + 9음) + 낮은 종
  quest_new: [{ v: 0.6, ui: 1, p: 0 }, () => {
    const d = 2.6, x = buf(d);
    for (const [m, a] of [[38, 0.8], [45, 0.6], [53, 0.5], [64, 0.35]]) {
      const f = mtof(m), o = osc(d, f * rr(0.998, 1.002), 'saw');
      mix(o, osc(d, f * 1.004, 'saw'), 0, 1); lp(o, 500 + f, 0.7);
      mul(o, env([[0, 0], [0.6, 1], [1.5, 0.8], [d, 0]], d)); mix(x, o, 0, a * 0.4);
    }
    modes(x, 0.05, bellModes(146.8, 0.6, 0.7), 0.5);
    mix(x, whoosh(1.6, [[0, 300], [1.6, 1200]], 2, 0.6), 0, 0.25);
    return finish(x, { rms: 0.2 });
  }],
  // 책장 넘기기
  book: [{ v: 0.45, ui: 1, hi: 1, n: 2, p: 0.05 }, () => {
    const x = buf(0.45);
    mix(x, whoosh(0.3, [[0, 1500], [0.15, 4500], [0.3, 2000]], 0.9, 0.5), 0, 0.8);
    const cr = crackle(0.22, 350, 2000, 8000, 0.001); mul(cr, env([[0, 0.3], [0.1, 1], [0.22, 0]], 0.22)); mix(x, cr, 0.03, 0.8);
    const fl = noise(0.04, 'p'); lp(fl, 700); mul(fl, ad(0.04, 0.002, 0.01)); mix(x, fl, 0.27, 0.8);
    return finish(x, { rms: 0.18 });
  }],
};

// 곡: 던전(지하 묘지·카타콤·동굴·지옥)과 우두머리. 대부분 성기고 어둡게, 악절을 무작위로 골라 되풀이가 드러나지 않게 한다
import { Ph, rr, pick, chance, choose, keys } from './compose.js';

const pickNext = (st, w, first) => { const k = st.n === 0 && first ? first : choose(w, st.last); st.last = k; return k; };

// ───────── 지하 묘지(1~4층): 낮은 현의 지속음, 멀리서 들리는 합창, 드문 조종 ─────────
function cryptPh(kind) {
  const P = new Ph(20);
  switch (kind) {
    case 'drone':
      P.ch('str', 0, [38, 45], 20, 0.5);
      if (chance(0.6)) P.n('whisp', 4, pick([74, 69, 77]), 12, 0.5);
      break;
    case 'choir':
      P.n('str', 0, 38, 20, 0.45);
      P.ch('choiru', 3, pick([[50, 57, 64, 65], [50, 58, 62, 65], [46, 53, 62, 65]]), 14, 0.4);
      P.n('bell', 0, 45, 6, 0.4);
      break;
    case 'toll':
      P.n('drone', 0, 38, 20, 0.45); P.n('str', 0, 45, 20, 0.3);
      P.n('bell', 0, 38, 8, 0.6); P.n('bell', 10, 38, 8, 0.45);
      break;
    case 'shift': // 반음 위로 올라섰다 돌아오는 불안한 지속음
      P.ch('str', 0, [38, 45], 8, 0.45); P.ch('str', 8, [39, 46], 8, 0.45); P.ch('str', 16, [38, 45], 4, 0.4);
      P.ch('choiru', 2, [62, 65], 6, 0.3); P.ch('choiru', 10, [63, 67], 6, 0.3);
      break;
    case 'void':
      P.n('drone', 0, 38, 20, 0.3); P.n('whisp', 2, pick([69, 74]), 10, 0.45);
      if (chance(0.7)) P.n('chime', rr(6, 12), pick([81, 86, 89]), 4, 0.14);
      break;
  }
  return P.out();
}
export const crypt = {
  bpm: 60, vol: 1.1,
  pre: () => keys({ bell: [38, 45], chime: [81, 86, 89] }),
  next: (st) => cryptPh(pickNext(st, { drone: 3, choir: 3, toll: 2, shift: 2, void: 2 }, 'drone')),
};

// ───────── 카타콤(5~8층): 불협 덩어리 화음, 쇠 긁는 소리, 느린 맥박 ─────────
function cataPh(kind) {
  const P = new Ph(16);
  const pulse = (every, v) => { for (let t = 0; t < 16; t += every) P.n('heart', t, null, 1, v); };
  switch (kind) {
    case 'pulse':
      pulse(2, 0.5); P.ch('str', 0, [47, 48, 53], 16, 0.35);
      break;
    case 'scrape':
      pulse(4, 0.4); P.n('scrape', rr(1, 5), null, 4, 0.6);
      if (chance(0.6)) P.n('scrape', rr(9, 12), null, 4, 0.45);
      P.ch('glass', 0, [83, 84], 16, 0.5);
      break;
    case 'ost': // 낮은 현을 뜯는 되풀이(시 - 도 - 시 - 파: 반음과 증4도)
      pulse(4, 0.45);
      for (let t = 0; t < 16; t++) P.n('pluck', t, [47, 48, 47, 53][t % 4], 1, t % 4 === 0 ? 0.6 : 0.4);
      P.ch('str', 0, [47, 53], 16, 0.3);
      break;
    case 'cluster':
      P.ch('choiru', 0, pick([[59, 60, 65], [58, 59, 64], [57, 58, 63]]), 14, 0.4);
      P.n('scrape', rr(4, 9), null, 4, 0.5); P.n('tom', 0, null, 1, 0.4);
      break;
    case 'still':
      pulse(4, 0.4); P.n('whisp', 0, pick([77, 72]), 12, 0.4);
      if (chance(0.5)) P.n('rattle', rr(4, 12), null, 1, 0.5);
      break;
  }
  return P.out();
}
export const catacombs = {
  bpm: 54, vol: 1.4,
  pre: () => keys({ heart: 2, scrape: 3, pluck: [47, 48, 53], tom: 3, rattle: 2 }),
  next: (st) => cataPh(pickNext(st, { pulse: 3, scrape: 3, ost: 2, cluster: 2, still: 2 }, 'still')),
};

// ───────── 동굴(9~12층): 깊은 지속음과 낮은 부족 타악기 ─────────
const T1 = 'X.......X..x....', T2 = 'X..x....X.....x.', TOM = '....x.......x.x.', FR = '..o...o...o...o.', SH = '.o.o.o.o.o.o.o.o', ST = 'x..x..x...x..x..';
function cavesPh(kind) {
  const P = new Ph(16);
  P.ch('drone', 0, [36, 43], 16, kind === 'rest' ? 0.35 : 0.45);
  const groove = (lvl) => {
    P.grid('taiko', pick([T1, T2]), 0.25, 0.8);
    if (lvl > 0) { P.grid('tom', TOM, 0.25, 0.6); P.grid('frame', FR, 0.25, 0.6); P.grid('stick', ST, 0.25, 0.45); }
    if (lvl > 1) P.grid('hand', 'oooxooo.oooxoo.o', 0.25, 0.4);
    P.grid('shaker', SH, 0.25, 0.35);
  };
  switch (kind) {
    case 'sparse': P.grid('taiko', 'X...............', 0.25, 0.8); P.grid('shaker', SH, 0.25, 0.3, 8); break;
    case 'groove': groove(1); break;
    case 'full': groove(2); break;
    case 'horn': groove(0); P.seq('brass', 0, 'C3:4 | Eb3:2 C3:2 | Bb2:4 | C3:4', 0.42); break;
    case 'rest': P.n('whisp', 2, pick([67, 72]), 10, 0.4); P.n('taiko', 0, null, 1, 0.5); break;
  }
  if ((kind === 'groove' || kind === 'full') && chance(0.4)) P.grid('tom', 'o.o.x.x.xxxxXXXX', 0.25, 0.7, 12, 16);
  return P.out();
}
export const caves = {
  bpm: 80, vol: 1,
  pre: () => keys({ taiko: 3, tom: 3, frame: 3, stick: 3, hand: 3, shaker: 2 }),
  next: (st) => cavesPh(pickNext(st, { sparse: 2, groove: 3, full: 2, horn: 2, rest: 1.5 }, 'sparse')),
};

// ───────── 지옥(13~16층): 짓누르는 북, 합창, 찌그러진 지속음(다 프리지아·증4도) ─────────
const HC = { Cm: [48, 55, 60, 63], Db: [49, 56, 61, 65], GbC: [48, 54, 58, 61] };
const BAR1 = 'X' + '.'.repeat(15);
function hellPh(kind) {
  const P = new Ph(16), soft = kind === 'void' || kind === 'dread';
  P.ch('dist', 0, [36, 43], 16, soft ? 0.32 : 0.5);
  switch (kind) {
    case 'pound':
      P.grid('taiko', 'X...X...X.X.X...', 0.25, 0.85); P.grid('boom', BAR1, 0.25, 0.75);
      P.ch('choir', 0, HC.Cm, 8, 0.36); P.ch('choir', 8, HC.Db, 8, 0.36);
      break;
    case 'march':
      P.grid('taiko', 'X.x.X.x.X.x.X.x.', 0.25, 0.75); P.grid('anvil', '....x.......x...', 0.25, 0.55);
      P.ch('choir', 0, HC.GbC, 16, 0.32);
      break;
    case 'chant':
      P.grid('taiko', 'X.......X.......', 0.25, 0.8); P.grid('tom', '..x...x...x...x.', 0.25, 0.5);
      P.seq('choir', 0, '[C4,Eb4,G4]:2 r:2 [C4,Eb4,G4]:2 r:2 [Db4,F4,Ab4]:4 [C4,Eb4,G4]:4', 0.5);
      break;
    case 'dread':
      P.n('boom', 0, null, 4, 0.8); P.n('boom', 8, null, 4, 0.6); P.n('gong', 0, null, 6, 0.5);
      P.n('dist', 0, 37, 16, 0.3); P.ch('choiru', 2, [48, 49], 12, 0.35);
      break;
    case 'void':
      P.n('whisp', 0, 60, 14, 0.4); P.n('gong', 4, null, 6, 0.35);
      break;
  }
  return P.out();
}
export const hell = {
  bpm: 84, vol: 0.8,
  pre: () => keys({ taiko: 3, boom: 2, anvil: 2, tom: 3, gong: 1 }),
  next: (st) => hellPh(pickNext(st, { pound: 3, march: 3, chant: 2, dread: 2, void: 1.2 }, 'dread')),
};

// ───────── 우두머리: 빠른 낮은 현 오스티나토, 북, 금관·합창 찌르기 ─────────
const BC = { Dm: [50, 57, 62, 65], Bb: [46, 53, 58, 62], C: [48, 55, 60, 64], A: [45, 52, 57, 61], Eb: [51, 55, 58, 63] };
const ROOT = { Dm: 38, Bb: 34, C: 36, A: 33, Eb: 39 };
const PROGS = [['Dm', 'Dm', 'Bb', 'A'], ['Dm', 'Eb', 'Dm', 'C'], ['Dm', 'Bb', 'C', 'A']];
function bossPh(kind) {
  const P = new Ph(16), prog = pick(PROGS);
  prog.forEach((c, bar) => {
    const t0 = bar * 4, r = ROOT[c] + 12, off = c === 'Dm' ? [0, 0, 12, 0, 3, 0, 1, 0] : [0, 0, 12, 0, 7, 0, 12, 0];
    if (kind !== 'D') for (let k = 0; k < 8; k++) P.n('ost', t0 + k * 0.5, r + off[k], 0.5, k === 0 ? 0.85 : 0.55);
    P.grid('taiko', kind === 'A' ? 'X.......X.x.....' : 'X.....x.X.x...x.', 0.25, 0.8, t0, t0 + 4);
    if (kind === 'B' || kind === 'C') { P.ch('brass', t0, BC[c], 0.45, 0.6); P.ch('brass', t0 + 1.5, BC[c], 0.4, 0.5); }
    if (kind === 'C') { P.ch('choir', t0, BC[c], 4, 0.5); P.grid('anvil', '....x.......x...', 0.25, 0.5, t0, t0 + 4); }
    if (kind === 'D') {
      P.ch('choir', t0, BC[c], 4, 0.45); P.n('str', t0, ROOT[c], 4, 0.4);
      if (bar === 3) for (let k = 0; k < 16; k++) P.n('timp', t0 + k * 0.25, 38, 0.25, 0.25 + k * 0.035);
    }
  });
  if (kind !== 'D') P.grid('boom', BAR1 + '.'.repeat(16), 0.25, 0.7);
  if (kind !== 'A' && chance(0.5)) P.grid('tom', 'x.x.xxxxXXXXXXXX', 0.25, 0.6, 12, 16);
  return P.out();
}
export const boss = {
  bpm: 132, vol: 1,
  pre: () => keys({ taiko: 3, boom: 2, anvil: 2, tom: 3, timp: [38] }),
  next(st) { const k = st.n === 0 ? 'A' : st.n === 1 ? 'B' : choose({ A: 2, B: 3, C: 3, D: 1.5 }, st.last); st.last = k; return bossPh(k); },
};

// 곡: 시작 화면(어두운 합창과 낮은 종)과 마을(쓸쓸한 핑거 피킹 기타). 모두 새로 쓴 선율이다
// 곡 = { bpm, vol, pre() 미리 그릴 악기 소리 열쇠, next(st) 다음 악절 }. st.n 지금까지 연주한 악절 수
import { Ph, R, rr, pick, chance, choose, keys, midi } from './compose.js';

// ───────── 시작 화면: 라단조, 느린 합창 화음과 낮은 종(프리지아 내림미가 가끔 어둡게 비친다) ─────────
const TV = {
  Dm: [50, 57, 62, 65], Bb: [46, 53, 62, 65], Gm: [55, 58, 62, 67], A: [57, 61, 64, 69], Eb: [51, 58, 63, 67],
  EbD: [50, 55, 58, 63], C: [48, 55, 60, 64], DmF: [53, 57, 62, 65],
};
function titlePh(kind) {
  const P = new Ph(16);
  const pad = (t, c, d, v = 0.5) => { P.ch('choir', t, TV[c], d, v); P.n('str', t, TV[c][0] - 12, d, 0.32); };
  P.n('drone', 0, 38, 16, kind === 'void' ? 0.35 : 0.45);
  switch (kind) {
    case 'dark':
      pad(0, 'Dm', 8); pad(8, 'Bb', 8);
      P.n('bell', 0, 50, 6, 0.5); P.n('bell', 8, 46, 6, 0.42);
      break;
    case 'cadence':
      pad(0, 'Gm', 4); pad(4, 'DmF', 4); pad(8, 'Eb', 4); pad(12, 'A', 4);
      P.seq('choiru', 0, 'D5:4 | C5:2 A4:2 | Bb4:4 | A4:4', 0.4);
      P.n('bell', 0, 43, 5, 0.4); P.n('bell', 12, 45, 5, 0.45);
      break;
    case 'phryg':
      pad(0, 'Dm', 4); pad(4, 'EbD', 4); pad(8, 'Dm', 4); pad(12, 'EbD', 4);
      P.n('bell', 0, 50, 6, 0.5); P.n('glass', 4, pick([86, 87]), 8, 0.5);
      break;
    case 'void':
      P.ch('choiru', 0, [50, 57], 16, 0.3);
      P.n('bell', rr(4, 8), 45, 6, 0.3);
      break;
    case 'rise':
      pad(0, 'Bb', 4); pad(4, 'C', 4); pad(8, 'Dm', 8);
      P.seq('choiru', 0, 'F4:4 | G4:4 | A4:8', 0.45);
      P.n('gong', 8, null, 6, 0.3); P.n('bell', 8, 38, 6, 0.5);
      break;
  }
  return P.out();
}
export const title = {
  bpm: 56, vol: 1,
  pre: () => keys({ bell: [38, 43, 45, 46, 50], gong: 1 }),
  next(st) {
    const k = st.n === 0 ? pick(['void', 'dark']) : choose({ dark: 3, cadence: 3, phryg: 2, void: 2, rise: 2 }, st.last);
    st.last = k;
    return titlePh(k);
  },
};

// ───────── 마을: 가단조 3/4박, 손가락으로 뜯는 기타 펼침화음 위의 선율(안달루시아 종지·도리아 6음) ─────────
// 기타 화음 모양(낮은 줄 → 높은 줄)
const GV = {
  Am: [45, 52, 57, 60, 64], Asus2: [45, 52, 57, 59, 64], G: [43, 47, 50, 55, 59], F: [41, 48, 53, 57, 60],
  E: [40, 47, 52, 56, 59], C: [48, 52, 55, 60, 64], Dm: [50, 57, 62, 65], D: [50, 57, 62, 66],
  'Am/G': [43, 52, 57, 60, 64], 'Dm/F': [41, 50, 57, 62, 65],
};
// 마디 하나의 펼침(8분음표 여섯): 화음 모양의 몇 번째 줄을 뜯는지. 가락이 있을 때는 위 줄을 비운다
const PAT = [[0, 2, 3, 4, 3, 2], [0, 2, 4, 3, 4, 2], [0, 3, 2, 4, 2, 3], [0, 1, 2, 3, 4, 3]];
const PAT_LOW = [[0, 2, 3, 2, 3, 2], [0, 1, 2, 1, 3, 1], [0, 2, 1, 3, 1, 2]];
// 가락(마디마다 3박)
const MEL = {
  A: ['A4:2 B4:.5 C5:.5 | D5:1.5 C5:.5 B4:1 | C5:1 A4:1 F4:1 | G#4:2 E4:1',
    'E5:1.5 D5:.5 C5:1 | B4:1 G4:1 D5:1 | C5:1.5 B4:.5 A4:1 | B4:3',
    'C5:.5 B4:.5 A4:2 | B4:.5 C5:.5 D5:2 | E5:1 D5:1 C5:1 | B4:1.5 A4:.5 G#4:1'],
  B: ['A4:1 C5:1 F5:1 | E5:2 D5:.5 C5:.5 | D5:1 B4:1 G4:1 | A4:3',
    'F5:1.5 E5:.5 C5:1 | G5:2 E5:1 | D5:1.5 C5:.5 B4:1 | C5:1 B4:1 A4:1'],
  C: ['E5:1 F#5:1 E5:1 | D5:1.5 C5:.5 A4:1 | C5:1 B4:1 A4:1 | F#4:3',
    'A4:1.5 B4:.5 C5:1 | D5:2 F#5:1 | E5:1.5 D5:.5 C5:1 | A4:3'],
  D: ['F5:2 E5:1 | C5:1.5 B4:.5 A4:1 | G#4:1 B4:1 D5:1 | C5:1 B4:1 A4:1',
    'D5:1.5 E5:.5 F5:1 | E5:2 C5:1 | B4:1.5 A4:.5 G#4:1 | A4:3'],
  coda: ['A4:1 C5:1 B4:1 | G#4:3 | A4:3 | r:3'],
};
// 악절 설계: ch 마디별 화음, mel 가락 묶음과 나올 확률, oct 옥타브 올림, harm 하모닉스, drone 지속음, bell 먼 종
const PLAN = {
  intro: { ch: ['Am', 'Am', 'Asus2', 'Am'], drone: 1, bell: 0.5 },
  A: { ch: ['Am', 'G', 'F', 'E'], mel: 'A', p: 0.85 },
  'A+': { ch: ['Am', 'G', 'F', 'E'], mel: 'A', p: 1, oct: 12 },
  B: { ch: ['F', 'C', 'G', 'Am'], mel: 'B', p: 0.75 },
  C: { ch: ['Am', 'D', 'Am', 'D'], mel: 'C', p: 0.8 },
  D: { ch: ['Dm', 'Am', 'E', 'Am'], mel: 'D', p: 0.8 },
  inter: { ch: ['Am', 'Am/G', 'Dm/F', 'E'], harm: 1, drone: 1 },
  coda: { ch: ['F', 'E', 'Am', 'Am'], mel: 'coda', p: 1, drone: 1, bell: 0.7, end: 1 },
};
// 한 바퀴(약 2분 20초) 뒤 처음으로: 바퀴마다 가락·펼침·꾸밈을 새로 고른다
const FORM = ['intro', 'A', 'A', 'B', 'A', 'C', 'C', 'D', 'inter', 'B', 'A+', 'D', 'A', 'coda'];
function townPh(kind) {
  const L = PLAN[kind], P = new Ph(12), mel = L.mel && chance(L.p) ? pick(MEL[L.mel]) : null;
  L.ch.forEach((name, bar) => {
    const V = GV[name], t0 = bar * 3, root = V[0] < 45 ? V[0] + 12 : V[0];
    if (L.end && bar === 3) { P.n('gtr', t0, V[0], 3, 0.6); P.n('chime', t0 + 0.03, 81, 3, 0.3); return; }
    const pat = mel ? pick(PAT_LOW) : pick(PAT), sparse = kind === 'intro' && bar === 0;
    pat.forEach((ix, k) => {
      if (sparse && k % 2) return;
      const v = k === 0 ? 0.68 : (0.36 + R() * 0.14) * (k === 3 ? 1.1 : 1);
      P.n('gtr', t0 + k * 0.5 + rr(0, 0.02), V[Math.min(ix, V.length - 1)], 2, v);
    });
    // 가락이 없을 때 가끔 마디 끝에 맨 윗음을 한 번 더(손가락이 넘어가는 소리)
    if (!mel && chance(0.25)) P.n('gtr', t0 + 2.75, V[V.length - 1], 0.25, 0.26);
    P.n('str', t0, root, 3, 0.2); P.n('str', t0, root + 7, 3, 0.14);
    if (L.harm && bar % 2 === 0) P.n('chime', t0 + 1.5, pick([76, 81, 88]), 2, 0.22);
  });
  if (mel) P.seq('gtr', 0.01, mel, 0.74, { tr: L.oct || 0, hum: 0.015, vr: 0.08 });
  if (L.drone) { P.n('drone', 0, 33, 12, 0.16); P.n('drone', 0, 45, 12, 0.1); }
  if (L.bell && chance(L.bell)) P.n('bell', rr(0, 4), pick([45, 52]), 4, 0.3);
  return P.out();
}
// 기타가 쓰는 모든 음높이
const GTR = new Set();
for (const V of Object.values(GV)) for (const m of V) GTR.add(m);
for (const [k, arr] of Object.entries(MEL)) for (const s of arr) for (const tok of s.match(/[A-G][#b]?\d/g)) { GTR.add(midi(tok)); if (k === 'A') GTR.add(midi(tok) + 12); }
export const town = {
  bpm: 72, vol: 1.15,
  pre: () => keys({ gtr: [...GTR], chime: [76, 81, 88], bell: [45, 52] }),
  next: (st) => townPh(FORM[st.n % FORM.length]),
};

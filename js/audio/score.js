// 배경음악 악보: 짧은 문자 표기로 쓴 곡들과, 이를 연주 이벤트로 바꾸는 해석기
//
// 표기
//  n    음표 줄 "D4:1.5 E4:.5 [D3,F3]:2 r:1 ~:1" (음:박, 박을 생략하면 앞과 같음, 1/3 같은 분수 가능)
//       r 쉼표 · ~ 앞 음 잇기 · x/X 음높이 없는 타격(X는 세게) · 접두 > 세게, < 여리게, * 롤(연타) · 접미 ' 스타카토
//  pad  화음을 [낮은음, 높은음] 범위 안에서 앞 화음과 가깝게 이어 배치해 길게 끈다(k=성부 수)
//  pat  화음을 따르는 반복 음형: R 베이스, 3·5·7 화음 구성음, C 화음 전체, a0~a5 펼침화음, 뒤에 +/- 옥타브
//  g    타악기 격자(s박마다 한 칸): X 세게, x 보통, o 여리게, r 롤, . 쉼
//  공통 v 음량, cr [시작 배율, 끝 배율, 시작 박, 끝 박] 점점 세게·여리게, tr 이조, dbl 옥타브 겹침, at [시작 박, 끝 박], trem 트레몰로
//  화음 ch: 마디마다 하나, 쉼표(,)로 마디를 나눈다

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const acc = (s) => (s === '#' ? 1 : s === 'b' ? -1 : 0);
export function midi(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error('음 표기 오류: ' + s);
  return 12 * (+m[3] + 1) + PC[m[1]] + acc(m[2]);
}
const pcOf = (s) => (PC[s[0]] + acc(s[1] || '') + 12) % 12;
const num = (s) => (s.includes('/') ? s.split('/').reduce((a, b) => a / b) : +s);
const mod12 = (x) => ((x % 12) + 12) % 12;

const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], sus4: [0, 5, 7], 6: [0, 4, 7, 9] };
function chord(s) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(s);
  if (!m || !QUAL[m[2]]) throw new Error('화음 표기 오류: ' + s);
  const r = pcOf(m[1]);
  return { pcs: QUAL[m[2]].map((i) => (r + i) % 12), bass: m[3] ? pcOf(m[3]) : r };
}
function chordsOf(str, meter) {
  const out = [];
  let t = 0;
  for (const bar of str.split(/\s+/)) {
    if (!bar || bar === '|') continue;
    const cs = bar.split(','), d = meter / cs.length;
    for (const s of cs) {
      const last = out[out.length - 1];
      if (last && last.s === s) last.d += d; else out.push({ t, d, s, c: chord(s) });
      t += d;
    }
  }
  return out;
}
const chordAt = (chs, t) => { let r = chs[0]; for (const x of chs) { if (x.t <= t + 1e-6) r = x; else break; } return r; };

// 화음 배치: 근음·3음(7화음이면 7음)을 갖추고, 2도로 붙지 않으며, 앞 배치에서 적게 움직이는 조합
function voicing(c, lo, hi, prev, k) {
  const cand = [];
  for (let m = lo; m <= hi; m++) if (c.pcs.includes(m % 12)) cand.push(m);
  k = Math.min(k, cand.length);
  let best = cand.slice(0, k), bc = Infinity;
  const pick = [];
  const rec = (s) => {
    if (pick.length === k) {
      const has = new Set(pick.map((m) => m % 12));
      let cost = 0;
      if (!has.has(c.pcs[0])) cost += 6;
      if (!has.has(c.pcs[1])) cost += 8;
      if (c.pcs[3] != null && !has.has(c.pcs[3])) cost += 4;
      for (let i = 1; i < k; i++) { const iv = pick[i] - pick[i - 1]; if (iv < 3) cost += 6; else if (iv > 9) cost += (iv - 9) * 0.6; }
      if (prev) for (let i = 0; i < k; i++) cost += Math.abs(pick[i] - prev[Math.min(i, prev.length - 1)]) * 0.5;
      else cost += Math.abs((pick[0] + pick[k - 1]) / 2 - (lo + hi) / 2) * 0.3;
      if (cost < bc) { bc = cost; best = pick.slice(); }
      return;
    }
    for (let i = s; i < cand.length; i++) { pick.push(cand[i]); rec(i + 1); pick.pop(); }
  };
  rec(0);
  return best;
}

const NOTE = /^([><*]*)(\[[^\]]+\]|r|~|[xX]|[A-G][#b]?-?\d)(?::([\d./]+))?(')?$/;
function notes(str) {
  const out = [];
  let t = 0, dur = 1, last = null;
  for (const tok of str.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const m = NOTE.exec(tok);
    if (!m) throw new Error('음표 표기 오류: ' + tok);
    if (m[3]) dur = num(m[3]);
    const b = m[2];
    if (b === 'r') { t += dur; last = null; continue; }
    if (b === '~') { if (last) last.d += dur; t += dur; continue; }
    const ms = b === 'x' || b === 'X' ? [null] : b[0] === '[' ? b.slice(1, -1).split(',').map(midi) : [midi(b)];
    const a = b === 'X' || m[1].includes('>') ? 1.25 : m[1].includes('<') ? 0.6 : 1;
    last = { t, d: m[4] ? dur * 0.45 : dur, ms, a, roll: m[1].includes('*') };
    out.push(last);
    t += dur;
  }
  out.len = t;
  return out;
}
const PAT = /^([><]*)(r|R|C|[357]|a\d)([+-]*)(?::([\d./]+))?(')?$/;
function pattern(p, chs, len) {
  let dur = 1;
  const toks = p.pat.split(/\s+/).filter((s) => s && s !== '|').map((s) => {
    const m = PAT.exec(s);
    if (!m) throw new Error('음형 표기 오류: ' + s);
    if (m[4]) dur = num(m[4]);
    return { k: m[2], o: [...m[3]].reduce((a, ch) => a + (ch === '+' ? 12 : -12), 0), d: dur, a: m[1].includes('>') ? 1.25 : m[1].includes('<') ? 0.6 : 1, st: !!m[5] };
  });
  const lo = midi(p.rng?.[0] || 'C3'), vlo = midi(p.vrng?.[0] || 'C4'), vhi = midi(p.vrng?.[1] || 'C5');
  const voiced = new Map();
  let prev = null;
  const vo = (seg) => { if (!voiced.has(seg)) { prev = voicing(seg.c, vlo, vhi, prev, p.k || 3); voiced.set(seg, prev); } return voiced.get(seg); };
  const out = [], stop = p.at ? p.at[1] : len;
  let t = p.at ? p.at[0] : 0, i = 0;
  while (t < stop - 1e-6) {
    const k = toks[i++ % toks.length], seg = chordAt(chs, t), c = seg.c;
    if (k.k !== 'r') {
      const R = lo + mod12(c.bass - lo);
      let ms;
      if (k.k === 'R') ms = [R];
      else if (k.k === 'C') ms = vo(seg);
      else if (k.k[0] === 'a') { const v = vo(seg); ms = [v[+k.k[1] % v.length]]; }
      else { const pc = c.pcs[{ 3: 1, 5: 2, 7: 3 }[k.k]] ?? c.pcs[2]; ms = [R + (mod12(pc - R) || 12)]; }
      out.push({ t, d: k.st ? k.d * 0.45 : k.d, ms: ms.map((m) => m + k.o), a: k.a });
    }
    t += k.d;
  }
  return out;
}
function pad(p, chs) {
  const lo = midi(p.pad[0]), hi = midi(p.pad[1]), out = [];
  let prev = null;
  for (const s of chs) {
    const t0 = Math.max(s.t, p.at ? p.at[0] : 0), t1 = Math.min(s.t + s.d, p.at ? p.at[1] : Infinity);
    if (t1 <= t0 + 1e-6) continue;
    prev = voicing(s.c, lo, hi, prev, p.k || 3);
    out.push({ t: t0, d: t1 - t0, ms: prev, a: 1 });
  }
  return out;
}
function grid(p, len) {
  const g = p.g.replace(/\s+/g, ''), s = p.s || 0.25, out = [];
  for (let j = 0, n = Math.round(len / s); j < n; j++) {
    const ch = g[j % g.length], t = j * s, last = out[out.length - 1];
    if (ch === '.') continue;
    if (ch === 'r') {
      if (last?.roll && Math.abs(last.t + last.d - t) < 1e-6) last.d += s;
      else out.push({ t, d: s, ms: [null], a: 0.6, roll: true });
      continue;
    }
    out.push({ t, d: s, ms: [null], a: ch === 'X' ? 1.25 : ch === 'x' ? 0.8 : 0.4 });
  }
  return out;
}
const crAt = (cr, t, len) => {
  if (!cr) return 1;
  const [a, b, t0 = 0, t1 = len] = cr;
  return a + (b - a) * Math.max(0, Math.min(1, (t - t0) / (t1 - t0 || 1)));
};
export function section(S, meter) {
  const len = S.bars * meter, chs = chordsOf(S.ch, meter), ev = [];
  for (const p of S.parts) {
    const raw = p.n ? notes(p.n) : p.pad ? pad(p, chs) : p.pat ? pattern(p, chs, len) : grid(p, len);
    if (p.n && Math.abs(raw.len - len) > 1e-6) throw new Error(`악보 길이 불일치(${p.i}): ${raw.len}박 / ${len}박`);
    for (const e of raw) {
      if (p.at && (p.n || p.g) && (e.t < p.at[0] - 1e-6 || e.t >= p.at[1])) continue;
      const v = p.v * e.a * crAt(p.cr, e.t, len), v1 = e.roll ? p.v * e.a * crAt(p.cr, e.t + e.d, len) : undefined;
      for (const m of e.ms) for (const sh of [0, ...(p.dbl || [])]) ev.push({ i: p.i, t: e.t, d: e.d, m: m == null ? null : m + (p.tr || 0) + sh, v, v1, roll: e.roll, trem: p.trem });
    }
  }
  ev.sort((a, b) => a.t - b.t);
  return { ev, len };
}
const compiled = new Map();
export function compile(T) {
  let c = compiled.get(T);
  if (!c) { c = T.order.map((k) => section(T.sec[k], T.meter || 4)); compiled.set(T, c); }
  return c;
}

// ───────── 곡 ─────────
// 자주 쓰는 리듬
const MARCH_SN = 'X..o x.o. X..o x.rr';
const DRIVE_SN = 'X.oxX.oxX.oxXxrr';
const BD13 = 'X.......X.......';
const GALLOP = 'R:.5 R:.25 R';
const OOMPAH = 'R:1 r:1 5-:1 r:1';
const AFTER = "r:.5 C:.5' r:.5 C:.5' r:.5 C:.5' r:.5 C:.5'";
const WALTZ_LH = "R:1 C:1' C:1'";
const HARP = 'a0:.5 a1 a2 a3 a4 a3 a2 a1';

// 메인 테마: 라단조, 호른이 부르는 비장한 주제
const TA = 'D4:1.5 E4:.5 F4:1 A4:1 | G4:1.5 F4:.5 D4:2 | E4:1.5 F4:.5 G4:1 A4:1 | A4:4 | D4:1.5 E4:.5 F4:1 A4:1 | D5:1.5 C5:.5 Bb4:1 A4:1 | Bb4:1.5 A4:.5 G4:1 E4:1 | D4:4';
const TA_BASS = 'D3:2 A2:2 | G2:2 D3:2 | C3:2 G2:2 | A2:2 E2:2 | D3:2 A2:2 | Bb2:2 F2:2 | G2:2 A2:2 | D3:2 D2:2';
const TA_TIMP = 'D2:4 | r:4 | r:4 | A2:1 A2:.5 A2:.5 A2:2 | D2:4 | r:4 | r:2 A2:2 | D2:2 r:2';
const TA_CH = 'Dm Gm C A | Dm Bb Gm,A7 Dm';

// 전간기 왈츠: 사장조 3/4, 피아노와 클라리넷
const WA = 'B4:1.5 A4:.5 G4:1 | B4:2 E5:1 | E5:1.5 D5:.5 C5:1 | A4:3 | B4:1.5 A4:.5 G4:1 | F#4:2 B4:1 | E5:1.5 D5:.5 C5:1 | Eb5:2 D5:1 | D5:2 B4:1 | G#4:1.5 A4:.5 B4:1 | C5:2 A4:1 | F#4:1.5 G4:.5 A4:1 | B4:1.5 C5:.5 D5:1 | G5:2 E5:1 | C5:1.5 A4:.5 F#4:1 | G4:3';
const WA_CL = 'D4:3 | E4:2 G4:1 | G4:3 | F#4:1 E4:1 D4:1 | D4:3 | D4:3 | E4:3 | G4:1.5 F4:.5 Eb4:1 | D4:3 | B3:3 | E4:2 C4:1 | D4:1.5 C4:1.5 | B3:3 | B3:1 E4:1 G4:1 | E4:1.5 D4:1.5 | D4:1 B3:1 G3:1';
const WA_FL = 'r:9 | r:1 F#5:.5 E5:.5 D5:1 | r:9 | r:2 G5:1 | r:21 | r:1 D5:.5 B4:.5 G4:1';
const WA_CH = 'G Em C D | G Bm C Cm | G E7 Am D7 | G Em Am,D7 G';
const WA_LH = { i: 'pno', v: 0.28, pat: WALTZ_LH, rng: ['G2', 'F#3'], vrng: ['B3', 'G4'] };

// 새벽의 들판: 내림마장조, 호른 독주와 하프
const DA = 'G4:2 Bb4:1 G4:1 | F4:3 D4:1 | Eb4:2 G4:1 C5:1 | C5:3 Bb4:1 | Bb4:2 G4:1 Eb4:1 | Ab4:2 C5:1 Ab4:1 | G4:1.5 F4:.5 D4:2 | Eb4:4';
const DA_H = 'Eb4:2 G4:1 Eb4:1 | D4:3 Bb3:1 | C4:2 Eb4:1 G4:1 | Ab4:3 G4:1 | G4:2 Eb4:1 Bb3:1 | Eb4:2 Ab4:1 Eb4:1 | Eb4:1.5 D4:.5 Bb3:2 | Bb3:4';
const DA_BASS = 'Eb3:4 | D3:4 | C3:4 | Ab2:4 | Bb2:4 | Ab2:4 | F2:2 Bb2:2 | Eb3:4';
const DA_CH = 'Eb Bb/D Cm Ab | Eb/Bb Ab Fm7,Bb7 Eb';
const DA_HARP = { i: 'harp', v: 0.28, pat: HARP, vrng: ['Eb3', 'Bb4'], k: 5 };

// 폭풍 전야: 다단조, 심장 박동 같은 팀파니와 낮은 현의 반복 음형
const EVE_OST = { i: 'spic', v: 0.45, pat: 'R:.5 R 5- R 3 R 5- R', rng: ['F2', 'E3'] };
const EVE_T = '>C2:.5 <C2:3.5 | >C2:.5 <C2:3.5 | >Eb2:.5 <Eb2:3.5 | >Eb2:.5 <Eb2:3.5 | >F2:.5 <F2:3.5 | >F2:.5 <F2:3.5 | >G2:.5 <G2:3.5 | >G2:.5 <G2:3.5';
const EVE_M = 'C4:4 | Eb4:3 D4:1 | C4:4 | r:4 | F4:2 Eb4:2 | Ab3:2 C4:2 | B3:4 | r:4';
const EVE_B = 'Eb4:3 C4:1 | F4:4 | Eb4:2 Ab4:2 | F4:4 | Ab4:2 G4:1 F4:1 | F4:2 D4:2 | Eb4:4 | D4:4';
const EVE_CH = 'Cm Cm Ab Ab | Fm Fm G G';
const EVE_TREM = { i: 'str', v: 0.15, pad: ['G4', 'Eb5'], k: 2, trem: 11 };

// 강철의 폭풍: 마단조, 말발굽 리듬의 현과 금관 주제
const ST_A = 'E4:3 B3:1 | D4:2 A3:2 | C4:1.5 B3:.5 A3:1 G3:1 | F#3:4 | E4:3 G4:1 | F#4:2 D4:2 | E4:1.5 F#4:.5 G4:1 E4:1 | D#4:4';
const ST_TIMP = 'E2:4 | D2:4 | C2:4 | F#2:2 F#2:2 | E2:4 | D2:4 | C2:4 | F#2:1 F#2:1 F#2:1 F#2:1';
const ST_CH = 'Em D C B | Em D C B';
const ST_GAL = { i: 'spic', v: 0.5, pat: GALLOP, rng: ['B2', 'A#3'] };
const ST_TREM = { i: 'str', v: 0.16, pad: ['G4', 'E5'], k: 3, trem: 12 };

// 불타는 전선: 가단조 3/4, 합창과 팀파니 오스티나토
const FR_A = 'A3:2 C4:1 | E4:3 | F4:2 E4:1 | C4:3 | D4:2 F4:1 | A4:2 G4:.5 F4:.5 | E4:3 | ~:3';
const FR_CH = 'Am Am F F | Dm Dm E E';
const FR_TIMP = { i: 'timp', v: 0.4, pat: '>R:1 R:.5 R 5-:1', rng: ['D2', 'C#3'] };
const FR_BASS = { i: 'vc', v: 0.45, pat: 'R:3', rng: ['E2', 'D#3'] };
const FR_CHOIR = { i: 'choir', v: 0.34, pad: ['E3', 'C5'], k: 4 };

// 진군: 내림나장조 행진곡, 트럼펫 주제와 움파 베이스
const MA = 'Bb4:1.5 F4:.5 Bb4:1 D5:1 | C5:2 A4:2 | Bb4:1.5 C5:.5 D5:1 F5:1 | Eb5:1 G5:1 F5:1 A4:1 | Bb4:1.5 F4:.5 Bb4:1 D5:1 | G5:2 D5:2 | E5:1.5 F5:.5 G5:1 Bb4:1 | A4:2 F4:2';
const MA_DESC = 'D5:4 | C5:4 | D5:4 | G5:2 A5:2 | Bb5:4 | Bb5:2 A5:2 | G5:4 | F5:4';
const MA_TIMP = 'Bb2:2 F2:2 | F2:2 C2:2 | Bb2:2 F2:2 | Eb2:1 r:1 F2:1 r:1 | Bb2:2 F2:2 | G2:2 D2:2 | C2:2 G2:2 | F2:1 F2:1 F2:1 F2:1';
const MA_CH = 'Bb F Bb Eb,F | Bb Gm C7 F';
const MT = 'G4:2 Bb4:1 Eb5:1 | D5:3 Bb4:1 | Ab4:2 F4:1 D4:1 | Eb4:3 r:1 | C5:2 Eb5:1 C5:1 | Bb4:2 G4:2 | A4:1.5 C5:.5 Eb5:1 C5:1 | D5:4';
const MA_BASE = [
  { i: 'hn', v: 0.3, pat: AFTER, vrng: ['D4', 'Bb4'] },
  { i: 'tb', v: 0.46, pat: OOMPAH, rng: ['E2', 'D#3'] },
  { i: 'bd', v: 0.46, g: BD13 },
];

// 최후의 방어선: 바단조, 반음씩 내려가는 비가 베이스 위의 첼로 독주
const LA = 'C4:3 Ab3:1 | G3:3 C4:1 | C4:2 Bb3:1 Ab3:1 | Ab3:2 F3:2 | F3:2 Bb3:1 Db4:1 | E3:4 | F3:1 Ab3:1 Db4:1.5 C4:.5 | C4:2 Bb3:1 G3:1';
const LA_BASS = 'F2:4 | E2:4 | Eb2:4 | D2:4 | Db2:4 | C2:4 | F2:2 Bb1:2 | C2:4';
const LA_TIMP = 'F2:4 | r:12 | Db2:4 | r:8 | *C2:4';
const LA_CH = 'Fm C/E Fm/Eb Bb/D | Bbm/Db C Fm,Bbm C';
const LB = 'Ab4:2 F4:1 Ab4:1 | G4:2 Eb4:2 | F4:1.5 G4:.5 Ab4:1 C5:1 | C5:4 | Db5:2 C5:1 Ab4:1 | Bb4:2 G4:2 | E4:1.5 F4:.5 G4:1 Bb4:1 | C5:4';

// 개선: 라장조, 팡파르와 찬가
const TR = 'F#4:2 A4:1 D5:1 | D5:2 B4:2 | A4:1.5 F#4:.5 A4:1 D5:1 | E5:4 | F#5:2 D5:1 B4:1 | B4:2 G4:1 B4:1 | A4:1.5 D5:.5 C#5:1 E5:1 | D5:4';
const TR_BASS = 'D3:2 A2:2 | G2:2 D3:2 | F#2:2 D2:2 | A2:2 E2:2 | B2:2 F#2:2 | G2:2 E2:2 | A2:2 A2:2 | D3:2 D2:2';
const TR_TIMP = 'D2:4 | G2:4 | D2:4 | A2:2 A2:1 A2:1 | B2:4 | G2:4 | A2:4 | D2:4';
const TR_CH = 'D G D A | Bm G D/A,A7 D';

// 레퀴엠: 라단조, 합창과 오보에, 마지막은 라장조로
const RQ = 'A4:3 G4:1 | F4:3 D4:1 | Bb4:2 A4:1 G4:1 | A4:4 | D5:3 C5:1 | C5:2 A4:2 | G4:1 Bb4:1 A4:1 C#5:1 | D5:4';
const RQ_BASS = 'D3:4 | Bb2:4 | G2:4 | A2:4 | D3:4 | F2:4 | G2:2 A2:2 | D2:4';
const RQ_CH = 'Dm Bb Gm A | Dm F Gm,A D';
const RQ_BELL = 'D3:8 | D3:8 | D3:8 | D3:8';

export const TRACKS = {
  title: {
    name: '메인 테마', desc: '비장한 호른과 현악', bpm: 76, gap: [5, 9],
    order: ['intro', 'A', 'B', 'A2', 'outro'],
    sec: {
      intro: { bars: 4, ch: 'Dm Dm Bb A', parts: [
        { i: 'vc', v: 0.45, n: 'D3:8 | Bb2:4 | A2:4', dbl: [-12] },
        { i: 'timp', v: 0.5, cr: [0.2, 1, 0, 8], n: '*D2:8 | r:8' },
        { i: 'timp', v: 0.55, n: 'r:12 | A2:1 A2:.5 A2:.5 A2:2' },
        { i: 'hn', v: 0.5, n: 'r:4 | r:2 A3:1.5 D4:.5 | F4:2 E4:1 D4:1 | E4:4' },
        { i: 'str', v: 0.26, pad: ['A3', 'D5'], at: [8, 16] },
        { i: 'sn', v: 0.4, cr: [0.1, 1, 12, 16], n: 'r:12 | *x:4' },
        { i: 'cymr', v: 0.5, n: 'r:13 | *x:3' },
      ] },
      A: { bars: 8, ch: TA_CH, parts: [
        { i: 'hn', v: 0.72, n: TA },
        { i: 'str', v: 0.28, pad: ['F3', 'A4'] },
        { i: 'vc', v: 0.5, n: TA_BASS },
        { i: 'timp', v: 0.5, n: TA_TIMP },
        { i: 'cym', v: 0.5, n: 'x:32' },
      ] },
      B: { bars: 8, ch: 'Bb F Gm Dm | Bb C Gm A7', parts: [
        { i: 'vln', v: 0.55, n: 'D5:1.5 C5:.5 Bb4:1 D5:1 | C5:3 A4:1 | Bb4:1.5 A4:.5 G4:1 Bb4:1 | A4:3 F4:1 | D5:1.5 E5:.5 F5:2 | E5:1 D5:.5 C5:.5 C5:2 | Bb4:1.5 C5:.5 D5:1 Bb4:1 | A4:2 G4:1 E4:1' },
        { i: 'hn', v: 0.4, n: 'F4:4 | F4:4 | D4:4 | D4:2 F4:2 | F4:4 | G4:4 | G4:2 D4:2 | C#4:4' },
        { i: 'str', v: 0.22, pad: ['D3', 'F4'] },
        { i: 'vc', v: 0.48, n: 'Bb2:2 F2:2 | F2:2 C3:2 | G2:2 D3:2 | D3:2 A2:2 | Bb2:2 F2:2 | C3:2 G2:2 | G2:2 Bb2:2 | A2:2 E2:2' },
        { i: 'sn', v: 0.3, g: MARCH_SN },
        { i: 'timp', v: 0.42, n: 'Bb2:4 | r:4 | G2:4 | r:4 | Bb2:4 | r:4 | G2:4 | A2:2 A2:1 A2:1' },
      ] },
      A2: { bars: 8, ch: TA_CH, parts: [
        { i: 'vln', v: 0.45, n: TA, tr: 12 },
        { i: 'hn', v: 0.68, n: TA },
        { i: 'tp', v: 0.4, n: TA },
        { i: 'str', v: 0.26, pad: ['F3', 'A4'] },
        { i: 'vc', v: 0.5, n: TA_BASS },
        { i: 'tb', v: 0.4, n: TA_BASS },
        { i: 'timp', v: 0.55, n: TA_TIMP },
        { i: 'sn', v: 0.4, g: MARCH_SN },
        { i: 'bd', v: 0.5, g: BD13 },
        { i: 'cym', v: 0.55, n: 'x:16 x:16' },
      ] },
      outro: { bars: 4, ch: 'Dm Bb Gm,A Dm', parts: [
        { i: 'hn', v: 0.5, cr: [1, 0.7], n: 'D4:1.5 E4:.5 F4:1 A4:1 | F4:1.5 E4:.5 D4:2 | Bb3:2 C#4:2 | D4:4' },
        { i: 'str', v: 0.24, cr: [1, 0.5], pad: ['F3', 'A4'] },
        { i: 'vc', v: 0.42, n: 'D3:4 | Bb2:4 | G2:2 A2:2 | D3:4', dbl: [-12] },
        { i: 'timp', v: 0.35, n: 'r:12 | D2:4' },
      ] },
    },
  },
  waltz: {
    name: '전간기 왈츠', desc: '1930년대 유럽의 피아노 왈츠', bpm: 104, meter: 3, gap: [18, 35],
    order: ['A', 'A2', 'B', 'A3'],
    sec: {
      A: { bars: 16, ch: WA_CH, parts: [{ i: 'pno', v: 0.55, n: WA }, { ...WA_LH, v: 0.3 }] },
      A2: { bars: 16, ch: WA_CH, parts: [
        { i: 'pno', v: 0.5, n: WA }, WA_LH,
        { i: 'cl', v: 0.38, n: WA_CL },
        { i: 'fl', v: 0.3, n: WA_FL },
      ] },
      B: { bars: 8, ch: 'Em B7 Em C | Am Em F#7 B7', parts: [
        { i: 'vln', v: 0.45, n: 'G4:2 F#4:1 | F#4:2 B4:1 | B4:1.5 A4:.5 G4:1 | G4:2 E4:1 | E5:2 C5:1 | B4:2 G4:1 | A#4:1.5 B4:.5 C#5:1 | D#5:2 F#4:1' },
        WA_LH,
        { i: 'cl', v: 0.3, n: 'B3:3 | A3:3 | G3:3 | G3:3 | A3:3 | G3:3 | A#3:3 | A3:3' },
        { i: 'pizz', v: 0.3, pat: 'R:3', rng: ['E2', 'D#3'] },
      ] },
      A3: { bars: 16, ch: WA_CH, parts: [
        { i: 'vln', v: 0.42, n: WA },
        { i: 'pno', v: 0.35, n: WA }, WA_LH,
        { i: 'cl', v: 0.3, n: WA_CL },
        { i: 'fl', v: 0.28, n: WA_FL },
      ] },
    },
  },
  dawn: {
    name: '새벽의 들판', desc: '호른 독주와 하프', bpm: 66, vol: 1.1, gap: [20, 40],
    order: ['A', 'B', 'A2'],
    sec: {
      A: { bars: 8, ch: DA_CH, parts: [
        { i: 'hn', v: 0.5, n: DA }, DA_HARP,
        { i: 'str', v: 0.18, pad: ['Bb3', 'G4'] },
        { i: 'vc', v: 0.4, n: DA_BASS },
      ] },
      B: { bars: 8, ch: 'Cm Ab Eb Bb | Cm Fm Ab,Bb Eb', parts: [
        { i: 'vln', v: 0.45, n: 'G5:2 F5:1 Eb5:1 | Eb5:2 C5:2 | Bb4:2 G4:1 Bb4:1 | F5:4 | Eb5:1.5 D5:.5 C5:1 G4:1 | Ab4:2 C5:2 | C5:1 Eb5:1 D5:2 | Eb5:4' },
        { i: 'hn', v: 0.32, n: 'Eb4:4 | Eb4:4 | Eb4:4 | D4:4 | Eb4:4 | C4:4 | Eb4:2 D4:2 | Eb4:4' },
        DA_HARP,
        { i: 'vc', v: 0.4, n: 'C3:4 | Ab2:4 | Eb3:4 | Bb2:4 | C3:4 | F2:4 | Ab2:2 Bb2:2 | Eb3:4' },
        { i: 'timp', v: 0.22, n: 'r:12 | Bb2:4 | r:12 | Eb2:4' },
      ] },
      A2: { bars: 8, ch: DA_CH, parts: [
        { i: 'vln', v: 0.42, n: DA },
        { i: 'hn', v: 0.38, n: DA_H }, DA_HARP,
        { i: 'str', v: 0.16, pad: ['Bb3', 'G4'] },
        { i: 'vc', v: 0.4, n: DA_BASS },
        { i: 'cel', v: 0.25, n: 'r:2 Bb5:1 G5:1 | r:4 | r:2 G5:1 C6:1 | r:4 | r:2 Eb6:1 Bb5:1 | r:4 | r:4 | Eb6:4' },
      ] },
    },
  },
  eve: {
    name: '폭풍 전야', desc: '다가오는 전쟁의 심장 박동', bpm: 84, vol: 1.5, gap: [10, 20],
    order: ['A', 'A2', 'B', 'A3'],
    sec: {
      A: { bars: 8, ch: EVE_CH, parts: [EVE_OST, { i: 'timp', v: 0.4, n: EVE_T }, EVE_TREM] },
      A2: { bars: 8, ch: EVE_CH, parts: [
        EVE_OST, { i: 'timp', v: 0.4, n: EVE_T }, EVE_TREM,
        { i: 'hn', v: 0.5, n: EVE_M },
        { i: 'pno', v: 0.16, n: 'r:3 G5:1 | r:3 G5:1 | r:3 Ab5:1 | r:3 Ab5:1 | r:3 Ab5:1 | r:3 Ab5:1 | r:3 G5:1 | r:3 G5:1' },
      ] },
      B: { bars: 8, ch: 'Ab Db Ab Db | Fm G7 Cm G', parts: [
        { ...EVE_OST, v: 0.48 },
        { i: 'hn', v: 0.58, n: EVE_B },
        { i: 'tb', v: 0.38, n: EVE_B, tr: -12 },
        { i: 'str', v: 0.2, pad: ['C4', 'Ab4'] },
        { i: 'timp', v: 0.45, n: '>Eb2:.5 <Eb2:3.5 | >Db2:.5 <Db2:3.5 | >Eb2:.5 <Eb2:3.5 | >Db2:.5 <Db2:3.5 | >F2:.5 <F2:3.5 | >G2:.5 <G2:3.5 | >C2:.5 <C2:3.5 | *G2:4' },
        { i: 'sn', v: 0.4, cr: [0.05, 1, 24, 32], n: 'r:24 | *x:8' },
        { i: 'cymr', v: 0.5, n: 'r:28 | *x:4' },
      ] },
      A3: { bars: 8, ch: EVE_CH, parts: [
        { ...EVE_OST, v: 0.5 }, { i: 'timp', v: 0.45, n: EVE_T }, { ...EVE_TREM, v: 0.16 },
        { i: 'hn', v: 0.6, n: EVE_M },
        { i: 'tb', v: 0.4, n: EVE_M, tr: -12 },
        { i: 'sn', v: 0.25, g: '............x.rr' },
        { i: 'bd', v: 0.42, g: 'X...............' },
        { i: 'cym', v: 0.45, n: 'x:32' },
      ] },
    },
  },
  storm: {
    name: '강철의 폭풍', desc: '말발굽 리듬과 금관', bpm: 118, gap: [8, 16],
    order: ['intro', 'A', 'B', 'A2', 'bridge'],
    sec: {
      intro: { bars: 2, ch: 'Em Em', parts: [
        ST_GAL, { i: 'sn', v: 0.42, g: DRIVE_SN },
        { i: 'timp', v: 0.5, n: 'E2:1 E2:1 E2:1 E2:1 | E2:1 E2:1 *E2:2' },
      ] },
      A: { bars: 8, ch: ST_CH, parts: [
        ST_GAL, ST_TREM,
        { i: 'hn', v: 0.66, n: ST_A },
        { i: 'tb', v: 0.45, n: ST_A, tr: -12 },
        { i: 'sn', v: 0.4, g: DRIVE_SN },
        { i: 'bd', v: 0.5, g: BD13 },
        { i: 'timp', v: 0.45, n: ST_TIMP },
        { i: 'cym', v: 0.45, n: 'x:32' },
      ] },
      B: { bars: 8, ch: 'Am Em C G | Am Em F B', parts: [
        { ...ST_GAL, v: 0.45 },
        { i: 'vln', v: 0.55, n: 'A4:2 C5:1 E5:1 | E5:2 B4:2 | C5:1 E5:1 G5:1 E5:1 | D5:4 | C5:1.5 B4:.5 A4:1 C5:1 | B4:2 G4:2 | A4:2 C5:2 | B4:4' },
        { i: 'hn', v: 0.32, pad: ['G3', 'E4'], k: 3 },
        { i: 'sn', v: 0.34, g: 'X...x.x.X...x.rr' },
        { i: 'bd', v: 0.45, g: BD13 },
        { i: 'timp', v: 0.4, n: 'A2:4 | E2:4 | C2:4 | G2:4 | A2:4 | E2:4 | F2:4 | *F#2:4' },
        { i: 'cym', v: 0.4, n: 'x:32' },
      ] },
      A2: { bars: 8, ch: ST_CH, parts: [
        ST_GAL, ST_TREM,
        { i: 'hn', v: 0.66, n: ST_A },
        { i: 'tb', v: 0.45, n: ST_A, tr: -12 },
        { i: 'tp', v: 0.38, n: ST_A, tr: 12 },
        { i: 'vln', v: 0.34, n: ST_A, tr: 12 },
        { i: 'sn', v: 0.42, g: DRIVE_SN },
        { i: 'bd', v: 0.5, g: BD13 },
        { i: 'timp', v: 0.48, n: ST_TIMP },
        { i: 'cym', v: 0.5, n: 'x:16 x:16' },
      ] },
      bridge: { bars: 4, ch: 'C D Em Em', parts: [
        { ...ST_GAL, v: 0.36 },
        { i: 'timp', v: 0.3, n: 'C2:4 | D2:4 | E2:4 | *E2:4' },
        { i: 'sn', v: 0.35, cr: [0.1, 1, 8, 16], n: 'r:8 | *x:8' },
        { ...ST_TREM, v: 0.14, k: 2 },
      ] },
    },
  },
  front: {
    name: '불타는 전선', desc: '합창과 팀파니', bpm: 72, vol: 0.95, meter: 3, gap: [10, 18],
    order: ['intro', 'A', 'B', 'A2', 'coda'],
    sec: {
      intro: { bars: 4, ch: 'Am Am Am Am', parts: [
        { ...FR_TIMP, v: 0.38 }, { ...FR_CHOIR, v: 0.28, at: [6, 12] }, { ...FR_BASS, v: 0.42 },
      ] },
      A: { bars: 8, ch: FR_CH, parts: [
        FR_TIMP, { ...FR_CHOIR, v: 0.32 }, FR_BASS,
        { i: 'hn', v: 0.55, n: FR_A },
        { i: 'tb', v: 0.38, n: FR_A, tr: -12 },
      ] },
      B: { bars: 8, ch: 'F G Em Am | Dm Bb E E', parts: [
        { ...FR_TIMP, v: 0.42 }, { ...FR_CHOIR, v: 0.36 }, FR_BASS,
        { i: 'vln', v: 0.5, n: 'C5:2 A4:1 | D5:2 B4:1 | E5:2 B4:1 | C5:3 | F5:2 E5:.5 D5:.5 | D5:2 F5:1 | E5:3 | E5:2 G#4:1' },
        { i: 'hn', v: 0.3, pad: ['F3', 'D4'], k: 3 },
        { i: 'bd', v: 0.4, g: 'X.....', s: 0.5 },
        { i: 'cym', v: 0.4, n: 'x:24' },
        { i: 'sn', v: 0.35, cr: [0.1, 1, 21, 24], n: 'r:21 | *x:3' },
      ] },
      A2: { bars: 8, ch: FR_CH, parts: [
        { ...FR_TIMP, v: 0.45 }, { ...FR_CHOIR, v: 0.36 }, FR_BASS,
        { i: 'vln', v: 0.45, n: FR_A, tr: 12 },
        { i: 'hn', v: 0.58, n: FR_A },
        { i: 'tb', v: 0.4, n: FR_A, tr: -12 },
        { i: 'bd', v: 0.42, g: 'X.....', s: 0.5 },
        { i: 'cym', v: 0.45, n: 'x:24' },
      ] },
      coda: { bars: 2, ch: 'Am Am', parts: [
        { ...FR_CHOIR, v: 0.32, cr: [1, 0.4] },
        { i: 'vc', v: 0.4, n: 'A2:6', dbl: [-12] },
        { i: 'timp', v: 0.4, cr: [1, 0.2], n: '*A2:6' },
        { i: 'hn', v: 0.45, n: 'A3:6' },
      ] },
    },
  },
  march: {
    name: '진군', desc: '이기고 있을 때의 행진곡', bpm: 112, vol: 1.1, gap: [6, 12],
    order: ['intro', 'A', 'A2', 'trio', 'A3'],
    sec: {
      intro: { bars: 2, ch: 'Bb F7', parts: [
        { i: 'sn', v: 0.48, g: 'X.x.x.x.X.x.x.x.X.x.x.x.rrrrrrrr' },
        { i: 'bd', v: 0.5, g: BD13 },
        { i: 'tb', v: 0.5, n: 'Bb2:1 r:1 F2:1 r:1 | F2:1 r:1 C3:.5 D3:.5 E3:.5 F3:.5' },
      ] },
      A: { bars: 8, ch: MA_CH, parts: [
        ...MA_BASE,
        { i: 'tp', v: 0.6, n: MA },
        { i: 'sn', v: 0.4, g: 'X.x.x.xxX.x.x.rr' },
        { i: 'timp', v: 0.38, n: MA_TIMP },
        { i: 'cym', v: 0.45, n: 'x:16 x:16' },
      ] },
      A2: { bars: 8, ch: MA_CH, parts: [
        ...MA_BASE,
        { i: 'tp', v: 0.6, n: MA },
        { i: 'vln', v: 0.28, n: MA_DESC },
        { i: 'sn', v: 0.4, g: 'X.x.x.xxX.x.x.rr' },
        { i: 'timp', v: 0.38, n: MA_TIMP },
        { i: 'cym', v: 0.45, n: 'x:32' },
      ] },
      trio: { bars: 8, ch: 'Eb Bb Bb7 Eb | Ab Eb F7 Bb', parts: [
        { i: 'hn', v: 0.58, n: MT },
        { i: 'vln', v: 0.36, n: MT },
        { i: 'spic', v: 0.28, pat: 'r:.5 C:.5 r:.5 C:.5 r:.5 C:.5 r:.5 C:.5', vrng: ['Bb3', 'G4'] },
        { i: 'tb', v: 0.42, pat: OOMPAH, rng: ['E2', 'D#3'] },
        { i: 'sn', v: 0.3, g: 'X...x.x.X...x.x.' },
        { i: 'bd', v: 0.42, g: BD13 },
        { i: 'cym', v: 0.4, n: 'x:32' },
      ] },
      A3: { bars: 8, ch: MA_CH, parts: [
        ...MA_BASE,
        { i: 'tp', v: 0.66, n: MA },
        { i: 'vln', v: 0.3, n: MA_DESC },
        { i: 'sn', v: 0.45, g: 'X.x.x.xxX.x.x.rr' },
        { i: 'timp', v: 0.45, n: MA_TIMP },
        { i: 'cym', v: 0.5, n: 'x:16 x:16' },
      ] },
    },
  },
  lastline: {
    name: '최후의 방어선', desc: '밀릴 때의 첼로 비가', bpm: 60, gap: [12, 24],
    order: ['A', 'B', 'A2'],
    sec: {
      A: { bars: 8, ch: LA_CH, parts: [
        { i: 'cello', v: 0.55, n: LA },
        { i: 'str', v: 0.2, pad: ['Ab3', 'F4'] },
        { i: 'vc', v: 0.38, n: LA_BASS },
        { i: 'timp', v: 0.3, n: LA_TIMP },
        { i: 'gong', v: 0.3, n: 'x:32' },
      ] },
      B: { bars: 8, ch: 'Db Eb Fm Fm | Db Eb C C', parts: [
        { i: 'vln', v: 0.5, n: LB },
        { i: 'hn', v: 0.36, n: LB },
        { i: 'cello', v: 0.38, n: 'F3:4 | Eb3:4 | C3:4 | Ab3:2 F3:2 | F3:4 | G3:4 | G3:2 E3:2 | C3:4' },
        { i: 'str', v: 0.2, pad: ['Ab3', 'F4'] },
        { i: 'vc', v: 0.38, n: 'Db2:4 | Eb2:4 | F2:4 | F2:4 | Db2:4 | Eb2:4 | C2:4 | C2:4' },
        { i: 'sn', v: 0.26, cr: [0.1, 1, 8, 16], n: 'r:8 | *x:8 | r:16' },
        { i: 'sn', v: 0.3, cr: [0.1, 1, 24, 32], n: 'r:24 | *x:8' },
        { i: 'timp', v: 0.35, n: 'Db2:4 | Eb2:4 | F2:4 | r:4 | Db2:4 | Eb2:4 | *C2:8' },
        { i: 'tb', v: 0.32, pad: ['C3', 'Ab3'], k: 2 },
      ] },
      A2: { bars: 8, ch: LA_CH, parts: [
        { i: 'vln', v: 0.42, n: LA, tr: 12 },
        { i: 'cello', v: 0.42, n: LA },
        { i: 'choir', v: 0.26, pad: ['F3', 'C5'], k: 3 },
        { i: 'vc', v: 0.38, n: LA_BASS },
        { i: 'timp', v: 0.3, n: LA_TIMP },
        { i: 'gong', v: 0.3, n: 'x:32' },
      ] },
    },
  },
  triumph: {
    name: '개선', desc: '팡파르와 종소리', bpm: 100, vol: 0.95, gap: [20, 40],
    order: ['intro', 'A', 'A2'],
    sec: {
      intro: { bars: 2, ch: 'D A', parts: [
        { i: 'tp', v: 0.68, n: 'D4:1/3 D4 D4 A4:1 F#4:1/3 A4 D5 F#5:1 | E5:1 A4:.5 C#5 A5:2' },
        { i: 'hn', v: 0.5, n: '[D4,F#4]:2 [D4,A4]:2 | [C#4,E4]:4' },
        { i: 'tb', v: 0.45, n: 'D3:2 D3:2 | A2:4' },
        { i: 'timp', v: 0.55, n: 'D2:1/3 D2 D2 A2:1 D2:1/3 D2 D2 A2:1 | *A2:4' },
        { i: 'sn', v: 0.38, n: 'x:1/3 x x r:1 x:1/3 x x r:1 | *x:4' },
        { i: 'cym', v: 0.5, n: 'x:8' },
      ] },
      A: { bars: 8, ch: TR_CH, parts: [
        { i: 'vln', v: 0.55, n: TR },
        { i: 'hn', v: 0.36, pad: ['D4', 'A4'], k: 3 },
        { i: 'str', v: 0.2, pad: ['F#3', 'D4'] },
        { i: 'vc', v: 0.45, n: TR_BASS },
        { i: 'timp', v: 0.42, n: TR_TIMP },
        { i: 'cym', v: 0.45, n: 'x:32' },
      ] },
      A2: { bars: 8, ch: TR_CH, parts: [
        { i: 'tp', v: 0.55, n: TR },
        { i: 'vln', v: 0.5, n: TR },
        { i: 'hn', v: 0.38, pad: ['D4', 'A4'], k: 3 },
        { i: 'str', v: 0.2, pad: ['F#3', 'D4'] },
        { i: 'vc', v: 0.45, n: TR_BASS },
        { i: 'tb', v: 0.38, n: TR_BASS },
        { i: 'timp', v: 0.5, n: TR_TIMP },
        { i: 'sn', v: 0.36, g: 'X..xX.x.X..xX.rr' },
        { i: 'bd', v: 0.45, g: BD13 },
        { i: 'cym', v: 0.5, n: 'x:16 x:16' },
        { i: 'bell', v: 0.3, n: 'D5:8 | A4:8 | D5:8 | D4:8' },
      ] },
    },
  },
  requiem: {
    name: '레퀴엠', desc: '합창과 오보에의 진혼곡', bpm: 54, vol: 1.05, gap: [16, 28],
    order: ['A', 'A2'],
    sec: {
      A: { bars: 8, ch: RQ_CH, parts: [
        { i: 'choir', v: 0.32, pad: ['A3', 'F4'], k: 3 },
        { i: 'ob', v: 0.42, n: RQ },
        { i: 'vc', v: 0.34, n: RQ_BASS },
        { i: 'bell', v: 0.16, n: RQ_BELL },
        { i: 'gong', v: 0.22, n: 'x:32' },
      ] },
      A2: { bars: 8, ch: RQ_CH, parts: [
        { i: 'choir', v: 0.35, pad: ['A3', 'F4'], k: 3 },
        { i: 'vln', v: 0.4, n: RQ },
        { i: 'ob', v: 0.28, n: RQ },
        { i: 'str', v: 0.16, pad: ['D3', 'A3'], k: 2 },
        { i: 'vc', v: 0.34, n: RQ_BASS },
        { i: 'bell', v: 0.14, n: RQ_BELL },
      ] },
    },
  },
};

// 짧은 효과 음악: 흐르던 곡 위에 겹쳐 울린다
export const STINGERS = {
  war: { name: '선전포고', bpm: 90, order: ['A'], sec: { A: { bars: 3, ch: 'Dm Dm Dm', parts: [
    { i: 'timp', v: 0.62, cr: [0.2, 1, 0, 4], n: '*D2:4 | >D2:4 | r:4' },
    { i: 'sn', v: 0.45, cr: [0.1, 1, 0, 4], n: '*x:4 | X:4 | r:4' },
    { i: 'cymr', v: 0.55, n: '*x:4 | r:8' },
    { i: 'cym', v: 0.6, n: 'r:4 | x:8' },
    { i: 'gong', v: 0.5, n: 'r:4 | x:8' },
    { i: 'bd', v: 0.7, n: 'r:4 | x:8' },
    { i: 'tb', v: 0.62, n: 'r:4 | [D2,A2,D3]:3 r:5' },
    { i: 'hn', v: 0.62, n: 'r:4 | [D4,F4,A4]:3 r:5' },
    { i: 'tp', v: 0.5, n: 'r:4 | [A4,D5]:3 r:5' },
    { i: 'str', v: 0.3, cr: [1, 0.15, 4, 12], trem: 12, n: 'r:4 | [D3,A3,D4,F4]:8' },
  ] } } },
  cap: { name: '적국 항복', bpm: 108, order: ['A'], sec: { A: { bars: 2, ch: 'Bb Bb', parts: [
    { i: 'tp', v: 0.62, n: 'F4:1/3 F4 F4 Bb4:1 D5:1/3 D5 D5 F5:1 | [D5,F5]:3 r:1' },
    { i: 'hn', v: 0.5, n: 'r:2 [Bb3,D4]:2 | [Bb3,F4]:3 r:1' },
    { i: 'tb', v: 0.42, n: 'r:4 | [Bb2,F3]:3 r:1' },
    { i: 'timp', v: 0.5, n: 'Bb2:1 F2:1 Bb2:1/3 Bb2 Bb2 F2:1 | Bb2:3 r:1' },
    { i: 'sn', v: 0.34, n: 'r:2 x:1/3 x x r:1 | x:4' },
    { i: 'cym', v: 0.45, n: 'r:4 | x:4' },
  ] } } },
  fall: { name: '동맹국 함락', bpm: 60, order: ['A'], sec: { A: { bars: 2, ch: 'Bbm F', parts: [
    { i: 'tb', v: 0.45, n: '[Bb2,Db3,F3]:4 | [A2,C3,F3]:3 r:1' },
    { i: 'hn', v: 0.4, n: 'F4:2 Db4:2 | C4:3 r:1' },
    { i: 'str', v: 0.22, n: '[F4,Bb4,Db5]:4 | [F4,A4,C5]:4' },
    { i: 'timp', v: 0.4, n: 'Bb2:4 | F2:3 r:1' },
    { i: 'gong', v: 0.4, n: 'x:8' },
  ] } } },
};

// 상황별 곡 목록(여러 곡이면 돌아가며)
export const MOODS = {
  title: ['title'], peace: ['waltz', 'dawn'], tension: ['eve'], war: ['storm', 'front'],
  advance: ['march'], crisis: ['lastline'], victory: ['triumph'], defeat: ['requiem'],
};
export const MOOD_NAME = { title: '타이틀', peace: '평화', tension: '긴장', war: '전쟁', advance: '진격', crisis: '위기', victory: '승전', defeat: '패전' };

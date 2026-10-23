// 소리 합성 부품: Float32Array 위에서 직접 계산한다(효과음·악기 소리를 한 번 그려 두고 버퍼로 다시 튼다)
// 워커와 메인 스레드가 함께 쓰므로 DOM·Web Audio를 쓰지 않는다. 길이는 초, 주파수는 Hz
export const TAU = Math.PI * 2;
export let SR = 44100; // 지금 그리는 소리의 표본율

// 같은 씨앗이면 같은 소리: xorshift 난수(변형마다 씨앗만 바꾼다)
let S = 1;
export function rnd() { S ^= S << 13; S ^= S >>> 17; S ^= S << 5; return (S >>> 0) / 4294967296; }
export function begin(sr, seed = 0) {
  SR = sr; S = (Math.imul((seed | 0) + 7, 2654435761) ^ 0x5bd1e995) | 0 || 1;
  for (let i = 0; i < 5; i++) rnd();
}
export const rr = (a, b) => a + (b - a) * rnd();
export const pick = (a) => a[Math.floor(rnd() * a.length)];
export const N = (s) => Math.max(1, Math.round(s * SR));
export const buf = (s) => new Float32Array(N(s));
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 꺾은선 [[초, 값], ...]을 표본별 값으로. exp=true면 곱셈 보간(주파수 쓸기에 자연스럽다)
export function line(pts, n, exp) {
  const out = new Float32Array(n);
  if (typeof pts === 'number') return out.fill(pts);
  let i = 0;
  for (let j = 0; j < pts.length && i < n; j++) {
    const v0 = pts[j][1], nx = pts[j + 1];
    if (!nx) { out.fill(v0, i); break; }
    const s0 = Math.round(pts[j][0] * SR), s1 = Math.min(n, Math.round(nx[0] * SR)), v1 = nx[1], len = Math.max(1, s1 - s0);
    if (i < s0) { out.fill(v0, i, Math.min(n, s0)); i = Math.min(n, s0); }
    if (exp && v0 > 0 && v1 > 0) {
      const k = Math.pow(v1 / v0, 1 / len);
      let v = v0 * Math.pow(k, i - s0);
      for (; i < s1; i++) { out[i] = v; v *= k; }
    } else {
      const d = (v1 - v0) / len;
      let v = v0 + d * (i - s0);
      for (; i < s1; i++) { out[i] = v; v += d; }
    }
  }
  return out;
}
// 빠르게 올라갔다 지수로 사라지는 세기(a: 올라가는 시간, tau: 감쇠 시상수)
export function ad(dur, a, tau) {
  const n = N(dur), o = new Float32Array(n), na = Math.max(1, Math.round(a * SR)), k = Math.exp(-1 / (tau * SR));
  let v = 1;
  for (let i = 0; i < n; i++) { if (i < na) o[i] = i / na; else { o[i] = v; v *= k; } }
  return o;
}
// 꺾은선 세기
export const env = (pts, dur) => line(pts, N(dur), false);
export function mul(x, e) { const n = Math.min(x.length, e.length); for (let i = 0; i < n; i++) x[i] *= e[i]; for (let i = n; i < x.length; i++) x[i] = 0; return x; }
export function gain(x, g) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
// 다른 소리를 at초 위치에 g배로 더한다
export function mix(dst, src, at = 0, g = 1) {
  const o = Math.round(at * SR), n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i++) dst[o + i] += src[i] * g;
  return dst;
}
export function drive(x, k) { const s = 1 / Math.tanh(k); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k) * s; return x; }

// 잡음: w 백색, p 분홍(부드러운 쉿), b 갈색(낮은 웅웅)
export function noise(dur, color = 'w') {
  const n = N(dur), o = new Float32Array(n);
  if (color === 'w') for (let i = 0; i < n; i++) o[i] = rnd() * 2 - 1;
  else if (color === 'p') {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      o[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
  } else {
    let y = 0;
    for (let i = 0; i < n; i++) { y = (y + 0.02 * (rnd() * 2 - 1)) / 1.02; o[i] = y * 3.5; }
  }
  return o;
}

// 발진기: f는 Hz 숫자나 표본별 배열. 톱니·사각은 PolyBLEP으로 접힘 잡음을 줄인다
const blep = (t, dt) => (t < dt ? ((t /= dt), t + t - t * t - 1) : t > 1 - dt ? ((t = (t - 1) / dt), t * t + t + t + 1) : 0);
export function osc(dur, f, type = 'sin', ph = 0) {
  const n = N(dur), o = new Float32Array(n), fa = typeof f === 'number' ? null : f, inv = 1 / SR;
  let p = ph, dt = fa ? 0 : f * inv;
  for (let i = 0; i < n; i++) {
    if (fa) dt = fa[i < fa.length ? i : fa.length - 1] * inv;
    let v;
    if (type === 'sin') v = Math.sin(TAU * p);
    else if (type === 'tri') v = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    else if (type === 'saw') v = 2 * p - 1 - blep(p, dt);
    else { v = (p < 0.5 ? 1 : -1) + blep(p, dt) - blep((p + 0.5) % 1, dt); }
    o[i] = v;
    p += dt; if (p >= 1) p -= 1; else if (p < 0) p += 1;
  }
  return o;
}
// 주파수 변조(FM): 반송파 fc, 변조파 = fc×ratio, 깊이 idx(배열 가능)
export function fm(dur, fc, ratio, idx) {
  const n = N(dur), o = new Float32Array(n), fa = typeof fc === 'number' ? null : fc, ia = typeof idx === 'number' ? null : idx, inv = 1 / SR;
  let pc = 0, pm = 0;
  for (let i = 0; i < n; i++) {
    const f = fa ? fa[i] : fc, I = ia ? ia[i] : idx;
    o[i] = Math.sin(TAU * pc + I * Math.sin(TAU * pm));
    pc += f * inv; pm += f * ratio * inv; pc -= Math.floor(pc); pm -= Math.floor(pm);
  }
  return o;
}

// 한 극 필터(가볍다)
export function lp1(x, fc) { const a = 1 - Math.exp(-TAU * fc / SR); let y = 0; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; } return x; }
export function hp1(x, fc) { const a = Math.exp(-TAU * fc / SR); let y = 0, px = 0; for (let i = 0; i < x.length; i++) { const v = x[i]; y = a * (y + v - px); px = v; x[i] = y; } return x; }
// 상태 변수 필터(TPT): 차단 주파수를 계속 움직여도 안정적. mode: lp·bp(봉우리 1)·hp·notch, fc는 숫자나 배열
export function svf(x, mode, fc, q = 0.707) {
  const n = x.length, fa = typeof fc === 'number' ? null : fc, k = 1 / q, lim = SR * 0.48;
  const m = mode === 'lp' ? 0 : mode === 'bp' ? 1 : mode === 'hp' ? 2 : 3;
  let s1 = 0, s2 = 0, a1 = 0, a2 = 0, a3 = 0;
  const set = (f) => { const g = Math.tan(Math.PI * Math.min(lim, Math.max(8, f)) / SR); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; };
  if (!fa) set(fc);
  for (let i = 0; i < n; i++) {
    if (fa && (i & 7) === 0) set(fa[i < fa.length ? i : fa.length - 1]);
    const v0 = x[i], v3 = v0 - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
    s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
    x[i] = m === 0 ? v2 : m === 1 ? k * v1 : m === 2 ? v0 - k * v1 - v2 : v0 - k * v1;
  }
  return x;
}
export const lp = (x, f, q) => svf(x, 'lp', f, q);
export const hp = (x, f, q) => svf(x, 'hp', f, q);
export const bp = (x, f, q) => svf(x, 'bp', f, q);

// 공명기 묶음: 들어온 소리를 [주파수, 세기, 감쇠 시상수] 모드들로 울린다(금속·나무·유리·종).
// 세기는 충격 하나를 넣었을 때 그 모드의 진폭. len: 입력보다 길게 울릴 시간(초)
export function bank(x, modes, len = 0) {
  const n = Math.max(x.length, N(len)), out = new Float32Array(n), lim = SR * 0.45, xn = x.length;
  for (const [f, a, tau] of modes) {
    if (f >= lim || f <= 0 || !a) continue;
    const r = Math.exp(-1 / (tau * SR)), w = TAU * f / SR, c = 2 * r * Math.cos(w), r2 = r * r, b = a * Math.sin(w);
    const end = Math.min(n, xn + Math.ceil(tau * SR * 7));
    let y1 = 0, y2 = 0;
    for (let i = 0; i < end; i++) { const y = (i < xn ? b * x[i] : 0) + c * y1 - r2 * y2; out[i] += y; y2 = y1; y1 = y; }
  }
  return out;
}
// 짧은 충격(딸깍): 길이 ms, 부드러움 soft(0이면 날카로운 펄스)
export function click(ms = 1, soft = 0) {
  const n = Math.max(1, Math.round(ms * SR / 1000)), o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = (soft ? Math.sin(Math.PI * (i + 0.5) / n) : 1) * (rnd() * 0.6 + 0.7) * (i % 2 && !soft ? -0.5 : 1);
  return o;
}
// 사라지는 사인 하나를 x의 at초에 더한다(f1이 있으면 그쪽으로 미끄러진다)
export function ping(x, at, f, a, tau, att = 0.002, f1 = 0) {
  const o = Math.round(at * SR), n = Math.min(x.length - o, Math.ceil(tau * SR * 7)), na = Math.max(1, att * SR), k = Math.exp(-1 / (tau * SR));
  const fk = f1 ? Math.pow(f1 / f, 1 / Math.max(1, n)) : 1;
  let p = 0, e = a, ff = f;
  for (let i = Math.max(0, -o); i < n; i++) {
    x[o + i] += Math.sin(TAU * p) * e * (i < na ? i / na : 1);
    p += ff / SR; if (p > 1) p -= 1; e *= k; ff *= fk;
  }
  return x;
}

// 카플러스-스트롱 현: 잡음 한 주기를 지연선에 넣고 거르며 되먹인다(기타·활시위·하프)
// o: t60(초, 60dB 줄어드는 시간), b(0.5 어둡게 ~ 0.1 밝게), pick(뜯는 위치 0~0.5), soft(뜯는 세기의 부드러움 Hz), body([[Hz, Q, 세기]...] 몸통 울림)
export function ks(dur, f, o = {}) {
  const n = N(dur), out = new Float32Array(n), P = SR / f, b = o.b ?? 0.5;
  const M = Math.max(2, Math.floor(P - b - 0.15)), frac = P - b - M, C = (1 - frac) / (1 + frac);
  const g = Math.pow(10, -3 / ((o.t60 ?? 3) * f));
  // 들뜸: 한 주기 잡음 → 부드럽게 → 뜯는 위치 빗살(그 배음이 빠진다)
  const L = Math.max(2, Math.round(P)), ex = new Float32Array(L);
  let y = 0, mean = 0;
  const a = 1 - Math.exp(-TAU * (o.soft ?? 4000) / SR);
  for (let i = 0; i < L; i++) { y += a * ((rnd() * 2 - 1) - y); ex[i] = y; }
  const pk = Math.round(L * (o.pick ?? 0.18));
  for (let i = L - 1; i >= pk; i--) ex[i] -= ex[i - pk];
  for (let i = 0; i < L; i++) mean += ex[i];
  mean /= L;
  for (let i = 0; i < L; i++) ex[i] -= mean;
  let v1 = 0, w1 = 0, a1 = 0;
  for (let i = 0; i < n; i++) {
    const v = i >= M ? out[i - M] : 0, w = (1 - b) * v + b * v1, ap = C * w + w1 - C * a1;
    v1 = v; w1 = w; a1 = ap;
    out[i] = (i < L ? ex[i] : 0) + g * ap;
  }
  // 몸통 울림: [주파수, Q, 세기] 띠 통과를 마른 소리에 나란히 더한다
  if (o.body) { const dry = out.slice(); for (const [bf, bq, bg] of o.body) mix(out, svf(dry.slice(), 'bp', bf, bq), 0, bg); }
  return out;
}

// 모음 포먼트(남성 기준 F1~F4)
export const VOW = {
  a: [730, 1090, 2440, 3300], e: [530, 1840, 2480, 3400], i: [300, 2200, 2900, 3500], o: [570, 840, 2410, 3300],
  u: [320, 800, 2240, 3300], '@': [520, 1190, 2390, 3300], ae: [660, 1720, 2410, 3400], ng: [300, 1300, 2300, 3300],
};
const FG = [1, 0.55, 0.22, 0.12], FQ = [7, 9, 12, 14];
// 모음 공명(F1~F4 띠 통과 나란히): vw [[초, '모음']...], fs 포먼트 배율. 32표본마다 포먼트를 옮긴다
export function formant(src, vw = [[0, 'a']], fs = 1) {
  const n = src.length, out = new Float32Array(n), inv = 1 / SR, lim = SR * 0.47;
  const st = new Float32Array(8), cf = new Float32Array(12);
  let j = 0;
  for (let i = 0; i < n; i++) {
    if ((i & 31) === 0) {
      const t = i * inv;
      while (j < vw.length - 1 && t >= vw[j + 1][0]) j++;
      const A = VOW[vw[j][1]], j1 = Math.min(j + 1, vw.length - 1), B = VOW[vw[j1][1]], t0 = vw[j][0], t1 = vw[j1][0];
      const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
      for (let k = 0; k < 4; k++) {
        const fq = Math.min(lim, (A[k] + (B[k] - A[k]) * u) * fs), g = Math.tan(Math.PI * fq / SR), kk = 1 / FQ[k], a1 = 1 / (1 + g * (g + kk));
        cf[k * 3] = a1; cf[k * 3 + 1] = g * a1; cf[k * 3 + 2] = g * g * a1;
      }
    }
    const x = src[i];
    let y = 0;
    for (let k = 0; k < 4; k++) {
      const a1 = cf[k * 3], a2 = cf[k * 3 + 1], a3 = cf[k * 3 + 2], s1 = st[k * 2], s2 = st[k * 2 + 1];
      const v3 = x - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
      st[k * 2] = 2 * v1 - s1; st[k * 2 + 1] = 2 * v2 - s2;
      y += v1 * FG[k] / FQ[k];
    }
    out[i] = y * 4;
  }
  return out;
}
// 포먼트 목소리: 성대 펄스(톱니) → 모음 공명. 사람 비명·신음, 괴물 울음에 쓴다
// o.f0 [[초, Hz]...], o.vow [[초, '모음']...], o.amp [[초, 세기]...], o.fs 포먼트 배율(작은 몸 >1, 큰 몸 <1)
// o.rough 거칠기(음높이 흔들림), o.sub 아래 배음(괴물), o.breath 숨소리, o.growl [Hz, 깊이] 으르렁 떨림, o.vib [Hz, 비율], o.drive 찌그러뜨림
export function voice(dur, o) {
  const n = N(dur), src = new Float32Array(n), f0 = line(o.f0, n, true), am = line(o.amp || [[0, 1]], n, false);
  const rough = o.rough || 0, sub = o.sub || 0, br = o.breath || 0, gr = o.growl, vib = o.vib, inv = 1 / SR;
  let p = 0, p2 = 0, pg = 0, jt = 0, nz = 0, vp = 0;
  const ja = 1 - Math.exp(-TAU * 30 / SR);
  for (let i = 0; i < n; i++) {
    jt += ja * ((rnd() * 2 - 1) - jt);
    let f = f0[i] * (1 + jt * rough * 0.12);
    if (vib) { f *= 1 + vib[1] * Math.sin(TAU * vp); vp += vib[0] * inv; }
    const dt = f * inv;
    let v = 2 * p - 1 - blep(p, dt);
    if (sub) v *= 1 + sub * Math.sin(TAU * p2);
    if (gr) { v *= 1 - gr[1] * 0.5 * (1 + Math.sin(TAU * pg)); pg += gr[0] * (1 + jt * 0.3) * inv; }
    nz += 0.5 * ((rnd() * 2 - 1) - nz);
    src[i] = (v * (1 - br * 0.6) + nz * br * 1.6) * am[i];
    p += dt; if (p >= 1) p -= 1;
    p2 += dt * 0.5; if (p2 >= 1) p2 -= 1;
  }
  lp1(src, Math.min(3500, SR * 0.3));
  const out = formant(src, o.vow || [[0, 'a']], o.fs || 1);
  if (o.drive) drive(out, o.drive);
  return out;
}
// 합창: 여러 음(Hz)의 어긋난 톱니파를 더해 모음 공명에 한 번 거른다(음마다 거르는 것보다 훨씬 가볍다)
// o.amp 세기 꺾은선, o.vow 모음 흐름, o.det 어긋남 비율, o.vib [Hz, 비율], o.fs 포먼트 배율, o.breath 숨소리
export function choir(dur, freqs, o = {}) {
  const n = N(dur), src = new Float32Array(n), det = o.det ?? 0.005, vib = o.vib ?? [5, 0.005], inv = 1 / SR;
  for (const f of freqs) for (const d of [-1, 1]) {
    const fr = f * (1 + d * det * (0.6 + rnd() * 0.4)), vr = vib[0] * (0.85 + rnd() * 0.3);
    let p = rnd(), vp = rnd(), dt = fr * inv;
    for (let i = 0; i < n; i++) {
      if ((i & 31) === 0) { dt = fr * (1 + vib[1] * Math.sin(TAU * vp)) * inv; vp += vr * 32 * inv; }
      src[i] += 2 * p - 1 - blep(p, dt);
      p += dt; if (p >= 1) p -= 1;
    }
  }
  if (o.breath) mix(src, lp1(noise(dur, 'w'), 4000), 0, o.breath);
  mul(src, env(o.amp || [[0, 0], [dur * 0.3, 1], [dur * 0.7, 1], [dur, 0]], dur));
  lp1(src, Math.min(3000, SR * 0.3));
  return formant(src, o.vow || [[0, 'a']], o.fs || 1);
}
// 금관: 살짝 어긋난 톱니 둘, 처음에 열리는 저역 통과(밝게 터졌다 가라앉는다), 아래에서 올라붙는 음정
export function brass(dur, f, o = {}) {
  const n = N(dur), a = o.a ?? 0.04, rel = o.r ?? 0.15, fc = o.bright ?? 6;
  const fr = line([[0, f * 0.97], [0.045, f], [dur, f]], n, true), x = osc(dur, fr, 'saw');
  const y = osc(dur, fr.map((v) => v * 1.004), 'saw');
  for (let i = 0; i < n; i++) x[i] = (x[i] + y[i]) * 0.5;
  svf(x, 'lp', line([[0, f * 1.2], [a * 1.5, f * fc], [a * 1.5 + 0.25, f * fc * 0.6], [dur, f * fc * 0.5]], n, true), 0.9);
  return mul(x, env([[0, 0], [a, 1], [a + 0.15, 0.8], [Math.max(a + 0.16, dur - rel), 0.7], [dur, 0]], dur));
}
// 빠른 모드 울림: [Hz, 세기, 감쇠 시상수]의 사라지는 사인들을 x의 at초에 더한다(재귀식이라 가볍다)
export function modes(x, at, list, a = 1) {
  const o = Math.round(at * SR), lim = SR * 0.45;
  for (const [f, amp, tau] of list) {
    if (f >= lim || f <= 0 || o >= x.length) continue;
    const r = Math.exp(-1 / (tau * SR)), w = TAU * f / SR, c = 2 * r * Math.cos(w), r2 = r * r, n = Math.min(x.length - o, Math.ceil(tau * SR * 7));
    let y2 = 0, y1 = amp * a * r * Math.sin(w);
    if (n > 1) x[o + 1] += y1;
    for (let i = 2; i < n; i++) { const y = c * y1 - r2 * y2; x[o + i] += y; y2 = y1; y1 = y; }
  }
  return x;
}
// 종(교회 종): 험·프라임·단3도(티어스)·5도·노미널… 어긋난 배음이 천천히 사라진다. T: 길이 배율
export function bellModes(f, T = 1, bright = 1) {
  return [[f * 0.5, 0.55, 2.2 * T], [f * 0.502, 0.25, 2.0 * T], [f, 0.6, 1.5 * T], [f * 1.19, 0.7 * bright, 1.0 * T], [f * 1.5, 0.3 * bright, 0.8 * T],
    [f * 2, 0.9 * bright, 0.7 * T], [f * 2.006, 0.3 * bright, 0.6 * T], [f * 2.52, 0.3 * bright, 0.4 * T], [f * 2.66, 0.35 * bright, 0.35 * T], [f * 3.01, 0.25 * bright, 0.3 * T],
    [f * 4.17, 0.18 * bright, 0.18 * T], [f * 5.43, 0.1 * bright, 0.1 * T]];
}
// 막대·작은 종(글로켄·차임): 자유 막대의 배음비 1 : 2.756 : 5.404
export const barModes = (f, tau = 0.5, b = 1) => [[f, 1, tau], [f * 2.756, 0.35 * b, tau * 0.45], [f * 5.404, 0.12 * b, tau * 0.2]];

// 휙: 잡음을 띠 통과 필터로 쓸며 세기는 종 모양(peak: 가장 센 지점 비율)
export function whoosh(dur, fpts, q = 1.2, peak = 0.45, color = 'p') {
  const n = N(dur), x = noise(dur, color), pk = Math.max(1, Math.round(n * peak));
  svf(x, 'bp', line(fpts, n, true), q);
  for (let i = 0; i < n; i++) { const u = i < pk ? i / pk : 1 - (i - pk) / (n - pk); x[i] *= u * u * (3 - 2 * u); }
  return x;
}
// 탁탁 튀는 소리: 초당 rate개의 짧은 잡음 알갱이(불꽃·전기·자갈)
export function crackle(dur, rate, fLo = 1200, fHi = 7000, tau = 0.0012, shape = null) {
  const n = N(dur), x = new Float32Array(n), m = Math.ceil(tau * SR * 6), k = Math.exp(-1 / (tau * SR));
  let t = 0;
  for (;;) {
    t += -Math.log(1 - rnd() * 0.999) / rate;
    const i0 = Math.floor(t * SR);
    if (i0 >= n) break;
    let a = Math.pow(rnd(), 2.2) * (shape ? shape[i0] : 1), e = 1;
    if (rnd() < 0.5) a = -a;
    for (let i = i0; i < Math.min(n, i0 + m); i++) { x[i] += (rnd() * 2 - 1) * a * e; e *= k; }
  }
  if (fLo) hp1(hp1(x, fLo), fLo);
  if (fHi) lp1(x, fHi);
  return x;
}
// 반짝임: 높은 사인 핑을 흩뿌린다. notes가 있으면 그 음들 가운데서 고른다(마법이 음악과 어울리게)
export function sparkle(x, at, dur, count, fLo, fHi, tau = 0.09, a = 1, notes = null) {
  for (let k = 0; k < count; k++) {
    const t = at + dur * Math.pow(rnd(), 0.8), f = notes ? notes[Math.floor(rnd() * notes.length)] * (1 + (rnd() - 0.5) * 0.004) : fLo * Math.pow(fHi / fLo, rnd()), tt = tau * (0.6 + 0.8 * rnd());
    modes(x, t, [[f, 1, tt], [f * 2.756, 0.12 * rnd(), tt * 0.3]], a * (0.4 + 0.6 * rnd()));
  }
  return x;
}
// 쿵: 아래로 미끄러지는 사인(몸통) + 짧은 잡음(타격면)
export function boom(dur, f0, f1, tau, nz = 0.5, nzf = 600) {
  const n = N(dur), x = osc(dur, line([[0, f0], [Math.min(dur, tau * 2.5), f1]], n, true));
  mul(x, ad(dur, 0.003, tau));
  if (nz) { const z = noise(Math.min(dur, tau * 3), 'w'); lp(z, nzf, 0.8); mul(z, ad(Math.min(dur, tau * 3), 0.001, tau * 0.35)); mix(x, z, 0, nz); }
  return x;
}
// 마무리: 직류 제거, 끝 다듬기, 뒤쪽 무음 잘라 내기, 크기 맞추기(짧은 창의 가장 큰 RMS를 목표로, 봉우리는 넘지 않게)
export function finish(x, o = {}) {
  hp1(x, o.hp ?? 18);
  let peak = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
  if (!(peak > 1e-9)) return new Float32Array(Math.min(x.length, 64));
  let end = x.length;
  if (!o.keep) { const th = peak * 6e-4; while (end > 1 && Math.abs(x[end - 1]) < th) end--; end = Math.min(x.length, end + Math.round(0.01 * SR)); }
  const y = x.slice(0, end), w = Math.max(16, Math.round(0.03 * SR));
  let best = 0, acc = 0;
  for (let i = 0; i < y.length; i++) { acc += y[i] * y[i]; if (i >= w) acc -= y[i - w] * y[i - w]; if (acc > best) best = acc; }
  const rms = Math.sqrt(Math.max(best, 1e-12) / Math.min(w, y.length));
  const g = Math.min((o.rms ?? 0.22) / rms, (o.peak ?? 0.95) / peak);
  const fi = Math.min(y.length, Math.round(0.0015 * SR)), fo = Math.min(y.length, Math.round((o.fade ?? 0.012) * SR));
  for (let i = 0; i < y.length; i++) y[i] *= g;
  for (let i = 0; i < fi; i++) y[i] *= i / fi;
  if (!o.keep) for (let i = 0; i < fo; i++) y[y.length - 1 - i] *= i / fo;
  return y;
}
// 이음매 없는 반복: 끝부분을 앞부분에 겹쳐 섞는다(같은 힘으로 교차)
export function loopify(x, fade) {
  const f = Math.min(Math.floor(x.length / 3), Math.round(fade * SR)), n = x.length - f, y = x.slice(0, n);
  for (let i = 0; i < f; i++) { const u = i / f; y[i] = x[i] * Math.sin(u * Math.PI / 2) + x[n + i] * Math.cos(u * Math.PI / 2); }
  return y;
}
// 반복 소리 크기 맞추기(전체 RMS 기준)
export function level(x, target = 0.2, peakMax = 0.95) {
  let s = 0, pk = 0;
  for (let i = 0; i < x.length; i++) { s += x[i] * x[i]; const a = Math.abs(x[i]); if (a > pk) pk = a; }
  const rms = Math.sqrt(s / x.length) || 1e-9;
  return gain(x, Math.min(target / rms, peakMax / (pk || 1)));
}

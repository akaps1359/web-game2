// 배경음악 합성기: 음원 파일 없이 Web Audio로 관현악 소리를 만든다
// 악기마다 배음(파형)·필터·엔벨로프·비브라토를 달리해 현악·금관·목관·피아노·타악기를 흉내 내고, 홀 잔향을 입힌다

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 악기: k=발음 방식, g=음량, wet=잔향 비율, pan=좌우 위치(오케스트라 배치)
export const INST = {
  vln: { k: 'ens', w: 'saw', n: 2, det: 10, cut: 3, add: 900, a: 0.09, r: 0.35, vib: [5.6, 11, 0.16], g: 0.2, wet: 0.5, pan: -0.25 },
  str: { k: 'ens', w: 'saw', n: 2, det: 12, cut: 2.4, add: 650, a: 0.35, r: 0.8, g: 0.13, wet: 0.6, pan: 0.05 },
  vc: { k: 'ens', w: 'saw', n: 2, det: 7, cut: 3.4, add: 260, a: 0.09, r: 0.4, vib: [5, 6, 0.3], g: 0.13, wet: 0.4, pan: 0.25 },
  cello: { k: 'ens', w: 'saw', n: 1, det: 0, cut: 3.8, add: 380, a: 0.13, r: 0.45, vib: [5.3, 15, 0.2], g: 0.27, wet: 0.5, pan: 0.15 },
  spic: { k: 'pluck', w: 'soft', det: 8, dec: 0.15, decK: 0.15, g: 0.22, wet: 0.3, pan: 0.15 },
  pizz: { k: 'pluck', w: 'soft', det: 3, dec: 0.3, decK: 0.35, ring: 1, g: 0.32, wet: 0.45, pan: 0.2 },
  hn: { k: 'brass', w: 'brass', det: 5, cut: 1.6, cutV: 2.8, add: 160, q: 0.8, a: 0.075, r: 0.3, vib: [4.8, 5, 0.35], g: 0.26, wet: 0.5, pan: -0.15 },
  tp: { k: 'brass', w: 'brass', det: 4, cut: 2.4, cutV: 4.5, add: 350, q: 1.1, a: 0.035, r: 0.2, vib: [5.3, 7, 0.3], g: 0.24, wet: 0.4, pan: 0.2 },
  tb: { k: 'brass', w: 'brass', det: 6, cut: 1.8, cutV: 3, add: 110, q: 0.9, a: 0.06, r: 0.25, vib: [4.6, 3, 0.4], g: 0.2, wet: 0.4, pan: 0.3 },
  fl: { k: 'wind', w: 'flute', cut: 5, add: 1500, a: 0.06, r: 0.14, vib: [5, 12, 0.18], breath: 0.05, g: 0.2, wet: 0.55, pan: -0.3 },
  cl: { k: 'wind', w: 'reed', cut: 4, add: 500, a: 0.05, r: 0.14, vib: [4.6, 3, 0.4], g: 0.17, wet: 0.5, pan: 0.3 },
  ob: { k: 'wind', w: 'oboe', cut: 4.5, add: 800, a: 0.05, r: 0.14, vib: [5.2, 10, 0.22], g: 0.35, wet: 0.55, pan: 0.1 },
  pno: { k: 'pluck', w: 'piano', dark: 'flute', det: 2, dec: 1.5, decK: 0.55, bright: 0.25, hammer: 0.06, g: 0.3, wet: 0.35, pan: 0 },
  harp: { k: 'pluck', w: 'harp', dark: 'flute', det: 2, dec: 1.4, decK: 0.5, bright: 0.3, ring: 1, g: 0.17, wet: 0.55, pan: -0.2 },
  cel: { k: 'pluck', w: 'cel', det: 0, dec: 0.8, decK: 0.25, ring: 1, g: 0.18, wet: 0.6, pan: 0.25 },
  choir: { k: 'choir', det: 10, a: 0.55, r: 1.1, vib: [5, 14, 0.25], g: 0.31, wet: 0.7, pan: 0 },
  timp: { k: 'timp', g: 0.22, wet: 0.45, pan: 0.05 },
  sn: { k: 'sn', g: 0.45, wet: 0.3, pan: -0.05 },
  bd: { k: 'bd', g: 0.18, wet: 0.35, pan: 0 },
  cym: { k: 'cym', g: 0.3, wet: 0.35, pan: 0.15 },
  cymr: { k: 'cymr', g: 0.17, wet: 0.45, pan: 0.15 },
  gong: { k: 'gong', g: 0.55, wet: 0.55, pan: 0 },
  bell: { k: 'bell', g: 0.22, wet: 0.6, pan: -0.1 },
};

// 배음 진폭 목록으로 만든 파형
function periodic(ctx, amps) {
  const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1);
  for (let i = 0; i < amps.length; i++) im[i + 1] = amps[i];
  return ctx.createPeriodicWave(re, im);
}
function waves(ctx) {
  const mk = (fn, n = 40) => periodic(ctx, Array.from({ length: n }, (_, i) => fn(i + 1)));
  return {
    saw: mk((n) => 1 / Math.pow(n, 1.1)), // 현악: 톱니파보다 약간 부드럽게
    soft: mk((n) => 1 / Math.pow(n, 1.7), 24), // 짧게 끊는 현·피치카토
    brass: mk((n) => 1 / Math.pow(n, 0.8)), // 금관: 높은 배음이 강하다
    reed: mk((n) => (n % 2 ? 1 / n : 0.05 / n)), // 클라리넷: 홀수 배음
    oboe: mk((n) => [0.45, 0.85, 1, 0.75, 0.5, 0.36, 0.25][n - 1] ?? 0.2 / (n - 6)), // 오보에: 가운데 배음이 두드러진다
    flute: mk((n) => [1, 0.2, 0.07, 0.03][n - 1] ?? 0, 4),
    piano: mk((n) => Math.pow(0.58, n - 1) * (n % 8 === 0 ? 0.2 : 1), 24),
    harp: mk((n) => 1 / (n * n), 16),
    cel: mk((n) => [1, 0.08, 0, 0.22][n - 1] ?? 0, 4),
  };
}
function noiseBuf(ctx) {
  const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
// 홀 잔향: 초기 반사 몇 개 + 시간이 갈수록 어두워지는 지수 감쇠 잡음
function impulse(ctx, sec) {
  const sr = ctx.sampleRate, len = Math.floor(sr * sec), b = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr, u = t / sec;
      lp += (0.6 - 0.48 * u) * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-6.9 * u) * Math.min(1, t / 0.015);
    }
    for (const [ms, g] of [[9, 0.5], [17, 0.38], [26, 0.3], [37, 0.24], [51, 0.16], [68, 0.1]]) d[Math.floor(sr * (ms + ch * 2.5) / 1000)] += g * (Math.random() < 0.5 ? -1 : 1);
  }
  return b;
}

// 게인을 지금 값에서 이어서 바꾼다(진행 중인 변화를 기억해 끊김·딸깍 소리를 막는다)
export function glide(node, to, t, dur) {
  const g = node.gain, r = node._r || { v0: g.value, v1: g.value, t0: 0, t1: 0 };
  const cur = t >= r.t1 ? r.v1 : t <= r.t0 ? r.v0 : r.v0 + (r.v1 - r.v0) * (t - r.t0) / (r.t1 - r.t0);
  g.cancelScheduledValues(t); g.setValueAtTime(cur, t); g.linearRampToValueAtTime(to, t + dur);
  node._r = { v0: cur, v1: to, t0: t, t1: t + dur };
}

export class Synth {
  constructor(ctx) {
    this.ctx = ctx;
    this.w = waves(ctx);
    this.noise = noiseBuf(ctx);
    this.cache = new Map(); this.jobs = Promise.resolve();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.rev = ctx.createConvolver(); this.rev.buffer = impulse(ctx, 2);
    const ret = ctx.createGain(); ret.gain.value = 0.5;
    this.rev.connect(ret); ret.connect(this.master);
  }
  // 곡 하나의 출력 묶음: 곡마다 따로 두어 한꺼번에 줄이거나 끊는다
  bus() {
    const c = this.ctx, dry = c.createGain(), wet = c.createGain();
    dry.connect(this.master); wet.connect(this.rev);
    return { dry, wet, inst: {}, lfos: [] };
  }
  // 곡이 끝나면 악기 묶음에 달린 떨림 발진기를 멈춘다
  close(B) { for (const l of B.lfos) try { l.stop(); } catch { /* 이미 멈춤 */ } B.lfos = []; }
  inst(B, name, trem) {
    const key = trem ? name + '~' + trem : name;
    let n = B.inst[key];
    if (n) return n;
    const c = this.ctx, P = INST[name];
    n = c.createGain(); n.gain.value = P.g;
    let o = n;
    if (P.k === 'choir') o = this.formants(n); // 합창은 모음 필터를 악기 전체가 함께 쓴다(음마다 두면 무겁다)
    if (trem) { // 트레몰로(활을 빠르게 긋는 떨림)도 음마다가 아니라 악기 묶음에 한 번
      const tg = c.createGain(), l = c.createOscillator(), ld = c.createGain();
      tg.gain.value = 0.6; ld.gain.value = 0.4; l.frequency.value = trem;
      l.connect(ld); ld.connect(tg.gain); l.start(); B.lfos.push(l);
      o.connect(tg); o = tg;
    }
    if (P.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = P.pan; n.connect(p); o = p; }
    o.connect(B.dry);
    const s = c.createGain(); s.gain.value = P.wet; o.connect(s); s.connect(B.wet);
    return (B.inst[key] = n);
  }
  note(B, e, t, d) {
    const P = INST[e.i];
    if (!P) return;
    const out = this.inst(B, e.i, e.trem), f = e.m != null ? mtof(e.m) : 0, v = e.v;
    if (!e.roll) { const s = this.sample(e, P); if (s) return this.play(out, s.b, t, v / s.v, P.k === 'pluck' && !P.ring ? t + Math.max(d, 0.05) : Infinity); }
    switch (P.k) {
      case 'ens': return this.ens(out, P, t, d, f, v, e);
      case 'brass': return this.brass(out, P, t, d, f, v);
      case 'wind': return this.wind(out, P, t, d, f, v);
      case 'pluck': return this.pluck(out, P, t, d, f, v);
      case 'choir': return this.choir(out, P, t, d, f, v);
      case 'timp': return e.roll ? this.troll(out, t, d, f, v, e.v1 ?? v) : this.timp(out, t, f, v);
      case 'sn': return e.roll ? this.sroll(out, t, d, v, e.v1 ?? v) : this.snare(out, t, v);
      case 'bd': return this.bd(out, t, v);
      case 'cym': return this.cym(out, t, v);
      case 'cymr': return this.cymr(out, t, d, v);
      case 'gong': return this.gong(out, t, v);
      case 'bell': return this.bell(out, t, f, v);
    }
  }
  // 같은 소리를 되풀이하는 타악기·종은 처음 한 번 오프라인으로 녹음해 두고 다시 튼다(매번 합성하는 것보다 훨씬 가볍다)
  // 녹음이 끝나기 전에는 실시간으로 합성한다
  warm(e) { if (!e.roll && INST[e.i]) this.sample(e, INST[e.i]); }
  ready() { return this.jobs; }
  sample(e, P) {
    let key, ref = 1, dur, sr = 22050, draw;
    switch (P.k) {
      case 'pluck': { // 피아노·하프: 음높이마다 한 번 녹음(두 층 + 해머 소리를 매번 합성하지 않는다)
        if (!P.dark || e.m == null) return null;
        const f = mtof(e.m);
        key = e.i + e.m; ref = 0.6; dur = Math.min(3, P.dec * Math.pow(220 / f, P.decK) * 4 + 0.1);
        draw = (x, o) => { x.w = waves(x.ctx); x.pluck(o, { ...P, ring: 1 }, 0.004, 99, f, ref); };
        break;
      }
      case 'sn': { const L = e.v < 0.28 ? 0 : e.v < 0.55 ? 1 : 2; ref = [0.2, 0.42, 0.75][L]; key = 'sn' + L; dur = 0.25; sr = this.ctx.sampleRate; draw = (x, o) => x.snare(o, 0.004, ref); break; }
      case 'timp': key = 'timp' + e.m; dur = 2; draw = (x, o) => x.timp(o, 0.004, mtof(e.m), 1); break;
      case 'bd': key = 'bd'; dur = 1.3; draw = (x, o) => x.bd(o, 0.004, 1); break;
      case 'cym': key = 'cym'; dur = 3.5; sr = this.ctx.sampleRate; draw = (x, o) => x.cym(o, 0.004, 1); break;
      case 'gong': key = 'gong'; dur = 6; draw = (x, o) => x.gong(o, 0.004, 1); break;
      case 'bell': key = 'bell' + e.m; dur = 6; draw = (x, o) => x.bell(o, 0.004, mtof(e.m), 1); break;
      default: return null;
    }
    let rec = this.cache.get(key);
    if (!rec) {
      rec = { b: null, v: ref };
      this.cache.set(key, rec);
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (OAC) this.jobs = this.jobs.then(() => new Promise((res) => {
        try {
          const oc = new OAC(1, Math.ceil(sr * dur), sr), x = Object.create(Synth.prototype);
          x.ctx = oc; x.noise = this.noise;
          draw(x, oc.destination);
          oc.oncomplete = (ev) => { rec.b = ev.renderedBuffer; res(); };
          const p = oc.startRendering();
          if (p?.then) p.then((b) => { rec.b = b; res(); }, res);
        } catch { res(); }
      }));
    }
    return rec.b ? rec : null;
  }
  play(out, b, t, v, off) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; g.gain.value = v;
    s.connect(g); g.connect(out); s.start(t);
    if (off < t + b.duration) { g.gain.setValueAtTime(v, off); g.gain.setTargetAtTime(0, off, 0.05); s.stop(off + 0.3); }
  }
  noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    s.start(t, Math.random() * 1.8); s.stop(t + dur);
    return s;
  }
  // 늦게 시작해 서서히 깊어지는 비브라토: 긴 음에만, 주파수(Hz)에 직접 더한다(센트 단위 detune보다 계산이 가볍다)
  vib(f, t, end, V, d) {
    if (!V || d < 0.6) return null;
    const c = this.ctx, l = c.createOscillator(), g = c.createGain();
    l.frequency.value = V[0] * (0.92 + Math.random() * 0.16);
    g.gain.setValueAtTime(0, t); g.gain.setValueAtTime(0, t + V[2]); g.gain.linearRampToValueAtTime(f * V[1] * 0.000578, t + V[2] + 0.4);
    l.connect(g); l.start(t); l.stop(end);
    return g;
  }
  env(g, t, d, v, A, R) {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + A);
    g.gain.setValueAtTime(v, t + d); g.gain.setTargetAtTime(0, t + d, R / 3);
  }
  // 현악 합주·첼로: 살짝 어긋난 톱니파를 저역 통과
  ens(out, P, t, d, f, v, e) {
    const c = this.ctx, A = Math.min(e.a ?? P.a, d * 0.6), end = t + d + P.r * 1.6 + 0.05;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.value = Math.min(15000, f * P.cut * (0.7 + 0.5 * v) + P.add);
    const g = c.createGain(); this.env(g, t, d, v, A, P.r);
    const vib = this.vib(f, t, end, P.vib, d);
    for (let i = 0; i < P.n; i++) {
      const o = c.createOscillator(); o.setPeriodicWave(this.w[P.w]); o.frequency.value = f;
      if (P.n > 1) o.detune.value = (i - (P.n - 1) / 2) * P.det + (Math.random() - 0.5) * 4;
      if (vib) vib.connect(o.frequency);
      o.connect(lp); o.start(t + i * 0.006); o.stop(end);
    }
    lp.connect(g); g.connect(out);
  }
  // 금관: 셀수록 밝아지는 필터, 아래에서 올라붙는 음정. 짧은 음은 가볍게(필터 고정, 파형 하나)
  brass(out, P, t, d, f, v) {
    const c = this.ctx, A = Math.min(P.a, d * 0.5), end = t + d + P.r * 1.6 + 0.05, long = d >= 0.3;
    const lo = Math.min(14000, f * 1.2 + 90), hi = Math.min(14000, f * (P.cut + P.cutV * v) + P.add);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = P.q;
    if (long) {
      lp.frequency.setValueAtTime(lo, t); lp.frequency.linearRampToValueAtTime(hi, t + A * 1.5);
      lp.frequency.setTargetAtTime(lo + (hi - lo) * 0.65, t + A * 1.5, 0.3);
      lp.frequency.setTargetAtTime(lo, t + d, P.r / 2);
    } else lp.frequency.value = lo + (hi - lo) * 0.7;
    const g = c.createGain(), vv = d >= 0.6 ? v : v * 1.4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vv, t + A);
    g.gain.setTargetAtTime(vv * 0.8, t + A, 0.25); g.gain.setTargetAtTime(0, t + d, P.r / 3);
    const vib = this.vib(f, t, end, P.vib, d);
    for (const s of d >= 0.6 ? [-1, 1] : [0]) {
      const o = c.createOscillator(); o.setPeriodicWave(this.w[P.w]);
      if (long) { o.frequency.setValueAtTime(f * 0.985, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); } else o.frequency.value = f;
      o.detune.value = s * P.det;
      if (vib) vib.connect(o.frequency);
      o.connect(lp); o.start(t); o.stop(end);
    }
    lp.connect(g); g.connect(out);
  }
  // 목관: 단일 파형 + (플루트는) 숨소리
  wind(out, P, t, d, f, v) {
    const c = this.ctx, A = Math.min(P.a, d * 0.5), end = t + d + P.r * 1.6 + 0.05;
    const o = c.createOscillator(); o.setPeriodicWave(this.w[P.w]); o.frequency.value = f;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6; lp.frequency.value = Math.min(14000, f * P.cut + P.add);
    const g = c.createGain(); this.env(g, t, d, v, A, P.r);
    const vib = this.vib(f, t, end, P.vib, d);
    if (vib) vib.connect(o.frequency);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(end);
    if (P.breath) {
      const n = this.noiseSrc(t, Math.min(end - t, 0.4)), bp = c.createBiquadFilter(), ng = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 2.5); bp.Q.value = 1.2;
      ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(v * P.breath * 2.5, t + 0.03); ng.gain.setTargetAtTime(0, t + 0.03, 0.1);
      n.connect(bp); bp.connect(ng); ng.connect(out);
    }
  }
  // 뜯거나 치는 악기(피아노·하프·피치카토·짧은 현): 밝은 층은 빨리, 어두운 층은 천천히 사라져 음색이 어두워지는 것을 흉내 낸다
  // (필터를 매 샘플 움직이는 것보다 훨씬 가볍다). 낮은 음일수록 오래 울린다
  pluck(out, P, t, d, f, v) {
    const c = this.ctx, tau = P.dec * Math.pow(220 / f, P.decK);
    const off = P.ring ? Infinity : t + Math.max(d, 0.05);
    const two = P.dark && (P.ring || d > 0.4); // 짧게 끊는 음은 한 층만
    for (const [w, a, k] of two ? [[P.w, 0.65, tau * P.bright], [P.dark, 0.5, tau]] : [[P.w, 1, P.dark ? tau * 0.5 : tau]]) {
      const o = c.createOscillator(), g = c.createGain(), end = Math.min(t + k * 5, off + 0.16) + 0.02;
      o.setPeriodicWave(this.w[w]); o.frequency.value = f;
      if (P.det) o.detune.value = (Math.random() - 0.5) * 2 * P.det;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * a, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, k);
      if (off < end) g.gain.setTargetAtTime(0, off, 0.05);
      o.connect(g); g.connect(out); o.start(t); o.stop(end);
    }
    if (P.hammer && v > 0.35) {
      const n = this.noiseSrc(t, 0.06), bp = c.createBiquadFilter(), hg = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = Math.min(8000, f * 4); bp.Q.value = 0.8;
      hg.gain.setValueAtTime(v * P.hammer, t); hg.gain.setTargetAtTime(0, t, 0.012);
      n.connect(bp); bp.connect(hg); hg.connect(out);
    }
  }
  // 합창 "아": 모음 포먼트 대역 통과 필터 세 개 + 낮은 몸통
  formants(src) {
    const c = this.ctx, mix = c.createGain();
    for (const [fq, q, a] of [[700, 5, 1], [1120, 7, 0.55], [2650, 9, 0.3]]) {
      const bp = c.createBiquadFilter(), ga = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q; ga.gain.value = a;
      src.connect(bp); bp.connect(ga); ga.connect(mix);
    }
    const lp = c.createBiquadFilter(), lg = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 600; lg.gain.value = 0.18;
    src.connect(lp); lp.connect(lg); lg.connect(mix);
    return mix;
  }
  choir(out, P, t, d, f, v) {
    const c = this.ctx, A = Math.min(P.a, d * 0.6), end = t + d + P.r * 1.6 + 0.05;
    const g = c.createGain(); this.env(g, t, d, v, A, P.r);
    const vib = this.vib(f, t, end, P.vib, d);
    for (const s of [-1, 1]) {
      const o = c.createOscillator(); o.setPeriodicWave(this.w.saw); o.frequency.value = f; o.detune.value = s * P.det;
      if (vib) vib.connect(o.frequency);
      o.connect(g); o.start(t); o.stop(end);
    }
    g.connect(out);
  }
  // 팀파니: 어긋난 배음(1, 1.5, 2, 2.44배) + 말렛 타격음
  timp(out, t, f, v) {
    const c = this.ctx, end = t + 2, g = c.createGain();
    g.gain.value = v; g.connect(out);
    for (const [r, a, tau] of [[1, 1, 0.6], [1.5, 0.45, 0.38], [1.99, 0.25, 0.28], [2.44, 0.12, 0.2]]) {
      const o = c.createOscillator(), pg = c.createGain();
      o.frequency.setValueAtTime(f * r * 1.02, t); o.frequency.exponentialRampToValueAtTime(f * r, t + 0.12);
      pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(a, t + 0.004); pg.gain.setTargetAtTime(0, t + 0.004, tau);
      o.connect(pg); pg.connect(g); o.start(t); o.stop(Math.min(end, t + tau * 6));
    }
    const n = this.noiseSrc(t, 0.2), lp = c.createBiquadFilter(), ng = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    ng.gain.setValueAtTime(0.5, t); ng.gain.setTargetAtTime(0, t, 0.025);
    n.connect(lp); lp.connect(ng); ng.connect(g);
  }
  // 팀파니 롤: 떨리는 지속음이 점점 세진다
  troll(out, t, d, f, v0, v1) {
    const c = this.ctx, end = t + d + 1.5, g = c.createGain(), am = c.createGain();
    g.gain.setValueAtTime(Math.max(0.001, v0), t); g.gain.linearRampToValueAtTime(v1, t + d); g.gain.setTargetAtTime(0, t + d, 0.3);
    am.gain.value = 0.65;
    const l = c.createOscillator(), ld = c.createGain();
    l.frequency.value = 12.5; ld.gain.value = 0.35; l.connect(ld); ld.connect(am.gain); l.start(t); l.stop(end);
    for (const [r, a] of [[1, 0.8], [1.5, 0.3]]) {
      const o = c.createOscillator(), pg = c.createGain();
      o.frequency.value = f * r; pg.gain.value = a;
      o.connect(pg); pg.connect(am); o.start(t); o.stop(end);
    }
    const n = this.noiseSrc(t, end - t), lp = c.createBiquadFilter(), ng = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 500; ng.gain.value = 0.3;
    n.connect(lp); lp.connect(ng); ng.connect(am);
    am.connect(g); g.connect(out);
  }
  // 작은북: 띠 잡음(몸통) + 높은 잡음(스네어 줄) + 짧은 삼각파(가죽)
  snare(out, t, v) {
    const c = this.ctx, n = this.noiseSrc(t, 0.35);
    const bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 2400 + v * 1400; bp.Q.value = 0.9;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, 0.04 + 0.04 * v);
    n.connect(bp); bp.connect(g); g.connect(out);
    const hp = c.createBiquadFilter(), g2 = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 5000;
    g2.gain.setValueAtTime(v * 0.45, t); g2.gain.setTargetAtTime(0, t, 0.08);
    n.connect(hp); hp.connect(g2); g2.connect(out);
    const o = c.createOscillator(), g3 = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(155, t + 0.06);
    g3.gain.setValueAtTime(v * 0.8, t); g3.gain.setTargetAtTime(0, t, 0.022);
    o.connect(g3); g3.connect(out); o.start(t); o.stop(t + 0.15);
  }
  // 작은북 롤: 잡음을 빠르게 떨어 연타처럼
  sroll(out, t, d, v0, v1) {
    const c = this.ctx, end = t + d + 0.3, n = this.noiseSrc(t, end - t);
    const bp = c.createBiquadFilter(), am = c.createGain(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.8;
    am.gain.value = 0.6;
    const l = c.createOscillator(), ld = c.createGain();
    l.type = 'triangle'; l.frequency.value = 17; ld.gain.value = 0.4; l.connect(ld); ld.connect(am.gain); l.start(t); l.stop(end);
    g.gain.setValueAtTime(Math.max(0.001, v0 * 0.7), t); g.gain.linearRampToValueAtTime(v1 * 0.7, t + d); g.gain.setTargetAtTime(0, t + d, 0.04);
    n.connect(bp); bp.connect(am); am.connect(g); g.connect(out);
  }
  // 큰북
  bd(out, t, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.14);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.setTargetAtTime(0, t + 0.006, 0.3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.2);
    const n = this.noiseSrc(t, 0.2), lp = c.createBiquadFilter(), ng = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 300;
    ng.gain.setValueAtTime(v * 0.5, t); ng.gain.setTargetAtTime(0, t, 0.04);
    n.connect(lp); lp.connect(ng); ng.connect(out);
  }
  // 심벌즈: 빠르게 줄었다가 길게 남는 높은 잡음
  cym(out, t, v) {
    const c = this.ctx, n = this.noiseSrc(t, 3.5);
    const hp = c.createBiquadFilter(), pk = c.createBiquadFilter(), g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    pk.type = 'peaking'; pk.frequency.value = 7000; pk.gain.value = 6; pk.Q.value = 0.8;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.setTargetAtTime(v * 0.35, t + 0.004, 0.12); g.gain.setTargetAtTime(0, t + 0.15, 0.85);
    n.connect(hp); hp.connect(pk); pk.connect(g); g.connect(out);
  }
  // 서스펜디드 심벌 롤: 점점 커지는 쉬익 소리
  cymr(out, t, d, v) {
    const c = this.ctx, n = this.noiseSrc(t, d + 2), hp = c.createBiquadFilter(), g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 4000;
    g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.002, v), t + d); g.gain.setTargetAtTime(0, t + d, 0.4);
    n.connect(hp); hp.connect(g); g.connect(out);
  }
  // 징(탐탐): 낮고 어긋난 배음이 길게 운다
  gong(out, t, v) {
    const c = this.ctx, end = t + 6, g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.05); g.gain.setTargetAtTime(0, t + 0.05, 1.5);
    g.connect(out);
    for (const [fq, a] of [[62, 1], [91, 0.75], [129, 0.6], [161, 0.5], [214, 0.38], [262, 0.3], [347, 0.22], [431, 0.15]]) {
      const o = c.createOscillator(), pg = c.createGain();
      o.frequency.value = fq * (1 + (Math.random() - 0.5) * 0.012); pg.gain.value = a * 0.28;
      o.connect(pg); pg.connect(g); o.start(t); o.stop(end);
    }
    const n = this.noiseSrc(t, 3), bp = c.createBiquadFilter(), ng = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 450; bp.Q.value = 0.7;
    ng.gain.setValueAtTime(0.25, t); ng.gain.setTargetAtTime(0, t, 0.5);
    n.connect(bp); bp.connect(ng); ng.connect(g);
  }
  // 종: FM 합성(어긋난 비율로 금속성 배음) + 한 옥타브 아래 웅웅거림
  bell(out, t, f, v) {
    const c = this.ctx, end = t + 6;
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 1.41;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.setTargetAtTime(f * 0.3, t, 0.5);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, 1.4);
    car.connect(g); g.connect(out);
    const hum = c.createOscillator(), hg = c.createGain();
    hum.frequency.value = f / 2;
    hg.gain.setValueAtTime(0, t); hg.gain.linearRampToValueAtTime(v * 0.35, t + 0.01); hg.gain.setTargetAtTime(0, t + 0.01, 2.2);
    hum.connect(hg); hg.connect(out);
    for (const o of [car, mod, hum]) { o.start(t); o.stop(end); }
  }
}

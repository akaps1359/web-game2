// 배경음악 감독: 곡마다 작곡기(tracks.js)가 고른 악절을 미리 예약해 연주하고(룩어헤드), 곡을 서로 겹쳐 바꾼다
// 뜯고 치는 악기는 미리 그린 버퍼로, 길게 끄는 합창·현·지속음은 발진기로 그때그때 만든다
import { glide, kit, formants, mtof } from './wa.js';
import { TRACKS, STING_DEFS } from './tracks.js';
export { TRACKS, STING_DEFS };

const LOOK = 1.4; // 미리 예약해 두는 시간(초): 게임 계산으로 메인 스레드가 잠깐 멈춰도 끊기지 않게
const XF = 2.5; // 곡을 바꿀 때 겹치는 시간(초)

// 악기: k 소리 방식(b 버퍼 · choir 합창 · str 현 · drone 지속음 · dist 찌그러진 지속음 · brass 금관 · ost 짧은 현 · glass 유리 · whisp 바람 소리)
// g 크기, wet 잔향 비율, pan 좌우 자리, n 변형 수(음높이 없는 타악기), a·r 올라오고 사라지는 시간, vow 합창 모음
const INST = {
  gtr: { k: 'b', g: 0.55, wet: 0.35 }, harp: { k: 'b', g: 0.4, wet: 0.5, pan: -0.2 }, pluck: { k: 'b', g: 0.5, wet: 0.35, pan: 0.15 },
  bell: { k: 'b', g: 0.42, wet: 0.6, pan: -0.1 }, chime: { k: 'b', g: 0.3, wet: 0.6, pan: 0.25 }, timp: { k: 'b', g: 0.5, wet: 0.4 },
  taiko: { k: 'b', g: 0.6, wet: 0.35, n: 3 }, tom: { k: 'b', g: 0.45, wet: 0.3, pan: 0.2, n: 3 }, frame: { k: 'b', g: 0.35, wet: 0.3, pan: -0.25, n: 3 },
  hand: { k: 'b', g: 0.25, wet: 0.25, pan: 0.3, n: 3 }, stick: { k: 'b', g: 0.25, wet: 0.3, pan: -0.3, n: 3 }, shaker: { k: 'b', g: 0.15, wet: 0.3, pan: 0.35, n: 2 },
  gong: { k: 'b', g: 0.4, wet: 0.5, n: 1 }, anvil: { k: 'b', g: 0.25, wet: 0.45, pan: 0.2, n: 2 }, scrape: { k: 'b', g: 0.3, wet: 0.6, pan: -0.3, n: 3 },
  heart: { k: 'b', g: 0.55, wet: 0.3, n: 2 }, boom: { k: 'b', g: 0.6, wet: 0.4, n: 2 }, rattle: { k: 'b', g: 0.25, wet: 0.4, pan: 0.3, n: 2 },
  choir: { k: 'choir', g: 0.2, wet: 0.7, a: 0.9, r: 1.6, vow: 'a' }, choiru: { k: 'choir', g: 0.22, wet: 0.75, a: 1.2, r: 2, vow: 'u', pan: -0.1 },
  str: { k: 'str', g: 0.14, wet: 0.5, pan: 0.1, a: 1.2, r: 1.8 }, drone: { k: 'drone', g: 0.11, wet: 0.35, a: 3, r: 3.5 },
  dist: { k: 'dist', g: 0.045, wet: 0.3, a: 1.5, r: 2 }, brass: { k: 'brass', g: 0.2, wet: 0.45, pan: -0.1, a: 0.06, r: 0.3 },
  ost: { k: 'ost', g: 0.26, wet: 0.2, pan: 0.15 }, glass: { k: 'glass', g: 0.05, wet: 0.75, pan: 0.2, a: 2, r: 3 },
  whisp: { k: 'whisp', g: 0.5, wet: 0.8, pan: -0.2, a: 1.5, r: 2.5 },
};

// 곡 하나의 연주: 악절을 차례로 받아 예약한다
class Player {
  constructor(M, id, def, t0, once) {
    const c = M.c;
    this.M = M; this.id = id; this.T = def; this.once = once;
    this.dry = c.createGain(); this.wet = c.createGain();
    this.dry.connect(once ? M.sys.musBus : M.dDry); this.wet.connect(once ? M.sys.musRev : M.dWet);
    this.ch = {}; this.live = new Set(); this.st = { n: 0, last: null };
    this.ph = null; this.phT = t0; this.ei = 0; this.spb = 1; this.done = false; this.lv = def.vol ?? 1;
    for (const b of [this.dry, this.wet]) { b.gain.value = 0; glide(b, this.lv, t0, once ? 0.03 : XF); }
  }
  pump(until, now, mute) {
    while (!this.done) {
      if (!this.ph) {
        try { this.ph = this.T.next(this.st); } catch (e) { console.warn('악절을 만들지 못했습니다', this.id, e); this.done = true; return; }
        this.ei = 0; this.spb = 60 / (this.ph.bpm || this.T.bpm);
      }
      const P = this.ph, ev = P.ev;
      for (; this.ei < ev.length; this.ei++) {
        const e = ev[this.ei], t = this.phT + e.t * this.spb;
        if (t >= until) return;
        if (mute || t < now - 0.05) continue; // 너무 늦은 음은 버린다
        this.M.note(this, e, Math.max(now + 0.005, t), e.d * this.spb);
      }
      this.phT += P.len * this.spb; this.ph = null; this.st.n++;
      if (this.once) this.done = true;
    }
  }
  // 줄이며 끝낸다. 남은 울림이 사라진 뒤 연결을 끊는다
  stop(t, dur) {
    this.done = true;
    glide(this.dry, 0, t, dur); glide(this.wet, 0, t, dur);
    setTimeout(() => this.close(), (Math.max(0, t - this.M.c.currentTime) + dur + 0.5) * 1000);
  }
  close() {
    for (const n of this.live) try { n.stop(); } catch { /* 이미 멈춤 */ }
    this.live.clear();
    try { this.dry.disconnect(); this.wet.disconnect(); } catch { /* 이미 끊김 */ }
  }
}

export class Music {
  constructor(sys) {
    this.sys = sys; this.c = sys.ctx;
    const c = this.c;
    // 스팅이 울릴 때 곡 전체를 줄이는 마개(곡마다의 겹침과 따로)
    this.dDry = c.createGain(); this.dWet = c.createGain();
    this.dDry.connect(sys.musBus); this.dWet.connect(sys.musRev);
    this.cur = null; this.pending = null; this.stings = []; this.pendSting = null; this.lastSting = -9;
    this.keep = new Set();
    for (const d of Object.values(STING_DEFS)) for (const k of d.pre ? d.pre() : []) { this.keep.add(k); sys.cache.want(k, 2); }
  }
  get id() { return this.cur?.id || this.pending?.id || null; }
  // 곡 바꾸기: 지금 곡은 XF초 동안 줄이고, 새 곡은 악기 소리가 준비되면(늦어도 2.5초) 키우며 시작한다
  set(id) {
    if (this.cur?.id === id || (this.pending && this.pending.id === id)) return;
    const now = this.c.currentTime;
    if (this.cur) { this.cur.stop(now, XF); this.cur = null; }
    this.pending = null;
    if (!id || !TRACKS[id]) return;
    const keys = TRACKS[id].pre ? TRACKS[id].pre() : [];
    for (const k of keys) this.sys.cache.want(k, 1);
    this.pending = { id, keys, t: performance.now() };
  }
  sting(name) {
    const now = this.c.currentTime, def = STING_DEFS[name];
    if (!def || now - this.lastSting < 0.8) return;
    this.lastSting = now;
    const keys = def.pre ? def.pre() : [];
    for (const k of keys) this.sys.cache.want(k, 0);
    this.pendSting = { name, keys, t: performance.now() };
    this.tick();
  }
  tick() {
    const c = this.c, now = c.currentTime, V = this.sys.vol, mute = V.music < 0.001 || V.master < 0.001;
    const P = this.pending, S = this.pendSting, ready = (x, wait) => x.keys.every((k) => this.sys.cache.has(k)) || performance.now() - x.t > wait;
    if (P && ready(P, 2500)) {
      this.pending = null;
      this.cur = new Player(this, P.id, TRACKS[P.id], now + 0.1, false);
      const keep = new Set([...P.keys, ...this.keep]);
      this.sys.cache.drop((k) => k.startsWith('mus:') && !keep.has(k)); // 다른 곡의 악기 소리는 비운다
    }
    if (S && ready(S, 600)) {
      this.pendSting = null;
      const def = STING_DEFS[S.name], St = new Player(this, 'sting:' + S.name, def, now + 0.04, true);
      St.end = now + 0.04 + def.len; this.stings.push(St);
      // 흐르던 곡을 잠깐 줄였다가 스팅이 끝나면 천천히 되돌린다
      for (const d of [this.dDry, this.dWet]) { glide(d, 0.28, now, 0.3); glide(d, 1, St.end, 1.8); }
    }
    if (this.cur) this.cur.pump(now + LOOK, now, mute);
    for (const St of this.stings) St.pump(now + LOOK, now, mute);
    if (this.stings.length) this.stings = this.stings.filter((St) => (St.done && now > St.end + 4 ? (St.close(), false) : true));
  }
  // 악기 묶음: 곡마다 악기별로 한 번 만들어 음들이 함께 쓴다(크기·좌우·잔향·모음 필터·찌그러뜨림)
  chan(P, name, I) {
    let n = P.ch[name];
    if (n) return n;
    const c = this.c;
    n = c.createGain(); n.gain.value = I.g;
    let o = n;
    if (I.k === 'choir') o = formants(c, n, I.vow);
    if (I.k === 'dist') {
      const ws = c.createWaveShaper(), lp = c.createBiquadFilter();
      ws.curve = kit(c).curve; lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
      o.connect(ws); ws.connect(lp); o = lp;
    }
    if (I.pan && this.sys.hasPan) { const p = c.createStereoPanner(); p.pan.value = I.pan; o.connect(p); o = p; }
    o.connect(P.dry);
    const s = c.createGain(); s.gain.value = I.wet; o.connect(s); s.connect(P.wet);
    return (P.ch[name] = n);
  }
  // 소리 하나가 끝나면 연결을 끊고 목록에서 뺀다
  hold(P, src, nodes) {
    P.live.add(src);
    src.onended = () => { P.live.delete(src); for (const n of nodes) try { n.disconnect(); } catch { /* 이미 끊김 */ } };
    return src;
  }
  osc(P, w, f, t, end, det = 0) {
    const o = this.c.createOscillator();
    if (typeof w === 'string') o.type = w; else o.setPeriodicWave(w);
    o.frequency.value = f; if (det) o.detune.value = det;
    o.start(t); o.stop(end);
    P.live.add(o); o.onended = () => P.live.delete(o);
    return (this.last = o);
  }
  env(g, t, d, v, A, R) {
    A = Math.min(A, d * 0.6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + A);
    g.gain.setValueAtTime(v, t + d); g.gain.setTargetAtTime(0, t + d, R / 3);
    return t + d + R * 1.6 + 0.05;
  }
  // 늦게 시작해 깊어지는 비브라토(긴 음에만)
  vib(P, t, end, depth, hz) {
    const c = this.c, l = c.createOscillator(), g = c.createGain();
    l.frequency.value = hz * (0.9 + Math.random() * 0.2);
    g.gain.setValueAtTime(0, t); g.gain.setValueAtTime(0, t + 0.4); g.gain.linearRampToValueAtTime(depth, t + 1);
    l.connect(g); l.start(t); l.stop(end); P.live.add(l); l.onended = () => P.live.delete(l);
    return g;
  }
  note(P, e, t, d) {
    const I = INST[e.i];
    if (!I) return;
    const c = this.c, v = e.v * (0.92 + Math.random() * 0.12), out = this.chan(P, e.i, I);
    if (I.k === 'b') {
      const key = 'mus:' + e.i + ':' + (I.n ? Math.floor(Math.random() * I.n) : e.m), b = this.sys.cache.get(key);
      if (!b) { this.sys.cache.want(key, 1); return; } // 아직 안 그려졌으면 이번 음은 건너뛴다
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = b; if (e.r) s.playbackRate.value = e.r;
      g.gain.value = v; s.connect(g); g.connect(out); s.start(t);
      if (e.cut) { g.gain.setValueAtTime(v, t + d); g.gain.setTargetAtTime(0, t + d, 0.06); s.stop(t + d + 0.4); }
      this.hold(P, s, [g]);
      return;
    }
    const f = mtof(e.m), W = kit(c), g = c.createGain();
    let end;
    this.last = null;
    switch (I.k) {
      case 'choir': { // 살짝 어긋난 톱니 둘 → 악기 묶음의 모음 필터
        end = this.env(g, t, d, v, I.a, I.r);
        const vb = d > 1.2 ? this.vib(P, t, end, f * 0.004, 5) : null;
        for (const s of [-1, 1]) { const o = this.osc(P, W.saw, f, t, end, s * 9 + (Math.random() - 0.5) * 6); if (vb) vb.connect(o.frequency); o.connect(g); }
        break;
      }
      case 'str': { // 현 합주: 어긋난 톱니 둘을 저역 통과
        end = this.env(g, t, d, v, I.a, I.r);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(8000, f * 3 + 400); lp.Q.value = 0.5;
        for (const s of [-1, 1]) this.osc(P, W.saw, f, t, end, s * 7).connect(lp);
        lp.connect(g);
        break;
      }
      case 'drone': { // 사인 + 오르간 배음(작은 스피커에서도 들리게 위 배음을 조금)
        end = this.env(g, t, d, v, I.a, I.r);
        const lp = c.createBiquadFilter(), h = c.createGain();
        lp.type = 'lowpass'; lp.frequency.value = f * 3.5 + 120; h.gain.value = 0.3;
        this.osc(P, 'sine', f, t, end).connect(lp);
        this.osc(P, W.organ, f * 1.003, t, end).connect(h); h.connect(lp); lp.connect(g);
        break;
      }
      case 'dist': // 톱니 둘 → 악기 묶음의 찌그러뜨림
        end = this.env(g, t, d, v, I.a, I.r);
        this.osc(P, W.saw, f, t, end).connect(g); this.osc(P, W.saw, f, t, end, 11).connect(g);
        break;
      case 'brass': { // 금관: 셀수록 밝아지는 필터, 아래에서 올라붙는 음정
        const A = Math.min(I.a, d * 0.5), lo = Math.min(9000, f * 1.2 + 90), hi = Math.min(9000, f * (2 + 3 * v) + 300);
        end = t + d + I.r * 1.6 + 0.05;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
        lp.frequency.setValueAtTime(lo, t); lp.frequency.linearRampToValueAtTime(hi, t + A * 1.5); lp.frequency.setTargetAtTime(lo + (hi - lo) * 0.6, t + A * 1.5, 0.25);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + A); g.gain.setTargetAtTime(v * 0.8, t + A, 0.25); g.gain.setTargetAtTime(0, t + d, I.r / 3);
        for (const s of [-1, 1]) { const o = this.osc(P, W.brass, f, t, end, s * 5); o.frequency.setValueAtTime(f * 0.985, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); o.connect(lp); }
        lp.connect(g);
        break;
      }
      case 'ost': { // 짧게 끊는 낮은 현(빠른 되풀이)
        end = t + d + 0.3;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 5 + 500 + 1500 * v); lp.Q.value = 1.2;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(v * 0.3, t + 0.004, 0.08); g.gain.setTargetAtTime(0, t + d * 0.85, 0.04);
        this.osc(P, W.soft, f, t, end).connect(lp); lp.connect(g);
        break;
      }
      case 'glass': // 아주 조금 어긋난 사인 둘이 느리게 맥놀이
        end = this.env(g, t, d, v, I.a, I.r);
        this.osc(P, 'sine', f, t, end).connect(g); this.osc(P, 'sine', f * 1.0035, t, end).connect(g);
        break;
      case 'whisp': { // 잡음을 좁은 띠로 걸러 바람이 우는 음
        end = this.env(g, t, d, v * 3, I.a, I.r);
        const s = c.createBufferSource(), bp = c.createBiquadFilter();
        s.buffer = W.noise; s.loop = true; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 18;
        s.connect(bp); bp.connect(g); s.start(t, Math.random() * 1.5); s.stop(end);
        P.live.add(s); s.onended = () => P.live.delete(s); this.last = s;
        break;
      }
      default: return;
    }
    g.connect(out);
    // 이 음의 발진기들은 함께 끝나므로 마지막 것이 끝날 때 게인 연결도 끊는다
    const L = this.last, f0 = L && L.onended;
    if (L) L.onended = () => { f0 && f0(); try { g.disconnect(); } catch { /* 이미 끊김 */ } };
  }
}

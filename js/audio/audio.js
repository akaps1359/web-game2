// 소리 체계: 효과음·반복음·배경음악·스팅·분위기를 한곳에서 다룬다. 음원 파일 없이 Web Audio로 그때그때 만든다
// 아이폰 사파리는 사용자가 화면을 건드린 뒤에야 소리를 낼 수 있으므로 첫 동작(포인터·터치·클릭·키)에서 오디오를 연다
import { SFX, SFX_GROUPS } from './bank.js';
import { Cache } from './cache.js';
import { glide } from './wa.js';
import { Music, TRACKS, STING_DEFS } from './music.js';
import { Ambience, AMB_KINDS } from './ambience.js';

export const SFX_NAMES = Object.keys(SFX);
export const MUSIC_TRACKS = Object.keys(TRACKS);
export const STINGS = Object.keys(STING_DEFS);
export const AMBIENCES = AMB_KINDS.slice();
export { SFX_GROUPS };

const MAX_VOICES = 24; // 동시에 울리는 효과음 수(넘으면 가장 오래된 것을 끊는다)
const MAX_LOOPS = 8;
const SAME = 0.035; // 같은 소리가 이 안에 또 오면 새로 내지 않고 앞 소리를 조금 키운다
const NEAR = 3, FAR = 18; // 위치 소리: 3칸 안은 그대로, 18칸 밖은 안 들림
const MUS_GAIN = 1.6; // 음악 묶음 보정(+4dB): 기본 설정(음악 0.6)에서 분위기 소리보다 위에 오도록
// 소리를 열자마자 먼저 그려 둘 것: 자주 듣는 소리부터
const FIRST = ['ui_click', 'footstep', 'swing_light', 'hit_flesh', 'hit_bone', 'hit_metal', 'mon_hit_small', 'mon_attack', 'gold_pickup', 'item_pickup',
  'ui_open', 'ui_close', 'swing_heavy', 'hurt_male', 'hurt_female', 'mon_hit_big', 'block', 'hit_crit', 'potion_drink', 'drop_weapon', 'drop_armor', 'gold_drop'];
const v01 = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp1 = (v) => Math.max(-1, Math.min(1, num(v, 0)));
const curve = (v) => v * v; // 밀대 값 → 게인(귀에 고르게 들리도록 제곱)
// 약속(Promise)을 돌려주지 않는 옛 웹킷도 있어 조용히 부른다
const quiet = (f) => { try { const p = f(); if (p && p.catch) p.catch(() => {}); } catch { /* 무시 */ } };

export class AudioSys {
  constructor(getSettings) {
    this.getSettings = typeof getSettings === 'function' ? getSettings : () => ({});
    this.ctx = null; this.cache = null; this.music = null; this.amb = null;
    this.voices = []; this.loops = []; this.last = new Map(); this.lastVar = new Map(); this.warned = new Set();
    this.musicWant = null; this.ambWant = null;
    this.vol = this.read();
    if (typeof window === 'undefined') return;
    const kick = () => this.unlock();
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, kick, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => this.vis());
    window.addEventListener('pageshow', () => this.vis());
  }
  read() {
    let s = {};
    try { s = this.getSettings() || {}; } catch (e) { console.warn('소리 설정을 읽지 못했습니다', e); }
    return { master: v01(s.master, 1), sfx: v01(s.sfx, 1), music: v01(s.music, 1), silent: s.silentMode !== false };
  }
  warn(name) { if (!this.warned.has(name)) { this.warned.add(name); console.warn('알 수 없는 소리:', name); } }
  // 소리 쪽 오류가 게임을 멈추지 않게: 같은 오류는 한 번만 알린다
  oops(e) { const k = 'err:' + (e && e.message); if (!this.warned.has(k)) { this.warned.add(k); console.warn('소리 오류', e); } }
  // iOS 17+: 'playback'이면 무음 스위치와 관계없이 들리고, 'ambient'면 스위치를 따르며 다른 앱 소리와 섞인다
  session() {
    try {
      const a = navigator.audioSession, t = this.vol.silent ? 'playback' : 'ambient';
      if (a && a.type !== t) a.type = t;
    } catch { /* 지원 안 함 */ }
  }

  // 사용자 동작 안에서 오디오를 열거나 다시 깨운다(여러 번 불러도 된다)
  unlock() {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      this.vol = this.read(); this.session();
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { this.ctx = new AC(); }
        try { this.build(); } catch (e) { const c0 = this.ctx; this.ctx = null; quiet(() => c0.close()); throw e; }
      }
      const c = this.ctx;
      if (c.state !== 'running') {
        quiet(() => c.resume());
        // 일부 iOS는 동작 안에서 실제로 소리를 한 번 내야 풀린다(한 표본짜리 무음)
        const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
      }
    } catch (e) { console.warn('오디오를 시작할 수 없습니다', e); }
  }
  // 소리 길: 효과음·음악 묶음 → 주 음량 → 압축기(여러 소리가 겹쳐도 찢어지지 않게) → 스피커, 묶음마다 공용 잔향으로 보내기
  build() {
    const c = this.ctx, G = () => c.createGain();
    this.master = G(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(c.destination); this.out = comp;
    this.sfxBus = G(); this.sfxRev = G(); this.musBus = G(); this.musRev = G();
    for (const b of [this.sfxBus, this.sfxRev, this.musBus, this.musRev]) b.gain.value = 0;
    this.sfxBus.connect(this.master); this.musBus.connect(this.master);
    this.rev = c.createConvolver();
    const ret = G(); ret.gain.value = 1;
    this.sfxRev.connect(this.rev); this.musRev.connect(this.rev); this.rev.connect(ret); ret.connect(this.master);
    this.hasPan = typeof c.createStereoPanner === 'function';
    this.cache = new Cache(c);
    this.cache.want('ir', 0, (b) => { try { this.rev.buffer = b; } catch (e) { console.warn('잔향을 만들 수 없습니다', e); } });
    this.music = new Music(this); this.amb = new Ambience(this);
    this.applySettings();
    if (this.musicWant) this.music.set(this.musicWant);
    if (this.ambWant) this.amb.set(this.ambWant);
    for (const H of this.loops) if (!H.stopped) this.startLoop(H);
    this.timer = setInterval(() => this.tick(), 100);
    for (const n of FIRST) this.warm(n, 1);
    for (const n of SFX_NAMES) this.warm(n, 2);
  }
  warm(name, pr) { const M = SFX[name][0]; for (let v = 0; v < (M.n || 1); v++) this.cache.want(`sfx:${name}:${v}`, pr); }
  vis() {
    const c = this.ctx;
    if (!c) return;
    if (document.hidden) quiet(() => c.suspend());
    else { quiet(() => c.resume()); this.cache.lastMsg = performance.now(); } // 얼었던 페이지가 돌아오면 워커 응답 감시를 새로 시작
  }
  // 설정(음량·무음 모드)이 바뀌었을 때: 묶음 게인을 부드럽게 옮긴다
  applySettings() {
    this.vol = this.read(); this.session();
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime, V = this.vol;
    glide(this.master, curve(V.master), t, 0.25);
    glide(this.sfxBus, curve(V.sfx), t, 0.25); glide(this.sfxRev, curve(V.sfx), t, 0.25);
    glide(this.musBus, curve(V.music) * MUS_GAIN, t, 0.25); glide(this.musRev, curve(V.music) * MUS_GAIN, t, 0.25);
  }
  tick() {
    const c = this.ctx;
    if (!c) return;
    this.cache.tick();
    if (c.state !== 'running') return;
    try { this.music.tick(); } catch (e) { console.warn('배경음악 오류', e); }
    try { this.amb.tick(); } catch (e) { console.warn('분위기 소리 오류', e); }
  }

  // ───────── 효과음 ─────────
  play(name, opts) { try { this.fire(name, opts, 1, 0, 0); } catch (e) { this.oops(e); } }
  // 위치 소리: dx·dy는 듣는 이로부터의 타일 거리(아이소메트릭: 화면 가로 ≈ dx − dy)
  playAt(name, dx, dy, opts) {
    const d = Math.hypot(dx, dy);
    if (!(d < FAR)) { if (!SFX[name]) this.warn(name); return; }
    try { this.fire(name, opts, d <= NEAR ? 1 : Math.pow(1 - (d - NEAR) / (FAR - NEAR), 1.6), clamp1((dx - dy) / 8) * 0.8, d); } catch (e) { this.oops(e); }
  }
  fire(name, o = {}, k, ppan, dist) {
    const S = SFX[name];
    if (!S) { this.warn(name); return; }
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const M = S[0], now = c.currentTime, vol = Math.min(2, Math.max(0, +(o?.vol ?? 1) || 0)) * (M.v ?? 0.6) * k * (0.9 + Math.random() * 0.2);
    if (vol < 0.002) return;
    // 같은 소리가 연달아 오면 합친다
    const L = this.last.get(name);
    if (L && !L.dead && now - L.t < SAME) {
      const nv = Math.min(L.v0 * 1.5, Math.max(L.v, vol) * 1.12);
      if (nv > L.v) { L.v = nv; L.g.gain.setTargetAtTime(nv, now, 0.005); }
      return;
    }
    const pan = clamp1(num(o?.pan, 0) + ppan), rate = Math.max(0.25, Math.min(4, num(o?.rate, 1))) * (1 + (Math.random() * 2 - 1) * (M.p ?? 0.04));
    // 변형이 여럿이면 바로 앞과 다른 것을 고른다
    const n = M.n || 1;
    let vi = Math.floor(Math.random() * n);
    if (n > 1 && vi === this.lastVar.get(name)) vi = (vi + 1) % n;
    let b = this.cache.get(`sfx:${name}:${vi}`);
    for (let j = 1; j < n && !b; j++) { const w = (vi + j) % n; b = this.cache.get(`sfx:${name}:${w}`); if (b) vi = w; }
    if (!b) {
      // 아직 안 그려졌으면 급히 그리게 하고, 늦지 않게(0.15초 안에) 오면 그때 낸다
      this.cache.want(`sfx:${name}:${vi}`, 0, (bb) => { if (c.state === 'running' && c.currentTime - now < 0.15) this.voice(name, M, bb, vol, pan, rate, dist); });
      return;
    }
    this.lastVar.set(name, vi);
    this.voice(name, M, b, vol, pan, rate, dist);
  }
  voice(name, M, b, vol, pan, rate, dist) {
    const c = this.ctx, t = c.currentTime;
    while (this.voices.length >= MAX_VOICES) this.kill(this.voices.shift(), 0.015);
    const s = c.createBufferSource(), g = c.createGain(), nodes = [s, g];
    s.buffer = b; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g);
    let o = g;
    if (dist > 7 && !M.ui) { // 멀면 높은 소리가 깎인다
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(1500, 12000 * Math.pow(0.86, dist - 7));
      o.connect(f); o = f; nodes.push(f);
    }
    if (pan && this.hasPan) { const p = c.createStereoPanner(); p.pan.value = pan; o.connect(p); o = p; nodes.push(p); }
    o.connect(this.sfxBus);
    const rv = M.ui ? 0 : (M.rev ?? 0.15) * (1 + dist / 12);
    if (rv > 0.005) { const sg = c.createGain(); sg.gain.value = Math.min(1, rv); o.connect(sg); sg.connect(this.sfxRev); nodes.push(sg); }
    s.start(t);
    const V = { name, s, g, nodes, t, v: vol, v0: vol, dead: false };
    s.onended = () => this.end(V);
    this.voices.push(V); this.last.set(name, V);
  }
  // 빼앗긴 목소리는 아주 짧게 줄이고 멈춘다(딸깍 소리 없이)
  kill(V, fade) {
    if (!V || V.dead) return;
    V.dead = true;
    const t = this.ctx.currentTime;
    V.g.gain.cancelScheduledValues(t); V.g.gain.setTargetAtTime(0, t, fade / 3);
    try { V.s.stop(t + fade + 0.02); } catch { /* 이미 멈춤 */ }
  }
  end(V) {
    V.dead = true;
    const i = this.voices.indexOf(V);
    if (i >= 0) this.voices.splice(i, 1);
    if (this.last.get(V.name) === V) this.last.delete(V.name);
    for (const n of V.nodes) try { n.disconnect(); } catch { /* 이미 끊김 */ }
  }

  // ───────── 이어지는 소리(불길·눈보라·회오리) ─────────
  loop(name, o) {
    const H = {
      name, vol: Math.min(2, Math.max(0, num(o?.vol, 1))), pan: clamp1(o?.pan), rate: Math.max(0.25, Math.min(4, num(o?.rate, 1))), k: 1, stopped: false, live: null,
      stop: (f = 0.3) => this.stopLoop(H, f),
      setVol: (v) => { H.vol = Math.min(2, Math.max(0, num(v, H.vol))); this.loopGain(H, 0.08); },
      setPan: (p) => { H.pan = clamp1(p); if (H.live?.p) H.live.p.pan.setTargetAtTime(H.pan, this.ctx.currentTime, 0.05); },
      // 위치를 따라가는 반복음: playAt과 같은 거리 감쇠·좌우
      setPos: (dx, dy) => {
        const d = Math.hypot(dx, dy);
        if (!Number.isFinite(d)) return;
        H.k = d <= NEAR ? 1 : d >= FAR ? 0 : Math.pow(1 - (d - NEAR) / (FAR - NEAR), 1.6);
        H.setPan(clamp1((dx - dy) / 8) * 0.8); this.loopGain(H, 0.08);
      },
    };
    if (!SFX[name]) { this.warn(name); H.stopped = true; return H; }
    this.loops.push(H);
    const on = this.loops.filter((l) => !l.stopped);
    if (on.length > MAX_LOOPS) this.stopLoop(on[0], 0.2);
    if (this.ctx) try { this.startLoop(H); } catch (e) { this.oops(e); }
    return H;
  }
  startLoop(H) {
    const c = this.ctx, M = SFX[H.name][0];
    this.cache.want(`sfx:${H.name}:0`, 0, (b) => {
      if (H.stopped || H.live) return;
      const s = c.createBufferSource(), g = c.createGain(), sg = c.createGain();
      s.buffer = b; s.loop = true; s.playbackRate.value = H.rate; g.gain.value = 0;
      s.connect(g);
      let o = g, p = null;
      if (this.hasPan) { p = c.createStereoPanner(); p.pan.value = H.pan; g.connect(p); o = p; }
      o.connect(this.sfxBus); sg.gain.value = M.rev ?? 0.2; o.connect(sg); sg.connect(this.sfxRev);
      s.start(c.currentTime, Math.random() * b.duration); // 여러 개가 겹쳐도 똑같이 들리지 않게 무작위 위치에서
      H.live = { s, g, p, sg, M };
      this.loopGain(H, 0.15);
    });
  }
  loopGain(H, dur) { if (H.live && !H.stopped) glide(H.live.g, H.vol * (H.live.M.v ?? 0.5) * H.k, this.ctx.currentTime, dur); }
  stopLoop(H, f) {
    if (H.stopped) return;
    H.stopped = true;
    const i = this.loops.indexOf(H);
    if (i >= 0) this.loops.splice(i, 1);
    const L = H.live;
    if (!L || !this.ctx) return;
    const t = this.ctx.currentTime, fd = Math.max(0.01, num(f, 0.3));
    try {
      glide(L.g, 0, t, fd);
      L.s.stop(t + fd + 0.05);
      L.s.onended = () => { for (const n of [L.s, L.g, L.p, L.sg]) try { n?.disconnect(); } catch { /* 이미 끊김 */ } };
    } catch (e) { this.oops(e); }
  }

  // ───────── 배경음악·스팅·분위기 ─────────
  setMusic(track) {
    track = track || null;
    if (track && !TRACKS[track]) { this.warn('music:' + track); return; }
    if (track === this.musicWant) return;
    this.musicWant = track;
    if (this.music) try { this.music.set(track); } catch (e) { this.oops(e); }
  }
  sting(name) {
    if (!STING_DEFS[name]) { this.warn('sting:' + name); return; }
    if (this.music && this.ctx.state === 'running') try { this.music.sting(name); } catch (e) { this.oops(e); }
  }
  setAmbience(kind) {
    kind = kind || null;
    if (kind && !AMB_KINDS.includes(kind)) { this.warn('ambience:' + kind); return; }
    if (kind === this.ambWant) return;
    this.ambWant = kind;
    if (this.amb) try { this.amb.set(kind); } catch (e) { this.oops(e); }
  }

  // ───────── 점검용 ─────────
  stats() {
    const c = this.cache;
    return {
      state: this.ctx ? this.ctx.state : 'locked', rate: this.ctx?.sampleRate || 0, voices: this.voices.length, loops: this.loops.length,
      music: this.music?.id || null, ambience: this.amb?.kind || null, worker: c ? !c.local : null,
      cached: c ? c.stat.n : 0, renderMs: c ? Math.round(c.stat.ms) : 0, mb: c ? +(c.stat.bytes / 1048576).toFixed(1) : 0,
    };
  }
  // 모든 효과음을 미리 그려 둔다(시간 측정용): { count, wallMs, renderMs, slow: [[열쇠, ms]...] }
  async prerender(names = SFX_NAMES) {
    if (!this.cache) return null;
    const keys = names.flatMap((n) => Array.from({ length: SFX[n]?.[0].n || 1 }, (_, v) => `sfx:${n}:${v}`));
    const t0 = performance.now();
    await this.cache.all(keys, 1);
    const ms = keys.map((k) => [k, this.cache.m.get(k)?.ms || 0]).sort((a, b) => b[1] - a[1]);
    return { count: keys.length, wallMs: Math.round(performance.now() - t0), renderMs: Math.round(ms.reduce((a, x) => a + x[1], 0)), slow: ms.slice(0, 8).map(([k, v]) => [k, +v.toFixed(1)]), failed: keys.filter((k) => !this.cache.get(k)) };
  }
  // 출력 소리를 엿보는 분석기(크기 막대용)
  analyser() {
    if (!this.ctx) return null;
    if (!this.an) { this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048; this.out.connect(this.an); }
    return this.an;
  }
}

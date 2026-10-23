// 배경음악 감독: 게임 상황(평화·긴장·전쟁·진격·위기·승전·패전)을 읽어 곡을 고르고, 악절 단위로 자연스럽게 넘긴다
// 아이폰 사파리는 사용자가 화면을 건드린 뒤에야 소리를 낼 수 있으므로 첫 탭에서 오디오를 연다
import { Synth, glide } from './synth.js';
import { TRACKS, STINGERS, MOODS, compile } from './score.js';
import { atWar, atWarAny, enemiesOf, allied } from '../engine/world.js';

const LOOK = 1.2; // 미리 예약해 두는 시간(초): 계산 때문에 메인 스레드가 잠깐 멈춰도 끊기지 않게

// 곡 하나의 연주: 악절을 차례로 예약한다
class Player {
  constructor(syn, id, t0) {
    this.id = id; this.T = TRACKS[id] || STINGERS[id];
    this.secs = compile(this.T); this.spb = 60 / this.T.bpm;
    this.syn = syn; this.bus = syn.bus();
    this.i = 0; this.ei = 0; this.secT = t0; this.done = false; this.last = false;
    this.lv = this.T.vol ?? 1; // 곡마다 들리는 크기를 맞춘다
    for (const S of this.secs) for (const e of S.ev) syn.warm(e); // 타악기 소리를 미리 녹음해 둔다
    for (const b of [this.bus.dry, this.bus.wet]) { b.gain.value = 0; glide(b, this.lv, t0, 0.08); }
  }
  get length() { return this.secs.reduce((a, s) => a + s.len, 0) * this.spb; }
  pump(until, now) {
    while (!this.done) {
      const S = this.secs[this.i];
      for (; this.ei < S.ev.length; this.ei++) {
        const e = S.ev[this.ei], t = this.secT + e.t * this.spb;
        if (t >= until) return;
        if (t < now - 0.05) continue; // 너무 늦은 음은 버린다
        const jit = e.i === 'sn' || e.i === 'bd' ? 0.003 : 0.01; // 사람이 연주하듯 조금씩 어긋나게
        this.syn.note(this.bus, { ...e, v: e.v * (0.93 + Math.random() * 0.12) }, Math.max(now, t + (Math.random() - 0.5) * jit), e.d * this.spb);
      }
      this.secT += S.len * this.spb; this.i++; this.ei = 0;
      if (this.i >= this.secs.length || this.last) this.done = true;
    }
  }
  // 줄이며 끝낸다
  stop(t, dur) {
    this.done = true;
    glide(this.bus.dry, 0, t, dur); glide(this.bus.wet, 0, t, dur);
    this.drop(t + dur);
  }
  // 남은 울림이 사라진 뒤 연결을 끊는다
  drop(at) {
    const ms = Math.max(0, at - this.syn.ctx.currentTime) * 1000 + 7000;
    setTimeout(() => { this.syn.close(this.bus); try { this.bus.dry.disconnect(); this.bus.wet.disconnect(); } catch { /* 이미 끊김 */ } }, ms);
  }
}

export class Music {
  constructor(app) {
    this.app = app;
    this.ctx = null; this.syn = null;
    this.cur = null; this.stings = [];
    this.want = null; this.override = null; this.rot = {};
    this.gapUntil = 0; this.lastCheck = 0; this.cand = null; this.candT = 0; this.urgent = false;
    this.lastSting = -99; this.stingEnd = 0; this.victoryUntil = 0; this.defeatUntil = 0;
    this.G = null; this.warWas = false;
    const kick = () => this.unlock();
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, kick, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => this.vis());
  }
  get enabled() { return this.app.settings().music !== false; }
  get volume() { return this.app.settings().musicVol ?? 0.7; }
  get playing() { return this.ctx?.state === 'running' && this.enabled ? this.cur?.id || null : null; }
  sig() { return `${this.playing}:${this.override}:${this.want}:${this.ctx?.state}`; }

  // 사용자 동작 안에서 오디오를 열거나 다시 깨운다
  unlock() {
    if (!this.enabled || document.hidden) return;
    try {
      this.session();
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC({ latencyHint: 'playback' }); } catch { this.ctx = new AC(); }
        this.syn = new Synth(this.ctx);
        glide(this.syn.master, this.volume, this.ctx.currentTime, 0.6);
        this.timer = setInterval(() => this.tick(), 100);
      }
      if (this.ctx.state !== 'running') {
        this.ctx.resume().catch(() => {});
        // 일부 iOS는 동작 안에서 실제로 소리를 한 번 내야 풀린다
        const s = this.ctx.createBufferSource(); s.buffer = this.ctx.createBuffer(1, 1, 22050); s.connect(this.ctx.destination); s.start(0);
      }
    } catch (e) { console.warn('배경음악을 시작할 수 없습니다', e); }
  }
  // iOS 17+: 'playback'이면 무음 스위치와 관계없이 들리고, 'ambient'면 다른 앱 소리와 섞인다
  session() {
    try { if (navigator.audioSession) navigator.audioSession.type = this.app.settings().musicSilent === false ? 'ambient' : 'playback'; } catch { /* 지원 안 함 */ }
  }
  vis() {
    if (!this.ctx) return;
    if (document.hidden) this.ctx.suspend().catch(() => {});
    else if (this.enabled) this.ctx.resume().catch(() => {});
  }
  // 설정(켜기·끄기·음량·무음 모드)이 바뀌었을 때
  apply() {
    clearTimeout(this.offT);
    if (!this.enabled) {
      if (this.ctx) { glide(this.syn.master, 0, this.ctx.currentTime, 0.3); this.offT = setTimeout(() => { if (!this.enabled) this.ctx.suspend().catch(() => {}); }, 450); }
      return;
    }
    this.unlock();
    if (this.ctx) glide(this.syn.master, this.volume, this.ctx.currentTime, 0.3);
  }
  // 음악 감상: 특정 곡을 계속 틀거나(id), 상황별 자동 선곡으로 돌아간다(null)
  preview(id) {
    this.override = id || null; this.urgent = true; this.lastCheck = 0;
    if (id) this.unlock();
  }

  tick() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const now = c.currentTime;
    if (performance.now() - this.lastCheck > 900) { this.lastCheck = performance.now(); this.direct(now); }
    const P = this.cur;
    if (P) {
      P.pump(now + LOOK, now);
      if (P.done && now >= P.secT) {
        P.drop(P.secT); this.cur = null;
        const g = this.override ? [2, 3] : this.fits(P.id, this.want) ? P.T.gap : [0.5, 0.5];
        this.gapUntil = now + g[0] + Math.random() * (g[1] - g[0]);
      }
    } else if (this.want && now >= this.gapUntil) this.cur = new Player(this.syn, this.pick(this.want), now + 0.1);
    for (const S of [...this.stings]) {
      S.pump(now + LOOK, now);
      if (S.done && now >= S.secT) { S.drop(S.secT); this.stings.splice(this.stings.indexOf(S), 1); }
    }
  }
  // 분위기가 바뀌면: 급할 때(선전포고·패전·승전·화면 전환)는 바로, 아니면 지금 악절을 마치고 넘어간다
  direct(now) {
    const G = this.app.G;
    if (G !== this.G) { this.G = G; this.warWas = !!(G?.player && atWarAny(G, G.player)); this.victoryUntil = this.defeatUntil = 0; }
    const m = this.override ? '@' + this.override : this.mood();
    if (m === this.want) { this.cand = null; return; }
    const w = this.want;
    const urgent = this.urgent || !w || m[0] === '@' || w[0] === '@' || m === 'title' || w === 'title' || m === 'defeat' || m === 'victory';
    if (!urgent) { // 잠깐 오르내리는 값에 곡이 흔들리지 않게 몇 초 지켜본다
      if (this.cand !== m) { this.cand = m; this.candT = now; return; }
      if (now - this.candT < 3) return;
    }
    this.urgent = false; this.cand = null; this.want = m;
    const P = this.cur;
    if (P && !this.fits(P.id, m)) {
      // 악절 끝이 멀면(느린 곡) 기다리지 않고 몇 초에 걸쳐 줄인다
      const left = P.done ? 0 : P.secT + P.secs[P.i].len * P.spb - now;
      if (urgent || left > 12) { P.stop(now, urgent ? 1.8 : 3.5); this.cur = null; this.gapUntil = Math.max(now + (urgent ? 0.4 : 2.5), this.stingEnd - 0.4); }
      else P.last = true;
    } else if (!P) this.gapUntil = Math.min(this.gapUntil, Math.max(now + 0.6, this.stingEnd - 0.4));
  }
  mood() {
    const G = this.app.G;
    if (!G?.player || document.getElementById('title')?.classList.contains('show')) return 'title';
    const me = G.player, C = G.countries[me];
    if (!C || !C.alive || C.capitulated) return 'defeat';
    const war = atWarAny(G, me), t = performance.now();
    if (war !== this.warWas) { this.warWas = war; if (war) { this.sting('war'); this.urgent = true; } }
    if (t < this.defeatUntil) return 'defeat';
    if (t < this.victoryUntil) return 'victory';
    if (war) {
      const my = C.surrender || 0, cs = G.st[C.capital];
      const capLost = cs && cs.ctrl !== me && atWar(G, me, cs.ctrl);
      let foe = 0;
      for (const e of enemiesOf(G, me)) { const E = G.countries[e]; if (E?.alive && !E.capitulated) foe = Math.max(foe, (E.surrender || 0) * (E.major ? 1 : 0.6)); }
      if (capLost || my >= (this.want === 'crisis' ? 0.18 : 0.28)) return 'crisis';
      if (my < 0.12 && foe >= (this.want === 'advance' ? 0.15 : 0.25)) return 'advance';
      return 'war';
    }
    // 평시: 세계 긴장도, 전쟁 준비(정당화), 동맹국의 전쟁
    const allyWar = G.wars.some((w) => w.att.concat(w.def).some((x) => x !== me && allied(G, me, x)));
    return G.tension >= (this.want === 'tension' ? 0.4 : 0.5) || C.justify?.length || allyWar ? 'tension' : 'peace';
  }
  fits(id, m) { return !!m && (m[0] === '@' ? id === m.slice(1) : !!MOODS[m]?.includes(id)); }
  pick(m) {
    if (m[0] === '@') return m.slice(1);
    const L = MOODS[m];
    this.rot[m] = ((this.rot[m] ?? Math.floor(Math.random() * L.length)) + 1) % L.length;
    return L[this.rot[m]];
  }
  // 짧은 효과 음악: 흐르던 곡을 잠시 줄이고 위에 울린다
  sting(id) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || this.override) return;
    const now = c.currentTime;
    if (now - this.lastSting < 6) return;
    this.lastSting = now;
    const S = new Player(this.syn, id, now + 0.08);
    this.stings.push(S);
    this.stingEnd = now + 0.08 + S.length;
    const P = this.cur;
    if (P) for (const b of [P.bus.dry, P.bus.wet]) { glide(b, P.lv * 0.25, now, 0.3); glide(b, P.lv, this.stingEnd, 2); }
  }
  // 뉴스로 알 수 있는 순간들: 적국·동맹국의 항복, 우리나라의 항복, 승리로 끝난 전쟁
  onNews(n) {
    const G = this.app.G, me = G?.player;
    if (!me || !this.ctx || !n.tags) return;
    if (n.kind === 'capitulate') {
      const loser = n.tags[0];
      if (loser === me) { this.defeatUntil = performance.now() + 150e3; this.urgent = true; }
      else if (atWar(G, me, loser)) this.sting('cap');
      else if (allied(G, me, loser) && atWarAny(G, me)) this.sting('fall');
    } else if (n.kind === 'peace' && n.tags.includes(me) && G.countries[me]?.alive) {
      this.victoryUntil = performance.now() + (atWarAny(G, me) ? 70e3 : 150e3); this.urgent = true;
    }
  }
}

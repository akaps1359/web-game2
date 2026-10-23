// 배경 분위기: 장소마다 바람·웅웅거림 같은 바탕을 겹쳐 바꾸고(3초), 가끔 물방울·신음·까마귀 같은 소리를 무작위 자리에서 낸다
import { glide } from './wa.js';
import { AMB } from './bank.js';

export const AMB_KINDS = ['town', 'crypt', 'catacombs', 'caves', 'hell'];
const XF = 3;
const rr = (a, b) => a + (b - a) * Math.random();
// 바탕 층: [잡음(pink·brown·fire), 필터, 주파수, Q, 크기, 주파수가 떠도는 범위, 세기가 떠도는 범위(돌풍)]
// 가끔 소리: [이름, 최소 간격(초), 최대 간격, 크기]
const DEF = {
  town: {
    layers: [['pink', 'bandpass', 650, 0.7, 0.225, [450, 1100], [0.3, 1]], ['pink', 'bandpass', 2600, 5, 0.023, [2000, 3200], [0.3, 1]], ['brown', 'lowpass', 300, 0.7, 0.099, null, [0.7, 1]]],
    ev: [['amb_crow', 14, 35, 0.55], ['amb_gust', 9, 22, 0.55], ['amb_creak', 20, 50, 0.4], ['amb_bell', 50, 110, 0.4], ['amb_owl', 35, 80, 0.4]],
  },
  crypt: {
    layers: [['brown', 'lowpass', 170, 0.7, 0.27, [120, 220], [0.7, 1]], ['pink', 'bandpass', 900, 1, 0.023, [600, 1400], [0.3, 1]]],
    ev: [['amb_drip', 3, 9, 0.5], ['amb_moan', 22, 50, 0.45], ['amb_chain', 25, 60, 0.4], ['amb_stone', 30, 70, 0.45], ['amb_door', 40, 90, 0.4], ['amb_whisper', 35, 80, 0.35]],
  },
  catacombs: {
    layers: [['brown', 'lowpass', 220, 0.7, 0.248, [160, 280], [0.7, 1]], ['pink', 'bandpass', 1900, 4, 0.027, [1500, 2600], [0.2, 1]]],
    ev: [['amb_drip', 4, 11, 0.45], ['amb_whisper', 20, 45, 0.4], ['amb_bones', 18, 45, 0.45], ['amb_scream', 40, 90, 0.35], ['amb_scrape', 25, 60, 0.35], ['amb_moan', 30, 70, 0.4]],
  },
  caves: {
    layers: [['brown', 'lowpass', 95, 0.8, 0.338, [70, 130], [0.6, 1]], ['pink', 'bandpass', 3000, 2, 0.016, [2500, 3800], [0.4, 1]]],
    ev: [['amb_drip', 1.5, 6, 0.55], ['amb_water', 15, 35, 0.4], ['amb_rocks', 25, 60, 0.5], ['amb_rumble', 30, 70, 0.6], ['amb_growl', 35, 80, 0.4], ['amb_bat', 20, 50, 0.35]],
  },
  hell: {
    layers: [['brown', 'lowpass', 140, 0.8, 0.315, [100, 200], [0.6, 1]], ['pink', 'bandpass', 450, 1.2, 0.081, [300, 700], [0.4, 1]], ['fire', 'highpass', 400, 0.7, 0.158, null, [0.5, 1]]],
    ev: [['amb_scream', 15, 40, 0.4], ['amb_wail', 25, 60, 0.45], ['amb_rumble', 20, 50, 0.6], ['amb_lava', 8, 22, 0.5], ['amb_fire', 10, 28, 0.45], ['amb_growl', 25, 60, 0.45], ['amb_chain', 30, 70, 0.35]],
  },
};
const evKeys = (kind) => DEF[kind].ev.flatMap(([n]) => Array.from({ length: AMB[n][0].n || 1 }, (_, v) => `amb:${n}:${v}`));
const bedKeys = (kind) => [...new Set(DEF[kind].layers.map((l) => 'bed:' + l[0]))];

// 장소 하나의 바탕 소리
class Bed {
  constructor(A, kind) {
    const c = A.c, now = c.currentTime;
    this.A = A; this.kind = kind; this.D = DEF[kind]; this.on = false; this.dead = false; this.src = []; this.mods = [];
    this.out = c.createGain(); this.out.gain.value = 0; this.out.connect(A.bus);
    // 처음 소리는 조금 일찍(들어서자마자 분위기가 느껴지게)
    this.next = {};
    for (const [n, lo, hi] of this.D.ev) this.next[n] = now + rr(lo * 0.3, (lo + hi) * 0.4);
  }
  start() {
    const c = this.A.c, now = c.currentTime, cache = this.A.sys.cache;
    for (const [buf, type, f, q, lv, fr, gr] of this.D.layers) {
      const b = cache.get('bed:' + buf);
      if (!b) continue;
      const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      s.buffer = b; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = lv;
      s.connect(fl); fl.connect(g); g.connect(this.out); s.start(now, Math.random() * b.duration);
      this.src.push(s); this.mods.push({ fl, g, lv, fr, gr, nt: now + rr(1, 3) });
    }
    glide(this.out, 1, now, XF);
    this.on = true;
  }
  tick(now) {
    if (this.dead) return;
    if (!this.on) { if (bedKeys(this.kind).every((k) => this.A.sys.cache.has(k))) this.start(); else return; }
    // 바람이 일렁이듯 세기와 음색을 천천히 떠돌게
    for (const m of this.mods) {
      if (now < m.nt) continue;
      const tau = rr(1.2, 3.5);
      if (m.gr) m.g.gain.setTargetAtTime(m.lv * rr(m.gr[0], m.gr[1]), now, tau);
      if (m.fr) m.fl.frequency.setTargetAtTime(rr(m.fr[0], m.fr[1]), now, tau);
      m.nt = now + rr(2, 6);
    }
    for (const [n, lo, hi, v] of this.D.ev) if (now >= this.next[n]) { this.next[n] = now + rr(lo, hi); this.A.event(n, v); }
  }
  stop(now) {
    this.dead = true;
    glide(this.out, 0, now, XF);
    setTimeout(() => { for (const s of this.src) try { s.stop(); } catch { /* 이미 멈춤 */ } try { this.out.disconnect(); } catch { /* 이미 끊김 */ } }, (XF + 0.5) * 1000);
  }
}

export class Ambience {
  constructor(sys) {
    this.sys = sys; this.c = sys.ctx; this.cur = null;
    this.bus = this.c.createGain(); this.bus.gain.value = 0.8; this.bus.connect(sys.sfxBus);
    this.send = this.c.createGain(); this.send.gain.value = 1; this.send.connect(sys.sfxRev);
  }
  get kind() { return this.cur?.kind || null; }
  set(kind) {
    if (this.kind === kind) return;
    const now = this.c.currentTime, cache = this.sys.cache;
    if (this.cur) this.cur.stop(now);
    this.cur = null;
    if (!kind || !DEF[kind]) return;
    const keep = new Set([...evKeys(kind), ...bedKeys(kind)]);
    for (const k of bedKeys(kind)) cache.want(k, 1);
    for (const k of evKeys(kind)) cache.want(k, 2);
    cache.drop((k) => k.startsWith('amb:') && !keep.has(k)); // 다른 장소의 소리는 비운다
    this.cur = new Bed(this, kind);
  }
  tick() { if (this.cur) this.cur.tick(this.c.currentTime); }
  // 가끔 소리 하나: 무작위 좌우 자리, 크기·빠르기를 조금씩 다르게, 잔향을 많이(멀리서 들리게)
  event(name, v) {
    if (this.sys.vol.sfx < 0.001) return;
    const c = this.c, cache = this.sys.cache, n = AMB[name][0].n || 1;
    let b = null;
    for (let i = 0, k = Math.floor(Math.random() * n); i < n && !b; i++) b = cache.get(`amb:${name}:${(k + i) % n}`);
    if (!b) { cache.want(`amb:${name}:0`, 1); return; }
    const t = c.currentTime, s = c.createBufferSource(), g = c.createGain(), w = c.createGain();
    s.buffer = b; s.playbackRate.value = rr(0.92, 1.06); g.gain.value = v * rr(0.6, 1); w.gain.value = rr(0.5, 0.9);
    s.connect(g);
    let o = g;
    if (this.sys.hasPan) { const p = c.createStereoPanner(); p.pan.value = rr(-0.85, 0.85); g.connect(p); o = p; }
    o.connect(this.bus); o.connect(w); w.connect(this.send);
    s.start(t);
    s.onended = () => { for (const x of [s, g, o, w]) try { x.disconnect(); } catch { /* 이미 끊김 */ } };
  }
}

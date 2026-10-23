// 소리 저장소: 그리기는 워커에게 맡기고(게임 화면이 멈추지 않게) 받은 표본을 AudioBuffer로 모아 둔다
// 워커를 쓸 수 없으면 메인 스레드에서 한 번에 하나씩 짬짬이 그린다
import { render } from './bank.js';

export class Cache {
  constructor(ctx) {
    this.ctx = ctx;
    this.m = new Map(); // 열쇠 → { b: AudioBuffer, cb: [], pr, sent, failed, ms }
    this.q = [[], [], []]; // 0 지금 들려줄 것 · 1 곧 쓸 것(곡·분위기) · 2 미리 데워 둘 것
    this.fly = 0; this.id = 0; this.local = false; this.timer = 0; this.lastMsg = 0;
    this.stat = { n: 0, ms: 0, bytes: 0, fail: 0 };
    try {
      this.w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      this.w.onmessage = (e) => this.got(e.data);
      this.w.onerror = (e) => { e.preventDefault?.(); this.toLocal('워커 오류: ' + (e.message || '')); };
    } catch (e) { this.toLocal(String(e)); }
  }
  get(key) { const r = this.m.get(key); return r ? r.b : null; }
  has(key) { const r = this.m.get(key); return !!(r && (r.b || r.failed)); }
  // 그려 달라고 부탁한다(pr이 작을수록 먼저). 있으면 cb를 바로 부르고, 그리는 중이면 기다린다
  want(key, pr = 1, cb) {
    let r = this.m.get(key);
    if (r && r.b) { if (cb) cb(r.b); return r.b; }
    if (r && r.failed) return null;
    if (!r) { r = { b: null, cb: [], pr, sent: false }; this.m.set(key, r); this.q[pr].push(key); }
    else if (pr < r.pr && !r.sent) { r.pr = pr; this.q[pr].push(key); }
    if (cb) r.cb.push(cb);
    if (this.local && pr === 0 && !r.sent) this.renderHere(key); // 워커가 없으면 급한 것은 바로 그린다
    else this.pump();
    return r.b;
  }
  // 더 쓰지 않을 소리를 비운다(곡·분위기가 바뀌었을 때)
  drop(pred) { for (const [k, r] of this.m) if (r.b && !r.cb.length && pred(k)) { this.stat.bytes -= r.bytes || 0; this.m.delete(k); } }
  next() {
    for (const q of this.q) while (q.length) { const k = q.shift(), r = this.m.get(k); if (r && !r.b && !r.sent && !r.failed) return k; }
    return null;
  }
  pump() {
    if (this.local) { if (!this.timer) this.timer = setTimeout(() => this.slice(), 0); return; }
    while (this.fly < 2) {
      const key = this.next();
      if (!key) return;
      this.m.get(key).sent = true; this.fly++; this.lastMsg = performance.now();
      this.w.postMessage({ id: ++this.id, key, sr: this.ctx.sampleRate });
    }
  }
  got(d) {
    this.fly = Math.max(0, this.fly - 1); this.lastMsg = performance.now();
    const r = this.m.get(d.key);
    if (d.err) { console.warn('소리를 그리지 못했습니다', d.key, d.err); this.fail(r); }
    else if (r) this.put(r, d.ch, d.sr, d.ms);
    this.pump();
  }
  fail(r) { if (r) { r.failed = true; r.sent = false; r.cb = []; this.stat.fail++; } }
  put(r, ch, sr, ms) {
    try {
      const b = this.ctx.createBuffer(ch.length, ch[0].length, sr);
      ch.forEach((c, i) => (b.copyToChannel ? b.copyToChannel(c, i) : b.getChannelData(i).set(c)));
      r.b = b; r.ms = ms; r.sent = false; r.bytes = ch.length * ch[0].length * 4;
      this.stat.n++; this.stat.ms += ms; this.stat.bytes += r.bytes;
    } catch (e) { console.warn('소리 버퍼를 만들지 못했습니다', e); this.fail(r); return; }
    const cbs = r.cb; r.cb = [];
    for (const f of cbs) try { f(r.b); } catch (e) { console.warn(e); }
  }
  // 워커 없이: 보내 둔 것도 다시 줄에 세우고 메인 스레드에서 그린다
  toLocal(why) {
    if (this.local) return;
    console.warn('소리를 메인 스레드에서 그립니다', why);
    this.local = true; this.fly = 0;
    try { this.w?.terminate(); } catch { /* 이미 닫힘 */ }
    for (const [k, r] of this.m) if (r.sent && !r.b) { r.sent = false; this.q[r.pr].unshift(k); }
    this.pump();
  }
  renderHere(key) {
    const r = this.m.get(key);
    if (!r || r.b || r.failed) return;
    try { const o = render(key, this.ctx.sampleRate); this.put(r, o.ch, o.sr, o.ms); } catch (e) { console.warn('소리를 그리지 못했습니다', key, e); this.fail(r); }
  }
  // 짬짬이 하나씩(한 번에 하나라 화면이 오래 멈추지 않는다)
  slice() {
    this.timer = 0;
    const key = this.next();
    if (!key) return;
    this.renderHere(key);
    this.timer = setTimeout(() => this.slice(), this.q[0].length ? 0 : 30);
  }
  // 워커가 오래 답이 없으면 메인 스레드로 바꾼다
  tick() { if (!this.local && this.fly > 0 && performance.now() - this.lastMsg > 10000) this.toLocal('워커가 응답하지 않음'); }
  // 여러 열쇠가 모두 준비(또는 실패)될 때까지 기다린다
  all(keys, pr = 1) {
    for (const k of keys) this.want(k, pr);
    return new Promise((res) => { const chk = () => (keys.every((k) => this.has(k)) ? res() : setTimeout(chk, 40)); chk(); });
  }
}

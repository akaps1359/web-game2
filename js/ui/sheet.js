// 바텀 시트 (패널 컨테이너)
import { h, clear, onTap } from './dom.js';
import { icon } from './icons.js';

export class Sheet {
  constructor(el, app) {
    this.el = el; this.app = app;
    this.isOpen = false; this.current = null;
    this.updaters = [];
    this.grip = h('div', { class: 'sheet-grip' });
    this.head = h('div', { class: 'sheet-head' });
    this.tabs = h('div', { class: 'sheet-tabs' });
    this.body = h('div', { class: 'sheet-body' });
    el.append(this.grip, this.head, this.tabs, this.body);
    // 끌어서 닫기
    let y0 = null, dy = 0;
    this.grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; this.grip.setPointerCapture(e.pointerId); el.style.transition = 'none'; });
    this.grip.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 == null) return; el.style.transition = ''; el.style.transform = ''; if (dy > 70) this.close(); y0 = null; };
    this.grip.addEventListener('pointerup', end); this.grip.addEventListener('pointercancel', end);
    this.head.addEventListener('pointerdown', (e) => { if (e.target === this.head || e.target.tagName === 'H2') { y0 = e.clientY; dy = 0; this.head.setPointerCapture(e.pointerId); el.style.transition = 'none'; } });
    this.head.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)`; });
    this.head.addEventListener('pointerup', end); this.head.addEventListener('pointercancel', end);
  }
  open(key, P, arg) {
    const same = this.current === key && this.arg === arg;
    this.current = key; this.P = P; this.arg = arg;
    if (!same) this.tab = P.tabs ? (P.defaultTab?.(this.app, arg) || P.tabs[0][0]) : null;
    this.el.classList.remove('half', 'tall');
    if (P.size) this.el.classList.add(P.size);
    this.render(true);
    this.el.classList.add('open'); this.el.setAttribute('aria-hidden', 'false');
    this.isOpen = true;
    this.app.inMenu = !!P.pause;
  }
  setTab(t) { this.tab = t; this.render(true); }
  render(resetScroll) {
    const P = this.P, app = this.app;
    const st = resetScroll ? 0 : this.body.scrollTop;
    clear(this.head); clear(this.tabs); clear(this.body);
    this.updaters = [];
    const title = P.title(app, this.arg);
    const hd = typeof title === 'string' ? h('h2', null, title) : title;
    const close = h('button', { class: 'ibtn', html: icon('close') }); onTap(close, () => this.close());
    this.head.append(...(P.headLeft ? [P.headLeft(app, this.arg)] : []), hd, ...(P.headRight ? [P.headRight(app, this.arg)] : []), close);
    if (P.tabs) {
      this.tabs.style.display = '';
      for (const [k, label] of P.tabs) { const b = h('button', { class: 'stab' + (k === this.tab ? ' on' : '') }, label); onTap(b, () => this.setTab(k)); this.tabs.appendChild(b); }
    } else this.tabs.style.display = 'none';
    this.body.className = 'sheet-body' + (P.nopad ? ' nopad' : '') + (P.bodyClass ? ' ' + P.bodyClass : '');
    this.body.removeAttribute('style');
    const ctx = { tab: this.tab, onUpdate: (fn) => this.updaters.push(fn), rerender: () => this.render(false), sheet: this };
    P.render(app, this.body, this.arg, ctx);
    this.sig = P.sig ? P.sig(app, this.arg, this.tab) : null;
    this.body.scrollTop = st;
  }
  refresh() { if (this.isOpen) this.render(false); }
  tickRefresh() {
    if (!this.isOpen || !this.P) return;
    if (this.P.sig) { const s = this.P.sig(this.app, this.arg, this.tab); if (s !== this.sig) { this.render(false); return; } }
    for (const fn of this.updaters) try { fn(); } catch (e) { console.warn(e); }
  }
  close() {
    this.el.classList.remove('open'); this.el.setAttribute('aria-hidden', 'true');
    this.isOpen = false;
    this.app.inMenu = false;
    if (this.current === 'state' || this.current === 'sea') { this.app.r.sel.state = -1; this.app.dirty = true; }
    if (this.current === 'units') { /* 선택은 유지 */ }
    this.current = null;
    this.app.setActiveTab(null);
    this.P?.onClose?.(this.app);
  }
}

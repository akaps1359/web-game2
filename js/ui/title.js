// 제목 화면: 캐릭터 고르기·만들기(가로 화면: 두 단)
import { $, el, btn, onTap, canvasFor, uiDpr } from './dom.js';
import { drawPortrait } from '../render/figures.js';
import { CLASSES } from '../data/classes.js';
import { listChars, deleteChar } from '../core/save.js';
import { Hero } from '../game/hero.js';
import { josa } from '../core/util.js';

const LOOKS = {
  warrior: () => ({ ...CLASSES.warrior.look, cols: { ...CLASSES.warrior.look.cols, torso: '#8a8a92', arms: '#8a8a92', pad: '#9a9aa2' }, pads: true, wtype: 'sword', wlen: 30, wcol: '#c8ccd4', shield: { type: 'kite', color: '#7a2420', rim: '#d0b050' }, helm: { type: 'helm', color: '#8a8a92' } }),
  rogue: () => ({ ...CLASSES.rogue.look, cols: { ...CLASSES.rogue.look.cols }, wtype: 'bow', wcol: '#6a4a28', helm: { type: 'hood', color: '#3a4a2a' }, cape: true, cols2: 1 }),
  sorcerer: () => ({ ...CLASSES.sorcerer.look, cols: { ...CLASSES.sorcerer.look.cols }, wtype: 'staff', wlen: 54, gem: '#7ad0ff' }),
};

export class Title {
  constructor(app) {
    this.app = app;
    this.root = $('#title');
    this.mode = 'main';
    this.t = 0;
  }
  show() { this.root.classList.add('on'); this.mode = 'main'; this.render(); }
  hide() { this.root.classList.remove('on'); this.root.innerHTML = ''; this.bg = null; }

  render() {
    const r = this.root;
    r.innerHTML = '';
    const bg = canvasFor(null, window.innerWidth, window.innerHeight);
    bg.c.className = 'bg';
    r.appendChild(bg.c);
    this.bg = bg;
    const w = el('div', 't-wrap');
    r.appendChild(w);
    if (this.mode === 'main') this.main(w);
    else if (this.mode === 'load') this.load(w);
    else if (this.mode === 'new') this.create(w);
  }

  main(w) {
    const logo = el('div', 't-logo');
    logo.appendChild(el('div', 'l1', '공허의 왕관'));
    logo.appendChild(el('div', 'l2', 'HOLLOW CROWN'));
    w.appendChild(logo);
    const m = el('div', 't-menu');
    const chars = listChars();
    if (chars.length) {
      const last = chars.find((c) => !c.dead);
      if (last) m.appendChild(btn('t-btn', `이어하기 — ${last.name}`, () => { this.app.audio?.unlock?.(); this.app.continueGame(last.id); }));
      m.appendChild(btn('t-btn', '캐릭터 고르기', () => { this.mode = 'load'; this.render(); }));
    }
    m.appendChild(btn('t-btn', '새 캐릭터', () => { this.mode = 'new'; this.cls = this.cls || 'warrior'; this.render(); }));
    w.appendChild(m);
    w.appendChild(el('div', 't-foot', '디아블로풍 액션 RPG · 가로 화면 전용 · 소리는 화면을 처음 누른 뒤부터 납니다'));
  }

  load(w) {
    const L = el('div', 't-col scroll'), R = el('div', 't-col');
    w.append(L, R);
    const h = el('div', 'pnl-title', '캐릭터');
    h.style.marginBottom = '10px';
    L.appendChild(h);
    const box = el('div', 'chars');
    for (const c of listChars()) {
      const card = el('button', 'char-card');
      const cv = canvasFor(card, 56, 64);
      drawPortrait(cv.g, LOOKS[c.cls](), 28, 60, 0.82, 0.4);
      const info = el('div');
      info.appendChild(el('div', 'cn', c.name));
      const dd = el('div', 'cd', `${CLASSES[c.cls].name} · 레벨 ${c.lvl} · 최고 지하 ${c.depth}층${c.done ? ' · 공허의 군주 처치' : ''}`);
      info.appendChild(dd);
      if (c.hc) info.appendChild(el('div', 'hc', c.dead ? '하드코어 · 사망' : '하드코어'));
      card.appendChild(info);
      const del = btn('del', '✕', () => {
        if (!confirm(`${c.name}${josa(c.name, '을', '를')} 지울까요? 되돌릴 수 없습니다.`)) return;
        deleteChar(c.id); this.render();
      });
      card.appendChild(del);
      onTap(card, (e) => { if (e.target === del) return; if (c.dead) { this.app.toast('죽은 하드코어 캐릭터입니다'); return; } this.app.audio?.unlock?.(); this.app.continueGame(c.id); });
      box.appendChild(card);
    }
    L.appendChild(box);
    const m = el('div', 't-menu');
    m.appendChild(btn('t-btn', '새 캐릭터', () => { this.mode = 'new'; this.cls = this.cls || 'warrior'; this.render(); }));
    m.appendChild(btn('t-btn dim', '뒤로', () => { this.mode = 'main'; this.render(); }));
    R.appendChild(m);
  }

  create(w) {
    const L = el('div', 't-col'), R = el('div', 't-col');
    w.append(L, R);
    const h = el('div', 'pnl-title', '직업을 고르세요');
    h.style.marginBottom = '8px';
    L.appendChild(h);
    const pick = el('div', 'cls-pick');
    this.cards = [];
    for (const id of ['warrior', 'rogue', 'sorcerer']) {
      const C = CLASSES[id];
      const b = el('button', 'cls' + (this.cls === id ? ' on' : ''));
      const cv = canvasFor(b, 110, 120);
      b.appendChild(el('div', 'nm', C.name));
      onTap(b, () => { this.cls = id; this.render(); });
      pick.appendChild(b);
      this.cards.push({ id, cv });
    }
    L.appendChild(pick);
    const C = CLASSES[this.cls];
    L.appendChild(el('div', 'cls-desc', C.desc));
    const sts = el('div', 'cls-stats');
    const tmp = new Hero({ cls: this.cls, lvl: 1, base: { ...C.base }, equip: {}, inv: [], belt: [], skills: {}, bar: [] }, null);
    for (const [k, n] of [['str', '힘'], ['mag', '마력'], ['dex', '민첩'], ['vit', '활력']]) { const d = el('div'); d.innerHTML = `${n}<b>${C.base[k]}</b>`; sts.appendChild(d); }
    R.appendChild(sts);
    const sts2 = el('div', 'cls-stats');
    sts2.style.gridTemplateColumns = 'repeat(2,1fr)';
    for (const [n, v] of [['생명력', tmp.st.hpMax], ['마나', tmp.st.mpMax]]) { const d = el('div'); d.innerHTML = `${n}<b>${v}</b>`; sts2.appendChild(d); }
    R.appendChild(sts2);
    const name = el('input', 'name-in');
    name.placeholder = '이름'; name.maxLength = 12; name.value = this.name || '';
    name.addEventListener('input', () => { this.name = name.value; });
    R.appendChild(name);
    const hc = el('label', 'hc-row');
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!this.hc;
    cb.addEventListener('change', () => { this.hc = cb.checked; });
    hc.append(cb, el('span', '', '하드코어 (죽으면 영원히 끝)'));
    R.appendChild(hc);
    const m = el('div', 't-menu');
    m.style.marginTop = '4px';
    m.appendChild(btn('t-btn', '모험 시작', () => {
      const nm = (this.name || '').trim() || { warrior: '아이단', rogue: '리아', sorcerer: '에른' }[this.cls];
      this.app.audio?.unlock?.();
      this.app.newGame(this.cls, nm, !!this.hc);
    }));
    m.appendChild(btn('t-btn dim', '뒤로', () => { this.mode = listChars().length ? 'load' : 'main'; this.render(); }));
    R.appendChild(m);
  }

  // 배경 그림과 직업 그림 움직이기
  frame(dt) {
    if (!this.root.classList.contains('on') || !this.bg) return;
    this.t += dt;
    const g = this.bg.g, W = window.innerWidth, H = window.innerHeight, t = this.t;
    // 화면을 돌리면 배경 캔버스도 새 크기로
    const c = this.bg.c, dpr = uiDpr();
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + 'px'; c.style.height = H + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    g.clearRect(0, 0, W, H);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#050203'); sky.addColorStop(0.55, '#1a0806'); sky.addColorStop(1, '#000');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // 붉은 달
    const mx = W * 0.78, my = H * 0.3;
    const mg = g.createRadialGradient(mx, my, 4, mx, my, 120);
    mg.addColorStop(0, 'rgba(255,90,50,0.55)'); mg.addColorStop(0.2, 'rgba(160,30,20,0.25)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c84a2a'; g.beginPath(); g.arc(mx, my, 26, 0, Math.PI * 2); g.fill();
    // 대성당 실루엣
    g.fillStyle = '#030101';
    const by = H * 0.62;
    g.beginPath();
    g.moveTo(0, H); g.lineTo(0, by + 40); g.lineTo(W * 0.18, by + 30); g.lineTo(W * 0.18, by - 20); g.lineTo(W * 0.24, by - 70); g.lineTo(W * 0.3, by - 20);
    g.lineTo(W * 0.3, by - 40); g.lineTo(W * 0.42, by - 40); g.lineTo(W * 0.42, by - 120); g.lineTo(W * 0.48, by - 230); g.lineTo(W * 0.54, by - 120); g.lineTo(W * 0.54, by - 40);
    g.lineTo(W * 0.66, by - 40); g.lineTo(W * 0.66, by - 10); g.lineTo(W * 0.72, by - 60); g.lineTo(W * 0.78, by - 10); g.lineTo(W, by + 30); g.lineTo(W, H); g.closePath(); g.fill();
    // 창문 불빛
    const fl = 0.6 + 0.4 * Math.sin(t * 7) * Math.sin(t * 3.3);
    g.fillStyle = `rgba(255,110,40,${0.5 + 0.3 * fl})`;
    g.beginPath(); g.ellipse(W * 0.48, by - 130, 6, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(W * 0.455, by - 70, 8, 16); g.fillRect(W * 0.495, by - 70, 8, 16);
    // 재·불티
    if (!this.embers) this.embers = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.8, v: 0.01 + Math.random() * 0.03 }));
    g.globalCompositeOperation = 'lighter';
    for (const e of this.embers) {
      e.y -= e.v * dt; e.x += Math.sin(t + e.s * 9) * 0.0006;
      if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
      g.fillStyle = `rgba(255,${120 + e.s * 40},50,${0.4 + 0.3 * Math.sin(t * 3 + e.s * 10)})`;
      g.beginPath(); g.arc(e.x * W, e.y * H, e.s, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    // 직업 그림
    if (this.mode === 'new' && this.cards) for (const c of this.cards) {
      const cg = c.cv.g;
      cg.clearRect(0, 0, 110, 120);
      const sel = c.id === this.cls;
      if (sel) { const rg = cg.createRadialGradient(55, 100, 4, 55, 100, 60); rg.addColorStop(0, 'rgba(255,150,60,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); cg.fillStyle = rg; cg.fillRect(0, 0, 110, 120); }
      const anim = sel ? (Math.floor(t / 1.6) % 3 === 2 ? (c.id === 'sorcerer' ? 'cast' : 'attack') : 'idle') : 'idle';
      drawPortrait(cg, LOOKS[c.id](), 55, 108, 1.15, t, anim, Math.PI / 4 + (sel ? Math.sin(t * 0.6) * 0.5 : 0));
    }
  }
}

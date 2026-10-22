// 앱 컨트롤러
import { MapData } from '../engine/mapdata.js';
import { createGame, tick, serialize, deserialize, setPlayer, resolveEvent, EVENT_INDEX } from '../engine/game.js';
import { fmtDate, atWar, atWarAny, allied, ymd, news } from '../engine/world.js';
import { orderMove, findPath, divStats, manpowerAvailable, setupArmies } from '../engine/military.js';
import { transportTime, canInvade } from '../engine/naval.js';
import { M } from '../engine/mods.js';
import { MapRenderer } from './render.js';
import { MapInput } from './input.js';
import { h, $, clear, onTap } from './dom.js';
import { icon } from './icons.js';
import { flagURL } from './flags.js';
import { fmtNum, fmtMan, pct, fmtDateShort, fmtHour } from './fmt.js';
import { Sheet } from './sheet.js';
import { PANELS } from './panels/index.js';
import { showEventModal, showDialog, closeModal } from './modal.js';
import { showTitle } from './title.js';

const SPEEDS = [0, 4, 10, 24, 60, 160]; // 게임 시간(시간)/초
const SAVE_PREFIX = 'chulhyeol.save.';

export class App {
  async boot() {
    const bar = $('.boot-bar i'), msg = $('.boot-msg');
    const res = await fetch('data/map.json');
    const total = +res.headers.get('content-length') || 1.4e6;
    const reader = res.body?.getReader?.();
    let text;
    if (reader) {
      const chunks = []; let got = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; bar.style.width = Math.min(90, (got / total) * 90) + '%'; }
      text = new TextDecoder().decode(concat(chunks));
    } else text = await res.text();
    msg.textContent = '국경선을 긋는 중…';
    await new Promise((r) => setTimeout(r, 30));
    this.map = new MapData(JSON.parse(text));
    this.canvas = $('#map');
    this.r = new MapRenderer(this.canvas, this.map);
    this.r.resize();
    window.addEventListener('resize', () => { this.r.resize(); this.dirty = true; });
    this.input = new MapInput(this.canvas, this.r, {
      tap: (x, y) => this.onMapTap(x, y),
      longPress: (x, y) => this.onLongPress(x, y),
      changed: (end) => { this.dirty = true; if (end) this.r.staticDirty = true; },
    });
    this.sheet = new Sheet($('#sheet'), this);
    this.sel = { divs: new Set(), mode: 'none' };
    this.r.sel.divs = this.sel.divs;
    this.speed = 0;
    this.prevSpeed = 2;
    bar.style.width = '100%';
    // 배경용 데모 게임
    this.G = createGame(this.map, { player: 'GER', seed: 1936 });
    this.r.focusOn(400, -6400, 0.06);
    this.loop();
    setTimeout(() => $('#boot').classList.add('hide'), 250);
    showTitle(this);
  }

  // ───────── 게임 시작/불러오기 ─────────
  startNew(tag, opts = {}) {
    this.G = createGame(this.map, { player: tag, seed: Math.floor(Math.random() * 1e9), difficulty: opts.difficulty });
    setPlayer(this.G, tag);
    setupArmies(this.G, tag);
    this.afterLoad();
    const C = this.G.countries[tag];
    if (C.capital >= 0 && !this.map.virtual[C.capital]) this.r.focusState(C.capital, 0.16);
    else this.r.focusOn(-2500, -6500, 0.07);
    this.setSpeed(0);
    this.toast(`${C.full} — ${C.leader} ${C.title}`, 'peace');
    if (!localStorage.getItem('chulhyeol.tutorialDone')) setTimeout(() => this.openPanel('help'), 400);
  }
  afterLoad() {
    const G = this.G;
    G.onNews = (n) => this.onNews(n);
    G.onEvent = () => {};
    this.sel.divs.clear(); this.sel.mode = 'none'; this.picker = null;
    this.r.labels = null; this.r.staticDirty = true;
    this.r.showLabels = this.settings().labels !== false;
    this.gameOverShown = false;
    this.r.sel.state = -1; this.r.sel.path = null;
    this.buildHUD(); this.buildTabs(); this.buildSide();
    this.sheet.close();
    this.updateFloat();
    $('#title').classList.remove('show');
    this.lastMonth = ymd(G.hour).m;
    this.hudDirty = true;
  }
  save(slot = 'auto') {
    try {
      const data = serialize(this.G);
      localStorage.setItem(SAVE_PREFIX + slot, data);
      localStorage.setItem(SAVE_PREFIX + slot + '.meta', JSON.stringify({ tag: this.G.player, name: this.G.countries[this.G.player].name, hour: this.G.hour, at: Date.now(), size: data.length }));
      return true;
    } catch (e) { console.error(e); this.toast('저장 실패: 저장 공간이 부족합니다', 'war'); return false; }
  }
  load(slot = 'auto') {
    const data = localStorage.getItem(SAVE_PREFIX + slot);
    if (!data) return false;
    try { this.G = deserialize(data, this.map); setPlayer(this.G, this.G.player); this.afterLoad(); const C = this.G.countries[this.G.player]; if (C.capital >= 0 && !this.map.virtual[C.capital]) this.r.focusState(C.capital, 0.14); this.setSpeed(0); return true; }
    catch (e) { console.error(e); this.toast('불러오기 실패', 'war'); return false; }
  }
  saveMeta(slot) { try { return JSON.parse(localStorage.getItem(SAVE_PREFIX + slot + '.meta') || 'null'); } catch { return null; } }

  // ───────── 루프 ─────────
  loop() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      const G = this.G;
      if (G && this.speed > 0 && !this.inMenu && !G.pending.length && G.player) {
        acc += dt * SPEEDS[this.speed];
        const t0 = performance.now();
        let n = 0;
        while (acc >= 1 && performance.now() - t0 < 12) {
          const prevDay = Math.floor(G.hour / 24);
          tick(G); acc -= 1; n++;
          if (Math.floor(G.hour / 24) !== prevDay) this.onNewDay();
          if (G.pending.length) { this.onEventPending(); acc = 0; break; }
        }
        if (acc > 6) acc = 6;
        if (n) { this.dirty = true; this.hudDirty = true; }
      }
      if (G?.mapDirty) { G.mapDirty = false; this.r.labels = null; this.mapStale = true; }
      if (this.mapStale && now - (this.lastMapRedraw || 0) > 350) { this.mapStale = false; this.lastMapRedraw = now; this.r.staticDirty = true; this.dirty = true; }
      if (this.hudDirty && now - (this.lastHud || 0) > 200) { this.lastHud = now; this.hudDirty = false; this.updateHUD(); this.sheet.tickRefresh(); this.updateFloat(true); }
      this.r.render(this.G, { gesturing: this.input.gesturing || this.input.inertia });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  onNewDay() {
    const G = this.G;
    const m = ymd(G.hour).m;
    if (m !== this.lastMonth) { this.lastMonth = m; if (G.player && this.settings().autosave !== false) this.save('auto'); }
    const C = G.countries[G.player];
    if (C && !C.alive && !this.gameOverShown) { this.gameOverShown = true; this.setSpeed(0); showDialog(this, { title: '패배', body: `${C.name}은(는) 더 이상 존재하지 않습니다.`, buttons: [{ text: '타이틀로', primary: true, fn: () => showTitle(this) }, { text: '계속 관전', fn: () => {} }] }); }
  }
  setSpeed(s) {
    if (s > 0) this.prevSpeed = s;
    this.speed = Math.max(0, Math.min(5, s));
    this.updateHUD();
  }
  togglePause() { this.setSpeed(this.speed > 0 ? 0 : this.prevSpeed || 2); }
  settings() { try { return JSON.parse(localStorage.getItem('chulhyeol.settings') || '{}'); } catch { return {}; } }
  setSetting(k, v) { const s = this.settings(); s[k] = v; localStorage.setItem('chulhyeol.settings', JSON.stringify(s)); }

  // ───────── 이벤트 / 뉴스 ─────────
  onEventPending() {
    this.pausedForEvent = this.speed;
    this.speed = 0; this.updateHUD();
    const p = this.G.pending[0];
    showEventModal(this, p, (k) => {
      resolveEvent(this.G, p.id, p.tag, k);
      closeModal();
      this.hudDirty = true; this.dirty = true; this.r.staticDirty = true;
      if (this.G.pending.length) setTimeout(() => this.onEventPending(), 60);
      else if (this.pausedForEvent && this.settings().resumeAfterEvent !== false) this.setSpeed(this.pausedForEvent);
    });
  }
  onNews(n) {
    const G = this.G;
    const mine = n.tags?.includes(G.player);
    if (n.quiet) return;
    if (n.big || mine) this.toast(n.text, n.kind === 'war' || n.kind === 'capitulate' ? 'war' : n.kind === 'peace' ? 'peace' : '');
    // 플레이어 관련 선전포고는 일시정지
    if (n.kind === 'war' && mine && n.big && this.settings().pauseOnWar !== false) { this.pausedForEvent = this.speed; this.setSpeed(0); }
  }
  toast(text, kind = '') {
    const box = $('#toasts');
    const t = h('div', { class: 'toast ' + kind }, text);
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
  }

  // ───────── HUD ─────────
  buildHUD() {
    const hud = clear($('#hud'));
    const G = this.G, C = G.countries[G.player];
    this.hud = {};
    const flag = h('div', { class: 'hud-flag' }, h('img', { src: flagURL(C.flag, 69, 46), alt: '' }));
    onTap(flag, () => this.openPanel('politics'));
    const name = h('div', { class: 'hud-name' }, h('b', null, C.name), this.hud.leader = h('small', null, ''));
    onTap(name, () => this.openPanel('politics'));
    this.hud.dateBtn = h('button', { class: 'date-btn' }, this.hud.date = h('span', { class: 'd' }), this.hud.hour = h('span', { class: 'h' }));
    onTap(this.hud.dateBtn, () => this.togglePause());
    const minus = h('button', { class: 'ibtn sm', html: icon('minus') }); onTap(minus, () => this.setSpeed(Math.max(1, this.speed - 1)));
    const plus = h('button', { class: 'ibtn sm', html: icon('plus') }); onTap(plus, () => this.setSpeed(Math.min(5, (this.speed || this.prevSpeed) + 1)));
    this.hud.dots = h('div', { class: 'speed-dots' }, [1, 2, 3, 4, 5].map(() => h('i')));
    const speed = h('div', { class: 'speed' }, this.hud.dots, h('div', { class: 'speed-btns' }, minus, plus));
    const menu = h('button', { class: 'ibtn', html: icon('menu') }); onTap(menu, () => this.openPanel('menu'));
    hud.appendChild(h('div', { class: 'hud-bar' }, flag, name, h('div', { class: 'hud-date' }, this.hud.dateBtn, speed), menu));
    const chip = (key, ic, panel) => { const el = h('div', { class: 'chip' }, h('span', { html: icon(ic) }), h('b'), h('small')); onTap(el, () => panel && this.openPanel(panel)); this.hud[key] = el; return el; };
    hud.appendChild(h('div', { class: 'hud-res' },
      chip('pp', 'pp', 'politics'), chip('stab', 'stability', 'politics'), chip('ws', 'warsupport', 'politics'), chip('mp', 'manpower', 'military'),
      chip('fac', 'industry', 'industry'), chip('fuel', 'fuel', 'industry'), chip('ten', 'tension', 'diplomacy'), chip('surr', 'flag', 'diplomacy')));
    this.updateHUD();
  }
  updateHUD() {
    const G = this.G; if (!this.hud || !G) return;
    const C = G.countries[G.player]; if (!C) return;
    const t = ymd(G.hour);
    this.hud.date.textContent = `${t.y}.${String(t.m).padStart(2, '0')}.${String(t.d).padStart(2, '0')}`;
    this.hud.hour.textContent = this.speed === 0 ? '일시정지' : `${String(t.h).padStart(2, '0')}:00`;
    this.hud.dateBtn.classList.toggle('paused', this.speed === 0);
    [...this.hud.dots.children].forEach((d, i) => d.classList.toggle('on', i < (this.speed || 0)));
    this.hud.leader.textContent = `${C.leader} · ${C.title}`;
    const set = (k, b, s, cls) => { const el = this.hud[k]; el.children[1].textContent = b; el.children[2].textContent = s || ''; el.className = 'chip ' + (cls || ''); };
    set('pp', Math.floor(C.pp), `${C.ppGain >= 0 ? '+' : ''}${(C.ppGain || 0).toFixed(2)}`, C.pp >= 150 ? 'good' : '');
    set('stab', pct(C.stability), '안정', C.stability < 0.3 ? 'warn' : '');
    set('ws', pct(C.warSupport), '전쟁지지', C.warSupport < 0.2 ? 'warn' : '');
    set('mp', fmtNum(manpowerAvailable(C)), '인력', manpowerAvailable(C) < 20000 ? 'warn' : '');
    set('fac', `${Math.round(C.eco.civ || 0)}/${Math.round(C.eco.mil || 0)}`, `민간/군수`);
    set('fuel', fmtNum(C.fuel || 0), '연료', (C.fuel || 0) < 2000 ? 'warn' : '');
    set('ten', pct(G.tension), '긴장도', G.tension > 0.6 ? 'warn' : '');
    const war = atWarAny(G, G.player);
    this.hud.surr.style.display = war ? '' : 'none';
    if (war) set('surr', pct(C.surrender || 0), '항복 진행', (C.surrender || 0) > 0.4 ? 'warn' : '');
    // 탭 배지
    if (this.tabs) {
      this.tabs.focus.querySelector('.badge')?.remove();
      if (!C.focus.cur) this.tabs.focus.appendChild(h('i', { class: 'badge' }));
      this.tabs.research.querySelector('.badge')?.remove();
      if (C.research.cur.some((s) => !s)) this.tabs.research.appendChild(h('i', { class: 'badge' }));
    }
  }
  buildTabs() {
    const bar = clear($('#tabbar'));
    this.tabs = {};
    const tabs = [['focus', '중점', 'focus'], ['politics', '정치', 'politics'], ['research', '연구', 'research'], ['industry', '산업', 'industry'], ['military', '군사', 'military'], ['diplomacy', '외교', 'diplomacy']];
    for (const [key, label, ic] of tabs) {
      const b = h('button', { class: 'tab' }, h('span', { html: icon(ic) }), h('span', null, label));
      onTap(b, () => { if (this.sheet.current === key && this.sheet.isOpen) this.sheet.close(); else this.openPanel(key); });
      bar.appendChild(b); this.tabs[key] = b;
    }
  }
  setActiveTab(key) { for (const k in this.tabs || {}) this.tabs[k].classList.toggle('on', k === key); }
  buildSide() {
    const side = clear($('#side'));
    const modes = [['political', '정치', 'flag'], ['faction', '진영', 'shield'], ['terrain', '지형', 'mountain'], ['industry', '산업', 'factory'], ['resource', '자원', 'oil'], ['supply', '보급', 'supply']];
    const btn = h('button', { class: 'side-btn', html: icon('layers') });
    let menu = null;
    onTap(btn, () => {
      if (menu) { menu.remove(); menu = null; return; }
      menu = h('div', { class: 'mode-menu' }, modes.map(([k, label, ic]) => { const b = h('button', { class: this.r.mode === k ? 'on' : '' }, h('span', { html: icon(ic) }), label); onTap(b, () => { this.r.mode = k; this.r.staticDirty = true; this.dirty = true; menu.remove(); menu = null; btn.classList.toggle('on', k !== 'political'); }); return b; }));
      side.appendChild(menu);
    });
    const home = h('button', { class: 'side-btn', html: icon('locate') });
    onTap(home, () => { const C = this.G.countries[this.G.player]; if (C.capital >= 0 && !this.map.virtual[C.capital]) this.r.focusState(C.capital, Math.max(0.14, this.r.cam.s)); this.dirty = true; });
    const newsBtn = h('button', { class: 'side-btn', html: icon('news') });
    onTap(newsBtn, () => this.openPanel('news'));
    side.append(btn, home, newsBtn);
  }

  openPanel(key, arg) {
    const P = PANELS[key];
    if (!P) return;
    this.sheet.open(key, P, arg);
    this.setActiveTab(key);
  }

  // ───────── 지도 탭 ─────────
  // 지도에서 주 하나 고르기 (공군 목표 등)
  pick(text, cb) { this.picker = { text, cb }; this.sel.divs.clear(); this.sel.mode = 'none'; this.updateFloat(); this.dirty = true; }
  onMapTap(x, y) {
    const G = this.G; if (!G.player) return;
    const r = this.r;
    if (this.picker) {
      const st = r.stateAt(x, y);
      if (st >= 0) { const p = this.picker; this.picker = null; this.updateFloat(); r.sel.state = st; this.dirty = true; p.cb(st); }
      return;
    }
    // 함대
    const fl = r.fleetAt(x, y);
    if (fl && !this.sel.divs.size) { this.openPanel('fleet', fl.list); return; }
    const stack = r.unitAt(x, y);
    if (stack && stack.tag === G.player && this.sel.mode !== 'invade' && this.sel.mode !== 'transport') {
      // 이미 선택 중이면 추가/교체
      const ids = stack.divs.map((d) => d.id);
      const allSel = ids.every((id) => this.sel.divs.has(id));
      if (this.sel.divs.size && !allSel && this.lastTapStack !== stack.key) { this.sel.divs.clear(); }
      if (allSel && this.sel.divs.size === ids.length) { this.openPanel('units', ids); }
      else { this.sel.divs.clear(); for (const id of ids) this.sel.divs.add(id); this.openPanel('units', ids); }
      this.lastTapStack = stack.key;
      this.sel.mode = 'move';
      this.updateFloat(); this.dirty = true; return;
    }
    const st = r.stateAt(x, y);
    if (this.sel.divs.size && st >= 0) {
      if (this.sel.mode === 'invade') return this.orderInvasion(st);
      if (this.sel.mode === 'transport') return this.orderTransport(st);
      return this.orderMoveSelected(st);
    }
    if (st >= 0) { r.sel.state = st; this.openPanel('state', st); this.dirty = true; return; }
    const z = r.seaAt(x, y);
    if (z >= 0) { r.sel.state = -1; this.openPanel('sea', z); this.dirty = true; return; }
    this.clearSelection();
  }
  onLongPress(x, y) {
    const st = this.r.stateAt(x, y);
    if (st >= 0) { this.r.sel.state = st; this.openPanel('state', st); this.dirty = true; if (navigator.vibrate) navigator.vibrate(10); }
  }
  clearSelection() {
    this.sel.divs.clear(); this.sel.mode = 'none'; this.r.sel.state = -1; this.r.sel.path = null; this.r.highlight = null;
    this.updateFloat(); this.dirty = true;
  }
  selectedDivs() { const out = []; for (const id of this.sel.divs) { const D = this.G.divs[id]; if (D) out.push(D); else this.sel.divs.delete(id); } return out; }
  orderMoveSelected(target) {
    const G = this.G; const divs = this.selectedDivs();
    if (!divs.length) return;
    let ok = 0, fail = 0;
    for (const D of divs) { if (D.sea) continue; if (orderMove(G, D, target, 'attack')) { ok++; if (D.army && G.armies[D.army]) G.armies[D.army].auto = false; } else fail++; }
    const hostile = atWar(G, G.player, G.st[target].ctrl);
    if (ok) this.toast(`${ok}개 사단 → ${this.map.name[target]} ${hostile ? '공격' : '이동'}`, hostile ? 'war' : '');
    else this.toast('그곳으로 가는 경로가 없습니다', 'war');
    this.r.sel.state = target;
    this.dirty = true; this.updateFloat();
  }
  orderTransport(target) {
    const G = this.G; let ok = 0;
    if (!(G.st[target].port > 0) || !(G.st[target].ctrl === G.player || allied(G, G.player, G.st[target].ctrl))) { this.toast('아군 항구가 있는 주를 선택하세요', 'war'); return; }
    for (const D of this.selectedDivs()) {
      if (!(G.st[D.loc].port > 0)) continue;
      const tt = transportTime(G, G.player, D.loc, target);
      if (tt == null) continue;
      D.sea = { kind: 'move', to: target, eta: G.hour + Math.round(tt), from: D.loc }; D.path = []; D.att = -1; ok++;
    }
    this.toast(ok ? `${ok}개 사단 해상 수송 시작 → ${this.map.name[target]}` : '항구에 있는 사단만 수송할 수 있습니다', ok ? '' : 'war');
    this.sel.mode = 'move'; this.updateFloat(); this.dirty = true;
  }
  orderInvasion(target) {
    const G = this.G;
    const why = canInvade(G, G.player, target);
    if (why) { this.toast(why, 'war'); return; }
    let ok = 0;
    for (const D of this.selectedDivs()) {
      if (!(G.st[D.loc].port > 0)) continue;
      // 출발 항구 → 대상 해안까지 시간 (준비 7일)
      let best = null;
      for (const z of this.map.coast[target]) { const tt = transportTime(G, G.player, D.loc, target); if (tt != null) best = tt; }
      if (best == null) continue;
      D.sea = { kind: 'invade', to: target, eta: G.hour + 7 * 24 + Math.round(best), from: D.loc }; D.path = []; D.att = -1; ok++;
    }
    this.toast(ok ? `상륙 작전 준비: ${ok}개 사단 → ${this.map.name[target]} (약 7일 준비)` : '항구에 있는 사단만 상륙할 수 있습니다', ok ? 'war' : 'war');
    this.sel.mode = 'move'; this.updateFloat(); this.dirty = true;
  }

  // 떠 있는 작전 바
  updateFloat(soft) {
    const box = $('#float');
    if (this.picker) {
      if (soft && this._floatKey === 'pick') return;
      this._floatKey = 'pick'; clear(box);
      const x = h('button', { class: 'ibtn', html: icon('close') }); onTap(x, () => { this.picker = null; this.updateFloat(); });
      box.appendChild(h('div', { class: 'opbar' }, h('div', { class: 'txt' }, '지도 선택', h('small', null, this.picker.text)), x));
      return;
    }
    const divs = this.G ? this.selectedDivs() : [];
    if (!divs.length) { if (box.firstChild) clear(box); this._floatKey = ''; return; }
    const key = divs.length + ':' + this.sel.mode;
    if (soft && this._floatKey === key) return;
    this._floatKey = key;
    clear(box);
    const modeTxt = this.sel.mode === 'invade' ? '상륙할 적 해안 주를 탭하세요' : this.sel.mode === 'transport' ? '도착할 아군 항구를 탭하세요' : '목적지를 탭하세요';
    const stop = h('button', { class: 'btn sm', html: icon('stop') + '정지' }); onTap(stop, () => { for (const D of divs) { D.path = []; D.att = -1; D.prog = 0; } this.toast('정지 명령'); this.dirty = true; });
    const sea = h('button', { class: 'btn sm', html: icon('anchor') + '수송' }); onTap(sea, () => { this.sel.mode = this.sel.mode === 'transport' ? 'move' : 'transport'; this.updateFloat(); });
    const inv = h('button', { class: 'btn sm', html: icon('invade') + '상륙' }); onTap(inv, () => { this.sel.mode = this.sel.mode === 'invade' ? 'move' : 'invade'; this.updateFloat(); });
    const x = h('button', { class: 'ibtn', html: icon('close') }); onTap(x, () => this.clearSelection());
    const atPort = divs.some((D) => this.G.st[D.loc].port > 0);
    box.appendChild(h('div', { class: 'opbar' }, h('div', { class: 'txt' }, `${divs.length}개 사단 선택`, h('small', null, modeTxt)), stop, atPort ? sea : null, atPort ? inv : null, x));
  }
}

function concat(chunks) { let n = 0; for (const c of chunks) n += c.length; const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out; }

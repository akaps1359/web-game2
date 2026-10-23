// HUD: 생명력·마나 구슬, 물약 띠, 기술 단추(탭 = 자동 조준, 끌기 = 조준), 상호작용 단추, 이동 조이스틱, 메뉴 단추, 작은 지도, 대상 정보
import { $, el, onTap, canvasFor } from './dom.js';
import { paintItemIcon } from '../render/icons.js';
import { paintSkillIcon } from '../render/skillicons.js';
import { skillDef, skillManaCost } from '../game/skills.js';
import { BUFF_INFO } from '../game/buffs.js';
import { levelName } from '../game/world.js';
import { EXP_TABLE } from '../data/classes.js';
import { F_SEEN, F_VIS, F_LAVA } from '../game/level.js';
import { TW, TH } from '../core/util.js';
import { ART } from '../render/pixel.js';
import { PIX_ICONS, pixRingCanvas, pixDiscCanvas, RING_BTN, stamp, uiFont } from './pixui.js';

// 메뉴 단추 아이콘(도트 그림)
const iconHTML = (k) => `<i class="pico" style="background-image:url(${PIX_ICONS[k]})"></i>`;

export class HUD {
  constructor(app) {
    this.app = app;
    this.root = $('#hud');
    this.root.classList.add('hidden');
    this.t = 0; this.mapT = 0; this.showMap = false;
    this.aim = null;
  }
  get game() { return this.app.game; }
  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; }

  build() {
    const r = this.root;
    r.innerHTML = '';
    // ── 위쪽 ──
    const top = el('div', 'hud-top');
    const menu = el('div', 'menu-btns');
    const mk = (key, fn) => { const b = el('button', 'mbtn'); b.innerHTML = iconHTML(key); const d = el('span', 'dot'); b.appendChild(d); onTap(b, fn); menu.appendChild(b); this['btn_' + key] = b; return b; };
    mk('bag', () => this.app.panels.toggle('inventory'));
    mk('char', () => this.app.panels.toggle('character'));
    mk('skill', () => this.app.panels.toggle('skills'));
    mk('quest', () => this.app.panels.toggle('quests'));
    mk('menu', () => this.app.panels.toggle('menu'));
    top.appendChild(menu);
    const center = el('div', 'hud-center');
    this.areaName = el('div', 'area-name', '');
    center.appendChild(this.areaName);
    this.tbox = el('div', 'target-box');
    this.tname = el('div', 'tn'); this.tmods = el('div', 'tm'); const tb = el('div', 'tb'); this.tbar = el('i'); tb.appendChild(this.tbar);
    this.tbox.append(this.tname, this.tmods, tb);
    center.appendChild(this.tbox);
    top.appendChild(center);
    const right = el('div');
    right.style.cssText = 'display:flex;flex-direction:row-reverse;align-items:flex-start;gap:6px';
    this.mm = el('div', 'minimap');
    const mmc = canvasFor(this.mm, 96, 96);
    this.mmc = mmc;
    onTap(this.mm, () => this.toggleMap());
    right.appendChild(this.mm);
    this.portalBtn = el('button', 'mbtn'); this.portalBtn.innerHTML = iconHTML('portal');
    onTap(this.portalBtn, () => this.townPortal());
    right.appendChild(this.portalBtn);
    top.appendChild(right);
    r.appendChild(top);
    this.buffs = el('div', 'buffs'); r.appendChild(this.buffs);
    // ── 아래쪽 ──
    const bot = el('div', 'hud-bottom');
    this.lifeOrb = this.makeOrb(bot, 'life');
    this.manaOrb = this.makeOrb(bot, 'mana');
    onTap(this.lifeOrb.node, () => this.game?.quickPotion('hp'));
    onTap(this.manaOrb.node, () => this.game?.quickPotion('mp'));
    this.xp = el('div', 'xpbar'); this.xpi = el('i'); this.xp.appendChild(this.xpi); bot.appendChild(this.xp);
    this.lvl = el('div', 'lvl-badge'); bot.appendChild(this.lvl);
    this.belt = el('div', 'belt'); bot.appendChild(this.belt);
    this.beltSlots = [];
    for (let i = 0; i < 4; i++) {
      const s = el('button', 'bslot');
      const cv = canvasFor(s, 36, 36); // 칸(42) 안쪽, 테두리를 뺀 크기
      const k = el('span', 'k', ''); s.appendChild(k);
      onTap(s, () => { this.game?.useBelt(i); this.refreshBelt(); });
      this.belt.appendChild(s);
      this.beltSlots.push({ node: s, cv, k });
    }
    r.appendChild(bot);
    // ── 기술 단추 ──
    this.pad = el('div', 'skillpad');
    this.sbtns = [];
    ['main', 's1', 's2', 's3', 's4'].forEach((cls, i) => {
      const b = el('button', 'sbtn ' + cls);
      const size = i === 0 ? 76 : 50;
      const cv = canvasFor(b, size, size);
      const cd = el('div', 'cd'); b.appendChild(cd);
      const mp = el('div', 'mp'); b.appendChild(mp);
      this.pad.appendChild(b);
      const S = { node: b, cv, cd, mp, size, idx: i, id: null };
      this.bindSkillButton(S);
      this.sbtns.push(S);
    });
    r.appendChild(this.pad);
    // 상호작용 단추(공격 단추 위): 손 닿는 곳에 무언가 있을 때만 보이고 할 일(줍기·열기·대화…)이 적힌다
    this.actBtn = el('button', 'actbtn');
    this.actTxt = el('span');
    this.actBtn.appendChild(this.actTxt);
    this.actBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.actBtn.classList.add('pressed');
      // 대화를 막 닫은 손가락이 다시 누른 것으로 치지 않게
      if (performance.now() - (this.app.dialog.closedAt || 0) > 400) this.game?.interact();
    });
    for (const t of ['pointerup', 'pointercancel']) this.actBtn.addEventListener(t, () => this.actBtn.classList.remove('pressed'));
    r.appendChild(this.actBtn);
    this.actVerb = null;
    // 이동 조이스틱: 쉬는 자리는 왼쪽 아래, 왼쪽 아래를 누르면 그 자리로 옮겨 간다(입력은 input.js)
    this.stickEl = el('div', 'stick');
    this.stickKnob = el('div', 'knob');
    this.stickEl.appendChild(this.stickKnob);
    r.appendChild(this.stickEl);
    // 조준선·지도 겹침
    this.aimCv = canvasFor(null, window.innerWidth, window.innerHeight);
    this.aimCv.c.className = 'aimline'; r.appendChild(this.aimCv.c);
    this.mapCv = canvasFor(null, window.innerWidth, window.innerHeight);
    this.mapCv.c.className = 'automap'; this.mapCv.c.style.display = 'none'; r.appendChild(this.mapCv.c);
    this.vign = el('div'); this.vign.style.cssText = 'position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px rgba(200,0,0,0.0);transition:box-shadow .25s;z-index:14';
    r.appendChild(this.vign);
    this.refreshBelt(); this.refreshSkills(); this.badges(); this.onLevel();
  }
  layout() { if (this.game) this.build(); }

  makeOrb(parent, kind) {
    const node = el('div', 'orb ' + kind);
    const cv = canvasFor(node, 88, 88);
    const v = el('div', 'ov', '');
    node.appendChild(v);
    parent.appendChild(node);
    return { node, cv, v, kind, last: -1 };
  }
  // 구슬: 칸마다 직접 칠한다(물결진 수면 한 줄은 밝게, 아래쪽은 어둡게, 가장자리 그늘, 왼쪽 위에 딱 끊긴 반사) + 도트 테두리
  drawOrb(o, frac, t) {
    const cv = o.cv, N = cv.c.width, g = cv.g;
    if (!o.img || o.img.width !== N) o.img = g.createImageData(N, N);
    const d = o.img.data;
    d.fill(0);
    const C = N / 2, r = C - 4, red = o.kind === 'life', poison = red && this.game?.player?.buffs?.poison;
    const base = red ? (poison ? [58, 154, 32] : [184, 24, 22]) : [30, 62, 206];
    const dark = red ? (poison ? [18, 60, 10] : [86, 6, 6]) : [10, 18, 92];
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const light = mix(base, [255, 255, 255], 0.35), glass = [10, 6, 6];
    const lv = C + r - frac * r * 2;
    for (let x = 0; x < N; x++) {
      const surf = lv + Math.round(Math.sin(x * 0.4 + t * 2.4) * 0.7 + Math.sin(x * 0.17 - t * 1.3) * 0.6);
      for (let y = 0; y < N; y++) {
        const dx = x + 0.5 - C, dy = y + 0.5 - C, dist = Math.hypot(dx, dy);
        if (dist > r + 0.5) continue;
        let col;
        const empty = y + 0.5 < surf;
        if (empty) col = glass;
        else col = y < surf + 1 ? light : (y - surf) / (r * 2) > 0.5 ? dark : base;
        if (dist > r - 2) col = mix(col, [0, 0, 0], 0.4);
        if ((dx + r * 0.32) ** 2 / (r * r * 0.03) + (dy + r * 0.42) ** 2 / (r * r * 0.06) < 1) col = mix(col, [255, 255, 255], empty ? 0.12 : 0.5);
        const i = (y * N + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(o.img, 0, 0);
    stamp(cv, pixRingCanvas(N, ORB_RING));
  }

  // ───────── 기술 단추 ─────────
  bindSkillButton(S) {
    const b = S.node;
    let st = null;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      b.setPointerCapture?.(e.pointerId);
      st = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), aiming: false };
      b.classList.add('pressed');
      // 주 공격 단추는 누르고 있으면 계속 공격
      if (S.idx === 0 && (!S.id || S.id === 'attack')) {
        this.useSlot(0);
        clearInterval(this.repeat);
        this.repeat = setInterval(() => {
          const g = this.game;
          if (!b.isConnected || !g || this.app.dialog.isOpen() || this.app.panels.isOpen()) { clearInterval(this.repeat); return; }
          if (!g.cmd) g.attackNearest();
        }, 120);
      }
    });
    b.addEventListener('pointermove', (e) => {
      if (!st) return;
      st.x = e.clientX; st.y = e.clientY;
      if (!st.aiming && Math.hypot(st.x - st.x0, st.y - st.y0) > 22 && S.id && S.id !== 'attack') { st.aiming = true; clearInterval(this.repeat); }
      if (st.aiming) this.aim = { x: st.x, y: st.y, id: S.id };
    });
    const end = (e, cancel) => {
      if (!st) return;
      b.classList.remove('pressed');
      clearInterval(this.repeat);
      const s = st; st = null;
      this.aim = null; this.clearAim();
      if (cancel) return;
      if (s.aiming) {
        // 단추 위로 돌아오면 취소
        const rc = b.getBoundingClientRect();
        if (s.x > rc.left && s.x < rc.right && s.y > rc.top && s.y < rc.bottom) return;
        const r = this.app.renderer, w = r.toWorld(s.x, s.y);
        const pick = this.app.input.pick(s.x, s.y);
        this.game?.useSkill(S.id, pick?.actor && pick.actor.team === 1 ? { actor: pick.actor } : { point: w });
        return;
      }
      if (S.idx !== 0 || (S.id && S.id !== 'attack')) this.useSlot(S.idx);
    };
    b.addEventListener('pointerup', (e) => end(e, false));
    b.addEventListener('pointercancel', (e) => end(e, true));
  }
  useSlot(i) {
    const g = this.game;
    if (!g) return;
    const id = g.hero.data.bar[i];
    if (!id) { if (i === 0) g.attackNearest(); else this.app.panels.open('skills'); return; }
    g.useSkill(id);
  }
  refreshSkills() {
    const g = this.game;
    if (!g || !this.sbtns) return;
    const bar = g.hero.data.bar;
    // 그림을 테두리 두께만큼 안쪽에 그리고 도트 테두리를 덧그린다
    const ins = 3 * ART;
    for (const S of this.sbtns) {
      S.id = bar[S.idx] || (S.idx === 0 ? 'attack' : null);
      const cg = S.cv.g;
      cg.clearRect(0, 0, S.size, S.size);
      const ring = () => stamp(S.cv, pixRingCanvas(S.cv.c.width, RING_BTN));
      if (!S.id) { S.node.classList.add('empty'); S.mp.textContent = ''; cg.strokeStyle = 'rgba(199,164,92,0.5)'; cg.lineWidth = 2; cg.beginPath(); cg.moveTo(S.size / 2 - 7, S.size / 2); cg.lineTo(S.size / 2 + 7, S.size / 2); cg.moveTo(S.size / 2, S.size / 2 - 7); cg.lineTo(S.size / 2, S.size / 2 + 7); cg.stroke(); ring(); continue; }
      S.node.classList.remove('empty');
      const def = S.id === 'attack' ? null : skillDef(S.id);
      paintSkillIcon(S.cv, def || { id: g.hero.ranged() ? 'attack_bow' : 'attack', icon: { c: '#d0c0a0' } }, Math.round(ins / ART));
      ring();
      const cost = S.id === 'attack' ? 0 : skillManaCost(g.hero, S.id);
      S.cost = cost;
      S.mp.textContent = cost ? Math.round(cost) : '';
    }
  }

  refreshBelt() {
    const g = this.game;
    if (!g || !this.beltSlots) return;
    const B = g.hero.data.belt, rows = g.hero.beltRows();
    for (let c = 0; c < 4; c++) {
      const S = this.beltSlots[c], cg = S.cv.g;
      cg.clearRect(0, 0, 36, 36);
      const it = B[c];
      if (it) paintItemIcon(S.cv, it, 1);
      let n = 0; for (let r = 0; r < rows; r++) if (B[r * 4 + c]) n++;
      S.k.textContent = n > 1 ? n : (it ? '' : '');
    }
  }
  badges() {
    const g = this.game;
    if (!g || !this.btn_char) return;
    const d = g.hero.data;
    const set = (b, n) => { const dot = b.querySelector('.dot'); dot.classList.toggle('on', n > 0); dot.textContent = n > 0 ? n : ''; };
    set(this.btn_char, d.statPts);
    set(this.btn_skill, d.skillPts);
  }
  onLevel() {
    const g = this.game;
    if (!g || !this.areaName) return;
    this.areaName.textContent = levelName(g.depth);
    this.portalBtn.style.display = g.depth === 0 ? 'none' : '';
  }
  townPortal() {
    const g = this.game;
    if (!g || g.depth === 0) return;
    const h = g.hero;
    const k = h.data.belt.findIndex((x) => x && x.b === 'tp_scroll');
    if (k >= 0) { g.useItem(h.data.belt[k], 'belt'); this.refreshBelt(); return; }
    const it = h.data.inv.find((x) => x.b === 'tp_scroll');
    if (it) { g.useItem(it, 'inv'); return; }
    this.app.toast('귀환 주문서가 없습니다', 'warn');
    g.sfx('ui_error');
  }
  hurt(d) {
    const P = this.game?.player;
    if (!P) return;
    const k = Math.min(1, d / Math.max(1, P.hpMax * 0.15));
    this.vign.style.boxShadow = `inset 0 0 ${60 + 60 * k}px rgba(200,0,0,${0.25 + 0.45 * k})`;
    clearTimeout(this.vT);
    this.vT = setTimeout(() => { this.vign.style.boxShadow = 'inset 0 0 90px rgba(200,0,0,0)'; }, 160);
  }
  stickShow(bx, by, dx, dy) {
    if (!this.stickEl) return;
    this.stickEl.classList.add('on');
    this.stickEl.style.left = bx + 'px'; this.stickEl.style.top = by + 'px';
    this.stickKnob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  stickHide() {
    if (!this.stickEl) return;
    this.stickEl.classList.remove('on');
    this.stickEl.style.left = ''; this.stickEl.style.top = '';
    this.stickKnob.style.transform = '';
  }

  toggleMap() {
    this.showMap = !this.showMap;
    this.mapCv.c.style.display = this.showMap ? '' : 'none';
    this.mapT = 1;
  }

  // ───────── 매 프레임 ─────────
  update(dt) {
    const g = this.game;
    if (!g || !this.lifeOrb) return;
    this.t += dt;
    const P = g.player, h = g.hero;
    this.drawOrb(this.lifeOrb, Math.max(0, P.hp / P.hpMax), this.t);
    this.drawOrb(this.manaOrb, P.mpMax ? Math.max(0, P.mp / P.mpMax) : 0, this.t + 1.3);
    const lt = `${Math.max(0, Math.ceil(P.hp))}/${P.hpMax}`, mt = `${Math.floor(P.mp)}/${P.mpMax}`;
    if (this.lifeOrb.v.textContent !== lt) this.lifeOrb.v.textContent = lt;
    if (this.manaOrb.v.textContent !== mt) this.manaOrb.v.textContent = mt;
    // 생명력이 낮으면 경고
    this.lifeOrb.node.style.filter = P.hp < P.hpMax * 0.25 ? `drop-shadow(0 0 ${6 + 4 * Math.sin(this.t * 8)}px #f00)` : '';
    this.xpi.style.width = (h.expProgress() * 100).toFixed(1) + '%';
    const lv = `레벨 ${h.data.lvl}`;
    if (this.lvl.textContent !== lv) this.lvl.textContent = lv;
    // 기술 단추: 마나·재사용 대기
    for (const S of this.sbtns) {
      if (!S.id) continue;
      const lack = S.cost && P.mp < S.cost;
      S.node.classList.toggle('nomana', !!lack);
      const def = S.id !== 'attack' && skillDef(S.id);
      const cdEnd = h.cd?.[S.id] || 0;
      if (def?.cd && cdEnd > g.time) {
        const k = (cdEnd - g.time) / def.cd;
        S.cd.style.background = `conic-gradient(rgba(0,0,0,.65) ${k * 360}deg, transparent 0)`;
      } else if (S.cd.style.background) S.cd.style.background = '';
    }
    // 상호작용 단추
    const verb = g.focus?.verb || '';
    if (verb !== this.actVerb) { this.actVerb = verb; this.actTxt.textContent = verb; this.actBtn.classList.toggle('on', !!verb); }
    // 대상 정보
    const t = g.target && !g.target.dead ? g.target : null;
    if (t && g.canSee(t)) {
      this.tbox.classList.add('on');
      this.tname.textContent = t.name || '';
      this.tname.className = 'tn ' + (t.rank === 'unique' ? 'unique' : t.rank === 'champion' ? 'champion' : '');
      const mods = [];
      if (t.umods) for (const m of t.umods) mods.push(UMOD_NAME[m] || m);
      const res = t.res ? Object.entries(t.res).filter(([k, v]) => v >= 100).map(([k]) => RES_IMM[k]) : [];
      this.tmods.textContent = [...mods, ...res].join(' · ');
      this.tbar.style.width = Math.max(0, (t.hp / t.hpMax) * 100).toFixed(1) + '%';
    } else this.tbox.classList.remove('on');
    // 버프
    this.bT = (this.bT || 0) - dt;
    if (this.bT <= 0) { this.bT = 0.25; this.drawBuffs(P); this.drawMinimap(); }
    if (this.showMap) { this.mapT -= dt; if (this.mapT <= 0) { this.mapT = 0.1; this.drawAutomap(); } }
    this.drawAim();
  }
  drawBuffs(P) {
    const html = [];
    for (const k in P.buffs) {
      const I = BUFF_INFO[k];
      if (!I) continue;
      const b = P.buffs[k];
      html.push(`<div class="buff${I.bad ? ' bad' : ''}"><i style="background-image:var(--bi-${k})"></i><b>${Math.ceil(b.t)}</b></div>`);
    }
    const s = html.join('');
    if (s !== this.lastBuffs) { this.buffs.innerHTML = s; this.lastBuffs = s; }
  }
  drawAim() {
    const g = this.aimCv.g, W = window.innerWidth, H = window.innerHeight;
    if (!this.aim) return;
    g.clearRect(0, 0, W, H);
    const P = this.game.player, r = this.app.renderer;
    const p = r.toScreen(P.x, P.y, 30);
    g.strokeStyle = 'rgba(255,220,140,0.85)'; g.lineWidth = 2; g.setLineDash([6, 6]);
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(this.aim.x, this.aim.y); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.ellipse(this.aim.x, this.aim.y, 22, 11, 0, 0, Math.PI * 2); g.stroke();
    this.aimDirty = true;
  }
  clearAim() { this.aimCv.g.clearRect(0, 0, window.innerWidth, window.innerHeight); }

  // 작은 지도(디아블로 1 자동 지도처럼 마름모 칸으로)
  drawMinimap() {
    const g = this.mmc.g, game = this.game, L = game.level, P = game.player;
    g.clearRect(0, 0, 96, 96);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, 96, 96);
    const sc = 3.2, R = 16;
    const px = Math.round(P.x), py = Math.round(P.y);
    const town = L.theme === 'town';
    for (let y = py - R; y <= py + R; y++) for (let x = px - R; x <= px + R; x++) {
      if (!L.inb(x, y)) continue;
      const k = y * L.w + x, f = L.flags[k];
      if (!town && !(f & F_SEEN)) continue;
      const sx = 48 + (x - P.x - (y - P.y)) * sc, sy = 48 + (x - P.x + (y - P.y)) * sc * 0.5;
      if (sx < -4 || sx > 100 || sy < -4 || sy > 100) continue;
      if (L.wall[k]) { g.fillStyle = 'rgba(200,170,120,0.85)'; g.fillRect(sx - 1.6, sy - 1.6, 3.2, 3.2); }
      else if (L.floor[k]) {
        if (town && f & 1) { g.fillStyle = 'rgba(120,100,80,0.5)'; g.fillRect(sx - 1.5, sy - 1, 3, 2); }
        else if (f & F_LAVA) { g.fillStyle = 'rgba(255,90,20,0.5)'; g.fillRect(sx - 1.5, sy - 1, 3, 2); }
        else if (!town) { g.fillStyle = f & F_VIS ? 'rgba(90,80,70,0.55)' : 'rgba(60,55,50,0.45)'; g.fillRect(sx - 1.5, sy - 0.8, 3, 1.6); }
      }
    }
    for (const o of L.objects) {
      const col = o.type === 'stairs_down' ? '#ff5030' : o.type === 'stairs_up' ? '#60ff60' : o.type === 'waypoint' ? '#80b0ff' : o.type === 'portal' ? '#4080ff' : null;
      if (!col) continue;
      if (!town && !(L.flags[o.y * L.w + o.x] & F_SEEN)) continue;
      const sx = 48 + (o.x - P.x - (o.y - P.y)) * sc, sy = 48 + (o.x - P.x + (o.y - P.y)) * sc * 0.5;
      g.fillStyle = col; g.beginPath(); g.arc(sx, sy, 2.6, 0, Math.PI * 2); g.fill();
    }
    for (const a of L.actors) {
      if (a === P || a.dead) continue;
      if (a.kind === 'npc') { const sx = 48 + (a.x - P.x - (a.y - P.y)) * sc, sy = 48 + (a.x - P.x + (a.y - P.y)) * sc * 0.5; g.fillStyle = '#ffe080'; g.fillRect(sx - 1.5, sy - 1.5, 3, 3); }
      else if (a.team === 1 && game.canSee(a) && !a.untargetable) { const sx = 48 + (a.x - P.x - (a.y - P.y)) * sc, sy = 48 + (a.x - P.x + (a.y - P.y)) * sc * 0.5; g.fillStyle = a.rank === 'unique' ? '#e0b040' : '#e03020'; g.fillRect(sx - 1.2, sy - 1.2, 2.4, 2.4); }
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(48, 48, 2.6, 0, Math.PI * 2); g.fill();
    // 각진 원으로 오려 내고 도트 테두리
    const n = this.mmc.c.width;
    stamp(this.mmc, pixDiscCanvas(n), 'destination-in'); stamp(this.mmc, pixRingCanvas(n, RING_BTN));
  }
  // 겹쳐 보는 큰 지도
  drawAutomap() {
    const g = this.mapCv.g, W = window.innerWidth, H = window.innerHeight;
    const game = this.game, L = game.level, P = game.player;
    g.clearRect(0, 0, W, H);
    const sc = 7, cx = W / 2, cy = H * 0.44;
    const town = L.theme === 'town';
    g.lineWidth = 2.4;
    g.strokeStyle = 'rgba(220,190,130,0.75)';
    g.beginPath();
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const k = y * L.w + x;
      if (!L.wall[k] && !(town && L.flags[k] & 1 && L.floor[k] !== 5)) continue;
      if (!town && !(L.flags[k] & F_SEEN)) continue;
      const sx = cx + (x - P.x - (y - P.y)) * sc, sy = cy + (x - P.x + (y - P.y)) * sc * 0.5;
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
      // 바닥과 맞닿은 변만 선으로
      const nb = (dx, dy) => L.isFloor(x + dx, y + dy) && !(L.wall[(y + dy) * L.w + x + dx]);
      if (nb(1, 0)) { g.moveTo(sx + sc * 0.5, sy - sc * 0.25 * 1); g.lineTo(sx + sc * 0.5, sy + sc * 0.25 * 1); }
      if (nb(0, 1)) { g.moveTo(sx - sc * 0.5, sy - sc * 0.25); g.lineTo(sx - sc * 0.5, sy + sc * 0.25); }
      if (nb(-1, 0) || nb(0, -1) || nb(1, 0) || nb(0, 1)) { g.moveTo(sx - sc * 0.5, sy); g.lineTo(sx, sy - sc * 0.25); g.lineTo(sx + sc * 0.5, sy); }
    }
    g.stroke();
    for (const o of L.objects) {
      if (!town && !(L.flags[o.y * L.w + o.x] & F_SEEN)) continue;
      const col = o.type === 'stairs_down' ? '#ff5030' : o.type === 'stairs_up' ? '#60ff60' : o.type === 'waypoint' ? '#80b0ff' : o.type === 'portal' ? '#4080ff' : o.type === 'door' ? 'rgba(200,150,90,0.9)' : null;
      if (!col) continue;
      const sx = cx + (o.x - P.x - (o.y - P.y)) * sc, sy = cy + (o.x - P.x + (o.y - P.y)) * sc * 0.5;
      g.fillStyle = col; g.beginPath(); g.arc(sx, sy, o.type === 'door' ? 2 : 4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,240,200,0.9)'; g.font = uiFont(12); g.textAlign = 'center';
    g.fillText(levelName(game.depth) + ' · 지도', W / 2, 108 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0));
  }
}

const ORB_RING = ['#000', ['#c9a35a', '#6e5428'], '#4a3820', '#000'];
const UMOD_NAME = { strong: '매우 강함', fast: '매우 빠름', cursed: '저주', magicres: '마법 저항', fire: '화염 강화', light: '번개 강화', cold: '냉기 강화', manaburn: '마나 연소', spectral: '유령 공격', stone: '돌 피부', multi: '다중 사격', teleport: '순간 이동' };
const RES_IMM = { fire: '화염 면역', cold: '냉기 면역', light: '번개 면역', poison: '독 면역' };


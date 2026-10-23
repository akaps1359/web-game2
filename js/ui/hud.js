// HUD: 생명력·마나 구슬, 물약 띠, 기술 단추(탭 = 자동 조준, 끌기 = 조준), 이동 조이스틱, 메뉴 단추, 작은 지도, 대상 정보
import { $, el, onTap, canvasFor } from './dom.js';
import { drawItemIcon } from '../render/icons.js';
import { drawSkillIcon } from '../render/skillicons.js';
import { skillDef, skillManaCost } from '../game/skills.js';
import { BUFF_INFO } from '../game/buffs.js';
import { levelName } from '../game/world.js';
import { EXP_TABLE } from '../data/classes.js';
import { F_SEEN, F_VIS, F_LAVA } from '../game/level.js';
import { TW, TH } from '../core/util.js';

const ICONS = {
  bag: '<svg viewBox="0 0 24 24"><path d="M7 8V6a5 5 0 0 1 10 0v2" fill="none" stroke="#e0c890" stroke-width="1.8"/><path d="M4 8h16l-1.5 13h-13z" fill="#5a3a1e" stroke="#e0c890" stroke-width="1.5"/><path d="M9 12h6" stroke="#e0c890" stroke-width="1.5"/></svg>',
  char: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" fill="#5a4a3a" stroke="#e0c890" stroke-width="1.5"/><path d="M4 21c0-5 4-8 8-8s8 3 8 8z" fill="#5a4a3a" stroke="#e0c890" stroke-width="1.5"/></svg>',
  skill: '<svg viewBox="0 0 24 24"><path d="M12 2l2.6 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.4-.5z" fill="#4a3a6a" stroke="#e0c890" stroke-width="1.4"/></svg>',
  quest: '<svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z" fill="#6a5034" stroke="#e0c890" stroke-width="1.4"/><path d="M9 8h7M9 12h7M9 16h5" stroke="#e0c890" stroke-width="1.3"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="#e0c890" stroke-width="2.2" stroke-linecap="round"/></svg>',
  portal: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="6" ry="9" fill="#1a3a8a" stroke="#9ec0ff" stroke-width="1.6"/><path d="M12 5c-2 3-2 11 0 14" stroke="#cfe0ff" stroke-width="1.2" fill="none"/></svg>',
};

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
    const mk = (key, svg, fn) => { const b = el('button', 'mbtn'); b.innerHTML = svg; const d = el('span', 'dot'); b.appendChild(d); onTap(b, fn); menu.appendChild(b); this['btn_' + key] = b; return b; };
    mk('bag', ICONS.bag, () => this.app.panels.toggle('inventory'));
    mk('char', ICONS.char, () => this.app.panels.toggle('character'));
    mk('skill', ICONS.skill, () => this.app.panels.toggle('skills'));
    mk('quest', ICONS.quest, () => this.app.panels.toggle('quests'));
    mk('menu', ICONS.menu, () => this.app.panels.toggle('menu'));
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
    this.portalBtn = el('button', 'mbtn'); this.portalBtn.innerHTML = ICONS.portal;
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
      const cv = canvasFor(s, 42, 42);
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
  drawOrb(o, frac, t) {
    const g = o.cv.g, S = 88, r = 38, cx = 44, cy = 44;
    g.clearRect(0, 0, S, S);
    // 돌 테두리
    const fr = g.createRadialGradient(cx, cy, r, cx, cy, r + 6);
    fr.addColorStop(0, '#2a2018'); fr.addColorStop(0.5, '#8a6a3a'); fr.addColorStop(1, '#2a1e12');
    g.fillStyle = fr; g.beginPath(); g.arc(cx, cy, r + 6, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#080404'; g.fillRect(0, 0, S, S);
    const red = o.kind === 'life';
    const lv = cy + r - frac * r * 2;
    const c1 = red ? (this.game?.player?.buffs?.poison ? '#3a9a20' : '#c01818') : '#1a3ad0', c2 = red ? (this.game?.player?.buffs?.poison ? '#103a08' : '#4a0404') : '#060c4a';
    const lg = g.createLinearGradient(0, lv, 0, cy + r);
    lg.addColorStop(0, c1); lg.addColorStop(1, c2);
    g.fillStyle = lg;
    g.beginPath(); g.moveTo(0, S);
    for (let x = 0; x <= S; x += 4) g.lineTo(x, lv + Math.sin(x * 0.12 + t * 2.4) * 2 + Math.sin(x * 0.05 - t * 1.3) * 1.5);
    g.lineTo(S, S); g.closePath(); g.fill();
    // 액체 속 소용돌이
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = red ? 'rgba(255,80,60,0.12)' : 'rgba(80,120,255,0.14)';
    for (let i = 0; i < 3; i++) { const a = t * 0.6 + i * 2.1; g.beginPath(); g.ellipse(cx + Math.cos(a) * 12, Math.max(lv + 8, cy + Math.sin(a * 0.7) * 14), 10, 5, a, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    // 유리 반사
    const hg = g.createRadialGradient(cx - 12, cy - 16, 2, cx - 12, cy - 16, 22);
    hg.addColorStop(0, 'rgba(255,255,255,0.4)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg; g.fillRect(0, 0, S, S);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
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
      if (S.idx === 0 && (!S.id || S.id === 'attack')) { this.useSlot(0); clearInterval(this.repeat); this.repeat = setInterval(() => { if (this.game && !this.game.cmd) this.useSlot(0); }, 120); }
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
    for (const S of this.sbtns) {
      S.id = bar[S.idx] || (S.idx === 0 ? 'attack' : null);
      const cg = S.cv.g;
      cg.clearRect(0, 0, S.size, S.size);
      if (!S.id) { S.node.classList.add('empty'); S.mp.textContent = ''; cg.strokeStyle = 'rgba(199,164,92,0.5)'; cg.lineWidth = 2; cg.beginPath(); cg.moveTo(S.size / 2 - 7, S.size / 2); cg.lineTo(S.size / 2 + 7, S.size / 2); cg.moveTo(S.size / 2, S.size / 2 - 7); cg.lineTo(S.size / 2, S.size / 2 + 7); cg.stroke(); continue; }
      S.node.classList.remove('empty');
      const def = S.id === 'attack' ? null : skillDef(S.id);
      if (!def) drawAttackIcon(cg, S.size, g.hero);
      else drawSkillIcon(cg, def, 0, 0, S.size);
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
      cg.clearRect(0, 0, 42, 42);
      const it = B[c];
      if (it) drawItemIcon(cg, it, 3, 3, 36, 36);
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
  tapMark(x, y, pick) {
    const m = el('div');
    const col = pick?.actor?.team === 1 ? 'rgba(255,80,60,.9)' : pick ? 'rgba(255,220,120,.9)' : 'rgba(200,220,255,.7)';
    m.style.cssText = `position:absolute;left:${x - 14}px;top:${y - 7}px;width:28px;height:14px;border-radius:50%;border:2px solid ${col};pointer-events:none;z-index:16;transition:transform .35s ease-out, opacity .35s`;
    this.root.appendChild(m);
    requestAnimationFrame(() => { m.style.transform = 'scale(1.8)'; m.style.opacity = '0'; });
    setTimeout(() => m.remove(), 400);
  }
  holdMark(x) { /* 누르고 있는 동안은 따로 표시하지 않는다 */ }
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
    // 대상 정보
    const t = g.target && !g.target.dead ? g.target : (g.hold?.actor && !g.hold.actor.dead ? g.hold.actor : null);
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
      html.push(`<div class="buff" style="border-color:${I.bad ? 'rgba(255,80,60,.7)' : 'rgba(199,164,92,.6)'}"><span>${I.icon}</span><b>${Math.ceil(b.t)}</b></div>`);
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
  }
  // 겹쳐 보는 큰 지도
  drawAutomap() {
    const g = this.mapCv.g, W = window.innerWidth, H = window.innerHeight;
    const game = this.game, L = game.level, P = game.player;
    g.clearRect(0, 0, W, H);
    const sc = 7, cx = W / 2, cy = H * 0.44;
    const town = L.theme === 'town';
    g.lineWidth = 1.6;
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
    g.fillStyle = 'rgba(255,240,200,0.9)'; g.font = '12px -apple-system, sans-serif'; g.textAlign = 'center';
    g.fillText(levelName(game.depth) + ' · 지도', W / 2, 108 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0));
  }
}

const UMOD_NAME = { strong: '매우 강함', fast: '매우 빠름', cursed: '저주', magicres: '마법 저항', fire: '화염 강화', light: '번개 강화', cold: '냉기 강화', manaburn: '마나 연소', spectral: '유령 공격', stone: '돌 피부', multi: '다중 사격', teleport: '순간 이동' };
const RES_IMM = { fire: '화염 면역', cold: '냉기 면역', light: '번개 면역', poison: '독 면역' };

function drawAttackIcon(g, size, hero) {
  const ranged = hero.ranged();
  drawSkillIcon(g, { icon: { g: ranged ? 'arrow' : 'sword', c: '#e0d0b0' } }, 0, 0, size);
}

// 패널: 가방(장비창·격자·물약 띠), 캐릭터, 기술 나무, 퀘스트, 메뉴·설정, 상점, 보관함, 순간 이동
import { $, el, btn, onTap, canvasFor } from './dom.js';
import { paintItemIcon } from '../render/icons.js';
import { paintSkillIcon } from '../render/skillicons.js';
import { drawPortrait } from '../render/figures.js';
import { BASE } from '../data/items.js';
import { itemName, itemColor, itemLines, qualityClass, meetsReq, isEquip, itemDmg, itemAC, sellPrice, repairCost, isBeltable, itemMods } from '../game/items.js';
import { INV_W, INV_H, STASH_W, STASH_H, EQUIP_SLOTS } from '../game/hero.js';
import { SKILLS, skillsOf, TABS, skillDef, skillManaCost } from '../game/skills.js';
import { QUESTS, LORE, questState, questPhase, depthName } from '../game/quests.js';
import { NPCS } from '../game/npcs.js';
import { stock, ALWAYS, buy, sell, buyPrice, repairAll, repairOne, identify, restock } from '../game/shop.js';
import { makeItem } from '../game/items.js';
import { levelName, LEVELS } from '../game/world.js';
import { EXP_TABLE } from '../data/classes.js';

const HELP = [
  ['이동·공격', `■ 움직이기
조이스틱과 단추로만 합니다(게임 화면을 눌러서는 아무 일도 없습니다). 화면 왼쪽을 누르고 끌면 그 자리에 조이스틱이 생기고, 민 방향으로 바로 걷습니다. 손을 떼면 멈춥니다. 벽에 비스듬히 밀면 벽을 따라 미끄러지고, 닫힌 문은 밀면 열립니다.

■ 공격
오른쪽 아래 큰 단추를 누르면 그 자리에서 바로 공격합니다. 적에게 다가가지 않습니다. 조이스틱을 민 쪽(밀지 않으면 바라보는 쪽)으로 휘두르거나 쏘고, 사거리 안에 적이 있으면 그쪽으로 몸을 돌립니다. 누르고 있으면 계속 공격합니다.

■ 사거리
근접 무기는 손 닿는 거리(한 칸 반 남짓) 앞쪽만 맞습니다. 활은 화살이 날아가 처음 닿는 적을 맞힙니다. 공격 사이사이 조이스틱으로 물러나며 싸울 수 있습니다(카이팅). 괴물의 공격도 내려치기 전에 비켜서면 빗나갑니다.

■ 상자·통
상자·석관은 다가가서 상호작용 단추(열기)로 엽니다. 통은 공격으로 부숩니다. 가까이 적이 없으면 손 닿는 곳의 통 쪽으로 몸을 돌려 휘두르고, 통은 화살·주문으로도 부서집니다.`],
  ['단추', `■ 상호작용
손 닿는 곳에 아이템·문·상자·계단·마을 사람 등이 있으면 공격 단추 위에 할 일이 적힌 단추(줍기·열기·대화·내려가기…)가 나타납니다. 대상에는 금빛 고리가 표시됩니다. 통은 공격 단추로 부숩니다.

■ 기술
작은 단추 네 개에 기술을 넣어 씁니다(기술 창에서 넣기). 탭하면 공격처럼 그 자리에서 바로 쓰고, 단추에서 손가락을 화면 쪽으로 끌면 원하는 곳을 겨눕니다.

■ 물약
물약 띠를 탭하면 마십니다. 빨간 구슬(생명력)·파란 구슬(마나)을 탭하면 알맞은 물약을 자동으로 마십니다.

■ 화면
두 손가락으로 오므리고 벌리면 화면을 확대·축소합니다.`],
  ['아이템', `■ 줍기
가까이 가서 상호작용 단추(줍기)로 줍습니다. 이름표 색은 등급입니다: 흰색 일반, 파란색 마법, 노란색 희귀, 금색 고유.

■ 가방
아이템을 누르면 설명이 나오고 장착·사용·버리기를 할 수 있습니다. 끌어서 옮기거나 장비 칸에 놓아 장착할 수도 있습니다.

■ 감정·내구도
마법 이상의 아이템은 감정해야 능력을 알 수 있습니다(감정 주문서 또는 현자 알데릭, 100골드). 저주받은 아이템도 있습니다. 장비는 쓰면 닳고, 내구도가 0이 되면 효과가 없으니 대장장이에게 고치세요.

■ 물약 띠
허리띠를 차면 띠의 줄이 늘어납니다.`],
  ['마을·지도', `■ 마을
마을 사람들은 모두 우물 광장 둘레에 있습니다. 대성당(지하 입구)은 광장 위, 대장간(화덕과 모루)은 왼쪽, 치유사의 집(약초밭)은 왼쪽 아래, 여관 '잿빛 술잔'은 오른쪽, 마녀의 오두막(가마솥)은 오른쪽 위, 핍의 좌판은 아래에 있습니다. 건물 뒤로 가면 건물이 반투명해집니다.

치유사 마렌과 말하면 생명력이 모두 찹니다. 대장장이는 무기·방어구를 팔고 고쳐 주고, 마녀는 마나 물약·주문서·지팡이·장신구를 팝니다. 소년 핍은 비싸지만 좋은 물건을 가끔 가져옵니다.

■ 퀘스트
머리 위 노란 ! 는 새로 부탁할 일이 있는 사람, 금빛 ? 는 끝낸 일을 보고하거나 물건을 건넬 사람입니다(작은 지도에도 표시). 화면 위 지역 이름 아래 한 줄이 지금 할 일입니다(누르면 퀘스트 창). 퀘스트 창에는 의뢰인, 목표 장소, 끝나면 보고할 사람이 나옵니다.

■ 귀환
오른쪽 위 파란 단추(차원문)로 귀환 주문서를 읽으면 마을로 돌아갑니다. 차원문을 다시 지나면 원래 자리로 돌아갑니다.

■ 순간 이동
홀수 층(3, 5, 7…)의 순간 이동 지점을 켜 두면 마을에서 바로 갈 수 있습니다.

■ 지도
오른쪽 위 작은 지도를 탭하면 큰 지도가 겹쳐 보입니다. 한 번 본 곳은 빛이 닿지 않아도 어둡게 남아 보입니다.`],
  ['성장', `■ 레벨
레벨이 오르면 능력치 점수 5와 기술 점수 1을 얻습니다. 생명력과 마나도 모두 찹니다.

■ 능력치
힘은 근접 피해와 장비 요구치, 마력은 마나와 주문, 민첩은 명중·방어도·막기와 활 피해, 활력은 생명력을 올립니다.

■ 무기와 괴물
칼은 짐승에게 강하고 해골에게 약합니다. 둔기는 그 반대입니다(디아블로 1 규칙).`],
];

const SLOT_LABEL = { head: '투구', amulet: '목걸이', body: '갑옷', weapon: '무기', shield: '방패', ring1: '반지', ring2: '반지', gloves: '장갑', belt: '허리띠', boots: '장화' };

export class Panels {
  constructor(app) {
    this.app = app;
    this.root = $('#panel');
    this.cur = null; this.opts = {};
    this.sel = null; // 선택된 아이템 { it, where }
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
  }
  get game() { return this.app.game; }
  get hero() { return this.app.game?.hero; }
  isOpen() { return !!this.cur; }
  pauses() { return this.cur && this.cur !== 'map'; }
  toggle(name) { if (this.cur === name) this.close(); else this.open(name); }
  open(name, opts = {}) {
    if (!this.game) return;
    this.game.stopAll?.();
    this.cur = name; this.opts = opts; this.sel = null;
    this.tab = opts.tab ?? this.tab ?? 0;
    this.page = 0;
    this.root.classList.add('on');
    this.enter = true;
    this.render();
    this.game.sfx('ui_open');
  }
  close() {
    if (!this.cur) return;
    this.cur = null; this.sel = null; this.opts = {};
    this.root.classList.remove('on');
    this.root.innerHTML = '';
    this.game?.sfx('ui_close');
    this.app.hud.refreshBelt(); this.app.hud.refreshSkills(); this.app.hud.badges();
    this.app.saveNow();
  }
  refresh() { if (this.cur) this.render(); }

  // 창 틀: 새로 열 때만 새로 만들어 올라오는 움직임을 보이고, 단추를 눌러 다시 그릴 때는 같은 틀에 내용만 바꾼다(깜빡이지 않게)
  frame(title, sub) {
    let p = this.root.firstElementChild;
    if (this.enter || !p?.classList.contains('pnl')) { this.root.innerHTML = ''; p = el('div', 'pnl enter'); this.root.appendChild(p); }
    else { while (this.root.lastChild !== p) this.root.lastChild.remove(); p.textContent = ''; p.className = 'pnl'; }
    this.enter = false;
    const head = el('div', 'pnl-head');
    head.appendChild(el('div', 'pnl-title', title));
    if (sub) { const s = el('div', 'gold-line'); s.innerHTML = sub; head.appendChild(s); }
    head.appendChild(btn('pnl-x', '✕', () => this.close()));
    p.appendChild(head);
    return p;
  }
  goldHTML() { return `<span class="coin"></span>${this.hero.data.gold.toLocaleString('ko-KR')}`; }
  // 패널 몸통의 안쪽 크기(여백 뺀 너비·높이)
  space(body) {
    const cs = window.getComputedStyle(body);
    return { w: body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h: body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) };
  }
  // 두 단(왼쪽·오른쪽)
  cols(body, cls = '') {
    const c = el('div', 'cols ' + cls), L = el('div', 'col'), R = el('div', 'col');
    c.append(L, R); body.appendChild(c);
    return [L, R];
  }

  // 다시 그려도 두루마리 위치는 그대로
  render() {
    const fn = this['r_' + this.cur];
    if (!fn) return;
    const SCR = '.pnl-body, .col, .sinfo';
    const keep = this.enter ? [] : [...this.root.querySelectorAll(SCR)].map((e) => e.scrollTop);
    if (!this.sel) this.tipIt = null;
    fn.call(this);
    if (keep.some((v) => v)) this.root.querySelectorAll(SCR).forEach((e, i) => { if (keep[i]) e.scrollTop = keep[i]; });
  }

  // ═════════ 가방 ═════════
  r_inventory() {
    const h = this.hero;
    const idm = this.opts.identifyWith;
    const p = this.frame(idm ? '감정할 아이템을 고르세요' : this.opts.sage ? '현자 알데릭 · 감정' : '가방', this.goldHTML());
    const body = el('div', 'pnl-body'); p.appendChild(body);
    const sp = this.space(body), rows = h.beltRows(), extra = this.opts.sage ? 40 : 0;
    // 장비창(10×6.6칸)과 가방(10×4칸)·물약 띠를 한 화면에: 칸 크기를 남은 너비·높이에 맞춘다
    const C = Math.max(20, Math.floor(Math.min(40, (sp.w - 16) / 20, sp.h / 6.6, (sp.h - 14 - extra) / (INV_H + rows))));
    const [L, R] = this.cols(body, 'tight');
    L.appendChild(this.doll(C));
    R.appendChild(this.grid(h.data.inv, INV_W, INV_H, C, 'inv'));
    R.appendChild(this.beltView(C));
    if (this.opts.sage) {
      const n = h.data.inv.filter((i) => !i.id).length + Object.values(h.data.equip).filter((i) => !i.id).length;
      const row = el('div', 'tbtns');
      row.appendChild(btn('btn' + (n ? '' : ' dim'), `모두 감정 (${n * 100}골드)`, () => { for (const it of [...h.data.inv, ...Object.values(h.data.equip)]) if (!it.id) { if (!identify(this.game, it)) break; } h.recalc(); this.render(); }));
      R.appendChild(row);
    }
  }

  doll(C) {
    const h = this.hero, d = h.data;
    const wrap = el('div', 'doll');
    wrap.style.width = 10 * C + 'px'; wrap.style.height = 6.6 * C + 'px';
    // 가운데 인물 그림(칸 크기에 맞춘 판에 그려 도트 크기는 그대로)
    const fw = Math.round(3 * C), fh = Math.round(5.2 * C);
    const fig = canvasFor(null, fw, fh);
    fig.c.className = 'doll-fig';
    fig.c.style.top = Math.round(0.2 * C) + 'px';
    drawPortrait(fig.g, this.game.player.look, fw / 2, fh - 0.25 * C, 1.75 * C / 40, 0.3);
    wrap.appendChild(fig.c);
    const L = { head: [4, 0, 2, 2], amulet: [6.3, 0.5, 1, 1], weapon: [0.15, 0.3, 2, 4], shield: [7.85, 0.3, 2, 4], body: [4, 2.2, 2, 3], ring1: [2.65, 4.45, 1, 1], ring2: [6.35, 4.45, 1, 1], gloves: [0.15, 4.55, 2, 2], belt: [4, 5.45, 2, 1], boots: [7.85, 4.55, 2, 2] };
    for (const s of EQUIP_SLOTS) {
      const [x, y, w, hh] = L[s];
      const b = el('div', 'eslot');
      b.style.cssText = `left:${x * C}px;top:${y * C}px;width:${w * C}px;height:${hh * C}px`;
      b.dataset.slot = s;
      const it = d.equip[s];
      // 칸 테두리(양쪽 3px)만큼 그림을 작게
      const bw = 6;
      if (it) {
        const cv = canvasFor(b, w * C - bw, hh * C - bw);
        paintItemIcon(cv, it, 1);
        b.classList.add(qualityClass(it));
        if (!meetsReq(it, h.st) || (it.durMax && it.dur <= 0 && !it.indestr)) b.classList.add('bad');
        if (this.sel?.it === it) b.classList.add('sel');
        this.dragSource(b, it, 'equip', s);
      } else b.appendChild(el('span', 'lbl', SLOT_LABEL[s]));
      // 두 손 무기면 방패 칸을 흐리게
      if (s === 'shield' && !it && d.equip.weapon && BASE[d.equip.weapon.b].hands === 2 && !itemMods(d.equip.weapon).oneHand) { const cv = canvasFor(b, w * C - bw, hh * C - bw); cv.g.globalAlpha = 0.25; paintItemIcon(cv, d.equip.weapon, 1); }
      onTap(b, () => { if (it) this.select(it, 'equip', s); });
      wrap.appendChild(b);
    }
    return wrap;
  }

  // 격자 그리기. where: 'inv' | 'stash' | 'shop'
  grid(list, W, H, C, where, extra = {}) {
    const g = el('div', 'grid');
    g.style.width = W * C + 2 + 'px'; g.style.height = H * C + 2 + 'px';
    g.dataset.where = where;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = el('div', 'cellbg');
      c.style.cssText = `left:${x * C + 1}px;top:${y * C + 1}px;width:${C}px;height:${C}px`;
      g.appendChild(c);
    }
    for (const it of list) {
      const b = BASE[it.b];
      const n = el('div', 'gi ' + qualityClass(it));
      n.style.cssText = `left:${it.x * C + 1}px;top:${it.y * C + 1}px;width:${b.w * C}px;height:${b.h * C}px`;
      const cv = canvasFor(n, b.w * C, b.h * C);
      paintItemIcon(cv, it, 1);
      if (!it.id && (it.q === 'magic' || it.q === 'rare' || it.q === 'unique')) n.classList.add('unid');
      if (isEquip(it) && !meetsReq(it, this.hero.st)) n.classList.add('bad');
      if (this.sel?.it === it) n.classList.add('sel');
      if (extra.price) { const q = el('span', 'qty', extra.price(it)); q.style.color = '#ffe080'; n.appendChild(q); }
      onTap(n, () => this.select(it, where));
      if (where !== 'shop') this.dragSource(n, it, where);
      g.appendChild(n);
    }
    this.C = C;
    return g;
  }

  beltView(C) {
    const h = this.hero, rows = h.beltRows();
    const wrap = el('div', 'beltv');
    wrap.appendChild(el('div', 'shop-hint', rows > 1 ? `물약 띠\n${rows}줄` : '물약 띠\n(허리띠를 차면\n늘어납니다)'));
    const g = el('div', 'grid');
    g.style.width = 4 * C + 2 + 'px'; g.style.height = rows * C + 2 + 'px';
    for (let r = rows - 1; r >= 0; r--) for (let c = 0; c < 4; c++) {
      const yy = rows - 1 - r;
      const cell = el('div', 'cellbg'); cell.style.cssText = `left:${c * C + 1}px;top:${yy * C + 1}px;width:${C}px;height:${C}px`; g.appendChild(cell);
      const it = h.data.belt[r * 4 + c];
      if (!it) continue;
      const n = el('div', 'gi'); n.style.cssText = `left:${c * C + 1}px;top:${yy * C + 1}px;width:${C}px;height:${C}px`;
      const cv = canvasFor(n, C, C); paintItemIcon(cv, it, 1);
      if (this.sel?.it === it) n.classList.add('sel');
      onTap(n, () => this.select(it, 'belt'));
      g.appendChild(n);
    }
    wrap.appendChild(g);
    return wrap;
  }

  // ───────── 끌어 놓기 ─────────
  dragSource(node, it, where, slot) {
    let st = null;
    node.addEventListener('pointerdown', (e) => {
      st = { x0: e.clientX, y0: e.clientY, drag: false, id: e.pointerId };
      node.setPointerCapture?.(e.pointerId);
    });
    node.addEventListener('pointermove', (e) => {
      if (!st) return;
      if (!st.drag && Math.hypot(e.clientX - st.x0, e.clientY - st.y0) > 10) {
        st.drag = true;
        const b = BASE[it.b], C = this.C || 38;
        const gh = el('div', 'drag-ghost');
        const cv = canvasFor(gh, b.w * C, b.h * C);
        paintItemIcon(cv, it, 0);
        $('#app').appendChild(gh);
        st.ghost = gh; st.w = b.w * C; st.h = b.h * C;
        this.game.sfx('item_pickup', null, null, { vol: 0.5 });
      }
      if (st.drag) {
        st.ghost.style.left = e.clientX - st.w / 2 + 'px'; st.ghost.style.top = e.clientY - st.h / 2 + 'px';
        this.showDrop(e.clientX, e.clientY, it, st);
      }
    });
    const end = (e) => {
      if (!st) return;
      const s = st; st = null;
      if (s.ghost) s.ghost.remove();
      this.clearDrop();
      if (!s.drag) return;
      // 탭으로 처리되지 않게 잠깐 막는다
      this.dropAt(e.clientX, e.clientY, it, where, slot);
    };
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', () => { if (st?.ghost) st.ghost.remove(); st = null; this.clearDrop(); });
  }
  // 손가락 아래의 목적지
  dropTarget(x, y, it) {
    const els = document.elementsFromPoint(x, y);
    for (const e of els) {
      if (e.classList?.contains('eslot')) return { kind: 'equip', slot: e.dataset.slot, node: e };
      if (e.classList?.contains('grid') && e.dataset.where) {
        const r = e.getBoundingClientRect(), C = this.C || 38, b = BASE[it.b];
        const gx = Math.round((x - r.left - 1) / C - b.w / 2), gy = Math.round((y - r.top - 1) / C - b.h / 2);
        return { kind: 'grid', where: e.dataset.where, x: gx, y: gy, node: e, rect: r };
      }
    }
    return null;
  }
  showDrop(x, y, it, st) {
    this.clearDrop();
    const t = this.dropTarget(x, y, it);
    if (!t || t.kind !== 'grid') return;
    const C = this.C || 38, b = BASE[it.b];
    const list = t.where === 'stash' ? this.app.stash.items : this.hero.data.inv;
    const W = t.where === 'stash' ? STASH_W : INV_W, H = t.where === 'stash' ? STASH_H : INV_H;
    const ok = this.hero.invFits(it, t.x, t.y, null, W, H, list) || this.swapCandidate(it, t.x, t.y, list, W, H);
    const m = el('div', ok ? 'drop-ok' : 'drop-bad');
    m.style.cssText = `left:${t.x * C + 1}px;top:${t.y * C + 1}px;width:${b.w * C}px;height:${b.h * C}px`;
    t.node.appendChild(m);
    this.dropMark = m;
  }
  clearDrop() { this.dropMark?.remove(); this.dropMark = null; }
  // 놓을 자리에 아이템이 하나만 있으면 맞바꿀 수 있다(디아블로 1)
  swapCandidate(it, x, y, list, W, H) {
    const b = BASE[it.b];
    if (x < 0 || y < 0 || x + b.w > W || y + b.h > H) return null;
    const hits = list.filter((o) => o !== it && x < o.x + BASE[o.b].w && o.x < x + b.w && y < o.y + BASE[o.b].h && o.y < y + b.h);
    return hits.length === 1 ? hits[0] : null;
  }
  dropAt(x, y, it, from, fromSlot) {
    const h = this.hero, g = this.game;
    const t = this.dropTarget(x, y, it);
    if (!t) { this.render(); return; }
    if (t.kind === 'equip') {
      if (from === 'equip') { this.render(); return; }
      const slot = t.slot;
      const b = BASE[it.b];
      const okSlot = b.slot === 'ring' ? slot.startsWith('ring') : b.slot === slot;
      if (!okSlot) { g.toast('그 자리에 낄 수 없습니다', 'warn'); g.sfx('ui_error'); this.render(); return; }
      this.equipFrom(it, from, slot);
      return;
    }
    // 격자로
    const toStash = t.where === 'stash';
    const list = toStash ? this.app.stash.items : h.data.inv;
    const W = toStash ? STASH_W : INV_W, H = toStash ? STASH_H : INV_H;
    const srcList = from === 'stash' ? this.app.stash.items : from === 'inv' ? h.data.inv : null;
    if (h.invFits(it, t.x, t.y, null, W, H, list === srcList ? list : list)) {
      this.detach(it, from, fromSlot);
      it.x = t.x; it.y = t.y; if (!list.includes(it)) list.push(it);
      g.sfx(BASE[it.b].slot === 'weapon' ? 'drop_weapon' : 'item_pickup', null, null, { vol: 0.6 });
    } else {
      const other = this.swapCandidate(it, t.x, t.y, list, W, H);
      if (other && from !== 'equip') {
        // 맞바꾸기: 다른 것을 원래 자리(또는 빈자리)로
        const ox = it.x, oy = it.y;
        this.detach(it, from, fromSlot);
        const oi = list.indexOf(other); list.splice(oi, 1);
        it.x = t.x; it.y = t.y; list.push(it);
        const back = srcList || h.data.inv;
        const BW = back === this.app.stash.items ? STASH_W : INV_W, BH = back === this.app.stash.items ? STASH_H : INV_H;
        if (h.invFits(other, ox, oy, null, BW, BH, back)) { other.x = ox; other.y = oy; back.push(other); }
        else if (!h.invAdd(other, back, BW, BH)) { list.splice(list.indexOf(it), 1); this.reattach(it, from, fromSlot); other.x = t.x; other.y = t.y; list.push(other); g.toast('자리가 없습니다', 'warn'); }
      } else if (other && from === 'equip') {
        // 장착품을 가방의 같은 종류와 바꾸기
        if (this.hero.slotFor(other) && (BASE[other.b].slot === BASE[it.b].slot)) this.equipFrom(other, 'inv', fromSlot);
        else g.toast('자리가 없습니다', 'warn');
      } else g.sfx('ui_error');
    }
    h.recalc();
    this.app.hud.refreshBelt();
    this.render();
  }
  detach(it, from, slot) {
    const h = this.hero;
    if (from === 'inv') h.invRemove(it);
    else if (from === 'stash') { const i = this.app.stash.items.indexOf(it); if (i >= 0) this.app.stash.items.splice(i, 1); }
    else if (from === 'equip') { delete h.data.equip[slot]; h.recalc(); }
    else if (from === 'belt') { const k = h.data.belt.indexOf(it); if (k >= 0) h.data.belt[k] = null; }
  }
  reattach(it, from, slot) {
    const h = this.hero;
    if (from === 'inv') h.data.inv.push(it);
    else if (from === 'stash') this.app.stash.items.push(it);
    else if (from === 'equip') h.data.equip[slot] = it;
  }
  equipFrom(it, from, slot) {
    const h = this.hero, g = this.game;
    if (from === 'stash') {
      // 보관함에서 바로 장착: 일단 가방으로
      if (!h.invAdd(it)) { g.toast('가방에 빈자리가 없습니다', 'warn'); return; }
      this.app.stash.items.splice(this.app.stash.items.indexOf(it), 1);
    }
    if (from === 'belt') return;
    const r = h.equip(it, slot);
    if (!r.ok) { g.toast(r.why, 'warn'); g.sfx('ui_error'); }
    else {
      g.sfx('equip');
      if (r.warn) g.toast(r.warn + ' — 능력치를 채울 때까지 효과가 없습니다', 'warn');
      // 허리띠가 바뀌면 넘친 물약은 가방으로
      for (const s of h.beltOverflow()) if (!h.invAdd(s)) g.dropItem(s);
    }
    this.sel = null;
    this.app.hud.refreshBelt(); this.app.hud.refreshSkills();
    this.render();
  }

  // ───────── 선택·설명창 ─────────
  select(it, where, slot) {
    if (this.sel?.it === it) { this.sel = null; this.render(); return; }
    this.sel = { it, where, slot };
    this.render();
    this.tooltip(it, where, slot);
  }
  tooltip(it, where, slot) {
    const h = this.hero, g = this.game;
    // 같은 아이템의 설명창을 다시 띄울 때(수리·감정 뒤 등)는 움직임 없이
    const tip = el('div', 'tip' + (where === 'inv' || where === 'belt' ? ' left' : '') + (this.tipIt === it ? '' : ' enter'));
    this.tipIt = it;
    const nm = el('div', 'tname ' + 'q-' + qualityClass(it), itemName(it));
    tip.appendChild(nm);
    if ((it.q === 'magic' || it.q === 'rare' || it.q === 'unique') && it.id) tip.appendChild(el('div', 'tbase', BASE[it.b].name));
    for (const L of itemLines(it, h.st)) tip.appendChild(el('div', 'tl ' + (L.c || ''), L.t));
    // 비교
    if (isEquip(it) && where !== 'equip') {
      const s = h.slotFor(it), cur = h.data.equip[s === 'ring2' ? 'ring1' : s];
      const cmp = el('div', 'tcmp');
      const b = BASE[it.b];
      if (cur && it.id !== false) {
        if (b.slot === 'weapon' && BASE[cur.b].slot === 'weapon') { const a = itemDmg(it), c = itemDmg(cur); const da = (a[0] + a[1]) / 2 - (c[0] + c[1]) / 2; cmp.innerHTML = `지금 무기와 비교: 평균 피해 <span class="${da >= 0 ? 'up' : 'dn'}">${da >= 0 ? '+' : ''}${da.toFixed(1)}</span>`; }
        else if (it.ac != null && cur.ac != null) { const da = itemAC(it) - itemAC(cur); cmp.innerHTML = `지금 장비와 비교: 방어도 <span class="${da >= 0 ? 'up' : 'dn'}">${da >= 0 ? '+' : ''}${da}</span>`; }
      }
      if (cmp.innerHTML) tip.appendChild(cmp);
    }
    // 가격
    const shop = this.cur === 'shop' ? this.opts.shop : null;
    if (where === 'shop') tip.appendChild(el('div', 'tl price', `가격: ${buyPrice(it, shop).toLocaleString('ko-KR')} 골드`));
    else if (shop && where === 'inv' && shop !== 'healer' && shop !== 'boy') tip.appendChild(el('div', 'tl price', `팔면: ${sellPrice(it).toLocaleString('ko-KR')} 골드`));
    const rc = repairCost(it);
    if (this.cur === 'shop' && shop === 'smith' && rc) tip.appendChild(el('div', 'tl price', `수리비: ${rc} 골드`));
    const row = el('div', 'tbtns');
    const B = (t, fn, cls = '') => row.appendChild(btn('btn ' + cls, t, () => { fn(); }));
    const b = BASE[it.b];
    const idScroll = this.opts.identifyWith;
    if (where === 'shop') {
      B('사기', () => { if (this.opts.always?.includes(it)) buy(g, shop, it, true); else buy(g, shop, it); this.sel = null; this.render(); });
    } else if (idScroll && where !== 'shop') {
      if (!it.id) B('감정하기', () => { g.identifyWith(idScroll, it, h.data.belt.includes(idScroll) ? 'belt' : 'inv'); this.opts.identifyWith = null; this.sel = null; this.render(); this.tooltip(it, where, slot); });
    } else {
      if (this.opts.sage && !it.id) B('감정 (100골드)', () => { if (identify(g, it)) { this.render(); this.tooltip(it, where, slot); } });
      if (where === 'equip') {
        B('해제', () => { if (!h.unequip(slot)) g.toast('가방에 빈자리가 없습니다', 'warn'); else g.sfx('equip'); for (const s of h.beltOverflow()) if (!h.invAdd(s)) g.dropItem(s); this.sel = null; this.app.hud.refreshBelt(); this.render(); });
        if (shop === 'smith' && rc) B(`수리 ${rc}`, () => { repairOne(g, it); this.render(); this.tooltip(it, where, slot); });
      } else if (where === 'inv' || where === 'stash') {
        if (isEquip(it)) B('장착', () => this.equipFrom(it, where));
        if (b.use && where === 'inv') B(b.use === 'identify' ? '감정에 쓰기' : '사용', () => { const ok = g.useItem(it, 'inv'); this.sel = null; if (b.use === 'portal' && ok) this.close(); else this.render(); });
        if (isBeltable(it) && where === 'inv') B('띠에 넣기', () => { if (h.beltAdd(it)) { h.invRemove(it); this.app.hud.refreshBelt(); } else g.toast('띠에 빈칸이 없습니다'); this.sel = null; this.render(); });
        if (this.cur === 'stash') B(where === 'stash' ? '가방으로' : '보관함으로', () => this.moveStash(it, where));
        if (shop && where === 'inv' && shop !== 'healer' && shop !== 'boy') B(`팔기 ${sellPrice(it)}`, () => { const p = sell(g, it, shop); if (p) { this.sel = null; this.render(); } }, 'red');
        if (shop === 'smith' && where === 'inv' && rc) B(`수리 ${rc}`, () => { repairOne(g, it); this.render(); this.tooltip(it, where, slot); });
        if (!shop && where === 'inv' && !b.quest) B('버리기', () => { h.invRemove(it); g.dropItem(it); this.sel = null; this.render(); }, 'red');
      } else if (where === 'belt') {
        B('사용', () => { g.useItem(it, 'belt'); this.sel = null; this.app.hud.refreshBelt(); this.render(); });
        B('가방으로', () => { if (h.invAdd(it)) { const k = h.data.belt.indexOf(it); h.data.belt[k] = null; this.app.hud.refreshBelt(); } this.sel = null; this.render(); });
      }
    }
    B('닫기', () => { this.sel = null; this.render(); }, 'dim');
    tip.appendChild(row);
    this.root.appendChild(tip);
  }
  moveStash(it, where) {
    const h = this.hero, S = this.app.stash;
    if (where === 'stash') {
      if (!h.invAdd(it)) { this.game.toast('가방에 빈자리가 없습니다', 'warn'); return; }
      S.items.splice(S.items.indexOf(it), 1);
    } else {
      if (!h.invAdd(it, S.items, STASH_W, STASH_H)) { this.game.toast('보관함이 가득 찼습니다', 'warn'); return; }
      h.invRemove(it);
    }
    this.game.sfx('item_pickup', null, null, { vol: 0.5 });
    this.sel = null; this.render();
  }

  // ═════════ 캐릭터 ═════════
  // 세 단(능력치 / 전투·생존 / 기록·기타)으로 한 화면에
  r_character() {
    const h = this.hero, d = h.data, st = h.st, P = this.game.player;
    const p = this.frame(`${d.name}`, `${h.C.name} · 레벨 ${d.lvl}${d.hc ? ' · <span style="color:#ff6a5a">하드코어</span>' : ''}`);
    const body = el('div', 'pnl-body'); p.appendChild(body);
    const cols = el('div', 'ccols'), C1 = el('div'), C2 = el('div'), C3 = el('div');
    cols.append(C1, C2, C3); body.appendChild(cols);
    const box = (title, rows) => { const b = el('div', 'cbox'); if (title) b.appendChild(el('h4', '', title)); for (const [a, v, c] of rows) { const r = el('div', 'crow'); r.innerHTML = `<span>${a}</span><span class="v ${c || ''}">${v}</span>`; b.appendChild(r); } return b; };
    const attrs = el('div', 'cbox');
    attrs.appendChild(el('h4', '', d.statPts ? `능력치 · 남은 점수 ${d.statPts}` : '능력치'));
    const A = [['str', '힘', '근접 피해·장비 요구치'], ['mag', '마력', '마나·주문 위력'], ['dex', '민첩', '명중·방어도·막기·활'], ['vit', '활력', '생명력']];
    for (const [k, n, tip] of A) {
      const row = el('div', 'attr');
      const nm = el('div', 'an'); nm.innerHTML = `${n}<span class="ad">${tip}</span>`;
      const base = st['base' + k[0].toUpperCase() + k.slice(1)], tot = st[k];
      const v = el('div', 'av'); v.innerHTML = (tot !== base ? `<span style="color:${tot > base ? '#8aa0ff' : '#ff6a5a'}">${tot}</span>` : `${tot}`) + `<span class="ad">최대 ${h.C.max[k]}</span>`;
      const plus = btn('plus', '+', () => { if (h.addStat(k)) { this.game.sfx('stat_up'); this.render(); this.app.hud.badges(); } });
      plus.disabled = !d.statPts || d.base[k] >= h.C.max[k];
      row.append(nm, v, plus);
      attrs.appendChild(row);
    }
    C1.appendChild(attrs);
    C2.appendChild(box('전투', [
      ['피해', `${st.dmgMin}-${st.dmgMax}`], ['명중률', `${st.tohitSheet}%`], ['방어도', st.ac], ['막기', st.hasShield ? `${Math.min(75, st.block)}%` : '-'],
      ['공격 속도', `${(1 / st.atkTime).toFixed(2)}회/초`], ['시전 속도', `${(1 / st.castTime).toFixed(2)}회/초`],
    ]));
    const sv = box('생존', [['생명력', `${Math.ceil(P.hp)}/${P.hpMax}`], ['마나', `${Math.floor(P.mp)}/${P.mpMax}`]]);
    const res = el('div', 'cres');
    for (const [k, n] of [['fire', '화염'], ['cold', '냉기'], ['light', '번개'], ['poison', '독']]) { const r = el('div', 'crow'); r.innerHTML = `<span>${n} 저항</span><span class="v ${st.res[k] < 0 ? 'dn' : ''}">${st.res[k]}%</span>`; res.appendChild(r); }
    sv.appendChild(res);
    C2.appendChild(sv);
    const next = d.lvl >= 50 ? '최대' : EXP_TABLE[d.lvl].toLocaleString('ko-KR');
    C3.appendChild(box('', [
      ['경험치', d.exp.toLocaleString('ko-KR')], ['다음 레벨', next], ['골드', d.gold.toLocaleString('ko-KR')],
      ['처치한 괴물', (d.kills || 0).toLocaleString('ko-KR')], ['죽은 횟수', d.deaths || 0],
      ['플레이 시간', `${Math.floor((d.played || 0) / 3600)}시간 ${Math.floor(((d.played || 0) % 3600) / 60)}분`],
    ]));
    const extra = [];
    if (d.cls === 'warrior') extra.push(['치명타(전사)', d.lvl + '%']);
    if (st.crit) extra.push(['치명타', st.crit + '%']);
    if (st.lifeSteal) extra.push(['생명력 흡수', st.lifeSteal + '%']);
    if (st.manaSteal) extra.push(['마나 흡수', st.manaSteal + '%']);
    if (st.dmgTaken) extra.push(['받는 피해', st.dmgTaken]);
    if (st.mf) extra.push(['마법 아이템 발견', st.mf + '%']);
    if (st.gf) extra.push(['골드 발견', st.gf + '%']);
    if (st.frw) extra.push(['이동 속도', '+' + st.frw + '%']);
    if (extra.length) C3.appendChild(box('기타', extra));
  }

  // ═════════ 기술 ═════════
  r_skills() {
    const h = this.hero, d = h.data;
    const p = this.frame('기술', `남은 기술 점수 <b style="color:#fff;margin-left:4px">${d.skillPts}</b>`);
    const tabs = el('div', 'pnl-tabs');
    TABS[d.cls].forEach((t, i) => { const b = btn('pnl-tab' + (this.tab === i ? ' on' : ''), t, () => { this.tab = i; this.selSkill = null; this.render(); }); tabs.appendChild(b); });
    p.appendChild(tabs);
    const body = el('div', 'pnl-body'); p.appendChild(body);
    const list = skillsOf(d.cls).filter((s) => s.tab === this.tab);
    const sp = this.space(body);
    // 나무(6단×3줄)와 설명을 나란히 한 화면에: 기술 칸 크기를 남은 자리에 맞춘다
    const N = Math.max(34, Math.min(56, Math.floor((sp.h - 16) / 3) - 12, Math.floor((sp.w - 300) / 6) - 16));
    const rowH = N + 12, colW = N + 16, W = colW * 6, TH = rowH * 3 + 16;
    const [TL, TR] = this.cols(body, 'fill');
    TR.style.flex = '1 1 280px';
    const tree = el('div', 'stree'); tree.style.width = W + 'px'; tree.style.height = TH + 'px';
    // 열 = 단계(필요 레벨), 행 = 갈래 안의 자리
    const pos = (s) => ({ x: s.pos[1] * colW + (colW - N) / 2, y: 16 + s.pos[0] * rowH + (rowH - N) / 2 });
    // 선행 기술 선
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', TH); svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
    for (const s of list) for (const pr of s.pre || []) {
      const a = SKILLS[pr]; if (!a || a.tab !== s.tab) continue;
      const p1 = pos(a), p2 = pos(s);
      const ln = document.createElementNS(svgNS, 'line');
      ln.setAttribute('x1', p1.x + N); ln.setAttribute('y1', p1.y + N / 2); ln.setAttribute('x2', p2.x); ln.setAttribute('y2', p2.y + N / 2);
      ln.setAttribute('stroke', d.skills[pr] ? 'rgba(240,216,152,0.8)' : 'rgba(199,164,92,0.3)'); ln.setAttribute('stroke-width', '2');
      svg.appendChild(ln);
    }
    tree.appendChild(svg);
    for (let c = 0; c < 6; c++) { const lb = el('div'); lb.style.cssText = `position:absolute;left:${c * colW}px;width:${colW}px;top:0;text-align:center;color:var(--dim)`; lb.textContent = `Lv${[1, 6, 12, 18, 24, 30][c]}`; tree.appendChild(lb); }
    for (const s of list) {
      const q = pos(s);
      const n = el('button', 'snode');
      n.style.left = q.x + 'px'; n.style.top = q.y + 'px'; n.style.width = n.style.height = N + 'px';
      const cv = canvasFor(n, N - 4, N - 4); paintSkillIcon(cv, s);
      const lv = h.skillPoints(s.id), bonus = lv ? h.skillLevel(s.id) - lv : 0;
      const sl = el('span', 'sl', lv ? (bonus ? `${lv}+${bonus}` : `${lv}`) : '');
      if (lv) n.appendChild(sl);
      const can = h.canLearn(s.id).ok;
      if (!lv && !can) n.classList.add('locked');
      if (can) n.classList.add('can');
      if (this.selSkill === s.id) n.classList.add('sel');
      onTap(n, () => { this.selSkill = s.id; this.render(); });
      tree.appendChild(n);
    }
    TL.appendChild(tree);
    const s = this.selSkill ? SKILLS[this.selSkill] : null;
    const info = el('div', 'sinfo');
    if (!s) { info.innerHTML = '<div class="sd">기술을 눌러 설명을 보세요. 배운 능동 기술은 오른쪽 아래 단추에 넣어 쓸 수 있습니다.<br>단추를 누르면 그 자리에서 바로 쓰고(사거리 안의 적이 있으면 그쪽으로), 단추에서 손가락을 끌면 원하는 곳을 겨눕니다.</div>'; TR.appendChild(info); return; }
    const pts = h.skillPoints(s.id), lv = h.skillLevel(s.id);
    // 이름 줄 오른쪽에 배우기 단추
    const top = el('div', 'assign top');
    top.appendChild(el('h4', '', `${s.name} ${pts ? `(레벨 ${lv})` : ''}`));
    const c = h.canLearn(s.id);
    top.appendChild(btn('btn small' + (c.ok ? '' : ' dim'), c.ok ? '배우기 +1' : c.why, () => { const r = h.learn(s.id); if (r.ok) { this.game.sfx('stat_up'); this.app.hud.refreshSkills(); this.app.hud.badges(); } else this.game.toast(r.why); this.render(); }));
    info.appendChild(top);
    info.appendChild(el('div', 'sd', `${s.passive ? '패시브' : '능동'} · 필요 레벨 ${s.req}${s.pre?.length ? ' · 선행: ' + s.pre.map((x) => SKILLS[x].name).join(', ') : ''} — ${s.about || ''}`));
    const cur = el('div', 'sn');
    if (pts) { cur.innerHTML = '<b>현재:</b> ' + s.desc(lv, h).join(' · ') + (s.passive ? '' : ` · 마나 ${Math.round(skillManaCost(h, s.id) * 10) / 10}`); info.appendChild(cur); }
    const nx = el('div', 'sx');
    nx.innerHTML = '<b>다음 레벨:</b> ' + s.desc(Math.max(1, lv + 1), h).join(' · ') + (s.passive ? '' : ` · 마나 ${Math.round(s.mana(lv + 1) * 10) / 10}`);
    info.appendChild(nx);
    if (pts && !s.passive) {
      const row2 = el('div', 'assign');
      row2.appendChild(el('span', 'sd', '단추:'));
      ['주', '1', '2', '3', '4'].forEach((label, i) => {
        const on = d.bar[i] === s.id;
        row2.appendChild(btn('btn small' + (on ? '' : ' dim'), label, () => { const j = d.bar.indexOf(s.id); if (j >= 0) d.bar[j] = j === 0 ? 'attack' : null; d.bar[i] = s.id; this.app.hud.refreshSkills(); this.render(); }));
      });
      if (d.bar[0] && d.bar[0] !== 'attack') row2.appendChild(btn('btn small dim', '기본', () => { d.bar[0] = 'attack'; this.app.hud.refreshSkills(); this.render(); }));
      info.appendChild(row2);
    } else if (d.bar[0] && d.bar[0] !== 'attack') {
      const row3 = el('div', 'assign');
      row3.appendChild(btn('btn small dim', '주 단추를 기본 공격으로', () => { d.bar[0] = 'attack'; this.app.hud.refreshSkills(); this.render(); }));
      info.appendChild(row3);
    }
    TR.appendChild(info);
  }

  // ═════════ 퀘스트 ═════════
  r_quests() {
    const g = this.game, h = this.hero, d = h.data;
    const p = this.frame('퀘스트');
    const body = el('div', 'pnl-body'); p.appendChild(body);
    const list = el('div', 'qlist two');
    // 보고만 남은 것 → 진행 중 → 새 의뢰 → 끝난 것 순
    const ORDER = { ready: 0, active: 1, offer: 2, done: 3 };
    const all = Object.values(QUESTS).filter((q) => !q.lore).map((q) => ({ q, ph: questPhase(g, q.id) })).filter((e) => e.ph !== 'none');
    all.sort((a, b) => ORDER[a.ph] - ORDER[b.ph] || a.q.depth - b.q.depth);
    const line = (k, v) => { const r = el('div', 'qline'); r.appendChild(el('b', '', k)); r.appendChild(document.createTextNode(v)); return r; };
    for (const { q, ph } of all) {
      const st = questState(g, q.id), who = q.giver ? NPCS[q.giver] : null, to = q.report ? NPCS[q.report] : null;
      const box = el('div', 'qitem ' + ph);
      box.appendChild(el('div', 'qs', { ready: '보고만 남음', active: '진행 중', offer: '새 의뢰', done: '완료' }[ph]));
      box.appendChild(el('h4', '', q.name));
      if (who) box.appendChild(line('의뢰', `${who.name} · ${who.role}`));
      if (ph === 'ready') box.appendChild(el('div', 'qgo', `▶ 마을의 ${to.name}에게 ${q.fetch ? '가져가세요' : '알리세요'}`));
      else if (ph === 'offer') box.appendChild(el('div', 'qgo', `▶ 마을의 ${who.name}에게 말을 걸어 보세요`));
      else if (ph === 'active') {
        box.appendChild(line('목표', `${depthName(q.depth)} — ${q.goal}`));
        if (to) box.appendChild(line('보고', `끝나면 마을의 ${to.name}에게`));
      }
      box.appendChild(el('p', '', ph === 'offer' ? q.text?.none || '' : ph === 'ready' && q.fetch ? q.text?.active || '' : q.text?.[st] || q.text?.done || ''));
      list.appendChild(box);
    }
    if (!all.length) list.appendChild(el('div', 'shop-hint', '아직 받은 퀘스트가 없습니다. 마을 사람들과 이야기해 보세요.'));
    body.appendChild(list);
    // 읽은 기록
    const lore = Object.keys(d.lore || {});
    const box = el('div', 'qitem');
    box.style.marginTop = '6px';
    box.appendChild(el('h4', '', '기록'));
    const row = el('div', 'assign'); row.style.flexWrap = 'wrap';
    row.appendChild(btn('btn small', '처음 이야기', () => this.app.dialog.story(LORE.intro, '공허의 왕관')));
    for (const k of lore) row.appendChild(btn('btn small', { journal1: '세라핀의 일지 Ⅰ', journal2: '세라핀의 일지 Ⅱ', journal3: '세라핀의 일지 Ⅲ' }[k] || k, () => this.app.dialog.story(LORE[k], '기록')));
    box.appendChild(row);
    body.appendChild(box);
  }

  // ═════════ 메뉴·설정 ═════════
  r_menu() {
    const S = this.app.settings;
    const p = this.frame('메뉴');
    const body = el('div', 'pnl-body'); p.appendChild(body);
    // 왼쪽: 음량·단추, 오른쪽: 켜고 끄기
    const [ML, MR] = this.cols(body, 'menu');
    const slider = (label, key) => {
      const r = el('div', 'set-row'); r.appendChild(el('span', 'sn', label));
      const i = el('input'); i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = S[key];
      i.addEventListener('input', () => { S[key] = +i.value; this.app.applySettings(); });
      r.appendChild(i); ML.appendChild(r);
    };
    const toggle = (label, key, sub) => {
      const r = el('div', 'set-row'); const n = el('span', 'sn'); n.innerHTML = label + (sub ? `<br><span style="color:var(--dim)">${sub}</span>` : ''); r.appendChild(n);
      const t = el('button', 'tog' + (S[key] ? ' on' : ''));
      onTap(t, () => { S[key] = !S[key]; t.classList.toggle('on', S[key]); this.app.applySettings(); });
      r.appendChild(t); MR.appendChild(r);
    };
    slider('전체 음량', 'master'); slider('효과음', 'sfx'); slider('음악', 'music');
    toggle('무음 모드에서도 소리', 'silentMode', '아이폰 옆 스위치가 무음이어도');
    toggle('바닥 아이템 이름 표시', 'labels');
    toggle('괴물 체력 막대', 'bars');
    toggle('피해 숫자 표시', 'dmg');
    toggle('골드 자동 줍기', 'autoGold');
    toggle('고화질', 'hiq', '배터리를 더 씁니다');
    const row = el('div', 'tbtns');
    row.appendChild(btn('btn', '도움말', () => this.open('help')));
    row.appendChild(btn('btn', '저장', () => { this.app.saveNow(); this.game.toast('저장했습니다'); }));
    ML.appendChild(row);
    const row2 = el('div', 'tbtns');
    row2.appendChild(btn('btn red', '저장하고 제목 화면으로', () => this.app.quitToTitle(true)));
    ML.appendChild(row2);
    ML.appendChild(el('div', 'shop-hint', '층을 옮길 때·레벨이 오를 때 자동으로 저장됩니다. 불러오면 마을에서 시작하고 던전은 새로 만들어집니다.'));
  }
  // 도움말: 주제별 쪽으로 나눠 한 화면에
  r_help() {
    const p = this.frame('도움말');
    const tabs = el('div', 'pnl-tabs');
    HELP.forEach(([t], i) => tabs.appendChild(btn('pnl-tab' + (this.page === i ? ' on' : ''), t, () => { this.page = i; this.render(); })));
    p.appendChild(tabs);
    const body = el('div', 'pnl-body'); p.appendChild(body);
    const t = el('div', 'story help');
    t.textContent = HELP[this.page]?.[1] || '';
    body.appendChild(t);
  }

  // ═════════ 상점 ═════════
  r_shop() {
    const g = this.game, h = this.hero, which = this.opts.shop;
    const NAME = { smith: '고드윈의 대장간', premium: '고드윈의 고급품', healer: '마렌의 물약', witch: '이졸데의 오두막', boy: '핍의 보따리' };
    const p = this.frame(NAME[which] || '상점', this.goldHTML());
    const body = el('div', 'pnl-body'); p.appendChild(body);
    if (which === 'boy' && !h.data.shops?.boyPaid) {
      body.appendChild(el('div', 'story', '"보고 싶으면 50골드. 싫으면 말고."'));
      const r = el('div', 'tbtns');
      r.appendChild(btn('btn', '50골드를 낸다', () => { if (h.data.gold < 50) { g.toast('골드가 모자랍니다', 'warn'); return; } h.gold(-50); h.data.shops.boyPaid = true; g.sfx('sell'); this.render(); }));
      body.appendChild(r);
      return;
    }
    const sp = this.space(body);
    // 가게 격자와 가방 격자를 나란히 한 화면에: 칸 크기는 너비와 높이에 맞추고, 물건이 많으면 종류·쪽으로 나눈다
    const C = Math.max(22, Math.floor(Math.min(38, (sp.w - 20) / 20, (sp.h - 30) / 6)));
    const rowsFit = Math.max(4, Math.min(12, Math.floor((sp.h - 36) / C)));
    const [SL, SR] = this.cols(body, 'fill');
    const always = (ALWAYS[which] || []).map((id) => makeItem(id));
    this.opts.always = always;
    const list = [...always, ...stock(g, which === 'premium' ? 'premium' : which)];
    const kind = (it) => { const b = BASE[it.b]; return b.slot === 'weapon' ? '무기' : b.jewel || b.slot === 'ring' || b.slot === 'amulet' ? '장신구' : b.slot ? '방어구' : '물약·주문서'; };
    const pages = [];
    const fill = (items, name) => {
      let cur = null, n = 0;
      for (const it of items) {
        if (!cur || !h.invAdd(it, cur.items, 10, rowsFit)) { cur = { name, items: [] }; pages.push(cur); n++; if (n > 1) cur.name = `${name} ${n}`; h.invAdd(it, cur.items, 10, rowsFit); }
      }
    };
    const one = [];
    for (const it of list) if (!h.invAdd(it, one, 10, rowsFit)) break;
    if (one.length === list.length) pages.push({ name: '', items: one });
    else for (const k of ['무기', '방어구', '장신구', '물약·주문서']) fill(list.filter((it) => kind(it) === k), k);
    if (this.page >= pages.length) this.page = 0;
    if (pages.length > 1) {
      const tabs = el('div', 'pnl-tabs in');
      pages.forEach((pg, i) => tabs.appendChild(btn('pnl-tab' + (this.page === i ? ' on' : ''), pg.name, () => { this.page = i; this.sel = null; this.render(); })));
      SL.appendChild(tabs);
    } else SL.appendChild(el('div', 'shop-hint', '파는 물건 — 눌러서 사기'));
    const placed = pages[this.page]?.items || [];
    let maxY = 0; for (const it of placed) maxY = Math.max(maxY, it.y + BASE[it.b].h);
    SL.appendChild(this.grid(placed, 10, Math.max(2, Math.min(rowsFit, pages.length > 1 ? rowsFit : maxY)), C, 'shop', { price: (it) => buyPrice(it, which) >= 1000 ? Math.round(buyPrice(it, which) / 100) / 10 + 'k' : buyPrice(it, which) }));
    if (which === 'smith' || which === 'premium') {
      let tot = 0; for (const it of [...Object.values(h.data.equip), ...h.data.inv]) tot += repairCost(it);
      const r = el('div', 'tbtns');
      r.appendChild(btn('btn' + (tot ? '' : ' dim'), tot ? `모두 수리 (${tot}골드)` : '고칠 것 없음', () => { const c = repairAll(g); if (c) g.toast(`${c}골드로 수리했습니다`); this.render(); }));
      r.style.width = 10 * C + 'px';
      SR.appendChild(r);
    }
    if (which !== 'healer' && which !== 'boy') {
      SR.appendChild(el('div', 'shop-hint', '내 가방 — 눌러서 팔기'));
      this.opts.shop = which === 'premium' ? 'smith' : which;
      SR.appendChild(this.grid(h.data.inv, INV_W, INV_H, C, 'inv'));
      this.opts.shop = which;
    } else {
      SR.appendChild(el('div', 'shop-hint', '내 가방'));
      SR.appendChild(this.grid(h.data.inv, INV_W, INV_H, C, 'inv'));
    }
  }

  // ═════════ 보관함 ═════════
  r_stash() {
    const h = this.hero;
    const p = this.frame('보관함', '모든 캐릭터가 함께 씁니다');
    const body = el('div', 'pnl-body'); p.appendChild(body);
    const sp = this.space(body);
    const C = Math.max(20, Math.floor(Math.min(36, (sp.w - 24) / 20, (sp.h - 6) / STASH_H)));
    const [L, R] = this.cols(body);
    L.appendChild(this.grid(this.app.stash.items, STASH_W, STASH_H, C, 'stash'));
    R.appendChild(el('div', 'shop-hint', '가방'));
    R.appendChild(this.grid(h.data.inv, INV_W, INV_H, C, 'inv'));
  }

  // ═════════ 순간 이동 ═════════
  r_waypoint() {
    const h = this.hero, g = this.game;
    const p = this.frame('순간 이동 지점');
    const body = el('div', 'pnl-body'); p.appendChild(body);
    const list = el('div', 'qlist two wp');
    const wps = [0, ...h.data.wps.filter((d) => d > 0).sort((a, b) => a - b)];
    for (let d = 0; d <= 15; d++) {
      if (d > 0 && !LEVELS[d].waypoint) continue;
      const on = wps.includes(d);
      const b = btn('dlg-opt' + (on ? '' : ' dim'), `${levelName(d)}${d ? ` (지하 ${d}층)` : ''}${g.depth === d ? ' — 여기' : ''}`, () => {
        if (!on || g.depth === d) return;
        this.close();
        g.sfx('waypoint');
        this.app.travel(d, 'waypoint');
      });
      if (!on) b.style.opacity = '0.35';
      list.appendChild(b);
    }
    body.appendChild(list);
    body.appendChild(el('div', 'shop-hint', '순간 이동 지점은 3·5·7·9·11·13·15층에 있습니다. 한 번 밟으면 켜집니다.'));
  }
}

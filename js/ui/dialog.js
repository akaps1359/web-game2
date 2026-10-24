// 대화창: 마을 사람과의 대화, 이야기 글(일지·장면)
import { $, el, btn, canvasFor } from './dom.js';
import { drawPortrait } from '../render/figures.js';
import { NPCS, talkTo, questTalk, loreTalk } from '../game/npcs.js';
import { setQuest, questState } from '../game/quests.js';
import { LORE } from '../game/quests.js';
import { restock } from '../game/shop.js';

export class Dialog {
  constructor(app) {
    this.app = app;
    this.root = $('#dialog');
    this.npc = null;
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root && !this.locked) this.close(); });
  }
  get game() { return this.app.game; }
  isOpen() { return this.root.classList.contains('on'); }
  close() {
    const was = this.isOpen();
    if (was) this.closedAt = performance.now();
    this.root.classList.remove('on');
    this.root.innerHTML = '';
    this.npc = null;
    const cb = this.onClose; this.onClose = null;
    cb?.();
    if (was) this.app.input?.resteer?.(); // 쥐고 있던 조이스틱으로 다시 걷는다
  }

  open(npcActor) {
    this.npc = npcActor;
    this.show(talkTo(this.game, npcActor.npc));
  }
  show(view, textOverride) {
    const id = this.npc?.npc;
    this.root.innerHTML = '';
    const d = el('div', 'dlg');
    const head = el('div', 'dlg-head');
    const por = el('div', 'dlg-por');
    // 칸(54) 안쪽, 테두리를 뺀 크기
    const pw = 48, cv = canvasFor(por, pw, pw);
    if (view.look) { cv.g.fillStyle = '#1a1410'; cv.g.fillRect(0, 0, pw, pw); drawPortrait(cv.g, view.look, pw / 2, 104 - (54 - pw), 1.45, 0.3, 'idle', Math.PI / 4); }
    head.appendChild(por);
    const nm = el('div'); nm.appendChild(el('div', 'dlg-name', view.name)); nm.appendChild(el('div', 'dlg-role', view.role || ''));
    head.appendChild(nm);
    d.appendChild(head);
    d.appendChild(el('div', 'dlg-text', textOverride ?? view.text));
    const opts = el('div', 'dlg-opts');
    for (const o of view.opts) {
      const b = btn('dlg-opt' + (o.quest ? ' quest' : ''), o.label, () => this.act(id, o, view));
      if (o.sub) b.appendChild(el('span', 'sub', o.sub));
      opts.appendChild(b);
    }
    d.appendChild(opts);
    this.root.appendChild(d);
    this.root.classList.add('on');
    this.game?.sfx('ui_open');
  }
  act(id, o, view) {
    const g = this.game, P = this.app.panels;
    switch (o.act) {
      case 'leave': this.close(); return;
      case 'gossip': {
        const N = NPCS[id];
        const t = N.gossip?.length ? N.gossip[Math.floor(Math.random() * N.gossip.length)] : '…';
        this.show(view, `"${t}"`);
        return;
      }
      case 'lore': this.show(view, loreTalk(g)); return;
      case 'shop': {
        this.close();
        if (o.shop === 'premium' || o.shop === 'smith' || o.shop === 'healer' || o.shop === 'witch' || o.shop === 'boy') P.open('shop', { shop: o.shop });
        return;
      }
      case 'sell': this.close(); P.open('shop', { shop: id === 'witch' ? 'witch' : 'smith' }); return;
      case 'repair': this.close(); P.open('shop', { shop: 'smith' }); return;
      case 'identify': this.close(); P.open('inventory', { sage: true }); return;
      case 'quest': {
        const t = questTalk(g, id, o.quest);
        const nv = talkTo(g, id);
        this.show(nv, t || nv.text);
        this.app.hud.badges();
        return;
      }
      case 'woundedDie': {
        // 이미 도살자를 쓰러뜨렸으면(그 층에 먼저 내려가 시작된 경우) 다시 '진행 중'으로 되돌리지 않는다
        if (questState(g, 'butcher') === 'none') setQuest(g, 'butcher', 'active');
        const a = this.npc;
        this.close();
        if (a) {
          const L = g.level;
          a.release(L);
          L.actors.splice(L.actors.indexOf(a), 1);
          L.corpses.push({ id: a.id, x: a.x, y: a.y, face: a.face, look: a.look, fallDir: 1 });
        }
        return;
      }
    }
  }

  // 이야기 글(처음 이야기·일지·결말)
  story(text, title = '', onClose = null) {
    this.root.innerHTML = '';
    const d = el('div', 'dlg tale');
    if (title) { const h = el('div', 'dlg-head'); h.appendChild(el('div', 'dlg-name', title)); d.appendChild(h); }
    const t = el('div', 'dlg-text story', text);
    d.appendChild(t);
    const opts = el('div', 'dlg-opts');
    opts.appendChild(btn('dlg-opt', '계속', () => this.close()));
    d.appendChild(opts);
    this.root.appendChild(d);
    this.root.classList.add('on');
    this.onClose = onClose;
    this.game?.sfx('book');
  }
  lore(key) {
    const text = LORE[key];
    if (!text) return;
    this.story(text, key.startsWith('journal') ? '세라핀의 일지' : '');
  }
}

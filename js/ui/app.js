// 앱: 부팅·제목 화면·게임 루프·훅(소리·알림·저장)·화면 전환
import { Renderer } from '../render/renderer.js';
import { Game } from '../game/game.js';
import { newHeroData } from '../game/hero.js';
import { listChars, loadChar, saveChar, loadStash, saveStash, loadSettings, saveSettings } from '../core/save.js';
import { HUD } from './hud.js';
import { Panels } from './panels.js';
import { Dialog } from './dialog.js';
import { Title } from './title.js';
import { TouchInput } from './input.js';
import { levelName, themeOf } from '../game/world.js';
import { LORE } from '../game/quests.js';
import { itemName } from '../game/items.js';
import { $, el } from './dom.js';

const STEP = 1 / 60;

export class App {
  constructor() {
    this.cv = $('#view');
    this.settings = loadSettings();
    this.renderer = new Renderer(this.cv);
    if (this.settings.hiq) this.renderer.setQuality(true);
    this.renderer.setPixel(this.settings.pixel);
    this.game = null;
    this.audio = null;
    this.stash = loadStash();
    this.hud = new HUD(this);
    this.panels = new Panels(this);
    this.dialog = new Dialog(this);
    this.title = new Title(this);
    this.input = new TouchInput(this);
    this.acc = 0; this.last = 0;
    this.running = false;
    window.addEventListener('resize', () => this.onResize());
    window.visualViewport?.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });
    window.addEventListener('pagehide', () => this.saveNow());
  }

  async boot() {
    const bar = $('.boot-bar i'), msg = $('.boot-msg');
    const step = (p, m) => { if (bar) bar.style.width = p + '%'; if (m && msg) msg.textContent = m; };
    step(20, '소리를 준비하는 중…');
    try {
      const mod = await import('../audio/audio.js');
      this.audio = new mod.AudioSys(() => this.audioSettings());
    } catch (e) { console.warn('소리 없이 진행', e); }
    step(50, '타일을 굽는 중…');
    await new Promise((r) => setTimeout(r, 20));
    for (const t of ['crypt', 'town']) this.renderer.tileset(t);
    step(90, '어둠을 불러오는 중…');
    await new Promise((r) => setTimeout(r, 20));
    step(100);
    $('#boot').classList.add('hide');
    this.title.show();
    this.audio?.setMusic('title');
    requestAnimationFrame((t) => this.frame(t));
  }
  audioSettings() { const s = this.settings; return { master: s.master, sfx: s.sfx, music: s.music, silentMode: s.silentMode }; }
  applySettings() {
    saveSettings(this.settings);
    this.audio?.applySettings?.();
    const g = this.game;
    if (g) { g.showLabels = this.settings.labels; g.showBars = this.settings.bars; g.showDmg = this.settings.dmg; g.autoGold = this.settings.autoGold; }
    this.renderer.setQuality(this.settings.hiq);
    this.renderer.setPixel(this.settings.pixel);
  }
  onResize() { this.renderer.resize(); this.hud.layout?.(); this.panels.refresh(); }

  // ───────── 게임 시작 ─────────
  newGame(cls, name, hc) {
    const data = newHeroData(cls, name, hc);
    saveChar(data);
    this.startGame(data, true);
  }
  continueGame(id) {
    const data = loadChar(id);
    if (!data) return;
    this.startGame(data, false);
  }
  startGame(data, isNew) {
    const app = this;
    const g = new Game({
      fx: this.renderer.fx,
      sfx: (n, x, y, o) => this.sfx(n, x, y, o),
      loop: (n) => this.audio?.loop?.(n),
      sting: (n) => this.audio?.sting?.(n),
      toast: (m, k) => this.toast(m, k),
      levelChanged: (d, how) => this.onLevel(d, how),
      discover: (d) => { if (d % 4 === 1 || d === 16) this.audio?.sting?.('discover'); },
      talk: (npc) => this.dialog.open(npc),
      travel: (d, how, at) => this.travel(d, how, at),
      transition: (fn) => this.fade(fn),
      playerDied: () => this.onDeath(),
      levelUp: (lv) => this.onLevelUp(lv),
      save: () => this.saveNow(),
      inventoryChanged: () => { this.hud.refreshBelt(); this.panels.refresh(); },
      statsChanged: () => this.panels.refresh(),
      questUpdate: () => this.hud.badges(),
      lore: (k) => this.dialog.lore(k),
      openStash: () => this.panels.open('stash'),
      waypointMenu: () => this.panels.open('waypoint'),
      identifyPick: (scroll) => this.panels.open('inventory', { identifyWith: scroll }),
      dropAtPlayer: (it) => g.dropItem(it),
      victory: () => this.onVictory(),
      playerHurt: (d) => this.hud.hurt(d),
      picked: (it) => { if (it.q === 'unique' || it.q === 'rare') this.toast(`${itemName(it)} 획득`, 'big'); },
      tick: () => {},
    });
    this.game = g;
    window.__game = g;
    this.applySettings();
    g.start(data);
    this.title.hide();
    this.hud.show();
    this.hud.build();
    this.running = true;
    if (isNew) this.dialog.story(LORE.intro, '공허의 왕관');
  }

  sfx(name, x, y, opts) {
    const a = this.audio;
    if (!a) return;
    const P = this.game?.player;
    if (x == null || !P) a.play(name, opts); else a.playAt(name, x - P.x, y - P.y, opts);
  }

  toast(msg, kind = '') {
    const box = $('#toasts');
    const t = el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), kind === 'big' ? 2600 : 1800);
    setTimeout(() => t.remove(), kind === 'big' ? 3100 : 2300);
  }
  banner(a, b) {
    const n = el('div', 'banner');
    n.appendChild(el('div', 'b1', a));
    if (b) n.appendChild(el('div', 'b2', b));
    // 이미 떠 있는 알림이 있으면 그 아래 줄에 띄운다
    const live = $('#app').querySelectorAll('.banner').length;
    if (live) n.style.marginTop = live * 66 + 'px';
    $('#app').appendChild(n);
    setTimeout(() => n.remove(), 3300);
  }

  onLevel(d, how) {
    const theme = themeOf(d);
    const music = d === 0 ? 'town' : d === 16 ? 'boss' : theme;
    this.audio?.setMusic(music);
    this.audio?.setAmbience(theme === 'town' ? 'town' : theme);
    this.banner(levelName(d), d === 0 ? '잿빛 성당의 그늘' : d === 16 ? '모든 것의 끝' : `지하 ${d}층`);
    this.hud.onLevel();
    this.renderer.tileset(theme);
    this.renderer.cam.x = this.game.player.x; this.renderer.cam.y = this.game.player.y;
  }
  travel(d, how, at) {
    const g = this.game;
    if (how === 'portal' && g.depth !== 0) { /* 마을로 */ }
    this.fade(() => {
      if (how === 'portal' && d !== 0) { g.enter(d, 'portal', at); g.closePortal(); }
      else g.enter(d, how, at);
    });
  }
  fade(fn) {
    const f = el('div');
    f.style.cssText = 'position:absolute;inset:0;background:#000;z-index:58;opacity:0;transition:opacity .22s;pointer-events:auto';
    $('#app').appendChild(f);
    requestAnimationFrame(() => { f.style.opacity = '1'; });
    setTimeout(() => {
      try { fn(); } catch (e) { console.error(e); }
      f.style.opacity = '0';
      setTimeout(() => f.remove(), 260);
    }, 240);
  }
  onLevelUp(lv) {
    const P = this.game.player;
    this.renderer.fx.levelUp(P.x, P.y);
    this.sfx('levelup');
    this.banner(`레벨 ${lv}`, '능력치 점수 5 · 기술 점수 1');
    this.hud.badges();
    this.saveNow();
  }
  onDeath() {
    const g = this.game, h = g.hero;
    this.audio?.sting?.('death');
    if (h.data.hc) { h.data.deadHC = true; this.saveNow(); }
    const box = el('div', 'death');
    box.appendChild(el('h1', '', '당신은 죽었습니다'));
    if (h.data.hc) {
      box.appendChild(el('p', '', '하드코어 캐릭터는 되살아날 수 없습니다.\n이 영웅의 이야기는 여기서 끝납니다.'));
      const b = el('button', 't-btn', '제목 화면으로');
      b.onclick = () => { box.remove(); this.quitToTitle(false); };
      box.appendChild(b);
    } else {
      box.appendChild(el('p', '', `마을에서 다시 깨어납니다.\n갖고 있던 골드 일부(최대 ${Math.min(20, h.data.lvl)}%)를 잃고, 장비가 조금 닳습니다.`));
      const b = el('button', 't-btn', '마을에서 되살아나기');
      b.onclick = () => { box.remove(); const lost = g.respawn(); if (lost) this.toast(`${lost} 골드를 잃었습니다`, 'warn'); this.saveNow(); };
      box.appendChild(b);
    }
    $('#app').appendChild(box);
  }
  onVictory() {
    const g = this.game;
    this.audio?.sting?.('victory');
    g.hero.data.won = true;
    this.saveNow();
    this.dialog.story(LORE.victory, '끝', () => this.toast('축하합니다! 계속해서 던전을 탐험할 수 있습니다.', 'big'));
  }

  saveNow() {
    const g = this.game;
    if (!g?.hero) return;
    if (g.player?.dead && !g.hero.data.hc) return;
    g.hero.data.portal = null;
    saveChar(g.hero.save());
    saveStash(this.stash);
  }
  quitToTitle(save = true) {
    if (save) this.saveNow();
    this.running = false;
    this.game = null;
    this.panels.close();
    this.dialog.close();
    this.hud.hide();
    this.title.show();
    this.audio?.setMusic('title');
    this.audio?.setAmbience(null);
  }

  // ───────── 프레임 ─────────
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(0.1, (t - (this.last || t)) / 1000);
    this.last = t;
    if (!this.running || !this.game) { this.title.frame?.(dt); return; }
    const g = this.game;
    // 세로로 들고 있으면(가로로 돌려 달라는 안내가 덮고 있다) 멈춘다
    this.portraitQ = this.portraitQ || window.matchMedia('(orientation: portrait) and (pointer: coarse)');
    const pause = this.panels.isOpen() && this.panels.pauses() || this.dialog.isOpen() || this.portraitQ.matches;
    g.paused = pause;
    if (!pause) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 6) { g.update(STEP); this.renderer.fx.update(STEP, g); this.acc -= STEP; n++; }
      if (n >= 6) this.acc = 0;
    }
    // 카메라: 플레이어를 부드럽게 따라간다
    const P = g.player, cam = this.renderer.cam;
    const k = 1 - Math.pow(0.0015, dt);
    cam.x += (P.x - cam.x) * k; cam.y += (P.y - cam.y) * k;
    this.renderer.draw(g, pause ? 0 : dt);
    this.hud.update(dt);
    this.adapt(dt);
  }
  // 느린 기기에서는 해상도를 자동으로 낮춘다
  adapt(dt) {
    if (this.settings.hiq || document.hidden) return;
    this.ema = this.ema == null ? dt : this.ema * 0.95 + dt * 0.05;
    this.slowT = this.ema > 0.024 ? (this.slowT || 0) + dt : 0;
    const r = this.renderer;
    if (this.slowT > 3 && r.dpr > 1.25) {
      r.dpr = Math.max(1.25, r.dpr - 0.25);
      r.resize();
      this.slowT = 0; this.ema = 0.016;
      console.info('해상도 낮춤', r.dpr);
    }
  }
}

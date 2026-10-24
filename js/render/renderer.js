// 아이소메트릭 렌더러(도트 그래픽): 세상은 작은 판(기기 픽셀 P개 = 도트 한 칸)에 바닥 → (깊이순) 벽·물체·액터 →
// 어둠 → 빛 번짐 순으로 그려 각진 그대로 키우고, 글자·체력 막대·이름표만 원래 해상도로 또렷하게 그린다
import { TW, TH, isoX, isoY, clamp } from '../core/util.js';
import { F_SEEN, F_VIS, F_LAVA } from '../game/level.js';
import { buildTileset, tilesetJob, WALL_H, glowSprite, townFloorKeys, townFloorSprite } from './tiles.js';
import { townSprite, nearestSprite, cachedSprite, queueSprite, pumpBakes, bakesPending } from './townart.js';
import { generateTown } from '../game/gen/town.js';
import { RNG } from '../core/rng.js';
import { NPCS } from '../game/npcs.js';
import { npcMark } from '../game/quests.js';
import { makeCanvas } from './noise.js';
import { drawActor, drawCorpse, actorAlpha, figBox } from './figures.js';
import { drawObject, drawDecal, drawGroundItem, objectLight, drawTorch } from './props.js';
import { ART, SpriteAtlas, SpritePass, pixEllipse, pixText } from './pixel.js';
import { FX } from './fx.js';

// 빛: 계단진 동심원 [시작, 끝, 세기]
// 플레이어를 가리는 앞쪽 벽의 불투명도(디아블로 2처럼 반투명)
const SEE_THRU = 0.34;
// 기본 구도: 멀리서 넓게(가로 874px 화면에서 타일 약 21칸이 가로로 보인다). 두 손가락으로 0.75~2.2배까지 바꿀 수 있다
const VIEW = 0.68;
const LIGHT_BANDS = [[0, 0.3, 1], [0.3, 0.45, 0.86], [0.45, 0.56, 0.74], [0.56, 0.66, 0.6], [0.66, 0.75, 0.46], [0.75, 0.83, 0.33], [0.83, 0.9, 0.21], [0.9, 0.96, 0.11], [0.96, 1, 0.03]];

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d', { alpha: false });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.zoom = 1;
    this.cam = { x: 0, y: 0 };
    this.tilesets = new Map();
    this.fx = new FX(this);
    this.list = []; this.pool = [];
    this.light = makeCanvas(8, 8); this.lg = this.light.getContext('2d');
    this.time = 0;
    this.labels = []; // 화면에 찍힌 바닥 아이템 이름표(터치 판정용)
    this.lo = makeCanvas(8, 8); this.lc = this.lo.getContext('2d', { alpha: false }); // 세상을 그리는 작은 판
    this.atlas = new SpriteAtlas(); this.sp = new SpritePass(); this.corpseSpr = new WeakMap();
    this.lookQ = []; this.warmed = new Set(); // 미리 그려 둘 모습(warmLook)
    this.resize();
  }
  setQuality(hi) { this.dpr = Math.min(window.devicePixelRatio || 1, hi ? 3 : 2); this.resize(); }
  resize() {
    this.dirty = true; // 판 크기가 바뀌면 지워지므로 멈춰 있어도 다시 그린다
    const r = this.cv.getBoundingClientRect();
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    // 가로 화면: 높이(세로로 보이는 거리)에 맞추고, 멀리서 넓게 보는 구도로
    this.baseZoom = clamp(Math.min(this.W / 860, this.H / 440), 0.55, 1.4) * VIEW;
    this.applyZoom();
    const lw = Math.ceil(this.cv.width / this.P), lh = Math.ceil(this.cv.height / this.P);
    if (this.lo.width !== lw || this.lo.height !== lh) { this.lo.width = lw; this.lo.height = lh; }
    this.light.width = lw; this.light.height = lh;
    this.anchorY = 0.5;
  }
  // 기기 픽셀 P개가 도트 한 칸(CSS 1.5px). 타일 반폭이 짝수 도트가 되게 배율을 고른다(타일 이음매·흔들림 없이)
  applyZoom() {
    const z = this.baseZoom * (this.userZoom || 1);
    this.P = Math.max(1, Math.round(ART * this.dpr));
    this.sl = clamp(Math.round(16 * z * this.dpr / this.P), 3, 40) / 16;
    this.zoom = this.sl * this.P / this.dpr;
  }
  setUserZoom(z) { this.userZoom = clamp(z, 0.75, 2.2); this.applyZoom(); }
  // 두 손가락 확대·축소 중(시체 그림은 늘려 쓰고 손을 뗀 뒤 다시 굽는다)
  gestureStart() { this.gesture = true; }
  gestureEnd() { this.gesture = false; this.dirty = true; }
  // 타일 묶음은 배율(도트 단위)마다 따로 굽는다
  // 이 배율 것이 없으면: 같은 테마의 다른 배율 것이 있으면 그것을 늘려 쓰고 이 배율 것은 장면마다 조금씩 굽는다(배율을 바꿀 때
  // 0.1초 남짓 멈추던 것). 처음 보는 테마나 now(층을 옮길 때 — 화면이 어두워진 사이)면 바로 굽는다
  tileset(theme, now = false) {
    const key = theme + ':' + this.sl;
    let t = this.tilesets.get(key);
    if (t) return t;
    let near = null;
    for (const T of this.tilesets.values()) if (T.theme === theme && (!near || Math.abs(T.RS - this.sl) < Math.abs(near.RS - this.sl))) near = T;
    if (!near || now || theme === 'town') { t = buildTileset(theme, this.sl); this.tilesets.set(key, t); if (this.tsJob?.key === key) this.tsJob = null; return t; }
    if (this.tsJob?.key !== key) this.tsJob = { key, it: tilesetJob(theme, this.sl) }; // 지금 배율 것 하나만 굽는다
    return near;
  }
  pumpTilesets(ms) {
    const J = this.tsJob;
    if (!J) return;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) if (J.it.next().done) { this.tilesets.set(J.key, J.it.T); this.tsJob = null; this.dirty = true; return; }
  }
  get scale() { return this.zoom * this.dpr; }
  // 타일 좌표 → 기기 픽셀
  sx(x, y) { return (isoX(x, y) - isoX(this.cam.x, this.cam.y)) * this.scale + this.cv.width / 2; }
  sy(x, y, z = 0) { return (isoY(x, y) - isoY(this.cam.x, this.cam.y) - z) * this.scale + this.cv.height * this.anchorY; }
  // CSS 픽셀 → 타일 좌표
  toWorld(cx, cy) {
    const px = (cx * this.dpr - this.cv.width / 2) / this.scale + isoX(this.cam.x, this.cam.y);
    const py = (cy * this.dpr - this.cv.height * this.anchorY) / this.scale + isoY(this.cam.x, this.cam.y);
    return { x: px / TW + py / TH, y: py / TH - px / TW };
  }
  toScreen(x, y, z = 0) { return { x: this.sx(x, y) / this.dpr, y: this.sy(x, y, z) / this.dpr }; }

  push(d, k, a, b) {
    let e = this.pool[this.list.length];
    if (!e) { e = { d: 0, k: 0, a: null, b: null }; this.pool.push(e); }
    e.d = d; e.k = k; e.a = a; e.b = b;
    this.list.push(e);
  }

  draw(game, dt) {
    this.time += dt;
    // 세상은 작은 판(lc)에, 배율 s는 도트 단위. K: 도트 한 칸의 기기 픽셀
    const K = this.P, g = this.lc, L = game.level, P = game.player, s = this.sl;
    const cw = this.lo.width, ch = this.lo.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
    g.imageSmoothingEnabled = false;
    if (!L) { this.present(); return; }
    const town = L.theme === 'town';
    const T = this.tileset(L.theme);
    this.pumpTilesets(4);
    // 보이는 타일 범위
    const corners = [this.toWorld(0, 0), this.toWorld(this.W, 0), this.toWorld(0, this.H), this.toWorld(this.W, this.H)];
    const pad = 3;
    let x0 = Math.floor(Math.min(...corners.map((c) => c.x))) - pad, x1 = Math.ceil(Math.max(...corners.map((c) => c.x))) + pad;
    let y0 = Math.floor(Math.min(...corners.map((c) => c.y))) - pad, y1 = Math.ceil(Math.max(...corners.map((c) => c.y))) + pad + 4;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(L.w - 1, x1); y1 = Math.min(L.h - 1, y1);
    const fw = TW * s, fh = TH * s, wh = (WALL_H + TH) * s;
    // 벽 그림의 위쪽 끝(타일 중심에서). 그림은 제 크기 그대로 정수 도트 자리에
    const wTop = Math.round((WALL_H + TH / 2) * s);
    const camIX = isoX(this.cam.x, this.cam.y), camIY = isoY(this.cam.x, this.cam.y);
    const [shx, shy] = dt > 0 ? this.fx.shakeOffset() : [0, 0]; // 멈춰 있는 동안은 흔들지 않는다(흔들림 시간도 멈춰 끝없이 떨던 것)
    // 카메라를 도트 단위로 맞춰 타일 무늬가 움직일 때 일렁이지 않게
    const ox = Math.round(this.cv.width / 2 / K - camIX * s + shx * this.dpr / K), oy = Math.round(this.cv.height * this.anchorY / K - camIY * s + shy * this.dpr / K);
    const W = L.w, flags = L.flags, floor = L.floor, wall = L.wall;
    const t = this.time;
    // 빛이 닿는 칸(괴물·아이템은 여기서만 보인다). 한 번 본 칸은 빛 밖에서도 어둡게 남겨 그린다(디아블로 2처럼:
    // 걸을 때마다 빛 가장자리에서 바닥·벽이 나타났다 사라지지 않게)
    const lit = this.litMask(game, L, x0, y0, x1, y1, town);
    const mw = x1 - x0 + 1;
    const isLit = (x, y) => town || (x >= x0 && y >= y0 && x <= x1 && y <= y1 && lit[(y - y0) * mw + (x - x0)] === 1);
    this.isLit = isLit;

    const PF = this.prof;
    let T0 = PF ? performance.now() : 0;
    const mark = (k) => { if (!PF) return; const n = performance.now(); PF[k] = (PF[k] || 0) + n - T0; T0 = n; };
    mark('setup');
    // 층이 바뀌면 떠난 층의 시체·인물 그림을 놓아준다(다녀간 층마다 쌓여 수십 MB가 되던 것; 돌아오면 다시 굽는다).
    // 이 장면의 시체를 굽기 전에 비워야 새 층 첫 장면에 시체를 두 번 굽지 않는다
    if (this.fadeL !== L) {
      if (this.fadeL) for (const a of this.fadeL.actors) a._spr = null;
      this.corpseSpr = new WeakMap();
      this.fadeL = L; this.fadeA = new Float32Array(L.w * L.h).fill(1);
    }
    // 구운 모형(마을 건물·소품): 처음 들어온 층이면 한꺼번에, 배율이 바뀐 뒤에는 장면마다 조금씩 굽는다
    this.bakeAll = this.bakeL !== L; this.bakeL = L;
    // 새 층: 이 층 괴물·사람의 모습을 놀고 있는 시간에 미리 그려 둔다(처음 보일 때 멈칫하지 않게)
    if (this.bakeAll) for (const a of L.actors) if (!a.isPlayer && a.look) this.warmLook(a.bossId || a.mdef?.id || a.name, a.look, a.kind);
    this.pumpLooks(2);
    if (town && !this.bakeAll && !this.gesture) pumpBakes(6); // 두 손가락 확대·축소 중에는 쉰다
    const fkeys = town ? (L.fkeys || (L.fkeys = townFloorKeys(L))) : null;
    // 1) 바닥(마을은 다 구운 바닥판이 있으면 그것 한 장으로)
    const tg = town ? this.townGround(L, s, T, fkeys) : null;
    if (tg && tg.s === s) {
      const dx = ox - tg.LX, dy = oy - tg.LY;
      const sx0 = Math.max(0, -dx), sy0 = Math.max(0, -dy), sx1 = Math.min(tg.cv.width, cw - dx), sy1 = Math.min(tg.cv.height, ch - dy);
      if (sx1 > sx0 && sy1 > sy0) g.drawImage(tg.cv, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 + dx, sy0 + dy, sx1 - sx0, sy1 - sy0);
    } else if (tg) {
      // 배율을 바꾼 직후: 새 바닥판을 굽는 동안 앞 배율의 바닥판을 늘리고 줄여 쓴다(바닥 칸 그림을 한꺼번에 만드느라 멈추지 않게)
      const k = s / tg.s;
      g.drawImage(tg.cv, Math.round(ox - tg.LX * k), Math.round(oy - tg.LY * k), Math.round(tg.cv.width * k), Math.round(tg.cv.height * k));
    } else for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * W + x, f = floor[k];
      if (!f) continue;
      const fl = flags[k];
      if (!(fl & F_SEEN) && !town) continue;
      const px = ox + (x - y) * (TW / 2) * s, py = oy + (x + y) * (TH / 2) * s;
      if (px < -fw || px > cw + fw || py < -fh || py > ch + fh) continue;
      let spr;
      if (fkeys) spr = townFloorSprite(T, fkeys[k]);
      else if (fl & F_LAVA && T.lava.length) spr = T.lava[(x * 7 + y * 3) % T.lava.length];
      else spr = fl & F_VIS ? T.floors[f] : T.floorsDim[f];
      g.drawImage(spr, px - fw / 2, py - fh / 2, fw, fh);
    }
    mark('floor');
    // 마을 모형의 바닥 그림자
    if (town && !tg) for (const o of L.objects) {
      if (!o.model) continue;
      const sp = this.modelSprite(o, s);
      if (!sp.sh) continue;
      const k = s / sp.sl, px = ox + (o.x - o.y) * (TW / 2) * s, py = oy + (o.x + o.y) * (TH / 2) * s, sh = sp.sh;
      const dx = px - sh.ax * k, dy = py - sh.ay * k, dw = sh.cv.width * k, dh = sh.cv.height * k;
      if (dx > cw || dy > ch || dx + dw < 0 || dy + dh < 0) continue;
      g.drawImage(sh.cv, dx, dy, dw, dh);
    }
    // 마을 바닥 장식(풀포기·들꽃·돌): 정수 도트 자리에 찍는다
    if (town && !tg && L.decor) for (const d of L.decor) {
      const px = Math.round(ox + (d.x - d.y) * (TW / 2) * s), py = Math.round(oy + (d.x + d.y) * (TH / 2) * s);
      if (px < -40 || py < -40 || px > cw + 40 || py > ch + 40) continue;
      const sp = this.modelSprite(d, s), k = s / sp.sl;
      g.drawImage(sp.cv, px - sp.ax * k, py - sp.ay * k, sp.w * k, sp.h * k);
    }
    // 바닥 장식·시체·아이템
    for (const d of L.decals) {
      if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
      const k = Math.round(d.y) * W + Math.round(d.x);
      if (!(flags[k] & F_SEEN) && !town) continue;
      drawDecal(g, d, ox + (d.x - d.y) * (TW / 2) * s, oy + (d.x + d.y) * (TH / 2) * s, s, !(flags[k] & F_VIS) && !town);
    }
    for (const c of L.corpses) {
      if (c.x < x0 - 1 || c.x > x1 + 1 || c.y < y0 - 1 || c.y > y1 + 1) continue;
      const k = Math.round(c.y) * W + Math.round(c.x);
      if (!(flags[k] & F_VIS) && !town) continue;
      this.pixCorpse(g, c, ox + (c.x - c.y) * (TW / 2) * s, oy + (c.x + c.y) * (TH / 2) * s, s);
    }
    this.fx.drawGround(g, ox, oy, s);
    mark('decals');

    // 2) 깊이순으로 세워진 것들
    this.list.length = 0;
    const pd = P ? P.x + P.y : 0;
    // 플레이어 몸이 차지하는 화면 상자(앞쪽 벽·건물·나무가 가리면 반투명하게)
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    if (P?.look && !P.dead) {
      const ppx = ox + (P.x - P.y) * (TW / 2) * s, ppy = oy + (P.x + P.y) * (TH / 2) * s, fb = figBox(P.look, s * (P.look.scale || 1));
      bx0 = ppx - TW * s * 0.36; bx1 = ppx + TW * s * 0.36; by0 = ppy - fb.up * 0.75; by1 = ppy - 6 * s;
    }
    const fk = Math.min(1, dt * 7);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * W + x;
      if (!wall[k]) continue;
      if (!(flags[k] & F_SEEN) && !town) continue;
      this.push(x + y, 1, k, null);
    }
    for (const o of L.objects) {
      if (o.model) { this.pushModel(o, s, ox, oy, cw, ch, pd, bx0, bx1, by0, by1, fk); continue; }
      if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1 || o.hidden) continue;
      const k = o.y * W + o.x;
      if (!(flags[k] & F_SEEN) && !town) continue;
      this.push(o.x + o.y + (o.type === 'door' ? 0 : 0.05), 2, o, null);
    }
    for (const lt of L.lights) {
      if (!lt.torch || lt.tx < x0 || lt.tx > x1 || lt.ty < y0 || lt.ty > y1) continue;
      if (!(flags[lt.ty * W + lt.tx] & F_SEEN) && !town) continue;
      this.push(lt.tx + lt.ty + 0.02, 5, lt, null);
    }
    for (const a of L.actors) {
      if (a.x < x0 - 1 || a.x > x1 + 1 || a.y < y0 - 1 || a.y > y1 + 1) continue;
      if (!a.isPlayer && !this.actorVisible(L, a, town)) continue;
      if (!a.isPlayer && !town && !a.boss && !a.glowCol && !isLit(Math.round(a.x), Math.round(a.y))) continue;
      this.push(a.x + a.y + 0.1, 3, a, null);
    }
    for (const it of L.items) {
      if (it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue;
      const k = Math.round(it.y) * W + Math.round(it.x);
      if (!(flags[k] & F_VIS) && !town) continue;
      if (!isLit(Math.round(it.x), Math.round(it.y))) continue;
      this.push(it.x + it.y - 0.3, 4, it, null);
    }
    this.fx.collect(this, x0, y0, x1, y1);
    this.list.sort((a, b) => a.d - b.d);
    // 보이는 인물·괴물의 몸을 먼저 한 판에 모아 그려 한꺼번에 다듬는다
    this.atlas.begin();
    for (const e of this.list) if (e.k === 3) e.b = this.pixPrep(e.a, s, t);
    this.atlas.render();
    for (const e of this.list) if (e.k === 3 && e.b?.cell) e.b = this.keepSprite(e.b);
    mark('collect');
    // 플레이어를 실제로 가리는 앞쪽 벽·문·횃불만 반투명하게(디아블로 2처럼). 칸마다 투명도를 서서히 바꿔
    // 걸을 때 벽이 덜컥 사라졌다 생기지 않는다
    const FA = this.fadeA;
    const see = (k, d, px, py) => {
      const want = d > pd + 0.4 && px + fw / 2 > bx0 && px - fw / 2 < bx1 && py - wTop < by1 && py + fh / 2 > by0 ? SEE_THRU : 1;
      let a = FA[k] + (want - FA[k]) * fk;
      if (Math.abs(want - a) < 0.02) a = want;
      return (FA[k] = a);
    };
    for (const e of this.list) {
      switch (e.k) {
        case 1: {
          const k = e.a, x = k % W, y = (k / W) | 0;
          const px = ox + (x - y) * (TW / 2) * s, py = oy + (x + y) * (TH / 2) * s;
          if (px < -fw || px > cw + fw || py < -fh || py > ch + wh + fh) break;
          const vis = town || flags[k] & F_VIS;
          g.globalAlpha = see(k, x + y, px, py);
          const wimg = vis ? T.walls[wall[k]] : T.wallsDim[wall[k]];
          if (T.RS === s) g.drawImage(wimg, px - fw / 2, py - wTop);
          else g.drawImage(wimg, px - fw / 2, py - wTop, fw, (wimg.height * s) / T.RS); // 가까운 배율 것을 늘려 쓰는 중
          g.globalAlpha = 1;
          break;
        }
        case 2: {
          const o = e.a, px = ox + (o.x - o.y) * (TW / 2) * s, py = oy + (o.x + o.y) * (TH / 2) * s;
          const vis = town || flags[o.y * W + o.x] & F_VIS;
          g.globalAlpha = o.type === 'door' ? see(o.y * W + o.x, o.x + o.y, px, py) : 1;
          drawObject(g, o, px, py, s, t, vis, L);
          g.globalAlpha = 1;
          break;
        }
        case 3: {
          const a = e.a, px = ox + (a.x - a.y) * (TW / 2) * s, py = oy + (a.x + a.y) * (TH / 2) * s;
          if (a.z) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(px, py, 14 * s, 7 * s, 0, 0, Math.PI * 2); g.fill(); }
          this.pixActor(g, a, px, py - (a.z || 0) * s, s, t, e.b);
          break;
        }
        case 4: {
          const it = e.a, px = ox + (it.x - it.y) * (TW / 2) * s, py = oy + (it.x + it.y) * (TH / 2) * s;
          drawGroundItem(g, it, px, py, s, t);
          break;
        }
        case 5: {
          const lt = e.a, px = ox + (lt.tx - lt.ty) * (TW / 2) * s, py = oy + (lt.tx + lt.ty) * (TH / 2) * s;
          const vis = town || flags[lt.ty * W + lt.tx] & F_VIS;
          const k = lt.ty * W + lt.tx;
          g.globalAlpha = wall[k] ? FA[k] : see(k, lt.tx + lt.ty, px, py);
          drawTorch(g, lt, px, py, s, t, vis);
          g.globalAlpha = 1;
          break;
        }
        case 6: this.fx.drawEntry(g, e, ox, oy, s); break;
        case 7: {
          // 구운 모형의 한 띠(세로 조각)
          const o = e.a, st = e.b, sp = o._sp, k = s / sp.sl;
          const px = ox + (o.x - o.y) * (TW / 2) * s, py = oy + (o.x + o.y) * (TH / 2) * s;
          g.globalAlpha = o._fa ?? 1;
          if (k === 1) g.drawImage(sp.cv, st.x0, 0, st.x1 - st.x0, sp.h, px - sp.ax + st.x0, py - sp.ay, st.x1 - st.x0, sp.h);
          else g.drawImage(sp.cv, st.x0, 0, st.x1 - st.x0, sp.h, px + (st.x0 - sp.ax) * k, py - sp.ay * k, (st.x1 - st.x0) * k, sp.h * k);
          g.globalAlpha = 1;
          break;
        }
      }
    }

    mark('sorted');
    this.fx.drawWorld(g, ox, oy, s);
    // 3) 어둠(빛 지도)
    this.drawLighting(g, game, L, ox, oy, s, x0, y0, x1, y1, town);
    mark('light');
    // 4) 빛 번짐(가산)
    g.globalCompositeOperation = 'lighter';
    this.drawGlows(g, game, L, ox, oy, s, x0, y0, x1, y1, town);
    this.fx.drawGlow(g, ox, oy, s);
    g.globalCompositeOperation = 'source-over';
    mark('glow');
    // 상호작용 대상의 금빛 고리
    this.drawFocus(g, game, ox, oy, s);
    // 5) 판을 키워 화면에, 글자·체력 막대·이름표는 원래 해상도로 또렷하게
    this.present();
    this.fx.drawTop(this.g, ox * K, oy * K, s * K);
    this.drawLabels(game, L, ox * K, oy * K, s * K, x0, y0, x1, y1, town);
    mark('top');
  }
  // 마을 바닥판: 바닥 칸·모형 그림자·풀포기는 움직이지 않으니 배율마다 한 장으로 구워 둔다(장면마다 칸마다 수백 번 찍던 것을
  // 한 번에). 마을에 들어오거나 배율이 바뀌면 그 배율이 잠깐(0.25초) 이어진 뒤 장면마다 4ms씩 나눠 굽고, 다 될 때까지는 칸마다 찍는다
  townGround(L, s, T, fkeys) {
    let G = this.tg;
    if (!G || G.L !== L || G.s !== s) {
      // 같은 마을의 다 구운 앞 배율 판은 새 판이 될 때까지 늘려 쓴다
      if (G?.ready && G.L === L) this.tgPrev = G; else if (G?.L !== L) this.tgPrev = null;
      G = this.tg = { L, s, t0: performance.now(), it: null, cv: null, ready: false, dead: false };
    }
    if (G.ready) { this.tgPrev = null; return G; }
    const prev = this.tgPrev?.L === L ? this.tgPrev : null;
    if (G.dead) return null; // 너무 크게 확대해 판을 못 만들면 칸마다 찍는다(앞 판은 다음 확대·축소 때 늘려 쓰도록 남긴다)
    if (performance.now() - G.t0 < 250) return prev;
    if (!G.it) G.it = groundJob(G, L, s, T, fkeys);
    const t0 = performance.now();
    while (performance.now() - t0 < 4) {
      const st = G.it.next();
      if (st.done) { G.ready = !!G.cv; G.dead = !G.cv; G.it = null; break; }
      if (st.value === 'wait') break; // 모형은 pumpBakes가 굽는다: 같은 장면에서 다시 볼 것 없다
    }
    return G.ready ? G : prev;
  }
  // 제목 화면에서 노는 시간에 마을 그림(바닥 칸·건물·소품)을 조금씩 미리 굽는다(처음 마을에 들어갈 때 멈칫하지 않게)
  warmTown(ms) {
    if (this.warmSl === this.sl && !this.warmIt) return;
    if (this.warmSl !== this.sl) { this.warmSl = this.sl; this.warmIt = warmJob(this, this.sl); }
    const t0 = performance.now();
    while (performance.now() - t0 < ms) if (this.warmIt.next().done) { this.warmIt = null; return; }
  }
  // 처음 그리는 모습은 재질 타일(색·재질·방향마다)을 새로 만드느라 그 장면이 무겁다. 여러 방향·걸음·맞아 번쩍임으로 한 번씩
  // 보이지 않는 판에 그려 타일을 미리 만들어 둔다(장면마다 ms 안에서 조금씩)
  warmLook(id, look, kind) {
    if (!id || this.warmed.has(id)) return;
    this.warmed.add(id); this.lookQ.push({ look, kind, i: 0 });
  }
  pumpLooks(ms) {
    if (!this.lookQ.length) return;
    const t0 = performance.now(), c = this.warmCv || (this.warmCv = makeCanvas(200, 240)), g = c.getContext('2d');
    while (this.lookQ.length && performance.now() - t0 < ms) {
      const j = this.lookQ[0], i = j.i++, walk = i % 16 >= 8;
      const a = { id: 1, look: j.look, kind: j.kind, face: (i % 8) * Math.PI / 4 + 0.2, anim: { name: walk ? 'walk' : 'idle', t: 0, dur: 1 }, moving: walk, gph: (i % 4) / 4, flash: i >= 16 ? 1 : 0 };
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 200, 240);
      drawActor(g, a, 100, 180, this.sl, 0.3, 2);
      if (j.i >= 24) this.lookQ.shift();
    }
  }
  // 구운 모형 그림: 이 배율로 구운 것이 없으면(배율이 바뀌는 중) 시간 예산 안에서 굽고, 넘치면 가까운 배율 것을 키워 쓴다
  modelSprite(o, s) {
    if (o._sl === s) return o._sp;
    const v = o.v || 0;
    let sp = cachedSprite(o.model, v, s);
    if (!sp) {
      if (this.bakeAll) sp = townSprite(o.model, v, s);
      else if (o._nearS === s && o._sp) sp = o._sp; // 앞 장면에 찾아 둔 가까운 배율 그림(장면마다 굽기 저장소를 다 뒤지지 않게)
      else { queueSprite(o.model, v, s); sp = nearestSprite(o.model, v, s) || townSprite(o.model, v, s); o._nearS = s; }
    }
    o._sp = sp; o._sl = sp.sl === s ? s : -1;
    return sp;
  }
  // 모형을 화면 세로 띠(반 칸 폭)로 나눠 띠마다 그 줄의 가장 앞 칸 깊이로 정렬 목록에 넣는다(큰 건물 옆·뒤를 지나는 인물이
  // 바르게 가려진다). 플레이어를 가리는 앞쪽 띠가 있으면 건물 전체를 서서히 반투명하게
  pushModel(o, s, ox, oy, cw, ch, pd, bx0, bx1, by0, by1, fk) {
    const sp = this.modelSprite(o, s), k = s / sp.sl;
    const px = ox + (o.x - o.y) * (TW / 2) * s, py = oy + (o.x + o.y) * (TH / 2) * s;
    const L0 = px - sp.ax * k, T0 = py - sp.ay * k;
    if (L0 > cw || T0 > ch || L0 + sp.w * k < 0 || T0 + sp.h * k < 0) return;
    const strips = stripsOf(sp, o.fp || ONE);
    let cover = false;
    for (const st of strips) {
      const d = o.x + o.y + st.d;
      this.push(d + 0.05, 7, o, st);
      if (cover || d <= pd + 0.4 || st.bot < 0) continue;
      const sx0 = L0 + st.x0 * k, sx1 = L0 + st.x1 * k, sy0 = T0 + st.top * k, sy1 = T0 + st.bot * k;
      if (sx1 > bx0 && sx0 < bx1 && sy1 > by0 && sy0 < by1) cover = true;
    }
    const want = cover ? (strips.length > 2 ? SEE_THRU : 0.5) : 1;
    let a = (o._fa ?? 1) + (want - (o._fa ?? 1)) * fk;
    if (Math.abs(want - a) < 0.02) a = want;
    o._fa = a;
  }
  // 도트 판을 각진 그대로 화면 크기로 키운다
  present() {
    const G = this.g, lw = this.lo.width, lh = this.lo.height;
    G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over';
    G.imageSmoothingEnabled = false;
    G.drawImage(this.lo, 0, 0, lw, lh, 0, 0, lw * this.P, lh * this.P);
    G.imageSmoothingEnabled = true;
  }
  // 인물·괴물: 몸은 판에 칸을 잡아 그린다(발이 칸의 (hw, up)). 다듬은 그림은 액터마다 저장해 두고, 자세가 바뀔 때만
  // 다시 그린다(움직이거나 공격할 때 초당 24번, 가만히 있을 때 12번, 쓰러져 있으면 2번. 플레이어는 매 장면)
  pixPrep(a, s, t) {
    const look = a.look;
    if (!look || actorAlpha(a) <= 0.02) return null;
    const key = poseKey(a, s, t), c = a._spr;
    if (c && c.key === key && c.look === look) return c;
    // 두 손가락으로 배율을 바꾸는 중에는 플레이어가 아닌 인물은 앞 배율 그림을 늘려 쓴다(배율마다 모두 다시 그리느라 멈추지 않게)
    if (this.gesture && c && c.look === look && c.s && c.s !== s && !a.isPlayer) return { ...c, k: s / c.s };
    const { hw, up, dn } = figBox(look, s * (look.scale || 1));
    return { hw, up, s, cell: this.atlas.add(hw * 2, up + dn, (g, cx, cy) => drawActor(g, a, cx + hw, cy + up, s, t, 2)), key, look, a };
  }
  // 판에서 다듬은 칸을 액터의 그림으로 옮겨 둔다
  keepSprite(pr) {
    const a = pr.a, cell = pr.cell;
    let c = a._spr;
    if (!c) c = a._spr = { cv: makeCanvas(cell.w, cell.h) };
    if (c.cv.width !== cell.w || c.cv.height !== cell.h) { c.cv.width = cell.w; c.cv.height = cell.h; }
    const cg = c.cv.getContext('2d');
    cg.clearRect(0, 0, cell.w, cell.h);
    cg.drawImage(this.atlas.b, cell.x, cell.y, cell.w, cell.h, 0, 0, cell.w, cell.h);
    cg.drawImage(this.atlas.a, cell.x, cell.y, cell.w, cell.h, 0, 0, cell.w, cell.h);
    c.key = pr.key; c.look = pr.look; c.hw = pr.hw; c.up = pr.up; c.s = pr.s;
    return c;
  }
  // 바닥에 깔리는 것(그림자·대상 고리)은 바로, 다듬은 몸은 정수 도트 자리에
  pixActor(g, a, px, py, s, t, pr) {
    const x = Math.round(px), y = Math.round(py);
    drawActor(g, a, x, y, s, t, 3);
    if (!pr) return;
    g.globalAlpha = actorAlpha(a);
    if (pr.k) g.drawImage(pr.cv, Math.round(x - pr.hw * pr.k), Math.round(y - pr.up * pr.k), Math.round(pr.cv.width * pr.k), Math.round(pr.cv.height * pr.k));
    else g.drawImage(pr.cv, x - pr.hw, y - pr.up);
    g.globalAlpha = 1;
  }
  // 시체는 움직이지 않으니 한 번 다듬어 둔다
  pixCorpse(g, c, px, py, s) {
    const look = c.look;
    if (!look) return;
    let k = this.corpseSpr.get(c);
    g.globalAlpha = c.fade ?? 1;
    // 두 손가락으로 배율을 바꾸는 중에는 앞 배율 그림을 늘려 쓴다(시체마다 다시 굽느라 멈추지 않게)
    if (k && k.s !== s && this.gesture) {
      const r = s / k.s;
      g.drawImage(k.cv, Math.round(px - k.hw * r), Math.round(py - k.up * r), Math.round(k.cv.width * r), Math.round(k.cv.height * r));
      g.globalAlpha = 1;
      return;
    }
    if (!k || k.s !== s) {
      const sc = s * (look.scale || 1), hw = Math.ceil(80 * sc * Math.max(1, look.bulk || 1)) + 2, up = Math.ceil(70 * sc * (look.h || 1)) + 2, dn = Math.ceil(36 * sc) + 2;
      const one = { ...c, fade: 1 };
      k = { s, hw, up, cv: this.sp.bake(hw * 2, up + dn, (sg) => drawCorpse(sg, one, hw, up, s)) };
      this.corpseSpr.set(c, k);
    }
    g.drawImage(k.cv, Math.round(px) - k.hw, Math.round(py) - k.up);
    g.globalAlpha = 1;
  }
  // 상호작용 단추가 다룰 대상: 금빛 고리(아이템은 이름표를 강조)
  drawFocus(g, game, ox, oy, s) {
    const f = game.focus;
    if (!f || f.kind === 'item') return;
    const fx = ox + (f.x - f.y) * (TW / 2) * s, fy = oy + (f.x + f.y) * (TH / 2) * s;
    const k = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    pixEllipse(g, Math.round(fx), Math.round(fy), Math.round((18 + 3 * k) * s), Math.round((9 + 1.5 * k) * s), `rgba(240,216,152,${0.55 + 0.35 * k})`);
  }

  litMask(game, L, x0, y0, x1, y1, town) {
    const mw = x1 - x0 + 1, mh = y1 - y0 + 1, n = mw * mh;
    if (!this.lit || this.lit.length < n) this.lit = new Uint8Array(n * 2);
    const m = this.lit;
    m.fill(0, 0, n);
    if (town) return m;
    const mark = (cx, cy, r) => {
      const ax = Math.max(x0, Math.floor(cx - r)), bx = Math.min(x1, Math.ceil(cx + r));
      const ay = Math.max(y0, Math.floor(cy - r)), by = Math.min(y1, Math.ceil(cy + r));
      const r2 = r * r;
      for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) m[(y - y0) * mw + (x - x0)] = 1;
    };
    const P = game.player;
    if (P) mark(P.x, P.y, (game.lightRadius ? game.lightRadius() : 8) + 1.6);
    for (const lt of L.lights) if (lt.x > x0 - 6 && lt.x < x1 + 6 && lt.y > y0 - 6 && lt.y < y1 + 6 && L.flags[lt.ty * L.w + lt.tx] & F_SEEN) mark(lt.x, lt.y, lt.r + 0.5);
    for (const o of L.objects) { if (o.x < x0 - 6 || o.x > x1 + 6 || o.y < y0 - 6 || o.y > y1 + 6) continue; const li = objectLight(o, 0); if (li && L.flags[o.y * L.w + o.x] & F_SEEN) mark(o.x, o.y, li.r + 0.5); }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = y * L.w + x; if (L.flags[k] & F_LAVA && L.flags[k] & F_SEEN) mark(x, y, 2.2); }
    for (const ms of L.missiles) if (ms.light) mark(ms.x, ms.y, ms.light + 0.5);
    for (const ar of L.areas) if (ar.light) mark(ar.x, ar.y, ar.light + (ar.r || 0));
    for (const a of L.actors) if ((a.glow || a.glowCol) && !a.dead) mark(a.x, a.y, 2.5);
    for (const f of this.fx.flashes) mark(f.x, f.y, f.r);
    return m;
  }

  actorVisible(L, a, town) {
    if (town) return true;
    const k = Math.round(a.y) * L.w + Math.round(a.x);
    if (!(L.flags[k] & F_VIS)) return false;
    return true;
  }

  // 어둠 위에 광원 구멍을 뚫는다(세상 판과 같은 해상도에서 계단진 동심원으로)
  drawLighting(g, game, L, ox, oy, s, x0, y0, x1, y1, town) {
    const lg = this.lg, lw = this.light.width, lh = this.light.height;
    // 빛 밖의 어둠: 던전에서도 한 번 본 곳의 바닥·벽이 어렴풋이 보이는 정도
    const amb = town ? (game.townDark ?? 0.32) : 0.84;
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, lw, lh);
    lg.fillStyle = `rgba(0,0,0,${amb})`;
    lg.fillRect(0, 0, lw, lh);
    lg.globalCompositeOperation = 'destination-out';
    const t = this.time;
    const hole = (x, y, r, power = 1, z = 18) => {
      const px = ox + (x - y) * (TW / 2) * s, py = oy + (x + y) * (TH / 2) * s - z * s;
      const R = Math.round(r * (TW / 2) * s * 1.05);
      if (R < 1 || px < -R || py < -R || px > lw + R || py > lh + R) return;
      const spr = holeSprite(R, Math.round(power * 20) / 20);
      lg.drawImage(spr, Math.round(px - R), Math.round(py - spr.height / 2));
    };
    const P = game.player;
    if (P) hole(P.x, P.y, game.lightRadius ? game.lightRadius() : 8, 1, 20);
    if (!town) {
      for (const lt of L.lights) {
        if (lt.x < x0 - 6 || lt.x > x1 + 6 || lt.y < y0 - 6 || lt.y > y1 + 6) continue;
        if (!(L.flags[lt.ty * L.w + lt.tx] & F_SEEN)) continue;
        const fl = lt.torch ? 0.9 + 0.1 * Math.sin(t * 9 + lt.flick) * Math.sin(t * 13.7 + lt.flick * 2) : 1;
        hole(lt.x, lt.y, lt.r * fl, 0.85, 30);
      }
      // 용암은 스스로 빛난다
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = y * L.w + x;
        if (L.flags[k] & F_LAVA && L.flags[k] & F_SEEN && (x + y) % 2 === 0) hole(x, y, 2.4, 0.55, 0);
      }
    } else {
      for (const lt of L.lights) if (lt.x >= x0 - 6 && lt.x <= x1 + 6 && lt.y >= y0 - 6 && lt.y <= y1 + 6) hole(lt.x, lt.y, lt.r, 0.8, 30);
    }
    for (const o of L.objects) {
      const li = objectLight(o, t);
      if (!li || o.x < x0 - 6 || o.x > x1 + 6 || o.y < y0 - 6 || o.y > y1 + 6) continue;
      if (!town && !(L.flags[o.y * L.w + o.x] & F_SEEN)) continue;
      hole(o.x, o.y, li.r, li.p ?? 0.9, 20);
    }
    for (const a of L.actors) if (a.glow && !a.dead) hole(a.x, a.y, a.glow, 0.7, 25);
    this.fx.lights(hole);
    lg.globalCompositeOperation = 'source-over';
    g.drawImage(this.light, 0, 0);
  }

  drawGlows(g, game, L, ox, oy, s, x0, y0, x1, y1, town) {
    const t = this.time;
    const cw = this.lo.width, ch = this.lo.height;
    const glow = (x, y, z, r, col, a) => {
      const px = ox + (x - y) * (TW / 2) * s, py = oy + (x + y) * (TH / 2) * s - z * s;
      const R = r * s;
      if (px + R < 0 || py + R < 0 || px - R > cw || py - R > ch) return;
      g.globalAlpha = a;
      g.drawImage(glowSprite(col[0], col[1], col[2]), px - R, py - R, R * 2, R * 2);
    };
    for (const lt of L.lights) {
      if (!lt.torch || lt.tx < x0 || lt.tx > x1 || lt.ty < y0 || lt.ty > y1) continue;
      if (!town && !(L.flags[lt.ty * L.w + lt.tx] & F_SEEN)) continue;
      const fl = 0.75 + 0.25 * Math.sin(t * 11 + lt.flick) * Math.sin(t * 7.3 + lt.flick);
      glow(lt.x, lt.y, 52, 26, lt.color, 0.32 * fl);
    }
    if (!town) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * L.w + x;
      if (!(L.flags[k] & F_LAVA) || !(L.flags[k] & F_SEEN)) continue;
      const p = 0.5 + 0.5 * Math.sin(t * 1.7 + x * 0.9 + y * 1.3);
      glow(x, y, 0, 34, [255, 110, 30], 0.12 + 0.1 * p);
    }
    for (const o of L.objects) {
      const li = objectLight(o, t);
      if (!li || !li.glow || o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
      if (!town && !(L.flags[o.y * L.w + o.x] & F_SEEN)) continue;
      glow(o.x, o.y, li.z ?? 30, li.gr ?? 30, li.color, li.ga ?? 0.3);
    }
    // 구운 모형의 불빛(창문·화덕·등불)
    if (town) for (const o of L.objects) {
      if (!o._sp || !o.model) continue;
      for (const w of o._sp.glows) {
        const f = w.fl ? 0.8 + 0.2 * Math.sin(t * 7 + o.x * 3 + w.z) * Math.sin(t * 11.3 + o.y) : 1;
        glow(o.x + w.x, o.y + w.y, w.z, w.r, w.col, w.a * f);
      }
    }
    for (const a of L.actors) {
      if (!a.glowCol || a.dead || (!town && !(L.flags[Math.round(a.y) * L.w + Math.round(a.x)] & F_VIS))) continue;
      glow(a.x, a.y, 30 * (a.look?.h || 1), 34 * (a.look?.h || 1), a.glowCol, 0.22);
    }
    g.globalAlpha = 1;
  }

  // 바닥 아이템 이름표(디아블로처럼 색으로 등급 구분). 화면 위치를 기록해 터치로 줍게 한다
  drawLabels(game, L, ox, oy, s, x0, y0, x1, y1, town) {
    const g = this.g, d = this.dpr;
    this.labels.length = 0;
    // 마을 사람 이름, 가까운 출구·퀘스트 물체 이름
    const P = game.player, f = game.focus;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${12 * d}px Galmuri11, sans-serif`;
    const tag = (txt, x, y, z, col) => pixText(g, txt, ox + (x - y) * (TW / 2) * s, oy + (x + y) * (TH / 2) * s - z * s, col, d);
    // 마을 사람 이름과 머리 위 퀘스트 표시('!' 새 부탁, '?' 보고할 것). 표시는 0.25초마다 다시 따진다
    if (town && (!this.marks || this.time - this.markAt > 0.25)) {
      this.markAt = this.time; this.marks = new Map();
      for (const a of L.actors) if (a.kind === 'npc' && a.npc) { const m = npcMark(game, a.npc); if (m) this.marks.set(a, m); }
    }
    for (const a of L.actors) {
      if (a.kind !== 'npc' || !a.name || Math.hypot(a.x - P.x, a.y - P.y) >= 14) continue;
      const lying = a.anim.name === 'dead', z = lying ? 30 : 76 * (a.look?.h || 1);
      if (!lying && Math.hypot(a.x - P.x, a.y - P.y) < 11) tag(a.name, a.x, a.y, z, '#f0d898');
      const mk = town && this.marks?.get(a);
      if (!mk) continue;
      g.font = `bold ${24 * d}px Galmuri11, sans-serif`;
      tag(mk, a.x, a.y, z + (lying ? 6 : 20) * d / s + Math.round(Math.sin(this.time * 4 + a.id) * 1.5) * d / s, mk === '?' ? '#ffd84a' : '#fff27a');
      g.font = `${12 * d}px Galmuri11, sans-serif`;
    }
    for (const o of L.objects) {
      const nm = EXIT_NAME[o.type];
      if (!nm || Math.hypot(o.x - P.x, o.y - P.y) > 6) continue;
      if (!town && (!(L.flags[o.y * L.w + o.x] & F_VIS) || !this.isLit?.(o.x, o.y))) continue;
      if ((o.type === 'pedestal' || o.type === 'fungus' || o.type === 'anvil') && !o.item) continue;
      if (o.type === 'anvil' && !o.quest) continue;
      tag(typeof nm === 'function' ? nm(o) : nm, o.x, o.y, o.type === 'portal' ? 78 : 36, o.type === 'portal' ? '#a8c8ff' : '#e8d8b0');
    }
    // 이름표를 끈 설정이어도 상호작용 대상 아이템의 이름표는 보인다
    const only = game.showLabels ? null : f?.kind === 'item' ? f.ref : undefined;
    if (only === undefined) return;
    g.font = `${12 * d}px Galmuri11, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const placed = [];
    const items = L.items.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const it of items) {
      if (only && it !== only) continue;
      if (it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue;
      const k = Math.round(it.y) * L.w + Math.round(it.x);
      if (!town && !(L.flags[k] & F_VIS)) continue;
      if (this.isLit && !this.isLit(Math.round(it.x), Math.round(it.y))) continue;
      const txt = game.itemLabel ? game.itemLabel(it) : it.name;
      if (!txt) continue;
      const px = ox + (it.x - it.y) * (TW / 2) * s;
      let py = oy + (it.x + it.y) * (TH / 2) * s - 22 * s;
      const w = g.measureText(txt).width + 10 * d, h = 17 * d;
      // 겹치면 위로 쌓는다
      for (let n = 0; n < 8; n++) {
        const hit = placed.find((r) => Math.abs(r.x - px) < (r.w + w) / 2 && Math.abs(r.y - py) < h);
        if (!hit) break;
        py = hit.y - h - 1 * d;
      }
      placed.push({ x: px, y: py, w });
      g.fillStyle = 'rgba(0,0,0,0.72)';
      g.fillRect(px - w / 2, py - h / 2, w, h);
      if (f?.ref === it) { g.strokeStyle = 'rgba(240,216,152,0.95)'; g.lineWidth = 1.5 * d; g.strokeRect(px - w / 2, py - h / 2, w, h); }
      g.fillStyle = game.itemColor ? game.itemColor(it) : '#ddd';
      g.fillText(txt, px, py + 0.5 * d);
      this.labels.push({ it, x: (px - w / 2) / d, y: (py - h / 2) / d, w: w / d, h: h / d });
    }
  }
}

// 모형의 띠: 반 칸 폭 세로 줄 j마다 그 줄에 걸친 칸 가운데 가장 앞(x+y가 큰) 칸의 깊이, 그림 열 범위, 불투명 높이 범위
// 액터 그림을 다시 그릴 때를 정하는 열쇠: 시간을 잘게 끊은 칸(움직임에 따라 초당 24·12·2칸)과 동작·방향·맞은 번쩍임·배율
function poseKey(a, s, t) {
  if (a.isPlayer || a.portrait) return NaN;
  const A = a.anim, n = A?.name;
  const hz = n === 'dead' || n === 'stone' ? 2 : a.moving || (n && n !== 'idle') ? 24 : 12;
  // 액터마다 끊는 때를 어긋나게(한 장면에 몰려 다시 그리지 않게)
  return `${Math.floor(t * hz + ((a.id || 0) * 0.618) % 1)}|${n}|${Math.round((a.face || 0) * 10)}|${a.flash > 0 ? 1 : 0}|${s}|${a.moving ? 1 : 0}|${a.whirl ? 1 : 0}`;
}
// 빛 구멍(계단진 동심원, 세로 0.72배): 반지름·세기마다 한 번 그려 둔다
const holeCache = new Map();
function holeSprite(R, power) {
  const key = R * 64 + Math.round(power * 20);
  let c = holeCache.get(key);
  if (c) return c;
  const H = Math.max(1, Math.round(R * 2 * 0.72));
  c = makeCanvas(R * 2, H);
  const g = c.getContext('2d'), gr = g.createRadialGradient(R, R, 0, R, R, R);
  for (const [a, b, k] of LIGHT_BANDS) { gr.addColorStop(a, `rgba(0,0,0,${power * k})`); gr.addColorStop(b, `rgba(0,0,0,${power * k})`); }
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.setTransform(1, 0, 0, H / (R * 2), 0, 0);
  g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2);
  if (holeCache.size > 600) holeCache.clear();
  holeCache.set(key, c);
  return c;
}
const ONE = [[0, 0, 0, 0]];
// 마을 바닥판 굽기(townGround): 그리는 순서는 칸마다 찍을 때와 같다(바닥 → 그림자 → 풀포기)
function* groundJob(G, L, s, T, fkeys) {
  const hw = (TW / 2) * s, hh = (TH / 2) * s, fw = TW * s, fh = TH * s, M = 64;
  const LX = Math.round(L.h * hw + fw / 2 + M), LY = Math.round(fh / 2 + M);
  const w = Math.ceil((L.w + L.h) * hw + fw + 2 * M), h = Math.ceil((L.w + L.h) * hh + fh + 2 * M);
  if (w * h > 6e6) return; // 아주 크게 확대했을 때는 칸마다 찍는다
  // 그림자·풀포기는 이 배율로 구운 그림이 다 있어야 칸마다 찍을 때와 같다
  for (const o of [...L.objects, ...(L.decor || [])]) {
    if (!o.model) continue;
    while (!cachedSprite(o.model, o.v || 0, s)) { queueSprite(o.model, o.v || 0, s); yield 'wait'; }
  }
  const cv = makeCanvas(w, h), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      const k = y * L.w + x;
      if (!L.floor[k]) continue;
      const fresh = !T.townFloors.has(fkeys[k]); // 이 배율에서 처음 만드는 바닥 칸 그림이면 만든 뒤 쉰다
      g.drawImage(townFloorSprite(T, fkeys[k]), LX + (x - y) * hw - fw / 2, LY + (x + y) * hh - fh / 2, fw, fh);
      if (fresh) yield;
    }
    yield;
  }
  for (const o of L.objects) {
    if (!o.model) continue;
    const sh = cachedSprite(o.model, o.v || 0, s).sh;
    if (sh) g.drawImage(sh.cv, LX + (o.x - o.y) * hw - sh.ax, LY + (o.x + o.y) * hh - sh.ay, sh.cv.width, sh.cv.height);
  }
  yield;
  for (const d of L.decor || []) {
    const sp = cachedSprite(d.model, d.v || 0, s);
    g.drawImage(sp.cv, Math.round(LX + (d.x - d.y) * hw) - sp.ax, Math.round(LY + (d.x + d.y) * hh) - sp.ay, sp.w, sp.h);
  }
  G.cv = cv; G.LX = LX; G.LY = LY;
}
// 제목 화면에서 미리 굽기(warmTown): 건물·소품 모형(처음 장면에 굽지 못하면 그 자리에서 한꺼번에 굽느라 멈춘다)을 먼저,
// 그다음 마을 바닥 칸 그림(광장에서 가까운 것부터)
function* warmJob(r, sl) {
  const T = r.tileset('town');
  yield;
  const L = generateTown(new RNG(7)), keys = townFloorKeys(L), first = new Map();
  yield;
  for (const o of [...L.objects, ...(L.decor || [])]) if (o.model) queueSprite(o.model, o.v || 0, sl);
  while (bakesPending()) { pumpBakes(3); yield; }
  for (let i = 0; i < keys.length; i++) if (keys[i] && !first.has(keys[i])) first.set(keys[i], Math.hypot((i % L.w) - L.w / 2, Math.floor(i / L.w) - L.h / 2));
  for (const k of [...first.keys()].sort((a, b) => first.get(a) - first.get(b))) { townFloorSprite(T, k); yield; }
  // 마을 사람 모습
  for (const id in NPCS) if (NPCS[id].look) r.warmLook(NPCS[id].name, NPCS[id].look, 'npc');
  while (r.lookQ.length) { r.pumpLooks(3); yield; }
}
function stripsOf(sp, fp) {
  if (sp.strips) return sp.strips;
  const tiles = [];
  for (const [x0, y0, x1, y1] of fp) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push([x, y]);
  if (tiles.length === 1) {
    let top = 1e9, bot = -1;
    for (let x = 0; x < sp.w; x++) if (sp.top[x] >= 0) { top = Math.min(top, sp.top[x]); bot = Math.max(bot, sp.bot[x]); }
    return (sp.strips = [{ d: tiles[0][0] + tiles[0][1], x0: 0, x1: sp.w, top, bot }]);
  }
  let jmin = 1e9, jmax = -1e9;
  for (const [x, y] of tiles) { jmin = Math.min(jmin, x - y - 1); jmax = Math.max(jmax, x - y); }
  const out = [], hw = 32 * sp.sl;
  for (let j = jmin; j <= jmax; j++) {
    let d = -1e9;
    for (const [x, y] of tiles) if (x - y === j || x - y === j + 1) d = Math.max(d, x + y);
    out.push({ j, d });
  }
  for (let i = 0; i < out.length; i++) if (out[i].d === -1e9) out[i].d = out[i - 1]?.d ?? 0;
  for (let i = 0; i < out.length; i++) {
    const e = out[i];
    e.x0 = i === 0 ? 0 : Math.max(0, Math.round(sp.ax + e.j * hw));
    e.x1 = i === out.length - 1 ? sp.w : Math.min(sp.w, Math.round(sp.ax + (e.j + 1) * hw));
    let top = 1e9, bot = -1;
    for (let x = e.x0; x < e.x1; x++) if (sp.top[x] >= 0) { top = Math.min(top, sp.top[x]); bot = Math.max(bot, sp.bot[x]); }
    e.top = top; e.bot = bot;
  }
  return (sp.strips = out.filter((e) => e.x1 > e.x0));
}

const EXIT_NAME = {
  stairs_down: (o) => (o.town ? '대성당 지하로' : o.sealed ? '봉인된 계단' : '아래층으로'),
  stairs_up: (o) => (o.toTown ? '마을로' : '위층으로'),
  waypoint: '순간 이동 지점', portal: '차원문', stash: '보관함',
  pedestal: '빛나는 돌', fungus: '검은 버섯', anvil: '분노의 모루', tome: '낡은 책',
};

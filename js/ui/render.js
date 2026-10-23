// 캔버스 지도 렌더러
import { TERRAIN } from '../data/units.js';
import { FACTION_DEFS } from '../data/countries.js';
import { atWar, allied } from '../engine/world.js';
import { divStats, divKind } from '../engine/military.js';
import { fleetSize } from '../engine/naval.js';
import { drawFlag } from './flags.js';

const LOD_TOL = [0, 2.5, 9];

function dpSimplify(xs, ys, tol) {
  const n = xs.length;
  if (n < 3 || tol <= 0) return null;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [0, n - 1];
  while (stack.length) {
    const j = stack.pop(), i = stack.pop();
    let md = -1, mk = -1;
    const ax = xs[i], ay = ys[i], dx = xs[j] - ax, dy = ys[j] - ay, L2 = dx * dx + dy * dy || 1e-9;
    for (let k = i + 1; k < j; k++) {
      let t = ((xs[k] - ax) * dx + (ys[k] - ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = xs[k] - (ax + t * dx), ey = ys[k] - (ay + t * dy); const d = ex * ex + ey * ey;
      if (d > md) { md = d; mk = k; }
    }
    if (md > tol * tol) { keep[mk] = 1; stack.push(i, mk, mk, j); }
  }
  const out = []; for (let k = 0; k < n; k++) if (keep[k]) out.push(k);
  return out;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const A = ch(pa), B = ch(pb);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export class MapRenderer {
  constructor(canvas, map) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.map = map;
    this.json = map.json;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.mode = 'political';
    this.cam = { x: 0, y: -7000, s: 0.05 };
    this.static = document.createElement('canvas');
    this.sctx = this.static.getContext('2d', { alpha: false });
    this.staticCam = null;
    this.staticDirty = true;
    this.lastStaticMs = 0;
    this.sel = { state: -1, divs: new Set(), path: null, target: -1, fleet: -1 };
    this.highlight = null; // {states:Set, color}
    this.prep();
  }

  // ───────── 지오메트리 준비 ─────────
  prep() {
    const J = this.json, map = this.map;
    // arcs → 좌표 배열
    this.arcX = []; this.arcY = []; this.arcBox = [];
    for (const a of J.arcs) {
      const n = a.length / 2; const xs = new Float32Array(n), ys = new Float32Array(n);
      let x = 0, y = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < n; i++) { x += a[2 * i]; y += a[2 * i + 1]; xs[i] = x / 10; ys[i] = y / 10; if (xs[i] < x0) x0 = xs[i]; if (xs[i] > x1) x1 = xs[i]; if (ys[i] < y0) y0 = ys[i]; if (ys[i] > y1) y1 = ys[i]; }
      this.arcX.push(xs); this.arcY.push(ys); this.arcBox.push([x0, y0, x1, y1]);
    }
    // LOD 인덱스
    this.arcLod = LOD_TOL.map((tol) => this.arcX.map((xs, i) => dpSimplify(xs, this.arcY[i], tol)));
    this.arcType = J.arcTypes;
    // arc 사용 주
    const users = this.arcX.map(() => []);
    J.states.forEach((s, si) => { for (const poly of s.a) for (const ring of poly) for (const a of ring) users[a < 0 ? ~a : a].push(si); });
    this.arcUsers = users;
    // 주 경로 (LOD별 지연 생성)
    this.stPath = LOD_TOL.map(() => new Array(J.states.length));
    this.stBox = J.states.map((s) => { let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const poly of s.a) for (const ring of poly) for (const a of ring) { const bb = this.arcBox[a < 0 ? ~a : a]; b = [Math.min(b[0], bb[0]), Math.min(b[1], bb[1]), Math.max(b[2], bb[2]), Math.max(b[3], bb[3])]; } return b; });
    this.offPath = LOD_TOL.map(() => null);
    // 호수·하천·산맥·사막·해역선
    const decPoly = (enc) => { const p = new Path2D(); for (const r of enc) { let x = 0, y = 0; for (let i = 0; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; if (i) p.lineTo(x / 10, y / 10); else p.moveTo(x / 10, y / 10); } p.closePath(); } return p; };
    this.lakes = J.lakes.map((l) => decPoly(l.p));
    this.relief = new Path2D(); for (const r of J.relief) this.relief.addPath(decPoly(r.p));
    this.desert = new Path2D(); for (const r of J.deserts) this.desert.addPath(decPoly(r.p));
    this.rivers = J.rivers.map((r) => { const p = new Path2D(); for (let i = 0; i < r.p.length; i += 2) { if (i) p.lineTo(r.p[i], r.p[i + 1]); else p.moveTo(r.p[i], r.p[i + 1]); } return { p, rank: r.r }; });
    this.seaLines = new Path2D(); for (const l of J.seaLines) { for (let i = 0; i < l.length; i += 2) { if (i) this.seaLines.lineTo(l[i], l[i + 1]); else this.seaLines.moveTo(l[i], l[i + 1]); } }
    // 패턴
    this.patterns = {};
    this.noise = this.makeNoise();
    this.reliefPat = this.makeReliefPattern();
    this.desertPat = this.makeDesertPattern();
    this.hatch = new Map();
    // 국가 라벨 캐시
    this.labels = null;
    // 공간 색인 (클릭 판정)
    this.grid = new Map();
    const G = 400;
    this.gridSize = G;
    this.stBox.forEach((b, i) => { for (let gx = Math.floor(b[0] / G); gx <= Math.floor(b[2] / G); gx++) for (let gy = Math.floor(b[1] / G); gy <= Math.floor(b[3] / G); gy++) { const k = gx + ',' + gy; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(i); } });
  }

  ringPath(path, ring, lod) {
    let first = true;
    const L = this.arcLod[lod];
    for (const a of ring) {
      const ai = a < 0 ? ~a : a; const xs = this.arcX[ai], ys = this.arcY[ai]; const idx = L[ai];
      const n = idx ? idx.length : xs.length;
      if (a >= 0) { for (let k = 0; k < n; k++) { const i = idx ? idx[k] : k; if (first) { path.moveTo(xs[i], ys[i]); first = false; } else if (k > 0) path.lineTo(xs[i], ys[i]); } }
      else { for (let k = n - 1; k >= 0; k--) { const i = idx ? idx[k] : k; if (first) { path.moveTo(xs[i], ys[i]); first = false; } else if (k < n - 1) path.lineTo(xs[i], ys[i]); } }
    }
    path.closePath();
  }
  statePath(i, lod) {
    let p = this.stPath[lod][i];
    if (!p) { p = new Path2D(); for (const poly of this.json.states[i].a) for (const ring of poly) this.ringPath(p, ring, lod); this.stPath[lod][i] = p; }
    return p;
  }
  offmapPath(lod) {
    if (!this.offPath[lod]) { const p = new Path2D(); for (const poly of this.json.off) for (const ring of poly) this.ringPath(p, ring, lod); this.offPath[lod] = p; }
    return this.offPath[lod];
  }

  makeNoise() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const img = x.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 70; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    return this.ctx.createPattern(c, 'repeat');
  }
  makeReliefPattern() {
    const c = document.createElement('canvas'); c.width = 22; c.height = 16;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(40,28,14,0.55)'; x.lineWidth = 1.1; x.lineCap = 'round';
    const m = (ox, oy) => { x.beginPath(); x.moveTo(ox - 4, oy + 3); x.lineTo(ox, oy - 2.5); x.lineTo(ox + 4, oy + 3); x.stroke(); x.strokeStyle = 'rgba(255,245,220,0.35)'; x.beginPath(); x.moveTo(ox, oy - 2.5); x.lineTo(ox + 3.2, oy + 2.4); x.stroke(); x.strokeStyle = 'rgba(40,28,14,0.55)'; };
    m(5.5, 5); m(16.5, 12);
    return this.ctx.createPattern(c, 'repeat');
  }
  makeDesertPattern() {
    const c = document.createElement('canvas'); c.width = 14; c.height = 14;
    const x = c.getContext('2d'); x.fillStyle = 'rgba(90,60,20,0.35)';
    for (const [px, py] of [[2, 3], [9, 2], [5, 8], [12, 10], [1, 12]]) { x.beginPath(); x.arc(px, py, 0.7, 0, 7); x.fill(); }
    return this.ctx.createPattern(c, 'repeat');
  }
  hatchPattern(color) {
    let p = this.hatch.get(color);
    if (!p) {
      const c = document.createElement('canvas'); c.width = c.height = 10;
      const x = c.getContext('2d'); x.strokeStyle = color; x.lineWidth = 3.2;
      x.beginPath(); x.moveTo(-2, 12); x.lineTo(12, -2); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(8, 12); x.lineTo(12, 8); x.stroke();
      p = this.ctx.createPattern(c, 'repeat'); this.hatch.set(color, p);
    }
    return p;
  }

  // ───────── 카메라 ─────────
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr); this.canvas.height = Math.round(r.height * this.dpr);
    this.static.width = this.canvas.width; this.static.height = this.canvas.height;
    this.staticDirty = true;
    this.clampCam();
  }
  minScale() { const b = this.map.bounds; return Math.min(this.w / (b[2] - b[0]), this.h / (b[3] - b[1])) * 0.95; }
  clampCam() {
    const b = this.map.bounds, c = this.cam;
    c.s = Math.max(this.minScale(), Math.min(3.2, c.s));
    const hw = this.w / 2 / c.s, hh = this.h / 2 / c.s;
    const cx0 = b[0] + hw, cx1 = b[2] - hw, cy0 = b[1] + hh, cy1 = b[3] - hh;
    c.x = cx0 > cx1 ? (b[0] + b[2]) / 2 : Math.max(cx0, Math.min(cx1, c.x));
    c.y = cy0 > cy1 ? (b[1] + b[3]) / 2 : Math.max(cy0, Math.min(cy1, c.y));
  }
  toScreen(x, y) { const c = this.cam; return [(x - c.x) * c.s + this.w / 2, (y - c.y) * c.s + this.h / 2]; }
  toWorld(sx, sy) { const c = this.cam; return [(sx - this.w / 2) / c.s + c.x, (sy - this.h / 2) / c.s + c.y]; }
  viewBox(m = 0) { const [x0, y0] = this.toWorld(-m, -m), [x1, y1] = this.toWorld(this.w + m, this.h + m); return [x0, y0, x1, y1]; }
  focusOn(x, y, s) { this.cam.x = x; this.cam.y = y; if (s) this.cam.s = s; this.clampCam(); this.staticDirty = true; }
  focusState(i, zoom) { this.focusOn(this.map.lx[i], this.map.ly[i] + (this.h * 0.12) / (zoom || this.cam.s), zoom || Math.max(this.cam.s, 0.35)); }

  // ───────── 클릭 판정 ─────────
  stateAt(sx, sy) {
    const [x, y] = this.toWorld(sx, sy);
    const k = Math.floor(x / this.gridSize) + ',' + Math.floor(y / this.gridSize);
    const cand = this.grid.get(k) || [];
    const ctx = this.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    let hit = -1;
    for (const i of cand) { const b = this.stBox[i]; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (ctx.isPointInPath(this.statePath(i, 1), x, y, 'evenodd')) { hit = i; break; } }
    ctx.restore();
    if (hit < 0) {
      // 작은 섬(지브롤터·몰타 등) 근접 판정
      let best = -1, bd = 18 / this.cam.s;
      for (const i of cand) { const d = Math.hypot(this.map.lx[i] - x, this.map.ly[i] - y); if (this.map.area[i] < 3000 && d < bd) { bd = d; best = i; } }
      hit = best;
    }
    return hit;
  }
  seaAt(sx, sy) { const [x, y] = this.toWorld(sx, sy); return this.map.seaAt(x, y); }

  // ───────── 색상 ─────────
  stateFill(G, i) {
    const S = G.st[i];
    const owner = G.countries[S.owner];
    switch (this.mode) {
      case 'faction': {
        const C = G.countries[S.ctrl];
        if (C?.faction && G.factions[C.faction]) return G.factions[C.faction].color;
        if (C?.master && G.countries[C.master]?.faction) return mix(G.factions[G.countries[C.master].faction].color, '#888888', 0.3);
        return '#8a8676';
      }
      case 'terrain': return TERRAIN[this.map.terrain[i]]?.color || '#999';
      case 'industry': { const f = (S.civ || 0) + (S.mil || 0) * 1.2 + (S.dock || 0); const t = Math.min(1, f / 12); return mix('#3a3f46', '#f0a030', t); }
      case 'supply': {
        const p = G.player; const so = G.supplyOf?.[p];
        if (!(S.ctrl === p || allied(G, p, S.ctrl))) return '#3a3e45';
        const v = so ? so[i] : 1; return v > 0.7 ? '#4f8f3f' : v > 0.45 ? '#9a9a3a' : v > 0.25 ? '#b0702e' : '#9a3030';
      }
      case 'resource': {
        const r = S.res; if (!r) return '#3a3e45';
        let best = null, bv = 0; for (const k in r) if (r[k] > bv) { bv = r[k]; best = k; }
        const col = { oil: '#2b2b2b', steel: '#6d7f99', alu: '#b8bec8', rub: '#4a8a4a', tung: '#8a6aa8', chr: '#5aa0a0' }[best] || '#888';
        return mix('#3a3e45', col, Math.min(1, 0.35 + bv / 20));
      }
      default: return owner?.color || '#888';
    }
  }

  // ───────── 국가 라벨 계산 ─────────
  computeLabels(G) {
    const map = this.map;
    const byC = {};
    for (let i = 0; i < map.nGeo; i++) { const c = G.st[i].ctrl; (byC[c] ||= []).push(i); }
    const out = [];
    for (const tag in byC) {
      const C = G.countries[tag]; if (!C) continue;
      // 연결 덩어리
      const set = new Set(byC[tag]); const seen = new Set();
      for (const s0 of byC[tag]) {
        if (seen.has(s0)) continue;
        const comp = []; const q = [s0]; seen.add(s0);
        while (q.length) { const u = q.pop(); comp.push(u); for (const v of map.nb[u]) if (set.has(v) && !seen.has(v)) { seen.add(v); q.push(v); } }
        const area = comp.reduce((s, i) => s + map.area[i], 0);
        if (area < 25000) continue;
        // 가중 중심 + 주축
        let sw = 0, mx = 0, my = 0;
        for (const i of comp) { const w = map.area[i]; sw += w; mx += map.lx[i] * w; my += map.ly[i] * w; }
        mx /= sw; my /= sw;
        let cxx = 0, cyy = 0, cxy = 0;
        for (const i of comp) { const w = map.area[i]; const dx = map.lx[i] - mx, dy = map.ly[i] - my; cxx += w * dx * dx; cyy += w * dy * dy; cxy += w * dx * dy; }
        let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
        if (comp.length < 3) ang = 0;
        ang = Math.max(-0.6, Math.min(0.6, ang));
        // 중심이 영토 밖이면 가장 큰 주의 라벨 위치
        let inside = comp.some((i) => { const b = this.stBox[i]; return mx >= b[0] && mx <= b[2] && my >= b[1] && my <= b[3]; });
        if (!inside) { const big = comp.reduce((a, b) => (map.area[a] > map.area[b] ? a : b)); mx = map.lx[big]; my = map.ly[big]; }
        const ext = Math.sqrt(cxx / sw) * 2.2 + Math.sqrt(area) * 0.35;
        out.push({ tag, x: mx, y: my, ang, ext, area, name: C.name });
      }
    }
    this.labels = out;
  }

  // ───────── 정적 레이어 ─────────
  renderStatic(G) {
    const t0 = performance.now();
    const ctx = this.sctx, dpr = this.dpr, c = this.cam, map = this.map;
    const W = this.w, H = this.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 바다
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#16303f'); grd.addColorStop(1, '#0f2431');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    const k = c.s * dpr;
    const lod = k < 0.12 ? 2 : k < 0.5 ? 1 : 0;
    const vb = this.viewBox(40);
    const vis = (b) => !(b[2] < vb[0] || b[0] > vb[2] || b[3] < vb[1] || b[1] > vb[3]);
    ctx.setTransform(dpr * c.s, 0, 0, dpr * c.s, dpr * (W / 2 - c.x * c.s), dpr * (H / 2 - c.y * c.s));
    const px = 1 / c.s; // 1 CSS 픽셀의 월드 크기
    // 경위선
    ctx.strokeStyle = 'rgba(180,210,230,0.07)'; ctx.lineWidth = px;
    ctx.beginPath();
    for (let lon = -40; lon <= 80; lon += 10) { const [x] = map.project(lon, 0); ctx.moveTo(x, vb[1]); ctx.lineTo(x, vb[3]); }
    for (let lat = -10; lat <= 80; lat += 10) { const [, y] = map.project(0, lat); ctx.moveTo(vb[0], y); ctx.lineTo(vb[2], y); }
    ctx.stroke();
    // 해역 경계
    ctx.strokeStyle = 'rgba(160,200,225,0.13)'; ctx.lineWidth = 1.2 * px; ctx.setLineDash([5 * px, 5 * px]);
    ctx.stroke(this.seaLines); ctx.setLineDash([]);
    // 해안 빛 번짐 (육지 아래)
    ctx.lineJoin = 'round';
    // 지도 밖 육지
    const off = this.offmapPath(lod);
    ctx.fillStyle = '#3d3a32'; ctx.fill(off, 'evenodd');
    // 해안 글로
    ctx.strokeStyle = 'rgba(150,200,215,0.12)'; ctx.lineWidth = 7 * px;
    ctx.beginPath();
    for (let a = 0; a < this.arcX.length; a++) { const t = this.arcType[a]; if (t !== 'c') continue; if (!vis(this.arcBox[a])) continue; this.arcStroke(ctx, a, lod); }
    ctx.stroke();
    // 주 채우기
    const n = map.nGeo;
    for (let i = 0; i < n; i++) {
      if (!vis(this.stBox[i])) continue;
      const p = this.statePath(i, lod);
      ctx.fillStyle = this.stateFill(G, i);
      ctx.fill(p, 'evenodd');
      const S = G.st[i];
      if (this.mode === 'political' && S.ctrl !== S.owner) {
        const occ = G.countries[S.ctrl]?.color || '#777';
        const pat = this.hatchPattern(occ);
        pat.setTransform?.(new DOMMatrix([1 / c.s, 0, 0, 1 / c.s, 0, 0]));
        ctx.fillStyle = pat;
        ctx.fill(p, 'evenodd');
      }
    }
    // 종이 질감
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = this.noise; ctx.fillRect(0, 0, W * dpr, H * dpr); ctx.restore();
    ctx.setTransform(dpr * c.s, 0, 0, dpr * c.s, dpr * (W / 2 - c.x * c.s), dpr * (H / 2 - c.y * c.s));
    // 지형 질감
    if (this.mode !== 'industry' && this.mode !== 'supply') {
      const m = new DOMMatrix([1 / c.s, 0, 0, 1 / c.s, 0, 0]);
      this.reliefPat.setTransform?.(m); this.desertPat.setTransform?.(m);
      ctx.globalAlpha = Math.min(0.7, 0.25 + c.s * 2);
      ctx.fillStyle = this.reliefPat; ctx.fill(this.relief, 'evenodd');
      ctx.globalAlpha = 0.5; ctx.fillStyle = this.desertPat; ctx.fill(this.desert, 'evenodd');
      ctx.globalAlpha = 1;
    }
    // 호수
    ctx.fillStyle = '#1a3646'; ctx.strokeStyle = 'rgba(10,25,35,0.6)'; ctx.lineWidth = 0.8 * px;
    for (const l of this.lakes) { ctx.fill(l, 'evenodd'); ctx.stroke(l); }
    // 하천
    if (k > 0.05) {
      ctx.lineCap = 'round';
      for (const r of this.rivers) {
        const w = (r.rank <= 2 ? 1.9 : r.rank <= 4 ? 1.3 : 0.9) * Math.max(0.6, Math.min(1.6, c.s * 3));
        if (r.rank > 5 && c.s < 0.15) continue;
        ctx.strokeStyle = 'rgba(40,90,120,0.85)'; ctx.lineWidth = w * px; ctx.stroke(r.p);
      }
    }
    // 경계선
    const lodB = lod;
    const borderInner = new Path2D(), borderCountry = new Path2D(), coast = new Path2D(), front = new Path2D();
    for (let a = 0; a < this.arcX.length; a++) {
      if (!vis(this.arcBox[a])) continue;
      const t = this.arcType[a];
      const u = this.arcUsers[a];
      if (t === 'c') { this.arcStroke(coast, a, lodB); continue; }
      if (u.length < 2) { if (t === 'f') this.arcStroke(coast, a, lodB); continue; }
      const A = G.st[u[0]], B = G.st[u[1]];
      if (A.ctrl !== B.ctrl && atWar(G, A.ctrl, B.ctrl)) this.arcStroke(front, a, lodB);
      else if (A.owner !== B.owner) this.arcStroke(borderCountry, a, lodB);
      else if (c.s > 0.06) this.arcStroke(borderInner, a, lodB);
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(15,20,25,0.65)'; ctx.lineWidth = 0.9 * px; ctx.stroke(coast);
    ctx.strokeStyle = 'rgba(20,20,20,0.28)'; ctx.lineWidth = Math.min(1.1, 0.4 + c.s) * px; ctx.stroke(borderInner);
    ctx.strokeStyle = 'rgba(12,12,12,0.85)'; ctx.lineWidth = 2.2 * px; ctx.stroke(borderCountry);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.7 * px; ctx.stroke(borderCountry);
    if (this.mode === 'political' || this.mode === 'faction') {
      ctx.strokeStyle = 'rgba(30,5,5,0.9)'; ctx.lineWidth = 3 * px; ctx.stroke(front);
      ctx.strokeStyle = 'rgba(220,70,55,0.95)'; ctx.lineWidth = 1.6 * px; ctx.stroke(front);
    } else { ctx.strokeStyle = 'rgba(12,12,12,0.85)'; ctx.lineWidth = 2 * px; ctx.stroke(front); }
    // 라벨 (화면 좌표)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawLabels(G, ctx);
    // 비네트
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    this.staticCam = { ...c };
    this.staticDirty = false;
    this.lastStaticMs = performance.now() - t0;
  }

  arcStroke(path, a, lod) {
    const xs = this.arcX[a], ys = this.arcY[a], idx = this.arcLod[lod][a];
    const n = idx ? idx.length : xs.length;
    for (let k = 0; k < n; k++) { const i = idx ? idx[k] : k; if (k) path.lineTo(xs[i], ys[i]); else path.moveTo(xs[i], ys[i]); }
  }

  drawLabels(G, ctx) {
    if (this.showLabels === false) return;
    const c = this.cam, map = this.map;
    if (!this.labels) this.computeLabels(G);
    const serif = '"AppleMyungjo","Nanum Myeongjo","Noto Serif KR",serif';
    // 해역 이름
    if (c.s > 0.035 && c.s < 0.6) {
      ctx.font = `italic ${Math.round(11 + Math.min(4, c.s * 20))}px ${serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(170,205,225,0.45)';
      for (const z of map.seas) { const [x, y] = this.toScreen(z.lx, z.ly); if (x < -50 || y < -20 || x > this.w + 50 || y > this.h + 20) continue; ctx.fillText(z.name, x, y); }
    }
    // 국가 이름
    if (c.s < 0.42) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const L of this.labels) {
        const extPx = L.ext * c.s;
        if (extPx < 46) continue;
        const [x, y] = this.toScreen(L.x, L.y);
        if (x < -200 || y < -60 || x > this.w + 200 || y > this.h + 60) continue;
        const chars = [...L.name];
        let fs = Math.min(40, Math.max(10, (extPx * 0.9) / (chars.length * 1.35)));
        const alpha = c.s > 0.3 ? Math.max(0, 1 - (c.s - 0.3) / 0.12) : 1;
        if (alpha <= 0) continue;
        ctx.save(); ctx.translate(x, y); ctx.rotate(L.ang); ctx.globalAlpha = alpha * 0.92;
        ctx.font = `700 ${fs.toFixed(1)}px ${serif}`;
        const spacing = fs * 0.35;
        const widths = chars.map((ch) => ctx.measureText(ch).width);
        const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
        let xx = -total / 2;
        ctx.lineJoin = 'round';
        for (let k = 0; k < chars.length; k++) {
          const cx = xx + widths[k] / 2;
          ctx.strokeStyle = 'rgba(10,10,10,0.55)'; ctx.lineWidth = Math.max(2, fs * 0.16); ctx.strokeText(chars[k], cx, 0);
          ctx.fillStyle = 'rgba(245,238,220,0.92)'; ctx.fillText(chars[k], cx, 0);
          xx += widths[k] + spacing;
        }
        ctx.restore();
      }
    }
    // 주 이름 · 도시
    if (c.s > 0.14) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.round(Math.min(14, 9 + c.s * 6));
      ctx.font = `600 ${fs}px -apple-system,"Apple SD Gothic Neo",sans-serif`;
      for (let i = 0; i < map.nGeo; i++) {
        const b = this.stBox[i];
        const sw = (b[2] - b[0]) * c.s;
        const [x, y] = this.toScreen(map.lx[i], map.ly[i]);
        if (x < -60 || y < -20 || x > this.w + 60 || y > this.h + 20) continue;
        const S = G.st[i];
        // 도시 점
        const [cx, cy] = this.toScreen(map.cx[i], map.cy[i]);
        const isCap = G.countries[S.owner]?.capital === i;
        if (S.vp >= 5 || isCap) {
          ctx.fillStyle = 'rgba(20,20,20,0.85)'; ctx.fillRect(cx - 3, cy - 3, 6, 6);
          ctx.fillStyle = isCap ? '#f0cf70' : '#e8e2d2'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
        }
        if (sw < fs * 3.2 && map.area[i] > 3000) continue;
        if (c.s < 0.24 && S.vp < 5 && !isCap) continue;
        const name = map.name[i];
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.strokeText(name, x, y + (S.vp >= 5 ? 11 : 0));
        ctx.fillStyle = 'rgba(240,235,222,0.9)'; ctx.fillText(name, x, y + (S.vp >= 5 ? 11 : 0));
        if (this.mode === 'industry') { const f = `${S.civ || 0}/${S.mil || 0}${S.dock ? '/' + S.dock : ''}`; ctx.fillStyle = '#ffd890'; ctx.fillText(f, x, y + (S.vp >= 5 ? 24 : 13)); }
      }
    }
  }

  // ───────── 프레임 ─────────
  render(G, app) {
    const ctx = this.ctx, dpr = this.dpr, c = this.cam;
    const gesturing = app?.gesturing;
    const camChanged = !this.staticCam || this.staticCam.x !== c.x || this.staticCam.y !== c.y || this.staticCam.s !== c.s;
    if (this.staticDirty || (camChanged && (!gesturing || this.lastStaticMs < 14 || (performance.now() - (this._lastStaticAt || 0)) > 220))) {
      this.renderStatic(G);
      this._lastStaticAt = performance.now();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.staticCam && (this.staticCam.x !== c.x || this.staticCam.y !== c.y || this.staticCam.s !== c.s)) {
      // 변환해서 그림
      ctx.fillStyle = '#10202e'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const k = c.s / this.staticCam.s;
      const dx = (this.w / 2 - this.staticCam.x * c.s + (this.staticCam.x - this.staticCam.x) * 0) - (this.w / 2 - this.staticCam.x * this.staticCam.s) * k;
      // 정적 화면의 월드 원점 → 현재 화면
      const ox = (this.w / 2 - c.x * c.s) - (this.w / 2 - this.staticCam.x * this.staticCam.s) * k;
      const oy = (this.h / 2 - c.y * c.s) - (this.h / 2 - this.staticCam.y * this.staticCam.s) * k;
      ctx.drawImage(this.static, ox * dpr, oy * dpr, this.static.width * k, this.static.height * k);
    } else ctx.drawImage(this.static, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawDynamic(G, ctx, app);
  }

  // ───────── 동적 레이어: 선택·부대·전투·화살표 ─────────
  drawDynamic(G, ctx, app) {
    const c = this.cam, map = this.map;
    const player = G.player;
    const sel = this.sel;
    const now = performance.now();
    // 강조(선택 주)
    if (this.highlight?.states?.size) {
      ctx.save();
      ctx.setTransform(this.dpr * c.s, 0, 0, this.dpr * c.s, this.dpr * (this.w / 2 - c.x * c.s), this.dpr * (this.h / 2 - c.y * c.s));
      ctx.fillStyle = this.highlight.color || 'rgba(255,220,120,0.18)';
      for (const i of this.highlight.states) if (i < map.nGeo) ctx.fill(this.statePath(i, 1), 'evenodd');
      ctx.restore();
    }
    if (sel.state >= 0 && sel.state < map.nGeo) {
      ctx.save();
      ctx.setTransform(this.dpr * c.s, 0, 0, this.dpr * c.s, this.dpr * (this.w / 2 - c.x * c.s), this.dpr * (this.h / 2 - c.y * c.s));
      const p = this.statePath(sel.state, c.s * this.dpr < 0.5 ? 1 : 0);
      ctx.fillStyle = 'rgba(255,230,150,0.16)'; ctx.fill(p, 'evenodd');
      ctx.strokeStyle = 'rgba(255,225,140,0.95)'; ctx.lineWidth = 2.2 / c.s; ctx.lineJoin = 'round'; ctx.stroke(p);
      ctx.restore();
    }
    // 이동 경로 미리보기
    if (sel.path && sel.path.length) this.drawArrowPath(ctx, sel.pathFrom, sel.path, 'rgba(255,220,120,0.95)', 3.2, true);
    // 공세 목표(원작의 공세선): 군에서 목표 주까지 굵은 점선 화살표 — 공세 중이면 붉게, 방어 중(계획만)이면 옅게
    for (const id in G.armies) {
      const A = G.armies[id];
      if (A.tag !== player || !A.auto || !(A.goal >= 0)) continue;
      let from = -1, best = Infinity;
      for (const did of A.divs) { const D = G.divs[did]; if (!D || D.sea) continue; const d = map.dist(D.loc, A.goal); if (d < best) { best = d; from = D.loc; } }
      if (from >= 0 && from !== A.goal) this.drawArrowPath(ctx, from, [A.goal], A.order === 'attack' ? 'rgba(240,110,60,0.9)' : 'rgba(235,205,130,0.7)', 5, true);
    }
    // 아군 이동/공격 화살표
    const zoomShowAll = c.s > 0.12;
    const arrowsDrawn = new Set();
    for (const id in G.divs) {
      const D = G.divs[id];
      const mine = D.tag === player;
      if (!mine && !zoomShowAll) continue;
      if (D.att >= 0) {
        const key = D.loc + '>' + D.att; if (arrowsDrawn.has(key)) continue; arrowsDrawn.add(key);
        this.drawArrowPath(ctx, D.loc, [D.att], mine ? 'rgba(235,80,60,0.95)' : 'rgba(200,60,50,0.55)', mine ? 3 : 2, false);
      } else if (mine && D.path.length) {
        const key = D.loc + '>' + D.path.join(','); if (arrowsDrawn.has(key)) continue; arrowsDrawn.add(key);
        this.drawArrowPath(ctx, D.loc, D.path, sel.divs.has(D.id) ? 'rgba(255,230,140,0.95)' : 'rgba(150,220,120,0.85)', 2.4, false, D.prog);
      }
    }
    // 해군
    this.drawFleets(G, ctx);
    // 부대 카운터
    this.drawUnits(G, ctx, app);
    // 전투
    for (const k in G.battles) {
      const B = G.battles[k];
      const t = +k;
      const from = B.dirs?.[0] ?? t;
      const [x1, y1] = this.toScreen(map.lx[from], map.ly[from]); const [x2, y2] = this.toScreen(map.lx[t], map.ly[t]);
      let x = (x1 + x2) / 2, y = (y1 + y2) / 2;
      if (x < -30 || y < -30 || x > this.w + 30 || y > this.h + 30) continue;
      const playerSide = B.atkTag === player || allied(G, player, B.atkTag) ? 'atk' : (B.defTag === player || allied(G, player, B.defTag)) ? 'def' : null;
      const win = playerSide === 'def' ? 1 - B.win : B.win;
      const r = c.s > 0.2 ? 13 : 10;
      const pulse = 1 + Math.sin(now / 260) * 0.06;
      ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = playerSide ? (win >= 0.5 ? 'rgba(40,90,40,0.95)' : 'rgba(120,30,25,0.95)') : 'rgba(60,60,60,0.9)';
      ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,230,170,0.9)'; ctx.stroke();
      // 교차 칼
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.45); ctx.lineTo(r * 0.45, r * 0.45); ctx.moveTo(r * 0.45, -r * 0.45); ctx.lineTo(-r * 0.45, r * 0.45); ctx.stroke();
      ctx.restore();
      if (playerSide) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 14, y + r + 3, 28, 4);
        ctx.fillStyle = win >= 0.5 ? '#7fd36b' : '#e2625a'; ctx.fillRect(x - 14, y + r + 3, 28 * win, 4);
      }
    }
  }

  drawArrowPath(ctx, from, path, color, width, dashed, prog) {
    const map = this.map;
    const pts = [from, ...path].map((i) => this.toScreen(map.lx[i], map.ly[i]));
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = width + 2.4;
    if (dashed) ctx.setLineDash([8, 6]);
    const curve = () => {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const mx = (ax + bx) / 2 - (by - ay) * 0.12, my = (ay + by) / 2 + (bx - ax) * 0.12;
        ctx.quadraticCurveTo(mx, my, bx - (bx - ax) * (i === pts.length - 1 ? 0.12 : 0), by - (by - ay) * (i === pts.length - 1 ? 0.12 : 0));
      }
    };
    curve(); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width; curve(); ctx.stroke();
    ctx.setLineDash([]);
    // 화살촉
    const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1];
    const ex = bx - (bx - ax) * 0.12, ey = by - (by - ay) * 0.12;
    const ang = Math.atan2(ey - (ay + by) / 2 - (bx - ax) * 0.12 * 0, ex - (ax + bx) / 2);
    const a2 = Math.atan2(by - ay, bx - ax);
    ctx.translate(ex, ey); ctx.rotate(a2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-9, -7); ctx.lineTo(-9, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(2.5, 0); ctx.lineTo(-8, -5.5); ctx.lineTo(-8, 5.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  unitStacks(G) {
    // 주별 · 국가별 묶음 (이동 중인 사단은 진행 위치에 표시)
    const stacks = new Map();
    for (const id in G.divs) {
      const D = G.divs[id];
      if (D.sea) continue;
      let x = this.map.lx[D.loc], y = this.map.ly[D.loc];
      let key = D.loc + ':' + D.tag;
      if (D.path.length && D.att < 0 && D.prog > 0) {
        const nx = this.map.lx[D.path[0]], ny = this.map.ly[D.path[0]];
        const L = Math.max(1, this.map.dist(D.loc, D.path[0]) * 1.2);
        const t = Math.min(0.85, D.prog / L);
        x += (nx - x) * t; y += (ny - y) * t;
        key = D.loc + '>' + D.path[0] + ':' + D.tag + ':' + Math.round(t * 4);
      }
      let s = stacks.get(key);
      if (!s) { s = { key, loc: D.loc, tag: D.tag, x, y, divs: [], moving: D.path.length > 0 && D.att < 0 }; stacks.set(key, s); }
      s.divs.push(D);
    }
    return [...stacks.values()];
  }

  drawUnits(G, ctx, app) {
    const c = this.cam, player = G.player;
    const scale = Math.max(0.78, Math.min(1.15, 0.7 + c.s * 1.2));
    const W = 34 * scale, H = 20 * scale;
    this._stacks = [];
    // 표시 대상: 자국·교전국은 항상, 우방은 중간 확대부터, 그 밖은 크게 확대했을 때만
    const vis = [];
    for (const s of this.unitStacks(G)) {
      const mine = s.tag === player;
      const enemy = !mine && atWar(G, player, s.tag);
      const ally = !mine && !enemy && allied(G, player, s.tag);
      if (!mine && !enemy && !(ally ? c.s > 0.1 : c.s > 0.32)) continue;
      const [x, y] = this.toScreen(s.x, s.y);
      if (x < -80 || y < -50 || x > this.w + 80 || y > this.h + 50) continue;
      vis.push({ key: s.key, loc: s.loc, tag: s.tag, moving: s.moving, divs: s.divs.slice(), sx: x, sy: y + 14 * scale });
    }
    // 화면에서 겹치는 같은 국가 묶음은 하나로 합침 (축소 시 전략 지도처럼)
    vis.sort((a, b) => b.divs.length - a.divs.length);
    const clusters = [];
    for (const s of vis) {
      const m = clusters.find((k) => k.tag === s.tag && Math.abs(k.sx - s.sx) < W * 0.95 && Math.abs(k.sy - s.sy) < H * 1.15);
      if (m) { m.divs.push(...s.divs); m.moving = m.moving && s.moving; continue; }
      clusters.push(s);
    }
    // 다른 국가 묶음끼리 겹치면 옆으로 비킴
    const placed = [];
    for (const k of clusters) {
      let x = k.sx; const y = k.sy;
      for (let t = 0; t < 4; t++) { const hit = placed.find((p) => Math.abs(p.x - x) < W + 1 && Math.abs(p.y - y) < H + 1); if (!hit) break; x = hit.x + W + 2; }
      placed.push({ x, y }); k.dx = x; k.dy = y;
    }
    for (const s of clusters) {
      const x = s.dx, y = s.dy;
      if (x < -W || y < -H || x > this.w + W || y > this.h + H) continue;
      const mine = s.tag === player;
      const C = G.countries[s.tag];
      const n = s.divs.length;
      let org = 0, orgMax = 0, str = 0, armored = 0, mot = 0, inBattle = false;
      for (const D of s.divs) { const st = divStats(G, D); org += D.org; orgMax += st.org || 1; str += D.str; if (st.armored) armored++; else if (st.motorized) mot++; if (D.att >= 0 || G.battles[D.loc]) inBattle = true; }
      const kind = armored >= n / 2 ? 'arm' : mot >= n / 2 ? 'mot' : 'inf';
      const selected = mine && s.divs.some((D) => this.sel.divs.has(D.id));
      // 몸체
      ctx.save(); ctx.translate(x - W / 2, y - H / 2);
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5;
      ctx.fillStyle = shade(C?.color || '#777777', -0.25);
      roundRect(ctx, 0, 0, W, H, 3.5); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeStyle = selected ? '#ffe08a' : inBattle ? '#ff6a5a' : mine ? 'rgba(255,240,200,0.75)' : 'rgba(0,0,0,0.8)';
      roundRect(ctx, 0, 0, W, H, 3.5); ctx.stroke();
      // NATO 기호
      const bx = 3 * scale, by = 3 * scale, bw = 15 * scale, bh = H - 6 * scale - 3;
      ctx.fillStyle = 'rgba(245,240,225,0.95)'; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (kind === 'arm') { ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.34, bh * 0.28, 0, 0, Math.PI * 2); }
      else { ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by + bh); ctx.moveTo(bx + bw, by); ctx.lineTo(bx, by + bh); if (kind === 'mot') { ctx.moveTo(bx + bw * 0.25, by + bh + 1.5); ctx.arc(bx + bw * 0.25, by + bh + 1.5, 0.1, 0, 7); } }
      ctx.stroke();
      // 사단 수
      ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round((n >= 10 ? 10 : 11) * scale)}px -apple-system,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), bx + bw + (W - bx - bw) / 2, by + bh / 2 + 0.5);
      // 막대
      const of = Math.max(0, Math.min(1, org / orgMax)), sf = str / n;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(2, H - 4.5, W - 4, 3.5);
      ctx.fillStyle = of > 0.5 ? '#78c95f' : of > 0.25 ? '#d6b84a' : '#e05a4c'; ctx.fillRect(2, H - 4.5, (W - 4) * of, 1.6);
      ctx.fillStyle = '#c9c4b4'; ctx.fillRect(2, H - 2.6, (W - 4) * sf, 1.4);
      ctx.restore();
      this._stacks.push({ x0: x - W / 2, y0: y - H / 2, x1: x + W / 2, y1: y + H / 2, s });
    }
  }

  drawFleets(G, ctx) {
    const map = this.map, player = G.player, c = this.cam;
    if (c.s < 0.04) return;
    const byZone = new Map();
    for (const id in G.fleets) { const F = G.fleets[id]; const k = F.loc + ':' + F.tag; if (!byZone.has(k)) byZone.set(k, []); byZone.get(k).push(F); }
    this._fleetHits = [];
    let k2 = 0;
    for (const [key, list] of byZone) {
      const F = list[0];
      const mine = F.tag === player;
      if (!mine && !atWar(G, player, F.tag) && c.s < 0.2) continue;
      const z = map.seas[F.loc]; if (!z) continue;
      let [x, y] = this.toScreen(z.lx, z.ly);
      y += 16 + ((k2++ % 3) * 6);
      if (x < -30 || y < -30 || x > this.w + 30 || y > this.h + 30) continue;
      const ships = list.reduce((s, f) => s + fleetSize(f), 0);
      const C = G.countries[F.tag];
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = shade(C?.color || '#777777', -0.3); ctx.strokeStyle = mine ? '#ffe08a' : 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-15, -3); ctx.lineTo(15, -3); ctx.lineTo(11, 6); ctx.lineTo(-11, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(-5, -8, 9, 5);
      ctx.fillStyle = '#fff'; ctx.font = '700 9px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(ships), 0, 1.5);
      ctx.restore();
      this._fleetHits.push({ x, y, list });
    }
    // 해상 수송 중인 사단
    for (const id in G.divs) {
      const D = G.divs[id]; if (!D.sea || D.tag !== player) continue;
      const t = Math.min(1, Math.max(0, 1 - (D.sea.eta - G.hour) / 72));
      const [x1, y1] = this.toScreen(map.lx[D.loc], map.ly[D.loc]), [x2, y2] = this.toScreen(map.lx[D.sea.to], map.ly[D.sea.to]);
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      ctx.fillStyle = 'rgba(255,230,150,0.9)'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    }
  }

  unitAt(sx, sy) {
    for (let i = (this._stacks || []).length - 1; i >= 0; i--) { const b = this._stacks[i]; if (sx >= b.x0 - 4 && sx <= b.x1 + 4 && sy >= b.y0 - 4 && sy <= b.y1 + 4) return b.s; }
    return null;
  }
  fleetAt(sx, sy) { for (const f of this._fleetHits || []) if (Math.abs(sx - f.x) < 18 && Math.abs(sy - f.y) < 12) return f; return null; }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

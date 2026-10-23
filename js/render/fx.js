// 시각 효과: 입자(피·불꽃·얼음·연기), 떠오르는 글자, 번개, 고리, 투사체·장판 그리기
import { TW, TH } from '../core/util.js';
import { glowSprite } from './tiles.js';

const PI = Math.PI;
const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(r) {
    this.r = r;
    this.ps = []; // 입자
    this.texts = [];
    this.rings = [];
    this.flashes = [];
    this.bolts = [];
    this.shakeT = 0; this.shakeA = 0;
    this.game = null;
    this.maxP = 900;
  }
  clear() { this.ps.length = 0; this.texts.length = 0; this.rings.length = 0; this.flashes.length = 0; this.bolts.length = 0; }

  // ───────── 생성 ─────────
  p(x, y, z, o) {
    if (this.ps.length >= this.maxP) this.ps.shift();
    const q = { x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 0.6, max: o.life || 0.6, size: o.size || 2, col: o.col || [255, 255, 255], glow: !!o.glow, grav: o.grav ?? 0, drag: o.drag ?? 0.9, kind: o.kind || 'dot', ground: o.ground || false, fade: o.fade ?? 1, grow: o.grow || 0 };
    this.ps.push(q);
    return q;
  }
  burst(x, y, z, n, o) {
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? rnd(0, PI * 2)) + rnd(-(o.spread ?? PI), o.spread ?? PI), sp = rnd(o.spd?.[0] ?? 0.5, o.spd?.[1] ?? 2.5);
      this.p(x + rnd(-0.1, 0.1), y + rnd(-0.1, 0.1), z + rnd(-4, 4), { ...o, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(o.vz?.[0] ?? 10, o.vz?.[1] ?? 60), life: rnd((o.life ?? 0.6) * 0.6, o.life ?? 0.6), size: rnd((o.size ?? 2) * 0.6, o.size ?? 2) });
    }
  }
  blood(x, y, z, dir, n = 8, col = [150, 10, 8]) {
    this.burst(x, y, z, n, { dir, spread: 0.9, spd: [0.8, 3.2], vz: [20, 80], life: 0.55, size: 2.4, col, grav: 260, kind: 'blood' });
  }
  sparks(x, y, z, n = 6, col = [255, 220, 150]) {
    this.burst(x, y, z, n, { spd: [1.5, 4], vz: [20, 90], life: 0.35, size: 1.6, col, grav: 200, glow: true, kind: 'spark' });
  }
  bone(x, y, z, n = 6) { this.burst(x, y, z, n, { spd: [0.6, 2.4], vz: [30, 90], life: 0.7, size: 2.2, col: [220, 210, 190], grav: 300, kind: 'shard' }); }
  smoke(x, y, z, n = 4, col = [60, 55, 50]) { for (let i = 0; i < n; i++) this.p(x + rnd(-0.2, 0.2), y + rnd(-0.2, 0.2), z, { vz: rnd(15, 35), life: rnd(0.8, 1.4), size: rnd(4, 7), col, kind: 'smoke', grow: 6, drag: 0.95 }); }
  fire(x, y, z, n = 3, col = [255, 130, 40]) { for (let i = 0; i < n; i++) this.p(x + rnd(-0.15, 0.15), y + rnd(-0.15, 0.15), z + rnd(0, 6), { vz: rnd(25, 60), vx: rnd(-0.2, 0.2), vy: rnd(-0.2, 0.2), life: rnd(0.3, 0.6), size: rnd(3, 5), col, glow: true, kind: 'flame', grow: -3 }); }
  frost(x, y, z, n = 6) { this.burst(x, y, z, n, { spd: [0.6, 2.2], vz: [10, 60], life: 0.6, size: 2, col: [170, 220, 255], grav: 120, glow: true, kind: 'shard' }); }
  poisonCloud(x, y, n = 3) { for (let i = 0; i < n; i++) this.p(x + rnd(-0.6, 0.6), y + rnd(-0.6, 0.6), rnd(2, 12), { vz: rnd(4, 12), life: rnd(0.8, 1.4), size: rnd(5, 9), col: [80, 190, 50], glow: true, kind: 'smoke', grow: 8, fade: 0.35 }); }
  magic(x, y, z, n = 10, col = [140, 180, 255]) { this.burst(x, y, z, n, { spd: [0.3, 1.6], vz: [20, 70], life: 0.8, size: 2, col, grav: -20, glow: true, kind: 'spark' }); }
  levelUp(x, y) {
    for (let i = 0; i < 40; i++) { const a = rnd(0, PI * 2), r = rnd(0, 0.6); this.p(x + Math.cos(a) * r, y + Math.sin(a) * r, rnd(0, 10), { vz: rnd(40, 120), life: rnd(0.8, 1.6), size: rnd(1.5, 3), col: [255, 230, 140], glow: true, kind: 'spark', drag: 0.98 }); }
    this.ring(x, y, 0.2, 2.2, 0.8, [255, 220, 120], 3);
    this.flash(x, y, 4, [255, 220, 140], 0.6);
  }
  text(x, y, txt, col = '#fff', size = 13, z = 70, dur = 1.1) {
    this.texts.push({ x: x + rnd(-0.15, 0.15), y: y + rnd(-0.15, 0.15), z, txt: String(txt), col, size, t: 0, dur });
    if (this.texts.length > 40) this.texts.shift();
  }
  ring(x, y, r0, r1, dur, col, w = 2, filled = false) { this.rings.push({ x, y, r0, r1, dur, t: 0, col, w, filled }); }
  flash(x, y, r, col, dur = 0.3, z = 20) { this.flashes.push({ x, y, r, col, dur, t: 0, z }); }
  bolt(x0, y0, z0, x1, y1, z1, col = [170, 200, 255], dur = 0.2, w = 2) {
    // 들쭉날쭉한 번개 선분
    const pts = [], n = Math.max(3, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3));
    for (let i = 0; i <= n; i++) { const t = i / n, j = i && i < n ? 1 : 0; pts.push([x0 + (x1 - x0) * t + rnd(-0.18, 0.18) * j, y0 + (y1 - y0) * t + rnd(-0.18, 0.18) * j, z0 + (z1 - z0) * t + rnd(-8, 8) * j]); }
    this.bolts.push({ pts, col, dur, t: 0, w });
  }
  explosion(x, y, r = 1.5, col = [255, 140, 40], kind = 'fire') {
    this.flash(x, y, r * 2.5, col, 0.35);
    this.ring(x, y, 0.2, r, 0.35, col, 3);
    const n = Math.round(14 * r);
    this.burst(x, y, 10, n, { spd: [1, 4 * r], vz: [20, 120], life: 0.6, size: 3.5, col, glow: true, grav: 100, kind: kind === 'fire' ? 'flame' : 'spark', grow: -2 });
    if (kind === 'fire') this.smoke(x, y, 15, 4);
    this.shake(0.15 * r);
    if (this.game?.level) this.game.level.decals.push({ x, y, kind: 'scorch', rot: rnd(0, 6), s: r * 0.8, a: 0.9, life: 20 });
  }
  shake(a) { this.shakeA = Math.max(this.shakeA, Math.min(1, a)); this.shakeT = 0.25; }

  update(dt, game) {
    this.game = game;
    const L = game.level;
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const q = this.ps[i];
      q.life -= dt;
      if (q.life <= 0) { this.ps[i] = this.ps[this.ps.length - 1]; this.ps.pop(); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.vz -= q.grav * dt;
      const d = Math.pow(q.drag, dt * 60); q.vx *= d; q.vy *= d; if (!q.grav) q.vz *= d;
      q.size = Math.max(0.3, q.size + q.grow * dt);
      if (q.z < 0) {
        q.z = 0; q.vz = 0; q.vx *= 0.5; q.vy *= 0.5;
        if (q.kind === 'blood' && L && Math.random() < 0.35 && L.decals.length < 400) L.decals.push({ x: q.x, y: q.y, kind: 'blood', rot: rnd(0, 6), s: rnd(0.25, 0.6), life: 30, col: q.col[1] > 100 ? `rgba(${q.col[0]},${q.col[1]},${q.col[2]},0.6)` : undefined });
        if (q.kind === 'blood' || q.kind === 'shard') q.life = Math.min(q.life, 0.15);
      }
    }
    for (const arr of [this.texts, this.rings, this.flashes, this.bolts]) {
      for (let i = arr.length - 1; i >= 0; i--) { arr[i].t += dt; if (arr[i].t >= arr[i].dur) arr.splice(i, 1); }
    }
    // 바닥 장식 수명
    if (L) for (let i = L.decals.length - 1; i >= 0; i--) {
      const d = L.decals[i];
      if (d.keep || d.life == null) continue;
      d.life -= dt;
      if (d.life < 5) d.a = Math.max(0, d.life / 5) * (d.a0 ?? (d.a0 = d.a ?? 1));
      if (d.life <= 0) L.decals.splice(i, 1);
    }
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }
    // 투사체 꼬리
    if (L) for (const m of L.missiles) this.trail(m, dt);
    if (L) for (const ar of L.areas) this.areaFx(ar, dt);
  }
  shakeOffset() {
    if (this.shakeA <= 0) return [0, 0];
    const a = this.shakeA * 6 * (this.shakeT / 0.25);
    return [rnd(-a, a), rnd(-a, a)];
  }

  trail(m, dt) {
    m._tr = (m._tr || 0) + dt;
    const k = m.vis;
    if (k === 'fire' || k === 'fireball' || k === 'meteor') { if (m._tr > 0.02) { m._tr = 0; this.fire(m.x, m.y, m.z, k === 'fireball' ? 2 : 1); } }
    else if (k === 'ice' || k === 'orb') { if (m._tr > 0.03) { m._tr = 0; this.p(m.x, m.y, m.z, { life: 0.4, size: 2.2, col: [170, 220, 255], glow: true, vz: rnd(-10, 10), kind: 'spark' }); } }
    else if (k === 'magic' || k === 'holy') { if (m._tr > 0.03) { m._tr = 0; this.p(m.x, m.y, m.z, { life: 0.35, size: 2, col: k === 'holy' ? [255, 240, 180] : [150, 170, 255], glow: true, kind: 'spark' }); } }
    else if (k === 'acid' || k === 'poison') { if (m._tr > 0.04) { m._tr = 0; this.p(m.x, m.y, m.z, { life: 0.5, size: 2.4, col: [110, 220, 60], glow: true, grav: 80, kind: 'blood' }); } }
    else if (k === 'blood') { if (m._tr > 0.03) { m._tr = 0; this.p(m.x, m.y, m.z, { life: 0.4, size: 2.4, col: [255, 40, 40], glow: true, kind: 'spark' }); } }
    else if (k === 'charged') { if (m._tr > 0.05) { m._tr = 0; this.p(m.x, m.y, m.z, { life: 0.2, size: 1.6, col: [200, 220, 255], glow: true, kind: 'spark' }); } }
    else if (k === 'arrow_fire') { if (m._tr > 0.03) { m._tr = 0; this.fire(m.x, m.y, m.z, 1); } }
    else if (k === 'arrow_ice') { if (m._tr > 0.04) { m._tr = 0; this.p(m.x, m.y, m.z, { life: 0.3, size: 1.8, col: [170, 220, 255], glow: true, kind: 'spark' }); } }
    else if (k === 'shadow') { if (m._tr > 0.03) { m._tr = 0; this.p(m.x, m.y, m.z, { life: 0.4, size: 3, col: [120, 60, 160], glow: true, kind: 'smoke', grow: 3 }); } }
  }
  areaFx(ar, dt) {
    ar._fx = (ar._fx || 0) + dt;
    if (ar.vis === 'firewall') { if (ar._fx > 0.05) { ar._fx = 0; for (const c of ar.cells || []) if (Math.random() < 0.45) this.fire(c[0], c[1], 0, 1); } }
    else if (ar.vis === 'blizzard') { if (ar._fx > 0.03) { ar._fx = 0; const a = rnd(0, PI * 2), r = rnd(0, ar.r); this.p(ar.x + Math.cos(a) * r - 0.6, ar.y + Math.sin(a) * r - 0.6, 90, { vx: 1.6, vy: 1.6, vz: -200, life: 0.5, size: 2.4, col: [190, 230, 255], glow: true, kind: 'shard' }); } }
    else if (ar.vis === 'poison') { if (ar._fx > 0.1) { ar._fx = 0; this.poisonCloud(ar.x, ar.y, 1); } }
    else if (ar.vis === 'burning') { if (ar._fx > 0.06) { ar._fx = 0; const a = rnd(0, PI * 2), r = rnd(0, ar.r); this.fire(ar.x + Math.cos(a) * r, ar.y + Math.sin(a) * r, 0, 1); } }
    else if (ar.vis === 'acidpool') { if (ar._fx > 0.3) { ar._fx = 0; this.p(ar.x + rnd(-0.4, 0.4), ar.y + rnd(-0.4, 0.4), 0, { vz: 10, life: 0.6, size: 2, col: [120, 220, 60], glow: true, kind: 'spark' }); } }
    else if (ar.vis === 'consecrate') { if (ar._fx > 0.08) { ar._fx = 0; const a = rnd(0, PI * 2), r = rnd(0, ar.r); this.p(ar.x + Math.cos(a) * r, ar.y + Math.sin(a) * r, 0, { vz: 30, life: 0.7, size: 1.8, col: [255, 230, 150], glow: true, kind: 'spark' }); } }
  }

  // ───────── 그리기 ─────────
  // 바닥에 붙은 것: 장판·고리
  drawGround(g, ox, oy, s) {
    const L = this.game?.level;
    if (L) for (const ar of L.areas) this.drawArea(g, ar, ox, oy, s);
    for (const r of this.rings) {
      if (r.filled) continue;
    }
  }
  drawArea(g, ar, ox, oy, s) {
    const t = this.r.time;
    const px = ox + (ar.x - ar.y) * (TW / 2) * s, py = oy + (ar.x + ar.y) * (TH / 2) * s;
    g.save();
    g.setTransform(32 * s, 16 * s, -32 * s, 16 * s, px, py);
    const k = Math.min(1, ar.t / 0.3) * Math.min(1, (ar.dur - ar.t) / 0.5);
    switch (ar.vis) {
      case 'poison': g.fillStyle = `rgba(60,140,30,${0.22 * k})`; g.beginPath(); g.arc(0, 0, ar.r, 0, PI * 2); g.fill(); break;
      case 'acidpool': g.fillStyle = `rgba(90,170,40,${0.45 * k})`; g.beginPath(); g.arc(0, 0, ar.r, 0, PI * 2); g.fill(); break;
      case 'blizzard': g.fillStyle = `rgba(150,200,255,${0.12 * k})`; g.beginPath(); g.arc(0, 0, ar.r, 0, PI * 2); g.fill(); break;
      case 'burning': g.fillStyle = `rgba(40,10,0,${0.4 * k})`; g.beginPath(); g.arc(0, 0, ar.r, 0, PI * 2); g.fill(); break;
      case 'consecrate': g.strokeStyle = `rgba(255,230,140,${0.5 * k})`; g.lineWidth = 0.05; g.beginPath(); g.arc(0, 0, ar.r, 0, PI * 2); g.stroke(); break;
      case 'firewall': {
        g.setTransform(1, 0, 0, 1, 0, 0);
        for (const c of ar.cells || []) {
          const cx = ox + (c[0] - c[1]) * (TW / 2) * s, cy = oy + (c[0] + c[1]) * (TH / 2) * s;
          g.fillStyle = `rgba(60,10,0,${0.5 * k})`; g.beginPath(); g.ellipse(cx, cy, 20 * s, 10 * s, 0, 0, PI * 2); g.fill();
        }
        break;
      }
      case 'sentry': case 'decoy': case 'trap': break;
      case 'warn': g.strokeStyle = `rgba(255,80,40,${0.6 + 0.3 * Math.sin(t * 12)})`; g.lineWidth = 0.06; g.beginPath(); g.arc(0, 0, ar.r, 0, PI * 2); g.stroke(); break;
    }
    g.restore();
  }
  // 깊이 정렬에 투사체·세워진 효과를 넣는다
  collect(r, x0, y0, x1, y1) {
    const L = this.game?.level;
    if (!L) return;
    for (const m of L.missiles) {
      if (m.x < x0 - 2 || m.x > x1 + 2 || m.y < y0 - 2 || m.y > y1 + 2 || m.hide) continue;
      r.push(m.x + m.y + 0.3, 6, m, 'm');
    }
    for (const ar of L.areas) if (ar.vis === 'sentry' || ar.vis === 'decoy' || ar.vis === 'trap' || ar.vis === 'firewall') r.push(ar.x + ar.y + 0.2, 6, ar, 'a');
  }
  drawEntry(g, e, ox, oy, s) {
    if (e.b === 'm') this.drawMissile(g, e.a, ox, oy, s);
    else this.drawStanding(g, e.a, ox, oy, s);
  }
  drawStanding(g, ar, ox, oy, s) {
    const t = this.r.time;
    const px = ox + (ar.x - ar.y) * (TW / 2) * s, py = oy + (ar.x + ar.y) * (TH / 2) * s;
    if (ar.vis === 'sentry') {
      g.fillStyle = '#3a3a44'; g.beginPath(); g.moveTo(px - 6 * s, py); g.lineTo(px, py - 34 * s); g.lineTo(px + 6 * s, py); g.closePath(); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = s; g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(150,190,255,${0.6 + 0.4 * Math.sin(t * 10)})`; g.beginPath(); g.arc(px, py - 36 * s, 4 * s, 0, PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
    } else if (ar.vis === 'trap') {
      g.fillStyle = '#4a4440'; g.beginPath(); g.ellipse(px, py, 9 * s, 4.5 * s, 0, 0, PI * 2); g.fill();
      g.fillStyle = `rgba(255,120,40,${0.5 + 0.5 * Math.sin(t * 8)})`; g.beginPath(); g.arc(px, py - 2 * s, 2 * s, 0, PI * 2); g.fill();
    }
  }
  drawMissile(g, m, ox, oy, s) {
    const px = ox + (m.x - m.y) * (TW / 2) * s, py = oy + (m.x + m.y) * (TH / 2) * s - (m.z || 0) * s;
    const ang = Math.atan2((m.vx + m.vy) * 16, (m.vx - m.vy) * 32);
    const t = this.r.time;
    // 그림자
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(px, py + (m.z || 0) * s, 5 * s, 2.5 * s, 0, 0, PI * 2); g.fill();
    switch (m.vis) {
      case 'arrow': case 'arrow_fire': case 'arrow_ice': case 'bolt_arrow': {
        const L = 16 * s, c = Math.cos(ang), sn = Math.sin(ang);
        g.lineCap = 'round';
        g.strokeStyle = '#2a1c10'; g.lineWidth = 2.6 * s; g.beginPath(); g.moveTo(px - c * L * 0.5, py - sn * L * 0.5); g.lineTo(px + c * L * 0.5, py + sn * L * 0.5); g.stroke();
        g.strokeStyle = m.vis === 'arrow_fire' ? '#ffa040' : m.vis === 'arrow_ice' ? '#a0d8ff' : '#c8b088'; g.lineWidth = 1.4 * s; g.stroke();
        g.fillStyle = '#ddd'; g.beginPath(); g.moveTo(px + c * L * 0.6, py + sn * L * 0.6); g.lineTo(px + c * L * 0.4 - sn * 2.5 * s, py + sn * L * 0.4 + c * 2.5 * s); g.lineTo(px + c * L * 0.4 + sn * 2.5 * s, py + sn * L * 0.4 - c * 2.5 * s); g.fill();
        g.strokeStyle = '#a03030'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(px - c * L * 0.5, py - sn * L * 0.5); g.lineTo(px - c * L * 0.35, py - sn * L * 0.35); g.stroke();
        break;
      }
      case 'fire': case 'fireball': case 'meteor': {
        const R = (m.vis === 'fireball' ? 8 : m.vis === 'meteor' ? 12 : 5) * s;
        g.globalCompositeOperation = 'lighter';
        g.drawImage(glowSprite(255, 120, 30), px - R * 2.2, py - R * 2.2, R * 4.4, R * 4.4);
        g.fillStyle = '#ffe8a0'; g.beginPath(); g.arc(px, py, R * 0.55, 0, PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        break;
      }
      case 'ice': case 'spike': {
        const L = 11 * s, c = Math.cos(ang), sn = Math.sin(ang);
        g.globalCompositeOperation = 'lighter';
        g.drawImage(glowSprite(120, 190, 255), px - 14 * s, py - 14 * s, 28 * s, 28 * s);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#d8f0ff'; g.strokeStyle = '#4080c0'; g.lineWidth = s;
        g.beginPath(); g.moveTo(px + c * L, py + sn * L); g.lineTo(px - sn * 3 * s, py + c * 3 * s); g.lineTo(px - c * L * 0.6, py - sn * L * 0.6); g.lineTo(px + sn * 3 * s, py - c * 3 * s); g.closePath(); g.fill(); g.stroke();
        break;
      }
      case 'orb': {
        g.globalCompositeOperation = 'lighter';
        g.drawImage(glowSprite(140, 200, 255), px - 22 * s, py - 22 * s, 44 * s, 44 * s);
        g.strokeStyle = 'rgba(220,240,255,0.9)'; g.lineWidth = 1.5 * s;
        for (let i = 0; i < 3; i++) { const a = t * 8 + i * 2.1; g.beginPath(); g.arc(px, py, 7 * s, a, a + 1.2); g.stroke(); }
        g.globalCompositeOperation = 'source-over';
        break;
      }
      case 'charged': {
        g.globalCompositeOperation = 'lighter';
        g.drawImage(glowSprite(150, 180, 255), px - 10 * s, py - 10 * s, 20 * s, 20 * s);
        g.strokeStyle = '#e8f0ff'; g.lineWidth = 1.2 * s; g.beginPath();
        for (let i = 0; i < 4; i++) { const a = rnd(0, PI * 2); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * 6 * s, py + Math.sin(a) * 6 * s); }
        g.stroke(); g.globalCompositeOperation = 'source-over';
        break;
      }
      case 'magic': case 'holy': case 'blood': case 'shadow': case 'acid': case 'poison': case 'bone': case 'lightorb': {
        const c = m.vis === 'holy' ? [255, 240, 170] : m.vis === 'blood' ? [255, 40, 50] : m.vis === 'shadow' ? [150, 80, 220] : m.vis === 'acid' || m.vis === 'poison' ? [120, 230, 60] : m.vis === 'bone' ? [230, 225, 210] : m.vis === 'lightorb' ? [200, 220, 255] : [130, 160, 255];
        g.globalCompositeOperation = 'lighter';
        g.drawImage(glowSprite(c[0], c[1], c[2]), px - 14 * s, py - 14 * s, 28 * s, 28 * s);
        g.fillStyle = `rgb(${Math.min(255, c[0] + 80)},${Math.min(255, c[1] + 80)},${Math.min(255, c[2] + 80)})`;
        g.beginPath(); g.arc(px, py, 3.5 * s, 0, PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        break;
      }
      case 'rock': {
        g.fillStyle = '#6a5a4a'; g.strokeStyle = '#1a1410'; g.lineWidth = s; g.beginPath(); g.arc(px, py, 5 * s, 0, PI * 2); g.fill(); g.stroke();
        break;
      }
      case 'axe': {
        g.save(); g.translate(px, py); g.rotate(t * 18);
        g.fillStyle = '#b0b4bc'; g.strokeStyle = '#111'; g.lineWidth = s;
        g.beginPath(); g.moveTo(-7 * s, 0); g.lineTo(7 * s, 0); g.stroke(); g.beginPath(); g.moveTo(4 * s, -5 * s); g.lineTo(9 * s, 0); g.lineTo(4 * s, 5 * s); g.closePath(); g.fill(); g.stroke();
        g.restore();
        break;
      }
    }
  }
  // 어둠 전에 그리는 입자(피·파편·연기)
  drawWorld(g, ox, oy, s) {
    const pix = this.r.pixel; // 도트 그래픽: 파편은 정수 도트 자리에 적어도 한 도트로
    for (const q of this.ps) {
      if (q.glow) continue;
      const px = ox + (q.x - q.y) * (TW / 2) * s, py = oy + (q.x + q.y) * (TH / 2) * s - q.z * s;
      const a = Math.min(1, q.life / q.max * 2) * q.fade;
      g.globalAlpha = q.kind === 'smoke' ? a * 0.45 : a;
      g.fillStyle = `rgb(${q.col[0]},${q.col[1]},${q.col[2]})`;
      const sz = pix ? Math.max(1, Math.round(q.size * s)) : q.size * s;
      if (q.kind === 'smoke') { g.beginPath(); g.arc(px, py, sz, 0, PI * 2); g.fill(); }
      else if (pix) g.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz);
      else g.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
    g.globalAlpha = 1;
  }
  // 가산 합성으로 빛나는 것
  drawGlow(g, ox, oy, s) {
    for (const q of this.ps) {
      if (!q.glow) continue;
      const px = ox + (q.x - q.y) * (TW / 2) * s, py = oy + (q.x + q.y) * (TH / 2) * s - q.z * s;
      const a = Math.min(1, q.life / q.max * 1.6) * q.fade;
      const sz = q.size * s * (q.kind === 'smoke' ? 2.4 : 3);
      g.globalAlpha = a * (q.kind === 'smoke' ? 0.5 : 0.9);
      g.drawImage(glowSprite(q.col[0], q.col[1], q.col[2]), px - sz, py - sz, sz * 2, sz * 2);
    }
    for (const f of this.flashes) {
      const px = ox + (f.x - f.y) * (TW / 2) * s, py = oy + (f.x + f.y) * (TH / 2) * s - f.z * s;
      const k = 1 - f.t / f.dur, R = f.r * 32 * s;
      g.globalAlpha = k * 0.8;
      g.drawImage(glowSprite(f.col[0], f.col[1], f.col[2]), px - R, py - R * 0.7, R * 2, R * 1.4);
    }
    g.globalAlpha = 1;
    for (const r of this.rings) {
      const px = ox + (r.x - r.y) * (TW / 2) * s, py = oy + (r.x + r.y) * (TH / 2) * s;
      const k = r.t / r.dur, rad = (r.r0 + (r.r1 - r.r0) * k) * 45 * s;
      g.strokeStyle = `rgba(${r.col[0]},${r.col[1]},${r.col[2]},${(1 - k) * 0.9})`;
      g.lineWidth = r.w * s * (1 - k * 0.5);
      g.beginPath(); g.ellipse(px, py, rad, rad * 0.5, 0, 0, PI * 2); g.stroke();
      if (r.filled) { g.fillStyle = `rgba(${r.col[0]},${r.col[1]},${r.col[2]},${(1 - k) * 0.25})`; g.fill(); }
    }
    for (const b of this.bolts) {
      const k = 1 - b.t / b.dur;
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [w, a] of [[b.w * 4, 0.25], [b.w * 1.6, 0.7], [b.w * 0.6, 1]]) {
        g.strokeStyle = w < b.w ? `rgba(255,255,255,${a * k})` : `rgba(${b.col[0]},${b.col[1]},${b.col[2]},${a * k})`;
        g.lineWidth = w * s;
        g.beginPath();
        b.pts.forEach(([x, y, z], i) => { const px = ox + (x - y) * (TW / 2) * s, py = oy + (x + y) * (TH / 2) * s - z * s; i ? g.lineTo(px, py) : g.moveTo(px, py); });
        g.stroke();
      }
    }
    // 장판의 빛
    const L = this.game?.level;
    if (L) for (const ar of L.areas) {
      if (ar.vis === 'firewall') for (const c of ar.cells || []) {
        const px = ox + (c[0] - c[1]) * (TW / 2) * s, py = oy + (c[0] + c[1]) * (TH / 2) * s;
        g.globalAlpha = 0.35; g.drawImage(glowSprite(255, 120, 30), px - 28 * s, py - 40 * s, 56 * s, 56 * s);
      }
    }
    g.globalAlpha = 1;
  }
  lights(hole) {
    const L = this.game?.level;
    if (!L) return;
    for (const m of L.missiles) if (m.light) hole(m.x, m.y, m.light, 0.8, m.z || 20);
    for (const f of this.flashes) hole(f.x, f.y, f.r * (1 - f.t / f.dur), 0.9, f.z);
    for (const ar of L.areas) if (ar.light) hole(ar.x, ar.y, ar.light, 0.6, 10);
  }
  // 떠오르는 글자
  drawTop(g, ox, oy, s) {
    const d = this.r.dpr;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.t / t.dur;
      const px = ox + (t.x - t.y) * (TW / 2) * s, py = oy + (t.x + t.y) * (TH / 2) * s - (t.z + k * 30) * s;
      g.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      const sz = t.size * d * (k < 0.1 ? 0.7 + k * 3 : 1);
      g.font = `800 ${sz}px -apple-system, "Apple SD Gothic Neo", sans-serif`;
      g.lineWidth = 3 * d; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(t.txt, px, py);
      g.fillStyle = t.col; g.fillText(t.txt, px, py);
    }
    g.globalAlpha = 1;
    // 괴물 머리 위 체력 막대(최근에 맞은 괴물만)
    const L = this.game?.level;
    if (!L || !this.game.showBars) return;
    for (const a of L.actors) {
      if (a.team !== 1 || a.dead || !(a.barT > 0) || a.invis === 0) continue;
      const k = Math.round(a.y) * L.w + Math.round(a.x);
      if (!(L.flags[k] & 8) && L.theme !== 'town') continue;
      const px = ox + (a.x - a.y) * (TW / 2) * s, py = oy + (a.x + a.y) * (TH / 2) * s - (a.look?.barZ || 72) * s * (a.look?.scale || 1) * (a.look?.h || 1);
      const w = 30 * d, h = 3.5 * d;
      g.globalAlpha = Math.min(1, a.barT);
      g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(px - w / 2 - d, py - d, w + 2 * d, h + 2 * d);
      g.fillStyle = a.rank === 'unique' ? '#c8a040' : a.rank === 'champion' ? '#5080e0' : '#c02a20';
      g.fillRect(px - w / 2, py, w * Math.max(0, a.hp / a.hpMax), h);
    }
    g.globalAlpha = 1;
  }
}

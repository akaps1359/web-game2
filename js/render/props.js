// 물체(문·계단·통·상자·석관·책장·성소·화로·차원문 등)와 바닥 장식 그리기
import { WALL_H } from './tiles.js';
import { shade } from './noise.js';
import { drawItemIcon } from './icons.js';
import { BASE } from '../data/items.js';

const PI = Math.PI;
const OUTC = 'rgba(10,7,5,0.9)';
// 타일 중심(px, py)에서 타일 좌표 오프셋(a, b)과 높이 z → 화면
const SX = (px, s, a, b) => px + (a - b) * 32 * s;
const SY = (py, s, a, b, z) => py + (a + b) * 16 * s - z * s;

function poly(g, pts, fill, out, ow = 1) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (out) { g.strokeStyle = out; g.lineWidth = ow; g.lineJoin = 'round'; g.stroke(); }
}
// 아이소 상자: 중심 오프셋(cx, cy), 반폭(hx, hy), 바닥 높이 z0, 높이 h
export function isoBox(g, px, py, s, cx, cy, hx, hy, z0, h, col, out = OUTC) {
  const P = (a, b, z) => [SX(px, s, cx + a, cy + b), SY(py, s, cx + a, cy + b, z)];
  const q = (...pts) => pts.flat();
  const ow = Math.max(1, 1.1 * s);
  poly(g, q(P(-hx, hy, z0), P(hx, hy, z0), P(hx, hy, z0 + h), P(-hx, hy, z0 + h)), shade(col, 0.92), out, ow);
  poly(g, q(P(hx, hy, z0), P(hx, -hy, z0), P(hx, -hy, z0 + h), P(hx, hy, z0 + h)), shade(col, 0.64), out, ow);
  poly(g, q(P(-hx, -hy, z0 + h), P(hx, -hy, z0 + h), P(hx, hy, z0 + h), P(-hx, hy, z0 + h)), shade(col, 1.15), out, ow);
}
function isoEllipse(g, px, py, s, cx, cy, r, z) {
  g.beginPath(); g.ellipse(SX(px, s, cx, cy), SY(py, s, cx, cy, z), r * 45 * s, r * 22.6 * s, 0, 0, PI * 2);
}
// 원기둥(통)
function cylinder(g, px, py, s, r, h, col, top, hoops) {
  const rx = r * 45 * s, ry = r * 22.6 * s, H = h * s;
  g.beginPath();
  g.moveTo(px - rx, py - H); g.lineTo(px - rx, py); g.ellipse(px, py, rx, ry, 0, PI, 0, true); g.lineTo(px + rx, py - H);
  g.ellipse(px, py - H, rx, ry, 0, 0, PI, true); g.closePath();
  const gr = g.createLinearGradient(px - rx, 0, px + rx, 0);
  gr.addColorStop(0, shade(col, 0.75)); gr.addColorStop(0.35, shade(col, 1.15)); gr.addColorStop(1, shade(col, 0.5));
  g.fillStyle = gr; g.fill(); g.strokeStyle = OUTC; g.lineWidth = Math.max(1, s); g.stroke();
  if (hoops) for (const k of hoops) {
    g.beginPath(); g.ellipse(px, py - H * k, rx, ry, 0, 0, PI); g.strokeStyle = '#2b2622'; g.lineWidth = 2.2 * s; g.stroke();
  }
  g.beginPath(); g.ellipse(px, py - H, rx, ry, 0, 0, PI * 2); g.fillStyle = top; g.fill(); g.strokeStyle = OUTC; g.lineWidth = Math.max(1, s); g.stroke();
}
function flame(g, x, y, s, t, k = 1, seed = 0) {
  const f = 0.85 + 0.15 * Math.sin(t * 17 + seed) + 0.1 * Math.sin(t * 29 + seed * 2);
  const h = 11 * s * k * f, w = 4 * s * k;
  g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 1.1, y - h * 0.5, x + Math.sin(t * 9 + seed) * w * 0.5, y - h); g.quadraticCurveTo(x + w * 1.1, y - h * 0.5, x + w, y); g.closePath();
  g.fillStyle = 'rgba(255,120,30,0.9)'; g.fill();
  g.beginPath(); g.moveTo(x - w * 0.5, y); g.quadraticCurveTo(x - w * 0.5, y - h * 0.4, x + Math.sin(t * 9 + seed) * w * 0.3, y - h * 0.65); g.quadraticCurveTo(x + w * 0.5, y - h * 0.4, x + w * 0.5, y); g.closePath();
  g.fillStyle = 'rgba(255,230,140,0.95)'; g.fill();
}

// 물체마다 내는 빛: { r: 반경(칸), color, glow }
export function objectLight(o, t) {
  switch (o.type) {
    case 'brazier': return { r: 4.5, color: [255, 150, 60], glow: true, z: 34, gr: 30, ga: 0.32 };
    case 'portal': return { r: 4, color: o.red ? [255, 60, 40] : [80, 150, 255], glow: true, z: 34, gr: 44, ga: 0.5, p: 0.9 };
    case 'waypoint': return o.active ? { r: 3.2, color: [120, 170, 255], glow: true, z: 4, gr: 46, ga: 0.35 } : { r: 1.5, p: 0.5 };
    case 'shrine': return o.used ? null : { r: 2.5, color: o.col || [120, 200, 255], glow: true, z: 34, gr: 24, ga: 0.4, p: 0.7 };
    case 'candles': return { r: 3, color: [255, 180, 90], glow: true, z: 20, gr: 20, ga: 0.3 };
    case 'altar': return { r: 3, color: [255, 60, 40], glow: true, z: 30, gr: 30, ga: 0.3 };
    case 'lamp': return { r: 6, color: [255, 190, 110], glow: true, z: 70, gr: 36, ga: 0.35 };
    case 'fire': return { r: 6, color: [255, 150, 60], glow: true, z: 18, gr: 50, ga: 0.4 };
    case 'stash': case 'well': return null;
    case 'seal': return o.on ? { r: 3, color: [255, 50, 40], glow: true, z: 2, gr: 50, ga: 0.5 } : null;
  }
  return null;
}

export function drawTorch(g, lt, px, py, s, t, vis) {
  // 벽 면 위에 걸린 횃불
  const a = lt.face === 'x' ? 0.5 : 0, b = lt.face === 'y' ? 0.5 : 0;
  const x = SX(px, s, a, b), y = SY(py, s, a, b, 50);
  g.fillStyle = '#2a2018'; g.fillRect(x - 1.5 * s, y, 3 * s, 9 * s);
  g.fillStyle = '#5a4630'; g.fillRect(x - 3 * s, y - 1 * s, 6 * s, 3 * s);
  if (vis) flame(g, x, y, s, t, 0.9, lt.flick);
}

export function drawObject(g, o, px, py, s, t, vis, L) {
  const dim = vis ? 1 : 0.45;
  switch (o.type) {
    case 'door': return drawDoor(g, o, px, py, s, dim, L);
    case 'stairs_down': return drawStairs(g, o, px, py, s, dim, true, L);
    case 'stairs_up': return drawStairs(g, o, px, py, s, dim, false, L);
    case 'barrel': {
      if (o.broken) {
        g.fillStyle = shade('#5a4028', dim);
        for (let i = 0; i < 5; i++) { const a = i * 1.3 + o.x; g.fillRect(px + Math.cos(a) * 10 * s - 3 * s, py + Math.sin(a) * 5 * s - 1 * s, 7 * s, 2.2 * s); }
        return;
      }
      cylinder(g, px, py + 2 * s, s, 0.27, 27, shade(o.explosive ? '#6a3322' : '#7a5838', dim), shade(o.explosive ? '#3a1a10' : '#4a3420', dim), [0.2, 0.8]);
      if (o.explosive) { g.fillStyle = 'rgba(200,40,20,0.8)'; g.font = `bold ${8 * s}px sans-serif`; g.textAlign = 'center'; g.fillText('☠', px, py - 10 * s); }
      return;
    }
    case 'chest': {
      const big = o.big, hx = big ? 0.3 : 0.24, hy = big ? 0.2 : 0.16;
      isoBox(g, px, py, s, 0, 0, hx, hy, 0, 12, shade(big ? '#6a4a24' : '#5c4226', dim));
      if (!o.open) {
        isoBox(g, px, py, s, 0, 0, hx, hy, 12, 6, shade(big ? '#7a5a2c' : '#6a4c2a', dim));
        g.fillStyle = shade('#c8a040', dim); g.fillRect(SX(px, s, 0, hy) - 1.5 * s, SY(py, s, 0, hy, 13) - 2 * s, 3 * s, 4 * s);
      } else {
        isoBox(g, px, py, s, -hx * 0.9, 0, hx * 0.15, hy, 12, 10, shade('#6a4c2a', dim));
        g.fillStyle = 'rgba(10,6,4,0.9)';
        poly(g, [SX(px, s, -hx * 0.8, -hy * 0.8), SY(py, s, -hx * 0.8, -hy * 0.8, 12), SX(px, s, hx * 0.8, -hy * 0.8), SY(py, s, hx * 0.8, -hy * 0.8, 12), SX(px, s, hx * 0.8, hy * 0.8), SY(py, s, hx * 0.8, hy * 0.8, 12), SX(px, s, -hx * 0.8, hy * 0.8), SY(py, s, -hx * 0.8, hy * 0.8, 12)], 'rgba(15,10,6,1)');
      }
      return;
    }
    case 'sarc': {
      isoBox(g, px, py, s, 0, 0, 0.42, 0.24, 0, 14, shade('#6e6a62', dim));
      if (!o.open) isoBox(g, px, py, s, 0, 0, 0.44, 0.26, 14, 4, shade('#7c7870', dim));
      else { isoBox(g, px, py, s, 0.1, 0.3, 0.44, 0.22, 0, 4, shade('#7c7870', dim)); poly(g, [SX(px, s, -0.36, -0.18), SY(py, s, -0.36, -0.18, 14), SX(px, s, 0.36, -0.18), SY(py, s, 0.36, -0.18, 14), SX(px, s, 0.36, 0.18), SY(py, s, 0.36, 0.18, 14), SX(px, s, -0.36, 0.18), SY(py, s, -0.36, 0.18, 14)], '#0d0a08'); }
      return;
    }
    case 'bookcase': {
      isoBox(g, px, py, s, -0.2, 0, 0.18, 0.42, 0, 46, shade('#4a3220', dim));
      const cols = ['#7a2020', '#204a6a', '#5a5a20', '#3a2a5a', '#6a4020'];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
        const b = -0.36 + i * 0.13, z = 6 + r * 13;
        if (o.empty && (i + r) % 2) continue;
        poly(g, [SX(px, s, -0.02, b), SY(py, s, -0.02, b, z), SX(px, s, -0.02, b + 0.1), SY(py, s, -0.02, b + 0.1, z), SX(px, s, -0.02, b + 0.1), SY(py, s, -0.02, b + 0.1, z + 10), SX(px, s, -0.02, b), SY(py, s, -0.02, b, z + 10)], shade(cols[(i + r * 2) % 5], dim * 0.9));
      }
      return;
    }
    case 'rack': {
      isoBox(g, px, py, s, -0.25, 0, 0.05, 0.4, 0, 34, shade('#4a3422', dim));
      g.strokeStyle = shade(o.used ? '#555' : '#b8bcc4', dim); g.lineWidth = 2 * s; g.lineCap = 'round';
      for (let i = 0; i < (o.used ? 1 : 3); i++) { const b = -0.25 + i * 0.25; g.beginPath(); g.moveTo(SX(px, s, -0.15, b), SY(py, s, -0.15, b, 4)); g.lineTo(SX(px, s, -0.15, b + 0.05), SY(py, s, -0.15, b + 0.05, 36)); g.stroke(); }
      return;
    }
    case 'brazier': {
      g.strokeStyle = shade('#3a3532', dim); g.lineWidth = 2.4 * s;
      for (const a of [-0.12, 0.12]) { g.beginPath(); g.moveTo(SX(px, s, a, 0), SY(py, s, a, 0, 0)); g.lineTo(SX(px, s, 0, 0), SY(py, s, 0, 0, 22)); g.stroke(); }
      g.beginPath(); g.moveTo(SX(px, s, 0, -0.12), SY(py, s, 0, -0.12, 0)); g.lineTo(SX(px, s, 0, 0), SY(py, s, 0, 0, 22)); g.stroke();
      isoEllipse(g, px, py, s, 0, 0, 0.2, 24); g.fillStyle = shade('#4a4038', dim); g.fill(); g.strokeStyle = OUTC; g.lineWidth = s; g.stroke();
      flame(g, px, SY(py, s, 0, 0, 25), s, t, 1.4, o.x * 3 + o.y);
      return;
    }
    case 'candles': {
      for (let i = 0; i < 3; i++) { const a = -0.12 + i * 0.12, b = (i % 2) * 0.1; const x = SX(px, s, a, b), y = SY(py, s, a, b, 0); g.fillStyle = '#d8d0b8'; g.fillRect(x - 1.5 * s, y - (8 + i * 3) * s, 3 * s, (8 + i * 3) * s); flame(g, x, y - (8 + i * 3) * s, s, t, 0.45, i * 2); }
      return;
    }
    case 'shrine': return drawShrine(g, o, px, py, s, t, dim);
    case 'waypoint': return drawWaypoint(g, o, px, py, s, t);
    case 'portal': return drawPortal(g, o, px, py, s, t);
    case 'altar': {
      isoBox(g, px, py, s, 0, 0, 0.36, 0.26, 0, 16, shade('#3a2a2a', dim));
      g.fillStyle = 'rgba(140,10,10,0.8)'; isoEllipse(g, px, py, s, 0, 0, 0.12, 16); g.fill();
      flame(g, SX(px, s, -0.2, -0.15), SY(py, s, -0.2, -0.15, 16), s, t, 0.5, 1);
      flame(g, SX(px, s, 0.2, 0.15), SY(py, s, 0.2, 0.15, 16), s, t, 0.5, 2);
      return;
    }
    case 'lever': {
      isoBox(g, px, py, s, 0, 0, 0.12, 0.12, 0, 10, shade('#4a4644', dim));
      g.strokeStyle = '#8a8070'; g.lineWidth = 2.4 * s; g.lineCap = 'round';
      const a = o.on ? 0.25 : -0.25;
      g.beginPath(); g.moveTo(px, SY(py, s, 0, 0, 10)); g.lineTo(SX(px, s, a, -a), SY(py, s, a, -a, 26)); g.stroke();
      g.fillStyle = '#a02a20'; g.beginPath(); g.arc(SX(px, s, a, -a), SY(py, s, a, -a, 26), 2.6 * s, 0, PI * 2); g.fill();
      return;
    }
    case 'seal': {
      // 바닥의 봉인 문양
      g.save(); g.translate(px, py); g.scale(1, 0.5);
      g.strokeStyle = o.on ? `rgba(255,60,40,${0.6 + 0.3 * Math.sin(t * 3)})` : 'rgba(90,40,40,0.6)'; g.lineWidth = 2 * s;
      g.beginPath(); g.arc(0, 0, 40 * s, 0, PI * 2); g.stroke();
      g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -PI / 2 + i * PI * 4 / 5; i ? g.lineTo(Math.cos(a) * 40 * s, Math.sin(a) * 40 * s) : g.moveTo(Math.cos(a) * 40 * s, Math.sin(a) * 40 * s); } g.stroke();
      g.restore();
      return;
    }
    case 'stash': {
      isoBox(g, px, py, s, 0, 0, 0.32, 0.22, 0, 14, '#5a3c22');
      isoBox(g, px, py, s, 0, 0, 0.33, 0.23, 14, 7, '#6e4a28');
      g.fillStyle = '#d4b050'; g.fillRect(SX(px, s, 0, 0.23) - 2 * s, SY(py, s, 0, 0.23, 14) - 3 * s, 4 * s, 6 * s);
      return;
    }
    case 'well': {
      cylinder(g, px, py, s, 0.45, 18, '#6a665e', '#101820');
      g.strokeStyle = '#4a3624'; g.lineWidth = 3 * s;
      for (const a of [-0.4, 0.4]) { g.beginPath(); g.moveTo(SX(px, s, a, -a), SY(py, s, a, -a, 16)); g.lineTo(SX(px, s, a, -a), SY(py, s, a, -a, 50)); g.stroke(); }
      g.beginPath(); g.moveTo(SX(px, s, -0.45, 0.45), SY(py, s, -0.45, 0.45, 50)); g.lineTo(SX(px, s, 0.45, -0.45), SY(py, s, 0.45, -0.45, 50)); g.stroke();
      return;
    }
    case 'tree': return drawTree(g, o, px, py, s, t);
    case 'house': return drawHouse(g, o, px, py, s, t, L);
    case 'fence': {
      g.strokeStyle = '#4a3624'; g.lineWidth = 2.4 * s; g.lineCap = 'round';
      const a = o.ori === 'x' ? [-0.5, 0, 0.5, 0] : [0, -0.5, 0, 0.5];
      for (const z of [10, 20]) { g.beginPath(); g.moveTo(SX(px, s, a[0], a[1]), SY(py, s, a[0], a[1], z)); g.lineTo(SX(px, s, a[2], a[3]), SY(py, s, a[2], a[3], z)); g.stroke(); }
      g.lineWidth = 3 * s;
      for (const k of [0, 1]) { const x = a[0] + (a[2] - a[0]) * k * 0.9 + (a[2] - a[0]) * 0.05, y = a[1] + (a[3] - a[1]) * k * 0.9 + (a[3] - a[1]) * 0.05; g.beginPath(); g.moveTo(SX(px, s, x, y), SY(py, s, x, y, 0)); g.lineTo(SX(px, s, x, y), SY(py, s, x, y, 25)); g.stroke(); }
      return;
    }
    case 'lamp': {
      g.strokeStyle = '#2a2622'; g.lineWidth = 2.6 * s; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - 64 * s); g.stroke();
      g.fillStyle = '#3a342e'; g.fillRect(px - 5 * s, py - 74 * s, 10 * s, 11 * s);
      g.fillStyle = 'rgba(255,200,120,0.95)'; g.fillRect(px - 3 * s, py - 72 * s, 6 * s, 7 * s);
      return;
    }
    case 'fire': {
      for (let i = 0; i < 5; i++) { const a = i * 1.26; g.strokeStyle = '#3a2618'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(px + Math.cos(a) * 9 * s, py + Math.sin(a) * 4.5 * s); g.lineTo(px - Math.cos(a) * 3 * s, py - Math.sin(a) * 1.5 * s - 4 * s); g.stroke(); }
      flame(g, px, py - 2 * s, s, t, 1.6, 3); flame(g, px - 4 * s, py, s, t * 1.1, 1.0, 5); flame(g, px + 4 * s, py, s, t * 0.9, 1.1, 7);
      return;
    }
    case 'cauldron': {
      cylinder(g, px, py, s, 0.28, 16, '#2a2826', `rgba(60,${120 + 40 * Math.sin(t * 3)},50,1)`);
      return;
    }
    case 'crate': { isoBox(g, px, py, s, 0, 0, 0.26, 0.26, 0, 22, shade('#6a5034', dim)); return; }
    case 'gibbet': {
      g.strokeStyle = '#3a2a1c'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - 80 * s); g.lineTo(px + 18 * s, py - 80 * s); g.stroke();
      g.lineWidth = 1 * s; g.strokeStyle = '#555'; g.beginPath(); g.moveTo(px + 16 * s, py - 80 * s); g.lineTo(px + 16 * s, py - 60 * s); g.stroke();
      g.fillStyle = '#4a3a30'; g.fillRect(px + 10 * s, py - 60 * s, 12 * s, 22 * s);
      return;
    }
    case 'pillar': {
      cylinder(g, px, py, s, 0.22, 60, shade('#6a5e52', dim), shade('#4a4038', dim), [0.05, 0.95]);
      return;
    }
    case 'cage': {
      g.strokeStyle = shade('#6a6460', dim); g.lineWidth = 1.6 * s;
      for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; const x = px + Math.cos(a) * 12 * s, y = py + Math.sin(a) * 6 * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 40 * s); g.stroke(); }
      g.beginPath(); g.ellipse(px, py - 40 * s, 12 * s, 6 * s, 0, 0, PI * 2); g.stroke();
      return;
    }
    case 'tomb': {
      // 묘비
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(px, py, 12 * s, 6 * s, 0, 0, PI * 2); g.fill();
      const x = px, y = py - 2 * s;
      g.fillStyle = '#6a665e'; g.strokeStyle = OUTC; g.lineWidth = s;
      g.beginPath(); g.moveTo(x - 7 * s, y); g.lineTo(x - 7 * s, y - 18 * s); g.arc(x, y - 18 * s, 7 * s, PI, 0); g.lineTo(x + 7 * s, y); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#3a3630'; g.beginPath(); g.moveTo(x, y - 22 * s); g.lineTo(x, y - 12 * s); g.moveTo(x - 3 * s, y - 19 * s); g.lineTo(x + 3 * s, y - 19 * s); g.stroke();
      return;
    }
    case 'pedestal': {
      isoBox(g, px, py, s, 0, 0, 0.26, 0.26, 0, 20, shade('#6a6670', dim));
      if (!o.taken) {
        const y = SY(py, s, 0, 0, 28);
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(160,210,255,${0.35 + 0.2 * Math.sin(t * 3)})`; g.beginPath(); g.arc(px, y, 12 * s, 0, PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#c8e0ff'; g.strokeStyle = '#3a4a6a'; g.lineWidth = s;
        g.beginPath(); g.moveTo(px, y - 6 * s); g.lineTo(px + 5 * s, y); g.lineTo(px, y + 5 * s); g.lineTo(px - 5 * s, y); g.closePath(); g.fill(); g.stroke();
      }
      return;
    }
    case 'fungus': {
      if (o.taken) return;
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7, x = px + Math.cos(a) * 9 * s * (i ? 1 : 0), y = py + Math.sin(a) * 4 * s * (i ? 1 : 0);
        const h2 = (i ? 12 : 22) * s;
        g.strokeStyle = '#d8d0c0'; g.lineWidth = (i ? 2 : 3.5) * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h2); g.stroke();
        g.fillStyle = '#2a1a30'; g.strokeStyle = OUTC; g.lineWidth = s;
        g.beginPath(); g.ellipse(x, y - h2, (i ? 7 : 13) * s, (i ? 4 : 7) * s, 0, PI, 0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(160,80,200,0.8)'; g.beginPath(); g.arc(x - 3 * s, y - h2 - 2 * s, 1.5 * s, 0, PI * 2); g.fill();
      }
      return;
    }
    case 'anvil': {
      if (o.item === null && o.quest) return;
      isoBox(g, px, py, s, 0, 0, 0.16, 0.12, 0, 12, '#3a3632');
      isoBox(g, px, py, s, 0, 0, 0.3, 0.15, 12, 7, o.quest ? '#4a3434' : '#5a5a62');
      if (o.quest) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,90,30,${0.3 + 0.2 * Math.sin(t * 4)})`; g.beginPath(); g.arc(px, SY(py, s, 0, 0, 18), 14 * s, 0, PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; }
      return;
    }
    case 'tome': {
      isoBox(g, px, py, s, 0, 0, 0.18, 0.18, 0, 24, shade('#4a3a30', dim));
      g.fillStyle = '#d8c8a0'; poly(g, [SX(px, s, -0.15, -0.12), SY(py, s, -0.15, -0.12, 25), SX(px, s, 0.15, -0.12), SY(py, s, 0.15, -0.12, 25), SX(px, s, 0.15, 0.12), SY(py, s, 0.15, 0.12, 25), SX(px, s, -0.15, 0.12), SY(py, s, -0.15, 0.12, 25)], '#d8c8a0', OUTC);
      if (!o.read) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,200,80,${0.3 + 0.2 * Math.sin(t * 4)})`; g.beginPath(); g.arc(px, SY(py, s, 0, 0, 28), 8 * s, 0, PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; }
      return;
    }
  }
}

function drawDoor(g, o, px, py, s, dim, L) {
  const H = 48;
  const wood = shade('#6a4628', dim), dark = shade('#3e2814', dim);
  // ori 'y': 벽이 y축으로 이어짐 → 문짝은 x = 0 평면(오른쪽 면이 보인다)
  const Pp = (a, b, z) => [SX(px, s, a, b), SY(py, s, a, b, z)];
  const quad = (p) => p.flat();
  if (!o.open) {
    if (o.ori === 'y') {
      const pts = quad([Pp(0.1, -0.5, 0), Pp(0.1, 0.5, 0), Pp(0.1, 0.5, H), Pp(0.1, -0.5, H)]);
      poly(g, pts, wood, OUTC, Math.max(1, s));
      g.strokeStyle = dark; g.lineWidth = 1.2 * s;
      for (const b of [-0.25, 0, 0.25]) { g.beginPath(); g.moveTo(...Pp(0.1, b, 0)); g.lineTo(...Pp(0.1, b, H)); g.stroke(); }
      g.fillStyle = shade('#b09040', dim); const [x, y] = Pp(0.1, 0.32, 24); g.fillRect(x - 1.5 * s, y - 1.5 * s, 3 * s, 3 * s);
    } else {
      const pts = quad([Pp(-0.5, 0.1, 0), Pp(0.5, 0.1, 0), Pp(0.5, 0.1, H), Pp(-0.5, 0.1, H)]);
      poly(g, pts, shade('#7a5230', dim), OUTC, Math.max(1, s));
      g.strokeStyle = dark; g.lineWidth = 1.2 * s;
      for (const a of [-0.25, 0, 0.25]) { g.beginPath(); g.moveTo(...Pp(a, 0.1, 0)); g.lineTo(...Pp(a, 0.1, H)); g.stroke(); }
      g.fillStyle = shade('#b09040', dim); const [x, y] = Pp(0.32, 0.1, 24); g.fillRect(x - 1.5 * s, y - 1.5 * s, 3 * s, 3 * s);
    }
  } else {
    // 열린 문: 벽 쪽으로 젖혀진 문짝
    if (o.ori === 'y') poly(g, quad([Pp(0, -0.5, 0), Pp(0.85, -0.5, 0), Pp(0.85, -0.5, H), Pp(0, -0.5, H)]), shade('#5a3a20', dim), OUTC, Math.max(1, s));
    else poly(g, quad([Pp(-0.5, 0, 0), Pp(-0.5, 0.85, 0), Pp(-0.5, 0.85, H), Pp(-0.5, 0, H)]), shade('#5a3a20', dim), OUTC, Math.max(1, s));
  }
  // 문 위의 상인방(벽이 이어지게)
  const th = L?.theme;
  const wc = th === 'catacombs' ? '#5e4234' : th === 'hell' ? '#3e1c1e' : th === 'caves' ? '#4e3c2c' : '#6a5c4c';
  isoBox(g, px, py, s, 0, 0, 0.5, 0.5, H, WALL_H - H, shade(wc, dim));
}

function drawStairs(g, o, px, py, s, dim, down, L) {
  // 계단은 뒤쪽 벽(face 방향 반대)으로 이어진다
  const Pp = (a, b, z) => [SX(px, s, a, b), SY(py, s, a, b, z)];
  const ax = o.face === 'x'; // 벽이 -x 쪽
  const stone = L?.theme === 'hell' ? '#4a2a2a' : L?.theme === 'catacombs' ? '#6a5244' : L?.theme === 'caves' ? '#6a5442' : '#7a7064';
  if (down) {
    // 바닥에 뚫린 어두운 계단 구멍
    const N = 5;
    for (let i = 0; i < N; i++) {
      const k0 = 0.5 - i / N, k1 = 0.5 - (i + 1) / N, z = -i * 6;
      const pts = ax ? [Pp(k0, -0.45, z), Pp(k0, 0.45, z), Pp(k1, 0.45, z), Pp(k1, -0.45, z)] : [Pp(-0.45, k0, z), Pp(0.45, k0, z), Pp(0.45, k1, z), Pp(-0.45, k1, z)];
      poly(g, pts.flat(), shade(stone, dim * (1 - i * 0.18)), 'rgba(0,0,0,0.6)', s);
    }
    // 테두리 돌
    g.strokeStyle = shade(stone, dim * 1.2); g.lineWidth = 3 * s;
    g.beginPath();
    if (ax) { g.moveTo(...Pp(0.5, -0.5, 0)); g.lineTo(...Pp(-0.5, -0.5, 0)); g.moveTo(...Pp(0.5, 0.5, 0)); g.lineTo(...Pp(-0.5, 0.5, 0)); }
    else { g.moveTo(...Pp(-0.5, 0.5, 0)); g.lineTo(...Pp(-0.5, -0.5, 0)); g.moveTo(...Pp(0.5, 0.5, 0)); g.lineTo(...Pp(0.5, -0.5, 0)); }
    g.stroke();
    // 아래에서 올라오는 붉은 기운
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(120,30,10,0.25)'; g.beginPath(); g.ellipse(...Pp(ax ? -0.3 : 0, ax ? 0 : -0.3, -10), 18 * s, 9 * s, 0, 0, PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  } else {
    // 벽 쪽으로 올라가는 계단
    const N = 5;
    for (let i = 0; i < N; i++) {
      const k = 0.5 - (i + 0.5) / N, h = (i + 1) * 9;
      if (ax) isoBox(g, px, py, s, k, 0, 0.5 / N, 0.45, 0, h, shade(stone, dim * (0.9 + i * 0.04)));
      else isoBox(g, px, py, s, 0, k, 0.45, 0.5 / N, 0, h, shade(stone, dim * (0.9 + i * 0.04)));
    }
  }
}

function drawShrine(g, o, px, py, s, t, dim) {
  isoBox(g, px, py, s, 0, 0, 0.3, 0.3, 0, 8, shade('#5e5a56', dim));
  isoBox(g, px, py, s, 0, 0, 0.16, 0.16, 8, 22, shade('#6e6a64', dim));
  const c = o.col || [120, 200, 255];
  const y = SY(py, s, 0, 0, 38);
  if (!o.used) {
    const p = 0.75 + 0.25 * Math.sin(t * 3 + o.x);
    g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.9 * p})`;
    g.beginPath(); g.arc(px, y, 5.5 * s, 0, PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(px - 1.5 * s, y - 1.5 * s, 1.8 * s, 0, PI * 2); g.fill();
  } else {
    g.fillStyle = '#2a2826'; g.beginPath(); g.arc(px, y, 5 * s, 0, PI * 2); g.fill();
  }
}

function drawWaypoint(g, o, px, py, s, t) {
  g.save(); g.translate(px, py); g.scale(1, 0.5);
  g.fillStyle = '#4a4a50'; g.beginPath(); g.arc(0, 0, 40 * s, 0, PI * 2); g.fill();
  g.strokeStyle = '#2a2a30'; g.lineWidth = 3 * s; g.stroke();
  g.fillStyle = '#5a5a62'; g.beginPath(); g.arc(0, 0, 30 * s, 0, PI * 2); g.fill();
  const on = o.active;
  g.strokeStyle = on ? `rgba(130,180,255,${0.7 + 0.3 * Math.sin(t * 3)})` : 'rgba(80,80,100,0.6)'; g.lineWidth = 2 * s;
  for (let i = 0; i < 8; i++) { const a = i * PI / 4 + (on ? t * 0.5 : 0); g.beginPath(); g.arc(0, 0, 24 * s, a, a + 0.4); g.stroke(); }
  g.beginPath(); g.arc(0, 0, 14 * s, 0, PI * 2); g.stroke();
  g.restore();
  if (on) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = t * 1.5 + i * PI / 3, r = 22 * s, h = ((t * 30 + i * 13) % 40) * s;
      g.fillStyle = `rgba(140,190,255,${0.6 * (1 - h / (40 * s))})`;
      g.beginPath(); g.arc(px + Math.cos(a) * r, py + Math.sin(a) * r * 0.5 - h, 1.6 * s, 0, PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
}

function drawPortal(g, o, px, py, s, t) {
  const red = o.red, k = Math.min(1, (o.age ?? 1) * 2);
  const cx = px, cy = py - 34 * s * k, rx = 17 * s * k, ry = 32 * s * k;
  g.globalCompositeOperation = 'lighter';
  for (let i = 4; i >= 0; i--) {
    g.fillStyle = red ? `rgba(${200 + i * 10},${40 + i * 15},${30},${0.18})` : `rgba(${40 + i * 15},${90 + i * 25},255,${0.18})`;
    g.beginPath(); g.ellipse(cx, cy, rx * (1 + i * 0.12), ry * (1 + i * 0.06), 0, 0, PI * 2); g.fill();
  }
  g.strokeStyle = red ? 'rgba(255,170,120,0.8)' : 'rgba(180,220,255,0.85)'; g.lineWidth = 1.5 * s;
  for (let i = 0; i < 4; i++) {
    const a = t * 3 + i * PI / 2;
    g.beginPath(); g.ellipse(cx, cy, rx * 0.7, ry * 0.8, 0, a, a + 1.6); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = red ? 'rgba(60,0,0,0.5)' : 'rgba(0,10,40,0.5)';
  g.beginPath(); g.ellipse(cx, cy, rx * 0.45, ry * 0.6, 0, 0, PI * 2); g.fill();
}

function drawTree(g, o, px, py, s, t) {
  const k = o.size || 1, sway = Math.sin(t * 0.8 + o.x) * 2 * s;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(px, py, 30 * s * k, 14 * s * k, 0, 0, PI * 2); g.fill();
  g.strokeStyle = '#3a2a1c'; g.lineWidth = 6 * s * k; g.lineCap = 'round';
  g.beginPath(); g.moveTo(px, py); g.lineTo(px + sway * 0.3, py - 50 * s * k); g.stroke();
  if (o.dead) {
    g.lineWidth = 2.5 * s * k;
    for (let i = 0; i < 6; i++) { const a = -PI / 2 + (i - 2.5) * 0.45; const l = (24 + (i % 3) * 8) * s * k; g.beginPath(); g.moveTo(px + sway * 0.3, py - (36 + i * 4) * s * k); g.lineTo(px + Math.cos(a) * l + sway, py - (36 + i * 4) * s * k + Math.sin(a) * l); g.stroke(); }
    return;
  }
  const leaf = o.pine ? ['#1e3020', '#284030', '#30503a'] : ['#2a3a1c', '#3a4c24', '#4a5e2e'];
  for (let i = 0; i < 3; i++) {
    const y = py - (60 + i * 16) * s * k, r = (30 - i * 7) * s * k;
    g.fillStyle = leaf[i];
    g.beginPath();
    if (o.pine) { g.moveTo(px - r + sway, y + r * 0.4); g.lineTo(px + sway * 1.3, y - r * 1.1); g.lineTo(px + r + sway, y + r * 0.4); g.closePath(); }
    else g.ellipse(px + sway * (1 + i * 0.2), y, r, r * 0.8, 0, 0, PI * 2);
    g.fill();
  }
}

// 마을 집: 발판(fw × fh 칸)을 차지하는 상자 + 지붕
function drawHouse(g, o, px, py, s, t, L) {
  const w = o.w, h = o.h; // 칸 수(x, y)
  // o.x, o.y는 발판의 가장 깊은(앞) 칸. 중심은 그보다 (w-1)/2, (h-1)/2 뒤
  const cx = -(w - 1) / 2, cy = -(h - 1) / 2, hx = w / 2 - 0.05, hy = h / 2 - 0.05;
  const wallH = o.wallH || 52, roofH = o.roofH || 40;
  isoBox(g, px, py, s, cx, cy, hx, hy, 0, wallH, o.wallCol || '#8a7a62');
  // 목조 골조
  g.strokeStyle = '#3a2a1c'; g.lineWidth = 2.2 * s;
  const Pp = (a, b, z) => [SX(px, s, cx + a, cy + b), SY(py, s, cx + a, cy + b, z)];
  for (let i = 0; i <= w; i++) { const a = -hx + (i / w) * hx * 2; g.beginPath(); g.moveTo(...Pp(a, hy, 0)); g.lineTo(...Pp(a, hy, wallH)); g.stroke(); }
  for (let i = 0; i <= h; i++) { const b = hy - (i / h) * hy * 2; g.beginPath(); g.moveTo(...Pp(hx, b, 0)); g.lineTo(...Pp(hx, b, wallH)); g.stroke(); }
  g.beginPath(); g.moveTo(...Pp(-hx, hy, wallH * 0.5)); g.lineTo(...Pp(hx, hy, wallH * 0.5)); g.lineTo(...Pp(hx, -hy, wallH * 0.5)); g.stroke();
  // 문과 창
  if (o.door) {
    const [dx, dy] = o.door; // 문 위치(발판 기준 오프셋)
    const front = dy >= h - 1 ? 'y' : 'x';
    if (front === 'y') { const a = -hx + dx + 0.5 - 0.22; g.fillStyle = '#2a1a10'; poly(g, [...Pp(a, hy + 0.01, 0), ...Pp(a + 0.44, hy + 0.01, 0), ...Pp(a + 0.44, hy + 0.01, 30), ...Pp(a, hy + 0.01, 30)], '#3a2414', OUTC, s); }
    else { const b = -hy + dy + 0.5 - 0.22; poly(g, [...Pp(hx + 0.01, b, 0), ...Pp(hx + 0.01, b + 0.44, 0), ...Pp(hx + 0.01, b + 0.44, 30), ...Pp(hx + 0.01, b, 30)], '#2e1c10', OUTC, s); }
  }
  const lit = 0.6 + 0.4 * Math.sin(t * 2 + o.x);
  for (let i = 0; i < w; i++) { if (o.door && o.door[0] === i && o.door[1] >= h - 1) continue; const a = -hx + i + 0.5; poly(g, [...Pp(a - 0.13, hy + 0.01, 24), ...Pp(a + 0.13, hy + 0.01, 24), ...Pp(a + 0.13, hy + 0.01, 38), ...Pp(a - 0.13, hy + 0.01, 38)], `rgba(255,${170 + 30 * lit},90,0.9)`, '#2a1a10', s); }
  // 지붕(박공)
  const rc = o.roofCol || '#4a3026';
  const ov = 0.18;
  if (w >= h) {
    const r1 = [...Pp(-hx - ov, -hy - ov, wallH), ...Pp(hx + ov, -hy - ov, wallH), ...Pp(hx + ov, 0, wallH + roofH), ...Pp(-hx - ov, 0, wallH + roofH)];
    const r2 = [...Pp(-hx - ov, hy + ov, wallH), ...Pp(hx + ov, hy + ov, wallH), ...Pp(hx + ov, 0, wallH + roofH), ...Pp(-hx - ov, 0, wallH + roofH)];
    poly(g, r1, shade(rc, 1.2), OUTC, s);
    poly(g, [...Pp(hx, -hy, wallH), ...Pp(hx, hy, wallH), ...Pp(hx, 0, wallH + roofH)], shade(o.wallCol || '#8a7a62', 0.6), OUTC, s);
    poly(g, r2, shade(rc, 0.95), OUTC, s);
    g.strokeStyle = shade(rc, 0.7); g.lineWidth = 1 * s;
    for (let i = 1; i < 6; i++) { const k = i / 6; g.beginPath(); g.moveTo(...Pp(-hx - ov, hy + ov - k * (hy + ov), wallH + roofH * k)); g.lineTo(...Pp(hx + ov, hy + ov - k * (hy + ov), wallH + roofH * k)); g.stroke(); }
  } else {
    const r1 = [...Pp(-hx - ov, -hy - ov, wallH), ...Pp(-hx - ov, hy + ov, wallH), ...Pp(0, hy + ov, wallH + roofH), ...Pp(0, -hy - ov, wallH + roofH)];
    const r2 = [...Pp(hx + ov, -hy - ov, wallH), ...Pp(hx + ov, hy + ov, wallH), ...Pp(0, hy + ov, wallH + roofH), ...Pp(0, -hy - ov, wallH + roofH)];
    poly(g, r1, shade(rc, 1.2), OUTC, s);
    poly(g, [...Pp(-hx, hy, wallH), ...Pp(hx, hy, wallH), ...Pp(0, hy, wallH + roofH)], shade(o.wallCol || '#8a7a62', 0.85), OUTC, s);
    poly(g, r2, shade(rc, 0.8), OUTC, s);
    g.strokeStyle = shade(rc, 0.6); g.lineWidth = 1 * s;
    for (let i = 1; i < 6; i++) { const k = i / 6; g.beginPath(); g.moveTo(...Pp(hx + ov - k * (hx + ov), -hy - ov, wallH + roofH * k)); g.lineTo(...Pp(hx + ov - k * (hx + ov), hy + ov, wallH + roofH * k)); g.stroke(); }
  }
  if (o.chimney) {
    isoBox(g, px, py, s, cx + hx * 0.5, cy - hy * 0.3, 0.12, 0.12, wallH + roofH * 0.5, roofH * 0.8, '#5a4a40');
    const [x, y] = Pp(hx * 0.5, -hy * 0.3, wallH + roofH * 1.35);
    for (let i = 0; i < 3; i++) { const k = ((t * 0.3 + i / 3) % 1); g.fillStyle = `rgba(120,120,120,${0.25 * (1 - k)})`; g.beginPath(); g.arc(x + k * 10 * s, y - k * 40 * s, (3 + k * 8) * s, 0, PI * 2); g.fill(); }
  }
  if (o.sign) {
    const [x, y] = Pp(hx * 0.3, hy + 0.3, wallH - 6);
    g.fillStyle = '#4a3020'; g.fillRect(x - 12 * s, y - 7 * s, 24 * s, 12 * s);
    g.strokeStyle = '#c8a050'; g.lineWidth = 1 * s; g.strokeRect(x - 12 * s, y - 7 * s, 24 * s, 12 * s);
    g.fillStyle = '#e0c890'; g.font = `${8 * s}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.sign, x, y - 1 * s);
  }
}

// ───────── 바닥 장식 ─────────
export function drawDecal(g, d, px, py, s, dim) {
  g.save();
  g.setTransform(32 * s, 16 * s, -32 * s, 16 * s, px, py);
  g.rotate(d.rot || 0);
  const k = d.s || 1;
  g.globalAlpha = (d.a ?? 1) * (dim ? 0.5 : 1);
  switch (d.kind) {
    case 'blood': {
      g.fillStyle = d.col || 'rgba(110,8,6,0.75)';
      g.beginPath(); g.arc(0, 0, 0.16 * k, 0, PI * 2); g.fill();
      for (let i = 0; i < 5; i++) { const a = i * 1.37 + (d.rot || 0) * 3; g.beginPath(); g.arc(Math.cos(a) * 0.17 * k, Math.sin(a) * 0.17 * k, 0.05 * k * (1 + (i % 3) * 0.4), 0, PI * 2); g.fill(); }
      break;
    }
    case 'bones': {
      g.strokeStyle = 'rgba(200,190,170,0.85)'; g.lineWidth = 0.03; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-0.15 * k, 0); g.lineTo(0.15 * k, 0.04); g.moveTo(-0.05, -0.1 * k); g.lineTo(0.08, 0.12 * k); g.stroke();
      g.fillStyle = 'rgba(210,200,180,0.9)'; g.beginPath(); g.arc(0.12 * k, -0.08 * k, 0.05 * k, 0, PI * 2); g.fill();
      break;
    }
    case 'rubble': case 'rocks': {
      g.fillStyle = d.kind === 'rocks' ? 'rgba(90,70,50,0.9)' : 'rgba(100,95,88,0.9)';
      for (let i = 0; i < 5; i++) { const a = i * 1.9; g.beginPath(); g.arc(Math.cos(a) * 0.14 * k, Math.sin(a) * 0.14 * k, 0.035 * k * (1 + (i % 2)), 0, PI * 2); g.fill(); }
      break;
    }
    case 'crack': {
      g.strokeStyle = 'rgba(15,10,8,0.6)'; g.lineWidth = 0.015;
      g.beginPath(); g.moveTo(-0.25 * k, -0.05); g.lineTo(-0.05, 0.03); g.lineTo(0.08, -0.04); g.lineTo(0.25 * k, 0.05); g.moveTo(-0.05, 0.03); g.lineTo(0, 0.18 * k); g.stroke();
      break;
    }
    case 'scorch': {
      g.fillStyle = 'rgba(10,6,4,0.5)'; g.beginPath(); g.arc(0, 0, 0.3 * k, 0, PI * 2); g.fill();
      break;
    }
    case 'acid': {
      g.fillStyle = 'rgba(80,160,40,0.55)'; g.beginPath(); g.arc(0, 0, 0.3 * k, 0, PI * 2); g.fill();
      break;
    }
    case 'pent': {
      g.strokeStyle = 'rgba(150,20,10,0.7)'; g.lineWidth = 0.04;
      g.beginPath(); g.arc(0, 0, 1.6 * k, 0, PI * 2); g.stroke();
      g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -PI / 2 + i * PI * 4 / 5; const x = Math.cos(a) * 1.6 * k, y = Math.sin(a) * 1.6 * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      break;
    }
  }
  g.restore();
}

// 바닥에 떨어진 아이템: 작은 그림 + 등급 반짝임
export function drawGroundItem(g, it, px, py, s, t) {
  const item = it.item;
  const bounce = it.drop > 0 ? Math.sin((1 - it.drop) * PI) * 24 * s : 0;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(px, py, 10 * s, 5 * s, 0, 0, PI * 2); g.fill();
  if (it.gold) {
    const n = Math.min(6, 1 + Math.floor(Math.log2(1 + it.gold)));
    for (let i = 0; i < n; i++) {
      const a = i * 2.3, x = px + Math.cos(a) * (i ? 4 : 0) * s, y = py - bounce + Math.sin(a) * (i ? 2 : 0) * s - i * 1.2 * s;
      g.fillStyle = '#7a5a10'; g.beginPath(); g.ellipse(x, y + 1 * s, 4 * s, 2 * s, 0, 0, PI * 2); g.fill();
      g.fillStyle = '#e8c040'; g.beginPath(); g.ellipse(x, y, 4 * s, 2 * s, 0, 0, PI * 2); g.fill();
    }
    return;
  }
  if (!item) return;
  // 긴 무기는 비스듬히 눕혀 그리니 상자를 조금 크게
  const b = BASE[item.b], size = Math.round((b && b.h > b.w ? 30 : 22) * s);
  drawItemIcon(g, item, Math.round(px - size / 2), Math.round(py - bounce - 6 * s - size / 2), size, size, true);
  // 등급별 반짝임
  const q = item.q;
  if (q === 'unique' || q === 'rare' || q === 'set') {
    const c = q === 'unique' ? '255,200,90' : q === 'set' ? '90,255,90' : '255,255,110';
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(${c},${0.25 + 0.2 * Math.sin(t * 5 + it.x)})`;
    g.beginPath(); g.arc(px, py - 6 * s, 12 * s, 0, PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
}

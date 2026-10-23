// 아이템 그림: 인벤토리 칸과 바닥에 같은 그림을 쓴다(모두 벡터로 그린다)
import { shade } from './noise.js';
import { BASE } from '../data/items.js';
import { UNIQUE } from '../data/uniques.js';

const PI = Math.PI;
const OUT = 'rgba(8,6,4,0.95)';

function line(g, x1, y1, x2, y2, w, c, o = 1.5) {
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  if (o) { g.strokeStyle = OUT; g.lineWidth = w + o * 2; g.stroke(); }
  g.strokeStyle = c; g.lineWidth = w; g.stroke();
}
function poly(g, pts, c, o = 1.4, hl) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (o) { g.strokeStyle = OUT; g.lineWidth = o * 2; g.lineJoin = 'round'; g.stroke(); }
  if (hl) {
    let minY = 1e9, maxY = -1e9; for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
    let minX = 1e9, maxX = -1e9; for (let i = 0; i < pts.length; i += 2) { minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]); }
    const gr = g.createLinearGradient(minX, minY, maxX, maxY);
    gr.addColorStop(0, shade(c, 1.35)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, 0.6));
    g.fillStyle = gr;
  } else g.fillStyle = c;
  g.fill();
}
function circ(g, x, y, r, c, o = 1.4, hl = true) {
  g.beginPath(); g.arc(x, y, r, 0, PI * 2);
  if (o) { g.strokeStyle = OUT; g.lineWidth = o * 2; g.stroke(); }
  if (hl) { const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, shade(c, 1.6)); gr.addColorStop(1, shade(c, 0.7)); g.fillStyle = gr; } else g.fillStyle = c;
  g.fill();
}

// 비스듬히 놓인 날붙이를 그리기 위한 좌표계: 칸 대각선 방향
export function drawItemIcon(g, item, x, y, w, h, ground = false) {
  const ic = (item.u && UNIQUE[item.u]?.icon) || item.icon || BASE[item.b]?.icon || { t: 'misc' };
  const m = Math.min(w, h);
  const lw = Math.max(1, m * 0.035);
  g.save();
  g.translate(x + w / 2, y + h / 2);
  const c1 = ic.c1 || '#c8ccd4', c2 = ic.c2 || '#6a4a2a', c3 = ic.c3 || '#c8a040';
  // 바닥에 놓인 길쭉한 것은 비스듬히 눕힌다
  const tall = h > w * 1.4;
  if (ground && (ic.t === 'sword' || ic.t === 'axe' || ic.t === 'mace' || ic.t === 'staff' || ic.t === 'bow' || ic.t === 'spear')) g.rotate(-0.9);
  const S = ground ? m * 0.9 : Math.max(w, h) * 0.92; // 길이 기준
  const W = ground ? m * 0.4 : w * 0.9;
  switch (ic.t) {
    case 'sword': {
      const L = S, bw = W * (ic.wide || 0.18) * (ground ? 1.6 : 1);
      const top = -L / 2, guard = top + L * (ic.blade || 0.68), bot = L / 2;
      const curve = ic.curve || 0;
      // 날
      poly(g, [-bw / 2, guard, -bw / 2 + curve * bw, top + bw * 0.8, curve * bw * 1.5, top, bw / 2 + curve * bw * 0.6, top + bw * 0.6, bw / 2, guard], c1, lw, true);
      line(g, 0, guard - 2, curve * bw * 0.9, top + bw, Math.max(0.8, bw * 0.12), shade(c1, 1.4), 0);
      // 코등이·손잡이·머리
      line(g, -bw * (ic.guardW || 1.6), guard, bw * (ic.guardW || 1.6), guard, Math.max(1.5, bw * 0.3), c3, lw);
      line(g, 0, guard + 2, 0, bot - bw * 0.5, Math.max(1.5, bw * 0.38), c2, lw);
      circ(g, 0, bot - bw * 0.4, Math.max(1.2, bw * 0.32), c3, lw);
      break;
    }
    case 'axe': {
      const L = S, hw = W * 0.12 * (ground ? 1.6 : 1);
      line(g, 0, -L / 2 + 2, 0, L / 2, Math.max(1.5, hw), c2, lw);
      const hy = -L / 2 + L * 0.18, hs = (ic.head || 1) * W * 0.5 * (ground ? 1.4 : 1);
      poly(g, [0, hy - hs * 0.5, hs * 1.0, hy - hs * 0.9, hs * 1.15, hy + hs * 0.2, hs * 0.9, hy + hs * 0.75, 0, hy + hs * 0.35], c1, lw, true);
      if (ic.double) poly(g, [0, hy - hs * 0.5, -hs * 1.0, hy - hs * 0.9, -hs * 1.15, hy + hs * 0.2, -hs * 0.9, hy + hs * 0.75, 0, hy + hs * 0.35], c1, lw, true);
      break;
    }
    case 'mace': {
      const L = S, hw = W * 0.12 * (ground ? 1.6 : 1);
      line(g, 0, -L / 2 + L * 0.2, 0, L / 2, Math.max(1.5, hw), c2, lw);
      const r = W * 0.26 * (ic.head || 1) * (ground ? 1.4 : 1), cy = -L / 2 + r * 1.2;
      if (ic.v === 'hammer') { poly(g, [-r * 1.4, cy - r * 0.7, r * 1.4, cy - r * 0.7, r * 1.4, cy + r * 0.7, -r * 1.4, cy + r * 0.7], c1, lw, true); }
      else if (ic.v === 'club') { poly(g, [-hw, L / 2 - 4, -r * 0.8, cy, 0, cy - r, r * 0.8, cy, hw, L / 2 - 4], c2, lw, true); }
      else {
        if (ic.v === 'spiked' || ic.v === 'star') for (let i = 0; i < 8; i++) { const a = i * PI / 4; line(g, 0, cy, Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5, Math.max(1, r * 0.25), c1, lw * 0.6); }
        if (ic.v === 'flail') { line(g, 0, -L / 2 + L * 0.2, r * 0.6, cy + r * 0.4, 1, '#888', 0); }
        circ(g, 0, cy, r, c1, lw);
      }
      break;
    }
    case 'spear': {
      const L = S;
      line(g, 0, -L / 2 + L * 0.15, 0, L / 2, Math.max(1.5, W * 0.1), c2, lw);
      poly(g, [0, -L / 2, W * 0.16, -L / 2 + L * 0.2, 0, -L / 2 + L * 0.17, -W * 0.16, -L / 2 + L * 0.2], c1, lw, true);
      break;
    }
    case 'bow': {
      const L = S, bw = W * 0.35 * (ground ? 1.4 : 1);
      g.beginPath(); g.moveTo(-bw * 0.2, -L / 2); g.quadraticCurveTo(bw * 1.4, 0, -bw * 0.2, L / 2);
      g.strokeStyle = OUT; g.lineWidth = Math.max(2, W * 0.12) + lw * 2; g.lineCap = 'round'; g.stroke();
      g.strokeStyle = c2; g.lineWidth = Math.max(2, W * 0.12); g.stroke();
      g.strokeStyle = 'rgba(230,220,200,0.85)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-bw * 0.2, -L / 2); g.lineTo(-bw * 0.2, L / 2); g.stroke();
      line(g, bw * 0.45, -L * 0.06, bw * 0.45, L * 0.06, Math.max(2, W * 0.14), c3, 0);
      break;
    }
    case 'staff': {
      const L = S;
      line(g, 0, -L / 2 + 4, 0, L / 2, Math.max(1.5, W * 0.12), c2, lw);
      if (ic.v === 'orb') circ(g, 0, -L / 2 + W * 0.22, W * 0.2, c1, lw);
      else { poly(g, [0, -L / 2, W * 0.18, -L / 2 + W * 0.3, 0, -L / 2 + W * 0.55, -W * 0.18, -L / 2 + W * 0.3], c1, lw, true); }
      line(g, -W * 0.15, -L / 2 + W * 0.6, W * 0.15, -L / 2 + W * 0.6, 2, c3, 0);
      break;
    }
    case 'armor': {
      const Ww = (ground ? m * 0.85 : w * 0.9), Hh = (ground ? m * 0.9 : h * 0.92);
      const v = ic.v || 'leather';
      const sw = Ww / 2, top = -Hh / 2, bot = Hh / 2;
      if (v === 'robe') {
        poly(g, [-sw * 0.45, top, sw * 0.45, top, sw * 0.95, top + Hh * 0.2, sw * 0.7, top + Hh * 0.3, sw * 0.8, bot, -sw * 0.8, bot, -sw * 0.7, top + Hh * 0.3, -sw * 0.95, top + Hh * 0.2], c1, lw, true);
        line(g, 0, top + Hh * 0.1, 0, bot - 2, 1, shade(c1, 0.6), 0);
      } else {
        poly(g, [-sw * 0.42, top, -sw * 0.15, top + Hh * 0.12, sw * 0.15, top + Hh * 0.12, sw * 0.42, top, sw, top + Hh * 0.18, sw * 0.82, top + Hh * 0.5, sw * 0.62, top + Hh * 0.42, sw * 0.6, bot, -sw * 0.6, bot, -sw * 0.62, top + Hh * 0.42, -sw * 0.82, top + Hh * 0.5, -sw, top + Hh * 0.18], c1, lw, true);
        if (v === 'chain' || v === 'ring' || v === 'scale') {
          g.strokeStyle = shade(c1, 0.6); g.lineWidth = 0.8;
          for (let yy = top + Hh * 0.22; yy < bot - 2; yy += Math.max(3, Hh * 0.07)) for (let xx = -sw * 0.5; xx < sw * 0.5; xx += Math.max(3, Ww * 0.08)) { g.beginPath(); g.arc(xx + ((yy / 3) % 2) * 1.5, yy, Math.max(1, Ww * 0.025), 0, PI); g.stroke(); }
        } else if (v === 'plate' || v === 'field' || v === 'gothic' || v === 'full') {
          line(g, 0, top + Hh * 0.16, 0, bot - 3, 1.2, shade(c1, 1.5), 0);
          g.strokeStyle = shade(c1, 0.55); g.lineWidth = 1;
          for (let k = 1; k < 4; k++) { const yy = top + Hh * (0.45 + k * 0.13); g.beginPath(); g.moveTo(-sw * 0.58, yy); g.lineTo(sw * 0.58, yy); g.stroke(); }
          circ(g, -sw * 0.8, top + Hh * 0.18, Ww * 0.12, shade(c1, 1.1), lw); circ(g, sw * 0.8, top + Hh * 0.18, Ww * 0.12, shade(c1, 1.1), lw);
        } else if (v === 'studded') {
          g.fillStyle = '#c8b890';
          for (let yy = top + Hh * 0.3; yy < bot - 3; yy += Hh * 0.13) for (let xx = -sw * 0.4; xx <= sw * 0.4; xx += Ww * 0.2) { g.beginPath(); g.arc(xx, yy, Math.max(0.8, Ww * 0.025), 0, PI * 2); g.fill(); }
        } else {
          line(g, -sw * 0.6, top + Hh * 0.62, sw * 0.6, top + Hh * 0.62, Math.max(1.5, Hh * 0.05), '#3a2614', 0);
        }
      }
      break;
    }
    case 'helm': {
      const r = (ground ? m * 0.36 : Math.min(w, h) * 0.4), v = ic.v || 'helm';
      if (v === 'cap') { poly(g, [-r, r * 0.25, -r * 0.8, -r * 0.5, 0, -r * 0.85, r * 0.8, -r * 0.5, r, r * 0.25], c1, lw, true); line(g, -r, r * 0.25, r, r * 0.25, 2, shade(c1, 0.6), 0); }
      else if (v === 'crown') { poly(g, [-r, r * 0.4, -r, -r * 0.5, -r * 0.5, 0, 0, -r * 0.8, r * 0.5, 0, r, -r * 0.5, r, r * 0.4], c3 || '#d8b040', lw, true); circ(g, 0, r * 0.05, r * 0.15, '#c02020', 1); }
      else {
        g.beginPath(); g.arc(0, 0, r, PI, 0); g.lineTo(r, r * 0.6); g.lineTo(-r, r * 0.6); g.closePath();
        g.strokeStyle = OUT; g.lineWidth = lw * 2; g.stroke();
        const gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, shade(c1, 1.4)); gr.addColorStop(1, shade(c1, 0.6)); g.fillStyle = gr; g.fill();
        if (v === 'full' || v === 'great') { line(g, -r * 0.6, 0, r * 0.6, 0, Math.max(1.5, r * 0.15), '#0a0806', 0); if (v === 'great') line(g, 0, -r * 0.05, 0, r * 0.55, Math.max(1.2, r * 0.12), '#0a0806', 0); }
        else if (v === 'skull') { circ(g, -r * 0.35, -r * 0.1, r * 0.17, '#140c08', 0, false); circ(g, r * 0.35, -r * 0.1, r * 0.17, '#140c08', 0, false); }
        else { line(g, 0, -r * 0.9, 0, r * 0.5, Math.max(1.2, r * 0.12), shade(c1, 0.6), 0); }
        if (ic.horns) for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * r * 0.8, -r * 0.4); g.quadraticCurveTo(sd * r * 1.4, -r * 0.6, sd * r * 1.2, -r * 1.3); g.strokeStyle = '#ddd0b0'; g.lineWidth = r * 0.2; g.stroke(); }
      }
      break;
    }
    case 'shield': {
      const Ww = ground ? m * 0.8 : w * 0.88, Hh = ground ? m * 0.85 : h * 0.9, v = ic.v || 'round';
      if (v === 'round' || v === 'buckler') { circ(g, 0, 0, Math.min(Ww, Hh) / 2, c1, lw); circ(g, 0, 0, Math.min(Ww, Hh) * 0.13, c3, 1); g.strokeStyle = c3; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, Math.min(Ww, Hh) / 2 - 2, 0, PI * 2); g.stroke(); }
      else if (v === 'kite') { poly(g, [0, -Hh / 2, Ww / 2, -Hh * 0.3, Ww * 0.42, Hh * 0.05, 0, Hh / 2, -Ww * 0.42, Hh * 0.05, -Ww / 2, -Hh * 0.3], c1, lw, true); line(g, 0, -Hh * 0.4, 0, Hh * 0.38, 2, c3, 0); line(g, -Ww * 0.35, -Hh * 0.15, Ww * 0.35, -Hh * 0.15, 2, c3, 0); }
      else if (v === 'tower') { poly(g, [-Ww / 2, -Hh / 2 + 3, 0, -Hh / 2, Ww / 2, -Hh / 2 + 3, Ww / 2, Hh / 2 - 6, 0, Hh / 2, -Ww / 2, Hh / 2 - 6], c1, lw, true); g.strokeStyle = c3; g.lineWidth = 1.5; for (const k of [-0.25, 0.25]) { g.beginPath(); g.moveTo(-Ww / 2 + 2, Hh * k); g.lineTo(Ww / 2 - 2, Hh * k); g.stroke(); } }
      else { poly(g, [-Ww / 2, -Hh / 2, Ww / 2, -Hh / 2, Ww / 2, Hh * 0.1, 0, Hh / 2, -Ww / 2, Hh * 0.1], c1, lw, true); circ(g, 0, -Hh * 0.08, Math.min(Ww, Hh) * 0.13, c3, 1); }
      break;
    }
    case 'gloves': {
      const r = (ground ? m * 0.35 : Math.min(w, h) * 0.42);
      poly(g, [-r * 0.6, r, -r * 0.65, -r * 0.1, -r * 0.9, -r * 0.4, -r * 0.6, -r * 0.55, -r * 0.4, -r * 0.2, -r * 0.35, -r * 0.95, -r * 0.1, -r, 0, -r * 0.3, r * 0.05, -r, r * 0.3, -r * 0.95, r * 0.35, -r * 0.25, r * 0.5, -r * 0.8, r * 0.7, -r * 0.7, r * 0.6, r], c1, lw, true);
      line(g, -r * 0.6, r * 0.7, r * 0.6, r * 0.7, 2, shade(c1, 0.6), 0);
      break;
    }
    case 'belt': {
      const Ww = ground ? m * 0.85 : w * 0.92, Hh = ground ? m * 0.3 : h * 0.45;
      poly(g, [-Ww / 2, -Hh / 2, Ww / 2, -Hh / 2, Ww / 2, Hh / 2, -Ww / 2, Hh / 2], c1, lw, true);
      poly(g, [-Hh * 0.6, -Hh * 0.7, Hh * 0.6, -Hh * 0.7, Hh * 0.6, Hh * 0.7, -Hh * 0.6, Hh * 0.7], c3, 1);
      g.fillStyle = shade(c1, 0.5); g.fillRect(-Hh * 0.3, -Hh * 0.35, Hh * 0.6, Hh * 0.7);
      break;
    }
    case 'boots': {
      const r = (ground ? m * 0.38 : Math.min(w, h) * 0.44);
      poly(g, [-r * 0.5, -r, r * 0.2, -r, r * 0.2, r * 0.25, r, r * 0.45, r, r, -r * 0.55, r, -r * 0.6, r * 0.2], c1, lw, true);
      line(g, -r * 0.5, -r * 0.6, r * 0.2, -r * 0.6, 1.5, shade(c1, 0.6), 0);
      break;
    }
    case 'ring': {
      const r = (ground ? m * 0.28 : Math.min(w, h) * 0.3);
      g.beginPath(); g.ellipse(0, r * 0.2, r, r * 0.8, 0, 0, PI * 2);
      g.strokeStyle = OUT; g.lineWidth = r * 0.35 + 2; g.stroke(); g.strokeStyle = c3 || '#d8b040'; g.lineWidth = r * 0.35; g.stroke();
      circ(g, 0, -r * 0.55, r * 0.38, c1, 1);
      break;
    }
    case 'amulet': {
      const r = (ground ? m * 0.32 : Math.min(w, h) * 0.36);
      g.beginPath(); g.moveTo(-r * 0.9, -r); g.quadraticCurveTo(0, r * 0.2, r * 0.9, -r); g.strokeStyle = '#c8a850'; g.lineWidth = Math.max(1, r * 0.1); g.stroke();
      poly(g, [0, -r * 0.05, r * 0.45, r * 0.4, 0, r * 1.0, -r * 0.45, r * 0.4], c3 || '#d8b040', lw, true);
      circ(g, 0, r * 0.42, r * 0.22, c1, 1);
      break;
    }
    case 'potion': {
      const r = (ground ? m * 0.3 : Math.min(w, h) * 0.34) * (ic.big ? 1.1 : 0.9);
      g.beginPath(); g.arc(0, r * 0.35, r * 0.75, 0, PI * 2);
      g.rect(-r * 0.22, -r * 0.85, r * 0.44, r * 0.7);
      g.strokeStyle = OUT; g.lineWidth = 2.6; g.stroke();
      g.fillStyle = 'rgba(200,220,230,0.35)'; g.fill();
      g.beginPath(); g.arc(0, r * 0.35, r * 0.68, -0.15, PI + 0.15);
      const gr = g.createRadialGradient(-r * 0.2, r * 0.2, r * 0.1, 0, r * 0.35, r * 0.8); gr.addColorStop(0, shade(c1, 1.6)); gr.addColorStop(1, shade(c1, 0.7));
      g.fillStyle = gr; g.fill();
      g.fillStyle = '#8a6a40'; g.fillRect(-r * 0.27, -r * 1.0, r * 0.54, r * 0.25);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-r * 0.3, r * 0.1, r * 0.12, r * 0.25, 0.4, 0, PI * 2); g.fill();
      break;
    }
    case 'scroll': {
      const Ww = (ground ? m * 0.7 : w * 0.8), Hh = Ww * 0.55;
      poly(g, [-Ww / 2, -Hh / 2, Ww / 2, -Hh / 2, Ww / 2, Hh / 2, -Ww / 2, Hh / 2], '#d8c8a0', lw, true);
      circ(g, -Ww / 2, 0, Hh * 0.55, '#c8b890', lw, true); circ(g, Ww / 2, 0, Hh * 0.55, '#c8b890', lw, true);
      line(g, 0, -Hh / 2, 0, Hh / 2, Math.max(2, Hh * 0.25), c1, 0);
      break;
    }
    case 'book': {
      const Ww = (ground ? m * 0.6 : w * 0.75), Hh = (ground ? m * 0.7 : h * 0.8);
      poly(g, [-Ww / 2, -Hh / 2, Ww / 2, -Hh / 2, Ww / 2, Hh / 2, -Ww / 2, Hh / 2], c1, lw, true);
      g.fillStyle = '#e0d4b0'; g.fillRect(Ww / 2 - 3, -Hh / 2 + 2, 2, Hh - 4);
      circ(g, 0, 0, Math.min(Ww, Hh) * 0.16, c3, 1);
      break;
    }
    case 'gem': {
      const r = (ground ? m * 0.25 : Math.min(w, h) * 0.3);
      poly(g, [0, -r, r, -r * 0.2, r * 0.6, r, -r * 0.6, r, -r, -r * 0.2], c1, lw, true);
      break;
    }
    case 'skull': { const r = m * 0.32; circ(g, 0, -r * 0.1, r, '#d8d0b8', lw); circ(g, -r * 0.35, -r * 0.1, r * 0.22, '#1a120c', 0, false); circ(g, r * 0.35, -r * 0.1, r * 0.22, '#1a120c', 0, false); break; }
    case 'key': { const r = m * 0.2; circ(g, 0, -m * 0.25, r, c1, lw); line(g, 0, -m * 0.25 + r, 0, m * 0.35, 3, c1, 1); line(g, 0, m * 0.25, m * 0.15, m * 0.25, 3, c1, 1); break; }
    case 'heart': { const r = m * 0.3; g.beginPath(); g.moveTo(0, r); g.bezierCurveTo(-r * 2, -r * 0.5, -r * 0.5, -r * 1.5, 0, -r * 0.5); g.bezierCurveTo(r * 0.5, -r * 1.5, r * 2, -r * 0.5, 0, r); g.fillStyle = c1; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke(); break; }
    default: circ(g, 0, 0, m * 0.3, c1, lw);
  }
  g.restore();
}

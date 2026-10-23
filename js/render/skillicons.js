// 기술 그림: 둥근 바탕 + 상징 그림(모두 벡터)
const PI = Math.PI;

export function drawSkillIcon(g, s, x, y, size, opts = {}) {
  const ic = s ? s.icon || { g: 'dot', c: '#ccc' } : { g: 'attack', c: '#d0c0a0' };
  const r = size / 2, cx = x + r, cy = y + r;
  g.save();
  // 바탕
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  gr.addColorStop(0, shadeC(ic.c, 0.55)); gr.addColorStop(1, shadeC(ic.c, 0.12));
  g.fillStyle = gr;
  g.beginPath(); g.arc(cx, cy, r, 0, PI * 2); g.fill();
  g.translate(cx, cy);
  const k = r * 0.62;
  g.strokeStyle = ic.c; g.fillStyle = ic.c; g.lineWidth = Math.max(1.5, r * 0.11); g.lineCap = 'round'; g.lineJoin = 'round';
  const glow = (col = ic.c) => { g.shadowColor = col; g.shadowBlur = r * 0.35; };
  glow();
  switch (ic.g) {
    case 'attack': case 'sword':
      g.beginPath(); g.moveTo(-k * 0.7, k * 0.7); g.lineTo(k * 0.8, -k * 0.8); g.stroke();
      g.beginPath(); g.moveTo(-k * 0.55, k * 0.25); g.lineTo(-k * 0.25, k * 0.55); g.stroke();
      break;
    case 'fist': g.beginPath(); g.arc(0, 0, k * 0.55, 0, PI * 2); g.fill(); g.strokeStyle = shadeC(ic.c, 0.3); for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-k * 0.35, i * k * 0.22); g.lineTo(k * 0.35, i * k * 0.22); g.stroke(); } break;
    case 'arc': g.beginPath(); g.arc(0, k * 0.4, k, PI * 1.15, PI * 1.85); g.stroke(); g.beginPath(); g.arc(0, k * 0.4, k * 0.6, PI * 1.2, PI * 1.8); g.stroke(); break;
    case 'leap': g.beginPath(); g.moveTo(-k, k * 0.6); g.quadraticCurveTo(0, -k * 1.3, k, k * 0.6); g.stroke(); g.beginPath(); g.moveTo(k * 0.6, k * 0.3); g.lineTo(k, k * 0.6); g.lineTo(k * 0.55, k * 0.75); g.stroke(); break;
    case 'eye': g.beginPath(); g.ellipse(0, 0, k, k * 0.55, 0, 0, PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, k * 0.28, 0, PI * 2); g.fill(); break;
    case 'whirl': for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, k * (0.35 + i * 0.3), i * 2, i * 2 + PI * 1.2); g.stroke(); } break;
    case 'skull': g.beginPath(); g.arc(0, -k * 0.1, k * 0.6, 0, PI * 2); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(-k * 0.22, -k * 0.1, k * 0.15, 0, PI * 2); g.arc(k * 0.22, -k * 0.1, k * 0.15, 0, PI * 2); g.fill(); break;
    case 'shout': for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-k * 0.6, 0, k * (0.4 + i * 0.35), -0.7, 0.7); g.stroke(); } break;
    case 'shield': g.beginPath(); g.moveTo(0, -k); g.lineTo(k * 0.8, -k * 0.6); g.lineTo(k * 0.6, k * 0.4); g.lineTo(0, k); g.lineTo(-k * 0.6, k * 0.4); g.lineTo(-k * 0.8, -k * 0.6); g.closePath(); g.stroke(); break;
    case 'banner': g.beginPath(); g.moveTo(-k * 0.6, k); g.lineTo(-k * 0.6, -k); g.lineTo(k * 0.7, -k * 0.6); g.lineTo(-k * 0.6, -k * 0.1); g.stroke(); break;
    case 'boot': g.beginPath(); g.moveTo(-k * 0.3, -k); g.lineTo(-k * 0.3, k * 0.5); g.lineTo(k * 0.8, k * 0.6); g.lineTo(k * 0.8, k * 0.9); g.lineTo(-k * 0.6, k * 0.9); g.lineTo(-k * 0.6, -k); g.stroke(); break;
    case 'ward': g.beginPath(); g.arc(0, 0, k * 0.8, 0, PI * 2); g.stroke(); g.beginPath(); for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * PI * 4 / 5; i ? g.lineTo(Math.cos(a) * k * 0.8, Math.sin(a) * k * 0.8) : g.moveTo(Math.cos(a) * k * 0.8, Math.sin(a) * k * 0.8); } g.closePath(); g.stroke(); break;
    case 'arrow': g.beginPath(); g.moveTo(-k * 0.8, k * 0.8); g.lineTo(k * 0.8, -k * 0.8); g.stroke(); g.beginPath(); g.moveTo(k * 0.8, -k * 0.8); g.lineTo(k * 0.3, -k * 0.7); g.moveTo(k * 0.8, -k * 0.8); g.lineTo(k * 0.7, -k * 0.3); g.stroke(); break;
    case 'multi': for (const a of [-0.45, 0, 0.45]) { g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, k); g.lineTo(0, -k); g.moveTo(0, -k); g.lineTo(-k * 0.25, -k * 0.65); g.moveTo(0, -k); g.lineTo(k * 0.25, -k * 0.65); g.stroke(); g.restore(); } break;
    case 'burst': for (let i = 0; i < 8; i++) { const a = i * PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * k * 0.3, Math.sin(a) * k * 0.3); g.lineTo(Math.cos(a) * k, Math.sin(a) * k); g.stroke(); } break;
    case 'snow': for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * PI / 3); g.beginPath(); g.moveTo(0, -k); g.lineTo(0, k); g.moveTo(-k * 0.25, -k * 0.7); g.lineTo(0, -k * 0.45); g.lineTo(k * 0.25, -k * 0.7); g.stroke(); g.restore(); } break;
    case 'star': g.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? k * 0.4 : k; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); break;
    case 'dash': for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-k + i * k * 0.3, -k * 0.5 + i * k * 0.5); g.lineTo(k * 0.4 + i * k * 0.3, -k * 0.5 + i * k * 0.5); g.stroke(); } break;
    case 'pierce': g.beginPath(); g.moveTo(-k, 0); g.lineTo(k, 0); g.stroke(); g.beginPath(); g.arc(0, 0, k * 0.4, 0, PI * 2); g.stroke(); break;
    case 'ghost': g.beginPath(); g.arc(0, -k * 0.2, k * 0.55, PI, 0); g.lineTo(k * 0.55, k * 0.7); g.lineTo(k * 0.2, k * 0.45); g.lineTo(-k * 0.2, k * 0.7); g.lineTo(-k * 0.55, k * 0.45); g.closePath(); g.fill(); break;
    case 'bomb': g.beginPath(); g.arc(0, k * 0.15, k * 0.6, 0, PI * 2); g.fill(); g.beginPath(); g.moveTo(k * 0.3, -k * 0.35); g.quadraticCurveTo(k * 0.6, -k, k * 0.9, -k * 0.7); g.stroke(); break;
    case 'trap': g.beginPath(); g.moveTo(-k, k * 0.5); g.lineTo(k, k * 0.5); g.stroke(); for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * k * 0.35, k * 0.5); g.lineTo(i * k * 0.35 + k * 0.1, -k * 0.2); g.stroke(); } break;
    case 'cloud': g.beginPath(); g.arc(-k * 0.35, 0, k * 0.4, 0, PI * 2); g.arc(k * 0.3, -k * 0.1, k * 0.5, 0, PI * 2); g.arc(0, k * 0.3, k * 0.4, 0, PI * 2); g.fill(); break;
    case 'tower': g.beginPath(); g.moveTo(-k * 0.3, k); g.lineTo(0, -k * 0.4); g.lineTo(k * 0.3, k); g.closePath(); g.stroke(); g.beginPath(); g.arc(0, -k * 0.6, k * 0.25, 0, PI * 2); g.fill(); break;
    case 'fire': case 'fireball': g.beginPath(); g.moveTo(0, -k); g.quadraticCurveTo(k * 0.9, -k * 0.1, k * 0.5, k * 0.6); g.quadraticCurveTo(0, k, -k * 0.5, k * 0.6); g.quadraticCurveTo(-k * 0.9, -k * 0.1, 0, -k); g.fill(); g.fillStyle = '#ffe8a0'; g.beginPath(); g.arc(0, k * 0.3, k * 0.28, 0, PI * 2); g.fill(); break;
    case 'sun': g.beginPath(); g.arc(0, 0, k * 0.4, 0, PI * 2); g.fill(); for (let i = 0; i < 8; i++) { const a = i * PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * k * 0.6, Math.sin(a) * k * 0.6); g.lineTo(Math.cos(a) * k, Math.sin(a) * k); g.stroke(); } break;
    case 'wall': for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * k * 0.4, k * 0.8); g.quadraticCurveTo(i * k * 0.4 + k * 0.2, 0, i * k * 0.4, -k * (0.4 + (i % 2 ? 0.3 : 0.5))); g.stroke(); } break;
    case 'meteor': g.beginPath(); g.arc(k * 0.35, k * 0.35, k * 0.42, 0, PI * 2); g.fill(); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(k * 0.1 - i * k * 0.2, k * 0.1 - i * k * 0.05); g.lineTo(-k * 0.8 - i * k * 0.1, -k * 0.8 + i * k * 0.3); g.stroke(); } break;
    case 'spark': for (let i = 0; i < 5; i++) { const a = i * 1.26; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * k * 0.5, Math.sin(a) * k * 0.5); g.lineTo(Math.cos(a + 0.3) * k, Math.sin(a + 0.3) * k); g.stroke(); } break;
    case 'ring': g.beginPath(); g.arc(0, 0, k * 0.85, 0, PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, k * 0.45, 0, PI * 2); g.stroke(); break;
    case 'bolt': case 'chain': g.beginPath(); g.moveTo(k * 0.3, -k); g.lineTo(-k * 0.3, -k * 0.05); g.lineTo(k * 0.25, k * 0.05); g.lineTo(-k * 0.3, k); g.stroke(); if (ic.g === 'chain') { g.beginPath(); g.arc(k * 0.6, k * 0.5, k * 0.2, 0, PI * 2); g.arc(-k * 0.6, -k * 0.5, k * 0.2, 0, PI * 2); g.fill(); } break;
    case 'nova': for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.beginPath(); g.moveTo(Math.cos(a) * k * 0.4, Math.sin(a) * k * 0.4); g.lineTo(Math.cos(a) * k, Math.sin(a) * k); g.stroke(); } break;
    case 'tele': g.beginPath(); g.arc(-k * 0.4, k * 0.3, k * 0.3, 0, PI * 2); g.stroke(); g.beginPath(); g.arc(k * 0.4, -k * 0.3, k * 0.3, 0, PI * 2); g.fill(); g.setLineDash([k * 0.15, k * 0.15]); g.beginPath(); g.moveTo(-k * 0.2, k * 0.1); g.lineTo(k * 0.2, -k * 0.1); g.stroke(); g.setLineDash([]); break;
    case 'orb': case 'orbice': g.beginPath(); g.arc(0, 0, k * 0.6, 0, PI * 2); g.stroke(); g.beginPath(); g.arc(-k * 0.15, -k * 0.15, k * 0.25, 0, PI * 2); g.fill(); if (ic.g === 'orbice') for (let i = 0; i < 6; i++) { const a = i * PI / 3; g.beginPath(); g.moveTo(Math.cos(a) * k * 0.7, Math.sin(a) * k * 0.7); g.lineTo(Math.cos(a) * k, Math.sin(a) * k); g.stroke(); } break;
    case 'shard': case 'spike': g.beginPath(); g.moveTo(k, -k); g.lineTo(-k * 0.2, -k * 0.05); g.lineTo(-k, k); g.lineTo(k * 0.05, k * 0.2); g.closePath(); g.fill(); break;
    case 'armor': g.beginPath(); g.moveTo(-k * 0.7, -k * 0.8); g.lineTo(k * 0.7, -k * 0.8); g.lineTo(k * 0.55, k * 0.8); g.lineTo(-k * 0.55, k * 0.8); g.closePath(); g.stroke(); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-k * 0.5, -k * 0.3 + i * k * 0.4); g.lineTo(k * 0.5, -k * 0.3 + i * k * 0.4); g.stroke(); } break;
    case 'storm': for (let i = 0; i < 6; i++) { const xx = -k * 0.7 + (i % 3) * k * 0.7, yy = -k * 0.6 + Math.floor(i / 3) * k * 0.8; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx - k * 0.2, yy + k * 0.45); g.stroke(); } break;
    default: g.beginPath(); g.arc(0, 0, k * 0.4, 0, PI * 2); g.fill();
  }
  g.restore();
  // 테두리
  g.strokeStyle = opts.border || 'rgba(199,164,92,0.7)'; g.lineWidth = Math.max(1, size * 0.04);
  g.beginPath(); g.arc(cx, cy, r - g.lineWidth / 2, 0, PI * 2); g.stroke();
}

function shadeC(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${((n >> 16) & 255) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`;
}

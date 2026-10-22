// 코드로 그리는 국기 (3:2 비율)
const cache = new Map();

function star(ctx, cx, cy, r, color, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.4 : r; const a = rot + (i * Math.PI) / 5; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function emblem(ctx, kind, w, h) {
  const cx = w / 2, cy = h / 2;
  switch (kind) {
    case 'ironcross': {
      const s = h * 0.22;
      ctx.save(); ctx.translate(cx, cy);
      const cross = (r, col) => { ctx.fillStyle = col; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.moveTo(-r * 0.28, 0); ctx.lineTo(-r * 0.55, -r); ctx.lineTo(r * 0.55, -r); ctx.lineTo(r * 0.28, 0); } ctx.fill(); };
      cross(s * 1.18, '#f4f2ec'); cross(s, '#141414');
      ctx.restore(); break;
    }
    case 'savoy': {
      const sw = h * 0.3, sh = h * 0.36;
      ctx.fillStyle = '#2b4ea2'; ctx.fillRect(cx - sw / 2 - 1.5, cy - sh / 2 - 1.5, sw + 3, sh + 3);
      ctx.fillStyle = '#c8102e'; ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - sw * 0.12, cy - sh / 2, sw * 0.24, sh); ctx.fillRect(cx - sw / 2, cy - sh * 0.1, sw, sh * 0.2);
      break;
    }
    case 'sphere': {
      const x = w * 0.4, r = h * 0.22;
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = Math.max(1, h * 0.04);
      ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, cy, r, r * 0.35, 0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.4, cy - r * 0.5, r * 0.8, r * 0.95);
      ctx.fillStyle = '#c8102e'; ctx.fillRect(x - r * 0.3, cy - r * 0.4, r * 0.6, r * 0.75);
      break;
    }
    case 'eagle': {
      ctx.fillStyle = '#111';
      ctx.save(); ctx.translate(cx, cy); const s = h * 0.36;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.6); ctx.lineTo(s * 0.18, -s * 0.2); ctx.lineTo(s * 0.9, -s * 0.75); ctx.lineTo(s * 0.7, -s * 0.1); ctx.lineTo(s * 0.95, 0); ctx.lineTo(s * 0.5, s * 0.25); ctx.lineTo(s * 0.25, s * 0.95); ctx.lineTo(0, s * 0.6); ctx.lineTo(-s * 0.25, s * 0.95); ctx.lineTo(-s * 0.5, s * 0.25); ctx.lineTo(-s * 0.95, 0); ctx.lineTo(-s * 0.7, -s * 0.1); ctx.lineTo(-s * 0.9, -s * 0.75); ctx.lineTo(-s * 0.18, -s * 0.2); ctx.closePath(); ctx.fill();
      ctx.restore(); break;
    }
    case 'danzig': {
      ctx.fillStyle = '#fff'; const s = h * 0.13;
      for (const y of [cy - s * 0.2, cy + s * 2.0]) { ctx.fillRect(w * 0.3 - s, y - s * 0.3, s * 2, s * 0.6); ctx.fillRect(w * 0.3 - s * 0.3, y - s, s * 0.6, s * 2); }
      ctx.fillStyle = '#ffd700'; ctx.fillRect(w * 0.3 - s, cy - s * 2.6, s * 2, s * 1.1);
      break;
    }
    case 'star': star(ctx, cx, cy, h * 0.22, '#ffd700'); break;
    case 'sun': {
      ctx.fillStyle = '#d9a400'; ctx.beginPath(); ctx.arc(cx, cy, h * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d9a400'; ctx.lineWidth = Math.max(1, h * 0.03);
      for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * h * 0.15, cy + Math.sin(a) * h * 0.15); ctx.lineTo(cx + Math.cos(a) * h * 0.22, cy + Math.sin(a) * h * 0.22); ctx.stroke(); }
      break;
    }
    case 'sword': {
      // 흰 칼(문자 대신 장식선)
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(w * 0.2, cy + h * 0.14); ctx.lineTo(w * 0.78, cy + h * 0.14); ctx.lineTo(w * 0.82, cy + h * 0.17); ctx.lineTo(w * 0.2, cy + h * 0.19); ctx.closePath(); ctx.fill();
      ctx.fillRect(w * 0.25, cy + h * 0.06, w * 0.025, h * 0.21);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(0.8, h * 0.03); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 0.28, cy - h * 0.06); ctx.bezierCurveTo(w * 0.4, cy - h * 0.18, w * 0.6, cy + h * 0.02, w * 0.72, cy - h * 0.1); ctx.stroke();
      break;
    }
    case 'crescent3': {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - h * 0.05, cy, h * 0.24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b7a3a'; ctx.beginPath(); ctx.arc(cx + h * 0.03, cy, h * 0.2, 0, Math.PI * 2); ctx.fill();
      for (let k = -1; k <= 1; k++) star(ctx, cx + h * 0.06, cy + k * h * 0.13, h * 0.055, '#fff');
      break;
    }
    case 'francisque': {
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(cx - h * 0.02, cy - h * 0.18, h * 0.04, h * 0.36);
      ctx.beginPath(); ctx.ellipse(cx - h * 0.07, cy - h * 0.1, h * 0.07, h * 0.09, 0, 0, Math.PI * 2); ctx.ellipse(cx + h * 0.07, cy - h * 0.1, h * 0.07, h * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'lorraine': {
      ctx.fillStyle = '#c8102e'; const s = h * 0.04;
      ctx.fillRect(cx - s, cy - h * 0.24, s * 2, h * 0.48); ctx.fillRect(cx - h * 0.08, cy - h * 0.14, h * 0.16, s * 1.6); ctx.fillRect(cx - h * 0.12, cy - h * 0.02, h * 0.24, s * 1.6);
      break;
    }
  }
}

export function drawFlag(ctx, spec, w, h) {
  ctx.save();
  const t = spec?.t || 'plain';
  const c = spec?.c || ['#888'];
  if (t === 'h' || t === 'h3') {
    const r = spec.r || c.map(() => 1); const sum = r.reduce((a, b) => a + b, 0); let y = 0;
    c.forEach((col, i) => { const hh = (h * r[i]) / sum; ctx.fillStyle = col; ctx.fillRect(0, Math.floor(y), w, Math.ceil(hh) + 1); y += hh; });
  } else if (t === 'v') {
    const ww = w / c.length; c.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(Math.floor(i * ww), 0, Math.ceil(ww) + 1, h); });
  } else if (t === 'v2') {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, w * spec.split, h); ctx.fillStyle = c[1]; ctx.fillRect(w * spec.split, 0, w, h);
  } else if (t === 'nordic') {
    ctx.fillStyle = spec.bg; ctx.fillRect(0, 0, w, h);
    const s = h * 0.2, x = w * 0.36;
    ctx.fillStyle = spec.fg; ctx.fillRect(x - s / 2, 0, s, h); ctx.fillRect(0, h / 2 - s / 2, w, s);
    if (spec.inner) { const s2 = s * 0.5; ctx.fillStyle = spec.inner; ctx.fillRect(x - s2 / 2, 0, s2, h); ctx.fillRect(0, h / 2 - s2 / 2, w, s2); }
  } else if (t === 'uk') {
    ctx.fillStyle = '#012169'; ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = h * 0.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
    ctx.strokeStyle = '#c8102e'; ctx.lineWidth = h * 0.07; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(w / 2 - h * 0.17, 0, h * 0.34, h); ctx.fillRect(0, h / 2 - h * 0.17, w, h * 0.34);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(w / 2 - h * 0.1, 0, h * 0.2, h); ctx.fillRect(0, h / 2 - h * 0.1, w, h * 0.2);
  } else if (t === 'sov') {
    ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, w, h);
    const s = h * 0.24, x = w * 0.2, y = h * 0.32;
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = Math.max(1, h * 0.045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, s * 0.55, Math.PI * 0.75, Math.PI * 2.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.45, y + s * 0.45); ctx.lineTo(x + s * 0.25, y - s * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.05, y - s * 0.45); ctx.lineTo(x + s * 0.45, y - s * 0.05); ctx.stroke();
    star(ctx, x, h * 0.1, h * 0.06, '#ffd700');
  } else if (t === 'us') {
    for (let i = 0; i < 13; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#b22234'; ctx.fillRect(0, (i * h) / 13, w, h / 13 + 1); }
    const cw = w * 0.4, ch = (h * 7) / 13; ctx.fillStyle = '#3c3b6e'; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff'; const r = Math.max(0.6, h * 0.018);
    for (let row = 0; row < 6; row++) for (let col = 0; col < 8; col++) { ctx.beginPath(); ctx.arc(((col + 0.75) * cw) / 8.5, ((row + 0.7) * ch) / 6.4, r, 0, Math.PI * 2); ctx.fill(); }
  } else if (t === 'ch') {
    ctx.fillStyle = '#d52b1e'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; const s = h * 0.18; ctx.fillRect(w / 2 - s / 2, h * 0.2, s, h * 0.6); ctx.fillRect(w / 2 - h * 0.3, h / 2 - s / 2, h * 0.6, s);
  } else if (t === 'tr') {
    ctx.fillStyle = '#e30a17'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w * 0.38, h / 2, h * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e30a17'; ctx.beginPath(); ctx.arc(w * 0.42, h / 2, h * 0.2, 0, Math.PI * 2); ctx.fill();
    star(ctx, w * 0.56, h / 2, h * 0.11, '#fff', Math.PI);
  } else if (t === 'gr') {
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#0d5eaf'; ctx.fillRect(0, (i * h) / 9, w, h / 9 + 1); }
    const cs = (h * 5) / 9; ctx.fillStyle = '#0d5eaf'; ctx.fillRect(0, 0, cs, cs);
    ctx.fillStyle = '#fff'; const s = cs / 5; ctx.fillRect(cs / 2 - s / 2, 0, s, cs); ctx.fillRect(0, cs / 2 - s / 2, cs, s);
  } else if (t === 'cz') {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h / 2); ctx.fillStyle = '#d7141a'; ctx.fillRect(0, h / 2, w, h / 2);
    ctx.fillStyle = '#11457e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.5, h / 2); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  } else if (t === 'iq') {
    ['#111', '#fff', '#007a3d'].forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(0, (i * h) / 3, w, h / 3 + 1); });
    ctx.fillStyle = '#ce1126'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.25, h * 0.25); ctx.lineTo(w * 0.25, h * 0.75); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    star(ctx, w * 0.09, h * 0.4, h * 0.06, '#fff'); star(ctx, w * 0.09, h * 0.6, h * 0.06, '#fff');
  } else {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, w, h);
  }
  if (spec?.emblem) emblem(ctx, spec.emblem, w, h);
  // 미세 광택
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function flagCanvas(spec, w = 60, h = 40) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  drawFlag(ctx, spec, w, h);
  return c;
}
export function flagURL(spec, w = 60, h = 40) {
  const key = JSON.stringify(spec) + w + 'x' + h;
  let u = cache.get(key);
  if (!u) { u = flagCanvas(spec, w, h).toDataURL(); cache.set(key, u); }
  return u;
}
export function flagImg(C, cls = 'flag-sm') {
  const img = document.createElement('img');
  img.className = cls; img.alt = C?.name || '';
  img.src = flagURL(C?.flag, 60, 40);
  return img;
}

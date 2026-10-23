// 아이템 그림: 종류마다 도트 설계(pixart.js, 한 칸 = 24)를 칸 크기에 맞춰 바로 찍는다(흐림 없이). 인벤토리·장비 칸·물약 띠·
// 바닥에 같은 설계를 쓰고, 크기마다 한 번만 그려 둔다
import { Art, ramp } from './pixart.js';
import { BASE } from '../data/items.js';
import { UNIQUE } from '../data/uniques.js';

const U = 24;
const M = {
  steel: ramp('#a9afb9'), iron: ramp('#6c717c'), dark: ramp('#4a4e58'), gold: ramp('#d0a246'), silver: ramp('#c4c8d0'),
  wood: ramp('#7a5230'), leather: ramp('#6c4426'), wrap: ramp('#4a3020'), parch: ramp('#dccba2'), bone: ramp('#d6cbb0'),
  glass: ramp('#9ab8c4'), cork: ramp('#a07848'), rope: ramp('#9a7a50'), wax: ramp('#9a2418'), sole: ramp('#3a2a20'),
};
const R = (c, d) => ramp(c || d);
// 무늬(목표 픽셀): 나뭇결, 비스듬히 감은 끈, 바느질
const grain = (lv, px, py) => ((py * 5 + (px % 3) * 7) % 11 === 0 ? lv - 1 : lv);
const wrap = (lv, px, py) => ((px + py) % 3 === 0 ? lv - 1 : lv);

// ───────── 무기 ─────────
function sword(A, ic, W, H) {
  if ((ic.wide || 0) >= 0.35) return cleaver(A, ic, W, H);
  const cx = W / 2, top = 0.6, bot = H - 0.6, L = bot - top, big = W > U;
  const bw = Math.max(3.4, (ic.wide || 0.18) * U * (big ? 1.45 : 1));
  const gy = top + L * (ic.blade || 0.66);
  const curve = (ic.curve || 0) * 2.2 * bw;
  const off = (y) => curve * Math.pow(Math.max(0, (gy - y) / (gy - top)), 1.7);
  const tip = bw * (curve ? 1.9 : 1.35), N = 18, pts = [], back = [];
  for (let i = 0; i <= N; i++) {
    const y = gy + 0.5 - (gy + 0.5 - top) * i / N, hw = bw / 2 * Math.min(1, (y - top) / tip);
    // 휜 칼은 등(왼쪽)이 곧게 끝까지 가고 날(오른쪽)이 끝으로 모인다
    pts.push(cx + off(y) - (curve ? bw / 2 : hw), y); back.push(cx + off(y) + (curve ? bw / 2 - (bw - hw * 2) : hw), y);
  }
  for (let i = back.length - 2; i >= 0; i -= 2) pts.push(back[i], back[i + 1]);
  const steel = R(ic.c1, '#c8ccd4'), gold = R(ic.c3, '#b8943c');
  // 날: 왼쪽 면은 빛을 받고 오른쪽 면은 그늘, 가운데 등줄
  A.paint(A.mask().poly(pts), steel, 'fn', { fn: (x, y) => { const u = x - cx - off(y); return u < -0.3 ? 4 : u < 0.5 ? 3.5 : 2.3; }, edge: true });
  if (!curve && bw * A.k >= 4 && (ic.blade || 0.66) >= 0.66) A.line(cx + 0.2, gy - 1.5, cx + 0.2, gy - (gy - top) * 0.6, steel[1], { on: true });
  A.dot(cx - bw * 0.2 + off(top + tip * 1.4), top + tip * 1.4, steel[5], true);
  const gp = Math.max(2.2, bw * 0.42), pr = Math.max(2.3, bw * 0.5), gh = Math.max(2.4, bw * 0.38);
  const gw = bw * (ic.guardW || 1.6) * 1.2 + 3.5;
  A.paint(A.mask().rect(cx - gp / 2, gy + gh - 0.5, gp, bot - pr * 1.6 - gy - gh + 1), R(ic.c2, '#5a3a1e'), 'cyl', { ax: [cx, gy, cx, bot], r: gp / 2, tex: wrap });
  A.paint(A.mask().rect(cx - gw / 2, gy, gw, gh).circle(cx - gw / 2, gy + gh / 2, gh * 0.62).circle(cx + gw / 2, gy + gh / 2, gh * 0.62), gold, 'bevel');
  A.paint(A.mask().circle(cx, bot - pr, pr), gold, 'sphere', { spec: true });
}
// 백정의 식칼: 넓은 네모 날, 구멍, 핏자국
function cleaver(A, ic, W, H) {
  const cx = W / 2, top = 1, bot = H - 1, L = bot - top;
  const bw = Math.min(W - 4, ic.wide * U * (W > U ? 1.8 : 1.15)), gy = top + L * (ic.blade || 0.55);
  const x0 = cx - bw / 2, x1 = cx + bw / 2, steel = R(ic.c1, '#9aa0a8');
  const hole = A.mask().circle(x0 + bw * 0.3, top + bw * 0.5, Math.max(1, bw * 0.12));
  A.paint(A.mask().poly([x0, top + bw * 0.3, x1 - bw * 0.25, top, x1, top + bw * 0.12, x1, gy, x0, gy]).minus(hole), steel, 'fn', { fn: (x) => (x > x1 - 1.6 ? 4.8 : 3), edge: true });
  for (const [x, y] of [[0.55, 0.45], [0.62, 0.52], [0.4, 0.75], [0.7, 0.68]]) A.dot(x0 + bw * x, top + (gy - top) * y, '#5a140e', true);
  const hw = Math.max(2.6, bw * 0.3);
  A.paint(A.mask().rect(cx - hw / 2, gy - 0.5, hw, bot - gy), R(ic.c2, '#4a2e18'), 'cyl', { ax: [cx, gy, cx, bot], r: hw / 2, tex: grain });
  for (const y of [gy + (bot - gy) * 0.3, gy + (bot - gy) * 0.7]) A.dot(cx, y, M.silver[4], true);
}
function axe(A, ic, W, H) {
  const dbl = !!ic.double, hk = ic.head || 1, top = 1, bot = H - 1;
  const hx = dbl ? W / 2 : W * 0.3, hs = Math.min(dbl ? W * 0.39 : W * 0.55, 12.5 * hk * (H > 72 ? 1.1 : 1)), hy = top + hs * 0.98;
  const steel = R(ic.c1, '#b8bcc4');
  A.paint(A.mask().capsule(hx, top + 2, hx, bot - 0.5, 2.2), R(ic.c2, '#6a4a2a'), 'cyl', { ax: [hx, top, hx, bot], r: 2.2, tex: grain });
  A.paint(A.mask().rect(hx - 2.7, bot - H * 0.24, 5.4, H * 0.16), M.wrap, 'cyl', { ax: [hx, 0, hx, H], r: 2.7, tex: wrap });
  // 날 바깥 끝(hs 단위)
  const E = [[0.95, -0.98], [1.17, -0.45], [1.25, 0.1], [1.13, 0.62], [0.9, 0.98]];
  const edgeX = (y) => {
    const t = (y - hy) / hs;
    for (let i = 0; i < E.length - 1; i++) if (t >= E[i][1] && t <= E[i + 1][1]) { const f = (t - E[i][1]) / (E[i + 1][1] - E[i][1]); return E[i][0] + (E[i + 1][0] - E[i][0]) * f; }
    return 0;
  };
  for (const sd of dbl ? [1, -1] : [1]) {
    const p = [hx, hy - hs * 0.3, hx + sd * hs * 0.45, hy - hs * 0.42];
    for (const [ex, ey] of E) p.push(hx + sd * hs * ex, hy + hs * ey);
    p.push(hx + sd * hs * 0.5, hy + hs * 0.36, hx, hy + hs * 0.3);
    A.paint(A.mask().poly(p), steel, 'fn', { fn: (x, y) => { const d = edgeX(y) * hs - Math.abs(x - hx); return d < 1.5 ? 4.8 : d < 2.6 ? 2 : 2.9 - (y - hy) / hs * 0.8 + (sd < 0 ? -0.3 : 0) - Math.max(0, 1.8 - Math.abs(x - hx) / hs * 3); }, edge: true });
  }
  A.paint(A.mask().rect(hx - 3, hy - hs * 0.38, 6, hs * 0.76), M.dark, 'bevel');
  A.dot(hx - 1, hy - hs * 0.2, M.steel[5], true); A.dot(hx - 1, hy + hs * 0.2, M.steel[5], true);
}
// 자루(+ 아래쪽 손잡이 감개)
function haft(A, cx, y0, y1, c, r = 2.1) {
  A.paint(A.mask().capsule(cx, y0, cx, y1, r), R(c, '#5a3a1e'), 'cyl', { ax: [cx, y0, cx, y1], r, tex: grain });
  const gy = y1 - (y1 - y0) * 0.28;
  A.paint(A.mask().rect(cx - r - 0.5, gy, r * 2 + 1, (y1 - y0) * 0.22), M.wrap, 'cyl', { ax: [cx, y0, cx, y1], r: r + 0.5, tex: wrap });
}
function mace(A, ic, W, H, it) {
  const v = ic.v || 'flange';
  if (it?.b === 'q_anvil') return anvil(A, ic, W, H);
  if (v === 'club' || v === 'spiked') return club(A, ic, W, H, v === 'spiked');
  if (v === 'hammer') return hammer(A, ic, W, H);
  if (v === 'flail') return flail(A, ic, W, H);
  const cx = W / 2, top = 1, bot = H - 1, hk = ic.head || 1, r = Math.min(W / 2 - 4, 8.5 * hk);
  const hy = top + r * (v === 'star' ? 1.5 : 1.15), steel = R(ic.c1, '#9a9ea8');
  haft(A, cx, hy + r * 0.5, bot, ic.c2);
  if (v === 'star') {
    const sp = A.mask();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8, b = 0.32;
      sp.poly([cx + Math.cos(a - b) * r * 0.8, hy + Math.sin(a - b) * r * 0.8, cx + Math.cos(a) * r * 1.5, hy + Math.sin(a) * r * 1.5, cx + Math.cos(a + b) * r * 0.8, hy + Math.sin(a + b) * r * 0.8]);
    }
    A.paint(sp, M.steel, 'bevel');
    A.paint(A.mask().circle(cx, hy, r * 0.92), M.iron, 'sphere', { spec: true });
    return;
  }
  // 날개 달린 메이스: 공 위에 세로 날개 다섯
  A.paint(A.mask().circle(cx, hy, r * 0.72), M.iron, 'sphere');
  for (const fx of [-0.8, 0.8, -0.42, 0.42, 0]) {
    const rx = r * 0.2 * (1 - Math.abs(fx) * 0.3), ry = r * (1.08 - fx * fx * 0.32);
    A.paint(A.mask().ellipse(cx + fx * r, hy, rx, ry), steel, 'bevel', { lv: 3.3 - Math.abs(fx) * 0.9 - (fx > 0 ? 0.4 : 0) });
  }
  A.paint(A.mask().circle(cx, hy - r * 1.08, r * 0.26), steel, 'sphere', { spec: true });
}
function club(A, ic, W, H, spiked) {
  const cx = W / 2, top = 1, bot = H - 1, pts = [], rs = [], N = 10;
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(cx + Math.sin(t * 3) * 0.6, bot - 1.5 - (bot - top - 5) * t); rs.push(1.8 + 3.2 * t * t * (spiked ? 1.15 : 1)); }
  const wood = R(spiked ? ic.c2 : ic.c2, '#6a4a2a');
  if (spiked) {
    const sp = A.mask();
    for (const [t, sd] of [[0.55, -1], [0.72, 1], [0.86, -1], [0.95, 1], [0.66, -1.2], [0.8, 1.1]]) {
      const y = bot - 1.5 - (bot - top - 5) * t, rr = 1.8 + 3.2 * t * t * 1.15, x = cx + sd * rr * 0.92;
      sp.poly([x - sd * 0.5, y - 1.6, x + sd * 4.2, y - 0.6, x - sd * 0.5, y + 1.6]);
    }
    A.paint(sp, M.steel, 'bevel');
  }
  A.paint(A.mask().path(pts, rs), wood, 'bevel', { tex: grain });
  // 옹이
  A.dot(cx - 1.5, top + (bot - top) * 0.3, wood[1], true); A.dot(cx + 1, top + (bot - top) * 0.55, wood[1], true);
}
function hammer(A, ic, W, H) {
  const cx = W / 2, top = 1, bot = H - 1, hk = ic.head || 1, maul = hk > 1.2;
  const hw = Math.min(W / 2 - 2, (maul ? 9 : 10.5) * Math.sqrt(hk)), hh = (maul ? 7 : 6.2) * Math.sqrt(hk), hy = top + hh + (maul ? 0.5 : 5);
  const steel = R(ic.c1, '#9a9ea8');
  haft(A, cx, hy, bot, ic.c2, maul ? 2.5 : 2.1);
  if (maul) {
    A.paint(A.mask().rect(cx - hw, hy - hh, hw * 2, hh * 2), steel, 'bevel');
    for (const sd of [-1, 1]) A.paint(A.mask().rect(sd < 0 ? cx - hw : cx + hw - 2.4, hy - hh - 0.6, 2.4, hh * 2 + 1.2), M.dark, 'bevel');
  } else {
    A.paint(A.mask().poly([cx - 1, hy - hh * 0.4, cx - hw, hy - hh * 0.1, cx - hw, hy + hh * 0.1, cx - 1, hy + hh * 0.4]), M.steel, 'bevel');
    A.paint(A.mask().poly([cx - 1.5, hy - 2, cx, hy - hh - 4.5, cx + 1.5, hy - 2]), M.steel, 'bevel');
    A.paint(A.mask().rect(cx - 2.5, hy - hh, hw + 2.5, hh * 2), steel, 'bevel');
    A.paint(A.mask().rect(cx + hw - 2.5, hy - hh - 0.8, 2.5, hh * 2 + 1.6), M.dark, 'bevel');
  }
}
function flail(A, ic, W, H) {
  const bot = H - 1, hx = W * 0.3, by = H * 0.24, bx = W * 0.64, r = Math.min(7, W * 0.15);
  haft(A, hx, H * 0.55, bot, ic.c2);
  A.paint(A.mask().rect(hx - 2.8, H * 0.53, 5.6, 3), M.dark, 'bevel');
  // 사슬: 고리를 번갈아
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = hx + (bx - hx) * t + Math.sin(t * Math.PI) * 3, y = H * 0.53 - (H * 0.53 - by - r) * t;
    A.paint(A.mask().ring(x, y, i % 2 ? 1.6 : 2.2, i % 2 ? 2.2 : 1.6, 0.9), M.iron, 'bevel', { ol: false });
  }
  const sp = A.mask();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, b = 0.34; sp.poly([bx + Math.cos(a - b) * r * 0.8, by + Math.sin(a - b) * r * 0.8, bx + Math.cos(a) * r * 1.45, by + Math.sin(a) * r * 1.45, bx + Math.cos(a + b) * r * 0.8, by + Math.sin(a + b) * r * 0.8]); }
  A.paint(sp, M.steel, 'bevel');
  A.paint(A.mask().circle(bx, by, r * 0.9), R(ic.c1, '#9a9ea8'), 'sphere', { spec: true });
}
// 분노의 모루
function anvil(A, ic, W, H) {
  const iron = R(ic.c1, '#5a5a62');
  A.paint(A.mask().poly([2, 17, 9, 12.5, 44, 12.5, 46, 15, 46, 21, 36, 23.5, 32, 30, 37, 36, 40, 45, 8, 45, 11, 36, 16, 30, 13, 23.5, 8, 21.5]), iron, 'bevel');
  A.line(10, 13.2, 44, 13.2, iron[5], { on: true });
  A.line(23, 19, 26, 26, '#ff6a20', { on: true }); A.line(26, 26, 24, 33, '#ff6a20', { on: true }); A.line(24, 33, 27, 40, '#ffb040', { on: true });
  A.dot(25, 26, '#ffe080', true);
}
function bow(A, ic, W, H, it) {
  const top = 1.5, bot = H - 1.5, L = bot - top, tipX = W * 0.66, belly = W * 0.2;
  const recurve = /composite|war/.test(it?.b || '') ? 1 : 0, pts = [], rs = [], N = 32;
  for (let i = 0; i <= N; i++) {
    const e = 2 * i / N - 1;
    let x = belly + (tipX - belly) * e * e;
    if (recurve) x += Math.max(0, Math.abs(e) - 0.8) * 26;
    pts.push(x, top + L * i / N); rs.push(1 + 1.5 * Math.pow(1 - Math.abs(e), 0.7));
  }
  const wood = R(ic.c2, '#7a5530');
  A.paint(A.mask().path(pts, rs), wood, 'bevel', { tex: grain });
  const gy = top + L / 2;
  A.paint(A.mask().rect(belly - 3, gy - 5.5, 6, 11), R(ic.c3, '#3a2a1a'), 'cyl', { ax: [belly, gy - 6, belly, gy + 6], r: 3, tex: wrap });
  const n = pts.length;
  A.line(pts[0] - 0.3, pts[1] + 0.8, pts[n - 2] - 0.3, pts[n - 1] - 0.8, '#d8d2c0');
  A.paint(A.mask().circle(pts[0], pts[1] + 0.5, 1.3).circle(pts[n - 2], pts[n - 1] - 0.5, 1.3), M.bone, 'sphere', { ol: false });
}
function staff(A, ic, W, H) {
  const cx = W / 2, top = 1, bot = H - 1, hr = 7.6, sTop = top + hr * 2.05;
  const gold = R(ic.c3, '#a08040'), gem = R(ic.c1, '#7ad0ff');
  A.paint(A.mask().capsule(cx, sTop - 2, cx, bot - 1, 2.5), R(ic.c2, '#6b4a2a'), 'cyl', { ax: [cx, 0, cx, H], r: 2.5, tex: grain });
  for (const [y, h] of [[H * 0.52, 2.4], [H * 0.6, 2.4], [bot - 4, 3.5]]) A.paint(A.mask().rect(cx - 3.2, y, 6.4, h), gold, 'bevel');
  if (ic.v === 'orb') {
    const oy = top + hr * 1.05;
    A.paint(A.mask().path([cx - 0.8, sTop + 1, cx - hr * 0.95, sTop - hr * 0.8, cx - hr * 0.62, top + hr * 0.35], 0.95).path([cx + 0.8, sTop + 1, cx + hr * 0.95, sTop - hr * 0.8, cx + hr * 0.62, top + hr * 0.35], 0.95), gold, 'bevel');
    A.paint(A.mask().circle(cx, oy, hr * 0.84), gem, 'sphere', { spec: true });
    A.paint(A.mask().rect(cx - 3, sTop - 1.5, 6, 3), gold, 'bevel');
  } else {
    const cy = top + hr * 0.95;
    A.paint(A.mask().poly([cx - hr * 0.62, sTop - 2.6, cx + hr * 0.62, sTop - 2.6, cx + 2.4, sTop + 1, cx - 2.4, sTop + 1]), gold, 'bevel');
    A.paint(A.mask().poly([cx, top, cx + hr * 0.72, cy - hr * 0.15, cx + hr * 0.42, cy + hr * 0.85, cx, sTop - 2, cx - hr * 0.42, cy + hr * 0.85, cx - hr * 0.72, cy - hr * 0.15]), gem, 'fn', { fn: (x, y) => (x < cx - 0.2 ? (y < cy ? 5 : 3.7) : (y < cy ? 3.9 : 2.4)), edge: true, grad: 0 });
  }
}

// ───────── 갑옷 ─────────
// 몸통 윤곽(오른쪽 절반을 짜고 왼쪽은 거울): o.sl 소매 끝 높이, o.sw 소매 끝 바깥 x, o.waist, o.hem, o.hw 단 너비, o.sh 어깨 너비
function torso(W, o) {
  const cx = W / 2, sh = o.sh ?? 20.5;
  const Rt = [[cx + 5.5, 3.5], [cx + sh - 6, 5.6], [cx + sh, 10.5], [cx + (o.sw ?? sh + 1), o.sl ?? 24], [cx + 14, (o.sl ?? 24) - 1.5], [cx + 13, 25], [cx + (o.waist ?? 11.5), 44], [cx + (o.hw ?? 14) - 0.8, 58], [cx + (o.hw ?? 14), o.hem ?? 68]];
  if (o.noSleeve) Rt.splice(3, 2, [cx + sh - 1, 15], [cx + 13.5, 18]);
  const p = [];
  for (const [x, y] of Rt) p.push(x, y);
  for (let i = Rt.length - 1; i >= 0; i--) p.push(W - Rt[i][0], Rt[i][1]);
  p.push(cx - 5.5, 3.5, cx, 3.5 + (o.neck ?? 6));
  return p;
}
function armor(A, ic, W, H, it) {
  const v = ic.v || 'leather', c1 = R(ic.c1, '#6a4a2a'), cx = W / 2, id = it?.b || '';
  if (v === 'robe') {
    const cloak = /cloak|cape/.test(id), rags = id === 'rags';
    A.paint(A.mask().ellipse(cx, 7, 9.5, 6.5), c1, 'bevel', { lv: 1.8 });
    const body = torso(W, { sl: 40, sw: 23.2, waist: 11, hw: 19.5, hem: 70, neck: cloak ? 2 : 8 });
    if (rags) { body.splice(16, 4); const hem = []; for (let i = 0; i <= 8; i++) hem.push(cx + 19 - i * 4.75, 70 - (i % 2) * 5 - (i === 3 ? 3 : 0)); body.splice(16, 0, ...hem); }
    A.paint(A.mask().poly(body), c1, 'fn', { fn: (x, y) => 3 + Math.sin((x - cx) * 0.36 + 0.9 + Math.sin(y * 0.09) * 0.5) * 0.85 - (x - cx) * 0.025 - (y > 62 ? 0.4 : 0), edge: true, grad: 1 });
    A.paint(A.mask().rect(cx - 11.5, 38.5, 23, 3), cloak ? M.leather : M.rope, 'cyl', { ax: [0, 40, W, 40], r: 1.5 });
    A.paint(A.mask().capsule(cx + 4, 41, cx + 5, 50, 0.9), cloak ? M.leather : M.rope, 'bevel');
    if (cloak) { A.line(cx, 10, cx, 68, c1[1], { on: true }); A.paint(A.mask().circle(cx, 9.5, 2.2), M.gold, 'sphere', { spec: true }); }
    if (rags) { for (const [x, y] of [[cx - 6, 24], [cx + 8, 52], [cx - 9, 60]]) A.dot(x, y, c1[0], true); A.paint(A.mask().rect(cx + 4, 26, 6, 6), R('#7a6a50'), 'bevel', { lv: 2.5 }); }
    return;
  }
  const plate = v === 'plate' || v === 'field' || v === 'gothic' || v === 'full';
  if (!plate) {
    const metal = v === 'ring' || v === 'chain' || v === 'scale';
    const body = A.mask().poly(torso(W, { sl: metal ? 28 : 23, waist: 12, hw: 14.5, hem: 68 }));
    let tex = null;
    if (v === 'ring') tex = (lv, px, py) => { const a = px % 3, b = py % 3; return a === 1 && b === 1 ? lv - 1.4 : (a === 1 || b === 1) ? lv + 0.4 : lv - 0.4; };
    else if (v === 'chain') tex = (lv, px, py) => (((px + (py >> 1)) & 1) ? lv - 0.7 : lv + 0.5);
    else if (v === 'scale') {
      const splint = id === 'splint_mail';
      tex = splint ? (lv, px, py, x, y) => { const u = (x + 100) % 4.6; return y < 12 ? lv : u < 0.9 ? lv - 1.6 : u > 3.5 ? lv + 0.8 : lv; }
        : (lv, px, py, x, y) => {
          if (y < 11) return lv;
          const rh = 4, rw = 5.2, row = Math.floor((y - 11) / rh), u = ((x + (row % 2) * rw / 2 + 200) % rw) - rw / 2, t = (y - 11) - row * rh;
          const e = (u / (rw / 2)) ** 2 + ((t - rh * 0.15) / (rh * 0.85)) ** 2;
          return e > 0.78 && t > rh * 0.4 ? lv - 1.7 : t < 1.4 && u < 0.5 ? lv + 0.9 : lv;
        };
    } else if (v === 'leather' && id === 'quilted_armor') tex = (lv, px, py, x, y) => ((x + y + 200) % 7 < 0.9 || (x - y + 200) % 7 < 0.9 ? lv - 1 : lv);
    else if (v === 'leather' && id === 'hard_leather_armor') tex = (lv, px, py, x, y) => { if (y < 30) return lv; const t = (y - 30) % 7; return t < 0.9 ? lv - 1.4 : t < 1.9 ? lv + 0.8 : lv; };
    A.paint(body, c1, 'bevel', { tex, grad: 1.2 });
    // 목둘레·허리띠·어깨
    A.paint(A.mask().poly([cx - 6.5, 3, cx - 5, 3, cx, 9.5, cx + 5, 3, cx + 6.5, 3, cx, 11.5]), metal ? M.leather : R(ic.c1, '#6a4a2a'), 'bevel', { lv: 2 });
    if (!metal) {
      A.paint(A.mask().rect(cx - 12.2, 44, 24.4, 4), M.leather, 'bevel', { lv: 2.2 });
      A.paint(A.mask().rect(cx - 2.5, 43.2, 5, 5.6), M.gold, 'bevel');
      for (const sd of [-1, 1]) A.paint(A.mask().poly([cx + sd * 9.5, 6.2, cx + sd * 18.5, 7.2, cx + sd * 22, 12.5, cx + sd * 21, 15.5, cx + sd * 12, 12.5]), c1, 'bevel', { lv: 3.2 });
      if (v === 'leather' && id === 'leather_armor') for (let y = 13; y < 40; y += 4) { A.line(cx - 1.5, y, cx + 1.5, y + 2.5, M.bone[3], { on: true }); A.line(cx + 1.5, y, cx - 1.5, y + 2.5, M.bone[3], { on: true }); }
    } else A.paint(A.mask().rect(cx - 12.6, 44, 25.2, 3.6), M.leather, 'bevel', { lv: 2.2 });
    if (v === 'studded') for (let y = 15; y < 66; y += 6) for (let x = cx - 12 + ((y / 6) % 2) * 3; x <= cx + 12; x += 6) { if (y > 42 && y < 50) continue; A.dot(x, y, M.silver[5], true); A.dot(x + 0.9, y + 0.9, M.iron[1], true); }
    return;
  }
  // 판금: 어깨받이·가슴판·배 띠·허벅지 판
  const full = v === 'full', gothic = v === 'gothic', trim = full || gothic ? M.gold : null, breast = id === 'breast_plate';
  A.paint(A.mask().poly(torso(W, { noSleeve: true, sh: 17, waist: 12.5, hw: 14, hem: breast ? 52 : 66 })), c1, 'fn', { fn: (x) => (x < cx - 0.6 ? 3.8 : x < cx + 0.6 ? 4.6 : 2.6), edge: true, grad: 1 });
  // 배 띠(판)
  for (let y = 37; y < (breast ? 50 : 64); y += 5.5) { A.line(cx - 14, y, cx + 14, y, c1[0], { on: true }); A.line(cx - 14, y + 1, cx + 14, y + 1, c1[5], { on: true }); }
  if (gothic) for (const k of [1, 2, 3]) for (const sd of [-1, 1]) A.line(cx + sd * k * 2.4, 34, cx + sd * k * 3.6, 12, k % 2 ? c1[5] : c1[1], { on: true });
  if (trim) A.paint(A.mask().path([cx - 12.5, 35, cx - 9, 37, cx, 38, cx + 9, 37, cx + 12.5, 35], 0.9), trim, 'bevel', { ol: false });
  if (!breast) for (const sd of [-1, 1]) {
    A.paint(A.mask().ellipse(cx + sd * 17.5, 16, 6.8, 4), c1, 'bevel', { lv: 2.6 });
    A.paint(A.mask().ellipse(cx + sd * 16.5, 10.5, 8.6, 5.6).and(A.mask().rect(0, 0, W, 14.5)), c1, 'sphere', { c: [cx + sd * 15.5, 11], r: 9, spec: true });
    if (trim) A.paint(A.mask().path([cx + sd * 8.5, 13.6, cx + sd * 16, 14.2, cx + sd * 24, 13.6], 0.7).and(A.mask().ellipse(cx + sd * 16.5, 10.5, 8.6, 5.6)), trim, 'bevel', { ol: false });
  }
  if (full || v === 'field') A.paint(A.mask().ellipse(cx, 4.5, 7.5, 3.4), c1, 'sphere', { lv: 3.3 });
  for (const sd of [-1, 1]) A.dot(cx + sd * 9, 30, c1[5], true);
}

// ───────── 투구·방패·장갑·장화·허리띠 ─────────
function helm(A, ic, W, H) {
  const v = ic.v || 'helm', cx = W / 2, c1 = R(ic.c1, '#9a9aa2');
  if (v === 'crown') {
    const gold = R(ic.c3, '#d8b040'), p = [6, 38, 6, 22, 11.5, 28, 15, 13, 19.5, 26, 24, 9, 28.5, 26, 33, 13, 36.5, 28, 42, 22, 42, 38];
    A.paint(A.mask().poly(p), gold, 'bevel');
    A.paint(A.mask().rect(6, 30, 36, 8), gold, 'bevel', { lv: 3.4 });
    A.paint(A.mask().circle(cx, 34, 2.8), R('#d02020'), 'sphere', { spec: true });
    for (const sd of [-1, 1]) A.paint(A.mask().circle(cx + sd * 11, 34, 2.1), R('#3060e0'), 'sphere', { spec: true });
    for (const [x, y] of [[15, 13], [24, 9], [33, 13], [6, 22], [42, 22]]) A.paint(A.mask().circle(x, y, 1.7), R('#f0f0ff'), 'sphere', { ol: false });
    return;
  }
  if (ic.horns) for (const sd of [-1, 1]) A.paint(A.mask().path([cx + sd * 13, 22, cx + sd * 20, 16, cx + sd * 21.5, 7, cx + sd * 19, 1.5], [3.2, 2.6, 1.8, 0.8]), M.bone, 'bevel');
  if (v === 'great') {
    A.paint(A.mask().poly([9, 46, 8, 14, 11, 6, 24, 3, 37, 6, 40, 14, 39, 46]), c1, 'fn', { fn: (x) => (x < cx - 0.5 ? 3.7 : x < cx + 0.5 ? 4.6 : 2.6), edge: true, grad: 1 });
    A.paint(A.mask().rect(10, 20, 28, 3.4), M.dark, 'flat', { lv: 0.6 });
    A.paint(A.mask().rect(cx - 1.4, 23, 2.8, 14), c1, 'bevel', { lv: 3.3 });
    for (let y = 30; y < 42; y += 4) for (const sd of [-1, 1]) A.dot(cx + sd * 6, y, M.dark[0], true);
    for (const x of [12, 36]) for (const y of [10, 42]) A.dot(x, y, c1[5], true);
    return;
  }
  const leather = v === 'cap';
  // 투구 몸통(반구)
  const dome = A.mask().ellipse(cx, 27, 17.5, 21).and(A.mask().rect(0, 0, W, 31));
  A.paint(dome, c1, 'sphere', { c: [cx, 25], r: 19, spec: !leather });
  if (leather) { A.line(cx, 7, cx, 30, c1[1], { on: true }); A.paint(A.mask().rect(5.5, 28, 37, 6), c1, 'bevel', { lv: 2.4 }); for (let x = 9; x < 40; x += 4) A.dot(x, 30.5, c1[4], true); return; }
  A.paint(A.mask().rect(6, 28, 36, 4.5), c1, 'bevel', { lv: 2.6 });
  for (let x = 9; x < 41; x += 5) A.dot(x, 30, c1[5], true);
  if (v === 'skull') { A.line(cx, 7, cx, 28, c1[5], { on: true }); return; }
  if (v === 'full') {
    A.paint(A.mask().poly([8, 31, 40, 31, 38, 44, 30, 47, 18, 47, 10, 44]), c1, 'bevel', { lv: 2.9 });
    A.paint(A.mask().rect(10, 32.5, 28, 3), M.dark, 'flat', { lv: 0.5 });
    A.paint(A.mask().rect(cx - 1.3, 31, 2.6, 12), c1, 'bevel', { lv: 3.4 });
    for (let y = 38; y < 45; y += 3) for (const x of [30, 33]) A.dot(x, y, M.dark[0], true);
    return;
  }
  // 코가리개 투구
  A.paint(A.mask().rect(cx - 1.6, 28, 3.2, 14), c1, 'bevel', { lv: 3.4 });
  for (const sd of [-1, 1]) A.paint(A.mask().poly([cx + sd * 9, 32, cx + sd * 17, 32, cx + sd * 15, 44, cx + sd * 10, 42]), c1, 'bevel', { lv: 2.7 });
}
function shield(A, ic, W, H) {
  const v = ic.v || 'round', cx = W / 2, c1 = R(ic.c1, '#6a4a2a'), c3 = R(ic.c3, '#a89060');
  if (v === 'round') {
    const r = Math.min(W, H) / 2 - 1.5, cy = H / 2;
    A.paint(A.mask().circle(cx, cy, r), c1, 'sphere', { lv: 3.2, tex: (lv, px, py, x) => ((x + 200) % 7.5 < 0.9 ? lv - 1.2 : lv) });
    A.paint(A.mask().ring(cx, cy, r, r, 3), c3, 'bevel');
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; A.dot(cx + Math.cos(a) * (r - 1.5), cy + Math.sin(a) * (r - 1.5), c3[5], true); }
    A.paint(A.mask().circle(cx, cy, r * 0.28), c3, 'sphere', { spec: true });
    return;
  }
  const top = 2, bot = H - 1.5;
  let p;
  if (v === 'kite') p = (() => { const q = []; for (let i = 0; i <= 10; i++) { const a = Math.PI + i * Math.PI / 10; q.push(cx + Math.cos(a) * (W / 2 - 2.5), top + 11 + Math.sin(a) * 10); } q.push(cx + 4, bot - 8, cx, bot, cx - 4, bot - 8); return q; })();
  else if (v === 'tower') p = [3, top + 3, cx, top, W - 3, top + 3, W - 3, bot - 3, cx, bot, 3, bot - 3];
  else p = [3, top, W - 3, top, W - 3, H * 0.45, W - 6, H * 0.7, cx, bot, 6, H * 0.7, 3, H * 0.45];
  const field = A.mask().poly(p);
  A.paint(field, c1, 'bevel', { grad: 1.4 });
  if (v === 'kite') { A.paint(A.mask().rect(cx - 1.8, top + 4, 3.6, bot - top - 12).rect(cx - 13, top + 15, 26, 3.6), c3, 'bevel', { ol: false }); }
  else if (v === 'tower') { for (const y of [H * 0.24, H * 0.72]) A.paint(A.mask().rect(3, y, W - 6, 3.2), c3, 'bevel', { ol: false }); for (const y of [H * 0.24 + 1.6, H * 0.72 + 1.6]) for (const x of [7, cx, W - 7]) A.dot(x, y, c3[5], true); }
  else { A.paint(A.mask().poly([3, H * 0.36, W - 3, H * 0.14, W - 3, H * 0.27, 3, H * 0.49]).and(field), c3, 'bevel', { ol: false }); }
  // 테두리
  const rim = A.mask().path([...p, p[0], p[1]], 1.1).and(field);
  A.paint(rim, c3, 'bevel', { ol: false });
}
function gloves(A, ic, W, H, it) {
  const c1 = R(ic.c1, '#6a4a2a'), id = it?.b || '', plate = /gauntlet/.test(id), chain = id === 'chain_gloves';
  const tex = chain ? (lv, px, py) => (((px + (py >> 1)) & 1) ? lv - 0.7 : lv + 0.4) : null;
  const fing = A.mask();
  for (const [x, top] of [[16.5, 9], [22, 6], [27.5, 7], [33, 11]]) fing.capsule(x, 22, x, top, 2.8);
  fing.capsule(14, 31, 7.5, 21, 3);
  A.paint(fing, c1, 'bevel', { tex });
  A.paint(A.mask().poly([13.5, 18, 35.5, 18, 36.5, 36, 13, 36]), c1, 'bevel', { tex, grad: 1.3 });
  if (plate) {
    for (const [x, top] of [[16.5, 9], [22, 6], [27.5, 7], [33, 11]]) for (let y = top + 4; y < 20; y += 4) A.line(x - 2, y, x + 2, y, c1[1], { on: true });
    A.paint(A.mask().rect(13.5, 17.5, 22, 3.2), c1, 'bevel', { lv: 3.6 });
  }
  A.paint(A.mask().poly([12, 34, 37, 34, 39, 46, 10, 46]), plate ? c1 : M.leather, 'bevel', { lv: plate ? 3 : 2.4 });
  if (!plate) for (let x = 14; x < 37; x += 3) A.dot(x, 36.5, M.bone[2], true);
}
function boots(A, ic, W, H, it) {
  const c1 = R(ic.c1, '#6a4a2a'), id = it?.b || '', plate = /plate|greaves/.test(id), chain = id === 'chain_boots';
  const tex = chain ? (lv, px, py) => (((px + (py >> 1)) & 1) ? lv - 0.7 : lv + 0.4) : null;
  A.paint(A.mask().poly([13, 3, 31, 3, 30, 31, 41, 35, 45, 40, 45, 43, 11, 43, 12, 31]), c1, 'bevel', { tex, grad: 1.3 });
  A.paint(A.mask().rect(10.5, 42, 35.5, 4).rect(11, 39, 9, 7), M.sole, 'bevel', { lv: 2.5 });
  A.paint(A.mask().rect(12.5, 3, 19, 4), plate ? c1 : M.leather, 'bevel', { lv: plate ? 3.6 : 2.2 });
  if (plate) {
    A.paint(A.mask().poly([22, 7, 31, 7, 30, 30, 22, 30]), c1, 'fn', { fn: (x) => (x < 25 ? 4.2 : 3), edge: true });
    A.paint(A.mask().ellipse(26, 9, 5.5, 4), c1, 'sphere', { spec: true });
    for (let x = 33; x < 44; x += 3.5) A.line(x, 35 + (x - 33) * 0.3, x - 1, 41, c1[1], { on: true });
  } else if (!chain) { for (let y = 10; y < 30; y += 4) A.line(28, y, 31, y + 1.5, M.bone[3], { on: true }); A.line(13, 22, 30, 22, c1[1], { on: true }); }
}
function belt(A, ic, W, H, it) {
  const c1 = R(ic.c1, '#4a2e18'), c3 = R(ic.c3, '#b0b0b8'), id = it?.b || '', cy = H / 2;
  if (id === 'sash') {
    A.paint(A.mask().rect(1, cy - 4.5, W - 2, 9), c1, 'fn', { fn: (x, y) => 3 + Math.round(Math.sin(y * 1.3) * 0.7), edge: true });
    A.paint(A.mask().poly([W * 0.42, cy, W * 0.36, H - 0.5, W * 0.43, H - 2, W * 0.47, cy]).poly([W * 0.5, cy, W * 0.56, H - 0.5, W * 0.6, H - 3.5, W * 0.55, cy]), c1, 'bevel', { lv: 2.5 });
    A.paint(A.mask().ellipse(W * 0.47, cy, 3.6, 4.2), c3, 'sphere');
    return;
  }
  A.paint(A.mask().rect(1, cy - 4.5, W - 2, 9), c1, 'bevel', { grad: 0.8 });
  if (id === 'plated_belt') { for (let x = 21; x < W - 4; x += 7) { A.paint(A.mask().rect(x, cy - 5.2, 5.6, 10.4), M.steel, 'bevel'); A.dot(x + 2.8, cy, M.steel[5], true); } }
  else for (let x = 26; x < W - 4; x += 4.5) A.dot(x, cy, c1[0], true);
  A.paint(A.mask().rect(8, cy - 7, 10, 14).minus(A.mask().rect(10.6, cy - 4.4, 4.8, 8.8)), c3, 'bevel');
  A.line(9, cy, 16, cy, c3[4]);
}

// ───────── 장신구 ─────────
function ring(A, ic, W, H) {
  const cx = W / 2, metal = R(ic.c3, '#d8b040');
  A.paint(A.mask().ring(cx, 15.5, 8.6, 6.2, 2.7), metal, 'fn', { fn: (x, y) => (y < 14.5 ? (x < cx ? 4.4 : 3.2) : (x < cx ? 3 : 1.8)), edge: true, grad: 0 });
  A.paint(A.mask().poly([cx - 4.4, 11, cx + 4.4, 11, cx + 2.8, 6.5, cx - 2.8, 6.5]), metal, 'bevel');
  A.paint(A.mask().circle(cx, 6.5, 3.9), R(ic.c1, '#e04040'), 'sphere', { spec: true });
}
function amulet(A, ic, W, H) {
  const cx = W / 2, metal = R(ic.c3, '#d8b040');
  for (let i = 0; i <= 12; i++) { const t = i / 12, x = 3 + (W - 6) * t, y = 1.5 + Math.sin(t * Math.PI) * 9; A.dot(x, y, i % 2 ? metal[2] : metal[4]); }
  A.paint(A.mask().poly([cx, 9.5, cx + 6.2, 15.5, cx, 23, cx - 6.2, 15.5]), metal, 'bevel');
  A.paint(A.mask().ellipse(cx, 15.8, 3.2, 3.9), R(ic.c1, '#e0a040'), 'sphere', { spec: true });
}

// ───────── 물약·주문서·책 ─────────
function potion(A, ic, W, H, it) {
  const cx = W / 2, liq = R(ic.c1, '#d02020'), tall = /^elx_|^q_elixir/.test(it?.b || '');
  if (tall) {
    A.paint(A.mask().poly([cx - 6.5, 22.5, cx - 6.5, 12, cx - 3, 8.5, cx - 2.3, 4, cx + 2.3, 4, cx + 3, 8.5, cx + 6.5, 12, cx + 6.5, 22.5]), M.glass, 'bevel', { lv: 3.6 });
    A.paint(A.mask().rect(cx - 5.4, 12.5, 10.8, 9.2), liq, 'fn', { fn: (x, y) => (x < cx - 2.5 ? 4 : x < cx + 2.5 ? 3 : 2) + (y < 13.6 ? 1 : 0), ol: false });
    A.paint(A.mask().rect(cx - 2.6, 0.6, 5.2, 3.8), M.cork, 'bevel', { ol: false });
    A.line(cx - 4.6, 14, cx - 4.6, 19, '#ffffff', { on: true });
    return;
  }
  const r = ic.big ? 7.9 : 7.1, cy = 23.2 - r;
  A.paint(A.mask().circle(cx, cy, r).rect(cx - 2.6, 3.6, 5.2, cy - r + 2), M.glass, 'sphere', { lv: 3.7, c: [cx, cy], r });
  A.paint(A.mask().rect(cx - 3.4, 3.2, 6.8, 2.2), M.glass, 'bevel', { lv: 3.4, ol: false });
  A.paint(A.mask().circle(cx, cy, r - 1.3).and(A.mask().rect(0, cy - r * 0.38, W, H)), liq, 'sphere', { c: [cx, cy], r: r - 1.3, lv: 3.3, ol: false, tex: (lv, px, py, x, y) => (y < cy - r * 0.38 + 1.1 ? lv + 1 : lv) });
  A.paint(A.mask().rect(cx - 2.2, 0.5, 4.4, 3.4), M.cork, 'bevel', { ol: false });
  A.line(cx - r * 0.55, cy - r * 0.55, cx - r * 0.7, cy - r * 0.05, '#ffffff', { on: true });
}
// 주문서: 비스듬히 말린 양피지에 띠와 밀랍 봉인(귀환은 파랑, 감정은 빨강)
function scroll(A, ic, W, H) {
  const c1 = R(ic.c1, '#3060c0');
  const x0 = 4.5, y0 = 18.5, x1 = 19.5, y1 = 5.5, r = 4.4;
  A.paint(A.mask().capsule(x0, y0, x1, y1, r), M.parch, 'cyl', { ax: [x0, y0, x1, y1], r, spec: true });
  for (const [x, y] of [[x0, y0], [x1, y1]]) {
    A.paint(A.mask().ellipse(x, y, 2.9, 2.9), M.parch, 'flat', { lv: 2 });
    A.dot(x, y, M.parch[0]); A.dot(x + 0.9, y - 0.9, M.parch[1]);
  }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  A.paint(A.mask().capsule(mx - 3.4, my - 3.9, mx + 3.4, my + 3.9, 1.5), c1, 'cyl', { ax: [mx - 3.4, my - 3.9, mx + 3.4, my + 3.9], r: 1.5, spec: true });
  A.paint(A.mask().poly([mx + 1.2, my + 2, mx + 3, my + 8.5, mx + 1.4, my + 7.4, mx + 0.2, my + 9]), c1, 'bevel', { lv: 2.6 });
  A.paint(A.mask().circle(mx + 2.4, my + 3.6, 2.6), c1, 'sphere', { lv: 2.6, spec: true });
}
function book(A, ic, W, H) {
  const c1 = R(ic.c1, '#5a2a2a'), c3 = R(ic.c3, '#d0b050');
  A.paint(A.mask().rect(5, 5, 16, 39), M.parch, 'flat', { lv: 4, tex: (lv, px, py) => (py % 2 ? lv - 1 : lv) });
  A.paint(A.mask().rect(3, 3, 16, 41), c1, 'bevel', { grad: 1.2 });
  A.paint(A.mask().rect(3, 3, 3.4, 41), c1, 'bevel', { lv: 2 });
  for (const [x, y, sx, sy] of [[19, 3, -1, 1], [19, 44, -1, -1], [6.4, 3, 1, 1], [6.4, 44, 1, -1]]) A.paint(A.mask().poly([x, y, x + sx * 4, y, x, y + sy * 4]), c3, 'bevel', { ol: false });
  A.paint(A.mask().circle(11.5, 22, 3.6), c3, 'sphere', { spec: true });
  A.paint(A.mask().rect(17.5, 19.5, 4.5, 5), c3, 'bevel');
}
function key(A, ic, W, H) {
  const c1 = R(ic.c1, '#c03020'), cx = W / 2;
  A.paint(A.mask().ring(cx, 9, 6.6, 6.6, 2.6), c1, 'bevel');
  A.paint(A.mask().rect(cx - 1.6, 14.5, 3.2, 29), c1, 'cyl', { ax: [cx, 14, cx, 44], r: 1.6, spec: true });
  A.paint(A.mask().rect(cx + 1, 34, 5.5, 3).rect(cx + 1, 39.5, 4, 3), c1, 'bevel');
  A.paint(A.mask().circle(cx, 9, 2.2), R('#f0d060'), 'sphere', { spec: true, ol: false });
}
function gem(A, ic, W, H) {
  const c = R(ic.c1, '#c0e0ff'), cx = W / 2;
  A.paint(A.mask().poly([cx - 4.5, 3, cx + 4.5, 3, cx + 9.5, 9, cx, 21.5, cx - 9.5, 9]), c, 'fn', { fn: (x, y) => (y < 9 ? (x < cx ? 5 : 4) : x < cx - 2 ? 3.5 : x < cx + 2 ? 2.8 : 2), edge: true, grad: 0 });
  A.line(cx - 9, 9, cx + 9, 9, c[5], { on: true });
}
function heart(A, ic, W, H, it) {
  const c1 = R(ic.c1, '#3a2a4a'), cx = W / 2;
  if (it?.b === 'q_mushroom') {
    A.paint(A.mask().poly([cx - 2.8, 22, cx - 2, 12, cx + 2, 12, cx + 2.8, 22]), M.bone, 'bevel');
    A.paint(A.mask().ellipse(cx, 11.5, 10, 8).and(A.mask().rect(0, 0, W, 13.5)), c1, 'sphere', { c: [cx, 11.5], r: 10, spec: true });
    for (const [x, y] of [[cx - 4, 7], [cx + 3, 6], [cx + 6, 10], [cx - 6.5, 11]]) A.dot(x, y, '#9a8ab0', true);
    return;
  }
  A.paint(A.mask().ellipse(cx, 13, 10, 8).ellipse(cx - 4, 10, 5.5, 5).ellipse(cx + 4, 10, 5.5, 5), c1, 'sphere', { c: [cx, 12], r: 10, tex: (lv, px, py) => ((px * 2 + py * 3) % 5 === 0 ? lv - 1.2 : lv) });
  A.line(cx, 6, cx, 20, c1[1], { on: true });
}
function skull(A, ic, W, H) {
  const cx = W / 2;
  A.paint(A.mask().circle(cx, 10, 8).rect(cx - 5, 14, 10, 7), M.bone, 'sphere', { c: [cx, 11], r: 9 });
  for (const sd of [-1, 1]) A.paint(A.mask().circle(cx + sd * 3.2, 11, 2.2), M.sole, 'flat', { lv: 0, ol: false });
  for (let x = cx - 3; x <= cx + 3; x += 2) A.line(x, 17.5, x, 20.5, M.bone[1], { on: true });
}
function misc(A, ic, W, H) { A.paint(A.mask().circle(W / 2, H / 2, Math.min(W, H) * 0.3), R(ic.c1, '#a0a0a0'), 'sphere', { spec: true }); }

const DESIGN = { sword, axe, mace, spear: staff, bow, staff, armor, helm, shield, gloves, boots, belt, ring, amulet, potion, scroll, book, gem, skull, key, heart, misc };
const LONG = new Set(['sword', 'axe', 'mace', 'spear', 'bow', 'staff']);

// 아이템의 도트 그림(w×h 픽셀 판). 바닥(ground)에서는 긴 무기를 비스듬히 눕힌다
const CACHE = new Map();
export function itemSprite(item, w, h, ground = false) {
  w = Math.max(4, Math.round(w)); h = Math.max(4, Math.round(h));
  const b = BASE[item.b] || { w: 1, h: 1 };
  const ic = (item.u && UNIQUE[item.u]?.icon) || item.icon || b.icon || { t: 'misc' };
  const key = `${item.u || item.b}|${w}x${h}|${ground ? 1 : 0}`;
  let cv = CACHE.get(key);
  if (cv) return cv;
  const W = (b.w || 1) * U, H = (b.h || 1) * U;
  const A = new Art(w, h, W, H, { rot: ground && LONG.has(ic.t) && H > W ? -Math.PI / 4 : 0 });
  (DESIGN[ic.t] || misc)(A, ic, W, H, item);
  A.outline();
  cv = A.canvas();
  if (CACHE.size > 900) CACHE.clear();
  CACHE.set(key, cv);
  return cv;
}
// UI 판(canvasFor로 만든 것)에 꽉 차게 찍는다: 판의 픽셀 = 도트 한 칸
export function paintItemIcon(cv, item, pad = 1) {
  const c = cv.c, g = cv.g;
  const spr = itemSprite(item, c.width - pad * 2, c.height - pad * 2);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  g.drawImage(spr, Math.floor((c.width - spr.width) / 2), Math.floor((c.height - spr.height) / 2));
  g.restore();
}
// 판의 (x, y)에 w×h 크기로(바닥 등): 도트 판에서 1:1로 찍는다
export function drawItemIcon(g, item, x, y, w, h, ground = false) {
  const spr = itemSprite(item, w, h, ground);
  g.drawImage(spr, Math.round(x + (w - spr.width) / 2), Math.round(y + (h - spr.height) / 2));
}

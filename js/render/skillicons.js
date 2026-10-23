// 기술 그림: 둥근 어두운 바탕에 기술마다 도트 그림(pixart.js, 설계 24×24)을 판 크기에 맞춰 바로 찍는다
import { Art, ramp } from './pixart.js';

const darken = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v * k).toString(16).padStart(2, '0'); return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255); };
const R = ramp;
const FIRE = [R('#c8301a'), R('#f07a18'), R('#ffd050')], ICE = R('#6aa8e8'), ICEL = R('#bfe6ff'), ZAP = R('#f0e050'), ZAPB = R('#8aaaff');
const STEEL = R('#aab0ba'), GOLD = R('#d4a646'), WOOD = R('#8a6038'), LEATHER = R('#7a4c2a'), BONE = R('#dcd0b4'), SKIN = R('#c89070'), POI = R('#6ac030');
const WHITE = '#ffffff';
const unit = (x, y) => { const L = Math.hypot(x, y) || 1; return [x / L, y / L]; };

// ───────── 그림 조각 ─────────
function bg(A, c, k = 0.3) { A.paint(A.mask().circle(12, 12, 12), R(darken(c, k)), 'sphere', { lv: 2.7, c: [12, 12], r: 13, ol: false }); }
// 칼: 손잡이 끝(x0,y0) → 칼끝(x1,y1)
function sword(A, x0, y0, x1, y1, o = {}) {
  const [dx, dy] = unit(x1 - x0, y1 - y0), nx = -dy, ny = dx, bw = o.bw ?? 1.6, gl = o.gl ?? 5;
  const gx = x0 + dx * gl, gy = y0 + dy * gl, tb = bw * 1.6;
  A.paint(A.mask().poly([gx + nx * bw, gy + ny * bw, x1 - dx * tb + nx * bw, y1 - dy * tb + ny * bw, x1, y1, x1 - dx * tb - nx * bw, y1 - dy * tb - ny * bw, gx - nx * bw, gy - ny * bw]), o.mat || STEEL, 'bevel', { lv: 3.6 });
  A.paint(A.mask().capsule(x0, y0, gx, gy, 0.85), LEATHER, 'bevel');
  A.paint(A.mask().capsule(gx + nx * 3, gy + ny * 3, gx - nx * 3, gy - ny * 3, 0.9), GOLD, 'bevel');
  A.paint(A.mask().circle(x0, y0, 1.3), GOLD, 'sphere', { spec: true });
}
// 화살: 꼬리(x0,y0) → 촉(x1,y1)
function arrow(A, x0, y0, x1, y1, o = {}) {
  const [dx, dy] = unit(x1 - x0, y1 - y0), nx = -dy, ny = dx, hl = o.hl ?? 3.6, hw = o.hw ?? 1.7;
  A.paint(A.mask().capsule(x0 + dx, y0 + dy, x1 - dx * hl, y1 - dy * hl, 0.55), o.shaft || WOOD, 'bevel', { lv: 3.4 });
  for (const s of [1, -1]) A.paint(A.mask().poly([x0 + dx * 0.4, y0 + dy * 0.4, x0 + dx * 3.2, y0 + dy * 3.2, x0 + dx * 2.2 + s * nx * 1.9, y0 + dy * 2.2 + s * ny * 1.9, x0 - dx * 0.6 + s * nx * 1.9, y0 - dy * 0.6 + s * ny * 1.9]), R(o.fl || '#e8e0d0'), 'bevel', { lv: 3.2 });
  A.paint(A.mask().poly([x1, y1, x1 - dx * hl + nx * hw, y1 - dy * hl + ny * hw, x1 - dx * hl * 0.72, y1 - dy * hl * 0.72, x1 - dx * hl - nx * hw, y1 - dy * hl - ny * hw]), o.head || STEEL, 'bevel', { lv: 3.6 });
}
// 불꽃(바닥 가운데 cx,by, 너비 w, 높이 h)
function flame(A, cx, by, w, h, lean = 0, L = FIRE) {
  const pts = (s) => {
    const W2 = w * s / 2, Hs = h * s, cy = by - W2 * 0.9, p = [];
    for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; p.push(cx + Math.cos(a) * W2, cy + Math.sin(a) * W2 * 0.9); }
    p.push(cx - W2 * 1.02, cy - Hs * 0.2, cx - W2 * 0.5, cy - Hs * 0.45, cx - W2 * 0.78, cy - Hs * 0.6, cx + lean * s - W2 * 0.1, by - Hs, cx + W2 * 0.4, cy - Hs * 0.5, cx + W2 * 0.98, cy - Hs * 0.2);
    return p;
  };
  A.paint(A.mask().poly(pts(1)), L[0], 'fn', { fn: (x, y) => 2.6 + (y - (by - h)) / h * 1.2, edge: true });
  A.paint(A.mask().poly(pts(0.66)), L[1], 'flat', { lv: 3.4, ol: false });
  A.paint(A.mask().poly(pts(0.36)), L[2], 'flat', { lv: 4.2, ol: false });
}
// 날아가는 불덩이·얼음 등: 머리(hx,hy) 반지름 r, 꼬리 끝(tx,ty)
function comet(A, hx, hy, tx, ty, r, L = FIRE) {
  const [dx, dy] = unit(tx - hx, ty - hy), nx = -dy, ny = dx;
  L.forEach((m, i) => {
    const k = 1 - i * 0.33, rr = r * k;
    A.paint(A.mask().poly([hx + nx * rr, hy + ny * rr, tx - dx * (1 - k) * 4, ty - dy * (1 - k) * 4, hx - nx * rr, hy - ny * rr]).circle(hx, hy, rr), m, i ? 'flat' : 'fn', i ? { lv: 3.3 + i * 0.5, ol: false } : { fn: (x, y) => 3 + ((x - hx) * -dx + (y - hy) * -dy) / r * 0.4, edge: true });
  });
  A.dot(hx - dx * r * 0.2, hy - dy * r * 0.2, WHITE);
}
function bolt(A, pts, L = ZAP, r = 1.25) {
  A.paint(A.mask().path(pts, r), L, 'flat', { lv: 2.8 });
  A.paint(A.mask().path(pts, r * 0.42), L, 'flat', { lv: 5, ol: false });
}
// 별 모양(n개 뾰족, 안 r0·밖 r1)
function star(A, cx, cy, r0, r1, n, L, rot = -Math.PI / 2, lv = 3.6) {
  const p = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r0 : r1; p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  A.paint(A.mask().poly(p), L, 'bevel', { lv });
}
function snow(A, cx, cy, r, L = ICEL) {
  const m = A.mask();
  for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + k * Math.PI / 3; m.capsule(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.75); }
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, bx = cx + Math.cos(a) * r * 0.6, by = cy + Math.sin(a) * r * 0.6;
    for (const s of [-1, 1]) m.capsule(bx, by, bx + Math.cos(a + s * 0.8) * r * 0.33, by + Math.sin(a + s * 0.8) * r * 0.33, 0.55);
  }
  A.paint(m, L, 'bevel', { lv: 3.6 });
  A.dot(cx, cy, WHITE);
}
// 얼음 조각(긴 마름모): 뒤(x0,y0) → 끝(x1,y1), 너비 w
function shard(A, x0, y0, x1, y1, w, L = ICEL) {
  const [dx, dy] = unit(x1 - x0, y1 - y0), nx = -dy, ny = dx, mx = x0 + (x1 - x0) * 0.35, my = y0 + (y1 - y0) * 0.35;
  A.paint(A.mask().poly([x0, y0, mx + nx * w, my + ny * w, x1, y1, mx - nx * w, my - ny * w]), L, 'fn', { fn: (x, y) => ((x - mx) * nx + (y - my) * ny > 0 ? 2.8 : 4.3), edge: true });
}
function ring(A, cx, cy, r, t, L, lv = 3.4, ol = true) { A.paint(A.mask().ring(cx, cy, r, r, t), L, 'flat', { lv, ol }); }
function arcs(A, cx, cy, r0, n, a0, a1, L, step = 3.2, t = 1.1) {
  for (let i = 0; i < n; i++) {
    const r = r0 + i * step, m = A.mask().ring(cx, cy, r, r, t);
    m.and(A.mask().fn(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => { const a = Math.atan2(y - cy, x - cx); return a > a0 && a < a1; }));
    A.paint(m, L, 'flat', { lv: 3.6 - i * 0.5 });
  }
}
function skull(A, cx, cy, s, L = BONE, eye = '#1a0c08') {
  A.paint(A.mask().circle(cx, cy, 5.2 * s).rect(cx - 3.2 * s, cy + 2 * s, 6.4 * s, 4 * s), L, 'sphere', { c: [cx, cy], r: 6 * s });
  for (const sd of [-1, 1]) A.paint(A.mask().ellipse(cx + sd * 2.1 * s, cy + 0.6 * s, 1.5 * s, 1.7 * s), R(eye), 'flat', { lv: 1, ol: false });
  A.dot(cx, cy + 2.6 * s, L[0]);
  for (let x = -2; x <= 2; x += 2) A.line(cx + x * s, cy + 4 * s, cx + x * s, cy + 5.6 * s, L[1], { on: true });
}
function eye(A, cx, cy, w, h, iris) {
  const p = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, x = cx - w + 2 * w * t; p.push(x, cy - Math.sin(t * Math.PI) * h); }
  for (let i = 11; i >= 1; i--) { const t = i / 12, x = cx - w + 2 * w * t; p.push(x, cy + Math.sin(t * Math.PI) * h * 0.85); }
  A.paint(A.mask().poly(p), R('#ece4d0'), 'bevel', { lv: 3.6 });
  A.paint(A.mask().circle(cx, cy, h * 0.82), R(iris), 'sphere', { ol: false });
  A.paint(A.mask().circle(cx, cy, h * 0.36), R('#100808'), 'flat', { lv: 0.5, ol: false });
  A.dot(cx - h * 0.35, cy - h * 0.4, WHITE);
}
function heater(A, cx, cy, w, h, L, trim) {
  const p = [cx - w, cy - h, cx + w, cy - h, cx + w, cy + h * 0.1, cx, cy + h, cx - w, cy + h * 0.1];
  A.paint(A.mask().poly(p), L, 'bevel', { grad: 1.4 });
  if (trim) A.paint(A.mask().path([...p, p[0], p[1]], 0.75).and(A.mask().poly(p)), trim, 'bevel', { ol: false });
}
// 고함치는 얼굴(앞모습)과 소리 물결
function face(A, cx, cy, col) {
  A.paint(A.mask().ellipse(cx, cy, 4.6, 5.4), SKIN, 'sphere', { c: [cx, cy], r: 6 });
  A.paint(A.mask().ellipse(cx, cy + 2.4, 2, 2.3), R('#3a0a08'), 'flat', { lv: 1, ol: false });
  for (const sd of [-1, 1]) { A.line(cx + sd * 1.2, cy - 1.6, cx + sd * 3.2, cy - 2.6, '#2a1008', { on: true }); A.dot(cx + sd * 2, cy - 1.1, col); }
  A.paint(A.mask().ellipse(cx, cy - 4.8, 4.8, 2.4), R('#5a3a24'), 'bevel', { lv: 2.6 });
}
function rune(A, L = GOLD) {
  ring(A, 12, 12, 10.6, 1.2, L, 3.2);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; A.paint(A.mask().circle(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10, 1.4), L, 'sphere', { ol: false }); }
}
function hood(A, cx, cy, L, eyes) {
  A.paint(A.mask().poly([cx - 6, cy + 9, cx - 5.5, cy - 1, cx - 3.5, cy - 6, cx, cy - 7.5, cx + 3.5, cy - 6, cx + 5.5, cy - 1, cx + 6, cy + 9]), L, 'bevel', { lv: 3, grad: 1.3 });
  A.paint(A.mask().ellipse(cx, cy - 1.6, 3, 3.6), R('#0c0a10'), 'flat', { lv: 0.5, ol: false });
  if (eyes) for (const sd of [-1, 1]) A.dot(cx + sd * 1.3, cy - 1.8, eyes);
}

// ───────── 기술마다 ─────────
const DRAW = {
  // 전사
  bash(A) {
    star(A, 16.5, 7, 2.6, 7, 8, R('#ffe080'), 0.2, 4);
    const m = A.mask().rect(5, 11, 11, 8.5);
    for (let k = 0; k < 4; k++) m.circle(6.6 + k * 2.6, 11.2, 1.65);
    A.paint(m, STEEL, 'bevel', { lv: 3.3 });
    for (let k = 1; k < 4; k++) A.line(5.3 + k * 2.6, 10.5, 5.3 + k * 2.6, 14, STEEL[1], { on: true });
    A.paint(A.mask().capsule(5.5, 16, 11.5, 15.2, 1.5), STEEL, 'bevel', { lv: 3.7 });
    A.paint(A.mask().rect(6, 19, 9.5, 3.5), LEATHER, 'bevel');
  },
  cleave(A) { arcs(A, 13, 15, 8.5, 2, -Math.PI * 0.95, -Math.PI * 0.15, R('#f0e0b0'), 2.6, 1.2); sword(A, 5, 20, 19, 6, { bw: 1.5 }); },
  leap_attack(A) { for (let i = 0; i <= 6; i++) { const t = i / 6; A.dot(3 + t * 13, 19 - Math.sin(t * Math.PI) * 13, '#f0d8a0'); } sword(A, 17, 5, 17, 19, { bw: 1.4, gl: 4.5 }); for (const [a, b] of [[-5, -1.5], [5, -1.5], [-3.5, 1.5], [3.5, 1.5]]) A.line(17, 20.5, 17 + a, 20.5 + b, '#c8a070'); },
  concentrate(A) { sword(A, 12, 22, 12, 2, { bw: 1.5 }); eye(A, 12, 11.5, 7.5, 3.6, '#e8b040'); },
  whirlwind(A) { arcs(A, 12, 12, 4, 3, -Math.PI, Math.PI * 0.35, R('#ece0c0'), 3, 1); sword(A, 13, 13, 21, 4, { bw: 1.3, gl: 3 }); sword(A, 11, 11, 3, 20, { bw: 1.3, gl: 3 }); },
  berserk(A) { ring(A, 12, 12, 10.5, 2, R('#c02010'), 3, false); skull(A, 12, 11, 1.25, R('#e86050'), '#200404'); },
  howl(A) { face(A, 12, 13, '#d0a0ff'); arcs(A, 12, 14, 7.5, 2, -0.9, 0.9, R('#c0a0e0')); arcs(A, 12, 14, 7.5, 2, Math.PI - 0.9, Math.PI + 0.9, R('#c0a0e0')); arcs(A, 12, 14, 7.5, 2, -Math.PI - 0.9, -Math.PI + 0.9, R('#c0a0e0')); },
  shout(A) { heater(A, 12, 11.5, 5.8, 7.5, R('#5a7aa8'), GOLD); A.paint(A.mask().rect(11.2, 6, 1.6, 10).rect(8, 9, 8, 1.6), R('#d8e4f0'), 'bevel', { ol: false }); arcs(A, 12, 12, 9.2, 1, -0.7, 0.7, R('#a8d0ff'), 2, 1); arcs(A, 12, 12, 9.2, 1, Math.PI - 0.7, Math.PI + 0.7, R('#a8d0ff'), 2, 1); arcs(A, 12, 12, 9.2, 1, -Math.PI - 0.7, -Math.PI + 0.7, R('#a8d0ff'), 2, 1); },
  battle_cry(A) { A.paint(A.mask().path([4, 18, 7, 16, 10.5, 13.5, 13, 10.5, 14.5, 7.5], [1, 1.5, 2, 2.6, 3.2]), BONE, 'bevel'); for (const t of [0.4, 0.75]) A.line(4 + 10.5 * t - 1.5, 18 - 10.5 * t - 1.5, 4 + 10.5 * t + 1.5, 18 - 10.5 * t + 1.5, GOLD[3], { on: true }); arcs(A, 14.5, 7.5, 3.5, 3, -1.2, 0.5, R('#f09060'), 2.6); },
  battle_orders(A) { A.paint(A.mask().capsule(6.5, 3, 6.5, 22, 0.9), WOOD, 'bevel'); A.paint(A.mask().poly([7.5, 4.5, 19, 5.5, 17, 9, 19.5, 12.5, 7.5, 13.5]), R('#c02a20'), 'fn', { fn: (x, y) => 3 + Math.sin(x * 0.9) * 0.6, edge: true }); A.paint(A.mask().path([7.5, 5, 19, 6], 0.6), GOLD, 'bevel', { ol: false }); A.paint(A.mask().circle(6.5, 2.6, 1.5), GOLD, 'sphere'); star(A, 12.5, 9, 1, 2.4, 5, GOLD, -Math.PI / 2, 4); },
  war_cry(A) { ring(A, 12, 13, 10, 1.4, R('#ff6040'), 3.4); ring(A, 12, 13, 7.4, 1, R('#ff9a60'), 3.2); face(A, 12, 13, '#ff4020'); },
  weapon_mastery(A) { sword(A, 5, 20, 19, 5, { bw: 1.4 }); sword(A, 19, 20, 5, 5, { bw: 1.4 }); },
  iron_skin(A) { heater(A, 12, 11.5, 7, 9, R('#8a8e98'), R('#c8ccd4')); for (const [x, y] of [[8, 6], [16, 6], [8, 12], [16, 12], [12, 17]]) A.dot(x, y, '#ffffff', true); A.line(7, 4, 7, 12, '#e8ecf0', { on: true }); },
  increased_speed(A) { A.paint(A.mask().poly([9, 5, 14, 5, 14, 15, 19.5, 17, 20, 20, 8, 20, 8.5, 14]), LEATHER, 'bevel'); A.paint(A.mask().rect(7.5, 19, 13, 2.2), R('#3a2a20'), 'bevel'); A.paint(A.mask().poly([9, 9, 2.5, 5, 4, 8.5, 1.5, 9.5, 4.5, 11.5, 2.5, 13, 8.5, 12.5]), R('#f0f0f0'), 'bevel'); for (const y of [15, 18]) A.line(1.5, y, 5.5, y, '#c0d0a0'); },
  natural_resistance(A) { ring(A, 12, 12, 9, 1.4, GOLD, 3.2); for (const [a, c] of [[-Math.PI / 2, '#e03020'], [0, '#3070e0'], [Math.PI / 2, '#e0d040'], [Math.PI, '#40c040']]) A.paint(A.mask().circle(12 + Math.cos(a) * 8.3, 12 + Math.sin(a) * 8.3, 2.5), R(c), 'sphere', { spec: true }); star(A, 12, 12, 1.4, 4, 4, R('#e0c0ff'), -Math.PI / 2, 4); },
  // 로그
  magic_arrow(A) { arrow(A, 4, 20, 19, 5, { shaft: R('#8090e0'), head: R('#c0c8ff'), fl: '#a0b0ff' }); for (const [x, y] of [[8, 8], [17, 15], [5, 13]]) star(A, x, y, 0.5, 1.8, 4, R('#d0d8ff'), 0, 4.4); },
  fire_arrow(A) { comet(A, 17.5, 6.5, 9, 15, 3, FIRE); arrow(A, 3, 21, 19, 5, { head: R('#ffb040') }); },
  cold_arrow(A) { arrow(A, 3, 21, 19, 5, { head: ICEL }); shard(A, 15, 9, 21, 3, 2.4); for (const [x, y] of [[13, 4], [21, 10], [16, 3]]) A.dot(x, y, '#e0f4ff'); },
  multishot(A) { arrow(A, 4, 20, 20, 8, { hl: 3 }); arrow(A, 4, 20, 16, 4, { hl: 3 }); arrow(A, 4, 20, 11, 3, { hl: 3 }); },
  exploding_arrow(A) { star(A, 16, 8, 3, 7.5, 9, R('#ff8020'), 0.3, 3.4); star(A, 16, 8, 1.6, 4, 7, R('#ffe060'), 0, 4.2); arrow(A, 3, 21, 14, 10); },
  guided_arrow(A) { for (let i = 0; i <= 8; i++) { const t = i / 8; A.dot(3 + t * 9, 20 - t * 4 - Math.sin(t * 3) * 5, '#f0d080'); } ring(A, 17, 7, 4.2, 1, R('#ffd060'), 3.6); A.dot(17, 7, '#ff4020'); arrow(A, 9, 15, 15.5, 8.5, { hl: 3, hw: 1.5 }); },
  strafe(A) { for (const k of [0, 1, 2, 3]) arrow(A, 2 + k * 2.6, 13 + k * 3, 12 + k * 2.6, 3 + k * 3, { hl: 2.8, hw: 1.3 }); for (const k of [0, 1, 2]) A.line(1, 20 - k * 3 + 3, 4, 17 - k * 3 + 3, '#ffd060'); },
  freezing_arrow(A) { snow(A, 16, 8, 6.5); arrow(A, 3, 21, 13.5, 10.5, { head: ICEL }); },
  inner_sight(A) { star(A, 12, 12, 4, 10.5, 8, R('#ffe0a0'), 0, 3.2); eye(A, 12, 12, 7.5, 3.8, '#f0b030'); },
  critical_strike(A) { sword(A, 4, 20, 14.5, 9.5, { bw: 1.3, gl: 4 }); star(A, 16, 8, 1.4, 6.6, 4, R('#fff0a0'), -Math.PI / 4, 4.4); star(A, 16, 8, 1, 3.6, 4, R('#ffffff'), 0, 5); A.paint(A.mask().poly([17, 15, 19, 19, 17, 21, 15, 19]), R('#d02020'), 'bevel'); },
  dodge(A) { for (const [k, lv] of [[0, 1.8], [1, 2.8], [2, 4]]) A.paint(A.mask().poly([3 + k * 5.5, 5, 7.5 + k * 5.5, 12, 3 + k * 5.5, 19, 5.5 + k * 5.5, 19, 10 + k * 5.5, 12, 5.5 + k * 5.5, 5]), R('#70c070'), 'bevel', { lv }); },
  penetrate(A) { A.paint(A.mask().rect(10, 5, 4.5, 15).minus(A.mask().circle(12.2, 12.4, 1.4)), R('#9098a4'), 'bevel'); for (const [a, b] of [[10.5, 8.5], [14, 16.5]]) A.line(12.2, 12.4, a, b, '#3a3e48', { on: true }); arrow(A, 2, 20, 21, 5, { hl: 3.2 }); },
  decoy(A) { hood(A, 12, 12.5, R('#9ab8e8'), '#ffffff'); A.paint(A.mask().poly([6, 21.5, 18, 21.5, 16, 18, 8, 18]), R('#7a98c8'), 'bevel', { ol: false }); for (const [x, y] of [[4, 8], [20, 10], [5, 16]]) A.dot(x, y, '#d8e8ff'); },
  pierce(A) { for (const [x, y] of [[9, 15], [15, 9]]) { ring(A, x, y, 3.6, 1.1, R('#e04030'), 3.2); A.paint(A.mask().circle(x, y, 1.4), R('#f0f0f0'), 'flat', { lv: 4, ol: false }); } arrow(A, 2, 22, 21.5, 2.5, { hl: 3 }); },
  shadow_warrior(A) { hood(A, 12, 12.5, R('#4a3a70'), '#ff6060'); A.paint(A.mask().poly([6, 21.5, 18, 21.5, 16, 18, 8, 18]), R('#2a2040'), 'bevel', { ol: false }); sword(A, 17, 18, 21, 9, { bw: 0.9, gl: 2.5, mat: R('#8a80b0') }); },
  fire_blast(A) { A.paint(A.mask().circle(10.5, 14, 6.2), R('#3a3a44'), 'sphere', { spec: true }); A.paint(A.mask().rect(9, 7.2, 3, 2.2), R('#6a6a72'), 'bevel'); A.paint(A.mask().path([10.5, 7, 12, 4.5, 15, 4], 0.5), R('#c0a070'), 'bevel', { ol: false }); flame(A, 16.5, 5.5, 4, 5.5, 0.5); },
  shock_trap(A) { A.paint(A.mask().ellipse(12, 17, 8.5, 3.6), R('#6a6e78'), 'bevel'); for (let i = -3; i <= 3; i++) A.paint(A.mask().poly([12 + i * 2.3 - 0.8, 16.5, 12 + i * 2.3, 12.5 - (i % 2 ? 0 : 1), 12 + i * 2.3 + 0.8, 16.5]), STEEL, 'bevel', { lv: 3.8 }); bolt(A, [13, 2, 9.5, 7, 13.5, 8, 10.5, 12.5], ZAPB, 1.1); },
  poison_cloud(A) { A.paint(A.mask().circle(8, 13, 5).circle(14.5, 11, 6).circle(12, 16, 5).circle(17.5, 15.5, 4), POI, 'sphere', { c: [12, 12], r: 10 }); for (const [x, y, r] of [[6, 6, 1.4], [18, 5, 1], [10, 4, 0.9]]) A.paint(A.mask().circle(x, y, r), R('#a0f060'), 'sphere', { ol: false }); skull(A, 13, 13, 0.55, R('#d8f0b0')); },
  lightning_sentry(A) { A.paint(A.mask().poly([9, 22, 10.5, 9, 13.5, 9, 15, 22]), R('#8a8478'), 'bevel', { tex: (lv, px, py) => (py % 3 === 0 ? lv - 1 : lv) }); A.paint(A.mask().circle(12, 7.5, 2.6), ZAPB, 'sphere', { spec: true }); bolt(A, [12, 5, 7, 2.5, 4, 5], ZAPB, 0.8); bolt(A, [12, 5, 17, 2, 20, 5.5], ZAPB, 0.8); },
  // 소서러
  fire_bolt(A) { comet(A, 15.5, 8.5, 4, 20, 4, FIRE); },
  warmth(A) { star(A, 12, 12, 6, 10.5, 12, R('#ffa030'), 0, 3.2); A.paint(A.mask().circle(12, 12, 5.6), R('#ffd060'), 'sphere', { spec: true }); },
  fireball(A) { comet(A, 14, 10, 3, 21, 6.4, FIRE); },
  fire_wall(A) { A.paint(A.mask().rect(2, 19.5, 20, 2.5), R('#5a2a14'), 'bevel'); flame(A, 6, 20, 5.5, 10, 0.5); flame(A, 18, 20, 5.5, 11, -0.5); flame(A, 12, 20.5, 6.5, 15, 0.8); },
  meteor(A) { comet(A, 9, 15, 21, 3, 5, FIRE); A.paint(A.mask().circle(8.5, 15.5, 4.2), R('#5a3a28'), 'sphere'); for (const [x, y] of [[7.5, 14.5], [10, 17]]) A.dot(x, y, '#2a1810', true); },
  fire_mastery(A) { rune(A); flame(A, 12, 19, 8, 14, 1); },
  charged_bolt(A) { for (const [x, y, r] of [[7, 8, 2.6], [16, 6, 2.2], [14, 16, 2.8]]) { A.paint(A.mask().circle(x, y, r), ZAPB, 'sphere', { lv: 3.6, spec: true }); A.dot(x, y, WHITE); } bolt(A, [3, 18, 5.5, 15, 4, 13, 7, 10], ZAPB, 0.7); bolt(A, [20, 21, 17, 20, 18.5, 18.5, 15, 17.5], ZAPB, 0.7); },
  static_field(A) { A.paint(A.mask().circle(12, 12, 4.2), ZAPB, 'sphere', { spec: true }); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const m = A.mask().ring(12, 12, 9.5, 9.5, 1.2).and(A.mask().fn(1, 1, 23, 23, (x, y) => { const b = Math.atan2(y - 12, x - 12) - a; return ((b % (Math.PI / 4)) + Math.PI / 4) % (Math.PI / 4) < 0.55; })); A.paint(m, ZAPB, 'flat', { lv: 4 }); } bolt(A, [12, 7.5, 13.5, 4, 11, 2.8], ZAPB, 0.6); bolt(A, [16, 13, 19.5, 14, 20.5, 11], ZAPB, 0.6); },
  lightning(A) { bolt(A, [15, 1.5, 9, 10, 14, 10.5, 7, 22.5], ZAP, 1.6); },
  nova(A) { for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; A.paint(A.mask().capsule(12 + Math.cos(a) * 5.5, 12 + Math.sin(a) * 5.5, 12 + Math.cos(a) * 10.5, 12 + Math.sin(a) * 10.5, 0.7), ZAPB, 'flat', { lv: 4 }); } ring(A, 12, 12, 5.6, 1.4, R('#d8e4ff'), 4); A.paint(A.mask().circle(12, 12, 2.2), R('#ffffff'), 'flat', { lv: 4, ol: false }); },
  chain_lightning(A) { const P = [[4, 6], [12, 17], [20, 5]]; bolt(A, [4, 6, 6.5, 12, 9, 10.5, 12, 17], ZAP, 0.9); bolt(A, [12, 17, 15, 11, 17, 12.5, 20, 5], ZAP, 0.9); for (const [x, y] of P) A.paint(A.mask().circle(x, y, 2.4), R('#fff0a0'), 'sphere', { spec: true }); },
  teleport(A) { for (const [x, y, k] of [[7, 16, 0.75], [16.5, 8, 1]]) { ring(A, x, y, 5 * k, 1.2, R('#a070e0'), 3.6); ring(A, x, y, 3 * k, 1, R('#c8a8ff'), 4); A.paint(A.mask().circle(x, y, 1.6 * k), R('#2a1840'), 'flat', { lv: 1, ol: false }); } for (let i = 1; i < 5; i++) A.dot(7 + i * 1.9, 16 - i * 1.6, '#e0d0ff'); },
  energy_shield(A) { A.paint(A.mask().circle(12, 12, 9.5), R('#3a68c8'), 'sphere', { lv: 2.6 }); ring(A, 12, 12, 9.5, 1.3, R('#8ab4ff'), 4, false); A.paint(A.mask().ellipse(8.5, 8, 2.6, 1.8), R('#d0e4ff'), 'flat', { lv: 4.4, ol: false }); A.paint(A.mask().circle(12, 12, 3.4), R('#80a8ff'), 'sphere', { ol: false, spec: true }); },
  lightning_mastery(A) { rune(A); bolt(A, [14, 4, 9.5, 11.5, 13.5, 12, 10, 20], ZAP, 1.3); },
  ice_bolt(A) { for (const [x, y] of [[6, 18], [4, 14], [9, 21]]) A.dot(x, y, '#c8ecff'); shard(A, 5, 19, 19, 5, 3); },
  frozen_armor(A) { A.paint(A.mask().poly([5, 5, 9, 4, 12, 7.5, 15, 4, 19, 5, 20, 10, 17, 11, 17, 20, 7, 20, 7, 11, 4, 10]), ICE, 'fn', { fn: (x) => (x < 12 ? 3.8 : 2.8), edge: true }); for (const sd of [-1, 1]) shard(A, 12 + sd * 6, 7, 12 + sd * 9.5, 1.5, 1.2); A.line(12, 9, 12, 19, ICE[1], { on: true }); },
  frost_nova(A) { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; shard(A, 12 + Math.cos(a) * 4, 12 + Math.sin(a) * 4, 12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11, 1.6); } A.paint(A.mask().circle(12, 12, 3.4), R('#e8f8ff'), 'sphere', { spec: true }); },
  ice_blast(A) { star(A, 12, 12, 4, 10, 8, ICE, 0.4, 3); shard(A, 12, 20, 12, 3.5, 4.2); for (const [a, b] of [[8, 8], [16, 15]]) A.line(12, 12, a, b, ICE[1], { on: true }); },
  glacial_spike(A) { shard(A, 4, 21, 20, 3, 4); for (const k of [-1, 1]) shard(A, 14 + k * 3.5, 11 + k * 3.5, 19 + k * 3.5, 6 + k * 3.5, 1.4); },
  blizzard(A) { A.paint(A.mask().circle(7, 7, 4.2).circle(13, 5.5, 5).circle(18, 7.5, 3.8).rect(5, 6, 14, 4.5), R('#8a9ab0'), 'sphere', { c: [12, 6], r: 9 }); for (const [x, y] of [[6, 13], [11, 15], [16, 13], [8.5, 19], [14, 20.5], [19, 18]]) shard(A, x + 1.5, y - 2.5, x - 1, y + 2, 1); },
  frozen_orb(A) { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.3, r0 = 7, r1 = 11; shard(A, 12 + Math.cos(a) * r0, 12 + Math.sin(a) * r0, 12 + Math.cos(a + 0.5) * r1, 12 + Math.sin(a + 0.5) * r1, 1.3); } A.paint(A.mask().circle(12, 12, 5.8), ICE, 'sphere', { spec: true }); A.paint(A.mask().circle(12, 12, 2.6), R('#e8f8ff'), 'flat', { lv: 4, ol: false }); },
  cold_mastery(A) { rune(A, R('#c8d8e8')); snow(A, 12, 12, 7.5); },
  // 기본 공격(주 단추)
  attack(A) { sword(A, 5, 19, 19, 5, { bw: 1.7, gl: 5 }); },
  attack_bow(A) { arrow(A, 4, 20, 20, 4, { hl: 4, hw: 2 }); },
};

// 기술 그림(size×size 픽셀 판). 같은 기술·크기는 한 번만 그린다
const CACHE = new Map();
export function skillSprite(s, size) {
  size = Math.max(8, Math.round(size));
  const id = s?.id || 'attack', key = id + '|' + size;
  let cv = CACHE.get(key);
  if (cv) return cv;
  const A = new Art(size, size, 24, 24);
  bg(A, s?.icon?.c || '#d0c0a0', id.startsWith('attack') ? 0.22 : 0.3);
  (DRAW[id] || DRAW.attack)(A);
  A.outline();
  cv = A.canvas();
  if (CACHE.size > 400) CACHE.clear();
  CACHE.set(key, cv);
  return cv;
}
// UI 판(canvasFor로 만든 것)에 찍는다: 둘레 ins 픽셀(판 픽셀)을 비우고 가운데에
export function paintSkillIcon(cv, s, ins = 0) {
  const c = cv.c, g = cv.g, n = Math.min(c.width, c.height) - ins * 2;
  const spr = skillSprite(s, n);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  g.drawImage(spr, Math.floor((c.width - spr.width) / 2), Math.floor((c.height - spr.height) / 2));
  g.restore();
}

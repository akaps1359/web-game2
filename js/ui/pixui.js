// 도트 UI: 창·단추 테두리(9칸 조각 그림), 둥근 단추·조이스틱·동전 그림, 메뉴 단추·버프 아이콘을 도트로 그려
// CSS 변수로 넘긴다(main.css가 쓴다). 그림은 기기 픽셀 해상도로 직접 그려(도트 한 칸 = CSS 1.5px) 브라우저가 늘리며
// 흐려지지 않게 한다
import { ART } from '../render/pixel.js';

const hex = (c) => {
  if (c.startsWith('rgba')) { const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], Math.round(m[3] * 255)]; }
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};
// 도트 S×S칸 그림을 기기 픽셀로 굽는다: colorAt(x, y)는 칸의 색(없으면 투명)
function bake(S, px, colorAt) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const g = cv.getContext('2d'), img = g.createImageData(px, px), d = img.data;
  const memo = new Map();
  for (let Y = 0; Y < px; Y++) for (let X = 0; X < px; X++) {
    const x = Math.min(S - 1, Math.floor(X * S / px)), y = Math.min(S - 1, Math.floor(Y * S / px)), k = y * S + x;
    let c = memo.get(k);
    if (c === undefined) { const v = colorAt(x, y); c = v ? hex(v) : null; memo.set(k, c); }
    if (!c) continue;
    const i = (Y * px + X) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3];
  }
  g.putImageData(img, 0, 0);
  return cv;
}
const pick = (c, light) => (Array.isArray(c) ? c[light ? 0 : 1] : c);

// 9칸 조각 테두리: 바깥부터 한 칸씩 층(빛 받는 위·왼쪽은 [밝음, 어두움]의 앞 색), 가운데는 fill, 모서리는 한 칸 깎는다
function frame(layers, fill, F) {
  const c = layers.length, S = c * 2 + 1, px = Math.round(S * F);
  const cv = bake(S, px, (x, y) => {
    const dx = Math.min(x, S - 1 - x), dy = Math.min(y, S - 1 - y);
    if (dx + dy < 1) return null;
    const ring = Math.min(dx, dy, dx + dy - 1);
    const light = Math.min(x, y) <= Math.min(S - 1 - x, S - 1 - y);
    return ring < c ? pick(layers[ring], light) : fill;
  });
  return { url: cv.toDataURL(), slice: Math.round(c * F), w: Math.round(c * F) / (window.devicePixelRatio || 1) };
}
// 둥근 그림(지름 n칸): 바깥부터 층, 안쪽은 fill(x, y: 가운데 기준 -1..1) 또는 색
function disc(n, px, layers, fill) {
  const R = n / 2;
  return bake(n, px, (x, y) => {
    const dx = x + 0.5 - R, dy = y + 0.5 - R, depth = R - Math.hypot(dx, dy);
    if (depth < 0) return null;
    const ring = Math.floor(depth);
    if (ring < layers.length) return pick(layers[ring], dx + dy < 0);
    return typeof fill === 'function' ? fill(dx / R, dy / R) : fill;
  });
}

const GOLD = ['#d8b878', '#6a4c26'];
const FRAMES = {
  panel: [['#000', ['#c9a35a', '#6e5428'], '#3b2d1b', '#0c0907'], 'rgba(20,16,12,0.97)'],
  btn: [['#000', GOLD, ['#4a3822', '#2a1e12']], '#2a2016'],
  on: [['#000', ['#f0d898', '#8a6a34'], ['#6a5230', '#3a2c18']], '#3a2c1a'],
  down: [['#000', ['#5e4426', '#d8b878'], ['#1a140c', '#3a2c1a']], '#1e170f'],
  red: [['#000', ['#e07a64', '#5a1a10'], ['#4a1a12', '#2a0c08']], '#2a0e0a'],
  slot: [[['#030202', '#6a5840'], 'rgba(0,0,0,0.5)'], 'rgba(0,0,0,0.42)'],
  tab: [['#000', ['#7a6232', '#3a2c18']], 'rgba(0,0,0,0.35)'],
  toast: [['#000', '#7a6232'], 'rgba(8,6,4,0.86)'],
  bar: [['#000', '#3a2c1a'], 'rgba(0,0,0,0.75)'],
  bad: [[['#1a0402', '#a8402c'], 'rgba(60,0,0,0.5)'], 'rgba(40,4,2,0.5)'],
};
const step = (v, n) => Math.round(Math.max(0, Math.min(1, v)) * n) / n;
const mixc = (a, b, t) => { const A = hex(a), B = hex(b); return `rgba(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)},1)`; };
// 둥근 CSS 그림: [CSS 크기, 층, 안쪽]
const ROUNDS = {
  act: [62, ['#000', ['#f0d898', '#8a6a34'], '#3a2c18'], (x, y) => mixc('#1a140c', '#6a5030', step(0.75 - (x + y) * 0.5, 4))],
  stick: [112, ['rgba(0,0,0,0.75)', ['#c9a35a', '#6e5428'], 'rgba(0,0,0,0.55)'], 'rgba(0,0,0,0.22)'],
  knob: [50, ['#000', ['#f0d898', '#7a5a2c']], (x, y) => mixc('#4a3218', '#e0c080', step(0.8 - (x + y) * 0.55 - Math.hypot(x, y) * 0.25, 4))],
  coin: [14, ['#2a1c04'], (x, y) => mixc('#7a5810', '#fff2b0', step(0.65 - (x + y) * 0.6, 3))],
};

// 메뉴 단추 아이콘(16×16 도트)
const ICON_PAL = { k: '#000', G: '#e0c890', g: '#9a7a48', B: '#7a5230', D: '#4a3018', P: '#c8a870', p: '#8a6a40', V: '#6a5a9a', v: '#9a8ad0', b: '#1a3a8a', L: '#5a8ae0', c: '#9ec0ff', W: '#e0f0ff' };
const ICON_ART = {
  bag: ['................', '......kkkk......', '.....kGggGk.....', '....kGk..kGk....', '...kkkkkkkkkk...', '..kGGGGGGGGGGk..', '..kBBBBBBBBBBk..', '..kBBBBBBBBBBk..', '..kBBBkGGkBBBk..', '..kBBBkggkBBBk..', '..kBBBBkkBBBBk..', '..kBBBBBBBBBBk..', '..kDBBBBBBBBDk..', '..kDDDDDDDDDDk..', '...kkkkkkkkkk...', '................'],
  char: ['................', '......kkkk......', '.....kGGGgk.....', '....kGGGGGgk....', '....kGGGGGgk....', '....kGGGGggk....', '.....kgggggk....', '......kkkk......', '....kkkkkkkk....', '...kGGGGGGGgk...', '..kGGGGGGGGGgk..', '..kGGGGGGGGGgk..', '..kGGGGGGGGggk..', '..kggggggggggk..', '..kkkkkkkkkkkk..', '................'],
  skill: ['................', '.......kk.......', '......kvvk......', '......kvVk......', '.....kvvVVk.....', 'kkkkkkvVVVkkkkkk', 'kGvvvvvVVVVVVVGk', '.kGvvVVVVVVVVGk.', '..kGVVVVVVVVGk..', '...kVVVVVVVVk...', '...kVVVVVVVVk...', '..kVVVVkkVVVVk..', '..kVVVk..kVVVk..', '.kVVk......kVVk.', '.kkk........kkk.', '................'],
  quest: ['................', '..kkkkkkkkkkk...', '..kPPPPPPPPPPk..', '..kPPPPPPPPPPk..', '..kPkkkkkkkPPk..', '..kPPPPPPPPPPk..', '..kPkkkkkkkPPk..', '..kPPPPPPPPPPk..', '..kPkkkkkkPPPk..', '..kPPPPPPPPPPk..', '..kPkkkkkPPPPk..', '..kPPPPPPPPPPk..', '..kpPPPPPPPPpk..', '...kkkkkkkkkk...', '................', '................'],
  menu: ['................', '................', '................', '..kkkkkkkkkkkk..', '..kGGGGGGGGGGk..', '..kkkkkkkkkkkk..', '................', '..kkkkkkkkkkkk..', '..kGGGGGGGGGGk..', '..kkkkkkkkkkkk..', '................', '..kkkkkkkkkkkk..', '..kGGGGGGGGGGk..', '..kkkkkkkkkkkk..', '................', '................'],
  portal: ['................', '......kkkk......', '.....kbbbbk.....', '....kbLLLbbk....', '....kbLccLbk....', '...kbLcWWcLbk...', '...kbLcWWcLbk...', '...kbLcWWcLbk...', '...kbLcWWcLbk...', '...kbLcWWcLbk...', '....kbLccLbk....', '....kbLLLbbk....', '.....kbbbbk.....', '......kkkk......', '................', '................'],
};
export const PIX_ICONS = {};

// 버프 아이콘(16×16 도트): 점·선·사각형·원·다각형으로 그리고 바깥에 1도트 검은 외곽선을 저절로 두른다
function sprite(draw) {
  const px = new Array(256).fill(null);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < 16 && y >= 0 && y < 16) px[y * 16 + x] = c; };
  const P = {
    dot: set,
    line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); },
    rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); },
    disc(cx, cy, r, c) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) px[y * 16 + x] = c; },
    poly(pts, c) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const qx = x + 0.5, qy = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > qy) !== (yj > qy) && qx < (xj - xi) * (qy - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) px[y * 16 + x] = c;
      }
    },
  };
  draw(P);
  const out = px.slice();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    if (px[i]) continue;
    if ((x > 0 && px[i - 1]) || (x < 15 && px[i + 1]) || (y > 0 && px[i - 16]) || (y < 15 && px[i + 16])) out[i] = '#000';
  }
  return out;
}
const C = {
  ice: '#9ec8ff', iceD: '#4a7ad0', iceW: '#eef8ff', fire: '#d83a18', fireO: '#f08a20', fireY: '#ffe060',
  grn: '#5ac030', grnD: '#2a6a18', grnL: '#b0f080', gold: '#e0c070', goldD: '#8a6a30', goldL: '#fff2b0',
  steel: '#c0c4cc', steelD: '#6a6e78', red: '#d02a1c', redD: '#6a140c', redL: '#ff7a60', pur: '#a858d8', purD: '#5a2a7a',
  blue: '#4a7ae0', blueD: '#1a3a8a', blueL: '#8ab4ff', wood: '#7a5230', woodD: '#4a3018', bone: '#e8e0c8', white: '#ffffff', dark: '#1a120c',
};
const sparkle = (P, cx, cy, r, c, core) => { P.line(cx, cy - r, cx, cy + r, c); P.line(cx - r, cy, cx + r, cy, c); if (r >= 3) { P.dot(cx - 1, cy - 1, c); P.dot(cx + 1, cy - 1, c); P.dot(cx - 1, cy + 1, c); P.dot(cx + 1, cy + 1, c); } P.dot(cx, cy, core); };
const shield = (P, a, b) => { P.poly([[2, 2], [14, 2], [14, 8], [8, 15], [2, 8]], a); P.poly([[4, 4], [12, 4], [12, 8], [8, 12.6], [4, 8]], b); };
const BUFF_ART = {
  chill: (P) => { P.line(7, 1, 7, 14, C.ice); P.line(1, 7, 14, 7, C.ice); P.line(3, 3, 11, 11, C.iceD); P.line(3, 11, 11, 3, C.iceD); for (const [x, y] of [[6, 2], [8, 2], [6, 12], [8, 12], [2, 6], [2, 8], [12, 6], [12, 8]]) P.dot(x, y, C.ice); P.rect(6, 6, 3, 3, C.iceW); },
  freeze: (P) => { P.rect(2, 3, 12, 11, C.iceD); P.rect(3, 4, 10, 9, C.ice); P.line(3, 4, 12, 4, C.iceW); P.line(3, 4, 3, 12, C.iceW); P.line(6, 10, 10, 6, C.iceW); P.line(9, 9, 11, 12, C.iceD); },
  stun: (P) => { sparkle(P, 6, 6, 4, C.fireY, C.white); sparkle(P, 12, 12, 2, C.fireY, C.white); P.dot(12, 3, C.fireY); },
  poison: (P) => { P.disc(8, 7, 5.6, C.grn); P.rect(5, 10, 6, 4, C.grn); P.rect(5, 6, 2, 2, C.dark); P.rect(9, 6, 2, 2, C.dark); P.dot(7, 9, C.dark); P.dot(8, 9, C.dark); P.dot(6, 12, C.grnD); P.dot(8, 12, C.grnD); P.dot(5, 3, C.grnL); P.dot(4, 4, C.grnL); },
  burning: (P) => { P.poly([[8, 0.5], [12.5, 6], [14, 10], [12, 15], [4, 15], [2, 10], [3.5, 6], [6, 7.5]], C.fire); P.poly([[8, 5], [11, 9.5], [11, 14], [5, 14], [5, 10], [7, 9]], C.fireO); P.poly([[8, 9], [9.8, 11.5], [9.8, 14], [6.2, 14], [6.2, 11.5]], C.fireY); },
  amp: (P) => { P.disc(8, 8, 6.6, C.purD); P.disc(8, 8, 5.2, C.dark); P.line(5, 5, 11, 11, C.pur); P.line(5, 11, 11, 5, C.pur); P.line(6, 5, 11, 10, C.pur); P.line(5, 10, 10, 5, C.pur); },
  shout: (P) => { shield(P, C.gold, C.steel); P.line(4, 4, 11, 4, C.white); P.line(8, 5, 8, 11, C.steelD); P.line(5, 7, 11, 7, C.steelD); },
  battleOrders: (P) => { P.line(4, 1, 4, 15, C.wood); P.line(5, 1, 5, 15, C.woodD); P.poly([[6, 2], [14, 4.5], [6, 8]], C.red); P.line(6, 2, 10, 3, C.redL); P.dot(4, 0, C.gold); P.dot(5, 0, C.gold); },
  battleCommand: (P) => { P.line(7, 1, 7, 10, C.steel); P.line(8, 1, 8, 10, C.steelD); P.rect(4, 10, 8, 2, C.gold); P.rect(7, 12, 2, 2, C.wood); P.rect(7, 14, 2, 1, C.gold); P.dot(2, 3, C.fireY); P.dot(13, 4, C.fireY); P.dot(2, 8, C.fireY); P.dot(13, 9, C.fireY); },
  frozenArmor: (P) => { P.poly([[2, 3], [6, 1.5], [10, 1.5], [14, 3], [14, 9], [11.5, 14], [4.5, 14], [2, 9]], C.iceD); P.poly([[3.5, 4], [6.5, 3], [9.5, 3], [12.5, 4], [12.5, 9], [10.5, 12.5], [5.5, 12.5], [3.5, 9]], C.ice); P.line(7, 4, 7, 12, C.iceD); P.line(8, 4, 8, 12, C.iceD); P.dot(5, 5, C.iceW); P.dot(5, 6, C.iceW); P.dot(10, 5, C.iceW); },
  energyShield: (P) => { P.disc(8, 8, 6.8, C.blueD); P.disc(8, 8, 5.4, C.blue); P.disc(8, 8, 3.2, C.blueL); P.dot(5, 4, C.white); P.dot(4, 5, C.white); P.dot(6, 4, C.iceW); },
  concentrate: (P) => { P.disc(8, 8, 6.8, C.gold); P.disc(8, 8, 5.3, C.dark); P.disc(8, 8, 4, C.red); P.disc(8, 8, 2.6, C.dark); P.disc(8, 8, 1.3, C.fireY); },
  berserk: (P) => { for (let i = 0; i < 3; i++) { P.line(2 + i * 4, 2, 5 + i * 4, 14, C.red); P.line(3 + i * 4, 2, 6 + i * 4, 14, C.redD); } P.dot(2, 2, C.redL); P.dot(6, 2, C.redL); P.dot(10, 2, C.redL); },
  shrine: (P) => { P.poly([[8, 0.5], [9.8, 6.2], [15.5, 8], [9.8, 9.8], [8, 15.5], [6.2, 9.8], [0.5, 8], [6.2, 6.2]], C.gold); P.poly([[8, 3.5], [9, 7], [12.5, 8], [9, 9], [8, 12.5], [7, 9], [3.5, 8], [7, 7]], C.goldL); P.dot(8, 8, C.white); },
  innerSight: (P) => { P.poly([[1, 8], [4.5, 4.5], [11.5, 4.5], [15, 8], [11.5, 11.5], [4.5, 11.5]], C.bone); P.disc(8, 8, 3, C.red); P.disc(8, 8, 1.5, C.dark); P.dot(7, 7, C.white); },
  battleCry: (P) => { P.poly([[5.5, 1], [10.5, 1], [9.3, 10], [6.7, 10]], C.red); P.rect(6, 12, 4, 3, C.red); P.line(6, 2, 7, 8, C.redL); },
  flee: (P) => { P.poly([[5.5, 1], [10.5, 1], [9.3, 10], [6.7, 10]], C.pur); P.rect(6, 12, 4, 3, C.pur); P.line(6, 2, 7, 8, '#d0a0f0'); },
  invuln: (P) => { shield(P, C.gold, C.goldL); sparkle(P, 8, 7.5, 3, C.white, C.white); },
};

let built = 0;
function build() {
  const dpr = window.devicePixelRatio || 1, F = ART * dpr;
  if (built === dpr) return;
  built = dpr;
  const st = document.documentElement.style;
  for (const [k, [layers, fill]] of Object.entries(FRAMES)) {
    const f = frame(layers, fill, F);
    st.setProperty(`--pf-${k}`, `url(${f.url})`);
    st.setProperty(`--pf-${k}-s`, String(f.slice));
    st.setProperty(`--pf-${k}-w`, f.w + 'px');
  }
  for (const [k, [css, layers, fill]] of Object.entries(ROUNDS)) {
    const cv = disc(Math.round(css / ART), Math.round(css * dpr), layers, fill);
    st.setProperty(`--pr-${k}`, `url(${cv.toDataURL()})`);
  }
  for (const [k, rows] of Object.entries(ICON_ART)) {
    const cv = bake(16, Math.round(16 * F), (x, y) => { const ch = rows[y][x]; return ch === '.' ? null : ICON_PAL[ch]; });
    PIX_ICONS[k] = cv.toDataURL();
  }
  for (const [k, draw] of Object.entries(BUFF_ART)) {
    const px = sprite(draw);
    st.setProperty(`--bi-${k}`, `url(${bake(16, Math.round(16 * F), (x, y) => px[y * 16 + x]).toDataURL()})`);
  }
}

// 캔버스(도트 해상도)에 그리는 둥근 테두리: 지름 n칸, 안쪽은 비운다
const RING = new Map();
export function pixRingCanvas(n, layers) {
  const key = n + '|' + JSON.stringify(layers);
  let c = RING.get(key);
  if (!c) { c = disc(n, n, layers, null); RING.set(key, c); }
  return c;
}
export const RING_BTN = ['#000', GOLD, '#1a140c'];
// 꽉 찬 원(오려 내기용 틀)
export function pixDiscCanvas(n) {
  const key = 'disc' + n;
  let c = RING.get(key);
  if (!c) { c = disc(n, n, [], '#fff'); RING.set(key, c); }
  return c;
}
// 캔버스 판 크기 그대로(변환 없이) 그림을 찍는다
export function stamp(cv, img, op = 'source-over') {
  const g = cv.g;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = op; g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, cv.c.width, cv.c.height);
  g.restore();
}


// 처음 한 번, 그리고 화면 배율이 바뀌면(다른 화면으로 옮김 등) 그림을 다시 굽는다. 글꼴은 미리 불러 둔다(캔버스 글자용)
let fontsAsked = false;
export function initPixelUI() {
  build();
  if (!fontsAsked && document.fonts?.load) { fontsAsked = true; document.fonts.load('12px Galmuri11').catch(() => {}); document.fonts.load('700 12px Galmuri11').catch(() => {}); }
}
// 캔버스 글꼴: 갈무리(12px의 정수배가 가장 또렷하다)
export const uiFont = (px, bold = false) => `${bold ? '700 ' : ''}${px}px Galmuri11, -apple-system, sans-serif`;

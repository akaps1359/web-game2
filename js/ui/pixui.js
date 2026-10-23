// 도트 UI: '도트 그래픽'을 켜면 단추·창·글꼴도 도트로 맞춘다. html.pix 아래의 CSS가 모양을 바꾸고, 여기서는
// 창·단추 테두리(9칸 조각 그림)와 둥근 단추·조이스틱 그림, 메뉴 단추 아이콘을 도트로 그려 CSS 변수로 넘긴다.
// 테두리 그림은 기기 픽셀 해상도로 직접 그려(도트 한 칸 = CSS 1.5px) 브라우저가 늘리며 흐려지지 않게 한다
import { SpritePass } from '../render/pixel.js';

export const UI = { pix: false, ART: 1.5 };

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

let built = 0;
function build() {
  const dpr = window.devicePixelRatio || 1, F = UI.ART * dpr;
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
    const cv = disc(Math.round(css / UI.ART), Math.round(css * dpr), layers, fill);
    st.setProperty(`--pr-${k}`, `url(${cv.toDataURL()})`);
  }
  for (const [k, rows] of Object.entries(ICON_ART)) {
    const cv = bake(16, Math.round(16 * F), (x, y) => { const ch = rows[y][x]; return ch === '.' ? null : ICON_PAL[ch]; });
    PIX_ICONS[k] = cv.toDataURL();
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

// 아이템 그림: 도트 해상도로 그린 뒤 가장자리를 굳히고 1도트 외곽선을 두른다
let SP = null;
export function pixIcon(cv, fn) {
  if (!UI.pix) { fn(cv.g); return; }
  if (!SP) SP = new SpritePass();
  const c = cv.c, g = cv.g, k = c.width / parseFloat(c.style.width), a = g.globalAlpha;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  SP.run(g, 0, 0, c.width, c.height, (sg) => { sg.scale(k, k); fn(sg); }, a);
  g.restore();
}

// 켜고 끄기. 글꼴은 미리 불러 둔다(캔버스 글자는 글꼴이 준비된 뒤부터 도트로)
export function setPixelUI(on) {
  on = !!on;
  if (on) build();
  UI.pix = on;
  document.documentElement.classList.toggle('pix', on);
  if (on && document.fonts?.load) { document.fonts.load('12px Galmuri11').catch(() => {}); document.fonts.load('700 12px Galmuri11').catch(() => {}); }
}
// 화면 배율이 바뀌면(다른 화면으로 옮김 등) 테두리를 다시 굽는다
export function refreshPixelUI() { if (UI.pix) build(); }
// 캔버스 글꼴: 도트면 갈무리(12px의 정수배가 가장 또렷하다)
export function uiFont(px, bold = false) {
  return UI.pix ? `${bold ? '700 ' : ''}${px}px Galmuri11, -apple-system, sans-serif` : `${bold ? '700 ' : ''}${px}px -apple-system, "Apple SD Gothic Neo", sans-serif`;
}

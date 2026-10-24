// DOM 도구
import { ART } from '../render/pixel.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export function el(tag, cls = '', text = null) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
// 창·대화 단추: 손가락을 떼는 순간 반응한다(click은 다른 손가락이 화면에 닿아 있으면 오지 않는다 — 조이스틱을 쥔 채 누를 때).
// 키보드·시험 도구의 click도 받되, 방금 손가락으로 누른 것이면 두 번 하지 않는다. 누른 뒤 창이 다시 그려져 손가락 밑에 새로 생긴
// 단추에 같은 탭의 click이 떨어지는 것까지 막도록 시각은 모든 단추가 함께 쓰고, 일을 마친 뒤에도 다시 찍는다(확인창이 오래 떠 있던 경우)
// 이 단추를 눌렀는데 손가락이 조금 미끄러져 탭으로 치지 않은 경우(click만 온다)는 받는다
let tapped = 0;
export function btn(cls, text, fn) {
  const b = el('button', cls, text);
  let downT = -1e9, fired = false;
  b.addEventListener('pointerdown', () => { downT = performance.now(); fired = false; });
  onTap(b, (e) => { fired = true; tapped = performance.now(); e.stopPropagation(); fn?.(e); tapped = performance.now(); });
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    const mine = !fired && performance.now() - downT < 1000;
    downT = -1e9;
    if (mine || performance.now() - tapped > 700) fn?.(e);
  });
  return b;
}
// 탭 반응(사파리에서 click 지연 없이)
export function onTap(node, fn) {
  let sx = 0, sy = 0, t0 = 0, down = false;
  node.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; t0 = performance.now(); });
  node.addEventListener('pointerup', (e) => {
    if (!down) return; down = false;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < 12 && performance.now() - t0 < 600) fn(e);
  });
  node.addEventListener('pointercancel', () => { down = false; });
}
// 누르는 순간 반응(물약처럼 급할 때 쓰는 단추: 손을 뗄 때까지 기다리지 않는다)
export function onPress(node, fn) {
  node.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
}
// UI 캔버스 해상도: 도트 한 칸(CSS 1.5px)이 판의 한 픽셀(CSS가 각진 그대로 키운다)
export const UI_DPR = 1 / ART;
export function canvasFor(node, w, h, dpr = UI_DPR) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  if (node) node.appendChild(c);
  return { c, g };
}

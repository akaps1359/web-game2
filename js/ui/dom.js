// DOM 도구
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export function el(tag, cls = '', text = null) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
export function btn(cls, text, fn) {
  const b = el('button', cls, text);
  b.addEventListener('click', (e) => { e.stopPropagation(); fn?.(e); });
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
export function canvasFor(node, w, h, dpr = Math.min(3, window.devicePixelRatio || 1)) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  if (node) node.appendChild(c);
  return { c, g };
}

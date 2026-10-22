// 작은 DOM 도우미
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function svgEl(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
// 탭(터치/클릭) — 스크롤과 구분
export function onTap(el, fn) {
  let sx = 0, sy = 0, moved = false, t0 = 0;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; moved = false; t0 = performance.now(); });
  el.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) moved = true; });
  el.addEventListener('click', (e) => { if (!moved) fn(e); });
  return el;
}

// 아이폰 사파리 화면 고정. 사파리는 user-scalable=no를 무시하므로 페이지 확대·밀림을 직접 막고, 생기면 되돌린다
let zoomed = false;
export const isZoomed = () => zoomed;

export function lockViewport(toast) {
  const root = document.documentElement, vv = window.visualViewport;
  // 1) 사파리 고유의 두 손가락 확대는 막는다. 이미 확대된 뒤라면 오므려 되돌릴 수 있게 둔다
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => { if (!zoomed) e.preventDefault(); }, { passive: false });
  // 2) 스크롤하면 안 되는 상자가 밀리면(입력 포커스·스크롤 연쇄 등 브라우저가 미는 경우) 곧바로 제자리로
  const LOCKED = new Set([root, document.body, ...['#app', '#hud', '#tabbar', '#sheet', '#float', '#toasts', '#side', '#modal'].map((s) => document.querySelector(s))].filter(Boolean));
  document.addEventListener('scroll', (e) => {
    const el = e.target === document ? document.scrollingElement : e.target;
    if (!el || el.nodeType !== 1) return;
    if (LOCKED.has(el)) { if (el.scrollLeft) el.scrollLeft = 0; if (el.scrollTop) el.scrollTop = 0; return; }
    if (el.scrollLeft && !/(auto|scroll)/.test(getComputedStyle(el).overflowX)) el.scrollLeft = 0;
  }, { capture: true, passive: true });
  const home = () => {
    if (zoomed) return;
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    for (const el of LOCKED) if (el.scrollLeft || el.scrollTop) { el.scrollLeft = 0; el.scrollTop = 0; }
  };
  window.addEventListener('scroll', home, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(home, 350));
  if (!vv) return;
  // 3) 확대 감지: 뷰포트 설정을 다시 써서 배율을 1로 되돌려 보고, 그래도 확대돼 있으면 오므려 되돌리도록 안내한다
  const meta = document.querySelector('meta[name=viewport]');
  const base = meta?.content || '';
  let timer = 0, warned = false;
  const check = () => {
    const z = vv.scale > 1.01;
    if (z !== zoomed) { zoomed = z; root.classList.toggle('zoomed', z); }
    if (!z) { warned = false; home(); return; }
    if (meta && !warned) { meta.content = base.replace('initial-scale=1', 'initial-scale=1.0'); requestAnimationFrame(() => { meta.content = base; }); }
    if (!warned) { warned = true; setTimeout(() => { if (zoomed) toast?.('화면이 확대되었습니다. 두 손가락으로 오므리면 원래 크기로 돌아갑니다.'); }, 700); }
  };
  vv.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(check, 250); });
  vv.addEventListener('scroll', () => { if (!zoomed && (vv.offsetLeft || vv.offsetTop)) home(); });
  check();
}

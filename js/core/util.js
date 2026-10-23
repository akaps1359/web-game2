// 수학·좌표 도구
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const sq = (x) => x * x;
export const TAU = Math.PI * 2;

// 아이소메트릭 타일: 화면에서 마름모 64×32 (월드 픽셀)
export const TW = 64, TH = 32;
export const isoX = (x, y) => (x - y) * (TW / 2);
export const isoY = (x, y) => (x + y) * (TH / 2);
// 화면(월드 픽셀) → 타일 좌표
export const unIsoX = (sx, sy) => sx / TW + sy / TH;
export const unIsoY = (sx, sy) => sy / TH - sx / TW;

// 8방향: 0=동(+x) … 타일 공간에서 반시계가 아니라 x→y 순서
export const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export const DIR4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// 각도 보간(최단 방향)
export function angLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
export const angDiff = (a, b) => Math.abs(((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI);

export function fmtNum(n) { return Math.round(n).toLocaleString('ko-KR'); }

// 한국어 조사: 받침 유무로 고른다 (예: josa('검', '을', '를'))
export function josa(word, a, b) {
  // 끝의 괄호·기호는 건너뛰고 마지막 글자를 본다(숫자는 읽는 소리로)
  const s = String(word).replace(/[\s)\]}」』'"!?.,~+-]+$/, '');
  const c = s.slice(-1), ch = c.charCodeAt(0);
  if (c >= '0' && c <= '9') return '013678'.includes(c) ? a : b;
  if (ch < 0xac00 || ch > 0xd7a3) return b;
  const jong = (ch - 0xac00) % 28;
  // '으로/로'는 ㄹ 받침 뒤에서 '로'
  if (a === '으로' && jong === 8) return b;
  return jong ? a : b;
}

export function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

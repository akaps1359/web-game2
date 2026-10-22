// 공용 세계 질의: 전쟁·동맹·영토
export const START_TIME = Date.UTC(1936, 0, 1);
export const HOURS_PER_DAY = 24;

export function dateOf(hour) { return new Date(START_TIME + hour * 3600e3); }
export function ymd(hour) { const d = dateOf(hour); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours() }; }
export function yearFrac(hour) { const d = dateOf(hour); const y = d.getUTCFullYear(); const s = Date.UTC(y, 0, 1), e = Date.UTC(y + 1, 0, 1); return y + (d - s) / (e - s); }
export function hourOfDate(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - START_TIME) / 3600e3); }
export function fmtDate(hour, withHour = false) { const t = ymd(hour); return `${t.y}년 ${t.m}월 ${t.d}일${withHour ? ` ${String(t.h).padStart(2, '0')}시` : ''}`; }

// 전쟁 관계 캐시: G.warRel[a][b] = 1 이면 교전 중
export function rebuildWarCache(G) {
  const rel = {};
  for (const w of G.wars) {
    for (const a of w.att) for (const b of w.def) {
      (rel[a] ||= {})[b] = 1; (rel[b] ||= {})[a] = 1;
    }
  }
  G.warRel = rel;
  G._ally = null;
}
export const atWar = (G, a, b) => !!(G.warRel[a] && G.warRel[a][b]);
export const atWarAny = (G, a) => !!G.warRel[a] && Object.keys(G.warRel[a]).length > 0;
export const enemiesOf = (G, a) => Object.keys(G.warRel[a] || {});

// 같은 편: 동일 국가 / 같은 진영 / 종주-괴뢰 / 같은 전쟁의 같은 편
// 결과는 시간 단위로 기억한다(전쟁 관계가 바뀌면 rebuildWarCache가 지운다)
export function allied(G, a, b) {
  if (a === b) return true;
  if (G._allyHour !== G.hour || !G._ally) { G._allyHour = G.hour; G._ally = new Map(); }
  const key = a < b ? a + b : b + a;
  let r = G._ally.get(key);
  if (r === undefined) { r = alliedRaw(G, a, b); G._ally.set(key, r); }
  return r;
}
function alliedRaw(G, a, b) {
  const A = G.countries[a], B = G.countries[b];
  if (!A || !B) return false;
  if (A.faction && A.faction === B.faction) return true;
  if (A.master === b || B.master === a || (A.master && A.master === B.master)) return true;
  for (const w of G.wars) {
    if ((w.att.includes(a) && w.att.includes(b)) || (w.def.includes(a) && w.def.includes(b))) return true;
  }
  return false;
}
// 이동/주둔 가능: 아군 영토 또는 군사 통행권
export function canEnter(G, tag, st) {
  const c = G.st[st].ctrl;
  if (c === tag || allied(G, tag, c)) return true;
  if (atWar(G, tag, c)) return true; // 공격 이동
  const C = G.countries[tag];
  return !!(C.access && C.access.includes(c));
}
export const friendlyCtrl = (G, tag, st) => { const c = G.st[st].ctrl; return c === tag || allied(G, tag, c); };

export function ownedStates(G, tag) { const out = []; for (let i = 0; i < G.st.length; i++) if (G.st[i].owner === tag) out.push(i); return out; }
export function controlledStates(G, tag) { const out = []; for (let i = 0; i < G.st.length; i++) if (G.st[i].ctrl === tag) out.push(i); return out; }

export function sideOf(G, war, tag) { return war.att.includes(tag) ? 'att' : war.def.includes(tag) ? 'def' : null; }

export function countryName(G, tag) { return G.countries[tag]?.name || tag; }

export function news(G, text, opts = {}) {
  G.news.unshift({ h: G.hour, text, ...opts });
  if (G.news.length > 80) G.news.length = 80;
  if (G.onNews) G.onNews(G.news[0]);
}

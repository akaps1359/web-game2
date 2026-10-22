// 외교: 전쟁·진영·보장·불가침·통행권·정당화·항복·강화·병합·괴뢰국·내전
import { M } from './mods.js';
import { atWar, allied, rebuildWarCache, news, ymd } from './world.js';
import { destroyDivision, divsOf, createDivision, firstControlled } from './military.js';
import { FACTION_DEFS, COUNTRIES } from '../data/countries.js';

// ───────── 긴장도 ─────────
export function addTension(G, amount, cause) {
  const months = G.hour / (24 * 30.4);
  const scale = Math.max(0.25, 1 - 0.005 * months);
  const C = cause && G.countries[cause];
  const mod = C ? 1 + M(C, 'tension') : 1;
  const v = amount * (amount > 0 ? scale * mod : 1);
  G.tension = Math.max(0, Math.min(1, G.tension + v));
  if (C && v > 0) C.tensionCaused = (C.tensionCaused || 0) + v;
}

// ───────── 전쟁 ─────────
export function warsOf(G, tag) { return G.wars.filter((w) => w.att.includes(tag) || w.def.includes(tag)); }
export function warBetween(G, a, b) { return G.wars.find((w) => (w.att.includes(a) && w.def.includes(b)) || (w.def.includes(a) && w.att.includes(b))); }

export function canDeclareWar(G, a, b) {
  const A = G.countries[a], B = G.countries[b];
  if (!A?.alive || !B?.alive || a === b) return '대상이 없습니다';
  if (atWar(G, a, b)) return '이미 전쟁 중입니다';
  if (allied(G, a, b)) return '동맹국입니다';
  if (A.master) return '괴뢰국은 독자적으로 선전포고할 수 없습니다';
  if (A.naps && A.naps[b] && A.naps[b] > G.hour) return '불가침 조약이 유효합니다';
  if (!A.wargoals.some((w) => w.target === b) && !A.anyWargoal) return '전쟁 목표가 없습니다(정당화 필요)';
  if (A.ideology === 'dem' && G.tension < 0.5 && !A.wargoals.some((w) => w.target === b && w.forced)) return '세계 긴장도가 낮아 민주주의 국가는 선전포고할 수 없습니다';
  return null;
}

export function declareWar(G, a, b, opts = {}) {
  if (atWar(G, a, b)) return warBetween(G, a, b);
  const A = G.countries[a], B = G.countries[b];
  // 대상이 괴뢰국이면 종주국과 전쟁
  const war = { id: G.nextId++, name: opts.name || `${A.name}-${B.name} 전쟁`, att: [a], def: [b], start: G.hour, attLeader: a, defLeader: b };
  G.wars.push(war);
  const hadGoal = A.wargoals.some((w) => w.target === b);
  A.wargoals = A.wargoals.filter((w) => w.target !== b);
  if (!opts.silentTension) addTension(G, hadGoal || opts.forced ? 0.07 : 0.1, a);
  // 통행권 해제
  A.access = (A.access || []).filter((t) => t !== b); B.access = (B.access || []).filter((t) => t !== a);
  // 불가침 위반
  if (A.naps && A.naps[b]) { delete A.naps[b]; delete B.naps?.[a]; A.baseStab -= 0.1; A.baseWs -= 0.1; }
  rebuildWarCache(G);
  // 방어측 합류: 종주국/괴뢰국, 진영, 보장국
  const joinDef = new Set();
  if (B.master) joinDef.add(B.master);
  for (const t in G.countries) { const X = G.countries[t]; if (X.alive && X.master === b) joinDef.add(t); }
  if (B.faction) for (const t of G.factions[B.faction]?.members || []) joinDef.add(t);
  if (!opts.noGuarantees) for (const t in G.countries) { const X = G.countries[t]; if (X.alive && X.guarantees?.includes(b)) joinDef.add(t); }
  for (const t of joinDef) if (t !== b && t !== a && G.countries[t]?.alive && !atWar(G, t, a) && !allied(G, t, a)) joinWar(G, war, t, 'def');
  // 공격측: 진영 지도자가 선전포고한 경우 진영 전체, 괴뢰국
  // 공격측: 진영 지도자가 선전포고하면 소국 동맹은 따라오지만, 강대국은 스스로 참전을 결정한다(이벤트·중점)
  if (A.faction && G.factions[A.faction]?.leader === a) for (const t of G.factions[A.faction].members) if (t !== a && !G.countries[t].major && !atWar(G, t, b) && !allied(G, t, b)) joinWar(G, war, t, 'att');
  for (const t in G.countries) { const X = G.countries[t]; if (X.alive && X.master === a && !atWar(G, t, b)) joinWar(G, war, t, 'att'); }
  rebuildWarCache(G);
  news(G, `${A.name}이(가) ${B.name}에 선전포고했습니다!`, { kind: 'war', tags: [a, b], big: 1 });
  if (G.onWar) G.onWar(war, a, b);
  return war;
}

export function joinWar(G, war, tag, side) {
  const X = G.countries[tag];
  if (!X?.alive || war.att.includes(tag) || war.def.includes(tag)) return;
  // 반대편에 동맹이 있으면 합류하지 않음
  const other = side === 'att' ? war.def : war.att;
  if (other.some((t) => allied(G, tag, t) && G.countries[t].faction && G.countries[t].faction === X.faction)) return;
  war[side].push(tag);
  rebuildWarCache(G);
  const leader = side === 'att' ? war.attLeader : war.defLeader;
  for (const t of other) { X.access = (X.access || []).filter((v) => v !== t); }
  if (tag !== leader) news(G, `${X.name}이(가) ${G.countries[leader].name} 편으로 참전했습니다.`, { kind: 'war', tags: [tag] });
}

// 아무도 남지 않은 쪽이 있으면 전쟁 종료
export function cleanupWars(G) {
  let changed = false;
  for (const w of [...G.wars]) {
    w.att = w.att.filter((t) => G.countries[t]?.alive && !G.countries[t].capitulated && !G.countries[t].exiledOut);
    w.def = w.def.filter((t) => G.countries[t]?.alive && !G.countries[t].capitulated && !G.countries[t].exiledOut);
    // 망명 정부는 전쟁에 남는다
    const keepExiles = (arr, orig) => arr;
    if (!w.att.length || !w.def.length) {
      G.wars = G.wars.filter((x) => x !== w);
      changed = true;
      const winners = w.att.length ? w.att : w.def;
      news(G, `${w.name}이(가) 종결되었습니다.`, { kind: 'peace', big: 1, tags: winners });
      if (G.onWarEnd) G.onWarEnd(w, winners);
    } else {
      if (!w.att.includes(w.attLeader)) w.attLeader = w.att[0];
      if (!w.def.includes(w.defLeader)) w.defLeader = w.def[0];
    }
  }
  if (changed) rebuildWarCache(G);
}

export function whitePeace(G, war) {
  G.wars = G.wars.filter((x) => x !== war);
  rebuildWarCache(G);
  // 점령지 반환
  for (let i = 0; i < G.st.length; i++) { const S = G.st[i]; if (S.ctrl !== S.owner && !atWar(G, S.ctrl, S.owner) && G.countries[S.owner]?.alive) S.ctrl = S.owner; }
  G.mapDirty = true;
  news(G, `${war.name}이(가) 백색 평화로 끝났습니다.`, { kind: 'peace', big: 1 });
}

// ───────── 영토 이전 ─────────
export function transferState(G, st, to, opts = {}) {
  const S = G.st[st];
  const from = S.owner;
  S.owner = to;
  if (!opts.keepCtrl || !atWar(G, S.ctrl, to)) S.ctrl = to;
  S.ctrlSince = G.hour;
  if (opts.core && !S.cores.includes(to)) S.cores.push(to);
  S.claims = S.claims.filter((c) => c !== to);
  // 이전 소유국 사단은 가장 가까운 자국 영토로 이동, 건설 대기열 제거
  const F = G.countries[from];
  if (F) {
    F.cons = F.cons.filter((p) => p.st !== st);
    for (const id of [...(G.divsAt[st] || [])]) {
      const D = G.divs[id];
      if (D && D.tag === from) {
        const dest = nearestOwned(G, from, st);
        if (dest >= 0) { D.loc = dest; D.path = []; D.att = -1; D.prog = 0; } else destroyDivision(G, D, 'transfer');
      }
    }
    if (F.capital === st) relocateCapital(G, F);
  }
  G.mapDirty = true;
  G.indexDirty = true;
}
export function transferStates(G, keys, to, opts) {
  for (const k of keys) { const i = typeof k === 'number' ? k : G.map.idx[k]; if (i != null && i >= 0) transferState(G, i, to, opts); }
}

function nearestOwned(G, tag, from) {
  const map = G.map; const seen = new Uint8Array(map.n); const q = [from]; seen[from] = 1;
  while (q.length) { const u = q.shift(); if (u !== from && G.st[u].ctrl === tag) return u; for (const v of map.nb[u]) if (!seen[v]) { seen[v] = 1; q.push(v); } }
  return firstControlled(G, tag);
}

export function relocateCapital(G, C) {
  let best = -1, bv = -1;
  for (let i = 0; i < G.st.length; i++) { const S = G.st[i]; if (S.owner === C.tag && S.ctrl === C.tag && S.cores.includes(C.tag) && S.vp > bv) { bv = S.vp; best = i; } }
  if (best < 0) for (let i = 0; i < G.st.length; i++) { const S = G.st[i]; if (S.ctrl === C.tag && S.vp > bv) { bv = S.vp; best = i; } }
  C.capital = best;
}

// 국가 병합(소멸)
export function annexCountry(G, to, from, opts = {}) {
  const F = G.countries[from];
  if (!F) return;
  for (let i = 0; i < G.st.length; i++) {
    const S = G.st[i];
    if (S.owner === from) { S.owner = opts.byController && S.ctrl !== from && G.countries[S.ctrl]?.alive ? S.ctrl : to; if (S.ctrl === from || !atWar(G, S.ctrl, S.owner)) S.ctrl = S.owner; S.ctrlSince = G.hour; }
    else if (S.ctrl === from) { S.ctrl = S.owner; }
  }
  // 장비 일부 이전
  const T = G.countries[to];
  if (T) for (const e in F.stock) T.stock[e] = (T.stock[e] || 0) + F.stock[e] * 0.5;
  for (const D of divsOf(G, from)) destroyDivision(G, D, 'annex');
  for (const id in G.wings) if (G.wings[id].tag === from) delete G.wings[id];
  for (const id in G.fleets) if (G.fleets[id].tag === from) { if (T) G.fleets[id].tag = to; else delete G.fleets[id]; }
  killCountry(G, from);
  if (!opts.silent) news(G, `${T ? T.name : '?'}이(가) ${F.name}을(를) 병합했습니다.`, { kind: 'annex', big: 1, tags: [to, from] });
  if (!opts.noTension) addTension(G, 0.03, to);
  G.mapDirty = true; G.indexDirty = true;
}

export function killCountry(G, tag) {
  const C = G.countries[tag];
  C.alive = false; C.capital = -1;
  if (C.faction) leaveFaction(G, tag);
  for (const w of G.wars) { w.att = w.att.filter((t) => t !== tag); w.def = w.def.filter((t) => t !== tag); }
  for (const t in G.countries) { const X = G.countries[t]; if (X.master === tag) X.master = null; X.guarantees = (X.guarantees || []).filter((g) => g !== tag); }
  G._ally = null;
  cleanupWars(G);
  rebuildWarCache(G);
}

export function setPuppet(G, master, sub) {
  const S = G.countries[sub];
  if (S.faction) leaveFaction(G, sub);
  S.master = master; G._ally = null;
  // 종주국 진영에 편입
  const Mm = G.countries[master];
  if (Mm.faction) joinFaction(G, sub, Mm.faction, true);
}

// 국가 생성(괴뢰국·해방·내전)
export function spawnCountry(G, tag, states, opts = {}) {
  const def = COUNTRIES[tag];
  let C = G.countries[tag];
  if (!C) { C = G.makeCountry(tag, def); G.countries[tag] = C; }
  C.alive = true; C.capitulated = false; C.exiled = false;
  for (const k of states) { const i = typeof k === 'number' ? k : G.map.idx[k]; if (i == null) continue; const S = G.st[i]; const prev = S.owner; transferState(G, i, tag, { core: true }); }
  relocateCapital(G, C);
  if (opts.capital) { const ci = G.map.idx[opts.capital]; if (ci != null && G.st[ci].owner === tag) C.capital = ci; }
  G.recountPop?.(C);
  G.indexDirty = true;
  return C;
}

// ───────── 진영 ─────────
export function createFaction(G, leader, id) {
  const def = FACTION_DEFS[id] || { name: id, color: '#888' };
  if (G.factions[id] && G.factions[id].members.length) return G.factions[id];
  const L = G.countries[leader];
  if (L.faction) leaveFaction(G, leader);
  G.factions[id] = { id, name: def.name, color: def.color, leader, members: [leader] };
  L.faction = id; G._ally = null;
  news(G, `${L.name}이(가) ${def.name}을(를) 결성했습니다.`, { kind: 'faction', big: 1, tags: [leader] });
  return G.factions[id];
}
export function joinFaction(G, tag, id, silent) {
  const F = G.factions[id]; if (!F) return;
  const C = G.countries[tag];
  if (C.faction === id) return;
  if (C.faction) leaveFaction(G, tag);
  F.members.push(tag); C.faction = id; G._ally = null;
  addTension(G, 0.03, tag);
  // 진영 지도자가 치르는 전쟁에 합류
  for (const w of G.wars) {
    if (w.att.includes(F.leader)) joinWar(G, w, tag, 'att');
    else if (w.def.includes(F.leader)) joinWar(G, w, tag, 'def');
  }
  if (!silent) news(G, `${C.name}이(가) ${F.name}에 가입했습니다.`, { kind: 'faction', tags: [tag] });
}
export function leaveFaction(G, tag) {
  const C = G.countries[tag]; const F = G.factions[C.faction]; C.faction = null; G._ally = null;
  if (!F) return;
  F.members = F.members.filter((t) => t !== tag);
  if (F.leader === tag) F.leader = F.members[0] || null;
  if (!F.members.length) delete G.factions[F.id];
}

// ───────── 보장 · 불가침 · 통행권 ─────────
export function guaranteeCost(C) { return 25 + 15 * (C.guarantees?.length || 0); }
export function canGuarantee(G, a, b) {
  const A = G.countries[a];
  const th = A.ideology === 'dem' ? 0.25 : A.ideology === 'neu' ? 0.4 : 0;
  if (G.tension < th) return `세계 긴장도 ${Math.round(th * 100)}% 필요`;
  if (A.guarantees?.includes(b)) return '이미 보장 중';
  if (atWar(G, a, b)) return '전쟁 중';
  if (A.pp < guaranteeCost(A)) return '정치력 부족';
  return null;
}
export function guarantee(G, a, b) {
  const A = G.countries[a];
  A.pp -= guaranteeCost(A);
  (A.guarantees ||= []).push(b);
  addTension(G, -0.05, a);
  news(G, `${A.name}이(가) ${G.countries[b].name}의 독립을 보장했습니다.`, { kind: 'diplo', tags: [a, b] });
}
export function signNap(G, a, b, months = 48) {
  const until = G.hour + months * 30 * 24;
  (G.countries[a].naps ||= {})[b] = until; (G.countries[b].naps ||= {})[a] = until;
  news(G, `${G.countries[a].name}과(와) ${G.countries[b].name}이(가) 불가침 조약을 체결했습니다.`, { kind: 'diplo', big: 1, tags: [a, b] });
}
export function grantAccess(G, from, to) { const C = G.countries[to]; if (!C.access.includes(from)) C.access.push(from); }

// ───────── 정당화 ─────────
export function canJustify(G, a, b) {
  const A = G.countries[a], B = G.countries[b];
  if (!B?.alive || a === b) return '대상 없음';
  if (allied(G, a, b)) return '동맹국';
  if (atWar(G, a, b)) return '이미 전쟁 중';
  if (A.master) return '괴뢰국';
  if (A.wargoals.some((w) => w.target === b)) return '이미 전쟁 목표 보유';
  if (A.justify.some((j) => j.target === b)) return '정당화 진행 중';
  if (A.naps?.[b] > G.hour) return '불가침 조약';
  const th = A.ideology === 'dem' ? 0.8 : A.ideology === 'neu' ? 0.5 : 0;
  if (G.tension < th) return `세계 긴장도 ${Math.round(th * 100)}% 필요`;
  if (A.ideology === 'dem' && !(B.tensionCaused > 0.05)) return '위협이 되는 국가만 대상으로 할 수 있습니다';
  if (A.pp < 50) return '정치력 50 필요';
  return null;
}
export function justifyDays(G, A, B) {
  let d = 60 * (1 - 0.5 * G.tension) * (1 + M(A, 'justify'));
  if (B.major && warsOfLen(G, B.tag)) d *= 0.25;
  d *= 1 + 0.5 * A.justify.length;
  return Math.max(10, Math.round(d));
}
const warsOfLen = (G, tag) => G.wars.some((w) => w.att.includes(tag) || w.def.includes(tag));
export function startJustify(G, a, b) {
  const A = G.countries[a], B = G.countries[b];
  A.pp -= 50;
  A.justify.push({ target: b, prog: 0, total: justifyDays(G, A, B) });
  const facA = (A.eco?.civ || 0) + (A.eco?.mil || 0);
  addTension(G, Math.min(0.06, 0.01 + 0.0005 * facA * (B.major ? 2 : 1)), a);
}
export function dailyJustify(G, C) {
  for (let i = 0; i < C.justify.length; i++) {
    const J = C.justify[i];
    J.prog++;
    if (!G.countries[J.target]?.alive || atWar(G, C.tag, J.target)) { C.justify.splice(i--, 1); continue; }
    if (J.prog >= J.total) {
      C.justify.splice(i--, 1);
      C.wargoals.push({ target: J.target, type: 'conquer' });
      if (G.onWargoal) G.onWargoal(C, J.target);
      news(G, `${C.name}이(가) ${G.countries[J.target].name}에 대한 전쟁 목표를 정당화했습니다.`, { kind: 'diplo', tags: [C.tag, J.target] });
    }
  }
}

// ───────── 항복 ─────────
export function surrenderProgress(G, tag) {
  let total = 0, lost = 0;
  for (let i = 0; i < G.st.length; i++) {
    const S = G.st[i];
    if (S.owner !== tag) continue;
    // 병합한 남의 땅(비핵심)은 4분의 1만 센다: 점령지를 잃는다고 본토가 무너지지는 않는다
    const v = Math.max(0.5, S.vp) * (S.cores.includes(tag) ? 1 : 0.25);
    total += v;
    if (S.ctrl !== tag && atWar(G, tag, S.ctrl)) lost += v;
  }
  const C = G.countries[tag];
  total += C.offmapVP || 0; // 지도 밖 후방(시베리아 등)은 잃지 않는다
  if (C.capital >= 0 && G.st[C.capital].ctrl !== tag && atWar(G, tag, G.st[C.capital].ctrl)) lost += total * 0.05;
  return total > 0 ? Math.min(1, lost / total) : 1;
}
export function surrenderLimit(G, C) {
  let lim = 0.8 + M(C, 'surrender');
  if (C.warSupport < 0.5) lim -= (0.5 - C.warSupport) * 0.6;
  return Math.max(0.2, Math.min(1, lim));
}
export function dailyCapitulation(G) {
  for (const tag in G.countries) {
    const C = G.countries[tag];
    if (!C.alive || C.capitulated || !G.warRel[tag]) continue;
    if (!Object.keys(G.warRel[tag]).length) { C.surrender = 0; continue; }
    const p = surrenderProgress(G, tag);
    C.surrender = p;
    const w = warsOf(G, tag);
    if (!w.length) continue;
    if (Math.min(...w.map((x) => G.hour - x.start)) < 7 * 24) continue;
    if (p >= surrenderLimit(G, C)) capitulate(G, tag);
  }
}

export function capitulate(G, tag) {
  const C = G.countries[tag];
  const enemies = Object.keys(G.warRel[tag] || {});
  if (!enemies.length) return;
  // 주요 승자: 가장 많은 승점을 점령한 적
  const vpBy = {};
  for (let i = 0; i < G.st.length; i++) { const S = G.st[i]; if (S.owner === tag && S.ctrl !== tag && enemies.includes(S.ctrl)) vpBy[S.ctrl] = (vpBy[S.ctrl] || 0) + Math.max(1, S.vp); }
  const victor = Object.keys(vpBy).sort((a, b) => vpBy[b] - vpBy[a])[0] || enemies[0];
  news(G, `${C.name}이(가) ${G.countries[victor].name}에 항복했습니다!`, { kind: 'capitulate', big: 1, tags: [tag, victor] });
  // 이벤트 훅(비시 프랑스 등) 우선
  if (G.onCapitulate && G.onCapitulate(tag, victor, enemies) === 'handled') { G.indexDirty = true; G.mapDirty = true; return; }
  settleCapitulation(G, tag, victor, enemies);
}

// 기본 처리: 점령지는 점령국이 병합, 나머지는 괴뢰국 또는 병합
export function settleCapitulation(G, tag, victor, enemies, opts = {}) {
  const C = G.countries[tag];
  const V = G.countries[victor];
  // 점령지 병합
  let remainVP = 0, totalVP = 0;
  for (let i = 0; i < G.st.length; i++) {
    const S = G.st[i];
    if (S.owner !== tag) continue;
    totalVP += Math.max(1, S.vp);
    if (S.ctrl !== tag && enemies.includes(S.ctrl)) { S.owner = S.ctrl; S.ctrlSince = G.hour; }
    else remainVP += Math.max(1, S.vp);
  }
  // 점령 중이던 남의 땅은 소유국(항복했거나 없으면 승자)에게 돌아가고, 그곳에 있던 적군은 가장 가까운 자국 영토로 철수한다
  // (1940년 네덜란드에 남은 연합군 교두보가 2년 뒤 상륙 거점이 되는 일을 막는다)
  for (let i = 0; i < G.st.length; i++) {
    const S = G.st[i];
    if (S.ctrl !== tag || S.owner === tag) continue;
    const O = G.countries[S.owner];
    S.ctrl = O?.alive && !O.capitulated ? S.owner : victor; S.ctrlSince = G.hour;
    for (const id of [...(G.divsAt[i] || [])]) {
      const D = G.divs[id];
      if (!D || D.tag === tag || D.tag === S.ctrl || !atWar(G, D.tag, S.ctrl)) continue;
      const dest = nearestOwned(G, D.tag, i);
      if (dest >= 0) { D.loc = dest; D.path = []; D.att = -1; D.prog = 0; } else destroyDivision(G, D, 'transfer');
    }
  }
  // 동맹이 계속 싸우면 망명 정부
  const alliesFighting = G.wars.some((w) => (w.att.includes(tag) && w.att.length > 1) || (w.def.includes(tag) && w.def.length > 1));
  const puppet = opts.puppet ?? (remainVP >= totalVP * 0.25 && V.isAI !== false);
  // 사단 해산
  for (const D of divsOf(G, tag)) destroyDivision(G, D, 'capitulate');
  for (const id in G.wings) if (G.wings[id].tag === tag) delete G.wings[id];
  const fleetTo = opts.fleetTo && G.countries[opts.fleetTo]?.alive ? opts.fleetTo : victor;
  for (const id in G.fleets) if (G.fleets[id].tag === tag) { G.fleets[id].tag = fleetTo; G.fleets[id].mission = 'idle'; G.fleets[id].reserve = false; }
  // 장비 절반 이전
  for (const e in C.stock) { V.stock[e] = (V.stock[e] || 0) + C.stock[e] * 0.5; C.stock[e] *= 0.1; }
  if (puppet && remainVP > 0) {
    // 전쟁에서 이탈, 괴뢰국화
    for (const w of G.wars) { w.att = w.att.filter((t) => t !== tag); w.def = w.def.filter((t) => t !== tag); }
    if (C.faction) leaveFaction(G, tag);
    setPuppet(G, victor, tag);
    relocateCapital(G, C);
    C.surrender = 0;
    rebuildWarCache(G);
    cleanupWars(G);
    news(G, `${C.name}은(는) ${V.name}의 괴뢰국이 되었습니다.`, { kind: 'annex', tags: [tag, victor] });
  } else {
    // 남은 영토는 승자에게
    for (let i = 0; i < G.st.length; i++) { const S = G.st[i]; if (S.owner === tag) { S.owner = victor; S.ctrl = victor; S.ctrlSince = G.hour; } }
    if ((alliesFighting && C.faction) || opts.exile) {
      if (C.capital >= 0) C.homeCap = C.capital;
      C.capitulated = true; C.exiled = true; C.capital = -1;
      for (const w of G.wars) { /* 망명정부는 전쟁에 남되 항복 상태 */ }
      news(G, `${C.name} 정부가 망명했습니다.`, { kind: 'diplo', tags: [tag] });
      rebuildWarCache(G);
    } else {
      killCountry(G, tag);
    }
  }
  G.mapDirty = true; G.indexDirty = true;
  if (G.onSettled) G.onSettled(tag, victor);
}

// 망명 정부 해방: 동맹이 핵심 영토를 되찾으면 반환
export function dailyLiberation(G) {
  for (const tag in G.countries) {
    const C = G.countries[tag];
    if (!C.exiled) continue;
    const back = [];
    for (let i = 0; i < G.st.length; i++) {
      const S = G.st[i];
      if (!S.cores.includes(tag) || S.ctrl === tag) continue;
      const c = S.ctrl;
      if (C.faction && G.countries[c]?.faction === C.faction) back.push(i);
    }
    if (!back.length) continue;
    // 망명 정부는 수도(또는 핵심 승점의 절반)를 되찾아야 귀환한다. 그 전에는 동맹군이 관리
    if (C.capitulated) {
      let coreVP = 0, freeVP = 0;
      for (let i = 0; i < G.st.length; i++) { const S = G.st[i]; if (!S.cores.includes(tag)) continue; const v = Math.max(1, S.vp); coreVP += v; if (back.includes(i)) freeVP += v; }
      const home = C.homeCap ?? -1;
      if (!(home >= 0 && back.includes(home)) && freeVP < coreVP * 0.5) continue;
    }
    {
      for (const i of back) { const S = G.st[i]; S.owner = tag; S.ctrl = tag; S.ctrlSince = G.hour; }
      if (C.homeCap >= 0 && back.includes(C.homeCap)) C.capital = C.homeCap;
      if (C.capitulated) {
        restoreGovernment(G, C, G.st[back[0]].ctrl);
        news(G, `${C.name}이(가) 해방되어 정부가 귀환했습니다!`, { kind: 'peace', big: 1, tags: [tag] });
        if (G.onLiberated) G.onLiberated(tag);
      }
      G.mapDirty = true; G.indexDirty = true;
    }
  }
}

// 망명 정부 복귀: 항복 상태를 풀고 진영 지도자(없으면 helper)의 전쟁에 다시 참가
export function restoreGovernment(G, C, helper) {
  C.capitulated = false; C.exiled = false; C.alive = true;
  if (!(C.capital >= 0 && G.st[C.capital].ctrl === C.tag)) relocateCapital(G, C);
  const lead = G.factions[C.faction]?.leader || helper;
  for (const w of G.wars) { if (w.att.includes(lead)) joinWar(G, w, C.tag, 'att'); else if (w.def.includes(lead)) joinWar(G, w, C.tag, 'def'); }
  G.mapDirty = true; G.indexDirty = true;
}

// ───────── 내전 ─────────
// 국가 tag의 일부 주(keys)를 newTag로 분리하고 전쟁 선포
export function civilWar(G, tag, newTag, keys, opts = {}) {
  const C = G.countries[tag];
  const N = spawnCountry(G, newTag, keys, opts);
  // 사단 일부 이전: 분리된 영토에 있는 사단
  for (const id in G.divs) {
    const D = G.divs[id];
    if (D.tag === tag && G.st[D.loc].owner === newTag) {
      // 편제 복사
      const tpl = C.templates.find((t) => t.id === D.tpl);
      let nt = N.templates.find((t) => t.key === tpl?.key);
      if (!nt && tpl) { nt = { ...tpl, id: G.nextId++ }; N.templates.push(nt); }
      D.tag = newTag; D.tpl = nt ? nt.id : D.tpl; D.army = 0;
    }
  }
  if (opts.share) for (const e in C.stock) { const amt = C.stock[e] * opts.share; N.stock[e] = (N.stock[e] || 0) + amt; C.stock[e] -= amt; }
  N.mp.total = 0;
  const war = declareWar(G, newTag, tag, { name: opts.warName || `${C.name} 내전`, forced: true, silentTension: true });
  G.indexDirty = true; G.mapDirty = true;
  return war;
}

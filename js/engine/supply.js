// 보급: 수도·거점 도시·항구에서 아군 영토를 따라 퍼지는 보급 값(0~1)과 수용량
import { allied, atWar } from './world.js';
import { moveCost, divStats } from './military.js';

const HUB_VP = 8;

export function computeSupply(G) {
  const map = G.map, n = map.n;
  G.supplyOf = {};
  G.supCap = {};
  for (const tag in G.countries) {
    const C = G.countries[tag];
    if (!C.alive) continue;
    // 평시: 계산 생략(자국 영토 보급 1)
    if (!G.warRel[tag] || !Object.keys(G.warRel[tag]).length) { G.supplyOf[tag] = null; continue; }
    const friendly = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const c = G.st[i].ctrl; if (c === tag || allied(G, tag, c) || C.access?.includes(c)) friendly[i] = 1; }
    const val = new Float32Array(n);
    // 거점 목록 [state, factor]
    const src = [];
    if (C.capital >= 0 && friendly[C.capital]) src.push([C.capital, 1]);
    for (let i = 0; i < n; i++) {
      if (!friendly[i]) continue;
      const S = G.st[i];
      if (S.ctrl === tag && S.vp >= HUB_VP && S.cores.includes(tag)) src.push([i, 0.9]);
      else if (S.ctrl === tag && S.vp >= 5 && G.hour - (S.ctrlSince || 0) > 14 * 24) src.push([i, 0.7]);
      else if (S.ctrl !== tag && friendly[i] && S.vp >= 15 && G.countries[S.ctrl]?.capital === i) src.push([i, 0.8]); // 동맹국 수도
    }
    // 해상 보급: 도달 가능한 해역에 닿은 아군 항구
    const reach = G.seaReach?.[tag];
    if (reach) {
      for (let i = 0; i < n; i++) {
        if (!friendly[i] || !(G.st[i].port > 0)) continue;
        if (map.coast[i].some((z) => reach.has(z))) src.push([i, Math.min(0.85, 0.45 + 0.07 * G.st[i].port)]);
      }
    }
    // 다익스트라: 거리 감쇠
    const best = new Float32Array(n);
    const dist = new Float64Array(n).fill(Infinity);
    const fac = new Float32Array(n);
    const open = [];
    for (const [s, f] of src) {
      // 동일 출발점이 여러 번이면 큰 값
      if (f > fac[s] || dist[s] > 0) { fac[s] = Math.max(fac[s], f); dist[s] = 0; open.push(s); }
    }
    // 각 노드의 (출발 계수, 거리) 조합 중 최대 보급 값을 근사: 단순화를 위해 값 기준 확장
    const score = (f, d) => f * Math.max(0.2, Math.min(1, 1.1 - d / 1600));
    for (const s of open) best[s] = score(fac[s], 0);
    const visitedOrder = [...open];
    const q = open.slice();
    while (q.length) {
      // 최고 보급값 노드 선택
      let bi = 0; for (let k = 1; k < q.length; k++) if (best[q[k]] > best[q[bi]]) bi = k;
      const u = q[bi]; q.splice(bi, 1);
      for (const v of map.nb[u]) {
        if (!friendly[v]) continue;
        const nd = dist[u] + moveCost(G, u, v);
        const sc = score(fac[u], nd);
        if (sc > best[v] + 1e-4) { best[v] = sc; dist[v] = nd; fac[v] = fac[u]; q.push(v); visitedOrder.push(v); }
      }
    }
    for (let i = 0; i < n; i++) {
      if (!friendly[i]) { val[i] = 0; continue; }
      const infra = G.st[i].infra || 1;
      val[i] = best[i] > 0 ? best[i] * (0.7 + 0.06 * infra) : 0.04;
    }
    G.supplyOf[tag] = val;
  }
  // 수용량 대비 수요 (주별·국가별)
  const demand = {};
  for (const id in G.divs) {
    const D = G.divs[id];
    const k = D.tag + ':' + D.loc;
    demand[k] = (demand[k] || 0) + divStats(G, D).sup * Math.max(0.3, D.str);
  }
  G.supRatio = {};
  for (const k in demand) {
    const [tag, locS] = k.split(':'); const loc = +locS;
    const so = G.supplyOf[tag];
    const v = so ? so[loc] : 1;
    const S = G.st[loc];
    const cap = v * (3 + (S.infra || 1) * 2.5 + (S.port || 0) * 0.8 + (S.vp >= 10 ? 4 : 0));
    G.supRatio[k] = Math.max(0, Math.min(1, cap / Math.max(0.01, demand[k])));
  }
}

// 매 시간 사단 보급 값 갱신
export function assignDivSupply(G) {
  for (const id in G.divs) {
    const D = G.divs[id];
    const v = G.supplyOf?.[D.tag]?.[D.loc] ?? 1;
    const r = G.supRatio?.[D.tag + ':' + D.loc] ?? 1;
    D.sup = Math.min(1, v * (0.4 + 0.6 * r) * 1.15);
  }
}

// 해상 도달 가능 해역: 아군 항구에서 시작, 적 제해권(≥0.5) 해역은 통과 불가
export function computeSeaReach(G) {
  const map = G.map;
  G.seaReach = {};
  for (const tag in G.countries) {
    const C = G.countries[tag];
    if (!C.alive) continue;
    if (!G.warRel[tag] || !Object.keys(G.warRel[tag]).length) { G.seaReach[tag] = null; continue; } // 평시: 봉쇄 없음
    const set = new Set();
    const q = [];
    for (let i = 0; i < map.n; i++) {
      const S = G.st[i];
      if (!(S.port > 0)) continue;
      if (!(S.ctrl === tag || allied(G, tag, S.ctrl))) continue;
      for (const z of map.coast[i]) if (!set.has(z) && !blocked(G, tag, z)) { set.add(z); q.push(z); }
    }
    while (q.length) {
      const z = q.shift();
      for (const w of map.seas[z].nb) {
        if (set.has(w) || blocked(G, tag, w)) continue;
        // 해협·운하 통제
        const via = map.seas[z].via[w];
        if (via != null) { const c = G.st[via].ctrl; if (c !== tag && !allied(G, tag, c) && atWar(G, tag, c)) continue; }
        set.add(w); q.push(w);
      }
    }
    G.seaReach[tag] = set;
  }
}

export function blocked(G, tag, z) {
  const ns = G.navSup?.[z];
  if (!ns) return false;
  let enemy = 0, own = 0;
  for (const t in ns) { if (t === tag || allied(G, tag, t)) own += ns[t]; else if (atWar(G, tag, t)) enemy += ns[t]; }
  return enemy > 0 && enemy / (enemy + own) >= 0.5 && enemy > 20;
}

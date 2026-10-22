// 지도 생성 파이프라인: Natural Earth(퍼블릭 도메인) 행정구역 → 1936년 주/해역/하천/호수 → data/map.json
// 사용법: (1) sh fetch-ne.sh  (2) node build-map.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { geoMercator } from 'd3-geo';
import { Delaunay } from 'd3-delaunay';
import polygonClipping from 'polygon-clipping';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { mergeArcs } from 'topojson-client';
import { STATES, SEAS, STRAITS, LAND_STRAITS, MODERN_OWNERS } from '../js/data/states.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NE = process.env.NE_DIR || path.join(HERE, 'ne');
const OUT = path.join(HERE, '..', 'data', 'map.json');
const log = (...a) => console.log(...a);

// ───────────── 투영: 메르카토르(하츠 오브 아이언식으로 유럽이 크게 보임) ─────────────
// x = R·λ, y = −R·ln tan(π/4+φ/2), 단위 km(적도 기준)
const PROJ = { type: 'mercator', lon0: 20, R: 6371 };
const proj = geoMercator().rotate([-PROJ.lon0, 0]).scale(PROJ.R).translate([0, 0]);
const P = (lon, lat) => proj([lon, lat]);
const Q = 0.05; // 좌표 격자(km)
const snap = (v) => Math.round(v / Q) * Q;
const projRing = (ring) => {
  const out = [];
  for (const [lon, lat] of ring) {
    const p = P(lon, lat);
    const q = [snap(p[0]), snap(p[1])];
    const l = out[out.length - 1];
    if (!l || l[0] !== q[0] || l[1] !== q[1]) out.push(q);
  }
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push([...out[0]]);
  return out;
};

// ───────────── 기하 유틸 ─────────────
function ringArea(r) { let a = 0; for (let i = 0, n = r.length - 1; i < n; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; }
function ringCentroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = r.length - 1; i < n; i++) { const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f; }
  if (Math.abs(a) < 1e-9) return r[0];
  return [cx / (3 * a), cy / (3 * a)];
}
function pointInRing(x, y, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInPoly(x, y, poly) { if (!pointInRing(x, y, poly[0])) return false; for (let k = 1; k < poly.length; k++) if (pointInRing(x, y, poly[k])) return false; return true; }
function bboxOf(rings) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const r of rings) for (const p of r) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; } return [a, b, c, d]; }
const inBox = (x, y, b, m = 0) => x >= b[0] - m && x <= b[2] + m && y >= b[1] - m && y <= b[3] + m;

// 극접근불가점(polylabel) — 라벨 위치
function polylabel(polygon, precision = 2) {
  const [minX, minY, maxX, maxY] = bboxOf([polygon[0]]);
  const w = maxX - minX, h = maxY - minY, cellSize = Math.min(w, h);
  if (cellSize === 0) return [minX, minY, 0];
  let hsz = cellSize / 2;
  const segDist = (px, py, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx !== 0 || dy !== 0) { const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy); if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; } }
    dx = px - x; dy = py - y; return dx * dx + dy * dy;
  };
  const dist = (x, y) => { let inside = false, md = Infinity; for (const ring of polygon) { for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside; md = Math.min(md, segDist(x, y, a, b)); } } return (inside ? 1 : -1) * Math.sqrt(md); };
  const Cell = (x, y, h) => { const d = dist(x, y); return { x, y, h, d, max: d + h * Math.SQRT2 }; };
  const q = [];
  for (let x = minX; x < maxX; x += cellSize) for (let y = minY; y < maxY; y += cellSize) q.push(Cell(x + hsz, y + hsz, hsz));
  const c0 = ringCentroid(polygon[0]);
  let best = Cell(c0[0], c0[1], 0);
  const bb = Cell(minX + w / 2, minY + h / 2, 0); if (bb.d > best.d) best = bb;
  let guard = 0;
  while (q.length && guard++ < 20000) {
    q.sort((a, b) => a.max - b.max);
    const c = q.pop();
    if (c.d > best.d) best = c;
    if (c.max - best.d <= precision) continue;
    hsz = c.h / 2;
    q.push(Cell(c.x - hsz, c.y - hsz, hsz), Cell(c.x + hsz, c.y - hsz, hsz), Cell(c.x - hsz, c.y + hsz, hsz), Cell(c.x + hsz, c.y + hsz, hsz));
  }
  return [best.x, best.y, best.d];
}

// 메르카토르 국지 축척 k = sec φ (투영 km / 실제 km)
const kAt = (y) => { const phi = 2 * Math.atan(Math.exp(-y / PROJ.R)) - Math.PI / 2; return 1 / Math.cos(phi); };
// 축척계수(면적 보정용)
function scaleAt(lon, lat) { const a = P(lon, lat), b = P(lon, lat + 0.01); return Math.hypot(a[0] - b[0], a[1] - b[1]) / (0.01 * 111.195); }

// ───────────── 데이터 로드 ─────────────
const load = (f) => JSON.parse(fs.readFileSync(path.join(NE, f), 'utf8'));
log('loading admin-1 …');
const ADM1 = load('ne_10m_admin_1_states_provinces.geojson');

// ───────────── 시드 ─────────────
const ST = STATES.map(([key, name, owner, lon, lat, o = {}], i) => ({ i, key, name, owner, lon, lat, o }));
const keyIdx = Object.fromEntries(ST.map((s) => [s.key, s.i]));
const seeds = [];
for (const s of ST) {
  const pts = [[s.lon, s.lat], ...(s.o.x || [])];
  for (const [lon, lat] of pts) { const p = P(lon, lat); seeds.push({ st: s.i, owner: s.owner, x: p[0], y: p[1], lon, lat }); }
}
const ownerSeeds = {};
for (const sd of seeds) (ownerSeeds[sd.owner] ||= []).push(sd);

// ───────────── 포함 여부 ─────────────
function featureIncluded(p) {
  const a3 = p.adm0_a3, lon = p.longitude, lat = p.latitude;
  if (!MODERN_OWNERS[a3]) return false;
  if (lon < -33 || lon > 62.5 || lat < -6 || lat > 72) return false;
  if (['RUS', 'KAZ', 'TKM', 'UZB'].includes(a3) && lon > 62) return false;
  return true;
}
function partIncluded(a3, ring) {
  // ring: 경위도 외곽선
  let sx = 0, sy = 0; for (const p of ring) { sx += p[0]; sy += p[1]; } sx /= ring.length; sy /= ring.length;
  if (sy > 71.6) return false; // 스발바르, 노바야제믈랴, 프란츠요제프
  if (a3 === 'NOR' && sx < -5) return false; // 얀마옌
  if (a3 === 'RUS' && sx > 62.5) return false;
  return true;
}

// ───────────── 1단계: 행정구역 조각 → 주 배정 ─────────────
log('assigning admin-1 parts to states …');
const pieces = []; // {st, poly(projected)}
const offPieces = []; // {a3, poly}
let nSplit = 0, nNearest = 0, nWhole = 0;
const warn = [];
const MAPBOX_LONLAT = [-45, -12, 75, 82]; // 지도 밖 육지 포함 범위(경위도 대략)

// 활성 행정구역(투영 완료) 목록
const activeFeats = [];
for (const f of ADM1.features) {
  const p = f.properties;
  const g = f.geometry; if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const inc = featureIncluded(p);
  const parts = [];
  for (const poly of polys) {
    if (!inc) {
      // 지도 밖(비활성) 육지
      let sx = 0, sy = 0; for (const q of poly[0]) { sx += q[0]; sy += q[1]; } sx /= poly[0].length; sy /= poly[0].length;
      if (sx < MAPBOX_LONLAT[0] || sx > MAPBOX_LONLAT[2] || sy < MAPBOX_LONLAT[1] || sy > MAPBOX_LONLAT[3]) continue;
      if ((p.adm0_a3 === 'USA' || p.adm0_a3 === 'CAN') && sx < -50) continue;
      offPieces.push({ a3: p.adm0_a3, poly: poly.map(projRing).filter((r) => r.length >= 4) });
      continue;
    }
    if (!partIncluded(p.adm0_a3, poly[0])) continue;
    const pp = poly.map(projRing).filter((r) => r.length >= 4);
    if (!pp.length) continue;
    parts.push({ pp, bb: bboxOf([pp[0]]) });
  }
  if (inc && parts.length) activeFeats.push({ p, parts, bb: bboxOf(parts.map((q) => q.pp[0])), seeds: [] });
}
// 시드 → 행정구역 (해안 바로 밖에 찍힌 시드는 가장 가까운 경계의 행정구역으로)
const distToRing = (x, y, r) => { let md = Infinity; for (let k = 1; k < r.length; k++) { const a = r[k - 1], b = r[k]; const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1e-9; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L2)); md = Math.min(md, Math.hypot(x - (a[0] + t * vx), y - (a[1] + t * vy))); } return md; };
for (const sd of seeds) {
  let found = null;
  for (const af of activeFeats) { if (!inBox(sd.x, sd.y, af.bb)) continue; if (af.parts.some((q) => inBox(sd.x, sd.y, q.bb) && pointInPoly(sd.x, sd.y, q.pp))) { found = af; break; } }
  if (!found) {
    let bd = 25;
    for (const af of activeFeats) { if (!inBox(sd.x, sd.y, af.bb, 25)) continue; for (const q of af.parts) { if (!inBox(sd.x, sd.y, q.bb, 25)) continue; const d = distToRing(sd.x, sd.y, q.pp[0]); if (d < bd) { bd = d; found = af; } } }
    if (found) warn.push(`seed offshore → snapped: ${ST[sd.st].key} (${sd.lon},${sd.lat}) → ${found.p.name}`);
    else warn.push(`SEED NOT ON LAND: ${ST[sd.st].key} (${sd.lon},${sd.lat})`);
  }
  if (found) found.seeds.push(sd);
}
for (const af of activeFeats) {
  const p = af.p;
  const inside = af.seeds;
  for (const { pp, bb } of af.parts) {
    const sts = [...new Set(inside.map((s) => s.st))];
    if (sts.length === 1) { pieces.push({ st: sts[0], poly: pp }); nWhole++; continue; }
    if (sts.length === 0) {
      const cands = MODERN_OWNERS[p.adm0_a3];
      const c = ringCentroid(pp[0]);
      let best = null, bd = Infinity;
      for (const o of cands) for (const s of ownerSeeds[o] || []) { const d = (s.x - c[0]) ** 2 + (s.y - c[1]) ** 2; if (d < bd) { bd = d; best = s; } }
      if (!best) { warn.push(`no seed for ${p.adm0_a3} ${p.name}`); continue; }
      pieces.push({ st: best.st, poly: pp }); nNearest++;
      continue;
    }
    // 둘 이상의 주 시드 → 보로노이 분할
    nSplit++;
    const m = 50;
    const allX = inside.map((s) => s.x), allY = inside.map((s) => s.y);
    const vb = [Math.min(bb[0], ...allX) - m, Math.min(bb[1], ...allY) - m, Math.max(bb[2], ...allX) + m, Math.max(bb[3], ...allY) + m];
    const del = Delaunay.from(inside.map((s) => [s.x, s.y]));
    const vor = del.voronoi(vb);
    const byState = new Map();
    inside.forEach((s, k) => {
      const cell = vor.cellPolygon(k);
      if (!cell) return;
      const cellR = cell.map(([x, y]) => [snap(x), snap(y)]);
      let res;
      try { res = polygonClipping.intersection(pp, [cellR]); } catch (e) { warn.push(`clip fail ${p.name}: ${e.message}`); return; }
      for (const r of res) {
        const rr = r.map((ring) => ring.map(([x, y]) => [snap(x), snap(y)]));
        if (!byState.has(s.st)) byState.set(s.st, []);
        byState.get(s.st).push(rr);
      }
    });
    for (const [st, polysOfSt] of byState) {
      let merged = polysOfSt;
      if (polysOfSt.length > 1) {
        try { merged = polygonClipping.union(...polysOfSt.map((q) => [q])).map((q) => q); } catch (e) { warn.push(`union fail ${p.name}`); }
      }
      for (const q of merged) pieces.push({ st, poly: q.map((ring) => ring.map(([x, y]) => [snap(x), snap(y)])) });
    }
  }
}
log(`pieces: ${pieces.length} (whole ${nWhole}, nearest ${nNearest}, split ${nSplit}); offmap ${offPieces.length}`);

// 주별 확인
const pieceCount = new Array(ST.length).fill(0);
for (const pc of pieces) pieceCount[pc.st]++;
ST.forEach((s) => { if (!pieceCount[s.i]) warn.push(`STATE WITHOUT GEOMETRY: ${s.key}`); });

// ───────────── 지도 범위 ─────────────
let bounds = [Infinity, Infinity, -Infinity, -Infinity];
for (const pc of pieces) { const b = bboxOf([pc.poly[0]]); bounds = [Math.min(bounds[0], b[0]), Math.min(bounds[1], b[1]), Math.max(bounds[2], b[2]), Math.max(bounds[3], b[3])]; }
const MARGIN = 350;
const W = [Math.floor(bounds[0] - MARGIN), Math.floor(bounds[1] - MARGIN), Math.ceil(bounds[2] + MARGIN), Math.ceil(bounds[3] + MARGIN)];
log('world bounds (km):', W, 'size', W[2] - W[0], 'x', W[3] - W[1]);

// 지도 밖 육지는 화면 범위로 자르기
const worldRect = [[[W[0], W[1]], [W[2], W[1]], [W[2], W[3]], [W[0], W[3]], [W[0], W[1]]]];
const offClipped = [];
for (const op of offPieces) {
  const b = bboxOf([op.poly[0]]);
  if (b[2] < W[0] || b[0] > W[2] || b[3] < W[1] || b[1] > W[3]) continue;
  if (b[0] >= W[0] && b[2] <= W[2] && b[1] >= W[1] && b[3] <= W[3]) { offClipped.push(op); continue; }
  try {
    const res = polygonClipping.intersection(op.poly, worldRect);
    for (const r of res) offClipped.push({ a3: op.a3, poly: r.map((ring) => ring.map(([x, y]) => [snap(x), snap(y)])) });
  } catch (e) { /* skip */ }
}
log('offmap pieces in view:', offClipped.length);

// ───────────── 2단계: 위상 구조 + 단순화 ─────────────
log('building topology …');
const feats = [];
pieces.forEach((pc, k) => feats.push({ type: 'Feature', properties: { st: pc.st }, geometry: { type: 'Polygon', coordinates: pc.poly } }));
offClipped.forEach((pc) => feats.push({ type: 'Feature', properties: { off: pc.a3 }, geometry: { type: 'Polygon', coordinates: pc.poly } }));
let topo = topology({ all: { type: 'FeatureCollection', features: feats } }, 1e6);
log('arcs before simplify:', topo.arcs.length, 'points', topo.arcs.reduce((s, a) => s + a.length, 0));
topo = presimplify(topo);
// 작은 주(지브롤터·몰타 등) 보호
const geoms = topo.objects.all.geometries;
const protectArcs = new Set();
const smallSt = new Set(ST.filter((s) => ['gibraltar', 'malta', 'danzig', 'luxembourg', 'faroe', 'rhodes'].includes(s.key)).map((s) => s.i));
const forEachArc = (g, fn) => { const walk = (a) => { if (typeof a === 'number') fn(a < 0 ? ~a : a); else a.forEach(walk); }; walk(g.arcs); };
for (const g of geoms) if (g.properties.st !== undefined && smallSt.has(g.properties.st)) forEachArc(g, (a) => protectArcs.add(a));
for (const a of protectArcs) for (const pt of topo.arcs[a]) pt[2] = Infinity;
const SIMPLIFY_AREA = 1.2; // km² (Visvalingam 유효 면적)
topo = simplify(topo, SIMPLIFY_AREA);
log('points after simplify:', topo.arcs.reduce((s, a) => s + a.length, 0));

// 절대 좌표 arcs
const tf = topo.transform;
const absArcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map((p) => { x += p[0]; y += p[1]; return tf ? [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]] : [p[0], p[1]]; });
});
// presimplify가 transform을 제거했는지 확인
const arcsAreAbs = !tf;
const ARCS = arcsAreAbs ? topo.arcs.map((a) => a.map((p) => [p[0], p[1]])) : absArcs;

// ───────────── 3단계: 주 병합 ─────────────
log('merging states …');
const geomsBySt = new Map();
const offGeoms = [];
for (const g of geoms) {
  if (g.properties.st !== undefined) { if (!geomsBySt.has(g.properties.st)) geomsBySt.set(g.properties.st, []); geomsBySt.get(g.properties.st).push(g); }
  else offGeoms.push(g);
}
function ringFromArcs(ringArcs) {
  const pts = [];
  for (const a of ringArcs) {
    let arc = ARCS[a < 0 ? ~a : a];
    if (a < 0) arc = arc.slice().reverse();
    for (let k = pts.length ? 1 : 0; k < arc.length; k++) pts.push(arc[k]);
  }
  return pts;
}
const stateGeom = []; // [st] -> {type:'MultiPolygon', arcs}
for (const s of ST) {
  const gs = geomsBySt.get(s.i) || [];
  const m = mergeArcs(topo, gs);
  // 너무 작은 고리 제거(가장 큰 폴리곤은 유지)
  const polys = m.arcs.map((poly) => poly.filter((ring) => ring.length > 0));
  const scored = polys.map((poly) => ({ poly, area: Math.abs(ringArea(ringFromArcs(poly[0]))) }));
  scored.sort((a, b) => b.area - a.area);
  const keep = scored.filter((p, k) => k === 0 || p.area >= 25).map((p) => p.poly);
  stateGeom[s.i] = keep;
}
const offMerged = mergeArcs(topo, offGeoms);

// 사용되는 arc 수집 및 재색인
const arcUse = new Map(); // arc -> [st...]
for (const s of ST) for (const poly of stateGeom[s.i]) for (const ring of poly) for (const a of ring) { const k = a < 0 ? ~a : a; if (!arcUse.has(k)) arcUse.set(k, []); arcUse.get(k).push(s.i); }
const offArcUse = new Map();
for (const poly of offMerged.arcs) for (const ring of poly) for (const a of ring) { const k = a < 0 ? ~a : a; offArcUse.set(k, (offArcUse.get(k) || 0) + 1); }
// 지도 밖 국가 간 경계(희미하게 그릴 것)
const offBorderArcs = new Set();
{
  const arcOwners = new Map();
  for (const g of offGeoms) forEachArc(g, (a) => { if (!arcOwners.has(a)) arcOwners.set(a, new Set()); arcOwners.get(a).add(g.properties.off); });
  for (const [a, set] of arcOwners) if (set.size > 1) offBorderArcs.add(a);
}

const usedArcs = new Set([...arcUse.keys(), ...offArcUse.keys(), ...offBorderArcs]);
const arcList = [...usedArcs].sort((a, b) => a - b);
const remap = new Map(arcList.map((a, k) => [a, k]));
const mapArc = (a) => (a < 0 ? ~remap.get(~a) : remap.get(a));

// ───────────── 4단계: 해안/인접 ─────────────
log('loading land/lakes for coast detection …');
const LAND10 = load('ne_10m_land.geojson');
const landPolys = [];
for (const f of LAND10.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    // 회전된 날짜변경선(서경 160°)을 가로지르는 폴리곤(유라시아·북미 대륙)은 경위도에서 먼저 잘라냄
    let mnL = Infinity, mxL = -Infinity; for (const q of poly[0]) { if (q[0] < mnL) mnL = q[0]; if (q[0] > mxL) mxL = q[0]; }
    let parts = [poly];
    if (mxL < -60 || mnL > 100) continue;
    if (mnL < -60 || mxL > 100) {
      try { parts = polygonClipping.intersection(poly, [[[-60, -70], [100, -70], [100, 85], [-60, 85], [-60, -70]]]); } catch (e) { warn.push('land clip fail'); continue; }
    }
    for (const part of parts) {
      const pp = part.map(projRing).filter((r) => r.length >= 4);
      if (!pp.length) continue;
      const b = bboxOf([pp[0]]);
      if (b[2] < W[0] || b[0] > W[2] || b[3] < W[1] || b[1] > W[3]) continue;
      landPolys.push({ b, pp });
    }
  }
}
const LAKES10 = load('ne_10m_lakes.geojson');
const RESERVOIRS = /reservoir|vodokhranilishche|vdkhr|nasser|kuybyshev|rybinsk|tsimlyan|kakhov|kremenchuk|kanivs|kyivs|volgograd|saratov|cheboksar|gorkov|votkinsk|kamsk|nizhnekamsk|dnipro|dniprodzerzhynsk|ivankovsk|uglich|sheksna|iriklin|kapshagay|razaz|tharthar|habbaniyah|qadisiyah|mosul|haditha|keban|ataturk|tabqa|assad|merowe|roseires|sennar|jebel aulia|el mansour|manantali|kossou|tana$/i;
const lakePolys = [];
const lakeOut = [];
for (const f of LAKES10.features) {
  const p = f.properties;
  const name = p.name || p.name_en || '';
  if (RESERVOIRS.test(name) && !/tana/i.test(name)) continue;
  if ((p.scalerank ?? 9) > 6) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    if (poly[0].some(([lon]) => lon < -60 || lon > 100)) continue;
    const pp = poly.map(projRing).filter((r) => r.length >= 4);
    if (!pp.length) continue;
    const b = bboxOf([pp[0]]);
    if (b[2] < W[0] || b[0] > W[2] || b[3] < W[1] || b[1] > W[3]) continue;
    const area = Math.abs(ringArea(pp[0]));
    if (area < 120) continue;
    lakePolys.push({ b, pp, name });
    lakeOut.push({ name, area, poly: pp });
  }
}
log('land polys', landPolys.length, 'lakes', lakePolys.length);

// ── 고해상도 물/육지 래스터(스캔라인) ──
const FINE = 4; // km
const fw = Math.ceil((W[2] - W[0]) / FINE), fh = Math.ceil((W[3] - W[1]) / FINE);
function rasterize(polys, grid, value) {
  // 짝홀 규칙 스캔라인. 행 중심 y에서 교차점 수집
  const rows = new Array(fh);
  for (const { pp } of polys) for (const ring of pp) {
    for (let k = 1; k < ring.length; k++) {
      let [x0, y0] = ring[k - 1], [x1, y1] = ring[k];
      if (y0 === y1) continue;
      const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
      let r0 = Math.ceil((ya - W[1]) / FINE - 0.5), r1 = Math.floor((yb - W[1]) / FINE - 0.5);
      if (r1 < 0 || r0 >= fh) continue;
      r0 = Math.max(0, r0); r1 = Math.min(fh - 1, r1);
      for (let r = r0; r <= r1; r++) {
        const yc = W[1] + (r + 0.5) * FINE;
        if (yc < ya || yc >= yb) continue;
        const xc = x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0);
        (rows[r] ||= []).push(xc);
      }
    }
  }
  for (let r = 0; r < fh; r++) {
    const xs = rows[r]; if (!xs) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - W[0]) / FINE - 0.5)), c1 = Math.min(fw - 1, Math.floor((xs[k + 1] - W[0]) / FINE - 0.5));
      for (let c = c0; c <= c1; c++) grid[r * fw + c] ^= value;
    }
  }
}
log(`rasterizing ${fw}x${fh} …`);
const landR = new Uint8Array(fw * fh);
rasterize(landPolys, landR, 1);
const lakeR = new Uint8Array(fw * fh);
rasterize(lakePolys.filter((l) => !/caspian/i.test(l.name)), lakeR, 1);
// 카스피해가 육지 래스터에 포함되었으면 물로 되돌림
const caspLake = lakePolys.filter((l) => /caspian/i.test(l.name));
if (caspLake.length) { const cr = new Uint8Array(fw * fh); rasterize(caspLake, cr, 1); for (let k = 0; k < cr.length; k++) if (cr[k]) landR[k] = 0; }
const cellOf = (x, y) => { const c = Math.floor((x - W[0]) / FINE), r = Math.floor((y - W[1]) / FINE); return c < 0 || r < 0 || c >= fw || r >= fh ? -1 : r * fw + c; };
const isSea = (x, y) => { const k = cellOf(x, y); return k >= 0 && !landR[k] && !lakeR[k]; };

// ── 해역: 물 위 다익스트라 확산(육지를 넘어 새지 않음) ──
const SZ = SEAS.map(([key, name, lon, lat], i) => { const p = P(lon, lat); return { i, key, name, x: p[0], y: p[1] }; });
const ZC = 2; // 해역 래스터 = FINE*ZC km
const zw = Math.ceil(fw / ZC), zh = Math.ceil(fh / ZC);
const ZK = FINE * ZC;
const zWater = new Uint8Array(zw * zh);
for (let r = 0; r < zh; r++) for (let c = 0; c < zw; c++) {
  let wc = 0, n = 0;
  for (let dr = 0; dr < ZC; dr++) for (let dc = 0; dc < ZC; dc++) { const rr = r * ZC + dr, cc = c * ZC + dc; if (rr >= fh || cc >= fw) continue; n++; const k = rr * fw + cc; if (!landR[k] && !lakeR[k]) wc++; }
  zWater[r * zw + c] = wc * 2 >= n && n > 0 ? 1 : 0;
}
const zone = new Int16Array(zw * zh).fill(-1);
const dist = new Float64Array(zw * zh).fill(Infinity);
// 최소 힙
const heap = []; const hpush = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
const hpop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
for (const s of SZ) {
  // 시드에서 가장 가까운 물 셀
  let c0 = Math.floor((s.x - W[0]) / ZK), r0 = Math.floor((s.y - W[1]) / ZK), best = -1;
  for (let rad = 0; rad < 40 && best < 0; rad++) for (let dr = -rad; dr <= rad && best < 0; dr++) for (let dc = -rad; dc <= rad; dc++) { const r = r0 + dr, c = c0 + dc; if (r < 0 || c < 0 || r >= zh || c >= zw) continue; if (zWater[r * zw + c]) { best = r * zw + c; break; } }
  if (best < 0) { warn.push(`sea seed on land: ${s.key}`); continue; }
  dist[best] = 0; zone[best] = s.i; hpush(0, best);
}
const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
while (heap.length) {
  const [d, k] = hpop(); if (d > dist[k]) continue;
  const r = Math.floor(k / zw), c = k - r * zw;
  for (const [dc, dr, w] of N8) {
    const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= zh || cc >= zw) continue;
    const kk = rr * zw + cc; if (!zWater[kk]) continue;
    // 실제 거리 가중(메르카토르 보정)
    const yk = W[1] + (rr + 0.5) * ZK; const nd = d + (w * ZK) / kAt(yk);
    if (nd < dist[kk]) { dist[kk] = nd; zone[kk] = zone[k]; hpush(nd, kk); }
  }
}
const unassigned = zone.reduce((n, z, k) => n + (zWater[k] && z < 0 ? 1 : 0), 0);
log('sea raster', zw, 'x', zh, 'unassigned water cells', unassigned, 'water cells', zWater.reduce((a, b) => a + b, 0));
if (process.env.DEBUG_RASTER) {
  const img = Buffer.alloc(zw * zh * 3);
  for (let k = 0; k < zw * zh; k++) { const z = zone[k]; if (!zWater[k]) { img[3 * k] = 90; img[3 * k + 1] = 80; img[3 * k + 2] = 60; } else if (z < 0) { img[3 * k] = 255; img[3 * k + 1] = 0; img[3 * k + 2] = 255; } else { img[3 * k] = (z * 67) % 200 + 40; img[3 * k + 1] = (z * 131) % 200 + 40; img[3 * k + 2] = (z * 29) % 200 + 40; } }
  fs.writeFileSync(process.env.DEBUG_RASTER, Buffer.concat([Buffer.from(`P6 ${zw} ${zh} 255\n`), img]));
}
const seaAt = (x, y) => {
  let c = Math.floor((x - W[0]) / ZK), r = Math.floor((y - W[1]) / ZK);
  if (r >= 0 && c >= 0 && r < zh && c < zw && zone[r * zw + c] >= 0) return zone[r * zw + c];
  // 해안 근처: 주변 셀 탐색
  for (let rad = 1; rad <= 3; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < zh && cc < zw && zone[rr * zw + cc] >= 0) return zone[rr * zw + cc]; }
  return -1;
};

log('computing adjacency & coasts …');
const arcLen = (pts) => { let l = 0; for (let k = 1; k < pts.length; k++) l += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return l; };
const adj = new Map(); // "a|b" -> length
const coastSea = ST.map(() => new Map()); // st -> sea -> length
const arcType = new Map(); // newIdx -> 'b' (border between owners), 'i' (internal state border), 'c' coast, 'e' edge
for (const [a, users] of arcUse) {
  const pts = ARCS[a];
  const L = arcLen(pts);
  if (users.length >= 2) {
    const [s1, s2] = users;
    if (s1 !== s2) { const k = s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`; adj.set(k, (adj.get(k) || 0) + L / kAt(pts[Math.floor(pts.length / 2)][1])); }
    continue;
  }
  // 외곽 arc: 해안인가?
  const st = users[0];
  // 점 샘플링(약 8km 간격)
  let acc = 0, coastHits = 0, samples = 0;
  const kk = kAt(pts[0][1]);
  const step = 8 * kk;
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
    const segL = Math.hypot(x1 - x0, y1 - y0);
    let t = acc > 0 ? step - acc : 0;
    while (t <= segL) {
      const x = x0 + ((x1 - x0) * t) / segL, y = y0 + ((y1 - y0) * t) / segL;
      samples++;
      // 법선 방향 양쪽 3km 탐침
      const nx = -(y1 - y0) / segL, ny = (x1 - x0) / segL;
      for (const sgn of [1, -1]) {
        const px = x + nx * 4 * kk * sgn, py = y + ny * 4 * kk * sgn;
        if (isSea(px, py)) { coastHits++; const sz = seaAt(px, py); if (sz >= 0) coastSea[st].set(sz, (coastSea[st].get(sz) || 0) + step); break; }
      }
      t += step;
    }
    acc = (acc + segL) % step;
  }
  if (samples === 0) { const [x, y] = pts[0]; const d = 3 * kk; if (isSea(x + d, y) || isSea(x - d, y) || isSea(x, y + d) || isSea(x, y - d)) { coastHits = 1; samples = 1; const sz = seaAt(x, y); if (sz >= 0) coastSea[st].set(sz, (coastSea[st].get(sz) || 0) + 2); } }
  arcType.set(a, coastHits > samples * 0.3 ? 'c' : offArcUse.has(a) ? 'f' : 'e');
}
for (const [a, users] of arcUse) {
  if (users.length >= 2) {
    const [s1, s2] = users;
    arcType.set(a, s1 === s2 ? 'i' : ST[s1].owner === ST[s2].owner ? 'i' : 'b');
  }
}

// 하천
log('rivers …');
const RIV = load('ne_10m_rivers_lake_centerlines.geojson');
const rivers = [];
const segIndex = new Map(); // grid -> segments for proximity
const G = 40;
const gkey = (x, y) => `${Math.floor(x / G)},${Math.floor(y / G)}`;
function dpSimplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [i, j] = st.pop(); let md = -1, mk = -1;
    const [ax, ay] = pts[i], [bx, by] = pts[j]; const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    for (let k = i + 1; k < j; k++) { const t = Math.max(0, Math.min(1, ((pts[k][0] - ax) * dx + (pts[k][1] - ay) * dy) / L2)); const d = Math.hypot(pts[k][0] - (ax + t * dx), pts[k][1] - (ay + t * dy)); if (d > md) { md = d; mk = k; } }
    if (md > tol) { keep[mk] = 1; st.push([i, mk], [mk, j]); }
  }
  return pts.filter((p, k) => keep[k]);
}
for (const f of RIV.features) {
  const p = f.properties;
  const rank = p.scalerank ?? 9;
  if (rank > 6) continue;
  if (!f.geometry) continue;
  const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const line of lines) {
    if (line.some(([lon]) => lon < -60 || lon > 100)) continue;
    const pts = line.map(([lon, lat]) => P(lon, lat));
    if (!pts.some(([x, y]) => inBox(x, y, W))) continue;
    const sp = dpSimplify(pts, 1.2).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    if (sp.length < 2) continue;
    rivers.push({ name: p.name || '', rank, pts: sp });
    for (let k = 1; k < pts.length; k++) {
      const key = gkey(pts[k][0], pts[k][1]);
      if (!segIndex.has(key)) segIndex.set(key, []);
      segIndex.get(key).push([pts[k - 1], pts[k], rank]);
    }
  }
}
function nearRiver(x, y, maxD) {
  const gx = Math.floor(x / G), gy = Math.floor(y / G); let best = Infinity, brank = 9;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const segs = segIndex.get(`${gx + dx},${gy + dy}`); if (!segs) continue;
    for (const [a, b, rank] of segs) { const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1e-9; const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L2)); const d = Math.hypot(x - (a[0] + t * vx), y - (a[1] + t * vy)); if (d < best) { best = d; brank = rank; } }
  }
  return best <= maxD ? brank : -1;
}
log('rivers kept', rivers.length);

// 인접 주 간 하천 경계 판정
const riverBorder = new Map(); // "a|b" -> 1 (소하천) / 2 (대하천)
for (const [a, users] of arcUse) {
  if (users.length < 2 || users[0] === users[1]) continue;
  const pts = ARCS[a]; const k = users[0] < users[1] ? `${users[0]}|${users[1]}` : `${users[1]}|${users[0]}`;
  let hit = 0, n = 0, minRank = 9;
  const kr = kAt(pts[0][1]);
  for (let q = 0; q < pts.length; q++) { n++; const r = nearRiver(pts[q][0], pts[q][1], 7 * kr); if (r >= 0) { hit++; minRank = Math.min(minRank, r); } }
  const prev = riverBorder.get(k) || { hit: 0, n: 0, rank: 9 };
  riverBorder.set(k, { hit: prev.hit + hit, n: prev.n + n, rank: Math.min(prev.rank, minRank) });
}

// ───────────── 5단계: 주 속성 계산 ─────────────
log('state metrics …');
const GEOREG = load('ne_10m_geography_regions_polys.geojson');
const mtnPolys = [], desertPolys = [];
for (const f of GEOREG.features) {
  const cls = f.properties.FEATURECLA;
  if (cls !== 'Range/mtn' && cls !== 'Desert') continue;
  if (/^(ALASKA|SAHEL)$/i.test(f.properties.NAME)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    if (poly[0].some(([lon]) => lon < -60 || lon > 100)) continue;
    const pp = poly.map(projRing).filter((r) => r.length >= 4); if (!pp.length) continue;
    const b = bboxOf([pp[0]]);
    if (b[2] < W[0] || b[0] > W[2] || b[3] < W[1] || b[1] > W[3]) continue;
    (cls === 'Desert' ? desertPolys : mtnPolys).push({ b, pp, name: f.properties.NAME });
  }
}
const inAny = (x, y, arr) => arr.some((L) => inBox(x, y, L.b) && pointInPoly(x, y, L.pp));

const PLACES = load('ne_10m_populated_places_simple.geojson');
const places = [];
for (const f of PLACES.features) { const p = f.properties; const [lon, lat] = f.geometry.coordinates; const q = P(lon, lat); places.push({ x: q[0], y: q[1], pop: p.pop_max || 0 }); }

const statesOut = [];
for (const s of ST) {
  const polys = stateGeom[s.i].map((poly) => poly.map(ringFromArcs));
  let areaProj = 0;
  for (const poly of polys) { areaProj += Math.abs(ringArea(poly[0])); for (let k = 1; k < poly.length; k++) areaProj -= Math.abs(ringArea(poly[k])); }
  const k = scaleAt(s.lon, s.lat);
  const area = areaProj / (k * k);
  // 라벨 위치: 가장 큰 폴리곤의 극접근불가점
  let big = polys[0] || [[[0, 0]]], bigA = 0;
  for (const poly of polys) { const a = Math.abs(ringArea(poly[0])); if (a > bigA) { bigA = a; big = poly; } }
  const lab = polylabel(big, 1.5);
  // 지형 샘플링
  const bb = bboxOf(polys.map((p) => p[0]));
  const span = Math.max(bb[2] - bb[0], bb[3] - bb[1]);
  const stepS = Math.max(4, span / 16);
  let n = 0, nm = 0, nd = 0;
  for (let x = bb[0] + stepS / 2; x < bb[2]; x += stepS) for (let y = bb[1] + stepS / 2; y < bb[3]; y += stepS) {
    if (!polys.some((poly) => pointInPoly(x, y, poly))) continue;
    n++; if (inAny(x, y, mtnPolys)) nm++; if (inAny(x, y, desertPolys)) nd++;
  }
  const fm = n ? nm / n : 0, fd = n ? nd / n : 0;
  let terrain = 'plains';
  if (fd > 0.45) terrain = 'desert'; else if (fm > 0.55) terrain = 'mountain'; else if (fm > 0.25) terrain = 'hills';
  if (s.o.t) terrain = s.o.t;
  // 도시 인구
  let upop = 0;
  for (const pl of places) { if (!inBox(pl.x, pl.y, bb)) continue; if (polys.some((poly) => pointInPoly(pl.x, pl.y, poly))) upop += pl.pop; }
  const city = P(s.lon, s.lat);
  const seas = [...coastSea[s.i].entries()].filter(([, L]) => L >= 6).sort((a, b) => b[1] - a[1]).map(([sz]) => sz);
  statesOut.push({
    k: s.key,
    a: stateGeom[s.i].map((poly) => poly.map((ring) => ring.map(mapArc))),
    area: Math.round(area),
    lx: Math.round(lab[0] * 10) / 10, ly: Math.round(lab[1] * 10) / 10, lr: Math.round(lab[2] / kAt(lab[1])),
    lon: s.lon, lat: s.lat,
    cx: Math.round(city[0] * 10) / 10, cy: Math.round(city[1] * 10) / 10,
    terrain, fm: Math.round(fm * 100) / 100, fd: Math.round(fd * 100) / 100,
    upop: Math.round(upop / 1000),
    seas,
  });
}

// 인접 목록
const neighbors = ST.map(() => []);
for (const [k, L] of adj) {
  const [a, b] = k.split('|').map(Number);
  if (L < 3 && statesOut[a].area > 800 && statesOut[b].area > 800) continue;
  const rb = riverBorder.get(k);
  const river = rb && rb.n > 0 && rb.hit / rb.n > 0.35 ? (rb.rank <= 3 ? 2 : 1) : 0;
  neighbors[a].push([b, Math.round(L), river]);
  neighbors[b].push([a, Math.round(L), river]);
}
for (const [ka, kb] of LAND_STRAITS) {
  const a = keyIdx[ka], b = keyIdx[kb];
  if (a === undefined || b === undefined) { warn.push(`bad land strait ${ka}-${kb}`); continue; }
  if (!neighbors[a].some((n) => n[0] === b)) { neighbors[a].push([b, 0, 3]); neighbors[b].push([a, 0, 3]); }
}
statesOut.forEach((s, i) => { s.n = neighbors[i]; });

// ───────────── 6단계: 해역 ─────────────
log('sea zones …');
const seasOut = SZ.map((s) => ({ k: s.key, name: s.name, x: Math.round(s.x), y: Math.round(s.y), n: [], coast: [] }));
// 인접: 4-이웃 물 셀의 해역이 다르면 연결
{
  const pairCount = new Map();
  for (let r = 0; r < zh; r++) for (let c = 0; c < zw; c++) {
    const k = r * zw + c, a = zone[k]; if (a < 0) continue;
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const rr = r + dr, cc = c + dc; if (rr >= zh || cc >= zw) continue;
      const b = zone[rr * zw + cc]; if (b < 0 || b === a) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`; pairCount.set(key, (pairCount.get(key) || 0) + 1);
    }
  }
  for (const [key, n] of pairCount) { if (n < 2) continue; const [a, b] = key.split('|').map(Number); seasOut[a].n.push(b); seasOut[b].n.push(a); }
}
for (const [ka, kb, via] of STRAITS) {
  const a = SZ.findIndex((s) => s.key === ka), b = SZ.findIndex((s) => s.key === kb);
  if (a < 0 || b < 0) { warn.push(`bad strait ${ka}-${kb}`); continue; }
  if (!seasOut[a].n.includes(b)) { seasOut[a].n.push(b); seasOut[b].n.push(a); }
  (seasOut[a].via ||= {})[b] = keyIdx[via];
  (seasOut[b].via ||= {})[a] = keyIdx[via];
}
statesOut.forEach((s, i) => { for (const sz of s.seas) seasOut[sz].coast.push(i); });
// 해역 라벨 위치: 각 해역에서 육지/다른 해역과 가장 먼 셀(간이 거리 변환)
{
  const dd = new Float32Array(zw * zh).fill(0);
  const q = [];
  for (let k = 0; k < zone.length; k++) { if (zone[k] < 0) continue; const r = Math.floor(k / zw), c = k - r * zw; let edge = false; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= zh || cc >= zw || zone[rr * zw + cc] !== zone[k]) edge = true; } if (edge) { dd[k] = 1; q.push(k); } }
  for (let h = 0; h < q.length; h++) { const k = q[h]; const r = Math.floor(k / zw), c = k - r * zw; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= zh || cc >= zw) continue; const kk = rr * zw + cc; if (zone[kk] !== zone[k] || dd[kk]) continue; dd[kk] = dd[k] + 1; q.push(kk); } }
  const best = SZ.map(() => [-1, 0]);
  for (let k = 0; k < zone.length; k++) { const z = zone[k]; if (z < 0) continue; if (dd[k] > best[z][1]) best[z] = [k, dd[k]]; }
  best.forEach(([k], z) => { if (k < 0) return; const r = Math.floor(k / zw), c = k - r * zw; seasOut[z].lx = Math.round(W[0] + (c + 0.5) * ZK); seasOut[z].ly = Math.round(W[1] + (r + 0.5) * ZK); });
}
// 해역 경계선: 서로 다른 해역의 물 셀 사이 변 → 폴리라인
const seaLines = [];
{
  const segs = [];
  for (let r = 0; r < zh; r++) for (let c = 0; c < zw; c++) {
    const a = zone[r * zw + c]; if (a < 0) continue;
    if (c + 1 < zw) { const b = zone[r * zw + c + 1]; if (b >= 0 && b !== a) segs.push([[c + 1, r], [c + 1, r + 1]]); }
    if (r + 1 < zh) { const b = zone[(r + 1) * zw + c]; if (b >= 0 && b !== a) segs.push([[c, r + 1], [c + 1, r + 1]]); }
  }
  // 체인 연결
  const keyP = (p) => p[0] * 100000 + p[1];
  const adjm = new Map();
  segs.forEach((sg, i) => { for (const p of sg) { const k = keyP(p); if (!adjm.has(k)) adjm.set(k, []); adjm.get(k).push(i); } });
  const used = new Uint8Array(segs.length);
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue; used[i] = 1;
    const line = [segs[i][0], segs[i][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const end = dir ? line[line.length - 1] : line[0];
        const cand = (adjm.get(keyP(end)) || []).filter((j) => !used[j]);
        if (cand.length !== 1 && cand.length === 0) break;
        const j = cand[0]; used[j] = 1;
        const nxt = keyP(segs[j][0]) === keyP(end) ? segs[j][1] : segs[j][0];
        if (dir) line.push(nxt); else line.unshift(nxt);
      }
    }
    if (line.length < 3) continue;
    const pts = line.map(([c, r]) => [W[0] + c * ZK, W[1] + r * ZK]);
    // 차이킨 평활 2회 + 단순화
    let sm = pts;
    for (let it = 0; it < 2; it++) { const o = [sm[0]]; for (let k = 0; k + 1 < sm.length; k++) { const [ax, ay] = sm[k], [bx, by] = sm[k + 1]; o.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); } o.push(sm[sm.length - 1]); sm = o; }
    sm = dpSimplify(sm, 3);
    seaLines.push(sm.map(([x, y]) => [Math.round(x), Math.round(y)]).flat());
  }
}
// 해역 래스터(런타임 클릭 판정용) RLE: [값+1, 길이, ...]
const zoneRLE = [];
{ let cur = zone[0], len = 0; for (let k = 0; k < zone.length; k++) { if (zone[k] === cur) len++; else { zoneRLE.push(cur + 1, len); cur = zone[k]; len = 1; } } zoneRLE.push(cur + 1, len); }

// ───────────── 출력 ─────────────
// arc 인코딩: 0.1km 정수, 델타
const arcsOut = arcList.map((a) => {
  const pts = ARCS[a]; const out = []; let px = 0, py = 0;
  for (const [x, y] of pts) { const qx = Math.round(x * 10), qy = Math.round(y * 10); out.push(qx - px, qy - py); px = qx; py = qy; }
  return out;
});
const arcTypes = arcList.map((a) => arcType.get(a) || (offBorderArcs.has(a) ? 'o' : 'x'));
const offOut = offMerged.arcs.map((poly) => poly.map((ring) => ring.map(mapArc)));
const offBorders = [...offBorderArcs].filter((a) => remap.has(a)).map((a) => remap.get(a));

const encPoly = (poly) => poly.map((ring) => { const out = []; let px = 0, py = 0; for (const [x, y] of ring) { const qx = Math.round(x * 10), qy = Math.round(y * 10); out.push(qx - px, qy - py); px = qx; py = qy; } return out; });
const lakesSimplified = lakeOut.map((l) => ({ name: l.name, p: encPoly(l.poly.map((r) => dpSimplify(r, 1)).filter((r) => r.length >= 4)) }));
const reliefOut = mtnPolys.map((m) => ({ name: m.name, p: encPoly(m.pp.map((r) => dpSimplify(r, 3)).filter((r) => r.length >= 4)) }));
const desertOut = desertPolys.map((m) => ({ name: m.name, p: encPoly(m.pp.map((r) => dpSimplify(r, 3)).filter((r) => r.length >= 4)) }));

const out = {
  v: 1,
  proj: PROJ,
  bounds: W,
  arcs: arcsOut,
  arcTypes: arcTypes.join(''),
  states: statesOut,
  seas: seasOut,
  seaLines,
  seaGrid: { x0: W[0], y0: W[1], cell: ZK, w: zw, h: zh, rle: zoneRLE },
  off: offOut,
  offBorders,
  lakes: lakesSimplified,
  rivers: rivers.map((r) => ({ name: r.name, r: r.rank, p: r.pts.flat() })),
  relief: reliefOut,
  deserts: desertOut,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
log('wrote', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
log('total arc points', arcsOut.reduce((s, a) => s + a.length / 2, 0));
if (warn.length) { log('WARNINGS:'); for (const w of warn) log('  ', w); }
// 진단: 인접 없는 주, 해안 없는 섬
statesOut.forEach((s, i) => { if (!s.n.length && !s.seas.length) log('  isolated:', s.k); else if (!s.n.length) log('  island:', s.k, s.seas.map((z) => SZ[z].key).join(',')); });

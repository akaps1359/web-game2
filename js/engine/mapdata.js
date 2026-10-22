// map.json 해석: 인접 그래프, 거리, 해역, 좌표 변환 (브라우저·Node 공용, DOM 없음)
import { STATES, SEAS, VIRTUAL_STATES } from '../data/states.js';

const R = 6371;
const toRad = Math.PI / 180;
export function haversine(lon1, lat1, lon2, lat2) {
  const dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export class MapData {
  constructor(json) {
    this.json = json;
    this.proj = json.proj;
    this.bounds = json.bounds;
    const nGeo = json.states.length;
    if (STATES.length !== nGeo) throw new Error(`states.js(${STATES.length})와 map.json(${nGeo}) 불일치`);
    this.nGeo = nGeo;
    const DEF = [...STATES, ...VIRTUAL_STATES];
    const n = DEF.length;
    this.n = n;
    this.def = DEF; // [key, name, owner, lon, lat, props]
    this.key = DEF.map((s) => s[0]);
    this.idx = Object.fromEntries(this.key.map((k, i) => [k, i]));
    this.name = DEF.map((s) => s[1]);
    this.props = DEF.map((s) => s[5] || {});
    this.virtual = DEF.map((s, i) => i >= nGeo);
    this.lon = DEF.map((s) => s[3]); this.lat = DEF.map((s) => s[4]);
    const js = (i, f, dflt) => (i < nGeo ? f(json.states[i]) : dflt(i));
    const pv = (i) => this.project(this.lon[i], this.lat[i]);
    this.area = DEF.map((_, i) => js(i, (s) => s.area, () => 0));
    this.terrain = DEF.map((_, i) => this.props[i].t || js(i, (s) => s.terrain, () => 'plains'));
    this.upop = DEF.map((_, i) => js(i, (s) => s.upop, () => 0));
    this.lx = DEF.map((_, i) => js(i, (s) => s.lx, (k) => pv(k)[0])); this.ly = DEF.map((_, i) => js(i, (s) => s.ly, (k) => pv(k)[1]));
    this.cx = DEF.map((_, i) => js(i, (s) => s.cx, (k) => pv(k)[0])); this.cy = DEF.map((_, i) => js(i, (s) => s.cy, (k) => pv(k)[1]));
    this.lr = DEF.map((_, i) => js(i, (s) => s.lr, () => 30));
    // 인접: [이웃, 경계 길이 km, 하천(0 없음/1 소하천/2 대하천/3 해협)]
    this.adj = DEF.map((_, i) => js(i, (s) => s.n.map(([b, L, r]) => ({ to: b, len: L, river: r })), () => []));
    this.nb = this.adj.map((a) => a.map((e) => e.to));
    this.adjSet = this.nb.map((a) => new Set(a));
    // 해안 해역
    const seaKeyIdx = Object.fromEntries(json.seas.map((z, i) => [z.k, i]));
    this.coast = DEF.map((_, i) => js(i, (s) => s.seas || [], (k) => [seaKeyIdx[this.props[k].sea]]));
    this.coastal = this.coast.map((c) => c.length > 0);
    // 거리 (도시 좌표 대권거리)
    this.distCache = new Map();
    // 해역
    this.seas = json.seas.map((z, i) => ({ i, key: z.k, name: z.name, x: z.x, y: z.y, lx: z.lx ?? z.x, ly: z.ly ?? z.y, nb: z.n, coast: [...z.coast], via: z.via || {} }));
    for (let i = nGeo; i < n; i++) for (const z of this.coast[i]) this.seas[z].coast.push(i);
    this.seaIdx = Object.fromEntries(this.seas.map((z) => [z.key, z.i]));
    const sl = SEAS.map((s) => [s[2], s[3]]);
    this.seaLon = sl.map((p) => p[0]); this.seaLat = sl.map((p) => p[1]);
    // 해역 래스터 디코드
    const g = json.seaGrid;
    if (g) {
      const grid = new Int16Array(g.w * g.h);
      let k = 0;
      for (let i = 0; i < g.rle.length; i += 2) { const v = g.rle[i] - 1, len = g.rle[i + 1]; grid.fill(v, k, k + len); k += len; }
      this.seaGrid = { ...g, grid };
    }
  }
  dist(a, b) {
    const key = a < b ? a * 4096 + b : b * 4096 + a;
    let d = this.distCache.get(key);
    if (d === undefined) { d = haversine(this.lon[a], this.lat[a], this.lon[b], this.lat[b]); this.distCache.set(key, d); }
    return d;
  }
  seaDist(a, b) { return haversine(this.seaLon[a], this.seaLat[a], this.seaLon[b], this.seaLat[b]); }
  stateSeaDist(st, z) { return haversine(this.lon[st], this.lat[st], this.seaLon[z], this.seaLat[z]); }
  edge(a, b) { return this.adj[a].find((e) => e.to === b); }
  // 투영 좌표 ↔ 경위도 (메르카토르)
  project(lon, lat) { const p = this.proj; return [((lon - p.lon0) * toRad) * p.R, -p.R * Math.log(Math.tan(Math.PI / 4 + (lat * toRad) / 2))]; }
  unproject(x, y) { const p = this.proj; return [x / p.R / toRad + p.lon0, (2 * Math.atan(Math.exp(-y / p.R)) - Math.PI / 2) / toRad]; }
  seaAt(x, y) {
    const g = this.seaGrid; if (!g) return -1;
    const c = Math.floor((x - g.x0) / g.cell), r = Math.floor((y - g.y0) / g.cell);
    if (c < 0 || r < 0 || c >= g.w || r >= g.h) return -1;
    return g.grid[r * g.w + c];
  }
}

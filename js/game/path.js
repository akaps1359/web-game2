// 길찾기: A*(8방향, 모서리 끼기 금지)와 플레이어 기준 거리 지도(괴물 추격용)
import { DIRS } from '../core/util.js';

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

let gScore = null, came = null, closed = null, stamp = 0, cap = 0;
function ensure(n) {
  if (n > cap) { cap = n; gScore = new Float32Array(n); came = new Int32Array(n); closed = new Uint32Array(n); stamp = 0; }
}

// opts: self(액터 id), avoidActors(다른 액터가 선 칸 피하기), adjacent(목표 옆에 닿으면 끝), max(탐색 한도)
export function findPath(L, sx, sy, tx, ty, opts = {}) {
  const W = L.w, N = W * L.h;
  ensure(N);
  stamp++;
  if (stamp > 4e9) { closed.fill(0); stamp = 1; }
  const self = opts.self || 0, avoid = opts.avoidActors, adj = opts.adjacent, max = opts.max || 4000;
  const start = sy * W + sx, goal = ty * W + tx;
  const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const open = new Heap();
  gScore[start] = 0; came[start] = -1; closed[start] = stamp * 2; // stamp*2: 열림, stamp*2+1: 닫힘
  open.push(h(sx, sy), start);
  let best = start, bestH = h(sx, sy), n = 0;
  const done = (k) => { const x = k % W, y = (k / W) | 0; return adj ? Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1 && !(x === tx && y === ty) : k === goal; };
  while (open.size && n++ < max) {
    const cur = open.pop();
    if (closed[cur] === stamp * 2 + 1) continue;
    closed[cur] = stamp * 2 + 1;
    const cx = cur % W, cy = (cur / W) | 0;
    if (done(cur)) { best = cur; bestH = 0; break; }
    const hh = h(cx, cy);
    if (hh < bestH) { bestH = hh; best = cur; }
    for (let d = 0; d < 8; d++) {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (!L.inb(nx, ny)) continue;
      const nk = ny * W + nx;
      if (closed[nk] === stamp * 2 + 1) continue;
      const isGoal = nk === goal;
      const door = opts.doors && isClosedDoor(L, nx, ny);
      if (!L.passable(nx, ny) && !(isGoal && opts.goalSolid) && !door) continue;
      if (d & 1) { if (!L.passable(nx, cy) || !L.passable(cx, ny)) continue; }
      if (avoid && !isGoal) { const o = L.occ[nk]; if (o && o !== self) continue; }
      const ng = gScore[cur] + (d & 1 ? 1.4142 : 1) + (door ? 2 : 0);
      if (closed[nk] === stamp * 2 && ng >= gScore[nk]) continue;
      gScore[nk] = ng; came[nk] = cur; closed[nk] = stamp * 2;
      open.push(ng + h(nx, ny), nk);
    }
  }
  if (best === start && !(opts.partial ?? true)) return null;
  if (bestH > 0 && opts.partial === false) return null;
  const path = [];
  for (let k = best; k !== start && k >= 0; k = came[k]) path.push([k % W, (k / W) | 0]);
  path.reverse();
  return path;
}

function isClosedDoor(L, x, y) { const o = L.obj(x, y); return !!(o && o.type === 'door' && !o.open && !o.locked); }

// 거리 지도: 목표(플레이어)에서 반경 안의 모든 칸까지 걸음 수(다익스트라 근사, 8방향)
export class DistMap {
  constructor() { this.d = null; this.W = 0; this.cx = -1; this.cy = -1; this.L = null; }
  build(L, tx, ty, radius = 26) {
    const W = L.w, N = W * L.h;
    if (!this.d || this.d.length !== N) { this.d = new Float32Array(N); }
    this.d.fill(1e9);
    this.W = W; this.L = L; this.cx = tx; this.cy = ty;
    const q = new Heap();
    const k0 = ty * W + tx;
    this.d[k0] = 0; q.push(0, k0);
    const d = this.d, r2 = radius;
    while (q.size) {
      const cur = q.pop(), dc = d[cur];
      if (dc > r2) break;
      const cx = cur % W, cy = (cur / W) | 0;
      for (let i = 0; i < 8; i++) {
        const nx = cx + DIRS[i][0], ny = cy + DIRS[i][1];
        const door = !L.passable(nx, ny) && isClosedDoor(L, nx, ny);
        if (!L.passable(nx, ny) && !door) continue;
        if (i & 1) { if (door || !L.passable(nx, cy) || !L.passable(cx, ny)) continue; }
        const nk = ny * W + nx, nd = dc + (i & 1 ? 1.4142 : 1) + (door ? 3 : 0);
        if (nd < d[nk]) { d[nk] = nd; q.push(nd, nk); }
      }
    }
  }
  at(x, y) { return this.d && this.L && this.L.inb(x, y) ? this.d[y * this.W + x] : 1e9; }
}

// 시야: 재귀 그림자 투사(8분면). 보이는 칸에 F_VIS, 한 번이라도 본 칸에 F_SEEN
import { F_SEEN, F_VIS } from './level.js';

const MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1], [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0], [1, 0, 0, 1, -1, 0, 0, -1],
];

export function computeFOV(L, ox, oy, radius) {
  const f = L.flags, W = L.w;
  // 지난번에 보였던 칸 지우기(목록만 돌린다)
  if (L._vis) for (const k of L._vis) f[k] &= ~F_VIS;
  const vis = [];
  const mark = (x, y) => {
    if (!L.inb(x, y)) return;
    const k = y * W + x;
    if (!(f[k] & F_VIS)) { f[k] |= F_VIS | F_SEEN; vis.push(k); }
  };
  mark(ox, oy);
  for (let oct = 0; oct < 8; oct++) cast(L, ox, oy, 1, 1, 0, radius, MULT[0][oct], MULT[1][oct], MULT[2][oct], MULT[3][oct], mark);
  L._vis = vis;
}

function cast(L, cx, cy, row, start, end, radius, xx, xy, yx, yy, mark) {
  if (start < end) return;
  const r2 = radius * radius;
  let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1, dy = -j, blocked = false;
    while (dx <= 0) {
      dx++;
      const X = cx + dx * xx + dy * xy, Y = cy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5), rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      if (dx * dx + dy * dy < r2) mark(X, Y);
      const op = L.opaque(X, Y);
      if (blocked) {
        if (op) { newStart = rSlope; continue; }
        blocked = false; start = newStart;
      } else if (op && j < radius) {
        blocked = true;
        cast(L, cx, cy, j + 1, start, lSlope, radius, xx, xy, yx, yy, mark);
        newStart = rSlope;
      }
    }
    if (blocked) break;
  }
}

// 지도 전체를 밝힌다(마을)
export function revealAll(L) {
  for (let i = 0; i < L.flags.length; i++) if (L.floor[i] || L.wall[i]) L.flags[i] |= F_SEEN | F_VIS;
}

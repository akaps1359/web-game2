// 마을 애쉬폴: 우물 광장을 가운데 두고 대성당(지하 입구)·대장간·치유사의 집·여관·현자의 탑·마녀의 오두막·핍의 좌판을
// 한 화면 안에 모은다. 건물마다 쓰임새가 보이게(화덕·모루·무기 걸이, 약초밭, 술집 탁자와 술통, 해골 장대와 가마솥)
import { Level, F_SOLID, F_OPAQUE } from '../level.js';

// 건물·큰 소품이 차지하는 칸(앵커 칸 기준 사각형들). 그림(render/townart.js)과 같은 모양
export const TOWN_FP = {
  cathedral: [[-4, -8, 0, -2], [-3, -1, -1, 0]],
  smithy: [[-3, -2, -1, 0], [0, -2, 0, -1]],
  healer: [[-3, -2, 0, 0]],
  inn: [[-4, -3, 0, 0]],
  sage: [[-2, -2, 0, 0]],
  witch: [[-2, -2, 0, 0]],
  stall: [[-1, 0, 0, 0]],
  cart: [[-1, 0, 0, 0]],
};

// 바닥: 1 풀, 2 흙길, 3 자갈(광장), 4 짙은 풀(숲), 5 물, 6 다리, 7 판석(대성당 앞), 8 밭흙
export function generateTown(rng) {
  const W = 48, H = 48, CX = 24, CY = 24;
  const L = new Level(W, H, 'town', 0);
  L.name = '애쉬폴 마을';
  const idx = (x, y) => y * W + x;
  const set = (x, y, f) => { if (L.inb(x, y)) L.floor[idx(x, y)] = f; };
  const block = (x, y, opaque) => { if (L.inb(x, y)) L.flags[idx(x, y)] |= F_SOLID | (opaque ? F_OPAQUE : 0); };
  const keep = new Uint8Array(W * H); // 나무를 심지 않을 칸(길·건물 앞·광장)
  const A = (dx, dy) => [CX + dx, CY + dy];
  for (let i = 0; i < W * H; i++) L.floor[i] = 1;

  // ── 길과 광장 ──
  const path = (pts, f = 2) => {
    for (let i = 0; i < pts.length - 1; i++) {
      let [x, y] = A(...pts[i]); const [bx, by] = A(...pts[i + 1]);
      for (let n = 0; n < 200; n++) {
        if (L.floor[idx(x, y)] !== 3 && L.floor[idx(x, y)] !== 7) set(x, y, f);
        keep[idx(x, y)] = 1;
        if (x === bx && y === by) break;
        // 대각선은 계단처럼(칸이 끊기지 않게)
        if (x !== bx && (y === by || Math.abs(bx - x) >= Math.abs(by - y))) x += Math.sign(bx - x); else y += Math.sign(by - y);
      }
    }
  };
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const [x, y] = A(dx, dy);
    if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4 && Math.abs(dx) + Math.abs(dy) <= 6) set(x, y, 3);
    keep[idx(x, y)] = 1;
  }
  // 대성당 앞마당(판석)
  for (let dy = -2; dy <= -1; dy++) for (let dx = -8; dx <= -4; dx++) { const [x, y] = A(dx, dy); set(x, y, 7); keep[idx(x, y)] = 1; }
  // 가게로 가는 흙길
  path([[-4, 2], [-5, 2], [-5, 4]]); // 대장간 화덕 앞
  path([[-7, 1], [-9, 1]]); // 현자의 탑
  path([[-2, 5], [-1, 6], [-1, 8]]); // 치유사(문은 +x 쪽)
  path([[3, -3], [6, -3], [6, -2]]); // 여관 앞
  path([[1, -5], [1, -7], [0, -9]]); // 마녀의 오두막
  path([[2, 4], [4, 4]]); // 핍의 좌판
  path([[3, 5], [5, 9], [6, 14], [7, 22]]); // 마을 밖으로 나가는 길(숲에서 끊긴다)
  // 약초밭(치유사 집 뒤)
  for (let dy = 5; dy <= 7; dy++) for (let dx = -8; dx <= -7; dx++) { const [x, y] = A(dx, dy); set(x, y, 8); keep[idx(x, y)] = 1; }

  // ── 건물 ──
  const bld = (model, dx, dy, o = {}) => {
    const [x, y] = A(dx, dy), fp = TOWN_FP[model] || [[0, 0, 0, 0]];
    const ob = L.addObject({ type: 'bld', model, x, y, fp, noAt: true, solid: true, ...o });
    for (const [x0, y0, x1, y1] of fp) for (let yy = y + y0; yy <= y + y1; yy++) for (let xx = x + x0; xx <= x + x1; xx++) { block(xx, yy, true); keep[idx(xx, yy)] = 1; }
    return ob;
  };
  const prop = (model, dx, dy, v = 0, o = {}) => {
    const [x, y] = A(dx, dy);
    if (L.flags[idx(x, y)] & F_SOLID) return null;
    const ob = L.addObject({ type: 'prop', model, v, x, y, noAt: true, solid: true, ...o });
    block(x, y, false); keep[idx(x, y)] = 1;
    return ob;
  };
  const light = (dx, dy, r = 5, color = [255, 190, 110]) => { const [x, y] = A(dx, dy); L.lights.push({ tx: x, ty: y, x, y, r, color }); };

  // 대성당(위): 종탑 아래 아치 문이 지하 입구
  bld('cathedral', -4, -3);
  { const [x, y] = A(-6, -3); L.addObject({ type: 'stairs_down', x, y, face: 'y', solid: true, town: true, inDoor: true }); }
  // 묘지(대성당 왼쪽 뒤)
  for (const [dx, dy, v] of [[-11, -8, 0], [-10, -6, 1], [-12, -5, 2], [-9, -9, 1], [-11, -3, 0], [-13, -7, 1], [-9, -4, 2], [-12, -10, 0]]) prop('tomb', dx, dy, v);
  prop('tree', -13, -9, 4); prop('tree', -8, -13, 4);
  // 현자의 탑(왼쪽 위)
  bld('sage', -10, 0);
  prop('crate', -12, 1, 1); prop('barrel', -13, 0, 1);
  // 대장간(왼쪽): 화덕 앞에 모루·무기 걸이·물통
  bld('smithy', -6, 4);
  prop('anvil', -4, 3); prop('barrel', -5, 1); prop('rack', -8, 5); prop('logs', -10, 5); prop('crate', -10, 1);
  light(-5, 2, 5, [255, 140, 60]);
  // 치유사의 집(왼쪽 아래): 문은 광장 쪽(+x), 뒤에 약초밭
  bld('healer', -2, 9);
  for (let dy = 5; dy <= 7; dy++) for (let dx = -8; dx <= -7; dx++) prop('herbs', dx, dy, (((dx + dy) % 3) + 3) % 3);
  for (let dy = 5; dy <= 7; dy++) prop('fence', -9, dy, 1);
  // 여관(오른쪽): 박공 쪽 문이 광장을 본다. 문 앞 탁자·의자·술통, 보관함
  bld('inn', 8, -4);
  prop('table', 7, -1); prop('bench', 7, 0, 0); prop('bench', 8, -1, 1);
  prop('barrel', 9, -2); prop('barrel', 9, -1, 1); prop('crate', 9, 0);
  { const [x, y] = A(-3, -3); L.addObject({ type: 'stash', model: 'stash', x, y, solid: true }); block(x, y, false); }
  // 마녀의 오두막(오른쪽 위): 가마솥, 해골 장대
  bld('witch', 1, -10);
  { const o = prop('cauldron', 2, -8); if (o) light(2, -8, 3, [90, 220, 70]); }
  prop('tree', 3, -11, 4); prop('logs', -2, -9); prop('skullpole', 3, -9); prop('skullpole', -2, -7);
  // 핍의 좌판(아래): 손수레와 건초
  bld('stall', 5, 3);
  prop('crate', 6, 2, 1); prop('barrel', 3, 4); prop('cart', 8, 2); prop('hay', 8, 4);
  // 광장: 우물, 순간 이동 지점, 등불
  { const [x, y] = A(0, 0); L.addObject({ type: 'well', model: 'well', x, y, solid: true }); block(x, y, false); }
  { const [x, y] = A(1, -4); L.addObject({ type: 'waypoint', x, y, active: true }); L.wpAt = { x, y: y + 1 }; }
  for (const [dx, dy] of [[-4, -3], [4, -3], [-4, 3], [4, 3], [-7, 0], [-1, 7], [6, -6]]) { prop('lamp', dx, dy); light(dx, dy); }
  prop('signpost', 4, 7);

  // ── 숲: 마을 둘레는 나무로 막는다 ──
  const clear = [[0, -1, 13], [-6, -8, 8], [1, -10, 5], [-4, 7, 7], [7, 3, 6], [7, -4, 6], [-10, -2, 6], [-11, -7, 4]];
  const inTown = (x, y) => {
    const dx = x - CX, dy = y - CY;
    let best = 1e9;
    for (const [cx, cy, r] of clear) best = Math.min(best, Math.hypot(dx - cx, dy - cy) - r);
    return best + (rng.next() - 0.5) * 1.5;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = idx(x, y), edge = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
    const t = inTown(x, y);
    if (t > 0 && !keep[k]) L.floor[k] = 4;
    if (edge) block(x, y, true);
    if (keep[k] || L.flags[k] & F_SOLID && !edge) continue;
    // 숲 깊이에 따라 촘촘하게, 마을 안에는 드문드문
    const p = edge ? 0.55 : t > 3 ? 0.55 : t > 0 ? 0.3 : t > -2 ? 0.05 : 0;
    if (!rng.chance(p)) continue;
    const v = t > 1 ? (rng.chance(0.55) ? (rng.chance(0.4) ? 3 : 2) : rng.chance(0.5) ? 1 : 0) : rng.chance(0.3) ? 5 : rng.chance(0.5) ? 0 : 2;
    L.addObject({ type: 'prop', model: 'tree', v, x, y, noAt: true, solid: v !== 5 });
    if (v !== 5) block(x, y, false);
  }

  // 바닥 장식: 풀포기·들꽃·돌·버섯(부딪히지 않음). 칸 안 아무 자리에 흩어 격자 느낌을 없앤다
  L.decor = [];
  for (let i = 0; i < 420; i++) {
    const x = rng.int(3, W - 4), y = rng.int(3, H - 4), k = idx(x, y);
    if (L.floor[k] !== 1 && L.floor[k] !== 4) continue;
    if (L.flags[k] & F_SOLID) continue;
    const t = inTown(x, y), r = rng.next();
    const [model, v] = r < 0.5 ? ['tuft', rng.int(0, 2)] : r < 0.72 ? ['flowers', rng.int(0, 2)] : r < 0.9 ? ['rock', rng.chance(0.25) ? 1 : 0] : ['shrooms', 0];
    if (t > 2 && model === 'flowers') continue;
    L.decor.push({ x: x + rng.range(-0.35, 0.35), y: y + rng.range(-0.35, 0.35), model, v });
  }
  L.start = { x: CX - 1, y: CY - 2 };
  L.portalAt = { x: CX - 3, y: CY + 2 };
  L.downAt = { x: CX - 6, y: CY - 2 };
  // NPC 자리: 모두 광장에서 한눈에 보인다
  const S = (dx, dy) => { const [x, y] = A(dx, dy); return { x, y }; };
  L.npcSpots = {
    smith: S(-4, 4), healer: S(-1, 7), witch: S(1, -7), sage: S(-8, 1),
    inn: S(5, -3), maid: S(6, -1), boy: S(5, 4), drunk: S(8, 1), wounded: S(2, 1),
  };
  L.rooms = [];
  return L;
}

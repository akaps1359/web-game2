// 마을 모형: 쓰임새가 보이는 건물(대성당·대장간·치유사의 집·여관·현자의 탑·마녀의 오두막)과 소품·나무.
// 모형 좌표는 앵커 칸(o.x, o.y)의 중심이 원점. fp: 차지하는 칸(앵커 기준 사각형들) — 통행·가림·깊이 띠에 쓴다
import { Model, bakeJob } from './bake3d.js';
import * as M from './mats.js';

// 벽 위 장식 좌표: +y면(y = Y)의 x 위치, +x면(x = X)의 y 위치 → 화면 x(px)
const onY = (Y, x, w, z0, z1, k, o = {}) => ({ k, h0: (x - w / 2 - Y) * 32, h1: (x + w / 2 - Y) * 32, z0, z1, ...o });
const onX = (X, y, w, z0, z1, k, o = {}) => ({ k, h0: (X - y - w / 2) * 32, h1: (X - y + w / 2) * 32, z0, z1, ...o });

// 목조 골조 벽: 회벽 위에 기둥(posts: 화면 x), 들보(beams: 높이), 버팀대
function frame(base, o) {
  const c = o.c || '#4a3322', wz = M.wood({ c, dir: 'z' }), wh = M.wood({ c, dir: 'h' }), pw = o.pw ?? 4.4, bw = o.bw ?? 4.2;
  return (C, f) => {
    const h = M.hx(C), z = C.z;
    for (const p of o.posts) if (Math.abs(h - p) < pw / 2) return wz(C, f);
    for (const b of o.beams) if (Math.abs(z - b) < bw / 2) return wh(C, f);
    if (o.braces) for (const r of o.braces) {
      if (h < r.h0 || h > r.h1 || z < r.z0 || z > r.z1) continue;
      const t = (h - r.h0) / (r.h1 - r.h0), zz = r.up ? r.z0 + t * (r.z1 - r.z0) : r.z1 - t * (r.z1 - r.z0);
      if (Math.abs(z - zz) < bw * 0.62) return wz(C, f);
    }
    return base(C, f);
  };
}
// 간판 그림(작은 도트)
const SIGN = {
  anvil: { rows: ['..........', '.HHHH.....', '.HHHH..h..', '...hh.hhh.', '.aaaaaaaa.', 'aaaaaaaaa.', '..aaaaa...', '...aaa....', '..aaaaa...', '..........'], pal: { a: '#c8ccd2', h: '#d8b070', H: '#a87840' } },
  potion: { rows: ['..........', '....cc....', '....gg....', '....gg....', '...gggg...', '..grrrrg..', '..grrRrg..', '..grrrrg..', '...gggg...', '..........'], pal: { c: '#a07040', g: '#d8e0e8', r: '#c02828', R: '#ff8070' } },
  cup: { rows: ['..........', '.gggggggg.', '.gwwwwwwg.', '.gggggggg.', '..gggggg..', '...gggg...', '....gg....', '....gg....', '..gggggg..', '..........'], pal: { g: '#b8b4a8', w: '#e8dcc0' } },
  book: { rows: ['..........', '.bbbb.bbbb', '.bwwb.bwwb', '.bwwbbbwwb', '.bwwbbbwwb', '.bwwbbbwwb', '.bbbbbbbbb', '....bb....', '..........', '..........'], pal: { b: '#7a2a24', w: '#e8dcb8' } },
  eye: { rows: ['..........', '..........', '...pppp...', '..pwwwwp..', '.pwwkkwwp.', '.pwwkkwwp.', '..pwwwwp..', '...pppp...', '..........', '..........'], pal: { p: '#a050d0', w: '#d8d0b8', k: '#201020' } },
};
function sign(m, x, y, z, w, h, kind, face = 'y') {
  // 벽에 붙인 판 + 받침: face 'y'면 +y 방향 벽, 'x'면 +x 방향 벽
  const S = SIGN[kind], mat = M.icon(S.rows, S.pal, '#3e2a1a'), rim = M.wood({ c: '#2e1e12', dir: 'a' });
  if (face === 'y') {
    m.box(x - w / 2 - 0.04, y, z - 2, x + w / 2 + 0.04, y + 0.06, z + h + 2, { top: rim, x: rim, y: rim });
    m.face([x - w / 2, y + 0.065, z], [w, 0, 0], [0, 0, h], mat, { edge: 0.7 });
  } else {
    m.box(x, y - w / 2 - 0.04, z - 2, x + 0.06, y + w / 2 + 0.04, z + h + 2, { top: rim, x: rim, y: rim });
    m.face([x + 0.065, y + w / 2, z], [0, -w, 0], [0, 0, h], mat, { edge: 0.7 });
  }
}
// 굴뚝(돌) + 연기 자리
function chimney(m, x, y, z0, z1, mat) {
  m.box(x - 0.17, y - 0.17, z0, x + 0.17, y + 0.17, z1, { all: mat, top: M.flat('#1a1614', { n: 0.05 }) });
  m.box(x - 0.21, y - 0.21, z1 - 4, x + 0.21, y + 0.21, z1, { all: mat });
}
const ST = (c = '#77706a', c2 = '#5f5952', moss = '#4a5430', seed = 3) => M.ashlar({ c, c2, m: '#2a2520', bh: 9, bw: 15, seed, moss });

// ───────── 건물 ─────────
const MODELS = {};

// 대성당: 길쭉한 본당(+x 쪽 벽에 버팀벽과 스테인드글라스), 정면 종탑(뾰족 첨탑), 종탑 아래 아치 문 = 지하로 가는 입구
MODELS.cathedral = {
  fp: [[-4, -8, 0, -2], [-3, -1, -1, 0]],
  door: { x: -2, y: 0 },
  make() {
    const m = new Model(11);
    const stone = ST('#7c766e', '#666059', '#4e5634', 5), dark = ST('#6c665e', '#58524b', null, 6);
    const slate = M.shingles({ c: '#454852', c2: '#565a64', rh: 5.5, sw: 7, seed: 19, moss: '#4c5436', mt: 0.7 });
    const X1 = 0.42, X0 = -4.42, Y0 = -8.42, Y1 = -1.58, WH = 86;
    // 본당 벽과 창
    const side = [];
    for (const yc of [-7.4, -5.4, -3.4]) side.push(onX(X1, yc, 0.42, 30, 74, 'lancet', { seed: 70 + yc * 3 }));
    const front = [onY(Y1, -4.0, 0.3, 40, 70, 'lancet', { seed: 81 }), onY(Y1, 0.0, 0.3, 40, 70, 'lancet', { seed: 82 })];
    m.box(X0, Y0, 0, X1, Y1, WH, { top: null, x: M.decals(stone, side), y: M.decals(stone, front) });
    // 받침돌 띠
    m.box(X0 - 0.06, Y0, 0, X1 + 0.06, Y1 + 0.06, 8, { top: M.flat('#6a645c', { n: 0.06 }), x: dark, y: dark });
    // 버팀벽
    for (const yb of [-8.1, -6.4, -4.4, -2.4]) {
      m.box(X1, yb - 0.2, 0, X1 + 0.34, yb + 0.2, 64, { top: null, x: stone, y: stone });
      m.box(X1, yb - 0.2, 64, X1 + 0.18, yb + 0.2, 78, { top: null, x: stone, y: stone });
      m.pyramid(X1, yb - 0.2, X1 + 0.34, yb + 0.2, 64, 74, M.flat('#5a5650', { n: 0.08 }));
    }
    // 지붕(슬레이트, 가파름)
    m.gable(X0, Y0, X1, Y1, WH, 70, 'y', { roof: slate, end: stone, rake: M.flat('#3a3634', { n: 0.05 }) }, { ov: 0.22, og: 0.1, th: 5 });
    // 용마루 장식
    m.box(-2.06, Y0 - 0.1, WH + 68, -1.94, Y1 + 0.1, WH + 73, { all: M.flat('#3a3c44', { n: 0.05 }) });
    // 종탑
    const TX0 = -3.42, TX1 = -0.58, TY0 = -1.62, TY1 = 0.42, TH = 152;
    const tfront = [
      onY(TY1, -2.0, 1.05, 0, 50, 'door', { arch: 'point', open: true, red: true, frame: '#5a544c', fw: 3.4 }),
      onY(TY1, -2.0, 0.9, 64, 92, 'rose', {}),
      onY(TY1, -2.45, 0.32, 112, 140, 'door', { arch: 'point', open: true, frame: '#5a544c' }),
      onY(TY1, -1.55, 0.32, 112, 140, 'door', { arch: 'point', open: true, frame: '#5a544c' }),
    ];
    const tside = [onX(TX1, -0.6, 0.32, 112, 140, 'door', { arch: 'point', open: true, frame: '#5a544c' }), onX(TX1, -0.6, 0.26, 60, 90, 'lancet', { seed: 90 })];
    m.box(TX0, TY0, 0, TX1, TY1, TH, { top: M.flat('#4a4640', { n: 0.05 }), x: M.decals(stone, tside), y: M.decals(stone, tfront) });
    m.box(TX0 - 0.07, TY0, TH - 8, TX1 + 0.07, TY1 + 0.07, TH, { top: null, x: dark, y: dark });
    m.box(TX0 - 0.07, TY0, 0, TX1 + 0.07, TY1 + 0.07, 10, { top: null, x: dark, y: dark });
    // 모서리 작은 첨탑
    for (const [cx, cy] of [[TX1, TY1], [TX0 + 0.05, TY1], [TX1, TY0 + 0.05]]) {
      m.box(cx - 0.13, cy - 0.13, TH, cx + 0.13, cy + 0.13, TH + 14, { all: stone, top: null });
      m.pyramid(cx - 0.15, cy - 0.15, cx + 0.15, cy + 0.15, TH + 14, TH + 34, slate);
    }
    // 첨탑과 십자가
    m.pyramid(TX0 + 0.25, TY0 + 0.25, TX1 - 0.25, TY1 - 0.25, TH, TH + 118, slate, { edge: 0.75 });
    const cr = M.metal('#8a8478');
    m.box(-2.04, -0.64, TH + 116, -1.96, -0.56, TH + 142, { all: cr });
    m.box(-2.04, -0.76, TH + 130, -1.96, -0.44, TH + 135, { all: cr });
    // 입구 안쪽 붉은 기운
    m.glow(-2, 0.45, 20, 30, [255, 70, 40], 0.35, 1);
    m.shade([[X0 - 0.3, Y0 - 0.2], [X1 + 0.6, Y0 - 0.2], [X1 + 0.6, Y1 + 0.3], [TX1 + 0.3, Y1 + 0.3], [TX1 + 0.3, TY1 + 0.25], [TX0 - 0.25, TY1 + 0.25], [TX0 - 0.25, Y1 + 0.3], [X0 - 0.3, Y1 + 0.3]], 0.3);
    return m;
  },
};

// 대장간: 돌집 + 박공벽(+x) 밖의 화덕(숯불이 보인다)과 벽을 타고 오르는 굴뚝, 풀무
MODELS.smithy = {
  fp: [[-3, -2, -1, 0], [0, -2, 0, -1]],
  make() {
    const m = new Model(23);
    const stone = ST('#726a60', '#5c554c', '#48502e', 7), rub = M.rubble({ c: '#6a6258', c2: '#57504a', s: 7, seed: 8 });
    const roof = M.shingles({ c: '#5a3e2c', c2: '#6c4c34', rh: 6.5, sw: 8, seed: 29, moss: '#4e5a30' });
    const X0 = -3.42, X1 = -0.58, Y0 = -2.42, Y1 = 0.42, WH = 52;
    const wy = [onY(Y1, -1.4, 0.62, 0, 30, 'door', { col: '#5a3e26' }), onY(Y1, -2.7, 0.42, 22, 40, 'win', { lit: true, sh: '#4a3a2a' })];
    const wx = [onX(X1, -0.2, 0.42, 22, 38, 'win', { lit: true })];
    m.box(X0, Y0, 0, X1, Y1, WH, { top: null, x: M.decals(stone, wx), y: M.decals(stone, wy) });
    m.box(X0 - 0.05, Y0, 0, X1 + 0.05, Y1 + 0.05, 10, { top: null, x: rub, y: rub });
    m.gable(X0, Y0, X1, Y1, WH, 40, 'x', { roof, end: M.planks({ c: '#5a4230', w: 5, dir: 'v', seed: 3 }), rake: M.wood({ c: '#3a281a', dir: 'a' }) }, { ov: 0.24, og: 0.16 });
    // 화덕(돌 상자, 위에 숯불)과 굴뚝
    m.box(X1, -1.95, 0, 0.36, -0.85, 22, { top: null, x: rub, y: rub });
    m.face([X1, -1.95, 22], [0.36 - X1, 0, 0], [0, 1.1, 0], M.coals(), { edge: 0.85 });
    m.box(X1, -1.98, 22, 0.38, -1.84, 28, { all: rub });
    m.box(X1, -1.8, 22, -0.14, -1.02, WH + 46, { all: stone, top: null });
    m.box(X1, -1.7, WH + 46, -0.2, -1.12, WH + 64, { all: stone, top: M.flat('#1a1614', { n: 0.05 }) });
    // 풀무(가죽)와 받침
    m.box(-0.1, -0.7, 4, 0.36, -0.2, 14, { all: M.flat('#5a3a24', { n: 0.14 }), top: M.flat('#6a4a2c', { n: 0.12 }) });
    m.box(0.3, -0.5, 9, 0.48, -0.42, 11, { all: M.wood({ c: '#4a3420', dir: 'a' }) });
    // 벽에 건 연장
    const iron = M.metal('#55565a');
    for (let i = 0; i < 3; i++) m.box(X0 + 0.5 + i * 0.3, Y1, 22, X0 + 0.58 + i * 0.3, Y1 + 0.04, 42 - i * 4, { all: iron });
    sign(m, -0.7, Y1 + 0.02, 34, 0.5, 14, 'anvil', 'y');
    m.glow(0, -1.4, 24, 44, [255, 130, 50], 0.45, 1);
    m.glow(-2.7, Y1, 31, 16, [255, 180, 90], 0.26);
    m.glow(X1, -0.2, 30, 15, [255, 180, 90], 0.22);
    m.shade([[X0 - 0.3, Y0 - 0.3], [0.62, Y0 - 0.3], [0.62, Y1 + 0.32], [X0 - 0.3, Y1 + 0.32]], 0.3);
    return m;
  },
};

// 치유사의 집: 흰 회벽 목조 오두막, 이끼 낀 지붕, 창 아래 꽃상자, 처마에 말린 약초
MODELS.healer = {
  fp: [[-3, -2, 0, 0]],
  make() {
    const m = new Model(31);
    const pl = M.plaster({ c: '#cdbf9f', seed: 33 });
    const X0 = -3.42, X1 = 0.42, Y0 = -2.42, Y1 = 0.42, WH = 52;
    const postsY = [(X0 - Y1) * 32 + 2, (-2.5 - Y1) * 32, (-1.0 - Y1) * 32, (X1 - Y1) * 32 - 2];
    const postsX = [(X1 - Y1) * 32 + 2, (X1 + 0.38) * 32, (X1 + 1.62) * 32, (X1 - Y0) * 32 - 2];
    const beams = [2, 27, WH - 2];
    const fy = frame(pl, { posts: postsY, beams, braces: [{ h0: postsY[0], h1: postsY[1], z0: 27, z1: WH, up: true }] });
    const fx = frame(pl, { posts: postsX, beams, braces: [{ h0: postsX[2], h1: postsX[3], z0: 27, z1: WH, up: false }] });
    const wy = [onY(Y1, -1.75, 0.42, 8, 21, 'win', { lit: true }), onY(Y1, -3.0, 0.4, 32, 46, 'win', { lit: true, sh: '#4e6a3c' }), onY(Y1, -0.35, 0.4, 32, 46, 'win', { lit: true, sh: '#4e6a3c' }), onY(Y1, -0.35, 0.42, 8, 21, 'win', { lit: true })];
    const wx = [onX(X1, -1.0, 0.6, 0, 25, 'door', { col: '#5a6a3a' }), onX(X1, -1.0, 0.42, 31, 45, 'win', { lit: true, sh: '#4e6a3c' })];
    m.box(X0, Y0, 0, X1, Y1, WH, { top: null, x: M.decals(fx, wx), y: M.decals(fy, wy) });
    const roof = M.shingles({ c: '#5a5a3c', c2: '#6c6a44', rh: 6.5, sw: 8, seed: 37, moss: '#5c7034' });
    m.gable(X0, Y0, X1, Y1, WH, 42, 'x', { roof, end: frame(pl, { posts: [(X1 - Y0) * 32 - 2, (X1 - Y1) * 32 + 2, (X1 + 1) * 32], beams: [WH + 2] }), rake: M.wood({ c: '#3a2a1a', dir: 'a' }) }, { ov: 0.26, og: 0.18 });
    chimney(m, -2.6, -1.6, 62, 104, ST('#7a7268', '#625b52', null, 9));
    // 꽃상자
    const box = M.planks({ c: '#5a3a22', w: 4, dir: 'h', seed: 5 });
    const flw = [M.leaves({ c: '#4a6a2a', c2: '#6a8a34', sc: 0.5 }), M.leaves({ c: '#b03a4a', c2: '#e06070', sc: 0.6 }), M.leaves({ c: '#c0a030', c2: '#e8d060', sc: 0.6 })];
    for (const x of [-3.0, -0.35]) {
      m.box(x - 0.26, Y1, 26, x + 0.26, Y1 + 0.14, 31, { all: box });
      for (let i = 0; i < 4; i++) m.ball(x - 0.2 + i * 0.13, Y1 + 0.08, 33, 0.07, flw[i % 3], { edge: 0.9 });
    }
    // 처마 밑 말린 약초 다발
    const herb = M.leaves({ c: '#6a6a34', c2: '#8a8444', sc: 0.6 });
    for (let i = 0; i < 4; i++) { const x = -2.6 + i * 0.32; m.ball(x, Y1 + 0.3, 44 - (i % 2) * 3, 0.065, herb, { edge: 0.9 }); }
    sign(m, X1 + 0.02, -0.05, 28, 0.42, 13, 'potion', 'x');
    m.glow(-0.35, Y1, 40, 16, [255, 190, 110], 0.26);
    m.glow(-1.75, Y1, 15, 15, [255, 190, 110], 0.22);
    m.glow(X1, -1.0, 38, 16, [255, 190, 110], 0.22);
    m.shade([[X0 - 0.3, Y0 - 0.3], [X1 + 0.32, Y0 - 0.3], [X1 + 0.32, Y1 + 0.34], [X0 - 0.3, Y1 + 0.34]], 0.28);
    return m;
  },
};

// 여관 '잿빛 술잔': 아래층 돌, 위층 목조(앞으로 내민 층), 가파른 지붕과 지붕창, 굴뚝 둘
MODELS.inn = {
  fp: [[-4, -3, 0, 0]],
  make() {
    const m = new Model(41);
    const stone = ST('#6e665c', '#5a534a', '#4a5230', 13), pl = M.plaster({ c: '#bfae8c', seed: 43 });
    const X0 = -4.42, X1 = 0.42, Y0 = -3.42, Y1 = 0.42, Z1 = 40, J = 0.16, Z2 = 82;
    // 아래층: 돌, 박공 쪽(+y, 광장을 본다) 가운데 문(따뜻한 빛이 새는 열린 문)과 창
    const gy = [onY(Y1, -2.0, 0.8, 0, 33, 'door', { arch: 'round', open: true, warm: true, frame: '#4a3a2a' }), onY(Y1, -0.6, 0.36, 12, 30, 'win', { lit: true }), onY(Y1, -3.4, 0.36, 12, 30, 'win', { lit: true })];
    const gx = [onX(X1, -0.6, 0.36, 12, 30, 'win', { lit: true }), onX(X1, -1.8, 0.36, 12, 30, 'win', { lit: true }), onX(X1, -3.0, 0.36, 12, 30, 'win', { lit: false })];
    m.box(X0, Y0, 0, X1, Y1, Z1, { top: null, x: M.decals(stone, gx), y: M.decals(stone, gy) });
    // 위층: 내민 목조
    const ux0 = X0, uy0 = Y0, ux1 = X1 + J, uy1 = Y1 + J;
    const pyl = [(ux0 - uy1) * 32 + 2, (-3.2 - uy1) * 32, (-2.0 - uy1) * 32, (-0.8 - uy1) * 32, (ux1 - uy1) * 32 - 2];
    const pxl = [(ux1 - uy1) * 32 + 2, (ux1 + 0.9) * 32, (ux1 + 2.1) * 32, (ux1 - uy0) * 32 - 2];
    const beams = [Z1 + 2, Z2 - 2];
    const uyd = [onY(uy1, -3.8, 0.4, 52, 70, 'win', { lit: true, sh: '#6a3024' }), onY(uy1, -2.6, 0.4, 52, 70, 'win', { lit: true, sh: '#6a3024' }), onY(uy1, -1.4, 0.4, 52, 70, 'win', { lit: false, sh: '#6a3024' }), onY(uy1, -0.2, 0.4, 52, 70, 'win', { lit: true, sh: '#6a3024' })];
    const uxd = [onX(ux1, -0.45, 0.4, 52, 70, 'win', { lit: true, sh: '#6a3024' }), onX(ux1, -1.6, 0.4, 52, 70, 'win', { lit: false, sh: '#6a3024' }), onX(ux1, -2.8, 0.4, 52, 70, 'win', { lit: true, sh: '#6a3024' })];
    m.box(ux0, uy0, Z1, ux1, uy1, Z2, { top: null, x: M.decals(frame(pl, { posts: pxl, beams }), uxd), y: M.decals(frame(pl, { posts: pyl, beams }), uyd) });
    // 내민 층 아래 들보 끝
    const beam = M.wood({ c: '#3a2618', dir: 'a' });
    m.box(ux0, uy1 - 0.05, Z1 - 3, ux1, uy1, Z1, { all: beam });
    m.box(ux1 - 0.05, uy0, Z1 - 3, ux1, uy1, Z1, { all: beam });
    // 지붕: 붉은 기와, 용마루는 y 방향
    const roof = M.shingles({ c: '#7a3c2c', c2: '#8a4a34', rh: 6, sw: 8, seed: 47, moss: '#5a5a30', mt: 0.66 });
    m.gable(ux0, uy0, ux1, uy1, Z2, 62, 'y', { roof, end: frame(pl, { posts: [(ux0 - uy1) * 32 + 2, (ux1 - uy1) * 32 - 2, (-2.0 - uy1) * 32], beams: [Z2 + 2, Z2 + 30] }), rake: M.wood({ c: '#3a2618', dir: 'a' }) }, { ov: 0.26, og: 0.2, th: 5 });
    // 지붕창(+x 경사)
    const dx = ux1 + 0.05, dz = Z2 + 6;
    m.box(dx - 0.75, -2.15, dz, dx - 0.15, -1.45, dz + 22, { top: null, x: M.decals(pl, [onX(dx - 0.15, -1.8, 0.34, dz + 4, dz + 18, 'win', { lit: true })]), y: pl });
    m.gable(dx - 0.75, -2.15, dx - 0.15, -1.45, dz + 22, 12, 'x', { roof, end: pl, rake: M.wood({ c: '#3a2618', dir: 'a' }) }, { ov: 0.08, og: 0.1, th: 3 });
    chimney(m, -3.6, -2.8, Z2 + 20, Z2 + 76, stone);
    chimney(m, -1.6, -2.6, Z2 + 34, Z2 + 72, stone);
    // 간판: 문 옆 벽에서 내민 쇠막대에 매단 술잔
    const ir = M.metal('#3a3632');
    m.box(-0.83, Y1 + J, 49, -0.77, Y1 + J + 0.62, 52, { all: ir });
    m.box(-1.06, Y1 + J + 0.42, 47, -0.54, Y1 + J + 0.46, 49, { all: ir });
    m.face([-1.05, Y1 + J + 0.44, 29], [0.5, 0, 0], [0, 0, 17], M.icon(SIGN.cup.rows, SIGN.cup.pal, '#3e2a1a'), { edge: 0.7 });
    // 문 옆 등불
    m.box(-2.75, Y1, 34, -2.69, Y1 + 0.12, 40, { all: ir });
    m.box(-2.8, Y1 + 0.04, 26, -2.64, Y1 + 0.2, 34, { all: M.glowc('#ffd080', { c2: '#ffa040' }), top: ir });
    m.glow(-2.72, Y1 + 0.12, 30, 24, [255, 190, 100], 0.4, 1);
    m.glow(-2.0, Y1 + 0.1, 14, 28, [255, 150, 70], 0.32);
    for (const [x, y, z] of [[-3.8, uy1, 61], [-2.6, uy1, 61], [-0.2, uy1, 61], [ux1, -0.45, 61], [ux1, -2.8, 61], [X1, -0.6, 21], [X1, -1.8, 21], [-0.6, Y1, 21], [-3.4, Y1, 21]]) m.glow(x, y, z, 15, [255, 190, 110], 0.24);
    m.shade([[X0 - 0.3, Y0 - 0.3], [X1 + 0.5, Y0 - 0.3], [X1 + 0.5, Y1 + 0.45], [X0 - 0.3, Y1 + 0.45]], 0.3);
    return m;
  },
};

// 현자의 탑: 둥근 돌탑, 원뿔 지붕, 좁은 창, 옆에 낮은 서재
MODELS.sage = {
  fp: [[-2, -2, 0, 0]],
  make() {
    const m = new Model(53);
    const stone = ST('#7a7468', '#646058', '#4e5634', 17);
    const cx = -1, cy = -1, r = 1.32;
    // 원통 벽에 창: 원통 면도 화면 x로 무늬가 이어진다
    const wins = [];
    for (const [a, z0] of [[0.3, 70], [-0.25, 108], [1.25, 92], [0.75, 40]]) {
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      wins.push({ k: 'win', h0: (x - y) * 32 - 5, h1: (x - y) * 32 + 5, z0, z1: z0 + 18, lit: z0 !== 92, cross: false, m: 2 });
    }
    const doorA = Math.PI / 4, dxx = cx + Math.cos(doorA) * r, dyy = cy + Math.sin(doorA) * r;
    wins.push({ k: 'door', h0: (dxx - dyy) * 32 - 11, h1: (dxx - dyy) * 32 + 11, z0: 0, z1: 30, arch: 'round', col: '#4a3a5a', frame: '#56524a', m: 1 });
    m.cyl(cx, cy, r, 0, 132, { side: M.decals(stone, wins) }, { n: 18 });
    m.cyl(cx, cy, r + 0.07, 0, 8, { side: ST('#625c54', '#504a44', null, 18) }, { n: 18 });
    m.cyl(cx, cy, r + 0.08, 126, 134, { side: ST('#625c54', '#504a44', null, 19) }, { n: 18 });
    m.cone(cx, cy, r + 0.3, 130, 214, M.shingles({ c: '#3e3a4c', c2: '#4c4860', rh: 5, sw: 6.5, seed: 57 }), { n: 18 });
    m.box(cx - 0.03, cy - 0.03, 212, cx + 0.03, cy + 0.03, 232, { all: M.metal('#9a8a5a') });
    m.ball(cx, cy, 233, 0.07, M.metal('#e0c060'));
    // 간판(책)
    sign(m, dxx + 0.38, dyy + 0.38, 30, 0.42, 12, 'book', 'y');
    for (const w of wins) if (w.lit) m.glow(cx + 0.9, cy + 0.9, w.z0 + 9, 14, [255, 200, 120], 0.22);
    m.glow(cx + 1, cy + 1, 100, 24, [180, 170, 255], 0.12);
    m.shade([[-2.6, -2.6], [0.6, -2.6], [0.8, -1], [0.6, 0.6], [-1, 0.8], [-2.6, 0.6]], 0.28);
    return m;
  },
};

// 마녀의 오두막: 말뚝 위 판잣집, 가파르고 처마가 깊은 이끼 낀 짚 지붕, 보랏빛 둥근 창, 처마에 매단 약초·뼈, 문 위 짐승 해골
MODELS.witch = {
  fp: [[-2, -2, 0, 0]],
  make() {
    const m = new Model(61);
    const pl = M.planks({ c: '#4a3a2e', w: 5.5, dir: 'v', seed: 63 });
    const X0 = -2.3, X1 = 0.3, Y0 = -2.3, Y1 = 0.3, Z0 = 6, WH = 38;
    const wy = [onY(Y1, -0.75, 0.52, Z0, Z0 + 26, 'door', { col: '#33261c' }), onY(Y1, -1.8, 0.42, Z0 + 12, Z0 + 26, 'win', { lit: true, round: true, glass: [[150, 60, 230], [230, 160, 255]] })];
    const wx = [onX(X1, -1.0, 0.36, Z0 + 12, Z0 + 25, 'win', { lit: true, glass: [[150, 60, 230], [230, 160, 255]] })];
    for (const [x, y] of [[X0 + 0.12, Y1 - 0.12], [X1 - 0.12, Y1 - 0.12], [X1 - 0.12, Y0 + 0.12]]) m.box(x - 0.1, y - 0.1, 0, x + 0.1, y + 0.1, Z0, { all: M.wood({ c: '#3a2c20', dir: 'z' }) });
    m.box(X0 + 0.05, Y0 + 0.05, 0, X1 - 0.05, Y1 - 0.05, Z0, { top: null, all: M.flat('#1a140e', { n: 0.1 }) });
    m.box(X0, Y0, Z0, X1, Y1, WH, { top: null, x: M.decals(pl, wx), y: M.decals(pl, wy) });
    // 문 앞 디딤판
    m.box(-1.15, Y1, 0, -0.35, Y1 + 0.35, Z0, { all: M.planks({ c: '#4a3828', w: 4, dir: 'a' }) });
    // 지붕: 가파른 짚(처마 깊게)
    m.gable(X0, Y0, X1, Y1, WH, 58, 'y', { roof: M.thatch({ c: '#76683e', seed: 67, moss: '#4a5a2c' }), end: pl, rake: M.thatch({ c: '#62562f', seed: 68 }) }, { ov: 0.36, og: 0.3, th: 7 });
    // 기운 굴뚝(돌을 대충 쌓음)
    const ch = M.rubble({ c: '#5a524a', c2: '#4a443c', s: 5, seed: 69 });
    m.box(-1.95, -1.75, WH + 20, -1.55, -1.35, WH + 62, { all: ch, top: null });
    m.box(-1.9, -1.8, WH + 62, -1.45, -1.35, WH + 76, { all: ch, top: M.flat('#140e0a') });
    // 처마에 매단 약초 다발·뼈
    const herb = M.leaves({ c: '#5a5a2a', c2: '#7a7238', sc: 0.6 }), bone = M.flat('#c8c0a8', { n: 0.1 });
    for (let i = 0; i < 5; i++) {
      const y = -2.0 + i * 0.5, z = WH - 12 - (i % 2) * 4;
      if (i % 2) m.box(X1 + 0.3, y - 0.02, z - 6, X1 + 0.34, y + 0.02, z + 4, { all: bone });
      else m.ball(X1 + 0.32, y, z - 2, 0.07, herb, { edge: 0.85 });
    }
    // 문 위 짐승 해골(뿔)
    m.ball(-0.75, Y1 + 0.06, Z0 + 31, 0.09, bone, { edge: 0.75 });
    m.face([-0.86, Y1 + 0.08, Z0 + 32], [-0.14, 0, 9], [0.04, 0, 0], bone, { edges: 0 });
    m.face([-0.64, Y1 + 0.08, Z0 + 32], [0.14, 0, 9], [-0.04, 0, 0], bone, { edges: 0 });
    // 기댄 빗자루
    m.face([0.38, -0.2, 0], [0.02, 0, 40], [0.04, 0, 0], M.wood({ c: '#6a5030', dir: 'b' }), { edges: 0 });
    m.box(0.32, -0.26, 0, 0.48, -0.12, 9, { all: M.hay('#8a7440', 70) });
    // 버섯
    const cap = M.flat('#a83020', { n: 0.15 }), stem = M.flat('#d8d0b8', { n: 0.1 });
    for (const [x, y, s] of [[-2.45, 0.2, 1], [-2.5, -0.6, 0.8], [0.5, -1.6, 0.9], [0.45, -1.9, 0.7]]) {
      m.box(x - 0.02, y - 0.02, 0, x + 0.02, y + 0.02, 5 * s, { all: stem });
      m.ball(x, y, 5 * s, 0.07 * s, cap, { edge: 0.8 });
    }
    m.glow(-1.8, Y1, Z0 + 19, 20, [190, 90, 255], 0.38, 1);
    m.glow(X1, -1.0, Z0 + 18, 16, [190, 90, 255], 0.3, 1);
    m.shade([[X0 - 0.5, Y0 - 0.5], [X1 + 0.5, Y0 - 0.5], [X1 + 0.5, Y1 + 0.55], [X0 - 0.5, Y1 + 0.55]], 0.3);
    return m;
  },
};

// 핍의 좌판: 줄무늬 차양, 판대 위 물건
MODELS.stall = {
  fp: [[-1, 0, 0, 0]],
  make() {
    const m = new Model(71);
    const wd = M.wood({ c: '#5a3e26', dir: 'z' }), top = M.planks({ c: '#6e5034', w: 5, dir: 'a', seed: 3 });
    m.box(-1.4, -0.3, 0, 0.4, 0.3, 20, { top, x: M.planks({ c: '#5e4430', w: 5, dir: 'v' }), y: M.planks({ c: '#5e4430', w: 5, dir: 'v' }) });
    for (const [x, y] of [[-1.38, -0.28], [0.38, -0.28], [-1.38, 0.32], [0.38, 0.32]]) m.box(x - 0.05, y - 0.05, 0, x + 0.05, y + 0.05, 50, { all: wd });
    m.shed(-1.45, -0.35, 0.45, 0.45, 44, 54, '+y', M.cloth({ c1: '#8a2a24', c2: '#d0c0a0', w: 8 }), { ov: 0.12, th: 2, rake: M.cloth({ c1: '#8a2a24', c2: '#d0c0a0', w: 3 }) });
    // 물건: 항아리·상자·천 두루마리
    m.cyl(-1.05, 0, 0.12, 20, 30, { side: M.flat('#8a5a3a', { n: 0.1 }), top: M.flat('#3a2418') }, { n: 10 });
    m.cyl(-0.75, 0.05, 0.09, 20, 27, { side: M.flat('#4a6a7a', { n: 0.1 }), top: M.flat('#20303a') }, { n: 10 });
    m.box(-0.5, -0.2, 20, -0.1, 0.2, 26, { all: M.planks({ c: '#7a5a34', w: 3, dir: 'a' }) });
    for (let i = 0; i < 5; i++) m.ball(-0.42 + (i % 3) * 0.13, -0.1 + Math.floor(i / 3) * 0.16, 28, 0.07, M.leaves({ c: '#a03020', c2: '#d05030', sc: 0.6 }), { edge: 0.85 });
    m.cyl(0.15, 0, 0.1, 20, 24, { side: M.flat('#6a4a7a'), top: M.flat('#7a5a8a') }, { n: 10 });
    m.shade([[-1.6, -0.5], [0.6, -0.5], [0.6, 0.55], [-1.6, 0.55]], 0.26);
    return m;
  },
};

// ───────── 소품(한 칸) ─────────
const P1 = [[0, 0, 0, 0]];
MODELS.well = {
  fp: P1,
  make() {
    const m = new Model(81), st = M.rubble({ c: '#6e675e', c2: '#5c564e', s: 6, seed: 82 });
    m.cyl(0, 0, 0.44, 0, 20, { side: st, top: null }, { n: 16 });
    m.cyl(0, 0, 0.47, 20, 24, { side: M.flat('#6a645c', { n: 0.06 }), top: M.flat('#6a645c', { n: 0.06 }) }, { n: 16 });
    m.face([-0.33, -0.33, 24.2], [0.66, 0, 0], [0, 0.66, 0], M.flat('#101820', { n: 0.15 }), { shape: (a, b) => (a - 0.5) ** 2 + (b - 0.5) ** 2 < 0.25, edges: 0 });
    const wd = M.wood({ c: '#4e3624', dir: 'z' });
    for (const [x, y] of [[-0.42, 0.38], [0.38, -0.42]]) m.box(x - 0.05, y - 0.05, 20, x + 0.05, y + 0.05, 62, { all: wd });
    m.box(-0.44, -0.44, 50, 0.44, 0.44, 52.5, { all: M.wood({ c: '#3e2a1c', dir: 'a' }), top: null, x: null, y: null });
    m.face([-0.4, 0.4, 51], [0.82, -0.82, 0], [0, 0, 3], M.wood({ c: '#3e2a1c', dir: 'a' }), {});
    m.gable(-0.42, -0.42, 0.42, 0.42, 60, 18, 'x', { roof: M.shingles({ c: '#5a3e2c', rh: 4.5, sw: 6, seed: 83 }), end: null, rake: M.wood({ c: '#3a281a', dir: 'a' }) }, { ov: 0.08, og: 0.06, th: 2 });
    m.cyl(0.06, -0.06, 0.08, 34, 42, { side: M.wood({ c: '#5a4030', dir: 'z' }), top: M.flat('#2a2018') }, { n: 8 });
    m.shade([[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]], 0.25);
    return m;
  },
};
MODELS.barrel = {
  fp: P1,
  make(v = 0) {
    const m = new Model(91 + v), c = v === 1 ? '#6a5236' : '#76583a';
    const staves = (C, f) => { const k = M.planks({ c, w: 4, dir: 'v', seed: 92 + v }); return k(C, f); };
    const hoop = M.metal('#3a3632', { sp: 0.3 });
    m.cyl(0, 0, 0.26, 0, 30, { side: (C, f) => (Math.abs(C.z - 6) < 1.6 || Math.abs(C.z - 24) < 1.6 ? hoop(C, f) : staves(C, f)), top: M.planks({ c: '#5a4028', w: 4, dir: 'a', seed: 93 }) }, { n: 12 });
    m.shade([[-0.36, -0.36], [0.36, -0.36], [0.36, 0.36], [-0.36, 0.36]], 0.22);
    return m;
  },
};
MODELS.crate = {
  fp: P1,
  make(v = 0) {
    const m = new Model(101 + v), s = v === 1 ? 0.22 : 0.27, h = v === 1 ? 20 : 26;
    const pk = M.planks({ c: v === 1 ? '#6a5236' : '#7a5c3a', w: 5, dir: 'h', seed: 102 + v });
    const fr = M.wood({ c: '#4a3420', dir: 'z' });
    const side = (C, f) => (C.al < 0.12 || C.al > 0.88 || C.be < 0.1 || C.be > 0.9 ? fr(C, f) : pk(C, f));
    m.box(-s, -s, 0, s, s, h, { top: M.planks({ c: '#806240', w: 5, dir: 'a', seed: 104 }), side });
    m.shade([[-s - 0.08, -s - 0.08], [s + 0.08, -s - 0.08], [s + 0.08, s + 0.08], [-s - 0.08, s + 0.08]], 0.22);
    return m;
  },
};
MODELS.table = {
  fp: P1,
  make() {
    const m = new Model(111), top = M.planks({ c: '#6e5034', w: 5, dir: 'a', seed: 112 }), leg = M.wood({ c: '#4a3420', dir: 'z' });
    for (const [x, y] of [[-0.32, -0.22], [0.32, -0.22], [-0.32, 0.22], [0.32, 0.22]]) m.box(x - 0.04, y - 0.04, 0, x + 0.04, y + 0.04, 17, { all: leg });
    m.box(-0.4, -0.3, 17, 0.4, 0.3, 20, { top, side: M.wood({ c: '#5a4028', dir: 'a' }) });
    m.cyl(-0.1, 0.05, 0.07, 20, 27, { side: M.flat('#8a8070', { n: 0.08 }), top: M.flat('#5a3a20') }, { n: 8 });
    m.cyl(0.15, -0.08, 0.06, 20, 25, { side: M.flat('#7a6a50', { n: 0.08 }), top: M.flat('#d0a050') }, { n: 8 });
    m.shade([[-0.45, -0.35], [0.45, -0.35], [0.45, 0.35], [-0.45, 0.35]], 0.2);
    return m;
  },
};
MODELS.bench = {
  fp: P1,
  make(v = 0) {
    const m = new Model(121), top = M.planks({ c: '#6a4c30', w: 4, dir: v ? 'b' : 'a', seed: 122 }), leg = M.wood({ c: '#4a3420', dir: 'z' });
    const [hx0, hy0] = v ? [0.12, 0.42] : [0.42, 0.12];
    for (const s of [-1, 1]) m.box(v ? -0.1 : s * 0.34 - 0.04, v ? s * 0.34 - 0.04 : -0.1, 0, v ? 0.1 : s * 0.34 + 0.04, v ? s * 0.34 + 0.04 : 0.1, 10, { all: leg });
    m.box(-hx0, -hy0, 10, hx0, hy0, 13, { top, side: M.wood({ c: '#5a4028', dir: 'a' }) });
    return m;
  },
};
MODELS.anvil = {
  fp: P1,
  make() {
    const m = new Model(131), iron = M.metal('#4a4a50', { sp: 0.9 }), stump = M.wood({ c: '#5a4430', dir: 'z' });
    m.cyl(0, 0, 0.22, 0, 14, { side: stump, top: M.flat('#6a5034', { n: 0.1 }) }, { n: 12 });
    m.box(-0.13, -0.08, 14, 0.13, 0.08, 19, { all: iron });
    m.box(-0.26, -0.11, 19, 0.2, 0.11, 25, { all: iron });
    m.face([0.2, -0.11, 19], [0.14, 0.11, 6], [0, 0.22, 0], iron, {});
    m.box(-0.05, 0.11, 25, 0.25, 0.15, 27, { all: M.wood({ c: '#5a4028', dir: 'a' }) });
    m.box(0.12, 0.08, 25, 0.22, 0.18, 30, { all: iron });
    m.shade([[-0.32, -0.32], [0.32, -0.32], [0.32, 0.32], [-0.32, 0.32]], 0.22);
    return m;
  },
};
// 무기 걸이(+y 쪽을 향함)
MODELS.rack = {
  fp: P1,
  make() {
    const m = new Model(141), wd = M.wood({ c: '#4e3624', dir: 'z' }), bar = M.wood({ c: '#4e3624', dir: 'a' });
    const st = M.metal('#a8acb4', { sp: 1 }), hd = M.wood({ c: '#5a3a22', dir: 'z' });
    for (const x of [-0.4, 0.4]) m.box(x - 0.05, -0.05, 0, x + 0.05, 0.05, 44, { all: wd });
    m.box(-0.45, -0.05, 36, 0.45, 0.05, 40, { all: bar });
    m.box(-0.45, -0.05, 8, 0.45, 0.05, 11, { all: bar });
    // 칼·도끼·창
    m.box(-0.27, 0.06, 6, -0.24, 0.08, 38, { all: st }); m.box(-0.29, 0.05, 36, -0.22, 0.09, 38, { all: hd }); m.box(-0.27, 0.06, 38, -0.24, 0.08, 46, { all: hd });
    m.box(-0.06, 0.06, 4, -0.03, 0.08, 44, { all: hd }); m.box(-0.12, 0.06, 34, 0.03, 0.08, 44, { all: st });
    m.box(0.16, 0.06, 2, 0.19, 0.08, 54, { all: hd }); m.box(0.15, 0.06, 54, 0.2, 0.08, 62, { all: st });
    m.box(0.3, 0.06, 6, 0.33, 0.08, 36, { all: st }); m.box(0.28, 0.05, 34, 0.35, 0.09, 36, { all: hd });
    return m;
  },
};
MODELS.hay = {
  fp: P1,
  make() {
    const m = new Model(151), h = M.hay('#a8904c');
    m.box(-0.36, -0.24, 0, 0.36, 0.24, 18, { all: h });
    m.box(-0.2, -0.36, 18, 0.24, 0.12, 32, { all: M.hay('#b09a54', 152) });
    for (const z of [5, 13]) m.box(-0.365, -0.245, z, 0.365, 0.245, z + 1.4, { all: M.flat('#4a3a22'), top: null });
    m.shade([[-0.45, -0.45], [0.42, -0.45], [0.42, 0.32], [-0.45, 0.32]], 0.2);
    return m;
  },
};
MODELS.logs = {
  fp: P1,
  make() {
    const m = new Model(161), bk = M.bark('#5a4430'), ring = M.flat('#a8845a', { n: 0.15 });
    let i = 0;
    for (const [z, n] of [[0, 3], [9, 2], [18, 1]]) for (let k = 0; k < n; k++) {
      const y = -0.26 + (k + (3 - n) * 0.5) * 0.18 + 0.02, zz = z + 4.5;
      m.box(-0.36, y - 0.08, zz - 4.4, 0.36, y + 0.08, zz + 4.4, { top: bk, y: bk, x: null });
      m.face([0.36, y - 0.08, zz - 4.4], [0, 0.16, 0], [0, 0, 8.8], ring, { shape: (a, b) => (a - 0.5) ** 2 + (b - 0.5) ** 2 < 0.25, edges: 0, seed: i++ });
    }
    return m;
  },
};
MODELS.cart = {
  fp: [[-1, 0, 0, 0]],
  make() {
    const m = new Model(171), pk = M.planks({ c: '#6a4c30', w: 5, dir: 'h', seed: 172 }), wd = M.wood({ c: '#4a3420', dir: 'a' });
    m.box(-1.2, -0.3, 12, 0.2, 0.3, 26, { top: M.hay('#a8904c', 173), side: pk });
    m.box(0.2, -0.04, 12, 0.9, 0.04, 15, { all: wd });
    const wheel = (C, f) => { const dx = C.al - 0.5, dy = C.be - 0.5, r = Math.hypot(dx, dy); if (r > 0.5) return false; if (r > 0.38 || r < 0.1 || Math.abs(dx) < 0.05 || Math.abs(dy) < 0.05 || Math.abs(dx - dy) < 0.06 || Math.abs(dx + dy) < 0.06) return wd(C, f); return false; };
    m.face([-0.85, 0.32, 0], [0.6, 0, 0], [0, 0, 24], wheel, { edges: 0, shape: (a, b) => (a - 0.5) ** 2 + (b - 0.5) ** 2 < 0.25 });
    m.shade([[-1.3, -0.4], [0.9, -0.4], [0.9, 0.42], [-1.3, 0.42]], 0.22);
    return m;
  },
};
MODELS.lamp = {
  fp: P1,
  make() {
    const m = new Model(181), ir = M.metal('#4a4440', { sp: 0.5 });
    m.box(-0.1, -0.1, 0, 0.1, 0.1, 5, { all: M.rubble({ c: '#6a645c', s: 4, seed: 182 }) });
    m.box(-0.035, -0.035, 5, 0.035, 0.035, 54, { all: ir });
    m.box(-0.035, -0.035, 50, 0.16, 0.035, 53, { all: ir });
    m.box(0.07, -0.08, 38, 0.21, 0.06, 49, { all: M.glowc('#ffd890', { c2: '#ffb050' }), top: ir });
    m.pyramid(0.05, -0.1, 0.23, 0.08, 49, 54, ir);
    m.glow(0.14, -0.01, 44, 28, [255, 200, 120], 0.38, 1);
    return m;
  },
};
// 울타리 한 칸(ori 'x': x 방향으로 이어짐)
MODELS.fence = {
  fp: P1,
  make(v = 0) {
    const m = new Model(191 + v), wd = M.wood({ c: '#5a4430', dir: 'z' }), rl = M.wood({ c: '#5e4834', dir: 'a' });
    if (v === 0) {
      for (const x of [-0.42, 0.42]) m.box(x - 0.05, -0.05, 0, x + 0.05, 0.05, 26, { all: wd });
      for (const z of [10, 20]) m.box(-0.5, -0.03, z, 0.5, 0.03, z + 3, { all: rl });
    } else {
      for (const y of [-0.42, 0.42]) m.box(-0.05, y - 0.05, 0, 0.05, y + 0.05, 26, { all: wd });
      for (const z of [10, 20]) m.box(-0.03, -0.5, z, 0.03, 0.5, z + 3, { all: M.wood({ c: '#5e4834', dir: 'b' }) });
    }
    return m;
  },
};
// 무덤: 0 둥근 비석, 1 십자가, 2 기운 비석과 흙 둔덕
MODELS.tomb = {
  fp: P1,
  make(v = 0) {
    const m = new Model(201 + v), st = M.ashlar({ c: '#7a766e', c2: '#6a6660', bh: 30, bw: 40, seed: 202 + v, moss: '#4a5430' });
    const lean = v === 2 ? 4 : 0;
    if (v === 1) {
      m.box(-0.05, -0.05, 0, 0.05, 0.05, 34, { all: st });
      m.box(-0.05, -0.18, 22, 0.05, 0.18, 28, { all: st });
    } else {
      const round = (al, be) => be < 0.7 || Math.hypot(al - 0.5, (be - 0.7) * 1.5) < 0.5;
      m.face([-0.2, 0.06, 0], [0.4, 0, 0], [0, 0, 26], st, { shape: round, edge: 0.7 });
      m.face([0.2, -0.06, 0], [0, 0.12, 0], [0, 0, 20], st, { edge: 0.7 });
      m.face([-0.2, -0.06, 20], [0.4, 0, 0], [0, 0.12, 0], st, { shape: (al) => Math.abs(al - 0.5) < 0.4, edges: 0 });
      if (lean) m.face([-0.2, 0.06, 26], [0.4, 0, 0], [0, 0, lean], st, { shape: (al, be) => Math.hypot(al - 0.5, be * 0.5 + 0.2) < 0.5 });
    }
    m.box(-0.2, 0.08, 0, 0.2, 0.55, 3, { top: M.flat('#4a3c2a', { n: 0.2 }), side: M.flat('#3e3224', { n: 0.2 }) });
    return m;
  },
};
MODELS.stash = {
  fp: P1,
  make() {
    const m = new Model(211), pk = M.planks({ c: '#5a3c22', w: 5, dir: 'h', seed: 212 }), ir = M.metal('#3a3836', { sp: 0.5 });
    const side = (C, f) => (C.al < 0.1 || C.al > 0.9 || Math.abs(C.al - 0.5) < 0.06 ? ir(C, f) : pk(C, f));
    m.box(-0.34, -0.24, 0, 0.34, 0.24, 15, { top: null, side });
    m.box(-0.35, -0.25, 15, 0.35, 0.25, 22, { top: M.planks({ c: '#6e4a28', w: 5, dir: 'a' }), side });
    m.face([-0.04, 0.255, 10], [0.08, 0, 0], [0, 0, 8], M.metal('#d8b050', { sp: 1 }), {});
    m.shade([[-0.45, -0.35], [0.45, -0.35], [0.45, 0.35], [-0.45, 0.35]], 0.24);
    return m;
  },
};
MODELS.cauldron = {
  fp: P1,
  make() {
    const m = new Model(221), ir = M.metal('#34302c', { sp: 0.5 });
    for (const [x, y] of [[-0.3, 0.22], [0.3, 0.22], [0, -0.34]]) m.box(x - 0.03, y - 0.03, 0, x + 0.03, y + 0.03, 34, { all: M.wood({ c: '#3a2c20', dir: 'z' }) });
    const pot = (C, f) => (C.z > 16 ? false : ir(C, f));
    m.ball(0, 0, 9, 0.28, pot, { edge: 0.75 });
    m.cyl(0, 0, 0.25, 14, 17, { side: ir, top: null }, { n: 14 });
    m.face([-0.24, -0.24, 15.5], [0.48, 0, 0], [0, 0.48, 0], M.glowc('#3a9a2a', { c2: '#9ae050', e: 0.85 }), { shape: (a, b) => (a - 0.5) ** 2 + (b - 0.5) ** 2 < 0.25, edges: 0 });
    for (let i = 0; i < 4; i++) m.ball(-0.12 + i * 0.08, (i % 2) * 0.1 - 0.05, 17, 0.035, M.glowc('#b0ff70', { e: 0.9 }));
    // 장작불
    m.face([-0.2, -0.2, 0.5], [0.4, 0, 0], [0, 0.4, 0], M.coals(), { shape: (a, b) => (a - 0.5) ** 2 + (b - 0.5) ** 2 < 0.25, edges: 0 });
    m.glow(0, 0, 18, 30, [90, 220, 70], 0.4, 1);
    m.glow(0, 0, 2, 18, [255, 120, 40], 0.3, 1);
    return m;
  },
};
// 약초밭 한 칸(이랑 위 풀)
MODELS.herbs = {
  fp: P1,
  make(v = 0) {
    const m = new Model(231 + v), l = [M.leaves({ c: '#3e5a26', c2: '#5e7a34', sc: 0.6 }), M.leaves({ c: '#4a6a2e', c2: '#7a9a40', sc: 0.6 }), M.leaves({ c: '#5a5a2a', c2: '#8a8440', sc: 0.6 })][v % 3];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) m.ball(-0.3 + i * 0.3, -0.18 + j * 0.36, 5, 0.12 + ((i + j + v) % 2) * 0.03, l, { edge: 0.85 });
    if (v === 1) for (let i = 0; i < 3; i++) m.ball(-0.3 + i * 0.3, 0.18, 11, 0.04, M.leaves({ c: '#a03a6a', c2: '#e070a0', sc: 0.8 }));
    return m;
  },
};
// 해골 장대
MODELS.skullpole = {
  fp: P1,
  make() {
    const m = new Model(251), bone = M.flat('#c8c0a8', { n: 0.12 });
    m.box(-0.04, -0.04, 0, 0.04, 0.04, 44, { all: M.wood({ c: '#3a2c20', dir: 'z' }) });
    m.box(-0.18, -0.03, 34, 0.18, 0.03, 37, { all: M.wood({ c: '#3a2c20', dir: 'a' }) });
    m.ball(0, 0, 48, 0.11, bone, { edge: 0.7 });
    m.face([-0.07, 0.1, 45], [0.05, 0, 0], [0, 0, 4], M.flat('#140c0a'), { edges: 0 });
    m.face([0.02, 0.1, 45], [0.05, 0, 0], [0, 0, 4], M.flat('#140c0a'), { edges: 0 });
    m.box(-0.15, -0.02, 26, -0.11, 0.02, 34, { all: bone });
    m.box(0.11, -0.02, 28, 0.15, 0.02, 34, { all: bone });
    return m;
  },
};
// 표지판
MODELS.signpost = {
  fp: P1,
  make() {
    const m = new Model(241), wd = M.wood({ c: '#5a4430', dir: 'z' });
    m.box(-0.05, -0.05, 0, 0.05, 0.05, 50, { all: wd });
    m.box(-0.02, -0.4, 38, 0.02, 0.1, 46, { all: M.planks({ c: '#7a5c3a', w: 4, dir: 'h' }) });
    m.box(-0.4, -0.02, 28, 0.1, 0.02, 35, { all: M.planks({ c: '#6e5234', w: 4, dir: 'h' }) });
    return m;
  },
};

// ───────── 바닥 장식(부딪히지 않음, 바닥과 함께 그린다) ─────────
// 풀포기: v 0~2
MODELS.tuft = {
  fp: P1,
  make(v = 0) {
    const m = new Model(401 + v), l = M.leaves({ c: v === 2 ? '#5a6a2c' : '#3e5a24', c2: v === 2 ? '#8a8a3c' : '#5e7e30', sc: 0.9, seed: 402 + v });
    const n = 5 + v * 2;
    for (let i = 0; i < n; i++) { const a = i * 2.4 + v, r = 0.05 + (i % 3) * 0.05; m.cone(Math.cos(a) * r, Math.sin(a) * r, 0.05, 0, 7 + (i % 3) * 3 + v, l, { n: 5, edge: 0.85 }); }
    return m;
  },
};
// 들꽃: v 0 흰·노랑, 1 보라, 2 빨강
MODELS.flowers = {
  fp: P1,
  make(v = 0) {
    const m = new Model(411 + v), l = M.leaves({ c: '#3e5a24', c2: '#5e7e30', sc: 0.9, seed: 412 });
    const col = [['#e8e0c0', '#f0d860'], ['#a070d0', '#d0a0f0'], ['#c03030', '#f06050']][v];
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + v, r = 0.06 + (i % 2) * 0.08; m.cone(Math.cos(a) * r, Math.sin(a) * r, 0.04, 0, 6, l, { n: 5 }); }
    for (let i = 0; i < 5; i++) { const a = i * 1.3 + v * 0.7, r = 0.04 + (i % 3) * 0.07; m.ball(Math.cos(a) * r, Math.sin(a) * r, 6 + (i % 2) * 2, 0.035, M.flat(col[i % 2], { n: 0.12 }), { edge: 0.9 }); }
    return m;
  },
};
// 돌: v 0 작은 돌 무더기, 1 큰 바위
MODELS.rock = {
  fp: P1,
  make(v = 0) {
    const m = new Model(421 + v), st = M.leaves({ c: '#6a665e', c2: '#8a867c', sc: 0.5, seed: 422 + v });
    if (v === 1) { m.ball(0, 0, -6, 0.28, st, { edge: 0.8 }); m.ball(0.18, 0.1, -4, 0.16, st, { edge: 0.8 }); }
    else { m.ball(-0.1, 0.05, -3, 0.12, st, { edge: 0.8 }); m.ball(0.1, -0.06, -2, 0.1, st, { edge: 0.8 }); m.ball(0.05, 0.14, -2, 0.07, st, { edge: 0.8 }); }
    return m;
  },
};
// 버섯 무리
MODELS.shrooms = {
  fp: P1,
  make() {
    const m = new Model(431), cap = M.flat('#a0805a', { n: 0.15 }), stem = M.flat('#d8d0b8', { n: 0.1 });
    for (const [x, y, s] of [[0, 0, 1], [0.1, 0.06, 0.7], [-0.08, 0.1, 0.8]]) { m.box(x - 0.015, y - 0.015, 0, x + 0.015, y + 0.015, 4 * s, { all: stem }); m.ball(x, y, 4 * s, 0.05 * s, cap, { edge: 0.85 }); }
    return m;
  },
};

// ───────── 나무 ─────────
// v: 0 활엽수, 1 큰 활엽수, 2 전나무, 3 큰 전나무, 4 죽은 나무, 5 덤불
MODELS.tree = {
  fp: P1,
  make(v = 0) {
    const m = new Model(301 + v * 7);
    const trunk = M.bark('#4a3626', 302 + v);
    if (v === 5) {
      const l = M.leaves({ c: '#2e4220', c2: '#4a6a2c', sc: 0.45, seed: 303 });
      m.ball(0, 0, 10, 0.34, l); m.ball(-0.24, 0.16, 8, 0.25, l); m.ball(0.22, -0.14, 9, 0.26, l); m.ball(0.06, 0.2, 14, 0.2, l);
      return m;
    }
    if (v === 4) {
      // 죽은 나무: 굵은 줄기에서 갈라지는 가지(가지 끝에 잔가지)
      const br = M.bark('#4e443a', 304);
      m.cyl(0, 0, 0.11, 0, 52, { side: br }, { n: 8 });
      const limb = (x, y, z, dx, dy, dz, w) => {
        m.face([x - w, y + w, z], [dx, dy, dz], [w * 2, -w * 2, 0], br, { edges: 0 });
        m.face([x - w, y + w, z], [dx, dy, dz], [0, 0, w * 30], br, { edges: 0 });
      };
      for (const [a, z, l] of [[0.5, 30, 0.6], [2.3, 38, 0.55], [3.9, 26, 0.5], [5.2, 44, 0.48], [1.4, 50, 0.4]]) {
        const dx = Math.cos(a) * l, dy = Math.sin(a) * l, dz = l * 40;
        limb(0, 0, z, dx, dy, dz, 0.045);
        limb(dx * 0.6, dy * 0.6, z + dz * 0.6, Math.cos(a + 0.8) * l * 0.4, Math.sin(a + 0.8) * l * 0.4, l * 22, 0.025);
        limb(dx, dy, z + dz, Math.cos(a - 0.5) * l * 0.35, Math.sin(a - 0.5) * l * 0.35, l * 18, 0.02);
      }
      return m;
    }
    const big = v === 1 || v === 3, k = big ? 1.25 : 1;
    if (v === 2 || v === 3) {
      m.cyl(0, 0, 0.09 * k, 0, 24 * k, { side: trunk }, { n: 8 });
      const l = M.leaves({ c: '#1c3222', c2: '#2e4a30', sc: 0.42, seed: 306 + v });
      const rings = [[12, 0.6, 46], [36, 0.48, 40], [58, 0.36, 34], [78, 0.22, 28]];
      for (const [z, r, h] of rings) m.cone(0, 0, r * k, z * k, (z + h) * k, l, { n: 12, edge: 0.75 });
      m.shade([[-0.5 * k, -0.5 * k], [0.5 * k, -0.5 * k], [0.5 * k, 0.5 * k], [-0.5 * k, 0.5 * k]], 0.2);
      return m;
    }
    m.cyl(0, 0, 0.11 * k, 0, 34 * k, { side: trunk }, { n: 8 });
    const l = M.leaves({ c: '#2a3c1c', c2: '#4a6028', sc: 0.36, seed: 307 + v });
    const blobs = [[0, 0, 58, 0.6], [-0.4, 0.26, 50, 0.42], [0.36, -0.3, 52, 0.42], [0.22, 0.36, 62, 0.38], [-0.26, -0.34, 66, 0.38], [0.05, 0.05, 80, 0.38]];
    for (const [x, y, z, r] of blobs) m.ball(x * k, y * k, z * k, r * k, l);
    m.shade([[-0.7 * k, -0.4 * k], [0.4 * k, -0.7 * k], [0.8 * k, 0.4 * k], [-0.4 * k, 0.8 * k]], 0.22);
    return m;
  },
};

// ───────── 굽기 저장소 ─────────
// 모형 + 변형 + 배율마다 한 번 굽는다. 배율이 바뀌는 중에는 일감으로 나눠 굽고(장면마다 조금씩) 그동안 가까운 배율 그림을 쓴다
const cache = new Map(), jobs = new Map();
const keyOf = (name, v, sl) => `${name}:${v || 0}:${sl}`;
export function townSprite(name, v, sl) {
  const key = keyOf(name, v, sl);
  let s = cache.get(key);
  if (!s) {
    const j = jobs.get(key) || bakeJob(MODELS[name].make(v || 0), sl);
    j.step();
    jobs.delete(key);
    s = j.out; cache.set(key, s);
  }
  return s;
}
export function cachedSprite(name, v, sl) { return cache.get(keyOf(name, v, sl)) || null; }
export function queueSprite(name, v, sl) {
  const key = keyOf(name, v, sl);
  if (!cache.has(key) && !jobs.has(key)) jobs.set(key, bakeJob(MODELS[name].make(v || 0), sl));
}
// 밀린 굽기를 ms 동안 진행한다
export function pumpBakes(ms) {
  if (!jobs.size) return;
  const t0 = performance.now();
  for (const [key, j] of jobs) {
    if (j.step(ms - (performance.now() - t0))) { cache.set(key, j.out); jobs.delete(key); }
    if (performance.now() - t0 >= ms) return;
  }
}
// 이미 구운 것 가운데 배율이 가장 가까운 것
export function nearestSprite(name, v, sl) {
  let best = null, bd = 1e9;
  for (const [k, s] of cache) {
    const [n, vv] = k.split(':');
    if (n !== name || +vv !== (v || 0)) continue;
    const d = Math.abs(s.sl - sl);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
export function hasModel(name) { return !!MODELS[name]; }
export { MODELS };

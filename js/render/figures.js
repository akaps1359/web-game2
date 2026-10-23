// 인물·괴물 그리기: 3차원 관절 뼈대를 아이소메트릭으로 투영해 매 프레임 그린다
// 몸 좌표: f = 앞, r = 오른쪽, z = 위. 단위 u(확대 1에서 세로 1u ≈ 1px, 바닥 40u = 한 칸)
import { shade } from './noise.js';

const PI = Math.PI;
const PR = { px: 0, py: 0, kfx: 0, krx: 0, kfy: 0, kry: 0, kz: 0, df: 0, dr: 0 };
function setProj(face, px, py, s) {
  const fx = Math.cos(face), fy = Math.sin(face), rx = -fy, ry = fx;
  PR.kfx = (fx - fy) * 0.8 * s; PR.krx = (rx - ry) * 0.8 * s;
  PR.kfy = (fx + fy) * 0.4 * s; PR.kry = (rx + ry) * 0.4 * s;
  PR.kz = s; PR.px = px; PR.py = py; PR.df = fx + fy; PR.dr = rx + ry;
}
const X = (f, r) => PR.px + f * PR.kfx + r * PR.krx;
const Y = (f, r, z) => PR.py + f * PR.kfy + r * PR.kry - z * PR.kz;
const D = (f, r) => f * PR.df + r * PR.dr;

// 관절 하나: [f, r, z]
class J { constructor() { this.f = 0; this.r = 0; this.z = 0; } set(f, r, z) { this.f = f; this.r = r; this.z = z; return this; } }
const JN = ['pel', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'hiL', 'hiR', 'knL', 'knR', 'anL', 'anR', 'toL', 'toR', 'wTip', 'wMid', 'tail', 'tail2', 'wingL', 'wingR', 'wingL2', 'wingR2', 'jaw'];
const JS = {}; for (const n of JN) JS[n] = new J();

// 그리기 목록(깊이순)
const parts = []; const ppool = [];
let pcount = 0;
function part(d, kind, a, b, w, col, extra) {
  let p = ppool[pcount];
  if (!p) { p = {}; ppool.push(p); }
  pcount++;
  p.d = d; p.k = kind; p.a = a; p.b = b; p.w = w; p.c = col; p.x = extra;
  parts.push(p);
  return p;
}

// 관절 회전: 몸 숙이기(골반 기준, r축), 상체 비틀기(z축), 쓰러지기(발 기준, r축)
function leanPt(j, lean, pivotZ) {
  if (!lean) return;
  const c = Math.cos(lean), s = Math.sin(lean), dz = j.z - pivotZ;
  const f = j.f * c + dz * s, z = pivotZ + dz * c - j.f * s;
  j.f = f; j.z = z;
}
function twistPt(j, tw) {
  if (!tw) return;
  const c = Math.cos(tw), s = Math.sin(tw);
  const f = j.f * c - j.r * s, r = j.f * s + j.r * c;
  j.f = f; j.r = r;
}
function fallPt(j, ang, dir) {
  if (!ang) return;
  // dir = 1: 뒤로, -1: 앞으로
  const c = Math.cos(ang), s = Math.sin(ang) * dir;
  const f = j.f * c - j.z * s, z = j.z * c + j.f * s;
  j.f = f; j.z = Math.max(z, 0.5);
}
// 팔다리 방향: pitch(0 = 아래, π/2 = 앞, π = 위), ab(바깥으로 벌림)
function limb(out, from, len, pitch, ab, side) {
  const ca = Math.cos(ab);
  out.f = from.f + Math.sin(pitch) * ca * len;
  out.r = from.r + side * Math.sin(ab) * len;
  out.z = from.z - Math.cos(pitch) * ca * len;
  return out;
}

// ───────── 자세 ─────────
const POSE = { bob: 0, lean: 0, twist: 0, hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, shL: 0, abL: 0, elL: 0, shR: 0, abR: 0, elR: 0, headP: 0, wrist: 0, fall: 0, fallDir: 1, crouch: 0, wing: 0, jaw: 0, bow: 0 };
function resetPose(p, look) {
  p.bob = 0; p.lean = look.hunch || 0; p.twist = 0;
  p.hipL = 0.04; p.kneeL = 0.12; p.hipR = -0.04; p.kneeR = 0.12;
  p.shL = 0.12 + (look.reach || 0); p.abL = 0.18; p.elL = 0.35 + (look.reach || 0) * 0.3;
  p.shR = 0.12 + (look.reach || 0); p.abR = 0.18; p.elR = 0.35 + (look.reach || 0) * 0.3;
  p.headP = 0; p.wrist = 1.0; p.fall = 0; p.fallDir = 1; p.crouch = 0; p.wing = 0; p.jaw = 0; p.bow = 0;
}
const ease = (x) => x * x * (3 - 2 * x);
const seg = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));

export function computePose(a, look, p, time) {
  resetPose(p, look);
  const A = a.anim || { name: 'idle', t: 0, dur: 1 };
  const u = A.dur ? Math.min(1, A.t / A.dur) : 0;
  const wt = look.wtype;
  // 숨쉬기
  const br = Math.sin(time * 2.2 + (a.id || 0)) * 0.6;
  p.bob = br * 0.5;
  if (look.reach) { p.shL += Math.sin(time * 1.3 + a.id) * 0.08; p.shR += Math.cos(time * 1.1 + a.id) * 0.08; }
  if (wt && wt !== 'bow' && wt !== 'staff') { p.shR = 0.35; p.elR = 0.7; p.wrist = 0.9; }
  if (wt === 'staff') { p.shR = 0.3; p.elR = 1.0; p.wrist = 0.35; }
  if (wt === 'bow') { p.shL = 0.35; p.elL = 0.6; }
  if (look.shield) { p.shL = 0.35; p.elL = 1.1; p.abL = 0.25; }
  if (look.wings) p.wing = Math.sin(time * (look.fly ? 9 : 1.5) + a.id) * (look.fly ? 0.7 : 0.15);
  if (look.fly) p.bob = 6 + Math.sin(time * 3 + a.id) * 3;
  // 걷기(이동 거리로 위상이 움직인다)
  if (a.moving) {
    const ph = a.walkPh || 0, sn = Math.sin(ph), cs = Math.cos(ph);
    const st = look.stride ?? 1;
    p.hipL = 0.55 * sn * st; p.hipR = -0.55 * sn * st;
    p.kneeL = 0.15 + Math.max(0, cs) * 0.9 * st; p.kneeR = 0.15 + Math.max(0, -cs) * 0.9 * st;
    if (!look.reach) {
      p.shL = (wt === 'bow' ? 0.3 : 0.12) - 0.45 * sn * st; p.shR = (wt && wt !== 'bow' ? 0.35 : 0.12) + 0.45 * sn * st;
    }
    p.bob += Math.abs(cs) * 1.6 * st;
    p.lean += 0.07;
    if (look.fly) { p.hipL = p.hipR = -0.3; p.kneeL = p.kneeR = 0.8; }
  }
  switch (A.name) {
    case 'attack': {
      const style = A.style || look.astyle || (wt === 'dagger' || wt === 'spear' ? 'stab' : wt === 'bow' ? 'bow' : wt ? 'swing' : 'claw');
      if (style === 'swing' || style === 'overhead') {
        const wu = ease(seg(u, 0, 0.45)), st = ease(seg(u, 0.42, 0.62)), rc = ease(seg(u, 0.62, 1));
        const raise = style === 'overhead' ? 2.9 : 2.5;
        p.shR = 0.35 + (raise - 0.35) * wu - (raise - 0.5) * st - 0.15 * rc;
        p.elR = 0.7 + 0.5 * wu - 1.0 * st + 0.5 * rc;
        p.abR = 0.18 + 0.35 * wu - 0.3 * st;
        p.wrist = 0.9 + 0.6 * wu - 1.0 * st + 0.5 * rc;
        p.twist = 0.45 * wu - 0.85 * st + 0.4 * rc;
        p.lean += 0.05 * wu + 0.22 * st - 0.2 * rc;
        p.hipR = -0.25 * st; p.hipL = 0.35 * st; p.kneeL = 0.3 * st + 0.1;
        if (look.shield) { p.shL = 0.5; p.elL = 1.2; }
      } else if (style === 'stab') {
        const wu = ease(seg(u, 0, 0.4)), st = ease(seg(u, 0.4, 0.58)), rc = ease(seg(u, 0.6, 1));
        p.shR = 0.5 + 0.9 * wu + 0.2 * st - 1.0 * rc; p.elR = 0.7 + 1.2 * wu - 1.9 * st + 0.7 * rc;
        p.wrist = 1.0 - 0.2 * st; p.twist = 0.35 * wu - 0.6 * st + 0.25 * rc; p.lean += 0.25 * st - 0.2 * rc;
        p.hipL = 0.4 * st; p.kneeL = 0.35 * st + 0.1;
      } else if (style === 'bow') {
        const dr = ease(seg(u, 0, 0.55)), rl = seg(u, 0.55, 0.62), rc = ease(seg(u, 0.65, 1));
        p.shL = 0.35 + 1.15 * (dr > 0 ? 1 : 0) * (1 - rc) + 0 * rl; p.elL = 0.6 - 0.55 * (1 - rc); p.abL = 0.1;
        p.shR = 0.12 + 1.4 * (1 - rc); p.elR = 0.4 + 2.2 * dr * (1 - rl) * (1 - rc); p.abR = 0.1;
        p.twist = -0.5 * (1 - rc); p.bow = dr * (1 - rl);
      } else if (style === 'claw' || style === 'bite') {
        const wu = ease(seg(u, 0, 0.4)), st = ease(seg(u, 0.4, 0.6)), rc = ease(seg(u, 0.6, 1));
        p.shR = 0.3 + 2.0 * wu - 1.7 * st - 0.3 * rc; p.elR = 0.4 + 0.8 * wu - 0.8 * st; p.abR = 0.2 + 0.3 * wu;
        p.shL = 0.3 + 1.2 * st * (1 - rc) + 0.5 * wu; p.elL = 0.6;
        p.twist = 0.4 * wu - 0.7 * st + 0.3 * rc; p.lean += 0.3 * st - 0.25 * rc + 0.05;
        p.jaw = st * (1 - rc);
      } else if (style === 'slam') {
        const wu = ease(seg(u, 0, 0.5)), st = ease(seg(u, 0.5, 0.65)), rc = ease(seg(u, 0.7, 1));
        p.shR = p.shL = 0.3 + 2.6 * wu - 2.2 * st - 0.3 * rc; p.elR = p.elL = 0.5 + 0.6 * wu - 0.8 * st;
        p.lean += -0.2 * wu + 0.55 * st - 0.35 * rc; p.crouch = st * (1 - rc) * 6;
        p.kneeL = p.kneeR = 0.12 + 0.6 * st * (1 - rc); p.hipL = p.hipR = 0.4 * st * (1 - rc);
      } else if (style === 'spin') {
        p.twist = u * PI * 2 * 2; p.shR = 1.5; p.abR = 0.6; p.elR = 0.1; p.wrist = 0.2; p.shL = 1.3; p.abL = 0.7;
      }
      break;
    }
    case 'cast': {
      const up = ease(seg(u, 0, 0.45)), th = ease(seg(u, 0.45, 0.6)), rc = ease(seg(u, 0.65, 1));
      p.shL = 0.15 + 1.3 * up + 0.2 * th - 1.4 * rc; p.shR = 0.15 + 1.3 * up + 0.2 * th - 1.4 * rc;
      p.elL = 1.3 * up - 1.1 * th + 0.3 * rc + 0.3; p.elR = p.elL; p.abL = p.abR = 0.25 + 0.2 * up;
      p.lean += -0.12 * up + 0.25 * th - 0.13 * rc;
      if (wt && wt !== 'staff' && wt !== 'bow') { p.shR = 0.35 + 0.4 * up; p.elR = 0.7; }
      if (wt === 'staff') { p.shR = 0.3 + 1.0 * up + 0.3 * th - 1.3 * rc; p.elR = 1.0 - 0.6 * th; p.wrist = 0.35; }
      break;
    }
    case 'hit': {
      const k = Math.sin(u * PI);
      p.lean -= 0.3 * k; p.headP = -0.4 * k; p.abL += 0.4 * k; p.abR += 0.4 * k; p.shL += 0.4 * k; p.shR += 0.4 * k; p.kneeL += 0.3 * k; p.kneeR += 0.3 * k;
      break;
    }
    case 'block': {
      const k = Math.sin(Math.min(1, u * 1.6) * PI * 0.5);
      p.shL = 0.35 + 1.0 * k; p.elL = 1.1 + 0.5 * k; p.abL = 0.25 - 0.2 * k; p.crouch = 3 * k; p.kneeL += 0.3 * k; p.kneeR += 0.3 * k; p.lean -= 0.1 * k;
      break;
    }
    case 'death': case 'dead': {
      const k = A.name === 'dead' ? 1 : ease(seg(u, 0, 0.85));
      p.fall = k * 1.5; p.fallDir = a.fallDir || 1;
      p.shL = 0.3 + 2.2 * k; p.shR = 0.2 + 2.6 * k; p.abL = 0.3 + 0.6 * k; p.abR = 0.3 + 0.8 * k; p.elL = 0.6; p.elR = 0.3;
      p.hipL = 0.3 * k; p.hipR = -0.2 * k; p.kneeL = 0.5 * k; p.kneeR = 0.2 * k; p.headP = -0.5 * k; p.lean = 0;
      p.bob = 0; p.wing = -0.5 * k;
      break;
    }
    case 'special': {
      // 함성·도약·소환 등: 두 팔을 들어 올린다
      const k = Math.sin(u * PI);
      p.shL = p.shR = 0.2 + 2.5 * k; p.abL = p.abR = 0.6 * k + 0.2; p.elL = p.elR = 0.3; p.lean -= 0.25 * k; p.headP = -0.4 * k; p.jaw = k;
      break;
    }
    case 'stone': { p.crouch = 8; p.kneeL = p.kneeR = 1.3; p.hipL = p.hipR = 1.0; p.lean += 0.4; p.wing = -0.6; p.shL = p.shR = 0.5; break; }
  }
  return p;
}

// ───────── 그리기 도구 ─────────
let OUT = 'rgba(8,5,4,0.92)';
function stroke(g, x1, y1, x2, y2, w, col, ow) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  if (ow > 0) { g.strokeStyle = OUT; g.lineWidth = w + ow; g.stroke(); }
  g.strokeStyle = col; g.lineWidth = w; g.stroke();
}
function disc(g, x, y, r, col, ow) {
  g.beginPath(); g.arc(x, y, r, 0, PI * 2);
  if (ow > 0) { g.fillStyle = OUT; g.beginPath(); g.arc(x, y, r + ow / 2, 0, PI * 2); g.fill(); g.beginPath(); g.arc(x, y, r, 0, PI * 2); }
  g.fillStyle = col; g.fill();
}
function polyPts(g, pts, col, ow) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (ow > 0) { g.strokeStyle = OUT; g.lineWidth = ow; g.lineJoin = 'round'; g.stroke(); }
  g.fillStyle = col; g.fill();
}

// 사다리꼴 몸통(아래 너비 w0·두께 d0, 위 너비 w1·두께 d1): 카메라를 향한 면만 밝기를 달리해 칠한다
const BOX = new Float64Array(24), BXY = new Float64Array(16);
const FACES = [[0, 1, 2, 3, 1], [4, 5, 6, 7, 0], [0, 1, 5, 4, 2], [1, 2, 6, 5, 3], [2, 3, 7, 6, 4], [3, 0, 4, 7, 5]]; // 아래·위·앞·오른·뒤·왼
function torsoBox(g, b, t, w0, d0, w1, d1, col, ow, s, tw = 0, lean = 0) {
  // b, t: 아래·위 중심 관절
  const P8 = [[d0, -w0, b], [d0, w0, b], [-d0, w0, b], [-d0, -w0, b], [d1, -w1, t], [d1, w1, t], [-d1, w1, t], [-d1, -w1, t]];
  for (let i = 0; i < 8; i++) {
    const [ff, rr, j] = P8[i];
    let f = ff, r = rr;
    const tt = i >= 4 ? tw : tw * 0.4;
    if (tt) { const c = Math.cos(tt), sn = Math.sin(tt); const nf = f * c - r * sn; r = f * sn + r * c; f = nf; }
    const F = j.f + f, R = j.r + r, Z = j.z + (i >= 4 ? -f * Math.sin(lean) * 0.3 : 0);
    BXY[i * 2] = X(F, R); BXY[i * 2 + 1] = Y(F, R, Z);
  }
  // 외곽선: 볼록 껍질 대신 모든 앞면을 굵게 칠한 뒤 색을 칠한다
  const shadeK = [0.55, 1.12, 1.0, 0.82, 0.7, 0.9];
  const vis = [];
  for (let fi = 0; fi < 6; fi++) {
    const F = FACES[fi];
    const ax = BXY[F[0] * 2], ay = BXY[F[0] * 2 + 1], bx = BXY[F[1] * 2], by = BXY[F[1] * 2 + 1], cx = BXY[F[2] * 2], cy = BXY[F[2] * 2 + 1];
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    // 면의 방향은 정점 순서로 정했다: 시계 방향(화면)이면 보인다
    const facing = fi === 0 ? -cross : cross;
    if (facing < 0) vis.push(fi);
  }
  if (ow > 0) {
    g.strokeStyle = OUT; g.lineWidth = ow; g.lineJoin = 'round';
    for (const fi of vis) { const F = FACES[fi]; g.beginPath(); g.moveTo(BXY[F[0] * 2], BXY[F[0] * 2 + 1]); for (let k = 1; k < 4; k++) g.lineTo(BXY[F[k] * 2], BXY[F[k] * 2 + 1]); g.closePath(); g.stroke(); }
  }
  for (const fi of vis) {
    const F = FACES[fi];
    g.beginPath(); g.moveTo(BXY[F[0] * 2], BXY[F[0] * 2 + 1]);
    for (let k = 1; k < 4; k++) g.lineTo(BXY[F[k] * 2], BXY[F[k] * 2 + 1]);
    g.closePath(); g.fillStyle = shade(col, shadeK[fi]); g.fill();
  }
}

// ───────── 사람형 ─────────
const P0 = { ...POSE };
function humanJoints(look, p) {
  const H = look.h || 1, Bk = look.bulk || 1, j = JS;
  const legS = look.legs ?? 1;
  const hipZ = (30 * legS + 1) * H + p.bob - p.crouch;
  j.pel.set(0, 0, hipZ);
  const torsoL = 18 * H * (look.torsoL || 1);
  j.chest.set(0, 0, hipZ + torsoL);
  j.neck.set(0, 0, hipZ + torsoL + 4 * H);
  const hr = 6.3 * H * (look.headS || 1);
  j.head.set(0.5 * H, 0, hipZ + torsoL + 4 * H + hr * 0.95);
  const sw = 9.5 * H * Bk * (look.shoulders || 1), hw = 4.6 * H * Bk;
  j.shL.set(0, -sw, hipZ + torsoL - 1.5 * H); j.shR.set(0, sw, hipZ + torsoL - 1.5 * H);
  // 상체 숙이기·비틀기
  for (const n of ['chest', 'neck', 'head', 'shL', 'shR']) { twistPt(j[n], p.twist); leanPt(j[n], p.lean, hipZ); }
  if (p.headP) { const hd = j.head; hd.f += Math.sin(p.headP) * hr * 0.6; hd.z -= (1 - Math.cos(p.headP)) * hr * 0.4; }
  const ua = 13 * H * (look.arms || 1), fa = 12 * H * (look.arms || 1);
  // 팔: 상체 회전을 따라간다
  const tw = p.twist, ln = p.lean;
  const armDir = (out, from, len, pitch, ab, side) => {
    limb(out, { f: 0, r: 0, z: 0 }, len, pitch, ab, side);
    twistPt(out, tw); leanPt(out, ln, 0);
    out.f += from.f; out.r += from.r; out.z += from.z;
  };
  armDir(j.elL, j.shL, ua, p.shL, p.abL, -1); armDir(j.haL, j.elL, fa, p.shL + p.elL, p.abL * 0.6, -1);
  armDir(j.elR, j.shR, ua, p.shR, p.abR, 1); armDir(j.haR, j.elR, fa, p.shR + p.elR, p.abR * 0.6, 1);
  // 무기 끝
  const wl = look.wlen || 0;
  if (wl) {
    if (look.wtype === 'staff') {
      // 지팡이는 손에서 위아래로 길게
      const pitch = p.shR + p.elR + p.wrist;
      armDir(JS.wTip, j.haR, wl * 0.7, pitch + 1.6, 0, 1);
      armDir(JS.wMid, j.haR, wl * 0.3, pitch + 1.6 + PI, 0, 1);
    } else armDir(JS.wTip, j.haR, wl, p.shR + p.elR + p.wrist, p.abR * 0.3, 1);
  }
  // 다리
  const th = 15 * H * legS, sh = 14 * H * legS;
  j.hiL.set(0, -hw, hipZ - 1); j.hiR.set(0, hw, hipZ - 1);
  limb(j.knL, j.hiL, th, p.hipL, 0.05, -1); limb(j.anL, j.knL, sh, p.hipL - p.kneeL, 0.02, -1);
  limb(j.knR, j.hiR, th, p.hipR, 0.05, 1); limb(j.anR, j.knR, sh, p.hipR - p.kneeR, 0.02, 1);
  j.toL.set(j.anL.f + 5 * H, j.anL.r, Math.max(0, j.anL.z - 1)); j.toR.set(j.anR.f + 5 * H, j.anR.r, Math.max(0, j.anR.z - 1));
  // 바닥 아래로 꺼지지 않게: 가장 낮은 발을 바닥에
  if (!look.fly) {
    const low = Math.min(j.anL.z, j.anR.z) - 1;
    if (low > 0 || low < 0) for (const n of JN) JS[n].z -= low;
  }
  // 날개·꼬리
  if (look.wings) {
    const wz = j.chest.z - 2, ws = look.wingS || 1;
    j.wingL.set(-6 * H, -14 * H * ws, wz + 14 * H * ws + p.wing * 10 * H); j.wingR.set(-6 * H, 14 * H * ws, wz + 14 * H * ws + p.wing * 10 * H);
    j.wingL2.set(-10 * H, -26 * H * ws, wz - 6 * H + p.wing * 16 * H); j.wingR2.set(-10 * H, 26 * H * ws, wz - 6 * H + p.wing * 16 * H);
    for (const n of ['wingL', 'wingR', 'wingL2', 'wingR2']) { twistPt(j[n], p.twist * 0.5); leanPt(j[n], p.lean, hipZ); }
  }
  if (look.tail) { j.tail.set(-10 * H, 0, hipZ - 4 * H); j.tail2.set(-18 * H, 0, hipZ - 14 * H + Math.sin(p.bob) * 2); }
  // 쓰러지기
  if (p.fall) for (const n of JN) fallPt(JS[n], p.fall, p.fallDir);
  return hr;
}

function drawHuman(g, a, look, p, s, time) {
  const hr = humanJoints(look, p) * s;
  const j = JS, ow = Math.max(1, 1.5 * s * (look.h || 1) * 0.9);
  const H = look.h || 1;
  parts.length = 0; pcount = 0;
  const skel = look.skel;
  const thick = skel ? 0.55 : 1;
  const legW = 6.2 * H * (look.legW || 1) * thick * s, armW = 5 * H * (look.armW || 1) * thick * s;
  const cl = look.cols;
  // 다리(바지·장화)
  for (const sd of ['L', 'R']) {
    const hi = j['hi' + sd], kn = j['kn' + sd], an = j['an' + sd], to = j['to' + sd];
    part(D(hi.f, hi.r) * 0.5 + D(kn.f, kn.r) * 0.5 - 0.5, 'limb', hi, kn, legW * 1.1, cl.legs);
    part(D(kn.f, kn.r) * 0.5 + D(an.f, an.r) * 0.5 - 0.4, 'limb', kn, an, legW * 0.9, cl.boots);
    if (!skel) part(D(an.f, an.r) * 0.5 + D(to.f, to.r) * 0.5 - 0.3, 'limb', an, to, legW * 0.75, cl.boots);
    else part(D(an.f, an.r) - 0.3, 'limb', an, to, legW * 0.8, cl.boots);
  }
  // 몸통
  const dp = D(j.pel.f, j.pel.r), dc = D(j.chest.f, j.chest.r);
  part((dp + dc) / 2, 'torso', j.pel, j.chest, 0, cl.torso);
  if (look.robe) part((dp + dc) / 2 + 0.2, 'robe', j.pel, j.chest, 0, cl.robe);
  if (look.cape) part((dp + dc) / 2 - 6, 'cape', j.shL, j.shR, 0, cl.cape);
  if (look.wings) { part(dc - 8, 'wing', j.shL, j.wingL, 0, cl.wing, j.wingL2); part(dc - 8, 'wing', j.shR, j.wingR, 0, cl.wing, j.wingR2); }
  if (look.tail) part(dp - 6, 'tail', j.pel, j.tail, 0, cl.skin, j.tail2);
  // 팔
  for (const sd of ['L', 'R']) {
    const sh = j['sh' + sd], el = j['el' + sd], ha = j['ha' + sd];
    part(D(sh.f, sh.r) * 0.5 + D(el.f, el.r) * 0.5 + 0.3, 'limb', sh, el, armW * 1.05, cl.arms);
    part(D(el.f, el.r) * 0.5 + D(ha.f, ha.r) * 0.5 + 0.4, 'limb', el, ha, armW * 0.9, cl.fore);
    part(D(ha.f, ha.r) + 0.5, 'hand', ha, null, armW * 0.62, cl.hands);
    if (look.pads && !skel) part(D(sh.f, sh.r) + 0.6, 'pad', sh, null, armW * 1.15, cl.pad);
  }
  // 무기·방패
  if (look.wlen) {
    const tip = j.wTip;
    part(Math.max(D(j.haR.f, j.haR.r), D(tip.f, tip.r)) + 0.7, 'weapon', j.haR, tip, 0, look.wcol, look.wtype === 'staff' ? j.wMid : null);
  }
  if (look.wtype === 'bow') part(D(j.haL.f, j.haL.r) + 0.8, 'bow', j.haL, j.haR, 0, look.wcol, p.bow);
  if (look.shield) {
    const el = j.elL, ha = j.haL;
    part(D(ha.f, ha.r) + 1.2, 'shield', el, ha, 0, look.shield);
  }
  // 머리
  part(D(j.head.f, j.head.r) + 0.9, 'head', j.head, j.neck, hr, cl.skin);
  parts.sort((x, y) => x.d - y.d);
  const flash = a.flash > 0;
  for (const q of parts) drawPart(g, q, look, ow, s, flash, time, a);
}

function col(c, flash) { return flash ? shade(c, 2.2) : c; }

function drawPart(g, q, look, ow, s, flash, time, a) {
  const A = q.a, B = q.b;
  const H = look.h || 1;
  switch (q.k) {
    case 'limb': {
      const x1 = X(A.f, A.r), y1 = Y(A.f, A.r, A.z), x2 = X(B.f, B.r), y2 = Y(B.f, B.r, B.z);
      g.lineCap = 'round';
      stroke(g, x1, y1, x2, y2, q.w, col(q.c, flash), ow);
      if (HL && q.w > 3.2 * s && !look.skel) { // 빛 받는 쪽 밝게
        g.lineWidth = q.w * 0.35; g.strokeStyle = shade(col(q.c, flash), 1.35);
        g.beginPath(); g.moveTo(x1 - q.w * 0.18, y1 - q.w * 0.12); g.lineTo(x2 - q.w * 0.18, y2 - q.w * 0.12); g.stroke();
      }
      break;
    }
    case 'hand': disc(g, X(A.f, A.r), Y(A.f, A.r, A.z), q.w, col(q.c, flash), ow); break;
    case 'pad': {
      const x = X(A.f, A.r), y = Y(A.f, A.r, A.z + 1.5);
      g.beginPath(); g.ellipse(x, y, q.w * 1.1, q.w * 0.75, 0, 0, PI * 2);
      g.fillStyle = OUT; g.fill();
      g.beginPath(); g.ellipse(x, y - ow * 0.2, q.w * 1.1 - ow * 0.6, q.w * 0.75 - ow * 0.6, 0, 0, PI * 2);
      g.fillStyle = col(q.c, flash); g.fill();
      g.beginPath(); g.ellipse(x - q.w * 0.3, y - q.w * 0.3, q.w * 0.4, q.w * 0.22, 0, 0, PI * 2); g.fillStyle = shade(q.c, 1.5); g.fill();
      break;
    }
    case 'torso': {
      const Bk = look.bulk || 1;
      const skel = look.skel;
      if (skel) {
        // 척추와 갈비뼈
        g.lineCap = 'round';
        stroke(g, X(A.f, A.r), Y(A.f, A.r, A.z), X(B.f, B.r), Y(B.f, B.r, B.z), 3.2 * s * H, col(q.c, flash), ow);
        for (let i = 0; i < 4; i++) {
          const t = 0.35 + i * 0.17, f = A.f + (B.f - A.f) * t, r = A.r + (B.r - A.r) * t, z = A.z + (B.z - A.z) * t;
          const w = (7 - i * 0.3) * H;
          const fx = Math.cos(0), cx = X(f + 2 * H, r), cy = Y(f + 2 * H, r, z);
          g.beginPath(); g.moveTo(X(f, r - w), Y(f, r - w, z)); g.quadraticCurveTo(cx, cy + 1 * s, X(f, r + w), Y(f, r + w, z));
          g.strokeStyle = OUT; g.lineWidth = 2.6 * s * H; g.stroke(); g.strokeStyle = col(q.c, flash); g.lineWidth = 1.5 * s * H; g.stroke();
        }
        // 골반
        disc(g, X(A.f, A.r), Y(A.f, A.r, A.z), 3.4 * s * H, col(q.c, flash), ow);
        break;
      }
      const w0 = 5.2 * H * Bk * (look.waist || 1), w1 = 8.6 * H * Bk * (look.shoulders || 1), d0 = 3.8 * H * Bk * (look.belly || 1), d1 = 4.2 * H * Bk;
      torsoBox(g, A, B, w0, d0, w1, d1, col(q.c, flash), ow, s, 0, 0);
      // 허리띠
      if (look.cols.belt) {
        const z = A.z + 2 * H;
        g.lineCap = 'butt';
        stroke(g, X(A.f + d0, A.r - w0), Y(A.f + d0, A.r - w0, z), X(A.f + d0, A.r + w0), Y(A.f + d0, A.r + w0, z), 2.2 * s * H, col(look.cols.belt, flash), 0);
      }
      if (look.belly && look.belly > 1.2) {
        const cx = X(A.f + d0 * 1.1, A.r), cy = Y(A.f + d0 * 1.1, A.r, A.z + 6 * H);
        disc(g, cx, cy, 7 * s * H * (look.belly - 0.5), col(shade(q.c, 1.08), flash), ow);
      }
      break;
    }
    case 'robe': {
      // 골반에서 발목까지 퍼지는 치마
      const w = 6 * H * (look.bulk || 1), w2 = 9 * H * (look.bulk || 1) * (look.robeFlare || 1), zb = Math.max(1, A.z - 27 * H);
      const pts = [];
      const N = 8;
      for (let i = 0; i < N; i++) { const an = (i / N) * PI * 2; pts.push([Math.cos(an) * w * 0.8, Math.sin(an) * w, A.z + 1]); }
      for (let i = 0; i < N; i++) { const an = (i / N) * PI * 2 + Math.sin(time * 2 + i) * 0.05; pts.push([Math.cos(an) * w2 * 0.8, Math.sin(an) * w2, zb]); }
      // 실루엣: 위 원과 아래 원의 볼록 껍질
      const sp = pts.map(([f, r, z]) => [X(A.f + f, A.r + r), Y(A.f + f, A.r + r, z)]);
      const hull = convexHull(sp);
      const arr = []; for (const [x, y] of hull) arr.push(x, y);
      polyPts(g, arr, col(q.c, flash), ow);
      // 주름
      g.strokeStyle = shade(q.c, 0.75); g.lineWidth = 1 * s;
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.moveTo(X(A.f + w * 0.8, A.r + i * w * 0.4), Y(A.f + w * 0.8, A.r + i * w * 0.4, A.z - 2));
        g.lineTo(X(A.f + w2 * 0.8, A.r + i * w2 * 0.5), Y(A.f + w2 * 0.8, A.r + i * w2 * 0.5, zb + 2)); g.stroke();
      }
      break;
    }
    case 'cape': {
      const zb = Math.max(2, A.z - 34 * H);
      const sway = Math.sin(time * 2 + (a.id || 0)) * 2 - (a.moving ? 5 : 0);
      const pts = [X(A.f - 2, A.r), Y(A.f - 2, A.r, A.z + 1), X(B.f - 2, B.r), Y(B.f - 2, B.r, B.z + 1),
        X(B.f - 6 + sway, B.r * 1.25), Y(B.f - 6 + sway, B.r * 1.25, zb), X(A.f - 6 + sway, A.r * 1.25), Y(A.f - 6 + sway, A.r * 1.25, zb)];
      polyPts(g, pts, col(q.c, flash), ow);
      break;
    }
    case 'wing': {
      const C = q.x;
      const x0 = X(A.f, A.r), y0 = Y(A.f, A.r, A.z), x1 = X(B.f, B.r), y1 = Y(B.f, B.r, B.z), x2 = X(C.f, C.r), y2 = Y(C.f, C.r, C.z);
      const xm = X((A.f + C.f) / 2, (A.r + C.r) / 2), ym = Y((A.f + C.f) / 2, (A.r + C.r) / 2, A.z - 8 * H);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2);
      g.quadraticCurveTo((x2 + xm) / 2, (y2 + ym) / 2 - 2 * s, xm, ym); g.closePath();
      g.strokeStyle = OUT; g.lineWidth = ow; g.stroke();
      g.fillStyle = col(q.c, flash); g.fill();
      g.strokeStyle = shade(q.c, 0.6); g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x1, y1); g.lineTo(xm, ym); g.moveTo(x1, y1); g.lineTo((x2 + xm) / 2, (y2 + ym) / 2); g.stroke();
      break;
    }
    case 'tail': {
      const C = q.x;
      g.beginPath(); g.moveTo(X(A.f, A.r), Y(A.f, A.r, A.z)); g.quadraticCurveTo(X(B.f, B.r), Y(B.f, B.r, B.z), X(C.f, C.r), Y(C.f, C.r, C.z));
      g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 3.4 * s * H + ow; g.stroke(); g.strokeStyle = col(q.c, flash); g.lineWidth = 3.4 * s * H; g.stroke();
      break;
    }
    case 'weapon': drawWeapon(g, look, A, B, q.x, ow, s, flash); break;
    case 'bow': drawBow(g, look, A, B, q.x, ow, s); break;
    case 'shield': drawShield(g, look, A, B, ow, s, flash); break;
    case 'head': drawHead(g, look, A, B, q.w, ow, s, flash, time, a); break;
  }
}

function convexHull(P) {
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

function drawWeapon(g, look, A, B, M, ow, s, flash) {
  const x1 = X(A.f, A.r), y1 = Y(A.f, A.r, A.z), x2 = X(B.f, B.r), y2 = Y(B.f, B.r, B.z);
  const t = look.wtype, H = look.h || 1, c = look.wcol || '#c8ccd2';
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  g.lineCap = 'round';
  if (t === 'staff') {
    const xm = X(M.f, M.r), ym = Y(M.f, M.r, M.z);
    stroke(g, xm, ym, x2, y2, 2.6 * s * H, col(look.wood || '#6b4a2a', flash), ow);
    disc(g, x2, y2, 3.2 * s * H, look.gem || '#7ad0ff', ow);
    return;
  }
  // 손잡이 부분
  const hx = x1 + dx * 0.16, hy = y1 + dy * 0.16;
  if (t === 'sword' || t === 'dagger' || t === 'cleaver' || t === 'scythe' || t === 'spear') {
    if (t === 'spear') {
      stroke(g, x1 - dx * 0.25, y1 - dy * 0.25, x2 - dx * 0.12, y2 - dy * 0.12, 2.2 * s * H, col(look.wood || '#6b4a2a', flash), ow);
      polyPts(g, [x2, y2, x2 - dx * 0.16 + nx * 2.4 * s, y2 - dy * 0.16 + ny * 2.4 * s, x2 - dx * 0.16 - nx * 2.4 * s, y2 - dy * 0.16 - ny * 2.4 * s], col(c, flash), ow * 0.8);
      return;
    }
    if (t === 'scythe') {
      stroke(g, x1 - dx * 0.3, y1 - dy * 0.3, x2, y2, 2.2 * s * H, col(look.wood || '#4a3a2a', flash), ow);
      polyPts(g, [x2, y2, x2 + nx * 14 * s - dx * 0.1, y2 + ny * 14 * s - dy * 0.1, x2 - dx * 0.12, y2 - dy * 0.12], col(c, flash), ow * 0.8);
      return;
    }
    const bw = (t === 'cleaver' ? 5 : t === 'dagger' ? 2 : 2.6) * s * H * (look.wwide || 1);
    stroke(g, x1, y1, hx, hy, 2 * s * H, col('#3a2a1a', flash), ow);
    // 날
    polyPts(g, [hx + nx * bw, hy + ny * bw, x2 + nx * bw * (t === 'cleaver' ? 1.3 : 0.4), y2 + ny * bw * (t === 'cleaver' ? 1.3 : 0.4), x2 + dx * 0.04, y2 + dy * 0.04, hx - nx * bw * 0.6, hy - ny * bw * 0.6], col(c, flash), ow * 0.8);
    g.strokeStyle = shade(c, 1.45); g.lineWidth = Math.max(0.8, bw * 0.3);
    g.beginPath(); g.moveTo(hx + nx * bw * 0.4, hy + ny * bw * 0.4); g.lineTo(x2, y2); g.stroke();
    // 코등이
    if (t !== 'cleaver') stroke(g, hx + nx * bw * 2.2, hy + ny * bw * 2.2, hx - nx * bw * 2.2, hy - ny * bw * 2.2, 1.8 * s * H, col(look.guard || '#a08040', flash), ow * 0.6);
    if (look.wglow) { g.globalAlpha = 0.5; g.strokeStyle = look.wglow; g.lineWidth = bw * 1.6; g.beginPath(); g.moveTo(hx, hy); g.lineTo(x2, y2); g.stroke(); g.globalAlpha = 1; }
  } else if (t === 'axe' || t === 'mace' || t === 'club' || t === 'hammer' || t === 'flail') {
    stroke(g, x1 - dx * 0.1, y1 - dy * 0.1, x2, y2, 2.4 * s * H, col(look.wood || '#6b4a2a', flash), ow);
    if (t === 'axe') {
      const ax = x2 - dx * 0.15, ay = y2 - dy * 0.15, w = 6.5 * s * H * (look.wwide || 1);
      polyPts(g, [x2, y2, x2 + nx * w, y2 + ny * w + dy * 0.05, ax + nx * w * 1.05, ay + ny * w * 1.05, ax, ay], col(c, flash), ow * 0.8);
      g.strokeStyle = shade(c, 1.5); g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x2 + nx * w, y2 + ny * w); g.lineTo(ax + nx * w * 1.05, ay + ny * w * 1.05); g.stroke();
    } else if (t === 'hammer') {
      const w = 5 * s * H;
      polyPts(g, [x2 + nx * w, y2 + ny * w, x2 - nx * w, y2 - ny * w, x2 - nx * w - dx * 0.18, y2 - ny * w - dy * 0.18, x2 + nx * w - dx * 0.18, y2 + ny * w - dy * 0.18], col(c, flash), ow * 0.8);
    } else {
      disc(g, x2, y2, (t === 'club' ? 3.6 : 4.2) * s * H, col(c, flash), ow);
      if (t === 'mace' || t === 'flail') for (let i = 0; i < 6; i++) { const an = i * PI / 3; stroke(g, x2, y2, x2 + Math.cos(an) * 6 * s * H, y2 + Math.sin(an) * 6 * s * H, 1.4 * s, col(c, flash), 0); }
    }
  } else if (t === 'claw') {
    for (let i = -1; i <= 1; i++) stroke(g, x1, y1, x1 + dx * 0.4 + nx * i * 3 * s, y1 + dy * 0.4 + ny * i * 3 * s, 1.2 * s, col(c, flash), ow * 0.5);
  }
}

function drawBow(g, look, A, B, pull, ow, s) {
  // 왼손에 쥔 활: 몸 앞뒤 축에 수직, 위아래로 휜다
  const H = look.h || 1, L = 22 * H;
  const top = { f: A.f - 4 * H, r: A.r, z: A.z + L }, bot = { f: A.f - 4 * H, r: A.r, z: A.z - L * 0.9 };
  const xt = X(top.f, top.r), yt = Y(top.f, top.r, top.z), xb = X(bot.f, bot.r), yb = Y(bot.f, bot.r, bot.z), xh = X(A.f + 3 * H, A.r), yh = Y(A.f + 3 * H, A.r, A.z);
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(xt, yt); g.quadraticCurveTo(xh * 2 - (xt + xb) / 2, yh * 2 - (yt + yb) / 2, xb, yb);
  g.strokeStyle = OUT; g.lineWidth = 2.6 * s * H + ow; g.stroke(); g.strokeStyle = look.wcol || '#7a5530'; g.lineWidth = 2.6 * s * H; g.stroke();
  // 시위: 당길 때는 오른손까지
  const sx = pull > 0.05 ? X(B.f, B.r) : (xt + xb) / 2, sy = pull > 0.05 ? Y(B.f, B.r, B.z) : (yt + yb) / 2;
  g.strokeStyle = 'rgba(230,220,200,0.8)'; g.lineWidth = 0.8 * s;
  g.beginPath(); g.moveTo(xt, yt); g.lineTo(sx, sy); g.lineTo(xb, yb); g.stroke();
  if (pull > 0.2) { g.strokeStyle = '#d8d0c0'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(sx, sy); g.lineTo(xh + (xh - sx) * 0.3, yh + (yh - sy) * 0.3); g.stroke(); }
}

function drawShield(g, look, A, B, ow, s, flash) {
  const sh = look.shield, H = look.h || 1;
  const cf = (A.f + B.f) / 2 + 2 * H, cr = (A.r + B.r) / 2 - 2.5 * H, cz = (A.z + B.z) / 2;
  const R = (sh.size || 8.5) * H;
  // 몸 바깥쪽을 향한 원판(f-z 평면)
  const pts = [];
  const N = sh.type === 'kite' ? 5 : sh.type === 'tower' ? 4 : 10;
  for (let i = 0; i < N; i++) {
    const an = (i / N) * PI * 2 + (sh.type === 'tower' ? PI / 4 : sh.type === 'kite' ? -PI / 2 : 0);
    let ff = Math.cos(an) * R, zz = Math.sin(an) * R;
    if (sh.type === 'kite' && zz < -R * 0.5) zz *= 1.6;
    if (sh.type === 'tower') { ff *= 0.85; zz *= 1.5; }
    pts.push(X(cf + ff * 0.85, cr), Y(cf + ff * 0.85, cr, cz + zz));
  }
  polyPts(g, pts, col(sh.color, flash), ow);
  // 테두리와 문양
  g.strokeStyle = shade(sh.rim || '#a89060', 1); g.lineWidth = 1.3 * s;
  g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.stroke();
  disc(g, X(cf, cr - 1), Y(cf, cr - 1, cz), 1.6 * s * H, shade(sh.rim || '#a89060', 1.2), 0);
}

function drawHead(g, look, A, N, hr, ow, s, flash, time, a) {
  const x = X(A.f, A.r), y = Y(A.f, A.r, A.z), H = look.h || 1;
  const hd = look.head || 'human';
  const skin = col(look.cols.skin, flash);
  // 얼굴이 향하는 화면 방향(코 위치)
  const fx = X(A.f + hr / s * 0.8, A.r) - x, fy = Y(A.f + hr / s * 0.8, A.r, A.z) - y;
  const toward = PR.df > 0.3; // 카메라 쪽을 보는가
  if (hd === 'skull') {
    disc(g, x, y, hr * 0.95, skin, ow);
    g.fillStyle = '#120c08';
    if (PR.df > -0.4) {
      const ex = fx * 0.55, ey = fy * 0.55;
      const px = -fy * 0.35, py = fx * 0.35;
      g.beginPath(); g.arc(x + ex + px, y + ey + py, hr * 0.24, 0, PI * 2); g.arc(x + ex - px, y + ey - py, hr * 0.24, 0, PI * 2); g.fill();
      if (look.glowEyes) { g.fillStyle = look.glowEyes; g.beginPath(); g.arc(x + ex + px, y + ey + py, hr * 0.1, 0, PI * 2); g.arc(x + ex - px, y + ey - py, hr * 0.1, 0, PI * 2); g.fill(); }
      g.fillStyle = shade(look.cols.skin, 0.8); g.fillRect(x + fx * 0.6 - hr * 0.3, y + hr * 0.45, hr * 0.6, hr * 0.35);
    }
  } else if (hd === 'goat' || hd === 'beast') {
    // 길쭉한 주둥이
    disc(g, x, y, hr * 0.9, skin, ow);
    const mx = x + fx * 1.05, my = y + fy * 1.05 + hr * 0.25;
    g.lineCap = 'round'; stroke(g, x, y + hr * 0.1, mx, my, hr * 1.0, skin, ow);
    disc(g, mx, my, hr * 0.42, shade(look.cols.skin, 0.75), 0);
    if (PR.df > -0.3) { g.fillStyle = look.glowEyes || '#ffcc33'; g.beginPath(); g.arc(x + fx * 0.4 - fy * 0.3, y + fy * 0.4 + fx * 0.3 - hr * 0.2, hr * 0.13, 0, PI * 2); g.arc(x + fx * 0.4 + fy * 0.3, y + fy * 0.4 - fx * 0.3 - hr * 0.2, hr * 0.13, 0, PI * 2); g.fill(); }
  } else {
    disc(g, x, y, hr, skin, ow);
    // 머리카락
    if (look.cols.hair && !look.helm) {
      g.fillStyle = col(look.cols.hair, flash);
      g.beginPath(); g.arc(x - fx * 0.25, y - fy * 0.25 - hr * 0.15, hr * 0.92, 0, PI * 2); g.fill();
      if (look.ponytail) { g.lineCap = 'round'; stroke(g, x - fx * 0.8, y - fy * 0.8, x - fx * 1.3, y - fy * 1.3 + hr * 1.3, hr * 0.5, col(look.cols.hair, flash), ow * 0.6); }
      g.fillStyle = skin; g.beginPath(); g.arc(x + fx * 0.3, y + fy * 0.3 + hr * 0.08, hr * 0.68, 0, PI * 2); g.fill();
    }
    if (look.beard) { g.fillStyle = col(look.beard, flash); g.beginPath(); g.ellipse(x + fx * 0.5, y + fy * 0.5 + hr * 0.55, hr * 0.5, hr * 0.55, 0, 0, PI * 2); g.fill(); }
    // 눈
    if (PR.df > -0.2 || Math.abs(fx) > hr * 0.3) {
      const ex = x + fx * 0.62, ey = y + fy * 0.62 - hr * 0.05;
      const px = -fy * 0.3, py = fx * 0.3;
      g.fillStyle = look.glowEyes || '#1a120c';
      g.beginPath(); g.arc(ex + px, ey + py, hr * (look.glowEyes ? 0.16 : 0.12), 0, PI * 2); g.arc(ex - px, ey - py, hr * (look.glowEyes ? 0.16 : 0.12), 0, PI * 2); g.fill();
    }
    if (look.jaw && a.anim?.name === 'attack') { g.fillStyle = '#300'; g.beginPath(); g.ellipse(x + fx * 0.6, y + fy * 0.6 + hr * 0.45, hr * 0.3, hr * 0.2, 0, 0, PI * 2); g.fill(); }
  }
  // 투구·두건·뿔·왕관
  const hm = look.helm;
  if (hm) {
    const hc = col(hm.color || '#8a8a90', flash);
    if (hm.type === 'hood') {
      g.fillStyle = OUT; g.beginPath(); g.arc(x - fx * 0.15, y - fy * 0.15 - hr * 0.1, hr * 1.18 + ow / 2, 0, PI * 2); g.fill();
      g.fillStyle = hc; g.beginPath(); g.arc(x - fx * 0.15, y - fy * 0.15 - hr * 0.1, hr * 1.18, 0, PI * 2); g.fill();
      if (PR.df > -0.4) { g.fillStyle = '#0c0806'; g.beginPath(); g.ellipse(x + fx * 0.35, y + fy * 0.35 + hr * 0.05, hr * 0.72, hr * 0.78, 0, 0, PI * 2); g.fill();
        if (look.glowEyes) { g.fillStyle = look.glowEyes; g.beginPath(); g.arc(x + fx * 0.55 - fy * 0.28, y + fy * 0.55 + fx * 0.28, hr * 0.13, 0, PI * 2); g.arc(x + fx * 0.55 + fy * 0.28, y + fy * 0.55 - fx * 0.28, hr * 0.13, 0, PI * 2); g.fill(); } }
    } else if (hm.type === 'cap') {
      g.fillStyle = hc; g.beginPath(); g.arc(x - fx * 0.1, y - fy * 0.1 - hr * 0.2, hr * 0.98, PI * 1.02, PI * 1.98); g.closePath(); g.fill();
      g.strokeStyle = OUT; g.lineWidth = ow * 0.7; g.stroke();
    } else if (hm.type === 'helm' || hm.type === 'full' || hm.type === 'great') {
      g.fillStyle = OUT; g.beginPath(); g.arc(x, y - hr * 0.08, hr * 1.08 + ow / 2, 0, PI * 2); g.fill();
      g.fillStyle = hc; g.beginPath(); g.arc(x, y - hr * 0.08, hr * 1.08, 0, PI * 2); g.fill();
      g.fillStyle = shade(hm.color || '#8a8a90', 1.5); g.beginPath(); g.arc(x - hr * 0.35, y - hr * 0.5, hr * 0.32, 0, PI * 2); g.fill();
      if (PR.df > -0.4) {
        if (hm.type === 'helm') { g.fillStyle = skin; g.beginPath(); g.ellipse(x + fx * 0.55, y + fy * 0.55 + hr * 0.2, hr * 0.42, hr * 0.48, 0, 0, PI * 2); g.fill(); }
        else { g.strokeStyle = '#0a0806'; g.lineWidth = hr * 0.2; g.beginPath(); g.moveTo(x + fx * 0.6 - fy * 0.5, y + fy * 0.6 + fx * 0.5); g.lineTo(x + fx * 0.6 + fy * 0.5, y + fy * 0.6 - fx * 0.5); g.stroke();
          if (hm.type === 'great') { g.beginPath(); g.moveTo(x + fx * 0.62, y + fy * 0.62 - hr * 0.2); g.lineTo(x + fx * 0.62, y + fy * 0.62 + hr * 0.6); g.stroke(); } }
      }
      if (hm.plume) { g.lineCap = 'round'; stroke(g, x, y - hr, x - fx * 1.1, y - fy * 1.1 - hr * 1.5, hr * 0.4, hm.plume, 0); }
    } else if (hm.type === 'crown') {
      const cy = y - hr * 0.75, w = hr * 0.95;
      const pts = [x - w, cy + hr * 0.25, x - w, cy - hr * 0.35, x - w * 0.5, cy - hr * 0.05, x, cy - hr * 0.55, x + w * 0.5, cy - hr * 0.05, x + w, cy - hr * 0.35, x + w, cy + hr * 0.25];
      polyPts(g, pts, hm.color || '#d8b040', ow * 0.7);
      disc(g, x, cy, hr * 0.14, '#c02020', 0);
    } else if (hm.type === 'skullcap') {
      g.fillStyle = hc; g.beginPath(); g.arc(x, y - hr * 0.15, hr * 1.02, PI, PI * 2); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = ow * 0.7; g.stroke();
    }
  }
  if (look.horns) {
    const hc = look.hornCol || '#d8cdb0', hs = look.horns;
    g.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const bx = x + (-fy) * 0.5 * sd + 0, by = y - hr * 0.55 + fx * 0.5 * sd * 0.5;
      const tx = bx + (-fy) * 0.6 * sd * hs - fx * 0.3 * hs, ty = by - hr * 1.1 * hs;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + (-fy) * 1.0 * sd * hs, by - hr * 0.2, tx, ty);
      g.strokeStyle = OUT; g.lineWidth = hr * 0.42 + ow; g.stroke(); g.strokeStyle = hc; g.lineWidth = hr * 0.42; g.stroke();
    }
  }
}

// ───────── 네발 짐승 ─────────
function drawQuad(g, a, look, p, s, time) {
  const H = look.h || 1, Bk = look.bulk || 1;
  const ow = Math.max(1, 1.4 * s * H);
  const moving = a.moving, ph = a.walkPh || 0;
  const A = a.anim || { name: 'idle', t: 0, dur: 1 };
  const u = A.dur ? Math.min(1, A.t / A.dur) : 0;
  let lunge = 0, rear = 0;
  if (A.name === 'attack') { lunge = Math.sin(seg(u, 0.25, 0.7) * PI) * 8 * H; rear = Math.sin(seg(u, 0, 0.45) * PI) * 4 * H; }
  const dead = A.name === 'death' || A.name === 'dead';
  const fallK = dead ? (A.name === 'dead' ? 1 : ease(seg(u, 0, 0.8))) : 0;
  const bodyZ = (18 * H + (moving ? Math.abs(Math.sin(ph)) * 1.5 : 0) + rear) * (1 - fallK * 0.7);
  const len = 14 * H * (look.long || 1), w = 6 * H * Bk;
  const front = { f: len + lunge, r: 0, z: bodyZ + 2 * H }, back = { f: -len, r: 0, z: bodyZ };
  parts.length = 0; pcount = 0;
  // 다리 네 개
  const legs = [[len * 0.75, -w, 0], [len * 0.75, w, PI], [-len * 0.7, -w, PI], [-len * 0.7, w, 0]];
  const cl = look.cols;
  for (const [lf, lr, off] of legs) {
    const sw = moving ? Math.sin(ph + off) * 0.6 : 0;
    const hip = { f: lf + (lf > 0 ? lunge : 0), r: lr * (1 + fallK * 0.8), z: bodyZ - 2 * H };
    const kn = { f: hip.f + Math.sin(sw) * 9 * H, r: lr * (1.1 + fallK), z: hip.z - Math.cos(sw) * 9 * H * (1 - fallK * 0.6) };
    const ft = { f: kn.f + Math.sin(sw * 0.5 - 0.15) * 9 * H, r: lr * (1.1 + fallK * 1.5), z: Math.max(0, kn.z - 9 * H * (1 - fallK * 0.5)) };
    part(D(hip.f, hip.r) * 0.5 + D(kn.f, kn.r) * 0.5, 'limb', hip, kn, 4.6 * H * s * (look.legW || 1), cl.legs);
    part(D(kn.f, kn.r) * 0.5 + D(ft.f, ft.r) * 0.5, 'limb', kn, ft, 3.4 * H * s * (look.legW || 1), cl.boots);
  }
  part(0, 'qbody', back, front, w, cl.torso);
  if (look.tail) part(D(back.f, 0) - 1, 'qtail', back, null, 0, cl.skin);
  const head = { f: front.f + 7 * H, r: 0, z: front.z + 4 * H - (A.name === 'attack' ? 3 * H * Math.sin(u * PI) : 0) };
  part(D(head.f, 0) + 1, 'qhead', head, front, 6 * H * (look.headS || 1), cl.skin);
  parts.sort((x, y) => x.d - y.d);
  const flash = a.flash > 0;
  for (const q of parts) {
    if (q.k === 'limb') { g.lineCap = 'round'; stroke(g, X(q.a.f, q.a.r), Y(q.a.f, q.a.r, q.a.z), X(q.b.f, q.b.r), Y(q.b.f, q.b.r, q.b.z), q.w, col(q.c, flash), ow); }
    else if (q.k === 'qbody') {
      // 몸통: 굵은 선 두 겹 + 등 줄무늬
      g.lineCap = 'round';
      stroke(g, X(q.a.f, 0), Y(q.a.f, 0, q.a.z), X(q.b.f, 0), Y(q.b.f, 0, q.b.z), q.w * 2.1 * s, col(q.c, flash), ow);
      g.strokeStyle = shade(q.c, 1.3); g.lineWidth = q.w * 0.7 * s;
      g.beginPath(); g.moveTo(X(q.a.f, 0), Y(q.a.f, 0, q.a.z + q.w * 0.6)); g.lineTo(X(q.b.f, 0), Y(q.b.f, 0, q.b.z + q.w * 0.6)); g.stroke();
      if (look.spikes) { g.strokeStyle = look.spikes; g.lineWidth = 1.6 * s; for (let i = 0; i < 5; i++) { const t = i / 4, f = q.a.f + (q.b.f - q.a.f) * t, z = q.a.z + (q.b.z - q.a.z) * t + q.w; g.beginPath(); g.moveTo(X(f, 0), Y(f, 0, z)); g.lineTo(X(f - 2, 0), Y(f - 2, 0, z + 5 * H)); g.stroke(); } }
    } else if (q.k === 'qtail') {
      g.lineCap = 'round'; const sw = Math.sin(time * 3 + a.id) * 4;
      g.beginPath(); g.moveTo(X(q.a.f, 0), Y(q.a.f, 0, q.a.z)); g.quadraticCurveTo(X(q.a.f - 10 * H, sw), Y(q.a.f - 10 * H, sw, q.a.z + 6 * H), X(q.a.f - 18 * H, sw * 2), Y(q.a.f - 18 * H, sw * 2, q.a.z - 2 * H));
      g.strokeStyle = OUT; g.lineWidth = 3 * s * H + ow; g.stroke(); g.strokeStyle = col(q.c, flash); g.lineWidth = 3 * s * H; g.stroke();
    } else if (q.k === 'qhead') {
      const hx = X(q.a.f, 0), hy = Y(q.a.f, 0, q.a.z), nx = X(q.b.f, 0), ny = Y(q.b.f, 0, q.b.z);
      g.lineCap = 'round'; stroke(g, nx, ny, hx, hy, q.w * s * 1.2, col(q.c, flash), ow);
      const sx = X(q.a.f + 7 * H, 0), sy = Y(q.a.f + 7 * H, 0, q.a.z - 2 * H);
      stroke(g, hx, hy, sx, sy, q.w * s * 0.9, col(shade(q.c, 0.9), flash), ow);
      // 눈·이빨·뿔
      const ex = X(q.a.f + 2 * H, -3 * H), ey = Y(q.a.f + 2 * H, -3 * H, q.a.z + 2 * H), ex2 = X(q.a.f + 2 * H, 3 * H), ey2 = Y(q.a.f + 2 * H, 3 * H, q.a.z + 2 * H);
      g.fillStyle = look.glowEyes || '#ffdd44'; g.beginPath(); g.arc(ex, ey, 1.3 * s * H, 0, PI * 2); g.arc(ex2, ey2, 1.3 * s * H, 0, PI * 2); g.fill();
      if (look.horns) { g.lineCap = 'round'; for (const sd of [-1, 1]) { const bx = X(q.a.f, sd * 4 * H), by = Y(q.a.f, sd * 4 * H, q.a.z + 3 * H), tx = X(q.a.f + 6 * H * look.horns, sd * 9 * H), ty = Y(q.a.f + 6 * H * look.horns, sd * 9 * H, q.a.z + 10 * H * look.horns); stroke(g, bx, by, tx, ty, 2.4 * s * H, look.hornCol || '#ddd2b8', ow * 0.6); } }
      if (A.name === 'attack') { g.strokeStyle = '#eee'; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 2 * s, sy + 3 * s); g.stroke(); }
    }
  }
}

// ───────── 박쥐·날개 달린 것 ─────────
function drawFlyer(g, a, look, s, time) {
  const H = look.h || 1, ow = Math.max(1, 1.2 * s);
  const A = a.anim || { name: 'idle' };
  const dead = A.name === 'death' || A.name === 'dead';
  const flap = dead ? -0.3 : Math.sin(time * 18 + a.id * 3) ;
  const z = dead ? 2 : 34 * H + Math.sin(time * 4 + a.id) * 4;
  const body = { f: 0, r: 0, z };
  const bx = X(0, 0), by = Y(0, 0, z);
  const cl = look.cols, flash = a.flash > 0;
  for (const sd of [-1, 1]) {
    const tip = { f: -3 * H, r: sd * 22 * H, z: z + flap * 12 * H };
    const mid = { f: 4 * H, r: sd * 12 * H, z: z + flap * 6 * H + 3 * H };
    const tx = X(tip.f, tip.r), ty = Y(tip.f, tip.r, tip.z), mx = X(mid.f, mid.r), my = Y(mid.f, mid.r, mid.z);
    const lx = X(-6 * H, sd * 8 * H), ly = Y(-6 * H, sd * 8 * H, z - 6 * H);
    g.beginPath(); g.moveTo(bx, by); g.lineTo(mx, my); g.lineTo(tx, ty); g.lineTo(lx, ly); g.closePath();
    g.strokeStyle = OUT; g.lineWidth = ow; g.stroke(); g.fillStyle = col(cl.wing, flash); g.fill();
  }
  disc(g, bx, by, 5 * s * H, col(cl.torso, flash), ow);
  const hx = X(5 * H, 0), hy = Y(5 * H, 0, z + 2 * H);
  disc(g, hx, hy, 3.6 * s * H, col(cl.skin, flash), ow);
  g.fillStyle = look.glowEyes || '#ff3020'; g.beginPath(); g.arc(hx - 1.2 * s, hy - 0.5 * s, 0.9 * s, 0, PI * 2); g.arc(hx + 1.2 * s, hy - 0.5 * s, 0.9 * s, 0, PI * 2); g.fill();
  // 귀
  g.fillStyle = col(cl.skin, flash); g.beginPath(); g.moveTo(hx - 3 * s, hy - 2 * s); g.lineTo(hx - 2 * s, hy - 6 * s * H); g.lineTo(hx - 0.5 * s, hy - 2.5 * s); g.moveTo(hx + 3 * s, hy - 2 * s); g.lineTo(hx + 2 * s, hy - 6 * s * H); g.lineTo(hx + 0.5 * s, hy - 2.5 * s); g.fill();
}

// ───────── 거미 ─────────
function drawSpider(g, a, look, s, time) {
  const H = look.h || 1, ow = Math.max(1, 1.2 * s), cl = look.cols, flash = a.flash > 0;
  const A = a.anim || { name: 'idle' };
  const dead = A.name === 'death' || A.name === 'dead';
  const z = dead ? 3 : 9 * H;
  g.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const sd = i < 4 ? -1 : 1, k = i % 4;
    const ang = (k - 1.5) * 0.45;
    const sw = a.moving ? Math.sin((a.walkPh || 0) * 1.5 + i * 1.7) * 0.25 : 0;
    const kx = Math.cos(ang + sw) * 10 * H, kr = sd * (8 + Math.abs(Math.sin(ang)) * 4) * H;
    const knee = { f: kx, r: kr, z: z + (dead ? 2 : 9) * H }, foot = { f: kx * 1.6, r: kr * 1.9, z: dead ? z + 4 * H : 0 };
    stroke(g, X(0, 0), Y(0, 0, z), X(knee.f, knee.r), Y(knee.f, knee.r, knee.z), 2.2 * s * H, col(cl.legs, flash), ow);
    stroke(g, X(knee.f, knee.r), Y(knee.f, knee.r, knee.z), X(foot.f, foot.r), Y(foot.f, foot.r, foot.z), 1.7 * s * H, col(cl.legs, flash), ow);
  }
  const ax = X(-9 * H, 0), ay = Y(-9 * H, 0, z + 3 * H);
  g.beginPath(); g.ellipse(ax, ay, 10 * s * H, 8 * s * H, 0, 0, PI * 2); g.fillStyle = OUT; g.fill();
  g.beginPath(); g.ellipse(ax, ay, 10 * s * H - ow / 2, 8 * s * H - ow / 2, 0, 0, PI * 2); g.fillStyle = col(cl.torso, flash); g.fill();
  if (look.mark) { g.fillStyle = look.mark; g.beginPath(); g.ellipse(ax, ay - 2 * s, 3 * s * H, 4 * s * H, 0, 0, PI * 2); g.fill(); }
  disc(g, X(4 * H, 0), Y(4 * H, 0, z + 1), 5 * s * H, col(cl.skin, flash), ow);
  g.fillStyle = look.glowEyes || '#ff4020';
  for (let i = -1; i <= 1; i += 2) { g.beginPath(); g.arc(X(7 * H, i * 1.6 * H), Y(7 * H, i * 1.6 * H, z + 3 * H), 0.9 * s, 0, PI * 2); g.fill(); }
}

// ───────── 뱀 ─────────
function drawSerpent(g, a, look, s, time) {
  const H = look.h || 1, ow = Math.max(1, 1.3 * s), cl = look.cols, flash = a.flash > 0;
  const A = a.anim || { name: 'idle' };
  const u = A.dur ? Math.min(1, A.t / A.dur) : 0;
  const dead = A.name === 'death' || A.name === 'dead';
  const N = 9, pts = [];
  const strike = A.name === 'attack' ? Math.sin(seg(u, 0.3, 0.7) * PI) : 0;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const f = (1 - t) * -26 * H + strike * 10 * H * (1 - t) ** 3 + 8 * H;
    const r = Math.sin(t * 7 - time * (a.moving ? 9 : 2) + a.id) * 5 * H * (1 - t * 0.5);
    const z = dead ? 2 : (i >= N - 3 ? (i - (N - 3)) * 9 * H + strike * 6 * H : 3 * H);
    pts.push({ f: f * (dead ? 0.9 : 1), r, z });
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.f, p.r), Y(p.f, p.r, p.z)) : g.moveTo(X(p.f, p.r), Y(p.f, p.r, p.z))));
  g.strokeStyle = OUT; g.lineWidth = 7 * s * H + ow; g.stroke(); g.strokeStyle = col(cl.torso, flash); g.lineWidth = 7 * s * H; g.stroke();
  g.strokeStyle = shade(cl.torso, 1.4); g.lineWidth = 2 * s * H; g.stroke();
  const hd = pts[N - 1];
  disc(g, X(hd.f + 3 * H, hd.r), Y(hd.f + 3 * H, hd.r, hd.z), 5.5 * s * H, col(cl.skin, flash), ow);
  g.fillStyle = look.glowEyes || '#ffd040'; g.beginPath(); g.arc(X(hd.f + 5 * H, hd.r - 2 * H), Y(hd.f + 5 * H, hd.r - 2 * H, hd.z + 2 * H), 1.1 * s, 0, PI * 2); g.arc(X(hd.f + 5 * H, hd.r + 2 * H), Y(hd.f + 5 * H, hd.r + 2 * H, hd.z + 2 * H), 1.1 * s, 0, PI * 2); g.fill();
  if (look.hood) { g.fillStyle = col(cl.wing || cl.torso, flash); g.beginPath(); g.ellipse(X(hd.f, hd.r), Y(hd.f, hd.r, hd.z - 2 * H), 8 * s * H, 6 * s * H, 0, 0, PI * 2); g.fill(); }
}

// ───────── 떠다니는 영혼(형체 없는 자) ─────────
function drawWraith(g, a, look, s, time) {
  const H = look.h || 1, cl = look.cols, flash = a.flash > 0;
  const z = 10 * H + Math.sin(time * 2 + a.id) * 3;
  const x = X(0, 0), y = Y(0, 0, z);
  const al = g.globalAlpha;
  g.globalAlpha = al * 0.85;
  g.fillStyle = col(cl.robe || cl.torso, flash);
  g.beginPath();
  g.moveTo(x - 9 * s * H, y - 30 * s * H);
  g.quadraticCurveTo(x - 14 * s * H, y, x - 8 * s * H + Math.sin(time * 5) * 2 * s, y + 10 * s * H);
  for (let i = 0; i <= 4; i++) g.lineTo(x - 8 * s * H + i * 4 * s * H, y + (i % 2 ? 4 : 12) * s * H + Math.sin(time * 6 + i) * 2 * s);
  g.quadraticCurveTo(x + 14 * s * H, y, x + 9 * s * H, y - 30 * s * H);
  g.closePath(); g.fill();
  g.globalAlpha = al;
  disc(g, x, y - 36 * s * H, 7 * s * H, col(cl.robe || cl.torso, flash), 1 * s);
  g.fillStyle = '#060404'; g.beginPath(); g.ellipse(x + 1 * s, y - 35 * s * H, 4.5 * s * H, 5 * s * H, 0, 0, PI * 2); g.fill();
  g.fillStyle = look.glowEyes || '#9fe0ff'; g.beginPath(); g.arc(x - 1 * s, y - 36 * s * H, 1.2 * s, 0, PI * 2); g.arc(x + 3 * s, y - 36 * s * H, 1.2 * s, 0, PI * 2); g.fill();
}

// ───────── 바깥에서 부르는 함수 ─────────
const PZ = { ...POSE };
let HL = true; // 팔다리 반사광(플레이어·보스·NPC만)
export function drawActor(g, a, px, py, s, time) {
  const look = a.look;
  if (!look) return;
  HL = !!(a.isPlayer || a.boss || a.kind === 'npc' || a.portrait);
  const sc = s * (look.scale || 1);
  OUT = look.outline || 'rgba(8,5,4,0.92)';
  const dead = a.anim?.name === 'death' || a.anim?.name === 'dead';
  // 그림자
  if (!dead) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(px, py, 15 * sc * (look.shadow || 1), 7.5 * sc * (look.shadow || 1), 0, 0, PI * 2); g.fill();
  }
  let alpha = 1;
  if (a.invis != null) alpha = a.invis;
  if (a.fade != null) alpha *= a.fade;
  if (alpha <= 0.02) return;
  g.globalAlpha = alpha;
  // 선택 고리(공격 대상)
  if (a.targeted) {
    g.strokeStyle = a.team === 1 ? 'rgba(220,60,40,0.85)' : 'rgba(120,200,255,0.8)'; g.lineWidth = 1.6 * s;
    g.beginPath(); g.ellipse(px, py, 18 * sc, 9 * sc, 0, 0, PI * 2); g.stroke();
  }
  // 강조 테두리(우두머리·용사)
  if (look.aura && !dead) {
    g.globalAlpha = alpha * (0.3 + 0.15 * Math.sin(time * 4 + a.id));
    g.fillStyle = look.aura;
    g.beginPath(); g.ellipse(px, py, 20 * sc, 10 * sc, 0, 0, PI * 2); g.fill();
    g.globalAlpha = alpha;
  }
  setProj(a.face || 0, px, py, sc);
  const p = computePose(a, look, PZ, time);
  switch (look.plan) {
    case 'quad': drawQuad(g, a, look, p, sc, time); break;
    case 'flyer': drawFlyer(g, a, look, sc, time); break;
    case 'spider': drawSpider(g, a, look, sc, time); break;
    case 'serpent': drawSerpent(g, a, look, sc, time); break;
    case 'wraith': drawWraith(g, a, look, sc, time); break;
    default: drawHuman(g, a, look, p, sc, time);
  }
  g.globalAlpha = 1;
}

// 시체: 죽은 자세로 멈춘 그림(조금 어둡게)
export function drawCorpse(g, c, px, py, s) {
  const look = c.look;
  if (!look) return;
  const sc = s * (look.scale || 1);
  OUT = 'rgba(8,5,4,0.9)';
  g.globalAlpha = c.fade ?? 1;
  setProj(c.face || 0, px, py, sc);
  const fake = { id: c.id || 0, anim: { name: 'dead', t: 1, dur: 1 }, fallDir: c.fallDir || 1, look, flash: 0 };
  const p = computePose(fake, look, PZ, 0);
  // 피 웅덩이
  if (!look.skel && !look.noBlood) {
    g.fillStyle = look.bloodCol || 'rgba(90,6,4,0.75)';
    g.beginPath(); g.ellipse(px - 6 * sc * (c.fallDir || 1) * Math.cos(c.face || 0), py, 16 * sc, 7 * sc, 0, 0, PI * 2); g.fill();
  }
  switch (look.plan) {
    case 'quad': drawQuad(g, fake, look, p, sc, 0); break;
    case 'flyer': drawFlyer(g, fake, look, sc, 0); break;
    case 'spider': drawSpider(g, fake, look, sc, 0); break;
    case 'serpent': drawSerpent(g, fake, look, sc, 0); break;
    case 'wraith': break;
    default: drawHuman(g, fake, look, p, sc, 0);
  }
  g.globalAlpha = 1;
}

// 미리보기(초상화·캐릭터 선택 화면)
export function drawPortrait(g, look, x, y, s, time, anim = 'idle', face = Math.PI / 4) {
  const a = { id: 1, look, face, anim: { name: anim, t: (time % 1.2), dur: 1.2 }, flash: 0, portrait: true };
  drawActor(g, a, x, y, s, time);
}

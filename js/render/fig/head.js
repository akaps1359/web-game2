// 머리: 타원체 머리 위에 머리카락(짧은·긴·묶은)·모자·두건·투구를 덮고, 얼굴 부분(표면 조각)을 다시 칠한 뒤 눈·눈썹·코·입·수염을 얹는다.
// 해골과 짐승(염소·짐승) 머리, 뿔도 여기서
import { PR, X, Y, D, XJ, YJ, DJ, V3, ellipsoid, projEllipse, shaggy, surf, ball, seg, glowDot, tone, fillBall, MAT, skinMat, TAU, camNormal, ringFront, ring, makeRing } from './core.js';
import { J, FR, DIM } from './pose.js';

const T = new V3(), T2 = new V3();
const HR = makeRing();
let HE = { x: 0, y: 0, rx: 1, ry: 1, rot: 0 }; // 머리 타원(화면)

// 얼굴이 보이는 정도(-1 뒤 ~ 1 정면)
function faceVis() { return camNormal(FR.head.F.f, FR.head.F.r, FR.head.F.z).z; }

let SKM = MAT.skin; // 지금 머리의 맨살 재질
export function drawHead(g, look, a, time, lod) {
  const hd = look.head || 'human';
  SKM = skinMat(look);
  if (hd === 'skull') return skullHead(g, look, a, time, lod);
  if (hd === 'goat' || hd === 'beast') return beastHead(g, look, a, time, lod, hd);
  humanHead(g, look, a, time, lod);
}

// 머리 표면 조각(방위 az0~az1, 고도 elB ~ elT(az))의 화면 경로. 안 보이는 점은 머리 윤곽선으로 밀어낸다
function patchPath(g, az0, az1, elB, elT, k = 1, jag = 0) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U;
  const A = DIM.headA * k, B = DIM.headB * k, Cc = DIM.headC * k;
  const E = HE, c = Math.cos(E.rot), sn = Math.sin(E.rot);
  let first = true;
  const add = (az, el) => {
    const p = surf(C, F, R, U, A, B, Cc, az, el);
    let x = X(p.f, p.r), y = Y(p.f, p.r, p.z);
    if (p.vis < 0.02) {
      const dx = x - E.x, dy = y - E.y, lx = dx * c + dy * sn, ly = -dx * sn + dy * c;
      const q = Math.sqrt((lx * lx) / (E.rx * E.rx) + (ly * ly) / (E.ry * E.ry));
      if (q > 1e-6) { x = E.x + dx / q; y = E.y + dy / q; }
    }
    if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y);
  };
  g.beginPath();
  const N = 8;
  for (let i = 0; i <= N; i++) add(az0 + (az1 - az0) * i / N, elB);
  for (let i = 1; i <= N; i++) add(az1, elB + (elT(az1) - elB) * i / N);
  const NT = jag ? 2 * N + 1 : N;
  for (let i = 1; i <= NT; i++) { const az = az1 + (az0 - az1) * i / NT; add(az, elT(az) - (i % 2 && i < NT ? jag : 0)); }
  for (let i = 1; i < N; i++) add(az0, elT(az0) + (elB - elT(az0)) * i / N);
  g.closePath();
}
// 머리 윤곽 안에서 얼굴 조각을 피부 음영으로 다시 칠한다
function facePatch(g, skin, hairline, width = 1.15, fill = null, jag = 0) {
  g.save();
  g.beginPath(); g.ellipse(HE.x, HE.y, HE.rx, HE.ry, HE.rot, 0, TAU); g.clip();
  patchPath(g, -width, width, -1.45, jag ? (az) => hairline + 0.08 * (az / width) * (az / width) - 0.25 * Math.max(0, Math.abs(az / width) - 0.75) : (az) => hairline - 0.22 * (az / width) * (az / width), 1, jag);
  if (fill) { g.fillStyle = fill; g.fill(); } else fillBall(g, HE.x, HE.y, Math.max(HE.rx, HE.ry), skin, SKM);
  g.restore();
}

function humanHead(g, look, a, time, lod) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U;
  const A = DIM.headA, B = DIM.headB, Cc = DIM.headC;
  const cl = look.cols, skin = cl.skin, hair = cl.hair, hm = look.helm;
  const fv = faceVis();
  const s = PR.s, H = DIM.H;
  const bald = !hair || look.hairStyle === 'bald';
  const longHair = !bald && !hm && (look.hairStyle === 'long' || look.female);
  // 머리 뒤에 놓일 것들
  if (longHair && fv > -0.2) backHair(g, look, hair);
  if (hm?.type === 'hood') hoodBack(g, look, hm);
  const tailBehind = look.ponytail && !hm && !bald && ponyFront(time, a) === false;
  if (tailBehind) ponytail(g, look, hair, time, a);
  if (look.horns) horns(g, look, look.horns, false);
  // 턱: 머리 아래 앞쪽으로 좁게 내려온 턱선(머리가 공처럼 보이지 않게). 얼굴을 가리는 두건·투구 안에서는 생략
  if (lod > 0 && (!hm || (hm.type !== 'hood' && hm.type !== 'full' && hm.type !== 'great'))) {
    const jw = look.female ? 0.92 : 1;
    T.set(C.f + F.f * A * 0.22 - U.f * Cc * 0.42, C.r + F.r * A * 0.22 - U.r * Cc * 0.42, C.z + F.z * A * 0.22 - U.z * Cc * 0.42);
    ellipsoid(g, T, F, R, U, A * 0.72 * jw, B * 0.74 * jw, Cc * 0.62 * jw, skin, SKM);
  }
  // 머리
  HE = { ...ellipsoid(g, C, F, R, U, A, B, Cc, skin, SKM) };
  // 귀
  if (!hm || hm.type === 'crown') for (const sd of [-1, 1]) {
    const p = surf(C, F, R, U, A, B, Cc, sd * 1.6, -0.08);
    if (p.vis > 0.08 && lod > 0) ball(g, X(p.f, p.r), Y(p.f, p.r, p.z), 0.95 * s * H, 1.45 * s * H, skin, SKM, 0, 0.92);
  }
  // 덮개: 머리카락·모자·두건·투구
  const type = hm ? hm.type : bald ? null : 'hair';
  let featured = true;
  switch (type) {
    case 'hair': case 'crown': {
      if (!bald) {
        hairVolume(g, look, hair, longHair);
        if (fv > -0.45) facePatch(g, skin, look.female ? 0.5 : 0.42, 1.15, null, 0.09);
      }
      break;
    }
    case 'cap': case 'skullcap': {
      capVolume(g, hm, hm.type === 'skullcap');
      if (fv > -0.45) facePatch(g, skin, 0.3);
      break;
    }
    case 'hood': {
      hoodVolume(g, hm);
      if (fv > -0.4) {
        facePatch(g, skin, 0.32, 1.0, darkFace(hm));
        hoodFace(g, look, fv);
      }
      featured = false;
      break;
    }
    case 'helm': {
      helmVolume(g, hm, 1.1, false);
      if (fv > -0.45) facePatch(g, skin, 0.18, 0.95);
      break;
    }
    case 'full': case 'great': {
      if (type === 'great') greatHelm(g, hm); else helmVolume(g, hm, 1.13, true);
      visor(g, look, hm, fv);
      featured = false;
      break;
    }
  }
  if (featured && fv > -0.35 && lod > 0) face(g, look, lod);
  if (look.beard && featured) beard(g, look, fv);
  if (type === 'crown') crown(g, hm);
  if (type === 'helm') noseGuard(g, hm, fv);
  if (hm && hm.plume) plume(g, hm.plume, time);
  if (longHair && fv <= -0.2) backHair(g, look, hair);
  if (look.ponytail && !hm && !bald && !tailBehind) ponytail(g, look, hair, time, a);
  if (look.horns) horns(g, look, look.horns, true);
}

// ───────── 얼굴 ─────────
function face(g, look, lod) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U;
  const A = DIM.headA, B = DIM.headB, Cc = DIM.headC, s = PR.s, H = DIM.H * DIM.hs;
  const glow = look.glowEyes, skin = look.cols.skin;
  // 눈썹 뼈 아래 그늘: 두 눈을 잇는 띠(밑바탕 밝기에 맞게 반투명으로 얹는다)
  if (!glow) {
    const a0 = surf(C, F, R, U, A * 0.97, B, Cc, -0.62, 0.06), x0 = X(a0.f, a0.r), y0 = Y(a0.f, a0.r, a0.z), v0 = a0.vis;
    const a1 = surf(C, F, R, U, A * 0.97, B, Cc, 0.62, 0.06), x1 = X(a1.f, a1.r), y1 = Y(a1.f, a1.r, a1.z), v1 = a1.vis;
    const m = surf(C, F, R, U, A * 0.99, B, Cc, 0, 0.1), mx = X(m.f, m.r), my = Y(m.f, m.r, m.z);
    if (m.vis > 0.05) {
      g.fillStyle = 'rgba(28,14,6,0.36)';
      g.beginPath();
      g.moveTo(v0 > 0 ? x0 : mx, v0 > 0 ? y0 : my);
      g.quadraticCurveTo(mx, my - 1.0 * s * H, v1 > 0 ? x1 : mx, v1 > 0 ? y1 : my);
      g.quadraticCurveTo(mx, my + 1.3 * s * H, v0 > 0 ? x0 : mx, v0 > 0 ? y0 : my);
      g.fill();
    }
  }
  for (const sd of [-1, 1]) {
    const p = surf(C, F, R, U, A * 0.97, B, Cc, sd * 0.38, 0.04);
    if (p.vis <= 0.1) continue;
    const ex = X(p.f, p.r), ey = Y(p.f, p.r, p.z);
    const fw = 0.4 + 0.6 * p.vis;
    if (glow) { glowDot(g, ex, ey, 0.62 * s * H, glow, 0.6); continue; }
    // 가는 눈
    g.fillStyle = '#140c08'; g.beginPath(); g.ellipse(ex, ey + 0.02 * s * H, 0.48 * s * H * fw, 0.2 * s * H, 0, 0, TAU); g.fill();
    // 눈썹
    if (lod > 1) {
      const b1 = surf(C, F, R, U, A * 1.0, B, Cc, sd * 0.6, 0.2), b2 = surf(C, F, R, U, A * 1.0, B, Cc, sd * 0.16, 0.17);
      g.strokeStyle = tone(look.cols.hair || skin, look.cols.hair ? 0.6 : 0.45); g.lineWidth = (look.female ? 0.4 : 0.65) * s * H; g.lineCap = 'round';
      g.beginPath(); g.moveTo(X(b1.f, b1.r), Y(b1.f, b1.r, b1.z)); g.lineTo(X(b2.f, b2.r), Y(b2.f, b2.r, b2.z)); g.stroke();
    }
  }
  // 코: 콧등에 옅은 빛, 코 밑 그늘
  const n = surf(C, F, R, U, A * 1.05, B, Cc, 0, -0.22);
  if (n.vis > 0.12) {
    const nx = X(n.f, n.r), ny = Y(n.f, n.r, n.z);
    g.fillStyle = 'rgba(28,14,6,0.38)'; g.beginPath(); g.ellipse(nx + 0.25 * s * H, ny + 0.5 * s * H, 0.7 * s * H, 0.32 * s * H, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,226,190,0.13)'; g.beginPath(); g.ellipse(nx - 0.15 * s * H, ny - 0.25 * s * H, 0.34 * s * H, 0.6 * s * H, 0, 0, TAU); g.fill();
  }
  // 입
  const m = surf(C, F, R, U, A * 0.96, B, Cc, 0, -0.52);
  if (m.vis > 0.2 && lod > 1 && !look.beard) {
    const mx = X(m.f, m.r), my = Y(m.f, m.r, m.z), w = 1.0 * s * H * (0.4 + 0.6 * m.vis);
    g.strokeStyle = 'rgba(40,16,8,0.55)'; g.lineWidth = 0.45 * s * H; g.lineCap = 'round';
    g.beginPath(); g.moveTo(mx - w, my); g.quadraticCurveTo(mx, my + 0.25 * s * H, mx + w, my); g.stroke();
  }
}

function beard(g, look, fv) {
  if (fv < -0.2) return;
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U;
  const A = DIM.headA, B = DIM.headB, Cc = DIM.headC, s = PR.s, H = DIM.H;
  // 턱·볼을 덮는 수염(얼굴 아래쪽 표면 조각)
  g.save();
  g.beginPath(); g.ellipse(HE.x, HE.y, HE.rx, HE.ry, HE.rot, 0, TAU); g.clip();
  patchPath(g, -1.45, 1.45, -1.55, (az) => -0.36 - 0.1 * Math.cos(az * 2.2) - 0.22 * Math.abs(az), 1.0);
  fillBall(g, HE.x, HE.y + HE.ry * 0.3, Math.max(HE.rx, HE.ry), look.beard, MAT.fur, 0.95);
  g.restore();
  // 턱 아래로 늘어진 수염: 턱에서 아래로 가늘어지는 다발
  const bl = look.beardL || 1;
  T.set(C.f + F.f * A * 0.62 - U.f * Cc * 0.72, C.r + F.r * A * 0.62 - U.r * Cc * 0.72, C.z + F.z * A * 0.62 - U.z * Cc * 0.72);
  T2.set(T.f + F.f * 0.6 * H - U.f * Cc * 0.55 * bl, T.r + F.r * 0.6 * H - U.r * Cc * 0.55 * bl, T.z + F.z * 0.6 * H - U.z * Cc * 0.55 * bl);
  if (DJ(T) > DJ(C) - 1.2 * H) seg(g, XJ(T), YJ(T), B * 0.62 * s, XJ(T2), YJ(T2), B * (bl > 1.2 ? 0.25 : 0.4) * s, look.beard, MAT.fur, 0.12, 0.3);
  // 콧수염
  const m = surf(C, F, R, U, A * 0.99, B, Cc, 0, -0.4);
  if (m.vis > 0.15) {
    const x = X(m.f, m.r), y = Y(m.f, m.r, m.z);
    g.strokeStyle = tone(look.beard, 0.8); g.lineWidth = 0.75 * s * H; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 1.4 * s * H, y + 0.6 * s * H); g.quadraticCurveTo(x, y - 0.35 * s * H, x + 1.4 * s * H, y + 0.6 * s * H); g.stroke();
  }
}

// ───────── 머리카락 ─────────
function hairVolume(g, look, hair, long) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U;
  const A = DIM.headA, B = DIM.headB, Cc = DIM.headC;
  const vol = look.hairVol || 1;
  T2.set(C.f - F.f * A * 0.12 + U.f * Cc * 0.1, C.r - F.r * A * 0.12 + U.r * Cc * 0.1, C.z - F.z * A * 0.12 + U.z * Cc * 0.1);
  // 매끈한 가발처럼 보이지 않게 윤곽을 삐죽하게(긴 머리는 아래로 늘어진다)
  shaggy(g, projEllipse(T2, F, R, U, A * 1.06 * vol, B * (long ? 1.14 : 1.08) * vol, Cc * 0.97 * vol), 22, 0.07, hair, MAT.fur, long ? 0.3 : 0.12, 0.92);
}
function backHair(g, look, hair) {
  const C = J.head, F = FR.head.F, s = PR.s, H = DIM.H;
  const top = { f: C.f - F.f * DIM.headA * 0.45, r: C.r - F.r * DIM.headA * 0.45, z: C.z + DIM.headC * 0.15 };
  const bot = { f: J.neck.f - FR.chest.F.f * 3.2 * H, r: J.neck.r - FR.chest.F.r * 3.2 * H, z: J.neck.z - 5 * H * (look.hairL || 1) };
  seg(g, X(top.f, top.r), Y(top.f, top.r, top.z), DIM.headB * 1.0 * s, X(bot.f, bot.r), Y(bot.f, bot.r, bot.z), 3.4 * s * H, hair, MAT.leather, 0.08);
}
function ponyFront(time, a) {
  const C = J.head, F = FR.head.F;
  return D(C.f - F.f * DIM.headA, C.r - F.r * DIM.headA) > DJ(C);
}
function ponytail(g, look, hair, time, a) {
  const C = J.head, F = FR.head.F, U = FR.head.U, s = PR.s, H = DIM.H;
  const sw = Math.sin(time * 3 + (a?.id || 0)) * 1.2 * H - (a?.moving ? 2 * H : 0);
  const b = { f: C.f - F.f * DIM.headA * 0.9 + U.f * 1.5 * H, r: C.r - F.r * DIM.headA * 0.9, z: C.z + 1.2 * H };
  const e = { f: b.f - F.f * (3 + Math.abs(sw)) * H, r: b.r - F.r * 3 * H + sw * 0.4, z: b.z - 9.5 * H };
  ball(g, X(b.f, b.r), Y(b.f, b.r, b.z), 1.3 * s * H, 1.3 * s * H, look.tie || '#3a2a1a', MAT.leather);
  seg(g, X(b.f, b.r), Y(b.f, b.r, b.z), 1.5 * s * H, X(e.f, e.r), Y(e.f, e.r, e.z), 0.7 * s * H, hair, MAT.leather, 0.35, 0.3);
}

// ───────── 모자·두건·투구 ─────────
function capVolume(g, hm, metal) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U, s = PR.s, H = DIM.H;
  const A = DIM.headA, B = DIM.headB, Cc = DIM.headC;
  const col = hm.color || '#6a4a2a';
  // 위쪽 반만: 머리 둘레 고리 아래는 잘라낸다
  T.set(C.f + U.f * Cc * 0.12, C.r + U.r * Cc * 0.12, C.z + U.z * Cc * 0.12);
  ring(HR, T, F, R, B * 1.1, A * 1.1);
  g.save();
  clipAbove(g, HR);
  T2.set(C.f - F.f * A * 0.04 + U.f * Cc * 0.08, C.r - F.r * A * 0.04 + U.r * Cc * 0.08, C.z + U.z * Cc * 0.08);
  ellipsoid(g, T2, F, R, U, A * 1.09, B * 1.1, Cc * 1.02, col, metal ? MAT.metal : MAT.leather);
  g.restore();
  ringFront(g, HR, 1.2 * s * H, tone(col, metal ? 0.8 : 0.62, metal ? 0.3 : 0));
}
function hoodBack(g, look, hm) {
  // 두건 자락: 머리 뒤에서 어깨로
  const C = J.head, F = FR.head.F, s = PR.s, H = DIM.H;
  const top = { f: C.f - F.f * 2 * H, r: C.r - F.r * 2 * H, z: C.z + 1 * H };
  const bot = { f: J.neck.f - FR.chest.F.f * 2.2 * H, r: J.neck.r - FR.chest.F.r * 2.2 * H, z: J.neck.z - 2.8 * H };
  seg(g, X(top.f, top.r), Y(top.f, top.r, top.z), DIM.headB * 1.22 * s, X(bot.f, bot.r), Y(bot.f, bot.r, bot.z), DIM.shW * 0.8 * s, hm.color || '#3a3a3a', MAT.cloth);
}
function hoodVolume(g, hm) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U;
  const A = DIM.headA, B = DIM.headB, Cc = DIM.headC;
  T2.set(C.f - F.f * A * 0.1 + U.f * Cc * 0.12, C.r - F.r * A * 0.1 + U.r * Cc * 0.12, C.z - F.z * A * 0.1 + U.z * Cc * 0.12);
  const E = ellipsoid(g, T2, F, R, U, A * 1.24, B * 1.27, Cc * 1.2, hm.color || '#3a3a3a', MAT.cloth);
  HE = { ...E };
}
function darkFace(hm) { return '#070504'; }
function hoodFace(g, look, fv) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U, s = PR.s, H = DIM.H * DIM.hs;
  if (look.glowEyes) {
    for (const sd of [-1, 1]) { const p = surf(C, F, R, U, DIM.headA, DIM.headB, DIM.headC, sd * 0.36, 0.02); if (p.vis > 0.1) glowDot(g, X(p.f, p.r), Y(p.f, p.r, p.z), 0.6 * s * H, look.glowEyes, 0.7); }
  } else if (!look.faceless) {
    // 그늘 속에 얼굴 아래쪽이 조금 보인다
    g.save();
    g.beginPath(); g.ellipse(HE.x, HE.y, HE.rx, HE.ry, HE.rot, 0, TAU); g.clip();
    patchPath(g, -0.8, 0.8, -1.35, () => -0.25, 0.98);
    g.fillStyle = tone(look.cols.skin, 0.5); g.fill();
    g.restore();
    if (look.beard) { const p = surf(C, F, R, U, DIM.headA, DIM.headB, DIM.headC, 0, -0.75); if (p.vis > 0.1) ball(g, X(p.f, p.r), Y(p.f, p.r, p.z) + 1.5 * s * H, 2.2 * s * H, 2.8 * s * H, look.beard, MAT.fur, 0, 0.75); }
  }
}
function helmVolume(g, hm, k, full) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U;
  const A = DIM.headA, B = DIM.headB, Cc = DIM.headC;
  T2.set(C.f - F.f * A * 0.03 + U.f * Cc * 0.06, C.r - F.r * A * 0.03 + U.r * Cc * 0.06, C.z + U.z * Cc * 0.06);
  const E = ellipsoid(g, T2, F, R, U, A * k, B * k * 1.02, Cc * (full ? k : k * 1.0), hm.color || '#8a8a92', MAT.metal);
  if (full) HE = { ...E };
  // 아래 테두리
  T.set(C.f - U.f * Cc * (full ? 0.55 : 0.12), C.r - U.r * Cc * (full ? 0.55 : 0.12), C.z - U.z * Cc * (full ? 0.55 : 0.12));
  ring(HR, T, F, R, B * k * 1.03, A * k * 1.02);
  ringFront(g, HR, 0.9 * PR.s * DIM.H, tone(hm.color || '#8a8a92', 0.62, 0.15), 0.85);
}
function greatHelm(g, hm) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U, s = PR.s;
  const A = DIM.headA, B = DIM.headB, Cc = DIM.headC, col = hm.color || '#a8a8b2';
  // 위가 평평한 원통 투구
  T.set(C.f - U.f * Cc * 0.8, C.r - U.r * Cc * 0.8, C.z - U.z * Cc * 0.8);
  T2.set(C.f + U.f * Cc * 0.82, C.r + U.r * Cc * 0.82, C.z + U.z * Cc * 0.82);
  seg(g, XJ(T), YJ(T), B * 1.24 * s, XJ(T2), YJ(T2), B * 1.18 * s, col, MAT.metal);
  ellipsoid(g, T2, F, R, U, A * 1.18, B * 1.2, Cc * 0.2, col, MAT.metal, 1.12);
  HE = { x: (XJ(T) + XJ(T2)) / 2, y: (YJ(T) + YJ(T2)) / 2, rx: B * 1.24 * s, ry: Cc * 1.0 * s, rot: 0 };
  ring(HR, T2, F, R, B * 1.2, A * 1.18);
  ringFront(g, HR, 0.9 * s * DIM.H, tone(col, 0.6), 0.9);
}
function visor(g, look, hm, fv) {
  if (fv < -0.3) return;
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U, s = PR.s, H = DIM.H * DIM.hs;
  const k = hm.type === 'great' ? 1.24 : 1.14;
  g.strokeStyle = '#060404'; g.lineCap = 'round';
  // 눈구멍(가로)
  g.beginPath(); let started = false;
  for (let i = -4; i <= 4; i++) {
    const p = surf(C, F, R, U, DIM.headA * k, DIM.headB * k, DIM.headC, i * 0.13, 0.1);
    if (p.vis < 0.03) { started = false; continue; }
    if (!started) { g.moveTo(X(p.f, p.r), Y(p.f, p.r, p.z)); started = true; } else g.lineTo(X(p.f, p.r), Y(p.f, p.r, p.z));
  }
  g.lineWidth = 0.95 * s * H; g.stroke();
  // 숨구멍(세로 줄)
  const v1 = surf(C, F, R, U, DIM.headA * k, DIM.headB * k, DIM.headC, 0, -0.05), v2 = surf(C, F, R, U, DIM.headA * k * 0.98, DIM.headB * k, DIM.headC, 0, -0.6);
  if (v1.vis > 0.1) { g.lineWidth = 0.6 * s * H; g.beginPath(); g.moveTo(X(v1.f, v1.r), Y(v1.f, v1.r, v1.z)); g.lineTo(X(v2.f, v2.r), Y(v2.f, v2.r, v2.z)); g.stroke(); }
  if (look.glowEyes && fv > 0) for (const sd of [-1, 1]) { const p = surf(C, F, R, U, DIM.headA * k, DIM.headB * k, DIM.headC, sd * 0.3, 0.1); if (p.vis > 0.1) glowDot(g, X(p.f, p.r), Y(p.f, p.r, p.z), 0.45 * s * H, look.glowEyes, 0.5); }
}
function noseGuard(g, hm, fv) {
  if (fv < -0.1) return;
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U, s = PR.s, H = DIM.H;
  const n1 = surf(C, F, R, U, DIM.headA * 1.12, DIM.headB, DIM.headC, 0, 0.3), n2 = surf(C, F, R, U, DIM.headA * 1.14, DIM.headB, DIM.headC, 0, -0.22);
  if (n1.vis > 0.1) { g.strokeStyle = tone(hm.color || '#8a8a92', 1.15, 0.3); g.lineWidth = 1.0 * s * H; g.lineCap = 'butt'; g.beginPath(); g.moveTo(X(n1.f, n1.r), Y(n1.f, n1.r, n1.z)); g.lineTo(X(n2.f, n2.r), Y(n2.f, n2.r, n2.z)); g.stroke(); }
}
function crown(g, hm) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U, s = PR.s, H = DIM.H * DIM.hs;
  const gold = hm.color || '#d8b040';
  T.set(C.f + U.f * DIM.headC * 0.45, C.r + U.r * DIM.headC * 0.45, C.z + U.z * DIM.headC * 0.45);
  ring(HR, T, F, R, DIM.headB * 1.0, DIM.headA * 1.0);
  ringFront(g, HR, 1.7 * s * H, tone(gold, 0.9, 0.15));
  const n = 7;
  for (let k = 0; k < n; k++) {
    const az = (k / n) * TAU;
    const p = surf(T, F, R, U, DIM.headA * 1.0, DIM.headB * 1.0, 0.001, az, 0);
    if (p.vis < -0.2) continue;
    const bx = X(p.f, p.r), by = Y(p.f, p.r, p.z);
    g.fillStyle = tone(gold, p.vis > 0 ? 1.1 : 0.7, p.vis > 0 ? 0.3 : 0);
    g.beginPath(); g.moveTo(bx - 0.9 * s * H, by); g.lineTo(bx, by - 3.2 * s * H); g.lineTo(bx + 0.9 * s * H, by); g.fill();
    if (p.vis > 0.3 && k % 2 === 0) { g.fillStyle = '#d02020'; g.beginPath(); g.arc(bx, by - 0.4 * s * H, 0.55 * s * H, 0, TAU); g.fill(); }
  }
}
// 고리 위쪽만 남기는 잘라내기
function clipAbove(g, rg) {
  const n = rg.x.length;
  let mnx = 1e9, mxx = -1e9, il = 0, ir = 0;
  for (let i = 0; i < n; i++) { if (rg.x[i] < mnx) { mnx = rg.x[i]; il = i; } if (rg.x[i] > mxx) { mxx = rg.x[i]; ir = i; } }
  let ya = 0, yb = 0;
  for (let i = il; i !== ir; i = (i + 1) % n) ya += rg.y[i];
  for (let i = il; i !== ir; i = (i - 1 + n) % n) yb += rg.y[i];
  const step = ya >= yb ? 1 : -1;
  const big = (mxx - mnx) * 3 + 50;
  g.beginPath(); g.moveTo(rg.x[il], rg.y[il]);
  for (let i = (il + step + n) % n; ; i = (i + step + n) % n) { g.lineTo(rg.x[i], rg.y[i]); if (i === ir) break; }
  g.lineTo(rg.x[ir] + big, rg.y[ir]); g.lineTo(rg.x[ir] + big, rg.y[ir] - big * 2); g.lineTo(rg.x[il] - big, rg.y[il] - big * 2); g.lineTo(rg.x[il] - big, rg.y[il]);
  g.closePath(); g.clip();
}
function plume(g, col, time) {
  const C = J.head, F = FR.head.F, U = FR.head.U, s = PR.s, H = DIM.H;
  const b = { f: C.f + U.f * DIM.headC * 1.05, r: C.r + U.r * DIM.headC * 1.05, z: C.z + U.z * DIM.headC * 1.05 };
  const sw = Math.sin(time * 4) * 0.6 * H;
  const m = { f: b.f - F.f * 5 * H, r: b.r - F.r * 5 * H + sw * 0.3, z: b.z + 4 * H };
  const e = { f: b.f - F.f * 11 * H, r: b.r - F.r * 11 * H + sw, z: b.z - 1 * H };
  seg(g, X(b.f, b.r), Y(b.f, b.r, b.z), 1.4 * s * H, X(m.f, m.r), Y(m.f, m.r, m.z), 2.2 * s * H, col, MAT.fur);
  seg(g, X(m.f, m.r), Y(m.f, m.r, m.z), 2.2 * s * H, X(e.f, e.r), Y(e.f, e.r, e.z), 0.8 * s * H, col, MAT.fur);
}

// ───────── 뿔 ─────────
// front: true면 머리보다 앞에 있는 뿔만, false면 뒤에 있는 뿔만
function horns(g, look, hs, front) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U, s = PR.s, H = DIM.H * DIM.hs;
  const col = look.hornCol || '#d8cdb0';
  const curl = look.head === 'goat' ? 1 : 0;
  for (const sd of [-1, 1]) {
    const b = surf(C, F, R, U, DIM.headA, DIM.headB, DIM.headC, sd * 0.85, 0.62);
    const pts = [[b.f, b.r, b.z]];
    for (let k = 1; k <= 4; k++) {
      const t = k / 4;
      const out = (1.8 + t * 3.4) * hs * H, up = (3.6 * t - curl * t * t * 4.2) * hs * H * 1.4, back = (1.2 * t + curl * t * t * 5.5) * hs * H;
      pts.push([b.f + R.f * sd * out - F.f * back + U.f * up, b.r + R.r * sd * out - F.r * back + U.r * up, b.z + U.z * up - (curl ? t * t * 2.5 * H : 0)]);
    }
    const isFront = D(pts[2][0], pts[2][1]) > DJ(C);
    if (isFront !== front) continue;
    for (let k = 0; k < 4; k++) {
      const [f1, r1, z1] = pts[k], [f2, r2, z2] = pts[k + 1];
      const w1 = (1.55 - k * 0.34) * hs * H * s, w2 = (1.55 - (k + 1) * 0.34) * hs * H * s;
      seg(g, X(f1, r1), Y(f1, r1, z1), Math.max(0.3, w1), X(f2, r2), Y(f2, r2, z2), Math.max(0.2, w2), col, MAT.bone);
    }
  }
}

// ───────── 해골 ─────────
function skullHead(g, look, a, time, lod) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U, s = PR.s, H = DIM.H * DIM.hs;
  const A = DIM.headA * 0.95, B = DIM.headB * 0.9, Cc = DIM.headC * 0.92;
  const bone = look.cols.skin;
  if (look.horns) horns(g, look, look.horns, false);
  // 아래턱
  T.set(C.f + F.f * A * 0.25 - U.f * Cc * 0.62, C.r + F.r * A * 0.25 - U.r * Cc * 0.62, C.z + F.z * A * 0.25 - U.z * Cc * 0.62);
  ellipsoid(g, T, F, R, U, A * 0.62, B * 0.66, Cc * 0.34, bone, MAT.bone, 0.85);
  HE = { ...ellipsoid(g, C, F, R, U, A, B, Cc, bone, MAT.bone) };
  const fv = faceVis();
  if (fv > -0.3) {
    for (const sd of [-1, 1]) {
      const p = surf(C, F, R, U, A, B, Cc, sd * 0.42, 0.0);
      if (p.vis <= 0.05) continue;
      const ex = X(p.f, p.r), ey = Y(p.f, p.r, p.z), w = 1.3 * s * H * (0.4 + 0.6 * p.vis);
      g.fillStyle = '#0c0806'; g.beginPath(); g.ellipse(ex, ey, w, 1.4 * s * H, 0, 0, TAU); g.fill();
      if (look.glowEyes) glowDot(g, ex, ey, 0.5 * s * H, look.glowEyes, 0.75);
    }
    const n = surf(C, F, R, U, A, B, Cc, 0, -0.32);
    if (n.vis > 0.1) { const nx = X(n.f, n.r), ny = Y(n.f, n.r, n.z); g.fillStyle = '#140c08'; g.beginPath(); g.moveTo(nx, ny - 0.9 * s * H); g.lineTo(nx - 0.7 * s * H, ny + 0.6 * s * H); g.lineTo(nx + 0.7 * s * H, ny + 0.6 * s * H); g.fill(); }
    const m = surf(C, F, R, U, A * 0.95, B, Cc, 0, -0.68);
    if (m.vis > 0.1 && lod > 0) {
      const mx = X(m.f, m.r), my = Y(m.f, m.r, m.z), w = 2.1 * s * H * (0.4 + 0.6 * m.vis);
      g.strokeStyle = '#2a2018'; g.lineWidth = 0.4 * s * H;
      g.beginPath(); g.moveTo(mx - w, my); g.lineTo(mx + w, my); for (let k = -2; k <= 2; k++) { g.moveTo(mx + k * w * 0.4, my - 0.7 * s * H); g.lineTo(mx + k * w * 0.4, my + 0.7 * s * H); } g.stroke();
    }
  }
  const hm = look.helm;
  if (hm?.type === 'crown') crown(g, hm);
  else if (hm?.type === 'cap' || hm?.type === 'skullcap') capVolume(g, hm, true);
  else if (hm) { helmVolume(g, hm, 1.08, false); }
  if (look.horns) horns(g, look, look.horns, true);
}

// ───────── 짐승 머리(염소·짐승) ─────────
function beastHead(g, look, a, time, lod, kind) {
  const C = J.head, F = FR.head.F, R = FR.head.R, U = FR.head.U, s = PR.s, H = DIM.H * DIM.hs;
  const A = DIM.headA, B = DIM.headB, Cc = DIM.headC;
  const skin = look.cols.skin;
  if (look.horns) horns(g, look, look.horns, false);
  // 주둥이(앞으로 길게, 아래로 처진다)
  const snoutL = kind === 'goat' ? 1.05 : 0.85;
  T.set(C.f + F.f * A * 1.0 * snoutL - U.f * Cc * 0.4, C.r + F.r * A * 1.0 * snoutL - U.r * Cc * 0.4, C.z + F.z * A * 1.0 * snoutL - U.z * Cc * 0.4);
  const front = DJ(T) > DJ(C);
  const snout = () => {
    T2.set((C.f + T.f) / 2, (C.r + T.r) / 2, (C.z + T.z) / 2);
    ellipsoid(g, T2, F, R, U, A * 0.75, B * 0.58, Cc * 0.45, skin, SKM);
    ellipsoid(g, T, F, R, U, A * 0.32, B * 0.48, Cc * 0.36, look.cols.nose || skin, SKM, 0.8);
    if (lod > 0) {
      g.fillStyle = '#140a06';
      for (const sd of [-1, 1]) { const p = surf(T, F, R, U, A * 0.32, B * 0.48, Cc * 0.36, sd * 0.45, 0.15); if (p.vis > 0.1) { g.beginPath(); g.arc(X(p.f, p.r), Y(p.f, p.r, p.z), 0.38 * s * H, 0, TAU); g.fill(); } }
    }
  };
  if (!front) snout();
  HE = { ...ellipsoid(g, C, F, R, U, A * 0.92, B, Cc * 0.95, skin, SKM) };
  // 귀
  for (const sd of [-1, 1]) {
    const p = surf(C, F, R, U, A, B, Cc, sd * 1.45, 0.25);
    const e = { f: p.f - F.f * 1.5 * H + R.f * sd * 3 * H, r: p.r - F.r * 1.5 * H + R.r * sd * 3 * H, z: p.z - 1.2 * H };
    if (p.vis > -0.3) seg(g, X(p.f, p.r), Y(p.f, p.r, p.z), 1.15 * s * H, X(e.f, e.r), Y(e.f, e.r, e.z), 0.6 * s * H, skin, SKM);
  }
  if (front) snout();
  // 눈
  for (const sd of [-1, 1]) {
    const p = surf(C, F, R, U, A * 0.92, B, Cc * 0.95, sd * 0.55, 0.14);
    if (p.vis <= 0.05) continue;
    const ex = X(p.f, p.r), ey = Y(p.f, p.r, p.z);
    if (look.glowEyes) glowDot(g, ex, ey, 0.55 * s * H, look.glowEyes, 0.65);
    else { g.fillStyle = '#e8c040'; g.beginPath(); g.ellipse(ex, ey, 0.7 * s * H, 0.5 * s * H, 0, 0, TAU); g.fill(); g.fillStyle = '#100800'; g.fillRect(ex - 0.45 * s * H, ey - 0.11 * s * H, 0.9 * s * H, 0.22 * s * H); }
  }
  // 염소 수염
  if (kind === 'goat' && front) {
    const b = { f: T.f - F.f * 1 * H, r: T.r - F.r * 1 * H, z: T.z - 2 * H };
    seg(g, X(b.f, b.r), Y(b.f, b.r, b.z), 0.9 * s * H, X(b.f, b.r), Y(b.f, b.r, b.z - 3.5 * H), 0.25 * s * H, look.cols.beard || look.cols.torso || skin, MAT.fur);
  }
  if (look.helm) helmVolume(g, look.helm, 1.06, false);
  if (look.horns) horns(g, look, look.horns, true);
}

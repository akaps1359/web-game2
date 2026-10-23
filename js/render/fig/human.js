// 사람형 몸: 다리(허벅지·종아리·장화·발), 단면 고리로 이은 몸통(옷·가죽·사슬·판금·맨살·갈비뼈), 허리띠, 치마·로브·망토, 팔·손·어깨 갑옷,
// 머리, 무기·방패, 날개·꼬리를 깊이 순서대로 그린다
import { PR, X, Y, XJ, YJ, DJ, V3, seg, segJ, ball, ellipsoid, projEllipse, shaggy, ring, ringFront, makeRing, loftPath, fillCyl, tone, MAT, skinMat, TAU, PI, lerp } from './core.js';
import { J, FR, FT, DIM, WD } from './pose.js';
import { drawHead } from './head.js';
import { drawWeapon, drawBow, drawShield, shieldCenter } from './gear.js';

const RG = [makeRing(), makeRing(), makeRing(), makeRing(), makeRing(), makeRing()];
const BELT = makeRing(), HEM = makeRing();
const T1 = new V3(), T2 = new V3(), T3 = new V3(), PN = new V3(), PT = new V3();

// 갑옷 종류 → 재질
const ARM_MAT = { cloth: 'cloth', robe: 'cloth', leather: 'leather', studded: 'leather', ring: 'scale', chain: 'scale', scale: 'scale', plate: 'metal', field: 'metal', gothic: 'metal', full: 'metal' };
function torsoMat(look) {
  if (look.skel) return MAT.bone;
  if (look.armor) return MAT[ARM_MAT[look.armor] || 'cloth'];
  if (look.cols.torso === look.cols.skin) return skinMat(look);
  return look.torsoMat ? MAT[look.torsoMat] : MAT.cloth;
}
function limbMat(look, col) {
  if (look.skel) return MAT.bone;
  if (col === look.cols.skin) return skinMat(look);
  if (look.legMat && col === look.cols.legs) return MAT[look.legMat];
  const m = look.armor && ARM_MAT[look.armor];
  if (m === 'metal' && col === look.cols.torso) return MAT.metal;
  if (m === 'scale' && col === look.cols.torso) return MAT.scale;
  return MAT.cloth;
}

// ───────── 그리기 목록 ─────────
const parts = []; const pool = []; let pc = 0;
function part(d, k, side) {
  let p = pool[pc]; if (!p) { p = {}; pool.push(p); } pc++;
  p.d = d; p.k = k; p.side = side; parts.push(p);
  return p;
}

export function drawHuman(g, a, look, p, time, lod, smear) {
  parts.length = 0; pc = 0;
  const H = DIM.H;
  const dTorso = (DJ(J.pel) + DJ(J.chest)) / 2;
  // 다리
  for (const sd of [-1, 1]) {
    const hip = sd < 0 ? J.hipL : J.hipR, kn = sd < 0 ? J.knL : J.knR, an = sd < 0 ? J.anL : J.anR;
    const dl = (DJ(hip) + DJ(kn) + DJ(an)) / 3;
    part(Math.min(dl - 0.5, dTorso + 1.5), 'leg', sd);
  }
  if (look.robe) part(Math.max(DJ(J.knL), DJ(J.knR), dTorso) + 0.6, 'robe');
  else if (look.skirt || look.armor === 'plate' || look.armor === 'field' || look.armor === 'gothic' || look.armor === 'full' || look.armor === 'chain' || look.armor === 'scale' || look.armor === 'ring') part(Math.max(DJ(J.knL), DJ(J.knR), dTorso) + 0.4, 'skirt');
  part(dTorso, 'torso');
  if (look.cape) part(capeDepth(), 'cape');
  // 팔: 몸통보다 앞인지 뒤인지
  for (const sd of [-1, 1]) {
    const sh = sd < 0 ? J.shL : J.shR, el = sd < 0 ? J.elL : J.elR, ha = sd < 0 ? J.haL : J.haR;
    const da = (DJ(sh) + DJ(el) * 2 + DJ(ha)) / 4;
    part(da + 0.6, 'arm', sd);
  }
  if (look.furCollar) part(DJ(J.neck) + 1.2, 'fur');
  if (look.quiver && look.wtype === 'bow') { FR.chest.at(T2, J.chest, -4.5 * H, 0, 0); part(DJ(T2), 'quiver'); }
  part(DJ(J.head) + 2.5, 'head');
  if (look.wtype && look.wtype !== 'bow' && look.wlen) {
    T1.set(J.wGrip.f + WD.f * look.wlen * H * 0.5, J.wGrip.r + WD.r * look.wlen * H * 0.5, J.wGrip.z + WD.z * look.wlen * H * 0.5);
    part(Math.max(DJ(J.haR), DJ(T1)) + 0.9, 'weapon');
  }
  if (look.wtype === 'bow') part(DJ(J.haL) + 1, 'bow');
  if (look.wtype === 'claw') part(Math.max(DJ(J.haR), DJ(J.haL)) + 0.8, 'weapon');
  if (look.shield) { shieldCenter(T2); part(DJ(T2) + 1.4, 'shield'); }
  if (look.wings) { part(DJ(J.wingL) - 1, 'wing', -1); part(DJ(J.wingR) - 1, 'wing', 1); }
  if (look.tail) part(DJ(J.tailB) - 0.5, 'tail');
  parts.sort((x, y) => x.d - y.d);
  for (const q of parts) {
    switch (q.k) {
      case 'leg': leg(g, look, q.side, lod); break;
      case 'torso': torso(g, look, p, time, lod); break;
      case 'skirt': skirt(g, look, p, time); break;
      case 'robe': robe(g, look, p, time, a); break;
      case 'cape': cape(g, look, p, time, a); break;
      case 'arm': armDraw(g, look, q.side, lod); break;
      case 'head': neckDraw(g, look); drawHead(g, look, a, time, lod); break;
      case 'weapon': if (smear) smear(); drawWeapon(g, look, time); break;
      case 'bow': drawBow(g, look, p.bow); break;
      case 'shield': drawShield(g, look); break;
      case 'wing': wing(g, look, q.side, time); break;
      case 'tail': tailDraw(g, look); break;
      case 'fur': furCollar(g, look); break;
      case 'quiver': quiver(g, look); break;
    }
  }
}

function capeDepth() {
  // 등 뒤에 걸린 망토의 깊이
  const C = FR.chest;
  T3.set(J.chest.f - C.F.f * 5 * DIM.H, J.chest.r - C.F.r * 5 * DIM.H, J.chest.z);
  return DJ(T3);
}

// ───────── 다리 ─────────
const DF = new V3(), DB = new V3(), FA3 = new V3(), FB3 = new V3(), FC3 = new V3();
// a에서 b로 가는 축에 수직인, dir 쪽 성분(단위 벡터)
function perp(out, a, b, dir) {
  let ax = b.f - a.f, ay = b.r - a.r, az = b.z - a.z; const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
  const d = dir.f * ax + dir.r * ay + dir.z * az;
  out.set(dir.f - ax * d, dir.r - ay * d, dir.z - az * d);
  const m = Math.hypot(out.f, out.r, out.z) || 1; out.f /= m; out.r /= m; out.z /= m;
  return out;
}
function leg(g, look, sd, lod) {
  const H = DIM.H, s = PR.s, cl = look.cols;
  const hip = sd < 0 ? J.hipL : J.hipR, kn = sd < 0 ? J.knL : J.knR, an = sd < 0 ? J.anL : J.anR;
  const lw = (look.legW || 1) * (look.skel ? 0.42 : 1) * DIM.Bk ** 0.5;
  const legC = cl.legs, bootC = cl.boots || cl.legs;
  if (look.skel) {
    segJ(g, kn, an, 1.0 * H, 0.85 * H, legC, MAT.bone);
    segJ(g, hip, kn, 1.2 * H, 1.0 * H, legC, MAT.bone);
    ball(g, XJ(kn), YJ(kn), 1.45 * s * H, 1.35 * s * H, legC, MAT.bone);
    foot(g, look, sd, an, bootC, 0.7);
    return;
  }
  const F = FR.pel.F;
  if (look.hooves) {
    // 염소 다리: 허벅지 → 뒤로 꺾인 정강이 → 발굽
    T1.set(kn.f - 2.5 * H, kn.r, (kn.z + an.z) / 2 + 1 * H);
    segJ(g, T1, an, 2.0 * H * lw, 1.5 * H * lw, legC, MAT.fur);
    segJ(g, kn, T1, 2.8 * H * lw, 2.0 * H * lw, legC, MAT.fur, 0.1);
    segJ(g, hip, kn, 4.1 * H * lw, 3.0 * H * lw, legC, MAT.fur, 0.1, 0.4, F, 0.15);
    ball(g, XJ(an), YJ(an) + 1 * s * H, 2.0 * s * H, 1.4 * s * H, '#1a1410', MAT.bone);
    return;
  }
  const thighM = limbMat(look, legC);
  // 허벅지 앞쪽 근육, 종아리는 뒤로 불룩
  perp(DF, hip, kn, F); perp(DB, kn, an, F); DB.f = -DB.f; DB.r = -DB.r; DB.z = -DB.z;
  const shin = () => {
    segJ(g, kn, an, 2.3 * H * lw, 1.65 * H * lw, legC, thighM, 0.03, 0.3, DB, 0.34);
    if (bootC !== legC) {
      // 장화: 정강이 아래쪽을 두툼하게 감싸고 위에 접힌 단
      T1.set(lerp(kn.f, an.f, 0.4), lerp(kn.r, an.r, 0.4), lerp(kn.z, an.z, 0.4));
      segJ(g, T1, an, 2.55 * H * lw, 2.15 * H * lw, bootC, MAT.leather, 0.04, 0.3, DB, 0.12);
      T2.set(lerp(kn.f, an.f, 0.47), lerp(kn.r, an.r, 0.47), lerp(kn.z, an.z, 0.47));
      segJ(g, T1, T2, 2.85 * H * lw, 2.75 * H * lw, bootC, MAT.leather);
    }
  };
  const thigh = () => segJ(g, hip, kn, 3.75 * H * lw, 2.4 * H * lw, legC, thighM, 0.04, 0.38, DF, 0.16);
  // 가까운 쪽을 나중에
  T3.set((hip.f + kn.f) / 2, (hip.r + kn.r) / 2, 0);
  if (DJ(T3) > (DJ(kn) + DJ(an)) / 2) { shin(); thigh(); } else { thigh(); shin(); }
  // 무릎 덮개(판금일 때만; 맨 무릎에 공을 붙이면 관절 인형처럼 보인다)
  if (look.kneePad || ARM_MAT[look.armor] === 'metal') {
    perp(FA3, kn, an, F);
    T1.set(kn.f + FA3.f * 1.5 * H * lw, kn.r + FA3.r * 1.5 * H * lw, kn.z + FA3.z * 1.5 * H * lw + 0.4 * H);
    if (DJ(T1) > DJ(kn) - 0.2) ellipsoid(g, T1, FA3, FR.pel.R, FR.pel.U, 0.95 * H, 2.0 * H * lw, 1.9 * H, look.kneePad || cl.legs, MAT.metal);
  }
  foot(g, look, sd, an, bootC, lw);
}

// 발: 발목 아래 투박한 장화(발끝 들림 반영)
function foot(g, look, sd, an, col, lw) {
  const H = DIM.H;
  const yaw = sd < 0 ? FT.yL : FT.yR, pitch = sd < 0 ? FT.pL : FT.pR;
  const cf = Math.cos(yaw), cr = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  if (look.skel) {
    const L = DIM.foot * 0.85, hb = -1.6 * H, tb = L - 1.8 * H, zb = -DIM.ank * 0.62;
    T1.set(an.f + cf * (hb * cp - zb * sp), an.r + cr * (hb * cp - zb * sp), Math.max(an.z + zb * cp + hb * sp, 1.0 * H));
    T2.set(an.f + cf * (tb * cp - zb * sp), an.r + cr * (tb * cp - zb * sp), Math.max(an.z + zb * cp + tb * sp, 0.8 * H));
    segJ(g, T1, T2, 0.9 * H, 0.6 * H, col, MAT.bone, 0.1, 0.35);
    return;
  }
  // 발 축: 앞(발끝), 옆, 위
  FA3.set(cp * cf, cp * cr, sp); FB3.set(-cr, cf, 0); FC3.set(-sp * cf, -sp * cr, cp);
  const cx = 2.0 * H, cz = -DIM.ank * 0.5;
  T1.set(an.f + FA3.f * cx + FC3.f * cz, an.r + FA3.r * cx + FC3.r * cz, Math.max(an.z + FA3.z * cx + FC3.z * cz, 1.3 * H));
  // 맨발이면 살, 다리와 같은 색이면 다리 재질, 아니면 가죽 장화
  const fm = col === look.cols.skin ? skinMat(look) : look.legMat && col === look.cols.legs ? MAT[look.legMat] : MAT.leather;
  ellipsoid(g, T1, FA3, FB3, FC3, 4.3 * H, 2.05 * H * lw, 1.65 * H, col, fm);
  // 밑창
  if (DIM.H * PR.s > 1) {
    T2.set(T1.f - FC3.f * 1.25 * H, T1.r - FC3.r * 1.25 * H, T1.z - FC3.z * 1.25 * H);
    ring(BELT, T2, FA3, FB3, 2.0 * H * lw, 4.2 * H, 1, 1);
    ringFront(g, BELT, 0.75 * PR.s * H, tone(col, 0.32), 0.9);
  }
}

// ───────── 몸통 ─────────
function torsoRings(look, p) {
  const H = DIM.H, Bk = DIM.Bk, fem = look.female ? 1 : 0;
  const Pf = FR.pel, W = FR.waist, C = FR.chest;
  const belly = look.belly || 1;
  // 엉덩이
  Pf.at(T1, J.pel, -0.3 * H, 0, -1.4 * H);
  ring(RG[0], T1, Pf.F, Pf.R, DIM.hipW * 1.38, 3.9 * H * Bk, Math.max(1, belly * 0.85), 1.05);
  // 허리
  ring(RG[1], J.waist, W.F, W.R, 5.0 * H * Bk * (look.waist || 1) * (fem ? 0.84 : 1) * Math.max(1, belly * 0.75), 3.5 * H * Bk, belly, 0.95);
  // 가슴
  C.at(T2, J.chest, 0.2 * H, 0, 1.4 * H);
  ring(RG[2], T2, C.F, C.R, 6.4 * H * Bk ** 0.8 * (look.chestW || 1) * (fem ? 0.88 : 1) * Math.max(1, belly * 0.7), 4.25 * H * Bk, (fem ? 1.22 : 1.08) * Math.max(1, belly * 0.6), 0.95);
  // 어깨선
  C.at(T3, J.chest, -0.5 * H, 0, 4.7 * H);
  ring(RG[3], T3, C.F, C.R, DIM.shW * 0.92, 3.4 * H * Bk ** 0.8, 1, 1);
  // 목 밑
  C.at(T1, J.neck, -0.3 * H, 0, -1.2 * H);
  ring(RG[4], T1, C.F, C.R, 2.7 * H * (look.neckW || 1), 2.5 * H, 1, 1);
}

function torso(g, look, p, time, lod) {
  const H = DIM.H, s = PR.s, cl = look.cols;
  if (look.skel) return ribcage(g, look, lod);
  torsoRings(look, p);
  const col = cl.torso, m = torsoMat(look);
  const { qx, qy } = loftPath(g, RG, 5, false, look.rags ? 1.6 * s * H : 0);
  const E = RG[2];
  // 가로 폭(그라데이션 반지름)
  let mn = 1e9, mx = -1e9;
  for (let i = 0; i < E.x.length; i++) { const v = E.x[i] * qx + E.y[i] * qy; if (v < mn) mn = v; if (v > mx) mx = v; }
  const R = (mx - mn) / 2, cx = (RG[1].cx + RG[2].cx) / 2, cy = (RG[1].cy + RG[2].cy) / 2;
  fillCyl(g, cx, cy, qx, qy, R * 1.02, col, m);
  // 아래쪽(배·엉덩이)은 조금 어둡게
  if (lod > 0 && (lod > 1 || look.armor || look.cracks || cl.torso === cl.skin)) {
    g.save(); g.clip();
    if (lod > 1) {
      const gy = g.createLinearGradient(0, RG[2].cy, 0, RG[0].cy + 4 * s * H);
      gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(0,0,0,0.28)');
      g.fillStyle = gy; g.fillRect(cx - R * 2, RG[4].cy - 10 * s, R * 4, RG[0].cy - RG[4].cy + 20 * s);
    }
    torsoDetail(g, look, cx, cy, R, time, lod);
    g.restore();
  }
  // 허리띠
  if (cl.belt && !look.robe) {
    const W = FR.waist;
    T1.set((J.pel.f + J.waist.f) / 2, (J.pel.r + J.waist.r) / 2, (J.pel.z + J.waist.z) / 2 - 0.6 * H);
    ring(BELT, T1, W.F, W.R, 5.35 * H * DIM.Bk * Math.max(1, (look.belly || 1) * 0.8), 3.9 * H * DIM.Bk, look.belly || 1, 1);
    ringFront(g, BELT, 2.3 * s * H, tone(cl.belt, 0.75));
    ringFront(g, BELT, 1.1 * s * H, tone(cl.belt, 1.05), 0.8);
    // 버클
    let best = 0; for (let i = 1; i < BELT.d.length; i++) if (BELT.d[i] > BELT.d[best]) best = i;
    if (BELT.d[best] > BELT.cd + 0.8 * H) { g.fillStyle = tone('#a08850', 0.95, 0.15); g.fillRect(BELT.x[best] - 0.8 * s * H, BELT.y[best] - 0.9 * s * H, 1.6 * s * H, 1.8 * s * H); }
    // 허리 주머니: 허리띠 옆에 매달린 덮개 달린 가죽 주머니
    if (look.pouches && lod > 0) for (const th of [-0.95, 1.05]) {
      const ca = Math.cos(th), sa = Math.sin(th), Bk = DIM.Bk;
      // 바깥쪽 법선 PN, 띠를 따르는 방향 PT
      PN.set(W.F.f * ca + W.R.f * sa, W.F.r * ca + W.R.r * sa, W.F.z * ca + W.R.z * sa);
      PT.set(-W.F.f * sa + W.R.f * ca, -W.F.r * sa + W.R.r * ca, -W.F.z * sa + W.R.z * ca);
      const rr = (4.6 * Math.abs(ca) + 6.0 * Math.abs(sa)) * H * Bk;
      T2.set(T1.f + PN.f * rr - W.U.f * 1.6 * H, T1.r + PN.r * rr - W.U.r * 1.6 * H, T1.z + PN.z * rr - W.U.z * 1.6 * H);
      if (DJ(T2) < DJ(T1) + 0.5 * H) continue;
      const E = ellipsoid(g, T2, PN, PT, W.U, 0.95 * H, 1.45 * H, 1.75 * H, look.pouchCol || '#4a3220', MAT.leather);
      // 덮개(위쪽을 어둡게)와 단추
      g.save(); g.beginPath(); g.ellipse(E.x, E.y, E.rx, E.ry, E.rot, 0, TAU); g.clip();
      g.fillStyle = 'rgba(16,8,4,0.45)'; g.fillRect(E.x - E.rx - 1, E.y - E.ry * 1.2 - 1, E.rx * 2 + 2, E.ry * 0.95);
      g.restore();
      g.fillStyle = tone('#a08850', 0.8); g.beginPath(); g.arc(E.x, E.y - E.ry * 0.25, 0.32 * s * H, 0, TAU); g.fill();
    }
  }
  if (look.baldric) strap(g, look);
}

// 어깨에서 반대쪽 허리로 가로지르는 띠(칼띠·화살통 끈): 몸통 표면을 따라 보이는 부분만
function strap(g, look) {
  const H = DIM.H, s = PR.s, C = FR.chest, W = FR.waist, Bk = DIM.Bk;
  const pts = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10, th = -0.95 + t * 2.0;
    const fr = t < 0.5 ? C : W;
    const cz = lerp(J.chest.z + 4.2 * H, J.waist.z - 1.5 * H, t), cf = lerp(J.chest.f, J.waist.f, t), cr = lerp(J.chest.r, J.waist.r, t);
    const w = lerp(DIM.shW * 0.95, 5.3 * H * Bk, t) * 1.04, d = lerp(3.9, 3.9, t) * H * Bk * 1.08;
    const ca = Math.cos(th), sa = Math.sin(th);
    const f = cf + fr.F.f * ca * d + fr.R.f * sa * w, r = cr + fr.F.r * ca * d + fr.R.r * sa * w, z = cz + fr.F.z * ca * d + fr.R.z * sa * w;
    const nf = fr.F.f * ca + fr.R.f * sa, nr = fr.F.r * ca + fr.R.r * sa;
    pts.push([X(f, r), Y(f, r, z), nf * PR.df + nr * PR.dr]);
  }
  g.lineCap = 'butt'; g.lineJoin = 'round';
  for (const [lw, k] of [[1.9, 0.45], [1.25, 0.85]]) {
    g.strokeStyle = tone(look.baldric, k); g.lineWidth = lw * s * H;
    g.beginPath(); let on = false;
    for (const [x, y, v] of pts) { if (v > -0.05) { if (!on) { g.moveTo(x, y); on = true; } else g.lineTo(x, y); } else on = false; }
    g.stroke();
  }
}

// 털 깃: 어깨를 덮은 털 덩어리
function furCollar(g, look) {
  const H = DIM.H, C = FR.chest;
  C.at(T1, J.neck, -0.6 * H, 0, -1.8 * H);
  // 털 끝이 삐죽삐죽하고 아래쪽 털이 늘어진 덩어리
  shaggy(g, projEllipse(T1, C.F, C.R, C.U, 4.4 * H * DIM.Bk, DIM.shW * 0.92, 2.1 * H), 26, 0.12, look.furCollar, MAT.fur, 0.35);
}

// 화살통: 등에 비스듬히 메고 위로 깃이 삐져나온다
function quiver(g, look) {
  const H = DIM.H, s = PR.s, C = FR.chest;
  C.at(T1, J.chest, -4.6 * H * DIM.Bk, 2.6 * H, 6.5 * H);
  C.at(T2, J.chest, -4.4 * H * DIM.Bk, -2.4 * H, -9 * H);
  segJ(g, T2, T1, 1.6 * H, 1.9 * H, look.quiverCol || '#4a3220', MAT.leather);
  // 화살 깃
  const x = XJ(T1), y = YJ(T1);
  g.lineCap = 'round';
  for (let k = -2; k <= 2; k++) {
    const dx = (k * 0.7 + 0.8) * s * H, dy = -(3.2 + Math.abs(k) * 0.3) * s * H;
    g.strokeStyle = '#6a5034'; g.lineWidth = 0.4 * s * H; g.beginPath(); g.moveTo(x + k * 0.5 * s * H, y); g.lineTo(x + dx, y + dy); g.stroke();
    g.strokeStyle = k % 2 ? '#c8c0b0' : '#8a2a1a'; g.lineWidth = 0.9 * s * H; g.beginPath(); g.moveTo(x + dx * 0.8, y + dy * 0.8); g.lineTo(x + dx, y + dy); g.stroke();
  }
}

// 옷감·갑옷 무늬(몸통 경로 안에서)
function torsoDetail(g, look, cx, cy, R, time, lod) {
  const H = DIM.H, s = PR.s, cl = look.cols, ar = look.armor;
  const col = cl.torso;
  if (look.cracks) {
    // 용암 악마: 몸에 빛나는 금
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = look.cracks; g.lineWidth = 0.7 * s * H; g.lineCap = 'round'; g.lineJoin = 'round';
    g.globalAlpha *= 0.55 + 0.25 * Math.sin(time * 3);
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const x0 = cx + (k - 2) * R * 0.38, y0 = RG[3].cy + k * 1.3 * s * H;
      g.moveTo(x0, y0); g.lineTo(x0 + R * 0.12, y0 + 4 * s * H); g.lineTo(x0 - R * 0.06, y0 + 8 * s * H); g.lineTo(x0 + R * 0.1, y0 + 12 * s * H);
    }
    g.stroke(); g.restore();
  }
  if (ar === 'plate' || ar === 'field' || ar === 'gothic' || ar === 'full') {
    // 가로 판 이음새(배 쪽)
    for (const k of [0.35, 0.62]) {
      T1.set(lerp(J.pel.f, J.chest.f, k), lerp(J.pel.r, J.chest.r, k), lerp(J.pel.z, J.chest.z, k));
      ring(BELT, T1, FR.waist.F, FR.waist.R, 5.6 * H * DIM.Bk, 4.0 * H * DIM.Bk, 1.05, 1);
      ringFront(g, BELT, 0.7 * s * H, tone(col, 0.5), 0.8);
    }
    // 가슴판 가운데 등줄
    const fv = DJ(FR.chest.F) > 0;
    if (fv) { const a = RG[4], b = RG[1]; let ia = 0, ib = 0; for (let i = 1; i < a.d.length; i++) { if (a.d[i] > a.d[ia]) ia = i; if (b.d[i] > b.d[ib]) ib = i; } g.strokeStyle = tone(col, 1.45, 0.5); g.lineWidth = 0.7 * s * H; g.beginPath(); g.moveTo(a.x[ia], a.y[ia]); g.lineTo(b.x[ib], b.y[ib]); g.stroke(); }
    if (ar === 'gothic' || ar === 'full') { ringFront(g, RG[3], 1.0 * s * H, tone('#d8c070', 1, 0.4), 0.9); }
    return;
  }
  if (ar === 'chain' || ar === 'ring' || ar === 'scale' || ar === 'splint') {
    // 고리·비늘 무늬: 작은 반원을 줄지어
    g.strokeStyle = tone(col, ar === 'scale' ? 0.6 : 0.55); g.lineWidth = Math.max(0.4, 0.35 * s * H); g.globalAlpha *= 0.6;
    const st = (ar === 'scale' ? 2.6 : 1.9) * s * H;
    const x0 = cx - R * 1.2, x1 = cx + R * 1.2, y0 = RG[4].cy - 2 * st, y1 = RG[0].cy + st;
    g.beginPath();
    for (let y = y0, row = 0; y < y1; y += st * 0.8, row++) for (let x = x0 + (row % 2) * st * 0.5; x < x1; x += st) { g.moveTo(x - st * 0.45, y); g.arc(x, y, st * 0.45, PI, 0, true); }
    g.stroke(); g.globalAlpha /= 0.6;
    return;
  }
  if (ar === 'studded') {
    // 거무스름한 쇠 징과 위쪽의 작은 반짝임
    const hi = s * H > 1.5;
    for (const k of [0.3, 0.55, 0.8]) {
      T1.set(lerp(J.pel.f, J.chest.f, k), lerp(J.pel.r, J.chest.r, k), lerp(J.pel.z, J.chest.z, k));
      ring(BELT, T1, FR.waist.F, FR.waist.R, 5.4 * H * DIM.Bk, 3.9 * H * DIM.Bk, 1.05, 1);
      for (let i = 0; i < BELT.d.length; i++) if (BELT.d[i] > BELT.cd) {
        g.fillStyle = tone('#8a8478', 0.62); g.beginPath(); g.arc(BELT.x[i], BELT.y[i], 0.45 * s * H, 0, TAU); g.fill();
        if (hi) { g.fillStyle = tone('#d8d0c0', 0.9); g.beginPath(); g.arc(BELT.x[i] - 0.12 * s * H, BELT.y[i] - 0.15 * s * H, 0.17 * s * H, 0, TAU); g.fill(); }
      }
    }
    return;
  }
  if (ar === 'leather' || ar === 'cloth' || !ar) {
    // 옷: 목에서 가슴으로 내려오는 여밈과 주름
    const fv = DJ(FR.chest.F);
    if (fv > -0.2 && !look.bare && !look.torsoMat && cl.torso !== cl.skin) {
      const a = RG[4], b = RG[1];
      let ia = 0, ib = 0; for (let i = 1; i < a.d.length; i++) { if (a.d[i] > a.d[ia]) ia = i; if (b.d[i] > b.d[ib]) ib = i; }
      g.strokeStyle = tone(col, 0.55); g.lineWidth = 0.6 * s * H; g.lineCap = 'round';
      const mx = (a.x[ia] + b.x[ib]) / 2, my = (a.y[ia] + b.y[ib]) / 2;
      g.beginPath(); g.moveTo(a.x[ia] - 1.6 * s * H, a.y[ia]); g.lineTo(mx, my - 2 * s * H); g.lineTo(a.x[ia] + 1.6 * s * H, a.y[ia]); g.stroke();
      if (cl.skin && ar !== 'leather') { g.fillStyle = tone(cl.skin, 0.95); g.beginPath(); g.moveTo(a.x[ia] - 1.4 * s * H, a.y[ia]); g.lineTo(mx, my - 2.4 * s * H); g.lineTo(a.x[ia] + 1.4 * s * H, a.y[ia]); g.fill(); }
    }
    if (cl.torso === cl.skin && lod > 0) muscles(g, look);
  }
}

// 맨몸: 가슴·배 근육 선
function muscles(g, look) {
  const H = DIM.H, s = PR.s, col = look.cols.skin;
  if (DJ(FR.chest.F) < -0.1) return;
  const C = FR.chest;
  g.strokeStyle = tone(col, 0.62); g.lineWidth = 0.6 * s * H; g.lineCap = 'round';
  // 가슴 아래 선
  for (const sd of [-1, 1]) {
    C.at(T1, J.chest, 4 * H * DIM.Bk, sd * 0.4 * H, 0.3 * H);
    C.at(T2, J.chest, 3.6 * H * DIM.Bk, sd * 5.2 * H * DIM.Bk, 1.6 * H);
    g.beginPath(); g.moveTo(XJ(T1), YJ(T1)); g.quadraticCurveTo((XJ(T1) + XJ(T2)) / 2, YJ(T1) + 1.2 * s * H, XJ(T2), YJ(T2)); g.stroke();
  }
  // 배 가운데 선
  C.at(T1, J.chest, 4.1 * H * DIM.Bk, 0, -0.5 * H);
  FR.waist.at(T2, J.waist, 3.6 * H * DIM.Bk * (look.belly || 1), 0, -2 * H);
  g.globalAlpha *= 0.7; g.beginPath(); g.moveTo(XJ(T1), YJ(T1)); g.lineTo(XJ(T2), YJ(T2)); g.stroke(); g.globalAlpha /= 0.7;
}

// 해골: 척추·갈비뼈·골반
function ribcage(g, look, lod) {
  const H = DIM.H, s = PR.s, col = look.cols.skin;
  const C = FR.chest;
  // 등뼈(뒤쪽)
  C.at(T1, J.neck, -1.2 * H, 0, -1 * H);
  segJ(g, J.pel, J.waist, 1.1 * H, 1.0 * H, col, MAT.bone);
  segJ(g, J.waist, T1, 1.0 * H, 0.9 * H, col, MAT.bone);
  // 골반
  FR.pel.at(T2, J.pel, 0.3 * H, 0, -0.6 * H);
  ellipsoid(g, T2, FR.pel.F, FR.pel.R, FR.pel.U, 2.6 * H, 4.6 * H, 2.4 * H, col, MAT.bone, 0.95);
  // 갈비뼈: 위아래 다섯 줄의 앞쪽 반원
  for (let i = 0; i < 5; i++) {
    const k = i / 4;
    C.at(T3, J.chest, 0.3 * H, 0, (3.6 - k * 6.2) * H);
    ring(BELT, T3, C.F, C.R, (5.6 - Math.abs(k - 0.35) * 2.2) * H, (3.6 - k * 0.6) * H, 1.15, 1);
    ringFront(g, BELT, 1.15 * s * H, tone(col, 0.9 - k * 0.12), 1);
  }
  // 복장뼈
  C.at(T1, J.chest, 3.7 * H, 0, 3.3 * H); C.at(T2, J.chest, 3.6 * H, 0, -0.8 * H);
  if (DJ(T1) > DJ(J.chest)) segJ(g, T1, T2, 0.7 * H, 0.55 * H, col, MAT.bone);
  // 빗장뼈
  segJ(g, J.shL, T1, 0.7 * H, 0.6 * H, col, MAT.bone); segJ(g, J.shR, T1, 0.7 * H, 0.6 * H, col, MAT.bone);
}

// ───────── 치마(갑옷 아랫단·튜닉) ─────────
function skirt(g, look, p, time) {
  const H = DIM.H, s = PR.s, cl = look.cols, W = FR.pel;
  const col = look.skirtCol || cl.torso;
  T1.set(J.pel.f, J.pel.r, J.pel.z + 1.2 * H);
  ring(RG[5], T1, W.F, W.R, DIM.hipW * 1.4, 4.1 * H * DIM.Bk, 1.05, 1.05);
  // 아랫단: 두 허벅지 사이 높이까지, 걸음에 따라 앞뒤로 펄럭
  const kz = Math.min(J.knL.z, J.knR.z);
  const lowZ = J.pel.z - 9.5 * H * (look.skirtL || 1);
  const sway = (J.knL.f + J.knR.f) / 2 - J.pel.f;
  T2.set(J.pel.f + sway * 0.35, J.pel.r, Math.max(lowZ, kz + 1 * H));
  ring(HEM, T2, W.F, W.R, DIM.hipW * 1.65, 4.9 * H * DIM.Bk, 1.1, 1.1);
  // 아래 → 위 순서
  const tmp = [HEM, RG[5]];
  const m = torsoMat(look);
  const bare = m === MAT.skin || m === MAT.hide;
  const rag = m === MAT.cloth || m === MAT.leather || bare ? 1.3 * s * H : 0;
  const { qx, qy } = loftPath(g, tmp, 2, false, rag);
  fillCyl(g, (HEM.cx + RG[5].cx) / 2, (HEM.cy + RG[5].cy) / 2, qx, qy, Math.abs(HEM.x[3] - HEM.x[10]) * 0.6 + 4 * s, col, bare ? MAT.cloth : m);
  // 아랫단 그늘과 갈라진 판
  ringFront(g, HEM, 0.9 * s * H, tone(col, 0.5), 0.8);
  if (m === MAT.metal || m === MAT.scale) {
    g.strokeStyle = tone(col, 0.55); g.lineWidth = 0.6 * s * H;
    for (let i = 0; i < HEM.d.length; i += 2) if (HEM.d[i] > HEM.cd) { g.beginPath(); g.moveTo(HEM.x[i], HEM.y[i]); g.lineTo(RG[5].x[i], RG[5].y[i]); g.stroke(); }
  }
}

// ───────── 로브: 허리에서 발목까지 퍼지는 옷 ─────────
function robe(g, look, p, time, a) {
  const H = DIM.H, s = PR.s, cl = look.cols, W = FR.waist, Pf = FR.pel;
  const col = cl.robe || cl.torso;
  const flare = look.robeFlare || 1;
  // 다리 움직임에 따라 아랫단이 흔들린다
  const legF = ((J.anL.f + J.anR.f) / 2 - J.pel.f) * 0.5, legSpread = Math.abs(J.anL.f - J.anR.f) * 0.25;
  const sway = Math.sin(time * 2 + (a.id || 0)) * 0.6 * H;
  ring(RG[0], J.waist, W.F, W.R, 5.2 * H * DIM.Bk, 3.7 * H * DIM.Bk, 1, 1);
  T1.set(J.pel.f + legF * 0.3, J.pel.r, J.pel.z - 1 * H);
  ring(RG[1], T1, Pf.F, Pf.R, DIM.hipW * 1.45, 4.2 * H * DIM.Bk, 1.05, 1.05);
  const hemZ = Math.max(1.2 * H, Math.min(J.anL.z, J.anR.z) + 1.2 * H) + (look.fly ? 0 : 0);
  T2.set(J.pel.f + legF + sway * 0.3, J.pel.r + sway * 0.2, (J.pel.z + hemZ) / 2);
  ring(RG[2], T2, Pf.F, Pf.R, DIM.hipW * 1.5 * (0.6 + 0.4 * flare) + legSpread * 0.5, 4.6 * H * (0.7 + 0.3 * flare), 1.05, 1.05);
  T3.set(J.pel.f + legF * 1.2 + sway, J.pel.r + sway * 0.4, hemZ);
  ring(HEM, T3, Pf.F, Pf.R, (DIM.hipW * 1.6 + 2 * H) * flare + legSpread, (5.2 * H + legSpread) * flare, 1.05, 1.05);
  const rs = [HEM, RG[2], RG[1], RG[0]];
  const { qx, qy } = loftPath(g, rs, 4, false, 1.6 * s * H);
  const R = Math.abs(HEM.x[3] - HEM.x[10]) * 0.55 + 3 * s;
  fillCyl(g, RG[2].cx, RG[2].cy, qx, qy, R, col, MAT.cloth);
  // 주름: 허리에서 아랫단으로
  g.save(); g.clip();
  g.strokeStyle = tone(col, 0.6); g.lineWidth = 0.9 * s * H; g.lineCap = 'round';
  g.globalAlpha *= 0.75;
  for (let i = 0; i < HEM.d.length; i += 2) {
    if (HEM.d[i] < HEM.cd - 1) continue;
    const j = (i + 1) % HEM.d.length;
    g.beginPath(); g.moveTo(RG[1].x[i], RG[1].y[i]); g.quadraticCurveTo(RG[2].x[j], RG[2].y[j], HEM.x[i], HEM.y[i]); g.stroke();
  }
  g.restore();
  ringFront(g, HEM, 1.2 * s * H, tone(col, 0.45), 0.9);
  if (look.robeTrim) ringFront(g, HEM, 0.8 * s * H, tone(look.robeTrim, 1, 0.3), 0.9);
}

// ───────── 망토: 어깨 뒤에서 늘어진 천 ─────────
function cape(g, look, p, time, a) {
  const H = DIM.H, s = PR.s, C = FR.chest, col = look.cols.cape || '#5a2a24';
  const mv = a.moving ? 1 : 0;
  const sway = Math.sin(time * 2.2 + (a.id || 0)) * 1.2 * H;
  const back = (4 + mv * 5) * H + Math.abs(sway) * 0.5;
  // 위쪽: 어깨 뒤 세 점, 아래쪽: 바닥 근처 세 점
  const top = [], bot = [];
  for (const k of [-1, 0, 1]) {
    C.at(T1, J.chest, -3.2 * H, k * DIM.shW * 0.92, 4.4 * H - Math.abs(k) * 0.8 * H);
    top.push(X(T1.f, T1.r), Y(T1.f, T1.r, T1.z));
    const zb = Math.max(2.5 * H, J.pel.z - 26 * H * (look.capeL || 1));
    const f = J.pel.f - (FR.pel.F.f * back) + k * 0, r = J.pel.r - FR.pel.F.r * back + k * DIM.shW * 1.25 + sway * 0.4;
    bot.push(X(f + FR.pel.R.f * k * DIM.shW * 1.25, r), Y(f + FR.pel.R.f * k * DIM.shW * 1.25, r, zb + sway * 0.2 * k));
  }
  g.beginPath();
  g.moveTo(top[0], top[1]); g.quadraticCurveTo(top[2], top[3] - 1.5 * s * H, top[4], top[5]);
  g.lineTo(bot[4], bot[5]);
  // 해진 아랫자락: 아래 곡선을 따라 들쭉날쭉하게
  const n = 9, cy = bot[3] + 2 * s * H;
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t, rag = i % 2 && i < n ? 1.6 * s * H * (0.7 + ((i * 7) % 5) * 0.15) : 0;
    g.lineTo(u * u * bot[4] + 2 * u * t * bot[2] + t * t * bot[0], u * u * bot[5] + 2 * u * t * cy + t * t * bot[1] + rag);
  }
  g.closePath();
  // 천 질감으로 칠하고 아래로 갈수록 어둡게
  const ax = bot[2] - top[2], ay = bot[3] - top[3], al = Math.hypot(ax, ay) || 1;
  fillCyl(g, (top[2] + bot[2]) / 2, (top[3] + bot[3]) / 2, -ay / al, ax / al, Math.hypot(bot[4] - bot[0], bot[5] - bot[1]) / 2 + 2 * s * H, col, MAT.cloth);
  const gr = g.createLinearGradient(top[2], top[3], bot[2], bot[3]);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(8,4,2,0.4)');
  g.fillStyle = gr; g.fill();
  // 세로 주름
  g.strokeStyle = tone(col, 0.45); g.lineWidth = 0.9 * s * H; g.globalAlpha *= 0.7;
  for (const k of [0.3, 0.55, 0.8]) { g.beginPath(); g.moveTo(top[0] + (top[4] - top[0]) * k, top[1] + (top[5] - top[1]) * k); g.lineTo(bot[0] + (bot[4] - bot[0]) * k, bot[1] + (bot[5] - bot[1]) * k); g.stroke(); }
  g.globalAlpha /= 0.7;
}

// ───────── 팔 ─────────
function armDraw(g, look, sd, lod) {
  const H = DIM.H, s = PR.s, cl = look.cols;
  const sh = sd < 0 ? J.shL : J.shR, el = sd < 0 ? J.elL : J.elR, wr = sd < 0 ? J.wrL : J.wrR;
  const aw = (look.armW || 1) * (look.skel ? 0.4 : 1) * DIM.Bk ** 0.6;
  if (look.skel) {
    segJ(g, sh, el, 1.05 * H, 0.9 * H, cl.arms, MAT.bone);
    segJ(g, el, wr, 0.85 * H, 0.75 * H, cl.fore, MAT.bone);
    ball(g, XJ(el), YJ(el), 1.15 * s * H, 1.1 * s * H, cl.arms, MAT.bone);
    hand(g, look, sd, cl.hands, 0.7);
    return;
  }
  const am = limbMat(look, cl.arms), fm = limbMat(look, cl.fore);
  // 팔꿈치 안쪽(굽는 쪽)이 이두근, 아래팔은 바깥쪽이 불룩
  FA3.set(wr.f - el.f, wr.r - el.r, wr.z - el.z);
  perp(DF, sh, el, FA3);
  DB.set(-DF.f, -DF.r, -DF.z);
  const sleeve = look.robe && cl.fore === (cl.robe || cl.torso);
  const upper = () => segJ(g, sh, el, 2.8 * H * aw, 1.9 * H * aw, cl.arms, am, 0.04, 0.42, DF, 0.2);
  const fore = () => {
    segJ(g, el, wr, 2.15 * H * aw * (sleeve ? 1.15 : 1), (sleeve ? 2.7 : 1.45) * H * aw, cl.fore, fm, sleeve ? 0 : 0.05, 0.28, sleeve ? null : DB, 0.16);
    // 팔목 보호대(가죽 감개)
    if (look.bracers && !sleeve) {
      T1.set(lerp(el.f, wr.f, 0.38), lerp(el.r, wr.r, 0.38), lerp(el.z, wr.z, 0.38));
      segJ(g, T1, wr, 2.05 * H * aw, 1.75 * H * aw, look.bracers, MAT.leather, 0.04);
      for (const k of [0.55, 0.8]) {
        T2.set(lerp(el.f, wr.f, k), lerp(el.r, wr.r, k), lerp(el.z, wr.z, k));
        const x0 = XJ(T2), y0 = YJ(T2), dx = XJ(wr) - XJ(el), dy = YJ(wr) - YJ(el), l = Math.hypot(dx, dy) || 1;
        const w = 2.0 * H * aw * s;
        g.strokeStyle = tone(look.bracers, 0.45); g.lineWidth = 0.55 * s * H;
        g.beginPath(); g.moveTo(x0 - dy / l * w, y0 + dx / l * w); g.lineTo(x0 + dy / l * w, y0 - dx / l * w); g.stroke();
      }
    }
  };
  T3.set((sh.f + el.f) / 2, (sh.r + el.r) / 2, 0);
  if (DJ(T3) > (DJ(el) + DJ(wr)) / 2) { fore(); upper(); } else { upper(); fore(); }
  // 팔꿈치 덮개
  if (look.armor && ARM_MAT[look.armor] === 'metal') {
    // 팔꿈치 바깥쪽에 붙은 납작한 덮개
    T1.set(el.f - DF.f * 0.9 * H * aw, el.r - DF.r * 0.9 * H * aw, el.z - DF.z * 0.9 * H * aw);
    perp(FB3, sh, el, FR.chest.R);
    FC3.set(DF.f, DF.r, DF.z);
    FA3.set(el.f - sh.f, el.r - sh.r, el.z - sh.z); const l = Math.hypot(FA3.f, FA3.r, FA3.z) || 1; FA3.f /= l; FA3.r /= l; FA3.z /= l;
    ellipsoid(g, T1, FA3, FB3, FC3, 1.9 * H * aw, 1.9 * H * aw, 1.15 * H * aw, cl.fore, MAT.metal);
  }
  if (cl.hands !== cl.skin && !look.skel) {
    // 장갑 목
    T1.set(lerp(el.f, wr.f, 0.74), lerp(el.r, wr.r, 0.74), lerp(el.z, wr.z, 0.74));
    segJ(g, T1, wr, 2.05 * H * aw, 1.85 * H * aw, cl.hands, handMat(look));
  }
  hand(g, look, sd, cl.hands, aw, lod);
  if (look.pads && cl.pad) {
    // 어깨 갑옷: 위팔 윗부분을 감싼 껍데기와 겹친 판의 테
    const C = FR.chest, pm = ARM_MAT[look.armor] === 'leather' ? MAT.leather : MAT.metal;
    C.at(T1, sh, -0.3 * H, sd * 0.3 * H, 1.6 * H);
    T2.set(lerp(sh.f, el.f, 0.42), lerp(sh.r, el.r, 0.42), lerp(sh.z, el.z, 0.42));
    segJ(g, T1, T2, 3.7 * H * aw, 3.1 * H * aw, cl.pad, pm, 0.06, 0.35);
    for (const k of [0.12, 0.26, 0.4]) {
      T3.set(lerp(sh.f, el.f, k), lerp(sh.r, el.r, k), lerp(sh.z, el.z, k));
      const x0 = XJ(T3), y0 = YJ(T3), dx = XJ(el) - XJ(sh), dy = YJ(el) - YJ(sh), l = Math.hypot(dx, dy) || 1, w = (3.6 - k * 2) * H * aw * s;
      g.strokeStyle = tone(cl.pad, 0.38); g.lineWidth = 0.6 * s * H; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0 - dy / l * w, y0 + dx / l * w); g.quadraticCurveTo(x0 + dx / l * w * 0.35, y0 + dy / l * w * 0.35, x0 + dy / l * w, y0 - dx / l * w); g.stroke();
    }
  }
}
function handMat(look) { const c = look.cols.hands; return c === '#b8b8c2' || c === '#a0a0aa' || c === '#8a8a92' ? MAT.metal : MAT.leather; }
// 손: 아래팔 방향으로 길쭉한 주먹(장갑이면 가죽·쇠)
function hand(g, look, sd, col, aw, lod = 1) {
  const H = DIM.H;
  const ha = sd < 0 ? J.haL : J.haR, wr = sd < 0 ? J.wrL : J.wrR;
  FA3.set(ha.f - wr.f, ha.r - wr.r, ha.z - wr.z);
  let l = Math.hypot(FA3.f, FA3.r, FA3.z) || 1; FA3.f /= l; FA3.r /= l; FA3.z /= l;
  const R0 = FR.chest.R;
  // 옆 축: 가슴 옆 축에서 손 방향 성분을 뺀 것
  const d = R0.f * FA3.f + R0.r * FA3.r + R0.z * FA3.z;
  FB3.set(R0.f - FA3.f * d, R0.r - FA3.r * d, R0.z - FA3.z * d);
  l = Math.hypot(FB3.f, FB3.r, FB3.z) || 1; FB3.f /= l; FB3.r /= l; FB3.z /= l;
  FC3.set(FA3.r * FB3.z - FA3.z * FB3.r, FA3.z * FB3.f - FA3.f * FB3.z, FA3.f * FB3.r - FA3.r * FB3.f);
  const k = (look.claws ? 1.15 : 1) * aw ** 0.5;
  const m = col === look.cols.skin ? (look.skel ? MAT.bone : skinMat(look)) : handMat(look);
  // 납작한 손바닥(앞뒤로 넓고 옆으로 얇다)과 엄지
  if (!look.skel && lod > 1) {
    T1.set(ha.f - FA3.f * 0.6 * H * k + FC3.f * 1.0 * H * k, ha.r - FA3.r * 0.6 * H * k + FC3.r * 1.0 * H * k, ha.z - FA3.z * 0.6 * H * k + FC3.z * 1.0 * H * k);
    const back = DJ(T1) < DJ(ha);
    if (back) ellipsoid(g, T1, FA3, FB3, FC3, 1.2 * H * k, 0.75 * H * k, 0.75 * H * k, col, m);
    ellipsoid(g, ha, FA3, FB3, FC3, 2.1 * H * k, 1.2 * H * k, 1.6 * H * k, col, m);
    if (!back) ellipsoid(g, T1, FA3, FB3, FC3, 1.2 * H * k, 0.75 * H * k, 0.75 * H * k, col, m);
  } else ellipsoid(g, ha, FA3, FB3, FC3, 2.1 * H * k, 1.3 * H * k, 1.6 * H * k, col, m);
}

// ───────── 목 ─────────
function neckDraw(g, look) {
  const H = DIM.H;
  if (look.helm?.type === 'hood' || look.head === 'skull' && false) return;
  FR.head.at(T1, J.head, -0.6 * H, 0, -DIM.headC * 0.55);
  const col = look.skel ? look.cols.skin : look.cols.skin;
  segJ(g, J.neck, T1, (look.skel ? 0.9 : 2.2) * H * (look.neckW || 1), (look.skel ? 0.8 : 2.0) * H * (look.neckW || 1), col, look.skel ? MAT.bone : skinMat(look));
}

// ───────── 날개·꼬리 ─────────
function wing(g, look, sd, time) {
  const H = DIM.H, s = PR.s, col = look.cols.wing || '#3a2020';
  const root = sd < 0 ? J.wingL : J.wingR, el = sd < 0 ? J.wingL2 : J.wingR2, tip = sd < 0 ? J.wingLe : J.wingRe;
  const rx = XJ(root), ry = YJ(root), ex = XJ(el), ey = YJ(el), tx = XJ(tip), ty = YJ(tip);
  // 막: 뿌리 → 팔꿈치 → 끝 → 손가락 뼈 사이로 아래 가장자리
  const C = FR.chest;
  C.at(T1, J.pel, -3 * H, sd * 3 * H, 0);
  const bx = XJ(T1), by = YJ(T1);
  g.beginPath(); g.moveTo(rx, ry); g.lineTo(ex, ey); g.lineTo(tx, ty);
  const f1x = (tx * 0.55 + bx * 0.45), f1y = (ty * 0.55 + by * 0.45) + 2 * s * H;
  g.quadraticCurveTo((tx + f1x) / 2 + 2 * s * H, (ty + f1y) / 2 + 3 * s * H, f1x, f1y);
  g.quadraticCurveTo((f1x + bx) / 2, (f1y + by) / 2 + 3 * s * H, bx, by);
  g.closePath();
  const gr = g.createLinearGradient(rx, ry, tx, ty);
  gr.addColorStop(0, tone(col, 0.85)); gr.addColorStop(1, tone(col, 0.55));
  g.fillStyle = gr; g.fill();
  // 뼈대
  seg(g, rx, ry, 1.3 * s * H, ex, ey, 1.0 * s * H, col, skinMat(look));
  seg(g, ex, ey, 1.0 * s * H, tx, ty, 0.45 * s * H, col, skinMat(look));
  g.strokeStyle = tone(col, 0.7); g.lineWidth = 0.6 * s * H;
  g.beginPath(); g.moveTo(ex, ey); g.lineTo(f1x, f1y); g.moveTo(ex, ey); g.lineTo((f1x + bx) / 2, (f1y + by) / 2 + 2 * s * H); g.stroke();
}
function tailDraw(g, look) {
  const H = DIM.H, s = PR.s, col = look.cols.skin;
  segJ(g, J.tailA, J.tailB, 1.8 * H, 1.2 * H, col, skinMat(look));
  segJ(g, J.tailB, J.tailC, 1.2 * H, 0.5 * H, col, skinMat(look));
  if (look.spikes) { ball(g, XJ(J.tailC), YJ(J.tailC), 1.3 * s * H, 1.3 * s * H, typeof look.spikes === 'string' ? look.spikes : '#2a1a14', MAT.bone); }
}

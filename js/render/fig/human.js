// 사람형 몸: 다리(허벅지·종아리·장화·발), 단면 고리로 이은 몸통(옷·가죽·사슬·판금·맨살·갈비뼈), 허리띠, 치마·로브·망토, 팔·손·어깨 갑옷,
// 머리, 무기·방패, 날개·꼬리를 깊이 순서대로 그린다
import { PR, X, Y, XJ, YJ, DJ, V3, seg, segJ, ball, ellipsoid, ring, ringFront, makeRing, loftPath, fillCyl, tone, MAT, TAU, PI, lerp } from './core.js';
import { J, FR, FT, DIM, WD } from './pose.js';
import { drawHead } from './head.js';
import { drawWeapon, drawBow, drawShield, shieldCenter } from './gear.js';

const RG = [makeRing(), makeRing(), makeRing(), makeRing(), makeRing(), makeRing()];
const BELT = makeRing(), HEM = makeRing();
const T1 = new V3(), T2 = new V3(), T3 = new V3();

// 갑옷 종류 → 재질
const ARM_MAT = { cloth: 'cloth', robe: 'cloth', leather: 'leather', studded: 'leather', ring: 'scale', chain: 'scale', scale: 'scale', plate: 'metal', field: 'metal', gothic: 'metal', full: 'metal' };
function torsoMat(look) {
  if (look.skel) return MAT.bone;
  if (look.armor) return MAT[ARM_MAT[look.armor] || 'cloth'];
  if (look.cols.torso === look.cols.skin) return look.rock ? MAT.chitin : MAT.skin;
  return look.torsoMat ? MAT[look.torsoMat] : MAT.cloth;
}
function limbMat(look, col) {
  if (look.skel) return MAT.bone;
  if (col === look.cols.skin) return look.rock ? MAT.chitin : MAT.skin;
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
function leg(g, look, sd, lod) {
  const H = DIM.H, s = PR.s, cl = look.cols;
  const hip = sd < 0 ? J.hipL : J.hipR, kn = sd < 0 ? J.knL : J.knR, an = sd < 0 ? J.anL : J.anR;
  const lw = (look.legW || 1) * (look.skel ? 0.42 : 1) * DIM.Bk ** 0.5;
  const legC = cl.legs, bootC = cl.boots || cl.legs;
  if (look.skel) {
    segJ(g, hip, kn, 1.2 * H, 1.0 * H, legC, MAT.bone);
    segJ(g, kn, an, 1.0 * H, 0.85 * H, legC, MAT.bone);
    ball(g, XJ(kn), YJ(kn), 1.45 * s * H, 1.35 * s * H, legC, MAT.bone);
    foot(g, look, sd, an, bootC, 0.7);
    return;
  }
  if (look.hooves) {
    // 염소 다리: 허벅지 → 뒤로 꺾인 정강이 → 발굽
    segJ(g, hip, kn, 4.1 * H * lw, 3.0 * H * lw, legC, MAT.fur, 0.15);
    T1.set(kn.f - 2.5 * H, kn.r, (kn.z + an.z) / 2 + 1 * H);
    segJ(g, kn, T1, 2.8 * H * lw, 2.0 * H * lw, legC, MAT.fur, 0.1);
    segJ(g, T1, an, 2.0 * H * lw, 1.5 * H * lw, legC, MAT.fur);
    ball(g, XJ(an), YJ(an) + 1 * s * H, 2.0 * s * H, 1.4 * s * H, '#1a1410', MAT.bone);
    return;
  }
  const thighM = limbMat(look, legC);
  segJ(g, hip, kn, 3.7 * H * lw, 2.65 * H * lw, legC, thighM, 0.12, 0.38);
  const bootTop = bootC !== legC;
  if (bootTop) {
    // 종아리 위쪽은 바지, 아래는 장화
    T1.set(lerp(kn.f, an.f, 0.42), lerp(kn.r, an.r, 0.42), lerp(kn.z, an.z, 0.42));
    segJ(g, kn, an, 2.6 * H * lw, 1.8 * H * lw, legC, thighM, 0.16, 0.3);
    segJ(g, T1, an, 2.5 * H * lw, 1.95 * H * lw, bootC, MAT.leather, 0.06, 0.2);
    // 장화 목 테두리
    ball(g, XJ(T1), YJ(T1), 2.6 * s * H * lw, 1.25 * s * H * lw, bootC, MAT.leather, 0, 1.1);
  } else segJ(g, kn, an, 2.6 * H * lw, 1.8 * H * lw, legC, thighM, 0.16, 0.3);
  if (look.kneePad) ball(g, XJ(kn), YJ(kn), 2.4 * s * H, 2.2 * s * H, look.kneePad, MAT.metal);
  foot(g, look, sd, an, bootC, lw);
}

// 발: 발목에서 발 방향으로 뻗은 장화(발끝 들림 반영)
function foot(g, look, sd, an, col, lw) {
  const H = DIM.H;
  const yaw = sd < 0 ? FT.yL : FT.yR, pitch = sd < 0 ? FT.pL : FT.pR;
  const cf = Math.cos(yaw), cr = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const L = DIM.foot * (look.skel ? 0.85 : 1);
  // 뒤꿈치·발끝(발목 기준, 발끝 들림으로 회전)
  const hb = -1.8 * H, tb = L - 1.8 * H, zb = -DIM.ank * 0.62;
  const hx = hb * cp - zb * sp, hz = zb * cp + hb * sp;
  const tx = tb * cp - zb * sp, tz = zb * cp + tb * sp;
  T1.set(an.f + cf * hx, an.r + cr * hx, Math.max(an.z + hz, 1.0 * H));
  T2.set(an.f + cf * tx, an.r + cr * tx, Math.max(an.z + tz, 0.8 * H));
  const r1 = (look.skel ? 0.9 : 1.75) * H * lw, r2 = (look.skel ? 0.6 : 1.35) * H * lw;
  segJ(g, T1, T2, r1, r2, col, look.skel ? MAT.bone : MAT.leather, 0.1, 0.35);
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
  const { qx, qy } = loftPath(g, RG, 5);
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
    g.fillStyle = tone('#b8b8c0', 1.2, 0.5);
    for (const k of [0.3, 0.55, 0.8]) {
      T1.set(lerp(J.pel.f, J.chest.f, k), lerp(J.pel.r, J.chest.r, k), lerp(J.pel.z, J.chest.z, k));
      ring(BELT, T1, FR.waist.F, FR.waist.R, 5.4 * H * DIM.Bk, 3.9 * H * DIM.Bk, 1.05, 1);
      for (let i = 0; i < BELT.d.length; i++) if (BELT.d[i] > BELT.cd) { g.beginPath(); g.arc(BELT.x[i], BELT.y[i], 0.55 * s * H, 0, TAU); g.fill(); }
    }
    return;
  }
  if (ar === 'leather' || ar === 'cloth' || !ar) {
    // 옷: 목에서 가슴으로 내려오는 여밈과 주름
    const fv = DJ(FR.chest.F);
    if (fv > -0.2 && !look.bare && cl.torso !== cl.skin) {
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
  const { qx, qy } = loftPath(g, tmp, 2, false);
  fillCyl(g, (HEM.cx + RG[5].cx) / 2, (HEM.cy + RG[5].cy) / 2, qx, qy, Math.abs(HEM.x[3] - HEM.x[10]) * 0.6 + 4 * s, col, m === MAT.skin ? MAT.cloth : m);
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
  const { qx, qy } = loftPath(g, rs, 4, false);
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
  g.quadraticCurveTo(bot[2], bot[3] + 2 * s * H, bot[0], bot[1]);
  g.closePath();
  const gr = g.createLinearGradient(top[2], top[3], bot[2], bot[3]);
  gr.addColorStop(0, tone(col, 0.95)); gr.addColorStop(1, tone(col, 0.55));
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
  segJ(g, sh, el, 2.75 * H * aw, 2.05 * H * aw, cl.arms, am, 0.16, 0.3);
  const sleeve = look.robe && cl.fore === (cl.robe || cl.torso);
  segJ(g, el, wr, 2.1 * H * aw * (sleeve ? 1.15 : 1), (sleeve ? 2.7 : 1.55) * H * aw, cl.fore, fm, sleeve ? 0 : 0.14, 0.3);
  // 팔꿈치 덮개·손목 보호대
  if (look.armor && ARM_MAT[look.armor] === 'metal') ball(g, XJ(el), YJ(el), 2.4 * s * H * aw, 2.2 * s * H * aw, cl.fore, MAT.metal);
  if (cl.hands !== cl.skin && !look.skel) {
    // 장갑 목
    T1.set(lerp(el.f, wr.f, 0.72), lerp(el.r, wr.r, 0.72), lerp(el.z, wr.z, 0.72));
    segJ(g, T1, wr, 2.15 * H * aw, 1.95 * H * aw, cl.hands, cl.hands === '#b8b8c2' || cl.hands === '#a0a0aa' || cl.hands === '#8a8a92' ? MAT.metal : MAT.leather);
  }
  hand(g, look, sd, cl.hands, aw);
  if (look.pads && cl.pad) {
    // 어깨 갑옷
    const C = FR.chest;
    C.at(T1, sh, -0.2 * H, sd * 0.9 * H, 1.0 * H);
    const pm = ARM_MAT[look.armor] === 'leather' ? MAT.leather : MAT.scale;
    ellipsoid(g, T1, C.F, C.R, C.U, 3.3 * H * aw, 3.1 * H * aw, 2.3 * H * aw, cl.pad, pm);
    // 겹친 판의 아래 테
    C.at(T2, T1, 0, sd * 0.6 * H, -1.5 * H);
    ring(BELT, T2, C.F, C.R, 3.2 * H * aw, 3.4 * H * aw, 1, 1);
    ringFront(g, BELT, 0.8 * s * H, tone(cl.pad, 0.55), 0.8);
  }
}
function hand(g, look, sd, col, aw) {
  const H = DIM.H, s = PR.s;
  const ha = sd < 0 ? J.haL : J.haR;
  const r = (look.claws ? 2.1 : 1.85) * H * aw ** 0.5;
  ball(g, XJ(ha), YJ(ha), r * s, r * 0.92 * s, col, col === look.cols.skin ? MAT.skin : MAT.leather);
}

// ───────── 목 ─────────
function neckDraw(g, look) {
  const H = DIM.H;
  if (look.helm?.type === 'hood' || look.head === 'skull' && false) return;
  FR.head.at(T1, J.head, -0.6 * H, 0, -DIM.headC * 0.55);
  const col = look.skel ? look.cols.skin : look.cols.skin;
  segJ(g, J.neck, T1, (look.skel ? 0.9 : 2.2) * H * (look.neckW || 1), (look.skel ? 0.8 : 2.0) * H * (look.neckW || 1), col, look.skel ? MAT.bone : MAT.skin);
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
  seg(g, rx, ry, 1.3 * s * H, ex, ey, 1.0 * s * H, col, MAT.skin);
  seg(g, ex, ey, 1.0 * s * H, tx, ty, 0.45 * s * H, col, MAT.skin);
  g.strokeStyle = tone(col, 0.7); g.lineWidth = 0.6 * s * H;
  g.beginPath(); g.moveTo(ex, ey); g.lineTo(f1x, f1y); g.moveTo(ex, ey); g.lineTo((f1x + bx) / 2, (f1y + by) / 2 + 2 * s * H); g.stroke();
}
function tailDraw(g, look) {
  const H = DIM.H, s = PR.s, col = look.cols.skin;
  segJ(g, J.tailA, J.tailB, 1.8 * H, 1.2 * H, col, MAT.skin);
  segJ(g, J.tailB, J.tailC, 1.2 * H, 0.5 * H, col, MAT.skin);
  if (look.spikes) { ball(g, XJ(J.tailC), YJ(J.tailC), 1.3 * s * H, 1.3 * s * H, typeof look.spikes === 'string' ? look.spikes : '#2a1a14', MAT.bone); }
}

// 무기·방패·활: 손에 쥔 무기를 몸 좌표의 방향으로 그린다(칼날 두 면의 명암, 날 끝 반사, 손잡이·코등이·자루머리)
import { PR, X, Y, XJ, YJ, V3, seg, ball, poly, tone, camNormal, lit, MAT, TAU, PI } from './core.js';
import { J, FR, DIM, WD, WB } from './pose.js';

const P1 = new V3(), P2 = new V3(), P3 = new V3();
// 무기 길이 방향과 날의 넓은 면 방향(몸 좌표)
const SIDE = new V3();
function bladeSide() {
  // 날의 넓은 면은 팔을 굽힌 평면에 놓인다(옆 방향 = 굽힘 평면의 법선을 무기 축에 수직으로)
  const d = WB.f * WD.f + WB.r * WD.r + WB.z * WD.z;
  SIDE.set(WB.f - WD.f * d, WB.r - WD.r * d, WB.z - WD.z * d);
  const l = Math.hypot(SIDE.f, SIDE.r, SIDE.z) || 1;
  SIDE.f /= l; SIDE.r /= l; SIDE.z /= l;
  return SIDE;
}
const at = (out, o, dir, k) => out.set(o.f + dir.f * k, o.r + dir.r * k, o.z + dir.z * k);

let WL = 0;

export function drawWeapon(g, look, time, smear) {
  const t = look.wtype, H = DIM.H, s = PR.s;
  WL = (look.wlen || 0) * H;
  if (!t || t === 'bow') return;
  const c = look.wcol || '#c8ccd4';
  if (t === 'staff') return staff(g, look, time);
  if (t === 'claw') return claws(g, look);
  const grip = J.wGrip;
  // 손잡이 아래쪽(자루머리)
  at(P1, grip, WD, -3.2 * H);
  const side = bladeSide();
  const blade = t === 'sword' || t === 'dagger' || t === 'cleaver' || t === 'scythe';
  if (blade) {
    const L = WL;
    // 손잡이
    seg(g, XJ(P1), YJ(P1), 0.9 * s * H, XJ(grip), YJ(grip), 0.85 * s * H, look.gripCol || '#3a2416', MAT.leather);
    ball(g, XJ(P1), YJ(P1), 1.25 * s * H, 1.25 * s * H, look.guard || '#a88a4a', MAT.gold);
    // 코등이
    at(P2, grip, WD, 1.6 * H);
    const gw = (t === 'dagger' ? 2.2 : t === 'cleaver' ? 1.6 : 3.6) * H * (look.wwide || 1) ** 0.5;
    P3.set(P2.f + side.f * gw, P2.r + side.r * gw, P2.z + side.z * gw);
    const gx1 = XJ(P3), gy1 = YJ(P3);
    P3.set(P2.f - side.f * gw, P2.r - side.r * gw, P2.z - side.z * gw);
    seg(g, gx1, gy1, 0.75 * s * H, XJ(P3), YJ(P3), 0.75 * s * H, look.guard || '#a88a4a', MAT.gold);
    // 날
    const bw = (t === 'cleaver' ? 3.6 : t === 'dagger' ? 1.2 : t === 'scythe' ? 1.2 : 1.55) * H * (look.wwide || 1);
    at(P3, grip, WD, L);
    const tx = XJ(P3), ty = YJ(P3), bx = XJ(P2), by = YJ(P2);
    let sx = (side.f * PR.kfx + side.r * PR.krx) * bw, sy = (side.f * PR.kfy + side.r * PR.kry - side.z * PR.kz) * bw;
    // 날을 옆에서 보면 너무 가늘어 안 보이므로 화면에서 최소 폭을 남긴다
    const sl = Math.hypot(sx, sy), mn = bw * s * 0.45;
    if (sl < mn) {
      const ax = tx - bx, ay = ty - by, al = Math.hypot(ax, ay) || 1, qx = -ay / al, qy = ax / al;
      const sg = sx * qx + sy * qy >= 0 ? 1 : -1;
      sx += qx * sg * (mn - sl); sy += qy * sg * (mn - sl);
    }
    // 넓은 면의 밝기: 면 법선 = 무기축 × 옆
    const nf = WD.r * side.z - WD.z * side.r, nr = WD.z * side.f - WD.f * side.z, nz = WD.f * side.r - WD.r * side.f;
    const n = camNormal(nf, nr, nz);
    const flat = Math.abs(n.z);
    const L1 = lit(n.x * Math.sign(n.z || 1), n.y * Math.sign(n.z || 1), flat, MAT.metal);
    const cl = tone(c, L1.k * 1.05, L1.s), cd = tone(c, L1.k * 0.72, L1.s * 0.3);
    if (t === 'cleaver') {
      poly(g, [bx + sx * 0.3, by + sy * 0.3, tx + sx * 0.4, ty + sy * 0.4, tx + sx * 2.2, ty + sy * 2.2, bx + sx * 2, by + sy * 2], cl);
      g.strokeStyle = tone(c, 1.6, 0.5); g.lineWidth = 0.7 * s * H; g.beginPath(); g.moveTo(tx + sx * 2.2, ty + sy * 2.2); g.lineTo(bx + sx * 2, by + sy * 2); g.stroke();
    } else if (t === 'scythe') {
      seg(g, XJ(P1), YJ(P1), 1 * s * H, tx, ty, 0.9 * s * H, look.wood || '#4a3a2a', MAT.wood);
      poly(g, [tx, ty, tx + sx * 9, ty + sy * 9 + 2 * s, tx + sx * 2, ty + sy * 2 + 3 * s], cl);
    } else {
      // 날 끝으로 갈수록 좁아지고 끝은 뾰족하게
      const ex = tx + (tx - bx) * 0.06, ey = ty + (ty - by) * 0.06;
      poly(g, [bx + sx, by + sy, tx + sx * 0.7, ty + sy * 0.7, ex, ey, bx, by], cl);
      poly(g, [bx - sx, by - sy, tx - sx * 0.7, ty - sy * 0.7, ex, ey, bx, by], cd);
      // 가운데 홈과 날 반사
      g.strokeStyle = tone(c, 0.62); g.lineWidth = Math.max(0.5, 0.35 * s * H); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (tx - bx) * 0.75, by + (ty - by) * 0.75); g.stroke();
      g.strokeStyle = tone(c, 1.7, 0.6); g.lineWidth = Math.max(0.5, 0.3 * s * H); g.beginPath(); g.moveTo(bx + sx, by + sy); g.lineTo(tx + sx * 0.7, ty + sy * 0.7); g.stroke();
    }
    if (look.wglow) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45; g.strokeStyle = look.wglow; g.lineWidth = bw * 2.2 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke(); g.restore(); }
    return;
  }
  // 자루 무기(도끼·둔기·망치·곤봉·창)
  const L = WL;
  at(P2, grip, WD, L);
  const wood = look.wood || '#5a3a20';
  if (t === 'spear') {
    at(P1, grip, WD, -L * 0.35);
    seg(g, XJ(P1), YJ(P1), 0.8 * s * H, XJ(P2), YJ(P2), 0.7 * s * H, wood, MAT.wood);
    at(P3, grip, WD, L + 5 * H);
    const sx = (side.f * PR.kfx + side.r * PR.krx) * 1.6 * H, sy = (side.f * PR.kfy + side.r * PR.kry - side.z * PR.kz) * 1.6 * H;
    poly(g, [XJ(P3), YJ(P3), XJ(P2) + sx, YJ(P2) + sy, XJ(P2) - sx, YJ(P2) - sy], tone(c, 1.1, 0.4));
    return;
  }
  seg(g, XJ(P1), YJ(P1), 0.95 * s * H, XJ(P2), YJ(P2), (t === 'club' ? 1.9 : 0.9) * s * H, t === 'club' ? (look.wcol || wood) : wood, MAT.wood, t === 'club' ? 0.15 : 0);
  if (t === 'axe') {
    const w = 5.5 * H * (look.wwide || 1), hgt = 4.2 * H * (look.wwide || 1) ** 0.7;
    // 도끼날: 자루 끝 옆으로 반달
    const ax = XJ(P2), ay = YJ(P2);
    at(P3, grip, WD, L - hgt);
    const bx = XJ(P3), by = YJ(P3);
    const sx = (side.f * PR.kfx + side.r * PR.krx), sy = (side.f * PR.kfy + side.r * PR.kry - side.z * PR.kz);
    // 날은 몸 바깥쪽(앞)으로, 양날 도끼는 반대쪽에도
    for (const dir of look.double ? [-1, 1] : [-1]) {
      const ox = sx * w * dir, oy = sy * w * dir;
      g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(ax + ox * 0.6, ay + oy * 0.6 - (ay - by) * 0.4, ax + ox, ay + oy + (ay - by) * 0.35);
      g.quadraticCurveTo(ax + ox * 1.15 + (bx - ax) * 0.5, ay + oy * 1.15 + (by - ay) * 0.5, bx + ox, by + oy - (ay - by) * 0.35);
      g.quadraticCurveTo(bx + ox * 0.6, by + oy * 0.6 + (ay - by) * 0.4, bx, by); g.closePath();
      const gr = g.createLinearGradient(ax, ay, ax + ox, ay + oy);
      gr.addColorStop(0, tone(c, 0.7, 0.1)); gr.addColorStop(0.7, tone(c, 1.05, 0.3)); gr.addColorStop(1, tone(c, 1.6, 0.6));
      g.fillStyle = gr; g.fill();
    }
    return;
  }
  if (t === 'hammer') {
    const w = 3.2 * H * (look.wwide || 1);
    at(P3, grip, WD, L - 2.2 * H);
    const sx = (side.f * PR.kfx + side.r * PR.krx) * w, sy = (side.f * PR.kfy + side.r * PR.kry - side.z * PR.kz) * w;
    seg(g, XJ(P2) + sx, YJ(P2) + sy, 2.2 * s * H, XJ(P2) - sx, YJ(P2) - sy, 2.2 * s * H, c, MAT.metal);
    return;
  }
  if (t === 'mace' || t === 'flail') {
    // 날개 달린 철퇴 머리
    const r = 2.6 * H;
    ball(g, XJ(P2), YJ(P2), r * s, r * s, c, MAT.metal);
    g.strokeStyle = tone(c, 0.6); g.lineWidth = 0.8 * s * H; g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const an = i * PI / 3 + 0.3;
      const ox = Math.cos(an) * r * 1.5 * s, oy = Math.sin(an) * r * 1.5 * s;
      g.beginPath(); g.moveTo(XJ(P2) + ox * 0.5, YJ(P2) + oy * 0.5); g.lineTo(XJ(P2) + ox, YJ(P2) + oy); g.stroke();
    }
    return;
  }
}

function staff(g, look, time) {
  const H = DIM.H, s = PR.s;
  const L = WL;
  const grip = J.wGrip;
  at(P1, grip, WD, -L * 0.42);
  at(P2, grip, WD, L * 0.58);
  const wood = look.wood || '#5a3a20';
  // 마디진 지팡이
  seg(g, XJ(P1), YJ(P1), 0.75 * s * H, XJ(P2), YJ(P2), 1.05 * s * H, wood, MAT.wood);
  // 끝의 갈퀴와 보석
  at(P3, grip, WD, L * 0.58 + 2.4 * H);
  const gem = look.gem || '#7ad0ff';
  const pulse = 0.85 + Math.sin(time * 3) * 0.15;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(XJ(P3), YJ(P3), 0, XJ(P3), YJ(P3), 6 * s * H * pulse);
  gr.addColorStop(0, gem); gr.addColorStop(0.25, gem); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.45; g.fillStyle = gr; g.beginPath(); g.arc(XJ(P3), YJ(P3), 6 * s * H * pulse, 0, TAU); g.fill();
  g.restore();
  ball(g, XJ(P3), YJ(P3), 1.7 * s * H, 1.9 * s * H, gem, MAT.gem, 0, 1.15);
  // 보석을 감싼 갈퀴
  g.strokeStyle = tone(wood, 0.9); g.lineWidth = 0.7 * s * H; g.lineCap = 'round';
  g.beginPath(); g.moveTo(XJ(P2) - 1.4 * s * H, YJ(P2)); g.quadraticCurveTo(XJ(P3) - 2.6 * s * H, YJ(P3), XJ(P3) - 0.6 * s * H, YJ(P3) - 2.2 * s * H);
  g.moveTo(XJ(P2) + 1.4 * s * H, YJ(P2)); g.quadraticCurveTo(XJ(P3) + 2.6 * s * H, YJ(P3), XJ(P3) + 0.6 * s * H, YJ(P3) - 2.2 * s * H); g.stroke();
}

function claws(g, look) {
  const H = DIM.H, s = PR.s, c = look.wcol || '#d8d0c0';
  for (const [ha, wr] of [[J.haR, J.wrR], [J.haL, J.wrL]]) {
    const dx = ha.f - wr.f, dy = ha.r - wr.r, dz = ha.z - wr.z, l = Math.hypot(dx, dy, dz) || 1;
    for (let k = -1; k <= 1; k++) {
      const side = FR.chest.R;
      const b = { f: ha.f + side.f * k * 0.8 * H, r: ha.r + side.r * k * 0.8 * H, z: ha.z + side.z * k * 0.8 * H };
      const e = { f: b.f + dx / l * 3.2 * H, r: b.r + dy / l * 3.2 * H, z: b.z + dz / l * 3.2 * H - 1 * H };
      seg(g, X(b.f, b.r), Y(b.f, b.r, b.z), 0.45 * s * H, X(e.f, e.r), Y(e.f, e.r, e.z), 0.12 * s * H, c, MAT.bone);
    }
  }
}

// ───────── 활 ─────────
export function drawBow(g, look, pull) {
  const H = DIM.H, s = PR.s, C = FR.chest;
  const hand = J.haL;
  const L = 21 * H;
  // 활대: 손에서 위아래로, 가슴의 위 축을 따라(조금 앞으로 휜다)
  const U = C.U, F = C.F;
  const top = { f: hand.f + U.f * L - F.f * 2 * H, r: hand.r + U.r * L - F.r * 2 * H, z: hand.z + U.z * L - F.z * 2 * H };
  const bot = { f: hand.f - U.f * L * 0.92 - F.f * 2 * H, r: hand.r - U.r * L * 0.92 - F.r * 2 * H, z: hand.z - U.z * L * 0.92 - F.z * 2 * H };
  const mid = { f: hand.f + F.f * (2.5 + pull * 1.5) * H, r: hand.r + F.r * (2.5 + pull * 1.5) * H, z: hand.z + F.z * 2.5 * H };
  const xt = X(top.f, top.r), yt = Y(top.f, top.r, top.z), xb = X(bot.f, bot.r), yb = Y(bot.f, bot.r, bot.z), xm = X(mid.f, mid.r), ym = Y(mid.f, mid.r, mid.z);
  const wood = look.wcol || '#7a5530';
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(xt, yt); g.quadraticCurveTo(xm * 2 - (xt + xb) / 2, ym * 2 - (yt + yb) / 2, xb, yb);
  g.strokeStyle = tone(wood, 0.55); g.lineWidth = 1.9 * s * H; g.stroke();
  g.strokeStyle = tone(wood, 1.1); g.lineWidth = 1.1 * s * H; g.stroke();
  // 손잡이 감개
  ball(g, XJ(hand), YJ(hand), 1.2 * s * H, 1.6 * s * H, '#3a2416', MAT.leather);
  // 시위: 당기면 오른손까지
  const sx = pull > 0.05 ? XJ(J.haR) : (xt + xb) / 2 - (xm - (xt + xb) / 2) * 0.15, sy = pull > 0.05 ? YJ(J.haR) : (yt + yb) / 2;
  g.strokeStyle = 'rgba(235,225,200,0.85)'; g.lineWidth = Math.max(0.5, 0.35 * s * H);
  g.beginPath(); g.moveTo(xt, yt); g.lineTo(sx, sy); g.lineTo(xb, yb); g.stroke();
  // 화살
  if (pull > 0.15) {
    const ax = XJ(hand) + (XJ(hand) - sx) * 0.25, ay = YJ(hand) + (YJ(hand) - sy) * 0.25;
    g.strokeStyle = '#c8b088'; g.lineWidth = 0.6 * s * H; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ax, ay); g.stroke();
    g.fillStyle = '#d8dce0'; g.beginPath(); g.arc(ax, ay, 0.7 * s * H, 0, TAU); g.fill();
  }
}

// ───────── 방패 ─────────
// 왼팔 바깥에 붙은 원판(원·연·탑 모양), 몸 좌표에서 평면을 잡아 투영한다
export function shieldCenter(out) {
  const C = FR.chest, H = DIM.H;
  // 팔뚝 가운데에서 바깥(왼쪽)·앞으로
  out.set((J.elL.f + J.wrL.f) / 2 + C.F.f * 1.5 * H - C.R.f * 1.8 * H, (J.elL.r + J.wrL.r) / 2 + C.F.r * 1.5 * H - C.R.r * 1.8 * H, (J.elL.z + J.wrL.z) / 2 + 0.8 * H);
  return out;
}
const SC = new V3(), SU = new V3(), SV = new V3(), SN = new V3();
export function drawShield(g, look) {
  const sh = look.shield, H = DIM.H, s = PR.s, C = FR.chest;
  shieldCenter(SC);
  // 방패 면의 법선: 팔뚝 방향과 몸 왼쪽 사이
  const fx = J.wrL.f - J.elL.f, fr = J.wrL.r - J.elL.r, fz = J.wrL.z - J.elL.z, fl = Math.hypot(fx, fr, fz) || 1;
  // 방패의 세로축 SU(대략 위), 가로축 SV(팔뚝 방향)
  SV.set(fx / fl, fr / fl, fz / fl);
  SN.set(-C.R.f * 0.7 + C.F.f * 0.7, -C.R.r * 0.7 + C.F.r * 0.7, -C.R.z * 0.7 + C.F.z * 0.7);
  // SU = SN × SV
  SU.set(SN.r * SV.z - SN.z * SV.r, SN.z * SV.f - SN.f * SV.z, SN.f * SV.r - SN.r * SV.f);
  const ul = Math.hypot(SU.f, SU.r, SU.z) || 1; SU.f /= ul; SU.r /= ul; SU.z /= ul;
  if (SU.z < 0) { SU.f = -SU.f; SU.r = -SU.r; SU.z = -SU.z; }
  // 법선 다시: SV × SU, 바깥(왼쪽 앞)을 보게
  SN.set(SV.r * SU.z - SV.z * SU.r, SV.z * SU.f - SV.f * SU.z, SV.f * SU.r - SV.r * SU.f);
  if (SN.f * (C.F.f - C.R.f) + SN.r * (C.F.r - C.R.r) + SN.z * (C.F.z - C.R.z) < 0) { SN.f = -SN.f; SN.r = -SN.r; SN.z = -SN.z; }
  const R = (sh.size || 8.5) * H;
  const type = sh.type || 'round';
  const pts = [];
  const N = 18;
  for (let i = 0; i < N; i++) {
    const an = (i / N) * TAU;
    let u = Math.cos(an), v = Math.sin(an);
    if (type === 'kite') { if (u < 0) u *= 1.7; v *= 0.85; }
    if (type === 'tower') { u = Math.sign(u) * Math.min(1, Math.abs(u) * 1.4) * 1.35; v = Math.sign(v) * Math.min(1, Math.abs(v) * 1.4) * 0.85; }
    const f = SC.f + (SU.f * u + SV.f * v) * R, r = SC.r + (SU.r * u + SV.r * v) * R, z = SC.z + (SU.z * u + SV.z * v) * R;
    pts.push(X(f, r), Y(f, r, z));
  }
  const n = camNormal(SN.f, SN.r, SN.z);
  const front = n.z > 0;
  const col = sh.color || '#6a4a2a', rim = sh.rim || '#a89060';
  const sgn = front ? 1 : -1;
  const L = lit(n.x * sgn, n.y * sgn, Math.abs(n.z), MAT.leather);
  // 면: 빛 쪽이 밝은 선형 그라데이션
  const cx = XJ(SC), cy = YJ(SC);
  const gr = g.createLinearGradient(cx - R * s, cy - R * s, cx + R * s, cy + R * s);
  gr.addColorStop(0, tone(col, L.k * (front ? 1.18 : 0.7), L.s));
  gr.addColorStop(1, tone(col, L.k * (front ? 0.78 : 0.5)));
  g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath();
  g.fillStyle = gr; g.fill();
  // 테두리
  g.strokeStyle = tone(rim, front ? 0.85 : 0.5, front ? 0.12 : 0); g.lineWidth = 1.1 * s * H; g.lineJoin = 'round'; g.stroke();
  if (front) {
    // 문양과 가운데 돌기
    if (sh.emblem !== false) {
      g.strokeStyle = tone(rim, 0.62); g.lineWidth = 0.75 * s * H;
      g.beginPath();
      const k1 = 0.55;
      const a1 = { f: SC.f + SU.f * R * k1, r: SC.r + SU.r * R * k1, z: SC.z + SU.z * R * k1 }, a2 = { f: SC.f - SU.f * R * k1, r: SC.r - SU.r * R * k1, z: SC.z - SU.z * R * k1 };
      const b1 = { f: SC.f + SV.f * R * k1, r: SC.r + SV.r * R * k1, z: SC.z + SV.z * R * k1 }, b2 = { f: SC.f - SV.f * R * k1, r: SC.r - SV.r * R * k1, z: SC.z - SV.z * R * k1 };
      g.moveTo(X(a1.f, a1.r), Y(a1.f, a1.r, a1.z)); g.lineTo(X(a2.f, a2.r), Y(a2.f, a2.r, a2.z));
      g.moveTo(X(b1.f, b1.r), Y(b1.f, b1.r, b1.z)); g.lineTo(X(b2.f, b2.r), Y(b2.f, b2.r, b2.z));
      g.stroke();
    }
    ball(g, cx, cy, 1.5 * s * H, 1.5 * s * H, rim, MAT.leather, 0, 0.85);
  }
}

// ───────── 휘두른 자국 ─────────
// tips: 화면 좌표 [x, y, ...] 무기 끝의 지난 위치들(오래된 것부터), bases: 손 위치들
export function drawSmear(g, tips, bases, col, alpha) {
  if (tips.length < 6) return;
  const n = tips.length / 2;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = col;
  // 오래된 쪽은 투명하게, 날 끝 쪽만 얇은 띠로
  for (let i = 1; i < n; i++) {
    const a = (i / n) ** 1.5 * alpha;
    g.globalAlpha = a * 0.2;
    const ax = tips[(i - 1) * 2], ay = tips[(i - 1) * 2 + 1], bx = tips[i * 2], by = tips[i * 2 + 1];
    const cx = bases[i * 2], cy = bases[i * 2 + 1], dx = bases[(i - 1) * 2], dy = bases[(i - 1) * 2 + 1];
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.lineTo(dx, dy); g.closePath(); g.fill();
  }
  g.restore();
}

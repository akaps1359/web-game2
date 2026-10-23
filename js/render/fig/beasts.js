// 사람형이 아닌 몸: 네발 짐승(단면 고리로 이은 몸통, 네 다리 보행, 꼬리·뿔·가시), 박쥐 악마(막 날개 날갯짓),
// 뱀(물결치며 머리를 든 몸), 거미, 떠다니는 영혼
import { PR, X, Y, D, XJ, YJ, DJ, V3, Frame, seg, segJ, ball, ellipsoid, ring, ringFront, makeRing, loftPath, fillCyl, tone, MAT, TAU, PI, clamp, lerp, ease, seg01, ik, glowDot, surf } from './core.js';

// 걸음 한 바퀴에 나아가는 거리(몸 좌표)
export function beastCycle(look, gb) {
  const H = look.h || 1;
  if (look.plan === 'quad') return H * (look.long || 1) * lerp(40, 66, gb);
  if (look.plan === 'serpent') return 30 * H;
  if (look.plan === 'spider') return 24 * H;
  return 40 * H;
}

export function drawBeast(g, a, look, s, time, lod, st) {
  switch (look.plan) {
    case 'quad': quad(g, a, look, time, lod, st); break;
    case 'flyer': flyer(g, a, look, time, lod); break;
    case 'serpent': serpent(g, a, look, time, lod, st); break;
    case 'spider': spider(g, a, look, time, lod, st); break;
    case 'wraith': if (a.anim?.name !== 'dead') wraith(g, a, look, time); break;
  }
}

const animU = (a) => { const A = a.anim || { name: 'idle', t: 0, dur: 1 }; return [A.name, A.dur ? clamp(A.t / A.dur, 0, 1) : 0, A]; };

// ═════════ 네발 짐승 ═════════
const QR = [makeRing(), makeRing(), makeRing(), makeRing()];
const BF = new Frame();
const QJ = {}; for (const n of ['hipFL', 'hipFR', 'hipHL', 'hipHR', 'kFL', 'kFR', 'kHL', 'kHR', 'fFL', 'fFR', 'fHL', 'fHR', 'tFL', 'tFR', 'tHL', 'tHR', 'neckA', 'neckB', 'head', 'snout', 'jaw', 'c0', 'c1', 'c2', 'c3']) QJ[n] = new V3();
const TL = [new V3(), new V3(), new V3(), new V3(), new V3()];
const parts = []; const pool = []; let pc = 0;
function part(d, k, x) { let p = pool[pc]; if (!p) { p = {}; pool.push(p); } pc++; p.d = d; p.k = k; p.x = x; parts.push(p); return p; }

function quad(g, a, look, time, lod, st) {
  const H = look.h || 1, Bk = look.bulk || 1, Lg = look.long || 1, lw = look.legW || 1;
  const [an, u] = animU(a);
  const Lb = 22 * H * Lg, Hs = 20 * H * (look.legs ?? 1), W = 5.6 * H * Bk;
  // 상태별 몸 움직임
  let lunge = 0, rear = 0, headDown = 0, jaw = 0, roll = 0, drop = 0, flinch = 0;
  if (an === 'attack') {
    const h = a.anim.hitAt ?? 0.5;
    lunge = Math.sin(seg01(u, h * 0.5, Math.min(1, h + 0.3)) * PI) * 7 * H;
    rear = Math.sin(seg01(u, 0, h) * PI) * 3 * H;
    headDown = Math.sin(seg01(u, h * 0.6, Math.min(1, h + 0.25)) * PI) * (look.horns ? 5 : 2.5) * H;
    jaw = look.horns ? 0 : Math.sin(seg01(u, h * 0.5, Math.min(1, h + 0.3)) * PI);
  } else if (an === 'hit') flinch = Math.sin(u * PI) * 3 * H;
  else if (an === 'death' || an === 'dead') { const k = an === 'dead' ? 1 : ease(seg01(u, 0.1, 0.8)); roll = k * 1.35 * ((a.id || 0) % 2 ? 1 : -1); drop = k; jaw = 0.6 * k; }
  else if (an === 'special') rear = Math.sin(u * PI) * 6 * H;
  // 걸음
  const wb = st.wb, gb = st.gb, ph = st.ph;
  const C = beastCycle(look, gb), beta = lerp(0.65, 0.45, gb), S = beta * C;
  const bob = wb * H * lerp(0.6, 1.6, gb) * Math.cos(TAU * ph * 2);
  const breath = Math.sin(time * 2.4 + (a.id || 0)) * 0.35 * H;
  // 몸통 축: 뒤가 조금 낮고, 공격 때 앞으로
  const bz = Hs + bob * 0.5 + breath * 0.3;
  const pitch = (rear - headDown * 0.3) * 0.02;
  BF.set(0, -pitch, roll);
  const cf = lunge - flinch;
  // 단면 고리(엉덩이 → 배 → 가슴 → 어깨)
  const ringsDef = [[-Lb * 0.5, 0.9, 0.85], [-Lb * 0.08, 1.05, 1.0], [Lb * 0.32, 1.0, 1.0], [Lb * 0.52, 0.78, 0.86]];
  for (let i = 0; i < 4; i++) {
    const [f, wk, hk] = ringsDef[i];
    QJ['c' + i].set(cf + f, 0, bz + f * pitch * 0.5 + (i === 3 ? rear * 0.6 : i === 2 ? rear * 0.4 : 0) - drop * (bz - 6 * H));
    ring(QR[i], QJ['c' + i], BF.U, BF.R, W * wk, 6.2 * H * Bk * hk, 1.05, 1.15);
  }
  // 다리: 엉덩이·어깨 관절 → 발 목표(걸음 궤적) → 역운동학
  const legs = [['FL', 1, -1, 0.25], ['FR', 1, 1, 0.75], ['HL', 0, -1, 0], ['HR', 0, 1, 0.5]];
  const trot = { FL: 0, FR: 0.5, HL: 0.5, HR: 0 };
  const upL = 9 * H * (look.legs ?? 1), loL = 8.6 * H * (look.legs ?? 1);
  parts.length = 0; pc = 0;
  for (const [id, front, side, off] of legs) {
    const hip = QJ['hip' + id], kn = QJ['k' + id], ft = QJ['f' + id], tg = QJ['t' + id];
    const ci = front ? 3 : 0;
    const c = QJ['c' + ci];
    hip.set(c.f + (front ? -1.5 : 1.5) * H, side * W * 0.62, c.z - 2.5 * H);
    // 발 기본 위치
    let ff = (front ? Lb * 0.47 : -Lb * 0.42) + cf * (front ? 0.6 : 0.2), fr = side * W * 0.78, fz = 1.0 * H;
    if (wb > 0.001) {
      const phi = (ph + lerp(off, trot[id], gb)) % 1;
      let gf, gz;
      if (phi < beta) { const t = phi / beta; gf = S / 2 - S * t; gz = 1.0 * H; }
      else { const t = (phi - beta) / (1 - beta); gf = -S / 2 + S * ease(t); gz = 1.0 * H + lerp(3.2, 5.5, gb) * H * Math.sin(PI * t); }
      ff = lerp(ff, ff + gf, wb); fz = lerp(fz, gz, wb);
    }
    if (front && rear > 0.5) { fz += rear * 0.8; ff += rear * 0.3; }
    if (drop > 0) { // 쓰러지면 다리를 옆으로 뻗는다
      ff = lerp(ff, hip.f + (front ? 4 : -4) * H, drop); fr = lerp(fr, side * (W + 10 * H) * (roll * side > 0 ? 0.3 : 1), drop); fz = lerp(fz, 2 * H + (roll * side < 0 ? 6 * H : 0), drop);
    }
    tg.set(ff, fr, fz);
    // 앞다리 팔꿈치는 뒤로, 뒷다리 무릎은 앞으로 굽는다
    ik(kn, ft, hip, tg, upL, loL, front ? -1 : 1, side * 0.15, 0);
    const dl = (DJ(hip) + DJ(kn) + DJ(ft)) / 3;
    part(dl, 'leg', [hip, kn, ft, front, side]);
  }
  // 목·머리
  const c3 = QJ.c3;
  QJ.neckA.set(c3.f + 1.5 * H, 0, c3.z + 2.5 * H);
  const hb = Math.sin(TAU * ph * 2) * wb * 0.8 * H;
  QJ.head.set(c3.f + 9 * H * (look.neckL || 1) + lunge * 0.4, 0, c3.z + 5 * H - headDown + hb - drop * 3 * H);
  QJ.neckB.set((QJ.neckA.f + QJ.head.f) / 2, 0, (QJ.neckA.z + QJ.head.z) / 2 + 0.8 * H);
  const dBody = DJ(QJ.c1);
  part(dBody, 'body', null);
  if (look.tail) part(D(-Lb * 0.6, 0), 'tail', null);
  part(DJ(QJ.head) + 3, 'head', null);
  parts.sort((x, y) => x.d - y.d);
  for (const q of parts) {
    if (q.k === 'leg') quadLeg(g, look, q.x, H, lw);
    else if (q.k === 'body') quadBody(g, look, H, lod);
    else if (q.k === 'tail') quadTail(g, look, H, Lb, bz, time, a, drop);
    else if (q.k === 'head') quadHead(g, look, H, jaw, lod, time);
  }
}
function quadLeg(g, look, L, H, lw) {
  const [hip, kn, ft] = L;
  const cl = look.cols, s = PR.s;
  const m = look.chitin ? MAT.chitin : MAT.fur;
  segJ(g, hip, kn, 3.0 * H * lw, 2.0 * H * lw, cl.legs, m, 0.18, 0.35);
  segJ(g, kn, ft, 1.9 * H * lw, 1.35 * H * lw, cl.legs, m, 0.06);
  // 발(발굽·발톱)
  ball(g, XJ(ft), YJ(ft) + 0.5 * s * H, 1.9 * s * H * lw, 1.2 * s * H * lw, cl.boots || cl.legs, MAT.bone, 0, 0.8);
}
function quadBody(g, look, H, lod) {
  const cl = look.cols, s = PR.s;
  const { qx, qy } = loftPath(g, QR, 4);
  const mid = QR[1];
  let mn = 1e9, mx = -1e9;
  for (let i = 0; i < mid.x.length; i++) { const v = mid.x[i] * qx + mid.y[i] * qy; if (v < mn) mn = v; if (v > mx) mx = v; }
  fillCyl(g, (QR[1].cx + QR[2].cx) / 2, (QR[1].cy + QR[2].cy) / 2, qx, qy, (mx - mn) / 2, cl.torso, look.chitin ? MAT.chitin : MAT.fur);
  if (lod > 0) {
    // 배 쪽 그늘
    g.save(); g.clip();
    const gy = g.createLinearGradient(0, QR[1].cy - 4 * s * H, 0, QR[1].cy + 8 * s * H);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(0,0,0,0.32)');
    g.fillStyle = gy; g.fillRect(Math.min(QR[0].cx, QR[3].cx) - 30 * s, QR[1].cy - 20 * s, Math.abs(QR[3].cx - QR[0].cx) + 60 * s, 40 * s);
    // 갈비뼈 결
    for (const k of [0.25, 0.45, 0.65]) {
      const i = k < 0.5 ? 1 : 2;
      ringFront(g, QR[i], 0.5 * s * H, tone(cl.torso, 0.65), 0.35);
    }
    g.restore();
  }
  // 등 가시
  if (look.spikes) {
    const sc = typeof look.spikes === 'string' ? look.spikes : '#2a1a14';
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const c0 = QJ.c0, c3 = QJ.c3;
      const f = lerp(c0.f, c3.f, t), z = lerp(c0.z, c3.z, t) + 6.2 * H * (look.bulk || 1) * (0.86 + Math.sin(t * PI) * 0.18);
      const len = (2.5 + Math.sin(t * PI) * 2.5) * H;
      seg(g, X(f, 0), Y(f, 0, z - 0.5 * H), 1.0 * s * H, X(f - len * 0.5, 0), Y(f - len * 0.5, 0, z + len), 0.15 * s * H, sc, MAT.bone);
    }
  }
}
function quadTail(g, look, H, Lb, bz, time, a, drop) {
  const cl = look.cols, s = PR.s;
  const c0 = QJ.c0;
  let f = c0.f - 4.5 * H, r = 0, z = c0.z + 2.5 * H;
  TL[0].set(f, r, z);
  const sw = Math.sin(time * 3 + (a.id || 0));
  for (let i = 1; i < 5; i++) {
    const ang = -0.5 + i * 0.32 - drop * 0.6;
    f -= 4.2 * H * Math.cos(ang * 0.5); z -= 4.2 * H * Math.sin(ang) * 0.9 * (1 - drop * 0.5);
    r += sw * i * 0.9 * H;
    TL[i].set(f, r, Math.max(1, z));
  }
  for (let i = 0; i < 4; i++) segJ(g, TL[i], TL[i + 1], (1.9 - i * 0.4) * H, (1.5 - i * 0.35) * H, cl.torso, MAT.fur);
  if (look.spikes) ball(g, XJ(TL[4]), YJ(TL[4]), 1.0 * s * H, 1.0 * s * H, typeof look.spikes === 'string' ? look.spikes : '#2a1a14', MAT.bone);
}
const HF = new Frame(), HP = new V3(), HQ = new V3();
function quadHead(g, look, H, jaw, lod, time) {
  const cl = look.cols, s = PR.s, hs = look.headS || 1;
  const head = QJ.head;
  // 목
  segJ(g, QJ.neckA, QJ.neckB, 3.8 * H * (look.bulk || 1) ** 0.6, 3.1 * H, cl.torso, MAT.fur);
  segJ(g, QJ.neckB, head, 3.1 * H, 2.6 * H, cl.torso, MAT.fur);
  HF.set(0, 0.25, 0);
  const F = HF.F, R = HF.R, U = HF.U;
  // 아래턱(입을 벌리면 내려간다)
  HP.set(head.f + 4.5 * H * hs, 0, head.z - 2.6 * H - jaw * 2.2 * H);
  ellipsoid(g, HP, F, R, U, 4.0 * H * hs, 2.2 * H * hs, 1.2 * H * hs, cl.skin, MAT.fur, 0.8);
  if (jaw > 0.3) { g.fillStyle = '#3a0806'; const x = XJ(HP), y = YJ(HP) - 1.2 * s * H; g.beginPath(); g.ellipse(x, y, 3 * s * H * hs, (1 + jaw) * s * H, 0, 0, TAU); g.fill(); }
  // 머리·주둥이
  ellipsoid(g, head, F, R, U, 4.6 * H * hs, 3.6 * H * hs, 3.4 * H * hs, cl.skin, MAT.fur);
  HQ.set(head.f + 5.2 * H * hs, 0, head.z - 1.0 * H);
  ellipsoid(g, HQ, F, R, U, 3.4 * H * hs, 2.3 * H * hs, 2.0 * H * hs, cl.skin, MAT.fur, 0.95);
  // 코
  const n = surf(HQ, F, R, U, 3.4 * H * hs, 2.3 * H * hs, 2.0 * H * hs, 0, 0.2);
  if (n.vis > 0) ball(g, X(n.f, n.r), Y(n.f, n.r, n.z), 1.1 * s * H, 0.8 * s * H, '#1a1210', MAT.leather);
  // 이빨
  if (jaw > 0.3 || look.tusks) {
    g.fillStyle = '#e8e0cc';
    for (const sd of [-1, 1]) { const p = surf(HQ, F, R, U, 3.4 * H * hs, 2.3 * H * hs, 2.0 * H * hs, sd * 0.5, -0.5); if (p.vis > 0) { const x = X(p.f, p.r), y = Y(p.f, p.r, p.z); g.beginPath(); g.moveTo(x - 0.5 * s * H, y); g.lineTo(x, y + 2 * s * H); g.lineTo(x + 0.5 * s * H, y); g.fill(); } }
  }
  // 귀
  for (const sd of [-1, 1]) {
    const p = surf(head, F, R, U, 4.6 * H * hs, 3.6 * H * hs, 3.4 * H * hs, sd * 1.9, 0.75);
    const e = { f: p.f - 2.2 * H, r: p.r + sd * 1.6 * H, z: p.z + 3.4 * H };
    seg(g, X(p.f, p.r), Y(p.f, p.r, p.z), 1.2 * s * H, X(e.f, e.r), Y(e.f, e.r, e.z), 0.25 * s * H, cl.skin, MAT.fur);
  }
  // 눈
  for (const sd of [-1, 1]) {
    const p = surf(head, F, R, U, 4.6 * H * hs, 3.6 * H * hs, 3.4 * H * hs, sd * 0.62, 0.25);
    if (p.vis > 0.05) glowDot(g, X(p.f, p.r), Y(p.f, p.r, p.z), 0.65 * s * H, look.glowEyes || '#ffd040', 0.6);
  }
  // 뿔(앞으로 휜 황소 뿔)
  if (look.horns) {
    const hs2 = look.horns;
    for (const sd of [-1, 1]) {
      const b = surf(head, F, R, U, 4.6 * H * hs, 3.6 * H * hs, 3.4 * H * hs, sd * 1.25, 0.45);
      let pf = b.f, pr = b.r, pz = b.z;
      for (let k = 1; k <= 4; k++) {
        const t = k / 4;
        const nf = b.f + (1.5 * t + 3.5 * t * t) * H * hs2, nr = b.r + sd * (3.5 * t - 1.2 * t * t) * H * hs2, nz = b.z + (3.2 * t - 1.0 * t * t) * H * hs2;
        seg(g, X(pf, pr), Y(pf, pr, pz), (1.5 - (k - 1) * 0.33) * s * H * hs2, X(nf, nr), Y(nf, nr, nz), (1.5 - k * 0.33) * s * H * hs2 + 0.2, look.hornCol || '#e0d8c0', MAT.bone);
        pf = nf; pr = nr; pz = nz;
      }
    }
  }
}

// ═════════ 박쥐 악마 ═════════
const WF = [new V3(), new V3(), new V3(), new V3(), new V3(), new V3()];
const BB = new V3(), BH = new V3();
function flyer(g, a, look, time, lod) {
  const H = look.h || 1, s = PR.s, cl = look.cols;
  const [an, u] = animU(a);
  const dead = an === 'death' || an === 'dead';
  const fallK = dead ? (an === 'dead' ? 1 : ease(seg01(u, 0, 0.7))) : 0;
  const id = a.id || 0;
  // 날갯짓: 빠르게 내리치고 천천히 올린다
  const fp = (time * 5.5 + id * 0.37) % 1;
  let flap = fp < 0.4 ? lerp(1, -0.7, ease(fp / 0.4)) : lerp(-0.7, 1, ease((fp - 0.4) / 0.6));
  let fold = fp >= 0.4 ? Math.sin(((fp - 0.4) / 0.6) * PI) * 0.35 : 0;
  let lunge = 0;
  if (an === 'attack') { const h = a.anim.hitAt ?? 0.5; lunge = Math.sin(seg01(u, h * 0.4, Math.min(1, h + 0.3)) * PI); flap = lerp(flap, 1.1 - lunge * 1.8, lunge); fold *= 1 - lunge; }
  if (dead) { flap = lerp(flap, 0.05, fallK); fold = lerp(fold, 0, fallK); }
  const z = lerp(32 * H + Math.sin(time * 3.2 + id) * 3 * H - flap * 1.8 * H, 2.5 * H, fallK);
  BB.set(lunge * 9 * H, 0, z - lunge * 6 * H);
  // 날개(먼 쪽 먼저)
  const drawWing = (sd) => {
    const el = flap * 0.95, span = 1 - fold;
    // 어깨 → 손목 → 손가락 셋
    WF[0].set(BB.f + 0.5 * H, BB.r + sd * 2.6 * H, BB.z + 2.5 * H);
    WF[1].set(WF[0].f - 1.5 * H, WF[0].r + sd * Math.cos(el) * 11 * H * span, WF[0].z + Math.sin(el) * 11 * H);
    const fingers = [[3.5, 14, 0.25], [0, 13, -0.15], [-4, 10, -0.6]];
    for (let k = 0; k < 3; k++) {
      const [ff, len, dz] = fingers[k];
      const e2 = el + dz * 0.6 - fold * 0.8;
      WF[2 + k].set(WF[1].f + ff * H * span - 2 * H * k * fold, WF[1].r + sd * Math.cos(e2) * len * H * span, WF[1].z + Math.sin(e2) * len * H * 0.9 + dz * 4 * H);
    }
    WF[5].set(BB.f - 3.5 * H, BB.r + sd * 1.8 * H, BB.z - 2.5 * H);
    // 막
    const col = cl.wing || '#2a1a1a';
    g.beginPath();
    g.moveTo(XJ(WF[0]), YJ(WF[0])); g.lineTo(XJ(WF[1]), YJ(WF[1])); g.lineTo(XJ(WF[2]), YJ(WF[2]));
    for (let k = 2; k < 4; k++) {
      const a1 = WF[k], a2 = WF[k + 1];
      const mx = (XJ(a1) + XJ(a2)) / 2, my = (YJ(a1) + YJ(a2)) / 2;
      g.quadraticCurveTo(mx + (XJ(WF[1]) - mx) * 0.3, my + (YJ(WF[1]) - my) * 0.3, XJ(a2), YJ(a2));
    }
    const mx = (XJ(WF[4]) + XJ(WF[5])) / 2, my = (YJ(WF[4]) + YJ(WF[5])) / 2;
    g.quadraticCurveTo(mx + (XJ(WF[1]) - mx) * 0.3, my + (YJ(WF[1]) - my) * 0.3, XJ(WF[5]), YJ(WF[5]));
    g.closePath();
    const up = flap > 0;
    const gr = g.createLinearGradient(XJ(WF[0]), YJ(WF[0]), XJ(WF[3]), YJ(WF[3]));
    gr.addColorStop(0, tone(col, up ? 0.9 : 0.75)); gr.addColorStop(1, tone(col, up ? 0.6 : 0.45));
    g.globalAlpha *= 0.95; g.fillStyle = gr; g.fill(); g.globalAlpha /= 0.95;
    // 뼈
    seg(g, XJ(WF[0]), YJ(WF[0]), 1.1 * s * H, XJ(WF[1]), YJ(WF[1]), 0.7 * s * H, cl.skin, MAT.skin);
    for (let k = 2; k < 5; k++) seg(g, XJ(WF[1]), YJ(WF[1]), 0.55 * s * H, XJ(WF[k]), YJ(WF[k]), 0.2 * s * H, cl.skin, MAT.skin);
    ball(g, XJ(WF[1]), YJ(WF[1]), 0.8 * s * H, 0.8 * s * H, cl.skin, MAT.bone);
  };
  const far = D(0, -1) < D(0, 1) ? -1 : 1;
  drawWing(far);
  // 다리
  for (const sd of [-1, 1]) {
    const hp = { f: BB.f - 2.5 * H, r: BB.r + sd * 1.6 * H, z: BB.z - 3.5 * H };
    const ft = { f: hp.f - 1.5 * H, r: hp.r + sd * 0.5 * H, z: hp.z - 5 * H * (1 - fallK * 0.6) };
    seg(g, X(hp.f, hp.r), Y(hp.f, hp.r, hp.z), 0.8 * s * H, X(ft.f, ft.r), Y(ft.f, ft.r, ft.z), 0.4 * s * H, cl.skin, MAT.skin);
  }
  // 몸통·머리
  const F = { f: 1, r: 0, z: 0 }, R = { f: 0, r: 1, z: 0 }, U = { f: 0, r: 0, z: 1 };
  ellipsoid(g, BB, F, R, U, 4.2 * H, 3.6 * H, 5.0 * H, cl.torso, MAT.fur);
  BH.set(BB.f + 3 * H, BB.r, BB.z + 5 * H);
  for (const sd of [-1, 1]) {
    const b = { f: BH.f - 0.5 * H, r: BH.r + sd * 1.8 * H, z: BH.z + 1.8 * H }, t = { f: b.f - 1 * H, r: b.r + sd * 1.8 * H, z: b.z + 4.5 * H };
    seg(g, X(b.f, b.r), Y(b.f, b.r, b.z), 1.4 * s * H, X(t.f, t.r), Y(t.f, t.r, t.z), 0.2 * s * H, cl.skin, MAT.skin);
  }
  ellipsoid(g, BH, F, R, U, 3.1 * H, 2.9 * H, 2.8 * H, cl.skin, MAT.fur);
  for (const sd of [-1, 1]) {
    const p = surf(BH, F, R, U, 3.1 * H, 2.9 * H, 2.8 * H, sd * 0.5, 0.15);
    if (p.vis > 0) glowDot(g, X(p.f, p.r), Y(p.f, p.r, p.z), 0.55 * s * H, look.glowEyes || '#ff3020', 0.7);
  }
  const m = surf(BH, F, R, U, 3.1 * H, 2.9 * H, 2.8 * H, 0, -0.5);
  if (m.vis > 0.1) { const x = X(m.f, m.r), y = Y(m.f, m.r, m.z); g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(x - 1 * s * H, y); g.lineTo(x - 0.6 * s * H, y + 1.4 * s * H); g.lineTo(x - 0.2 * s * H, y); g.moveTo(x + 0.2 * s * H, y); g.lineTo(x + 0.6 * s * H, y + 1.4 * s * H); g.lineTo(x + 1 * s * H, y); g.fill(); }
  drawWing(-far);
}

// ═════════ 뱀 ═════════
const SN = 14;
const SPx = new Float64Array(SN), SPy = new Float64Array(SN), SPz = new Float64Array(SN);
function serpent(g, a, look, time, lod, st) {
  const H = look.h || 1, s = PR.s, cl = look.cols;
  const [an, u] = animU(a);
  const dead = an === 'death' || an === 'dead';
  const fallK = dead ? (an === 'dead' ? 1 : ease(seg01(u, 0, 0.7))) : 0;
  let strike = 0, jaw = 0;
  if (an === 'attack') { const h = a.anim.hitAt ?? 0.5; strike = Math.sin(seg01(u, h * 0.4, Math.min(1, h + 0.35)) * PI); jaw = strike; }
  const coil = -Math.sin(seg01(u, 0, (a.anim?.hitAt ?? 0.5) * 0.5) * PI) * (an === 'attack' ? 1 : 0);
  const id = a.id || 0;
  const wv = st.wb > 0.01 ? 9 : 2.2;
  // 꼬리(뒤, 바닥)에서 머리(앞, 들어올림)로
  for (let i = 0; i < SN; i++) {
    const t = i / (SN - 1);
    const rise = Math.max(0, (t - 0.62) / 0.38);
    let f = (t - 0.62) * 34 * H + strike * 12 * H * rise * rise - coil * 3 * H * rise;
    let r = Math.sin(t * 9 - time * wv - id) * 5 * H * (1 - rise) * (0.6 + 0.4 * (1 - t));
    let z = 1.8 * H + rise * rise * (17 * H + coil * 2 * H) - strike * 5 * H * rise * rise;
    if (rise > 0) f -= Math.sin(rise * PI) * 3 * H;
    z = lerp(z, 1.6 * H, fallK); r = lerp(r, Math.sin(t * 6 + id) * 4 * H, fallK);
    SPx[i] = f; SPy[i] = r; SPz[i] = z;
  }
  const rad = (t) => H * (t < 0.15 ? lerp(0.6, 2.6, t / 0.15) : t < 0.7 ? lerp(2.6, 3.4, (t - 0.15) / 0.55) : lerp(3.4, 2.4, (t - 0.7) / 0.3));
  // 마디를 깊이 순서로
  const order = [];
  for (let i = 0; i < SN - 1; i++) order.push(i);
  order.sort((p, q) => D((SPx[p] + SPx[p + 1]) / 2, (SPy[p] + SPy[p + 1]) / 2) - D((SPx[q] + SPx[q + 1]) / 2, (SPy[q] + SPy[q + 1]) / 2));
  const headD = D(SPx[SN - 1], SPy[SN - 1]);
  let headDrawn = false;
  const drawHead = () => {
    headDrawn = true;
    const hx = SPx[SN - 1], hy = SPy[SN - 1], hz = SPz[SN - 1];
    const dx = hx - SPx[SN - 2], dy = hy - SPy[SN - 2], dz = hz - SPz[SN - 2];
    const L = Math.hypot(dx, dy, dz) || 1;
    // 머리 축: 앞(목 방향을 수평에 가깝게), 옆, 위
    const fx = dx / L, fy = dy / L, fz = Math.max(-0.3, Math.min(0.3, dz / L)) * 0.4;
    const fl = Math.hypot(fx, fy, fz) || 1;
    const F = { f: fx / fl, r: fy / fl, z: fz / fl }, R = { f: -F.r, r: F.f, z: 0 }, U = { f: 0, r: 0, z: 1 };
    const C = { f: hx + F.f * 2.5 * H, r: hy + F.r * 2.5 * H, z: hz + 0.6 * H };
    if (look.hood) {
      // 목 뒤로 펼친 두건(넓적한 타원)
      const hc = { f: hx - F.f * 1.5 * H, r: hy - F.r * 1.5 * H, z: hz - 1 * H };
      ellipsoid(g, hc, F, R, U, 1.2 * H, 6.5 * H, 6 * H, cl.wing || cl.torso, MAT.scale, 0.9);
    }
    // 아래턱
    const jc = { f: C.f + F.f * 1.5 * H, r: C.r + F.r * 1.5 * H, z: C.z - 1.6 * H - jaw * 2 * H };
    ellipsoid(g, jc, F, R, U, 4 * H, 2.4 * H, 0.9 * H, cl.skin, MAT.scale, 0.8);
    if (jaw > 0.3) { g.fillStyle = '#4a0a0a'; g.beginPath(); g.ellipse(X(jc.f, jc.r), Y(jc.f, jc.r, jc.z) - 1 * s * H, 2.6 * s * H, (0.8 + jaw) * s * H, 0, 0, TAU); g.fill(); }
    ellipsoid(g, C, F, R, U, 5 * H, 3.2 * H, 2.4 * H, cl.skin, MAT.scale);
    for (const sd of [-1, 1]) {
      const p = surf(C, F, R, U, 5 * H, 3.2 * H, 2.4 * H, sd * 0.55, 0.35);
      if (p.vis > 0) glowDot(g, X(p.f, p.r), Y(p.f, p.r, p.z), 0.6 * s * H, look.glowEyes || '#ffd040', 0.55);
    }
    // 혀
    if (!dead && (Math.sin(time * 2.3 + id) > 0.75 || jaw > 0.5)) {
      const t0 = { f: C.f + F.f * 5 * H, r: C.r + F.r * 5 * H, z: C.z - 0.8 * H }, t1 = { f: t0.f + F.f * 3 * H, r: t0.r + F.r * 3 * H, z: t0.z - 0.4 * H };
      g.strokeStyle = '#c02030'; g.lineWidth = 0.4 * s * H; g.beginPath(); g.moveTo(X(t0.f, t0.r), Y(t0.f, t0.r, t0.z)); g.lineTo(X(t1.f, t1.r), Y(t1.f, t1.r, t1.z));
      g.lineTo(X(t1.f + F.f * H + R.f * H, t1.r + F.r * H + R.r * H), Y(t1.f + F.f * H, t1.r + F.r * H + R.r * H, t1.z)); g.moveTo(X(t1.f, t1.r), Y(t1.f, t1.r, t1.z));
      g.lineTo(X(t1.f + F.f * H - R.f * H, t1.r + F.r * H - R.r * H), Y(t1.f + F.f * H, t1.r + F.r * H - R.r * H, t1.z)); g.stroke();
    }
  };
  for (const i of order) {
    const d = D((SPx[i] + SPx[i + 1]) / 2, (SPy[i] + SPy[i + 1]) / 2);
    if (!headDrawn && d > headD + 2 * H) drawHead();
    const t0 = i / (SN - 1), t1 = (i + 1) / (SN - 1);
    const x1 = X(SPx[i], SPy[i]), y1 = Y(SPx[i], SPy[i], SPz[i]), x2 = X(SPx[i + 1], SPy[i + 1]), y2 = Y(SPx[i + 1], SPy[i + 1], SPz[i + 1]);
    seg(g, x1, y1, rad(t0) * s, x2, y2, rad(t1) * s, cl.torso, MAT.scale);
    // 등 무늬
    if (lod > 0 && i % 2 === 0 && i > 1 && i < SN - 2) { g.fillStyle = tone(cl.torso, 0.55); g.beginPath(); g.ellipse((x1 + x2) / 2, (y1 + y2) / 2 - rad(t0) * s * 0.45, rad(t0) * s * 0.5, rad(t0) * s * 0.28, Math.atan2(y2 - y1, x2 - x1), 0, TAU); g.fill(); }
  }
  if (!headDrawn) drawHead();
}

// ═════════ 거미 ═════════
function spider(g, a, look, time, lod, st) {
  const H = look.h || 1, s = PR.s, cl = look.cols;
  const [an] = animU(a);
  const dead = an === 'death' || an === 'dead';
  const z = dead ? 3 * H : 9 * H;
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const sd = i < 4 ? -1 : 1, k = i % 4;
    const ang = (k - 1.5) * 0.48;
    const ph = (st.ph * 2 + (k % 2) * 0.5 + (sd > 0 ? 0.5 : 0)) % 1;
    const sw = st.wb * (ph < 0.5 ? Math.sin(ph * TAU) : 0) * 0.3;
    const kx = Math.cos(ang + sw) * 10 * H, kr = sd * (8 + Math.abs(Math.sin(ang)) * 4) * H;
    const knee = { f: kx, r: kr, z: z + (dead ? 2 : 9) * H + sw * 6 * H }, foot = { f: kx * 1.7, r: kr * 1.9, z: dead ? z + 5 * H : 0.5 * H + Math.max(0, sw) * 6 * H };
    legs.push([D(knee.f, knee.r), knee, foot]);
  }
  legs.sort((p, q) => p[0] - q[0]);
  const body = () => {
    const F = { f: 1, r: 0, z: 0 }, R = { f: 0, r: 1, z: 0 }, U = { f: 0, r: 0, z: 1 };
    ellipsoid(g, { f: -8 * H, r: 0, z: z + 3 * H }, F, R, U, 9 * H, 7.5 * H, 6.5 * H, cl.torso, MAT.chitin);
    if (look.mark) ball(g, X(-8 * H, 0), Y(-8 * H, 0, z + 8 * H), 2.5 * s * H, 3 * s * H, look.mark, MAT.chitin);
    ellipsoid(g, { f: 3 * H, r: 0, z: z + 1 * H }, F, R, U, 5 * H, 4.5 * H, 3.8 * H, cl.skin, MAT.chitin);
    for (let i = -1; i <= 1; i += 2) glowDot(g, X(7 * H, i * 1.4 * H), Y(7 * H, i * 1.4 * H, z + 3 * H), 0.6 * s * H, look.glowEyes || '#ff4020', 0.6);
  };
  const half = legs.length / 2;
  legs.forEach(([, knee, foot], i) => {
    if (i === half) body();
    seg(g, X(0, 0), Y(0, 0, z), 1.4 * s * H, X(knee.f, knee.r), Y(knee.f, knee.r, knee.z), 1.0 * s * H, cl.legs, MAT.chitin);
    seg(g, X(knee.f, knee.r), Y(knee.f, knee.r, knee.z), 1.0 * s * H, X(foot.f, foot.r), Y(foot.f, foot.r, foot.z), 0.4 * s * H, cl.legs, MAT.chitin);
  });
}

// ═════════ 떠다니는 영혼 ═════════
function wraith(g, a, look, time) {
  const H = look.h || 1, s = PR.s, cl = look.cols;
  const z = 10 * H + Math.sin(time * 2 + (a.id || 0)) * 3 * H;
  const x = X(0, 0), y = Y(0, 0, z);
  const col = cl.robe || cl.torso;
  const al = g.globalAlpha;
  g.globalAlpha = al * 0.85;
  g.beginPath();
  g.moveTo(x - 8 * s * H, y - 30 * s * H);
  g.quadraticCurveTo(x - 14 * s * H, y, x - 8 * s * H + Math.sin(time * 5) * 2 * s, y + 10 * s * H);
  for (let i = 0; i <= 4; i++) g.lineTo(x - 8 * s * H + i * 4 * s * H, y + (i % 2 ? 4 : 12) * s * H + Math.sin(time * 6 + i) * 2 * s);
  g.quadraticCurveTo(x + 14 * s * H, y, x + 8 * s * H, y - 30 * s * H);
  g.closePath();
  fillCyl(g, x, y - 10 * s * H, 1, 0, 12 * s * H, col, MAT.cloth);
  g.globalAlpha = al;
  ball(g, x, y - 35 * s * H, 7 * s * H, 7.5 * s * H, col, MAT.cloth);
  g.fillStyle = '#050303'; g.beginPath(); g.ellipse(x + 1 * s, y - 34 * s * H, 4.5 * s * H, 5 * s * H, 0, 0, TAU); g.fill();
  glowDot(g, x - 1.2 * s * H, y - 35 * s * H, 0.9 * s * H, look.glowEyes || '#9fe0ff', 0.7);
  glowDot(g, x + 2.8 * s * H, y - 35 * s * H, 0.9 * s * H, look.glowEyes || '#9fe0ff', 0.7);
}

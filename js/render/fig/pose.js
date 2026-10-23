// 사람형 자세와 뼈대: 상태(서기·걷기·달리기·공격·시전·피격·막기·죽음)에서 자세 값을 만들고,
// 자세 값(골반·척추·팔 각도·발 목표)에서 관절 위치(몸 좌표)를 푼다. 다리는 발 궤적 + 2관절 역운동학이라 발이 미끄러지지 않는다.
// 팔: 위팔 방향(앞으로 든 정도 s, 벌린 정도 a), 위팔 비틀기 t(+ 몸 안쪽), 팔꿈치 굽힘 e, 손목 굽힘 w(무기 방향)
import { V3, Frame, ik, clamp, lerp, ease, seg01, PI, TAU } from './core.js';

// ───────── 관절 ─────────
const JN = ['pel', 'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR', 'tgL', 'tgR', 'waist', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'haL', 'haR',
  'wGrip', 'tmp', 'tmp2', 'tailA', 'tailB', 'tailC', 'wingL', 'wingR', 'wingL2', 'wingR2', 'wingLe', 'wingRe'];
export const J = {};
for (const n of JN) J[n] = new V3();
export const FR = { pel: new Frame(), waist: new Frame(), chest: new Frame(), head: new Frame() };
// 발 방향(몸 좌표 각도)과 발끝 들림
export const FT = { yL: 0, yR: 0, pL: 0, pR: 0 };
// 무기 방향(몸 좌표 단위 벡터)과 무기 날의 옆 방향
export const WD = new V3(0, 0, 1), WB = new V3(1, 0, 0);
// 치수(뼈대를 풀 때 정해진다)
export const DIM = { H: 1, thigh: 15.5, shin: 15, ank: 2.4, hipW: 4.3, shW: 8, upper: 12.3, fore: 11.3, hand: 4, foot: 7, headA: 5, headB: 4.4, headC: 5.4, hs: 1, torsoL: 1, Bk: 1 };

// ───────── 자세 값 ─────────
export function newPose() {
  return {
    pf: 0, pr: 0, pz: 0, yaw: 0, roll: 0, tilt: 0, crouch: 0,
    lean: 0, twist: 0, bend: 0, breath: 0,
    hp: 0, hy: 0,
    sR: 0.1, aR: 0.14, eR: 0.25, tR: 0.3, wR: 0.4, sL: 0.1, aL: 0.14, eL: 0.25, tL: 0.3,
    ikR: 0, hRf: 0, hRr: 0, hRz: 0, ikL: 0, hLf: 0, hLr: 0, hLz: 0, grip2: 0,
    lf: 0, lr: -4, lz: 2.4, lp: 0, rf: 0, rr: 4, rz: 2.4, rp: 0, toe: 0.2,
    fall: 0, fallDir: 1, wing: 0, jaw: 0, bow: 0, tail: 0, smear: 0, spin: 0, glowH: 0, float: 0,
  };
}
const KEYS = Object.keys(newPose());
export function copyPose(dst, src) { for (const k of KEYS) dst[k] = src[k]; return dst; }
function mixPose(dst, a, b, t) { for (const k of KEYS) dst[k] = a[k] + (b[k] - a[k]) * t; return dst; }

// 무기 종류에 따른 기본 공격 방식
export function attackStyle(look, A) {
  if (A.style) return A.style;
  if (look.astyle) return look.astyle;
  const wt = look.wtype;
  if (wt === 'bow') return 'bow';
  if (wt === 'dagger' || wt === 'spear') return 'stab';
  if (wt === 'staff') return 'staffhit';
  if (look.twoHand || wt === 'hammer' || wt === 'cleaver') return 'overhead';
  if (wt === 'claw' || !wt) return 'claw';
  return 'swing';
}

// 손에 든 것에 따른 팔 자세(서 있을 때)
function armsReady(p, look, time, id) {
  const wt = look.wtype;
  if (wt && wt !== 'bow' && wt !== 'staff' && wt !== 'claw') { p.sR = 0.42; p.aR = 0.24; p.eR = 1.15; p.tR = -0.3; p.wR = 0.85; }
  if (wt === 'staff') { p.sR = 0.25; p.aR = 0.26; p.eR = 1.35; p.tR = -0.05; p.wR = 0.12; }
  if (wt === 'bow') { p.sL = 0.18; p.aL = 0.22; p.eL = 0.45; p.tL = 0.25; }
  if (look.twoHand && wt !== 'bow' && wt !== 'staff') { p.sR = 0.38; p.aR = 0.1; p.eR = 1.45; p.tR = 1.0; p.wR = 0.85; p.grip2 = 1; }
  if (look.shield) { p.sL = 0.55; p.aL = 0.3; p.eL = 1.5; p.tL = 0.95; }
  if (look.reach) { const r = look.reach; p.sL = p.sR = 0.25 + 1.1 * r + Math.sin(time * 1.3 + id) * 0.07; p.eL = p.eR = 0.2; p.aL = p.aR = 0.12; p.tL = p.tR = 0.1; }
  if (look.claws || wt === 'claw') { p.sL = p.sR = 0.45; p.aL = p.aR = 0.3; p.eL = p.eR = 1.0; p.tL = p.tR = 0.15; }
}

// ───────── 서 있기 ─────────
function idlePose(p, a, look, time) {
  const H = DIM.H, wt = look.wtype, hw = DIM.hipW;
  const id = a.id || 0;
  const ready = !!(wt || look.shield) && !look.calm;
  const wide = look.wide || 1;
  // 발: 싸울 자세면 왼발을 앞으로, 아니면 나란히
  const st = ready ? 2.8 * H : 0.6 * H;
  p.lf = st; p.lr = -hw * 1.15 * wide; p.rf = -st; p.rr = hw * 1.15 * wide;
  p.lz = p.rz = DIM.ank; p.lp = p.rp = 0; p.toe = ready ? 0.34 : 0.16;
  p.pz = -(ready ? 1.0 : 0.3) * H * (look.crouchK || 1);
  p.yaw = ready ? -0.14 : 0;
  // 숨쉬기·무게 옮기기
  const br = Math.sin(time * 2.1 + id * 1.7);
  p.breath = br * 0.45 * H;
  p.pr = Math.sin(time * 0.6 + id) * 0.45 * H;
  p.roll = -p.pr * 0.012;
  p.lean = (look.hunch || 0) + 0.03 + br * 0.008;
  p.twist = ready ? 0.1 : 0;
  p.hy = -(p.twist + p.yaw) * 0.6;
  p.hp = (look.hunch || 0) * -0.6;
  // 팔
  p.sL = 0.08 + br * 0.015; p.aL = 0.15; p.eL = 0.25; p.tL = 0.35;
  p.sR = 0.08 - br * 0.015; p.aR = 0.15; p.eR = 0.25; p.tR = 0.35; p.wR = 0.4;
  armsReady(p, look, time, id);
  if (look.fly) p.float = 6 * H + Math.sin(time * 2.4 + id) * 1.6 * H;
  if (look.wings) p.wing = Math.sin(time * 1.4 + id) * 0.12;
  p.tail = Math.sin(time * 1.6 + id) * 0.4;
}

// ───────── 걷기·달리기 ─────────
// ph: 왼발 위상(0~1), gb: 달리기 정도(0 걷기 ~ 1 달리기)
export function gaitCycle(look, gb) { return DIM.H * (look.legs ?? 1) * lerp(46, 68, gb) * (look.stride || 1); }
const FOOT = [0, 0, 0, 0];
function footAt(phi, side, look, gb, beta, S, lift, kick) {
  let f, z, pitch;
  if (phi < beta) {
    const u = phi / beta;
    f = S / 2 - S * u; z = DIM.ank;
    pitch = u < 0.16 ? 0.28 * (1 - u / 0.16) * (1 - gb * 0.6) : -0.45 * seg01(u, 0.7, 1);
  } else {
    const u = (phi - beta) / (1 - beta);
    f = -S / 2 + S * ease(u) - kick * Math.sin(PI * u) * (1 - u);
    z = DIM.ank + lift * Math.pow(Math.sin(PI * u), 0.85) + kick * 0.6 * Math.sin(PI * Math.min(1, u * 1.6)) * (1 - u);
    pitch = -0.5 * (1 - u) * (1 - u) + 0.3 * seg01(u, 0.72, 1);
  }
  FOOT[0] = f; FOOT[1] = side * DIM.hipW * lerp(0.95, 0.75, gb) * (look.wide || 1); FOOT[2] = z; FOOT[3] = pitch;
  return FOOT;
}
function gaitPose(p, a, look, ph, gb, time) {
  const H = DIM.H;
  const C = gaitCycle(look, gb);
  const beta = lerp(0.6, 0.42, gb);
  const S = beta * C;
  const lift = H * lerp(3.0, 7.0, gb) * (look.lift || 1);
  const kick = H * lerp(0, 4.5, gb) * (look.lift || 1);
  let F = footAt(ph, -1, look, gb, beta, S, lift, kick);
  p.lf = F[0]; p.lr = F[1]; p.lz = F[2]; p.lp = F[3];
  F = footAt((ph + 0.5) % 1, 1, look, gb, beta, S, lift, kick);
  p.rf = F[0]; p.rr = F[1]; p.rz = F[2]; p.rp = F[3];
  p.toe = 0.12;
  const w = TAU * (2 * ph - beta);
  p.pz = -H * lerp(0.4, 1.6, gb) * (look.crouchK || 1) + H * lerp(1.0, -1.1, gb) * Math.cos(w) * (look.bounce ?? 1);
  p.pr = -DIM.hipW * lerp(0.22, 0.08, gb) * Math.cos(TAU * (ph - beta / 2));
  p.pf = H * lerp(0.4, 2.2, gb);
  const yawA = lerp(0.11, 0.14, gb);
  p.yaw = yawA * Math.cos(TAU * ph);
  p.roll = lerp(0.035, 0.02, gb) * Math.sin(TAU * (ph - beta / 2));
  p.twist = -1.5 * yawA * Math.cos(TAU * ph);
  p.lean = (look.hunch || 0) + lerp(0.05, 0.2, gb);
  p.hy = -(p.yaw + p.twist) * 0.85;
  p.hp = -p.lean * 0.55 + (look.hunch || 0) * -0.3;
  p.breath = 0;
  // 팔은 반대쪽 다리와 함께
  const am = lerp(0.36, 0.7, gb) * (look.armSwing ?? 1);
  const swR = am * Math.cos(TAU * ph), swL = -am * Math.cos(TAU * ph);
  const el = lerp(0.3, 1.5, gb);
  p.sR = 0.05 + swR; p.eR = el + Math.max(0, swR) * 0.45; p.aR = 0.13; p.tR = 0.35;
  p.sL = 0.05 + swL; p.eL = el + Math.max(0, swL) * 0.45; p.aL = 0.13; p.tL = 0.35;
  const wt = look.wtype;
  if (wt && wt !== 'bow' && wt !== 'staff' && wt !== 'claw') { p.sR = 0.35 + swR * 0.35; p.aR = 0.22; p.eR = lerp(1.1, 1.4, gb); p.tR = -0.25; p.wR = 0.75; }
  if (wt === 'staff') { p.sR = 0.22 + swR * 0.3; p.aR = 0.24; p.eR = 1.3; p.tR = 0; p.wR = 0.1 + swR * 0.15; }
  if (look.twoHand && wt !== 'bow' && wt !== 'staff') { p.sR = 0.35 + swR * 0.12; p.aR = 0.1; p.eR = 1.45; p.tR = 1.0; p.wR = 0.85; p.grip2 = 1; }
  if (look.shield) { p.sL = 0.5 + swL * 0.15; p.aL = 0.28; p.eL = 1.5; p.tL = 0.9; }
  if (look.reach) { const r = look.reach; p.sL = p.sR = 0.25 + 1.1 * r + Math.sin(TAU * ph) * 0.08; p.eL = p.eR = 0.2; p.aL = p.aR = 0.12; p.tL = p.tR = 0.1; }
  if (look.claws || wt === 'claw') { p.sL = 0.45 + swL * 0.35; p.sR = 0.45 + swR * 0.35; p.aL = p.aR = 0.3; p.eL = p.eR = 1.0; }
  if (look.fly) { p.float = 6 * H; p.lz = p.rz = DIM.ank + 4 * H; p.lf = 2 * H; p.rf = -1 * H; p.lp = p.rp = -0.5; p.pz = 0; }
  if (look.wings) p.wing = Math.sin(TAU * ph * 2) * 0.25;
  p.tail = Math.sin(TAU * ph) * 0.7;
}

// ───────── 열쇠틀(키프레임) ─────────
// keys: [[시각, {자세 값(절댓값)}, 곡선], ...]. 첫·끝 열쇠는 밑바탕 자세. 열쇠에 없는 값은 밑바탕을 따른다
function applyKeys(p, base, keys, u) {
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [t0, k0, e0] = keys[i], [t1, k1] = keys[i + 1];
  let x = clamp((u - t0) / Math.max(1e-4, t1 - t0), 0, 1);
  const curve = e0 || 'smooth';
  x = curve === 'in' ? x * x * (2 - x) * x : curve === 'out' ? 1 - (1 - x) * (1 - x) * (1 - x) : curve === 'lin' ? x : ease(x);
  // 앞뒤 열쇠에 나온 값만 움직인다
  for (const k in k0) { const b = k in k1 ? k1[k] : base[k]; p[k] = k0[k] + (b - k0[k]) * x; }
  for (const k in k1) if (!(k in k0)) p[k] = base[k] + (k1[k] - base[k]) * x;
}
const K = (t, o, c) => [t, o, c];

// 공격 동작. h: 타격 시점(0~1)
function attackKeys(style, h, look, H) {
  const w = Math.max(0.18, h * 0.68), f = Math.min(0.96, h + (1 - h) * 0.38);
  const step = (n) => n * H;
  switch (style) {
    case 'swing': return [
      K(0, {}),
      K(w, { sR: 1.75, aR: 0.9, eR: 1.75, tR: -1.35, wR: 0.45, twist: 0.6, yaw: 0.18, lean: -0.04, lz: step(3.6), lf: step(1.5), pz: step(-0.6), sL: 0.35, eL: 1.0 }),
      K(h, { sR: 1.35, aR: 0.12, eR: 0.3, tR: 0.75, wR: 0.35, twist: -0.5, yaw: -0.22, lean: 0.2, lf: step(6.5), lz: step(2.4), pz: step(-2.2), pf: step(2.6), smear: 1, sL: 0.2, eL: 0.6 }, 'in'),
      K(f, { sR: 0.85, aR: -0.12, eR: 0.45, tR: 1.3, wR: 0.5, twist: -0.72, yaw: -0.32, lean: 0.24, lf: step(6.5), lz: step(2.4), pz: step(-2.4), pf: step(2.6), smear: 0.35 }, 'out'),
      K(1, {}),
    ];
    case 'overhead': return [
      K(0, {}),
      K(w, { sR: 2.65, aR: 0.35, eR: 1.55, tR: 0.1, wR: 0.95, twist: 0.32, yaw: 0.12, lean: -0.16, hp: -0.25, lz: step(4), lf: step(1.5), pz: step(0.4), sL: look.twoHand ? 2.4 : 0.5, eL: 1.3 }),
      K(h, { sR: 1.15, aR: 0.05, eR: 0.15, tR: 0.4, wR: 0.3, twist: -0.28, yaw: -0.12, lean: 0.42, hp: 0.15, lf: step(7), lz: step(2.4), pz: step(-3.6), pf: step(3), smear: 1, sL: look.twoHand ? 1.2 : 0.3 }, 'in'),
      K(f, { sR: 0.6, aR: 0.02, eR: 0.3, tR: 0.5, wR: 0.55, twist: -0.36, lean: 0.48, lf: step(7), lz: step(2.4), pz: step(-3.8), pf: step(3), smear: 0.3 }, 'out'),
      K(1, {}),
    ];
    case 'stab': return [
      K(0, {}),
      K(w, { sR: 0.3, aR: 0.35, eR: 1.9, tR: -0.3, wR: 0.05, twist: 0.45, yaw: 0.2, lean: -0.05, pz: step(-0.5) }),
      K(h, { sR: 1.45, aR: 0.08, eR: 0.08, tR: 0.15, wR: 0.05, twist: -0.38, yaw: -0.25, lean: 0.25, lf: step(7), pz: step(-2.6), pf: step(3.6), smear: 0.6 }, 'in'),
      K(f, { sR: 1.35, aR: 0.1, eR: 0.15, tR: 0.15, wR: 0.05, twist: -0.32, lean: 0.22, lf: step(7), pz: step(-2.4), pf: step(3.4) }, 'out'),
      K(1, {}),
    ];
    case 'staffhit': return [
      K(0, {}),
      K(w, { sR: 1.7, eR: 0.8, tR: -0.6, wR: 1.4, twist: 0.4, lean: -0.08 }),
      K(h, { sR: 1.15, eR: 0.3, tR: 0.6, wR: 1.6, twist: -0.45, lean: 0.25, lf: step(6), pz: step(-2), smear: 0.8 }, 'in'),
      K(1, {}),
    ];
    case 'claw': return [
      K(0, {}),
      K(w * 0.85, { sR: 1.95, aR: 0.8, eR: 1.3, tR: -0.9, sL: 0.6, eL: 1.2, twist: 0.5, lean: -0.08, jaw: 0.4 }),
      K(h, { sR: 1.0, aR: 0.0, eR: 0.35, tR: 0.9, sL: 1.65, aL: 0.6, eL: 1.0, tL: -0.6, twist: -0.5, lean: 0.32, lf: step(5.5), pz: step(-2.2), pf: step(2.5), jaw: 1, smear: 0.6 }, 'in'),
      K(f, { sR: 0.55, eR: 0.6, tR: 1.1, sL: 0.85, aL: -0.1, eL: 0.4, tL: 0.9, twist: 0.25, lean: 0.3, lf: step(5.5), pz: step(-2), pf: step(2.5), jaw: 0.6 }, 'out'),
      K(1, {}),
    ];
    case 'bite': return [
      K(0, {}),
      K(w, { lean: -0.1, hp: -0.35, jaw: 0.6, pz: step(0.5) }),
      K(h, { lean: 0.45, hp: 0.25, jaw: 1, lf: step(5), pf: step(3), pz: step(-2) }, 'in'),
      K(1, {}),
    ];
    case 'slam': return [
      K(0, {}),
      K(w, { sR: 2.75, sL: 2.75, aR: 0.2, aL: 0.2, eR: 0.6, eL: 0.6, tR: 0.3, tL: 0.3, lean: -0.22, pz: step(1), hp: -0.3 }),
      K(h, { sR: 1.0, sL: 1.0, eR: 0.15, eL: 0.15, lean: 0.55, pz: step(-6), lf: step(4), pf: step(2), smear: 0.6 }, 'in'),
      K(f, { sR: 0.7, sL: 0.7, eR: 0.3, eL: 0.3, lean: 0.5, pz: step(-6), lf: step(4), pf: step(2) }, 'out'),
      K(1, {}),
    ];
    default: return [K(0, {}), K(1, {})];
  }
}

// ───────── 상태 → 자세 ─────────
const BASE = newPose(), GP = newPose();
// st: 액터별 그리기 상태(걸음 위상 ph, 걷기 섞기 wb, 달리기 정도 gb)
export function computePose(p, a, look, time, st) {
  const A = a.anim || { name: 'idle', t: 0, dur: 1 };
  const u = A.dur ? clamp(A.t / A.dur, 0, 1) : 0;
  idlePose(BASE, a, look, time);
  if (st.wb > 0.001) {
    copyPose(GP, BASE);
    gaitPose(GP, a, look, st.ph, st.gb, time);
    mixPose(BASE, BASE, GP, ease(st.wb));
  }
  copyPose(p, BASE);
  const H = DIM.H;
  switch (A.name) {
    case 'attack': {
      const style = attackStyle(look, A);
      const h = A.hitAt ?? 0.5;
      if (style === 'bow') { bowPose(p, BASE, u, h); break; }
      if (style === 'spin') {
        p.spin = u * TAU * 2.4; p.sR = 1.5; p.aR = 1.25; p.eR = 0.15; p.tR = 0; p.wR = 0.05; p.sL = 1.3; p.aL = 1.3; p.eL = 0.25; p.tL = 0;
        p.lean = 0.12; p.pz = -2.4 * H; p.smear = 1; break;
      }
      applyKeys(p, BASE, attackKeys(style, h, look, H), u);
      if (look.shield && style !== 'claw') { p.sL = 0.65; p.aL = 0.3; p.eL = 1.5; p.tL = 0.95; }
      if (look.twoHand) p.grip2 = 1;
      break;
    }
    case 'cast': {
      const h = A.hitAt ?? 0.55, w = h * 0.72;
      applyKeys(p, BASE, [
        K(0, {}),
        K(w, { sR: 0.75, aR: 0.4, eR: 1.75, tR: 0.9, sL: 0.75, aL: 0.4, eL: 1.75, tL: 0.9, lean: -0.08, twist: 0.12, glowH: 1, pz: -0.6 * H, hp: -0.1 }),
        K(h, { sR: 1.5, aR: 0.18, eR: 0.15, tR: 0.3, sL: 1.45, aL: 0.2, eL: 0.15, tL: 0.3, lean: 0.18, twist: -0.1, glowH: 1.4, lf: 5 * H, pz: -1.8 * H, pf: 1.8 * H }, 'in'),
        K(Math.min(0.96, h + 0.2), { sR: 1.35, aR: 0.2, eR: 0.25, sL: 1.3, aL: 0.22, eL: 0.25, lean: 0.15, glowH: 0.4, lf: 5 * H, pz: -1.6 * H, pf: 1.8 * H }, 'out'),
        K(1, {}),
      ], u);
      if (look.wtype === 'staff') { const k = clamp(p.glowH, 0, 1); p.sR = lerp(BASE.sR, 1.2, k); p.eR = lerp(BASE.eR, 0.6, k); p.tR = BASE.tR; p.wR = lerp(BASE.wR, 0.5, k); }
      else if (look.wtype && look.wtype !== 'bow') { p.sR = BASE.sR; p.aR = BASE.aR; p.eR = BASE.eR; p.tR = BASE.tR; p.wR = BASE.wR; }
      break;
    }
    case 'hit': {
      const k = Math.sin(Math.min(1, u * 1.4) * PI);
      p.lean -= 0.32 * k; p.hp -= 0.45 * k; p.twist += 0.2 * k;
      p.sL += 0.35 * k; p.aL += 0.35 * k; p.sR += 0.25 * k; p.aR += 0.35 * k; p.eL += 0.3 * k;
      p.pz -= 1.6 * H * k; p.pf -= 2.5 * H * k; p.rf -= 1.5 * H * k;
      break;
    }
    case 'block': {
      const k = Math.sin(Math.min(1, u * 1.8) * PI * 0.5) * (u > 0.75 ? (1 - u) / 0.25 : 1);
      p.sL = lerp(p.sL, 1.2, k); p.aL = lerp(p.aL, 0.15, k); p.eL = lerp(p.eL, 1.3, k); p.tL = lerp(p.tL, 1.1, k);
      p.pz -= 2.4 * H * k; p.lean += 0.12 * k; p.twist -= 0.2 * k; p.hp += 0.1 * k;
      if (!look.shield) { p.sR = lerp(p.sR, 1.25, k); p.eR = lerp(p.eR, 1.5, k); p.tR = lerp(p.tR, 0.9, k); p.wR = lerp(p.wR, 0.2, k); }
      break;
    }
    case 'special': {
      const k = Math.sin(u * PI), up = ease(seg01(u, 0, 0.4));
      p.sL = lerp(p.sL, 2.6, k); p.sR = lerp(p.sR, 2.6, k); p.aL = lerp(p.aL, 0.75, k); p.aR = lerp(p.aR, 0.75, k);
      p.eL = lerp(p.eL, 0.5, k); p.eR = lerp(p.eR, 0.5, k); p.tL = lerp(p.tL, -0.3, k); p.tR = lerp(p.tR, -0.3, k);
      p.lean -= 0.22 * k; p.hp -= 0.5 * k; p.jaw = k;
      p.pz -= 2.5 * H * (1 - up) * Math.sin(seg01(u, 0, 0.3) * PI);
      break;
    }
    case 'death': case 'dead': deathPose(p, a, look, A.name === 'dead' ? 1 : u, H); break;
    case 'stone': {
      p.pz = -11 * H; p.lean = 0.55; p.hp = -0.2; p.sL = p.sR = 0.7; p.aL = p.aR = 0.45; p.eL = p.eR = 1.7; p.tL = p.tR = 0.5; p.wing = -0.8;
      p.lf = 4 * H; p.rf = 3 * H; p.lr = -DIM.hipW * 1.6; p.rr = DIM.hipW * 1.6; p.tail = 0;
      break;
    }
  }
  if (A.name !== 'attack' || attackStyle(look, A) !== 'bow') p.bow = 0;
  return p;
}

function bowPose(p, base, u, h) {
  const H = DIM.H;
  // 왼팔을 과녁 쪽으로 뻗고 오른손으로 시위를 뺨까지 당긴다
  const draw = ease(seg01(u, 0.05, h * 0.92)), rel = seg01(u, h, Math.min(1, h + 0.08)), rec = ease(seg01(u, h + 0.1, 1));
  const k = (1 - rec) * ease(seg01(u, 0, 0.18));
  p.ikL = k; p.hLf = 21 * H; p.hLr = -1.5 * H; p.hLz = 0;
  p.ikR = k; p.bow = draw * (1 - rel);
  p.hRf = lerp(19 * H, 4 * H, draw) - rel * 3 * H; p.hRr = lerp(-0.5 * H, 4 * H, draw) + rel * 2 * H; p.hRz = lerp(0, 1.5 * H, draw);
  p.twist = base.twist + (-0.55 - base.twist) * k; p.yaw = base.yaw + (0.45 - base.yaw) * k;
  p.lean = base.lean + 0.04 * k; p.hy = base.hy + (0.5 - base.hy) * k; p.hp = base.hp;
  p.lf = base.lf + (3.5 * H - base.lf) * k; p.rf = base.rf + (-3 * H - base.rf) * k;
  p.pz = base.pz - 1.0 * H * k;
}

function deathPose(p, a, look, u, H) {
  // 무릎이 꺾이고(0~0.35) 몸이 넘어가며(0.22~0.85) 다리를 펴고 팔을 벌린 채 바닥에 눕는다
  const buckle = ease(seg01(u, 0, 0.32)), fall = ease(seg01(u, 0.22, 0.85));
  const dir = a.fallDir || 1;
  const knee = buckle * (1 - fall);
  p.pz = lerp(p.pz, -8 * H, knee); p.pf = 0;
  p.lf = lerp(p.lf, 4 * H, knee) * (1 - fall) + 1.5 * H * fall; p.rf = lerp(p.rf, -1 * H, knee) * (1 - fall) - 1 * H * fall;
  p.lr = -DIM.hipW * (1.1 + fall * 0.5); p.rr = DIM.hipW * (1.1 + fall * 0.3);
  p.lz = p.rz = DIM.ank; p.lp = p.rp = 0;
  p.lean = lerp(p.lean, dir > 0 ? -0.25 : 0.5, buckle) * (1 - fall * 0.7);
  p.hp = lerp(p.hp, -0.45 * dir, buckle);
  // 팔: 처음엔 휘청이며 들렸다가 넘어지면 옆으로 벌어져 바닥에 놓인다
  const flail = Math.sin(seg01(u, 0.1, 0.6) * PI);
  p.sL = lerp(lerp(p.sL, 1.6, flail * 0.6), 0.25, fall); p.aL = lerp(p.aL, 1.25, fall); p.eL = lerp(p.eL, 0.12, fall); p.tL = lerp(p.tL, -0.4, fall);
  p.sR = lerp(lerp(p.sR, 1.9, flail * 0.6), 0.1, fall); p.aR = lerp(p.aR, 1.05, fall); p.eR = lerp(p.eR, 0.1, fall); p.tR = lerp(p.tR, -0.5, fall); p.wR = lerp(p.wR, 0.2, fall);
  p.grip2 = 0;
  p.fall = fall * (PI / 2) * 0.97; p.fallDir = dir;
  p.twist = lerp(p.twist, 0.25 * dir, fall); p.yaw = lerp(p.yaw, 0, fall);
  p.wing = lerp(p.wing, -0.6, fall); p.jaw = 0.5 * fall; p.tail = 0.6 * fall;
  p.float = 0; p.breath = 0;
}

// ───────── 뼈대 풀기 ─────────
export function setDims(look) {
  const H = look.h || 1, legS = look.legs ?? 1, Bk = look.bulk || 1, fem = look.female ? 1 : 0;
  DIM.H = H; DIM.Bk = Bk;
  DIM.thigh = 15.5 * H * legS; DIM.shin = 15 * H * legS; DIM.ank = 2.4 * H;
  DIM.hipW = 4.3 * H * Bk ** 0.8 * (fem ? 1.12 : 1) * (look.hips || 1);
  DIM.shW = 7.7 * H * Bk ** 0.6 * (look.shoulders || 1) ** 0.85 * (fem ? 0.88 : 1);
  DIM.upper = 12.3 * H * (look.arms || 1); DIM.fore = 11.3 * H * (look.arms || 1); DIM.hand = 4 * H;
  DIM.foot = 7 * H;
  DIM.hs = (look.headS || 1) * (fem ? 0.96 : 1);
  DIM.headA = 4.9 * H * DIM.hs; DIM.headB = 4.35 * H * DIM.hs; DIM.headC = 5.4 * H * DIM.hs;
  DIM.torsoL = look.torsoL || 1;
}

const POLE = new V3();
export function solveHuman(p, look) {
  const H = DIM.H;
  const hip0 = DIM.ank + (DIM.thigh + DIM.shin) * 0.985 + 1.6 * H;
  // 골반
  J.pel.set(p.pf, p.pr, hip0 + p.pz - p.crouch + p.float);
  FR.pel.set(p.yaw + p.spin, p.tilt * 0.5, p.roll);
  FR.pel.at(J.hipL, J.pel, 0, -DIM.hipW, -1.6 * H);
  FR.pel.at(J.hipR, J.pel, 0, DIM.hipW, -1.6 * H);
  // 다리(떠 있으면 발 목표도 함께 뜬다)
  const fl = p.float;
  if (p.spin) {
    // 회오리: 발도 몸을 따라 돈다
    const c = Math.cos(p.spin), s = Math.sin(p.spin);
    J.tgL.set(p.lf * c - p.lr * s, p.lf * s + p.lr * c, p.lz + fl); J.tgR.set(p.rf * c - p.rr * s, p.rf * s + p.rr * c, p.rz + fl);
  } else { J.tgL.set(p.lf, p.lr, p.lz + fl); J.tgR.set(p.rf, p.rr, p.rz + fl); }
  const pf = FR.pel.F, pr = FR.pel.R;
  ik(J.knL, J.anL, J.hipL, J.tgL, DIM.thigh, DIM.shin, pf.f - pr.f * 0.22, pf.r - pr.r * 0.22, 0.05);
  ik(J.knR, J.anR, J.hipR, J.tgR, DIM.thigh, DIM.shin, pf.f + pr.f * 0.22, pf.r + pr.r * 0.22, 0.05);
  FT.yL = p.yaw * 0.5 + p.spin - p.toe; FT.yR = p.yaw * 0.5 + p.spin + p.toe; FT.pL = p.lp; FT.pR = p.rp;
  // 척추
  const tl = DIM.torsoL, yw = p.yaw + p.spin;
  FR.waist.set(yw + p.twist * 0.45, p.lean * 0.45 + p.tilt, p.roll + p.bend * 0.5);
  FR.chest.set(yw + p.twist, p.lean + p.tilt, p.roll + p.bend);
  FR.waist.at(J.waist, J.pel, 0, 0, 6.5 * H * tl);
  FR.chest.at(J.chest, J.waist, 0, 0, 7 * H * tl + p.breath * 0.3);
  FR.chest.at(J.neck, J.chest, -0.4 * H, 0, 6.3 * H * tl + p.breath * 0.25);
  FR.head.set(yw + p.twist + p.hy, p.lean + p.tilt + p.hp, (p.roll + p.bend) * 0.5);
  FR.head.at(J.head, J.neck, 0.6 * H, 0, DIM.headC * 0.95);
  // 어깨(숨 쉴 때 살짝 들린다)
  const shZ = 4.6 * H * tl + p.breath * 0.35;
  FR.chest.at(J.shL, J.chest, -0.6 * H, -DIM.shW, shZ);
  FR.chest.at(J.shR, J.chest, -0.6 * H, DIM.shW, shZ);
  // 팔
  arm(1, p.sR, p.aR, p.eR, p.tR, p.wR, J.shR, J.elR, J.wrR, J.haR, WD);
  arm(-1, p.sL, p.aL, p.eL, p.tL, 0, J.shL, J.elL, J.wrL, J.haL, null);
  const wt = look.wtype;
  if (p.ikR > 0.001) armIK(1, J.shR, J.elR, J.wrR, J.haR, p.ikR, p.hRf, p.hRr, p.hRz);
  if (wt === 'staff') {
    // 지팡이: 손에서 위아래로 길게, 앞으로 살짝 기울여
    const C = FR.chest, k = p.wR;
    WD.set(C.U.f * Math.cos(k) + C.F.f * Math.sin(k), C.U.r * Math.cos(k) + C.F.r * Math.sin(k), C.U.z * Math.cos(k) + C.F.z * Math.sin(k));
    WB.copy(C.R);
  }
  J.wGrip.copy(J.haR);
  // 두 손 무기: 왼손이 손잡이 아래쪽을 잡는다
  if (p.grip2 > 0.01 && wt && wt !== 'bow' && wt !== 'staff') {
    J.tmp.set(J.haR.f - WD.f * 4.5 * H, J.haR.r - WD.r * 4.5 * H, J.haR.z - WD.z * 4.5 * H);
    solveArmTo(-1, J.shL, J.elL, J.wrL, J.haL, J.tmp, p.grip2);
  }
  if (p.ikL > 0.001) armIK(-1, J.shL, J.elL, J.wrL, J.haL, p.ikL, p.hLf, p.hLr, p.hLz);
  if (look.wings) wings(p, look);
  if (look.tail) tail(p, look);
  if (p.fall) fallAll(p);
}

// 팔: 위팔 u(가슴 축 기준), 굽힘 방향 b(비틀기 t로 안쪽으로 돈다), 아래팔 = u·cos e + b·sin e
const U0 = new V3(), B0 = new V3(), BX = new V3(), FA = new V3();
function arm(side, s, a, e, t, w, S, E, W, Hd, wd) {
  const C = FR.chest;
  const ca = Math.cos(a), cs = Math.cos(s), ss = Math.sin(s);
  // 위팔 방향
  const uf = ss * ca, ur = side * Math.sin(a), uz = -cs * ca;
  U0.set(C.F.f * uf + C.R.f * ur + C.U.f * uz, C.F.r * uf + C.R.r * ur + C.U.r * uz, C.F.z * uf + C.R.z * ur + C.U.z * uz);
  // 기본 굽힘 방향(팔을 든 평면 안): cos s·F + sin s·U
  B0.set(C.F.f * cs + C.U.f * ss, C.F.r * cs + C.U.r * ss, C.F.z * cs + C.U.z * ss);
  // 비틀기: u 축 둘레로 안쪽으로(오른팔은 u × b0 쪽, 왼팔은 반대)
  const xf = U0.r * B0.z - U0.z * B0.r, xr = U0.z * B0.f - U0.f * B0.z, xz = U0.f * B0.r - U0.r * B0.f;
  const ct = Math.cos(t), st = Math.sin(t) * side;
  BX.set(B0.f * ct + xf * st, B0.r * ct + xr * st, B0.z * ct + xz * st);
  E.set(S.f + U0.f * DIM.upper, S.r + U0.r * DIM.upper, S.z + U0.z * DIM.upper);
  const el = Math.max(0, e), ce = Math.cos(el), se = Math.sin(el);
  FA.set(U0.f * ce + BX.f * se, U0.r * ce + BX.r * se, U0.z * ce + BX.z * se);
  W.set(E.f + FA.f * DIM.fore, E.r + FA.r * DIM.fore, E.z + FA.z * DIM.fore);
  Hd.set(W.f + FA.f * DIM.hand * 0.45, W.r + FA.r * DIM.hand * 0.45, W.z + FA.z * DIM.hand * 0.45);
  if (wd) {
    const cw = Math.cos(el + w), sw = Math.sin(el + w);
    wd.set(U0.f * cw + BX.f * sw, U0.r * cw + BX.r * sw, U0.z * cw + BX.z * sw);
    // 날의 옆 방향: 굽힘 평면의 법선(u × b)
    const nf = U0.r * BX.z - U0.z * BX.r, nr = U0.z * BX.f - U0.f * BX.z, nz = U0.f * BX.r - U0.r * BX.f;
    const l = Math.hypot(nf, nr, nz) || 1;
    WB.set(nf / l, nr / l, nz / l);
  }
}
// 손을 목표로(가슴 기준 좌표 a 앞, b 오른쪽, c 위 — 어깨에서)
function armIK(side, S, E, W, Hd, k, a, b, c) {
  FR.chest.at(J.tmp2, S, a, b, c);
  solveArmTo(side, S, E, W, Hd, J.tmp2, k);
}
const E2 = new V3(), W2 = new V3();
function solveArmTo(side, S, E, W, Hd, T, k) {
  const C = FR.chest;
  POLE.set(-C.F.f * 0.5 + C.R.f * side * 0.8 - C.U.f * 0.6, -C.F.r * 0.5 + C.R.r * side * 0.8 - C.U.r * 0.6, -C.F.z * 0.5 + C.R.z * side * 0.8 - C.U.z * 0.6);
  ik(E2, W2, S, T, DIM.upper, DIM.fore, POLE.f, POLE.r, POLE.z);
  E.set(lerp(E.f, E2.f, k), lerp(E.r, E2.r, k), lerp(E.z, E2.z, k));
  W.set(lerp(W.f, W2.f, k), lerp(W.r, W2.r, k), lerp(W.z, W2.z, k));
  const dx = W.f - E.f, dy = W.r - E.r, dz = W.z - E.z, l = Math.hypot(dx, dy, dz) || 1;
  Hd.set(W.f + dx / l * DIM.hand * 0.45, W.r + dy / l * DIM.hand * 0.45, W.z + dz / l * DIM.hand * 0.45);
}

function wings(p, look) {
  const H = DIM.H, ws = look.wingS || 1, C = FR.chest, w = p.wing;
  for (const side of [-1, 1]) {
    const root = side < 0 ? J.wingL : J.wingR, el = side < 0 ? J.wingL2 : J.wingR2, tip = side < 0 ? J.wingLe : J.wingRe;
    C.at(root, J.chest, -3.2 * H, side * 2.6 * H, 2.5 * H);
    const fold = clamp(-w, 0, 1);
    C.at(el, root, -5 * H * ws - fold * 2 * H, side * (13 - fold * 7) * H * ws, (9 + w * 12 - fold * 2) * H * ws);
    C.at(tip, root, -(9 + fold * 2) * H * ws, side * (26 - fold * 17) * H * ws, (-4 + w * 20 - fold * 8) * H * ws);
  }
}
function tail(p, look) {
  const H = DIM.H, P = FR.pel, t = p.tail;
  P.at(J.tailA, J.pel, -4.5 * H, 0, -2.5 * H);
  P.at(J.tailB, J.pel, -11 * H, t * 4 * H, -8 * H);
  P.at(J.tailC, J.pel, -17 * H, t * 9 * H, -10 * H + Math.abs(t) * 3 * H);
}

const ALL = Object.values(J);
function fallAll(p) {
  const ang = p.fall, dir = p.fallDir;
  // 축: 두 발목의 가운데(바닥)
  const pf0 = (J.anL.f + J.anR.f) / 2;
  const c = Math.cos(ang), s = Math.sin(ang) * dir;
  for (const j of ALL) {
    const f = j.f - pf0, z = j.z;
    j.f = f * c - z * s + pf0; j.z = Math.max(z * c + f * s, 1.2 * DIM.H);
  }
  for (const fr of [FR.pel, FR.waist, FR.chest, FR.head]) for (const v of [fr.F, fr.R, fr.U]) { const nf = v.f * c - v.z * s, nz = v.z * c + v.f * s; v.f = nf; v.z = nz; }
  for (const v of [WD, WB]) { const nf = v.f * c - v.z * s, nz = v.z * c + v.f * s; v.f = nf; v.z = nz; }
}

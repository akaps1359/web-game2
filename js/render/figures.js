// 인물·괴물 그리기: 3차원 관절 뼈대를 아이소메트릭으로 투영해 매 프레임 그린다.
// 사람형은 fig/pose.js(자세·걷기·역운동학)와 fig/human.js(몸·옷·갑옷), fig/head.js(머리), fig/gear.js(무기)로,
// 네발 짐승·박쥐·거미·뱀·영혼은 fig/beasts.js로 그린다
import { setProj, setFlash, beginFig, PR, XJ, YJ, TAU, clamp, glowDot } from './fig/core.js';
import { J, WD, DIM, newPose, computePose, solveHuman, setDims, gaitCycle, attackStyle } from './fig/pose.js';
import { drawHuman } from './fig/human.js';
import { drawSmear } from './fig/gear.js';
import { drawBeast, beastCycle } from './fig/beasts.js';
import { ART, pixEllipse, SpritePass } from './pixel.js';
import { makeCanvas } from './noise.js';

const P = newPose();
const SM = { tips: [], bases: [], col: '#ffffff', a: 0 };

// 액터별 그리기 상태: 걸음 위상, 걷기 섞기, 달리기 정도
function stateOf(a, look, time, dead) {
  let st = a._fs;
  if (!st) st = a._fs = { t: time, ph: Math.random(), wb: 0, gb: 0, wp: a.walkPh || 0 };
  const dt = clamp(time - st.t, 0, 0.1); st.t = time;
  const moving = !!a.moving && !dead;
  if (a.gph != null) { st.ph = a.gph; st.wb = moving ? 1 : 0; st.gb = a.ggb ?? st.gb; return st; }
  st.wb += ((moving ? 1 : 0) - st.wb) * Math.min(1, dt * 9);
  const spd = (a.speed || 3) * (a.buffs?.chill ? 0.5 : 1);
  const gt = clamp((spd - 1.3) / 1.2, 0, 1) * (look.runs === false ? 0 : 1);
  st.gb += (gt - st.gb) * Math.min(1, dt * 3);
  const wp = a.walkPh || 0;
  let dist = (wp - st.wp) * 50 / TAU;
  st.wp = wp;
  if (dist < 0 || dist > 120) dist = 0;
  st.ph = (st.ph + dist / (look.plan && look.plan !== 'human' ? beastCycle(look, st.gb) : gaitCycle(look, st.gb))) % 1;
  return st;
}

// 맞은 쪽·화면 크기에 따른 세밀함(0 단순 ~ 2 자세히)
function lodOf(a, sc, look) {
  const px = sc * (look.h || 1);
  if (a.portrait || a.isPlayer || a.boss || a.kind === 'npc') return px > 0.9 ? 2 : 1;
  return px > 1.9 ? 2 : px > 0.7 ? 1 : 0;
}
// 발밑 그림자: 미리 그려 둔 부드러운 타원을 늘려 찍는다
let SHADOW = null;
function shadowSprite() {
  if (SHADOW) return SHADOW;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  SHADOW = c;
  return c;
}

// 발 기준으로 그림이 들어갈 상자(배율 sc): 모든 괴물·직업을 여러 동작·방향으로 그려 잰 최댓값(위 112·h, 옆 66·덩치, 아래 14)에 여유를 조금
export function figBox(look, sc) {
  const bulk = Math.max(1, look.bulk || 1, look.wingS || 1);
  return { hw: Math.ceil(68 * bulk * sc) + 3, up: Math.ceil((114 * (look.h || 1) + 6) * sc) + 3, dn: Math.ceil(16 * sc) + 3 };
}
export function actorAlpha(a) {
  let alpha = 1;
  if (a.invis != null) alpha = a.invis;
  if (a.fade != null) alpha *= a.fade;
  return alpha;
}
// part: 0 전부(모델 전시·성능 재기 도구), 2 몸만(투명도 없이 — 다듬은 뒤 통째로 흐리게),
// 3 바닥에 깔리는 것(그림자·각진 점 대상 고리·기운)만
export function drawActor(g, a, px, py, s, time, part = 0) {
  const look = a.look;
  if (!look) return;
  const sc = s * (look.scale || 1);
  const anim = a.anim?.name;
  const dead = anim === 'death' || anim === 'dead';
  const alpha = actorAlpha(a);
  if (part !== 2) {
    // 그림자(발밑의 부드러운 어둠)
    if (!dead && !look.noShadow) {
      const r = 15 * sc * (look.shadow || 1);
      g.drawImage(shadowSprite(), px - r, py - r * 0.5, r * 2, r);
    }
    if (alpha <= 0.02) return;
    g.globalAlpha = alpha;
    if (a.targeted) {
      const col = a.team === 1 ? 'rgba(220,60,40,0.85)' : 'rgba(120,200,255,0.8)';
      if (part === 3) pixEllipse(g, px, py, Math.round(18 * sc), Math.round(9 * sc), col);
      else { g.strokeStyle = col; g.lineWidth = 1.6 * s; g.beginPath(); g.ellipse(px, py, 18 * sc, 9 * sc, 0, 0, TAU); g.stroke(); }
    }
    if (look.aura && !dead) {
      g.globalAlpha = alpha * (0.3 + 0.15 * Math.sin(time * 4 + a.id));
      g.fillStyle = look.aura;
      g.beginPath(); g.ellipse(px, py, 20 * sc, 10 * sc, 0, 0, TAU); g.fill();
      g.globalAlpha = alpha;
    }
    if (part === 3) { g.globalAlpha = 1; return; }
  }
  if (alpha <= 0.02) return;
  g.globalAlpha = part === 2 ? 1 : alpha;
  setProj(a.face || 0, px, py, sc);
  setFlash(a.flash > 0);
  beginFig(g);
  const lod = lodOf(a, sc, look);
  if (!look.plan || look.plan === 'human') drawPerson(g, a, look, time, lod, dead);
  else drawBeast(g, a, look, sc, time, lod, stateOf(a, look, time, dead));
  setFlash(false);
  g.globalAlpha = 1;
}

function drawPerson(g, a, look, time, lod, dead) {
  setDims(look);
  const st = stateOf(a, look, time, dead);
  const A = a.anim;
  // 휘두른 자국: 지난 몇 순간의 무기 끝 위치를 먼저 구한다
  let smearFn = null;
  if (A?.name === 'attack' && look.wtype && look.wtype !== 'bow' && look.wlen && lod > 0) {
    const style = attackStyle(look, A);
    if (style !== 'bow') {
      const t0 = A.t;
      SM.tips.length = 0; SM.bases.length = 0;
      let maxS = 0;
      for (let k = 5; k >= 0; k--) {
        A.t = Math.max(0, t0 - k * 0.016 * (A.dur || 1) / 0.6);
        computePose(P, a, look, time, st); solveHuman(P, look);
        maxS = Math.max(maxS, P.smear);
        const L = look.wlen * DIM.H;
        SM.tips.push(XJ({ f: J.wGrip.f + WD.f * L, r: J.wGrip.r + WD.r * L, z: J.wGrip.z + WD.z * L }), YJ({ f: J.wGrip.f + WD.f * L, r: J.wGrip.r + WD.r * L, z: J.wGrip.z + WD.z * L }));
        SM.bases.push(XJ({ f: J.wGrip.f + WD.f * L * 0.62, r: J.wGrip.r + WD.r * L * 0.62, z: J.wGrip.z + WD.z * L * 0.62 }), YJ({ f: J.wGrip.f + WD.f * L * 0.62, r: J.wGrip.r + WD.r * L * 0.62, z: J.wGrip.z + WD.z * L * 0.62 }));
      }
      A.t = t0;
      if (maxS > 0.05) { SM.a = maxS; SM.col = look.wglow ? '#ffd890' : '#e8eef8'; smearFn = () => drawSmear(g, SM.tips, SM.bases, SM.col, SM.a * 0.5); }
    }
  }
  computePose(P, a, look, time, st);
  solveHuman(P, look);
  drawHuman(g, a, look, P, time, lod, smearFn);
  // 주문을 모을 때 손에 빛
  if (P.glowH > 0.05) {
    const col = look.castCol || '#9fd0ff';
    g.save(); g.globalCompositeOperation = 'lighter';
    glowDot(g, XJ(J.haL), YJ(J.haL), 1.4 * PR.s * P.glowH, col, 0.6);
    glowDot(g, XJ(J.haR), YJ(J.haR), 1.4 * PR.s * P.glowH, col, 0.6);
    g.restore();
  }
}

// 시체: 죽은 자세로 멈춘 그림
export function drawCorpse(g, c, px, py, s) {
  const look = c.look;
  if (!look) return;
  const sc = s * (look.scale || 1);
  g.globalAlpha = c.fade ?? 1;
  setProj(c.face || 0, px, py, sc);
  beginFig(g);
  if (!look.skel && !look.noBlood) {
    g.fillStyle = look.bloodCol || 'rgba(90,6,4,0.75)';
    g.beginPath(); g.ellipse(px - 6 * sc * (c.fallDir || 1) * Math.cos(c.face || 0), py, 16 * sc, 7 * sc, 0, 0, TAU); g.fill();
  }
  const fake = { id: c.id || 0, anim: { name: 'dead', t: 1, dur: 1 }, fallDir: c.fallDir || 1, look, flash: 0, _fs: { t: 0, ph: 0, wb: 0, gb: 0, wp: 0 } };
  setFlash(false);
  if (!look.plan || look.plan === 'human') {
    setDims(look);
    computePose(P, fake, look, 0, fake._fs);
    solveHuman(P, look);
    drawHuman(g, fake, look, P, 0, 1, null);
  } else drawBeast(g, fake, look, sc, 0, 1, fake._fs);
  g.globalAlpha = 1;
}

// 초상화(캐릭터 선택·가방·대화): 도트 한 칸 ART px로 작게 그려 다듬은 뒤 각진 그대로 키운다
let PSP = null;
export function drawPortrait(g, look, x, y, s, time, anim = 'idle', face = Math.PI / 4) {
  const a = { id: 1, look, face, anim: { name: anim, t: (time % 1.2), dur: 1.2 }, flash: 0, portrait: true };
  const sl = s / ART, { hw, up, dn } = figBox(look, sl * (look.scale || 1));
  if (!PSP) PSP = { sp: new SpritePass(), cv: makeCanvas(8, 8) };
  const cv = PSP.cv;
  cv.width = hw * 2; cv.height = up + dn;
  const cg = cv.getContext('2d');
  drawActor(cg, a, hw, up, sl, time, 3);
  PSP.sp.run(cg, 0, 0, hw * 2, up + dn, (sg) => drawActor(sg, a, hw, up, sl, time, 2));
  const sm = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(cv, x - hw * ART, y - up * ART, cv.width * ART, cv.height * ART);
  g.imageSmoothingEnabled = sm;
}

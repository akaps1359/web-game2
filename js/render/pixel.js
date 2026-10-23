// 도트 그래픽 도구: 색 줄이기(OKLab 밝기·채도·색상을 계단으로), 스프라이트 다듬기(굳힌 가장자리와 바깥 1도트
// 어두운 외곽선), 크게 그린 타일을 상자 평균으로 줄여 도트로 만들기
import { makeCanvas } from './noise.js';

// ───────── 색 줄이기 ─────────
// 밝기 NL단계, 채도 NC 간격, 색상 NH방향으로 묶는다. 5비트씩 32×32×32 표로 미리 굳혀 둔다
const NL = 15, NC = 0.03, NH = 20;
let LUT = null;
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const gam = (c) => (c <= 0 ? 0 : c >= 1 ? 1 : c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function buildLUT() {
  LUT = new Uint32Array(32768);
  for (let i = 0; i < 32768; i++) {
    const r = lin(((i >> 10) * 8 + 4) / 255), g = lin((((i >> 5) & 31) * 8 + 4) / 255), b = lin(((i & 31) * 8 + 4) / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = Math.round((0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s) * NL) / NL;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const C = Math.round(Math.hypot(A, B) / NC) * NC, H = Math.round(Math.atan2(B, A) / (2 * Math.PI) * NH) / NH * 2 * Math.PI;
    const a2 = C * Math.cos(H), b2 = C * Math.sin(H);
    const l2 = (L + 0.3963377774 * a2 + 0.2158037573 * b2) ** 3, m2 = (L - 0.1055613458 * a2 - 0.0638541728 * b2) ** 3, s2 = (L - 0.0894841775 * a2 - 1.291485548 * b2) ** 3;
    const R = Math.round(gam(4.0767416621 * l2 - 3.3077115913 * m2 + 0.2309699292 * s2) * 255);
    const G = Math.round(gam(-1.2684380046 * l2 + 2.6097574011 * m2 - 0.3413193965 * s2) * 255);
    const Bb = Math.round(gam(-0.0041960863 * l2 - 0.7034186147 * m2 + 1.707614701 * s2) * 255);
    LUT[i] = (R << 16) | (G << 8) | Bb;
  }
}
// RGBA 한 칸(d[i..i+2])의 색을 줄인다
function quant(d, i) {
  const v = LUT[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)];
  d[i] = v >> 16; d[i + 1] = (v >> 8) & 255; d[i + 2] = v & 255;
}

// ───────── 스프라이트 다듬기 ─────────
// 그때그때 그리는 것(인물·괴물)을 판(A)에 그린 뒤 다듬는다: 판을 자기 위에 겹쳐 그려 반투명 가장자리를 거의
// 불투명하게 굳히고, 네 방향으로 1도트 민 실루엣을 어두운 색으로 판 B에 깔아 외곽선을 만든다.
// 픽셀을 읽어 오지 않으니(아이폰에서는 읽기가 아주 비싸다) 그래픽 처리 장치에서 다 끝난다
function harden(A, ag, B, bg, W, H) {
  ag.setTransform(1, 0, 0, 1, 0, 0); ag.globalAlpha = 1; ag.globalCompositeOperation = 'source-over';
  ag.drawImage(A, 0, 0, W, H, 0, 0, W, H); ag.drawImage(A, 0, 0, W, H, 0, 0, W, H);
  bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalAlpha = 1; bg.globalCompositeOperation = 'source-over'; bg.imageSmoothingEnabled = false;
  bg.clearRect(0, 0, W, H);
  bg.drawImage(A, 0, 0, W, H, -1, 0, W, H); bg.drawImage(A, 0, 0, W, H, 1, 0, W, H);
  bg.drawImage(A, 0, 0, W, H, 0, -1, W, H); bg.drawImage(A, 0, 0, W, H, 0, 1, W, H);
  bg.globalCompositeOperation = 'source-in'; bg.fillStyle = '#0d0907'; bg.fillRect(0, 0, W, H);
}
function prep(c, w, h) {
  if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, w, h);
  return g;
}
// 한 화면의 인물·괴물을 한 장의 판에 칸칸이 모아 그리고 한꺼번에 다듬는다(인물마다 판을 다듬는 것보다 훨씬 싸다)
const ATLAS_W = 1024;
export class SpriteAtlas {
  constructor() { this.a = makeCanvas(ATLAS_W, 128); this.b = makeCanvas(ATLAS_W, 128); this.begin(); }
  begin() { this.cells = []; this.x = 1; this.y = 1; this.rowH = 0; this.used = 0; }
  // w×h 칸을 잡는다. fn(g, x, y)는 판의 (x, y)를 왼쪽 위로 삼아 그린다
  add(w, h, fn) {
    w = Math.min(ATLAS_W - 2, w);
    if (this.x + w + 1 > ATLAS_W) { this.x = 1; this.y += this.rowH + 2; this.rowH = 0; }
    const c = { x: this.x, y: this.y, w, h, fn };
    this.x += w + 2; this.rowH = Math.max(this.rowH, h); this.used = Math.max(this.used, this.x);
    this.cells.push(c);
    return c;
  }
  render() {
    if (!this.cells.length) return;
    const W = Math.min(ATLAS_W, this.used + 1), H = this.y + this.rowH + 1;
    const ag = prep(this.a, W, H);
    // 칸 밖으로 넘친 것(휘두른 자국 등)이 옆 칸을 더럽히지 않게 칸마다 잘라 그린다
    for (const c of this.cells) {
      ag.save(); ag.beginPath(); ag.rect(c.x, c.y, c.w, c.h); ag.clip();
      c.fn(ag, c.x, c.y);
      ag.restore();
    }
    ag.setTransform(1, 0, 0, 1, 0, 0); ag.globalAlpha = 1; ag.globalCompositeOperation = 'source-over';
    harden(this.a, ag, this.b, prep(this.b, W, H), W, H);
  }
  // 다듬은 칸을 target의 (x, y)에 찍는다(alpha: 투명해지는 괴물 등은 통째로 흐리게)
  blit(target, c, x, y, alpha = 1) {
    target.globalAlpha = alpha;
    target.drawImage(this.b, c.x, c.y, c.w, c.h, x, y, c.w, c.h);
    target.drawImage(this.a, c.x, c.y, c.w, c.h, x, y, c.w, c.h);
    target.globalAlpha = 1;
  }
}
// 하나만 그릴 때(초상화·시체): 그림 크기만 한 작은 판
export class SpritePass {
  constructor() { this.a = makeCanvas(64, 64); this.b = makeCanvas(64, 64); }
  run(target, x, y, w, h, fn, alpha = 1) {
    if (w < 1 || h < 1) return;
    const ag = prep(this.a, w, h);
    fn(ag);
    harden(this.a, ag, this.b, prep(this.b, w, h), w, h);
    target.globalAlpha = alpha;
    target.drawImage(this.b, 0, 0, w, h, x, y, w, h);
    target.drawImage(this.a, 0, 0, w, h, x, y, w, h);
    target.globalAlpha = 1;
  }
  // 다듬은 그림을 새 판으로(움직이지 않는 시체 등은 한 번만)
  bake(w, h, fn) {
    const out = makeCanvas(w, h);
    this.run(out.getContext('2d'), 0, 0, w, h, fn);
    return out;
  }
}

// ───────── 타일 줄이기 ─────────
// ss배로 크게 그린 그림을 칸마다 알파 가중 평균으로 줄이고, 알파는 반에서 딱 끊고 색을 줄인다
export function shrink(src, ss) {
  if (!LUT) buildLUT();
  const W = src.width, H = src.height, w = Math.ceil(W / ss), h = Math.ceil(H / ss), n = ss * ss;
  const sd = src.getContext('2d').getImageData(0, 0, W, H).data;
  const out = makeCanvas(w, h), og = out.getContext('2d'), img = og.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let yy = y * ss; yy < Math.min(H, y * ss + ss); yy++) for (let xx = x * ss; xx < Math.min(W, x * ss + ss); xx++) {
      const i = (yy * W + xx) * 4, al = sd[i + 3];
      r += sd[i] * al; g += sd[i + 1] * al; b += sd[i + 2] * al; a += al;
    }
    if (a / n < 128) continue;
    const o = (y * w + x) * 4;
    d[o] = r / a; d[o + 1] = g / a; d[o + 2] = b / a; d[o + 3] = 255;
    quant(d, o);
  }
  og.putImageData(img, 0, 0);
  return out;
}

// 화면에 1도트 굵기 타원(대상 고리 등): 각진 점으로 찍는다
export function pixEllipse(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  const n = Math.max(12, Math.ceil(Math.PI * 2 * Math.max(rx, ry) * 1.3));
  let lx = 1e9, ly = 1e9;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    if (x !== lx || y !== ly) g.fillRect(x, y, 1, 1);
    lx = x; ly = y;
  }
}

// 도트 글꼴 글자: 한 도트(d) 어긋난 검은 글자를 깔아 또렷한 외곽선을 만든다(외곽선 그리기는 모서리가 뭉개진다)
export function pixText(g, txt, x, y, col, d) {
  x = Math.round(x / d) * d; y = Math.round(y / d) * d;
  g.fillStyle = '#000';
  g.fillText(txt, x - d, y); g.fillText(txt, x + d, y); g.fillText(txt, x, y - d); g.fillText(txt, x, y + d); g.fillText(txt, x + d, y + d);
  g.fillStyle = col; g.fillText(txt, x, y);
}

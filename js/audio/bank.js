// 소리 목록과 그리기: 열쇠 하나 → 표본 배열(채널별 Float32Array). 워커와 메인 스레드가 함께 쓴다
// 열쇠: 'sfx:이름:변형' · 'amb:이름:변형' · 'mus:악기:음높이·변형' · 'ir' · 'bed:pink|brown|fire'
import { begin, SR, rnd, N, noise, loopify, level } from './dsp.js';
import { ITEMS } from './sfx-items.js';
import { COMBAT } from './sfx-combat.js';
import { SPELLS } from './sfx-spells.js';
import { MONSTERS } from './sfx-monsters.js';
import { WORLD, AMB } from './sfx-world.js';
import { INSTR } from './instruments.js';
import { fire } from './sfx-kit.js';

export const SFX = { ...ITEMS, ...COMBAT, ...SPELLS, ...MONSTERS, ...WORLD };
export const SFX_GROUPS = { items: Object.keys(ITEMS), combat: Object.keys(COMBAT), skills: Object.keys(SPELLS), monsters: Object.keys(MONSTERS), world: Object.keys(WORLD) };
export { AMB, INSTR };

// 지하 회랑 잔향(약 2초): 돌벽의 이른 반사 + 시간이 갈수록 어두워지는 지수 감쇠 잡음, 좌우를 따로 만든다
function hall(sec) {
  const n = N(sec), out = [];
  for (let ch = 0; ch < 2; ch++) {
    const d = new Float32Array(n);
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, u = t / sec, k = 0.55 - 0.45 * u;
      a += k * ((rnd() * 2 - 1) - a); b += 0.5 * (a - b);
      d[i] = t < 0.011 ? 0 : (a * 0.7 + b * 0.3) * Math.exp(-6.2 * u) * Math.min(1, (t - 0.011) / 0.02);
    }
    for (const [ms, g] of [[13, 0.55], [19, 0.42], [29, 0.36], [37, 0.3], [48, 0.24], [61, 0.18], [77, 0.13], [95, 0.09]]) {
      const i = Math.floor(SR * ms * (1 + ch * 0.07) / 1000);
      if (i < n) d[i] += g * (rnd() < 0.5 ? -1 : 1);
    }
    out.push(d);
  }
  return out;
}
// 분위기 바탕: 이음매 없이 도는 잡음(좌우가 서로 달라 넓게 들린다)
const BEDS = {
  pink: () => [0, 1].map(() => level(loopify(noise(6.3, 'p'), 0.3), 0.25)),
  brown: () => [0, 1].map(() => level(loopify(noise(6.3, 'b'), 0.3), 0.25)),
  fire: () => [level(loopify(fire(4.3, 1, 18), 0.3), 0.2)],
};

// 열쇠마다 다른 씨앗(FNV-1a)
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
// 열쇠의 재생 정보(효과음·분위기 소리만)
export function meta(key) {
  const [kind, name] = key.split(':');
  const e = kind === 'sfx' ? SFX[name] : kind === 'amb' ? AMB[name] : null;
  return e ? e[0] : null;
}
// 그리기: sr은 오디오 컨텍스트 표본율. 어두운 소리는 그 절반으로 그려 시간·메모리를 아낀다
export function render(key, sr) {
  const [kind, name, arg] = key.split(':'), v = +arg || 0;
  let hi = 0, R;
  if (kind === 'sfx' || kind === 'amb') {
    const e = (kind === 'sfx' ? SFX : AMB)[name];
    if (!e) throw new Error('없는 소리: ' + key);
    hi = e[0].hi; R = e[1];
  } else if (kind === 'mus') {
    const I = INSTR[name];
    if (!I) throw new Error('없는 악기: ' + key);
    hi = I.hi; R = () => I.r(v);
  } else if (kind === 'ir') { hi = 1; R = () => hall(2.2); }
  else if (kind === 'bed' && BEDS[name]) R = BEDS[name];
  else throw new Error('알 수 없는 열쇠: ' + key);
  const rate = hi ? sr : Math.round(sr / 2);
  begin(rate, hash(key));
  const t0 = performance.now(), r = R(), ms = performance.now() - t0;
  const ch = (Array.isArray(r) ? r : [r]).map((c) => (c.byteOffset || c.byteLength !== c.buffer.byteLength ? c.slice() : c));
  return { ch, sr: rate, ms };
}

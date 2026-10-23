// Web Audio 도우미: 끊김 없는 게인 변화, 배음 파형, 잡음 버퍼, 합창 모음 필터, 찌그러뜨림 곡선
// 게인을 지금 값에서 이어서 바꾼다(진행 중인 변화를 기억해 끊김·딸깍 소리를 막는다)
export function glide(node, to, t, dur) {
  const g = node.gain, r = node._r || { v0: g.value, v1: g.value, t0: 0, t1: 0 };
  const cur = t >= r.t1 ? r.v1 : t <= r.t0 ? r.v0 : r.v0 + (r.v1 - r.v0) * (t - r.t0) / (r.t1 - r.t0);
  g.cancelScheduledValues(t); g.setValueAtTime(cur, t); g.linearRampToValueAtTime(to, t + Math.max(0.005, dur));
  node._r = { v0: cur, v1: to, t0: t, t1: t + Math.max(0.005, dur) };
}
// 배음 진폭 목록으로 만든 파형(컨텍스트마다 한 번)
const CACHE = new WeakMap();
function periodic(c, amps) {
  const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1);
  for (let i = 0; i < amps.length; i++) im[i + 1] = amps[i];
  return c.createPeriodicWave(re, im);
}
export function kit(c) {
  let k = CACHE.get(c);
  if (k) return k;
  const mk = (fn, n = 40) => periodic(c, Array.from({ length: n }, (_, i) => fn(i + 1)));
  const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 3.2) / Math.tanh(3.2); }
  k = {
    saw: mk((n) => 1 / Math.pow(n, 1.1)), // 현·합창: 톱니보다 조금 부드럽게
    brass: mk((n) => 1 / Math.pow(n, 0.8)), // 금관: 높은 배음이 강하다
    soft: mk((n) => 1 / Math.pow(n, 1.7), 24), // 짧게 끊는 현
    organ: mk((n) => [1, 0.5, 0.25, 0.3, 0.1, 0.12, 0, 0.08][n - 1] ?? 0, 8), // 낮은 울림
    noise: nb, curve,
  };
  CACHE.set(c, k);
  return k;
}
// 합창 '아·오': 모음 포먼트 대역 통과 셋 + 낮은 몸통을 악기 전체가 함께 쓴다(음마다 두면 무겁다)
export function formants(c, src, vowel = 'a') {
  const F = { a: [[700, 5, 1], [1120, 7, 0.55], [2650, 9, 0.3]], o: [[520, 5, 1], [860, 7, 0.6], [2500, 9, 0.22]], u: [[340, 5, 1], [800, 7, 0.4], [2300, 9, 0.15]] }[vowel];
  const mix = c.createGain();
  for (const [fq, q, a] of F) {
    const bp = c.createBiquadFilter(), ga = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q; ga.gain.value = a;
    src.connect(bp); bp.connect(ga); ga.connect(mix);
  }
  const lp = c.createBiquadFilter(), lg = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 600; lg.gain.value = 0.18;
  src.connect(lp); lp.connect(lg); lg.connect(mix);
  return mix;
}
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

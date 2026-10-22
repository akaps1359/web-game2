// 숫자·날짜·수정치 표기
import { ymd } from '../engine/world.js';

export function fmtNum(n, d = 0) {
  if (n == null || !isFinite(n)) return '-';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return n.toFixed(d);
}
export function fmtMan(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + '백만';
  if (n >= 1e4) return Math.round(n / 1e4) + '만';
  return Math.round(n).toLocaleString('ko-KR');
}
export const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
export const sgn = (v, d = 0, suf = '') => (v > 0 ? '+' : '') + (v * (suf === '%' ? 100 : 1)).toFixed(d) + suf;
export function fmtDateShort(hour) { const t = ymd(hour); return `${t.y}.${String(t.m).padStart(2, '0')}.${String(t.d).padStart(2, '0')}`; }
export function fmtHour(hour) { const t = ymd(hour); return `${String(t.h).padStart(2, '0')}:00`; }
export function fmtDays(d) { if (d < 1) return '1일 미만'; if (d < 60) return `${Math.ceil(d)}일`; return `${(d / 30.4).toFixed(1)}개월`; }

// 수정치 이름
export const MOD_NAMES = {
  pp: ['정치력', 'flat', '/일'], ppFactor: ['정치력 획득', '%'], stability: ['안정도', '%'], warSupport: ['전쟁 지지도', '%'],
  research: ['연구 속도', '%'], construction: ['건설 속도', '%'], factoryOutput: ['군수 공장 산출', '%'], dockOutput: ['조선소 산출', '%'],
  prodEffCap: ['생산 효율 상한', '%'], prodEffGain: ['생산 효율 증가', '%'], consumerGoods: ['소비재 공장', '%', '', true], manpower: ['징병 가능 인구', '%'],
  slots: ['건설 슬롯', '%'], resources: ['자원 채굴', '%'], fuelCap: ['연료 저장', '%'], fuelGain: ['연료 획득', '%'], 'milfac.cost': ['군수 공장 건설 비용', '%', '', true],
  training: ['훈련 시간', '%', '', true], justify: ['정당화 시간', '%', '', true], tension: ['긴장도 유발', '%', '', true], surrender: ['항복 한계', '%'], winter: ['겨울 피해 감소', '%'],
  'land.atk': ['지상군 공격', '%'], 'land.def': ['지상군 방어', '%'], 'land.org': ['조직력', '%'], 'land.brk': ['돌파', '%'], 'land.speed': ['이동 속도', '%'],
  'land.planning': ['최대 계획 보너스', '%'], 'land.entrench': ['참호', '%'], 'land.reinforce': ['보충 속도', '%'], 'land.recovery': ['조직력 회복', '%'],
  'inf.atk': ['보병 공격', '%'], 'inf.def': ['보병 방어', '%'], 'arm.atk': ['기갑 공격', '%'], 'art.atk': ['포병 공격', '%'], 'mot.atk': ['차량화 공격', '%'], 'cav.atk': ['기병 공격', '%'], 'width.pen': ['초과 전장 너비 패널티', '%', '', true],
  'air.atk': ['공중 공격', '%'], 'air.def': ['공중 방어', '%'], 'air.agi': ['기동성', '%'], 'cas.dmg': ['근접 지원 피해', '%'], 'bomb.dmg': ['폭격 피해', '%'],
  'navy.atk': ['해군 공격', '%'], 'navy.def': ['해군 방어', '%'], 'sub.atk': ['잠수함 공격', '%'], 'sub.def': ['잠수함 은밀도', '%'], focusSpeed: ['국가 중점 속도', '%'], drift: ['집권당 지지 증가', 'flat'],
  'stability.target': ['안정도', '%'], 'warSupport.target': ['전쟁 지지도', '%'], 'civfac.cost': ['민간 공장 건설 비용', '%', '', true],
};
export function modLines(mods) {
  const out = [];
  for (const k in mods || {}) {
    const v = mods[k]; if (!v) continue;
    const def = MOD_NAMES[k] || [k, '%'];
    const [name, kind, suf = '', invert] = def;
    const good = invert ? v < 0 : v > 0;
    const val = kind === 'flat' ? (v > 0 ? '+' : '') + (+v.toFixed(2)) + suf : (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
    out.push({ name, val, good });
  }
  return out;
}
export function modHTML(mods) {
  return modLines(mods).map((l) => `<div>${l.name} <span class="${l.good ? 'p' : 'n'}">${l.val}</span></div>`).join('');
}

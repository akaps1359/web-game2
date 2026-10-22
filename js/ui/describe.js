// 효과·조건을 한국어 문장으로
import { SPIRITS, LAW_GROUPS } from '../data/ideas.js';
import { TECH, TECH_CATS } from '../data/techs.js';
import { EQUIPMENT } from '../data/units.js';
import { COUNTRIES, FACTION_DEFS } from '../data/countries.js';
import { modHTML } from './fmt.js';

const BUILD_NAMES = { civ: '민간 공장', mil: '군수 공장', dock: '조선소', ref: '합성 정유소', infra: '기반 시설' };

export function describeEffects(G, C, fx, depth = 0) {
  if (!fx || !fx.length) return '';
  const nm = (t) => (t === 'THIS' ? C.name : G.countries[t]?.name || COUNTRIES[t]?.name || t);
  const st = (k) => G.map.name[typeof k === 'number' ? k : G.map.idx[k]] || k;
  const lines = [];
  const p = (v, d = 0) => (v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%';
  for (const e of fx) {
    const [op, a, b, c] = e;
    switch (op) {
      case 'pp': lines.push(`정치력 <b class="${a >= 0 ? 'good' : 'bad'}">${a > 0 ? '+' : ''}${a}</b>`); break;
      case 'stab': lines.push(`안정도 <b class="${a >= 0 ? 'good' : 'bad'}">${p(a)}</b>`); break;
      case 'ws': lines.push(`전쟁 지지도 <b class="${a >= 0 ? 'good' : 'bad'}">${p(a)}</b>`); break;
      case 'spirit': { const S = SPIRITS[a]; lines.push(`국가 정신 「${c?.name || S?.name || a}」${b ? ` (${b}일)` : ''} 획득<div class="mods" style="margin-left:8px">${modHTML(c || S?.mods)}</div>`); break; }
      case 'rmSpirit': lines.push(`국가 정신 「${SPIRITS[a]?.name || a}」 제거`); break;
      case 'mods': lines.push(`<div class="mods">${modHTML(a)}</div>`); break;
      case 'civ': case 'mil': case 'dock': case 'ref': case 'infra': lines.push(`${b ? st(b) + '에 ' : ''}${BUILD_NAMES[op]} +${a}`); break;
      case 'fort': lines.push(`${st(b)} 요새 +${a}`); break;
      case 'airbase': lines.push(`공군 기지 +${a}`); break;
      case 'rbonus': { const cat = TECH_CATS.find((x) => x.key === a)?.name || (a === 'any' ? '모든 분야' : a); lines.push(`연구 보너스: ${cat} +${Math.round(b * 100)}% (${c || 1}회)`); break; }
      case 'tech': lines.push(`기술 획득: ${TECH[a]?.name || a}`); break;
      case 'rslot': lines.push(`연구 슬롯 +${a}`); break;
      case 'claim': lines.push(`영유권 주장: ${[].concat(a).map(st).join(', ')}`); break;
      case 'core': lines.push(`핵심 영토화: ${[].concat(a).map(st).join(', ')}`); break;
      case 'wargoal': lines.push(`전쟁 목표 획득: <b>${nm(a)}</b>`); break;
      case 'annex': lines.push(`<b>${nm(a)}</b> 병합`); break;
      case 'annexBy': lines.push(`${nm(a)}이(가) ${nm(b)} 병합`); break;
      case 'transfer': lines.push(`${[].concat(a).map(st).join(', ')} → ${nm(b || 'THIS')}`); break;
      case 'puppet': lines.push(`<b>${nm(a)}</b>을(를) 괴뢰국으로`); break;
      case 'war': lines.push(`<b class="bad">${nm(a)}에 선전포고</b>`); break;
      case 'warOn': lines.push(`<b class="bad">${nm(a)}이(가) ${nm(b)}에 선전포고</b>`); break;
      case 'joinWarOf': lines.push(`${nm(a)} 편으로 참전`); break;
      case 'createFaction': lines.push(`진영 「${FACTION_DEFS[a]?.name || a}」 결성`); break;
      case 'joinFaction': lines.push(`${nm(a)}의 진영에 가입`); break;
      case 'addToFaction': lines.push(`${nm(a)}을(를) 진영에 초대`); break;
      case 'leaveFaction': lines.push('진영 탈퇴'); break;
      case 'nap': lines.push(`${nm(a)}와(과) 불가침 조약`); break;
      case 'access': lines.push(`${nm(a)}의 군사 통행권`); break;
      case 'guaranteeFree': lines.push(`${nm(a)} 독립 보장`); break;
      case 'tension': lines.push(`세계 긴장도 ${p(a, 1)}`); break;
      case 'ideology': lines.push(`${({ dem: '민주주의', fas: '파시즘', com: '공산주의', neu: '비동맹' })[a]} 지지율 ${p(b)}`); break;
      case 'gov': if (a.leader) lines.push(`새 지도자: ${a.leader}`); if (a.ideology) lines.push(`집권 이념 변경`); break;
      case 'equip': lines.push(`${EQUIPMENT[a]?.name || a} +${b}`); break;
      case 'manpower': lines.push(`인력 +${a.toLocaleString()}`); break;
      case 'fuel': lines.push(`연료 +${a.toLocaleString()}`); break;
      case 'law': lines.push(`${LAW_GROUPS[a]?.name}: ${LAW_GROUPS[a]?.laws[b]?.name} 시행`); break;
      case 'demil': lines.push(`${st(a)} 재무장`); break;
      case 'units': lines.push(`사단 ${a.reduce((s, x) => s + x[1], 0)}개 편성`); break;
      case 'civilWar': lines.push(`<b class="bad">내전 발발: ${nm(a)}</b>`); break;
      case 'spawn': lines.push(`${nm(a)} 수립`); break;
      case 'amphib': lines.push(`상륙 작전: ${Object.entries(a).map(([k, n]) => `${st(k)} ${n}개 사단`).join(', ')}`); break;
      case 'deploy': lines.push(`${st(b)}에 사단 ${a}개 파견`); break;
      case 'returnGov': lines.push(`정부 귀환: ${st(a)}`); break;
      case 'shock': lines.push(`<b class="bad">기습 피해</b>: 사단 조직력 ${p(a - 1)}${b != null && b < 1 ? `, 전력 ${p(b - 1)}` : ''}${c != null ? `, 항공기 ${p(c - 1)}` : ''}`); break;
      case 'evacuate': lines.push(`공장 소개령 ${a}일: 빼앗기는 주의 공장 ${Math.round((b ?? 0.5) * 100)}%를 후방으로 옮김`); break;
      case 'disband': lines.push(`<b class="bad">군대 무장 해제</b> (${[].concat(a).length ? `${[].concat(a).map(st).join('·')}의 ` : ''}최대 ${b}개 사단만 남음)`); break;
      case 'if': { const inner = describeEffects(G, C, b, depth + 1); if (inner) lines.push(`(조건부) ${inner}`); break; }
      case 'for': { const inner = describeEffects(G, G.countries[a] || C, b, depth + 1); if (inner) lines.push(`${nm(a)}: ${inner}`); break; }
      case 'random': lines.push(`${Math.round(a * 100)}% 확률: ${describeEffects(G, C, b, depth + 1)}`); break;
      case 'event': case 'flag': case 'cflag': case 'aiPlan': case 'news': case 'relocateCapital': case 'capital': case 'xp': case 'opinion': case 'popAdd': case 'unpuppet': case 'demilAll': case 'unlock': break;
      default: break;
    }
  }
  return lines.map((l) => `<div>${l}</div>`).join('');
}

// 정치: 개요 · 법률 · 고문 · 결정
import { h, onTap } from '../dom.js';
import { icon } from '../icons.js';
import { btn, flag, bar, stat, card, item, empty, setBar } from './common.js';
import { LAW_GROUPS, LAW_COST, ADVISOR_ROLES, ADVISOR_SLOTS, ADVISOR_COST, DECISIONS } from '../../data/ideas.js';
import { IDEOLOGIES } from '../../data/countries.js';
import { lawBlocked, enactLaw, advisorBlocked, hireAdvisor, fireAdvisor, advisorName, spiritInfo, decisionBlocked, takeDecision } from '../../engine/politics.js';
import { refreshMods } from '../../engine/mods.js';
import { atWarAny } from '../../engine/world.js';
import { pct, modHTML, fmtDays } from '../fmt.js';
import { showDialog } from '../modal.js';

const LAW_IC = { conscription: 'manpower', economy: 'industry', trade: 'globe' };
const SLOT_NAMES = { pol: '정치 고문', army: '육군', navy: '해군', air: '공군' };

export const politicsPanel = {
  size: 'tall',
  title: (app) => '정치',
  tabs: [['overview', '개요'], ['laws', '법률'], ['advisors', '고문'], ['decisions', '결정']],
  sig: (app, arg, tab) => { const C = app.G.countries[app.G.player]; return `${tab}|${Math.floor(C.pp / 25)}|${JSON.stringify(C.laws)}|${C.advisors.pol.join()}${C.advisors.army}${C.advisors.navy}${C.advisors.air}|${C.spirits.length}|${app.G.wars.length}|${C.leader}|${C.ideology}`; },
  render(app, body, arg, ctx) {
    const G = app.G, C = G.countries[G.player];
    // 공통 상단: 정치력
    const ppV = h('b', { class: 'gold' }), ppS = h('span', { class: 'tiny muted' });
    const updPP = () => { ppV.textContent = Math.floor(C.pp); ppS.textContent = ` (+${(C.ppGain || 0).toFixed(2)}/일)`; };
    updPP(); ctx.onUpdate(updPP);
    body.appendChild(h('div', { class: 'row', style: { margin: '0 2px 10px' } }, h('span', { class: 'icon-txt gold', html: icon('pp') }), h('span', { class: 'small' }, '정치력 '), ppV, ppS));
    if (ctx.tab === 'overview') overview(app, body, ctx);
    else if (ctx.tab === 'laws') laws(app, body, ctx);
    else if (ctx.tab === 'advisors') advisors(app, body, ctx);
    else decisions(app, body, ctx);
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
};

function overview(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const I = IDEOLOGIES[C.ideology];
  body.appendChild(h('div', { class: 'card brass' },
    h('div', { class: 'row' }, flag(C, 'flag-lg'), h('div', { class: 'grow' },
      h('div', { style: { fontFamily: 'var(--serif)', fontSize: '17px', color: 'var(--paper)', lineHeight: 1.25 } }, C.full),
      h('div', { class: 'small', style: { marginTop: '3px' } }, `${C.leader}`, h('span', { class: 'muted' }, ` · ${C.title}`)),
      h('div', { class: 'tiny', style: { color: I.color, marginTop: '3px', filter: 'brightness(1.4)' } }, `${I.name} · ${C.gov}`),
      C.party ? h('div', { class: 'tiny muted' }, C.party) : null))));
  // 안정도 · 전쟁 지지도
  const sb = bar(C.stability, 'green'), wb = bar(C.warSupport, 'red'), tb = bar(G.tension, 'red');
  const sv = h('b'), wv = h('b'), tv = h('b');
  const upd = () => { setBar(sb, C.stability); setBar(wb, C.warSupport); setBar(tb, G.tension); sv.textContent = pct(C.stability); wv.textContent = pct(C.warSupport); tv.textContent = pct(G.tension); };
  upd(); ctx.onUpdate(upd);
  const line = (ic, label, v, b, note) => h('div', { style: { margin: '8px 0' } }, h('div', { class: 'row small' }, h('span', { class: 'icon-txt', html: icon(ic) }), h('span', { class: 'grow' }, label), v), b, note ? h('div', { class: 'tiny muted', style: { marginTop: '3px' } }, note) : null);
  body.appendChild(card(`${icon('stability')} 국내 정세`,
    line('stability', '안정도', sv, sb, '50% 이상이면 공장 산출·정치력에 보너스, 낮으면 패널티'),
    line('warsupport', '전쟁 지지도', wv, wb, '징병법·경제법 변경 조건, 낮으면 항복 한계 감소'),
    line('tension', '세계 긴장도', tv, tb, '긴장도가 높을수록 민주주의 국가도 전쟁 준비가 가능')));
  // 이념 지지율
  const ib = card(`${icon('people')} 이념 지지율`);
  const bars = h('div', { class: 'ideo-bar' });
  const legend = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px', marginTop: '8px' } });
  for (const k of ['dem', 'fas', 'com', 'neu']) {
    const v = C.pop[k] || 0;
    bars.appendChild(h('i', { style: { width: v * 100 + '%', background: IDEOLOGIES[k].color } }));
    legend.appendChild(h('span', { class: 'tiny', style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, h('i', { style: { width: '9px', height: '9px', borderRadius: '2px', background: IDEOLOGIES[k].color, display: 'inline-block' } }), `${IDEOLOGIES[k].name} ${pct(v)}`));
  }
  ib.append(bars, legend);
  body.appendChild(ib);
  // 국가 정신
  const sp = card(`${icon('flag')} 국가 정신`);
  if (!C.spirits.length) sp.appendChild(h('div', { class: 'note' }, '없음'));
  for (const s of C.spirits) {
    const info = spiritInfo(s);
    if (info.hidden) continue;
    const left = s.until ? ` · ${fmtDays((s.until - G.hour) / 24)} 남음` : '';
    sp.appendChild(h('div', { class: 'spirit' }, h('div', { class: 'small', style: { color: 'var(--paper)', fontWeight: 600 } }, info.name, h('span', { class: 'tiny muted' }, left)), info.desc ? h('div', { class: 'tiny muted' }, info.desc) : null, h('div', { class: 'mods', html: modHTML(info.mods) })));
  }
  body.appendChild(sp);
  // 법률 요약
  const lw = card(`${icon('politics')} 현재 법률`);
  for (const g in LAW_GROUPS) lw.appendChild(item({ ic: LAW_IC[g], t: LAW_GROUPS[g].laws[C.laws[g]]?.name || '-', d: LAW_GROUPS[g].name, onClick: () => ctx.sheet.setTab('laws') }));
  body.appendChild(lw);
}

function lawDesc(group, L) {
  const out = [];
  if (group === 'conscription') out.push(`징병 가능 인구 ${(L.mp * 100).toFixed(1)}%`);
  if (group === 'economy') out.push(`소비재 공장 ${Math.round(L.cg * 100)}%`);
  if (group === 'trade') out.push(`자원 수출 ${Math.round(L.exp * 100)}%`);
  return out.join(' · ');
}

function laws(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  for (const g in LAW_GROUPS) {
    const grp = LAW_GROUPS[g];
    const c = card(`${icon(LAW_IC[g])} ${grp.name} <small>변경 비용 ${LAW_COST}</small>`);
    for (const id of grp.order) {
      const L = grp.laws[id];
      const curL = C.laws[g] === id;
      const why = lawBlocked(G, C, g, id);
      if ((id === 'isolation' || id === 'disarmed') && !curL) continue;
      const right = curL ? h('span', { class: 'pill gold' }, '시행 중') : btn('시행', () => {
        showDialog(app, { title: `${L.name} 시행`, html: `${grp.name}을(를) 「${L.name}」(으)로 바꿉니다. 정치력 ${LAW_COST}을(를) 사용합니다.<div class="mods" style="margin-top:8px">${modHTML(L.mods)}</div>`, buttons: [{ text: '시행', primary: true, fn: () => { if (enactLaw(G, C, g, id)) { refreshMods(C); app.toast(`${L.name} 시행`, 'peace'); app.hudDirty = true; ctx.rerender(); } } }, { text: '취소' }] });
      }, 'sm' + (why ? ' disabled' : ''));
      const el = h('div', { class: 'law' + (curL ? ' cur' : '') },
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, L.name), h('div', { class: 'tiny muted' }, lawDesc(g, L))), right),
        h('div', { class: 'mods', html: modHTML(L.mods) }),
        why && !curL ? h('div', { class: 'tiny', style: { color: 'var(--amber)' } }, why) : null);
      c.appendChild(el);
    }
    body.appendChild(c);
  }
}

function advisors(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  // 현재 임명
  const cur = card(`${icon('people')} 내각과 참모 <small>고용 ${ADVISOR_COST}</small>`);
  const slotRows = [];
  for (let i = 0; i < ADVISOR_SLOTS.pol; i++) slotRows.push(['pol', C.advisors.pol[i] || null]);
  for (const s of ['army', 'navy', 'air']) slotRows.push([s, C.advisors[s]]);
  for (const [slot, role] of slotRows) {
    if (!role) { cur.appendChild(h('div', { class: 'slot', style: { marginBottom: '6px' } }, h('div', { class: 'ic', html: icon('plus') }), h('div', { class: 'grow small muted' }, `${SLOT_NAMES[slot]} — 공석`))); continue; }
    const R = ADVISOR_ROLES[role];
    cur.appendChild(h('div', { class: 'slot busy', style: { marginBottom: '6px' } }, h('div', { class: 'ic', html: icon(slot === 'pol' ? 'pp' : slot === 'army' ? 'army' : slot === 'navy' ? 'ship' : 'fighter') }),
      h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: 'var(--paper)', fontWeight: 600 } }, advisorName(C, role)), h('div', { class: 'tiny muted' }, `${R.name} · ${R.desc}`)),
      btn('해임', () => showDialog(app, { title: '해임', body: `${advisorName(C, role)}을(를) 해임합니다. 다시 고용할 수 없습니다.`, buttons: [{ text: '해임', danger: true, fn: () => { fireAdvisor(G, C, role); (C.firedAdvisors ||= {})[role] = 1; refreshMods(C); ctx.rerender(); } }, { text: '취소' }] }), 'xs')));
  }
  body.appendChild(cur);
  const av = card(`${icon('plus')} 고용 가능`);
  for (const role in ADVISOR_ROLES) {
    const R = ADVISOR_ROLES[role];
    const hired = R.slot === 'pol' ? C.advisors.pol.includes(role) : C.advisors[R.slot] === role;
    if (hired || C.firedAdvisors?.[role]) continue;
    const why = advisorBlocked(G, C, role);
    av.appendChild(item({ ic: R.slot === 'pol' ? 'pp' : R.slot === 'army' ? 'army' : R.slot === 'navy' ? 'ship' : 'fighter', t: advisorName(C, role), d: `${R.name} · ${R.desc}${why ? ` <span style="color:var(--amber)">· ${why}</span>` : ''}`,
      right: btn('고용', () => { if (hireAdvisor(G, C, role)) { refreshMods(C); app.toast(`${advisorName(C, role)} 임명`, 'peace'); app.hudDirty = true; ctx.rerender(); } }, 'sm' + (why ? ' disabled' : '')) }));
  }
  body.appendChild(av);
}

function decisions(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const c = card(`${icon('target')} 결정`);
  for (const D of DECISIONS) {
    const why = decisionBlocked(G, C, D);
    const cd = C.decCd?.[D.id] > G.hour ? ` · 재사용 ${fmtDays((C.decCd[D.id] - G.hour) / 24)}` : '';
    c.appendChild(item({ ic: 'star', t: `${D.name}`, d: `${D.desc} · 정치력 ${D.cost}${cd}${why && !cd ? ` <span style="color:var(--amber)">· ${why}</span>` : ''}`,
      right: btn('시행', () => { if (takeDecision(G, C, D.id)) { refreshMods(C); app.toast(`결정: ${D.name}`, 'peace'); app.hudDirty = true; ctx.rerender(); } }, 'sm' + (why ? ' disabled' : '')) }));
  }
  body.appendChild(c);
  // 진행 중 효과
  const active = C.spirits.filter((s) => s.until);
  if (active.length) body.appendChild(card(`${icon('clock')} 진행 중`, ...active.map((s) => { const info = spiritInfo(s); return h('div', { class: 'row small', style: { margin: '4px 0' } }, h('span', { class: 'grow' }, info.name), h('span', { class: 'muted' }, fmtDays((s.until - G.hour) / 24))); })));
}

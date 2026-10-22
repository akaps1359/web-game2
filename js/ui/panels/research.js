// 연구: 슬롯 · 분야별 기술
import { h, onTap } from '../dom.js';
import { icon } from '../icons.js';
import { btn, bar, card, empty, setBar } from './common.js';
import { TECHS, TECH, TECH_CATS } from '../../data/techs.js';
import { EQUIPMENT, BATTALIONS, SUPPORT, SHIPS } from '../../data/units.js';
import { techAvailable, techDays, startResearch, researchBonus, DAYS_PER_COST } from '../../engine/research.js';
import { aiResearch } from '../../engine/ai.js';
import { yearFrac } from '../../engine/world.js';
import { M } from '../../engine/mods.js';
import { modHTML, fmtDays } from '../fmt.js';
import { showDialog } from '../modal.js';

let pickSlot = -1;

const UNLOCK_NAMES = {
  support: '지원 장비', motorized: '차량화 보병 대대', mechanized: '기계화 보병 대대', mountaineers: '산악병 대대', marines: '해병 대대', paratroopers: '공수 대대',
  eng: '공병 중대', rec: '정찰 중대', fieldHospital: '야전 병원', logistics: '군수 중대', signal: '통신 중대', mtank1: '중형 전차 대대', htank1: '중전차 대대', refinery: '합성 정유소',
  dd: '구축함', cl: '경순양함', ca: '중순양함', bb: '전함', cv: '항공모함', ss: '잠수함',
};

export function techEffects(T) {
  const fx = T.fx || {};
  const out = [];
  if (fx.eq) for (const e in fx.eq) { const E = EQUIPMENT[e]; out.push(`장비: ${E?.lv?.[fx.eq[e]] || E?.name || e}`); }
  if (fx.unlock) out.push('해금: ' + fx.unlock.map((u) => UNLOCK_NAMES[u] || u).join(', '));
  if (fx.rslot) out.push(`연구 슬롯 +${fx.rslot}`);
  let html = out.map((x) => `<div>${x}</div>`).join('');
  if (fx.mods) html += modHTML(fx.mods);
  return html;
}

function techState(C, T) {
  if (C.techs[T.id]) return 'done';
  if (C.research.cur.some((s) => s && s.id === T.id)) return 'cur';
  if (techAvailable(C, T.id)) return 'avail';
  if (T.excl && TECHS.some((t) => t.excl === T.excl && t.id !== T.id && (C.techs[t.id] || C.research.cur.some((s) => s && s.id === t.id)))) return 'excl';
  return 'locked';
}

export const researchPanel = {
  size: 'tall',
  title: () => '연구',
  tabs: [['rec', '추천'], ...TECH_CATS.map((c) => [c.key, c.name])],
  sig: (app, arg, tab) => { const C = app.G.countries[app.G.player]; return `${tab}|${Object.keys(C.techs).length}|${C.research.cur.map((s) => s?.id).join()}|${C.research.slots}|${pickSlot}|${(C.rBonus || []).length}`; },
  render(app, body, arg, ctx) {
    const G = app.G, C = G.countries[G.player];
    const R = C.research;
    // 슬롯
    const slots = h('div', { class: 'list', style: { marginBottom: '12px' } });
    for (let i = 0; i < R.slots; i++) {
      const s = R.cur[i];
      if (pickSlot >= R.slots) pickSlot = -1;
      if (!s) {
        const el = h('div', { class: 'slot' + (pickSlot === i ? ' picked' : '') }, h('div', { class: 'ic', html: icon('plus') }), h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: 'var(--red-hi)', fontWeight: 600 } }, `슬롯 ${i + 1} — 비어 있음`), h('div', { class: 'tiny muted' }, '아래 목록에서 기술을 선택하세요')));
        onTap(el, () => { pickSlot = i; ctx.rerender(); });
        slots.appendChild(el);
        continue;
      }
      const T = TECH[s.id];
      const need = T.cost * DAYS_PER_COST * (1 + 2 * Math.max(0, T.year - yearFrac(G.hour)));
      const b = bar(s.prog / need, 'green');
      const left = h('span', { class: 'tiny muted' });
      const cat = TECH_CATS.find((c) => c.key === T.cat);
      const upd = () => { setBar(b, s.prog / need); const speed = Math.max(0.1, 1 + M(C, 'research') + researchBonus(C, T.cat)); left.textContent = `${fmtDays((need - s.prog) / speed)} 남음`; };
      upd(); ctx.onUpdate(upd);
      const el = h('div', { class: 'slot busy' + (pickSlot === i ? ' picked' : '') }, h('div', { class: 'ic', html: icon(cat?.icon || 'research') }),
        h('div', { class: 'grow' }, h('div', { class: 'row' }, h('div', { class: 'small grow', style: { color: 'var(--paper)', fontWeight: 600 } }, T.name), left), b));
      onTap(el, () => { pickSlot = pickSlot === i ? -1 : i; ctx.rerender(); });
      slots.appendChild(el);
    }
    body.appendChild(slots);
    // 연구 보너스 · 자동 연구
    const info = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px', marginBottom: '10px' } });
    for (const rb of C.rBonus || []) info.appendChild(h('span', { class: 'pill gold' }, `${rb.cat === 'any' ? '전 분야' : TECH_CATS.find((c) => c.key === rb.cat)?.name} +${Math.round(rb.bonus * 100)}% ×${rb.uses}`));
    info.appendChild(h('span', { class: 'pill' }, `연구 속도 ${Math.round((1 + M(C, 'research')) * 100)}%`));
    const auto = h('span', { class: 'pill' + (C.autoResearch ? ' green' : ''), style: { cursor: 'pointer' } }, C.autoResearch ? '자동 연구 켜짐' : '자동 연구 꺼짐');
    onTap(auto, () => { C.autoResearch = !C.autoResearch; if (C.autoResearch) aiResearch(G, C); app.hudDirty = true; ctx.rerender(); });
    info.appendChild(auto);
    body.appendChild(info);
    if (pickSlot >= 0) body.appendChild(h('div', { class: 'tiny', style: { color: 'var(--brass-hi)', margin: '-4px 2px 8px' } }, `슬롯 ${pickSlot + 1}에 넣을 기술을 고르세요`));
    // 기술 목록
    const y = yearFrac(G.hour);
    let list;
    if (ctx.tab === 'rec') list = TECHS.filter((T) => techAvailable(C, T.id) && T.year - y < 2).sort((a, b) => a.year - b.year || a.cost - b.cost).slice(0, 30);
    else list = TECHS.filter((T) => T.cat === ctx.tab).sort((a, b) => a.year - b.year);
    if (!list.length) body.appendChild(empty('연구할 수 있는 기술이 없습니다.'));
    const box = h('div', { class: 'list' });
    for (const T of list) {
      const s = techState(C, T);
      const ahead = T.year - y;
      const days = s === 'avail' || s === 'locked' || s === 'excl' ? techDays(G, C, T.id) : 0;
      const cat = TECH_CATS.find((c) => c.key === T.cat);
      const right = s === 'done' ? h('span', { class: 'pill gold' }, '완료') : s === 'cur' ? h('span', { class: 'pill green' }, '연구 중') : s === 'avail' ? h('span', { class: 'tiny ' + (ahead > 0 ? '' : 'muted'), style: { color: ahead > 0 ? 'var(--amber)' : '' } }, fmtDays(days)) : h('span', { class: 'pill' + (s === 'excl' ? ' red' : '') }, s === 'excl' ? '배타' : '잠김');
      const el = h('div', { class: `tech ${s === 'done' ? 'done' : s === 'avail' ? '' : s === 'cur' ? '' : 'locked'}${ahead > 0 && s === 'avail' ? ' ahead' : ''}` },
        h('div', { class: 'yr' }, T.year),
        h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: 'var(--paper)', fontWeight: 600 } }, T.name, ctx.tab === 'rec' ? h('span', { class: 'tiny muted' }, ` · ${cat?.name}`) : null),
          h('div', { class: 'mods tiny', html: techEffects(T) + (T.desc ? `<div class="muted">${T.desc}</div>` : '') + (s === 'locked' && T.req ? `<div style="color:var(--amber)">선행: ${T.req.map((r) => TECH[r]?.name).join(', ')}</div>` : '') + (ahead > 0 && s === 'avail' ? `<div style="color:var(--amber)">시대를 앞선 연구: 소요 시간 +${Math.round(ahead * 200)}%</div>` : '') })),
        right);
      if (s === 'avail') onTap(el, () => {
        let slot = pickSlot >= 0 ? pickSlot : R.cur.findIndex((x, i) => i < R.slots && !x);
        const go = (k) => { if (startResearch(G, C, k, T.id)) { app.toast(`연구 시작: ${T.name}`); pickSlot = -1; app.hudDirty = true; ctx.rerender(); } };
        if (slot >= 0) go(slot);
        else showDialog(app, { title: '교체할 슬롯', body: '모든 슬롯이 연구 중입니다. 어느 연구를 바꿀까요? (진행도는 보존됩니다)', buttons: R.cur.slice(0, R.slots).map((x, i) => ({ text: `슬롯 ${i + 1}: ${TECH[x.id].name}`, fn: () => go(i) })).concat([{ text: '취소' }]) });
      });
      box.appendChild(el);
    }
    body.appendChild(box);
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
  onClose() { pickSlot = -1; },
};

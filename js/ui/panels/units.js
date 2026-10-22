// 선택한 사단 목록 · 명령
import { h, onTap } from '../dom.js';
import { icon } from '../icons.js';
import { btn, bar, stat, card, item, empty, setBar } from './common.js';
import { divStats, divKind, getTpl, tplStats, assignArmy, createArmy, armiesOf, disbandDivision, changeTemplate, tplAvailable } from '../../engine/military.js';
import { atWar } from '../../engine/world.js';
import { showDialog } from '../modal.js';
import { pct } from '../fmt.js';

let mode = null; // null | 'army' | 'tpl'
let lastArg = null;

export function divIcon(G, D) {
  const C = G.countries[D.tag];
  const tpl = getTpl(C, D.tpl);
  if (tpl?.bats.mtn) return 'mtn';
  if (tpl?.bats.mar) return 'mar';
  if (tpl?.bats.para) return 'para';
  if (tpl?.bats.mech) return 'mech';
  return divKind(divStats(G, D));
}

export function divStatus(G, D) {
  const map = G.map;
  if (D.sea) return D.sea.kind === 'invade' ? `상륙 작전 → ${map.name[D.sea.to]}` : `해상 수송 → ${map.name[D.sea.to]}`;
  if (D.retreat) return '후퇴 중';
  if (D.att >= 0) return `${map.name[D.att]} 공격 중`;
  const B = G.battles[D.loc];
  if (B && B.defIds?.includes(D.id)) return '방어 전투 중';
  if (D.path.length) return `→ ${map.name[D.path[D.path.length - 1]]} 이동 중`;
  return D.ent >= 1 ? `대기 · 참호 ${D.ent.toFixed(1)}` : '대기';
}

export function divRow(app, D, { selectable = true, onClick } = {}) {
  const G = app.G;
  const st = divStats(G, D);
  const on = app.sel.divs.has(D.id);
  const orgB = bar(st.org ? D.org / st.org : 0, 'green thin'), strB = bar(D.str, 'thin');
  const status = h('div', { class: 'tiny muted ellip' }, `${G.map.name[D.loc]} · ${divStatus(G, D)}`);
  const chk = selectable ? h('div', { class: 'chk' + (on ? ' on' : ''), html: on ? icon('check') : '' }) : null;
  const row = h('div', { class: 'div-row' + (on ? ' sel' : '') },
    chk,
    h('div', { class: 'sym', html: icon(divIcon(G, D)), style: { color: 'var(--paper)' } }),
    h('div', { class: 'grow' }, h('div', { class: 'small ellip', style: { color: 'var(--paper)', fontWeight: 600 } }, D.name), status),
    h('div', { class: 'bars' }, orgB, strB, h('div', { class: 'tiny muted', style: { textAlign: 'right' } }, `${Math.round(D.str * 100)}%`)));
  onTap(row, onClick || (() => {
    if (app.sel.divs.has(D.id)) app.sel.divs.delete(D.id); else app.sel.divs.add(D.id);
    app.sel.mode = 'move'; app.updateFloat(); app.dirty = true; app.sheet.refresh();
  }));
  const upd = () => { setBar(orgB, st.org ? D.org / st.org : 0); setBar(strB, D.str); status.textContent = `${G.map.name[D.loc]} · ${divStatus(G, D)}`; strB.nextSibling.textContent = `${Math.round(D.str * 100)}%`; };
  return [row, upd];
}

// 선택 사단 합산 능력치
function sumStats(G, divs) {
  const s = { atk: 0, def: 0, brk: 0, org: 0, orgMax: 0, str: 0, spd: 99, arm: 0, w: 0 };
  for (const D of divs) {
    const st = divStats(G, D);
    s.atk += (st.sa + st.ha) * D.str; s.def += st.def * D.str; s.brk += st.brk * D.str;
    s.org += D.org; s.orgMax += st.org; s.str += D.str; s.spd = Math.min(s.spd, st.spd); s.arm = Math.max(s.arm, st.arm); s.w += st.w;
  }
  return s;
}

export const unitsPanel = {
  size: 'half',
  title: (app, ids) => {
    const n = ids.filter((id) => app.G.divs[id]).length;
    const D = app.G.divs[ids.find((id) => app.G.divs[id])];
    return h('div', { class: 'grow', style: { minWidth: 0 } }, h('h2', null, `${n}개 사단`), D ? h('div', { class: 'sub' }, app.map.name[D.loc]) : null);
  },
  sig: (app, ids) => ids.map((id) => { const D = app.G.divs[id]; return D ? D.army + (app.sel.divs.has(id) ? 's' : '') : 'x'; }).join(',') + '|' + mode,
  render(app, body, ids, ctx) {
    const G = app.G, C = G.countries[G.player];
    if (lastArg !== ids) { mode = null; lastArg = ids; }
    const divs = ids.map((id) => G.divs[id]).filter(Boolean);
    if (!divs.length) { body.appendChild(empty('사단이 없습니다.')); return; }
    const own = divs[0].tag === G.player;
    const selDivs = divs.filter((D) => app.sel.divs.has(D.id));
    const S = sumStats(G, selDivs.length ? selDivs : divs);
    const n = selDivs.length || divs.length;
    body.appendChild(h('div', { class: 'grid3', style: { marginBottom: '10px' } },
      stat('공격', Math.round(S.atk), 'attack'), stat('방어', Math.round(S.def), 'shield'), stat('돌파', Math.round(S.brk), 'move'),
      stat('조직력', pct(S.orgMax ? S.org / S.orgMax : 0), 'flag'), stat('전력', pct(S.str / n), 'people'), stat('속도', `${S.spd.toFixed(1)}`, 'clock', 'km/h')));
    if (own) {
      const allSel = divs.every((D) => app.sel.divs.has(D.id));
      const actions = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px', marginBottom: '10px' } },
        btn(allSel ? '선택 해제' : '전체 선택', () => { if (allSel) for (const D of divs) app.sel.divs.delete(D.id); else for (const D of divs) app.sel.divs.add(D.id); app.sel.mode = 'move'; app.updateFloat(); app.dirty = true; ctx.rerender(); }, 'sm', 'check'),
        btn('정지', () => { for (const D of selDivs.length ? selDivs : divs) { D.path = []; D.att = -1; D.prog = 0; if (D.army && G.armies[D.army]) G.armies[D.army].auto = false; } app.toast('정지 명령'); app.dirty = true; }, 'sm', 'stop'),
        btn('군 배치', () => { mode = mode === 'army' ? null : 'army'; ctx.rerender(); }, 'sm' + (mode === 'army' ? ' primary' : ''), 'army'),
        btn('편제 변경', () => { mode = mode === 'tpl' ? null : 'tpl'; ctx.rerender(); }, 'sm' + (mode === 'tpl' ? ' primary' : ''), 'edit'),
        btn('해산', () => {
          const list = selDivs.length ? selDivs : divs;
          showDialog(app, { title: '사단 해산', body: `${list.length}개 사단을 해산합니다. 인력과 장비 80%가 반환됩니다.`, buttons: [{ text: '해산', danger: true, fn: () => { for (const D of list) { disbandDivision(G, D); app.sel.divs.delete(D.id); } app.updateFloat(); app.dirty = true; app.sheet.refresh(); } }, { text: '취소' }] });
        }, 'sm danger', 'trash'));
      body.appendChild(actions);
      const targets = selDivs.length ? selDivs : divs;
      if (mode === 'army') {
        const c = card(`${icon('army')} ${targets.length}개 사단을 배치할 군`);
        for (const A of armiesOf(G, G.player)) {
          const live = A.divs.filter((id) => G.divs[id]).length;
          c.appendChild(item({ ic: 'army', t: A.name, d: `${live}개 사단 · ${A.auto ? (A.order === 'attack' ? '자동 공세' : '자동 방어') : '수동 지휘'}`, onClick: () => { for (const D of targets) assignArmy(G, D, A.id); mode = null; app.toast(`${targets.length}개 사단 → ${A.name}`); ctx.rerender(); } }));
        }
        c.appendChild(h('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } },
          btn('새 군 창설', () => { const A = createArmy(G, G.player); for (const D of targets) assignArmy(G, D, A.id); mode = null; app.toast(`${A.name} 창설 (${targets.length}개 사단)`, 'peace'); ctx.rerender(); }, 'sm primary', 'plus'),
          btn('군에서 제외', () => { for (const D of targets) assignArmy(G, D, 0); mode = null; ctx.rerender(); }, 'sm')));
        body.appendChild(c);
      }
      if (mode === 'tpl') {
        const c = card(`${icon('edit')} 새 편제 선택 <small>장비는 비축분에서 보충</small>`);
        for (const T of C.templates) {
          if (!tplAvailable(C, T)) continue;
          const st = tplStats(C, T);
          c.appendChild(item({ ic: 'inf', t: T.name, d: `전장 너비 ${st.w} · 공격 ${Math.round(st.sa + st.ha)} · 방어 ${Math.round(st.def)} · 인력 ${st.mp.toLocaleString()}`, onClick: () => { for (const D of targets) if (D.tpl !== T.id) changeTemplate(G, D, T.id); mode = null; app.toast(`${targets.length}개 사단 편제 변경 → ${T.name}`); ctx.rerender(); } }));
        }
        body.appendChild(c);
      }
    }
    const list = h('div', { class: 'list' });
    for (const D of divs) {
      const [row, upd] = divRow(app, D, { selectable: own });
      list.appendChild(row); ctx.onUpdate(upd);
      if (!own) { const X = G.countries[D.tag]; row.querySelector('.tiny').textContent = `${X.name} · ${atWar(G, G.player, D.tag) ? '적군' : '외국군'}`; }
    }
    body.appendChild(list);
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
};

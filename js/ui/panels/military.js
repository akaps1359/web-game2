// 군사: 군 · 징집 · 편제 · 공군 · 해군
import { h, onTap } from '../dom.js';
import { icon } from '../icons.js';
import { btn, bar, stat, card, item, empty, setBar, flag } from './common.js';
import { BATTALIONS, BAT_KEYS, SUPPORT, SUP_KEYS, EQUIPMENT, AIR_TYPES, AIR_MISSIONS, SHIPS, SHIP_KEYS } from '../../data/units.js';
import { tplStats, tplAvailable, getTpl, divsOf, divStats, manpowerAvailable, eqLevel, eqCost, createArmy, deleteArmy, armiesOf, assignArmy, setupArmies, editTemplate } from '../../engine/military.js';
import { createWing, wingCoverage, WING_SIZE } from '../../engine/air.js';
import { fleetSize, fleetPower } from '../../engine/naval.js';
import { atWarAny, enemiesOf, friendlyCtrl } from '../../engine/world.js';
import { M } from '../../engine/mods.js';
import { fmtNum, fmtMan, pct, fmtDays } from '../fmt.js';
import { showDialog } from '../modal.js';
import { shipLine } from './state.js';
import { divIcon } from './units.js';

let editTpl = null;
let recruitN = 1;
let openArmy = null;

export const militaryPanel = {
  size: 'tall',
  title: () => '군사',
  tabs: [['armies', '군'], ['recruit', '징집'], ['tpl', '사단 편제'], ['air', '공군'], ['navy', '해군']],
  sig: (app, arg, tab) => {
    const G = app.G, C = G.countries[G.player];
    const A = armiesOf(G, G.player).map((a) => `${a.id}${a.auto ? 1 : 0}${a.order}${a.aggr}${a.goal}${a.enemy}${a.divs.length}${a.gen}${G.hour - (a.chance ?? -1e9) < 72}${Math.round(armyPlan(G, a) * 50)}`).join();
    return `${tab}|${A}|${C.training.length}|${C.templates.length}|${editTpl ? JSON.stringify(editTpl) : ''}|${recruitN}|${openArmy}|${Object.keys(G.wings).length}|${Object.keys(G.fleets).length}|${G.wars.length}|${Object.keys(G.divs).length}`;
  },
  render(app, body, arg, ctx) {
    const G = app.G, C = G.countries[G.player];
    const mpV = h('b'), divV = h('b');
    const upd = () => { mpV.textContent = fmtNum(manpowerAvailable(C)); divV.textContent = divsOf(G, C.tag).length; };
    upd(); ctx.onUpdate(upd);
    body.appendChild(h('div', { class: 'row', style: { gap: '14px', margin: '0 2px 10px' } }, h('span', { class: 'small icon-txt', html: icon('manpower') }, ), h('span', { class: 'small' }, '가용 인력 ', mpV), h('span', { class: 'small' }, '사단 ', divV), h('span', { class: 'small muted' }, `훈련 중 ${C.training.length}`)));
    if (ctx.tab === 'armies') armies(app, body, ctx);
    else if (ctx.tab === 'recruit') recruit(app, body, ctx);
    else if (ctx.tab === 'tpl') templates(app, body, ctx);
    else if (ctx.tab === 'air') air(app, body, ctx);
    else navy(app, body, ctx);
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
  onClose() { editTpl = null; },
};

// ───────── 군 ─────────
// 원작의 작전 계획처럼: 방어는 전선만 지키며 계획 보너스를 쌓고, 공세는 플레이어가 개시한다(성향·목표 선택)
const AGGR_OPTS = [['careful', '신중'], ['balanced', '균형'], ['bold', '과감']];
function armyPlan(G, A) { let s = 0, n = 0; for (const id of A.divs) { const D = G.divs[id]; if (D) { s += D.plan || 0; n++; } } return n ? s / n : 0; }
function pickGoal(app, A) {
  const G = app.G;
  app.sheet.close();
  app.pick(`${A.name}의 공세 목표로 삼을 적 주를 탭하세요`, (st) => {
    if (friendlyCtrl(G, G.player, st)) { app.toast('적이 차지한 주를 골라야 합니다', 'war'); return; }
    A.goal = st;
    app.toast(`${A.name} 공세 목표: ${app.map.name[st]}`);
    app.openPanel('military');
  });
}
function armies(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const list = armiesOf(G, G.player);
  const enemies = enemiesOf(G, C.tag);
  const war = atWarAny(G, C.tag);
  body.appendChild(h('div', { class: 'note', style: { margin: '0 2px 10px' } }, war ? '방어 중인 군은 전선을 지키며 계획 보너스를 쌓습니다. 정면의 적이 지치면 「반격 기회」를 알려 드리니, 그때 공세를 개시하세요. 지도에서 사단을 직접 움직이면 그 군은 수동이 됩니다.' : '평시입니다. 군을 방어나 공세로 두면 전쟁이 시작될 때 알아서 전선에 배치됩니다.'));
  if (war && list.length > 1) {
    const all = (k) => { for (const A of list) { A.auto = true; A.order = k; } ctx.rerender(); };
    body.appendChild(h('div', { class: 'row', style: { gap: '6px', margin: '0 2px 10px' } }, h('span', { class: 'small grow muted' }, '모든 군'), btn('전군 방어', () => all('hold'), 'sm', 'shield'), btn('전군 공세', () => all('attack'), 'sm primary', 'attack')));
  }
  for (const A of list) {
    const divs = A.divs.map((id) => G.divs[id]).filter(Boolean);
    const gen = C.generals.find((g) => g.id === A.gen);
    let str = 0, org = 0, orgMax = 0;
    for (const D of divs) { const st = divStats(G, D); str += D.str; org += D.org; orgMax += st.org; }
    const c = h('div', { class: 'card army' + (A.auto ? ' auto' : '') });
    const head = h('div', { class: 'row' },
      h('div', { class: 'ic-box', html: icon('army') }),
      h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: 'var(--paper)', fontWeight: 650, fontSize: '14px' } }, A.name), h('div', { class: 'tiny muted' }, `${divs.length}개 사단 · ${gen ? `${gen.name} (${gen.skill}★)` : '지휘관 없음'}`)),
      h('div', { style: { width: '70px' } }, bar(divs.length ? str / divs.length : 0, 'thin'), h('div', { style: { height: '3px' } }), bar(orgMax ? org / orgMax : 0, 'green thin')));
    c.appendChild(head);
    const seg = h('div', { class: 'seg', style: { marginTop: '10px' } });
    const opts = [['manual', '수동'], ['hold', '방어'], ['attack', '공세']];
    const curK = !A.auto ? 'manual' : A.order;
    for (const [k, label] of opts) { const b = h('button', { class: curK === k ? 'on' : '' }, label); onTap(b, () => { if (k === 'manual') A.auto = false; else { A.auto = true; A.order = k; } ctx.rerender(); }); seg.appendChild(b); }
    c.appendChild(seg);
    const goal = A.goal >= 0 ? app.map.name[A.goal] : null;
    if (A.auto && A.order === 'attack') {
      const s2 = h('div', { class: 'seg', style: { marginTop: '6px' } });
      for (const [k, label] of AGGR_OPTS) { const b = h('button', { class: (A.aggr || 'balanced') === k ? 'on' : '' }, label); onTap(b, () => { A.aggr = k; ctx.rerender(); }); s2.appendChild(b); }
      c.appendChild(s2);
    }
    c.appendChild(h('div', { class: 'tiny muted', style: { margin: '6px 2px 0' } }, !A.auto ? '지도에서 사단을 직접 움직여 지휘합니다.'
      : A.order === 'attack' ? `${goal ? `${goal} 쪽으로 밀고 나갑니다. 점령하면 방어로 돌아갑니다.` : '전선 전체에서 유리한 곳부터 공격합니다.'} ${{ careful: '전력이 1.6배 넘게 앞설 때만', balanced: '전력이 1.3배 넘게 앞서면', bold: '조금만 앞서도' }[A.aggr || 'balanced']} 공격합니다.`
      : '전선을 지키며 계획 보너스를 쌓습니다. 먼저 공격하지 않습니다.'));
    if (A.auto) {
      // 계획 보너스: 적과 맞닿아 대기하는 동안 쌓이고, 공세 때 공격력에 더해진다
      const plan = armyPlan(G, A), maxPlan = 0.3 + M(C, 'land.planning');
      c.appendChild(h('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } }, h('span', { class: 'tiny muted' }, '계획 보너스'), h('div', { class: 'grow' }, bar(maxPlan > 0 ? plan / maxPlan : 0, 'thin')), h('span', { class: 'tiny', style: { minWidth: '36px', textAlign: 'right', color: plan < 0 ? 'var(--red)' : '' } }, `${plan >= 0 ? '+' : ''}${Math.round(plan * 100)}%`)));
      c.appendChild(h('div', { class: 'row', style: { gap: '6px', marginTop: '6px', alignItems: 'center' } },
        h('span', { class: 'tiny muted' }, '공세 목표'), h('span', { class: 'small grow', style: { color: goal ? 'var(--paper)' : 'var(--muted)' } }, goal || '없음 · 전선 전체'),
        btn(goal ? '변경' : '지정', () => pickGoal(app, A), 'xs', 'target'), goal ? btn('해제', () => { A.goal = -1; ctx.rerender(); }, 'xs') : null));
      if (A.order !== 'attack' && G.hour - (A.chance ?? -1e9) < 72) {
        c.appendChild(h('div', { class: 'chance' }, h('span', { class: 'grow' }, h('b', null, '반격 기회'), ' · 정면의 적이 지쳤습니다'), btn('공세 개시', () => { A.order = 'attack'; ctx.rerender(); }, 'xs primary', 'attack')));
      }
    }
    if (A.auto && enemies.length > 1) {
      const es = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '5px', marginTop: '8px' } }, h('span', { class: 'tiny muted' }, '상대:'));
      const mk = (tag, label) => { const b = h('button', { class: 'btn xs' + ((A.enemy || null) === tag ? ' primary' : '') }, label); onTap(b, () => { A.enemy = tag; ctx.rerender(); }); es.appendChild(b); };
      mk(null, '모든 적');
      for (const e of enemies) if (G.countries[e].alive && !G.countries[e].capitulated) mk(e, G.countries[e].name);
      c.appendChild(es);
    }
    const acts = h('div', { class: 'row', style: { gap: '6px', marginTop: '10px', flexWrap: 'wrap' } },
      btn('지도에서 선택', () => { app.sel.divs.clear(); for (const D of divs) app.sel.divs.add(D.id); app.sel.mode = 'move'; app.sheet.close(); app.updateFloat(); if (divs[0]) app.r.focusState(divs[0].loc, Math.max(app.r.cam.s, 0.18)); app.dirty = true; }, 'sm', 'locate'),
      btn(openArmy === A.id ? '접기' : '사단 목록', () => { openArmy = openArmy === A.id ? null : A.id; ctx.rerender(); }, 'sm', 'military'),
      btn('지휘관', () => {
        const free = C.generals.filter((g) => !list.some((B) => B !== A && B.gen === g.id));
        showDialog(app, { title: `${A.name} 지휘관`, body: '지휘관 능력(★)마다 공격·방어 +2.5%', buttons: free.map((g) => ({ text: `${g.name} ${'★'.repeat(g.skill)}${g.type === 'arm' ? ' · 기갑' : g.type === 'def' ? ' · 방어' : ''}`, primary: g.id === A.gen, fn: () => { A.gen = g.id; ctx.rerender(); } })).concat([{ text: '취소' }]) });
      }, 'sm', 'star'),
      btn('해체', () => showDialog(app, { title: `${A.name} 해체`, body: '사단은 그대로 남고 군 편성만 해제됩니다.', buttons: [{ text: '해체', danger: true, fn: () => { deleteArmy(G, A.id); ctx.rerender(); } }, { text: '취소' }] }), 'sm danger', 'trash'));
    c.appendChild(acts);
    if (openArmy === A.id) {
      const l = h('div', { class: 'list', style: { marginTop: '10px' } });
      for (const D of divs) {
        const st = divStats(G, D);
        const row = item({ ic: divIcon(G, D), t: D.name, d: `${app.map.name[D.loc]} · 전력 ${pct(D.str)} · 조직력 ${pct(st.org ? D.org / st.org : 0)}`, onClick: () => { app.sel.divs.clear(); app.sel.divs.add(D.id); app.sel.mode = 'move'; app.r.focusState(D.loc, Math.max(app.r.cam.s, 0.2)); app.openPanel('units', [D.id]); app.updateFloat(); app.dirty = true; } });
        l.appendChild(row);
      }
      c.appendChild(l);
    }
    body.appendChild(c);
  }
  const loose = divsOf(G, C.tag).filter((D) => !D.army || !G.armies[D.army]);
  const row = h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
    btn('새 군 창설', () => { createArmy(G, C.tag); ctx.rerender(); }, 'primary', 'plus'));
  if (loose.length) row.appendChild(btn(`미배속 ${loose.length}개 사단 편성`, () => { const A = createArmy(G, C.tag); for (const D of loose) assignArmy(G, D, A.id); app.toast(`${A.name} 창설`, 'peace'); ctx.rerender(); }, '', 'army'));
  row.appendChild(btn('지역별 재편성', () => showDialog(app, { title: '군 재편성', body: '모든 사단을 지역별로 묶어 새로 군을 편성합니다.', buttons: [{ text: '재편성', primary: true, fn: () => { setupArmies(G, C.tag); ctx.rerender(); } }, { text: '취소' }] }), '', 'split'));
  body.appendChild(row);
}

// ───────── 징집 ─────────
function recruit(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const c = card(`${icon('plus')} 사단 훈련 <small>수도에서 훈련 후 배치</small>`);
  c.appendChild(h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'small grow' }, '한 번에 훈련할 수'), stepperEl(recruitN, (v) => { recruitN = v; ctx.rerender(); }, 1, 1, 24)));
  for (const T of C.templates) {
    if (!tplAvailable(C, T)) continue;
    const st = tplStats(C, T);
    let cover = 1; for (const e in st.eq) cover = Math.min(cover, (C.stock[e] || 0) / (st.eq[e] * recruitN));
    c.appendChild(item({ ic: tplIcon(T), t: T.name, d: `너비 ${st.w} · 공격 ${Math.round(st.sa + st.ha)} · 방어 ${Math.round(st.def)} · 인력 ${fmtNum(st.mp)} · ${st.train}일 · 장비 ${pct(Math.min(1, cover))}`,
      right: btn('훈련', () => {
        for (let i = 0; i < recruitN; i++) C.training.push({ id: G.nextId++, tpl: T.id, prog: 0, loc: C.capital });
        app.toast(`${T.name} ${recruitN}개 훈련 시작`); ctx.rerender();
      }, 'sm primary') }));
  }
  body.appendChild(c);
  const auto = h('div', { class: 'chk' + (C.autoRecruit ? ' on' : ''), html: C.autoRecruit ? icon('check') : '' });
  body.appendChild(item({ t: '자동 징집', d: '인력과 장비가 허락하는 만큼 AI가 사단을 훈련합니다.', right: auto, onClick: () => { C.autoRecruit = !C.autoRecruit; ctx.rerender(); } }));
  const q = card(`${icon('clock')} 훈련 중 <small>${C.training.length}개</small>`);
  if (!C.training.length) q.appendChild(h('div', { class: 'note' }, '훈련 중인 사단이 없습니다.'));
  C.training.forEach((T) => {
    const tpl = getTpl(C, T.tpl); if (!tpl) return;
    const st = tplStats(C, tpl);
    const pb = bar(T.prog / st.train, 'green thin');
    const tx = h('span', { class: 'tiny muted' });
    const upd = () => { setBar(pb, T.prog / st.train); tx.textContent = !T.started ? '인력 대기' : T.wait ? '장비 부족 (40% 필요)' : `${fmtDays(st.train - T.prog)} 남음`; tx.style.color = !T.started || T.wait ? 'var(--amber)' : ''; };
    upd(); ctx.onUpdate(upd);
    const del = h('button', { class: 'ibtn sm', html: icon('close') });
    onTap(del, () => { if (T.started) C.mp.training = Math.max(0, C.mp.training - (T.mp || 0)); C.training = C.training.filter((x) => x !== T); ctx.rerender(); });
    const force = T.wait ? btn('즉시 배치', () => { T.force = true; app.toast('장비가 부족한 채로 배치합니다'); }, 'xs') : null;
    q.appendChild(h('div', { class: 'qrow' }, h('div', { class: 'ic-box sm', html: icon(tplIcon(tpl)) }), h('div', { class: 'grow' }, h('div', { class: 'row' }, h('span', { class: 'small grow ellip', style: { color: 'var(--paper)' } }, tpl.name), tx), pb), force, del));
  });
  body.appendChild(q);
}

function stepperEl(value, onChange, step, min, max) {
  const minus = h('button', null, '−'), plus = h('button', null, '+');
  onTap(minus, () => onChange(Math.max(min, value - step)));
  onTap(plus, () => onChange(Math.min(max, value + step)));
  return h('div', { class: 'stepper' }, minus, h('span', null, String(value)), plus);
}

function tplIcon(T) {
  if (T.bats.lt || T.bats.mt || T.bats.ht) return 'arm';
  if (T.bats.mech) return 'mech';
  if (T.bats.mot) return 'mot';
  if (T.bats.mtn) return 'mtn';
  if (T.bats.mar) return 'mar';
  if (T.bats.para) return 'para';
  if (T.bats.cav) return 'cav';
  return 'inf';
}

// ───────── 편제 ─────────
function batAvailable(C, b) { const B = BATTALIONS[b]; if (B.need && !C.unlock[B.need]) return false; for (const e in B.eq) if (eqLevel(C, e) < 1) return false; return true; }
function supAvailable(C, s) { const S = SUPPORT[s]; if (S.need && !C.unlock[S.need]) return false; for (const e in S.eq) if (eqLevel(C, e) < 1) return false; return true; }

function templates(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  if (editTpl) return designer(app, body, ctx);
  const used = {};
  for (const D of divsOf(G, C.tag)) used[D.tpl] = (used[D.tpl] || 0) + 1;
  for (const T of C.templates) {
    const st = tplStats(C, T);
    const ok = tplAvailable(C, T);
    const comp = Object.entries(T.bats).filter(([, n]) => n).map(([b, n]) => `${BATTALIONS[b].short} ${n}`).join(' · ') + (T.sup.length ? ' + ' + T.sup.map((s) => SUPPORT[s].short).join('·') : '');
    body.appendChild(h('div', { class: 'card', style: { padding: '10px' } },
      h('div', { class: 'row' }, h('div', { class: 'ic-box', html: icon(tplIcon(T)) }), h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: 'var(--paper)', fontWeight: 650 } }, T.name, ok ? '' : h('span', { class: 'tiny', style: { color: 'var(--red-hi)' } }, ' (기술 부족)')), h('div', { class: 'tiny muted' }, comp)),
        btn('편집', () => { editTpl = { id: T.id, name: T.name, bats: { ...T.bats }, sup: [...T.sup] }; ctx.rerender(); }, 'xs')),
      h('div', { class: 'tstats' }, ...tstats(st)),
      h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, `사용 중 ${used[T.id] || 0}개 사단`)));
  }
  body.appendChild(btn('새 편제 설계', () => { editTpl = { id: null, name: '새 사단', bats: { inf: 7 }, sup: [] }; ctx.rerender(); }, 'primary wide', 'plus'));
}

function tstats(st) {
  const s = (k, v) => h('span', null, h('i', null, k), v);
  return [s('너비', st.w), s('공격', Math.round(st.sa)), s('대물', Math.round(st.ha)), s('방어', Math.round(st.def)), s('돌파', Math.round(st.brk)), s('조직', Math.round(st.org)), s('장갑', Math.round(st.arm)), s('관통', Math.round(st.prc)), s('속도', st.spd.toFixed(1)), s('IC', Math.round(st.ic)), s('인력', fmtNum(st.mp)), s('훈련', st.train + '일')];
}

function designer(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const T = editTpl;
  const nBat = Object.values(T.bats).reduce((a, b) => a + b, 0);
  const preview = { id: '__preview', bats: T.bats, sup: T.sup };
  if (C._tpl) delete C._tpl.__preview;
  const st = nBat ? tplStats(C, preview) : null;
  if (C._tpl) delete C._tpl.__preview;
  const name = h('input', { class: 'tinput', value: T.name, maxlength: 20 });
  name.addEventListener('input', () => { T.name = name.value; });
  body.appendChild(h('div', { class: 'row', style: { marginBottom: '10px' } }, name));
  if (st) body.appendChild(h('div', { class: 'card brass', style: { padding: '10px' } }, h('div', { class: 'tstats' }, ...tstats(st)), st.w > 40 ? h('div', { class: 'tiny', style: { color: 'var(--amber)', marginTop: '6px' } }, '전장 너비가 넓어 좁은 지형에서 패널티를 받을 수 있습니다.') : null));
  const bc = card(`${icon('military')} 전투 대대 <small>${nBat}/25</small>`);
  for (const b of BAT_KEYS) {
    if (!batAvailable(C, b) && !T.bats[b]) continue;
    const B = BATTALIONS[b];
    const v = T.bats[b] || 0;
    bc.appendChild(h('div', { class: 'row', style: { margin: '5px 0' } },
      h('div', { class: 'ic-box sm', html: icon(B.icon) }),
      h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: 'var(--paper)' } }, B.name), h('div', { class: 'tiny muted' }, `너비 ${B.w} · 조직 ${B.org} · ${Object.entries(B.eq).map(([e, n]) => `${EQUIPMENT[e].name} ${n}`).join(', ')}`)),
      stepperEl(v, (nv) => { if (nv > v && nBat >= 25) return; if (nv) T.bats[b] = nv; else delete T.bats[b]; ctx.rerender(); }, 1, 0, 25)));
  }
  body.appendChild(bc);
  const sc = card(`${icon('eng')} 지원 중대 <small>${T.sup.length}/5</small>`);
  const grid = h('div', { class: 'tpl-grid' });
  for (const s of SUP_KEYS) {
    if (!supAvailable(C, s) && !T.sup.includes(s)) continue;
    const S = SUPPORT[s];
    const on = T.sup.includes(s);
    const cell = h('div', { class: 'tpl-cell' + (on ? ' on' : ''), html: icon(S.icon) + S.short });
    onTap(cell, () => { if (on) T.sup = T.sup.filter((x) => x !== s); else if (T.sup.length < 5) T.sup.push(s); ctx.rerender(); });
    grid.appendChild(cell);
  }
  sc.appendChild(grid);
  body.appendChild(sc);
  const used = divsOf(G, C.tag).filter((D) => D.tpl === T.id).length;
  body.appendChild(h('div', { class: 'row', style: { gap: '8px' } },
    btn('취소', () => { editTpl = null; ctx.rerender(); }, 'grow'),
    T.id && !used && C.templates.length > 1 ? btn('삭제', () => { C.templates = C.templates.filter((x) => x.id !== T.id); C.training = C.training.filter((x) => x.tpl !== T.id); editTpl = null; ctx.rerender(); }, 'danger', 'trash') : null,
    btn(T.id ? '저장' : '만들기', () => {
      if (!nBat) { app.toast('대대가 하나 이상 필요합니다', 'war'); return; }
      if (T.id) editTemplate(app.G, C, T.id, T.bats, T.sup, T.name || getTpl(C, T.id).name);
      else C.templates.push({ id: G.nextId++, key: 'custom', name: T.name || '새 사단', bats: { ...T.bats }, sup: [...T.sup] });
      app.toast(used ? `편제 저장 — ${used}개 사단이 새 장비를 보충합니다` : '편제 저장', 'peace');
      editTpl = null; ctx.rerender();
    }, 'primary grow', 'check')));
  if (used) body.appendChild(h('div', { class: 'tiny muted', style: { marginTop: '8px' } }, `이 편제를 쓰는 사단 ${used}개는 저장 후 새 편제 기준으로 장비를 보충합니다.`));
}

// ───────── 공군 ─────────
const AIR_IC = { fighter: 'fighter', cas: 'cas', tac: 'bomber' };
function air(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const wings = Object.values(G.wings).filter((W) => W.tag === C.tag);
  const auto = h('div', { class: 'chk' + (C.autoAir ? ' on' : ''), html: C.autoAir ? icon('check') : '' });
  body.appendChild(item({ t: '자동 공군', d: '전쟁 시 비행단을 가장 치열한 전선에 자동 배치합니다.', right: auto, onClick: () => { C.autoAir = !C.autoAir; ctx.rerender(); } }));
  body.appendChild(h('div', { style: { height: '8px' } }));
  // 새 비행단
  const nc = card(`${icon('plus')} 비행단 편성 <small>비축 기체 사용</small>`);
  for (const type of ['fighter', 'cas', 'tac']) {
    const n = Math.floor(C.stock[type] || 0);
    if (!(C.eq[type] >= 1)) continue;
    nc.appendChild(item({ ic: AIR_IC[type], t: AIR_TYPES[type].name, d: `비축 ${n}대 · 작전 반경 ${AIR_TYPES[type].range}km`, right: btn('편성', () => { const k = Math.min(WING_SIZE, n); C.stock[type] -= k; createWing(G, C.tag, type, k, C.capital, 'none'); app.toast(`${AIR_TYPES[type].name} 비행단 편성 (${k}대)`, 'peace'); ctx.rerender(); }, 'sm' + (n < 10 ? ' disabled' : '')) }));
  }
  body.appendChild(nc);
  if (!wings.length) body.appendChild(empty('비행단이 없습니다.'));
  for (const W of wings) {
    const cov = W.mission !== 'none' ? wingCoverage(G, W).length : 0;
    const c = h('div', { class: 'card', style: { padding: '10px' } });
    const nTxt = h('span', { class: 'tiny muted' });
    const upd = () => { nTxt.textContent = `${Math.round(W.n)}/${WING_SIZE}대`; };
    upd(); ctx.onUpdate(upd);
    c.appendChild(h('div', { class: 'row' }, h('div', { class: 'ic-box', html: icon(AIR_IC[W.type]) }), h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: 'var(--paper)', fontWeight: 600 } }, W.name), h('div', { class: 'tiny muted' }, `기지 ${app.map.name[W.base]} · 목표 ${app.map.name[W.target]}`)), nTxt));
    const seg = h('div', { class: 'seg', style: { marginTop: '8px' } });
    for (const m of AIR_TYPES[W.type].mission.concat(W.type === 'tac' ? [] : [])) {
      const b = h('button', { class: W.mission === m ? 'on' : '' }, AIR_MISSIONS[m]);
      onTap(b, () => { W.mission = m; ctx.rerender(); });
      seg.appendChild(b);
    }
    c.appendChild(seg);
    if (W.mission !== 'none' && !cov) c.appendChild(h('div', { class: 'tiny', style: { color: 'var(--red-hi)', marginTop: '6px' } }, '목표가 작전 반경 밖입니다. 기지를 옮기거나 목표를 바꾸세요.'));
    c.appendChild(h('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } },
      btn('목표 지정', () => { app.sheet.close(); app.pick('비행단 목표 주를 탭하세요', (st) => { W.target = st; if (W.mission === 'none') W.mission = AIR_TYPES[W.type].mission[0]; if (!wingCoverage(G, W).length) { const b = nearestAirBase(G, C, st); if (b >= 0) W.base = b; } app.toast(`${W.name} → ${app.map.name[st]}`); app.openPanel('military'); }); }, 'sm', 'target'),
      btn('기지 이동', () => { app.sheet.close(); app.pick('공군 기지가 있는 아군 주를 탭하세요', (st) => { if (G.st[st].ctrl !== C.tag || !(G.st[st].air > 0)) { app.toast('공군 기지가 있는 자국 주가 아닙니다', 'war'); return; } W.base = st; app.toast(`${W.name} 기지 이동 → ${app.map.name[st]}`); app.openPanel('military'); }); }, 'sm', 'air'),
      btn('해체', () => { C.stock[W.type] = (C.stock[W.type] || 0) + W.n; delete G.wings[W.id]; ctx.rerender(); }, 'sm danger', 'trash')));
    body.appendChild(c);
  }
}
function nearestAirBase(G, C, st) {
  let best = -1, bd = Infinity;
  for (const i of G.ctrlBy?.[C.tag] || []) { if ((G.st[i].air || 0) < 1) continue; const d = G.map.dist(i, st); if (d < bd) { bd = d; best = i; } }
  return best;
}

// ───────── 해군 ─────────
function navy(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const fleets = Object.values(G.fleets).filter((F) => F.tag === C.tag);
  const auto = h('div', { class: 'chk' + (C.autoNavy ? ' on' : ''), html: C.autoNavy ? icon('check') : '' });
  body.appendChild(item({ t: '자동 해군', d: '함대의 임무와 작전 해역을 AI가 정합니다.', right: auto, onClick: () => { C.autoNavy = !C.autoNavy; ctx.rerender(); } }));
  body.appendChild(h('div', { style: { height: '8px' } }));
  if (!fleets.length) body.appendChild(empty('함대가 없습니다.'));
  for (const F of fleets) {
    const p = fleetPower(G, F);
    const right = h('div', { class: 'row', style: { gap: '4px' } });
    if (F.reserve && fleets.length > 1) right.appendChild(btn('합류', () => {
      showDialog(app, { title: '예비 함대 합류', body: '어느 함대에 합류할까요?', buttons: fleets.filter((X) => X !== F).map((X) => ({ text: X.name, fn: () => { for (const k of SHIP_KEYS) X.ships[k] = (X.ships[k] || 0) + (F.ships[k] || 0); delete G.fleets[F.id]; ctx.rerender(); } })).concat([{ text: '취소' }]) });
    }, 'xs'));
    if (F.reserve) right.appendChild(btn('정식 편성', () => { F.reserve = false; C.fleetNum = (C.fleetNum || 0) + 1; F.name = `제${C.fleetNum} 함대`; F.mission = 'patrol'; ctx.rerender(); }, 'xs'));
    body.appendChild(item({ ic: 'ship', t: `${F.name}${F.reserve ? ' (예비)' : ''}`, d: `${shipLine(F)}<br>${app.map.seas[F.loc].name} · 공격력 ${Math.round(p.atk)}`, right, onClick: () => app.openPanel('fleet', [F]) }));
  }
}

// 산업: 생산 · 건설 · 자원/무역 · 조선
import { h, onTap } from '../dom.js';
import { icon } from '../icons.js';
import { btn, bar, stat, card, item, empty, setBar } from './common.js';
import { EQUIPMENT, LAND_EQ, AIR_EQ, RES_KEYS, RES_NAMES, SHIPS, SHIP_KEYS } from '../../data/units.js';
import { BUILDINGS, canBuild, buildCost, stateSlots, stateUsedSlots, queueBuild, setLine, shipUnlocked, tradeReach } from '../../engine/economy.js';
import { eqLevel, eqCost, divStats, tplStats, getTpl } from '../../engine/military.js';
import { M } from '../../engine/mods.js';
import { fmtNum, pct, fmtDays } from '../fmt.js';

let buildType = 'civ';
let addOpen = false;

const RES_IC = { oil: 'oil', steel: 'steel', alu: 'alu', rub: 'rub', tung: 'tung', chr: 'chr' };
const EQ_IC = { inf_eq: 'inf', sup_eq: 'eng', art: 'art', at: 'at', aa: 'aa', mot: 'supply', mech: 'mech', ltank: 'tank', mtank: 'tank', htank: 'tank', fighter: 'fighter', cas: 'cas', tac: 'bomber' };

function stepper(value, onChange, step = 1, min = 0, max = 999) {
  const v = h('span', null, String(value));
  const minus = h('button', null, '−'), plus = h('button', null, '+');
  onTap(minus, () => onChange(Math.max(min, value - step)));
  onTap(plus, () => onChange(Math.min(max, value + step)));
  return h('div', { class: 'stepper' }, minus, v, plus);
}

// 장비 부족량: 배치된 사단 결손 + 훈련 중 사단
export function eqDeficit(G, C) {
  const need = {};
  for (const id in G.divs) {
    const D = G.divs[id]; if (D.tag !== C.tag) continue;
    const st = divStats(G, D);
    if (D.str < 1) for (const e in st.eq) need[e] = (need[e] || 0) + st.eq[e] * (1 - D.str);
  }
  for (const T of C.training) { const tpl = getTpl(C, T.tpl); if (!tpl) continue; const st = tplStats(C, tpl); for (const e in st.eq) need[e] = (need[e] || 0) + st.eq[e]; }
  for (const id in G.wings) { const W = G.wings[id]; if (W.tag === C.tag && W.n < 100) need[W.type] = (need[W.type] || 0) + (100 - W.n); }
  return need;
}

export const industryPanel = {
  size: 'tall',
  title: () => '산업',
  tabs: [['prod', '생산'], ['cons', '건설'], ['res', '자원·무역'], ['ships', '조선']],
  sig: (app, arg, tab) => { const C = app.G.countries[app.G.player]; return `${tab}|${C.lines.map((l) => l.eq + l.fac).join()}|${C.cons.length}|${C.cons[0]?.id}|${C.shipLines.map((l) => l.ship + l.docks + ':' + l.count).join()}|${buildType}|${addOpen}|${C.autoTrade}|${Math.round(C.eco.civ)}|${Math.round(C.eco.mil)}|${JSON.stringify(C.tradeOrders || {})}`; },
  render(app, body, arg, ctx) {
    if (ctx.tab === 'prod') production(app, body, ctx);
    else if (ctx.tab === 'cons') construction(app, body, ctx);
    else if (ctx.tab === 'res') resources(app, body, ctx);
    else shipyard(app, body, ctx);
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
  onClose() { addOpen = false; },
};

function production(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const mil = Math.floor(C.eco.mil || 0);
  const used = C.lines.reduce((s, l) => s + l.fac, 0);
  const free = mil - used;
  const outV = h('b');
  const upd = () => { outV.textContent = (C.eco.milOut || 0).toFixed(1); };
  upd(); ctx.onUpdate(upd);
  body.appendChild(h('div', { class: 'grid3', style: { marginBottom: '10px' } },
    stat('군수 공장', mil, 'mil'), stat('미배정', free, 'factory', free < 0 ? '초과' : ''), h('div', { class: 'stat' }, h('div', { class: 'k', html: icon('gear') + '산출(IC/일)' }), h('div', { class: 'v' }, outV))));
  if (free < 0) body.appendChild(h('div', { class: 'note', style: { color: 'var(--amber)', margin: '-4px 2px 8px' } }, '배정한 공장이 실제 공장보다 많아 모든 라인이 비례 감소합니다.'));
  const deficit = eqDeficit(G, C);
  const cap = 50 + M(C, 'prodEffCap') * 100;
  for (const L of C.lines) {
    const E = EQUIPMENT[L.eq];
    const lv = eqLevel(C, L.eq);
    const unit = eqCost(C, L.eq);
    const effB = bar((L.eff || 10) / 100, 'green thin');
    const outTxt = h('span', { class: 'tiny muted' });
    const stockTxt = h('span', { class: 'tiny' });
    const upd2 = () => {
      setBar(effB, (L.eff || 10) / 100);
      const perDay = L.fac * (C.eco.milScale ?? 1) * 4.5 * ((L.eff || 10) / 100) * (1 + M(C, 'factoryOutput')) / unit;
      outTxt.textContent = `효율 ${Math.round(L.eff || 10)}%/${Math.round(cap)}% · 월 ${fmtNum(perDay * 30)}개`;
      const st = Math.floor(C.stock[L.eq] || 0), need = Math.ceil(deficit[L.eq] || 0);
      stockTxt.textContent = `비축 ${fmtNum(st)}${need ? ` · 부족 ${fmtNum(need)}` : ''}`;
      stockTxt.style.color = need > st ? 'var(--red-hi)' : 'var(--muted)';
    };
    upd2(); ctx.onUpdate(upd2);
    const resWarn = L.rf != null && L.rf < 0.999 ? h('div', { class: 'tiny', style: { color: 'var(--red-hi)' } }, `자원 부족: 생산 ${Math.round((0.3 + 0.7 * L.rf) * 100)}%`) : null;
    body.appendChild(h('div', { class: 'card', style: { padding: '10px' } },
      h('div', { class: 'row' },
        h('div', { class: 'ic-box', html: icon(EQ_IC[L.eq] || 'factory') }),
        h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: 'var(--paper)', fontWeight: 600 } }, E.lv?.[lv] || E.name), h('div', null, stockTxt)),
        stepper(L.fac, (v) => { L.keep = v === 0 ? false : L.keep; setLine(G, C, L.eq, v); ctx.rerender(); }, 1, 0, 150)),
      h('div', { style: { marginTop: '8px' } }, effB, h('div', { class: 'row', style: { marginTop: '3px' } }, outTxt)),
      resWarn,
      h('div', { class: 'tiny muted', style: { marginTop: '3px' } }, `단가 ${unit} IC · 자원 ${Object.entries(E.res).map(([r, n]) => `${RES_NAMES[r]} ${n}`).join(', ')} (공장당)`)));
  }
  if (!C.lines.length) body.appendChild(empty('생산 라인이 없습니다.'));
  // 라인 추가
  const add = btn(addOpen ? '닫기' : '생산 라인 추가', () => { addOpen = !addOpen; ctx.rerender(); }, 'wide' + (addOpen ? '' : ' primary'), addOpen ? 'close' : 'plus');
  body.appendChild(add);
  if (addOpen) {
    const c = card(`${icon('factory')} 생산할 장비`);
    for (const e of [...LAND_EQ, ...AIR_EQ]) {
      if (C.lines.some((l) => l.eq === e)) continue;
      const lv = eqLevel(C, e);
      if (lv < 1 || e === 'sup_eq' && !C.unlock.support) continue;
      const E = EQUIPMENT[e];
      c.appendChild(item({ ic: EQ_IC[e] || 'factory', t: E.lv?.[lv] || E.name, d: `단가 ${eqCost(C, e)} IC · 비축 ${fmtNum(C.stock[e] || 0)}${deficit[e] ? ` · 부족 ${fmtNum(deficit[e])}` : ''}`, onClick: () => { setLine(G, C, e, Math.max(1, Math.min(5, free))); const L = C.lines.find((l) => l.eq === e); if (L) L.keep = true; addOpen = false; ctx.rerender(); } }));
    }
    body.appendChild(c);
  }
  // 비축 현황
  const sc = card(`${icon('supply')} 장비 비축`);
  const g = h('div', { class: 'kv' });
  for (const e of [...LAND_EQ, ...AIR_EQ]) {
    const s = Math.floor(C.stock[e] || 0), need = Math.ceil(deficit[e] || 0);
    if (!s && !need) continue;
    g.append(h('span', null, EQUIPMENT[e].name), h('span', { style: { color: need > s ? 'var(--red-hi)' : '' } }, `${fmtNum(s)}${need ? ` / 부족 ${fmtNum(need)}` : ''}`));
  }
  sc.appendChild(g);
  body.appendChild(sc);
}

// 건설 후보 주 정렬
function candidates(G, C, type) {
  const map = G.map;
  const out = [];
  for (const i of G.ctrlBy?.[C.tag] || []) {
    if (canBuild(G, C, type, i)) continue;
    const S = G.st[i];
    let score;
    if (BUILDINGS[type].slot) score = (stateSlots(G, C, i) - stateUsedSlots(S)) * 10 + (S.infra || 0) * 3 + (S.cores.includes(C.tag) ? 20 : 0);
    else if (type === 'infra') score = (stateUsedSlots(S) + (S.res ? 4 : 0)) * 5 - (S.infra || 0) * 4 + S.vp * 0.5;
    else if (type === 'fort') score = map.nb[i].filter((v) => G.st[v].owner !== C.tag).length * 10 + S.vp - (S.fort || 0) * 3;
    else if (type === 'port') score = (S.port ? 10 : 0) + S.vp - (S.port || 0) * 2;
    else score = S.vp * 2 + stateUsedSlots(S) * 3 - (S[type] || 0) * 4;
    out.push([i, score]);
  }
  return out.sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}

function construction(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const civ = Math.floor(C.eco.civ || 0), cg = C.eco.cg || 0;
  const freeV = h('b');
  const updF = () => { freeV.textContent = Math.floor(C.eco.civFree || 0); };
  updF(); ctx.onUpdate(updF);
  body.appendChild(h('div', { class: 'grid3', style: { marginBottom: '10px' } },
    stat('민간 공장', civ, 'civ'), stat('소비재', cg, 'people', pct(C.eco.cgFrac || 0)), h('div', { class: 'stat' }, h('div', { class: 'k', html: icon('industry') + '건설 가용' }), h('div', { class: 'v' }, freeV))));
  if ((C.eco.importCiv || 0) > 0.5 || (C.eco.tradeCiv || 0) > 0.5) body.appendChild(h('div', { class: 'note', style: { margin: '-4px 2px 8px' } }, `무역: 수입에 공장 ${C.eco.importCiv.toFixed(1)}개 사용, 수출로 ${C.eco.tradeCiv.toFixed(1)}개 획득`));
  // 새 건설
  const seg = h('div', { class: 'seg', style: { marginBottom: '8px', flexWrap: 'wrap' } });
  for (const t of ['civ', 'mil', 'dock', 'infra', 'ref', 'air', 'aa', 'fort', 'port']) {
    if (t === 'ref' && !C.unlock.refinery) continue;
    const b = h('button', { class: buildType === t ? 'on' : '', html: icon(BUILDINGS[t].icon) }); b.style.minWidth = '34px';
    onTap(b, () => { buildType = t; ctx.rerender(); });
    seg.appendChild(b);
  }
  const B = BUILDINGS[buildType];
  const c = card(`${icon(B.icon)} ${B.name} 건설 <small>비용 ${fmtNum(B.cost)}</small>`, seg);
  const cands = candidates(G, C, buildType).slice(0, 10);
  if (!cands.length) c.appendChild(h('div', { class: 'note' }, '건설할 수 있는 주가 없습니다.'));
  for (const i of cands) {
    const S = G.st[i];
    const info = B.slot ? `슬롯 ${stateUsedSlots(S)}/${stateSlots(G, C, i)} · 기반 시설 ${S.infra}` : `현재 ${S[buildType] || 0}/${B.max}`;
    c.appendChild(item({ ic: B.icon, t: app.map.name[i], d: info, right: btn('건설', () => { const e = queueBuild(G, C, buildType, i); app.toast(e || `${B.name} 건설 시작 (${app.map.name[i]})`, e ? 'war' : ''); ctx.rerender(); }, 'sm primary') }));
  }
  c.appendChild(h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, '지도에서 주를 탭해 원하는 곳에 직접 건설할 수도 있습니다.'));
  body.appendChild(c);
  // 대기열
  const q = card(`${icon('clock')} 건설 대기열 <small>${C.cons.length}건</small>`);
  if (!C.cons.length) q.appendChild(h('div', { class: 'note' }, '대기 중인 건설이 없습니다. 민간 공장이 놀고 있습니다!'));
  const conMult = 1 + M(C, 'construction');
  C.cons.forEach((P, k) => {
    const Bp = BUILDINGS[P.type];
    const cost = buildCost(G, C, P.type, P.st);
    const pb = bar(P.acc / cost, P.civ ? 'green thin' : 'thin');
    const tx = h('span', { class: 'tiny muted' });
    const upd = () => {
      setBar(pb, P.acc / cost);
      const rate = (P.civ || 0) * 5 * conMult * (1 + 0.1 * Math.min(5, G.st[P.st].infra || 1));
      tx.textContent = P.civ ? `공장 ${P.civ.toFixed(0)}개 · ${fmtDays((cost - P.acc) / Math.max(0.01, rate))}` : '대기';
    };
    upd(); ctx.onUpdate(upd);
    const up = h('button', { class: 'ibtn sm', html: icon('back') }); up.style.transform = 'rotate(90deg)';
    onTap(up, () => { if (k > 0) { C.cons.splice(k, 1); C.cons.splice(k - 1, 0, P); ctx.rerender(); } });
    const del = h('button', { class: 'ibtn sm', html: icon('close') });
    onTap(del, () => { C.cons.splice(C.cons.indexOf(P), 1); ctx.rerender(); });
    q.appendChild(h('div', { class: 'qrow' },
      h('div', { class: 'ic-box sm', html: icon(Bp.icon) }),
      h('div', { class: 'grow' }, h('div', { class: 'row' }, h('span', { class: 'small grow ellip', style: { color: 'var(--paper)' } }, `${Bp.name} · ${app.map.name[P.st]}${P.repeat > 1 ? ` ×${P.repeat}` : ''}`), tx), pb),
      k > 0 ? up : null, del));
  });
  body.appendChild(q);
}

function resources(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const E = C.eco;
  const c = card(`${icon('oil')} 자원 <small>생산 / 필요 / 수입 / 수출</small>`);
  const tbl = h('div', { class: 'rtable' });
  tbl.append(h('span'), h('span', null, '생산'), h('span', null, '필요'), h('span', null, '수입'), h('span', null, '수출'), h('span', null, '잔여'));
  for (const r of RES_KEYS) {
    const prod = E.res?.[r] || 0, need = E.need?.[r] || 0, imp = E.imports?.[r] || 0, sold = E.sold?.[r] || 0;
    const bal = prod + imp - sold - need;
    tbl.append(h('span', { class: 'icon-txt', html: icon(RES_IC[r]) + RES_NAMES[r] }), h('span', null, Math.round(prod)), h('span', null, Math.round(need)), h('span', { class: imp ? 'good' : '' }, Math.round(imp)), h('span', { class: sold ? 'gold' : '' }, Math.round(sold)), h('span', { class: bal < -0.5 ? 'bad' : '' }, Math.round(bal)));
  }
  c.appendChild(tbl);
  body.appendChild(c);
  // 무역
  const reach = tradeReach(G, C.tag);
  const t = card(`${icon('globe')} 무역 <small>민간 공장 1개 = 자원 8</small>`);
  const autoOn = C.autoTrade !== false && !C.tradeOrders;
  const chk = h('div', { class: 'chk' + (autoOn ? ' on' : ''), html: autoOn ? icon('check') : '' });
  t.appendChild(item({ t: '자동 무역', d: '생산 라인에 부족한 자원을 자동으로 수입합니다.', right: chk, onClick: () => { if (autoOn) { C.autoTrade = false; C.tradeOrders = {}; for (const r of RES_KEYS) C.tradeOrders[r] = Math.max(0, Math.ceil((E.imports?.[r] || 0) / 8) * 8); } else { C.autoTrade = true; C.tradeOrders = null; } ctx.rerender(); } }));
  if (!autoOn) {
    for (const r of RES_KEYS) {
      const v = C.tradeOrders?.[r] || 0;
      t.appendChild(h('div', { class: 'row', style: { margin: '6px 0' } }, h('span', { class: 'icon-txt grow small', html: icon(RES_IC[r]) + RES_NAMES[r] }), h('span', { class: 'tiny muted' }, `수입 ${Math.round(E.imports?.[r] || 0)}`), stepper(v, (nv) => { C.tradeOrders[r] = nv; ctx.rerender(); }, 8, 0, 400)));
    }
  }
  t.appendChild(h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, `교역 가능 국가 ${reach.countries.length}개${reach.world ? ' · 세계 시장 접근 가능(공장 1개 = 자원 6)' : ' · 세계 시장 차단됨'}`));
  if (G.raid?.[C.tag]) t.appendChild(h('div', { class: 'tiny', style: { color: 'var(--red-hi)' } }, `적 잠수함의 통상 파괴: 수입 손실 ${pct(G.raid[C.tag])}`));
  body.appendChild(t);
  // 연료
  const fb = bar((C.fuel || 0) / (C.fuelCap || 1), 'thin');
  const fv = h('span', { class: 'small' });
  const upd = () => { setBar(fb, (C.fuel || 0) / (C.fuelCap || 1)); fv.textContent = `${fmtNum(C.fuel || 0)} / ${fmtNum(C.fuelCap || 0)} (+${fmtNum(E.fuelGain || 0)}/일)`; };
  upd(); ctx.onUpdate(upd);
  body.appendChild(card(`${icon('fuel')} 연료`, fv, h('div', { style: { marginTop: '6px' } }, fb), h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, '석유 1당 하루 연료 100, 합성 정유소 1개당 400. 연료가 바닥나면 기갑·항공·함대의 능력이 크게 떨어집니다.')));
}

function shipyard(app, body, ctx) {
  const G = app.G, C = G.countries[G.player];
  const dock = Math.floor(C.eco.dock || 0);
  const used = C.shipLines.reduce((s, l) => s + l.docks, 0);
  body.appendChild(h('div', { class: 'grid3', style: { marginBottom: '10px' } }, stat('조선소', dock, 'dock'), stat('배정', used, 'anchor'), stat('함대', Object.values(G.fleets).filter((F) => F.tag === C.tag).length, 'ship')));
  for (const L of C.shipLines) {
    const Sh = SHIPS[L.ship];
    const pb = bar((L.prog || 0) / Sh.ic, 'blue thin');
    const tx = h('span', { class: 'tiny muted' });
    const upd = () => { setBar(pb, (L.prog || 0) / Sh.ic); const rate = L.docks * (C.eco.dockScale ?? 1) * 2.5 * (1 + M(C, 'dockOutput')); tx.textContent = rate > 0 ? `다음 함선 ${fmtDays((Sh.ic - (L.prog || 0)) / rate)}` : '조선소 미배정'; };
    upd(); ctx.onUpdate(upd);
    const cnt = h('button', { class: 'btn xs' }, L.count == null ? '연속 건조' : `${L.count}척 남음`);
    onTap(cnt, () => { L.count = L.count == null ? 1 : L.count >= 10 ? null : L.count + 1; ctx.rerender(); });
    body.appendChild(h('div', { class: 'card', style: { padding: '10px' } },
      h('div', { class: 'row' }, h('div', { class: 'ic-box', html: icon(L.ship === 'ss' ? 'sub' : 'ship') }), h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: 'var(--paper)', fontWeight: 600 } }, Sh.name), tx), stepper(L.docks, (v) => { L.docks = v; if (!v) C.shipLines = C.shipLines.filter((x) => x !== L); ctx.rerender(); }, 1, 0, 30)),
      h('div', { style: { marginTop: '8px' } }, pb), h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'tiny muted grow' }, `척당 ${fmtNum(Sh.ic)} IC · 공격 ${Sh.atk} · 내구 ${Sh.hp}`), cnt)));
  }
  const c = card(`${icon('plus')} 새 함선 건조`);
  for (const k of SHIP_KEYS) {
    if (!shipUnlocked(C, k)) continue;
    const Sh = SHIPS[k];
    c.appendChild(item({ ic: k === 'ss' ? 'sub' : 'ship', t: Sh.name, d: `${fmtNum(Sh.ic)} IC · 공격 ${Sh.atk} · 대잠 ${Sh.asw} · 속도 ${Sh.spd}노트`, right: btn('추가', () => { C.shipLines.push({ id: G.nextId++, ship: k, docks: Math.max(1, Math.min(5, dock - used)), prog: 0, count: null }); ctx.rerender(); }, 'sm') }));
  }
  body.appendChild(c);
}

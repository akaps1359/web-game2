// 주 정보 · 해역 · 함대 패널
import { h, onTap, clear } from '../dom.js';
import { icon } from '../icons.js';
import { btn, flag, bar, stat, card, item, empty, kv } from './common.js';
import { TERRAIN, RES_NAMES, RES_SCALE, SHIPS, SHIP_KEYS } from '../../data/units.js';
import { BUILDINGS, canBuild, buildCost, stateSlots, stateUsedSlots, queueBuild } from '../../engine/economy.js';
import { atWar, allied } from '../../engine/world.js';
import { divStats, divKind } from '../../engine/military.js';
import { fleetPower, fleetSize, seaPath } from '../../engine/naval.js';
import { fmtNum, pct } from '../fmt.js';

export const statePanel = {
  size: 'half',
  title: (app, st) => {
    const G = app.G, S = G.st[st], C = G.countries[S.owner];
    return h('div', { class: 'row grow', style: { minWidth: 0 } }, flag(C, 'flag-md'), h('div', { class: 'grow', style: { minWidth: 0 } }, h('h2', { style: { fontSize: '19px' } }, app.map.name[st]), h('div', { class: 'sub' }, `${C?.name || S.owner}${S.ctrl !== S.owner ? ` · ${G.countries[S.ctrl]?.name} 점령` : ''}`)));
  },
  sig: (app, st) => { const S = app.G.st[st]; return [S.owner, S.ctrl, S.civ, S.mil, S.dock, S.infra, S.fort, (app.G.divsAt?.[st] || []).length, app.G.countries[app.G.player].cons.length].join(','); },
  render(app, body, st, ctx) {
    const G = app.G, S = G.st[st], map = app.map, P = G.countries[G.player];
    const T = TERRAIN[map.terrain[st]];
    const mine = S.owner === G.player && S.ctrl === G.player;
    // 전투
    const B = G.battles[st];
    if (B) {
      const side = B.atkTag === G.player || allied(G, G.player, B.atkTag) ? '공격' : (B.defTag === G.player || allied(G, G.player, B.defTag)) ? '방어' : null;
      const win = side === '방어' ? 1 - B.win : B.win;
      body.appendChild(card(`${icon('swords')} 전투 진행 중 <small>${B.atkIds.length} 대 ${B.defIds.length} 사단</small>`, h('div', { class: 'row' }, h('span', { class: 'small' }, `${G.countries[B.atkTag]?.name || '?'} → ${G.countries[B.defTag]?.name}`), h('span', { class: 'grow' }), h('b', { class: side ? (win >= 0.5 ? 'good' : 'bad') : '' }, side ? `우세 ${pct(win)}` : pct(B.win))), bar(side ? win : B.win, side && win < 0.5 ? 'red' : 'green'), h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, `전장 너비 ${Math.round(B.width)} · 공격 방향 ${B.dirs.length}`)));
    }
    // 지도 밖 본토(미국 본토): 처음부터 있던 공장·인구·자원은 나라의 지도 밖 자산에 들어 있으니 함께 보여 준다
    const off = map.virtual[st] && G.countries[S.owner]?.offmap?.name === map.name[st] ? G.countries[S.owner].offmap : null;
    if (map.virtual[st]) body.appendChild(h('div', { class: 'note', style: { marginBottom: '10px' } }, `지도 밖에 있는 본토라 서쪽 바다에 작은 지도로 그려 두었습니다. 유럽과는 ${map.coast[st].map((z) => map.seas[z].name).join('·')} 해역으로만 이어지니, 사단을 고른 뒤 「수송」(아군 항구로)이나 「상륙」(적 해안으로)으로 바다를 건너세요.`));
    const civ = Math.round((S.civ || 0) + (off?.civ || 0)), mil = Math.round((S.mil || 0) + (off?.mil || 0)), dock = Math.round((S.dock || 0) + (off?.dock || 0));
    const base = off ? Math.round((off.civ || 0) + (off.mil || 0) + (off.dock || 0)) : 0;
    const grid = h('div', { class: 'grid3' },
      stat('승점', S.vp, 'star'), stat('지형', T?.name || '-', 'mountain'), stat('기반 시설', S.infra, 'infra'),
      stat('인구', fmtNum(off ? off.pop * 1e6 : S.pop * 1000), 'people'), stat('공장', `${civ}/${mil}`, 'industry', dock ? `조선 ${dock}` : ''), stat('슬롯', `${stateUsedSlots(S) + base}/${stateSlots(G, G.countries[S.owner], st) + base}`, 'gear'));
    body.appendChild(grid);
    const extra = [];
    if (S.fort) extra.push(`요새 ${S.fort}`); if (S.aa) extra.push(`대공 ${S.aa}`); if (S.air) extra.push(`공군기지 ${S.air}`); if (S.port) extra.push(`해군기지 ${S.port}`); if (S.ref) extra.push(`정유소 ${S.ref}`); if (S.demil) extra.push('비무장 지대');
    if (S.res) for (const r in S.res) extra.push(`${RES_NAMES[r]} ${Math.round(S.res[r] * RES_SCALE)}`);
    if (off?.res) for (const r in off.res) if (off.res[r] >= 1) extra.push(`${RES_NAMES[r]} ${Math.round(off.res[r])}`);
    const so = G.supplyOf?.[G.player];
    if (S.ctrl === G.player || allied(G, G.player, S.ctrl)) extra.push(`보급 ${pct(so ? so[st] : 1)}`);
    if (extra.length) body.appendChild(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px', margin: '10px 0' } }, extra.map((e) => h('span', { class: 'pill' }, e))));
    const cores = S.cores.map((t) => G.countries[t]?.name || t).join(', ');
    const claims = S.claims.map((t) => G.countries[t]?.name || t).join(', ');
    body.appendChild(kv([['핵심 영토', cores || '없음'], ['영유권 주장', claims || '없음']], { margin: '6px 2px 10px' }));
    // 사단
    const ids = G.divsAt?.[st] || [];
    if (ids.length) {
      const own = ids.filter((id) => G.divs[id]?.tag === G.player);
      const c = card(`${icon('military')} 주둔 사단 <small>${ids.length}개</small>`);
      const byTag = {};
      for (const id of ids) { const D = G.divs[id]; if (D) (byTag[D.tag] ||= []).push(D); }
      for (const tag in byTag) {
        const X = G.countries[tag];
        c.appendChild(h('div', { class: 'row small', style: { margin: '4px 0' } }, flag(X), h('span', { class: 'grow' }, `${X.name} — ${byTag[tag].length}개 사단`), h('span', { class: atWar(G, G.player, tag) ? 'bad' : 'muted' }, atWar(G, G.player, tag) ? '적군' : allied(G, G.player, tag) ? '아군' : '')));
      }
      if (own.length) c.appendChild(btn(`아군 ${own.length}개 사단 선택`, () => { app.sel.divs.clear(); for (const id of own) app.sel.divs.add(id); app.sel.mode = 'move'; app.updateFloat(); app.openPanel('units', own); app.dirty = true; }, 'sm', 'check'));
      body.appendChild(c);
    }
    if (app.sel.divs.size) {
      const hostile = atWar(G, G.player, S.ctrl);
      body.appendChild(btn(`선택한 ${app.sel.divs.size}개 사단 ${hostile ? '공격' : '이동'}`, () => app.orderMoveSelected(st), 'primary wide', hostile ? 'attack' : 'move'));
    }
    // 건설
    if (mine) {
      const c = card(`${icon('industry')} 건설 <small>민간 공장 여유 ${Math.floor(P.eco.civFree || 0)}</small>`);
      const list = h('div', { class: 'grid2' });
      for (const type of ['civ', 'mil', 'dock', 'infra', 'fort', 'air', 'aa', 'ref', 'port']) {
        const why = canBuild(G, P, type, st);
        if (why === '해안 주가 아닙니다' || why === '불가' || (why === '기술 필요' && type === 'ref')) continue;
        const B = BUILDINGS[type];
        const b = h('button', { class: 'btn sm' + (why ? ' disabled' : ''), style: { justifyContent: 'flex-start' }, html: `${icon(B.icon)}<span>${B.name}</span>` });
        b.title = why || '';
        onTap(b, () => { const e = queueBuild(G, P, type, st); app.toast(e || `${B.name} 건설 시작 (${app.map.name[st]})`, e ? 'war' : ''); ctx.rerender(); });
        list.appendChild(b);
      }
      c.appendChild(list);
      const q = P.cons.filter((p) => p.st === st);
      if (q.length) c.appendChild(h('div', { class: 'tiny muted', style: { marginTop: '8px' } }, `대기열: ${q.map((p) => BUILDINGS[p.type].name).join(', ')}`));
      body.appendChild(c);
    }
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
};

export const seaPanel = {
  size: 'half',
  title: (app, z) => h('div', { class: 'row grow' }, h('span', { html: icon('sea'), style: { width: '26px', color: 'var(--brass-hi)' } }), h('h2', null, app.map.seas[z].name)),
  render(app, body, z) {
    const G = app.G;
    const ns = G.navSup?.[z] || {};
    const total = Object.values(ns).reduce((a, b) => a + b, 0);
    const c = card(`${icon('anchor')} 제해권`);
    if (!total) c.appendChild(h('div', { class: 'note' }, '이 해역에서 활동 중인 함대가 없습니다.'));
    for (const t in ns) { const X = G.countries[t]; c.appendChild(h('div', { style: { margin: '6px 0' } }, h('div', { class: 'row small' }, flag(X), h('span', { class: 'grow' }, X.name), h('b', null, pct(ns[t] / total))), bar(ns[t] / total, atWar(G, G.player, t) ? 'red' : 'blue'))); }
    body.appendChild(c);
    const fleets = Object.values(G.fleets).filter((F) => F.loc === z);
    if (fleets.length) body.appendChild(card(`${icon('ship')} 함대`, ...fleets.map((F) => item({ ic: 'ship', t: `${G.countries[F.tag].name} ${F.name}`, d: shipLine(F), onClick: () => app.openPanel('fleet', [F]) }))));
    const coast = app.map.seas[z].coast.filter((s) => s < app.map.nGeo).map((s) => app.map.name[s]);
    body.appendChild(h('div', { class: 'note' }, `연안: ${coast.slice(0, 20).join(', ')}${coast.length > 20 ? ' …' : ''}`));
  },
};

export function shipLine(F) { return SHIP_KEYS.filter((k) => F.ships[k]).map((k) => `${SHIPS[k].name} ${F.ships[k]}`).join(' · ') || '함선 없음'; }

const MISSIONS = [['patrol', '순찰(제해권)'], ['raid', '통상 파괴'], ['escort', '호위'], ['idle', '항구 대기']];
export const fleetPanel = {
  size: 'half',
  title: () => '함대',
  sig: (app, list) => list.map((F) => F.id + ':' + F.mission + ':' + F.target + ':' + F.loc + ':' + fleetSize(F)).join('|'),
  render(app, body, list, ctx) {
    const G = app.G, map = app.map;
    for (const F of list) {
      if (!G.fleets[F.id]) continue;
      const X = G.countries[F.tag];
      const mine = F.tag === G.player;
      const p = fleetPower(G, F);
      const c = card(`${icon('ship')} ${X.name} ${F.name} <small>${fleetSize(F)}척</small>`, h('div', { class: 'small muted' }, shipLine(F)), kv([['위치', map.seas[F.loc].name], ['목표 해역', map.seas[F.target]?.name || '-'], ['임무', MISSIONS.find((m) => m[0] === F.mission)?.[1] || F.mission], ['공격력', Math.round(p.atk)], ['손상', Math.round(F.dmg || 0)], ['모항', map.name[F.base]]], { marginTop: '8px' }));
      if (mine) {
        const seg = h('div', { class: 'seg', style: { marginTop: '10px' } });
        for (const [k, label] of MISSIONS) { const b = h('button', { class: F.mission === k ? 'on' : '' }, label); onTap(b, () => { F.mission = k; if (k === 'idle') F.target = map.coast[F.base]?.[0] ?? F.loc; ctx.rerender(); }); seg.appendChild(b); }
        c.appendChild(seg);
        // 목표 해역 선택
        const zones = map.seas.map((z) => z.i).filter((z) => seaPath(G, G.player, F.loc, z) != null).sort((a, b) => map.seaDist(F.loc, a) - map.seaDist(F.loc, b)).slice(0, 14);
        const sel = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '5px', marginTop: '10px' } });
        for (const z of zones) { const b = h('button', { class: 'btn xs' + (F.target === z ? ' primary' : '') }, map.seas[z].name); onTap(b, () => { F.target = z; if (F.mission === 'idle') F.mission = 'patrol'; ctx.rerender(); }); sel.appendChild(b); }
        c.appendChild(h('div', { class: 'tiny muted', style: { marginTop: '10px' } }, '목표 해역'), sel);
      }
      body.appendChild(c);
    }
  },
};

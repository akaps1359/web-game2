// 외교: 국가 목록 · 전쟁 · 진영 · 국가 상세(정당화·선전포고·보장·불가침·통행권·진영)
import { h, onTap } from '../dom.js';
import { icon } from '../icons.js';
import { btn, flag, bar, stat, card, item, empty, setBar } from './common.js';
import { IDEOLOGIES, FACTION_DEFS } from '../../data/countries.js';
import { atWar, allied, atWarAny, fmtDate } from '../../engine/world.js';
import { warsOf, warBetween, canDeclareWar, declareWar, canJustify, justifyDays, startJustify, canGuarantee, guarantee, guaranteeCost, signNap, grantAccess, createFaction, joinFaction, leaveFaction, surrenderLimit, whitePeace } from '../../engine/diplomacy.js';
import { aiAcceptsMember, aiAcceptsNap, aiAcceptsAccess, militaryRatio } from '../../engine/ai.js';
import { divsOf } from '../../engine/military.js';
import { fmtNum, pct, fmtDays } from '../fmt.js';
import { showDialog } from '../modal.js';

const DIPLO_COST = 25;

function relation(G, me, t) {
  const C = G.countries[me], X = G.countries[t];
  if (atWar(G, me, t)) return ['전쟁 중', 'red'];
  if (X.master === me) return ['괴뢰국', 'gold'];
  if (C.master === t) return ['종주국', 'gold'];
  if (C.faction && C.faction === X.faction) return ['동맹', 'green'];
  if (allied(G, me, t)) return ['공동 참전', 'green'];
  if (C.guarantees?.includes(t)) return ['보장 중', 'green'];
  if (X.guarantees?.includes(me)) return ['우리를 보장', 'green'];
  if (C.naps?.[t] > G.hour) return ['불가침', ''];
  if (X.wargoals.some((w) => w.target === me) || X.justify.some((j) => j.target === me)) return ['위협', 'red'];
  return null;
}

function neighbors(G, tag) {
  const out = new Set(); const map = G.map;
  for (const i of G.ownCtrl?.[tag] || []) for (const v of map.nb[i]) { const o = G.st[v].owner; if (o !== tag) out.add(o); }
  return out;
}

export const diplomacyPanel = {
  size: 'tall',
  title: () => '외교',
  tabs: [['countries', '국가'], ['wars', '전쟁'], ['factions', '진영']],
  sig: (app, arg, tab) => { const G = app.G; return `${tab}|${G.wars.length}|${G.wars.map((w) => w.att.length + w.def.length).join()}|${Object.keys(G.factions).length}|${Object.values(G.factions).map((f) => f.members.length).join()}|${Math.round(G.tension * 50)}|${Object.values(G.countries).filter((c) => c.alive).length}`; },
  render(app, body, arg, ctx) {
    const G = app.G;
    const tb = bar(G.tension, 'red'), tv = h('b');
    const upd = () => { setBar(tb, G.tension); tv.textContent = pct(G.tension); };
    upd(); ctx.onUpdate(upd);
    body.appendChild(h('div', { style: { margin: '0 2px 12px' } }, h('div', { class: 'row small' }, h('span', { class: 'icon-txt', html: icon('tension') }), h('span', { class: 'grow' }, '세계 긴장도'), tv), tb));
    if (ctx.tab === 'countries') countries(app, body);
    else if (ctx.tab === 'wars') wars(app, body, ctx);
    else factions(app, body, ctx);
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
};

function countries(app, body) {
  const G = app.G, me = G.player;
  const nb = neighbors(G, me);
  const list = Object.values(G.countries).filter((C) => C.alive && C.tag !== me);
  const score = (C) => (atWar(G, me, C.tag) ? 1e6 : 0) + (allied(G, me, C.tag) ? 5e5 : 0) + (C.major ? 1e5 : 0) + (nb.has(C.tag) ? 5e4 : 0) + (C.eco.civ || 0) + (C.eco.mil || 0);
  list.sort((a, b) => score(b) - score(a));
  const sec = (t) => h('div', { class: 'ttl-sec', style: { fontSize: '13px', margin: '12px 2px 6px' } }, t);
  let lastSec = null;
  const box = h('div', { class: 'list' });
  for (const C of list) {
    const s = atWar(G, me, C.tag) ? '교전국' : allied(G, me, C.tag) ? '우방' : C.major ? '강대국' : nb.has(C.tag) ? '이웃 국가' : '그 밖의 국가';
    if (s !== lastSec) { box.appendChild(sec(s)); lastSec = s; }
    const rel = relation(G, me, C.tag);
    const I = IDEOLOGIES[C.ideology];
    box.appendChild(item({ ic: flag(C, 'flag-md').outerHTML, t: C.name, d: `<span style="color:${I.color};filter:brightness(1.5)">${I.name}</span> · 공장 ${Math.round((C.eco.civ || 0) + (C.eco.mil || 0))} · ${C.leader}${C.capitulated ? ' · <span class="bad">항복</span>' : ''}`, right: rel ? h('span', { class: 'pill ' + rel[1] }, rel[0]) : null, onClick: () => app.openPanel('country', C.tag) }));
  }
  body.appendChild(box);
  body.querySelectorAll('.item .ic').forEach((ic) => { ic.style.background = 'transparent'; ic.style.width = '38px'; });
}

function sideBox(G, tags, leader) {
  return h('div', { class: 'war-side' }, ...tags.slice(0, 8).map((t) => { const X = G.countries[t]; return h('div', { class: 'row tiny', style: { gap: '5px', margin: '3px 0', fontWeight: t === leader ? 700 : 400 } }, flag(X), h('span', { class: 'ellip' }, X.name)); }), tags.length > 8 ? h('div', { class: 'tiny muted' }, `외 ${tags.length - 8}개국`) : null);
}

function wars(app, body, ctx) {
  const G = app.G, me = G.player;
  if (!G.wars.length) { body.appendChild(empty('지금 세계는 평화롭습니다… 아직은.')); return; }
  const sorted = G.wars.slice().sort((a, b) => ((b.att.includes(me) || b.def.includes(me)) ? 1 : 0) - ((a.att.includes(me) || a.def.includes(me)) ? 1 : 0));
  for (const w of sorted) {
    const mine = w.att.includes(me) || w.def.includes(me);
    const A = G.countries[w.attLeader], D = G.countries[w.defLeader];
    const sa = A.surrender || 0, sd = D.surrender || 0;
    const c = h('div', { class: 'card' + (mine ? ' brass' : '') },
      h('h3', { html: `${icon('swords')} ${w.name} <small>${fmtDate(w.start)} 발발</small>` }),
      h('div', { class: 'row', style: { alignItems: 'flex-start' } }, sideBox(G, w.att, w.attLeader), h('div', { class: 'vs' }, 'VS'), sideBox(G, w.def, w.defLeader)),
      h('div', { class: 'row tiny muted', style: { marginTop: '8px' } }, h('span', { class: 'grow' }, `${A.name} 항복 진행 ${pct(sa)} / ${pct(surrenderLimit(G, A))}`), h('span', null, `${D.name} ${pct(sd)} / ${pct(surrenderLimit(G, D))}`)),
      h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } }, h('div', { class: 'grow' }, bar(sa / surrenderLimit(G, A), 'red thin')), h('div', { class: 'grow' }, bar(sd / surrenderLimit(G, D), 'red thin'))));
    if (mine) {
      const side = w.att.includes(me) ? 'att' : 'def';
      const leader = side === 'att' ? w.attLeader : w.defLeader;
      const enemyLeader = side === 'att' ? w.defLeader : w.attLeader;
      if (leader === me) c.appendChild(btn('강화 제안 (백색 평화)', () => {
        const E = G.countries[enemyLeader], Me = G.countries[me];
        const age = (G.hour - w.start) / (24 * 365);
        const ok = (E.surrender || 0) >= 0.3 && (E.surrender || 0) > (Me.surrender || 0) + 0.1 || (age > 1.5 && Math.abs((E.surrender || 0) - (Me.surrender || 0)) < 0.15) || militaryRatio(G, me, enemyLeader) > 2.5;
        if (!ok) { showDialog(app, { title: '강화 거부', body: `${E.name}은(는) 강화 제안을 거부했습니다. 전황이 더 유리해져야 합니다.` }); return; }
        showDialog(app, { title: '강화 수락', body: `${E.name}이(가) 백색 평화에 동의했습니다. 점령지는 모두 원래 주인에게 돌아갑니다. 전쟁을 끝낼까요?`, buttons: [{ text: '강화 체결', primary: true, fn: () => { whitePeace(G, w); app.r.staticDirty = true; ctx.rerender(); } }, { text: '계속 싸운다' }] });
      }, 'sm', 'handshake'));
    }
    body.appendChild(c);
  }
}

function factions(app, body, ctx) {
  const G = app.G, me = G.player, C = G.countries[me];
  for (const F of Object.values(G.factions)) {
    if (!F.members.length) continue;
    const L = G.countries[F.leader];
    const c = h('div', { class: 'card' + (C.faction === F.id ? ' brass' : '') },
      h('h3', { html: `<i style="width:10px;height:10px;border-radius:2px;background:${F.color};display:inline-block"></i> ${F.name} <small>${F.members.length}개국</small>` }),
      h('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, `지도국: ${L?.name || '-'}`),
      h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } }, ...F.members.map((t) => { const X = G.countries[t]; const el = h('span', { class: 'pill', style: { cursor: 'pointer' } }, flag(X), X.name); onTap(el, () => app.openPanel('country', t)); return el; })));
    if (C.faction === F.id) c.appendChild(h('div', { style: { marginTop: '10px' } }, btn('진영 탈퇴', () => showDialog(app, { title: '진영 탈퇴', body: `${F.name}에서 탈퇴합니다.`, buttons: [{ text: '탈퇴', danger: true, fn: () => { leaveFaction(G, me); ctx.rerender(); } }, { text: '취소' }] }), 'sm danger')));
    else if (!C.faction && L && F.leader !== me) {
      const ok = aiAcceptsMember(G, L, C);
      c.appendChild(h('div', { style: { marginTop: '10px' } }, btn(`가입 요청 (정치력 ${DIPLO_COST})`, () => {
        if (C.pp < DIPLO_COST) { app.toast('정치력이 부족합니다', 'war'); return; }
        C.pp -= DIPLO_COST;
        if (aiAcceptsMember(G, L, C)) { joinFaction(G, me, F.id); app.toast(`${F.name} 가입!`, 'peace'); } else showDialog(app, { title: '가입 거절', body: `${L.name}이(가) 가입 요청을 거절했습니다. (이념이 같거나 세계 긴장도가 60% 이상이어야 합니다)` });
        ctx.rerender();
      }, 'sm' + (ok ? ' primary' : ''))));
    }
    body.appendChild(c);
  }
  if (!C.faction) {
    const id = C.ideology === 'fas' ? 'axis' : C.ideology === 'com' ? 'comintern' : C.ideology === 'dem' ? 'allies' : null;
    const exists = id && G.factions[id]?.members.length;
    const fid = exists || !id ? `f_${me}` : id;
    const name = !exists && id ? FACTION_DEFS[id].name : `${C.name} 동맹`;
    const why = !C.major && G.tension < 0.3 ? '세계 긴장도 30% 필요(약소국)' : C.ideology === 'dem' && G.tension < 0.2 ? '세계 긴장도 20% 필요' : null;
    body.appendChild(btn(`새 진영 결성: ${name}`, () => {
      const F = createFaction(G, me, fid);
      if (!FACTION_DEFS[fid]) { F.name = name; F.color = C.color; }
      app.toast(`${F.name} 결성`, 'peace'); ctx.rerender();
    }, 'wide' + (why ? ' disabled' : ' primary'), 'shield'));
    if (why) body.appendChild(h('div', { class: 'tiny muted', style: { marginTop: '6px', textAlign: 'center' } }, why));
  }
}

// ───────── 국가 상세 ─────────
export const countryPanel = {
  size: 'tall',
  title: (app, tag) => { const X = app.G.countries[tag]; return h('div', { class: 'row grow', style: { minWidth: 0 } }, flag(X, 'flag-md'), h('div', { class: 'grow', style: { minWidth: 0 } }, h('h2', null, X.name), h('div', { class: 'sub ellip' }, X.full))); },
  sig: (app, tag) => { const G = app.G, C = G.countries[G.player], X = G.countries[tag]; return `${atWar(G, G.player, tag)}|${allied(G, G.player, tag)}|${C.justify.length}|${C.wargoals.length}|${C.guarantees.length}|${Object.keys(C.naps).length}|${C.access.length}|${C.faction}|${X.faction}|${Math.floor(C.pp / 25)}|${X.alive}|${X.capitulated}`; },
  render(app, body, tag, ctx) {
    const G = app.G, me = G.player, C = G.countries[me], X = G.countries[tag];
    if (!X.alive) { body.appendChild(empty(`${X.name}은(는) 더 이상 존재하지 않습니다.`)); return; }
    const I = IDEOLOGIES[X.ideology];
    body.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, flag(X, 'flag-lg'), h('div', { class: 'grow' },
      h('div', { class: 'small', style: { color: 'var(--paper)', fontWeight: 600 } }, X.leader, h('span', { class: 'muted' }, ` · ${X.title}`)),
      h('div', { class: 'tiny', style: { color: I.color, filter: 'brightness(1.5)', marginTop: '2px' } }, `${I.name} · ${X.gov}`),
      X.faction ? h('div', { class: 'tiny muted' }, `진영: ${G.factions[X.faction]?.name}`) : null,
      X.master ? h('div', { class: 'tiny', style: { color: 'var(--amber)' } }, `${G.countries[X.master]?.name}의 괴뢰국`) : null,
      X.capitulated ? h('div', { class: 'tiny bad' }, '항복함') : null))));
    const divs = divsOf(G, tag).length;
    body.appendChild(h('div', { class: 'grid3', style: { marginBottom: '10px' } },
      stat('민간 공장', Math.round(X.eco.civ || 0), 'civ'), stat('군수 공장', Math.round(X.eco.mil || 0), 'mil'), stat('사단', divs, 'military'),
      stat('안정도', pct(X.stability), 'stability'), stat('전쟁 지지', pct(X.warSupport), 'warsupport'), stat('해군', Object.values(G.fleets).filter((F) => F.tag === tag).reduce((s, F) => s + Object.values(F.ships).reduce((a, b) => a + b, 0), 0) + '척', 'ship')));
    const rel = relation(G, me, tag);
    if (rel) body.appendChild(h('div', { class: 'row', style: { marginBottom: '10px' } }, h('span', { class: 'pill ' + rel[1] }, rel[0])));
    if (tag === me) return;
    // 외교 행동
    const acts = card(`${icon('diplomacy')} 외교 행동 <small>정치력 ${Math.floor(C.pp)}</small>`);
    const action = (label, desc, why, fn, cls = '') => acts.appendChild(item({ t: label, d: desc + (why ? ` <span style="color:var(--amber)">· ${why}</span>` : ''), right: btn('실행', fn, 'sm' + (why ? ' disabled' : ' ' + cls)) }));
    const war = atWar(G, me, tag);
    if (!war) {
      // 정당화
      const J = C.justify.find((j) => j.target === tag);
      const goal = C.wargoals.find((w) => w.target === tag);
      if (J) acts.appendChild(h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '전쟁 목표 정당화 중'), h('div', { class: 'd' }, `${fmtDays(J.total - J.prog)} 남음`), bar(J.prog / J.total, 'red thin'))));
      else if (!goal) {
        const why = canJustify(G, me, tag);
        action('전쟁 목표 정당화', `정치력 50 · 약 ${justifyDays(G, C, X)}일 · 세계 긴장도 상승`, why, () => { startJustify(G, me, tag); app.toast(`${X.name}에 대한 전쟁 목표 정당화 시작`, 'war'); app.hudDirty = true; ctx.rerender(); });
      }
      // 선전포고
      const whyWar = canDeclareWar(G, me, tag);
      if (goal || C.anyWargoal) action('선전포고', `${X.name}과(와) 그 동맹국들에 전쟁을 선포합니다`, whyWar, () => showDialog(app, { title: '선전포고', body: `정말 ${X.name}에 선전포고합니까?${X.faction ? ` ${G.factions[X.faction].name} 전체가 참전합니다.` : ''}`, buttons: [{ text: '선전포고', danger: true, fn: () => { declareWar(G, me, tag); app.r.staticDirty = true; app.hudDirty = true; ctx.rerender(); } }, { text: '취소' }] }), 'danger');
      // 보장
      if (!C.guarantees.includes(tag) && !allied(G, me, tag)) action('독립 보장', `${X.name}이(가) 공격받으면 참전합니다 · 정치력 ${guaranteeCost(C)}`, canGuarantee(G, me, tag), () => { guarantee(G, me, tag); ctx.rerender(); });
      // 불가침
      if (!(C.naps?.[tag] > G.hour) && !allied(G, me, tag)) {
        const why = C.pp < DIPLO_COST ? `정치력 ${DIPLO_COST} 필요` : C.wargoals.some((w) => w.target === tag) ? '전쟁 목표 보유 중' : null;
        action('불가침 조약 제안', `4년간 서로 공격하지 않습니다 · 정치력 ${DIPLO_COST}`, why, () => {
          C.pp -= DIPLO_COST;
          const ok = aiAcceptsNap(G, X, C) || (X.tag === 'SOV' && C.tag === 'GER' && G.tension > 0.4) || militaryRatio(G, me, tag) > 1.8;
          if (ok) { signNap(G, me, tag); app.toast(`${X.name}과(와) 불가침 조약 체결`, 'peace'); } else showDialog(app, { title: '제안 거절', body: `${X.name}이(가) 불가침 조약을 거절했습니다.` });
          ctx.rerender();
        });
      }
      // 통행권
      if (!C.access.includes(tag) && !allied(G, me, tag)) {
        action('군사 통행권 요청', `${X.name} 영토를 지나 이동할 수 있습니다 · 정치력 ${DIPLO_COST}`, C.pp < DIPLO_COST ? `정치력 ${DIPLO_COST} 필요` : null, () => {
          C.pp -= DIPLO_COST;
          if (aiAcceptsAccess(G, X, C) || militaryRatio(G, me, tag) > 4) { grantAccess(G, tag, me); app.toast(`${X.name}의 군사 통행권 획득`, 'peace'); } else showDialog(app, { title: '요청 거절', body: `${X.name}이(가) 군사 통행권을 거절했습니다.` });
          ctx.rerender();
        });
      }
      // 진영 초대
      const F = C.faction && G.factions[C.faction];
      if (F && F.leader === me && X.faction !== C.faction && !X.master) {
        action('진영에 초대', `${F.name}에 초대합니다 · 정치력 ${DIPLO_COST}`, C.pp < DIPLO_COST ? `정치력 ${DIPLO_COST} 필요` : X.faction ? '다른 진영 소속' : atWarAny(G, tag) && !atWarAny(G, me) ? '상대가 전쟁 중' : null, () => {
          C.pp -= DIPLO_COST;
          if (aiAcceptsMember(G, C, X) && !(X.major && X.ideology !== C.ideology)) { joinFaction(G, tag, F.id); app.toast(`${X.name}이(가) ${F.name}에 가입했습니다`, 'peace'); } else showDialog(app, { title: '초대 거절', body: `${X.name}이(가) 초대를 거절했습니다.` });
          ctx.rerender();
        });
      }
    } else {
      acts.appendChild(h('div', { class: 'note' }, `${X.name}과(와) 전쟁 중입니다. 항복 진행도 ${pct(X.surrender || 0)} / 한계 ${pct(surrenderLimit(G, X))}`));
      acts.appendChild(bar((X.surrender || 0) / surrenderLimit(G, X), 'red'));
    }
    body.appendChild(acts);
    const locate = btn('수도 보기', () => { if (X.capital >= 0 && !app.map.virtual[X.capital]) { app.sheet.close(); app.r.focusState(X.capital, Math.max(0.12, app.r.cam.s)); app.r.sel.state = X.capital; app.dirty = true; } }, 'wide', 'locate');
    body.appendChild(locate);
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
};

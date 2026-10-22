// 모달: 이벤트(신문/전보), 대화상자
import { h, $, clear, onTap } from './dom.js';
import { picSVG } from './pics.js';
import { fmtDate, ymd } from '../engine/world.js';
import { EVENT_INDEX } from '../engine/game.js';
import { describeEffects } from './describe.js';

export function closeModal() { const m = $('#modal'); m.classList.remove('show'); clear(m); }

export function showDialog(app, { title, body, buttons = [], html }) {
  const m = clear($('#modal'));
  const d = h('div', { class: 'dialog' }, h('h2', null, title));
  if (html) d.appendChild(h('div', { class: 'note', html }));
  else if (body) d.appendChild(h('p', { class: 'note', style: { fontSize: '13.5px', color: 'var(--text)' } }, body));
  const opts = h('div', { class: 'opts' });
  for (const b of buttons) { const btn = h('button', { class: 'btn ' + (b.primary ? 'primary' : b.danger ? 'danger' : '') + ' wide' }, b.text); onTap(btn, () => { closeModal(); b.fn?.(); }); opts.appendChild(btn); }
  if (!buttons.length) { const btn = h('button', { class: 'btn primary wide' }, '확인'); onTap(btn, closeModal); opts.appendChild(btn); }
  d.appendChild(opts);
  m.appendChild(d); m.classList.add('show');
}

export function showEventModal(app, pending, choose) {
  const G = app.G;
  const E = EVENT_INDEX[pending.id];
  const C = G.countries[pending.tag];
  const m = clear($('#modal'));
  const t = ymd(G.hour);
  const fill = (s) => (s || '').replace(/\{country\}/g, C.name).replace(/\{leader\}/g, C.leader);
  const opts = h('div', { class: 'opts' });
  (E.opts || [{ t: '확인' }]).forEach((o, i) => {
    const fx = describeEffects(G, C, o.fx || []);
    const b = h('button', { class: 'opt' }, fill(o.t), fx ? h('small', { html: fx }) : null);
    onTap(b, () => choose(i));
    opts.appendChild(b);
  });
  let card;
  if (E.style === 'telegram') {
    card = h('div', { class: 'dialog telegram' },
      h('div', { class: 'th' }, h('span', null, '전 보'), h('span', null, `${t.y}. ${t.m}. ${t.d}.`)),
      h('h2', null, fill(E.title)),
      h('div', { class: 'note', style: { color: '#3a3326', fontSize: '13.5px', lineHeight: 1.6, whiteSpace: 'pre-line' } }, fill(E.desc)),
      opts);
  } else {
    const paperName = E.paper || PAPERS[C.tag] || '세계 일보';
    card = h('div', { class: 'dialog', style: { background: 'transparent', border: '0', boxShadow: 'none', padding: '0' } },
      h('div', { class: 'paper' },
        h('div', { class: 'mast' }, paperName),
        h('div', { class: 'meta' }, h('span', null, `${t.y}년 ${t.m}월 ${t.d}일`), h('span', null, '호외 · 특보'), h('span', null, '1부 10전')),
        h('div', { class: 'head' }, fill(E.title)),
        h('div', { html: picSVG(E.pic || 'map'), style: { lineHeight: 0 } }),
        h('div', { class: 'body', style: { whiteSpace: 'pre-line' } }, fill(E.desc))),
      h('div', { style: { padding: '10px 2px 0' } }, opts));
  }
  m.appendChild(card);
  m.classList.add('show');
}

const PAPERS = { GER: '푈키셔 베오바흐터', ENG: '더 타임스', FRA: '르 피가로', ITA: '일 포폴로 디탈리아', SOV: '프라우다', USA: '뉴욕 타임스', POL: '쿠리에르 바르샤프스키', SPR: '엘 솔', JAP: '아사히 신문' };

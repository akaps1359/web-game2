// 국가 중점 트리
import { h, onTap } from '../dom.js';
import { icon } from '../icons.js';
import { btn, bar, setBar } from './common.js';
import { focusBlocked, selectFocus, FOCUS_DAYS } from '../../engine/politics.js';
import { describeTrigger } from '../../engine/effects.js';
import { describeEffects } from '../describe.js';
import { M } from '../../engine/mods.js';
import { fmtDays } from '../fmt.js';

const CW = 112, RH = 118, PAD = 22, NW = 104;
let picked = null;
const scrollMem = {};

function nodeDays(C, n) { return (n.days || FOCUS_DAYS) / (1 + M(C, 'focusSpeed')); }

function nodeState(G, C, n) {
  if (C.focus.done[n.id]) return 'done';
  if (C.focus.cur === n.id) return 'cur';
  if (n.excl && n.excl.some((x) => C.focus.done[x] || C.focus.cur === x)) return 'excl';
  return focusBlocked(G, C, n) ? 'lock' : 'avail';
}

export const focusPanel = {
  size: 'tall', nopad: true, bodyClass: 'fbody',
  title: (app) => { const C = app.G.countries[app.G.player]; return h('div', { class: 'grow', style: { minWidth: 0 } }, h('h2', null, '국가 중점'), h('div', { class: 'sub' }, C.focus.tree === 'generic' ? '일반 중점' : `${C.name} 중점`)); },
  sig: (app) => { const G = app.G, C = G.countries[G.player]; return `${C.focus.cur}|${Object.keys(C.focus.done).length}|${picked}|${Math.floor(C.pp / 25)}|${G.tension.toFixed(2)}|${G.wars.length}`; },
  render(app, body, arg, ctx) {
    const G = app.G, C = G.countries[G.player];
    const nodes = G.focusTree(C);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    // ── 현재 진행 ──
    const cur = C.focus.cur && byId[C.focus.cur];
    const curBar = bar(cur ? C.focus.prog / (cur.days || FOCUS_DAYS) : 0, 'green');
    const curTxt = h('div', { class: 'tiny muted' });
    const top = h('div', { class: 'fcur' },
      h('div', { class: 'fci', html: icon(cur ? cur.icon || 'focus' : 'focus') }),
      h('div', { class: 'grow' }, h('div', { class: 'small', style: { color: cur ? 'var(--paper)' : 'var(--red-hi)', fontWeight: 650 } }, cur ? cur.name : '진행 중인 중점이 없습니다'), cur ? curBar : h('div', { class: 'tiny muted' }, '아래 트리에서 다음 중점을 선택하세요'), cur ? curTxt : null));
    const updCur = () => { if (!cur) return; setBar(curBar, C.focus.prog / (cur.days || FOCUS_DAYS)); curTxt.textContent = `남은 기간 ${fmtDays(((cur.days || FOCUS_DAYS) - C.focus.prog) / (1 + M(C, 'focusSpeed')))}`; };
    updCur(); ctx.onUpdate(updCur);
    body.appendChild(top);
    // ── 트리 ──
    let maxX = 0, maxY = 0;
    for (const n of nodes) { maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); }
    const W = (maxX + 1) * CW + PAD * 2, H = (maxY + 1) * RH + PAD * 2;
    const wrap = h('div', { class: 'ftree-wrap' });
    const tree = h('div', { class: 'ftree', style: { width: W + 'px', height: H + 'px' } });
    const px = (n) => PAD + n.x * CW + (CW - NW) / 2 + NW / 2, py = (n) => PAD + n.y * RH;
    // 연결선
    let svg = `<svg class="links" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    for (const n of nodes) {
      for (const r of n.req || []) {
        const alts = Array.isArray(r) ? r : [r];
        for (const pid of alts) {
          const p = byId[pid]; if (!p) continue;
          const x1 = px(p), y1 = py(p) + 52, x2 = px(n), y2 = py(n);
          const ym = y2 - 14;
          const done = C.focus.done[pid];
          svg += `<path d="M${x1} ${y1}V${ym}H${x2}V${y2}" fill="none" stroke="${done ? '#c9a24a' : 'rgba(200,208,218,.35)'}" stroke-width="${done ? 2.4 : 1.8}" ${alts.length > 1 ? 'stroke-dasharray="5 4"' : ''}/>`;
        }
      }
      for (const x of n.excl || []) {
        const o = byId[x];
        if (!o || o.y !== n.y || o.x < n.x) continue;
        const y = py(n) + 26, xa = px(n) + 32, xb = px(o) - 32;
        const xm = (xa + xb) / 2;
        svg += `<path d="M${xa} ${y}H${xb}" stroke="rgba(226,98,90,.75)" stroke-width="2" stroke-dasharray="3 3"/><circle cx="${xm}" cy="${y}" r="9" fill="#2a1513" stroke="#e2625a" stroke-width="1.5"/><path d="M${xm - 4} ${y - 4}l8 8M${xm + 4} ${y - 4}l-8 8" stroke="#e2625a" stroke-width="1.8"/>`;
      }
    }
    svg += '</svg>';
    tree.innerHTML = svg;
    const nodeEls = {};
    for (const n of nodes) {
      const s = nodeState(G, C, n);
      const pb = s === 'cur' ? h('div', { class: 'fp' }, h('i', { style: { width: Math.min(100, (C.focus.prog / (n.days || FOCUS_DAYS)) * 100) + '%' } })) : null;
      const el = h('div', { class: `fnode ${s}${picked === n.id ? ' picked' : ''}`, style: { left: PAD + n.x * CW + (CW - NW) / 2 + 'px', top: py(n) + 'px' } },
        h('div', { class: 'fi', html: icon(n.icon || 'focus') }, pb),
        h('div', { class: 'fl' }, n.name));
      if (pb) ctx.onUpdate(() => { pb.firstChild.style.width = Math.min(100, (C.focus.prog / (n.days || FOCUS_DAYS)) * 100) + '%'; });
      onTap(el, () => { picked = n.id; ctx.rerender(); });
      nodeEls[n.id] = el;
      tree.appendChild(el);
    }
    wrap.appendChild(tree);
    body.appendChild(wrap);
    const key = C.focus.tree;
    wrap.addEventListener('scroll', () => { scrollMem[key] = [wrap.scrollLeft, wrap.scrollTop]; }, { passive: true });
    // ── 상세 ──
    const det = h('div', { class: 'fdetail' });
    const n = picked && byId[picked];
    if (!n) {
      det.appendChild(h('div', { class: 'note', style: { textAlign: 'center' } }, '중점을 탭하면 효과와 조건이 표시됩니다. 금빛 테두리는 지금 선택할 수 있는 중점입니다.'));
    } else {
      const s = nodeState(G, C, n);
      const why = focusBlocked(G, C, n);
      det.appendChild(h('div', { class: 'row' },
        h('div', { class: 'fci', html: icon(n.icon || 'focus') }),
        h('div', { class: 'grow' }, h('h4', null, n.name), h('div', { class: 'tiny muted' }, `${fmtDays(nodeDays(C, n))} 소요`)),
        s === 'avail' ? btn(C.focus.cur ? '변경' : '선택', () => {
          const go = () => { if (selectFocus(G, C, n.id)) { app.toast(`국가 중점: ${n.name}`); picked = null; app.hudDirty = true; ctx.rerender(); } };
          go();
        }, 'primary', 'check') : h('span', { class: 'pill ' + (s === 'done' ? 'gold' : s === 'cur' ? 'green' : 'red') }, s === 'done' ? '완료' : s === 'cur' ? '진행 중' : why || '불가')));
      if (C.focus.cur && s === 'avail') det.appendChild(h('div', { class: 'tiny', style: { color: 'var(--amber)', marginTop: '6px' } }, '진행 중인 중점을 바꾸면 진행도가 사라집니다.'));
      if (n.desc) det.appendChild(h('p', { class: 'note', style: { margin: '8px 0', color: 'var(--text)', fontSize: '12.5px', whiteSpace: 'pre-line' } }, n.desc));
      const reqs = [];
      for (const r of n.req || []) { const alts = Array.isArray(r) ? r : [r]; reqs.push(alts.map((x) => `${C.focus.done[x] ? '✓' : '·'} ${byId[x]?.name || x}`).join(' 또는 ')); }
      if (reqs.length) det.appendChild(h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, '선행: ' + reqs.join(', ')));
      if (n.excl?.length) det.appendChild(h('div', { class: 'tiny', style: { color: 'var(--red-hi)', marginTop: '3px' } }, '상호 배타: ' + n.excl.map((x) => byId[x]?.name || x).join(', ')));
      if (n.avail) det.appendChild(h('div', { class: 'tiny muted', style: { marginTop: '3px' } }, '조건: ' + (n.availText || describeTrigger(G, n.avail).join(', '))));
      const fx = describeEffects(G, C, n.fx || []);
      if (fx) det.appendChild(h('div', { class: 'card', style: { marginTop: '8px', marginBottom: 0, padding: '10px' } }, h('div', { class: 'tiny gold', style: { marginBottom: '4px' } }, '효과'), h('div', { class: 'small fx', html: fx })));
    }
    body.appendChild(det);
    // 스크롤 위치: 기억 → 선택 노드 → 진행 중 → 첫 선택 가능 노드
    requestAnimationFrame(() => {
      if (scrollMem[key]) { wrap.scrollLeft = scrollMem[key][0]; wrap.scrollTop = scrollMem[key][1]; return; }
      const target = cur || nodes.find((x) => nodeState(G, C, x) === 'avail') || nodes[0];
      if (target) { wrap.scrollLeft = Math.max(0, px(target) - wrap.clientWidth / 2); wrap.scrollTop = Math.max(0, py(target) - 30); }
    });
  },
  onClose() { picked = null; },
};

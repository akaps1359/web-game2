// 패널 공용 조각
import { h, onTap } from '../dom.js';
import { icon } from '../icons.js';
import { flagURL } from '../flags.js';

export const btn = (label, fn, cls = '', ic) => { const b = h('button', { class: 'btn ' + cls, html: (ic ? icon(ic) : '') + `<span>${label}</span>` }); if (fn) onTap(b, fn); return b; };
export const flag = (C, cls = 'flag-sm') => h('img', { class: cls, src: flagURL(C?.flag, cls === 'flag-lg' ? 66 : cls === 'flag-md' ? 36 : 24, cls === 'flag-lg' ? 44 : cls === 'flag-md' ? 24 : 16), alt: '' });
export const bar = (v, cls = '') => { const b = h('div', { class: 'bar ' + cls }, h('i', { style: { width: Math.max(0, Math.min(100, v * 100)) + '%' } })); return b; };
export const stat = (k, v, ic, sub) => h('div', { class: 'stat' }, h('div', { class: 'k', html: (ic ? icon(ic) : '') + k }), h('div', { class: 'v', html: `${v}${sub ? ` <small>${sub}</small>` : ''}` }));
export const card = (title, ...kids) => h('div', { class: 'card' }, title ? h('h3', { html: title }) : null, ...kids);
export const item = ({ ic, t, d, right, onClick, cls = '' }) => { const el = h('div', { class: 'item ' + cls }, ic ? h('div', { class: 'ic', html: typeof ic === 'string' && !ic.startsWith('<') ? icon(ic) : ic }) : null, h('div', { class: 'grow' }, h('div', { class: 't' }, t), d ? h('div', { class: 'd', html: d }) : null), right || null); if (onClick) onTap(el, onClick); return el; };
export const empty = (text) => h('div', { class: 'empty' }, text);
export const setBar = (b, v) => { b.firstChild.style.width = Math.max(0, Math.min(100, v * 100)) + '%'; };

// 이벤트 삽화 — 코드로 그린 실루엣 (SVG 문자열, 세피아 신문 사진 느낌)
const SKY = (id) => `<defs><linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdbf9c"/><stop offset="1" stop-color="#8f8061"/></linearGradient><pattern id="ht${id}" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.7" fill="rgba(0,0,0,0.18)"/></pattern><radialGradient id="vg${id}" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.45)"/></radialGradient></defs><rect width="320" height="170" fill="url(#sky${id})"/>`;
const END = (id) => `<rect width="320" height="170" fill="url(#ht${id})"/><rect width="320" height="170" fill="url(#vg${id})"/>`;
const ink = '#2b241a';

const soldier = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})" fill="${ink}"><circle cx="0" cy="-34" r="5"/><path d="M-6 -36 q6 -7 12 0 l1 2 h-14z"/><path d="M-6 -28 h12 l2 18 h-4 l-1 20 h-4 l-1 -14 -1 14 h-4 l-1 -20 h-4z"/><path d="M6 -26 l14 -16 2 1 -14 17z"/></g>`;
const tank = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})" fill="${ink}"><path d="M-40 0 h80 q6 0 6 6 v4 q0 6 -6 6 h-80 q-6 0 -6 -6 v-4 q0 -6 6 -6z"/><path d="M-30 0 l6 -12 h44 l8 12z"/><rect x="-14" y="-24" width="26" height="13" rx="3"/><rect x="10" y="-20" width="40" height="4"/><g fill="#6d5f45">${[-36, -22, -8, 6, 20, 34].map((c) => `<circle cx="${c}" cy="9" r="4.5"/>`).join('')}</g></g>`;
const plane = (x, y, s = 1, r = 0) => `<g transform="translate(${x},${y}) rotate(${r}) scale(${s})" fill="${ink}"><path d="M-30 0 q30 -6 52 -2 q6 1 8 2 q-2 1 -8 2 q-22 4 -52 -2z"/><path d="M-4 -1 l-10 -26 h7 l18 26z"/><path d="M-4 1 l-10 24 h7 l18 -24z"/><path d="M-30 0 l-6 -10 h5 l7 9z"/></g>`;
const ship = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})" fill="${ink}"><path d="M-80 0 h170 l-14 16 h-146z"/><rect x="-40" y="-14" width="60" height="14"/><rect x="-24" y="-26" width="22" height="12"/><rect x="-14" y="-44" width="5" height="18"/><rect x="26" y="-10" width="30" height="10"/><rect x="40" y="-14" width="34" height="3"/><rect x="-66" y="-9" width="22" height="9"/><rect x="-92" y="-12" width="28" height="3"/></g>`;
const factory = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})" fill="${ink}"><path d="M-70 0 v-30 l20 12 v-12 l20 12 v-12 l20 12 v-30 h10 v-20 h8 v20 h10 v48z"/><rect x="40" y="-70" width="9" height="70"/><rect x="58" y="-56" width="8" height="56"/><path d="M44 -74 q10 -14 30 -12 q14 2 22 -10" stroke="${ink}" stroke-width="6" fill="none" opacity=".5"/></g>`;
const flagPole = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})" fill="${ink}"><rect x="-1.5" y="-80" width="3" height="80"/><path d="M1.5 -78 q20 -6 40 2 q14 6 28 -2 v30 q-14 8 -28 2 q-20 -8 -40 -2z"/></g>`;
const crowd = (y) => { let s = ''; for (let i = 0; i < 24; i++) { const x = i * 14 + (i % 2) * 5; const hh = 8 + ((i * 37) % 9); s += `<circle cx="${x}" cy="${y - hh - 6}" r="5.5"/><rect x="${x - 6}" y="${y - hh}" width="12" height="${hh + 10}" rx="4"/>`; } return `<g fill="${ink}">${s}</g>`; };
const hills = (y, h = 18) => `<path d="M0 ${y} q40 -${h} 80 -4 t80 2 t80 -6 t80 4 V170 H0z" fill="#5b5040"/>`;
const ground = (y) => `<rect y="${y}" width="320" height="${170 - y}" fill="#6d6150"/>`;
const sea = (y) => `<rect y="${y}" width="320" height="${170 - y}" fill="#6f6a5c"/><path d="M0 ${y + 10} q20 -4 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#4d483d" fill="none"/>`;
const smoke = (x, y, r = 30) => `<g fill="#3d3528" opacity=".45"><circle cx="${x}" cy="${y}" r="${r}"/><circle cx="${x + r * 0.8}" cy="${y - r * 0.4}" r="${r * 0.8}"/><circle cx="${x - r * 0.7}" cy="${y - r * 0.3}" r="${r * 0.7}"/></g>`;
const building = (x, y, w, hgt) => `<rect x="${x}" y="${y - hgt}" width="${w}" height="${hgt}" fill="${ink}"/>${Array.from({ length: Math.floor(hgt / 12) }, (_, r) => Array.from({ length: Math.floor(w / 10) }, (_, c) => `<rect x="${x + 3 + c * 10}" y="${y - hgt + 5 + r * 12}" width="4" height="6" fill="#8f8061"/>`).join('')).join('')}`;
const table = () => `<g fill="${ink}"><rect x="60" y="110" width="200" height="10"/><rect x="70" y="120" width="8" height="34"/><rect x="242" y="120" width="8" height="34"/></g>`;
const person = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})" fill="${ink}"><circle cy="-46" r="8"/><path d="M-12 -36 h24 l4 34 h-32z"/></g>`;

const SCENES = {
  troops: (id) => SKY(id) + hills(120, 14) + ground(132) + smoke(250, 70, 24) + [30, 70, 110, 150, 190, 230, 270].map((x, i) => soldier(x, 150 - (i % 2) * 4, 0.95)).join('') + END(id),
  tanks: (id) => SKY(id) + smoke(80, 60, 30) + hills(112, 10) + ground(126) + tank(100, 128, 1) + tank(230, 140, 0.8) + END(id),
  planes: (id) => SKY(id) + `<path d="M0 150 q160 -20 320 0 V170 H0z" fill="#5b5040"/>` + plane(90, 60, 1.2, -6) + plane(190, 40, 0.9, -4) + plane(250, 85, 0.8, -8) + building(20, 160, 30, 30) + building(250, 160, 40, 24) + END(id),
  ships: (id) => SKY(id) + sea(115) + ship(150, 120, 1) + smoke(160, 60, 16) + END(id),
  factory: (id) => SKY(id) + ground(140) + factory(140, 140, 1.15) + END(id),
  crowd: (id) => SKY(id) + flagPole(160, 120, 1) + crowd(160) + END(id),
  diplomacy: (id) => SKY(id) + `<rect y="0" width="320" height="170" fill="#a89878"/>` + `<g fill="${ink}"><rect x="40" y="18" width="240" height="70" fill="#8a7a5c"/></g>` + person(110, 110, 1) + person(210, 110, 1) + table() + `<rect x="140" y="104" width="40" height="6" fill="#e9e0c7"/>` + END(id),
  city: (id) => SKY(id) + [[10, 50], [55, 80], [110, 60], [165, 95], [220, 70], [270, 55]].map(([x, hh]) => building(x, 150, 42, hh)).join('') + ground(150) + END(id),
  ruins: (id) => SKY(id) + smoke(160, 60, 40) + [[20, 40], [80, 24], [150, 50], [220, 30], [270, 44]].map(([x, hh]) => building(x, 150, 36, hh)).join('') + `<path d="M0 150 l30 -10 20 6 30 -12 40 8 40 -14 30 10 40 -6 40 8 50 -4 V170 H0z" fill="${ink}"/>` + END(id),
  map: (id) => SKY(id) + `<rect x="30" y="24" width="260" height="122" fill="#d9ccaa" stroke="${ink}"/>` + `<path d="M60 120 q30 -60 80 -50 t90 -30 M70 60 q40 30 90 10 t90 40" stroke="#6b5c40" stroke-width="2" fill="none"/>` + `<path d="M120 90 l40 -16 l-6 10 l20 -2" stroke="#7a2a1f" stroke-width="4" fill="none"/>` + END(id),
  soldiersSnow: (id) => `<defs><linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d4c6"/><stop offset="1" stop-color="#a69f8e"/></linearGradient><pattern id="ht${id}" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.7" fill="rgba(0,0,0,0.15)"/></pattern><radialGradient id="vg${id}" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.4)"/></radialGradient></defs><rect width="320" height="170" fill="url(#sky${id})"/><rect y="128" width="320" height="42" fill="#e6e1d6"/>` + [40, 100, 160, 220, 280].map((x, i) => soldier(x, 150 - (i % 2) * 3, 0.9)).join('') + END(id),
  victory: (id) => SKY(id) + crowd(165) + flagPole(70, 110, 0.8) + flagPole(250, 110, 0.8) + `<g fill="#3d3528" opacity=".35">${Array.from({ length: 30 }, (_, i) => `<rect x="${(i * 41) % 320}" y="${(i * 23) % 90}" width="3" height="5" transform="rotate(${i * 13} ${(i * 41) % 320} ${(i * 23) % 90})"/>`).join('')}</g>` + END(id),
};
let uid = 0;
export function picSVG(kind) {
  const f = SCENES[kind] || SCENES.map;
  const id = ++uid;
  return `<svg class="pic" viewBox="0 0 320 170" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${f(id)}</svg>`;
}
export const PIC_KINDS = Object.keys(SCENES);

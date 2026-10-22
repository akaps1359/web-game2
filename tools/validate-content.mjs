// 콘텐츠 검증: 이벤트·중점이 참조하는 이벤트/주/국가/정신/기술/연산이 모두 존재하는지 확인
import { FOCUS_TREES } from '../js/data/focus.js';
import { EVENTS, CAPITULATIONS } from '../js/data/events.js';
import { STATES, VIRTUAL_STATES } from '../js/data/states.js';
import { COUNTRIES, FACTION_DEFS } from '../js/data/countries.js';
import { SPIRITS } from '../js/data/ideas.js';
import { TECH } from '../js/data/techs.js';
import { EQUIPMENT } from '../js/data/units.js';
import fs from 'fs';

const keys = new Set([...STATES, ...VIRTUAL_STATES].map((s) => s[0]));
const tags = new Set(Object.keys(COUNTRIES));
const evIds = new Set(EVENTS.map((e) => e.id));
const effSrc = fs.readFileSync(new URL('../js/engine/effects.js', import.meta.url), 'utf8');
const ops = new Set([...effSrc.matchAll(/case '([A-Za-z]+)'/g)].map((m) => m[1]));
const errs = [];
const err = (where, msg) => errs.push(`${where}: ${msg}`);
const TAG_OPS = { wargoal: 1, annex: 1, puppet: 1, war: 1, nap: 1, access: 1, guarantee: 1, guaranteeFree: 1, joinFaction: 1, addToFaction: 1, breakNap: 1, removeWargoal: 1, peace: 1, playAs: 1, fleetsTo: 1, stockTo: 1, wargoalAt: 1 };
function checkStates(where, list) { for (const k of [].concat(list)) if (typeof k === 'string' && !keys.has(k)) err(where, `unknown state ${k}`); }
function checkTag(where, t) { if (t && t !== 'THIS' && !tags.has(t)) err(where, `unknown tag ${t}`); }
function checkFx(where, fx) {
  for (const e of fx || []) {
    const [op, a, b, c] = e;
    if (!ops.has(op)) { err(where, `unknown op ${op}`); continue; }
    if (TAG_OPS[op]) checkTag(where, a);
    if (op === 'event') { if (!evIds.has(a)) err(where, `unknown event ${a}`); checkTag(where, b); }
    if (op === 'spirit' || op === 'rmSpirit') { if (!SPIRITS[a] && !(op === 'spirit' && c)) err(where, `unknown spirit ${a}`); }
    if (op === 'tech' && !TECH[a]) err(where, `unknown tech ${a}`);
    if (op === 'equip' && !EQUIPMENT[a]) err(where, `unknown equipment ${a}`);
    if (['claim', 'core', 'cede', 'transfer'].includes(op)) checkStates(where, a);
    if (op === 'cede' || op === 'transfer') checkTag(where, b);
    if (['spawnPuppet', 'spawnCtrl', 'civilWar', 'spawn'].includes(op)) { checkTag(where, a); checkStates(where, b); }
    if (['civ', 'mil', 'dock', 'ref', 'infra'].includes(op) && b) checkStates(where, b);
    if (op === 'fort' || op === 'airbase') checkStates(where, b);
    if (op === 'annexBy' || op === 'warOn') { checkTag(where, a); checkTag(where, b); }
    if (op === 'createFaction' && !FACTION_DEFS[a]) err(where, `unknown faction ${a}`);
    if (op === 'units') for (const [, , loc] of a) if (loc) checkStates(where, loc);
    if (op === 'for') { checkTag(where, a); checkFx(where + '>for', b); }
    if (op === 'if') { checkTrig(where + '>if', a); checkFx(where + '>then', b); if (c) checkFx(where + '>else', c); }
    if (op === 'random') { checkFx(where, b); if (c) checkFx(where, c); }
  }
}
const trigSrc = effSrc.slice(effSrc.indexOf('function checkOne'));
const trigOps = new Set([...trigSrc.matchAll(/case '([A-Za-z]+)'/g)].map((m) => m[1]));
function checkTrig(where, trig) {
  for (const t of trig || []) {
    const [op, a, b] = t;
    if (!trigOps.has(op)) { err(where, `unknown trigger ${op}`); continue; }
    if (['or', 'and'].includes(op)) checkTrig(where, a);
    else if (op === 'not') checkTrig(where, [a]);
    else if (['controls', 'controlsAny', 'owns', 'enemyControls', 'controlsCount'].includes(op)) { checkTag(where, a); checkStates(where, b); }
    else if (['alive', 'dead', 'exists', 'surrender', 'major', 'notPuppet', 'noFaction'].includes(op)) checkTag(where, a);
    else if (op === 'fired' || op === 'notFired') { if (!evIds.has(a)) err(where, `unknown event in trigger ${a}`); }
    else if (op === 'atWar' || op === 'notAtWar' || op === 'allied') { checkTag(where, a); checkTag(where, b); }
  }
}
for (const tree in FOCUS_TREES) for (const n of FOCUS_TREES[tree]) { checkFx(`focus ${n.id}`, n.fx); checkTrig(`focus ${n.id} avail`, n.avail); checkTrig(`focus ${n.id} aiIf`, n.aiIf); }
for (const E of EVENTS) {
  checkTrig(`event ${E.id}`, E.trig); checkFx(`event ${E.id} immediate`, E.immediate);
  for (const t of [].concat(E.who || [])) checkTag(`event ${E.id} who`, t);
  (E.opts || []).forEach((o, i) => { checkFx(`event ${E.id} opt${i}`, o.fx); checkTrig(`event ${E.id} opt${i} aiIf`, o.aiIf); });
  if (!E.manual && !E.trig) err(`event ${E.id}`, 'no trigger and not manual');
}
const seen = new Set(); for (const E of EVENTS) { if (seen.has(E.id)) err('events', `duplicate ${E.id}`); seen.add(E.id); }
for (const H of CAPITULATIONS) if (!evIds.has(H.event)) err('capitulations', `unknown event ${H.event}`);
console.log(errs.length ? errs.join('\n') : 'content OK');
console.log(`events ${EVENTS.length}, focus nodes ${Object.values(FOCUS_TREES).reduce((s, t) => s + t.length, 0)}`);
process.exit(errs.length ? 1 : 0);

// 국가 중점 트리 모음. 노드: {id, name, icon, x, y, days?, req?, excl?, avail?, availText?, fx, desc, ai?, aiIf?}
// req 항목이 배열이면 그중 하나만 완료해도 된다. aiIf가 맞지 않으면 AI는 그 중점을 고르지 않고 기다린다.
import { GENERIC } from './focus/generic.js';
import { GER } from './focus/ger.js';
import { ITA } from './focus/ita.js';
import { ENG } from './focus/eng.js';
import { FRA } from './focus/fra.js';
import { SOV } from './focus/sov.js';
import { USA } from './focus/usa.js';

export const FOCUS_TREES = { generic: GENERIC, GER, ITA, ENG, FRA, SOV, USA };

// 장비 · 대대 · 지원 중대 · 함선 · 항공기 · 지형
// 수치는 하츠 오브 아이언 IV 1.14 게임 파일 값을 바탕으로 단순화했다.
// 대대 능력치 = (필요 장비 종류별 능력치 합) × (1 + 대대 보정) — HOI4와 같은 방식

// 장비: 단가(IC, 등급별), 공장 1개당 자원 소모, 등급별 능력치
// sa 대인 공격, ha 대물 공격, def 방어, brk 돌파, arm 장갑, prc 관통, aa 대공, hard 기갑 비율, spd 속도
export const EQUIPMENT = {
  inf_eq: {
    name: '보병 장비', res: { steel: 2 }, ic: [0.43, 0.5, 0.58, 0.69],
    lv: ['구식 보병 장비', '보병 장비 I', '보병 장비 II', '보병 장비 III'],
    st: [{ sa: 3, ha: 0.5, def: 20, brk: 2, prc: 1 }, { sa: 6, ha: 1, def: 22, brk: 3, prc: 4 }, { sa: 9, ha: 1.5, def: 28, brk: 4, prc: 5 }, { sa: 12, ha: 2, def: 34, brk: 5, prc: 10 }],
  },
  sup_eq: { name: '지원 장비', res: { steel: 2, alu: 1 }, ic: [4, 4], lv: ['지원 장비', '지원 장비'], st: [{}, {}] },
  art: {
    name: '야포', res: { steel: 2, tung: 1 }, ic: [3.5, 3.5, 4, 4.5],
    lv: ['야포 I', '야포 I', '야포 II', '야포 III'],
    st: [{ sa: 25, ha: 2, def: 10, brk: 6, prc: 5 }, { sa: 25, ha: 2, def: 10, brk: 6, prc: 5 }, { sa: 30, ha: 2, def: 15, brk: 7, prc: 5 }, { sa: 34, ha: 2, def: 18, brk: 8, prc: 5 }],
  },
  at: {
    name: '대전차포', res: { steel: 2, tung: 2 }, ic: [4, 4, 5, 6],
    lv: ['대전차포 I', '대전차포 I', '대전차포 II', '대전차포 III'],
    st: [{ sa: 4, ha: 20, def: 4, prc: 60, hard: 0.1 }, { sa: 4, ha: 20, def: 4, prc: 60, hard: 0.1 }, { sa: 4, ha: 22, def: 4, prc: 90, hard: 0.1 }, { sa: 4, ha: 30, def: 4, prc: 125, hard: 0.1 }],
  },
  aa: {
    name: '대공포', res: { steel: 2 }, ic: [4, 4, 5, 6],
    lv: ['대공포 I', '대공포 I', '대공포 II', '대공포 III'],
    st: [{ sa: 3, ha: 7, def: 4, brk: 1, prc: 25, aa: 19 }, { sa: 3, ha: 7, def: 4, brk: 1, prc: 25, aa: 19 }, { sa: 3.5, ha: 11, def: 4, brk: 1, prc: 60, aa: 25 }, { sa: 4, ha: 15, def: 4, brk: 1, prc: 88, aa: 32 }],
  },
  mot: { name: '트럭', res: { steel: 1, rub: 1 }, ic: [2.5, 2.5], lv: ['트럭', '트럭'], st: [{ brk: 5, hard: 0.1, spd: 12 }, { brk: 5, hard: 0.1, spd: 12 }] },
  mech: {
    name: '장갑병력수송차', res: { steel: 2, rub: 1 }, ic: [8, 8, 10, 12],
    lv: ['기계화 장비 I', '기계화 장비 I', '기계화 장비 II', '기계화 장비 III'],
    st: [{ def: 26, brk: 6, prc: 11, arm: 10, hard: 0.6, spd: 8 }, { def: 26, brk: 6, prc: 11, arm: 10, hard: 0.6, spd: 8 }, { def: 30, brk: 8, prc: 16, arm: 15, hard: 0.7, spd: 10 }, { def: 34, brk: 10, prc: 21, arm: 20, hard: 0.75, spd: 12 }],
  },
  ltank: {
    name: '경전차', res: { steel: 3 }, ic: [8, 8, 9, 10],
    lv: ['경전차 I', '경전차 I', '경전차 II', '경전차 III'],
    st: [{ sa: 13, ha: 4, def: 4, brk: 26, prc: 10, arm: 10, hard: 0.8, spd: 10 }, { sa: 13, ha: 4, def: 4, brk: 26, prc: 10, arm: 10, hard: 0.8, spd: 10 }, { sa: 16, ha: 6, def: 5, brk: 36, prc: 30, arm: 15, hard: 0.8, spd: 12 }, { sa: 22, ha: 9, def: 6, brk: 46, prc: 50, arm: 30, hard: 0.8, spd: 14 }],
  },
  mtank: {
    name: '중형 전차', res: { steel: 3, tung: 2 }, ic: [12, 12, 13, 14],
    lv: ['중형 전차 I', '중형 전차 I', '중형 전차 II', '중형 전차 III'],
    st: [{ sa: 19, ha: 14, def: 5, brk: 36, prc: 61, arm: 60, hard: 0.9, spd: 8 }, { sa: 19, ha: 14, def: 5, brk: 36, prc: 61, arm: 60, hard: 0.9, spd: 8 }, { sa: 25, ha: 19, def: 7, brk: 51, prc: 81, arm: 80, hard: 0.9, spd: 9 }, { sa: 32, ha: 24, def: 9, brk: 66, prc: 91, arm: 90, hard: 0.9, spd: 10 }],
  },
  htank: {
    name: '중전차', res: { steel: 4, chr: 3 }, ic: [25, 25, 27, 30],
    lv: ['중전차 I', '중전차 I', '중전차 II', '중전차 III'],
    st: [{ sa: 15, ha: 12, def: 6, brk: 36, prc: 35, arm: 70, hard: 0.95, spd: 5 }, { sa: 15, ha: 12, def: 6, brk: 36, prc: 35, arm: 70, hard: 0.95, spd: 5 }, { sa: 27, ha: 30, def: 8, brk: 52, prc: 111, arm: 110, hard: 0.95, spd: 6 }, { sa: 35, ha: 40, def: 9, brk: 67, prc: 131, arm: 130, hard: 0.95, spd: 6 }],
  },
  fighter: { name: '전투기', res: { alu: 3, rub: 1 }, ic: [22, 24, 26, 28], lv: ['구식 전투기', '전투기 I', '전투기 II', '전투기 III'], air: 1, st: [{ atk: 9, def: 8, agi: 45, spd: 330 }, { atk: 18, def: 10, agi: 50, spd: 500 }, { atk: 27, def: 12, agi: 65, spd: 650 }, { atk: 32, def: 14, agi: 80, spd: 720 }] },
  cas: { name: '근접 항공 지원기', res: { alu: 2, rub: 1 }, ic: [22, 22, 24, 26], lv: ['CAS I', 'CAS I', 'CAS II', 'CAS III'], air: 1, st: [{ atk: 6, def: 14, agi: 35, gnd: 8 }, { atk: 6, def: 14, agi: 35, gnd: 8 }, { atk: 10, def: 16, agi: 39, gnd: 13 }, { atk: 14, def: 20, agi: 44, gnd: 18 }] },
  tac: { name: '전술 폭격기', res: { alu: 3, rub: 1 }, ic: [37, 37, 40, 44], lv: ['전술 폭격기 I', '전술 폭격기 I', '전술 폭격기 II', '전술 폭격기 III'], air: 1, st: [{ atk: 8, def: 18, agi: 20, gnd: 6, bomb: 12 }, { atk: 8, def: 18, agi: 20, gnd: 6, bomb: 12 }, { atk: 10, def: 22, agi: 22, gnd: 8, bomb: 16 }, { atk: 12, def: 26, agi: 24, gnd: 10, bomb: 20 }] },
};
export const EQ_KEYS = Object.keys(EQUIPMENT);
export const LAND_EQ = ['inf_eq', 'sup_eq', 'art', 'at', 'aa', 'mot', 'mech', 'ltank', 'mtank', 'htank'];
export const AIR_EQ = ['fighter', 'cas', 'tac'];
export const RES_KEYS = ['oil', 'steel', 'alu', 'rub', 'tung', 'chr'];
export const RES_NAMES = { oil: '석유', steel: '강철', alu: '알루미늄', rub: '고무', tung: '텅스텐', chr: '크롬' };
export const RES_SCALE = 3.5; // states.js 자원 수치 배율

// 함선 (조선소 생산). ic = 척당 비용, 능력치는 함대 전투용 단순화 값
export const SHIPS = {
  dd: { name: '구축함', ic: 1185, res: { steel: 3 }, atk: 3, hp: 40, def: 2, aa: 2, asw: 13, spd: 33, sup: 0.5, short: '구' },
  cl: { name: '경순양함', ic: 3300, res: { steel: 3, chr: 1 }, atk: 8, hp: 140, def: 5, aa: 4, asw: 2, spd: 35, sup: 1, short: '경순' },
  ca: { name: '중순양함', ic: 5600, res: { steel: 6, chr: 1 }, atk: 15, hp: 315, def: 11, aa: 3, asw: 0, spd: 33, sup: 2, short: '중순' },
  bb: { name: '전함', ic: 12960, res: { steel: 8, chr: 2 }, atk: 36, hp: 495, def: 36, aa: 6, asw: 0, spd: 27, sup: 4, short: '전함' },
  cv: { name: '항공모함', ic: 8820, res: { steel: 6, chr: 1 }, atk: 30, hp: 325, def: 8, aa: 8, asw: 4, spd: 30, sup: 3, short: '항모' },
  ss: { name: '잠수함', ic: 450, res: { steel: 2 }, atk: 6, hp: 20, def: 0, aa: 0, asw: 0, spd: 18, sup: 0.2, short: '잠', raider: 1 },
};
export const SHIP_KEYS = Object.keys(SHIPS);
export const SHIP_UNLOCK = { dd: 'dd1', cl: 'cl1', ca: 'ca1', bb: 'bb1', cv: 'cv1', ss: 'ss1' };

// 전투 대대
// eq: 필요 장비, w 전장 너비, org 조직력, hp 내구도, sup 보급, fuel 연료(시간당), train 훈련일
// bonus: 대대 고유 보정(능력치 배율), terr: 지형별 공격 보정, mtn/amphib 등
export const BATTALIONS = {
  inf: { name: '보병', short: '보병', icon: 'inf', mp: 1000, eq: { inf_eq: 100 }, w: 2, org: 60, hp: 25, sup: 0.06, train: 90 },
  art: { name: '포병', short: '포병', icon: 'art', mp: 500, eq: { art: 24 }, w: 3, org: 0, hp: 0.6, sup: 0.21, spd: 4, train: 120, cls: 'art', terr: { forest: -0.2, marsh: -0.2, jungle: -0.25, river: -0.2, amphib: -0.4 } },
  at: { name: '대전차', short: '대전차', icon: 'at', mp: 500, eq: { at: 24 }, w: 1, org: 0, hp: 0.6, sup: 0.1, spd: 4, train: 120, cls: 'art', terr: { forest: -0.2, marsh: -0.2, river: -0.2, amphib: -0.4 } },
  aa: { name: '대공포', short: '대공', icon: 'aa', mp: 500, eq: { aa: 24 }, w: 1, org: 0, hp: 0.6, sup: 0.1, spd: 4, train: 120, cls: 'art' },
  mot: { name: '차량화 보병', short: '차량화', icon: 'mot', mp: 1200, eq: { inf_eq: 100, mot: 35 }, w: 2, org: 60, hp: 25, sup: 0.065, fuel: 1.2, train: 90, need: 'motorized', cls: 'mot', terr: { forest: -0.1, marsh: -0.1, urban: -0.1, river: -0.1, amphib: -0.2 } },
  mech: { name: '기계화 보병', short: '기계화', icon: 'mech', mp: 1200, eq: { inf_eq: 100, mech: 40 }, w: 2, org: 60, hp: 30, sup: 0.14, fuel: 2, train: 120, need: 'mechanized', cls: 'mot', terr: { forest: -0.2, urban: -0.2, river: -0.2, amphib: -0.4 } },
  cav: { name: '기병', short: '기병', icon: 'cav', mp: 1000, eq: { inf_eq: 120 }, w: 2, org: 70, hp: 25, sup: 0.06, spd: 6.4, train: 120, cls: 'cav', terr: { forest: -0.05, hills: -0.05, mountain: -0.1, urban: -0.05, amphib: -0.4 } },
  mtn: { name: '산악병', short: '산악', icon: 'mtn', mp: 1000, eq: { inf_eq: 140 }, w: 2, org: 70, hp: 20, sup: 0.05, train: 120, need: 'mountaineers', bonus: { brk: 0.3 }, terr: { hills: 0.2, mountain: 0.35 } },
  mar: { name: '해병', short: '해병', icon: 'mar', mp: 1000, eq: { inf_eq: 150 }, w: 2, org: 70, hp: 20, sup: 0.05, train: 120, need: 'marines', bonus: { brk: 0.3 }, terr: { marsh: 0.3, river: 0.3, amphib: 0.5 } },
  para: { name: '공수부대', short: '공수', icon: 'para', mp: 1000, eq: { inf_eq: 130 }, w: 2, org: 70, hp: 22, sup: 0.05, train: 150, need: 'paratroopers' },
  lt: { name: '경전차', short: '경전차', icon: 'tank', mp: 500, eq: { ltank: 60 }, w: 2, org: 10, hp: 2, sup: 0.22, fuel: 4, train: 180, bonus: { brk: 0.15 }, cls: 'arm', terr: { forest: -0.2, mountain: -0.1, marsh: -0.1, jungle: -0.3, urban: -0.4, river: -0.2, amphib: -0.4 } },
  mt: { name: '중형 전차', short: '중형전차', icon: 'tank', mp: 500, eq: { mtank: 50 }, w: 2, org: 10, hp: 2, sup: 0.25, fuel: 5, train: 180, need: 'mtank1', bonus: { brk: 0.15 }, cls: 'arm', terr: { forest: -0.3, hills: -0.1, mountain: -0.2, marsh: -0.1, jungle: -0.4, urban: -0.4, river: -0.2, amphib: -0.8 } },
  ht: { name: '중전차', short: '중전차', icon: 'tank', mp: 500, eq: { htank: 40 }, w: 2, org: 10, hp: 2, sup: 0.32, fuel: 6, train: 180, need: 'htank1', bonus: { brk: 0.15 }, cls: 'arm', terr: { forest: -0.4, hills: -0.2, mountain: -0.3, marsh: -0.4, jungle: -0.6, urban: -0.5, river: -0.4, amphib: -0.9 } },
};
export const BAT_KEYS = Object.keys(BATTALIONS);

// 지원 중대 (전장 너비 0). st: 고정 능력치, eqst: 장비 능력치 배율
export const SUPPORT = {
  eng: { name: '공병 중대', short: '공병', icon: 'eng', mp: 300, eq: { sup_eq: 30, inf_eq: 10 }, org: 20, hp: 2, st: { sa: 3, def: 24, brk: 4.5 }, mods: { entrench: 2, terrDef: 0.25 } },
  rec: { name: '정찰 중대', short: '정찰', icon: 'rec', mp: 500, eq: { inf_eq: 40, sup_eq: 10 }, org: 20, hp: 2, st: { sa: 0.6, def: 11, brk: 1.5 }, mods: { initiative: 0.2, artAtk: 0.1 } },
  sart: { name: '지원 포병', short: '지원포병', icon: 'art', mp: 300, eq: { art: 12 }, org: 0, hp: 0.2, eqst: { art: 0.6 } },
  sat: { name: '지원 대전차', short: '지원대전차', icon: 'at', mp: 300, eq: { at: 24 }, org: 0, hp: 0.2, eqst: { at: 0.5 }, prcMult: 0.85 },
  saa: { name: '지원 대공', short: '지원대공', icon: 'aa', mp: 300, eq: { aa: 20 }, org: 0, hp: 0.2, eqst: { aa: 0.6 } },
  logi: { name: '군수 중대', short: '군수', icon: 'logi', mp: 500, eq: { sup_eq: 20, mot: 10 }, org: 10, hp: 1, mods: { supply: -0.1, fuel: -0.05 }, need: 'logistics' },
  hosp: { name: '야전 병원', short: '야전병원', icon: 'hosp', mp: 500, eq: { sup_eq: 30, mot: 20 }, org: 20, hp: 2, mods: { casualty: -0.2 }, need: 'fieldHospital' },
  sig: { name: '통신 중대', short: '통신', icon: 'sig', mp: 500, eq: { sup_eq: 20, mot: 10 }, org: 20, hp: 1, mods: { initiative: 0.3, reinforce: 0.1 }, need: 'signal' },
};
export const SUP_KEYS = Object.keys(SUPPORT);

// 비행단 임무와 항공기 유형
export const AIR_TYPES = {
  fighter: { name: '전투기', range: 700, mission: ['sup', 'none'], icon: 'fighter' },
  cas: { name: '근접 항공 지원기', range: 600, mission: ['cas', 'none'], icon: 'cas' },
  tac: { name: '전술 폭격기', range: 1100, mission: ['cas', 'bomb', 'none'], icon: 'bomber' },
};
export const AIR_MISSIONS = { sup: '제공권 장악', cas: '근접 항공 지원', bomb: '전략 폭격', none: '대기' };

// 지형 — 전장 너비는 주(州) 단위 전투이므로 HOI4 지방 너비의 1.5배
export const TERRAIN = {
  plains: { name: '평야', width: 105, extra: 52, atk: 0, move: 1.0, attr: 0, color: '#c2b77e' },
  forest: { name: '숲', width: 90, extra: 45, atk: -0.15, move: 1.5, attr: 0, color: '#5f7d4a' },
  hills: { name: '언덕', width: 105, extra: 52, atk: -0.25, move: 1.5, attr: 0, color: '#a68f5f' },
  mountain: { name: '산', width: 75, extra: 37, atk: -0.5, move: 2.0, attr: 0.3, color: '#8d7f70' },
  marsh: { name: '습지', width: 75, extra: 37, atk: -0.4, move: 2.0, attr: 0.35, color: '#6b8a7a' },
  desert: { name: '사막', width: 105, extra: 52, atk: 0, move: 1.05, attr: 0.15, color: '#d8c08c' },
  urban: { name: '도시', width: 120, extra: 60, atk: -0.3, move: 1.2, attr: 0, color: '#8f8f8f' },
  jungle: { name: '정글', width: 90, extra: 45, atk: -0.3, move: 1.5, attr: 0.2, color: '#3f6f3a' },
};

// 기본 사단 편제
export const DEFAULT_TEMPLATES = [
  { key: 'inf9', name: '보병 사단', bats: { inf: 9 }, sup: ['eng'] },
  { key: 'inf72', name: '포병 보강 보병 사단', bats: { inf: 7, art: 2 }, sup: ['eng', 'rec'] },
  { key: 'mtn', name: '산악 사단', bats: { mtn: 6 }, sup: ['eng'] },
  { key: 'cav', name: '기병 사단', bats: { cav: 6 }, sup: [] },
  { key: 'mot', name: '차량화 사단', bats: { mot: 6 }, sup: ['eng'] },
  { key: 'arm', name: '기갑 사단', bats: { lt: 4, mot: 3 }, sup: ['eng', 'rec'] },
  { key: 'gar', name: '수비 사단', bats: { inf: 5 }, sup: [] },
];

// 기술 트리. cost: 1 = 기본 100일, year: 해당 연도 이전 연구 시 연도당 +100% 시간
// fx: { eq: {장비: 등급}, unlock: [...], mods: {...}, rslot: n, desc }
export const TECH_CATS = [
  { key: 'inf', name: '보병', icon: 'inf' },
  { key: 'sup', name: '지원', icon: 'eng' },
  { key: 'arm', name: '기갑', icon: 'tank' },
  { key: 'art', name: '포병', icon: 'art' },
  { key: 'air', name: '공군', icon: 'fighter' },
  { key: 'nav', name: '해군', icon: 'ship' },
  { key: 'ind', name: '산업', icon: 'factory' },
  { key: 'ele', name: '전자', icon: 'radio' },
  { key: 'land', name: '지상 교리', icon: 'doctrine' },
  { key: 'navd', name: '해상 교리', icon: 'anchor' },
  { key: 'aird', name: '항공 교리', icon: 'wing' },
];

export const TECHS = [
  // ── 보병 ──
  { id: 'inf_eq1', cat: 'inf', name: '보병 장비 I', year: 1918, cost: 1, fx: { eq: { inf_eq: 1 } } },
  { id: 'inf_eq2', cat: 'inf', name: '보병 장비 II', year: 1939, cost: 1.5, req: ['inf_eq1'], fx: { eq: { inf_eq: 2 } }, desc: '반자동 소총과 경기관총 보급으로 보병의 화력과 방어가 크게 향상된다.' },
  { id: 'inf_eq3', cat: 'inf', name: '보병 장비 III', year: 1942, cost: 1.75, req: ['inf_eq2'], fx: { eq: { inf_eq: 3 } }, desc: '돌격소총과 휴대용 대전차 무기.' },
  { id: 'sup_eq', cat: 'inf', name: '지원 장비', year: 1934, cost: 1, fx: { unlock: ['support'] } },
  { id: 'motorized', cat: 'inf', name: '차량화 보병', year: 1936, cost: 1.25, req: ['sup_eq'], fx: { unlock: ['motorized'] }, desc: '트럭으로 이동하는 차량화 보병 대대를 편성할 수 있다.' },
  { id: 'mechanized', cat: 'inf', name: '기계화 보병', year: 1940, cost: 1.75, req: ['motorized'], fx: { unlock: ['mechanized'], eq: { mech: 1 } } },
  { id: 'mech2', cat: 'inf', name: '개량 장갑차', year: 1942, cost: 1.75, req: ['mechanized'], fx: { eq: { mech: 2 } } },
  { id: 'mountaineers', cat: 'inf', name: '산악병', year: 1936, cost: 1, req: ['sup_eq'], fx: { unlock: ['mountaineers'] } },
  { id: 'marines', cat: 'inf', name: '해병대', year: 1936, cost: 1, req: ['sup_eq'], fx: { unlock: ['marines'] } },
  { id: 'paratroopers', cat: 'inf', name: '공수부대', year: 1938, cost: 1.25, req: ['sup_eq'], fx: { unlock: ['paratroopers'] } },
  { id: 'night_vision', cat: 'inf', name: '보병 전술 개량', year: 1940, cost: 1.5, req: ['inf_eq2'], fx: { mods: { 'inf.atk': 0.1, 'inf.def': 0.05 } } },

  // ── 지원 ──
  { id: 'engineers', cat: 'sup', name: '공병', year: 1934, cost: 1, fx: { unlock: ['eng'] } },
  { id: 'recon', cat: 'sup', name: '정찰 중대', year: 1934, cost: 1, fx: { unlock: ['rec'] } },
  { id: 'fieldHospital', cat: 'sup', name: '야전 병원', year: 1938, cost: 1, req: ['engineers'], fx: { unlock: ['fieldHospital'] } },
  { id: 'logistics', cat: 'sup', name: '군수 중대', year: 1938, cost: 1, req: ['engineers'], fx: { unlock: ['logistics'] } },
  { id: 'signal', cat: 'sup', name: '통신 중대', year: 1939, cost: 1, req: ['recon'], fx: { unlock: ['signal'] } },
  { id: 'eng2', cat: 'sup', name: '개량 공병 장비', year: 1940, cost: 1.25, req: ['engineers'], fx: { mods: { 'land.entrench': 0.15, 'land.def': 0.03 } } },

  // ── 기갑 ──
  { id: 'ltank1', cat: 'arm', name: '경전차 I', year: 1934, cost: 1, fx: { eq: { ltank: 1 } } },
  { id: 'ltank2', cat: 'arm', name: '경전차 II', year: 1937, cost: 1.25, req: ['ltank1'], fx: { eq: { ltank: 2 } } },
  { id: 'ltank3', cat: 'arm', name: '경전차 III', year: 1940, cost: 1.5, req: ['ltank2'], fx: { eq: { ltank: 3 } } },
  { id: 'mtank1', cat: 'arm', name: '중형 전차 I', year: 1938, cost: 1.5, req: ['ltank2'], fx: { eq: { mtank: 1 }, unlock: ['mtank1'] }, desc: '3호·4호 전차, T-34의 시대를 여는 중형 전차.' },
  { id: 'mtank2', cat: 'arm', name: '중형 전차 II', year: 1941, cost: 1.75, req: ['mtank1'], fx: { eq: { mtank: 2 } } },
  { id: 'mtank3', cat: 'arm', name: '중형 전차 III', year: 1943, cost: 2, req: ['mtank2'], fx: { eq: { mtank: 3 } } },
  { id: 'htank1', cat: 'arm', name: '중전차 I', year: 1939, cost: 1.5, req: ['mtank1'], fx: { eq: { htank: 1 }, unlock: ['htank1'] } },
  { id: 'htank2', cat: 'arm', name: '중전차 II', year: 1941, cost: 1.75, req: ['htank1'], fx: { eq: { htank: 2 } } },
  { id: 'htank3', cat: 'arm', name: '중전차 III', year: 1943, cost: 2, req: ['htank2'], fx: { eq: { htank: 3 } } },

  // ── 포병 ──
  { id: 'art1', cat: 'art', name: '야포 I', year: 1934, cost: 1, fx: { eq: { art: 1 } } },
  { id: 'art2', cat: 'art', name: '야포 II', year: 1940, cost: 1.5, req: ['art1'], fx: { eq: { art: 2 } } },
  { id: 'art3', cat: 'art', name: '야포 III', year: 1942, cost: 1.75, req: ['art2'], fx: { eq: { art: 3 } } },
  { id: 'at1', cat: 'art', name: '대전차포 I', year: 1934, cost: 1, fx: { eq: { at: 1 } } },
  { id: 'at2', cat: 'art', name: '대전차포 II', year: 1940, cost: 1.25, req: ['at1'], fx: { eq: { at: 2 } } },
  { id: 'at3', cat: 'art', name: '대전차포 III', year: 1943, cost: 1.5, req: ['at2'], fx: { eq: { at: 3 } } },
  { id: 'aa1', cat: 'art', name: '대공포 I', year: 1934, cost: 1, fx: { eq: { aa: 1 } } },
  { id: 'aa2', cat: 'art', name: '대공포 II', year: 1940, cost: 1.25, req: ['aa1'], fx: { eq: { aa: 2 } } },
  { id: 'aa3', cat: 'art', name: '대공포 III', year: 1943, cost: 1.5, req: ['aa2'], fx: { eq: { aa: 3 } } },

  // ── 공군 ──
  { id: 'fighter1', cat: 'air', name: '전투기 I', year: 1933, cost: 1, fx: { eq: { fighter: 1 } } },
  { id: 'fighter2', cat: 'air', name: '전투기 II', year: 1938, cost: 1.5, req: ['fighter1'], fx: { eq: { fighter: 2 } }, desc: 'Bf 109E, 스핏파이어급 단엽 전투기.' },
  { id: 'fighter3', cat: 'air', name: '전투기 III', year: 1942, cost: 1.75, req: ['fighter2'], fx: { eq: { fighter: 3 } } },
  { id: 'cas1', cat: 'air', name: 'CAS I', year: 1936, cost: 1, fx: { eq: { cas: 1 } } },
  { id: 'cas2', cat: 'air', name: 'CAS II', year: 1939, cost: 1.5, req: ['cas1'], fx: { eq: { cas: 2 } } },
  { id: 'cas3', cat: 'air', name: 'CAS III', year: 1942, cost: 1.75, req: ['cas2'], fx: { eq: { cas: 3 } } },
  { id: 'tac1', cat: 'air', name: '전술 폭격기 I', year: 1936, cost: 1, fx: { eq: { tac: 1 } } },
  { id: 'tac2', cat: 'air', name: '전술 폭격기 II', year: 1940, cost: 1.5, req: ['tac1'], fx: { eq: { tac: 2 } } },
  { id: 'tac3', cat: 'air', name: '전술 폭격기 III', year: 1943, cost: 1.75, req: ['tac2'], fx: { eq: { tac: 3 } } },
  { id: 'radar', cat: 'air', name: '레이더 방공망', year: 1939, cost: 1.5, req: ['radio'], fx: { mods: { 'air.def': 0.1, 'air.agi': 0.05 } } },

  // ── 해군 ──
  { id: 'dd1', cat: 'nav', name: '구축함', year: 1922, cost: 1, fx: { unlock: ['dd'] } },
  { id: 'ss1', cat: 'nav', name: '잠수함', year: 1922, cost: 1, fx: { unlock: ['ss'] } },
  { id: 'cl1', cat: 'nav', name: '경순양함', year: 1922, cost: 1, fx: { unlock: ['cl'] } },
  { id: 'ca1', cat: 'nav', name: '중순양함', year: 1922, cost: 1, req: ['cl1'], fx: { unlock: ['ca'] } },
  { id: 'bb1', cat: 'nav', name: '전함', year: 1922, cost: 1, req: ['ca1'], fx: { unlock: ['bb'] } },
  { id: 'cv1', cat: 'nav', name: '항공모함', year: 1924, cost: 1.25, req: ['cl1'], fx: { unlock: ['cv'] } },
  { id: 'ss2', cat: 'nav', name: '개량 잠수함', year: 1940, cost: 1.5, req: ['ss1'], fx: { mods: { 'sub.atk': 0.25 } } },
  { id: 'nav2', cat: 'nav', name: '근대화 함정', year: 1940, cost: 1.75, req: ['dd1', 'cl1'], fx: { mods: { 'navy.atk': 0.15, 'navy.def': 0.15 } } },
  { id: 'nav3', cat: 'nav', name: '함대 방공 개량', year: 1943, cost: 2, req: ['nav2'], fx: { mods: { 'navy.def': 0.2, 'navy.atk': 0.1 } } },

  // ── 산업 ──
  { id: 'tools1', cat: 'ind', name: '기초 공작 기계', year: 1936, cost: 1, fx: { mods: { prodEffCap: 0.1 } }, desc: '생산 효율 상한 +10%' },
  { id: 'tools2', cat: 'ind', name: '개량 공작 기계', year: 1939, cost: 1.5, req: ['tools1'], fx: { mods: { prodEffCap: 0.1, prodEffGain: 0.1 } } },
  { id: 'tools3', cat: 'ind', name: '첨단 공작 기계', year: 1941, cost: 1.75, req: ['tools2'], fx: { mods: { prodEffCap: 0.1, prodEffGain: 0.1 } } },
  { id: 'conc1', cat: 'ind', name: '집중 산업', year: 1936, cost: 1.25, excl: 'industry', fx: { mods: { factoryOutput: 0.1 } }, desc: '군수 공장 산출 +10%' },
  { id: 'conc2', cat: 'ind', name: '집중 산업 II', year: 1938, cost: 1.5, req: ['conc1'], fx: { mods: { factoryOutput: 0.1 } } },
  { id: 'conc3', cat: 'ind', name: '집중 산업 III', year: 1941, cost: 1.75, req: ['conc2'], fx: { mods: { factoryOutput: 0.1 } } },
  { id: 'disp1', cat: 'ind', name: '분산 산업', year: 1936, cost: 1.25, excl: 'industry', fx: { mods: { factoryOutput: 0.05, prodEffGain: 0.2, slots: 0.1 } }, desc: '공습에 강하고 건설 슬롯이 늘어난다.' },
  { id: 'disp2', cat: 'ind', name: '분산 산업 II', year: 1938, cost: 1.5, req: ['disp1'], fx: { mods: { factoryOutput: 0.05, prodEffGain: 0.2, slots: 0.1 } } },
  { id: 'disp3', cat: 'ind', name: '분산 산업 III', year: 1941, cost: 1.75, req: ['disp2'], fx: { mods: { factoryOutput: 0.05, prodEffGain: 0.2, slots: 0.1 } } },
  { id: 'cons1', cat: 'ind', name: '건설 공학 I', year: 1936, cost: 1, fx: { mods: { construction: 0.1, slots: 0.1 } }, desc: '건설 속도 +10%, 건설 슬롯 +10%' },
  { id: 'cons2', cat: 'ind', name: '건설 공학 II', year: 1938, cost: 1.25, req: ['cons1'], fx: { mods: { construction: 0.1, slots: 0.1 } } },
  { id: 'cons3', cat: 'ind', name: '건설 공학 III', year: 1940, cost: 1.5, req: ['cons2'], fx: { mods: { construction: 0.1, slots: 0.1 } } },
  { id: 'cons4', cat: 'ind', name: '건설 공학 IV', year: 1942, cost: 1.75, req: ['cons3'], fx: { mods: { construction: 0.1, slots: 0.1 } } },
  { id: 'synth', cat: 'ind', name: '합성 석유', year: 1936, cost: 1.25, fx: { unlock: ['refinery'] }, desc: '합성 정유소(석유·고무 생산)를 건설할 수 있다.' },
  { id: 'excav1', cat: 'ind', name: '채굴 기술 I', year: 1937, cost: 1, fx: { mods: { resources: 0.1 } } },
  { id: 'excav2', cat: 'ind', name: '채굴 기술 II', year: 1940, cost: 1.25, req: ['excav1'], fx: { mods: { resources: 0.1 } } },
  { id: 'fuel1', cat: 'ind', name: '연료 저장 시설', year: 1937, cost: 1, fx: { mods: { fuelCap: 0.5, fuelGain: 0.1 } } },

  // ── 전자 ──
  { id: 'radio', cat: 'ele', name: '무선 통신', year: 1936, cost: 1, fx: { mods: { 'land.org': 0.03 } } },
  { id: 'comp1', cat: 'ele', name: '전기 기계식 계산기', year: 1937, cost: 1.25, req: ['radio'], fx: { mods: { research: 0.03 } } },
  { id: 'comp2', cat: 'ele', name: '전자 계산기', year: 1940, cost: 1.75, req: ['comp1'], fx: { mods: { research: 0.03 }, rslot: 1 }, desc: '연구 슬롯 +1' },
  { id: 'crypto', cat: 'ele', name: '암호 해독', year: 1939, cost: 1.5, req: ['comp1'], fx: { mods: { 'land.def': 0.03, 'land.atk': 0.03 } } },

  // ── 지상 교리 ── (네 갈래 중 하나만 선택)
  { id: 'mw1', cat: 'land', name: '기동전: 전격전', year: 1936, cost: 1.5, excl: 'land', fx: { mods: { 'arm.atk': 0.1, 'land.speed': 0.05, 'land.brk': 0.05 } }, desc: '기갑·차량화 부대 중심의 돌파와 포위.' },
  { id: 'mw2', cat: 'land', name: '기동전: 기동 보병', year: 1938, cost: 1.75, req: ['mw1'], fx: { mods: { 'land.org': 0.05, 'mot.atk': 0.1 } } },
  { id: 'mw3', cat: 'land', name: '기동전: 종심 돌파', year: 1940, cost: 2, req: ['mw2'], fx: { mods: { 'arm.atk': 0.1, 'land.brk': 0.1, 'land.speed': 0.05 } } },
  { id: 'mw4', cat: 'land', name: '기동전: 임무형 지휘', year: 1942, cost: 2.25, req: ['mw3'], fx: { mods: { 'land.org': 0.1, 'land.recovery': 0.15 } } },
  { id: 'sf1', cat: 'land', name: '우월 화력: 화력 집중', year: 1936, cost: 1.5, excl: 'land', fx: { mods: { 'art.atk': 0.15, 'land.def': 0.03 } }, desc: '포병과 지원 화력으로 적을 갈아낸다.' },
  { id: 'sf2', cat: 'land', name: '우월 화력: 탄막 사격', year: 1938, cost: 1.75, req: ['sf1'], fx: { mods: { 'art.atk': 0.1, 'land.atk': 0.05 } } },
  { id: 'sf3', cat: 'land', name: '우월 화력: 공지 협동', year: 1940, cost: 2, req: ['sf2'], fx: { mods: { 'cas.dmg': 0.2, 'land.atk': 0.05 } } },
  { id: 'sf4', cat: 'land', name: '우월 화력: 기계화 화력', year: 1942, cost: 2.25, req: ['sf3'], fx: { mods: { 'art.atk': 0.1, 'land.def': 0.1 } } },
  { id: 'gb1', cat: 'land', name: '대전투 계획: 참호 방어', year: 1936, cost: 1.5, excl: 'land', fx: { mods: { 'land.planning': 0.1, 'land.entrench': 0.2, 'inf.def': 0.05 } }, desc: '치밀한 계획과 견고한 방어선.' },
  { id: 'gb2', cat: 'land', name: '대전투 계획: 작전 계획', year: 1938, cost: 1.75, req: ['gb1'], fx: { mods: { 'land.planning': 0.1, 'land.def': 0.05 } } },
  { id: 'gb3', cat: 'land', name: '대전투 계획: 정보 전쟁', year: 1940, cost: 2, req: ['gb2'], fx: { mods: { 'land.atk': 0.05, 'land.def': 0.05, 'land.org': 0.05 } } },
  { id: 'gb4', cat: 'land', name: '대전투 계획: 종합 작전', year: 1942, cost: 2.25, req: ['gb3'], fx: { mods: { 'land.planning': 0.15, 'land.atk': 0.05, 'land.def': 0.05 } } },
  { id: 'ma1', cat: 'land', name: '인해전술: 대규모 동원', year: 1936, cost: 1.5, excl: 'land', fx: { mods: { manpower: 0.1, 'inf.atk': 0.05, 'land.reinforce': 0.1 } }, desc: '압도적인 병력으로 적을 압도한다.' },
  { id: 'ma2', cat: 'land', name: '인해전술: 종심 작전', year: 1938, cost: 1.75, req: ['ma1'], fx: { mods: { 'width.pen': -0.25, 'land.recovery': 0.1 } } },
  { id: 'ma3', cat: 'land', name: '인해전술: 전투 동원', year: 1940, cost: 2, req: ['ma2'], fx: { mods: { manpower: 0.15, 'inf.def': 0.1 } } },
  { id: 'ma4', cat: 'land', name: '인해전술: 끝없는 진격', year: 1942, cost: 2.25, req: ['ma3'], fx: { mods: { 'inf.atk': 0.1, 'land.reinforce': 0.15, 'land.org': 0.05 } } },

  // ── 해상 교리 ──
  { id: 'fib1', cat: 'navd', name: '함대 결전', year: 1936, cost: 1.5, excl: 'naval', fx: { mods: { 'navy.atk': 0.1, 'navy.def': 0.05 } } },
  { id: 'fib2', cat: 'navd', name: '주력 함대 교리', year: 1940, cost: 2, req: ['fib1'], fx: { mods: { 'navy.atk': 0.15, 'navy.def': 0.1 } } },
  { id: 'td1', cat: 'navd', name: '통상 파괴', year: 1936, cost: 1.5, excl: 'naval', fx: { mods: { 'sub.atk': 0.2 } } },
  { id: 'td2', cat: 'navd', name: '이리떼 전술', year: 1940, cost: 2, req: ['td1'], fx: { mods: { 'sub.atk': 0.3, 'sub.def': 0.2 } } },

  // ── 항공 교리 ──
  { id: 'asup1', cat: 'aird', name: '제공권 우선', year: 1936, cost: 1.5, excl: 'air', fx: { mods: { 'air.atk': 0.1, 'air.agi': 0.05 } } },
  { id: 'asup2', cat: 'aird', name: '요격 전술', year: 1940, cost: 2, req: ['asup1'], fx: { mods: { 'air.atk': 0.15, 'air.def': 0.1 } } },
  { id: 'bmb1', cat: 'aird', name: '전략 폭격', year: 1936, cost: 1.5, excl: 'air', fx: { mods: { 'bomb.dmg': 0.25, 'air.def': 0.05 } } },
  { id: 'bmb2', cat: 'aird', name: '융단 폭격', year: 1940, cost: 2, req: ['bmb1'], fx: { mods: { 'bomb.dmg': 0.3, 'air.def': 0.1 } } },
  { id: 'bat1', cat: 'aird', name: '전장 항공 지원', year: 1936, cost: 1.5, excl: 'air', fx: { mods: { 'cas.dmg': 0.2 } } },
  { id: 'bat2', cat: 'aird', name: '급강하 폭격 전술', year: 1940, cost: 2, req: ['bat1'], fx: { mods: { 'cas.dmg': 0.25, 'air.agi': 0.05 } } },
];

export const TECH = Object.fromEntries(TECHS.map((t) => [t.id, t]));

// 시작 기술 묶음
export const TECH_SETS = {
  base: ['inf_eq1', 'sup_eq', 'engineers', 'recon', 'art1', 'at1', 'aa1', 'dd1', 'cl1', 'ss1', 'fighter1'],
  major: ['inf_eq1', 'sup_eq', 'engineers', 'recon', 'art1', 'at1', 'aa1', 'dd1', 'cl1', 'ca1', 'bb1', 'ss1', 'fighter1', 'ltank1', 'cas1', 'tac1', 'motorized', 'mountaineers', 'marines', 'radio'],
};

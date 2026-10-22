// 프랑스 국가 중점
export const FRA = [
  // ── 산업 ──
  { id: 'fra_nationalize', name: '군수 산업 국유화', icon: 'mil', x: 1, y: 0, ai: 4,
    fx: [['mil', 3]], desc: '1936년 8월 국유화법으로 슈네데르 등 주요 군수 공장을 국가가 인수했다.' },
  { id: 'fra_public', name: '공공 사업', icon: 'civ', x: 0, y: 1, req: ['fra_nationalize'],
    fx: [['civ', 3]], desc: '불황 탈출을 위한 공공 사업에 투자한다.' },
  { id: 'fra_aero', name: '항공 산업 국유화', icon: 'fighter', x: 2, y: 1, req: ['fra_nationalize'],
    fx: [['equip', 'fighter', 150], ['rbonus', 'air', 0.5, 1]], desc: '1936년 피에르 코의 항공 산업 국유화로 국영 항공기 회사들이 생겼다.' },
  { id: 'fra_cnrs', name: '국립 과학 연구 센터', icon: 'research', x: 1, y: 2, req: [['fra_public', 'fra_aero']], days: 98,
    fx: [['rslot', 1]], desc: '1939년 설립된 CNRS로 과학 연구를 하나로 묶는다.' },
  { id: 'fra_colonies', name: '식민지 동원', icon: 'globe', x: 0, y: 3, req: ['fra_cnrs'],
    fx: [['offmapAdd', 'civ', 2], ['manpower', 200000], ['units', [['inf9', 3, 'alger']]]], desc: '북아프리카와 서아프리카 식민지에서 병력과 자원을 끌어온다.' },
  { id: 'fra_rearm', name: '재무장 계획', icon: 'industry', x: 2, y: 3, req: ['fra_cnrs'],
    avail: [['tension', 0.25]], availText: '세계 긴장도 25% 이상',
    fx: [['mil', 4], ['law', 'economy', 'early']], desc: '1936년 9월 140억 프랑 규모의 4개년 재무장 계획.' },

  // ── 정치 ──
  { id: 'fra_popular', name: '인민전선', icon: 'people', x: 5, y: 0, excl: ['fra_national'], days: 21, ai: 15, aiIf: [['after', '1936-05-14']],
    fx: [['gov', { leader: '레옹 블룸', title: '총리', party: '인민전선 (사회당)' }], ['stab', 0.05], ['ideology', 'com', 0.03], ['civ', 1]],
    desc: '1936년 6월 4일 레옹 블룸의 인민전선 정부가 들어섰다. 마티뇽 협정, 주 40시간제, 유급 휴가.' },
  { id: 'fra_national', name: '국민 연합', icon: 'flag', x: 7, y: 0, excl: ['fra_popular'], ai: 1,
    fx: [['ws', 0.05], ['mil', 1]], desc: '우파 연합이 정권을 잡아 질서와 국방을 앞세운다.' },
  { id: 'fra_matignon', name: '마티뇽 협정', icon: 'handshake', x: 5, y: 1, req: ['fra_popular'],
    fx: [['stab', 0.08], ['rmSpirit', 'fra_disjointed']], desc: '총파업을 끝낸 노사 협약. 정국이 잠시 안정된다.' },
  { id: 'fra_order', name: '공화국 수호', icon: 'shield', x: 7, y: 1, req: ['fra_national'],
    fx: [['stab', 0.05], ['rmSpirit', 'fra_disjointed']], desc: '극좌·극우 단체를 해산하고 정부를 안정시킨다.' },
  { id: 'fra_daladier', name: '달라디에 내각', icon: 'star', x: 6, y: 2, req: [['fra_matignon', 'fra_order']], days: 14, ai: 15, aiIf: [['after', '1938-03-27']],
    fx: [['gov', { leader: '에두아르 달라디에', title: '총리', party: '급진당' }], ['pp', 50], ['law', 'economy', 'partial']],
    desc: '1938년 4월 달라디에가 총리가 되었다. 뮌헨 협정에 서명했지만 재무장을 서둘렀다.' },
  { id: 'fra_reynaud', name: '레노 내각', icon: 'star', x: 6, y: 3, req: ['fra_daladier'], days: 14, ai: 15, aiIf: [['after', '1940-03-07']],
    avail: [['atWar', 'FRA', 'GER']], availText: '독일과 전쟁 중',
    fx: [['gov', { leader: '폴 레노', title: '총리', party: '민주동맹' }], ['ws', 0.1], ['law', 'economy', 'war']], desc: '1940년 3월 21일 강경파 폴 레노가 총리가 되었다.' },

  // ── 육군 ──
  { id: 'fra_army', name: '육군 개혁', icon: 'army', x: 10, y: 0, ai: 3,
    fx: [['rbonus', 'land', 0.5, 1]], desc: '참모본부의 교리와 장비를 손본다.' },
  { id: 'fra_maginot', name: '마지노선 연장', icon: 'fort', x: 9, y: 1, req: ['fra_army'],
    fx: [['fort', 3, 'lille'], ['fort', 2, 'champagne'], ['fort', 2, 'picardie']], desc: '벨기에 국경 쪽으로 요새선을 잇는다. 아르덴 숲은 기갑 부대가 지날 수 없다고 여겼다.' },
  { id: 'fra_degaulle', name: '드골의 기갑 사단', icon: 'tank', x: 11, y: 1, req: ['fra_army'],
    fx: [['rmSpirit', 'fra_maginot'], ['rbonus', 'arm', 0.75, 2], ['units', [['arm', 1, 'champagne']]]], desc: '1934년 드골 대령은 『직업 군대를 향하여』에서 기갑 사단을 주장했다.' },
  { id: 'fra_reserves', name: '예비군 동원 체계', icon: 'manpower', x: 10, y: 2, req: [['fra_maginot', 'fra_degaulle']],
    fx: [['manpower', 300000], ['law', 'conscription', 'extensive']], desc: '예비군을 빨리 소집할 수 있도록 동원 체계를 정비한다.' },
  { id: 'fra_artillery', name: '포병 우세', icon: 'art', x: 10, y: 3, req: ['fra_reserves'],
    fx: [['rbonus', 'art', 0.75, 2]], desc: '1차 대전 승리의 원동력이었던 포병을 현대화한다.' },

  // ── 해군 ──
  { id: 'fra_navy', name: '해군 현대화', icon: 'ship', x: 13, y: 0,
    fx: [['dock', 2], ['mods', { 'navy.atk': 0.05 }]], desc: '다를랑 제독이 키운 유럽 4위의 함대.' },
  { id: 'fra_richelieu', name: '리슐리외급 전함', icon: 'ship', x: 13, y: 1, req: ['fra_navy'],
    fx: [['dock', 2], ['rbonus', 'nav', 0.5, 1]], desc: '3만 5천 톤급 신형 전함.' },

  // ── 외교 ──
  { id: 'fra_entente', name: '영불 협상 강화', icon: 'flag', x: 15, y: 0, ai: 3,
    fx: [['ws', 0.05], ['pp', 25]], desc: '영국과의 군사 협력을 굳힌다.' },
  { id: 'fra_little', name: '소협상 지원', icon: 'handshake', x: 14, y: 1, req: ['fra_entente'], ai: 0,
    fx: [['guarantee', 'CZE'], ['guarantee', 'ROM'], ['guarantee', 'YUG']], desc: '체코슬로바키아·루마니아·유고슬라비아의 소협상을 프랑스가 지켜 준다.' },
  { id: 'fra_soviet', name: '불소 상호 원조', icon: 'handshake', x: 16, y: 1, req: ['fra_entente'], ai: 0.2,
    fx: [['nap', 'SOV']], desc: '1935년 서명한 프랑스-소련 상호 원조 조약을 실제 군사 협력으로 이어 간다.' },
];

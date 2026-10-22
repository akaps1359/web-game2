// 법률 · 고문 · 국가 정신 · 결정
// mods 키 설명은 js/engine/mods.js 참고

export const LAW_GROUPS = {
  conscription: {
    name: '징병법',
    order: ['disarmed', 'volunteer', 'limited', 'extensive', 'service', 'alladults', 'scraping'],
    laws: {
      disarmed: { name: '비무장 국가', mp: 0.01, mods: { factoryOutput: 0.05, training: -0.1 } },
      volunteer: { name: '지원병제', mp: 0.015, mods: {} },
      limited: { name: '제한적 징병', mp: 0.025, mods: {} },
      extensive: { name: '확대 징병', mp: 0.05, mods: { factoryOutput: -0.03 }, req: { ws: 0.4 } },
      service: { name: '의무 복무', mp: 0.1, mods: { factoryOutput: -0.07, training: 0.1 }, req: { ws: 0.6 } },
      alladults: { name: '전 국민 복무', mp: 0.2, mods: { factoryOutput: -0.14, training: 0.2, stability: -0.05 }, req: { ws: 0.8, war: 1 } },
      scraping: { name: '최후의 동원', mp: 0.25, mods: { factoryOutput: -0.3, training: 0.3, stability: -0.1, 'land.atk': -0.05 }, req: { ws: 0.9, war: 1 } },
    },
  },
  economy: {
    name: '경제법',
    order: ['isolation', 'civilian', 'early', 'partial', 'war', 'total'],
    laws: {
      isolation: { name: '고립 경제', cg: 0.4, mods: { construction: -0.3, 'milfac.cost': 0.4 } },
      civilian: { name: '민간 경제', cg: 0.35, mods: { construction: -0.3, 'milfac.cost': 0.3 } },
      early: { name: '초기 동원', cg: 0.3, mods: { construction: 0.0, 'milfac.cost': 0.1 }, req: { tension: 0.1, nonDemTension: 0 } },
      partial: { name: '부분 동원', cg: 0.25, mods: { construction: 0.1, 'milfac.cost': -0.1 }, req: { tension: 0.25, demTension: 0.4 } },
      war: { name: '전시 경제', cg: 0.2, mods: { construction: 0.2, 'milfac.cost': -0.2, stability: -0.05 }, req: { tension: 0.5, ws: 0.4, warOrFas: 1 } },
      total: { name: '총력전 경제', cg: 0.1, mods: { construction: 0.2, 'milfac.cost': -0.3, stability: -0.15, manpower: -0.05 }, req: { ws: 0.8, war: 1 } },
    },
  },
  trade: {
    name: '무역법',
    order: ['free', 'export', 'limited', 'closed'],
    laws: {
      free: { name: '자유 무역', exp: 0.8, mods: { research: 0.05, construction: 0.1, prodEffGain: 0.1 } },
      export: { name: '수출 중시', exp: 0.5, mods: { research: 0.03, construction: 0.05, prodEffGain: 0.05 } },
      limited: { name: '수출 제한', exp: 0.25, mods: {} },
      closed: { name: '폐쇄 경제', exp: 0, mods: { construction: -0.05, research: -0.05 } },
    },
  },
};
export const LAW_COST = 150;

// 고문 역할(국가별 이름은 countries.js에서 지정, 없으면 역할 이름 사용)
export const ADVISOR_ROLES = {
  propaganda: { name: '선전 장관', slot: 'pol', mods: { 'warSupport.target': 0.12, ppFactor: 0.05 }, desc: '전쟁 지지도 +12% (목표치)' },
  security: { name: '내무 장관', slot: 'pol', mods: { 'stability.target': 0.1 }, desc: '안정도 +10% (목표치)' },
  economy: { name: '경제 장관', slot: 'pol', mods: { consumerGoods: -0.05, construction: 0.05 }, desc: '소비재 -5%, 건설 속도 +5%' },
  armament: { name: '군수 장관', slot: 'pol', mods: { factoryOutput: 0.1, prodEffGain: 0.1 }, desc: '군수 공장 산출 +10%' },
  construction: { name: '건설 장관', slot: 'pol', mods: { construction: 0.15 }, desc: '건설 속도 +15%' },
  workhorse: { name: '정무 실장', slot: 'pol', mods: { pp: 0.15 }, desc: '정치력 +0.15/일' },
  diplomat: { name: '외무 장관', slot: 'pol', mods: { justify: -0.3, tension: -0.25 }, desc: '정당화 시간 -30%, 긴장도 유발 -25%' },
  science: { name: '과학 고문', slot: 'pol', mods: { research: 0.06 }, desc: '연구 속도 +6%' },
  army: { name: '육군 참모총장', slot: 'army', mods: { 'land.atk': 0.05, 'land.def': 0.05 }, desc: '지상군 공격·방어 +5%' },
  armyOrg: { name: '육군 조직 개혁가', slot: 'army', mods: { 'land.org': 0.08, 'land.recovery': 0.1 }, desc: '조직력 +8%, 회복 +10%' },
  navy: { name: '해군 참모총장', slot: 'navy', mods: { 'navy.atk': 0.1, 'navy.def': 0.05 }, desc: '해군 공격 +10%' },
  air: { name: '공군 참모총장', slot: 'air', mods: { 'air.atk': 0.1, 'air.def': 0.05 }, desc: '공군 공격 +10%' },
};
export const ADVISOR_SLOTS = { pol: 3, army: 1, navy: 1, air: 1 };
export const ADVISOR_COST = 150;

// 국가 정신
export const SPIRITS = {
  // 독일
  ger_rearm: { name: '재군비 선언', mods: { factoryOutput: 0.05, 'milfac.cost': -0.1 }, desc: '1935년 베르사유 조약의 군비 제한을 공식 파기했다.' },
  ger_autarky: { name: '4개년 계획', mods: { 'milfac.cost': -0.1, construction: 0.1, resources: 0.05 } },
  ger_wehrmacht: { name: '독일 국방군', mods: { 'land.org': 0.05, 'land.planning': 0.1 } },
  ger_blitz: { name: '전격전 교리', mods: { 'arm.atk': 0.1, 'land.speed': 0.05 } },
  ger_total: { name: '총력전', mods: { factoryOutput: 0.15, consumerGoods: -0.05 } },
  // 소련
  sov_purge: { name: '대숙청', mods: { 'land.org': -0.15, 'land.atk': -0.1, stability: -0.05, pp: 0.2 }, desc: '스탈린의 숙청으로 장교단이 와해되었다.' },
  sov_plan: { name: '5개년 계획', mods: { construction: 0.1, factoryOutput: 0.05 } },
  sov_winter: { name: '러시아의 겨울', mods: { winter: 0.5 }, hidden: 0 },
  sov_patriotic: { name: '대조국전쟁', mods: { 'land.def': 0.1, manpower: 0.1, stability: 0.1, 'warSupport.target': 0.2 } },
  sov_noretreat: { name: '한 걸음도 물러서지 마라', mods: { 'land.def': 0.15, 'land.atk': -0.05 } },
  // 프랑스
  fra_disjointed: { name: '분열된 정부', mods: { ppFactor: -0.3, stability: -0.05 }, desc: '잦은 내각 교체로 정부가 마비되어 있다.' },
  fra_victors: { name: '1차 대전의 승전국', mods: { 'warSupport.target': -0.15, 'land.def': 0.05 }, desc: '또 다른 대전을 원하는 이는 없다.' },
  fra_maginot: { name: '마지노선 사고방식', mods: { 'land.entrench': 0.2, 'land.atk': -0.05 } },
  // 영국
  eng_empire: { name: '대영 제국', mods: { manpower: 0.25 }, desc: '영연방 자치령과 인도의 병력이 본국을 뒷받침한다.' },
  eng_navy: { name: '바다의 지배자', mods: { 'navy.atk': 0.1, 'navy.def': 0.1 } },
  eng_appease: { name: '유화 정책', mods: { 'warSupport.target': -0.1 } },
  eng_churchill: { name: '피, 수고, 눈물, 그리고 땀', mods: { 'warSupport.target': 0.25, stability: 0.1 } },
  // 이탈리아
  ita_ethiopia: { name: '에티오피아 전쟁', mods: { 'warSupport.target': 0.05, consumerGoods: 0.05 } },
  ita_poor: { name: '불충분한 공업', mods: { factoryOutput: -0.1 } },
  ita_mare: { name: '우리의 바다(마레 노스트룸)', mods: { 'navy.atk': 0.1 } },
  // 미국
  usa_depression: { name: '대공황', mods: { stability: -0.1, factoryOutput: -0.2, consumerGoods: 0.05 }, desc: '1929년 이후의 불황이 여전히 경제를 짓누른다.' },
  usa_neutral: { name: '중립법', mods: { 'warSupport.target': -0.2 } },
  usa_arsenal: { name: '민주주의의 병기창', mods: { factoryOutput: 0.15, construction: 0.15 } },
  // 기타
  pol_cav: { name: '기병의 전통', mods: { 'cav.atk': 0.1 } },
  spr_unrest: { name: '정치적 혼란', mods: { stability: -0.2, ppFactor: -0.2 } },
  nsp_army: { name: '아프리카군', mods: { 'land.atk': 0.1, 'land.org': 0.1 }, desc: '모로코 전쟁으로 단련된 외인부대와 모로코 정규군.' },
  fin_sisu: { name: '시수', mods: { 'land.def': 0.1, winter: 0.5 }, desc: '핀란드인의 불굴의 정신.' },
  swi_neutral: { name: '무장 중립', mods: { 'land.def': 0.15, 'land.entrench': 0.3 } },
  tur_kemal: { name: '케말주의', mods: { stability: 0.05 } },
  eth_war: { name: '침략에 맞선 항전', mods: { 'land.def': 0.15, 'warSupport.target': 0.3 } },
  minor_army: { name: '낙후된 군대', mods: { 'land.org': -0.1, 'land.atk': -0.1 } },
  colonial: { name: '식민지 수비대', mods: {} },
  // 진행 중 효과
  war_exhaust: { name: '전쟁 피로', mods: { stability: -0.05 } },
  occupied_capital: { name: '수도 함락', mods: { stability: -0.2, ppFactor: -0.3, factoryOutput: -0.1 } },
  propaganda_camp: { name: '선전 캠페인', mods: { 'warSupport.target': 0.1 } },
  martial_law: { name: '계엄령', mods: { stability: 0.1, ppFactor: -0.2 } },
  arms_drive: { name: '군수 증산 운동', mods: { factoryOutput: 0.1, stability: -0.05 } },
  industrial_drive: { name: '공업화 운동', mods: { construction: 0.15 } },
  research_push: { name: '과학 진흥', mods: { research: 0.1 } },
  mobilization: { name: '총동원령', mods: { manpower: 0.2, stability: -0.05 } },
  exile: { name: '망명 정부', mods: {} },
  liberated: { name: '해방된 조국', mods: { stability: 0.1, 'warSupport.target': 0.1 } },
  armistice: { name: '휴전 체제', mods: { 'land.org': -0.1 } },
};

// 결정 (정치력 소모 → 일정 기간 국가 정신 또는 즉시 효과)
export const DECISIONS = [
  { id: 'propaganda', name: '선전 캠페인', cost: 50, days: 120, spirit: 'propaganda_camp', desc: '120일간 전쟁 지지도 목표치 +10%', cd: 180 },
  { id: 'martial', name: '계엄령 선포', cost: 50, days: 120, spirit: 'martial_law', desc: '120일간 안정도 +10%, 정치력 -20%', cd: 180 },
  { id: 'armsdrive', name: '군수 증산 운동', cost: 75, days: 150, spirit: 'arms_drive', desc: '150일간 군수 공장 산출 +10%, 안정도 -5%', cd: 200, req: { tension: 0.2 } },
  { id: 'industrial', name: '공업화 운동', cost: 75, days: 150, spirit: 'industrial_drive', desc: '150일간 건설 속도 +15%', cd: 200 },
  { id: 'science', name: '과학 진흥 정책', cost: 60, days: 150, spirit: 'research_push', desc: '150일간 연구 속도 +10%', cd: 200 },
  { id: 'mobilize', name: '총동원령', cost: 100, days: 180, spirit: 'mobilization', desc: '180일간 징병 가능 인구 +20%', cd: 365, req: { war: 1 } },
  { id: 'warbonds', name: '전시 국채 발행', cost: 25, days: 0, desc: '전쟁 지지도 +5%, 안정도 -3%', cd: 120, req: { war: 1 }, fx: { warSupport: 0.05, stability: -0.03 } },
  { id: 'fuelrationing', name: '연료 배급제', cost: 50, days: 0, desc: '연료 +25,000, 안정도 -5%', cd: 180, fx: { fuel: 25000, stability: -0.05 } },
];

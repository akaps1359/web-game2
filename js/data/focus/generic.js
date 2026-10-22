// 공통 국가 중점 (강대국 외 모든 나라)
const NO_FAS = ['not', ['ideology', 'THIS', 'fas']];
const NO_COM = ['not', ['ideology', 'THIS', 'com']];
export const GENERIC = [
  // ── 산업 ──
  { id: 'gen_industry', name: '공업 확충', icon: 'factory', x: 1, y: 0, ai: 3,
    fx: [['civ', 1]], desc: '민간 공업을 키워 건설 능력을 늘린다.' },
  { id: 'gen_infra', name: '기반 시설 투자', icon: 'infra', x: 0, y: 1, req: ['gen_industry'],
    fx: [['infra', 2]], desc: '도로와 철도를 정비해 보급과 건설을 돕는다.' },
  { id: 'gen_mil', name: '군수 공장', icon: 'mil', x: 2, y: 1, req: ['gen_industry'], ai: 2,
    fx: [['mil', 2]], desc: '국내 무기 생산 능력을 갖춘다.' },
  { id: 'gen_research', name: '기술 투자', icon: 'research', x: 1, y: 2, req: [['gen_infra', 'gen_mil']], days: 98,
    fx: [['rslot', 1]], desc: '대학과 연구소를 지원해 기술 격차를 줄인다.' },
  { id: 'gen_resources', name: '자원 개발', icon: 'steel', x: 0, y: 3, req: ['gen_research'],
    fx: [['mods', { resources: 0.1 }], ['civ', 1]], desc: '광산을 개발하고 채굴 설비를 늘린다.' },
  { id: 'gen_arms', name: '군수 확충', icon: 'mil', x: 2, y: 3, req: ['gen_research'],
    fx: [['mil', 2]], desc: '전쟁에 대비해 군수 공장을 더 짓는다.' },

  // ── 군사 ──
  { id: 'gen_army', name: '육군 증강', icon: 'army', x: 4, y: 0, ai: 2,
    fx: [['rbonus', 'inf', 0.5, 1], ['units', [['inf9', 1]]]], desc: '보병 사단을 늘리고 장비를 개선한다.' },
  { id: 'gen_fort', name: '국경 요새', icon: 'fort', x: 3, y: 1, req: ['gen_army'],
    fx: [['fortBorder', 3, 1]], desc: '위협받는 국경을 따라 요새를 쌓는다.' },
  { id: 'gen_conscript', name: '징병 확대', icon: 'manpower', x: 5, y: 1, req: ['gen_army'],
    fx: [['manpower', 30000], ['units', [['inf9', 2]]]], desc: '징집 대상을 넓혀 병력을 늘린다.' },
  { id: 'gen_doctrine', name: '군사 교리 정비', icon: 'doctrine', x: 4, y: 2, req: [['gen_fort', 'gen_conscript']],
    fx: [['rbonus', 'land', 0.75, 1]], desc: '강대국의 교리를 연구해 군을 개편한다.' },
  { id: 'gen_air', name: '공군 창설', icon: 'fighter', x: 3, y: 3, req: ['gen_doctrine'],
    fx: [['equip', 'fighter', 50], ['rbonus', 'air', 0.5, 1]], desc: '전투기를 들여와 작은 공군을 만든다.' },
  { id: 'gen_artillery', name: '포병 확충', icon: 'art', x: 5, y: 3, req: ['gen_doctrine'],
    fx: [['rbonus', 'art', 0.5, 1], ['equip', 'art', 100]], desc: '야포와 대전차포를 들여온다.' },

  // ── 정치 · 외교 ──
  { id: 'gen_politics', name: '정국 안정', icon: 'politics', x: 8, y: 0, ai: 2,
    fx: [['stab', 0.05], ['pp', 30]], desc: '정부의 기반을 다진다.' },
  { id: 'gen_propaganda', name: '애국 선전', icon: 'news', x: 7, y: 1, req: ['gen_politics'],
    fx: [['ws', 0.1]], desc: '국민에게 나라를 지킬 각오를 심는다.' },
  { id: 'gen_unity', name: '국민 통합', icon: 'people', x: 9, y: 1, req: ['gen_politics'],
    fx: [['stab', 0.08]], desc: '정파 간 갈등을 누그러뜨린다.' },
  { id: 'gen_allies', name: '연합국과 협력', icon: 'shield', x: 7, y: 2, req: [['gen_propaganda', 'gen_unity']], excl: ['gen_axis', 'gen_comintern', 'gen_neutral'], ai: 0,
    avail: [['faction', 'ENG', 'allies'], ['tension', 0.3], NO_FAS, NO_COM], availText: '연합국 존재 · 긴장도 30% · 비파시즘·비공산',
    fx: [['joinFaction', 'ENG']], desc: '영국과 프랑스의 진영에 가입한다.' },
  { id: 'gen_axis', name: '추축국과 협력', icon: 'swords', x: 8, y: 2, req: [['gen_propaganda', 'gen_unity']], excl: ['gen_allies', 'gen_comintern', 'gen_neutral'], ai: 0,
    avail: [['faction', 'GER', 'axis'], ['tension', 0.3], NO_COM], availText: '추축국 존재 · 긴장도 30% · 비공산',
    fx: [['joinFaction', 'GER']], desc: '독일의 진영에 가입한다.' },
  { id: 'gen_comintern', name: '소련과 협력', icon: 'star', x: 9, y: 2, req: [['gen_propaganda', 'gen_unity']], excl: ['gen_allies', 'gen_axis', 'gen_neutral'], ai: 0,
    avail: [['faction', 'SOV', 'comintern'], NO_FAS], availText: '코민테른 존재 · 비파시즘',
    fx: [['joinFaction', 'SOV']], desc: '소련의 진영에 가입한다.' },
  { id: 'gen_neutral', name: '무장 중립', icon: 'fort', x: 8, y: 3, req: [['gen_propaganda', 'gen_unity']], excl: ['gen_allies', 'gen_axis', 'gen_comintern'], ai: 2,
    fx: [['mods', { 'land.def': 0.1, 'land.entrench': 0.2 }], ['fortBorder', 2, 1]], desc: '어느 편에도 서지 않고 스스로를 지킨다.' },
];

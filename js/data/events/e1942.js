// 1942~1945 이벤트: 이탈리아 휴전과 사회 공화국, 루마니아·불가리아·핀란드의 이탈, 독일 항복, 지도자 교체
const ITALY_SOUTH = ['palermo', 'catania', 'sardegna', 'calabria', 'bari', 'napoli'];
// 독일군이 장악한 북부·중부(구스타프 선 이북). 남부는 연합군과 바돌리오 정부가 지킨다
const RSI_STATES = ['milano', 'torino', 'genova', 'venezia', 'trieste', 'trento', 'bologna', 'firenze', 'ancona', 'pescara', 'roma'];

const VIC_NORTH_AFRICA = ['alger', 'oran', 'constantine', 'ghardaia', 'tamanrasset', 'rabat', 'fes', 'marrakech', 'oujda'];
const VIC_METRO = ['auvergne', 'limousin', 'toulouse', 'languedoc', 'marseille', 'lyon', 'alpes'];

export const E1942 = [
  // ── 횃불 작전과 안톤 작전 ──
  { id: 'vic_torch', who: 'VIC', trig: [['flag', 'torch'], ['exists', 'FRA'], ['notPuppet', 'THIS']], pic: 'ships', news: true, newsText: '횃불 작전: 연합군이 모로코와 알제리에 상륙했습니다. 북아프리카의 프랑스군이 연합국 편에 섰습니다.',
    immediate: [['cede', VIC_NORTH_AFRICA, 'FRA'], ['for', 'FRA', [['returnGov', 'alger'], ['units', [['inf9', 4, 'alger'], ['inf9', 2, 'rabat']]], ['equip', 'inf_eq', 4000]]], ['flag', 'torch_done']],
    title: '횃불 작전', desc: '11월 8일 미군과 영국군이 카사블랑카·오랑·알제에 상륙했다. 비시 정부군은 사흘을 버티다 알제에 있던 다를랑 제독의 명령으로 싸움을 멈췄다. 프랑스령 북아프리카가 연합국 편으로 넘어갔다.',
    opts: [{ t: '북아프리카를 잃었다', fx: [['stab', -0.1]] }] },
  { id: 'ger_anton', who: 'GER', trig: [['flag', 'torch_done'], ['exists', 'VIC'], ['notPuppet', 'VIC']], pic: 'tanks', style: 'telegram',
    title: '안톤 작전', desc: '11월 11일 독일군이 비시 프랑스의 비점령 지역으로 진주했다. 이탈리아군은 니스와 코르시카를 차지했다. 11월 27일 툴롱 항의 프랑스 함대는 독일에 넘어가지 않으려고 스스로 배를 가라앉혔다.',
    opts: [{ t: '남프랑스를 점령한다', ai: 9, fx: [['cede', VIC_METRO, 'GER'], ['if', [['alive', 'ITA'], ['faction', 'ITA', 'axis']], [['for', 'ITA', [['cede', ['nice', 'corse'], 'ITA']]]]], ['puppet', 'VIC'], ['for', 'VIC', [['joinWarOf', 'GER', 'ENG']]]] }, { t: '비시와의 협정을 지킨다', ai: 0, fx: [] }] },

  // ── 연합군의 반격 ──
  { id: 'eng_husky', who: 'ENG', trig: [['after', '1943-07-10'], ['atWar', 'ENG', 'ITA'], ['controls', 'ITA', ['palermo']], ['isAI', 'ENG']], pic: 'ships', news: true, newsText: '허스키 작전: 연합군이 시칠리아에 상륙했습니다.',
    immediate: [['amphib', { palermo: 6, catania: 4 }], ['if', [['alive', 'USA'], ['atWar', 'USA', 'ITA'], ['isAI', 'USA']], [['for', 'USA', [['amphib', { palermo: 6 }]]]]]],
    title: '허스키 작전', desc: '7월 10일 영국 제8군과 미국 제7군이 시칠리아 남부 해안에 상륙했다. 3,000척이 넘는 함선과 16만 명이 동원된 당시 최대의 상륙 작전이었다. 몽고메리와 패튼은 메시나를 향해 경주했다.',
    opts: [{ t: '메시나로!', fx: [] }] },
  { id: 'sov_guards', who: 'SOV', trig: [['after', '1942-11-19'], ['atWar', 'SOV', 'GER']], pic: 'soldiersSnow', news: true, newsText: '천왕성 작전: 붉은 군대가 대반격에 나섰습니다.',
    title: '붉은 군대의 재건', desc: '1942년 가을 스탑카는 전차 군단과 기계화 군단을 다시 편성하고 포병 돌파 사단을 만들었다. 지휘관들은 1941년의 패배에서 배웠다. 11월 19일 스탈린그라드에서 시작된 천왕성 작전은 그 첫 결실이었다. 나흘 만에 두 집게가 칼라치에서 만나 독일 제6군 30만 명을 가두었다.',
    opts: [{ t: '근위대가 앞장선다', fx: [['spirit', 'sov_guards'], ['rmSpirit', 'sov_surprise']] }] },
  { id: 'sov_bagration', who: 'SOV', trig: [['after', '1944-06-22'], ['atWar', 'SOV', 'GER']], pic: 'tanks', news: true, newsText: '바그라티온 작전: 붉은 군대가 대공세를 시작했습니다.',
    title: '바그라티온 작전', desc: '독일군 침공 3주년인 6월 22일, 4개 전선군 170만 명이 벨라루스의 중부 집단군을 덮쳤다. 전날 밤 빨치산이 철도 1,000여 곳을 끊었다. 두 달 만에 독일군 28개 사단이 사라졌다.',
    opts: [{ t: '서쪽으로!', fx: [['spirit', 'sov_bagration', 120]] }] },
  { id: 'ger_bombing', who: 'GER', trig: [['after', '1943-03-01'], ['atWar', 'GER', 'ENG'], ['atWar', 'GER', 'USA']], pic: 'ruins',
    title: '연합군 합동 폭격', desc: '카사블랑카 회담에서 처칠과 루스벨트는 독일 공업에 대한 밤낮없는 폭격에 합의했다. 7월 함부르크에서는 화염 폭풍으로 하룻밤에 3만 명이 숨졌다. 군수장관 슈페어는 공장을 흩어 숨기며 생산을 지켜 냈다.',
    opts: [{ t: '공장을 분산하라', fx: [['spirit', 'ger_bombed']] }] },
  { id: 'ger_oil', who: 'GER', trig: [['after', '1944-05-12'], ['atWar', 'GER', 'USA']], pic: 'ruins', style: 'telegram',
    title: '석유 공세', desc: '5월 12일 미국 제8공군이 로이나와 메르제부르크의 합성 연료 공장을 폭격했다. 슈페어는 히틀러에게 보고했다. "적이 우리의 가장 약한 곳을 찾아냈습니다." 항공 연료 생산은 넉 달 만에 10분의 1로 줄었다.',
    opts: [{ t: '남은 연료를 아껴라', fx: [['spirit', 'ger_oil_crisis']] }] },

  { id: 'ger_volkssturm', who: 'GER', trig: [['after', '1943-12-01'], ['atWar', 'GER', 'SOV'], ['surrender', 'GER', 0.2]], pic: 'troops', news: true, newsText: '독일이 국민돌격대를 창설했습니다. 마지막 한 사람까지 싸우겠다고 선언합니다.',
    title: '국민돌격대', desc: '적이 국경에 다가오자 총통은 16세부터 60세까지 무기를 들 수 있는 모든 남자를 국민돌격대로 불러냈다. 연합국의 무조건 항복 요구는 협상의 여지를 남기지 않았다. 독일은 마지막 한 사람까지 싸운다.',
    opts: [{ t: '마지막 한 사람까지', fx: [['spirit', 'ger_volkssturm'], ['units', [['inf9', 8, 'berlin']]], ['manpower', 300000]] }] },

  { id: 'ita_armistice', who: 'ITA', trig: [['faction', 'ITA', 'axis'], ['atWar', 'ITA', 'ENG'], ['or', [['surrender', 'ITA', 0.3], ['and', [['after', '1943-07-20'], ['enemyControls', 'ITA', ITALY_SOUTH]]]]]], pic: 'crowd',
    news: true, newsText: '무솔리니가 실각했습니다. 이탈리아가 연합국과 휴전합니다!',
    // 독일군이 북부·중부와 해외 점령지의 이탈리아군을 무장 해제했다. 남부의 소수 부대만 공동 교전군으로 남는다
    immediate: [['disband', ITALY_SOUTH, 8], ['leaveFaction'], ['leaveWar'], ['gov', { leader: '피에트로 바돌리오', title: '총리', ideology: 'neu', gov: '왕국 정부', party: '바돌리오 내각' }], ['if', [['faction', 'ENG', 'allies']], [['joinFaction', 'ENG']]], ['if', [['alive', 'GER']], [['event', 'ger_achse', 'GER', 0]]],
      // 연합군이 살레르노·타란토에 올라와 남부를 지킨다(애벌랜치 작전)
      ['if', [['controls', 'ITA', ['napoli']], ['atWar', 'ENG', 'GER'], ['isAI', 'ENG']], [['for', 'ENG', [['deploy', 6, 'napoli']]]]],
      ['if', [['controls', 'ITA', ['napoli']], ['atWar', 'USA', 'GER'], ['isAI', 'USA']], [['for', 'USA', [['deploy', 8, 'napoli']]]]]],
    title: '무솔리니 실각', desc: '7월 24일 밤 파시즘 대평의회가 무솔리니를 불신임했고, 이튿날 국왕은 그를 체포했다. 바돌리오 정부는 9월 8일 연합국과의 휴전을 발표했다. 국왕과 정부는 로마를 떠나 남쪽으로 피했다.',
    opts: [{ t: '휴전', fx: [['stab', -0.1]] }] },
  { id: 'ger_achse', who: 'GER', manual: true, pic: 'troops',
    // 이탈리아 북부·중부를 떼어 독일의 괴뢰국으로(이탈리아 쪽에서 실행해야 그 주들을 찾는다).
    // 실제로 그 땅을 지킨 것은 독일군이다: 밀라노 밖은 독일이 통제하고 케셀링·롬멜의 집단군이 들어간다
    immediate: [['warOn', 'THIS', 'ITA', '이탈리아 전역'], ['for', 'ITA', [['spawnCtrl', 'RSI', RSI_STATES, 'GER']]], ['ctrlTo', RSI_STATES.filter((k) => k !== 'milano'), 'GER'],
      ['units', [['inf9', 5, 'roma'], ['inf9', 3, 'pescara'], ['inf9', 3, 'firenze'], ['arm', 2, 'roma'], ['inf9', 3, 'bologna']]],
      ['for', 'RSI', [['units', [['inf9', 4, 'milano']]], ['equip', 'inf_eq', 3000]]]],
    title: '아흐제 작전', desc: '독일군이 이탈리아군을 무장 해제하고 북부와 중부를 장악했다. 9월 12일 그란사소 산장에서 구출된 무솔리니가 북부에 "이탈리아 사회 공화국"을 세웠다.',
    opts: [{ t: '배신자를 응징하라', fx: [] }] },
  { id: 'rom_coup', who: 'ROM', trig: [['faction', 'ROM', 'axis'], ['after', '1944-03-01'], ['or', [['enemyControls', 'ROM', ['iasi', 'chisinau', 'galati', 'cernauti', 'budjak']], ['surrender', 'ROM', 0.2]]]], pic: 'crowd',
    news: true, newsText: '루마니아가 추축국에서 이탈해 연합국 편으로 돌아섰습니다!',
    immediate: [['leaveFaction'], ['leaveWar'], ['gov', { leader: '미하이 1세', title: '국왕', ideology: 'neu', gov: '입헌 군주제', party: '국민민주블록' }], ['cede', ['chisinau', 'budjak', 'cernauti'], 'SOV', 1], ['if', [['alive', 'SOV'], ['faction', 'SOV']], [['joinFaction', 'SOV']]]],
    title: '미하이 1세의 쿠데타', desc: '8월 23일 국왕 미하이 1세가 궁정에서 안토네스쿠를 체포했다. 루마니아는 추축국에서 빠져나와 독일에 선전포고했다.',
    opts: [{ t: '연합국 편으로!', fx: [['if', [['alive', 'GER'], ['notAtWar', 'THIS', 'GER']], [['war', 'GER', '루마니아의 전향', { noGuarantees: true }]]]] }] },
  { id: 'bul_switch', who: 'BUL', trig: [['faction', 'BUL', 'axis'], ['after', '1944-08-01'], ['or', [['enemyControls', 'BUL', ['varna', 'burgas', 'plovdiv', 'pleven']], ['surrender', 'BUL', 0.15], ['controls', 'SOV', ['bucuresti']]]]], pic: 'crowd',
    immediate: [['leaveFaction'], ['leaveWar'], ['gov', { leader: '키몬 게오르기에프', title: '총리', ideology: 'com', gov: '조국전선 정부', party: '조국전선' }], ['if', [['alive', 'SOV'], ['faction', 'SOV']], [['joinFaction', 'SOV']]]],
    title: '조국전선 정부', desc: '붉은 군대가 국경에 이르자 9월 9일 조국전선이 정권을 잡았다. 불가리아는 독일에 선전포고했다.',
    opts: [{ t: '조국전선 만세', fx: [['if', [['alive', 'GER'], ['notAtWar', 'THIS', 'GER']], [['war', 'GER', '불가리아의 전향', { noGuarantees: true }]]]] }] },
  { id: 'fin_armistice', who: 'FIN', trig: [['fired', 'fin_continuation'], ['atWar', 'SOV', 'FIN'], ['after', '1944-06-01'], ['or', [['controls', 'SOV', ['viipuri']], ['surrender', 'FIN', 0.2], ['after', '1944-09-15']]]], pic: 'diplomacy',
    title: '모스크바 휴전 협정', desc: '여름 공세로 카렐리야 지협이 다시 뚫렸다. 대통령이 된 만네르헤임 원수는 소련과 휴전하고 핀란드에 있는 독일군을 몰아내기로 했다.',
    opts: [
      { t: '휴전한다', ai: 9, fx: [['cede', ['viipuri', 'sortavala', 'petsamo'], 'SOV', 1], ['leaveFaction'], ['peace', 'SOV'], ['gov', { leader: '칼 구스타브 에밀 만네르헤임', title: '대통령' }], ['news', '핀란드가 소련과 휴전했습니다.', 1]] },
      { t: '끝까지 싸운다', ai: 0, fx: [['ws', 0.1]] },
    ] },
  { id: 'ger_unconditional', who: 'GER', manual: true, pic: 'ruins', news: true, newsText: '독일이 무조건 항복했습니다! 유럽의 전쟁이 끝났습니다.',
    immediate: [['flag', 've_day'], ['settleCap', null, { puppet: false }]],
    title: '무조건 항복', desc: '베를린이 함락되었다. 5월 7일 랭스, 8일 베를린 카를스호르스트에서 독일군은 무조건 항복 문서에 서명했다. 유럽에서 전쟁이 끝났다.',
    opts: [{ t: '전쟁이 끝났다', fx: [] }] },
  { id: 've_day', who: ['ENG', 'FRA', 'SOV', 'USA', 'POL'], trig: [['flag', 've_day']], pic: 'victory', edition: '승전 특보',
    title: '유럽 전승 기념일', desc: '런던의 트래펄가 광장, 파리의 샹젤리제, 모스크바의 붉은 광장에 사람들이 쏟아져 나왔다. 6년에 걸친 유럽의 전쟁이 끝났다. 이제 남은 것은 폐허 위에 새 질서를 세우는 일이다.',
    opts: [{ t: '승리!', fx: [['stab', 0.15], ['ws', -0.2]] }] },

  // ── 지도자 교체 ──
  { id: 'usa_election1940', who: 'USA', trig: [['after', '1940-11-05']], pic: 'crowd',
    title: '루스벨트 3선', desc: '루스벨트가 미국 역사상 처음으로 3선에 성공했다. 그는 "여러분의 아들들을 외국의 전쟁에 보내지 않겠다"고 약속했다.',
    opts: [{ t: '네 번째 임기를 향해', fx: [['stab', 0.03], ['pp', 30]] }] },
  { id: 'usa_truman', who: 'USA', trig: [['after', '1945-04-12'], ['leader', '프랭클린 D. 루스벨트']], pic: 'city',
    title: '루스벨트 서거', desc: '4월 12일 웜스프링스에서 루스벨트 대통령이 뇌출혈로 숨졌다. 부통령 해리 S. 트루먼이 대통령직을 이어받는다.',
    opts: [{ t: '트루먼 대통령', fx: [['gov', { leader: '해리 S. 트루먼', title: '대통령' }], ['stab', -0.02]] }] },
  { id: 'eng_attlee', who: 'ENG', trig: [['after', '1945-07-26'], ['flag', 've_day']], pic: 'crowd',
    title: '노동당 압승', desc: '전쟁을 승리로 이끈 처칠의 보수당이 총선에서 졌다. 국민은 복지 국가를 약속한 클레멘트 애틀리의 노동당을 택했다.',
    opts: [{ t: '애틀리 내각', fx: [['gov', { leader: '클레멘트 애틀리', title: '총리', party: '노동당' }], ['stab', 0.05]] }] },
  { id: 'gre_metaxas_death', who: 'GRE', trig: [['after', '1941-01-29'], ['leader', '이오아니스 메탁사스']], pic: 'city',
    title: '메탁사스 사망', desc: '이탈리아군을 알바니아로 밀어낸 승리의 한가운데서 메탁사스 총리가 숨을 거두었다.',
    opts: [{ t: '코리지스 내각', fx: [['gov', { leader: '알렉산드로스 코리지스', title: '총리' }], ['stab', -0.03]] }] },
];

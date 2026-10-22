// 1936~1937 이벤트: 라인란트, 스페인 내전, 추축, 에티오피아, 대숙청 등
// {id, who, title, desc, pic, style, trig, mtth, repeat, manual, immediate, news, newsText, opts:[{t, fx, ai, aiIf}]}
const NSP_STATES = ['galicia', 'valladolid', 'burgos', 'navarra', 'zaragoza', 'sevilla', 'cordoba', 'canarias', 'tetouan', 'sahara_es', 'baleares'];
const SPANISH_WAR = [['flag', 'spanish_cw'], ['atWar', 'NSP', 'SPR']];

export const E1936 = [
  { id: 'eng_george5', who: 'ENG', trig: [['after', '1936-01-20']], pic: 'city',
    title: '국왕 조지 5세 서거', desc: '1월 20일 조지 5세가 샌드링엄 궁에서 서거했다. 왕세자가 에드워드 8세로 즉위한다. 새 국왕과 미국인 이혼녀 월리스 심프슨의 관계가 벌써 사람들의 입방아에 오르내린다.',
    opts: [{ t: '국왕 폐하 만세!', fx: [['stab', -0.02]] }] },

  { id: 'fra_rhineland', who: 'FRA', manual: true, pic: 'troops', news: true, newsText: '독일군이 비무장 지대 라인란트에 진주했습니다!',
    title: '독일군, 라인란트 진주', desc: '로카르노 조약에 따라 비무장 지대로 남아 있던 라인란트에 독일군이 들어왔다. 군 수뇌부는 총동원 없이는 개입할 수 없다고 하고, 영국은 소극적이다. 선거를 몇 주 앞둔 사로 내각이 결정을 내려야 한다.',
    opts: [
      { t: '항의 성명만 낸다', ai: 9, fx: [['stab', -0.03], ['ws', -0.02], ['for', 'GER', [['pp', 25]]]] },
      { t: '군을 동원해 맞선다', ai: 0.3, fx: [['ws', 0.1], ['pp', -50], ['tension', 0.02], ['for', 'GER', [['stab', -0.05], ['ws', -0.05]]]] },
    ] },

  { id: 'spr_election', who: 'SPR', trig: [['after', '1936-02-16']], pic: 'crowd',
    title: '인민전선의 총선 승리', desc: '2월 16일 총선에서 좌파 연합인 인민전선이 근소하게 이겼다. 아사냐가 정부를 맡았지만 거리에서는 좌우 청년 조직의 충돌이 끊이지 않는다. 군부의 불만도 커지고 있다.',
    opts: [{ t: '공화국은 버틸 것이다', fx: [['stab', -0.05], ['ideology', 'com', 0.04]] }] },

  { id: 'spr_civil_war', who: 'SPR', trig: [['after', '1936-07-17'], ['alive', 'SPR'], ['not', ['exists', 'NSP']]], pic: 'troops', news: true, newsText: '스페인에서 내전이 일어났습니다!',
    immediate: [['civilWar', 'NSP', NSP_STATES, { capital: 'burgos', share: 0.35, warName: '스페인 내전' }], ['flag', 'spanish_cw'],
      ['for', 'NSP', [['units', [['inf9', 6, 'sevilla'], ['inf9', 5, 'burgos'], ['inf9', 3, 'zaragoza'], ['inf9', 4, 'tetouan'], ['inf9', 3, 'valladolid'], ['inf9', 2, 'galicia'], ['inf9', 2, 'navarra']]], ['equip', 'inf_eq', 6000], ['equip', 'art', 200], ['spirit', 'nsp_army']]],
      ['spirit', 'spr_unrest']],
    title: '스페인 내전 발발', desc: '7월 17일 스페인령 모로코에서 군 장성들이 봉기했고, 반란은 하루 만에 본토로 번졌다. 국민파는 갈리시아·카스티야·나바라와 남부의 세비야를 장악했고, 마드리드·바르셀로나·발렌시아는 공화국 편에 남았다. 프랑코 장군의 아프리카군이 해협을 건너려 하고 있다.',
    opts: [
      { t: '공화국을 지킨다! ¡No pasarán!', ai: 9, fx: [['ws', 0.1], ['law', 'conscription', 'extensive']] },
      { t: '국민파를 이끈다 (국민파 스페인으로 플레이)', ai: 0, fx: [['playAs', 'NSP']] },
    ] },

  { id: 'ger_condor', who: 'GER', trig: [...SPANISH_WAR, ['after', '1936-07-25']], pic: 'planes',
    title: '콘도르 군단', desc: '프랑코가 모로코의 아프리카군을 본토로 옮길 수송기를 요청해 왔다. 스페인을 돕는다면 새 무기와 전술을 실전에서 시험할 수 있을 것이다.',
    opts: [
      { t: '콘도르 군단을 보낸다', ai: 9, fx: [['for', 'NSP', [['units', [['inf9', 2, 'sevilla']]], ['equip', 'fighter', 50], ['equip', 'inf_eq', 1500]]], ['rbonus', 'air', 0.5, 1], ['tension', 0.01]] },
      { t: '개입하지 않는다', ai: 1, fx: [['pp', 25]] },
    ] },
  { id: 'ita_ctv', who: 'ITA', trig: [...SPANISH_WAR, ['after', '1936-08-10']], pic: 'troops',
    title: '의용군단 파견', desc: '무솔리니는 스페인에 "의용군"을 보내 지중해 서쪽에 우호 정권을 세우려 한다.',
    opts: [
      { t: '의용군단(CTV)을 보낸다', ai: 9, fx: [['for', 'NSP', [['units', [['inf9', 3, 'sevilla']]], ['equip', 'inf_eq', 2000]]], ['equip', 'inf_eq', -2000], ['ws', 0.03]] },
      { t: '불간섭', ai: 1, fx: [] },
    ] },
  { id: 'sov_spain_aid', who: 'SOV', trig: [...SPANISH_WAR, ['after', '1936-09-15']], pic: 'ships',
    title: '공화국 원조', desc: '스페인 공화국이 무기를 요청했다. 코민테른은 세계 곳곳에서 국제여단 의용병을 모으고 있다.',
    opts: [
      { t: '전차와 항공기를 보낸다', ai: 8, fx: [['for', 'SPR', [['units', [['inf9', 2, 'madrid']]], ['equip', 'inf_eq', 2500], ['equip', 'fighter', 60]]], ['pp', -25]] },
      { t: '개입하지 않는다', ai: 2, fx: [] },
    ] },
  { id: 'fra_nonintervention', who: 'FRA', trig: [...SPANISH_WAR, ['after', '1936-08-01']], pic: 'diplomacy',
    title: '불간섭 정책', desc: '블룸 총리는 같은 인민전선 정부인 스페인 공화국을 돕고 싶어 하지만, 영국은 불간섭을 요구하고 국내 우파는 내전이 프랑스로 번질까 걱정한다. 9월 런던에서 불간섭 위원회가 열린다.',
    opts: [
      { t: '불간섭을 지킨다', ai: 9, fx: [['stab', 0.02]] },
      { t: '공화국에 몰래 무기를 보낸다', ai: 1, fx: [['for', 'SPR', [['equip', 'inf_eq', 2000], ['equip', 'fighter', 40]]], ['stab', -0.05]] },
    ] },
  { id: 'spr_brigades', who: 'SPR', trig: [...SPANISH_WAR, ['after', '1936-10-20']], pic: 'crowd',
    title: '국제여단', desc: '50여 개국에서 온 3만여 명의 의용병이 마드리드 방어에 나섰다. "그들은 지나가지 못한다!"',
    opts: [{ t: '마드리드를 지켜라!', fx: [['units', [['inf9', 3, 'madrid']]], ['ws', 0.05]] }] },
  { id: 'nsp_aid', who: 'NSP', trig: [...SPANISH_WAR], mtth: 30, repeat: true, pic: 'ships', style: 'telegram',
    title: '추축국의 지원', desc: '독일과 이탈리아에서 무기와 탄약을 실은 수송선이 도착했다.',
    opts: [{ t: '감사히 받는다', fx: [['equip', 'inf_eq', 1800], ['equip', 'art', 60], ['manpower', 30000]] }] },
  { id: 'spr_aid', who: 'SPR', trig: [...SPANISH_WAR], mtth: 75, repeat: true, pic: 'ships', style: 'telegram',
    title: '소련 수송선 도착', desc: '오데사에서 출발한 수송선이 카르타헤나에 무기를 내려놓았다.',
    opts: [{ t: '전선으로 보낸다', fx: [['equip', 'inf_eq', 900], ['manpower', 15000]] }] },

  { id: 'ita_axis_offer', who: 'ITA', manual: true, pic: 'diplomacy',
    title: '베를린-로마 추축', desc: '독일이 긴밀한 협력을 제안해 왔다. 오스트리아 문제로 껄끄러웠던 두 나라는 에티오피아와 스페인을 계기로 가까워졌다. 치아노 외무장관이 베를린을 방문한다.',
    opts: [
      { t: '추축에 가담한다', ai: 9, fx: [['joinFaction', 'GER'], ['ws', 0.05], ['news', '이탈리아가 독일과 손잡았습니다(베를린-로마 추축).', 1]] },
      { t: '거절한다', ai: 0, fx: [['for', 'GER', [['stab', -0.02]]]] },
    ] },

  { id: 'eth_annexed', who: 'ITA', manual: true, pic: 'victory', news: true, newsText: '이탈리아가 에티오피아를 병합했습니다.',
    immediate: [['annex', 'ETH'], ['flag', 'ethiopia_annexed']],
    title: '에티오피아 병합', desc: '5월 5일 바돌리오 원수가 아디스아바바에 입성했다. 이탈리아는 에티오피아 병합을 선포했고 비토리오 에마누엘레 3세가 에티오피아 황제를 겸한다. 망명한 하일레 셀라시에는 제네바의 국제연맹에서 "오늘은 우리, 내일은 당신들"이라고 호소했다.',
    opts: [{ t: '제국이 로마의 언덕 위에 다시 섰다!', fx: [['ws', 0.05], ['stab', 0.05], ['rmSpirit', 'ita_ethiopia']] }] },

  { id: 'gre_metaxas', who: 'GRE', trig: [['after', '1936-08-04']], pic: 'crowd',
    title: '8월 4일 체제', desc: '이오아니스 메탁사스 총리가 의회를 해산하고 계엄을 선포했다. 국왕 게오르기오스 2세의 지지 아래 권위주의 체제가 들어선다.',
    opts: [{ t: '질서를 세운다', fx: [['gov', { leader: '이오아니스 메탁사스', title: '총리', gov: '8월 4일 체제', party: '자유사상당' }], ['stab', 0.05], ['ws', 0.05]] }] },
  { id: 'tur_montreux', who: 'TUR', trig: [['after', '1936-07-20']], pic: 'ships',
    title: '몽트뢰 협약', desc: '튀르키예가 보스포루스·다르다넬스 해협의 주권과 재무장 권리를 되찾았다.',
    opts: [{ t: '해협을 요새화한다', fx: [['fort', 2, 'istanbul'], ['fort', 1, 'edirne'], ['stab', 0.03]] }] },
  { id: 'eng_abdication', who: 'ENG', trig: [['after', '1936-12-10']], pic: 'city',
    title: '에드워드 8세 퇴위', desc: '"사랑하는 여인의 도움과 지지 없이는 국왕의 무거운 짐을 질 수 없다." 에드워드 8세가 즉위 1년도 안 되어 왕위를 내려놓았다. 동생 요크 공이 조지 6세로 즉위한다.',
    opts: [{ t: '국왕 조지 6세 만세', fx: [['stab', -0.03]] }] },
  { id: 'usa_election1936', who: 'USA', trig: [['after', '1936-11-03']], pic: 'crowd',
    title: '루스벨트 압승', desc: '루스벨트가 46개 주에서 이기며 재선되었다. 뉴딜은 계속된다.',
    opts: [{ t: '뉴딜을 이어 간다', fx: [['stab', 0.05], ['pp', 30]] }] },

  // ── 1937 ──
  { id: 'eng_chamberlain', who: 'ENG', trig: [['after', '1937-05-28'], ['leader', '스탠리 볼드윈']], pic: 'diplomacy',
    title: '체임벌린 내각', desc: '볼드윈이 물러나고 재무장관 네빌 체임벌린이 총리가 되었다. 그는 독일의 정당한 불만을 들어주면 전쟁을 막을 수 있다고 믿는다.',
    opts: [{ t: '평화를 위하여', fx: [['gov', { leader: '네빌 체임벌린', title: '총리' }], ['pp', 25]] }] },
  { id: 'sov_tukhachevsky', who: 'SOV', trig: [['after', '1937-06-11']], pic: 'ruins',
    title: '투하쳅스키 사건', desc: '미하일 투하쳅스키 원수와 붉은 군대 지휘관 7명이 "반소 군사 음모" 혐의로 비밀 재판을 받고 처형되었다. 숙청은 원수 5명 중 3명, 군단장 대부분에 이르렀다.',
    opts: [
      { t: '인민의 적을 처단하라', ai: 9, fx: [['pp', 75], ['stab', 0.02], ['mods', { 'land.org': -0.05 }], ['news', '소련에서 투하쳅스키 원수 등 붉은 군대 수뇌부가 처형되었습니다.', 1]] },
      { t: '숙청을 멈춘다', ai: 0, fx: [['rmSpirit', 'sov_purge'], ['stab', -0.1], ['pp', -50]] },
    ] },
  { id: 'spr_guernica', who: 'SPR', trig: [...SPANISH_WAR, ['after', '1937-04-26']], pic: 'ruins', news: true, newsText: '콘도르 군단이 바스크의 도시 게르니카를 폭격했습니다.',
    title: '게르니카', desc: '4월 26일 장날, 콘도르 군단과 이탈리아 공군이 바스크의 작은 도시 게르니카를 폭격했다. 피카소는 이 참상을 거대한 화폭에 담았다.',
    opts: [{ t: '세계가 지켜보고 있다', fx: [['ws', 0.05]] }] },
  { id: 'ger_hossbach', who: 'GER', trig: [['after', '1937-11-05']], pic: 'map',
    title: '호스바흐 회의', desc: '히틀러가 국방장관과 각 군 수뇌, 외무장관을 모아 "생존 공간" 구상을 밝혔다. 늦어도 1943년까지는 오스트리아와 체코슬로바키아를 손에 넣어야 한다는 것이다. 블롬베르크와 프리치는 우려를 표했다.',
    opts: [{ t: '시간은 우리 편이 아니다', fx: [['pp', 30], ['ws', 0.03]] }] },
  { id: 'ita_anticomintern', who: 'ITA', trig: [['after', '1937-11-06'], ['faction', 'ITA', 'axis']], pic: 'diplomacy',
    title: '반코민테른 협정 가입', desc: '이탈리아가 독일·일본의 반코민테른 협정에 가입했다. 12월에는 국제연맹에서도 탈퇴했다.',
    opts: [{ t: '볼셰비즘에 맞서', fx: [['stab', 0.02], ['tension', 0.01]] }] },
];

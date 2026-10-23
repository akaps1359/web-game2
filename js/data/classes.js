// 직업: 디아블로 1의 전사·로그·소서러 수치(기본·최대 능력치, 생명·마나 공식)를 따른다
export const CLASSES = {
  warrior: {
    id: 'warrior', name: '전사', en: 'Warrior', gender: 'm',
    desc: '무거운 갑옷과 무기를 다루는 근접 전투의 달인. 레벨에 비례한 확률로 치명타(피해 2배)를 낸다.',
    base: { str: 30, mag: 10, dex: 20, vit: 25 },
    max: { str: 250, mag: 50, dex: 60, vit: 100 },
    // 생명 = 체력×2 + 레벨×2 + 18, 마나 = 마력 + 레벨 − 1
    life: { vit: 2, lvl: 2, k: 18, itemVit: 2 }, mana: { mag: 1, lvl: 1, k: -1, itemMag: 1 },
    block: 30, meleeHit: 20, rangedHit: 10, spellHit: 0,
    // 공격 동작 시간(초): 디아블로 1의 프레임 수를 줄여서
    swing: 0.55, cast: 0.6, bowSwing: 0.62,
    look: { plan: 'human', h: 1.05, bulk: 1.12, shoulders: 1.1, cols: { skin: '#c89a78', hair: '#3a2614', torso: '#6a5a48', arms: '#c89a78', fore: '#c89a78', hands: '#c89a78', legs: '#4a3c30', boots: '#3a2a1c', belt: '#2a1a10' }, beard: '#3a2614', bracers: '#3a2a1c', furCollar: '#5e4a34', pouches: true, baldric: '#3a2616' },
    start: ['short_sword', 'buckler', 'club', 'hp_minor', 'hp_minor', 'tp_scroll'],
    voice: 'male',
  },
  rogue: {
    id: 'rogue', name: '로그', en: 'Rogue', gender: 'f',
    desc: '활의 명수. 민첩함으로 멀리서 적을 쓰러뜨리고 함정과 그림자 기술을 다룬다.',
    base: { str: 20, mag: 15, dex: 30, vit: 20 },
    max: { str: 55, mag: 70, dex: 250, vit: 80 },
    life: { vit: 1, lvl: 2, k: 23, itemVit: 1.5 }, mana: { mag: 1, lvl: 2, k: 5, itemMag: 1.5 },
    block: 20, meleeHit: 0, rangedHit: 20, spellHit: 0,
    swing: 0.55, cast: 0.55, bowSwing: 0.48,
    look: { plan: 'human', h: 0.97, bulk: 0.9, shoulders: 0.92, waist: 0.85, ponytail: true, cols: { skin: '#d8ae90', hair: '#7a3a1a', torso: '#4a5a3a', arms: '#d8ae90', fore: '#4a3a2a', hands: '#5a4030', legs: '#3a3a2c', boots: '#3a2a1c', belt: '#2a1a10' }, bracers: '#2e2218', pouches: true, baldric: '#2e2016', quiver: true },
    start: ['short_bow', 'dagger', 'hp_minor', 'hp_minor', 'tp_scroll'],
    voice: 'female',
  },
  sorcerer: {
    id: 'sorcerer', name: '소서러', en: 'Sorcerer', gender: 'm',
    desc: '화염·번개·냉기 마법을 부리는 마법사. 생명은 약하지만 마나가 풍부하다.',
    base: { str: 15, mag: 35, dex: 15, vit: 20 },
    max: { str: 45, mag: 250, dex: 85, vit: 80 },
    life: { vit: 1, lvl: 1, k: 9, itemVit: 1 }, mana: { mag: 2, lvl: 2, k: -2, itemMag: 2 },
    block: 10, meleeHit: 0, rangedHit: 0, spellHit: 20,
    swing: 0.62, cast: 0.45, bowSwing: 0.6,
    look: { plan: 'human', h: 1.0, bulk: 0.92, robe: true, cols: { skin: '#c8a080', hair: '#d8d0c8', torso: '#2a3a6a', robe: '#26325e', arms: '#2a3a6a', fore: '#2a3a6a', hands: '#c8a080', legs: '#202a4a', boots: '#2a1c14', belt: '#7a6030' }, beard: '#c8c0b8' },
    start: ['short_staff', 'hp_minor', 'mp_minor', 'mp_minor', 'tp_scroll'],
    voice: 'male',
  },
};

// 경험치 표(디아블로 1): 레벨 n에서 n+1로 가는 데 필요한 누적 경험치
export const EXP_TABLE = [
  0, 2000, 4620, 8040, 12489, 18258, 25712, 35309, 47622, 63364,
  83419, 108879, 141086, 181683, 231075, 313656, 424067, 571190, 766569, 1025154,
  1366227, 1814568, 2401895, 3168651, 4166200, 5459523, 7130496, 9281874, 12042092, 15571031,
  20066900, 25774405, 32994399, 42095202, 53525811, 67831218, 85670061, 107834823, 135274799, 169122009,
  210720231, 261657253, 323800420, 399335440, 490808349, 601170414, 733825617, 892680222, 1082908612, 1310707109,
];
export const MAX_LEVEL = 50;

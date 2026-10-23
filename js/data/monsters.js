// 괴물: 디아블로 1의 괴물 계열과 계열마다 4단계 변종의 수치(층·레벨·생명력·방어도·명중·피해·저항·경험치)
// 저항 문자열: 독(디아블로 1의 마법 저항 자리)·화염·번개, 넷째 글자는 냉기. I 면역, R 저항(75%)
// 걷기 = 한 칸에 걸리는 초, atk = 공격 동작 초, hit = 타격 시점(초), rec = 피격 경직(초)

const human = (cols, extra = {}) => ({ plan: 'human', cols, ...extra });
const C = (skin, torso, legs, boots, extra = {}) => ({ skin, torso, arms: extra.arms || skin, fore: extra.fore || skin, hands: extra.hands || skin, legs, boots, hair: extra.hair || null, belt: extra.belt || null, wing: extra.wing, robe: extra.robe, pad: extra.pad, cape: extra.cape });

export const FAMILIES = {
  zombie: {
    name: '좀비', cls: 'undead', ai: 'zombie', walk: 1.2, atk: 0.6, hit: 0.4, rec: 0.3, sfx: 'mon_zombie', die: 'mon_die_small',
    look: (c) => human(C(c[0], c[1], c[2], c[0]), { hunch: 0.3, reach: 1.0, stride: 0.6, bloodCol: 'rgba(60,70,20,0.7)' }),
    v: [
      ['zombie', '좀비', [1, 2], 1, [4, 7], 5, 10, [2, 5], 'I---', 54, 0, ['#7a8a5a', '#4a4030', '#3a3428']],
      ['ghoul', '구울', [2, 3], 2, [7, 11], 10, 10, [3, 10], 'I---', 58, 1, ['#8a9aa8', '#3a3a40', '#2a2a30']],
      ['rotting', '썩은 시체', [2, 4], 4, [15, 25], 15, 25, [5, 15], 'I---', 136, 2, ['#8a7a4a', '#5a4024', '#4a3a24']],
      ['blackdeath', '흑사 망자', [3, 5], 6, [25, 40], 20, 30, [6, 22], 'I---', 240, 3, ['#4a4a44', '#1e1c1a', '#1a1a18'], { drainMax: true }],
    ],
  },
  fallen: {
    name: '타락귀', cls: 'animal', ai: 'fallen', walk: 0.55, atk: 0.65, hit: 0.35, rec: 0.55, sfx: 'mon_imp', die: 'mon_die_small',
    look: (c, v) => human(C(c[0], c[0], c[1], c[1]), { h: 0.6, headS: 1.35, horns: 0.6, tail: true, wtype: v.sword ? 'sword' : 'spear', wlen: v.sword ? 16 : 30, wcol: '#a8a8b0', glowEyes: '#ffd040', barZ: 50 }),
    v: [
      ['fallen', '타락귀', [1, 3], 1, [1, 4], 0, 15, [1, 3], '----', 46, 0, ['#b0402a', '#7a2a1a']],
      ['carver', '살점 타락귀', [2, 3], 3, [4, 8], 5, 20, [2, 5], '----', 80, 2, ['#c06030', '#7a3a1a']],
      ['devilkin', '악귀', [2, 4], 5, [12, 24], 10, 25, [3, 7], '----', 155, 2, ['#8a2030', '#5a1020']],
      ['darkone', '어둠 타락귀', [3, 5], 7, [20, 36], 15, 30, [4, 8], '----', 255, 3, ['#4a2a5a', '#2a1a3a']],
    ],
  },
  fallen_s: {
    name: '타락귀 검사', cls: 'animal', ai: 'fallen', walk: 0.6, atk: 0.65, hit: 0.4, rec: 0.55, sfx: 'mon_imp', die: 'mon_die_small', sword: true,
    look: (c) => human(C(c[0], c[0], c[1], c[1]), { h: 0.62, headS: 1.3, horns: 0.6, tail: true, wtype: 'cleaver', wlen: 16, wcol: '#a8a8b0', glowEyes: '#ffd040', barZ: 50 }),
    v: [
      ['fallen_s', '타락귀 검사', [1, 3], 1, [2, 5], 10, 15, [1, 4], '----', 52, 0, ['#b0402a', '#7a2a1a']],
      ['carver_s', '살점 검사', [2, 3], 3, [5, 9], 15, 20, [2, 7], '----', 90, 1, ['#c06030', '#7a3a1a']],
      ['devilkin_s', '악귀 검사', [2, 4], 5, [16, 24], 20, 25, [4, 10], '----', 180, 2, ['#8a2030', '#5a1020']],
      ['darkone_s', '어둠 검사', [3, 5], 7, [24, 36], 25, 30, [4, 12], '----', 280, 3, ['#4a2a5a', '#2a1a3a']],
    ],
  },
  skeleton: {
    name: '해골', cls: 'undead', ai: 'melee', walk: 0.4, atk: 0.65, hit: 0.4, rec: 0.3, sfx: 'mon_skel', die: 'mon_die_bone', bones: true,
    look: (c, v) => human(C(c[0], c[0], c[0], c[0]), { skel: true, head: 'skull', wtype: 'axe', wlen: 22, wcol: '#8a8070', glowEyes: c[1], noBlood: true }),
    v: [
      ['skeleton', '해골', [1, 2], 1, [2, 4], 0, 20, [1, 4], 'I---', 64, 0, ['#d8d0b8', null]],
      ['corpseaxe', '시체 도끼병', [2, 3], 2, [4, 7], 0, 25, [3, 5], 'I---', 68, 1, ['#c8b890', null]],
      ['burningdead', '불타는 망자', [2, 4], 4, [8, 12], 5, 30, [3, 7], 'IR--', 154, 2, ['#5a4030', '#ff8020'], { glow: [255, 120, 30] }],
      ['horror', '공포 해골', [3, 5], 6, [12, 20], 15, 35, [4, 9], 'I-R-', 264, 3, ['#8a8a90', '#80c0ff']],
    ],
  },
  skel_archer: {
    name: '해골 궁수', cls: 'undead', ai: 'archer', walk: 0.4, atk: 0.8, hit: 0.6, rec: 0.25, sfx: 'mon_skel', die: 'mon_die_bone', bones: true, missile: 'arrow',
    look: (c) => human(C(c[0], c[0], c[0], c[0]), { skel: true, head: 'skull', wtype: 'bow', wcol: '#5a4028', glowEyes: c[1], noBlood: true }),
    v: [
      ['skel_archer', '해골 궁수', [2, 3], 3, [2, 4], 0, 15, [1, 2], 'I---', 110, 0, ['#d8d0b8', null]],
      ['corpsebow', '시체 궁수', [2, 4], 5, [8, 16], 0, 25, [1, 4], 'I---', 210, 1, ['#c8b890', null]],
      ['burning_archer', '불타는 궁수', [3, 5], 7, [10, 24], 5, 30, [1, 6], 'IR--', 364, 2, ['#5a4030', '#ff8020'], { glow: [255, 120, 30] }],
      ['horror_archer', '공포 궁수', [4, 6], 9, [15, 45], 15, 35, [2, 9], 'I-R-', 594, 3, ['#8a8a90', '#80c0ff']],
    ],
  },
  skel_captain: {
    name: '해골 대장', cls: 'undead', ai: 'melee', walk: 0.4, atk: 0.6, hit: 0.4, rec: 0.35, sfx: 'mon_skel', die: 'mon_die_bone', bones: true,
    look: (c) => human(C(c[0], c[0], c[0], c[0]), { skel: true, head: 'skull', wtype: 'sword', wlen: 26, wcol: '#a0a0a8', shield: { type: 'round', color: '#5a4028', rim: '#888' }, helm: { type: 'cap', color: '#6a6a70' }, glowEyes: c[1], noBlood: true, h: 1.05 }),
    v: [
      ['skel_captain', '해골 대장', [1, 3], 2, [3, 6], 10, 20, [2, 7], 'I---', 90, 0, ['#d8d0b8', null]],
      ['corpse_captain', '시체 대장', [2, 4], 4, [12, 20], 5, 30, [3, 9], 'I---', 200, 1, ['#c8b890', null]],
      ['burning_captain', '불타는 대장', [3, 5], 6, [16, 30], 15, 35, [4, 10], 'IR--', 393, 2, ['#5a4030', '#ff8020'], { glow: [255, 120, 30] }],
      ['horror_captain', '공포 대장', [4, 6], 8, [35, 50], 30, 40, [5, 14], 'I-R-', 604, 3, ['#8a8a90', '#80c0ff']],
    ],
  },
  scavenger: {
    name: '청소부 짐승', cls: 'animal', ai: 'scav', walk: 0.4, atk: 0.6, hit: 0.35, rec: 0.3, sfx: 'mon_beast', die: 'mon_die_small',
    look: (c) => ({ plan: 'quad', h: 0.85, long: 0.9, cols: C(c[0], c[1], c[1], c[2]), tail: true, spikes: c[2], barZ: 45 }),
    v: [
      ['scavenger', '청소부', [1, 3], 2, [3, 6], 10, 20, [1, 5], '----', 80, 0, ['#7a5a40', '#6a4a30', '#3a2a1a']],
      ['plague_eater', '역병 먹이꾼', [2, 4], 4, [12, 24], 20, 30, [1, 8], '----', 188, 1, ['#6a7a4a', '#5a6a3a', '#2a3a1a']],
      ['shadow_beast', '그림자 짐승', [3, 5], 6, [24, 36], 25, 35, [3, 12], '----', 375, 2, ['#3a3a4a', '#2a2a3a', '#101018']],
      ['bone_gasher', '뼈 갉는 자', [4, 6], 8, [28, 40], 30, 35, [5, 15], 'R---', 552, 3, ['#9a8a7a', '#7a6a5a', '#d8d0c0']],
    ],
  },
  fiend: {
    name: '날개 악마', cls: 'animal', ai: 'bat', walk: 0.35, atk: 0.5, hit: 0.25, rec: 0.45, sfx: 'mon_bat', die: 'mon_die_small', fly: true, noDrop: true,
    look: (c) => ({ plan: 'flyer', h: 0.85, cols: C(c[0], c[0], c[0], c[0], { wing: c[1] }), glowEyes: c[2], barZ: 58 }),
    v: [
      ['fiend', '박쥐 악마', [2, 3], 3, [3, 6], 0, 35, [1, 6], '----', 102, 0, ['#4a3030', '#2a1a1a', '#ff3020']],
      ['blink', '깜빡이', [3, 5], 7, [12, 28], 15, 45, [1, 8], '----', 340, 1, ['#4a3a6a', '#2a1a4a', '#c080ff'], { blink: true }],
      ['gloom', '어스름', [4, 6], 9, [28, 36], 35, 70, [4, 12], 'R---', 509, 2, ['#1a1a20', '#0a0a10', '#ff3020']],
      ['familiar', '사역마', [6, 8], 13, [20, 35], 35, 50, [4, 16], 'R-I-', 448, 3, ['#2a4a6a', '#1a2a4a', '#a0e0ff'], { zap: true, glow: [120, 170, 255] }],
    ],
  },
  hidden: {
    name: '숨은 자', cls: 'demon', ai: 'sneak', walk: 0.4, atk: 0.6, hit: 0.4, rec: 0.4, sfx: 'mon_demon', die: 'mon_die_demon',
    look: (c) => human(C(c[0], c[1], c[1], c[0]), { h: 1.0, bulk: 0.8, wtype: 'claw', wlen: 10, wcol: '#d8d0c0', glowEyes: c[2], head: 'beast', hunch: 0.15, outline: 'rgba(10,0,20,0.6)' }),
    v: [
      ['hidden', '숨은 자', [2, 5], 5, [8, 24], 25, 35, [3, 6], '----', 278, 0, ['#5a3a6a', '#3a2a4a', '#ff40ff']],
      ['stalker', '추적자', [5, 7], 9, [30, 45], 30, 40, [8, 16], '----', 630, 1, ['#4a4a6a', '#2a2a4a', '#40ffff']],
      ['unseen', '보이지 않는 자', [6, 8], 11, [35, 50], 30, 45, [12, 20], 'R---', 935, 2, ['#3a4a3a', '#1a2a1a', '#a0ff40']],
      ['weaver', '환영 직조자', [8, 10], 13, [40, 60], 30, 60, [16, 24], 'RR--', 1500, 3, ['#6a2a3a', '#3a1a2a', '#ff4040']],
    ],
  },
  goatman: {
    name: '산양족', cls: 'demon', ai: 'goat', walk: 0.4, atk: 0.6, hit: 0.4, rec: 0.3, sfx: 'mon_goat', die: 'mon_die_big', doors: true,
    look: (c) => human(C(c[0], c[1], c[2], '#2a1a10', { hands: c[2] }), { head: 'goat', horns: 1.1, hornCol: '#d8ccb0', legs: 0.95, wtype: 'mace', wlen: 24, wcol: '#8a8a90', h: 1.05, bulk: 1.1, tail: true }),
    v: [
      ['flesh_clan', '살점 부족', [4, 6], 8, [30, 45], 40, 50, [4, 10], '----', 460, 0, ['#8a6a54', '#6a4a34', '#4a3424']],
      ['stone_clan', '바위 부족', [5, 7], 10, [40, 55], 40, 60, [6, 12], 'R---', 685, 1, ['#7a7a76', '#5a5a56', '#3a3a38']],
      ['fire_clan', '불꽃 부족', [6, 8], 12, [50, 65], 45, 70, [8, 16], '-R--', 906, 2, ['#a05030', '#7a3020', '#4a1a10']],
      ['night_clan', '밤 부족', [7, 9], 14, [55, 70], 50, 80, [10, 20], 'R---', 1190, 3, ['#3a3a5a', '#24243a', '#14141f']],
    ],
  },
  goat_archer: {
    name: '산양족 궁수', cls: 'demon', ai: 'archer', walk: 0.4, atk: 0.8, hit: 0.65, rec: 0.3, sfx: 'mon_goat', die: 'mon_die_big', missile: 'arrow', doors: true,
    look: (c) => human(C(c[0], c[1], c[2], '#2a1a10', { hands: c[2] }), { head: 'goat', horns: 1.0, hornCol: '#d8ccb0', wtype: 'bow', wcol: '#5a4028', h: 1.0, tail: true }),
    v: [
      ['flesh_archer', '살점 부족 궁수', [4, 6], 8, [20, 35], 35, 35, [1, 7], '----', 448, 0, ['#8a6a54', '#6a4a34', '#4a3424']],
      ['stone_archer', '바위 부족 궁수', [5, 7], 10, [30, 40], 35, 40, [2, 9], 'R---', 645, 1, ['#7a7a76', '#5a5a56', '#3a3a38']],
      ['fire_archer', '불꽃 부족 궁수', [6, 8], 12, [40, 50], 35, 45, [3, 11], '-R--', 822, 2, ['#a05030', '#7a3020', '#4a1a10']],
      ['night_archer', '밤 부족 궁수', [7, 9], 14, [50, 65], 40, 50, [4, 13], 'R---', 1092, 3, ['#3a3a5a', '#24243a', '#14141f']],
    ],
  },
  overlord: {
    name: '비대한 군주', cls: 'demon', ai: 'melee', walk: 0.5, atk: 0.75, hit: 0.4, rec: 0.3, sfx: 'mon_demon', die: 'mon_die_big',
    look: (c) => human(C(c[0], c[1], c[2], c[2]), { h: 1.25, bulk: 1.6, belly: 1.7, shoulders: 1.2, horns: 0.5, wtype: 'cleaver', wlen: 22, wcol: '#9a9aa0', wwide: 1.5, astyle: 'overhead', scale: 1.1, shadow: 1.4, barZ: 90 }),
    v: [
      ['overlord', '군주', [5, 7], 10, [60, 80], 55, 55, [6, 12], '----', 635, 0, ['#a05a40', '#7a4030', '#4a2418']],
      ['mudman', '진흙 인간', [7, 9], 14, [100, 125], 60, 60, [8, 16], '----', 1165, 1, ['#6a5034', '#4a3824', '#2a2014']],
      ['toad', '두꺼비 악마', [8, 10], 16, [135, 160], 65, 70, [8, 16], 'I---', 1380, 2, ['#5a7a3a', '#3a5a2a', '#2a3a1a'], { secondHit: true }],
      ['flayed', '껍질 벗겨진 자', [10, 12], 20, [160, 200], 70, 85, [10, 20], 'RI--', 2058, 3, ['#b04a3a', '#8a2a20', '#5a1410']],
    ],
  },
  gargoyle: {
    name: '가고일', cls: 'demon', ai: 'garg', walk: 0.7, atk: 0.7, hit: 0.35, rec: 0.5, sfx: 'mon_demon', die: 'mon_die_demon', doors: true,
    look: (c) => human(C(c[0], c[0], c[1], c[1], { wing: c[1] }), { wings: true, wingS: 1.1, horns: 0.9, hornCol: '#3a3a3a', hunch: 0.25, wtype: 'claw', wlen: 10, wcol: '#d8d0c0', glowEyes: c[2], head: 'beast', h: 1.0 }),
    v: [
      ['winged_demon', '날개 악마', [5, 7], 9, [45, 60], 45, 50, [10, 16], 'IR--', 662, 0, ['#6a3a30', '#4a2a20', '#ff6020']],
      ['gargoyle', '가고일', [7, 9], 13, [60, 90], 45, 65, [10, 16], 'I-R-', 1205, 1, ['#7a7a7a', '#5a5a5a', '#ffd040']],
      ['blood_claw', '피발톱', [9, 11], 19, [75, 125], 50, 80, [14, 22], 'II--', 1873, 2, ['#8a2a2a', '#5a1a1a', '#ff3030']],
      ['death_wing', '죽음날개', [10, 12], 23, [90, 150], 60, 95, [16, 28], 'I-I-', 2278, 3, ['#2a2a32', '#18181e', '#80ffff']],
    ],
  },
  acid: {
    name: '산성 짐승', cls: 'animal', ai: 'acid', walk: 0.4, atk: 0.6, hit: 0.4, rec: 0.4, sfx: 'mon_beast', die: 'mon_die_small', missile: 'acid', dtype: 'poison',
    look: (c) => ({ plan: 'quad', h: 0.95, long: 1.1, legW: 1.1, cols: C(c[0], c[1], c[1], c[2]), tail: true, spikes: c[2], glowEyes: '#c0ff40', bloodCol: 'rgba(80,160,40,0.6)' }),
    v: [
      ['acid_beast', '산성 짐승', [6, 8], 11, [40, 66], 30, 40, [4, 12], '----', 846, 0, ['#5a7a3a', '#4a6a2a', '#2a3a14']],
      ['spitter', '독 뱉는 자', [8, 10], 15, [60, 85], 30, 45, [4, 16], '----', 1248, 1, ['#3a6a5a', '#2a5a4a', '#143a2a']],
      ['pit_beast', '구덩이 짐승', [10, 12], 21, [80, 110], 35, 55, [8, 18], 'R---', 2060, 2, ['#6a5a3a', '#5a4a2a', '#3a2a14']],
      ['lava_maw', '용암 아가리', [12, 14], 25, [100, 150], 35, 65, [10, 20], 'RI--', 2940, 3, ['#7a3020', '#5a2014', '#ff8020'], { glow: [255, 110, 30] }],
    ],
  },
  magma: {
    name: '마그마 악마', cls: 'demon', ai: 'caster_melee', walk: 0.5, atk: 0.7, hit: 0.35, rec: 0.35, sfx: 'mon_demon', die: 'mon_die_demon', missile: 'fireball', doors: true, dtype: 'fire',
    look: (c) => human(C(c[0], c[1], c[1], c[0]), { h: 1.15, bulk: 1.3, shoulders: 1.2, horns: 0.6, glowEyes: '#ffe040', wtype: 'claw', wlen: 10, wcol: '#ffa040' }),
    v: [
      ['magma', '마그마 악마', [8, 9], 13, [50, 70], 45, 45, [2, 10], 'IR--', 1076, 0, ['#4a2a20', '#2a1810'], { glow: [255, 120, 40] }],
      ['bloodstone', '핏빛 돌', [8, 10], 14, [55, 75], 45, 50, [2, 12], 'II--', 1309, 1, ['#5a1a1a', '#3a1010'], { glow: [255, 60, 40] }],
      ['hellstone', '지옥 돌', [9, 11], 16, [60, 80], 50, 60, [2, 20], 'II--', 1680, 2, ['#3a2a2a', '#1a1010'], { glow: [255, 90, 20] }],
      ['lava_lord', '용암 군주', [9, 11], 18, [70, 85], 60, 75, [4, 24], 'II--', 2124, 3, ['#5a3010', '#3a1a08'], { glow: [255, 160, 40] }],
    ],
  },
  horned: {
    name: '뿔 악마', cls: 'animal', ai: 'charge', walk: 0.4, atk: 0.7, hit: 0.35, rec: 0.3, sfx: 'mon_beast', die: 'mon_die_big', doors: true,
    look: (c) => ({ plan: 'quad', h: 1.2, bulk: 1.4, long: 1.0, legW: 1.4, cols: C(c[0], c[1], c[1], c[2]), horns: 1.4, hornCol: '#e0d8c0', scale: 1.1, shadow: 1.4 }),
    v: [
      ['horned', '뿔 악마', [7, 9], 13, [40, 80], 40, 60, [2, 16], '----', 1172, 0, ['#6a4a3a', '#5a3a2a', '#2a1a10'], { charge: [5, 32] }],
      ['mud_runner', '진흙 돌진자', [8, 10], 15, [50, 90], 45, 70, [6, 18], '----', 1404, 1, ['#5a4a2a', '#4a3a1a', '#2a2010'], { charge: [12, 36] }],
      ['frost_charger', '서리 돌격자', [9, 11], 17, [60, 100], 50, 80, [8, 20], 'I-RR', 1720, 2, ['#6a8aaa', '#4a6a8a', '#2a3a4a'], { charge: [20, 40] }],
      ['obsidian_lord', '흑요석 군주', [10, 12], 19, [70, 110], 55, 90, [10, 22], 'I-R-', 1809, 3, ['#2a2a2e', '#1a1a1e', '#0a0a0e'], { charge: [20, 50] }],
    ],
  },
  storm: {
    name: '폭풍 악마', cls: 'demon', ai: 'caster_melee', walk: 0.4, atk: 0.9, hit: 0.45, rec: 0.2, sfx: 'mon_demon', die: 'mon_die_demon', missile: 'lightning', doors: true, dtype: 'light',
    look: (c) => human(C(c[0], c[1], c[1], c[1]), { h: 1.2, bulk: 1.0, horns: 0.8, hornCol: '#d0d8ff', glowEyes: '#c0e0ff', wtype: 'claw', wlen: 10, wcol: '#c0e0ff', tail: true }),
    v: [
      ['red_storm', '붉은 폭풍', [9, 11], 18, [55, 110], 30, 80, [8, 18], 'I-R-', 2160, 0, ['#8a3a3a', '#5a2020'], { glow: [255, 100, 100] }],
      ['storm_rider', '폭풍 기수', [10, 12], 20, [60, 120], 30, 80, [8, 18], 'R-I-', 2391, 1, ['#3a4a8a', '#202a5a'], { glow: [120, 150, 255] }],
      ['storm_lord', '폭풍 군주', [11, 13], 22, [75, 135], 35, 85, [12, 24], 'R-I-', 2775, 2, ['#4a3a7a', '#2a2050'], { glow: [170, 140, 255] }],
      ['maelstrom', '대소용돌이', [12, 14], 24, [90, 150], 40, 90, [12, 28], 'R-I-', 3177, 3, ['#2a5a6a', '#143a4a'], { glow: [100, 220, 255] }],
    ],
  },
  mega: {
    name: '대악마', cls: 'demon', ai: 'mega', walk: 0.35, atk: 0.7, hit: 0.4, rec: 0.05, sfx: 'mon_demon', die: 'mon_die_demon', missile: 'inferno', doors: true, dtype: 'fire',
    look: (c) => human(C(c[0], c[1], c[1], c[0], { wing: c[2] }), { h: 1.35, bulk: 1.35, shoulders: 1.3, wings: true, wingS: 1.4, horns: 1.3, hornCol: '#2a2020', glowEyes: '#ffe040', wtype: 'axe', wlen: 32, wcol: '#5a5a60', wwide: 1.6, scale: 1.15, shadow: 1.5, barZ: 110, tail: true }),
    v: [
      ['slayer', '학살자', [10, 12], 20, [120, 140], 60, 100, [12, 20], 'RI--', 2300, 0, ['#8a3a2a', '#5a2018', '#3a1410']],
      ['guardian', '수호 악마', [11, 13], 22, [140, 160], 65, 110, [14, 22], 'RI--', 2714, 1, ['#6a4a3a', '#4a2a20', '#2a1a10']],
      ['vortex_lord', '소용돌이 군주', [12, 14], 24, [160, 180], 70, 120, [18, 24], 'RI--', 3252, 2, ['#5a2a4a', '#3a1a2a', '#2a0a1a']],
      ['balrog', '업화의 마왕', [13, 15], 26, [180, 200], 75, 130, [22, 30], 'RI--', 3643, 3, ['#a03a1a', '#6a2010', '#3a1008'], { glow: [255, 120, 40] }],
    ],
  },
  snake: {
    name: '독사', cls: 'demon', ai: 'snake', walk: 0.5, atk: 0.65, hit: 0.4, rec: 0.25, sfx: 'mon_beast', die: 'mon_die_big',
    look: (c) => ({ plan: 'serpent', h: 1.25, cols: C(c[0], c[1], c[1], c[1], { wing: c[2] }), hood: !!c[2], glowEyes: '#ffe040', barZ: 50 }),
    v: [
      ['cave_viper', '동굴 독사', [11, 13], 21, [100, 150], 60, 90, [8, 20], 'I---', 2725, 0, ['#5a6a3a', '#4a5a2a', null]],
      ['fire_drake', '화염 비룡', [12, 14], 23, [120, 170], 65, 105, [12, 24], 'IR--', 3139, 1, ['#a04a20', '#7a3010', '#5a2010'], { glow: [255, 120, 40] }],
      ['gold_viper', '황금 독사', [13, 14], 25, [140, 180], 70, 120, [15, 26], 'I-R-', 3540, 2, ['#c0a040', '#9a7a20', null]],
      ['azure_drake', '창공 비룡', [15, 15], 27, [160, 200], 75, 130, [18, 30], '-RRR', 3791, 3, ['#3a6aa0', '#2a4a7a', '#1a3a6a']],
    ],
  },
  knight: {
    name: '기사', cls: 'demon', ai: 'melee', walk: 0.4, atk: 0.8, hit: 0.4, rec: 0.2, sfx: 'mon_demon', die: 'mon_die_big', doors: true,
    look: (c) => human(C('#2a2020', c[0], c[1], c[1], { arms: c[0], fore: c[0], hands: c[1], pad: c[0] }), { pads: true, helm: { type: 'great', color: c[0], plume: c[2] }, wtype: 'sword', wlen: 32, wcol: '#b0b4bc', shield: { type: 'tower', color: c[1], rim: '#888' }, h: 1.12, bulk: 1.15, glowEyes: '#ff3020' }),
    v: [
      ['black_knight', '흑기사', [12, 16], 24, [150, 150], 75, 110, [15, 20], 'R-R-', 3360, 0, ['#2a2a30', '#1a1a20', '#600']],
      ['doom_guard', '파멸 경비병', [13, 15], 26, [165, 165], 75, 130, [18, 25], 'RR--', 3650, 0, ['#4a3a30', '#2a2018', '#a60']],
      ['steel_lord', '강철 군주', [14, 15], 28, [180, 180], 80, 120, [20, 30], 'RIR-', 4252, 1, ['#8a8a94', '#5a5a64', '#ddd']],
      ['blood_knight', '피의 기사', [13, 16], 30, [200, 200], 85, 130, [25, 35], 'IRI-', 5130, 1, ['#7a1a1a', '#4a1010', '#f22']],
    ],
  },
  succubus: {
    name: '서큐버스', cls: 'demon', ai: 'kite', walk: 0.4, atk: 0.8, hit: 0.5, rec: 0.35, sfx: 'mon_cast', die: 'mon_die_demon', missile: 'bloodstar', doors: true, dtype: 'magic',
    look: (c) => human(C(c[0], c[1], c[0], c[1], { hair: c[2], wing: c[1] }), { wings: true, wingS: 1.0, horns: 0.7, hornCol: '#2a1a1a', ponytail: true, waist: 0.8, bulk: 0.85, glowEyes: '#ff4060' }),
    v: [
      ['succubus', '서큐버스', [12, 14], 24, [120, 150], 60, 100, [1, 20], 'R---', 3696, 0, ['#c07a7a', '#5a1a2a', '#2a0a10']],
      ['snow_witch', '눈의 마녀', [13, 15], 26, [135, 175], 65, 110, [1, 24], '--RR', 4084, 1, ['#b0c0d8', '#3a4a6a', '#e0e8ff']],
      ['hell_spawn', '지옥 산란자', [14, 15], 28, [150, 200], 75, 115, [1, 30], 'R-I-', 4480, 2, ['#d08050', '#6a2a14', '#2a0a00']],
      ['soul_burner', '영혼 소각자', [15, 15], 30, [140, 225], 85, 120, [1, 35], 'RIR-', 4644, 3, ['#6a5a6a', '#2a1a2a', '#000']],
    ],
  },
  mage: {
    name: '흑마법사', cls: 'demon', ai: 'mage', walk: 0.35, atk: 1.0, hit: 0.5, rec: 0.4, sfx: 'mon_cast', die: 'mon_die_demon', doors: true,
    look: (c) => human(C('#1a1414', c[0], c[0], c[0], { robe: c[0] }), { robe: true, robeFlare: 1.3, helm: { type: 'hood', color: c[1] }, glowEyes: c[2], h: 1.05, fly: true }),
    v: [
      ['counselor', '조언자', [13, 14], 25, [70, 70], 0, 90, [8, 20], 'RRR-', 4070, 0, ['#2a3a6a', '#1a2a5a', '#80c0ff'], { spell: 'firebolt' }],
      ['magistrate', '집정관', [14, 15], 27, [85, 85], 0, 100, [10, 24], 'RIR-', 4478, 1, ['#3a5a3a', '#1a3a1a', '#a0ff80'], { spell: 'charged' }],
      ['cabalist', '비밀결사원', [15, 15], 29, [120, 120], 0, 110, [14, 30], 'RRI-', 4929, 2, ['#5a2a2a', '#3a1414', '#ff8060'], { spell: 'lightning' }],
      ['advocate', '대변자', [16, 16], 30, [145, 145], 0, 120, [15, 25], 'IRI-', 4968, 3, ['#4a2a5a', '#2a143a', '#ff60ff'], { spell: 'fireball' }],
    ],
  },
};

// 퀘스트 보스·이름 붙은 괴물
export const BOSSES = {
  butcher: {
    name: '도살자 모르그', fam: 'overlord', lvl: 6, hp: 220, ac: 50, hit: 50, dmg: [6, 12], res: '-RR-', xp: 710, ai: 'melee', walk: 0.4, atk: 0.6, hit2: 0.4, rec: 0.3,
    look: human(C('#c89a8a', '#e8e0d0', '#5a3a2a', '#3a2418', { arms: '#c89a8a', fore: '#c89a8a', hands: '#c89a8a', belt: '#5a1a10' }), { h: 1.3, bulk: 1.7, belly: 1.8, shoulders: 1.25, wtype: 'cleaver', wlen: 26, wcol: '#9aa0a8', wwide: 1.8, astyle: 'overhead', scale: 1.12, shadow: 1.5, barZ: 95, glowEyes: '#ff2010' }),
    sfx: 'boss_roar', die: 'mon_die_big', quest: 'butcher', drop: 'q_cleaver',
  },
  hollow_king: {
    name: '망자의 왕 오드릭', fam: 'skel_captain', lvl: 14, ilvl: 9, hp: 240, ac: 70, hit: 60, dmg: [6, 16], res: 'IRR-', xp: 1140, ai: 'king', walk: 0.3, atk: 0.8, hit2: 0.4, rec: 0.3,
    look: human(C('#d8d0b8', '#4a2a5a', '#d8d0b8', '#d8d0b8', { arms: '#d8d0b8', fore: '#d8d0b8', hands: '#d8d0b8', cape: '#5a1a4a', pad: '#c8a040' }), { skel: true, head: 'skull', helm: { type: 'crown', color: '#d8b040' }, wtype: 'sword', wlen: 36, wcol: '#c8ccd4', wglow: 'rgba(150,200,255,0.5)', shield: null, cape: true, pads: true, h: 1.3, scale: 1.15, glowEyes: '#ffd040', noBlood: true, barZ: 100 }),
    sfx: 'boss_laugh', die: 'mon_die_bone', quest: 'hollow_king', drop: 'q_deadcrown', bones: true,
  },
  scribe: {
    name: '광기의 필경사 베르밀', fam: 'mage', lvl: 16, ilvl: 25, hp: 360, ac: 0, hit: 90, dmg: [16, 40], res: 'IRR-', xp: 2500, ai: 'mage', spell: 'fireball', walk: 0.35, atk: 0.9, hit2: 0.5, rec: 0.4,
    look: human(C('#c8a890', '#3a2a1a', '#3a2a1a', '#2a1a10', { robe: '#4a3a24', hair: '#ddd' }), { robe: true, robeFlare: 1.2, beard: '#ddd', h: 1.0, glowEyes: '#ff4020', wtype: 'staff', wlen: 50, gem: '#ff4020' }),
    sfx: 'boss_laugh', die: 'mon_die_demon', quest: 'scribe',
  },
  warlord: {
    name: '피의 군벌 카르낙', fam: 'knight', lvl: 26, ilvl: 28, hp: 850, ac: 80, hit: 120, dmg: [35, 50], res: 'III-', xp: 8500, ai: 'melee', walk: 0.4, atk: 0.75, hit2: 0.4, rec: 0.15,
    look: human(C('#2a2020', '#6a1010', '#3a0a0a', '#2a0808', { arms: '#6a1010', fore: '#6a1010', hands: '#3a0a0a', pad: '#8a1a1a' }), { pads: true, helm: { type: 'great', color: '#5a1010', plume: '#f22' }, wtype: 'sword', wlen: 40, wcol: '#c0a0a0', wwide: 1.4, h: 1.25, bulk: 1.25, scale: 1.15, glowEyes: '#ff2020', barZ: 100 }),
    sfx: 'boss_roar', die: 'mon_die_big', quest: 'warlord',
  },
  seraphine: {
    name: '타락한 성녀 세라핀', fam: 'mage', lvl: 35, ilvl: 30, hp: 600, ac: 0, hit: 120, dmg: [30, 50], res: 'IRR-', xp: 9000, ai: 'mage', spell: 'bloodstar', walk: 0.35, atk: 0.9, hit2: 0.5, rec: 0.3,
    look: human(C('#d8c0b0', '#e8e0d0', '#e8e0d0', '#e8e0d0', { robe: '#d8d0c0', hair: '#f0e8d0' }), { robe: true, robeFlare: 1.4, helm: { type: 'hood', color: '#c8c0b0' }, wings: true, wingS: 1.3, glowEyes: '#ff2040', wtype: 'staff', wlen: 56, gem: '#ff2040', fly: true, h: 1.1, scale: 1.05, barZ: 90 }),
    sfx: 'boss_laugh', die: 'mon_die_demon', quest: 'seraphine', dtype: 'magic',
  },
  velgath: {
    name: '공허의 군주 벨가스', fam: 'mega', lvl: 36, ilvl: 30, hp: 2400, ac: 90, hit: 220, dmg: [30, 60], res: 'IRR-', xp: 31666, ai: 'lord', walk: 0.32, atk: 0.8, hit2: 0.45, rec: 0.3,
    look: human(C('#8a1a14', '#6a0a0a', '#4a0808', '#2a0404', { wing: '#3a0606' }), { h: 1.55, bulk: 1.5, shoulders: 1.35, wings: true, wingS: 1.6, horns: 1.6, hornCol: '#1a1414', glowEyes: '#ffee40', wtype: 'claw', wlen: 14, wcol: '#e0d8c8', scale: 1.3, shadow: 1.8, barZ: 140, tail: true, spikes: true }),
    sfx: 'boss_roar', die: 'mon_die_demon', quest: 'velgath', glow: [255, 60, 30],
  },
  // 세라핀의 시녀
  handmaiden_r: { name: '핏빛 시녀', fam: 'succubus', lvl: 33, hp: 400, ac: 75, hit: 115, dmg: [30, 50], res: 'IR--', xp: 4480, ai: 'kite', missile: 'bloodstar', look: null, lookFrom: ['succubus', 2] },
  handmaiden_b: { name: '흑옥 시녀', fam: 'succubus', lvl: 33, hp: 400, ac: 75, hit: 115, dmg: [30, 50], res: 'I-R-', xp: 4480, ai: 'kite', missile: 'bloodstar', look: null, lookFrom: ['succubus', 3] },
};

// 무작위 이름 붙은 괴물(디아블로 2 방식)
export const UNAME_A = ['굶주린', '썩어가는', '피에 젖은', '부러진뿔', '검은이빨', '잿빛', '광기의', '독니', '갈라진혀', '뒤틀린', '불길한', '눈먼', '썩은손', '핏발선', '흉측한', '거대한', '침묵의', '얼어붙은', '불타는', '타락한', '무덤의', '창백한'];
export const UNAME_B = ['도살꾼', '갈퀴', '뼈씹이', '피갈망', '썩은살', '어둠발톱', '송곳니', '사냥꾼', '거머리', '파괴자', '해골쪼개기', '살점뜯개', '울부짖는 자', '배신자', '역병쟁이', '무덤지기', '그림자', '고문관', '탐식자', '학살자'];
export const CHAMP_TYPES = [
  { id: 'champion', name: '용사', dmg: 0.9, hit: 0.67, hp: 3, speed: 0.2 },
  { id: 'fanatic', name: '광신도', dmg: 0.9, hit: 0.67, hp: 3, speed: 1.0, def: -0.7 },
  { id: 'berserker', name: '광전사', dmg: 2.7, hit: 2.7, hp: 0.75, xp: 5 },
  { id: 'ghostly', name: '유령', dmg: 0.9, hit: 0.67, hp: 3, physRes: 80, cold: true, ghost: true },
  { id: 'possessed', name: '빙의된', dmg: 0.9, hit: 0.67, hp: 6, speed: 0.2 },
];
export const UMODS = [
  { id: 'strong', name: '매우 강함' }, { id: 'fast', name: '매우 빠름' }, { id: 'cursed', name: '저주' }, { id: 'magicres', name: '마법 저항' },
  { id: 'fire', name: '화염 강화' }, { id: 'light', name: '번개 강화' }, { id: 'cold', name: '냉기 강화' }, { id: 'manaburn', name: '마나 연소' },
  { id: 'spectral', name: '유령 공격' }, { id: 'stone', name: '돌 피부' }, { id: 'multi', name: '다중 사격', ranged: true }, { id: 'teleport', name: '순간 이동' },
];

// 모든 변종을 펼친 표
export const MONSTERS = {};
for (const fid in FAMILIES) {
  const F = FAMILIES[fid];
  F.v.forEach((r, i) => {
    const [id, name, dl, lvl, hp, ac, hit, dmg, res, xp, int, cols, extra] = r;
    MONSTERS[id] = { id, name, fam: fid, F, tier: i, dl, lvl, hp, ac, hit, dmg, res, xp, int, cols, ...(extra || {}), sword: F.sword };
  });
}
export function monsterLook(def) {
  const F = def.F || FAMILIES[def.fam];
  const lk = F.look(def.cols, def);
  if (def.glow) lk.glowCol = def.glow;
  return lk;
}

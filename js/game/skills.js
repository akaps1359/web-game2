// 기술: 직업마다 기술 나무 세 개(디아블로 2 방식). 수치는 디아블로 1의 생명력 규모에 맞췄다
import { meleeAttack, resolveMelee, rangedAttack, fireArrow, spawnMissile, areaDamage, damageActor, spawnArea, spawnChargedBolts, freeze, knockback, MELEE_HIT } from './combat.js';
import { addBuff } from './buffs.js';
import { Actor } from './actor.js';
import { clamp } from '../core/util.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const L1 = (l) => Math.max(0, l - 1);

// 정의 도우미
const SK = {};
function S(id, cls, tab, pos, name, req, pre, o) { SK[id] = { id, cls, tab, pos, name, req, pre, ...o }; }

export const TABS = {
  warrior: ['전투 기술', '함성', '전투 숙련'],
  rogue: ['활과 화살', '수동·마법', '함정'],
  sorcerer: ['화염', '번개', '냉기'],
};

// ═════════ 전사 ═════════
S('bash', 'warrior', 0, [1, 0], '강타', 1, [], {
  kind: 'melee', mana: () => 2, icon: { g: 'fist', c: '#c89060' },
  dmgPct: (l) => 50 + 10 * L1(l), dmgFlat: (l) => l, tohitPct: (l) => 20 + 5 * L1(l), knock: true,
  desc: (l) => [`무기 피해 +${50 + 10 * L1(l)}%, 피해 +${l}`, `명중률 +${20 + 5 * L1(l)}%`, '적을 뒤로 밀쳐냄'],
  about: '온 힘을 실어 내려치는 일격.',
});
S('cleave', 'warrior', 0, [0, 1], '휩쓸기', 6, ['bash'], {
  kind: 'cleave', mana: (l) => 4 + 0.25 * L1(l), icon: { g: 'arc', c: '#d0a070' },
  dmgPct: (l) => -20 + 8 * L1(l),
  desc: (l) => [`앞쪽 반원의 모든 적을 벤다`, `무기 피해 ${-20 + 8 * L1(l) >= 0 ? '+' : ''}${-20 + 8 * L1(l)}%`],
  about: '무기를 크게 휘둘러 앞을 쓸어버린다.',
});
S('leap_attack', 'warrior', 0, [1, 2], '도약 공격', 12, ['cleave'], {
  kind: 'leap', mana: (l) => 8 + 0.25 * L1(l), range: 7, target: 'point', icon: { g: 'leap', c: '#d8b070' },
  dmgPct: (l) => 100 + 20 * L1(l),
  desc: (l) => [`최대 7칸 도약해 내려찍기`, `착지 지점 주변에 무기 피해 +${100 + 20 * L1(l)}%`, '주변 적을 밀쳐냄'],
  about: '적의 무리 한가운데로 뛰어든다.',
});
S('concentrate', 'warrior', 0, [2, 3], '집중', 18, ['bash'], {
  kind: 'melee', mana: () => 3, icon: { g: 'eye', c: '#e0c080' },
  dmgPct: (l) => 70 + 10 * L1(l), tohitPct: (l) => 60 + 10 * L1(l), uninterruptible: true, defBuff: (l) => 100 + 10 * L1(l),
  desc: (l) => [`무기 피해 +${70 + 10 * L1(l)}%, 명중률 +${60 + 10 * L1(l)}%`, `공격하는 동안 방어도 +${100 + 10 * L1(l)}%`, '공격이 끊기지 않음'],
  about: '모든 정신을 칼끝에 모은다.',
});
S('whirlwind', 'warrior', 0, [1, 4], '회오리', 24, ['leap_attack', 'concentrate'], {
  kind: 'whirl', mana: (l) => 10 + 0.5 * L1(l), range: 6, target: 'point', icon: { g: 'whirl', c: '#e0d0a0' },
  dmgPct: (l) => -40 + 8 * L1(l),
  desc: (l) => [`회전하며 지정한 곳까지 돌진`, `주변 모든 적에게 무기 피해 ${-40 + 8 * L1(l) >= 0 ? '+' : ''}${-40 + 8 * L1(l)}%`, '1.6초 동안 계속'],
  about: '강철의 폭풍이 되어 적 사이를 휩쓴다.',
});
S('berserk', 'warrior', 0, [2, 5], '광폭', 30, ['concentrate'], {
  kind: 'melee', mana: () => 4, icon: { g: 'skull', c: '#e04030' },
  dmgPct: (l) => 150 + 15 * L1(l), tohitPct: (l) => 100 + 15 * L1(l), type: 'magic', berserk: true,
  desc: (l) => [`마법 피해로 바꿔 +${150 + 15 * L1(l)}%`, `명중률 +${100 + 15 * L1(l)}%`, '2초간 자신의 방어도 0'],
  about: '광기에 몸을 맡겨 방어를 버린다.',
});
S('howl', 'warrior', 1, [0, 0], '울부짖음', 1, [], {
  kind: 'shout', mana: () => 4, icon: { g: 'shout', c: '#c0a0e0' }, cd: 1,
  radius: (l) => 3 + 0.4 * L1(l), dur: (l) => 3 + L1(l),
  desc: (l) => [`반경 ${(3 + 0.4 * L1(l)).toFixed(1)}칸의 적이 ${3 + L1(l)}초간 달아남`],
  about: '짐승 같은 포효로 적을 겁준다.',
});
S('shout', 'warrior', 1, [1, 1], '함성', 6, ['howl'], {
  kind: 'buff', mana: () => 6, icon: { g: 'shield', c: '#80b0e0' },
  def: (l) => 100 + 10 * L1(l), dur: (l) => 20 + 10 * L1(l),
  desc: (l) => [`방어도 +${100 + 10 * L1(l)}%`, `지속 ${20 + 10 * L1(l)}초`],
  about: '동료를 일깨우는 함성.',
});
S('battle_cry', 'warrior', 1, [0, 2], '전투의 외침', 12, ['howl'], {
  kind: 'shout', mana: () => 5, icon: { g: 'shout', c: '#e08060' }, cd: 1,
  radius: () => 4.5, dur: (l) => 12 + 2 * L1(l), cryDef: (l) => Math.min(0.9, 0.5 + 0.02 * L1(l)), cryDmg: (l) => Math.min(0.6, 0.25 + 0.01 * L1(l)),
  desc: (l) => [`주변 적의 방어도 -${Math.round(Math.min(0.9, 0.5 + 0.02 * L1(l)) * 100)}%`, `적의 피해 -${Math.round(Math.min(0.6, 0.25 + 0.01 * L1(l)) * 100)}%`, `지속 ${12 + 2 * L1(l)}초`],
  about: '적의 기세를 꺾는 외침.',
});
S('battle_orders', 'warrior', 1, [1, 3], '전투 명령', 18, ['shout'], {
  kind: 'buff', mana: () => 7, icon: { g: 'banner', c: '#e0c050' },
  pct: (l) => 35 + 3 * L1(l), dur: (l) => 35 + 10 * L1(l),
  desc: (l) => [`최대 생명력·마나 +${35 + 3 * L1(l)}%`, `지속 ${35 + 10 * L1(l)}초`],
  about: '전장의 규율이 몸에 힘을 불어넣는다.',
});
S('war_cry', 'warrior', 1, [0, 4], '전쟁의 포효', 24, ['battle_cry', 'battle_orders'], {
  kind: 'shout', mana: (l) => 10 + L1(l), icon: { g: 'shout', c: '#ff6040' }, cd: 0.6,
  radius: () => 3.5, dmg: (l, h) => [8 + 4 * L1(l), 12 + 5 * L1(l)], stun: (l) => 1 + 0.2 * L1(l),
  desc: (l) => [`반경 3.5칸 적에게 피해 ${8 + 4 * L1(l)}-${12 + 5 * L1(l)}`, `${(1 + 0.2 * L1(l)).toFixed(1)}초 기절`],
  about: '땅을 울리는 포효가 적을 짓누른다.',
});
S('weapon_mastery', 'warrior', 2, [0, 0], '무기 숙련', 1, [], {
  passive: true, icon: { g: 'sword', c: '#c0c8d0' },
  mods: (l) => ({ mastery: 20 + 6 * L1(l), tohitPct: 15 + 6 * L1(l) }),
  desc: (l) => [`무기 피해 +${20 + 6 * L1(l)}%`, `명중률 +${15 + 6 * L1(l)}%`],
  about: '오랜 수련으로 몸에 밴 검술.',
});
S('iron_skin', 'warrior', 2, [1, 1], '강철 피부', 6, [], {
  passive: true, icon: { g: 'shield', c: '#a0a0a8' },
  mods: (l) => ({ defPct: 30 + 10 * L1(l) }),
  desc: (l) => [`방어도 +${30 + 10 * L1(l)}%`],
  about: '상처가 쌓여 피부가 강철처럼 단단해졌다.',
});
S('increased_speed', 'warrior', 2, [2, 2], '신속', 12, [], {
  passive: true, icon: { g: 'boot', c: '#c0d0a0' },
  mods: (l) => ({ speedPct: Math.round(40 * l / (l + 5)) + 5 }),
  desc: (l) => [`이동 속도 +${Math.round(40 * l / (l + 5)) + 5}%`],
  about: '갑옷을 입고도 바람처럼 달린다.',
});
S('natural_resistance', 'warrior', 2, [1, 3], '자연 저항', 18, ['iron_skin'], {
  passive: true, icon: { g: 'ward', c: '#c080ff' },
  mods: (l) => ({ resAll: Math.round(65 * l / (l + 6)) + 5 }),
  desc: (l) => [`모든 저항 +${Math.round(65 * l / (l + 6)) + 5}%`],
  about: '원소의 힘을 몸으로 견뎌낸다.',
});

// ═════════ 로그 ═════════
S('magic_arrow', 'rogue', 0, [0, 0], '마법 화살', 1, [], {
  kind: 'arrow', mana: (l) => Math.max(0, 2 - 0.15 * L1(l)), icon: { g: 'arrow', c: '#a0b0ff' },
  dmgFlat: (l) => l, tohitPct: (l) => 10 + 6 * L1(l), vis: 'magic',
  desc: (l) => [`피해 +${l}`, `명중률 +${10 + 6 * L1(l)}%`, l >= 13 ? '마나 소모 없음' : `마나 ${Math.max(0, 2 - 0.15 * L1(l)).toFixed(1)}`],
  about: '마력으로 빚은 화살. 화살통이 필요 없다.',
});
S('fire_arrow', 'rogue', 0, [2, 0], '화염 화살', 1, [], {
  kind: 'arrow', mana: () => 3, icon: { g: 'arrow', c: '#ff8040' }, vis: 'arrow_fire',
  elem: (l) => ({ type: 'fire', d: [2 + 2 * L1(l), 5 + 3 * L1(l)] }), tohitPct: (l) => 10 + 5 * L1(l),
  desc: (l) => [`화염 피해 ${2 + 2 * L1(l)}-${5 + 3 * L1(l)} 추가`, `명중률 +${10 + 5 * L1(l)}%`],
  about: '불이 붙은 화살.',
});
S('cold_arrow', 'rogue', 0, [1, 1], '냉기 화살', 6, [], {
  kind: 'arrow', mana: () => 3.5, icon: { g: 'arrow', c: '#80d0ff' }, vis: 'arrow_ice',
  elem: (l) => ({ type: 'cold', d: [2 + 2 * L1(l), 4 + 2 * L1(l)], chill: 3 + 0.5 * L1(l) }), tohitPct: (l) => 10 + 5 * L1(l),
  desc: (l) => [`냉기 피해 ${2 + 2 * L1(l)}-${4 + 2 * L1(l)} 추가`, `${(3 + 0.5 * L1(l)).toFixed(1)}초 둔화`],
  about: '맞은 적을 얼려 느리게 한다.',
});
S('multishot', 'rogue', 0, [0, 1], '다중 사격', 6, ['magic_arrow'], {
  kind: 'arrow', mana: (l) => 4 + 0.5 * L1(l), icon: { g: 'multi', c: '#d0c080' },
  count: (l) => Math.min(12, 2 + l), mult: () => 0.75, spread: 0.18,
  desc: (l) => [`화살 ${Math.min(12, 2 + l)}발을 부채꼴로`, '한 발마다 피해 75%'],
  about: '한 번에 여러 발을 쏜다.',
});
S('exploding_arrow', 'rogue', 0, [2, 2], '폭발 화살', 12, ['fire_arrow', 'multishot'], {
  kind: 'arrow', mana: (l) => 5 + 0.5 * L1(l), icon: { g: 'burst', c: '#ff6020' }, vis: 'arrow_fire',
  explode: (l) => ({ r: 1.4, d: [4 + 4 * L1(l), 10 + 6 * L1(l)] }),
  desc: (l) => [`맞으면 폭발: 화염 ${4 + 4 * L1(l)}-${10 + 6 * L1(l)}`, '반경 1.4칸'],
  about: '촉에 화약을 채운 화살.',
});
S('guided_arrow', 'rogue', 0, [1, 3], '유도 화살', 18, ['cold_arrow', 'multishot'], {
  kind: 'arrow', mana: (l) => Math.max(3, 8 - 0.25 * L1(l)), icon: { g: 'arrow', c: '#ffe080' }, homing: true, sure: true,
  dmgPct: (l) => 8 * L1(l),
  desc: (l) => ['적을 쫓아가며 반드시 명중', `피해 +${8 * L1(l)}%`],
  about: '바람을 읽는 화살은 빗나가지 않는다.',
});
S('strafe', 'rogue', 0, [0, 4], '연사', 24, ['guided_arrow'], {
  kind: 'strafe', mana: () => 11, icon: { g: 'multi', c: '#ffd060' }, range: 9,
  count: (l) => Math.min(10, 4 + Math.floor(l / 2)), mult: () => 0.75, dmgPct: (l) => 5 * L1(l),
  desc: (l) => [`주변 적 최대 ${Math.min(10, 4 + Math.floor(l / 2))}명에게 연속 사격`, `한 발마다 피해 75% +${5 * L1(l)}%`],
  about: '숨 돌릴 틈 없이 쏟아지는 화살비.',
});
S('freezing_arrow', 'rogue', 0, [2, 5], '빙결 화살', 30, ['cold_arrow', 'guided_arrow'], {
  kind: 'arrow', mana: (l) => 9 + 0.5 * L1(l), icon: { g: 'snow', c: '#a0e0ff' }, vis: 'arrow_ice',
  explode: (l) => ({ r: 1.6, d: [15 + 6 * L1(l), 20 + 7 * L1(l)], type: 'cold', freeze: 2 }),
  desc: (l) => [`맞으면 냉기 폭발 ${15 + 6 * L1(l)}-${20 + 7 * L1(l)}`, '반경 1.6칸의 적을 2초간 얼림'],
  about: '얼음 숨결을 품은 화살.',
});
S('inner_sight', 'rogue', 1, [0, 0], '내면의 눈', 1, [], {
  kind: 'shout', mana: () => 5, icon: { g: 'eye', c: '#ffe0a0' }, cd: 1,
  radius: () => 6, dur: (l) => 8 + 4 * L1(l), sight: (l) => 10 + 5 * L1(l),
  desc: (l) => [`주변 적의 방어도 -${10 + 5 * L1(l)}`, `지속 ${8 + 4 * L1(l)}초, 적이 빛남`],
  about: '적의 약점을 비춘다.',
});
S('critical_strike', 'rogue', 1, [2, 0], '치명타', 1, [], {
  passive: true, icon: { g: 'star', c: '#ffd040' },
  mods: (l) => ({ crit: Math.round(55 * l / (l + 6)) + 5 }),
  desc: (l) => [`물리 피해 두 배 확률 ${Math.round(55 * l / (l + 6)) + 5}%`],
  about: '급소를 꿰뚫는 눈.',
});
S('dodge', 'rogue', 1, [1, 1], '회피', 6, [], {
  passive: true, icon: { g: 'dash', c: '#a0e0a0' },
  mods: (l) => ({ dodge: Math.round(50 * l / (l + 6)) + 6, avoid: Math.round(45 * l / (l + 7)) + 4 }),
  desc: (l) => [`근접 공격 회피 ${Math.round(50 * l / (l + 6)) + 6}%`, `원거리 공격 회피 ${Math.round(45 * l / (l + 7)) + 4}%`],
  about: '몸을 흘려 공격을 피한다.',
});
S('penetrate', 'rogue', 1, [2, 2], '관통력', 12, ['critical_strike'], {
  passive: true, icon: { g: 'arrow', c: '#e0e0e0' },
  mods: (l) => ({ tohitPct: 30 + 10 * L1(l) }),
  desc: (l) => [`명중률 +${30 + 10 * L1(l)}%`],
  about: '갑옷의 틈을 찾아낸다.',
});
S('decoy', 'rogue', 1, [0, 3], '미끼', 18, ['inner_sight'], {
  kind: 'summon', summon: 'decoy', mana: (l) => Math.max(5, 15 - 0.5 * L1(l)), icon: { g: 'ghost', c: '#c0d0ff' }, range: 8, target: 'point', cd: 1,
  dur: (l) => 10 + 4 * L1(l),
  desc: (l) => [`적을 끌어들이는 분신을 ${10 + 4 * L1(l)}초간 둔다`],
  about: '자신과 똑같은 환영.',
});
S('pierce', 'rogue', 1, [2, 4], '꿰뚫기', 24, ['penetrate'], {
  passive: true, icon: { g: 'pierce', c: '#ffffff' },
  mods: (l) => ({ pierce: Math.round(70 * l / (l + 5)) + 10 }),
  desc: (l) => [`화살이 적을 꿰뚫고 계속 날아갈 확률 ${Math.round(70 * l / (l + 5)) + 10}%`],
  about: '한 화살로 두 적을.',
});
S('shadow_warrior', 'rogue', 1, [1, 5], '그림자 전사', 30, ['decoy', 'dodge'], {
  kind: 'summon', summon: 'shadow', mana: (l) => 25 + L1(l), icon: { g: 'ghost', c: '#8060c0' }, range: 4, target: 'point', cd: 2,
  desc: (l) => [`함께 싸우는 그림자 전사를 부른다`, `생명력 ${100 + 30 * L1(l)}, 피해 ${6 + 3 * L1(l)}-${14 + 5 * L1(l)}`],
  about: '그림자에서 태어난 전사.',
});
S('fire_blast', 'rogue', 2, [0, 0], '화염 폭탄', 1, [], {
  kind: 'throw', mana: (l) => 2 + 0.25 * L1(l), icon: { g: 'bomb', c: '#ff7030' }, range: 8, target: 'point',
  dmg: (l, h) => [3 + 3 * L1(l) + Math.floor(h.st.dex / 10), 6 + 4 * L1(l) + Math.floor(h.st.dex / 8)], radius: 1.3,
  desc: (l, h) => { const d = SK.fire_blast.dmg(l, h); return [`폭탄을 던져 화염 피해 ${d[0]}-${d[1]}`, '반경 1.3칸']; },
  about: '손수 만든 화약 폭탄.',
});
S('shock_trap', 'rogue', 2, [1, 1], '전격 함정', 6, ['fire_blast'], {
  kind: 'trap', trap: 'shock', mana: (l) => 6 + 0.5 * L1(l), icon: { g: 'trap', c: '#a0c0ff' }, range: 7, target: 'point', cd: 0.5,
  dmg: (l) => [1 + 2 * L1(l), 10 + 4 * L1(l)], shots: () => 5,
  desc: (l) => [`가까이 온 적에게 번개 5번 발사`, `번개 피해 ${1 + 2 * L1(l)}-${10 + 4 * L1(l)}`, '함정 최대 3개'],
  about: '밟으면 번개가 튀는 덫.',
});
S('poison_cloud', 'rogue', 2, [0, 2], '독 구름', 12, ['fire_blast'], {
  kind: 'area', area: 'poison', mana: (l) => 7 + 0.5 * L1(l), icon: { g: 'cloud', c: '#80e040' }, range: 8, target: 'point', cd: 0.5,
  dps: (l, h) => [6 + 4 * L1(l), 10 + 6 * L1(l)], radius: () => 2, dur: () => 5,
  desc: (l, h) => { const d = SK.poison_cloud.dps(l, h); return [`독 구름: 초당 독 피해 ${d[0]}-${d[1]}`, '반경 2칸, 5초']; },
  about: '숨 쉬는 것만으로도 죽는다.',
});
S('lightning_sentry', 'rogue', 2, [1, 3], '번개 감시탑', 18, ['shock_trap'], {
  kind: 'trap', trap: 'sentry', mana: (l) => 12 + 0.5 * L1(l), icon: { g: 'tower', c: '#c0d8ff' }, range: 7, target: 'point', cd: 0.5,
  dmg: (l) => [1, 20 + 8 * L1(l)], shots: () => 10,
  desc: (l) => [`적에게 번개를 10번 쏘는 감시탑`, `번개 피해 1-${20 + 8 * L1(l)}`, '감시탑 최대 3개'],
  about: '스스로 적을 찾아 쏘는 기계.',
});

// ═════════ 소서러 ═════════
S('fire_bolt', 'sorcerer', 0, [1, 0], '화염탄', 1, [], {
  kind: 'missile', vis: 'fire', type: 'fire', mana: () => 3, speed: 10, icon: { g: 'fire', c: '#ff7020' }, sfx: 'fire_bolt',
  dmg: (l, h) => [l + Math.floor(h.st.mag / 8) + 1, l + Math.floor(h.st.mag / 8) + 10], light: 2,
  desc: (l, h) => { const d = sdmg('fire_bolt', l, h); return [`화염 피해 ${d[0]}-${d[1]}`]; },
  about: '불덩이를 날린다. 마력이 높을수록 강하다.',
});
S('warmth', 'sorcerer', 0, [2, 0], '온기', 1, [], {
  passive: true, icon: { g: 'sun', c: '#ffb040' },
  mods: (l) => ({ manaRegen: 30 + 12 * L1(l) }),
  desc: (l) => [`마나 재생 +${30 + 12 * L1(l)}%`],
  about: '몸속의 불씨가 마나를 데운다.',
});
S('fireball', 'sorcerer', 0, [1, 2], '화염구', 12, ['fire_bolt'], {
  kind: 'missile', vis: 'fireball', type: 'fire', mana: (l) => 10 + 0.5 * L1(l), speed: 9, radius: 1.3, icon: { g: 'fireball', c: '#ff5010' }, sfx: 'cast_fire',
  dmg: (l, h) => [Math.round((4 + 2 * h.data.lvl) * (1 + 0.12 * L1(l))), Math.round((20 + 2 * h.data.lvl) * (1 + 0.12 * L1(l)))], light: 3,
  desc: (l, h) => { const d = sdmg('fireball', l, h); return [`폭발 화염 피해 ${d[0]}-${d[1]}`, '반경 1.3칸', '캐릭터 레벨이 오를수록 강해짐']; },
  about: '닿는 순간 터지는 화염의 구.',
});
S('fire_wall', 'sorcerer', 0, [2, 3], '화염벽', 18, ['fireball'], {
  kind: 'area', area: 'firewall', mana: (l) => 22 + L1(l), icon: { g: 'wall', c: '#ff6020' }, range: 9, target: 'point', sfx: 'fire_wall', cd: 0.5,
  dps: (l, h) => [Math.round((6 + 2 * h.data.lvl) * (1 + 0.15 * L1(l))), Math.round((10 + 2.5 * h.data.lvl) * (1 + 0.15 * L1(l)))], len: (l) => Math.min(11, 5 + Math.floor(l / 2)), dur: () => 4.5,
  desc: (l, h) => { const d = sdmg('fire_wall', l, h, 'dps'); return [`길이 ${Math.min(11, 5 + Math.floor(l / 2))}칸의 불벽`, `초당 화염 피해 ${d[0]}-${d[1]}`, '4.5초 지속']; },
  about: '불길이 벽처럼 치솟는다.',
});
S('meteor', 'sorcerer', 0, [1, 4], '메테오', 24, ['fire_wall', 'fireball'], {
  kind: 'area', area: 'meteor', mana: (l) => 17 + 0.5 * L1(l), icon: { g: 'meteor', c: '#ff4000' }, range: 10, target: 'point', sfx: 'meteor_fall', cd: 1,
  dmg: (l, h) => [Math.round((20 + 3 * h.data.lvl) * (1 + 0.12 * L1(l))), Math.round((40 + 4 * h.data.lvl) * (1 + 0.12 * L1(l)))],
  desc: (l, h) => { const d = sdmg('meteor', l, h); return [`1초 뒤 운석 낙하: 화염 피해 ${d[0]}-${d[1]}`, '반경 2칸, 3초간 땅이 불탄다']; },
  about: '하늘에서 불타는 바위를 끌어내린다.',
});
S('fire_mastery', 'sorcerer', 0, [0, 5], '화염 숙련', 30, [], {
  passive: true, icon: { g: 'fire', c: '#ffd040' },
  mods: (l) => ({ fireMastery: 30 + 7 * L1(l) }),
  desc: (l) => [`화염 기술 피해 +${30 + 7 * L1(l)}%`],
  about: '불의 본질을 깨달았다.',
});
S('charged_bolt', 'sorcerer', 1, [1, 0], '충전된 화살', 1, [], {
  kind: 'charged', mana: (l) => 3 + 0.25 * L1(l), icon: { g: 'spark', c: '#c0d0ff' }, sfx: 'charged_bolt',
  count: (l) => 4 + Math.floor(l / 2), dmg: (l, h) => [1, 1 + Math.floor(h.st.mag / 4) + 2 * L1(l)],
  desc: (l, h) => { const d = sdmg('charged_bolt', l, h); return [`번개 불똥 ${4 + Math.floor(l / 2)}개`, `하나마다 번개 피해 ${d[0]}-${d[1]}`]; },
  about: '제멋대로 튀어 다니는 번개 불똥.',
});
S('static_field', 'sorcerer', 1, [0, 1], '정전기장', 6, ['charged_bolt'], {
  kind: 'static', mana: () => 9, icon: { g: 'ring', c: '#a0c0ff' }, sfx: 'static_field', cd: 0.4,
  radius: (l) => Math.min(8, 3 + 0.5 * L1(l)),
  desc: (l) => [`반경 ${Math.min(8, 3 + 0.5 * L1(l)).toFixed(1)}칸 적의 현재 생명력 25% 감소`],
  about: '공기 중의 번개가 적을 태운다.',
});
S('lightning', 'sorcerer', 1, [1, 2], '번개', 12, ['charged_bolt'], {
  kind: 'beam', mana: (l) => 10 + 0.5 * L1(l), icon: { g: 'bolt', c: '#ffff80' }, range: 11, sfx: 'lightning',
  dmg: (l, h) => [1, Math.round((15 + 2.5 * h.data.lvl) * (1 + 0.1 * L1(l)))],
  desc: (l, h) => { const d = sdmg('lightning', l, h); return [`일직선 위 모든 적에게 번개 피해 ${d[0]}-${d[1]}`]; },
  about: '손끝에서 번개가 뻗어 나간다.',
});
S('nova', 'sorcerer', 1, [0, 3], '노바', 18, ['static_field'], {
  kind: 'nova', type: 'light', mana: (l) => 15 + L1(l), icon: { g: 'nova', c: '#d0e0ff' }, radius: () => 4.5, sfx: 'nova',
  dmg: (l, h) => [Math.round((1 + h.data.lvl / 2) * (1 + 0.1 * L1(l))), Math.round((10 + 2 * h.data.lvl) * (1 + 0.1 * L1(l)))],
  desc: (l, h) => { const d = sdmg('nova', l, h); return [`주변 4.5칸 번개 고리: 피해 ${d[0]}-${d[1]}`]; },
  about: '사방으로 퍼지는 번개의 고리.',
});
S('chain_lightning', 'sorcerer', 1, [1, 4], '연쇄 번개', 24, ['lightning'], {
  kind: 'chain', mana: (l) => 18 + L1(l), icon: { g: 'chain', c: '#ffffa0' }, range: 10, sfx: 'chain_lightning',
  dmg: (l, h) => [1, Math.round((14 + 2.3 * h.data.lvl) * (1 + 0.1 * L1(l)))], jumps: (l) => 3 + Math.floor(l / 3),
  desc: (l, h) => { const d = sdmg('chain_lightning', l, h); return [`번개 피해 ${d[0]}-${d[1]}`, `적 사이를 ${3 + Math.floor(l / 3)}번 건너뜀`]; },
  about: '적에서 적으로 튀는 번개.',
});
S('teleport', 'sorcerer', 1, [2, 3], '순간 이동', 18, ['static_field'], {
  kind: 'teleport', mana: (l) => Math.max(8, 24 - L1(l)), icon: { g: 'tele', c: '#c0a0ff' }, range: 10, target: 'point', town: false, sfx: 'teleport',
  desc: (l) => ['보이는 곳으로 순간 이동', `마나 ${Math.max(8, 24 - L1(l))}`],
  about: '공간을 접어 단숨에 건너간다.',
});
S('energy_shield', 'sorcerer', 1, [2, 5], '에너지 보호막', 30, ['chain_lightning', 'teleport'], {
  kind: 'buff', mana: () => 10, icon: { g: 'orb', c: '#80b0ff' }, sfx: 'mana_shield',
  absorb: (l) => Math.min(75, 25 + 3 * L1(l)), dur: (l) => 60 + 20 * L1(l),
  desc: (l) => [`받는 피해의 ${Math.min(75, 25 + 3 * L1(l))}%를 마나로 대신 받음`, `지속 ${60 + 20 * L1(l)}초`],
  about: '마나로 짠 보호막.',
});
S('lightning_mastery', 'sorcerer', 1, [0, 5], '번개 숙련', 30, [], {
  passive: true, icon: { g: 'bolt', c: '#ffff40' },
  mods: (l) => ({ lightMastery: 40 + 10 * L1(l) }),
  desc: (l) => [`번개 기술 피해 +${40 + 10 * L1(l)}%`],
  about: '번개를 손발처럼 부린다.',
});
S('ice_bolt', 'sorcerer', 2, [1, 0], '얼음 화살', 1, [], {
  kind: 'missile', vis: 'ice', type: 'cold', mana: () => 3, speed: 10, icon: { g: 'shard', c: '#a0d8ff' }, sfx: 'ice_bolt',
  dmg: (l, h) => [2 + 2 * L1(l) + Math.floor(h.st.mag / 10), 4 + 3 * L1(l) + Math.floor(h.st.mag / 8)], chill: (l) => 3 + 0.5 * L1(l), light: 1.5,
  desc: (l, h) => { const d = sdmg('ice_bolt', l, h); return [`냉기 피해 ${d[0]}-${d[1]}`, `${(3 + 0.5 * L1(l)).toFixed(1)}초 둔화`]; },
  about: '적을 꿰뚫고 얼리는 얼음 조각.',
});
S('frozen_armor', 'sorcerer', 2, [2, 0], '냉기 갑옷', 1, [], {
  kind: 'buff', mana: () => 7, icon: { g: 'armor', c: '#a0e0ff' }, sfx: 'armor_buff',
  def: (l) => 30 + 8 * L1(l), dur: (l) => 60 + 12 * L1(l),
  desc: (l) => [`방어도 +${30 + 8 * L1(l)}%`, '근접 공격한 적을 얼림', `지속 ${60 + 12 * L1(l)}초`],
  about: '얼음 결정이 몸을 감싼다.',
});
S('frost_nova', 'sorcerer', 2, [0, 1], '서리 노바', 6, [], {
  kind: 'nova', type: 'cold', mana: (l) => 9 + 0.5 * L1(l), icon: { g: 'snow', c: '#c0e8ff' }, radius: () => 4, chill: () => 6, sfx: 'frost_nova',
  dmg: (l, h) => [Math.round((2 + h.data.lvl / 2) * (1 + 0.12 * L1(l))), Math.round((4 + h.data.lvl) * (1 + 0.12 * L1(l)))],
  desc: (l, h) => { const d = sdmg('frost_nova', l, h); return [`주변 4칸 냉기 피해 ${d[0]}-${d[1]}`, '6초 둔화']; },
  about: '얼어붙은 숨결이 사방으로 퍼진다.',
});
S('ice_blast', 'sorcerer', 2, [1, 1], '얼음 폭발', 6, ['ice_bolt'], {
  kind: 'missile', vis: 'ice', type: 'cold', mana: (l) => 6 + 0.5 * L1(l), speed: 11, icon: { g: 'shard', c: '#80c0ff' }, sfx: 'ice_bolt',
  dmg: (l, h) => [6 + 3 * L1(l) + h.data.lvl, 10 + 4 * L1(l) + h.data.lvl], freeze: (l) => 2 + 0.2 * L1(l),
  desc: (l, h) => { const d = sdmg('ice_blast', l, h); return [`냉기 피해 ${d[0]}-${d[1]}`, `${(2 + 0.2 * L1(l)).toFixed(1)}초 빙결`]; },
  about: '맞은 적을 통째로 얼린다.',
});
S('glacial_spike', 'sorcerer', 2, [1, 3], '빙하 가시', 18, ['ice_blast'], {
  kind: 'missile', vis: 'spike', type: 'cold', mana: (l) => 10 + 0.5 * L1(l), speed: 10, radius: 1.4, icon: { g: 'spike', c: '#e0f4ff' }, sfx: 'ice_bolt',
  dmg: (l, h) => [12 + 6 * L1(l) + h.data.lvl, 18 + 8 * L1(l) + h.data.lvl], freeze: () => 1.5,
  desc: (l, h) => { const d = sdmg('glacial_spike', l, h); return [`폭발 냉기 피해 ${d[0]}-${d[1]}`, '반경 1.4칸 1.5초 빙결']; },
  about: '빙하에서 떼어낸 거대한 가시.',
});
S('blizzard', 'sorcerer', 2, [0, 4], '눈보라', 24, ['frost_nova', 'glacial_spike'], {
  kind: 'area', area: 'blizzard', mana: (l) => 23 + L1(l), icon: { g: 'storm', c: '#c0e0ff' }, range: 10, target: 'point', sfx: 'blizzard', cd: 1.8,
  dps: (l, h) => [Math.round((15 + h.data.lvl) * (1 + 0.15 * L1(l))), Math.round((25 + 2 * h.data.lvl) * (1 + 0.15 * L1(l)))],
  desc: (l, h) => { const d = sdmg('blizzard', l, h, 'dps'); return [`반경 2.5칸에 4초간 얼음 비`, `초당 냉기 피해 ${d[0]}-${d[1]}`, '재사용 1.8초']; },
  about: '하늘이 얼음을 쏟아붓는다.',
});
S('frozen_orb', 'sorcerer', 2, [1, 5], '얼음 구체', 30, ['blizzard'], {
  kind: 'orb', mana: (l) => 25 + 0.5 * L1(l), icon: { g: 'orbice', c: '#a0e8ff' }, range: 10, sfx: 'frozen_orb', cd: 1,
  dmg: (l, h) => [8 + 3 * L1(l) + Math.floor(h.data.lvl / 2), 12 + 4 * L1(l) + Math.floor(h.data.lvl / 2)],
  desc: (l, h) => { const d = sdmg('frozen_orb', l, h); return [`날아가며 얼음 파편을 흩뿌리는 구체`, `파편마다 냉기 피해 ${d[0]}-${d[1]}`]; },
  about: '얼음 칼날이 소용돌이친다.',
});
S('cold_mastery', 'sorcerer', 2, [2, 5], '냉기 숙련', 30, [], {
  passive: true, icon: { g: 'snow', c: '#ffffff' },
  mods: (l) => ({ coldPierce: 20 + 5 * L1(l) }),
  desc: (l) => [`적의 냉기 저항 -${20 + 5 * L1(l)}%`],
  about: '얼음 앞에 버틸 것은 없다.',
});

export const SKILLS = SK;
export function skillDef(id) { return SK[id]; }
export function skillsOf(cls) { return Object.values(SK).filter((s) => s.cls === cls); }

// 숙련 보정이 들어간 기술 피해(설명창에도 쓴다)
export function sdmg(id, l, h, key = 'dmg') {
  const s = SK[id];
  const d = s[key](l, h);
  const m = h.mods || {};
  const k = 1 + ((s.type === 'fire' || s.area === 'firewall' || s.area === 'meteor' || id === 'fireball' || id === 'fire_bolt' ? m.fireMastery : 0) || 0) / 100
    + ((s.kind === 'beam' || s.kind === 'chain' || s.kind === 'charged' || s.type === 'light' ? m.lightMastery : 0) || 0) / 100;
  return [Math.round(d[0] * k), Math.round(d[1] * k)];
}

export function skillManaCost(h, id) {
  const s = SK[id];
  if (!s || s.passive || id === 'attack') return 0;
  return Math.round(s.mana(Math.max(1, h.skillLevel(id))) * 10) / 10;
}

// 패시브 기술 효과 합계
export function passiveMods(h) {
  const out = {};
  for (const id in h.data.skills) {
    const s = SK[id];
    if (!s?.passive || !h.data.skills[id]) continue;
    const lv = h.data.skills[id] + (h.st?.skills || 0);
    const m = s.mods(lv);
    for (const k in m) out[k] = (out[k] || 0) + m[k];
  }
  return out;
}

// ───────── 시전 ─────────
export function castSkill(game, P, id, target, point) {
  const h = P.hero;
  if (id === 'attack') {
    if (!target) game.freeAttack();
    else if (h.ranged()) rangedAttack(game, P, target, {}); else meleeAttack(game, P, target, {});
    return true;
  }
  const s = SK[id];
  const lv = h.skillLevel(id);
  if (!s || !lv || s.passive) return false;
  const cost = s.mana(lv);
  if (P.mp < cost - 0.01) { game.sfx('no_mana', P.x, P.y); game.toast('마나가 부족합니다', 'warn'); return false; }
  h.cd = h.cd || {};
  if (s.cd && h.cd[id] > game.time) { game.sfx('ui_error'); return false; }
  // 무기 조건
  if ((s.kind === 'arrow' || s.kind === 'strafe') && !h.ranged()) { game.toast('활이 필요합니다', 'warn'); game.sfx('ui_error'); return false; }
  if ((s.kind === 'melee' || s.kind === 'cleave' || s.kind === 'leap' || s.kind === 'whirl') && h.ranged()) { game.toast('근접 무기가 필요합니다', 'warn'); game.sfx('ui_error'); return false; }
  P.mp -= cost;
  if (s.cd) h.cd[id] = game.time + s.cd;
  const pt = point || (target ? { x: target.x, y: target.y } : { x: P.x + Math.cos(P.face), y: P.y + Math.sin(P.face) });
  if (Math.hypot(pt.x - P.x, pt.y - P.y) > 0.1) P.turnTo(pt.x, pt.y);
  const castT = h.st.castTime, dur = castT + 0.12;
  const doCast = (fn, anim = 'cast', sfx = s.sfx) => {
    P.setAnim(anim, dur, { hitAt: castT / dur, onHit: () => { fn(); if (sfx) game.sfx(sfx, P.x, P.y); } });
    game.sfx(s.kind === 'missile' && s.type === 'cold' ? 'cast_ice' : s.type === 'fire' || s.area === 'firewall' || s.area === 'meteor' ? 'cast_fire' : s.kind === 'beam' || s.kind === 'chain' || s.kind === 'charged' || s.kind === 'nova' && s.type === 'light' ? 'cast_lightning' : 'ui_click', P.x, P.y, { vol: 0.5 });
  };
  const fx = game.fx;
  switch (s.kind) {
    case 'melee': {
      const mod = { dmgPct: s.dmgPct?.(lv) || 0, dmgFlat: s.dmgFlat?.(lv) || 0, tohitPct: s.tohitPct?.(lv) || 0, knock: s.knock, type: s.type, uninterruptible: s.uninterruptible };
      if (s.defBuff) addBuff(P, 'concentrate', { t: h.st.atkTime + 0.3, mods: { defPct: s.defBuff(lv) } });
      if (s.berserk) addBuff(P, 'berserk', { t: 2, mods: { defPct: -100 } });
      // 그 자리에서 휘두른다: 겨눈 적이 손 닿는 곳에 없으면 그쪽 빈 곳으로(내려치는 순간 앞쪽의 적이 맞는다)
      const t = target && Math.hypot(target.x - P.x, target.y - P.y) <= MELEE_HIT + 0.6 ? target : null;
      meleeAttack(game, P, t, { ...mod, ang: Math.atan2(pt.y - P.y, pt.x - P.x) });
      if (id === 'bash') game.sfx('swing_heavy', P.x, P.y, { vol: 0.5 });
      return true;
    }
    case 'cleave': {
      const st = h.st, hitT = st.atkTime, d2 = hitT + 0.12;
      P.setAnim('attack', d2, {
        hitAt: hitT / d2, style: 'swing', onHit: () => {
          const fa = P.face; let n = 0;
          for (const a of game.level.actors.slice()) {
            if (a.dead || a.team === P.team || a.kind === 'npc') continue;
            const dx = a.x - P.x, dy = a.y - P.y, dd = Math.hypot(dx, dy);
            if (dd > 1.8) continue;
            const da = Math.abs(((Math.atan2(dy, dx) - fa + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (da > 1.25 && dd > 0.5) continue;
            resolveMelee(game, P, a, { dmgPct: s.dmgPct(lv), sure: false });
            n++;
          }
          fx.ring(P.x + Math.cos(fa) * 0.6, P.y + Math.sin(fa) * 0.6, 0.3, 1.4, 0.2, [255, 230, 180], 2);
        },
      });
      game.sfx('swing_heavy', P.x, P.y);
      return true;
    }
    case 'leap': {
      const L = game.level;
      let tx = Math.round(pt.x), ty = Math.round(pt.y);
      const dd = Math.hypot(tx - P.tx, ty - P.ty);
      if (dd > s.range) { tx = Math.round(P.x + (pt.x - P.x) / dd * s.range); ty = Math.round(P.y + (pt.y - P.y) / dd * s.range); }
      const land = L.nearestFree(tx, ty, 3, P.id, (x, y) => L.los(P.tx, P.ty, x, y));
      if (!land) { P.mp += cost; return false; }
      const sx = P.x, sy = P.y, T = 0.5;
      P.release(L);
      P.leap = { sx, sy, tx: land.x, ty: land.y, t: 0, T };
      L.occ[land.y * L.w + land.x] = P.id;
      P.setAnim('special', T + 0.15, { hitAt: T / (T + 0.15), onHit: () => {
        P.leap = null;
        P.place(L, land.x, land.y);
        fx.ring(P.x, P.y, 0.2, 2, 0.35, [230, 200, 150], 3); fx.shake(0.4); fx.smoke(P.x, P.y, 2, 6, [90, 80, 70]);
        game.sfx('leap_land', P.x, P.y);
        for (const a of L.actors.slice()) {
          if (a.dead || a.team === P.team || a.kind === 'npc' || Math.hypot(a.x - P.x, a.y - P.y) > 1.9) continue;
          resolveMelee(game, P, a, { dmgPct: s.dmgPct(lv), sure: true, knock: true });
        }
      } });
      game.sfx('leap', P.x, P.y);
      return true;
    }
    case 'whirl': {
      P.whirl = { t: 1.6, tick: 0, x: pt.x, y: pt.y, dmgPct: s.dmgPct(lv), hit: new Map() };
      P.setAnim('attack', 1.6, { style: 'spin' });
      P.uninterruptible = true;
      game.whirlSnd = game.hooks.loop?.('whirlwind_loop');
      return true;
    }
    case 'shout': {
      P.setAnim('special', 0.5, { hitAt: 0.4, onHit: () => {
        const r = s.radius(lv);
        fx.ring(P.x, P.y, 0.3, r, 0.5, id === 'inner_sight' ? [255, 230, 150] : [255, 200, 120], 3);
        for (const a of game.level.actors.slice()) {
          if (a.dead || a.team === P.team || a.kind === 'npc' || Math.hypot(a.x - P.x, a.y - P.y) > r) continue;
          if (id === 'howl') { a.fear = s.dur(lv); a.aware = true; }
          if (id === 'battle_cry') addBuff(a, 'battleCry', { t: s.dur(lv), def: s.cryDef(lv), dmg: s.cryDmg(lv) });
          if (id === 'inner_sight') addBuff(a, 'innerSight', { t: s.dur(lv), k: s.sight(lv) });
          if (id === 'war_cry') { const d = s.dmg(lv, h); damageActor(game, a, rnd(d[0], d[1]), 'phys', P, { stun: s.stun(lv) }); }
        }
        if (id === 'inner_sight') addBuff(P, 'innerSight', { t: s.dur(lv) });
      } });
      game.sfx(id === 'inner_sight' ? 'shrine' : 'warcry', P.x, P.y);
      return true;
    }
    case 'buff': {
      P.setAnim(id === 'shout' || id === 'battle_orders' ? 'special' : 'cast', 0.5, { hitAt: 0.5, onHit: () => {} });
      if (id === 'shout') addBuff(P, 'shout', { t: s.dur(lv), mods: { defPct: s.def(lv) } });
      if (id === 'battle_orders') addBuff(P, 'battleOrders', { t: s.dur(lv), mods: { lifePct: s.pct(lv), manaPct: s.pct(lv) } });
      if (id === 'frozen_armor') addBuff(P, 'frozenArmor', { t: s.dur(lv), mods: { defPct: s.def(lv) } });
      if (id === 'energy_shield') addBuff(P, 'energyShield', { t: s.dur(lv), absorb: s.absorb(lv) / 100, cost: 1.5 });
      fx.magic(P.x, P.y, 30, 16, id === 'frozen_armor' ? [150, 210, 255] : id === 'energy_shield' ? [120, 160, 255] : [255, 220, 140]);
      game.sfx(id === 'shout' || id === 'battle_orders' ? 'shout_buff' : s.sfx || 'armor_buff', P.x, P.y);
      return true;
    }
    case 'arrow': {
      const mod = {
        dmgPct: s.dmgPct?.(lv) || 0, dmgFlat: s.dmgFlat?.(lv) || 0, tohitPct: s.tohitPct?.(lv) || 0, vis: s.vis, count: s.count?.(lv) || 1, mult: s.mult?.(lv) ?? 1, spread: s.spread,
        elem: s.elem?.(lv), homing: s.homing, sure: s.sure, type: id === 'magic_arrow' ? 'magic' : 'phys',
      };
      if (s.explode) {
        const ex = s.explode(lv);
        mod.explode = ex;
        mod.onEnd = true;
      }
      shootArrows(game, P, target, pt, mod);
      return true;
    }
    case 'strafe': {
      const targets = game.level.actors.filter((a) => !a.dead && a.team !== P.team && a.kind !== 'npc' && Math.hypot(a.x - P.x, a.y - P.y) <= s.range && game.canSee(a) && game.level.los(P.tx, P.ty, a.tx, a.ty));
      targets.sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y));
      const n = s.count(lv);
      const list = [];
      for (let i = 0; i < n && targets.length; i++) list.push(targets[i % targets.length]);
      if (!list.length && target) list.push(target);
      if (!list.length) { P.mp += cost; return false; }
      const per = Math.max(0.09, h.st.atkTime * 0.35);
      P.setAnim('attack', per * list.length + 0.15, { style: 'bow' });
      list.forEach((t, i) => setTimeout(() => {
        if (P.dead || t.dead) return;
        P.turnTo(t.x, t.y);
        fireArrow(game, P, Math.atan2(t.y - P.y, t.x - P.x), t, { dmgPct: s.dmgPct(lv), mult: s.mult(lv), homing: true, vis: 'arrow' });
        game.sfx('bow_shoot', P.x, P.y, { vol: 0.6 });
      }, i * per * 1000));
      return true;
    }
    case 'missile': {
      doCast(() => {
        const d = sdmg(id, lv, h);
        const a = Math.atan2(pt.y - P.y, pt.x - P.x);
        spawnMissile(game, {
          x: P.x + Math.cos(a) * 0.5, y: P.y + Math.sin(a) * 0.5, z: 36, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, life: 1.4, owner: P, team: P.team, kind: id, vis: s.vis,
          dmg: d, type: s.type, radius: s.radius || 0, light: s.light, chill: s.chill?.(lv), freeze: s.freeze?.(lv), homing: null,
          onHit: s.radius ? null : (g, m, t) => { damageActor(g, t, rnd(m.dmg[0], m.dmg[1]), m.type, P); if (m.chill && !t.dead) addBuff(t, 'chill', { t: m.chill }); if (m.freeze && !t.dead) freeze(t, m.freeze); if (m.type === 'cold') g.sfx('ice_shatter', t.x, t.y, { vol: 0.6 }); return true; },
        });
      });
      return true;
    }
    case 'charged': {
      doCast(() => {
        const n = s.count(lv), d = sdmg(id, lv, h);
        const base = Math.atan2(pt.y - P.y, pt.x - P.x);
        for (let i = 0; i < n; i++) {
          const a = base + (Math.random() - 0.5) * 1.2, sp = 5.5 + Math.random() * 2;
          spawnMissile(game, {
            x: P.x, y: P.y, z: 24, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.3, owner: P, team: P.team, kind: 'charged', vis: 'charged', dmg: d, type: 'light', light: 1,
            update: (g, m, dt) => { m.jit = (m.jit || 0) + dt; if (m.jit > 0.1) { m.jit = 0; const na = Math.atan2(m.vy, m.vx) + (Math.random() - 0.5) * 1.4, sp2 = Math.hypot(m.vx, m.vy); m.vx = Math.cos(na) * sp2; m.vy = Math.sin(na) * sp2; } },
          });
        }
      });
      return true;
    }
    case 'beam': {
      doCast(() => {
        const d = sdmg(id, lv, h), a = Math.atan2(pt.y - P.y, pt.x - P.x);
        const L = game.level;
        let ex = P.x, ey = P.y;
        for (let k = 0; k < s.range * 4; k++) { const nx = P.x + Math.cos(a) * k / 4, ny = P.y + Math.sin(a) * k / 4; if (L.opaque(Math.round(nx), Math.round(ny))) break; ex = nx; ey = ny; }
        fx.bolt(P.x + Math.cos(a) * 0.4, P.y + Math.sin(a) * 0.4, 38, ex, ey, 30, [170, 200, 255], 0.25, 2.5);
        fx.flash(ex, ey, 1.5, [170, 200, 255], 0.2);
        for (const t of L.actors.slice()) {
          if (t.dead || t.team === P.team || t.kind === 'npc') continue;
          if (distSeg(t.x, t.y, P.x, P.y, ex, ey) > 0.6) continue;
          damageActor(game, t, rnd(d[0], d[1]), 'light', P);
        }
      });
      return true;
    }
    case 'chain': {
      doCast(() => {
        const d = sdmg(id, lv, h);
        let t0 = target || game.nearestEnemy(s.range);
        if (!t0) { fx.bolt(P.x, P.y, 38, pt.x, pt.y, 30, [200, 220, 255], 0.2); return; }
        const hit = new Set();
        let from = P, cur = t0;
        for (let j = 0; j <= s.jumps(lv) && cur; j++) {
          fx.bolt(from.x, from.y, from === P ? 38 : 30, cur.x, cur.y, 30, [200, 220, 255], 0.3, 2.2);
          damageActor(game, cur, rnd(d[0], d[1]), 'light', P);
          hit.add(cur);
          from = cur;
          let best = null, bd = 4.5;
          for (const a of game.level.actors) { if (a.dead || a.team === P.team || hit.has(a) || a.kind === 'npc') continue; const dd = Math.hypot(a.x - from.x, a.y - from.y); if (dd < bd) { bd = dd; best = a; } }
          cur = best;
        }
      });
      return true;
    }
    case 'nova': {
      doCast(() => {
        const d = sdmg(id, lv, h), r = s.radius(lv);
        const col = s.type === 'cold' ? [160, 220, 255] : [180, 200, 255];
        fx.ring(P.x, P.y, 0.3, r, 0.45, col, 4, true);
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; fx.p(P.x + Math.cos(a) * 0.5, P.y + Math.sin(a) * 0.5, 20, { vx: Math.cos(a) * r * 2, vy: Math.sin(a) * r * 2, life: 0.45, size: 2.5, col, glow: true, kind: 'spark', drag: 0.98 }); }
        areaDamage(game, P.x, P.y, r, d, s.type, P, P.team, { chill: s.chill?.(lv) });
      });
      return true;
    }
    case 'static': {
      doCast(() => {
        const r = s.radius(lv);
        fx.ring(P.x, P.y, 0.2, r, 0.35, [150, 180, 255], 2, true);
        for (const a of game.level.actors.slice()) {
          if (a.dead || a.team === P.team || a.kind === 'npc' || Math.hypot(a.x - P.x, a.y - P.y) > r) continue;
          if (a.res?.light >= 100) continue;
          const dmg = Math.max(1, Math.floor(a.hp * (a.boss ? 0.15 : 0.25)));
          damageActor(game, a, dmg, 'light', P, { pure: true, noStun: true });
          fx.bolt(a.x, a.y, 70, a.x + 0.1, a.y + 0.1, 20, [180, 200, 255], 0.15, 1.5);
        }
      });
      return true;
    }
    case 'teleport': {
      const L = game.level;
      let tx = Math.round(pt.x), ty = Math.round(pt.y);
      const dd = Math.hypot(tx - P.tx, ty - P.ty);
      if (dd > s.range) { tx = Math.round(P.x + (pt.x - P.x) / dd * s.range); ty = Math.round(P.y + (pt.y - P.y) / dd * s.range); }
      const spot = L.nearestFree(tx, ty, 3, P.id, (x, y) => L.flags[y * L.w + x] & 8);
      if (!spot) { P.mp += cost; game.sfx('ui_error'); return false; }
      doCast(() => {
        fx.magic(P.x, P.y, 30, 20, [190, 160, 255]); fx.flash(P.x, P.y, 2, [190, 160, 255], 0.3);
        P.place(L, spot.x, spot.y);
        P.invuln = 0.2;
        fx.magic(P.x, P.y, 30, 20, [190, 160, 255]); fx.flash(P.x, P.y, 2, [190, 160, 255], 0.3);
        game.cmd = null;
      });
      return true;
    }
    case 'area': {
      doCast(() => castArea(game, P, s, lv, pt));
      return true;
    }
    case 'orb': {
      doCast(() => {
        const d = sdmg(id, lv, h), a = Math.atan2(pt.y - P.y, pt.x - P.x);
        spawnMissile(game, {
          x: P.x + Math.cos(a) * 0.5, y: P.y + Math.sin(a) * 0.5, z: 34, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, life: 2.6, owner: P, team: P.team, kind: 'orb', vis: 'orb', dmg: d, light: 3, hitR: 0, ghost: false,
          onHit: () => false,
          update: (g, m, dt) => {
            m.sh = (m.sh || 0) + dt; m.ang = (m.ang || 0) + dt * 9;
            if (m.sh > 0.06) {
              m.sh = 0;
              for (let k = 0; k < 2; k++) {
                const sa = m.ang + k * Math.PI;
                spawnMissile(g, { x: m.x, y: m.y, z: 30, vx: Math.cos(sa) * 7, vy: Math.sin(sa) * 7, life: 0.55, owner: P, team: P.team, kind: 'shard', vis: 'ice', dmg: m.dmg, type: 'cold', hitR: 0.4,
                  onHit: (gg, mm, t) => { damageActor(gg, t, rnd(mm.dmg[0], mm.dmg[1]), 'cold', P, { noStun: Math.random() < 0.5, quiet: true }); if (!t.dead) addBuff(t, 'chill', { t: 4 }); return true; } });
              }
            }
          },
          onEnd: (g, m) => {
            for (let k = 0; k < 16; k++) { const sa = k / 16 * Math.PI * 2; spawnMissile(g, { x: m.x, y: m.y, z: 30, vx: Math.cos(sa) * 7, vy: Math.sin(sa) * 7, life: 0.6, owner: P, team: P.team, kind: 'shard', vis: 'ice', dmg: m.dmg, type: 'cold', onHit: (gg, mm, t) => { damageActor(gg, t, rnd(mm.dmg[0], mm.dmg[1]), 'cold', P, { quiet: true }); return true; } }); }
            g.sfx('ice_shatter', m.x, m.y);
          },
        });
      });
      return true;
    }
    case 'throw': {
      doCast(() => {
        const d = s.dmg(lv, h);
        const L = game.level;
        let tx = pt.x, ty = pt.y;
        const dd = Math.hypot(tx - P.x, ty - P.y);
        if (dd > s.range) { tx = P.x + (tx - P.x) / dd * s.range; ty = P.y + (ty - P.y) / dd * s.range; }
        const T = 0.45, sx = P.x, sy = P.y;
        spawnMissile(game, {
          x: sx, y: sy, z: 30, vx: 0, vy: 0, life: T, owner: P, team: P.team, kind: 'bomb', vis: 'rock', dmg: d, hitR: 0, t0: 0,
          update: (g, m, dt) => { m.t0 += dt; const k = Math.min(1, m.t0 / T); m.x = sx + (tx - sx) * k; m.y = sy + (ty - sy) * k; m.z = 30 + Math.sin(k * Math.PI) * 60; m.vx = 0.001; m.vy = 0.001; },
          onHit: () => false,
          onEnd: (g, m) => { g.fx.explosion(tx, ty, s.radius); g.sfx('explode_small', tx, ty); areaDamage(g, tx, ty, s.radius, d, 'fire', P, P.team); },
        });
      }, 'attack', null);
      return true;
    }
    case 'trap': {
      const L = game.level;
      const spot = L.nearestFree(Math.round(pt.x), Math.round(pt.y), 3, 0);
      if (!spot) { P.mp += cost; return false; }
      doCast(() => {
        const mine = L.areas.filter((a) => a.trapOf === P && a.vis === (s.trap === 'sentry' ? 'sentry' : 'trap'));
        if (mine.length >= 3) L.areas.splice(L.areas.indexOf(mine[0]), 1);
        const d = s.dmg(lv);
        spawnArea(game, {
          x: spot.x, y: spot.y, r: s.trap === 'sentry' ? 6 : 2.5, dur: 30, vis: s.trap === 'sentry' ? 'sentry' : 'trap', trapOf: P, shots: s.shots(lv), cool: 0, light: 1,
          update: (g, ar, dt) => {
            ar.cool -= dt;
            if (ar.cool > 0) return;
            let best = null, bd = ar.r;
            for (const a of g.level.actors) { if (a.dead || a.team !== 1) continue; const dd = Math.hypot(a.x - ar.x, a.y - ar.y); if (dd < bd && g.level.los(ar.x, ar.y, a.tx, a.ty)) { bd = dd; best = a; } }
            if (!best) return;
            ar.cool = s.trap === 'sentry' ? 0.6 : 0.9;
            g.fx.bolt(ar.x, ar.y, s.trap === 'sentry' ? 36 : 6, best.x, best.y, 30, [180, 210, 255], 0.2, 2);
            damageActor(g, best, rnd(d[0], d[1]), 'light', P);
            g.sfx('sentry_zap', ar.x, ar.y, { vol: 0.6 });
            if (--ar.shots <= 0) ar.t = ar.dur;
          },
        });
        game.sfx('trap_set', spot.x, spot.y);
      }, 'attack', null);
      return true;
    }
    case 'summon': {
      doCast(() => summon(game, P, s, lv, pt));
      return true;
    }
  }
  return false;
}

function shootArrows(game, P, target, pt, mod) {
  const st = P.hero.st;
  const tx = target ? target.x : pt.x, ty = target ? target.y : pt.y;
  P.turnTo(tx, ty);
  const hitT = st.atkTime, dur = hitT + 0.12;
  P.setAnim('attack', dur, {
    hitAt: hitT / dur, style: 'bow', onHit: () => {
      const n = mod.count || 1, spread = mod.spread ?? 0.16;
      const base = Math.atan2(ty - P.y, tx - P.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * spread;
        const m = fireArrow(game, P, a, target, mod);
        if (mod.explode) {
          const ex = mod.explode;
          m.onEnd = (g, mm) => {
            g.fx.explosion(mm.x, mm.y, ex.r, ex.type === 'cold' ? [150, 210, 255] : [255, 140, 40], ex.type === 'cold' ? 'spark' : 'fire');
            g.sfx(ex.type === 'cold' ? 'frost_nova' : 'explode_small', mm.x, mm.y);
            areaDamage(g, mm.x, mm.y, ex.r, ex.d, ex.type || 'fire', P, P.team, { freeze: ex.freeze });
          };
        }
      }
      game.sfx(n > 1 ? 'multishot' : mod.elem?.type === 'fire' ? 'arrow_fire' : mod.elem?.type === 'cold' ? 'arrow_ice' : 'bow_shoot', P.x, P.y);
      P.hero.durabilityLoss('weapon', 40);
    },
  });
}

function castArea(game, P, s, lv, pt) {
  const h = P.hero, L = game.level;
  if (s.area === 'firewall') {
    const d = sdmg(s.id, lv, h, 'dps');
    const a = Math.atan2(pt.y - P.y, pt.x - P.x) + Math.PI / 2;
    const n = s.len(lv), cells = [];
    for (let i = 0; i < n; i++) {
      const k = i - (n - 1) / 2;
      const x = Math.round(pt.x + Math.cos(a) * k), y = Math.round(pt.y + Math.sin(a) * k);
      if (L.isFloor(x, y) && !(L.flags[y * L.w + x] & 1 && L.flags[y * L.w + x] & 2) && !cells.some((c) => c[0] === x && c[1] === y)) cells.push([x, y]);
    }
    spawnArea(game, { x: pt.x, y: pt.y, r: n / 2, cells, dur: s.dur(lv), vis: 'firewall', dps: d, type: 'fire', team: P.team, owner: P, light: 4 });
    game.sfx('fire_wall', pt.x, pt.y);
  } else if (s.area === 'meteor') {
    const d = sdmg(s.id, lv, h);
    spawnArea(game, { x: pt.x, y: pt.y, r: 2, dur: 1.0, vis: 'warn', team: P.team, owner: P,
      update: (g, ar, dt) => { if (!ar.fell && ar.t > 0.55) { ar.fell = true; g.level.missiles.push({ x: pt.x - 2, y: pt.y - 2, z: 260, vx: 3.4, vy: 3.4, life: 0.45, owner: P, team: P.team, kind: 'meteor', vis: 'meteor', hit: new Set(), light: 4, hitR: 0, onHit: () => false, update: (gg, m, dtt) => { m.z = Math.max(0, m.z - 560 * dtt); }, onEnd: () => {} }); } },
      onEnd: (g, ar) => {
        g.fx.explosion(pt.x, pt.y, 2, [255, 120, 30]); g.fx.shake(0.6);
        g.sfx('meteor_impact', pt.x, pt.y);
        areaDamage(g, pt.x, pt.y, 2, d, 'fire', P, P.team);
        spawnArea(g, { x: pt.x, y: pt.y, r: 1.6, dur: 3, vis: 'burning', dps: [Math.round(d[0] * 0.25), Math.round(d[1] * 0.25)], type: 'fire', team: P.team, owner: P, light: 3 });
      },
    });
  } else if (s.area === 'blizzard') {
    const d = sdmg(s.id, lv, h, 'dps');
    spawnArea(game, { x: pt.x, y: pt.y, r: 2.5, dur: 4, vis: 'blizzard', dps: d, type: 'cold', chill: 3, team: P.team, owner: P, light: 2 });
    game.blizzSnd = game.hooks.loop?.('blizzard_loop');
    setTimeout(() => { game.blizzSnd?.stop?.(0.5); }, 4000);
  } else if (s.area === 'poison') {
    const d = s.dps(lv, h);
    spawnArea(game, { x: pt.x, y: pt.y, r: s.radius(lv), dur: s.dur(lv), vis: 'poison', dps: d, type: 'poison', team: P.team, owner: P });
    game.sfx('poison', pt.x, pt.y);
  }
}

function summon(game, P, s, lv, pt) {
  const L = game.level;
  // 한 종류에 하나만
  for (const a of L.actors) if (a.kind === 'summon' && a.owner === P && a.summonType === s.summon && !a.dead) { a.hp = 0; a.dead = true; a.release(L); a.setAnim('death', 0.3); a.noCorpse = true; }
  const spot = L.nearestFree(Math.round(pt.x), Math.round(pt.y), 4, 0);
  if (!spot) return;
  const a = new Actor('summon', spot.x, spot.y);
  a.team = 0; a.owner = P; a.summonType = s.summon;
  const cls = P.hero.C;
  if (s.summon === 'decoy') {
    a.look = { ...P.look, cols: { ...P.look.cols } };
    a.invis = 0.55;
    a.hpMax = a.hp = Math.round(P.hpMax * 0.6 + 10 * lv);
    a.ac = P.hero.st.ac; a.ttl = s.dur(lv); a.ai = 'decoy'; a.speed = 0;
    a.dmg = [0, 0];
  } else {
    a.look = { plan: 'human', h: 1.05, bulk: 1.05, cols: { skin: '#6a5a8a', torso: '#3a2a5a', arms: '#4a3a6a', fore: '#4a3a6a', hands: '#2a1a3a', legs: '#2a1a3a', boots: '#1a1028', pad: '#5a4a7a' }, pads: true, helm: { type: 'full', color: '#4a3a6a' }, wtype: 'sword', wlen: 30, wcol: '#b0a0e0', shield: { type: 'kite', color: '#3a2a5a', rim: '#a090d0' }, glowEyes: '#c0a0ff' };
    a.invis = 0.85;
    a.hpMax = a.hp = 100 + 30 * L1(lv); a.ac = 30 + 4 * lv; a.hit = 60 + 5 * lv; a.mlvl = P.hero.data.lvl;
    a.dmg = [6 + 3 * L1(lv), 14 + 5 * L1(lv)]; a.ai = 'ally'; a.speed = 3.2; a.atk = 0.6; a.hitT = 0.35;
  }
  a.buffs = {}; a.res = {};
  a.place(L, spot.x, spot.y);
  L.actors.push(a);
  game.fx.magic(a.x, a.y, 30, 20, [150, 120, 255]);
  game.sfx('summon', a.x, a.y);
}

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

// 회오리: 매 틱 이동하며 주변을 벤다
export function updateWhirl(game, P, dt) {
  const w = P.whirl;
  if (!w) return false;
  w.t -= dt; w.tick += dt;
  const L = game.level;
  if (!P.mv) {
    const dx = w.x - P.tx, dy = w.y - P.ty;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) {
      const sx = Math.sign(Math.round(dx)), sy = Math.sign(Math.round(dy));
      if ((sx || sy) && L.canStep(P.tx, P.ty, P.tx + sx, P.ty + sy, P.id)) { P.step(L, P.tx + sx, P.ty + sy); P.mv.dur *= 0.6; }
      else if (sx && L.canStep(P.tx, P.ty, P.tx + sx, P.ty, P.id)) { P.step(L, P.tx + sx, P.ty); P.mv.dur *= 0.6; }
      else if (sy && L.canStep(P.tx, P.ty, P.tx, P.ty + sy, P.id)) { P.step(L, P.tx, P.ty + sy); P.mv.dur *= 0.6; }
    }
  } else P.advance(L, dt);
  if (w.tick >= 0.25) {
    w.tick = 0;
    for (const a of L.actors.slice()) {
      if (a.dead || a.team === P.team || a.kind === 'npc' || Math.hypot(a.x - P.x, a.y - P.y) > 1.7) continue;
      resolveMelee(game, P, a, { dmgPct: w.dmgPct });
    }
    game.fx.ring(P.x, P.y, 0.5, 1.5, 0.2, [220, 220, 200], 2);
  }
  if (w.t <= 0) {
    P.whirl = null; P.uninterruptible = false; P.setAnim('idle', 1);
    game.whirlSnd?.stop?.(0.2);
    if (P.mv) { /* 걸음을 마저 간다 */ }
  }
  return true;
}

// 생물도감: 괴물 종류(변종)마다 처음 쓰러뜨리면 도감에 오르고, 그때 한 번만 아주 작은 보너스를 영구히 받는다.
// 보너스 종류는 계열마다 정해져 있고(해골은 방어도, 좀비는 생명력 …), 보스는 힘·마력·민첩·활력을 1씩 준다.
// 이름 붙은 우두머리·용사·졸개는 바탕 종류로 센다. 처치 수는 hero.data.bestiary[종류] 에 쌓인다
import { MONSTERS, FAMILIES, BOSSES } from '../data/monsters.js';

// 계열 → 변종 하나를 처음 쓰러뜨릴 때 받는 보너스(능력치 계산의 mods 이름과 같다)
export const FAM_BONUS = {
  zombie: { life: 2 }, fallen: { tohit: 1 }, fallen_s: { tohit: 1 }, skeleton: { defFlat: 1 }, skel_archer: { tohit: 1 }, skel_captain: { defFlat: 1 },
  scavenger: { life: 2 }, fiend: { mana: 2 }, hidden: { mana: 2 }, goatman: { life: 2 }, goat_archer: { tohit: 1 }, overlord: { life: 2 },
  gargoyle: { defFlat: 1 }, acid: { resPoison: 1 }, magma: { resFire: 1 }, horned: { life: 2 }, storm: { resLight: 1 }, mega: { resAll: 1 },
  snake: { resCold: 1 }, knight: { defFlat: 2 }, succubus: { mana: 2 }, mage: { mana: 2 },
};
// 보스 → 처음 쓰러뜨릴 때 받는 능력치
export const BOSS_BONUS = {
  butcher: { str: 1 }, hollow_king: { vit: 1 }, scribe: { mag: 1 }, warlord: { str: 1 },
  handmaiden_r: { dex: 1 }, handmaiden_b: { dex: 1 }, seraphine: { mag: 1 }, velgath: { str: 1, mag: 1, dex: 1, vit: 1 },
};
const BOSS_DEPTH = { butcher: 2, hollow_king: 3, scribe: 8, warlord: 13, handmaiden_r: 15, handmaiden_b: 15, seraphine: 15, velgath: 16 };

const LABEL = {
  life: ['생명력', ''], mana: ['마나', ''], tohit: ['명중률', '%'], defFlat: ['방어도', ''],
  resFire: ['화염 저항', '%'], resCold: ['냉기 저항', '%'], resLight: ['번개 저항', '%'], resPoison: ['독 저항', '%'], resAll: ['모든 저항', '%'],
  str: ['힘', ''], mag: ['마력', ''], dex: ['민첩', ''], vit: ['활력', ''],
};
// 보너스 글: { defFlat: 1 } → '방어도 +1'
export function bonusText(b) {
  if (!b) return '';
  if (b.str && b.mag && b.dex && b.vit && b.str === b.mag && b.mag === b.dex && b.dex === b.vit) return `모든 능력치 +${b.str}`;
  return Object.entries(b).map(([k, v]) => `${LABEL[k]?.[0] || k} +${v}${LABEL[k]?.[1] || ''}`).join(' · ');
}

// 받은 보너스 합계를 짧은 조각들로: 늘 같은 순서, 모든 저항은 원소마다 더해 보인다
export function summaryParts(M) {
  const out = [];
  for (const k of ['life', 'mana', 'tohit', 'defFlat', 'str', 'mag', 'dex', 'vit']) if (M[k]) out.push(`${LABEL[k][0]} +${M[k]}${LABEL[k][1]}`);
  const ra = M.resAll || 0, el = [['resFire', '화염'], ['resCold', '냉기'], ['resLight', '번개'], ['resPoison', '독']].map(([k, n]) => [n, (M[k] || 0) + ra]);
  if (el.every(([, v]) => v > 0 && v === el[0][1])) out.push(`모든 저항 +${el[0][1]}%`);
  else for (const [n, v] of el) if (v) out.push(`${n} 저항 +${v}%`);
  return out;
}

// 도감 칸 순서: 계열을 처음 나오는 층 순으로, 계열 안에서는 변종 순, 맨 끝에 보스
export const ENTRIES = (() => {
  const fams = Object.keys(FAMILIES).map((fid, i) => ({ fid, i, d: Math.min(...FAMILIES[fid].v.map((v) => v[2][0])) }));
  fams.sort((a, b) => a.d - b.d || a.i - b.i);
  const out = [];
  for (const { fid } of fams) {
    for (const m of Object.values(MONSTERS)) if (m.fam === fid) out.push({ id: m.id, name: m.name, short: m.name, boss: false, fam: fid, def: m, depth: m.dl, bonus: FAM_BONUS[fid] || { life: 1 } });
  }
  for (const bid of Object.keys(BOSS_BONUS)) {
    const B = BOSSES[bid];
    if (!B) continue;
    out.push({ id: bid, name: B.name, short: B.name.length > 5 ? B.name.split(' ').pop() : B.name, boss: true, fam: B.fam, def: B, depth: [BOSS_DEPTH[bid], BOSS_DEPTH[bid]], bonus: BOSS_BONUS[bid] });
  }
  return out;
})();
export const ENTRY = Object.fromEntries(ENTRIES.map((e) => [e.id, e]));

// 쓰러진 괴물의 도감 칸(보스는 보스 칸, 우두머리·용사·졸개는 바탕 종류)
export function entryIdOf(a) {
  if (a.bossId && ENTRY[a.bossId]) return a.bossId;
  const id = a.mdef?.id;
  return id && ENTRY[id] ? id : null;
}
export const killsOf = (d, id) => d.bestiary?.[id] || 0;
export const knownCount = (d) => ENTRIES.reduce((n, e) => n + (killsOf(d, e.id) > 0 ? 1 : 0), 0);

// 받은 보너스를 모두 더한 것(능력치 계산에 넣는다)
export function bestiaryMods(d) {
  const M = {};
  const B = d.bestiary;
  if (!B) return M;
  for (const id in B) {
    const e = ENTRY[id];
    if (!e || !(B[id] > 0)) continue;
    for (const k in e.bonus) M[k] = (M[k] || 0) + e.bonus[k];
  }
  return M;
}

// 괴물이 쓰러질 때(combat.killActor): 처치 수를 세고, 처음이면 도감에 올리고 보너스를 준다
export function recordKill(game, a) {
  const h = game.hero;
  if (!h) return;
  const id = entryIdOf(a);
  if (!id) return;
  const d = h.data, B = d.bestiary || (d.bestiary = {});
  const first = !(B[id] > 0);
  B[id] = (B[id] || 0) + 1;
  if (!first) return;
  h.recalc();
  const e = ENTRY[id];
  game.toast(`도감 등록: ${e.name} — ${bonusText(e.bonus)}`, 'book');
  game.sfx('book');
  game.emit('bestiary', id);
}

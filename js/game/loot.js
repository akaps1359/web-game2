// 떨어뜨리기·줍기: 디아블로 1의 드롭 확률(골드 30%, 아이템 11%), 마법·고유 판정, 희귀(디아블로 2)
import { BASES, BASE } from '../data/items.js';
import { makeItem, enchantMagic, enchantRare, pickUnique, makeUnique, itemName, isBeltable } from './items.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = (p) => Math.random() < p;

// 층에서 쓰는 아이템 레벨 → 기본 아이템 고르기
function pickBase(ilvl, filter) {
  const pool = BASES.filter((b) => b.slot && !b.quest && (b.q || 1) <= ilvl && (!filter || filter(b)));
  if (!pool.length) return null;
  // 활은 두 배(디아블로 1), 장신구는 드물게
  const w = (b) => (b.cat === 'bow' ? 2 : 1) * (b.jewel ? 0.6 : 1) * (b.slot === 'gloves' || b.slot === 'boots' || b.slot === 'belt' ? 0.8 : 1);
  let tot = 0;
  for (const b of pool) tot += w(b);
  let r = Math.random() * tot;
  for (const b of pool) { r -= w(b); if (r < 0) return b; }
  return pool[pool.length - 1];
}

// opts: magicMin(마법 확정), uniqueChance, rareChance, cursed, mf
export function generateItem(game, ilvl, opts = {}) {
  const b = opts.base ? BASE[opts.base] : pickBase(ilvl, opts.filter);
  if (!b) return null;
  const it = makeItem(b.id, { found: !opts.shop, ilvl });
  it.ilvl = ilvl;
  const mf = (game?.hero?.st.mf || 0) + (opts.mf || 0);
  // 마법인가: 10% 또는 아이템 레벨%(디아블로 1). 장신구는 늘 마법
  let magic = b.jewel || opts.magic || Math.random() * 100 <= 10 * (1 + mf / 200) || Math.random() * 100 <= ilvl;
  if (opts.noMagic && !b.jewel) magic = false;
  if (!magic) return it;
  // 고유 2%(우두머리 16%)
  const uch = (opts.uniqueChance ?? 0.02) * (1 + mf / 100);
  if (!opts.shop && chance(uch)) {
    const found = new Set(game?.hero?.data.found || []);
    const U = pickUnique(b.id, ilvl + (opts.bonus || 0), found);
    if (U) {
      const u = makeUnique(U.id);
      u.ilvl = ilvl;
      game?.hero?.data.found.push(U.id);
      return u;
    }
  }
  const rch = (opts.rareChance ?? (ilvl >= 6 ? 0.12 : 0.04)) * (1 + mf / 150);
  if (chance(rch)) return enchantRare(it, { ilvl: ilvl + (opts.bonus || 0) });
  return enchantMagic(it, { ilvl, bonus: opts.bonus || 0, cursed: opts.cursed ?? (!opts.shop && chance(1 / 3)), identified: opts.shop });
}

// 소모품(물약·주문서)
export function generateConsumable(ilvl) {
  const r = Math.random();
  let id;
  if (r < 0.42) id = ilvl >= 10 && chance(0.25) ? 'hp_full' : 'hp_minor';
  else if (r < 0.72) id = ilvl >= 10 && chance(0.25) ? 'mp_full' : 'mp_minor';
  else if (r < 0.82) id = ilvl >= 7 && chance(0.2) ? 'rejuv_full' : 'rejuv';
  else if (r < 0.92) id = 'tp_scroll';
  else id = 'id_scroll';
  if (ilvl >= 15 && chance(0.04)) id = ['elx_str', 'elx_mag', 'elx_dex', 'elx_vit'][rnd(0, 3)];
  return makeItem(id, {});
}

export function goldAmount(depth) {
  const d = Math.max(1, depth);
  const k = d >= 13 ? 1.125 : 1;
  return Math.round(rnd(5 * d, 15 * d - 1) * k);
}

// 바닥에 떨어진 아이템
export function groundItem(game, item, x, y, opts = {}) {
  const L = game.level;
  const p = freeDropSpot(L, x, y);
  const g = { x: p.x, y: p.y, item, drop: opts.noAnim ? 0 : 1, gold: 0 };
  L.items.push(g);
  if (!opts.silent) dropSound(game, item, p.x, p.y);
  return g;
}
export function groundGold(game, n, x, y) {
  const L = game.level;
  const p = freeDropSpot(L, x, y);
  const g = { x: p.x, y: p.y, gold: Math.max(1, Math.round(n * (1 + (game.hero?.st.gf || 0) / 100))), drop: 1 };
  L.items.push(g);
  game.sfx('gold_drop', p.x, p.y);
  return g;
}
function freeDropSpot(L, x, y) {
  x = Math.round(x); y = Math.round(y);
  const ok = (xx, yy) => L.passable(xx, yy) && !L.items.some((i) => Math.round(i.x) === xx && Math.round(i.y) === yy);
  if (ok(x, y)) return { x, y };
  for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  }
  return { x, y };
}
function dropSound(game, it, x, y) {
  const b = BASE[it.b];
  const s = b.cat === 'ring' || b.cat === 'amulet' ? 'drop_ring' : b.cat === 'potion' || b.cat === 'elixir' ? 'drop_potion' : b.cat === 'scroll' ? 'drop_scroll'
    : b.slot === 'weapon' || b.slot === 'shield' ? 'drop_weapon' : 'drop_armor';
  game.sfx(s, x, y);
  if (it.q === 'unique') game.sfx('drop_unique', x, y);
  else if (it.q === 'rare') game.sfx('drop_rare', x, y);
  else if (it.q === 'magic') game.sfx('drop_magic', x, y, { vol: 0.5 });
}

// 괴물이 죽을 때
export function dropLoot(game, m) {
  const depth = game.depth;
  const ilvl = m.ilvl || m.mlvl || depth * 2;
  if (m.questDrop) {
    const qi = m.questDrop.startsWith('q_') && !BASE[m.questDrop] ? makeUnique(m.questDrop, { identified: true }) : makeItem(m.questDrop, {});
    groundItem(game, qi, m.x, m.y);
  }
  // 우두머리·용사: 마법 이상 확정, 여러 개
  if (m.rank === 'unique' || m.rank === 'champion' || m.boss) {
    const n = m.boss ? 3 + rnd(0, 2) : m.rank === 'unique' ? 1 + rnd(0, 1) : 1;
    for (let i = 0; i < n; i++) {
      const it = generateItem(game, ilvl, { magic: true, uniqueChance: m.boss ? 0.25 : m.rank === 'unique' ? 0.16 : 0.04, rareChance: m.boss ? 0.4 : 0.25, bonus: m.rank === 'unique' || m.boss ? 4 : 0, cursed: false });
      if (it) groundItem(game, it, m.x + rnd(-1, 1), m.y + rnd(-1, 1));
    }
    groundGold(game, goldAmount(depth) * (m.boss ? 4 : 2), m.x, m.y);
    if (chance(0.5)) groundItem(game, generateConsumable(ilvl), m.x + rnd(-1, 1), m.y + rnd(-1, 1), { silent: true });
    return;
  }
  // 일반 괴물(디아블로 1): 골드 30.3%, 아이템 10.7%, 없음 59%. 소모품을 조금 더한다
  const r = Math.random();
  if (r < 0.303) groundGold(game, goldAmount(depth), m.x, m.y);
  else if (r < 0.41) { const it = generateItem(game, ilvl); if (it) groundItem(game, it, m.x, m.y); }
  else if (r < 0.5) groundItem(game, generateConsumable(ilvl), m.x, m.y);
}

// 상자·통·석관 등
export function objectLoot(game, o, kind) {
  const depth = Math.max(1, game.depth), ilvl = 2 * depth;
  const at = (fn) => fn();
  if (kind === 'chest') {
    const slots = o.big ? rnd(1, 3) : rnd(0, 2);
    if (chance(0.125)) { groundItem(game, generateConsumable(depth), o.x, o.y); return; }
    for (let i = 0; i < Math.max(1, slots); i++) {
      if (chance(0.75)) groundGold(game, goldAmount(depth), o.x, o.y);
      else { const it = generateItem(game, ilvl, { magic: o.big && chance(0.5) }); if (it) groundItem(game, it, o.x, o.y); }
    }
    return;
  }
  if (kind === 'barrel') {
    const r = Math.random();
    if (r < 0.1) groundGold(game, goldAmount(depth), o.x, o.y);
    else if (r < 0.167) groundItem(game, generateConsumable(depth), o.x, o.y);
    else if (r < 0.2) { const it = generateItem(game, ilvl); if (it) groundItem(game, it, o.x, o.y); }
    return;
  }
  if (kind === 'sarc') {
    const r = Math.random();
    if (r < 0.225) groundGold(game, goldAmount(depth), o.x, o.y);
    else if (r < 0.3) { const it = generateItem(game, ilvl); if (it) groundItem(game, it, o.x, o.y); }
    return;
  }
  if (kind === 'rack') {
    const filter = o.kind === 'weapon' ? (b) => b.slot === 'weapon' : (b) => b.slot === 'body';
    const it = generateItem(game, ilvl, { magic: true, filter, cursed: false });
    if (it) groundItem(game, it, o.x, o.y);
    return;
  }
  if (kind === 'bookcase') {
    if (chance(0.6)) groundItem(game, makeItem(chance(0.5) ? 'id_scroll' : 'tp_scroll', {}), o.x, o.y);
    else if (chance(0.15)) { const it = generateItem(game, ilvl, { filter: (b) => b.cat === 'staff' || b.jewel }); if (it) groundItem(game, it, o.x, o.y); }
  }
}

// 줍기: 골드는 바로, 물약은 띠 먼저, 나머지는 가방
export function pickupItem(game, g) {
  const L = game.level, h = game.hero;
  const i = L.items.indexOf(g);
  if (i < 0) return false;
  if (g.gold) {
    h.gold(g.gold);
    L.items.splice(i, 1);
    game.sfx('gold_pickup', g.x, g.y);
    game.fx.text(g.x, g.y, `+${g.gold} 골드`, '#ffe080', 12, 50, 1);
    game.emit('inventoryChanged');
    return true;
  }
  const it = g.item;
  if (isBeltable(it) && h.beltAdd(it)) { L.items.splice(i, 1); game.sfx('item_pickup', g.x, g.y); game.emit('inventoryChanged'); return true; }
  if (!h.invAdd(it)) { game.toast('가방에 빈자리가 없습니다', 'warn'); game.sfx('ui_error'); return false; }
  L.items.splice(i, 1);
  game.sfx('item_pickup', g.x, g.y);
  game.emit('inventoryChanged');
  game.emit('picked', it);
  return true;
}

// 근처 골드 자동 줍기
export function autoGold(game) {
  const P = game.player, L = game.level;
  for (let i = L.items.length - 1; i >= 0; i--) {
    const g = L.items[i];
    if (!g.gold || g.drop > 0) continue;
    if (Math.abs(g.x - P.x) < 0.8 && Math.abs(g.y - P.y) < 0.8) pickupItem(game, g);
  }
}

export { itemName };

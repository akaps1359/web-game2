// 상점: 대장장이(일반·고급품), 치유사, 마녀, 소년(디아블로 1의 물건 수·아이템 레벨 규칙)
import { BASES, BASE } from '../data/items.js';
import { makeItem, enchantMagic, enchantRare, itemPrice, sellPrice, repairCost } from './items.js';
import { generateItem } from './loot.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// 가게 아이템 레벨: 가장 깊이 내려간 층 기준(디아블로 1: 1~4층 → 6, 이후 층+2, 최대 16)
export function storeIlvl(game) {
  const d = game.hero.data.maxDepth || 0;
  return d <= 4 ? 6 : Math.min(18, d + 2);
}

function pickFor(filter) {
  const pool = BASES.filter(filter);
  return pool[rnd(0, pool.length - 1)];
}

export function restock(game, which, force = false) {
  const d = game.hero.data;
  d.shops = d.shops || {};
  const S = d.shops;
  const il = storeIlvl(game), lv = d.lvl;
  if (which === 'smith' || force) {
    const n = rnd(10, 19), items = [];
    for (let i = 0; i < n; i++) {
      const b = pickFor((b) => b.slot && !b.jewel && b.cat !== 'staff' && (b.q || 1) <= il && !b.quest);
      const it = makeItem(b.id, { ilvl: il });
      it.id = true;
      items.push(it);
    }
    S.smith = items;
  }
  if (which === 'premium' || force) {
    // 고급품: 마법 아이템 6개, 아이템 레벨 = 캐릭터 레벨 −1 ~ +2
    const items = [];
    for (const off of [-1, -1, 0, 0, 1, 2]) {
      const il2 = Math.max(1, lv + off);
      const b = pickFor((b) => b.slot && b.cat !== 'staff' && (b.q || 1) <= Math.max(1, il2) && !b.quest && (b.q || 1) >= Math.floor(il2 / 4));
      const it = makeItem(b.id, { ilvl: il2 });
      if (Math.random() < 0.12 && il2 >= 8) enchantRare(it, { ilvl: Math.min(30, il2), identified: true }); else enchantMagic(it, { window: [Math.floor(il2 / 2), Math.min(30, il2)], identified: true });
      it.id = true;
      items.push(it);
    }
    S.premium = items;
  }
  if (which === 'healer' || force) {
    const items = [];
    const n = rnd(5, 10);
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const id = r < 0.5 ? 'rejuv' : r < 0.7 ? 'hp_full' : r < 0.8 && d.maxDepth >= 6 ? 'rejuv_full' : r < 0.9 && d.maxDepth >= 13 ? ['elx_str', 'elx_mag', 'elx_dex'][rnd(0, 2)] : 'id_scroll';
      items.push(makeItem(id));
    }
    S.healer = items;
  }
  if (which === 'witch' || force) {
    const items = [];
    const n = rnd(6, 12);
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if (r < 0.45) {
        const b = pickFor((b) => b.cat === 'staff' && (b.q || 1) <= il);
        const it = makeItem(b.id, { ilvl: il });
        enchantMagic(it, { window: [Math.floor(il / 2), il * 2], identified: true });
        it.id = true; items.push(it);
      } else if (r < 0.7) {
        const b = pickFor((b) => b.jewel && (b.q || 1) <= il + 4);
        const it = makeItem(b.id, { ilvl: il });
        enchantMagic(it, { window: [Math.floor(il / 2), il], identified: true });
        it.id = true; items.push(it);
      } else items.push(makeItem(['rejuv', 'mp_full', 'id_scroll', 'tp_scroll'][rnd(0, 3)]));
    }
    S.witch = items;
  }
  if (which === 'boy' || force) {
    // 소년: 레벨 = 캐릭터 레벨, 접사 품질 레벨 레벨~2×레벨, 가격 1.5배
    const b = pickFor((b) => b.slot && (b.q || 1) <= Math.max(1, lv) && !b.quest);
    const it = makeItem(b.id, { ilvl: lv });
    if (Math.random() < 0.3) enchantRare(it, { ilvl: Math.min(60, lv * 2), identified: true });
    else enchantMagic(it, { window: [Math.min(25, lv), Math.min(60, lv * 2)], identified: true });
    it.id = true;
    S.boy = [it];
    S.boyPaid = false;
  }
}

// 늘 파는 물건(무한)
export const ALWAYS = {
  healer: ['hp_minor', 'hp_full'],
  witch: ['mp_minor', 'mp_full', 'tp_scroll', 'id_scroll'],
};

export function stock(game, which) {
  const S = game.hero.data.shops || {};
  if (!S[which]) restock(game, which);
  return game.hero.data.shops[which];
}

export function buyPrice(it, which) {
  let p = itemPrice(it);
  if (which === 'boy') p = Math.round(p * 1.5);
  return Math.max(1, p);
}

export function buy(game, which, it, fromAlways = false) {
  const h = game.hero;
  const price = buyPrice(it, which);
  if (h.data.gold < price) { game.toast('골드가 모자랍니다', 'warn'); game.sfx('ui_error'); return false; }
  const copy = fromAlways ? makeItem(it.b) : it;
  const b = BASE[copy.b];
  if (!(b.belt && h.beltAdd(copy)) && !h.invAdd(copy)) { game.toast('가방에 빈자리가 없습니다', 'warn'); game.sfx('ui_error'); return false; }
  h.gold(-price);
  if (!fromAlways) {
    const list = h.data.shops[which];
    const i = list.indexOf(it);
    if (i >= 0) list.splice(i, 1);
    // 고급품은 사면 다시 채운다
    if (which === 'premium') {
      const il2 = h.data.lvl + 2;
      const bb = BASES.filter((x) => x.slot && x.cat !== 'staff' && (x.q || 1) <= il2 && !x.quest);
      const nb = bb[rnd(0, bb.length - 1)];
      const ni = makeItem(nb.id, { ilvl: il2 });
      enchantMagic(ni, { window: [Math.floor(il2 / 2), Math.min(30, il2)], identified: true }); ni.id = true;
      list.push(ni);
    }
  }
  game.sfx('buy');
  game.emit('inventoryChanged');
  return true;
}

// 이 가게가 사 주는 물건인가: 대장장이(고급품 포함)는 무기·방어구·장신구, 마녀는 지팡이·물약·주문서·장신구
export function canSell(it, which) {
  const b = BASE[it.b];
  if (which === 'premium') which = 'smith';
  if (b.quest) return { ok: false, why: '팔 수 없는 물건입니다' };
  if (which === 'smith' && (b.cat === 'staff' || b.cat === 'potion' || b.cat === 'scroll' || b.cat === 'elixir')) return { ok: false, why: '"그건 마녀한테나 가져가게."' };
  if (which === 'witch' && b.slot && b.cat !== 'staff' && !b.jewel) return { ok: false, why: '"쇠붙이는 대장장이에게 팔아."' };
  if (which === 'healer' || which === 'boy') return { ok: false, why: '사지 않는 물건입니다' };
  return { ok: true };
}
export function sell(game, it, which) {
  const h = game.hero;
  const c = canSell(it, which);
  if (!c.ok) { game.toast(c.why); return false; }
  const p = sellPrice(it);
  h.invRemove(it);
  h.gold(p);
  game.sfx('sell');
  game.emit('inventoryChanged');
  return p;
}

export function repairAll(game) {
  const h = game.hero;
  let total = 0;
  const list = [...Object.values(h.data.equip), ...h.data.inv];
  for (const it of list) total += repairCost(it);
  if (!total) { game.toast('고칠 것이 없습니다'); return 0; }
  if (h.data.gold < total) {
    // 돈이 되는 만큼 장착한 것부터
    let spent = 0;
    for (const it of list) { const c = repairCost(it); if (c && h.data.gold - spent >= c) { it.dur = it.durMax; spent += c; } }
    if (!spent) { game.toast('골드가 모자랍니다', 'warn'); return 0; }
    h.gold(-spent); h.recalc(); game.sfx('repair'); return spent;
  }
  for (const it of list) if (it.durMax) it.dur = it.durMax;
  h.gold(-total); h.recalc();
  game.sfx('repair');
  return total;
}
export function repairOne(game, it) {
  const c = repairCost(it);
  if (!c) return 0;
  if (game.hero.data.gold < c) { game.toast('골드가 모자랍니다', 'warn'); return 0; }
  game.hero.gold(-c); it.dur = it.durMax; game.hero.recalc(); game.sfx('repair');
  return c;
}
export function identifyCost() { return 100; }
export function identify(game, it) {
  if (it.id) return false;
  if (game.hero.data.gold < 100) { game.toast('골드가 모자랍니다', 'warn'); return false; }
  game.hero.gold(-100);
  it.id = true;
  game.sfx('identify');
  game.emit('inventoryChanged');
  return true;
}

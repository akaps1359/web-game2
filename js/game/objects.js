// 물체 쓰기: 문·계단·상자·통·석관·책장·무기 걸이·성소·순간 이동 지점·차원문·퀘스트 물건
import { F_SOLID, F_OPAQUE } from './level.js';
import { objectLoot, groundItem, generateConsumable } from './loot.js';
import { makeItem, makeUnique, itemName } from './items.js';
import { spawnMonster } from './ai.js';
import { areaDamage, spawnChargedBolts, damageActor } from './combat.js';
import { addBuff } from './buffs.js';
import { setQuest, questState, LORE, QUESTS, NPC_NAME } from './quests.js';
import { revealAll } from './fov.js';
import { BASE } from '../data/items.js';
import { josa } from '../core/util.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// 성소(디아블로 1의 성소 + 디아블로 2식 임시 효과)
export const SHRINES = [
  { id: 'creepy', name: '오싹한 성소', msg: '힘이 솟는다. (힘 +2)', col: [255, 120, 80], fn: (g) => statUp(g, 'str', 2) },
  { id: 'abandoned', name: '버려진 성소', msg: '몸이 가벼워진다. (민첩 +2)', col: [150, 255, 150], fn: (g) => statUp(g, 'dex', 2) },
  { id: 'eerie', name: '으스스한 성소', msg: '머리가 맑아진다. (마력 +2)', col: [150, 180, 255], fn: (g) => statUp(g, 'mag', 2) },
  { id: 'quiet', name: '고요한 성소', msg: '생기가 돈다. (활력 +2)', col: [255, 200, 150], fn: (g) => statUp(g, 'vit', 2) },
  { id: 'divine', name: '신성한 성소', msg: '생명력과 마나가 모두 찼다.', col: [255, 255, 200], fn: (g) => { const P = g.player; P.hp = P.hpMax; P.mp = P.mpMax; for (const id of g.depth <= 3 ? ['hp_full', 'mp_full'] : ['rejuv_full', 'rejuv_full']) groundItem(g, makeItem(id), P.x, P.y); } },
  { id: 'religious', name: '경건한 성소', msg: '장비가 모두 새것처럼 되었다.', col: [220, 220, 255], fn: (g) => { for (const k in g.hero.data.equip) { const it = g.hero.data.equip[k]; if (it.durMax) it.dur = it.durMax; } g.hero.recalc(); } },
  { id: 'glimmering', name: '반짝이는 성소', msg: '가방의 아이템이 모두 감정되었다.', col: [255, 230, 120], fn: (g) => { for (const it of g.hero.data.inv) it.id = true; g.emit('inventoryChanged'); } },
  { id: 'secluded', name: '외딴 성소', msg: '이 층의 지도가 머릿속에 그려진다.', col: [180, 255, 220], fn: (g) => { const L = g.level; for (let i = 0; i < L.flags.length; i++) if (L.floor[i] || L.wall[i]) L.flags[i] |= 4; } },
  { id: 'spiritual', name: '영혼의 성소', msg: '가방의 빈 곳이 금화로 찼다.', col: [255, 220, 80], fn: (g) => { const free = 40 - g.hero.data.inv.reduce((s, it) => s + BASE[it.b].w * BASE[it.b].h, 0); g.hero.gold(Math.max(0, free) * rnd(5 + g.depth * 2, 14 + g.depth * 3)); g.sfx('gold_pickup'); } },
  { id: 'eldritch', name: '기괴한 성소', msg: '물약들이 모두 회복 물약으로 변했다.', col: [200, 120, 255], fn: (g) => { const conv = (it) => { if (!it) return; const b = BASE[it.b]; if (b.cat === 'potion') it.b = b.use.endsWith('Full') ? 'rejuv_full' : 'rejuv'; }; g.hero.data.inv.forEach(conv); g.hero.data.belt.forEach(conv); g.emit('inventoryChanged'); } },
  { id: 'mysterious', name: '불가사의한 성소', msg: '한 능력치가 크게 오르고 나머지가 조금 내려갔다.', col: [255, 150, 255], fn: (g) => { const ks = ['str', 'mag', 'dex', 'vit'], k = ks[rnd(0, 3)]; for (const s of ks) statUp(g, s, s === k ? 5 : -1); } },
  // 디아블로 2식 임시 효과
  { id: 'armor', name: '방호의 성소', msg: '방어도가 크게 올랐다. (2분)', col: [180, 180, 200], fn: (g) => addBuff(g.player, 'shrine', { t: 120, mods: { defPct: 100 }, label: '방호' }) },
  { id: 'combat', name: '전투의 성소', msg: '공격이 날카로워졌다. (2분)', col: [255, 90, 60], fn: (g) => addBuff(g.player, 'shrine', { t: 120, mods: { dmgPct: 100, tohitPct: 60 }, label: '전투' }) },
  { id: 'resist', name: '저항의 성소', msg: '원소에 대한 저항이 올랐다. (2분)', col: [120, 255, 200], fn: (g) => addBuff(g.player, 'shrine', { t: 120, mods: { resAll: 50 }, label: '저항' }) },
  { id: 'mana', name: '마나의 성소', msg: '마나가 끝없이 샘솟는다. (2분)', col: [80, 120, 255], fn: (g) => addBuff(g.player, 'shrine', { t: 120, mods: { manaRegen: 400 }, label: '마나' }) },
  { id: 'exploding', name: '불안정한 성소', msg: '성소가 폭발했다!', col: [255, 60, 30], fn: (g, o) => { g.fx.explosion(o.x, o.y, 2); g.sfx('barrel_explode', o.x, o.y); areaDamage(g, o.x, o.y, 2.2, [g.depth * 2, g.depth * 4], 'fire', null, 2); } },
];
function statUp(g, k, n) {
  const d = g.hero.data;
  d.base[k] = Math.max(1, d.base[k] + n);
  g.hero.recalc();
}

export function useObject(game, o) {
  const L = game.level, P = game.player, h = game.hero;
  switch (o.type) {
    case 'door': {
      if (o.open) {
        // 문 칸에 무엇이 있으면 닫지 않는다
        if (L.occ[L.idx(o.x, o.y)] || L.items.some((i) => Math.round(i.x) === o.x && Math.round(i.y) === o.y)) return;
        o.open = false; L.flags[L.idx(o.x, o.y)] |= F_SOLID | F_OPAQUE;
        game.sfx('door_close', o.x, o.y);
      } else {
        if (o.locked) { game.toast('잠겨 있다'); game.sfx('ui_error'); return; }
        o.open = true; L.flags[L.idx(o.x, o.y)] &= ~(F_SOLID | F_OPAQUE);
        game.sfx('door_open', o.x, o.y);
      }
      game.lastTile = -1; // 시야를 다시
      return;
    }
    case 'stairs_down': {
      if (o.sealed) { game.toast('강력한 봉인이 길을 막고 있다…', 'warn'); game.sfx('ui_error'); return; }
      game.sfx('stairs');
      game.emit('travel', game.depth + 1, 'down');
      return;
    }
    case 'stairs_up': {
      game.sfx('stairs');
      game.emit('travel', game.depth - 1, 'up');
      return;
    }
    case 'chest': {
      if (o.open) return;
      o.open = true;
      game.sfx('chest_open', o.x, o.y);
      if (o.reward) { groundItem(game, makeUnique(o.reward, { identified: true }), o.x, o.y); return; }
      if (o.trap && Math.random() < 0.5) trapFire(game, o);
      objectLoot(game, o, 'chest');
      return;
    }
    case 'barrel': {
      if (o.broken) return;
      o.broken = true;
      L.flags[L.idx(o.x, o.y)] &= ~F_SOLID;
      L.objAt[L.idx(o.x, o.y)] = 0;
      if (o.explosive) {
        game.sfx('barrel_explode', o.x, o.y);
        game.fx.explosion(o.x, o.y, 1.4);
        areaDamage(game, o.x, o.y, 1.5, [8 + game.depth, 16 + game.depth * 2], 'fire', null, 2);
        // 옆 통도 연쇄 폭발
        for (const b of L.objects) if (b !== o && b.type === 'barrel' && !b.broken && Math.hypot(b.x - o.x, b.y - o.y) < 1.6) setTimeout(() => useObject(game, b), 180);
        return;
      }
      game.sfx('barrel_break', o.x, o.y);
      game.fx.burst(o.x, o.y, 10, 10, { spd: [0.5, 2], vz: [20, 70], life: 0.6, size: 2.5, col: [110, 80, 50], grav: 250, kind: 'shard' });
      if (Math.random() < (game.depth <= 8 ? 0.15 : 0.05)) { const sk = spawnMonster(game, L, game.depth >= 3 ? 'corpseaxe' : 'skeleton', o.x, o.y); sk.aware = true; return; }
      objectLoot(game, o, 'barrel');
      return;
    }
    case 'sarc': {
      if (o.open) return;
      o.open = true;
      game.sfx('sarcophagus', o.x, o.y);
      if (o.raise || Math.random() < 0.2) {
        const p = L.nearestFree(o.x, o.y, 2);
        if (p) { const sk = spawnMonster(game, L, game.depth >= 3 ? 'corpseaxe' : 'skeleton', p.x, p.y); sk.aware = true; game.fx.bone(p.x, p.y, 20, 8); }
        return;
      }
      objectLoot(game, o, 'sarc');
      return;
    }
    case 'bookcase': {
      if (o.empty) return;
      o.empty = true;
      game.sfx('book', o.x, o.y);
      objectLoot(game, o, 'bookcase');
      return;
    }
    case 'rack': {
      if (o.used) return;
      o.used = true;
      game.sfx('drop_weapon', o.x, o.y);
      objectLoot(game, o, 'rack');
      return;
    }
    case 'shrine': {
      if (o.used) { game.toast('이미 힘을 잃은 성소다'); return; }
      o.used = true;
      const S = o.kind ? SHRINES.find((s) => s.id === o.kind) : SHRINES[rnd(0, SHRINES.length - 1)];
      o.kind = S.id;
      game.sfx('shrine', o.x, o.y);
      game.fx.magic(P.x, P.y, 30, 24, S.col);
      S.fn(game, o);
      game.toast(`${S.name}: ${S.msg}`, 'big');
      game.emit('statsChanged');
      return;
    }
    case 'waypoint': {
      if (!o.active) {
        o.active = true;
        if (!h.data.wps.includes(game.depth)) h.data.wps.push(game.depth);
        game.sfx('waypoint', o.x, o.y);
        game.toast('순간 이동 지점이 활성화되었다', 'big');
        game.emit('save');
      }
      game.emit('waypointMenu');
      return;
    }
    case 'portal': {
      game.sfx('portal_enter', o.x, o.y);
      if (game.depth === 0) { if (game.portal) game.emit('travel', game.portal.depth, 'portal', { x: game.portal.x, y: game.portal.y }); }
      else game.emit('travel', 0, 'portal');
      return;
    }
    case 'stash': game.emit('openStash'); game.sfx('chest_open', o.x, o.y); return;
    case 'tome': {
      game.sfx('book', o.x, o.y);
      if (o.lore) {
        o.read = true;
        h.data.lore = h.data.lore || {};
        h.data.lore[o.lore] = true;
        game.emit('lore', o.lore);
      }
      return;
    }
    case 'pedestal': case 'fungus': case 'anvil': {
      if (!o.item) return;
      if (o.taken) return;
      const it = makeItem(o.item);
      if (!h.invAdd(it)) { game.toast('가방에 빈자리가 없습니다', 'warn'); return; }
      o.taken = true; o.item = null;
      if (o.quest) { const q = h.data.quests[o.quest] = h.data.quests[o.quest] || { st: 'active' }; q.have = true; if (q.st === 'none') q.st = 'active'; }
      game.sfx('item_pickup', o.x, o.y);
      // 가져갈 사람을 함께 알린다
      const Q = o.quest && QUESTS[o.quest], to = Q?.report ? ` — 마을의 ${NPC_NAME[Q.report]}에게 가져가자` : '';
      game.toast(`${itemName(it)}${josa(itemName(it), '을', '를')} 얻었다${to}`, 'big');
      game.emit('inventoryChanged');
      game.emit('questUpdate', o.quest);
      return;
    }
    case 'well': game.toast('깊은 우물이다. 바닥에서 찬 기운이 올라온다.'); return;
    case 'lever': o.on = !o.on; game.sfx('lever', o.x, o.y); return;
    case 'cauldron': game.toast('무언가가 끓고 있다. 냄새가 지독하다.'); return;
  }
}

function trapFire(game, o) {
  game.sfx('trap_trigger', o.x, o.y);
  game.fx.explosion(o.x, o.y, 1.2);
  damageActor(game, game.player, rnd(game.depth + 1, game.depth * 2 + 6), 'fire', null, { trap: true });
}

// 물체를 누를 수 있는가(물체 위에 표시할 이름)
export function objectName(o) {
  switch (o.type) {
    case 'door': return o.open ? '열린 문' : '닫힌 문';
    case 'stairs_down': return o.town ? '대성당 지하로' : '아래층으로';
    case 'stairs_up': return o.toTown ? '마을로' : '위층으로';
    case 'chest': return o.open ? null : o.big ? '큰 상자' : '상자';
    case 'barrel': return o.broken ? null : '통';
    case 'sarc': return o.open ? null : '석관';
    case 'bookcase': return o.empty ? null : '책장';
    case 'rack': return o.used ? null : o.kind === 'weapon' ? '무기 걸이' : '갑옷 걸이';
    case 'shrine': return o.used ? null : '성소';
    case 'waypoint': return '순간 이동 지점';
    case 'portal': return '차원문';
    case 'stash': return '보관함';
    case 'tome': return '책';
    case 'pedestal': return o.taken ? null : '제단';
    case 'fungus': return o.taken ? null : '검은 버섯';
    case 'anvil': return o.item ? '분노의 모루' : null;
    case 'well': return '우물';
  }
  return null;
}
export function isInteractive(o) { return !!objectName(o); }
// 상호작용 단추에 쓸 말(쓸 수 없으면 null)
export function objectVerb(o) {
  if (!objectName(o)) return null;
  switch (o.type) {
    case 'door': return o.open ? null : '열기';
    case 'stairs_down': return '내려가기';
    case 'stairs_up': return '올라가기';
    // 상자·석관은 상호작용 단추로 열고, 통은 공격으로 부순다(단추에는 나오지 않는다)
    case 'chest': case 'sarc': return '열기';
    case 'barrel': return null;
    case 'shrine': return '만지기';
    case 'waypoint': return '순간 이동';
    case 'portal': return '들어가기';
    case 'stash': return '보관함';
    case 'tome': return '읽기';
    case 'pedestal': case 'fungus': case 'anvil': return '집기';
    default: return '살펴보기';
  }
}

// 퀘스트: 디아블로 1의 퀘스트 구조(도살자·해골 왕·마법의 돌·눈먼 자들의 회랑·광기의 학자·검은 버섯·분노의 모루·피의 군벌·대주교·최종 보스)를 새 이야기로
import { spawnBoss, spawnMonster } from './ai.js';
import { F_SOLID, F_OPAQUE } from './level.js';
import { makeItem, makeUnique } from './items.js';
import { placeSolid } from './gen/dungeon.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function roomOf(L, id) { return L.rooms.find((r) => r.special === id); }
function spotsIn(L, r, inner = 1) {
  const out = [];
  for (let y = r.y + inner; y < r.y + r.h - inner; y++) for (let x = r.x + inner; x < r.x + r.w - inner; x++) if (L.passable(x, y) && !L.obj(x, y)) out.push([x, y]);
  return out;
}
// 방 둘레의 입구에 문을 단다
function sealRoom(L, r) {
  for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
    const edge = x === r.x - 1 || x === r.x + r.w || y === r.y - 1 || y === r.y + r.h;
    if (!edge || !L.passable(x, y) || L.obj(x, y)) continue;
    const horiz = x === r.x - 1 || x === r.x + r.w;
    const ori = horiz ? 'y' : 'x';
    const o = L.addObject({ type: 'door', x, y, ori, open: false, solid: true });
    L.flags[L.idx(x, y)] |= F_SOLID | F_OPAQUE;
  }
}
const qs = (game, id) => (game.hero.data.quests[id] = game.hero.data.quests[id] || { st: 'none' });

export const QUESTS = {
  butcher: {
    id: 'butcher', name: '도살자', depth: 2, room: [8, 8], giver: 'wounded', offer: () => true, goal: '도살자 모르그 처치',
    text: {
      none: '대성당 지하에서 기어 나온 다친 마을 사람에게 말을 걸어 보자.',
      active: '대성당 지하 2층 어딘가의 피로 물든 방에 도살자 모르그가 있다. 놈을 죽여라.',
      done: '도살자 모르그를 죽였다. 지하 2층의 피 냄새가 조금 옅어졌다.',
    },
    build(game, L) {
      const r = roomOf(L, 'butcher'); if (!r) return;
      sealRoom(L, r);
      for (const [x, y] of spotsIn(L, r, 0)) if (Math.random() < 0.45) L.decals.push({ x: x + Math.random() - 0.5, y: y + Math.random() - 0.5, kind: Math.random() < 0.8 ? 'blood' : 'bones', rot: Math.random() * 6, s: 0.8 + Math.random() * 0.9, keep: true });
      for (const [x, y] of spotsIn(L, r, 1).slice(0, 3)) placeSolid(L, { type: 'gibbet', x, y });
      if (game.hero.data.quests.butcher?.st !== 'done') spawnBoss(game, L, 'butcher', r.cx, r.cy);
      else if (rewardLost(game, 'q_cleaver')) placeReward(L, r, 'q_cleaver');
    },
  },
  hollow_king: {
    id: 'hollow_king', name: '망자의 왕', depth: 3, room: [11, 9], giver: 'inn', report: 'inn', offer: () => true, goal: '오드릭 왕 처치',
    text: {
      none: '여관 주인 브람이 무언가 할 말이 있어 보인다.',
      active: '오드릭 왕이 대성당 지하 3층의 무덤에서 해골 군대를 이끌고 있다. 왕을 영원히 잠재워라.',
      done: '망자의 왕 오드릭이 다시 잠들었다. 브람에게 알리자.',
      reported: '오드릭 왕의 영혼이 마침내 쉼을 얻었다.',
    },
    build(game, L) {
      const r = roomOf(L, 'hollow_king'); if (!r) return;
      sealRoom(L, r);
      const sp = spotsIn(L, r, 1);
      for (let i = 0; i < 5 && sp.length; i++) { const [x, y] = sp.splice(rnd(0, sp.length - 1), 1)[0]; placeSolid(L, { type: 'sarc', x, y, raise: true }); }
      for (const dx of [-3, 3]) placeSolid(L, { type: 'brazier', x: r.cx + dx, y: r.y + 1 });
      if (game.hero.data.quests.hollow_king?.st === 'done' || game.hero.data.quests.hollow_king?.st === 'reported') { if (rewardLost(game, 'q_deadcrown')) placeReward(L, r, 'q_deadcrown'); return; }
      // 왕은 석관을 피해 빈칸에
      const kp = L.nearestFree(r.cx, r.cy - 1, 3) || { x: r.cx, y: r.cy - 1 };
      spawnBoss(game, L, 'hollow_king', kp.x, kp.y);
      for (let i = 0; i < 6; i++) { const p = L.nearestFree(r.cx + rnd(-3, 3), r.cy + rnd(-2, 3), 3); if (p) spawnMonster(game, L, i % 3 === 0 ? 'skel_captain' : 'corpseaxe', p.x, p.y); }
    },
  },
  journal1: {
    id: 'journal1', name: '세라핀의 일지 Ⅰ', depth: 4, lore: true, room: [6, 6],
    build(game, L) { const r = roomOf(L, 'journal1'); if (!r) return; L.addObject({ type: 'tome', x: r.cx, y: r.cy, solid: true, lore: 'journal1' }); L.flags[L.idx(r.cx, r.cy)] |= F_SOLID; for (const [x, y] of [[r.x, r.y], [r.x + r.w - 1, r.y]]) if (L.passable(x, y)) L.addObject({ type: 'candles', x, y }); },
  },
  magic_rock: {
    id: 'magic_rock', name: '마력의 돌', depth: 5, room: [7, 7], giver: 'smith', report: 'smith', fetch: 'q_rock', offer: (d) => d.maxDepth >= 4, goal: '제단 위의 돌 찾기',
    text: {
      none: '대장장이 고드윈이 이상한 돌 이야기를 들었다고 한다.',
      active: '카타콤 1층(지하 5층)의 제단 위에 하늘에서 떨어진 돌이 있다고 한다. 가져다주자.',
      done: '돌을 고드윈에게 가져다주었다.',
    },
    build(game, L) {
      const r = roomOf(L, 'magic_rock'); if (!r) return;
      if (game.hero.data.quests.magic_rock?.st === 'done' || game.hero.data.quests.magic_rock?.have && carried(game, 'q_rock')) return;
      L.addObject({ type: 'pedestal', x: r.cx, y: r.cy, solid: true, item: 'q_rock', quest: 'magic_rock' }); L.flags[L.idx(r.cx, r.cy)] |= F_SOLID;
    },
  },
  blind: {
    id: 'blind', name: '눈먼 자들의 회랑', depth: 7, room: [10, 9], giver: 'sage', report: 'sage', offer: (d) => d.maxDepth >= 6, goal: '회랑의 환영 모두 처치',
    text: {
      none: '현자 알데릭이 카타콤의 어느 회랑에 대해 걱정하고 있다.',
      active: '카타콤 3층(지하 7층)에 보이지 않는 자들이 지키는 회랑이 있다. 그들을 모두 쓰러뜨려라.',
      done: '회랑의 환영들을 모두 쓰러뜨렸다. 알데릭에게 돌아가자.',
      reported: '눈먼 자들의 회랑은 이제 조용하다.',
    },
    build(game, L) {
      const r = roomOf(L, 'blind'); if (!r) return;
      sealRoom(L, r);
      if (game.hero.data.quests.blind?.st === 'done' || game.hero.data.quests.blind?.st === 'reported') {
        // 보상 상자를 열기 전에 층이 다시 만들어졌으면 상자를 다시 놓는다
        if (rewardLost(game, 'q_seer')) { const p = L.nearestFree(r.cx, r.cy, 3); if (p) { L.addObject({ type: 'chest', x: p.x, y: p.y, solid: true, big: true, reward: 'q_seer' }); L.flags[L.idx(p.x, p.y)] |= F_SOLID; } }
        return;
      }
      L.blindRoom = r;
      for (let i = 0; i < 7; i++) { const p = L.nearestFree(r.cx + rnd(-3, 3), r.cy + rnd(-3, 3), 3); if (p) { const m = spawnMonster(game, L, i < 4 ? 'weaver' : 'unseen', p.x, p.y); m.questTag = 'blind'; } }
    },
  },
  scribe: {
    id: 'scribe', name: '광기의 필경사', depth: 8, room: [10, 8], giver: null, goal: '필경사 베르밀 처치',
    text: { active: '카타콤 4층(지하 8층)의 서고에서 미친 필경사가 무언가를 지키고 있다.', done: '필경사 베르밀을 쓰러뜨리고 세라핀의 두 번째 일지를 찾았다.' },
    build(game, L) {
      const r = roomOf(L, 'scribe'); if (!r) return;
      sealRoom(L, r);
      for (let x = r.x; x < r.x + r.w; x += 2) placeSolid(L, { type: 'bookcase', x, y: r.y });
      L.addObject({ type: 'tome', x: r.cx, y: r.cy + 1, solid: true, lore: 'journal2' }); L.flags[L.idx(r.cx, r.cy + 1)] |= F_SOLID;
      if (game.hero.data.quests.scribe?.st !== 'done') spawnBoss(game, L, 'scribe', r.cx, r.cy - 1);
    },
  },
  mushroom: {
    id: 'mushroom', name: '검은 버섯', depth: 9, room: [6, 6], giver: 'witch', report: 'witch', fetch: 'q_mushroom', offer: (d) => d.maxDepth >= 8, goal: '검은 버섯 찾기',
    text: {
      none: '마녀 이졸데가 필요한 재료가 있다고 한다.',
      active: '불타는 동굴 1층(지하 9층)에 자라는 검은 버섯을 찾아 이졸데에게 가져가자.',
      done: '이졸데에게 버섯을 건넸다.',
    },
    build(game, L) {
      const r = roomOf(L, 'mushroom'); if (!r) return;
      if (game.hero.data.quests.mushroom?.st === 'done' || game.hero.data.quests.mushroom?.have && carried(game, 'q_mushroom')) return;
      L.addObject({ type: 'fungus', x: r.cx, y: r.cy, solid: true, item: 'q_mushroom', quest: 'mushroom' }); L.flags[L.idx(r.cx, r.cy)] |= F_SOLID;
      for (const [x, y] of spotsIn(L, r, 0)) if (Math.random() < 0.3) L.decals.push({ x, y, kind: 'acid', rot: 0, s: 0.6, keep: true });
    },
  },
  anvil: {
    id: 'anvil', name: '분노의 모루', depth: 10, room: [9, 9], giver: 'smith', report: 'smith', fetch: 'q_anvil', offer: (d) => d.maxDepth >= 9, goal: '용암 섬의 모루 찾기',
    text: {
      none: '고드윈이 전설의 모루 이야기를 꺼낸다.',
      active: '불타는 동굴 2층(지하 10층)의 용암 섬에 분노의 모루가 있다. 가져오면 고드윈이 검을 벼려 준다.',
      done: '고드윈이 분노의 모루로 검을 벼려 주었다.',
    },
    build(game, L) {
      const r = roomOf(L, 'anvil'); if (!r) return;
      // 용암으로 둘러싼다(한쪽 길만 남긴다)
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        const ring = Math.max(Math.abs(x - r.cx), Math.abs(y - r.cy));
        if (ring === 2 && !(y === r.cy && x > r.cx)) L.flags[L.idx(x, y)] |= 16;
      }
      if (game.hero.data.quests.anvil?.st === 'done' || game.hero.data.quests.anvil?.have && carried(game, 'q_anvil')) return;
      L.addObject({ type: 'anvil', x: r.cx, y: r.cy, solid: true, item: 'q_anvil', quest: 'anvil' }); L.flags[L.idx(r.cx, r.cy)] |= F_SOLID;
      for (let i = 0; i < 4; i++) { const p = L.nearestFree(r.cx + 3, r.cy + rnd(-1, 1), 3); if (p) spawnMonster(game, L, i % 2 ? 'hellstone' : 'storm_rider', p.x, p.y); }
    },
  },
  journal3: {
    id: 'journal3', name: '세라핀의 일지 Ⅲ', depth: 12, lore: true, room: [6, 6],
    build(game, L) { const r = roomOf(L, 'journal3'); if (!r) return; L.addObject({ type: 'tome', x: r.cx, y: r.cy, solid: true, lore: 'journal3' }); L.flags[L.idx(r.cx, r.cy)] |= F_SOLID; },
  },
  warlord: {
    id: 'warlord', name: '피의 군벌', depth: 13, room: [11, 9], giver: null, goal: '피의 군벌 카르낙 처치',
    text: { active: '지옥 1층(지하 13층)에 피의 군벌 카르낙이 전리품을 쌓아 두고 있다.', done: '피의 군벌 카르낙을 쓰러뜨렸다.' },
    build(game, L) {
      const r = roomOf(L, 'warlord'); if (!r) return;
      sealRoom(L, r);
      const n = game.hero.data.quests.warlord?.st === 'done' ? 0 : 4;
      for (let i = 0; i < 4; i++) {
        const x = i < 2 ? r.x : r.x + r.w - 1, y = r.y + 1 + (i % 2) * (r.h - 3);
        // 카르낙이 살아 있는 동안은 잠겨 있다가 쓰러뜨리면 열린다(끝난 뒤에는 이미 챙긴 것으로)
        placeSolid(L, { type: 'rack', x, y, kind: i % 2 ? 'armor' : 'weapon', used: true, wl: true });
      }
      if (n) { spawnBoss(game, L, 'warlord', r.cx, r.cy); for (let i = 0; i < 4; i++) { const p = L.nearestFree(r.cx + rnd(-3, 3), r.cy + rnd(-2, 2), 3); if (p) spawnMonster(game, L, 'steel_lord', p.x, p.y); } }
    },
  },
  seraphine: {
    id: 'seraphine', name: '타락한 성녀', depth: 15, room: [11, 11], giver: 'sage', offer: (d) => d.maxDepth >= 13, goal: '세라핀 처치',
    text: {
      none: '알데릭이 진실을 알아낸 듯하다.',
      active: '지옥 3층(지하 15층)의 제단에서 세라핀이 공허의 군주를 위한 의식을 치르고 있다. 그녀를 막아라.',
      done: '세라핀을 쓰러뜨렸다. 마지막 봉인으로 가는 길이 열렸다.',
    },
    build(game, L) {
      const r = roomOf(L, 'seraphine'); if (!r) return;
      sealRoom(L, r);
      placeSolid(L, { type: 'altar', x: r.cx, y: r.cy - 3 });
      L.decals.push({ x: r.cx, y: r.cy, kind: 'pent', rot: 0, s: 1.2, keep: true });
      const down = L.objects.find((o) => o.type === 'stairs_down');
      const done = game.hero.data.quests.seraphine?.st === 'done';
      if (!done) {
        if (down) down.sealed = true;
        spawnBoss(game, L, 'seraphine', r.cx, r.cy - 1);
      }
      // 시녀들은 세라핀이 먼저 쓰러져도 도감에 아직 없으면 다시 나온다(놓치면 도감을 못 채우니)
      for (const [id, dx] of [['handmaiden_r', -2], ['handmaiden_b', 2]]) if (!done || !(game.hero.data.bestiary?.[id] > 0)) spawnBoss(game, L, id, r.cx + dx, r.cy + 1);
    },
  },
  velgath: {
    id: 'velgath', name: '공허의 군주', depth: 16, giver: null, goal: '공허의 군주 벨가스 처치',
    text: { active: '모든 것의 시작, 지하 16층 공허의 옥좌에서 벨가스가 기다린다.', done: '공허의 군주를 쓰러뜨렸다.' },
  },
};

// 퀘스트 물건을 지금 가방에 갖고 있나(잃어버렸으면 제자리에 다시 놓인다)
function carried(game, id) { return game.hero.data.inv.some((i) => i.b === id); }
// 끝낸 퀘스트의 보상(고유 아이템)을 아직 줍지 못했나: 줍기 전에 죽거나 다시 불러오면 층이 새로 만들어져 사라지던 것
function rewardLost(game, uid) {
  const d = game.hero.data;
  if (d.qgot?.[uid]) return false;
  return ![...d.inv, ...Object.values(d.equip)].some((it) => it && it.u === uid);
}
// 보상을 방 가운데 바닥에 다시 놓는다
function placeReward(L, r, uid) {
  const p = L.nearestFree(r.cx, r.cy, 3);
  if (p) L.items.push({ x: p.x, y: p.y, item: makeUnique(uid, { identified: true }), drop: 0, gold: 0 });
}

// 퀘스트 상태
export function questState(game, id) { return game.hero.data.quests[id]?.st || 'none'; }
// 의뢰인·보고받는 사람 이름(마을 사람 표는 npcs.js에 있어 이름만 따로)
export const NPC_NAME = { wounded: '다친 마을 사람', inn: '브람', smith: '고드윈', sage: '알데릭', witch: '이졸데', healer: '마렌' };
export function setQuest(game, id, st, silent = false) {
  const q = qs(game, id);
  const prev = q.st;
  q.st = st;
  if (silent || prev === st) return;
  const Q = QUESTS[id];
  if (st === 'active') { game.toast(`새 퀘스트: ${Q.name}${Q.goal ? ` — ${depthName(Q.depth)}: ${Q.goal}` : ''}`, 'big'); game.sfx('quest_new'); game.emit('questUpdate', id); }
  if (st === 'done') {
    // 보고할 사람이 있으면 어디로 가야 하는지 함께 알린다
    const tail = Q.report && !Q.fetch ? ` — 마을의 ${NPC_NAME[Q.report]}에게 알리자` : '';
    game.toast(`퀘스트 완료: ${Q.name}${tail}`, 'big'); game.sfx('quest_done'); game.hooks.sting?.('quest'); game.emit('questUpdate', id);
  }
}
export function depthName(d) { return d <= 4 ? `대성당 지하 ${d}층` : d <= 8 ? `카타콤 ${d - 4}층(지하 ${d}층)` : d <= 12 ? `불타는 동굴 ${d - 8}층(지하 ${d}층)` : d === 16 ? '공허의 옥좌(지하 16층)' : `지옥 ${d - 12}층(지하 ${d}층)`; }
// 마을 사람이 새로 부탁할 수 있는가
export function questOffered(game, id) { const q = QUESTS[id]; return !!(q.offer && questState(game, id) === 'none' && q.offer(game.hero.data)); }
// 의뢰인에게 돌아가 보고(또는 물건 건네기)만 남았는가
export function questReady(game, id) {
  const q = QUESTS[id], st = questState(game, id);
  if (!q.report) return false;
  return q.fetch ? st === 'active' && game.hero.data.inv.some((i) => i.b === q.fetch) : st === 'done';
}
// 단계: offer(부탁 가능) · active(진행 중) · ready(보고만 남음) · done(끝)
export function questPhase(game, id) {
  const st = questState(game, id);
  if (questReady(game, id)) return 'ready';
  if (st === 'none') return questOffered(game, id) ? 'offer' : 'none';
  return st === 'active' ? 'active' : 'done';
}
// 마을 사람 머리 위 표시: '?' 보고할 것이 있음, '!' 새 부탁이 있음
export function npcMark(game, npcId) {
  let m = null;
  for (const q of Object.values(QUESTS)) {
    if (q.report === npcId && questReady(game, q.id)) return '?';
    if (q.giver === npcId && questOffered(game, q.id)) m = '!';
  }
  return m;
}
// 지금 할 일 한 줄: 보고만 남은 것 > 지금 층 이하에서 가장 가까운 진행 중 > 가장 얕은 진행 중
export function currentGoal(game) {
  let best = null, bs = 1e9;
  for (const q of Object.values(QUESTS)) {
    if (q.lore) continue;
    const ph = questPhase(game, q.id);
    if (ph === 'ready') {
      const what = q.fetch ? '물건을 건네자' : '알리자';
      return { id: q.id, ready: true, text: `${q.name} — 마을의 ${NPC_NAME[q.report]}에게 ${what}` };
    }
    if (ph !== 'active') continue;
    const d = q.depth, sc = d >= game.depth ? d - game.depth : 100 + d;
    if (sc < bs) { bs = sc; best = { id: q.id, text: `${q.name} — ${depthName(d)}: ${q.goal}` }; }
  }
  return best;
}
// 의뢰인이 없는 퀘스트(그 층에서 마주치는 것)는 처음 그 층에 들어서면 시작된다
export function questsOnEnter(game, depth) {
  for (const q of Object.values(QUESTS)) if (!q.lore && q.depth === depth && (!q.giver || q.giver === 'wounded') && questState(game, q.id) === 'none') setQuest(game, q.id, 'active');
}

export function onMonsterKilled(game, m) {
  if (m.quest) {
    const st = questState(game, m.quest), first = st !== 'done' && st !== 'reported';
    if (first) setQuest(game, m.quest, 'done');
    if (m.quest === 'seraphine') {
      const down = game.level.objects.find((o) => o.type === 'stairs_down');
      if (down) { down.sealed = false; game.toast('봉인이 풀렸다. 아래로 가는 길이 열렸다.', 'big'); game.fx.flash(down.x, down.y, 4, [255, 60, 40], 1); }
      game.emit('lore', 'seraphine_death');
    }
    if (m.quest === 'warlord' && first) for (const o of game.level.objects) if (o.type === 'rack' && o.wl) o.used = false;
    // 엔딩: 3.5초 뒤에 보여 준다. 그 사이에 나가도 다음에 이어 할 때 보여 주도록 표시해 둔다
    if (m.quest === 'velgath' && first) { game.hero.data.wonPending = true; setTimeout(() => game.emit('victory'), 3500); }
    if (m.quest === 'scribe') game.emit('lore', 'scribe_death');
  }
  if (m.questTag === 'blind') {
    const left = game.level.actors.some((a) => !a.dead && a !== m && a.questTag === 'blind');
    if (!left && questState(game, 'blind') !== 'reported') {
      setQuest(game, 'blind', 'done');
      const r = game.level.blindRoom;
      if (r) { const p = game.level.nearestFree(r.cx, r.cy, 3); if (p) { game.level.addObject({ type: 'chest', x: p.x, y: p.y, solid: true, big: true, reward: 'q_seer' }); game.level.flags[game.level.idx(p.x, p.y)] |= F_SOLID; } }
    }
  }
}

// 이야기 글(일지·장면)
export const LORE = {
  intro: `서른 해 전, 애쉬폴 마을에 '잿빛 역병'이 돌았다. 사람들의 살갗은 재처럼 바스러졌고, 무덤이 모자랄 만큼 많은 이가 죽었다.

대성당의 성녀 세라핀은 옛 기록에서 답을 찾았다. 대성당 지하 깊은 곳에, 수백 년 전 '공허의 군주'를 가둔 왕관이 잠들어 있다는 것. 왕관의 힘이라면 역병을 멈출 수 있다고 그녀는 믿었다.

세라핀은 지하로 내려갔고, 다시는 돌아오지 않았다. 그날 밤, 역병은 거짓말처럼 멎었다. 사람들은 그녀를 성인이라 불렀다.

그리고 지금, 대성당의 종이 저절로 울린다. 무덤에서 죽은 자들이 걸어 나오고, 마을 사람들이 하나둘 사라진다.

당신은 이 저주받은 마을에 막 도착한 이방인이다.`,
  journal1: `── 세라핀의 일지, 첫 장 ──

"지하 묘지는 생각보다 깊다. 오드릭 왕의 무덤을 지나며 기도했다. 왕은 역병으로 모든 것을 잃고 스스로 이곳에 묻혔다고 한다.

계단 아래에서 목소리가 들린다. 부드럽고, 다정한 목소리. 그 목소리는 역병을 멈출 방법을 안다고 말한다.

나는 믿음을 지킬 것이다. 왕관을 찾으면, 그 힘만 빌리고 다시 봉인할 것이다."`,
  journal2: `── 세라핀의 일지, 둘째 장 ──

"왕관을 찾았다. 차갑고, 속이 비어 있다. 손에 쥐는 순간 목소리가 또렷해졌다.

'나를 쓰면 역병은 멎는다. 대신 너는 내 목소리를 듣게 되리라.'

마을 사람들이 죽어 가고 있다. 아이들이. 나는… 써야만 한다.

필경사 베르밀에게 이 기록을 맡긴다. 내가 나 자신이 아니게 되거든, 누군가 이것을 읽어 주기를."`,
  journal3: `── 세라핀의 일지, 마지막 장 ──

"역병은 멎었다. 공허가 역병을 삼켰다. 그리고 이제 공허는 더 큰 것을 원한다.

나는 더 이상 기도할 수 없다. 내 입은 그의 이름을 부른다. 벨가스. 벨가스. 벨가스.

지옥의 제단에서 그를 맞을 문을 열 것이다. 누군가 나를 멈춰 주길. 제발."`,
  scribe_death: `필경사 베르밀이 쓰러지며 웃음을 흘린다.

"성녀님은… 아래에 계시지… 왕관을 쓰신 채로… 그분은 이제 문이야… 문이라고!"`,
  seraphine_death: `세라핀의 몸에서 검은 안개가 빠져나간다. 마지막 순간, 그녀의 눈이 맑아진다.

"고마워요… 그는 옥좌에 있어요. 왕관을… 왕관을 다시 봉인해야 해요. 누군가는… 그것을 써야만…"

그녀는 재가 되어 흩어졌다.`,
  victory: `벨가스의 거대한 몸이 무너져 내리며 재가 되어 흩어진다. 그 자리에 검고 속이 빈 왕관 하나가 남았다.

왕관 안에서 무언가가 속삭인다. 아직 끝나지 않았다고.

세라핀의 마지막 말이 떠오른다. 그를 영원히 가둘 방법은 단 하나. 누군가 왕관을 써야 한다.

당신은 왕관을 들어 올린다. 차갑다. 그리고 천천히, 머리 위에 얹는다.

세상이 고요해진다. 목소리가 사라진 것인지, 아니면 이제 당신의 목소리가 된 것인지 알 수 없다.

애쉬폴로 돌아가는 대신, 당신은 동쪽으로 걷기 시작한다. 끝없이.

── 끝 ──`,
};

// 마을 사람들: 대장장이·치유사·마녀·현자·여관 주인·여급·소년·술꾼(디아블로 1 트리스트럼의 역할을 그대로)
import { Actor } from './actor.js';
import { questState, setQuest, QUESTS } from './quests.js';
import { makeItem, makeUnique, itemName } from './items.js';
import { BASE } from '../data/items.js';

const H = (cols, extra = {}) => ({ plan: 'human', cols, ...extra });
const C = (skin, torso, legs, boots, o = {}) => ({ skin, torso, arms: o.arms || torso, fore: o.fore || skin, hands: o.hands || skin, legs, boots, hair: o.hair, belt: o.belt, robe: o.robe, pad: o.pad, cape: o.cape });

export const NPCS = {
  smith: {
    name: '고드윈', role: '대장장이',
    look: H(C('#c08a6a', '#5a3a24', '#3a2a1c', '#2a1a10', { arms: '#c08a6a', hair: null, belt: '#2a1a10' }), { h: 1.08, bulk: 1.3, shoulders: 1.2, beard: '#5a3a20', wtype: 'hammer', wlen: 22, wcol: '#8a8a90' }),
    greet: ['또 왔군. 칼이 무뎌졌으면 내게 맡기게.', '쇠는 거짓말을 안 하지. 사람과 달라서.', '살아서 돌아왔구먼. 다행이야.'],
    gossip: [
      '마렌은 이 마을의 마지막 희망이야. 저 아가씨가 아니었으면 다들 진작 죽었을걸.',
      '대성당이 닫힌 뒤로 쇠를 두드릴 일만 늘었지. 좋은 일인지 모르겠어.',
      '이졸데? 개울 건너 그 여자 말인가. 수상하긴 해도 물건은 진짜야.',
      '무기는 쓰면 닳는 법이야. 내구도가 바닥나면 아무 쓸모가 없으니 제때 고치게.',
      '도끼는 무겁지만 한 방이 크지. 칼은 짐승에게 잘 들고, 둔기는 해골을 부수는 데 그만이야.',
    ],
    shop: 'smith',
  },
  healer: {
    name: '마렌', role: '치유사',
    look: H(C('#e0b8a0', '#d8d8c8', '#c8c8b8', '#5a4a3a', { robe: '#d0d0c0', hair: '#7a4a2a' }), { robe: true, ponytail: true, waist: 0.85, bulk: 0.88, h: 0.97, female: true, calm: true }),
    greet: ['다쳤군요. 이리 와요, 상처를 봐 줄게요.', '무사히 돌아와서 다행이에요.', '빛이 당신과 함께하길.'],
    gossip: [
      '세라핀 성녀님은 제 스승이었어요. 그분이 돌아오지 않은 날을 아직도 기억해요.',
      '치유 물약은 언제나 넉넉히 챙겨 두세요. 지하에선 아무도 당신을 고쳐 주지 않아요.',
      '역병이 멎은 건 기적이었어요. 하지만… 기적엔 늘 값이 따르죠.',
      '알데릭 할아버지는 옛 글을 많이 아세요. 모르는 물건은 그분께 보여 드려요.',
    ],
    shop: 'healer', heals: true,
  },
  witch: {
    name: '이졸데', role: '마녀',
    look: H(C('#c8b0a0', '#3a2a4a', '#2a1a3a', '#1a1018', { robe: '#2e2040', hair: '#1a1a1a' }), { robe: true, helm: { type: 'hood', color: '#2a1e3a' }, waist: 0.85, bulk: 0.88, wtype: 'staff', wlen: 50, gem: '#c060ff', female: true }),
    greet: ['어서 와. 무엇이 필요하지?', '공허의 냄새가 네게 묻어 있구나.', '마나가 모자라 보이는군.'],
    gossip: [
      '세라핀이 찾던 왕관… 그건 왕관이 아니야. 감옥이지.',
      '대성당 아래의 목소리를 듣지 마. 다정하게 들릴수록 더 위험해.',
      '마법은 대가를 원해. 늘 그렇지.',
      '이 개울을 건너오는 자는 드물어. 너는 겁이 없거나, 어리석거나.',
    ],
    shop: 'witch',
  },
  sage: {
    name: '알데릭', role: '현자',
    look: H(C('#c8a890', '#5a5a64', '#4a4a54', '#2a2a2a', { robe: '#555560', hair: '#e8e8e8' }), { robe: true, beard: '#eeeeee', wtype: 'staff', wlen: 52, gem: '#c8c8a0', h: 0.98 }),
    greet: ['잘 왔네, 젊은이. 앉게나.', '지하에서 무엇을 보았나?', '이야기를 들려주지. 늙은이에게 남은 건 이야기뿐이니.'],
    gossip: [
      '공허의 군주 벨가스는 무언가를 "먹는" 존재라네. 역병도, 두려움도, 영혼도.',
      '오드릭 왕은 좋은 왕이었지. 역병이 그를 무너뜨리기 전까지는.',
      '아이템에 깃든 힘은 감정하기 전엔 알 수 없지. 저주받은 물건도 있으니 조심하게.',
      '카타콤 아래는 동굴, 동굴 아래는… 이름을 입에 올리고 싶지 않군.',
    ],
    identify: true,
  },
  inn: {
    name: '브람', role: '잿빛 술잔 주인',
    look: H(C('#d0a080', '#7a5a3a', '#4a3a2a', '#2a1a10', { arms: '#d8d0c0', belt: '#3a2a1a' }), { h: 1.0, bulk: 1.4, belly: 1.6, beard: '#8a5a30' }),
    greet: ['잿빛 술잔에 온 걸 환영하오, 이방인.', '한잔하겠소? 농담이오, 술도 바닥났소.', '무사했구려!'],
    gossip: [
      '예전엔 이 여관이 순례자로 가득했지. 대성당 덕분이었소.',
      '테사가 그러는데 밤마다 대성당에서 종소리가 난다더군. 종지기는 죽은 지 오래인데.',
      '보관함은 여관 앞에 있소. 짐이 무거우면 넣어 두시오.',
      '호그 녀석은 신경 쓰지 마시오. 술이 없으니 헛소리만 늘었소.',
    ],
  },
  maid: {
    name: '테사', role: '여급',
    look: H(C('#e8c0a8', '#7a2a2a', '#5a4a3a', '#3a2a1a', { robe: '#6a2424', hair: '#c08040' }), { robe: true, ponytail: true, waist: 0.8, bulk: 0.85, h: 0.95, female: true, calm: true }),
    greet: ['안녕하세요! 오늘도 무사하셨네요.', '할머니가 그러셨어요. 지하의 문은 열면 안 된다고.', '조심하세요, 정말로요.'],
    gossip: [
      '우리 할머니는 역병 때 세라핀 성녀님을 직접 봤대요. 정말 아름다우셨대요.',
      '핍은 다리를 다쳐도 장사는 기막히게 해요. 가끔 굉장한 물건을 가져온다니까요.',
      '밤에 대성당 창문에 붉은 빛이 보여요. 무서워요.',
    ],
  },
  boy: {
    name: '핍', role: '절름발이 소년',
    look: H(C('#d8b090', '#5a6a4a', '#3a3a2a', '#2a1a10', { hair: '#5a3a1a' }), { h: 0.72, bulk: 0.85, headS: 1.1 }),
    greet: ['어이, 거기. 좋은 물건 있는데 볼래? 보는 데 50골드.', '쉿, 다른 사람한텐 비밀이야.', '내 다리? 지하에서 좀 다쳤지. 신경 꺼.'],
    gossip: ['고드윈 아저씨 물건보단 내 게 훨씬 좋아. 비싸긴 하지만.', '대성당 지하 1층까지는 나도 가 봤어. 그 다음은… 다리가 이렇게 됐지.'],
    shop: 'boy',
  },
  drunk: {
    name: '호그', role: '술꾼',
    look: H(C('#c89070', '#5a5040', '#3a3428', '#2a2018', { hair: '#6a6a6a' }), { h: 0.98, bulk: 1.1, hunch: 0.2, beard: '#7a7a7a' }),
    greet: ['어이… 술 있나? 없어? 쳇.', '내가 왕년엔 말이야… 딸꾹.', '세상이 빙빙 도는구먼.'],
    gossip: [
      '대성당 지하 2층에 피 냄새 진동하는 방이 있다더라고. 도살자 놈이… 딸꾹… 거기 산대.',
      '해골은 칼로 치면 잘 안 들어. 망치로 부숴야지! 내가 왕년에… 딸꾹.',
      '성소? 건드려 봐. 좋은 일이 생길 수도, 펑! 할 수도 있지. 하하.',
      '불타는 통은 건드리지 마. 아니, 괴물 옆에 있으면 건드리고.',
      '이름 붙은 괴물은 좋은 물건을 떨군대. 대신 죽을 수도 있지.',
    ],
  },
  wounded: {
    name: '다친 마을 사람', role: '피투성이',
    look: H(C('#c8a088', '#6a5a4a', '#4a4030', '#2a2018', { hair: '#4a3a2a' }), { h: 1.0 }),
    lying: true,
  },
};

export function spawnNPCs(game, L) {
  for (const id in NPCS) {
    const N = NPCS[id];
    const spot = L.npcSpots?.[id];
    if (!spot) continue;
    if (id === 'wounded' && (game.hero?.data.quests.butcher && game.hero.data.quests.butcher.st !== 'none')) continue;
    const p = L.nearestFree(spot.x, spot.y, 3) || spot;
    const a = new Actor('npc', p.x, p.y);
    a.npc = id; a.team = 2; a.name = N.name;
    a.look = N.look; a.ai = N.lying ? 'none' : 'npc'; a.speed = 1.2;
    a.home = { x: p.x, y: p.y }; a.buffs = {};
    a.hp = a.hpMax = 100;
    if (N.lying) { a.anim = { name: 'dead', t: 1, dur: 1 }; a.fallDir = 1; a.face = 0.6; }
    else a.face = Math.PI / 4 + Math.random();
    a.faceTo = a.face;
    a.place(L, p.x, p.y);
    L.actors.push(a);
  }
}

// ───────── 대화 ─────────
// 선택지: { label, act, sub, quest }
export function talkTo(game, npcId) {
  const N = NPCS[npcId], h = game.hero, d = h.data;
  const out = { name: N.name, role: N.role, look: N.look, text: '', opts: [] };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  out.text = pick(N.greet || ['…']);
  const qopt = (id, label) => out.opts.push({ label, act: 'quest', quest: id });
  switch (npcId) {
    case 'wounded':
      out.text = '"거, 거기 누구요…? 도망쳐… 대성당 지하… 피 냄새 나는 방에… 놈이 있어… 고기를 자르는… 도살자…\n\n놈이 내 친구들을… 갈고리에… 크윽…"\n\n그는 마지막 숨을 몰아쉬고는 움직이지 않는다.';
      out.opts.push({ label: '…편히 쉬길.', act: 'woundedDie' });
      return out;
    case 'healer':
      if (game.player.hp < game.player.hpMax) { game.player.hp = game.player.hpMax; out.text = '상처를 치료해 드렸어요. 생명력이 모두 찼어요.\n\n' + out.text; game.sfx('heal'); game.fx.magic(game.player.x, game.player.y, 30, 16, [255, 230, 160]); }
      out.opts.push({ label: '물약 사기', act: 'shop', shop: 'healer' });
      break;
    case 'smith':
      out.opts.push({ label: '물건 사기', act: 'shop', shop: 'smith' });
      out.opts.push({ label: '고급품 보기', act: 'shop', shop: 'premium', sub: '마법이 깃든 장비' });
      out.opts.push({ label: '팔기', act: 'sell' });
      out.opts.push({ label: '수리', act: 'repair' });
      if (questState(game, 'magic_rock') === 'none' && d.maxDepth >= 4) qopt('magic_rock', '이상한 돌 이야기');
      if (questState(game, 'magic_rock') === 'active' && h.data.inv.some((i) => i.b === 'q_rock')) qopt('magic_rock', '돌을 건넨다');
      if (questState(game, 'anvil') === 'none' && d.maxDepth >= 9) qopt('anvil', '분노의 모루');
      if (questState(game, 'anvil') === 'active' && h.data.inv.some((i) => i.b === 'q_anvil')) qopt('anvil', '모루를 건넨다');
      break;
    case 'witch':
      out.opts.push({ label: '물건 사기', act: 'shop', shop: 'witch' });
      out.opts.push({ label: '팔기', act: 'sell' });
      if (questState(game, 'mushroom') === 'none' && d.maxDepth >= 8) qopt('mushroom', '필요한 재료');
      if (questState(game, 'mushroom') === 'active' && h.data.inv.some((i) => i.b === 'q_mushroom')) qopt('mushroom', '검은 버섯을 건넨다');
      break;
    case 'sage':
      out.opts.push({ label: '아이템 감정', act: 'identify', sub: '하나에 100골드' });
      out.opts.push({ label: '이야기를 듣는다', act: 'lore' });
      if (questState(game, 'blind') === 'none' && d.maxDepth >= 6) qopt('blind', '카타콤의 회랑');
      if (questState(game, 'blind') === 'done') qopt('blind', '회랑을 정리했다고 알린다');
      if (questState(game, 'seraphine') === 'none' && d.maxDepth >= 13) qopt('seraphine', '세라핀의 진실');
      break;
    case 'inn':
      if (questState(game, 'hollow_king') === 'none') qopt('hollow_king', '오드릭 왕 이야기');
      if (questState(game, 'hollow_king') === 'done') qopt('hollow_king', '왕을 잠재웠다고 알린다');
      break;
    case 'boy':
      out.opts.push({ label: '물건 보기 (50골드)', act: 'shop', shop: 'boy' });
      break;
  }
  out.opts.push({ label: '소문을 묻는다', act: 'gossip' });
  out.opts.push({ label: '떠난다', act: 'leave' });
  return out;
}

// 퀘스트 대화(선택했을 때). 결과 글을 돌려준다
export function questTalk(game, npcId, qid) {
  const h = game.hero, st = questState(game, qid);
  const take = (b) => { const it = h.data.inv.find((i) => i.b === b); if (it) h.invRemove(it); };
  const give = (uid) => { const it = makeUnique(uid, { identified: true }); if (!h.invAdd(it)) { game.emit('dropAtPlayer', it); } game.emit('inventoryChanged'); return it; };
  switch (qid) {
    case 'hollow_king':
      if (st === 'none') { setQuest(game, qid, 'active'); return '"오드릭 왕 말이오? 역병이 돌기 전 이 땅의 주인이었지. 왕비와 왕자를 역병에 잃고는 미쳐 버렸소. 결국 대성당 지하 무덤에 산 채로 묻히길 자청했지.\n\n그런데 요즘 지하에서 해골들이 쏟아져 나온다오. 사람들은 왕이 망자의 군대를 일으켰다고 수군대지. 부디… 그분을 다시 잠들게 해 주시오. 지하 3층의 무덤이오."'; }
      if (st === 'done') { setQuest(game, qid, 'reported', true); h.gainExp(1500); game.toast('경험치 +1500'); return '"그랬구려… 그분도 이제 편히 쉬시겠지. 고맙소, 이방인. 이 마을은 당신에게 큰 빚을 졌소."'; }
      break;
    case 'magic_rock':
      if (st === 'none') { setQuest(game, qid, 'active'); return '"카타콤에서 하늘에서 떨어진 돌을 봤다는 소문이 있어. 별의 쇠가 들어 있는 돌이지. 그걸 가져다주면 자네에게 꼭 맞는 반지를 만들어 주겠네. 지하 5층의 제단을 찾아보게."'; }
      if (h.data.inv.some((i) => i.b === 'q_rock')) { take('q_rock'); setQuest(game, qid, 'done'); const it = give('q_celestial'); return `"이거야, 이거! 이 빛 좀 보게… 잠시만 기다리게."\n\n한참 뒤, 고드윈이 반지 하나를 건넨다.\n\n"${itemName(it)}일세. 자네 거야."`; }
      break;
    case 'anvil':
      if (st === 'none') { setQuest(game, qid, 'active'); return '"옛 대장장이들의 전설이 있지. 분노의 모루. 지옥의 열로 단련된 모루라네. 불타는 동굴 2층(지하 10층)의 용암 섬에 있다고 하더군. 그걸 가져오면 평생 한 번 만들 만한 칼을 벼려 주겠네."'; }
      if (h.data.inv.some((i) => i.b === 'q_anvil')) { take('q_anvil'); setQuest(game, qid, 'done'); const it = give('q_smithedge'); return `"정말 가져왔군! …사흘 밤낮을 두드렸네."\n\n고드윈이 붉게 빛나는 검을 건넨다.\n\n"${itemName(it)}. 내 생애 최고의 작품이야."`; }
      break;
    case 'mushroom':
      if (st === 'none') { setQuest(game, qid, 'active'); return '"영약을 하나 만들고 싶어. 재료가 하나 모자라지. 불타는 동굴 1층(지하 9층)에서 자라는 검은 버섯. 그걸 가져오면 너에게도 좋은 걸 나눠 주지."'; }
      if (h.data.inv.some((i) => i.b === 'q_mushroom')) { take('q_mushroom'); setQuest(game, qid, 'done'); const e = makeItem('elx_spectral'); if (!h.invAdd(e)) game.emit('dropAtPlayer', e); game.emit('inventoryChanged'); return '"훌륭해. 이 독기… 완벽해."\n\n이졸데가 무언가를 끓이더니 은빛 영약을 건넨다.\n\n"망령의 영약이야. 마시면 모든 능력이 오를 거야."'; }
      break;
    case 'blind':
      if (st === 'none') { setQuest(game, qid, 'active'); return '"카타콤 3층(지하 7층)에 \'눈먼 자들의 회랑\'이라 불리는 곳이 있네. 옛 수도사들이 눈을 가리고 기도하던 곳이지. 지금은 보이지 않는 것들이 그곳을 지킨다네. 그것들을 몰아내 주게. 그곳에 투시의 부적이 잠들어 있다고 들었네."'; }
      if (st === 'done') { setQuest(game, qid, 'reported', true); h.gainExp(4000); game.toast('경험치 +4000'); return '"해냈구먼. 그 부적이 자네 눈이 되어 줄 걸세."'; }
      break;
    case 'seraphine':
      if (st === 'none') { setQuest(game, qid, 'active'); return '"자네가 가져온 일지를 읽었네… 세라핀은 성녀가 아니었어. 아니, 성녀였기에 왕관을 쓴 게지. 마을을 구하려고.\n\n하지만 공허는 역병을 삼킨 뒤 그녀를 삼켰다네. 이제 그녀는 지옥 3층(지하 15층)의 제단에서 벨가스를 위한 문을 열고 있어.\n\n그녀를 멈춰 주게. 그것이 그녀를 구하는 유일한 길일세."'; }
      break;
  }
  return null;
}

export function loreTalk(game) {
  const d = game.hero.data;
  if (d.quests.velgath?.st === 'done') return '"자네가 해냈군… 그런데 그 왕관은 어디 있나? …아니, 대답하지 말게."';
  if (d.quests.seraphine?.st === 'done') return '"이제 남은 건 벨가스뿐일세. 공허의 옥좌는 지옥의 가장 깊은 곳에 있다네. 왕관을 찾게. 그리고… 신의 가호가 있기를."';
  if (d.maxDepth >= 13) return '"지옥에 발을 들였군. 거기서 본 것은 잊으려 해도 잊히지 않을 걸세. 벨가스는 왕관을 통해 이 세상에 스며들고 있어."';
  if (d.maxDepth >= 9) return '"동굴은 땅의 피가 흐르는 곳. 용암이 끓는 그곳 너머에 지옥의 문턱이 있다네."';
  if (d.maxDepth >= 5) return '"카타콤은 옛 수도사들의 무덤이지. 저 아래엔 산양 머리를 한 짐승들이 산다더군. 그것들은 공허를 섬긴다네."';
  return '"대성당은 수백 년 전 공허의 군주를 가둔 자리에 세워졌네. 성녀 세라핀이 그 봉인을 찾아 내려간 뒤로… 아무도 돌아오지 못했지. 조심하게, 젊은이."';
}

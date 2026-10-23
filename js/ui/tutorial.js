// 튜토리얼(코치마크): 설명을 읽기만 하는 대신 실제 화면을 직접 눌러 보며 익힌다.
// 눌러야 할 곳을 밝게 비추고 한 줄로 안내하며, 플레이어가 그 동작을 해내면 다음 단계로 넘어간다.
// 화면 조작은 막지 않는다(오버레이는 터치를 통과시킨다).
// 주제별로 나뉘어 있다: 「기본 조작」은 처음 새 게임을 시작할 때 한 번만 뜨고, 나머지(중점·정치·연구·산업·군사·외교·지도)는
// 각 화면 오른쪽 위 「?」나 메뉴 → 튜토리얼에서 원할 때 꺼내 본다
import { h, $, clear, onTap } from './dom.js';
import { getItem, setItem } from './store.js';
import { divsOf, armiesOf } from '../engine/military.js';

export const TUTORIAL_KEY = 'chulhyeol.tutorial.v2'; // 기본 조작
const doneKey = (topic) => (topic === 'basics' ? TUTORIAL_KEY : 'chulhyeol.tut.' + topic);
export const tutorialDone = (topic) => !!getItem(doneKey(topic));

const isOpen = (app, key) => app.sheet.isOpen && app.sheet.current === key;
const all = (sel) => [...document.querySelectorAll(sel)];
const tabEl = (label) => all('#sheet .sheet-tabs .stab').find((b) => b.textContent.trim() === label);
const cardWith = (txt) => all('#sheet .card').find((c) => c.querySelector('h3')?.textContent.includes(txt));
const withText = (sel, txt) => all(sel).find((e) => e.textContent.includes(txt));

// 자주 쓰는 단계: 아래 탭 열기 · 패널 안의 탭 바꾸기 · 비춰 주며 설명하기
const openTab = (app, key, label, more = '') => ({ open: key, text: `아래 「${label}」 탭을 누르세요.${more ? ' ' + more : ''}`, target: () => app.tabs?.[key], done: () => isOpen(app, key) });
const subTab = (app, panel, key, label, text) => ({ need: panel, text: text || `위쪽 「${label}」 탭을 누르세요.`, target: () => tabEl(label), done: () => isOpen(app, panel) && app.sheet.tab === key });
const info = (need, text, target, next = '다음') => ({ need, text, target, next });

function basics(app) {
  const G = () => app.G, C = () => app.G.countries[app.G.player];
  const myStack = () => {
    // 화면 가운데에서 가장 가까운 우리 사단 카운터
    const W = innerWidth / 2, H = innerHeight / 2;
    let best = null, bd = Infinity;
    for (const b of app.r._stacks || []) {
      if (b.s.tag !== G().player) continue;
      const d = Math.hypot((b.x0 + b.x1) / 2 - W, (b.y0 + b.y1) / 2 - H);
      if (d < bd) { bd = d; best = b; }
    }
    return best && { left: best.x0, top: best.y0, width: best.x1 - best.x0, height: best.y1 - best.y0 };
  };
  // 미국 본토처럼 땅으로 이어진 이웃이 없는 곳의 사단은 배로만 움직인다
  const overSea = () => app.selectedDivs().every((D) => !app.map.nb[D.loc].length);
  return [
    { center: true, next: '시작하기', text: () => `${C().name}의 지도자가 되셨습니다.\n직접 눌러 보며 1분 만에 기본 조작을 익혀 볼까요?` },
    { text: '한 손가락으로 지도를 끌어 보세요. 두 손가락으로 벌리면 확대됩니다.', place: 'bottom',
      enter: (t) => { t.cam0 = { ...app.r.cam }; },
      done: (t) => { const c = app.r.cam, c0 = t.cam0; return Math.hypot(c.x - c0.x, c.y - c0.y) * c.s > 60 || Math.abs(Math.log(c.s / c0.s)) > 0.25; } },
    openTab(app, 'focus', '중점', '나라가 나아갈 방향을 정하는 곳입니다.'),
    { need: 'focus', text: '금빛 테두리 중점 하나를 탭하세요.',
      target: () => $('#sheet .fnode.avail'),
      enter: () => setTimeout(() => $('#sheet .fnode.avail')?.scrollIntoView({ block: 'nearest', inline: 'center' }), 50),
      done: () => !!$('#sheet .fnode.picked') || !!C().focus.cur },
    { need: 'focus', text: '「선택」을 누르면 70일쯤 진행되고, 끝나면 공장·정치력 같은 보상을 받습니다.', target: () => $('#sheet .fdetail .btn.primary'), done: () => !!C().focus.cur },
    { text: '✕를 눌러 패널을 닫으세요. 위쪽 손잡이를 아래로 끌어내려도 닫힙니다.', target: () => $('#sheet .sheet-head .ibtn:last-child'), done: () => !app.sheet.isOpen },
    { text: '위쪽 날짜를 누르면 시간이 흐릅니다. 다시 누르면 멈추고, +/−로 빠르기를 바꿉니다.', target: () => app.hud?.dateBtn, done: () => app.speed > 0 },
    { text: '지도에서 우리 사단 카운터를 탭해 선택하세요.',
      skip: () => !divsOf(G(), G().player).some((D) => !D.sea),
      enter: () => {
        const D = divsOf(G(), G().player).filter((x) => !x.sea).sort((a, b) => (b.loc === C().capital) - (a.loc === C().capital))[0];
        if (D) { app.r.focusState(D.loc, Math.max(app.r.cam.s, 0.2)); app.dirty = true; app.r.staticDirty = true; }
      },
      target: myStack, done: () => app.sel.divs.size > 0 },
    { text: '이제 보낼 주를 지도에서 탭하세요. 사단이 그곳으로 이동합니다.', place: 'top',
      skip: () => !app.sel.divs.size || overSea(),
      // 사단 정보 패널이 지도를 가리지 않게 닫고(선택은 유지) 그 사단 쪽으로 지도를 옮긴다.
      // 사단을 직접 움직이면 그 군의 자동 지휘가 꺼지는데, 연습이니 끝나면 원래대로 돌려놓는다
      enter: (t) => {
        t.armies = armiesOf(G(), G().player).map((A) => [A, A.auto]);
        const D = app.selectedDivs()[0];
        app.sheet.close();
        if (D) { app.r.focusState(D.loc, Math.max(app.r.cam.s, 0.2)); app.dirty = true; app.r.staticDirty = true; }
      },
      done: (t) => { const ok = app.selectedDivs().some((D) => D.path.length > 0); if (ok) for (const [A, auto] of t.armies) A.auto = auto; return ok; } },
    { text: '바다 건너에 있는 사단은 땅으로 갈 수 없어요. 아래 「수송」(아군 항구로)이나 「상륙」(적 해안으로)을 누른 뒤 도착할 곳을 탭하면 배로 건너갑니다.', place: 'top', next: '다음',
      skip: () => !app.sel.divs.size || !overSea(),
      enter: () => app.sheet.close(),
      target: () => withText('.opbar .btn', '수송') },
    { center: true, next: '게임 시작', enter: () => app.sheet.close(),
      text: '기본은 끝! 화면마다 오른쪽 위 「?」를 누르면 중점·정치·연구·산업·군사·외교를 1분씩 따로 배울 수 있어요.\n메뉴(☰) → 「튜토리얼」에도 모여 있습니다.' },
  ];
}

function focus(app) {
  return [
    openTab(app, 'focus', '중점'),
    info('focus', '맨 위는 지금 진행 중인 중점입니다. 날마다 진행되어 끝나면 효과를 받아요.', () => $('#sheet .fcur')),
    info('focus', '선으로 이어진 중점은 위의 중점을 끝내야 열립니다. 빨간 ✕로 이어진 둘은 하나만 고를 수 있어요.', () => $('#sheet .ftree-wrap')),
    { need: 'focus', text: '아무 중점이나 탭해 보세요.', target: () => $('#sheet .fnode.avail') || $('#sheet .fnode'), done: () => !!$('#sheet .fnode.picked') },
    info('focus', '효과·기간·선행 조건이 나옵니다. 진행 중인 중점을 다른 것으로 바꾸면 진행도가 사라지니 신중하게!', () => $('#sheet .fdetail'), '알겠어요'),
  ];
}

function politics(app) {
  return [
    openTab(app, 'politics', '정치', '법률·고문·결정을 다루는 곳입니다.'),
    info('politics', '정치력(★)은 날마다 쌓입니다. 법률을 바꾸고, 고문을 고용하고, 결정을 내리는 데 씁니다.', () => withText('#sheet .sheet-body > .row', '정치력')),
    info('politics', '안정도가 낮으면 생산이 줄고, 전쟁 지지도가 낮으면 징병·전쟁과 관련된 선택이 막힙니다.', () => cardWith('국내 정세')),
    subTab(app, 'politics', 'laws', '법률'),
    info('politics', '경제법을 올리면 소비재 부담이 줄어 공장을 더 쓰고, 징병법을 올리면 인력이 늘어요. 「시행」에 정치력 150이 듭니다.', () => $('#sheet .card')),
    subTab(app, 'politics', 'advisors', '고문'),
    info('politics', '고문은 연구·생산·공격력 같은 보너스를 줍니다(고용 150). 정치력이 모이면 고용하세요.', () => cardWith('고용 가능') || $('#sheet .card')),
    subTab(app, 'politics', 'decisions', '결정', '「결정」 탭도 눌러 보세요. 특정 상황에서만 쓸 수 있는 특별한 행동이 나옵니다.'),
    info('politics', '조건이 맞으면 「시행」이 켜집니다. 진행 중인 결정은 아래에 남은 기간이 표시돼요.', () => $('#sheet .card'), '알겠어요'),
  ];
}

function research(app) {
  return [
    openTab(app, 'research', '연구'),
    info('research', '연구 슬롯마다 기술을 하나씩 연구합니다. 남은 기간이 보여요.', () => $('#sheet .slot')?.parentElement),
    { need: 'research', text: '위쪽 분야 탭(보병·기갑·공군·산업…) 하나를 눌러 보세요. 「추천」은 지금 할 만한 기술입니다.', target: () => all('#sheet .sheet-tabs .stab')[1], done: () => isOpen(app, 'research') && app.sheet.tab !== 'rec' },
    info('research', '기술을 탭하면 연구를 시작합니다(슬롯이 다 차면 바꿀 슬롯을 고릅니다). 실제 연도보다 앞선 기술은 시간이 크게 늘어나요.', () => $('#sheet .tech:not(.locked):not(.done)') || $('#sheet .tech')),
    info('research', '「자동 연구」를 켜면 AI가 알아서 골라 줍니다.', () => withText('#sheet .pill', '자동 연구'), '알겠어요'),
  ];
}

function industry(app) {
  const C = () => app.G.countries[app.G.player];
  return [
    openTab(app, 'industry', '산업', '공장과 생산·건설·무역을 다룹니다.'),
    info('industry', '군수 공장은 장비를 만듭니다. 생산 라인마다 공장 수를 +/−로 정하고, 같은 장비를 오래 만들수록 효율(초록 막대)이 올라요.', () => all('#sheet .card')[0]),
    subTab(app, 'industry', 'cons', '건설', '「건설」 탭을 누르세요. 민간 공장이 건물을 짓습니다.'),
    { need: 'industry', text: '위에서 건물 종류를 고르고, 주 옆 「건설」을 눌러 대기열에 넣어 보세요.', enter: (t) => { t.n = C().cons.length; },
      target: () => withText('#sheet .card .item .btn', '건설'), done: (t) => C().cons.length > t.n },
    info('industry', '민간 공장 15개마다 건설 하나가 동시에 진행됩니다. 순서는 화살표로 바꿉니다.', () => cardWith('건설 대기열')),
    subTab(app, 'industry', 'res', '자원·무역', '「자원·무역」 탭을 누르세요.'),
    info('industry', '자원이 모자라면 생산이 줄어듭니다. 무역으로 사 오면 민간 공장 1개당 자원 8을 수입해요.', () => cardWith('무역') || $('#sheet .card'), '알겠어요'),
  ];
}

function military(app) {
  const G = () => app.G;
  const noArmy = () => !armiesOf(G(), G().player).length;
  return [
    openTab(app, 'military', '군사', '군·징집·편제·공군·해군을 다룹니다.'),
    subTab(app, 'military', 'armies', '군', '「군」 탭에서 군을 지휘합니다.'),
    { ...info('military', '평소엔 「방어」로 전선을 지키며 계획 보너스를 쌓고, 때가 되면 「공세」를 누르세요. 공격 시점은 직접 정합니다.', () => $('#sheet .card.army .seg')), skip: noArmy },
    { ...info('military', '「공세 목표」로 적 주를 찍으면 그쪽으로 밀고 나갑니다. 정면의 적이 지치면 「반격 기회」 알림이 와요.', () => withText('#sheet .card.army .row', '공세 목표')), skip: noArmy },
    subTab(app, 'military', 'recruit', '징집', '「징집」 탭을 누르세요.'),
    info('military', '편제를 골라 「훈련」하면 수도에서 훈련한 뒤 배치됩니다. 인력과 장비가 필요해요.', () => withText('#sheet .card .item .btn', '훈련') || $('#sheet .card')),
    subTab(app, 'military', 'tpl', '사단 편제', '「사단 편제」 탭을 누르세요.'),
    info('military', '보병·포병·기갑 대대를 조합해 사단을 설계합니다. 바꾼 편제는 새로 훈련하는 사단부터 적용돼요.', () => $('#sheet .card')),
    info('military', '「공군」 탭에서 비행단을 제공권·근접 지원에, 「해군」 탭에서 함대를 제해권·호위에 배치합니다.', () => $('#sheet .sheet-tabs'), '알겠어요'),
  ];
}

function diplomacy(app) {
  return [
    openTab(app, 'diplomacy', '외교'),
    info('diplomacy', '세계 긴장도가 오를수록 민주국가도 전쟁에 나설 수 있고, 공격적인 행동도 쉬워집니다.', () => $('#sheet .sheet-body > div')),
    { open: 'country', need: 'diplomacy', text: '나라 하나를 탭해 보세요.', target: () => $('#sheet .list .item'), done: () => isOpen(app, 'country') },
    info('country', '전쟁하려면 먼저 「전쟁 목표 정당화」(정치력 50)를 마치고 선전포고합니다. 독립 보장·불가침 조약·군사 통행권도 여기서 합니다.', () => cardWith('외교 행동') || $('#sheet .card')),
    { center: true, next: '알겠어요', text: '외교 화면의 「진영」 탭에서 동맹에 들어가거나 만들 수 있고, 전쟁 중인 우방에는 「무기 대여」로 장비를 보낼 수 있어요.' },
  ];
}

function map(app) {
  return [
    { text: '오른쪽 맨 위 「지도 모드」 버튼을 누르세요.', enter: () => app.sheet.close(), target: () => $('#side .side-btn'), done: () => !!$('#side .mode-menu') },
    { place: 'bottom', text: '「보급」을 골라 보세요. 보급이 약한 곳(붉은색)에서는 부대가 힘을 못 냅니다.', target: () => withText('#side .mode-menu button', '보급'), done: () => app.r.mode === 'supply' },
    { place: 'bottom', text: '다시 지도 모드에서 「정치」를 골라 원래 지도로 돌아오세요. 「진영」 모드는 누가 어느 편인지 보여 줍니다.', target: () => withText('#side .mode-menu button', '정치') || $('#side .side-btn'), done: () => app.r.mode === 'political' },
    info(null, '이 버튼은 우리 수도로 돌아가고, 그 아래는 세계 소식입니다.', () => all('#side .side-btn')[1]),
    { center: true, next: '알겠어요', text: '전쟁이 나면 지도에 ⚔ 전투 표시와 공격 화살표가 뜨고, 위쪽에 「항복 진행」이 보입니다. 승점이 있는 주를 많이 잃을수록 항복에 가까워져요.' },
  ];
}

export const TOPICS = {
  basics: { name: '기본 조작', desc: '지도·시간·패널·사단 이동', steps: basics },
  focus: { name: '국가 중점', desc: '중점 트리 읽기와 선택', steps: focus },
  politics: { name: '정치', desc: '정치력·법률·고문·결정', steps: politics },
  research: { name: '연구', desc: '연구 슬롯·분야·자동 연구', steps: research },
  industry: { name: '산업·경제', desc: '생산 라인·건설·자원과 무역', steps: industry },
  military: { name: '군사', desc: '방어·공세·징집·편제·공군·해군', steps: military },
  diplomacy: { name: '외교', desc: '긴장도·정당화와 선전포고·진영', steps: diplomacy },
  map: { name: '지도와 전쟁 정보', desc: '지도 모드·보급·전투 표시·항복', steps: map },
};
// 패널 → 그 화면의 튜토리얼(패널 머리의 「?」)
export const TOPIC_OF = { focus: 'focus', politics: 'politics', research: 'research', industry: 'industry', military: 'military', diplomacy: 'diplomacy', country: 'diplomacy' };

export class Tutorial {
  constructor(app) { this.app = app; this.el = null; }
  get active() { return !!this.el; }
  start(topic = 'basics') {
    this.stop();
    this.topic = TOPICS[topic] ? topic : 'basics';
    if (this.topic !== 'basics') this.app.setSpeed(0); // 배우는 동안은 시간을 멈춘다
    this.list = TOPICS[this.topic].steps(this.app);
    this.el = h('div', { id: 'coach' }, this.dim = h('div', { class: 'coach-dim' }), this.spot = h('div', { class: 'coach-spot' }), this.box = h('div', { class: 'coach-box' }));
    $('#app').appendChild(this.el);
    this.go(0);
    this.timer = setInterval(() => this.tick(), 200);
  }
  stop() {
    clearInterval(this.timer);
    this.el?.remove(); this.el = null;
  }
  // 끝내거나 건너뛰면 그 주제는 다시 저절로 뜨지 않는다(언제든 다시 볼 수 있음)
  finish(skipped) {
    setItem(doneKey(this.topic), '1');
    const name = TOPICS[this.topic].name;
    this.stop();
    if (skipped) this.app.toast('튜토리얼은 메뉴나 화면 오른쪽 위 「?」에서 다시 볼 수 있습니다');
    else if (this.topic !== 'basics') this.app.toast(`「${name}」 튜토리얼 완료`, 'peace');
    this.app.sheet.refresh?.(); // 「?」의 새 표시 갱신
  }
  go(i) {
    while (i < this.list.length && this.list[i].skip?.(this)) i++;
    if (i >= this.list.length) { this.finish(); return; }
    this.i = i; this.t0 = performance.now(); this.late = false;
    const S = this.list[i];
    S.enter?.(this);
    this.draw();
    this.tick();
  }
  draw() {
    const S = this.list[this.i];
    clear(this.box);
    const n = this.list.length;
    this.box.appendChild(h('div', { class: 'cb-text' }, typeof S.text === 'function' ? S.text(this) : S.text));
    const foot = h('div', { class: 'cb-foot' }, h('span', { class: 'cb-n' }, `${TOPICS[this.topic].name} · ${this.i + 1}/${n}`));
    if (this.i < n - 1) { const sk = h('button', { class: 'cb-skip' }, '건너뛰기'); onTap(sk, () => this.finish(true)); foot.appendChild(sk); }
    if (S.next || this.late) { const b = h('button', { class: 'btn sm primary' }, S.next || '다음'); onTap(b, () => this.go(this.i + 1)); foot.appendChild(b); }
    this.box.appendChild(foot);
  }
  tick() {
    if (!this.el) return;
    const app = this.app, S = this.list[this.i];
    // 이벤트 창이 뜨면 잠시 숨고, 타이틀로 나가면 끝낸다
    if ($('#title')?.classList.contains('show')) { this.finish(); return; }
    const hidden = $('#modal')?.classList.contains('show');
    this.el.style.display = hidden ? 'none' : '';
    if (hidden) return;
    if (S.done?.(this)) { this.go(this.i + 1); return; }
    // 필요한 패널을 닫아 버렸으면 그 패널을 여는 단계로 돌아간다
    if (S.need && !isOpen(app, S.need)) { const j = this.list.findIndex((x) => x.open === S.need); if (j >= 0 && j < this.i) { this.go(j); return; } }
    // 오래 막혀 있으면 「다음」 버튼을 보여 준다
    if (!S.next && !this.late && performance.now() - this.t0 > 25000) { this.late = true; this.draw(); }
    let r = null;
    const tg = S.target?.(this);
    // 비출 곳이 목록 아래로 숨어 있으면 단계마다 한 번 화면 안으로 굴려 온다
    if (tg?.scrollIntoView && this.scrolled !== this.i && tg.getClientRects().length) {
      const b = tg.getBoundingClientRect();
      if (b.top > innerHeight - 140 || b.bottom < 90) tg.scrollIntoView({ block: 'center', inline: 'nearest' });
      this.scrolled = this.i;
    }
    if (tg) { const b = tg.getBoundingClientRect ? (tg.getClientRects().length ? tg.getBoundingClientRect() : null) : tg; if (b && b.width > 0) r = { x: b.left - 6, y: b.top - 6, w: b.width + 12, h: b.height + 12 }; }
    // 비출 곳이 화면보다 크면(트리·카드 전체) 화면 안으로 자른다
    if (r) { const y0 = Math.max(r.y, 4), y1 = Math.min(r.y + r.h, innerHeight - 4); r = { ...r, y: y0, h: Math.max(20, y1 - y0) }; }
    this.dim.classList.toggle('on', !!S.center);
    this.spot.classList.toggle('on', !!r);
    if (r) Object.assign(this.spot.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    // 안내 상자: 비춘 곳을 가리지 않게 위나 아래로(둘 다 모자라면 화면 아래)
    const bh = this.box.offsetHeight, H = innerHeight, top0 = 58, bottom0 = H - bh - 80;
    let y;
    if (S.center) y = (H - bh) / 2;
    else if (r) {
      const below = r.y + r.h + 14, above = r.y - bh - 14;
      const up = S.place ? S.place === 'top' : r.y + r.h / 2 > H / 2; // 단계가 정한 쪽이 있으면 그쪽부터
      y = up ? (above >= top0 ? above : below <= bottom0 ? below : bottom0) : (below <= bottom0 ? below : above >= top0 ? above : bottom0);
    } else y = S.place === 'top' ? top0 + 60 : bottom0;
    this.box.style.top = Math.round(Math.max(top0, Math.min(bottom0, y))) + 'px';
  }
}

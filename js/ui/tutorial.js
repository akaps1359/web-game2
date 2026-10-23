// 튜토리얼(코치마크): 설명을 읽기만 하는 대신 실제 화면을 직접 눌러 보며 익힌다.
// 눌러야 할 곳을 밝게 비추고 한 줄로 안내하며, 플레이어가 그 동작을 해내면 다음 단계로 넘어간다.
// 화면 조작은 막지 않는다(오버레이는 터치를 통과시킨다). 처음 새 게임을 시작할 때 한 번만 뜨고, 메뉴에서 다시 볼 수 있다
import { h, $, clear, onTap } from './dom.js';
import { setItem } from './store.js';
import { divsOf, armiesOf } from '../engine/military.js';

export const TUTORIAL_KEY = 'chulhyeol.tutorial.v2';

const isOpen = (app, key) => app.sheet.isOpen && app.sheet.current === key;

function steps(app) {
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
  return [
    { center: true, next: '시작하기', text: () => `${C().name}의 지도자가 되셨습니다.\n직접 눌러 보며 1분 만에 기본 조작을 익혀 볼까요?` },
    { text: '한 손가락으로 지도를 끌어 보세요. 두 손가락으로 벌리면 확대됩니다.', place: 'bottom',
      enter: (t) => { t.cam0 = { ...app.r.cam }; },
      done: (t) => { const c = app.r.cam, c0 = t.cam0; return Math.hypot(c.x - c0.x, c.y - c0.y) * c.s > 60 || Math.abs(Math.log(c.s / c0.s)) > 0.25; } },
    { open: 'focus', text: '아래 「중점」 탭을 누르세요. 나라가 나아갈 방향을 정하는 곳입니다.', target: () => app.tabs?.focus, done: () => isOpen(app, 'focus') },
    { need: 'focus', text: '금빛 테두리 중점 하나를 탭하세요.', place: 'top',
      target: () => $('#sheet .fnode.avail'),
      enter: () => setTimeout(() => $('#sheet .fnode.avail')?.scrollIntoView({ block: 'nearest', inline: 'center' }), 50),
      done: () => !!$('#sheet .fnode.picked') || !!C().focus.cur },
    { need: 'focus', text: '「선택」을 누르면 70일쯤 진행되고, 끝나면 공장·정치력 같은 보상을 받습니다.', place: 'top', target: () => $('#sheet .fdetail .btn.primary'), done: () => !!C().focus.cur },
    { text: '✕를 눌러 패널을 닫으세요. 위쪽 손잡이를 아래로 끌어내려도 닫힙니다.', target: () => $('#sheet .sheet-head .ibtn:last-child'), done: () => !app.sheet.isOpen },
    { text: '위쪽 날짜를 누르면 시간이 흐릅니다. 다시 누르면 멈추고, +/−로 빠르기를 바꿉니다.', target: () => app.hud?.dateBtn, done: () => app.speed > 0 },
    { text: '지도에서 우리 사단 카운터를 탭해 선택하세요.', place: 'auto',
      skip: () => !divsOf(G(), G().player).some((D) => !D.sea),
      enter: () => {
        const D = divsOf(G(), G().player).filter((x) => !x.sea).sort((a, b) => (b.loc === C().capital) - (a.loc === C().capital))[0];
        if (D) { app.r.focusState(D.loc, Math.max(app.r.cam.s, 0.2)); app.dirty = true; app.r.staticDirty = true; }
      },
      target: myStack, done: () => app.sel.divs.size > 0 },
    { text: '이제 보낼 주를 지도에서 탭하세요. 사단이 그곳으로 이동합니다.', place: 'top',
      skip: () => !app.sel.divs.size,
      // 사단 정보 패널이 지도를 가리지 않게 닫고(선택은 유지) 그 사단 쪽으로 지도를 옮긴다.
      // 사단을 직접 움직이면 그 군의 자동 지휘가 꺼지는데, 연습이니 끝나면 원래대로 돌려놓는다
      enter: (t) => {
        t.armies = armiesOf(G(), G().player).map((A) => [A, A.auto]);
        const D = app.selectedDivs()[0];
        app.sheet.close();
        if (D) { app.r.focusState(D.loc, Math.max(app.r.cam.s, 0.2)); app.dirty = true; app.r.staticDirty = true; }
      },
      done: (t) => { const ok = app.selectedDivs().some((D) => D.path.length > 0); if (ok) for (const [A, auto] of t.armies) A.auto = auto; return ok; } },
    { open: 'military', text: '전쟁이 나면 「군사」 탭에서 군을 지휘합니다. 눌러 보세요.', target: () => app.tabs?.military, done: () => isOpen(app, 'military') },
    { need: 'military', next: '알겠어요', place: 'top', skip: () => !armiesOf(G(), G().player).length,
      text: '평소엔 「방어」로 전선을 지키며 계획 보너스를 쌓고, 정면의 적이 지치면(「반격 기회」 알림) 「공세」를 누르세요.',
      target: () => $('#sheet .card.army .seg') },
    { center: true, next: '게임 시작', enter: () => app.sheet.close(),
      text: '준비 끝! 연구·산업·외교도 아래 탭에서 다룹니다.\n메뉴(☰) → 「튜토리얼 다시 보기」로 언제든 다시 볼 수 있어요.' },
  ];
}

export class Tutorial {
  constructor(app) { this.app = app; this.el = null; }
  get active() { return !!this.el; }
  start() {
    this.stop();
    this.list = steps(this.app);
    this.el = h('div', { id: 'coach' }, this.dim = h('div', { class: 'coach-dim' }), this.spot = h('div', { class: 'coach-spot' }), this.box = h('div', { class: 'coach-box' }));
    $('#app').appendChild(this.el);
    this.go(0);
    this.timer = setInterval(() => this.tick(), 200);
  }
  stop() {
    clearInterval(this.timer);
    this.el?.remove(); this.el = null;
  }
  // 끝내거나 건너뛰면 다시 뜨지 않는다(메뉴에서 다시 볼 수 있음)
  finish() { setItem(TUTORIAL_KEY, '1'); this.stop(); }
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
    const foot = h('div', { class: 'cb-foot' }, h('span', { class: 'cb-n' }, `${this.i + 1} / ${n}`));
    if (this.i < n - 1) { const sk = h('button', { class: 'cb-skip' }, '건너뛰기'); onTap(sk, () => { this.finish(); this.app.toast('튜토리얼은 메뉴에서 다시 볼 수 있습니다'); }); foot.appendChild(sk); }
    if (S.next || this.late) { const b = h('button', { class: 'btn sm primary' }, S.next || '다음'); onTap(b, () => this.go(this.i + 1)); foot.appendChild(b); }
    this.box.appendChild(foot);
  }
  tick() {
    if (!this.el) return;
    const app = this.app, S = this.list[this.i];
    // 이벤트 창·타이틀 화면이 떠 있으면 잠시 숨는다(타이틀로 나가면 끝낸다)
    if ($('#title')?.classList.contains('show')) { this.finish(); return; }
    const hidden = $('#modal')?.classList.contains('show');
    this.el.style.display = hidden ? 'none' : '';
    if (hidden) return;
    // 필요한 패널을 닫아 버렸으면 그 패널을 여는 단계로 돌아간다
    if (S.need && !isOpen(app, S.need)) { const j = this.list.findIndex((x) => x.open === S.need); if (j >= 0 && j < this.i) { this.go(j); return; } }
    if (S.done?.(this)) { this.go(this.i + 1); return; }
    // 오래 막혀 있으면 「다음」 버튼을 보여 준다
    if (!S.next && !this.late && performance.now() - this.t0 > 25000) { this.late = true; this.draw(); }
    let r = null;
    const tg = S.target?.(this);
    if (tg) { const b = tg.getBoundingClientRect ? (tg.getClientRects().length ? tg.getBoundingClientRect() : null) : tg; if (b && b.width > 0) r = { x: b.left - 6, y: b.top - 6, w: b.width + 12, h: b.height + 12 }; }
    this.dim.classList.toggle('on', !!S.center);
    this.spot.classList.toggle('on', !!r);
    if (r) Object.assign(this.spot.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    // 안내 상자: 비춘 곳을 가리지 않게 위나 아래로
    const bh = this.box.offsetHeight, H = innerHeight, top0 = 58, bottom0 = H - bh - 80;
    let y;
    if (S.center) y = (H - bh) / 2;
    else if (r) y = r.y + r.h / 2 > H / 2 ? Math.max(top0, r.y - bh - 14) : Math.min(bottom0, r.y + r.h + 14);
    else y = S.place === 'top' ? top0 + 60 : bottom0;
    this.box.style.top = Math.round(y) + 'px';
  }
}

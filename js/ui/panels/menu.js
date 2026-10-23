// 메뉴(저장/불러오기/설정) · 뉴스 · 도움말
import { h, onTap } from '../dom.js';
import { icon } from '../icons.js';
import { btn, card, item, empty } from './common.js';
import { fmtDate } from '../../engine/world.js';
import { showDialog } from '../modal.js';
import { showTitle } from '../title.js';
import { setItem } from '../store.js';
import { TRACKS, MOODS, MOOD_NAME } from '../../audio/score.js';
import { BRAND } from '../../data/brand.js';
import { TOPICS, tutorialDone } from '../tutorial.js';

const SLOTS = ['1', '2', '3'];

export const menuPanel = {
  size: 'tall',
  pause: true,
  title: () => '메뉴',
  render(app, body, arg, ctx) {
    const G = app.G, C = G.countries[G.player];
    body.appendChild(h('div', { class: 'note', style: { margin: '0 2px 10px' } }, `${C.full} · ${fmtDate(G.hour)}`));
    // 저장
    const save = card(`${icon('save')} 저장`);
    for (const s of SLOTS) {
      const m = app.saveMeta(s);
      const right = h('div', { class: 'row', style: { gap: '6px' } });
      const b = btn('저장', () => {
        const go = () => { if (app.save(s)) { app.toast(`슬롯 ${s}에 저장했습니다`, 'peace'); ctx.rerender(); } };
        if (m) showDialog(app, { title: `슬롯 ${s} 덮어쓰기`, body: `${m.name} · ${fmtDate(m.hour)} 저장을 덮어씁니다.`, buttons: [{ text: '덮어쓰기', primary: true, fn: go }, { text: '취소' }] });
        else go();
      }, 'sm primary');
      right.appendChild(b);
      if (m) right.appendChild(btn('불러오기', () => showDialog(app, { title: '불러오기', body: `현재 진행 상황은 저장되지 않습니다. 슬롯 ${s}(${m.name} · ${fmtDate(m.hour)})을(를) 불러올까요?`, buttons: [{ text: '불러오기', primary: true, fn: () => { if (app.load(s)) app.toast('불러왔습니다', 'peace'); } }, { text: '취소' }] }), 'sm'));
      save.appendChild(item({ ic: 'save', t: `슬롯 ${s}`, d: m ? `${m.name} · ${fmtDate(m.hour)} · ${Math.round(m.size / 1024)}KB` : '비어 있음', right }));
    }
    const auto = app.saveMeta('auto');
    if (auto) save.appendChild(item({ ic: 'clock', t: '자동 저장', d: `${auto.name} · ${fmtDate(auto.hour)} (매월 1일)`, right: btn('불러오기', () => { if (app.load('auto')) app.toast('자동 저장을 불러왔습니다', 'peace'); }, 'sm') }));
    body.appendChild(save);
    // 설정
    const set = card(`${icon('settings')} 설정`);
    const S = app.settings();
    const toggle = (key, label, desc, box = set, after) => {
      const on = S[key] ?? true;
      const chk = h('div', { class: 'chk' + (on ? ' on' : ''), html: on ? icon('check') : '' });
      const el = item({ t: label, d: desc, right: chk, onClick: () => { app.setSetting(key, !on); after?.(); ctx.rerender(); } });
      box.appendChild(el);
    };
    toggle('autosave', '자동 저장', '매월 1일 자동으로 저장합니다.');
    toggle('pauseOnWar', '선전포고 시 일시정지', '우리나라가 관련된 전쟁이 시작되면 멈춥니다.');
    toggle('resumeAfterEvent', '이벤트 후 자동 재개', '이벤트 선택 후 원래 속도로 돌아갑니다.');
    toggle('labels', '지명 표시', '지도에 주 이름과 국가 이름을 표시합니다.');
    body.appendChild(set);
    // 소리
    const snd = card(`${icon('music')} 소리`);
    const apply = () => app.music?.apply();
    toggle('music', '배경음악', '평화·긴장·전쟁·진격·위기·승전 등 상황에 맞는 곡이 흐릅니다.', snd, apply);
    if (S.music !== false) {
      const vol = S.musicVol ?? 0.7;
      const seg = h('div', { class: 'seg', style: { width: '150px' } }, [['작게', 0.4], ['보통', 0.7], ['크게', 1]].map(([t, v]) => { const b = h('button', { class: Math.abs(vol - v) < 0.05 ? 'on' : '' }, t); onTap(b, () => { app.setSetting('musicVol', v); apply(); ctx.rerender(); }); return b; }));
      snd.appendChild(item({ t: '음량', right: seg }));
      if (navigator.audioSession) toggle('musicSilent', '무음 모드에서도 재생', '아이폰 옆면 무음 스위치가 켜져 있어도 들립니다. 끄면 다른 앱의 음악과 함께 들을 수 있습니다.', snd, apply);
    }
    const playing = app.music?.playing;
    snd.appendChild(item({ ic: 'music', t: '음악 감상', d: playing ? `지금 재생 중: ${TRACKS[playing].name}` : '곡 목록에서 골라 들을 수 있습니다', onClick: () => app.openPanel('music') }));
    body.appendChild(snd);
    // 튜토리얼: 주제별로 원할 때(각 화면 오른쪽 위 「?」로도 열린다)
    const tut = card(`${icon('target')} 튜토리얼 <small>직접 눌러 보며 배우기 · 주제마다 1분</small>`);
    for (const [k, T] of Object.entries(TOPICS)) {
      const seen = tutorialDone(k);
      tut.appendChild(item({ ic: seen ? 'check' : 'play', t: T.name, d: T.desc + (seen ? ' · 완료' : ''), onClick: () => { app.sheet.close(); app.coach.start(k); } }));
    }
    body.appendChild(tut);
    // 기타
    const etc = card(`${icon('info')} 기타`);
    etc.appendChild(item({ ic: 'info', t: '게임 방법', d: '기본 조작과 규칙', onClick: () => app.openPanel('help') }));
    etc.appendChild(item({ ic: 'news', t: '세계 소식', d: '최근 뉴스 기록', onClick: () => app.openPanel('news') }));
    etc.appendChild(item({ ic: 'flag', t: '타이틀 화면', d: '현재 게임은 자동 저장됩니다', onClick: () => { app.save('auto'); app.sheet.close(); app.setSpeed(0); showTitle(app); } }));
    body.appendChild(etc);
    body.appendChild(h('p', { class: 'note', style: { textAlign: 'center', margin: '14px 0 4px' } }, `${BRAND.title} ${BRAND.sub} · 「하츠 오브 아이언 IV」에서 영감을 받은 팬 제작 게임`));
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
  onClose(app) {
    app.r.showLabels = app.settings().labels !== false; app.r.staticDirty = true; app.dirty = true;
  },
};

// 음악 감상: 곡을 골라 반복해 듣는다(패널을 닫으면 상황별 자동 선곡으로 돌아간다)
export const musicPanel = {
  size: 'tall',
  title: () => '음악 감상',
  render(app, body, arg, ctx) {
    const M = app.music;
    clearInterval(app._musicPoll);
    if (!M) return;
    const sig = M.sig();
    app._musicPoll = setInterval(() => { if (app.sheet.current !== 'music') clearInterval(app._musicPoll); else if (M.sig() !== sig) ctx.rerender(); }, 400);
    if (app.settings().music === false) {
      body.appendChild(card(null, h('p', { class: 'note', style: { margin: '0 0 10px' } }, '배경음악이 꺼져 있습니다.'), btn('배경음악 켜기', () => { app.setSetting('music', true); M.apply(); ctx.rerender(); }, 'primary wide')));
    }
    const now = M.playing;
    const list = h('div', { class: 'list' });
    const mood = M.want && M.want[0] !== '@' ? MOOD_NAME[M.want] : null;
    list.appendChild(item({ ic: 'globe', t: '상황별 자동 선곡', d: M.override ? '게임 상황에 맞춰 곡을 고릅니다' : mood ? `지금 분위기: ${mood}` : '게임 상황에 맞춰 곡을 고릅니다', cls: M.override ? '' : 'sel', onClick: () => { M.preview(null); ctx.rerender(); } }));
    for (const m of Object.keys(MOODS)) {
      for (const id of MOODS[m]) {
        const T = TRACKS[id];
        list.appendChild(item({ ic: now === id ? 'sound' : 'play', t: T.name, d: `${MOOD_NAME[m]} · ${T.desc}`, cls: M.override === id ? 'sel' : '', onClick: () => { M.preview(id); ctx.rerender(); } }));
      }
    }
    body.appendChild(list);
    body.appendChild(h('p', { class: 'note', style: { textAlign: 'center', margin: '12px 4px 0' } }, '모든 곡은 이 게임을 위해 작곡했고, 음원 파일 없이 기기에서 실시간으로 연주합니다. 곡을 고르면 이 화면을 닫을 때까지 반복합니다.'));
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
  onClose(app) { clearInterval(app._musicPoll); app.music?.preview(null); },
};

const KIND_IC = { war: 'swords', peace: 'handshake', capitulate: 'flag', annex: 'crown', faction: 'shield', diplo: 'globe', focus: 'focus', mil: 'military', event: 'news' };
export const newsPanel = {
  size: 'tall',
  title: () => '세계 소식',
  sig: (app) => app.G.news.length + ':' + (app.G.news[0]?.h || 0),
  render(app, body) {
    const G = app.G;
    if (!G.news.length) { body.appendChild(empty('아직 소식이 없습니다.')); return; }
    const list = h('div', { class: 'list' });
    for (const n of G.news) {
      const mine = n.tags?.includes(G.player);
      const el = item({ ic: KIND_IC[n.kind] || 'news', t: n.text, d: fmtDate(n.h), cls: mine ? 'sel' : '' });
      el.querySelector('.t').style.fontWeight = n.big ? '650' : '500';
      el.querySelector('.t').style.fontSize = '12.5px';
      if (n.st != null && n.st >= 0) onTap(el, () => { app.r.focusState(n.st, Math.max(0.2, app.r.cam.s)); app.r.sel.state = n.st; app.dirty = true; });
      list.appendChild(el);
    }
    body.appendChild(list);
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
};

const HELP = [
  ['지도 조작', 'map', '한 손가락으로 끌어 이동, 두 손가락으로 확대·축소합니다. 두 번 탭하면 확대됩니다. 주를 탭하면 정보가, 길게 누르면 언제든 주 정보가 열립니다. 오른쪽 위 버튼으로 지도 모드(정치·진영·지형·산업·자원·보급)를 바꿀 수 있습니다.'],
  ['시간', 'clock', '위쪽 날짜를 탭하면 일시정지/재개합니다. +/- 버튼으로 속도를 바꿉니다. 중요한 이벤트가 생기면 자동으로 멈춥니다.'],
  ['국가 중점', 'focus', '중점 트리에서 다음 목표를 고르세요. 70일 정도 걸리며 완료되면 공장·정치력·영유권·동맹 등 큰 효과를 얻습니다. 중점이 비어 있으면 탭에 빨간 점이 표시됩니다.'],
  ['정치', 'politics', '정치력(★)으로 법률을 바꾸고 고문을 고용합니다. 경제법을 동원 단계로 올리면 소비재 부담이 줄고, 징병법을 올리면 인력이 늘어납니다. 안정도와 전쟁 지지도가 높을수록 유리합니다.'],
  ['연구', 'research', '연구 슬롯마다 기술을 하나씩 연구합니다. 실제 역사 연도보다 앞선 기술은 시간이 크게 늘어납니다. 교리는 갈래 중 하나만 고를 수 있습니다.'],
  ['산업', 'industry', '민간 공장은 건물을 짓고(공장 15개당 1건), 군수 공장은 장비를 생산합니다. 생산 라인에 공장을 배치하면 효율이 서서히 오릅니다. 자원이 부족하면 무역으로 수입하세요(민간 공장 1개 = 자원 8).'],
  ['군사', 'military', '원작의 작전 계획처럼, 군을 「방어」로 두면 전선을 지키며 계획 보너스(최대 +30%)를 쌓고, 「공세」를 누르면 그때부터 공격합니다. 공세는 신중·균형·과감 중 고를 수 있고, 「공세 목표」로 적 주를 찍으면 그쪽으로 밀고 나가 점령 뒤 방어로 돌아갑니다. 적 공세가 꺾여 정면의 적이 지치면 「반격 기회」 알림이 뜹니다 — 탭하면 군사 패널이 열립니다. 직접 지휘하려면 지도에서 사단 카운터를 탭해 선택한 뒤 목적지 주를 탭하세요. 항구에서는 해상 수송과 상륙 작전이 가능합니다.'],
  ['전투', 'swords', '공격 측은 조직력이 높고 돌파·화력이 강할수록, 방어 측은 지형·참호·요새·하천이 유리합니다. 조직력이 바닥난 사단은 후퇴합니다. 포위된 사단은 궤멸합니다. 제공권과 근접 항공 지원도 전투에 큰 영향을 줍니다.'],
  ['외교', 'diplomacy', '다른 나라를 공격하려면 먼저 전쟁 목표를 정당화해야 합니다(정치력 50). 세계 긴장도가 높을수록 민주주의 국가도 행동할 수 있습니다. 진영에 가입하거나 독립을 보장해 동맹을 만드세요.'],
  ['항복', 'flag', '승점이 있는 주를 잃을수록 항복 진행도가 오릅니다. 한계(보통 80%)에 이르면 그 나라는 항복하고 영토가 점령국에 넘어갑니다.'],
];
export const helpPanel = {
  size: 'tall',
  title: () => '게임 방법',
  render(app, body) {
    body.appendChild(h('p', { class: 'note', style: { fontSize: '12.5px', margin: '0 2px 10px' } }, '1936년 1월 1일, 유럽은 다시 전쟁의 그림자 아래 있습니다. 한 나라를 이끌어 공업을 일으키고, 군대를 키우고, 외교와 전쟁으로 역사를 바꾸세요.'));
    for (const [t, ic, d] of HELP) body.appendChild(card(`${icon(ic)} ${t}`, h('div', { class: 'note', style: { fontSize: '12.5px', color: 'var(--text)' } }, d)));
    body.appendChild(btn('시작하기', () => { setItem('chulhyeol.tutorialDone', '1'); app.sheet.close(); }, 'primary wide'));
    body.appendChild(h('div', { class: 'pad-bottom' }));
  },
  onClose() { setItem('chulhyeol.tutorialDone', '1'); },
};

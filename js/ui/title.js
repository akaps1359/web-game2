// 타이틀 화면 · 국가 선택
import { h, $, clear, onTap } from './dom.js';
import { flagURL } from './flags.js';
import { icon } from './icons.js';
import { IDEOLOGIES } from '../data/countries.js';
import { fmtDate } from '../engine/world.js';
import { divsOf } from '../engine/military.js';

const BLURB = {
  GER: '베르사유 체제를 깨뜨린 제3제국. 라인란트 재무장과 4개년 계획으로 유럽의 질서를 뒤흔들 준비를 하고 있다. 강력한 공업과 전격전 교리가 무기지만, 자원은 부족하다.',
  ENG: '해가 지지 않는 제국. 세계 최강의 해군과 영연방의 자원을 거느리지만 국민은 또 다른 전쟁을 원하지 않는다. 유화와 대결 사이에서 길을 찾아야 한다.',
  FRA: '마지노선 뒤의 제3공화국. 대륙 최대의 육군을 보유했으나 잦은 내각 교체와 패배주의가 국가를 마비시키고 있다. 1940년의 비극을 피할 수 있을까?',
  ITA: '무솔리니의 이탈리아는 에티오피아에서 전쟁을 치르는 중이다. 지중해를 "우리의 바다"로 만들겠다는 야망에 비해 공업은 부족하다.',
  SOV: '스탈린의 소련은 5개년 계획으로 급속히 공업화하고 있지만, 대숙청의 그림자가 붉은 군대를 덮치려 한다. 광대한 영토와 인력이 최대의 무기다.',
  USA: '대공황의 상처가 남은 고립주의 국가. 지도 밖에서 거대한 공업력을 키워, 때가 오면 대서양을 건너 민주주의의 병기창이 된다.',
  POL: '독일과 소련 사이에 낀 제2공화국. 빠르게 무장해야 하지만 시간과 공업이 모자란다.',
  SPR: '제2공화국은 좌우 대립으로 분열되어 있다. 1936년 여름, 내전의 불길이 타오른다.',
  CZE: '중부 유럽의 요새. 수데텐의 요새선과 스코다 공장을 갖춘 민주주의 국가지만, 이웃 독일의 요구가 거세진다.',
  FIN: '작지만 강인한 북방의 공화국. 시수 정신으로 동쪽의 거인에 맞선다.',
  TUR: '케말 아타튀르크의 신생 공화국. 해협을 지키며 중립을 지킬 것인가?',
  ROM: '플로이에슈티 유전을 가진 루마니아. 열강의 탐욕 사이에서 살아남아야 한다.',
  HUN: '트리아농 조약으로 잃은 영토를 되찾고자 하는 섭정 왕국.',
  YUG: '세르비아인·크로아티아인·슬로베니아인의 왕국. 내부 분열과 주변의 위협에 직면해 있다.',
  GRE: '메탁사스의 그리스. 지중해와 발칸의 요충지를 지켜야 한다.',
  ETH: '이탈리아의 침략에 맞서 싸우는 에티오피아 제국. 아디스아바바를 지켜낼 수 있을까?',
};

export function showTitle(app) {
  const el = clear($('#title'));
  el.classList.add('show');
  app.inMenu = true;
  const G = app.G;
  let selected = 'GER';
  const wrap = h('div', { class: 'ttl-wrap' });
  // 배경음악 켜고 끄기(첫 탭에서 음악이 시작된다)
  const snd = h('button', { class: 'ibtn ttl-snd', 'aria-label': '배경음악' });
  const sndIcon = () => { snd.innerHTML = icon(app.settings().music === false ? 'mute' : 'sound'); };
  onTap(snd, () => { app.setSetting('music', app.settings().music === false); app.music?.apply(); sndIcon(); });
  sndIcon();
  el.appendChild(snd);
  wrap.appendChild(h('div', { class: 'ttl-logo' }, h('div', { class: 't1' }, '철혈전선'), h('div', { class: 't2' }, '1936 – 1945 · 제2차 세계대전 대전략'), h('div', { class: 'rule' })));
  // 이어하기
  const auto = app.saveMeta('auto');
  if (auto) {
    const b = h('button', { class: 'btn primary wide', style: { height: '46px', fontSize: '15px' } }, h('span', { html: icon('play') }), `이어하기 — ${auto.name} · ${fmtDate(auto.hour)}`);
    onTap(b, () => { if (app.load('auto')) { el.classList.remove('show'); app.inMenu = false; } });
    wrap.appendChild(b);
  }
  wrap.appendChild(h('div', { class: 'ttl-sec' }, '강대국'));
  const majors = ['GER', 'ENG', 'FRA', 'ITA', 'SOV', 'USA'];
  const grid = h('div', { class: 'nation-grid' });
  const info = h('div', { class: 'ttl-info' });
  const cards = {};
  const renderInfo = () => {
    clear(info);
    const C = G.countries[selected];
    const divs = divsOf(G, selected).length;
    info.append(
      h('div', { class: 'row' }, h('img', { class: 'flag-lg', src: flagURL(C.flag, 66, 44) }), h('div', { class: 'grow' }, h('div', { style: { fontFamily: 'var(--serif)', fontSize: '18px', color: 'var(--paper)' } }, C.full), h('div', { class: 'small muted' }, `${C.leader} · ${C.title}`), h('div', { class: 'small', style: { color: IDEOLOGIES[C.ideology].color, marginTop: '2px' } }, `${IDEOLOGIES[C.ideology].name} · ${C.gov}`))),
      h('div', { class: 'grid3', style: { marginTop: '10px' } },
        h('div', { class: 'stat' }, h('div', { class: 'k' }, '민간 공장'), h('div', { class: 'v' }, Math.round(C.eco.civ || 0))),
        h('div', { class: 'stat' }, h('div', { class: 'k' }, '군수 공장'), h('div', { class: 'v' }, Math.round(C.eco.mil || 0))),
        h('div', { class: 'stat' }, h('div', { class: 'k' }, '사단'), h('div', { class: 'v' }, divs))),
      BLURB[selected] ? h('p', { class: 'note', style: { marginBottom: 0 } }, BLURB[selected]) : null,
    );
    for (const t in cards) cards[t].classList.toggle('sel', t === selected);
  };
  for (const t of majors) {
    const C = G.countries[t];
    const card = h('div', { class: 'nation' }, h('div', { class: 'bgflag', style: { backgroundImage: `url(${flagURL(C.flag, 120, 80)})` } }), h('span', { class: 'ideo pill', style: { color: IDEOLOGIES[C.ideology].color } }, IDEOLOGIES[C.ideology].name), h('b', null, C.name), h('small', null, C.leader));
    onTap(card, () => { selected = t; renderInfo(); });
    cards[t] = card; grid.appendChild(card);
  }
  wrap.appendChild(grid);
  wrap.appendChild(h('div', { class: 'ttl-sec' }, '그 밖의 국가'));
  const minors = Object.values(G.countries).filter((C) => C.alive && !majors.includes(C.tag) && C.capital >= 0).sort((a, b) => (b.eco.civ + b.eco.mil) - (a.eco.civ + a.eco.mil));
  const ml = h('div', { class: 'minor-list' });
  for (const C of minors) {
    const m = h('div', { class: 'minor' }, h('img', { class: 'flag-sm', src: flagURL(C.flag, 36, 24) }), C.name);
    onTap(m, () => { selected = C.tag; renderInfo(); for (const x of ml.children) x.classList.toggle('sel', x === m); });
    cards[C.tag] = m;
    ml.appendChild(m);
  }
  wrap.appendChild(ml);
  wrap.appendChild(info);
  const start = h('button', { class: 'btn primary wide', style: { height: '50px', fontSize: '16px', marginTop: '12px' } }, '1936년 1월 1일, 역사를 시작한다');
  onTap(start, () => { el.classList.remove('show'); app.inMenu = false; app.startNew(selected); });
  wrap.appendChild(start);
  // 불러오기
  const slots = ['1', '2', '3'].map((s) => [s, app.saveMeta(s)]).filter(([, m]) => m);
  if (slots.length) {
    wrap.appendChild(h('div', { class: 'ttl-sec' }, '불러오기'));
    for (const [s, m] of slots) {
      const b = h('button', { class: 'btn wide', style: { marginBottom: '6px', justifyContent: 'space-between' } }, h('span', null, `슬롯 ${s} · ${m.name}`), h('span', { class: 'muted small' }, fmtDate(m.hour)));
      onTap(b, () => { if (app.load(s)) { el.classList.remove('show'); app.inMenu = false; } });
      wrap.appendChild(b);
    }
  }
  wrap.appendChild(h('div', { class: 'ttl-foot' }, h('p', { class: 'note', style: { textAlign: 'center' } }, '「하츠 오브 아이언 IV」에서 영감을 받은 팬 제작 전략 게임입니다. 지도: Natural Earth(퍼블릭 도메인). 역사 자료: 위키백과·나무위키.')));
  el.appendChild(wrap);
  renderInfo();
}

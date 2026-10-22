// 역사 이벤트 모음
// 형식: {id, who(태그·목록), title, desc, pic, style('telegram'|신문), paper?, trig(조건), mtth(평균 일수), repeat, manual(다른 효과가 호출),
//        immediate(즉시 효과), news, newsText, opts:[{t, fx, ai(가중치), aiIf}]}
// 본문의 {country}·{leader}는 해당 국가 이름·지도자로 바뀐다.
import { E1936 } from './events/e1936.js';
import { E1938 } from './events/e1938.js';
import { E1940 } from './events/e1940.js';
import { E1942 } from './events/e1942.js';

export const EVENTS = [...E1936, ...E1938, ...E1940, ...E1942];

// 항복 특수 처리: tag 국가가 by 중 한 나라에 항복하면 event를 발생(who:'victor'면 승전국에게)
// anyEnemy: 승전국이 아니어도 적 중에 by가 있으면 적용
export const CAPITULATIONS = [
  { tag: 'ETH', by: ['ITA'], event: 'eth_annexed', who: 'victor' },
  { tag: 'SPR', by: ['NSP'], event: 'nsp_victory', who: 'victor' },
  { tag: 'NSP', by: ['SPR'], event: 'spr_victory', who: 'victor' },
  { tag: 'FRA', by: ['GER', 'ITA'], anyEnemy: true, event: 'fra_compiegne' },
  { tag: 'POL', by: ['GER', 'SOV'], anyEnemy: true, event: 'pol_partition' },
  { tag: 'YUG', by: ['GER', 'ITA', 'HUN', 'BUL'], anyEnemy: true, event: 'yug_partition' },
  { tag: 'GER', event: 'ger_unconditional' },
];

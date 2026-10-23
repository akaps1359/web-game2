// 곡 목록과 짧은 효과 음악(스팅). 스팅은 악절 하나로 끝나고 len초 동안 흐르던 곡을 줄인다
import { Ph, keys } from './compose.js';
import { title, town } from './tracks-town.js';
import { crypt, catacombs, caves, hell, boss } from './tracks-dungeon.js';

export const TRACKS = { title, town, crypt, catacombs, caves, hell, boss };

export const STING_DEFS = {
  // 죽음: 낮은 합창 라단조, 내려가는 금관, 조종(약 4초)
  death: {
    bpm: 60, len: 4.5, pre: () => keys({ bell: [50], gong: 1 }),
    next() {
      const P = new Ph(6);
      P.ch('choiru', 0, [50, 57, 62, 65], 4, 0.55); P.n('str', 0, 38, 4, 0.5);
      P.n('bell', 0, 50, 4, 0.6); P.n('gong', 0, null, 4, 0.25);
      P.seq('brass', 0.3, 'A3:1 G3:1 F3:1 E3:.7 D3:1.5', 0.35);
      return P.out();
    },
  },
  // 승리: 어둡지만 당당하게 — 팀파니가 몰아치고 금관이 올라가 라장조로 끝난다(약 6초)
  victory: {
    bpm: 80, len: 6.5, pre: () => keys({ timp: [38], bell: [50], gong: 1 }),
    next() {
      const P = new Ph(9);
      for (let k = 0; k < 8; k++) P.n('timp', k * 0.25, 38, 0.25, 0.25 + k * 0.06);
      P.seq('brass', 0, 'D4:.5 F4:.5 A4:1 Bb4:1 C5:1 D5:4', 0.55);
      P.ch('brass', 2, [46, 53, 58], 1, 0.4); P.ch('brass', 3, [48, 55, 60], 1, 0.4); P.ch('brass', 4, [50, 57, 62, 66], 4, 0.45);
      P.ch('choir', 4, [50, 57, 62, 66, 69], 4.5, 0.5); P.n('str', 4, 38, 4.5, 0.5);
      P.n('timp', 4, 38, 1, 0.75); P.n('bell', 4, 50, 4, 0.5); P.n('gong', 4, null, 4, 0.35);
      return P.out();
    },
  },
  // 퀘스트: 하프 펼침화음 + 작은 종
  quest: {
    bpm: 90, len: 2.4, pre: () => keys({ harp: [62, 65, 69, 74], chime: [81] }),
    next() {
      const P = new Ph(4);
      P.seq('harp', 0, 'D4:.25 F4:.25 A4:.25 D5:1.25', 0.6);
      P.n('chime', 1, 81, 2, 0.4); P.ch('brass', 0.75, [50, 57], 1.5, 0.3);
      return P.out();
    },
  },
  // 새 구역 발견·우두머리 등장: 쿵 + 솟아오르는 합창 덩어리 + 종
  discover: {
    bpm: 60, len: 3.5, pre: () => keys({ boom: 2, bell: [38], gong: 1 }),
    next() {
      const P = new Ph(4);
      P.n('boom', 0, null, 3, 0.8); P.n('bell', 0, 38, 3, 0.5); P.n('gong', 0.1, null, 3, 0.3);
      P.ch('choiru', 0, [50, 57, 63], 2, 0.45); P.ch('choir', 1.5, [50, 57, 62, 69], 2.2, 0.5);
      P.n('glass', 0.5, 86, 3, 0.6);
      return P.out();
    },
  },
};

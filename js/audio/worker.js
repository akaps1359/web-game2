// 소리 그리기 일꾼: 메인 스레드(게임 화면)를 멈추지 않게 효과음·악기 소리를 따로 계산해 넘겨준다
import { render } from './bank.js';

self.onmessage = (e) => {
  const { id, key, sr } = e.data;
  try {
    const r = render(key, sr);
    self.postMessage({ id, key, ch: r.ch, sr: r.sr, ms: r.ms }, [...new Set(r.ch.map((c) => c.buffer))]);
  } catch (err) {
    self.postMessage({ id, key, err: String((err && err.stack) || err) });
  }
};

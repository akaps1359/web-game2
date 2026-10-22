// 진입점
import { App } from './ui/app.js';

const app = new App();
window.__app = app;
app.boot().catch((e) => {
  console.error(e);
  const m = document.querySelector('.boot-msg');
  if (m) m.textContent = '불러오기 실패: ' + e.message;
});
// 서비스 워커(오프라인 캐시)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// 실제 터치만으로 확인: 제목 → 새 캐릭터 → 모험 시작 → 이야기 닫기 → 탭 이동 → 길게 눌러 이동 → 가방 단추 → 물약 띠
// 사용: node tools/preview/play.mjs tools/preview/touch.mjs [출력 폴더]
export default async function (page, { wait, log, shot, tap }) {
  const center = (text) => page.evaluate((text) => {
    const e = [...document.querySelectorAll('button')].find((b) => b.offsetParent && b.textContent.includes(text));
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, text);
  const pos = () => page.evaluate(() => { const p = window.__game.player; return [+p.x.toFixed(2), +p.y.toFixed(2)]; });
  const check = (name, ok) => log(`${ok ? 'OK  ' : 'FAIL'} ${name}`);
  await wait(800);
  for (const label of ['새 캐릭터', '모험 시작', '계속']) {
    const c = await center(label);
    if (!c) { check(`'${label}' 단추`, false); return; }
    await tap(c[0], c[1]);
    await wait(1200);
  }
  check('게임 시작', await page.evaluate(() => !!window.__app.running && !window.__app.dialog.isOpen()));
  // 화면 가운데 아래쪽을 덮는 요소가 게임 캔버스여야 한다
  check('게임 화면 위를 가리는 것 없음', await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight * 0.65) === document.querySelector('#view')));
  let p0 = await pos();
  await tap(200, 600);
  await wait(1500);
  let p1 = await pos();
  check('탭 이동', p0[0] !== p1[0] || p0[1] !== p1[1]);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 420 }] });
  await wait(900);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(300);
  p0 = p1; p1 = await pos();
  check('길게 눌러 이동', p0[0] !== p1[0] || p0[1] !== p1[1]);
  const bag = await page.evaluate(() => { const b = document.querySelector('.menu-btns > *'); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await tap(bag[0], bag[1]);
  await wait(600);
  check('가방 단추', await page.evaluate(() => window.__app.panels.isOpen()));
  await page.evaluate(() => window.__app.panels.close());
  await wait(300);
  const before = await page.evaluate(() => { const g = window.__game; g.player.hp = 5; return g.hero.data.belt.filter(Boolean).length; });
  const slot = await page.evaluate(() => { const b = document.querySelector('.belt > *'); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await tap(slot[0], slot[1]);
  await wait(600);
  const after = await page.evaluate(() => window.__game.hero.data.belt.filter(Boolean).length);
  check('물약 띠', after === before - 1);
  await shot('touch');
}

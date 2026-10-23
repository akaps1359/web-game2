// 실제 터치만으로 확인: 제목 → 새 캐릭터 → 모험 시작 → 이야기 닫기 → 바닥 탭(움직이지 않음) → 조이스틱 이동 →
// 놓으면 멈춤 → 가까운 마을 사람 탭(대화) → 가방 단추 → 물약 띠
// 사용: node tools/preview/play.mjs tools/preview/touch.mjs [출력 폴더]
export default async function (page, { wait, log, shot, tap }) {
  const center = (text) => page.evaluate((text) => {
    const e = [...document.querySelectorAll('button')].find((b) => b.offsetParent && b.textContent.includes(text));
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, text);
  const pos = () => page.evaluate(() => { const p = window.__game.player; return [+p.x.toFixed(2), +p.y.toFixed(2)]; });
  const moved = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.5;
  const check = (name, ok, extra = '') => log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await wait(800);
  for (const label of ['새 캐릭터', '모험 시작', '계속']) {
    const c = await center(label);
    if (!c) { check(`'${label}' 단추`, false); return; }
    await tap(c[0], c[1]);
    await wait(1200);
  }
  check('게임 시작', await page.evaluate(() => !!window.__app.running && !window.__app.dialog.isOpen()));
  check('게임 화면 위를 가리는 것 없음', await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight * 0.65) === document.querySelector('#view')));
  // 바닥 탭·길게 누르기로는 움직이지 않는다
  let p0 = await pos();
  await tap(300, 330);
  await wait(1200);
  let p1 = await pos();
  check('바닥 탭으로는 움직이지 않음', !moved(p0, p1));
  await touch('touchStart', 320, 360); await wait(800); await touch('touchEnd'); await wait(400);
  p1 = await pos();
  check('바닥 길게 누르기로도 움직이지 않음', !moved(p0, p1));
  // 조이스틱: 왼쪽 아래를 누르고 오른쪽으로 끈다 → 화면 오른쪽으로 걷는다(사방이 트인 곳에서)
  await page.evaluate(() => {
    const g = window.__game, L = g.level, P = g.player;
    const open = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!L.free(x + dx, y + dy, P.id)) return false; return true; };
    for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (open(P.tx + dx, P.ty + dy)) { P.place(L, P.tx + dx, P.ty + dy); return; }
  });
  await wait(600);
  p1 = await pos();
  const H = await page.evaluate(() => innerHeight);
  const sx = 90, sy = H - 200;
  const s0 = await page.evaluate(() => { const g = window.__game, r = window.__app.renderer; return r.toScreen(g.player.x, g.player.y); });
  await touch('touchStart', sx, sy);
  for (let k = 1; k <= 5; k++) { await touch('touchMove', sx + k * 9, sy); await wait(30); }
  check('조이스틱 보임', await page.evaluate(() => document.querySelector('.stick')?.classList.contains('on')));
  await wait(1200);
  const s1 = await page.evaluate(() => { const g = window.__game, r = window.__app.renderer; return r.toScreen(g.player.x, g.player.y); });
  await touch('touchEnd'); await wait(500);
  // 화면 위치는 카메라가 따라오므로 월드 좌표로 비교한다(오른쪽 = isoX 증가 = x - y 증가)
  const w1 = await pos();
  check('조이스틱으로 이동', moved(p1, w1), JSON.stringify(p1) + '→' + JSON.stringify(w1));
  check('오른쪽으로 걸음', (w1[0] - w1[1]) - (p1[0] - p1[1]) > 1.5 && Math.abs((w1[0] + w1[1]) - (p1[0] + p1[1])) < 1.5, `(${(s1.x - s0.x).toFixed(0)}px)`);
  await wait(600);
  const w2 = await pos();
  check('놓으면 멈춤', !moved(w1, w2));
  check('조이스틱 쉬는 자리로', await page.evaluate(() => !document.querySelector('.stick')?.classList.contains('on')));
  // 손 닿는 곳의 마을 사람을 누르면 대화
  const npc = await page.evaluate(() => {
    const g = window.__game, L = g.level, P = g.player;
    const n = L.actors.find((a) => a.kind === 'npc' && !a.dead);
    const p = L.nearestFree(n.tx + 1, n.ty + 1, 3);
    P.place(L, p.x, p.y);
    return n.name;
  });
  await wait(900);
  const ns = await page.evaluate(() => { const g = window.__game, r = window.__app.renderer, n = g.level.actors.find((a) => a.kind === 'npc' && !a.dead); const s = r.toScreen(n.x, n.y); return [s.x, s.y - 25 * r.zoom]; });
  await tap(ns[0], ns[1]);
  await wait(900);
  check(`가까운 마을 사람(${npc}) 탭 → 대화`, await page.evaluate(() => window.__app.dialog.isOpen()));
  await page.evaluate(() => window.__app.dialog.close());
  await wait(400);
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

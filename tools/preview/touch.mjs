// 실제 터치만으로 확인(가로 화면, 콘솔식 조작): 제목 → 새 캐릭터 → 모험 시작 → 이야기 닫기 → 게임 화면 탭은 아무 일 없음 →
// 조이스틱 이동(바로 출발·놓자마자 멈춤) → 상호작용 단추(대화·떠난다·줍기·계단) → 공격 단추(그 자리에서 조이스틱 쪽 적을 겨눠 공격) → 가방 단추 → 물약 띠
// 사용: node tools/preview/play.mjs tools/preview/touch.mjs [출력 폴더]
export default async function (page, { wait, log, shot, tap }) {
  const center = (sel, text = '') => page.evaluate(([sel, text]) => {
    const e = [...document.querySelectorAll(sel)].find((b) => b.offsetParent && b.textContent.includes(text));
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, [sel, text]);
  const pos = () => page.evaluate(() => { const p = window.__game.player; return [+p.x.toFixed(2), +p.y.toFixed(2)]; });
  const moved = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.5;
  const check = (name, ok, extra = '') => log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const press = async (sel, text) => { const c = await center(sel, text); if (!c) return false; await tap(c[0], c[1]); return true; };
  const verb = () => page.evaluate(() => { const b = document.querySelector('.actbtn'); return b && b.classList.contains('on') ? b.textContent : ''; });
  await wait(800);
  for (const label of ['새 캐릭터', '모험 시작', '계속']) {
    if (!(await press('button', label))) { check(`'${label}' 단추`, false); return; }
    await wait(1200);
  }
  check('게임 시작', await page.evaluate(() => !!window.__app.running && !window.__app.dialog.isOpen()));
  check('게임 화면 위를 가리는 것 없음', await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight * 0.65) === document.querySelector('#view')));
  // 사방이 트인 곳으로
  const openSpot = () => page.evaluate(() => {
    const g = window.__game, L = g.level, P = g.player;
    const open = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!L.free(x + dx, y + dy, P.id) || L.obj(x + dx, y + dy)) return false; return true; };
    for (let r = 0; r < 25; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (open(P.tx + dx, P.ty + dy)) { P.place(L, P.tx + dx, P.ty + dy); return true; }
    return false;
  });
  await openSpot(); await wait(500);
  // 게임 화면을 눌러서는(마을 사람 위라도) 아무 일도 없다
  const VW = await page.evaluate(() => innerWidth), H = await page.evaluate(() => innerHeight);
  const p0 = await pos();
  await tap(VW * 0.68, 150); await wait(900);
  await touch('touchStart', VW * 0.7, 170); await wait(800); await touch('touchEnd'); await wait(400);
  const npcXY = await page.evaluate(() => { const g = window.__game, r = window.__app.renderer, n = g.level.actors.find((a) => a.kind === 'npc' && !a.dead); const s = r.toScreen(n.x, n.y); return [s.x, s.y - 25 * r.zoom]; });
  if (npcXY[0] > VW * 0.45 && npcXY[0] < VW && npcXY[1] > 0 && npcXY[1] < H) { await tap(npcXY[0], npcXY[1]); await wait(800); }
  const p1 = await pos();
  check('게임 화면 탭·길게 누르기로는 아무 일 없음', !moved(p0, p1) && !(await page.evaluate(() => window.__app.dialog.isOpen())));
  // 조이스틱: 왼쪽을 누르고 오른쪽으로 끈다 → 화면 오른쪽으로 걷는다
  const sx = 110, sy = H - 110;
  await touch('touchStart', sx, sy);
  await touch('touchMove', sx + 20, sy); await wait(120);
  const go = await pos();
  check('조이스틱: 밀자마자 출발', Math.hypot(go[0] - p1[0], go[1] - p1[1]) > 0.05, JSON.stringify(p1) + '→' + JSON.stringify(go));
  for (let k = 3; k <= 5; k++) { await touch('touchMove', sx + k * 9, sy); await wait(30); }
  check('조이스틱 보임', await page.evaluate(() => document.querySelector('.stick')?.classList.contains('on')));
  await wait(1100);
  await touch('touchEnd');
  const e0 = await pos(); await wait(150);
  const e1 = await pos();
  check('놓자마자 멈춤', Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) < 0.15, JSON.stringify(e0) + '→' + JSON.stringify(e1));
  await wait(350);
  const w1 = await pos();
  check('조이스틱으로 이동', moved(p1, w1), JSON.stringify(p1) + '→' + JSON.stringify(w1));
  check('오른쪽으로 걸음', (w1[0] - w1[1]) - (p1[0] - p1[1]) > 1.5 && Math.abs((w1[0] + w1[1]) - (p1[0] + p1[1])) < 1.5);
  await wait(600);
  check('놓으면 멈춤', !moved(w1, await pos()));
  check('조이스틱 쉬는 자리로', await page.evaluate(() => !document.querySelector('.stick')?.classList.contains('on')));
  // 손 닿는 곳의 마을 사람 → 상호작용 단추 '대화'
  const npc = await page.evaluate(() => {
    const g = window.__game, L = g.level, P = g.player;
    const n = L.actors.find((a) => a.kind === 'npc' && !a.dead);
    const p = L.nearestFree(n.tx + 1, n.ty + 1, 3);
    P.place(L, p.x, p.y);
    return n.name;
  });
  await wait(600);
  const v1 = await verb();
  await press('.actbtn'); await wait(800);
  check(`가까운 마을 사람(${npc}) → 상호작용 단추 '${v1}' → 대화`, v1 === '대화' && await page.evaluate(() => window.__app.dialog.isOpen()));
  await page.evaluate(() => window.__app.dialog.close()); await wait(300);
  // 공격 단추에 엄지를 올려 둔 채 다른 손가락으로 대화를 열고 '떠난다' → 다시 뜨지 않는다
  const T = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const isOpen = () => page.evaluate(() => window.__app.dialog.isOpen());
  const ab0 = await center('.sbtn.main'), f0 = { x: ab0[0], y: ab0[1], id: 1 };
  await T('touchStart', [f0]); await wait(400);
  const byAttack = await isOpen();
  const ib = await center('.actbtn');
  if (ib && !byAttack) { await T('touchStart', [f0, { x: ib[0], y: ib[1], id: 2 }]); await wait(60); await T('touchEnd', [f0]); await wait(600); }
  const lv = await center('.dlg-opt', '떠난다');
  if (lv) { await T('touchStart', [f0, { x: lv[0], y: lv[1], id: 3 }]); await wait(60); await T('touchEnd', [f0]); }
  let again = false;
  for (let i = 0; i < 8 && !again; i++) { await wait(150); again = await isOpen(); }
  await T('touchEnd', []); await wait(300);
  check("공격 단추를 누른 채 '떠난다' → 대화가 다시 뜨지 않음", !byAttack && !!lv && !again, byAttack ? '(공격 단추가 대화를 엶)' : '');
  await page.evaluate(() => window.__app.dialog.close()); await wait(300);
  // 옆의 아이템 → '줍기'
  await openSpot();
  const inv0 = await page.evaluate(async () => {
    const g = window.__game, P = g.player, I = await import(new URL('js/game/items.js', location.href).href), Lo = await import(new URL('js/game/loot.js', location.href).href);
    Lo.groundItem(g, I.makeItem('cap'), P.tx + 1, P.ty);
    return g.hero.data.inv.length;
  });
  await wait(900);
  const v2 = await verb();
  await press('.actbtn'); await wait(600);
  check(`옆의 아이템 → 상호작용 단추 '${v2}' → 가방으로`, v2 === '줍기' && await page.evaluate(() => window.__game.hero.data.inv.length) === inv0 + 1);
  // 던전: 공격 단추는 조이스틱 방향의 적을 겨눈다
  const r = await page.evaluate(async () => {
    const g = window.__game, AI = await import(new URL('js/game/ai.js', location.href).href);
    g.god = true; g.enter(1, 'down');
    const L = g.level, P = g.player;
    const ok = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!L.free(x + dx, y + dy, P.id) || L.obj(x + dx, y + dy)) return false; return true; };
    let found = false;
    for (let rr = 0; rr < 40 && !found; rr++) for (let dy = -rr; dy <= rr && !found; dy++) for (let dx = -rr; dx <= rr && !found; dx++) if (ok(P.tx + dx, P.ty + dy)) { P.place(L, P.tx + dx, P.ty + dy); found = true; }
    for (const a of L.actors) if (a.team === 1) a.aware = false;
    // 화면 왼쪽 = 월드 (-1,+1) 쪽, 오른쪽 = (+1,-1) 쪽
    const left = AI.spawnMonster(g, L, 'zombie', P.tx - 1, P.ty + 1), right = AI.spawnMonster(g, L, 'zombie', P.tx + 1, P.ty - 1);
    for (const m of [left, right]) { m.aware = false; m.hp = m.hpMax = 99999; m.speed = 0.01; }
    g.lastTile = -1;
    window.__mons = { left, right };
    return found;
  });
  await wait(800);
  // 조이스틱을 오른쪽으로 살짝 민 채(첫째 손가락) 공격 단추(둘째 손가락)
  const f1 = { x: sx, y: sy, id: 1 };
  await T('touchStart', [f1]); f1.x += 14; await T('touchMove', [f1]); await wait(60);
  const ab = await center('.sbtn.main');
  await T('touchStart', [f1, { x: ab[0], y: ab[1], id: 2 }]); await wait(80);
  await T('touchEnd', [f1]);
  // 휘두르는지 지켜본다(빗나가도 휘두르기는 한다)
  let hit = false;
  for (let i = 0; i < 20 && !hit; i++) { await wait(50); hit = await page.evaluate(() => window.__game.player.anim.name === 'attack' || window.__mons.right.hp < window.__mons.right.hpMax); }
  const tgt = await page.evaluate(() => { const g = window.__game; return g.target === window.__mons.right ? 'right' : g.target === window.__mons.left ? 'left' : String(g.target?.name); });
  await T('touchEnd', []); await wait(300);
  check('공격 단추: 조이스틱 쪽(오른쪽) 적을 겨누고 공격', tgt === 'right' && hit, `대상=${tgt}${r ? '' : ' (트인 자리 없음)'}`);
  await page.evaluate(() => { for (const m of Object.values(window.__mons)) { m.hp = 0; m.dead = true; } });
  // 계단 옆 → '내려가기' → 다음 층
  const d0 = await page.evaluate(() => {
    const g = window.__game, L = g.level, P = g.player;
    const st = L.objects.find((o) => o.type === 'stairs_down' && !o.sealed);
    const p = L.nearestFree(st.x + 1, st.y + 1, 3);
    P.place(L, p.x, p.y); g.lastTile = -1;
    return g.depth;
  });
  await wait(700);
  const v3 = await verb();
  await press('.actbtn'); await wait(1500);
  check(`계단 옆 → 상호작용 단추 '${v3}' → 다음 층`, v3 === '내려가기' && await page.evaluate(() => window.__game.depth) === d0 + 1);
  // 가방 단추, 물약 띠
  await press('.menu-btns > *'); await wait(600);
  check('가방 단추', await page.evaluate(() => window.__app.panels.isOpen()));
  await page.evaluate(() => window.__app.panels.close()); await wait(300);
  const before = await page.evaluate(() => { const g = window.__game; g.player.hp = 5; return g.hero.data.belt.filter(Boolean).length; });
  await press('.belt > *'); await wait(600);
  check('물약 띠', await page.evaluate(() => window.__game.hero.data.belt.filter(Boolean).length) === before - 1);
  await shot('touch');
}

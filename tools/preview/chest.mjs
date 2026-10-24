// 상자·석관은 상호작용 단추 '열기'로, 통은 공격으로(화살·주문으로도) 부순다. 공격은 상자를 열지 않는다
// 사용: node tools/preview/play.mjs tools/preview/chest.mjs [출력 폴더]
export default async function (page, { shot, wait, log, tap }) {
  await wait(400);
  const res = await page.evaluate(async () => {
    const out = [];
    const ok = (name, cond, info = '') => out.push(`${cond ? 'OK  ' : 'FAIL'} ${name} ${info}`);
    const AI = await import('./js/game/ai.js');
    const LV = await import('./js/game/level.js');
    // 사방 3칸이 트인 자리를 찾을 때까지 새 판을 연다(좁은 지도면 다시)
    const setup = (cls) => {
      for (let tries = 0; tries < 12; tries++) {
        window.__app.newGame(cls, '시험', false); window.__app.dialog.close();
        const g = window.__game; g.god = true; g.enter(1, 'down');
        const L = g.level, P = g.player;
        for (const a of L.actors) if (a.team === 1) a.dead = true;
        L.actors = L.actors.filter((a) => !a.dead);
        const free = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!L.free(x + dx, y + dy, P.id) || L.obj(x + dx, y + dy)) return false; return true; };
        let found = false;
        outer: for (let r = 0; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (free(P.tx + dx, P.ty + dy)) { P.place(L, P.tx + dx, P.ty + dy); found = true; break outer; }
        if (!found) continue;
        g.lastTile = -1; g.update(0.016);
        return g;
      }
      throw new Error('트인 자리 없음');
    };
    // 상자 쪽을 바라보고(다가갈 때처럼) 단추 대상을 다시 고른다
    const face = (g, o) => { g.player.turnTo(o.x, o.y); g.player.face = g.player.faceTo; g.updateFocus(); };
    const put = (g, type, dx, dy, extra = {}) => { const L = g.level, P = g.player; const o = L.addObject({ type, x: P.tx + dx, y: P.ty + dy, solid: true, ...extra }); L.flags[L.idx(o.x, o.y)] |= LV.F_SOLID; g.lastTile = -1; g.update(0.016); return o; };
    const run = (g, sec) => { for (let i = 0; i < sec * 60; i++) g.update(1 / 60); };
    // 통에서 나온 아이템·해골을 치운다(줍기·적이 먼저 잡히지 않게)
    const tidy = (g) => { const L = g.level; L.items.length = 0; for (const a of L.actors) if (a.team === 1) { a.release(L); a.dead = true; } L.actors = L.actors.filter((a) => !a.dead); g.update(0.016); };
    // 1) 전사: 옆 상자 → 상호작용 단추 '열기' → 열림
    let g = setup('warrior');
    const chest = put(g, 'chest', 1, 0);
    face(g, chest);
    ok('상자 → 상호작용 단추 열기', g.focus?.ref === chest && g.focus.verb === '열기', g.focus ? g.focus.verb : '없음');
    g.interact(); run(g, 1);
    ok('단추로 상자 열림', !!chest.open);
    g.updateFocus();
    ok('열린 상자는 단추에서 빠짐', g.focus?.ref !== chest, g.focus?.verb || '없음');
    // 2) 공격은 상자를 열지 않는다
    const chest2 = put(g, 'chest', -1, 0);
    for (let i = 0; i < 3; i++) { g.attackNearest(); run(g, 0.8); }
    ok('공격으로는 상자가 안 열림', !chest2.open);
    // 3) 통: 단추에 안 나오고 공격으로 부서짐
    const barrel = put(g, 'barrel', 0, 1);
    g.updateFocus();
    ok('통은 상호작용 단추에 안 나옴', g.focus?.ref !== barrel, g.focus?.verb || '없음');
    for (let i = 0; i < 2 && !barrel.broken; i++) { g.attackNearest(); run(g, 1); }
    ok('전사: 공격으로 통 부수기', !!barrel.broken);
    // 4) 석관도 '열기'(옆에 떨어진 상자 보상은 줍기가 먼저라 치운다)
    chest2.open = true; g.level.items.length = 0;
    const sarc = put(g, 'sarc', 1, 1);
    face(g, sarc);
    const v = g.focus?.ref === sarc ? g.focus.verb : '다른 대상 ' + (g.focus?.verb || '');
    g.interact(); run(g, 1);
    ok('석관 → 열기 단추로 열림', !!sarc.open, v || '');
    // 5) 로그: 통은 쏴서, 상자는 단추로
    g = setup('rogue');
    const b3 = put(g, 'barrel', 0, 2);
    g.attackNearest(); run(g, 1.5);
    ok('활: 통은 쏴서 부순다', !!b3.broken);
    tidy(g);
    const c3 = put(g, 'chest', 1, 0);
    g.attackNearest(); run(g, 1);
    ok('활: 공격은 상자를 열지 않음', !c3.open);
    tidy(g); face(g, c3);
    const f3 = g.focus?.ref === c3;
    g.interact(); run(g, 1);
    ok('활: 상자는 단추로 열림', !!c3.open, f3 ? '' : '대상 ' + (g.focus?.verb || '없음'));
    // 6) 소서러: 화염탄으로 통
    g = setup('sorcerer');
    const b4 = put(g, 'barrel', 3, 0);
    g.player.mp = 100; g.hero.data.skills.fire_bolt = 1;
    let spawned = 0; const push0 = g.level.missiles.push.bind(g.level.missiles); g.level.missiles.push = (...a) => { spawned++; return push0(...a); };
    const used = g.useSkill('fire_bolt', { point: { x: b4.x, y: b4.y } }); run(g, 1.5);
    ok('주문: 화염탄으로 통 부수기', !!b4.broken, b4.broken ? '' : `쓰기 ${used} 투사체 ${spawned} 칸 ${g.level.passable(b4.x, b4.y)}`);
    return out;
  });
  for (const l of res) log(l);
  // 7) 실제 터치: 옆 상자 → 화면의 상호작용 단추를 눌러 연다
  const r = await page.evaluate(async () => {
    const LV = await import('./js/game/level.js');
    const g = window.__game, L = g.level, P = g.player;
    for (const a of L.actors) if (a.team === 1) { a.dead = true; } L.actors = L.actors.filter((a) => !a.dead);
    const p = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => [P.tx + dx, P.ty + dy]).find(([x, y]) => L.passable(x, y) && !L.obj(x, y));
    const o = L.addObject({ type: 'chest', x: p[0], y: p[1], solid: true }); L.flags[L.idx(o.x, o.y)] |= LV.F_SOLID; g.lastTile = -1;
    window.__chest = o;
    return !!p;
  });
  await wait(600);
  const btn = await page.evaluate(() => { const b = document.querySelector('.actbtn'); if (!b || !b.classList.contains('on')) return null; const r = b.getBoundingClientRect(); return { t: b.textContent, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (btn) { await tap(btn.x, btn.y); await wait(900); }
  const opened = await page.evaluate(() => !!window.__chest.open);
  log(`${btn && btn.t.includes('열기') && opened ? 'OK  ' : 'FAIL'} 실제 단추 '${btn?.t || '없음'}' 눌러 상자 열기`);
  await shot('chest_open');
}

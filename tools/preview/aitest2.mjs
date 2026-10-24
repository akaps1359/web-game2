// 괴물 AI 특수 행동 검증: 벽 돌아오기·추격·궁수 거리 두기·타락귀 도망·청소부 시체 먹기·가고일 돌 회복·숨은 자·잠든 괴물·
// 무리 겹침·문 열기·보스 소환. 사용: node tools/preview/play.mjs tools/preview/aitest2.mjs [출력 폴더]
export default async function (page, { log }) {
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__app.newGame('warrior', 'AI', false); window.__app.dialog.close(); window.__app.running = false; });
  const res = await page.evaluate(async () => {
    const g = window.__game, AI = await import('/js/game/ai.js'), C = await import('/js/game/combat.js');
    const out = [];
    const ok = (name, cond, extra = '') => out.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    const clear = (L) => { for (const a of L.actors.slice()) if (a !== g.player) { a.release(L); L.actors.splice(L.actors.indexOf(a), 1); } L.missiles.length = 0; L.areas.length = 0; L.corpses.length = 0; };
    const P = () => g.player;
    const run = (sec, each) => { for (let i = 0; i < sec * 30; i++) { const p = P(); p.hpMax = 1e5; p.hp = 1e5; g.update(1 / 30); if (each && each(i) === false) break; } };
    const setup = (depth) => { g.enter(depth, 'down'); const L = g.level; clear(L); const r = L.rooms.find((r) => r.w >= 8 && r.h >= 8 && !r.special) || L.rooms[0]; const p = L.nearestFree(r.cx, r.cy, 3); P().place(L, p.x, p.y); g.dmap.build(L, p.x, p.y); g.lastTile = -1; return { L, r }; };
    const spawnAt = (L, id, dx, dy) => { const p = L.nearestFree(P().tx + dx, P().ty + dy, 3); return p ? AI.spawnMonster(g, L, id, p.x, p.y) : null; };
    const dist = (a) => Math.hypot(a.x - P().x, a.y - P().y);

    // 1) 벽 너머: 직선으로는 막혔지만 길이 있으면 돌아서 온다
    {
      g.enter(3, 'down'); const L = g.level; clear(L);
      // 플레이어와 같은 방이 아닌, 길 거리 12~25칸인 칸
      const p0 = P(); g.dmap.build(L, p0.tx, p0.ty);
      let spot = null;
      for (let y = 1; y < L.h - 1 && !spot; y++) for (let x = 1; x < L.w - 1; x++) { const dm = g.dmap.at(x, y); if (dm > 12 && dm < 25 && L.free(x, y) && !L.los(x, y, p0.tx, p0.ty) && Math.hypot(x - p0.tx, y - p0.ty) < dm * 0.7) { spot = { x, y, dm }; break; } }
      if (spot) {
        const m = AI.spawnMonster(g, L, 'flesh_clan', spot.x, spot.y); m.aware = true;
        let reached = -1; run(30, (i) => { if (dist(m) < 1.7) { reached = i / 30; return false; } });
        ok('벽 너머에서 돌아서 다가옴', reached >= 0, `길 ${spot.dm.toFixed(0)}칸, ${reached.toFixed(1)}초`);
      } else ok('벽 너머 시험 자리', false, '자리 없음');
    }
    // 2) 카이팅: 플레이어가 물러나면 근접 괴물은 따라오고, 궁수는 거리를 유지하며 쏜다
    {
      const { L } = setup(2);
      const m = spawnAt(L, 'skeleton', 3, 0); m.aware = true;
      let maxD = 0, moved = 0, last = { x: m.x, y: m.y };
      const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      for (let k = 0; k < 4; k++) { g.setStick(dirs[k][0], dirs[k][1]); run(1.5, () => { maxD = Math.max(maxD, dist(m)); moved += Math.hypot(m.x - last.x, m.y - last.y); last = { x: m.x, y: m.y }; }); }
      g.setStick(null);
      ok('근접 괴물이 움직이는 플레이어를 따라옴', moved > 4 && maxD < 9, `이동 ${moved.toFixed(1)}, 최대 거리 ${maxD.toFixed(1)}`);
      clear(L);
      const a = spawnAt(L, 'skel_archer', 2, 0); a.aware = true;
      let shots = 0, back = 0; const d0 = dist(a);
      run(6, () => { for (const ms of L.missiles) if (ms.team === 1 && !ms._c) { ms._c = 1; shots++; } });
      back = dist(a) - d0;
      ok('궁수가 가까우면 물러나고 쏨', shots > 0 && back > 0, `쏨 ${shots}, 거리 변화 ${back.toFixed(1)}`);
    }
    // 3) 타락귀: 동료가 죽으면 겁먹고 달아났다가 돌아온다
    {
      const { L } = setup(1);
      const f = [spawnAt(L, 'fallen', 2, 0), spawnAt(L, 'fallen', 2, 1), spawnAt(L, 'fallen', 3, -1)].filter(Boolean);
      for (const x of f) x.aware = true;
      run(0.5);
      C.damageActor(g, f[0], 9999, 'phys', P());
      const d0 = f.slice(1).map(dist);
      let feared = f.slice(1).some((x) => x.fear > 0), maxAway = 0;
      run(1.5, () => { maxAway = Math.max(maxAway, ...f.slice(1).map((x, i) => dist(x) - d0[i])); });
      ok('타락귀: 동료가 죽으면 겁먹고 달아남', feared && maxAway > 0.8, `겁 ${feared}, 멀어짐 ${maxAway.toFixed(1)}`);
      let back = false; run(12, () => { if (f.slice(1).some((x) => !x.dead && dist(x) < 1.7)) { back = true; return false; } });
      ok('타락귀: 다시 돌아와 싸움', back);
    }
    // 4) 청소부: 생명력이 반 아래면 시체를 먹고 회복
    {
      const { L } = setup(1);
      const s = spawnAt(L, 'scavenger', 4, 0); s.aware = true; s.hp = Math.floor(s.hpMax * 0.3);
      L.corpses.push({ id: 999, x: s.x + 1, y: s.y, face: 0, look: s.look, fallDir: 1, type: 'skeleton', monRef: true });
      const hp0 = s.hp; let ate = false;
      run(6, () => { if (s.eating) ate = true; });
      ok('청소부: 다치면 시체를 먹어 회복', ate && s.hp > hp0, `먹음 ${ate}, ${hp0}→${s.hp}/${s.hpMax}`);
    }
    // 5) 가고일: 깨어난 뒤 반 아래로 다치면 물러나 돌이 되어 회복
    {
      const { L } = setup(7);
      const m = spawnAt(L, 'gargoyle', 2, 0);
      run(1);
      const woke = !m.stone;
      C.damageActor(g, m, Math.ceil(m.hpMax * 0.6), 'phys', P());
      let stoned = false, healed = false;
      run(10, () => { if (m.stone) stoned = true; if (stoned && m.hp >= m.hpMax * 0.99) { healed = true; return false; } });
      ok('가고일: 깨어남 → 다치면 돌이 되어 회복', woke && stoned && healed, `깸 ${woke}, 돌 ${stoned}, 회복 ${healed}`);
    }
    // 6) 숨은 자: 멀리선 안 보이고 가까이 오면 드러나며, 맞으면 물러나 다시 숨는다
    {
      const { L } = setup(2);
      const m = spawnAt(L, 'hidden', 6, 0); m.aware = true;
      const far = m.invis;
      let shown = false; run(12, () => { if (m.invis > 0.8) { shown = true; return false; } });
      C.damageActor(g, m, 1, 'phys', P(), { noStun: true });
      let hid = false; run(3, () => { if (m.invis < 0.3 && dist(m) > 1.5) { hid = true; return false; } });
      ok('숨은 자: 가까이 오면 드러남', far < 0.5 && shown, `처음 ${far}, 드러남 ${shown}`);
      ok('숨은 자: 맞으면 물러나 다시 숨음', hid);
    }
    // 7) 멀리 있는 괴물은 잠든다(24칸 밖)
    {
      g.enter(4, 'down'); const L = g.level; clear(L);
      let spot = null;
      for (let y = 1; y < L.h - 1 && !spot; y++) for (let x = 1; x < L.w - 1; x++) if (L.free(x, y) && Math.hypot(x - P().tx, y - P().ty) > 30) { spot = { x, y }; break; }
      if (spot) { const m = AI.spawnMonster(g, L, 'skeleton', spot.x, spot.y); const x0 = m.x, y0 = m.y; run(5); ok('먼 괴물은 잠듦(움직이지 않음)', m.x === x0 && m.y === y0 && !m.aware); }
    }
    // 8) 여럿이 몰려도 같은 칸에 겹치지 않고, 벽·물체 칸에 서지 않는다
    {
      const { L } = setup(5);
      const ms = []; for (let i = 0; i < 12; i++) { const m = spawnAt(L, i % 2 ? 'flesh_clan' : 'skeleton', 3 + (i % 4), -2 + Math.floor(i / 4) * 2); if (m) { m.aware = true; ms.push(m); } }
      let overlap = 0, inWall = 0;
      run(8, () => { const seen = new Map(); for (const m of ms) { if (m.dead) continue; const k = m.ty * L.w + m.tx; if (seen.has(k) && !m.mv && !seen.get(k).mv) overlap++; seen.set(k, m); if (!L.passable(m.tx, m.ty)) inWall++; } });
      ok('무리: 겹침·벽 안 없음', overlap === 0 && inWall === 0, `겹침 ${overlap}, 벽 ${inWall}`);
      const near = ms.filter((m) => dist(m) < 1.7).length;
      ok('무리: 둘러싸고 공격', near >= 4, `붙은 수 ${near}/${ms.length}`);
    }
    // 9) 문: 산양족은 문을 열고, 해골은 못 연다
    {
      let found = null;
      for (const d of [5, 6, 7, 2, 3]) {
        g.enter(d, 'down'); const L = g.level; clear(L);
        const door = L.objects.find((o) => o.type === 'door' && !o.open && !o.locked);
        if (door) { found = { L, door }; break; }
      }
      if (found) {
        const { L, door } = found;
        // 문 양쪽 칸
        const sides = door.ori === 'y' ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
        const a = sides.map(([dx, dy]) => ({ x: door.x + dx * 2, y: door.y + dy * 2 })).filter((p) => L.free(p.x, p.y));
        if (a.length === 2) {
          P().place(L, a[0].x, a[0].y); g.dmap.build(L, a[0].x, a[0].y); g.lastTile = -1;
          const m = AI.spawnMonster(g, L, 'flesh_clan', a[1].x, a[1].y); m.aware = true;
          run(6, () => { if (door.open) return false; });
          ok('산양족이 문을 엶', door.open);
        } else ok('문 시험 자리', false, '양쪽 칸 없음');
      } else ok('문 시험', false, '문 없음');
    }
    // 10) 보스: 망자의 왕은 해골을 일으키고, 벨가스는 광역기를 쓴다
    {
      const { L } = setup(3);
      const k = AI.spawnBoss(g, L, 'hollow_king', P().tx + 3, P().ty); k.aware = true;
      const n0 = L.actors.length; run(9);
      ok('망자의 왕: 해골을 일으킴', L.actors.length > n0, `${n0}→${L.actors.length}`);
      clear(L);
      const v = AI.spawnBoss(g, L, 'velgath', P().tx + 4, P().ty); v.aware = true;
      let hits = 0; const hp0 = P().hp; run(12, () => { if (P().hp < 1e5) hits++; });
      ok('벨가스: 싸움(피해를 줌)', hits > 0, `맞음 ${hits}`);
    }
    return out;
  });
  log(res.join('\n'));
}

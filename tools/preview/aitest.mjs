// 괴물 AI 검증: 모든 괴물을 저마다 맞는 층에 하나씩 소환해 20초 시뮬레이션(플레이어는 가만히, 죽지 않게 체력만 채움).
// 다가와 때리는지·쏘는지, 벽 속·잘못된 칸에 서지 않는지, 3초 넘게 제자리에서 끼지 않는지, 오류가 없는지 본다
// 사용: node tools/preview/play.mjs tools/preview/aitest.mjs [출력 폴더] (ONLY=skeleton,fallen 처럼 골라 돌릴 수 있다)
export default async function (page, { log }) {
  await page.waitForTimeout(300);
  await page.evaluate((o) => { window.__app.newGame('warrior', 'AI', false); window.__app.dialog.close(); window.__app.running = false; if (o) window.__only = o.split(','); }, process.env.ONLY || '');
  const res = await page.evaluate(async () => {
    const g = window.__game, AI = await import('/js/game/ai.js'), { MONSTERS } = await import('/js/data/monsters.js');
    const out = [];
    const clear = (L) => { for (const a of L.actors.slice()) if (a !== g.player) { a.release(L); L.actors.splice(L.actors.indexOf(a), 1); } L.missiles.length = 0; L.areas.length = 0; L.corpses.length = 0; };
    const spotAt = (L, P, dmin, dmax) => {
      const c = [];
      for (let dy = -dmax; dy <= dmax; dy++) for (let dx = -dmax; dx <= dmax; dx++) {
        const d = Math.hypot(dx, dy), x = P.tx + dx, y = P.ty + dy;
        if (d < dmin || d > dmax || !L.free(x, y) || L.obj(x, y)) continue;
        if (!L.los(P.tx, P.ty, x, y)) continue;
        c.push({ x, y, d });
      }
      c.sort((a, b) => Math.abs(a.d - (dmin + dmax) / 2) - Math.abs(b.d - (dmin + dmax) / 2));
      return c[0];
    };
    const ids = (window.__only || Object.keys(MONSTERS));
    for (const id of ids) {
      const def = MONSTERS[id], depth = Math.max(1, Math.min(15, def.dl[0]));
      if (g.depth !== depth) g.enter(depth, 'down');
      const L = g.level, P = g.player;
      clear(L);
      // 넓은 곳으로
      let best = null;
      for (const r of L.rooms) if (r.w >= 7 && r.h >= 7 && !r.special) { best = r; break; }
      if (best) { const p = L.nearestFree(best.cx, best.cy, 3); if (p) P.place(L, p.x, p.y); }
      g.dmap.build(L, P.tx, P.ty); g.lastTile = -1;
      const garg = def.F.ai === 'garg';
      const sp = spotAt(L, P, garg ? 2.5 : 5, garg ? 3.5 : 7) || spotAt(L, P, 2, 9);
      if (!sp) { out.push({ id, err: 'no spot' }); continue; }
      const m = AI.spawnMonster(g, L, id, sp.x, sp.y);
      m.aware = !garg;
      // 가고일이 먼 자리(대신 고른 자리)에 섰으면 플레이어를 2~3칸 앞 보이는 곳으로(한 칸씩 다가가다 벽에 막혀 깨우지 못하던 것)
      if (garg && Math.hypot(m.tx - P.tx, m.ty - P.ty) > 3.5) {
        const p = L.nearestFree(m.tx, m.ty + 2, 3, P.id, (x, y) => L.los(x, y, m.tx, m.ty) && Math.hypot(x - m.tx, y - m.ty) >= 2 && Math.hypot(x - m.tx, y - m.ty) <= 3.5);
        if (p) { P.place(L, p.x, p.y); g.dmap.build(L, p.x, p.y); g.lastTile = -1; }
      }
      const r = { id, ai: def.F.ai, depth, firstHit: null, hits: 0, dmg: 0, attacks: 0, missiles: 0, moved: 0, bad: 0, err: null, stuck: 0, teleports: 0, invis: false };
      let last = { x: m.x, y: m.y }, lastAnim = 'idle', seenMs = new Set(), stillT = 0;
      const dt = 1 / 30;
      // 20초. 공격은 했는데 주사위 운으로 한 번도 못 맞혔으면 20초 더(명중률 낮은 박쥐 등이 6번 다 빗나가 실패로 나오던 것)
      for (let i = 0; i < 1200; i++) {
        if (i >= 600 && (r.hits > 0 || !r.attacks)) break;
        P.hpMax = 1e5; P.hp = 1e5; P.mp = P.mpMax;
        // 돌로 서 있는 가고일: 플레이어가 한 칸씩 다가간다(4칸 안에서 깨어나야 한다)
        if (m.stone && i % 15 === 14 && Math.hypot(m.tx - P.tx, m.ty - P.ty) > 2) { const dx = Math.sign(m.tx - P.tx), dy = Math.sign(m.ty - P.ty); for (const [ax, ay] of [[dx, dy], [dx, 0], [0, dy]]) if ((ax || ay) && L.free(P.tx + ax, P.ty + ay)) { P.place(L, P.tx + ax, P.ty + ay); break; } }
        try { g.update(dt); } catch (e) { r.err = e.message + ' @' + (e.stack || '').split('\n')[1]; break; }
        const lost = 1e5 - P.hp;
        if (lost > 0) { r.hits++; r.dmg += lost; if (r.firstHit == null) r.firstHit = +(i * dt).toFixed(1); }
        if (m.dead) break;
        const an = m.anim?.name;
        if ((an === 'attack' || an === 'cast' || an === 'special') && an !== lastAnim) r.attacks++;
        lastAnim = an;
        for (const ms of L.missiles) if (ms.team === 1 && !seenMs.has(ms)) { seenMs.add(ms); r.missiles++; }
        const step = Math.hypot(m.x - last.x, m.y - last.y);
        if (step > 1.6) r.teleports++;
        r.moved += step < 1.6 ? step : 0;
        last = { x: m.x, y: m.y };
        if (!Number.isFinite(m.x) || !Number.isFinite(m.y) || !L.inb(m.tx, m.ty) || (!L.passable(m.tx, m.ty) && !m.mv)) r.bad++;
        if (m.invis != null && m.invis < 0.5) r.invis = true;
        // 끼임: 붙어 있지도 않은데 3초 넘게 제자리이고 공격도 안 함
        const d = Math.hypot(m.x - P.x, m.y - P.y);
        if (!m.mv && (an === 'idle' || an === 'walk') && d > 1.7 && !m.stone) { stillT += dt; if (stillT > 3) { r.stuck++; stillT = 0; } } else stillT = 0;
      }
      r.moved = +r.moved.toFixed(1); r.dmg = Math.round(r.dmg);
      out.push(r);
      clear(L);
    }
    return out;
  });
  const bad = [];
  for (const r of res) {
    const ok = !r.err && r.hits > 0 && r.bad === 0;
    if (!ok || r.stuck) bad.push(r);
    log(`${ok ? "OK  " : "FAIL"} ${r.id.padEnd(15)} ${String(r.ai).padEnd(13)} d${r.depth} 첫타 ${r.firstHit ?? '-'}s 맞힘 ${r.hits} 공격 ${r.attacks} 투사체 ${r.missiles} 이동 ${r.moved} 순간이동 ${r.teleports} 끼임 ${r.stuck}${r.invis ? ' 투명' : ''}${r.err ? ' ERR ' + r.err : ''}${r.bad ? ' 잘못된칸 ' + r.bad : ''}`);
  }
  log(`요약: ${res.length}종, 문제 ${bad.length}`);
}

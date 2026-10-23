// 상태 효과(냉기·빙결·중독·공포·함성·갑옷 등)와 생명력·마나 재생
// 화면 왼쪽 위에 보이는 효과(아이콘은 ui/pixui.js의 도트 그림 --bi-이름)
export const BUFF_INFO = {
  chill: { name: '냉기', bad: true },
  freeze: { name: '빙결', bad: true },
  stun: { name: '기절', bad: true },
  poison: { name: '중독', bad: true },
  burning: { name: '화상', bad: true },
  amp: { name: '저주', bad: true },
  shout: { name: '함성' },
  battleOrders: { name: '전투 명령' },
  battleCommand: { name: '전투 지휘' },
  frozenArmor: { name: '냉기 갑옷' },
  energyShield: { name: '에너지 보호막' },
  concentrate: { name: '집중' },
  berserk: { name: '광폭' },
  shrine: { name: '성소' },
  innerSight: { name: '내면의 눈', bad: true },
  battleCry: { name: '전투의 외침', bad: true },
  flee: { name: '공포', bad: true },
  invuln: { name: '무적' },
};

export function addBuff(a, name, o = {}) {
  if (!a || a.dead) return;
  const cur = a.buffs[name];
  if (name === 'freeze' && a.immuneFreeze) return;
  if (cur) {
    // 같은 효과는 더 긴 쪽, 더 센 쪽을 남긴다
    cur.t = Math.max(cur.t, o.t ?? 1);
    if (o.dps) cur.dps = Math.max(cur.dps || 0, o.dps);
    if (o.mods) cur.mods = o.mods;
    for (const k in o) if (k !== 't' && k !== 'dps' && k !== 'mods') cur[k] = o[k];
  } else a.buffs[name] = { t: o.t ?? 1, max: o.t ?? 1, ...o };
  if (a.hero && (o.mods || name === 'battleOrders')) {
    const hp0 = a.hpMax, mp0 = a.mpMax;
    a.hero.recalc();
    if (name === 'battleOrders' && !cur) { a.hp += a.hpMax - hp0; a.mp += a.mpMax - mp0; }
  }
  if (name === 'freeze' || name === 'stun') { a.act = null; }
}
export function removeBuff(a, name) {
  const b = a.buffs[name];
  if (!b) return;
  delete a.buffs[name];
  if (a.hero && b.mods) a.hero.recalc();
}

export function updateBuffs(game, a, dt) {
  const B = a.buffs;
  for (const k in B) {
    const b = B[k];
    b.t -= dt;
    if (b.dps) {
      b.acc = (b.acc || 0) + b.dps * dt;
      if (b.acc >= 1 && !a.dead) {
        const d = Math.floor(b.acc);
        b.acc -= d;
        const type = k === 'poison' ? 'poison' : 'fire';
        // 지속 피해는 경직을 일으키지 않는다
        game.damage(a, d, type, b.src, { noStun: true, quiet: true, quietNum: true, pure: k === 'poison' && b.pure });
        if (k === 'poison' && Math.random() < 0.3) game.fx.p(a.x, a.y, 30, { vz: 15, life: 0.6, size: 2, col: [90, 200, 50], glow: true });
      }
    }
    if (b.t <= 0) {
      delete B[k];
      if (a.hero && (b.mods || k === 'battleOrders')) a.hero.recalc();
      if (k === 'energyShield' && a.isPlayer) game.toast('에너지 보호막이 사라졌습니다');
    }
  }
}

// 재생: 생명력은 장비로만(디아블로 1), 마나는 천천히(디아블로 2)
export function tickRegen(game, P, dt) {
  if (P.dead) return;
  const st = P.hero.st;
  if (P.mp < P.mpMax) {
    const rate = (P.mpMax / 60) * (1 + (st.manaRegen || 0) / 100) * (game.level?.theme === 'town' ? 3 : 1);
    P.mp = Math.min(P.mpMax, P.mp + rate * dt);
  }
  if (st.regen) {
    P.hp = Math.min(P.hpMax, P.hp + st.regen * dt);
    if (P.hp <= 0) P.hp = 1;
  }
  // 마을에서는 생명력이 천천히 찬다
  if (game.level?.theme === 'town' && P.hp < P.hpMax) P.hp = Math.min(P.hpMax, P.hp + P.hpMax / 30 * dt);
}

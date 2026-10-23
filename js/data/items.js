// 기본 아이템: 디아블로 1의 무기·방어구 수치(피해·방어도·내구도·요구치·가격·품질 레벨) + 디아블로 2의 장갑·허리띠·장화
// w·h = 인벤토리 칸 수, q = 품질 레벨(qlvl), hands = 두 손, wt = 그림용 무기 종류, aff = 붙을 수 있는 접사 분류
// 접사 분류: A 갑옷·투구·장갑·장화·허리띠, S 방패, W 칼·도끼·둔기, T 지팡이, B 활, J 장신구
const SW = { c1: '#c8ccd4', c2: '#5a3a1e', c3: '#b8943c' };
const BOW = { c2: '#7a5530', c3: '#3a2a1a' };
const ST = { c1: '#7ad0ff', c2: '#6b4a2a', c3: '#a08040' };

function W(id, name, cat, dmg, dur, req, price, q, w, h, icon, extra = {}) {
  return { id, name, slot: 'weapon', cat, dmg, dur, req, price, q, w, h, icon, aff: cat === 'staff' ? 'T' : cat === 'bow' ? 'B' : 'W', ...extra };
}
function A(id, name, slot, ac, dur, req, price, q, w, h, icon, extra = {}) {
  return { id, name, slot, cat: slot, ac, dur, req, price, q, w, h, icon, aff: slot === 'shield' ? 'S' : 'A', ...extra };
}

export const BASES = [
  // ── 칼(한 손) ──
  W('dagger', '단검', 'sword', [1, 4], 16, {}, 60, 1, 1, 2, { t: 'sword', ...SW, blade: 0.6, wide: 0.22, guardW: 1.2 }, { wt: 'dagger', wlen: 15, speed: 0 }),
  W('short_sword', '쇼트 소드', 'sword', [2, 6], 24, { str: 18 }, 120, 1, 1, 3, { t: 'sword', ...SW }, { wt: 'sword', wlen: 25 }),
  W('sabre', '세이버', 'sword', [1, 8], 45, { str: 17 }, 170, 1, 1, 3, { t: 'sword', ...SW, curve: 0.25, wide: 0.16 }, { wt: 'sword', wlen: 27 }),
  W('falchion', '팔치온', 'sword', [4, 8], 20, { str: 30 }, 250, 2, 1, 3, { t: 'sword', ...SW, curve: 0.15, wide: 0.24 }, { wt: 'sword', wlen: 26, wwide: 1.3 }),
  W('scimitar', '시미터', 'sword', [3, 7], 28, { str: 23, dex: 23 }, 200, 4, 1, 3, { t: 'sword', ...SW, curve: 0.35, wide: 0.17 }, { wt: 'sword', wlen: 27 }),
  W('blade', '블레이드', 'sword', [3, 8], 30, { str: 25, dex: 30 }, 280, 4, 1, 3, { t: 'sword', ...SW, wide: 0.15 }, { wt: 'sword', wlen: 28 }),
  W('claymore', '클레이모어', 'sword', [1, 12], 36, { str: 35 }, 450, 5, 1, 3, { t: 'sword', ...SW, wide: 0.2 }, { wt: 'sword', wlen: 31 }),
  W('long_sword', '롱 소드', 'sword', [2, 10], 40, { str: 30, dex: 30 }, 350, 6, 1, 3, { t: 'sword', ...SW, blade: 0.72 }, { wt: 'sword', wlen: 31 }),
  W('broad_sword', '브로드 소드', 'sword', [4, 12], 50, { str: 40 }, 750, 8, 2, 3, { t: 'sword', ...SW, wide: 0.24 }, { wt: 'sword', wlen: 30, wwide: 1.4 }),
  W('bastard_sword', '바스타드 소드', 'sword', [6, 15], 60, { str: 50 }, 1000, 10, 2, 3, { t: 'sword', ...SW, wide: 0.2, blade: 0.72 }, { wt: 'sword', wlen: 33, wwide: 1.2 }),
  W('two_handed_sword', '투핸디드 소드', 'sword', [8, 16], 75, { str: 65 }, 1800, 14, 1, 4, { t: 'sword', ...SW, blade: 0.74 }, { wt: 'sword', wlen: 40, hands: 2 }),
  W('great_sword', '그레이트 소드', 'sword', [10, 20], 100, { str: 75 }, 3000, 17, 2, 4, { t: 'sword', ...SW, wide: 0.24, blade: 0.74 }, { wt: 'sword', wlen: 43, hands: 2, wwide: 1.4 }),
  // ── 도끼(모두 두 손) ──
  W('small_axe', '스몰 액스', 'axe', [2, 10], 24, {}, 150, 2, 2, 3, { t: 'axe', c1: '#b8bcc4', c2: '#6a4a2a', head: 0.8 }, { wt: 'axe', wlen: 22, hands: 2 }),
  W('axe', '액스', 'axe', [4, 12], 32, { str: 22 }, 450, 4, 2, 3, { t: 'axe', c1: '#b8bcc4', c2: '#6a4a2a' }, { wt: 'axe', wlen: 25, hands: 2 }),
  W('large_axe', '라지 액스', 'axe', [6, 16], 40, { str: 30 }, 750, 6, 2, 3, { t: 'axe', c1: '#b8bcc4', c2: '#5a3a1e', head: 1.15 }, { wt: 'axe', wlen: 28, hands: 2, wwide: 1.2 }),
  W('broad_axe', '브로드 액스', 'axe', [8, 20], 50, { str: 50 }, 1000, 8, 2, 3, { t: 'axe', c1: '#b8bcc4', c2: '#5a3a1e', head: 1.3 }, { wt: 'axe', wlen: 29, hands: 2, wwide: 1.4 }),
  W('battle_axe', '배틀 액스', 'axe', [10, 25], 60, { str: 65 }, 1500, 10, 2, 3, { t: 'axe', c1: '#c0c4cc', c2: '#4a2e18', double: true }, { wt: 'axe', wlen: 30, hands: 2, wwide: 1.4 }),
  W('great_axe', '그레이트 액스', 'axe', [12, 30], 75, { str: 80 }, 2500, 12, 2, 4, { t: 'axe', c1: '#c0c4cc', c2: '#4a2e18', double: true, head: 1.3 }, { wt: 'axe', wlen: 36, hands: 2, wwide: 1.6 }),
  // ── 둔기 ──
  W('club', '곤봉', 'mace', [1, 6], 20, {}, 20, 1, 1, 3, { t: 'mace', v: 'club', c2: '#6a4a2a' }, { wt: 'club', wlen: 24, wood: '#6a4a2a' }),
  W('mace', '메이스', 'mace', [1, 8], 32, { str: 16 }, 200, 2, 2, 3, { t: 'mace', c1: '#9a9ea8', c2: '#5a3a1e' }, { wt: 'mace', wlen: 24 }),
  W('morning_star', '모닝 스타', 'mace', [1, 10], 40, { str: 26 }, 300, 3, 2, 3, { t: 'mace', v: 'star', c1: '#9a9ea8', c2: '#5a3a1e' }, { wt: 'mace', wlen: 25 }),
  W('spiked_club', '가시 곤봉', 'mace', [3, 6], 20, { str: 18 }, 225, 4, 2, 3, { t: 'mace', v: 'spiked', c1: '#8a6a40', c2: '#6a4a2a' }, { wt: 'club', wlen: 25 }),
  W('war_hammer', '워 해머', 'mace', [5, 9], 50, { str: 40 }, 600, 5, 2, 3, { t: 'mace', v: 'hammer', c1: '#9a9ea8', c2: '#5a3a1e' }, { wt: 'hammer', wlen: 26 }),
  W('flail', '플레일', 'mace', [2, 12], 36, { str: 30 }, 500, 7, 2, 3, { t: 'mace', v: 'flail', c1: '#9a9ea8', c2: '#5a3a1e' }, { wt: 'flail', wlen: 25 }),
  W('maul', '몰', 'mace', [6, 20], 50, { str: 55 }, 900, 10, 2, 4, { t: 'mace', v: 'hammer', c1: '#9a9ea8', c2: '#4a2e18', head: 1.4 }, { wt: 'hammer', wlen: 34, hands: 2 }),
  // ── 활(두 손) ──
  W('short_bow', '쇼트 보우', 'bow', [1, 4], 30, {}, 100, 1, 2, 3, { t: 'bow', ...BOW }, { wt: 'bow', hands: 2 }),
  W('hunters_bow', '헌터스 보우', 'bow', [2, 5], 40, { str: 20, dex: 35 }, 350, 3, 2, 3, { t: 'bow', ...BOW, c2: '#6a4a28' }, { wt: 'bow', hands: 2 }),
  W('long_bow', '롱 보우', 'bow', [1, 6], 35, { str: 25, dex: 30 }, 250, 5, 2, 4, { t: 'bow', ...BOW }, { wt: 'bow', hands: 2 }),
  W('composite_bow', '컴포짓 보우', 'bow', [3, 6], 45, { str: 25, dex: 40 }, 600, 7, 2, 3, { t: 'bow', ...BOW, c2: '#5a3a20', c3: '#a08040' }, { wt: 'bow', hands: 2 }),
  W('short_battle_bow', '쇼트 배틀 보우', 'bow', [3, 7], 45, { str: 30, dex: 50 }, 750, 9, 2, 3, { t: 'bow', ...BOW, c2: '#4a3020' }, { wt: 'bow', hands: 2 }),
  W('long_battle_bow', '롱 배틀 보우', 'bow', [1, 10], 50, { str: 30, dex: 60 }, 1000, 11, 2, 4, { t: 'bow', ...BOW, c2: '#4a3020', c3: '#a08040' }, { wt: 'bow', hands: 2 }),
  W('short_war_bow', '쇼트 워 보우', 'bow', [4, 8], 55, { str: 35, dex: 70 }, 1500, 15, 2, 3, { t: 'bow', ...BOW, c2: '#3a2418', c3: '#c0a050' }, { wt: 'bow', hands: 2 }),
  W('long_war_bow', '롱 워 보우', 'bow', [1, 14], 60, { str: 45, dex: 80 }, 2000, 19, 2, 4, { t: 'bow', ...BOW, c2: '#3a2418', c3: '#c0a050' }, { wt: 'bow', hands: 2 }),
  // ── 지팡이(두 손) ──
  W('short_staff', '쇼트 스태프', 'staff', [2, 4], 25, {}, 30, 1, 1, 4, { t: 'staff', ...ST }, { wt: 'staff', wlen: 50, hands: 2, gem: '#7ad0ff' }),
  W('long_staff', '롱 스태프', 'staff', [4, 8], 35, {}, 100, 4, 1, 4, { t: 'staff', ...ST, c1: '#a0ffa0' }, { wt: 'staff', wlen: 56, hands: 2, gem: '#a0ffa0' }),
  W('composite_staff', '컴포짓 스태프', 'staff', [5, 10], 45, {}, 500, 6, 1, 4, { t: 'staff', ...ST, v: 'orb', c1: '#ff9a7a' }, { wt: 'staff', wlen: 56, hands: 2, gem: '#ff9a7a' }),
  W('quarter_staff', '쿼터 스태프', 'staff', [6, 12], 55, { str: 20 }, 1000, 9, 1, 4, { t: 'staff', ...ST, c1: '#e0a0ff' }, { wt: 'staff', wlen: 58, hands: 2, gem: '#e0a0ff' }),
  W('war_staff', '워 스태프', 'staff', [8, 16], 75, { str: 30 }, 1500, 12, 1, 4, { t: 'staff', ...ST, v: 'orb', c1: '#ffe080' }, { wt: 'staff', wlen: 60, hands: 2, gem: '#ffe080' }),

  // ── 갑옷 ── (wt: 경·중·중갑)
  A('rags', '누더기', 'body', [2, 6], 6, {}, 5, 1, 2, 3, { t: 'armor', v: 'robe', c1: '#6a5a44' }, { weight: 'L', torso: '#6a5a44' }),
  A('cape', '케이프', 'body', [1, 5], 12, {}, 10, 1, 2, 3, { t: 'armor', v: 'robe', c1: '#5a2a24' }, { weight: 'L', cape: '#5a2a24' }),
  A('cloak', '클로크', 'body', [3, 7], 18, {}, 40, 2, 2, 3, { t: 'armor', v: 'robe', c1: '#3a3a4a' }, { weight: 'L', cape: '#2a2a3a' }),
  A('robe', '로브', 'body', [4, 7], 24, {}, 75, 3, 2, 3, { t: 'armor', v: 'robe', c1: '#3a3a6a' }, { weight: 'L', robe: '#2a2a5a' }),
  A('quilted_armor', '퀼티드 아머', 'body', [7, 10], 30, {}, 200, 4, 2, 3, { t: 'armor', v: 'leather', c1: '#8a7a5a' }, { weight: 'L', torso: '#7a6a4a' }),
  A('leather_armor', '레더 아머', 'body', [10, 13], 35, {}, 300, 6, 2, 3, { t: 'armor', v: 'leather', c1: '#6a4a2a' }, { weight: 'L', torso: '#6a4a2a' }),
  A('hard_leather_armor', '하드 레더 아머', 'body', [11, 14], 40, {}, 450, 7, 2, 3, { t: 'armor', v: 'leather', c1: '#5a3a1e' }, { weight: 'L', torso: '#5a3a1e' }),
  A('studded_leather_armor', '스터디드 레더 아머', 'body', [15, 17], 45, { str: 20 }, 700, 9, 2, 3, { t: 'armor', v: 'studded', c1: '#5a3a1e' }, { weight: 'L', torso: '#5a3a1e', pads: '#6a6a6a' }),
  A('ring_mail', '링 메일', 'body', [17, 20], 50, { str: 25 }, 900, 11, 2, 3, { t: 'armor', v: 'ring', c1: '#8a8a90' }, { weight: 'M', torso: '#7a7a80' }),
  A('chain_mail', '체인 메일', 'body', [18, 22], 55, { str: 30 }, 1250, 13, 2, 3, { t: 'armor', v: 'chain', c1: '#9a9aa0' }, { weight: 'M', torso: '#8a8a92', pads: '#8a8a92' }),
  A('scale_mail', '스케일 메일', 'body', [23, 28], 60, { str: 35 }, 2300, 15, 2, 3, { t: 'armor', v: 'scale', c1: '#7a8a8a' }, { weight: 'M', torso: '#6a7a7a', pads: '#6a7a7a' }),
  A('breast_plate', '브레스트 플레이트', 'body', [20, 24], 80, { str: 40 }, 2800, 16, 2, 3, { t: 'armor', v: 'plate', c1: '#a8a8b0' }, { weight: 'H', torso: '#9a9aa4' }),
  A('splint_mail', '스플린트 메일', 'body', [30, 35], 65, { str: 40 }, 3250, 17, 2, 3, { t: 'armor', v: 'scale', c1: '#8a8a7a' }, { weight: 'M', torso: '#7a7a6a', pads: '#7a7a6a' }),
  A('plate_mail', '플레이트 메일', 'body', [42, 50], 75, { str: 60 }, 4600, 19, 2, 3, { t: 'armor', v: 'plate', c1: '#b0b0b8' }, { weight: 'H', torso: '#a0a0aa', pads: '#b0b0ba' }),
  A('field_plate', '필드 플레이트', 'body', [40, 45], 80, { str: 65 }, 5800, 21, 2, 3, { t: 'armor', v: 'field', c1: '#a0a8b0' }, { weight: 'H', torso: '#9098a4', pads: '#a0a8b4' }),
  A('gothic_plate', '고딕 플레이트', 'body', [50, 60], 100, { str: 80 }, 8000, 23, 2, 3, { t: 'armor', v: 'gothic', c1: '#8a8a9a' }, { weight: 'H', torso: '#7a7a8a', pads: '#8a8a9c' }),
  A('full_plate_mail', '풀 플레이트 메일', 'body', [60, 75], 90, { str: 90 }, 6500, 25, 2, 3, { t: 'armor', v: 'full', c1: '#c0c0c8' }, { weight: 'H', torso: '#b0b0ba', pads: '#c0c0ca' }),
  // ── 투구 ──
  A('cap', '캡', 'head', [1, 3], 15, {}, 15, 1, 2, 2, { t: 'helm', v: 'cap', c1: '#6a4a2a' }, { helm: { type: 'cap', color: '#6a4a2a' } }),
  A('skull_cap', '스컬 캡', 'head', [2, 4], 20, {}, 25, 4, 2, 2, { t: 'helm', v: 'skull', c1: '#8a8a90' }, { helm: { type: 'skullcap', color: '#7a7a80' } }),
  A('helm', '헬름', 'head', [4, 6], 30, { str: 25 }, 40, 8, 2, 2, { t: 'helm', v: 'helm', c1: '#9a9aa2' }, { helm: { type: 'helm', color: '#8a8a92' } }),
  A('full_helm', '풀 헬름', 'head', [6, 8], 35, { str: 35 }, 90, 12, 2, 2, { t: 'helm', v: 'full', c1: '#a0a0a8' }, { helm: { type: 'full', color: '#9a9aa2' } }),
  A('crown', '크라운', 'head', [8, 12], 40, {}, 200, 16, 2, 2, { t: 'helm', v: 'crown', c3: '#d8b040' }, { helm: { type: 'crown', color: '#d8b040' } }),
  A('great_helm', '그레이트 헬름', 'head', [10, 15], 60, { str: 50 }, 400, 20, 2, 2, { t: 'helm', v: 'great', c1: '#b0b0b8' }, { helm: { type: 'great', color: '#a8a8b2' } }),
  // ── 방패 ──
  A('buckler', '버클러', 'shield', [1, 5], 16, {}, 30, 1, 2, 2, { t: 'shield', v: 'round', c1: '#6a4a2a', c3: '#a89060' }, { shield: { type: 'round', color: '#6a4a2a', rim: '#a89060', size: 7 } }),
  A('small_shield', '스몰 실드', 'shield', [3, 8], 24, { str: 25 }, 90, 5, 2, 2, { t: 'shield', v: 'round', c1: '#7a5a3a', c3: '#b0b0b8' }, { shield: { type: 'round', color: '#7a5a3a', rim: '#b0b0b8', size: 8.5 } }),
  A('large_shield', '라지 실드', 'shield', [5, 10], 32, { str: 40 }, 200, 9, 2, 3, { t: 'shield', v: 'heater', c1: '#5a6a8a', c3: '#c0c0c8' }, { shield: { type: 'kite', color: '#4a5a7a', rim: '#c0c0c8', size: 9 } }),
  A('kite_shield', '카이트 실드', 'shield', [8, 15], 40, { str: 50 }, 400, 14, 2, 3, { t: 'shield', v: 'kite', c1: '#8a2a24', c3: '#d0b050' }, { shield: { type: 'kite', color: '#7a2420', rim: '#d0b050', size: 10 } }),
  A('tower_shield', '타워 실드', 'shield', [12, 20], 50, { str: 60 }, 850, 20, 2, 3, { t: 'shield', v: 'tower', c1: '#5a5a62', c3: '#b0a070' }, { shield: { type: 'tower', color: '#5a5a62', rim: '#b0a070', size: 10 } }),
  A('gothic_shield', '고딕 실드', 'shield', [14, 18], 60, { str: 80 }, 2300, 23, 2, 3, { t: 'shield', v: 'tower', c1: '#3a3a4a', c3: '#c8a850' }, { shield: { type: 'tower', color: '#33333f', rim: '#c8a850', size: 10.5 } }),
  // ── 장갑·장화·허리띠(디아블로 2) ──
  A('leather_gloves', '레더 글러브', 'gloves', [2, 3], 12, {}, 30, 3, 2, 2, { t: 'gloves', c1: '#6a4a2a' }, { hands: '#5a3a1e' }),
  A('heavy_gloves', '헤비 글러브', 'gloves', [5, 6], 14, {}, 80, 7, 2, 2, { t: 'gloves', c1: '#5a3a1e' }, { hands: '#4a2e18' }),
  A('chain_gloves', '체인 글러브', 'gloves', [8, 9], 16, { str: 25 }, 200, 12, 2, 2, { t: 'gloves', c1: '#8a8a92' }, { hands: '#8a8a92' }),
  A('light_gauntlets', '라이트 건틀릿', 'gloves', [9, 11], 18, { str: 45 }, 450, 20, 2, 2, { t: 'gloves', c1: '#a0a0aa' }, { hands: '#a0a0aa' }),
  A('gauntlets', '건틀릿', 'gloves', [12, 15], 24, { str: 60 }, 900, 27, 2, 2, { t: 'gloves', c1: '#b8b8c2' }, { hands: '#b8b8c2' }),
  A('boots', '부츠', 'boots', [2, 3], 12, {}, 30, 3, 2, 2, { t: 'boots', c1: '#6a4a2a' }, { boots: '#5a3a1e' }),
  A('heavy_boots', '헤비 부츠', 'boots', [5, 6], 14, { str: 18 }, 80, 7, 2, 2, { t: 'boots', c1: '#4a2e18' }, { boots: '#3a2414' }),
  A('chain_boots', '체인 부츠', 'boots', [8, 9], 16, { str: 30 }, 200, 12, 2, 2, { t: 'boots', c1: '#8a8a92' }, { boots: '#7a7a82' }),
  A('light_plated_boots', '라이트 플레이트 부츠', 'boots', [9, 11], 18, { str: 50 }, 450, 20, 2, 2, { t: 'boots', c1: '#a0a0aa' }, { boots: '#9a9aa4' }),
  A('greaves', '그리브', 'boots', [12, 15], 24, { str: 70 }, 900, 27, 2, 2, { t: 'boots', c1: '#b8b8c2' }, { boots: '#b0b0ba' }),
  A('sash', '새시', 'belt', [2, 2], 12, {}, 30, 3, 2, 1, { t: 'belt', c1: '#7a5a3a', c3: '#a08040' }, { rows: 2 }),
  A('light_belt', '라이트 벨트', 'belt', [3, 3], 14, {}, 60, 7, 2, 1, { t: 'belt', c1: '#5a3a1e', c3: '#a08040' }, { rows: 2 }),
  A('belt', '벨트', 'belt', [5, 5], 16, { str: 25 }, 200, 12, 2, 1, { t: 'belt', c1: '#4a2e18', c3: '#b0b0b8' }, { rows: 3 }),
  A('heavy_belt', '헤비 벨트', 'belt', [6, 6], 18, { str: 45 }, 450, 20, 2, 1, { t: 'belt', c1: '#3a2414', c3: '#b0b0b8' }, { rows: 3 }),
  A('plated_belt', '플레이트 벨트', 'belt', [8, 11], 24, { str: 60 }, 900, 27, 2, 1, { t: 'belt', c1: '#8a8a92', c3: '#d0b050' }, { rows: 4 }),
  // ── 장신구(늘 마법 이상) ──
  { id: 'ring', name: '반지', slot: 'ring', cat: 'ring', price: 1000, q: 5, w: 1, h: 1, icon: { t: 'ring', c1: '#e04040', c3: '#d8b040' }, aff: 'J', jewel: true },
  { id: 'ring2', name: '반지', slot: 'ring', cat: 'ring', price: 1000, q: 10, w: 1, h: 1, icon: { t: 'ring', c1: '#4080e0', c3: '#c0c0c8' }, aff: 'J', jewel: true },
  { id: 'ring3', name: '반지', slot: 'ring', cat: 'ring', price: 1000, q: 15, w: 1, h: 1, icon: { t: 'ring', c1: '#40c060', c3: '#d8b040' }, aff: 'J', jewel: true },
  { id: 'amulet', name: '목걸이', slot: 'amulet', cat: 'amulet', price: 1200, q: 8, w: 1, h: 1, icon: { t: 'amulet', c1: '#e0a040', c3: '#d8b040' }, aff: 'J', jewel: true },
  { id: 'amulet2', name: '목걸이', slot: 'amulet', cat: 'amulet', price: 1200, q: 16, w: 1, h: 1, icon: { t: 'amulet', c1: '#a040e0', c3: '#c0c0c8' }, aff: 'J', jewel: true },
  // ── 소모품 ──
  { id: 'hp_minor', name: '치유 물약', cat: 'potion', use: 'heal', price: 50, q: 1, w: 1, h: 1, icon: { t: 'potion', c1: '#d02020' }, belt: true },
  { id: 'hp_full', name: '완전 치유 물약', cat: 'potion', use: 'healFull', price: 150, q: 1, w: 1, h: 1, icon: { t: 'potion', c1: '#ff3030', big: true }, belt: true },
  { id: 'mp_minor', name: '마나 물약', cat: 'potion', use: 'mana', price: 50, q: 1, w: 1, h: 1, icon: { t: 'potion', c1: '#2050e0' }, belt: true },
  { id: 'mp_full', name: '완전 마나 물약', cat: 'potion', use: 'manaFull', price: 150, q: 1, w: 1, h: 1, icon: { t: 'potion', c1: '#3070ff', big: true }, belt: true },
  { id: 'rejuv', name: '회복 물약', cat: 'potion', use: 'rejuv', price: 120, q: 3, w: 1, h: 1, icon: { t: 'potion', c1: '#a040c0' }, belt: true },
  { id: 'rejuv_full', name: '완전 회복 물약', cat: 'potion', use: 'rejuvFull', price: 600, q: 7, w: 1, h: 1, icon: { t: 'potion', c1: '#c050f0', big: true }, belt: true },
  { id: 'tp_scroll', name: '귀환 주문서', cat: 'scroll', use: 'portal', price: 200, q: 1, w: 1, h: 1, icon: { t: 'scroll', c1: '#3060c0' }, belt: true },
  { id: 'id_scroll', name: '감정 주문서', cat: 'scroll', use: 'identify', price: 100, q: 1, w: 1, h: 1, icon: { t: 'scroll', c1: '#c03030' }, belt: true },
  { id: 'elx_str', name: '힘의 영약', cat: 'elixir', use: 'elixir', stat: 'str', price: 5000, q: 15, w: 1, h: 1, icon: { t: 'potion', c1: '#e09020', big: true } },
  { id: 'elx_mag', name: '마력의 영약', cat: 'elixir', use: 'elixir', stat: 'mag', price: 5000, q: 15, w: 1, h: 1, icon: { t: 'potion', c1: '#30c0e0', big: true } },
  { id: 'elx_dex', name: '민첩의 영약', cat: 'elixir', use: 'elixir', stat: 'dex', price: 5000, q: 15, w: 1, h: 1, icon: { t: 'potion', c1: '#e0e040', big: true } },
  { id: 'elx_vit', name: '활력의 영약', cat: 'elixir', use: 'elixir', stat: 'vit', price: 5000, q: 20, w: 1, h: 1, icon: { t: 'potion', c1: '#60e060', big: true }, noShop: true },
  { id: 'elx_spectral', name: '망령의 영약', cat: 'elixir', use: 'elixirAll', price: 0, q: 99, w: 1, h: 1, icon: { t: 'potion', c1: '#e0e8ff', big: true }, noShop: true },
  // ── 퀘스트 물건 ──
  { id: 'q_rock', name: '마력의 돌', cat: 'quest', price: 0, q: 0, w: 1, h: 1, icon: { t: 'gem', c1: '#c0e0ff' }, quest: true },
  { id: 'q_anvil', name: '분노의 모루', cat: 'quest', price: 0, q: 0, w: 2, h: 2, icon: { t: 'mace', v: 'hammer', c1: '#5a5a62', c2: '#3a3a40', head: 2 }, quest: true },
  { id: 'q_mushroom', name: '검은 버섯', cat: 'quest', price: 0, q: 0, w: 1, h: 1, icon: { t: 'heart', c1: '#3a2a4a' }, quest: true },
  { id: 'q_brain', name: '악마의 뇌', cat: 'quest', price: 0, q: 0, w: 1, h: 1, icon: { t: 'heart', c1: '#c08080' }, quest: true },
  { id: 'q_elixir', name: '조제한 영약', cat: 'quest', price: 0, q: 0, w: 1, h: 1, icon: { t: 'potion', c1: '#40d0a0', big: true }, quest: true },
  { id: 'q_journal', name: '세라핀의 일지', cat: 'quest', price: 0, q: 0, w: 1, h: 2, icon: { t: 'book', c1: '#5a2a2a', c3: '#d0b050' }, quest: true },
  { id: 'q_key', name: '피의 열쇠', cat: 'quest', price: 0, q: 0, w: 1, h: 2, icon: { t: 'key', c1: '#c03020' }, quest: true },
  { id: 'q_staff', name: '대사제의 지팡이', cat: 'quest', price: 0, q: 0, w: 1, h: 4, icon: { t: 'staff', c1: '#ff3020', c2: '#2a1a1a', c3: '#c0a040' }, quest: true },
];

export const BASE = Object.fromEntries(BASES.map((b) => [b.id, b]));

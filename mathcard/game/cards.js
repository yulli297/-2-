// =============================================================
//  카드와 게임 설정 — 숫자를 바꾸고 싶으면 이 파일만 고치면 됩니다.
// =============================================================

const CONFIG = {
  HP: 15,               // 시작 HP (= 최대 HP)
  MP: 5,                // 시작 MP (= 최대 MP)
  TURN_SECONDS: 15,     // 한 턴 선택 제한 시간(초). 넘기면 자동 패스
  REVEAL_SECONDS: 3,    // 카드 공개 후 다음 턴까지 보여 주는 시간(초)
  DECK_SIZE: 18,        // 덱 총량
  KEEP_COUNT: 5,        // 다음 게임으로 계승하는 카드 수
  DROUGHT_WRONG: 5,     // 연속 오답이 몇 번이면 가뭄 덱을 줄지
};

// type: attack(공격) / defense(방어) / skill(스킬)
// cost: 필요한 MP
// dmg: 피해   pierce: 방어 무시   doubleVsShield: 상대가 방어력을 얻으면 피해 2배
// shield: 방어력   blockBonus: 완전히 막으면 다음 턴 공격 +1   mpOnBlock: 완전히 막으면 MP 회복
// gainMp: MP 회복   heal: HP 회복   buffNext: 다음 턴 공격 +N
// joker: 남은 카드 모두 사용   reflect: 이번 턴 상대 공격 반사   unique: 덱에 1장만
const CARDS = {
  // ---------- 기본 카드 ----------
  base_attack:  { name: '기본 공격',   type: 'attack',  cost: 1, dmg: 2 },
  base_defense: { name: '기본 방어',   type: 'defense', cost: 1, shield: 2, blockBonus: 1 },
  base_mana:    { name: '마나 충전',   type: 'skill',   cost: 0, gainMp: 5 },

  // ---------- 문제를 풀고 얻는 카드 ----------
  strike:       { name: '내려치기',   type: 'attack',  cost: 2, dmg: 3 },
  weakpoint:    { name: '방어구 부수기', type: 'attack',  cost: 2, dmg: 2, doubleVsShield: true },
  heavy:        { name: '강타', type: 'attack',  cost: 3, dmg: 4 },
  pierce:       { name: '암살',     type: 'attack',  cost: 3, dmg: 3, pierce: true },
  ultimate:     { name: '무차별공격',      type: 'attack',  cost: 4, dmg: 5 },
  guard:        { name: '단단한 방패', type: 'defense', cost: 2, shield: 3, blockBonus: 1 },
  fortress:     { name: '철벽',        type: 'defense', cost: 3, shield: 4, blockBonus: 1 },
  managuard:    { name: '마나 방패',   type: 'defense', cost: 2, shield: 3, blockBonus: 1, mpOnBlock: 1 },
  meditate:     { name: '명상',        type: 'skill',   cost: 1, gainMp: 3, shield: 2 },
  focus:        { name: '집중',        type: 'skill',   cost: 1, buffNext: 2 },
  firstaid:     { name: '응급 처치',   type: 'skill',   cost: 1, heal: 2 },
  potion:       { name: '회복 물약',   type: 'skill',   cost: 3, heal: 4 },
  joker:        { name: '조커',        type: 'skill',   cost: 1, joker: true, unique: true },
  mirror:       { name: '반사 거울',   type: 'skill',   cost: 1, reflect: true },

  // ---------- 가뭄 덱 전용 (비싸거나 보너스가 없는 구조적 약점, 시뮬레이션 승률 약 20%) ----------
  rusty_sword:  { name: '녹슨 대검',   type: 'attack',  cost: 4, dmg: 4, drought: true },
  dull_spear:   { name: '무딘 창',     type: 'attack',  cost: 2, dmg: 2, drought: true },
  cracked:      { name: '금 간 방패',  type: 'defense', cost: 1, shield: 2, drought: true },
  weak_mana:    { name: '약한 충전',   type: 'skill',   cost: 0, gainMp: 3, drought: true },
};

const BASE_DECK = ['base_attack', 'base_attack', 'base_defense', 'base_defense', 'base_mana', 'base_mana'];
const CHOICE_POOL = ['strike', 'weakpoint', 'heavy', 'pierce', 'ultimate', 'guard', 'fortress', 'managuard',
  'meditate', 'focus', 'firstaid', 'potion', 'joker', 'mirror'];
const DROUGHT_POOL = ['rusty_sword', 'rusty_sword', 'dull_spear', 'cracked', 'weak_mana'];

// 카드 설명 문장을 자동으로 만든다
function describe(c) {
  const s = [];
  if (c.dmg) s.push(`피해 ${c.dmg}`);
  if (c.pierce) s.push('방어 무시');
  if (c.doubleVsShield) s.push('상대가 방어하면 피해 2배');
  if (c.gainMp) s.push(`MP +${c.gainMp}`);
  if (c.shield) s.push(`방어 ${c.shield}`);
  if (c.heal) s.push(`HP +${c.heal}`);
  if (c.buffNext) s.push(`다음 턴 공격 +${c.buffNext}`);
  if (c.blockBonus) s.push(`완전히 막으면 다음 턴 공격 +${c.blockBonus}`);
  if (c.mpOnBlock) s.push(`완전히 막으면 MP +${c.mpOnBlock}`);
  if (c.joker) s.push('남은 카드 2장을 MP 없이 모두 사용 (덱에 1장만)');
  if (c.reflect) s.push('이번 턴 상대의 공격을 모두 되돌려 줌');
  return s.join(' · ');
}
for (const [id, c] of Object.entries(CARDS)) { c.id = id; c.desc = describe(c); c.base = BASE_DECK.includes(id); }

module.exports = { CONFIG, CARDS, BASE_DECK, CHOICE_POOL, DROUGHT_POOL };

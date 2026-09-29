// =============================================================
//  대결 엔진: 카드 뽑기, 동시 공개, 효과 계산, 컴퓨터(봇) 선택
// =============================================================
const { CONFIG, CARDS } = require('./cards');

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function makeSide(info) {
  return {
    id: info.id, name: info.name, isBot: !!info.isBot,
    hp: CONFIG.HP, maxHp: CONFIG.HP, mp: CONFIG.MP, maxMp: CONFIG.MP,
    draw: shuffle(info.deck.slice()), grave: [], hand: [],
    buff: 0, nextBuff: 0, choice: undefined, // undefined=아직, null=패스, 숫자=손패 위치
  };
}

class Battle {
  constructor(a, b) {
    this.sides = [makeSide(a), makeSide(b)];
    this.turn = 0; this.over = false; this.winner = null; this.lastReveal = null;
  }
  side(id) { return this.sides.find(s => s.id === id); }
  other(id) { return this.sides.find(s => s.id !== id); }

  startTurn() {
    this.turn++;
    for (const s of this.sides) {
      if (s.draw.length < 3) { s.draw.push(...shuffle(s.grave)); s.grave = []; }
      s.hand = s.draw.splice(0, 3);
      s.choice = undefined;
      // 쓸 수 있는 카드가 없으면 자동 패스
      if (!s.hand.some(id => CARDS[id].cost <= s.mp)) s.choice = null;
    }
  }
  canPlay(s) { return s.hand.some(id => CARDS[id].cost <= s.mp); }

  choose(id, idx) {
    const s = this.side(id);
    if (!s || s.choice !== undefined || this.over) return false;
    if (idx === null) { s.choice = null; return true; }
    if (!(idx >= 0 && idx < s.hand.length)) return false;
    if (CARDS[s.hand[idx]].cost > s.mp) return false;
    s.choice = idx; return true;
  }
  bothChosen() { return this.sides.every(s => s.choice !== undefined); }
  timeoutAll() { for (const s of this.sides) if (s.choice === undefined) s.choice = null; }

  resolve() {
    const effs = this.sides.map(s => {
      const e = { fired: [], shield: 0, attacks: [], reflect: false, defCards: 0, blockBonus: 0, mpOnBlock: 0, pass: s.choice === null, healed: 0, mpGain: 0 };
      if (s.choice === null) return e;
      const main = s.hand[s.choice];
      s.mp -= CARDS[main].cost;
      let seq = [main];
      if (CARDS[main].joker) {
        const rest = s.hand.filter((_, i) => i !== s.choice);
        const order = { skill: 0, defense: 1, attack: 2 };
        seq = seq.concat(rest.slice().sort((x, y) => order[CARDS[x].type] - order[CARDS[y].type]));
      }
      e.fired = seq;
      return e;
    });
    // 1순위: 스킬 (자기에게만 적용)
    this.sides.forEach((s, i) => { for (const id of effs[i].fired) { const c = CARDS[id]; if (c.type !== 'skill') continue;
      if (c.gainMp) { const before = s.mp; s.mp = Math.min(s.maxMp, s.mp + c.gainMp); effs[i].mpGain += s.mp - before; }
      if (c.heal) { const before = s.hp; s.hp = Math.min(s.maxHp, s.hp + c.heal); effs[i].healed += s.hp - before; }
      if (c.buffNext) s.nextBuff += c.buffNext;
      if (c.reflect) effs[i].reflect = true;
      if (c.shield) effs[i].shield += c.shield;
    } });
    // 2순위: 방어
    this.sides.forEach((s, i) => { for (const id of effs[i].fired) { const c = CARDS[id]; if (c.type !== 'defense') continue;
      effs[i].shield += c.shield; effs[i].defCards++; effs[i].blockBonus += c.blockBonus || 0; effs[i].mpOnBlock += c.mpOnBlock || 0;
    } });
    // 3순위: 공격 (양쪽 동시에 계산 후 한꺼번에 적용)
    const dmgTo = [0, 0]; const notes = [[], []];
    for (let i = 0; i < 2; i++) {
      const a = this.sides[i], ea = effs[i], ed = effs[1 - i], d = this.sides[1 - i];
      const atks = ea.fired.filter(id => CARDS[id].type === 'attack');
      if (!atks.length) continue;
      let normal = 0, pierce = 0;
      for (const id of atks) {
        const c = CARDS[id]; let dmg = c.dmg + a.buff;
        if (c.doubleVsShield && ed.shield > 0) dmg *= 2;
        if (c.pierce) pierce += dmg; else normal += dmg;
      }
      if (ed.reflect) {
        const back = Math.max(0, normal - ea.shield) + pierce;
        dmgTo[i] += back;
        notes[1 - i].push(`반사! 상대에게 ${back} 피해를 되돌려 줌`);
        notes[i].push(`상대가 공격을 반사해 ${back} 피해를 받음`);
        continue;
      }
      const dmg = Math.max(0, normal - ed.shield) + pierce;
      dmgTo[1 - i] += dmg;
      if (dmg === 0 && ed.defCards > 0) {
        if (ed.blockBonus) { d.nextBuff += ed.blockBonus; notes[1 - i].push(`완벽 방어! 다음 턴 공격 +${ed.blockBonus}`); }
        if (ed.mpOnBlock) { d.mp = Math.min(d.maxMp, d.mp + ed.mpOnBlock); notes[1 - i].push(`MP +${ed.mpOnBlock}`); }
      }
    }
    this.sides.forEach((s, i) => { s.hp -= dmgTo[i]; });
    // 버프 정리: 이번 턴 버프는 사라지고 다음 턴 버프가 적용됨
    for (const s of this.sides) { s.buff = s.nextBuff; s.nextBuff = 0; s.grave.push(...s.hand); s.hand = []; }

    this.lastReveal = this.sides.map((s, i) => ({ id: s.id, fired: effs[i].fired, pass: effs[i].pass, shield: effs[i].shield,
      dmgTaken: dmgTo[i], healed: effs[i].healed, mpGain: effs[i].mpGain, notes: notes[i] }));

    const dead = this.sides.map(s => s.hp <= 0);
    if (dead[0] || dead[1]) {
      this.over = true;
      this.winner = dead[0] && dead[1] ? 'draw' : (dead[0] ? this.sides[1].id : this.sides[0].id);
    }
    return this.lastReveal;
  }

  // 각 학생에게 보낼 화면 정보 (상대 손패는 숨김)
  view(id) {
    const me = this.side(id), op = this.other(id);
    const pub = s => ({ name: s.name, hp: s.hp, maxHp: s.maxHp, mp: s.mp, maxMp: s.maxMp, buff: s.buff, deckLeft: s.draw.length, isBot: s.isBot });
    return { turn: this.turn, me: { ...pub(me), hand: me.hand, chosen: me.choice !== undefined, choice: me.choice },
      op: { ...pub(op), chosen: op.choice !== undefined }, over: this.over, winner: this.winner };
  }
}

// ---------- 컴퓨터(봇)의 카드 선택 ----------
function botScore(id, me, op, hand) {
  const c = CARDS[id]; let sc = 0;
  if (c.gainMp) sc += ({ 0: 7, 1: 6, 2: 3, 3: 1 }[me.mp] ?? 0.3) * (c.gainMp / 5);
  if (c.shield) sc += 0.55 * Math.min(c.shield, 3.5) + 0.4 + (me.hp <= 6 ? 1.5 : 0);
  if (c.heal) sc += 0.8 * Math.min(c.heal, me.maxHp - me.hp) - 1;
  if (c.dmg) {
    const d = c.dmg + me.buff;
    let exp = c.pierce ? d : 0.65 * d + 0.35 * Math.max(0, d - 2.8);
    if (c.doubleVsShield) exp = 0.65 * d + 0.35 * Math.max(0, 2 * d - 2.8);
    sc += 1.2 * exp + (d >= op.hp ? 8 : 0) + (me.buff ? 1 : 0);
  }
  if (c.buffNext) sc += 1.8;
  if (c.reflect) sc += 1.8;
  if (c.joker) sc += hand.filter(x => x !== id).reduce((t, x) => t + botScore(x, me, op, []) + 0.3 * CARDS[x].cost, 0) * 1.05;
  return sc - 0.3 * c.cost + (Math.random() * 2 - 1) * 1.5;
}
function botChoose(battle, id) {
  const me = battle.side(id), op = battle.other(id);
  let best = null, bestS = -Infinity;
  me.hand.forEach((cid, i) => { if (CARDS[cid].cost > me.mp) return; const s = botScore(cid, me, op, me.hand); if (s > bestS) { bestS = s; best = i; } });
  return best;
}

module.exports = { Battle, botChoose, shuffle };

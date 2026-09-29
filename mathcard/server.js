// =============================================================
//  수학 로그라이크 카드 대전 — 서버
//  실행: npm install → npm start  (기본 주소 http://localhost:3000)
// =============================================================
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const { CONFIG, CARDS, BASE_DECK, CHOICE_POOL, DROUGHT_POOL } = require('./game/cards');
const { Battle, botChoose, shuffle } = require('./game/battle');
const problems = require('./game/problems');
const { cardArtSVG, cardBackSVG } = require('./game/cardArt');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'teacher1234';
const DEBUG_ANSWERS = process.env.DEBUG_ANSWERS === '1'; // 테스트용: 정답을 함께 보냄 (실제 수업에서는 절대 켜지 마세요)

if (process.env.FAST_TEST === '1') { CONFIG.REVEAL_SECONDS = 0.2; CONFIG.TURN_SECONDS = 4; } // 자동 테스트용

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ---------- 그림: custom 폴더에 같은 이름의 파일이 있으면 그것을 사용 ----------
const CUSTOM = path.join(__dirname, 'public', 'img', 'custom');
const findCustom = (dir, name) => {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']) {
    const f = path.join(dir, `${name}.${ext}`); if (fs.existsSync(f)) return f;
  }
  return null;
};
app.get('/img/card/:id', (req, res) => {
  const id = req.params.id.replace(/[^a-z0-9_]/gi, '');
  const custom = findCustom(path.join(CUSTOM, 'cards'), id);
  res.set('Cache-Control', 'no-cache');
  if (custom) return res.sendFile(custom);
  const svg = cardArtSVG(id); if (!svg) return res.status(404).end();
  res.type('image/svg+xml').send(svg);
});
// 배경: maze1~4 (1~3 문제 풀이, 4 대기열), board(대결판). custom 폴더에 같은 이름이 있으면 그것을 사용
for (const name of ['maze1', 'maze2', 'maze3', 'maze4', 'board']) {
  app.get(`/img/${name}`, (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(findCustom(CUSTOM, name) || path.join(__dirname, 'public', 'img', `${name}.jpg`));
  });
}
app.get('/img/cardback', (req, res) => {
  const custom = findCustom(CUSTOM, 'cardback');
  if (custom) return res.sendFile(custom);
  res.type('image/svg+xml').send(cardBackSVG());
});
app.get('/health', (req, res) => res.send('ok'));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 상태 (서버 메모리에만 저장) ----------
const classes = new Map(); // code -> { code, size, students: {num: stu}, matches: [] }
const battles = new Map(); // id -> { id, code, battle, nums: [numA, numB|null], timer, botTimer, remainingUntil }
let battleSeq = 0;

function newStudent(num) {
  return { num, socketId: null, stage: 'lobby', deck: BASE_DECK.slice(), problem: null, offer: null,
    wrongStreak: 0, feedback: null, drought: false, typeBag: [], wins: 0, losses: 0, draws: 0,
    battleId: null, lastOpp: null, lastResult: null, round: 1 };
}
function createClass(code, size) {
  const students = {}; for (let n = 1; n <= size; n++) students[n] = newStudent(n);
  classes.set(code, { code, size, students, matches: [] });
}

const socketOf = stu => stu.socketId && io.sockets.sockets.get(stu.socketId);
const hasJoker = deck => deck.some(id => CARDS[id].unique);

function makeOffer(stu) {
  const pool = CHOICE_POOL.filter(id => !(CARDS[id].unique && stu.deck.includes(id)));
  return shuffle(pool.slice()).slice(0, 3);
}
let problemSeq = 0;
function newProblem(stu) { stu.problem = problems.nextProblem(stu); stu.problem.id = ++problemSeq; stu.feedback = null; }

function studentView(cls, stu) {
  const v = { code: cls.code, num: stu.num, stage: stu.stage, deck: stu.deck, deckSize: CONFIG.DECK_SIZE,
    feedback: stu.feedback, wrongStreak: stu.wrongStreak, drought: stu.drought, round: stu.round,
    record: { wins: stu.wins, losses: stu.losses, draws: stu.draws } };
  if (stu.stage === 'problem' && stu.problem) {
    v.problem = problems.publicProblem(stu.problem);
    if (DEBUG_ANSWERS) v.problem.answer = stu.problem.answer;
  }
  if (stu.stage === 'offer') v.offer = stu.offer;
  if (stu.stage === 'queue') v.queue = queueInfo(cls);
  if (stu.stage === 'battle' && stu.battleId && battles.has(stu.battleId)) {
    const b = battles.get(stu.battleId);
    v.battle = b.battle.view('S' + stu.num);
    v.battle.remainingMs = Math.max(0, b.remainingUntil - Date.now());
    v.battle.phase = b.phase;
    if (b.phase === 'reveal' && b.battle.lastReveal) {
      const me = b.battle.lastReveal.find(r => r.id === 'S' + stu.num), op = b.battle.lastReveal.find(r => r.id !== 'S' + stu.num);
      v.battle.reveal = { me, op };
    }
  }
  if (stu.stage === 'result') v.result = stu.lastResult;
  if (stu.stage === 'inherit') v.acquired = stu.deck.slice(BASE_DECK.length);
  return v;
}
function push(cls, stu) { const s = socketOf(stu); if (s) s.emit('state', studentView(cls, stu)); }
function pushAll(cls) { for (const stu of Object.values(cls.students)) if (stu.stage === 'queue') push(cls, stu); }

// ---------- 매칭: 접속한 학생이 모두 대기열에 들어오면 무작위로 짝 짓기 ----------
function queueInfo(cls) {
  const online = Object.values(cls.students).filter(s => s.socketId);
  return { waiting: online.filter(s => s.stage === 'queue').length, online: online.length };
}
function tryMatch(cls, force = false) {
  const online = Object.values(cls.students).filter(s => s.socketId);
  const queued = online.filter(s => s.stage === 'queue');
  if (!queued.length) return;
  if (!force && queued.length < online.length) { pushAll(cls); return; }
  // 직전 상대와 다시 만나지 않도록 여러 번 섞어서 가장 좋은 조합 선택
  let best = null, bestRepeat = Infinity;
  for (let t = 0; t < 40; t++) {
    const order = shuffle(queued.slice()); let rep = 0;
    for (let i = 0; i + 1 < order.length; i += 2) if (order[i].lastOpp === order[i + 1].num || order[i + 1].lastOpp === order[i].num) rep++;
    if (rep < bestRepeat) { bestRepeat = rep; best = order; } if (rep === 0) break;
  }
  for (let i = 0; i < best.length; i += 2) startBattle(cls, best[i], best[i + 1] || null);
  teacherPush();
}
function botDeck() {
  const deck = BASE_DECK.slice();
  while (deck.length < CONFIG.DECK_SIZE) {
    const offer = shuffle(CHOICE_POOL.filter(id => !(CARDS[id].unique && deck.includes(id)))).slice(0, 3);
    deck.push(offer[Math.floor(Math.random() * 3)]);
  }
  return deck;
}

// ---------- 대결 진행 ----------
function startBattle(cls, a, b) {
  const id = 'B' + (++battleSeq);
  const sideA = { id: 'S' + a.num, name: `${a.num}번`, deck: a.deck };
  const sideB = b ? { id: 'S' + b.num, name: `${b.num}번`, deck: b.deck } : { id: 'BOT', name: '연습 로봇', deck: botDeck(), isBot: true };
  const rec = { id, code: cls.code, battle: new Battle(sideA, sideB), nums: [a.num, b ? b.num : null], timer: null, botTimer: null, remainingUntil: 0, phase: 'choose' };
  battles.set(id, rec);
  for (const s of [a, b]) if (s) { s.stage = 'battle'; s.battleId = id; }
  beginTurn(rec);
}
function humans(rec) { const cls = classes.get(rec.code); return cls ? rec.nums.filter(n => n).map(n => cls.students[n]) : []; }
function pushBattle(rec) { const cls = classes.get(rec.code); if (!cls) return; for (const s of humans(rec)) push(cls, s); }

function beginTurn(rec) {
  const B = rec.battle;
  B.startTurn();
  rec.phase = 'choose';
  if (B.turn > 150) { // 안전장치: 너무 길어지면 HP로 판정
    const [x, y] = B.sides; B.over = true; B.winner = x.hp === y.hp ? 'draw' : (x.hp > y.hp ? x.id : y.id);
    return endBattle(rec);
  }
  rec.remainingUntil = Date.now() + CONFIG.TURN_SECONDS * 1000;
  clearTimeout(rec.timer); clearTimeout(rec.botTimer);
  rec.timer = setTimeout(() => { B.timeoutAll(); finishTurn(rec); }, CONFIG.TURN_SECONDS * 1000 + 300);
  const bot = B.sides.find(s => s.isBot);
  if (bot && bot.choice === undefined) rec.botTimer = setTimeout(() => { B.choose(bot.id, botChoose(B, bot.id)); if (B.bothChosen()) finishTurn(rec); else pushBattle(rec); }, 1200 + Math.random() * 2500);
  // 둘 다 낼 카드가 없으면 잠깐 보여 주고 바로 진행
  if (B.bothChosen()) { clearTimeout(rec.timer); rec.timer = setTimeout(() => finishTurn(rec), 1500); }
  pushBattle(rec);
}
function finishTurn(rec) {
  if (rec.phase !== 'choose') return;
  clearTimeout(rec.timer); clearTimeout(rec.botTimer);
  rec.battle.resolve();
  rec.phase = 'reveal';
  rec.remainingUntil = Date.now() + CONFIG.REVEAL_SECONDS * 1000;
  pushBattle(rec);
  rec.timer = setTimeout(() => { if (rec.battle.over) endBattle(rec); else beginTurn(rec); }, CONFIG.REVEAL_SECONDS * 1000);
}
function endBattle(rec, forfeitNum = null) {
  clearTimeout(rec.timer); clearTimeout(rec.botTimer);
  const B = rec.battle, cls = classes.get(rec.code);
  battles.delete(rec.id);
  if (!cls) return;
  let winner = B.winner;
  if (forfeitNum) { const other = B.sides.find(s => s.id !== 'S' + forfeitNum); winner = other.id; }
  const [x, y] = B.sides;
  cls.matches.unshift({ time: Date.now(), a: x.name, b: y.name, winner: winner === 'draw' ? '무승부' : B.side(winner).name, turns: B.turn, hp: `${Math.max(0, x.hp)} : ${Math.max(0, y.hp)}` });
  cls.matches = cls.matches.slice(0, 200);
  for (const stu of humans(rec)) {
    if (stu.battleId !== rec.id) continue;
    const myId = 'S' + stu.num, op = B.other(myId);
    const result = winner === 'draw' ? 'draw' : (winner === myId ? 'win' : 'lose');
    if (result === 'win') stu.wins++; else if (result === 'lose') stu.losses++; else stu.draws++;
    stu.lastOpp = op.isBot ? null : Number(op.id.slice(1));
    stu.lastResult = { result, opponent: op.name, turns: B.turn, myHp: Math.max(0, B.side(myId).hp), opHp: Math.max(0, op.hp), forfeit: !!forfeitNum };
    stu.stage = 'result'; stu.battleId = null;
    push(cls, stu);
  }
  teacherPush();
}

// ---------- 학생 소켓 ----------
io.on('connection', socket => {
  socket.emit('catalog', { cards: CARDS, config: CONFIG, base: BASE_DECK });
  const ctx = () => { const cls = classes.get(socket.data.code); return cls && socket.data.num ? { cls, stu: cls.students[socket.data.num] } : null; };

  socket.on('classes', (_, cb) => cb && cb([...classes.values()].map(c => ({ code: c.code, size: c.size }))));
  socket.on('numbers', ({ code }, cb) => {
    const cls = classes.get(code); if (!cls) return cb && cb(null);
    cb && cb(Object.values(cls.students).map(s => ({ num: s.num, online: !!s.socketId, cards: s.deck.length, stage: s.stage })));
  });
  socket.on('join', ({ code, num }, cb) => {
    const cls = classes.get(code); const stu = cls && cls.students[num];
    if (!stu) return cb && cb({ ok: false, msg: '반이나 번호를 찾을 수 없어요.' });
    if (stu.socketId && stu.socketId !== socket.id && io.sockets.sockets.get(stu.socketId)) return cb && cb({ ok: false, msg: '이미 다른 기기에서 접속 중인 번호예요.' });
    stu.socketId = socket.id; socket.data.code = code; socket.data.num = num;
    cb && cb({ ok: true }); push(cls, stu); teacherPush();
    if (stu.stage === 'queue') tryMatch(cls); else pushAll(cls);
  });
  socket.on('start', () => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'lobby') return push(cls, stu);
    if (stu.deck.length >= CONFIG.DECK_SIZE) stu.stage = 'ready'; else { stu.stage = 'problem'; newProblem(stu); }
    push(cls, stu); teacherPush();
  });
  socket.on('answer', ({ value }) => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'problem' || !stu.problem) return;
    if (problems.check(stu.problem, value)) {
      stu.wrongStreak = 0; stu.offer = makeOffer(stu); stu.stage = 'offer'; stu.feedback = null;
    } else {
      stu.wrongStreak++;
      if (stu.wrongStreak >= CONFIG.DROUGHT_WRONG) {
        // 가뭄 덱: 남은 빈칸만 가뭄 카드로 채움
        while (stu.deck.length < CONFIG.DECK_SIZE) stu.deck.push(DROUGHT_POOL[Math.floor(Math.random() * DROUGHT_POOL.length)]);
        stu.drought = true; stu.stage = 'ready'; stu.problem = null;
      } else stu.feedback = { wrong: true, at: Date.now() };
    }
    push(cls, stu); teacherPush();
  });
  socket.on('pick', ({ index }) => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'offer' || !stu.offer || !stu.offer[index]) return;
    stu.deck.push(stu.offer[index]); stu.offer = null;
    if (stu.deck.length >= CONFIG.DECK_SIZE) { stu.stage = 'ready'; stu.problem = null; } else { stu.stage = 'problem'; newProblem(stu); }
    push(cls, stu); teacherPush();
  });
  socket.on('queue', () => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'ready') return;
    stu.stage = 'queue'; push(cls, stu); teacherPush(); tryMatch(cls);
  });
  socket.on('leaveQueue', () => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'queue') return; stu.stage = 'ready'; push(cls, stu); pushAll(cls); teacherPush();
  });
  socket.on('choose', ({ index }) => { const c = ctx(); if (!c) return; const { stu } = c;
    const rec = stu.battleId && battles.get(stu.battleId); if (!rec || rec.phase !== 'choose') return;
    if (rec.battle.choose('S' + stu.num, index === null ? null : Number(index))) {
      if (rec.battle.bothChosen()) finishTurn(rec); else pushBattle(rec);
    }
  });
  socket.on('toInherit', () => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'result') return; stu.stage = 'inherit'; push(cls, stu);
  });
  socket.on('keep', ({ indices }) => { const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.stage !== 'inherit') return;
    const acquired = stu.deck.slice(BASE_DECK.length);
    const uniq = [...new Set((indices || []).map(Number))].filter(i => i >= 0 && i < acquired.length);
    if (uniq.length !== Math.min(CONFIG.KEEP_COUNT, acquired.length)) return;
    stu.deck = BASE_DECK.concat(uniq.map(i => acquired[i]));
    stu.round++; stu.drought = false; stu.wrongStreak = 0; stu.stage = 'problem'; newProblem(stu);
    push(cls, stu); teacherPush();
  });
  socket.on('disconnect', () => {
    const c = ctx(); if (!c) return; const { cls, stu } = c;
    if (stu.socketId === socket.id) stu.socketId = null;
    teacherPush(); tryMatch(cls);
  });

  // ---------- 교사 ----------
  socket.on('tLogin', ({ pw }, cb) => {
    if (pw !== ADMIN_PASSWORD) return cb && cb({ ok: false });
    socket.data.teacher = true; socket.join('teachers'); cb && cb({ ok: true }); socket.emit('tState', teacherState());
  });
  const T = fn => (data, cb) => { if (!socket.data.teacher) return cb && cb({ ok: false, msg: '로그인이 필요해요.' }); fn(data || {}, cb); };
  socket.on('tCreate', T(({ code, size }, cb) => {
    code = String(code || '').trim().slice(0, 12); size = Math.max(1, Math.min(40, Number(size) || 0));
    if (!code) return cb && cb({ ok: false, msg: '반 코드를 입력해 주세요.' });
    if (classes.has(code)) return cb && cb({ ok: false, msg: '이미 있는 반 코드예요.' });
    createClass(code, size); cb && cb({ ok: true }); teacherPush();
  }));
  socket.on('tDelete', T(({ code }, cb) => {
    const cls = classes.get(code); if (!cls) return;
    for (const rec of [...battles.values()]) if (rec.code === code) { clearTimeout(rec.timer); clearTimeout(rec.botTimer); battles.delete(rec.id); }
    for (const stu of Object.values(cls.students)) { const s = socketOf(stu); if (s) { s.emit('kicked', '선생님이 반을 삭제했어요.'); s.data.code = null; } }
    classes.delete(code); cb && cb({ ok: true }); teacherPush();
  }));
  socket.on('tResetStudent', T(({ code, num }, cb) => {
    const cls = classes.get(code); const stu = cls && cls.students[num]; if (!stu) return;
    resetStudent(cls, stu); cb && cb({ ok: true }); teacherPush();
  }));
  socket.on('tResetClass', T(({ code }, cb) => {
    const cls = classes.get(code); if (!cls) return;
    for (const stu of Object.values(cls.students)) resetStudent(cls, stu);
    cls.matches = []; cb && cb({ ok: true }); teacherPush();
  }));
  socket.on('tForceMatch', T(({ code }, cb) => {
    const cls = classes.get(code); if (!cls) return; tryMatch(cls, true); cb && cb({ ok: true });
  }));
});

function resetStudent(cls, stu) {
  if (stu.battleId && battles.has(stu.battleId)) endBattle(battles.get(stu.battleId), stu.num); // 대결 중이면 상대 승리
  const sid = stu.socketId; Object.assign(stu, newStudent(stu.num)); stu.socketId = sid;
  push(cls, stu);
}

// ---------- 교사 화면용 상태 ----------
const STAGE_LABEL = { lobby: '대기', problem: '문제 풀이', offer: '카드 선택', ready: '덱 완성', queue: '대결 대기', battle: '대결 중', result: '결과 확인', inherit: '카드 계승' };
function teacherState() {
  return { classes: [...classes.values()].map(cls => ({ code: cls.code, size: cls.size, queue: queueInfo(cls),
    students: Object.values(cls.students).map(s => {
      let hp = null;
      if (s.battleId && battles.has(s.battleId)) { const b = battles.get(s.battleId).battle; const me = b.side('S' + s.num), op = b.other('S' + s.num); hp = `${me.hp} vs ${op.hp} (${op.name})`; }
      return { num: s.num, online: !!s.socketId, stage: STAGE_LABEL[s.stage], cards: s.deck.length, round: s.round, wrong: s.wrongStreak, drought: s.drought, wins: s.wins, losses: s.losses, draws: s.draws, battle: hp };
    }), matches: cls.matches.slice(0, 50) })) };
}
let tTimer = null;
function teacherPush() { if (tTimer) return; tTimer = setTimeout(() => { tTimer = null; io.to('teachers').emit('tState', teacherState()); }, 400); }
setInterval(() => { if (battles.size) teacherPush(); }, 3000);

server.listen(PORT, () => console.log(`카드 대전 서버 실행 중: http://localhost:${PORT}  (교사 화면: /teacher.html)`));
module.exports = { app, server };

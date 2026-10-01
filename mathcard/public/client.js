// =============================================================
//  학생 화면 (가로 화면 전용)
// =============================================================
const socket = io();
const $ = s => document.querySelector(s);
const app = $('#app');
let CARDS = {}, CONFIG = {}, BASE = [];
let S = null;                        // 서버에서 받은 내 상태
let local = { screen: 'classes', code: null };
let selected = null, timerInt = null, shownReady = {};
let anim = { turn: -1 };             // 대결 애니메이션을 한 번만 보여 주기 위한 표시
let blog = { key: null, items: [] }; // 대결 기록
let bgNow = 0, lastProblemId = null;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

// ---------- 배경: 미로 1~3은 문제 풀이 때 돌아가며, 4는 대기열 ----------
function setBg(n) { if (bgNow === n) return; bgNow = n; $('#bg').style.backgroundImage = `url('/img/maze${n}')`; }
function nextProblemBg() { const pool = [1, 2, 3].filter(n => n !== bgNow); setBg(pool[Math.floor(Math.random() * pool.length)]); }
['/img/maze2', '/img/maze3', '/img/maze4', '/img/board', '/img/cardback'].forEach(src => { const i = new Image(); i.src = src; });

// 휴대폰·태블릿이면 전체 화면 + 가로 고정 시도 (지원하는 기기에서만 동작)
function tryLandscape() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const el = document.documentElement;
  try { const p = el.requestFullscreen ? el.requestFullscreen() : null; if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (e) {}
}

const TYPE_KR = { attack: '공격', defense: '방어', skill: '스킬' };
function cardHTML(id, { cls = '', attrs = '' } = {}) {
  const c = CARDS[id]; if (!c) return '';
  const t = c.drought ? 'drought' : c.joker ? 'joker' : c.type;
  return `<div class="card ${c.type} ${t} ${cls}" ${attrs}>
    <div class="cost">${c.cost}</div>
    <div class="art" style="background-image:url('/img/card/${id}')"></div>
    <div class="name">${esc(c.name)}</div>
    <div class="kind">${TYPE_KR[c.type]}${c.drought ? ' · 가뭄' : ''}</div>
    <div class="desc">${esc(c.desc)}</div></div>`;
}
const backHTML = (cls = '', attrs = '') => `<div class="cback ${cls}" ${attrs}></div>`;
function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), ms); }
function modal(html, onClose) {
  $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden');
  const close = () => { $('#modal').classList.add('hidden'); onClose && onClose(); };
  $('#modalBox').querySelectorAll('[data-close]').forEach(b => b.onclick = close);
}

// ---------- 게임 방법 팝업 ----------
const HOWTO_GAME = `<h2>게임 진행 방법</h2><ol>
<li>이 게임은 카드를 모아 대결하는 카드게임입니다.</li>
<li>문제를 한 문제 풀 때마다 랜덤하게 등장하는 3장의 카드 중에 한 장을 골라 진행합니다.</li>
<li>카드의 종류는 공격, 방어, 스킬 카드가 있습니다.</li>
<li>기본 카드는 공격 2장, 방어 2장, 스킬 2장이 있습니다.</li>
<li>문제를 열심히 풀어 자신만의 카드 덱을 만들어 친구와 대결하세요.</li></ol>
<div class="row"><button class="btn huge" data-close>확인</button></div>`;
const HOWTO_BATTLE = `<h2>대결 진행 방법</h2><ol>
<li>매턴마다 내 카드 3장 중 한 장을 선택해서 사용할 수 있습니다.</li>
<li>나와 상대가 카드를 다 선택해야 게임이 진행됩니다.</li>
<li>대결이 진행되는 동안 나의 18장의 카드 덱은 계속 해서 다시 사용할 수 있습니다.</li>
<li>공격 카드는 상대에게 데미지를 주고 방어 카드는 상대의 공격을 막을 수 있습니다. 스킬 카드는 특수한 효과를 발동할 수 있습니다.</li>
<li>카드는 MP를 소모해서 사용할 수 있으며 MP가 없어서 카드를 쓸 수 없는 경우 자신의 턴은 스킵됩니다.</li>
<li>상대보다 뛰어난 전략을 사용해서 상대의 HP를 먼저 0으로 만드는 쪽이 승리합니다.</li></ol>
<div class="row"><button class="btn huge" data-close>확인</button></div>`;

function showDeck() {
  if (!S) return;
  const extra = CONFIG.DECK_SIZE - S.deck.length;
  modal(`<h2>내 카드 (${S.deck.length}/${CONFIG.DECK_SIZE})</h2>
    <div class="deck-grid">${S.deck.map(id => cardHTML(id)).join('')}${Array.from({ length: Math.max(0, extra) }, () => backHTML('', 'style="opacity:.35"')).join('')}</div>
    <div class="row" style="margin-top:2.4vh"><button class="btn" data-close>닫기</button></div>`);
}
$('#deckBtn').onclick = showDeck;

// ---------- 소켓 ----------
socket.on('catalog', d => { CARDS = d.cards; CONFIG = d.config; BASE = d.base; if (!S) boot(); });
socket.on('state', st => { S = st; render(); });
socket.on('kicked', msg => { S = null; store.del('login'); toast(msg, 4000); local.screen = 'classes'; render(); });
socket.on('disconnect', () => toast('연결이 끊겼어요. 다시 연결하는 중…', 3000));
socket.on('connect', () => { const L = store.get('login'); if (S && L) socket.emit('join', L, () => {}); });

function boot() {
  const L = store.get('login');
  if (L) socket.emit('join', L, r => { if (!r.ok) { store.del('login'); local.screen = 'classes'; render(); } });
  else render();
}

// ---------- 화면 그리기 ----------
function render() {
  clearInterval(timerInt);
  $('#deckBtn').classList.toggle('hidden', !S || ['battle', 'lobby', 'inherit'].includes(S.stage));
  if (!S) { setBg(1); return local.screen === 'numbers' ? renderNumbers() : renderClasses(); }
  if (S.stage === 'queue' || S.stage === 'battle') setBg(4);
  else if (S.stage === 'problem') { if (S.problem && S.problem.id !== lastProblemId) { lastProblemId = S.problem.id; nextProblemBg(); } }
  else if (!bgNow || bgNow === 4) setBg(1);
  ({ lobby: renderLobby, problem: renderProblem, offer: renderOffer, ready: renderReady, queue: renderQueue,
     battle: renderBattle, result: renderResult, inherit: renderInherit }[S.stage] || renderLobby)();
}
const topbar = () => `<div class="topbar"><span class="big">${esc(S.code)} · ${S.num}번 모험가</span>
  <span class="progress">카드 ${S.deck.length}/${CONFIG.DECK_SIZE}<span class="pbar"><i style="width:${S.deck.length / CONFIG.DECK_SIZE * 100}%"></i></span></span></div>`;
const hero = sub => `<div class="hero"><div class="emblem"></div><h1 class="title">던전 카드 모험</h1><p class="sub">${sub}</p></div>`;

function renderClasses() {
  socket.emit('classes', null, list => {
    app.innerHTML = `<div class="screen">${hero('쌓기나무의 미궁에 도전하라')}
      <div class="panel"><h2 class="title" style="font-size:clamp(20px,4vh,32px);margin-bottom:2vh">우리 반을 골라 주세요</h2>
      <div class="class-list">${list.length ? list.map(c => `<button class="class-btn" data-code="${esc(c.code)}">${esc(c.code)}</button>`).join('') : '<p class="sub">아직 열린 반이 없어요. 선생님을 기다려 주세요.</p>'}</div>
      <div class="row" style="margin-top:2.4vh"><button class="btn dark" id="refresh">새로고침</button></div></div></div>`;
    app.querySelectorAll('[data-code]').forEach(b => b.onclick = () => { tryLandscape(); local.code = b.dataset.code; local.screen = 'numbers'; render(); });
    $('#refresh').onclick = render;
  });
}
function renderNumbers() {
  socket.emit('numbers', { code: local.code }, list => {
    if (!list) { local.screen = 'classes'; return render(); }
    app.innerHTML = `<div class="screen">${hero(esc(local.code) + ' · 내 번호를 눌러 주세요')}
      <div class="panel"><div class="num-grid">${list.map(s => `<button class="num" data-n="${s.num}" ${s.online ? 'disabled' : ''}>${s.num}<small>${s.online ? '접속 중' : s.cards > 6 ? s.cards + '장' : ''}</small></button>`).join('')}</div>
      <div class="row" style="margin-top:2.4vh"><button class="btn dark" id="back">반 다시 고르기</button></div></div></div>`;
    app.querySelectorAll('[data-n]').forEach(b => b.onclick = () => {
      tryLandscape();
      const L = { code: local.code, num: Number(b.dataset.n) };
      socket.emit('join', L, r => { if (r.ok) store.set('login', L); else { toast(r.msg); render(); } });
    });
    $('#back').onclick = () => { local.screen = 'classes'; render(); };
  });
}
function renderLobby() {
  app.innerHTML = `<div class="screen">${hero(`${esc(S.code)} ${S.num}번 모험가, 미궁의 입구에 섰습니다.`)}
    <div class="panel center-panel"><p class="sub" style="font-size:clamp(16px,3vh,24px)">문제를 풀 때마다 카드를 얻고<br>18장의 덱으로 친구와 겨루세요.</p>
    <button class="btn huge" id="go">모험 시작</button>
    <div class="row" style="margin-top:3vh"><button class="btn dark" id="out">번호 바꾸기</button></div></div></div>`;
  $('#go').onclick = () => { tryLandscape(); modal(HOWTO_GAME, () => socket.emit('start')); };
  $('#out').onclick = () => { store.del('login'); location.reload(); };
}
function renderProblem() {
  const p = S.problem; if (!p) return;
  const answer = p.options
    ? `<div class="opts">${p.options.map((svg, i) => `<button class="opt" data-i="${i}"><span class="no">${'①②③④'[i]}</span>${svg}</button>`).join('')}</div>`
    : `<div class="ans"><input id="in" inputmode="numeric" autocomplete="off" placeholder="?"><span>${esc(p.unit)}</span><button class="btn" id="ok">확인</button></div>`;
  app.innerHTML = topbar() + `<div class="screen"><div class="problem-wrap">
    <div class="panel figs-panel"><div class="figs ${p.figs.length > 2 ? 'many' : p.figs.length === 2 ? 'two' : ''}">${p.figs.map(f => `<div class="fig">${f.svg}<div class="cap">${esc(f.cap)}</div></div>`).join('')}</div></div>
    <div class="panel q-panel" id="qp"><span class="qtag">${esc(p.label)}</span><p class="qtext">${p.text}</p>${answer}
      <div class="fb ${S.feedback ? 'bad' : ''}">${S.feedback ? '아쉬워요! 다시 풀어 보세요.' : ''}</div></div>
  </div></div>`;
  if (S.feedback && Date.now() - S.feedback.at < 1500) $('#qp').classList.add('shake');
  if (p.options) app.querySelectorAll('.opt').forEach(b => b.onclick = () => socket.emit('answer', { value: b.dataset.i }));
  else { const inp = $('#in'); inp.focus(); const go = () => { if (inp.value.trim()) socket.emit('answer', { value: inp.value }); };
    $('#ok').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); }; }
}
function renderOffer() {
  app.innerHTML = topbar() + `<div class="screen" style="flex-direction:column;gap:3vh">
    <h1 class="title" style="font-size:clamp(28px,6vh,52px)">정답! 보상을 고르세요</h1>
    <div class="cards-row" style="gap:3vw">${S.offer.map((id, i) => cardHTML(id, { cls: 'pick draw-in', attrs: `data-i="${i}" style="--w:min(19vw,40vh);animation-delay:${i * 0.12}s"` })).join('')}</div>
    <p class="sub">카드를 누르면 덱에 들어가요</p></div>`;
  app.querySelectorAll('.card.pick').forEach(el => el.onclick = () => socket.emit('pick', { index: Number(el.dataset.i) }));
}
function renderReady() {
  app.innerHTML = topbar() + `<div class="screen"><div class="panel center-panel">
    <h1 class="title">덱 완성!</h1>
    <p class="sub">${S.drought ? '남은 칸은 가뭄 카드로 채워졌어요. 그래도 전략만 잘 쓰면 이길 수 있어요!' : `${CONFIG.DECK_SIZE}장의 카드가 모두 모였어요.`}</p>
    <div class="row"><button class="btn dark" id="rule">대결 방법 다시 보기</button><button class="btn huge" id="q">대결 찾기</button></div></div></div>`;
  $('#rule').onclick = () => modal(HOWTO_BATTLE);
  $('#q').onclick = () => socket.emit('queue');
  if (!shownReady[S.round]) { shownReady[S.round] = true; modal(HOWTO_BATTLE); }
}
function renderQueue() {
  const q = S.queue || { waiting: 0, online: 0 };
  app.innerHTML = topbar() + `<div class="screen"><div class="panel center-panel">
    <h1 class="title" style="font-size:clamp(26px,5.5vh,46px)">결투장 문 앞에서 대기 중…</h1>
    <p class="sub">접속한 친구들이 모두 덱을 완성하면 무작위로 상대가 정해져요.</p>
    <div class="title" style="font-size:clamp(40px,10vh,80px)">${q.waiting} / ${q.online}</div>
    <div class="row" style="margin-top:3vh"><button class="btn dark" id="lv">대기 취소</button></div></div></div>`;
  $('#lv').onclick = () => socket.emit('leaveQueue');
}

// ---------- 대결 ----------
const orbs = (n, max) => `<div class="orbs">${Array.from({ length: max }, (_, i) => `<span class="orb ${i < n ? '' : 'empty'}"></span>`).join('')}</div>`;
const hpbar = (hp, max) => `<div class="hpbar"><i style="width:${Math.max(0, hp) / max * 100}%"></i><span>HP ${Math.max(0, hp)} / ${max}</span></div>`;
const chips = (buff, shield) => `<span class="chips">${buff ? `<span class="chip">공격 +${buff}</span>` : ''}${shield ? `<span class="chip def">방어 ${shield}</span>` : ''}</span>`;
const cname = ids => ids.map(id => CARDS[id].name).join(' + ');

function renderBattle() {
  const B = S.battle; if (!B) return;
  const me = B.me, op = B.op, rv = B.phase === 'reveal' ? B.reveal : null;
  const bkey = op.name + '|' + S.round;
  if (blog.key !== bkey || B.turn === 1 && !blog.items.some(x => x.turn === 1)) { if (blog.key !== bkey) blog = { key: bkey, items: [] }; }
  if (B.turn !== anim.turn) { anim = { turn: B.turn }; selected = null; }
  if (rv && !blog.items.some(x => x.turn === B.turn)) {
    blog.items.unshift({ turn: B.turn, me: rv.me.pass ? '패스' : cname(rv.me.fired), op: rv.op.pass ? '패스' : cname(rv.op.fired), got: rv.me.dmgTaken, gave: rv.op.dmgTaken });
  }
  const first = k => { if (anim[k]) return false; anim[k] = true; return true; };

  // 상대 손패 (뒷면)
  const opHandN = rv ? 0 : (op.chosen ? 2 : 3);
  const opHand = Array.from({ length: opHandN }, (_, i) => backHTML(anim.drawnOp ? '' : 'draw-in', `style="animation-delay:${i * .08}s"`)).join('');
  anim.drawnOp = true;
  // 상대 카드 칸
  let opSlot;
  if (rv) {
    const doFlip = first('flip');
    opSlot = rv.op.pass ? `<div class="msg">상대 패스</div>` : rv.op.fired.map(id => `<div class="flip ${doFlip ? 'start' : ''}"><div class="inner">${cardHTML(id)}${backHTML('back')}</div></div>`).join('');
  } else opSlot = op.chosen ? backHTML(first('opIn') ? 'drop-in' : '') : `<div class="msg">상대가 고민 중…</div>`;
  // 내 카드 칸
  let meSlot;
  if (rv) meSlot = rv.me.pass ? `<div class="msg">패스</div>` : rv.me.fired.map(id => cardHTML(id)).join('');
  else if (me.chosen) meSlot = me.choice === null ? `<div class="msg">쓸 수 있는 카드가 없어 쉬어요</div>` : cardHTML(me.hand[me.choice], { cls: first('meIn') ? 'rise-in' : '' });
  else meSlot = `<div class="msg">카드를 골라 내세요</div>`;
  // 내 손패
  const canPlay = id => CARDS[id].cost <= me.mp;
  const drawAnim = first('drawnMe');
  const myHand = (B.phase === 'choose' && !me.chosen)
    ? me.hand.map((id, i) => cardHTML(id, { cls: (canPlay(id) ? 'pick' : 'off') + (selected === i ? ' sel' : '') + (drawAnim ? ' draw-in' : ''), attrs: `data-i="${i}" style="animation-delay:${i * .1}s"` })).join('')
    : (B.phase === 'choose' ? me.hand.filter((_, i) => i !== me.choice).map(id => cardHTML(id, { attrs: 'style="opacity:.45"' })).join('') : '');
  // 떠오르는 숫자
  let floats = '';
  if (rv && first('floats')) {
    const f = (r, x, y) => (r.dmgTaken ? `<div class="float dmg" style="left:${x}%;top:${y}%">-${r.dmgTaken}</div>` : '') +
      (r.healed ? `<div class="float heal" style="left:${x + 9}%;top:${y}%">+${r.healed}</div>` : '') + (r.mpGain ? `<div class="float mp" style="left:${x + 9}%;top:${y + 6}%">MP +${r.mpGain}</div>` : '');
    floats = f(rv.me, 8, 72) + f(rv.op, 78, 18);
  }
  const hitMe = rv && rv.me.dmgTaken && anim.floats === true && !anim.hitDone ? 'hit' : '';
  const hitOp = rv && rv.op.dmgTaken && !anim.hitDone ? 'hit' : ''; if (rv) anim.hitDone = true;
  const selCard = selected !== null && me.hand[selected] ? cardHTML(me.hand[selected], { attrs: 'style="--w:min(15vw,34vh)"' }) : '';

  app.innerHTML = `<div class="arena">
    <div class="side"><h3>전투 기록</h3><div class="log">${blog.items.slice(0, 7).map(x => `<div><b>${x.turn}턴</b> 나: ${esc(x.me)}<br>상대: ${esc(x.op)}<br>${x.gave ? `준 피해 ${x.gave} ` : ''}${x.got ? `받은 피해 ${x.got}` : ''}</div>`).join('') || '<div>아직 기록이 없어요.</div>'}</div></div>
    <div class="board">
      <div class="abs deckcount" style="left:2%;top:4.7%;width:10.6%;height:19.3%">상대 덱<b>${op.deckLeft}</b></div>
      <div class="abs stats ${hitOp}" style="left:75%;top:1.6%;width:23.5%;height:16.4%">
        <div class="who"><span>${esc(op.name)}</span>${chips(op.buff, rv && rv.op.shield)}</div>${hpbar(op.hp, op.maxHp)}${orbs(op.mp, op.maxMp)}</div>
      <div class="abs hand-op">${opHand}</div>
      <div class="abs slot slot-op">${opSlot}</div>
      <div class="abs note" style="top:42%">${rv ? rv.op.notes.map(esc).join(' · ') : ''}</div>
      ${B.phase === 'choose' ? '<div class="abs tsec" id="tsec"></div>' : ''}
      <div class="abs turnlbl">${B.turn}턴${rv ? ' · 공개!' : ''}</div>
      ${B.phase === 'choose' && !me.chosen ? `<button class="abs btn usebtn" id="use" ${selected === null ? 'disabled' : ''}>사용하기</button>` : ''}
      <div class="abs slot slot-me">${meSlot}</div>
      <div class="abs note" style="top:74%">${rv ? rv.me.notes.map(esc).join(' · ') : ''}</div>
      <div class="abs hand-me">${myHand}</div>
      <div class="abs stats ${hitMe}" style="left:2.2%;top:82.2%;width:23.4%;height:13.6%">
        <div class="who"><span>나 (${S.num}번)</span>${chips(me.buff, rv && rv.me.shield)}</div>${hpbar(me.hp, me.maxHp)}${orbs(me.mp, me.maxMp)}</div>
      <div class="abs deckcount" style="left:86.8%;top:77%;width:11%;height:16.5%">내 덱<b>${me.deckLeft}</b></div>
      ${floats}
    </div>
    <div class="side" style="align-items:center"><h3>${selCard ? '선택한 카드' : '내 상태'}</h3>${selCard ||
      `<div class="log" style="width:100%"><div>HP ${me.hp} / ${me.maxHp}</div><div>MP ${me.mp} / ${me.maxMp}</div>${me.buff ? `<div class="me">이번 턴 공격 +${me.buff}</div>` : ''}<div>카드를 누르면 여기에 크게 보여요.</div></div>`}</div>
  </div>`;

  app.querySelectorAll('.flip.start').forEach(el => requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('start'))));
  app.querySelectorAll('.hand-me .card.pick').forEach(el => el.onclick = () => { selected = Number(el.dataset.i); anim.drawnMe = true; renderBattle(); });
  const use = $('#use'); if (use) use.onclick = () => { if (selected !== null) socket.emit('choose', { index: selected }); };
  if (B.phase === 'choose') {
    const end = Date.now() + B.remainingMs; let shown = null;
    const tick = () => { const sec = $('#tsec'); if (!sec) return; const n = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (n === shown) return; shown = n; sec.textContent = n; sec.classList.toggle('low', n <= 5); };
    tick(); timerInt = setInterval(tick, 200);
  }
}
function renderResult() {
  const r = S.result;
  const t = { win: ['승리!', 'win'], lose: ['패배…', 'lose'], draw: ['무승부', 'draw'] }[r.result];
  app.innerHTML = `<div class="screen"><div class="panel center-panel">
    <h1 class="title result-title ${t[1]}">${t[0]}</h1>
    <p class="sub">상대: ${esc(r.opponent)} · ${r.turns}턴 · 남은 HP ${r.myHp} : ${r.opHp}${r.forfeit ? ' (상대가 대결에서 빠졌어요)' : ''}</p>
    <p class="sub">전적 ${S.record.wins}승 ${S.record.losses}패 ${S.record.draws}무</p>
    <button class="btn huge" id="nx">다음 모험 준비</button></div></div>`;
  $('#nx').onclick = () => socket.emit('toInherit');
}
function renderInherit() {
  const acq = S.acquired, need = Math.min(CONFIG.KEEP_COUNT, acq.length);
  const picked = new Set();
  const draw = () => {
    app.innerHTML = `<div class="screen" style="flex-direction:column;gap:1.6vh;padding-top:2vh">
      <h1 class="title" style="font-size:clamp(22px,4.6vh,38px)">다음 모험에 가져갈 카드 ${need}장 (${picked.size}/${need})</h1>
      <p class="sub" style="margin:0">기본 카드 6장과 고른 ${need}장을 들고, 문제 ${CONFIG.DECK_SIZE - BASE.length - need}개를 더 풀어 덱을 완성해요.</p>
      <div class="deck-grid">${acq.map((id, i) => cardHTML(id, { cls: 'pick' + (picked.has(i) ? ' sel' : ''), attrs: `data-i="${i}" style="--w:min(11vw,24vh)"` })).join('')}</div>
      <button class="btn huge" id="done" ${picked.size === need ? '' : 'disabled'}>선택 완료</button></div>`;
    app.querySelectorAll('.card.pick').forEach(el => el.onclick = () => { const i = Number(el.dataset.i);
      if (picked.has(i)) picked.delete(i); else if (picked.size < need) picked.add(i); draw(); });
    $('#done').onclick = () => socket.emit('keep', { indices: [...picked] });
  };
  draw();
}

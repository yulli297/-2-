// =============================================================
//  쌓기나무 문제 자동 생성 (서버에서만 실행 → 정답은 학생 화면에 가지 않음)
//  바닥 최대 4×4, 최대 3층
// =============================================================
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clone = H => H.map(r => r.slice());
const key = g => JSON.stringify(g);
const MAX_SIDE = 4, MAX_H = 3;

function crop(H) {
  let r0 = 99, r1 = -1, c0 = 99, c1 = -1;
  H.forEach((row, r) => row.forEach((h, c) => { if (h > 0) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); } }));
  if (r1 < 0) return [[0]];
  return H.slice(r0, r1 + 1).map(row => row.slice(c0, c1 + 1));
}
function connected(H) {
  const cells = []; H.forEach((row, r) => row.forEach((h, c) => { if (h > 0) cells.push([r, c]); }));
  if (!cells.length) return false;
  const seen = new Set([cells[0].join()]), st = [cells[0]];
  while (st.length) {
    const [r, c] = st.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (H[nr] && H[nr][nc] > 0 && !seen.has(nr + ',' + nc)) { seen.add(nr + ',' + nc); st.push([nr, nc]); }
    }
  }
  return seen.size === cells.length;
}
function genH() {
  const n = 4 + rnd(6), set = new Set([rnd(MAX_SIDE) + ',' + rnd(MAX_SIDE)]);
  while (set.size < n) {
    const a = [...set]; const [r, c] = a[rnd(a.length)].split(',').map(Number);
    const [dr, dc] = [[1, 0], [-1, 0], [0, 1], [0, -1]][rnd(4)]; const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < MAX_SIDE && nc >= 0 && nc < MAX_SIDE) set.add(nr + ',' + nc);
  }
  const H = Array.from({ length: MAX_SIDE }, () => Array(MAX_SIDE).fill(0));
  for (const k of set) { const [r, c] = k.split(',').map(Number); const p = Math.random(); H[r][c] = p < 0.45 ? 1 : p < 0.8 ? 2 : MAX_H; }
  return crop(H);
}
const total = H => H.flat().reduce((a, b) => a + b, 0);

// ---------- 가려짐 검사 ----------
function occ(H, x, y, z) {
  const rows = H.length, xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), r = rows - 1 - yi;
  return zi >= 0 && H[r] !== undefined && H[r][xi] !== undefined && zi < H[r][xi];
}
const S4 = [0.15, 0.38, 0.62, 0.85];
function visCount(H, pts, n) {
  let v = 0;
  for (const p of pts) {
    const q = [p[0] + n[0] * 1e-3, p[1] + n[1] * 1e-3, p[2] + n[2] * 1e-3]; let blocked = false;
    for (let t = 0.02; t < 9; t += 0.04) { if (occ(H, q[0] + t, q[1] - t, q[2] + t)) { blocked = true; break; } }
    if (!blocked) v++;
  }
  return v;
}
function facePts(x, y, z, f) {
  const pts = [];
  for (const a of S4) for (const b of S4) {
    if (f === 'top') pts.push([x + a, y + b, z + 1]);
    if (f === 'front') pts.push([x + a, y, z + b]);
    if (f === 'right') pts.push([x + 1, y + a, z + b]);
  }
  return pts;
}
function analyze(H) {
  const rows = H.length; let minTop = 1, hidden = 0;
  H.forEach((row, r) => row.forEach((h, c) => {
    if (!h) return; const x = c, y = rows - 1 - r;
    minTop = Math.min(minTop, visCount(H, facePts(x, y, h - 1, 'top'), [0, 0, 1]) / 16);
    for (let z = 0; z < h; z++) {
      const v = visCount(H, facePts(x, y, z, 'top'), [0, 0, 1]) + visCount(H, facePts(x, y, z, 'front'), [0, -1, 0]) + visCount(H, facePts(x, y, z, 'right'), [1, 0, 0]);
      if (v === 0) hidden++;
    }
  }));
  return { minTop, hidden };
}
const readable = H => analyze(H).minTop >= 0.25;
function genReadable() { for (;;) { const H = genH(); if (total(H) >= 4 && readable(H)) return H; } }

// ---------- 그림(SVG) ----------
let svgSeq = 0;
function isoSVG(H, { arrows = false, S = 26 } = {}) {
  const rows = H.length, cols = H[0].length, cubes = [];
  H.forEach((row, r) => row.forEach((h, c) => { for (let z = 0; z < h; z++) cubes.push([c, rows - 1 - r, z]); }));
  cubes.sort((a, b) => (a[0] - a[1] + a[2]) - (b[0] - b[1] + b[2]));
  const P = (x, y, z) => [(x + y) * 0.7071 * S, -(-x + y + 2 * z) * 0.4082 * S];
  const polys = [], all = [];
  const face = (pts, fill) => { const pp = pts.map(p => P(...p)); all.push(...pp); polys.push(`<polygon points="${pp.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${fill}" stroke="#5a3d10" stroke-width="1.2" stroke-linejoin="round"/>`); };
  for (const [x, y, z] of cubes) {
    face([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], '#FBE3A6');
    face([[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]], '#F2B84B');
    face([[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]], '#D18F2C');
  }
  const mid = 'ah' + (++svgSeq);
  let extra = '';
  if (arrows) {
    const fa = P(cols / 2, -1.7, 0), fb = P(cols / 2, -0.35, 0), sa = P(cols + 1.7, rows / 2, 0), sb = P(cols + 0.35, rows / 2, 0);
    all.push(fa, sa);
    extra += `<line x1="${fa[0]}" y1="${fa[1]}" x2="${fb[0]}" y2="${fb[1]}" stroke="#7fb3ff" stroke-width="2" marker-end="url(#${mid})"/>`;
    extra += `<line x1="${sa[0]}" y1="${sa[1]}" x2="${sb[0]}" y2="${sb[1]}" stroke="#7fb3ff" stroke-width="2" marker-end="url(#${mid})"/>`;
    extra += `<text x="${fa[0] - 6}" y="${fa[1] + 16}" font-size="14" fill="#7fb3ff" font-weight="700">앞</text>`;
    extra += `<text x="${sa[0] + 2}" y="${sa[1] + 16}" font-size="14" fill="#7fb3ff" font-weight="700">옆</text>`;
  }
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]), pad = 12;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad + 14, h = Math.max(...ys) - y0 + pad + 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}">
<defs><marker id="${mid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7fb3ff"/></marker></defs>${polys.join('')}${extra}</svg>`;
}
function gridSVG(grid, { nums = false, ghost = false, cell = 26 } = {}) {
  const C = grid[0].length, R = grid.length, pad = 4; let s = '';
  grid.forEach((row, r) => row.forEach((v, c) => {
    const x = pad + c * cell, y = pad + r * cell;
    if (v) s += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#F2B84B" stroke="#5a3d10" stroke-width="1.2"/>`;
    else if (ghost) s += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="none" stroke="#8a8198" stroke-dasharray="3 3"/>`;
    if (nums && v) s += `<text x="${x + cell / 2}" y="${y + cell / 2 + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="#3b2a0b">${v}</text>`;
  }));
  const w = C * cell + pad * 2, h = R * cell + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`;
}
const heightsToGrid = hs => { const m = Math.max(...hs); return Array.from({ length: m }, (_, row) => hs.map(h => h >= m - row)); };
const frontHs = H => H[0].map((_, c) => Math.max(...H.map(r => r[c])));
const sideHs = H => H.map((_, i) => Math.max(...H[H.length - 1 - i])); // 왼쪽=앞, 오른쪽=뒤 (오른쪽 옆에서 봄)
const topGrid = H => H.map(r => r.map(h => h > 0));
const layerGrid = (H, k) => H.map(r => r.map(h => h >= k));
const cropBool = g => crop(g.map(r => r.map(v => v ? 1 : 0))).map(r => r.map(v => v > 0));

// ---------- 헷갈리는 오답 보기 ----------
function pick3(cands, correctKey) {
  const seen = new Set([correctKey]), out = [];
  for (const c of shuffle(cands)) { const k = key(c); if (!seen.has(k)) { seen.add(k); out.push(c); } if (out.length === 3) break; }
  return out;
}
function heightDistractors(hs, other) {
  const c = [];
  hs.forEach((h, i) => [1, -1].forEach(d => { const v = h + d; if (v >= 1 && v <= MAX_H) { const a = hs.slice(); a[i] = v; c.push(a); } }));
  c.push(hs.slice().reverse());
  for (let i = 0; i + 1 < hs.length; i++) { const a = hs.slice(); [a[i], a[i + 1]] = [a[i + 1], a[i]]; c.push(a); }
  c.push(other.slice(), other.slice().reverse());
  const out = pick3(c, key(hs));
  let guard = 0;
  while (out.length < 3 && guard++ < 50) { const a = hs.map(() => 1 + rnd(MAX_H)); if (!out.some(o => key(o) === key(a)) && key(a) !== key(hs)) out.push(a); }
  return out;
}
function topDistractors(g) {
  const c = [], R = g.length, C = g[0].length;
  for (let r = 0; r < R; r++) for (let k = 0; k < C; k++) {
    const a = g.map(x => x.slice()); a[r][k] = !a[r][k];
    if (connected(a.map(x => x.map(v => v ? 1 : 0)))) c.push(cropBool(a));
  }
  c.push(g.map(r => r.slice().reverse()), g.slice().reverse());
  return pick3(c, key(g));
}
function shapeDistractors(H) {
  const c = [];
  H.forEach((row, r) => row.forEach((h, k) => {
    [1, -1].forEach(d => {
      const v = h + d; if (v < 0 || v > MAX_H || (h === 0 && d < 0)) return;
      const a = clone(H); a[r][k] = v; if (connected(a)) c.push(crop(a));
    });
  }));
  c.push(H.map(r => r.slice().reverse()));
  return pick3(c.filter(a => total(a) >= 3 && readable(a)), key(H));
}

// ---------- 문제 유형 ----------
const TYPES = ['count', 'view', 'numbers', 'layerCnt', 'layerPick'];
const TYPE_LABEL = { count: '개수 세기', view: '본 모양 고르기', numbers: '위에서 본 모양의 수', layerCnt: '층별 모양 → 개수', layerPick: '층별 모양 → 입체 고르기' };

function makeProblem(type) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const H = genReadable();
    if (type === 'count') {
      const { hidden } = analyze(H);
      const figs = [{ svg: isoSVG(H), cap: '쌓은 모양' }];
      if (hidden > 0) figs.push({ svg: gridSVG(topGrid(H)), cap: '위에서 본 모양' });
      return { type, text: '쌓기나무로 쌓은 모양입니다. 사용한 쌓기나무는 모두 몇 개일까요?' + (hidden > 0 ? ' (위에서 본 모양을 참고하세요.)' : ''), figs, answer: total(H), unit: '개' };
    }
    if (type === 'view') {
      const dir = ['front', 'side', 'top'][rnd(3)];
      let correct, dis, toSVG;
      if (dir === 'top') { correct = topGrid(H); dis = topDistractors(correct); toSVG = g => gridSVG(g); }
      else {
        const hs = dir === 'front' ? frontHs(H) : sideHs(H), other = dir === 'front' ? sideHs(H) : frontHs(H);
        correct = hs; dis = heightDistractors(hs, other); toSVG = a => gridSVG(heightsToGrid(a));
      }
      if (dis.length < 3) continue;
      const opts = shuffle([{ v: correct, ok: true }, ...dis.map(v => ({ v, ok: false }))]);
      const name = { front: '앞', side: '옆', top: '위' }[dir];
      return { type, text: `쌓기나무로 쌓은 모양을 <b>${name}</b>에서 본 모양을 고르세요.`, figs: [{ svg: isoSVG(H, { arrows: true }), cap: '쌓은 모양' }],
        options: opts.map(o => toSVG(o.v)), answer: opts.findIndex(o => o.ok) };
    }
    if (type === 'numbers') {
      return { type, text: '위에서 본 모양의 각 칸에 그 자리에 쌓은 쌓기나무 수를 썼습니다. 쌓기나무는 모두 몇 개일까요?',
        figs: [{ svg: gridSVG(H, { nums: true }), cap: '위에서 본 모양' }], answer: total(H), unit: '개' };
    }
    const maxH = Math.max(...H.flat());
    const layers = []; for (let k = 1; k <= maxH; k++) layers.push({ svg: gridSVG(layerGrid(H, k), { ghost: true }), cap: k + '층' });
    if (type === 'layerCnt') {
      return { type, text: '쌓기나무로 쌓은 모양을 층별로 나타낸 그림입니다. 쌓기나무는 모두 몇 개일까요?', figs: layers, answer: total(H), unit: '개' };
    }
    const dis = shapeDistractors(H);
    if (dis.length < 3) continue;
    const opts = shuffle([{ v: H, ok: true }, ...dis.map(v => ({ v, ok: false }))]);
    return { type, text: '층별로 나타낸 모양을 보고, 쌓은 모양으로 알맞은 것을 고르세요.', figs: layers,
      options: opts.map(o => isoSVG(o.v, { S: 20 })), answer: opts.findIndex(o => o.ok) };
  }
  return makeProblem('count');
}

// 학생마다 유형 주머니를 섞어서 차례로 꺼냄 → 다섯 유형이 골고루 나옴
function nextProblem(student) {
  if (!student.typeBag || !student.typeBag.length) student.typeBag = shuffle(TYPES.slice());
  return makeProblem(student.typeBag.pop());
}
// 학생에게 보낼 때는 정답을 뺀다
const publicProblem = p => ({ id: p.id, type: p.type, label: TYPE_LABEL[p.type], text: p.text, figs: p.figs, options: p.options || null, unit: p.unit || '' });
function check(p, value) {
  if (p.options) return Number(value) === p.answer;
  const v = String(value ?? '').replace(/[^0-9]/g, '');
  return v !== '' && Number(v) === p.answer;
}

module.exports = { nextProblem, publicProblem, check, TYPES, makeProblem };

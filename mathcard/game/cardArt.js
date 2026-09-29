// =============================================================
//  카드 그림 자동 생성 (던전 RPG 풍 SVG)
//  public/img/custom/cards/<카드id>.png(.jpg/.webp)를 넣으면 그 그림이 대신 쓰입니다.
// =============================================================
const { CARDS } = require('./cards');

// 배경 색: [가운데 빛, 가장자리 어둠, 입자 색]
const PAL = {
  attack: ['#6b1a12', '#0d0605', '#ff7a3d'],
  defense: ['#1c3550', '#05080d', '#8fc7ff'],
  skill: ['#3d1f5c', '#07040c', '#c08bff'],
  joker: ['#5c4410', '#0b0803', '#ffd36b'],
  drought: ['#3b3328', '#070605', '#9c8c72'],
};

const DEFS = `
<linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset=".45" stop-color="#9aa5b1"/><stop offset=".55" stop-color="#5d6773"/><stop offset="1" stop-color="#2a3038"/></linearGradient>
<linearGradient id="dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b7580"/><stop offset="1" stop-color="#1d2228"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset=".5" stop-color="#b8862b"/><stop offset="1" stop-color="#4f340c"/></linearGradient>
<linearGradient id="leather" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b160b"/><stop offset=".5" stop-color="#5a3219"/><stop offset="1" stop-color="#2b160b"/></linearGradient>
<linearGradient id="rust" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b07a4a"/><stop offset=".5" stop-color="#6e4526"/><stop offset="1" stop-color="#2f1d10"/></linearGradient>
<radialGradient id="ember"><stop offset="0" stop-color="#fff1c2"/><stop offset=".3" stop-color="#ff9a3d"/><stop offset=".7" stop-color="#c2310f" stop-opacity=".6"/><stop offset="1" stop-color="#5a0d05" stop-opacity="0"/></radialGradient>
<radialGradient id="arcane"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#9fe7ff"/><stop offset=".7" stop-color="#2f7fd6" stop-opacity=".6"/><stop offset="1" stop-color="#0a2a5a" stop-opacity="0"/></radialGradient>
<radialGradient id="violet"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#e0b3ff"/><stop offset=".7" stop-color="#7a3fd1" stop-opacity=".6"/><stop offset="1" stop-color="#2a0d4a" stop-opacity="0"/></radialGradient>
<radialGradient id="blood"><stop offset="0" stop-color="#ffb3b3"/><stop offset=".35" stop-color="#e02438"/><stop offset="1" stop-color="#4a0610"/></radialGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>
<filter id="grit"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/></filter>
<radialGradient id="vig" cx=".5" cy=".5" r=".7"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>`;

// ---------- 공통 부품 ----------
const sword = ({ x = 100, y = 72, rot = -35, len = 1, blade = 'url(#steel)', edge = '#1a1f25' } = {}) => `
<g transform="translate(${x} ${y}) rotate(${rot}) scale(${len})">
  <path d="M-6,-58 L0,-68 L6,-58 L6,16 L-6,16 Z" fill="${blade}" stroke="${edge}" stroke-width="1.5"/>
  <path d="M0,-64 L0,14" stroke="#ffffff" stroke-opacity=".45" stroke-width="1"/>
  <path d="M-24,16 Q0,24 24,16 L24,22 Q0,30 -24,22 Z" fill="url(#gold)" stroke="#2a1a06" stroke-width="1.2"/>
  <rect x="-4" y="24" width="8" height="24" rx="2" fill="url(#leather)" stroke="#140a04"/>
  <path d="M-4,30 H4 M-4,36 H4 M-4,42 H4" stroke="#1a0d05" stroke-width="1"/>
  <circle cx="0" cy="52" r="6" fill="url(#gold)" stroke="#2a1a06"/><circle cx="-1.5" cy="50.5" r="1.8" fill="#fff" opacity=".6"/>
</g>`;
const sparks = (col, pts) => `<g fill="${col}">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
const heater = (fill = 'url(#steel)', trim = 'url(#gold)', emblem = '') => `
<path d="M100 18 L144 30 Q146 78 100 124 Q54 78 56 30 Z" fill="${trim}" stroke="#140c04" stroke-width="2"/>
<path d="M100 26 L136 36 Q137 76 100 114 Q63 76 64 36 Z" fill="${fill}" stroke="#1a1f25" stroke-width="1.5"/>
<path d="M72 40 L100 32 L100 110 Q70 80 72 40 Z" fill="#fff" opacity=".12"/>${emblem}`;
const rivets = (pts) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="url(#gold)" stroke="#1a1206" stroke-width=".8"/>`).join('');
const crystal = (g = 'url(#arcane)', core = '#bff2ff', dim = 1) => `
<ellipse cx="100" cy="74" rx="46" ry="46" fill="${g}" opacity="${0.7 * dim}" filter="url(#glow)"/>
<path d="M100 22 L122 58 L112 118 L88 118 L78 58 Z" fill="${core}" opacity="${0.9 * dim}" stroke="#0b2a4a" stroke-width="1.5"/>
<path d="M100 22 L112 118 L100 110 Z" fill="#fff" opacity=".35"/><path d="M78 58 L100 22 L92 70 Z" fill="#0b3a6a" opacity=".35"/>
<path d="M122 58 L112 118 L106 70 Z" fill="#0b3a6a" opacity=".5"/>`;
const runeRing = (col, r = 44, cy = 72) => `<circle cx="100" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="1.6" opacity=".7"/>
<circle cx="100" cy="${cy}" r="${r - 7}" fill="none" stroke="${col}" stroke-width=".8" stroke-dasharray="3 5" opacity=".7"/>
${Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2, x = 100 + Math.cos(a) * (r - 3.5), y = cy + Math.sin(a) * (r - 3.5); return `<path d="M${(x - 2.5).toFixed(1)} ${(y - 3).toFixed(1)} l2.5 6 l2.5 -6" stroke="${col}" stroke-width="1.2" fill="none" opacity=".85"/>`; }).join('')}`;

const ART = {
  base_attack: () => `<ellipse cx="100" cy="80" rx="60" ry="40" fill="url(#ember)" opacity=".45" filter="url(#glow)"/>` + sword({ rot: -30 }) + sparks('#ffb35c', [[48, 36, 1.4], [150, 30, 1.2], [160, 96, 1.6], [40, 104, 1]]),
  strike: () => `<path d="M30 22 Q120 30 162 118" stroke="#fff" stroke-width="10" fill="none" opacity=".2" filter="url(#soft)"/><path d="M34 20 Q120 34 158 116" stroke="#ffe0c2" stroke-width="3" fill="none" opacity=".75"/>
    <ellipse cx="150" cy="112" rx="34" ry="12" fill="url(#ember)" opacity=".8" filter="url(#glow)"/>` + sword({ x: 108, y: 64, rot: 35, len: 1.05 }) + sparks('#ffcf7a', [[140, 118, 2], [158, 104, 1.5], [168, 120, 1.2], [128, 124, 1.4]]),
  weakpoint: () => `<g opacity=".95"><path d="M70 40 L118 50 Q122 90 92 118 Q62 92 70 40 Z" fill="url(#dark)" stroke="#0e1115" stroke-width="2"/>
    <path d="M90 46 L96 70 L84 84 L98 100 L92 116" stroke="#0a0a0a" stroke-width="3" fill="none"/><path d="M104 52 L100 72 L112 84" stroke="#0a0a0a" stroke-width="2" fill="none"/></g>
    <g fill="#8f9aa6" stroke="#1a1f25"><path d="M126 60 l10 -4 l2 8 z"/><path d="M130 84 l12 2 l-6 8 z"/><path d="M58 70 l-10 -2 l4 10 z"/></g>
    <g transform="translate(132 50) rotate(40)"><rect x="-4" y="-6" width="8" height="70" rx="2" fill="url(#leather)" stroke="#140a04"/><rect x="-22" y="-26" width="44" height="24" rx="3" fill="url(#steel)" stroke="#1a1f25" stroke-width="1.5"/><path d="M-22 -14 H22" stroke="#1a1f25"/>${rivets([[-16, -20], [16, -20], [-16, -8], [16, -8]])}</g>
    <ellipse cx="96" cy="66" rx="24" ry="14" fill="url(#ember)" opacity=".55" filter="url(#glow)"/>`,
  heavy: () => `<circle cx="100" cy="92" r="46" fill="none" stroke="#ffcf9a" stroke-width="3" opacity=".35"/><circle cx="100" cy="92" r="30" fill="url(#ember)" opacity=".7" filter="url(#glow)"/>
    <g transform="translate(100 64) rotate(-18)"><rect x="-5" y="0" width="10" height="64" rx="3" fill="url(#leather)" stroke="#140a04"/><circle cx="0" cy="-10" r="24" fill="url(#steel)" stroke="#1a1f25" stroke-width="2"/>
    ${Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return `<path d="M${(Math.cos(a) * 20).toFixed(1)} ${(-10 + Math.sin(a) * 20).toFixed(1)} L${(Math.cos(a) * 32).toFixed(1)} ${(-10 + Math.sin(a) * 32).toFixed(1)}" stroke="#c9d1da" stroke-width="5" stroke-linecap="round"/>`; }).join('')}
    <circle cx="-7" cy="-17" r="6" fill="#fff" opacity=".35"/></g>` + sparks('#ffd08a', [[60, 120, 2], [140, 122, 1.6], [150, 106, 1.2], [52, 104, 1.4]]),
  pierce: () => `<path d="M40 128 Q60 60 100 40 Q140 60 160 128 Z" fill="#000" opacity=".55"/><path d="M62 128 Q72 70 100 56 Q128 70 138 128" fill="#0c0708" stroke="#2a1516" stroke-width="2"/>
    <path d="M86 78 l8 3 M114 78 l-8 3" stroke="#ff2e3f" stroke-width="3" stroke-linecap="round" filter="url(#soft)"/><path d="M86 78 l8 3 M114 78 l-8 3" stroke="#ffb3b8" stroke-width="1.2" stroke-linecap="round"/>
    <g transform="translate(142 58) rotate(-140)"><path d="M-4,-40 L0,-48 L4,-40 L4,6 L-4,6 Z" fill="url(#steel)" stroke="#111"/><rect x="-12" y="6" width="24" height="4" fill="url(#gold)"/><rect x="-3" y="10" width="6" height="14" fill="url(#leather)"/></g>
    <path d="M120 90 q3 8 0 12 q-3 -4 0 -12" fill="url(#blood)"/><circle cx="120" cy="108" r="2.4" fill="#c21a2c"/>`,
  ultimate: () => `<ellipse cx="100" cy="84" rx="80" ry="54" fill="url(#ember)" opacity=".85" filter="url(#glow)"/>
    <path d="M40 130 Q36 90 62 74 Q58 98 78 94 Q70 60 98 34 Q98 70 118 70 Q114 50 136 44 Q156 90 150 130 Z" fill="#c2310f" opacity=".85"/><path d="M62 130 Q64 100 84 96 Q86 112 104 106 Q100 86 118 78 Q132 104 126 130 Z" fill="#ffb13d"/>` +
    sword({ x: 84, y: 70, rot: -38, len: .9 }) + sword({ x: 116, y: 70, rot: 38, len: .9 }) + sparks('#fff0b3', [[40, 30, 2], [160, 34, 1.6], [30, 70, 1.3], [172, 64, 1.8], [100, 18, 1.4]]),
  base_defense: () => `<circle cx="100" cy="72" r="48" fill="url(#dark)" stroke="#0e1115" stroke-width="3"/><circle cx="100" cy="72" r="42" fill="url(#steel)" opacity=".85"/>
    <circle cx="100" cy="72" r="30" fill="none" stroke="#2a3038" stroke-width="2"/><circle cx="100" cy="72" r="12" fill="url(#gold)" stroke="#2a1a06"/>
    ${rivets(Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return [100 + Math.cos(a) * 37, 72 + Math.sin(a) * 37]; }))}<path d="M70 50 Q82 38 100 36" stroke="#fff" stroke-width="3" opacity=".35" fill="none"/>`,
  guard: () => heater('url(#steel)', 'url(#gold)', `<path d="M100 42 L100 104 M78 62 H122" stroke="#7a1420" stroke-width="7"/><path d="M100 42 L100 104 M78 62 H122" stroke="#c42a3a" stroke-width="3"/>`),
  fortress: () => `<rect x="44" y="30" width="112" height="98" fill="url(#dark)" stroke="#0e1115" stroke-width="2"/>
    ${[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3].map(c => `<rect x="${44 + c * 28 + (r % 2) * 14 - 14}" y="${30 + r * 20}" width="28" height="20" fill="none" stroke="#11151a" stroke-width="1.5"/>`).join('')).join('')}
    ${[44, 72, 100, 128].map(x => `<rect x="${x}" y="16" width="16" height="16" fill="url(#dark)" stroke="#0e1115" stroke-width="2"/>`).join('')}
    <path d="M78 128 V88 Q100 66 122 88 V128 Z" fill="#050608"/>${[84, 94, 104, 114].map(x => `<path d="M${x} 80 V128" stroke="url(#steel)" stroke-width="3"/>`).join('')}<path d="M80 96 H120 M80 110 H120" stroke="url(#steel)" stroke-width="3"/>
    <rect x="44" y="30" width="112" height="98" fill="#000" opacity=".15"/>`,
  managuard: () => `<ellipse cx="100" cy="72" rx="56" ry="56" fill="url(#arcane)" opacity=".45" filter="url(#glow)"/>` + heater('url(#dark)', 'url(#steel)', runeRing('#8fe0ff', 26, 68) + `<path d="M100 52 Q112 68 112 76 A12 12 0 0 1 88 76 Q88 68 100 52 Z" fill="#6fd8ff"/><path d="M100 52 Q112 68 112 76 A12 12 0 0 1 88 76 Q88 68 100 52 Z" fill="#bff2ff" filter="url(#glow)" opacity=".7"/>`),
  base_mana: () => crystal(),
  meditate: () => runeRing('#8fe0ff') + `<ellipse cx="100" cy="72" rx="30" ry="30" fill="url(#arcane)" opacity=".7" filter="url(#glow)"/>
    <rect x="92" y="70" width="16" height="44" rx="2" fill="#e8dcc0" stroke="#5a4a30"/><path d="M92 78 q4 3 0 8" stroke="#c9b894" fill="none"/>
    <path d="M100 70 Q92 58 100 44 Q108 58 100 70 Z" fill="#9fe7ff"/><path d="M100 68 Q96 60 100 52 Q104 60 100 68 Z" fill="#fff"/>
    <ellipse cx="100" cy="116" rx="26" ry="5" fill="#000" opacity=".5"/>`,
  focus: () => runeRing('#d9a6ff', 48) + `<path d="M46 72 Q100 30 154 72 Q100 114 46 72 Z" fill="#12061f" stroke="url(#gold)" stroke-width="3"/>
    <circle cx="100" cy="72" r="22" fill="url(#violet)"/><circle cx="100" cy="72" r="22" fill="none" stroke="#2a0d4a" stroke-width="2"/><ellipse cx="100" cy="72" rx="5" ry="15" fill="#08020f"/>
    <circle cx="94" cy="64" r="3" fill="#fff" opacity=".8"/>`,
  firstaid: () => `<ellipse cx="100" cy="80" rx="50" ry="36" fill="#6a1a14" opacity=".4" filter="url(#glow)"/>
    <path d="M52 96 Q52 62 88 62 L148 62 Q148 96 112 96 Z" fill="#d9ccb0" stroke="#6b5a3a" stroke-width="2"/><path d="M60 88 Q62 70 88 70 M66 94 Q70 78 94 76" stroke="#a8966e" fill="none"/>
    <path d="M120 60 L150 30" stroke="#d9ccb0" stroke-width="10" stroke-linecap="round"/><path d="M120 60 L150 30" stroke="#b09c74" stroke-width="2" stroke-dasharray="3 4"/>
    <path d="M86 70 h10 v-10 h8 v10 h10 v8 h-10 v10 h-8 v-10 h-10 z" fill="#b3202e" stroke="#4a0610"/>
    <g transform="translate(60 108) rotate(-20)"><path d="M0 0 q14 -18 28 0 q-14 12 -28 0" fill="#3f7a3a" stroke="#1d3a1a"/><path d="M0 0 H28" stroke="#1d3a1a"/></g>`,
  potion: () => `<ellipse cx="100" cy="88" rx="44" ry="36" fill="url(#blood)" opacity=".55" filter="url(#glow)"/>
    <rect x="90" y="14" width="20" height="14" rx="2" fill="url(#leather)" stroke="#140a04"/><rect x="92" y="26" width="16" height="14" fill="#9aa5b1" opacity=".7" stroke="#2a3038"/>
    <path d="M92 40 H108 V52 Q138 62 138 92 A38 32 0 0 1 62 92 Q62 62 92 52 Z" fill="#1a0a0c" stroke="url(#gold)" stroke-width="3"/>
    <path d="M66 92 Q80 82 100 88 Q120 94 134 86 A34 28 0 0 1 66 92 Z" fill="url(#blood)"/><ellipse cx="82" cy="70" rx="5" ry="10" fill="#fff" opacity=".35"/>
    ${sparks('#ffb3b3', [[96, 100, 1.5], [110, 106, 1.2], [88, 110, 1]])}`,
  joker: () => `<ellipse cx="100" cy="74" rx="60" ry="50" fill="url(#ember)" opacity=".35" filter="url(#glow)"/>
    <path d="M58 46 L40 18 L74 38 M142 46 L160 18 L126 38 M100 32 L100 6" stroke="url(#gold)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="40" cy="18" r="6" fill="#8a1020" stroke="url(#gold)" stroke-width="2"/><circle cx="160" cy="18" r="6" fill="#1a1a2a" stroke="url(#gold)" stroke-width="2"/><circle cx="100" cy="6" r="6" fill="url(#gold)"/>
    <path d="M58 46 Q100 24 142 46 Q150 94 100 124 Q50 94 58 46 Z" fill="#e6dcc6" stroke="#3a2a10" stroke-width="2"/>
    <path d="M100 30 Q100 80 100 124 Q50 94 58 46 Q78 34 100 30 Z" fill="#1a1216" opacity=".85"/>
    <path d="M74 66 Q84 58 94 68 Q84 72 74 66 Z" fill="#000"/><path d="M106 68 Q116 58 126 66 Q116 72 106 68 Z" fill="#000"/><circle cx="116" cy="66" r="2" fill="#ff3b3b"/>
    <path d="M78 92 Q100 108 122 92 Q100 100 78 92 Z" fill="#8a1020"/><path d="M110 40 L104 58 L112 64" stroke="#3a2a10" stroke-width="1.5" fill="none"/>`,
  mirror: () => `<ellipse cx="100" cy="62" rx="52" ry="54" fill="url(#violet)" opacity=".4" filter="url(#glow)"/>
    <rect x="93" y="104" width="14" height="30" rx="3" fill="url(#leather)" stroke="#140a04"/><ellipse cx="100" cy="60" rx="40" ry="46" fill="url(#gold)" stroke="#2a1a06" stroke-width="2"/>
    <ellipse cx="100" cy="60" rx="31" ry="37" fill="#12081f"/><ellipse cx="100" cy="60" rx="31" ry="37" fill="url(#violet)" opacity=".55"/>
    <path d="M84 40 L108 26 M82 56 L118 34" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    <path d="M22 60 H50 M38 50 L50 60 L38 70" stroke="#ff5a5a" stroke-width="4" fill="none"/><path d="M178 60 H150 M162 50 L150 60 L162 70" stroke="#ff5a5a" stroke-width="4" fill="none"/>`,
  rusty_sword: () => sword({ rot: -30, blade: 'url(#rust)', edge: '#2a180c' }) + sparks('#5a3a1a', [[96, 58, 3], [108, 44, 2.4], [90, 74, 2]]),
  dull_spear: () => `<g transform="translate(100 72) rotate(-40)"><rect x="-3" y="-24" width="6" height="84" rx="2" fill="url(#leather)"/><path d="M0,-60 L10,-26 L0,-20 L-10,-26 Z" fill="url(#rust)" stroke="#2a180c" stroke-width="1.5"/><path d="M-10 -26 L-4 -30" stroke="#2a180c"/></g>`,
  cracked: () => heater('url(#rust)', 'url(#dark)', `<path d="M100 28 L92 54 L106 70 L94 92 L100 118" stroke="#050505" stroke-width="3.5" fill="none"/><path d="M92 54 L76 60 M106 70 L124 64" stroke="#050505" stroke-width="2" fill="none"/>`),
  weak_mana: () => crystal('url(#arcane)', '#6d8fa6', .45) + `<path d="M92 50 L104 76 L96 96" stroke="#1a2a3a" stroke-width="2" fill="none"/>`,
};

function cardArtSVG(id) {
  const c = CARDS[id]; if (!c) return null;
  const pal = c.drought ? PAL.drought : c.joker ? PAL.joker : PAL[c.type];
  const draw = ART[id] || (() => '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="400" height="280">
<defs>${DEFS}<radialGradient id="bg" cx=".5" cy=".55" r=".75"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></radialGradient></defs>
<rect width="200" height="140" fill="url(#bg)"/>
<g stroke="#000" stroke-opacity=".35" fill="none">${[0, 1, 2, 3, 4, 5, 6].map(r => `<path d="M0 ${r * 22 + 6} H200"/>` + [0, 1, 2, 3, 4].map(k => `<path d="M${k * 48 + (r % 2) * 24} ${r * 22 + 6} v22"/>`).join('')).join('')}</g>
<rect width="200" height="140" filter="url(#grit)"/>
<g fill="${pal[2]}" opacity=".35">${[[18, 22], [182, 30], [28, 120], [172, 116], [150, 12], [44, 64], [160, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3"/>`).join('')}</g>
${draw()}
<rect width="200" height="140" fill="url(#vig)"/>
</svg>`;
}

// 카드 뒷면
function cardBackSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 222" width="300" height="444">
<defs>${DEFS}<radialGradient id="bb" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#2a1a3f"/><stop offset="1" stop-color="#07040c"/></radialGradient></defs>
<rect width="150" height="222" rx="10" fill="url(#bb)"/>
<rect width="150" height="222" rx="10" filter="url(#grit)" opacity=".8"/>
<rect x="7" y="7" width="136" height="208" rx="7" fill="none" stroke="url(#gold)" stroke-width="3"/>
<rect x="14" y="14" width="122" height="194" rx="5" fill="none" stroke="#b8862b" stroke-width="1" opacity=".6"/>
<g transform="translate(-25 39)">${runeRing('#c08bff', 44)}</g>
<ellipse cx="75" cy="111" rx="24" ry="24" fill="url(#violet)" opacity=".7" filter="url(#glow)"/>
<path d="M75 82 L90 111 L75 140 L60 111 Z" fill="url(#gold)" stroke="#2a1a06" stroke-width="1.5"/><path d="M75 82 L90 111 L75 111 Z" fill="#fff" opacity=".3"/>
${[[24, 24], [126, 24], [24, 198], [126, 198]].map(([x, y]) => `<path d="M${x} ${y - 7} L${x + 7} ${y} L${x} ${y + 7} L${x - 7} ${y} Z" fill="url(#gold)"/>`).join('')}
</svg>`;
}

module.exports = { cardArtSVG, cardBackSVG };

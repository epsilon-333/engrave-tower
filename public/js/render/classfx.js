// 렌더러 — 갈래마다 다른 시각 언어 (2026-11-27)
// 「클래스별로 이펙트가 다 비슷하고 뭐만 하면 가시」 → 갈래(data/skills.js CLASSES)마다 색 · 모양 재료 · 움직임 · 맞는 순간을 하나씩 정한다.
// 범용 사건(skillAoe · skillCone · skillSingle · skillLine · buff)을 스킬의 갈래로 갈라 그 갈래 그림을 덧그린다.
// 가시는 정말 가시를 쓰는 스킬만(KEEP_SPIKE) · 나머지 가시 자리는 갈래 그림(classHit)으로 바꾼다 (bigfx impact · origfx spikes).
// 시공술사(시간 정지 · 감속장 · 특이점 · 중력 붕괴 · 순간이동 · 공허 일격)는 따로 손보는 중이라 건드리지 않는다.
// 기본 도형 금지: 모양은 들쭉날쭉한 외곽 + 짙은 테 + 밝은 면. this 는 Renderer
import { hexA } from './color.js';
import { SKILLS, CLASSES } from '../data/skills.js';

const TAU = Math.PI * 2;
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const R0 = Math.round;

// 갈래 색 (0 외곽 · 1 그늘 · 2 몸 · 3 밝은 몸 · 4 빛 · 5 심)
const CP = {
  blood: ['#1a0306', '#5a0a14', '#9c1624', '#d8323a', '#ff8a7a', '#fff0e8'],
  dust: ['#1e140a', '#4a3620', '#7c6040', '#a88c64', '#cdb890', '#efe4cc'],
  gold: ['#2a1a04', '#7a5410', '#c8961e', '#f4c83a', '#fff0a0', '#ffffff'],
  steel: ['#0c1420', '#2a3a52', '#5a7090', '#a8bcd8', '#e4eeff', '#ffffff'],
  rage: ['#140404', '#4a0806', '#8e140a', '#e0381a', '#ff9a4a', '#fff0c0'],
  iron: ['#141010', '#3a3030', '#6a5e58', '#a89a88', '#e8dcc0', '#fff8e8'],
  soul: ['#04140c', '#0e3a22', '#1e7a44', '#4ad070', '#a8ffb8', '#efffef'],
  bone: ['#1a160e', '#4a4232', '#8a7e62', '#c8bc98', '#ece4c8', '#ffffff'],
  hex: ['#0e0418', '#341048', '#62208a', '#a048d8', '#e0a0ff', '#fbefff'],
  ink: ['#000000', '#0a0810', '#1a1424', '#3a3048', '#c8c0e0', '#ffffff'],
  venom: ['#061204', '#1a3a0a', '#3a7a14', '#78c428', '#c8f080', '#f4ffd8'],
  leaf: ['#061408', '#14401a', '#2e7a2a', '#6ab83a', '#c8f08a', '#fffbe0'],
  petal: ['#1a0a14', '#6a2a4a', '#c05a8a', '#f09ac0', '#ffd8ea', '#ffffff'],
  feather: ['#10140a', '#3a4428', '#7a8458', '#c8c8a0', '#f0f0d8', '#ffffff'],
  scale: ['#1a0604', '#5a1408', '#a8300e', '#e86a1e', '#ffb04a', '#fff0b0'],
  rune: ['#1a0e02', '#6a3a08', '#c87a10', '#ffb820', '#ffe890', '#ffffff'],
  fire: ['#2a0804', '#7a1c08', '#d0441a', '#ff8a2a', '#ffd25a', '#fff6d8'],
  ice: ['#0a1a34', '#1f4f86', '#3f8cd0', '#86d0f4', '#d0f4ff', '#ffffff'],
  bolt: ['#14143a', '#3a3a9a', '#7a7ae8', '#e8e870', '#fffbb0', '#ffffff'],
};

// 갈래 → 그림 종류 · 색
export const CLASS_LOOK = {
  predator: { draw: 'claw', pal: 'blood', name: '핏빛 발톱 세 줄 · 잇자국 · 핏방울' },
  behemoth: { draw: 'dust', pal: 'dust', name: '굴러가는 흙먼지 · 흙덩이 · 발굽 자국' },
  elementalist: { draw: 'elem', pal: 'fire', name: '불 = 불꽃 혀 · 연기 / 얼음 = 서리꽃 / 번개 = 갈래 번개' },
  guardian: { draw: 'crest', pal: 'gold', name: '금빛 방패 문장 · 깃발 천' },
  greatsword: { draw: 'cleave', pal: 'steel', name: '긴 칼자국 잔상 · 압력 줄 · 바닥 긁힘' },
  berserker: { draw: 'rage', pal: 'rage', name: '피어오르는 붉은 김 · 핏조각 · 도끼 쪼갬' },
  thrower: { draw: 'iron', pal: 'iron', name: '쇠 불똥 · 나뭇조각 · 쪼개진 땅' },
  necromancer: { draw: 'soul', pal: 'soul', name: '녹색 혼불 · 뼈 조각 · 솟는 해골 손' },
  hexer: { draw: 'hex', pal: 'hex', name: '떠도는 저주 글자 · 흐르는 먹물 방울' },
  shadowblade: { draw: 'ink', pal: 'ink', name: '먹물 번짐 · 칼빛 한 줄 · 연기 꼬리' },
  venomHunter: { draw: 'venom', pal: 'venom', name: '끓는 독 거품 · 독 방울 · 독 연기' },
  spiritcaller: { draw: 'bloom', pal: 'petal', name: '꽃잎 · 나뭇잎 소용돌이 · 빛 방울' },
  ranger: { draw: 'feather', pal: 'feather', name: '깃털 · 바람결' },
  dragoon: { draw: 'scale', pal: 'scale', name: '비늘 조각 · 불 날개 그림자 · 불티' },
  dragonSage: { draw: 'word', pal: 'rune', name: '불로 쓰는 용의 글자 · 타고 남은 연기' },
  wild: { draw: 'rubble', pal: 'dust', name: '들썩이며 기우는 깨진 땅 판 · 돌 부스러기 (야수 각인)' },
};
// 가시를 정말 쓰는 스킬 (가시는 이것들만) + 시공 스킬(다른 작업 중 · 그대로 둔다)
export const KEEP_SPIKE = new Set(['glacialSpikes', 'absoluteZero', 'iceComet', 'blizzard', 'vineSnare', 'timeStop', 'singularity', 'gravityCollapse']);
const HANDS_OFF = new Set(['timeStop', 'slowField', 'singularity', 'gravityCollapse', 'blinkBlast', 'rewind', 'arcaneBarrage', 'hVoidStrike']);
const SPIKY = /thorn|spike|spine|vine|bramble|caltrop|icicle|glacier|bone/i;

const CLS_OF = {};
for (const [c, d] of Object.entries(CLASSES)) for (const s of d.skills) CLS_OF[s] = c;
const ELEM_CLS = { fire: 'elementalist', ice: 'elementalist', frost: 'elementalist', lightning: 'elementalist', shock: 'elementalist', dark: 'hexer', curse: 'hexer', poison: 'venomHunter', holy: 'guardian', nature: 'spiritcaller', wind: 'ranger', blood: 'predator' };
// 갈래가 없는 각인 스킬(몬스터 · 장비 각인)은 성질로 · 그것도 없으면 야수(깨진 땅 판)
export function skillClass(sk) { const d = SKILLS[sk]; if (!d) return null; return d.cls || CLS_OF[sk] || ELEM_CLS[d.elem] || 'wild'; }
export function keepsSpike(sk) { return !sk || KEEP_SPIKE.has(sk) || SPIKY.test(sk) || HANDS_OFF.has(sk) || skillClass(sk) === 'chronomancer'; }
const elemOf = (sk, ev) => { const e = ev?.elem || SKILLS[sk]?.elem || SKILLS[sk]?.scale; return e === 'ice' || e === 'frost' ? 'ice' : e === 'lightning' || e === 'shock' || e === 'bolt' ? 'bolt' : 'fire'; };
// 색 이름(origfx · skfx 의 pal) → 갈래 (스킬 id 를 모를 때)
const PAL_CLS = { earth: 'behemoth', lava: 'dragoon', curse: 'hexer', blood: 'predator', ink: 'ink', shadow: 'shadowblade', metal: 'thrower', petal: 'spiritcaller', wind: 'ranger', holy: 'guardian', fire: 'dragoon', poison: 'venomHunter', bone: 'necromancer' };
export const palClass = (pal) => (pal === 'ink' ? 'shadowblade' : PAL_CLS[pal] || 'behemoth');

// ───── 모양 도우미 ─────
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(R0(x), R0(y)) : g.moveTo(R0(x), R0(y)))); g.closePath(); }
function lumpy(x, y, r, n, seed, sq = 0.6) { const rr = rnd(seed), pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU, d = r * (0.6 + rr() * 0.55); pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * sq]); } return pts; }
// 짙은 테 → 몸 → 밝은 면 (같은 외곽을 줄여 겹친다)
function shape(g, pts, P, al, hi = true) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  g.fillStyle = hexA(P[0], al); poly(g, pts.map(([x, y]) => [cx + (x - cx) * 1.18, cy + (y - cy) * 1.18])); g.fill();
  g.fillStyle = hexA(P[2], al); poly(g, pts); g.fill();
  if (hi) { g.fillStyle = hexA(P[4], al * 0.9); poly(g, pts.map(([x, y]) => [cx + (x - cx) * 0.45 - 1, cy + (y - cy) * 0.45 - 1])); g.fill(); }
}
// 가늘어지는 휜 줄 (발톱 · 칼자국 · 바람결): a0 에서 a1 까지 휘어 가며 두께 w
function gash(g, x, y, ang, L, w, bend, P, al, outline = true) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, N = 9, top = [], bot = [];
  for (let i = 0; i <= N; i++) { const u = i / N, b = Math.sin(u * Math.PI) * bend, ww = Math.sin(u * Math.PI) ** 0.7 * w, px = x + ux * L * (u - 0.5) + nx * b, py = y + uy * L * (u - 0.5) + ny * b; top.push([px + nx * ww, py + ny * ww]); bot.push([px - nx * ww * 0.5, py - ny * ww * 0.5]); }
  const pts = top.concat(bot.reverse());
  if (outline) { g.strokeStyle = hexA(P[0], al); g.lineWidth = 2; poly(g, pts); g.stroke(); }
  g.fillStyle = hexA(P[3], al); poly(g, pts); g.fill();
  g.fillStyle = hexA(P[5], al * 0.9); poly(g, top.slice(2, N - 1).concat(top.slice(2, N - 1).reverse().map(([px, py]) => [px - nx * w * 0.35, py - ny * w * 0.35]))); g.fill();
}
const ease = (k) => 1 - (1 - k) ** 3;
const fade = (k, a = 0.6) => (k < a ? 1 : 1 - (k - a) / (1 - a));

// ───── 그림 (anims 에 붙는다) ─────
export const CLASS_DRAW = {
  clsFx(R, g, a, k) { const f = DRAWS[a.draw]; if (f) { g.save(); f(R, g, a, k, CP[a.pal] || CP.dust); g.restore(); } },
};
export const CLASS_DUR = { clsFx: 0.7 };

const DRAWS = {
  // 포식자: 사선으로 긋는 발톱 세 줄(앞에서 뒤로 차례로) · 한 점엔 위아래 이빨이 닫히는 잇자국
  claw(R, g, a, k, P) {
    const al = fade(k, 0.45), L = Math.min(44, a.r * 1.3);
    if (a.bite) { // 잇자국: 위 · 아래 턱이 닫힌다
      const c = ease(Math.min(1, k / 0.18)), gap = (1 - c) * 10 + 1;
      for (const s of [-1, 1]) { const pts = [[a.x - 13, a.y + s * (gap + 5)]]; for (let i = 0; i <= 6; i++) { const x = a.x - 12 + i * 4; pts.push([x, a.y + s * gap], [x + 2, a.y + s * (gap - 5 - (i % 2) * 2)]); } pts.push([a.x + 14, a.y + s * (gap + 5)]); shape(g, pts, P, al, false); }
      return;
    }
    for (let i = 0; i < 3; i++) {
      const d = Math.min(1, Math.max(0, (k - i * 0.05) / 0.14)); if (d <= 0) continue;
      const o = (i - 1) * (5 + a.tier), nx = -Math.sin(a.ang), ny = Math.cos(a.ang);
      gash(g, a.x + nx * o, a.y + ny * o * 0.7, a.ang + 0.9, L * ease(d), 2.4 + a.tier * 0.3, 5, P, al);
    }
  },
  // 대지 거수: 땅을 타고 굴러가는 흙먼지 덩이(바깥으로 · 낮게) + 땅의 발굽 자국
  dust(R, g, a, k, P) {
    const rr = rnd(a.seed), n = 7 + a.tier * 2, al = fade(k, 0.35);
    if (a.land) for (let i = 0; i < 2 + (a.tier >> 1); i++) { // 발굽 자국: 갈라진 말굽 둘
      const an = rr() * TAU, d = a.r * 0.35 * rr(), x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d * 0.5;
      for (const s of [-1, 1]) { g.fillStyle = hexA(P[0], 0.7 * al); poly(g, [[x + s * 1, y - 3], [x + s * 5, y - 2], [x + s * 6, y + 2], [x + s * 3, y + 3], [x + s * 1, y + 1]]); g.fill(); }
    }
    for (let i = 0; i < n; i++) {
      const an = (a.dir != null ? a.dir + (rr() - 0.5) * 1.6 : rr() * TAU), sp = a.r * (0.5 + rr() * 0.7), kk = ease(k), x = a.x + Math.cos(an) * sp * kk, y = a.y + Math.sin(an) * sp * kk * 0.5 - kk * 6 * rr();
      const s = (4 + rr() * 5) * (0.6 + kk * 0.9) * (0.8 + a.tier * 0.1);
      shape(g, lumpy(x, y, s, 8, a.seed + i, 0.7), P, al * (0.9 - k * 0.4), k < 0.4);
    }
  },
  // 원소술사: 성질마다 다른 형태
  elem(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.5);
    if (a.el === 'ice') { // 서리꽃: 여섯 팔 결정이 피어난다 (팔마다 곁가지)
      const c = ease(Math.min(1, k / 0.3)), n = 1 + (a.tier >> 1);
      for (let j = 0; j < n; j++) {
        const cx = a.x + (j ? (rr() - 0.5) * a.r : 0), cy = a.y + (j ? (rr() - 0.5) * a.r * 0.5 : 0), s = (j ? 7 : 11 + a.tier) * c;
        for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + a.seed, ux = Math.cos(an), uy = Math.sin(an) * 0.6;
          const arm = [[cx - uy * 1.6, cy + ux * 1.6], [cx + ux * s, cy + uy * s], [cx + uy * 1.6, cy - ux * 1.6]]; shape(g, arm, P, al, false);
          const bx = cx + ux * s * 0.55, by = cy + uy * s * 0.55; for (const t of [-1, 1]) { const b2 = an + t * 0.9; poly(g, [[bx, by], [bx + Math.cos(b2) * s * 0.35, by + Math.sin(b2) * s * 0.35 * 0.6], [bx + ux * 2, by + uy * 2]]); g.fillStyle = hexA(P[4], al); g.fill(); } }
        g.fillStyle = hexA(P[5], al); g.fillRect(R0(cx) - 1, R0(cy) - 1, 2, 2);
      }
      return;
    }
    if (a.el === 'bolt') { // 갈래 번개: 가운데서 땅을 타고 뻗는 지그재그 (가지 둘씩)
      const r2 = rnd(a.seed + Math.floor(k * 14)); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'miter';
      for (let i = 0; i < 4 + a.tier; i++) {
        let an = (i / (4 + a.tier)) * TAU + r2() * 0.4, x = a.x, y = a.y; const pts = [[x, y]];
        for (let j = 0; j < 5; j++) { an += (r2() - 0.5) * 1.2; const L = a.r * 0.22; x += Math.cos(an) * L; y += Math.sin(an) * L * 0.55; pts.push([x, y]); }
        for (const [w, c, aa] of [[3, P[2], 0.5], [1, P[5], 1]]) { g.strokeStyle = hexA(c, aa * al); g.lineWidth = w; g.beginPath(); pts.forEach(([px, py], q) => (q ? g.lineTo(R0(px), R0(py)) : g.moveTo(R0(px), R0(py)))); g.stroke(); }
        const [bx, by] = pts[2]; g.strokeStyle = hexA(P[4], 0.7 * al); g.lineWidth = 1; g.beginPath(); g.moveTo(R0(bx), R0(by)); g.lineTo(R0(bx + (r2() - 0.5) * 14), R0(by + (r2() - 0.5) * 8)); g.stroke();
      }
      return;
    }
    // 불꽃 혀: 바닥에서 흔들리며 솟는 혀 여럿 (위로 갈수록 가늘고 밝다)
    const n = 5 + a.tier * 2;
    for (let i = 0; i < n; i++) {
      const an = rr() * TAU, d = Math.sqrt(rr()) * a.r * 0.8, x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d * 0.5;
      const h = (10 + rr() * 12) * (0.6 + a.tier * 0.12) * Math.sin(Math.min(1, k * 1.4) * Math.PI) , w = 3 + rr() * 3, sw = Math.sin(a.t * 18 + i) * 3;
      if (h < 1) continue;
      shape(g, [[x - w, y], [x - w * 0.6, y - h * 0.4], [x + sw, y - h], [x + w * 0.6, y - h * 0.45], [x + w, y]], i % 3 ? P : CP.rage, 0.95, true);
    }
  },
  // 수호기사: 금빛 방패 문장이 땅에 찍히고(납작) 위로 같은 문장이 떠올라 빛난다 · 양옆에 깃발 천
  crest(R, g, a, k, P) {
    const c = ease(Math.min(1, k / 0.2)), al = fade(k, 0.55), s = (5 + a.tier) * (0.6 + c * 0.4);
    const shield = (x, y, s, sq) => [[x - s, y - s * sq], [x + s, y - s * sq], [x + s, y + s * 0.2 * sq], [x + s * 0.5, y + s * 0.8 * sq], [x, y + s * 1.1 * sq], [x - s * 0.5, y + s * 0.8 * sq], [x - s, y + s * 0.2 * sq]];
    if (a.land) shape(g, shield(a.x, a.y, s * 1.4, 0.45), P, al * 0.4, false);
    const y = a.y - 14 - k * 10; shape(g, shield(a.x, y, s, 1), P, al, false);
    g.fillStyle = hexA(P[5], al); g.fillRect(R0(a.x) - 1, R0(y - s * 0.7), 2, R0(s * 1.5)); g.fillRect(R0(a.x - s * 0.55), R0(y - s * 0.2), R0(s * 1.1), 2); // 십자 문장
    if (a.tier >= 3) for (const sd of [-1, 1]) { // 깃발 천: 펄럭이는 띠
      const bx = a.x + sd * (s + 6), pts = []; for (let i = 0; i <= 5; i++) pts.push([bx + sd * i * 3, y - s + Math.sin(a.t * 10 + i) * 2 + i]); for (let i = 5; i >= 0; i--) pts.push([bx + sd * i * 3, y - s + 7 + Math.sin(a.t * 10 + i) * 2 + i * 1.6]);
      shape(g, pts, CP.blood, al * 0.9, false);
    }
  },
  // 대검술사: 길고 두꺼운 칼자국 하나 + 뒤로 처지는 잔상 둘 · 앞으로 밀려 나가는 압력 줄 · 땅을 긁은 자국
  cleave(R, g, a, k, P) {
    const al = fade(k, 0.3), L = Math.min(70, a.r * 2), sw = ease(Math.min(1, k / 0.12));
    if (a.land) { g.fillStyle = hexA('#140e08', 0.55 * fade(k, 0.6)); for (let i = 0; i < 3; i++) { const o = (i - 1) * 4; poly(g, [[a.x - L * 0.4, a.y + 6 + o], [a.x + L * 0.4, a.y + 4 + o * 0.6], [a.x + L * 0.38, a.y + 6 + o * 0.6], [a.x - L * 0.36, a.y + 7 + o]]); g.fill(); } }
    for (let i = 2; i >= 0; i--) gash(g, a.x - Math.cos(a.ang) * i * 4, a.y - Math.sin(a.ang) * i * 3, a.ang + Math.PI / 2 + i * 0.15, L * sw, (4 + a.tier * 0.6) * (1 - i * 0.25), 10, P, al * (1 - i * 0.3), i === 0);
    const push = ease(k) * a.r * 1.2; g.fillStyle = hexA(P[4], 0.6 * al); // 압력 줄
    for (let i = 0; i < 5; i++) { const o = (i - 2) * 6, nx = -Math.sin(a.ang), ny = Math.cos(a.ang), x = a.x + Math.cos(a.ang) * push + nx * o, y = a.y + Math.sin(a.ang) * push + ny * o; poly(g, [[x, y], [x - Math.cos(a.ang) * 12 + nx, y - Math.sin(a.ang) * 12 + ny], [x - Math.cos(a.ang) * 12 - nx, y - Math.sin(a.ang) * 12 - ny]]); g.fill(); }
  },
  // 광전사: 맞은 자리에서 붉은 김이 혀처럼 솟고 · 도끼가 쪼갠 V 자 틈
  rage(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.4);
    if (a.land) { const s = 8 + a.tier * 2; g.fillStyle = hexA(P[0], 0.8 * al); poly(g, [[a.x - s, a.y - 2], [a.x - 1, a.y + 3], [a.x + s, a.y - 3], [a.x + 1, a.y + 6]]); g.fill(); g.fillStyle = hexA(P[3], 0.8 * al); g.fillRect(R0(a.x) - 1, R0(a.y + 1), 2, 2); }
    for (let i = 0; i < 4 + a.tier; i++) { const x = a.x + (rr() - 0.5) * a.r, y = a.y + (rr() - 0.5) * a.r * 0.4, h = (12 + rr() * 14) * ease(k), w = 2 + rr() * 2, sw = Math.sin(a.t * 9 + i * 2) * 4;
      shape(g, [[x - w, y], [x + sw * 0.5 - w * 1.1, y - h * 0.5], [x + sw - w * 1.2, y - h * 0.9], [x + sw - w * 0.3, y - h], [x + sw + w * 0.6, y - h * 0.85], [x + sw * 0.5 + w * 1.1, y - h * 0.5], [x + w, y]], P, al * 0.85, false); } // 뭉툭한 김 덩이 (뾰족한 가시처럼 보이지 않게)
  },
  // 투척 전사: 땅이 쪼개진 틈 + 회전하며 날아가는 도끼 실루엣의 잔상
  iron(R, g, a, k, P) {
    const al = fade(k, 0.4);
    if (a.land) { const s = 10 + a.tier * 2, ang = a.ang ?? 0, ux = Math.cos(ang + 1.4), uy = Math.sin(ang + 1.4) * 0.5; g.fillStyle = hexA(P[0], 0.8 * al); poly(g, [[a.x - ux * s, a.y - uy * s], [a.x + uy * 3, a.y - ux * 2], [a.x + ux * s, a.y + uy * s], [a.x - uy * 3, a.y + ux * 2]]); g.fill(); }
    const sp = a.t * 26; for (let i = 0; i < 3; i++) { const t = sp - i * 0.5, x = a.x + Math.cos(a.ang ?? 0) * k * 30, y = a.y - 10 - k * 8; // 도끼 머리
      const c = Math.cos(t), s = Math.sin(t), pt = (u, v) => [x + u * c - v * s, y + u * s + v * c];
      shape(g, [pt(-1, -7), pt(1, -7), pt(1, -2), pt(7, -5), pt(8, 1), pt(7, 6), pt(1, 3), pt(1, 7), pt(-1, 7)], P, al * (1 - i * 0.35), i === 0); }
  },
  // 사령술사: 녹색 혼불이 흔들리며 오르고 · 가운데 땅에서 해골 손이 솟아 움켜쥔다
  soul(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.5);
    if (a.land && a.hand) { const up = Math.sin(Math.min(1, k * 1.3) * Math.PI) * (12 + a.tier * 2), x = a.x, y = a.y, B = CP.bone;
      shape(g, [[x - 3, y], [x - 3, y - up * 0.6], [x + 3, y - up * 0.6], [x + 3, y]], B, al, false); // 팔뼈
      for (let f = 0; f < 4; f++) { const fx = x - 5 + f * 3.3, curl = k > 0.4 ? (k - 0.4) * 6 : 0; shape(g, [[fx - 1, y - up * 0.6], [fx - 1 + curl, y - up], [fx + 1 + curl, y - up], [fx + 1, y - up * 0.6]], B, al, false); }
    }
    for (let i = 0; i < 4 + a.tier; i++) { // 혼불: 꼬리 달린 불꽃 (물방울 모양 + 흔들리는 꼬리)
      const x = a.x + (rr() - 0.5) * a.r * 1.2 + Math.sin(a.t * 6 + i) * 3, y = a.y + (rr() - 0.5) * a.r * 0.5 - ease(k) * (16 + rr() * 16), s = 2.5 + rr() * 2 + a.tier * 0.3;
      shape(g, [[x - s, y], [x - s * 0.7, y - s * 0.8], [x + Math.sin(a.t * 12 + i) * s, y - s * 2.8], [x + s * 0.7, y - s * 0.8], [x + s, y], [x, y + s * 0.9]], P, al * 0.9, true);
    }
  },
  // 저주술사: 각진 저주 글자가 둘레를 돌며 떠오르고 아래로 먹물 방울을 떨군다
  hex(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.5), n = 3 + (a.tier >> 1);
    g.lineCap = 'square';
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + a.t * 2, rad = a.r * 0.5 + 8, x = a.x + Math.cos(an) * rad, y = a.y + Math.sin(an) * rad * 0.45 - 10 - k * 10, s = 5 + a.tier * 0.6;
      const strokes = [[[0, -1], [0, 1]], [[-0.7, -0.6], [0.7, 0.2]], [[-0.6, 0.6], [0.4, -0.1]], [[0.6, -1], [0.1, -0.4]]].slice(0, 2 + (((a.seed >> i) & 3) % 3));
      for (const [w, c] of [[3, P[0]], [1.2, P[4]]]) { g.strokeStyle = hexA(c, al); g.lineWidth = w; g.beginPath(); for (const [[x0, y0], [x1, y1]] of strokes) { g.moveTo(R0(x + x0 * s), R0(y + y0 * s)); g.lineTo(R0(x + x1 * s), R0(y + y1 * s)); } g.stroke(); }
      const dy = ((a.t * 40 + i * 9) % 18); g.fillStyle = hexA(P[2], al); g.fillRect(R0(x), R0(y + s + dy), 1, 2);
    }
  },
  // 그림자: 먹물이 번졌다 오그라든다 + 칼빛 한 줄
  ink(R, g, a, k, P) {
    const grow = k < 0.3 ? ease(k / 0.3) : 1 - (k - 0.3) / 0.7 * 0.8, al = fade(k, 0.5), rr = rnd(a.seed);
    if (a.land) { const s = (8 + a.tier * 2) * grow; g.fillStyle = hexA(P[0], 0.75 * al); poly(g, lumpy(a.x, a.y + 2, s, 12, a.seed, 0.5)); g.fill();
      for (let i = 0; i < 5; i++) { const an = rr() * TAU, d = s * (1.1 + rr() * 0.6); g.fillRect(R0(a.x + Math.cos(an) * d), R0(a.y + 2 + Math.sin(an) * d * 0.5), 2, 1); } }
    if (k < 0.25) { const c = k / 0.25, L = a.r * 1.6 * ease(c); g.fillStyle = hexA('#ffffff', 1 - c * 0.5); const ang = a.ang + 0.6, ux = Math.cos(ang), uy = Math.sin(ang);
      poly(g, [[a.x - ux * L * 0.5, a.y - 8 - uy * L * 0.5], [a.x + uy * 1.5, a.y - 8 - ux * 1.5], [a.x + ux * L * 0.5, a.y - 8 + uy * L * 0.5], [a.x - uy * 0.5, a.y - 8 + ux * 0.5]]); g.fill(); }
  },
  // 독침 사냥꾼: 땅에서 독 거품이 부풀어 터지고 독 방울이 떨어진다 (거품은 원래 둥글다)
  venom(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.5);
    if (a.land) { g.fillStyle = hexA(P[1], 0.6 * al); poly(g, lumpy(a.x, a.y + 2, a.r * 0.55, 11, a.seed, 0.45)); g.fill(); }
    for (let i = 0; i < 5 + a.tier * 2; i++) { const life = (k * 2.2 + rr()) % 1, x = a.x + (rr() - 0.5) * a.r, y = a.y + (rr() - 0.5) * a.r * 0.4 - life * 4, s = 1 + life * (2 + rr() * 2);
      if (life > 0.9) { g.fillStyle = hexA(P[4], al); for (let q = 0; q < 4; q++) g.fillRect(R0(x + Math.cos(q * 1.6) * s * 1.6), R0(y + Math.sin(q * 1.6) * s), 1, 1); continue; }
      g.strokeStyle = hexA(P[0], al); g.lineWidth = 1; g.fillStyle = hexA(P[3], al * 0.8); g.beginPath(); g.arc(R0(x), R0(y), s, 0, TAU); g.fill(); g.stroke(); g.fillStyle = hexA(P[5], al); g.fillRect(R0(x - s * 0.4), R0(y - s * 0.5), 1, 1); }
  },
  // 정령사 · 숲: 꽃잎과 나뭇잎이 나선으로 감돌며 퍼진다 + 빛 방울
  bloom(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.5), n = 7 + a.tier * 2;
    for (let i = 0; i < n; i++) { const leaf = i % 3 === 0, an = rr() * TAU + k * 4, d = (a.r * 0.3 + rr() * a.r * 0.6) * (0.3 + ease(k)), x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d * 0.5 - 6 - k * 10, rot = a.t * 6 + i, s = 3 + rr() * 2;
      const c = Math.cos(rot), sn = Math.sin(rot), pt = (u, v) => [x + u * c - v * sn, y + (u * sn + v * c) * 0.7];
      shape(g, leaf ? [pt(-s, 0), pt(0, -s * 0.5), pt(s * 1.2, 0), pt(0, s * 0.5)] : [pt(-s * 0.6, 0), pt(-s * 0.2, -s * 0.6), pt(s * 0.7, -s * 0.2), pt(s * 0.5, s * 0.4), pt(-s * 0.2, s * 0.5)], leaf ? CP.leaf : P, al, false); }
    g.fillStyle = hexA('#fffbd0', al); for (let i = 0; i < 4 + a.tier; i++) g.fillRect(R0(a.x + (rr() - 0.5) * a.r), R0(a.y - rr() * 24 - k * 12), 1, 1);
  },
  // 숲의 사수: 깃털이 흩날리고 바람결이 지나간다
  feather(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.45);
    for (let i = 0; i < 2 + (a.tier >> 1); i++) gash(g, a.x - Math.cos(a.ang) * 10 + (rr() - 0.5) * 8, a.y - 4 + (i - 1) * 7, a.ang, a.r * (1.4 + rr() * 0.6) * ease(Math.min(1, k / 0.3)), 1.4, 3 + rr() * 4, CP.ice, al * 0.6, false);
    for (let i = 0; i < 3 + a.tier; i++) { const x = a.x + (rr() - 0.5) * a.r + Math.sin(a.t * 5 + i) * 4, y = a.y - 4 - rr() * 10 + k * 14, rot = Math.sin(a.t * 4 + i) * 0.8 + 0.4, s = 4 + rr() * 2, c = Math.cos(rot), sn = Math.sin(rot), pt = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
      shape(g, [pt(-s, 0), pt(-s * 0.2, -1.6), pt(s, -0.6), pt(s, 0.6), pt(-s * 0.2, 1.6)], P, al, false); g.fillStyle = hexA(P[0], al); const [qx, qy] = pt(-s - 2, 0); g.fillRect(R0(qx), R0(qy), 2, 1); }
  },
  // 화룡 전사: 땅에 펼쳐지는 불 날개 그림자 · 튀는 비늘 조각
  scale(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.5), sp = ease(Math.min(1, k / 0.35));
    if (a.land && a.tier >= 2) for (const s of [-1, 1]) { const w = (a.r * 0.8 + 10) * sp, x = a.x, y = a.y + 2, pts = [[x, y]]; for (let i = 0; i <= 4; i++) { const u = i / 4; pts.push([x + s * w * u, y - w * 0.35 * Math.sin(u * 2.4) + (i % 2) * 3]); } pts.push([x + s * w * 0.4, y + 4]);
      g.fillStyle = hexA('#1a0604', 0.45 * al); poly(g, pts); g.fill(); g.fillStyle = hexA(P[3], 0.5 * al); for (let i = 1; i <= 4; i++) { const [px, py] = pts[i]; g.fillRect(R0(px), R0(py), 2, 1); } }
    for (let i = 0; i < 4 + a.tier * 2; i++) { const an = rr() * TAU, d = a.r * (0.2 + rr() * 0.6) * sp, x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d * 0.5 - 8 + k * k * 10, flip = Math.cos(a.t * 14 + i), s = 3 + rr() * 1.5;
      shape(g, [[x - s * flip, y - s * 0.3], [x, y - s], [x + s * flip, y - s * 0.3], [x + s * 0.6 * flip, y + s * 0.6], [x, y + s * 0.9], [x - s * 0.6 * flip, y + s * 0.6]], P, al, true); }
  },
  // 야수 각인: 땅 판이 깨져 들썩이며 기울었다 가라앉는다 (가시처럼 솟지 않고 넓적하게 · 틈은 어둡게)
  rubble(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.55), up = Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.6) * 1.5), n = 4 + a.tier;
    if (a.land) { g.fillStyle = hexA('#120c06', 0.6 * al); poly(g, lumpy(a.x, a.y, a.r * 0.6, 12, a.seed + 3, 0.5)); g.fill(); }
    const slabs = []; for (let i = 0; i < n; i++) { const an = (i / n) * TAU + rr() * 0.5, d = a.r * (0.25 + rr() * 0.35); slabs.push({ x: a.x + Math.cos(an) * d, y: a.y + Math.sin(an) * d * 0.5, an, w: 5 + rr() * 4 + a.tier, tilt: (rr() - 0.5) * 0.35, h: (4 + rr() * 5) * up }); }
    slabs.sort((p, q) => p.y - q.y);
    for (const b of slabs) { const ox = Math.cos(b.an) * b.h * 0.5, x = b.x + ox, y = b.y - b.h, w = b.w, t = b.tilt * w;
      // 두꺼운 돌판: 윗면은 거의 평평하고(뾰족한 꼭짓점 없이) 옆면이 두껍게 보인다 · 판 둘레에 돌 부스러기
      const th = 7 + (a.tier >> 1);
      g.fillStyle = hexA(P[0], al); poly(g, [[x - w - 1, y + t], [x - w * 0.6, y - 2 + t * 0.6], [x + w * 0.6, y - 2 - t * 0.6], [x + w + 1, y - t], [x + w + 1, y - t + th + 1], [x - w - 1, y + t + th + 1]]); g.fill();
      g.fillStyle = hexA(P[1] || P[0], al); poly(g, [[x - w, y + t + 2], [x + w, y - t + 2], [x + w, y - t + th], [x - w, y + t + th]]); g.fill(); // 옆면 (어둡게)
      g.fillStyle = hexA(P[2], al); poly(g, [[x - w, y + t], [x - w * 0.6, y - 1 + t * 0.6], [x + w * 0.6, y - 1 - t * 0.6], [x + w, y - t], [x + w, y - t + 2], [x - w, y + t + 2]]); g.fill(); // 윗면
      g.fillStyle = hexA(P[4], al); g.fillRect(R0(x - w * 0.5), R0(y - 1 + t * 0.5), R0(w * 0.9), 1);
      for (let j = 0; j < 3; j++) { const px = x + (rr() - 0.5) * w * 2.6, py = y + th + 1 + rr() * 3, s2 = rr() < 0.4 ? 2 : 1; g.fillStyle = hexA(P[0], al); g.fillRect(R0(px) - 1, R0(py) - 1, s2 + 2, s2 + 1); g.fillStyle = hexA(P[3], al); g.fillRect(R0(px), R0(py) - 1, s2, s2); } }
  },
  // 용언 술사: 한 획씩 그려지는 용의 글자(불빛) → 타서 연기로
  word(R, g, a, k, P) {
    const rr = rnd(a.seed), al = fade(k, 0.6), s = 10 + a.tier * 2, x = a.x, y = a.y - 22, n = 5;
    const strokes = []; for (let i = 0; i < n; i++) strokes.push([[(rr() - 0.5) * 2, (rr() - 0.5) * 2], [(rr() - 0.5) * 2, (rr() - 0.5) * 2]]);
    const shown = Math.min(n, k * n * 3); g.lineCap = 'square';
    for (const [w, c] of [[4, P[0]], [2, P[3]], [1, P[5]]]) { g.strokeStyle = hexA(c, al); g.lineWidth = w; g.beginPath();
      strokes.forEach(([[x0, y0], [x1, y1]], i) => { if (i >= shown) return; const u = Math.min(1, shown - i); g.moveTo(R0(x + x0 * s), R0(y + y0 * s * 0.8)); g.lineTo(R0(x + (x0 + (x1 - x0) * u) * s), R0(y + (y0 + (y1 - y0) * u) * s * 0.8)); }); g.stroke(); }
  },
};

// ───── 사건 → 갈래 그림 ─────
const CLS_CAP = 12;
function landAt(w, x, y) { return !w?.wallAt?.(x, y) && !w?.solid?.(x, y); }
// 맞는 순간 하나 (가시 자리 대신 · 범용 사건 위에): cls 갈래 · 자리 · 크기 · 방향 · 등급
export function classHit(R, w, cls, x, y, r, o = {}) {
  const L = CLASS_LOOK[cls]; if (!L) return false;
  const tier = Math.max(1, Math.min(5, o.tier || 2)), land = landAt(w, x, y), ang = o.ang ?? (w?.player ? Math.atan2(y - w.player.y, x - w.player.x) : 0);
  const a = { x, y, r: Math.max(12, Math.min(70, r)), draw: L.draw, pal: L.pal, tier, ang, land, el: o.el, bite: o.bite, hand: o.hand, dir: o.dir, max: o.max || 0.55 + tier * 0.06 };
  const AL = R.anims.list; let n = 0; for (let i = AL.length - 1; i >= 0; i--) if (AL[i].type === 'clsFx' && ++n >= CLS_CAP) { AL.splice(i, 1); break; } // 렉 줄이기: 갈래 그림은 한꺼번에 CLS_CAP 개까지 (오래된 것부터 버린다)
  R.anims.add('clsFx', a);
  burstParts(R, cls, x, y, a.r, tier, ang, o.el);
  return true;
}
// 갈래마다 다르게 튀는 조각 (핏방울 · 흙덩이 · 불똥 · 뼈 · 꽃잎 …)
function burstParts(R, cls, x, y, r, tier, ang, el) {
  const P = R.parts, n = 4 + tier * 2, rnd1 = Math.random;
  const push = (o) => P.push(o);
  for (let i = 0; i < n; i++) {
    const an = rnd1() * TAU, v = 30 + rnd1() * 60 * (0.6 + tier * 0.15), dx = Math.cos(an) * v, dy = Math.sin(an) * v * 0.6;
    switch (cls) {
      case 'predator': push({ x, y: y - 6, vx: Math.cos(ang) * 80 + dx * 0.6, vy: dy * 0.6 - 50, t: 0.6, max: 0.6, color: i % 3 ? '#a8162a' : '#e04a4a', g: 320, chunk: true, floor: y + 4 + dy * 0.05 }); break;
      case 'behemoth': push({ x, y: y - 2, vx: dx, vy: -40 - rnd1() * 70, t: 0.7, max: 0.7, color: i % 2 ? '#6a4e30' : '#8a6c48', g: 340, chunk: true, floor: y + 3 + dy * 0.06 }); if (i % 2) push({ x: x + dx * 0.2, y: y + 2, vx: dx * 0.8, vy: dy * 0.2, t: 1.1, max: 1.1, color: '#a88c64', puff: true, size: 4, g: 0 }); break;
      case 'elementalist': if (el === 'ice') push({ x, y: y - 6, vx: dx, vy: dy - 30, t: 0.8, max: 0.8, color: i % 2 ? '#e8f8ff' : '#86d0f4', g: 80, glow: true, size: 1 });
        else if (el === 'bolt') push({ x, y: y - 4, vx: dx * 2, vy: dy * 2, t: 0.25, max: 0.25, color: '#fffbb0', line: true, g: 0 });
        else { push({ x, y: y - 4, vx: dx * 0.5, vy: -30 - rnd1() * 30, t: 0.8, max: 0.8, color: '#ffb040', g: -20, glow: true, size: 1 }); if (i % 2) push({ x, y: y - 10, vx: dx * 0.2, vy: -20, t: 1.3, max: 1.3, color: '#3a3034', puff: true, size: 4, g: 0 }); } break;
      case 'guardian': push({ x, y: y - 12, vx: dx * 0.5, vy: -20 - rnd1() * 30, t: 0.9, max: 0.9, color: i % 2 ? '#fff0a0' : '#f4c83a', g: -10, glow: true, size: 1 }); break;
      case 'greatsword': push({ x, y: y - 6, vx: Math.cos(ang) * 160 + dx * 0.4, vy: Math.sin(ang) * 100 + dy * 0.4, t: 0.25, max: 0.25, color: '#e4eeff', line: true, g: 0 }); if (i % 3 === 0) push({ x, y: y + 4, vx: dx * 0.5, vy: -10, t: 0.9, max: 0.9, color: '#8a7e6a', puff: true, size: 3, g: 0 }); break;
      case 'berserker': push({ x, y: y - 6, vx: dx, vy: dy - 60, t: 0.6, max: 0.6, color: i % 2 ? '#8e140a' : '#e0381a', g: 300, chunk: true, floor: y + 4 }); if (i % 2) push({ x, y: y - 6, vx: dx * 0.2, vy: -30, t: 1, max: 1, color: '#5a1010', steam: true, g: -5 }); break;
      case 'thrower': push({ x, y: y - 8, vx: dx * 1.8, vy: dy * 1.8 - 40, t: 0.3, max: 0.3, color: i % 2 ? '#ffd060' : '#fff0c0', line: true, g: 200 }); if (i % 2) push({ x, y: y - 4, vx: dx, vy: -60, t: 0.6, max: 0.6, color: '#7a5430', g: 320, chunk: true, floor: y + 4 }); break;
      case 'necromancer': if (i % 2) push({ x, y: y - 6, vx: dx, vy: dy - 70, t: 0.6, max: 0.6, color: '#d8ccaa', g: 320, chunk: true, floor: y + 4 }); else push({ x, y: y - 4, vx: dx * 0.3, vy: -25, t: 1.1, max: 1.1, color: '#6aff9a', g: -15, glow: true, size: 1 }); break;
      case 'hexer': push({ x, y: y - 10, vx: dx * 0.4, vy: 10 + rnd1() * 20, t: 0.9, max: 0.9, color: i % 2 ? '#62208a' : '#e0a0ff', g: 60, size: 1 }); break;
      case 'shadowblade': push({ x: x + dx * 0.1, y: y - 6, vx: dx * 0.4, vy: -10 - rnd1() * 10, t: 1, max: 1, color: '#16121e', puff: true, size: 4, g: 0 }); break;
      case 'venomHunter': push({ x, y: y - 6, vx: dx * 0.6, vy: dy - 40, t: 0.7, max: 0.7, color: '#78c428', g: 260, chunk: true, floor: y + 3 }); if (i % 2) push({ x, y: y - 4, vx: dx * 0.2, vy: -12, t: 1.4, max: 1.4, color: '#4a7a24', puff: true, size: 4, g: 0 }); break;
      case 'spiritcaller': push({ x, y: y - 8, vx: dx * 0.5, vy: -20 - rnd1() * 20, t: 1.1, max: 1.1, color: i % 2 ? '#c8f08a' : '#ffd8ea', g: -6, glow: true, size: 1 }); break;
      case 'ranger': push({ x, y: y - 6, vx: Math.cos(ang) * 120 + dx * 0.3, vy: Math.sin(ang) * 60 + dy * 0.3, t: 0.35, max: 0.35, color: '#e8f4ff', line: true, g: 0 }); break;
      case 'dragoon': push({ x, y: y - 6, vx: dx, vy: dy - 60, t: 0.7, max: 0.7, color: i % 2 ? '#e86a1e' : '#ffb04a', g: -30, glow: true, size: 1 }); break;
      case 'wild': push({ x, y: y - 3, vx: dx * 0.8, vy: -50 - rnd1() * 60, t: 0.7, max: 0.7, color: i % 2 ? '#5a4a3a' : '#8a7a62', g: 340, chunk: true, floor: y + 3 + dy * 0.05 }); if (i % 3 === 0) push({ x, y, vx: dx * 0.5, vy: -6, t: 1, max: 1, color: '#7a6e60', puff: true, size: 3, g: 0 }); break;
      case 'dragonSage': push({ x: x + (rnd1() - 0.5) * 20, y: y - 22, vx: dx * 0.2, vy: -18, t: 1.4, max: 1.4, color: i % 2 ? '#3a2a20' : '#ffb820', puff: i % 2 === 1, glow: i % 2 === 0, size: i % 2 ? 4 : 1, g: -4 }); break;
    }
  }
}

const CLS_EV = new Set(['skillAoe', 'skillCone', 'skillSingle', 'skillLine', 'buff']);
// 범용 사건 위에 그 스킬 갈래의 그림을 덧그린다 (events.js consume 이 부른다)
export function classFx(ev, w, isBig) { // 그렸으면 true (events.js 는 범용 그림을 그리지 않고 소리만 낸다)
  if (!CLS_EV.has(ev.t) || isBig || HANDS_OFF.has(ev.sk)) return false;
  const cls = skillClass(ev.sk); if (!cls || !CLASS_LOOK[cls]) return false;
  const tier = ev.tier || 2, el = cls === 'elementalist' ? elemOf(ev.sk, ev) : null, lite = ev.quiet || ev.lite;
  if (ev.t === 'skillAoe') { if (lite && tier < 3) return false; return classHit(this, w, cls, ev.x, ev.y, (ev.r || 30) * 0.8, { tier, el, hand: true }); }
  if (ev.t === 'skillSingle') return classHit(this, w, cls, ev.x, ev.y, 20, { tier, el, bite: ev.fx === 'bite' });
  if (ev.t === 'skillCone') { const d = (ev.range || 40) * 0.6; return classHit(this, w, cls, ev.x + Math.cos(ev.ang) * d, ev.y + Math.sin(ev.ang) * d * 0.8, (ev.range || 40) * 0.5, { tier, el, ang: ev.ang, dir: ev.ang }); }
  if (ev.t === 'skillLine') { const ang = Math.atan2(ev.y2 - ev.y1, ev.x2 - ev.x1); let ok = false; for (const u of [0.45, 1]) ok = classHit(this, w, cls, ev.x1 + (ev.x2 - ev.x1) * u, ev.y1 + (ev.y2 - ev.y1) * u, (ev.w || 20), { tier: u < 1 ? Math.max(1, tier - 1) : tier, el, ang, dir: ang }) || ok; return ok; }
  if (ev.t === 'buff') return classHit(this, w, cls, ev.x, ev.y, 18, { tier: Math.max(1, tier - 1), el, max: 0.8 });
  return false;
}

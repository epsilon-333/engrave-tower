// 3막: 빛이 흐려지고 · 네 컷의 전쟁 · 재의 계절 · 마지막 왕 · 해돋이 · 삼백 년 뒤 · 제목
import { IW, IH, H, clamp, lerp, seg, eOut, eIn, eIO, hexA, rect, px, poly, circ, ell, line, path, vgrad, glow, stars, cover, glyph, GLYPHS, RACE_COL, rimmed, rim2, bz2, shakeAt, big, bp, tongue } from './pix.js';
import { tower } from './act1.js';
import { knightFig, undeadFig, undeadBones, flame } from './act2.js';
import { knight, KNT, orc, ORC, axe, layered, lerpPose, mouthOf, ik } from './body.js';

const TAU = Math.PI * 2, RACES = ['wizard', 'elf', 'knight', 'orc', 'undead', 'assassin', 'dino', 'dragon'];
const WAR = '남은 빛을 차지하려, 각인을 가진 자들은 서로를 불태웠다.';
const dark = (a) => hexA('#000000', a);

// 작은 종족 실루엣 (키 24칸). 생김새만으로 누군지 알아보게
function lineFig(g, race, x, y, fl, c, t) {
  const P = (a, b) => [x + a * fl, y + b], f = Math.sin(t * 3 + x);
  const legs = (w = 1.5, sp = 2) => { path(g, [P(0, -9), P(-sp, 0)], c, w); path(g, [P(0, -9), P(sp, 0)], c, w); };
  switch (race) {
    case 'wizard': poly(g, [P(-2, -16), P(2, -16), P(5, 0), P(-6 + f * 0.5, 0)], c); circ(g, ...P(0, -18), 2, c); poly(g, [P(-4, -19), P(4, -19), P(-3, -28)], c); line(g, ...P(4, 1), ...P(5, -24), c, 1); break;
    case 'elf': legs(1.5, 2); poly(g, [P(-2, -17), P(2, -17), P(2, -9), P(-2, -9)], c); circ(g, ...P(0, -19), 2, c); poly(g, [P(-1, -20), P(-6, -23), P(-1, -19)], c); path(g, [P(-3, -23), P(-5, -16), P(-3, -9)], c, 1); break;
    case 'knight': legs(2, 2.5); poly(g, [P(-3, -17), P(3, -17), P(3, -9), P(-3, -9)], c); poly(g, [P(-2, -22), P(2, -22), P(2, -17), P(-2, -17)], c); poly(g, [P(0, -22), P(-4, -24 + f * 0.5), P(-7, -21), P(-2, -21)], c); poly(g, [P(3, -16), P(8, -16), P(8, -11), P(5.5, -6), P(3, -11)], c); break;
    case 'orc': legs(2.5, 3.5); poly(g, [P(-5, -18), P(5, -18), P(4, -9), P(-4, -9)], c); ell(g, ...P(4, -17), 3, 2.5, c); ell(g, ...P(-4, -17), 3, 2.5, c); circ(g, ...P(1, -20), 2.5, c); poly(g, [P(0, -22), P(1, -26), P(2, -22)], c); line(g, ...P(5, -17), ...P(-3, -28), c, 1); poly(g, [P(-6, -30), P(-1, -27), P(-4, -24)], c); break;
    case 'undead': poly(g, [P(-3, -17), P(3, -17), P(5, -3), P(3, 0), P(1, -2), P(-1, 0), P(-3, -2), P(-5, 0), P(-5, -6)], c); poly(g, [P(-3, -17), P(-2, -22), P(2, -23), P(4, -19), P(3, -16)], c); path(g, [P(3, -15), P(6, -10), P(7, -6)], c, 1); break;
    case 'assassin': legs(1.5, 2.5); poly(g, [P(-2, -17), P(2, -17), P(2, -9), P(-2, -9)], c); circ(g, ...P(0, -19), 2, c); poly(g, [P(-1, -18), P(-6, -19 + f), P(-11, -17 + f), P(-6, -17)], c); line(g, ...P(2, -12), ...P(5, -6), c, 1); break;
    case 'dino': path(g, [P(0, -9), P(2, -5), P(0, -2), P(2, 0)], c, 2); path(g, [P(-1, -9), P(-3, -5), P(-4, -1), P(-2, 0)], c, 1.5); poly(g, [P(-2, -11), P(-9, -9), P(-15, -4 + f * 0.5), P(-8, -7), P(-1, -8)], c); poly(g, [P(-2, -10), P(1, -17), P(4, -16), P(2, -9)], c); poly(g, [P(1, -18), P(3, -20), P(9, -18), P(9, -16), P(3, -15)], c); break;
    case 'dragon': legs(2, 2.5); poly(g, [P(-3, -17), P(3, -17), P(2, -9), P(-2, -9)], c); poly(g, [P(-3, -16), P(-9, -23), P(-11, -14), P(-7, -8)], c); poly(g, [P(2, -16), P(7, -23), P(8, -14), P(5, -9)], c); circ(g, ...P(1, -19), 2, c); poly(g, [P(1, -21), P(-3, -26), P(-2, -21)], c); path(g, [P(-1, -8), P(-6, -4), P(-10, -1)], c, 1.5); break;
  }
  return P(0, -13);
}
function heartbeat(t, per = 1.4) { const p = t % per; return Math.exp(-(((p - 0.1) / 0.06) ** 2)) + 0.7 * Math.exp(-(((p - 0.34) / 0.07) ** 2)); }

// ───────── 탑의 빛이 흐려진다: 언덕 위 여덟 종족이 올려다본다 ─────────
const T1 = { dur: 4.6, text: '삼백 년 전, 탑의 빛이 흐려지기 시작했다.', textAt: 0.6, draw(g, t) {
  const dim = seg(t, 0.4, 4.2), fl = H(Math.floor(t * 10), 3) < 0.12 + 0.4 * dim ? 0.25 : 1, cg = (1 - dim * 0.8) * fl;
  vgrad(g, 0, 152, [[0, '#06050e'], [0.6, '#1e1430'], [1, '#3a2440']]);
  stars(g, 90, 301, 140, t, 0.8 - dim * 0.4);
  glow(g, 160, 18, 100, '#9af0e0', 0.3 * cg);
  tower(g, 160, 152, 128, { dark: '#08060e', rim: '#4a3a5a', rdx: -1, win: cg > 0.5 ? '#4a9a94' : '#1a2a2a', crystal: cg > 0.5 ? '#c8f0e8' : '#5a6a70', cglow: 0.9 * cg });
  for (let i = 0; i < 6; i++) { const sd = i % 2 ? 1 : -1; for (let j = 0; j < 12; j++) { if (H(i, j, 312) < dim * 1.1) continue; const s = (t * 0.22 + H(i, 311) + j * 0.012) % 1; px(g, 160 + sd * s * (150 + i * 10), 22 + s * 120 + Math.sin(s * 7 + t * 2 + i) * 6, hexA('#ffe0a0', 0.75 * (1 - dim))); } }
  const RG = [[0, 157], [50, 153], [110, 156], [160, 152], [220, 155], [270, 151], [320, 154]];
  poly(g, [...RG, [320, IH], [0, IH]], '#05030a'); path(g, RG, '#3a2a4a', 1);
  RACES.forEach((r, i) => {
    const x = 26 + i * 37 + (i >= 4 ? 10 : -6), y = 155 + Math.round(Math.sin(i * 1.3) * 1.5), f2 = x < 160 ? 1 : -1;
    let ch; rimmed(g, '#6a5a7a', '#05030a', -f2, 0, (c) => { ch = lineFig(g, r, x, y, f2, c, t); });
    const a = (1 - dim * 0.75) * (H(Math.floor(t * 8), i) < dim * 0.3 ? 0.3 : 1);
    glow(g, ch[0], ch[1], 5, RACE_COL[r], 0.7 * a); px(g, ch[0], ch[1], hexA(RACE_COL[r], a));
  });
} };

// ───────── 전쟁 ① 세계수가 불탄다: 검은 나무, 붉은 하늘, 위를 가르는 용 ─────────
const CROWN = Array.from({ length: 20 }, (_, i) => [202 + (H(i, 391) - 0.5) * 170, 40 + (H(i, 392) - 0.5) * 44 - Math.cos((H(i, 391) - 0.5) * 3) * 10, 12 + H(i, 393) * 12]);
const crownTop = (x) => CROWN.reduce((m, [cx, cy, r]) => Math.abs(x - cx) < r ? Math.min(m, cy - Math.sqrt(r * r - (x - cx) ** 2)) : m, 999);
function burnTree(g, c) {
  const cx = 202;
  poly(g, [[cx - 44, IH], [cx - 18, 160], [cx - 12, 112], [cx - 18, 84], [cx - 4, 70], [cx + 12, 70], [cx + 24, 84], [cx + 16, 112], [cx + 22, 160], [cx + 50, IH]], c);
  for (const [x2, y2, w] of [[cx - 70, 44, 7], [cx + 70, 40, 7], [cx - 10, 24, 6], [cx + 40, 20, 4], [cx - 44, 30, 4]]) line(g, cx + 4, 78, x2, y2, c, w);
  for (const [x, y, r] of CROWN) circ(g, x, y, r, c);
}
function dragonFly(g, x, y, t, c) {
  const w = Math.sin(t * 9);
  ell(g, x, y, 10, 3, c);
  path(g, [[x - 8, y], [x - 16, y - 3], [x - 21, y - 2]], c, 2.5); poly(g, [[x - 21, y - 4], [x - 28, y - 1], [x - 21, y + 1]], c); poly(g, [[x - 20, y - 4], [x - 17, y - 8], [x - 18, y - 3]], c);
  path(g, [[x + 8, y], [x + 20, y + 2], [x + 32, y - 2], [x + 36, y - 5]], c, 2);
  for (const s of [1, 0.65]) poly(g, [[x - 5, y - 1], [x + 1 - 6 * s, y - 28 * w * s - 3], [x + 6, y - 22 * w * s - 2], [x + 16, y - 14 * w * s - 1], [x + 6, y]], c);
}
const W1 = { dur: 2.4, text: WAR, textAt: 0.4, fo: 0.04, draw(g, t) {
  vgrad(g, 0, IH, [[0, '#1a0402'], [0.4, '#7a1606'], [0.75, '#ff5a14'], [1, '#ffb040']]);
  glow(g, 160, 175, 170, '#ffb040', 0.5);
  for (let i = 0; i < 8; i++) { const x = ((i * 70 + t * 14) % 420) - 50, y = 12 + (i % 3) * 14; ell(g, x, y, 50, 12, hexA('#1a0806', 0.55)); }
  rimmed(g, '#ffa040', '#050101', 0, -1, (c) => burnTree(g, c));
  // 잎사귀 사이로 타오르는 불구멍 · 수관 위로 치솟는 불길
  for (let x = 124; x <= 282; x += 9) { const y = crownTop(x); if (y < 999) tongue(g, x, y + 3, 14 + H(x, 409) * 16, 5 + H(x, 410) * 3, t, x); }
  for (let i = 0; i < 15; i++) tongue(g, 36 + i * 19 + (H(i, 401) - 0.5) * 10, 186, 34 + H(i, 402) * 36, 13 + H(i, 403) * 7, t, i);
  for (let i = 0; i < 80; i++) { const a = (t * (0.35 + H(i, 404) * 0.4) + H(i, 405)) % 1, x = H(i, 406) * IW + Math.sin(a * 9 + i) * 10, y = IH - a * 200; px(g, x, y, a < 0.4 ? '#ffe08a' : a < 0.7 ? '#ff8a2a' : '#8a2a10'); }
  for (let i = 0; i < 14; i++) { const a = (t * 0.5 + H(i, 407)) % 1, x = 60 + H(i, 408) * 200 + Math.sin(a * 10 + i) * 6, y = 20 + a * 150; rect(g, x, y, 2, 1, a < 0.5 ? '#ffb040' : '#3a0a04'); }
  const dx = 380 - t * 210, dy = 40 + Math.sin(t * 2) * 4;
  dragonFly(g, dx, dy, t, '#050101');
  if (t > 0.6 && t < 1.9) flame(g, dx - 27, dy, t, 46, 2.3, 0.55);
} };

// ───────── 전쟁 ② 붉은 모래 위의 결투: 잿빛 화면에 검은 두 그림자, 피만 붉다 ─────────
// 오크의 칸이 도끼를 치켜든 순간 기사단장이 번개처럼 파고들어 찌른다 → 반전 섬광 → 느린 화면 속에 칸이 피를 토하며 무너진다
const O_ATK = { hip: [-1, -29], kF: [7, -15], aF: [9, -1], kB: [-6, -15], aB: [-9, -1], sh: [-2, -50], hd: [0, -56.5], ha: -0.12, hF: [1, -77], hB: [-1, -75] };
const O_REEL = { hip: [-4, -27], kF: [4, -14], aF: [6, -1], kB: [-9, -14], aB: [-10, -1], sh: [-10.5, -46], hd: [-13, -51], ha: -0.95, hF: [-2, -70], hB: [-16, -62] };
const O_KNEEL = { hip: [-1, -14], kF: [5, -2.5], aF: [-4, -1], kB: [-3, -2.5], aB: [-12, -1], sh: [1, -33], hd: [3.5, -38], ha: 0.75, hF: [7, -17], hB: [-1, -15] };
const K_AFTER = { hip: [0, -27], kF: [7, -14], aF: [10, -1], kB: [-6, -14], aB: [-10, -1], sh: [2, -47.5], hd: [3.5, -53], ha: 0.3, hF: [12, -31], hB: [-4, -34] };
const AXE0 = ik([O_ATK.sh[0] + 1.5, O_ATK.sh[1] + 2], O_ATK.hF, 13, 12, 1)[1];
const axeAt = (s) => { const y = AXE0[1] - 34 * s + 230 * s * s; return { w: [AXE0[0] - 44 * s, Math.min(-8, y)], a: -2.5 - 7 * s, down: y >= -8 }; };
const AXE_LAND = (() => { let s = 0; while (!axeAt(s).down && s < 3) s += 0.002; return s; })();
const BLOOD = Array.from({ length: 64 }, (_, i) => ({ b: i < 16 ? i * 0.012 : H(i, 411) * 0.3, vx: -(14 + H(i, 412) * 64), vy: -(46 + H(i, 413) * 62) * (i < 16 ? 1.15 : 1), r: i < 16 ? 1.8 + H(i, 414) * 1.2 : 0.7 + H(i, 415) * 1.3 }));
const W2 = { dur: 2.8, text: WAR, fi: 0.04, fo: 0.04, draw(g, t) {
  const HIT = 0.5, dash = eIn(seg(t, 0.38, HIT)), hit = t >= HIT, inv = hit && t < HIT + 0.08;
  const slow = (tt) => tt < HIT ? 0 : 0.03 + Math.max(0, tt - HIT - 0.08) * 0.42, st = slow(t); // 맞은 뒤의 느린 시간
  const kx0 = 50, kx = lerp(kx0, 126, dash), ox = 214, by = 152, S = 1.45;
  const back = eIO(seg(t, 1.7, 2.45)), kq = lerpPose(lerpPose(KNT.ready, KNT.lunge, eOut(seg(t, 0.4, HIT))), K_AFTER, back), sword = lerp(lerp(-0.35, 0, seg(t, 0.4, HIT)), 1.0, back); // 찌른 뒤 칼을 거두고 선다
  const pose = (tt) => { const s = slow(tt); let q = lerpPose(ORC.idle, O_ATK, eIO(seg(tt, 0, 0.42))); if (tt >= HIT) q = lerpPose(lerpPose(O_ATK, O_REEL, eOut(clamp(s / 0.4))), O_KNEEL, eIO(seg(tt, 1.95, 2.7))); return q; };
  const oq = pose(t), KP = (x, y) => [kx + x, by + y], OP = (x, y) => [ox - x, by + y];
  const ink = inv ? '#f2eee6' : '#0a0a0a', inkFar = inv ? '#9a958c' : '#3a3834', edge = inv ? '#ffffff' : '#7a766e';
  // 잿빛 투기장: 해 · 먼 관중석 · 모래
  if (inv) rect(g, 0, 0, IW, IH, '#0a0a0a');
  else {
    vgrad(g, 0, IH, [[0, '#efebe3'], [0.6, '#e0dad0'], [0.61, '#ccc5b9'], [1, '#a8a195']]);
    circ(g, 160, 58, 34, '#faf8f4');
    rect(g, 0, 82, IW, 28, '#d8d2c7');
    for (let row = 0; row < 3; row++) for (let x = (row % 2) * 3; x < IW; x += 6) circ(g, x, 84 + row * 5, 1.6, '#c6bfb3');
    for (let x = 6; x < IW; x += 30) { circ(g, x + 9, 102, 7, '#c2bbaf'); rect(g, x + 2, 102, 14, 8, '#c2bbaf'); }
    for (let i = 0; i < 18; i++) rect(g, (H(i, 416) * IW + t * 3) % IW, 116 + H(i, 417) * 60, 6 + H(i, 418) * 22, 1, '#9a9388');
    for (const [x, y] of [[40, 160], [96, 168], [262, 158], [300, 170]]) ell(g, x, y, 10, 1.5, '#9a9388');
  }
  // 파고드는 기사의 잔상 · 속도선
  if (t > 0.38 && t < 0.62) {
    for (let i = 0; i < 26; i++) { const y = 70 + H(i, 421) * 90, x = ((H(i, 422) * IW - t * 900) % IW + IW) % IW; rect(g, x, y, 14 + H(i, 423) * 30, 1, inv ? '#3a3834' : '#8a857c'); }
    if (!hit) for (const [k, c] of [[0.3, '#c4beb4'], [0.55, '#aea89e'], [0.8, '#98928a']]) big(g, lerp(kx0, kx, k), by, S, () => knight(g, (x, y) => [lerp(kx0, kx, k) + x, by + y], kq, c, t, { sword, wind: 1 }));
  }
  // 날아가는 도끼 (맞는 순간 손에서 빠져 뒤로 돌며 떨어져 모래에 박힌다)
  if (hit) { const A = axeAt(Math.min(st, AXE_LAND)); big(g, ox, by, S, () => axe(g, (p) => OP(p[0], p[1]), A.w, A.a, ink)); }
  // 두 사람
  let K, O;
  O = layered(g, { far: [inkFar], body: [ink], near: [edge, ink] }, -1, 1, (c, layer) => { let r; big(g, ox, by, S, () => { r = orc(g, OP, oq, c, t, { layer, axe: hit ? null : lerp(-1.15, -2.5, eIO(seg(t, 0, 0.42))), jaw: hit ? 1 : 0 }); }); return r; });
  K = layered(g, { far: [inkFar], body: [ink], near: [edge, ink] }, 1, 1, (c, layer) => { let r; big(g, kx, by, S, () => { r = knight(g, KP, kq, c, t, { layer, sword, wind: hit ? 0.6 : dash, capeSpeed: hit ? 1.2 : 4 }); }); return r; });
  // 찌른 자리: 반전 섬광 속 붉은 선 · 집중선
  const tip = bp(kx, by, S, K.tip);
  if (inv) { line(g, tip[0] - 40, tip[1], tip[0] + 10, tip[1], '#e0101c', 2); for (let i = 0; i < 16; i++) { const a = H(i, 424) * TAU, r0 = 14 + H(i, 425) * 10; line(g, tip[0] + Math.cos(a) * r0, tip[1] + Math.sin(a) * r0, tip[0] + Math.cos(a) * (r0 + 60), tip[1] + Math.sin(a) * (r0 + 60), '#f2eee6', 1); } }
  // 피: 이 장면에서 유일한 색. 입에서 뿜어져 느리게 흩어진다
  if (hit && !inv) for (const B of BLOOD) {
    const te = HIT + 0.08 + B.b; if (t < te) continue;
    const m = bp(ox, by, S, OP(...mouthOf(pose(te)))), a = st - slow(te);
    const y = m[1] + B.vy * a + 90 * a * a, x = m[0] + B.vx * a;
    if (y > by + 2) { const tl = (-B.vy + Math.sqrt(B.vy * B.vy + 360 * (by + 2 - m[1]))) / 180; ell(g, m[0] + B.vx * tl, by + 2, B.r * 2.4, B.r * 0.6, '#8a0810'); continue; }
    const vy = B.vy + 180 * a, L = Math.hypot(B.vx, vy) || 1;
    line(g, x - B.vx / L * B.r * 2.6, y - vy / L * B.r * 2.6, x, y, '#7a0610', Math.max(1, B.r * 0.9));
    circ(g, x, y, B.r, '#d0101c'); if (B.r > 1.6) px(g, x - 0.5, y - 0.5, '#ff5a5a');
  }
  if (hit && !inv && t < 1.6) for (let j = 0; j < 4; j++) px(g, tip[0] - 10 - j * 4, tip[1] + 1 + seg(t, HIT, 1.2) * j * 3, '#c00a16'); // 칼날을 타고 흐르는 피
  const bar = Math.round(eOut(seg(t, HIT + 0.05, HIT + 0.35)) * 14); if (bar > 0) { rect(g, 0, 0, IW, bar, '#000000'); rect(g, 0, IH - bar, IW, bar, '#000000'); }
} };

// ───────── 전쟁 ③ 망자가 쓰러진 기사들을 일으킨다: 푸른 실이 시체를 끌어올린다 ─────────
const FALLEN = [[150, 158, 1, 0.4], [196, 162, -1, 0.65], [240, 156, 1, 0.85], [286, 162, -1, 1.05]];
const W3 = { dur: 2.4, text: WAR, fi: 0.04, fo: 0.04, draw(g, t) {
  vgrad(g, 0, IH, [[0, '#02050a'], [0.6, '#0a1a26'], [1, '#12283a']]);
  stars(g, 50, 421, 90, t, 0.5);
  circ(g, 60, 34, 10, '#9ac8d4');
  poly(g, [[0, 132], [80, 124], [160, 134], [240, 128], [320, 134], [320, IH], [0, IH]], '#060c14');
  for (const [x, a] of [[110, -0.4], [130, 0.3], [178, -0.2], [222, 0.5], [262, -0.35], [304, 0.2]]) { line(g, x, 160, x + Math.sin(a) * 26, 160 - Math.cos(a) * 26, '#03070c', 1); }
  line(g, 214, 166, 236, 112, '#03070c', 1.5); for (let i = 0; i < 10; i++) rect(g, 236 - i * 0.4 + Math.sin(t * 3 + i * 0.6) * 0.8, 113 + i, 10 - (i % 3) * 2, 1, '#03070c');
  poly(g, [[0, 150], [20, 120], [60, 112], [96, 122], [118, 150], [118, IH], [0, IH]], '#03070c');
  const nx = 60, ny = 116;
  rimmed(g, '#7ae8ff', '#020509', 1, 0, (c) => undeadFig(g, nx, ny, t, 1, c));
  undeadBones(g, nx + 1, ny, t, 1);
  for (const m of [1, -1]) { glow(g, nx + 1 + m * 1.5, ny - 51, 4, '#7ae8ff', 0.8); px(g, nx + 1 + m * 1.5 - 0.5, ny - 51, '#e8ffff'); }
  const hand = [nx + 19, ny - 52];
  for (const [x, y, fl, d] of FALLEN) {
    const k = eOut(seg(t, d, d + 0.7)), jit = k > 0 && k < 1 ? (H(Math.floor(t * 20), x) - 0.5) * 0.12 : 0, ang = (1 - k) * 1.45 * fl + jit;
    const chest = [x + Math.sin(ang) * 30, y - Math.cos(ang) * 30];
    if (t > d - 0.2) {
      const mid = [(hand[0] + chest[0]) / 2, Math.max(hand[1], chest[1]) + 10];
      const pts = Array.from({ length: 13 }, (_, i) => bz2(hand, mid, chest, i / 12));
      path(g, pts, hexA('#7ae8ff', 0.55), 1);
      for (let j = 0; j < 3; j++) { const q = bz2(hand, mid, chest, (t * 1.6 + j / 3) % 1); px(g, q[0], q[1], '#e8ffff'); }
    }
    g.save(); g.translate(x, y); g.rotate(ang); g.translate(-x, -y);
    rimmed(g, '#4ab8d0', '#03070c', -1, 0, (c) => knightFig(g, x, y, fl, t, 0, 0, c));
    g.restore();
    if (k > 0.8) { const ex = x + Math.sin(ang) * 46 - fl * 2, ey = y - Math.cos(ang) * 46; glow(g, ex, ey, 4, '#7ae8ff', 0.8); px(g, ex, ey, '#e8ffff'); }
  }
  for (let L = 0; L < 2; L++) poly(g, [[0, 170], ...Array.from({ length: 9 }, (_, i) => [i * 40, 150 + L * 10 + Math.sin(i * 1.2 + t + L) * 3]), [IW, 170], [IW, IH], [0, IH]], hexA('#4a8a9a', 0.08));
} };

// ───────── 전쟁 ④ 그림자 길드가 마탑의 별의 지도를 훔친다: 달빛 창을 가로지르는 도약 ─────────
function thiefLeap(g, x, y, t, c) {
  const f = Math.sin(t * 10);
  poly(g, [[x + 4, y - 2], [x + 14, y - 6 + f], [x + 26, y - 3 + f * 1.5], [x + 36, y - 7 + f], [x + 24, y + 1], [x + 12, y + 1]], c); // 목도리
  poly(g, [[x - 6, y - 3], [x + 8, y - 4], [x + 9, y + 1], [x - 5, y + 2]], c);
  circ(g, x - 9, y - 2, 2.6, c);
  path(g, [[x + 7, y], [x + 12, y + 6], [x + 8, y + 10]], c, 2); path(g, [[x + 6, y - 2], [x + 14, y + 2], [x + 18, y + 6]], c, 2);
  path(g, [[x - 4, y - 2], [x - 12, y - 5], [x - 18, y - 6]], c, 1.5);
  path(g, [[x - 2, y], [x + 2, y + 5], [x - 2, y + 8]], c, 1.5);
  return [x - 19, y - 6];
}
const W4 = { dur: 2.6, text: WAR, fi: 0.04, draw(g, t) {
  const s = seg(t, 0.15, 2.2), u = s + 0.11 * Math.sin(TAU * s), [tx, ty] = bz2([268, 150], [160, 30], [52, 128], u);
  rect(g, 0, 0, IW, IH, '#0b0716');
  // 아치 창 · 달
  const A = [[110, 172], [110, 70], [116, 50], [128, 36], [144, 27], [160, 24], [176, 27], [192, 36], [204, 50], [210, 70], [210, 172]];
  poly(g, A.map(([x, y]) => [x + (x < 160 ? -4 : 4), y - 4]), '#1a1028');
  vgrad(g, 20, 172, [[0, '#1a1438'], [1, '#3a2a5a']], 110, 210);
  glow(g, 160, 84, 80, '#d8ccff', 0.35);
  circ(g, 160, 84, 30, '#e8e0ff'); circ(g, 157, 81, 26, '#f8f4ff');
  poly(g, [[0, 0], [IW, 0], [IW, IH], [210, IH], [210, 172], [210, 70], [204, 50], [192, 36], [176, 27], [160, 24], [144, 27], [128, 36], [116, 50], [110, 70], [110, 172], [110, IH], [0, IH]], '#0b0716');
  rect(g, 158, 24, 4, 150, '#05030a'); rect(g, 110, 100, 100, 3, '#05030a'); path(g, [[110, 70], [124, 46], [158, 30]], '#05030a', 2); path(g, [[210, 70], [196, 46], [162, 30]], '#05030a', 2);
  rect(g, 104, 168, 112, 6, '#05030a');
  for (const sx of [0, 228]) for (let row = 0; row < 6; row++) { const y = 18 + row * 26; rect(g, sx + 4, y + 22, 88, 3, '#05030a'); for (let i = 0; i < 18; i++) { const w = 3 + H(i, row, sx) * 2, h = 12 + H(i, row + 9, sx) * 8; rect(g, sx + 6 + i * 4.8, y + 22 - h, w, h, ['#140c22', '#1c1030', '#100818'][(i + row) % 3]); } }
  // 마법사들의 보랏빛 마탄이 뒤쫓는다
  for (const [b, y0, y1] of [[0.55, 120, 70], [1.0, 60, 110], [1.45, 140, 96]]) {
    const a = t - b; if (a < 0 || a > 0.5) continue;
    const x = 330 - a * 900, y = lerp(y0, y1, a * 2);
    if (x > -10) { line(g, x, y, x + 26, y - (y1 - y0) * 0.06, hexA('#c8a8ff', 0.6), 3); line(g, x, y, x + 18, y, '#ffffff', 1); glow(g, x, y, 10, '#b58aff', 0.8); }
    else for (let j = 0; j < 8; j++) px(g, 4 + (a - 0.36) * 60 * Math.cos(j), y + (a - 0.36) * 60 * Math.sin(j), '#e8d8ff');
  }
  // 도둑: 별의 지도가 별가루를 흘린다
  let sc;
  if (t > 0.15 && t < 2.25) {
    rimmed(g, '#c8b8ff', '#020106', 0, 1, (c) => { sc = thiefLeap(g, tx, ty, t, c); });
    glow(g, sc[0], sc[1], 12, '#b58aff', 0.8); rect(g, sc[0] - 2, sc[1] - 1, 5, 3, '#f0e8ff');
    for (let j = 0; j < 22; j++) { const back = j * 0.025, u2 = Math.max(0, u - back * 0.5), q = bz2([268, 150], [160, 30], [52, 128], u2); const yy = q[1] - 6 + back * back * 120; px(g, q[0] - 19 + Math.sin(j * 2.1) * 3, yy, j % 3 ? '#e8e0ff' : '#b58aff'); }
  }
} };

// ───────── 재의 계절: 잿빛 하늘, 등불 하나 ─────────
function walker(g, x, y, t, s, c, child) {
  const ph = t * (child ? 7 : 5) + (child ? 1 : 0), sw = Math.sin(ph), P = (a, b) => [x + a * s, y + b * s];
  path(g, [P(0, -10), P(sw * 3, -5), P(sw * 4, 0)], c, 2 * s); path(g, [P(0, -10), P(-sw * 3, -5), P(-sw * 4 + 1, 0)], c, 2 * s);
  if (child) { poly(g, [P(-2, -18), P(3, -18), P(4, -9), P(-3, -9)], c); circ(g, ...P(1, -20), 2.6 * s, c); return P(3, -15); }
  poly(g, [P(-3, -26), P(4, -26), P(6, -12), P(5 + sw, -6), P(-5, -6), P(-6, -12)], c); // 두건 달린 겉옷
  poly(g, [P(-2, -26), P(-1, -32), P(3, -33), P(5, -29), P(4, -25)], c);
  poly(g, [P(-3, -25), P(-10 - sw, -18), P(-12, -10), P(-6, -14)], c);
  path(g, [P(3, -23), P(6, -18), P(7, -14)], c, 1.5 * s);
  return P(-5, -16);
}
const T3 = { dur: 4.6, text: '섬은 일곱 해 동안 해를 보지 못했다.', textAt: 0.6, draw(g, t) {
  vgrad(g, 0, IH, [[0, '#22201e'], [0.55, '#46413c'], [1, '#5a544e']]);
  glow(g, 226, 46, 40, '#9a9288', 0.2); circ(g, 226, 46, 14, '#6e6860'); circ(g, 225, 45, 12, '#7a746c');
  for (let i = 0; i < 7; i++) ell(g, ((i * 80 + t * 6) % 440) - 60, 30 + i * 9, 70, 5, hexA('#2e2a28', 0.55));
  tower(g, 252, 132, 74, { dark: '#2e2a28' });
  poly(g, [[0, 134], [60, 130], [140, 135], [220, 129], [320, 134], [320, IH], [0, IH]], '#1c1a18');
  for (const [x, w, h] of [[30, 22, 22], [60, 10, 14], [168, 16, 18], [290, 26, 26]]) { poly(g, [[x, 136], [x, 136 - h], [x + 4, 136 - h + 3], [x + 8, 136 - h - 2], [x + w * 0.6, 136 - h + 6], [x + w, 136 - h + 4], [x + w, 136]], '#161412'); rect(g, x + w * 0.3, 136 - h * 0.6, 3, 4, '#3a3632'); }
  for (const x of [120, 206]) { line(g, x, 136, x + 2, 104, '#121010', 2); line(g, x + 1, 116, x - 10, 106, '#121010', 1); line(g, x + 2, 110, x + 12, 100, '#121010', 1); line(g, x + 1, 122, x + 9, 118, '#121010', 1); }
  // 등불을 든 사람과 손을 잡은 아이 (화면에서 유일한 따뜻한 빛)
  const wx = 64 + t * 13, wy = 160;
  const lp = walker(g, wx, wy, t, 1.3, '#0e0c0b', false);
  walker(g, wx + 11, wy, t, 1.2, '#0e0c0b', true);
  line(g, wx + 9, wy - 19, wx + 14, wy - 17, '#0e0c0b', 1.5);
  const lx = lp[0] - 2 + Math.sin(t * 5) * 1, ly = lp[1] + 3;
  line(g, lp[0], lp[1], lx, ly, '#0e0c0b', 1);
  glow(g, lx, ly + 2, 22, '#ffb060', 0.55 + 0.08 * Math.sin(t * 17)); rect(g, lx - 1, ly, 3, 4, '#ffd890'); ell(g, lx, 164, 16, 2.5, hexA('#ffb060', 0.25));
  for (let i = 0; i < 170; i++) { const d = H(i, 431), x = ((H(i, 432) * 360 + t * (6 + d * 10) + Math.sin(t * 1.5 + i) * 6) % 360) - 20, y = (H(i, 433) * 190 + t * (8 + d * 14)) % 190 - 5; if (d > 0.85) rect(g, x, y, 2, 1, '#b8b0a8'); else px(g, x, y, d > 0.4 ? '#9a928a' : '#787068'); }
} };

// ───────── 마지막 왕: 탑의 문을 향해 홀로 걸어간다 ─────────
const RUNE = ['#.#', '.#.', '#.#', '###', '#..', '##.', '.#.', '###', '.#.', '#..', '###', '..#', '##.', '#.#', '.##'];
function kingFig(g, x, y, s, ph, c) {
  big(g, x, y, s, () => {
    const l = Math.sin(ph), sw = Math.sin(ph * 0.5) * 1.5;
    path(g, [[x - 2, y - 12], [x - 3, y - 1 - Math.max(0, l) * 2]], c, 3); path(g, [[x + 2, y - 12], [x + 3, y - 1 - Math.max(0, -l) * 2]], c, 3);
    poly(g, [[x - 6, y - 34], [x + 6, y - 34], [x + 10, y - 13], [x + 12 + sw, y - 3], [x + 4, y - 4], [x, y - 2], [x - 4, y - 4], [x - 12 + sw, y - 3], [x - 10, y - 13]], c); // 망토
    ell(g, x, y - 33, 8, 3, c);
    circ(g, x, y - 38, 3.5, c);
    poly(g, [[x - 4, y - 40], [x - 4, y - 45], [x - 2, y - 43], [x, y - 46], [x + 2, y - 43], [x + 4, y - 45], [x + 4, y - 40]], c); // 왕관
    line(g, x - 9, y - 15, x - 13, y - 2, c, 1.5); // 칼집 끝
  });
}
function mage(g, x, y, s, fl, t, c) {
  big(g, x, y, s, () => {
    poly(g, [[x - 4, y - 22], [x + 4, y - 22], [x + 6, y], [x - 6, y]], c);
    poly(g, [[x - 3, y - 22], [x - 2, y - 28], [x + 2, y - 29], [x + 4, y - 24], [x + 3, y - 21]], c);
    path(g, [[x + 3 * fl, y - 20], [x + 7 * fl, y - 26], [x + 8 * fl, y - 32]], c, 1.5); line(g, x + 8 * fl, y - 18, x + 9 * fl, y - 40, c, 1);
  });
  return bp(x, y, s, [x + 9 * fl, y - 41]);
}
function doorWall(g) {
  rect(g, 0, 0, IW, 124, '#100c16');
  for (let r = 0; r < 12; r++) for (let i = 0; i < 12; i++) { const x = i * 30 + (r % 2) * 15 - 10, y = r * 10 + 2; rect(g, x, y, 28, 1, '#0a0810'); rect(g, x, y, 1, 10, '#0a0810'); }
  const A = [[100, 124], [100, 50], [108, 32], [122, 18], [140, 10], [160, 8], [180, 10], [198, 18], [212, 32], [220, 50], [220, 124]];
  poly(g, A, '#1c1626'); poly(g, A.map(([x, y]) => [lerp(x, 160, 0.1), y + 6]), '#060409');
  return A;
}
const T4 = { dur: 6.6, text: '마지막 왕은 탑의 문을 닫기 위해 홀로 걸어 들어갔다.', textAt: 0.8, draw(g, t) {
  const p = seg(t, 0.2, 6.2), L = 0.75 + 0.25 * Math.sin(t * 2.3), gap = 30;
  vgrad(g, 0, IH, [[0, '#0a0810'], [1, '#1a1420']]);
  doorWall(g);
  poly(g, [[118, 124], [160 - gap / 2, 124], [160 - gap / 2, 22], [140, 16], [124, 24], [116, 40]], '#120e18');
  poly(g, [[202, 124], [160 + gap / 2, 124], [160 + gap / 2, 22], [180, 16], [196, 24], [204, 40]], '#120e18');
  glow(g, 160, 80, 90, '#fff0c0', 0.5 * L);
  rect(g, 160 - gap / 2, 18, gap, 106, '#fff8e8'); rect(g, 160 - gap / 2 + 3, 18, gap - 6, 106, '#ffffff');
  // 바닥: 문에서 흘러나온 빛이 다가온다
  vgrad(g, 124, IH, [[0, '#18121e'], [1, '#08060c']]);
  for (let i = -4; i <= 4; i++) line(g, 160 + i * 9, 124, 160 + i * 60, IH, '#0e0a12', 1);
  for (let j = 0; j < 6; j++) { const y = 124 + (j * j) * 1.6 + 2; line(g, 0, y, IW, y, '#0e0a12', 1); }
  for (const [w0, w1, a] of [[gap * 0.5, 120, 0.12], [gap * 0.4, 80, 0.16], [gap * 0.25, 40, 0.22]]) poly(g, [[160 - w0, 124], [160 + w0, 124], [160 + w1, IH], [160 - w1, IH]], hexA('#fff0c0', a * L));
  // 문 위의 봉인 문자들
  for (let i = 0; i < 9; i++) { const a = Math.PI + (i + 0.5) * Math.PI / 9, x = 160 + Math.cos(a) * 52, y = 66 + Math.sin(a) * 52 - 4, on = 0.5 + 0.5 * Math.sin(t * 3 + i); glow(g, x + 1, y + 2, 6, '#b58aff', 0.5 * on); for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) if (RUNE[(i * 3 + r) % RUNE.length][q] === '#') px(g, x + q, y + r, hexA('#e8d8ff', 0.5 + 0.5 * on)); }
  // 길 양쪽의 마법사들
  for (const [x, y, s] of [[112, 128, 0.8], [88, 142, 1.0], [56, 162, 1.3], [208, 128, 0.8], [232, 142, 1.0], [264, 162, 1.3]]) {
    const fl = x < 160 ? 1 : -1;
    let tip; rim2(g, '#8a7aa0', '#06040a', (c) => { tip = mage(g, x, y, s, fl, t, c); });
    glow(g, tip[0], tip[1], 7 * s, '#b58aff', 0.7); px(g, tip[0], tip[1], '#f0e8ff');
  }
  // 왕: 뒷모습, 빛을 향해 (가장자리가 하얗게)
  const ky = lerp(184, 122, p), ks = lerp(1.7, 0.5, p), ph = p * 26;
  rim2(g, '#fff4d0', '#050308', (c) => kingFig(g, 160, ky, ks, ph, c));
  if (p > 0.82) glow(g, 160, ky - 12 * ks, 30, '#ffffff', seg(p, 0.82, 1));
} };

// ───────── 문이 닫힌다 → 어둠 → 해가 뜬다 ─────────
const T5 = { dur: 7, text: '그날 해가 떴다. 왕은 돌아오지 않았고, 원한은 남았다.', textAt: 3.1, draw(g, t, raw) {
  if (t < 2.2) {
    const cl = eIn(seg(t, 0.1, 1.3)), gp = 26 * (1 - cl), shut = t >= 1.3, [sx, sy] = shakeAt(t, 1.3, 0.5, 4);
    g.save(); g.translate(sx, sy);
    rect(g, 0, 0, IW, IH, '#08060c');
    if (gp > 0.3) { glow(g, 160, 90, 80 * (gp / 26) + 20, '#fff0c0', 0.8); rect(g, 160 - gp / 2, 0, gp, IH, '#ffffff'); }
    for (const m of [-1, 1]) {
      const e = 160 + m * gp / 2, o = 160 + m * 150;
      poly(g, [[e, 0], [o, 0], [o, IH], [e, IH]], '#16111c');
      for (let j = 0; j < 8; j++) rect(g, Math.min(e, o), 10 + j * 22, Math.abs(o - e), 1, '#0e0a14');
      for (let j = 0; j < 4; j++) { const x = e + m * (14 + j * 32); if (Math.abs(x - 160) < 150) rect(g, x, 0, 1, IH, '#0e0a14'); }
      line(g, e, 0, e, IH, '#3a2e4a', 1);
    }
    if (shut) { // 문이 맞닿는 순간: 봉인이 빛나며 잠긴다
      const k = seg(t, 1.3, 2.1), on = 1 - k;
      if (t < 1.36) cover(raw, 1, '#fff4dc');
      g.strokeStyle = hexA('#ffd890', 0.9 * on); g.lineWidth = 1; g.beginPath(); g.arc(160, 86, 52, 0, TAU); g.stroke();
      g.beginPath(); g.arc(160, 86, 44, 0, TAU); g.stroke();
      RACES.forEach((r, i) => { const a = -Math.PI / 2 + i * Math.PI / 4; glyph(g, r, 160 + Math.cos(a) * 48, 86 + Math.sin(a) * 48, 1, on, '#ffd890'); });
      line(g, 160, 30, 160, 142, hexA('#ffe8b0', on), 1);
      glow(g, 160, 86, 60, '#ffd890', 0.5 * on);
      for (let i = 0; i < 30; i++) { const a = t - 1.3 - H(i, 441) * 0.1; if (a < 0) continue; const x = 20 + H(i, 442) * 280, y = a * a * 200 + H(i, 443) * 10; if (y < IH) px(g, x, y, '#5a4a5a'); }
      for (const m of [-1, 1]) { const a = t - 1.3; if (a < 0.6) ell(g, 160 + m * (10 + a * 60), 176, 14 + a * 40, 4 + a * 6, hexA('#4a3a4a', 0.5 * (1 - a / 0.6))); }
    }
    g.restore(); return;
  }
  if (t < 2.85) { rect(g, 0, 0, IW, IH, '#000000'); return; }
  // 해돋이: 재구름이 갈라지고, 탑 뒤로 해가 오른다. 등을 돌린 기사와 오크
  const k = eOut(seg(t, 2.85, 6.6)), hz = 124, sy = lerp(hz + 10, hz - 22, k);
  vgrad(g, 0, hz, [[0, '#1a1428'], [0.5, '#6a3048'], [0.85, '#e07040'], [1, '#ffd080']]);
  glow(g, 160, sy, 120, '#ffd080', 0.6 * k);
  for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (i - 5.5) * 0.24 + Math.sin(t * 0.3) * 0.03; poly(g, [[160, sy], [160 + Math.cos(a - 0.03) * 240, sy + Math.sin(a - 0.03) * 240], [160 + Math.cos(a + 0.03) * 240, sy + Math.sin(a + 0.03) * 240]], hexA('#ffe8b0', 0.07 * k)); }
  circ(g, 160, sy, 18, '#ffc870'); circ(g, 160, sy, 15, '#ffe0a0'); circ(g, 160, sy, 11, '#fff4d8');
  for (let i = 0; i < 8; i++) { const sd = i % 2 ? 1 : -1, x = 160 + sd * (20 + i * 18 + k * 200), y = 20 + i * 12; ell(g, x, y, 60, 7, hexA('#1a1220', 0.75)); }
  vgrad(g, hz, IH, [[0, '#e08048'], [0.15, '#6a3040'], [1, '#140a14']]);
  for (let i = 0; i < 40; i++) { const d = H(i, 451), y = hz + 2 + Math.floor(d * d * 50), x = (H(i, 452) * IW + t * (5 + 10 * d)) % IW; rect(g, x, y, 2 + Math.floor(5 * H(i, 453)), 1, Math.abs(x - 160) < 24 + d * 30 ? '#ffe0a0' : '#7a3a48'); }
  poly(g, [[110, hz + 1], [134, hz - 6], [150, hz - 9], [170, hz - 9], [186, hz - 6], [210, hz + 1]], '#140a12');
  tower(g, 160, hz - 8, 96, { dark: '#120810', rim: '#ff9a6a', rdx: 1, crystal: '#7a8a90', cglow: 0.1 });
  poly(g, [[0, IH], [0, 150], [30, 146], [64, 150], [86, 160], [96, IH]], '#0a0508'); poly(g, [[IW, IH], [IW, 148], [290, 146], [256, 152], [236, 162], [226, IH]], '#0a0508');
  rimmed(g, '#ffb070', '#0a0508', -1, 0, (c) => big(g, 50, 148, 0.9, () => knightFig(g, 50, 148, -1, t, 0, 1, c)));
  rimmed(g, '#ffb070', '#0a0508', 1, 0, (c) => big(g, 272, 148, 0.9, () => lineFigBig(g, 272, 148, t, c)));
  rect(g, 0, 0, IW, IH, hexA('#000000', 1 - seg(t, 2.85, 4.2)));
} };
// 등 돌린 오크 (해돋이 장면용, 키 40)
function lineFigBig(g, x, y, t, c) { big(g, x, y, 1.7, () => lineFig(g, 'orc', x, y, 1, c, t)); }

// ───────── 삼백 년 뒤: 바람결 마을의 모닥불, 멀리서 탑이 고동친다 ─────────
function hero(g, x, y, t, st, c) {
  const f = Math.sin(t * 3), P = (a, b) => [x + a, y + b];
  const hip = [lerp(-1, 0, st), lerp(-8, -20, st)], sh = [lerp(1, 0, st), lerp(-22, -36, st)], hd = [lerp(3, 1, st), lerp(-27, -41, st)];
  if (st < 0.5) { path(g, [P(...hip), P(7, -10), P(8, 0)], c, 3); path(g, [P(...hip), P(5, -9), P(5, 0)], c, 3); }
  else { path(g, [P(...hip), P(3, -10), P(5, 0)], c, 3); path(g, [P(...hip), P(-3, -10), P(-5, 0)], c, 3); }
  poly(g, [P(sh[0] - 4, sh[1]), P(sh[0] + 4, sh[1]), P(hip[0] + 5, hip[1] + 2), P(hip[0] - 7 - f * st * 2, hip[1] + 4 + st * 6), P(sh[0] - 8 - f * 2, sh[1] + 10)], c); // 망토
  circ(g, ...P(...hd), 3, c); poly(g, [P(hd[0] - 3, hd[1] - 1), P(hd[0] - 1, hd[1] - 5), P(hd[0] + 3, hd[1] - 4), P(hd[0] + 3, hd[1] + 1)], c);
  line(g, ...P(sh[0] - 4, sh[1] - 4), ...P(sh[0] + 6, sh[1] + 14), c, 1.5); // 등에 멘 칼
}
const T6 = { dur: 6.2, text: '그리고 삼백 년 뒤 —', textAt: 0.8, draw(g, t) {
  const hb = heartbeat(t), st = eIO(seg(t, 3.4, 4.4)), fx = 206, fy = 164;
  vgrad(g, 0, 150, [[0, '#03040c'], [0.6, '#0a1024'], [1, '#18203a']]);
  stars(g, 130, 461, 130, t, 0.9);
  glow(g, 244, 30, 70 + hb * 30, '#9af0e0', 0.2 + 0.35 * hb);
  tower(g, 244, 128, 104, { dark: '#060810', rim: '#2a4a5a', rdx: 1, win: '#4a9a94', crystal: '#e8fff8', cglow: 0.35 + 0.9 * hb });
  for (let i = 0; i < 6; i++) { const sd = i % 2 ? 1 : -1; for (let j = 0; j < 10; j++) { const s = (t * 0.18 + H(i, 471) + j * 0.012) % 1; px(g, 244 + sd * s * (120 + i * 8), 20 + s * 100 + Math.sin(s * 7 + t * 2 + i) * 5, hexA('#ffe0a0', 0.55 * (1 - s))); } }
  poly(g, [[0, 140], [70, 128], [150, 136], [230, 126], [320, 134], [320, IH], [0, IH]], '#0a0e1c');
  // 바람결 마을: 언덕 위 집들 · 풍차 · 굴뚝 연기
  poly(g, [[0, 150], [0, 112], [40, 102], [96, 104], [140, 120], [170, 150]], '#070a14');
  for (const [x, w, h] of [[10, 18, 12], [32, 14, 10], [52, 20, 14], [78, 16, 11]]) { const y = 106 - (x > 40 && x < 70 ? 2 : 0); rect(g, x, y - h, w, h, '#05070e'); poly(g, [[x - 2, y - h], [x + w / 2, y - h - 7], [x + w + 2, y - h]], '#05070e'); rect(g, x + w / 2 - 1, y - h + 4, 3, 3, '#ffb050'); glow(g, x + w / 2, y - h + 5, 6, '#ffa040', 0.35); }
  for (let i = 0; i < 6; i++) { const a = (t * 0.25 + i / 6) % 1; ell(g, 38 + a * 10 + Math.sin(a * 4) * 3, 88 - a * 30, 2 + a * 6, 1.5 + a * 3, hexA('#3a4258', 0.5 * (1 - a))); }
  poly(g, [[110, 106], [118, 106], [116, 84], [112, 84]], '#05070e');
  for (let i = 0; i < 4; i++) { const a = t * 0.7 + i * Math.PI / 2, ex = 114 + Math.cos(a) * 16, ey = 84 + Math.sin(a) * 16, nx = -Math.sin(a), ny = Math.cos(a); line(g, 114, 84, ex, ey, '#05070e', 1); poly(g, [[lerp(114, ex, 0.3), lerp(84, ey, 0.3)], [ex, ey], [ex + nx * 4, ey + ny * 4], [lerp(114, ex, 0.3) + nx * 3, lerp(84, ey, 0.3) + ny * 3]], '#05070e'); }
  // 땅 · 모닥불
  poly(g, [[0, 168], [90, 160], [200, 166], [320, 160], [320, IH], [0, IH]], '#04050a');
  const fl = 0.85 + 0.15 * Math.sin(t * 13) * H(Math.floor(t * 9), 5);
  glow(g, fx, fy - 6, 60, '#ff9a3a', 0.45 * fl); ell(g, fx, fy + 1, 30, 4, hexA('#ff9a3a', 0.18));
  line(g, fx - 8, fy + 1, fx + 7, fy - 2, '#1a0e08', 2); line(g, fx - 7, fy - 2, fx + 8, fy + 1, '#1a0e08', 2);
  tongue(g, fx - 3, fy, 12, 3.5, t, 1); tongue(g, fx + 3, fy, 10, 3, t, 2); tongue(g, fx, fy, 16, 4, t, 3);
  for (let i = 0; i < 16; i++) { const a = (t * (0.6 + H(i, 481) * 0.5) + H(i, 482)) % 1; px(g, fx + Math.sin(a * 8 + i) * 4 * a + (H(i, 483) - 0.5) * 6, fy - 6 - a * 50, a < 0.5 ? '#ffd070' : '#ff6a2a'); }
  // 주인공: 통나무에 앉아 탑을 올려다보다가, 일어선다
  if (st < 0.5) { line(g, 166, 165, 190, 163, '#0a0604', 3); }
  rimmed(g, '#ffa860', '#020205', -1, 0, (c) => big(g, 178, 164, 1.25, () => hero(g, 178, 164, t, st, c)));
  rect(g, 0, 0, IW, IH, hexA('#9af0e0', 0.04 * hb));
} };

// ───────── 탑이 다시 깨어난다: 꼭대기로 다가가며 고동이 빨라진다 ─────────
const T7 = { dur: 3.6, text: '탑이 다시 깨어난다.', textAt: 0.3, fo: 0, draw(g, t, raw) {
  const k = eIn(seg(t, 0, 3.4)), z = 1 + k * 7, cy = lerp(19, 84, eIO(seg(t, 0, 2.6)));
  const beats = [0.3, 1.2, 1.9, 2.4, 2.75, 3.0, 3.2, 3.35], hb = beats.reduce((m, b) => Math.max(m, Math.exp(-(((t - b) / 0.07) ** 2))), 0);
  vgrad(g, 0, IH, [[0, '#03040c'], [1, '#141a30']]);
  for (let i = 0; i < 90; i++) { const x0 = H(i, 491) * IW - 160, y0 = H(i, 492) * IH - cy, s = Math.pow(z, 0.35); px(g, 160 + x0 * s, cy + y0 * s, hexA('#c8d8ff', 0.4 + 0.5 * H(i, 493))); }
  glow(g, 160, cy, 60 + 40 * hb + k * 60, '#9af0e0', 0.35 + 0.5 * hb);
  g.save(); g.translate(160, cy); g.scale(z, z); g.translate(-160, -19);
  tower(g, 160, 150, 128, { dark: '#060810', rim: '#3a6a7a', rdx: 1, win: '#4a9a94', crystal: '#e8fff8', cglow: 0 });
  g.restore();
  const r = 3 * z * (1 + 0.15 * hb);
  glow(g, 160, cy, r * 6, '#e8fff8', 0.6 + 0.4 * hb);
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t * 0.4, L = r * (2 + hb * 3); line(g, 160, cy, 160 + Math.cos(a) * L, cy + Math.sin(a) * L, hexA('#e8fff8', 0.3 * hb), 1); }
  rect(g, 0, 0, IW, IH, hexA('#ffffff', 0.12 * hb + seg(t, 3.1, 3.6)));
} };

// ───────── 제목: 별가루가 모여 「아르케」가 된다 ─────────
let TP = null;
function titlePts() {
  if (TP) return TP;
  const c = document.createElement('canvas'); c.width = IW; c.height = IH;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 44px Galmuri11, sans-serif'; x.fillText('아르케', IW / 2, 74);
  const d = x.getImageData(0, 0, IW, IH).data, pts = [];
  let y0 = IH, y1 = 0;
  for (let y = 0; y < IH; y++) for (let i = 0; i < IW; i++) if (d[(y * IW + i) * 4 + 3] > 128) { pts.push([i, y]); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  TP = { pts, y0, y1 };
  return TP;
}
const T8 = { dur: 6, fi: 0, fo: 0.9, draw(g, t, raw) {
  const { pts, y0, y1 } = titlePts();
  vgrad(g, 0, IH, [[0, '#03040c'], [0.7, '#0e1228'], [1, '#1a1a34']]);
  stars(g, 110, 501, 170, t, 0.8);
  const hb = heartbeat(t + 0.3, 1.6);
  tower(g, 160, 186, 64, { dark: '#05060c', rim: '#2a3a5a', rdx: 1, crystal: '#e8fff8', cglow: 0.3 + 0.5 * hb });
  for (let i = 0; i < 6; i++) { const sd = i % 2 ? 1 : -1; for (let j = 0; j < 10; j++) { const s = (t * 0.16 + H(i, 511) + j * 0.012) % 1; px(g, 160 + sd * s * (150 + i * 10), 118 + s * 60 + Math.sin(s * 7 + t * 2 + i) * 4, hexA('#ffe0a0', 0.5 * (1 - s))); } }
  const formed = seg(t, 2.2, 2.6), sweep = (t - 2.8) * 150 + 60;
  glow(g, 160, 74, 120, '#ffd890', 0.18 * formed);
  for (let i = 0; i < pts.length; i++) {
    const [tx, ty] = pts[i], d = H(i, 521) * 0.6, u = eOut(seg(t, 0.2 + d, 1.9 + d));
    if (u <= 0) continue;
    const a = H(i, 522) * TAU, r0 = 60 + H(i, 523) * 160, sx = 160 + Math.cos(a) * r0, sy = 74 + Math.sin(a) * r0 * 0.7, c1 = [sx + Math.cos(a + 1.6) * 60, sy + Math.sin(a + 1.6) * 40];
    const [x, y] = u < 1 ? bz2([sx, sy], c1, [tx, ty], u) : [tx, ty];
    const k = (ty - y0) / Math.max(1, y1 - y0), hot = Math.abs(tx - sweep + (ty - 74) * 0.6) < 6;
    const col = u < 1 ? (H(i, 524) > 0.5 ? '#ffe8a8' : '#c8d8ff') : hot ? '#ffffff' : k < 0.45 ? '#fff8ec' : k < 0.75 ? '#ffe2a0' : '#e8b860';
    px(g, x, y, col);
  }
  if (formed > 0) { for (const [tx, ty] of pts) if (ty === y1 || ty === y1 - 1) px(g, tx, ty + 2, hexA('#000000', 0.5 * formed)); }
  const sa = seg(t, 2.9, 3.6);
  if (sa > 0) {
    raw.save(); raw.globalAlpha = sa; raw.fillStyle = '#c8b8a0'; raw.font = '11px Galmuri11, sans-serif'; raw.textAlign = 'center'; raw.textBaseline = 'middle'; raw.fillText('각 인 의   탑', IW / 2, 106); raw.restore();
    line(g, 160 - 30 - 26 * sa, 106, 160 - 34, 106, hexA('#c8b8a0', sa), 1); line(g, 160 + 34, 106, 160 + 30 + 26 * sa, 106, hexA('#c8b8a0', sa), 1);
  }
  rect(g, 0, 0, IW, IH, hexA('#ffffff', 1 - seg(t, 0, 0.7)));
} };

export const ACT3 = [T1, W1, W2, W3, W4, T3, T4, T5, T6, T7, T8];

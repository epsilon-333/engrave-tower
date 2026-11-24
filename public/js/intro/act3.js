// 3막: 빛이 흐려지고 · 네 컷의 전쟁 · 재의 계절 · 마지막 왕 · 해돋이 · 삼백 년 뒤 · 제목
import { IW, IH, H, lerp, seg, eOut, eIn, eIO, hexA, rect, px, poly, circ, ell, line, path, vgrad, glow, stars, RACE_COL, rimmed, rim2, bz2, big, bp, tongue } from './pix.js';
import { tower } from './act1.js';

const TAU = Math.PI * 2, RACES = ['wizard', 'elf', 'knight', 'orc', 'undead', 'assassin', 'dino', 'dragon'];

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

// ───────── 전쟁 ② 붉은 모래 위의 결투: 잿빛 화면에 검은 두 그림자, 피만 붉다 ─────────
// 오크의 칸이 도끼를 치켜든 순간 기사단장이 번개처럼 파고들어 찌른다 → 반전 섬광 → 느린 화면 속에 칸이 피를 토하며 무너진다

// ───────── 전쟁 ③ 망자가 쓰러진 기사들을 일으킨다: 푸른 실이 시체를 끌어올린다 ─────────

// ───────── 전쟁 ④ 그림자 길드가 마탑의 별의 지도를 훔친다: 달빛 창을 가로지르는 도약 ─────────

// ───────── 재의 계절: 잿빛 하늘, 등불 하나 ─────────

// ───────── 마지막 왕: 탑의 문을 향해 홀로 걸어간다 ─────────
const RUNE = ['#.#', '.#.', '#.#', '###', '#..', '##.', '.#.', '###', '.#.', '#..', '###', '..#', '##.', '#.#', '.##'];
function kingFig(g, x, y, s, ph, c, serin = false) {
  big(g, x, y, s, () => {
    const l = Math.sin(ph), sw = Math.sin(ph * 0.5) * 1.5;
    path(g, [[x - 2, y - 12], [x - 3, y - 1 - Math.max(0, l) * 2]], c, 3); path(g, [[x + 2, y - 12], [x + 3, y - 1 - Math.max(0, -l) * 2]], c, 3);
    poly(g, [[x - 6, y - 34], [x + 6, y - 34], [x + 10, y - 13], [x + 12 + sw, y - 3], [x + 4, y - 4], [x, y - 2], [x - 4, y - 4], [x - 12 + sw, y - 3], [x - 10, y - 13]], c); // 망토
    ell(g, x, y - 33, 8, 3, c);
    circ(g, x, y - 38, 3.5, c);
    if (!serin) poly(g, [[x - 4, y - 40], [x - 4, y - 45], [x - 2, y - 43], [x, y - 46], [x + 2, y - 43], [x + 4, y - 45], [x + 4, y - 40]], c); // 왕관
    else { const hs = Math.sin(ph * 0.5) * 1.2; poly(g, [[x - 3, y - 39], [x + 3, y - 39], [x + 2 + hs, y - 30], [x + hs, y - 27], [x - 2 + hs, y - 30]], c); } // 세린: 뒤로 묶은 머리
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
// 탑의 문으로 홀로 걸어 들어가는 뒷모습 (serin: 왕관 · 마법사 대신 혼자, 팔의 문양이 빛난다)
function doorScene(g, t, serin) {
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
  if (!serin) for (const [x, y, s] of [[112, 128, 0.8], [88, 142, 1.0], [56, 162, 1.3], [208, 128, 0.8], [232, 142, 1.0], [264, 162, 1.3]]) {
    const fl = x < 160 ? 1 : -1;
    let tip; rim2(g, '#8a7aa0', '#06040a', (c) => { tip = mage(g, x, y, s, fl, t, c); });
    glow(g, tip[0], tip[1], 7 * s, '#b58aff', 0.7); px(g, tip[0], tip[1], '#f0e8ff');
  }
  // 왕: 뒷모습, 빛을 향해 (가장자리가 하얗게)
  const ky = lerp(184, 122, p), ks = lerp(1.7, 0.5, p), ph = p * 26;
  rim2(g, '#fff4d0', '#050308', (c) => kingFig(g, 160, ky, ks, ph, c, serin));
  if (serin) { const hb = heartbeat(t, 1.1), ax = 160 + 8 * ks, ay = ky - 22 * ks; glow(g, ax, ay, 6 + 10 * ks, '#9af0e0', 0.35 + 0.5 * hb); px(g, ax, ay, '#e8fff8'); } // 팔의 문양
  if (p > 0.82) glow(g, 160, ky - 12 * ks, 30, '#ffffff', seg(p, 0.82, 1));
}
const T4 = { dur: 6.6, text: '마지막 왕은 탑의 문을 닫기 위해 홀로 걸어 들어갔다.', textAt: 0.8, draw: (g, t) => doorScene(g, t, false) };
const SERIN = { dur: 6.6, draw: (g, t) => doorScene(g, t, true) };

// ───────── 문이 닫힌다 → 어둠 → 해가 뜬다 ─────────
// 등 돌린 오크 (해돋이 장면용, 키 40)

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
  rect(g, 0, 0, IW, IH, hexA('#ffffff', 0.12 * hb + seg(t, 3.1, 3.6)));
} };

// ───────── 제목: 별가루가 모여 「아르케」가 된다 ─────────
let TP = null;
function titlePts() {
  if (TP) return TP;
  const c = document.createElement('canvas'); c.width = IW; c.height = IH;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 44px Galmuri11, sans-serif'; x.fillText('각인의 탑', IW / 2, 74);
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
    raw.save(); raw.globalAlpha = sa; raw.fillStyle = '#c8b8a0'; raw.font = '11px Galmuri11, sans-serif'; raw.textAlign = 'center'; raw.textBaseline = 'middle'; raw.fillText('아 르 케   섬', IW / 2, 106); raw.restore();
    line(g, 160 - 30 - 26 * sa, 106, 160 - 34, 106, hexA('#c8b8a0', sa), 1); line(g, 160 + 34, 106, 160 + 30 + 26 * sa, 106, hexA('#c8b8a0', sa), 1);
  }
  rect(g, 0, 0, IW, IH, hexA('#ffffff', 1 - seg(t, 0, 0.7)));
} };

// 새 인트로 · 꿈이 골라 쓰는 장면들
export const PARTS = { T1, T4, SERIN, T6, T7, T8, heartbeat };

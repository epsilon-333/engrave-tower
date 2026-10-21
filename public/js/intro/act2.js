// 2막: 탑의 빛이 닿은 곳마다 여덟 종족이 눈을 뜬다.
// 장면마다 빛의 방향 · 색 · 동작을 다르게 하고, 마지막에 그 종족의 문양(각인)이 몸에 찍힌다.
import { IW, IH, H, clamp, lerp, seg, eOut, eIn, eIO, hexA, rect, px, poly, circ, ell, line, path, vgrad, glow, stars, cover, glyph, RACE_COL, rimmed, bz2, bz3, shakeAt, big, bp, tongue } from './pix.js';
import { tower } from './act1.js';
import { orc, ORC, ORC_PAL, dragonkin, DRK, DRK_PAL, lerpPose, layered } from './body.js';

const RD = 4.2, TAU = Math.PI * 2;

// 탑에서 흘러온 빛의 바람이 (tx, ty)로 모여든다
export function windIn(g, t, tx, ty, o = {}) {
  const t0 = o.t0 ?? 0.05, t1 = o.t1 ?? 0.95, sx = o.sx ?? -20, sy = o.sy ?? -10, col = o.col ?? '#ffe6a8';
  for (let i = 0; i < 6; i++) {
    const ts = t0 + i * 0.05, te = t1 - (5 - i) * 0.03, u = (t - ts) / (te - ts);
    if (u <= 0 || u > 1.4) continue;
    const p0 = [sx + (i - 2.5) * 6, sy + i * 14], p1 = [lerp(sx, tx, 0.5) + (i - 2.5) * 22, lerp(sy, ty, 0.15) - 10 + i * 6];
    for (let j = 0; j < 14; j++) {
      const uu = u - j * 0.028; if (uu < 0 || uu > 1) continue;
      const [x, y] = bz2(p0, p1, [tx, ty], uu);
      px(g, x, y + Math.sin(uu * 11 + i * 2) * 3 * (1 - uu), j < 2 ? '#ffffff' : j < 6 ? col : hexA(col, 0.5 * (1 - j / 14)));
    }
  }
  const k = seg(t, t1 - 0.15, t1 + 0.5);
  if (k > 0 && k < 1) glow(g, tx, ty, 8 + 10 * k, col, 0.8 * (1 - k));
}
// 각인: 큰 문양이 몸 위로 내려앉아 찍히고, 하얗게 번쩍인 뒤 빛가루가 흩어진다
export function stamp(g, raw, race, x, y, t, t0) {
  const k = t - t0; if (k < 0) return;
  if (k < 0.24) { glyph(g, race, x, y, 4 - Math.floor(k / 0.08), 0.35 + k * 2.6); return; }
  if (k < 0.5) glow(g, x, y, 34, '#ffffff', 0.9 * (1 - (k - 0.24) / 0.26));
  glyph(g, race, x, y, 1, 1);
  for (let i = 0; i < 12; i++) {
    const a = k - 0.24 - H(i, 91) * 0.1; if (a < 0 || a > 0.75) continue;
    const ang = H(i, 92) * TAU, r = 5 + a * 28;
    px(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.8 - a * 8, a < 0.3 ? '#ffffff' : RACE_COL[race]);
  }
}
// 눈 덮인 봉우리: 왼쪽(오로라 쪽)은 밝고 오른쪽은 그늘
function snowPeaks(g, peaks, base) {
  for (const [x, y, w] of peaks.slice().sort((a, b) => b[1] - a[1])) {
    const hgt = base - y, d = hgt * 0.42, k = d / hgt, L = [x - w * k, y + d], R = [x + w * k, y + d];
    poly(g, [[x - w, base], [x, y], [x + w, base]], '#14244a');
    const jag = [0.25, 0.5, 0.75].map((q, i) => [lerp(L[0], R[0], q), y + d + (i % 2 ? -3 : 3) * (w / 40)]);
    poly(g, [[x, y], L, jag[0], [x, y + d * 0.75]], '#7a9ad0');
    poly(g, [[x, y], [x, y + d * 0.75], jag[1], jag[2], R], '#3a5688');
    line(g, x, y, L[0], L[1], '#a8e8e0', 1);
  }
}
// 두 점 사이 지그재그 번개
function bolt(g, x0, y0, x1, y1, seed, c, n = 5, amp = 3) {
  const pts = [[x0, y0]];
  for (let i = 1; i < n; i++) { const k = i / n; pts.push([lerp(x0, x1, k) + (H(seed, i, 1) - 0.5) * amp * 2, lerp(y0, y1, k) + (H(seed, i, 2) - 0.5) * amp * 2]); }
  pts.push([x1, y1]); path(g, pts, c, 1);
}

// ───────── 마법사: 눈 덮인 고원 · 오로라. 지팡이 끝이 불 → 얼음 → 번개로 바뀌며 별자리를 긋는다 ─────────
const W_ST = [[214, 18], [248, 44], [214, 70], [180, 44], [214, 44]]; // 북 · 동 · 남 · 서 · 가운데
const W_LN = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [3, 1]];
const ELEM = ['#ff8a3a', '#8ae4ff', '#fff27a'];
const W_MT = [[0, 124], [0, 108], [18, 100], [34, 106], [58, 84], [74, 96], [96, 90], [118, 104], [146, 94], [170, 76], [188, 92], [212, 86], [236, 100], [262, 82], [284, 94], [304, 88], [320, 96], [320, 124]];
function aurora(g, t, k) {
  for (let x = 0; x < IW; x++) {
    const y = 34 + Math.sin(x * 0.021 + t * 0.5) * 11 + Math.sin(x * 0.057 - t * 0.8) * 5;
    const L = 16 + Math.sin(x * 0.11 + t * 1.3) * 6 + Math.sin(x * 0.031 + 1) * 7, b = k * (0.7 + 0.3 * Math.sin(x * 0.083 - t * 2.2));
    rect(g, x, y - 2, 1, 2, hexA('#8affd0', 0.5 * b));
    rect(g, x, y - 2 - L * 0.4, 1, L * 0.4, hexA('#30c89a', 0.28 * b));
    rect(g, x, y - 2 - L, 1, L * 0.6, hexA('#8a5aff', 0.14 * b));
    const y2 = 64 + Math.sin(x * 0.017 - t * 0.4 + 2) * 8;
    rect(g, x, y2 - 6, 1, 6, hexA('#4ae0b0', 0.1 * b));
  }
}
function wizardFig(g, bx, by, t, k, c) {
  const f = Math.sin(t * 5), f2 = Math.sin(t * 5 + 1.3);
  poly(g, [[bx - 3, by - 39], [bx - 13 + f, by - 35], [bx - 22 + f2 * 2, by - 30], [bx - 15, by - 29], [bx - 5, by - 32]], c); // 바람에 날리는 어깨망토
  poly(g, [[bx - 4, by - 39], [bx + 4, by - 39], [bx + 7, by - 22], [bx + 10, by - 2], [bx + 6, by], [bx - 6, by], [bx - 13 + f2 * 1.5, by - 1], [bx - 9, by - 14], [bx - 6, by - 28]], c); // 로브
  circ(g, bx + 1, by - 42, 3.2, c); px(g, bx + 4, by - 42, c);
  poly(g, [[bx - 6, by - 44], [bx + 8, by - 44], [bx + 7, by - 46], [bx - 5, by - 46]], c); // 챙
  poly(g, [[bx - 3, by - 45], [bx + 5, by - 45], [bx + 1, by - 52], [bx - 5, by - 57], [bx - 10 + f, by - 56], [bx - 4, by - 53]], c); // 끝이 꺾인 고깔
  const hx = lerp(bx + 9, bx + 12, k), hy = lerp(by - 29, by - 50, k);
  path(g, [[bx + 2, by - 37], [lerp(bx + 8, bx + 9, k), lerp(by - 33, by - 43, k)], [hx, hy]], c, 2);
  const tx = hx + 3, ty = hy - 22;
  path(g, [[hx - 2, hy + 18], [tx, ty]], c, 1);
  path(g, [[tx - 2, ty + 2], [tx - 3, ty - 2], [tx, ty - 5], [tx + 3, ty - 2], [tx + 2, ty + 2]], c, 1);
  return [tx + 0.5, ty - 1];
}
const RW = { dur: RD, text: '별을 읽는 마법사', textAt: 0.5, draw(g, t, raw) {
  const done = seg(t, 2.8, 3.1), pulse = 0.5 + 0.5 * Math.sin(t * 9);
  vgrad(g, 0, 128, [[0, '#02040e'], [0.55, '#081634'], [1, '#1a3060']]);
  stars(g, 120, 71, 120, t, 0.9);
  aurora(g, t, 0.7 + 0.6 * done);
  poly(g, W_MT, '#0c1834');
  snowPeaks(g, [[58, 84, 46], [170, 74, 54], [266, 80, 50], [120, 98, 34], [214, 90, 38], [12, 100, 30], [306, 94, 30]], 122);
  vgrad(g, 118, IH, [[0, '#1c3460'], [0.35, '#45679c'], [1, '#93b0dc']]);
  path(g, [[0, 150], [40, 146], [92, 151]], '#a8c4ec', 1); path(g, [[170, 160], [230, 154], [320, 158]], '#a8c4ec', 1); path(g, [[200, 136], [260, 133], [320, 136]], '#6a88b8', 1);
  // 별자리: 지팡이가 긋는 선
  const lit = [false, false, false, false, done > 0];
  let beam = null;
  W_LN.forEach(([a, b], i) => {
    const s0 = 1.0 + i * 0.3, u = seg(t, s0, s0 + 0.24); if (u <= 0) return;
    const A = W_ST[a], B = W_ST[b], ex = lerp(A[0], B[0], eOut(u)), ey = lerp(A[1], B[1], eOut(u)), age = t - s0 - 0.24;
    const col = age > 0.45 ? (done > 0 ? '#e8f4ff' : '#a8c8f0') : ELEM[i % 3];
    line(g, A[0], A[1], ex, ey, hexA(col, done > 0 ? 0.65 + 0.35 * pulse : 0.9), 1);
    lit[a] = true; if (u >= 1) lit[b] = true; else beam = [ex, ey, ELEM[i % 3]];
  });
  W_ST.forEach(([x, y], i) => {
    if (!lit[i]) { px(g, x, y, '#5a6a98'); return; }
    glow(g, x, y, i === 4 ? 10 + 6 * done : 6, '#bcd8ff', 0.6);
    px(g, x - 1, y, '#bcd8ff'); px(g, x + 1, y, '#bcd8ff'); px(g, x, y - 1, '#bcd8ff'); px(g, x, y + 1, '#bcd8ff'); px(g, x, y, '#ffffff');
  });
  // 바위와 마법사 (오로라가 위에서 테두리를 비춘다)
  const bx = 98, by = 152, S = 1.4;
  big(g, bx, by, S, () => {
  poly(g, [[bx - 26, by + 14], [bx - 22, by + 2], [bx - 14, by - 3], [bx + 2, by - 2], [bx + 14, by + 1], [bx + 24, by + 10], [bx + 30, by + 14]], '#0a1428');
  poly(g, [[bx - 22, by + 2], [bx - 14, by - 3], [bx + 2, by - 2], [bx + 14, by + 1], [bx + 10, by + 3], [bx - 2, by + 1], [bx - 14, by], [bx - 20, by + 4]], '#b8cdf0');
  });
  const raise = eIO(seg(t, 0.45, 1.0));
  let tip;
  rimmed(g, '#7affd0', '#03060e', 1, 1, (c) => big(g, bx, by, S, () => { tip = bp(bx, by, S, wizardFig(g, bx, by, t, raise, c)); }));
  // 지팡이 끝: 불 → 얼음 → 번개
  if (t > 0.9) {
    const ei = t < 2.8 ? Math.floor(Math.max(0, t - 1.0) / 0.3) % 3 : -1, col = ei < 0 ? '#cfe8ff' : ELEM[ei], [ox, oy] = tip;
    glow(g, ox, oy, 12 + 4 * pulse, col, 0.85); circ(g, ox, oy, 1.6, '#ffffff');
    if (ei === 0) for (let j = 0; j < 7; j++) { const a = (t * 2.2 + j / 7) % 1; px(g, ox + Math.sin(j * 2 + t * 9) * 2.2 * (1 - a), oy - 2 - a * 9, a < 0.35 ? '#fff0a0' : a < 0.7 ? '#ff8a2a' : '#a83a1a'); }
    if (ei === 1) for (let j = 0; j < 4; j++) { const a = t * 3 + j * Math.PI / 2, x = ox + Math.cos(a) * 5, y = oy + Math.sin(a) * 4; px(g, x, y, '#ffffff'); px(g, x - 1, y, '#8ae4ff'); px(g, x + 1, y, '#8ae4ff'); px(g, x, y - 1, '#8ae4ff'); px(g, x, y + 1, '#8ae4ff'); }
    if (ei === 2) { const f = Math.floor(t * 24); for (let j = 0; j < 3; j++) { const a = H(f, j) * TAU; bolt(g, ox, oy, ox + Math.cos(a) * 9, oy + Math.sin(a) * 7, f * 3 + j, '#fff8c0', 3, 2); } }
    if (beam) line(g, ox, oy, beam[0], beam[1], hexA(beam[2], 0.5), 1);
  } else windIn(g, t, tip[0], tip[1], { sx: -20, sy: -20 });
  // 눈보라 (바람이 왼쪽으로)
  for (let i = 0; i < 110; i++) {
    const d = H(i, 61), x = ((H(i, 62) * 380 - t * (26 + d * 40)) % 380 + 380) % 380 - 30, y = (H(i, 63) * 190 + t * (12 + d * 26)) % 190 - 5;
    if (d > 0.85) rect(g, x, y, 2, 2, '#e8f2ff'); else px(g, x, y, d > 0.4 ? '#e0ecff' : hexA('#c8d8f0', 0.6));
  }
  stamp(g, raw, 'wizard', ...bp(bx, by, S, [bx + 2, by - 29]), t, 3.0);
} };

// ───────── 엘프: 세계수 숲. 빛이 정령이 되어 어깨에 내려앉고, 빛의 화살을 쏜다 ─────────
function worldTree(g, cx, base, c, rc, t) {
  poly(g, [[cx - 36, base], [cx - 15, base - 14], [cx - 10, base - 60], [cx - 14, base - 92], [cx - 4, base - 102], [cx + 6, base - 102], [cx + 14, base - 90], [cx + 10, base - 60], [cx + 15, base - 14], [cx + 38, base]], c);
  for (const [x1, y1, x2, y2, w] of [[cx - 4, base - 96, cx - 62, base - 132, 6], [cx - 62, base - 132, cx - 96, base - 140, 3], [cx + 4, base - 96, cx + 54, base - 136, 6], [cx + 54, base - 136, cx + 90, base - 144, 3], [cx, base - 100, cx - 8, base - 150, 5]]) line(g, x1, y1, x2, y2, c, w);
  const B = [[cx - 84, base - 140, 30, 13], [cx - 44, base - 152, 36, 17], [cx, base - 160, 40, 19], [cx + 46, base - 153, 36, 17], [cx + 86, base - 141, 30, 13], [cx - 62, base - 126, 24, 10], [cx + 68, base - 127, 24, 10], [cx - 20, base - 136, 28, 10], [cx + 24, base - 136, 28, 10]];
  for (const [x, y, rx, ry] of B) ell(g, x, y - 1, rx, ry, rc);
  for (const [x, y, rx, ry] of B) ell(g, x + 1, y + 1, rx, ry, c);
  for (let i = 0; i < 26; i++) { const x = cx - 100 + H(i, 71) * 200, y = base - 165 + H(i, 72) * 50, tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7); if (tw > 0.3) { px(g, x, y, hexA('#e0ffa0', tw)); if (tw > 0.85) glow(g, x, y, 4, '#c8ff8a', 0.4); } }
}
export function fern(g, x, y, len, a0, curl, c) {
  let cx = x, cy = y, a = a0; const pts = [[x, y]];
  for (let i = 1; i <= 12; i++) {
    a += curl; cx += Math.cos(a) * len / 12; cy += Math.sin(a) * len / 12;
    const lf = (1 - i / 13) * len * 0.24;
    line(g, cx, cy, cx + Math.cos(a - 1.1) * lf, cy + Math.sin(a - 1.1) * lf, c, 1.5);
    line(g, cx, cy, cx + Math.cos(a + 1.1) * lf, cy + Math.sin(a + 1.1) * lf, c, 1.5);
    pts.push([cx, cy]);
  }
  path(g, pts, c, 2);
}
function elfFig(g, bx, by, t, pull, vib, c) {
  const f = Math.sin(t * 4), f2 = Math.sin(t * 4 + 1.1);
  poly(g, [[bx - 3, by - 38], [bx - 11 + f, by - 30], [bx - 16 + f2 * 2, by - 17], [bx - 8, by - 19], [bx - 1, by - 28]], c); // 망토
  path(g, [[bx, by - 22], [bx + 7, by - 11], [bx + 11, by]], c, 3); path(g, [[bx - 1, by - 22], [bx - 6, by - 11], [bx - 11, by]], c, 3);
  poly(g, [[bx - 3, by - 39], [bx + 4, by - 39], [bx + 3, by - 22], [bx - 3, by - 22]], c);
  circ(g, bx + 2, by - 44, 3, c);
  poly(g, [[bx, by - 46], [bx + 1, by - 43], [bx - 8, by - 51]], c); // 긴 귀
  poly(g, [[bx - 1, by - 47], [bx - 9 + f, by - 44], [bx - 13 + f2, by - 37], [bx - 6, by - 41]], c); // 묶은 머리칼
  path(g, [[bx + 3, by - 37], [bx + 10, by - 38], [bx + 17, by - 38]], c, 2); // 활 든 팔
  const bend = pull * 2, sx = lerp(bx + 13, bx + 3, pull) + vib, sy = by - 39;
  path(g, [[bx + 1, by - 37], [lerp(bx + 8, bx - 6, pull), lerp(by - 33, by - 37, pull)], [sx - vib, sy]], c, 2); // 시위 당기는 팔
  path(g, [[bx + 13 - bend, by - 55], [bx + 18, by - 50], [bx + 20 + bend * 0.5, by - 43], [bx + 17, by - 38], [bx + 20 + bend * 0.5, by - 33], [bx + 18, by - 26], [bx + 13 - bend, by - 21]], c, 1.5);
  path(g, [[bx + 13 - bend, by - 55], [sx, sy], [bx + 13 - bend, by - 21]], c, 1);
  return [sx, sy];
}
const LEAF = Array.from({ length: 16 }, (_, i) => ({ x: 140 + H(i, 81) * 180, d: H(i, 82) * 0.2, w: H(i, 83) }));
const RE = { dur: RD, text: '정령과 맺어진 엘프', textAt: 0.5, draw(g, t, raw) {
  const rel = t >= 2.4, fl = rel ? 1 - seg(t, 2.4, 2.9) : 0;
  vgrad(g, 0, IH, [[0, '#0b1d12'], [0.5, '#163a22'], [1, '#07140a']]);
  worldTree(g, 222, 172, '#10301c', '#24603a', t);
  for (let i = 0; i < 4; i++) { const x0 = 10 + i * 60 + H(i, 4) * 20, w = 14 + H(i, 3) * 16, d = 0.05 + 0.025 * Math.sin(t * 1.2 + i) + 0.1 * fl; g.ditherPoly([[x0 - 6, 0], [x0 + w + 6, 0], [x0 + w + 106, IH], [x0 + 64, IH]], '#c8f0a0', d * 0.5); g.ditherPoly([[x0, 0], [x0 + w, 0], [x0 + w + 92, IH], [x0 + 72, IH]], '#e0ffb8', d); }
  for (const [x, w] of [[26, 8], [58, 5], [298, 7]]) { rect(g, x, 0, w, 162, '#08180d'); line(g, x + w / 2, 60, x + w / 2 + (x < 160 ? 18 : -18), 40, '#08180d', 2); line(g, x + w / 2, 100, x + w / 2 + (x < 160 ? -14 : 14), 84, '#08180d', 2); }
  poly(g, [[0, 160], [60, 157], [140, 161], [220, 158], [320, 160], [320, IH], [0, IH]], '#050f07');
  for (let x = 0; x < IW; x += 3) { const h = 2 + H(x, 84) * 4, bend = Math.sin(t * 2 + x * 0.1) + (rel && x > 110 ? 3 * fl : 0); line(g, x, 160, x + bend, 160 - h, '#0a2010', 1); }
  for (let i = 0; i < 30; i++) { const x = (H(i, 85) * IW + t * 6) % IW, y = 150 - ((H(i, 86) * 150 + t * (4 + H(i, 87) * 6)) % 150); px(g, x, y, hexA('#e8ffb0', 0.3 + 0.4 * H(i, 88))); }
  // 엘프
  const bx = 92, by = 163, S = 1.4, pull = rel ? 0 : eOut(seg(t, 1.5, 2.2)), vib = rel ? Math.sin((t - 2.4) * 90) * 2 * (1 - seg(t, 2.4, 2.8)) : 0;
  let sp;
  rimmed(g, '#c8ff8a', '#020804', 1, 1, (c) => big(g, bx, by, S, () => { sp = bp(bx, by, S, elfFig(g, bx, by, t, pull, vib, c)); }));
  const shd = bp(bx, by, S, [bx - 4, by - 44]), aT = bp(bx, by, S, [bx + 27, by - 39]), aS = bp(bx, by, S, [bx + 20, by - 39]);
  // 빛의 바람 → 정령: 공중에서 깨어나 맴돌다 어깨에 앉는다
  windIn(g, t, 60, 74, { t1: 0.6, sx: -20, sy: -30 });
  const wispAt = (tt) => { if (tt < 0.6) return null; if (tt >= 1.5) return [shd[0], shd[1] + Math.sin(tt * 4) * 1.2]; const u = eIO(seg(tt, 0.6, 1.5)), [x, y] = bz3([60, 74], [20, 20], [150, 30], shd, u); return [x + Math.cos(u * 14) * 9 * (1 - u), y + Math.sin(u * 14) * 6 * (1 - u)]; };
  const wp = wispAt(t);
  if (wp) {
    for (let j = 10; j >= 1; j--) { const q = wispAt(t - j * 0.035); if (q) px(g, q[0], q[1], hexA('#9affb8', 0.8 * (1 - j / 11))); }
    glow(g, wp[0], wp[1], 10 + 2 * Math.sin(t * 8), '#7affa0', 0.75); circ(g, wp[0], wp[1], 1.5, '#f0fff0');
  }
  // 빛의 화살: 정령의 빛이 화살에 감기고, 놓으면 화면을 가르며 날아간다
  if (!rel && pull > 0.15) {
    const ax = aT[0]; line(g, sp[0] - 1, sp[1], ax, sp[1], '#f0ffe0', 1); glow(g, ax, sp[1], 6 + 3 * pull, '#9affb0', 0.7 * pull);
    px(g, ax + 1, sp[1], '#ffffff'); px(g, ax, sp[1] - 1, '#d8ffc8'); px(g, ax, sp[1] + 1, '#d8ffc8');
    if (wp) for (let j = 0; j < 8; j++) { const s = (t * 2.5 + j / 8) % 1, q = [lerp(wp[0], ax - 6, s), lerp(wp[1], sp[1], s) - Math.sin(s * Math.PI) * 6]; px(g, q[0], q[1], '#b8ffc8'); }
  }
  if (rel) {
    const a = t - 2.4, x0 = aS[0], y0 = aS[1], head = x0 + a * 900;
    const k = seg(t, 2.4, 3.1);
    if (k < 1) { line(g, x0, y0, Math.min(head, 340), y0, hexA('#7aff9a', 0.4 * (1 - k)), 3); line(g, x0, y0, Math.min(head, 340), y0, hexA('#ffffff', 1 - k), 1); }
    if (a < 0.06) glow(g, x0, y0, 16, '#d8ffb0', 0.9);
    if (head < 330) { glow(g, head, y0, 10, '#c8ffb0', 0.9); rect(g, head - 3, y0, 4, 1, '#ffffff'); }
    for (const L of LEAF) { // 화살이 지나간 자리에 잎이 흩날린다
      const la = t - 2.45 - L.d - (L.x - 140) / 900; if (la < 0 || L.x > head) continue;
      const x = L.x + la * (10 + L.w * 20) + Math.sin(la * 6 + L.w * 9) * 4, y = y0 + (L.w - 0.5) * 10 + la * (14 + L.w * 10);
      const s = Math.sin(la * 9 + L.w * 7) > 0; rect(g, x, y, s ? 2 : 1, 1, L.w > 0.5 ? '#3a8a3a' : '#9ad86a'); px(g, x + (s ? 2 : 1), y, '#0a2a10');
    }
  }
  fern(g, -6, 184, 54, -1.0, 0.07, '#020803'); fern(g, 8, 186, 40, -1.4, 0.1, '#020803'); fern(g, 326, 184, 54, -2.1, -0.07, '#020803'); fern(g, 312, 188, 44, -1.8, -0.09, '#020803');
  stamp(g, raw, 'elf', ...bp(bx, by, S, [bx + 1, by - 31]), t, 3.0);
} };

// ───────── 기사: 노을 속 무너진 성. 쏟아지는 화살을 방패로 받아 내고, 검을 꽂으면 황금빛이 오른다 ─────────
function castle(g, c, t) {
  poly(g, [[34, 124], [36, 58], [33, 56], [33, 50], [38, 50], [38, 46], [42, 46], [42, 50], [46, 50], [46, 44], [50, 47], [54, 42], [56, 52], [60, 52], [61, 124]], c);
  poly(g, [[60, 124], [60, 88], [64, 88], [64, 85], [68, 85], [68, 88], [72, 88], [72, 85], [76, 85], [76, 88], [82, 90], [86, 96], [90, 94], [94, 100], [98, 98], [98, 124]], c);
  poly(g, [[98, 124], [99, 74], [96, 72], [96, 66], [100, 66], [100, 69], [104, 69], [104, 66], [108, 66], [108, 69], [112, 69], [112, 66], [116, 66], [116, 72], [113, 74], [114, 124]], c);
  poly(g, [[114, 124], [114, 104], [120, 100], [124, 106], [130, 110], [138, 124]], c);
  for (const [x, y] of [[44, 68], [44, 88], [104, 82], [104, 100]]) { rect(g, x, y, 3, 5, '#d8603a'); px(g, x + 1, y - 1, '#d8603a'); }
  line(g, 52, 44, 52, 22, c, 1);
  for (let i = 0; i < 15; i++) { if (i === 9 || i === 12) continue; const y0 = 23 + Math.sin(i * 0.55 - t * 6) * 1.6 + i * 0.15, h = 9 - i * 0.3 - (i > 10 ? 2 : 0); rect(g, 53 + i, y0, 1, h, c); }
}
export function knightFig(g, bx, by, fl, t, up, plant, c) {
  const X = (x) => bx + x * fl, P = (x, y) => [X(x), by + y], f = Math.sin(t * 5), f2 = Math.sin(t * 5 + 1.2);
  poly(g, [P(-4, -40), P(-13 + f, -30), P(-19 + f2 * 1.5, -12), P(-17 + f, -1), P(-8, -5), P(-3, -24)], c); // 망토
  path(g, [P(0, -24), P(7, -12), P(11, 0)], c, 4); path(g, [P(-1, -24), P(-6, -12), P(-10, 0)], c, 4);
  poly(g, [P(9, -2), P(15, -1), P(15, 1), P(9, 1)], c); poly(g, [P(-12, -2), P(-6, -1), P(-6, 1), P(-12, 1)], c);
  poly(g, [P(-5, -41), P(6, -41), P(7, -31), P(4, -23), P(-4, -23), P(-6, -31)], c);
  poly(g, [P(-6, -25), P(6, -25), P(8, -17), P(-7, -17)], c);
  ell(g, X(-5), by - 39, 4, 3, c); ell(g, X(6), by - 39, 4, 3, c);
  poly(g, [P(-2, -51), P(5, -51), P(6, -46), P(5, -42), P(-3, -42), P(-3, -47)], c); // 투구
  poly(g, [P(0, -51), P(-6, -54 + f), P(-14, -52 + f2), P(-18, -47 + f), P(-10, -49), P(-3, -49)], c); // 깃털 장식
  // 검: 아래로 늘어뜨렸다가 몸 앞 땅에 꽂는다
  const hd = [lerp(X(-6), X(5), plant), lerp(by - 24, by - 30, plant)], tip = [lerp(X(-15), X(5), plant), lerp(by - 5, by + 4, plant)];
  path(g, [P(-4, -38), [lerp(X(-8), X(1), plant), lerp(by - 31, by - 34, plant)], hd], c, 3);
  const dx = tip[0] - hd[0], dy = tip[1] - hd[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  path(g, [[hd[0] - ux * 3, hd[1] - uy * 3], tip], c, 2);
  line(g, hd[0] + ux * 2 - uy * 4, hd[1] + uy * 2 + ux * 4, hd[0] + ux * 2 + uy * 4, hd[1] + uy * 2 - ux * 4, c, 1.5);
  // 방패 팔 · 연 모양 방패 (몸 앞으로 내밀어 윤곽이 보이게)
  const sx = lerp(12, 14, up) - 2 * plant, sy = lerp(-30, -40, up) + 4 * plant, cx = sx + 4, cy = sy;
  path(g, [P(6, -38), P(10, lerp(-32, -38, up)), P(sx, sy)], c, 3);
  poly(g, [P(cx - 6, cy - 10), P(cx + 6, cy - 10), P(cx + 7, cy - 3), P(cx, cy + 12), P(cx - 7, cy - 3)], c);
  return [X(cx), by + cy - 1];
}
const ARW = Array.from({ length: 16 }, (_, i) => ({ t0: i === 0 ? 0.9 : 0.72 + H(i, 101) * 0.42, sx: -10 - H(i, 102) * 50, sy: 6 + H(i, 103) * 46, hit: i < 9, gx: 120 + H(i, 104) * 150, gy: 158 + H(i, 105) * 10, oy: (H(i, 106) - 0.5) * 14 }));
const RK = { dur: RD, text: '맹세를 지키는 기사', textAt: 0.5, draw(g, t, raw) {
  const bx = 200, by = 164, S = 1.3, up = eOut(seg(t, 1.0, 1.35)) * (1 - seg(t, 1.9, 2.1)), plant = eIn(seg(t, 2.0, 2.22)), gold = seg(t, 2.22, 2.6);
  const [sx0, sy0] = shakeAt(t, 2.22, 0.35, 2);
  g.save(); g.translate(sx0, sy0);
  vgrad(g, 0, 125, [[0, '#1a0614'], [0.35, '#5a1424'], [0.7, '#c0402a'], [0.9, '#ff9a4a'], [1, '#ffd88a']]);
  glow(g, 78, 96, 70, '#ffb050', 0.5);
  circ(g, 78, 96, 18, '#ffb860'); circ(g, 77, 95, 15, '#ffd890'); circ(g, 76, 94, 11, '#fff0c8');
  for (let i = 0; i < 4; i++) rect(g, 20 + i * 70 + Math.sin(t * 0.5 + i) * 6, 70 + i * 9, 60 + i * 10, 1, hexA('#5a1a2a', 0.8));
  castle(g, '#1a0810', t);
  vgrad(g, 124, IH, [[0, '#3a1218'], [0.2, '#1c0a12'], [1, '#0a0408']]);
  for (const [x, a] of [[22, -0.3], [146, 0.25], [262, -0.2], [300, 0.35], [168, -0.15]]) { const y = 124 + (x % 7); line(g, x, y + 4, x + Math.sin(a) * 12, y - 10, '#120610', 1.5); line(g, x + Math.sin(a) * 9 - 3, y - 7, x + Math.sin(a) * 9 + 3, y - 7 + a * 2, '#120610', 1); } // 옛 전장에 꽂힌 검들
  for (let x = 0; x < IW; x += 2) { const h = 1 + H(x, 107) * 3; line(g, x, 125, x + Math.sin(t * 2 + x * 0.2) * 0.8, 125 - h, '#2a0c14', 1); }
  // 황금빛 기둥과 오르는 빛가루
  if (gold > 0) {
    const fade = 1 - seg(t, 3.6, 4.2) * 0.6;
    glow(g, bx - 4, by - 40, 70, '#ffd060', 0.4 * gold * fade);
    g.ditherEllipse(bx - 4, by + 2, 46 * gold, 5 * gold, '#ffd880', 0.35 * fade);
    for (let i = 0; i < 46; i++) { const a = ((t - 2.22) * (0.5 + H(i, 108)) + H(i, 109)) % 1.2; const x = bx + (H(i, 110) - 0.5) * 96, y = by + 2 - a * 120; if (a < 1.1) { px(g, x, y, a < 0.4 ? '#ffffff' : '#ffe08a'); px(g, x, y + 1, hexA('#ffc84a', 0.6)); } }
  }
  // 화살
  const shield = bp(bx, by, S, [bx - 17, by - 37]);
  for (const A of ARW) {
    const u = (t - A.t0) / 0.7; if (u < 0) continue;
    const tx = A.hit ? shield[0] : A.gx, ty = A.hit ? shield[1] + A.oy : A.gy;
    const at = (q) => [lerp(A.sx, tx, q), lerp(A.sy, ty, q) - Math.sin(q * Math.PI) * 30];
    if (u < 1) { const [x, y] = at(u), [x2, y2] = at(Math.max(0, u - 0.04)), d = Math.hypot(x - x2, y - y2) || 1, ux = (x - x2) / d, uy = (y - y2) / d; line(g, x - ux * 7, y - uy * 7, x, y, '#0a0306', 1); px(g, x - ux * 7 - uy, y - uy * 7 + ux, '#0a0306'); px(g, x - ux * 7 + uy, y - uy * 7 - ux, '#0a0306'); continue; }
    const a = t - A.t0 - 0.7;
    if (A.hit) { // 튕겨 나가는 부러진 화살 · 불꽃
      const x = tx - a * 50, y = ty - a * 60 + a * a * 160, r = a * 14;
      line(g, x - Math.cos(r) * 3, y - Math.sin(r) * 3, x + Math.cos(r) * 3, y + Math.sin(r) * 3, '#0a0306', 1);
      for (let j = 0; j < 5; j++) { const sa = a - j * 0.01; if (sa > 0.25) continue; px(g, tx - sa * (60 + j * 30), ty + (j - 2) * sa * 50, sa < 0.1 ? '#ffffff' : '#ffb040'); }
    } else { const [x2, y2] = at(0.96), d = Math.hypot(tx - x2, ty - y2) || 1; line(g, tx - (tx - x2) / d * 7, ty - (ty - y2) / d * 7, tx, ty, '#0a0306', 1); if (a < 0.3) g.ditherEllipse(tx, ty, 3 + a * 10, 1 + a * 3, '#5a2a24', 0.5 * (1 - a / 0.3)); }
  }
  // 기사 (노을이 앞쪽 테두리를 비추고, 검을 꽂은 뒤엔 금빛으로)
  const flash = t >= 1.6 && t < 1.67;
  let sc;
  if (flash) { cover(raw, 1, '#fff4dc'); big(g, bx, by, S, () => { sc = bp(bx, by, S, knightFig(g, bx, by, -1, t, up, plant, '#000000')); }); }
  else rimmed(g, gold > 0.3 ? '#ffe08a' : '#ff9a5a', '#0a0406', 1, 0, (c) => big(g, bx, by, S, () => { sc = bp(bx, by, S, knightFig(g, bx, by, -1, t, up, plant, c)); }));
  // 막아 낸 순간의 불꽃
  const pk = seg(t, 1.6, 1.9);
  if (pk > 0 && pk < 1) {
    const L = (1 - pk) * 30, [cx, cy] = bp(bx, by, S, [bx - 23, by - 38]);
    glow(g, cx, cy, 26 * (1 - pk), '#fff0b0', 0.9);
    line(g, cx - L, cy, cx + L * 0.6, cy, '#ffffff', 1); line(g, cx, cy - L * 0.8, cx, cy + L * 0.8, '#ffffff', 1);
    line(g, cx - L * 0.45, cy - L * 0.45, cx + L * 0.45, cy + L * 0.45, '#fff0b0', 1); line(g, cx - L * 0.45, cy + L * 0.45, cx + L * 0.45, cy - L * 0.45, '#fff0b0', 1);
    circ(g, cx, cy, 2 * (1 - pk) + 0.5, '#ffffff');
  }
  if (t >= 2.22 && t < 2.5) { const a = t - 2.22; g.ditherEllipse(bx - 5, by + 3, 6 + a * 60, 1.5 + a * 8, '#c8805a', 0.6 * (1 - a / 0.28)); }
  windIn(g, t, ...bp(bx, by, S, [bx - 4, by - 34]), { sx: -20, sy: 10 });
  g.restore();
  stamp(g, raw, 'knight', sc[0], sc[1], t, 3.0);
} };

// ───────── 오크: 붉은 투기장. 고개를 들면 눈에 분노의 불이 붙고, 도끼를 머리 위로 들어 내리찍는다 ─────────
function arena(g, t, jump) {
  vgrad(g, 0, 60, [[0, '#1a0303'], [1, '#5a1006']]);
  rect(g, 0, 32, IW, 28, '#2a0806');
  for (let row = 0; row < 3; row++) for (let x = (row % 2) * 2; x < IW; x += 4) { const j = jump * Math.abs(Math.sin(t * 14 + x * 0.7)) * 2.5, y = 37 + row * 7 - j; circ(g, x, y, 1.6, '#140303'); if (H(x, row) > 0.7) line(g, x + 1, y, x + 2, y - 3 - j, '#140303', 1); }
  rect(g, 0, 58, IW, 40, '#3a0c08'); rect(g, 0, 58, IW, 2, '#5a160c');
  for (let x = 8; x < IW; x += 32) { circ(g, x + 8, 74, 8, '#1a0504'); rect(g, x, 74, 16, 24, '#1a0504'); }
  for (let x = 24; x < IW; x += 64) { const w = Math.sin(t * 3 + x) * 1; poly(g, [[x - 4, 60], [x + 4, 60], [x + 4 + w, 76], [x, 73], [x - 4 + w, 76]], '#7a160e'); }
  for (let x = 0; x < IW; x += 64) { const fx = x + 24 + 16, fy = 64; glow(g, fx, fy, 14, '#ff8a3a', 0.5 + 0.2 * Math.sin(t * 20 + x)); px(g, fx, fy, '#ffe080'); px(g, fx, fy - 1, '#ffb040'); px(g, fx + (Math.sin(t * 25 + x) > 0 ? 1 : -1), fy - 2, '#ff6a2a'); }
  vgrad(g, 98, IH, [[0, '#6a240e'], [0.25, '#a03c1a'], [1, '#3a1006']]);
  for (let i = 0; i < 26; i++) { const y = 104 + i * 3, x0 = (i * 37) % 60; rect(g, x0, y, 40 + (i * 13) % 50, 1, hexA('#5a1a08', 0.5)); rect(g, x0 + 160, y + 1, 30 + (i * 17) % 40, 1, hexA('#c8603a', 0.3)); }
}
const CRK = Array.from({ length: 8 }, (_, i) => ({ a: Math.PI * (i / 7) + (H(i, 131) - 0.5) * 0.3, L: 50 + H(i, 132) * 50 }));
const RO = { dur: RD, text: '분노로 싸우는 오크', textAt: 0.5, draw(g, t, raw) {
  const look = eIO(seg(t, 0.45, 0.95)), lift = eIO(seg(t, 1.05, 1.6)), slam = eIn(seg(t, 1.72, 1.84)), hit = t >= 1.84, a = t - 1.84;
  const bx = 120, by = 166, S = 1.5, I = bp(bx, by, S, [bx + 34, by]), P = (x, y) => [bx + x, by + y];
  const q = slam > 0 ? lerpPose(ORC.raise, ORC.slam, slam) : lift > 0 ? lerpPose(ORC.look, ORC.raise, lift) : lerpPose(ORC.idle, ORC.look, look);
  if (t < 1.05) { const br = Math.sin(t * 3.5) * 0.6; for (const k of ['sh', 'hd']) q[k] = [q[k][0], q[k][1] + br]; for (const k of ['hF', 'hB']) q[k] = [q[k][0], q[k][1] + br * 0.5]; } // 거친 숨
  const ax = slam > 0 ? lerp(-2.6, 0.75, slam) : lerp(-1.15, -2.6, lift);
  const [sx0, sy0] = shakeAt(t, 1.84, 0.55, 4);
  g.save(); g.translate(sx0, sy0);
  arena(g, t, hit ? 1 - seg(t, 1.84, 3.2) : 0);
  if (hit) { // 땅이 갈라지고, 틈에서 분노의 불빛이 샌다
    const gr = eOut(seg(t, 1.84, 2.04)), hot = 1 - seg(t, 2.1, 3.4);
    CRK.forEach((C, i) => {
      const pts = [[I[0], I[1]]]; for (let j = 1; j <= 5; j++) { const r = C.L * gr * j / 5; pts.push([I[0] + Math.cos(C.a) * r + (H(i, j, 3) - 0.5) * 6, I[1] + Math.sin(C.a) * r * 0.3 + (H(i, j, 4) - 0.5) * 2]); }
      path(g, pts, '#1a0402', 2); if (hot > 0) path(g, pts, hexA('#ff7a2a', hot), 1);
    });
    if (hot > 0) glow(g, I[0], I[1], 26, '#ff5a1a', 0.6 * hot);
  }
  const impact = hit && a < 0.06, rage = seg(t, 0.75, 0.88);
  let F;
  if (impact) { cover(raw, 1, '#ffe8d0'); big(g, bx, by, S, () => { F = orc(g, P, q, '#000000', t, { axe: ax }); }); }
  else { const rim = hit && a < 0.25 ? '#ffd890' : '#ff8a4a', body = [rim, '#7a200c', '#0c0303'];
    F = layered(g, { far: ['#a84020', 0, 0], body, near: body }, 1, 1, (c, layer, pass) => { let r; big(g, bx, by, S, () => { r = orc(g, P, q, c, t, { axe: ax, layer, pass, pal: ORC_PAL }); }); return r; }, true); }
  const ey = bp(bx, by, S, F.eye), mo = bp(bx, by, S, F.mouth);
  if (rage > 0 && !impact) { // 눈에 분노의 불이 붙는다
    const fl = 0.75 + 0.25 * Math.sin(t * 24);
    glow(g, ey[0] + 1, ey[1] + 1, 6 * fl, '#ff2a0a', 0.85 * rage); px(g, ey[0] + 1, ey[1] + 1, '#ffe060'); px(g, ey[0] + 2, ey[1] + 1, '#ff4a1a');
    if (t < 1.05) glow(g, ey[0], ey[1], 14, '#ff3a1a', 0.35 * (1 - seg(t, 0.8, 1.05)));
  }
  for (const ph of [0.1, 0.7, 1.3]) { const b = t - ph; if (b < 0 || b > 0.6) continue; ell(g, mo[0] + 3 + b * 18, mo[1] + 2 + b * 6, 2 + b * 7, 1 + b * 3, hexA('#d8b8b0', 0.4 * (1 - b / 0.6))); } // 거친 콧김
  if (hit) {
    if (a < 1.4) for (const [k, c, ox] of [[1, '#a8562a', 0], [0.7, '#c87038', 6]]) { ell(g, I[0] + ox, I[1] - 4 - a * 12, (12 + a * 70) * k, (5 + a * 20) * k, hexA(c, 0.32 * (1 - a / 1.4))); ell(g, I[0], I[1] - 1, (16 + a * 130) * k, (2 + a * 4) * k, hexA('#e09060', 0.3 * (1 - a / 1.4))); }
    for (let i = 0; i < 90; i++) { // 모래가 튄다
      const pa = a - H(i, 141) * 0.06; if (pa < 0) continue;
      const vx = (H(i, 142) - 0.4) * 180, vy = -(50 + H(i, 143) * 140), x = I[0] + vx * pa, y = I[1] + vy * pa + 210 * pa * pa;
      if (y > I[1] + 6) continue;
      const c = ['#ffd090', '#e8a060', '#c87038', '#8a3a18'][i % 4]; if (i % 7 === 0) rect(g, x, y, 2, 2, c); else px(g, x, y, c);
    }
  }
  windIn(g, t, ...bp(bx, by, S, [bx + 4, by - 42]), { col: '#ffb070', sx: -20, sy: -10, t1: 0.5 });
  g.restore();
  stamp(g, raw, 'orc', ...bp(bx, by, S, F.chest), t, 3.0);
} };

// ───────── 망자: 달빛 묘지. 관 뚜껑이 밀려나고, 넋의 빛을 품은 망자가 일어선다 ─────────
const TOMB = [[24, 120, 0, 10], [96, 118, 1, 12], [124, 122, 0, 8], [206, 119, 2, 14], [232, 121, 1, 10], [282, 118, 0, 12], [306, 122, 2, 9], [60, 124, 2, 9]];
function tomb(g, x, y, k, h, c) {
  if (k === 0) { rect(g, x - 4, y - h + 3, 8, h - 3, c); circ(g, x, y - h + 4, 4, c); }
  else if (k === 1) { rect(g, x - 1, y - h, 3, h, c); rect(g, x - 4, y - h + 3, 9, 2, c); }
  else rect(g, x - 3, y - h, 6, h, c);
}
const UD_HAND = (m, k) => [lerp(9 * m, 18 * m, k), lerp(-24, -52, k)], UD_ELB = (m, k) => [lerp(11 * m, 15 * m, k), lerp(-34, -42, k)];
export function undeadFig(g, bx, by, t, arms, c) {
  const f = Math.sin(t * 3), P = (x, y) => [bx + x, by + y];
  poly(g, [P(-7, -44), P(7, -44), P(11, -30), P(12, -14), P(13, -4), P(10, -8), P(8, 0), P(5, -6), P(2, -1), P(-1, -7), P(-4, 0), P(-7, -6), P(-10, -2), P(-12, -10), P(-11, -30)], c); // 해진 망토
  for (const m of [1, -1]) { const e = UD_ELB(m, arms), h = UD_HAND(m, arms); poly(g, [P(6 * m, -44), P(e[0] + 2 * m, e[1] - 2), P(h[0] - 2 * m, h[1] + 5), P(h[0] - 5 * m, h[1] + 12 + f), P(e[0] - 3 * m, e[1] + 9), P(5 * m, -34)], c); } // 늘어진 소매
  poly(g, [P(-6, -44), P(-7, -50), P(-4, -57), P(0, -59), P(4, -57), P(7, -50), P(6, -44)], c); // 두건
}
// 뼈: 넋의 빛을 받아 희게 드러나는 곳 (두건 속 해골 · 갈비뼈 · 손)
export function undeadBones(g, bx, by, t, arms) {
  const P = (x, y) => [bx + x, by + y], B = '#8ab8c4', B2 = '#5a8a98';
  poly(g, [P(-3, -42), P(3, -42), P(2, -28), P(-2, -28)], '#010304');
  glow(g, bx, by - 35, 9, '#7ae8ff', 0.75 + 0.2 * Math.sin(t * 7));
  for (let j = 0; j < 4; j++) path(g, [P(-3, -40 + j * 3 + 1), P(0, -40 + j * 3), P(3, -40 + j * 3 + 1)], B2, 1);
  circ(g, bx, by - 50, 2.8, '#7aa4b0'); rect(g, bx - 2, by - 48, 4, 2, '#6a94a0');
  for (const m of [1, -1]) {
    px(g, bx + m * 1.5 - 0.5, by - 51, '#02080a');
    const h = P(...UD_HAND(m, arms)), e = P(...UD_ELB(m, arms)), dx = h[0] - e[0], dy = h[1] - e[1], L = Math.hypot(dx, dy) || 1;
    line(g, h[0] - dx / L * 4, h[1] - dy / L * 4, h[0], h[1], B, 1);
    for (let j = -1.5; j <= 1.5; j++) line(g, h[0], h[1], h[0] + dx / L * 3 + j * 1.2, h[1] + dy / L * 3 - 1.5, B, 1);
  }
}
const SOUL = Array.from({ length: 12 }, (_, i) => ({ b: 1.5 + i * 0.2, ph: H(i, 151) * TAU, w: 8 + H(i, 152) * 12, sp: 34 + H(i, 153) * 20 }));
const RU = { dur: RD, text: '죽음을 거절한 망자', textAt: 0.5, draw(g, t, raw) {
  const slide = eIn(seg(t, 0.9, 1.4)), drop = seg(t, 1.4, 1.55), rise = eOut(seg(t, 1.9, 2.6)), arms = eIO(seg(t, 2.3, 2.9)), S = 1.4, OX = 160, OY = 172;
  const [sx0, sy0] = shakeAt(t, 1.55, 0.25, 2);
  g.save(); g.translate(sx0, sy0);
  vgrad(g, 0, 140, [[0, '#010306'], [0.6, '#06141c'], [1, '#10303a']]);
  stars(g, 70, 161, 110, t, 0.7);
  glow(g, 256, 38, 60, '#9ae8ff', 0.4);
  circ(g, 256, 38, 20, '#b8e0ec'); circ(g, 255, 37, 18, '#d8f4ff'); circ(g, 250, 34, 4, '#bfe4ee'); circ(g, 262, 44, 3, '#c4e8f0'); circ(g, 258, 29, 2, '#c4e8f0');
  for (let i = 0; i < 3; i++) { const x = ((i * 120 + t * 8) % 440) - 60, y = 30 + i * 9; ell(g, x, y, 30 - i * 5, 2, hexA('#06121a', 0.85)); ell(g, x + 12, y - 1.5, 16, 1.5, hexA('#0c2028', 0.8)); }
  poly(g, [[0, 118], [60, 108], [130, 114], [200, 104], [260, 112], [320, 106], [320, 140], [0, 140]], '#081820');
  const TR = '#03080a';
  poly(g, [[34, 140], [38, 96], [36, 80], [42, 80], [44, 96], [46, 140]], TR);
  for (const [x1, y1, x2, y2, w] of [[40, 86, 22, 64, 3], [22, 64, 10, 60, 2], [22, 64, 20, 48, 1.5], [41, 82, 60, 58, 3], [60, 58, 74, 52, 2], [60, 58, 58, 42, 1.5], [52, 70, 64, 74, 1.5], [39, 80, 36, 54, 2]]) line(g, x1, y1, x2, y2, TR, w);
  for (const [x, y, k, h] of TOMB) { tomb(g, x - 1, y, k, h, '#4a9ab0'); tomb(g, x, y, k, h, '#0c1c24'); }
  for (let x = 0; x < IW; x += 5) { if (x > 100 && x < 220) continue; line(g, x, 140, x, 129, '#050c10', 1); px(g, x, 128, '#050c10'); }
  line(g, 0, 132, 100, 132, '#050c10', 1); line(g, 220, 132, IW, 132, '#050c10', 1);
  rect(g, 0, 140, IW, 40, '#040a0c');
  for (let L = 0; L < 2; L++) poly(g, [[-10, 150 + L * 12], ...Array.from({ length: 9 }, (_, i) => [i * 42 - 6, 126 + L * 12 + Math.sin(i * 1.3 + t * 0.6 + L) * 4]), [340, 150 + L * 12]], hexA('#5a9aaa', 0.09 - L * 0.03));
  for (const [gx, gy, d] of [[56, 156, 0], [266, 152, 0.25], [298, 160, 0.45]]) { // 무덤에서 뼈 손이 솟는다
    ell(g, gx, gy + 2, 10, 2.5, '#0a1418');
    const k = eOut(seg(t, 2.3 + d, 2.9 + d)); if (k <= 0) continue;
    const hy = gy - k * 10;
    rimmed(g, '#7ae8ff', '#0a1418', -1, 0, (c) => { line(g, gx, gy, gx, hy, c, 1.5); for (let j = -2; j <= 2; j++) line(g, gx, hy, gx + j * 1.3, hy - 3 - (j === 0 ? 1 : 0), c, 1); });
    if (k < 1) for (let j = 0; j < 4; j++) px(g, gx + (H(j, gx) - 0.5) * 8, gy - k * 6 * H(j, gx + 1), '#1a2a2a');
  }
  // 관 (가까이, 크게): 안쪽 · 빛기둥 · 망자 · 앞면 · 뚜껑 순서로
  const open = clamp(slide * 1.3), fl = 0.85 + 0.15 * Math.sin(t * 11);
  big(g, OX, OY, S, () => {
    poly(g, [[116, 170], [204, 170], [207, 175], [113, 175]], '#081418');
    poly(g, [[126, 140], [194, 140], [196, 150], [124, 150]], '#020406');
    if (open > 0) {
      for (const [x0, w, sp, a] of [[130, 60, 26, 0.06], [138, 44, 16, 0.08], [148, 24, 9, 0.11], [155, 10, 4, 0.16]]) poly(g, [[x0, 146], [x0 + w, 146], [x0 + w + sp, -20], [x0 - sp, -20]], hexA('#7ae8ff', a * open * fl));
      glow(g, 160, 146, 44, '#5ad8ff', 0.7 * open);
      for (let j = 0; j < 22; j++) { const a = (t * (0.4 + H(j, 154) * 0.4) + H(j, 155)) % 1; px(g, 140 + H(j, 156) * 40 + Math.sin(a * 6 + j) * 3, 146 - a * 120, hexA('#c8f8ff', open * (1 - a))); }
    }
  });
  if (rise > 0) {
    const fy = 162 + (1 - rise) * 56;
    const clipY = OY + (150 - OY) * S; raw.save(); raw.beginPath(); raw.rect(-10, -10, IW + 20, clipY + 10); raw.clip(); // 관 테두리 위만 보이게
    rimmed(g, '#7ae8ff', '#03080a', -1, 1, (c) => big(g, OX, OY, S, () => undeadFig(g, 160, fy, t, arms, c)));
    g.save(); g.translate(-1, 1); big(g, OX, OY, S, () => undeadBones(g, 160, fy, t, arms)); g.restore();
    for (const m of [1, -1]) { const [ex, ey] = bp(OX, OY, S, [160 + m * 1.5, fy - 51]); glow(g, ex - 1, ey + 1, 6, '#7ae8ff', 0.85); px(g, ex - 1, ey + 1, '#e8ffff'); }
    raw.restore();
  }
  big(g, OX, OY, S, () => {
    poly(g, [[124, 150], [196, 150], [200, 170], [120, 170]], '#0c1a20'); line(g, 124, 150, 196, 150, '#4a8a9a', 1); line(g, 196, 150, 200, 170, '#2a5a68', 1);
    g.strokeStyle = '#16303a'; g.lineWidth = 1; g.strokeRect(128, 153, 64, 13);
    rect(g, 151, 158, 18, 1, '#1e3e4a'); rect(g, 159, 155, 2, 9, '#1e3e4a');
    if (t > 1.45 && t < 1.95) { const k = seg(t, 1.45, 1.55); for (let j = 0; j < 4; j++) line(g, 136 + j * 2, 148, 136 + j * 2, 148 + 4 * k, '#8ab8c4', 1); rect(g, 135, 147, 8, 2, '#8ab8c4'); } // 관 가장자리를 붙잡는 뼈 손
    if (drop < 1) { const dx = slide * 52, dy = drop * drop * 24, r = drop * 0.5; g.save(); g.translate(160 + dx, 138 + dy); g.rotate(r); poly(g, [[-38, -2], [38, -2], [40, 4], [-40, 4]], '#16282e'); line(g, -38, -2, 38, -2, '#6ab8c8', 1); rect(g, -10, 0, 20, 1, '#0c1a20'); rect(g, -1, -2, 2, 6, '#0c1a20'); g.restore(); }
    else { g.save(); g.translate(214, 172); g.rotate(0.45); poly(g, [[-38, -2], [38, -2], [40, 4], [-40, 4]], '#16282e'); line(g, -38, -2, 38, -2, '#3a7888', 1); g.restore(); }
  });
  if (drop >= 1 && t < 1.9) { const a = t - 1.55; ell(g, 222, 174, 8 + a * 50, 2 + a * 6, hexA('#4a6a70', 0.45 * (1 - a / 0.35))); }
  for (const Sx of SOUL) { // 넋
    const a = t - Sx.b; if (a < 0) continue;
    for (let j = 8; j >= 0; j--) { const q = a - j * 0.04; if (q < 0) continue; const x = 160 + Math.sin(q * 3 + Sx.ph) * (Sx.w + q * 14), y = 128 - q * Sx.sp; if (y < -4) continue; if (j === 0) { glow(g, x, y, 6, '#7ae8ff', 0.6); circ(g, x, y, 1.2, '#e8ffff'); } else px(g, x, y, hexA('#7ae8ff', 0.7 * (1 - j / 9))); }
  }
  windIn(g, t, 160, 130, { col: '#bff4ff', sx: 330, sy: -20 });
  g.restore();
  stamp(g, raw, 'undead', ...bp(OX, OY, S, [159, 162 + (1 - rise) * 56 - 35]), t, 3.05);
} };

// ───────── 암살자: 거대한 달 앞 지붕. 그림자로 흩어졌다가 경비병 뒤에서 나타나 한 번 벤다 ─────────
const MX = 112, MY = 82, MR = 66;
function moonDisc(g, frz) {
  if (frz) { circ(g, MX, MY, MR, '#ffffff'); return; }
  glow(g, MX, MY, 110, '#ffe8b0', 0.3);
  circ(g, MX, MY, MR, '#dcc690'); circ(g, MX - 2, MY - 2, MR - 4, '#ecdcac'); circ(g, MX - 6, MY - 6, MR - 12, '#f8ecc4');
  for (const [x, y, r] of [[-20, -22, 9], [22, -12, 6], [10, 24, 11], [-28, 16, 5], [32, -36, 4], [-10, 42, 6]]) { circ(g, MX + x, MY + y, r, '#e2d0a0'); circ(g, MX + x + 1, MY + y + 1, r - 1.5, '#ead8aa'); }
}
function roofs(g, c, far, frz) {
  for (let i = 0; i < 9; i++) { const x = i * 38 - 10, ry = 130 + H(i, 161) * 10; poly(g, [[x - 3, ry + 6], [x + 3, ry + 3], [x + 19, ry - 4], [x + 35, ry + 3], [x + 41, ry + 6]], far); rect(g, x, ry + 5, 39, 60, far); if (!frz && H(i, 162) > 0.5) rect(g, x + 10 + H(i, 163) * 12, ry + 12, 2, 2, '#c87a3a'); }
  poly(g, [[0, 122], [112, 122], [124, 128], [132, IH], [0, IH]], c);
  for (let x = 2; x < 112; x += 4) rect(g, x, 121, 3, 1, c);
  poly(g, [[186, 136], [196, 130], [IW, 130], [IW, IH], [176, IH]], c);
  for (let x = 198; x < IW; x += 4) rect(g, x, 129, 3, 1, c);
  poly(g, [[194, 131], [190, 126], [192, 124], [196, 129]], c);
}
function guardFig(g, bx, by, t, c) {
  path(g, [[bx, by - 12], [bx - 2, by - 6], [bx - 3, by]], c, 2); path(g, [[bx + 1, by - 12], [bx + 3, by - 6], [bx + 3, by]], c, 2);
  poly(g, [[bx - 3, by - 24], [bx + 4, by - 24], [bx + 5, by - 11], [bx - 4, by - 11]], c);
  circ(g, bx, by - 27, 2.5, c); poly(g, [[bx - 5, by - 28], [bx + 5, by - 28], [bx, by - 34]], c);
  path(g, [[bx + 3, by - 22], [bx + 6, by - 16], [bx + 6, by - 12]], c, 1.5); line(g, bx + 6, by - 2, bx + 6, by - 44, c, 1); poly(g, [[bx + 5, by - 44], [bx + 7, by - 44], [bx + 6, by - 49]], c);
  path(g, [[bx - 3, by - 22], [bx - 6, by - 17], [bx - 7, by - 15]], c, 1.5);
}
function assCrouch(g, bx, by, t, c) {
  const f = Math.sin(t * 6), f2 = Math.sin(t * 6 + 1);
  poly(g, [[bx + 2, by - 21], [bx - 10, by - 25 + f], [bx - 22, by - 23 + f2], [bx - 34, by - 27 + f], [bx - 22, by - 21 + f2], [bx - 10, by - 20 + f], [bx + 1, by - 19]], c); // 긴 목도리
  path(g, [[bx - 1, by - 10], [bx - 3, by - 1], [bx - 9, by]], c, 2.5); path(g, [[bx - 1, by - 10], [bx + 7, by - 8], [bx + 6, by]], c, 2.5);
  poly(g, [[bx - 3, by - 11], [bx + 1, by - 11], [bx + 6, by - 20], [bx + 1, by - 22]], c);
  circ(g, bx + 5, by - 24, 2.6, c); poly(g, [[bx + 3, by - 27], [bx + 7, by - 26], [bx + 1, by - 22]], c);
  path(g, [[bx + 4, by - 19], [bx + 9, by - 11], [bx + 10, by - 1]], c, 1.5);
  path(g, [[bx + 2, by - 19], [bx, by - 14], [bx + 2, by - 12]], c, 1.5); line(g, bx + 2, by - 12, bx - 6, by - 16, c, 1);
}
function assLunge(g, bx, by, t, c) {
  const f = Math.sin(t * 8), f2 = Math.sin(t * 8 + 1);
  poly(g, [[bx - 2, by - 17], [bx - 14, by - 22 + f], [bx - 28, by - 19 + f2], [bx - 40, by - 24 + f], [bx - 28, by - 16 + f2], [bx - 14, by - 15 + f], [bx - 2, by - 14]], c);
  path(g, [[bx - 1, by - 9], [bx + 6, by - 5], [bx + 9, by]], c, 2.5); path(g, [[bx - 2, by - 9], [bx - 9, by - 3], [bx - 15, by]], c, 2.5);
  poly(g, [[bx - 4, by - 10], [bx + 1, by - 10], [bx + 8, by - 16], [bx + 3, by - 19]], c);
  circ(g, bx + 8, by - 19, 2.6, c);
  path(g, [[bx + 4, by - 16], [bx - 4, by - 15], [bx - 13, by - 15]], c, 1.5); line(g, bx - 13, by - 15, bx - 25, by - 17, c, 1);
  path(g, [[bx + 5, by - 16], [bx + 9, by - 10], [bx + 11, by - 6]], c, 1.5);
}
const RA = { dur: RD, text: '그림자를 걷는 암살자', textAt: 0.5, draw(g, t, raw) {
  const frz = t >= 2.0 && t < 2.34, fall = seg(t, 2.34, 2.9), gx = 236, gy = 130, GS = 1.4, ax = 76, ay = 122, AS = 1.5, bx2 = 284, by2 = 130;
  const ink = '#000000', paper = '#efe6d6';
  vgrad(g, 0, IH, frz ? [[0, paper], [1, paper]] : [[0, '#06030e'], [1, '#1c1030']]);
  if (!frz) stars(g, 50, 171, 120, t, 0.6);
  moonDisc(g, frz);
  if (!frz) for (let i = 0; i < 3; i++) { const x = ((i * 130 + t * 9) % 470) - 90, y = 52 + i * 26; ell(g, x, y, 34 - i * 4, 2.5, hexA('#2a1c3a', 0.85)); ell(g, x + 14, y - 2, 18, 2, hexA('#3a2a4a', 0.7)); ell(g, x - 12, y + 2, 22, 1.5, hexA('#1a1028', 0.8)); }
  roofs(g, frz ? ink : '#050209', frz ? ink : '#0e0a1a', frz);
  // 경비병 (등불이 따뜻하게 흔들린다)
  const sway = Math.sin(t * 2.4) * 2, guard = (c) => { g.save(); g.translate(gx + fall * fall * 14, gy + fall * fall * 60); g.rotate(eIn(fall) * 1.7); g.scale(GS, GS); g.translate(-gx, -gy); guardFig(g, gx, gy, t, c); g.restore(); };
  if (fall < 1) { if (frz) guard(ink); else rimmed(g, '#e8b070', '#050209', 1, 0, guard); }
  const [lx0, ly0] = bp(gx, gy, GS, [gx - 7 + sway, gy - 12]);
  if (fall <= 0) { const [hx, hy] = bp(gx, gy, GS, [gx - 7, gy - 15]); line(g, hx, hy, lx0, ly0, frz ? ink : '#050209', 1); if (!frz) glow(g, lx0, ly0 + 2, 18, '#ffa040', 0.55 + 0.1 * Math.sin(t * 13)); rect(g, lx0 - 1, ly0, 4, 5, frz ? ink : '#ffc860'); }
  else { const a = t - 2.34, land = Math.sqrt((172 - ly0) / 80), x = lx0 + Math.min(a, land) * 18, y = Math.min(172, ly0 + 80 * a * a), out = 1 - seg(a, land, land + 0.35); if (out > 0) { glow(g, x, y, 12 * out, '#ffa040', 0.6 * out * (a > land ? 0.6 + 0.4 * Math.sin(t * 40) : 1)); rect(g, x - 1, y, 3, 3, '#ffc860'); } }
  // 암살자: 달 앞에 웅크림 → 그림자로 흩어짐 → 경비병 뒤에서 나타나 벤 자세
  if (t < 1.05) big(g, ax, ay, AS, () => assCrouch(g, ax, ay, t, ink));
  if (t > 0.95 && t < 1.7) for (let i = 0; i < 60; i++) { const a = t - 0.95 - H(i, 171) * 0.15; if (a < 0 || a > 0.55) continue; const x = ax - 14 + H(i, 172) * 30 + a * (30 + H(i, 173) * 60), y = ay - 38 + H(i, 174) * 38 - a * (20 + H(i, 175) * 40); rect(g, x, y, i % 5 ? 1 : 2, i % 5 ? 1 : 2, i % 4 ? '#08040e' : '#a68aff'); }
  if (t > 1.7 && t < 2.0) for (let i = 0; i < 60; i++) { const a = clamp(1 - (t - 1.7) / 0.28), x = bx2 - 4 + (H(i, 176) - 0.5) * 80 * a, y = by2 - 16 + (H(i, 177) - 0.5) * 50 * a; rect(g, x, y, 1, 1, i % 4 ? '#08040e' : '#a68aff'); }
  const lunge = (c) => big(g, bx2, by2, GS, () => assLunge(g, bx2, by2, t, c));
  if (t >= 2.0) { if (frz) lunge(ink); else rimmed(g, '#d8c8a0', '#050209', 1, 0, lunge); }
  // 일섬: 멈춘 순간엔 종이빛 선이 검은 그림자들만 가른다
  const x0 = 330, y0 = 20, x1 = 150, y1 = 180;
  if (frz) line(g, x0, y0, x1, y1, paper, 3);
  else if (t >= 2.34) { const k = seg(t, 2.34, 2.9); if (k < 1) { line(g, x0 + 1, y0 + 2, x1 + 1, y1 + 2, hexA('#a68aff', 0.8 * (1 - k)), 1); line(g, x0, y0, x1, y1, hexA('#ffffff', 1 - k), 1); } }
  windIn(g, t, ax + 4, ay - 24, { col: '#d8c8ff', sx: 330, sy: -10 });
  stamp(g, raw, 'assassin', ...bp(bx2, by2, GS, [bx2 + 2, by2 - 14]), t, 3.0);
} };

// ───────── 공룡 수인: 안개 낀 원시림. 빛을 머금은 알이 깨지고, 깨어난 수인이 하늘을 향해 포효한다 ─────────
const EGG = [160, 128], CR = [[[0, -17], [-3, -11], [1, -6], [-2, 0]], [[1, -6], [6, -2], [5, 5]], [[-2, 0], [-8, 3], [-10, 9]], [[-3, -11], [-9, -9], [-12, -3]], [[5, 5], [9, 10]], [[6, -2], [11, -6]]];
const SHARD = Array.from({ length: 14 }, (_, i) => ({ a: -Math.PI / 2 + (H(i, 181) - 0.5) * 2.8, v: 50 + H(i, 182) * 70, r: H(i, 183) * 8, s: 2 + H(i, 184) * 3 }));
const BIRD = Array.from({ length: 14 }, (_, i) => ({ x: 120 + H(i, 191) * 200, y: 40 + H(i, 192) * 40, vx: -40 - H(i, 193) * 50, vy: -30 - H(i, 194) * 30, d: H(i, 195) * 0.2 }));
function dinoFig(g, bx, by, t, up, roar, c) {
  const cr = (1 - up) * 14, sw = Math.sin(t * 3) * 2, hy = by - 46 + cr;
  path(g, [[bx - 2, by - 24 + cr * 0.7], [bx + 4, by - 15 + cr * 0.3], [bx - 1, by - 6], [bx + 6, by]], c, 4);
  path(g, [[bx - 3, by - 24 + cr * 0.7], [bx - 7, by - 14 + cr * 0.3], [bx - 11, by - 5], [bx - 5, by]], c, 3.5);
  poly(g, [[bx - 4, by - 30 + cr], [bx - 18, by - 26 + cr * 0.6], [bx - 34, by - 18], [bx - 46, by - 12 + sw], [bx - 36, by - 14 + sw * 0.5], [bx - 18, by - 19 + cr * 0.4], [bx - 3, by - 21 + cr * 0.6]], c); // 굵은 꼬리
  for (let i = 0; i < 4; i++) { const x = bx - 8 - i * 7, y = by - 27 + cr * (0.8 - i * 0.15) + i * 2; poly(g, [[x - 2, y], [x, y - 4], [x + 2, y]], c); } // 등 가시
  poly(g, [[bx - 6, by - 28 + cr], [bx + 2, by - 42 + cr], [bx + 10, by - 40 + cr], [bx + 7, by - 26 + cr], [bx, by - 21 + cr]], c);
  const ha = -roar * 0.55, hc = [bx + 7, hy + 2];
  const R = (x, y, a = ha) => { const dx = x - hc[0], dy = y - hc[1]; return [hc[0] + dx * Math.cos(a) - dy * Math.sin(a), hc[1] + dx * Math.sin(a) + dy * Math.cos(a)]; };
  line(g, bx + 5, by - 40 + cr, hc[0], hc[1], c, 4);
  poly(g, [R(bx + 4, hy - 4), R(bx + 10, hy - 7), R(bx + 21, hy - 4), R(bx + 24, hy - 1), R(bx + 14, hy + 1), R(bx + 6, hy + 2)], c);
  poly(g, [R(bx + 5, hy - 5), R(bx - 2, hy - 11), R(bx + 3, hy - 6), R(bx - 4, hy - 7), R(bx + 4, hy - 3)], c); // 머리 뒤 깃털 볏
  const jaw = roar * 0.6, jc = R(bx + 9, hy + 1);
  const J = (x, y) => { const [rx, ry] = R(x, y), dx = rx - jc[0], dy = ry - jc[1]; return [jc[0] + dx * Math.cos(jaw) - dy * Math.sin(jaw), jc[1] + dx * Math.sin(jaw) + dy * Math.cos(jaw)]; };
  poly(g, [J(bx + 8, hy), J(bx + 21, hy), J(bx + 20, hy + 3), J(bx + 9, hy + 4)], c);
  for (const [m, w] of [[1, 2.5], [0, 2]]) {
    const sh = [bx + 6 - m * 3, by - 38 + cr], el = [lerp(bx + 12, bx + 4, roar) - m * 2, lerp(by - 32, by - 34, roar) + cr], hd = [lerp(bx + 17, bx - 2, roar) - m * 2, lerp(by - 34, by - 38, roar) + cr];
    path(g, [sh, el, hd], c, w);
    for (let j = -1; j <= 1; j++) line(g, hd[0], hd[1], hd[0] + 3 - roar * 5, hd[1] + j * 1.5 + 1, c, 1);
    line(g, el[0], el[1], el[0] - 3, el[1] + 3, c, 1);
  }
  return { eye: R(bx + 13, hy - 4), chest: [bx + 3, by - 33 + cr], mouth: J(bx + 20, hy + 1) };
}
// 야자 잎 하나: 휘어지는 잎맥을 따라 톱니진 잎을 한 번에 채운다
function frond(g, x, y, len, a0, curl, c) {
  let cx = x, cy = y, a = a0; const L = [], R = [];
  for (let i = 0; i <= 9; i++) {
    const w = Math.sin((i / 9) * Math.PI) * len * 0.16 * (i % 2 ? 0.55 : 1), nx = -Math.sin(a), ny = Math.cos(a);
    L.push([cx + nx * w, cy + ny * w]); R.push([cx - nx * w, cy - ny * w]);
    a += curl; cx += Math.cos(a) * len / 9; cy += Math.sin(a) * len / 9;
  }
  poly(g, [...L, ...R.reverse()], c);
}
function jungleTree(g, x, base, h, c, t) {
  const top = [x + Math.sin(x * 1.7) * 8, base - h];
  path(g, [[x, base], [lerp(x, top[0], 0.4) + 3, base - h * 0.5], top], c, 3);
  for (let j = 0; j < 7; j++) { const a = -Math.PI / 2 + (j - 3) * 0.5 + Math.sin(t * 1.3 + j + x) * 0.04; frond(g, top[0], top[1], 22 + (j % 2) * 8, a, j < 3 ? -0.1 : j > 3 ? 0.1 : 0, c); }
}
const RDn = { dur: RD, text: '본능을 따르는 공룡 수인', textAt: 0.5, draw(g, t, raw) {
  const ck = seg(t, 0.85, 1.55), burst = t >= 1.6, b = t - 1.6, up = eOut(seg(t, 1.7, 2.3)), roar = eOut(seg(t, 2.35, 2.55)) * (1 - seg(t, 3.5, 3.9) * 0.6);
  const hop = (t > 0.95 && t < 1.05) || (t > 1.22 && t < 1.3) || (t > 1.44 && t < 1.52) ? 1 : 0, S = 1.4, OX = 160, OY = 156;
  const [sx0, sy0] = shakeAt(t, 2.38, 0.9, 3);
  g.save(); g.translate(sx0, sy0);
  vgrad(g, 0, IH, [[0, '#24301a'], [0.45, '#7a8c40'], [0.75, '#d8cc80'], [1, '#e8dc98']]);
  glow(g, 60, 70, 90, '#fff0b0', 0.35);
  poly(g, [[196, 112], [244, 62], [256, 60], [270, 70], [324, 114]], '#7a8a52'); // 먼 화산
  for (let i = 0; i < 10; i++) { const a = (t * 0.15 + i / 10) % 1; ell(g, 250 + a * 30 + Math.sin(a * 5) * 6, 58 - a * 60, 5 + a * 16, 4 + a * 10, hexA('#8a8a68', 0.35 * (1 - a))); }
  for (let i = 0; i < 3; i++) { const x = ((i * 120 + t * (14 + i * 4)) % 420) - 50, y = 30 + i * 12, w = Math.sin(t * 4 + i) * 3; path(g, [[x - 7, y + w], [x - 2, y], [x, y + 1], [x + 2, y], [x + 7, y + w]], '#4a5a30', 1); }
  for (const [x, h] of [[24, 74], [86, 60], [244, 66], [300, 80]]) jungleTree(g, x, 112, h, '#5a6c38', t);
  for (const [y0, c, amp, s] of [[100, '#5a6c32', 10, 201], [116, '#36461e', 14, 202]]) poly(g, [[0, IH], [0, y0], ...Array.from({ length: 17 }, (_, i) => [i * 20, y0 - H(i, s) * amp - (i % 3 === 0 ? amp : 0)]), [IW, y0], [IW, IH]], c);
  for (const [x, h] of [[46, 96], [282, 104]]) jungleTree(g, x, 150, h, '#1e2a12', t);
  for (let L = 0; L < 3; L++) poly(g, [[0, 132 + L * 6], ...Array.from({ length: 9 }, (_, i) => [i * 40, 124 + L * 7 + Math.sin(i * 1.1 + t * 0.5 + L * 2) * 3]), [IW, 132 + L * 6], [IW, 156], [0, 156]], hexA('#f0e8c0', 0.1));
  // 둥지 · 알 · 깨어난 수인 (크게)
  const [ex, ey] = EGG;
  let me = null;
  big(g, OX, OY, S, () => {
    ell(g, 160, 157, 42, 8, '#141c0c'); ell(g, 160, 153, 30, 5, '#1e2a12'); // 풀과 잔가지로 엮은 둥지
    for (let i = 0; i < 20; i++) { const a = H(i, 211) * Math.PI, x = 160 + (H(i, 212) - 0.5) * 60; line(g, x - Math.cos(a) * 8, 151 + Math.sin(a) * 2, x + Math.cos(a) * 8, 153 - Math.sin(a) * 2, i % 3 ? '#2e3a1a' : '#4a5226', 1); }
    if (!burst) {
      const lx = ex + hop * (Math.floor(t * 30) % 2 ? 1 : -1);
      glow(g, lx, ey, 20 + ck * 30, '#ffe08a', 0.2 + ck * 0.6);
      ell(g, lx, ey, 13, 17, '#8a7a58'); ell(g, lx - 1, ey - 1, 12, 16, '#c8b890'); ell(g, lx - 4, ey - 5, 6, 8, '#e8dcb8');
      for (let i = 0; i < 14; i++) { const a = H(i, 213) * TAU, r = H(i, 214) * 0.85; px(g, lx + Math.cos(a) * 11 * r, ey + Math.sin(a) * 15 * r, '#7a6a48'); }
      let n = ck * CR.length;
      for (let i = 0; i < CR.length && n > 0; i++, n--) { const pts = CR[i].map(([x, y]) => [lx + x, ey + y]); const cut = Math.max(2, Math.ceil(pts.length * Math.min(1, n))); path(g, pts.slice(0, cut), '#5a4020', 2); path(g, pts.slice(0, cut), '#ffe890', 1); }
    } else {
      if (b < 0.45) for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2, L = 30 + b * 200; poly(g, [[ex, ey], [ex + Math.cos(a - 0.04) * L, ey + Math.sin(a - 0.04) * L], [ex + Math.cos(a + 0.04) * L, ey + Math.sin(a + 0.04) * L]], hexA('#fff0b0', 0.45 * (1 - b / 0.45))); }
      for (const Sh of SHARD) { const x = ex + Math.cos(Sh.a) * Sh.v * b, y = Math.min(158, ey + Math.sin(Sh.a) * Sh.v * b + 120 * b * b), r = Sh.r + b * 9 * (y < 158 ? 1 : 0); poly(g, [[x + Math.cos(r) * Sh.s, y + Math.sin(r) * Sh.s], [x + Math.cos(r + 2.3) * Sh.s, y + Math.sin(r + 2.3) * Sh.s], [x + Math.cos(r + 4) * Sh.s * 0.7, y + Math.sin(r + 4) * Sh.s * 0.7]], '#c8b890'); }
    }
  });
  if (burst) {
    rimmed(g, '#ffd070', '#0a1006', 1, 0, (c) => big(g, OX, OY, S, () => { me = dinoFig(g, ex, 150, t, up, roar, c); }));
    const [qx, qy] = bp(OX, OY, S, me.eye); glow(g, qx, qy, 5, '#ffc040', 0.7); px(g, qx, qy, '#ffe070');
    big(g, OX, OY, S, () => {
      poly(g, [[ex - 13, 142], [ex - 10, 136], [ex - 6, 140], [ex - 2, 134], [ex + 3, 139], [ex + 7, 135], [ex + 11, 140], [ex + 13, 142], [ex + 10, 150], [ex - 10, 150]], '#8a7a58'); // 남은 알껍데기
      poly(g, [[ex - 12, 142], [ex - 10, 137], [ex - 6, 141], [ex - 2, 135], [ex + 1, 140], [ex - 6, 148], [ex - 11, 147]], '#c8b890');
    });
    if (b < 0.05) cover(raw, 1, '#fff8e0');
    else if (b < 0.3) glow(g, ...bp(OX, OY, S, EGG), 80, '#fff4c0', 0.8 * (1 - b / 0.3));
  }
  if (t > 2.4) for (const B of BIRD) { const a = t - 2.4 - B.d; if (a < 0) continue; const x = B.x + B.vx * a, y = B.y + B.vy * a, w = Math.sin(t * 16 + B.x) * 2; path(g, [[x - 3, y + w], [x, y], [x + 3, y + w]], '#141c0c', 1); }
  for (const [x, y, L, a0, cu] of [[-8, 186, 70, -1.1, 0.06], [6, 190, 50, -1.5, 0.09], [328, 186, 70, -2.0, -0.06], [314, 190, 56, -1.7, -0.09]]) fern(g, x + (t > 2.4 ? Math.sin(t * 20) * 1.5 * (1 - seg(t, 2.4, 3.4)) : 0), y, L, a0, cu, '#050a04');
  windIn(g, t, ...bp(OX, OY, S, EGG), { sx: -20, sy: 0, t1: 0.85 });
  g.restore();
  if (burst) stamp(g, raw, 'dino', ...bp(OX, OY, S, me.chest), t, 3.05);
} };

// ───────── 용족: 용암 들판. 무릎 꿇었던 용족이 일어나 숨을 크게 들이쉬고, 입으로 불을 뿜는다 ─────────
export function flame(g, mx, my, t, len, ang, wk0) {
  const f = Math.floor(t * 24), d = [Math.cos(ang), Math.sin(ang)], n = [-d[1], d[0]];
  for (const [c, wk, lk] of [['#7a1a0a', 1, 1], ['#d8401a', 0.84, 0.94], ['#ff8a2a', 0.64, 0.84], ['#ffc84a', 0.44, 0.7], ['#fff2b0', 0.26, 0.54], ['#ffffff', 0.12, 0.34]]) {
    const L = len * lk, top = [], bot = [];
    for (let i = 0; i <= 18; i++) {
      const s = i / 18, x = s * L, w = (1.5 + x * 0.3) * wk * wk0 * (1 - s ** 5) * (0.85 + 0.3 * H(f, i, Math.round(wk * 100))), wob = Math.sin(s * 9 - t * 30) * x * 0.03;
      top.push([mx + d[0] * x + n[0] * (w + wob), my + d[1] * x + n[1] * (w + wob)]); bot.push([mx + d[0] * x - n[0] * (w - wob), my + d[1] * x - n[1] * (w - wob)]);
    }
    poly(g, [...top, ...bot.reverse()], c);
  }
  for (let j = 0; j < 7; j++) { // 끝에서 떨어져 나가는 불 혀 · 연기
    const p = (t * 2.6 + j / 7) % 1, x = len * (0.8 + p * 0.45), y = (H(j, 251) - 0.5) * len * 0.3 * (0.5 + p), r = (7 - p * 5) * wk0;
    const cx = mx + d[0] * x + n[0] * y, cy = my + d[1] * x + n[1] * y - p * 10;
    if (p < 0.5) { ell(g, cx, cy, r * 1.4, r, p < 0.25 ? '#ff8a2a' : '#c83a14'); } else ell(g, cx, cy, r * 2, r * 1.4, hexA('#3a2420', 0.5 * (1 - p)));
  }
}
const LAVA = [{ pts: [[-10, 152], [40, 147], [90, 155], [132, 150]], w: 6 }, { pts: [[188, 153], [240, 147], [282, 157], [330, 151]], w: 6 }, { pts: [[40, 174], [110, 167], [190, 175], [260, 168], [330, 177]], w: 9 }];
function river(g, R, t) {
  const S = [];
  for (let i = 0; i < R.pts.length - 1; i++) for (let k = 0; k < 8; k++) { const u = k / 8; S.push([lerp(R.pts[i][0], R.pts[i + 1][0], u), lerp(R.pts[i][1], R.pts[i + 1][1], u)]); }
  S.push(R.pts[R.pts.length - 1]);
  for (const [c, k] of [['#4a1004', 1.5], ['#b8340a', 1.1], ['#ff7a1a', 0.7], ['#ffc84a', 0.36]]) {
    const top = [], bot = [];
    S.forEach(([x, y], i) => { const w = R.w * k * (0.75 + 0.35 * Math.sin(i * 0.9 + R.w + t * 0.8 * (k < 0.5 ? 1 : 0))); top.push([x, y - w * 0.5]); bot.push([x, y + w * 0.5]); });
    poly(g, [...top, ...bot.reverse()], c);
  }
  for (let j = 0; j < 4; j++) { // 굳어 가는 껍질 조각이 천천히 흘러간다
    const s = ((t * 0.04 + H(j, R.w, 3)) % 1) * (S.length - 1), i = Math.floor(s), [x, y] = S[i], r = 2 + H(j, R.w, 4) * 2;
    poly(g, [[x - r, y - 1], [x - r * 0.3, y - r * 0.5], [x + r, y - 0.5], [x + r * 0.6, y + r * 0.4], [x - r * 0.5, y + r * 0.4]], '#2a0a04');
  }
}
const RR = { dur: RD, text: '불을 피로 지닌 용족', textAt: 0.5, draw(g, t, raw) {
  const up = eIO(seg(t, 0.85, 1.6)), inh = eIO(seg(t, 1.7, 2.2)), br = eOut(seg(t, 2.22, 2.36)), fire = t >= 2.3 && t < 3.85;
  const q = br > 0 ? lerpPose(DRK.inhale, DRK.breath, br) : inh > 0 ? lerpPose(DRK.stand, DRK.inhale, inh) : lerpPose(DRK.kneel, DRK.stand, up);
  const jaw = br > 0 ? 1 - seg(t, 3.5, 3.85) : inh * 0.2, bx = 124, by = 150, S = 1.6, P = (x, y) => [bx + x, by + y];
  const [sx0, sy0] = shakeAt(t, 2.3, 0.5, 1.5);
  g.save(); g.translate(sx0, sy0);
  vgrad(g, 0, IH, [[0, '#0a0202'], [0.55, '#2a0806'], [1, '#5a160a']]);
  for (const [x, w, h] of [[60, 70, 70], [252, 90, 84]]) { poly(g, [[x - w, 136], [x - 8, 136 - h], [x + 8, 136 - h], [x + w, 136]], '#1a0604'); glow(g, x, 136 - h, 30, '#ff6a1a', 0.5 + 0.2 * Math.sin(t * 3 + x)); for (let j = 0; j < 3; j++) path(g, [[x - 4 + j * 4, 136 - h], [x - 7 + j * 5 + Math.sin(j) * 3, 136 - h * 0.6], [x - 14 + j * 9, 136 - h * 0.2]], hexA('#ff5a1a', 0.7), 1); }
  for (let i = 0; i < 20; i++) { const a = (t * 0.6 + H(i, 221)) % 1, x = 252 + (H(i, 222) - 0.5) * 30 * a, y = 52 - a * 50 + a * a * 30; px(g, x, y, a < 0.5 ? '#ffd060' : '#ff5a1a'); }
  rect(g, 0, 136, IW, 44, '#120404');
  for (let i = 0; i < 24; i++) { const x = H(i, 224) * IW, y = 140 + H(i, 225) * 38; poly(g, [[x - 5, y + 1], [x - 2, y - 2], [x + 4, y - 1], [x + 6, y + 1]], '#1e0806'); }
  for (const R of LAVA) river(g, R, t);
  poly(g, [[80, IH], [92, 152], [108, 148], [146, 148], [160, 152], [172, IH]], '#0c0302'); line(g, 92, 152, 108, 148, '#ff8a3a', 1); line(g, 146, 148, 160, 152, '#ff8a3a', 1);
  // 용족 (아래 용암빛이 테두리를 그리고, 불을 뿜을 땐 앞쪽도 밝다)
  let F;
  const body = [fire ? '#ffd080' : '#ff9a4a', '#7a240c', '#0c0303'];
  F = layered(g, { far: [fire ? '#d8702a' : '#c85a24', '#4a1608', '#260a06'], body, near: body }, -1, -1, (c, layer, pass) => { let r; big(g, bx, by, S, () => { r = dragonkin(g, P, q, c, t, { jaw, float: up * 0.7 + inh * 0.4, layer, pass, pal: DRK_PAL }); }); return r; }, true);
  const tl = bp(bx, by, S, F.tail), ey = bp(bx, by, S, F.eye), mo = bp(bx, by, S, F.mouth), th = bp(bx, by, S, F.throat);
  glow(g, tl[0], tl[1] - 3, 10 + 6 * up, '#ff8a2a', 0.55); tongue(g, tl[0], tl[1] + 1, 5 + 6 * up + 3 * br, 2 + up, t, 7); // 꼬리 끝의 불
  glow(g, ey[0], ey[1], 4, '#ffb040', 0.6); px(g, ey[0], ey[1], '#ffe070');
  if (inh > 0 && br < 1) { // 숨을 들이쉬면 불티가 입으로 빨려 들고 목이 달아오른다
    for (let i = 0; i < 34; i++) { const s = (t * 1.6 + H(i, 261)) % 1, a = H(i, 262) * TAU, r = 70 * (1 - s * s), x = mo[0] + Math.cos(a) * r, y = mo[1] + Math.sin(a) * r * 0.7; px(g, x, y, s > 0.7 ? '#ffe08a' : '#ff7a2a'); }
    glow(g, th[0], th[1], 5 + 8 * inh, '#ff7a2a', 0.7 * inh * (1 - br));
  }
  if (fire) {
    const grow = eOut(seg(t, 2.3, 2.5)), fade = 1 - seg(t, 3.4, 3.85);
    glow(g, mo[0] + 80, mo[1] + 10, 110, '#ff7a2a', 0.5 * fade);
    flame(g, mo[0], mo[1], t, 175 * grow, 0.05 + q.ha * 0.6, fade);
  }
  for (let i = 0; i < 70; i++) { const a = (t * (0.18 + H(i, 241) * 0.2) + H(i, 242)) % 1, x = H(i, 243) * IW + Math.sin(a * 8 + i) * 5, y = IH - a * 190; px(g, x, y, i % 3 ? hexA('#ff8a2a', 1 - a) : hexA('#8a7a74', 0.6 * (1 - a))); }
  windIn(g, t, ...bp(bx, by, S, [bx + 5, by - 26]), { col: '#ffc070', sx: -20, sy: -10 });
  g.restore();
  stamp(g, raw, 'dragon', ...bp(bx, by, S, F.chest), t, 3.1);
} };

// ───────── 각인: 여덟 문양이 탑을 둘러싸고, 빛줄기로 꼭대기에 이어진다 ─────────
const RACES = ['wizard', 'elf', 'knight', 'orc', 'undead', 'assassin', 'dino', 'dragon'];
const RING = { dur: 5.6, text: '빛은 여덟 종족의 몸에 새겨졌다. 우리는 그것을 각인이라 부른다.', textAt: 0.7, draw(g, t, raw) {
  const cx = 160, cy = 63, link = seg(t, 2.7, 3.2), flare = seg(t, 3.1, 3.4) * (1 - seg(t, 3.4, 4.6) * 0.6);
  vgrad(g, 0, IH, [[0, '#04030c'], [0.6, '#0e0a24'], [1, '#1a1030']]);
  stars(g, 110, 81, 150, t, 0.8);
  glow(g, cx, cy, 120, '#7a5aff', 0.15 + 0.2 * link);
  tower(g, cx, 186, 120, { dark: '#07050e', rim: '#5a4a9a', rdx: 1, win: '#7af0e0', crystal: '#e8fff8', cglow: 0.5 + 0.8 * flare });
  RACES.forEach((r, i) => {
    const ti = 0.35 + i * 0.26, k = t - ti; if (k < 0) return;
    const a = -Math.PI / 2 + i * Math.PI / 4 + t * 0.05, x = cx + Math.cos(a) * 64, y = cy + Math.sin(a) * 46;
    if (link > 0) {
      line(g, x, y, lerp(x, cx, link), lerp(y, cy, link), hexA(RACE_COL[r], 0.45), 1);
      for (let j = 0; j < 4; j++) { const s = (t * 0.8 + j / 4 + i * 0.13) % 1; if (s < link) px(g, lerp(x, cx, s), lerp(y, cy, s), '#ffffff'); }
    }
    glyph(g, r, x, y, k < 0.2 ? 4 - Math.floor(k / 0.1) : 2, Math.min(1, 0.4 + k * 3));
    if (k < 0.3) glow(g, x, y, 22, '#ffffff', 0.6 * (1 - k / 0.3));
  });
  if (t > 3.1 && t < 3.25) cover(raw, 0.35 * (1 - (t - 3.1) / 0.15), '#ffffff');
} };

export const ACT2 = [RW, RE, RK, RO, RU, RA, RDn, RR, RING];

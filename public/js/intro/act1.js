// 1막: 하늘이 갈라지고 · 별(아르케)이 떨어지고 · 탑이 솟는다
import { IW, IH, H, clamp, lerp, seg, eOut, eIn, eIO, hexA, rect, px, poly, circ, ell, line, path, vgrad, glow, sil, stars, cover } from './pix.js';

// 탑 실루엣 (가운데 cx, 밑 base, 높이 h). 층마다 처마가 튀어나오고 꼭대기에 별 조각(아르케)
const TL = [[-13, 0], [-11, -26], [-15, -28], [-15, -31], [-9, -34], [-8, -60], [-12, -62], [-12, -65], [-6, -68], [-5, -92], [-8, -94], [-8, -96], [-4, -98], [-3, -110], [-1, -116], [0, -119]];
export function tower(g, cx, base, h, o = {}) {
  const s = h / 120, P = (x, y) => [cx + x * s, base + y * s];
  const pts = [...TL.map(([x, y]) => P(x, y)), ...TL.slice().reverse().map(([x, y]) => P(-x, y))];
  sil(g, pts, o.dark || '#05050c', o.rim, o.rdx ?? 1, 0);
  if (o.win) for (const [y, n] of [[-14, 2], [-46, 2], [-80, 1]]) for (let i = 0; i < n; i++) { const x = cx + (i - (n - 1) / 2) * 5 * s; rect(g, x - 0.5, base + y * s, Math.max(1, s), Math.max(2, 2 * s), o.win); }
  if (o.crystal) {
    const cy = base - 123 * s, r = Math.max(2, 4 * s);
    if (o.cglow) glow(g, cx, cy, r * 9, o.crystal, o.cglow);
    poly(g, [[cx, cy - r * 1.6], [cx + r, cy], [cx, cy + r * 1.2], [cx - r, cy]], o.crystal);
    px(g, cx - 1, cy - r * 0.6, '#ffffff');
  }
  return pts;
}
export function nightSea(g, t, hz, o = {}) {
  vgrad(g, 0, hz, o.sky || [[0, '#02030a'], [0.65, '#070e26'], [1, '#14244c']]);
  vgrad(g, hz, IH, o.sea || [[0, '#0b1838'], [0.35, '#050c22'], [1, '#02040c']]);
  stars(g, o.n ?? 95, 11, hz - 6, t, o.bright ?? 1);
  rect(g, 0, hz, IW, 1, o.line || '#203a70');
  for (let i = 0; i < 46; i++) { // 물결 반짝임: 가로 점선이 천천히 흐른다
    const d = H(i, 8), y = hz + 2 + Math.floor(d * d * (IH - hz - 3)), x = (H(i, 9) * IW + t * (4 + 12 * d)) % (IW + 10) - 5, w = 2 + Math.floor(H(i, 10) * 6 * (0.5 + d));
    rect(g, x, y, w, 1, d < 0.3 ? (o.glint || '#1e3366') : (o.glint2 || '#101c42'));
  }
}
// 하늘의 금: 가운데서 양쪽으로 갈라져 나간다
function crack(g, amt, t, cx = 160, cy = 30) {
  const n = Math.floor(amt * 15), fl = 0.8 + 0.2 * Math.sin(t * 40);
  glow(g, cx, cy, 8 + amt * 34, '#ffd27a', 0.55 * amt * fl);
  for (const sd of [-1, 1]) {
    let x = cx, y = cy;
    for (let i = 1; i <= n; i++) {
      const nx = cx + sd * i * 7.5, ny = cy + (H(i, sd + 5) - 0.5) * 9 + i * 0.7 * sd;
      if (i < 5) line(g, x, y, nx, ny, '#ffe8a8', 3 - i * 0.4);
      line(g, x, y, nx, ny, '#ffffff', 1);
      if (H(i, sd + 9) > 0.55) line(g, nx, ny, nx + sd * (4 + H(i, 2) * 5), ny + (H(i, 3) - 0.5) * 12, '#ffd27a', 1);
      x = nx; y = ny;
    }
  }
  if (amt > 0.2) { rect(g, cx - 1, cy - 1, 3, 3, '#ffffff'); }
}

export const S1 = { dur: 4.5, text: '아주 먼 옛날, 하늘이 갈라졌다.', textAt: 0.6, draw(g, t) {
  nightSea(g, t, 118);
  if (t > 2.0) crack(g, eOut(seg(t, 2.0, 4.2)), t);
} };

// 떨어지는 별: 머리 · 꼬리 · 흩날리는 불티, 바다에 닿으면 하얀 섬광 · 물기둥 · 물결 고리 · 흔들림
const FALL = 2.5, P0 = [162, 34], P1 = [198, 120];
const fallAt = (u) => [lerp(P0[0], P1[0], u) + Math.sin(u * 3.1) * 5, lerp(P0[1], P1[1], u * u)];
const TAIL = ['#ffffff', '#fff6c8', '#ffe070', '#ffb040', '#ff7a24', '#e84a1a', '#a82a1a', '#5a1a1e'];
export const S2 = { dur: 5.6, text: '그 별의 이름은 아르케.', textAt: 3.0, draw(g, t, raw) {
  const tc = t - FALL, sh = tc > 0 && tc < 0.9 ? (1 - tc / 0.9) * 5 : 0;
  g.save(); g.translate(Math.round((H(Math.floor(t * 30), 1) - 0.5) * sh * 2), Math.round((H(Math.floor(t * 30), 2) - 0.5) * sh));
  nightSea(g, t, 118, { bright: clamp(1 - seg(t, 3.6, 5.2)) });
  if (tc < 0) crack(g, 1 - seg(t, 0, 1.4) * 0.6, t);
  const u = clamp(t / FALL);
  // 다가오는 별빛이 바다를 물들인다
  g.ditherEllipse(P1[0], 121, 10 + 60 * u, 2 + 6 * u, '#ff8a3a', tc < 0 ? 0.15 + 0.5 * u : 0.65 * clamp(1 - tc / 2.5));
  if (tc < 0) {
    for (let i = 17; i >= 0; i--) { // 꼬리: 지나온 자리 (뒤일수록 작고 붉다)
      const uu = u - i * 0.018; if (uu < 0) continue;
      const [x, y] = fallAt(uu), r = Math.max(0.6, 3.8 - i * 0.19 + u * 1.5);
      circ(g, x, y, r, TAIL[Math.min(7, Math.floor(i / 2.3))]);
    }
    const [hx, hy] = fallAt(u);
    glow(g, hx, hy, 18 + u * 24, '#ffb050', 0.7);
    circ(g, hx, hy, 2.5 + u, '#ffffff');
    for (let j = 0; j < 36; j++) { // 불티
      const tb = j * 0.068, a = t - tb; if (a < 0 || a > 0.7) continue;
      const [sx, sy] = fallAt(clamp(tb / FALL)), vx = (H(j, 3) - 0.5) * 40, vy = (H(j, 4) - 0.8) * 30;
      px(g, sx + vx * a, sy + vy * a + 30 * a * a, a < 0.25 ? '#fff4c0' : a < 0.5 ? '#ffa040' : '#a8301a');
    }
  } else {
    const k = clamp(tc / 1.8), hgt = 74 * Math.sin(Math.min(1, tc / 1.7) * Math.PI); // 물기둥
    if (hgt > 1) {
      for (let y = 0; y < hgt; y++) { const w = 4 + (1 - y / hgt) * 5 + Math.sin(y * 0.7 + t * 20) * 1.2; rect(g, P1[0] - w / 2, 120 - y, w, 1, y > hgt - 6 ? '#ffffff' : y % 3 ? '#cfefff' : '#ffffff'); }
      glow(g, P1[0], 120 - hgt * 0.5, 30, '#9fdcff', 0.35 * (1 - k));
    }
    for (let j = 0; j < 60; j++) { // 물보라
      const a = tc - H(j, 5) * 0.4; if (a < 0 || a > 1.6) continue;
      const ang = -Math.PI / 2 + (H(j, 6) - 0.5) * 2.2, sp = 40 + H(j, 7) * 70;
      const x = P1[0] + Math.cos(ang) * sp * a, y = 120 + Math.sin(ang) * sp * a + 60 * a * a;
      if (y < 121) px(g, x, y, H(j, 8) > 0.5 ? '#ffffff' : '#9fdcff');
    }
    for (const d of [0, 0.35, 0.8]) { const r = (tc - d) * 70; if (r > 2 && r < 230) { g.strokeStyle = hexA('#cfefff', 0.9 * clamp(1 - r / 230)); g.lineWidth = 1; g.beginPath(); g.ellipse(P1[0], 121, r, r * 0.09, 0, 0, Math.PI * 2); g.stroke(); } }
    cover(raw, 1 - seg(tc, 0.05, 0.6), '#ffffff'); // 하얀 섬광이 점묘로 걷힌다
    // 폭풍이 몰려온다: 어두워지고 비가 긋는다
    const st = seg(t, 3.6, 5.6);
    if (st > 0) {
      cover(raw, st * 0.55, '#05060c');
      g.strokeStyle = hexA('#8aa0c8', 0.55 * st); g.lineWidth = 1;
      for (let i = 0; i < 70 * st; i++) { const x = (H(i, 21) * (IW + 60) + t * 260) % (IW + 60) - 30, y = (H(i, 22) * IH + t * 420) % IH; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 9); g.stroke(); }
    }
  }
  g.restore();
} };

// 탑이 솟다: 폭풍 구름이 갈라지며 새벽빛 속에 탑과 섬이 드러나고, 꼭대기의 빛이 바람이 되어 흘러내린다
const CLOUDS = Array.from({ length: 14 }, (_, i) => ({ x: H(i, 31) * IW, y: 10 + H(i, 32) * 80, rx: 40 + H(i, 33) * 50, ry: 12 + H(i, 34) * 14, sd: H(i, 31) < 0.5 ? -1 : 1 }));
export const S3 = { dur: 6.6, text: '별이 떨어진 자리에 탑이 솟았고, 그 빛은 바람이 되었다.', textAt: 3.2, draw(g, t, raw) {
  const hz = 128, open = eIO(seg(t, 1.0, 4.4));
  vgrad(g, 0, hz, [[0, '#140e30'], [0.45, '#4a2050'], [0.78, '#c0503e'], [1, '#ffb45a']]);
  glow(g, 228, hz, 70, '#ffcf7a', 0.55 * open + 0.1); // 떠오르는 해
  circ(g, 228, hz + 2, 13, hexA('#ffe8b0', 0.4 + 0.6 * open));
  for (let i = 0; i < 5; i++) rect(g, 150 + i * 23 - (t * 4 % 23), hz - 18 + i * 3, 30 + i * 6, 1, hexA('#7a2a40', 0.6)); // 해 앞을 지나는 가는 구름
  vgrad(g, hz, IH, [[0, '#d07040'], [0.12, '#5a2a40'], [1, '#100a18']]);
  for (let i = 0; i < 40; i++) { const d = H(i, 41), y = hz + 2 + Math.floor(d * d * 50), x = (H(i, 42) * IW + t * (5 + 10 * d)) % IW; rect(g, x, y, 2 + Math.floor(5 * H(i, 43)), 1, Math.abs(x - 228) < 30 + d * 40 ? '#ffd890' : '#7a3a48'); }
  // 섬
  poly(g, [[86, hz + 1], [112, hz - 6], [128, hz - 9], [146, hz - 12], [176, hz - 12], [194, hz - 8], [214, hz - 5], [238, hz + 1]], '#120a14');
  for (let i = 0; i < 9; i++) { const x = 118 + i * 11 + H(i, 44) * 5, y = hz - 9 - (i > 2 && i < 7 ? 3 : 0); poly(g, [[x - 3, y + 2], [x, y - 6 - H(i, 45) * 3], [x + 3, y + 2]], '#120a14'); }
  // 탑: 오른쪽에서 새벽빛 테두리, 꼭대기 아르케가 숨 쉬듯 빛난다
  const pulse = 0.6 + 0.4 * Math.sin(t * 3);
  tower(g, 160, hz - 10, 106, { dark: '#0c0610', rim: open > 0.2 ? '#ff9a6a' : '#3a2a3a', rdx: -1, win: '#7af0e0', crystal: '#e8fff8', cglow: 0.5 + 0.5 * pulse * open });
  // 빛의 바람: 꼭대기에서 흘러나와 섬을 쓸고 지나가는 빛줄기
  const wk = seg(t, 2.6, 4.0);
  if (wk > 0) for (let i = 0; i < 7; i++) {
    const sd = i % 2 ? 1 : -1, sp = 0.28 + H(i, 51) * 0.12, ph = H(i, 52);
    for (let j = 0; j < 14; j++) {
      const s = (t * sp + ph + j * 0.012) % 1; if (s > wk * 1.2) continue;
      const x = 160 + sd * s * (170 + i * 12), y = 9 + s * (112 + i * 6) + Math.sin(s * 7 + t * 2.5 + i) * 7;
      px(g, x, y, j > 10 ? '#ffffff' : j > 5 ? '#fff0c0' : hexA('#ffe0a0', 0.6));
    }
  }
  // 폭풍 구름 · 비 · 번개 (구름이 양옆으로 갈라진다)
  if (open < 1) {
    const dark = 1 - open;
    cover(raw, dark * 0.75, '#07080e');
    for (const c of CLOUDS) { const x = c.x + c.sd * open * 260; ell(g, x, c.y, c.rx, c.ry, '#14161e'); ell(g, x - 4, c.y - 3, c.rx * 0.8, c.ry * 0.6, '#1e202a'); }
    g.strokeStyle = hexA('#8aa0c8', 0.6 * dark); g.lineWidth = 1;
    for (let i = 0; i < 60 * dark; i++) { const x = (H(i, 23) * (IW + 60) + t * 260) % (IW + 60) - 30, y = (H(i, 24) * IH + t * 420) % IH; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 9); g.stroke(); }
    if (t > 0.45 && t < 0.62) { path(g, [[150, 0], [156, 30], [150, 42], [158, 70], [160, 12]], '#ffffff', 2); cover(raw, 0.5, '#ffffff'); }
  }
} };

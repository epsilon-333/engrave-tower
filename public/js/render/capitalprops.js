// 왕도 아우렐리온의 장식물: 성벽 · 망루 · 성문 · 분수 · 산울타리 · 정원 석상 · 쇠울타리 · 처형대 · 시장 좌판
// 다른 바깥 장식물과 같은 그림체: 짙은 외곽선(OL) · 위는 밝게 · 아래는 어둡게, 돌은 줄눈, 나무는 결
import { TILE } from '../sim/mapgen.js';
import { hash } from './tiles.js';

const OL = '#1a1410';
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const sh = (g, cx, cy, rx, ry, a = 0.25) => { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
const disc = (g, cx, cy, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); };
const glow = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };

// 성벽 돌 색: 밝은 윗면 · 앞면 · 줄눈 · 그늘
const ST = { top: '#d2ccbe', top2: '#bcb6a6', face: '#aaa496', face2: '#98927f', joint: '#7e7868', dark: '#5e594e', moss: '#6a8a4a' };
const WALL_H = 40;
function stoneFace(g, x, y, w, h, seed) { // 쌓은 돌 앞면 (줄마다 어긋나게)
  R(g, OL, x - 1, y - 1, w + 2, h + 1);
  R(g, ST.face, x, y, w, h);
  for (let r = 0, yy = y; yy < y + h; r++, yy += 8) {
    R(g, ST.joint, x, yy + 7, w, 1);
    for (let k = (r % 2) * 7 - 7; k < w; k += 14) { if (k > 0) R(g, ST.joint, x + k, yy, 1, 7); if (hash(k + x, r, seed) % 5 === 0) R(g, ST.face2, x + Math.max(0, k) + 1, yy, Math.min(13, w - Math.max(0, k) - 1), 7); }
    R(g, 'rgba(255,255,255,0.12)', x, yy, w, 1);
  }
  R(g, 'rgba(0,0,0,0.18)', x, y + h - 6, w, 6); // 발치 그늘
}
function merlons(g, x, y, w, seed) { // 성가퀴 (톱니) — 윗면 바깥 가장자리
  for (let k = 0; k + 5 <= w; k += 9) { R(g, OL, x + k - 1, y - 6, 7, 7); R(g, ST.top, x + k, y - 5, 5, 3); R(g, ST.face2, x + k, y - 2, 5, 2); if (hash(k, seed, 3) % 7 === 0) R(g, ST.moss, x + k, y - 5, 2, 1); }
}
function towerBody(g, cx, by, wd, hgt, roof, flag, t, seed) { // 네모 망루: 돌 몸통 · 화살 구멍 · 성가퀴 · 뾰족 지붕 · 깃발
  const x = cx - wd / 2;
  sh(g, cx, by - 2, wd / 2 + 4, 4, 0.3);
  stoneFace(g, x, by - hgt, wd, hgt, seed);
  R(g, OL, x - 3, by - hgt - 7, wd + 6, 8); R(g, ST.top, x - 2, by - hgt - 6, wd + 4, 4); R(g, ST.top2, x - 2, by - hgt - 2, wd + 4, 2); // 돌출 난간
  for (const sy of [by - hgt + 12, by - hgt + 30]) if (sy < by - 12) { R(g, OL, cx - 2, sy, 4, 10); R(g, '#141018', cx - 1, sy + 1, 2, 8); } // 화살 구멍
  const rb = by - hgt - 6, rt = rb - 30;
  g.fillStyle = OL; g.beginPath(); g.moveTo(x - 5, rb + 1); g.lineTo(cx, rt - 1); g.lineTo(x + wd + 5, rb + 1); g.closePath(); g.fill();
  g.fillStyle = roof; g.beginPath(); g.moveTo(x - 4, rb); g.lineTo(cx, rt); g.lineTo(x + wd + 4, rb); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(cx, rt); g.lineTo(x + wd + 4, rb); g.lineTo(cx + 2, rb); g.closePath(); g.fill(); // 지붕 그늘 쪽
  for (let k = 6; k < 30; k += 6) { const hw = (wd / 2 + 4) * (k / 30); R(g, 'rgba(0,0,0,0.18)', cx - hw, rt + k, hw * 2, 1); }
  R(g, OL, cx - 1, rt - 14, 2, 14); R(g, '#8a8a92', cx, rt - 13, 1, 13);
  const fw = Math.round(9 + Math.sin(t * 5 + seed) * 2);
  R(g, OL, cx + 1, rt - 15, fw + 2, 8); R(g, flag, cx + 2, rt - 14, fw, 6); R(g, '#ffd76a', cx + 3, rt - 12, 2, 2);
}

const STALL_GOODS = {
  fruit(g, x, y) { const c = ['#e83a3a', '#ffd040', '#7ac83a', '#ff8a2a']; for (let i = 0; i < 9; i++) { const px = x + 4 + (i % 5) * 8 + (i > 4 ? 4 : 0), py = y - (i > 4 ? 5 : 1); disc(g, px, py, 3, OL); disc(g, px, py, 2.4, c[(i * 3) % 4]); R(g, 'rgba(255,255,255,0.5)', px - 1, py - 2, 1, 1); } },
  bread(g, x, y) { for (let i = 0; i < 5; i++) { const px = x + 3 + i * 8, py = y - 3 - (i % 2) * 2; R(g, OL, px - 1, py - 3, 9, 6); R(g, '#c8803a', px, py - 2, 7, 4); R(g, '#e8b060', px + 1, py - 2, 5, 1); R(g, '#8a5020', px + 2, py, 1, 1); R(g, '#8a5020', px + 5, py, 1, 1); } },
  crates(g, x, y) { for (const [ox, w, h] of [[2, 12, 10], [16, 10, 8], [28, 14, 11]]) { R(g, OL, x + ox - 1, y - h - 1, w + 2, h + 2); R(g, '#a8783e', x + ox, y - h, w, h); R(g, '#7a5228', x + ox, y - h, w, 1); R(g, '#7a5228', x + ox + w / 2, y - h, 1, h); } R(g, OL, x + 18, y - 16, 8, 8); R(g, '#e8d8a8', x + 19, y - 15, 6, 6); },
  arms(g, x, y) { for (const sx of [6, 12, 18]) { R(g, OL, x + sx - 1, y - 20, 3, 18); R(g, '#d8dce8', x + sx, y - 19, 1, 15); R(g, '#c8a040', x + sx - 2, y - 5, 5, 1); } R(g, OL, x + 25, y - 14, 12, 13); R(g, '#3a5a9a', x + 26, y - 13, 10, 11); R(g, '#ffd76a', x + 30, y - 11, 2, 7); disc(g, x + 42, y - 6, 5, OL); disc(g, x + 42, y - 6, 4, '#a8acb8'); R(g, '#6a6a72', x + 39, y - 5, 7, 1); },
  cloth(g, x, y) { const c = ['#a83a6a', '#3a6a9a', '#e8c040', '#4a8a4a', '#f4ecd8']; for (let i = 0; i < 5; i++) { const px = x + 2 + i * 9; R(g, OL, px - 1, y - 9, 9, 9); R(g, c[i], px, y - 8, 7, 7); R(g, 'rgba(255,255,255,0.3)', px, y - 8, 7, 1); R(g, 'rgba(0,0,0,0.2)', px + 5, y - 8, 2, 7); } },
  spice(g, x, y) { const c = ['#e0582a', '#ffd040', '#8a3a1a', '#c8a060']; for (let i = 0; i < 4; i++) { const px = x + 3 + i * 11; R(g, OL, px - 1, y - 10, 10, 10); R(g, '#c8b080', px, y - 9, 8, 9); R(g, c[i], px + 1, y - 10, 6, 3); disc(g, px + 4, y - 10, 3, c[i]); } },
  fish(g, x, y) { R(g, '#d8f0ff', x + 2, y - 4, 44, 3); for (let i = 0; i < 4; i++) { const px = x + 4 + i * 11, py = y - 6; R(g, OL, px - 1, py - 2, 10, 5); R(g, '#7a9ab0', px, py - 1, 8, 3); R(g, '#b8d0e0', px, py - 1, 8, 1); R(g, '#7a9ab0', px + 8, py - 2, 2, 5); R(g, OL, px + 1, py - 1, 1, 1); } },
  pots(g, x, y) { for (let i = 0; i < 4; i++) { const px = x + 6 + i * 11, h = 9 + (i % 2) * 3; disc(g, px, y - h / 2, 5, OL); disc(g, px, y - h / 2, 4, ['#b8603a', '#c8804a', '#8a4a2a'][i % 3]); R(g, OL, px - 2, y - h - 2, 5, 3); R(g, '#d89a6a', px - 1, y - h - 1, 3, 1); } },
  flowers(g, x, y) { const c = ['#e83a5a', '#ffd040', '#ff8ab8', '#9a6ae8', '#ffffff']; for (let i = 0; i < 4; i++) { const px = x + 5 + i * 11; R(g, OL, px - 3, y - 7, 8, 7); R(g, '#6a6a72', px - 2, y - 6, 6, 6); for (let k = 0; k < 4; k++) { R(g, '#3a8a32', px - 1 + k, y - 12 + (k % 2), 1, 5); disc(g, px - 1 + k * 1.5, y - 13 + (k % 2) * 2, 1.6, c[(i + k) % 5]); } } },
  wine(g, x, y) { disc(g, x + 10, y - 8, 8, OL); disc(g, x + 10, y - 8, 7, '#8a5a32'); R(g, '#4a4a52', x + 3, y - 10, 14, 1); R(g, '#4a4a52', x + 3, y - 5, 14, 1); for (let i = 0; i < 4; i++) { const px = x + 22 + i * 6; R(g, OL, px - 1, y - 13, 5, 13); R(g, '#3a1a2a', px, y - 12, 3, 12); R(g, '#6a1a2a', px, y - 8, 3, 4); R(g, OL, px, y - 16, 3, 4); } },
  closed(g, x, y) { g.fillStyle = OL; g.beginPath(); g.moveTo(x + 1, y + 1); g.lineTo(x + 6, y - 12); g.lineTo(x + 42, y - 12); g.lineTo(x + 47, y + 1); g.fill(); g.fillStyle = '#7a7a62'; g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + 7, y - 11); g.lineTo(x + 41, y - 11); g.lineTo(x + 46, y); g.fill(); R(g, '#5a5a48', x + 20, y - 11, 1, 11); R(g, '#c8b080', x + 3, y - 4, 42, 1); },
};

const CP = {
  cityWall(g, pr, t) {
    const x = pr.x * TILE, y = pr.y * TILE, W = pr.w * TILE, H = pr.h * TILE, by = y + H, seed = pr.x * 31 + pr.y;
    if (pr.dir === 'h') {
      R(g, OL, x - 1, y - WALL_H - 1, W + 2, TILE + 2); R(g, ST.top, x, y - WALL_H, W, TILE); R(g, ST.top2, x, y - WALL_H + TILE - 4, W, 4); // 위 통로
      for (let k = 6; k < W; k += 16) R(g, 'rgba(0,0,0,0.08)', x + k, y - WALL_H + 2, 1, TILE - 6);
      merlons(g, x + 2, y - WALL_H + (pr.outer === 'n' ? 1 : TILE - 1), W - 4, seed); // 바깥쪽에 성가퀴
      stoneFace(g, x, by - WALL_H, W, WALL_H, seed);
      if (pr.outer === 's') for (let k = 24; k < W - 8; k += 32) { R(g, OL, x + k - 1, by - WALL_H + 12, 4, 12); R(g, '#141018', x + k, by - WALL_H + 13, 2, 10); } // 화살 구멍 (바깥을 향한다)
      if (hash(pr.x, pr.y, 5) % 3 === 0) { R(g, ST.moss, x + 6, by - 8, 8, 3); R(g, '#8aa85a', x + 7, by - 9, 4, 1); } // 이끼
    } else {
      R(g, OL, x - 1, y - WALL_H - 1, TILE + 2, H + 1); R(g, ST.top, x, y - WALL_H, TILE, H); R(g, ST.top2, x + (pr.outer === 'w' ? TILE - 4 : 0), y - WALL_H, 4, H); // 위 통로 (안쪽 가장자리 그늘)
      const ox = pr.outer === 'w' ? x : x + TILE - 5;
      for (let k = 2; k + 5 <= H; k += 9) { R(g, OL, ox - 1, y - WALL_H + k - 6, 7, 7); R(g, ST.top, ox, y - WALL_H + k - 5, 5, 3); R(g, ST.face2, ox, y - WALL_H + k - 2, 5, 2); }
      stoneFace(g, x, by - WALL_H, TILE, WALL_H, seed);
    }
  },
  wallTower(g, pr, t) {
    const x = pr.x * TILE, W = pr.w * TILE, by = (pr.y + pr.h) * TILE, cx = x + W / 2;
    towerBody(g, cx, by, W + 6, pr.gate ? 64 : 58, pr.corner ? '#2e4a82' : '#3a5a9a', pr.gate ? '#2a4a9a' : '#8a1a2a', t, pr.x + pr.y);
    if (pr.gate && pr.part === 'n') { // 성문 쪽 망루: 아래 통로를 내려다보는 쇠창살 (올려 둔 채)
      const gy = by + 2;
      for (let k = 0; k < 4; k++) { R(g, OL, x + 4 + k * 7, gy, 3, 10); R(g, '#5a5a62', x + 5 + k * 7, gy, 1, 8); R(g, '#8a8a92', x + 5 + k * 7, gy + 8, 1, 2); }
    }
  },
  cityGate(g, pr, t) { // 남문: 망루 둘 · 가운데 아치 통로(뚫려 있다) · 왕실 문장 · 올려 둔 쇠창살
    const x = pr.x * TILE, W = pr.w * TILE, by = (pr.y + pr.h) * TILE;
    const ax0 = x + 2 * TILE, ax1 = x + W - 2 * TILE, acx = (ax0 + ax1) / 2, archTop = by - 62, arch = by - 34;
    // 아치 위 통로 (두 칸 깊이)
    R(g, OL, ax0 - 1, archTop - 33, ax1 - ax0 + 2, 34); R(g, ST.top, ax0, archTop - 32, ax1 - ax0, 32); R(g, ST.top2, ax0, archTop - 6, ax1 - ax0, 6);
    merlons(g, ax0 + 2, archTop, ax1 - ax0 - 4, 9);
    // 아치 앞면: 아래가 둥글게 뚫렸다
    g.fillStyle = OL; g.beginPath(); g.moveTo(ax0 - 1, by); g.lineTo(ax0 - 1, archTop - 1); g.lineTo(ax1 + 1, archTop - 1); g.lineTo(ax1 + 1, by); g.lineTo(ax1 - 4, by); g.lineTo(ax1 - 4, arch); g.ellipse(acx, arch, (ax1 - ax0) / 2 - 4, 14, 0, 0, Math.PI, true); g.lineTo(ax0 + 4, by); g.closePath(); g.fill();
    g.fillStyle = ST.face; g.beginPath(); g.moveTo(ax0, by); g.lineTo(ax0, archTop); g.lineTo(ax1, archTop); g.lineTo(ax1, by); g.lineTo(ax1 - 5, by); g.lineTo(ax1 - 5, arch); g.ellipse(acx, arch, (ax1 - ax0) / 2 - 5, 13, 0, 0, Math.PI, true); g.lineTo(ax0 + 5, by); g.closePath(); g.fill();
    for (let yy = archTop + 7; yy < arch - 10; yy += 8) R(g, ST.joint, ax0, yy, ax1 - ax0, 1);
    for (let k = 0; k < 9; k++) { const a = Math.PI + (k / 8) * Math.PI, px = acx + Math.cos(a) * ((ax1 - ax0) / 2 - 5), py = arch + Math.sin(a) * 13; R(g, OL, px - 3, py - 3, 6, 5); R(g, '#c8c2b0', px - 2, py - 2, 4, 3); } // 아치 돌 테
    for (let k = 0; k < 6; k++) { const px = ax0 + 10 + k * 5; R(g, '#3a3a42', px, arch - 13, 2, 6); R(g, '#7a7a82', px, arch - 8, 2, 2); } // 올려 둔 쇠창살 끝
    R(g, OL, acx - 8, archTop + 5, 16, 18); R(g, '#2a4a9a', acx - 7, archTop + 6, 14, 15); g.fillStyle = '#2a4a9a'; g.beginPath(); g.moveTo(acx - 7, archTop + 21); g.lineTo(acx, archTop + 26); g.lineTo(acx + 7, archTop + 21); g.fill(); // 문장 방패
    R(g, '#ffd76a', acx - 4, archTop + 11, 8, 3); R(g, '#ffd76a', acx - 4, archTop + 8, 2, 3); R(g, '#ffd76a', acx - 1, archTop + 7, 2, 4); R(g, '#ffd76a', acx + 2, archTop + 8, 2, 3); // 왕관
    for (const bx of [ax0 + 6, ax1 - 14]) { R(g, OL, bx, archTop + 4, 9, 26); R(g, '#8a1a2a', bx + 1, archTop + 5, 7, 23); R(g, '#ffd76a', bx + 3, archTop + 10, 3, 3); g.fillStyle = '#8a1a2a'; g.beginPath(); g.moveTo(bx + 1, archTop + 28); g.lineTo(bx + 4, archTop + 32); g.lineTo(bx + 8, archTop + 28); g.fill(); } // 걸개 깃발
    towerBody(g, x + TILE, by, 2 * TILE + 6, 76, '#2e4a82', '#2a4a9a', t, 1);
    towerBody(g, x + W - TILE, by, 2 * TILE + 6, 76, '#2e4a82', '#2a4a9a', t, 2);
  },
  fountain(g, pr, t) { // 분수: 둥근 돌 수반 · 출렁이는 물 · 가운데 왕의 석상 · 물줄기
    const x = pr.x * TILE, W = pr.w * TILE, by = (pr.y + pr.h) * TILE, cx = x + W / 2, cy = by - 12;
    sh(g, cx, by - 3, W / 2 + 4, 6, 0.28);
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, cy, W / 2 + 2, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ST.face; g.beginPath(); g.ellipse(cx, cy + 2, W / 2 + 1, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ST.top; g.beginPath(); g.ellipse(cx, cy - 2, W / 2 + 1, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a7ab8'; g.beginPath(); g.ellipse(cx, cy - 2, W / 2 - 4, 8, 0, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 6; k++) { const a = t * 0.8 + k; R(g, 'rgba(220,240,255,0.7)', cx + Math.cos(a) * (W / 2 - 10), cy - 2 + Math.sin(a) * 5, 4, 1); }
    R(g, OL, cx - 5, cy - 22, 10, 20); R(g, ST.top2, cx - 4, cy - 21, 8, 19); // 받침
    R(g, OL, cx - 4, cy - 40, 8, 19); R(g, '#c8c8c0', cx - 3, cy - 39, 6, 17); R(g, '#a8a8a0', cx + 1, cy - 39, 2, 17); // 석상 몸
    disc(g, cx, cy - 43, 4, OL); disc(g, cx, cy - 43, 3, '#d8d8d0'); R(g, '#ffd76a', cx - 3, cy - 48, 6, 2); R(g, '#ffd76a', cx - 3, cy - 50, 1, 2); R(g, '#ffd76a', cx, cy - 51, 1, 3); R(g, '#ffd76a', cx + 2, cy - 50, 1, 2); // 왕관
    R(g, OL, cx + 3, cy - 52, 2, 18); R(g, '#c8c8c0', cx + 4, cy - 51, 1, 16); // 홀
    for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const u = ((t * 1.6 + k / 7) % 1), px = cx + s * (3 + u * 14), py = cy - 24 + (u * 2 - 1) ** 2 * 18 - 4; R(g, `rgba(190,230,255,${0.9 - u * 0.5})`, px, py, 2, 2); }
  },
  hedge(g, pr) { // 산울타리: 다듬은 둥근 덤불
    const x = pr.x * TILE, by = (pr.y + 1) * TILE, cx = x + 8;
    sh(g, cx, by - 2, 9, 3);
    R(g, OL, x - 1, by - 18, 18, 18); R(g, '#3a7a32', x, by - 17, 16, 16); R(g, '#4e9a40', x, by - 17, 16, 5); R(g, '#2a5a24', x, by - 5, 16, 4);
    for (let k = 0; k < 6; k++) R(g, '#6ab85a', x + (hash(k, pr.x, 2) % 13) + 1, by - 16 + (hash(k, pr.y, 4) % 9), 2, 1);
  },
  gardenStatue(g, pr) { // 정원 석상: 칼을 짚은 기사
    const cx = pr.x * TILE + 8, by = (pr.y + 1) * TILE;
    sh(g, cx, by - 2, 8, 3);
    R(g, OL, cx - 7, by - 9, 14, 9); R(g, ST.top2, cx - 6, by - 8, 12, 7); R(g, ST.top, cx - 6, by - 8, 12, 2);
    R(g, OL, cx - 4, by - 26, 8, 18); R(g, '#c8c8c0', cx - 3, by - 25, 6, 16); R(g, '#a8a8a0', cx + 1, by - 25, 2, 16);
    disc(g, cx, by - 29, 4, OL); disc(g, cx, by - 29, 3, '#d0d0c8'); R(g, '#a8a8a0', cx - 3, by - 30, 6, 1);
    R(g, OL, cx + 4, by - 24, 2, 16); R(g, '#e0e0d8', cx + 5, by - 23, 1, 14); R(g, OL, cx + 2, by - 22, 6, 1);
  },
  ironFence(g, pr) { // 감옥 쇠울타리: 창끝 달린 쇠막대
    const x = pr.x * TILE, y = pr.y * TILE, W = pr.w * TILE, H = pr.h * TILE, by = y + H, cx = x + W / 2;
    const bar = (px, py) => { R(g, OL, px - 1, py - 22, 3, 22); R(g, '#3a3a44', px, py - 21, 1, 21); R(g, OL, px - 2, py - 25, 5, 3); R(g, '#7a7a86', px - 1, py - 24, 3, 1); };
    if (pr.dir === 'h') { R(g, OL, x, by - 20, W, 3); R(g, '#4a4a56', x, by - 19, W, 1); R(g, OL, x, by - 8, W, 3); R(g, '#4a4a56', x, by - 7, W, 1); for (let px = x + 2; px < x + W; px += 5) bar(px, by - 1); }
    else { R(g, OL, cx - 2, y - 22, 4, H + 20); R(g, '#4a4a56', cx - 1, y - 22, 2, H + 19); bar(cx, by - 1); bar(cx, by - 8); }
  },
  scaffold(g, pr, t) { // 처형대: 높인 나무 단 · 검은 천 · 계단 · 교수대 틀 · 도끼 받침 · 깃발
    const x = pr.x * TILE, y = pr.y * TILE, W = pr.w * TILE, by = (pr.y + pr.h) * TILE, LIFT = 14;
    sh(g, x + W / 2, by - 2, W / 2 + 4, 6, 0.3);
    // 뒤쪽 교수대 틀 (단 위에서 솟는다)
    const gx0 = x + 20, gx1 = x + 66, gTop = y - LIFT - 50;
    for (const px of [gx0, gx1]) { R(g, OL, px - 3, gTop, 7, 54); R(g, '#6a4628', px - 2, gTop + 1, 5, 52); R(g, '#8a5e36', px - 2, gTop + 1, 1, 52); }
    R(g, OL, gx0 - 6, gTop - 4, gx1 - gx0 + 13, 7); R(g, '#7a5232', gx0 - 5, gTop - 3, gx1 - gx0 + 11, 5); R(g, '#9a6e42', gx0 - 5, gTop - 3, gx1 - gx0 + 11, 1);
    g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(gx0 + 1, gTop + 12); g.lineTo(gx0 + 10, gTop + 2); g.moveTo(gx1 - 1, gTop + 12); g.lineTo(gx1 - 10, gTop + 2); g.stroke(); // 버팀대
    const sw = Math.sin(t * 1.3) * 1.2, rx = (gx0 + gx1) / 2 + sw;
    R(g, '#b89a6a', rx, gTop + 3, 1, 20); g.strokeStyle = '#b89a6a'; g.lineWidth = 1; g.beginPath(); g.ellipse(rx + 0.5, gTop + 26, 3, 4, 0, 0, Math.PI * 2); g.stroke(); // 밧줄
    // 단 윗면 (널빤지)
    R(g, OL, x - 1, y - LIFT - 1, W + 2, pr.h * TILE + 1);
    R(g, '#9a6e42', x, y - LIFT, W, pr.h * TILE - 2);
    for (let yy = y - LIFT + 7; yy < by - LIFT; yy += 8) R(g, '#7a5232', x, yy, W, 1);
    for (let k = 0; k < W; k += 22) R(g, 'rgba(0,0,0,0.12)', x + k + (hash(k, pr.x, 1) % 8), y - LIFT, 1, pr.h * TILE - 2);
    // 앞면: 검은 천 · 금빛 술
    R(g, OL, x - 1, by - LIFT - 1, W + 2, LIFT + 1); R(g, '#1e1820', x, by - LIFT, W, LIFT);
    for (let k = 4; k < W; k += 12) { R(g, '#2e2630', x + k, by - LIFT, 6, LIFT); R(g, '#c8a040', x + k + 2, by - 3, 2, 3); }
    R(g, '#c8a040', x, by - LIFT, W, 1);
    // 계단 (왼쪽 앞)
    for (let s = 0; s < 3; s++) { const sx = x - 14 + s * 4, sy = by - 4 - s * 4; R(g, OL, sx - 1, sy - 1, 14, 6); R(g, '#8a5e36', sx, sy, 12, 4); R(g, '#a8784a', sx, sy, 12, 1); }
    // 도끼 받침 (오른쪽)
    const bx = x + W - 26, byy = y - LIFT + 24;
    R(g, OL, bx - 1, byy - 9, 16, 11); R(g, '#6a4226', bx, byy - 8, 14, 9); R(g, '#8a5a32', bx, byy - 8, 14, 2); R(g, '#4a2a18', bx + 4, byy - 8, 5, 1);
    // 왕실 깃발 (뒤 양 끝)
    for (const fx of [x + 3, x + W - 6]) { R(g, OL, fx, y - LIFT - 40, 3, 40); R(g, '#5a5a62', fx + 1, y - LIFT - 39, 1, 38); const fw = Math.round(10 + Math.sin(t * 4 + fx) * 2); R(g, OL, fx + 3, y - LIFT - 40, fw + 1, 9); R(g, '#2a4a9a', fx + 3, y - LIFT - 39, fw, 7); R(g, '#ffd76a', fx + 5, y - LIFT - 37, 3, 3); }
  },
  stall(g, pr, t) { // 시장 좌판: 나무 계산대 · 물건 · 줄무늬 차양 · 네 기둥
    const x = pr.x * TILE, W = pr.w * TILE, by = (pr.y + pr.h) * TILE, awn = pr.awn || '#c84a3a';
    sh(g, x + W / 2, by - 2, W / 2 + 2, 4);
    for (const px of [x + 2, x + W - 5]) { R(g, OL, px - 1, by - 70, 5, 70); R(g, '#7a5232', px, by - 69, 3, 68); R(g, '#9a6e42', px, by - 69, 1, 68); } // 앞 기둥 (장사꾼 머리 위로 차양이 오게 높게)
    R(g, OL, x - 1, by - 24, W + 2, 24); R(g, '#8a5e36', x, by - 23, W, 22); R(g, '#a8784a', x, by - 23, W, 3); // 계산대
    for (let k = 6; k < W; k += 10) R(g, '#6a4226', x + k, by - 18, 1, 16);
    (STALL_GOODS[pr.goods] || STALL_GOODS.crates)(g, x + 1, by - 23);
    // 차양: 앞으로 기울어진 줄무늬 천, 아래가 물결
    const ay = by - 80, sway = Math.sin(t * 2 + pr.x) * 0.8;
    g.fillStyle = OL; g.beginPath(); g.moveTo(x - 4, ay + 12); g.lineTo(x + 2, ay - 1); g.lineTo(x + W - 2, ay - 1); g.lineTo(x + W + 4, ay + 12); g.fill();
    for (let k = 0; k < W + 8; k += 8) {
      const col = (k / 8) % 2 ? '#f4ecdc' : awn, sx = x - 4 + k;
      g.fillStyle = col; g.beginPath(); g.moveTo(sx, ay + 11); g.lineTo(sx + 5 + (k / (W + 8)) * 0, ay); g.lineTo(sx + 13, ay); g.lineTo(sx + 8, ay + 11); g.fill();
      g.fillStyle = col; g.beginPath(); g.moveTo(sx, ay + 11); g.lineTo(sx + 4 + sway, ay + 15); g.lineTo(sx + 8, ay + 11); g.fill();
    }
    R(g, 'rgba(0,0,0,0.25)', x, ay + 12, W, 2);
  },
};

export function drawCapitalProp(g, pr, t, night) {
  const f = CP[pr.kind];
  if (!f) return false;
  f(g, pr, t, night);
  return true;
}

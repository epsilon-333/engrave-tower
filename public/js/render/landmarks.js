// 종족 성지의 커다란 상징물 (성지 마을이 생기면 크게 그린다): 세계수 · 마탑 · 왕성 · 투기장 · 납골당 · 그림자 길드 · 거대 둥지 · 용의 둥지
import { TILE } from '../sim/mapgen.js';
import { hash } from './tiles.js';
import { PixelCtx } from './pixelctx.js';

const OL = '#1a1410';
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const disc = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); };
const shadowEllipse = (g, cx, cy, rx, ry, a = 0.25) => { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
const glowAt = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
const poly = (g, col, pts) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
function blobs(g, list, cols) { // 외곽선 · 어두운 면 · 밝은 면 · 반짝임 순서로 둥근 덩어리 묶음
  for (const [x, y, r] of list) disc(g, x, y, r + 1, OL);
  for (const [x, y, r] of list) disc(g, x, y, r, cols[3]);
  for (const [x, y, r] of list) disc(g, x - 1, y - 1.5, r - 2, cols[0]);
  for (const [x, y, r] of list) disc(g, x - r * 0.3, y - r * 0.32, r * 0.45, cols[1]);
}
// 울퉁불퉁한 잎 덩이: 가장자리가 잎처럼 들쭉날쭉 (동그라미가 아니게)
function lump(g, x, y, r, s, col) {
  if (r <= 0) return;
  g.fillStyle = col; g.beginPath();
  const n = Math.max(16, Math.round(r * 1.1));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + 0.09 * Math.sin(a * 5 + s) + 0.06 * Math.sin(a * 9 + s * 1.7) + 0.05 * Math.sin(a * 14 + s * 2.3);
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k * 0.94;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}
// 잎 덩어리: 그늘진 잎 덩이 위에 밝은 덩이, 그 위에 잎 결 (위 왼쪽은 햇빛 받은 잎 무리, 아래는 그늘진 잎)
function leafy(g, list, cols, seed) {
  list.forEach(([x, y, r], i) => lump(g, x, y, r + 1, i + seed, OL));
  list.forEach(([x, y, r], i) => lump(g, x, y, r, i + seed, cols[3]));
  list.forEach(([x, y, r], i) => lump(g, x - 1, y - 2, r - 3, i + seed + 0.5, cols[0]));
  list.forEach(([x, y, r], i) => {
    for (let k = 0, n = Math.round(r * 1.7); k < n; k++) {
      const h = hash(k, i, seed), a = (h % 628) / 100, d = (((h >>> 10) % 100) / 100) * r * 0.86, lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.92;
      const up = ly < y - r * 0.1 && lx < x + r * 0.4;
      R(g, up ? (k % 3 ? cols[1] : cols[2]) : cols[3], lx, ly, 3, 2); R(g, up ? cols[2] : cols[0], lx + 1, ly - 1, 1, 1);
    }
  });
}
function stoneWall(g, x, y, w, h, cols, rowH = 9) { // 돌을 쌓은 벽면 (줄눈 · 왼쪽 밝게 · 오른쪽 어둡게)
  R(g, OL, x - 1, y - 1, w + 2, h + 2); R(g, cols[0], x, y, w, h); R(g, cols[2], x, y, Math.max(2, w * 0.18), h); R(g, cols[3], x + w * 0.84, y, w * 0.16, h);
  for (let k = rowH; k < h; k += rowH) R(g, 'rgba(0,0,0,0.22)', x, y + k, w, 1);
  for (let k = 0; k < h; k += rowH) for (let j = ((k / rowH) % 2) * 7; j < w; j += 14) R(g, 'rgba(0,0,0,0.16)', x + j, y + k, 1, rowH - 1);
}
// 끝이 가늘어지는 굽은 줄기 (뿌리 · 가지 · 갈비뼈)
function limb(g, x0, y0, x1, y1, bend, w0, w1, col, out = OL) {
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend, n = 14, L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
    const x = a * x0 + b * mx + c * x1, y = a * y0 + b * my + c * y1;
    const dx = 2 * (1 - s) * (mx - x0) + 2 * s * (x1 - mx), dy = 2 * (1 - s) * (my - y0) + 2 * s * (y1 - my), dl = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * s) / 2;
    L.push([x - (dy / dl) * w, y + (dx / dl) * w]); Rr.push([x + (dy / dl) * w, y - (dx / dl) * w]);
  }
  const pts = [...L, ...Rr.reverse()];
  if (out) { g.strokeStyle = out; g.lineWidth = 2; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke(); }
  poly(g, col, pts);
}

// 무거운 상징물은 움직이지 않는 부분을 한 번만 도트로 그려 두고(밤낮 따로), 빛나는 것만 매번 그린다
const CACHED = new Set(['worldTree']), LCACHE = new Map();
export function drawLandmark(g, pr, t, night) {
  const W = pr.w * TILE, cx = pr.x * TILE + W / 2, by = (pr.y + pr.h) * TILE;
  const f = LANDMARK[pr.kind];
  if (!f) return false;
  if (CACHED.has(pr.kind)) {
    const box = LANDMARK_BOX[pr.kind], x0 = Math.floor(cx + box[0]) - 8, y0 = Math.floor(by + box[1]) - 8, w = Math.ceil(box[2] - box[0]) + 16, h = Math.ceil(-box[1]) + 56;
    const key = `${pr.kind}|${pr.x},${pr.y}|${night ? 1 : 0}`;
    let c = LCACHE.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = w; c.height = h;
      const pg = new PixelCtx(c.getContext('2d')); pg.translate(-x0, -y0);
      f(pg, cx, by, W, 0, night, pr, 'static');
      LCACHE.set(key, c); if (LCACHE.size > 8) LCACHE.delete(LCACHE.keys().next().value);
    }
    g.drawImage(c, x0, y0);
    f(g, cx, by, W, t, night, pr, 'dynamic');
    return true;
  }
  f(g, cx, by, W, t, night, pr);
  return true;
}
// 상징물이 그려지는 대략의 범위 (가림 · 화면 밖 판단용): [왼쪽, 위, 오른쪽] (가운데 아래 기준 px)
export const LANDMARK_BOX = { worldTree: [-200, -380, 200], mageTower: [-70, -430, 70], castle: [-135, -230, 135], arena: [-125, -130, 125], mausoleum: [-80, -215, 80], guildHouse: [-90, -190, 90], nest: [-110, -120, 110], dragonNest: [-120, -200, 120] };

const LANDMARK = {
  // ── 세계수: 하늘을 덮는 잎, 땅을 움켜쥔 뿌리, 줄기에 난 문과 빛나는 엘프 문양 ──
  worldTree(g, cx, by, W, t, night, pr, part) {
    const ST = part !== 'dynamic', DY = part !== 'static';
    if (ST) {
    shadowEllipse(g, cx, by - 4, 170, 36, 0.2);
    const bark = '#6e4c30', barkD = '#4e3420', barkL = '#8e6a44';
    // 뿌리 (땅 위로 굽이친다)
    for (const [s, dy, len, bend, w] of [[-1, 6, 92, 0.12, 16], [-1, -2, 70, -0.1, 12], [-1, 14, 54, 0.2, 9], [1, 6, 96, -0.12, 16], [1, -2, 72, 0.1, 12], [1, 14, 58, -0.2, 9]]) {
      limb(g, cx + s * 30, by - 10, cx + s * (34 + len), by + dy, bend * s, w, 2, bark);
      limb(g, cx + s * 31, by - 12, cx + s * (34 + len * 0.8), by + dy - 3, bend * s, w * 0.35, 1, barkL, null);
    }
    // 아래 큰 가지
    limb(g, cx - 20, by - 150, cx - 132, by - 214, -0.18, 26, 7, bark);
    limb(g, cx + 22, by - 160, cx + 136, by - 226, 0.18, 26, 7, bark);
    limb(g, cx - 6, by - 190, cx - 60, by - 270, -0.1, 16, 5, barkD);
    limb(g, cx + 8, by - 196, cx + 70, by - 280, 0.1, 16, 5, barkD);
    // 줄기
    const trunk = [[cx - 50, by], [cx - 36, by - 30], [cx - 30, by - 90], [cx - 28, by - 150], [cx - 36, by - 196], [cx + 38, by - 200], [cx + 30, by - 152], [cx + 31, by - 92], [cx + 38, by - 30], [cx + 52, by]];
    g.strokeStyle = OL; g.lineWidth = 3; g.beginPath(); trunk.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
    poly(g, bark, trunk);
    poly(g, barkL, [[cx - 48, by - 1], [cx - 34, by - 30], [cx - 28, by - 90], [cx - 26, by - 150], [cx - 33, by - 194], [cx - 20, by - 196], [cx - 16, by - 150], [cx - 18, by - 90], [cx - 24, by - 30], [cx - 34, by - 1]]);
    poly(g, barkD, [[cx + 50, by - 1], [cx + 36, by - 30], [cx + 29, by - 92], [cx + 28, by - 152], [cx + 36, by - 198], [cx + 24, by - 198], [cx + 18, by - 150], [cx + 20, by - 92], [cx + 26, by - 30], [cx + 36, by - 1]]);
    for (let i = 0; i < 9; i++) { // 나무껍질 골
      const bx0 = cx - 26 + i * 6.5;
      g.strokeStyle = 'rgba(40,24,12,0.55)'; g.lineWidth = 1.2; g.beginPath();
      for (let yy = by - 4; yy > by - 190; yy -= 6) { const xx = bx0 + Math.sin(yy * 0.06 + i) * 2 + (i - 4) * (1 - (by - yy) / 260) * 3; if (yy === by - 4) g.moveTo(xx, yy); else g.lineTo(xx, yy); }
      g.stroke();
    }
    for (const [kx, ky] of [[-14, 110], [16, 66], [-6, 160]]) { disc(g, cx + kx, by - ky, 5, OL); disc(g, cx + kx, by - ky, 4, barkD); disc(g, cx + kx - 1, by - ky - 1, 2, '#3a2414'); }
    // 이끼
    for (let i = 0; i < 16; i++) { const h = hash(i, 7, 3), mx = cx - 44 + (h % 88), my = by - 4 - ((h >>> 7) % 40); R(g, i % 3 ? '#4a8a3a' : '#6aaa4a', mx, my, 3 + (h % 3), 2); }
    // 줄기 속 문: 아치 · 따뜻한 빛 · 등불
    g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 13, by - 1); g.lineTo(cx - 13, by - 24); g.quadraticCurveTo(cx, by - 40, cx + 13, by - 24); g.lineTo(cx + 13, by - 1); g.closePath(); g.fill();
    g.fillStyle = '#2a1608'; g.beginPath(); g.moveTo(cx - 11, by - 1); g.lineTo(cx - 11, by - 24); g.quadraticCurveTo(cx, by - 37, cx + 11, by - 24); g.lineTo(cx + 11, by - 1); g.closePath(); g.fill();
    glowAt(g, cx, by - 14, night ? 30 : 18, 'rgba(255,200,110,A)', night ? 0.75 : 0.45);
    R(g, '#ffd890', cx - 2, by - 20, 4, 5);
    R(g, OL, cx + 17, by - 30, 1, 8); R(g, OL, cx + 14, by - 23, 7, 7); R(g, night ? '#ffe090' : '#e8c070', cx + 15, by - 22, 5, 5);
    if (night) glowAt(g, cx + 17, by - 19, 16, 'rgba(255,210,120,A)', 0.6);
    }
    // 엘프 문양 (숨 쉬듯 빛난다)
    if (DY) for (const [rx, ry, ph] of [[-16, 60, 0], [12, 96, 2], [-4, 138, 4]]) {
      const a = 0.45 + 0.35 * Math.sin(t * 1.6 + ph), x = cx + rx, y = by - ry;
      glowAt(g, x, y, 10, 'rgba(150,255,170,A)', a * 0.6);
      R(g, `rgba(190,255,200,${a})`, x - 1, y - 5, 2, 10); R(g, `rgba(190,255,200,${a})`, x - 4, y - 2, 8, 2); R(g, `rgba(190,255,200,${a})`, x - 3, y + 3, 2, 2); R(g, `rgba(190,255,200,${a})`, x + 1, y + 3, 2, 2);
    }
    if (ST) {
    // 잎: 뒤 → 앞 (미리 그려 두는 그림이라 흔들리지 않는다)
    const sw = (i, k) => (part === 'static' ? 0 : Math.sin(t * 0.7 + i * 1.3) * k);
    leafy(g, [[cx - 150, by - 232, 50], [cx + 150, by - 238, 52], [cx - 92, by - 302, 60], [cx + 96, by - 306, 58], [cx, by - 340, 62], [cx - 40, by - 252, 56], [cx + 42, by - 258, 56], [cx - 182, by - 196, 34], [cx + 186, by - 200, 34]].map(([x, y, r], i) => [x + sw(i, 1), y, r]), ['#2e6a2e', '#4a8a3a', '#5a9a46', '#1a4220'], 11);
    leafy(g, [[cx - 168, by - 204, 38], [cx + 172, by - 208, 40], [cx - 120, by - 252, 46], [cx + 126, by - 256, 46], [cx - 60, by - 292, 50], [cx + 62, by - 296, 50], [cx, by - 262, 54], [cx - 22, by - 334, 44], [cx + 30, by - 348, 40], [cx - 112, by - 322, 36], [cx + 116, by - 326, 36], [cx - 60, by - 214, 34], [cx + 66, by - 218, 34]].map(([x, y, r], i) => [x + sw(i, 1.6), y, r]), ['#4a9a40', '#7ac85a', '#a8e080', '#2a6a2c'], 23);
    // 늘어진 덩굴
    for (let i = 0; i < 11; i++) {
      const h = hash(i, 3, 9), vx = cx - 170 + (h % 340), vy = by - 196 - ((h >>> 5) % 26), len = 26 + ((h >>> 9) % 36), s2 = part === 'static' ? Math.sin(i) * 1.5 : Math.sin(t * 0.9 + i) * 2;
      g.strokeStyle = '#2e5a24'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(vx, vy); g.quadraticCurveTo(vx + s2, vy + len / 2, vx + s2 * 1.6, vy + len); g.stroke();
      for (let k = 6; k < len; k += 7) R(g, k % 14 ? '#5aa84a' : '#7ac85a', vx + s2 * (k / len) * 1.6 - 1, vy + k, 3, 2);
    }
    }
    // 열매 · 반짝이는 빛
    if (DY) for (let i = 0; i < 20; i++) {
      const h = hash(i, 4, 6), fx = cx - 170 + (h % 340), fy = by - 350 + ((h >>> 7) % 160), a = 0.5 + 0.45 * Math.sin(t * 2 + i);
      glowAt(g, fx, fy, 8, i % 3 ? 'rgba(200,255,150,A)' : 'rgba(255,230,140,A)', a * 0.6);
      R(g, i % 3 ? '#e8ffb0' : '#fff0b0', fx - 1, fy - 1, 2, 2);
    }
  },

  // ── 마탑: 세 겹 돌탑 · 보랏빛 창 · 뾰족 지붕 · 꼭대기 위에 떠 있는 별 구슬과 둘레를 맴도는 수정 ──
  mageTower(g, cx, by, W, t, night) {
    const cols = ['#8a8aa8', '#9a9ab8', '#b4b4d0', '#5a5a78'];
    shadowEllipse(g, cx, by - 4, 70, 16, 0.25);
    // 받침과 계단
    stoneWall(g, cx - 48, by - 26, 96, 26, ['#7a7a96', '#8a8aa6', '#a4a4c0', '#4e4e6a'], 7);
    for (let i = 0; i < 3; i++) { R(g, OL, cx - 16 - i * 4, by - 6 + i * 2 - 6, 32 + i * 8, 3); R(g, '#a8a8c4', cx - 15 - i * 4, by - 5 + i * 2 - 6, 30 + i * 8, 1); }
    // 받침의 룬 (돌아가며 빛난다)
    for (let i = 0; i < 6; i++) { const a = 0.35 + 0.4 * Math.max(0, Math.sin(t * 2 - i * 0.8)), x = cx - 40 + i * 16; R(g, `rgba(200,170,255,${a})`, x, by - 18, 2, 7); R(g, `rgba(200,170,255,${a})`, x - 2, by - 15, 6, 1); }
    // 탑 몸: 아래 → 위 (층마다 좁아진다)
    const tiers = [[70, 120, by - 26], [58, 104, by - 146], [46, 84, by - 250]];
    for (const [w, h, base] of tiers) {
      stoneWall(g, cx - w / 2, base - h, w, h, cols, 9);
      R(g, OL, cx - w / 2 - 5, base - h - 4, w + 10, 6); R(g, cols[2], cx - w / 2 - 4, base - h - 3, w + 8, 2); R(g, cols[3], cx - w / 2 - 4, base - h - 1, w + 8, 1); // 층 사이 처마
      for (const wy of [base - h * 0.62, base - h * 0.28]) { // 창: 아치 · 보랏빛
        const a = night ? 0.95 : 0.55 + 0.25 * Math.sin(t * 1.4 + wy);
        R(g, OL, cx - 6, wy - 2, 12, 16); g.fillStyle = OL; g.beginPath(); g.ellipse(cx, wy - 2, 6, 5, 0, Math.PI, 0); g.fill();
        g.fillStyle = `rgba(190,150,255,${a})`; g.fillRect(cx - 4, wy - 1, 8, 14); g.beginPath(); g.ellipse(cx, wy - 1, 4, 3.5, 0, Math.PI, 0); g.fill();
        R(g, OL, cx - 1, wy - 3, 2, 17); if (night) glowAt(g, cx, wy + 6, 18, 'rgba(180,140,255,A)', 0.5);
      }
    }
    // 둘째 층 발코니 난간 · 보랏빛 깃발 둘
    R(g, OL, cx - 38, by - 152, 76, 4); R(g, '#c4c4dc', cx - 37, by - 151, 74, 2);
    for (let k = -34; k <= 34; k += 6) R(g, OL, cx + k, by - 160, 2, 8);
    for (const s of [-1, 1]) {
      const fx = cx + s * 30, wv = Math.sin(t * 2.4 + s) * 2;
      R(g, OL, fx - 1, by - 236, 2, 40);
      poly(g, OL, [[fx, by - 234], [fx + s * (16 + wv), by - 230], [fx + s * (14 + wv), by - 206], [fx, by - 210]]);
      poly(g, '#5a3ab0', [[fx + s, by - 233], [fx + s * (15 + wv), by - 229], [fx + s * (13 + wv), by - 207], [fx + s, by - 211]]);
      R(g, '#ffd76a', fx + s * 6 - 1, by - 224, 3, 3);
    }
    // 문
    g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 11, by - 26); g.lineTo(cx - 11, by - 48); g.quadraticCurveTo(cx, by - 62, cx + 11, by - 48); g.lineTo(cx + 11, by - 26); g.closePath(); g.fill();
    g.fillStyle = '#3a2a58'; g.beginPath(); g.moveTo(cx - 9, by - 26); g.lineTo(cx - 9, by - 48); g.quadraticCurveTo(cx, by - 59, cx + 9, by - 48); g.lineTo(cx + 9, by - 26); g.closePath(); g.fill();
    R(g, `rgba(200,170,255,${0.6 + 0.3 * Math.sin(t * 2)})`, cx - 1, by - 50, 2, 8);
    // 뾰족 지붕
    const rt = by - 334;
    poly(g, OL, [[cx - 30, rt + 2], [cx, rt - 92], [cx + 30, rt + 2]]);
    poly(g, '#5a3aa8', [[cx - 27, rt], [cx, rt - 88], [cx + 27, rt]]);
    poly(g, '#7a5ad0', [[cx - 27, rt], [cx, rt - 88], [cx - 4, rt]]);
    for (let k = 10; k < 86; k += 10) { const ww = 27 * (1 - k / 88); R(g, 'rgba(30,16,60,0.35)', cx - ww, rt - k, ww * 2, 1); }
    R(g, OL, cx - 2, rt - 104, 4, 16); R(g, '#ffd76a', cx - 1, rt - 103, 2, 14);
    // 떠 있는 별 구슬
    const oy = rt - 128 + Math.sin(t * 1.6) * 4;
    glowAt(g, cx, oy, 40, 'rgba(190,150,255,A)', 0.55); disc(g, cx, oy, 8, OL); disc(g, cx, oy, 7, '#d8c4ff'); disc(g, cx - 2, oy - 2, 3, '#ffffff');
    // 둘레를 맴도는 수정 셋 (앞에 올 때 크게)
    for (let i = 0; i < 3; i++) {
      const a = t * 0.8 + i * 2.09, x = cx + Math.cos(a) * 40, y = by - 290 + Math.sin(a) * 10, s = 0.8 + 0.25 * Math.sin(a);
      glowAt(g, x, y, 12 * s, 'rgba(180,150,255,A)', 0.5);
      poly(g, OL, [[x, y - 8 * s], [x + 4 * s, y], [x, y + 8 * s], [x - 4 * s, y]]); poly(g, '#c8b0ff', [[x, y - 7 * s], [x + 3 * s, y], [x, y + 7 * s], [x - 3 * s, y]]); R(g, '#ffffff', x - 1, y - 4 * s, 1, 2);
    }
  },

  // ── 무너진 왕성: 성벽 · 성문탑 · 뒤의 본성 · 한쪽 탑은 무너져 담쟁이 ──
  castle(g, cx, by, W, t, night) {
    const cols = ['#9a948a', '#aaa49a', '#c4beb2', '#6a645a'], x0 = cx - W / 2;
    shadowEllipse(g, cx, by - 4, W / 2 + 20, 18, 0.25);
    // 뒤의 본성 (높다)
    stoneWall(g, cx - 46, by - 196, 92, 150, ['#8e887e', '#9e988e', '#b8b2a6', '#5e584e'], 10);
    for (let i = 0; i < 7; i++) R(g, OL, cx - 46 + i * 14, by - 204, 9, 9);
    for (const wx of [cx - 30, cx - 4, cx + 22]) { R(g, OL, wx - 1, by - 170, 10, 18); R(g, night ? '#ffd27a' : '#3a3a44', wx, by - 169, 8, 16); R(g, OL, wx + 3, by - 169, 2, 16); }
    R(g, OL, cx - 1, by - 250, 2, 48); const fl = Math.sin(t * 3) * 3;
    poly(g, OL, [[cx + 1, by - 249], [cx + 30 + fl, by - 243], [cx + 22, by - 236], [cx + 30 + fl, by - 228], [cx + 1, by - 230]]);
    poly(g, '#2a4a9a', [[cx + 2, by - 248], [cx + 28 + fl, by - 243], [cx + 20, by - 236], [cx + 28 + fl, by - 229], [cx + 2, by - 231]]);
    R(g, '#ffd76a', cx + 9, by - 242, 4, 4);
    // 성벽
    stoneWall(g, x0, by - 70, W, 70, cols, 9);
    for (let i = 0; i < W; i += 12) if (hash(i, 1, 4) % 5) { R(g, OL, x0 + i, by - 78, 8, 9); R(g, cols[1], x0 + i + 1, by - 77, 6, 8); }
    for (let i = 0; i < 26; i++) { const h = hash(i, 8, 3); R(g, '#5c8a3a', x0 + (h % W), by - 70 + ((h >>> 5) % 50), 3, 2 + (h % 4)); } // 담쟁이
    // 왼쪽 탑 (둥근 지붕) · 오른쪽 탑 (무너짐)
    stoneWall(g, x0 - 12, by - 150, 46, 150, cols, 9);
    poly(g, OL, [[x0 - 16, by - 148], [x0 + 11, by - 196], [x0 + 38, by - 148]]); poly(g, '#3a5a9a', [[x0 - 13, by - 149], [x0 + 11, by - 192], [x0 + 35, by - 149]]); poly(g, '#5a7aba', [[x0 - 13, by - 149], [x0 + 11, by - 192], [x0 + 6, by - 149]]);
    for (const wy of [by - 120, by - 84]) { R(g, OL, x0 + 7, wy, 8, 12); R(g, night ? '#ffd27a' : '#2a2a34', x0 + 8, wy + 1, 6, 10); }
    stoneWall(g, x0 + W - 34, by - 112, 46, 112, cols, 9);
    for (let i = 0; i < 6; i++) { const h = hash(i, 2, 5); R(g, cols[3], x0 + W - 32 + (h % 40), by - 118 + ((h >>> 4) % 6), 6 + (h % 4), 5); }
    for (let i = 0; i < 14; i++) { const h = hash(i, 5, 7); R(g, i % 2 ? '#4a7a32' : '#5c8a3a', x0 + W - 30 + (h % 38), by - 110 + ((h >>> 6) % 80), 3, 3); }
    for (let i = 0; i < 8; i++) { const h = hash(i, 9, 2); R(g, OL, x0 + W + 4 + (h % 22), by - 6 - (h >>> 5) % 6, 7, 5); R(g, cols[1], x0 + W + 5 + (h % 22), by - 5 - (h >>> 5) % 6, 5, 3); } // 무너진 돌무더기
    // 성문탑 · 성문 (쇠창살이 반쯤 올라가 있다) · 깃발 둘 · 횃불
    stoneWall(g, cx - 30, by - 104, 60, 104, ['#a29c92', '#b2aca2', '#ccc6ba', '#726c62'], 9);
    for (let i = 0; i < 5; i++) R(g, OL, cx - 30 + i * 13, by - 112, 9, 9);
    g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 18, by); g.lineTo(cx - 18, by - 34); g.quadraticCurveTo(cx, by - 54, cx + 18, by - 34); g.lineTo(cx + 18, by); g.fill();
    g.fillStyle = '#1a1612'; g.beginPath(); g.moveTo(cx - 16, by); g.lineTo(cx - 16, by - 33); g.quadraticCurveTo(cx, by - 51, cx + 16, by - 33); g.lineTo(cx + 16, by); g.fill();
    for (let i = -13; i <= 13; i += 4) R(g, '#4a3e32', cx + i, by - 44, 2, 22);
    R(g, '#4a3e32', cx - 15, by - 24, 30, 2);
    for (const s of [-1, 1]) {
      const bx = cx + s * 24, wv = Math.sin(t * 2 + s) * 1.5;
      R(g, OL, bx - 7, by - 96, 14, 3);
      poly(g, OL, [[bx - 7, by - 94], [bx + 7, by - 94], [bx + 7 + wv, by - 62], [bx, by - 68], [bx - 7 + wv, by - 62]]);
      poly(g, '#2a4a9a', [[bx - 6, by - 93], [bx + 6, by - 93], [bx + 6 + wv, by - 64], [bx, by - 70], [bx - 6 + wv, by - 64]]);
      R(g, '#ffd76a', bx - 2, by - 86, 4, 4); R(g, '#ffd76a', bx - 1, by - 80, 2, 6);
      const fx = cx + s * 22, ff = Math.sin(t * 12 + s) * 1.2;
      R(g, OL, fx - 1, by - 30, 3, 12); glowAt(g, fx, by - 34, night ? 22 : 12, 'rgba(255,170,60,A)', 0.6); R(g, '#ff8a2a', fx - 1, by - 37 + ff, 3, 5); R(g, '#ffe080', fx, by - 35 + ff, 1, 3);
    }
  },

  // ── 황야의 투기장: 둥근 벽 · 나무 말뚝 · 뼈 장식 · 입구 위의 거대한 엄니 둘 · 화로 ──
  arena(g, cx, by, W, t, night) {
    const rx = W / 2 + 6, ry = 58, cy = by - 52;
    shadowEllipse(g, cx, by - 8, rx + 10, 20, 0.25);
    // 안쪽 (뒤 벽 · 계단식 자리 · 모래 바닥)
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, cy, rx + 2, ry + 2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a5a32'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 3; k++) { g.strokeStyle = k % 2 ? '#a06a3e' : '#6a4426'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy - 2, rx - 10 - k * 7, ry - 10 - k * 6, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
    g.fillStyle = '#d0a46a'; g.beginPath(); g.ellipse(cx, cy + 10, rx - 34, ry - 30, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c0945a'; for (let i = 0; i < 9; i++) { const h = hash(i, 4, 2); g.beginPath(); g.ellipse(cx - 60 + (h % 120), cy + 4 + ((h >>> 6) % 18), 4 + (h % 4), 2, 0, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 3; i++) { const h = hash(i, 6, 8); g.fillStyle = 'rgba(120,30,20,0.4)'; g.beginPath(); g.ellipse(cx - 40 + (h % 80), cy + 8 + ((h >>> 5) % 12), 6, 2, 0, 0, Math.PI * 2); g.fill(); }
    // 앞 벽 (보이는 면)
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, cy, rx + 2, ry + 2, 0, 0, Math.PI); g.lineTo(cx - rx - 2, cy); g.fill();
    g.fillStyle = '#9a6a3e'; g.beginPath(); g.moveTo(cx - rx, cy); g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); g.lineTo(cx + rx, cy); g.ellipse(cx, cy + 4, rx, ry - 4, 0, 0, Math.PI); g.closePath(); g.fill();
    for (let i = 0; i < 26; i++) { // 말뚝 울타리 (앞쪽 반원)
      const a = Math.PI * (0.03 + (i / 25) * 0.94), px = cx + Math.cos(a) * (rx - 2), py = cy + Math.sin(a) * (ry - 2);
      R(g, OL, px - 3, py - 22, 6, 23); R(g, '#7a4a28', px - 2, py - 21, 4, 21); R(g, '#a06a3e', px - 2, py - 21, 1, 21);
      poly(g, '#e8dcc0', [[px - 2, py - 21], [px, py - 27], [px + 2, py - 21]]);
      if (i % 5 === 2) { disc(g, px, py - 12, 4, OL); disc(g, px, py - 12, 3, '#e8e0cc'); R(g, OL, px - 2, py - 13, 1, 1); R(g, OL, px + 1, py - 13, 1, 1); } // 해골 장식
    }
    // 입구 · 엄니 아치
    g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 16, by); g.lineTo(cx - 16, by - 24); g.quadraticCurveTo(cx, by - 38, cx + 16, by - 24); g.lineTo(cx + 16, by); g.fill();
    g.fillStyle = '#1e120a'; g.beginPath(); g.moveTo(cx - 14, by); g.lineTo(cx - 14, by - 23); g.quadraticCurveTo(cx, by - 35, cx + 14, by - 23); g.lineTo(cx + 14, by); g.fill();
    for (const s of [-1, 1]) {
      limb(g, cx + s * 30, by - 4, cx + s * 6, by - 92, s * 0.32, 14, 3, '#f0e6cc');
      limb(g, cx + s * 29, by - 6, cx + s * 8, by - 86, s * 0.32, 4, 1, '#ffffff', null);
      // 붉은 깃발 (엄니 곰)
      const fx = cx + s * 64, wv = Math.sin(t * 2.6 + s) * 2;
      R(g, OL, fx - 1, by - 112, 3, 60);
      poly(g, OL, [[fx, by - 110], [fx + s * (20 + wv), by - 106], [fx + s * (17 + wv), by - 80], [fx, by - 84]]);
      poly(g, '#a8261a', [[fx + s, by - 109], [fx + s * (19 + wv), by - 105], [fx + s * (16 + wv), by - 81], [fx + s, by - 85]]);
      poly(g, '#f0e6cc', [[fx + s * 6, by - 102], [fx + s * 11, by - 92], [fx + s * 8, by - 92]]);
      // 화로
      const hx = cx + s * 26, ff = Math.sin(t * 10 + s * 2);
      R(g, OL, hx - 6, by - 14, 12, 10); R(g, '#4a3a2e', hx - 5, by - 13, 10, 8);
      glowAt(g, hx, by - 20, night ? 30 : 16, 'rgba(255,140,40,A)', 0.6);
      poly(g, '#ff7a1a', [[hx - 5, by - 14], [hx, by - 28 - ff * 2], [hx + 5, by - 14]]); poly(g, '#ffd040', [[hx - 2, by - 14], [hx, by - 22 - ff], [hx + 2, by - 14]]);
    }
  },

  // ── 납골당: 뾰족 아치 문 · 보랏빛 둥근 창 · 높은 첨탑과 영혼 등불 · 괴물 석상 ──
  mausoleum(g, cx, by, W, t, night) {
    const cols = ['#6e687c', '#7e788c', '#9a94aa', '#46405a'];
    shadowEllipse(g, cx, by - 4, W / 2 + 14, 14, 0.3);
    // 첨탑
    stoneWall(g, cx - 14, by - 176, 28, 110, cols, 8);
    poly(g, OL, [[cx - 18, by - 174], [cx, by - 214], [cx + 18, by - 174]]); poly(g, '#3a2e4a', [[cx - 15, by - 175], [cx, by - 210], [cx + 15, by - 175]]); poly(g, '#54466a', [[cx - 15, by - 175], [cx, by - 210], [cx - 3, by - 175]]);
    const ly = by - 150, la = 0.6 + 0.3 * Math.sin(t * 2.2);
    R(g, OL, cx - 6, ly - 10, 12, 16); glowAt(g, cx, ly - 2, 22, 'rgba(200,120,255,A)', la * 0.8); R(g, `rgba(220,170,255,${la})`, cx - 4, ly - 8, 8, 12); R(g, OL, cx - 1, ly - 8, 2, 12);
    // 본당
    stoneWall(g, cx - W / 2 + 6, by - 72, W - 12, 72, cols, 8);
    poly(g, OL, [[cx - W / 2, by - 70], [cx, by - 108], [cx + W / 2, by - 70]]); poly(g, '#4a3e5c', [[cx - W / 2 + 3, by - 71], [cx, by - 105], [cx + W / 2 - 3, by - 71]]); poly(g, '#5e5072', [[cx - W / 2 + 3, by - 71], [cx, by - 105], [cx - 4, by - 71]]);
    for (const px of [cx - W / 2 + 8, cx - W / 2 + 26, cx + W / 2 - 34, cx + W / 2 - 16]) stoneWall(g, px, by - 76, 8, 76, ['#8a8496', '#9a94a6', '#b8b2c4', '#5a546a'], 76);
    // 둥근 창 (보랏빛 스테인드글라스)
    const wa = night ? 0.95 : 0.65 + 0.2 * Math.sin(t * 1.3);
    disc(g, cx, by - 86, 11, OL); disc(g, cx, by - 86, 9, `rgba(170,90,230,${wa})`);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, by - 86); g.lineTo(cx + Math.cos(a) * 9, by - 86 + Math.sin(a) * 9); g.stroke(); }
    disc(g, cx, by - 86, 2, '#ffe8ff'); if (night) glowAt(g, cx, by - 86, 22, 'rgba(190,110,255,A)', 0.5);
    // 뾰족 아치 문
    poly(g, OL, [[cx - 13, by], [cx - 13, by - 30], [cx, by - 48], [cx + 13, by - 30], [cx + 13, by]]);
    poly(g, '#140e1c', [[cx - 11, by], [cx - 11, by - 29], [cx, by - 45], [cx + 11, by - 29], [cx + 11, by]]);
    glowAt(g, cx, by - 16, 18, 'rgba(180,100,255,A)', 0.4 + 0.2 * Math.sin(t * 3));
    // 괴물 석상 (양쪽 지붕 끝)
    for (const s of [-1, 1]) {
      const gx = cx + s * (W / 2 - 4), gy = by - 74;
      R(g, OL, gx - 6, gy - 12, 12, 12); R(g, '#5a546a', gx - 5, gy - 11, 10, 10);
      poly(g, OL, [[gx - 6, gy - 11], [gx - 9 * s - 2, gy - 18], [gx, gy - 12]]); R(g, '#ff60ff', gx + s * 2 - 1, gy - 8, 2, 2);
      // 보랏빛 화로
      const fx = cx + s * (W / 2 + 6), ff = Math.sin(t * 9 + s) * 1.5;
      R(g, OL, fx - 4, by - 16, 8, 16); R(g, '#3a3444', fx - 3, by - 15, 6, 14);
      glowAt(g, fx, by - 22, 14, 'rgba(200,120,255,A)', 0.6); R(g, '#d8a8ff', fx - 1, by - 25 + ff, 3, 7); R(g, '#ffffff', fx, by - 22 + ff, 1, 3);
    }
  },

  // ── 그림자 길드: 기울어진 삼층 집 · 보랏빛 등 · 그림자 눈 깃발 · 빨랫줄의 검은 천 ──
  guildHouse(g, cx, by, W, t, night) {
    const cols = ['#4e4e5a', '#5e5e6a', '#7a7a88', '#30303a'];
    shadowEllipse(g, cx, by - 4, W / 2 + 16, 14, 0.3);
    // 무너진 담 (양옆)
    for (const s of [-1, 1]) { const wx = cx + s * (W / 2 + 4) - (s < 0 ? 22 : 0); stoneWall(g, wx, by - 26, 22, 26, cols, 7); for (let i = 0; i < 3; i++) R(g, OL, wx + i * 8, by - 30 - (hash(i, s + 3, 1) % 6), 6, 5); }
    // 집 (위층일수록 살짝 기운다)
    const floors = [[W - 8, 52, 0], [W - 18, 46, 3], [W - 30, 40, 7]];
    let base = by;
    for (const [w, h, lean] of floors) {
      const x = cx - w / 2 + lean;
      R(g, OL, x - 1, base - h - 1, w + 2, h + 2); R(g, '#3e3a46', x, base - h, w, h);
      for (let k = 0; k < w; k += 6) R(g, k % 12 ? '#36323e' : '#46424e', x + k, base - h, Math.min(6, w - k), h); // 널빤지
      R(g, '#24202a', x, base - h, w, 3); R(g, '#24202a', x, base - 3, w, 3);
      for (const wx of [x + 8, x + w - 20]) { // 창 (안에서 희미한 보랏빛)
        const a = night ? 0.85 : 0.35;
        R(g, OL, wx - 1, base - h + 11, 14, 14); R(g, `rgba(150,110,230,${a})`, wx, base - h + 12, 12, 12); R(g, OL, wx + 5, base - h + 12, 2, 12); R(g, OL, wx, base - h + 17, 12, 2);
      }
      base -= h;
    }
    // 지붕 (한쪽이 꺼졌다)
    const rx = cx + 7;
    poly(g, OL, [[rx - W / 2 + 6, base + 2], [rx - 6, base - 40], [rx + 8, base - 30], [rx + W / 2 - 8, base + 2]]);
    poly(g, '#2a2632', [[rx - W / 2 + 9, base], [rx - 6, base - 37], [rx + 8, base - 27], [rx + W / 2 - 11, base]]);
    poly(g, '#3e3a48', [[rx - W / 2 + 9, base], [rx - 6, base - 37], [rx - 10, base]]);
    R(g, OL, rx + 14, base - 22, 8, 22); R(g, '#4a4652', rx + 15, base - 21, 6, 20); // 굴뚝
    // 그림자 눈 깃발 (문 위)
    const fy = by - 50, wv = Math.sin(t * 1.8) * 1.5;
    R(g, OL, cx - 14, fy - 2, 28, 3);
    poly(g, OL, [[cx - 13, fy], [cx + 13, fy], [cx + 13 + wv, fy + 30], [cx, fy + 24], [cx - 13 + wv, fy + 30]]);
    poly(g, '#2a1e3e', [[cx - 12, fy + 1], [cx + 12, fy + 1], [cx + 12 + wv, fy + 28], [cx, fy + 22], [cx - 12 + wv, fy + 28]]);
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, fy + 11, 7, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(150,110,255,${0.6 + 0.3 * Math.sin(t * 2)})`; g.beginPath(); g.ellipse(cx, fy + 11, 5, 2.6, 0, 0, Math.PI * 2); g.fill(); R(g, '#140e20', cx - 1, fy + 10, 2, 2);
    // 문
    R(g, OL, cx - 9, by - 26, 18, 26); R(g, '#100c16', cx - 8, by - 25, 16, 25);
    // 매달린 보랏빛 등 · 빨랫줄
    for (const s of [-1, 1]) {
      const lx = cx + s * 22, sw = Math.sin(t * 1.5 + s) * 1.2;
      R(g, OL, lx, by - 44, 1, 8); R(g, OL, lx - 3 + sw, by - 37, 7, 8); R(g, '#a888ff', lx - 2 + sw, by - 36, 5, 6);
      glowAt(g, lx + sw, by - 33, night ? 20 : 10, 'rgba(160,120,255,A)', 0.6);
    }
    g.strokeStyle = '#2a2430'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - W / 2 + 4, by - 98); g.quadraticCurveTo(cx - 10, by - 90, cx - W / 2 - 22, by - 34); g.stroke();
    for (let i = 0; i < 4; i++) { const px = cx - W / 2 - 2 - i * 5, py = by - 88 + i * 12, sw = Math.sin(t * 2 + i) * 1.5; R(g, OL, px - 3 + sw, py, 7, 9); R(g, i % 2 ? '#3a2e4a' : '#1e1a26', px - 2 + sw, py + 1, 5, 7); }
  },

  // ── 거대 둥지: 통나무를 엮은 둥지 · 커다란 알 셋 · 뒤를 감싼 거대한 갈비뼈 · 머리뼈 ──
  nest(g, cx, by, W, t, night) {
    shadowEllipse(g, cx, by - 6, W / 2 + 24, 18, 0.25);
    // 뒤의 갈비뼈 (둥지를 감싼다)
    for (let i = 0; i < 6; i++) {
      const x = cx - 50 + i * 20, h = 70 + Math.sin(i * 0.9) * 14;
      limb(g, x, by - 34, x + 26, by - 34 - h, 0.25, 9, 3, '#e8dcc0');
      limb(g, x + 1, by - 36, x + 24, by - 32 - h, 0.25, 3, 1, '#fff8e8', null);
    }
    limb(g, cx - 60, by - 100, cx + 70, by - 112, -0.04, 10, 8, '#d8ccb0'); // 등뼈
    for (let i = 0; i < 8; i++) { disc(g, cx - 54 + i * 17, by - 103 - i * 1.5, 5, OL); disc(g, cx - 54 + i * 17, by - 103 - i * 1.5, 4, '#e8dcc0'); }
    // 머리뼈 (왼쪽)
    const sx = cx - W / 2 - 14, sy = by - 30;
    poly(g, OL, [[sx - 22, sy], [sx - 26, sy - 22], [sx - 6, sy - 40], [sx + 22, sy - 34], [sx + 26, sy - 14], [sx + 10, sy]]);
    poly(g, '#e8dcc0', [[sx - 20, sy - 2], [sx - 23, sy - 21], [sx - 5, sy - 37], [sx + 20, sy - 32], [sx + 23, sy - 14], [sx + 9, sy - 2]]);
    disc(g, sx + 6, sy - 24, 5, OL); disc(g, sx - 8, sy - 16, 3, OL);
    for (let i = 0; i < 5; i++) poly(g, '#fff8e8', [[sx - 18 + i * 6, sy - 4], [sx - 16 + i * 6, sy + 4], [sx - 14 + i * 6, sy - 4]]);
    // 둥지 (통나무)
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 22, W / 2 + 4, 26, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a5a32'; g.beginPath(); g.ellipse(cx, by - 22, W / 2 + 2, 24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4e3820'; g.beginPath(); g.ellipse(cx, by - 30, W / 2 - 18, 12, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 30; i++) {
      const a = (hash(i, 6, 2) / 4294967296) * Math.PI * 2, r = W / 2 - 4 - (i % 3) * 5;
      const x1 = cx + Math.cos(a) * r, y1 = by - 22 + Math.sin(a) * 20, x2 = cx + Math.cos(a + 0.45) * r, y2 = by - 22 + Math.sin(a + 0.45) * 20;
      g.strokeStyle = OL; g.lineWidth = 4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = i % 2 ? '#a8844a' : '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    // 알 셋 (얼룩무늬)
    for (const [ex, sc, c, sp] of [[-26, 1, '#e8e0c8', '#9aa880'], [2, 1.3, '#d8e8c0', '#7a9a5a'], [30, 0.95, '#e8d0c0', '#a8806a']]) {
      const ey = by - 40 - sc * 4, rw = 12 * sc, rh = 15 * sc, wob = Math.sin(t * 3 + ex) * (sc > 1.2 ? 0.8 : 0);
      g.fillStyle = OL; g.beginPath(); g.ellipse(cx + ex + wob, ey, rw + 1, rh + 1, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = c; g.beginPath(); g.ellipse(cx + ex + wob, ey, rw, rh, 0, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 6; k++) { const h = hash(k, ex + 40, 3); R(g, sp, cx + ex + wob - rw * 0.6 + (h % (rw * 1.2)), ey - rh * 0.6 + ((h >>> 5) % (rh * 1.2)), 2 + (h % 2), 2); }
      R(g, '#ffffff', cx + ex + wob - rw * 0.45, ey - rh * 0.6, 3, 4);
    }
    // 깃털 토템 둘
    for (const s of [-1, 1]) {
      const px = cx + s * (W / 2 + 10);
      R(g, OL, px - 2, by - 60, 5, 60); R(g, '#8a5a32', px - 1, by - 59, 3, 58);
      for (let k = 0; k < 3; k++) { const fy = by - 56 + k * 9, wv = Math.sin(t * 2 + k + s) * 1.5; poly(g, OL, [[px, fy], [px + s * (12 + wv), fy - 3], [px + s * 4, fy + 5]]); poly(g, ['#e8503a', '#ffd040', '#3aa0e0'][k], [[px + s, fy], [px + s * (11 + wv), fy - 2], [px + s * 4, fy + 4]]); }
    }
  },

  // ── 용의 둥지: 검은 바위 기둥 · 눈이 빛나는 거대한 용 머리뼈 아치 · 용암 웅덩이 · 달아오른 알 ──
  dragonNest(g, cx, by, W, t, night) {
    shadowEllipse(g, cx, by - 6, W / 2 + 20, 16, 0.3);
    // 뒤의 바위 기둥들
    for (const [ox, h, w] of [[-W / 2 + 6, 120, 22], [-W / 2 + 30, 160, 26], [W / 2 - 52, 150, 26], [W / 2 - 24, 110, 22], [-W / 2 - 12, 80, 18], [W / 2 + 2, 86, 18]]) {
      const x = cx + ox;
      poly(g, OL, [[x - 1, by - 20], [x + 2, by - h], [x + w * 0.6, by - h - 10], [x + w + 1, by - h + 6], [x + w + 1, by - 20]]);
      poly(g, '#3a3034', [[x, by - 20], [x + 3, by - h + 1], [x + w * 0.6, by - h - 8], [x + w, by - h + 7], [x + w, by - 20]]);
      poly(g, '#54464a', [[x, by - 20], [x + 3, by - h + 1], [x + w * 0.35, by - h - 4], [x + w * 0.3, by - 20]]);
      for (let k = 0; k < 4; k++) { const h2 = hash(k, ox + 90, 4); R(g, `rgba(255,${90 + (h2 % 60)},30,${0.35 + 0.25 * Math.sin(t * 2 + k)})`, x + 4 + (h2 % (w - 6)), by - 30 - ((h2 >>> 5) % (h - 30)), 1, 4 + (h2 % 6)); } // 용암 실금
    }
    // 거대한 용 머리뼈 (아치)
    const sx = cx, sy = by - 64;
    for (const s of [-1, 1]) { // 뿔
      limb(g, sx + s * 30, sy - 40, sx + s * 74, sy - 96, -s * 0.28, 16, 3, '#e8dcc0');
      limb(g, sx + s * 31, sy - 42, sx + s * 70, sy - 92, -s * 0.28, 5, 1, '#fff8e8', null);
    }
    poly(g, OL, [[sx - 52, sy + 10], [sx - 56, sy - 30], [sx - 28, sy - 62], [sx + 28, sy - 62], [sx + 56, sy - 30], [sx + 52, sy + 10], [sx + 30, sy + 40], [sx - 30, sy + 40]]);
    poly(g, '#e0d4b8', [[sx - 49, sy + 8], [sx - 53, sy - 29], [sx - 26, sy - 59], [sx + 26, sy - 59], [sx + 53, sy - 29], [sx + 49, sy + 8], [sx + 28, sy + 37], [sx - 28, sy + 37]]);
    poly(g, '#c8bca0', [[sx + 20, sy - 59], [sx + 53, sy - 29], [sx + 49, sy + 8], [sx + 28, sy + 37], [sx + 18, sy + 37]]);
    // 눈구멍 (불빛)
    for (const s of [-1, 1]) {
      const ex = sx + s * 24, ey = sy - 26, a = 0.6 + 0.35 * Math.sin(t * 2.3 + s);
      g.fillStyle = OL; g.beginPath(); g.ellipse(ex, ey, 11, 8, s * 0.3, 0, Math.PI * 2); g.fill();
      glowAt(g, ex, ey, 20, 'rgba(255,120,30,A)', a * 0.8); g.fillStyle = `rgba(255,170,60,${a})`; g.beginPath(); g.ellipse(ex, ey, 5, 3.5, s * 0.3, 0, Math.PI * 2); g.fill();
    }
    // 입 (아치 문): 이빨 사이로 둥지 안이 붉게
    g.fillStyle = OL; g.beginPath(); g.moveTo(sx - 30, by); g.lineTo(sx - 30, sy + 8); g.quadraticCurveTo(sx, sy - 16, sx + 30, sy + 8); g.lineTo(sx + 30, by); g.fill();
    g.fillStyle = '#2a0e08'; g.beginPath(); g.moveTo(sx - 27, by); g.lineTo(sx - 27, sy + 9); g.quadraticCurveTo(sx, sy - 12, sx + 27, sy + 9); g.lineTo(sx + 27, by); g.fill();
    glowAt(g, sx, by - 16, 34, 'rgba(255,110,30,A)', 0.55 + 0.2 * Math.sin(t * 2.5));
    for (let i = 0; i < 6; i++) { const tx = sx - 25 + i * 10; poly(g, '#f0e6cc', [[tx, sy + 6 - Math.abs(i - 2.5) * 3], [tx + 3, sy + 18 - Math.abs(i - 2.5) * 2], [tx + 6, sy + 6 - Math.abs(i - 2.5) * 3]]); }
    // 용암 웅덩이 · 달아오른 알
    g.fillStyle = OL; g.beginPath(); g.ellipse(sx, by - 8, 26, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c83a10'; g.beginPath(); g.ellipse(sx, by - 8, 24, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff8a2a'; g.beginPath(); g.ellipse(sx - 4 + Math.sin(t) * 2, by - 9, 14, 3, 0, 0, Math.PI * 2); g.fill();
    for (const [ex, c] of [[-14, '#ff8a3a'], [0, '#ffb04a'], [14, '#e8603a']]) { disc(g, sx + ex, by - 16, 7, OL); disc(g, sx + ex, by - 16, 6, c); R(g, '#ffe8a0', sx + ex - 2, by - 20, 2, 2); }
    // 붉은 깃발 (사슬에 매단)
    for (const s of [-1, 1]) {
      const fx = cx + s * (W / 2 - 10), wv = Math.sin(t * 2.2 + s) * 2;
      R(g, OL, fx - 1, by - 150, 3, 4);
      for (let k = 0; k < 6; k++) R(g, '#5a5054', fx - 1 + (k % 2), by - 146 + k * 4, 2, 3);
      poly(g, OL, [[fx - 9, by - 122], [fx + 9, by - 122], [fx + 9 + wv, by - 88], [fx, by - 96], [fx - 9 + wv, by - 88]]);
      poly(g, '#a8200e', [[fx - 8, by - 121], [fx + 8, by - 121], [fx + 8 + wv, by - 90], [fx, by - 98], [fx - 8 + wv, by - 90]]);
      poly(g, '#ffb040', [[fx, by - 116], [fx + 4, by - 106], [fx, by - 101], [fx - 4, by - 106]]);
    }
  },
};

// 성지 마을의 작은 것들: 과녁 · 룬석 · 모루 · 북 · 무덤 · 칼 과녁판 · 알 둥지 · 화로 · 꽃밭 · 깃대 · 등 · 수련장 말뚝 …
import { TILE } from '../sim/mapgen.js';
import { hash } from './tiles.js';

const OL = '#1a1410';
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const disc = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); };
const sh = (g, cx, cy, rx, ry, a = 0.25) => { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
const glowAt = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
const poly = (g, col, pts) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };

// 과녁 맞은 흔들림: 렌더러가 pr.hitT 를 올려 준다
export function drawVillageProp(g, pr, t, night) {
  const f = VP[pr.kind];
  if (!f) return false;
  const cx = pr.x * TILE + (pr.w * TILE) / 2, by = (pr.y + pr.h) * TILE;
  f(g, Math.round(cx), Math.round(by), t, night, pr);
  return true;
}
export const VILLAGE_PROPS = new Set(['archTarget', 'runeCrystal', 'lectern', 'telescope', 'anvil', 'warDrum', 'grave', 'candles', 'knifeBoard', 'crates', 'eggClutch', 'brazier', 'flowerBed', 'bannerPole', 'hayBale', 'bonePile', 'fernBig', 'crystalShard', 'lamp', 'stake']);

const VP = {
  archTarget(g, cx, by, t, night, pr) { // 짚 과녁: 다리 셋 · 둥근 표적 (맞으면 흔들린다)
    const wob = (pr.hitT > 0 ? Math.sin(pr.hitT * 40) * pr.hitT * 3 : 0);
    sh(g, cx, by - 2, 9, 3);
    R(g, OL, cx - 8, by - 14, 3, 13); R(g, OL, cx + 5, by - 14, 3, 13); R(g, '#8a5a32', cx - 7, by - 13, 1, 12); R(g, '#8a5a32', cx + 6, by - 13, 1, 12);
    R(g, OL, cx - 1, by - 12, 3, 11);
    const ty = by - 22;
    g.save(); g.translate(cx, ty); g.rotate(wob * 0.05);
    disc(g, 0, 0, 11, OL); disc(g, 0, 0, 10, '#e8d8a0'); disc(g, 0, 0, 7.5, '#d84a3a'); disc(g, 0, 0, 5, '#f4ecd8'); disc(g, 0, 0, 2.6, '#d84a3a');
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; R(g, '#c8b880', Math.cos(a) * 9 - 0.5, Math.sin(a) * 9 - 0.5, 1, 1); }
    for (const [ax, ay] of (pr.arrows || []).slice(-4)) { R(g, OL, ax - 1, ay - 1, 2, 2); R(g, '#7a5a3a', ax, ay - 4, 1, 4); R(g, '#f0f0f0', ax - 1, ay - 6, 3, 2); } // 꽂힌 화살
    g.restore();
  },
  runeCrystal(g, cx, by, t, night, pr) { // 수련용 룬석: 받침돌 위에 떠서 돈다 (맞으면 번쩍)
    const fl = pr.hitT > 0 ? pr.hitT : 0, oy = by - 22 + Math.sin(t * 2 + cx) * 2;
    sh(g, cx, by - 2, 8, 3);
    R(g, OL, cx - 7, by - 8, 14, 7); R(g, '#7a7a96', cx - 6, by - 7, 12, 5); R(g, '#a4a4c0', cx - 6, by - 7, 12, 1);
    glowAt(g, cx, oy, 14 + fl * 10, 'rgba(180,150,255,A)', 0.45 + fl * 0.5);
    poly(g, OL, [[cx, oy - 11], [cx + 6, oy], [cx, oy + 9], [cx - 6, oy]]); poly(g, '#a888ff', [[cx, oy - 10], [cx + 5, oy], [cx, oy + 8], [cx - 5, oy]]); poly(g, '#d8c8ff', [[cx, oy - 10], [cx - 5, oy], [cx, oy - 2]]);
    R(g, fl > 0.1 ? '#ffffff' : '#e8e0ff', cx - 1, oy - 3, 2, 4);
  },
  lectern(g, cx, by, t, night) { // 책 받침대 · 펼친 책
    sh(g, cx, by - 2, 7, 2);
    R(g, OL, cx - 2, by - 16, 4, 15); R(g, '#6a4a2a', cx - 1, by - 15, 2, 14); R(g, OL, cx - 6, by - 3, 12, 3);
    poly(g, OL, [[cx - 9, by - 18], [cx + 9, by - 18], [cx + 7, by - 24], [cx - 7, by - 24]]);
    R(g, '#f4ecd8', cx - 7, by - 23, 6, 4); R(g, '#e8dcc0', cx + 1, by - 23, 6, 4); R(g, '#8a7a5a', cx - 6, by - 22, 4, 1); R(g, '#8a7a5a', cx + 2, by - 22, 4, 1);
    if (night) glowAt(g, cx, by - 22, 12, 'rgba(200,170,255,A)', 0.35);
  },
  telescope(g, cx, by, t) { // 별을 보는 망원경 (삼각대)
    sh(g, cx, by - 2, 8, 3);
    for (const dx of [-6, 0, 6]) { g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, by - 14); g.lineTo(cx + dx, by - 1); g.stroke(); }
    g.save(); g.translate(cx, by - 15); g.rotate(-0.7 + Math.sin(t * 0.3) * 0.05);
    R(g, OL, -2, -4, 22, 7); R(g, '#c8a040', -1, -3, 20, 5); R(g, '#e8c060', -1, -3, 20, 1); R(g, OL, 18, -5, 4, 9); R(g, '#8ac8e8', 19, -4, 2, 7);
    g.restore();
  },
  anvil(g, cx, by, t, night, pr) { // 모루 · 받침 통나무 (두드리면 불꽃은 렌더러가)
    sh(g, cx, by - 2, 10, 3);
    R(g, OL, cx - 6, by - 10, 12, 10); R(g, '#7a5432', cx - 5, by - 9, 10, 8); R(g, '#9a6a3e', cx - 5, by - 9, 10, 2);
    R(g, OL, cx - 10, by - 16, 20, 6); R(g, '#5a5a66', cx - 9, by - 15, 18, 4); R(g, '#8a8a98', cx - 9, by - 15, 18, 1);
    poly(g, OL, [[cx + 9, by - 16], [cx + 15, by - 14], [cx + 9, by - 11]]); R(g, OL, cx - 3, by - 11, 6, 2);
    if (pr.hitT > 0) glowAt(g, cx, by - 16, 12, 'rgba(255,200,100,A)', pr.hitT * 2);
  },
  warDrum(g, cx, by, t, night, pr) { // 가죽 큰북 (맞을 때 가죽이 떨린다)
    const q = pr.hitT > 0 ? pr.hitT * 2 : 0;
    sh(g, cx, by - 2, 12, 3);
    R(g, OL, cx - 11, by - 22, 22, 21); R(g, '#8a3a22', cx - 10, by - 21, 20, 19); R(g, '#a84a2a', cx - 10, by - 21, 4, 19);
    for (let k = -8; k <= 8; k += 4) { g.strokeStyle = '#e8dcc0'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + k, by - 21); g.lineTo(cx + k + 2, by - 3); g.stroke(); }
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 22, 12, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8d0a0'; g.beginPath(); g.ellipse(cx, by - 22 + q, 10.5, 3 - q * 0.5, 0, 0, Math.PI * 2); g.fill();
    R(g, '#f0e6cc', cx - 2, by - 24, 4, 1);
  },
  grave(g, cx, by, t, night, pr) { // 비석 (모양 셋)
    const v = (pr.v || 0) % 3;
    sh(g, cx, by - 1, 7, 2);
    if (v === 0) { R(g, OL, cx - 6, by - 18, 12, 17); R(g, '#7a7486', cx - 5, by - 17, 10, 16); g.fillStyle = OL; g.beginPath(); g.arc(cx, by - 17, 6, Math.PI, 0); g.fill(); g.fillStyle = '#7a7486'; g.beginPath(); g.arc(cx, by - 17, 5, Math.PI, 0); g.fill(); R(g, '#9a94a8', cx - 5, by - 17, 2, 16); R(g, '#4a4458', cx - 2, by - 14, 4, 1); R(g, '#4a4458', cx - 2, by - 11, 4, 1); }
    else if (v === 1) { R(g, OL, cx - 2, by - 22, 5, 21); R(g, OL, cx - 7, by - 17, 15, 5); R(g, '#8a8496', cx - 1, by - 21, 3, 19); R(g, '#8a8496', cx - 6, by - 16, 13, 3); }
    else { R(g, OL, cx - 7, by - 10, 14, 9); R(g, '#6a6478', cx - 6, by - 9, 12, 7); R(g, '#8a8496', cx - 6, by - 9, 12, 1); }
    R(g, '#4a6a32', cx - 7, by - 2, 4, 2); R(g, '#5a7a3a', cx + 3, by - 2, 4, 2);
  },
  candles(g, cx, by, t, night) { // 촛불 무리 (보랏빛 불꽃)
    for (const [dx, h] of [[-6, 8], [-2, 12], [3, 9], [7, 6]]) {
      R(g, OL, cx + dx - 2, by - h - 1, 4, h + 1); R(g, '#e8e0f0', cx + dx - 1, by - h, 2, h);
      const f = Math.sin(t * 9 + dx) * 0.8;
      glowAt(g, cx + dx, by - h - 3, 8, 'rgba(210,150,255,A)', night ? 0.7 : 0.45); R(g, '#e0b8ff', cx + dx - 1 + f, by - h - 5, 2, 3);
    }
  },
  knifeBoard(g, cx, by, t, night, pr) { // 칼 과녁판 (나무판에 꽂힌 칼)
    sh(g, cx, by - 2, 9, 3);
    R(g, OL, cx - 2, by - 12, 4, 11); R(g, '#5a3a22', cx - 1, by - 11, 2, 10);
    R(g, OL, cx - 10, by - 32, 20, 21); R(g, '#6a4a2e', cx - 9, by - 31, 18, 19);
    for (let k = -9; k < 9; k += 4) R(g, 'rgba(0,0,0,0.25)', cx + k, by - 31, 1, 19);
    g.strokeStyle = '#d84a3a'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, by - 22, 6, 6, 0, 0, Math.PI * 2); g.stroke();
    for (const [ax, ay] of (pr.knives || []).slice(-4)) { R(g, '#d0d8e4', cx + ax - 0.5, by - 22 + ay - 4, 1, 4); R(g, OL, cx + ax - 1, by - 22 + ay, 3, 2); }
  },
  crates(g, cx, by) { // 쌓은 상자
    sh(g, cx, by - 2, 11, 3);
    for (const [dx, dy, s] of [[-6, 0, 10], [5, 0, 9], [0, -9, 9]]) {
      const x = cx + dx - s / 2, y = by + dy - s;
      R(g, OL, x - 1, y - 1, s + 2, s + 2); R(g, '#8a6038', x, y, s, s); R(g, '#a87a48', x, y, s, 2); R(g, '#5a3a22', x, y + s / 2 - 1, s, 2); R(g, '#5a3a22', x + s / 2 - 1, y, 2, s);
    }
  },
  eggClutch(g, cx, by, t) { // 잔가지 둥지의 알 몇 개
    sh(g, cx, by - 2, 11, 3);
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 4, 12, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a6a3a'; g.beginPath(); g.ellipse(cx, by - 4, 11, 4, 0, 0, Math.PI * 2); g.fill();
    for (const [dx, c] of [[-5, '#e8e0c8'], [1, '#d8e8c0'], [6, '#e8d0c0']]) { const w = Math.sin(t * 4 + dx) * 0.4; g.fillStyle = OL; g.beginPath(); g.ellipse(cx + dx + w, by - 8, 4, 5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(cx + dx + w, by - 8, 3, 4, 0, 0, Math.PI * 2); g.fill(); R(g, '#ffffff', cx + dx + w - 1, by - 11, 1, 2); }
  },
  brazier(g, cx, by, t, night) { // 쇠 화로 (불꽃)
    sh(g, cx, by - 2, 8, 3);
    R(g, OL, cx - 1, by - 12, 3, 11); R(g, OL, cx - 6, by - 2, 12, 2);
    R(g, OL, cx - 7, by - 18, 14, 7); R(g, '#4a4046', cx - 6, by - 17, 12, 5); R(g, '#6a5e64', cx - 6, by - 17, 12, 1);
    const f = Math.sin(t * 10 + cx) * 1.5;
    glowAt(g, cx, by - 22, night ? 28 : 16, 'rgba(255,140,40,A)', 0.6);
    poly(g, '#ff6a1a', [[cx - 6, by - 18], [cx - 2, by - 28 - f], [cx + 1, by - 22], [cx + 4, by - 30 + f], [cx + 6, by - 18]]);
    poly(g, '#ffd040', [[cx - 3, by - 18], [cx, by - 24 - f], [cx + 3, by - 18]]);
  },
  flowerBed(g, cx, by, t) { // 돌 두른 꽃밭
    sh(g, cx, by - 2, 12, 3);
    g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 4, 12, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a3e22'; g.beginPath(); g.ellipse(cx, by - 4, 11, 4, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 9; i++) { const h = hash(i, cx, 3), fx = cx - 9 + (h % 18), fy = by - 4 - ((h >>> 6) % 4), sw = Math.sin(t * 2 + i) * 0.6; R(g, '#3e7a32', fx + sw, fy - 4, 1, 4); R(g, ['#ff8ab8', '#ffd040', '#9ad0ff', '#ffffff'][i % 4], fx - 1 + sw, fy - 6, 3, 2); }
  },
  bannerPole(g, cx, by, t) { // 기사단 깃대
    sh(g, cx, by - 1, 5, 2);
    R(g, OL, cx - 1, by - 44, 3, 44); R(g, '#c8c0a8', cx, by - 43, 1, 42);
    const wv = Math.sin(t * 2.4 + cx) * 2;
    poly(g, OL, [[cx + 1, by - 42], [cx + 16 + wv, by - 39], [cx + 14 + wv, by - 24], [cx + 1, by - 26]]);
    poly(g, '#2a4a9a', [[cx + 2, by - 41], [cx + 15 + wv, by - 38], [cx + 13 + wv, by - 25], [cx + 2, by - 27]]);
    R(g, '#ffd76a', cx + 6, by - 36, 3, 3);
  },
  hayBale(g, cx, by) { // 짚단
    sh(g, cx, by - 2, 10, 3);
    R(g, OL, cx - 10, by - 12, 20, 11); R(g, '#d8b860', cx - 9, by - 11, 18, 9); R(g, '#f0d880', cx - 9, by - 11, 18, 2);
    R(g, '#a88a40', cx - 4, by - 11, 2, 9); R(g, '#a88a40', cx + 3, by - 11, 2, 9);
    for (let i = 0; i < 6; i++) R(g, '#c8a850', cx - 8 + i * 3, by - 13, 1, 2);
  },
  bonePile(g, cx, by) { // 뼈 더미
    sh(g, cx, by - 2, 9, 3);
    for (const [dx, dy, a] of [[-5, -2, 0.4], [3, -3, -0.5], [0, -6, 0.1]]) { g.save(); g.translate(cx + dx, by + dy); g.rotate(a); R(g, OL, -6, -2, 12, 4); R(g, '#e8dcc0', -5, -1, 10, 2); disc(g, -5, 0, 2, '#e8dcc0'); disc(g, 5, 0, 2, '#e8dcc0'); g.restore(); }
    disc(g, cx + 6, by - 8, 4, OL); disc(g, cx + 6, by - 8, 3, '#e8e0cc'); R(g, OL, cx + 4, by - 9, 1, 1); R(g, OL, cx + 7, by - 9, 1, 1);
  },
  fernBig(g, cx, by, t) { // 큰 고사리
    sh(g, cx, by - 1, 9, 2);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42 + Math.sin(t * 1.2 + i) * 0.04, len = 15 + (i % 2) * 4, ex = cx + Math.cos(a) * len, ey = by - 2 + Math.sin(a) * len;
      g.strokeStyle = OL; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, by - 2); g.quadraticCurveTo(cx + Math.cos(a) * len * 0.5, by - 2 + Math.sin(a) * len * 0.6 - 3, ex, ey); g.stroke();
      g.strokeStyle = i % 2 ? '#4a9a3a' : '#5aaa48'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, by - 2); g.quadraticCurveTo(cx + Math.cos(a) * len * 0.5, by - 2 + Math.sin(a) * len * 0.6 - 3, ex, ey); g.stroke();
    }
  },
  crystalShard(g, cx, by, t, night) { // 땅에서 솟은 마력 수정
    sh(g, cx, by - 1, 7, 2);
    for (const [dx, h, w] of [[-4, 10, 3], [1, 15, 4], [5, 8, 3]]) {
      poly(g, OL, [[cx + dx - w - 1, by], [cx + dx, by - h - 1], [cx + dx + w + 1, by]]);
      poly(g, '#9a7ae8', [[cx + dx - w, by - 1], [cx + dx, by - h], [cx + dx + w, by - 1]]); poly(g, '#c8b0ff', [[cx + dx - w, by - 1], [cx + dx, by - h], [cx + dx, by - 1]]);
    }
    glowAt(g, cx + 1, by - 8, 12, 'rgba(180,150,255,A)', night ? 0.55 : 0.3);
  },
  lamp(g, cx, by, t, night, pr) { // 마을 등 (종족 색)
    const col = { elf: ['#e8ffb0', 'rgba(200,255,150,A)'], wizard: ['#d8c4ff', 'rgba(190,150,255,A)'], assassin: ['#b8a0ff', 'rgba(160,120,255,A)'] }[pr.race] || ['#ffe090', 'rgba(255,210,120,A)'];
    sh(g, cx, by - 1, 5, 2);
    R(g, OL, cx - 1, by - 24, 3, 24); R(g, '#5a4a3a', cx, by - 23, 1, 22); R(g, OL, cx - 5, by - 2, 11, 2);
    R(g, OL, cx - 4, by - 32, 9, 9); R(g, col[0], cx - 3, by - 31, 7, 7); R(g, OL, cx - 5, by - 34, 11, 3);
    glowAt(g, cx, by - 28, night ? 26 : 12, col[1], night ? 0.7 : 0.35);
  },
  stake(g, cx, by) { // 수련장 귀퉁이 말뚝 (밧줄 매듭)
    sh(g, cx, by - 1, 4, 2);
    R(g, OL, cx - 2, by - 16, 5, 16); R(g, '#8a5a32', cx - 1, by - 15, 3, 14); R(g, '#a87a48', cx - 1, by - 15, 1, 14);
    R(g, '#d8c890', cx - 2, by - 12, 5, 2); R(g, '#d8c890', cx - 2, by - 8, 5, 1);
  },
};

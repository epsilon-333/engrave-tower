// 집 안 그림: 바닥(나무 · 짙은 나무 · 돌 · 다다미) · 뒷벽(벽지 · 벽돌 · 판자) · 벽 장식 · 깔개 · 가구(사람과 앞뒤로 겹치게 따로 그린다)
import { PixelCtx } from './pixelctx.js';
import { TILE } from '../sim/mapgen.js';
import { hash } from './tiles.js';

const OL = '#1a1410';
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const glow = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
const FLOORS = {
  wood: { planks: ['#a2724a', '#986842', '#8e603c', '#a87a50'], seam: '#5a3a22', grain: '#7e5434' },
  darkwood: { planks: ['#5e3e2c', '#664430', '#563828', '#6c4834'], seam: '#2a1a12', grain: '#4a3020' },
  stone: { tiles: ['#7c7874', '#88847e', '#706c68', '#908c86'], grout: '#4a4642' },
  tatami: { base: '#c8b878', edge: '#4e6a3a', weave: '#b4a464' },
};
const WALLS = {
  violet: { a: '#6a5a8a', b: '#5e4e7e', trim: '#8a7aaa', wain: '#4a3428' },
  green: { a: '#5a7a5a', b: '#4e6e4e', trim: '#7a9a72', wain: '#5a3a24' },
  cream: { a: '#d8c8a8', b: '#cab896', trim: '#ece0c4', wain: '#7a5234' },
  brick: { brick: ['#8a4a3a', '#7e4234', '#94503e'], mortar: '#4a2a22', trim: '#5a3a30', wain: '#3e2a24' },
  wood: { plank: ['#8a6038', '#7e5632', '#946a40'], trim: '#a8804e', wain: '#5a3a22' },
};

// 방 전체 (가구 제외)
export function renderInterior(w, night = false) {
  const m = w.map, tw = m.tw, th = m.th, W = tw * TILE, H = th * TILE;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = new PixelCtx(c.getContext('2d')); g.imageSmoothingEnabled = false; // 방 그림도 칸 단위로 (흐릿한 가장자리 없이)
  R(g, '#0d0b10', 0, 0, W, H);
  // 바닥
  const F = FLOORS[m.floorStyle] || FLOORS.wood;
  const fx0 = TILE, fy0 = 3 * TILE, fx1 = W - TILE, fy1 = (th - 1) * TILE;
  if (F.planks) {
    for (let y = fy0; y < fy1; y += 5) {
      let x = fx0 - (hash(y, 3, 1) % 24);
      while (x < fx1) {
        const len = 18 + (hash(x, y, 2) % 22), col = F.planks[hash(x, y, 4) % F.planks.length];
        R(g, col, Math.max(fx0, x), y, Math.min(len, fx1 - Math.max(fx0, x)), 4);
        R(g, F.seam, Math.max(fx0, x), y + 4, Math.min(len, fx1 - Math.max(fx0, x)), 1);
        if (x > fx0) R(g, F.seam, x, y, 1, 4);
        for (let k = 0; k < 2; k++) { const gx = x + 3 + (hash(x, y, 9 + k) % Math.max(4, len - 6)); if (gx < fx1 - 2 && gx > fx0) R(g, F.grain, gx, y + 1 + k, 3, 1); }
        x += len;
      }
    }
  } else if (F.tiles) {
    for (let y = fy0; y < fy1; y += TILE) for (let x = fx0; x < fx1; x += TILE) {
      R(g, F.tiles[hash(x, y, 5) % F.tiles.length], x, y, TILE, TILE); R(g, F.grout, x, y + TILE - 1, TILE, 1); R(g, F.grout, x + TILE - 1, y, 1, TILE);
      R(g, 'rgba(255,255,255,0.08)', x, y, TILE - 1, 1);
      if (hash(x, y, 6) % 3 === 0) R(g, 'rgba(0,0,0,0.12)', x + 3 + hash(x, y, 7) % 8, y + 4 + hash(x, y, 8) % 7, 3, 1);
    }
  } else {
    R(g, F.base, fx0, fy0, fx1 - fx0, fy1 - fy0);
    for (let y = fy0; y < fy1; y += 2 * TILE) for (let x = fx0; x < fx1; x += TILE) {
      const horiz = ((x / TILE) + (y / TILE / 2)) % 2 === 0;
      for (let k = 2; k < (horiz ? 2 * TILE : TILE); k += 3) horiz ? R(g, F.weave, x + 1, y + k, TILE - 2, 1) : R(g, F.weave, x + k, y + 1, 1, 2 * TILE - 2);
      R(g, F.edge, x, y, horiz ? 2 : TILE, horiz ? 2 * TILE : 2); R(g, F.edge, x, y + 2 * TILE - 2, TILE, 2);
    }
  }
  // 깔개
  for (const r of m.rugs || []) {
    const x = r.x * TILE + 3, y = r.y * TILE + 3, ww = r.w * TILE - 6, hh = r.h * TILE - 6;
    R(g, 'rgba(0,0,0,0.3)', x + 2, y + 2, ww, hh); R(g, OL, x - 1, y - 1, ww + 2, hh + 2); R(g, r.c, x, y, ww, hh);
    if (r.mat) { for (let k = 6; k < ww - 4; k += 6) R(g, 'rgba(255,255,255,0.06)', x + k, y + 2, 1, hh - 4); }
    else {
      g.strokeStyle = r.trim; g.lineWidth = 1; g.strokeRect(x + 3.5, y + 3.5, ww - 7, hh - 7);
      for (let i = x + 9; i < x + ww - 8; i += 9) { R(g, r.trim, i, y + 6, 2, 2); R(g, r.trim, i, y + hh - 8, 2, 2); }
      for (let i = x - 1; i < x + ww; i += 3) { R(g, r.trim, i, y - 3, 1, 2); R(g, r.trim, i, y + hh + 1, 1, 2); } // 술
    }
  }
  // 뒷벽 (1~2줄)
  const Wd = WALLS[m.wallStyle] || WALLS.cream, wy = TILE, wh = 2 * TILE;
  if (Wd.brick) {
    R(g, Wd.mortar, TILE, wy, W - 2 * TILE, wh);
    for (let r = 0; r * 6 < wh; r++) for (let x = TILE - (r % 2) * 6; x < W - TILE; x += 12) R(g, Wd.brick[hash(x, r, 3) % 3], Math.max(TILE, x + 1), wy + r * 6 + 1, Math.min(11, W - TILE - Math.max(TILE, x + 1)), 5);
  } else if (Wd.plank) {
    for (let x = TILE; x < W - TILE; x += 6) { R(g, Wd.plank[hash(x, 1, 2) % 3], x, wy, 6, wh); R(g, 'rgba(0,0,0,0.25)', x + 5, wy, 1, wh); }
  } else {
    R(g, Wd.a, TILE, wy, W - 2 * TILE, wh);
    for (let x = TILE + 4; x < W - TILE; x += 8) R(g, Wd.b, x, wy, 3, wh - 10);
  }
  R(g, Wd.trim, TILE, wy, W - 2 * TILE, 2); R(g, 'rgba(0,0,0,0.25)', TILE, wy + 2, W - 2 * TILE, 1);
  R(g, Wd.wain, TILE, wy + wh - 10, W - 2 * TILE, 10); R(g, 'rgba(255,255,255,0.12)', TILE, wy + wh - 10, W - 2 * TILE, 1);
  for (let x = TILE + 6; x < W - TILE; x += 14) R(g, 'rgba(0,0,0,0.22)', x, wy + wh - 8, 1, 7);
  R(g, 'rgba(0,0,0,0.35)', TILE, wy + wh, W - 2 * TILE, 3); // 벽 아래 그늘
  // 벽 장식
  for (const d of m.wallDeco || []) drawWallDeco(g, d, m, night);
  // 벽 윗면 · 옆벽 · 아래벽
  const cap = '#3a2e2a', capHi = '#5a4a40';
  R(g, cap, 0, 0, W, TILE); R(g, capHi, TILE, TILE - 2, W - 2 * TILE, 2);
  R(g, cap, 0, 0, TILE, H); R(g, cap, W - TILE, 0, TILE, H);
  R(g, capHi, TILE - 2, TILE, 2, H - 2 * TILE); R(g, capHi, W - TILE, TILE, 2, H - 2 * TILE);
  R(g, 'rgba(0,0,0,0.3)', TILE, fy0, 4, fy1 - fy0); R(g, 'rgba(0,0,0,0.3)', W - TILE - 4, fy0, 4, fy1 - fy0);
  const dx = (tw >> 1) * TILE;
  R(g, cap, 0, H - TILE, dx - TILE, TILE); R(g, cap, dx + TILE, H - TILE, W - dx - TILE, TILE);
  R(g, capHi, TILE, H - TILE, dx - 2 * TILE, 2); R(g, capHi, dx + TILE, H - TILE, W - dx - 2 * TILE, 2);
  // 문: 문틀 + 바깥 빛 + 발판
  R(g, '#5a3a22', dx - TILE - 3, H - TILE - 2, 3, TILE + 2); R(g, '#5a3a22', dx + TILE, H - TILE - 2, 3, TILE + 2);
  const lg = g.createLinearGradient(0, H - TILE, 0, H); lg.addColorStop(0, 'rgba(255,236,190,0.05)'); lg.addColorStop(1, 'rgba(255,236,190,0.45)');
  g.fillStyle = lg; g.fillRect(dx - TILE, H - TILE, 2 * TILE, TILE);
  R(g, OL, dx - 12, H - TILE - 6, 24, 9); R(g, '#8a5a3a', dx - 11, H - TILE - 5, 22, 7); for (let i = dx - 9; i < dx + 10; i += 3) R(g, '#6a4228', i, H - TILE - 4, 1, 5);
  // 창문 빛이 바닥에 비친다
  if (!night) for (const d of m.wallDeco || []) if (d.kind === 'window') { g.fillStyle = 'rgba(255,240,200,0.07)'; g.beginPath(); const x0 = d.x * TILE + 2, ww = d.w * TILE + 12; g.moveTo(x0, 3 * TILE); g.lineTo(x0 + ww, 3 * TILE); g.lineTo(x0 + ww + 18, 6 * TILE); g.lineTo(x0 + 10, 6 * TILE); g.closePath(); g.fill(); }
  // 구석 그늘 (방의 깊이)
  const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,4,0.35)'); g.fillStyle = vg; g.fillRect(TILE, TILE, W - 2 * TILE, H - 2 * TILE);
  return c;
}

function drawWallDeco(g, d, m, night) {
  const x = d.x * TILE, w = d.w * TILE, y = TILE, h = 2 * TILE;
  switch (d.kind) {
    case 'window': { // 나무 창틀 + 바깥 하늘 + 커튼
      const wx = x + 2, ww = w + 12, wy = y + 5, wh = 18;
      R(g, OL, wx - 2, wy - 2, ww + 4, wh + 4); R(g, '#6a4628', wx - 1, wy - 1, ww + 2, wh + 2);
      const sky = g.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, night ? '#141c3a' : '#8ac8f0'); sky.addColorStop(1, night ? '#2a3a68' : '#d8f0ff'); g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
      if (night) { R(g, '#1e3a2a', wx, wy + wh - 4, ww, 4); R(g, '#f0f0ff', wx + ww - 9, wy + 3, 4, 4); R(g, '#2a3a68', wx + ww - 8, wy + 3, 3, 3); for (const [sx, sy] of [[3, 5], [7, 2], [12, 7], [5, 10]]) if (sx < ww - 10) R(g, '#ffffff', wx + sx, wy + sy, 1, 1); }
      else { R(g, '#9ad87a', wx, wy + wh - 4, ww, 4); R(g, '#ffffff', wx + 3, wy + 4, 5, 2); }
      R(g, '#6a4628', wx + ww / 2 - 1, wy, 2, wh); R(g, '#6a4628', wx, wy + wh / 2 - 1, ww, 2);
      R(g, '#b8484a', wx - 4, wy - 3, 4, wh + 5); R(g, '#b8484a', wx + ww, wy - 3, 4, wh + 5); R(g, '#d86a6a', wx - 4, wy - 3, 1, wh + 5);
      R(g, '#5a3a22', wx - 3, wy + wh + 2, ww + 6, 2);
      break;
    }
    case 'chimney': { // 화로 위 굴뚝 (벽돌, 그을음)
      const cx = x + w / 2;
      R(g, OL, cx - 13, y - 1, 26, h); R(g, '#6a3a2e', cx - 12, y, 24, h);
      for (let r = 0; r < 5; r++) for (let k = -12 + (r % 2) * 4; k < 12; k += 8) R(g, '#7a4434', cx + k + 1, y + r * 6 + 1, 6, 4);
      R(g, 'rgba(0,0,0,0.35)', cx - 8, y + h - 12, 16, 12);
      break;
    }
    case 'weaponRack': { // 무기 거치대: 검 · 도끼 · 창
      R(g, OL, x + 2, y + 6, w - 4, 3); R(g, '#7a5232', x + 3, y + 7, w - 6, 1); R(g, OL, x + 2, y + 20, w - 4, 3); R(g, '#7a5232', x + 3, y + 21, w - 6, 1);
      const items = [['sword', '#c8d0dc'], ['axe', '#a8b0bc'], ['spear', '#d8dce8'], ['sword', '#e8c060'], ['axe', '#c88a5a'], ['sword', '#a8c8e8']];
      for (let i = 0; i < Math.floor((w - 8) / 10); i++) {
        const ix = x + 8 + i * 10, [k, col] = items[i % items.length];
        if (k === 'sword') { R(g, OL, ix - 2, y + 3, 5, 24); R(g, col, ix - 1, y + 4, 3, 16); R(g, '#ffffff', ix - 1, y + 4, 1, 14); R(g, '#7a5232', ix - 3, y + 20, 7, 2); R(g, '#5a3a22', ix - 1, y + 22, 3, 4); }
        else if (k === 'axe') { R(g, OL, ix - 1, y + 3, 3, 25); R(g, '#7a5232', ix, y + 4, 1, 23); R(g, OL, ix, y + 4, 7, 9); R(g, col, ix + 1, y + 5, 5, 7); }
        else { R(g, OL, ix - 1, y, 3, 29); R(g, '#8a6a42', ix, y + 5, 1, 23); R(g, OL, ix - 2, y - 1, 5, 7); R(g, col, ix - 1, y, 3, 5); }
      }
      break;
    }
    case 'toolRack': { // 망치 · 집게 · 줄
      R(g, OL, x + 3, y + 8, w - 6, 3); R(g, '#7a5232', x + 4, y + 9, w - 8, 1);
      for (let i = 0; i < 4; i++) { const ix = x + 8 + i * ((w - 14) / 3); R(g, OL, ix - 1, y + 10, 3, 14); R(g, '#7a5232', ix, y + 10, 1, 13); if (i % 2) { R(g, OL, ix - 4, y + 21, 9, 6); R(g, '#8a8a92', ix - 3, y + 22, 7, 4); } else { R(g, OL, ix - 2, y + 22, 2, 6); R(g, OL, ix + 1, y + 22, 2, 6); } }
      break;
    }
    case 'runeArch': { // 문양이 새겨진 돌 아치 (공명 제단 뒤)
      R(g, OL, x + 1, y - 2, w - 2, h + 2); R(g, '#6a6a7a', x + 2, y - 1, w - 4, h);
      R(g, '#2a2240', x + 8, y + 4, w - 16, h - 4); g.fillStyle = '#2a2240'; g.beginPath(); g.ellipse(x + w / 2, y + 5, (w - 16) / 2, 6, 0, Math.PI, 0); g.fill();
      for (let i = 0; i < 4; i++) { R(g, 'rgba(190,150,255,0.85)', x + 4, y + 4 + i * 7, 2, 4); R(g, 'rgba(190,150,255,0.85)', x + w - 6, y + 4 + i * 7, 2, 4); }
      glow(g, x + w / 2, y + 16, 22, 'rgba(180,140,255,A)', 0.35);
      break;
    }
    case 'hood': { // 부엌 화덕 위 구리 후드 + 연통
      const cx = x + w / 2;
      R(g, OL, cx - 3, y - 1, 6, 14); R(g, '#8a5a3a', cx - 2, y, 4, 13);
      g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 15, y + h - 2); g.lineTo(cx - 5, y + 11); g.lineTo(cx + 5, y + 11); g.lineTo(cx + 15, y + h - 2); g.closePath(); g.fill();
      g.fillStyle = '#c87a4a'; g.beginPath(); g.moveTo(cx - 13, y + h - 3); g.lineTo(cx - 4, y + 12); g.lineTo(cx + 4, y + 12); g.lineTo(cx + 13, y + h - 3); g.closePath(); g.fill();
      R(g, '#e8a070', cx - 4, y + 12, 3, 2); R(g, '#a85a32', cx - 13, y + h - 5, 26, 2); R(g, OL, cx - 15, y + h - 3, 30, 2);
      break;
    }
    case 'shelf': { // 그릇 · 병 선반
      R(g, OL, x + 1, y + 13, w - 2, 4); R(g, '#8a5a32', x + 2, y + 14, w - 4, 2); R(g, OL, x + 3, y + 17, 2, 4); R(g, OL, x + w - 5, y + 17, 2, 4);
      const items = [['jar', '#c8a040'], ['plate', '#e8e0d0'], ['jar', '#7aa0c8'], ['bottle', '#5aa848'], ['jar', '#c85a3a']];
      for (let i = 0; i < Math.floor((w - 4) / 6); i++) {
        const ix = x + 4 + i * 6, [k, col] = items[i % items.length];
        if (k === 'jar') { R(g, OL, ix - 1, y + 6, 6, 8); R(g, col, ix, y + 7, 4, 6); R(g, '#f4ecd8', ix, y + 7, 4, 1); R(g, 'rgba(255,255,255,0.4)', ix, y + 8, 1, 3); }
        else if (k === 'plate') { R(g, OL, ix - 1, y + 4, 6, 10); R(g, col, ix, y + 5, 4, 8); R(g, '#b8a888', ix + 1, y + 7, 2, 4); }
        else { R(g, OL, ix, y + 4, 4, 10); R(g, col, ix + 1, y + 7, 2, 6); R(g, '#8a6038', ix + 1, y + 5, 2, 2); }
      }
      break;
    }
    case 'painting': { // 액자 속 풍경 (탑이 보이는 들판)
      const px = x + 1, pw = Math.max(w + 6, 22);
      R(g, OL, px - 1, y + 4, pw + 2, 18); R(g, '#c8a040', px, y + 5, pw, 16); R(g, '#8a6a20', px, y + 20, pw, 1);
      R(g, '#8ac8f0', px + 2, y + 7, pw - 4, 7); R(g, '#7ab05a', px + 2, y + 14, pw - 4, 5); R(g, '#5a8a3a', px + 2, y + 17, pw - 4, 2);
      R(g, '#a8a090', px + pw / 2 - 1, y + 8, 3, 7); R(g, '#c8fff0', px + pw / 2, y + 8, 1, 1); R(g, '#ffffff', px + 4, y + 9, 4, 1);
      break;
    }
    case 'clock': R(g, OL, x + 3, y + 3, 11, 24); R(g, '#7a5232', x + 4, y + 4, 9, 22); R(g, '#f0e8d0', x + 5, y + 6, 7, 7); R(g, OL, x + 8, y + 7, 1, 3); R(g, OL, x + 8, y + 9, 3, 1); R(g, '#d8b860', x + 8, y + 16, 1, 6); R(g, '#e8c870', x + 7, y + 21, 3, 3); break;
    case 'questBoard': { // 의뢰 게시판: 종이가 잔뜩
      R(g, OL, x + 2, y + 1, w - 4, h - 4); R(g, '#8a6038', x + 3, y + 2, w - 6, h - 6); R(g, '#6a4628', x + 5, y + 4, w - 10, h - 10);
      const cols = ['#f4ecd0', '#ecdcb0', '#f0e4c8', '#e8d8a8'];
      for (let i = 0; i < 9; i++) { const px = x + 7 + (hash(i, 1, 3) % (w - 22)), py = y + 6 + (hash(i, 2, 3) % (h - 24)); R(g, OL, px - 1, py - 1, 11, 12); R(g, cols[i % 4], px, py, 9, 10); R(g, '#8a7a5a', px + 2, py + 3, 5, 1); R(g, '#8a7a5a', px + 2, py + 5, 4, 1); R(g, '#c83a3a', px + 4, py, 1, 1); }
      break;
    }
    case 'mapScroll': R(g, OL, x + 2, y + 3, w - 4, 22); R(g, '#e8d8a8', x + 3, y + 4, w - 6, 20); R(g, '#7aa0c8', x + 8, y + 8, 10, 6); R(g, '#7ab05a', x + 14, y + 12, 12, 8); R(g, '#b88a5a', x + 24, y + 7, 8, 5); R(g, '#c83a3a', x + 20, y + 14, 2, 2); R(g, '#8a6038', x + 1, y + 2, w - 2, 2); R(g, '#8a6038', x + 1, y + 24, w - 2, 2); break;
    case 'banner': { const col = d.c || '#b83a3a'; R(g, OL, x + 2, y + 1, 13, 28); R(g, col, x + 3, y + 2, 11, 22); g.fillStyle = col; g.beginPath(); g.moveTo(x + 3, y + 24); g.lineTo(x + 8.5, y + 28); g.lineTo(x + 14, y + 24); g.fill(); R(g, '#f0d060', x + 6, y + 8, 5, 5); R(g, '#5a3a22', x + 1, y + 1, 15, 2); break; }
    case 'sign': R(g, OL, x + 2, y + 6, w + 10, 14); R(g, '#a8784a', x + 3, y + 7, w + 8, 12); R(g, '#5a3a22', x + 7, y + 11, w, 1); R(g, '#5a3a22', x + 7, y + 14, w - 6, 1); break;
  }
}

// 가구 (사람보다 아래면 앞에 그려진다)
export function drawInteriorProp(g, pr, t) {
  const x = pr.x * TILE, y = pr.y * TILE, W = pr.w * TILE, H = pr.h * TILE, by = y + H, cx = x + W / 2;
  const shadow = (sx, sw) => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(Math.round(sx), by - 2, Math.round(sw), 4); };
  switch (pr.kind) {
    case 'furnace': { // 벽돌 화로: 불타는 입, 위로 굴뚝
      shadow(x, W);
      R(g, OL, x - 1, by - 40, W + 2, 40); R(g, '#7a3e30', x, by - 39, W, 39);
      for (let r = 0; r < 6; r++) for (let k = (r % 2) * 5; k < W - 2; k += 10) R(g, '#8a4a3a', x + k + 1, by - 38 + r * 6, 8, 4);
      R(g, OL, cx - 13, by - 26, 26, 20); R(g, '#1a0e0a', cx - 12, by - 25, 24, 18);
      const f = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3);
      glow(g, cx, by - 14, 30, 'rgba(255,140,40,A)', 0.55 * f);
      R(g, '#ff7a1a', cx - 10, by - 14, 20, 7); R(g, '#ffc040', cx - 7 + Math.sin(t * 7) * 2, by - 18, 8, 6); R(g, '#fff0a0', cx - 3, by - 13, 6, 3);
      R(g, OL, x - 3, by - 42, W + 6, 4); R(g, '#5a3028', x - 2, by - 41, W + 4, 2);
      R(g, OL, cx - 9, by - 44, 18, 3);
      return;
    }
    case 'anvil': shadow(x + 2, W - 4); R(g, OL, x + 7, by - 8, W - 14, 8); R(g, '#4a4a52', x + 8, by - 7, W - 16, 7); R(g, OL, x + 1, by - 16, W - 2, 9); R(g, '#6a6a74', x + 2, by - 15, W - 4, 7); R(g, '#9a9aa4', x + 2, by - 15, W - 4, 2); g.fillStyle = '#6a6a74'; g.beginPath(); g.moveTo(x + 2, by - 15); g.lineTo(x - 5, by - 13); g.lineTo(x + 2, by - 10); g.fill(); R(g, OL, x + W - 10, by - 21, 8, 5); R(g, '#7a5232', x + W - 9, by - 20, 6, 3); return;
    case 'quench': shadow(x, W); R(g, OL, x, by - 12, W, 12); R(g, '#7a5232', x + 1, by - 11, W - 2, 10); R(g, '#3a7aa8', x + 3, by - 10, W - 6, 4); R(g, '#8ad0f0', x + 4 + ((t * 6) | 0) % (W - 10), by - 10, 3, 1); R(g, '#5a3a22', x + 1, by - 5, W - 2, 1); return;
    case 'oreCrate': shadow(x, W); R(g, OL, x, by - 14, W, 14); R(g, '#8a6038', x + 1, by - 13, W - 2, 12); R(g, '#6a4628', x + 1, by - 8, W - 2, 1); for (const [ox, col] of [[4, '#d0763a'], [10, '#a4acbc'], [16, '#f0c040'], [23, '#8a8a86']]) { R(g, OL, x + ox - 1, by - 18, 7, 6); R(g, col, x + ox, by - 17, 5, 4); } return;
    case 'barrel': shadow(x + 1, W - 2); R(g, OL, x + 1, by - 18, W - 2, 18); R(g, '#8a5a32', x + 2, by - 17, W - 4, 16); R(g, '#a8784a', x + 3, by - 17, 3, 16); R(g, '#4a4a52', x + 2, by - 14, W - 4, 2); R(g, '#4a4a52', x + 2, by - 6, W - 4, 2); R(g, '#6a4628', x + 3, by - 18, W - 6, 2); return;
    case 'coalPile': shadow(x, W); g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 4, W / 2, 7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#26222a'; g.beginPath(); g.ellipse(cx, by - 4, W / 2 - 1, 6, 0, Math.PI, 0); g.fill(); for (let i = 0; i < 9; i++) R(g, '#4a4650', x + 3 + (hash(i, 4, 1) % (W - 6)), by - 9 + (hash(i, 5, 1) % 5), 2, 1); return;
    case 'runeAltar': { // 빛나는 공명 제단
      shadow(x, W);
      R(g, OL, x + 1, by - 14, W - 2, 14); R(g, '#5a5a6a', x + 2, by - 13, W - 4, 12); R(g, '#7a7a8a', x + 2, by - 13, W - 4, 3);
      R(g, OL, x - 1, by - 18, W + 2, 5); R(g, '#8a8a9a', x, by - 17, W, 3);
      const a = 0.55 + 0.35 * Math.sin(t * 2.2);
      glow(g, cx, by - 24, 26, 'rgba(190,150,255,A)', 0.5 * a);
      for (let i = 0; i < 3; i++) { const ry = by - 30 - i * 5 + Math.sin(t * 2 + i) * 2; R(g, `rgba(220,190,255,${a})`, cx - 4 + i * 3, ry, 2, 2); }
      R(g, `rgba(200,160,255,${0.6 + 0.3 * a})`, cx - 8, by - 10, 16, 1); R(g, `rgba(200,160,255,${0.6 + 0.3 * a})`, cx - 1, by - 13, 2, 7);
      return;
    }
    case 'candles': { R(g, OL, cx - 6, by - 4, 12, 4); R(g, '#c8a040', cx - 5, by - 3, 10, 2); for (const ox of [-4, 0, 4]) { const hgt = ox ? 8 : 11; R(g, '#f4ecd8', cx + ox - 1, by - 3 - hgt, 2, hgt); const fl = Math.sin(t * 11 + ox) > 0 ? 1 : 0; R(g, '#ffb040', cx + ox - 1, by - 6 - hgt - fl, 2, 3); glow(g, cx + ox, by - 5 - hgt, 8, 'rgba(255,200,100,A)', 0.4); } return; }
    case 'bookshelf': { // 키 큰 책장: 칸마다 알록달록한 책
      R(g, OL, x - 1, by - 40, W + 2, 40); R(g, '#6a4628', x, by - 39, W, 39);
      const cols = ['#8a2a2a', '#2a5a8a', '#3a7a3a', '#8a6a2a', '#5a3a7a', '#7a7a6a', '#a84a2a', '#2a7a7a'];
      for (let row = 0; row < 3; row++) {
        const ry = by - 37 + row * 12; R(g, '#3a2418', x + 2, ry, W - 4, 10);
        let bx = x + 3; while (bx < x + W - 5) { const bw = 2 + (hash(bx, ry, 3) % 3), bh = 7 + (hash(bx, ry, 4) % 3); R(g, cols[hash(bx, ry, 5) % cols.length], bx, ry + 10 - bh, bw, bh); R(g, 'rgba(255,255,255,0.18)', bx, ry + 10 - bh, 1, bh); bx += bw + (hash(bx, ry, 6) % 5 === 0 ? 3 : 0); }
        R(g, '#8a6038', x + 1, ry + 10, W - 2, 2);
      }
      R(g, '#8a6038', x, by - 40, W, 3);
      return;
    }
    case 'desk': { shadow(x, W); R(g, OL, x - 1, by - 14, W + 2, 14); R(g, '#8a5a32', x, by - 13, W, 12); R(g, '#a8784a', x, by - 13, W, 3); R(g, '#6a4628', x + 3, by - 9, W - 6, 1);
      if (pr.books) { R(g, OL, x + 4, by - 19, 10, 6); R(g, '#2a5a8a', x + 5, by - 18, 8, 2); R(g, '#8a2a2a', x + 5, by - 16, 8, 2); R(g, OL, x + W - 14, by - 20, 4, 7); R(g, '#f4ecd8', x + W - 13, by - 19, 2, 5); R(g, '#ffb040', x + W - 13, by - 22, 2, 2); glow(g, x + W - 12, by - 21, 10, 'rgba(255,200,100,A)', 0.35); R(g, '#f4ecd8', x + 18, by - 16, 9, 3); }
      if (pr.papers) { for (let i = 0; i < 4; i++) R(g, '#f0e4c8', x + 5 + i * 13, by - 16 - (i % 2), 9, 3); R(g, OL, x + W - 10, by - 21, 5, 8); R(g, '#3a2a5a', x + W - 9, by - 20, 3, 6); R(g, '#e8e8e8', x + W - 8, by - 23, 1, 4); }
      return; }
    case 'table': shadow(x, W); R(g, OL, x, by - 12, W, 6); R(g, '#9a6a42', x + 1, by - 11, W - 2, 4); R(g, OL, x + 2, by - 7, 3, 7); R(g, OL, x + W - 5, by - 7, 3, 7); R(g, '#7a5232', x + 3, by - 6, 1, 5); R(g, '#7a5232', x + W - 4, by - 6, 1, 5); R(g, '#f4ecd8', x + 6, by - 13, 8, 2); return;
    case 'chair': shadow(x + 3, W - 6); R(g, OL, x + 3, by - 16, W - 6, 4); R(g, '#8a5a32', x + 4, by - 15, W - 8, 2); R(g, OL, x + 3, by - 9, W - 6, 4); R(g, '#a8784a', x + 4, by - 8, W - 8, 2); R(g, OL, x + 4, by - 5, 2, 5); R(g, OL, x + W - 6, by - 5, 2, 5); return;
    case 'bench': shadow(x, W); R(g, OL, x, by - 9, W, 5); R(g, '#9a6a42', x + 1, by - 8, W - 2, 3); R(g, OL, x + 2, by - 5, 3, 5); R(g, OL, x + W - 5, by - 5, 3, 5); return;
    case 'globe': shadow(x + 3, W - 6); R(g, OL, cx - 1, by - 8, 2, 8); R(g, OL, cx - 5, by - 2, 10, 2); g.fillStyle = OL; g.beginPath(); g.arc(cx, by - 14, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4a8ac8'; g.beginPath(); g.arc(cx, by - 14, 6, 0, Math.PI * 2); g.fill(); const sp = (t * 0.6) % 1; R(g, '#5aa848', cx - 4 + sp * 4, by - 17, 4, 3); R(g, '#5aa848', cx + 1 - sp * 3, by - 13, 3, 4); return;
    case 'plant': shadow(x + 3, W - 6); R(g, OL, cx - 5, by - 9, 10, 9); R(g, '#b85a3a', cx - 4, by - 8, 8, 7); R(g, '#d87a5a', cx - 4, by - 8, 8, 2); for (const [ox, oy, r] of [[-3, -14, 4], [3, -15, 4], [0, -19, 4]]) { g.fillStyle = OL; g.beginPath(); g.arc(cx + ox, by + oy, r + 1, 0, Math.PI * 2); g.fill(); } for (const [ox, oy, r] of [[-3, -14, 4], [3, -15, 4], [0, -19, 4]]) { g.fillStyle = '#4a9a3a'; g.beginPath(); g.arc(cx + ox, by + oy, r, 0, Math.PI * 2); g.fill(); } R(g, '#8ad060', cx - 4, by - 17, 2, 2); R(g, '#8ad060', cx + 1, by - 21, 2, 2); return;
    case 'counter': { shadow(x, W); R(g, OL, x - 1, by - 18, W + 2, 18); R(g, '#7a5232', x, by - 17, W, 16); R(g, '#a8784a', x, by - 17, W, 4); for (let k = x + 8; k < x + W - 4; k += 16) R(g, '#5a3a22', k, by - 12, 1, 10);
      R(g, OL, x + 6, by - 25, 12, 8); R(g, '#c8a040', x + 7, by - 24, 10, 2); R(g, '#c8a040', x + 11, by - 22, 2, 4); // 저울
      for (const [ox, col] of [[W - 26, '#d8a8e8'], [W - 17, '#a8e8c8']]) { R(g, OL, x + ox, by - 26, 8, 10); R(g, col, x + ox + 1, by - 25, 6, 8); R(g, '#ffffff', x + ox + 2, by - 24, 1, 3); R(g, '#8a6038', x + ox + 1, by - 27, 6, 2); }
      return; }
    case 'goodsShelf': case 'seedRack': {
      R(g, OL, x - 1, by - 36, W + 2, 36); R(g, '#7a5232', x, by - 35, W, 35);
      for (let row = 0; row < 3; row++) {
        const ry = by - 33 + row * 11; R(g, '#4a3020', x + 2, ry, W - 4, 9);
        for (let k = 0; k < Math.floor((W - 6) / 8); k++) {
          const ix = x + 4 + k * 8, h = hash(k, row, pr.x);
          if (pr.kind === 'seedRack') { const col = ['#e8c060', '#f08a2a', '#a85ab8', '#e8303a', '#5aa848'][h % 5]; R(g, OL, ix, ry + 1, 7, 8); R(g, '#d4b67e', ix + 1, ry + 2, 5, 6); R(g, col, ix + 2, ry + 4, 3, 3); }
          else if (h % 3 === 0) { R(g, OL, ix, ry + 2, 6, 7); R(g, ['#8ac8b8', '#e8a8c8', '#c8d870'][h % 3 === 0 ? (h >> 2) % 3 : 0], ix + 1, ry + 3, 4, 5); R(g, '#8a6038', ix + 1, ry + 2, 4, 1); }
          else if (h % 3 === 1) { R(g, OL, ix, ry + 3, 7, 6); R(g, '#c8a070', ix + 1, ry + 4, 5, 4); }
          else { R(g, OL, ix + 1, ry + 1, 5, 8); R(g, '#f0c040', ix + 2, ry + 2, 3, 6); }
        }
        R(g, '#9a6a42', x + 1, ry + 9, W - 2, 2);
      }
      return;
    }
    case 'sacks': shadow(x, W); for (const [ox, col] of [[2, '#d4b67e'], [14, '#c8a870']]) { g.fillStyle = OL; g.beginPath(); g.ellipse(x + ox + 7, by - 7, 8, 8, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = col; g.beginPath(); g.ellipse(x + ox + 7, by - 7, 7, 7, 0, 0, Math.PI * 2); g.fill(); R(g, '#8a6a3a', x + ox + 4, by - 15, 7, 2); R(g, '#e8c060', x + ox + 5, by - 8, 4, 3); } return;
    case 'bed': { // 나무 침대: 머리판 · 베개 · 접힌 이불 · 발판
      shadow(x, W);
      R(g, OL, x + 1, y - 7, W - 2, 13); R(g, '#7a4a2a', x + 2, y - 6, W - 4, 11); R(g, '#9a6a3e', x + 2, y - 6, W - 4, 2);
      for (let k = x + 6; k < x + W - 4; k += 6) R(g, '#5a3420', k, y - 3, 2, 7);
      R(g, OL, x + 1, y + 4, W - 2, H - 5); R(g, '#8a5a32', x + 2, y + 5, W - 4, H - 7);
      R(g, '#f4f0e8', x + 3, y + 5, W - 6, H - 11);
      R(g, OL, x + 5, y + 5, W - 10, 8); R(g, '#ffffff', x + 6, y + 6, W - 12, 6); R(g, '#dcd8d0', x + 6, y + 11, W - 12, 1); R(g, '#e8e4dc', x + W / 2 - 1, y + 6, 1, 6);
      const bt = y + 15, bh = by - bt - 5;
      R(g, OL, x + 2, bt - 1, W - 4, bh + 1); R(g, '#3a68a8', x + 3, bt, W - 6, bh);
      for (let qy = bt + 3; qy < bt + bh - 1; qy += 5) for (let qx = x + 4 + ((qy - bt) % 10 ? 4 : 0); qx < x + W - 6; qx += 8) R(g, '#c8a040', qx, qy, 3, 3);
      R(g, '#5a88c8', x + 3, bt, W - 6, 1); R(g, '#f4f0e8', x + 3, bt, W - 6, 2); R(g, '#2a4a80', x + 3, bt + bh - 1, W - 6, 1);
      R(g, OL, x + 1, by - 6, W - 2, 6); R(g, '#7a4a2a', x + 2, by - 5, W - 4, 4); R(g, '#9a6a3e', x + 2, by - 5, W - 4, 1);
      return;
    }
    case 'nightstand': { // 협탁 + 촛불
      shadow(x + 2, W - 4); R(g, OL, x + 2, by - 13, W - 4, 13); R(g, '#8a5a32', x + 3, by - 12, W - 6, 11); R(g, '#a8784a', x + 3, by - 12, W - 6, 2); R(g, OL, cx - 1, by - 7, 2, 2);
      R(g, OL, cx - 2, by - 20, 4, 7); R(g, '#f4ecd8', cx - 1, by - 19, 2, 6); const fl = Math.sin(t * 11) > 0 ? 1 : 0; R(g, '#ffb040', cx - 1, by - 22 - fl, 2, 3); glow(g, cx, by - 21, 9, 'rgba(255,200,100,A)', 0.45);
      return;
    }
    case 'storage': { // 보관함: 쇠띠를 두른 나무 궤짝 + 자물쇠
      shadow(x, W);
      R(g, OL, x + 1, by - 19, W - 2, 19); R(g, '#8a5a30', x + 2, by - 18, W - 4, 17);
      R(g, '#a8703c', x + 2, by - 18, W - 4, 7); R(g, '#c88a4a', x + 2, by - 18, W - 4, 1); R(g, OL, x + 1, by - 11, W - 2, 1);
      for (let k = x + 5; k < x + W - 4; k += 5) R(g, 'rgba(0,0,0,0.18)', k, by - 10, 1, 9);
      for (const bx of [x + 6, x + W - 8]) { R(g, '#4a4a54', bx, by - 18, 2, 17); R(g, '#7a7a86', bx, by - 18, 1, 17); }
      R(g, OL, cx - 3, by - 14, 6, 6); R(g, '#e8c060', cx - 2, by - 13, 4, 4); R(g, OL, cx - 1, by - 12, 2, 2);
      return;
    }
    case 'stove': { // 무쇠 화덕: 불 보이는 아궁이 + 위에 끓는 냄비
      shadow(x, W);
      R(g, OL, x + 1, by - 21, W - 2, 21); R(g, '#34343c', x + 2, by - 20, W - 4, 19); R(g, '#4a4a54', x + 2, by - 20, W - 4, 2);
      R(g, OL, x, by - 23, W, 4); R(g, '#5a5a66', x + 1, by - 22, W - 2, 2);
      R(g, OL, x + 4, by - 13, 13, 9); R(g, '#140a08', x + 5, by - 12, 11, 7);
      const f = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3);
      glow(g, x + 10, by - 9, 16, 'rgba(255,140,40,A)', 0.5 * f);
      R(g, '#ff7a1a', x + 6, by - 8, 9, 3); R(g, '#ffc040', x + 8 + Math.sin(t * 7), by - 10, 4, 3); R(g, '#fff0a0', x + 9, by - 8, 2, 1);
      for (let k = 0; k < 3; k++) R(g, '#4a4a54', x + 5 + k * 4, by - 13, 1, 9);
      R(g, OL, x + 20, by - 16, 9, 9); R(g, '#4a4a54', x + 21, by - 15, 7, 7); R(g, '#6a6a76', x + 21, by - 15, 7, 1); // 오븐 문
      // 냄비
      R(g, OL, x + W - 15, by - 33, 13, 11); R(g, '#5a5a66', x + W - 14, by - 32, 11, 9); R(g, '#8a8a96', x + W - 14, by - 32, 11, 2);
      R(g, OL, x + W - 17, by - 31, 3, 2); R(g, OL, x + W - 3, by - 31, 3, 2);
      R(g, '#e8a040', x + W - 13, by - 33, 9, 2); // 끓는 국
      // 주전자
      R(g, OL, x + 3, by - 30, 10, 8); R(g, '#c87a4a', x + 4, by - 29, 8, 6); R(g, '#e8a070', x + 4, by - 29, 8, 1); R(g, OL, x + 12, by - 28, 3, 1); R(g, OL, x + 6, by - 32, 4, 2);
      return;
    }
    case 'kitchen': { // 조리대: 도마 · 칼 · 채소 · 병
      shadow(x, W);
      R(g, OL, x - 1, by - 18, W + 2, 18); R(g, '#7a5232', x, by - 17, W, 16); R(g, '#c8b898', x, by - 18, W, 4); R(g, '#e0d0b0', x, by - 18, W, 1);
      R(g, OL, x + 6, by - 10, 8, 7); R(g, '#5a3a22', x + 7, by - 9, 6, 5); R(g, '#c8a040', x + 9, by - 7, 2, 1); // 서랍
      R(g, OL, x + W - 14, by - 10, 8, 7); R(g, '#5a3a22', x + W - 13, by - 9, 6, 5); R(g, '#c8a040', x + W - 11, by - 7, 2, 1);
      R(g, OL, x + 3, by - 23, 14, 5); R(g, '#c89a5a', x + 4, by - 22, 12, 3); // 도마
      R(g, '#e8603a', x + 6, by - 23, 5, 2); R(g, '#5aa848', x + 11, by - 24, 2, 2); // 당근
      R(g, OL, x + 14, by - 24, 7, 1); R(g, '#d8dce8', x + 15, by - 24, 5, 1); // 칼
      g.fillStyle = OL; g.beginPath(); g.arc(x + W - 9, by - 23, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#7ac85a'; g.beginPath(); g.arc(x + W - 9, by - 23, 4, 0, Math.PI * 2); g.fill(); R(g, '#a8e88a', x + W - 11, by - 25, 2, 2); // 양배추
      R(g, OL, x + W - 3, by - 28, 4, 10); R(g, '#a8c8e8', x + W - 2, by - 27, 2, 8);
      return;
    }
    case 'workbench': { // 작업대: 바이스 · 톱 · 망치 · 대팻밥
      shadow(x, W);
      R(g, OL, x, by - 15, W, 5); R(g, '#a8784a', x + 1, by - 14, W - 2, 3); R(g, '#c8945a', x + 1, by - 14, W - 2, 1);
      R(g, OL, x + 2, by - 10, 4, 10); R(g, OL, x + W - 6, by - 10, 4, 10); R(g, '#7a5232', x + 3, by - 10, 2, 9); R(g, '#7a5232', x + W - 5, by - 10, 2, 9);
      R(g, OL, x + 2, by - 5, W - 4, 2); R(g, '#7a5232', x + 3, by - 5, W - 6, 1);
      R(g, OL, x + 3, by - 21, 7, 7); R(g, '#6a6a74', x + 4, by - 20, 5, 5); R(g, '#9a9aa4', x + 4, by - 20, 5, 1); R(g, OL, x + 9, by - 18, 4, 1); // 바이스
      R(g, OL, x + 13, by - 18, 12, 4); R(g, '#c8ccd8', x + 14, by - 17, 9, 2); for (let k = 0; k < 9; k += 2) R(g, '#8a8a96', x + 14 + k, by - 15, 1, 1); R(g, OL, x + 22, by - 19, 4, 5); R(g, '#8a5a32', x + 23, by - 18, 2, 3); // 톱
      R(g, OL, x + W - 9, by - 22, 3, 8); R(g, '#8a5a32', x + W - 8, by - 21, 1, 7); R(g, OL, x + W - 11, by - 24, 7, 4); R(g, '#7a7a86', x + W - 10, by - 23, 5, 2); // 망치
      for (let i = 0; i < 6; i++) R(g, '#e8c890', x + 5 + (hash(i, 2, 7) % (W - 10)), by - 2 + (i % 2), 2, 1); // 대팻밥
      return;
    }
    case 'woodpile': { // 장작더미
      shadow(x + 1, W - 2);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) { const ox = x + 1 + k * 5 + r * 2.5, oy = by - 6 - r * 5; R(g, OL, ox - 1, oy - 1, 6, 6); R(g, '#9a6a3e', ox, oy, 4, 4); R(g, '#d8b080', ox + 1, oy + 1, 2, 2); }
      return;
    }
    case 'crate': shadow(x, W); R(g, OL, x + 1, by - 15, W - 2, 15); R(g, '#9a6a3a', x + 2, by - 14, W - 4, 13); R(g, '#6a4628', x + 2, by - 14, W - 4, 2); g.strokeStyle = '#6a4628'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 3, by - 12); g.lineTo(x + W - 3, by - 3); g.stroke(); return;
  }
}

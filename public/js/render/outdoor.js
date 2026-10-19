// 바깥 세계 그림: 땅 타일(풀 · 흙 · 모래 · 물 · 절벽 …)과 큰 소품(나무 · 집 · 탑 · 동굴 입구)을 픽셀로 직접 그린다.
// 땅은 한 장의 캔버스에 미리 그리고, 불에 타거나 얼면 그 칸만 다시 그린다.
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD, T_DEEP } from '../sim/mapgen.js';
import { G } from '../data/maps/overworld.js';
import { hash, drawDeco } from './tiles.js';

const OL = '#1a1410';
const PAL = {
  grass: ['#5d9e3b', '#67a842', '#8cc95a', '#457f2e'], forest: ['#3d6b2f', '#467634', '#5c8c3e', '#2c5224'],
  dirt: ['#a8834f', '#b48e58', '#cdb38a', '#8a6a3e'], sand: ['#e4d29a', '#d8c486', '#f4ecd0', '#c4ae74'],
  rock: ['#8a9076', '#969c82', '#b6baa4', '#6e745e'], snow: ['#eef4f8', '#e2eaf2', '#ffffff', '#c4d4e4'],
  stone: ['#a9a59f', '#b6b2ab', '#c8c4bc', '#7e7a74'], burnt: ['#3a3028', '#44382e', '#6a645c', '#241c16'],
  ice: ['#c4ecf8', '#d6f2fc', '#ffffff', '#8cc8e0'], bridge: ['#9a6a3c', '#b07c48', '#c89460', '#4a3018'],
  shallow: ['#4aa6c6', '#56b2d0', '#a8e4f4'], deep: ['#2c74a4', '#3280b0', '#6ab8dc'],
  cliff: ['#857a6c', '#968b7b', '#bab09c', '#5a5046'],
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbCache = new Map();
const rgb = (h) => { let v = rgbCache.get(h); if (!v) { v = hexRgb(h); rgbCache.set(h, v); } return v; };
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, f = (t) => t * t * (3 - 2 * t);
  const h = (a, b) => hash(a, b, s) / 4294967296;
  const fu = f(u), fv = f(v);
  return (h(xi, yi) * (1 - fu) + h(xi + 1, yi) * fu) * (1 - fv) + (h(xi, yi + 1) * (1 - fu) + h(xi + 1, yi + 1) * fu) * fv;
}
// 칸 바탕: 픽셀마다 넓은 얼룩 노이즈 → 3단 색, 경계는 바이어 디더링 (도트 느낌을 살린 부드러운 변화)
function baseFill(g, px, py, cols, salt = 1) {
  const img = g.createImageData(16, 16), d = img.data, c = cols.map(rgb);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const wx = px + x, wy = py + y;
    const n = vnoise(wx / 46, wy / 46, salt) * 0.7 + vnoise(wx / 13, wy / 13, salt + 9) * 0.3;
    const th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 * 0.16 - 0.08;
    const v = n + th, k = v < 0.42 ? 2 : v < 0.6 ? 0 : 1;
    const o = (y * 16 + x) * 4, cc = c[k];
    d[o] = cc[0]; d[o + 1] = cc[1]; d[o + 2] = cc[2]; d[o + 3] = 255;
  }
  g.putImageData(img, px, py);
}
const grassy = (g) => g === G.GRASS || g === G.TALL || g === G.FLOWER || g === G.FOREST;

export function renderOutdoor(world) {
  const { tw, th } = world;
  const c = document.createElement('canvas'); c.width = tw * TILE; c.height = th * TILE;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) paintTile(g, world, x, y);
  for (const d of world.map.deco) drawDeco(g, d);
  return c;
}

// 칸 하나 그리기 (주변 칸을 보고 가장자리를 섞는다)
export function paintTile(g, w, x, y) {
  const { tw, th } = w, m = w.map;
  const T = (xx, yy) => (xx < 0 || yy < 0 || xx >= tw || yy >= th ? T_DEEP : w.tiles[yy * tw + xx]);
  const Gd = (xx, yy) => (xx < 0 || yy < 0 || xx >= tw || yy >= th ? G.SAND : m.ground[yy * tw + xx]);
  const t = T(x, y), gr = Gd(x, y), px = x * TILE, py = y * TILE, h = hash(x, y, 7);
  const P = (col, dx, dy, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(px + dx, py + dy, ww, hh); };
  const speck = (cols, n, salt) => { for (let i = 0; i < n; i++) { const r = hash(x, y, salt + i); P(cols[r % cols.length], r % 16, (r >> 5) % 16, 1 + ((r >> 9) & 1), 1); } };
  // 넓은 덩어리로 색이 바뀌게 (들판이 단조롭지 않게)
  const blob = ((hash(x >> 2, y >> 2, 3) % 100) + (hash((x + 2) >> 2, (y + 1) >> 2, 3) % 100)) / 200;

  if (t === T_DEEP || t === T_LIQUID) {
    const pal = t === T_DEEP ? PAL.deep : PAL.shallow;
    P(blob > 0.5 ? pal[1] : pal[0], 0, 0, 16, 16);
    for (let i = 0; i < 2; i++) { const r = hash(x, y, 40 + i); P(pal[2], r % 11, 2 + (r >> 4) % 12, 3 + (r >> 9) % 4, 1); }
    // 깊은 물과 얕은 물 사이 · 물가 거품
    const land = (xx, yy) => { const tt = T(xx, yy); return tt !== T_DEEP && tt !== T_LIQUID && !(tt === T_FLOOR && Gd(xx, yy) === G.ICE); };
    if (t === T_DEEP) for (const [dx, dy, ex, ey, ew, eh] of [[0, -1, 0, 0, 16, 2], [0, 1, 0, 14, 16, 2], [-1, 0, 0, 0, 2, 16], [1, 0, 14, 0, 2, 16]]) if (T(x + dx, y + dy) === T_LIQUID) P(PAL.shallow[0], ex, ey, ew, eh);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!land(x + dx, y + dy)) continue;
      for (let i = 0; i < 16; i++) {
        const r = hash(x * 3 + dx, y * 3 + dy, i);
        const len = 1 + (r % 3);
        if (dy === -1) P('rgba(255,255,255,0.75)', i, 0, 1, len); if (dy === 1) P('rgba(255,255,255,0.6)', i, 16 - len, 1, len);
        if (dx === -1) P('rgba(255,255,255,0.7)', 0, i, len, 1); if (dx === 1) P('rgba(255,255,255,0.7)', 16 - len, i, len, 1);
      }
    }
    if (land(x, y - 1)) P('rgba(0,0,0,0.18)', 0, 2, 16, 2); // 물가 아래 그늘
    return;
  }
  if (t === T_WALL) { cliff(); return; }
  // 땅
  ground(gr);
  if (t === T_CRACK) boulder();
  // 절벽 바로 아래 그늘
  if (T(x, y - 1) === T_WALL || T(x, y - 1) === T_CRACK) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(px, py, 16, 3); g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(px, py + 3, 16, 2); }
  if (T(x - 1, y) === T_WALL) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(px, py, 2, 16); }

  function ground(gg) {
    if (gg === G.GRASS || gg === G.TALL || gg === G.FLOWER) {
      const p = PAL.grass;
      baseFill(g, px, py, [p[0], p[1], '#548f35'], 1);
      speck([p[2], p[3], p[2]], 6, 10);
      for (let i = 0; i < 3; i++) { const r = hash(x, y, 30 + i), bx = r % 14, by = 3 + (r >> 4) % 11; P(p[3], bx, by, 1, 2); P(p[2], bx + 1, by - 1, 1, 2); } // 풀잎
      if (gg === G.FLOWER) for (let i = 0; i < 2 + (h % 2); i++) {
        const r = hash(x, y, 60 + i), fx = 2 + r % 11, fy = 3 + (r >> 4) % 10, col = ['#ffffff', '#ffe05a', '#ff9ac0', '#9ac8ff'][(r >> 8) % 4];
        P('#3a7a2a', fx, fy + 1, 1, 2); P(col, fx - 1, fy, 3, 1); P(col, fx, fy - 1, 1, 3); P('#ffd040', fx, fy, 1, 1);
      }
      if (gg === G.TALL) { // 키 큰 풀: 풀잎이 부채꼴로 모인 덤불
        const n = 2 + (h % 2);
        for (let i = 0; i < n; i++) {
          const r = hash(x, y, 80 + i), cx = 3 + (r % 10), base = 9 + ((r >> 4) % 6);
          P('rgba(0,0,0,0.2)', cx - 3, base, 7, 2);
          for (let b = -2; b <= 2; b++) {
            const hgt = 6 - Math.abs(b) + ((r >> (6 + b + 2)) & 1), lean = b;
            for (let k = 0; k < hgt; k++) { const xx = cx + Math.round(lean * k / hgt * 1.4), yy = base - k; P(k === hgt - 1 ? '#b4e070' : k > hgt / 2 ? '#86c652' : '#4e8a30', xx, yy, 1, 1); }
          }
          P(p[3], cx - 2, base, 5, 1);
        }
      }
      return;
    }
    const pal = { [G.FOREST]: PAL.forest, [G.DIRT]: PAL.dirt, [G.SAND]: PAL.sand, [G.ROCK]: PAL.rock, [G.SNOW]: PAL.snow, [G.STONE]: PAL.stone, [G.BURNT]: PAL.burnt, [G.ICE]: PAL.ice, [G.BRIDGE]: PAL.bridge }[gg] || PAL.grass;
    if (gg === G.FOREST || gg === G.SAND || gg === G.DIRT || gg === G.ROCK || gg === G.SNOW || gg === G.BURNT) baseFill(g, px, py, [pal[0], pal[1], pal[3]], 2 + gg);
    else P(blob > 0.55 ? pal[1] : pal[0], 0, 0, 16, 16);
    if (gg === G.STONE) { // 돌바닥: 엇갈린 벽돌
      g.fillStyle = pal[3];
      for (let r = 0; r < 4; r++) { P(pal[3], 0, r * 4 + 3, 16, 1); const off = (r + y) % 2 ? 0 : 4; for (let k = off; k < 16; k += 8) P(pal[3], k, r * 4, 1, 3); }
      speck([pal[2]], 3, 12);
    } else if (gg === G.BRIDGE) { // 나무 다리: 가로 판자 + 난간
      const vertical = T(x, y - 1) === T_FLOOR && Gd(x, y - 1) === G.BRIDGE || T(x, y + 1) === T_FLOOR && Gd(x, y + 1) === G.BRIDGE;
      for (let k = 0; k < 4; k++) { if (vertical) { P(k % 2 ? pal[1] : pal[0], 0, k * 4, 16, 3); P(pal[3], 0, k * 4 + 3, 16, 1); } else { P(k % 2 ? pal[1] : pal[0], k * 4, 0, 3, 16); P(pal[3], k * 4 + 3, 0, 1, 16); } }
      const water = (xx, yy) => T(xx, yy) === T_DEEP || T(xx, yy) === T_LIQUID;
      if (water(x - 1, y)) { P(OL, 0, 0, 2, 16); P('#6a4426', 0, 0, 1, 16); } if (water(x + 1, y)) { P(OL, 14, 0, 2, 16); P('#6a4426', 15, 0, 1, 16); }
      if (water(x, y - 1)) { P(OL, 0, 0, 16, 2); P('#6a4426', 0, 1, 16, 1); } if (water(x, y + 1)) { P(OL, 0, 14, 16, 2); P('#6a4426', 0, 14, 16, 1); }
    } else if (gg === G.ICE) {
      speck([pal[2], pal[1]], 4, 12);
      const r = hash(x, y, 90); P(pal[3], r % 8, 4, 6, 1); P(pal[3], 6 + r % 6, 5, 1, 4); P(pal[2], 2, 2, 4, 1);
    } else if (gg === G.FOREST) {
      speck([pal[2], pal[3], '#6a5a2a'], 8, 12);
      for (let i = 0; i < 2; i++) { const r = hash(x, y, 70 + i); P(pal[3], r % 14, (r >> 4) % 14, 2, 1); }
    } else {
      speck([pal[2], pal[3]], gg === G.SAND ? 5 : 7, 12);
      if (gg === G.DIRT && h % 3 === 0) { const r = hash(x, y, 91); P(pal[3], r % 13, (r >> 4) % 13, 3, 2); P(pal[2], r % 13, (r >> 4) % 13, 2, 1); }
      if (gg === G.ROCK && h % 4 === 0) { const r = hash(x, y, 92), sx = 2 + r % 10, sy = 3 + (r >> 4) % 9; P(OL, sx - 1, sy - 1, 6, 5); P('#a8ac96', sx, sy, 4, 3); P('#c8ccb6', sx, sy, 2, 1); }
      if (gg === G.SNOW) { const r = hash(x, y, 93); P(pal[3], r % 12, (r >> 4) % 12, 4, 1); }
    }
    // 풀이 맞닿은 가장자리는 풀이 삐져나온다
    if (gg !== G.BRIDGE && gg !== G.FOREST && gg !== G.ICE) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (!grassy(Gd(x + dx, y + dy)) || T(x + dx, y + dy) !== T_FLOOR && T(x + dx, y + dy) !== T_BUILD) continue;
        const gc = Gd(x + dx, y + dy) === G.FOREST ? PAL.forest : PAL.grass;
        for (let i = 0; i < 16; i++) {
          const r = hash(x * 5 + dx, y * 5 + dy, i), len = r % 4 === 0 ? 0 : 1 + (r % 3);
          if (!len) continue;
          const col = r & 8 ? gc[0] : gc[3];
          if (dy === -1) P(col, i, 0, 1, len); if (dy === 1) P(col, i, 16 - len, 1, len);
          if (dx === -1) P(col, 0, i, len, 1); if (dx === 1) P(col, 16 - len, i, len, 1);
        }
      }
    }
  }
  function cliff() {
    const open = (xx, yy) => { const tt = T(xx, yy); return tt !== T_WALL && tt !== T_CRACK; };
    const c = PAL.cliff;
    const lower = open(x, y + 1) || T(x, y + 1) === T_DEEP, upper = !lower && (open(x, y + 2) || T(x, y + 2) === T_DEEP) && T(x, y + 1) === T_WALL;
    if (lower || upper) {
      // 절벽 면: 지층 줄무늬, 위는 풀이 덮고, 아래는 어둡다
      P(c[0], 0, 0, 16, 16);
      // 바위 덩어리: 끊어진 결 · 밝은 모서리 · 세로 금
      for (let k = 0; k < 5; k++) { const r = hash(x, y, 50 + k), sx = r % 12, len = 3 + (r >> 4) % 7, yy = 2 + k * 3 + ((r >> 8) % 2); P(c[3], sx, yy, len, 1); P(c[2], sx, yy - 1, Math.max(1, len - 2), 1); }
      for (let i = 0; i < 3; i++) { const r = hash(x, y, 55 + i), cx2 = r % 15, cy2 = 3 + (r >> 4) % 9; P(c[3], cx2, cy2, 1, 2 + (r >> 9) % 3); }
      if (h % 3 === 0) { const r = hash(x, y, 58); P(c[1], r % 10, 6 + (r >> 4) % 5, 5, 3); P(c[2], r % 10, 6 + (r >> 4) % 5, 4, 1); }
      if (h % 5 === 0) { const r = hash(x, y, 59); P('#5c8a3a', r % 13, 4 + (r >> 4) % 8, 2, 1); P('#6e9e44', (r % 13) + 1, 3 + (r >> 4) % 8, 1, 1); } // 바위틈 풀
      if (T(x, y - 1) !== T_WALL) { // 위 가장자리: 풀이 덮는다
        const top = Gd(x, y - 1), lip = top === G.SNOW ? PAL.snow : top === G.ROCK ? PAL.rock : PAL.grass;
        P(OL, 0, 0, 16, 1); P(lip[0], 0, 1, 16, 2);
        for (let i = 0; i < 16; i++) { const r = hash(x, y, 100 + i); if (r % 3) P(lip[3], i, 3, 1, 1 + (r % 2)); }
      }
      if (lower) { P(c[3], 0, 14, 16, 2); P(OL, 0, 15, 16, 1); }
      else P('rgba(0,0,0,0.08)', 0, 10, 16, 6);
      if (open(x - 1, y)) { P(c[3], 0, 0, 2, 16); P(OL, 0, 2, 1, 14); }
      if (open(x + 1, y)) { P(c[3], 14, 0, 2, 16); P(OL, 15, 2, 1, 14); }
    } else {
      // 절벽 윗면 (안쪽): 위층 땅색 + 가장자리 테두리
      const top = Gd(x, y), lip = top === G.SNOW ? PAL.snow : top === G.ROCK ? PAL.rock : PAL.grass;
      P(lip[0], 0, 0, 16, 16); speck([lip[2], lip[3]], 5, 20);
      if (open(x - 1, y)) { P(c[2], 0, 0, 2, 16); P(OL, 0, 0, 1, 16); }
      if (open(x + 1, y)) { P(c[2], 14, 0, 2, 16); P(OL, 15, 0, 1, 16); }
      if (open(x, y - 1)) { P(c[2], 0, 0, 16, 2); P(OL, 0, 0, 16, 1); }
    }
  }
  function boulder() {
    P('rgba(0,0,0,0.25)', 2, 12, 13, 3);
    P(OL, 1, 2, 14, 12); P('#8a8a7e', 2, 3, 12, 10); P('#a4a496', 3, 3, 8, 3); P('#6a6a60', 2, 10, 12, 3);
    P(OL, 7, 3, 1, 4); P(OL, 6, 6, 1, 3); P(OL, 7, 8, 1, 4); P(OL, 3, 7, 3, 1); P(OL, 9, 9, 3, 1);
    P('rgba(255,220,140,0.6)', 8, 4, 1, 2); P('rgba(255,220,140,0.6)', 8, 9, 1, 2);
  }
}

// ───── 큰 소품 ─────
const sprites = new Map();
function canvas(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); f(g); return c; }
function disc(g, cx, cy, r, col) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
// 나무 그림 (종류 · 변형마다 한 번만 그려 둔다)
function treeSprite(kind, v, burnt) {
  const key = `${kind}${v}${burnt}`;
  if (sprites.has(key)) return sprites.get(key);
  const W = 40, H = 56;
  const c = canvas(W, H, (g) => {
    g.imageSmoothingEnabled = false;
    const tx = 20, base = 54;
    const trunk = kind === 'birch' ? ['#e8e4d8', '#b8b2a4'] : ['#7a5232', '#5a3a22'];
    if (burnt) { trunk[0] = '#3a3028'; trunk[1] = '#241c16'; }
    g.fillStyle = OL; g.fillRect(tx - 4, base - 18, 8, 18);
    g.fillStyle = trunk[0]; g.fillRect(tx - 3, base - 18, 6, 17); g.fillStyle = trunk[1]; g.fillRect(tx + 1, base - 18, 2, 17);
    if (kind === 'birch' && !burnt) { g.fillStyle = '#3a3630'; g.fillRect(tx - 2, base - 12, 2, 1); g.fillRect(tx, base - 7, 2, 1); }
    g.fillStyle = trunk[1]; g.fillRect(tx - 5, base - 2, 3, 2); g.fillRect(tx + 2, base - 2, 3, 2); // 뿌리
    if (burnt) { g.fillStyle = OL; g.fillRect(tx - 1, base - 30, 3, 13); g.fillRect(tx - 8, base - 26, 8, 2); g.fillRect(tx + 2, base - 28, 7, 2); g.fillStyle = '#3a3028'; g.fillRect(tx, base - 29, 1, 11); return; }
    if (kind === 'pine') {
      const cols = ['#2a5a34', '#346a3c', '#4a8248', '#1e4628'];
      for (let k = 0; k < 4; k++) {
        const w = 15 - k * 3, y = base - 14 - k * 9;
        g.fillStyle = OL; g.beginPath(); g.moveTo(tx - w - 1, y + 1); g.lineTo(tx, y - 13); g.lineTo(tx + w + 1, y + 1); g.closePath(); g.fill();
        g.fillStyle = cols[0]; g.beginPath(); g.moveTo(tx - w, y); g.lineTo(tx, y - 12); g.lineTo(tx + w, y); g.closePath(); g.fill();
        g.fillStyle = cols[3]; g.fillRect(tx - w + 2, y - 2, w * 2 - 4, 2);
        g.fillStyle = cols[2]; g.fillRect(tx - 3, y - 9, 3, 3); g.fillRect(tx - w + 4, y - 3, 3, 1);
      }
      return;
    }
    const cols = kind === 'birch' ? ['#8ab84a', '#9ac858', '#c4e27a', '#5e8c34'] : v % 2 ? ['#4a8a34', '#56983c', '#86c454', '#336824'] : ['#5a9a3a', '#66a844', '#9ad25e', '#3e7a2c'];
    const blobs = [[0, -30, 13], [-9, -24, 10], [9, -24, 10], [-5, -36, 9], [6, -35, 9], [0, -21, 9]];
    for (const [bx, by, r] of blobs) disc(g, tx + bx, base + by, r + 1, OL);
    for (const [bx, by, r] of blobs) disc(g, tx + bx, base + by, r, cols[3]);
    for (const [bx, by, r] of blobs) disc(g, tx + bx - 1, base + by - 1.5, r - 2, cols[0]);
    for (const [bx, by, r] of blobs) disc(g, tx + bx - 3, base + by - 3, r * 0.45, cols[1]);
    g.fillStyle = cols[2];
    for (let i = 0; i < 9; i++) { const r = hash(v, i, 5); g.fillRect(tx - 10 + (r % 18), base - 40 + ((r >> 5) % 18), 2, 1); }
    if (kind !== 'birch' && v === 3) { g.fillStyle = '#e83a3a'; for (const [ax, ay] of [[-6, -26], [5, -31], [2, -22]]) { g.fillRect(tx + ax, base + ay, 2, 2); } } // 사과
  });
  sprites.set(key, c);
  return c;
}

export function drawOutdoorProp(g, pr, t, night, burntTrees) {
  const x = pr.x * TILE, y = pr.y * TILE;
  if (pr.kind === 'tree') {
    const s = treeSprite(pr.tree, pr.v, burntTrees?.has(`${pr.x},${pr.y}`));
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x + 8, y + 14, 10, 4, 0, 0, Math.PI * 2); g.fill();
    // 바람에 살짝 흔들린다 (꼭대기만)
    const sway = Math.round(Math.sin(t * 1.3 + pr.x * 0.7 + pr.y) * 0.7);
    g.drawImage(s, 0, 0, 40, 34, x + 8 - 20 + sway, y + 16 - 56, 40, 34);
    g.drawImage(s, 0, 34, 40, 22, x + 8 - 20, y + 16 - 22, 40, 22);
    return;
  }
  if (pr.kind === 'house') {
    const W = pr.w * TILE, H = pr.h * TILE, bx = x, by = y + H; // 바닥선
    const wallH = 30, roofH = 30;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(bx + 2, by - 2, W, 5);
    g.fillStyle = OL; g.fillRect(bx - 1, by - wallH - 1, W + 2, wallH + 2);
    g.fillStyle = '#e8dcc0'; g.fillRect(bx, by - wallH, W, wallH);
    g.fillStyle = '#7a5434'; for (const k of [0, W / 2 - 2, W - 4]) g.fillRect(bx + k, by - wallH, 4, wallH); g.fillRect(bx, by - wallH, W, 3); g.fillRect(bx, by - 4, W, 4); // 나무 뼈대
    g.fillStyle = OL; g.fillRect(bx + W / 2 - 8, by - 20, 16, 20); g.fillStyle = '#5a3a22'; g.fillRect(bx + W / 2 - 7, by - 19, 14, 19); g.fillStyle = '#d8b860'; g.fillRect(bx + W / 2 + 3, by - 10, 2, 2); // 문
    for (const wx of [bx + 10, bx + W - 22]) { g.fillStyle = OL; g.fillRect(wx - 1, by - 23, 14, 12); g.fillStyle = night ? '#ffd27a' : '#8ac8e8'; g.fillRect(wx, by - 22, 12, 10); g.fillStyle = '#7a5434'; g.fillRect(wx + 5, by - 22, 2, 10); g.fillRect(wx, by - 18, 12, 2); }
    // 지붕
    const rc = pr.roof || '#b8483a';
    g.fillStyle = OL; g.beginPath(); g.moveTo(bx - 7, by - wallH + 1); g.lineTo(bx + W / 2, by - wallH - roofH - 1); g.lineTo(bx + W + 7, by - wallH + 1); g.closePath(); g.fill();
    g.fillStyle = rc; g.beginPath(); g.moveTo(bx - 5, by - wallH); g.lineTo(bx + W / 2, by - wallH - roofH + 1); g.lineTo(bx + W + 5, by - wallH); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.22)'; for (let k = 1; k < 5; k++) { const yy = by - wallH - k * 6; const half = (W / 2 + 5) * (1 - (k * 6) / roofH); g.fillRect(bx + W / 2 - half, yy, half * 2, 1); }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(bx - 5, by - wallH); g.lineTo(bx + W / 2, by - wallH - roofH + 1); g.lineTo(bx + W / 2, by - wallH); g.closePath(); g.fill();
    g.fillStyle = OL; g.fillRect(bx + W - 22, by - wallH - 24, 8, 14); g.fillStyle = '#8a6a5a'; g.fillRect(bx + W - 21, by - wallH - 23, 6, 13); // 굴뚝
    if (Math.sin(t * 2 + pr.x) > 0.9) { /* 연기는 렌더러 입자로 */ }
    return;
  }
  if (pr.kind === 'well') {
    const bx = x, by = y + 16;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(bx + 16, by, 15, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = OL; g.fillRect(bx + 1, by - 14, 30, 14); g.fillStyle = '#9a968e'; g.fillRect(bx + 2, by - 13, 28, 12);
    g.fillStyle = '#7a766e'; for (let k = 0; k < 4; k++) g.fillRect(bx + 2 + k * 7, by - 8, 1, 7); g.fillRect(bx + 2, by - 9, 28, 1);
    g.fillStyle = '#2a5a7a'; g.fillRect(bx + 5, by - 13, 22, 3);
    g.fillStyle = OL; g.fillRect(bx + 3, by - 34, 3, 21); g.fillRect(bx + 26, by - 34, 3, 21); g.fillStyle = '#7a5434'; g.fillRect(bx + 4, by - 33, 1, 20); g.fillRect(bx + 27, by - 33, 1, 20);
    g.fillStyle = OL; g.beginPath(); g.moveTo(bx - 2, by - 31); g.lineTo(bx + 16, by - 42); g.lineTo(bx + 34, by - 31); g.closePath(); g.fill();
    g.fillStyle = '#9a4a3a'; g.beginPath(); g.moveTo(bx, by - 32); g.lineTo(bx + 16, by - 41); g.lineTo(bx + 32, by - 32); g.closePath(); g.fill();
    return;
  }
  if (pr.kind === 'caveMouth') {
    const bx = x, by = y + pr.h * TILE, W = pr.w * TILE;
    g.fillStyle = OL; g.beginPath(); g.ellipse(bx + W / 2, by - 6, 22, 20, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#0a0810'; g.beginPath(); g.ellipse(bx + W / 2, by - 4, 18, 17, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#3e3a44'; g.fillRect(bx + W / 2 - 18, by - 5, 36, 5);
    g.fillStyle = '#5c9a3a'; for (let i = 0; i < 8; i++) { const r = hash(i, 9, 2); g.fillRect(bx + W / 2 - 20 + (r % 40), by - 26 + ((r >> 4) % 6), 3, 2 + (r % 4)); } // 늘어진 이끼
    const a = 0.5 + 0.3 * Math.sin(t * 2);
    g.fillStyle = `rgba(90,255,200,${a * 0.4})`; g.fillRect(bx + W / 2 - 2, by - 14, 1, 1); g.fillRect(bx + W / 2 + 5, by - 9, 1, 1);
    return;
  }
  if (pr.kind === 'tower') {
    // 각인의 탑: 고원 한가운데 솟은 돌탑, 몸에 새겨진 문양이 빛난다
    const W = pr.w * TILE, cx = x + W / 2, by = y + pr.h * TILE, H = 200;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, by - 2, W / 2 + 8, 8, 0, 0, Math.PI * 2); g.fill();
    const tiers = [[W / 2 + 4, 0, 46], [W / 2 - 2, 46, 52], [W / 2 - 8, 98, 54], [W / 2 - 14, 152, 40]];
    for (const [hw, y0, hh] of tiers) {
      const top = by - y0 - hh;
      g.fillStyle = OL; g.fillRect(cx - hw - 1, top - 1, hw * 2 + 2, hh + 2);
      g.fillStyle = '#8c8478'; g.fillRect(cx - hw, top, hw * 2, hh);
      g.fillStyle = '#a49c90'; g.fillRect(cx - hw, top, hw * 0.6, hh);
      g.fillStyle = '#6e665c'; g.fillRect(cx + hw * 0.55, top, hw * 0.45, hh);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 8; k < hh; k += 9) g.fillRect(cx - hw, top + k, hw * 2, 1);
      for (let k = 0; k < hh; k += 9) for (let j = ((k / 9) % 2) * 6; j < hw * 2; j += 12) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - hw + j, top + k, 1, 8); }
      g.fillStyle = OL; g.fillRect(cx - hw - 3, top - 1, hw * 2 + 6, 4); g.fillStyle = '#b4aca0'; g.fillRect(cx - hw - 2, top, hw * 2 + 4, 2); // 턱
      // 빛나는 문양
      const a = 0.45 + 0.35 * Math.sin(t * 1.6 + y0 * 0.05);
      g.fillStyle = `rgba(120,255,220,${a})`;
      g.fillRect(cx - 2, top + 8, 4, hh - 16); g.fillRect(cx - 8, top + hh / 2, 16, 2);
      g.fillRect(cx - hw + 5, top + 10, 2, 6); g.fillRect(cx + hw - 7, top + 10, 2, 6);
    }
    // 문 (아래 가운데, 아치)
    g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 10, by); g.lineTo(cx - 10, by - 20); g.quadraticCurveTo(cx, by - 32, cx + 10, by - 20); g.lineTo(cx + 10, by); g.fill();
    g.fillStyle = '#16121c'; g.beginPath(); g.moveTo(cx - 8, by); g.lineTo(cx - 8, by - 19); g.quadraticCurveTo(cx, by - 29, cx + 8, by - 19); g.lineTo(cx + 8, by); g.fill();
    g.fillStyle = `rgba(120,255,220,${0.3 + 0.2 * Math.sin(t * 2)})`; g.fillRect(cx - 6, by - 4, 12, 4);
    // 꼭대기의 빛
    const topY = by - H + 6, pulse = 0.55 + 0.45 * Math.sin(t * 2.2);
    g.fillStyle = OL; g.fillRect(cx - 5, topY - 4, 10, 12);
    g.fillStyle = '#d8fff0'; g.fillRect(cx - 3, topY - 2, 6, 8);
    const grd = g.createRadialGradient(cx, topY + 2, 1, cx, topY + 2, 30);
    grd.addColorStop(0, `rgba(200,255,240,${0.7 * pulse})`); grd.addColorStop(1, 'rgba(120,255,220,0)');
    g.fillStyle = grd; g.fillRect(cx - 30, topY - 28, 60, 60);
    return;
  }
}

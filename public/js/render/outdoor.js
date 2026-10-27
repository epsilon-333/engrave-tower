// 바깥 세계 그림: 땅 타일(풀 · 흙 · 모래 · 물 · 용암 · 늪 · 절벽 …)과 큰 소품(나무 · 집 · 탑 · 성지 · 입구)을 픽셀로 직접 그린다.
// 세계가 커서 16×16칸 조각마다 따로 그리고(렌더러가 보이는 조각만), 불에 타거나 얼면 그 칸만 다시 그린다.
import { PixelCtx } from './pixelctx.js';
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD, T_DEEP } from '../sim/mapgen.js';
import { G } from '../data/maps/overworld.js';
import { SB } from '../data/maps/seabed.js';
import { hash, drawDeco } from './tiles.js';
import { drawLandmark } from './landmarks.js';
import { drawVillageProp } from './villageprops.js';
import { drawCapitalProp } from './capitalprops.js';
import { drawStump } from './lifefx.js';

const OL = '#1a1410';
const PAL = {
  grass: ['#5d9e3b', '#67a842', '#8cc95a', '#457f2e'], forest: ['#3d6b2f', '#467634', '#5c8c3e', '#2c5224'],
  dirt: ['#a8834f', '#b48e58', '#cdb38a', '#8a6a3e'], sand: ['#e4d29a', '#d8c486', '#f4ecd0', '#c4ae74'],
  rock: ['#8a9076', '#969c82', '#b6baa4', '#6e745e'], snow: ['#eef4f8', '#e2eaf2', '#ffffff', '#c4d4e4'],
  stone: ['#a9a59f', '#b6b2ab', '#c8c4bc', '#7e7a74'], burnt: ['#3a3028', '#44382e', '#6a645c', '#241c16'],
  ice: ['#c4ecf8', '#d6f2fc', '#ffffff', '#8cc8e0'], bridge: ['#9a6a3c', '#b07c48', '#c89460', '#4a3018'],
  ash: ['#6e6866', '#7a7472', '#9a9490', '#4e4848'], blackrock: ['#3e383a', '#48424a', '#6a6268', '#262224'],
  redsand: ['#c87a4a', '#d48a56', '#e8b07a', '#a05a34'], cracked: ['#b08a5a', '#bc9664', '#d0b088', '#7a5a36'],
  mud: ['#5e4c34', '#685640', '#86745a', '#463826'], deadgrass: ['#8a8458', '#968e62', '#b0a87a', '#6a6440'],
  jungle: ['#2f6a2a', '#357632', '#4e9a40', '#1e4a1c'], cobble: ['#8a8680', '#9a958e', '#b8b2aa', '#5e5a56'],
  obsidian: ['#2a2232', '#34283e', '#6a5a8a', '#140e1a'],
  shallow: ['#4aa6c6', '#56b2d0', '#a8e4f4'], deep: ['#2c74a4', '#3280b0', '#6ab8dc'],
  lava: ['#e8501a', '#ff7a2a', '#ffd25a'], lavaDeep: ['#c8381a', '#e85020', '#ffb04a'], bog: ['#4e5a2a', '#58662e', '#8a9a4a'], bogDeep: ['#3a4620', '#424e24', '#6a7a3a'],
};
// 절벽 색 (그 칸의 땅 종류로)
const CLIFF = {
  default: ['#857a6c', '#968b7b', '#bab09c', '#5a5046'], red: ['#a8583a', '#b86a46', '#d8946a', '#6e3420'],
  basalt: ['#3a3438', '#46404a', '#6a6270', '#1e1a1e'], icy: ['#9aaabb', '#aabaca', '#dce8f2', '#6a7a8c'], ruin: ['#7a766e', '#8a857c', '#aaa498', '#4e4a44'],
};
const GROUND_PAL = {
  [G.FOREST]: PAL.forest, [G.DIRT]: PAL.dirt, [G.SAND]: PAL.sand, [G.ROCK]: PAL.rock, [G.SNOW]: PAL.snow, [G.STONE]: PAL.stone, [G.BURNT]: PAL.burnt,
  [G.ICE]: PAL.ice, [G.THIN]: PAL.ice, [G.BRIDGE]: PAL.bridge, [G.ASH]: PAL.ash, [G.BLACKROCK]: PAL.blackrock, [G.REDSAND]: PAL.redsand, [G.CRACKED]: PAL.cracked,
  [G.MUD]: PAL.mud, [G.DEADGRASS]: PAL.deadgrass, [G.JUNGLE]: PAL.jungle, [G.COBBLE]: PAL.cobble, [G.OBSIDIAN]: PAL.obsidian, [G.STAIRS]: PAL.stone,
};
const grassy = (g) => g === G.GRASS || g === G.TALL || g === G.FLOWER || g === G.FOREST || g === G.JUNGLE || g === G.DEADGRASS;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const rgbCache = new Map();
const rgb = (h) => { let v = rgbCache.get(h); if (!v) { v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; rgbCache.set(h, v); } return v; };
// 값 노이즈(격자 값 사이를 부드럽게 보간)를 칸 하나(16×16)에: 필요한 격자 값과 줄 · 칸별 보간 비율을 먼저 구해 두고 픽셀은 섞기만 한다
const LAT = new Float64Array(32), NX = new Int32Array(16), NU = new Float64Array(16), NY = new Int32Array(16), NV = new Float64Array(16), ACC = new Float64Array(256);
const BAYER_OFF = BAYER.map((b) => ((b + 0.5) / 16) * 0.16 - 0.08);
function noiseInto(px, py, sc, salt, wgt) {
  const x0 = Math.floor(px / sc), y0 = Math.floor(py / sc), x1 = Math.floor((px + 15) / sc) + 1, y1 = Math.floor((py + 15) / sc) + 1, nx = x1 - x0 + 1, v = LAT;
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) v[(j - y0) * nx + (i - x0)] = hash(i, j, salt) / 4294967296;
  for (let k = 0; k < 16; k++) {
    const fx = (px + k) / sc, xi = Math.floor(fx), u = fx - xi, fy = (py + k) / sc, yi = Math.floor(fy), w = fy - yi;
    NX[k] = xi - x0; NU[k] = u * u * (3 - 2 * u); NY[k] = (yi - y0) * nx; NV[k] = w * w * (3 - 2 * w);
  }
  for (let y = 0; y < 16; y++) {
    const ro = NY[y], fv = NV[y];
    for (let x = 0; x < 16; x++) {
      const o = ro + NX[x], fu = NU[x], top = v[o] + (v[o + 1] - v[o]) * fu, bot = v[o + nx] + (v[o + nx + 1] - v[o + nx]) * fu;
      ACC[y * 16 + x] += (top + (bot - top) * fv) * wgt;
    }
  }
}
// 칸 바탕: 픽셀마다 넓은 얼룩 노이즈 → 3단 색, 경계는 바이어 디더링 (도트 느낌을 살린 부드러운 변화)
// d: 픽셀 배열, W: 그 폭, lx · ly: 배열 안에서 이 칸이 시작하는 곳
function noisePixels(d, W, lx, ly, px, py, cols, salt) {
  const c0 = rgb(cols[0]), c1 = rgb(cols[1]), c2 = rgb(cols[2]);
  ACC.fill(0); noiseInto(px, py, 46, salt, 0.7); noiseInto(px, py, 13, salt + 9, 0.3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = ACC[y * 16 + x] + BAYER_OFF[(y & 3) * 4 + (x & 3)], cc = v < 0.42 ? c2 : v < 0.6 ? c0 : c1, o = ((ly + y) * W + lx + x) * 4;
    d[o] = cc[0]; d[o + 1] = cc[1]; d[o + 2] = cc[2]; d[o + 3] = 255;
  }
}
function baseFill(g, px, py, cols, salt, ox, oy) {
  if (g.pix) { noisePixels(g.d, g.w, px - g.ox, py - g.oy, px, py, cols, salt); return; }
  const img = g.createImageData(16, 16);
  noisePixels(img.data, 16, 0, 0, px, py, cols, salt);
  g.putImageData(img, px - ox, py - oy); // putImageData는 변환을 무시한다 → 조각 기준 위치로
}

// 조각 전체를 픽셀 배열에 직접 그린다 (작은 fillRect 수만 번보다 훨씬 빠르다). 색은 '#rrggbb' 또는 'rgba(r,g,b,a)'
const colCache = new Map();
function parseCol(col) {
  let c = colCache.get(col);
  if (!c) {
    if (col[0] === '#') c = [...rgb(col), 1];
    else { const m = col.match(/[\d.]+/g).map(Number); c = [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; }
    colCache.set(col, c);
  }
  return c;
}
class PixBuf {
  constructor(w, h, ox, oy) { this.pix = true; this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.img = new ImageData(w, h); this.d = this.img.data; }
  rect(col, x, y, ww, hh) {
    const [r, gg, b, a] = parseCol(col), d = this.d, W = this.w;
    const x0 = Math.max(0, Math.round(x - this.ox)), y0 = Math.max(0, Math.round(y - this.oy));
    const x1 = Math.min(W, Math.round(x - this.ox + ww)), y1 = Math.min(this.h, Math.round(y - this.oy + hh));
    if (a >= 1) {
      for (let yy = y0; yy < y1; yy++) for (let xx = x0, o = (yy * W + x0) * 4; xx < x1; xx++, o += 4) { d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255; }
      return;
    }
    for (let yy = y0; yy < y1; yy++) for (let xx = x0, o = (yy * W + x0) * 4; xx < x1; xx++, o += 4) { // source-over
      const ad = d[o + 3] / 255, k = ad * (1 - a), ao = a + k;
      if (ao <= 0) continue;
      d[o] = (r * a + d[o] * k) / ao; d[o + 1] = (gg * a + d[o + 1] * k) / ao; d[o + 2] = (b * a + d[o + 2] * k) / ao; d[o + 3] = ao * 255;
    }
  }
}

// 칸 하나 그리기 (주변 칸을 보고 가장자리를 섞는다). ox, oy: 이 캔버스가 세계에서 시작하는 위치(px)
export function paintTile(g, w, x, y, ox = 0, oy = 0) {
  const { tw, th } = w, m = w.map;
  const T = (xx, yy) => (xx < 0 || yy < 0 || xx >= tw || yy >= th ? T_DEEP : w.tiles[yy * tw + xx]);
  const Gd = (xx, yy) => (xx < 0 || yy < 0 || xx >= tw || yy >= th ? G.SAND : m.ground[yy * tw + xx]);
  const t = T(x, y), gr = Gd(x, y), px = x * TILE, py = y * TILE, h = hash(x, y, 7);
  const P = g.pix ? (col, dx, dy, ww = 1, hh = 1) => g.rect(col, px + dx, py + dy, ww, hh) : (col, dx, dy, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(px + dx, py + dy, ww, hh); };
  const speck = (cols, n, salt) => { for (let i = 0; i < n; i++) { const r = hash(x, y, salt + i); P(cols[r % cols.length], r % 16, (r >>> 5) % 16, 1 + ((r >>> 9) & 1), 1); } };
  const blob = ((hash(x >> 2, y >> 2, 3) % 100) + (hash((x + 2) >> 2, (y + 1) >> 2, 3) % 100)) / 200;

  if (m.underwater) { seabedTile(g, w, x, y, ox, oy); return; }
  if (t === T_DEEP || t === T_LIQUID) { liquid(); return; }
  if (t === T_WALL) { cliff(); return; }
  ground(gr);
  if (t === T_CRACK) boulder();
  if (T(x, y - 1) === T_WALL || T(x, y - 1) === T_CRACK) { P('rgba(0,0,0,0.28)', 0, 0, 16, 3); P('rgba(0,0,0,0.14)', 0, 3, 16, 2); }
  if (T(x - 1, y) === T_WALL) P('rgba(0,0,0,0.15)', 0, 0, 2, 16);

  function liquid() {
    const lava = gr === G.LAVA, bog = gr === G.BOG, deep = t === T_DEEP;
    const pal = lava ? (deep ? PAL.lavaDeep : PAL.lava) : bog ? (deep ? PAL.bogDeep : PAL.bog) : deep ? PAL.deep : PAL.shallow;
    P(blob > 0.5 ? pal[1] : pal[0], 0, 0, 16, 16);
    if (lava) { // 용암: 식은 껍질 사이로 밝은 금
      for (let i = 0; i < 3; i++) { const r = hash(x, y, 140 + i); P('#7a2a14', r % 12, (r >>> 4) % 13, 4 + (r >>> 8) % 3, 2); }
      for (let i = 0; i < 3; i++) { const r = hash(x, y, 150 + i); P(pal[2], r % 13, 1 + (r >>> 4) % 14, 3, 1); }
    } else if (bog) { // 늪: 거품 · 떠다니는 풀
      for (let i = 0; i < 2; i++) { const r = hash(x, y, 160 + i); P('#9aaa5a', r % 13, (r >>> 4) % 13, 2, 2); P('#6a7a3a', (r % 13) + 1, (r >>> 4) % 13 + 1, 1, 1); }
      for (let i = 0; i < 2; i++) { const r = hash(x, y, 170 + i); P(pal[2], r % 12, 2 + (r >>> 4) % 12, 3, 1); }
    } else for (let i = 0; i < 2; i++) { const r = hash(x, y, 40 + i); P(pal[2], r % 11, 2 + (r >>> 4) % 12, 3 + (r >>> 9) % 4, 1); }
    const shore = (xx, yy) => { const tt = T(xx, yy); return tt !== T_DEEP && tt !== T_LIQUID && !(tt === T_FLOOR && (Gd(xx, yy) === G.ICE || Gd(xx, yy) === G.THIN || Gd(xx, yy) === G.OBSIDIAN)); };
    if (deep) for (const [dx, dy, ex, ey, ew, eh] of [[0, -1, 0, 0, 16, 2], [0, 1, 0, 14, 16, 2], [-1, 0, 0, 0, 2, 16], [1, 0, 14, 0, 2, 16]]) if (T(x + dx, y + dy) === T_LIQUID) P((lava ? PAL.lava : bog ? PAL.bog : PAL.shallow)[0], ex, ey, ew, eh);
    const foam = lava ? 'rgba(40,16,8,0.85)' : bog ? 'rgba(60,70,30,0.7)' : 'rgba(255,255,255,0.75)';
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!shore(x + dx, y + dy)) continue;
      for (let i = 0; i < 16; i++) {
        const r = hash(x * 3 + dx, y * 3 + dy, i), len = 1 + (r % 3);
        if (dy === -1) P(foam, i, 0, 1, len); if (dy === 1) P(foam, i, 16 - len, 1, len);
        if (dx === -1) P(foam, 0, i, len, 1); if (dx === 1) P(foam, 16 - len, i, len, 1);
      }
    }
    if (shore(x, y - 1)) P('rgba(0,0,0,0.18)', 0, 2, 16, 2);
  }

  function ground(gg) {
    if (gg === G.GRASS || gg === G.TALL || gg === G.FLOWER) {
      const p = PAL.grass;
      baseFill(g, px, py, [p[0], p[1], '#548f35'], 1, ox, oy);
      speck([p[2], p[3], p[2]], 6, 10);
      for (let i = 0; i < 3; i++) { const r = hash(x, y, 30 + i), bx = r % 14, by = 3 + (r >>> 4) % 11; P(p[3], bx, by, 1, 2); P(p[2], bx + 1, by - 1, 1, 2); }
      if (gg === G.FLOWER) for (let i = 0; i < 2 + (h % 2); i++) {
        const r = hash(x, y, 60 + i), fx = 2 + r % 11, fy = 3 + (r >>> 4) % 10, col = ['#ffffff', '#ffe05a', '#ff9ac0', '#9ac8ff'][(r >>> 8) % 4];
        P('#3a7a2a', fx, fy + 1, 1, 2); P(col, fx - 1, fy, 3, 1); P(col, fx, fy - 1, 1, 3); P('#ffd040', fx, fy, 1, 1);
      }
      if (gg === G.TALL) tuft(p[3], ['#4e8a30', '#86c652', '#b4e070']);
      return;
    }
    const pal = GROUND_PAL[gg] || PAL.grass;
    const noiseFill = [G.FOREST, G.SAND, G.DIRT, G.ROCK, G.SNOW, G.BURNT, G.ASH, G.BLACKROCK, G.REDSAND, G.CRACKED, G.MUD, G.DEADGRASS, G.JUNGLE].includes(gg);
    if (noiseFill) baseFill(g, px, py, [pal[0], pal[1], pal[3]], 2 + gg, ox, oy); else P(blob > 0.55 ? pal[1] : pal[0], 0, 0, 16, 16);
    if (gg === G.STONE || gg === G.COBBLE) {
      if (gg === G.STONE) for (let r = 0; r < 4; r++) { P(pal[3], 0, r * 4 + 3, 16, 1); const off = (r + y) % 2 ? 0 : 4; for (let k = off; k < 16; k += 8) P(pal[3], k, r * 4, 1, 3); }
      else for (let i = 0; i < 5; i++) { const r = hash(x, y, 120 + i), cx = (i % 3) * 5 + (r % 3), cy = Math.floor(i / 3) * 7 + (r >>> 3) % 4; P(OL, cx, cy, 5, 4); P(pal[1], cx, cy, 4, 3); P(pal[2], cx, cy, 3, 1); } // 둥근 자갈
      speck([pal[2]], 3, 12);
    } else if (gg === G.STAIRS) { // 돌계단: 가로 단 + 그늘
      P(pal[1], 0, 0, 16, 16);
      for (let k = 0; k < 4; k++) { P(pal[2], 0, k * 4, 16, 1); P(pal[3], 0, k * 4 + 3, 16, 1); }
      P('rgba(0,0,0,0.25)', 0, 0, 1, 16); P('rgba(0,0,0,0.25)', 15, 0, 1, 16);
    } else if (gg === G.BRIDGE) {
      const br = (xx, yy) => T(xx, yy) === T_FLOOR && Gd(xx, yy) === G.BRIDGE, vertical = br(x, y - 1) || br(x, y + 1);
      for (let k = 0; k < 4; k++) { if (vertical) { P(k % 2 ? pal[1] : pal[0], 0, k * 4, 16, 3); P(pal[3], 0, k * 4 + 3, 16, 1); } else { P(k % 2 ? pal[1] : pal[0], k * 4, 0, 3, 16); P(pal[3], k * 4 + 3, 0, 1, 16); } }
      const water = (xx, yy) => T(xx, yy) === T_DEEP || T(xx, yy) === T_LIQUID;
      if (water(x - 1, y)) { P(OL, 0, 0, 2, 16); P('#6a4426', 0, 0, 1, 16); } if (water(x + 1, y)) { P(OL, 14, 0, 2, 16); P('#6a4426', 15, 0, 1, 16); }
      if (water(x, y - 1)) { P(OL, 0, 0, 16, 2); P('#6a4426', 0, 1, 16, 1); } if (water(x, y + 1)) { P(OL, 0, 14, 16, 2); P('#6a4426', 0, 14, 16, 1); }
    } else if (gg === G.THIN) {
      P('#8ccbe2', 0, 0, 16, 16); speck(['#c4ecf8', '#a8dcf0'], 10, 12);
      for (let i = 0; i < 3; i++) { const r = hash(x, y, 95 + i); P('#3a86b0', r % 14, (r >>> 4) % 14, 3 + (r >>> 8) % 3, 2); }
      const r = hash(x, y, 98); P('#ffffff', 1 + r % 6, 3, 7, 1); P('#ffffff', 7, 3, 1, 6); P('#ffffff', 7, 9, 6, 1); P('#ffffff', 3, 9, 1, 5);
    } else if (gg === G.ICE) {
      speck([pal[2], pal[1]], 4, 12);
      const r = hash(x, y, 90); P(pal[3], r % 8, 4, 6, 1); P(pal[3], 6 + r % 6, 5, 1, 4); P(pal[2], 2, 2, 4, 1);
    } else if (gg === G.OBSIDIAN) {
      speck([pal[2]], 3, 12); const r = hash(x, y, 91); P(pal[3], r % 9, 5, 6, 1); P(pal[2], 3 + r % 8, 3, 3, 1);
      P('rgba(255,120,40,0.35)', (r >>> 4) % 13, 10, 3, 1);
    } else if (gg === G.CRACKED) { // 갈라진 땅
      speck([pal[2]], 4, 12);
      const r = hash(x, y, 93); P(pal[3], r % 6, 3, 6, 1); P(pal[3], 5 + r % 6, 3, 1, 5); P(pal[3], 5 + r % 6, 8, 7, 1); P(pal[3], 2, 9 + r % 4, 4, 1);
    } else if (gg === G.ASH || gg === G.BLACKROCK) {
      speck([pal[2], pal[3]], 6, 12);
      if (h % 7 === 0) { const r = hash(x, y, 94); P('#ff7a2a', r % 14, (r >>> 4) % 14, 1, 1); } // 불씨
    } else if (gg === G.DEADGRASS || gg === G.JUNGLE) {
      speck([pal[2], pal[3]], 6, 12);
      for (let i = 0; i < 3; i++) { const r = hash(x, y, 30 + i), bx = r % 14, by = 3 + (r >>> 4) % 11; P(pal[3], bx, by, 1, 2); P(pal[2], bx + 1, by - 1, 1, 2); }
    } else if (gg === G.MUD) {
      speck([pal[2], pal[3]], 5, 12);
      if (h % 3 === 0) { const r = hash(x, y, 95); P('#4a5a2a', r % 11, (r >>> 4) % 12, 5, 2); P('#6a7a3a', r % 11 + 1, (r >>> 4) % 12, 2, 1); } // 물웅덩이
    } else if (gg === G.FOREST) {
      speck([pal[2], pal[3], '#6a5a2a'], 8, 12);
    } else {
      speck([pal[2], pal[3]], gg === G.SAND || gg === G.REDSAND ? 5 : 7, 12);
      if (gg === G.DIRT && h % 3 === 0) { const r = hash(x, y, 91); P(pal[3], r % 13, (r >>> 4) % 13, 3, 2); P(pal[2], r % 13, (r >>> 4) % 13, 2, 1); }
      if (gg === G.ROCK && h % 4 === 0) { const r = hash(x, y, 92), sx = 2 + r % 10, sy = 3 + (r >>> 4) % 9; P(OL, sx - 1, sy - 1, 6, 5); P('#a8ac96', sx, sy, 4, 3); P('#c8ccb6', sx, sy, 2, 1); }
      if (gg === G.SNOW) { const r = hash(x, y, 93); P(pal[3], r % 12, (r >>> 4) % 12, 4, 1); }
      if (gg === G.REDSAND) { const r = hash(x, y, 96); P(pal[3], 0, 4 + r % 8, 16, 1); P(pal[2], 0, 3 + r % 8, 16, 1); } // 모래 물결
    }
    // 풀이 맞닿은 가장자리는 풀이 삐져나온다
    if (gg !== G.BRIDGE && gg !== G.STAIRS && !grassy(gg) && gg !== G.ICE && gg !== G.THIN && gg !== G.OBSIDIAN) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const ng = Gd(x + dx, y + dy);
        if (!grassy(ng) || (T(x + dx, y + dy) !== T_FLOOR && T(x + dx, y + dy) !== T_BUILD)) continue;
        const gc = GROUND_PAL[ng] || PAL.grass;
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
  function tuft(base, cols) { // 키 큰 풀: 풀잎이 부채꼴로 모인 덤불
    const n = 2 + (h % 2);
    for (let i = 0; i < n; i++) {
      const r = hash(x, y, 80 + i), cx = 3 + (r % 10), bs = 9 + ((r >>> 4) % 6);
      P('rgba(0,0,0,0.2)', cx - 3, bs, 7, 2);
      for (let b = -2; b <= 2; b++) {
        const hgt = 6 - Math.abs(b) + ((r >> (6 + b + 2)) & 1);
        for (let k = 0; k < hgt; k++) P(k === hgt - 1 ? cols[2] : k > hgt / 2 ? cols[1] : cols[0], cx + Math.round(b * k / hgt * 1.4), bs - k, 1, 1);
      }
      P(base, cx - 2, bs, 5, 1);
    }
  }
  function cliff() {
    const open = (xx, yy) => { const tt = T(xx, yy); return tt !== T_WALL && tt !== T_CRACK; };
    const c = gr === G.COBBLE ? CLIFF.ruin : gr === G.REDSAND || gr === G.CRACKED ? CLIFF.red : gr === G.BLACKROCK || gr === G.ASH ? CLIFF.basalt : gr === G.SNOW ? CLIFF.icy : CLIFF.default;
    const lower = open(x, y + 1) || T(x, y + 1) === T_DEEP, upper = !lower && (open(x, y + 2) || T(x, y + 2) === T_DEEP) && T(x, y + 1) === T_WALL;
    if (gr === G.COBBLE) { // 폐허의 무너진 돌벽: 벽돌 줄 + 이끼
      P(c[0], 0, 0, 16, 16);
      for (let r = 0; r < 4; r++) { P(c[3], 0, r * 4 + 3, 16, 1); const off = (r + x) % 2 ? 0 : 5; for (let k = off; k < 16; k += 10) P(c[3], k, r * 4, 1, 3); }
      speck([c[2]], 4, 20);
      if (h % 3 === 0) { const r = hash(x, y, 21); P('#5c8a3a', r % 12, 0, 4, 2); P('#4a7a2e', (r % 12) + 1, 2, 2, 2); }
      if (open(x, y - 1)) { P(OL, 0, 0, 16, 1); P(c[2], 0, 1, 16, 1); for (let i = 0; i < 4; i++) { const r = hash(x, y, 22 + i); P(OL, r % 14, 0, 2, 2); } } // 부서진 윗단
      if (lower) { P(c[3], 0, 14, 16, 2); P(OL, 0, 15, 16, 1); }
      if (open(x - 1, y)) P(OL, 0, 0, 1, 16); if (open(x + 1, y)) P(OL, 15, 0, 1, 16);
      return;
    }
    if (lower || upper) {
      P(c[0], 0, 0, 16, 16);
      for (let k = 0; k < 5; k++) { const r = hash(x, y, 50 + k), sx = r % 12, len = 3 + (r >>> 4) % 7, yy = 2 + k * 3 + ((r >>> 8) % 2); P(c[3], sx, yy, len, 1); P(c[2], sx, yy - 1, Math.max(1, len - 2), 1); }
      for (let i = 0; i < 3; i++) { const r = hash(x, y, 55 + i); P(c[3], r % 15, 3 + (r >>> 4) % 9, 1, 2 + (r >>> 9) % 3); }
      if (h % 3 === 0) { const r = hash(x, y, 58); P(c[1], r % 10, 6 + (r >>> 4) % 5, 5, 3); P(c[2], r % 10, 6 + (r >>> 4) % 5, 4, 1); }
      if (gr === G.SNOW && h % 2 === 0) { const r = hash(x, y, 59); P('#ffffff', r % 12, 3 + (r >>> 4) % 8, 3, 1); }
      else if (h % 5 === 0 && c === CLIFF.default) { const r = hash(x, y, 59); P('#5c8a3a', r % 13, 4 + (r >>> 4) % 8, 2, 1); }
      if (T(x, y - 1) !== T_WALL) {
        const top = Gd(x, y - 1), lip = GROUND_PAL[top] || PAL.grass;
        P(OL, 0, 0, 16, 1); P(lip[0], 0, 1, 16, 2);
        for (let i = 0; i < 16; i++) { const r = hash(x, y, 100 + i); if (r % 3) P(lip[3], i, 3, 1, 1 + (r % 2)); }
      }
      if (lower) { P(c[3], 0, 14, 16, 2); P(OL, 0, 15, 16, 1); } else P('rgba(0,0,0,0.08)', 0, 10, 16, 6);
      if (open(x - 1, y)) { P(c[3], 0, 0, 2, 16); P(OL, 0, 2, 1, 14); }
      if (open(x + 1, y)) { P(c[3], 14, 0, 2, 16); P(OL, 15, 2, 1, 14); }
    } else {
      const lip = GROUND_PAL[gr] || PAL.grass;
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

// 조각 하나 (16×16칸) 그리기: 작게 나눠야 한 프레임에 하나씩 그려도 끊기지 않는다
export const CHUNK = 16;
let PB = null; // 픽셀 버퍼는 하나를 돌려 쓴다 (putImageData가 복사하므로)
export function renderChunk(w, cx, cy, decoList) {
  const c = document.createElement('canvas'); c.width = c.height = CHUNK * TILE;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const ox = cx * CHUNK * TILE, oy = cy * CHUNK * TILE, pb = PB ||= new PixBuf(CHUNK * TILE, CHUNK * TILE, 0, 0);
  pb.ox = ox; pb.oy = oy; pb.d.fill(0);
  for (let y = cy * CHUNK; y < Math.min(w.th, (cy + 1) * CHUNK); y++) for (let x = cx * CHUNK; x < Math.min(w.tw, (cx + 1) * CHUNK); x++) paintTile(pb, w, x, y, ox, oy);
  g.putImageData(pb.img, 0, 0);
  g.setTransform(1, 0, 0, 1, -ox, -oy);
  for (const d of decoList || []) drawDeco(g, d);
  return c;
}

// ───── 바닷속 바닥: 모래 물결 · 바위 · 해초 숲 · 산호 · 심해 · 물 밑에서 본 뭍(어두운 바위벽) ─────
const SEA_PAL = {
  [SB.SAND]: ['#c8b48a', '#d6c49c', '#e8dcb8', '#a8946a'], [SB.DEEPSAND]: ['#a0927a', '#ae9e84', '#c4b498', '#827462'],
  [SB.ROCK]: ['#7a8088', '#868c94', '#a0a6ae', '#5c626a'], [SB.KELP]: ['#8e9264', '#9a9e70', '#b4b688', '#6e7248'],
  [SB.CORAL]: ['#d4b49e', '#e0c2ac', '#f0d8c6', '#b4947e'], [SB.TRENCH]: ['#465060', '#505a6a', '#667080', '#323a48'],
  [SB.LAKEBED]: ['#867858', '#928462', '#aa9c78', '#665a40'], [SB.WALL]: ['#222c3c', '#263244', '#2e3a4e', '#1a2232'],
};
function seabedTile(g, w, x, y, ox, oy) {
  const m = w.map, tw = w.tw, th = w.th, px = x * TILE, py = y * TILE;
  const T = (xx, yy) => (xx < 0 || yy < 0 || xx >= tw || yy >= th ? T_WALL : w.tiles[yy * tw + xx]);
  const gr = m.ground[y * tw + x], t = T(x, y), h = hash(x, y, 31);
  const P = g.pix ? (col, dx, dy, ww = 1, hh = 1) => g.rect(col, px + dx, py + dy, ww, hh) : (col, dx, dy, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(px + dx, py + dy, ww, hh); };
  if (t === T_WALL && T(x - 1, y) !== T_WALL && T(x + 1, y) !== T_WALL && T(x, y - 1) !== T_WALL && T(x, y + 1) !== T_WALL) { // 바닥 위 바위 덩이
    const below = m.ground[Math.min(th - 1, y + 1) * tw + x];
    baseFill(g, px, py, SEA_PAL[below] || SEA_PAL[SB.SAND], 23 + (below || 0), ox, oy);
    P('rgba(0,0,0,0.28)', 1, 12, 14, 3);
    const rows = [[5, 6], [3, 10], [2, 12], [1, 14], [1, 14], [1, 14], [2, 12], [2, 12], [3, 10], [4, 8]];
    rows.forEach(([x0, w0], i) => { P('#1a2230', x0 - 1, 2 + i, w0 + 2, 1); });
    rows.forEach(([x0, w0], i) => { P(i < 3 ? '#8a94a4' : i < 7 ? '#6a7484' : '#525a6a', x0, 2 + i, w0, 1); });
    P('#a8b2c0', 4, 3, 3, 1); P('#5a7a4a', 9, 9, 3, 1); P('#7a5a8a', 3, 8, 2, 1);
    return;
  }
  if (t === T_WALL) {
    const cols = SEA_PAL[SB.WALL];
    baseFill(g, px, py, cols, 17, ox, oy);
    for (let i = 0; i < 4; i++) { const r = hash(x, y, 40 + i); P(cols[3], r % 15, (r >>> 5) % 15, 2, 1); }
    if (T(x, y + 1) !== T_WALL) { P(cols[3], 0, 11, 16, 5); P('#56667e', 0, 10, 16, 1); for (let i = 0; i < 3; i++) { const r = hash(x, y, 50 + i); P('#6a7a50', r % 14, 12 + (r >>> 4) % 3, 2, 1); } } // 아래로 트인 면: 바위 벽
    if (T(x, y - 1) !== T_WALL) P('#4e5e78', 0, 0, 16, 2);
    if (h % 7 === 0) { P('#7a5a8a', 4 + h % 6, 6, 2, 2); P('#a87ab8', 5 + h % 6, 6, 1, 1); } // 따개비 · 말미잘
    return;
  }
  const cols = SEA_PAL[gr] || SEA_PAL[SB.SAND];
  baseFill(g, px, py, cols, 23 + gr, ox, oy);
  if (gr === SB.SAND || gr === SB.DEEPSAND || gr === SB.CORAL) { // 모래 물결
    for (let k = 0; k < 2; k++) { const yy = 3 + ((h >>> (k * 4)) % 11), xx = (h >>> (k * 3 + 8)) % 6; for (let i = 0; i < 7; i++) P(cols[3], xx + i, yy + (i % 3 === 1 ? -1 : 0), 1, 1); }
  }
  if (gr === SB.ROCK) for (let i = 0; i < 3; i++) { const r = hash(x, y, 60 + i); P(cols[3], r % 13, (r >>> 6) % 13, 3, 2); P(cols[2], r % 13, (r >>> 6) % 13, 2, 1); }
  if (gr === SB.TRENCH && h % 5 === 0) P('#7a8aa0', h % 14, (h >>> 6) % 14, 1, 1);
  if (T(x, y - 1) === T_WALL) { P('rgba(0,0,0,0.3)', 0, 0, 16, 3); P('rgba(0,0,0,0.15)', 0, 3, 16, 2); }
  if (T(x - 1, y) === T_WALL) P('rgba(0,0,0,0.15)', 0, 0, 2, 16);
  if (T(x + 1, y) === T_WALL) P('rgba(0,0,0,0.12)', 14, 0, 2, 16);
}

// ───── 큰 소품 ─────
const sprites = new Map();
// 나무 같은 미리 그리는 그림도 칸 단위로 (도트 판)
function canvas(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = new PixelCtx(c.getContext('2d')); f(g); return c; }
function disc(g, cx, cy, r, col) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); }
function blobs(g, list, cols) { // 외곽선 · 어두운 면 · 밝은 면 · 반짝임 순서로 둥근 덩어리 묶음
  for (const [x, y, r] of list) disc(g, x, y, r + 1, OL);
  for (const [x, y, r] of list) disc(g, x, y, r, cols[3]);
  for (const [x, y, r] of list) disc(g, x - 1, y - 1.5, r - 2, cols[0]);
  for (const [x, y, r] of list) disc(g, x - 3, y - 3, r * 0.45, cols[1]);
}
// 나무 그림 (종류 · 변형마다 한 번만 그려 둔다)
function treeSprite(kind, v, burnt) {
  const key = `${kind}${v}${burnt}`;
  if (sprites.has(key)) return sprites.get(key);
  const W = 40, H = 56, c = canvas(W, H, (g) => {
    g.imageSmoothingEnabled = false;
    const tx = 20, base = 54;
    const trunkCol = kind === 'birch' ? ['#e8e4d8', '#b8b2a4'] : kind === 'dead' || kind === 'charred' ? ['#5a5048', '#3a3430'] : kind === 'palm' ? ['#a07a4a', '#7a5a32'] : ['#7a5232', '#5a3a22'];
    if (burnt || kind === 'charred') { trunkCol[0] = '#3a3028'; trunkCol[1] = '#241c16'; }
    if (kind === 'cactus') { // 선인장
      const col = ['#4a8a3a', '#5ea04a', '#86c46a', '#2e5e24'];
      const seg = (x, y, w, h) => { g.fillStyle = OL; g.fillRect(x - 1, y - 1, w + 2, h + 2); g.fillStyle = col[0]; g.fillRect(x, y, w, h); g.fillStyle = col[2]; g.fillRect(x + 1, y, 1, h); g.fillStyle = col[3]; g.fillRect(x + w - 2, y, 1, h); };
      seg(tx - 3, base - 30, 6, 30); seg(tx - 11, base - 22, 4, 9); seg(tx - 11, base - 14, 8, 3); seg(tx + 6, base - 26, 4, 11); seg(tx + 3, base - 16, 7, 3);
      g.fillStyle = '#ffe8a8'; for (let i = 0; i < 6; i++) g.fillRect(tx - 2 + (i % 2) * 4, base - 26 + i * 4, 1, 1);
      if (v === 2) { g.fillStyle = '#ff6a8a'; g.fillRect(tx - 1, base - 33, 3, 3); }
      return;
    }
    g.fillStyle = OL; g.fillRect(tx - 4, base - 18, 8, 18);
    g.fillStyle = trunkCol[0]; g.fillRect(tx - 3, base - 18, 6, 17); g.fillStyle = trunkCol[1]; g.fillRect(tx + 1, base - 18, 2, 17);
    if (kind === 'birch' && !burnt) { g.fillStyle = '#3a3630'; g.fillRect(tx - 2, base - 12, 2, 1); g.fillRect(tx, base - 7, 2, 1); }
    g.fillStyle = trunkCol[1]; g.fillRect(tx - 5, base - 2, 3, 2); g.fillRect(tx + 2, base - 2, 3, 2);
    if (burnt || kind === 'charred' || kind === 'dead') { // 앙상한 가지
      const bc = burnt || kind === 'charred' ? '#2a221c' : '#4a423a';
      g.fillStyle = OL;
      g.fillRect(tx - 1, base - 34, 3, 17); g.fillRect(tx - 10, base - 28, 10, 2); g.fillRect(tx + 2, base - 31, 9, 2); g.fillRect(tx - 11, base - 34, 2, 7); g.fillRect(tx + 9, base - 37, 2, 7); g.fillRect(tx - 5, base - 38, 2, 6);
      g.fillStyle = bc; g.fillRect(tx, base - 33, 1, 15); g.fillRect(tx - 9, base - 28, 8, 1); g.fillRect(tx + 3, base - 31, 7, 1); g.fillRect(tx - 10, base - 33, 1, 5); g.fillRect(tx + 10, base - 36, 1, 5);
      if (kind === 'dead' && v % 2) { g.fillStyle = '#5a6a3a'; g.fillRect(tx + 8, base - 33, 2, 4); g.fillRect(tx - 9, base - 31, 2, 3); } // 늘어진 이끼
      return;
    }
    if (kind === 'pine' || kind === 'snowpine') {
      const cols = ['#2a5a34', '#346a3c', '#4a8248', '#1e4628'];
      for (let k = 0; k < 4; k++) {
        const w = 15 - k * 3, y = base - 14 - k * 9;
        g.fillStyle = OL; g.beginPath(); g.moveTo(tx - w - 1, y + 1); g.lineTo(tx, y - 13); g.lineTo(tx + w + 1, y + 1); g.closePath(); g.fill();
        g.fillStyle = cols[0]; g.beginPath(); g.moveTo(tx - w, y); g.lineTo(tx, y - 12); g.lineTo(tx + w, y); g.closePath(); g.fill();
        g.fillStyle = cols[3]; g.fillRect(tx - w + 2, y - 2, w * 2 - 4, 2);
        g.fillStyle = cols[2]; g.fillRect(tx - 3, y - 9, 3, 3); g.fillRect(tx - w + 4, y - 3, 3, 1);
        if (kind === 'snowpine') { g.fillStyle = '#f4f8fc'; g.beginPath(); g.moveTo(tx - w * 0.6, y - 5); g.lineTo(tx, y - 12); g.lineTo(tx + w * 0.6, y - 5); g.closePath(); g.fill(); g.fillStyle = '#c8d8e8'; g.fillRect(tx - w * 0.5, y - 5, w, 1); }
      }
      return;
    }
    if (kind === 'palm') { // 야자수: 줄기 + 늘어진 잎
      g.fillStyle = OL; g.fillRect(tx - 2, base - 34, 5, 18); g.fillStyle = trunkCol[0]; g.fillRect(tx - 1, base - 33, 3, 16);
      for (let i = 0; i < 5; i++) { g.fillStyle = trunkCol[1]; g.fillRect(tx - 1, base - 31 + i * 3, 3, 1); }
      const leaf = ['#4a9a3a', '#66b84a'];
      for (const [dx, dy, s] of [[-12, 4, -1], [12, 4, 1], [-9, -2, -1], [9, -2, 1], [0, -5, 0]]) {
        g.fillStyle = OL; g.beginPath(); g.moveTo(tx, base - 34); g.quadraticCurveTo(tx + dx * 0.6, base - 40 + dy, tx + dx * 1.3, base - 30 + dy); g.lineTo(tx + dx * 1.1, base - 28 + dy); g.quadraticCurveTo(tx + dx * 0.5, base - 37 + dy, tx, base - 32); g.fill();
        g.fillStyle = leaf[s === 0 ? 1 : 0]; g.beginPath(); g.moveTo(tx, base - 34); g.quadraticCurveTo(tx + dx * 0.6, base - 39 + dy, tx + dx * 1.25, base - 30 + dy); g.quadraticCurveTo(tx + dx * 0.5, base - 36 + dy, tx, base - 33); g.fill();
      }
      g.fillStyle = '#7a5a2a'; g.fillRect(tx - 3, base - 33, 2, 2); g.fillRect(tx + 1, base - 32, 2, 2);
      return;
    }
    if (kind === 'willow') { // 버드나무: 늘어진 가지
      const cols = ['#6a8a3a', '#7aa04a', '#9ac060', '#4a6a2a'];
      blobs(g, [[tx, base - 32, 12], [tx - 8, base - 28, 9], [tx + 8, base - 28, 9]], cols);
      for (let i = 0; i < 9; i++) { const xx = tx - 14 + i * 3.4, len = 8 + (hash(i, v, 3) % 9); g.fillStyle = cols[3]; g.fillRect(Math.round(xx), base - 26, 1, len); g.fillStyle = cols[1]; g.fillRect(Math.round(xx) + 1, base - 26, 1, len - 3); }
      return;
    }
    const cols = kind === 'birch' ? ['#8ab84a', '#9ac858', '#c4e27a', '#5e8c34'] : kind === 'jungle' ? ['#2e7a2e', '#3a8e36', '#62b04e', '#1a4e1a'] : v % 2 ? ['#4a8a34', '#56983c', '#86c454', '#336824'] : ['#5a9a3a', '#66a844', '#9ad25e', '#3e7a2c'];
    const list = kind === 'jungle' ? [[tx, base - 32, 14], [tx - 10, base - 25, 11], [tx + 10, base - 25, 11], [tx - 6, base - 39, 10], [tx + 6, base - 39, 10]] : [[tx, base - 30, 13], [tx - 9, base - 24, 10], [tx + 9, base - 24, 10], [tx - 5, base - 36, 9], [tx + 6, base - 35, 9], [tx, base - 21, 9]];
    blobs(g, list, cols);
    g.fillStyle = cols[2];
    for (let i = 0; i < 9; i++) { const r = hash(v, i, 5); g.fillRect(tx - 10 + (r % 18), base - 40 + ((r >>> 5) % 18), 2, 1); }
    if (kind === 'jungle') { g.fillStyle = '#4a7a2a'; for (let i = 0; i < 4; i++) g.fillRect(tx - 12 + i * 7, base - 22, 1, 6 + i % 3); } // 덩굴
    if (kind === 'oak' && v === 3) { g.fillStyle = '#e83a3a'; for (const [ax, ay] of [[-6, -26], [5, -31], [2, -22]]) g.fillRect(tx + ax, base + ay, 2, 2); }
  });
  sprites.set(key, c);
  return c;
}

const shadowEllipse = (g, cx, cy, rx, ry, a = 0.25) => { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const glowAt = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
function stoneBlock(g, x, y, w, h, cols, rows = 9) { // 돌을 쌓은 벽면
  R(g, OL, x - 1, y - 1, w + 2, h + 2); R(g, cols[0], x, y, w, h); R(g, cols[2], x, y, w * 0.25, h); R(g, cols[3], x + w * 0.8, y, w * 0.2, h);
  for (let k = rows; k < h; k += rows) R(g, 'rgba(0,0,0,0.22)', x, y + k, w, 1);
  for (let k = 0; k < h; k += rows) for (let j = ((k / rows) % 2) * 6; j < w; j += 12) R(g, 'rgba(0,0,0,0.15)', x + j, y + k, 1, rows - 1);
}

export function drawOutdoorProp(g, pr, t, night, burntTrees) {
  const x = pr.x * TILE, y = pr.y * TILE, W = pr.w * TILE, H = pr.h * TILE, cx = x + W / 2, by = y + H;
  if (pr.big && drawLandmark(g, pr, t, night)) return; // 성지 마을의 커다란 상징물
  if (drawVillageProp(g, pr, t, night)) return;      // 성지 마을의 작은 것들
  if (drawCapitalProp(g, pr, t, night)) return;      // 왕도: 성벽 · 망루 · 성문 · 분수 · 처형대 · 좌판
  switch (pr.kind) {
    case 'brokenWell': { // 폐허 도시의 무너진 우물: 반쯤 허물어진 돌 테두리 · 검은 구멍 · 늘어진 밧줄
      shadowEllipse(g, cx, by - 4, 20, 6, 0.28);
      g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 9, 19, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a8478'; g.beginPath(); g.ellipse(cx, by - 9, 18, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#05040a'; g.beginPath(); g.ellipse(cx, by - 10, 12, 5, 0, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 7; k++) { const a = Math.PI * (0.05 + k * 0.13); R(g, k % 2 ? '#a8a294' : '#6e685c', cx + Math.cos(a) * 16 - 3, by - 9 + Math.sin(a) * 7 - 2, 6, 4); }
      R(g, OL, cx - 18, by - 18, 6, 7); R(g, '#9c968a', cx - 17, by - 17, 4, 5); R(g, '#7a7468', cx + 10, by - 14, 6, 3);
      R(g, '#5a4a32', cx + 13, by - 30, 2, 18); R(g, '#c8b080', cx + 2, by - 29, 12, 1); R(g, '#c8b080', cx + 2, by - 29, 1, 16);
      return;
    }
    case 'sewerGrate': { // 왕도 하수구: 돌 둔덕 속 녹슨 쇠창살, 이끼 · 물방울
      shadowEllipse(g, cx, by - 2, 22, 5, 0.25);
      g.fillStyle = OL; g.beginPath(); g.moveTo(x - 4, by); g.lineTo(x + 2, by - 22); g.lineTo(x + W - 2, by - 22); g.lineTo(x + W + 4, by); g.closePath(); g.fill();
      g.fillStyle = '#7a7468'; g.beginPath(); g.moveTo(x - 3, by - 1); g.lineTo(x + 3, by - 21); g.lineTo(x + W - 3, by - 21); g.lineTo(x + W + 3, by - 1); g.closePath(); g.fill();
      R(g, OL, cx - 11, by - 17, 22, 16); R(g, '#0a0a10', cx - 10, by - 16, 20, 15);
      for (let k = 0; k < 5; k++) R(g, '#7a4a2a', cx - 9 + k * 4, by - 16, 2, 15);
      R(g, '#8a5a32', cx - 10, by - 11, 20, 2);
      R(g, '#4a7a3a', x + 1, by - 6, 6, 3); R(g, '#4a7a3a', x + W - 7, by - 9, 5, 2);
      if (Math.floor(t * 2) % 3 === 0) R(g, '#7ad8ff', cx + 3, by - 2 + (Math.floor(t * 6) % 3), 1, 2);
      return;
    }
    case 'oldMine': { // 황야의 옛 광산: 바위에 박힌 나무 틀 입구, 녹슨 레일, 깨진 표지
      shadowEllipse(g, cx, by - 2, 24, 6, 0.28);
      g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 12, 24, 16, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#9a6a42'; g.beginPath(); g.ellipse(cx, by - 12, 23, 15, 0, Math.PI, 0); g.fill();
      R(g, '#9a6a42', x - 4, by - 12, W + 8, 12);
      R(g, '#05040a', cx - 10, by - 22, 20, 22);
      for (const sx of [-12, 10]) { R(g, OL, cx + sx - 1, by - 25, 5, 25); R(g, '#6a4a2a', cx + sx, by - 24, 3, 24); }
      R(g, OL, cx - 14, by - 27, 28, 5); R(g, '#7a5232', cx - 13, by - 26, 26, 3);
      for (let k = 0; k < 4; k++) R(g, '#5a3a22', cx - 7, by - 4 - k * 4, 14, 1);
      R(g, '#8a8a92', cx - 6, by - 18, 1, 18); R(g, '#8a8a92', cx + 5, by - 18, 1, 18);
      R(g, OL, cx + 16, by - 18, 12, 8); R(g, '#c8a070', cx + 17, by - 17, 10, 6); R(g, '#a0302a', cx + 19, by - 15, 6, 1);
      return;
    }
    case 'ship': {
      const bob = Math.round(Math.sin(t * 1.6 + pr.x) * 1);
      const hy = by - 6 + bob, hx0 = x - 4, hx1 = x + W + 8; // 선체 아래쪽 선(물 높이)
      // 물결과 그림자
      R(g, 'rgba(10,30,50,0.35)', x - 6, by - 6, W + 18, 8);
      // 선체: 고물(왼쪽)은 높고 네모, 이물(오른쪽)은 뾰족하게 위로
      g.fillStyle = OL; g.beginPath(); g.moveTo(hx0 - 1, hy - 23); g.lineTo(hx0 + 6, hy + 1); g.lineTo(hx1 - 14, hy + 1); g.lineTo(hx1 + 1, hy - 19); g.lineTo(hx1 - 4, hy - 19); g.lineTo(hx1 - 16, hy - 15); g.lineTo(hx0 + 14, hy - 15); g.lineTo(hx0 + 13, hy - 23); g.closePath(); g.fill();
      g.fillStyle = '#6a4226'; g.beginPath(); g.moveTo(hx0, hy - 22); g.lineTo(hx0 + 7, hy); g.lineTo(hx1 - 14, hy); g.lineTo(hx1, hy - 18); g.lineTo(hx1 - 4, hy - 18); g.lineTo(hx1 - 16, hy - 14); g.lineTo(hx0 + 14, hy - 14); g.lineTo(hx0 + 12, hy - 22); g.closePath(); g.fill();
      R(g, '#8a5a32', hx0 + 4, hy - 13, W - 6, 3); R(g, '#4a2a16', hx0 + 6, hy - 6, W - 10, 2); R(g, '#c89a3a', hx0 + 5, hy - 10, W - 8, 1); // 띠 · 금빛 줄
      for (let k = 0; k < 5; k++) { R(g, OL, hx0 + 16 + k * 16, hy - 9, 5, 5); R(g, '#1a2a3a', hx0 + 17 + k * 16, hy - 8, 3, 3); } // 현창
      R(g, '#5a3a22', hx0 + 1, hy - 30, 12, 8); R(g, OL, hx0 + 1, hy - 31, 12, 1); R(g, '#ffd27a', hx0 + 4, hy - 28, 3, 3); // 고물 선실
      // 돛대 둘과 돛
      for (const [mx, mh, sw] of [[cx - 16, 78, 30], [cx + 22, 64, 24]]) {
        R(g, OL, mx - 2, hy - 14 - mh, 4, mh); R(g, '#7a5232', mx - 1, hy - 14 - mh, 2, mh);
        R(g, OL, mx - sw / 2 - 1, hy - 14 - mh + 6, sw + 2, 3);
        const top = hy - 14 - mh + 8, sh = mh * 0.62, swell = Math.round(Math.sin(t * 2 + mx) * 1.5);
        g.fillStyle = OL; g.beginPath(); g.moveTo(mx - sw / 2 - 1, top - 1); g.lineTo(mx + sw / 2 + 1, top - 1); g.lineTo(mx + sw / 2 + 3 + swell, top + sh + 1); g.lineTo(mx - sw / 2 + 1 + swell, top + sh + 1); g.closePath(); g.fill();
        g.fillStyle = '#f0e8d4'; g.beginPath(); g.moveTo(mx - sw / 2, top); g.lineTo(mx + sw / 2, top); g.lineTo(mx + sw / 2 + 2 + swell, top + sh); g.lineTo(mx - sw / 2 + 2 + swell, top + sh); g.closePath(); g.fill();
        R(g, pr.flag || '#3a6a9a', mx - sw / 2 + 2, top + sh * 0.4, sw, 4); R(g, 'rgba(0,0,0,0.08)', mx - sw / 2, top, 3, sh);
        const fw = Math.round(6 + Math.sin(t * 5 + mx) * 2); R(g, OL, mx, hy - 14 - mh - 6, fw + 1, 6); R(g, pr.flag || '#3a6a9a', mx + 1, hy - 14 - mh - 5, fw, 4); // 깃발
      }
      // 이물 쪽 밧줄
      g.fillStyle = OL; for (let k = 0; k < 10; k++) R(g, OL, cx + 22 + k * 3.2, hy - 76 + k * 6, 1, 2);
      // 뱃전에 부딪히는 물결
      const wv = Math.floor(t * 4) % 3;
      for (let k = 0; k < W + 8; k += 6) R(g, 'rgba(230,246,255,0.55)', hx0 + 6 + k + wv * 2, by - 4 + (k % 12 ? 0 : 1), 4, 1);
      return;
    }
    case 'wreck': { // 뭍에 얹힌 난파선: 기울어진 선체 · 부러진 돛대 · 찢긴 돛 · 뚫린 구멍
      const hx0 = x - 6, hx1 = x + W + 8, hy = by - 2, tilt = 9;
      R(g, 'rgba(20,14,8,0.3)', x - 4, by - 5, W + 12, 7);
      g.fillStyle = OL; g.beginPath(); g.moveTo(hx0 - 1, hy - 30); g.lineTo(hx0 + 8, hy + 1); g.lineTo(hx1 - 14, hy + 1 - tilt); g.lineTo(hx1 + 1, hy - 28 - tilt); g.lineTo(hx1 - 16, hy - 20 - tilt); g.lineTo(hx0 + 14, hy - 20); g.lineTo(hx0 + 13, hy - 30); g.closePath(); g.fill();
      g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(hx0, hy - 29); g.lineTo(hx0 + 9, hy); g.lineTo(hx1 - 14, hy - tilt); g.lineTo(hx1, hy - 27 - tilt); g.lineTo(hx1 - 16, hy - 19 - tilt); g.lineTo(hx0 + 14, hy - 19); g.lineTo(hx0 + 12, hy - 29); g.closePath(); g.fill();
      g.fillStyle = '#7a5232'; g.beginPath(); g.moveTo(hx0 + 13, hy - 19); g.lineTo(hx1 - 16, hy - 19 - tilt); g.lineTo(hx1 - 17, hy - 16 - tilt); g.lineTo(hx0 + 13, hy - 16); g.closePath(); g.fill(); // 갑판 가장자리
      for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) { const px = hx0 + 12 + k * 14 + row * 5, py = hy - 6 - row * 5 - tilt * (px - hx0) / (hx1 - hx0); R(g, '#3e2616', px, py, 12, 1); } // 판자 이음
      R(g, '#4a2e1a', hx0 + 1, hy - 38, 12, 9); R(g, OL, hx0 + 1, hy - 39, 12, 1); R(g, '#1a100a', hx0 + 4, hy - 36, 3, 3); // 무너진 고물 선실
      for (const [hx, hw] of [[0.3, 10], [0.62, 7]]) { const px = hx0 + (hx1 - hx0) * hx, py = hy - 13 - tilt * hx; R(g, OL, px, py, hw, 6); R(g, '#1a100a', px + 1, py + 1, hw - 2, 4); R(g, '#7a5232', px - 1, py + 2, 2, 1); } // 뚫린 구멍
      const mx = x + W * 0.42, mt = hy - 19 - tilt * 0.42;
      g.save(); g.translate(mx, mt); g.rotate(0.28); R(g, OL, -2, -38, 4, 38); R(g, '#6a4628', -1, -38, 2, 38); R(g, OL, -12, -32, 24, 3); // 기울어진 돛대
      g.fillStyle = OL; g.beginPath(); g.moveTo(-11, -30); g.lineTo(10, -30); g.lineTo(6, -14); g.lineTo(1, -20); g.lineTo(-4, -11); g.lineTo(-10, -18); g.closePath(); g.fill();
      g.fillStyle = '#c8bca0'; g.beginPath(); g.moveTo(-10, -29); g.lineTo(9, -29); g.lineTo(5, -15); g.lineTo(1, -21); g.lineTo(-4, -12); g.lineTo(-9, -19); g.closePath(); g.fill(); R(g, '#1a1a1a', -9, -25, 18, 2); g.restore(); // 찢긴 검은 줄 돛
      R(g, OL, x + W * 0.78 - 2, mt - 14 + 3, 4, 14); R(g, '#6a4628', x + W * 0.78 - 1, mt - 14 + 3, 2, 14); R(g, '#e8dcc0', x + W * 0.78 - 2, mt - 15 + 3, 4, 2); // 부러진 뒷돛대
      return;
    }
    case 'tree': {
      const burnt = burntTrees?.has(`${pr.x},${pr.y}`);
      if (pr.chopped) { drawStump(g, pr, burnt || pr.tree === 'charred'); return; }
      const s = treeSprite(pr.tree, pr.v, burnt);
      shadowEllipse(g, x + 8, y + 14, 10, 4, 0.22);
      const sway = pr.tree === 'cactus' ? 0 : Math.round(Math.sin(t * 1.3 + pr.x * 0.7 + pr.y) * 0.7);
      let shake = 0;
      if (pr.shakeT > 0) { pr.shakeT -= 1 / 60; shake = Math.round(Math.sin(t * 60) * 1.5); } // 도끼질에 흔들린다 (통째로, 칸 단위로)
      if (pr.tree === 'cactus') { g.drawImage(s, 0, 0, 40, 56, x + 8 - 20 + shake, y + 16 - 56, 40, 56); return; } // 선인장은 한 덩어리
      g.drawImage(s, 0, 0, 40, 34, x + 8 - 20 + sway + shake, y + 16 - 56, 40, 34);
      g.drawImage(s, 0, 34, 40, 22, x + 8 - 20 + Math.round(shake * 0.5), y + 16 - 22, 40, 22);
      return;
    }
    case 'house': {
      const wallH = 30, roofH = 30;
      R(g, 'rgba(0,0,0,0.25)', x + 2, by - 2, W, 5);
      R(g, OL, x - 1, by - wallH - 1, W + 2, wallH + 2); R(g, '#e8dcc0', x, by - wallH, W, wallH);
      R(g, '#7a5434', x, by - wallH, 4, wallH); R(g, '#7a5434', x + W / 2 - 2, by - wallH, 4, wallH); R(g, '#7a5434', x + W - 4, by - wallH, 4, wallH); R(g, '#7a5434', x, by - wallH, W, 3); R(g, '#7a5434', x, by - 4, W, 4);
      R(g, OL, x + W / 2 - 8, by - 20, 16, 20); R(g, '#5a3a22', x + W / 2 - 7, by - 19, 14, 19); R(g, '#d8b860', x + W / 2 + 3, by - 10, 2, 2);
      for (const wx of [x + 10, x + W - 22]) { R(g, OL, wx - 1, by - 23, 14, 12); R(g, night ? '#ffd27a' : '#8ac8e8', wx, by - 22, 12, 10); R(g, '#7a5434', wx + 5, by - 22, 2, 10); R(g, '#7a5434', wx, by - 18, 12, 2); }
      const rc = pr.roof || '#b8483a';
      g.fillStyle = OL; g.beginPath(); g.moveTo(x - 7, by - wallH + 1); g.lineTo(cx, by - wallH - roofH - 1); g.lineTo(x + W + 7, by - wallH + 1); g.closePath(); g.fill();
      g.fillStyle = rc; g.beginPath(); g.moveTo(x - 5, by - wallH); g.lineTo(cx, by - wallH - roofH + 1); g.lineTo(x + W + 5, by - wallH); g.closePath(); g.fill();
      for (let k = 1; k < 5; k++) { const yy = by - wallH - k * 6, half = (W / 2 + 5) * (1 - (k * 6) / roofH); R(g, 'rgba(0,0,0,0.22)', cx - half, yy, half * 2, 1); }
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x - 5, by - wallH); g.lineTo(cx, by - wallH - roofH + 1); g.lineTo(cx, by - wallH); g.closePath(); g.fill();
      R(g, OL, x + W - 22, by - wallH - 24, 8, 14); R(g, '#8a6a5a', x + W - 21, by - wallH - 23, 6, 13);
      return;
    }
    case 'well': {
      shadowEllipse(g, x + 16, by, 15, 4);
      R(g, OL, x + 1, by - 14, 30, 14); R(g, '#9a968e', x + 2, by - 13, 28, 12);
      for (let k = 0; k < 4; k++) R(g, '#7a766e', x + 2 + k * 7, by - 8, 1, 7); R(g, '#7a766e', x + 2, by - 9, 28, 1); R(g, '#2a5a7a', x + 5, by - 13, 22, 3);
      R(g, OL, x + 3, by - 34, 3, 21); R(g, OL, x + 26, by - 34, 3, 21); R(g, '#7a5434', x + 4, by - 33, 1, 20); R(g, '#7a5434', x + 27, by - 33, 1, 20);
      g.fillStyle = OL; g.beginPath(); g.moveTo(x - 2, by - 31); g.lineTo(x + 16, by - 42); g.lineTo(x + 34, by - 31); g.closePath(); g.fill();
      g.fillStyle = '#9a4a3a'; g.beginPath(); g.moveTo(x, by - 32); g.lineTo(x + 16, by - 41); g.lineTo(x + 32, by - 32); g.closePath(); g.fill();
      return;
    }
    case 'caveMouth': case 'iceCaveMouth': case 'lavaCave': {
      const rim = pr.kind === 'iceCaveMouth' ? '#6a7a8c' : pr.kind === 'lavaCave' ? '#26202a' : '#3e3a44';
      g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 6, 22, 20, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#0a0810'; g.beginPath(); g.ellipse(cx, by - 4, 18, 17, 0, Math.PI, 0); g.fill();
      R(g, rim, cx - 18, by - 5, 36, 5);
      if (pr.kind === 'caveMouth') { g.fillStyle = '#5c9a3a'; for (let i = 0; i < 8; i++) { const r = hash(i, 9, 2); g.fillRect(cx - 20 + (r % 40), by - 26 + ((r >>> 4) % 6), 3, 2 + (r % 4)); } }
      if (pr.kind === 'iceCaveMouth') { g.fillStyle = '#dff4ff'; for (let i = 0; i < 7; i++) { const xx = cx - 16 + i * 5; g.beginPath(); g.moveTo(xx, by - 21); g.lineTo(xx + 3, by - 21); g.lineTo(xx + 1.5, by - 13 - (i % 3) * 2); g.fill(); } } // 고드름
      if (pr.kind === 'lavaCave') glowAt(g, cx, by - 6, 18, 'rgba(255,110,30,A)', 0.55 + 0.2 * Math.sin(t * 3));
      else { const a = 0.5 + 0.3 * Math.sin(t * 2); g.fillStyle = `rgba(90,255,200,${a * 0.4})`; g.fillRect(cx - 2, by - 14, 1, 1); g.fillRect(cx + 5, by - 9, 1, 1); }
      return;
    }
    case 'hole': { // 구멍: 땅이 꺼진 어두운 구덩이, 가장자리 흙 · 풀
      shadowEllipse(g, cx, by - 10, 22, 12, 0.3);
      g.fillStyle = '#6a5034'; g.beginPath(); g.ellipse(cx, by - 12, 20, 11, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 12, 17, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#05040a'; g.beginPath(); g.ellipse(cx, by - 11, 15, 7.5, 0, 0, Math.PI * 2); g.fill();
      R(g, '#4a3824', cx - 15, by - 17, 30, 3);
      g.fillStyle = '#5d9e3b'; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = hash(i, 7, 1) % 3; g.fillRect(Math.round(cx + Math.cos(a) * (21 + r)), Math.round(by - 12 + Math.sin(a) * (11 + r)), 2, 2); }
      const a = 0.2 + 0.15 * Math.sin(t * 1.5); g.fillStyle = `rgba(160,200,255,${a})`; g.fillRect(cx - 1, by - 13, 2, 1);
      return;
    }
    case 'templeRuin': { // 가라앉은 사원: 늪 속에 반쯤 잠긴 돌 신전과 계단
      const cols = ['#7a8a6a', '#8a9a78', '#a8b896', '#4e5a42'];
      stoneBlock(g, x + 4, by - 44, W - 8, 40, cols);
      for (const px of [x + 2, x + W - 10]) stoneBlock(g, px, by - 52, 8, 50, cols, 8);
      g.fillStyle = OL; g.beginPath(); g.moveTo(x - 4, by - 44); g.lineTo(cx, by - 62); g.lineTo(x + W + 4, by - 44); g.closePath(); g.fill();
      g.fillStyle = cols[1]; g.beginPath(); g.moveTo(x - 2, by - 45); g.lineTo(cx, by - 60); g.lineTo(x + W + 2, by - 45); g.closePath(); g.fill();
      R(g, OL, cx - 9, by - 30, 18, 30); R(g, '#0c0e0a', cx - 8, by - 29, 16, 29);
      for (let k = 0; k < 3; k++) R(g, cols[k % 2 ? 0 : 2], cx - 10 - k * 2, by - 10 + k * 2, 20 + k * 4, 2);
      g.fillStyle = '#5c8a3a'; for (let i = 0; i < 9; i++) { const r = hash(i, 3, 8); g.fillRect(x + 4 + (r % (W - 8)), by - 50 + ((r >>> 4) % 20), 2, 3 + (r % 5)); }
      g.fillStyle = `rgba(150,255,120,${0.25 + 0.15 * Math.sin(t * 2)})`; g.fillRect(cx - 2, by - 40, 4, 4);
      return;
    }
    case 'cryptStairs': { // 지하로 내려가는 돌계단 + 문틀
      const cols = ['#6a6474', '#7a7486', '#9a94a8', '#3e3a48'];
      R(g, OL, x + 1, by - 26, W - 2, 26); R(g, '#0a080e', x + 4, by - 22, W - 8, 22);
      for (let k = 0; k < 4; k++) R(g, k % 2 ? cols[0] : cols[1], x + 6 + k, by - 20 + k * 5, W - 12 - k * 2, 3);
      stoneBlock(g, x, by - 34, 6, 34, cols, 7); stoneBlock(g, x + W - 6, by - 34, 6, 34, cols, 7);
      R(g, OL, x - 3, by - 38, W + 6, 6); R(g, cols[1], x - 2, by - 37, W + 4, 4);
      g.fillStyle = `rgba(200,140,255,${0.3 + 0.2 * Math.sin(t * 2.4)})`; g.fillRect(cx - 1, by - 36, 2, 2);
      return;
    }
    case 'labyrinthGate': { // 잊힌 미궁의 문: 문양이 새겨진 거대한 돌 아치
      const cols = ['#8a7a6a', '#9a8a78', '#bcae98', '#5a4e42'];
      stoneBlock(g, x, by - 56, 14, 56, cols, 8); stoneBlock(g, x + W - 14, by - 56, 14, 56, cols, 8);
      R(g, OL, x - 4, by - 64, W + 8, 12); R(g, cols[1], x - 3, by - 63, W + 6, 10); R(g, cols[3], x - 3, by - 55, W + 6, 2);
      R(g, '#06050a', x + 14, by - 52, W - 28, 52);
      const a = 0.45 + 0.35 * Math.sin(t * 1.4), rc = `rgba(190,140,255,${a})`;
      for (let i = 0; i < 4; i++) { R(g, rc, x + 5, by - 48 + i * 11, 4, 2); R(g, rc, x + W - 9, by - 48 + i * 11, 4, 2); }
      R(g, rc, cx - 8, by - 60, 16, 2); R(g, rc, cx - 1, by - 62, 2, 6);
      return;
    }
    case 'whirlpool': { // 소용돌이 (용궁 입구)
      for (let i = 0; i < 4; i++) {
        const r = 22 - i * 5, ph = t * (2 + i * 0.6);
        g.strokeStyle = `rgba(${200 - i * 30},${240 - i * 20},255,${0.55 + i * 0.1})`; g.lineWidth = 2;
        g.beginPath(); g.arc(cx, by - H / 2, r, ph, ph + Math.PI * 1.3); g.stroke();
        g.beginPath(); g.arc(cx, by - H / 2, Math.max(1, r - 2), ph + Math.PI, ph + Math.PI * 2.1); g.stroke();
      }
      g.fillStyle = '#0a2a4a'; g.beginPath(); g.arc(cx, by - H / 2, 5, 0, Math.PI * 2); g.fill();
      return;
    }
    case 'tower': {
      const H2 = 200;
      shadowEllipse(g, cx, by - 2, W / 2 + 8, 8, 0.3);
      for (const [hw, y0, hh] of [[W / 2 + 4, 0, 46], [W / 2 - 2, 46, 52], [W / 2 - 8, 98, 54], [W / 2 - 14, 152, 40]]) {
        const top = by - y0 - hh;
        stoneBlock(g, cx - hw, top, hw * 2, hh, ['#8c8478', '#9a9286', '#a49c90', '#6e665c']);
        R(g, OL, cx - hw - 3, top - 1, hw * 2 + 6, 4); R(g, '#b4aca0', cx - hw - 2, top, hw * 2 + 4, 2);
        const a = 0.45 + 0.35 * Math.sin(t * 1.6 + y0 * 0.05), rc = `rgba(120,255,220,${a})`;
        R(g, rc, cx - 2, top + 8, 4, hh - 16); R(g, rc, cx - 8, top + hh / 2, 16, 2); R(g, rc, cx - hw + 5, top + 10, 2, 6); R(g, rc, cx + hw - 7, top + 10, 2, 6);
      }
      g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 10, by); g.lineTo(cx - 10, by - 20); g.quadraticCurveTo(cx, by - 32, cx + 10, by - 20); g.lineTo(cx + 10, by); g.fill();
      g.fillStyle = '#16121c'; g.beginPath(); g.moveTo(cx - 8, by); g.lineTo(cx - 8, by - 19); g.quadraticCurveTo(cx, by - 29, cx + 8, by - 19); g.lineTo(cx + 8, by); g.fill();
      R(g, `rgba(120,255,220,${0.3 + 0.2 * Math.sin(t * 2)})`, cx - 6, by - 4, 12, 4);
      const topY = by - H2 + 6, pulse = 0.55 + 0.45 * Math.sin(t * 2.2);
      R(g, OL, cx - 5, topY - 4, 10, 12); R(g, '#d8fff0', cx - 3, topY - 2, 6, 8);
      glowAt(g, cx, topY + 2, 30, 'rgba(160,255,230,A)', 0.7 * pulse);
      return;
    }
    case 'house_altar': case 'house_library': case 'house_guild': case 'house_forge': case 'house_shop': case 'house_dojo': case 'house_home': case 'house_res': case 'house_manor': case 'house_town': case 'house_prison':
      drawBuilding(g, pr, t, night); return;
    case 'lampPost': { // 가로등: 쇠기둥 + 유리 등 (밤에 켜진다)
      shadowEllipse(g, cx, by - 2, 5, 2);
      R(g, OL, cx - 4, by - 5, 8, 5); R(g, '#4a4a56', cx - 3, by - 4, 6, 3); R(g, '#6a6a78', cx - 3, by - 4, 6, 1);
      R(g, OL, cx - 2, by - 36, 4, 32); R(g, '#3a3a46', cx - 1, by - 35, 2, 31); R(g, '#5a5a68', cx - 1, by - 35, 1, 31);
      R(g, OL, cx - 6, by - 38, 12, 3); R(g, '#4a4a56', cx - 5, by - 37, 10, 1);
      R(g, OL, cx - 5, by - 49, 10, 12); R(g, night ? '#ffd86a' : '#bcd0dc', cx - 4, by - 48, 8, 10);
      if (night) { R(g, '#fff4c0', cx - 2, by - 46, 4, 5); glowAt(g, cx, by - 43, 16, 'rgba(255,220,120,A)', 0.55); }
      else R(g, 'rgba(255,255,255,0.6)', cx - 3, by - 47, 2, 3);
      R(g, '#3a3a46', cx - 4, by - 44, 8, 1); R(g, '#3a3a46', cx - 1, by - 48, 2, 10);
      R(g, OL, cx - 7, by - 52, 14, 4); R(g, '#4a4a56', cx - 6, by - 51, 12, 2); R(g, OL, cx - 1, by - 55, 2, 3);
      return;
    }
    case 'mailbox': { // 우편함: 나무 기둥 + 빨간 함
      shadowEllipse(g, cx, by - 2, 5, 2);
      R(g, OL, cx - 2, by - 18, 4, 17); R(g, '#8a5a32', cx - 1, by - 17, 2, 16);
      R(g, OL, cx - 7, by - 27, 14, 10); R(g, '#c8403a', cx - 6, by - 26, 12, 8); R(g, '#e86a5a', cx - 6, by - 26, 12, 2); R(g, '#8a2a24', cx - 6, by - 20, 12, 1);
      R(g, OL, cx + 5, by - 31, 2, 8); R(g, '#e8c060', cx + 6, by - 31, 3, 3);
      return;
    }
    case 'fence': { // 텃밭 울타리 (가로 · 세로 한 칸)
      const post = (px, py) => { R(g, OL, px - 2, py - 14, 5, 15); R(g, '#9a6a3e', px - 1, py - 13, 3, 13); R(g, '#c8945a', px - 1, py - 13, 1, 13); R(g, '#6a4628', px - 2, py - 15, 5, 2); };
      if (pr.dir === 'h') { R(g, OL, x, by - 12, W, 3); R(g, '#b07a48', x, by - 11, W, 1); R(g, OL, x, by - 7, W, 3); R(g, '#b07a48', x, by - 6, W, 1); for (let px = x + 3; px < x + W; px += 16) post(px, by - 1); }
      else { R(g, OL, cx - 2, y - 10, 4, H + 9); R(g, '#b07a48', cx - 1, y - 10, 2, H + 8); post(cx, by - 1); }
      return;
    }
    case 'scarecrow': { // 허수아비
      shadowEllipse(g, cx, by - 1, 7, 2);
      R(g, OL, cx - 1, by - 30, 3, 30); R(g, '#8a5a32', cx, by - 29, 1, 28);
      R(g, OL, cx - 12, by - 22, 25, 3); R(g, '#8a5a32', cx - 11, by - 21, 23, 1);
      R(g, OL, cx - 6, by - 24, 13, 14); R(g, '#5a7ab8', cx - 5, by - 23, 11, 12); R(g, '#e8c060', cx - 8, by - 21, 3, 4); R(g, '#e8c060', cx + 6, by - 21, 3, 4);
      g.fillStyle = OL; g.beginPath(); g.arc(cx, by - 30, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e8d8a0'; g.beginPath(); g.arc(cx, by - 30, 5, 0, Math.PI * 2); g.fill();
      R(g, OL, cx - 2, by - 31, 1, 1); R(g, OL, cx + 2, by - 31, 1, 1); R(g, OL, cx - 2, by - 28, 5, 1);
      R(g, OL, cx - 8, by - 37, 17, 3); R(g, '#a8784a', cx - 7, by - 36, 15, 1); R(g, OL, cx - 5, by - 42, 11, 6); R(g, '#a8784a', cx - 4, by - 41, 9, 4);
      return;
    }
    // ───── 종족 성지 ─────
    case 'mageTower': { // 마탑: 가느다란 탑, 보랏빛 지붕, 꼭대기에 떠 있는 구슬
      const cols = ['#8a8aa8', '#9a9ab8', '#c4c4dc', '#5a5a78'];
      stoneBlock(g, cx - 14, by - 40, 28, 40, cols, 8); stoneBlock(g, cx - 11, by - 96, 22, 58, cols, 8); stoneBlock(g, cx - 8, by - 132, 16, 38, cols, 8);
      for (const yy of [by - 40, by - 96]) { R(g, OL, cx - 16, yy - 1, 32, 4); R(g, cols[2], cx - 15, yy, 30, 2); }
      g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 13, by - 131); g.lineTo(cx, by - 168); g.lineTo(cx + 13, by - 131); g.closePath(); g.fill();
      g.fillStyle = '#6a4ab8'; g.beginPath(); g.moveTo(cx - 11, by - 132); g.lineTo(cx, by - 165); g.lineTo(cx + 11, by - 132); g.closePath(); g.fill();
      g.fillStyle = '#8a6ad8'; g.beginPath(); g.moveTo(cx - 11, by - 132); g.lineTo(cx, by - 165); g.lineTo(cx, by - 132); g.closePath(); g.fill();
      for (const yy of [by - 70, by - 114]) { R(g, OL, cx - 4, yy, 8, 10); R(g, `rgba(200,170,255,${0.6 + 0.3 * Math.sin(t * 2 + yy)})`, cx - 3, yy + 1, 6, 8); }
      R(g, OL, cx - 6, by - 22, 12, 22); R(g, '#2a2240', cx - 5, by - 21, 10, 21);
      const oy = by - 178 + Math.sin(t * 1.8) * 3;
      glowAt(g, cx, oy, 22, 'rgba(190,150,255,A)', 0.6); disc(g, cx, oy, 5, OL); disc(g, cx, oy, 4, '#d8c4ff'); disc(g, cx - 1, oy - 1, 1.5, '#ffffff');
      return;
    }
    case 'worldTree': { // 세계수: 거대한 줄기와 하늘을 덮는 잎, 빛나는 열매
      shadowEllipse(g, cx, by - 4, 40, 10, 0.3);
      g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 22, by); g.quadraticCurveTo(cx - 12, by - 40, cx - 10, by - 80); g.lineTo(cx + 10, by - 80); g.quadraticCurveTo(cx + 12, by - 40, cx + 22, by); g.closePath(); g.fill();
      g.fillStyle = '#7a5a3a'; g.beginPath(); g.moveTo(cx - 20, by - 1); g.quadraticCurveTo(cx - 10, by - 40, cx - 9, by - 80); g.lineTo(cx + 9, by - 80); g.quadraticCurveTo(cx + 10, by - 40, cx + 20, by - 1); g.closePath(); g.fill();
      g.fillStyle = '#5a4028'; for (let i = 0; i < 5; i++) g.fillRect(cx - 6 + i * 3, by - 70 + i * 6, 2, 30);
      R(g, OL, cx - 6, by - 20, 12, 18); R(g, '#1a1408', cx - 5, by - 19, 10, 17);
      g.fillStyle = `rgba(150,255,170,${0.4 + 0.2 * Math.sin(t * 2)})`; g.fillRect(cx - 1, by - 12, 2, 2);
      blobs(g, [[cx, by - 110, 40], [cx - 36, by - 92, 28], [cx + 36, by - 92, 28], [cx - 22, by - 132, 26], [cx + 24, by - 130, 26], [cx, by - 146, 22]], ['#3e8a3a', '#56a84a', '#86d06a', '#24582a']);
      for (let i = 0; i < 12; i++) { const r = hash(i, 4, 6), fx = cx - 50 + (r % 100), fy = by - 150 + ((r >>> 7) % 70), a = 0.5 + 0.4 * Math.sin(t * 2 + i); glowAt(g, fx, fy, 6, 'rgba(190,255,150,A)', a * 0.6); R(g, '#e8ffb0', fx - 1, fy - 1, 2, 2); }
      return;
    }
    case 'castle': { // 무너진 왕성: 성벽, 탑 두 개(하나는 무너짐), 성문, 찢어진 깃발
      const cols = ['#9a948a', '#aaa49a', '#c8c2b6', '#6a645a'];
      stoneBlock(g, x, by - 46, W, 46, cols, 9);
      for (let i = 0; i < W; i += 12) if (hash(i, 1, 4) % 4) { R(g, OL, x + i, by - 52, 8, 7); R(g, cols[1], x + i + 1, by - 51, 6, 6); }
      stoneBlock(g, x - 6, by - 84, 24, 84, cols, 9); stoneBlock(g, x + W - 18, by - 60, 24, 60, cols, 9);
      for (let i = 0; i < 4; i++) R(g, OL, x - 6 + i * 7, by - 90, 5, 7);
      R(g, OL, x + W - 18, by - 62, 24, 3); for (let i = 0; i < 5; i++) { const r = hash(i, 2, 5); R(g, cols[3], x + W - 16 + (r % 20), by - 66 + (r >>> 4) % 4, 4, 3); }
      g.fillStyle = OL; g.beginPath(); g.moveTo(cx - 16, by); g.lineTo(cx - 16, by - 26); g.quadraticCurveTo(cx, by - 40, cx + 16, by - 26); g.lineTo(cx + 16, by); g.fill();
      g.fillStyle = '#1a1612'; g.beginPath(); g.moveTo(cx - 14, by); g.lineTo(cx - 14, by - 25); g.quadraticCurveTo(cx, by - 37, cx + 14, by - 25); g.lineTo(cx + 14, by); g.fill();
      for (let i = -12; i <= 12; i += 4) R(g, '#5a4a3a', cx + i, by - 30, 1, 30);
      R(g, OL, x + 4, by - 120, 2, 36); const fl = Math.sin(t * 3) * 2;
      g.fillStyle = '#b83a3a'; g.beginPath(); g.moveTo(x + 6, by - 118); g.lineTo(x + 24 + fl, by - 113); g.lineTo(x + 14, by - 108); g.lineTo(x + 22 + fl, by - 102); g.lineTo(x + 6, by - 104); g.closePath(); g.fill();
      R(g, '#ffd76a', x + 10, by - 112, 3, 3);
      g.fillStyle = '#5c8a3a'; for (let i = 0; i < 14; i++) { const r = hash(i, 8, 3); g.fillRect(x + (r % W), by - 46 + ((r >>> 5) % 30), 3, 2 + (r % 4)); }
      return;
    }
    case 'arena': { // 황야의 투기장: 둥근 담 + 나무 말뚝 + 뿔 장식
      g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 30, W / 2 + 2, 34, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b07a4a'; g.beginPath(); g.ellipse(cx, by - 30, W / 2, 32, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c8945a'; g.beginPath(); g.ellipse(cx, by - 34, W / 2 - 12, 20, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, by - 30, W / 2 - 12, 20, 0, Math.PI, 0); g.fill();
      for (let i = 0; i < 22; i++) { const a = Math.PI * (0.02 + i / 21 * 0.96), px = cx + Math.cos(a) * (W / 2 - 2), py = by - 30 + Math.sin(a) * 32; R(g, OL, px - 2, py - 16, 5, 17); R(g, '#8a5a32', px - 1, py - 15, 3, 15); R(g, '#e8dcc0', px - 1, py - 17, 3, 2); }
      for (const s of [-1, 1]) { const hx = cx + s * 14; R(g, OL, hx - 3, by - 70, 6, 8); R(g, '#7a5432', hx - 2, by - 69, 4, 6); g.strokeStyle = '#f0e6cc'; g.lineWidth = 3; g.beginPath(); g.arc(hx + s * 6, by - 72, 7, s > 0 ? Math.PI : 0, s > 0 ? Math.PI * 1.6 : -Math.PI * 0.6, s < 0); g.stroke(); }
      R(g, OL, cx - 10, by - 12, 20, 12); R(g, '#2a1a10', cx - 9, by - 11, 18, 11);
      return;
    }
    case 'mausoleum': { // 납골당: 기둥 넷, 삼각 지붕, 보랏빛 불꽃
      const cols = ['#7a7486', '#8a8496', '#aaa4b8', '#4a4458'];
      stoneBlock(g, x + 2, by - 40, W - 4, 40, cols, 8);
      for (let i = 0; i < 4; i++) stoneBlock(g, x + 4 + i * (W - 14) / 3, by - 44, 6, 44, ['#9a94a6', '#aaa4b8', '#c8c2d4', '#6a6478'], 44);
      g.fillStyle = OL; g.beginPath(); g.moveTo(x - 4, by - 43); g.lineTo(cx, by - 62); g.lineTo(x + W + 4, by - 43); g.closePath(); g.fill();
      g.fillStyle = cols[1]; g.beginPath(); g.moveTo(x - 2, by - 44); g.lineTo(cx, by - 60); g.lineTo(x + W + 2, by - 44); g.closePath(); g.fill();
      R(g, OL, cx - 7, by - 28, 14, 28); R(g, '#0c0a12', cx - 6, by - 27, 12, 27);
      for (const fx of [x + 2, x + W - 4]) { const f = Math.sin(t * 9 + fx) * 1.5; R(g, '#3a3444', fx - 1, by - 8, 4, 8); glowAt(g, fx + 1, by - 13, 9, 'rgba(200,120,255,A)', 0.55); R(g, '#d8a8ff', fx, by - 15 + f, 2, 5); }
      R(g, '#c45cff', cx - 1, by - 56, 2, 8); R(g, '#c45cff', cx - 4, by - 53, 8, 2);
      return;
    }
    case 'guildHouse': { // 그림자 길드: 반쯤 무너진 건물, 그림자 눈 문장
      const cols = ['#5a5a66', '#6a6a78', '#8a8a98', '#34343e'];
      stoneBlock(g, x, by - 42, W, 42, cols, 8);
      for (let i = 0; i < 6; i++) { const r = hash(i, 5, 9); R(g, OL, x + (r % (W - 8)), by - 46 - (r >>> 4) % 6, 8, 6); }
      R(g, OL, cx - 8, by - 26, 16, 26); R(g, '#08070c', cx - 7, by - 25, 14, 25);
      g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 36, 7, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(150,110,255,${0.5 + 0.3 * Math.sin(t * 2)})`; g.beginPath(); g.ellipse(cx, by - 36, 5, 3, 0, 0, Math.PI * 2); g.fill();
      R(g, '#1a1424', cx - 1, by - 37, 2, 2);
      return;
    }
    case 'nest': { // 거대 둥지: 나뭇가지를 엮은 둥지와 큰 알
      g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 14, W / 2 + 2, 16, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a6a3a'; g.beginPath(); g.ellipse(cx, by - 14, W / 2, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a4022'; g.beginPath(); g.ellipse(cx, by - 18, W / 2 - 8, 8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#a8844a'; g.lineWidth = 1; for (let i = 0; i < 18; i++) { const a = hash(i, 6, 2) / 4294967296 * Math.PI * 2, r = W / 2 - 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * r, by - 14 + Math.sin(a) * 12); g.lineTo(cx + Math.cos(a + 0.5) * r, by - 14 + Math.sin(a + 0.5) * 12); g.stroke(); }
      for (const [ex, sc, c] of [[-12, 1, '#e8e0c8'], [2, 1.2, '#d8e8c0'], [14, 0.9, '#e8d0c0']]) { disc(g, cx + ex, by - 24, 7 * sc + 1, OL); disc(g, cx + ex, by - 24, 7 * sc, c); R(g, '#9aa880', cx + ex - 2, by - 27, 2, 2); R(g, '#ffffff', cx + ex - 3, by - 29, 2, 2); }
      return;
    }
    case 'dragonNest': { // 용의 둥지: 검은 바위 고리, 용의 해골, 용암에 데워진 알
      g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 14, W / 2 + 4, 17, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3e3438'; g.beginPath(); g.ellipse(cx, by - 14, W / 2 + 2, 15, 0, 0, Math.PI * 2); g.fill();
      glowAt(g, cx, by - 16, 30, 'rgba(255,110,30,A)', 0.45 + 0.15 * Math.sin(t * 2.5));
      g.fillStyle = '#7a2a14'; g.beginPath(); g.ellipse(cx, by - 16, W / 2 - 8, 8, 0, 0, Math.PI * 2); g.fill();
      for (const [ex, c] of [[-10, '#ff8a3a'], [4, '#ffb04a'], [14, '#e8603a']]) { disc(g, cx + ex, by - 22, 7, OL); disc(g, cx + ex, by - 22, 6, c); R(g, '#ffe8a0', cx + ex - 2, by - 25, 2, 2); }
      R(g, OL, cx - 26, by - 42, 20, 14); R(g, '#e8e0cc', cx - 25, by - 41, 18, 12); R(g, OL, cx - 21, by - 38, 3, 3); R(g, OL, cx - 15, by - 38, 3, 3);
      g.fillStyle = '#e8e0cc'; g.beginPath(); g.moveTo(cx - 26, by - 41); g.lineTo(cx - 34, by - 50); g.lineTo(cx - 24, by - 44); g.fill(); g.beginPath(); g.moveTo(cx - 9, by - 41); g.lineTo(cx - 3, by - 52); g.lineTo(cx - 10, by - 44); g.fill();
      return;
    }
  }
}

// ───── 마을의 집 (문으로 들어간다) ─────
const BLD = {
  altar: { wall: '#b8a8d0', wall2: '#a898c4', timber: '#4e3e62', roof: '#6a4ab8', roof2: '#5a3aa0', door: '#4a3060', sign: 'rune' },
  library: { wall: '#e8dcc0', wall2: '#dccfae', timber: '#6a4a2a', roof: '#3a7a8a', roof2: '#2e6676', door: '#5a3a22', sign: 'book', dormer: true },
  guild: { wall: '#b0804e', wall2: '#a07244', planks: true, timber: '#5a3a22', roof: '#9a4a32', roof2: '#823c28', door: '#4a2e1a', sign: 'scroll', board: true },
  forge: { wall: '#8e8a84', wall2: '#7e7a74', stone: true, timber: '#4a4642', roof: '#4a4a58', roof2: '#3c3c4a', door: '#3a2a20', sign: 'anvil', chimney: true, forgeWin: true },
  shop: { wall: '#f0e8d8', wall2: '#e4dac6', timber: '#7a5a3a', roof: '#4a8a3a', roof2: '#3c7430', door: '#5a3a22', sign: 'bag', awning: true },
  dojo: { wall: '#8a6038', wall2: '#7a5430', planks: true, timber: '#3a2418', roof: '#b83a32', roof2: '#9a2e28', door: '#f4ecd8', sign: 'sword', pagoda: true, shoji: true },
  home: { wall: '#ecd9b4', wall2: '#e0caa0', timber: '#6a4024', roof: '#b4603e', roof2: '#9a4e30', door: '#7a4a2a', sign: 'home', ivy: true },
  // 성지 마을 주민의 집 (종족마다 벽 · 지붕 · 간판이 다르다)
  res_mage: { wall: '#9a9ab8', wall2: '#8a8aa8', stone: true, timber: '#3e3a5a', roof: '#5a3ab0', roof2: '#4a2e94', door: '#3a2a58', sign: 'rune', dormer: true },
  res_elf: { wall: '#dce8c4', wall2: '#cedcb4', timber: '#6a5230', roof: '#3e8a3a', roof2: '#2e6e2e', door: '#5a3e22', sign: 'leaf', ivy: true },
  res_knight: { wall: '#b8b2a4', wall2: '#a8a294', stone: true, timber: '#4a4642', roof: '#3a5a9a', roof2: '#2e4a82', door: '#4a3424', sign: 'shield', chimney: true },
  res_orc: { wall: '#9a6a3e', wall2: '#8a5a32', planks: true, timber: '#4a2e1a', roof: '#7a5434', roof2: '#62422a', door: '#3a2414', sign: 'tusk', board: true },
  res_undead: { wall: '#6a6478', wall2: '#5a546a', stone: true, timber: '#2e2838', roof: '#3a2a4a', roof2: '#2e2040', door: '#1e1628', sign: 'skull' },
  res_assassin: { wall: '#4e4a58', wall2: '#423e4c', planks: true, timber: '#1e1a24', roof: '#2e2a36', roof2: '#24202c', door: '#16121c', sign: 'dagger' },
  res_dino: { wall: '#b08850', wall2: '#a07a44', planks: true, timber: '#5a3e1e', roof: '#c8a050', roof2: '#a8843a', door: '#4a3018', sign: 'egg' },
  res_dragon: { wall: '#4e4244', wall2: '#423638', stone: true, timber: '#2a2022', roof: '#a8321e', roof2: '#8a2614', door: '#2a1410', sign: 'flame', chimney: true },
  // 왕도: 귀족 저택 (지붕 색은 저택마다) · 서민 집 셋 · 감옥
  manor: { wall: '#ece4d0', wall2: '#ddd3bc', stone: true, timber: '#5a5048', roof: '#2e4a82', roof2: '#243a68', door: '#5a2a1a', sign: 'crown', dormer: true, chimney: true, columns: true, wide: true },
  town1: { wall: '#ecd9b4', wall2: '#e0caa0', timber: '#6a4024', roof: '#b4603e', roof2: '#9a4e30', door: '#7a4a2a', sign: 'home' },
  town2: { wall: '#c8b08a', wall2: '#b89e78', planks: true, timber: '#4a3020', roof: '#4a6a8a', roof2: '#3a5470', door: '#4a3020', sign: 'home', chimney: true },
  town3: { wall: '#d8d0c0', wall2: '#c8c0ae', stone: true, timber: '#5a5048', roof: '#7a5a4a', roof2: '#62483a', door: '#5a3a22', sign: 'home' },
  prison: { wall: '#6e6a74', wall2: '#5e5a64', stone: true, timber: '#2a2830', roof: '#3a3a46', roof2: '#2c2c36', door: '#26262e', sign: 'key', bars: true, wide: true },
};
const darker2 = (hex) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.round(v * 0.78)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
function drawBuilding(g, pr, t, night) {
  const st = pr.roof ? { ...BLD[pr.house], roof: pr.roof, roof2: darker2(pr.roof) } : BLD[pr.house], x = pr.x * TILE, y = pr.y * TILE, W = pr.w * TILE, H = pr.h * TILE, by = y + H;
  const dx = pr.doorX ?? x + W / 2, wallH = 44, eave = by - wallH, roofTop = y - 26;
  // 그림자
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(x + 4, by); g.lineTo(x + W + 10, by); g.lineTo(x + W + 4, by - 8); g.lineTo(x + 4, by - 8); g.fill();
  // 앞벽
  R(g, OL, x - 1, eave - 1, W + 2, wallH + 1);
  R(g, st.wall, x, eave, W, wallH);
  if (st.stone) { for (let r = 0; r * 8 < wallH; r++) for (let k = (r % 2) * 7; k < W; k += 14) { R(g, st.wall2, x + k + 1, eave + r * 8 + 1, Math.min(12, W - k - 1), 6); R(g, 'rgba(255,255,255,0.12)', x + k + 1, eave + r * 8 + 1, Math.min(12, W - k - 1), 1); } }
  else if (st.planks) { for (let k = 0; k < W; k += 6) { R(g, k % 12 ? st.wall2 : st.wall, x + k, eave, Math.min(6, W - k), wallH); R(g, 'rgba(0,0,0,0.22)', x + k + 5, eave, 1, wallH); } }
  else { // 회벽 + 나무 기둥 (반목조)
    for (let k = 0; k < W; k += 4) R(g, st.wall2, x + k, eave + 2, 1, wallH - 8);
    R(g, st.timber, x, eave, W, 3); R(g, st.timber, x, eave + wallH / 2 - 1, W, 2);
    for (const px of [x, x + W - 4, x + W * 0.25 - 2, x + W * 0.75 - 2]) R(g, st.timber, px, eave, 4, wallH);
    g.strokeStyle = st.timber; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4, eave + 3); g.lineTo(x + W * 0.25 - 2, eave + wallH / 2); g.moveTo(x + W - 4, eave + 3); g.lineTo(x + W * 0.75 + 2, eave + wallH / 2); g.stroke();
  }
  R(g, '#6a6660', x - 1, by - 5, W + 2, 5); R(g, '#8a8680', x - 1, by - 5, W + 2, 1); // 주춧돌
  // 창문 (문 양옆)
  const win = (wx, wy, ww, wh) => {
    if (st.bars) { // 감옥: 작고 어두운 창 · 쇠창살
      R(g, OL, wx - 1, wy + 1, ww + 2, wh - 2); R(g, night ? '#5a4a2a' : '#141018', wx, wy + 2, ww, wh - 4);
      for (let k = 2; k < ww; k += 3) R(g, '#6a6a76', wx + k, wy + 2, 1, wh - 4);
      R(g, '#4a4a56', wx - 1, wy + 1, ww + 2, 1); return;
    }
    R(g, OL, wx - 2, wy - 2, ww + 4, wh + 4); R(g, st.timber, wx - 1, wy - 1, ww + 2, wh + 2);
    R(g, night ? '#ffd27a' : '#7ab8e0', wx, wy, ww, wh); R(g, night ? '#fff0b0' : '#b8e0f8', wx, wy, ww, 3);
    R(g, st.timber, wx + ww / 2 - 1, wy, 2, wh); R(g, st.timber, wx, wy + wh / 2 - 1, ww, 2);
    R(g, 'rgba(255,255,255,0.5)', wx + 1, wy + 1, 2, 2);
    R(g, OL, wx - 3, wy + wh + 2, ww + 6, 5); R(g, '#7a5232', wx - 2, wy + wh + 3, ww + 4, 3);
    for (let i = 0; i < ww; i += 4) R(g, ['#e83a5a', '#ffd040', '#ff8ab8'][(i / 4 + pr.x) % 3], wx + i, wy + wh, 3, 2); // 꽃 상자
  };
  if (st.forgeWin) { // 대장간: 벽에 뚫린 화로창 (불빛)
    const fx = x + 8, fw = Math.min(26, dx - x - 20);
    R(g, OL, fx - 2, by - 26, fw + 4, 18); R(g, '#1a0e0a', fx, by - 24, fw, 14);
    const f = 0.7 + 0.3 * Math.sin(t * 8) * Math.sin(t * 4.7);
    glowAt(g, fx + fw / 2, by - 17, 22, 'rgba(255,130,40,A)', 0.5 * f);
    R(g, '#ff7a1a', fx + 2, by - 16, fw - 4, 5); R(g, '#ffc040', fx + fw / 2 - 3 + Math.sin(t * 6) * 2, by - 20, 6, 5);
    R(g, OL, fx - 3, by - 28, fw + 6, 3); R(g, '#5a5a62', fx - 2, by - 27, fw + 4, 1);
    win(x + W - 26, eave + 10, 14, 13);
  } else if (st.shoji) { // 수련장: 창호지 미닫이
    for (const wx of [x + 8, x + W - 30]) { R(g, OL, wx - 1, eave + 8, 24, 26); R(g, night ? '#ffe2a8' : '#f4ecd8', wx, eave + 9, 22, 24); for (let k = 0; k < 22; k += 7) R(g, '#5a3a22', wx + k, eave + 9, 1, 24); for (let k = 0; k < 24; k += 8) R(g, '#5a3a22', wx, eave + 9 + k, 22, 1); }
  } else { win(x + 9, eave + 10, 14, 13); win(x + W - 23, eave + 10, 14, 13); if (st.wide) { win(x + 27, eave + 10, 14, 13); win(x + W - 41, eave + 10, 14, 13); } }
  // 문
  if (st.shoji) { R(g, OL, dx - 10, by - 30, 20, 30); R(g, '#f4ecd8', dx - 9, by - 29, 18, 29); R(g, '#5a3a22', dx - 1, by - 29, 2, 29); for (let k = 0; k < 29; k += 7) R(g, '#5a3a22', dx - 9, by - 29 + k, 18, 1); }
  else {
    R(g, OL, dx - 10, by - 31, 20, 31); R(g, st.timber, dx - 9, by - 30, 18, 30);
    R(g, st.door, dx - 7, by - 27, 14, 27); for (let k = -5; k < 7; k += 4) R(g, 'rgba(0,0,0,0.22)', dx + k, by - 27, 1, 27);
    g.fillStyle = st.door; g.beginPath(); g.ellipse(dx, by - 27, 7, 4, 0, Math.PI, 0); g.fill();
    R(g, '#e8c060', dx + 3, by - 13, 2, 2);
    R(g, OL, dx - 13, by - 35, 26, 4); R(g, st.roof2, dx - 12, by - 34, 24, 2); // 문 위 처마
  }
  R(g, '#9a8a72', dx - 11, by - 1, 22, 3); R(g, '#b8a888', dx - 11, by - 1, 22, 1); // 문턱 돌
  if (st.columns) { // 저택: 문 양옆 흰 기둥 · 문 위 작은 발코니와 가문 깃발
    for (const px of [dx - 16, dx + 12]) { R(g, OL, px - 1, by - 38, 6, 38); R(g, '#f4f0e6', px, by - 37, 4, 36); R(g, '#d8d2c4', px + 3, by - 37, 1, 36); R(g, OL, px - 2, by - 40, 8, 3); R(g, '#f4f0e6', px - 1, by - 39, 6, 1); }
    R(g, OL, dx - 18, by - 42, 36, 4); R(g, '#e8e0d0', dx - 17, by - 41, 34, 2);
    for (let k = -15; k <= 15; k += 5) R(g, OL, dx + k, by - 48, 1, 6); R(g, OL, dx - 17, by - 49, 34, 2);
    R(g, OL, dx - 4, by - 66, 9, 16); R(g, st.roof, dx - 3, by - 65, 7, 13); R(g, '#ffd76a', dx - 1, by - 61, 3, 3);
  }
  // 지붕
  const rl = x - 7, rr = x + W + 7, inset = 5;
  g.fillStyle = OL; g.beginPath(); g.moveTo(rl - 1, eave + 3); g.lineTo(rl + inset - 1, roofTop - 1); g.lineTo(rr - inset + 1, roofTop - 1); g.lineTo(rr + 1, eave + 3); g.closePath(); g.fill();
  g.fillStyle = st.roof; g.beginPath(); g.moveTo(rl, eave + 2); g.lineTo(rl + inset, roofTop); g.lineTo(rr - inset, roofTop); g.lineTo(rr, eave + 2); g.closePath(); g.fill();
  const rh = eave + 2 - roofTop;
  for (let k = 6; k < rh; k += 6) { const yy = roofTop + k, off = inset * (1 - k / rh); R(g, st.roof2, rl + off, yy, rr - rl - off * 2, 2); for (let j = rl + off + ((k / 6) % 2) * 5; j < rr - off - 2; j += 10) R(g, st.roof2, j, yy - 4, 1, 4); }
  R(g, lighter2(st.roof), rl + inset, roofTop, rr - rl - inset * 2, 2);
  R(g, 'rgba(0,0,0,0.3)', x, eave + 3, W, 3); // 처마 그늘
  if (st.pagoda) { for (const [ex, s] of [[rl - 2, -1], [rr + 2, 1]]) { g.fillStyle = OL; g.beginPath(); g.moveTo(ex - s * 2, eave + 4); g.lineTo(ex + s * 5, eave - 6); g.lineTo(ex + s * 2, eave + 4); g.fill(); } R(g, OL, rl + inset + 4, roofTop - 5, rr - rl - inset * 2 - 8, 5); R(g, st.roof2, rl + inset + 5, roofTop - 4, rr - rl - inset * 2 - 10, 3); }
  if (st.dormer) { const ddx = x + W * 0.3; R(g, OL, ddx - 8, roofTop + 6, 16, 14); R(g, st.wall, ddx - 7, roofTop + 7, 14, 12); R(g, night ? '#ffd27a' : '#7ab8e0', ddx - 4, roofTop + 9, 8, 7); R(g, st.timber, ddx - 1, roofTop + 9, 2, 7); g.fillStyle = OL; g.beginPath(); g.moveTo(ddx - 10, roofTop + 7); g.lineTo(ddx, roofTop - 1); g.lineTo(ddx + 10, roofTop + 7); g.fill(); g.fillStyle = st.roof2; g.beginPath(); g.moveTo(ddx - 8, roofTop + 6); g.lineTo(ddx, roofTop + 1); g.lineTo(ddx + 8, roofTop + 6); g.fill(); }
  if (st.chimney || pr.house === 'shop' || pr.house === 'library') { // 굴뚝
    const chx = x + W - 22, chh = st.chimney ? 30 : 18;
    R(g, OL, chx - 1, roofTop - chh + 8, 12, chh); R(g, st.chimney ? '#6a3a2e' : '#8a6a5a', chx, roofTop - chh + 9, 10, chh - 2);
    for (let r = 0; r < chh - 4; r += 5) R(g, 'rgba(0,0,0,0.2)', chx, roofTop - chh + 12 + r, 10, 1);
    R(g, OL, chx - 2, roofTop - chh + 6, 14, 4); R(g, '#4a4a52', chx - 1, roofTop - chh + 7, 12, 2);
    if (st.chimney) glowAt(g, chx + 5, roofTop - chh + 6, 10, 'rgba(255,120,40,A)', 0.35 + 0.15 * Math.sin(t * 5));
    pr.smokeAt = { x: chx + 5, y: roofTop - chh + 4, heavy: !!st.chimney };
  }
  if (st.awning) { // 잡화점: 줄무늬 차양 (창문 위)
    const ay = eave + 4, aw = 22;
    for (const sx0 of [x + 5, x + W - 27]) {
      R(g, OL, sx0 - 1, ay - 1, aw + 2, 9);
      for (let k = 0; k < aw; k += 6) { const col = (k / 6) % 2 ? '#f4f0e8' : '#4a9a3a'; R(g, col, sx0 + k, ay, Math.min(6, aw - k), 7); g.fillStyle = col; g.beginPath(); g.moveTo(sx0 + k, ay + 7); g.lineTo(sx0 + k + 3, ay + 10); g.lineTo(sx0 + Math.min(k + 6, aw), ay + 7); g.fill(); }
    }
  }
  // 간판 (문 옆 쇠 받침에 매단)
  const sx = dx + 14, sy = eave + 6, sw = Math.sin(t * 1.5 + pr.x) * 0.6;
  R(g, OL, sx - 1, sy - 2, 14, 3); R(g, '#4a4a52', sx, sy - 1, 12, 1);
  R(g, OL, sx + 2, sy, 1, 4); R(g, OL, sx + 10, sy, 1, 4);
  R(g, OL, sx - 1 + sw, sy + 3, 14, 13); R(g, '#c89a5a', sx + sw, sy + 4, 12, 11); R(g, '#a87a42', sx + sw, sy + 13, 12, 2);
  drawSignIcon(g, st.sign, sx + 6 + sw, sy + 9);
  if (st.board) { const bx = x + 3, byy = by - 30; R(g, OL, bx, byy, 18, 16); R(g, '#8a6038', bx + 1, byy + 1, 16, 14); for (const [ox, oy] of [[3, 3], [9, 2], [4, 8], [10, 8]]) { R(g, '#f4ecd0', bx + ox, byy + oy, 5, 5); R(g, '#c83a3a', bx + ox + 2, byy + oy, 1, 1); } R(g, OL, bx + 3, byy + 16, 2, 14); R(g, OL, bx + 13, byy + 16, 2, 14); }
  if (pr.house === 'forge') { const ox = W + 2; R(g, OL, x + ox, by - 16, 12, 16); R(g, '#8a5a32', x + ox + 1, by - 15, 10, 14); R(g, '#4a4a52', x + ox + 1, by - 12, 10, 2); R(g, '#4a4a52', x + ox + 1, by - 5, 10, 2); }
  if (pr.house === 'shop') { R(g, OL, x - 10, by - 14, 12, 14); R(g, '#9a6a3a', x - 9, by - 13, 10, 12); R(g, '#e8c060', x - 7, by - 16, 3, 3); R(g, '#e83a3a', x - 4, by - 17, 3, 3); R(g, '#5aa848', x - 7, by - 19, 2, 3); }
  if (pr.house === 'dojo') for (const [bx, col] of [[x - 4, '#b83a3a'], [x + W - 2, '#3a5ab8']]) { R(g, OL, bx, by - 42, 2, 42); R(g, OL, bx + 2, by - 40, 9, 20); R(g, col, bx + 3, by - 39, 7, 18); R(g, '#f0d060', bx + 5, by - 33, 3, 4); }
  if (st.ivy) { // 내 집: 벽을 타고 오르는 담쟁이 + 장작더미 + 화분
    for (let i = 0; i < 14; i++) { const vx = x + 1 + (hash(i, 3, pr.x) % 7), vy = by - 6 - i * 3; R(g, i % 3 ? '#4a8a3a' : '#6aaa4a', vx, vy, 3, 2); }
    for (let i = 0; i < 9; i++) { const vx = x + W - 8 + (hash(i, 5, pr.y) % 6), vy = by - 6 - i * 4; R(g, i % 2 ? '#4a8a3a' : '#5a9a42', vx, vy, 3, 2); }
    const lx = x + W + 3; for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) { const ox = lx + k * 6 + r * 3, oy = by - 5 - r * 5; R(g, OL, ox - 1, oy - 1, 7, 6); R(g, '#9a6a3e', ox, oy, 5, 4); R(g, '#d8b080', ox + 1, oy + 1, 3, 2); }
    R(g, OL, x - 9, by - 9, 8, 9); R(g, '#b85a3a', x - 8, by - 8, 6, 7); R(g, '#3e8a32', x - 9, by - 14, 8, 6); R(g, '#e8506a', x - 7, by - 15, 2, 2); R(g, '#ffd040', x - 4, by - 13, 2, 2);
  }
}
const lighter2 = (hex) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.min(255, v + 40); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
function drawSignIcon(g, kind, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (kind === 'anvil') { R(g, OL, x - 4, y - 2, 9, 3); R(g, OL, x - 2, y, 5, 3); R(g, OL, x - 3, y + 2, 7, 1); }
  else if (kind === 'book') { R(g, OL, x - 4, y - 3, 8, 6); R(g, '#3a6aa8', x - 3, y - 2, 3, 4); R(g, '#a83a3a', x, y - 2, 3, 4); }
  else if (kind === 'rune') { R(g, '#6a4ab8', x - 1, y - 4, 2, 8); R(g, '#6a4ab8', x - 3, y - 1, 6, 2); R(g, '#9a7ae8', x - 1, y - 4, 1, 3); }
  else if (kind === 'scroll') { R(g, OL, x - 4, y - 3, 8, 6); R(g, '#f4ecd0', x - 3, y - 2, 6, 4); R(g, '#8a7a5a', x - 2, y - 1, 4, 1); }
  else if (kind === 'bag') { R(g, OL, x - 3, y - 2, 7, 6); R(g, '#d4b67e', x - 2, y - 1, 5, 4); R(g, OL, x - 1, y - 4, 3, 2); R(g, '#e8c060', x - 1, y, 2, 2); }
  else if (kind === 'sword') { R(g, OL, x - 1, y - 5, 2, 8); R(g, '#e8eef4', x, y - 5, 1, 7); R(g, OL, x - 3, y + 1, 6, 1); R(g, OL, x - 1, y + 2, 2, 2); }
  else if (kind === 'leaf') { R(g, '#3e8a3a', x - 3, y - 2, 6, 4); R(g, '#6ac85a', x - 2, y - 2, 3, 2); R(g, '#2e5a24', x - 1, y + 1, 1, 3); }
  else if (kind === 'shield') { R(g, OL, x - 3, y - 4, 7, 8); R(g, '#2a4a9a', x - 2, y - 3, 5, 6); R(g, '#ffd76a', x, y - 2, 1, 4); }
  else if (kind === 'tusk') { R(g, '#f0e6cc', x - 3, y - 3, 2, 6); R(g, '#f0e6cc', x + 2, y - 3, 2, 6); R(g, '#f0e6cc', x - 2, y + 2, 5, 1); }
  else if (kind === 'skull') { R(g, '#e8e0cc', x - 3, y - 3, 7, 5); R(g, '#e8e0cc', x - 2, y + 2, 5, 2); R(g, OL, x - 2, y - 1, 2, 2); R(g, OL, x + 1, y - 1, 2, 2); }
  else if (kind === 'dagger') { R(g, '#d0d8e4', x, y - 5, 1, 7); R(g, OL, x - 2, y + 2, 5, 1); R(g, '#6a4a8a', x, y + 3, 1, 2); }
  else if (kind === 'egg') { R(g, '#e8e0c8', x - 2, y - 3, 5, 7); R(g, '#e8e0c8', x - 3, y - 1, 7, 4); R(g, '#9aa880', x - 1, y - 1, 1, 1); R(g, '#9aa880', x + 1, y + 1, 1, 1); }
  else if (kind === 'flame') { R(g, '#ff7a1a', x - 2, y - 2, 5, 5); R(g, '#ff7a1a', x - 1, y - 4, 3, 2); R(g, '#ffd040', x - 1, y - 1, 3, 3); }
  else if (kind === 'crown') { R(g, '#ffd76a', x - 4, y, 9, 3); R(g, '#ffd76a', x - 4, y - 3, 2, 3); R(g, '#ffd76a', x - 1, y - 4, 3, 4); R(g, '#ffd76a', x + 3, y - 3, 2, 3); R(g, '#e83a3a', x, y + 1, 1, 1); }
  else if (kind === 'key') { R(g, OL, x - 4, y - 3, 5, 5); R(g, '#c8a040', x - 3, y - 2, 3, 3); R(g, '#c8a040', x, y - 1, 5, 1); R(g, '#c8a040', x + 3, y, 1, 2); R(g, '#c8a040', x + 1, y, 1, 2); }
  else if (kind === 'home') { R(g, '#b4603e', x - 4, y - 1, 9, 2); R(g, '#b4603e', x - 3, y - 2, 7, 1); R(g, '#b4603e', x - 1, y - 3, 3, 1); R(g, '#ecd9b4', x - 3, y + 1, 7, 4); R(g, '#7a4a2a', x - 1, y + 2, 2, 3); }
}

// 성물: 받침돌 위에서 떠오르는 빛 (종족 색)
export function drawRelic(g, o, t, color, taken) {
  const x = Math.round(o.x), y = Math.round(o.y);
  shadowEllipse(g, x, y + 4, 8, 3);
  R(g, OL, x - 7, y - 6, 14, 10); R(g, '#8a8478', x - 6, y - 5, 12, 8); R(g, '#a8a296', x - 6, y - 5, 12, 2);
  if (taken) return;
  const fy = y - 16 + Math.sin(t * 2.4 + x) * 2;
  const rr = parseInt(color.slice(1, 3), 16), gg = parseInt(color.slice(3, 5), 16), bb = parseInt(color.slice(5, 7), 16);
  glowAt(g, x, fy, 16, `rgba(${rr},${gg},${bb},A)`, 0.6);
  g.fillStyle = OL; g.beginPath(); g.moveTo(x, fy - 6); g.lineTo(x + 5, fy); g.lineTo(x, fy + 6); g.lineTo(x - 5, fy); g.closePath(); g.fill();
  g.fillStyle = color; g.beginPath(); g.moveTo(x, fy - 5); g.lineTo(x + 4, fy); g.lineTo(x, fy + 5); g.lineTo(x - 4, fy); g.closePath(); g.fill();
  R(g, '#ffffff', x - 1, fy - 3, 1, 2);
}
// 표지판
export function drawSign(g, o) {
  const x = Math.round(o.x), y = Math.round(o.y);
  shadowEllipse(g, x, y + 5, 6, 2);
  R(g, OL, x - 2, y - 14, 4, 19); R(g, '#7a5434', x - 1, y - 13, 2, 17);
  R(g, OL, x - 10, y - 20, 20, 9); R(g, '#b08a5a', x - 9, y - 19, 18, 7); R(g, '#8a6a3e', x - 7, y - 17, 14, 1); R(g, '#8a6a3e', x - 7, y - 15, 10, 1);
}
// 바닷가의 자라
export function drawTurtle(g, o, t) {
  const x = Math.round(o.x), y = Math.round(o.y) + 2, bob = Math.round(Math.sin(t * 2) * 1);
  shadowEllipse(g, x, y + 4, 11, 3);
  R(g, OL, x + 8, y - 8 + bob, 8, 7); R(g, '#7ab05a', x + 9, y - 7 + bob, 6, 5); R(g, OL, x + 13, y - 6 + bob, 1, 1);
  g.fillStyle = OL; g.beginPath(); g.ellipse(x, y - 4, 11, 7, 0, Math.PI, 0); g.fill(); R(g, OL, x - 11, y - 4, 22, 3);
  g.fillStyle = '#4a7a3a'; g.beginPath(); g.ellipse(x, y - 4, 10, 6, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#6a9a4a'; for (const [dx, dy] of [[-5, -6], [0, -8], [5, -6]]) g.fillRect(x + dx - 2, y + dy, 4, 3);
  R(g, '#3a5a2a', x - 10, y - 3, 20, 2); R(g, '#7ab05a', x - 9, y - 1, 4, 2); R(g, '#7ab05a', x + 5, y - 1, 4, 2);
}

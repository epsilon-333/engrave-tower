// 탑 안 · 굴 바닥을 픽셀로 직접 그린다 (예전: 0x72 판석 타일에 색조만 입혀 모든 구역이 같은 격자로 보였다)
// 구역마다: 땅(노이즈 3색 · 디더링) → 덮개(이끼 · 물이끼 · 재 · 눈 · 풀) → 옛 돌바닥(불규칙한 판석, 구역마다 남은 정도가 다르다)
// → 벽 가까이 그늘 → 작은 것(자갈 · 금 · 풀 · 버섯 · 뼈 · 불씨 금 …) · 벽면(바위 층 · 벽돌) · 벽 윗면(바위 덩어리)
import { TILE, T_WALL, T_CRACK } from '../sim/mapgen.js';

function hash(x, y, s = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const rnd = (x, y, s) => hash(x, y, s) / 4294967296;
const sm = (t) => t * t * (3 - 2 * t);
function noise(x, y, sc, salt) { // 값 노이즈 0~1
  const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), u = sm(fx - x0), v = sm(fy - y0);
  const a = rnd(x0, y0, salt), b = rnd(x0 + 1, y0, salt), c = rnd(x0, y0 + 1, salt), d = rnd(x0 + 1, y0 + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((b) => ((b + 0.5) / 16 - 0.5) * 0.14);

// base: 땅 [보통, 밝음, 어두움] · patch: 덮개 (cover: 얼마나 덮나 · wall: 벽 가까이 더) · slab: 옛 돌바닥 [보통, 밝음, 어두움, 틈] (amt: 남은 정도)
// face: 벽면 [틈 · 어두움, 보통, 밝음, 윗단] · kind rock(바위 층) | brick(돌을 쌓은 벽) · mass: 벽 윗면 [어두움, 보통, 테두리]
// drip: 벽면 위에서 늘어지는 것 · bits: 작은 것 [종류, 칸당 확률]
const THEMES = {
  cave: { // 이끼 굴: 축축한 흙 · 짙은 이끼 · 무너진 옛 판석
    base: ['#4b4536', '#5a523f', '#3a352a'], patch: { cols: ['#3a5a29', '#4a7034', '#2c4422'], cover: 0.36, wall: 0.35, sc: 30 },
    slab: { cols: ['#55503f', '#615b49', '#46412f', '#2c271f'], amt: 0.3, sc: 11 },
    face: { cols: ['#221e19', '#3e382f', '#544c3f', '#6a6150'], kind: 'rock' }, mass: ['#16130f', '#1f1b16', '#3c4a2c'],
    drip: 'moss', bits: [['pebble', 0.22], ['crack', 0.12], ['tuft', 0.18], ['shroom', 0.04], ['root', 0.06], ['leaf', 0.06]],
  },
  swamp: { // 독늪: 진흙 · 물이끼 · 갈대
    base: ['#3f3a26', '#4b4630', '#2f2b1c'], patch: { cols: ['#4d5a22', '#67782e', '#363f19'], cover: 0.5, wall: 0.3, sc: 26 },
    slab: { cols: ['#53503c', '#625e48', '#423f2f', '#221f15'], amt: 0.12, sc: 12 },
    face: { cols: ['#1c1a10', '#36331f', '#4a462c', '#5e6a2c'], kind: 'rock' }, mass: ['#121108', '#1a190e', '#3e4a1e'],
    drip: 'slime', bits: [['reed', 0.22], ['bubble', 0.12], ['pebble', 0.12], ['tuft', 0.2], ['crack', 0.06]],
  },
  rift: { // 화산 균열: 현무암 · 재 · 빛나는 금
    base: ['#3a2c29', '#47362f', '#2a1f1d'], patch: { cols: ['#56504d', '#6c6461', '#433c3a'], cover: 0.3, wall: 0.15, sc: 28 },
    slab: { cols: ['#4c3b35', '#5c4840', '#3a2c28', '#1a1210'], amt: 0.28, sc: 12 },
    face: { cols: ['#1a1212', '#3a2826', '#523834', '#7a4a34'], kind: 'rock' }, mass: ['#120c0c', '#1c1414', '#6a3020'],
    drip: 'glow', bits: [['ember', 0.16], ['pebbleDark', 0.2], ['crack', 0.14], ['ash', 0.14]],
  },
  frost: { // 서리 회랑: 푸른 돌 · 쌓인 눈 · 얼음 조각
    base: ['#6d8193', '#7b90a2', '#5a6c7e'], patch: { cols: ['#d8e4ee', '#f2f7fb', '#b8c8d8'], cover: 0.36, wall: 0.4, sc: 24 },
    slab: { cols: ['#7a8ea0', '#8a9eb0', '#687c8e', '#4a5a6c'], amt: 0.4, sc: 13 },
    face: { cols: ['#2a3442', '#4a5a6c', '#6a7c90', '#c8dcec'], kind: 'rock' }, mass: ['#141a22', '#1c2430', '#8aa6be'],
    drip: 'ice', bits: [['sparkle', 0.2], ['iceShard', 0.08], ['crack', 0.1], ['pebble', 0.1]],
  },
  grave: { // 그림자 묘지: 검은 흙 · 마른 풀 · 무덤 돌바닥 · 뼈
    base: ['#2f2a33', '#3a3440', '#231f28'], patch: { cols: ['#47402f', '#59503b', '#352f24'], cover: 0.3, wall: 0.2, sc: 26 },
    slab: { cols: ['#45404c', '#544e5c', '#36323c', '#18151c'], amt: 0.45, sc: 12 },
    face: { cols: ['#16131a', '#2e2a34', '#423c4a', '#5a5266'], kind: 'brick' }, mass: ['#0e0c12', '#16131a', '#4a3e5a'],
    drip: 'web', bits: [['bone', 0.08], ['crack', 0.14], ['tuftDead', 0.18], ['pebble', 0.12], ['fungus', 0.05]],
  },
  sky: { // 하늘 정원: 풀밭 · 흰 돌길 · 꽃
    base: ['#5a9a48', '#6aaa52', '#4a863c'], patch: { cols: ['#7ab85a', '#90cc6c', '#5c9a46'], cover: 0.4, wall: 0, sc: 22 },
    slab: { cols: ['#c9ccd2', '#dcdfe4', '#a9adb5', '#7a7e88'], amt: 0.3, sc: 12 },
    face: { cols: ['#5a5e68', '#9aa0aa', '#c4c8d0', '#e8ecf2'], kind: 'brick' }, mass: ['#3a3e48', '#4a4e58', '#dce2ea'],
    drip: 'vine', bits: [['flower', 0.16], ['tuft', 0.3], ['pebble', 0.06]],
  },
  mirror: { // 거울 미궁: 은빛 판석 · 반짝이는 조각
    base: ['#848fa2', '#94a0b2', '#717c90'], patch: null,
    slab: { cols: ['#8e9aae', '#a6b2c6', '#7a869a', '#566076'], ashlar: 21 },
    face: { cols: ['#2a3040', '#58627a', '#8a96ae', '#d8e4f4'], kind: 'brick' }, mass: ['#141824', '#1c2230', '#aab8d0'],
    drip: null, bits: [['sparkle', 0.18], ['shard', 0.06], ['crack', 0.06]],
  },
  clock: { // 태엽 시계탑: 구리 판 · 리벳 · 기름 얼룩
    base: ['#5c4430', '#6c5038', '#4a3626'], patch: { cols: ['#3a2e24', '#45372a', '#2e241c'], cover: 0.22, wall: 0.1, sc: 20 },
    slab: { cols: ['#7a5a38', '#8e6c46', '#64482e', '#3a2818'], ashlar: 22, rivet: '#b89058' },
    face: { cols: ['#24180e', '#4e3622', '#6e4e30', '#c89a50'], kind: 'brick' }, mass: ['#140e08', '#1e150c', '#8a6a3a'],
    drip: null, bits: [['gear', 0.06], ['bolt', 0.1], ['crack', 0.06]],
  },
  library: { // 별의 서고: 남보랏빛 판석 · 종이 · 먹 얼룩
    base: ['#2f2d45', '#39374f', '#25233a'], patch: { cols: ['#3e2a3a', '#4c3446', '#30202c'], cover: 0.18, wall: 0.05, sc: 30 },
    slab: { cols: ['#3a3854', '#46446a', '#2e2c44', '#1e1c34'], ashlar: 19 },
    face: { cols: ['#14122a', '#2e2c48', '#44426a', '#8a86c0'], kind: 'brick' }, mass: ['#0c0a1a', '#141228', '#6a66a0'],
    drip: null, bits: [['paper', 0.12], ['inkDot', 0.08], ['starDust', 0.12], ['crack', 0.05]],
  },
  summit: { // 빛의 정상: 금빛 흰 대리석 · 금 상감
    base: ['#c8b892', '#d8c8a2', '#b0a07c'], patch: null,
    slab: { cols: ['#d4c6a2', '#e4d7b6', '#c0b28e', '#9a8a66'], ashlar: 23, inlay: '#e0b850' },
    face: { cols: ['#6a5a3a', '#a8946a', '#cdbb90', '#fff0c0'], kind: 'brick' }, mass: ['#3a3020', '#4a3e2a', '#f0dca0'],
    drip: null, bits: [['lightShard', 0.08], ['featherGold', 0.05], ['sparkle', 0.14]],
  },
};
export const hasGroundTheme = (world) => !!(world.zone && THEMES[world.zone.id] && !world.map.outdoor && !world.map.plaza && !world.map.ship && !world.map.underwater);

// 땅 · 덮개 · 판석은 맵의 칸과 상관없는 고정 무늬라 한 번만 셈한다 (책장 · 무너지는 벽으로 다시 그릴 때는 벽만 다시)
const groundCache = new WeakMap();
function groundLayer(world, T, W, H) {
  const key = world.map, c = groundCache.get(key);
  if (c && c.id === world.zone.id) return c.px;
  const px = new Uint8ClampedArray(W * H * 3), B = T.base.map(hex), P = T.patch && T.patch.cols.map(hex), S = T.slab && T.slab.cols.map(hex);
  const { tw, th } = world;
  // 벽 가까움 (칸마다 5×5 둘레의 벽 비율 → 픽셀에서 부드럽게 보간: 칸 경계가 드러나지 않게)
  const near = new Float32Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= tw || yy >= th || world.tiles[yy * tw + xx] === T_WALL) n++; } near[y * tw + x] = n / 25; }
  const nearAt = (x, y) => { const fx = Math.max(0, Math.min(tw - 1.001, x / TILE - 0.5)), fy = Math.max(0, Math.min(th - 1.001, y / TILE - 0.5)), x0 = fx | 0, y0 = fy | 0, u = fx - x0, v = fy - y0, x1 = Math.min(tw - 1, x0 + 1), y1 = Math.min(th - 1, y0 + 1); const a = near[y0 * tw + x0], b = near[y0 * tw + x1], c2 = near[y1 * tw + x0], d = near[y1 * tw + x1]; return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v; };
  const sc = T.slab?.sc || 12;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dz = BAYER[(y & 3) * 4 + (x & 3)];
    let n = noise(x, y, 40, 11) * 0.62 + noise(x, y, 11, 12) * 0.28 + noise(x, y, 4, 13) * 0.1 + dz;
    let col = n < 0.4 ? B[2] : n < 0.62 ? B[0] : B[1];
    // 옛 돌바닥: 흩어진 점에서 가장 가까운 점 둘의 거리 차가 작으면 틈 (불규칙한 판석)
    if (S && T.slab.ashlar) { // 지어진 바닥: 줄마다 길이가 다른 직사각형 판석을 엇갈려 깐다 (칸 격자와 크기가 달라 모눈으로 보이지 않는다)
      const rh = T.slab.ashlar, row = Math.floor(y / rh), iy = y - row * rh, off = (hash(row, 0, 81) % 61);
      let sx = -off, w0 = 0, sid = 0; for (let k = 0; ; k++) { w0 = Math.round(rh * 0.9) + hash(row, k, 82) % Math.round(rh * 1.1); if (sx + w0 > x) { sid = hash(row, k, 83); break; } sx += w0; }
      const ix = x - sx, sh = (sid & 255) / 255 + noise(x, y, 7, 22) * 0.3 + dz - 0.15;
      col = iy === rh - 1 || ix === w0 - 1 ? S[3] : iy === 0 || ix === 0 ? S[1] : iy === rh - 2 || ix === w0 - 2 ? S[2] : sh < 0.3 ? S[2] : sh > 0.88 ? S[1] : S[0];
      if (T.slab.rivet && (iy === 2 || iy === rh - 3) && (ix === 2 || ix === w0 - 3)) col = hex(T.slab.rivet);
      if (T.slab.inlay && (sid >>> 9) % 5 === 0 && iy > 1 && iy < rh - 2 && ix > 1 && ix < w0 - 2 && (iy === 2 || iy === rh - 3 || ix === 2 || ix === w0 - 3)) col = hex(T.slab.inlay);
    } else if (S && noise(x, y, 54, 21) + (T.slab.amt - 0.5) * 1.1 > 0.5) {
      const gx = Math.floor(x / sc), gy = Math.floor(y / sc); let d1 = 1e9, d2 = 1e9, id = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = gx + i, cy = gy + j, h = hash(cx, cy, 31), ox = (cx + 0.15 + ((h & 255) / 255) * 0.7) * sc, oy = (cy + 0.15 + (((h >>> 8) & 255) / 255) * 0.7) * sc;
        const d = (x - ox) * (x - ox) + (y - oy) * (y - oy) * 1.15;
        if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      if (edge < 1.1) col = S[3];
      else {
        const shade = ((id >>> 16) & 255) / 255 + noise(x, y, 6, 22) * 0.35 + dz - 0.17;
        col = edge < 2.1 && ((id >>> 3) & 1) ? S[2] : shade < 0.38 ? S[2] : shade > 0.86 ? S[1] : S[0];
        if (T.slab.rivet && edge > 2.6 && edge < 3.6 && ((x + y) % 5 === 0)) col = hex(T.slab.rivet);
        if (T.slab.inlay && edge >= 1.1 && edge < 1.8 && ((id >>> 20) % 3 === 0)) col = hex(T.slab.inlay);
      }
    }
    // 덮개 (이끼 · 눈 …): 벽 가까이 더 덮인다 · 가장자리는 디더링
    if (P) {
      const m = noise(x, y, T.patch.sc, 41) * 0.75 + noise(x, y, 7, 42) * 0.25 + nearAt(x, y) * T.patch.wall + dz * 0.8;
      const th0 = 1 - T.patch.cover;
      if (m > th0) col = m > th0 + 0.16 ? (noise(x, y, 5, 43) > 0.62 ? P[1] : P[0]) : m > th0 + 0.04 ? P[0] : P[2];
    }
    const o = (y * W + x) * 3; px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2];
  }
  groundCache.set(key, { id: world.zone.id, px });
  return px;
}

export function paintTowerGround(world, g) {
  const T = THEMES[world.zone.id], { tw, th, tiles } = world, W = tw * TILE, H = th * TILE;
  const at = (x, y) => (x < 0 || y < 0 || x >= tw || y >= th ? T_WALL : tiles[y * tw + x]);
  const solid = (t) => t === T_WALL || t === T_CRACK, open = (x, y) => !solid(at(x, y)), face = (x, y) => solid(at(x, y)) && open(x, y + 1);
  const ground = groundLayer(world, T, W, H);
  const img = g.createImageData(W, H), d = img.data;
  const F = T.face.cols.map(hex), M = T.mass.map(hex);
  const put = (x, y, c, a = 1) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; if (a >= 1) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; } else { d[o] += (c[0] - d[o]) * a; d[o + 1] += (c[1] - d[o + 1]) * a; d[o + 2] += (c[2] - d[o + 2]) * a; } d[o + 3] = 255; };
  const shade = (x, y, k) => { const o = (y * W + x) * 4; d[o] *= k; d[o + 1] *= k; d[o + 2] *= k; };

  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const px0 = tx * TILE, py0 = ty * TILE;
    if (open(tx, ty)) {
      // 바닥 + 벽 가까이 그늘 (위 벽은 그림자를 길게 드리운다)
      const wN = !open(tx, ty - 1), wS = !open(tx, ty + 1), wW = !open(tx - 1, ty), wE = !open(tx + 1, ty);
      const cNW = !open(tx - 1, ty - 1), cNE = !open(tx + 1, ty - 1), cSW = !open(tx - 1, ty + 1), cSE = !open(tx + 1, ty + 1);
      for (let ly = 0; ly < TILE; ly++) for (let lx = 0; lx < TILE; lx++) {
        const x = px0 + lx, y = py0 + ly, s = (y * W + x) * 3, o = (y * W + x) * 4;
        d[o] = ground[s]; d[o + 1] = ground[s + 1]; d[o + 2] = ground[s + 2]; d[o + 3] = 255;
        let k = 0;
        if (wN) k = Math.max(k, (1 - ly / 7) * 0.5);
        if (wW) k = Math.max(k, (1 - lx / 4) * 0.3);
        if (wE) k = Math.max(k, (1 - (15 - lx) / 4) * 0.3);
        if (wS) k = Math.max(k, (1 - (15 - ly) / 3) * 0.18);
        if (cNW && !wN && !wW) k = Math.max(k, (1 - Math.hypot(lx, ly) / 6) * 0.35);
        if (cNE && !wN && !wE) k = Math.max(k, (1 - Math.hypot(15 - lx, ly) / 6) * 0.35);
        if (cSW && !wS && !wW) k = Math.max(k, (1 - Math.hypot(lx, 15 - ly) / 4) * 0.2);
        if (cSE && !wS && !wE) k = Math.max(k, (1 - Math.hypot(15 - lx, 15 - ly) / 4) * 0.2);
        if (k > 0) { const dz = BAYER[(y & 3) * 4 + (x & 3)] * 0.6; shade(x, y, 1 - Math.max(0, Math.min(0.6, k + dz))); }
      }
    } else if (face(tx, ty)) wallFace(tx, ty, px0, py0);
    else wallMass(tx, ty, px0, py0);
  }
  // 작은 것: 칸마다 확률로 한두 개 (칸 안에서만 · 둘레가 바닥일 때)
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    if (!open(tx, ty)) continue;
    T.bits.forEach(([k, p], i) => { const h = hash(tx, ty, 100 + i); if (h / 4294967296 < p) bit(k, tx * TILE + 3 + (h >>> 4) % 10, ty * TILE + 4 + (h >>> 9) % 9, h, !open(tx, ty - 1)); });
  }
  g.putImageData(img, 0, 0);

  function wallFace(tx, ty, px0, py0) {
    const l = open(tx - 1, ty), r = open(tx + 1, ty);
    for (let ly = 0; ly < TILE; ly++) for (let lx = 0; lx < TILE; lx++) {
      const x = px0 + lx, y = py0 + ly, dz = BAYER[(y & 3) * 4 + (x & 3)];
      let c;
      if (T.face.kind === 'brick') { // 돌을 쌓은 벽: 4줄 · 줄마다 엇갈린 돌 · 돌마다 다른 밝기
        const row = ly >> 2, bx = (x + (row & 1) * 5 + ty * 3), bw = 9, stone = Math.floor(bx / bw), inX = bx % bw, inY = ly & 3;
        const v = rnd(stone, ty * 4 + row, 51) + dz;
        c = inY === 3 || inX === 0 ? F[0] : inY === 0 ? F[2] : v < 0.35 ? F[0].map((q, i) => (q + F[1][i]) >> 1) : v > 0.8 ? F[2] : F[1];
      } else { // 바위 층: 비스듬한 결 · 어두운 틈
        const n = noise(x, y * 2.2, 9, 52) * 0.7 + noise(x, y, 3, 53) * 0.3 + dz, strata = Math.sin((y + noise(x, 0, 14, 54) * 6) * 0.9);
        c = n < 0.32 || strata > 0.93 ? F[0] : n > 0.72 ? F[2] : F[1];
      }
      if (ly === 0) c = F[3]; else if (ly === 1) c = F[2];
      if (ly >= 14) c = F[0];
      if ((l && lx === 0) || (r && lx === 15)) c = F[0];
      put(x, y, c);
    }
    // 위에서 늘어지는 것 (이끼 · 점액 · 고드름 · 덩굴 · 거미줄 · 용암빛)
    if (T.drip) for (let lx = 0; lx < TILE; lx++) {
      const h = hash(px0 + lx, py0, 61), len = T.drip === 'glow' ? 0 : (h % 9 < 4 ? 1 + (h >>> 4) % (T.drip === 'ice' ? 6 : 5) : 0);
      for (let k = 0; k < len; k++) {
        const x = px0 + lx, y = py0 + 1 + k;
        const col = T.drip === 'moss' ? (k === len - 1 ? '#2a4a20' : k ? '#3d6a2b' : '#57883a') : T.drip === 'slime' ? (k === len - 1 ? '#8a9a3a' : '#5e6a2a') : T.drip === 'ice' ? (k === len - 1 ? '#ffffff' : '#bfe0f4') : T.drip === 'vine' ? (k % 3 === 2 ? '#7ab85a' : '#4a863c') : '#cfcad8';
        if (T.drip === 'ice' && k > 0 && lx % 2) continue; // 고드름은 가늘게
        if (T.drip === 'web' && (h >>> 12) % 7) continue;
        put(x, y, hex(col), T.drip === 'web' ? 0.5 : 1);
      }
    }
    if (T.drip === 'glow') for (let lx = 0; lx < TILE; lx++) for (let k = 0; k < 4; k++) put(px0 + lx, py0 + 15 - k, [255, 110, 40], (0.28 - k * 0.06) * (0.6 + noise(px0 + lx, 0, 5, 63) * 0.8)); // 벽 밑동에 용암빛
  }
  function wallMass(tx, ty, px0, py0) { // 벽 윗면: 어두운 바위 덩어리 · 바닥에 닿는 가장자리는 밝은 테
    const eN = open(tx, ty - 1), eW = open(tx - 1, ty), eE = open(tx + 1, ty), capS = face(tx, ty + 1);
    for (let ly = 0; ly < TILE; ly++) for (let lx = 0; lx < TILE; lx++) {
      const x = px0 + lx, y = py0 + ly, n = noise(x, y, 7, 71) + BAYER[(y & 3) * 4 + (x & 3)];
      let c = n > 0.6 ? M[1] : M[0], a = 1;
      if ((eN && ly < 2) || (eW && lx < 2) || (eE && lx > 13) || (capS && ly > 13)) { c = (eN && ly === 0) || (eW && lx === 0) || (eE && lx === 15) ? F[0] : M[2]; }
      else if ((eN && ly < 4) || (eW && lx < 4) || (eE && lx > 11) || (capS && ly > 11)) c = F[1].map((q, i) => (q + M[1][i]) >> 1);
      put(x, y, c, a);
    }
  }
  function bit(k, x, y, h, underWall) {
    const C = (col, dx, dy, w = 1, hh = 1, a = 1) => { const c = hex(col); for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) put(x + dx + i, y + dy + j, c, a); };
    const v = (h >>> 14) % 4;
    switch (k) {
      case 'pebble': C('#1a1612', -1, 0, 3, 2); C(T.base[1], -1, 0, 2, 1); C('#8a8070', -1, 0, 1, 1, 0.5); break;
      case 'pebbleDark': C('#0e0a0a', -1, 0, 3, 2); C('#3a3236', 0, 0, 1, 1); break;
      case 'crack': { let cx = 0, cy = 0; for (let i = 0; i < 5 + v; i++) { C('#000000', cx, cy, 1, 1, 0.45); cx += (hash(x, y, i) & 1) ? 1 : 0; cy += 1; if (i % 2) cx -= 1; } break; }
      case 'tuft': if (underWall) break; { const g0 = T.patch ? T.patch.cols[1] : '#5a8a3a', g1 = T.patch ? T.patch.cols[2] : '#2a4a20'; C(g1, -1, 0, 3, 1); C(g0, -1, -2, 1, 2); C(g0, 1, -3, 1, 3); C(g1, 0, -1, 1, 1); break; }
      case 'tuftDead': C('#6a6040', -1, -2, 1, 2); C('#7a7050', 1, -3, 1, 3); C('#4a4430', -1, 0, 3, 1); break;
      case 'shroom': C('#e0d8c8', 0, -1, 1, 2); C('#1a1410', -2, -3, 5, 2); C(v % 2 ? '#5affd0' : '#8affa0', -1, -3, 3, 1); C('#ffffff', 0, -3, 1, 1); break;
      case 'root': for (let i = 0; i < 7; i++) C('#3a2a1a', i - 3, Math.round(Math.sin(i * 0.9 + v) * 1.2), 1, 1); break;
      case 'leaf': C('#6a7a2a', 0, 0, 2, 1); C('#8a9a3a', 1, -1, 1, 1); break;
      case 'reed': C('#4a6a22', 0, -6, 1, 6); C('#5a7a2a', 2, -5, 1, 5); C('#8a6a3a', 0, -7, 1, 2); break;
      case 'bubble': C('#1a1a0e', 0, 0, 2, 2, 0.5); C('#9aaa5a', 0, 0, 1, 1); break;
      case 'ember': { for (let i = 0; i < 6; i++) { const cx = i - 3, cy = Math.round(Math.sin(i * 1.3 + v)); C('#1a0e0a', cx, cy, 1, 1); C(i % 2 ? '#ff7a2a' : '#ffb84a', cx, cy - 1, 1, 1, 0.9); } break; }
      case 'ash': C('#7a7270', 0, 0, 2, 1, 0.7); C('#5a5250', 2, 1, 1, 1, 0.7); break;
      case 'sparkle': C('#ffffff', 0, 0, 1, 1, 0.8); if (v === 0) { C('#ffffff', -1, 0, 1, 1, 0.35); C('#ffffff', 1, 0, 1, 1, 0.35); C('#ffffff', 0, -1, 1, 1, 0.35); C('#ffffff', 0, 1, 1, 1, 0.35); } break;
      case 'iceShard': C('#2a3a4a', -1, -3, 3, 4); C('#bfe8ff', 0, -3, 1, 3); C('#ffffff', 0, -3, 1, 1); break;
      case 'bone': C('#1a1418', -3, 0, 7, 2); C('#d8d2bf', -2, 0, 5, 1); C('#d8d2bf', -3, -1, 1, 1); C('#d8d2bf', 3, -1, 1, 1); C('#d8d2bf', -3, 1, 1, 1); C('#d8d2bf', 3, 1, 1, 1); break;
      case 'fungus': C('#6a3a8a', 0, -1, 2, 1); C('#a86ad8', 0, -2, 1, 1); break;
      case 'flower': { const c = ['#ff9ad8', '#fff0a0', '#a8d8ff', '#ffffff'][v]; C('#2a5a2a', 0, -2, 1, 2); C(c, -1, -4, 3, 1); C(c, 0, -5, 1, 3); C('#ffe060', 0, -4, 1, 1); break; }
      case 'shard': C('#1a2030', -1, -2, 3, 3); C('#d8ecff', 0, -2, 1, 2); C('#ffffff', 0, -2, 1, 1); break;
      case 'gear': C('#1a140e', -2, -2, 5, 5); C('#a88040', -1, -1, 3, 3); C('#d8b060', -1, -1, 3, 1); C('#1a140e', 0, 0, 1, 1); C('#a88040', -3, 0, 1, 1); C('#a88040', 3, 0, 1, 1); C('#a88040', 0, -3, 1, 1); C('#a88040', 0, 3, 1, 1); break;
      case 'bolt': C('#1a140e', 0, 0, 2, 2); C('#c8b8a0', 0, 0, 1, 1); break;
      case 'paper': C('#1a1410', -2, -1, 5, 3, 0.5); C('#e8dcc0', -2, -1, 4, 2); C('#a89a80', -1, 0, 3, 1); break;
      case 'inkDot': C('#0a0818', -1, 0, 3, 2, 0.8); C('#0a0818', 2, 1, 1, 1, 0.6); break;
      case 'starDust': C('#dce8ff', 0, 0, 1, 1, 0.8); C('#9ab0ff', -3, 2, 1, 1, 0.6); break;
      case 'lightShard': C('#2a2010', -1, -4, 3, 5); C('#fff0b0', 0, -3, 1, 3); C('#ffffff', 0, -3, 1, 1); break;
      case 'featherGold': C('#1a1410', -3, 0, 7, 2, 0.5); C('#fff4d8', -2, 0, 5, 1); C('#e8c060', 2, 1, 2, 1); break;
    }
  }
}

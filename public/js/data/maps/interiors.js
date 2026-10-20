// 안쪽 세계: 잊힌 미궁 · 용궁 (직접 만든 생성기), 그리고 둘의 지역 정보.
// 동굴 · 구멍 · 던전은 기존 동굴 생성기(generateField)를 크기만 바꿔 쓴다.
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_CRACK } from '../../sim/mapgen.js';
import { createRng } from '../../sim/rng.js';

export const LABY_ZONE = {
  id: 'labyrinth', name: '잊힌 미궁', floor: 3, rec: 12, pal: ['#3a3440', '#443e4a', '#322c38'], wall: ['#16121c', '#2e2836', '#4a4256'], liquid: 'water', liquidPal: ['#1d3a4a', '#2a5a6a'],
  dark: 0.66, deco: ['bone', 'candle', 'pebble', 'skullDeco'], portal: '#b58aff', pool: ['bandit', 'shieldDemon', 'chortShaman', 'skeleton'], regions: ['잊힌 미궁'], elite: 'labyrinthLord',
};
export const PALACE_ZONE = {
  id: 'palace', name: '용궁', floor: 4, rec: 14, pal: ['#2a4656', '#30526a', '#26404e'], wall: ['#0e1e2a', '#24485e', '#3a7090'], liquid: 'water', liquidPal: ['#1a5a7a', '#2a8aaa'],
  dark: 0.3, deco: ['coral', 'coral', 'crystalB', 'lily', 'pebble'], portal: '#7ae8ff', pool: ['coralCrab', 'jellyfish', 'seaSerpent'], regions: ['용궁'], elite: 'dragonGuard',
};

const base = (tw, th) => ({ tw, th, tiles: new Uint8Array(tw * th).fill(T_WALL) });

// 잊힌 미궁: 세 칸 너비 통로의 미로 (갈림길이 조금 이어져 있다). 가운데 군주의 방, 막다른 길 끝에 상자
export function buildLabyrinth(zone, seed) {
  const rng = createRng(seed ^ 0x1abe), CW = 23, CH = 17, C = 4; // 칸 하나 = 3칸 통로 + 1칸 벽
  const tw = CW * C + 1, th = CH * C + 1, m = base(tw, th), t = m.tiles;
  const I = (x, y) => y * tw + x, setT = (x, y, v) => { if (x > 0 && y > 0 && x < tw - 1 && y < th - 1) t[I(x, y)] = v; };
  const cell = (cx, cy, v = T_FLOOR) => { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) setT(cx * C + 1 + x, cy * C + 1 + y, v); };
  const open = (cx, cy, dx, dy) => { for (let k = 0; k < 3; k++) { if (dx) setT(cx * C + 1 + (dx > 0 ? 3 : -1), cy * C + 1 + k, T_FLOOR); else setT(cx * C + 1 + k, cy * C + 1 + (dy > 0 ? 3 : -1), T_FLOOR); } };
  const seen = new Uint8Array(CW * CH), deg = new Uint8Array(CW * CH);
  const ccx = (CW / 2) | 0, ccy = (CH / 2) | 0;
  const inCenter = (cx, cy) => Math.abs(cx - ccx) <= 1 && Math.abs(cy - ccy) <= 1;
  // 미로 파기 (뒤로 돌아가며)
  const sx = ccx, sy = CH - 1, stack = [[sx, sy]]; seen[sy * CW + sx] = 1; cell(sx, sy);
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; return nx >= 0 && ny >= 0 && nx < CW && ny < CH && !seen[ny * CW + nx]; });
    if (!nb.length) { stack.pop(); continue; }
    const [dx, dy] = rng.pick(nb), nx = cx + dx, ny = cy + dy;
    seen[ny * CW + nx] = 1; cell(nx, ny); open(cx, cy, dx, dy); deg[cy * CW + cx]++; deg[ny * CW + nx]++;
    stack.push([nx, ny]);
  }
  // 고리 몇 개 (막다른 길만 있으면 지루하다) · 일부는 부서지는 벽(지름길)
  const secrets = [];
  for (let k = 0; k < 40; k++) {
    const cx = rng.int(0, CW - 2), cy = rng.int(0, CH - 1);
    const wx = cx * C + 4, wy = cy * C + 2;
    if (t[I(wx, wy)] !== T_WALL) continue;
    if (k % 4 === 0) { setT(wx, wy, T_CRACK); setT(wx, wy - 1, T_WALL); setT(wx, wy + 1, T_WALL); secrets.push({ x: wx, y: wy }); }
    else for (let j = 0; j < 3; j++) setT(wx, cy * C + 1 + j, T_FLOOR);
  }
  // 가운데 군주의 방 (3×3 칸을 하나로)
  for (let y = (ccy - 1) * C + 1; y <= (ccy + 1) * C + 3; y++) for (let x = (ccx - 1) * C + 1; x <= (ccx + 1) * C + 3; x++) setT(x, y, T_FLOOR);
  // 막다른 길 → 상자
  const chests = [], camps = [], deco = [];
  for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
    if (inCenter(cx, cy) || (cx === sx && cy === sy)) continue;
    const x = cx * C + 2, y = cy * C + 2;
    let walls = 0; for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (t[I(x + dx, y + dy)] === T_WALL) walls++;
    if (walls >= 3 && rng.chance(0.55)) chests.push({ x, y, rich: rng.chance(0.25), trap: rng.chance(0.25) });
    else if (rng.chance(0.13) && Math.hypot(cx - sx, cy - sy) > 3) camps.push({ x, y, type: rng.pick(zone.pool), n: rng.int(2, 3), region: 0 });
    if (rng.chance(0.3)) deco.push({ x: x * TILE + rng.int(-10, 10), y: y * TILE + rng.int(-10, 10), kind: rng.pick(zone.deco), v: rng.int(0, 3) });
  }
  const lair = { x: ccx * C + 2, y: ccy * C + 2 };
  const start = { x: sx * C + 2, y: sy * C + 2 };
  const regions = new Int8Array(tw * th).fill(0);
  return { ...m, start, lair, stairs: null, camps, champions: [], chests, lores: [{ x: start.x + 4, y: start.y - 4, region: 0 }].filter((l) => t[I(l.x, l.y)] === T_FLOOR), secrets, deco, regions,
    regionInfo: [{ name: '잊힌 미궁', x: lair.x, y: lair.y, types: zone.pool, place: true }], camp: [], merchant: [], shrines: [], goblins: [] };
}

// 용궁: 바닷속 궁전. 입구 홀 → 산호 기둥과 연못의 안뜰 → 양 날개의 보물방 → 북쪽 옥좌의 방(수문장)
export function buildPalace(zone, seed) {
  const rng = createRng(seed ^ 0x9a1ace), tw = 92, th = 74, m = base(tw, th), t = m.tiles;
  const I = (x, y) => y * tw + x;
  const rect = (x0, y0, x1, y1, v = T_FLOOR) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x > 0 && y > 0 && x < tw - 1 && y < th - 1) t[I(x, y)] = v; };
  const cx = tw >> 1;
  rect(cx - 7, 58, cx + 7, 70);                     // 입구 홀
  rect(cx - 2, 50, cx + 2, 58);                     // 홀 → 안뜰
  rect(cx - 20, 30, cx + 20, 50);                   // 안뜰
  rect(cx - 9, 36, cx + 9, 44, T_LIQUID);           // 가운데 연못
  rect(cx - 3, 39, cx + 3, 41);                     // 연못을 건너는 길
  for (const [px, py] of [[-15, 34], [15, 34], [-15, 46], [15, 46], [-6, 32], [6, 32], [-6, 48], [6, 48]]) rect(cx + px, py, cx + px + 1, py + 1, T_WALL); // 산호 기둥
  rect(cx - 40, 34, cx - 21, 46); rect(cx - 38, 22, cx - 26, 34);  // 서쪽 날개 · 보물방
  rect(cx + 21, 34, cx + 40, 46); rect(cx + 26, 22, cx + 38, 34);  // 동쪽 날개 · 보물방
  rect(cx - 34, 36, cx - 30, 44, T_LIQUID); rect(cx + 30, 36, cx + 34, 44, T_LIQUID); // 날개 물길
  rect(cx - 3, 16, cx + 3, 30);                     // 안뜰 → 옥좌
  rect(cx - 16, 3, cx + 16, 16);                    // 옥좌의 방
  rect(cx - 12, 5, cx - 9, 14, T_LIQUID); rect(cx + 9, 5, cx + 12, 14, T_LIQUID);
  for (const [px, py] of [[-6, 6], [6, 6], [-6, 12], [6, 12]]) rect(cx + px, py, cx + px + 1, py + 1, T_WALL);
  // 비밀: 동쪽 보물방 뒤 부서지는 벽 너머 진주 방
  rect(cx + 40, 24, cx + 44, 30); t[I(cx + 39, 27)] = T_CRACK;
  const deco = [];
  for (let y = 1; y < th - 1; y++) for (let x = 1; x < tw - 1; x++) if (t[I(x, y)] === T_FLOOR && rng.chance(0.06)) deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: rng.pick(zone.deco), v: rng.int(0, 3) });
  const camps = [[cx - 14, 40, 'coralCrab'], [cx + 14, 40, 'coralCrab'], [cx - 30, 40, 'seaSerpent'], [cx + 30, 40, 'seaSerpent'], [cx - 32, 28, 'jellyfish'], [cx + 32, 28, 'jellyfish'], [cx, 24, 'jellyfish'], [cx, 54, 'coralCrab'],
    [cx - 16, 32, 'jellyfish'], [cx + 16, 32, 'jellyfish'], [cx - 16, 48, 'coralCrab'], [cx + 16, 48, 'coralCrab'], [cx - 25, 44, 'coralCrab'], [cx + 25, 44, 'coralCrab'],
    [cx - 5, 62, 'jellyfish'], [cx + 5, 62, 'jellyfish'], [cx - 12, 10, 'seaSerpent'], [cx + 12, 10, 'seaSerpent'], [cx - 36, 37, 'jellyfish'], [cx + 36, 37, 'jellyfish']]
    .map(([x, y, type]) => ({ x, y, type, n: rng.int(2, 3), region: 0 }));
  return { ...m, start: { x: cx, y: 67 }, lair: { x: cx, y: 7 }, stairs: null, camps, champions: [],
    chests: [{ x: cx - 32, y: 25, rich: true }, { x: cx + 32, y: 25, rich: true }, { x: cx + 42, y: 27, rich: true }, { x: cx - 36, y: 44, rich: false }, { x: cx + 36, y: 44, rich: false }],
    lores: [{ x: cx + 4, y: 62, region: 0 }], secrets: [{ x: cx + 42, y: 27 }], deco, regions: new Int8Array(tw * th).fill(0),
    regionInfo: [{ name: '용궁', x: cx, y: 40, types: zone.pool, place: true }], camp: [{ x: cx - 5, y: 64 }], merchant: [], shrines: [{ x: cx, y: 33 }], goblins: [],
    palace: { rugs: [[cx - 2, 51, cx + 2, 66], [cx - 2, 17, cx + 2, 29], [cx - 4, 8, cx + 4, 15]], throne: { x: cx, y: 4 } } };
}

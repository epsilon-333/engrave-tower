// 바닷속: 바깥 세계의 물(바다 · 호수 · 깊은 강)이 그대로 바닥이 되고, 뭍은 벽(물 밑에서 본 땅)이 된다.
// 물 위 어디서든 잠수하면 같은 자리로 내려오고, 떠오르면 같은 자리 물 위로 올라간다.
// 얕은 모래 · 깊은 모래 · 바위 · 해초 숲 · 산호 정원 · 심해 골짜기, 가라앉은 상자 · 숨 쉬는 거품 구멍 · 조개 · 산호 · 해초, 용궁으로 가는 문.
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_DEEP } from '../../sim/mapgen.js';
import { G, OW } from './overworld.js';
import { createRng } from '../../sim/rng.js';

// 바닷속 바닥 (G 와 겹치지 않는 번호)
export const SB = { SAND: 40, DEEPSAND: 41, ROCK: 42, KELP: 43, CORAL: 44, TRENCH: 45, LAKEBED: 46, WALL: 47 };
const REGIONS = ['얕은 바다', '깊은 바다', '해초 숲', '산호 정원', '심해 골짜기', '거울 호수 밑'];
export const SEABED_ZONE = {
  id: 'seabed', name: '바닷속', floor: 3, rec: 6, outdoor: true, underwater: true, dark: 0,
  pal: ['#c8b48a', '#d4c098', '#a8946a'], wall: ['#283444', '#3e4c60', '#1a2230'], liquid: 'water', liquidPal: ['#2c74a4', '#4aa6c6'],
  deco: [], portal: '#7ad8ff', pool: ['jellyfish', 'seaSerpent', 'coralCrab'], regions: REGIONS, elite: 'seaSerpent',
};

function noise2(seed) {
  const h = (x, y) => { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const f = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = f(x - xi), w = f(y - yi); return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - w) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * w; };
  return (x, y, oct = 3) => { let s = 0, a = 0.5, fr = 1, n = 0; for (let i = 0; i < oct; i++) { s += v(x * fr, y * fr) * a; n += a; a *= 0.5; fr *= 2; } return s / n; };
}

let CACHE = null;
// ow: 처음 만든 바깥 세계 지도 (나무 · 얼음이 없는 원래 모습)
export function buildSeabed(ow) {
  if (CACHE) return CACHE;
  const TW = ow.tw, TH = ow.th, n = TW * TH, rng = createRng(0x5eabed), N1 = noise2(71), N2 = noise2(83);
  const t = new Uint8Array(n).fill(T_WALL), gr = new Uint8Array(n).fill(SB.WALL);
  const I = (x, y) => y * TW + x, inb = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH;
  const isWater = (k) => (ow.tiles[k] === T_DEEP || ow.tiles[k] === T_LIQUID || ow.ground[k] === G.BRIDGE) && ow.ground[k] !== G.LAVA && ow.ground[k] !== G.BOG;
  for (let k = 0; k < n; k++) { const x = k % TW, y = (k / TW) | 0; if (isWater(k) && x >= 2 && y >= 2 && x < TW - 2 && y < TH - 2) t[k] = T_FLOOR; } // 가장자리는 막힌 바위
  // 뭍에서 먼 정도 (깊이)
  const depth = new Int16Array(n).fill(-1), q = new Int32Array(n); let qh = 0, qt = 0;
  for (let k = 0; k < n; k++) if (t[k] === T_WALL) { depth[k] = 0; q[qt++] = k; }
  while (qh < qt) { const k = q[qh++], x = k % TW, y = (k / TW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = I(nx, ny); if (depth[j] < 0) { depth[j] = depth[k] + 1; q[qt++] = j; } } }
  const L = OW.LAKE, inLake = (x, y) => Math.hypot((x - L.x) / (L.rx + 3), (y - L.y) / (L.ry + 3)) < 1;
  const regions = new Int8Array(n).fill(-1);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const k = I(x, y); if (t[k] !== T_FLOOR) continue;
    const d = depth[k], nz = N1(x * 0.08, y * 0.08), nz2 = N2(x * 0.05, y * 0.05);
    let g = d <= 2 ? SB.SAND : d <= 6 ? (nz > 0.62 ? SB.ROCK : SB.SAND) : d <= 11 ? SB.DEEPSAND : SB.TRENCH;
    let r = d <= 3 ? 0 : d > 11 ? 4 : 1;
    if (d > 2 && d <= 11 && nz2 > 0.64) { g = SB.KELP; r = 2; }
    if (d > 2 && d <= 9 && y > TH * 0.62 && nz2 < 0.3) { g = SB.CORAL; r = 3; }
    if (inLake(x, y)) { g = d > 4 ? SB.LAKEBED : SB.SAND; r = 5; }
    gr[k] = g; regions[k] = r;
  }
  // 깊은 곳의 바위 덩이 (둘레가 모두 트여 있을 때만 · 길을 막지 않게)
  for (let a = 0; a < 3000; a++) {
    const x = rng.int(2, TW - 3), y = rng.int(2, TH - 3), k = I(x, y);
    if (t[k] !== T_FLOOR || depth[k] < 5) continue;
    let open = true; for (let dy = -2; dy <= 2 && open; dy++) for (let dx = -2; dx <= 2; dx++) if (t[I(x + dx, y + dy)] !== T_FLOOR) { open = false; break; }
    if (open && rng.chance(0.35)) { t[k] = T_WALL; gr[k] = SB.WALL; }
  }
  // 장식: 해초 · 산호 · 조개껍데기 · 거품 (조각마다 그린다)
  const deco = [], dc = (x, y, kind) => deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind, v: rng.int(0, 3) });
  for (let y = 1; y < TH - 1; y++) for (let x = 1; x < TW - 1; x++) {
    const k = I(x, y); if (t[k] !== T_FLOOR) continue;
    const g = gr[k];
    if (g === SB.KELP && rng.chance(0.45)) dc(x, y, 'kelp');
    else if (g === SB.CORAL && rng.chance(0.35)) dc(x, y, rng.chance(0.5) ? 'coralFan' : 'coralBranch');
    else if ((g === SB.SAND || g === SB.DEEPSAND) && rng.chance(0.03)) dc(x, y, rng.pick(['seaShell', 'starfish', 'seaRock']));
    else if (g === SB.TRENCH && rng.chance(0.02)) dc(x, y, 'glowPlant');
    else if (g === SB.LAKEBED && rng.chance(0.06)) dc(x, y, 'lakeWeed');
  }
  // 트인 곳 찾기
  const open3 = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!inb(x + dx, y + dy) || t[I(x + dx, y + dy)] !== T_FLOOR) return false; return true; };
  const spots = (cond, cnt, gap) => { const out = []; for (let a = 0; a < 40000 && out.length < cnt; a++) { const x = rng.int(3, TW - 4), y = rng.int(3, TH - 4), k = I(x, y); if (!open3(x, y) || !cond(x, y, k) || out.some((o) => Math.hypot(o.x - x, o.y - y) < gap)) continue; out.push({ x, y }); } return out; };
  const objects = [];
  const at = (x, y) => ({ x: x * TILE + 8, y: y * TILE + 8 });
  // 숨 쉬는 거품 구멍: 깊은 곳 곳곳 (숨이 다시 찬다)
  for (const s of spots((x, y, k) => depth[k] >= 4, 46, 22)) objects.push({ kind: 'vent', ...at(s.x, s.y), label: '거품 구멍 · 숨이 찬다', reusable: true, noPrompt: true });
  // 가라앉은 상자
  const chests = spots((x, y, k) => depth[k] >= 3, 26, 26).map((s, i) => ({ x: s.x, y: s.y, rich: depth[I(s.x, s.y)] > 10 || i % 4 === 0 }));
  // 조개 · 산호 · 해초 (캐는 것)
  const nodes = [], NID = 10000; // 캔 자리 기록(life.nodes)이 바깥 세계와 겹치지 않게
  for (const s of spots((x, y, k) => gr[k] === SB.SAND || gr[k] === SB.DEEPSAND, 60, 10)) nodes.push({ id: NID + nodes.length, type: 'clam', x: s.x, y: s.y });
  for (const s of spots((x, y, k) => gr[k] === SB.CORAL, 36, 8)) nodes.push({ id: NID + nodes.length, type: 'coralNode', x: s.x, y: s.y });
  for (const s of spots((x, y, k) => gr[k] === SB.KELP || gr[k] === SB.LAKEBED, 50, 9)) nodes.push({ id: NID + nodes.length, type: 'kelp', x: s.x, y: s.y });
  // 용궁으로 가는 문: 바다 위 소용돌이 바로 밑
  const pi = ow.entrances?.palace;
  if (pi) {
    let best = null, bd = 1e9;
    for (let y = pi.y - 8; y <= pi.y + 12; y++) for (let x = pi.x - 10; x <= pi.x + 10; x++) if (inb(x, y) && open3(x, y)) { const d = Math.hypot(x - pi.x, y - (pi.y + 4)); if (d < bd) { bd = d; best = { x, y }; } }
    if (best) objects.push({ kind: 'palaceGate', ...at(best.x, best.y), label: '용궁의 문 · 들어가기', reusable: true });
  }
  // 몬스터 무리
  const camps = [];
  for (const s of spots((x, y, k) => depth[k] >= 3, 70, 16)) {
    const k = I(s.x, s.y), d = depth[k], lake = regions[k] === 5;
    const type = lake ? 'jellyfish' : gr[k] === SB.CORAL || gr[k] === SB.ROCK ? 'coralCrab' : d > 9 ? 'seaSerpent' : rng.pick(['jellyfish', 'jellyfish', 'coralCrab', 'seaSerpent']);
    camps.push({ x: s.x, y: s.y, type, n: rng.int(1, 3), region: regions[k] });
  }
  // 심해의 주인: 가장 깊은 곳
  let lair = { x: 10, y: 10 }, deepest = -1;
  for (let k = 0; k < n; k++) if (t[k] === T_FLOOR && depth[k] > deepest && !inLake(k % TW, (k / TW) | 0)) { deepest = depth[k]; lair = { x: k % TW, y: (k / TW) | 0 }; }
  const regionInfo = REGIONS.map((name) => ({ name, x: 0, y: 0, place: true, types: SEABED_ZONE.pool }));
  CACHE = {
    tw: TW, th: TH, tiles: t, ground: gr, outdoor: true, underwater: true, designed: 'seabed', level: new Int8Array(n), biome: new Int8Array(n).fill(-1), depth,
    start: { x: 10, y: 10 }, lair, stairs: null, camps, champions: [], chests, lores: [], secrets: [], deco, regions, regionInfo,
    camp: [], merchant: [], shrines: [], goblins: [], props: [], objects, onPath: new Uint8Array(n), sanctums: {}, entrances: {}, farm: null, nodes, digs: [],
  };
  return CACHE;
}
// 세계마다 고칠 수 있게 복사본 (타일 · 오브젝트)
export function seabedMap(ow) {
  const m = buildSeabed(ow);
  return { ...m, tiles: new Uint8Array(m.tiles), ground: new Uint8Array(m.ground), objects: m.objects.map((o) => ({ ...o })) };
}

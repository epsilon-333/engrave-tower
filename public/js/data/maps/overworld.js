// 바람결의 섬: 하나로 이어진 넓은 세계 (2D 오픈월드 시험판).
// 마을에서 시작해 어디로든 걸어간다. 지역마다 땅 · 풍경 · 몬스터가 다르다.
//
//                       북쪽 바위산 (계단식 절벽 · 계단)
//                             물줄기 ╲
//     이끼 숲 (동굴 입구)     각인의 탑 고원        ╲ 다리
//                                │ 흙길            거울 호수 (가운데 섬)
//          시작 평원 (키 큰 풀)   │
//                         바람결 마을
//                       ~~~ 모래 해안 · 바다 ~~~
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD, T_DEEP } from '../../sim/mapgen.js';
import { createRng } from '../../sim/rng.js';

export const G = { GRASS: 0, DIRT: 1, SAND: 2, TALL: 3, FLOWER: 4, BURNT: 5, ICE: 6, ROCK: 7, FOREST: 8, STONE: 9, BRIDGE: 10, SNOW: 11 };
export const OW = { TW: 200, TH: 150, VILLAGE: { x: 100, y: 128 }, TOWER: { x: 100, y: 62, rx: 15, ry: 11 }, LAKE: { x: 156, y: 84, rx: 17, ry: 12 }, CAVE: { x: 30, y: 62 } };
export const OW_PLACES = ['바람결 마을', '시작 평원', '이끼 숲', '거울 호수', '북쪽 바위산', '각인의 탑', '모래 해안', '물줄기'];

// 값 노이즈 (부드러운 덩어리)
function noise2(seed) {
  const h = (x, y) => { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const f = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = f(x - xi), w = f(y - yi); return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - w) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * w; };
  return (x, y, oct = 3) => { let s = 0, a = 0.5, fr = 1, n = 0; for (let i = 0; i < oct; i++) { s += v(x * fr, y * fr) * a; n += a; a *= 0.5; fr *= 2; } return s / n; };
}

export function buildOverworld(zone) {
  const { TW, TH } = OW, rng = createRng(0x0b0a7), N1 = noise2(11), N2 = noise2(23), N3 = noise2(37);
  const t = new Uint8Array(TW * TH), gr = new Uint8Array(TW * TH);
  const I = (x, y) => y * TW + x, inb = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH;
  const set = (x, y, tile, g) => { if (!inb(x, y)) return; t[I(x, y)] = tile; if (g != null) gr[I(x, y)] = g; };
  const T = (x, y) => (inb(x, y) ? t[I(x, y)] : T_DEEP), Gd = (x, y) => (inb(x, y) ? gr[I(x, y)] : G.SAND);
  const ell = (x, y, c) => Math.hypot((x - c.x) / c.rx, (y - c.y) / c.ry);
  const segDist = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy, k = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)); return Math.hypot(px - ax - vx * k, py - ay - vy * k); };
  const lineDist = (x, y, pts) => { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, y, ...pts[i], ...pts[i + 1])); return d; };

  // 1) 섬과 바다
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const d = Math.hypot((x - TW / 2) / (TW * 0.48), (y - TH / 2) / (TH * 0.47)) + (N1(x * 0.06, y * 0.06) - 0.5) * 0.12;
    if (d > 1.0) set(x, y, T_DEEP, G.SAND);
    else if (d > 0.975) set(x, y, T_LIQUID, G.SAND);
    else if (d > 0.93) set(x, y, T_FLOOR, G.SAND);
    else set(x, y, T_FLOOR, G.GRASS);
  }
  // 2) 북쪽 바위산: 높이 층마다 절벽, 위쪽 층은 바위 · 눈
  const level = (x, y) => {
    const edge = 42 + (N2(x * 0.05, 0.3) - 0.5) * 16;
    if (y > edge) return 0;
    return Math.min(4, Math.floor((edge - y) / 9 + (N2(x * 0.08, y * 0.08) - 0.5) * 1.4) + 1);
  };
  const LV = new Int8Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) if (T(x, y) === T_FLOOR && Gd(x, y) === G.GRASS) LV[I(x, y)] = level(x, y);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const l = LV[I(x, y)];
    if (!l) continue;
    gr[I(x, y)] = l >= 4 ? G.SNOW : G.ROCK;
    const lower = (xx, yy) => inb(xx, yy) && LV[I(xx, yy)] < l && T(xx, yy) !== T_DEEP;
    if (lower(x, y + 1) || lower(x - 1, y) || lower(x + 1, y)) set(x, y, T_WALL);
  }
  // 남쪽을 보는 절벽은 두 칸 높이로 (높이감)
  const thicken = (x0, y0, x1, y1) => {
    const add = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (T(x, y) === T_WALL && T(x, y + 1) !== T_WALL && T(x, y - 1) === T_FLOOR) add.push([x, y - 1]);
    for (const [x, y] of add) set(x, y, T_WALL);
  };
  thicken(0, 1, TW - 1, 70);
  // 층 사이 계단: 몇 줄기 세로로 깎는다
  const stairs = [];
  for (const sx of [44, 72, 101, 128, 156]) {
    const x0 = sx + rng.int(-3, 3);
    for (let y = 2; y < 60; y++) for (let dx = 0; dx < 2; dx++) {
      if (T(x0 + dx, y) === T_WALL) { set(x0 + dx, y, T_FLOOR); stairs.push({ x: x0 + dx, y }); }
    }
  }
  // 3) 물줄기: 바위산에서 거울 호수로 (다리 하나)
  const river = [[132, 28], [138, 44], [134, 58], [142, 70], [150, 76]];
  for (let y = 20; y < 82; y++) for (let x = 120; x < 160; x++) {
    const d = lineDist(x, y, river) + (N3(x * 0.2, y * 0.2) - 0.5) * 0.8;
    if (d < 1.3) set(x, y, T_DEEP, G.SAND);
    else if (d < 2.3 && T(x, y) !== T_DEEP) set(x, y, T_LIQUID, G.SAND);
    else if (d < 3.0 && T(x, y) === T_FLOOR && LV[I(x, y)] === 0) gr[I(x, y)] = G.SAND;
  }
  // 4) 거울 호수와 가운데 섬
  const L = OW.LAKE;
  for (let y = L.y - L.ry - 4; y <= L.y + L.ry + 4; y++) for (let x = L.x - L.rx - 4; x <= L.x + L.rx + 4; x++) {
    const d = ell(x, y, L) + (N3(x * 0.15, y * 0.15) - 0.5) * 0.12;
    if (d < 0.8) set(x, y, T_DEEP, G.SAND); else if (d < 1.0) set(x, y, T_LIQUID, G.SAND); else if (d < 1.18 && T(x, y) === T_FLOOR) gr[I(x, y)] = G.SAND;
  }
  const island = { x: L.x + 3, y: L.y - 1 };
  for (let y = island.y - 2; y <= island.y + 2; y++) for (let x = island.x - 3; x <= island.x + 3; x++) if (((x - island.x) / 3.2) ** 2 + ((y - island.y) / 2.2) ** 2 <= 1) set(x, y, T_FLOOR, Math.hypot(x - island.x, y - island.y) < 1.6 ? G.GRASS : G.SAND);

  // 5) 각인의 탑 고원: 절벽 고리, 남쪽 계단, 안쪽은 오래된 돌바닥
  const TW_ = OW.TOWER;
  for (let y = TW_.y - TW_.ry - 2; y <= TW_.y + TW_.ry + 2; y++) for (let x = TW_.x - TW_.rx - 2; x <= TW_.x + TW_.rx + 2; x++) {
    const d = ell(x, y, TW_);
    if (d < 1) { set(x, y, T_FLOOR, d < 0.55 ? G.STONE : G.GRASS); LV[I(x, y)] = 1; }
  }
  for (let y = TW_.y - TW_.ry - 2; y <= TW_.y + TW_.ry + 2; y++) for (let x = TW_.x - TW_.rx - 2; x <= TW_.x + TW_.rx + 2; x++) {
    if (ell(x, y, TW_) >= 1) continue;
    if ([[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => ell(x + dx, y + dy, TW_) >= 1)) set(x, y, T_WALL, G.ROCK);
  }
  thicken(TW_.x - TW_.rx - 2, TW_.y - TW_.ry - 2, TW_.x + TW_.rx + 2, TW_.y + TW_.ry + 2);
  for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy < 4; dy++) set(TW_.x + dx, TW_.y + TW_.ry - dy, T_FLOOR, G.STONE); // 남쪽 계단
  // 탑 자리 (밟을 수 없음)
  for (let y = TW_.y - 3; y <= TW_.y; y++) for (let x = TW_.x - 2; x <= TW_.x + 2; x++) set(x, y, T_BUILD, G.STONE);

  // 6) 흙길: 마을 → 탑 계단, 숲 동굴, 호수 다리, 바위산
  const V = OW.VILLAGE;
  const paths = [
    [[V.x, V.y - 4], [V.x, 100], [TW_.x, TW_.y + TW_.ry + 1]],
    [[V.x - 6, V.y - 2], [72, 108], [50, 90], [OW.CAVE.x + 3, OW.CAVE.y + 4]],
    [[V.x + 6, V.y - 2], [124, 104], [138, 92], [146, 92], [L.x - L.rx - 2, L.y + 2]],
    [[TW_.x + 4, TW_.y + TW_.ry + 2], [118, 66], [128, 52], [138, 44], [146, 38], [156, 30]],
  ];
  const onPath = new Uint8Array(TW * TH);
  for (const pts of paths) for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const d = lineDist(x, y, pts) + (N3(x * 0.3, y * 0.3) - 0.5) * 0.9;
    if (d > 1.6) continue;
    onPath[I(x, y)] = 1;
    const tt = T(x, y);
    if (tt === T_DEEP || tt === T_LIQUID) {
      // 물을 건너는 곳은 나무 다리
      if (inb(x, y) && Math.hypot(x - L.x, y - L.y) > 8) set(x, y, T_FLOOR, G.BRIDGE);
    } else if (tt === T_WALL) { if (!(ell(x, y, TW_) < 1.05)) set(x, y, T_FLOOR, G.DIRT); }
    else if (tt === T_FLOOR && gr[I(x, y)] !== G.STONE && gr[I(x, y)] !== G.BRIDGE) gr[I(x, y)] = G.DIRT;
  }

  // 7) 마을: 돌바닥 광장, 집, 시설
  for (let y = V.y - 9; y <= V.y + 8; y++) for (let x = V.x - 17; x <= V.x + 17; x++) {
    if (T(x, y) !== T_FLOOR) continue;
    const d = Math.hypot((x - V.x) / 17, (y - V.y) / 9);
    if (d < 1) { gr[I(x, y)] = d < 0.42 ? G.STONE : gr[I(x, y)] === G.DIRT ? G.DIRT : G.GRASS; onPath[I(x, y)] = 1; }
  }
  const props = [], occupied = new Uint8Array(TW * TH);
  const prop = (kind, x, y, w, h, extra = {}) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { set(xx, yy, T_BUILD); occupied[I(xx, yy)] = 1; } props.push({ kind, x, y, w, h, ...extra }); };
  prop('house', V.x - 15, V.y - 8, 5, 3, { roof: '#b8483a' }); prop('house', V.x + 10, V.y - 8, 5, 3, { roof: '#3a6ab8' });
  prop('house', V.x - 15, V.y + 3, 5, 3, { roof: '#5a8a3a' }); prop('house', V.x + 10, V.y + 3, 5, 3, { roof: '#b88a3a' });
  prop('well', V.x - 4, V.y + 3, 2, 1);
  prop('tower', TW_.x - 2, TW_.y - 3, 5, 4);
  prop('caveMouth', OW.CAVE.x - 2, OW.CAVE.y - 2, 5, 2);
  // 동굴 입구 둘레 바위
  for (let y = OW.CAVE.y - 4; y <= OW.CAVE.y - 1; y++) for (let x = OW.CAVE.x - 5; x <= OW.CAVE.x + 5; x++) if (T(x, y) === T_FLOOR && !occupied[I(x, y)] && Math.hypot((x - OW.CAVE.x) / 5, (y - OW.CAVE.y + 2) / 2.5) < 1) set(x, y, T_WALL, G.ROCK);
  for (let x = OW.CAVE.x - 1; x <= OW.CAVE.x + 1; x++) set(x, OW.CAVE.y, T_FLOOR, G.DIRT);
  const at = (x, y) => ({ x: x * TILE + 8, y: y * TILE + 8 });
  const station = (kind, x, y, label, panel, name) => ({ kind: 'station', station: kind, ...at(x, y), label, panel, npc: { name } });
  const objects = [
    station('altar', V.x - 8, V.y - 5, '공명 제단 · 각인 새기기', 'altar', '각인사 루네'),
    station('shop', V.x + 8, V.y - 4, '대장간 · 장비', 'shop', '대장장이 브론'),
    station('library', V.x - 9, V.y + 2, '서고 · 도감', 'codex', '사서 에일'),
    station('trainer', V.x + 8, V.y + 3, '수련 교관 · 스탯 배분', 'char', '교관 가르'),
    station('board', V.x + 3, V.y - 6, '의뢰 게시판', 'quest', '의뢰인 마르코'),
    { kind: 'rest', ...at(V.x, V.y + 1), label: '마을 모닥불 · 쉬고 저장하기', reusable: true },
    { kind: 'caveDoor', ...at(OW.CAVE.x, OW.CAVE.y), zone: 'cave', label: '이끼 동굴로 들어가기', reusable: true },
    { kind: 'towerDoor', ...at(TW_.x, TW_.y + 1), label: '각인의 탑 · 위층으로', reusable: true },
  ];

  // 8) 이끼 숲: 서쪽 빽빽한 나무 (길 · 동굴 앞은 비운다)
  const forestW = (x, y) => (x < 72 && y > 36 && y < 126 ? (1 - x / 72) * 1.3 : 0) * (0.6 + 0.8 * N2(x * 0.07, y * 0.07));
  const treeOk = (x, y) => T(x, y) === T_FLOOR && !onPath[I(x, y)] && !occupied[I(x, y)] && gr[I(x, y)] !== G.SAND && gr[I(x, y)] !== G.STONE && gr[I(x, y)] !== G.BRIDGE
    && Math.hypot(x - OW.CAVE.x, y - OW.CAVE.y - 2) > 5 && ell(x, y, TW_) > 1.25 && Math.hypot((x - V.x) / 20, (y - V.y) / 12) > 1;
  const trees = [];
  for (let y = 4; y < TH - 3; y++) for (let x = 3; x < TW - 3; x++) {
    if (!treeOk(x, y)) continue;
    const fw = forestW(x, y), lv = LV[I(x, y)];
    if (fw > 0.3) gr[I(x, y)] = G.FOREST;
    const p = fw > 0.45 ? 0.32 : lv > 0 ? 0.035 : 0.012;
    if (!rng.chance(p)) continue;
    if (trees.some((o) => Math.abs(o.x - x) < 2 && Math.abs(o.y - y) < 2)) continue; // 줄기끼리 붙지 않게
    const kind = lv >= 2 ? 'pine' : fw > 0.45 ? (rng.chance(0.2) ? 'pine' : 'oak') : rng.chance(0.15) ? 'birch' : 'oak';
    trees.push({ x, y }); prop('tree', x, y, 1, 1, { tree: kind, v: rng.int(0, 3) });
  }

  // 9) 들판: 키 큰 풀밭 · 꽃 · 덤불 장식
  const deco = [];
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const k = I(x, y);
    if (t[k] !== T_FLOOR || onPath[k] || occupied[k]) continue;
    const g = gr[k];
    if (g === G.GRASS) {
      if (N1(x * 0.11 + 50, y * 0.11) > 0.6) gr[k] = G.TALL;
      else if (rng.chance(0.05)) gr[k] = G.FLOWER;
    }
    if (g === G.FOREST && rng.chance(0.07)) deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: rng.chance(0.5) ? 'glowshroom' : 'fern', v: rng.int(0, 3) });
    if (g === G.ROCK && rng.chance(0.05)) deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: 'pebble', v: rng.int(0, 3) });
    if ((g === G.SAND) && T(x, y + 1) === T_LIQUID && rng.chance(0.15)) deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: 'reed', v: 0 });
  }
  // 10) 금 간 바위: 바위산 동굴을 막은 것 + 흩어진 것 (부수면 보물)
  const secrets = [];
  const secretSpots = [[60, 18], [118, 14], [170, 30]];
  for (const [sx, sy] of secretSpots) {
    let found = null;
    for (let r = 0; r < 12 && !found; r++) for (let a = 0; a < 16 && !found; a++) {
      const x = Math.round(sx + Math.cos(a * 0.39) * r), y = Math.round(sy + Math.sin(a * 0.39) * r);
      if (T(x, y) === T_WALL && T(x, y + 1) === T_FLOOR && T(x, y - 1) === T_WALL && T(x, y - 2) === T_WALL) found = { x, y };
    }
    if (!found) continue;
    set(found.x, found.y, T_CRACK);
    for (let y = found.y - 3; y <= found.y - 1; y++) for (let x = found.x - 1; x <= found.x + 1; x++) set(x, y, T_FLOOR, G.ROCK);
    secrets.push({ x: found.x, y: found.y - 2 });
  }

  // 11) 지역 이름
  const regionOf = (x, y) => {
    if (Math.hypot((x - V.x) / 20, (y - V.y) / 12) < 1) return 0;
    if (ell(x, y, TW_) < 1.15) return 5;
    if (ell(x, y, L) < 1.4) return 3;
    if (lineDist(x, y, river) < 5) return 7;
    if (LV[I(x, y)] > 0 || y < 34) return 4;
    if (gr[I(x, y)] === G.SAND || T(x, y) === T_DEEP) return 6;
    if (forestW(x, y) > 0.35) return 2;
    return 1;
  };
  const regions = new Int8Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) regions[I(x, y)] = regionOf(x, y);
  const TYPES = [['slime'], ['slime', 'mossSlug', 'bat'], ['goblin', 'goblinShaman', 'caveLurker'], ['toad', 'leech', 'slime'], ['bat', 'caveLurker', 'goblin'], ['bat'], ['slime', 'toad'], ['leech', 'toad']];
  const regionInfo = OW_PLACES.map((name, r) => ({ name, x: 0, y: 0, place: true, types: TYPES[r] }));

  // 12) 몬스터 무리 · 상자 · 석판 · 야영지
  const free = (x, y, r) => t[I(x, y)] === T_FLOOR && !occupied[I(x, y)] && Math.hypot(x - V.x, y - V.y) > 26;
  const camps = [];
  for (let a = 0; a < 6000 && camps.length < 46; a++) {
    const x = rng.int(6, TW - 7), y = rng.int(6, TH - 7), r = regions[I(x, y)];
    if (!free(x, y) || r === 0 || r === 5 || gr[I(x, y)] === G.BRIDGE) continue;
    if (camps.some((c) => Math.hypot(c.x - x, c.y - y) < 11)) continue;
    camps.push({ x, y, type: rng.pick(regionInfo[r].types), n: rng.int(2, 4), region: r });
  }
  const chests = [{ x: island.x, y: island.y, rich: true }, ...secrets.map((s) => ({ ...s, rich: true }))];
  for (let a = 0; a < 3000 && chests.length < 12; a++) {
    const x = rng.int(6, TW - 7), y = rng.int(6, TH - 7);
    if (!free(x, y) || chests.some((c) => Math.hypot(c.x - x, c.y - y) < 18)) continue;
    let walls = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (T(x + dx, y + dy) !== T_FLOOR) walls++;
    if (walls >= 3) chests.push({ x, y, rich: false, trap: rng.chance(0.2) });
  }
  const pick = (n, cond) => { const out = []; for (let a = 0; a < 4000 && out.length < n; a++) { const x = rng.int(6, TW - 7), y = rng.int(6, TH - 7); if (free(x, y) && cond(x, y) && !out.some((o) => Math.hypot(o.x - x, o.y - y) < 20)) out.push({ x, y, region: regions[I(x, y)] }); } return out; };
  const lores = pick(5, (x, y) => regions[I(x, y)] !== 1 || rng.chance(0.3));
  const camp = pick(2, (x, y) => Math.hypot(x - V.x, y - V.y) > 50);
  const shrines = pick(2, (x, y) => regions[I(x, y)] === 4 || regions[I(x, y)] === 2);
  const goblins = pick(1, (x, y) => regions[I(x, y)] === 1);
  // 숲 깊은 곳 고블린 족장
  const lair = { x: 22, y: 98 };
  for (let y = lair.y - 3; y <= lair.y + 3; y++) for (let x = lair.x - 4; x <= lair.x + 4; x++) if (t[I(x, y)] === T_BUILD && props.find((p) => p.kind === 'tree' && p.x === x && p.y === y)) { set(x, y, T_FLOOR); const i = props.findIndex((p) => p.kind === 'tree' && p.x === x && p.y === y); props.splice(i, 1); }
  for (let y = lair.y - 3; y <= lair.y + 3; y++) for (let x = lair.x - 4; x <= lair.x + 4; x++) if (t[I(x, y)] === T_FLOOR) gr[I(x, y)] = G.DIRT;

  return {
    tw: TW, th: TH, tiles: t, ground: gr, outdoor: true, designed: 'overworld',
    start: { x: V.x, y: V.y + 4 }, lair, stairs: null, camps, champions: [{ x: 160, y: 22, type: 'goblin', region: 4 }],
    chests, lores, secrets, deco, regions, regionInfo, camp, merchant: [{ x: V.x - 3, y: V.y - 3 }], shrines, goblins, props, objects, onPath,
  };
}

// 바깥 세계용 지역 정보 (층 목록 ZONES에는 넣지 않는다: 관문 · 의뢰 목록에 섞이지 않게)
export const WORLD_ZONE = {
  id: 'world', name: '바람결의 섬', floor: 1, rec: 1, outdoor: true, dark: 0,
  pal: ['#5d9e3b', '#67a842', '#457f2e'], wall: ['#5e4a38', '#8a7258', '#9c8264'], liquid: 'water', liquidPal: ['#2c74a4', '#4aa6c6'],
  deco: ['moss', 'fern', 'pebble'], portal: '#7ed957', pool: ['slime', 'bat', 'goblin', 'mossSlug', 'goblinShaman', 'caveLurker', 'toad', 'leech'],
  regions: OW_PLACES, elite: 'goblinChief',
};

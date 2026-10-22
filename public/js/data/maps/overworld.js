// 바람결의 섬: 하나로 이어진 넓은 세계 (480×360칸). 마을에서 시작해 어디로든 걸어간다.
// 지역마다 땅 · 높낮이 · 물 · 나무 · 몬스터가 다르고, 종족 성지 8곳과 안으로 들어가는 곳(동굴 · 구멍 · 던전 · 미궁 · 용궁)이 흩어져 있다.
//
//      그림자 묘지        서리 설원 (마탑)        북쪽 바위산            화산 지대 (용의 둥지)
//        (납골당)                                  (동굴 2)              ~ 용암 강 ~
//            폐허 도시 (그림자 길드 · 잊힌 미궁)    각인의 탑 고원    거울 호수     메마른 황야 (투기장 · 구멍)
//      이끼 숲 (세계수 · 이끼 동굴)                                   꽃바람 들판 (무너진 왕성)
//   독늪 (가라앉은 사원)         시작 평원 (구멍)                              원시림 (거대 둥지 · 구멍)
//                              바람결 마을                     ~ 남쪽 해안 ~  (자라)   ~ 바다 (용궁) ~
import { buildSanctumVillages } from './sanctvillage.js';
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD, T_DEEP } from '../../sim/mapgen.js';
import { createRng } from '../../sim/rng.js';
import { HOUSES } from './houses.js';
import { BIOME_NODES } from '../goods.js';

export const G = {
  GRASS: 0, DIRT: 1, SAND: 2, TALL: 3, FLOWER: 4, BURNT: 5, ICE: 6, ROCK: 7, FOREST: 8, STONE: 9, BRIDGE: 10, SNOW: 11, THIN: 12,
  ASH: 13, REDSAND: 14, MUD: 15, DEADGRASS: 16, JUNGLE: 17, COBBLE: 18, LAVA: 19, BOG: 20, CRACKED: 21, OBSIDIAN: 22, BLACKROCK: 23, STAIRS: 24,
};
const TW = 480, TH = 360;
export const OW = { TW, TH, VILLAGE: { x: 240, y: 320 }, TOWER: { x: 240, y: 172, rx: 18, ry: 13 }, LAKE: { x: 318, y: 152, rx: 20, ry: 14 }, VOLCANO: { x: 396, y: 60 } };

export const BIOMES = [
  { id: 'plains', lv: [1, 5], name: '시작 평원', x: 236, y: 266, w: 1.25, ground: G.GRASS, road: G.DIRT, pool: ['chargeBoar', 'slime', 'mossSlug', 'bat', 'boarRunner'], trees: 0.012, kinds: ['oak', 'oak', 'birch'] },
  { id: 'meadow', lv: [5, 10], name: '꽃바람 들판', x: 332, y: 248, w: 0.95, ground: G.GRASS, road: G.DIRT, pool: ['spikeSlime', 'goblin', 'slime', 'mudLurker', 'thornSprite', 'boarRunner'], trees: 0.01, kinds: ['oak', 'birch'] },
  { id: 'forest', lv: [10, 15], name: '이끼 숲', x: 106, y: 226, w: 1.1, ground: G.FOREST, road: G.DIRT, pool: ['poisonSpider', 'goblin', 'goblinShaman', 'caveLurker', 'bat', 'vineSpirit', 'forestArcher'], trees: 0.3, kinds: ['oak', 'oak', 'pine'] },
  { id: 'swamp', lv: [15, 20], name: '독늪', x: 82, y: 318, w: 0.95, ground: G.MUD, road: G.DIRT, pool: ['toxShroom', 'toad', 'leech', 'shroom', 'gasBloat', 'bogWitch', 'mudLurker', 'swampTroll'], trees: 0.08, kinds: ['willow', 'willow', 'dead'] },
  { id: 'ruins', lv: [20, 25], name: '폐허 도시', x: 150, y: 140, w: 0.9, ground: G.GRASS, road: G.COBBLE, pool: ['darkArcher', 'watcherEye', 'bandit', 'goblinShaman', 'shieldDemon', 'imp', 'ruinSentinel', 'cultist'], trees: 0.015, kinds: ['oak', 'dead'] },
  { id: 'graveyard', lv: [35, 40], name: '그림자 묘지', x: 64, y: 76, w: 0.95, ground: G.DEADGRASS, road: G.DIRT, pool: ['shadeWraith', 'shadowPanther', 'skeleton', 'wraith', 'ghoul', 'tinyCorpse', 'necroAcolyte', 'boneGuard', 'wraithKnight', 'boneArcher'], trees: 0.05, kinds: ['dead'] },
  { id: 'snow', lv: [40, 45], name: '서리 설원', x: 176, y: 40, w: 1.0, ground: G.SNOW, road: G.STONE, pool: ['iceWolf', 'frostWolf', 'glassSpider', 'frostSlug', 'iceShaman', 'snowLurker', 'iceGolem', 'iceArcher', 'yeti'], trees: 0.05, kinds: ['snowpine'] },
  { id: 'mountains', lv: [30, 35], name: '북쪽 바위산', x: 272, y: 86, w: 1.0, ground: G.ROCK, road: G.DIRT, pool: ['rockGolem', 'watcherEye', 'bat', 'caveLurker', 'goblin', 'frostWolf', 'rockThrower', 'harpy'], trees: 0.025, kinds: ['pine'] },
  { id: 'volcano', lv: [45, 50], name: '화산 지대', x: 396, y: 64, w: 1.0, ground: G.ASH, road: G.BLACKROCK, pool: ['fireBat', 'fireSpirit', 'salamander', 'magmaGolem', 'imp', 'pumpkinFiend', 'chortShaman', 'shieldDemon', 'lavaLizard'], trees: 0.012, kinds: ['charred'] },
  { id: 'wasteland', lv: [30, 35], name: '메마른 황야', x: 402, y: 178, w: 1.05, ground: G.REDSAND, road: G.CRACKED, pool: ['desertScorpion', 'sandScorpion', 'hyena', 'orcRaider', 'sandWorm'], trees: 0.012, kinds: ['cactus'] },
  { id: 'jungle', lv: [25, 30], name: '원시림', x: 404, y: 292, w: 1.0, ground: G.JUNGLE, road: G.DIRT, pool: ['lizardWarrior', 'ironBeetle', 'raptor', 'jungleWasp', 'bigBeetle', 'venomSpitter'], trees: 0.27, kinds: ['jungle', 'jungle', 'palm'] },
  { id: 'lake', lv: [1, 5], name: '거울 호수', x: 318, y: 152, w: 0.55, ground: G.GRASS, road: G.DIRT, pool: ['waterSpirit', 'toad', 'leech', 'slime'], trees: 0.02, kinds: ['oak', 'birch'] },
  { id: 'tower', name: '각인의 탑', x: 240, y: 172, w: 0.55, ground: G.GRASS, road: G.STONE, pool: ['bat'], trees: 0, kinds: ['oak'] },
];
const B = Object.fromEntries(BIOMES.map((b, i) => [b.id, i]));
export const OW_PLACES = [...BIOMES.map((b) => b.name), '바람결 마을', '남쪽 해안'];
const R_VILLAGE = BIOMES.length, R_COAST = BIOMES.length + 1;

// 안으로 들어가는 곳 (theme: 안쪽 그림 · 몬스터의 바탕, relic: 우두머리가 지닌 성물의 종족)
export const ENTRANCES = {
  mossCave: { name: '이끼 동굴', theme: 'cave', prop: 'caveMouth', relic: 'elf' },
  forestCave: { name: '숲속 동굴', theme: 'cave', prop: 'caveMouth', size: { tw: 96, th: 64 }, elite: 'goblinShaman' },
  sunkenTemple: { name: '가라앉은 사원', theme: 'swamp', prop: 'templeRuin' },
  crypt: { name: '지하 묘지', theme: 'grave', prop: 'cryptStairs', relic: 'undead' },
  iceCave: { name: '얼음 동굴', theme: 'frost', prop: 'iceCaveMouth', relic: 'wizard' },
  riftCave: { name: '균열 동굴', theme: 'rift', prop: 'lavaCave', relic: 'dragon' },
  labyrinth: { name: '잊힌 미궁', theme: 'labyrinth', prop: 'labyrinthGate', relic: 'assassin' },
  palace: { name: '용궁', theme: 'palace', prop: 'whirlpool' },
  wasteHole: { name: '황야의 구멍', theme: 'rift', prop: 'hole', size: { tw: 96, th: 64 }, elite: 'orcWarlord', pool: ['sandScorpion', 'hyena', 'orcRaider'], relic: 'orc' },
  jungleHole: { name: '원시림의 구멍', theme: 'swamp', prop: 'hole', size: { tw: 96, th: 64 }, elite: 'raptorAlpha', pool: ['raptor', 'jungleWasp', 'bigBeetle'], relic: 'dino' },
  castleCrypt: { name: '왕성 지하 감옥', theme: 'grave', prop: 'cryptStairs', size: { tw: 96, th: 64 }, elite: 'fallenKnight', pool: ['goblin', 'shieldDemon', 'tinyCorpse'], relic: 'knight' },
  mtCave1: { name: '바위산 동굴', theme: 'cave', prop: 'caveMouth', size: { tw: 96, th: 64 }, elite: 'goblinChief', pool: ['bat', 'caveLurker', 'goblin', 'goblinShaman'] },
  mtCave2: { name: '깊은 바위굴', theme: 'frost', prop: 'caveMouth', size: { tw: 96, th: 64 }, elite: 'iceGolem', pool: ['frostWolf', 'snowLurker', 'bat'] },
  plainsHole: { name: '들판의 구멍', theme: 'cave', prop: 'hole', size: { tw: 96, th: 64 }, elite: 'goblinShaman', pool: ['slime', 'mossSlug', 'bat'] },
};

// 값 노이즈 (부드러운 덩어리)
function noise2(seed) {
  const h = (x, y) => { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const f = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = f(x - xi), w = f(y - yi); return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - w) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * w; };
  return (x, y, oct = 3) => { let s = 0, a = 0.5, fr = 1, n = 0; for (let i = 0; i < oct; i++) { s += v(x * fr, y * fr) * a; n += a; a *= 0.5; fr *= 2; } return s / n; };
}

export function buildOverworld(zone) {
  const rng = createRng(0x0b0a7), N1 = noise2(11), N2 = noise2(23), N3 = noise2(37), N4 = noise2(51);
  const t = new Uint8Array(TW * TH), gr = new Uint8Array(TW * TH), LV = new Int8Array(TW * TH), BI = new Int8Array(TW * TH).fill(-1);
  const I = (x, y) => y * TW + x, inb = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH;
  const T = (x, y) => (inb(x, y) ? t[I(x, y)] : T_DEEP);
  const set = (x, y, tile, g) => { if (!inb(x, y)) return; t[I(x, y)] = tile; if (g != null) gr[I(x, y)] = g; };
  const land = (x, y) => inb(x, y) && BI[I(x, y)] >= 0;
  const ell = (x, y, c) => Math.hypot((x - c.x) / c.rx, (y - c.y) / c.ry);
  const at = (x, y) => ({ x: x * TILE + 8, y: y * TILE + 8 });

  // ───── 1) 섬과 바다 ─────
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const ax = Math.abs((x - TW / 2) / (TW * 0.47)), ay = Math.abs((y - TH / 2) / (TH * 0.465));
    const d = Math.pow(ax ** 3.2 + ay ** 3.2, 1 / 3.2) + (N1(x * 0.03, y * 0.03) - 0.5) * 0.12; // 둥근 사각형 섬 (귀퉁이까지 땅)
    if (d > 1.0) set(x, y, T_DEEP, G.SAND);
    else if (d > 0.975) set(x, y, T_LIQUID, G.SAND);
    else if (d > 0.945) set(x, y, T_FLOOR, G.SAND);
    else BI[I(x, y)] = 0;
  }
  // ───── 2) 지역: 가장 가까운 지역 씨앗 (좌표를 노이즈로 휘어 경계를 구불구불하게, 경계는 섞는다) ─────
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (BI[I(x, y)] < 0) continue;
    const wx = x + (N2(x * 0.018, y * 0.018) - 0.5) * 46, wy = y + (N2(x * 0.018 + 31, y * 0.018 + 17) - 0.5) * 46;
    let b1 = 0, d1 = 1e9, b2 = 0, d2 = 1e9;
    BIOMES.forEach((b, i) => { const d = Math.hypot(wx - b.x, wy - b.y) / b.w; if (d < d1) { b2 = b1; d2 = d1; b1 = i; d1 = d; } else if (d < d2) { b2 = i; d2 = d; } });
    let b = b1;
    if ((d2 - d1) / d1 < 0.05 && (Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 28) < 7) b = b2; // 경계 섞기
    if (ell(x, y, OW.TOWER) < 1) b = B.tower;
    BI[I(x, y)] = b; set(x, y, T_FLOOR, BIOMES[b].ground);
  }
  const bio = (x, y) => (inb(x, y) ? BI[I(x, y)] : -1);

  // ───── 3) 높낮이 ─────
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const b = bio(x, y); if (b < 0) continue;
    let h = 0;
    if (b === B.mountains) h = (1 - Math.hypot(x - 272, (y - 80) * 1.2) / 78) * 4.8 + (N3(x * 0.06, y * 0.06) - 0.5) * 1.8;
    else if (b === B.snow) h = (N3(x * 0.035 + 7, y * 0.035) - 0.42) * 4.2;
    else if (b === B.volcano) { const d = Math.hypot(x - OW.VOLCANO.x, y - OW.VOLCANO.y); h = (1 - d / 50) * 4.9 + (N3(x * 0.08, y * 0.08) - 0.5) * 0.7; }
    else if (b === B.tower) h = 1.2;
    LV[I(x, y)] = Math.max(0, Math.min(4, Math.floor(h)));
  }
  // 황야의 메사 (평평한 바위 언덕)
  for (let k = 0; k < 9; k++) {
    const mx = rng.int(360, 452), my = rng.int(130, 232), rx = rng.int(5, 12), ry = rng.int(4, 9), lv = k === 0 ? 2 : 1;
    for (let y = my - ry - 2; y <= my + ry + 2; y++) for (let x = mx - rx - 2; x <= mx + rx + 2; x++) {
      if (bio(x, y) !== B.wasteland) continue;
      if (Math.hypot((x - mx) / rx, (y - my) / ry) + (N4(x * 0.2, y * 0.2) - 0.5) * 0.3 < 1) LV[I(x, y)] = Math.max(LV[I(x, y)], lv);
    }
  }
  // 높이가 바뀌는 곳은 절벽
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const l = LV[I(x, y)]; if (!l || bio(x, y) < 0) continue;
    if (bio(x, y) === B.mountains && l >= 3) gr[I(x, y)] = G.SNOW;
    if (bio(x, y) === B.volcano && l >= 3) gr[I(x, y)] = G.BLACKROCK;
    if ([[0, 1], [-1, 0], [1, 0], [0, -1]].some(([dx, dy]) => land(x + dx, y + dy) && LV[I(x + dx, y + dy)] < l)) set(x, y, T_WALL);
  }
  { // 남쪽을 보는 절벽은 두 칸 높이
    const add = [];
    for (let y = 1; y < TH - 1; y++) for (let x = 0; x < TW; x++) if (T(x, y) === T_WALL && T(x, y + 1) !== T_WALL && T(x, y - 1) === T_FLOOR) add.push([x, y - 1]);
    for (const [x, y] of add) set(x, y, T_WALL);
  }

  // ───── 4) 물: 호수 · 강 · 늪 · 연못 · 용암 · 얼어붙은 호수 ─────
  const L = OW.LAKE;
  for (let y = L.y - L.ry - 5; y <= L.y + L.ry + 5; y++) for (let x = L.x - L.rx - 5; x <= L.x + L.rx + 5; x++) {
    const d = ell(x, y, L) + (N3(x * 0.12, y * 0.12) - 0.5) * 0.12;
    if (d < 0.78) set(x, y, T_DEEP, G.SAND); else if (d < 1.0) set(x, y, T_LIQUID, G.SAND); else if (d < 1.2 && T(x, y) === T_FLOOR) gr[I(x, y)] = G.SAND;
  }
  const island = { x: L.x + 4, y: L.y - 2 };
  for (let y = island.y - 3; y <= island.y + 3; y++) for (let x = island.x - 4; x <= island.x + 4; x++) if (((x - island.x) / 4) ** 2 + ((y - island.y) / 2.6) ** 2 <= 1) set(x, y, T_FLOOR, Math.hypot(x - island.x, y - island.y) < 1.8 ? G.GRASS : G.SAND);
  const carveRiver = (pts, wd) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= n; k++) {
        const u = k / n, px = ax + (bx - ax) * u + (N4((ax + k) * 0.1, ay * 0.1) - 0.5) * 3, py = ay + (by - ay) * u;
        for (let y = Math.floor(py - wd - 2); y <= py + wd + 2; y++) for (let x = Math.floor(px - wd - 2); x <= px + wd + 2; x++) {
          if (!inb(x, y) || (T(x, y) === T_DEEP && bio(x, y) < 0)) continue;
          const d = Math.hypot(x - px, y - py);
          if (d < wd) set(x, y, T_DEEP, G.SAND);
          else if (d < wd + 1.1 && T(x, y) !== T_DEEP) set(x, y, T_LIQUID, G.SAND);
          else if (d < wd + 2 && T(x, y) === T_FLOOR && LV[I(x, y)] === 0) gr[I(x, y)] = G.SAND;
        }
      }
    }
  };
  carveRiver([[262, 50], [278, 84], [270, 112], [292, 132], [306, 146]], 1.4);
  carveRiver([[334, 162], [352, 196], [372, 232], [392, 262], [418, 296], [440, 330], [452, 350]], 1.5);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const b = bio(x, y); if (b < 0 || T(x, y) !== T_FLOOR || LV[I(x, y)]) continue;
    if (b === B.swamp) { const n = N4(x * 0.09, y * 0.09); if (n > 0.66) set(x, y, T_DEEP, G.BOG); else if (n > 0.57) set(x, y, T_LIQUID, G.BOG); }
    else if (b === B.jungle && N4(x * 0.07 + 40, y * 0.07) > 0.72) set(x, y, N4(x * 0.07 + 40, y * 0.07) > 0.78 ? T_DEEP : T_LIQUID, G.SAND);
    else if (b === B.snow && Math.hypot((x - 196) / 13, (y - 64) / 8) < 1) set(x, y, T_FLOOR, G.ICE); // 얼어붙은 호수
  }
  // 화산: 분화구 용암 호수 + 산을 타고 흐르는 용암 강 (흐르는 용암은 밟을 수 있지만 뜨겁다)
  const V0 = OW.VOLCANO;
  for (let y = V0.y - 8; y <= V0.y + 8; y++) for (let x = V0.x - 8; x <= V0.x + 8; x++) {
    const d = Math.hypot(x - V0.x, y - V0.y);
    if (d < 5.5) set(x, y, T_DEEP, G.LAVA); else if (d < 7.5) set(x, y, T_FLOOR, G.BLACKROCK);
  }
  for (const [ex, ey] of [[370, 104], [430, 92], [412, 30], [356, 50]]) {
    const n = Math.ceil(Math.hypot(ex - V0.x, ey - V0.y));
    for (let k = 6; k < n; k++) {
      const px = V0.x + (ex - V0.x) * k / n + (N4(k * 0.2, ex) - 0.5) * 3, py = V0.y + (ey - V0.y) * k / n;
      for (let y = Math.floor(py - 1); y <= py + 1; y++) for (let x = Math.floor(px - 1); x <= px + 1; x++) if (inb(x, y) && Math.hypot(x - px, y - py) < 1.25 && bio(x, y) >= 0) set(x, y, T_LIQUID, G.LAVA);
    }
  }
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const k = I(x, y);
    if (BI[k] === B.volcano && t[k] === T_FLOOR && gr[k] === G.ASH && N3(x * 0.1 + 9, y * 0.1) > 0.58) gr[k] = G.BLACKROCK;
    if (BI[k] === B.wasteland && t[k] === T_FLOOR && N3(x * 0.07 + 3, y * 0.07) > 0.56) gr[k] = G.CRACKED;
  }

  // ───── 5) 폐허 도시: 무너진 건물 벽 · 돌길 ─────
  for (let by = 112; by < 172; by += 13) for (let bx = 112; bx < 190; bx += 14) {
    const x0 = bx + rng.int(0, 3), y0 = by + rng.int(0, 3), w = rng.int(6, 10), h = rng.int(5, 8);
    if (bio(x0 + (w >> 1), y0 + (h >> 1)) !== B.ruins || Math.hypot(x0 - 160, y0 - 150) < 9 || Math.hypot(x0 - 142, y0 - 132) < 9) continue;
    for (let y = y0; y <= y0 + h; y++) for (let x = x0; x <= x0 + w; x++) {
      const edge = x === x0 || x === x0 + w || y === y0 || y === y0 + h;
      if (edge) { if (rng.chance(0.68) && !(y === y0 + h && Math.abs(x - x0 - (w >> 1)) <= 1)) set(x, y, T_WALL, G.COBBLE); else set(x, y, T_FLOOR, G.COBBLE); }
      else set(x, y, T_FLOOR, rng.chance(0.3) ? G.COBBLE : G.DIRT);
    }
  }
  for (let y = 108; y < 176; y++) for (let x = 108; x < 194; x++) if (bio(x, y) === B.ruins && t[I(x, y)] === T_FLOOR && gr[I(x, y)] === G.GRASS && ((x - 108) % 14 < 2 || (y - 108) % 13 < 2)) gr[I(x, y)] = G.COBBLE;

  // ───── 6) 큰 건물: 마을 · 탑 · 성지 · 입구 ─────
  const props = [], objects = [], occupied = new Uint8Array(TW * TH), safe = [];
  const clear = (cx, cy, r, g) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inb(x, y) && Math.hypot(x - cx, y - cy) <= r + 0.3 && bio(x, y) >= 0) { if (t[I(x, y)] !== T_BUILD) set(x, y, T_FLOOR); if (g != null && Math.hypot(x - cx, y - cy) < r - 1) gr[I(x, y)] = g; if (gr[I(x, y)] === G.LAVA || gr[I(x, y)] === G.BOG) gr[I(x, y)] = BIOMES[bio(x, y)].ground; LV[I(x, y)] = LV[I(cx, cy)]; } };
  const prop = (kind, x, y, w, h, extra = {}) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { set(xx, yy, T_BUILD); occupied[I(xx, yy)] = 1; } const pr = { kind, x, y, w, h, ...extra }; props.push(pr); return pr; };
  // 마을: 가운데 돌 광장(모닥불 · 우물 · 떠돌이 상인), 둘레에 집 여섯 채(문으로 들어간다), 동쪽에 울타리 친 텃밭
  const V = OW.VILLAGE, FARM = { x0: V.x + 24, y0: V.y - 5, x1: V.x + 35, y1: V.y + 5 };
  for (let y = V.y - 16; y <= V.y + 12; y++) for (let x = V.x - 28; x <= V.x + 38; x++) {
    if (!land(x, y)) continue;
    const d = Math.hypot((x - V.x) / 28, (y - V.y) / 14), farmy = x >= FARM.x0 - 3 && x <= FARM.x1 + 3 && y >= FARM.y0 - 3 && y <= FARM.y1 + 3;
    if (d < 1 || farmy) { set(x, y, T_FLOOR, Math.hypot((x - V.x) / 9, (y - V.y) / 5.5) < 1 ? G.STONE : G.GRASS); LV[I(x, y)] = 0; }
  }
  const HOUSE_AT = [['altar', -22, -13], ['library', -12, -14], ['guild', 5, -14], ['forge', 14, -13], ['shop', -21, 4], ['dojo', 13, 4]];
  const doors = [];
  for (const [kind, ox, oy] of HOUSE_AT) {
    const H = HOUSES[kind], x = V.x + ox, y = V.y + oy, dx = x + (H.w >> 1), dy = y + H.h;
    prop('house_' + kind, x, y, H.w, H.h, { house: kind, doorX: dx * TILE + 8 });
    objects.push({ kind: 'door', house: kind, ...at(dx, dy), label: `${H.name} · 들어가기`, reusable: true });
    doors.push([dx, dy]);
  }
  // 문 앞에서 광장까지 돌길
  const street = (x, y) => { if (inb(x, y) && t[I(x, y)] === T_FLOOR && !occupied[I(x, y)] && gr[I(x, y)] !== G.STONE) gr[I(x, y)] = G.COBBLE; };
  for (const [dx, dy] of doors) {
    const ty = dy < V.y ? V.y - 4 : V.y + 4, sy = Math.sign(ty - dy) || 1;
    for (let y = dy; y !== ty + sy; y += sy) { street(dx, y); street(dx + 1, y); }
    const sx = Math.sign(V.x - dx);
    for (let x = dx; x !== V.x - sx * 6; x += sx) { street(x, ty); street(x, ty + 1); }
  }
  prop('well', V.x + 4, V.y + 2, 2, 1);
  objects.push({ kind: 'rest', ...at(V.x, V.y), label: '마을 모닥불 · 쉬고 저장하기', reusable: true });
  // 텃밭: 흙밭 + 울타리(서쪽에 문) + 허수아비 + 표지판
  for (let y = FARM.y0; y <= FARM.y1; y++) for (let x = FARM.x0; x <= FARM.x1; x++) set(x, y, T_FLOOR, G.DIRT);
  prop('fence', FARM.x0 - 1, FARM.y0 - 1, FARM.x1 - FARM.x0 + 3, 1, { dir: 'h' });
  prop('fence', FARM.x0 - 1, FARM.y1 + 1, FARM.x1 - FARM.x0 + 3, 1, { dir: 'h' });
  for (let y = FARM.y0; y <= FARM.y1; y++) {
    if (Math.abs(y - V.y) > 1) prop('fence', FARM.x0 - 1, y, 1, 1, { dir: 'v' });
    prop('fence', FARM.x1 + 1, y, 1, 1, { dir: 'v' });
  }
  for (let x = V.x + 9; x < FARM.x0 - 1; x++) { street(x, V.y); street(x, V.y - 1); }
  prop('scarecrow', FARM.x1, FARM.y0, 1, 1);
  // 내 집: 텃밭 북쪽 (문 앞 돌길이 텃밭 서쪽 입구로 이어진다)
  const HOME = { x: FARM.x0 + 3, y: FARM.y0 - 10 }, HH = HOUSES.home;
  for (let y = HOME.y - 3; y <= FARM.y0 - 2; y++) for (let x = HOME.x - 5; x <= HOME.x + HH.w + 4; x++) if (land(x, y) && !occupied[I(x, y)]) { set(x, y, T_FLOOR, G.GRASS); LV[I(x, y)] = 0; }
  {
    const dx = HOME.x + (HH.w >> 1), dy = HOME.y + HH.h;
    prop('house_home', HOME.x, HOME.y, HH.w, HH.h, { house: 'home', doorX: dx * TILE + 8 });
    objects.push({ kind: 'door', house: 'home', ...at(dx, dy), label: '내 집 · 들어가기', reusable: true });
    for (let y = dy; y <= FARM.y0 - 2; y++) { street(dx, y); street(dx + 1, y); }
    for (let x = FARM.x0 - 3; x <= dx + 1; x++) street(x, FARM.y0 - 2);
    for (let y = FARM.y0 - 2; y <= V.y; y++) { street(FARM.x0 - 3, y); street(FARM.x0 - 2, y); }
    prop('mailbox', dx + 2, dy, 1, 1);
    safe.push({ x: dx, y: HOME.y + 3, r: 11 });
  }
  // 가로등: 광장 둘레 · 텃밭 입구 · 집 앞 (밤에 불이 켜진다)
  for (const [lx, ly] of [[V.x - 10, V.y - 3], [V.x + 10, V.y - 3], [V.x - 10, V.y + 4], [V.x + 10, V.y + 4], [FARM.x0 - 4, V.y + 2], [HOME.x - 1, HOME.y + HH.h + 1], [V.x - 1, V.y - 9], [V.x + 1, V.y + 9]]) {
    if (inb(lx, ly) && t[I(lx, ly)] === T_FLOOR && !occupied[I(lx, ly)] && gr[I(lx, ly)] !== G.COBBLE) prop('lampPost', lx, ly, 1, 1);
  }
  objects.push({ kind: 'sign', ...at(FARM.x0 - 3, V.y - 2), text: '바람결 텃밭 — 누구나 일굴 수 있어요. 괭이로 밭을 갈고(G), 씨앗을 심고, 물을 주면 자랍니다. 씨앗은 잡화점에서 팔아요.', label: '표지판 읽기', reusable: true });
  safe.push({ x: V.x, y: V.y, r: 34 }, { x: (FARM.x0 + FARM.x1) >> 1, y: (FARM.y0 + FARM.y1) >> 1, r: 16 });
  // 각인의 탑
  const TWR = OW.TOWER;
  for (let y = TWR.y - TWR.ry; y <= TWR.y + TWR.ry; y++) for (let x = TWR.x - TWR.rx; x <= TWR.x + TWR.rx; x++) if (ell(x, y, TWR) < 0.6 && t[I(x, y)] === T_FLOOR) gr[I(x, y)] = G.STONE;
  for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy < 4; dy++) set(TWR.x + dx, TWR.y + TWR.ry - dy, T_FLOOR, G.STAIRS);
  prop('tower', TWR.x - 2, TWR.y - 3, 5, 4);
  objects.push({ kind: 'towerDoor', ...at(TWR.x, TWR.y + 1), label: '각인의 탑 · 위층으로', reusable: true });
  objects.push({ kind: 'raidAltar', ...at(TWR.x + 7, TWR.y + 4), label: '레이드 제단 · 보스 레이드', reusable: true }); // 보스 레이드 (탑 옆)
  safe.push({ x: TWR.x, y: TWR.y, r: 16 });
  // 종족 성지 8곳: 건물 + 수호자 (앞에 돌바닥)
  const SANCT = [
    ['wizard', 'mageTower', 172, 30, 3, 3], ['elf', 'worldTree', 94, 216, 3, 2], ['knight', 'castle', 326, 238, 11, 5], ['orc', 'arena', 404, 176, 9, 5],
    ['undead', 'mausoleum', 62, 70, 5, 3], ['assassin', 'guildHouse', 140, 130, 5, 3], ['dino', 'nest', 410, 292, 5, 3], ['dragon', 'dragonNest', 372, 86, 5, 3],
  ];
  const sanctums = {};
  for (const [race, kind, x, y, w, h] of SANCT) {
    clear(x + (w >> 1), y + (h >> 1), Math.max(w, h) + 4, null);
    for (let yy = y + h; yy <= y + h + 3; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (inb(xx, yy)) set(xx, yy, T_FLOOR, G.STONE);
    prop(kind, x, y, w, h, { race });
    const door = { x: x + (w >> 1), y: y + h + 1 };
    objects.push({ kind: 'sanctum', race, art: `keep_${race}`, ...at(door.x - 2, door.y), label: '성지 수호자와 이야기', reusable: true });
    sanctums[race] = door; safe.push({ x: door.x, y: door.y, r: 11 });
  }
  // 입구들: 동굴 입구는 바위로 감싼다, 구멍은 들판에 뚫린다
  const ENTR = [
    ['mossCave', 60, 248], ['forestCave', 128, 202], ['sunkenTemple', 86, 314], ['crypt', 92, 96], ['iceCave', 214, 26], ['riftCave', 412, 96],
    ['labyrinth', 160, 150], ['wasteHole', 424, 210], ['jungleHole', 382, 312], ['castleCrypt', 318, 250], ['mtCave1', 250, 66], ['mtCave2', 302, 58], ['plainsHole', 198, 282],
  ];
  const entrances = {};
  for (const [id, x, y] of ENTR) {
    const def = ENTRANCES[id], kind = def.prop;
    clear(x, y, 4, null);
    if (kind === 'caveMouth' || kind === 'iceCaveMouth' || kind === 'lavaCave') {
      for (let yy = y - 4; yy <= y - 1; yy++) for (let xx = x - 5; xx <= x + 5; xx++) if (inb(xx, yy) && Math.hypot((xx - x) / 5, (yy - y + 2) / 2.5) < 1) set(xx, yy, T_WALL, kind === 'iceCaveMouth' ? G.SNOW : kind === 'lavaCave' ? G.BLACKROCK : G.ROCK);
      prop(kind, x - 2, y - 2, 5, 2);
    } else if (kind === 'hole') prop('hole', x - 1, y - 1, 3, 2);
    else if (kind === 'templeRuin') prop('templeRuin', x - 2, y - 3, 5, 3);
    else if (kind === 'cryptStairs') prop('cryptStairs', x - 1, y - 2, 3, 2);
    else if (kind === 'labyrinthGate') prop('labyrinthGate', x - 2, y - 3, 5, 3);
    for (let xx = x - 1; xx <= x + 1; xx++) set(xx, y, T_FLOOR, G.DIRT);
    objects.push({ kind: 'entrance', id, ...at(x, y), label: `${def.name}${kind === 'hole' ? '으로 뛰어내리기' : '로 들어가기'}`, reusable: true });
    entrances[id] = { x, y }; safe.push({ x, y, r: 6 });
  }
  // 바다 속 용궁: 남동쪽 바다의 작은 섬, 소용돌이 · 해변의 자라가 데려다 준다
  let coast = null;
  for (let k = 0; k < 300; k++) { const x = Math.round(240 + (440 - 240) * k / 300), y = Math.round(180 + (336 - 180) * k / 300); if (T(x, y) === T_DEEP && bio(x, y) < 0) { coast = { x, y }; break; } }
  coast ||= { x: 420, y: 316 };
  const islet = { x: coast.x + 8, y: coast.y + 6 };
  for (let y = islet.y - 3; y <= islet.y + 3; y++) for (let x = islet.x - 4; x <= islet.x + 4; x++) if (inb(x, y) && ((x - islet.x) / 4) ** 2 + ((y - islet.y) / 2.8) ** 2 <= 1) set(x, y, T_FLOOR, G.SAND);
  for (let y = islet.y + 3; y <= islet.y + 5; y++) for (let x = islet.x - 1; x <= islet.x + 2; x++) if (inb(x, y)) set(x, y, T_DEEP, G.SAND);
  props.push({ kind: 'whirlpool', x: islet.x - 1, y: islet.y + 3, w: 3, h: 3 });
  objects.push({ kind: 'entrance', id: 'palace', ...at(islet.x, islet.y + 2), label: '소용돌이에 뛰어든다 (용궁)', reusable: true });
  const beach = { x: coast.x - 6, y: coast.y - 6 };
  for (let k = 0; k < 20 && !(T(beach.x, beach.y) === T_FLOOR && gr[I(beach.x, beach.y)] === G.SAND); k++) { beach.x--; beach.y--; }
  objects.push({ kind: 'turtle', ...at(beach.x, beach.y), label: '바닷가의 자라와 이야기', reusable: true });
  entrances.palace = islet; safe.push({ x: beach.x, y: beach.y, r: 6 });

  // ───── 7) 길: 마을에서 각 지역으로 (물은 다리, 절벽은 계단) ─────
  const onPath = new Uint8Array(TW * TH);
  const carve = (x, y, rb) => {
    if (!inb(x, y) || occupied[I(x, y)]) return;
    const tt = t[I(x, y)], b = bio(x, y);
    if (tt === T_DEEP || tt === T_LIQUID) { if (b < 0 && tt === T_DEEP) return; set(x, y, T_FLOOR, gr[I(x, y)] === G.LAVA ? G.STONE : G.BRIDGE); }
    else if (tt === T_WALL || tt === T_CRACK) set(x, y, T_FLOOR, G.STAIRS);
    else if (tt === T_BUILD) return;
    else if (gr[I(x, y)] !== G.STONE && gr[I(x, y)] !== G.BRIDGE && gr[I(x, y)] !== G.STAIRS && gr[I(x, y)] !== G.ICE) gr[I(x, y)] = rb ?? (b >= 0 ? BIOMES[b].road : G.DIRT);
    onPath[I(x, y)] = 1;
  };
  const road = (pts, wd = 1.45) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= n; k++) {
        const u = k / n, px = ax + (bx - ax) * u + (N4(ax * 0.3 + k * 0.08, ay) - 0.5) * 2.2 * Math.sin(u * Math.PI), py = ay + (by - ay) * u;
        for (let y = Math.floor(py - wd); y <= py + wd; y++) for (let x = Math.floor(px - wd); x <= px + wd; x++) if (Math.hypot(x - px, y - py) <= wd) carve(x, y);
      }
    }
  };
  const E = entrances, S = sanctums;
  road([[V.x, V.y - 6], [V.x, 286], [238, 240], [TWR.x, TWR.y + TWR.ry + 1]]);
  road([[V.x - 26, V.y - 1], [204, 302], [S.elf.x + 40, 262], [S.elf.x + 12, S.elf.y + 6], [S.elf.x, S.elf.y]]);
  road([[S.elf.x + 12, S.elf.y + 6], [E.mossCave.x + 6, E.mossCave.y + 4], [E.mossCave.x, E.mossCave.y + 1]]);
  road([[S.elf.x + 12, S.elf.y + 6], [100, 288], [E.sunkenTemple.x, E.sunkenTemple.y + 1]]);
  road([[S.elf.x + 20, S.elf.y - 6], [E.forestCave.x, E.forestCave.y + 1]]);
  road([[TWR.x - 18, TWR.y], [196, 160], [E.labyrinth.x + 2, E.labyrinth.y + 3], [S.assassin.x, S.assassin.y], [120, 118], [E.crypt.x, E.crypt.y + 1], [S.undead.x, S.undead.y]]);
  road([[TWR.x, TWR.y - TWR.ry], [246, 132], [E.mtCave1.x, E.mtCave1.y + 1], [222, 60], [S.wizard.x, S.wizard.y]]);
  road([[S.wizard.x + 10, S.wizard.y], [E.iceCave.x, E.iceCave.y + 1]]);
  road([[246, 132], [290, 104], [E.mtCave2.x, E.mtCave2.y + 1], [340, 92], [S.dragon.x, S.dragon.y], [E.riftCave.x, E.riftCave.y + 1]]);
  road([[TWR.x + 18, TWR.y + 4], [290, 176], [340, 182], [380, 184], [S.orc.x, S.orc.y], [E.wasteHole.x, E.wasteHole.y + 1]]);
  road([[V.x + 22, V.y - 12], [290, 292], [S.knight.x - 6, S.knight.y + 6], [S.knight.x, S.knight.y], [E.castleCrypt.x, E.castleCrypt.y + 1]]);
  road([[S.knight.x + 8, S.knight.y + 4], [370, 278], [S.dino.x, S.dino.y], [E.jungleHole.x, E.jungleHole.y + 1]]);
  road([[S.orc.x, S.orc.y + 8], [410, 240], [S.dino.x, S.dino.y - 6]]);
  road([[V.x + 21, V.y + 10], [300, 326], [beach.x - 4, beach.y], [beach.x, beach.y]]);
  road([[V.x - 26, V.y - 8], [E.plainsHole.x, E.plainsHole.y + 1]]);
  road([[290, 176], [296, 168], [L.x - L.rx - 1, L.y + 3]]);
  // 선착장: 물가에서 나무 다리를 물로 몇 칸 내고, 끝에 배를 둔다
  const docks = [];
  const pier = (sx, sy, dx, dy, len = 3) => {
    let x = sx, y = sy, k = 0;
    while (inb(x, y) && k++ < 40 && !(t[I(x, y)] === T_DEEP || t[I(x, y)] === T_LIQUID)) { x += dx; y += dy; } // 물가까지
    if (!inb(x, y)) return;
    for (let i = 0; i < len; i++) { if (!inb(x, y)) return; set(x, y, T_FLOOR, G.BRIDGE); if (dx) { set(x, y - 1, T_FLOOR, G.BRIDGE); } else set(x + 1, y, T_FLOOR, G.BRIDGE); x += dx; y += dy; }
    if (inb(x, y) && (t[I(x, y)] === T_DEEP || t[I(x, y)] === T_LIQUID)) docks.push({ bx: x, by: y });
  };
  pier(V.x + 6, V.y + 10, 0, 1, 3);
  road([[V.x + 4, V.y + 5], [V.x + 6, V.y + 12]]);
  pier(L.x - L.rx - 1, L.y + 3, 1, 0, 2);
  pier(beach.x - 2, beach.y, 0, 1, 3);
  // 갈림길 표지판
  const signs = [
    [V.x + 2, V.y - 17, '↑ 각인의 탑  ·  ↖ 이끼 숲 · 독늪  ·  ↗ 꽃바람 들판 · 원시림  ·  ↘ 남쪽 해안'],
    [TWR.x + 3, TWR.y + TWR.ry + 6, '← 폐허 도시 · 그림자 묘지  ·  ↑ 북쪽 바위산 · 서리 설원  ·  → 거울 호수 · 메마른 황야'],
    [249, 136, '← 서리 설원 (마탑)  ·  → 화산 지대 (홍염 분화구)'], [S.elf.x + 14, S.elf.y + 9, '↑ 세계수  ·  ← 이끼 동굴  ·  ↓ 독늪'],
    [S.knight.x - 8, S.knight.y + 9, '↑ 무너진 왕성  ·  → 원시림'], [342, 186, '→ 황야의 투기장  ·  ← 각인의 탑'],
  ];
  for (const [x, y, text] of signs) { if (inb(x, y) && t[I(x, y)] === T_FLOOR) objects.push({ kind: 'sign', ...at(x, y), text, label: '표지판 읽기', reusable: true }); }

  // ───── 8) 나무 · 키 큰 풀 · 꽃 · 장식 ─────
  const nearSafe = (x, y, pad = 0) => safe.some((s) => Math.hypot(x - s.x, y - s.y) < s.r * 0.6 + pad);
  const trees = new Set(), deco = [];
  const dc = (x, y, kind) => deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind, v: rng.int(0, 3) });
  for (let y = 3; y < TH - 3; y++) for (let x = 3; x < TW - 3; x++) {
    const k = I(x, y), b = BI[k];
    if (b < 0 || t[k] !== T_FLOOR || onPath[k] || occupied[k] || nearSafe(x, y, 2)) continue;
    const g = gr[k];
    if (g === G.SAND || g === G.STONE || g === G.BRIDGE || g === G.STAIRS || g === G.ICE || g === G.COBBLE || g === G.LAVA) continue;
    const bm = BIOMES[b], dens = bm.trees * (0.5 + N1(x * 0.05 + b * 9, y * 0.05) * 1.1);
    if (rng.chance(dens) && !trees.has(I(x - 1, y)) && !trees.has(I(x + 1, y)) && !trees.has(I(x, y - 1)) && !trees.has(I(x, y + 1)) && !trees.has(I(x - 1, y - 1)) && !trees.has(I(x + 1, y - 1))) {
      trees.add(k); prop('tree', x, y, 1, 1, { tree: LV[k] >= 2 && b === B.mountains ? 'pine' : rng.pick(bm.kinds), v: rng.int(0, 3) });
      continue;
    }
    if ((b === B.plains || b === B.meadow || b === B.lake) && g === G.GRASS) { if (N1(x * 0.1 + 50, y * 0.1) > 0.62) gr[k] = G.TALL; else if (rng.chance(b === B.meadow ? 0.18 : 0.045)) gr[k] = G.FLOWER; }
    if (b === B.jungle && N1(x * 0.12 + 70, y * 0.12) > 0.6) gr[k] = G.TALL;
    if (b === B.forest && rng.chance(0.06)) dc(x, y, rng.chance(0.5) ? 'glowshroom' : 'fern');
    else if (b === B.graveyard && rng.chance(0.07)) dc(x, y, rng.pick(['tomb', 'tomb', 'candle', 'bone']));
    else if (b === B.snow && rng.chance(0.03)) dc(x, y, rng.pick(['crystalB', 'icicle']));
    else if (b === B.volcano && rng.chance(0.05)) dc(x, y, rng.pick(['ember', 'crystalR', 'pebble']));
    else if (b === B.wasteland && rng.chance(0.03)) dc(x, y, rng.pick(['bone', 'pebble', 'skullDeco']));
    else if (b === B.swamp && rng.chance(0.06)) dc(x, y, rng.pick(['reed', 'reed', 'lily']));
    else if ((b === B.mountains || b === B.ruins) && rng.chance(0.04)) dc(x, y, 'pebble');
  }
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) if (gr[I(x, y)] === G.BOG && t[I(x, y)] === T_LIQUID && rng.chance(0.08)) dc(x, y, 'lily');

  // ───── 9) 걸어서 닿는지 검사: 막혔으면 가장 가까운 닿는 곳에서 길을 낸다 ─────
  const reach = () => {
    const seen = new Uint8Array(TW * TH), q = new Int32Array(TW * TH); let qh = 0, qt = 0;
    const s0 = I(V.x, V.y + 4); seen[s0] = 1; q[qt++] = s0;
    while (qh < qt) { const i = q[qh++], x = i % TW, y = (i / TW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = I(nx, ny), v = t[j]; if (!seen[j] && (v === T_FLOOR || v === T_LIQUID)) { seen[j] = 1; q[qt++] = j; } } }
    return seen;
  };
  const removeTree = (x, y) => { const i = props.findIndex((p) => p.kind === 'tree' && p.x === x && p.y === y); if (i >= 0) { props.splice(i, 1); occupied[I(x, y)] = 0; t[I(x, y)] = T_FLOOR; trees.delete(I(x, y)); } };
  // 막힌 곳에서 출발해, 건물 · 바다만 피해 닿는 곳까지 가장 짧은 길을 찾아 판다 (나무는 베고, 물은 다리, 절벽은 계단)
  const ensure = (tx, ty) => {
    const seen = reach();
    if (seen[I(tx, ty)]) return true;
    const prev = new Int32Array(TW * TH).fill(-1), q = new Int32Array(TW * TH); let qh = 0, qt = 0, hit = -1;
    const s0 = I(tx, ty); prev[s0] = s0; q[qt++] = s0;
    while (qh < qt && hit < 0) {
      const i = q[qh++], x = i % TW, y = (i / TW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
        const j = I(nx, ny);
        if (prev[j] >= 0) continue;
        if (occupied[j] && !trees.has(j)) continue;            // 건물은 돌아간다
        if (BI[j] < 0 && t[j] === T_DEEP) continue;            // 바다는 못 건넌다
        prev[j] = i;
        if (seen[j]) { hit = j; break; }
        q[qt++] = j;
      }
    }
    if (hit < 0) return false;
    for (let i = hit; i !== s0; i = prev[i]) { const x = i % TW, y = (i / TW) | 0; for (const [dx, dy] of [[0, 0], [1, 0]]) { if (trees.has(I(x + dx, y + dy))) removeTree(x + dx, y + dy); carve(x + dx, y + dy); } }
    if (trees.has(s0)) removeTree(tx, ty); carve(tx, ty);
    return !!reach()[s0];
  };
  const tile = (o) => [Math.floor(o.x / TILE), Math.floor(o.y / TILE)];
  for (const o of objects) { if (o.id === 'palace') continue; const [x, y] = tile(o); ensure(x, y); }

  // ───── 10) 성물 · 상자 · 몬스터 ─────
  const seen = reach();
  const biomeTiles = (b, cond) => { const out = []; for (let y = 4; y < TH - 4; y += 2) for (let x = 4; x < TW - 4; x += 2) { const k = I(x, y); if (BI[k] === b && t[k] === T_FLOOR && seen[k] && !onPath[k] && !occupied[k] && cond(x, y, k)) out.push({ x, y }); } return out; };
  const RELIC_BIOME = { wizard: B.snow, elf: B.forest, knight: B.meadow, orc: B.wasteland, undead: B.graveyard, assassin: B.ruins, dino: B.jungle, dragon: B.volcano };
  const relics = [];
  for (const [race, b] of Object.entries(RELIC_BIOME)) {
    const s = sanctums[race];
    const cand = biomeTiles(b, (x, y) => Math.hypot(x - s.x, y - s.y) > 18 && !nearSafe(x, y, 4)).map((c) => ({ ...c, r: rng.next() })).sort((a, c) => (LV[I(c.x, c.y)] - LV[I(a.x, a.y)]) || (a.r - c.r));
    let n = 0;
    for (const c of cand) { if (n >= 2) break; if (relics.some((r) => Math.hypot(r.x - c.x, r.y - c.y) < 22)) continue; relics.push({ x: c.x, y: c.y, race, id: `${race}_${n + 1}` }); n++; }
  }
  for (const r of relics) objects.push({ kind: 'relic', race: r.race, rid: r.id, ...at(r.x, r.y), label: '빛나는 성물 줍기' });
  // 옛 기술 석판: 그 지역 깊은 곳 (높은 곳 · 길에서 먼 곳) — 읽으면 기술을 배운다
  const TABLETS = [['enchantFire', B.volcano], ['enchantIce', B.snow], ['enchantLightning', B.mountains], ['enchantPoison', B.swamp], ['windStep', B.meadow], ['shadowStep', B.ruins], ['vineSnare', B.forest], ['retreatShot', B.jungle], ['leap', B.wasteland]];
  const tabs = [];
  const farFromRoad = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (inb(x + dx, y + dy) && onPath[I(x + dx, y + dy)]) return false; return true; };
  for (const [skill, b] of []) { // 옛 기술 석판은 없앴다: 기술은 숙련(같은 행동 반복)으로 깨닫는다 (TABLETS는 기록으로만 남긴다)
    const cand = biomeTiles(b, (x, y) => !nearSafe(x, y, 6) && farFromRoad(x, y)).map((c) => ({ ...c, r: rng.next() })).sort((a, c) => (LV[I(c.x, c.y)] - LV[I(a.x, a.y)]) || (a.r - c.r));
    const c = cand.find((q) => !relics.some((r) => Math.hypot(r.x - q.x, r.y - q.y) < 16) && !tabs.some((r) => Math.hypot(r.x - q.x, r.y - q.y) < 30));
    if (c) { tabs.push(c); objects.push({ kind: 'skillStone', skill, ...at(c.x, c.y), label: '옛 기술 석판 읽기', reusable: true }); }
  }
  { // 남쪽 해안 서쪽 끝: 작살
    let best = null;
    for (let y = TH - 40; y < TH - 6; y++) for (let x = 40; x < 200; x++) {
      const k = I(x, y);
      if (t[k] !== T_FLOOR || gr[k] !== G.SAND || BI[k] < 0 || LV[k] || !seen[k] || occupied[k] || onPath[k]) continue;
      if (![[0, 1], [0, 2]].some(([dx, dy]) => T(x + dx, y + dy) === T_DEEP)) continue;
      if (!best || x < best.x) best = { x, y };
    }
    void best; // 작살 석판도 없앴다 (낚시 숙련으로 깨닫는다)
  }
  { // 거울 호수의 물의 정령: 호숫가 길 끝, 물가에
    let best = null, bd = 1e9;
    for (let y = L.y - L.ry - 3; y <= L.y + L.ry + 3; y++) for (let x = L.x - L.rx - 6; x <= L.x + L.rx + 6; x++) {
      if (!inb(x, y) || t[I(x, y)] !== T_FLOOR || occupied[I(x, y)] || !seen[I(x, y)]) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => T(x + dx, y + dy) === T_LIQUID || T(x + dx, y + dy) === T_DEEP)) continue;
      const d = Math.hypot(x - (L.x - L.rx - 1), y - (L.y + 3));
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (best) { objects.push({ kind: 'waterSpirit', ...at(best.x, best.y), label: '물의 정령과 이야기', reusable: true }); safe.push({ x: best.x, y: best.y, r: 8 }); }
  }
  const chests = [{ x: island.x, y: island.y, rich: true }, { x: islet.x + 2, y: islet.y - 1, rich: true }];
  for (let a = 0; a < 20000 && chests.length < 34; a++) { // 상자는 드물게 (예전 56)
    const x = rng.int(6, TW - 7), y = rng.int(6, TH - 7), k = I(x, y);
    if (BI[k] < 0 || t[k] !== T_FLOOR || !seen[k] || occupied[k] || onPath[k] || nearSafe(x, y, 3) || chests.some((c) => Math.hypot(c.x - x, c.y - y) < 20)) continue;
    let walls = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (T(x + dx, y + dy) !== T_FLOOR) walls++;
    if (chests.some((c) => Math.hypot(c.x - x, c.y - y) < 30)) continue;
    if (walls >= 3 || LV[k] >= 2 || rng.chance(0.08)) chests.push({ x, y, rich: LV[k] >= 2 || rng.chance(0.15), trap: rng.chance(0.15) });
  }
  // 바위산 금 간 바위 뒤 숨은 방
  const secrets = [];
  for (const [sx, sy] of [[246, 56], [292, 70], [318, 100], [204, 20]]) {
    let found = null;
    for (let r = 0; r < 14 && !found; r++) for (let a = 0; a < 20 && !found; a++) {
      const x = Math.round(sx + Math.cos(a * 0.31) * r), y = Math.round(sy + Math.sin(a * 0.31) * r);
      if (T(x, y) === T_WALL && T(x, y + 1) === T_FLOOR && T(x, y - 1) === T_WALL && T(x, y - 2) === T_WALL && T(x, y - 3) === T_WALL && !occupied[I(x, y)]) found = { x, y };
    }
    if (!found) continue;
    set(found.x, found.y, T_CRACK);
    for (let y = found.y - 3; y <= found.y - 1; y++) for (let x = found.x - 1; x <= found.x + 1; x++) set(x, y, T_FLOOR, gr[I(found.x, found.y)] === G.SNOW ? G.SNOW : G.ROCK);
    secrets.push({ x: found.x, y: found.y - 2 }); chests.push({ x: found.x, y: found.y - 2, rich: true });
  }
  // 지역 이름
  const regions = new Int8Array(TW * TH).fill(-1);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const k = I(x, y);
    if (Math.hypot((x - V.x) / 29, (y - V.y) / 15) < 1 || (x >= FARM.x0 - 4 && x <= FARM.x1 + 3 && y >= FARM.y0 - 14 && y <= FARM.y1 + 3)) regions[k] = R_VILLAGE;
    else if (BI[k] >= 0) regions[k] = gr[k] === G.SAND && BI[k] !== B.lake && t[k] === T_FLOOR && LV[k] === 0 && BI[k] !== B.wasteland ? R_COAST : BI[k];
    else regions[k] = R_COAST;
  }
  const regionInfo = OW_PLACES.map((name, r) => ({ name, x: 0, y: 0, place: true, types: r < BIOMES.length ? BIOMES[r].pool : ['slime', 'toad'], lv: (r < BIOMES.length && BIOMES[r].lv) || [1, 3], lvShow: r < BIOMES.length && !!BIOMES[r].lv })); // lv: 권장 레벨 (몬스터 강함)
  const camps = [];
  for (let a = 0; a < 40000 && camps.length < 170; a++) {
    const x = rng.int(6, TW - 7), y = rng.int(6, TH - 7), k = I(x, y), r = regions[k];
    if (t[k] !== T_FLOOR || !seen[k] || occupied[k] || r === R_VILLAGE || r === B.tower || nearSafe(x, y, 6) || Math.hypot(x - V.x, y - V.y) < 34) continue;
    if (camps.some((c) => Math.hypot(c.x - x, c.y - y) < 13)) continue;
    camps.push({ x, y, type: rng.pick(regionInfo[r].types), n: rng.int(2, 4), region: r });
  }
  const champions = [[B.forest, 'goblin', 80, 250], [B.swamp, 'bogWitch', 70, 300], [B.wasteland, 'orcRaider', 430, 160], [B.jungle, 'raptor', 430, 280], [B.ruins, 'bandit', 176, 124], [B.mountains, 'frostWolf', 284, 70], [B.volcano, 'magmaGolem', 420, 52], [B.snow, 'iceShaman', 150, 34]]
    .map(([region, type, x0, y0]) => { const c = biomeTiles(region, (x, y) => Math.hypot(x - x0, y - y0) < 16 && !nearSafe(x, y, 4))[0]; return c ? { x: c.x, y: c.y, type, region } : null; }).filter(Boolean);
  const pick = (n, cond) => { const out = []; for (let a = 0; a < 6000 && out.length < n; a++) { const x = rng.int(6, TW - 7), y = rng.int(6, TH - 7), k = I(x, y); if (t[k] === T_FLOOR && seen[k] && !occupied[k] && !nearSafe(x, y, 4) && cond(x, y, k) && !out.some((o) => Math.hypot(o.x - x, o.y - y) < 30)) out.push({ x, y, region: regions[k] }); } return out; };
  const lores = pick(12, () => true);
  const camp = pick(5, (x, y) => Math.hypot(x - V.x, y - V.y) > 80);
  const shrines = pick(5, (x, y, k) => BI[k] === B.mountains || BI[k] === B.forest || BI[k] === B.ruins || BI[k] === B.jungle);
  const goblins = pick(2, (x, y, k) => BI[k] === B.plains || BI[k] === B.meadow);
  const lair = { x: 70, y: 236 }; // 숲 깊은 곳 고블린 족장
  for (let y = lair.y - 5; y <= lair.y + 5; y++) for (let x = lair.x - 5; x <= lair.x + 5; x++) if (inb(x, y) && trees.has(I(x, y)) && Math.hypot(x - lair.x, y - lair.y) < 5) removeTree(x, y);
  clear(lair.x, lair.y, 4, G.DIRT);
  ensure(lair.x, lair.y);

  // ───── 11) 캐는 것(바위 · 광맥 · 덤불 · 꽃) · 반짝이는 흙: 지역마다 나는 것이 다르다 ─────
  const nodes = [], digs = [], seen2 = reach();
  const pickW = (list) => { const tot = list.reduce((a, [, x]) => a + x, 0); let r = rng.next() * tot; for (const [id, x] of list) { r -= x; if (r <= 0) return id; } return list[0][0]; };
  const open8 = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (!inb(xx, yy) || t[I(xx, yy)] !== T_FLOOR || occupied[I(xx, yy)]) return false; } return true; };
  const bkey = (k) => (regions[k] === R_COAST ? 'coast' : BIOMES[BI[k]]?.id);
  const taken = (x, y, d) => nodes.some((n) => Math.abs(n.x - x) + Math.abs(n.y - y) < d) || digs.some((n) => Math.abs(n.x - x) + Math.abs(n.y - y) < d) || chests.some((c) => Math.abs(c.x - x) + Math.abs(c.y - y) < 2);
  for (let a = 0; a < 90000 && nodes.length < 380; a++) {
    const x = rng.int(4, TW - 5), y = rng.int(4, TH - 5), k = I(x, y);
    if (!seen2[k] || onPath[k] || !open8(x, y) || nearSafe(x, y, 3)) continue;
    const table = BIOME_NODES[bkey(k)];
    if (!table || taken(x, y, 6)) continue;
    nodes.push({ id: nodes.length, type: pickW(table), x, y });
  }
  for (let a = 0; a < 50000 && digs.length < 120; a++) {
    const x = rng.int(4, TW - 5), y = rng.int(4, TH - 5), k = I(x, y), g = gr[k];
    if (!seen2[k] || onPath[k] || !open8(x, y) || nearSafe(x, y, 3) || g === G.STONE || g === G.COBBLE || g === G.BRIDGE || g === G.STAIRS || g === G.ICE || g === G.BLACKROCK) continue;
    if (!bkey(k) || bkey(k) === 'tower' && rng.chance(0.7) || taken(x, y, 9)) continue;
    digs.push({ id: digs.length, x, y });
  }

  // ───── 12) 이동 포탈: 지역마다 하나 (그 지역 가운데에 가까운 길가). 처음 만지면 깨어나고, 깨어난 포탈끼리 오갈 수 있다 ─────
  const waypoints = [];
  {
    const near = (list, x, y, d) => list.some((q) => Math.hypot(q.x - x, q.y - y) < d);
    const objTiles = objects.map((o) => ({ x: Math.floor(o.x / TILE), y: Math.floor(o.y / TILE) }));
    const roadNear = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (inb(x + dx, y + dy) && onPath[I(x + dx, y + dy)]) return true; return false; };
    const flat = (x, y) => { for (let dy = -3; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (!inb(xx, yy)) return false; const k = I(xx, yy); if (t[k] !== T_FLOOR || occupied[k] || !seen2[k] || onPath[k] && Math.abs(dx) === 1 && dy === 0) return false; } return true; };
    const free = (x, y) => !near(objTiles, x, y, 5) && !near(chests, x, y, 4) && !near(camps, x, y, 10) && !near(nodes, x, y, 3) && !near(digs, x, y, 3) && !near(lores, x, y, 4) && !near(camp, x, y, 4) && !near(shrines, x, y, 4) && !near(waypoints, x, y, 24);
    // 탑 지역: 탑 앞(남쪽)에 둔다 — 탑 뒤는 높은 탑 그림에 가려 안 보인다
    const behindTower = (x, y) => Math.abs(x - OW.TOWER.x) <= 6 && y <= OW.TOWER.y + 3 && y >= OW.TOWER.y - 17;
    const SPOTS = [['village', '바람결 마을', V.x + 12, V.y + 8, -1], ...BIOMES.map((b) => [b.id, b.name, b.id === 'tower' ? b.x + 8 : b.x, b.id === 'tower' ? b.y + 9 : b.y, B[b.id]])];
    for (const [id, name, cx, cy, bi] of SPOTS) {
      const cand = [];
      for (let y = cy - 34; y <= cy + 34; y++) for (let x = cx - 34; x <= cx + 34; x++) if (inb(x, y) && (bi < 0 || BI[I(x, y)] === bi) && t[I(x, y)] === T_FLOOR && !occupied[I(x, y)] && seen2[I(x, y)] && !behindTower(x, y)) cand.push({ x, y, d: Math.hypot(x - cx, y - cy) + (roadNear(x, y) ? 0 : 14) });
      cand.sort((a, c) => a.d - c.d);
      const best = cand.find((c) => flat(c.x, c.y) && free(c.x, c.y));
      if (!best) continue;
      for (const dx of [-1, 1]) set(best.x + dx, best.y, T_BUILD); // 두 돌기둥은 막히고, 가운데 문으로 드나든다
      for (let dy = -2; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) occupied[I(best.x + dx, best.y + dy)] = 1;
      waypoints.push({ id: `wp_${id}`, name, start: id === 'village', ...at(best.x, best.y), tx: best.x, ty: best.y });
    }
    // 포탈 둘레(16칸)에는 몬스터 무리 · 우두머리를 두지 않는다 — 포탈에서 나오자마자 싸우지 않게
    const nearWp = (x, y) => waypoints.some((w) => Math.hypot(x - w.tx, y - w.ty) < 16);
    for (let i = camps.length - 1; i >= 0; i--) if (nearWp(camps[i].x, camps[i].y)) camps.splice(i, 1);
    for (let i = champions.length - 1; i >= 0; i--) if (nearWp(champions[i].x, champions[i].y)) champions.splice(i, 1);
  }

  // ───── 13) 종족 성지 마을: 커다란 상징물 · 주민 · 우두머리 · 수련장 (맨 끝에 놓는다) ─────
  const villages = buildSanctumVillages({ t, gr, G, occupied, props, chests, camps, nodes, digs, objects, waypoints, inb, I, removeTree, trees, prop, at, onPath, sanctums });

  return {
    tw: TW, th: TH, tiles: t, ground: gr, outdoor: true, designed: 'overworld', level: LV, biome: BI, waypoints, villages,
    start: { x: V.x, y: V.y + 4 }, lair, stairs: null, camps, champions, chests, lores, secrets, deco, regions, regionInfo,
    camp, merchant: [{ x: V.x - 5, y: V.y - 2 }], shrines, goblins, props, objects, onPath, sanctums, entrances, farm: FARM, nodes, digs, docks,
  };
}

// 바깥 세계용 지역 정보 (층 목록 ZONES에는 넣지 않는다: 관문 · 의뢰 목록에 섞이지 않게)
export const WORLD_ZONE = {
  id: 'world', name: '바람결의 섬', floor: 1, rec: 1, outdoor: true, dark: 0,
  pal: ['#5d9e3b', '#67a842', '#457f2e'], wall: ['#5e4a38', '#8a7258', '#9c8264'], liquid: 'water', liquidPal: ['#2c74a4', '#4aa6c6'],
  deco: ['moss', 'fern', 'pebble'], portal: '#7ed957', pool: [...new Set(BIOMES.flatMap((b) => b.pool))],
  regions: OW_PLACES, elite: 'goblinChief',
};
export const BIOME_LIST = BIOMES;

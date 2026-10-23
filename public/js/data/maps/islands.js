// 바다 건너 섬들: 섬마다 따로 된 바깥 지도 (항구 도시 + 들판 · 사냥터). 본섬과 같은 그림 · 같은 생활(캐기 · 나무 · 낚시)을 쓴다.
// 섬: 황금 돛 섬(상인 공화국) · 서리왕관 섬(하얀 왕관 공국) · 붉은 모래 섬(모래바람 술탄국) · 해골 군도(해적 연합) · 안개 너머의 섬(교단의 땅)
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_BUILD, T_DEEP } from '../../sim/mapgen.js';
import { createRng } from '../../sim/rng.js';
import { G, BIOME_LIST } from './overworld.js';
import { BIOME_NODES } from '../goods.js';

const BI = (id) => BIOME_LIST.findIndex((b) => b.id === id);

// npcs: [id, art, 광장 기준 dx, dy, 이름표]
export const ISLAND_DEFS = {
  gold: {
    name: '황금 돛 섬', nation: '황금 돛 연맹', mood: '운하 · 시장 · 거대 항구', tw: 210, th: 150, biome: 'meadow', ground: G.GRASS, road: G.COBBLE, wild: G.GRASS,
    trees: 0.018, kinds: ['oak', 'birch', 'palm'], lv: [10, 30], elite: 'goblinChief', roof: ['#c8a040', '#b8483a', '#3a6a9a', '#8a4a8a'], canals: true,
    regions: ['황금 돛 항구 도시', '운하 들판', '포도밭 언덕', '도적의 고개'], pools: [null, ['slime', 'spikeSlime', 'boarRunner', 'goblin'], ['goblin', 'forestArcher', 'harpy', 'bandit'], ['bandit', 'darkArcher', 'orcRaider', 'harpy']],
    npcs: [['gold_master', 'portMaster', -6, 6, '항구장 마리넬과 이야기 · 배 타기'], ['gold_trade', 'trader', 6, -6, '교역상 도로와 이야기 · 교역품'], ['gold_board', null, 9, -6, '시세판 보기'],
      ['gold_guild', 'guildMaster', -8, -6, '상인 길드장 벨루아와 이야기 · 길드 · 납품 계약'], ['gold_auction', 'auctioneer', 0, -9, '경매사 오토와 이야기 · 경매장'], ['gold_yard', 'shipwright', 10, 4, '조선공 드레크와 이야기 · 내 배'],
      ['gold_shop', 'trader', -10, 2, '점포 거리 관리인과 이야기 · 내 가게']],
    lore: ['황금 돛 연맹 회의록: 연맹은 아우렐리온에도, 녹타리스에도 물건을 판다. 은화에는 깃발이 그려져 있지 않으니까.'],
  },
  frost: {
    name: '서리왕관 섬', nation: '하얀 왕관 공국', mood: '눈 덮인 요새 도시 · 빙하', tw: 190, th: 150, biome: 'snow', ground: G.SNOW, road: G.STONE, wild: G.SNOW,
    trees: 0.05, kinds: ['snowpine'], lv: [35, 50], elite: 'iceGolem', roof: ['#5a7a9a', '#3a4a6a', '#e8eef8'], fortress: true,
    regions: ['하얀 왕관 요새 도시', '얼음 평원', '빙하 협곡', '서리 늑대 숲'], pools: [null, ['iceWolf', 'frostWolf', 'frostSlug', 'snowLurker'], ['iceGolem', 'glassSpider', 'iceShaman', 'iceArcher'], ['frostWolf', 'yeti', 'iceWolf', 'iceArcher']],
    npcs: [['frost_master', 'shipCaptainE', -6, 6, '항구 관리관 이스벤과 이야기 · 배 타기'], ['frost_trade', 'trader', 6, -6, '교역상 니엘과 이야기 · 교역품'], ['frost_board', null, 9, -6, '시세판 보기'],
      ['frost_merc', 'rebel', -8, -6, '용병대장 하르크와 이야기 · 용병 의뢰']],
    lore: ['공국 비밀 장부: 녹타리스로 보낸 장검 200자루, 석궁 80정. 왕관 공께서 말씀하시길 「에드릭이 약해질수록 우리 국경은 넓어진다.」'],
  },
  sand: {
    name: '붉은 모래 섬', nation: '모래바람 술탄국', mood: '사막 · 오아시스 도시 · 피라미드 유적', tw: 200, th: 150, biome: 'wasteland', ground: G.REDSAND, road: G.CRACKED, wild: G.REDSAND,
    trees: 0.012, kinds: ['cactus', 'palm'], lv: [25, 45], elite: 'sandWorm', roof: ['#e8c890', '#c8784a', '#f4e8c8'], oasis: true, pyramid: true,
    regions: ['오아시스 도시 카샤르', '붉은 사구', '피라미드 유적', '전갈 골짜기'], pools: [null, ['desertScorpion', 'hyena', 'sandScorpion'], ['ruinSentinel', 'watcherEye', 'sandWorm', 'cultist'], ['sandScorpion', 'desertScorpion', 'orcRaider', 'hyena']],
    npcs: [['sand_master', 'portMaster', -6, 6, '항구 감독관 자이드와 이야기 · 배 타기'], ['sand_trade', 'trader', 6, -6, '향신료 상인 라나와 이야기 · 교역품'], ['sand_board', null, 9, -6, '시세판 보기'],
      ['sand_arena', 'pitBoss', -8, -6, '술탄의 투기장 진행자 말리크와 이야기 · 투기장 대회'], ['sand_caravan', 'sailor', 10, 4, '대상(카라반) 대장 오마르와 이야기 · 호위']],
    lore: ['피라미드 벽화: 여덟 개의 불꽃이 하나의 탑을 밝힌다. 그 아래 엎드린 사람들. 그리고 불꽃을 하나씩 끄는, 얼굴 없는 무리.'],
  },
  skull: {
    name: '해골 군도', nation: '해적 연합 (나라 없음)', mood: '작은 섬 여럿 · 해적 소굴', tw: 200, th: 150, biome: 'jungle', ground: G.JUNGLE, road: G.DIRT, wild: G.JUNGLE,
    trees: 0.12, kinds: ['palm', 'jungle'], lv: [20, 45], elite: 'orcWarlord', roof: ['#5a3a22', '#7a5232', '#3a2a1a'], archipelago: true, lawless: true,
    regions: ['해적 소굴 블랙코브', '야자 해변', '난파선 무덤', '해골 바위'], pools: [null, ['raptor', 'jungleWasp', 'venomSpitter', 'toad'], ['bandit', 'darkArcher', 'seaSerpent', 'skeleton'], ['lizardWarrior', 'bandit', 'boneArcher', 'orcRaider']],
    npcs: [['skull_master', 'shipCaptainE', -6, 6, '부두 두목 갈고리 잭과 이야기 · 배 타기'], ['skull_trade', 'fence', 6, -6, '장물아비 루시와 이야기 · 교역품'], ['skull_board', null, 9, -6, '시세판 보기'],
      ['skull_captain', 'pitBoss', -8, -6, '해적왕 레드 메리와 이야기 · 해적 의뢰'], ['skull_bounty', 'rumorer', 10, 4, '현상금 게시판 · 사냥꾼 브래그']],
    lore: ['해적 규약 제1조: 여기선 누구의 현상금도 묻지 않는다. 제2조: 술값은 먼저 낸다.'],
  },
  mist: {
    name: '안개 너머의 섬', nation: '교단의 땅', mood: '늘 안개 · 고대 유적', tw: 190, th: 150, biome: 'graveyard', ground: G.DEADGRASS, road: G.STONE, wild: G.DEADGRASS,
    trees: 0.04, kinds: ['dead'], lv: [50, 60], elite: 'wraithKnight', roof: ['#4a4a5a', '#3a3a4a'], ruins: true, hidden: true,
    regions: ['버려진 선착장', '안개 숲', '고대 유적', '꺼진 등불의 제단'], pools: [null, ['shadeWraith', 'shadowPanther', 'wraith', 'ghoul'], ['cultist', 'necroAcolyte', 'watcherEye', 'wraithKnight'], ['cultist', 'wraithKnight', 'boneGuard', 'shadeWraith']],
    npcs: [['mist_master', 'sailor', -6, 6, '겁먹은 뱃사공과 이야기 · 돌아가는 배'], ['mist_cult', 'broker', 8, -6, '안개 속의 신도와 이야기']],
    lore: ['꺼진 등불의 제단 비문: 빛이 모두 꺼지는 날 섬은 처음으로 돌아간다. 우리는 끄는 자, 다시 켜는 자. 탑 꼭대기의 불꽃은 마지막에 끈다.', '교단 신도의 일기: 왕이 조각을 한곳에 모으고 있다. 스승님은 웃으셨다. 「모아 주니 고맙지 않은가.」'],
  },
};

function noise2(seed) {
  const h = (x, y) => { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const f = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = f(x - xi), w = f(y - yi); return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - w) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * w; };
  return (x, y, oct = 3) => { let s = 0, a = 0.5, fr = 1, n = 0; for (let i = 0; i < oct; i++) { s += v(x * fr, y * fr) * a; n += a; a *= 0.5; fr *= 2; } return s / n; };
}

const CACHE = {};
export function islandMap(id) {
  CACHE[id] ||= buildIsland(id);
  const m = CACHE[id];
  return { ...m, tiles: new Uint8Array(m.tiles), ground: new Uint8Array(m.ground), props: m.props.slice(), objects: m.objects.map((o) => ({ ...o })) };
}
export const islandZone = (id) => {
  const D = ISLAND_DEFS[id];
  return {
    id, island: true, name: D.name, floor: 2, rec: D.lv[0], outdoor: true, dark: 0,
    pal: ['#5d9e3b', '#67a842', '#457f2e'], wall: ['#5e4a38', '#8a7258', '#9c8264'], liquid: 'water', liquidPal: ['#2c74a4', '#4aa6c6'],
    deco: ['pebble'], portal: '#7ed957', pool: [...new Set(D.pools.flat().filter(Boolean))], regions: D.regions, elite: D.elite,
  };
};

export function buildIsland(id) {
  const D = ISLAND_DEFS[id], TW = D.tw, TH = D.th, rng = createRng(0x51a7 + id.length * 977 + id.charCodeAt(0) * 31);
  const N1 = noise2(id.charCodeAt(0) * 7 + 3), N2 = noise2(id.charCodeAt(1) * 11 + 5);
  const t = new Uint8Array(TW * TH), gr = new Uint8Array(TW * TH), LV = new Int8Array(TW * TH), BIO = new Int8Array(TW * TH).fill(-1);
  const I = (x, y) => y * TW + x, inb = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH;
  const T = (x, y) => (inb(x, y) ? t[I(x, y)] : T_DEEP);
  const set = (x, y, v, g) => { if (!inb(x, y)) return; t[I(x, y)] = v; if (g != null) gr[I(x, y)] = g; };
  const at = (x, y) => ({ x: x * TILE + 8, y: y * TILE + 8 });
  const bi = BI(D.biome) >= 0 ? BI(D.biome) : 0;
  // 1) 섬 모양 (해골 군도는 작은 섬 여럿이 얕은 물로 이어진다)
  const blobs = D.archipelago ? [[0.5, 0.42, 0.3, 0.3], [0.22, 0.3, 0.16, 0.2], [0.8, 0.3, 0.15, 0.18], [0.25, 0.75, 0.15, 0.16], [0.78, 0.72, 0.17, 0.18]] : [[0.5, 0.48, 0.44, 0.42]];
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    let d = 9;
    for (const [bx, by, rx, ry] of blobs) d = Math.min(d, Math.hypot((x / TW - bx) / rx, (y / TH - by) / ry));
    d += (N1(x * 0.04, y * 0.04) - 0.5) * 0.22;
    if (d > 1.06) set(x, y, T_DEEP, G.SAND);
    else if (d > 1.0) set(x, y, T_LIQUID, G.SAND);
    else if (d > 0.93) { set(x, y, T_FLOOR, G.SAND); BIO[I(x, y)] = bi; }
    else { set(x, y, T_FLOOR, D.wild); BIO[I(x, y)] = bi; }
  }
  if (D.archipelago) { // 섬 사이 얕은 여울 (걸어서 건넌다)
    for (const [ax, ay, bx, by] of [[0.5, 0.42, 0.22, 0.3], [0.5, 0.42, 0.8, 0.3], [0.5, 0.42, 0.25, 0.75], [0.5, 0.42, 0.78, 0.72]]) {
      const n = 200; for (let k = 0; k <= n; k++) { const px = (ax + (bx - ax) * k / n) * TW, py = (ay + (by - ay) * k / n) * TH; for (let y = Math.floor(py - 2); y <= py + 2; y++) for (let x = Math.floor(px - 2); x <= px + 2; x++) if (inb(x, y) && t[I(x, y)] !== T_FLOOR) { set(x, y, T_LIQUID, G.SAND); BIO[I(x, y)] = bi; } }
    }
  }
  const land = (x, y) => inb(x, y) && BIO[I(x, y)] >= 0 && t[I(x, y)] === T_FLOOR;
  // 2) 항구 (섬 남쪽): 가운데에서 남쪽으로 바다를 찾는다
  const cx = Math.round(TW * (D.archipelago ? 0.5 : 0.5)), cy0 = Math.round(TH * (D.archipelago ? 0.42 : 0.48));
  let shore = { x: cx, y: cy0 };
  for (let y = cy0; y < TH; y++) { if (T(cx, y) === T_DEEP && BIO[I(cx, y)] < 0) break; if (t[I(cx, y)] === T_FLOOR) shore = { x: cx, y }; }
  const town = { x: cx, y: shore.y - 16 };
  // 3) 구역: 0 = 도시, 1~3 = 들판 · 사냥터 (도시에서 멀어질수록 높은 레벨)
  const seeds = [town, { x: Math.round(TW * 0.22), y: Math.round(TH * 0.32) }, { x: Math.round(TW * 0.78), y: Math.round(TH * 0.3) }, { x: Math.round(TW * 0.5), y: Math.round(TH * 0.14) }];
  const regions = new Int8Array(TW * TH).fill(-1);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (BIO[I(x, y)] < 0) continue;
    if (Math.hypot((x - town.x) / 26, (y - town.y) / 18) < 1) { regions[I(x, y)] = 0; continue; }
    let b = 1, bd = 1e9; for (let r = 1; r < seeds.length; r++) { const d = Math.hypot(x - seeds[r].x, y - seeds[r].y) + (N2(x * 0.03, y * 0.03) - 0.5) * 30; if (d < bd) { bd = d; b = r; } }
    regions[I(x, y)] = b;
  }
  // 4) 도시: 돌 광장 · 집 · 가로등 · 운하(황금 돛) · 오아시스(붉은 모래)
  const props = [], objects = [], occupied = new Uint8Array(TW * TH), onPath = new Uint8Array(TW * TH);
  const prop = (kind, x, y, w, h, extra = {}) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { set(xx, yy, T_BUILD); occupied[I(xx, yy)] = 1; } props.push({ kind, x, y, w, h, ...extra }); };
  for (let y = town.y - 18; y <= town.y + 18; y++) for (let x = town.x - 26; x <= town.x + 26; x++) {
    if (!inb(x, y) || BIO[I(x, y)] < 0) continue;
    const d = Math.hypot((x - town.x) / 26, (y - town.y) / 18);
    if (d < 1) { set(x, y, T_FLOOR, Math.hypot((x - town.x) / 11, (y - town.y) / 8) < 1 ? G.STONE : d < 0.75 ? D.road : gr[I(x, y)]); LV[I(x, y)] = 0; }
  }
  if (D.canals) for (const [ax, ay, bx, by] of [[town.x - 26, town.y - 3, town.x + 26, town.y - 3], [town.x - 14, town.y - 18, town.x - 14, town.y + 18]]) {
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n); for (const [dx, dy] of ay === by ? [[0, 0], [0, 1]] : [[0, 0], [1, 0]]) if (inb(x + dx, y + dy) && BIO[I(x + dx, y + dy)] >= 0) set(x + dx, y + dy, T_LIQUID, G.SAND); }
  }
  if (D.oasis) for (let y = town.y - 6; y <= town.y + 6; y++) for (let x = town.x + 14; x <= town.x + 24; x++) { const d = Math.hypot((x - town.x - 19) / 5, (y - town.y) / 4); if (d < 1) set(x, y, T_LIQUID, G.SAND); else if (d < 1.4 && land(x, y)) gr[I(x, y)] = G.GRASS; }
  // 집: 광장 둘레 (지붕 색이 섬마다 다르다), 요새 섬은 성벽 대신 큰 성
  const HOUSE = [[-22, -15], [-12, -16], [3, -16], [13, -15], [-22, 3], [14, 3], [-6, 10], [5, 10]];
  HOUSE.forEach(([ox, oy], i) => {
    const x = town.x + ox, y = town.y + oy;
    for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 6; xx++) if (!land(xx, yy) || occupied[I(xx, yy)]) return;
    prop('house', x, y, 6, 3, { roof: D.roof[i % D.roof.length] });
  });
  if (D.fortress) { const x = town.x - 5, y = town.y - 26; let ok = true; for (let yy = y; yy < y + 5; yy++) for (let xx = x; xx < x + 11; xx++) if (!land(xx, yy)) ok = false; if (ok) { prop('castle', x, y, 11, 5, { race: 'knight' }); } }
  for (const [lx, ly] of [[-12, -4], [12, -4], [-12, 5], [12, 5], [0, -8], [0, 8]]) { const x = town.x + lx, y = town.y + ly; if (land(x, y) && !occupied[I(x, y)]) prop('lampPost', x, y, 1, 1); }
  objects.push({ kind: 'rest', ...at(town.x, town.y + 1), label: `${D.name} · 쉬고 저장하기`, reusable: true });
  // 5) 항구: 부두와 정박한 배
  for (let i = -1; i < 9; i++) for (let w = -1; w <= 1; w++) set(cx + w, shore.y + 1 + i, T_FLOOR, G.BRIDGE);
  for (let y = town.y; y <= shore.y; y++) for (let x = cx - 1; x <= cx + 1; x++) if (inb(x, y) && t[I(x, y)] !== T_BUILD) { set(x, y, T_FLOOR, D.road); onPath[I(x, y)] = 1; }
  const end = { x: cx, y: shore.y + 9 };
  prop('ship', end.x + 2, end.y - 3, 8, 3, { flag: D.roof[0] });
  const arrive = at(cx, shore.y + 6);
  // 6) 사람들
  for (const [nid, art, dx, dy, label] of D.npcs) {
    let x = town.x + dx, y = town.y + dy;
    for (let r = 0; r < 5 && (!land(x, y) || occupied[I(x, y)]); r++) x += 1;
    if (!art) objects.push({ kind: 'priceBoard', id: nid, ...at(x, y), label, reusable: true });
    else objects.push({ kind: 'npc', id: nid, art, ...at(x, y), label, reusable: true });
    occupied[I(x, y)] = 1;
  }
  // 7) 길: 도시에서 각 사냥터 가운데로 (물은 다리)
  const carve = (x, y) => { if (!inb(x, y) || occupied[I(x, y)] || BIO[I(x, y)] < 0 && t[I(x, y)] === T_DEEP) return; if (t[I(x, y)] === T_LIQUID) set(x, y, T_FLOOR, G.BRIDGE); else if (t[I(x, y)] === T_FLOOR && gr[I(x, y)] !== G.BRIDGE && gr[I(x, y)] !== G.STONE) gr[I(x, y)] = D.road; onPath[I(x, y)] = 1; };
  for (let r = 1; r < seeds.length; r++) {
    const a = town, b = seeds[r], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    for (let k = 0; k <= n; k++) { const u = k / n, px = a.x + (b.x - a.x) * u + (N2(k * 0.05, r) - 0.5) * 6 * Math.sin(u * Math.PI), py = a.y + (b.y - a.y) * u; for (let y = Math.floor(py - 1); y <= py + 1; y++) for (let x = Math.floor(px - 1); x <= px + 1; x++) if (Math.hypot(x - px, y - py) <= 1.3) carve(x, y); }
  }
  // 8) 섬의 볼거리: 피라미드 유적 · 유적 문 · 난파선 · 제단
  const lores = [];
  if (D.pyramid) { const p = seeds[2]; prop('templeRuin', p.x - 2, p.y - 3, 5, 3); lores.push({ x: p.x, y: p.y + 2, text: D.lore[0] }); }
  if (D.ruins) { const p = seeds[2]; prop('labyrinthGate', p.x - 2, p.y - 3, 5, 3); const q = seeds[3]; prop('cryptStairs', q.x - 1, q.y - 2, 3, 2); D.lore.forEach((txt, i) => lores.push({ x: (i ? q : p).x + 3, y: (i ? q : p).y + 2, text: txt })); }
  if (D.archipelago) { const p = seeds[2]; prop('ship', p.x - 4, p.y + 4, 8, 3, { flag: '#1a1a1a' }); }
  if (!D.pyramid && !D.ruins) lores.push({ x: seeds[1].x + 3, y: seeds[1].y, text: D.lore[0] });
  // 9) 나무 · 장식
  const trees = new Set();
  const nearTown = (x, y) => Math.hypot((x - town.x) / 28, (y - town.y) / 20) < 1;
  for (let y = 3; y < TH - 3; y++) for (let x = 3; x < TW - 3; x++) {
    const k = I(x, y);
    if (!land(x, y) || occupied[k] || onPath[k] || nearTown(x, y) || gr[k] === G.SAND) continue;
    if (rng.chance(D.trees * (0.5 + N1(x * 0.06, y * 0.06) * 1.2)) && !trees.has(I(x - 1, y)) && !trees.has(I(x, y - 1)) && !trees.has(I(x + 1, y - 1)) && !trees.has(I(x - 1, y - 1))) { trees.add(k); prop('tree', x, y, 1, 1, { tree: rng.pick(D.kinds), v: rng.int(0, 3) }); }
  }
  const deco = [];
  const DEC = { snow: ['crystalB', 'icicle'], wasteland: ['bone', 'pebble', 'skullDeco'], jungle: ['fern', 'reed'], graveyard: ['tomb', 'candle', 'bone'], meadow: ['pebble'] }[D.biome] || ['pebble'];
  for (let i = 0; i < TW * TH * 0.01; i++) { const x = rng.int(3, TW - 4), y = rng.int(3, TH - 4); if (land(x, y) && !occupied[I(x, y)] && !nearTown(x, y)) deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: rng.pick(DEC), v: rng.int(0, 3) }); }
  // 10) 걸어서 닿는 곳 (막힌 사냥터는 길을 더 낸다)
  const reach = () => { const s = new Uint8Array(TW * TH), q = [I(town.x, town.y + 2)]; s[q[0]] = 1; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % TW, y = (i / TW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = I(nx, ny); if (!s[j] && (t[j] === T_FLOOR || t[j] === T_LIQUID)) { s[j] = 1; q.push(j); } } } return s; };
  const seen = reach();
  // 11) 몬스터 무리 · 상자 · 캐는 것 · 반짝이는 흙
  const camps = [], chests = [], nodes = [], digs = [];
  for (let a = 0; a < 20000 && camps.length < Math.round(TW * TH / 450); a++) {
    const x = rng.int(6, TW - 7), y = rng.int(6, TH - 7), k = I(x, y), r = regions[k];
    if (r <= 0 || !seen[k] || occupied[k] || t[k] !== T_FLOOR || nearTown(x, y) || camps.some((c) => Math.hypot(c.x - x, c.y - y) < 11)) continue;
    camps.push({ x, y, type: rng.pick(D.pools[r]), n: rng.int(2, 4), region: r });
  }
  for (let a = 0; a < 20000 && chests.length < 14; a++) {
    const x = rng.int(6, TW - 7), y = rng.int(6, TH - 7), k = I(x, y);
    if (regions[k] <= 0 || !seen[k] || occupied[k] || onPath[k] || t[k] !== T_FLOOR || chests.some((c) => Math.hypot(c.x - x, c.y - y) < 22)) continue;
    chests.push({ x, y, rich: rng.chance(0.25), trap: rng.chance(0.12) });
  }
  const table = BIOME_NODES[D.biome] || BIOME_NODES.plains;
  const pickW = (list) => { const tot = list.reduce((s, [, w]) => s + w, 0); let r = rng.next() * tot; for (const [nid, w] of list) { r -= w; if (r <= 0) return nid; } return list[0][0]; };
  for (let a = 0; a < 30000 && nodes.length < Math.round(TW * TH / 160); a++) {
    const x = rng.int(4, TW - 5), y = rng.int(4, TH - 5), k = I(x, y);
    if (!seen[k] || occupied[k] || onPath[k] || t[k] !== T_FLOOR || nearTown(x, y) || nodes.some((n) => Math.abs(n.x - x) + Math.abs(n.y - y) < 6)) continue;
    nodes.push({ id: `${id}${nodes.length}`, type: pickW(table), x, y });
  }
  for (let a = 0; a < 20000 && digs.length < Math.round(TW * TH / 600); a++) {
    const x = rng.int(4, TW - 5), y = rng.int(4, TH - 5), k = I(x, y);
    if (!seen[k] || occupied[k] || onPath[k] || t[k] !== T_FLOOR || nearTown(x, y) || gr[k] === G.STONE) continue;
    digs.push({ id: `${id}${digs.length}`, x, y });
  }
  for (const n of nodes) occupied[I(n.x, n.y)] = 1;
  const regionInfo = D.regions.map((name, r) => {
    const span = D.lv[1] - D.lv[0], lo = r ? Math.round(D.lv[0] + span * (r - 1) / 3) : D.lv[0], hi = r ? Math.round(D.lv[0] + span * r / 3) : D.lv[0];
    return { name, x: seeds[r].x, y: seeds[r].y, place: true, types: D.pools[r] || ['slime'], lv: r ? [lo, hi] : null, lvShow: !!r };
  });
  // 우두머리: 가장 먼 사냥터
  const lair = { x: seeds[3].x, y: seeds[3].y };
  return {
    tw: TW, th: TH, tiles: t, ground: gr, outdoor: true, designed: 'island', island: id, level: LV, biome: BIO, waypoints: [], villages: {},
    start: { x: town.x, y: town.y + 3 }, lair, stairs: null, camps, champions: [{ x: seeds[2].x + 4, y: seeds[2].y + 4, type: D.pools[2][0], region: 2 }], chests, lores, secrets: [], deco, regions, regionInfo,
    camp: [], merchant: [], shrines: [], goblins: [], props, objects, onPath, sanctums: {}, entrances: {}, farm: null, nodes, digs, docks: [], arrive, town,
  };
}

// 녹트 하벤: 반란 세력 녹타리스의 지하 도시. 옛 드워프 광산과 왕국 수로를 이어 만들었다.
// 가운데 광장 위로 옛 수로가 흐르고(다리 둘), 둘레에 중개인의 방 · 암시장 · 위조소 · 은신처 · 지하 투기장 · 버섯 밭.
// 바깥으로 이어진 숨은 길 셋(무너진 우물 · 왕도 하수구 · 황야의 옛 광산), 동쪽은 몬스터가 사는 깊은 갱도(Lv 15~40).
//
//   [우물 아래]                                                    [하수구]
//        │      중개인의 방 ═다리═ ~~~~~~ 옛 수로 ~~~~~~ ═다리═ 암시장 ─┘
//   버섯 밭 ── 녹트 하벤 광장 ──────────────────── 갱도 입구 ── 무너진 갱 ── 교단의 흔적
//        │      위조소    은신처    지하 투기장                    버려진 채굴장 ─┘
//   [옛 광산 갱도]
import { TILE, T_FLOOR, T_WALL, T_LIQUID } from '../../sim/mapgen.js';
import { createRng } from '../../sim/rng.js';

const TW = 140, TH = 100;

export const NOKT_ZONE = {
  id: 'nokt', name: '녹트 하벤', floor: 2, rec: 15, pal: ['#4a4038', '#52463c', '#443a32'], wall: ['#16110e', '#3a2e26', '#5a4a3c'],
  liquid: 'water', liquidPal: ['#163a46', '#24586a'], dark: 0.55, deco: ['pebble', 'moss', 'bone'], portal: '#c8a0ff',
  pool: ['goblin', 'caveLurker', 'bandit'], regions: [], elite: 'wraithKnight',
};

// 방: kind city(네모난 돌방) · cave(울퉁불퉁한 굴). lv가 있으면 몬스터가 사는 갱도
const ROOMS = [
  { id: 'plaza', name: '녹트 하벤 광장', kind: 'city', x: 50, y: 53, rx: 17, ry: 9 },
  { id: 'broker', name: '중개인의 방', kind: 'city', x: 30, y: 31, rx: 6, ry: 4 },
  { id: 'black', name: '암시장', kind: 'city', x: 68, y: 30, rx: 10, ry: 5 },
  { id: 'forge', name: '위조소', kind: 'city', x: 26, y: 70, rx: 6, ry: 4 },
  { id: 'hide', name: '은신처', kind: 'city', x: 48, y: 74, rx: 8, ry: 4 },
  { id: 'pit', name: '지하 투기장', kind: 'cave', x: 74, y: 72, rx: 9, ry: 7 },
  { id: 'farm', name: '버섯 밭', kind: 'cave', x: 15, y: 52, rx: 7, ry: 7 },
  { id: 'well', name: '무너진 우물 아래', kind: 'cave', x: 10, y: 18, rx: 5, ry: 4, exit: 'well' },
  { id: 'sewer', name: '왕도 하수구', kind: 'cave', x: 94, y: 16, rx: 6, ry: 4, exit: 'sewer' },
  { id: 'mine', name: '옛 광산 갱도', kind: 'cave', x: 10, y: 88, rx: 6, ry: 5, exit: 'mine' },
  { id: 'shaft', name: '깊은 갱도 입구', kind: 'cave', x: 96, y: 53, rx: 6, ry: 5 },
  { id: 'cave1', name: '무너진 갱', kind: 'cave', x: 112, y: 32, rx: 10, ry: 8, lv: [15, 22] },
  { id: 'cave2', name: '버려진 채굴장', kind: 'cave', x: 116, y: 74, rx: 12, ry: 9, lv: [22, 30] },
  { id: 'cult', name: '교단의 흔적', kind: 'cave', x: 130, y: 52, rx: 7, ry: 7, lv: [32, 40] },
];
export const NOKT_PLACES = ROOMS.map((r) => r.name);
const PATHS = [
  { p: [[14, 22], [20, 26], [24, 29]], r: 1.4 },            // 우물 - 중개인
  { p: [[30, 35], [30, 41], [33, 46]], r: 1.6 },            // 중개인 - 다리 - 광장
  { p: [[66, 35], [64, 41], [62, 45]], r: 1.6 },            // 암시장 - 다리 - 광장
  { p: [[78, 28], [86, 22], [90, 18]], r: 1.4 },            // 암시장 - 하수구
  { p: [[22, 53], [30, 53], [34, 53]], r: 1.8 },            // 버섯 밭 - 광장
  { p: [[36, 61], [31, 63], [28, 66]], r: 1.5 },            // 광장 - 위조소
  { p: [[48, 62], [48, 70]], r: 1.6 },                      // 광장 - 은신처
  { p: [[62, 61], [68, 66]], r: 1.6 },                      // 광장 - 투기장
  { p: [[14, 59], [12, 70], [11, 82]], r: 1.4 },            // 버섯 밭 - 옛 광산
  { p: [[67, 53], [80, 53], [90, 53]], r: 1.6 },            // 광장 - 갱도 입구
  { p: [[100, 49], [104, 42], [106, 38]], r: 1.6 },         // 갱도 입구 - 무너진 갱
  { p: [[100, 58], [106, 64], [109, 68]], r: 1.6 },         // 갱도 입구 - 버려진 채굴장
  { p: [[120, 38], [124, 44], [126, 47]], r: 1.4 },         // 무너진 갱 - 교단의 흔적
  { p: [[124, 66], [127, 60], [128, 57]], r: 1.4 },         // 채굴장 - 교단의 흔적
];
// 몬스터 무리 (갱도에만): [x, y, 종류, 마릿수]
const CAMPS = [
  [108, 28, 'goblin', 3], [116, 36, 'caveLurker', 2], [104, 34, 'bat', 3],
  [110, 72, 'bandit', 3], [122, 78, 'goblinShaman', 2], [118, 68, 'rockGolem', 1], [112, 80, 'orcRaider', 2],
  [130, 48, 'cultist', 3], [132, 56, 'necroAcolyte', 2], [127, 52, 'ghoul', 2],
];

export function buildNoktHaven() {
  const rng = createRng(0x0b0c7a);
  const t = new Uint8Array(TW * TH).fill(T_WALL);
  const idx = (x, y) => y * TW + x, inb = (x, y) => x > 0 && y > 0 && x < TW - 1 && y < TH - 1;
  const set = (x, y, v) => { if (inb(x, y)) t[idx(x, y)] = v; };
  // 1) 방
  for (const R of ROOMS) for (let y = R.y - R.ry - 2; y <= R.y + R.ry + 2; y++) for (let x = R.x - R.rx - 2; x <= R.x + R.rx + 2; x++) {
    if (R.kind === 'city') { if (Math.abs(x - R.x) <= R.rx && Math.abs(y - R.y) <= R.ry) set(x, y, T_FLOOR); }
    else if (Math.hypot((x - R.x) / R.rx, (y - R.y) / R.ry) + (rng.next() - 0.5) * 0.22 < 1) set(x, y, T_FLOOR);
  }
  // 2) 통로
  for (const P of PATHS) for (let i = 0; i < P.p.length - 1; i++) {
    const [ax, ay] = P.p[i], [bx, by] = P.p[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let k = 0; k <= n; k++) {
      const px = ax + (bx - ax) * k / n, py = ay + (by - ay) * k / n;
      for (let y = Math.floor(py - P.r - 1); y <= py + P.r + 1; y++) for (let x = Math.floor(px - P.r - 1); x <= px + P.r + 1; x++) if (Math.hypot(x - px, y - py) <= P.r) set(x, y, T_FLOOR);
    }
  }
  // 3) 옛 수로: 광장 위를 동서로 흐른다 (얕아서 걸을 수는 있지만 느리다). 돌다리 둘
  const bridges = [];
  for (let x = 14; x <= 92; x++) for (let y = 40; y <= 42; y++) set(x, y, T_LIQUID);
  for (const bx of [30, 64]) for (let x = bx - 1; x <= bx + 1; x++) for (let y = 39; y <= 43; y++) { set(x, y, T_FLOOR); bridges.push({ x, y }); }
  for (let x = 14; x <= 92; x++) for (const y of [39, 43]) if (t[idx(x, y)] === T_WALL) set(x, y, T_FLOOR); // 수로 둑길
  // 4) 구역 (방 가운데에서 퍼져 나간다)
  const regions = new Int8Array(TW * TH).fill(-1), q = [];
  ROOMS.forEach((R, r) => { const i = idx(R.x, R.y); regions[i] = r; q.push(i); });
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % TW, y = (i / TW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = idx(x + dx, y + dy); if (!inb(x + dx, y + dy) || regions[j] >= 0 || t[j] === T_WALL) continue; regions[j] = regions[i]; q.push(j); }
  }
  const camps = CAMPS.map(([x, y, type, n]) => ({ x, y, type, n, region: regions[idx(x, y)] }));
  const regionInfo = ROOMS.map((R, r) => ({ name: R.name, x: R.x, y: R.y, place: true, lv: R.lv || null, lvShow: !!R.lv, types: [...new Set(camps.filter((c) => c.region === r).map((c) => c.type))] }));
  for (const ri of regionInfo) if (!ri.types.length) ri.types = ['bat'];
  // 5) 소품: 노점 상자 · 술통 · 기둥, 투기장 둘레 기둥
  const props = [];
  const block = (kind, x, y, w = 1, h = 1) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, T_WALL); props.push({ kind, x, y, w, h }); };
  for (const [x, y] of [[61, 27], [62, 27], [74, 27], [75, 27], [60, 33], [76, 33]]) block('crate', x, y);
  for (const [x, y] of [[58, 30], [78, 30], [42, 71], [54, 71], [20, 68], [32, 68]]) block('barrelProp', x, y);
  for (const [x, y] of [[36, 46], [64, 46], [36, 60], [64, 60]]) block('column', x, y);
  for (let a = 0; a < 8; a++) { const x = Math.round(74 + Math.cos(a * Math.PI / 4) * 7.5), y = Math.round(72 + Math.sin(a * Math.PI / 4) * 5.5); if (a !== 5) block('column', x, y); }
  // 6) 장식: 화로(불빛) · 버섯 밭의 빛버섯 · 바닥 자갈 · 뼈
  const deco = [];
  for (const [x, y] of [[34, 45], [66, 45], [34, 61], [66, 61], [50, 45], [25, 29], [35, 29], [59, 28], [77, 28], [21, 68], [31, 68], [41, 72], [55, 72], [70, 66], [78, 66], [92, 51], [10, 15], [94, 13], [10, 85], [14, 22], [88, 20], [12, 80]]) deco.push({ x: x * TILE + 8, y: y * TILE + 10, kind: 'brazier', v: (x + y) % 2 });
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== T_FLOOR) continue;
    const x = i % TW, y = (i / TW) | 0, r = ROOMS[regions[i]];
    if (r?.id === 'farm' && rng.chance(0.3)) deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: 'glowshroom', v: rng.int(0, 3) });
    else if (r?.lv && rng.chance(0.06)) deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: rng.pick(['pebble', 'bone', 'crystalB']), v: rng.int(0, 3) });
    else if (rng.chance(0.025)) deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: 'pebble', v: rng.int(0, 3) });
  }
  // 7) 사람 · 출구
  const at = (x, y) => ({ x: x * TILE + 8, y: y * TILE + 8 });
  const npc = (id, art, x, y, label) => ({ kind: 'npc', id, art, ...at(x, y), label, reusable: true });
  const objects = [
    npc('nokt_broker', 'broker', 30, 30, '중개인 벡과 이야기'),
    npc('nokt_black', 'fence', 68, 29, '장물아비 스크라와 이야기 · 암시장'),
    npc('nokt_forge', 'forger', 26, 69, '위조꾼 몰과 이야기 · 악명 지우기'),
    npc('nokt_healer', 'healer', 48, 73, '치료사 엘레와 이야기 · 쉬기'),
    npc('nokt_pit', 'pitBoss', 70, 64, '투기장 주인 그롬과 이야기 · 내기 결투'),
    npc('nokt_rebel1', 'rebel', 44, 50, '녹타리스 반란군과 이야기'),
    npc('nokt_rebel2', 'rebel2', 58, 57, '녹타리스 반란군과 이야기'),
    npc('nokt_guard', 'rebel', 90, 55, '갱도 파수꾼과 이야기'),
    { kind: 'ladderUp', id: 'nokt_exit_well', ...at(10, 17), label: '사다리로 올라간다 (폐허 도시 · 무너진 우물)', reusable: true },
    { kind: 'ladderUp', id: 'nokt_exit_sewer', ...at(95, 15), label: '사다리로 올라간다 (왕도 하수구)', reusable: true },
    { kind: 'ladderUp', id: 'nokt_exit_mine', ...at(10, 89), label: '갱도를 따라 올라간다 (황야의 옛 광산)', reusable: true },
  ];
  const P = (x, y) => ({ x, y });
  return {
    tw: TW, th: TH, tiles: t, designed: 'nokt', nokt: true, bridges, props,
    start: P(50, 55), lair: P(131, 52), stairs: null,
    exits: { well: P(10, 19), sewer: P(95, 17), mine: P(11, 87) },
    camps, champions: [{ x: 120, y: 30, type: 'goblinChief', region: ROOMS.findIndex((r) => r.id === 'cave1') }],
    chests: [{ x: 118, y: 26, rich: false }, { x: 124, y: 82, rich: true, trap: true }, { x: 134, y: 48, rich: true }, { x: 104, y: 76, rich: false }],
    lores: [
      { ...P(128, 58), text: '…빛은 여덟 조각으로 나뉘어 있다. 조각이 모두 꺼지는 날, 섬은 처음으로 돌아가 다시 태어나리라. 왕은 조각을 모으고 있다. 좋다. 한곳에 모인 불은 끄기 쉬우니. — 안개 너머에서 온 자의 글' },
      { ...P(114, 64), text: '갱도 일지: 밤마다 깊은 갱 쪽에서 노랫소리가 들린다. 반장은 바람 소리라 했지만, 어제 그쪽으로 간 광부 둘이 돌아오지 않았다. 벽에 그려진 눈 모양 표식이 늘어간다.' },
    ], secrets: [], deco, regions, regionInfo,
    camp: [], merchant: [], shrines: [], goblins: [], objects, pit: { x: 74, y: 72 },
  };
}

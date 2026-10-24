// 왕도 아우렐리온: 무너진 왕성(기사 성지) 둘레에 성벽을 두르고 네 구역을 앉힌다.
//   북서 귀족 거리(저택 넷 · 고위 관계자가 산다) · 북동 감옥(쇠울타리 마당 · 지하 감옥 입구) · 남서 처형장(처형대 · 전령) · 남동 시장(좌판 · 교역소)
//   가운데 분수 광장, 남 · 서 · 동 성문. 하수구 철창은 처형장 뒷골목 (녹트 하벤으로 가는 숨은 길)
// 바깥 세계 길 · 나무 · 몬스터를 놓기 전에 짓는다 (길은 성문으로 들어오고, 성 안에는 나무 · 몬스터 무리가 생기지 않게)
import { T_FLOOR, T_BUILD } from '../../sim/mapgen.js';

export const CAP = { x0: 280, y0: 224, x1: 362, y1: 290, name: '왕도 아우렐리온' };
export const capInside = (x, y, pad = 0) => x >= CAP.x0 - pad && x <= CAP.x1 + pad && y >= CAP.y0 - pad && y <= CAP.y1 + pad;

export function buildCapital(c) {
  const { t, gr, LV, G, set, occupied, props, objects, inb, I, at } = c;
  const { x0, y0, x1, y1 } = CAP;
  const prop = (kind, x, y, w, h, extra = {}) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { set(xx, yy, T_BUILD); occupied[I(xx, yy)] = 1; } const pr = { kind, x, y, w, h, ...extra }; props.push(pr); return pr; };
  const open = (x, y) => { set(x, y, T_FLOOR); occupied[I(x, y)] = 0; }; // 건물 안에 비워 두는 칸 (성문 통로)
  const free = (x, y) => inb(x, y) && t[I(x, y)] === T_FLOOR && !occupied[I(x, y)];
  const streets = [];
  const paint = (xa, ya, xb, yb, g, street = true) => { for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (free(x, y)) { gr[I(x, y)] = g; if (street) streets.push(I(x, y)); } };
  const npc = (id, art, x, y, label, extra = {}) => objects.push({ kind: 'npc', id, art, ...at(x, y), label, reusable: true, ...extra });

  // 1) 터 고르기: 성 안은 평평한 풀밭 (왕성 건물은 그대로)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inb(x, y) || occupied[I(x, y)]) continue;
    set(x, y, T_FLOOR, G.GRASS); LV[I(x, y)] = 0;
  }

  // 2) 성벽 · 망루 · 성문 (망루 · 성문을 먼저 세우고, 남은 둘레를 벽으로 잇는다)
  const tower = (x, y, extra = {}) => prop('wallTower', x, y, 2, 2, extra);
  for (const [x, y] of [[x0, y0], [x1 - 1, y0], [x0, y1 - 1], [x1 - 1, y1 - 1]]) tower(x, y, { corner: true });
  for (const x of [298, 318, 340]) tower(x, y0);
  for (const x of [300, 314, 348]) tower(x, y1 - 1);
  for (const y of [240, 280]) { tower(x0, y); tower(x1 - 1, y); }
  // 남문: 망루 둘 사이 통로 셋 (아치 아래로 지나간다)
  const SG = { x: 331, y: y1 };
  const sg = prop('cityGate', SG.x - 3, y1 - 1, 7, 2);
  for (let x = SG.x - 1; x <= SG.x + 1; x++) for (const y of [y1 - 1, y1]) open(x, y);
  sg.passFrom = SG.x - 1; sg.passTo = SG.x + 1;
  // 서문 · 동문: 망루 둘 사이로 통로 셋
  const WG = { x: x0, y: 263 }, EG = { x: x1, y: 263 };
  for (const [gx, side] of [[x0, 'w'], [x1 - 1, 'e']]) { tower(gx, WG.y - 3, { gate: side, part: 'n' }); tower(gx, WG.y + 2, { gate: side, part: 's' }); }
  const wallAt = (x, y) => inb(x, y) && !occupied[I(x, y)] && !(Math.abs(y - WG.y) <= 1 && (x === x0 || x === x1)) && !(y === y1 && Math.abs(x - SG.x) <= 1); // 성문 통로는 비워 둔다
  for (const y of [y0, y1]) { // 가로 벽: 4칸씩 끊어 그린다
    let run = [];
    const flush = () => { if (run.length) prop('cityWall', run[0], y, run.length, 1, { dir: 'h', outer: y === y0 ? 'n' : 's' }); run = []; };
    for (let x = x0; x <= x1; x++) { if (wallAt(x, y) && run.length < 4) run.push(x); else { flush(); if (wallAt(x, y)) run.push(x); } }
    flush();
  }
  for (const x of [x0, x1]) { // 세로 벽: 3칸씩 (앞에 선 사람과 그리는 순서가 어긋나지 않게 짧게)
    let run = [];
    const flush = () => { if (run.length) prop('cityWall', x, run[0], 1, run.length, { dir: 'v', outer: x === x0 ? 'w' : 'e' }); run = []; };
    for (let y = y0; y <= y1; y++) { if (wallAt(x, y) && run.length < 3) run.push(y); else { flush(); if (wallAt(x, y)) run.push(y); } }
    flush();
  }

  // 3) 큰길: 왕성 문 → 분수 광장 → 남문, 서문 ↔ 동문 가로길
  paint(SG.x - 1, 243, SG.x + 1, y1, G.COBBLE);
  paint(x0 + 1, WG.y - 1, x1 - 1, WG.y + 1, G.COBBLE);
  paint(324, 259, 338, 268, G.STONE); // 분수 광장
  prop('fountain', SG.x - 1, 265, 3, 2);
  for (const [lx, ly] of [[324, 259], [338, 259], [324, 268], [338, 268]]) prop('lampPost', lx, ly, 1, 1);
  for (const [bx, by] of [[328, 274], [334, 274], [328, 281], [334, 281]]) prop('bannerPole', bx, by, 1, 1, { race: 'knight' });

  // 4) 북서: 귀족 거리 — 저택 넷 (정원 · 산울타리), 고위 관계자가 저택 앞에 산다
  paint(x0 + 1, y0 + 2, 322, 231, G.GRASS, false);
  for (let y = y0 + 2; y <= 230; y++) for (let x = x0 + 2; x <= 322; x++) if (free(x, y) && (x * 7 + y * 13) % 9 === 0) gr[I(x, y)] = G.FLOWER;
  const MANOR = [[284, 'taxChief', '#8a2a2a'], [293, 'treasurer', '#2a5a4a'], [302, 'knightCommander', '#2e4a82'], [311, 'royalMage', '#5a3ab0']];
  const homes = {};
  for (const [mx, who, roof] of MANOR) {
    prop('house_manor', mx, 232, 7, 4, { house: 'manor', roof, doorX: (mx + 3) * 16 + 8 });
    paint(mx + 2, 236, mx + 4, 239, G.STONE);
    homes[who] = { x: mx + 3, y: 238 };
    prop('hedge', mx - 1, 228, 1, 1); prop('hedge', mx + 7, 228, 1, 1);
    prop('gardenStatue', mx + 3, 228, 1, 1);
  }
  paint(x0 + 1, 240, 322, 241, G.COBBLE); // 귀족 거리
  for (const lx of [286, 295, 304]) prop('lampPost', lx, 242, 1, 1);
  npc('cap_noble1', 'cap_noble1', 290, 243, '귀족 아가씨 셀레스트와 이야기');
  npc('cap_noble2', 'cap_noble2', 299, 243, '귀족 바르텔과 이야기');
  npc('cap_maid', 'cap_maid', 309, 238, '저택 하녀 에마와 이야기');

  // 5) 서쪽 아래: 서민 집 여섯 · 골목
  paint(x0 + 1, 250, 307, 251, G.COBBLE);
  paint(305, 242, 306, WG.y - 2, G.COBBLE);
  const TOWN = ['town1', 'town2', 'town3'];
  [[284, 246], [291, 246], [298, 246], [284, 253], [291, 253], [298, 253]].forEach(([hx, hy], i) => {
    prop('house_town', hx, hy, 5, 3, { house: TOWN[i % 3], doorX: (hx + 2) * 16 + 8 });
    paint(hx + 2, hy + 3, hx + 2, hy + 3 + (hy === 253 ? 5 : 1), G.COBBLE);
  });
  npc('cap_folk1', 'cap_folk1', 289, 251, '술잔 든 주민 오스와 이야기');
  npc('cap_kid', 'cap_kid', 296, 250, '뛰어노는 아이 티모와 이야기');

  // 6) 북동: 감옥 — 건물 · 쇠울타리 마당 (마당 안에 지하 감옥 계단), 간수장
  prop('house_prison', 345, 227, 10, 4, { house: 'prison', doorX: 350 * 16 + 8 });
  paint(344, 231, 356, 236, G.DIRT, false);
  const fence = (x, y, w, h, dir) => prop('ironFence', x, y, w, h, { dir });
  fence(343, 231, 2, 1, 'h'); fence(355, 231, 3, 1, 'h');
  for (let y = 232; y <= 236; y++) { fence(343, y, 1, 1, 'v'); fence(357, y, 1, 1, 'v'); }
  fence(343, 237, 6, 1, 'h'); fence(352, 237, 6, 1, 'h'); // 가운데(349~351)는 마당 문
  paint(343, 238, 359, 239, G.COBBLE); paint(358, 238, 359, WG.y - 2, G.COBBLE);
  npc('cap_jailer', 'cap_jailer', 347, 239, '간수장 그롬과 이야기 · 벌금 · 감옥');
  npc('cap_guard_prison', 'royalGuard', 353, 239, '감옥 경비병과 이야기');
  npc('cap_prisonerYard', 'cap_prisonerYard', 346, 234, '마당의 죄수와 이야기');
  const crypt = { x: 354, y: 235 }; // 왕성 지하 감옥(던전) 입구: 마당 안 계단

  // 7) 남서: 처형장 — 돌 광장 · 처형대 · 전령 · 구경꾼, 구석에 하수구 철창(숨은 길)
  paint(284, 267, 316, 287, G.STONE);
  prop('scaffold', 293, 270, 7, 3);
  for (const [lx, ly] of [[290, 268], [302, 268]]) prop('lampPost', lx, ly, 1, 1);
  npc('cap_herald', 'cap_herald', 296, 275, '전령 피에르와 이야기 · 포고문 · 처형');
  npc('cap_folk4', 'cap_folk4', 290, 278, '구경꾼 노인 하스와 이야기');
  npc('cap_folk5', 'cap_folk5', 302, 279, '구경꾼 리스와 이야기');
  npc('cap_beggar', 'cap_beggar', 312, 285, '거지 노인과 이야기');
  // 처형대 위 집행인 (발을 처형대 위에 맞추고, 처형대보다 나중에 그린다)
  objects.push({ kind: 'npc', id: 'cap_exec', art: 'cap_exec', x: 298 * 16 + 8, y: 271 * 16 + 4, sortY: 273 * 16 + 4, label: '집행인', reusable: true, onStage: true });
  const stage = { x: 296 * 16 + 4, y: 271 * 16 + 4, sortY: 273 * 16 + 4 };

  // 8) 남동: 시장 — 좌판 열한 · 교역소 · 시세판 · 장사꾼
  paint(338, 267, x1 - 1, y1 - 2, G.STONE);
  const STALLS = [
    [340, 270, 'fruit', '#d84a3a', ['cap_fruit', 'cap_fruit', '과일 장수 할머니와 이야기']],
    [345, 270, 'crates', '#3a6a9a', ['capital_trade', 'cap_trader', '왕도 교역상 마틸드와 이야기 · 교역품 사고팔기']],
    [350, 270, 'bread', '#e8b040', ['cap_baker', 'cap_baker', '빵집 안나와 이야기 · 사고팔기', { kind: 'station', station: 'store', panel: 'trade', npc: { name: '빵집 안나' }, reach: 40 }]],
    [355, 270, 'arms', '#5a5a6a', ['cap_armorer', 'cap_armorer', '갑옷 장인 도르크와 이야기 · 장비', { kind: 'station', station: 'shop', panel: 'shop', npc: { name: '갑옷 장인 도르크' }, reach: 40 }]],
    [340, 277, 'cloth', '#a83a6a', ['cap_cloth', 'cap_cloth', '옷감 장수 리엔과 이야기']],
    [345, 277, 'spice', '#c8782a', null],
    [350, 277, 'fish', '#3a8a8a', ['cap_fish', 'cap_fish', '생선 장수 실라와 이야기']],
    [355, 277, 'pots', '#8a5a32', null],
    [340, 284, 'flowers', '#e86aa8', null],
    [345, 284, 'closed', '#6a6a5a', null],
    [350, 284, 'wine', '#6a1a2a', null],
  ];
  for (const [sx, sy, goods, awn, who] of STALLS) {
    prop('stall', sx, sy, 3, 2, { goods, awn });
    if (!who) continue;
    const [id, art, label, extra] = who;
    objects.push({ kind: 'npc', id, art, ...at(sx + 1, sy - 1), label, reusable: true, ...(extra || {}) });
  }
  objects.push({ kind: 'priceBoard', id: 'capital_board', ...at(339, 266), label: '왕도 시세판 보기', reusable: true });
  prop('crates', 358, 287, 1, 1, { race: 'assassin' }); prop('crates', 338, 288, 1, 1, { race: 'assassin' });
  npc('cap_folk2', 'cap_folk2', 343, 274, '장 보는 주민 넬라와 이야기');
  npc('cap_folk3', 'cap_folk3', 353, 281, '짐꾼 그루크와 이야기');

  // 9) 성문 경비 · 성문 대장
  npc('cap_gate', 'cap_gate', SG.x - 4, y1 - 3, '성문 대장 로웰과 이야기 · 검문');
  npc('cap_guard_s1', 'royalGuard', SG.x - 4, y1 + 2, '성문 경비병');
  npc('cap_guard_s2', 'royalGuard', SG.x + 4, y1 + 2, '성문 경비병');
  npc('cap_guard_w', 'royalGuard', x0 + 3, WG.y - 3, '서문 경비병');
  npc('cap_guard_e', 'royalGuard', x1 - 3, EG.y + 3, '동문 경비병');

  // 성 안: 길 바닥 정리 (성문 통로)
  for (let x = SG.x - 1; x <= SG.x + 1; x++) for (const y of [y1 - 1, y1]) { gr[I(x, y)] = G.COBBLE; streets.push(I(x, y)); }
  for (const gx of [x0, x1]) for (let y = WG.y - 1; y <= WG.y + 1; y++) { if (!occupied[I(gx, y)]) { set(gx, y, T_FLOOR, G.COBBLE); streets.push(I(gx, y)); } }

  return {
    ...CAP, streets, homes, crypt, stage,
    gates: { s: { x: SG.x, y: y1 }, w: { x: x0, y: WG.y }, e: { x: x1, y: EG.y } },
    outside: { recruiter: { x: SG.x - 6, y: y1 + 4 }, chronicle: { x: SG.x + 7, y: y1 + 4 }, sign: { x: SG.x - 9, y: y1 + 5 } },
    sewer: { x: 289, y: 285 },
    king: { x: SG.x, y: 245 },
  };
}

// 1층 이끼 동굴: 직접 설계한 맵. 방(이름 있는 장소) · 통로 · 길을 막는 것 · 숨은 방 · 오브젝트 자리를 적어 두고,
// 가장자리만 고정 시드로 울퉁불퉁하게 깎아 동굴처럼 만든다. 언제 들어와도 같은 모양이라 길을 기억할 수 있다.
//
//            J 무너진 전망대 ─(지름길, 전망대 쪽에서만 열림)─ B 첫 야영지
//                 │                                          │
//            I 어두운 굴                                      A 입구 ── C 이끼 굴 ── D 고블린 야영지 ── E 족장의 천막
//                 │ (가시덩굴: 이끼 등불)                                │              │
//                 └──────────────── C ──────────────────────────── F 버섯 숲 ─────────┘
//                                   │                                  │
//            H 숨은 방 ─(녹슨 철창: 족장의 열쇠)─ G 물웅덩이 동굴 ────────┘
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_GATE } from '../../sim/mapgen.js';
import { createRng } from '../../sim/rng.js';

const TW = 128, TH = 96;

// 방: 가운데 · 반지름 (타일)
const ROOMS = [
  { id: 'A', name: '입구 동굴', x: 14, y: 52, rx: 7, ry: 6 },
  { id: 'B', name: '등반가의 첫 야영지', x: 20, y: 30, rx: 6, ry: 5 },
  { id: 'C', name: '이끼 굴', x: 42, y: 50, rx: 10, ry: 8 },
  { id: 'D', name: '고블린 야영지', x: 72, y: 30, rx: 11, ry: 8 },
  { id: 'E', name: '족장의 천막', x: 100, y: 20, rx: 9, ry: 7 },
  { id: 'F', name: '버섯 숲', x: 80, y: 66, rx: 12, ry: 9 },
  { id: 'G', name: '물웅덩이 동굴', x: 44, y: 78, rx: 11, ry: 7 },
  { id: 'H', name: '등반가의 숨은 방', x: 20, y: 80, rx: 5, ry: 4 },
  { id: 'I', name: '어두운 굴', x: 44, y: 20, rx: 7, ry: 5 },
  { id: 'J', name: '무너진 전망대', x: 34, y: 7, rx: 7, ry: 3, vista: true },
];
export const CAVE1_PLACES = ROOMS.map((r) => r.name);

// 통로: 지나는 점들 · 굵기(반지름)
const PATHS = [
  { p: [[15, 46], [17, 40], [19, 35]], r: 1.8 },          // A-B
  { p: [[20, 52], [27, 51], [33, 50]], r: 2 },            // A-C
  { p: [[50, 45], [56, 40], [63, 34]], r: 2 },            // C-D
  { p: [[82, 26], [88, 23], [92, 21]], r: 2 },            // D-E
  { p: [[51, 55], [60, 60], [69, 63]], r: 2 },            // C-F
  { p: [[76, 37], [78, 47], [79, 58]], r: 1.8 },          // D-F
  { p: [[43, 57], [44, 64], [44, 72]], r: 1.8 },          // C-G
  { p: [[54, 78], [62, 75], [70, 72]], r: 1.8 },          // G-F
  { p: [[34, 79], [29, 80], [24, 80]], r: 1.3 },          // G-H (철창)
  { p: [[42, 42], [43, 33], [44, 25]], r: 1.5 },          // C-I (가시덩굴)
  { p: [[42, 16], [38, 12], [36, 9]], r: 1.5 },           // I-J
  { p: [[28, 8], [24, 15], [21, 26]], r: 1.5 },           // J-B 지름길 (무너진 바위)
];

// 길을 막는 것: 통로를 가로지르는 줄 (from: 열 수 있는 쪽)
const BARRIERS = [
  { id: 'thornGate', x: 43, y: 35, axis: 'h' },
  { id: 'ironGate', x: 30, y: 80, axis: 'v' },
  { id: 'rubble', x: 23, y: 18, axis: 'h', from: 'north' },
];

// 숨은 방: 균열 벽 뒤 (방에서 이 방향으로 판 좁은 굴)
const SECRETS = [
  { from: 'F', x: 110, y: 70, r: 2.5 },
  { from: 'D', x: 72, y: 13, r: 2.5 },
];

// 몬스터 무리: [x, y, 종류, 마릿수]
const CAMPS = [
  [37, 47, 'slime', 4], [47, 54, 'mossSlug', 3], [45, 45, 'slime', 3],
  [66, 28, 'goblin', 4], [76, 33, 'goblin', 3], [72, 25, 'goblinShaman', 2], [81, 28, 'goblin', 3],
  [95, 23, 'goblin', 3],
  [85, 62, 'caveLurker', 3], [73, 71, 'slime', 3], [88, 70, 'mossSlug', 3],
  [39, 81, 'caveLurker', 3], [49, 74, 'bat', 4],
  [44, 18, 'bat', 4],
];

export function buildCave1(zone) {
  const rng = createRng(0xca7e1);
  const t = new Uint8Array(TW * TH).fill(T_WALL);
  const idx = (x, y) => y * TW + x;
  const inb = (x, y) => x >= 2 && y >= 2 && x < TW - 2 && y < TH - 2;
  const get = (x, y) => (x >= 0 && y >= 0 && x < TW && y < TH ? t[idx(x, y)] : T_WALL);
  const set = (x, y, v) => { if (inb(x, y)) t[idx(x, y)] = v; };
  const disc = (cx, cy, r, v = T_FLOOR) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, v);
  };

  // 1) 방: 가장자리를 각도마다 조금씩 들쭉날쭉하게
  for (const R of ROOMS) {
    const bumps = Array.from({ length: 12 }, () => rng.range(-0.16, 0.12));
    const rad = (a) => { const k = ((a / (Math.PI * 2)) * 12 + 12) % 12, i = Math.floor(k), f = k - i; return 1 + bumps[i] * (1 - f) + bumps[(i + 1) % 12] * f; };
    for (let y = R.y - R.ry - 2; y <= R.y + R.ry + 2; y++) for (let x = R.x - R.rx - 2; x <= R.x + R.rx + 2; x++) {
      const dx = (x - R.x) / R.rx, dy = (y - R.y) / R.ry;
      if (Math.hypot(dx, dy) <= rad(Math.atan2(dy, dx))) set(x, y, T_FLOOR);
    }
  }
  // 2) 통로: 점 사이를 살짝 흔들리며 잇는다
  for (const P of PATHS) {
    for (let i = 0; i < P.p.length - 1; i++) {
      const [ax, ay] = P.p[i], [bx, by] = P.p[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= n; k++) {
        const u = k / n, w = Math.sin(u * Math.PI) * 0.6 * Math.sin(k * 0.7 + i);
        disc(ax + (bx - ax) * u + w * 0.4, ay + (by - ay) * u + w * 0.4, P.r + rng.range(-0.15, 0.25));
      }
    }
  }
  // 3) 큰 방 안의 바위 기둥 (엄폐물)
  for (const R of ROOMS) {
    if (R.rx < 10) continue;
    for (let i = 0; i < 3; i++) {
      const x = R.x + Math.round(rng.range(-0.5, 0.5) * R.rx), y = R.y + Math.round(rng.range(-0.45, 0.45) * R.ry);
      if (Math.hypot(x - R.x, y - R.y) < 3) continue;
      set(x, y, T_WALL); set(x + 1, y, T_WALL); if (rng.chance(0.5)) set(x, y + 1, T_WALL);
    }
  }
  // 4) 웅덩이
  for (const [cx, cy, rx, ry] of [[40, 82, 4, 2], [51, 79, 3, 2], [36, 54, 2, 1.5], [86, 72, 2.5, 1.5]]) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && get(x, y) === T_FLOOR) set(x, y, T_LIQUID);
    }
  }
  // 5) 한 칸짜리 튀어나온 벽 · 구멍 정리
  for (let pass = 0; pass < 2; pass++) {
    const n = new Uint8Array(t);
    for (let y = 2; y < TH - 2; y++) for (let x = 2; x < TW - 2; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && get(x + dx, y + dy) === T_WALL) c++;
      const v = get(x, y);
      if (v === T_WALL && c <= 1) n[idx(x, y)] = T_FLOOR;
      if (v === T_FLOOR && c >= 7) n[idx(x, y)] = T_WALL;
    }
    t.set(n);
  }
  // 6) 숨은 방: 방 가장자리의 벽 한 칸을 균열 벽으로, 그 뒤로 한 칸짜리 굴
  const secrets = [];
  for (const S of SECRETS) {
    const R = ROOMS.find((r) => r.id === S.from);
    const L = Math.ceil(Math.hypot(S.x - R.x, S.y - R.y));
    let crack = null, px = R.x, py = R.y;
    for (let k = 0; k <= L; k++) {
      const x = Math.round(R.x + ((S.x - R.x) * k) / L), y = Math.round(R.y + ((S.y - R.y) * k) / L);
      const diag = x !== px && y !== py; px = x; py = y;
      if (!crack) { if (get(x, y) === T_WALL) { crack = [x, y]; set(x, y, T_CRACK); } continue; }
      if (diag && get(x - Math.sign(S.x - R.x), y) === T_WALL) set(x - Math.sign(S.x - R.x), y, T_FLOOR); // 대각선으로만 이어지면 못 지나간다
      if (Math.hypot(x - S.x, y - S.y) > S.r) set(x, y, T_FLOOR);
    }
    disc(S.x, S.y, S.r);
    secrets.push({ x: S.x, y: S.y });
  }
  // 7) 길을 막는 것: 통로를 가로지르는 줄의 바닥 칸
  const barriers = BARRIERS.map((B) => {
    const tiles = [];
    for (let k = -4; k <= 4; k++) {
      const x = B.axis === 'h' ? B.x + k : B.x, y = B.axis === 'h' ? B.y : B.y + k;
      if (get(x, y) !== T_WALL) { set(x, y, T_GATE); tiles.push(idx(x, y)); }
    }
    return { id: B.id, x: B.x, y: B.y, axis: B.axis, from: B.from || null, tiles };
  });

  // 8) 구역: 방 가운데에서 퍼져 나가 가장 가까운 방에 붙인다
  const regions = new Int8Array(TW * TH).fill(-1);
  const q = [];
  ROOMS.forEach((R, r) => { const i = idx(R.x, R.y); regions[i] = r; q.push(i); });
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % TW, y = (i / TW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = idx(x + dx, y + dy);
      if (x + dx < 0 || y + dy < 0 || x + dx >= TW || y + dy >= TH || regions[j] >= 0) continue;
      const v = t[j];
      if (v === T_WALL || v === T_GATE) continue;   // 문 너머 장소는 문을 지나야 발견된다
      regions[j] = regions[i]; q.push(j);
    }
  }
  const camps = CAMPS.map(([x, y, type, n]) => ({ x, y, type, n, region: regions[idx(x, y)] }));
  const regionInfo = ROOMS.map((R, r) => ({ name: R.name, x: R.x, y: R.y, place: true, vista: !!R.vista, types: [...new Set(camps.filter((c) => c.region === r).map((c) => c.type))] }));
  for (const ri of regionInfo) if (!ri.types.length) ri.types = ['bat'];

  // 9) 장식: 지역 장식 + 버섯 숲의 빛버섯 + 세린의 분필 화살표(v: 0 오른쪽 · 1 위 · 2 왼쪽 · 3 아래)
  const deco = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== T_FLOOR) continue;
    const x = i % TW, y = (i / TW) | 0, inF = regions[i] === 5;
    if (!rng.chance(inF ? 0.16 : 0.06)) continue;
    deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: inF && rng.chance(0.6) ? 'glowshroom' : rng.pick(zone.deco), v: rng.int(0, 3) });
  }
  for (const [x, y, v] of [[19, 36, 3], [24, 31, 0], [30, 50, 0], [42, 41, 1], [43, 38, 1], [44, 24, 1], [41, 15, 2], [37, 10, 1]]) deco.push({ x: x * TILE + 8, y: y * TILE + 10, kind: 'chalk', v });

  const P = (x, y) => ({ x, y });
  return {
    tw: TW, th: TH, tiles: t, designed: 'cave1',
    start: P(10, 52), lair: P(100, 20), stairs: P(104, 16),
    camps, champions: [{ x: 47, y: 82, type: 'caveLurker', region: 6 }],
    chests: [
      { x: 45, y: 56, rich: false }, { x: 79, y: 33, rich: false, trap: true }, { x: 37, y: 74, rich: false },
      { x: 104, y: 23, rich: false }, { x: 49, y: 22, rich: false },
      { x: 18, y: 82, rich: true }, ...secrets.map((s) => ({ ...s, rich: true })),
    ],
    lores: [P(35, 46), P(61, 36)], secrets, deco, regions, regionInfo,
    camp: [P(87, 66), P(94, 25)], merchant: [P(78, 47)], shrines: [P(48, 84)], goblins: [P(53, 76)],
    barriers,
    journals: [{ id: 'serin1', x: 20, y: 30 }, { id: 'serin2', x: 22, y: 79 }, { id: 'serin3', x: 33, y: 6 }],
    npcs: [{ id: 'pino', x: 75, y: 63 }],
  };
}

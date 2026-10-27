// 탑 등반의 층 지도: 싸움터(동굴 방) · 수호자의 방(둥근 방) · 쉬는 방(상인 · 제단 · 쉼터)
// 들어오는 자리는 아래쪽 가운데, 다음 층으로 가는 문은 위쪽에 한 줄로. 가운데에 보상이 나타난다.
import { createRng } from './rng.js';
import { TILE, T_FLOOR, T_WALL, T_LIQUID } from './mapgen.js';

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function buildClimbFloor(zone, seed, f, kind) {
  const rng = createRng((seed ^ 0x7a11) + f * 131);
  if (kind === 'guardian' || kind === 'lord') return bossRoom(zone, rng, f, kind);
  if (kind === 'shop' || kind === 'altar' || kind === 'rest') return quietRoom(zone, rng, f, kind);
  return fightRoom(zone, rng, f, kind);
}

function base(tw, th) {
  const t = new Uint8Array(tw * th).fill(T_WALL);
  return { tw, th, t, idx: (x, y) => y * tw + x, inb: (x, y) => x >= 0 && y >= 0 && x < tw && y < th };
}

// 문 자리: 위쪽 벽에 붙은 작은 마당 (문 셋까지 나란히)
function doorYard(M, cx, top) {
  for (let y = top; y <= top + 4; y++) for (let x = cx - 9; x <= cx + 9; x++) if (M.inb(x, y) && x > 1 && x < M.tw - 2 && y > 1) M.t[M.idx(x, y)] = T_FLOOR;
  return [-6, 0, 6].map((dx) => ({ x: cx + dx, y: top + 1 }));
}

function finish(M, zone, rng, f, kind, start, center, doors, extra = {}) {
  const { tw, th, t, idx, inb } = M;
  // 바깥 테두리는 벽
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (x < 2 || y < 2 || x >= tw - 2 || y >= th - 2) t[idx(x, y)] = T_WALL;
  // 시작점에서 닿지 않는 바닥은 벽으로 (문 · 보상 자리는 꼭 닿게 먼저 길을 판다)
  const dist = new Int32Array(tw * th).fill(-1), q = [idx(start.x, start.y)]; dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % tw, y = (i / tw) | 0;
    for (const [dx, dy] of DIRS4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (dist[j] < 0 && t[j] !== T_WALL) { dist[j] = dist[i] + 1; q.push(j); } }
  }
  for (let i = 0; i < t.length; i++) if (t[i] !== T_WALL && dist[i] < 0) t[i] = T_WALL;
  // 몬스터가 나오는 자리: 시작점에서 멀고 둘레가 트인 바닥
  const spawns = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== T_FLOOR || dist[i] < 9) continue;
    const x = i % tw, y = (i / tw) | 0;
    if (y <= doors[0].y + 2) continue;
    let open = true;
    for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) if (t[idx(x + dx, y + dy)] !== T_FLOOR) { open = false; break; }
    if (open) spawns.push({ x, y });
  }
  for (let i = spawns.length - 1; i > 0; i--) { const j = rng.int(0, i); [spawns[i], spawns[j]] = [spawns[j], spawns[i]]; }
  const deco = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== T_FLOOR || !rng.chance(0.05)) continue;
    const x = i % tw, y = (i / tw) | 0;
    if (Math.hypot(x - start.x, y - start.y) < 3 || Math.hypot(x - center.x, y - center.y) < 3 || doors.some((d) => Math.abs(d.x - x) < 2 && Math.abs(d.y - y) < 2)) continue;
    deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: rng.pick(zone.deco), v: rng.int(0, 3) });
  }
  const name = kind === 'guardian' ? '수호자의 방' : kind === 'lord' ? '주인의 방' : kind === 'shop' ? '상인의 방' : kind === 'altar' ? '제단의 방' : kind === 'rest' ? '쉼터' : `${f}층`;
  return {
    tw, th, tiles: t, start, lair: extra.lair || center, stairs: null,
    camps: [], champions: [], chests: [], lores: [], secrets: [], deco, regions: null, regionInfo: [{ name, types: [] }],
    camp: [], merchant: [], shrines: [], goblins: [], objects: [], noPortal: true, nodes: [], digs: [], // 캐기 · 파기 자리는 없다
    climb: { kind, spawns, center, doors, dist },
  };
}

// 싸움터: 울퉁불퉁한 큰 동굴 방 + 옆으로 붙은 굴 몇 개 + 기둥 · 웅덩이
function fightRoom(zone, rng, f, kind) {
  const tw = 46 + Math.min(10, Math.floor(f / 5)), th = 36 + Math.min(6, Math.floor(f / 8));
  const M = base(tw, th), { t, idx, inb } = M;
  const cx = tw >> 1, cy = (th >> 1) + 3;
  const ph = [rng.range(0, 6), rng.range(0, 6), rng.range(0, 6)];
  const rx = tw * 0.38, ry = th * 0.27;
  const blob = (bx, by, brx, bry, wob = 0.18) => {
    for (let y = Math.floor(by - bry - 2); y <= by + bry + 2; y++) for (let x = Math.floor(bx - brx - 2); x <= bx + brx + 2; x++) {
      if (!inb(x, y)) continue;
      const a = Math.atan2(y - by, x - bx), n = 1 + wob * Math.sin(a * 3 + ph[0]) + wob * 0.6 * Math.sin(a * 5 + ph[1]) + wob * 0.4 * Math.sin(a * 7 + ph[2]);
      if (((x - bx) / brx) ** 2 + ((y - by) / bry) ** 2 <= n * n) t[idx(x, y)] = T_FLOOR;
    }
  };
  blob(cx, cy, rx, ry);
  for (let i = 0, n = rng.int(3, 5); i < n; i++) { // 옆굴
    const a = rng.range(0, Math.PI * 2), d = rng.range(0.75, 1.0);
    blob(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rng.range(4, 7), rng.range(3, 5), 0.25);
  }
  const start = { x: cx, y: th - 5 };
  for (let y = cy; y <= start.y + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) t[idx(x, y)] = T_FLOOR; // 들어오는 길
  const top = 7; // 문 위로 벽을 두어 화면 위 글과 겹치지 않게
  const doors = doorYard(M, cx, top);
  for (let y = top + 3; y <= cy; y++) for (let x = cx - 2; x <= cx + 2; x++) t[idx(x, y)] = T_FLOOR; // 문으로 가는 길
  // 기둥: 가운데 · 시작점 · 문 둘레는 비운다
  const center = { x: cx, y: cy };
  const pillars = rng.int(3, 6);
  for (let a = 0, made = 0; a < 200 && made < pillars; a++) {
    const x = rng.int(4, tw - 5), y = rng.int(top + 7, th - 7), r = rng.chance(0.5) ? 1 : 1.6;
    if (Math.hypot(x - cx, y - cy) < 6 || Math.hypot(x - start.x, y - start.y) < 6 || t[idx(x, y)] !== T_FLOOR) continue;
    for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (inb(xx, yy) && Math.hypot(xx - x, yy - y) <= r) t[idx(xx, yy)] = T_WALL;
    made++;
  }
  // 웅덩이 (구역의 액체: 물 · 용암 · 눈 · 안개)
  for (let a = 0, made = 0, want = rng.int(1, 3); a < 200 && made < want; a++) {
    const x = rng.int(5, tw - 6), y = rng.int(top + 7, th - 7), r = rng.range(1.6, 3);
    if (Math.hypot(x - cx, y - cy) < 6 || Math.hypot(x - start.x, y - start.y) < 7) continue;
    let ok = true;
    for (let yy = Math.floor(y - r); yy <= y + r && ok; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (!inb(xx, yy) || t[idx(xx, yy)] === T_WALL && Math.hypot(xx - x, yy - y) <= r) { ok = false; break; }
    if (!ok) continue;
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (Math.hypot(xx - x, (yy - y) * 1.2) <= r) t[idx(xx, yy)] = T_LIQUID;
    made++;
  }
  return finish(M, zone, rng, f, kind, start, center, doors);
}

// 수호자 · 주인의 방: 둥근 방, 가운데 위쪽에 보스
function bossRoom(zone, rng, f, kind) {
  const tw = kind === 'lord' ? 50 : 44, th = kind === 'lord' ? 40 : 36;
  const M = base(tw, th), { t, idx } = M;
  const cx = tw / 2, cy = th / 2 + 3, rx = tw / 2 - 3, ry = th / 2 - 6;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) t[idx(x, y)] = T_FLOOR;
  const ix = Math.floor(cx);
  const start = { x: ix, y: th - 4 };
  for (let y = Math.floor(cy); y <= start.y + 1; y++) for (let x = ix - 2; x <= ix + 2; x++) t[idx(x, y)] = T_FLOOR;
  const top = 6;
  const doors = doorYard(M, ix, top);
  for (let y = top + 3; y <= cy; y++) for (let x = ix - 2; x <= ix + 2; x++) t[idx(x, y)] = T_FLOOR;
  // 둘레에 화로 대신 기둥 넷 (숨을 곳)
  for (const [ox, oy] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.4], [0.55, 0.4]]) {
    const x = Math.round(cx + ox * rx), y = Math.round(cy + oy * ry);
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (Math.hypot(xx - x, yy - y) <= 1.2) t[idx(xx, yy)] = T_WALL;
  }
  const center = { x: ix, y: Math.floor(cy) };
  return finish(M, zone, rng, f, kind, start, center, doors, { lair: { x: ix, y: Math.floor(cy - ry * 0.35) } });
}

// 쉬는 방: 작은 네모 방 (상인 · 제단 · 쉼터)
function quietRoom(zone, rng, f, kind) {
  const tw = 30, th = 26;
  const M = base(tw, th), { t, idx } = M;
  for (let y = 9; y < th - 3; y++) for (let x = 4; x < tw - 4; x++) {
    const corner = (x < 6 || x > tw - 7) && (y < 11 || y > th - 5);
    if (!corner) t[idx(x, y)] = T_FLOOR;
  }
  const cx = tw >> 1;
  const start = { x: cx, y: th - 5 };
  const top = 6;
  const doors = doorYard(M, cx, top);
  for (let y = top + 3; y <= 10; y++) for (let x = cx - 2; x <= cx + 2; x++) t[idx(x, y)] = T_FLOOR;
  const center = { x: cx, y: Math.floor(th / 2) + 2 };
  return finish(M, zone, rng, f, kind, start, center, doors);
}

// 필드 맵 생성 (시드 기반). 타일: 0 바닥, 1 벽, 2 특수 지형(밟을 수 있음), 3 균열 벽(부술 수 있음), 4 건물(광장)
import { createRng } from './rng.js';

export const TILE = 16;
export const T_FLOOR = 0, T_WALL = 1, T_LIQUID = 2, T_CRACK = 3, T_BUILD = 4;
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function generateField(zone, seed) {
  const rng = createRng(seed ^ 0x5eed);
  const tw = 92, th = 62;
  const t = new Uint8Array(tw * th);
  const idx = (x, y) => y * tw + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < tw && y < th;
  const get = (x, y) => (inb(x, y) ? t[idx(x, y)] : T_WALL);

  // 1) 셀룰러 오토마타 동굴
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    t[idx(x, y)] = x < 2 || y < 2 || x >= tw - 2 || y >= th - 2 ? T_WALL : rng.next() < 0.46 ? T_WALL : T_FLOOR;
  }
  for (let it = 0; it < 6; it++) {
    const n = new Uint8Array(t);
    for (let y = 1; y < th - 1; y++) for (let x = 1; x < tw - 1; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && get(x + dx, y + dy) === T_WALL) c++;
      n[idx(x, y)] = c >= 5 || (it < 2 && c <= 1) ? T_WALL : T_FLOOR;
    }
    t.set(n);
  }

  // 2) 가장 큰 영역만 남김
  const region = new Int32Array(tw * th).fill(-1);
  let best = -1, bestSize = 0, rid = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === T_WALL || region[i] >= 0) continue;
    const size = flood(i, rid);
    if (size > bestSize) { bestSize = size; best = rid; }
    rid++;
  }
  for (let i = 0; i < t.length; i++) if (t[i] !== T_WALL && region[i] !== best) t[i] = T_WALL;
  function flood(start, id) {
    const q = [start]; region[start] = id; let n = 0;
    while (q.length) {
      const i = q.pop(); n++;
      const x = i % tw, y = (i / tw) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (t[j] !== T_WALL && region[j] < 0) { region[j] = id; q.push(j); }
      }
    }
    return n;
  }

  // 3) 시작점: 왼쪽 가장자리 근처
  let start = null;
  for (let x = 3; x < tw && !start; x++) for (let k = 0; k < th; k++) {
    const y = (th >> 1) + (k % 2 ? -(k >> 1) : k >> 1);
    if (y > 3 && y < th - 4 && t[idx(x, y)] === T_FLOOR) { start = { x: x + 2, y }; break; }
  }
  carve(start.x, start.y, 3);

  // 4) 특수 지형 웅덩이
  for (let i = 0; i < 7; i++) {
    const cx = rng.int(6, tw - 7), cy = rng.int(6, th - 7), r = rng.range(2, 5);
    for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) {
      if (!inb(x, y) || t[idx(x, y)] !== T_FLOOR) continue;
      const d = Math.hypot(x - cx, (y - cy) * 1.2) + rng.range(-0.8, 0.8);
      if (d < r && Math.hypot(x - start.x, y - start.y) > 6) t[idx(x, y)] = T_LIQUID;
    }
  }

  // 5) 시작점에서 거리
  const dist = bfs(start.x, start.y);

  // 6) 정예 둥지: 가장 먼 곳
  let lair = start, far = 0;
  for (let i = 0; i < t.length; i++) if (dist[i] > far && t[i] === T_FLOOR) { far = dist[i]; lair = { x: i % tw, y: (i / tw) | 0 }; }
  carve(lair.x, lair.y, 4);

  // 7) 비밀방 (균열 벽 뒤)
  const secrets = [];
  for (let a = 0; a < 6000 && secrets.length < 2; a++) {
    const fx = rng.int(3, tw - 4), fy = rng.int(3, th - 4);
    if (t[idx(fx, fy)] !== T_FLOOR || dist[idx(fx, fy)] < 12) continue;
    const [dx, dy] = rng.pick(DIRS4);
    const L = rng.int(3, 6); // 균열 벽 → 통로 → 방 중심까지 거리
    let ok = get(fx + dx, fy + dy) === T_WALL;
    const cx = fx + dx * L, cy = fy + dy * L;
    for (let y = cy - 2; y <= cy + 2 && ok; y++) for (let x = cx - 2; x <= cx + 2 && ok; x++) if (x < 1 || y < 1 || x >= tw - 1 || y >= th - 1 || get(x, y) !== T_WALL) ok = false;
    for (let k = 2; k < L - 1 && ok; k++) {
      const x = fx + dx * k, y = fy + dy * k;
      if (get(x, y) !== T_WALL || get(x + dy, y + dx) !== T_WALL || get(x - dy, y - dx) !== T_WALL) ok = false;
    }
    if (!ok || secrets.some((s) => Math.hypot(s.x - cx, s.y - cy) < 15)) continue;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) t[idx(x, y)] = T_FLOOR;
    for (let k = 2; k < L - 1; k++) t[idx(fx + dx * k, fy + dy * k)] = T_FLOOR;
    t[idx(fx + dx, fy + dy)] = T_CRACK;
    secrets.push({ x: cx, y: cy });
  }

  // 8) 몬스터 진영: 지역별로 종류가 몰려 있다 (어디에 무엇이 사는지 탐험으로 알아냄)
  const order = [...zone.pool];
  for (let i = order.length - 1; i > 0; i--) { const j = rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  const camps = [];
  const cands = [];
  for (let i = 0; i < t.length; i++) if (t[i] === T_FLOOR && dist[i] > 16) cands.push(i);
  for (let a = 0; a < 3000 && camps.length < 15; a++) {
    const i = cands[rng.int(0, cands.length - 1)];
    const x = i % tw, y = (i / tw) | 0;
    if (Math.hypot(x - lair.x, y - lair.y) < 12) continue;
    if (camps.some((c) => Math.hypot(c.x - x, c.y - y) < 10)) continue;
    const band = Math.min(order.length - 1, Math.floor((y / th) * order.length));
    const type = rng.chance(0.2) ? rng.pick(order) : order[band];
    camps.push({ x, y, type, n: rng.int(3, 5) });
  }

  // 9) 상자 (막다른 곳 선호) / 석판
  const chests = secrets.map((s) => ({ x: s.x, y: s.y, rich: true }));
  const nook = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== T_FLOOR || dist[i] < 14) continue;
    const x = i % tw, y = (i / tw) | 0;
    let w = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (get(x + dx, y + dy) === T_WALL) w++;
    if (w >= 5) nook.push({ x, y });
  }
  for (let a = 0; a < 800 && chests.length < 7; a++) {
    const c = rng.pick(nook);
    if (c && !chests.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 12)) chests.push({ ...c, rich: false });
  }
  const lores = [];
  for (let a = 0; a < 800 && lores.length < 3; a++) {
    const i = cands[rng.int(0, cands.length - 1)];
    const x = i % tw, y = (i / tw) | 0;
    if ([...lores, ...chests, ...camps].some((o) => Math.hypot(o.x - x, o.y - y) < 7)) continue;
    lores.push({ x, y });
  }

  // 10) 장식
  const deco = [];
  for (let i = 0; i < t.length; i++) {
    if ((t[i] !== T_FLOOR) || !rng.chance(0.07)) continue;
    const x = i % tw, y = (i / tw) | 0;
    if (Math.hypot(x - start.x, y - start.y) < 3) continue;
    deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: rng.pick(zone.deco), v: rng.int(0, 3) });
  }

  return { tw, th, tiles: t, start, lair, camps, chests, lores, secrets, deco };

  function carve(cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 2 || y < 2 || x >= tw - 2 || y >= th - 2) continue;
      if (Math.hypot(x - cx, y - cy) <= r + 0.3) t[idx(x, y)] = T_FLOOR;
    }
  }
  function bfs(sx, sy) {
    const d = new Int32Array(tw * th).fill(-1);
    const q = [idx(sx, sy)]; d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % tw, y = (i / tw) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (d[j] < 0 && (t[j] === T_FLOOR || t[j] === T_LIQUID)) { d[j] = d[i] + 1; q.push(j); }
      }
    }
    return d;
  }
}

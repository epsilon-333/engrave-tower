// 필드 맵 생성 (시드 기반). 타일: 0 바닥, 1 벽, 2 특수 지형(밟을 수 있음), 3 균열 벽(부술 수 있음), 4 건물(광장)
// 큰 동굴 하나를 이름 있는 구역 4개로 나누고, 구역마다 사는 몬스터가 다르다.
import { createRng } from './rng.js';

export const TILE = 16;
export const T_FLOOR = 0, T_WALL = 1, T_LIQUID = 2, T_CRACK = 3, T_BUILD = 4, T_GATE = 5, T_DEEP = 6; // T_DEEP: 깊은 물 (못 걷는다, 얼리면 걸을 수 있다) // T_GATE: 길을 막는 것(덩굴·철창·바위) — 못 지나가지만 바닥으로 그린다
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function generateField(zone, seed, depth = 0) {
  const rng = createRng((seed ^ 0x5eed) + depth * 7777);
  const tw = 168, th = 110;
  const t = new Uint8Array(tw * th);
  const idx = (x, y) => y * tw + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < tw && y < th;
  const get = (x, y) => (inb(x, y) ? t[idx(x, y)] : T_WALL);

  // 1) 셀룰러 오토마타 동굴 (조금 더 넓은 통로)
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    t[idx(x, y)] = x < 2 || y < 2 || x >= tw - 2 || y >= th - 2 ? T_WALL : rng.next() < 0.45 ? T_WALL : T_FLOOR;
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
  // 큰 방(광장형 공간) 몇 개를 뚫어 지형에 리듬을 준다
  for (let i = 0; i < 7; i++) {
    const cx = rng.int(12, tw - 13), cy = rng.int(10, th - 11), rx = rng.int(5, 9), ry = rng.int(4, 7);
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + rng.range(-0.1, 0.1) && x > 2 && y > 2 && x < tw - 3 && y < th - 3) t[idx(x, y)] = T_FLOOR;
    }
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
  for (let i = 0; i < 14; i++) {
    const cx = rng.int(6, tw - 7), cy = rng.int(6, th - 7), r = rng.range(2, 6);
    for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
      if (!inb(x, y) || t[idx(x, y)] !== T_FLOOR) continue;
      const d = Math.hypot(x - cx, (y - cy) * 1.2) + rng.range(-0.8, 0.8);
      if (d < r && Math.hypot(x - start.x, y - start.y) > 7) t[idx(x, y)] = T_LIQUID;
    }
  }

  // 5) 시작점에서 거리
  const dist = bfs([idx(start.x, start.y)]);

  // 6) 정예 둥지: 가장 먼 곳
  let lair = start, far = 0;
  for (let i = 0; i < t.length; i++) if (dist[i] > far && t[i] === T_FLOOR) { far = dist[i]; lair = { x: i % tw, y: (i / tw) | 0 }; }
  carve(lair.x, lair.y, 5);

  // 7) 구역 4개: 시작점에서의 거리 순으로 씨앗을 고르고, 바닥을 가장 가까운 씨앗에 붙인다
  const seeds = [idx(start.x, start.y)];
  while (seeds.length < 4) {
    const dmin = bfs(seeds);
    let bi = -1, bv = -1;
    for (let i = 0; i < t.length; i++) if (dmin[i] > bv && t[i] === T_FLOOR) { bv = dmin[i]; bi = i; }
    seeds.push(bi);
  }
  const regions = new Int8Array(tw * th).fill(-1);
  {
    const q = [];
    seeds.forEach((s, r) => { regions[s] = r; q.push(s); });
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % tw, y = (i / tw) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (regions[j] < 0 && t[j] !== T_WALL) { regions[j] = regions[i]; q.push(j); }
      }
    }
  }
  const names = zone.regions || ['구역 1', '구역 2', '구역 3', '구역 4'];
  const regionInfo = seeds.map((s, r) => ({ name: names[r % names.length], x: s % tw, y: (s / tw) | 0 }));
  // 구역마다 사는 몬스터 3종 (겹치기도 함)
  const pool = [...zone.pool];
  for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  regionInfo.forEach((r, i) => { r.types = [pool[i % pool.length], pool[(i + 2) % pool.length], pool[(i + 4) % pool.length]]; });

  // 8) 비밀방 (균열 벽 뒤)
  const secrets = [];
  for (let a = 0; a < 12000 && secrets.length < 4; a++) {
    const fx = rng.int(3, tw - 4), fy = rng.int(3, th - 4);
    if (t[idx(fx, fy)] !== T_FLOOR || dist[idx(fx, fy)] < 12) continue;
    const [dx, dy] = rng.pick(DIRS4);
    const L = rng.int(3, 6);
    let ok = get(fx + dx, fy + dy) === T_WALL;
    const cx = fx + dx * L, cy = fy + dy * L;
    for (let y = cy - 2; y <= cy + 2 && ok; y++) for (let x = cx - 2; x <= cx + 2 && ok; x++) if (x < 1 || y < 1 || x >= tw - 1 || y >= th - 1 || get(x, y) !== T_WALL) ok = false;
    for (let k = 2; k < L - 1 && ok; k++) {
      const x = fx + dx * k, y = fy + dy * k;
      if (get(x, y) !== T_WALL || get(x + dy, y + dx) !== T_WALL || get(x - dy, y - dx) !== T_WALL) ok = false;
    }
    if (!ok || secrets.some((s) => Math.hypot(s.x - cx, s.y - cy) < 18)) continue;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) t[idx(x, y)] = T_FLOOR;
    for (let k = 2; k < L - 1; k++) t[idx(fx + dx * k, fy + dy * k)] = T_FLOOR;
    t[idx(fx + dx, fy + dy)] = T_CRACK;
    secrets.push({ x: cx, y: cy });
  }

  // 9) 몬스터 무리: 구역의 몬스터 종류로 채운다. 구역마다 우두머리 1
  const camps = [];
  const cands = [];
  for (let i = 0; i < t.length; i++) if (t[i] === T_FLOOR && dist[i] > 14) cands.push(i);
  const taken = [];
  const free = (x, y, r) => !taken.some((o) => Math.hypot(o.x - x, o.y - y) < r);
  for (let a = 0; a < 8000 && camps.length < 40; a++) {
    const i = cands[rng.int(0, cands.length - 1)];
    const x = i % tw, y = (i / tw) | 0;
    if (Math.hypot(x - lair.x, y - lair.y) < 12 || !free(x, y, 9)) continue;
    const r = regionInfo[regions[i]] || regionInfo[0];
    camps.push({ x, y, type: rng.pick(r.types), n: rng.int(3, 5), region: regions[i] });
    taken.push({ x, y });
  }
  const champions = [];
  regionInfo.forEach((r, ri) => {
    if (ri === 0) return; // 시작 구역은 우두머리 없음
    for (let a = 0; a < 2000; a++) {
      const i = cands[rng.int(0, cands.length - 1)];
      if (regions[i] !== ri) continue;
      const x = i % tw, y = (i / tw) | 0;
      if (!free(x, y, 8) || Math.hypot(x - lair.x, y - lair.y) < 14) continue;
      carve(x, y, 3);
      champions.push({ x, y, type: rng.pick(r.types), region: ri });
      taken.push({ x, y });
      break;
    }
  });

  // 10) 상자 (막다른 곳 선호, 일부는 함정) / 석판 / 야영지 / 상인 / 제단 / 계단
  const chests = secrets.map((s) => ({ x: s.x, y: s.y, rich: true }));
  const nook = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== T_FLOOR || dist[i] < 14) continue;
    const x = i % tw, y = (i / tw) | 0;
    let w = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (get(x + dx, y + dy) === T_WALL) w++;
    if (w >= 5) nook.push({ x, y });
  }
  for (let a = 0; a < 2000 && chests.length < 16; a++) {
    const c = rng.pick(nook);
    if (c && !chests.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 12)) chests.push({ ...c, rich: false, trap: rng.chance(0.25) });
  }
  const place = (n, minStart, minGap, list = []) => {
    for (let a = 0; a < 3000 && list.length < n; a++) {
      const i = cands[rng.int(0, cands.length - 1)];
      if (dist[i] < minStart) continue;
      const x = i % tw, y = (i / tw) | 0;
      if (!free(x, y, minGap) || chests.some((o) => Math.hypot(o.x - x, o.y - y) < 6)) continue;
      list.push({ x, y, region: regions[i] }); taken.push({ x, y });
    }
    return list;
  };
  const lores = place(5, 20, 7);
  const camp = place(2, Math.floor(far * 0.35), 10);
  for (const c of camp) carve(c.x, c.y, 2);
  const merchant = place(1, 25, 8);
  const shrines = place(2, 18, 8);
  const goblins = place(2, 25, 8);
  const stairs = { x: lair.x + 3, y: lair.y };
  if (get(stairs.x, stairs.y) !== T_FLOOR) { stairs.x = lair.x; stairs.y = lair.y + 3; }

  // 11) 장식
  const deco = [];
  for (let i = 0; i < t.length; i++) {
    if ((t[i] !== T_FLOOR) || !rng.chance(0.06)) continue;
    const x = i % tw, y = (i / tw) | 0;
    if (Math.hypot(x - start.x, y - start.y) < 3) continue;
    deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: rng.pick(zone.deco), v: rng.int(0, 3) });
  }

  return { tw, th, tiles: t, start, lair, camps, champions, chests, lores, secrets, deco, regions, regionInfo, camp, merchant, shrines, goblins, stairs };

  function carve(cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 2 || y < 2 || x >= tw - 2 || y >= th - 2) continue;
      if (Math.hypot(x - cx, y - cy) <= r + 0.3) t[idx(x, y)] = T_FLOOR;
    }
  }
  function bfs(starts) {
    const d = new Int32Array(tw * th).fill(-1);
    const q = [...starts]; for (const s of starts) d[s] = 0;
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

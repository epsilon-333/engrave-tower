// 탑 등반의 층 지도: 싸움터(동굴 방) · 수호자 · 주인의 방(보스마다 다른 결투장)
// 들어오는 자리는 아래쪽 가운데, 다음 층으로 가는 문은 위쪽에 한 줄로. 가운데에 보상이 나타난다.
// 51~100층 구역은 장치가 지도에 들어 있다: 하늘(가장자리 · 구멍 = 하늘) · 시계탑(톱니 바닥) · 서고(책장 · 별자리) · 정상(빛기둥)
import { createRng } from './rng.js';
import { TILE, T_FLOOR, T_WALL, T_LIQUID } from './mapgen.js';
import { actOf } from '../data/climb.js';

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
  // 바깥 테두리는 벽 (하늘 정원은 하늘 — 섬이 떠 있다)
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (x < 2 || y < 2 || x >= tw - 2 || y >= th - 2) t[idx(x, y)] = extra.sky ? T_LIQUID : T_WALL;
  // 시작점에서 닿지 않는 바닥은 벽으로 (문 · 보상 자리는 꼭 닿게 먼저 길을 판다)
  const dist = new Int32Array(tw * th).fill(-1), q = [idx(start.x, start.y)]; dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % tw, y = (i / tw) | 0;
    for (const [dx, dy] of DIRS4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (dist[j] < 0 && t[j] !== T_WALL) { dist[j] = dist[i] + 1; q.push(j); } }
  }
  for (let i = 0; i < t.length; i++) if (t[i] !== T_WALL && dist[i] < 0) t[i] = T_WALL;
  const feats = extra.feats || {};
  const onBelt = (x, y) => (feats.belts || []).some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
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
    if (onBelt(x, y) || Math.hypot(x - start.x, y - start.y) < 3 || Math.hypot(x - center.x, y - center.y) < 3 || doors.some((d) => Math.abs(d.x - x) < 2 && Math.abs(d.y - y) < 2)) continue;
    deco.push({ x: x * TILE + rng.int(2, 13), y: y * TILE + rng.int(4, 14), kind: rng.pick(zone.deco), v: rng.int(0, 3) });
  }
  const name = extra.name || (kind === 'guardian' ? '수호자의 방' : kind === 'lord' ? '주인의 방' : kind === 'shop' ? '상인의 방' : kind === 'altar' ? '제단의 방' : kind === 'rest' ? '쉼터' : `${f}층`);
  return {
    tw, th, tiles: t, start, lair: extra.lair || center, stairs: null,
    camps: [], champions: [], chests: [], lores: [], secrets: [], deco, regions: null, regionInfo: [{ name, types: [] }],
    camp: [], merchant: [], shrines: [], goblins: [], objects: [], noPortal: true, nodes: [], digs: [], // 캐기 · 파기 자리는 없다
    palace: extra.palace || null, // 왕좌 · 붉은 비단길 (각인의 왕 · 마지막 왕)
    climb: { kind, spawns, center, doors, dist, ...feats },
  };
}

// ───── 구역 장치를 지도에 넣는다 ─────
// 하늘: 바닥 밖은 모두 하늘(발밑이 없는 곳) — 떠 있는 섬처럼 보인다 (기둥은 그 뒤에 세운다)
function skyAll(M) {
  const { t } = M;
  for (let i = 0; i < t.length; i++) if (t[i] === T_WALL) t[i] = T_LIQUID;
}
// 톱니 바닥: 가로 띠 (dx: 실어 가는 쪽)
function addBelt(M, feats, x0, x1, y0, y1, dx, dy = 0) {
  const { t, idx, inb } = M;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y) && t[idx(x, y)] !== T_FLOOR) return false;
  (feats.belts ||= []).push({ x0, x1, y0, y1, dx, dy });
  return true;
}
// 책장: 한 줄 벽 (물결마다 옆으로 옮겨진다 · 끝이 언제나 트여 있어 돌아갈 수 있다)
function addShelf(M, feats, y, x0, len) {
  const { t, idx, inb } = M;
  for (let x = x0 - 3; x <= x0 + len + 2; x++) for (let yy = y - 1; yy <= y + 1; yy++) if (!inb(x, yy) || t[idx(x, yy)] !== T_FLOOR) return false;
  for (let x = x0; x < x0 + len; x++) t[idx(x, y)] = T_WALL;
  (feats.shelves ||= []).push({ y, x0, len });
  return true;
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
  const sky = zone.gimmick === 'gust';
  if (sky) skyAll(M);
  // 기둥: 가운데 · 시작점 · 문 둘레는 비운다
  const center = { x: cx, y: cy };
  const pillars = rng.int(3, 6) + (zone.gimmick === 'mirror' ? 3 : 0); // 거울 미궁: 튕겨 낼 거울 기둥이 더 많다
  for (let a = 0, made = 0; a < 200 && made < pillars; a++) {
    const x = rng.int(4, tw - 5), y = rng.int(top + 7, th - 7), r = rng.chance(0.5) ? 1 : 1.6;
    if (Math.hypot(x - cx, y - cy) < 6 || Math.hypot(x - start.x, y - start.y) < 6 || t[idx(x, y)] !== T_FLOOR) continue;
    for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (inb(xx, yy) && Math.hypot(xx - x, yy - y) <= r) t[idx(xx, yy)] = T_WALL;
    made++;
  }
  // 웅덩이 (구역의 액체: 물 · 용암 · 눈 · 안개 · 하늘 · 기름 · 먹)
  for (let a = 0, made = 0, want = rng.int(1, 3); a < 200 && made < want; a++) {
    const x = rng.int(5, tw - 6), y = rng.int(top + 7, th - 7), r = rng.range(1.6, 3);
    if (Math.hypot(x - cx, y - cy) < 6 || Math.hypot(x - start.x, y - start.y) < 7) continue;
    let ok = true;
    for (let yy = Math.floor(y - r); yy <= y + r && ok; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (!inb(xx, yy) || t[idx(xx, yy)] !== T_FLOOR && Math.hypot(xx - x, yy - y) <= r) { ok = false; break; }
    if (!ok) continue;
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (Math.hypot(xx - x, (yy - y) * 1.2) <= r) t[idx(xx, yy)] = T_LIQUID;
    made++;
  }
  const feats = {};
  const g = zone.gimmick;
  if (g === 'clock') { // 톱니 바닥 띠 둘~셋 (번갈아 반대쪽으로)
    let dir = rng.chance(0.5) ? 1 : -1;
    for (let a = 0, made = 0, want = rng.int(2, 3); a < 60 && made < want; a++) {
      const len = rng.int(8, 14), y0 = rng.int(top + 8, th - 9), x0 = rng.int(4, tw - 5 - len);
      if (Math.abs(y0 - cy) < 2 || (feats.belts || []).some((b) => Math.abs(b.y0 - y0) < 4)) continue;
      if (addBelt(M, feats, x0, x0 + len - 1, y0, y0 + 1, dir)) { made++; dir = -dir; }
    }
  }
  if (g === 'library') { // 책장 줄 · 별자리 장판
    for (let a = 0, made = 0, want = rng.int(2, 3); a < 80 && made < want; a++) {
      const len = rng.int(7, 11), y = rng.int(top + 8, th - 8), x0 = rng.int(4, tw - 5 - len);
      if (Math.abs(y - cy) < 2 || Math.abs(y - start.y) < 4 || (feats.shelves || []).some((s) => Math.abs(s.y - y) < 4)) continue;
      if (x0 <= cx + 2 && x0 + len >= cx - 2 && y > cy) continue; // 들어오는 길은 막지 않는다
      if (addShelf(M, feats, y, x0, len)) made++;
    }
    starSpots(M, rng, feats, 2, cx, cy, start);
  }
  if (g === 'light') pillarSpots(M, rng, feats, 3, cx, cy, start);
  return finish(M, zone, rng, f, kind, start, center, doors, { feats, sky });
}

// 별자리 장판: 트인 바닥에 반경 2.5칸
function starSpots(M, rng, feats, n, cx, cy, start, at = null) {
  const { t, idx } = M;
  for (let a = 0, made = 0; a < 200 && made < n; a++) {
    const p = at ? at[made] : { x: rng.int(5, M.tw - 6), y: rng.int(12, M.th - 7) };
    if (!p) break;
    if (!at && (Math.hypot(p.x - start.x, p.y - start.y) < 6 || (feats.stars || []).some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 8))) continue;
    let ok = true; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (t[idx(p.x + dx, p.y + dy)] !== T_FLOOR) { ok = false; break; }
    if (!ok && !at) continue;
    (feats.stars ||= []).push({ x: p.x, y: p.y, r: 2.5 }); made++;
  }
}
// 빛기둥 자리 (G로 깨운다)
function pillarSpots(M, rng, feats, n, cx, cy, start, at = null) {
  const { t, idx } = M;
  for (let a = 0, made = 0; a < 200 && made < n; a++) {
    const p = at ? at[made] : { x: rng.int(5, M.tw - 6), y: rng.int(12, M.th - 7) };
    if (!p) break;
    if (!at && (Math.hypot(p.x - start.x, p.y - start.y) < 6 || Math.hypot(p.x - cx, p.y - cy) < 4 || (feats.pillars || []).some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 10))) continue;
    if (t[idx(p.x, p.y)] !== T_FLOOR) { if (at) made++; continue; }
    (feats.pillars ||= []).push({ x: p.x, y: p.y }); made++;
  }
}

// ───── 수호자 · 주인의 방: 보스마다 다른 결투장 ─────
function bossRoom(zone, rng, f, kind) {
  const act = actOf(f), bossId = kind === 'lord' ? act.lord : act.guardian;
  const tw = kind === 'lord' ? 50 : 44, th = kind === 'lord' ? 40 : 36;
  const M = base(tw, th), { t, idx, inb } = M;
  const cx = tw / 2, cy = th / 2 + 3, rx = tw / 2 - 3, ry = th / 2 - 6, ix = Math.floor(cx);
  const A = {
    M, rng, tw, th, cx, cy, rx, ry, ix, kind, feats: {}, lair: { x: ix, y: Math.floor(cy - ry * 0.35) }, name: null, palace: null,
    set: (x, y, v) => { x = Math.round(x); y = Math.round(y); if (inb(x, y) && x > 1 && y > 1 && x < tw - 2 && y < th - 2) t[idx(x, y)] = v; },
    get: (x, y) => (inb(Math.round(x), Math.round(y)) ? t[idx(Math.round(x), Math.round(y))] : T_WALL),
    ell: (ex, ey, erx, ery, v, wob = 0) => { // 타원 (가장자리를 조금 울퉁불퉁하게)
      const p0 = rng.range(0, 6);
      for (let y = Math.floor(ey - ery - 2); y <= ey + ery + 2; y++) for (let x = Math.floor(ex - erx - 2); x <= ex + erx + 2; x++) {
        const a = Math.atan2(y + 0.5 - ey, x + 0.5 - ex), n = 1 + wob * Math.sin(a * 5 + p0);
        if (((x + 0.5 - ex) / erx) ** 2 + ((y + 0.5 - ey) / ery) ** 2 <= n * n) A.set(x, y, v);
      }
    },
    rect: (x0, y0, w, h, v) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) A.set(x, y, v); },
    disc: (x, y, r, v) => { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (Math.hypot(xx - x, yy - y) <= r) A.set(xx, yy, v); },
    lane: (x, y) => Math.abs(x - ix) <= 2 && y >= cy - ry * 0.35 - 2, // 들어오는 길 · 보스 앞은 비운다
    shift: (n, list) => { ((A.feats.shifts ||= {})[n] ||= []).push(...list); }, // 단계가 바뀔 때 바뀌는 칸
  };
  (ARENAS[bossId] || arenaRound)(A);
  const start = { x: ix, y: th - 4 };
  for (let y = Math.floor(cy); y <= start.y + 1; y++) for (let x = ix - 2; x <= ix + 2; x++) t[idx(x, y)] = T_FLOOR; // 들어오는 길 (물 · 용암 · 하늘 위로는 다리)
  const top = 6;
  const doors = doorYard(M, ix, top);
  for (let y = top + 3; y <= cy; y++) for (let x = ix - 2; x <= ix + 2; x++) if (t[idx(x, y)] === T_WALL || (A.sky && t[idx(x, y)] === T_LIQUID)) t[idx(x, y)] = T_FLOOR;
  if (A.sky) skyAll(M);
  for (let y = A.lair.y - 1; y <= A.lair.y + 1; y++) for (let x = A.lair.x - 1; x <= A.lair.x + 1; x++) t[idx(x, y)] = T_FLOOR;
  if (A.feats.shifts) for (const k of Object.keys(A.feats.shifts)) A.feats.shifts[k] = A.feats.shifts[k].filter((i) => { const x = i % tw, y = (i / tw) | 0; return !(Math.abs(x - ix) <= 2 && (y >= cy || y <= top + 5)) && Math.hypot(x - A.lair.x, y - A.lair.y) > 2; });
  const center = { x: ix, y: Math.floor(cy) };
  return finish(M, zone, rng, f, kind, start, center, doors, { lair: A.lair, feats: A.feats, name: A.name, palace: A.palace, sky: A.sky });
}

// 기둥 넷이 있는 둥근 방 (예전 그대로 · 정해진 결투장이 없는 보스)
function arenaRound(A) {
  A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR);
  for (const [ox, oy] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.4], [0.55, 0.4]]) A.disc(A.cx + ox * A.rx, A.cy + oy * A.ry, 1.2, T_WALL);
}
// 기둥 n개를 원 둘레에
function ringPillars(A, n, k, r = 1.2, a0 = 0) {
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2, x = A.cx + Math.cos(a) * A.rx * k, y = A.cy + Math.sin(a) * A.ry * k; if (!A.lane(x, y)) A.disc(x, y, r, T_WALL); }
}
const tilesOf = (A, test) => { const out = []; for (let y = 2; y < A.th - 2; y++) for (let x = 2; x < A.tw - 2; x++) if (test(x, y)) out.push(A.M.idx(x, y)); return out; };

const ARENAS = {
  // 1~10 이끼 굴
  climbChief(A) { // 고블린 야영지: 나무 울타리 고리(틈 넷) · 천막 넷 — 돌격을 울타리로 유도하면 기절
    A.name = '고블린 야영지';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0.08);
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2, gap = Math.abs(Math.sin(a * 2)) < 0.22; if (gap) continue; const x = A.cx + Math.cos(a) * A.rx * 0.72, y = A.cy + Math.sin(a) * A.ry * 0.72; if (!A.lane(x, y)) A.set(x, y, T_WALL); }
    for (const [ox, oy] of [[-0.42, -0.15], [0.42, -0.15], [-0.36, 0.38], [0.36, 0.38]]) { const x = Math.round(A.cx + ox * A.rx), y = Math.round(A.cy + oy * A.ry); A.rect(x - 1, y - 1, 3, 2, T_WALL); }
  },
  mossLord(A) { // 고목의 뿌리방: 굽이진 뿌리 벽 · 물웅덩이 — 2단계에 물이 차오르고 3단계에 뿌리가 썩어 웅덩이가 넓어진다
    A.name = '고목의 뿌리방';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0.14);
    for (let k = 0; k < 6; k++) { // 뿌리: 가장자리에서 안쪽으로 굽이치며 들어온다
      let a = (k / 6) * Math.PI * 2 + A.rng.range(-0.2, 0.2), d = 0.95;
      for (let s = 0; s < 9; s++) { const x = A.cx + Math.cos(a) * A.rx * d, y = A.cy + Math.sin(a) * A.ry * d; if (!A.lane(x, y)) A.disc(x, y, 0.8, T_WALL); d -= 0.06; a += A.rng.range(-0.18, 0.18); }
    }
    for (const [ox, oy] of [[-0.45, 0.1], [0.45, 0.1], [0, -0.55]]) A.disc(A.cx + ox * A.rx, A.cy + oy * A.ry, 2.2, T_LIQUID);
    A.shift(1, tilesOf(A, (x, y) => A.get(x, y) === T_FLOOR && [[-0.45, 0.1], [0.45, 0.1], [0, -0.55]].some(([ox, oy]) => { const d = Math.hypot(x - (A.cx + ox * A.rx), y - (A.cy + oy * A.ry)); return d > 2.2 && d <= 3.6; })));
    A.shift(2, tilesOf(A, (x, y) => A.get(x, y) === T_FLOOR && [[-0.45, 0.1], [0.45, 0.1], [0, -0.55]].some(([ox, oy]) => { const d = Math.hypot(x - (A.cx + ox * A.rx), y - (A.cy + oy * A.ry)); return d > 3.6 && d <= 4.8; })));
  },
  // 11~20 독늪
  bogHag(A) { // 가라앉은 사원: 물에 잠긴 방 · 십자 돌길 · 네 모서리 섬
    A.name = '가라앉은 사원';
    A.rect(4, 9, A.tw - 8, A.th - 13, T_LIQUID);
    A.rect(A.ix - 2, 9, 5, A.th - 13, T_FLOOR); A.rect(5, Math.floor(A.cy) - 2, A.tw - 10, 5, T_FLOOR); // 십자 돌길
    for (const [ox, oy] of [[-0.6, -0.45], [0.6, -0.45], [-0.6, 0.5], [0.6, 0.5]]) { A.ell(A.cx + ox * A.rx, A.cy + oy * A.ry, 4, 3, T_FLOOR); A.disc(A.cx + ox * A.rx, A.cy + oy * A.ry, 0.8, T_WALL); }
    A.ell(A.lair.x + 0.5, A.lair.y + 0.5, 4, 3, T_FLOOR);
  },
  climbQueen(A) { // 늪의 한가운데: 가운데 섬 · 물 고리 · 다리 넷 — 3단계에 섬 가장자리가 가라앉는다
    A.name = '늪의 한가운데';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0.06);
    A.ell(A.cx, A.cy, A.rx * 0.78, A.ry * 0.78, T_LIQUID);
    A.ell(A.cx, A.cy, A.rx * 0.55, A.ry * 0.55, T_FLOOR);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (let d = 0.5; d <= 0.82; d += 0.04) { const x = A.cx + Math.cos(a) * A.rx * d, y = A.cy + Math.sin(a) * A.ry * d; A.disc(x, y, 1.2, T_FLOOR); }
    A.shift(2, tilesOf(A, (x, y) => { const k = Math.hypot((x + 0.5 - A.cx) / A.rx, (y + 0.5 - A.cy) / A.ry); return A.get(x, y) === T_FLOOR && k > 0.44 && k <= 0.55; }));
  },
  // 21~30 화산 균열
  demonCaptain(A) { // 악귀 투기장: 네모난 투기장 · 벽을 따라 도는 용암 도랑 · 방패를 내던질 기둥 넷
    A.name = '악귀 투기장';
    A.rect(4, 9, A.tw - 8, A.th - 13, T_FLOOR);
    for (let y = 9; y < A.th - 4; y++) for (let x = 4; x < A.tw - 4; x++) { const e = Math.min(x - 4, A.tw - 5 - x, y - 9, A.th - 5 - y); if (e <= 1) A.set(x, y, T_LIQUID); }
    for (const [ox, oy] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.35], [0.45, 0.35]]) A.rect(Math.round(A.cx + ox * A.rx) - 1, Math.round(A.cy + oy * A.ry) - 1, 2, 2, T_WALL);
    A.shift(2, tilesOf(A, (x, y) => { const e = Math.min(x - 4, A.tw - 5 - x, y - 9, A.th - 5 - y); return A.get(x, y) === T_FLOOR && e === 2; }));
  },
  climbRift(A) { // 균열의 심장: 가운데에서 뻗은 용암 균열 여섯 — 단계마다 균열이 넓어진다
    A.name = '균열의 심장';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0.1);
    const arms = []; for (let i = 0; i < 6; i++) arms.push((i / 6) * Math.PI * 2 + 0.26);
    const crack = (w0, w1) => tilesOf(A, (x, y) => { const dx = x + 0.5 - A.cx, dy = (y + 0.5 - A.cy) * (A.rx / A.ry), d = Math.hypot(dx, dy); if (d < 4 || d > A.rx * 0.95) return false; return arms.some((a) => { const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - a), Math.cos(Math.atan2(dy, dx) - a))); const off = d * Math.sin(da); return da < 1.2 && off >= w0 && off < w1; }) && A.get(x, y) === T_FLOOR; });
    for (const i of crack(0, 0.7)) A.M.t[i] = T_LIQUID;
    A.shift(1, crack(0.7, 1.4)); A.shift(2, crack(1.4, 2.1));
  },
  // 31~40 서리 회랑
  frostOgre(A) { // 빙하 동굴: 얼음 기둥 여덟 (손아귀 사슬을 끊을 엄폐) · 눈 쌓인 바닥
    A.name = '빙하 동굴';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0.16);
    ringPillars(A, 8, 0.62, 1.3, 0.4);
    for (let i = 0; i < 5; i++) A.disc(A.cx + A.rng.range(-0.7, 0.7) * A.rx, A.cy + A.rng.range(-0.5, 0.6) * A.ry, A.rng.range(1.8, 2.8), T_LIQUID);
  },
  climbWitch(A) { // 서리 궁전: 좌우 대칭 얼음 기둥 두 줄 · 가운데 눈길
    A.name = '서리 궁전';
    A.rect(5, 9, A.tw - 10, A.th - 13, T_FLOOR);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) A.rect(Math.round(A.cx + sx * A.rx * 0.5) - 1, 12 + k * 7, 2, 2, T_WALL);
    A.rect(A.ix - 4, 10, 9, A.th - 15, T_LIQUID); A.rect(A.ix - 2, 10, 5, A.th - 15, T_FLOOR);
  },
  // 41~50 그림자 묘지
  wraithLord(A) { // 기사단 묘역: 줄지어 선 무덤 (1×2 벽) · 안개 웅덩이
    A.name = '기사단 묘역';
    A.rect(4, 9, A.tw - 8, A.th - 13, T_FLOOR);
    for (let y = 12; y < A.th - 7; y += 5) for (let x = 7; x < A.tw - 7; x += 6) { if (A.lane(x, y) || A.lane(x + 1, y)) continue; A.rect(x, y, 2, 1, T_WALL); }
    for (let i = 0; i < 4; i++) A.disc(A.cx + A.rng.range(-0.75, 0.75) * A.rx, A.cy + A.rng.range(-0.4, 0.6) * A.ry, 2, T_LIQUID);
  },
  engraveKing(A) { // 왕좌의 방: 긴 홀 · 기둥 두 줄 · 왕좌로 이어진 붉은 비단길
    A.name = '왕좌의 방';
    A.rect(7, 9, A.tw - 14, A.th - 13, T_FLOOR);
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) A.rect(A.ix + sx * 8 - (sx < 0 ? 1 : 0), 12 + k * 6, 2, 2, T_WALL);
    A.lair = { x: A.ix, y: 14 };
    A.palace = { rugs: [[A.ix - 2, 14, A.ix + 2, A.th - 6]], throne: { x: A.ix, y: 12 } };
  },
  // 51~60 하늘 정원
  stormHarpy(A) { // 떠 있는 섬: 가운데 섬 · 작은 섬 넷 · 좁은 구름다리 — 돌풍에 떨어지지 않게
    A.name = '폭풍의 둥지';
    A.ell(A.cx, A.cy, A.rx * 0.52, A.ry * 0.55, T_FLOOR, 0.12);
    const isl = [[-0.72, -0.3], [0.72, -0.3], [-0.68, 0.48], [0.68, 0.48]];
    for (const [ox, oy] of isl) { const x = A.cx + ox * A.rx, y = A.cy + oy * A.ry; A.ell(x, y, 3.6, 3, T_FLOOR, 0.15); for (let k = 0.2; k <= 0.85; k += 0.05) A.set(A.cx + ox * A.rx * k, A.cy + oy * A.ry * k, T_FLOOR); }
    A.sky = true;
  },
  skyWhale(A) { // 구름 위 큰 섬: 넓은 바닥 · 하늘로 뚫린 구멍 셋 (3단계엔 바닥 절반이 꺼진다 · 기술)
    A.name = '구름 바다';
    A.ell(A.cx, A.cy, A.rx * 0.86, A.ry * 0.86, T_FLOOR, 0.1);
    for (const [ox, oy] of [[-0.45, -0.1], [0.45, -0.1], [0, 0.5]]) A.ell(A.cx + ox * A.rx, A.cy + oy * A.ry, 2.4, 1.8, T_LIQUID, 0.2);
    A.sky = true;
  },
  // 61~70 거울 미궁
  mirrorSelf(A) { // 거울의 방: 팔각 방 · 거울 기둥 여덟 (내 탄도 튕긴다)
    A.name = '거울의 방';
    for (let y = 9; y < A.th - 4; y++) for (let x = 4; x < A.tw - 4; x++) { const dx = Math.abs(x + 0.5 - A.cx) / A.rx, dy = Math.abs(y + 0.5 - A.cy) / A.ry; if (dx <= 1 && dy <= 1 && dx + dy <= 1.38) A.set(x, y, T_FLOOR); }
    ringPillars(A, 8, 0.6, 0.9, Math.PI / 8);
  },
  shardQueen(A) { // 깨진 거울의 홀: 둥근 홀 · 거울 받침 여섯 (여왕이 숨는 자리) · 반사 웅덩이
    A.name = '깨진 거울의 홀';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0.05);
    const spots = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI * 2, x = A.cx + Math.cos(a) * A.rx * 0.58, y = A.cy + Math.sin(a) * A.ry * 0.58; spots.push({ x: Math.round(x), y: Math.round(y) }); }
    A.feats.shardSpots = spots;
    ringPillars(A, 6, 0.84, 1.0, Math.PI / 6);
  },
  // 71~80 태엽 시계탑
  foreman(A) { // 공장 바닥: 가로 톱니 띠 셋 (번갈아 반대쪽) · 증기 기둥 — 감독이 띠 방향을 뒤집는다
    A.name = '증기 공장';
    A.rect(4, 9, A.tw - 8, A.th - 13, T_FLOOR);
    for (const [ox, oy] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.45], [0.6, 0.45]]) A.rect(Math.round(A.cx + ox * A.rx) - 1, Math.round(A.cy + oy * A.ry) - 1, 2, 2, T_WALL);
    let dir = 1; for (const y of [13, Math.floor(A.cy) + 1, A.th - 9]) { addBelt(A.M, A.feats, 7, A.tw - 8, y, y + 1, dir); dir = -dir; }
  },
  clockKeeper(A) { // 시계 문자판: 둥근 방 · 숫자 자리 열두 기둥 · 가운데에서 도는 두 바늘(톱니 띠)
    A.name = '멈춘 시계의 문자판';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0);
    ringPillars(A, 12, 0.9, 0.7, -Math.PI / 2 + Math.PI / 12);
    addBelt(A.M, A.feats, A.ix - 12, A.ix - 5, Math.floor(A.cy) - 5, Math.floor(A.cy) - 4, 1);
    addBelt(A.M, A.feats, A.ix + 5, A.ix + 12, Math.floor(A.cy) + 3, Math.floor(A.cy) + 4, -1);
    A.feats.clockFace = { x: A.cx, y: A.cy, r: Math.min(A.rx, A.ry) * 0.9 };
  },
  // 81~90 별의 서고
  archivist(A) { // 대서고: 긴 책장 줄 넷 (대서고관이 쓰러뜨린다) · 별자리 장판 둘
    A.name = '대서고';
    A.rect(4, 9, A.tw - 8, A.th - 13, T_FLOOR);
    for (const [y, x0, len] of [[13, 8, 11], [13, A.tw - 20, 11], [Math.floor(A.cy) + 5, 8, 11], [Math.floor(A.cy) + 5, A.tw - 20, 11]]) addShelf(A.M, A.feats, y, x0, len);
    starSpots(A.M, A.rng, A.feats, 2, A.ix, A.cy, { x: A.ix, y: A.th - 4 }, [{ x: Math.round(A.cx - A.rx * 0.55), y: Math.floor(A.cy) }, { x: Math.round(A.cx + A.rx * 0.55), y: Math.floor(A.cy) }]);
  },
  starReader(A) { // 천문대: 둥근 방 · 별자리 장판 다섯 (보스도 밟으면 세진다)
    A.name = '천문대';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0.04);
    const at = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * Math.PI * 2 + 0.3; at.push({ x: Math.round(A.cx + Math.cos(a) * A.rx * 0.6), y: Math.round(A.cy + Math.sin(a) * A.ry * 0.6) }); }
    starSpots(A.M, A.rng, A.feats, 5, A.ix, A.cy, { x: A.ix, y: A.th - 4 }, at);
  },
  // 91~100 빛의 정상
  highPriest(A) { // 빛의 신전: 둥근 신전 · 빛기둥 여섯 (대사제가 하나씩 끈다)
    A.name = '빛의 신전';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0.04);
    const at = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI * 2 + Math.PI / 6; at.push({ x: Math.round(A.cx + Math.cos(a) * A.rx * 0.62), y: Math.round(A.cy + Math.sin(a) * A.ry * 0.62) }); }
    pillarSpots(A.M, A.rng, A.feats, 6, A.ix, A.cy, { x: A.ix, y: A.th - 4 }, at);
    ringPillars(A, 6, 0.9, 0.9, 0);
  },
  lastKing(A) { // 정상의 왕좌: 넓은 둥근 정상 · 8종족의 돌기둥 · 빛기둥 넷 · 왕좌
    A.name = '탑의 정상';
    A.ell(A.cx, A.cy, A.rx, A.ry, T_FLOOR, 0.03);
    ringPillars(A, 8, 0.86, 1.0, Math.PI / 8);
    const at = []; for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * Math.PI * 2; at.push({ x: Math.round(A.cx + Math.cos(a) * A.rx * 0.5), y: Math.round(A.cy + Math.sin(a) * A.ry * 0.5) }); }
    pillarSpots(A.M, A.rng, A.feats, 4, A.ix, A.cy, { x: A.ix, y: A.th - 4 }, at);
    A.lair = { x: A.ix, y: Math.floor(A.cy - A.ry * 0.45) };
    A.palace = { rugs: [[A.ix - 2, A.lair.y + 2, A.ix + 2, A.th - 6]], throne: { x: A.ix, y: A.lair.y - 1 } };
  },
};

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

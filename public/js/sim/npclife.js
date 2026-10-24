// NPC의 하루: 밤에는 자고, 아침엔 동네를 거닐고, 낮엔 자기 일을 하고, 저녁엔 모여 논다 (어떤 날엔 대련).
// 역마차가 마을과 왕도 사이를 오가고, 동네 사람 하나가 타고 다녀온다.
// 설정에서 「NPC 공격」이 켜져 있으면 누구든 때릴 수 있다 — 맞으면 화가 나서 싸우고, 경비는 함께 덤빈다.
import { TILE } from './mapgen.js';

// 자리를 지키는 사람 (가게 · 시설 · 관리) — 낮에는 제자리에서 일한다
const POST = /altar|library|board|shop|store|trainer|merchant|inn|smith|portMaster|shipCaptain|trader|infoMerchant|broker|fence|forger|healer|pitBoss|recruiter|king|guildMaster|auctioneer|shipwright|mercCaptain|keeper|pino|exec|sage|priest|clerk|banker|cook|chef|tailor|jeweler|alchem/i;
const GUARD = /guard|knight|soldier|rebel|sentry|captain|warrior|mercen/i;
export const roleOf = (o) => (GUARD.test(o.art || o.id || '') ? 'guard' : POST.test(o.art || o.id || '') ? 'post' : 'folk');
const H = (n) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };

export function initNpcLife(w) {
  const npcs = w.objects.filter((o) => o.kind === 'npc' && !o.static);
  npcs.forEach((o, i) => {
    o.home = { x: o.x, y: o.y }; o.role = roleOf(o); o.seed = i + 1; o.mv = null; o.act = 'idle';
    const near = npcs.filter((q) => Math.hypot(q.x - o.x, q.y - o.y) < 14 * TILE);
    o.gather = { x: near.reduce((a, q) => a + q.x, 0) / near.length, y: near.reduce((a, q) => a + q.y, 0) / near.length };
  });
  // 대련 짝: 같은 동네의 경비끼리 둘씩
  const guards = npcs.filter((o) => o.role === 'guard');
  for (const o of guards) if (!o.partner) { const q = guards.find((g) => g !== o && !g.partner && Math.hypot(g.x - o.x, g.y - o.y) < 16 * TILE); if (q) { o.partner = q; q.partner = o; o.leadSpar = true; } }
  // 역마차: 바깥 세계에서 마을 ↔ 왕도 남문 (길을 따라)
  const m = w.map;
  if (m.onPath && m.capital?.gates?.s && m.start && w.zone?.id === 'world') {
    const path0 = roadPath(w, m.start, m.capital.gates.s), path = path0 && path0.slice(4); // 정류장은 마을 시작 자리에서 조금 떨어진 길 위
    if (path && path.length > 20) {
      const coach = { kind: 'coach', x: path[0].x, y: path[0].y, path, i: 0, dirn: 1, dir: 1, wait: 0, label: '역마차 타기 (마을 ↔ 왕도 · ◆ 20)', reusable: true, riders: [] };
      w.objects.push(coach); w.coach = coach;
      const d0 = (o) => Math.hypot(o.x - path[0].x, o.y - path[0].y), folk = npcs.filter((o) => o.role !== 'post' && o.role !== 'guard' && d0(o) < 60 * TILE).sort((a, b) => d0(a) - d0(b));
      if (folk.length) folk[0].traveler = true; // 마을 사람 하나가 역마차로 왕도에 다녀온다
    }
  }
}
// 길(onPath) 칸만 밟는 최단 경로
function roadPath(w, a, b) {
  const tw = w.tw, th = w.th, on = w.map.onPath, ax = Math.floor(a.x), ay = Math.floor(a.y), bx = Math.floor(b.x), by = Math.floor(b.y);
  const near = (x, y) => { let best = -1, bd = 1e9; for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= tw || yy >= th || !on[yy * tw + xx]) continue; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = yy * tw + xx; } } return best; };
  const s = near(ax, ay), e = near(bx, by); if (s < 0 || e < 0) return null;
  const x0 = Math.max(0, Math.min(ax, bx) - 30), x1 = Math.min(tw - 1, Math.max(ax, bx) + 30), y0 = Math.max(0, Math.min(ay, by) - 30), y1 = Math.min(th - 1, Math.max(ay, by) + 30);
  return bfs(w, s, e, (n) => on[n]) || bfs(w, s, e, (n) => { const x = n % tw, y = (n / tw) | 0; return x >= x0 && x <= x1 && y >= y0 && y <= y1 && !w.blocked(x * TILE + 8, y * TILE + 8, 5); }); // 길이 끊겨 있으면 걸을 수 있는 땅으로
}
function bfs(w, s, e, ok) {
  const tw = w.tw, th = w.th;
  const prev = new Int32Array(tw * th).fill(-1); prev[s] = s; const q = [s];
  for (let h = 0; h < q.length; h++) { const k = q[h]; if (k === e) break; const x = k % tw, y = (k / tw) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= tw || yy >= th) continue; const n = yy * tw + xx; if (prev[n] >= 0 || !ok(n)) continue; prev[n] = k; q.push(n); } }
  if (prev[e] < 0) return null;
  const out = []; for (let k = e; k !== s; k = prev[k]) out.push({ x: (k % tw) * TILE + 8, y: ((k / tw) | 0) * TILE + 8 }); out.push({ x: (s % tw) * TILE + 8, y: ((s / tw) | 0) * TILE + 8 });
  return out.reverse().filter((_, i, arr) => i % 2 === 0 || i === arr.length - 1);
}

const phaseOf = (min) => (min < 360 || min >= 1320 ? 'sleep' : min < 480 ? 'morning' : min < 1080 ? 'work' : 'leisure');

export function updateNpcLife(w, DT) {
  const p = w.player, min = w.clock?.min ?? 720, day = w.clock?.day ?? 1, ph = phaseOf(min);
  updateCoach(w, DT, min);
  for (const o of w.objects) {
    if (o.kind !== 'npc' || !o.home || o.leaving != null) continue;
    if (o.knockedUntil) { if (w.t < o.knockedUntil) continue; o.knockedUntil = 0; o.away = false; o.x = o.home.x; o.y = o.home.y; o.label = o.label0 || o.label; o.reusable = true; } // 기절했다 돌아온다
    if (o.hostile) { const e = o.hostile; if (e.dead) { o.hostile = null; continue; } o.x = e.x; o.y = e.y; o.act = 'fight'; o.face = e.dir; if (Math.hypot(e.x - p.x, e.y - p.y) > 420) calmDown(w, o); continue; }
    if (o.riding) { o.x = o.riding.x; o.y = o.riding.y; continue; }
    if (o.fleeT > 0) { o.fleeT -= DT; const a = Math.atan2(o.y - p.y, o.x - p.x); step(w, o, o.x + Math.cos(a) * 30, o.y + Math.sin(a) * 30, 60, DT); o.act = 'run'; continue; }
    const talkNear = Math.hypot(p.x - o.x, p.y - o.y) < 26; // 말 걸 수 있게 가까이 오면 멈춰 선다
    o.thinkT = (o.thinkT || 0) - DT;
    if (o.thinkT <= 0) { o.thinkT = 2 + H(o.seed * 31 + Math.floor(w.t)) * 4; plan(w, o, ph, day, min); }
    if (talkNear && o.act !== 'sleep') { o.act = o.act === 'walk' ? 'idle' : o.act; o.face = p.x < o.x ? -1 : 1; continue; }
    if (o.goal) { const arrived = step(w, o, o.goal.x, o.goal.y, o.goal.run ? 46 : 26, DT); if (arrived) { o.act = o.goal.then || 'idle'; if (o.goal.board) boardCoach(w, o); o.goal = null; } else o.act = 'walk'; }
    if (o.act === 'spar' && o.partner && !o.partner.hostile) o.face = o.partner.x < o.x ? -1 : 1;
  }
}
// 무엇을 할지 정한다
function plan(w, o, ph, day, min) {
  const r = (k) => H(o.seed * 97 + Math.floor(w.t / 3) * 13 + k);
  const wander = (rad) => { const a = r(1) * Math.PI * 2, d = (0.3 + r(2) * 0.7) * rad * TILE; return { x: o.home.x + Math.cos(a) * d, y: o.home.y + Math.sin(a) * d * 0.7 }; };
  const coach = w.coach;
  if (o.traveler && coach) { // 역마차 타는 사람: 8시에 마을에서 타고 왕도에 다녀와 17시쯤 돌아온다
    const A = coach.path[0], B = coach.path[coach.path.length - 1];
    if (o.atCapital) {
      if (min >= 930 && min < 1000) { o.goal = { x: B.x, y: B.y, then: 'idle', board: true }; return; }
      if (min >= 1000 || min < 400) { o.atCapital = false; o.x = o.home.x; o.y = o.home.y; } // 놓쳤으면 (밤) 집에 돌아온 것으로
      else { const a = r(3) * Math.PI * 2; o.goal = { x: B.x + Math.cos(a) * 3 * TILE, y: B.y + Math.sin(a) * 2 * TILE, then: r(4) < 0.4 ? 'idle' : 'idle' }; return; }
    } else if (min >= 450 && min < 480) { o.goal = { x: A.x, y: A.y, then: 'idle', board: true }; return; }
  }
  if (ph === 'sleep') { o.goal = Math.hypot(o.x - o.home.x, o.y - o.home.y) > 4 ? { x: o.home.x, y: o.home.y, then: 'sleep' } : null; if (!o.goal) o.act = 'sleep'; return; }
  if (ph === 'morning') { o.goal = r(5) < 0.6 ? { ...wander(o.role === 'post' ? 2 : 4), then: 'idle' } : null; if (!o.goal) o.act = 'idle'; return; }
  if (ph === 'work') {
    if (o.role === 'post') { o.goal = Math.hypot(o.x - o.home.x, o.y - o.home.y) > 4 ? { x: o.home.x, y: o.home.y, then: 'work' } : null; if (!o.goal) o.act = r(6) < 0.7 ? 'work' : 'idle'; return; }
    if (o.role === 'guard') { const side = Math.floor(w.t / 8 + o.seed) % 2 ? 1 : -1; o.goal = { x: o.home.x + side * 4 * TILE, y: o.home.y, then: 'idle' }; return; } // 순찰
    o.goal = r(7) < 0.55 ? { ...wander(5), then: r(8) < 0.5 ? 'work' : 'idle' } : null; if (!o.goal) o.act = r(9) < 0.5 ? 'work' : 'idle'; return;
  }
  // 저녁: 사흘에 한 번은 경비끼리 대련, 아니면 모여서 논다
  if (o.role === 'guard' && o.partner && day % 3 === 0 && !o.partner.hostile) {
    const lead = o.leadSpar ? o : o.partner, cx = lead.gather.x + 30, cy = lead.gather.y + 10;
    o.goal = { x: cx + (o.leadSpar ? -9 : 9), y: cy, then: 'spar' }; return;
  }
  const a = (o.seed * 2.39996) % (Math.PI * 2), rad = 18 + (o.seed % 3) * 6;
  o.goal = { x: o.gather.x + Math.cos(a) * rad, y: o.gather.y + Math.sin(a) * rad * 0.6, then: 'play' };
}
// 한 걸음 (막히면 멈춘다) · 도착하면 true
function step(w, o, tx, ty, sp, DT) {
  const dx = tx - o.x, dy = ty - o.y, l = Math.hypot(dx, dy);
  if (l < 3) return true;
  const s = Math.min(l, sp * DT), nx = o.x + dx / l * s, ny = o.y + dy / l * s;
  o.face = dx < 0 ? -1 : 1;
  if (w.blocked(nx, ny, 4)) { if (!w.blocked(nx, o.y, 4)) o.x = nx; else if (!w.blocked(o.x, ny, 4)) o.y = ny; else { o.goal = null; o.act = 'idle'; return false; } }
  else { o.x = nx; o.y = ny; }
  return false;
}
// 역마차: 08시 마을 출발 → 왕도 남문, 15시 30분쯤 왕도 출발 → 마을
function updateCoach(w, DT, min) {
  const c = w.coach; if (!c) return;
  const going = c.dirn > 0 ? min >= 480 && min < 900 : min >= 960 || min < 300;
  const end = c.dirn > 0 ? c.path.length - 1 : 0;
  c.moving = false;
  if (!going) { if (c.i === 0 && c.dirn < 0) c.dirn = 1; if (c.i === c.path.length - 1 && c.dirn > 0) c.dirn = -1; return; }
  if (c.i === end) { // 도착: 내린다
    for (const o of c.riders) { o.riding = null; o.away = false; o.atCapital = c.dirn > 0; o.x = c.x + 12; o.y = c.y + 6; o.act = 'idle'; o.goal = null; }
    c.riders = []; c.dirn = -c.dirn; return;
  }
  const t = c.path[c.i + c.dirn], dx = t.x - c.x, dy = t.y - c.y, l = Math.hypot(dx, dy), s = 38 * DT;
  if (l <= s) { c.x = t.x; c.y = t.y; c.i += c.dirn; } else { c.x += dx / l * s; c.y += dy / l * s; }
  if (Math.abs(dx) > 0.5) c.dir = dx > 0 ? 1 : -1;
  c.moving = true;
}
function boardCoach(w, o) { const c = w.coach; if (!c || Math.hypot(c.x - o.x, c.y - o.y) > 40) return; o.riding = c; o.away = true; c.riders.push(o); }

// ───────── 공격: 맞으면 화가 나 싸운다 ─────────
const NPC_FOE = (o) => (o.role === 'guard' ? 'royalGuard' : 'townsfolk');
export function provokeNpc(w, o, why = 'hit') {
  if (o.hostile || o.knockedUntil || o.away || !o.home) return;
  const e = w.makeEnemy(NPC_FOE(o), o.x, o.y, { noAffix: true });
  e.npcRef = o; e.state = 'chase'; e.home = { ...o.home }; e.champion = null; e.alert = 9;
  if (o.role === 'post') { e.hp = e.maxHp = Math.round(e.maxHp * 1.4); }
  o.hostile = e; o.label0 ||= o.label; o.reusable = false; o.goal = null; o.riding = null;
  w.enemies.push(e); w.aggro?.(e);
  w.emit({ t: 'text', x: o.x, y: o.y - 26, text: o.role === 'guard' ? '감히!' : '무슨 짓이야!', color: '#ff7a5a' });
  w.signals.push({ t: 'npcHostile', id: o.id, role: o.role, why });
  // 같은 동네 경비는 함께 덤비고, 사람들은 달아난다
  for (const q of w.objects) {
    if (q === o || q.kind !== 'npc' || !q.home || q.hostile || q.knockedUntil || q.away) continue;
    const d = Math.hypot(q.x - o.x, q.y - o.y);
    if (q.role === 'guard' && d < 12 * TILE) provokeNpc(w, q, 'ally');
    else if (d < 9 * TILE) q.fleeT = 6;
  }
}
function calmDown(w, o) { const e = o.hostile; if (e) { e.dead = true; e.gone = true; w.enemies = w.enemies.filter((q) => q !== e); } o.hostile = null; o.reusable = true; o.label = o.label0 || o.label; o.x = o.home.x; o.y = o.home.y; o.act = 'idle'; }
export function npcDown(w, e) {
  const o = e.npcRef; if (!o) return;
  o.hostile = null; o.knockedUntil = w.t + 240; o.away = true; o.reusable = false; // 4분 뒤 돌아온다 (기절)
  w.emit({ t: 'text', x: e.x, y: e.y - 20, text: '쓰러졌다', color: '#c8b8a0' });
  w.signals.push({ t: 'npcDown', id: o.id, role: o.role });
}
// 내 공격이 닿은 곳 근처의 NPC
export function pokeNpcs(w, x, y, r) {
  if (!w.npcAttack) return;
  for (const o of w.objects) if (o.kind === 'happening' && !o.gone && !o.engaged && Math.hypot(o.x - x, o.y - y) <= r + 22) { o.engaged = true; w.signals.push({ t: 'happeningHit', id: o.hid }); }
  for (const o of w.objects) if (o.kind === 'npc' && o.home && !o.hostile && !o.knockedUntil && !o.away && Math.hypot(o.x - x, o.y - y) <= r + 6) provokeNpc(w, o);
}

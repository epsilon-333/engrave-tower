// NPC의 두뇌: 시간표가 없다. 사람마다 성향이 있고, 욕구(배고픔 · 피로 · 사교 · 재미 · 돈)가 차오르면
// 몇 초마다 「지금 무엇이 가장 급한가」를 점수로 따져 할 일을 고른다. 그래서 날마다 · 사람마다 하는 일이 다르다.
// 잠은 자기 집(건물) 안에 들어가서 잔다. 경비는 낮 · 밤 근무조가 교대한다 (밤 근무조는 횃불을 들고 순찰).
// 설정에서 「NPC 공격」이 켜져 있으면 누구든 때릴 수 있다 — 맞으면 화가 나서 싸우고, 경비는 함께 덤빈다.
import { TILE } from './mapgen.js';

// 자리를 지키는 사람 (가게 · 시설 · 관리) · 경비
const POST = /altar|library|board|shop|store|trainer|merchant|inn|smith|portMaster|shipCaptain|trader|infoMerchant|broker|fence|forger|healer|pitBoss|recruiter|king|guildMaster|auctioneer|shipwright|mercCaptain|keeper|pino|exec|sage|priest|clerk|banker|cook|chef|tailor|jeweler|alchem/i;
const GUARD = /guard|knight|soldier|rebel|sentry|captain|warrior|mercen/i;
// 사람: 돌아다니는 NPC + 제자리 사람(가게 · 시설 주인 · 성지 수호자 · 자라 등) — 모두 때릴 수 있다
const PERSON = new Set(['npc', 'station', 'merchant', 'sanctum', 'turtle']);
export const isPerson = (o) => PERSON.has(o.kind);
export const roleOf = (o) => (GUARD.test(o.art || o.id || '') ? 'guard' : POST.test(o.art || o.id || '') ? 'post' : 'folk');
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rnd = (seed, k) => { let x = (Math.imul(seed ^ (k * 0x9e3779b1), 2654435761)) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
const HOUSE = /^house|^wallTower$|^castle$/;
const BARRACKS = /wallTower|castle|house_manor|house_guild|house_dojo/;

export function initNpcLife(w) {
  w.npcInit = true;
  const m = w.map, npcs = w.objects.filter((o) => isPerson(o) && o.leaving == null && !o.home);
  // 모든 사람(돌아다니던 NPC · 가게 · 시설 주인 · 성지 수호자 · 자라)이 두뇌를 가진다
  // 집 = 건물 소품의 문 앞 (아래 가운데)
  const free = (x, y) => { for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const xx = x + dx * TILE, yy = y + dy * TILE; if (!w.blocked(xx, yy, 5)) return { x: xx, y: yy }; } return null; }; // 문 앞의 걸을 수 있는 자리
  const houses = (m.props || []).filter((p) => HOUSE.test(p.kind)).map((p) => { const d = free((p.x + p.w / 2) * TILE, (p.y + p.h) * TILE + 8); return d && { kind: p.kind, ...d }; }).filter(Boolean);
  const nearest = (o, test, max) => { let best = null, bd = max * TILE; for (const h of houses) { if (test && !test.test(h.kind)) continue; const d = Math.hypot(h.x - o.x, h.y - o.y); if (d < bd) { bd = d; best = h; } } return best; };
  npcs.forEach((o, i) => {
    const seed = hashStr(`${o.kind}|${o.id || o.station || o.art}|${i}`);
    o.home = { x: o.x, y: o.y }; o.role = o.kind === 'npc' ? roleOf(o) : o.kind === 'turtle' ? 'folk' : 'post'; o.seed = seed; o.act = 'idle';
    o.homebody = o.kind === 'turtle' || o.kind === 'sanctum'; // 멀리 안 가는 사람 (바닷가 자라 · 성지 수호자)
    if (String(o.id).startsWith('official_')) { o.role = 'post'; o.official = String(o.id).slice(9); o.nightWork = false; } // 고위 관계자: 저택 앞에서 일하고 · 저택에 들어가 자고 · 귀족끼리 어울린다
    // 밤에 장사하는 사람: 장물아비 · 위조꾼 · 정보상 · 떠돌이 상인 · 여관 · 술집, 그리고 상인 몇몇
    o.nightWork = !o.official && o.role === 'post' && (/fence|forger|infoMerchant|rumor|broker|innkeeper|tavern|bartender/i.test(`${o.art || ''} ${o.id || ''} ${o.station || ''}`) || o.kind === 'merchant' || rnd(seed, 14) < 0.15);
    // 성향 (0~1): 성실 · 용감 · 탐욕 · 사교 · 정직 · 왕실 충성
    o.trait = { diligent: rnd(seed, 1), brave: rnd(seed, 2), greedy: rnd(seed, 3), social: rnd(seed, 4), honest: rnd(seed, 5), loyal: rnd(seed, 6) };
    if (o.role === 'guard') { o.trait.brave = 0.4 + o.trait.brave * 0.6; o.trait.loyal = 0.3 + o.trait.loyal * 0.7; }
    // 욕구 (0 = 채워짐, 1 = 급함) · 저마다 다른 데서 시작
    o.need = { hunger: rnd(seed, 7) * 0.6, energy: rnd(seed, 8) * 0.5, social: rnd(seed, 9), fun: rnd(seed, 10) };
    o.coins = Math.round(20 + rnd(seed, 11) * 80);
    o.bed = (o.role === 'guard' ? nearest(o, BARRACKS, 30) : null) || nearest(o, null, 30); // 잘 곳 (없으면 제자리에서 꾸벅꾸벅 선 채로)
    o.night = o.role === 'guard' && rnd(seed, 12) < 0.4; // 밤 근무조
    const near = npcs.filter((q) => Math.hypot(q.x - o.x, q.y - o.y) < 14 * TILE);
    o.gather = { x: near.reduce((a, q) => a + q.x, 0) / near.length, y: near.reduce((a, q) => a + q.y, 0) / near.length };
    o.friends = near.filter((q) => q !== o).sort((a, b) => rnd(seed ^ b.x, 13) - rnd(seed ^ a.x, 13)).slice(0, 3);
    o.mem = (w.npcMem[o.id || o.station || `${o.kind}${Math.round(o.x)}`] ||= { op: 0, knows: {} }); // 나에 대한 생각 (-100 ~ 100) · 알고 있는 내 행동
    if (o.mem.left) { o.away = true; o.reusable = false; o.gone = true; } // 녹타리스로 떠난 사람은 돌아오지 않는다
  });
  // 역마차: 바깥 세계에서 마을 ↔ 왕도 남문 (길을 따라 · 나무를 피해서)
  if (!w.coach && m.onPath && m.capital?.gates?.s && m.start && w.zone?.id === 'world') {
    const path0 = roadPath(w, m.start, m.capital.gates.s), path = path0 && path0.slice(4);
    if (path && path.length > 20) {
      const coach = { kind: 'coach', x: path[0].x, y: path[0].y, path, i: 0, dirn: 1, dir: 1, vy: 0, wait: 0, label: '역마차 타기 (마을 ↔ 왕도 · ◆ 20)', reusable: true, riders: [] };
      w.objects.push(coach); w.coach = coach;
      const d0 = (o) => Math.hypot(o.x - path[0].x, o.y - path[0].y), folk = npcs.filter((o) => o.role === 'folk' && d0(o) < 60 * TILE).sort((a, b) => d0(a) - d0(b));
      if (folk.length) folk[0].traveler = true; // 마을 사람 하나가 가끔 역마차로 왕도에 다녀온다
    }
  }
}

// 역마차 길: 길(onPath)은 싸고, 길이 끊긴 곳은 마차가 지나갈 만큼 넓은 땅만 (나무 · 벽에서 떨어져서) 비싸게
function roadPath(w, a, b) {
  const tw = w.tw, th = w.th, on = w.map.onPath, ax = Math.floor(a.x), ay = Math.floor(a.y), bx = Math.floor(b.x), by = Math.floor(b.y);
  const x0 = Math.max(1, Math.min(ax, bx) - 40), x1 = Math.min(tw - 2, Math.max(ax, bx) + 40), y0 = Math.max(1, Math.min(ay, by) - 40), y1 = Math.min(th - 2, Math.max(ay, by) + 40);
  const busy = new Uint8Array(tw * th); // 모닥불 · 우물 · 표지판 같은 것 둘레 2칸은 피한다 (겹쳐 보이지 않게)
  for (const o of w.objects) { if (o.kind === 'npc' || o.kind === 'coach' || o.kind === 'happening') continue; const ox = Math.floor(o.x / TILE), oy = Math.floor(o.y / TILE); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = ox + dx, yy = oy + dy; if (xx >= 0 && yy >= 0 && xx < tw && yy < th) busy[yy * tw + xx] = 1; } }
  const clear = (x, y) => !busy[y * tw + x] && !w.blocked(x * TILE + 8, y * TILE + 8, 11);
  const cost = (n) => { const x = n % tw, y = (n / tw) | 0; if (x < x0 || x > x1 || y < y0 || y > y1) return 0; if (on[n] && !busy[n] && !w.blocked(x * TILE + 8, y * TILE + 8, 9)) return 1; return clear(x, y) ? 6 : 0; };
  const s = ay * tw + ax, e = by * tw + bx;
  const dist = new Float32Array(tw * th).fill(1e9), prev = new Int32Array(tw * th).fill(-1);
  const buckets = [[s]]; dist[s] = 0;
  for (let c = 0; c < buckets.length && c < 40000; c++) {
    const list = buckets[c]; if (!list) continue;
    for (const k of list) {
      if (dist[k] !== c) continue; if (k === e) { c = 1e9; break; }
      const x = k % tw, y = (k / tw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (y + dy) * tw + x + dx, cc = cost(n); if (!cc) continue; const nd = c + cc; if (nd < dist[n]) { dist[n] = nd; prev[n] = k; (buckets[nd] ||= []).push(n); } }
    }
  }
  if (prev[e] < 0) return null;
  const out = []; for (let k = e; k !== s && k >= 0; k = prev[k]) out.push({ x: (k % tw) * TILE + 8, y: ((k / tw) | 0) * TILE + 8 }); out.push({ x: ax * TILE + 8, y: ay * TILE + 8 });
  return out.reverse();
}

// ───────── 한 사람의 판단 ─────────
const isDay = (min) => min >= 360 && min < 1080;
function onShift(o, min) {
  if (o.role === 'guard') return o.night ? !isDay(min) : isDay(min);
  if (o.nightWork) return min >= 1080 || min < 240; // 밤 장사: 저녁 6시 ~ 새벽 4시
  const start = 420 + (1 - o.trait.diligent) * 90, end = 1050 + o.trait.greedy * 120; // 성실하면 일찍 열고, 욕심 많으면 늦게까지
  return min >= start && min < end;
}
function choose(w, o, min) {
  const N = o.need, T = o.trait, nightOwl = (o.role === 'guard' && o.night) || o.nightWork, sleepy = nightOwl ? isDay(min) && min > 420 : !isDay(min), shift = onShift(o, min), post = o.role === 'post';
  const sc = {
    sleep: N.energy * N.energy * 1.6 + (sleepy ? 0.45 : -0.3) - (post && shift ? 0.3 : 0),
    eat: N.hunger * N.hunger * 1.5,
    // 가게 · 시설 사람은 근무 시간에 거의 자리를 지킨다 (밥 · 잠깐 쉬기만 끼어든다)
    work: shift ? (post ? 0.95 + T.diligent * 0.4 : 0.35 + T.diligent * 0.5 + (o.coins < 30 ? 0.3 : 0)) : 0.05,
    social: N.social * (0.3 + T.social * 0.7) * (o.friends.length ? 1 : 0.2) * (post && shift ? 0.4 : 1),
    fun: N.fun * 0.7 * (post && shift ? 0.3 : 1),
    wander: post ? 0.04 : 0.12 + rnd(o.seed, Math.floor(w.t)) * 0.1,
  };
  if (o.traveler && w.coach && min >= 450 && min < 480 && !o.atCapital && rnd(o.seed, (w.clock?.day || 1) * 7) < 0.5) sc.travel = 2; // 어떤 날은 왕도에 다녀온다
  if (o.atCapital && min >= 930) sc.travel = 2;
  const E = w.econ, tax = E?.tax ?? 0.1, day = w.clock?.day || 1;
  if (o.role === 'guard' && onShift(o, min) && tax >= 0.15) sc.collect = 0.25 + tax + (1 - T.honest) * 0.4; // 세금 걷기 (정직하지 않은 경비일수록 억지로)
  if (o.role === 'folk' && o.coins < 15 && T.loyal < 0.3 && tax >= 0.15 && !o.rebel) sc.rebel = 0.4 + (0.3 - T.loyal) * 3; // 녹타리스로 간다
  if (day % 7 === 0 && min >= 1080 && min < 1320) sc.fun += 0.8; // 이레마다 저녁 축제
  let best = 'wander', bv = -9; for (const [k, v] of Object.entries(sc)) if (v > bv) { bv = v; best = k; }
  return best;
}
function start(w, o, act, min) {
  const p = w.player, T = o.trait, r = (k) => rnd(o.seed, Math.floor(w.t / 2) + k);
  o.doing = act; o.doT = 0; o.goal = null; if (!o.asleep && !o.riding) o.away = false;
  const wanderTo = (rad, c = o.home) => { const a = r(1) * Math.PI * 2, d = (0.3 + r(2) * 0.7) * rad * TILE; return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.7 }; };
  if (act === 'sleep') { const b = o.bedBad ? null : o.bed; o.goal = b ? { x: b.x, y: b.y, then: 'enterBed' } : { x: o.home.x, y: o.home.y, then: 'doze' }; return; }
  if (act === 'eat') { const b = o.bed; o.goal = b && Math.hypot(b.x - o.x, b.y - o.y) < 18 * TILE ? { x: b.x, y: b.y, then: 'eatIn' } : { ...wanderTo(2, o.gather), then: 'eat' }; return; }
  if (act === 'work') {
    if (o.role === 'post') { o.goal = { x: o.home.x, y: o.home.y, then: 'work' }; return; }
    if (o.role === 'guard') { const side = r(3) < 0.5 ? 1 : -1; o.goal = { x: o.home.x + side * (3 + r(4) * 4) * TILE, y: o.home.y + (r(5) - 0.5) * 2 * TILE, then: 'watch' }; return; } // 순찰
    o.goal = { ...wanderTo(5), then: 'work' }; return;
  }
  if (act === 'social') { const f = o.friends.filter((q) => !q.away && !q.hostile && q.doing !== 'sleep').sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y))[0]; if (!f) { o.doing = 'wander'; o.goal = { ...wanderTo(3), then: 'idle' }; return; } o.talkTo = f; o.goal = { x: f.x + (f.x > o.x ? -13 : 13), y: f.y, then: 'talk' }; return; }
  if (act === 'fun') {
    const mate = o.role === 'guard' && T.brave > 0.5 ? o.friends.find((q) => q.role === 'guard' && !q.away && !q.hostile && (q.doing === 'fun' || q.doing === 'wander')) : null;
    if (mate) { o.sparWith = mate; mate.sparWith = o; mate.doing = 'fun'; mate.doT = 0; const cx = (o.x + mate.x) / 2, cy = (o.y + mate.y) / 2; o.goal = { x: cx - 9, y: cy, then: 'spar' }; mate.goal = { x: cx + 9, y: cy, then: 'spar' }; return; }
    const a = (o.seed % 628) / 100, rad = 16 + (o.seed % 3) * 6; o.goal = { x: o.gather.x + Math.cos(a) * rad, y: o.gather.y + Math.sin(a) * rad * 0.6, then: 'play' }; return;
  }
  if (act === 'collect') { // 근처에서 돈이 모자란 사람을 찾아 세금을 내라고 다그친다
    const v = w.objects.filter((q) => q.kind === 'npc' && q.role === 'folk' && q.home && !q.away && !q.hostile && !q.harassedBy && Math.hypot(q.x - o.x, q.y - o.y) < 12 * TILE).sort((a, b) => a.coins - b.coins)[0];
    if (!v) { o.doing = 'work'; start(w, o, 'work', min); return; }
    o.harass = v; v.harassedBy = o; v.goal = null; v.doing = 'harassed'; v.doT = 0; v.act = 'cower';
    o.goal = { x: v.x + (v.x > o.x ? -12 : 12), y: v.y, then: 'demand' }; w.signals.push({ t: 'npcEvent', k: 'harass', x: v.x, y: v.y, name: v.label0 || v.label }); return;
  }
  if (act === 'rebel') { // 짐을 싸서 녹트 하벤 쪽(마을 밖)으로 떠난다
    if (!o.rebel) w.signals.push({ t: 'npcEvent', k: 'rebel', x: o.x, y: o.y, name: o.label0 || o.label, id: o.id });
    o.rebel = true; if (o.mem) o.mem.left = true;
    const a = rnd(o.seed, 77) * Math.PI * 2; o.goal = { x: o.x + Math.cos(a) * 20 * TILE, y: o.y + Math.sin(a) * 20 * TILE, then: 'gone' }; return;
  }
  if (act === 'travel' && w.coach) { const c = w.coach, S = o.atCapital ? c.path[c.path.length - 1] : c.path[0]; o.goal = { x: S.x, y: S.y, then: 'idle', board: true }; return; }
  o.goal = { ...wanderTo(o.homebody ? 1.5 : o.role === 'post' ? 2 : 4), then: 'idle' };
}
// 하는 일을 하는 동안 욕구가 채워진다
function satisfy(o, DT) {
  const N = o.need, k = DT / 60; // 게임 1분 = 1초
  N.hunger = Math.min(1, N.hunger + k / 420); N.social = Math.min(1, N.social + k / 260); N.fun = Math.min(1, N.fun + k / 360);
  if (!o.asleep) N.energy = Math.min(1, N.energy + k / (o.role === 'guard' ? 780 : 900));
  const a = o.act;
  if (o.asleep) N.energy = Math.max(0, N.energy - k / 380);
  if (a === 'doze') N.energy = Math.max(0, N.energy - k / 700); // 선 채로 꾸벅꾸벅은 덜 개운하다
  if (a === 'eat' || a === 'eatIn') { N.hunger = Math.max(0, N.hunger - k / 12); if (o.doT < DT * 2) o.coins = Math.max(0, o.coins - 3); }
  if (a === 'talk') { N.social = Math.max(0, N.social - k / 15); if (o.talkTo) { o.talkTo.need.social = Math.max(0, o.talkTo.need.social - k / 15); if (Math.random() < DT * 0.08) gossip(o, o.talkTo); } }
  if (a === 'play' || a === 'spar') N.fun = Math.max(0, N.fun - k / 20);
  if (a === 'demand' && o.harass) { const v = o.harass; if (o.doT > 20 || v.hostile || v.away) { const take = Math.min(v.coins, 10); v.coins -= take; o.coins += take; v.trait.loyal = Math.max(0, v.trait.loyal - 0.08); v.harassedBy = null; v.doing = null; o.harass = null; o.doT = 99; } } // 돈을 뜯기면 왕실이 더 싫어진다
  if (a === 'work' || a === 'watch') o.coins += k * (0.3 + o.trait.diligent * 0.3);
}
const doneWith = (o, min) => { const N = o.need, a = o.act;
  if (o.doing === 'work' && !onShift(o, min)) return true; // 근무 시간이 끝나면 일을 접는다
  if (o.doing === 'harassed') return !o.harassedBy;
  if (o.doing === 'collect') return !o.harass && o.doT > 2;
  if (o.doing === 'rebel') return !o.goal; // 길이 막혔으면 다른 쪽으로 다시 떠난다
  if (o.doing === 'sleep') return N.energy < 0.05;
  if (o.doing === 'eat') return N.hunger < 0.05;
  if (o.doing === 'social') return N.social < 0.08 || o.doT > 40;
  if (o.doing === 'fun') return N.fun < 0.08 || o.doT > 60;
  if (o.doing === 'work') return o.role === 'post' ? o.doT > 90 + o.trait.diligent * 90 : o.doT > 25 + o.trait.diligent * 40; // 가게 사람은 오래 일하고 잠깐 쉰다
  return o.doT > 6 && !o.goal && a !== 'walk'; };

export function updateNpcLife(w, DT) {
  if (!w.npcInit) initNpcLife(w); // 집 안 · 광장 같은 곳도 처음 한 번
  w.lateT = (w.lateT || 0) - DT; if (w.lateT <= 0) { w.lateT = 2; if (w.objects.some((o) => isPerson(o) && !o.home && o.leaving == null)) initNpcLife(w); } // 나중에 놓인 사람(왕도 고위 관계자 · 모병관 등)도
  const p = w.player, min = w.clock?.min ?? 720;
  w.decayT = (w.decayT || 0) + DT;
  if (w.decayT >= 1) { const k = w.decayT; w.decayT = 0; for (const o of w.objects) if (o.mem && o.mem.op) { const d = Math.min(Math.abs(o.mem.op), k / 90); o.mem.op -= Math.sign(o.mem.op) * d; } } // 시간이 지나면 아주 조금씩 보통으로 돌아온다 (게임 1시간 ≈ 0.7)
  updateCoach(w, DT, min);
  for (const o of w.objects) {
    if (!isPerson(o) || !o.home || o.leaving != null || o.gone) continue;
    if (o.knockedUntil) { if (w.t < o.knockedUntil) continue; o.knockedUntil = 0; o.away = false; o.x = o.home.x; o.y = o.home.y; o.label = o.label0 || o.label; o.reusable = true; } // 기절했다 돌아온다
    if (o.hostile) { const e = o.hostile; if (e.dead) { o.hostile = null; continue; } o.x = e.x; o.y = e.y; o.act = 'fight'; o.face = e.dir; if (Math.hypot(e.x - p.x, e.y - p.y) > 420) calmDown(w, o); continue; }
    if (o.riding) { o.x = o.riding.x; o.y = o.riding.y; continue; }
    satisfy(o, DT); o.doT += DT;
    if (o.asleep) { if (o.need.energy < 0.05 || ((o.role === 'guard' || o.role === 'post') && onShift(o, min) && o.need.energy < 0.45)) wakeUp(o); continue; } // 집 안에서 잔다
    if (o.fleeT > 0) { o.fleeT -= DT; const a = Math.atan2(o.y - p.y, o.x - p.x); step(w, o, o.x + Math.cos(a) * 30, o.y + Math.sin(a) * 30, 60, DT); o.act = 'run'; continue; }
    if (!o.doing || doneWith(o, min)) { if (o.sparWith && o.sparWith.sparWith === o) o.sparWith.sparWith = null; o.sparWith = null; o.talkTo = null; start(w, o, choose(w, o, min), min); }
    if (o.role === 'guard' && o.mem && o.mem.op <= -60 && w.npcAttack && Math.hypot(p.x - o.x, p.y - o.y) < 90) { w.emit({ t: 'text', x: o.x, y: o.y - 26, text: '저놈이다! 잡아라!', color: '#ff5a4a' }); provokeNpc(w, o, 'law'); continue; } // 나를 증오하는 경비는 보이면 덤빈다
    const talkNear = Math.hypot(p.x - o.x, p.y - o.y) < 26; // 말 걸 수 있게 가까이 오면 멈춰 선다
    if (talkNear && o.act !== 'doze') { if (o.act === 'walk') o.act = 'idle'; o.face = p.x < o.x ? -1 : 1; continue; }
    if (o.goal) {
      o.goalT = (o.goalT || 0) + DT;
      if (o.goal && o.goal.route === undefined) o.goal.route = gridPath(w, o.x, o.y, o.goal.x, o.goal.y); // 벽 · 건물을 돌아가는 길
      const R = o.goal?.route; let wp = o.goal;
      if (R && R.length) { wp = R[0]; if (Math.hypot(wp.x - o.x, wp.y - o.y) < 9) { R.shift(); wp = R[0] || o.goal; } }
      let arrived = step(w, o, wp?.x ?? o.x, wp?.y ?? o.y, o.goal?.run ? 46 : 26, DT) && (!R || !R.length);
      if (!arrived && o.goal && o.goalT > 30) { if (Math.hypot(o.goal.x - o.x, o.goal.y - o.y) < 48) arrived = true; else if (o.goal.then === 'enterBed') { o.bedBad = true; o.goal = null; o.act = 'doze'; } else { o.goal = null; o.act = 'idle'; o.doT = 99; } } // 30초 넘게 못 가면 포기
      if (!o.goal) { o.goalT = 0; continue; }
      if (arrived && o.goal?.then === 'gone') { o.away = true; o.home = null; o.reusable = false; continue; } // 떠났다
      if (arrived) { const g = o.goal; o.goal = null; o.goalT = 0; o.act = g.then || 'idle'; if (g.board) boardCoach(w, o); if (o.act === 'enterBed') goToBed(w, o); if (o.act === 'eatIn') o.away = true; } // 집에 들어가 먹는다
      else o.act = 'walk';
    }
    if (o.act === 'talk' && o.talkTo) o.face = o.talkTo.x < o.x ? -1 : 1;
    if (o.act === 'spar' && o.sparWith) o.face = o.sparWith.x < o.x ? -1 : 1;
  }
}
function goToBed(w, o) { o.asleep = true; o.away = true; o.act = 'sleep'; } // 문 안으로 들어간다
function wakeUp(o) { o.asleep = false; o.away = false; o.doing = null; o.act = 'idle'; if (o.bed) { o.x = o.bed.x; o.y = o.bed.y; } }
// 가까운 거리(±28칸)의 길 찾기: 칸 단위 너비 우선 탐색 → 지나갈 점들
export function gridPath(w, sx, sy, gx, gy) {
  const ax = Math.floor(sx / TILE), ay = Math.floor(sy / TILE), bx = Math.floor(gx / TILE), by = Math.floor(gy / TILE);
  if (Math.abs(ax - bx) + Math.abs(ay - by) < 2) return null;
  const R = 28, W = R * 2 + 1, ox = ax - R, oy = ay - R; if (Math.abs(bx - ax) > R || Math.abs(by - ay) > R) return null;
  const prev = new Int16Array(W * W).fill(-1), idx = (x, y) => (y - oy) * W + (x - ox), s = idx(ax, ay), e = idx(bx, by);
  const ok = (x, y) => x >= ox && y >= oy && x < ox + W && y < oy + W && (x === bx && y === by || !w.blocked(x * TILE + 8, y * TILE + 8, 4));
  prev[s] = s; const q = [s];
  for (let h = 0; h < q.length; h++) { const k = q[h]; if (k === e) break; const x = (k % W) + ox, y = ((k / W) | 0) + oy; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!ok(xx, yy)) continue; const n = idx(xx, yy); if (prev[n] >= 0) continue; prev[n] = k; q.push(n); } }
  if (prev[e] < 0) return null;
  const out = []; for (let k = e; k !== s; k = prev[k]) out.push({ x: ((k % W) + ox) * TILE + 8, y: (((k / W) | 0) + oy) * TILE + 8 });
  out.reverse(); out[out.length - 1] = { x: gx, y: gy }; return out;
}
// 한 걸음 (막히면 돌아가 보고, 안 되면 포기) · 도착하면 true
function step(w, o, tx, ty, sp, DT) {
  const dx = tx - o.x, dy = ty - o.y, l = Math.hypot(dx, dy);
  if (l < 7) return true;
  const s = Math.min(l, sp * DT), nx = o.x + dx / l * s, ny = o.y + dy / l * s, ox = o.x, oy = o.y;
  o.face = dx < 0 ? -1 : 1;
  if (w.blocked(nx, ny, 4)) { if (!w.blocked(nx, o.y, 4)) o.x = nx; else if (!w.blocked(o.x, ny, 4)) o.y = ny; else { o.stuck = (o.stuck || 0) + DT; if (o.stuck > 1.2) { o.stuck = 0; if (l < 26) return true; /* 문 앞 가까이까지 왔으면 도착 */ if (o.goal?.then === 'enterBed') { o.bedBad = true; o.goal = null; o.act = 'doze'; return false; } o.goal = null; o.act = 'idle'; o.doT = 99; } return false; } }
  else { o.x = nx; o.y = ny; }
  if (Math.hypot(o.x - ox, o.y - oy) < s * 0.3) { o.stuck = (o.stuck || 0) + DT; if (o.stuck > 1.2) { o.stuck = 0; if (l < 26) return true; if (o.goal?.then === 'enterBed') { o.bedBad = true; o.goal = null; o.act = 'doze'; return false; } o.goal = null; o.act = 'idle'; o.doT = 99; } } else o.stuck = 0; // 벽에 비벼 제자리면 막힌 것
  return false;
}
// 역마차: 08시 마을 출발 → 왕도 남문, 16시쯤 왕도 출발 → 마을 (길 위의 점을 하나씩 따라간다)
function updateCoach(w, DT, min) {
  const c = w.coach; if (!c) return;
  const going = c.dirn > 0 ? min >= 480 && min < 900 : min >= 960 || min < 300;
  const end = c.dirn > 0 ? c.path.length - 1 : 0;
  c.moving = false;
  if (!going) { if (c.i === 0 && c.dirn < 0) c.dirn = 1; if (c.i === c.path.length - 1 && c.dirn > 0) c.dirn = -1; return; }
  if (c.i === end) {
    for (const o of c.riders) { o.riding = null; o.away = false; o.atCapital = c.dirn > 0; o.x = c.x + 14; o.y = c.y + 8; o.act = 'idle'; o.goal = null; o.doing = null; }
    c.riders = []; c.dirn = -c.dirn; return;
  }
  const t = c.path[c.i + c.dirn], dx = t.x - c.x, dy = t.y - c.y, l = Math.hypot(dx, dy), s = 38 * DT;
  if (l <= s) { c.x = t.x; c.y = t.y; c.i += c.dirn; } else { c.x += dx / l * s; c.y += dy / l * s; }
  // 보는 방향: 가로로 가면 옆모습, 세로로 가면 앞 · 뒷모습 (부드럽게 바꿔 깜빡이지 않게)
  c.hx = (c.hx || 0) * 0.85 + dx * 0.15; c.hy = (c.hy || 0) * 0.85 + dy * 0.15;
  if (Math.abs(c.hx) > 0.3) c.dir = c.hx > 0 ? 1 : -1;
  c.vy = Math.abs(c.hy) > Math.abs(c.hx) * 1.3 ? (c.hy > 0 ? 1 : -1) : 0;
  c.moving = true;
}
function boardCoach(w, o) { const c = w.coach; if (!c || Math.hypot(c.x - o.x, c.y - o.y) > 40) return; o.riding = c; o.away = true; c.riders.push(o); }

// ───────── 공격: 맞으면 화가 나 싸운다 ─────────
const NPC_FOE = (o) => (o.role === 'guard' ? 'royalGuard' : 'townsfolk');
export function provokeNpc(w, o, why = 'hit') {
  if (o.hostile || o.knockedUntil || o.away || !o.home) return;
  if (o.official) { o.away = true; o.home = null; o.reusable = false; w.signals.push({ t: 'officialAttack', id: o.official, x: o.x, y: o.y }); return; } // 고위 관계자는 호위를 부른다
  const e = w.makeEnemy(NPC_FOE(o), o.x, o.y, { noAffix: true });
  if (o.role === 'guard') { e.moves = ['combo', 'leap', 'shove', 'whirl']; e.skillNames = { combo: '연속 베기', leap: '돌진 찌르기', shove: '방패 밀치기', whirl: '회전 베기' }; }
  else e.moves = []; // 일반 주민 · 상인은 주먹질만
  e.npcRef = o; e.state = 'chase'; e.home = { ...o.home }; e.champion = null; e.alert = 9;
  if (o.role === 'post') { e.hp = e.maxHp = Math.round(e.maxHp * 1.4); }
  o.hostile = e; o.label0 ||= o.label; o.reusable = false; o.goal = null; o.riding = null;
  w.enemies.push(e); w.aggro?.(e);
  // 겁 많은 사람은 맞으면 달아나고, 용감한 사람 · 경비는 맞선다
  if (o.role !== 'guard' && o.trait && o.trait.brave < 0.35 && why !== 'ally') { e.dead = true; w.enemies = w.enemies.filter((q) => q !== e); o.hostile = null; o.reusable = true; o.fleeT = 8; w.emit({ t: 'text', x: o.x, y: o.y - 26, text: '살려 줘!', color: '#ffd0a0' }); w.signals.push({ t: 'npcHostile', id: o.id, role: o.role, why, fled: true, seen: witness(w, o.x, o.y, 'assault', 30, o) }); alarm(w, o); return; }
  w.emit({ t: 'text', x: o.x, y: o.y - 26, text: o.role === 'guard' ? '감히!' : '무슨 짓이야!', color: '#ff7a5a' });
  w.signals.push({ t: 'npcHostile', id: o.id, role: o.role, why, seen: why === 'ally' ? 0 : witness(w, o.x, o.y, 'assault', 30, o) });
  alarm(w, o);
}
// 같은 동네 경비는 함께 덤비고, 겁 많은 사람들은 달아난다
function alarm(w, o) {
  for (const q of w.objects) {
    if (q === o || !isPerson(q) || !q.home || q.hostile || q.knockedUntil || q.away) continue;
    const d = Math.hypot(q.x - o.x, q.y - o.y);
    if (q.role === 'guard' && d < 12 * TILE) provokeNpc(w, q, 'ally');
    else if (d < 9 * TILE) q.fleeT = 6;
  }
}
function calmDown(w, o) { const e = o.hostile; if (e) { e.dead = true; e.gone = true; w.enemies = w.enemies.filter((q) => q !== e); } o.hostile = null; o.reusable = true; o.label = o.label0 || o.label; o.x = o.home.x; o.y = o.home.y; o.act = 'idle'; o.doing = null; }
export function npcDown(w, e) {
  const o = e.npcRef; if (!o) return;
  o.hostile = null; o.knockedUntil = w.t + 240; o.away = true; o.reusable = false; // 4분 뒤 돌아온다 (기절)
  w.emit({ t: 'text', x: e.x, y: e.y - 20, text: '쓰러졌다', color: '#c8b8a0' });
  w.signals.push({ t: 'npcDown', id: o.id, role: o.role, seen: witness(w, e.x, e.y, 'beatDown', 45, o) });
}
// ───────── 기억 · 소문 ─────────
const DEED_TEXT = { assault: '사람을 때렸다', beatDown: '사람을 때려눕혔다', raid: '상단을 털었다', rob: '세금 마차를 털었다', escort: '상단을 지켜 줬다', guard: '세금 마차를 지켜 줬다', donate: '어려운 사람을 도왔다', bribe: '경비에게 뇌물을 줬다', stop: '싸움을 말렸다', official: '고위 관리를 죽였다' };
export const deedText = (k) => DEED_TEXT[k] || k;
// 내 행동을 본 사람들 (깨어 있고, 10칸 안) — 본 사람 수를 돌려준다. weight > 0 이면 나쁜 일, < 0 이면 좋은 일
export function witness(w, x, y, deed, weight, victim = null) {
  let n = 0;
  for (const o of w.objects) {
    if (!isPerson(o) || !o.mem || o.away || o.asleep || o.knockedUntil) continue;
    if (o !== victim && Math.hypot(o.x - x, o.y - y) > 10 * TILE) continue;
    n++; learn(o, deed, weight, 1);
  }
  return n;
}
// 알게 됨: 정직한 사람은 나쁜 일에 더 실망하고, 탐욕스러운 사람은 뇌물 이야기에 덜 실망한다 · 경비는 범죄를 기억하면 덤빈다
function learn(o, deed, weight, k) {
  if (o.mem.knows[deed] && k < 1) return;
  o.mem.knows[deed] = (o.mem.knows[deed] || 0) + 1;
  let d = weight * k * (weight > 0 ? 0.6 + (o.trait?.honest || 0.5) * 0.8 : 1);
  if (deed === 'bribe') d *= 1.2 - (o.trait?.greedy || 0.5);
  if ((deed === 'raid' || deed === 'rob') && o.trait && o.trait.loyal < 0.3) d *= -0.5; // 왕실이 싫은 사람은 세금 마차 털이를 반긴다
  o.mem.op = Math.max(-100, Math.min(100, o.mem.op - d));
}
function gossip(a, b) { // 서로 아는 내 이야기를 나눈다 (들은 이야기는 반쯤만 믿는다)
  for (const [x, y] of [[a, b], [b, a]]) for (const deed of Object.keys(x.mem?.knows || {})) if (y.mem && !y.mem.knows[deed]) learn(y, deed, DEED_W[deed] || 10, 0.5);
}
const DEED_W = { assault: 30, beatDown: 45, raid: 25, rob: 20, escort: -20, guard: -15, donate: -15, bribe: 10, stop: -10, official: 40 };
export const opinionText = (op) => (op >= 50 ? '당신을 아주 좋아한다' : op >= 15 ? '당신에게 호의적이다' : op > -15 ? '당신을 잘 모른다' : op > -50 ? '당신을 경계한다' : '당신을 증오한다');
// 내 공격이 닿은 곳 근처의 NPC · 벌어지는 일
// 지금 싸우는 중인가 (나를 쫓는 적 · 화난 사람 · 붙은 싸움이 가까이 있으면)
export function inCombat(w) {
  const p = w.player;
  return w.enemies.some((e) => !e.dead && (e.state === 'chase' || e.npcRef) && Math.hypot(e.x - p.x, e.y - p.y) < 340) || !!w.skirmish?.foes?.some((e) => !e.dead);
}
// 내 공격(tok: 조준해서 쓴 공격 한 번의 표) — 싸움 중이 아닐 때, 그 공격에 처음 맞은 사람 한 명만 화가 난다.
// 대시 수리검 · 폭발 · 연쇄 · 장판 · 소환수 같은 자동 효과는 tok이 없어서 사람에게 맞지 않는다.
export function pokeNpcs(w, x, y, r, tok) {
  if (!w.npcAttack || tok == null) return;
  w.tokUsed ||= new Set(); if (w.tokUsed.has(tok)) return;
  if (inCombat(w)) return;
  let best = null, bd = 1e9;
  for (const o of w.objects) if (isPerson(o) && o.home && !o.hostile && !o.knockedUntil && !o.away) { const d = Math.hypot(o.x - x, o.y - y); if (d <= r + 6 && d < bd) { bd = d; best = o; } }
  if (best) { w.tokUsed.add(tok); if (w.tokUsed.size > 200) w.tokUsed = new Set([tok]); provokeNpc(w, best); return; }
  for (const o of w.objects) if (o.kind === 'happening' && !o.gone && !o.engaged && Math.hypot(o.x - x, o.y - y) <= r + 22) { o.engaged = true; w.tokUsed.add(tok); w.signals.push({ t: 'happeningHit', id: o.hid }); return; }
}

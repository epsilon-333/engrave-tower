// 탑 51~100층 구역 장치 · 새 보스 기술 · 보스 등장 연출 (world.js 가 부른다)
// 구역 장치 (숫자로 분명하게):
//  하늘 정원  돌풍: 8초마다 1초 예고 뒤 3칸 밀린다 (적도 밀린다) · 하늘(가장자리 · 구멍)에 떨어지면 체력 -10%, 마지막에 선 자리로 (보통 몬스터는 떨어지면 죽는다)
//  거울 미궁  거울 벽: 투사체가 한 번 튕긴다 (튕긴 뒤 피해 70%) · 두 번째 물결에 내 그림자(20초 · 내 공격력의 40%)와 적의 그림자 하나
//  태엽 시계탑 톱니 바닥: 위에 서면 1초에 1칸 실려 간다 (적도) · 시간의 종: 20초마다 3초 동안 적 30% 느려짐 · 내 쿨타임이 2배 빨리
//  별의 서고  책장: 물결마다 옆으로 옮겨진다 (1초 예고) · 별자리 장판: 그 안에서 주는 피해 +20% (적도)
//  빛의 정상  빛기둥(G): 30초 동안 둘레 6칸이 밝다 · 빛 안의 적은 받는 피해 +25%, 빛 밖(그림자)의 적은 -30% · 빛 먹는 자는 기둥을 끈다
import { TILE, T_FLOOR, T_WALL, T_LIQUID } from './mapgen.js';
import { bossScriptPick, bossScriptTick, SCRIPT_MOVES } from './bossmoves.js';

const DT = 1 / 60;
const GUST_EVERY = 8, GUST_TELE = 1, GUST_PUSH = 48; // 3칸
const BELT_SPEED = 16; // 1초에 1칸
const BELL_EVERY = 20, BELL_DUR = 3;
const LIGHT_R = 96, LIGHT_DUR = 30; // 6칸 · 30초
export const ZONE_RULES = {
  gust: '돌풍: 8초마다 화살표 방향으로 3칸 밀린다 (가장자리에서 멈춘다) · 제 발로 하늘에 걸어 나가면 떨어져 죽는다',
  mirror: '거울 벽: 투사체가 한 번 튕긴다 (피해 70%) · 내 그림자가 20초 동안 나온다',
  clock: '톱니 바닥이 1초에 1칸 실어 간다 · 20초마다 시간의 종 (3초 동안 적 -30% 속도 · 내 쿨타임 2배 빠르게)',
  library: '책장이 물결마다 옮겨진다 · 별자리 위에서 주는 피해 +20% (적도)',
  light: '빛기둥(G)을 깨우면 30초 동안 둘레 6칸이 밝다 · 빛 안의 적은 +25% · 그림자 속 적은 -30% 피해',
};

const isVoid = (w, x, y) => w.voidZone && w.tileAt(x, y) === T_LIQUID;
const flyer = (e) => e.def.shape === 'flyer' || e.soaring;

// ───── 층 시작 ─────
export function zoneInit(w) {
  const C = w.climb, mc = w.map.climb || {}, g = w.zone?.gimmick;
  w.voidZone = w.zone?.liquid === 'void';
  C.gz = { g, gustT: 6, bellT: BELL_EVERY - 6, beltMul: 1, beltMulT: 0, safe: { x: w.player.x, y: w.player.y }, hist: [], shadowDone: false, hz: [] };
  C.belts = mc.belts || []; C.stars = mc.stars || []; C.shelves = mc.shelves || [];
  if (mc.pillars) for (const pl of mc.pillars) w.objects.push({ kind: 'lightPillar', x: pl.x * TILE + 8, y: pl.y * TILE + 12, litT: 0, label: '빛기둥 깨우기', reach: 24, reusable: true });
}

// ───── 매 틱 ─────
export function zoneTick(w) {
  const C = w.climb, Z = C?.gz; if (!Z) return;
  const p = w.player, fight = C.phase === 'fight';
  // 지난 2.5초의 내 자리 (되감기)
  if ((Z.histT = (Z.histT || 0) - DT) <= 0) { Z.histT = 0.1; Z.hist.push({ x: p.x, y: p.y }); if (Z.hist.length > 25) Z.hist.shift(); }
  // 하늘: 떨어짐 · 돌풍
  if (w.voidZone) {
    const onVoid = isVoid(w, p.x, p.y + 3), air = p.airT > 0 || p.leap || p.dashT > 0 || p.down;
    if (p.skyFall) skyFallTick(w);
    else if (!onVoid && w.tileAt(p.x, p.y + 3) === T_FLOOR) { Z.safe.x = p.x; Z.safe.y = p.y; }
    else if (onVoid && !air) playerFall(w); // 구르기 · 도약 중에는 하늘을 건너갈 수 있다 (내려앉은 자리가 하늘이면 떨어진다)
    if (Z.fallCd > 0) Z.fallCd -= DT;
    for (const e of w.enemies) if (!e.dead && !e.def.boss && !flyer(e) && !e.summonedBoss && isVoid(w, e.x, e.y + 3) && !(e.mv?.k === 'leap')) enemyFall(w, e);
    if (fight && Z.g === 'gust') {
      Z.gustT -= DT;
      if (Z.gustT <= GUST_TELE && !Z.gustTele) { Z.gustTele = true; Z.gustAng = Math.floor(w.rng.range(0, 8)) * Math.PI / 4; w.emit({ t: 'gustTele', ang: Z.gustAng, dur: GUST_TELE }); }
      if (Z.gustT <= 0) { Z.gustT = GUST_EVERY; Z.gustTele = false; gustPush(w, Z.gustAng); }
    }
  }
  for (const e of w.enemies) if (e.pushT > 0) { // 돌풍 · 밀쳐 냄: 벽만 막는다 (하늘 위로도 밀린다)
    e.pushT -= DT; const nx = e.x + e.pvx * DT, ny = e.y + e.pvy * DT;
    if (!w.blocked(nx, e.y, Math.max(3, e.r - 1))) e.x = nx; if (!w.blocked(e.x, ny, Math.max(3, e.r - 1))) e.y = ny;
  }
  // 톱니 바닥
  if (C.belts.length) {
    if (Z.beltMulT > 0 && (Z.beltMulT -= DT) <= 0) Z.beltMul = 1;
    const carry = (ent) => { const b = beltAt(C, ent.x, ent.y + 3); if (!b) return; const v = BELT_SPEED * Z.beltMul * DT; w.move(ent, b.dx * v, b.dy * v); };
    if (!(p.airT > 0) && !p.leap) carry(p);
    for (const e of w.enemies) if (!e.dead && !flyer(e) && !e.def.boss) carry(e);
  }
  // 시간의 종
  if (fight && Z.g === 'clock') {
    Z.bellT -= DT;
    if (Z.bellT <= 1.2 && !Z.bellTele) { Z.bellTele = true; }
    if (Z.bellT <= 0) {
      Z.bellT = BELL_EVERY; Z.bellTele = false; Z.bellOn = BELL_DUR;
      for (const e of w.enemies) if (!e.dead && !e.bellSlow) { e.bellSlow = true; e.speedMul *= 0.7; }
      p.buffs.timeBell = { t: BELL_DUR, mods: { cdRate: 2 }, name: '시간의 종', color: '#ffe0a0' };
      w.emit({ t: 'bell', dur: BELL_DUR }); w.emit({ t: 'banner', text: '시간의 종', sub: '3초 동안 적 30% 느려짐 · 내 쿨타임 2배 빠르게', color: '#ffe0a0' });
    }
    if (Z.bellOn > 0 && (Z.bellOn -= DT) <= 0) for (const e of w.enemies) if (e.bellSlow) { e.bellSlow = false; e.speedMul /= 0.7; }
  }
  // 거울 그림자: 두 번째 물결에 한 번
  if (fight && Z.g === 'mirror' && !Z.shadowDone && C.kind === 'fight' && C.waveI >= 2) { Z.shadowDone = true; spawnShadows(w); }
  for (const e of w.enemies) if (e.lifeT > 0 && (e.lifeT -= DT) <= 0 && !e.dead) { e.dead = true; w.emit({ t: 'death', x: e.x, y: e.y, color: '#1a1a24', defId: e.defId, dir: e.dir }); }
  // 빛기둥
  for (const o of w.objects) if (o.kind === 'lightPillar' && o.litT > 0) {
    o.litT -= DT;
    if (o.litT <= 0) { o.label = '빛기둥 깨우기'; w.emit({ t: 'text', x: o.x, y: o.y - 30, text: '빛기둥이 꺼졌다', color: '#c8b880' }); }
    for (const e of w.enemies) if (!e.dead && e.def.eatsLight && Math.hypot(e.x - o.x, e.y - o.y) < 30 && o.litT > 0) { o.litT = 0; o.label = '빛기둥 깨우기'; }
  }
  // 지워진 기록: 맞으면 4초 동안 드러난다
  for (const e of w.enemies) if (e.revealT > 0) e.revealT -= DT;
  // 위험 지대 (회오리 · 시간 칼날 등)
  hazardTick(w, Z);
}
const beltAt = (C, x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return C.belts.find((b) => tx >= b.x0 && tx <= b.x1 && ty >= b.y0 && ty <= b.y1); };
export const inStar = (w, x, y) => (w.climb?.stars || []).some((s) => Math.hypot(x - (s.x * TILE + 8), y - (s.y * TILE + 8)) < s.r * TILE);
export const litAt = (w, x, y) => w.objects.some((o) => o.kind === 'lightPillar' && o.litT > 0 && Math.hypot(x - o.x, y - o.y) < LIGHT_R);

// 하늘로 걸어 나가면 떨어져 죽는다: 1.1초 동안 허우적대며 구름 아래로 작아지다가 쓰러짐 (붙잡을 수 없다)
function playerFall(w) {
  const p = w.player;
  if (p.skyFall) return;
  p.skyFall = { t: 0, dur: 1.1, x: p.x, y: p.y, spin: p.dir || 1 }; p.dashT = 0;
  w.emit({ t: 'skyFall', x: p.x, y: p.y });
}
function skyFallTick(w) {
  const p = w.player, F = p.skyFall;
  F.t += DT; p.x = F.x; p.y = F.y; p.dashT = 0; p.windupT = Math.max(p.windupT || 0, 0.05); p.moving = false; // 떨어지는 동안은 움직이거나 공격할 수 없다
  if (F.t >= F.dur && w.state === 'play') { p.skyDead = true; p.hp = 0; w.checkDeath(); p.skyFall = null; }
}
function enemyFall(w, e) {
  w.emit({ t: 'skyFall', x: e.x, y: e.y, enemy: true }); // 렌더러: 이 자리에서 쓰러지는 몬스터는 넘어지지 않고 구름 아래로 떨어진다
  w.emit({ t: 'text', x: e.x, y: e.y - 20, text: '추락!', color: '#bfe8ff' });
  w.killEnemy(e);
}
// 돌풍: 나와 모든 땅 위 적이 같은 쪽으로 3칸 (0.3초 동안)
export function gustPush(w, ang, mul = 1) {
  const p = w.player, v = GUST_PUSH * mul / 0.3;
  w.emit({ t: 'gust', ang });
  w.knockPlayer(p.x - Math.cos(ang), p.y - Math.sin(ang), GUST_PUSH * mul, { ang }); // 밀려나는 것(넉백)이라 가장자리에서 멈춘다 — 떨어지는 건 제 발로 걸어 나갔을 때만
  for (const e of w.enemies) if (!e.dead && !e.def.boss && !flyer(e)) { e.pushT = 0.3; e.pvx = Math.cos(ang) * v; e.pvy = Math.sin(ang) * v; }
}

function spawnShadows(w) {
  const p = w.player, C = w.climb;
  const at = (x, y) => (w.blocked(x, y, 6) ? { x: p.x, y: p.y - 30 } : { x, y });
  const a = w.rng.range(0, Math.PI * 2), sp = at(p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60);
  const sh = w.makeEnemy('mirrorShade', sp.x, sp.y, { summoned: true });
  sh.atk = w.skillAtk('any') * 0.4; sh.lifeT = 20; sh.noLoot = true; sh.state = 'chase'; sh.home = { x: sp.x, y: sp.y }; sh.mirrorRace = w.b.race; sh.champion = '내 그림자';
  w.enemies.push(sh); w.aggro(sh);
  const src = w.enemies.filter((e) => !e.dead && e.climb && !e.summoned && !e.def.boss);
  if (src.length) { // 적의 그림자: 체력 절반 · 20초
    const o = w.rng.pick(src), c = w.makeEnemy(o.defId, o.x + 14, o.y, { summoned: true });
    c.hp = c.maxHp = c.maxHp * 0.5; c.lifeT = 20; c.noLoot = true; c.tintX = 'brightness(0.25) contrast(1.6) saturate(0)'; c.state = 'chase'; c.home = { x: o.x, y: o.y }; c.champion = `${o.def.name}의 그림자`;
    w.enemies.push(c); w.aggro(c); w.emit({ t: 'blink', x1: o.x, y1: o.y, x2: c.x, y2: c.y });
  }
  void C;
}

// 책장: 물결마다 옆으로 옮긴다 (1초 예고 · 끝이 언제나 트여 있어 돌아갈 수 있다)
export function shiftShelves(w) {
  const C = w.climb; if (!C?.shelves?.length) return;
  const { tw } = w, plan = [];
  for (const sh of C.shelves) {
    const opts = [];
    for (let x0 = 5; x0 + sh.len < tw - 5; x0++) {
      if (Math.abs(x0 - sh.x0) < 3) continue;
      let ok = true;
      for (let x = x0 - 3; x <= x0 + sh.len + 2 && ok; x++) for (let y = sh.y - 1; y <= sh.y + 1; y++) { const t = w.tiles[y * tw + x], mine = x >= sh.x0 && x < sh.x0 + sh.len && y === sh.y; if (t !== T_FLOOR && !mine) { ok = false; break; } }
      if (ok) opts.push(x0);
    }
    if (!opts.length) continue;
    const nx = w.rng.pick(opts); plan.push({ sh, nx });
  }
  if (!plan.length) return;
  const warn = []; for (const { sh, nx } of plan) for (let x = nx; x < nx + sh.len; x++) warn.push(sh.y * tw + x);
  w.emit({ t: 'tileWarn', tiles: warn, dur: 1, color: '#c8b0ff' });
  w.delayed.push({ t: 1, run: () => {
    for (const { sh, nx } of plan) {
      for (let x = sh.x0; x < sh.x0 + sh.len; x++) w.tiles[sh.y * tw + x] = T_FLOOR;
      for (let x = nx; x < nx + sh.len; x++) w.tiles[sh.y * tw + x] = T_WALL;
      sh.x0 = nx;
    }
    unstick(w);
    w.emit({ t: 'mapChanged' });
  } });
}
// 벽이 된 칸에 끼인 사람 · 적은 가까운 바닥으로
function unstick(w) {
  const free = (ent) => {
    if (!w.blocked(ent.x, ent.y, Math.max(3, (ent.r || 5) - 1))) return;
    for (let r = 8; r <= 64; r += 8) for (let a = 0; a < 8; a++) { const x = ent.x + Math.cos(a * Math.PI / 4) * r, y = ent.y + Math.sin(a * Math.PI / 4) * r; if (!w.blocked(x, y, Math.max(3, (ent.r || 5) - 1))) { ent.x = x; ent.y = y; return; } }
  };
  free(w.player); for (const e of w.enemies) if (!e.dead) free(e);
}

// 단계가 바뀔 때 결투장이 바뀐다 (용암 · 물이 번진다): 1.5초 예고 뒤
export function arenaShift(w, n) {
  const list = w.map.climb?.shifts?.[n]; if (!list?.length) return;
  const liquid = w.zone.liquid;
  w.emit({ t: 'tileWarn', tiles: list, dur: 1.5, color: liquid === 'lava' ? '#ff6a2a' : liquid === 'snow' ? '#e8f4ff' : '#7ac8ff' });
  w.delayed.push({ t: 1.5, run: () => { for (const i of list) if (w.tiles[i] === T_FLOOR) w.tiles[i] = T_LIQUID; w.emit({ t: 'mapChanged' }); w.emit({ t: 'shake', v: 4 }); } });
}

// 빛기둥 깨우기 (G)
export function lightPillar(w, o) {
  if (o.litT > 0) { o.litT = LIGHT_DUR; w.emit({ t: 'text', x: o.x, y: o.y - 34, text: '빛이 다시 30초', color: '#fff0b0' }); return; }
  o.litT = LIGHT_DUR; o.label = '빛기둥 (켜짐)';
  w.emit({ t: 'pillarLit', x: o.x, y: o.y }); w.emit({ t: 'text', x: o.x, y: o.y - 34, text: '빛기둥이 깨어났다 · 30초', color: '#fff0b0' });
}

// 피해 배율: 적이 받는 피해 (빛 · 그림자 · 내가 별자리 위)
export function zoneTakeMul(w, e) {
  const C = w.climb; if (!C?.gz) return 1;
  let m = 1;
  if (C.gz.g === 'light') m *= litAt(w, e.x, e.y) ? 1.25 : 0.7;
  if (C.stars.length && inStar(w, w.player.x, w.player.y)) m *= 1.2;
  return m;
}
// 적이 주는 피해 (때린 적이 별자리 위면 +20%)
export function zoneHitMul(w, attacker) {
  const C = w.climb; if (!C?.stars?.length || !attacker || attacker.x == null) return 1;
  return inStar(w, attacker.x, attacker.y) ? 1.2 : 1;
}
// 거울 벽: 투사체를 한 번 튕긴다 (true면 튕겼다)
export function mirrorBounce(w, pr) {
  if (w.zone?.gimmick !== 'mirror' || pr.bounced || pr.ghost || pr.boomerang) return false;
  const px = pr.x - pr.vx * DT, py = pr.y - pr.vy * DT;
  const hx = w.wallAt(pr.x, py), hy = w.wallAt(px, pr.y);
  if (hx || !hy) pr.vx = -pr.vx; if (hy || !hx) pr.vy = -pr.vy;
  pr.x = px; pr.y = py; pr.bounced = true; pr.dmg *= 0.7; pr.life = Math.max(pr.life, 0.6);
  if (pr.hit?.clear) pr.hit.clear();
  w.emit({ t: 'spark', x: px, y: py, color: '#f0f8ff' });
  return true;
}

// ───── 위험 지대: 회오리 · 시간 칼날 ─────
function hazardTick(w, Z) {
  const p = w.player;
  for (const h of Z.hz) {
    h.t -= DT;
    if (h.k === 'tornado') {
      const dx = p.x - h.x, dy = p.y - h.y, l = Math.hypot(dx, dy) || 1;
      h.x += (dx / l) * 34 * DT; h.y += (dy / l) * 34 * DT;
      if (w.blocked(h.x, h.y, 4)) { h.x -= (dx / l) * 34 * DT; h.y -= (dy / l) * 34 * DT; }
      if (l < 70 && !p.down) w.move(p, -(dx / l) * 26 * DT, -(dy / l) * 26 * DT); // 빨아들인다
      if ((h.hitT = (h.hitT || 0) - DT) <= 0 && l < 20) { h.hitT = 0.5; w.hurtPlayer(h.atk, 'phys', h.src, { fromX: h.x, fromY: h.y, status: 'bleed' }); }
    }
  }
  Z.hz = Z.hz.filter((h) => h.t > 0 && !(h.src?.dead));
}

// ───── 새 보스 기술 ─────
// 기술을 쓸 수 있는가 (enemyMove 의 can 에 더한다)
export function bossCan(w, e, p, dist) {
  const C = w.climb;
  return {
    gust: true, tornado: dist < 260 && (C?.gz?.hz.filter((h) => h.k === 'tornado').length || 0) < 2, whalePass: true, collapse: !C?.gz?.collapsed,
    copy: true, raceArt: true, shardHide: !w.enemies.some((o) => o.decoyOf === e.id && !o.dead), beltFlip: !!C?.belts?.length,
    timeStop: true, rewind: (C?.gz?.hist.length || 0) >= 20, shelfFall: true, constellation: dist < 260, douse: true, lightCore: true,
    ...Object.fromEntries([...SCRIPT_MOVES].map((k) => [k, dist < 320])), // bossmoves.js: 가까우면 언제든
    swallow: dist < 200, flameCrescent: dist < 140, dive3: true, gearRoll: true,
  };
}
// 거울에 비친 나 · 마지막 왕: 다른 기술을 빌려 쓴다 (이름은 그 기술의 주인 것으로)
const ROLE_MOVES = { melee: ['combo', 'leap', 'whirl', 'charge', 'cleave'], ranged: ['fan', 'split', 'rain', 'beam', 'retreat'], caster: ['nova', 'pool', 'rain', 'spiral', 'mark'] };
const RACE_ARTS = [
  ['dragon', 'fan', '용족의 각인 · 용의 숨결', '#ff7a2a'], ['elf', 'rain', '엘프의 각인 · 별빛 화살비', '#9fe3a8'], ['orc', 'charge', '오크의 각인 · 피의 돌진', '#c8503a'],
  ['dino', 'jumps3', '공룡족의 각인 · 땅울림 세 번', '#7ac85a'], ['assassin', 'clones', '암살자의 각인 · 그림자 분신', '#8a6aff'], ['undead', 'nova', '언데드의 각인 · 죽음의 파동', '#c45cff'],
  ['wizard', 'meteorRain', '마법사의 각인 · 운석 비', '#7ac8ff'], ['knight', 'cleave', '기사의 각인 · 심판의 대베기', '#ffd84a'],
];
export function bossAlias(w, e, p, pick, can, skillName) {
  if (pick === 'copy') {
    const role = ['bow', 'tube', 'throw', 'thrown', 'crossbow'].includes(w.b.wcat) ? 'ranged' : w.b.weapon?.dmg === 'mag' ? 'caster' : 'melee';
    const list = ROLE_MOVES[role].filter((k) => can[k]); if (!list.length) return null;
    const names = (w.b.skills || []).map(skillName).filter(Boolean);
    return { pick: w.rng.pick(list), name: names.length ? `「${w.rng.pick(names)}」` : '거울 속 나의 기술' };
  }
  if (pick === 'raceArt') {
    for (let k = 0; k < RACE_ARTS.length; k++) {
      const i = ((e.raceI = (e.raceI ?? -1) + 1)) % RACE_ARTS.length, [race, mv, name, color] = RACE_ARTS[i];
      if (!can[mv]) continue;
      e.raceLook = race; w.emit({ t: 'text', x: e.x, y: e.y - 52, text: name, color }); w.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 40, elem: 'holy', fx: 'holy' });
      return { pick: mv, name: name.split(' · ')[1] };
    }
    return null;
  }
  return null;
}

// true: 이번 틱은 기술 중 · false: 쓰고 바로 움직인다 · undefined: 모르는 기술
export function bossPickX(w, e, p, pick) {
  { const r = bossScriptPick(w, e, p, pick); if (r !== undefined) return r; } // 51~100층 피하는 기술 (bossmoves.js)
  const say = (txt, col = '#ffd0a0') => w.emit({ t: 'text', x: e.x, y: e.y - 30, text: txt, color: col });
  const nm = e.skillNames?.[pick], C = w.climb, Z = C?.gz;
  const aim = Math.atan2(p.y - e.y, p.x - e.x);
  switch (pick) {
    case 'gust': { // 보스가 부르는 돌풍: 보스에게서 멀어지는 쪽으로 (가장자리로 밀린다)
      say(nm || '돌풍'); const ang = Math.round(aim / (Math.PI / 4)) * (Math.PI / 4);
      w.emit({ t: 'gustTele', ang, dur: 0.9 }); w.delayed.push({ t: 0.9, run: () => { if (!e.dead) gustPush(w, ang, 1.2); } });
      return false;
    }
    case 'tornado': {
      say(nm || '회오리');
      for (const s of [-1, 1]) { const a = aim + s * 1.2, x = e.x + Math.cos(a) * 40, y = e.y + Math.sin(a) * 40; if (Z && !w.blocked(x, y, 6)) Z.hz.push({ k: 'tornado', x, y, t: 6, atk: e.atk * 0.45, src: e }); }
      return false;
    }
    case 'whalePass': { // 하늘 가르기: 고래가 하늘로 솟아 내 줄을 가로질러 지나간다 (넓은 그림자 길 1.4초 예고)
      say(nm || '하늘 가르기', '#cfefff');
      const horiz = w.rng.chance(0.5), mw = w.tw * TILE, mh = w.th * TILE;
      const lane = horiz ? { x1: 0, y1: p.y, x2: mw, y2: p.y } : { x1: p.x, y1: 0, x2: p.x, y2: mh };
      e.mv = { k: 'whalePass', boss: true, t: 2.6, lane, hit: false }; e.soaring = true; e.invulnT = 2.6;
      w.emit({ t: 'lineTele', ...lane, dur: 1.4, color: '#2a3a5a', w: 30 }); w.emit({ t: 'text', x: p.x, y: p.y - 30, text: '그림자 길에서 벗어나라!', color: '#ffe066' });
      return true;
    }
    case 'collapse': { // 구름 붕괴: 바닥 절반이 2초 뒤 하늘로 (10초 동안)
      if (!Z) return false;
      Z.collapsed = true; say(nm || '구름 붕괴', '#cfefff');
      const left = p.x < w.tw * TILE / 2, cx = w.map.climb.center.x, list = [];
      for (let y = 9; y < w.th - 3; y++) for (let x = 2; x < w.tw - 2; x++) { const i = y * w.tw + x; if (w.tiles[i] !== T_FLOOR || Math.abs(x - cx) <= 2) continue; if (left ? x < cx - 2 : x > cx + 2) list.push(i); }
      w.emit({ t: 'tileWarn', tiles: list, dur: 2, color: '#cfefff' });
      w.delayed.push({ t: 2, run: () => { for (const i of list) w.tiles[i] = T_LIQUID; w.emit({ t: 'mapChanged' }); w.emit({ t: 'shake', v: 6 }); } });
      w.delayed.push({ t: 12, run: () => { for (const i of list) if (w.tiles[i] === T_LIQUID) w.tiles[i] = T_FLOOR; w.emit({ t: 'mapChanged' }); if (Z) Z.collapsed = false; } });
      return false;
    }
    case 'shardHide': { // 거울 숨바꼭질: 여섯 거울 중 하나에 여왕이 숨는다 · 진짜를 때리면 드러나 기절 · 가짜를 깨면 파편이 나에게 튄다
      const spots = (w.map.climb?.shardSpots || []).map((s) => ({ x: s.x * TILE + 8, y: s.y * TILE + 8 })).filter((s) => !w.blocked(s.x, s.y, e.r));
      if (spots.length < 3) return false;
      w.emit({ t: 'banner', text: nm || '거울 숨바꼭질', color: '#e8f0ff' });
      for (let i = spots.length - 1; i > 0; i--) { const j = w.rng.int(0, i); [spots[i], spots[j]] = [spots[j], spots[i]]; }
      w.emit({ t: 'blink', x1: e.x, y1: e.y, x2: spots[0].x, y2: spots[0].y }); e.x = spots[0].x; e.y = spots[0].y;
      for (const s of spots.slice(1)) {
        const c = w.makeEnemy(e.defId, s.x, s.y, { summoned: true });
        c.hp = c.maxHp = e.maxHp * 0.02; c.atk = e.atk * 0.3; c.scale = e.scale; c.champion = e.champion; c.decoyOf = e.id; c.summoner = e.id; c.shardFake = true; c.state = 'idle'; c.speedMul = 0.001; c.home = { ...s }; c.noLoot = true; c.mvCd = 99; c.tintX = e.tintX;
        w.enemies.push(c); w.emit({ t: 'blink', x1: spots[0].x, y1: spots[0].y, x2: s.x, y2: s.y });
      }
      e.mv = { k: 'shardHide', boss: true, t: 8 }; e.hiding = true;
      return true;
    }
    case 'beltFlip': { // 컨베이어 역회전: 띠가 모두 거꾸로 · 6초 동안 두 배 빠르게
      for (const b of C.belts) { b.dx = -b.dx; b.dy = -b.dy; }
      Z.beltMul = 2; Z.beltMulT = 6;
      w.emit({ t: 'banner', text: nm || '컨베이어 역회전', color: '#d8a860' }); w.emit({ t: 'shake', v: 3 });
      return false;
    }
    case 'timeStop': { // 멈춘 시간: 3초 동안 나는 느려지고(-55%) 다른 적은 멈춘다 · 0.4초마다 내 자리에 칼날 · 끝나면 한꺼번에 떨어진다
      w.emit({ t: 'banner', text: nm || '멈춘 시간', color: '#ffe0a0' }); w.emit({ t: 'timeStop', dur: 3.2 });
      p.buffs.timeStopped = { t: 3.2, mods: { moveSpeed: 0.45 }, name: '멈춘 시간', color: '#ffe0a0' };
      for (const o of w.enemies) if (o !== e && !o.dead) o.st.stun = Math.max(o.st.stun || 0, 3.2);
      e.mv = { k: 'timeStop', boss: true, t: 3.2, spots: [], next: 0.2 };
      return true;
    }
    case 'rewind': { // 되감기: 2초 전의 내 자리에 잔상 → 1.2초 뒤 거기로 끌려간다 (구르면 피한다) → 그 자리가 터진다
      const g = Z?.hist[Math.max(0, Z.hist.length - 20)]; if (!g) return false;
      say(nm || '되감기', '#ffe0a0');
      w.emit({ t: 'ghostTele', x: g.x, y: g.y, dur: 1.5 }); w.emit({ t: 'telegraphCircle', x: g.x, y: g.y, r: 36, dur: 1.5 }); w.emit({ t: 'text', x: p.x, y: p.y - 30, text: '되감긴다! 굴러서 피하라', color: '#ffe066' });
      w.delayed.push({ t: 1.2, run: () => { if (e.dead) return; if (p.invuln > 0 || p.dashT > 0 || p.down) { w.emit({ t: 'text', x: p.x, y: p.y - 26, text: '피했다!', color: '#9fffb0' }); return; } w.emit({ t: 'afterimage', x1: p.x, y1: p.y, x2: g.x, y2: g.y }); if (!w.blocked(g.x, g.y, 5)) { p.x = g.x; p.y = g.y; } } });
      w.delayed.push({ t: 1.5, run: () => { if (e.dead) return; w.enemyArea(e, g.x, g.y, 36, e.atk * 2.0, 'mag', 'chill'); w.emit({ t: 'skillAoe', x: g.x, y: g.y, r: 36, fx: 'arcane' }); } });
      return false;
    }
    case 'shelfFall': { // 책장 쓰러뜨리기: 가로 · 세로로 줄 셋이 1.2초 뒤 무너진다 (줄 사이로 피한다)
      say(nm || '책장 쓰러뜨리기', '#c8b0ff');
      const horiz = w.rng.chance(0.5), mw = w.tw * TILE, mh = w.th * TILE, lines = [];
      for (const off of [-56, 0, 56]) lines.push(horiz ? { x1: 0, y1: p.y + off, x2: mw, y2: p.y + off } : { x1: p.x + off, y1: 0, x2: p.x + off, y2: mh });
      for (const L of lines) w.emit({ t: 'lineTele', ...L, dur: 1.2, color: '#8a6ac8', w: 14 });
      e.mv = { k: 'shelfFall', boss: true, t: 1.2, lines }; e.windT = 1.2; e.windMax = 1.2;
      return true;
    }
    case 'constellation': { // 별자리 긋기: 내 둘레의 별 다섯을 잇는 선 · 1.4초 뒤 선을 따라 별빛이 떨어진다
      say(nm || '별자리 긋기', '#c8d8ff');
      const pts = []; for (let i = 0; i < 5; i++) { const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(30, 120); pts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.8 }); }
      pts.sort((a, b) => Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x));
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; w.emit({ t: 'lineTele', x1: a.x, y1: a.y, x2: b.x, y2: b.y, dur: 1.4, color: '#c8d8ff', w: 8 }); w.emit({ t: 'telegraphCircle', x: a.x, y: a.y, r: 16, dur: 1.4 }); }
      e.mv = { k: 'constellation', boss: true, t: 1.4, pts }; e.windT = 1.4; e.windMax = 1.4;
      return true;
    }
    case 'douse': { // 빛 끄기: 켜진 빛기둥 하나를 끈다 · 다 꺼져 있으면 어둠이 차오른다(반경 8칸 · 1.2초 예고) · 처음 모두 꺼지면 분노
      const lit = w.objects.filter((o) => o.kind === 'lightPillar' && o.litT > 0).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));
      if (lit.length) { const o = lit[0]; o.litT = 0; o.label = '빛기둥 깨우기'; say(nm || '빛 끄기', '#c45cff'); w.emit({ t: 'beamFx', x1: e.x, y1: e.y - 8, x2: o.x, y2: o.y - 16 }); w.emit({ t: 'text', x: o.x, y: o.y - 34, text: '빛기둥이 꺼졌다 — 다시 깨워라(G)', color: '#c8b880' }); }
      else { say('어둠이 차오른다', '#c45cff'); e.mv = { k: 'nova', t: 1.2 }; w.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 110, dur: 1.2 }); e.windT = 1.2; e.windMax = 1.2; }
      if (!w.objects.some((o) => o.kind === 'lightPillar' && o.litT > 0) && !e.douseRage) { e.douseRage = true; e.atk *= 1.2; w.emit({ t: 'shake', v: 6 }); }
      return !lit.length;
    }
    case 'lightCore': { // 빛의 핵: 3.5초 동안 드러난다 (피해 2배) · 끝나기 0.9초 전부터 핵이 부풀어 둘레 7칸이 터진다
      w.exposeBoss(e, 3.5, 2, '빛의 핵!');
      w.delayed.push({ t: 2.6, run: () => { if (!e.dead) w.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 110, dur: 0.9 }); } });
      w.delayed.push({ t: 3.5, run: () => { if (e.dead) return; w.enemyArea(e, e.x, e.y, 110, e.atk * 2.2, 'mag'); w.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 110, elem: 'holy', fx: 'holy', ult: true }); w.emit({ t: 'shake', v: 8 }); } });
      return false;
    }
  }
  return undefined;
}

export function bossTickX(w, e, p, mv) {
  { const r = bossScriptTick(w, e, p, mv); if (r !== undefined) return r; }
  switch (mv.k) {
    case 'whalePass': {
      if (!mv.hit && mv.t <= 1.2) {
        mv.hit = true; const L = mv.lane;
        w.emit({ t: 'whaleShadow', ...L, dur: 0.7 }); w.emit({ t: 'shake', v: 7 });
        const prev = w.coTgt;
        for (const q of w.coTargets()) { const vx = L.x2 - L.x1, vy = L.y2 - L.y1, l2 = vx * vx + vy * vy, k = Math.max(0, Math.min(1, ((q.x - L.x1) * vx + (q.y - L.y1) * vy) / l2)); if (Math.hypot(q.x - L.x1 - vx * k, q.y - L.y1 - vy * k) < 30 + (q.r || 5)) { w.coTgt = q === w.player ? null : q; w.hurtPlayer(e.atk * 2.0, 'mag', e, { status: 'chill', fromX: q.x, fromY: q.y - 20 }); } }
        w.coTgt = prev;
        for (let i = 0; i < 2; i++) { // 등에서 정령이 떨어진다
          const k = w.rng.range(0.25, 0.75), x = L.x1 + (L.x2 - L.x1) * k, y = L.y1 + (L.y2 - L.y1) * k;
          if (w.blocked(x, y, 6) || w.voidZone && w.tileAt(x, y + 3) === T_LIQUID) continue;
          const m = w.makeEnemy(e.def.adds || 'windSpirit', x, y, { summoned: true }); m.summoner = e.id; m.state = 'chase'; m.home = { x, y }; w.enemies.push(m); w.emit({ t: 'summon', x, y });
        }
      }
      if (mv.t > 0) return true;
      const sp = w.climb?.spawns?.length ? w.rng.pick(w.climb.spawns) : { x: e.x, y: e.y };
      e.soaring = false; e.invulnT = 0;
      e.mv = { k: 'leap', t: 0.9, max: 0.9, x0: sp.x, y0: sp.y - 60, x: sp.x, y: sp.y }; e.x = sp.x; e.y = sp.y - 60; w.emit({ t: 'telegraphCircle', x: sp.x, y: sp.y, r: 38, dur: 0.9 });
      return true;
    }
    case 'shardHide': {
      const fakes = w.enemies.filter((o) => o.decoyOf === e.id && o.shardFake && !o.dead);
      if (e.foundT) { e.mv = null; e.hiding = false; return false; }
      if (mv.t > 0 && fakes.length) return true;
      // 시간이 다 됐다: 거울마다 나를 향해 광선
      for (const o of fakes) { w.bossLineHit(o, Math.atan2(p.y - o.y, p.x - o.x), 260, 8, e.atk * 1.0, 'bleed'); o.dead = true; w.emit({ t: 'blink', x1: o.x, y1: o.y, x2: e.x, y2: e.y }); }
      if (fakes.length) w.emit({ t: 'shake', v: 6 });
      e.mv = null; e.hiding = false; return false;
    }
    case 'timeStop': {
      if ((mv.next -= DT) <= 0 && mv.t > 0.3) { mv.next = 0.4; const s = { x: p.x, y: p.y }; mv.spots.push(s); w.emit({ t: 'telegraphCircle', x: s.x, y: s.y, r: 28, dur: mv.t + 0.05 }); w.emit({ t: 'timeBlade', x: s.x, y: s.y, dur: mv.t + 0.05 }); }
      if (mv.t > 0) return true;
      for (const s of mv.spots) { w.enemyArea(e, s.x, s.y, 28, e.atk * 1.5, 'phys', 'bleed'); w.emit({ t: 'skillAoe', x: s.x, y: s.y, r: 28, fx: 'spikes' }); }
      w.emit({ t: 'shake', v: 7 }); w.emit({ t: 'hitstop', v: 0.08 });
      e.mv = null; return true;
    }
    case 'shelfFall': {
      if (mv.t > 0) return true;
      const prev = w.coTgt;
      for (const L of mv.lines) {
        for (const q of w.coTargets()) { const vx = L.x2 - L.x1, vy = L.y2 - L.y1, l2 = vx * vx + vy * vy, k = Math.max(0, Math.min(1, ((q.x - L.x1) * vx + (q.y - L.y1) * vy) / l2)); if (Math.hypot(q.x - L.x1 - vx * k, q.y - L.y1 - vy * k) < 14 + (q.r || 5)) { w.coTgt = q === w.player ? null : q; w.hurtPlayer(e.atk * 1.7, 'phys', e, { fromX: q.x, fromY: q.y - 10 }); } }
        w.emit({ t: 'shelfFx', ...L });
        const k = w.rng.range(0.3, 0.7), x = L.x1 + (L.x2 - L.x1) * k, y = L.y1 + (L.y2 - L.y1) * k;
        if (!w.blocked(x, y, 6) && w.enemies.filter((o) => o.summoner === e.id && !o.dead).length < 4) { const m = w.makeEnemy(e.def.adds || 'bookworm', x, y, { summoned: true }); m.summoner = e.id; m.state = 'chase'; m.home = { x, y }; w.enemies.push(m); }
      }
      w.coTgt = prev; w.emit({ t: 'shake', v: 6 });
      e.mv = null; return true;
    }
    case 'constellation': {
      if (mv.t > 0) return true;
      const prev = w.coTgt, P = mv.pts;
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        for (const q of w.coTargets()) { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1, k = Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / l2)); if (Math.hypot(q.x - a.x - vx * k, q.y - a.y - vy * k) < 9 + (q.r || 5) && !(mv.hitSet ||= new Set()).has(q)) { mv.hitSet.add(q); w.coTgt = q === w.player ? null : q; w.hurtPlayer(e.atk * 1.7, 'mag', e, { status: 'burn', fromX: a.x, fromY: a.y }); } }
        w.emit({ t: 'beamFx', x1: a.x, y1: a.y, x2: b.x, y2: b.y }); w.emit({ t: 'skillAoe', x: a.x, y: a.y, r: 16, fx: 'meteor', elem: 'fire' });
      }
      w.coTgt = prev; w.emit({ t: 'shake', v: 5 });
      e.mv = null; return true;
    }
  }
  return undefined;
}
// 깨진 거울의 여왕: 숨은 동안 진짜를 맞히면 드러난다 · 가짜가 깨지면 파편
export function shardHit(w, e) {
  if (e.hiding && !e.foundT) {
    e.foundT = true; e.hiding = false; e.mv = null;
    for (const o of w.enemies) if (o.decoyOf === e.id && o.shardFake && !o.dead) { o.dead = true; w.emit({ t: 'death', x: o.x, y: o.y, color: '#e8f0ff', defId: o.defId, dir: o.dir }); }
    w.exposeBoss(e, 2.5, 1.8, '진짜를 찾았다!');
    w.delayed.push({ t: 2.6, run: () => { e.foundT = false; } });
  }
}
export function shardFakeDie(w, e) {
  if (!e.shardFake) return;
  const p = w.player, boss = w.enemies.find((o) => o.id === e.decoyOf);
  w.emit({ t: 'text', x: e.x, y: e.y - 24, text: '가짜!', color: '#e8f0ff' });
  for (let i = 0; i < 5; i++) { const a = Math.atan2(p.y - e.y, p.x - e.x) + (i - 2) * 0.22; w.projs.push({ owner: 'e', src: boss || e, x: e.x, y: e.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 1.6, dmg: (boss || e).atk * 0.5, type: 'phys', status: 'bleed', color: '#f0f8ff' }); }
}

// ───── 보스 등장: 결투장을 비추고 이름 · 한마디 (처음 만나면 3초 · 다음부터 1.6초) ─────
export const BOSS_INTRO = {
  climbChief: { title: '고블린의 우두머리', line: '「누가 감히 우리 야영지를!」', style: 'drop' },
  mossLord: { title: '고목에 깃든 이끼의 왕', line: '…뿌리가… 깨어난다…', style: 'rise' },
  bogHag: { title: '가라앉은 사원의 마녀', line: '「늪이 네 이름을 기억하게 해 주마」', style: 'form' },
  climbQueen: { title: '늪 그 자체', line: '', style: 'rise' },
  demonCaptain: { title: '불타는 방패의 대장', line: '「투기장에 온 걸 환영한다」', style: 'walk' },
  climbRift: { title: '균열을 지키는 자', line: '', style: 'rise' },
  frostOgre: { title: '빙하를 부수는 왕', line: '「크르르… 작다. 부서진다.」', style: 'drop' },
  climbWitch: { title: '서리 궁전의 주인', line: '「추위에 떨며 잠들어라」', style: 'form' },
  wraithLord: { title: '죽지 못한 기사단의 장', line: '「기사단이여, 다시 칼을 들어라」', style: 'rise' },
  engraveKing: { title: '각인을 처음 새긴 왕', line: '「탑을 오른 자여, 네 각인을 내놓아라」', style: 'walk' },
  stormHarpy: { title: '하늘 정원의 폭풍', line: '「바람이 너를 떨어뜨릴 것이다!」', style: 'drop' },
  skyWhale: { title: '구름 바다를 헤엄치는 고래', line: '', style: 'drop' },
  mirrorSelf: { title: '거울 미궁을 지키는 수정 기사', line: '「거울에 비친 것은 모두 베어진다」', style: 'form' },
  shardQueen: { title: '욕심이 깨뜨린 거울의 여왕', line: '「내 거울을 깬 값을 치러라」', style: 'form' },
  foreman: { title: '시계탑을 돌리는 증기 거신', line: '', style: 'drop' },
  clockKeeper: { title: '시계탑 깊은 곳에 묶여 있던 용', line: '', style: 'rise' },
  archivist: { title: '별의 서고를 지키는 대서고관', line: '「열람 허가가 없군. 지워 주마」', style: 'walk' },
  starReader: { title: '마탑의 옛 대현자', line: '「별은 이미 네 끝을 알고 있다」', style: 'form' },
  highPriest: { title: '빛을 끄는 교단의 대사제', line: '「빛은 꺼져야 한다. 왕이 그랬듯이」', style: 'walk' },
  lastKing: { title: '300년 전 탑의 문을 닫은 왕', line: '「…여기까지 왔구나. 빛을 지킬 자격이 있는지 보자」', style: 'walk' },
};
export function startIntro(w, e, sub, color) {
  const I = BOSS_INTRO[e.defId] || { title: sub, line: '', style: 'form' };
  const first = !(w.codex?.kills?.[e.defId] > 0), dur = first ? 3.0 : 1.6;
  e.introT = dur; e.introMax = dur; e.introStyle = I.style; e.invulnT = Math.max(e.invulnT || 0, dur);
  w.climb.intro = { t: dur, boss: e };
  w.emit({ t: 'bossIntro', x: e.x, y: e.y, name: e.champion || e.def.name, title: I.title, line: I.line, sub, color, dur, style: I.style, id: e.id });
}
export function introTick(w) {
  const I = w.climb?.intro; if (!I) return false;
  I.t -= DT;
  const e = I.boss;
  if (I.t <= 0 || e.dead) {
    w.climb.intro = null; e.introT = 0; e.invulnT = 0;
    if (e.introStyle === 'drop' || e.introStyle === 'rise') { w.emit({ t: 'shake', v: 7 }); w.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 46, fx: 'quake' }); }
    w.emit({ t: 'hitstop', v: 0.06 });
    return false;
  }
  return true;
}

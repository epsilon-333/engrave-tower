// 51~100층 보스의 피하는 기술 (2026-11-06): 모든 기술은 먼저 바닥 예고(빨간 줄 · 원)를 보여 주고, 정해진 때에 터진다.
// 기술 하나 = 「대본」: 언제 무엇을 예고하고 언제 터지는지 적은 목록 (ev) + 매 틱 할 일 (frame: 도는 광선 · 퍼지는 물결 · 튕기는 톱니)
// world.js(enemyai · towerzone)가 부른다: bossScriptPick(w, e, p, pick) → true/false/undefined · bossScriptTick(w, e, p, mv)
import { TILE } from './mapgen.js';

const DT = 1 / 60;
const RED = '#ff3a3a';

// ── 부품 ──
// 점 (x, y)를 지나 각도 a로 벽에서 벽까지 긋는 줄
function lineThrough(w, x, y, a, max = 420) {
  const f = w.rayLen(x, y, a, max), b = w.rayLen(x, y, a + Math.PI, max);
  return { x1: x - Math.cos(a) * b, y1: y - Math.sin(a) * b, x2: x + Math.cos(a) * f, y2: y + Math.sin(a) * f };
}
// 줄 위에 선 사람에게 피해 (once: 한 기술에서 한 번만)
function segHit(w, e, L, wd, dmg, status, once) {
  const prev = w.coTgt;
  for (const q of w.coTargets()) {
    if (once?.has(q)) continue;
    const vx = L.x2 - L.x1, vy = L.y2 - L.y1, l2 = vx * vx + vy * vy || 1, k = Math.max(0, Math.min(1, ((q.x - L.x1) * vx + (q.y - L.y1) * vy) / l2));
    if (Math.hypot(q.x - L.x1 - vx * k, q.y - L.y1 - vy * k) < wd + (q.r || 5)) { once?.add(q); w.coTgt = q === w.player ? null : q; w.hurtPlayer(dmg, 'mag', e, { status, fromX: e.x, fromY: e.y }); }
  }
  w.coTgt = prev;
}
const tele = (w, x, y, r, dur) => w.emit({ t: 'telegraphCircle', x, y, r, dur });
const teleLine = (w, L, dur, wd = 10, color = RED) => w.emit({ t: 'lineTele', ...L, dur, color, w: wd });
// 원이 터진다: 피해 + 그 보스의 재질로 터지는 그림
function boom(w, e, x, y, r, mul, kind = 'slam', status) {
  w.enemyArea(e, x, y, r, e.atk * mul, e.def.type || 'mag', status ?? e.def.status);
  if (!w.bfx(e, kind, x, y, r)) w.emit({ t: 'skillAoe', x, y, r, fx: 'burst', elem: BIT_ELEM[e.defId] });
}
const BIT_ELEM = { stormHarpy: 'wind', skyWhale: 'ice', mirrorSelf: 'arcane', shardQueen: 'ice', foreman: 'fire', clockKeeper: 'dark', archivist: 'dark', starReader: 'arcane', highPriest: 'holy', lastKing: 'ice', engraveKing: 'holy' };
const free = (w, x, y) => !w.blocked(x, y, 6);
// 내 둘레 아무 데나 (막힌 곳은 건너뛴다)
function around(w, p, r0, r1) {
  for (let i = 0; i < 12; i++) { const a = w.rng.range(0, Math.PI * 2), d = w.rng.range(r0, r1), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d; if (free(w, x, y)) return { x, y }; }
  return { x: p.x, y: p.y };
}

// ── 기술 대본 ──
// 대본: { t: 전체 시간, hold: 그동안 보스가 서 있나, ev: [[때, 할 일]], frame(el): 매 틱 }
const S = {
  // ───── 하피 여왕: 하늘을 휘젓는 날개 ─────
  featherStorm(w, e) { // 깃털 폭풍: 둘레로 깃털 열여섯 · 세 군데가 빈다 (빈 틈으로) · 두 번
    const ev = [];
    for (let k = 0; k < 2; k++) ev.push([0.5 + k * 0.7, () => {
      const gap = w.rng.range(0, Math.PI * 2), n = 30;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + k * (Math.PI / n); // 두 번째는 반 칸 엇갈려 if ([0, 1, 2].some((g) => Math.abs(Math.atan2(Math.sin(a - gap - g * 2.1), Math.cos(a - gap - g * 2.1))) < 0.22)) continue;
        w.projs.push({ owner: 'e', src: e, x: e.x, y: e.y - 8, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 2.2, dmg: e.atk * 0.7, type: 'phys', color: '#cfe8ff', kind: 'feather' }); }
    }]);
    return { t: 1.7, hold: true, ev };
  },
  dive3(w, e, p) { // 급강하 세 번: 내 자리에 그림자 원 → 내리꽂는다 (0.75초 간격 · 계속 움직여라)
    const ev = [];
    for (let k = 0; k < 3; k++) ev.push([k * 0.75, () => { const x = p.x, y = p.y; tele(w, x, y, 36, 0.7); w.delayed.push({ t: 0.7, run: () => { if (e.dead) return; if (free(w, x, y)) { e.blinkAt = w.t; e.x = x; e.y = y; } boom(w, e, x, y, 36, 1.5, 'slam'); } }); }]);
    return { t: 2.4, hold: true, ev, start: () => { e.soaring = true; e.invulnT = 2.3; }, end: () => { e.soaring = false; e.invulnT = 0; } };
  },
  galeLanes(w, e, p) { // 바람길: 나란한 바람 줄 셋이 1.2초 뒤 휘몰아친다 (줄 사이로)
    const a = w.rng.chance(0.5) ? 0 : Math.PI / 2, nx = -Math.sin(a), ny = Math.cos(a), lanes = [-56, 0, 56].map((o) => lineThrough(w, p.x + nx * o, p.y + ny * o, a));
    for (const L of lanes) teleLine(w, L, 1.2, 14, '#9fe8ff');
    const once = new Set();
    return { t: 1.5, hold: true, ev: [[1.2, () => { for (const L of lanes) { segHit(w, e, L, 14, e.atk * 1.6, null, once); w.emit({ t: 'beamFx', ...L, elem: 'wind' }); } w.emit({ t: 'shake', v: 5 }); }]] };
  },
  // ───── 하늘 고래: 거대한 몸 · 넓은 범위 ─────
  swallow(w, e, p) { // 삼키기: 입 앞 넓은 부채꼴로 1.3초 동안 빨아들인 뒤 문다 (옆으로 빠져라)
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = -3; i <= 3; i++) { const a = ang + i * 0.16; teleLine(w, { x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * 170, y2: e.y + Math.sin(a) * 170 }, 1.3, 5, '#ffb03a'); }
    w.emit({ t: 'text', x: e.x, y: e.y - 44, text: '옆으로!', color: '#ffe066' });
    const inCone = (q) => { const dx = q.x - e.x, dy = q.y - e.y, d = Math.hypot(dx, dy); let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); return d < 175 && Math.abs(da) < 0.55; };
    return { t: 1.6, hold: true, frame: (el) => { if (el < 1.3 && inCone(w.player) && !(w.player.dashT > 0)) { const dx = e.x - w.player.x, dy = e.y - w.player.y, l = Math.hypot(dx, dy) || 1, nx = w.player.x + (dx / l) * 40 * DT, ny = w.player.y + (dy / l) * 40 * DT; if (!w.blocked(nx, ny, 5)) { w.player.x = nx; w.player.y = ny; } } }, // 빨려 든다
      ev: [[1.3, () => { const prev = w.coTgt; for (const q of w.coTargets()) if (inCone(q)) { w.coTgt = q === w.player ? null : q; w.hurtPlayer(e.atk * 2.4, 'phys', e, { fromX: e.x, fromY: e.y }); } w.coTgt = prev; w.emit({ t: 'skillCone', x: e.x, y: e.y, ang, range: 175, angle: 1.1, fx: 'sweep', elem: 'ice' }); w.emit({ t: 'shake', v: 8 }); }]] };
  },
  waterSpouts(w, e, p) { // 물기둥: 내 둘레 여덟 곳에서 차례로 솟는다
    const ev = [];
    for (let k = 0; k < 8; k++) ev.push([k * 0.18, () => { const s = k % 3 === 0 ? { x: w.player.x, y: w.player.y } : around(w, w.player, 20, 90); tele(w, s.x, s.y, 26, 0.9); w.delayed.push({ t: 0.9, run: () => { if (!e.dead) boom(w, e, s.x, s.y, 26, 1.2, 'rain', 'chill'); } }); }]);
    return { t: 1.5, hold: false, ev };
  },
  songWave(w, e) { return wave(w, e, { speed: 120, max: 230, gaps: 2, mul: 1.4, status: 'chill', color: '#9fe8ff' }); }, // 고래의 노래: 퍼지는 물결 · 빈 틈 둘로
  // ───── 수정 기사: 막고 받아친다 ─────
  crystalBlades(w, e, p) { // 수정 검기: 부채꼴 세 줄이 1초 뒤 베인다 → 0.4초 뒤 그 사이 두 줄 (사이에서 사이로)
    const ang = Math.atan2(p.y - e.y, p.x - e.x), mk = (o) => ({ x1: e.x, y1: e.y, x2: e.x + Math.cos(ang + o) * w.rayLen(e.x, e.y, ang + o, 240), y2: e.y + Math.sin(ang + o) * w.rayLen(e.x, e.y, ang + o, 240) });
    const A = [-0.45, 0, 0.45].map(mk), B = [-0.22, 0.22].map(mk), oa = new Set(), ob = new Set();
    for (const L of A) teleLine(w, L, 1.0, 9);
    return { t: 1.8, hold: true, ev: [[1.0, () => { for (const L of A) { segHit(w, e, L, 9, e.atk * 1.6, 'bleed', oa); w.emit({ t: 'beamFx', ...L, elem: 'arcane' }); } for (const L of B) teleLine(w, L, 0.4, 9); }], [1.4, () => { for (const L of B) { segHit(w, e, L, 9, e.atk * 1.6, 'bleed', ob); w.emit({ t: 'beamFx', ...L, elem: 'arcane' }); } }]] };
  },
  shardRing(w, e) { return wave(w, e, { speed: 140, max: 240, gaps: 1, mul: 1.5, status: 'bleed', color: '#d8d0ff', twice: true }); }, // 파편 물결 두 번 (틈은 매번 다른 곳)
  crystalCage(w, e, p) { return cage(w, e, p, { mul: 2.2, status: 'bleed', kind: 'nova' }); },
  // ───── 얼음 여왕: 얼음 결정 · 갇히기 ─────
  iceLance(w, e, p) { // 얼음창: 나를 지나는 긴 줄 → 0.5초 뒤 엇갈린 두 줄 (X)
    const a = Math.atan2(p.y - e.y, p.x - e.x), L0 = lineThrough(w, p.x, p.y, a), X = [a + 0.8, a - 0.8].map((b) => lineThrough(w, p.x, p.y, b)), o0 = new Set(), o1 = new Set();
    teleLine(w, L0, 0.9, 10, '#9fe8ff');
    return { t: 1.7, hold: true, ev: [[0.9, () => { segHit(w, e, L0, 10, e.atk * 1.7, 'chill', o0); w.emit({ t: 'beamFx', ...L0, elem: 'ice' }); for (const L of X) teleLine(w, L, 0.6, 10, '#9fe8ff'); }], [1.5, () => { for (const L of X) { segHit(w, e, L, 10, e.atk * 1.7, 'chill', o1); w.emit({ t: 'beamFx', ...L, elem: 'ice' }); } }]] };
  },
  crystalRain(w, e, p) { // 결정 비: 둘레에 결정 열둘이 0.12초 간격으로 떨어진다 (자리마다 예고)
    const ev = [];
    for (let k = 0; k < 12; k++) ev.push([k * 0.12, () => { const s = k % 4 === 0 ? { x: w.player.x, y: w.player.y } : around(w, w.player, 16, 110); tele(w, s.x, s.y, 22, 0.8); w.delayed.push({ t: 0.8, run: () => { if (!e.dead) boom(w, e, s.x, s.y, 22, 1.0, 'rain', 'chill'); } }); }]);
    return { t: 1.6, hold: false, ev };
  },
  iceCage(w, e, p) { return cage(w, e, p, { mul: 2.4, status: 'chill', kind: 'nova' }); }, // 얼음 감옥: 내 둘레에 얼음벽 · 빈 곳 하나로 나가라
  // ───── 증기 거신: 황금 관 · 증기 ─────
  pipesFloor(w, e, p) { // 황금 관 솟기: 바닥에 나란한 줄 넷 · 1.1초 뒤 관이 솟으며 증기 (줄 사이 칸으로)
    const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2, nx = -Math.sin(a), ny = Math.cos(a), off = w.rng.range(-8, 8); // 한 줄은 반드시 내 자리를 지난다 · 줄 사이 칸(56px)이 안전
    const lanes = [-2, -1, 0, 1, 2].map((k) => lineThrough(w, p.x + nx * (k * 56 + off), p.y + ny * (k * 56 + off), a)), once = new Set();
    for (const L of lanes) teleLine(w, L, 1.1, 12, '#ffcf5a');
    w.emit({ t: 'text', x: p.x, y: p.y - 30, text: '줄 사이로!', color: '#ffe066' });
    return { t: 1.6, hold: true, ev: [[1.1, () => { for (const L of lanes) { segHit(w, e, L, 12, e.atk * 1.7, 'burn', once); w.emit({ t: 'pipeRise', ...L, dur: 0.9 }); } w.emit({ t: 'shake', v: 6 }); }]] };
  },
  pipesWall(w, e, p) { // 벽에서 나오는 관: 사방 벽에서 관이 튀어나와 내 가로 · 세로 줄을 가로지른다 (0.5초 엇갈려 두 번)
    const H = lineThrough(w, p.x, p.y, 0), V = lineThrough(w, p.x, p.y, Math.PI / 2), o1 = new Set(), o2 = new Set();
    teleLine(w, H, 1.0, 14, '#ffcf5a');
    return { t: 2.0, hold: true, ev: [[1.0, () => { segHit(w, e, H, 14, e.atk * 1.8, 'burn', o1); w.emit({ t: 'pipeRise', ...H, dur: 0.8, wall: true }); const V2 = lineThrough(w, w.player.x, w.player.y, Math.PI / 2); Object.assign(V, V2); teleLine(w, V, 0.7, 14, '#ffcf5a'); }],
      [1.7, () => { segHit(w, e, V, 14, e.atk * 1.8, 'burn', o2); w.emit({ t: 'pipeRise', ...V, dur: 0.8, wall: true }); w.emit({ t: 'shake', v: 6 }); }]] };
  },
  gearRoll(w, e, p) { // 톱니 굴리기: 큰 톱니 셋이 벽에 튕기며 5초 동안 굴러다닌다
    const bits = [];
    for (let i = 0; i < 3; i++) { const a = Math.atan2(p.y - e.y, p.x - e.x) + (i - 1) * 0.6; bits.push({ x: e.x, y: e.y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, r: 13, kind: 'gear', hitT: 0 }); }
    return bitsMove(w, e, bits, { t: 5, mul: 1.2, status: 'bleed', bounce: true });
  },
  // ───── 뼈 용: 보라 불꽃 · 뼈 가시 ─────
  boneBreath(w, e, p) { // 뼈 숨결: 앞쪽을 천천히 쓸고 지나가는 보라 불꽃 (도는 쪽 반대로 돌아라)
    const dir = w.rng.chance(0.5) ? 1 : -1, a0 = Math.atan2(p.y - e.y, p.x - e.x) - dir * 0.9;
    return spin(w, e, { n: 1, a0, span: 1.8 * dir, dur: 2.0, wind: 0.9, len: 200, wd: 16, mul: 0.9, status: 'curse', elem: 'dark' });
  },
  boneSpikes(w, e, p) { // 뼈 가시 길: 나를 향해 세 갈래로 가시가 차례로 솟는다
    const a = Math.atan2(p.y - e.y, p.x - e.x), ev = [];
    for (const o of [-0.45, 0, 0.45]) for (let k = 1; k <= 7; k++) { const d = k * 28, x = e.x + Math.cos(a + o) * d, y = e.y + Math.sin(a + o) * d; if (!free(w, x, y)) break; ev.push([k * 0.12, () => tele(w, x, y, 16, 0.55)]); ev.push([k * 0.12 + 0.55, () => boom(w, e, x, y, 16, 1.3, 'trail', 'bleed')]); }
    return { t: 1.6, hold: true, ev };
  },
  boneRain(w, e, p) { // 뼈 비: 하늘에서 뼈가 쏟아진다 (열 군데 · 발밑 둘)
    const ev = [];
    for (let k = 0; k < 10; k++) ev.push([k * 0.14, () => { const s = k % 5 === 0 ? { x: w.player.x, y: w.player.y } : around(w, w.player, 20, 120); tele(w, s.x, s.y, 26, 0.85); w.delayed.push({ t: 0.85, run: () => { if (!e.dead) boom(w, e, s.x, s.y, 26, 1.2, 'rain', 'curse'); } }); }]);
    return { t: 1.6, hold: false, ev };
  },
  roarWave(w, e) { return wave(w, e, { speed: 150, max: 260, gaps: 1, mul: 1.6, status: 'curse', color: '#c8a8ff', twice: true }); }, // 포효: 퍼지는 충격 두 번
  // ───── 대서고관: 책 · 마법진 ─────
  tomeOrbs(w, e) { // 떠다니는 금서: 책 넷이 나를 따라오다 3초 뒤 터진다 (예고 원)
    const bits = [];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; bits.push({ x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 30, vx: 0, vy: 0, r: 9, kind: 'book', hitT: 0, home: 55 + i * 6, life: 3 }); }
    return bitsMove(w, e, bits, { t: 3.3, mul: 0, homing: true, pop: { r: 34, mul: 1.4, tele: 0.7 } });
  },
  sealCircle(w, e, p) { // 봉인 마법진: 내 자리에 큰 마법진 · 1.6초 동안 차오르면 터진다 (밖으로) · 안쪽 작은 원은 0.5초 먼저
    const x = p.x, y = p.y;
    tele(w, x, y, 70, 1.6); tele(w, x, y, 26, 1.1);
    return { t: 1.8, hold: false, ev: [[1.1, () => boom(w, e, x, y, 26, 1.0, 'nova')], [1.6, () => { boom(w, e, x, y, 70, 1.8, 'nova', 'curse'); w.emit({ t: 'shake', v: 6 }); }]] };
  },
  // ───── 별을 읽는 자: 별자리 · 떨어지는 별 ─────
  starFall(w, e, p) { // 유성 셋: 내 자리에 연달아 떨어진다 (0.55초 간격)
    const ev = [];
    for (let k = 0; k < 3; k++) ev.push([k * 0.55, () => { const x = w.player.x, y = w.player.y; tele(w, x, y, 34, 0.9); w.delayed.push({ t: 0.9, run: () => { if (!e.dead) boom(w, e, x, y, 34, 1.5, 'fall'); } }); }]);
    return { t: 2.2, hold: false, ev };
  },
  starGate(w, e, p) { // 별의 문: 둘레 벽의 문 둘 사이로 광선이 오간다 (나를 지나는 줄 · 세 번)
    const ev = [], once = [new Set(), new Set(), new Set()];
    for (let k = 0; k < 3; k++) ev.push([k * 0.8, () => { const L = lineThrough(w, w.player.x, w.player.y, w.rng.range(0, Math.PI)); teleLine(w, L, 0.8, 10, '#c8a8ff'); w.delayed.push({ t: 0.8, run: () => { if (e.dead) return; segHit(w, e, L, 10, e.atk * 1.6, 'curse', once[k]); w.emit({ t: 'beamFx', ...L, elem: 'arcane' }); } }); }]);
    return { t: 2.6, hold: false, ev };
  },
  starSpin(w, e) { return spin(w, e, { n: 5, a0: w.rng.range(0, 6.28), span: Math.PI * 0.8, dur: 3.2, wind: 1.0, len: 240, wd: 9, mul: 0.8, status: 'curse', elem: 'arcane' }); }, // 별빛 다섯 줄이 천천히 돈다
  // ───── 교단 대사제: 빛 · 심판 ─────
  judgePillars(w, e, p) { // 심판의 빛기둥: 나를 향해 빛기둥이 줄지어 다가온다 (옆으로)
    const a = Math.atan2(p.y - e.y, p.x - e.x), ev = [];
    for (let k = 1; k <= 9; k++) { const d = k * 26, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d; if (!free(w, x, y)) break; ev.push([k * 0.15, () => tele(w, x, y, 22, 0.6)]); ev.push([k * 0.15 + 0.6, () => boom(w, e, x, y, 22, 1.5, 'nova')]); }
    for (const s of [-1, 1]) for (let k = 2; k <= 6; k++) { const d = k * 30, b = a + s * 0.5, x = e.x + Math.cos(b) * d, y = e.y + Math.sin(b) * d; if (!free(w, x, y)) break; ev.push([0.5 + k * 0.15, () => tele(w, x, y, 20, 0.6)]); ev.push([1.1 + k * 0.15, () => boom(w, e, x, y, 20, 1.3, 'nova')]); }
    return { t: 2.3, hold: true, ev };
  },
  wheelThrow(w, e, p) { // 빛의 바퀴: 지팡이의 바퀴 둘을 던진다 · 끝까지 가면 되돌아온다 (두 번 피하라)
    const a = Math.atan2(p.y - e.y, p.x - e.x), bits = [-0.25, 0.25].map((o) => ({ x: e.x, y: e.y, vx: Math.cos(a + o) * 190, vy: Math.sin(a + o) * 190, r: 12, kind: 'wheel', hitT: 0, back: 1.1 }));
    for (const b of bits) teleLine(w, { x1: e.x, y1: e.y, x2: e.x + b.vx * 1.1, y2: e.y + b.vy * 1.1 }, 0.6, 8, '#ffe08a');
    return bitsMove(w, e, bits, { t: 2.8, mul: 1.3, status: 'burn', delay: 0.6, boomerang: true });
  },
  // ───── 마지막 왕 · 각인의 왕: 한 바퀴 도는 광선 ─────
  spinBeam(w, e, p) { // 한 바퀴 광선: 보스 둘레로 광선 둘이 한 바퀴 돈다 (광선 뒤를 따라 돌아라)
    const dir = w.rng.chance(0.5) ? 1 : -1;
    return spin(w, e, { n: 2, a0: Math.atan2(p.y - e.y, p.x - e.x) + 0.6 * dir, span: Math.PI * 2 * dir, dur: 4.2, wind: 1.1, len: 260, wd: 11, mul: 0.9, status: e.def.status, elem: BIT_ELEM[e.defId] || 'holy' });
  },
  flameCrescent(w, e, p) { // 푸른 불꽃 검기: 앞 반원을 크게 벤 뒤, 0.5초 뒤 등 뒤 반원 (보스 곁을 돌아라)
    const a = Math.atan2(p.y - e.y, p.x - e.x), half = (ang) => { const prev = w.coTgt; for (const q of w.coTargets()) { const dx = q.x - e.x, dy = q.y - e.y; let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.hypot(dx, dy) < 120 + (q.r || 5) && Math.abs(da) < 1.6) { w.coTgt = q === w.player ? null : q; w.hurtPlayer(e.atk * 2.2, 'phys', e, { status: 'chill', fromX: e.x, fromY: e.y }); } } w.coTgt = prev; w.emit({ t: 'skillCone', x: e.x, y: e.y, ang, range: 120, angle: 3.2, fx: 'sweep', elem: 'ice' }); w.emit({ t: 'shake', v: 6 }); };
    const fan = (ang, dur) => { for (let i = -4; i <= 4; i++) { const b = ang + i * 0.38; teleLine(w, { x1: e.x, y1: e.y, x2: e.x + Math.cos(b) * 120, y2: e.y + Math.sin(b) * 120 }, dur, 4, '#7ac8ff'); } };
    fan(a, 1.0);
    return { t: 2.0, hold: true, ev: [[1.0, () => { half(a); fan(a + Math.PI, 0.6); }], [1.6, () => half(a + Math.PI)]] };
  },
};

// 퍼지는 물결: 보스에게서 고리가 퍼진다 · 빈 틈(gaps)으로 지나가거나 구르면 피한다
function wave(w, e, o) {
  const run = (start) => { const gaps = Array.from({ length: o.gaps }, () => w.rng.range(0, Math.PI * 2)), hit = new Set(), x = e.x, y = e.y;
    for (const g of gaps) teleLine(w, { x1: x, y1: y, x2: x + Math.cos(g) * o.max, y2: y + Math.sin(g) * o.max }, 0.7, 12, '#9fffb0'); // 초록 줄 = 빈 틈
    return { start, gaps, hit, x, y }; };
  const waves = [];
  const ev = [[0, () => waves.push(run(0.7))]];
  if (o.twice) ev.push([1.5, () => waves.push(run(2.2))]);
  const T = (o.twice ? 2.2 : 0.7) + o.max / o.speed + 0.1;
  return { t: T, hold: true, ev, frame: (el) => {
    for (const W of waves) {
      if (el < W.start) continue;
      const r = (el - W.start) * o.speed; if (r > o.max) continue;
      if (Math.floor(el / DT) % 4 === 0) w.emit({ t: 'waveFx', x: W.x, y: W.y, r, gaps: W.gaps, color: o.color });
      const prev = w.coTgt;
      for (const q of w.coTargets()) {
        if (W.hit.has(q)) continue;
        const d = Math.hypot(q.x - W.x, q.y - W.y); if (Math.abs(d - r) > 9 + (q.r || 5)) continue;
        const a = Math.atan2(q.y - W.y, q.x - W.x); if (W.gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.32)) continue;
        W.hit.add(q); w.coTgt = q === w.player ? null : q; w.hurtPlayer(e.atk * o.mul, 'mag', e, { status: o.status, fromX: W.x, fromY: W.y });
      }
      w.coTgt = prev;
    }
  } };
}
// 도는 광선: n줄이 a0에서 span만큼 돈다 (처음 wind초는 예고선만)
function spin(w, e, o) {
  const ang = (el, i) => o.a0 + (i / o.n) * Math.PI * 2 + o.span * Math.max(0, Math.min(1, (el - o.wind) / (o.dur - o.wind)));
  for (let i = 0; i < o.n; i++) { const a = ang(0, i), bl = w.rayLen(e.x, e.y, a, o.len); teleLine(w, { x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * bl, y2: e.y + Math.sin(a) * bl }, o.wind, o.wd, RED); }
  w.emit({ t: 'text', x: e.x, y: e.y - 48, text: o.span > 0 ? '⟳ 광선을 따라 돌아라' : '⟲ 광선을 따라 돌아라', color: '#ffe066' });
  let fxT = 0, hitT = 0;
  return { t: o.dur + 0.1, hold: true, frame: (el) => {
    if (el < o.wind) return;
    fxT -= DT; hitT -= DT;
    for (let i = 0; i < o.n; i++) {
      const a = ang(el, i), bl = w.rayLen(e.x, e.y, a, o.len), L = { x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * bl, y2: e.y + Math.sin(a) * bl };
      if (fxT <= 0) w.emit({ t: 'beamFx', ...L, elem: o.elem, from: e.id, quiet: i > 0 });
      if (hitT <= 0) segHit(w, e, L, o.wd, e.atk * o.mul, o.status);
    }
    if (fxT <= 0) fxT = 0.05;
    if (hitT <= 0) hitT = 0.3;
  } };
}
// 감옥: 내 둘레에 벽(닿으면 피해) · 빈 곳 하나 · 1.4초 뒤 가운데가 터진다
function cage(w, e, p, o) {
  const x = p.x, y = p.y, R = 52, gap = w.rng.range(0, Math.PI * 2), posts = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap))) < 0.45) continue; posts.push({ x: x + Math.cos(a) * R, y: y + Math.sin(a) * R }); }
  for (const s of posts) w.emit({ t: 'skillAoe', x: s.x, y: s.y, r: 10, fx: 'crystal', elem: BIT_ELEM[e.defId] || 'ice' });
  tele(w, x, y, R - 6, 1.4);
  teleLine(w, { x1: x, y1: y, x2: x + Math.cos(gap) * (R + 20), y2: y + Math.sin(gap) * (R + 20) }, 1.4, 12, '#9fffb0');
  w.emit({ t: 'text', x, y: y - 40, text: '초록 길로 나가라!', color: '#9fffb0' });
  let hitT = 0;
  return { t: 1.6, hold: false, frame: (el) => {
    if (el > 1.4) return;
    if ((hitT -= DT) > 0) return;
    if (Math.floor(el * 20) % 3 === 0) for (const s of posts) w.emit({ t: 'spark', x: s.x, y: s.y - 6, color: '#d8f4ff' });
    for (const s of posts) { const q = w.player; if (Math.hypot(q.x - s.x, q.y - s.y) < 11 + (q.r || 5) && !(q.dashT > 0)) { w.hurtPlayer(e.atk * 0.6, 'mag', e, { status: o.status, fromX: s.x, fromY: s.y }); hitT = 0.4; break; } }
  }, ev: [[1.4, () => boom(w, e, x, y, R - 6, o.mul, o.kind, o.status)]] };
}
// 날아다니는 것 (톱니 · 책 · 바퀴): 그림은 render(bossBit)가 그린다
function bitsMove(w, e, bits, o) {
  const t0 = o.delay || 0;
  return { t: o.t + t0, hold: false, frame: (el) => {
    if (el < t0) { for (const b of bits) w.emit({ t: 'bossBit', x: b.x, y: b.y, kind: b.kind, r: b.r, rot: 0 }); return; }
    const p = w.player;
    for (const b of bits) {
      if (b.gone) continue;
      if (o.homing) { const dx = p.x - b.x, dy = p.y - b.y, l = Math.hypot(dx, dy) || 1, sp = b.home; b.vx += ((dx / l) * sp - b.vx) * 2 * DT; b.vy += ((dy / l) * sp - b.vy) * 2 * DT; }
      if (o.boomerang && b.back != null && el - t0 > b.back && !b.returning) { b.returning = true; b.hitSet = null; }
      if (b.returning) { const dx = e.x - b.x, dy = e.y - b.y, l = Math.hypot(dx, dy) || 1; b.vx = (dx / l) * 200; b.vy = (dy / l) * 200; if (l < 14) { b.gone = true; continue; } }
      const nx = b.x + b.vx * DT, ny = b.y + b.vy * DT;
      if (w.blocked(nx, ny, b.r * 0.6)) { if (o.bounce) { if (w.blocked(nx, b.y, b.r * 0.6)) b.vx *= -1; if (w.blocked(b.x, ny, b.r * 0.6)) b.vy *= -1; w.emit({ t: 'spark', x: b.x, y: b.y, color: '#ffe0a0' }); } else if (o.boomerang) { b.returning = true; } else { b.vx = 0; b.vy = 0; } }
      else { b.x = nx; b.y = ny; }
      b.rot = (b.rot || 0) + DT * 9;
      w.emit({ t: 'bossBit', x: b.x, y: b.y, kind: b.kind, r: b.r, rot: b.rot });
      if (o.pop && b.life != null) {
        b.life -= DT;
        if (b.life <= o.pop.tele && !b.teled) { b.teled = true; b.vx *= 0.2; b.vy *= 0.2; b.home = 0; tele(w, b.x, b.y, o.pop.r, o.pop.tele); }
        if (b.life <= 0) { b.gone = true; boom(w, e, b.x, b.y, o.pop.r, o.pop.mul, 'nova', 'curse'); }
        continue;
      }
      if (o.mul > 0) { const hs = (b.hitSet ||= new Set()); if (!hs.has(p) && Math.hypot(p.x - b.x, p.y - b.y) < b.r + (p.r || 5) && !(p.dashT > 0)) { hs.add(p); w.hurtPlayer(e.atk * o.mul, 'phys', e, { status: o.status, fromX: b.x, fromY: b.y }); setTimeoutSim(w, 0.6, () => hs.delete(p)); } }
    }
  } };
}
const setTimeoutSim = (w, t, run) => w.delayed.push({ t, run });

// 이름 (보스마다 적지 않으면 이 이름)
export const SCRIPT_NAMES = {
  featherStorm: '깃털 폭풍', dive3: '급강하', galeLanes: '바람길', swallow: '삼키기', waterSpouts: '물기둥', songWave: '고래의 노래',
  crystalBlades: '수정 검기', shardRing: '파편 물결', crystalCage: '수정 감옥', iceLance: '얼음창', crystalRain: '결정 비', iceCage: '얼음 감옥',
  pipesFloor: '황금 관 솟기', pipesWall: '벽의 증기 관', gearRoll: '톱니 굴리기', boneBreath: '뼈 숨결', boneSpikes: '뼈 가시 길', boneRain: '뼈 비', roarWave: '용의 포효',
  tomeOrbs: '떠다니는 금서', sealCircle: '봉인 마법진', starFall: '유성', starGate: '별의 문', starSpin: '별빛 회전',
  judgePillars: '심판의 빛기둥', wheelThrow: '빛의 바퀴', spinBeam: '한 바퀴 광선', flameCrescent: '푸른 불꽃 검기',
};
export const SCRIPT_MOVES = new Set(Object.keys(S));

// 기술을 고르면: 대본을 만든다 (모르는 기술이면 undefined)
export function bossScriptPick(w, e, p, pick) {
  if (!S[pick]) return undefined;
  const sc = S[pick](w, e, p); if (!sc) return false;
  const own = (e.skillNames || e.def.skillNames)?.[pick];
  if (sc.hold || !own) w.emit({ t: 'text', x: e.x, y: e.y - 30, text: own || SCRIPT_NAMES[pick], color: '#ffd0a0' }); // 서서 쓰지 않는 기술은 enemyai 가 이름을 띄운다
  sc.start?.();
  e.mv = { k: 'script', boss: true, name: pick, t: sc.t, total: sc.t, el: 0, sc };
  if (sc.hold) { e.windT = Math.min(1.2, sc.t); e.windMax = e.windT; }
  return !!sc.hold;
}
export function bossScriptTick(w, e, p, mv) {
  if (mv.k !== 'script') return undefined;
  const sc = mv.sc; mv.el = mv.total - mv.t; // mv.t 는 enemyai 가 줄인다
  if (sc.ev) for (const ev of sc.ev) if (!ev.done && mv.el >= ev[0]) { ev.done = true; ev[1](); }
  sc.frame?.(mv.el);
  if (mv.t > 0) return !!sc.hold;
  sc.end?.(); e.mv = null; return !!sc.hold;
}
// 보스가 죽거나 층을 나가면 남은 대본은 버린다 (delayed 에 걸린 터짐은 e.dead 로 막는다)
export const scriptTile = TILE;

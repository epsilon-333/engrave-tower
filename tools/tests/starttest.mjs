// 처음 시작 · 튜토리얼 · 몸 상태가 다시 망가지지 않게:
// 1) 새 캐릭터가 바깥 세계 시작 자리에서 막혀 있지 않다 (마차 · 물건과 겹치지 않는다)
// 2) 튜토리얼 허수아비 자리(World.openSpot)는 걸어서 닿고, 무기를 휘두르면 맞는다
// 3) 플레이어에게 걸린 상태이상은 모두 시간이 지나면 풀린다 (예전: 저주 · 감전이 영영 남았다)
// 4) 플레이어가 맵 밖에 있어도 거리장 계산이 멈추지 않는다
// 5) 회복은 적힌 숫자 그대로 들어온다 (숨은 배율 없음)
import { buildOverworld, WORLD_ZONE } from '../../public/js/data/maps/overworld.js';
import { computeBuild } from '../../public/js/sim/build.js';
import { World } from '../../public/js/sim/world.js';

let ok = true;
const check = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) ok = false; };
const idle = (w) => ({ moveX: 0, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y });

const b = computeBuild({ race: 'knight', cls: 'guardian', level: 1, alloc: {}, engravings: {}, gear: { weapon: 'guardSword' } });
const w = new World({ build: b, mode: 'field', zone: WORLD_ZONE, zoneId: 'world', seed: 7, map: buildOverworld(WORLD_ZONE) });
for (let i = 0; i < 30; i++) { w.step(idle(w)); w.signals.length = 0; w.events.length = 0; }
const p = w.player;

// 1) 시작 자리
check(!w.blocked(p.x, p.y, 6), `시작 자리가 막혀 있지 않다 (${Math.round(p.x)}, ${Math.round(p.y)})`);
const coach = w.objects.find((o) => o.kind === 'coach');
check(!coach || Math.hypot(coach.x - p.x, coach.y - p.y) > 64, `역마차가 시작 자리와 떨어져 있다 (${coach ? Math.round(Math.hypot(coach.x - p.x, coach.y - p.y)) : '-'}px)`);

// 2) 허수아비 자리: 걸어가서 평타 세 번
const at = w.openSpot(p.x, p.y);
const d = w.makeEnemy('dummy', at.x, at.y); d.home = { x: d.x, y: d.y }; w.enemies.push(d);
check(!w.objects.some((o) => Math.hypot(o.x - at.x, o.y - at.y) < 28), '허수아비 둘레에 물건이 없다');
let hits = 0, hp = d.hp;
for (let f = 0; f < 60 * 8 && hits < 3; f++) {
  const dx = d.x - p.x, dy = d.y - p.y, l = Math.hypot(dx, dy) || 1, far = l > 18;
  w.step({ moveX: far ? dx / l : 0, moveY: far ? dy / l : 0, aimX: d.x, aimY: d.y, attack: !far });
  w.signals.length = 0; w.events.length = 0;
  if (d.hp < hp) { hits++; hp = d.hp; }
}
check(hits >= 3, `허수아비에게 걸어가 세 번 맞혔다 (${hits}번)`);

// 3) 상태이상은 모두 풀린다
for (const k of ['burn', 'poison', 'bleed', 'chill', 'curse', 'shock']) w.applyPlayerStatus(k, 10);
for (let f = 0; f < 60 * 8; f++) { p.hp = w.d.maxHp; w.step(idle(w)); w.signals.length = 0; w.events.length = 0; }
check(!Object.keys(p.st).length, `8초 뒤 상태이상이 모두 풀렸다 (남은 것: ${Object.keys(p.st).join(',') || '없음'})`);

// 5) 회복에 숨은 배율이 없다: 적힌 만큼 들어온다 (초당 상한 안에서)
for (const kind of ['skill', 'steal', 'regen', 'drain']) {
  p.hp = 100; p.healBank = w.d.maxHp; const amt = Math.round(w.d.maxHp * 0.02);
  w.heal(amt, kind);
  check(Math.abs(p.hp - 100 - amt) < 0.01, `회복(${kind}) ${amt} → 실제 ${Math.round(p.hp - 100)}`);
}

// 4) 맵 밖 · NaN 위치에서도 거리장이 멈추지 않는다
for (const [x, y] of [[-50, -50], [NaN, NaN], [w.tw * 16 + 80, 100]]) {
  w.flowT = 0; p.x = x; p.y = y;
  let err = null; try { w.updateFlow(); } catch (e) { err = e; }
  check(!err, `거리장: 플레이어가 (${x}, ${y})에 있어도 오류 없음${err ? ' · ' + err.message : ''}`);
}

console.log(ok ? 'START OK' : 'START FAIL');
process.exit(ok ? 0 : 1);

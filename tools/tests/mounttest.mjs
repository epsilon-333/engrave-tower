// 랩터 타기: V로 올라타면 더 빨리 달리고, 공격하면 내리고, 탈것이 없거나 물 위에서는 못 탄다 · 용족 각인 강화가 수치를 올리는지
import { computeBuild, ENG_STEP } from '../../public/js/sim/build.js';
import { World } from '../../public/js/sim/world.js';
import { islandZone, islandMap } from '../../public/js/data/maps/islands.js';

const b = computeBuild({ race: 'knight', level: 15, alloc: {}, engravings: {}, gear: {} });
let ok = true;
const I = (o = {}) => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, ...o }); // 입력 기본값 (빠진 값이 없게)
const check = (cond, msg) => { console.log(cond ? 'OK ' : 'FAIL', msg); if (!cond) ok = false; };

const run = (mount, steps = 40) => { // 짧게 재야 건물 · 물에 막히지 않는다
  const w = new World({ build: b, mode: 'field', zone: islandZone('gold'), zoneId: 'gold', seed: 7, map: islandMap('gold') });
  w.mountKind = 'raptor';
  for (const e of w.enemies) e.dead = true;
  w.enemies.length = 0;
  const p = w.player, x0 = p.x;
  if (mount) w.step(I({ mount: true, aimX: p.x + 1, aimY: p.y }));
  const rode = !!p.riding;
  for (let i = 0; i < steps; i++) { w.step(I({ moveX: 1, aimX: p.x + 10, aimY: p.y })); w.events.length = 0; w.signals.length = 0; }
  return { w, p, rode, dist: p.x - x0 };
};

const walk = run(false), ride = run(true);
check(ride.rode, '「V」를 누르면 랩터에 올라탄다');
check(ride.dist > walk.dist * 1.4, `타고 달린 거리 ${Math.round(ride.dist)} > 걸은 거리 ${Math.round(walk.dist)} × 1.4`);
ride.w.step(I({ attack: true, aimX: ride.p.x + 10, aimY: ride.p.y }));
check(!ride.p.riding, '공격하면 랩터에서 내린다');
ride.w.step(I({ mount: true, aimX: ride.p.x + 1, aimY: ride.p.y })); ride.w.step(I({ aimX: ride.p.x + 1, aimY: ride.p.y }));
check(!!ride.p.riding, '다시 「V」로 탄다');
ride.w.step(I({ mount: true, aimX: ride.p.x + 1, aimY: ride.p.y }));
check(!ride.p.riding, '한 번 더 「V」로 내린다');

const none = new World({ build: b, mode: 'field', zone: islandZone('gold'), zoneId: 'gold', seed: 7, map: islandMap('gold') });
none.step(I({ mount: true, aimX: none.player.x + 1, aimY: none.player.y }));
check(!none.player.riding, '길들인 랩터가 없으면 못 탄다');

// 각인 강화: 단계마다 각인 능력치가 ENG_STEP(12%)씩 커진다
const lo = { race: 'knight', level: 10, alloc: {}, engravings: { leg: 'slimeSkin' }, gear: {}, skills: [] };
const vits = [0, 1, 2, 3, 4, 5].map((l) => computeBuild({ ...lo, engLv: { slimeSkin: l } }).stats.vit), base = computeBuild({ ...lo, engravings: {} }).stats.vit;
check(vits.every((v, i) => !i || v >= vits[i - 1]) && vits[5] - base >= Math.round(6 * (1 + ENG_STEP * 5)), `끈적한 점액 +0 → +5: 체력 ${vits.join(' · ')} (각인 몫 ${vits[0] - base} → ${vits[5] - base})`);
console.log(ok ? 'MOUNT OK' : 'MOUNT FAIL');

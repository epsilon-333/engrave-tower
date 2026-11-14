// 해방 (탑을 올라 섬을 연다 · data/unlocks.js):
// 1) 예전 저장(gated 없음)은 모두 열려 있다
// 2) 새 저장은 처음에 시작 지역만 열려 있고, 처음 열린 땅만 걸어서 마을 → 탑 문에 닿는다
// 3) 층을 깰수록 지역이 열리고, 50층이면 모두 열린다
// 4) 내 종족 성지가 잠긴 지역 안이면 10층 뒤로 그 둘레만 열려 걸어 다닐 수 있다
// 5) 잠긴 땅으로는 걸어 들어갈 수 없다
import { buildOverworld, WORLD_ZONE, BIOME_LIST } from '../../public/js/data/maps/overworld.js';
import { computeBuild } from '../../public/js/sim/build.js';
import { World } from '../../public/js/sim/world.js';
import { TILE } from '../../public/js/sim/mapgen.js';
import { makeLocks, isOpen, UNLOCKS, need } from '../../public/js/data/unlocks.js';
import { SANCTUMS } from '../../public/js/data/sanctums.js';

let ok = true;
const check = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) ok = false; };
const save = (best, gated = 1) => ({ gated, climb: { best } });

// 1) 예전 저장
check(!makeLocks(save(0, 0), BIOME_LIST) && isOpen(save(0, 0), 'systems', 'oath'), '예전 저장은 잠금 없음');

// 표가 층 순서대로 · 모든 지역이 어딘가에서 열린다 (탑 지역 빼고)
check(UNLOCKS.every((u, i) => !i || u.f > UNLOCKS[i - 1].f), '해방 표가 층 순서대로');
const startOpen = BIOME_LIST.filter((b) => !need('regions', b.id)).map((b) => b.name);
console.log('     처음부터 열린 지역:', startOpen.join(' · '));
check(!makeLocks(save(50), BIOME_LIST).regions.size, '50층을 깨면 모든 지역이 열린다');

const b = computeBuild({ race: 'knight', cls: 'guardian', level: 1, alloc: {}, engravings: {}, gear: { weapon: 'guardSword', off: 'buckler' } });
const map = buildOverworld(WORLD_ZONE);
const w = new World({ build: b, mode: 'field', zone: WORLD_ZONE, zoneId: 'world', seed: 7, map });
w.locks = makeLocks(save(0), BIOME_LIST);

// 2) 처음 열린 땅만 걸어서 탑 문까지 (칸 단위 길 찾기)
const reach = (from, ok2) => {
  const tw = w.tw, seen = new Uint8Array(tw * w.th), q = [Math.floor(from.y / TILE) * tw + Math.floor(from.x / TILE)]; seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % tw, y = (i / tw) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * tw + nx; if (nx < 0 || ny < 0 || nx >= tw || ny >= w.th || seen[j]) continue; const cx = nx * TILE + 8, cy = ny * TILE + 8; if (w.blocked(cx, cy, 5) || !ok2(cx, cy)) continue; seen[j] = 1; q.push(j); } }
  return (x, y) => !!seen[Math.floor(y / TILE) * tw + Math.floor(x / TILE)];
};
const open0 = reach(w.player, (x, y) => !w.sealAt(x, y));
const door = w.objects.find((o) => o.kind === 'towerDoor');
const near = (f, o) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (f(o.x + dx * TILE, o.y + dy * TILE)) return true; return false; };
check(door && near(open0, door), '처음 열린 땅만 걸어서 마을 → 탑 문에 닿는다');

// 5) 잠긴 땅으로 걸어 들어갈 수 없다: 경계에서 잠긴 쪽으로 2초 걷기
let edge = null;
for (let y = 150; y < 350 && !edge; y++) for (let x = 60; x < 300 && !edge; x++) { const cx = x * TILE + 8, cy = y * TILE + 8; if (open0(cx, cy) && w.sealAt(cx - 2 * TILE, cy) && !w.blocked(cx - TILE, cy, 6)) edge = { x: cx, y: cy }; }
if (edge) {
  w.player.x = edge.x; w.player.y = edge.y;
  for (let f = 0; f < 120; f++) { w.step({ moveX: -1, moveY: 0, aimX: w.player.x - 10, aimY: w.player.y }); w.signals.length = 0; w.events.length = 0; }
  check(!w.sealAt(w.player.x, w.player.y), `잠긴 지역 경계에서 2초 걸어도 들어가지 못한다 (${Math.round(edge.x - w.player.x)}px 이동)`);
} else check(false, '경계를 찾지 못했다');

// 3) 층마다 열리는 지역 수
for (const f of [0, 10, 20, 30, 40, 50]) console.log(`     ${f}층: 잠긴 지역 ${makeLocks(save(f), BIOME_LIST).regions.size}곳`);

// 4) 종족마다: 10층 뒤 내 성지에 닿을 수 있는가 (열린 지역이거나 성지 둘레)
for (const race of Object.keys(SANCTUMS)) {
  const o = w.objects.find((q) => q.kind === 'sanctum' && q.race === race);
  w.locks = makeLocks(save(10), BIOME_LIST);
  if (w.sealAt(o.x, o.y)) w.locks.keep = [{ x: o.x, y: o.y, r: 18 * TILE }];
  check(!w.sealAt(o.x, o.y + 24), `${SANCTUMS[race].name}(${race}): 10층 뒤 성지 앞이 열려 있다${w.locks.keep ? ' · 둘레만' : ''}`);
}

console.log(ok ? 'UNLOCK OK' : 'UNLOCK FAIL');
process.exit(ok ? 0 : 1);

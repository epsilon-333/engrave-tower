// 바다 건너 섬 다섯: 도시 · 사람 · 부두에 걸어서 닿는지, 몬스터 무리 · 사냥터 레벨, 세계로 띄웠을 때 돌아가는지
import { buildIsland, ISLAND_DEFS, islandZone, islandMap } from '../../public/js/data/maps/islands.js';
import { T_FLOOR, T_LIQUID, TILE } from '../../public/js/sim/mapgen.js';
import { computeBuild } from '../../public/js/sim/build.js';
import { World } from '../../public/js/sim/world.js';

let ok = true;
const b = computeBuild({ race: 'knight', level: 30, alloc: { str: 30, vit: 20 }, engravings: {}, gear: {} });
for (const id of Object.keys(ISLAND_DEFS)) {
  const t0 = Date.now(), m = buildIsland(id), ms = Date.now() - t0;
  const seen = new Uint8Array(m.tw * m.th), q = [m.start.y * m.tw + m.start.x]; seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % m.tw, y = (i / m.tw) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * m.tw + nx; if (nx < 0 || ny < 0 || nx >= m.tw || ny >= m.th || seen[j]) continue; if (m.tiles[j] === T_FLOOR || m.tiles[j] === T_LIQUID) { seen[j] = 1; q.push(j); } } }
  const near = (px, py) => { const x = Math.floor(px / TILE), y = Math.floor(py / TILE); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (seen[(y + dy) * m.tw + x + dx]) return true; return false; };
  const bad = m.objects.filter((o) => !near(o.x, o.y)).map((o) => o.id || o.kind);
  const arrive = near(m.arrive.x, m.arrive.y);
  let err = '';
  try {
    const w = new World({ build: b, mode: 'field', zone: islandZone(id), zoneId: id, seed: 9, map: islandMap(id) });
    for (let s = 0; s < 120; s++) { w.step({ moveX: 1, moveY: 0, aimX: w.player.x + 1, aimY: w.player.y }); w.signals.length = 0; w.events.length = 0; }
    err = `enemies ${w.enemies.length} lv ${[...new Set(w.enemies.map((e) => e.lv))].sort((a, c) => a - c).slice(0, 6).join('/')}`;
  } catch (e) { err = 'ERROR ' + e.stack.split('\n').slice(0, 3).join(' | '); ok = false; }
  console.log(id, `${m.tw}x${m.th}`, ms + 'ms', 'camps', m.camps.length, 'nodes', m.nodes.length, 'unreach', bad.join(',') || 'none', 'arrive', arrive, err);
  if (bad.length || !arrive || m.camps.length < 10) ok = false;
}
console.log(ok ? 'ISLANDS OK' : 'ISLANDS FAIL');

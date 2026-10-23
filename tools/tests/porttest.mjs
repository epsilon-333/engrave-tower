// 항구 두 곳이 섬 위에 제대로 생기는지 (부두 · 배 · NPC · 걸어서 닿는지)
import { buildOverworld, WORLD_ZONE, OW } from '../../public/js/data/maps/overworld.js';
import { T_FLOOR, T_LIQUID, TILE } from '../../public/js/sim/mapgen.js';
const t0 = Date.now();
const m = buildOverworld(WORLD_ZONE);
console.log('size', m.tw, m.th, 'build ms', Date.now() - t0);
const seen = new Uint8Array(m.tw * m.th), q = [(OW.VILLAGE.y + 4) * m.tw + OW.VILLAGE.x]; seen[q[0]] = 1;
for (let h = 0; h < q.length; h++) {
  const i = q[h], x = i % m.tw, y = (i / m.tw) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy, j = ny * m.tw + nx;
    if (nx < 0 || ny < 0 || nx >= m.tw || ny >= m.th || seen[j]) continue;
    const v = m.tiles[j];
    if (v === T_FLOOR || v === T_LIQUID) { seen[j] = 1; q.push(j); }
  }
}
let ok = true;
const near = (o) => { const x = Math.floor(o.x / TILE), y = Math.floor(o.y / TILE); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (seen[(y + dy) * m.tw + x + dx]) return 1; return 0; };
for (const id of ['portS', 'portE']) {
  const P = m.ports[id];
  if (!P) { console.log(id, 'MISSING'); ok = false; continue; }
  const objs = m.objects.filter((o) => o.id && o.id.startsWith(id));
  const reach = objs.map(near);
  const arrive = near(P.arrive);
  console.log(id, 'center', P.center, 'arrive', arrive, 'objs', objs.map((o) => o.id).join(','), 'reach', reach.join(''), 'wp', m.waypoints.some((w) => w.id === 'wp_' + id));
  if (!arrive || reach.includes(0) || objs.length < 3) ok = false;
}
console.log('ships', m.props.filter((p) => p.kind === 'ship').length);
console.log(ok ? 'PORTS OK' : 'PORTS FAIL');

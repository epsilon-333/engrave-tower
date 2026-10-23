// 녹트 하벤: 출구 셋 · 사람 · 갱도가 걸어서 이어지는지, 몬스터는 갱도에만, 내기 결투가 끝나는지, 바깥 숨은 입구 셋
import { buildNoktHaven, NOKT_ZONE } from '../../public/js/data/maps/nokt.js';
import { buildOverworld, WORLD_ZONE } from '../../public/js/data/maps/overworld.js';
import { T_FLOOR, T_LIQUID, TILE } from '../../public/js/sim/mapgen.js';
import { computeBuild } from '../../public/js/sim/build.js';
import { World } from '../../public/js/sim/world.js';

let ok = true;
const m = buildNoktHaven();
const seen = new Uint8Array(m.tw * m.th), q = [m.start.y * m.tw + m.start.x]; seen[q[0]] = 1;
for (let h = 0; h < q.length; h++) {
  const i = q[h], x = i % m.tw, y = (i / m.tw) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * m.tw + nx; if (seen[j] || (m.tiles[j] !== T_FLOOR && m.tiles[j] !== T_LIQUID)) continue; seen[j] = 1; q.push(j); }
}
const near = (px, py) => { const x = Math.floor(px / TILE), y = Math.floor(py / TILE); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (seen[(y + dy) * m.tw + x + dx]) return true; return false; };
const bad = m.objects.filter((o) => !near(o.x, o.y)).map((o) => o.id);
const exits = Object.entries(m.exits).filter(([, e]) => !seen[e.y * m.tw + e.x]).map(([k]) => k);
const camps = m.camps.filter((c) => !seen[c.y * m.tw + c.x] || !m.regionInfo[c.region]?.lv);
console.log('objects unreachable', bad.join(',') || 'none', '| exits unreachable', exits.join(',') || 'none', '| camps outside mines', camps.length);
if (bad.length || exits.length || camps.length) ok = false;

const b = computeBuild({ race: 'knight', level: 25, alloc: { str: 30, vit: 20 }, engravings: {}, gear: {} });
const w = new World({ build: b, mode: 'field', zone: NOKT_ZONE, zoneId: 'nokt', seed: 333, map: buildNoktHaven() });
const city = w.enemies.filter((e) => !e.dead && !m.regionInfo[m.regions[Math.floor(e.y / TILE) * m.tw + Math.floor(e.x / TILE)]]?.lv);
console.log('enemies', w.enemies.length, 'in city', city.length, 'lv sample', w.enemies.slice(0, 4).map((e) => e.lv).join(','));
if (city.length) ok = false;
// 내기 결투
const p = w.player, P = m.pit;
p.x = P.x * TILE - 32; p.y = P.y * TILE + 8;
const e = w.makeEnemy('bandit', P.x * TILE + 48, P.y * TILE + 8, { noAffix: true }); w.applyLevel(e, 15); e.state = 'chase'; e.home = { x: e.x, y: e.y }; w.enemies.push(e);
w.pit = { e, bet: 30, tier: 'low' };
let res = null;
for (let s = 0; s < 60 * 60 && !res; s++) {
  w.step({ moveX: e.x - p.x, moveY: e.y - p.y, aimX: e.x, aimY: e.y, attack: true });
  for (const sg of w.signals) if (sg.t === 'pitWon' || sg.t === 'pitLost') res = sg.t;
  w.signals.length = 0; w.events.length = 0;
}
console.log('pit result', res, 'state', w.state);
if (!res || w.state !== 'play') ok = false;
const ow = buildOverworld(WORLD_ZONE);
console.log('hidden ways', Object.keys(ow.hidden || {}).join(','), ow.objects.filter((o) => o.kind === 'hiddenWay').length, '| rumor npc', !!ow.objects.find((o) => o.id === 'rumor_village'));
if (Object.keys(ow.hidden || {}).length !== 3) ok = false;
console.log(ok ? 'NOKT OK' : 'NOKT FAIL');

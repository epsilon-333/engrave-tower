const root = process.argv[2] || new URL('../../public/js', import.meta.url).href; // 기본: 이 저장소의 public/js
const { buildCave1 } = await import(root + '/data/maps/cave1.js');
const { ZONES } = await import(root + '/data/monsters.js');
const m = buildCave1(ZONES[0]);
const { tw, th, tiles } = m;
const ch = { 0: '.', 1: '#', 2: '~', 3: '%', 5: 'X' };
const grid = [];
for (let y = 0; y < th; y++) { let s = ''; for (let x = 0; x < tw; x++) s += ch[tiles[y * tw + x]]; grid.push(s.split('')); }
const mark = (o, c) => { if (o) grid[o.y][o.x] = c; };
mark(m.start, 'S'); mark(m.lair, 'B'); mark(m.stairs, 'v');
for (const c of m.chests) mark(c, c.rich ? 'R' : 'c');
for (const j of m.journals) mark(j, 'J'); for (const n of m.npcs) mark(n, 'P');
for (const c of m.camps) mark(c, 'm'); for (const c of m.camp) mark(c, 'f'); for (const c of m.lores) mark(c, 'L');
for (const c of m.merchant) mark(c, '$'); for (const c of m.shrines) mark(c, 'A'); for (const c of m.goblins) mark(c, 'g');
for (const c of m.champions) mark(c, 'C');
console.log(grid.map((r) => r.join('')).join('\n'));
// 문을 지나지 않고 갈 수 있는 곳
const seen = new Uint8Array(tw * th), q = [m.start.y * tw + m.start.x]; seen[q[0]] = 1;
for (let h = 0; h < q.length; h++) { const i = q[h], x = i % tw, y = (i / tw) | 0; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const j = (y + dy) * tw + x + dx; const v = tiles[j]; if (!seen[j] && (v === 0 || v === 2)) { seen[j] = 1; q.push(j); } } }
const reach = (o) => seen[o.y * tw + o.x];
console.log('rooms reachable without gates:', m.regionInfo.map((r) => `${r.name}:${reach(r) ? 'O' : 'x'}`).join(' '));
const bad = [];
for (const [k, list] of Object.entries({ chests: m.chests, journals: m.journals, npcs: m.npcs, camps: m.camps, camp: m.camp, lores: m.lores, merchant: m.merchant, shrines: m.shrines, goblins: m.goblins, champions: m.champions, stairs: [m.stairs], lair: [m.lair] })) for (const o of list) { const v = tiles[o.y * tw + o.x]; if (v !== 0 && v !== 2) bad.push(`${k}@${o.x},${o.y}=${v}`); }
console.log('objects on walls:', bad.join(' ') || 'none');
console.log('barriers:', m.barriers.map((b) => `${b.id}:${b.tiles.length}`).join(' '));

const root = process.argv[2] || new URL('../../public/js', import.meta.url).href; // 기본: 이 저장소의 public/js
const { buildCave1 } = await import(root + '/data/maps/cave1.js');
const { ZONES } = await import(root + '/data/monsters.js');
const m = buildCave1(ZONES[0]);
// 문을 지나지 않고 갈 수 있는 칸 가운데, 문 너머 장소(숨은 방 · 어두운 굴 · 전망대)로 표시된 칸 수
const { tw, th, tiles, regions, regionInfo } = m;
const seen = new Uint8Array(tw * th), q = [m.start.y * tw + m.start.x]; seen[q[0]] = 1;
for (let h = 0; h < q.length; h++) { const i = q[h], x = i % tw, y = (i / tw) | 0; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const j = (y + dy) * tw + x + dx; if (!seen[j] && (tiles[j] === 0 || tiles[j] === 2)) { seen[j] = 1; q.push(j); } } }
const locked = ['등반가의 숨은 방', '어두운 굴', '무너진 전망대'].map((n) => regionInfo.findIndex((r) => r.name === n));
let leak = 0; for (let i = 0; i < seen.length; i++) if (seen[i] && locked.includes(regions[i])) leak++;
let unassigned = 0; for (let i = 0; i < seen.length; i++) if (seen[i] && regions[i] < 0) unassigned++;
console.log('leaked tiles', leak, 'unassigned reachable', unassigned);

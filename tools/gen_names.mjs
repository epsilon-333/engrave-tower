// 캐릭터 도감용 이름표: 그림 이름(prefix) → 한글 이름. 몬스터는 monsters.js, 종족은 RACES
import fs from 'fs';
import { MONSTER_ART, RACE_ART } from '../public/js/data/art.js';
import { MONSTERS } from '../public/js/data/monsters.js';
import { RACES } from '../public/js/data/races.js';
const out = JSON.parse(fs.readFileSync('public/npcnames.json', 'utf8'));
for (const [id, a] of Object.entries(MONSTER_ART)) { const n = MONSTERS[id]?.name; if (n && a.base) { const b = a.base.replace(/^[pbc]_/, ''); out[b] = out[b] ? out[b] : n; out['x72:' + a.base] = out['x72:' + a.base] || n; } }
for (const [id, a] of Object.entries(RACE_ART)) { const n = RACES[id]?.name; if (n) out['x72:' + a.base] = '플레이어 · ' + n + '족'; }
fs.writeFileSync('public/npcnames.json', JSON.stringify(out));
console.log(Object.keys(out).length, JSON.stringify(Object.entries(out).filter(([k]) => k.startsWith('x72:')).slice(0, 12)));

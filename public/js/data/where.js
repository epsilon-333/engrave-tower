// 어디서 만나나: 몬스터 · 잔향 · 부산물을 얻을 수 있는 곳 (도감 · 제단이 함께 쓴다)
// 바깥 지역(권장 레벨) · 바깥 던전 · 미궁 · 왕궁 · 각인의 탑(층) · 레이드
import { ZONES, MONSTERS } from './monsters.js';
import { BIOME_LIST, ENTRANCES } from './maps/overworld.js';
import { LABY_ZONE, PALACE_ZONE } from './maps/interiors.js';
import { ACTS } from './climb.js';
import { RAIDS } from './raid.js';

let cache = null;
function build() {
  const W = {}; // 몬스터 → [{ kind, name, lv?, tower? }]
  const add = (id, p) => { if (!MONSTERS[id]) return; const L = (W[id] ||= []); if (!L.some((x) => x.name === p.name)) L.push(p); };
  for (const b of BIOME_LIST) for (const id of b.pool || []) add(id, { kind: 'field', name: b.name, lv: b.lv });
  for (const en of Object.values(ENTRANCES)) {
    const z = ZONES.find((x) => x.id === en.theme);
    if (z) for (const id of [...z.pool, z.elite]) add(id, { kind: 'dungeon', name: `${en.name} (던전)` });
    if (en.elite) add(en.elite, { kind: 'dungeon', name: `${en.name} (던전 우두머리)` });
  }
  for (const z of [LABY_ZONE, PALACE_ZONE]) for (const id of [...(z.pool || []), z.elite]) add(id, { kind: 'dungeon', name: z.name });
  for (const a of ACTS) {
    const z = ZONES.find((x) => x.id === a.zone);
    for (const id of [...z.pool, z.elite]) add(id, { kind: 'tower', name: `각인의 탑 ${a.from}~${a.to}층`, tower: true });
    add(a.guardian, { kind: 'tower', name: `각인의 탑 ${a.from + 4}층 수호자`, tower: true });
    add(a.lord, { kind: 'tower', name: `각인의 탑 ${a.to}층 주인`, tower: true });
  }
  for (const r of Object.values(RAIDS)) add(r.boss, { kind: 'raid', name: `레이드 · ${r.name}` });
  return W;
}
export function monsterWhere(id) { cache ||= build(); return cache[id] || []; }
// 탑에서만 나오는가
export const towerOnly = (id) => { const L = monsterWhere(id); return L.length > 0 && L.every((p) => p.tower); };
// 짧은 글: 같은 종류는 묶고 너무 길면 줄인다
export function whereText(id, max = 4) {
  const L = monsterWhere(id); if (!L.length) return '알 수 없음';
  const t = L.map((p) => p.lv ? `${p.name}(Lv ${p.lv[0]}~${p.lv[1]})` : p.name);
  return t.slice(0, max).join(' · ') + (t.length > max ? ` 외 ${t.length - max}곳` : '');
}
// 잔향 · 부산물을 남기는 몬스터
export function echoSources(eid) { return Object.keys(MONSTERS).filter((id) => MONSTERS[id].echo?.id === eid || MONSTERS[id].condEcho?.id === eid || MONSTERS[id].part === eid); }

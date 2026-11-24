// 탑 밖 던전 (2026-11-23): 던전마다 그곳에서만 사는 우두머리 · 그 부산물로 새기는 각인 · 던전 레벨 · 정복 신호
import { DUNGEONS } from '../../public/js/data/dungeons.js';
import { ENTRANCES } from '../../public/js/data/maps/overworld.js';
import { LABY_ZONE, PALACE_ZONE, buildLabyrinth } from '../../public/js/data/maps/interiors.js';
import { MONSTERS, ZONES, ECHOES } from '../../public/js/data/monsters.js';
import { ENGRAVINGS } from '../../public/js/data/engravings.js';
import { MONSTER_ART } from '../../public/js/data/art.js';
import { monsterWhere } from '../../public/js/data/where.js';
import { dungeonZone, dungeonCleared } from '../../public/js/ui/dungeons.js';
import { generateField, TILE } from '../../public/js/sim/mapgen.js';
import { computeBuild } from '../../public/js/sim/build.js';
import { World } from '../../public/js/sim/world.js';

let ok = true;
const fail = (m) => { ok = false; console.log('FAIL', m); };
const zoneOf = (id) => { const en = ENTRANCES[id], base = en.theme === 'labyrinth' ? LABY_ZONE : en.theme === 'palace' ? PALACE_ZONE : ZONES.find((z) => z.id === en.theme); return { base, zone: { ...base, name: en.name, key: id, relic: en.relic, elite: en.elite || base.elite, pool: en.pool || base.pool, ...dungeonZone(id) } }; };
const bosses = new Set();
for (const id of Object.keys(ENTRANCES)) {
  const D = DUNGEONS[id]; if (!D) { fail(`${id}: DUNGEONS에 없다`); continue; }
  const { zone } = zoneOf(id), b = MONSTERS[D.boss];
  if (zone.elite !== D.boss) fail(`${id}: 우두머리 ${zone.elite} ≠ ${D.boss}`);
  if (!b) { fail(`${id}: 몬스터 ${D.boss} 없음`); continue; }
  if (bosses.has(D.boss)) fail(`${id}: 우두머리 ${D.boss}가 다른 던전과 겹친다`); bosses.add(D.boss);
  if (!b.part || !ECHOES[b.part]) fail(`${id}: 부산물 없음`);
  const eng = ENGRAVINGS['m_' + D.boss]; if (!eng || !eng.recipe[b.part]) fail(`${id}: 부산물 각인 없음`);
  if (!MONSTER_ART[D.boss]) fail(`${id}: 그림 없음`);
  const where = monsterWhere(D.boss); if (!where.length || where.some((p) => p.kind !== 'dungeon')) fail(`${id}: ${D.boss}가 던전 밖에도 산다 ${JSON.stringify(where)}`);
  if (!(D.lv > 0) || !(D.first > 0) || !D.blurb) fail(`${id}: lv · first · blurb`);
  console.log(`${id.padEnd(13)} Lv ${String(D.lv).padStart(2)} · ${b.name} → ${ECHOES[b.part]?.name} → 「${eng?.name}」 ★${eng?.grade} (부산물 ${eng?.recipe[b.part]})`);
}
// 던전 세계: 몬스터에 레벨 · 우두머리 두 레벨 위 · 쓰러뜨리면 정복 신호와 그곳의 부산물
for (const id of ['plainsHole', 'crypt', 'labyrinth']) {
  const { zone } = zoneOf(id), en = ENTRANCES[id];
  const map = en.theme === 'labyrinth' ? buildLabyrinth(zone, 7) : generateField(zone, 7, 0, en.size || null);
  const w = new World({ build: computeBuild({ race: 'orc', level: 30, alloc: { str: 30, vit: 20 }, engravings: {}, gear: {} }), mode: 'field', zone, zoneId: zone.id, seed: 7, map });
  const boss = w.enemies.find((e) => e.lair), mob = w.enemies.find((e) => !e.lair && e.camp);
  if (!boss || boss.defId !== DUNGEONS[id].boss) { fail(`${id}: 우두머리가 없다`); continue; }
  if (boss.lv !== DUNGEONS[id].lv + 2 || (mob && mob.lv !== DUNGEONS[id].lv)) fail(`${id}: 레벨 우두머리 ${boss.lv} · 몬스터 ${mob?.lv} (던전 ${DUNGEONS[id].lv})`);
  boss.hp = 0; w.killEnemy(boss);
  const sig = w.signals.find((s) => s.t === 'dungeonClear'), parts = w.drops.filter((d) => d.kind === 'echo' && d.id === MONSTERS[boss.defId].part).length;
  if (!sig || sig.id !== id) fail(`${id}: 정복 신호가 없다`);
  if (parts < 1) fail(`${id}: 부산물이 떨어지지 않았다`);
  console.log(`${id}: 우두머리 Lv ${boss.lv} · 몬스터 Lv ${mob?.lv} · 부산물 ${parts}개 · 신호 ${sig?.t}`);
}
// 정복 기록 · 처음 보상 (두 번째부터는 돈 없음)
const save = { level: 20, echoes: {}, gold: 0 };
dungeonCleared(save, { id: 'mossCave', depth: 0 }); const g1 = save.gold; dungeonCleared(save, { id: 'mossCave', depth: 0 });
if (save.dungeons.mossCave.clears !== 2 || g1 !== DUNGEONS.mossCave.first || save.gold !== g1) fail(`정복 기록 ${JSON.stringify(save)}`);
console.log(ok ? 'DUNGEONS OK' : 'DUNGEONS FAIL');
process.exitCode = ok ? 0 : 1;

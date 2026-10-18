// 1층 이야기 흐름: 지도 조각 → 피노 → 이끼 → 등불 → 가시덩굴 → 전망대 / 족장 열쇠 → 철창
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href; // 기본: 이 저장소의 public/js
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { TILE } = await import(root + '/sim/mapgen.js');
const { pinoTalk, newStory } = await import(root + '/data/story.js');
const { codexPoints, levelFor } = await import(root + '/data/codex.js');
const cid = 'knight' in CLASSES ? 'knight' : Object.keys(CLASSES)[0], c = CLASSES[cid];
const b = computeBuild({ race: c.race, cls: cid, level: 5, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] }, skills: c.skills.slice(0, 4) });
const save = { story: newStory(), codex: { kills: {}, places: {}, journals: {}, lore: [] } };
const w = new World({ build: b, mode: 'field', zoneId: 'cave', seed: 1, story: save.story, codex: save.codex });
const p = w.player, inp = { moveX: 0, moveY: 0, aimX: p.x + 50, aimY: p.y, attack: false };
const step = (n = 1) => { for (let i = 0; i < n; i++) { w.step(inp); w.events.length = 0; } };
const sig = () => { const s = w.signals.splice(0).map((x) => x.t); return s; };
console.log('map', w.map.designed, w.tw, w.th, 'objects', w.objects.map((o) => o.kind).filter((k) => ['barrier', 'journal', 'npc'].includes(k)).join(','));
// 고블린을 잡아 지도 조각 모으기
let kills = 0;
while ((save.story.items.mapScrap || 0) < 3 && kills < 60) {
  const e = w.makeEnemy('goblin', p.x + 20, p.y); w.enemies.push(e); w.killEnemy(e); kills++;
  for (const d of w.drops) { d.x = p.x; d.y = p.y; d.t = 1; }
  step(2);
}
console.log('goblins killed', kills, 'mapScrap', save.story.items.mapScrap, 'goblin kills in codex', save.codex.kills.goblin, 'signals', [...new Set(sig())].join(','));
// 피노
const apply = (t) => { for (const [k, n] of Object.entries(t.take || {})) save.story.items[k] -= n; for (const [k, n] of Object.entries(t.give || {})) save.story.items[k] = (save.story.items[k] || 0) + n; if (t.set) save.story.flags[t.set] = true; };
apply(pinoTalk(save.story)); apply(pinoTalk(save.story));
console.log('flags after pino x2', Object.keys(save.story.flags).join(','), 'scraps', save.story.items.mapScrap);
// 이끼
let sk = 0;
while ((save.story.items.glowMoss || 0) < 5 && sk < 80) { const e = w.makeEnemy('slime', p.x + 20, p.y); w.enemies.push(e); w.killEnemy(e); sk++; for (const d of w.drops) { d.x = p.x; d.y = p.y; d.t = 1; } step(2); }
apply(pinoTalk(save.story));
console.log('slimes', sk, 'lantern', save.story.items.lantern, 'flags', Object.keys(save.story.flags).join(','));
// 가시덩굴 열기 (남쪽에서 다가가기)
const thorn = w.objects.find((o) => o.id === 'thornGate');
p.x = thorn.x; p.y = thorn.y + 22; w.interact(thorn);
console.log('thorn opened', thorn.opened, 'flag', !!save.story.flags['open:thornGate'], 'tile', w.tiles[thorn.tiles[0]]);
// 무너진 바위: 남쪽(첫 야영지 쪽)에선 안 열리고, 북쪽(전망대 쪽)에서 열린다
const rub = w.objects.find((o) => o.id === 'rubble');
p.x = rub.x; p.y = rub.y + 20; w.interact(rub); const s1 = rub.opened;
p.x = rub.x; p.y = rub.y - 20; w.interact(rub);
console.log('rubble from south', s1, 'from north', rub.opened);
// 전망대에 들어가면 장소 · 하늘
const J = w.map.regionInfo.find((r) => r.vista);
p.x = J.x * TILE + 8; p.y = J.y * TILE + 8; w.regionT = 0; w.step(inp);
const ev = w.events.map((e) => e.t); w.events.length = 0;
console.log('vista events', ev.filter((t) => t === 'vista' || t === 'region').join(','), 'vistaSeen', !!save.story.flags.vistaSeen, 'places', Object.keys(save.codex.places).join(' / '));
apply(pinoTalk(save.story));
// 족장 열쇠 → 철창
const chief = w.enemies.find((e) => e.defId === 'goblinChief'); w.killEnemy(chief); for (const d of w.drops) { d.x = p.x; d.y = p.y; d.t = 1; } step(2);
const iron = w.objects.find((o) => o.id === 'ironGate'); p.x = iron.x + 20; p.y = iron.y; w.interact(iron);
console.log('key used, iron opened', iron.opened, 'key left', save.story.items.rustyKey);
// 일지
for (const o of w.objects.filter((o) => o.kind === 'journal')) w.interact(o);
console.log('journals', Object.keys(save.codex.journals).join(','));
const pts = codexPoints(save);
console.log('codex points', pts, 'level', levelFor(pts).level, 'flags', Object.keys(save.story.flags).join(','));
// 다시 들어가면 열린 문은 열려 있고 피노는 떠났다
const w2 = new World({ build: b, mode: 'field', zoneId: 'cave', seed: 1, story: save.story, codex: save.codex });
console.log('reload: barriers opened', w2.objects.filter((o) => o.kind === 'barrier').map((o) => `${o.id}:${o.opened}`).join(' '), 'pino present', w2.objects.some((o) => o.kind === 'npc'));

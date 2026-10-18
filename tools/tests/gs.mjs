const root = process.argv[2] || new URL('../../public/js', import.meta.url).href; // 기본: 이 저장소의 public/js
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const mk = (cid) => { const c = CLASSES[cid]; const b = computeBuild({ race: c.race, cls: cid, level: 20, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] } }); const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 3 }); const p = w.player; w.enemies.slice(0, 2).forEach((e, i) => { e.x = p.x + 24; e.y = p.y + i * 4; e.hp = e.maxHp = 99999; e.atk = 0; e.home = { x: e.x, y: e.y }; e.state = 'chase'; }); return w; };
let w = mk('greatsword'); const dirs = [];
for (let f = 0; f < 240; f++) { const before = w.player.atkCount; w.step({ moveX: 0, moveY: 0, aimX: w.player.x + 50, aimY: w.player.y, attack: true }); if (w.player.atkCount !== before) dirs.push(w.player.swingDir); w.events.length = 0; }
console.log('대검 휘두름 방향', dirs.join(' '), '피해', Math.round(w.enemies[0].maxHp - w.enemies[0].hp));
w = mk('thrower'); w.player.res = 100; w.castSkillId('rapidThrow', 0); let maxAxes = 0, back = 0;
for (let f = 0; f < 120; f++) { w.step({ moveX: 0, moveY: 0, aimX: w.player.x + 50, aimY: w.player.y }); const ax = w.projs.filter((q) => q.skind === 'axe'); maxAxes = Math.max(maxAxes, ax.length); back = Math.max(back, ax.filter((q) => q.returning).length); w.events.length = 0; }
console.log('연속 투척 도끼 수', maxAxes, '돌아오는 도끼', back, '남은 도끼', w.projs.length);

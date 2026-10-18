const root = process.argv[2] || new URL('../../public/js', import.meta.url).href; // 기본: 이 저장소의 public/js
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const c = CLASSES.dragoon;
const b = computeBuild({ race: c.race, cls: 'dragoon', level: 20, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] } });
const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 3 });
const p = w.player;
const es = w.enemies.slice(0, 3); es.forEach((e, i) => { e.x = p.x + 40 + i * 8; e.y = p.y; e.hp = e.maxHp = 99999; e.atk = 0; e.state = 'chase'; e.home = { x: e.x, y: e.y }; });
p.res = 100; w.castSkillId('dragonForm');
let cones = 0;
for (let f = 0; f < 120; f++) { w.step({ moveX: 0, moveY: 0, aimX: p.x + 50, aimY: p.y, attack: true }); for (const ev of w.events) if (ev.t === 'skillCone' && ev.fx === 'breath') cones++; w.events.length = 0; }
console.log('breath cones', cones, 'burning', es.filter((e) => e.st.burn).length, 'dmg', es.map((e) => Math.round(e.maxHp - e.hp)));

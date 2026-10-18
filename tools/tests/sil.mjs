const root = process.argv[2] || new URL('../../public/js', import.meta.url).href; // 기본: 이 저장소의 public/js
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
for (const silence of [false, true]) {
  const c = CLASSES.dragonSage;
  const b = computeBuild({ race: c.race, cls: 'dragonSage', level: 20, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] } });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 5 });
  const p = w.player;
  w.enemies.slice(0, 5).forEach((e, i) => { e.x = p.x + 10 + i * 4; e.y = p.y + 4; e.state = 'chase'; e.home = { x: e.x, y: e.y }; });
  if (silence) { p.res = 100; w.castSkillId('wordSilence'); }
  const hp0 = p.hp;
  for (let f = 0; f < 200; f++) { w.step({ moveX: 0, moveY: 0, aimX: p.x + 50, aimY: p.y }); w.events.length = 0; if (w.state !== 'play') break; }
  console.log(silence ? '침묵' : '그냥', '받은 피해', Math.round(hp0 - p.hp));
}

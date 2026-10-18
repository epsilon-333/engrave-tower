const root = process.argv[2] || new URL('../../public/js', import.meta.url).href; // 기본: 이 저장소의 public/js
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const c = CLASSES.spiritcaller;
for (const pre of ['fireSpirit', 'windSpirit', 'forestSpirit']) {
  const b = computeBuild({ race: c.race, cls: 'spiritcaller', level: 20, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] } });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 3 });
  const p = w.player;
  w.enemies.slice(0, 4).forEach((e, i) => { e.x = p.x + 50 + i * 12; e.y = p.y; e.state = 'chase'; e.hp = e.maxHp = 99999; e.atk = 0; });
  p.res = 100; w.castSkillId(pre); p.res = 100; p.cds = {}; w.castSkillId('spiritKing');
  let punches = 0, rooted = 0, burn = 0, moved = 0;
  const k0 = w.allies.find((a) => a.kind === 'spiritKing'); const x0 = k0.x;
  for (let f = 0; f < 240; f++) { w.step({ moveX: 0, moveY: 0, aimX: p.x + 50, aimY: p.y }); for (const ev of w.events) if (ev.t === 'kingPunch') punches++; w.events.length = 0; }
  for (const e of w.enemies.slice(0, 4)) { if (e.vineT0) rooted++; if (e.st.burn) burn++; }
  console.log(pre, 'punches', punches, 'rooted', rooted, 'burn', burn, 'king moved', Math.round(Math.abs(k0.x - x0)));
}

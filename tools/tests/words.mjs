// 언령 문장: 순서 · 계열에 따라 피해가 달라지는지 (조합 · 강세 · 엇갈림)
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const c = CLASSES.dragonSage;
const run = (words, race = 'dragon') => {
  const b = computeBuild({ race, cls: race === 'dragon' ? 'dragonSage' : undefined, level: 20, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] }, learned: race === 'dragon' ? [] : c.skills.filter((s) => s !== 'wordSilence') });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 5 });
  const p = w.player, foes = w.enemies.slice(0, 6);
  foes.forEach((e, i) => { e.x = p.x + 60 + (i % 3) * 6; e.y = p.y + (i < 3 ? -4 : 4); e.atk = 0; e.maxHp = e.hp = 1e6; e.state = 'idle'; e.home = { x: e.x, y: e.y }; e.speedMul = 0; });
  const hp0 = foes.reduce((a, e) => a + e.hp, 0);
  p.words = [...words]; w.sentence();
  let txt = '';
  for (let f = 0; f < 240; f++) { w.step({ moveX: 0, moveY: 0, aimX: 1, aimY: 0 }); for (const ev of w.events) if (ev.t === 'text' && /「|강세|엇갈|흐트|합성|완성/.test(ev.text)) txt = ev.text; w.events.length = 0; }
  return { dmg: Math.round(hp0 - foes.reduce((a, e) => a + e.hp, 0)), txt, shield: Math.round(p.shield) };
};
for (const ws of [['fire', 'fire', 'fire'], ['sky', 'fire', 'sky'], ['fire', 'sky', 'fire'], ['fire', 'scale', 'earth'], ['earth', 'fire', 'earth'], ['scale', 'earth', 'scale'], ['fire', 'sky', 'sky']]) {
  const r = run(ws);
  console.log(ws.join(' > ').padEnd(24), String(r.dmg).padStart(6), r.txt, r.shield ? `보호막 ${r.shield}` : '');
}

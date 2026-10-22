// 돈 · 미션으로 얻는 CC기: 어느 종족이든 배워서 쓰면 적이 기절 · 겁먹음 · 침묵 · 끌려온다
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES, SKILLS, CC_EXTRA } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
let fails = 0;
for (const [cls, c] of [['greatsword', CLASSES.greatsword], ['spiritcaller', CLASSES.spiritcaller]]) {
  for (const id of Object.keys(CC_EXTRA)) {
    const b = computeBuild({ race: c.race, cls, level: 15, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] }, learned: [id], skills: [id] });
    const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 3 }), p = w.player;
    const e = w.enemies.find((x) => !x.def.elite); e.x = p.x + (SKILLS[id].do[0].op === 'proj' ? 70 : 28); e.y = p.y; e.state = 'chase'; e.speedMul = 0;
    for (const o of w.enemies) if (o !== e) { o.x = -999; o.y = -999; }
    p.res = 100; w.castSkillId(id, 0);
    let hit = false;
    for (let f = 0; f < 90; f++) { w.step({ moveX: 0, moveY: 0, aimX: e.x, aimY: e.y, attack: false, autoAim: true }); if (e.st.stun > 0 || e.st.flee > 0 || e.silenceT > 0 || e.dead) hit = true; w.events.length = 0; }
    console.log(hit ? 'OK ' : 'FAIL', c.race, SKILLS[id].name); if (!hit) fails++;
  }
}
if (fails) process.exitCode = 1;

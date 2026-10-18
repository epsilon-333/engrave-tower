// 모든 클래스의 스킬을 필드에서 한 번씩 써 보며 런타임 오류를 찾는다
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href; // 기본: 이 저장소의 public/js
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES, SKILLS } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');

let fails = 0;
for (const [cid, c] of Object.entries(CLASSES)) {
  const b = computeBuild({ race: c.race, cls: cid, level: 20, allSkills: true, alloc: { str: 18, mag: 18, agi: 10, vit: 10 }, engravings: {}, gear: { weapon: c.weapons[1] }, skills: c.skills.slice(0, 4) });
  for (const zone of [ZONES[0].id]) {
    const w = new World({ build: b, mode: 'field', zoneId: zone, seed: 12345, practice: null });
    const p = w.player;
    // 적을 가까이 모아 둔다
    const es = w.enemies.slice(0, 8);
    es.forEach((e, i) => { e.x = p.x + 30 + (i % 4) * 14; e.y = p.y - 20 + Math.floor(i / 4) * 24; e.state = 'chase'; });
    const inp = { moveX: 0, moveY: 0, aimX: p.x + 60, aimY: p.y, attack: false, autoAim: true };
    for (const sid of c.skills) {
      try {
        p.res = 100; p.cds = {}; p.hp = w.d.maxHp;
        if (SKILLS[sid].needSpirit) w.castSkillId('windSpirit', null);
        w.castSkillId(sid, 0);
        for (let f = 0; f < 150; f++) {
          inp.h1 = f < 40; inp.attack = f % 20 < 10; inp.aimX = p.x + 60; inp.aimY = p.y;
          if (sid === 'soar' && f === 30) w.castSkillId('soar', 0);
          w.step(inp);
          w.events.length = 0;
          if (w.state !== 'play') { w.state = 'play'; p.hp = w.d.maxHp; }
        }
      } catch (err) { fails++; console.log('FAIL', cid, sid, err.message, err.stack.split('\n')[1]); }
    }
  }
}
console.log(fails ? `${fails} failures` : 'ALL OK');

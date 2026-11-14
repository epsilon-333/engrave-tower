// 각인 176개: 각인을 새긴 다른 클래스가 각인 스킬을 쓰고 · 패시브가 발동해도 오류가 없는지 (다른 종족의 궁극기는 대신 쓰는 기술로)
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES, ENGRAVING_SKILLS, engravingSkillFor } = await import(root + '/data/skills.js');
const { ENGRAVINGS } = await import(root + '/data/engravings.js');
let fails = 0, n = 0;
const clsList = ['greatsword', 'elementalist', 'ranger', 'shadowblade'];
for (const [eid, e] of Object.entries(ENGRAVINGS)) {
  const cid = clsList[n++ % clsList.length], c = CLASSES[cid], sid = engravingSkillFor(eid, c.race); // 궁극기는 그 종족만: 다른 종족이면 대신 쓰는 기술
  if (!sid) { fails++; console.log('FAIL 스킬 없음', eid, cid); continue; }
  try {
    const b = computeBuild({ race: c.race, cls: cid, level: 30, allSkills: true, alloc: { str: 20, mag: 20, agi: 10, vit: 10 }, engravings: {}, runEng: [{ id: eid, lv: 2 }], gear: { weapon: c.weapons[1], off: c.off }, skills: [sid] });
    if (!b.skills.includes(sid)) throw new Error('스킬이 장착되지 않음: ' + sid);
    const w = new World({ build: b, mode: 'field', zoneId: 'world', seed: 99, practice: null }), p = w.player;
    w.enemies.slice(0, 8).forEach((x, i) => { x.x = p.x + 30 + (i % 4) * 14; x.y = p.y - 20 + Math.floor(i / 4) * 24; x.state = 'chase'; });
    const inp = { moveX: 0, moveY: 0, aimX: p.x + 60, aimY: p.y, attack: false, autoAim: true };
    for (let r = 0; r < 2; r++) {
      p.res = 100; p.cds = {}; p.hp = w.d.maxHp;
      w.castSkillId(sid, 0);
      for (let f = 0; f < 120; f++) { inp.attack = f % 20 < 10; inp.dash = f === 60; w.step(inp); w.events.length = 0; if (w.state !== 'play') { w.state = 'play'; p.hp = w.d.maxHp; } }
    }
  } catch (err) { fails++; console.log('FAIL', eid, sid, cid, err.message, (err.stack || '').split('\n')[1]); }
}
console.log(fails ? `${fails} failures` : `ALL OK (${n})`);

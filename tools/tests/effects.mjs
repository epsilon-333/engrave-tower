// 각인 · 장비 효과가 지금 체계에서 실제로 먹히는지 (오러 · 종족 자원 · 마무리 · 피의 마법)
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const ok = (cond, text) => { console.log(cond ? 'OK ' : 'FAIL', text); if (!cond) process.exitCode = 1; };
const mk = (cls, engravings = {}, gear = {}) => {
  const c = CLASSES[cls];
  const b = computeBuild({ race: c.race, cls, level: 20, allSkills: true, alloc: {}, engravings, gear: { weapon: c.weapons[0], ...gear }, skills: c.skills.slice(0, 4) });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 7 });
  w.enemies.forEach((e) => { e.x = -999; e.y = -999; });
  return w;
};

// 기사: 오러 증폭 문양 → 맞아서 얻는 오러 +50%, 오러 50 이상이면 받는 피해 -10%
const kn = Object.keys(CLASSES).find((k) => CLASSES[k].race === 'knight');
const base = mk(kn), sig = mk(kn, { heart: 'auraSigil' });
for (const w of [base, sig]) { w.player.res = 0; w.hurtPlayer(40, 'phys', null, { direct: true }); }
ok(sig.player.res > base.player.res * 1.4, `맞아서 얻는 오러 ${base.player.res.toFixed(1)} → ${sig.player.res.toFixed(1)}`);
for (const w of [base, sig]) { w.player.res = 80; w.player.hp = w.d.maxHp; w.player.invuln = 0; w.hurtPlayer(40, 'phys', null, { direct: true }); }
const lostB = base.d.maxHp - base.player.hp, lostS = sig.d.maxHp - sig.player.hp;
ok(lostS < lostB * 0.95, `오러가 넉넉할 때 받는 피해 ${lostB.toFixed(1)} → ${lostS.toFixed(1)}`);

// 공명석 목걸이: 얻는 종족 자원 +15%
const g0 = mk(kn), g1 = mk(kn, {}, { acc1: 'manaGem' });
for (const w of [g0, g1]) { w.player.res = 0; w.addRes(20); }
ok(Math.abs(g1.player.res - g0.player.res * 1.15) < 0.01, `얻는 종족 자원 ${g0.player.res} → ${g1.player.res.toFixed(1)}`);

// 마무리(체력 30% 밑의 적에게 피해 +25%)
const h = mk(kn); h.d.lowHunt = 0.25;
const e = h.enemies[0]; e.x = h.player.x + 20; e.y = h.player.y;
e.hp = e.maxHp; const hi = h.damageEnemy(e, 10, 'phys', { src: 'attack' });
e.hp = e.maxHp * 0.2; const lo = h.damageEnemy(e, 10, 'phys', { src: 'attack' });
ok(lo > hi * 1.2, `체력이 적은 적에게 주는 피해 ${hi.toFixed(1)} → ${lo.toFixed(1)}`);

// 피의 마법: 자원이 모자라면 체력으로 스킬을 쓴다
const bm = mk(kn, { heart: 'bloodMagic' }), p = bm.player;
const { SKILLS } = await import(root + '/data/skills.js');
const costly = bm.b.skills.find((id) => SKILLS[id]?.cost > 0);
if (costly) {
  p.res = 0; p.hp = bm.d.maxHp; p.cds = {};
  bm.castSkillId(costly, 0);
  ok(p.cds[costly] > 0.5 && p.hp < bm.d.maxHp, `자원 0에서 「${SKILLS[costly].name}」을 체력으로 썼다 (HP ${Math.round(p.hp)}/${bm.d.maxHp})`);
} else console.log('SKIP 자원 드는 스킬 없음');

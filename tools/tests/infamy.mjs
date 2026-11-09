// 악명이 높을수록 경비병이 강해진다 (악명 1마다 체력 +2% · 공격 +1%, 100까지) · 다른 몬스터는 그대로
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const c = CLASSES.greatsword, b = computeBuild({ race: c.race, cls: 'greatsword', level: 10, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] } });
const w = new World({ build: b, mode: 'field', zoneId: 'world' });
const at = (id, inf) => { w.infamy = inf; return w.makeEnemy(id, 0, 0, { noAffix: true }); };
let bad = 0; const ok = (cond, t) => { console.log(cond ? 'OK ' : 'FAIL', t); if (!cond) bad++; };
const g0 = at('royalGuard', 0), g50 = at('royalGuard', 50), g999 = at('royalGuard', 999);
ok(Math.abs(g50.maxHp / g0.maxHp - 2) < 0.01 && Math.abs(g50.atk / g0.atk - 1.5) < 0.01, `악명 50: 체력 ×2 · 공격 ×1.5 (${(g50.maxHp / g0.maxHp).toFixed(2)} · ${(g50.atk / g0.atk).toFixed(2)})`);
ok(Math.abs(g999.maxHp / g0.maxHp - 3) < 0.01, '악명 100에서 멈춘다 (체력 ×3)');
ok(at('goblin', 80).maxHp === at('goblin', 0).maxHp, '경비병이 아니면 그대로');
process.exitCode = bad ? 1 : 0;

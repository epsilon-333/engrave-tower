// 결투: 사람에게도 CC가 걸린다 (기절 · 공포 · 침묵 · 끌어오기 · 밀치기)
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { DUEL_ZONE, buildDuelArena } = await import(root + '/data/maps/arena.js');
const ok = (c, t) => { console.log(c ? 'OK ' : 'FAIL', t); if (!c) process.exitCode = 1; };
const mk = (learned) => { const c = CLASSES.greatsword, b = computeBuild({ race: 'knight', cls: 'greatsword', level: 15, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] }, learned, skills: learned }); const w = new World({ build: b, mode: 'field', zone: DUEL_ZONE, zoneId: 'duel', seed: 1, map: buildDuelArena(), pvp: { opp: { name: 'x' } } }); w.enemies = []; return w; };
for (const [id, check, name] of [['quakeStomp', (B) => B.player.ccT > 0, '기절'], ['fearShout', (B) => B.player.fearT > 0, '공포'], ['silenceSeal', (B) => B.player.silT > 0, '침묵'], ['chainHook', (B, x0) => Math.abs(B.player.x - x0) > 20, '끌어오기']]) {
  const A = mk([id]), B = mk([]);
  A.player.x = 280; B.player.x = id === 'chainHook' ? 380 : 300; A.player.y = B.player.y = 200;
  const e = A.addRemote({ name: 'B', maxHp: B.d.maxHp }, B.player.x, B.player.y); B.addRemote({ name: 'A', maxHp: A.d.maxHp }, A.player.x, A.player.y);
  const x0 = B.player.x; A.player.res = 100; A.castSkillId(id, 0);
  let hit = false;
  for (let f = 0; f < 60; f++) { A.step({ moveX: 0, moveY: 0, aimX: e.x, aimY: e.y }); for (const m of A.pvp.out.splice(0)) if (m.t === 'dhit') B.pvpHit(m); B.step({ moveX: 0, moveY: 0, aimX: 0, aimY: 0 }); if (check(B, x0)) hit = true; e.x = B.player.x; e.y = B.player.y; e.tx = e.x; e.ty = e.y; }
  ok(hit, `${name} 이(가) 상대 사람에게 걸린다`);
}

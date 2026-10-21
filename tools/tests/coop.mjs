// 파티 탑: 방장의 세계(적을 움직인다)와 동료의 세계(꼭두각시)를 네트워크 대신 직접 이어서
// 동료의 공격이 방장의 적에게 들어가는지 · 적이 가까운 동료를 노리고 때리는지 · 쓰러뜨린 적이 양쪽에서 사라지는지 · 모두 쓰러지면 알 수 있는지
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const { generateField } = await import(root + '/sim/mapgen.js');
const { towerZoneId, towerSize } = await import(root + '/data/tower.js');
const ok = (cond, text) => { console.log(cond ? 'OK ' : 'FAIL', text); if (!cond) process.exitCode = 1; };

const f = 3, seed = 4242, zid = towerZoneId(f), z = ZONES.find((x) => x.id === zid);
const mk = (cls, role) => {
  const c = CLASSES[cls], b = computeBuild({ race: c.race, cls, level: 12, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] }, skills: c.skills.slice(0, 4) });
  const w = new World({ build: b, mode: 'field', zoneId: zid, seed, map: generateField(z, seed, Math.floor(f / 6), towerSize(f)), tower: { f }, coop: { role } });
  if (role === 'member') { w.enemies = []; w.camps = []; }
  return w;
};
const H = mk('greatsword', 'host'), M = mk('berserker', 'member');
ok(H.tw === M.tw && H.tiles.every((t, i) => t === M.tiles[i]), '같은 씨앗이면 방장과 동료의 층 지도가 같다');

// 방장은 입구에, 동료는 첫 적 무리 옆에 (적은 더 가까운 동료를 노려야 한다)
const target = H.enemies.find((e) => !e.def.elite && !e.lair);
M.player.x = target.x - 30; M.player.y = target.y;
const mate = { id: 2, name: '동료', x: M.player.x, y: M.player.y, r: 5, dead: false };
H.coop.mates.set(2, mate);
let snaps = 0, hits = 0, hurts = 0, kills0 = Object.values(M.loot.kills).reduce((a, b) => a + b, 0);
const hostHp0 = H.player.hp;
for (let fr = 0; fr < 60 * 25; fr++) {
  mate.x = M.player.x; mate.y = M.player.y; mate.dead = !!M.player.down;
  const near = M.enemies.filter((e) => !e.dead).sort((a, b) => Math.hypot(a.x - M.player.x, a.y - M.player.y) - Math.hypot(b.x - M.player.x, b.y - M.player.y))[0];
  const aim = near ? { aimX: near.x, aimY: near.y } : { aimX: M.player.x + 10, aimY: M.player.y };
  M.step({ moveX: 0, moveY: 0, attack: fr % 2 === 0, ...aim, autoAim: true });
  H.step({ moveX: 0, moveY: 0, attack: false, aimX: H.player.x + 10, aimY: H.player.y });
  for (const m of M.coFlush()) { H.coRecv(m, 2); if (m.k === 'hit') hits++; }
  for (const m of H.coop.out.splice(0)) if (m.k === 'hurt' && m.to === 2) { M.coHurt(m); hurts++; }
  if (fr % 6 === 0) { M.coApplySnap(H.coSnap()); snaps++; }
  if (M.player.down) M.player.hp = 0;
  M.events.length = 0; H.events.length = 0; M.signals.length = 0; H.signals.length = 0;
}
const aliveH = H.enemies.filter((e) => !e.dead).length, aliveM = M.enemies.filter((e) => !e.dead).length;
const kills = Object.values(M.loot.kills).reduce((a, b) => a + b, 0) - kills0;
console.log(`동료의 공격 ${hits}번 · 동료가 맞은 것 ${hurts}번 · 동료가 쓰러뜨린(함께 본) 적 ${kills} · 남은 적 방장 ${aliveH} / 동료 ${aliveM}`);
ok(hits > 0, '동료의 공격이 방장의 적에게 간다');
ok(hurts > 0, '적이 가까운 동료를 노리고 때린다');
ok(H.player.hp === hostHp0, '멀리 있는 방장은 맞지 않는다');
ok(kills > 0, '쓰러뜨린 적은 동료의 도감 · 전리품에도 들어간다');
ok(Math.abs(aliveH - aliveM) <= 1, '방장과 동료가 보는 적의 수가 같다');
const pe = M.enemies.find((e) => !e.dead), he = pe && H.enemies.find((e) => e.id === pe.id);
ok(!pe || (he && Math.hypot(pe.x - he.x, pe.y - he.y) < 24), '꼭두각시가 방장의 적을 따라 움직인다');

// 쓰러짐: 동료가 쓰러지면 적은 방장을 노린다 · 일으켜 세울 수 있다
M.player.hp = 1; M.player.invuln = 0; M.hurtPlayer(9999, 'true', null, { direct: true });
ok(M.player.down && M.state === 'play', '파티 탑에서는 쓰러져도 세계가 멈추지 않는다 (유령)');
M.coRevive();
ok(!M.player.down && M.player.hp > 0, '층을 깨면 다시 일어난다');

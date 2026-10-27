// 파티 등반: 같은 씨앗이면 같은 층 · 몬스터는 파티장의 세계가 부르고 동료는 받아 본다 · 층이 열리면 둘 다 보상 · 문은 파티장에게만
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const { buildClimbFloor } = await import(root + '/sim/climbmap.js');
const C = await import(root + '/data/climb.js');
const ok = (cond, text) => { console.log(cond ? 'OK ' : 'FAIL', text); if (!cond) process.exitCode = 1; };

const f = 2, seed = 777, z = ZONES[0];
const mk = (cls, role) => {
  const c = CLASSES[cls], b = computeBuild({ race: c.race, cls, level: 5, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] } });
  const run = C.newRun({ seed }); run.f = f;
  return new World({ build: b, mode: 'field', zone: z, zoneId: z.id, seed: seed + f * 7919, map: buildClimbFloor(z, seed + f * 7919, f, 'fight'), tower: { f }, coop: { role }, climb: { run, f, kind: 'fight', reward: 'eng', meta: {} } });
};
const H = mk('greatsword', 'host'), M = mk('berserker', 'member');
ok(H.tw === M.tw && H.tiles.every((t, i) => t === M.tiles[i]), '같은 씨앗이면 파티장과 동료의 층이 같다');
const mate = { id: 2, x: M.player.x, y: M.player.y, r: 5, dead: false }; H.coop.mates.set(2, mate);
for (let i = 0; i < 90; i++) { H.step({ moveX: 0, moveY: 0, aimX: H.player.x + 1, aimY: H.player.y }); M.step({ moveX: 0, moveY: 0, aimX: M.player.x + 1, aimY: M.player.y }); H.events.length = M.events.length = 0; }
ok(H.enemies.length > 0, `파티장의 세계에 적이 나온다 (${H.enemies.length})`);
ok(M.enemies.length === 0, '동료의 세계는 스스로 적을 부르지 않는다');
M.coApplySnap(H.coSnap(), 1);
ok(M.enemies.length === H.enemies.filter((e) => !e.dead).length, '동료는 파티장이 알려 준 적을 본다');
// 파티장이 모두 쓰러뜨린다
let guard = 0;
while (H.climb.phase === 'fight' && guard++ < 60 * 60) {
  for (const e of H.enemies) if (!e.dead) H.damageEnemy(e, 1e6, 'true');
  H.step({ moveX: 0, moveY: 0, aimX: H.player.x + 1, aimY: H.player.y }); H.events.length = 0;
}
ok(H.climb.phase === 'reward', '파티장의 층이 열린다');
ok(H.signals.some((s) => s.t === 'climbCleared'), '파티장에게 층 돌파 신호');
ok(M.climb.phase === 'fight', '동료는 파티장의 소식을 기다린다');
M.climbCleared(); // 'cclear'
ok(M.objects.some((o) => o.kind === 'climbReward'), '동료에게도 보상이 나타난다 (각자 고른다)');
H.climbRewardTaken(); M.climbRewardTaken();
ok(H.objects.some((o) => o.kind === 'climbDoor'), '파티장에게는 문이 열린다');
ok(!M.objects.some((o) => o.kind === 'climbDoor'), '동료에게는 문이 없다 (파티장이 고른다)');

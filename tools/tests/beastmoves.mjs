// 몬스터 몸 기술: 박치기에 밀려나고 벽에 부딪히면 기절 · 거미줄에 묶임 · 내려찍기에 느려짐 · 모든 짐승 기술이 오류 없이 끝난다
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const { BEAST, BEAST_KIT } = await import(root + '/sim/beastmoves.js');

const c = CLASSES.guardian;
const b = computeBuild({ race: c.race, cls: 'guardian', level: 30, alloc: { vit: 30 }, engravings: {}, gear: { weapon: c.weapons[0] } });
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } };
const fresh = () => {
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 4242 });
  for (const o of w.enemies) { o.dead = true; o.hp = 0; }
  w.player.invuln = 0; w.d.dodge = 0;
  return w;
};
const idle = (w) => ({ moveX: 0, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y, attack: false });
const spawn = (w, id, dx, dy) => { const e = w.makeEnemy(id, w.player.x + dx, w.player.y + dy, { noAffix: true }); e.state = 'chase'; e.mvCd = 99; w.enemies.push(e); return e; };
const run = (w, n, each) => { for (let f = 0; f < n; f++) { each?.(f); w.player.hp = w.d.maxHp; w.step(idle(w)); w.events.length = 0; } };

// 1) 박치기: 맞으면 밀려난다
{
  const w = fresh(), p = w.player, e = spawn(w, 'chargeBoar', -60, 0), x0 = p.x;
  BEAST.headbutt.start(w, e, p, 60);
  let kb = false; run(w, 90, () => { if (p.kb) kb = true; });
  ok(kb && Math.abs(p.x - x0) > 40, `박치기에 밀려나지 않았다 (이동 ${Math.round(p.x - x0)})`);
}
// 2) 벽 쪽으로 밀리면 기절
{
  const w = fresh(), p = w.player, e = spawn(w, 'chargeBoar', -60, 0);
  w.player.kb = null; w.knockPlayer(p.x - 10, p.y, 120, { wallStun: 0.8 });
  // 오른쪽에 벽을 세운다
  const oldBlocked = w.blocked.bind(w), wx = p.x + 12; w.blocked = (x, y, r, m) => x + r > wx || oldBlocked(x, y, r, m);
  let stunned = false; run(w, 30, () => { if (p.ccT > 0) stunned = true; });
  ok(stunned, '벽에 부딪혀도 기절하지 않는다');
  w.blocked = oldBlocked; void e;
}
// 3) 거미줄: 맞으면 묶인다
{
  const w = fresh(), p = w.player, e = spawn(w, 'poisonSpider', -80, 0);
  BEAST.web.start(w, e, p, 80);
  let rooted = false; run(w, 90, () => { if (p.rootT > 0) rooted = true; });
  ok(rooted, '거미줄에 맞아도 묶이지 않는다');
}
// 4) 내려찍기: 맞으면 느려진다
{
  const w = fresh(), p = w.player, e = spawn(w, 'yeti', -18, 0);
  BEAST.maul.start(w, e, p, 18);
  let slowed = false; run(w, 90, () => { if (p.slowT > 0) slowed = true; });
  ok(slowed, '내려찍기에 맞아도 느려지지 않는다');
}
// 5) 모든 몬스터의 몸 기술이 오류 없이 끝나고 기술이 풀린다
for (const [id, kit] of Object.entries(BEAST_KIT)) for (const k of new Set(kit)) {
  if (!BEAST[k]) continue;
  try {
    const w = fresh(), p = w.player, e = spawn(w, id, -50, 10);
    if (!e.def) continue;
    BEAST[k].start(w, e, p, 50);
    run(w, 240);
    ok(!e.mv || e.dead, `${id} ${k}: 기술이 끝나지 않는다 (${e.mv?.k} ${e.mv?.ph})`);
    ok(!e.under, `${id} ${k}: 땅속에서 나오지 않는다`);
  } catch (err) { fails++; console.log('FAIL', id, k, err.message, err.stack.split('\n')[1]); }
}
console.log(fails ? `${fails} failures` : 'ALL OK');
process.exit(fails ? 1 : 0);

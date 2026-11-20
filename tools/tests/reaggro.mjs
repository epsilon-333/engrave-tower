// 어그로가 풀려 집으로 돌아가던 몬스터: 다시 가까이 가면 다시 쫓아온다 · 길이 막혀 못 가면 그 자리에서 멈춘다
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');

const c = CLASSES.guardian;
const b = computeBuild({ race: c.race, cls: 'guardian', level: 20, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0], off: c.off } });
const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 777 });
const p = w.player, e = w.enemies.find((x) => !x.def.elite && x.def.ai !== 'dummy');
for (const o of w.enemies) if (o !== e) { o.dead = true; o.hp = 0; }
const idle = { moveX: 0, moveY: 0, aimX: p.x + 10, aimY: p.y, attack: false };
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };

// 1) 돌아가는 중에 내가 가까이 있으면 다시 쫓는다
e.home = { x: p.x + 300, y: p.y }; e.x = p.x + 40; e.y = p.y; e.state = 'return';
let chased = false;
for (let f = 0; f < 120 && !chased; f++) { p.hp = w.d.maxHp; e.x = p.x + 40; e.y = p.y; w.step(idle); w.events.length = 0; if (e.state === 'chase') chased = true; }
ok(chased, '돌아가던 몬스터가 가까이 온 나를 다시 쫓지 않는다');

// 2) 집에 못 가면(막힘) 6초 뒤 그 자리에서 멈춘다
e.state = 'return'; e.home = { x: e.x + 2000, y: e.y }; p.x = e.x + 200; p.y = e.y;
const sx = e.x, sy = e.y;
for (let f = 0; f < 60 * 7; f++) { e.x = sx; e.y = sy; p.x = sx + 200; p.y = sy; p.hp = w.d.maxHp; w.step(idle); w.events.length = 0; }
ok(e.state === 'idle', `막힌 몬스터가 계속 돌아가는 중 (${e.state})`);

console.log(fails ? `${fails} failures` : 'ALL OK');
process.exit(fails ? 1 : 0);

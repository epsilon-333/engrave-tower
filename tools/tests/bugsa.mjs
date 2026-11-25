// 고친 버그의 재현 시험 (2026-11-25 · 상시 반사 · 소환체 · 각인 빼기 · 점프 · 폭발 · 펫)
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { MONSTERS, ZONES } = await import(root + '/data/monsters.js');
let bad = 0;
const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } };
const idle = { moveX: 0, moveY: 0, attack: false };
const mkWorld = (eng = {}, extra = {}) => new World({ build: computeBuild({ race: 'orc', level: 30, alloc: { str: 30 }, engravings: eng, ...extra }), mode: 'field', zoneId: ZONES[0].id, seed: 7 });

// 1) 늘 켜져 있는 반사가 없다: 반사는 예고 있는 기술(반사 방패 · 가시 세움)만
{
  const always = Object.entries(MONSTERS).filter(([, d]) => d.reflect).map(([k]) => k);
  ok(!always.length, `상시 반사 몬스터가 없다 (${always.join(',')})`);
  const w = mkWorld(); for (let i = 0; i < 30; i++) w.step(idle);
  const e = w.makeEnemy('mirrorKnight', w.player.x + 20, w.player.y); w.enemies.push(e);
  const hp0 = w.player.hp; w.damageEnemy(e, 100, 'phys', { src: 'attack' });
  ok(w.player.hp === hp0, '거울 기사를 때려도 되돌아오지 않는다');
}

// 2) 붙잡는 망령은 내 걸음을 그대로 따라오지 않는다 · 적을 찾아 떠다니고 · 너무 멀어지면 돌아온다
{
  const w = mkWorld(); for (let i = 0; i < 30; i++) w.step(idle);
  w.enemies.length = 0;
  const p = w.player, al = { id: w.nextId++, kind: 'grasper', x: p.x - 60, y: p.y, t: 99, max: 99, atk: 1, cd: 0, phase: 0, dir: 1, r: 5, hp: 100, maxHp: 100 };
  w.allies.push(al);
  for (let i = 0; i < 60; i++) w.step(idle);
  const ax = al.x, ay = al.y, px = p.x;
  for (let i = 0; i < 15; i++) w.step({ moveX: 1, moveY: 0, attack: false });
  ok(Math.abs(al.x - ax) + Math.abs(al.y - ay) < Math.abs(p.x - px) * 0.5, `조금 걸어도 망령이 붙어 따라오지 않는다 (망령 ${Math.hypot(al.x - ax, al.y - ay).toFixed(1)} · 나 ${Math.abs(p.x - px).toFixed(1)})`);
  for (let i = 0; i < 240; i++) w.step({ moveX: 1, moveY: 0.3, attack: false });
  for (let i = 0; i < 120; i++) w.step(idle);
  ok(Math.hypot(al.x - p.x, al.y - p.y) < 120, `멀리 가면 돌아온다 (${Math.hypot(al.x - p.x, al.y - p.y).toFixed(0)})`);
  const e = w.makeEnemy('slime', p.x + 120, p.y); w.enemies.push(e); const d0 = Math.hypot(al.x - e.x, al.y - e.y);
  for (let i = 0; i < 40; i++) w.step(idle);
  ok(Math.hypot(al.x - e.x, al.y - e.y) < d0 - 10 || Math.hypot(al.x - e.x, al.y - e.y) < 110, '적을 보면 스스로 그쪽으로 간다');
}

// 4) 도약하던 몬스터가 기절 · 끊김으로 기술이 사라져도 공중에 멈춰 남지 않는다
{
  const w = mkWorld(); for (let i = 0; i < 30; i++) w.step(idle);
  const e = w.makeEnemy('slime', w.player.x + 60, w.player.y); w.enemies.push(e);
  e.jumpH = 24; e.mv = null; // 뛰던 중에 기술이 끊겼다
  for (let i = 0; i < 60; i++) w.step(idle);
  ok(!e.jumpH, `끊긴 도약은 땅으로 내려앉는다 (높이 ${e.jumpH})`);
  const p = w.player; p.hop = { t: 0, dur: 0.3, x0: p.x, y0: p.y, x1: p.x, y1: p.y, h: 10 };
  ok(w.castSkillId('comboSlash', 0) === false, '뛰어내리는 중엔 다른 기술이 끼어들지 않는다');
  for (let i = 0; i < 40; i++) w.step(idle);
  ok(!p.hop && !p.air, `뛰어내린 뒤 땅에 선다 (높이 ${p.air})`);
}

// 5) 처치하면 터지는 효과: 죽은 자리에서 터지고 · 튀는 파편은 유도 없이 사방으로 곧게 · 스킬 그림(sk)이 붙지 않는다
{
  const w = mkWorld(); for (let i = 0; i < 30; i++) w.step(idle);
  const e = w.makeEnemy('slime', w.player.x + 80, w.player.y); w.enemies.push(e);
  w._sk = 'someSkill'; const evs = []; const em = w.emit.bind(w); w.emit = (ev) => { evs.push(ev); return em(ev); };
  const n0 = w.projs.length;
  w.doAction({ strike: { r: 30, mul: 1, elem: 'fire', fx: 'burst', type: 'mag' }, shards: { n: 4, mul: 0.5, type: 'phys' } }, null, e);
  w.emit = em; w._sk = null;
  const aoe = evs.find((v) => v.t === 'skillAoe');
  ok(aoe && aoe.x === e.x && aoe.y === e.y && !aoe.sk, '처치 폭발은 죽은 자리에서 · 스킬 그림 없이');
  const sh = w.projs.slice(n0);
  ok(sh.length === 4 && sh.every((q) => !q.homing && q.straight && q.x === e.x), '파편은 유도 없이 곧게 · 터진 자리에서');
}

// 3) 각인 부하 한도는 레벨로만: 정신을 다시 찍어 낮춰도 한도가 줄지 않는다
{
  const a = computeBuild({ race: 'orc', level: 40, alloc: { spi: 39 }, engravings: {} }), b = computeBuild({ race: 'orc', level: 40, alloc: { str: 39 }, engravings: {} });
  ok(a.derived.loadCap === b.derived.loadCap, `정신과 상관없는 부하 한도 (${a.derived.loadCap} · ${b.derived.loadCap})`);
  ok(computeBuild({ race: 'orc', level: 100, alloc: {}, engravings: {} }).derived.loadCap > computeBuild({ race: 'orc', level: 1, alloc: {}, engravings: {} }).derived.loadCap, '레벨이 오르면 한도가 는다');
}

// 6) 소환체를 준 각인(스킬)을 빼면 그 소환체가 바로 사라진다
{
  const w = mkWorld(); for (let i = 0; i < 30; i++) w.step(idle);
  const sk = (w.b.skills || []).find(Boolean) || null;
  w.allies.push({ id: w.nextId++, kind: 'ghost', x: w.player.x, y: w.player.y, t: 99, max: 99, atk: 1, cd: 0, phase: 0, dir: 1, sk: 'notMySkill' });
  w.allies.push({ id: w.nextId++, kind: 'ghost', x: w.player.x, y: w.player.y, t: 99, max: 99, atk: 1, cd: 0, phase: 0, dir: 1, sk });
  const m = { kind: 'soul', maxHp: 10, atk: 1, sk: 'notMySkill' }; w.minions.push(m); w.spawnMinion(m, w.player.x, w.player.y);
  w.setBuild(w.b);
  ok(!w.allies.some((a) => a.sk === 'notMySkill') && !w.minions.includes(m), '뺀 각인의 소환체 · 부하는 사라진다');
  ok(!sk || w.allies.some((a) => a.sk === sk), '끼운 각인의 소환체는 남는다');
}

if (bad) { console.log(`${bad}개 실패`); process.exitCode = 1; } else console.log('ALL OK');

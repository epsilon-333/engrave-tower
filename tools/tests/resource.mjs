// 종족 자원 (2026-11-19): 기본 수입 · 자원 각인(패시브 · 액티브) · 규칙(패시브 각인엔 스킬 없음 · 액티브 각인엔 패시브 없음)
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES, SKILLS, ENGRAVING_SKILLS } = await import(root + '/data/skills.js');
const { ENGRAVINGS } = await import(root + '/data/engravings.js');
const { RES_ENGS } = await import(root + '/data/resengs.js');
const { RACES } = await import(root + '/data/races.js');
const { ZONES, MONSTERS } = await import(root + '/data/monsters.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } };
const c = CLASSES.guardian;
const slotOf = (id) => ENGRAVINGS[id].slot;
const mk = (engs = []) => {
  const engravings = {}; for (const id of engs) engravings[slotOf(id)] = id;
  const b = computeBuild({ race: c.race, cls: 'guardian', level: 30, alloc: { vit: 30, str: 20 }, engravings, gear: { weapon: c.weapons[0], off: c.off } });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 4242 });
  for (const o of w.enemies) { o.dead = true; o.hp = 0; } w.enemies = []; w.player.invuln = 0; w.d.dodge = 0; w.player.res = 0;
  return w;
};
const idle = (w) => ({ moveX: 0, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y, attack: false });
const spawn = (w, id, dx, dy) => { const e = w.makeEnemy(id, w.player.x + dx, w.player.y + dy, { noAffix: true }); e.state = 'chase'; e.mvCd = 99; w.enemies.push(e); return e; };
const run = (w, n) => { for (let f = 0; f < n; f++) { w.player.hp = w.d.maxHp; w.step(idle(w)); w.events.length = 0; } };

// 1) 데이터 규칙
for (const [id, name, , grade, , effects, skill] of RES_ENGS) {
  ok(ENGRAVINGS[id] && ENGRAVINGS[id].grade === grade, `${name}: 각인이 있다`);
  if (skill) ok((effects.length === 0 || id === 'rFlame') && SKILLS[skill] && ENGRAVING_SKILLS[id] === skill, `${name}: 스킬 각인엔 패시브 효과가 없다`);
  else ok(effects.length > 0 && !ENGRAVING_SKILLS[id], `${name}: 패시브 각인엔 딸린 스킬이 없다`);
}
ok(Object.values(RACES).every((r) => r.res.regen === 2 && r.res.kill === 5 && !r.res.hit && !r.res.decay), '모든 종족: 처치 +5 · 초당 2 · 적중 없음 · 줄어듦 없음');
const dashFree = RES_ENGS.every((e) => !JSON.stringify(e[5]).includes('"dash"') && !JSON.stringify(e[5]).includes('"shield"'));
ok(dashFree, '대시 · 막기로 자원을 얻는 각인은 없다');

// 2) 기본 수입: 초당 2 · 보스와 싸우면 초당 5 · 처치 +5 · 적중으로는 안 오른다
{
  const w = mk(); run(w, 60); ok(Math.abs(w.player.res - 2) < 0.2, `기본 초당 2 (${w.player.res.toFixed(2)})`);
  const v = mk(); const boss = spawn(v, Object.keys(MONSTERS).find((k) => MONSTERS[k].boss), 80, 0); boss.hp = boss.maxHp = 1e9; boss.atk = 0; run(v, 60);
  ok(v.bossFight() && Math.abs(v.player.res - 5) < 0.3, `보스와 싸우면 초당 5 (${v.player.res.toFixed(2)})`);
  const k = mk(), g = spawn(k, 'goblin', 30, 0); k.player.res = 0; g.hp = 1; k.damageEnemy(g, 999, 'true', {}); k.checkDeath?.(g);
  ok(k.player.res >= 4.9, `처치하면 +5 (${k.player.res.toFixed(1)})`);
  const h = mk(), t = spawn(h, 'goblin', 30, 0); t.hp = t.maxHp = 1e9; h.player.res = 0; h.hitEnemy(t, 10, 'phys', true); ok(h.player.res === 0, '적중으로는 자원이 안 오른다');
}

// 3) 패시브
{
  const w = mk(['rHurt']), at = spawn(w, 'goblin', 20, 0); w.player.res = 0; w.player.invuln = 0; w.hurtPlayer(10, 'phys', at, {});
  ok(Math.abs(w.player.res - 4) < 0.01, `맞은 숨: +4 (${w.player.res})`);
  w.player.invuln = 0; w.hurtPlayer(10, 'phys', at, {}); ok(Math.abs(w.player.res - 4) < 0.01, '맞은 숨: 3초에 한 번');
  const w2 = mk(['rDodge']); w2.d.dodge = 1; w2.player.res = 0; w2.hurtPlayer(10, 'phys', null, {}); ok(w2.player.res >= 7.9, `비껴가는 숨: 회피하면 +8 (${w2.player.res})`);
  const w3 = mk(['rLow']); w3.player.res = 0; for (let f = 0; f < 60; f++) { w3.player.hp = w3.d.maxHp * 0.2; w3.step(idle(w3)); w3.events.length = 0; }
  ok(w3.player.res > 4.5 && w3.player.res < 5.5, `벼랑 끝의 숨: 체력 30% 이하면 초당 +3 (+기본 2 = ${w3.player.res.toFixed(2)})`);
  const w4 = mk(['rLow']); run(w4, 60); ok(w4.player.res < 2.3, `벼랑 끝의 숨: 체력이 넉넉하면 없다 (${w4.player.res.toFixed(2)})`);
}

// 4) 액티브
const cast = (w, id) => { w.player.cds = {}; w.player.res = 100; w.castSkillId(id, 0); };
{
  const w = mk(['rQuiet']); ok(w.b.skills.includes('quietBreath'), '고요한 호흡이 스킬 칸에 들어온다');
  w.player.cds = {}; w.player.res = 100; w.castSkillId('quietBreath', 0); w.player.res = 0; const r0 = w.player.res; run(w, 4 * 60 + 5);
  ok(w.player.res - r0 > 25, `고요한 호흡: 4초 동안 +32 (소모 뒤 ${r0.toFixed(0)} → ${w.player.res.toFixed(0)})`);
}
{
  const w = mk(['rMark']), e = spawn(w, 'goblin', 60, 0); e.hp = e.maxHp = 1e9; w.player.cds = {}; w.player.res = 100; w.castSkillId('resMark', 0); run(w, 20);
  ok(!!e.resMark, '공명의 표식: 적에게 새겨진다');
  w.player.res = 0; w.t += 1; w.damageEnemy(e, 5, 'phys', {}); ok(Math.abs(w.player.res - 2) < 0.01, `표식 맞은 적이 피해를 입으면 +2 (${w.player.res})`);
  w.t += 1; w.damageEnemy(e, 5, 'phys', {}); w.t += 1; w.damageEnemy(e, 5, 'phys', {}); ok(Math.abs(w.player.res - 6) < 0.01, '입을 때마다 +2');
}
{
  const w = mk(['rArrow']), e = spawn(w, 'goblin', 70, 0); e.hp = e.maxHp = 1e9; w.absorbStart(e, { dps: 0.35, rate: 6, max: 12 }); w.player.res = 0; const h0 = e.hp; run(w, 60 * 2);
  ok(e.hp < h0 && w.player.res > 11, `흡수의 화살: 지속 피해와 초당 +6 (피해 ${Math.round(h0 - e.hp)} · 자원 ${w.player.res.toFixed(1)})`);
  e.hp = 1; run(w, 40); ok(!e.absorb || e.dead, '흡수의 화살: 쓰러지면 끝난다');
}
{
  const w = mk(['rFlame']), e1 = spawn(w, 'goblin', 40, 0), e2 = spawn(w, 'goblin', 50, 20); for (const e of [e1, e2]) e.hp = e.maxHp = 1e9;
  w.player.cds = {}; w.player.res = 100; w.castSkillId('resFlame', 0); run(w, 12); ok(w.player.buffs.enchant?.elem === 'fire' && w.player.buffs.enchant.t > 9, '자원의 불꽃(화염 부여): 10초 동안 공격에 불이 붙는다');
  w.player.res = 0; run(w, 60); const base = w.player.res; ok(Math.abs(base - 2) < 0.3, `불타는 적이 없으면 기본 수입만 (${base.toFixed(2)})`);
  w.applyStatus(e1, 'burn', 1); w.applyStatus(e2, 'burn', 1); w.player.res = 0; run(w, 60);
  ok(w.player.res > 5.5 && w.player.res < 7, `불타는 적 둘이면 초당 +4 (+기본 2 = ${w.player.res.toFixed(2)})`);
}
{
  const w = mk(['rBlood']), e = spawn(w, 'goblin', 30, 0); e.hp = 1; w.player.cds = {}; w.player.res = 60; w.castSkillId('bloodDraw', 0); run(w, 40);
  ok(e.dead && w.player.res >= 60 - 32 + 15, `피를 마시는 일격: 쓰러뜨리면 +20 (${w.player.res.toFixed(1)})`);
}
console.log(fails ? `${fails} FAIL` : 'ALL OK'); process.exit(fails ? 1 : 0);

// 몬스터 특성 · 개성 있는 적 탄 (sim/montraits.js · world.enemyShot)
// 방패: 앞은 막고 등 뒤 1.5배 · 아주 느리게 돈다 / 석화 / 구멍 파기 / 마법 / 죽은 척 / 분열 / 도움 요청 / 치유 / 갑각 / 은신 / 폭탄
// 탄: 레이저 · 튕김 · 유도 · 이중나선 · 분열 · 터짐 이 오류 없이 날아가 사람을 맞힌다
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES, MONSTERS } = await import(root + '/data/monsters.js');

const c = CLASSES.guardian;
const b = computeBuild({ race: c.race, cls: 'guardian', level: 30, alloc: { vit: 30 }, engravings: {}, gear: { weapon: c.weapons[0], off: c.off } });
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } };
const fresh = () => { const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 4242 }); for (const o of w.enemies) { o.dead = true; o.hp = 0; } w.enemies = []; w.player.invuln = 0; w.d.dodge = 0; return w; };
const idle = (w) => ({ moveX: 0, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y, attack: false });
const spawn = (w, id, dx, dy) => { const e = w.makeEnemy(id, w.player.x + dx, w.player.y + dy, { noAffix: true }); e.state = 'chase'; e.mvCd = 99; w.enemies.push(e); return e; };
const run = (w, n, each) => { for (let f = 0; f < n; f++) { each?.(f); w.player.hp = w.d.maxHp; w.step(idle(w)); w.events.length = 0; } };
const base = (w) => { const g = spawn(w, 'goblin', -200, 0), h = g.hp; w.damageEnemy(g, 100, 'true', {}); g.dead = true; return h - g.hp; }; // 다른 배율(종족 보정 등)을 뺀 기준 피해
const byTrait = (t) => Object.keys(MONSTERS).find((id) => MONSTERS[id].trait === t);

// 방패: 앞에서 친 피해는 방패가 받고, 등 뒤는 1.5배
{
  const w = fresh(), e = spawn(w, byTrait('shield'), 40, 0); e.face = Math.PI; // 나(왼쪽)를 본다
  const hp0 = e.hp; w.damageEnemy(e, 100, 'true', { src: 'attack' });
  ok(e.hp === hp0 && e.shieldHp < e.maxHp * 2, `방패: 앞의 피해를 방패가 받는다 (체력 ${hp0}→${e.hp})`);
  e.face = 0; const h1 = e.hp; w.damageEnemy(e, 100, 'true', { src: 'attack' });
  ok(Math.abs((h1 - e.hp) / base(w) - 1.5) < 0.01, `방패: 등 뒤는 1.5배 (${h1 - e.hp})`);
  e.face = 0; run(w, 30); ok(Math.abs(e.face) < 0.6 + 0.01, `방패: 0.5초에 0.45라디안만 돈다 (${e.face.toFixed(2)})`);
}
// 석화: 체력 60% 밑 → 5초 돌 · 피해 -80%
{
  const w = fresh(), e = spawn(w, byTrait('stone'), 60, 0); e.trCd = 0; e.hp = e.maxHp * 0.5; run(w, 2);
  ok(e.stoneT > 4, '석화: 돌이 된다'); const h = e.hp; w.damageEnemy(e, 100, 'true', {}); ok(Math.abs((h - e.hp) / base(w) - 0.2) < 0.01, `석화: 피해 -80% (${h - e.hp})`);
  const x0 = e.x; run(w, 60); ok(Math.abs(e.x - x0) < 0.5, '석화: 움직이지 않는다');
}
// 죽은 척: 처음 쓰러지면 3초 뒤 40%로 일어난다
{
  const w = fresh(), e = spawn(w, byTrait('feign'), 80, 0); w.damageEnemy(e, e.hp + 10, 'true', {});
  ok(!e.dead && e.feignT > 0, '죽은 척: 쓰러지지 않고 눕는다'); run(w, 200); ok(!e.dead && Math.abs(e.hp - e.maxHp * 0.4) < 2, `죽은 척: 40%로 일어난다 (${Math.round(e.hp)})`);
  w.damageEnemy(e, e.hp + 10, 'true', {}); ok(e.dead, '죽은 척: 두 번째는 쓰러진다');
}
// 분열: 쓰러지면 둘
{ const w = fresh(), e = spawn(w, byTrait('split'), 80, 0); w.damageEnemy(e, e.hp + 10, 'true', {}); ok(w.enemies.filter((o) => !o.dead && o.splitChild).length === 2, '분열: 둘로 갈라진다'); }
// 갑각: 껍질이 있으면 -75%
{ const w = fresh(), e = spawn(w, byTrait('carapace'), 80, 0), h = e.hp; w.damageEnemy(e, 100, 'true', {}); ok(Math.abs((h - e.hp) / base(w) - 0.25) < 0.01, `갑각: 피해 -75% (${h - e.hp})`); }
// 치유사: 다친 동료를 고친다
{ const w = fresh(), hl = spawn(w, byTrait('healer'), 100, 0), o = spawn(w, 'goblin', 110, 10); o.hp = o.maxHp * 0.3; hl.trCd = 0; run(w, 5); ok(o.hp > o.maxHp * 0.3 + 1, '치유사: 동료 회복'); }
// 도움 요청: 둘레의 쉬는 몬스터를 부른다
{ const w = fresh(), e = spawn(w, byTrait('callHelp'), 60, 0), o = spawn(w, 'slime', 150, 0); o.state = 'idle'; e.hp = e.maxHp * 0.2; run(w, 2); ok(o.state === 'chase', '도움 요청: 동료가 달려온다'); }
// 구멍 파기 · 마법 · 은신 · 폭탄: 오류 없이 돈다
for (const t of ['dig', 'caster', 'stalker', 'bomber', 'rammer']) { const w = fresh(); const e = spawn(w, byTrait(t), 90, 0); e.trCd = 0; let err = null; try { run(w, 400); } catch (x) { err = x; } ok(!err, `${t}: 오류 없이 돈다 ${err ? err.stack : ''}`); }
// 개성 있는 탄: 각 무늬가 사람을 맞힌다 (레이저는 예고 뒤)
for (const pat of ['laser', 'bounce', 'homing', 'helix', 'split', 'burst']) {
  const id = Object.keys(MONSTERS).find((k) => MONSTERS[k].proj?.pat === pat);
  const w = fresh(), e = spawn(w, id, 90, 0); e.atk = 10; let hit = 0, err = null;
  const hp = w.player.hp; w.player.invuln = 0;
  try { w.enemyShot(e, Math.PI, 1, 0); for (let f = 0; f < 240; f++) { e.shotCd = 99; e.trCd = 99; w.player.invuln = 0; const h0 = w.player.hp; w.step(idle(w)); if (w.player.hp < h0) hit++; w.player.hp = w.d.maxHp; w.events.length = 0; } } catch (x) { err = x; }
  ok(!err && hit > 0, `탄 ${pat} (${id}): 맞힌다 ${err ? err.stack : ''}`);
}
console.log(fails ? `${fails} failures` : 'ALL OK');
process.exit(fails ? 1 : 0);

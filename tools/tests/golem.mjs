// 이끼 골렘 (sim/golem.js): 거리마다 고르는 기술 · 돌진에 벽까지 밀림 + 기절 · 자가수복 끊김 · 연계
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const c = CLASSES.guardian;
const idle = (w) => ({ moveX: 0, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y, attack: false });
const mk = (dx, seed = 7) => {
  const b = computeBuild({ race: c.race, cls: 'guardian', level: 30, alloc: { vit: 30 }, engravings: {}, gear: { weapon: c.weapons[0], off: c.off } });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed });
  for (const o of w.enemies) o.dead = true; w.enemies = [];
  const e = w.makeEnemy('mossLord', w.player.x + dx, w.player.y, { noAffix: true }); e.state = 'chase'; e.hp = e.maxHp = 1e9; w.enemies.push(e);
  w.step(idle(w)); return { w, e };
};
const fight = (dx, secs, hold = true) => {
  const { w, e } = mk(dx), moves = {}, seen = {};
  if (hold) e.speedMul = 0.05;
  for (let f = 0; f < secs * 55; f++) {
    w.player.hp = w.d.maxHp;
    if (hold && !e.mv) { const a = Math.atan2(w.player.y - e.y, w.player.x - e.x); w.player.x = e.x + Math.cos(a) * dx; w.player.y = e.y + Math.sin(a) * dx; }
    const before = e.mv; w.step(idle(w)); if (e.mv && e.mv !== before) moves[e.mv.k] = (moves[e.mv.k] || 0) + 1;
    for (const v of w.events) (seen[v.t] ||= []).push(v); w.events.length = 0;
  }
  return { w, e, moves, seen };
};
{ const { moves } = fight(40, 15); ok(moves.punch && moves.stomp && !moves.throw && !moves.meteor && !moves.charge, `가까우면 때리기 · 발구르기 (${JSON.stringify(moves)})`); }
{ const { moves } = fight(110, 20); ok(moves.jump && moves.throw && !moves.punch && !moves.stomp && (moves.scatter || 0) <= (moves.throw || 0) + (moves.meteor || 0), `가운데면 점프 · 돌던지기 · 돌떨구기 · 돌뿌리기(돌뿌리기가 너무 잦지 않게) (${JSON.stringify(moves)})`); }
{ const { moves, seen } = fight(200, 25); ok(['throw', 'meteor', 'charge', 'jump'].filter((k) => moves[k]).length >= 3 && !moves.punch, `멀면 돌던지기 · 돌떨구기 · 돌진 · 점프 (${JSON.stringify(moves)})`); ok(seen.golemMeteorHit?.length >= 3, `돌이 떨어진다 (${seen.golemMeteorHit?.length})`); }
{ // 돌진: 맞으면 벽까지 밀려나고 벽에 부딪히면 기절
  let found = false;
  for (let seed = 1; seed <= 10 && !found; seed++) {
    const { w, e } = mk(0, seed); const p = w.player;
    for (let k = 0; k < 300 && !found; k++) { // 내 뒤 70~140에 벽이 있는 자리
      const a = w.rng.range(0, 6.28), back = w.rayLen(p.x, p.y, a, 200); if (back < 50 || back > 140) continue;
      const ex = p.x - Math.cos(a) * 170, ey = p.y - Math.sin(a) * 170; if (w.blocked(ex, ey, e.r) || w.bodyRay({ x: ex, y: ey, r: e.r }, a, 170) < 164) continue;
      e.x = ex; e.y = ey; e.gk.cd = { throw: 99, meteor: 99, charge: 0, jump: 99, scatter: 99, stomp: 99, repair: 99 }; e.mvCd = 0; e.speedMul = 0.0001; found = true;
      let stunned = false, x0 = p.x, y0 = p.y, maxPush = 0;
      for (let f = 0; f < 4 * 55; f++) { p.hp = w.d.maxHp; w.step(idle(w)); if (p.ccT > 0.5) stunned = true; maxPush = Math.max(maxPush, Math.hypot(p.x - x0, p.y - y0)); w.events.length = 0; }
      ok(stunned && maxPush > 40, `돌진에 벽까지 밀려 기절 (밀린 거리 ${Math.round(maxPush)} · 벽까지 ${Math.round(back)})`);
    }
  }
  if (!found) ok(false, '돌진 시험 자리를 못 찾음');
}
{ // 자가수복: 5% 맞으면 끊기고 빈틈 · 안 맞으면 회복
  const { w, e } = mk(200); e.hp = e.maxHp * 0.5; e.gk.cd = { throw: 99, meteor: 99, charge: 99, jump: 99, scatter: 99, stomp: 99, repair: 0 }; e.mvCd = 0; w.rng.chance = () => true; e.speedMul = 0.0001;
  for (let f = 0; f < 30 && e.mv?.k !== 'repair'; f++) { w.step(idle(w)); w.events.length = 0; }
  ok(e.mv?.k === 'repair', '체력이 줄고 멀면 자가수복');
  const h0 = e.hp; for (let f = 0; f < 2 * 55; f++) { w.player.hp = w.d.maxHp; w.step(idle(w)); w.events.length = 0; }
  ok(e.hp > h0, `수복하며 체력이 찬다 (+${(((e.hp - h0) / e.maxHp) * 100).toFixed(1)}%)`);
  w.damageEnemy(e, e.maxHp * 0.06, 'true', {}); w.step(idle(w));
  ok(e.mv?.k !== 'repair' && e.exposedT > 0, '5% 넘게 맞으면 끊기고 빈틈');
}
{ // 연계: 점프 → 돌뿌리기 (연계 확률을 1로)
  const { w, e } = mk(110); e.gk.cd = { throw: 99, meteor: 99, charge: 99, jump: 0, scatter: 99, stomp: 99, repair: 99 }; e.mvCd = 0; e.speedMul = 0.0001; w.rng.chance = () => true;
  const seq = []; for (let f = 0; f < 4 * 55; f++) { w.player.hp = w.d.maxHp; const b = e.mv; w.step(idle(w)); if (e.mv && e.mv !== b) seq.push(e.mv.k + (e.mv.mul > 1 ? '+' : '')); w.events.length = 0; }
  ok(seq[0] === 'jump' && seq[1] === 'scatter+', `점프 → 돌뿌리기 연계 (${seq.join(' → ')})`);
}
{ // 물리 피해에도 체력이 숫자로 남는다 (데이터 줄의 저항값이 주석에 먹혀 NaN이 됐던 일)
  const { w, e } = mk(30); w.damageEnemy(e, 10, 'phys', {}); w.damageEnemy(e, 10, 'mag', {});
  ok(Number.isFinite(e.hp) && e.def.pres > 0 && e.def.mres > 0 && e.def.xp > 0, `물리 · 마법 피해 뒤 체력 ${Math.round(e.hp)} (저항 ${e.def.pres} · ${e.def.mres})`);
}
if (fails) { console.log(`${fails} FAIL`); process.exit(1); } else console.log('ALL OK');

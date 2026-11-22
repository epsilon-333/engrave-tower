// 슬라임 왕 (sim/slime.js): 거리마다 고르는 기술 · 슬라임공이 터져 방울 · 맞으면 작은 슬라임 · 첫 죽음에 둘로 · 점액 길
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const c = CLASSES.guardian;
const idle = (w) => ({ moveX: 0, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y, attack: false });
const mk = (dx, hp = 1e9) => {
  const b = computeBuild({ race: c.race, cls: 'guardian', level: 30, alloc: { vit: 30 }, engravings: {}, gear: { weapon: c.weapons[0], off: c.off } });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 7 });
  for (const o of w.enemies) o.dead = true; w.enemies = [];
  const e = w.makeEnemy('climbQueen', w.player.x + dx, w.player.y, { noAffix: true }); e.state = 'chase'; e.hp = e.maxHp = hp; e.speedMul = 0.0001; w.enemies.push(e);
  w.step(idle(w)); return { w, e };
};
const fight = (dx, secs) => {
  const { w, e } = mk(dx), moves = {}, seen = {};
  for (let f = 0; f < secs * 60; f++) {
    w.player.hp = w.d.maxHp; w.player.ccT = 0;
    if (!e.mv) { const a = Math.atan2(w.player.y - e.y, w.player.x - e.x); w.player.x = e.x + Math.cos(a) * dx; w.player.y = e.y + Math.sin(a) * dx; }
    const before = e.mv; w.step(idle(w)); if (e.mv && e.mv !== before) moves[e.mv.k] = (moves[e.mv.k] || 0) + 1;
    for (const v of w.events) (seen[v.t] ||= []).push(v); w.events.length = 0;
  }
  return { w, e, moves, seen };
};
{ const { moves } = fight(35, 12); ok(moves.slam >= 2 && !moves.ball, `가까우면 내려치기 (${JSON.stringify(moves)})`); }
{ const { moves, seen } = fight(150, 20); ok(moves.ball >= 1 && moves.sink >= 1 && (moves.big || moves.rain) && !moves.slam, `멀면 슬라임공 · 순간이동 (${JSON.stringify(moves)})`);
  ok(seen.slimePop?.length >= 2, `슬라임공이 터진다 (${seen.slimePop?.length})`); ok(seen.slimeRise?.length >= 1, '순간이동: 내 곁에서 솟는다'); }
{ // 맞아도 슬라임이 안 나온다 · 거대 슬라임공이 터지면 셋
  const { w, e } = mk(100); e.sk.cd = { ball: 99, sink: 99, big: 99, rain: 99 }; e.mvCd = 99;
  for (let i = 0; i < 10; i++) w.damageEnemy(e, 5, 'phys', {});
  ok(!w.enemies.some((o) => !o.dead && o.slimeOf), '맞아도 슬라임이 생기지 않는다');
  const seen = []; w.slimeStart(e, w.player, 'big'); for (let f = 0; f < 4 * 60; f++) { w.player.hp = w.d.maxHp; e.mvCd = 99; w.step(idle(w)); seen.push(...w.events.map((v) => v.t)); w.events.length = 0; }
  const n = w.enemies.filter((o) => !o.dead && o.slimeOf === e.id).length; ok(n === 3 && seen.includes('slimePop'), `거대 슬라임공: 터지고 슬라임 셋 (${n})`);
}
{ // 하늘에서 슬라임공
  const { w, e } = mk(100); e.sk.cd = { ball: 99, sink: 99, big: 99, rain: 99 }; e.mvCd = 99; const p = w.player; let lands = 0, hurt = 0;
  w.slimeStart(e, p, 'rain'); for (let f = 0; f < 3 * 60; f++) { const hp = p.hp; e.mvCd = 99; w.step(idle(w)); if (hp - p.hp > 3) hurt++; lands += w.events.filter((v) => v.t === 'slimeLand').length; w.events.length = 0; }
  ok(lands === 6 && hurt >= 1, `하늘에서 여섯 개 · 첫 공은 내 자리 (떨어짐 ${lands} · 맞음 ${hurt})`);
}
{ // 첫 죽음: 둘로 · 각자 1/3
  const { w, e } = mk(120, 900); e.climb = true;
  w.damageEnemy(e, 5000, 'true', {}); w.step(idle(w));
  const halves = w.enemies.filter((o) => !o.dead && o.isHalf);
  ok(e.dead && halves.length === 2 && halves.every((h) => Math.abs(h.maxHp - 300) < 1 && h.climb), `둘로 갈라진다 (${halves.map((h) => Math.round(h.maxHp)).join(', ')})`);
  for (const h of halves) { h.invulnT = 0; w.damageEnemy(h, 5000, 'true', {}); }
  ok(halves.every((h) => h.dead) && !w.enemies.some((o) => !o.dead && o.isHalf), '갈라진 몸은 다시 갈라지지 않는다');
}
{ // 점액 길: 밟으면 느려진다
  const { w, e } = mk(120); e.speedMul = 1; e.sk.cd = { ball: 99, sink: 99 };
  for (let f = 0; f < 90; f++) { w.player.hp = w.d.maxHp; e.mvCd = 99; w.step(idle(w)); w.events.length = 0; }
  ok(w.slimeTrail?.length > 3, `지나간 길에 점액 (${w.slimeTrail?.length})`);
  const o = w.slimeTrail[0]; w.player.x = o.x; w.player.y = o.y; e.x += 400; w.step(idle(w)); ok(w.player.oozeT > 0, '점액 위: 느려진다');
  for (let f = 0; f < 200; f++) w.step(idle(w)); ok(!w.slimeTrail.some((q) => q === o), '3초 뒤 사라진다');
}
if (fails) { console.log(`${fails} FAIL`); process.exit(1); } else console.log('ALL OK');

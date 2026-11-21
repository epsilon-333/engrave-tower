// 가면 족장 (sim/chief.js): 가까우면 휘두르기 · 포효, 멀면 세 번 뛰기 · 돌진 · 저주, 고블린 다섯 → 5초 뒤 남은 수만큼 제물 폭발, 평타는 보라 불덩이
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const c = CLASSES.guardian;
const mk = (dx, seed = 7) => {
  const b = computeBuild({ race: c.race, cls: 'guardian', level: 30, alloc: { vit: 30 }, engravings: {}, gear: { weapon: c.weapons[0], off: c.off } });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed });
  for (const o of w.enemies) o.dead = true; w.enemies = [];
  const e = w.makeEnemy('climbChief', w.player.x + dx, w.player.y, { noAffix: true }); e.state = 'chase'; e.hp = e.maxHp = 1e9; w.enemies.push(e);
  return { w, e };
};
// 플레이어를 족장에게서 일정 거리에 붙잡아 두고 사건을 모은다
const fight = (dx, secs, hold = true) => {
  const { w, e } = mk(dx), seen = {}, moves = {};
  if (hold) e.speedMul = 0.05; // 걸어서 다가오지 않게 (거리를 지킨 채로 고르는 기술을 본다)
  for (let f = 0; f < secs * 55; f++) {
    w.player.hp = w.d.maxHp;
    if (hold && !e.mv) { const a = Math.atan2(w.player.y - e.y, w.player.x - e.x); w.player.x = e.x + Math.cos(a) * Math.abs(dx); w.player.y = e.y + Math.sin(a) * Math.abs(dx); }
    w.step({ moveX: 0, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y, attack: false });
    if (e.mv) moves[e.mv.k] = (moves[e.mv.k] || 0) + 1;
    for (const v of w.events) (seen[v.t] ||= []).push(v);
    w.events.length = 0;
  }
  return { w, e, seen, moves };
};
{ const { seen, moves } = fight(40, 12); ok(moves.swing && moves.roar, `가까우면 휘두르기 · 포효 (${Object.keys(moves)})`); ok(!moves.jumps3 && !moves.charge && !moves.curse, '가까우면 뛰기 · 돌진 · 저주를 안 쓴다'); ok(seen.chiefRoar?.length, '포효 이펙트'); }
{ const { seen, moves } = fight(180, 25); ok(['jumps3', 'charge', 'curse'].filter((k) => moves[k]).length >= 2, `멀면 뛰기 · 돌진 · 저주 (${Object.keys(moves)})`); ok(!moves.swing && !moves.roar, '멀면 휘두르기 · 포효를 안 쓴다'); ok((seen.voidCast?.length || 0) > 5, `평타는 보라 불덩이 (${seen.voidCast?.length})`); }
{ // 소환 → 5초 뒤 제물: 고블린이 다 남아 있으면 제물 5 · 고블린은 죽는다
  const { w, e, seen } = fight(180, 22, false);
  ok(seen.chiefRise?.length === 5, `고블린 다섯 소환 (${seen.chiefRise?.length})`);
  ok(seen.chiefSacBlast?.[0]?.n === 5, `남은 다섯이 제물 (${seen.chiefSacBlast?.[0]?.n})`);
  ok(seen.chiefSacBurn?.length === 5, '제물이 된 고블린은 죽는다');
}
{ // 고블린을 다 잡으면 제물이 없어 족장이 빈틈을 보인다
  const { w, e } = mk(180); let exposed = false;
  for (let f = 0; f < 20 * 55; f++) {
    w.player.hp = w.d.maxHp; for (const o of w.enemies) if (o.sacOf === e.id && !o.dead) { o.dead = true; o.hp = 0; }
    w.step({ moveX: 0, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y, attack: false }); if (e.exposedT > 0) exposed = true; w.events.length = 0;
  }
  ok(exposed, '제물이 없으면 빈틈');
}

{ // 벽 너머에 있으면 돌아오거나(길찾기) 뛰어넘어서 온다
  let tried = 0, came = 0;
  for (let seed = 1; seed <= 6 && tried < 4; seed++) {
    const { w, e } = mk(0, seed); const p = w.player;
    let spot = null;
    for (let k = 0; k < 400 && !spot; k++) { const a = w.rng.range(0, 6.28), d = w.rng.range(90, 170), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d; if (!w.blocked(x, y, e.r) && !w.clearLine(x, y, p.x, p.y)) spot = { x, y }; }
    if (!spot) continue; tried++;
    e.x = spot.x; e.y = spot.y; w.step({ moveX: 0, moveY: 0, aimX: p.x, aimY: p.y, attack: false });
    e.ck.cd = { roar: 99, jumps: 99, charge: 99, curse: 99 }; e.ck.sumT = 99; let best = 1e9;
    for (let f = 0; f < 10 * 55; f++) { p.hp = w.d.maxHp; w.step({ moveX: 0, moveY: 0, aimX: p.x, aimY: p.y, attack: false }); best = Math.min(best, Math.hypot(p.x - e.x, p.y - e.y)); w.events.length = 0; }
    if (best < 60) came++; else console.log('     못 옴', seed, Math.round(best));
  }
  ok(tried && came === tried, `벽 너머에서 다가온다 (${came}/${tried})`);
}
{ // 돌진은 나까지 몸이 벽에 안 닿을 때만
  let bad = 0, n = 0;
  for (let seed = 1; seed <= 4; seed++) { const { w, e } = mk(180, seed); e.speedMul = 0.3;
    for (let f = 0; f < 25 * 55; f++) { w.player.hp = w.d.maxHp; const before = e.mv; w.step({ moveX: 0, moveY: 0, aimX: w.player.x, aimY: w.player.y, attack: false }); if (!before && e.mv?.k === 'charge') { n++; if (e.mv.dist < 60) bad++; } w.events.length = 0; } }
  ok(n > 0 && !bad, `바로 앞이 벽인데 돌진하지 않는다 (돌진 ${n} · 짧은 돌진 ${bad})`);
}
{ // 제물: 멀리 있으면 뛰어와서 터뜨린다
  const { w, e } = mk(200); e.ck = null; w.step({ moveX: 0, moveY: 0, aimX: w.player.x, aimY: w.player.y, attack: false });
  e.ck.cd = { roar: 99, jumps: 99, charge: 99, curse: 99 }; e.ck.sumT = 0; e.speedMul = 0.0001; let hop = false, at = null;
  for (let f = 0; f < 14 * 55; f++) { w.player.hp = w.d.maxHp; w.step({ moveX: 0, moveY: 0, aimX: w.player.x, aimY: w.player.y, attack: false }); if (e.mv?.k === 'hop' && e.mv.then === 'sac') hop = true; for (const v of w.events) if (v.t === 'chiefSacBlast') at = Math.hypot(w.player.x - v.x, w.player.y - v.y); w.events.length = 0; }
  ok(hop && at != null && at < 60, `멀면 뛰어와서 제물 폭발 (뛰기 ${hop} · 폭발과 나의 거리 ${at && Math.round(at)})`);
}
if (fails) { console.log(`${fails} FAIL`); process.exit(1); } else console.log('ALL OK');

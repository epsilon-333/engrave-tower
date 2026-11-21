// 늪 마녀 수장 (sim/witch.js): 거리마다 고르는 기술 · 속박 경직 + 지속 피해 · 늪 바꾸기 · 맹독 구슬이 터진다 · 늪의 파동
const root = new URL('../../public/js', import.meta.url).href;
const { World, T_LIQUID } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const c = CLASSES.guardian;
const idle = (w) => ({ moveX: 0, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y, attack: false });
const ALL = (v) => ({ bind: v, swamp: v, roots: v, orbs: v, wave: v });
const mk = (dx, seed = 7) => {
  const b = computeBuild({ race: c.race, cls: 'guardian', level: 30, alloc: { vit: 30 }, engravings: {}, gear: { weapon: c.weapons[0], off: c.off } });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed });
  for (const o of w.enemies) o.dead = true; w.enemies = [];
  const e = w.makeEnemy('bogHag', w.player.x + dx, w.player.y, { noAffix: true }); e.state = 'chase'; e.hp = e.maxHp = 1e9; e.speedMul = 0.0001; w.enemies.push(e);
  w.step(idle(w)); return { w, e };
};
const run = (w, e, secs, fn) => { for (let f = 0; f < secs * 60; f++) { const b = e.mv; w.step(idle(w)); if (fn) fn(b); w.events.length = 0; } };
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
{ const { moves } = fight(35, 15); ok(moves.melee && moves.wave && !moves.orbs && !moves.orbFan && !moves.swamp, `가까우면 휘두르기 · 늪의 파동 (${JSON.stringify(moves)})`); }
{ const { moves, seen } = fight(200, 20); ok((moves.orbs || 0) + (moves.orbFan || 0) >= 2 && moves.roots && !moves.melee && !moves.wave, `멀면 맹독 구슬 · 뿌리 (${JSON.stringify(moves)})`);
  ok(seen.witchOrbPop?.length >= 3, `맹독 구슬이 터진다 (${seen.witchOrbPop?.length})`); ok(seen.witchRootSlam?.length >= 3, `줄기가 내려친다 (${seen.witchRootSlam?.length})`); }
{ // 맹독 구슬이 나에 닿으면 한 번만 맞는다 (닿을 때 + 터질 때 두 번이 아니라)
  const { w, e } = mk(80); e.wk.cd = ALL(99); e.wk.cd.orbs = 0; e.mvCd = 0; w.rng.int = () => 0; // 'orbs'를 고르게
  const p = w.player; let hits = 0; const h0 = p.hp; p.hp = 1e6; const before = p.hp;
  run(w, e, 0.05); e.mv = null; e.windT = 0; w.witchStart(e, p, 'orbFan');
  let n = 0; for (let f = 0; f < 4 * 60; f++) { const hp = p.hp; w.step(idle(w)); if (hp - p.hp > 3) n++; w.events.length = 0; } // 독 틱은 작다 · 한 대만 센다
  ok(n >= 1 && n <= 3 && p.st.poison, `부채꼴 구슬: 맞은 횟수 ${n} · 중독`);
}
{ // 속박: 경직 + 묶인 동안 조금씩
  const { w, e } = mk(100); e.wk.cd = ALL(99); e.mvCd = 0; const p = w.player;
  w.witchStart(e, p, 'bind'); let stiff = 0, ticks = 0;
  for (let f = 0; f < 2.5 * 60; f++) { const hp = p.hp; w.step(idle(w)); if (p.ccT > 0.5) stiff++; if (p.hp < hp) ticks++; w.events.length = 0; }
  ok(stiff > 0 && ticks >= 4, `속박: 경직 · 피해 ${ticks}번`);
}
{ // 늪 바꾸기: 둘레 물이 늪이 되고 · 들어가면 느려지고 중독 · 12초 뒤 물로
  const { w, e } = mk(110); e.wk.cd = ALL(99); const p = w.player;
  const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16); for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++) w.tiles[y * w.tw + x] = T_LIQUID;
  w.witchStart(e, p, 'swamp'); run(w, e, 1.8);
  ok(w.bog?.size >= 6, `물이 늪으로 (${w.bog?.size}칸)`);
  ok(p.bogT > 0 && !!p.st.poison, '늪 위: 느려지고 중독');
  run(w, e, 13); ok(!w.bog.size, '12초 뒤 다시 물');
}
{ // 늪의 파동: 밀려나고 중독
  const { w, e } = mk(70); e.wk.cd = ALL(99); const p = w.player, x0 = p.x;
  w.witchStart(e, p, 'wave'); let pushed = 0; for (let f = 0; f < 2 * 60; f++) { w.step(idle(w)); pushed = Math.max(pushed, Math.abs(p.x - x0)); w.events.length = 0; }
  ok(pushed > 15 && !!p.st.poison, `늪의 파동: 밀려남 ${Math.round(pushed)} · 중독`);
}
{ const { w, e } = mk(30); w.damageEnemy(e, 10, 'phys', {}); ok(Number.isFinite(e.hp) && e.def.mres > 0, '피해 뒤 체력이 숫자'); }
if (fails) { console.log(`${fails} FAIL`); process.exit(1); } else console.log('ALL OK');

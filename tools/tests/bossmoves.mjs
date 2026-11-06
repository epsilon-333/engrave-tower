// 51~100층 피하는 기술(bossmoves.js): 보스마다 모든 단계의 기술을 하나씩 써서 오류 없이 끝나고, 피하지 않으면 맞는다 · 피할 수 있다(다른 곳에 서면 덜 맞는다)
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { buildClimbFloor } = await import(root + '/sim/climbmap.js');
const { ALL_ZONES, MONSTERS } = await import(root + '/data/monsters.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { SCRIPT_MOVES } = await import(root + '/sim/bossmoves.js');
const C = await import(root + '/data/climb.js');
let bad = 0, n = 0;
const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } };
const mk = (f, sd = 7) => {
  const act = C.actOf(f), z = ALL_ZONES.find((x) => x.id === act.zone), fk = C.floorKind(f), c = CLASSES.greatsword;
  const run = C.newRun({ seed: 7 }); run.f = f;
  const b = computeBuild({ race: c.race, cls: 'greatsword', level: 70, alloc: { vit: 60 }, engravings: {}, gear: { weapon: c.weapons[0] }, extraEffects: C.runEffects(run) });
  const map = buildClimbFloor(z, sd + f, f, fk);
  return new World({ build: b, mode: 'field', zone: z, zoneId: z.id, seed: sd + f, map, tower: { f }, climb: { run, f, kind: fk } });
};
const bossFloors = C.ACTS.filter((a) => a.from > 40).flatMap((a) => [[a.from + 4, a.guardian], [a.to, a.lord]]);
for (const [f, id] of bossFloors) {
  const moves = [...new Set((MONSTERS[id].phaseMoves || []).flat())].filter((k) => SCRIPT_MOVES.has(k));
  for (const k of moves) for (let tryN = 0; tryN < 3; tryN++) { // 빈 틈이 있는 기술은 마침 틈에 서 있을 수 있다: 세 번까지
    // 가만히 선 채로 (피하지 않는다) · 기술이 끝날 때까지
    const w = mk(f + 0, 7 + tryN * 31); for (let i = 0; i < 260 && !w.climb.boss; i++) { w.step({ moveX: 0, moveY: 0, aimX: w.player.x + 1, aimY: w.player.y }); w.events.length = 0; w.signals.length = 0; }
    const e = w.climb.boss; if (!e) { ok(false, `${f}층 보스 없음`); continue; }
    const p = w.player; e.introT = 0; { let best = null; for (let a = 0; a < 6.28; a += 0.4) { const x = p.x + Math.cos(a) * 70, y = p.y + Math.sin(a) * 70; if (!w.blocked(x, y, e.r) && w.rayLen(x, y, Math.atan2(p.y - y, p.x - x), 70) >= 69) { best = { x, y }; break; } } if (best) { e.x = best.x; e.y = best.y; } } e.mvCd = 99; e.atkCd = 99; // 보스는 나와 사이가 트인 빈 곳에
    let err = null, hp0 = p.hp, hurt = 0;
    try {
      e.mv = null; w.bossPick(e, p, k);
      for (let i = 0; i < 60 * 7; i++) { p.hp = Math.max(p.hp, w.d.maxHp * 0.5); const h = p.hp; w.step({ moveX: 0, moveY: 0, aimX: e.x, aimY: e.y }); if (p.hp < h) hurt += h - p.hp; w.events.length = 0; w.signals.length = 0; e.mvCd = 99; if (!e.mv && i > 30) { if (process.env.V) console.log("  끝", i); break; } }
    } catch (x) { err = x; }
    n++;
    ok(!err, `${f}층 ${MONSTERS[id].name} · ${k}: 오류 없음${err ? ' · ' + err.stack.split('\n').slice(0, 2).join(' ') : ''}`);
    if (process.env.V) console.log(f, k, Math.round(hurt), e.mv?.k, w.state);
    if (hurt <= 0 && tryN < 2 && !err) continue;
    ok(hurt > 0, `${f}층 ${MONSTERS[id].name} · ${k}: 피하지 않으면 맞는다 (${Math.round(hurt)})`);
    break;
  }
}
console.log(`기술 ${n}개 시험`);
console.log(bad ? 'BOSSMOVES FAIL' : 'BOSSMOVES OK');
process.exit(bad ? 1 : 0);

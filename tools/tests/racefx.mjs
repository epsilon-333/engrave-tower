// 종족 특성 (2026-11-10 개편) · 각인 「바위의 인내」 · 「바람 읽기」가 실제로 먹히는지
// node tools/tests/racefx.mjs
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const { RACE_FX: R } = await import(root + '/data/races.js');
const ok = (cond, text) => { console.log(cond ? 'OK ' : 'FAIL', text); if (!cond) process.exitCode = 1; };
const clsOf = (race) => Object.keys(CLASSES).find((k) => CLASSES[k].race === race);
const mk = (race, engravings = {}) => {
  const cls = clsOf(race), c = CLASSES[cls];
  const b = computeBuild({ race, cls, level: 20, allSkills: true, alloc: {}, engravings, gear: { weapon: c.weapons[0], off: c.off }, skills: c.skills.slice(0, 4) });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 7 });
  w.enemies.forEach((e) => { e.x = -999; e.y = -999; });
  return w;
};
const near = (a, b, t = 0.01) => Math.abs(a - b) < t;

// 체력: 마법사 -20% · 기사 +40% (종족 보정 없이 계산한 값과 비교)
for (const [race, mul] of [['wizard', R.wizardHp], ['knight', R.knightHp]]) {
  const cls = clsOf(race), c = CLASSES[cls], lo = { race, cls, level: 20, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0], off: c.off } };
  const hp = computeBuild(lo).derived.maxHp, save = R[race + 'Hp']; R[race + 'Hp'] = 1;
  const hp0 = computeBuild(lo).derived.maxHp; R[race + 'Hp'] = save;
  ok(near(hp / hp0, mul, 0.01), `${race} 최대 체력 ${hp0} → ${hp} (×${mul})`);
}

// 주는 피해 배율
{
  const wz = mk('wizard'); ok(wz.raceDmgMul('mag', {}) === R.wizardMag && wz.raceDmgMul('phys', {}) === 1, '마법사: 마법 피해 ×1.5 · 물리는 그대로');
  const dr = mk('dragon'); ok(dr.raceDmgMul('mag', { elem: 'fire' }) === R.dragonFire && dr.raceDmgMul('mag', { elem: 'ice' }) === 1, '용족: 화염 피해 ×1.3 · 다른 속성은 그대로');
  const el = mk('elf');
  const m0 = el.raceDmgMul('phys', { proj: true, dist: 0 }), m1 = el.raceDmgMul('phys', { proj: true, dist: 130 }), m2 = el.raceDmgMul('phys', { proj: true, dist: 400 });
  ok(near(m0, 1) && near(m1, 1.5) && near(m2, 2), `엘프: 거리 0 ×${m0} · 130 ×${m1} · 400 ×${m2}`);
  el.projHitDist = 260; ok(near(el.raceDmgMul('mag', {}), 2), '엘프: 스킬 투사체도 거리 보너스'); el.projHitDist = null;
  ok(el.raceDmgMul('phys', {}) === 1, '엘프: 근접은 그대로');
  const oc = mk('orc'), p = oc.player;
  p.hp = oc.d.maxHp; const o1 = oc.raceDmgMul('phys', {});
  p.hp = oc.d.maxHp * 0.55; const o2 = oc.raceDmgMul('phys', {});
  p.hp = oc.d.maxHp * 0.05; const o3 = oc.raceDmgMul('phys', {});
  ok(near(o1, 1) && near(o2, 1.5) && near(o3, 2), `오크: 체력 100% ×${o1.toFixed(2)} · 55% ×${o2.toFixed(2)} · 5% ×${o3.toFixed(2)}`);
  p.hp = oc.d.maxHp; p.invuln = 0; oc.hurtPlayer(10, 'phys', null, { direct: true });
  ok(p.buffs.orcRage && near(oc.mod('dmgMul'), R.orcHurtMul) && near(p.buffs.orcRage.t, R.orcHurtT), '오크: 맞으면 2초 동안 분노 (피해 +10%)');
}

// 받는 피해: 기사 물리 -15%
{
  const kn = mk('knight'), p = kn.player;
  p.hp = kn.d.maxHp; kn.hurtPlayer(100, 'phys', null, { direct: true }); const lp = kn.d.maxHp - p.hp;
  p.hp = kn.d.maxHp; p.invuln = 0; kn.hurtPlayer(100, 'mag', null, { direct: true }); const lm = kn.d.maxHp - p.hp;
  ok(near(lp / lm, (1 - kn.d.physDR) * R.knightPhys / (1 - kn.d.magDR), 0.01), `기사: 물리 100 → ${lp.toFixed(1)} · 마법 100 → ${lm.toFixed(1)}`);
}

// 회피: 암살자 +10% (모든 공격) · 언데드 물리 +20%
{
  const as = mk('assassin'), base = computeBuild({ race: 'assassin', cls: clsOf('assassin'), level: 20, alloc: {}, engravings: {}, gear: { weapon: CLASSES[clsOf("assassin")].weapons[0] } });
  ok(near(as.d.dodge, base.derived.dodge), `암살자 회피 ${(as.d.dodge * 100).toFixed(1)}% (민첩 몫 + 10%)`);
  const dodged = (w, type, n = 4000) => { const p = w.player; let k = 0; for (let i = 0; i < n; i++) { p.hp = w.d.maxHp; p.invuln = 0; w.hurtPlayer(1, type, null, {}); if (p.hp === w.d.maxHp) k++; } return k / n; };
  const ud = mk('undead'), dp = dodged(ud, 'phys'), dm = dodged(ud, 'mag');
  ok(dp - dm > 0.16 && dp - dm < 0.24, `언데드: 물리 회피 ${(dp * 100).toFixed(1)}% · 마법 회피 ${(dm * 100).toFixed(1)}%`);
}

// 면역: 언데드 독 · 저주 · 출혈 · 용족 화상 · 냉기
{
  for (const [race, list, not] of [['undead', ['poison', 'curse', 'bleed'], 'burn'], ['dragon', ['burn', 'chill'], 'poison']]) {
    const w = mk(race), p = w.player;
    for (const k of [...list, not]) w.applyPlayerStatus(k, 10);
    ok(list.every((k) => !p.st[k]) && p.st[not], `${race}: ${list.join(' · ')} 면역 · ${not}는 걸린다`);
  }
}

// 공룡 수인: 처치마다 최대 체력 2%
{
  const w = mk('dino'), p = w.player, e = w.enemies[0];
  p.hp = w.d.maxHp * 0.5; p.healBank = w.d.maxHp; e.x = p.x + 20; e.y = p.y; e.hp = 1;
  const before = p.hp; w.damageEnemy(e, 999, 'true', { src: 'attack' });
  ok(e.dead && near(p.hp - before, w.d.maxHp * R.dinoKillHeal, 0.6), `공룡 수인: 처치 회복 ${(p.hp - before).toFixed(1)} (최대 체력 ${w.d.maxHp}의 2%)`);
}

// 암살자: 대시가 순간이동 (그 자리에서 바로 옮겨 가고, 벽은 넘지 않는다)
{
  const w = mk('assassin'), p = w.player, x0 = p.x, y0 = p.y;
  p.dashCharges = 2; p.dashCd = 0;
  const free = !w.blocked(x0 + 64, y0, 5);
  w.step({ moveX: 1, moveY: 0, dash: true, aimX: 1, aimY: 0 });
  ok(p.dashT <= 0 && p.x > x0 + 40 && near(p.y, y0, 2), `암살자 대시: 한 번에 ${(p.x - x0).toFixed(0)}px (${free ? '앞이 트임' : '앞이 막힘'})`);
  // 벽 앞에서: 막힌 칸 바로 앞에서 멈춘다
  w.solid = (x) => x > x0 + 20; p.x = x0; p.y = y0; p.dashCharges = 2; p.dashCd = 0; p.dashRecharge = 0;
  w.blinkDash(1, 0);
  ok(p.x <= x0 + 20 && p.x > x0, `벽 앞에서 멈춤: ${(p.x - x0).toFixed(0)}px`);
}

// 각인 「바위의 인내」: 1초 동안 가만히 있으면 받는 피해 -50%
{
  const a = mk('knight'), b = mk('knight', { leg: 'stillStone' });
  ok(b.f.has('stillGuard'), '바위의 인내를 끼웠다');
  for (const w of [a, b]) { for (let i = 0; i < 70; i++) w.step({ moveX: 0, moveY: 0 }); w.player.hp = w.d.maxHp; w.player.invuln = 0; w.hurtPlayer(100, 'mag', null, { direct: true }); } // 마법 피해로 잰다 (각인의 물리 저항이 섞이지 않게)
  const la = a.d.maxHp - a.player.hp, lb = b.d.maxHp - b.player.hp;
  ok(near(lb, la * 0.5, 0.5), `가만히 1초 뒤 받는 피해 ${la.toFixed(1)} → ${lb.toFixed(1)}`);
  b.step({ moveX: 1, moveY: 0 }); b.player.hp = b.d.maxHp; b.player.invuln = 0; b.hurtPlayer(100, 'mag', null, { direct: true });
  ok(near(b.d.maxHp - b.player.hp, la, 0.5), '움직이면 풀린다');
}

// 각인 「바람 읽기」: 투사체가 앞쪽의 적에게 살짝 휜다
{
  const shoot = (eng) => {
    const w = mk('elf', eng), p = w.player, e = w.enemies[0];
    e.x = p.x + 120; e.y = p.y + 22; e.hp = e.maxHp = 1e6; e.state = 'idle';
    w.projs.push({ owner: 'p', x: p.x, y: p.y, vx: 300, vy: 0, life: 1, maxLife: 1, dmg: 1, type: 'phys', pierce: 0, hit: new Set(), kind: 'arrow', fast: 1 });
    const pr = w.projs[w.projs.length - 1];
    for (let i = 0; i < 40 && pr.life > 0; i++) w.updateProjs();
    return pr;
  };
  const a = shoot({}), b = shoot({ head: 'windRead' });
  ok(Math.abs(a.vy) < 1e-6 && b.vy > 5, `바람 읽기: 휘지 않음 vy ${a.vy.toFixed(1)} → 휨 vy ${b.vy.toFixed(1)}`);
}
console.log(process.exitCode ? 'FAILED' : 'ALL OK');

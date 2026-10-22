// 종족 스킬 밸런스 측정: 클래스마다 스킬 하나씩, 단단한 적 3마리 앞에서 써서 6초 동안 넣은 피해 ÷ 재사용 대기(최소 3초)
// node tools/balance.mjs → 표 · node tools/balance.mjs --json → 계산한 보정값
const root = new URL('../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES, SKILLS } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const rows = [];
for (const [cls, c] of Object.entries(CLASSES)) {
  for (const id of c.skills) {
    const sk = SKILLS[id]; if (!sk) continue;
    const b = computeBuild({ race: c.race, cls, level: 20, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] }, skills: [id] });
    const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 11 }), p = w.player;
    const foes = w.enemies.filter((e) => !e.def.elite).slice(0, 3);
    for (const o of w.enemies) if (!foes.includes(o)) { o.dead = true; }
    w.enemies = foes;
    foes.forEach((e, i) => { e.x = p.x + 40 + i * 10; e.y = p.y - 10 + i * 10; e.hp = e.maxHp = 1e6; e.atk = 0; e.speedMul = 0; e.state = 'chase'; e.def = { ...e.def, ai: 'target' }; });
    p.res = 100; p.hp = 1e9;
    try {
      if (sk.needSpirit) w.castSkillId('summonSpirit', null);
      w.castSkillId(id, 0);
      for (let f = 0; f < 360; f++) { const t = foes[0]; w.step({ moveX: 0, moveY: 0, aimX: t.x, aimY: t.y, attack: false, autoAim: true, s1: f === 1 && !!sk.charge, h1: !!sk.charge && f < 50 }); w.events.length = 0; w.signals.length = 0; p.hp = 1e9; }
    } catch (err) { rows.push({ cls, race: c.race, id, name: sk.name, err: err.message }); continue; }
    const dmg = foes.reduce((a, e) => a + (1e6 - e.hp), 0);
    rows.push({ cls, race: c.race, id, name: sk.name, role: sk.role, ult: !!sk.ult, cd: sk.cd, dmg: Math.round(dmg), v: Math.round(dmg / Math.max(3, sk.cd)) });
  }
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 1; };
const DMG_ROLES = new Set(['공격', '연타', '범위', '마무리', '장판', '소환', '궁극', '돌진', '베기']);
const norm = rows.filter((r) => !r.err && !r.ult && r.dmg > 0), ult = rows.filter((r) => !r.err && r.ult && r.dmg > 0);
const M = med(norm.map((r) => r.v)), MU = med(ult.map((r) => r.v));
for (const r of rows) {
  if (r.err || !(r.dmg > 0)) { r.f = 1; continue; }
  const m = r.ult ? MU : M, ratio = r.v / m, dmgRole = DMG_ROLES.has(r.role) || r.ult;
  r.f = ratio > 1.6 ? Math.max(0.6, (1.6 / ratio) ** 0.7) : ratio < 1 / 1.6 && dmgRole ? Math.min(1.5, ((1 / 1.6) / ratio) ** 0.7) : 1;
  r.f = Math.round(r.f * 100) / 100;
}
if (process.argv.includes('--json')) console.log(JSON.stringify(Object.fromEntries(rows.filter((r) => r.f !== 1).map((r) => [r.id, r.f]))));
else {
  console.log(`기준(중간값) 일반 ${M} · 궁극 ${MU}`);
  for (const r of rows) console.log(r.err ? `ERR ${r.cls} ${r.name} ${r.err}` : `${r.race.padEnd(8)} ${r.cls.padEnd(13)} ${r.name.padEnd(10)} ${String(r.role).padEnd(4)} cd${String(r.cd).padStart(3)} 피해 ${String(r.dmg).padStart(7)} 초당 ${String(r.v).padStart(6)}${r.f !== 1 ? `  → ×${r.f}` : ''}`);
}

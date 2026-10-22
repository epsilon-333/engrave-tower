// 클래스 밸런스 측정: 한 번의 피해가 아니라 실제 싸움으로 잰다.
// 클래스마다 30초 동안 무기 거리에 맞춰 다가가고 · 물러나며 평타와 스킬(재사용 · 자원 · 시전 시간 그대로)을 쓴다.
// 상황 두 가지: 다가오는 무리 6마리 · 단단한 적 하나. 점수 = 두 상황의 초당 피해의 기하평균, 받은 피해도 함께 본다.
// node tools/balance.mjs → 표 · --json → 클래스 보정값(CLASS_BAL)
const root = new URL('../public/js', import.meta.url).href;
const { World, DT } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES, SKILLS } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const SKIP = new Set(['golem']);
const SECS = 30;

function fight(cls, scen, seed, bal) {
  const c = CLASSES[cls];
  const b = computeBuild({ race: c.race, cls, level: 20, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] }, spirit: { id: 'fire2', star: 1 }, skills: c.skills.slice(0, 4).concat(c.skills.filter((id) => SKILLS[id]?.ult)).slice(0, 4) });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[1].id, seed }), p = w.player;
  w.balMul = bal; // 측정 중 보정
  if (b.cls === 'necromancer') for (let i = 0; i < 10; i++) p.souls.push({ defId: 'goblin', maxHp: 300, atk: 14, r: 6, scale: 1 }); // 사령술사: 돌아다니며 모아 둔 영혼
  const pool = w.enemies.filter((e) => !e.def.elite && !e.champion), boss = w.enemies.find((e) => e.def.elite) || pool[0];
  const foes = scen === 'boss' ? [boss] : pool.slice(0, 6);
  for (const e of w.enemies) if (!foes.includes(e)) e.dead = true;
  w.enemies = foes; w.camps = [];
  foes.forEach((e, i) => {
    const a = (i / foes.length) * Math.PI * 2;
    e.x = p.x + Math.cos(a) * 110; e.y = p.y + Math.sin(a) * 90;
    if (w.blocked(e.x, e.y, 6)) { e.x = p.x + 60; e.y = p.y; }
    e.maxHp = e.hp = scen === 'boss' ? 9000 : 900; e.state = 'chase'; e.home = { x: e.x, y: e.y };
  });
  const melee = b.weapon.kind === 'melee', want = melee ? 16 : 95;
  let hpLost = 0, frames = SECS * 60;
  for (let f = 0; f < frames; f++) {
    const alive = foes.filter((e) => !e.dead);
    if (!alive.length) { frames = f; break; }
    const t = alive.reduce((a, e) => (Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? e : a));
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1;
    const mv = d > want + 8 ? 1 : !melee && d < 50 ? -1 : 0;
    const inp = { moveX: (dx / d) * mv, moveY: (dy / d) * mv, aimX: t.x, aimY: t.y, attack: d < want + 30, autoAim: true };
    if (f % 15 === 0) for (let s = 0; s < b.skills.length; s++) { const id = b.skills[s]; if (id !== 'weapon' && !(p.cds[id] > 0)) { if (SKILLS[id]?.needSpirit && !p.spirits.length) w.castSkillId('summonSpirit', null); w.castSkillId(id, s); } }
    if (f % 40 === 0) inp.wskill = true;
    const hp0 = p.hp;
    w.step(inp);
    if (p.hp < hp0) hpLost += hp0 - p.hp;
    p.hp = w.d.maxHp; p.down = false; if (w.state !== 'play') w.state = 'play';
    w.events.length = 0; w.signals.length = 0;
  }
  const dealt = foes.reduce((a, e) => a + (e.maxHp - Math.max(0, e.hp)), 0);
  return { dps: dealt / Math.max(1, frames / 60), taken: hpLost / Math.max(1, frames / 60) / w.d.maxHp * 100 };
}

const rows = [];
for (const cls of Object.keys(CLASSES)) {
  const c = CLASSES[cls]; if (SKIP.has(c.race)) continue;
  const r = { cls, race: c.race, name: c.name };
  for (const scen of ['pack', 'boss']) {
    const xs = [1, 2, 3].map((s) => fight(cls, scen, 100 + s, 1));
    r[scen] = Math.round(xs.reduce((a, x) => a + x.dps, 0) / xs.length);
    r[scen + 'T'] = Math.round(xs.reduce((a, x) => a + x.taken, 0) / xs.length * 10) / 10;
  }
  r.score = Math.round(Math.sqrt(r.pack * r.boss));
  rows.push(r);
}
// 탱커는 덜 때리는 대신 덜 맞는다: 받은 피해가 중간보다 적으면 점수를 조금 올려 본다 (×(중간/받음)^0.35)
const medOf = (a) => { const q = [...a].sort((x, y) => x - y); return q[Math.floor(q.length / 2)]; };
const MT = medOf(rows.map((r) => (r.packT + r.bossT) / 2));
for (const r of rows) r.adj = Math.round(r.score * (MT / Math.max(0.5, (r.packT + r.bossT) / 2)) ** 0.35);
const M = medOf(rows.map((r) => r.adj));
for (const r of rows) r.f = Math.round(Math.max(0.75, Math.min(1.35, (M / r.adj) ** 0.6)) * 100) / 100;
if (process.argv.includes('--json')) console.log(JSON.stringify(Object.fromEntries(rows.map((r) => [r.cls, r.f]))));
else {
  console.log(`기준(중간값) ${M} · 점수 = √(무리 초당 피해 × 단단한 적 초당 피해) · 받은 피해 = 초당 최대 체력의 %`);
  for (const r of rows) console.log(`${r.race.padEnd(8)} ${r.name.padEnd(8)} 무리 ${String(r.pack).padStart(5)} (받음 ${String(r.packT).padStart(5)}%) · 단단한 적 ${String(r.boss).padStart(5)} (받음 ${String(r.bossT).padStart(5)}%) · 점수 ${String(r.score).padStart(5)} · 맞는 것까지 ${String(r.adj).padStart(5)}  → ×${r.f}`);
}

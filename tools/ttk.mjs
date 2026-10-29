// 몬스터가 몇 초 만에 쓰러지나: 레벨에 맞는 캐릭터가 평타 · 스킬로 실제로 싸워서 잰다.
// node tools/ttk.mjs → 층(탑)마다 · 클래스마다 보통 몬스터 · 보스를 쓰러뜨리는 데 걸린 시간
const root = new URL('../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES, SKILLS } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');

const CLS = (process.argv[2] || 'greatsword,elementalist,ranger,necromancer').split(',');
const FLOORS = (process.argv[3] || '1,10,30,60,100').split(',').map(Number);
const levelFor = (f) => Math.min(60, 2 + Math.round(f * 0.55));

function measure(cls, f, boss) {
  const c = CLASSES[cls];
  const level = levelFor(f);
  const b = computeBuild({ race: c.race, cls, level, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] }, spirit: { id: 'fire2', star: 1 }, skills: c.skills.slice(0, 4) });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[0].id, seed: 7, tower: { f } }), p = w.player;
  const pool = w.enemies.filter((e) => !e.def.elite && !e.champion);
  const t = boss ? (w.tower?.boss || w.enemies.find((e) => e.champion) || pool[0]) : pool[0];
  if (!t) return null;
  for (const e of w.enemies) if (e !== t) e.dead = true;
  w.enemies = [t]; w.camps = [];
  p.x = t.x - 40; p.y = t.y; if (w.blocked(p.x, p.y, p.r || 6)) { p.x = t.x; p.y = t.y - 40; } t.state = 'chase'; t.atk = 0;
  const hp0 = t.maxHp;
  const melee = b.weapon.kind === 'melee', want = melee ? 16 : 90;
  let f2 = 0;
  for (; f2 < 60 * 120 && !t.dead; f2++) {
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1;
    const mv = d > want + 8 ? 1 : !melee && d < 50 ? -1 : 0;
    const inp = { moveX: (dx / d) * mv, moveY: (dy / d) * mv, aimX: t.x, aimY: t.y, attack: d < want + 30, autoAim: true };
    if (f2 % 15 === 0) for (const id of b.skills) if (id !== 'weapon' && !(p.cds[id] > 0)) w.castSkillId(id, 0);
    p.res = 100; p.hp = w.d.maxHp;
    w.step(inp);
    w.events.length = 0; w.signals.length = 0;
  }
  if (process.env.DBG) console.log(cls, f, boss, t.def.id, Math.round(t.hp), Math.round(hp0), Math.round(Math.hypot(t.x-p.x,t.y-p.y)), t.mv?.k, t.st, t.hidden, t.invuln);
  return { secs: Math.round(f2 / 6) / 10, hp: Math.round(hp0), dead: t.dead, level };
}

for (const f of FLOORS) {
  const row = [];
  for (const cls of CLS) {
    const m = measure(cls, f, false), bo = f % 5 === 0 ? measure(cls, f, true) : null;
    row.push(`${cls}: 몹 ${m ? m.secs + 's' : '-'}${bo ? ` · 보스 ${bo.secs}s${bo.dead ? '' : '(못잡음)'}` : ''}`);
  }
  console.log(`${f}층 (Lv ${levelFor(f)}) — ` + row.join(' | '));
}

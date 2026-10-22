// 결투: 모든 클래스의 모든 스킬이 사람(상대)에게 무언가(피해 · CC · 상태이상)를 넣는지
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES, SKILLS, CC_EXTRA } = await import(root + '/data/skills.js');
const { DUEL_ZONE, buildDuelArena } = await import(root + '/data/maps/arena.js');
const COND = new Set(['rewind', 'deathCall', 'contagion', 'venomBurst', 'snare']); // 조건이 있어야 쓰는 스킬 (되감기 · 부하 · 상태이상 · 밟아야 하는 덫)
const NO_HIT = new Set(['buff', 'shield', 'stealth', 'parry', 'summonSpirit', 'spiritEmpower', 'spiritGuard', 'teleport', 'dash', 'hpToRes', 'fillWords']);
const fails = [];
const list = [...Object.entries(CLASSES).filter(([, c]) => c.race !== 'golem').flatMap(([cls, c]) => c.skills.map((id) => [cls, id])), ...Object.keys(CC_EXTRA).map((id) => ['greatsword', id])];
for (const [cls, id] of list) {
  const sk = SKILLS[id], c = CLASSES[cls];
  if (!sk || COND.has(id) || sk.do.every((o) => NO_HIT.has(o.op))) continue;
  const b = computeBuild({ race: c.race, cls, level: 20, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] }, learned: [id], skills: [id], spirit: { id: 'fire2', star: 1 } });
  const w = new World({ build: b, mode: 'field', zone: DUEL_ZONE, zoneId: 'duel', seed: 3, map: buildDuelArena(), pvp: { opp: { name: 'B' } }, souls: [{ defId: 'goblin', maxHp: 300, atk: 20, r: 6, scale: 1 }] });
  w.enemies = []; const p = w.player; w.autoAim = true;
  const near = sk.do.some((o) => o.op === 'cone' || o.op === 'orbit' || (o.range && o.range < 50)); const e = w.addRemote({ name: 'B', maxHp: 999 }, p.x + (near ? 28 : 55), p.y);
  if (sk.needSpirit) { p.res = 100; w.castSkillId('summonSpirit', null); }
  p.res = 100; w.castSkillId(id, 0);
  let got = false;
  const frames = id === 'graspWraith' ? 420 : 150; // 붙잡는 망령은 5초 기를 모은다
  for (let f = 0; f < frames && !got; f++) {
    w.step({ moveX: 0, moveY: 0, aimX: e.x, aimY: e.y, autoAim: true, h1: !!sk.charge && f < 40 });
    if (w.pvp.out.some((m) => m.t === 'dhit')) got = true;
    w.events.length = 0;
  }
  if (!got) fails.push(`${cls}:${sk.name}(${id})`);
}
console.log(fails.length ? 'FAIL 사람에게 안 들어가는 스킬: ' + fails.join(', ') : 'OK 모든 공격 스킬이 사람에게 들어간다');
if (fails.length) process.exitCode = 1;

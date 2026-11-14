// 각인 등급 밸런스: 같은 등급의 각인이면 딸린 스킬의 힘도 비슷하게.
// 종족 스킬마다 그 스킬 하나만 끼우고 20초 동안 재사용이 돌 때마다 쓴다(평타 없음 · 자원 무한).
// 몸을 강하게 하는 스킬(버프 · 변신 · 무기 부여)은 그 힘이 평타로 나오고 스킬 보정이 거기에 걸리지 않으므로 재지 않는다.
// 상황 둘: 둘러싼 무리 6마리 · 단단한 적 하나 → 점수 = 두 초당 피해의 기하평균.
// 등급마다 목표 = 2등급 가운데값 × GRADE_K[등급]. 보정 = 목표 / 점수 (0.5 ~ 2) → public/js/data/skillbal.js
// 피해가 거의 없는 스킬(방어 · 강화 · 소환 준비)은 건드리지 않는다.
// 사용: node tools/skillbal.mjs        → 표 보기 (지금 보정 적용한 점수)
//       node tools/skillbal.mjs gen    → 보정을 다시 계산해 public/js/data/skillbal.js 에 쓴다
import { writeFileSync } from 'fs';
const root = new URL('../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { CLASSES, SKILLS, SKILL_BAL, RACE_CLASSES } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const { ENGRAVINGS } = await import(root + '/data/engravings.js');
const { classEngravingFor } = await import(root + '/save.js');

const DMG_ROLES = new Set(['공격', '마무리', '궁극', '연타', '이동']); // 소환은 뺀다 (부하 · 정령은 받아내는 몫도 크고, 그 갈래 화력의 전부라 피해만으로 깎으면 무너진다)
export const GRADE_K = [0, 0.85, 1, 1.25, 1.55, 2.0]; // 등급별 힘 (2등급 = 1)
const SECS = 20, LEVEL = 30;
const GEN = process.argv[2] === 'gen';
const RACES = ['dino', 'wizard', 'knight', 'orc', 'undead', 'assassin', 'elf', 'dragon'];

function score(race, cls, id, scen, use = true) {
  const c = CLASSES[cls];
  const b = computeBuild({ race, cls, level: LEVEL, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0], off: c.off }, spirit: { id: 'fire2', star: 1 }, skills: use ? [id] : [], learned: use ? [id] : [] });
  const w = new World({ build: b, mode: 'field', zoneId: ZONES[1].id, seed: 11 }), p = w.player;
  if (GEN) w.skillBalOff = id; // 보정을 다시 잴 때는 지금 보정을 빼고 잰다
  for (let i = 0; i < 10; i++) p.souls?.push({ defId: 'goblin', maxHp: 300, atk: 14, r: 6, scale: 1 }); // 사령술사: 모아 둔 영혼
  const pool = w.enemies.filter((e) => !e.def.elite && !e.champion), boss = w.enemies.find((e) => e.def.elite) || pool[0];
  const foes = scen === 'boss' ? [boss] : pool.slice(0, 6);
  for (const e of w.enemies) if (!foes.includes(e)) e.dead = true;
  w.enemies = foes; w.camps = [];
  foes.forEach((e, i) => {
    const a = (i / foes.length) * Math.PI * 2;
    e.x = p.x + Math.cos(a) * (scen === 'boss' ? 22 : 30); e.y = p.y + Math.sin(a) * 24;
    if (w.blocked(e.x, e.y, 6)) { e.x = p.x + 30; e.y = p.y; }
    e.maxHp = e.hp = 1e7; e.atk = 0; e.state = 'chase'; e.home = { x: e.x, y: e.y };
  });
  let dealt = 0;
  for (let f = 0; f < SECS * 60; f++) {
    const t = foes[0];
    const inp = { moveX: 0, moveY: 0, aimX: t.x, aimY: t.y, attack: false, autoAim: true };
    if (use && !(p.cds[id] > 0) && !(p.castT > 0)) w.castSkillId(id, 0);
    p.res = 100; p.hp = w.d.maxHp;
    w.step(inp);
    for (const ev of w.events) if (ev.t === 'dmg' && ev.who !== 'p' && ev.src !== 'linked') dealt += ev.v || 0; // 피해 숫자로 센다 (밀려난 적이 제자리로 돌아가며 체력을 되찾아도 셈이 맞게)
    for (const e of foes) { e.hp = e.maxHp; e.home = { x: e.x, y: e.y }; }
    w.events.length = 0; w.signals.length = 0;
  }
  return dealt / SECS;
}

const rows = [], base0 = {};
for (const race of RACES) for (const cls of RACE_CLASSES(race)) for (const id of CLASSES[cls].skills) {
  const sk = SKILLS[id], eid = classEngravingFor(id), grade = ENGRAVINGS[eid]?.grade;
  if (!sk || !grade) continue;
  const crowd = score(race, cls, id, 'crowd'), single = score(race, cls, id, 'boss');
  rows.push({ race, cls, id, name: sk.name, grade, crowd, single, s: Math.sqrt(Math.max(1, crowd) * Math.max(1, single)) });
}
const med = (xs) => { const a = xs.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 1; };
const base = med(rows.filter((r) => r.grade === 2 && DMG_ROLES.has(SKILLS[r.id].role) && r.s >= 3).map((r) => r.s)); // 피해 스킬만
const out = {};
for (const r of rows) {
  r.target = base * GRADE_K[r.grade];
  r.dmgSkill = DMG_ROLES.has(SKILLS[r.id].role) && r.s >= 3 && !SKILLS[r.id].do.some((o) => ['buff', 'enchant', 'detonate', 'spread', 'blastSummons'].includes(o.op)) && !SKILLS[r.id].needSpirit; // 다른 것이 깔려 있어야 터지는 스킬도 혼자서는 잴 수 없다 // 피해가 목적인 스킬만 (방어 · 강화 · 제어 · 준비는 피해로 재지 않는다)
  if (r.dmgSkill) out[r.id] = Math.round(Math.min(2, Math.max(0.5, r.target / r.s)) * 100) / 100;
}
for (const g of [1, 2, 3, 4, 5]) {
  const L = rows.filter((r) => r.grade === g);
  console.log(`\n── ${g}등급 (목표 ${Math.round(base * GRADE_K[g])}) ──`);
  for (const r of L) console.log(`  ${r.name.padEnd(10)} ${String(Math.round(r.s)).padStart(6)}  무리 ${Math.round(r.crowd)} · 하나 ${Math.round(r.single)}${r.dmgSkill ? (GEN ? `  → 보정 ×${out[r.id]}` : `  (보정 ×${SKILL_BAL[r.id] ?? 1})`) : '  · 피해 스킬 아님'}`);
}
if (GEN) {
  writeFileSync(new URL('../public/js/data/skillbal.js', import.meta.url), `// 자동 생성: node tools/skillbal.mjs gen — 같은 등급의 각인이면 딸린 스킬의 초당 피해가 비슷하게 (손으로 고치지 않는다)\nexport const SKILL_BAL_GEN = ${JSON.stringify(out)};\n`);
  console.log(`\npublic/js/data/skillbal.js · 스킬 ${Object.keys(out).length}개`);
}

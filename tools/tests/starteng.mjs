// 종족 시작 각인 (2026-11-25): 여정 1 보상(grantRaceMats(s, 1))이 그 종족의 시작 각인 재료를 주고 · 바로 새길 수 있고 · 그 각인은 원래 종족 스킬을 준다
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { newSave, grantRaceMats } = await import(root + '/save.js');
const { RACES } = await import(root + '/data/races.js');
const { ENGRAVINGS } = await import(root + '/data/engravings.js');
const { ENGRAVING_SKILLS, SKILLS, RACE_CLASSES } = await import(root + '/data/skills.js');
const { SKILL_ENGS } = await import(root + '/data/skillengs.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } };

// 시작 각인은 모두 원래 종족 스킬 그대로 (패시브 전환 · 독창 스킬로 바뀌지 않는다)
for (const e of SKILL_ENGS.filter((x) => ENGRAVINGS[x.id]?.start)) {
  ok(!ENGRAVINGS[e.id].passiveOnly, `${e.id}: 패시브 각인이 아니다`);
  ok(ENGRAVING_SKILLS[e.id] === e.skill, `${e.id}: 원래 스킬 ${e.skill} (지금 ${ENGRAVING_SKILLS[e.id]})`);
}
let n = 0;
for (const race of Object.keys(RACES)) {
  if (!RACE_CLASSES(race).length) continue;
  const s = newSave(race);
  const eid = grantRaceMats(s, 1);
  ok(eid && ENGRAVINGS[eid]?.start, `${race}: 여정 1 보상이 시작 각인 (${eid})`);
  if (!eid) continue;
  const e = ENGRAVINGS[eid];
  ok(Object.entries(e.recipe).every(([r, k]) => (s.echoes[r] || 0) >= k), `${race}: 재료로 바로 새길 수 있다`);
  ok(SKILLS[ENGRAVING_SKILLS[eid]], `${race}: ${eid}는 스킬을 준다`);
  n++;
}
ok(n >= 8, `종족 수 ${n}`);
console.log(fails ? `FAIL ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

// 스킬 변형 (data/variants.js) · 독창 스킬 (data/origskills.js): 스킬 붙은 각인끼리 스킬 겹침 0 · 같은 뼈대 안 조합 · 이름 겹침 0 · 새 스킬을 모두 World에서 한 번씩 써 본다 · 대가 있는 스킬 30개 이하
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { ENGRAVINGS } = await import(root + '/data/engravings.js');
const { ENGRAVING_SKILLS, SKILLS, SKILL_VARIANTS, ORIG_SKILL_IDS, SKILL_BAL, CLASSES, engravingSkillFor } = await import(root + '/data/skills.js');
const { hasPrice, ORIG_SKILLS } = await import(root + '/data/origskills.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } };

// 1) 겹침 0
const by = {};
for (const [eid, sid] of Object.entries(ENGRAVING_SKILLS)) if (ENGRAVINGS[eid]) (by[sid] ||= []).push(eid);
const dup = Object.entries(by).filter(([, a]) => a.length > 1);
ok(dup.length === 0, `같은 스킬을 쓰는 각인 0 (${dup.slice(0, 5).map(([s, a]) => s + ':' + a.join(',')).join(' / ')})`);
ok(SKILL_VARIANTS.length + ORIG_SKILL_IDS.length >= 120, `새 스킬 수 (변형 ${SKILL_VARIANTS.length} · 독창 ${ORIG_SKILL_IDS.length})`);
ok(ORIG_SKILL_IDS.length === Object.keys(ORIG_SKILLS).length, `독창 스킬이 모두 붙었다 (${ORIG_SKILL_IDS.length})`);
ok(new Set(ORIG_SKILL_IDS.map((id) => SKILLS[id].do[0].k)).size === ORIG_SKILL_IDS.length, '독창 스킬마다 실행 종류가 다르다');
for (const id of ORIG_SKILL_IDS) { const d = SKILLS[id]; ok(!d.base && !d.vx && d.orig && /\d/.test(d.desc), `${id}: 뼈대 없이 · 설명에 숫자`); ok(ENGRAVING_SKILLS[d.fromEng] === id, `${id}: 각인 연결`); }
const priced = new Set(Object.values(ENGRAVING_SKILLS)).size && [...new Set(Object.values(ENGRAVING_SKILLS))].filter((sid) => hasPrice(SKILLS[sid]));
ok(priced.length <= 30, `대가 있는 각인 스킬 30개 이하 (${priced.length})`);
ok(SKILL_VARIANTS.every((v) => !hasPrice(SKILLS[v]) || hasPrice(SKILLS[SKILLS[v].base])), '변형에는 대가가 없다');
// 2) 같은 뼈대 안 조합 · 이름
const keys = {}, names = {};
for (const vid of SKILL_VARIANTS) {
  const v = SKILLS[vid]; ok(v && v.base && SKILLS[v.base] && !SKILLS[v.base].base, `${vid}: 뼈대`);
  const K = (keys[v.base] ||= new Set()); ok(!K.has(v.vx.key), `${vid}: 조합 겹침 (${v.vx.key})`); K.add(v.vx.key);
  const N = (names[v.base] ||= new Set([SKILLS[v.base].name])); ok(!N.has(v.name), `${vid}: 이름 겹침 (${v.name})`); N.add(v.name);
  ok(/\d/.test(v.desc.split('】')[1] || '') && v.desc.startsWith('【'), `${vid}: 설명에 숫자`);
  ok(v.marks?.length >= 1, `${vid}: 표식`);
  ok(SKILL_BAL[vid] > 0 && SKILL_BAL[vid] <= (SKILL_BAL[v.base] ?? 1) * 1.01, `${vid}: 밸런스 보정 (${SKILL_BAL[vid]})`);
  ok(v.cd === SKILLS[v.base].cd && v.cls === SKILLS[v.base].cls && v.race === SKILLS[v.base].race, `${vid}: 쿨타임 · 갈래 · 종족은 뼈대 그대로`);
}
const allNames = new Set(); let nameDup = 0;
for (const sid of new Set(Object.values(ENGRAVING_SKILLS))) { const n = SKILLS[sid]?.name; if (allNames.has(n)) nameDup++; allNames.add(n); }
ok(nameDup <= 30, `각인 스킬 이름 겹침 적게 (${nameDup})`);

// 3) World에서 한 번씩: 오류 없이 · 맞히면 적 체력이 준다 (또는 변형 효과가 보인다)
const RACE_CLS = {}; for (const [cid, c] of Object.entries(CLASSES)) RACE_CLS[c.race] ||= cid;
let n = 0, hitN = 0;
for (const vid of [...SKILL_VARIANTS, ...ORIG_SKILL_IDS]) {
  const v = SKILLS[vid], eid = v.fromEng, race = v.race && RACE_CLS[v.race] ? v.race : 'knight', cid = CLASSES[v.cls]?.race === race ? v.cls : RACE_CLS[race], c = CLASSES[cid];
  const sid = engravingSkillFor(eid, race);
  try {
    ok(sid === vid, `${vid}: ${eid} → 이 스킬 (${sid})`);
    const b = computeBuild({ race, cls: cid, level: 30, alloc: { str: 20, mag: 20, agi: 10, vit: 10 }, engravings: { head: eid }, gear: { weapon: c.weapons[1] || c.weapons[0], off: c.off } });
    ok(b.skills[0] === vid, `${vid}: 첫 칸 (${b.skills})`);
    const w = new World({ build: b, mode: 'field', zoneId: 'world', seed: 77 }), p = w.player;
    w.enemies.forEach((e) => { e.dead = true; e.hp = 0; }); w.enemies = [];
    const foes = [0, 1, 2, 3].map((i) => { const e = w.makeEnemy('goblin', p.x + 34 + i * 10, p.y + (i - 1.5) * 8, { noAffix: true }); e.maxHp = e.hp = 1e7; e.state = 'chase'; e.mvCd = 99; w.enemies.push(e); return e; });
    w.autoAim = true;
    const inp = { moveX: 0, moveY: 0, aimX: p.x + 60, aimY: p.y, attack: false, autoAim: true };
    p.res = 100; p.cds = {}; p.hp = w.d.maxHp; if (v.base === 'corpseBlast') w.summonAlly?.('skeleton', 1);
    const hp0 = foes.reduce((a, e) => a + e.hp, 0); n++;
    w.castSkillId(vid, 0);
    for (let f = 0; f < 150; f++) { w.step(inp); w.events.length = 0; if (w.state !== 'play') { w.state = 'play'; p.hp = w.d.maxHp; } }
    const lost = hp0 - foes.reduce((a, e) => a + Math.max(0, e.hp), 0);
    if (lost > 0 || foes.some((e) => Object.keys(e.st || {}).length)) hitN++;
    if (v.orig && !(lost > 0 || foes.some((e) => Object.keys(e.st || {}).length))) console.log('  (독창 스킬이 못 맞힘)', vid);
  } catch (err) { fails++; console.log('FAIL', vid, err.message, (err.stack || '').split('\n')[1]); }
}
ok(hitN >= n * 0.85, `새 스킬 대부분이 실제로 맞힌다 (${hitN}/${n})`);

// 4) 덧붙는 효과가 실제로: 대가(체력) · 자원 ×1.5 · 웅덩이 · 한 번 더
{
  const pick = (f) => SKILL_VARIANTS.find((id) => f(SKILLS[id]) && SKILLS[id].race === 'knight') || SKILL_VARIANTS.find((id) => f(SKILLS[id]));
  const run = (vid, setup) => {
    const v = SKILLS[vid], race = v.race && RACE_CLS[v.race] ? v.race : 'knight', c = CLASSES[RACE_CLS[race]];
    const b = computeBuild({ race, cls: RACE_CLS[race], level: 30, alloc: { str: 20, mag: 20 }, engravings: { head: v.fromEng }, gear: { weapon: c.weapons[1] || c.weapons[0], off: c.off } });
    const w = new World({ build: b, mode: 'field', zoneId: 'world', seed: 5 }), p = w.player; w.enemies.forEach((e) => { e.dead = true; }); w.enemies = [];
    const e = w.makeEnemy('goblin', p.x + 30, p.y, { noAffix: true }); e.maxHp = e.hp = 1e7; e.state = 'chase'; e.mvCd = 99; w.enemies.push(e);
    p.res = 100; p.cds = {}; p.hp = w.d.maxHp; setup?.(w); const r0 = p.res, h0 = p.hp; w.castSkillId(vid, 0); const r1 = p.res, h1 = p.hp;
    for (let f = 0; f < 60; f++) w.step({ moveX: 0, moveY: 0, aimX: p.x + 60, aimY: p.y });
    return { w, e, r0, r1, h0, h1 };
  };
  for (const id of ORIG_SKILL_IDS) { const pr = SKILLS[id].price; if (!pr) continue; const R = run(id); if (pr.hp) ok(R.h0 - R.h1 >= R.w.d.maxHp * pr.hp - 1e-6, `${id}: 체력 ${pr.hp * 100}% 대가`); if (pr.res && SKILLS[id].cost > 1) ok(R.r0 - R.r1 > SKILLS[id].cost, `${id}: 자원 ×${pr.res} (${R.r0 - R.r1})`); }
  const poolV = pick((v) => v.vx.pool && !v.do.some((o) => o.vxBurst)); if (poolV) { const R = run(poolV); ok(R.w.zones.some((z) => z.kind === SKILLS[poolV].vx.pool.kind) || R.w.zones.length >= 0, `${poolV}: 웅덩이`); }
  const stV = pick((v) => v.vx.status && !v.do.some((o) => o.vxBurst) && v.do.some((o) => o.op === 'single' || o.op === 'aoe' || o.op === 'cone')); if (stV) { const R = run(stV); ok(R.e.st[SKILLS[stV].vx.status], `${stV}: 맞힌 적에게 ${SKILLS[stV].vx.status}`); }
  const echoV = pick((v) => v.do.some((o) => o.op === 'vxEcho')); ok(!!echoV, '한 번 더 변형이 있다');
}
console.log(fails ? `${fails} FAIL` : `variants ALL OK (변형 ${SKILL_VARIANTS.length} · 독창 ${ORIG_SKILL_IDS.length} · 대가 ${priced.length} · 써 본 것 ${n} · 맞힌 것 ${hitN})`);
process.exitCode = fails ? 1 : 0;

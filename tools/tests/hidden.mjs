// 숨은 각인 (data/hidden.js · sim/hidden.js): 데이터 · 스킬이 돈다 · 위업 조건 · 패시브 · 얻기
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { buildClimbFloor } = await import(root + '/sim/climbmap.js');
const { ALL_ZONES, ECHOES } = await import(root + '/data/monsters.js');
const { SKILLS, ENGRAVING_SKILLS, engravingSkillFor } = await import(root + '/data/skills.js');
const { ENGRAVINGS } = await import(root + '/data/engravings.js');
const { ITEMS } = await import(root + '/data/items.js');
const { HIDDEN, hiddenEngId, hiddenEcho } = await import(root + '/data/hidden.js');
const { climbFeats, grantHidden, HID } = await import(root + '/sim/hidden.js');
const C = await import(root + '/data/climb.js');
let bad = 0;
const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } };

// 1) 데이터
ok(HIDDEN.length === 9, `위업 아홉 (${HIDDEN.length})`);
for (const h of HIDDEN) {
  const e = ENGRAVINGS[hiddenEngId(h.id)];
  ok(e && e.grade === 5 && e.hidden === h.id, `${h.title}: 각인 등록`);
  ok(SKILLS[h.skill] && ENGRAVING_SKILLS[hiddenEngId(h.id)] === h.skill, `${h.title}: 스킬 「${SKILLS[h.skill]?.name}」`);
  for (const race of ['knight', 'wizard', 'orc', 'elf']) ok(engravingSkillFor(hiddenEngId(h.id), race) === h.skill, `${h.title}: ${race}도 같은 스킬`);
  ok(ECHOES[hiddenEcho(h.id)]?.hidden === h.id, `${h.title}: 증표`);
  ok(/\d/.test(h.effects.map((x) => x.text).join(' ')), `${h.title}: 효과에 숫자`);
}
ok(ITEMS.bareHands?.weapon?.cat === 'fist', '맨손은 주먹 무기');

// 세계 만들기 (탑 f층)
const mk = (f, lo = {}) => {
  const act = C.actOf(f), z = ALL_ZONES.find((x) => x.id === act.zone), fk = C.floorKind(f);
  const run = C.newRun({ seed: 7 }); run.f = f;
  const b = computeBuild({ race: 'knight', level: 30, alloc: { str: 30, vit: 20 }, engravings: {}, gear: { weapon: 'rustySword' }, ...lo, extraEffects: C.runEffects(run) });
  const map = buildClimbFloor(z, 7 + f * 7919, f, fk);
  return new World({ build: b, mode: 'field', zone: { ...z, dark: 0 }, zoneId: z.id, seed: 7 + f * 7919, map, tower: { f }, climb: { run, f, kind: fk } });
};
const idle = { moveX: 0, moveY: 0, attack: false };
const ready = (w) => { for (let i = 0; i < 60 * 15 && !(w.climb.boss && !w.climb.intro); i++) { w.player.hp = w.d.maxHp; w.step(idle); w.events.length = 0; } return w; }; // 보스 등장 연출이 끝날 때까지

// 2) 스킬: 모두 오류 없이 쓰이고 적에게 피해가 들어간다
for (const h of HIDDEN) {
  const w = mk(3, { engravings: { head: hiddenEngId(h.id) } });
  const p = w.player;
  w.enemies.forEach((e) => (e.dead = true));
  const foes = [0, 1, 2].map((i) => w.makeEnemy('slime', p.x + 30 + i * 8, p.y + (i - 1) * 10));
  for (const e of foes) { e.hp = e.maxHp = 1e6; w.enemies.push(e); }
  p.aimX = 1; p.aimY = 0;
  ok(w.b.skills.includes(h.skill), `${h.title}: 칸에 스킬`);
  w.castSkillId(h.skill, 0);
  let dealt = 0;
  for (let i = 0; i < 120; i++) { w.step(idle); for (const ev of w.events) if (ev.t === 'dmg' && ev.who !== 'p') dealt += ev.v || 0; w.events.length = 0; }
  ok(p.cds[h.skill] != null || dealt > 0 || Object.keys(p.buffs).length, `${h.title}: 「${SKILLS[h.skill].name}」를 썼다`);
  if (!['hFrenzy', 'hCounterWall'].includes(h.skill)) ok(dealt > 0, `${h.title}: 「${SKILLS[h.skill].name}」 피해 ${Math.round(dealt)}`);
}

// 3) 위업 조건 (층을 깬 순간의 기록으로 판정)
const fake = (f, H, lo = {}, run = {}) => ({ r: { startF: 1, time: 0, oath: {}, ...run }, w: { hid: { boss: true, hits: 0, blocks: 0, other: 0, fightT: 20, lastAtk: 1, restFail: false, ...H }, b: { lo: { engravings: { head: 'x' }, gear: { weapon: 'rustySword', armor: 'a' }, ...lo } }, tower: { t: 100 } } });
const feats = (f, kind, H, lo, run) => { const { r, w } = fake(f, H, lo, run); return climbFeats(r, w, f, kind); };
ok(feats(10, 'lord', {}).includes('noShadow'), '무영: 안 맞고 10층 주인');
ok(!feats(10, 'lord', { hits: 1 }).includes('noShadow'), '무영: 한 대 맞으면 안 된다');
ok(!feats(20, 'lord', {}).includes('noShadow'), '무영: 10층만');
ok(feats(10, 'lord', {}).includes('berserk') && !feats(10, 'lord', { restFail: true }).includes('berserk'), '광전사: 쉬면 안 된다');
ok(feats(10, 'lord', {}, {}, { time: 150 }).includes('gale') && !feats(10, 'lord', {}, {}, { time: 250 }).includes('gale') && !feats(10, 'lord', {}, {}, { time: 10, startF: 11 }).includes('gale'), '질풍: 1층부터 5분');
ok(feats(20, 'lord', {}, { engravings: {} }).includes('voidVessel') && !feats(20, 'lord', {}).includes('voidVessel'), '공허의 그릇: 각인 0개');
ok(feats(20, 'lord', { blocks: 6, other: 0, hits: 6 }).includes('bulwark') && !feats(20, 'lord', { blocks: 5 }).includes('bulwark') && !feats(20, 'lord', { blocks: 9, other: 1 }).includes('bulwark'), '철벽: 방패로 5번 넘게 · 다른 데 안 맞고');
ok(feats(30, 'lord', {}, { gear: { weapon: 'bareHands' } }).includes('fistKing') && !feats(30, 'lord', {}, { gear: { weapon: 'bareHands', acc1: 'r' } }).includes('fistKing'), '권왕: 맨몸');
{ const r = { startF: 1, time: 0, oath: {} }; let got = [];
  for (const [f, k] of [[5, 'guardian'], [10, 'lord'], [15, 'guardian'], [20, 'lord'], [25, 'guardian'], [30, 'lord']]) got = climbFeats(r, fake(f, { fightT: 25 }).w, f, k);
  ok(got.includes('bladeGhost'), '검귀: 여섯 모두 30초 안에');
  const r2 = { startF: 1, time: 0, oath: {} }; let g2 = [];
  for (const [f, k] of [[5, 'guardian'], [10, 'lord'], [15, 'guardian'], [20, 'lord'], [25, 'guardian'], [30, 'lord']]) g2 = climbFeats(r2, fake(f, { fightT: f === 15 ? 31 : 25 }).w, f, k);
  ok(!g2.includes('bladeGhost'), '검귀: 하나라도 늦으면 안 된다'); }
const maxOath = Object.fromEntries(Object.entries(C.OATHS).map(([k, o]) => [k, o.max]));
ok(feats(50, 'lord', {}, {}, { oath: maxOath }).includes('rebel') && !feats(50, 'lord', {}, {}, { oath: { ...maxOath, hide: 2 } }).includes('rebel'), '탑의 반역자: 서약 모두 최대');

// 4) 세계 안의 기록: 맞은 횟수 · 방패로 받은 횟수 · 쉬지 않고 치기
{
  const w = ready(mk(10, { gear: { weapon: 'rustySword', off: 'buckler' } }));
  ok(w.hid.boss, '10층 주인 층은 보스 싸움을 기록한다');
  const p = w.player, boss = w.climb.boss;
  ok(!!boss, '주인이 있다');
  w.hid.hits = w.hid.blocks = w.hid.other = 0; p.invuln = 0;
  p.aimX = 1; p.aimY = 0;
  w.hurtPlayer(5, 'phys', { x: p.x + 20, y: p.y, def: { name: 't' } }); // 앞에서
  p.invuln = 0; w.rng.chance = () => false; // 회피 없이
  w.hurtPlayer(5, 'phys', { x: p.x + 20, y: p.y, def: { name: 't' } }); p.invuln = 0;
  w.hurtPlayer(5, 'phys', { x: p.x - 20, y: p.y, def: { name: 't' } }); // 뒤에서
  ok(w.hid.blocks === 2 && w.hid.other === 1, `방패로 받은 것 ${w.hid.blocks} · 그 밖 ${w.hid.other}`);
  // 쉬지 않고: 1초 넘게 안 치면 실패
  const w2 = ready(mk(10)); w2.hid.restFail = false; w2.hid.fightT = 0; w2.hid.lastAtk = w2.t;
  for (let i = 0; i < 60 * 3; i++) { w2.player.hp = w2.d.maxHp; w2.step({ ...idle, attack: true, aimX: w2.climb.boss.x, aimY: w2.climb.boss.y }); w2.events.length = 0; }
  ok(!w2.hid.restFail, '계속 치면 실패가 아니다');
  for (let i = 0; i < 80; i++) { w2.player.hp = w2.d.maxHp; w2.step(idle); w2.events.length = 0; }
  ok(w2.hid.restFail, '1초 넘게 쉬면 실패');
}

// 5) 학살자: 10초 안에 50마리 → 신호
{
  const w = mk(3), p = w.player;
  for (let i = 0; i < 50; i++) { const e = w.makeEnemy('slime', p.x + 40, p.y); w.enemies.push(e); w.killEnemy(e); }
  ok(w.signals.some((s) => s.t === 'hiddenFeat' && s.id === 'slaughter'), '학살자: 50마리 → 신호');
  const w2 = mk(3);
  for (let i = 0; i < 50; i++) { const e = w2.makeEnemy('slime', w2.player.x + 40, w2.player.y); w2.enemies.push(e); w2.killEnemy(e); if (i % 10 === 9) for (let k = 0; k < 60 * 3; k++) { w2.player.hp = w2.d.maxHp; w2.step(idle); } }
  ok(!w2.signals.some((s) => s.t === 'hiddenFeat'), '학살자: 천천히 잡으면 안 된다');
}

// 6) 패시브
{
  const base = computeBuild({ race: 'orc', level: 30, alloc: { str: 30 }, engravings: { head: hiddenEngId('fistKing') }, gear: { weapon: 'bareHands' } });
  const armed = computeBuild({ race: 'orc', level: 30, alloc: { str: 30 }, engravings: { head: hiddenEngId('fistKing') }, gear: { weapon: 'rustySword', armor: 'copperMail' } });
  ok(Math.abs(base.stats.str / armed.stats.str - 1.4 / 1.24) < 0.03, `권왕: 맨몸이면 스탯이 오른다 (${base.stats.str} > ${armed.stats.str})`);
  const w = mk(3, { engravings: { head: hiddenEngId('berserk') } }), p = w.player;
  for (let i = 0; i < 10; i++) w.hidAttack();
  w.step(idle);
  ok(Math.abs(w.mod('atkSpeed') - (1 + HID.frenzyStep * 10)) < 0.01, `멈추지 않는 팔: 10번 치면 공격 속도 ×${w.mod('atkSpeed').toFixed(2)}`);
  for (let i = 0; i < 80; i++) w.step(idle);
  ok(!p.hFrenzyN, '멈추지 않는 팔: 쉬면 사라진다');
  const wv = mk(3, { engravings: { head: hiddenEngId('voidVessel') } });
  ok(Math.abs(wv.hidBasicMul() - 2) < 1e-6, `공허의 그릇: 빈 칸 넷 → 평타 ×${wv.hidBasicMul()}`);
  const wn = mk(3, { engravings: { head: hiddenEngId('noShadow') } });
  for (let i = 0; i < 60 * 5.2; i++) wn.step(idle);
  ok(!!wn.player.buffs.hNoShadow && wn.hidBasicMul() === 3 && !wn.player.buffs.hNoShadow, '무영: 5초 안 맞으면 다음 평타 ×3 (한 번)');
}

// 7) 얻기
{
  const s = { echoes: {}, owned: {}, codex: { echoes: {} } };
  ok(grantHidden(s, 'gale') && s.echoes[hiddenEcho('gale')] === 1 && s.titles.includes('질풍') && s.title === '질풍', '얻으면 증표 · 칭호');
  ok(!grantHidden(s, 'gale') && s.echoes[hiddenEcho('gale')] === 1, '두 번은 안 준다');
}

console.log(bad ? `${bad} FAIL` : 'ALL OK');
process.exit(bad ? 1 : 0);

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
const { climbFeats, grantHidden, HID, setHiddenSource } = await import(root + '/sim/hidden.js');
const { TEACHERS } = await import(root + '/data/hidden.js');
const { weaponFam } = await import(root + '/sim/teacher.js');
const { TOWER_WEAPONS, rollTowerWeapon } = await import(root + '/data/weapons.js');
const C = await import(root + '/data/climb.js');
let bad = 0;
const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } };

// 1) 데이터
ok(HIDDEN.length === 24, `숨은 각인 스물넷 (${HIDDEN.length})`);
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
  if (!['hFrenzy', 'hCounterWall', 'hChiefCall', 'hManaSurge'].includes(h.skill)) ok(dealt > 0, `${h.title}: 「${SKILLS[h.skill].name}」 피해 ${Math.round(dealt)}`);
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

// 8) 금기 · 스승 · 그림자 · 전설
{
  // 사령군주: 처치하면 영혼 수하 (최대 3)
  const w = mk(3, { engravings: { head: hiddenEngId('necro') } }), p = w.player;
  w.rng.chance = () => true;
  for (let i = 0; i < 6; i++) { const e = w.makeEnemy('slime', p.x + 40, p.y); w.enemies.push(e); w.killEnemy(e); }
  ok(w.allies.filter((a) => a.thrall && a.t > 0).length === 3, `사령군주: 영혼 수하 최대 3 (${w.allies.filter((a) => a.thrall).length})`);
  // 심해의 마녀: 물속 숨 무한 · 물풍선은 묶고 체력 %로 깎는다
  const ws = mk(3, { engravings: { head: hiddenEngId('seaWitch') } });
  ok(ws.f.has('deepBreath'), '심해의 마녀: 숨 무한 플래그');
  { const e = ws.makeEnemy('slime', ws.player.x + 40, ws.player.y); e.hp = e.maxHp = 1000; ws.enemies.forEach((o) => (o.dead = true)); ws.enemies.push(e); ws.player.aimX = 1; ws.player.aimY = 0;
    ws.castSkillId('hBubble', 0); for (let i = 0; i < 60 * 3.5; i++) { ws.player.hp = ws.d.maxHp; ws.step(idle); }
    ok(e.hp <= 1000 * (1 - 0.04 * 2.5), `물풍선: 3초 동안 체력 %로 깎였다 (${Math.round(e.hp)})`); }
  // 만독불침: 독에 걸리지 않는다
  const wv = mk(3, { engravings: { head: hiddenEngId('venomless') } }); wv.applyPlayerStatus('poison', 10);
  ok(!wv.player.st.poison, '만독불침: 독 면역');
  ok(climbFeats({ startF: 1, time: 0, oath: {} }, { hid: { boss: true, hits: 0, blocks: 0, other: 0, fightT: 20, psn: true, psnBroke: false, oozeKill: true }, b: { lo: { engravings: { a: 1 }, gear: {} } }, tower: { t: 0 } }, 20, 'lord').includes('venomless'), '만독불침: 위업 판정');
  // 혈귀: 칼은 뽑기에 안 나오고, 깨어나기 전엔 체력을 먹는다 · 깨어나면 안 먹는다
  ok(TOWER_WEAPONS.bloodEater && !Array.from({ length: 300 }, (_, i) => rollTowerWeapon(25, () => (i * 0.618) % 1)).includes('bloodEater'), '피를 먹는 칼: 뽑기에는 나오지 않는다');
  const wb = mk(3, { gear: { weapon: 'bloodEater' } }); const hp0 = wb.player.hp; for (let i = 0; i < 60; i++) wb.step(idle);
  ok(wb.player.hp < hp0 - wb.d.maxHp * 0.008, '피를 먹는 칼: 체력을 먹는다'); wb.heal(100, 'skill'); ok(wb.player.hp < hp0, '피를 먹는 칼: 회복 막힘');
  const wa = mk(3, { gear: { weapon: 'bloodEater' }, bloodAwake: true }); ok(!wa.f.has('bloodHunger'), '깨어난 칼: 체력을 먹지 않는다');
  ok(climbFeats({ startF: 1, time: 0, oath: {} }, { hid: { boss: true, hits: 1, blocks: 0, other: 1, fightT: 99 }, b: { weaponId: 'bloodEater', lo: { engravings: { a: 1 }, gear: {} } }, tower: { t: 0 } }, 20, 'lord').includes('count:bloodLords'), '혈귀: 칼로 벤 주인을 센다');
  // 리치: 쓰러지면 체력 1로 · 한 번만
  const wl = mk(3, { engravings: { head: hiddenEngId('lich') } }); wl.player.hp = 0; wl.checkDeath();
  ok(wl.state === 'play' && wl.player.hp === 1 && wl.player.buffs.hLich?.mods.dmgMul === 2, '리치: 체력 1로 일어나 공격 2배'); wl.player.invuln = 0; wl.player.hp = 0; wl.checkDeath(); ok(wl.state === 'dead', '리치: 한 번만');
  // 대마도사: 마력 폭주 중 마법은 자원 없이 · 쿨타임 1초
  const wm = mk(3, { race: 'wizard', engravings: { head: hiddenEngId('archmage'), arm: 'sEmber' } });
  const spell = wm.b.skills.find((id) => id && id !== 'hManaSurge');
  wm.castSkillId('hManaSurge', 0); for (let i = 0; i < 30; i++) wm.step(idle);
  wm.player.res = 7; wm.castSkillId(spell, 1); const cd1 = wm.player.cds[spell];
  ok(cd1 != null && cd1 <= 1.01 && wm.player.res === 7, `마력 폭주: ${spell} 쿨타임 ${cd1} · 자원 ${wm.player.res}`);
  // 대족장: 스킬을 쓰면 받은 피해를 터뜨린다
  const wc = mk(3, { engravings: { head: hiddenEngId('warchief') } }); const e2 = wc.makeEnemy('slime', wc.player.x + 30, wc.player.y); e2.hp = e2.maxHp = 1e6; wc.enemies.push(e2);
  wc.hid.pay.push([wc.t, 200]); wc.castSkillId('hChiefCall', 0); ok(e2.hp < 1e6 - 300, `피로 쓴 함성: 받은 피해를 되갚는다 (${Math.round(1e6 - e2.hp)})`);
  // 그림자 왕: 나보다 체력이 낮은 적은 쓰러진다
  const wk = mk(3, { engravings: { head: hiddenEngId('shadowKing') } }); wk.enemies.forEach((o) => (o.dead = true));
  const lo2 = wk.makeEnemy('slime', wk.player.x + 80, wk.player.y); lo2.hp = 10; const hi2 = wk.makeEnemy('slime', wk.player.x + 120, wk.player.y); hi2.hp = hi2.maxHp = 1e6; wk.enemies.push(lo2, hi2);
  wk.castSkillId('hShadowHands', 0); for (let i = 0; i < 30; i++) wk.step(idle);
  ok(lo2.dead && !hi2.dead && Math.hypot(hi2.x - wk.player.x, hi2.y - wk.player.y) < 50, '그림자 손: 약한 적은 쓰러지고 센 적은 끌려온다');
  // 천궁: 평타 화살이 튕긴다
  const wr = mk(3, { race: 'elf', engravings: { head: hiddenEngId('skyBow') }, gear: { weapon: 'huntBow' } }); wr.enemies.forEach((o) => (o.dead = true));
  const t1 = wr.makeEnemy('slime', wr.player.x + 50, wr.player.y), t2 = wr.makeEnemy('slime', wr.player.x + 100, wr.player.y); t1.hp = t1.maxHp = t2.hp = t2.maxHp = 1e6; wr.enemies.push(t1, t2);
  for (let i = 0; i < 60 * 2; i++) wr.step({ moveX: 0, moveY: 0, attack: true, aimX: t1.x, aimY: t1.y });
  ok(t2.hp < 1e6, '천궁: 화살이 다른 적에게 튕긴다');
  // 원시의 왕: 벽에 박으면 세다
  // 스승 갈래
  ok(weaponFam({ weaponItem: ITEMS.ironLongsword, wcat: 'blade' }) === 'sword' && weaponFam({ weaponItem: ITEMS.huntBow, wcat: 'bow' }) === 'bow' && weaponFam({ weaponItem: ITEMS.dagger, wcat: 'blade' }) === 'dagger' && weaponFam({ weaponItem: ITEMS.bareHands, wcat: 'fist' }) === 'fist', '무기 → 스승 갈래');
  ok(Object.keys(TEACHERS).length === 8 && Object.values(TEACHERS).every((T) => HIDDEN.some((h) => h.id === T.id && h.kind === 'teacher')), '스승 여덟 · 각인과 맞다');
  ok(climbFeats({ startF: 31, time: 0, oath: {} }, { hid: { boss: true, hits: 3, blocks: 0, other: 3, fightT: 99 }, b: { weaponItem: ITEMS.huntBow, wcat: 'bow', lo: { engravings: { a: 1 }, gear: {} } }, tower: { t: 0 } }, 40, 'lord').includes('teacher:bow'), '40층의 주인: 무기 갈래의 스승');
}

// 9) 시련: 스승과 싸운다 · 체력은 내 공격력에 맞춘다 · 한 대 상한 · 무기를 이해한 공격만 제대로
const { TR } = await import(root + '/sim/teacher.js');
const trialWorld = (fam, gear, lv = 40, str = 40) => {
  const act = C.actOf(40), z = ALL_ZONES.find((x) => x.id === act.zone), map = buildClimbFloor(z, 40404, 40, 'lord');
  const b = computeBuild({ race: 'orc', level: lv, alloc: { str, mag: str }, engravings: {}, gear });
  const w = new World({ build: b, mode: 'field', zone: z, zoneId: z.id, seed: 40404, map });
  w.startTrial(fam); for (let i = 0; i < 60 * 3; i++) w.step(idle);
  return w;
};
const WEAPON = { sword: 'ironLongsword', heavy: 'battleAxe', magic: 'apprenticeStaff', scythe: 'rustySword', dagger: 'dagger', bow: 'huntBow', fist: 'bareHands', spear: 'spear' };
for (const [fam, weapon] of Object.entries(WEAPON)) {
  const w = trialWorld(fam, { weapon }), Tr = w.trial;
  ok(Tr && Tr.bodies.length >= 1 && Tr.s !== 'intro' && Tr.maxHp > 0, `${fam}: 시련이 시작된다 (스승 체력 ${Tr?.maxHp})`);
  const hp0 = Tr.hp; w.damageEnemy(Tr.main, 1e9, 'phys', {});
  ok(hp0 - Tr.hp <= Tr.maxHp * TR.okCap + 1, `${fam}: 아무리 세게 쳐도 한 대에 4%까지 (${Math.round(((hp0 - Tr.hp) / Tr.maxHp) * 100)}%)`);
  // 스승은 자기 각인 스킬을 쓴다
  let sig = false, sent = null;
  for (let i = 0; i < 60 * 12; i++) { w.player.hp = w.d.maxHp; w.step(idle); if (w.events.some((ev) => ev.t === 'text' && /^「/.test(ev.text || ''))) sig = true; w.events.length = 0; }
  ok(sig, `${fam}: 스승이 각인 스킬을 쓴다`);
  // 무작정 붙어 치는 봇: 이기지 못하고 쓰러진다
  const w2 = trialWorld(fam, { weapon });
  for (let i = 0; i < 60 * 90 && !sent; i++) { const live = w2.trial.bodies.filter((b) => !b.dead), m = fam === 'dagger' ? live[Math.floor(i / 40) % live.length] || w2.trial.main : w2.trial.main; w2.step({ moveX: Math.sign(m.x - w2.player.x) * 0.6, moveY: Math.sign(m.y - w2.player.y) * 0.6, attack: true, aimX: m.x, aimY: m.y }); sent = w2.signals.find((s) => s.t === 'trialDone'); w2.events.length = 0; }
  ok(!sent?.ok, `${fam}: 무작정 붙어 치면 넘지 못한다 (스승 체력 ${Math.round((w2.trial.hp / w2.trial.maxHp) * 100)}%)`);
}
{ // 체력은 내 공격력에 맞춘다 (세지면 스승도 세진다)
  const a = trialWorld('sword', { weapon: 'ironLongsword' }, 20, 10), b = trialWorld('sword', { weapon: 'ironLongsword' }, 60, 90);
  ok(b.trial.maxHp > a.trial.maxHp * 2, `스승 체력이 내 공격력을 따라간다 (${a.trial.maxHp} → ${b.trial.maxHp})`);
}
{ // 제대로 든 공격은 크게, 아닌 것은 아주 조금
  const big = 1e9, took = (w, fn) => { const h = w.trial.hp; fn(); return (h - w.trial.hp) / w.trial.maxHp; };
  const ws = trialWorld('sword', { weapon: 'ironLongsword' }); ws.trial.s = 'move'; ok(took(ws, () => ws.damageEnemy(ws.trial.main, big, 'phys', {})) <= TR.badCap + 1e-6, '검: 빈틈이 아니면 0.4%');
  ws.trial.s = 'open'; ok(took(ws, () => ws.damageEnemy(ws.trial.main, big, 'phys', {})) >= TR.okCap - 1e-6, '검: 빈틈에는 4%');
  const wh = trialWorld('heavy', { weapon: 'battleAxe' }), H = wh.trial; let g = 0; for (let i = 0; i < 4; i++) { wh.t += 0.3; g = took(wh, () => wh.damageEnemy(H.main, big, 'phys', {})); } ok(g >= TR.okCap - 1e-6, '도끼: 막기를 부순 뒤 제대로');
  const wg = trialWorld('magic', { weapon: 'apprenticeStaff' }), G = wg.trial; G.s = 'cast'; ok(took(wg, () => wg.damageEnemy(G.main, big, 'phys', {})) <= TR.badCap + 1e-6, '마법: 물리는 조금'); ok(took(wg, () => wg.damageEnemy(G.main, big, 'mag', {})) >= TR.okCap - 1e-6, '마법: 외는 동안 마법은 제대로');
  const wc = trialWorld('scythe', { weapon: 'rustySword' }), S = wc.trial; wc.curTok = 77; took(wc, () => wc.damageEnemy(S.bodies[0], big, 'phys', {})); ok(took(wc, () => wc.damageEnemy(S.bodies[1], big, 'phys', {})) >= TR.okCap - 1e-6, '낫: 한 번에 둘을 베면 제대로'); wc.curTok = null;
  const wd = trialWorld('dagger', { weapon: 'dagger' }), D = wd.trial, fake = D.bodies.find((b) => b !== D.main); ok(took(wd, () => wd.damageEnemy(fake, big, 'phys', {})) === 0 && fake.dead, '단검: 가짜는 사라지고 안 들어간다'); ok(took(wd, () => wd.damageEnemy(D.main, big, 'phys', {})) >= TR.okCap - 1e-6, '단검: 진짜는 제대로');
  const wf = trialWorld('fist', { weapon: 'bareHands' }), F = wf.trial; let last = 0; for (let i = 0; i < 3; i++) { wf.t += 0.3; last = took(wf, () => wf.damageEnemy(F.main, big, 'phys', {})); } ok(last >= TR.okCap - 1e-6, '주먹: 이어진 세 번째부터 제대로');
  const wp = trialWorld('spear', { weapon: 'spear' }), P = wp.trial; P.main.x = wp.player.x + 10; P.main.y = wp.player.y; ok(took(wp, () => wp.damageEnemy(P.main, big, 'phys', {})) <= TR.badCap + 1e-6, '창: 가까우면 조금'); P.main.x = wp.player.x + wp.b.weapon.range * 0.8 + P.main.r; ok(took(wp, () => wp.damageEnemy(P.main, big, 'phys', {})) >= TR.okCap - 1e-6, '창: 창끝 거리는 제대로');
  const wq = trialWorld('bow', { weapon: 'huntBow' }), B = wq.trial; B.main.x = wq.player.x + 120; B.main.y = wq.player.y; ok(took(wq, () => wq.damageEnemy(B.main, big, 'phys', {})) >= TR.okCap - 1e-6, '활: 멀리서 쏜 것은 제대로');
  // 이기기 · 지기
  const ww = trialWorld('sword', { weapon: 'ironLongsword' }); for (let i = 0; i < 30 && !ww.trial.done; i++) { ww.trial.s = 'open'; ww.damageEnemy(ww.trial.main, big, 'phys', {}); }
  for (let i = 0; i < 60 * 3; i++) ww.step(idle); ok(ww.signals.some((s) => s.t === 'trialDone' && s.ok), '스승의 체력이 다하면 시련을 넘는다');
  const wl = trialWorld('scythe', { weapon: 'rustySword' }); wl.trial.hp = 1; wl.curTok = 5; wl.damageEnemy(wl.trial.bodies[0], big, 'phys', {}); wl.damageEnemy(wl.trial.bodies[1], big, 'phys', {}); wl.curTok = null;
  ok(!wl.trial.done && wl.trial.revived && wl.trial.hp > 0, '첫 번째 망자: 한 번은 죽음을 거부한다');
  const wx = trialWorld('sword', { weapon: 'ironLongsword' }); wx.player.hp = 0; wx.checkDeath(); for (let i = 0; i < 60 * 3; i++) wx.step(idle);
  ok(wx.state === 'play' && wx.signals.some((s) => s.t === 'trialDone' && !s.ok), '내가 쓰러지면 실패 · 죽지는 않는다');
}
// 10) 그림자 · 전설 몬스터
{
  setHiddenSource(() => ({}));
  const w = ready(mk(30)); w.rng.chance = () => true; const boss = w.climb.boss; w.killEnemy(boss);
  const sh = w.enemies.find((e) => e.defId === 'myShadow' && !e.dead);
  ok(sh && sh.raceLook === w.b.race && sh.climb, '30층 주인: 나의 그림자가 나온다');
  if (sh) { w.killEnemy(sh); ok(w.signals.some((s) => s.t === 'hiddenFeat' && s.id === 'doppel'), '나의 그림자를 쓰러뜨리면 도플갱어'); }
  const w2 = ready(mk(30)); w2.rng.chance = () => true; setHiddenSource(() => ({ doppel: 1 })); w2.killEnemy(w2.climb.boss); ok(!w2.enemies.some((e) => e.defId === 'myShadow'), '이미 얻었으면 그림자는 안 나온다'); setHiddenSource(() => ({}));
}

// 11) 전설 몬스터: 조건이 겹칠 때만 (바깥 세계)
{
  const { buildOverworld, WORLD_ZONE, BIOME_LIST } = await import(root + '/data/maps/overworld.js');
  const map = buildOverworld(WORLD_ZONE);
  const b = computeBuild({ race: 'orc', level: 40, alloc: { str: 40 }, engravings: {}, gear: { weapon: 'rustySword' } });
  const tileOf = (bid) => { const bi = BIOME_LIST.findIndex((x) => x.id === bid); for (let k = 0; k < map.tiles.length; k += 7) if (map.biome[k] === bi && map.tiles[k] === 0) return { x: (k % map.tw) * 16 + 8, y: Math.floor(k / map.tw) * 16 + 8 }; };
  for (const [legend, biome, min, still] of [['frostSteed', 'snow', 300, 61], ['bellWraith', 'graveyard', 10, 0]]) {
    const clock = { day: 1, min }, w = new World({ build: b, mode: 'field', zone: WORLD_ZONE, zoneId: 'world', seed: 7, map, clock });
    const at = tileOf(biome); ok(!!at, `${biome} 땅을 찾았다`); if (!at) continue;
    w.player.x = at.x; w.player.y = at.y; w.player.stillT = still;
    w.enemies.forEach((e) => (e.dead = true));
    for (let i = 0; i < 5; i++) { w.player.hp = w.d.maxHp; w.player.stillT = still; w.step(idle); }
    const e = w.enemies.find((o) => o.legend === legend && !o.dead);
    ok(!!e, `${legend}: 조건이 맞으면 나온다`);
    if (e) { w.killEnemy(e); ok(w.signals.some((s) => s.t === 'hiddenFeat' && s.id === legend), `${legend}: 쓰러뜨리면 얻는다`); }
    const w2 = new World({ build: b, mode: 'field', zone: WORLD_ZONE, zoneId: 'world', seed: 7, map, clock: { day: 1, min: 720 } });
    w2.player.x = at.x; w2.player.y = at.y; w2.player.stillT = 99; for (let i = 0; i < 5; i++) w2.step(idle);
    ok(!w2.enemies.some((o) => o.legend), `${legend}: 한낮에는 안 나온다`);
  }
}

console.log(bad ? `${bad} FAIL` : 'ALL OK');
process.exit(bad ? 1 : 0);

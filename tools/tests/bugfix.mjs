// 고친 버그의 재현 시험 (게임 버그 수정 갈래 · 2026-11-23): 한 번 고친 것이 다시 깨지지 않게
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { buildClimbFloor } = await import(root + '/sim/climbmap.js');
const { ALL_ZONES } = await import(root + '/data/monsters.js');
const { TEACHER_SKILLS } = await import(root + '/sim/teacherskills.js');
const { hiddenEngId } = await import(root + '/data/hidden.js');
const C = await import(root + '/data/climb.js');
let bad = 0;
const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } };
const idle = { moveX: 0, moveY: 0, attack: false };

const trialWorld = (fam, gear, lv = 40, engravings = {}) => {
  const act = C.actOf(40), z = ALL_ZONES.find((x) => x.id === act.zone), map = buildClimbFloor(z, 40404, 40, 'lord');
  const b = computeBuild({ race: 'orc', level: lv, alloc: { str: 40, mag: 40 }, engravings, gear });
  const w = new World({ build: b, mode: 'field', zone: z, zoneId: z.id, seed: 40404, map });
  w.startTrial(fam); for (let i = 0; i < 60 * 3; i++) w.step(idle);
  return w;
};

// 1) 스승의 스킬 사이 간격: 스킬을 하나 쓰면 다음 스킬까지 쉰다 (주석에 묻혀 Tr.skT 가 다시 차지 않던 버그)
{
  const w = trialWorld('sword', { weapon: 'ironLongsword' }), Tr = w.trial;
  Tr.s = 'move'; Tr.skT = 0; Tr.skCd = {};
  const used = w.trialUseSkill(30);
  ok(used && Tr.skT > 0.3, `스승이 스킬을 쓰면 다음 스킬까지 쉰다 (skT ${Tr.skT?.toFixed?.(2)})`);
}
// 2) 시체 폭발은 시체가 있을 때만 고른다 (S 가 need 를 버리던 버그)
{
  const cb = TEACHER_SKILLS.scythe.find((s) => s.id === 'corpseBlast');
  ok(typeof cb?.need === 'function', '시체 폭발: 조건(need)이 붙어 있다');
  const w = trialWorld('scythe', { weapon: 'rustySword' }), Tr = w.trial;
  let picked = 0;
  for (let i = 0; i < 200; i++) { Tr.s = 'move'; Tr.skT = 0; Tr.skCd = {}; Tr.corpses = []; for (const s of TEACHER_SKILLS.scythe) if (s.id !== 'corpseBlast') Tr.skCd[s.id] = w.t + 99; Tr.skCd.weapon = w.t + 99; if (w.trialUseSkill(30)) picked++; }
  ok(picked === 0, `시체가 없으면 시체 폭발을 쓰지 않는다 (${picked}번)`);
}
// 3) 대마도사: 주문을 외기 시작하면 멈추고 외는 시각을 적는다 (주석에 묻혀 castT0 · 멈춤 · 말이 빠지던 버그)
{
  const w = trialWorld('magic', { weapon: 'apprenticeStaff' }), Tr = w.trial;
  Tr.s = 'move'; Tr.t = 0; Tr.skT = 99; Tr.sigT = 99; Tr.dashCd = 99; Tr.heals = 9;
  let said = false;
  for (let i = 0; i < 10 && Tr.s !== 'cast'; i++) { w.step(idle); if (w.events.some((e) => e.t === 'text' && /주문을 왼다/.test(e.text))) said = true; w.events.length = 0; }
  ok(Tr.s === 'cast' && Tr.castT0 != null && said, `대마도사: 주문을 외기 시작한다 (s ${Tr.s} · castT0 ${Tr.castT0} · 말 ${said})`);
}
// 4) 무영(그림자 없는 발): 스승의 방에서도 맞으면 풀린다
{
  const w = trialWorld('sword', { weapon: 'ironLongsword' }, 40, { head: hiddenEngId('noShadow') }), p = w.player;
  p.buffs.hNoShadow = { t: 9999, max: 9999, mods: {}, name: '무영' };
  w.hidHurt(false, 10);
  ok(!p.buffs.hNoShadow, '스승의 방에서 맞으면 무영이 풀린다');
}

console.log(bad ? `${bad} FAIL` : 'ALL OK');
process.exitCode = bad ? 1 : 0;

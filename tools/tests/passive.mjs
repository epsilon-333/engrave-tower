// 패시브 각인 (data/passives.js): 수 60~90 · 스킬 없음 · 몰아치기 누적/끊김 · 일격필살 270% · 면역 · 지형 · 표식 crit/scale/selfStatus
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { ENGRAVINGS } = await import(root + '/data/engravings.js');
const { ENGRAVING_SKILLS, SKILLS } = await import(root + '/data/skills.js');
const { ZONES } = await import(root + '/data/monsters.js');
const P = await import(root + '/data/passives.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } };

// 1) 수 · 스킬 없음 · 재료
const po = Object.entries(ENGRAVINGS).filter(([, e]) => e.passiveOnly);
ok(po.length >= 60 && po.length <= 90, `패시브 각인 60~90 (${po.length})`);
for (const [id, e] of po) {
  ok(!ENGRAVING_SKILLS[id], `${e.name}: 스킬 없음`);
  ok(e.recipe && Object.keys(e.recipe).length >= 2, `${e.name}: 재료`);
  ok(e.grade >= 1 && e.grade <= 5 && e.load > 0, `${e.name}: 등급 · 부하`);
}
const held = new Set(Object.values(ENGRAVING_SKILLS));
for (const id of P.PASSIVE_CONVERT) ok(ENGRAVINGS[id], `전환 각인 ${id} 있음`);
ok(held.size > 150, `스킬이 사라지지 않는다 (${held.size}종)`);
for (const id of P.PASSIVE_NEW_IDS) ok(ENGRAVINGS[id]?.passiveOnly && /\d|면역|걸리지|느려지지/.test(ENGRAVINGS[id].effects.map((x) => x.text).join(' ')), `${id}: 새 패시브 · 효과 글`);

// 빌드: 스킬 칸에 패시브 각인 → 뒤 스킬이 앞으로 (빈 칸 없음)
const sk = Object.keys(ENGRAVING_SKILLS).find((id) => ENGRAVINGS[id] && !ENGRAVINGS[id].hidden && SKILLS[ENGRAVING_SKILLS[id]] && !SKILLS[ENGRAVING_SKILLS[id]].ult);
const mk = (eng = {}, extra = {}) => computeBuild({ race: 'knight', level: 30, alloc: { str: 30, vit: 20 }, engravings: eng, gear: { weapon: 'rustySword' }, ...extra });
{ const b = mk({ head: 'pBreeze', arm: sk }); ok(b.skills[0] && !b.skills[1], `스킬 칸 당김 (${b.skills})`); }
{ const a = mk(), b = mk({ back: 'pBreeze' }); ok(b.derived.dodge - a.derived.dodge >= 0.1 - 1e-9, '바람결: 회피 +10%'); }
{ const a = mk(), b = mk({ back: 'pTrain_agi' }); ok(b.stats.agi - a.stats.agi >= 8, `민첩 단련 +8 (${b.stats.agi - a.stats.agi})`); }
{ const b = mk({ back: 'pOneShot' }), a = mk(); ok(Math.abs(b.derived.critDmg - a.derived.critDmg - 1.2) < 1e-9 && Math.abs(b.derived.crit - a.derived.crit * 0.5) < 1e-9, `일격필살: 치명타 ½ · 피해 +120%p (${a.derived.critDmg}→${b.derived.critDmg})`); }
{ const b0 = computeBuild({ race: 'knight', level: 1, alloc: {}, engravings: { back: 'pOneShot' }, gear: { weapon: 'rustySword' } }); ok(Math.abs(b0.derived.critDmg - 2.7) < 0.05, `일격필살: 기본 약 150% → 270% (감각 몫 조금) (${b0.derived.critDmg})`); }
{ const a = mk(), b = mk({ back: 'ironHide' }); ok(b.derived.dmgTakenMul < a.derived.dmgTakenMul * (1 - 0.03 * 1.29), '전환 각인: 수치 ×1.3'); }

// 세계
const W = (eng, extra) => { const w = new World({ build: mk(eng, extra), mode: 'field', zoneId: ZONES[0].id, seed: 4242 }); for (const o of w.enemies) { o.dead = true; o.hp = 0; } w.enemies = []; w.player.invuln = 0; w.d.dodge = 0; return w; };
const spawn = (w, dx, dy = 0, id = 'goblin') => { const e = w.makeEnemy(id, w.player.x + dx, w.player.y + dy, { noAffix: true }); e.state = 'chase'; e.mvCd = 99; e.maxHp = e.hp = 1e9; e.pres = e.mres = 0; w.enemies.push(e); return e; };
const hit = (w, e, opt = { src: 'attack' }) => { const h = e.hp; w.damageEnemy(e, 100, 'true', opt); return h - e.hp; };

// 몰아치기
{
  const w = W({ back: 'pRelentless' }), e = spawn(w, 20), d = [];
  for (let i = 0; i < 5; i++) { w.t += 0.3; d.push(hit(w, e)); }
  ok(d.every((v, i) => Math.abs(v / d[0] - (1 + 0.1 * i)) < 1e-6), `몰아치기: 맞힐 때마다 +10% (${d.map((v) => (v / d[0]).toFixed(2))})`);
  w.t += 1.3; ok(Math.abs(hit(w, e) / d[0] - 1) < 1e-6, '몰아치기: 1.2초가 지나면 0');
  w.t += 0.3; hit(w, e); w.relentMiss(); w.t += 0.3; ok(Math.abs(hit(w, e) / d[0] - 1) < 1e-6, '몰아치기: 빗나가면 0');
  for (let i = 0; i < 25; i++) { w.t += 0.1; hit(w, e); } w.t += 0.1; ok(hit(w, e) / d[0] > 3.4, '몰아치기: 상한 없음');
}
// 저격수: 거리 200에서 +40% · 0에서 0
{ const w = W({ back: 'pSniper' }), w0 = W({}); const far = hit(w, spawn(w, 250)) / hit(w0, spawn(w0, 250)), mid = hit(w, spawn(w, 100)) / hit(w0, spawn(w0, 100)); ok(Math.abs(far - 1.4) < 1e-6 && Math.abs(mid - 1.2) < 1e-6, `저격수 (${far.toFixed(2)} · ${mid.toFixed(2)})`); }
// 피의 대가
{ const w = W({ back: 'pBloodPrice' }), w0 = W({}); w.player.hp = w.d.maxHp * 0.5; w0.player.hp = w0.d.maxHp * 0.5; const r = hit(w, spawn(w, 20)) / hit(w0, spawn(w0, 20)); ok(Math.abs(r - 1.2) < 1e-6, `피의 대가: 체력 50% → +20% (${r.toFixed(2)})`); }
// 일격필살: 실제 치명타 270%
{ const w = W({ back: 'pOneShot' }), e = spawn(w, 20); w.rng.chance = () => true; const h = e.hp; w.hitEnemy(e, 100, 'true', false); const w0 = W({}), e0 = spawn(w0, 20); w0.rng.chance = () => false; const h0 = e0.hp; w0.hitEnemy(e0, 100, 'true', false); ok(Math.abs((h - e.hp) / (h0 - e0.hp) - w.d.critDmg) < 1e-6 && w.d.critDmg >= 2.7, `일격필살 치명타 ×${((h - e.hp) / (h0 - e0.hp)).toFixed(2)}`); }
// 면역
for (const k of ['burn', 'poison', 'chill', 'bleed']) { const w = W({ back: 'pImmune_' + k }); w.applyPlayerStatus(k, 50); ok(!w.player.st[k], `${k} 면역`); const w0 = W({}); w0.applyPlayerStatus(k, 50); ok(w0.player.st[k] || w0.b.race === 'undead', `${k}: 면역 없으면 걸린다`); }
{ const w = W({ back: 'pImmune_stun' }); w.ccPlayer({ stun: 1 }); ok(!(w.player.ccT > 0), '기절 면역'); const w0 = W({}); w0.ccPlayer({ stun: 1 }); ok(w0.player.ccT > 0, '기절: 면역 없으면 걸린다'); }
{ const w = W({ back: 'pImmune_slow' }); w.ccPlayer({ slow: 1 }); ok(!(w.player.slowT > 0), '둔화 면역'); }
// 무거운 몸
{ const w = W({ back: 'pHeavyBody' }), w0 = W({}); for (const x of [w, w0]) { x.player.slowT = 2; x.player.hp = 1e6; } const h = w.player.hp; w.hurtPlayer(100, 'phys', null, { direct: true }); const h0 = w0.player.hp; w0.hurtPlayer(100, 'phys', null, { direct: true }); ok(Math.abs((h - w.player.hp) / (h0 - w0.player.hp) - 0.75) < 1e-6, '무거운 몸: -25%'); }
// 회피 반격
{ const w = W({ back: 'pDodgeCounter' }); w.d.dodge = 1; w.hurtPlayer(10, 'phys', null, {}); ok(w.player.counterCritT > w.t + 1.9, '회피 반격: 2초 치명타 확정'); }
// 독 퍼뜨리기
{ const w = W({ back: 'pPoisonCarry' }), a = spawn(w, 20), b = spawn(w, 60); a.hp = a.maxHp = 10; w.applyStatus(a, 'poison', 4); w.damageEnemy(a, 100, 'true', {}); ok(a.dead && b.st.poison?.n >= 4, `독 퍼뜨리기 (${b.st.poison?.n})`); }
// 처치의 숨 · 절약
{ const w = W({ back: 'pKillBreath' }), a = spawn(w, 20); a.hp = a.maxHp = 10; w.player.res = 0; w.damageEnemy(a, 100, 'true', {}); ok(w.player.res >= 9.9, `처치의 숨: 자원 +10 (${w.player.res})`); }
{ ok(Math.abs(mk({ back: 'pThrift' }).derived.costMul - 0.85) < 1e-9, '절약: 소모 -15%'); }
// 지형: 늪 · 용암 · 아가미 · 깃털 발 (플래그가 서고 계산에 쓰인다)
for (const [id, fl] of [['pBogWalk', 'bogWalk'], ['pFireFeet', 'lavaWalk'], ['pGills', 'gills'], ['pFeather', 'featherFall']]) ok(mk({ back: id }).flags.has(fl), `${id}: ${fl}`);
{ // 아가미: 물속 숨 최대 2배
  const w = W({ back: 'pGills' }), w0 = W({}); for (const x of [w, w0]) { x.map.underwater = true; x.player.breath = null; x.updateWater({}); }
  ok(Math.abs(w.player.breathMax / w0.player.breathMax - 2) < 1e-6, `아가미: 숨 2배 (${w0.player.breathMax}→${w.player.breathMax})`);
  for (const x of [w, w0]) { x.player.breath = 0; x.player.drownT = 0; x.player.hp = x.d.maxHp; x.updateWater({}); }
  ok(Math.abs((w.d.maxHp - w.player.hp) / (w0.d.maxHp - w0.player.hp) - 0.5) < 1e-6, '아가미: 숨 막힘 피해 절반');
}
{ // 용암 · 늪 (지형 효과): 액체 위에 세운다
  const T = (await import(root + '/sim/mapgen.js')).T_LIQUID;
  const run = (id, liquid) => { const w = W(id ? { back: id } : {}); w.zone = { ...(w.zone || {}), liquid, floor: 10 }; w.map.outdoor = false; w.tileAt = () => T; w.player.liquidT = 0; w.player.hp = w.d.maxHp; w.player.invuln = 0; w.rng.chance = () => true; w.step({ moveX: 1, moveY: 0, aimX: w.player.x + 10, aimY: w.player.y }); return w; };
  {
    const a = run('pFireFeet', 'lava'), b = run(null, 'lava');
    ok(a.d.maxHp - a.player.hp < (b.d.maxHp - b.player.hp) * 0.31 + 0.01 && !a.player.st.burn && b.player.st.burn, `불의 발: 용암 -70% · 화상 없음 (${(a.d.maxHp - a.player.hp).toFixed(1)} / ${(b.d.maxHp - b.player.hp).toFixed(1)})`);
    const c = run('pBogWalk', 'bog'), d = run(null, 'bog'); ok(!c.player.st.poison && d.player.st.poison, '늪 걸음: 늪 독 없음');
  }
}
// 표식: crit · scale · selfStatus
{
  const w = W({}), e = spawn(w, 20); w.rng.chance = () => false;
  const def = { name: '시험', marks: ['crit', 'scale:str'], scale: 'phys' }, ctx = { def, bonus: 1, atk: 100, resMul: 1 };
  const h = e.hp; w.skillHit(e, { mul: 1 }, ctx); const dm = h - e.hp;
  const e2 = spawn(w, 20); const h2 = e2.hp; w.skillHit(e2, { mul: 1 }, { ...ctx, def: { name: '시험', scale: 'phys' } }); const d0 = h2 - e2.hp;
  ok(Math.abs(dm / d0 - w.d.critDmg * (1 + 0.01 * w.s.str)) < 1e-6, `표식 crit · scale:str (×${(dm / d0).toFixed(2)} · 근력 ${w.s.str})`);
  w.selfMarkStatus({ marks: ['selfStatus:burn', 'selfStatus:slow'] }); ok(w.player.st.burn && w.player.slowT > 0, '표식 selfStatus: 나도 화상 · 둔화');
  const wi = W({ back: 'pImmune_burn' }); wi.selfMarkStatus({ marks: ['selfStatus:burn'] }); ok(!wi.player.st.burn, '표식 selfStatus: 면역이면 안 걸린다');
  const L = P.markLinks(def); ok(L.ids.includes('pOneShot') && L.ids.includes('pTrain_str'), '표식 🔗: 이어지는 패시브');
}
console.log(fails ? `${fails} FAIL` : 'passive ALL OK');
process.exitCode = fails ? 1 : 0;

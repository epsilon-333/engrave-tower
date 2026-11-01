// 연쇄 · 잠깐 스탯: 효과가 다른 효과를 깨우고(몇 단계든), 스킬이 올린 스탯으로 각성 문턱이 싸우는 중에 켜지는지
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
let ok = true;
// 1) 잠깐 스탯: 전투 함성(근력 +20) → 근력 30 문턱(단련)이 켜진다
{
  const lo = { race: 'orc', cls: 'berserker', level: 10, alloc: { str: 2 }, engravings: {}, gear: { weapon: 'handAxe' }, skills: ['warCry'] };
  const w = new World({ build: computeBuild(lo), mode: 'field', zoneId: 'world', seed: 7 }), p = w.player;
  const s0 = w.s.str, on0 = w.b.awakenings.filter((a) => a.on).length;
  p.res = 100; w.castSkillId('warCry', 0);
  const inp = { moveX: 0, moveY: 0, aimX: p.x + 50, aimY: p.y, attack: false };
  for (let i = 0; i < 40; i++) w.step(inp);
  const s1 = w.s.str, on1 = w.b.awakenings.filter((a) => a.on).length;
  console.log('근력', s0, '→', s1, '· 켜진 각성', on0, '→', on1);
  if (!(s1 >= s0 + 19)) { ok = false; console.log('FAIL 잠깐 스탯이 오르지 않음'); }
  for (let i = 0; i < 60 * 9; i++) w.step(inp);
  console.log('9초 뒤 근력', w.s.str); if (w.s.str !== s0) { ok = false; console.log('FAIL 잠깐 스탯이 돌아오지 않음'); }
}
// 2) 연쇄: 일격에 맞은 적이 「맞힘」 효과를 다시 깨운다 → 단계 제한 없이 이어진다
{
  const lo = { race: 'assassin', cls: 'shadowblade', level: 30, alloc: { agi: 20 }, engravings: {}, runEng: [{ id: 'm_poisonSpider', lv: 5 }, { id: 'm_vineSpirit', lv: 5 }, { id: 'm_iceGolem', lv: 5 }], gear: { weapon: 'dagger' } };
  const w = new World({ build: computeBuild(lo), mode: 'field', zoneId: 'world', seed: 3 }), p = w.player;
  for (const tr of w.b.triggers.hit) tr.chance = 1; // 시험: 확률 1
  w.enemies.slice(0, 12).forEach((e, i) => { e.x = p.x + 20 + (i % 4) * 10; e.y = p.y - 15 + Math.floor(i / 4) * 15; e.hp = e.maxHp = 1e9; });
  const inp = { moveX: 0, moveY: 0, aimX: p.x + 40, aimY: p.y, attack: true, autoAim: true };
  let maxDepth = 0; const t0 = Date.now();
  for (let i = 0; i < 600; i++) { w.step(inp); for (const ev of w.events) { const m = /연쇄 ×(\d+)/.exec(ev.text || ''); if (m) maxDepth = Math.max(maxDepth, +m[1]); } w.events.length = 0; }
  console.log('가장 긴 연쇄', maxDepth, '· 10초 흉내 시간', Date.now() - t0, 'ms');
  if (maxDepth < 4) { ok = false; console.log('FAIL 연쇄가 이어지지 않음'); }
}
console.log(ok ? 'ALL OK' : 'FAIL');

// 고친 버그의 재현 시험 (2026-11-25 · 상시 반사 · 소환체 · 각인 빼기 · 점프 · 폭발 · 펫)
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { MONSTERS, ZONES } = await import(root + '/data/monsters.js');
let bad = 0;
const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } };
const idle = { moveX: 0, moveY: 0, attack: false };
const mkWorld = (eng = {}, extra = {}) => new World({ build: computeBuild({ race: 'orc', level: 30, alloc: { str: 30 }, engravings: eng, ...extra }), mode: 'field', zoneId: ZONES[0].id, seed: 7 });

// 1) 늘 켜져 있는 반사가 없다: 반사는 예고 있는 기술(반사 방패 · 가시 세움)만
{
  const always = Object.entries(MONSTERS).filter(([, d]) => d.reflect).map(([k]) => k);
  ok(!always.length, `상시 반사 몬스터가 없다 (${always.join(',')})`);
  const w = mkWorld(); for (let i = 0; i < 30; i++) w.step(idle);
  const e = w.makeEnemy('mirrorKnight', w.player.x + 20, w.player.y); w.enemies.push(e);
  const hp0 = w.player.hp; w.damageEnemy(e, 100, 'phys', { src: 'attack' });
  ok(w.player.hp === hp0, '거울 기사를 때려도 되돌아오지 않는다');
}

if (bad) { console.log(`${bad}개 실패`); process.exitCode = 1; } else console.log('ALL OK');

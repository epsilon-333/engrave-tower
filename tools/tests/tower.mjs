// 각인의 탑: 층마다 몬스터가 얼마나 세지는지 · 보스 층 계단 잠금 · 클리어 신호와 등급
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { generateField } = await import(root + '/sim/mapgen.js');
const { ZONES } = await import(root + '/data/monsters.js');
const T = await import(root + '/data/tower.js');
const b = computeBuild({ race: 'knight', cls: 'greatsword', level: 20, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: 'steelGreatsword' } });
for (const f of [1, 5, 10, 20, 30, 40, 50]) {
  const zid = T.towerZoneId(f), z = ZONES.find((x) => x.id === zid);
  const w = new World({ build: b, mode: 'field', zoneId: zid, seed: 11 + f, map: generateField(z, 11 + f, Math.floor(f / 6), T.towerSize(f)), tower: { f } });
  const e = w.enemies.find((x) => !x.lair) || w.enemies[0];
  const stairs = w.objects.find((o) => o.kind === 'stairs');
  let locked = '-';
  if (stairs) {
    w.interact?.(stairs) ?? w.useObject?.(stairs);
    locked = w.signals.some((s) => s.t === 'towerClear') ? '열림' : '잠김';
    if (w.tower.boss) { w.tower.boss.dead = true; w.signals.length = 0; w.interact?.(stairs) ?? w.useObject?.(stairs); locked += w.signals.some((s) => s.t === 'towerClear') ? ' → 수호자 처치 후 열림' : ' → 여전히 잠김'; }
  }
  console.log(`${String(f).padStart(2)}층 ${zid.padEnd(6)} 맵 ${w.tw}×${w.th} 적 ${w.enemies.length} · 보통 몹 체력 ${Math.round(e.maxHp)} 공격 ${Math.round(e.atk)} · 수호자 ${w.tower.boss ? Math.round(w.tower.boss.maxHp) : '없음'} · 계단 ${locked}`);
}
for (const [time, hurt] of [[40, 10], [90, 60], [150, 200], [400, 600]]) console.log(`10층 ${time}초 · 피해 ${hurt}/200 → ${T.towerGrade({ time, hurt, maxHp: 200, f: 10 })}`);
console.log('다시 시작할 층 (최고 23층):', T.towerStarts(23).join(', '));

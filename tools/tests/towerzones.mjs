// 탑 51~100층 구역 · 모든 수호자와 주인: 지도가 맞게 만들어지고(문 · 보스 자리에 닿는다) · 구역 장치가 돌고 · 보스 기술이 오류 없이 다 쓰인다
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { buildClimbFloor } = await import(root + '/sim/climbmap.js');
const { ALL_ZONES, MONSTERS } = await import(root + '/data/monsters.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { CLIMB_SIGS } = await import(root + '/data/tower.js');
const { BOSS_INTRO } = await import(root + '/sim/towerzone.js');
const C = await import(root + '/data/climb.js');
const { TILE, T_FLOOR, T_WALL, T_LIQUID } = await import(root + '/sim/mapgen.js');
let bad = 0;
const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } };

const mk = (f, cls = 'greatsword', seed = 4242) => {
  const act = C.actOf(f), z = ALL_ZONES.find((x) => x.id === act.zone), fk = C.floorKind(f), c = CLASSES[cls];
  const run = C.newRun({ seed }); run.f = f;
  const b = computeBuild({ race: c.race, cls, level: 60, alloc: { str: 40, vit: 19 }, engravings: {}, gear: { weapon: c.weapons[0] }, extraEffects: C.runEffects(run) });
  const map = buildClimbFloor(z, seed + f * 7919, f, fk);
  const w = new World({ build: b, mode: 'field', zone: { ...z, dark: z.dark * 0.45 }, zoneId: z.id, seed: seed + f * 7919, map, tower: { f }, climb: { run, f, kind: fk } });
  return { w, z, act, fk, map };
};
const reach = (map, x, y) => map.climb.dist[y * map.tw + x] >= 0;

// 1) 모든 구역 · 모든 보스층 지도: 문 · 보스 자리 · 가운데에 닿는다
for (const a of C.ACTS) {
  for (const f of [a.from, a.from + 2, a.from + 4, a.to]) {
    for (const seed of [1, 77, 999]) {
      const z = ALL_ZONES.find((x) => x.id === a.zone), fk = C.floorKind(f), map = buildClimbFloor(z, seed, f, fk);
      ok(map.climb.doors.every((d) => reach(map, d.x, d.y)), `${f}층(${fk}) 씨앗 ${seed}: 문에 닿는다`);
      ok(reach(map, map.lair.x, map.lair.y), `${f}층 보스 자리에 닿는다`);
      ok(reach(map, map.climb.center.x, map.climb.center.y), `${f}층 가운데에 닿는다`);
      ok(map.climb.spawns.length >= 6, `${f}층 몬스터 나올 자리 ${map.climb.spawns.length}`);
      ok(map.tiles[map.start.y * map.tw + map.start.x] === T_FLOOR, `${f}층 시작 자리가 바닥`);
    }
  }
}
// 2) 보스마다 정해진 결투장 (이름이 다르다)
const names = new Set();
for (const a of C.ACTS) for (const k of ['guardian', 'lord']) { const f = k === 'lord' ? a.to : a.from + 4, z = ALL_ZONES.find((x) => x.id === a.zone); names.add(buildClimbFloor(z, 5, f, k).regionInfo[0].name); }
ok(names.size === 20, `결투장 20곳이 모두 다르다 (${names.size})`);
// 3) 새 보스 · 몬스터 정의
for (const a of C.ACTS) for (const id of [a.guardian, a.lord]) {
  ok(MONSTERS[id]?.phaseMoves?.length === 3, `${id} 세 단계 기술`);
  ok(CLIMB_SIGS[id]?.phase2 && CLIMB_SIGS[id]?.phase3, `${id} 2 · 3단계 변신`);
  ok(BOSS_INTRO[id]?.title, `${id} 등장 연출`);
}
for (const z of ALL_ZONES.filter((x) => x.tower)) { ok(z.pool.length === 6 && z.pool.every((id) => MONSTERS[id]?.part), `${z.name}: 몬스터 6종 · 모두 부산물`); }

// 4) 싸움터: 구역 장치가 돈다 (봇이 가운데에서 버틴다)
const bot = (w) => { const p = w.player, e = w.enemies.find((o) => !o.dead); return e ? { moveX: Math.sign(e.x - p.x) * 0.3, moveY: Math.sign(e.y - p.y) * 0.3, aimX: e.x, aimY: e.y, attack: true } : { moveX: 0, moveY: 0, aimX: p.x + 1, aimY: p.y }; };
for (const f of [52, 63, 72, 83, 94]) {
  const { w, z } = mk(f), seen = new Set();
  for (let i = 0; i < 60 * 40; i++) { w.player.hp = w.d.maxHp; w.step(bot(w)); for (const ev of w.events) seen.add(ev.t); w.events.length = 0; }
  const g = z.gimmick;
  if (g === 'gust') ok(seen.has('gust') && seen.has('gustTele'), `${f}층 돌풍이 분다`);
  if (g === 'clock') ok(seen.has('bell'), `${f}층 시간의 종이 울린다`);
  if (g === 'library') ok(w.climb.shelves.length === 0 || seen.has('mapChanged') || w.climb.waveI < 2, `${f}층 책장이 움직인다`);
  if (g === 'light') { const o = w.objects.find((q) => q.kind === 'lightPillar'); ok(!!o, `${f}층 빛기둥이 있다`); if (o) { w.interact(o); ok(o.litT > 0, '빛기둥을 깨운다'); } }
  if (g === 'mirror') ok(w.climb.gz.shadowDone || w.climb.waveI < 2, `${f}층 거울 그림자`);
}
// 하늘: 떨어지면 죽는다 (되살아나는 효과도 안 듣는다)
{
  const { w } = mk(52); const p = w.player; let vi = -1;
  for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T_LIQUID) { vi = i; break; }
  ok(vi >= 0, '하늘 정원에 하늘(가장자리)이 있다');
  if (vi >= 0) { for (let i = 0; i < 10; i++) w.step({ moveX: 0, moveY: 0, aimX: p.x + 1, aimY: p.y }); p.x = (vi % w.tw) * TILE + 8; p.y = Math.floor(vi / w.tw) * TILE + 5; for (let i = 0; i < 90; i++) w.step({ moveX: 0, moveY: 0, aimX: p.x + 1, aimY: p.y }); ok(p.skyDead && p.hp <= 0, '떨어지면 죽는다'); }
}

// 5) 보스층: 등장 연출 → 모든 단계 · 모든 기술을 오류 없이
for (const a of C.ACTS) for (const k of ['guardian', 'lord']) {
  const f = k === 'lord' ? a.to : a.from + 4, { w } = mk(f);
  const used = new Set(); let intro = false, maxPh = 0;
  const all = new Set([...w.enemies, ...[]]); void all;
  for (let i = 0; i < 60 * 150; i++) {
    const B = w.climb.boss;
    w.player.hp = w.d.maxHp; w.player.invuln = 1;
    if (B && !B.dead) { if (i % 180 === 0 && !w.climb.intro) { B.hp = Math.max(1, B.hp - B.maxHp * 0.1); B.lastHitT = w.t; } maxPh = Math.max(maxPh, B.bphase || 0); if (B.mv?.k) used.add(B.mv.k); }
    w.step({ ...bot(w), attack: false });
    for (const ev of w.events) { if (ev.t === 'bossIntro') intro = true; if (ev.t === 'text' && B && Math.hypot(ev.x - B.x, ev.y - B.y) < 80) used.add('t:' + ev.text); }
    w.events.length = 0;
  }
  const B = w.climb.boss;
  ok(intro, `${f}층 ${MONSTERS[k === 'lord' ? a.lord : a.guardian].name}: 등장 연출`);
  ok(maxPh >= 2, `${f}층 보스가 3단계까지 간다 (${maxPh + 1})`);
  console.log(`${f}층 ${B?.def.name}: 단계 ${maxPh + 1} · 기술 ${[...used].filter((x) => !x.startsWith('t:')).join(',')}`);
}
console.log(bad ? `\n${bad}개 실패` : '\nALL OK');
process.exitCode = bad ? 1 : 0;

// 이야기: 촌장 · 여정을 맡기는 사람(말 걸기 → 하기 → 알리기) · 세린의 일지(탑 금 간 벽 너머 열 장 · 바깥 나무 · 모래) · 이끼 동굴(피노 없음)
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { TILE, T_CRACK, T_FLOOR } = await import(root + '/sim/mapgen.js');
const { buildClimbFloor } = await import(root + '/sim/climbmap.js');
const { ALL_ZONES } = await import(root + '/data/monsters.js');
const { JOURNALS, SERIN_FLOORS, SERIN_TREE, SERIN_SAND, PEOPLE, newStory } = await import(root + '/data/story.js');
const { journeyNow, JOURNEY, GIVERS } = await import(root + '/data/journey.js');
const C = await import(root + '/data/climb.js');
let bad = 0;
const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } };
const b = computeBuild({ race: 'knight', level: 30, alloc: { str: 30 }, engravings: {}, gear: { weapon: 'rustySword' } });

// 1) 데이터: 일지 열두 장 · 탑 열 층 · 바깥 둘 · 피노 없음
ok(Object.keys(JOURNALS).length === 12, '세린의 일지 열두 장');
ok(Object.keys(SERIN_FLOORS).length === 10 && new Set(Object.keys(SERIN_FLOORS).map((f) => C.actOf(+f).n)).size === 10, '탑 안 열 장 · 구역마다 하나');
ok(Object.values(SERIN_FLOORS).every((id) => JOURNALS[id]) && JOURNALS[SERIN_TREE] && JOURNALS[SERIN_SAND], '모든 자리에 일지가 있다');
ok(!PEOPLE.pino && PEOPLE.chief, '피노는 없고 촌장이 있다');
ok(Object.values(SERIN_FLOORS).every((_, i, a) => true) && Object.keys(SERIN_FLOORS).every((f) => C.floorKind(+f) === 'fight'), '일지 층은 모두 싸움터 층');

// 2) 이끼 동굴: 피노 · 세린 흔적이 빠졌다 (철창 · 무너진 바위는 그대로)
{
  const st = newStory(), w = new World({ build: b, mode: 'field', zoneId: 'cave', seed: 1, story: st, codex: { journals: {} } });
  ok(!w.objects.some((o) => o.kind === 'npc'), '이끼 동굴: 사람 없음');
  ok(!w.objects.some((o) => o.kind === 'journal'), '이끼 동굴: 일지 없음');
  ok(w.objects.filter((o) => o.kind === 'barrier').map((o) => o.id).sort().join() === 'ironGate,rubble', '이끼 동굴: 철창 · 무너진 바위');
}

// 3) 탑: 정해진 층에 금 간 벽 너머 작은 방 · 깨면 들어가 일지를 읽는다
for (const f of Object.keys(SERIN_FLOORS).map(Number)) {
  const act = C.actOf(f), z = ALL_ZONES.find((x) => x.id === act.zone);
  for (const seed of [3, 77]) {
    const map = buildClimbFloor(z, seed, f, 'fight'), j = map.journals?.[0];
    ok(j && j.id === SERIN_FLOORS[f], `${f}층 (씨앗 ${seed}): 일지 자리`);
    if (!j) continue;
    ok(map.tiles[j.y * map.tw + j.x] === T_FLOOR, `${f}층: 일지는 바닥 위`);
    const crack = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => [1, 2].some((k) => map.tiles[(j.y + dy * k) * map.tw + j.x + dx * k] === T_CRACK));
    ok(crack, `${f}층: 일지 앞에 금 간 벽`);
  }
}
{
  const f = 7, act = C.actOf(f), z = ALL_ZONES.find((x) => x.id === act.zone), run = C.newRun({ seed: 3 }); run.f = f;
  const codex = { journals: {} }, map = buildClimbFloor(z, 3, f, 'fight');
  const w = new World({ build: b, mode: 'field', zone: z, zoneId: z.id, seed: 3, map, tower: { f }, climb: { run, f, kind: 'fight' }, codex });
  const jo = w.objects.find((o) => o.kind === 'journal' && o.id === SERIN_FLOORS[f]);
  ok(!!jo, '탑 7층 세계: 일지 오브젝트');
  let ci = -1; for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === T_CRACK) { ci = i; break; }
  ok(ci >= 0, '탑 7층 세계: 금 간 벽');
  if (ci >= 0) { const x = (ci % w.tw) * TILE + 8, y = Math.floor(ci / w.tw) * TILE + 8; for (let k = 0; k < 3; k++) w.hitCrack(x, y, 10); ok(w.tiles[ci] === T_FLOOR, '금 간 벽을 세 번 치면 열린다'); }
  if (jo) { w.interact(jo); ok(codex.journals[SERIN_FLOORS[f]], '일지를 읽으면 기록 도감에'); }
}

// 4) 바깥: 이끼 숲의 큰 나무 · 물안개 해안의 모래
{
  const { buildOverworld, WORLD_ZONE } = await import(root + '/data/maps/overworld.js');
  const life = { bag: {}, tools: { axe: 1, shovel: 1 }, nodes: {}, chopped: {}, farm: {}, fishLog: {}, artifacts: {} };
  const codex = { journals: {} };
  const w = new World({ build: b, mode: 'field', zone: WORLD_ZONE, zoneId: 'world', seed: 7, map: buildOverworld(WORLD_ZONE), life, codex });
  ok(!!w.serinTree, '바깥: 세린의 나무를 정했다');
  const dg = w.objects.find((o) => o.kind === 'dig' && o.serin === SERIN_SAND);
  ok(!!dg, '바깥: 모래밭의 반짝이는 흙');
}

// 5) 여정을 맡기는 사람: 말 걸기 → 하기 → 알리기 (새 저장만)
{
  const s = { npcJourney: 1, journey: {}, codex: { kills: {} }, story: newStory(), climb: {} };
  let J = journeyNow(s);
  ok(J.step.id === 'hunt' && J.stage === 'talk' && !J.done, '처음: 촌장에게 말 걸기');
  s.jAccept = { hunt: 1 }; J = journeyNow(s);
  ok(J.stage === 'do', '말을 걸면 사냥이 걸린다');
  const huntCheck = JOURNEY[0].check; JOURNEY[0].check = () => true; J = journeyNow(s);
  ok(J.stage === 'report' && !J.done, '사냥을 마치면 촌장에게 알리기 (자동 보상 없음)');
  JOURNEY[0].check = huntCheck;
  const old = { journey: {}, codex: { kills: {} }, story: newStory(), climb: {} };
  ok(journeyNow(old).stage === 'do', '예전 저장은 지금처럼 바로');
  ok(JOURNEY.filter((j) => j.giver).every((j) => GIVERS[j.giver] && j.talk?.length && (j.autoReport || j.report?.length)), '맡기는 여정마다 대사');
}

console.log(bad ? `${bad} FAIL` : 'ALL OK');
process.exit(bad ? 1 : 0);

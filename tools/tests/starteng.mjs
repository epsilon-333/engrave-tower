// 종족 시작 각인 (2026-11-25): 여정 1 보상(grantRaceMats(s, 1))이 그 종족의 시작 각인 재료를 주고 · 바로 새길 수 있고 · 그 각인은 원래 종족 스킬을 준다
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { newSave, grantRaceMats } = await import(root + '/save.js');
const { RACES } = await import(root + '/data/races.js');
const { ENGRAVINGS } = await import(root + '/data/engravings.js');
const { ENGRAVING_SKILLS, SKILLS, RACE_CLASSES } = await import(root + '/data/skills.js');
const { SKILL_ENGS } = await import(root + '/data/skillengs.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } };

let n = 0;
for (const race of Object.keys(RACES)) {
  if (!RACE_CLASSES(race).length) continue;
  const s = newSave(race);
  const eid = grantRaceMats(s, 1);
  ok(eid && ENGRAVINGS[eid], `${race}: 여정 1 보상 각인 (${eid})`);
  ok(s.engUnlocked?.[eid], `${race}: 받은 각인은 제단에서 잠금 해제`);
  if (!eid) continue;
  const e = ENGRAVINGS[eid];
  ok(Object.entries(e.recipe).every(([r, k]) => (s.echoes[r] || 0) >= k), `${race}: 재료로 바로 새길 수 있다`);
  ok(SKILLS[ENGRAVING_SKILLS[eid]], `${race}: ${eid}는 스킬을 준다`);
  n++;
}
ok(n >= 8, `종족 수 ${n}`);

// 첫 각인 안내: 단계가 차례로 (건너뛸 수 없다 · 동작마다 넘어간다)
{
  const { firstEngPhase } = await import(root + '/ui/tutorial.js');
  const { JOURNEY } = await import(root + '/data/journey.js');
  const s = newSave(Object.keys(RACES).find((r) => RACE_CLASSES(r).length));
  s.npcJourney = true; s.tutorial = { done: true }; s.guideOff = true;
  ok(firstEngPhase(s) === null, '사냥 전엔 안내 없음');
  s.jAccept = { hunt: 1 }; s.journey = {};
  const hunt = JOURNEY.find((j) => j.id === 'hunt'); const chk = hunt.check; hunt.check = () => true;
  ok(firstEngPhase(s) === 'report', '사냥을 마치면 촌장에게 알리기');
  hunt.check = chk;
  s.journey.hunt = 1; const eid = grantRaceMats(s, 1); s.flags = { firstEng: eid };
  const seq = [];
  const P = (ui) => { const p = firstEngPhase(s, ui); seq.push(p); return p; };
  ok(P({}) === 'mats', '재료 받음'); s.firstEngTut = { ack: 1 };
  ok(P({}) === 'rune', '루네에게'); s.jAccept.altarEng = 1;
  ok(P({}) === 'open', '제단 열기');
  ok(P({ panel: 'tab:altar' }) === 'select', '목록에서 고르기');
  ok(P({ panel: 'tab:altar', altarSel: eid }) === 'full', '재료 강조'); s.firstEngTut.seenMats = 1;
  ok(P({ panel: 'tab:altar', altarSel: eid }) === 'engrave', '새기기'); s.owned[eid] = 1;
  ok(P({ panel: 'tab:altar', altarSel: eid }) === 'equip', '장착'); s.slots.head = eid;
  ok(P({ panel: 'tab:altar' }) === 'close', '창 닫기');
  ok(P({}) === 'use', '스킬 써 보기');
  ok(P({ used: true }) === 'done', '끝');
}
console.log(fails ? `FAIL ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

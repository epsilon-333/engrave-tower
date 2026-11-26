// 안내 줄 (2026-11-26): 큐에 여럿 넣어도 한 번에 하나만 보인다 · 우선순위 · 글은 한 줄(약 25자)
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { tutQueue, TUT_ORDER, tutTexts, inFight } = await import(root + '/ui/tutorial.js');
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log('FAIL', m); } };
const shown = () => TUT_ORDER.filter((k) => tutQueue.want[k] && tutQueue.may(k));

// 모든 조합: 보이는 것은 언제나 하나 이하 · 가장 앞선 것
for (let m = 0; m < 16; m++) {
  tutQueue.reset();
  TUT_ORDER.forEach((k, i) => tutQueue.set(k, !!(m & (1 << i))));
  const v = shown(), top = TUT_ORDER.find((k, i) => m & (1 << i)) || null;
  ok(v.length <= 1, `조합 ${m}: ${v.length}개가 동시에 보인다`);
  ok((v[0] || null) === top, `조합 ${m}: ${v[0]} 대신 ${top}`);
}
// 앞의 것이 끝나면 뒤의 것이 뜬다
tutQueue.reset(); tutQueue.set('forced', true); tutQueue.set('tip', true);
ok(!tutQueue.may('tip'), '첫 각인 중에 처음 알림이 뜬다');
tutQueue.set('forced', false);
ok(tutQueue.may('tip'), '첫 각인이 끝났는데 처음 알림이 안 뜬다');
// 싸우는 중에는 미룬다
ok(inFight({ player: { x: 0, y: 0 }, enemies: [{ x: 100, y: 0, def: { ai: 'melee' } }] }), '가까운 적: 싸우는 중이 아니다');
ok(!inFight({ player: { x: 0, y: 0 }, enemies: [{ x: 100, y: 0, def: { ai: 'dummy' }, tut: true }] }), '허수아비를 싸움으로 본다');
// 한 줄 글
let n = 0;
for (const touch of [false, true]) for (const t of tutTexts(touch)) {
  const plain = t.replace(/<[^>]+>/g, ''); n++;
  ok(plain.length <= 28, `글이 길다 (${plain.length}자): ${plain}`);
}
console.log(`안내 글 ${n}개 검사`);
console.log(fails ? `FAIL ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

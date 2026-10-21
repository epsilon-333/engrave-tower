// 결투: 두 사람의 세계를 직접 이어서 (네트워크 대신) 서로 때리면 피해 · CC가 오가고 누군가 쓰러지는지
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { DUEL_ZONE, buildDuelArena } = await import(root + '/data/maps/arena.js');
const { CLASSES } = await import(root + '/data/skills.js');
const mk = (race, cls, side, oppName) => {
  const c = CLASSES[cls], b = computeBuild({ race, cls, level: 15, allSkills: true, alloc: {}, engravings: {}, gear: { weapon: c.weapons[0] } });
  const w = new World({ build: b, mode: 'field', zone: DUEL_ZONE, zoneId: 'duel', seed: 9, map: buildDuelArena(), pvp: { opp: { name: oppName } } });
  w.enemies = []; w.camps = [];
  const cy = w.th * 8, cx = w.tw * 8;
  w.player.x = side ? cx + 14 : cx - 14; w.player.y = cy;
  return w;
};
const A = mk('knight', 'greatsword', 0, '나래'), B = mk('orc', 'berserker', 1, '가람');
const ea = A.addRemote({ name: '나래', maxHp: B.d.maxHp, lv: 15 }, B.player.x, B.player.y), eb = B.addRemote({ name: '가람', maxHp: A.d.maxHp, lv: 15 }, A.player.x, A.player.y);
let sent = { A: 0, B: 0 }, cc = 0, skills = 0, end = null;
for (let f = 0; f < 60 * 40 && !end; f++) {
  const aim = (w, e) => { const dx = e.x - w.player.x, dy = e.y - w.player.y, l = Math.hypot(dx, dy) || 1; return { aimX: dx / l, aimY: dy / l, moveX: l > 22 ? dx / l : 0, moveY: l > 22 ? dy / l : 0 }; };
  const ia = { attack: true, ...aim(A, ea), s1: f % 90 === 5, s2: f % 150 === 40 }, ib = { attack: true, ...aim(B, eb), s1: f % 100 === 9 };
  A.step(ia); B.step(ib);
  for (const [from, to, toE, key] of [[A, B, eb, 'A'], [B, A, ea, 'B']]) {
    for (const m of from.pvp.out.splice(0)) { if (m.t === 'dhit') { to.pvpHit(m); if (m.dmg > 0) sent[key] += m.dmg; if (m.cc) cc++; } else if (m.t === 'dskill') skills++; }
  }
  ea.tx = B.player.x; ea.ty = B.player.y; ea.hp = B.player.hp; eb.tx = A.player.x; eb.ty = A.player.y; eb.hp = A.player.hp;
  for (const w of [A, B]) { if (w.signals.some((s) => s.t === 'pvpDown')) end = w === A ? '가람(기사) 쓰러짐' : '나래(오크) 쓰러짐'; w.signals.length = 0; w.events.length = 0; }
}
console.log('기사가 보낸 피해', Math.round(sent.A), '· 오크가 보낸 피해', Math.round(sent.B), '· CC', cc, '· 스킬', skills);
console.log('결과:', end || '40초 안에 끝나지 않음', `· 남은 체력 기사 ${Math.round(A.player.hp)}/${A.d.maxHp} 오크 ${Math.round(B.player.hp)}/${B.d.maxHp}`);
console.log(sent.A > 0 && sent.B > 0 ? 'PVP OK' : 'PVP FAIL');

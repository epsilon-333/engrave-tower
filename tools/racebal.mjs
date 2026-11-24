// 종족 평타 밸런스 재기: 같은 레벨 · 같은 무기 · 같은 투자로 종족마다 평타 초당 피해 · 체력 · 생존(같은 공격을 몇 대 버티나)을 잰다
// 사용: node tools/racebal.mjs [레벨=20] [무기=rustySword]   (RAW=1 이면 RACE_BAL_PVE 없이)
const root = new URL('../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { RACES } = await import(root + '/data/races.js');
const SK = await import(root + '/data/skills.js');
const { ITEMS } = await import(root + '/data/items.js');
const { weaponStat } = await import(root + '/data/statscale.js');
const LV = +(process.argv[2] || 20), WID = process.argv[3] || 'rustySword', SECS = 30;
const ST = await import(root + '/data/stats.js');
if (process.env.NOEXT) ST.EXTREME.ratio = 1e9; // 극한(주력 스탯 +15%) 없이: 찍는 비율에 따라 켜지고 꺼지는 것을 빼고 종족 차이만
if (process.env.RAW) for (const k in SK.RACE_BAL_PVE) SK.RACE_BAL_PVE[k] = 1;
function run(race, stat, wid = WID) {
  const pts = Math.floor(1.75 * (LV - 1));
  // 공격 스탯 60% · 체력 40% (무기가 따라가는 스탯이 다르면 공격 35% · 무기 스탯 25%)
  const ws = weaponStat(ITEMS[wid]), alloc = { vit: Math.floor(pts * 0.4) };
  if (ws === stat || ws === 'vit') alloc[stat] = Math.ceil(pts * 0.6); else { alloc[stat] = Math.ceil(pts * 0.35); alloc[ws] = (alloc[ws] || 0) + Math.floor(pts * 0.25); }
  const b = computeBuild({ race, level: LV, alloc, engravings: {}, gear: { weapon: wid } });
  const W = new World({ build: b, mode: 'field', zoneId: 'world', seed: 7 }), p = W.player;
  const rg = ITEMS[wid].weapon.kind !== 'melee' ? 90 : 16;
  const e = W.makeEnemy('goblin', p.x + rg, p.y, { noAffix: true });
  if (W.blocked(e.x, e.y, 6)) e.x = p.x - rg;
  e.maxHp = e.hp = 1e8; e.atk = 0; e.state = 'idle'; e.def = { ...e.def, ai: 'chase', speed: 0 }; e.mvCd = 1e9; W.enemies = [e];
  let dealt = 0;
  for (let f = 0; f < SECS * 60; f++) {
    e.x = e.home?.x ?? e.x; e.kbx = e.kby = 0; if (f % 180 === 0) e.st = {};
    W.step({ moveX: 0, moveY: 0, aimX: e.x, aimY: e.y, attack: true, autoAim: true });
    for (const ev of W.events) if (ev.t === 'dmg' && ev.who !== 'p') dealt += ev.v || 0;
    e.hp = e.maxHp; W.events.length = 0; W.signals.length = 0; p.hp = W.d.maxHp;
  }
  // 생존: 물리 100 · 마법 100을 맞을 때 실제로 깎이는 양 (회피 포함 평균)
  let taken = 0, n = 0;
  for (const t of ['phys', 'mag']) for (let i = 0; i < 300; i++) { p.hp = W.d.maxHp; p.iframe = 0; p.invuln = 0; p.hurtT = 0; const h0 = p.hp; W.hurtPlayer(100, t, null); taken += h0 - p.hp; n++; }
  return { dps: dealt / SECS, hp: W.d.maxHp, ehp: W.d.maxHp / Math.max(1, taken / n) };
}
const mainOf = (wid) => { const w = ITEMS[wid].weapon; return w.dmg === 'mag' ? 'mag' : w.scale === 'agi' ? 'agi' : 'str'; };
// OWN=1: 종족마다 두 갈래의 시작 무기(같은 등급)를 들고 그 무기의 주력 스탯에 투자 → 더 센 쪽
const own = (r) => SK.RACE_CLASSES(r).map((c) => SK.CLASSES[c].weapons[0]).map((w) => ({ w, ...run(r, mainOf(w), w) })).sort((a, b) => b.dps - a.dps)[0];
// 기본: 같은 무기 셋(근력 녹슨 검 · 민첩 단검 · 마력 견습 지팡이)을 모든 종족이 들고 재서, 그 종족에게 가장 좋은 것
const KITS = process.env.KIT ? [process.env.KIT.split(':')] : [['str', 'rustySword'], ['agi', 'dagger'], ['mag', 'apprenticeStaff']]; // KIT=str:dragonSpear 처럼 하나만
const kit = (r) => KITS.map(([st, w]) => ({ w, ...run(r, st, w) }));
const rows = Object.keys(RACES).map((r) => { if (process.env.OWN) return { r, name: RACES[r].name, s: own(r), k: [] }; const k = kit(r); return { r, name: RACES[r].name, k, s: k.slice().sort((a, b) => b.dps - a.dps)[0] }; });
const avg = (f) => rows.reduce((s, x) => s + f(x), 0) / rows.length;
const best = (x) => x.s.dps;
const ms = avg(best), mh = avg((x) => x.s.ehp);
console.log(`레벨 ${LV} · ${WID} · ${process.env.RAW ? 'RACE_BAL_PVE 없이' : 'RACE_BAL_PVE 적용'}`);
for (const x of rows) console.log(`${x.r.padEnd(9)} ${x.name.padEnd(6)} 평타 초당 ${x.s.dps.toFixed(0).padStart(6)} [${x.k.map((k) => k.dps.toFixed(0)).join(' / ')}]  평균 대비 ${(best(x) / ms * 100).toFixed(0).padStart(4)}%  체력 ${String(x.s.hp).padStart(5)}  버티는 대 수 ${x.s.ehp.toFixed(1).padStart(5)} (${(x.s.ehp / mh * 100).toFixed(0)}%)${x.s.w ? '  ' + x.s.w : ''}`);

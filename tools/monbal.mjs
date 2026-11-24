// 몬스터별 밸런스 보기 (탑 구역마다): 기준 캐릭터가 평타 몇 대에 잡나 · 한 대에 체력 몇 %를 잃나.
// 기준 캐릭터 = 여덟 종족의 권장 레벨 몸(주력 60% · 체력 40% · 종족 첫 갈래의 좋은 시작 무기)의 기하평균 — tools/curve.mjs 와 같은 생각.
// 몬스터 저항(pres · mres)은 피해 계산 그대로 1 - 저항/(저항+100), 특성(방패 · 갑각 · 석화)은 sim/montraits.js 의 숫자를 대략 곱한다.
// 「대」는 무기 종류마다 한 대 크기가 달라 종족끼리는 비교하지 않고, 같은 구역 몬스터끼리 비교한다 (구역 평균 = 1).
// 사용: node tools/monbal.mjs [층=구역마다 가운데]
const R = new URL('../public/js', import.meta.url).href;
const { computeBuild } = await import(R + '/sim/build.js');
const { ALL_ZONES, MONSTERS } = await import(R + '/data/monsters.js');
const { CLASSES, RACE_CLASSES } = await import(R + '/data/skills.js');
const { ITEMS } = await import(R + '/data/items.js');
const C = await import(R + '/data/climb.js');
const RACES = ['dino', 'wizard', 'knight', 'orc', 'undead', 'assassin', 'elf', 'dragon'];
const geo = (xs) => Math.exp(xs.reduce((a, x) => a + Math.log(Math.max(1e-9, x)), 0) / xs.length);

function ref(race, lv) {
  const cid = RACE_CLASSES(race)[0], c = CLASSES[cid], wid = c.weapons[1] || c.weapons[0], wpn = ITEMS[wid];
  const pts = Math.floor(1.75 * (lv - 1)), main = wpn.weapon.dmg === 'mag' ? 'mag' : wpn.weapon.scale === 'agi' ? 'agi' : 'str';
  const b = computeBuild({ race, cls: cid, level: lv, alloc: { [main]: Math.ceil(pts * 0.6), vit: Math.floor(pts * 0.4) }, engravings: {}, gear: { weapon: wid } });
  const d = b.derived, atk = (wpn.weapon.dmg === 'mag' ? d.magAtk : Math.max(d.physAtk, d.dexAtk || 0)) * wpn.weapon.mul * (b.wScale?.dmg || 1) * (d.dmgMul || 1);
  return { atk, hp: d.maxHp, physDR: d.physDR || 0, magDR: d.magDR || 0, type: wpn.weapon.dmg === 'mag' ? 'mag' : 'phys' };
}
const TRAIT_EHP = { shield: 1.6, carapace: 1.5, stone: 1.3, split: 1.4, feign: 1.3, healer: 1.15 }; // 특성이 늘리는 실질 체력 (대략)

export function table(fArg) {
  const out = [];
  for (const act of C.ACTS) {
    const f = fArg || act.from + 4, z = ALL_ZONES.find((x) => x.id === act.zone);
    C.setZoneRef(z.id, z.pool); const m = C.climbMul(f, z.id), lv = C.recLevel(f);
    const refs = RACES.map((r) => ref(r, lv)), atkRef = geo(refs.map((r) => r.atk));
    const rows = z.pool.map((id) => {
      const d = MONSTERS[id], hp = d.hp * m.hp * (TRAIT_EHP[d.trait] || 1), atk = d.atk * m.atk;
      const resP = 1 - d.pres / (d.pres + 100), resM = 1 - d.mres / (d.mres + 100);
      const hitsP = hp / (atkRef * resP), hitsM = hp / (atkRef * resM);
      const type = d.type === 'mag' ? 'mag' : 'phys';
      const pct = geo(refs.map((r) => atk * (1 - (type === 'mag' ? r.magDR : r.physDR)) / r.hp * 100));
      return { id, name: d.name, trait: d.trait || '', ai: d.ai, hits: Math.sqrt(hitsP * hitsM), hitsP, hitsM, pct, pres: d.pres, mres: d.mres };
    });
    const mh = geo(rows.map((r) => r.hits)), mp = geo(rows.map((r) => r.pct));
    for (const r of rows) { r.relH = r.hits / mh; r.relP = r.pct / mp; }
    out.push({ act, f, rows, mh, mp });
  }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const { act, f, rows, mh, mp } of table(+process.argv[2] || 0)) {
    console.log(`\n── ${act.name} (${f}층) · 평균 ${mh.toFixed(1)}대 · 한 대 ${mp.toFixed(1)}% ──`);
    for (const r of rows) console.log(`  ${r.name.padEnd(9)} ${r.ai.padEnd(9)} ${(r.trait || '-').padEnd(9)} 물리 ${r.hitsP.toFixed(1).padStart(5)}대 · 마법 ${r.hitsM.toFixed(1).padStart(5)}대 (×${r.relH.toFixed(2)}) · 한 대 ${r.pct.toFixed(1).padStart(5)}% (×${r.relP.toFixed(2)})${r.relH > 1.8 || r.relH < 0.5 || r.relP > 1.8 || r.relP < 0.5 ? '  ← 벗어남' : ''}`);
  }
}

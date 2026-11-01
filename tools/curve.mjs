// 탑 난이도 표 만들기 · 보기.
// 층마다 「기준 캐릭터」(권장 레벨 · 스탯 반반 · 한 단계 아래 영웅 이하 탑 무기 · 각인 없음)를 세우고,
// 목표(보통 몬스터를 몇 대에 잡나 · 한 대에 체력 몇 %를 잃나)에서 거꾸로 몬스터 체력 · 공격력을 정한다.
// 사용: node tools/curve.mjs        → 표 보기 (지금 public/js/data/curve.js 기준)
//       node tools/curve.mjs gen    → public/js/data/curve.js 를 다시 만든다 (무기 · 스탯 · 목표를 바꾼 뒤)
import { writeFileSync } from 'fs';
const root = new URL('../public/js', import.meta.url).href;
const { computeBuild } = await import(root + '/sim/build.js');
const { ZONES, MONSTERS } = await import(root + '/data/monsters.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ITEMS } = await import(root + '/data/items.js');
const C = await import(root + '/data/climb.js');
const { TOWER_WEAPONS } = await import(root + '/data/weapons.js');

// ── 목표 (여기만 바꾸면 곡선이 바뀐다) ──
export const TARGET = {
  hits: (f) => 2 + 2 * (f - 1) / 99,                          // 보통 몬스터를 평타 몇 대에: 1층 2대 → 100층 4대
  dmg: (f) => 0.03 + 0.09 * Math.pow((f - 1) / 99, 1.2),     // 보통 몬스터 한 대에 최대 체력의: 1층 3% → 100층 12%
};
const CLS = ['greatsword', 'berserker', 'elementalist', 'ranger', 'shadowblade', 'guardian', 'necromancer', 'dragoon'];
// 권장 레벨: 구역이 바뀔 때 거꾸로 내려가지 않게 이어 붙인다
const refLevel = (f) => { let lv = 1; for (let i = 1; i <= f; i++) lv = Math.max(lv, C.recLevel(i)); return lv; };
function weaponFor(c, f) {
  const base = ITEMS[c.weapons[1] || c.weapons[0]];
  if (f <= 10) return c.weapons[1] || c.weapons[0];
  const tier = Math.max(1, Math.ceil(f / 10) - 1), cat = base.weapon.cat || base.cat;
  const all = Object.keys(TOWER_WEAPONS).filter((id) => TOWER_WEAPONS[id].t === tier && ITEMS[id].weapon.dmg === base.weapon.dmg), low = all.filter((id) => TOWER_WEAPONS[id].r <= 2), list = low.length ? low : all;
  const by = (ids) => ids.sort((a, b) => ITEMS[b].weapon.mul - ITEMS[a].weapon.mul)[0];
  return by(list.filter((id) => ITEMS[id].cat === cat)) || by(list) || (c.weapons[1] || c.weapons[0]);
}
// 기준 캐릭터의 평타 한 대 피해 · 실질 체력 (물리 · 마법 저항을 반영한 체력)
function ref(cid, f) {
  const c = CLASSES[cid], level = refLevel(f), wid = weaponFor(c, f), wpn = ITEMS[wid], pts = Math.floor((level - 1) * 1.75);
  const main = wpn.weapon.dmg === 'mag' ? 'mag' : wpn.weapon.scale === 'agi' ? 'agi' : 'str';
  const b = computeBuild({ race: c.race, cls: cid, level, alloc: { [main]: Math.ceil(pts * 0.6), vit: Math.floor(pts * 0.4) }, engravings: {}, gear: { weapon: wid } });
  const atk = (wpn.weapon.dmg === 'mag' ? b.derived.magAtk : Math.max(b.derived.physAtk, b.derived.dexAtk || 0)) * wpn.weapon.mul * (b.wScale?.dmg || 1) * (b.derived.dmgMul || 1);
  const dr = 1 - ((b.derived.physDR || 0) + (b.derived.magDR || 0)) / 2;
  return { atk, ehp: b.derived.maxHp / Math.max(0.2, dr), level, wid };
}
const geo = (xs) => Math.exp(xs.reduce((a, x) => a + Math.log(x), 0) / xs.length);
// 구역 가운데 층(5 · 15 · … · 95)을 기준점으로 잡고 그 사이는 로그로 매끄럽게 잇는다 (무기 단계가 바뀌는 층에서 튀지 않게)
function smoothRef() {
  const anchors = [1, 5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 100].map((f) => ({ f, atk: geo(CLS.map((c) => ref(c, f).atk)), ehp: geo(CLS.map((c) => ref(c, f).ehp)) }));
  for (let i = 1; i < anchors.length; i++) { anchors[i].atk = Math.max(anchors[i].atk, anchors[i - 1].atk); anchors[i].ehp = Math.max(anchors[i].ehp, anchors[i - 1].ehp); } // 내려가지 않게
  const at = (f, k) => { let i = 0; while (i < anchors.length - 2 && anchors[i + 1].f < f) i++; const A = anchors[i], B = anchors[i + 1], u = (f - A.f) / (B.f - A.f); return Math.exp(Math.log(A[k]) + (Math.log(B[k]) - Math.log(A[k])) * u); };
  const out = { atk: [0], ehp: [0] };
  for (let f = 1; f <= 100; f++) { out.atk.push(at(f, 'atk')); out.ehp.push(at(f, 'ehp')); }
  return out;
}

if (process.argv[2] === 'gen') {
  const R = smoothRef(), hp = [0], atk = [0];
  for (let f = 1; f <= 100; f++) { hp.push(Math.round(R.atk[f] * TARGET.hits(f) * 10) / 10); atk.push(Math.round(R.ehp[f] * TARGET.dmg(f) * 10) / 10); }
  const file = `// 탑 난이도 표 (자동 생성 — 손으로 고치지 말고 tools/curve.mjs 의 TARGET 을 바꾼 뒤 \`node tools/curve.mjs gen\`)
// 층 f 의 보통 몬스터 평균 체력 · 공격력. 기준 캐릭터가 평타 ${TARGET.hits(1)}~${TARGET.hits(100)}대에 잡고, 한 대에 체력 ${Math.round(TARGET.dmg(1) * 100)}~${Math.round(TARGET.dmg(100) * 100)}%를 잃도록.
export const CURVE_HP = ${JSON.stringify(hp)};
export const CURVE_ATK = ${JSON.stringify(atk)};
`;
  writeFileSync(new URL('../public/js/data/curve.js', import.meta.url), file);
  console.log('public/js/data/curve.js 를 만들었다');
}
// 표 보기: 대검 · 원소술사 · 사냥꾼으로 실제 몇 대 · 몇 %인지
console.log('층  레벨 | 대검 몇대 %  | 원소 몇대 %  | 사냥꾼 몇대 % | 보스(수호자) 대검 몇대');
for (const f of [1, 5, 9, 10, 11, 15, 20, 29, 30, 31, 40, 50, 51, 60, 61, 70, 80, 90, 95, 100]) {
  const act = C.actOf(f), z = ZONES.find((x) => x.id === act.zone); C.setZoneRef(z.id, z.pool); const m = C.climbMul(f, z.id);
  const avgHp = z.pool.reduce((a, id) => a + MONSTERS[id].hp, 0) / z.pool.length * m.hp, avgAtk = z.pool.reduce((a, id) => a + MONSTERS[id].atk, 0) / z.pool.length * m.atk;
  const cols = ['greatsword', 'elementalist', 'ranger'].map((c) => { const r = ref(c, f); return `${(avgHp / r.atk).toFixed(1).padStart(5)} ${(avgAtk / r.ehp * 100).toFixed(1).padStart(5)}`; });
  const g = ref('greatsword', f), bossHp = MONSTERS[act.guardian].hp * m.hp * C.BOSS_HP.guardian;
  console.log(`${String(f).padStart(3)} ${String(refLevel(f)).padStart(4)} | ${cols.join(' | ')} | ${(bossHp / g.atk).toFixed(0).padStart(5)}`);
}

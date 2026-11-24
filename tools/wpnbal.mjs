// 무기 평타 밸런스: 무기마다 평타 1초 평균 피해를 실제로 싸워 재고, 「무기 배율(mul) 1당 초당 피해」가 같아지게 보정한다.
// → 빠른 무기는 한 대가 약하고, 느린 무기는 한 대가 세다 (근접끼리 1초 평균이 같다). 무기의 등급 차이는 mul 그대로 남는다.
// 원거리(활 · 바람총 · 지팡이 · 던지기)는 멀리서 안전하게 치니 근접의 RANGED_K 만큼으로 맞춘다.
// 사용: node tools/wpnbal.mjs        → 표 보기 (지금 보정 적용)
//       node tools/wpnbal.mjs gen    → public/js/data/wpnbal.js 를 다시 만든다 (지금 보정 위에서 고치므로 두세 번 돌리면 모인다)
import { writeFileSync } from 'fs';
const root = new URL('../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { ITEMS } = await import(root + '/data/items.js');
const { WPN_BAL } = await import(root + '/data/wpnbal.js');
const { weaponFamily } = await import(root + '/sim/build.js');
const { TOWER_WEAPONS } = await import(root + '/data/weapons.js');
const { weaponStat, weaponScale } = await import(root + '/data/statscale.js');

export const RANGED_K = 0.75;
const GEN = process.argv[2] === 'gen', SECS = 12, LEVEL = 20, FRESH = 180;
const ids = Object.keys(ITEMS).filter((id) => ITEMS[id].weapon && !ITEMS[id].weapon.noAttack);
// 무기의 등급 (2026-11-24): mul에는 예전 「빠른 무기는 한 대가 약하게」가 계열마다 섞여 있어서(주먹 · 단검 · 바람총은 mul이 낮다)
// mul 그대로 나누면 빠른 계열이 느린 계열(도끼 · 대검)의 절반쯤밖에 못 쳤다. → 계열마다 「같은 단계 탑 무기의 mul ÷ 모든 계열의 그 단계 가운데값」의 가운데값(FAM_K)으로 mul을 나눠 등급을 잰다.
// 같은 단계의 무기는 계열이 달라도 1초 평균 피해가 같고, 단계 · 계열 안의 등급 차이만 mul로 남는다
const med = (xs) => { const a = xs.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const FAM_K = {};
{
  const byT = {}; for (const id of ids) { const t = TOWER_WEAPONS[id]?.t; if (t) (byT[t] ||= []).push(ITEMS[id].weapon.mul || 1); }
  const tMed = Object.fromEntries(Object.entries(byT).map(([t, a]) => [t, med(a)]));
  const r = {}, plain = {}; for (const id of ids) { const it = ITEMS[id], f = weaponFamily(it), t = TOWER_WEAPONS[id]?.t; if (t) (r[f] ||= []).push((it.weapon.mul || 1) / tMed[t]); else (plain[f] ||= []).push(it.weapon.mul || 1); }
  const allPlain = med(Object.values(plain).flat());
  for (const f of new Set([...Object.keys(r), ...Object.keys(plain)])) FAM_K[f] = r[f] ? med(r[f]) : med(plain[f]) / allPlain;
}
const grade = (it) => (it.weapon.mul || 1) / FAM_K[weaponFamily(it)];

function dps(id) {
  const it = ITEMS[id], w = it.weapon, main = w.dmg === 'mag' ? 'mag' : w.scale === 'agi' ? 'agi' : 'str';
  // 무기가 따라가는 스탯(weaponStat)이 공격 스탯과 다르면(창 = 근력 + 민첩 · 활 = 감각 · 둔기 = 체력 …) 20점을 나눠 찍는다 (공격 12 · 무기 스탯 8).
  // 기준은 공격 스탯에 20점을 다 찍고 무기 스탯도 같은 값인 무기 (검 · 도끼 · 대검 · 지팡이처럼 한 스탯으로 두 번 세지는 무기) — 두 스탯을 나눠 키워야 하는 무기가 약하지 않게 (2026-11-24)
  const ws = weaponStat(it), split = ws !== main && ws !== 'vit';
  const bRef = computeBuild({ race: 'orc', level: LEVEL, alloc: { [main]: 20 }, engravings: {}, gear: { weapon: id } });
  const refScale = weaponScale({ weaponItem: it, stats: { ...bRef.stats, [ws]: bRef.stats[main] } }).dmg;
  const b = split ? computeBuild({ race: 'orc', level: LEVEL, alloc: { [main]: 12, [ws]: 8 }, engravings: {}, gear: { weapon: id } }) : bRef;
  const W = new World({ build: b, mode: 'field', zoneId: 'world', seed: 7 }), p = W.player;
  for (const e of W.enemies) e.dead = true;
  const ranged = w.kind !== 'melee';
  const e = W.makeEnemy('goblin', p.x + (ranged ? 90 : 16), p.y, { noAffix: true });
  if (W.blocked(e.x, e.y, 6)) { e.x = p.x - (ranged ? 90 : 16); }
  e.maxHp = e.hp = 1e8; e.atk = 0; e.state = 'idle'; e.def = { ...e.def, ai: 'chase', speed: 0 }; e.mvCd = 1e9; W.enemies = [e];
  let dealt = 0;
  for (let f = 0; f < SECS * 60; f++) {
    e.x = e.home?.x ?? e.x; e.kbx = e.kby = 0;
    if (f % FRESH === 0) { e.st = {}; e.dotAcc = 0; } // 보통 몬스터는 몇 초 만에 쓰러진다: 3초마다 새 적처럼 (상태이상 중첩이 12초 내내 쌓여 부풀지 않게)
    W.step({ moveX: 0, moveY: 0, aimX: e.x, aimY: e.y, attack: true, autoAim: true });
    for (const ev of W.events) if (ev.t === 'dmg' && ev.who !== 'p') dealt += ev.v || 0;
    e.hp = e.maxHp; W.events.length = 0; W.signals.length = 0; p.hp = W.d.maxHp;
  }
  const dR = bRef.derived, atk = (w.dmg === 'mag' ? dR.magAtk : Math.max(dR.physAtk, dR.dexAtk || 0)) * refScale * (dR.dmgMul || 1);
  return { ranged, v: dealt / SECS / grade(it) / atk }; // 공격력 1 · 등급 1당 초당 피해 (무기에 붙은 스탯은 빼고 빠르기 · 연타 · 모양만 남긴다)
}
const rows = ids.map((id) => ({ id, name: ITEMS[id].name, cat: ITEMS[id].cat || ITEMS[id].weapon.cat || '-', ...dps(id) })).filter((r) => r.v > 0);
const base = med(rows.filter((r) => !r.ranged).map((r) => r.v));
const out = {};
const odd = (r) => r.v < base * 0.3 || r.v > base * 10; // 재는 방식으로 못 잰 무기(돌아오는 무기 · 특수 탄 · 독 바람총 등)는 건드리지 않는다
// 지금 보정을 건 채로 재고 그 위에 곱한다 (피해가 무기 배율에 정비례하지 않는 무기 — 맞힐 때 붙는 효과 · 콤보 — 도 몇 번 돌리면 맞는다)
for (const r of rows) { const cur = WPN_BAL[r.id] ?? 1; if (odd(r)) { r.k = 1; continue; } const tgt = base * (r.ranged ? RANGED_K : 1); r.k = Math.round(Math.min(3, Math.max(0.05, cur * tgt / r.v)) * 100) / 100; if (Math.abs(r.k - 1) > 0.02) out[r.id] = r.k; }
for (const r of rows.sort((a, b) => a.ranged - b.ranged || a.cat.localeCompare(b.cat))) console.log(`${odd(r) ? '(제외) ' : ''}${r.ranged ? '원거리' : '근접  '} ${r.cat.padEnd(8)} ${r.name.padEnd(12)} 등급당 초당 ${r.v.toFixed(2).padStart(6)}${GEN ? `  → 보정 ×${r.k}` : `  (보정 ×${WPN_BAL[r.id] ?? 1})`}`);
if (process.env.FAMK) console.log(FAM_K);
if (GEN) { writeFileSync(new URL('../public/js/data/wpnbal.js', import.meta.url), `// 자동 생성: node tools/wpnbal.mjs gen — 무기마다 평타 1초 평균 피해를 맞춘다 (손으로 고치지 않는다)\nexport const WPN_BAL = ${JSON.stringify(out)};\n`); console.log(`\n무기 ${Object.keys(out).length}개 보정 · 근접 기준 ${base.toFixed(1)} · 원거리 ×${RANGED_K}`); }

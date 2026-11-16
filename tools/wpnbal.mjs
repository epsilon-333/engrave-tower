// 무기 평타 밸런스: 무기마다 평타 1초 평균 피해를 실제로 싸워 재고, 「무기 배율(mul) 1당 초당 피해」가 같아지게 보정한다.
// → 빠른 무기는 한 대가 약하고, 느린 무기는 한 대가 세다 (근접끼리 1초 평균이 같다). 무기의 등급 차이는 mul 그대로 남는다.
// 원거리(활 · 바람총 · 지팡이 · 던지기)는 멀리서 안전하게 치니 근접의 RANGED_K 만큼으로 맞춘다.
// 사용: node tools/wpnbal.mjs        → 표 보기 (지금 보정 적용)
//       node tools/wpnbal.mjs gen    → public/js/data/wpnbal.js 를 다시 만든다
import { writeFileSync } from 'fs';
const root = new URL('../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { ITEMS } = await import(root + '/data/items.js');
const { WPN_BAL } = await import(root + '/data/wpnbal.js');

export const RANGED_K = 0.75;
const GEN = process.argv[2] === 'gen', SECS = 12, LEVEL = 20;
const ids = Object.keys(ITEMS).filter((id) => ITEMS[id].weapon && !ITEMS[id].weapon.noAttack);

function dps(id) {
  const it = ITEMS[id], w = it.weapon, main = w.dmg === 'mag' ? 'mag' : w.scale === 'agi' ? 'agi' : 'str';
  const b = computeBuild({ race: 'orc', level: LEVEL, alloc: { [main]: 20 }, engravings: {}, gear: { weapon: id } });
  const W = new World({ build: b, mode: 'field', zoneId: 'world', seed: 7 }), p = W.player;
  if (GEN) W.wpnBalOff = true;
  for (const e of W.enemies) e.dead = true;
  const ranged = w.kind !== 'melee';
  const e = W.makeEnemy('goblin', p.x + (ranged ? 90 : 16), p.y, { noAffix: true });
  if (W.blocked(e.x, e.y, 6)) { e.x = p.x - (ranged ? 90 : 16); }
  e.maxHp = e.hp = 1e8; e.atk = 0; e.state = 'idle'; e.def = { ...e.def, ai: 'chase', speed: 0 }; e.mvCd = 1e9; W.enemies = [e];
  let dealt = 0;
  for (let f = 0; f < SECS * 60; f++) {
    e.x = e.home?.x ?? e.x; e.kbx = e.kby = 0;
    W.step({ moveX: 0, moveY: 0, aimX: e.x, aimY: e.y, attack: true, autoAim: true });
    for (const ev of W.events) if (ev.t === 'dmg' && ev.who !== 'p') dealt += ev.v || 0;
    e.hp = e.maxHp; W.events.length = 0; W.signals.length = 0; p.hp = W.d.maxHp;
  }
  const atk = (w.dmg === 'mag' ? W.d.magAtk : Math.max(W.d.physAtk, W.d.dexAtk || 0)) * (b.wScale?.dmg || 1) * (W.d.dmgMul || 1);
  return { ranged, v: dealt / SECS / (w.mul || 1) / atk }; // 공격력 1 · mul 1당 초당 피해 (무기에 붙은 스탯은 빼고 빠르기 · 연타 · 모양만 남긴다)
}
const rows = ids.map((id) => ({ id, name: ITEMS[id].name, cat: ITEMS[id].cat || ITEMS[id].weapon.cat || '-', ...dps(id) })).filter((r) => r.v > 0);
const med = (xs) => { const a = xs.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const base = med(rows.filter((r) => !r.ranged).map((r) => r.v));
const out = {};
const odd = (r) => r.v < base * 0.25 || r.v > base * 10; // 재는 방식으로 못 잰 무기(돌아오는 무기 · 특수 탄 · 독 바람총 등)는 건드리지 않는다
for (const r of rows) { if (odd(r)) { r.k = 1; continue; } const tgt = base * (r.ranged ? RANGED_K : 1); r.k = Math.round(Math.min(3, Math.max(0.12, tgt / r.v)) * 100) / 100; if (Math.abs(r.k - 1) > 0.02) out[r.id] = r.k; }
for (const r of rows.sort((a, b) => a.ranged - b.ranged || a.cat.localeCompare(b.cat))) console.log(`${odd(r) ? '(제외) ' : ''}${r.ranged ? '원거리' : '근접  '} ${r.cat.padEnd(8)} ${r.name.padEnd(12)} mul당 초당 ${r.v.toFixed(2).padStart(6)}${GEN ? `  → 보정 ×${r.k}` : `  (보정 ×${WPN_BAL[r.id] ?? 1})`}`);
if (GEN) { writeFileSync(new URL('../public/js/data/wpnbal.js', import.meta.url), `// 자동 생성: node tools/wpnbal.mjs gen — 무기마다 평타 1초 평균 피해를 맞춘다 (손으로 고치지 않는다)\nexport const WPN_BAL = ${JSON.stringify(out)};\n`); console.log(`\n무기 ${Object.keys(out).length}개 보정 · 근접 기준 ${base.toFixed(1)} · 원거리 ×${RANGED_K}`); }

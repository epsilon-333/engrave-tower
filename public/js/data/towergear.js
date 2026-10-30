// 탑의 방어구 · 장신구 · 왼손 장비: 10단계(10층마다) × 셋. 탑에서만 드물게 떨어진다 (탑의 무기와 같은 자리에서).
import { ITEMS } from './items.js';
import { W_RARITY } from './weapons.js';

const SETS = [ // 단계마다 이름 머리 · 주력 능력치
  { t: 1, n: '이끼', a: { pres: 5, vit: 2 }, c: { agi: 2, sen: 2 }, o: { mag: 2, spi: 1 } },
  { t: 2, n: '늪지', a: { pres: 6, mres: 4 }, c: { toxicity: 3, sen: 2 }, o: { mag: 3, spi: 2 } },
  { t: 3, n: '용암', a: { pres: 8, vit: 4 }, c: { str: 3, fireAff: 2 }, o: { mag: 4, fireAff: 2 } },
  { t: 4, n: '서리', a: { mres: 8, pres: 6 }, c: { sen: 3, iceAff: 2 }, o: { mag: 4, iceAff: 2 } },
  { t: 5, n: '망령', a: { pres: 9, mres: 7 }, c: { agi: 4, sen: 3 }, o: { mag: 5, spi: 3 } },
  { t: 6, n: '심록', a: { pres: 10, vit: 6 }, c: { str: 4, vit: 3 }, o: { mag: 6, spi: 3 } },
  { t: 7, n: '부식', a: { mres: 11, pres: 8 }, c: { toxicity: 4, agi: 4 }, o: { mag: 6, spi: 4 } },
  { t: 8, n: '심연', a: { pres: 12, vit: 8 }, c: { str: 5, sen: 4 }, o: { mag: 7, fireAff: 3 } },
  { t: 9, n: '영겁', a: { mres: 13, pres: 10 }, c: { agi: 5, sen: 5 }, o: { mag: 8, iceAff: 3 } },
  { t: 10, n: '각인', a: { pres: 14, mres: 12, vit: 6 }, c: { str: 5, agi: 5, mag: 5 }, o: { mag: 9, spi: 5 } },
];
const KIND = [
  ['Armor', 'armor', '갑주', 'a', (t) => [{ type: 'mul', key: 'dmgTakenMul', v: 1 - 0.01 * t, text: `받는 피해 -${t}%` }]],
  ['Ring', 'acc', '반지', 'c', (t) => [{ type: 'add', key: 'crit', v: 0.005 * t, text: `치명타 확률 +${(0.5 * t).toFixed(1)}%` }]],
  ['Charm', 'off', '부적', 'o', (t) => [{ type: 'mul', key: 'magAtk', v: 1 + 0.015 * t, text: `마법 공격력 +${(1.5 * t).toFixed(1)}%` }]],
];
export const TOWER_GEAR = {};
for (const S of SETS) for (const [suf, slot, kn, key, fx] of KIND) {
  const id = 'tg' + S.t + suf, r = Math.min(4, Math.floor((S.t - 1) / 2)), R = W_RARITY[r];
  const stats = {}; for (const [k, v] of Object.entries(S[key])) stats[k] = v;
  const effects = fx(S.t);
  TOWER_GEAR[id] = { t: S.t, r };
  ITEMS[id] = {
    name: `${S.n}의 ${kn}`, slot, price: 0, towerGear: true, tier: S.t, rarity: r, rarityColor: R.color, stats, tags: [], effects,
    ...(slot === 'off' ? { off: { spell: 1 }, odesc: '마법을 온전한 힘으로 쓴다' } : {}),
    desc: `탑 ${S.t * 10 - 9}~${S.t * 10}층에서 드물게 나온다.`,
    lines: [`${R.name} · ${S.t}단계 (${S.t * 10 - 9}~${S.t * 10}층)`, ...effects.map((e) => e.text)],
  };
}
export const towerGearOf = (t) => Object.keys(TOWER_GEAR).filter((id) => TOWER_GEAR[id].t === t);

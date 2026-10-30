// 탑의 방어구 · 장신구 · 왼손 장비: 10단계(10층마다) × 갈래마다 셋 = 방어구 30 · 장신구 30 · 왼손 30.
// 탑에서만 드물게 떨어진다 (탑의 무기와 같은 자리에서). 단계가 높을수록 등급도 높다.
import { ITEMS } from './items.js';
import { W_RARITY } from './weapons.js';

const TIER_NAME = ['이끼', '늪지', '용암', '서리', '망령', '심록', '부식', '심연', '영겁', '각인'];
const pct = (v) => +(v * 100).toFixed(1);
const mainV = (t) => Math.round(2 + 1.2 * t), subV = (t) => Math.round(1 + 0.8 * t);
// [아이디 꼬리, 갈래, 이름, 능력치(t), 효과(t), 왼손 성질]
const KINDS = [
  ['Armor', 'armor', '판금', (t) => ({ pres: mainV(t) + 2, vit: subV(t) }), (t) => [{ type: 'mul', key: 'dmgTakenMul', v: 1 - 0.01 * t, text: `받는 피해 -${t}%` }]],
  ['Robe', 'armor', '로브', (t) => ({ mres: mainV(t) + 2, spi: subV(t) }), (t) => [{ type: 'mul', key: 'magAtk', v: 1 + 0.012 * t, text: `마법 공격력 +${pct(0.012 * t)}%` }]],
  ['Leather', 'armor', '가죽옷', (t) => ({ agi: mainV(t), sen: subV(t), pres: subV(t) }), (t) => [{ type: 'add', key: 'dodge', v: 0.004 * t, text: `회피 +${pct(0.004 * t)}%` }]],
  ['Ring', 'acc', '반지', (t) => ({ sen: mainV(t), agi: subV(t) }), (t) => [{ type: 'add', key: 'crit', v: 0.005 * t, text: `치명타 확률 +${pct(0.005 * t)}%` }]],
  ['Neck', 'acc', '목걸이', (t) => ({ str: mainV(t), vit: subV(t) }), (t) => [{ type: 'mul', key: 'maxHp', v: 1 + 0.012 * t, text: `최대 HP +${pct(0.012 * t)}%` }]],
  ['Earring', 'acc', '귀걸이', (t) => ({ mag: mainV(t), spi: subV(t) }), (t) => [{ type: 'mul', key: 'costMul', v: 1 - 0.008 * t, text: `스킬 자원 -${pct(0.008 * t)}%` }]],
  ['Shield', 'off', '방패', (t) => ({ pres: mainV(t), vit: subV(t) }), (t) => [{ type: 'mul', key: 'dmgTakenMul', v: 1 - 0.008 * t, text: `받는 피해 -${pct(0.008 * t)}%` }], { off: { shield: 1, parry: 1 }, odesc: '방패 · 받아치기 스킬을 온전히 쓴다' }],
  ['Charm', 'off', '부적', (t) => ({ mag: mainV(t), spi: subV(t) }), (t) => [{ type: 'mul', key: 'magAtk', v: 1 + 0.015 * t, text: `마법 공격력 +${pct(0.015 * t)}%` }], { off: { spell: 1 }, odesc: '마법을 온전한 힘으로 쓴다' }],
  ['Quiver', 'off', '화살통', (t) => ({ sen: mainV(t), agi: subV(t) }), (t) => [{ type: 'mul', key: 'atkSpeed', v: 1 + 0.01 * t, text: `공격 속도 +${t}%` }], { off: { shoot: 1 }, odesc: '쏘기 스킬을 온전한 힘으로 쓴다' }],
];
export const TOWER_GEAR = {};
for (let t = 1; t <= 10; t++) for (const [suf, slot, kn, stf, fxf, extra] of KINDS) {
  const id = 'tg' + t + suf, r = Math.min(4, Math.floor((t - 1) / 2)), R = W_RARITY[r], effects = fxf(t);
  TOWER_GEAR[id] = { t, r };
  ITEMS[id] = {
    name: `${TIER_NAME[t - 1]}의 ${kn}`, slot, price: 0, towerGear: true, tier: t, rarity: r, rarityColor: R.color, stats: stf(t), tags: [], effects, ...(extra || {}),
    desc: `탑 ${t * 10 - 9}~${t * 10}층에서 드물게 나온다.`,
    lines: [`${R.name} · ${t}단계 (${t * 10 - 9}~${t * 10}층)`, ...effects.map((e) => e.text)],
  };
}

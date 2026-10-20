// 요리 (집 부엌): 물고기 · 고기 · 채소 · 열매 · 곡식 · 버섯 · 약초 · 해초를 최대 5개 넣는다.
// 재료마다 회복량(최대 체력의 %)과 효과(종류 · 세기)가 있다. 효과가 같은 재료끼리 모을수록 강하고,
// 효과가 다른 재료를 섞으면 효과는 사라지고 회복만 남는다. 무엇을 넣었는지에 따라 요리 이름이 정해진다.
import { GOODS, FISH } from './goods.js';

const pct = (v) => Math.round(v * 100);
export const FOOD_EFFECTS = {
  atk: { name: '힘', pre: '힘이 솟는', color: '#ff8a5a', lv: [1.1, 1.18, 1.28], mods: (v) => ({ dmgMul: v }), text: (v) => `공격력 +${pct(v - 1)}%` },
  def: { name: '단단함', pre: '든든한', color: '#a8c0e8', lv: [0.9, 0.83, 0.75], mods: (v) => ({ dmgTakenMul: v }), text: (v) => `받는 피해 -${pct(1 - v)}%` },
  speed: { name: '날쌤', pre: '가뿐한', color: '#bfffd0', lv: [1.1, 1.17, 1.25], mods: (v) => ({ moveSpeed: v }), text: (v) => `이동 속도 +${pct(v - 1)}%` },
  haste: { name: '재빠름', pre: '재빠른', color: '#ffe080', lv: [1.1, 1.17, 1.25], mods: (v) => ({ atkSpeed: v }), text: (v) => `공격 속도 +${pct(v - 1)}%` },
  cdr: { name: '맑은 정신', pre: '머리가 맑아지는', color: '#c0a8ff', lv: [1.12, 1.22, 1.35], mods: (v) => ({ cdRate: v }), text: (v) => `스킬 재사용 대기 -${pct(1 - 1 / v)}%` },
  regen: { name: '기운', pre: '기운 나는', color: '#8af08a', lv: [0.004, 0.007, 0.011], mods: (v) => ({ regen: v }), text: (v) => `초당 체력 ${(v * 100).toFixed(1)}% 회복` },
  crit: { name: '날카로움', pre: '눈이 밝아지는', color: '#ffcf5a', lv: [0.06, 0.1, 0.15], mods: (v) => ({ crit: v }), text: (v) => `치명타 확률 +${pct(v)}%` },
  breath: { name: '긴 숨', pre: '숨이 긴', color: '#7ad8ff', lv: [1.6, 2.4, 3.5], mods: (v) => ({ breath: v }), text: (v) => `물속 숨 ×${v}` },
  luck: { name: '행운', pre: '행운의', color: '#f0d060', lv: [0.2, 0.35, 0.6], mods: (v) => ({ luck: v }), text: (v) => `귀한 물고기 · 몬스터 부산물이 나올 확률 +${pct(v)}%` },
};
export const EFFECT_DUR = [0, 150, 210, 300]; // 단계별 지속 (초 = 게임 분)

// 재료: kind(종류) · heal(회복 %) · eff(효과) · p(세기)
const F = (kind, heal, eff = null, p = 0) => ({ kind, heal, eff, p });
export const FOOD = {
  turnip: F('veg', 8), wheat: F('grain', 6), carrot: F('veg', 8, 'speed', 1), potato: F('veg', 10, 'def', 1), strawberry: F('fruit', 6, 'haste', 1), pumpkin: F('veg', 16, 'def', 2), starflower: F('herb', 18, 'luck', 3),
  herb: F('herb', 6, 'regen', 1), mushroom: F('mush', 6, 'cdr', 1), berry: F('fruit', 4), frostLily: F('herb', 6, 'cdr', 2), fireBloom: F('herb', 6, 'atk', 2), truffle: F('mush', 14, 'regen', 2), seaweed: F('sea', 4, 'breath', 1),
  beastMeat: F('meat', 12, 'atk', 1), crabMeat: F('meat', 10, 'def', 1), serpentMeat: F('meat', 10, 'breath', 1), frogLeg: F('meat', 7, 'speed', 1),
};
const FISH_EFF = {
  carp: ['regen', 1], bluegill: ['haste', 1], goldfish: ['luck', 1], mirrorMinnow: ['cdr', 1], catfish: ['def', 1], snakehead: ['atk', 1], koi: ['regen', 2], sturgeon: ['def', 2], goldCarp: ['luck', 3],
  minnow: ['speed', 1], sweetfish: ['regen', 1], trout: ['speed', 1], kkeokji: ['atk', 1], rainbowTrout: ['speed', 2], mandarin: ['crit', 2], salmon: ['atk', 2],
  smelt: ['cdr', 1], arcticChar: ['def', 1], icePike: ['crit', 2], discus: ['luck', 1], piranha: ['atk', 2], arowana: ['luck', 2], electricEel: ['haste', 2],
  loach: ['speed', 1], stickleback: ['crit', 1], bogEel: ['speed', 2], lungfish: ['breath', 2],
  seabream: ['regen', 1], flatfish: ['def', 1], squid: ['crit', 1], crab: ['def', 2], seahorse: ['breath', 2], cutlass: ['crit', 2], octopus: ['breath', 1], puffer: ['atk', 2], tuna: ['atk', 2], sunfish: ['breath', 3], angler: ['crit', 2], marlin: ['atk', 3], dragonCarp: ['breath', 3],
  caveFish: ['cdr', 1], glowJelly: ['cdr', 2], axolotl: ['regen', 2], crystalShrimp: ['cdr', 2], clownfish: ['breath', 1], coralFish: ['breath', 1],
  magmaCrab: ['def', 2], lavaEel: ['atk', 2], flameCarp: ['atk', 3], moonTrout: ['crit', 2], glowCatfish: ['cdr', 2], ghostJelly: ['breath', 2],
};
for (const [id, f] of Object.entries(FISH)) { const [e, p] = FISH_EFF[id] || []; FOOD[id] = F('fish', Math.round(Math.min(30, 4 + f.price / 11)), e || null, p || 0); }
export const KIND_NAME = { fish: '물고기', meat: '고기', veg: '채소', fruit: '열매', grain: '곡식', mush: '버섯', herb: '약초', sea: '해초' };
export const isFood = (id) => !!FOOD[id];
export const rawEdible = (id) => FOOD[id] && !['fish', 'meat'].includes(FOOD[id].kind); // 날로 먹을 수 있는 것 (물고기 · 고기는 익혀야 한다)

// 요리법: 넣은 재료의 종류를 보고 차례대로 맞는 것을 고른다 (마지막은 잡탕)
// icon: 그릇 모양(k)과 색 [그릇, 음식, 고명]
const has = (k, ...xs) => xs.every((x) => k.has(x));
const only = (k, ...xs) => [...k].every((x) => xs.includes(x));
export const RECIPES = [
  { id: 'starTea', name: '별빛 꽃차', k: 'cup', c: ['#e8e0f0', '#d8c8ff', '#fff2a0'], test: (k, ids) => ids.includes('starflower') && only(k, 'herb', 'fruit') },
  { id: 'pumpkinSoup', name: '호박죽', k: 'bowl', c: ['#c8a070', '#f0a040', '#5aa848'], test: (k, ids) => ids.includes('pumpkin') && only(k, 'veg', 'grain') },
  { id: 'elixir', name: '약초 물약', k: 'bottle', c: ['#d8e8f0', '#8af08a', '#8a5a32'], test: (k) => only(k, 'herb') },
  { id: 'fruitTea', name: '열매 약차', k: 'cup', c: ['#e8e0f0', '#e8708a', '#8af08a'], test: (k) => k.size === 2 && has(k, 'herb', 'fruit') },
  { id: 'grilledFish', name: '생선구이', k: 'plateFish', c: ['#e8e4dc', '#c8884a', '#5aa848'], test: (k, ids) => only(k, 'fish') && ids.length === 1 },
  { id: 'fishPlatter', name: '모둠 생선구이', k: 'plateFish2', c: ['#e8e4dc', '#c8884a', '#e8c060'], test: (k) => only(k, 'fish') },
  { id: 'seafoodSoup', name: '해물 미역국', k: 'bowl', c: ['#a8b8c8', '#4a8a5a', '#f0a080'], test: (k) => has(k, 'sea') && k.size >= 2 && only(k, 'fish', 'sea', 'veg', 'meat') },
  { id: 'seaweedSoup', name: '미역국', k: 'bowl', c: ['#a8b8c8', '#3a7a4a', '#c8e8c0'], test: (k) => only(k, 'sea') },
  { id: 'fishStew', name: '생선 채소찜', k: 'bowl', c: ['#8a6a4a', '#e8a070', '#5aa848'], test: (k) => k.size === 2 && has(k, 'fish', 'veg') },
  { id: 'fishSoup', name: '약초 생선탕', k: 'bowl', c: ['#8a6a4a', '#e8d8a0', '#3e8a32'], test: (k) => k.size === 2 && has(k, 'fish', 'herb') },
  { id: 'sushi', name: '생선 초밥', k: 'sushi', c: ['#2a2a32', '#f4f0e8', '#f08a6a'], test: (k) => k.size === 2 && has(k, 'fish', 'grain') },
  { id: 'fishHotpot', name: '버섯 생선전골', k: 'pot', c: ['#4a4a54', '#e8a040', '#c84a3a'], test: (k) => k.size === 2 && has(k, 'fish', 'mush') },
  { id: 'feast', name: '바다와 들의 진수성찬', k: 'feast', c: ['#e8e4dc', '#c8604a', '#c8884a'], test: (k) => has(k, 'meat', 'fish') },
  { id: 'skewer', name: '고기 꼬치', k: 'skewer', c: ['#8a5a32', '#b8503a', '#5aa848'], test: (k) => only(k, 'meat') },
  { id: 'stirFry', name: '고기 채소 볶음', k: 'plate', c: ['#e8e4dc', '#b8503a', '#5aa848'], test: (k) => k.size === 2 && has(k, 'meat', 'veg') },
  { id: 'meatBowl', name: '고기 덮밥', k: 'bowl', c: ['#8a6a4a', '#f4f0e8', '#b8503a'], test: (k) => k.size === 2 && has(k, 'meat', 'grain') },
  { id: 'meatHotpot', name: '버섯 고기 전골', k: 'pot', c: ['#4a4a54', '#c86a3a', '#e8d8b0'], test: (k) => k.size === 2 && has(k, 'meat', 'mush') },
  { id: 'herbMeat', name: '약초 고기찜', k: 'plate', c: ['#e8e4dc', '#a8503a', '#3e8a32'], test: (k) => k.size === 2 && has(k, 'meat', 'herb') },
  { id: 'roastVeg', name: '구운 채소', k: 'plate', c: ['#e8e4dc', '#e8a040', '#5aa848'], test: (k, ids) => only(k, 'veg') && new Set(ids).size === 1 },
  { id: 'vegSoup', name: '채소 수프', k: 'bowl', c: ['#a8b8c8', '#e8a040', '#5aa848'], test: (k) => only(k, 'veg') },
  { id: 'porridge', name: '채소 죽', k: 'bowl', c: ['#8a6a4a', '#f0e4c0', '#5aa848'], test: (k) => k.size === 2 && has(k, 'veg', 'grain') },
  { id: 'salad', name: '들풀 샐러드', k: 'bowl', c: ['#e8e4dc', '#6ac04a', '#e8603a'], test: (k) => only(k, 'veg', 'herb', 'fruit') && has(k, 'herb') },
  { id: 'bread', name: '갓 구운 빵', k: 'bread', c: ['#c88a4a', '#f0c880', '#8a5a2a'], test: (k) => only(k, 'grain') },
  { id: 'fruitPie', name: '과일 파이', k: 'pie', c: ['#c88a4a', '#e8304a', '#f0c880'], test: (k) => k.size === 2 && has(k, 'fruit', 'grain') },
  { id: 'fruitSkewer', name: '과일 꼬치', k: 'skewer', c: ['#8a5a32', '#e8304a', '#ffd040'], test: (k) => only(k, 'fruit') },
  { id: 'mushGrill', name: '버섯구이', k: 'skewer', c: ['#8a5a32', '#c84a3a', '#f4ecd8'], test: (k) => only(k, 'mush') },
  { id: 'mushPorridge', name: '버섯 약죽', k: 'bowl', c: ['#8a6a4a', '#e8d8b0', '#c84a3a'], test: (k) => only(k, 'mush', 'herb', 'grain') && has(k, 'mush') },
  { id: 'stew', name: '잡탕', k: 'pot', c: ['#4a4a54', '#a8704a', '#5aa848'], test: () => true },
];
export const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

// 무엇이 될까: 재료 id 배열(1~5개) → 요리 정보
export function cookPreview(ids) {
  const list = ids.filter((id) => FOOD[id]);
  if (!list.length) return null;
  const kinds = new Set(list.map((id) => FOOD[id].kind));
  const r = RECIPES.find((x) => x.test(kinds, list));
  const effs = new Set(list.map((id) => FOOD[id].eff).filter(Boolean));
  let eff = null, lvl = 0, mixed = false;
  if (effs.size === 1) {
    eff = [...effs][0];
    const pow = list.reduce((a, id) => a + (FOOD[id].eff === eff ? FOOD[id].p : 0), 0);
    lvl = pow >= 5 ? 3 : pow >= 3 ? 2 : 1;
  } else if (effs.size > 1) mixed = true;
  // 회복량 · 값은 5 단위로 맞춘다 (비슷한 요리끼리 가방 한 칸에 쌓이게)
  const heal = Math.min(100, Math.max(5, Math.round(list.reduce((a, id) => a + FOOD[id].heal, 0) * 1.5 / 5) * 5));
  const price = Math.max(5, Math.round(list.reduce((a, id) => a + (GOODS[id]?.price || 2), 0) * 1.3 / 5) * 5);
  return { recipe: r.id, eff, lvl, heal, mixed, price, key: dishKey(r.id, eff, lvl, heal, price) };
}
export const dishKey = (recipe, eff, lvl, heal, price) => `dish:${recipe}:${eff || '-'}:${lvl || 0}:${heal}:${price}`;
export function parseDish(key) {
  if (!key?.startsWith('dish:')) return null;
  const [, recipe, eff, lvl, heal, price] = key.split(':');
  return RECIPE[recipe] ? { recipe, eff: eff === '-' ? null : eff, lvl: +lvl || 0, heal: +heal || 0, price: +price || 1 } : null;
}
export function dishName(d) {
  const r = RECIPE[d.recipe], E = d.eff && FOOD_EFFECTS[d.eff];
  return E ? `${E.pre} ${r.name}` : r.name;
}
export function dishEffectText(d) {
  if (!d.eff) return '';
  const E = FOOD_EFFECTS[d.eff], v = E.lv[d.lvl - 1];
  return `${E.text(v)} · ${Math.round(EFFECT_DUR[d.lvl] / 60 * 10) / 10}분`;
}
// 가방에 요리를 넣을 때 물건 목록에 올린다 (요리는 재료에 따라 회복량 · 효과가 달라서 그때그때 만든다)
export function registerDish(key) {
  if (GOODS[key]) return GOODS[key];
  const d = parseDish(key);
  if (!d) return null;
  const r = RECIPE[d.recipe], E = d.eff && FOOD_EFFECTS[d.eff];
  const stars = d.lvl ? ' ' + '★'.repeat(d.lvl) : '';
  return (GOODS[key] = {
    name: dishName(d) + stars, cat: 'food', price: d.price, dish: d,
    desc: `회복 ${d.heal}%${E ? ' · ' + dishEffectText(d) : ''}`,
    icon: { t: 'dish', k: r.k, c: E && r.id === 'elixir' ? [r.c[0], E.color, r.c[2]] : r.c },
  });
}
export function registerAllDishes(...stores) { for (const st of stores) for (const k of Object.keys(st || {})) if (k.startsWith('dish:')) registerDish(k); }

// 먹기: 회복량(최대 체력의 몫)과 오래가는 효과 (같은 '식사' 칸 하나만, 새로 먹으면 바뀐다)
export function eatInfo(id) {
  const d = parseDish(id);
  if (d) return { heal: d.heal / 100, eff: d.eff, lvl: d.lvl, name: dishName(d) };
  if (rawEdible(id)) return { heal: FOOD[id].heal / 100, eff: null, lvl: 0, name: GOODS[id]?.name || id };
  return null;
}
export function mealEffect(info, nowAbs) {
  if (!info.eff) return null;
  const E = FOOD_EFFECTS[info.eff], v = E.lv[info.lvl - 1], dur = EFFECT_DUR[info.lvl];
  return { id: 'meal', name: `${E.name}${'★'.repeat(info.lvl)}`, mods: E.mods(v), color: E.color, until: nowAbs + dur, dur, src: 'meal' };
}

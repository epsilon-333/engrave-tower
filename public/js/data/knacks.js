// 숙련: 같은 행동을 되풀이하다 보면 어느 순간 기술을 깨닫는다.
// 문턱(min)을 넘은 뒤부터 그 행동을 할 때마다 chance 확률로 깨닫고, 못 깨달은 채 오래 할수록 확률이 조금씩 오른다.
// 언제 깨달을지는 아무도 모른다 — 같은 걸 오래 한 사람도 운이 없으면 늦고, 운이 좋으면 금방 깨닫는다.
// kind 'life'는 늘 켜져 있는 생활 기술(키 없이 저절로), 'skill'은 Q·E·R·F에 넣는 기술(제어 기술은 상점에서 팔지 않고 숙련으로만 얻는다).
export const KNACKS = {
  // ── 생활 (저절로 발동) ──
  lumber: { name: '벌목 요령', act: 'chop', min: 25, chance: 0.04, kind: 'life', desc: '나무를 한 번 더 세게 찍는다 · 나무가 하나 더 나올 확률 30%' },
  miner: { name: '광부의 눈', act: 'mine', min: 30, chance: 0.04, kind: 'life', desc: '광석 캐는 속도 +25% · 덤 광석 확률 20%' },
  forager: { name: '채집가', act: 'forage', min: 30, chance: 0.04, kind: 'life', desc: '손으로 줍는 것이 30% 확률로 하나 더' },
  digger: { name: '발굴가', act: 'dig', min: 15, chance: 0.06, kind: 'life', desc: '땅을 팔 때 25% 확률로 한 번 더 뒤진다' },
  angler: { name: '낚시꾼의 감', act: 'fish', min: 20, chance: 0.05, kind: 'life', desc: '입질이 25% 빨리 온다' },
  farmer: { name: '농부의 손', act: 'harvest', min: 25, chance: 0.05, kind: 'life', desc: '수확할 때 30% 확률로 하나 더' },
  cook: { name: '손맛', act: 'cook', min: 15, chance: 0.06, kind: 'life', desc: '요리를 먹으면 회복량 +20%' },
  haggler: { name: '흥정', act: 'sell', min: 40, chance: 0.03, kind: 'life', desc: '물건을 팔 때 값 +10%' },
  swimmer: { name: '물개', act: 'swim', min: 240, chance: 0.006, kind: 'life', desc: '헤엄 속도 +30% · 물속 숨 +6초' }, // swim: 헤엄친 초
  // ── 몸으로 익히는 기술 ──
  windStep: { act: 'dodge', min: 40, chance: 0.03, kind: 'skill', skill: 'windStep', hint: '공격을 피하다 보면' },
  leap: { act: 'dash', min: 150, chance: 0.012, kind: 'skill', skill: 'leap', hint: '구르고 또 구르다 보면' },
  shadowStep: { act: 'backstab', min: 30, chance: 0.04, kind: 'skill', skill: 'shadowStep', hint: '적의 등 뒤를 치다 보면' },
  retreatShot: { act: 'rangedKill', min: 50, chance: 0.03, kind: 'skill', skill: 'retreatShot', hint: '멀리서 쏘아 쓰러뜨리다 보면' },
  enchantFire: { act: 'killBurning', min: 40, chance: 0.03, kind: 'skill', skill: 'enchantFire', hint: '불타는 적을 쓰러뜨리다 보면' },
  enchantIce: { act: 'killChilled', min: 40, chance: 0.03, kind: 'skill', skill: 'enchantIce', hint: '얼어붙은 적을 쓰러뜨리다 보면' },
  enchantPoison: { act: 'killPoisoned', min: 40, chance: 0.03, kind: 'skill', skill: 'enchantPoison', hint: '중독된 적을 쓰러뜨리다 보면' },
  enchantLightning: { act: 'killShocked', min: 35, chance: 0.03, kind: 'skill', skill: 'enchantLightning', hint: '감전된 적을 쓰러뜨리다 보면' },
  // ── 제어(CC) 기술: 사거나 배울 수 없고, 이렇게만 얻는다 ──
  vineSnare: { act: 'forage', min: 50, chance: 0.02, kind: 'skill', skill: 'vineSnare', hint: '덩굴과 풀을 오래 만지다 보면' },
  harpoon: { act: 'fish', min: 35, chance: 0.03, kind: 'skill', skill: 'harpoon', hint: '물고기를 낚아 올리다 보면' },
  snare: { act: 'hunt', min: 40, chance: 0.03, kind: 'skill', skill: 'snare', hint: '짐승을 사냥하다 보면' },
  frostChain: { act: 'killChilled', min: 25, chance: 0.03, kind: 'skill', skill: 'frostChain', hint: '얼어붙은 적을 쓰러뜨리다 보면' },
  pushArrow: { act: 'rangedHit', min: 300, chance: 0.006, kind: 'skill', skill: 'pushArrow', hint: '화살 · 마탄을 수없이 맞히다 보면' },
  slowField: { act: 'castSpell', min: 150, chance: 0.01, kind: 'skill', skill: 'slowField', hint: '주문을 외우고 또 외우다 보면' },
  shieldBash: { act: 'block', min: 30, chance: 0.04, kind: 'skill', skill: 'shieldBash', hint: '공격을 막고 받아치다 보면' },
};
export const CC_SKILLS = new Set(Object.values(KNACKS).filter((k) => k.kind === 'skill' && ['vineSnare', 'harpoon', 'snare', 'frostChain', 'pushArrow', 'slowField', 'shieldBash'].includes(k.skill)).map((k) => k.skill));
const BY_ACT = {};
for (const [id, k] of Object.entries(KNACKS)) (BY_ACT[k.act] ||= []).push(id);
// 짐승 (사냥 숙련)
export const BEASTS = /wolf|hyena|raptor|boar|bear|spider|bat|scorpion|beetle|wasp|crab|serpent|leech|toad/i;

export const newKnack = () => ({ n: {}, got: {}, miss: {} });
export const hasKnack = (k, id) => !!k?.got?.[id];
// 행동 한 번: 세고, 문턱을 넘었으면 굴려 본다. 새로 깨달은 숙련 id 목록을 돌려준다
export function knackTick(k, act, rand = Math.random, n = 1) {
  if (!k) return [];
  k.n[act] = (k.n[act] || 0) + n;
  const out = [];
  for (const id of BY_ACT[act] || []) {
    const def = KNACKS[id];
    if (k.got[id] || k.n[act] < def.min) continue;
    const tries = (k.miss[id] = (k.miss[id] || 0) + 1);
    if (rand() < def.chance * (1 + tries * 0.02)) { k.got[id] = true; out.push(id); }
  }
  return out;
}

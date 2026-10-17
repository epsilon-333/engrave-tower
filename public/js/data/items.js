// 장비: 무기 / 방어구 / 장신구 2. 조건부 효과가 조합의 연결 고리가 된다.
// weapon.kind: melee | proj, weapon.dmg: phys | mag

export const ITEMS = {
  // 무기
  rustySword: { name: '녹슨 검', slot: 'weapon', price: 0, weapon: { kind: 'melee', dmg: 'phys', mul: 0.9, speed: 1.6, range: 30, arc: 1.9 }, stats: {}, tags: [] },
  huntBow: { name: '사냥 활', slot: 'weapon', price: 40, weapon: { kind: 'proj', dmg: 'phys', mul: 0.95, speed: 1.6, projSpeed: 300, range: 200, pierce: 1 }, stats: { sen: 3 }, tags: [] },
  apprenticeStaff: { name: '견습 지팡이', slot: 'weapon', price: 40, weapon: { kind: 'proj', dmg: 'mag', mul: 1.6, speed: 1.5, projSpeed: 240, range: 190, splash: 26 }, stats: { mag: 3 }, tags: [] },
  dagger: { name: '단검', slot: 'weapon', price: 50, weapon: { kind: 'melee', dmg: 'phys', mul: 0.7, speed: 3.0, range: 22, arc: 1.4 }, stats: { agi: 3 }, tags: [] },
  battleAxe: { name: '전투 도끼', slot: 'weapon', price: 90, req: { str: 25 }, weapon: { kind: 'melee', dmg: 'phys', mul: 1.45, speed: 0.95, range: 34, arc: 2.2 }, stats: { str: 4 }, tags: ['brawl'] },
  tome: { name: '불꽃 마도서', slot: 'weapon', price: 110, req: { mag: 25 }, weapon: { kind: 'proj', dmg: 'mag', mul: 0.55, speed: 1.4, projSpeed: 230, range: 180, count: 3, spread: 0.22, splash: 20 }, stats: { mag: 4 }, tags: ['fire'] },
  rotDagger: { name: '썩은 단검', slot: 'weapon', price: 140, weapon: { kind: 'melee', dmg: 'phys', mul: 0.5, speed: 3.0, range: 22, arc: 1.4 }, stats: { toxicity: 4 }, tags: ['poison'],
    effects: [{ when: { tag: 'poison', gte: 2 }, type: 'on', event: 'hit', chance: 1, action: { status: 'poison', stacks: 1 }, text: '공격마다 중독' }] },
  riftGreatsword: { name: '균열의 대검', slot: 'weapon', price: 260, req: { str: 40 }, weapon: { kind: 'melee', dmg: 'phys', mul: 2.2, speed: 0.85, range: 40, arc: 2.6 }, stats: { str: 8 }, tags: ['giant'],
    effects: [{ when: { stat: 'str', gte: 50 }, type: 'on', event: 'hit', chance: 0.3, action: { aoe: { r: 50, mul: 0.8, type: 'phys' } }, text: '30% 확률 충격파' }] },
  frostWand: { name: '서리 완드', slot: 'weapon', price: 200, req: { mag: 30 }, weapon: { kind: 'proj', dmg: 'mag', mul: 1.2, speed: 1.5, projSpeed: 260, range: 190, pierce: 2, splash: 18 }, stats: { iceAff: 5 }, tags: ['ice'] },

  // 방어구
  leather: { name: '가죽 갑옷', slot: 'armor', price: 30, stats: { pres: 6, agi: 2 }, tags: [] },
  chainmail: { name: '사슬 갑옷', slot: 'armor', price: 90, req: { str: 20 }, stats: { pres: 18, agi: -3 }, tags: ['giant'] },
  robe: { name: '마법사 로브', slot: 'armor', price: 80, stats: { mres: 16, spi: 4 }, tags: [] },
  mirrorShield: { name: '거울 방패 갑주', slot: 'armor', price: 220, stats: { pres: 10, mres: 10 }, tags: ['reflect'],
    effects: [{ when: { tag: 'reflect', gte: 2 }, type: 'mul', key: 'reflectMul', v: 2, text: '반사 피해 2배' }] },
  bloodPlate: { name: '피의 판금', slot: 'armor', price: 240, req: { str: 35 }, stats: { pres: 22, vit: 6 }, tags: ['drain', 'giant'],
    effects: [{ when: { stat: 'lifesteal', gte: 12 }, type: 'mul', key: 'dmgMul', v: 1.15, text: '피해 +15%' }] },

  // 장신구
  scholarRing: { name: '학자의 반지', slot: 'acc', price: 120, stats: { mag: 3 }, tags: [],
    effects: [{ when: { cmp: ['mag', '>', 'str'] }, type: 'flag', flag: 'physToMag', text: '물리 공격을 마법 피해로 전환' }] },
  balanceCharm: { name: '균형의 부적', slot: 'acc', price: 100, stats: { pres: 3, mres: 3 }, tags: [],
    effects: [{ when: { diff: ['pres', 'mres'], lte: 8 }, type: 'add', key: 'statusRes', v: 0.3, text: '상태이상 저항 +30%' }] },
  berserkerNeck: { name: '광전사의 목걸이', slot: 'acc', price: 150, stats: { str: 3 }, tags: ['brawl'],
    effects: [{ when: { extreme: true }, type: 'mul', key: 'dmgMul', v: 1.25, text: '피해 +25%' }] },
  poisonVial: { name: '독병 목걸이', slot: 'acc', price: 70, stats: { toxicity: 3 }, tags: ['poison'] },
  emberRing: { name: '불씨 반지', slot: 'acc', price: 70, stats: { fireAff: 4 }, tags: ['fire'] },
  frostRing: { name: '서리 반지', slot: 'acc', price: 70, stats: { iceAff: 4 }, tags: ['ice'] },
  wolfTooth: { name: '늑대 이빨', slot: 'acc', price: 60, stats: { agi: 3, sen: 3 }, tags: ['wind'] },
  hunterEye: { name: '사냥꾼의 눈', slot: 'acc', price: 160, stats: { sen: 6 }, tags: ['shadow'],
    effects: [{ when: { stat: 'sen', gte: 40 }, type: 'stat', stat: 'pierce', v: 25, text: '관통 +25%' }] },
  sageStone: { name: '현자의 돌', slot: 'acc', price: 180, stats: { spi: 6 }, tags: [],
    effects: [{ when: { minBase: 20 }, type: 'mul', key: 'dmgMul', v: 1.2, text: '피해 +20% (만능)' }] },
};

export const STARTER_ITEMS = ['rustySword'];

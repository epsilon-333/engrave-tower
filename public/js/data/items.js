// 장비: 무기 / 방어구 / 장신구 2. 조건부 효과가 조합의 연결 고리가 된다.
// weapon.kind: melee | proj, weapon.dmg: phys | mag
// 무기 고유 특징: hits(연타), shape:'thrust'(찌르기), crit/critDmg, armorBreak(갑옷 부수기),
//   charge(당길수록 강해짐), boomerang(되돌아옴), onHit(상태이상), mana(마법 1회 소모), skill(Q)

// 무기 스킬 (Q / 우클릭)
export const WEAPON_SKILLS = {
  spin: { name: '회전베기', desc: '주변을 한 바퀴 벤다', cd: 6 },
  slam: { name: '충전 일격', desc: '앞쪽을 강하게 내려찍어 큰 피해와 경직', cd: 10 },
  dashStab: { name: '돌진 찌르기', desc: '조준 방향으로 돌진하며 경로의 적을 찌른다 (돌진 중 무적)', cd: 5 },
  whirl: { name: '회오리', desc: '1.2초 동안 돌면서 주변을 계속 벤다', cd: 8 },
  volley: { name: '일제 사격', desc: '관통 화살 5발을 부채꼴로 쏜다', cd: 6 },
  rain: { name: '화살비', desc: '조준한 곳에 화살이 쏟아진다', cd: 8 },
  axeStorm: { name: '도끼 폭풍', desc: '돌아오는 도끼 8개를 사방으로 던진다', cd: 7 },
  nova: { name: '마력 폭발', desc: '주변에 마력을 폭발시킨다', cd: 7, mana: 25 },
  frostRing: { name: '서리 고리', desc: '주변을 크게 얼린다 (냉기 3중첩)', cd: 7, mana: 20 },
  poisonPool: { name: '역병 웅덩이', desc: '조준한 곳에 진한 독 웅덩이를 만든다', cd: 7, mana: 20 },
  meteor: { name: '유성', desc: '잠시 뒤 조준한 곳에 거대한 마력 덩어리가 떨어진다', cd: 10, mana: 40 },
};

export const ITEMS = {
  // ── 근접 무기 ──
  knightSword: { name: '기사의 검', slot: 'weapon', price: 0, starter: true, weapon: { kind: 'melee', dmg: 'phys', mul: 1.0, speed: 1.5, range: 30, arc: 1.9, skill: 'spin' }, stats: { pres: 3 }, tags: [] },
  rustySword: { name: '녹슨 검', slot: 'weapon', price: 0, weapon: { kind: 'melee', dmg: 'phys', mul: 0.9, speed: 1.6, range: 30, arc: 1.9, skill: 'spin' }, stats: {}, tags: [] },
  dagger: { name: '단검', slot: 'weapon', price: 0, starter: true, weapon: { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.7, speed: 3.0, range: 24, arc: 1.5, skill: 'dashStab' }, stats: { agi: 3 }, tags: [] },
  heavySword: { name: '무거운 검', slot: 'weapon', price: 0, starter: true, weapon: { kind: 'melee', dmg: 'phys', mul: 1.3, speed: 0.95, range: 36, arc: 2.2, skill: 'slam' }, stats: { vit: 3 }, tags: [] },
  handAxe: { name: '손도끼', slot: 'weapon', price: 0, starter: true, weapon: { kind: 'melee', dmg: 'phys', mul: 1.15, speed: 1.3, range: 30, arc: 2.0, skill: 'spin' }, stats: { str: 2 }, tags: [] },
  dualBlades: { name: '쌍검', slot: 'weapon', price: 120, weapon: { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.55, hits: 2, speed: 2.2, range: 24, arc: 1.6, skill: 'dashStab', onHit: { status: 'bleed', stacks: 1, chance: 0.25 } }, stats: { agi: 3 }, tags: ['bleed'] },
  katana: { name: '카타나', slot: 'weapon', price: 200, weapon: { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.88, speed: 1.7, range: 32, arc: 1.6, crit: 0.12, critDmg: 0.25, skill: 'dashStab' }, stats: { sen: 4 }, tags: ['shadow'] },
  spear: { name: '창', slot: 'weapon', price: 150, weapon: { kind: 'melee', dmg: 'phys', mul: 1.2, speed: 1.3, range: 46, shape: 'thrust', width: 10, skill: 'dashStab' }, stats: { str: 2, agi: 2 }, tags: [] },
  battleAxe: { name: '전투 도끼', slot: 'weapon', price: 90, req: { str: 25 }, weapon: { kind: 'melee', dmg: 'phys', mul: 1.45, speed: 0.95, range: 34, arc: 2.2, skill: 'spin' }, stats: { str: 4 }, tags: ['brawl'] },
  doubleAxe: { name: '양날 도끼', slot: 'weapon', price: 230, req: { str: 35 }, weapon: { kind: 'melee', dmg: 'phys', mul: 1.2, speed: 0.9, range: 32, arc: Math.PI * 2, skill: 'whirl' }, stats: { str: 5, vit: 3 }, tags: ['brawl'] },
  mace: { name: '철퇴', slot: 'weapon', price: 160, weapon: { kind: 'melee', dmg: 'phys', mul: 1.25, speed: 1.2, range: 28, arc: 1.8, armorBreak: true, skill: 'slam' }, stats: { str: 3 }, tags: ['giant'] },
  rotDagger: { name: '썩은 단검', slot: 'weapon', price: 140, weapon: { kind: 'melee', dmg: 'phys', mul: 0.55, speed: 3.0, range: 22, arc: 1.4, skill: 'dashStab' }, stats: { toxicity: 4 }, tags: ['poison'],
    effects: [{ when: { tag: 'poison', gte: 2 }, type: 'on', event: 'hit', chance: 1, action: { status: 'poison', stacks: 1 }, text: '공격마다 중독' }] },
  riftGreatsword: { name: '균열의 대검', slot: 'weapon', price: 260, req: { str: 40 }, weapon: { kind: 'melee', dmg: 'phys', mul: 1.75, speed: 0.85, range: 40, arc: 2.6, skill: 'slam' }, stats: { str: 8 }, tags: ['giant'],
    effects: [{ when: { stat: 'str', gte: 50 }, type: 'on', event: 'hit', chance: 0.3, action: { aoe: { r: 50, mul: 0.8, type: 'phys' } }, text: '30% 확률 충격파' }] },

  // ── 원거리 물리 (마나 없음) ──
  huntBow: { name: '사냥 활', slot: 'weapon', price: 0, starter: true, weapon: { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 1.3, speed: 1.6, projSpeed: 300, range: 200, pierce: 1, skill: 'volley' }, stats: { sen: 3 }, tags: [] },
  longbow: { name: '장궁', slot: 'weapon', price: 180, weapon: { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 1.12, speed: 1.0, projSpeed: 360, range: 260, pierce: 2, charge: true, skill: 'rain' }, stats: { sen: 4, agi: 2 }, tags: ['wind'] },
  throwingAxe: { name: '투척 도끼', slot: 'weapon', price: 140, weapon: { kind: 'proj', dmg: 'phys', mul: 1.1, speed: 1.3, projSpeed: 220, range: 120, boomerang: true, skill: 'axeStorm' }, stats: { str: 3 }, tags: ['brawl'] },

  // ── 마법 (마나 소모) ──
  apprenticeWand: { name: '견습 서리 완드', slot: 'weapon', price: 0, starter: true, weapon: { kind: 'proj', dmg: 'mag', mul: 0.9, speed: 2.0, projSpeed: 260, range: 180, mana: 4, onHit: { status: 'chill', stacks: 1, chance: 0.35 }, skill: 'frostRing' }, stats: { iceAff: 2 }, tags: [] },
  oldTome: { name: '낡은 마도서', slot: 'weapon', price: 0, starter: true, weapon: { kind: 'proj', dmg: 'mag', mul: 0.45, speed: 1.3, projSpeed: 220, range: 175, count: 3, spread: 0.22, splash: 18, mana: 6, onHit: { status: 'burn', stacks: 1, chance: 0.3 }, skill: 'nova' }, stats: { fireAff: 2 }, tags: [] },
  mossStaff: { name: '이끼 지팡이', slot: 'weapon', price: 0, starter: true, weapon: { kind: 'proj', dmg: 'mag', mul: 1.0, speed: 1.2, projSpeed: 170, range: 180, mana: 6, onHit: { status: 'poison', stacks: 2, chance: 1 }, skill: 'poisonPool' }, stats: { toxicity: 2 }, tags: [] },
  apprenticeStaff: { name: '견습 지팡이', slot: 'weapon', price: 40, weapon: { kind: 'proj', dmg: 'mag', mul: 1.6, speed: 1.5, projSpeed: 240, range: 190, splash: 26, mana: 5, skill: 'nova' }, stats: { mag: 3 }, tags: [] },
  frostWand: { name: '서리 완드', slot: 'weapon', price: 200, req: { mag: 30 }, weapon: { kind: 'proj', dmg: 'mag', mul: 1.25, speed: 1.6, projSpeed: 260, range: 190, pierce: 2, splash: 18, mana: 5, onHit: { status: 'chill', stacks: 1, chance: 0.45 }, skill: 'frostRing' }, stats: { iceAff: 5 }, tags: ['ice'] },
  tome: { name: '불꽃 마도서', slot: 'weapon', price: 110, req: { mag: 25 }, weapon: { kind: 'proj', dmg: 'mag', mul: 0.62, speed: 1.4, projSpeed: 230, range: 180, count: 3, spread: 0.22, splash: 20, mana: 7, onHit: { status: 'burn', stacks: 1, chance: 0.35 }, skill: 'nova' }, stats: { mag: 4 }, tags: ['fire'] },
  poisonStaff: { name: '역병 지팡이', slot: 'weapon', price: 200, req: { mag: 25 }, weapon: { kind: 'proj', dmg: 'mag', mul: 1.3, speed: 1.2, projSpeed: 170, range: 185, mana: 7, onHit: { status: 'poison', stacks: 3, chance: 1 }, skill: 'poisonPool' }, stats: { toxicity: 5 }, tags: ['poison'] },
  archStaff: { name: '대마법사의 지팡이', slot: 'weapon', price: 320, req: { mag: 45 }, weapon: { kind: 'proj', dmg: 'mag', mul: 2.6, speed: 0.8, projSpeed: 280, range: 200, splash: 30, mana: 14, skill: 'meteor' }, stats: { mag: 8, spi: 4 }, tags: [],
    effects: [{ type: 'mul', key: 'reactionMul', v: 1.2, text: '원소 반응 피해 +20%' }] },

  // ── 방어구 ──
  leather: { name: '가죽 갑옷', slot: 'armor', price: 30, stats: { pres: 6, agi: 2 }, tags: [] },
  chainmail: { name: '사슬 갑옷', slot: 'armor', price: 90, req: { str: 20 }, stats: { pres: 18, agi: -3 }, tags: ['giant'] },
  robe: { name: '마법사 로브', slot: 'armor', price: 80, stats: { mres: 16, spi: 4 }, tags: [] },
  mirrorShield: { name: '거울 방패 갑주', slot: 'armor', price: 220, stats: { pres: 10, mres: 10 }, tags: ['reflect'],
    effects: [{ when: { tag: 'reflect', gte: 2 }, type: 'mul', key: 'reflectMul', v: 2, text: '반사 피해 2배' }] },
  bloodPlate: { name: '피의 판금', slot: 'armor', price: 240, req: { str: 35 }, stats: { pres: 22, vit: 6 }, tags: ['drain', 'giant'],
    effects: [{ when: { stat: 'lifesteal', gte: 12 }, type: 'mul', key: 'dmgMul', v: 1.15, text: '피해 +15%' }] },
  shadowGarb: { name: '그림자 옷', slot: 'armor', price: 150, stats: { agi: 5, sen: 3, pres: 4 }, tags: ['shadow'] },
  windCloak: { name: '바람 망토', slot: 'armor', price: 150, stats: { agi: 6, mres: 6 }, tags: ['wind'] },

  // ── 장신구 ──
  scholarRing: { name: '학자의 반지', slot: 'acc', price: 120, stats: { mag: 3 }, tags: [],
    effects: [{ when: { cmp: ['mag', '>', 'str'] }, type: 'flag', flag: 'physToMag', text: '물리 공격을 마법 피해로 전환' }] },
  balanceCharm: { name: '균형의 부적', slot: 'acc', price: 100, stats: { pres: 3, mres: 3 }, tags: [],
    effects: [{ when: { diff: ['pres', 'mres'], lte: 8 }, type: 'add', key: 'statusRes', v: 0.3, text: '상태이상 저항 +30%' }] },
  berserkerNeck: { name: '광전사의 목걸이', slot: 'acc', price: 150, stats: { str: 3 }, tags: ['brawl'],
    effects: [{ when: { extreme: true }, type: 'mul', key: 'dmgMul', v: 1.2, text: '피해 +20%' }] },
  poisonVial: { name: '독병 목걸이', slot: 'acc', price: 70, stats: { toxicity: 3 }, tags: ['poison'] },
  emberRing: { name: '불씨 반지', slot: 'acc', price: 70, stats: { fireAff: 4 }, tags: ['fire'] },
  frostRing: { name: '서리 반지', slot: 'acc', price: 70, stats: { iceAff: 4 }, tags: ['ice'] },
  wolfTooth: { name: '늑대 이빨', slot: 'acc', price: 60, stats: { agi: 3, sen: 3 }, tags: ['wind'] },
  hunterEye: { name: '사냥꾼의 눈', slot: 'acc', price: 160, stats: { sen: 6 }, tags: ['shadow'],
    effects: [{ when: { stat: 'sen', gte: 40 }, type: 'stat', stat: 'pierce', v: 20, text: '관통 +20%' }] },
  sageStone: { name: '현자의 돌', slot: 'acc', price: 180, stats: { spi: 6 }, tags: [],
    effects: [{ when: { minBase: 20 }, type: 'mul', key: 'dmgMul', v: 1.15, text: '피해 +15% (만능)' }] },
  manaGem: { name: '마나석 목걸이', slot: 'acc', price: 120, stats: { spi: 4 }, tags: [],
    effects: [{ type: 'mul', key: 'maxMana', v: 1.25, text: '최대 마나 +25%' }, { type: 'mul', key: 'manaRegen', v: 1.2, text: '마나 회복 +20%' }] },
  auraSeal: { name: '기사단 인장', slot: 'acc', price: 140, stats: { pres: 4 }, tags: [],
    effects: [{ when: { race: 'knight' }, type: 'add', key: 'auraTime', v: 2, text: '오러 지속 +2초' }] },
};

// ── 클래스 전용 무기: [시작 무기, 상위 무기]. 상위 무기의 boost는 자기 클래스일 때만 스킬 피해를 올린다 ──
const W = (cls, name, weapon, stats, extra = {}) => ({ name, slot: 'weapon', cls, price: extra.price ?? 0, starter: !extra.price, weapon, stats, tags: extra.tags || [], boost: extra.boost, bdesc: extra.bdesc });
Object.assign(ITEMS, {
  boneKnuckle: W('predator', '뼈 송곳니 너클', { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.72, speed: 2.6, range: 24, arc: 1.5, onHit: { status: 'bleed', stacks: 1, chance: 0.3 }, skill: 'dashStab' }, { agi: 3 }),
  predatorFang: W('predator', '포식왕의 이빨', { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.9, speed: 2.8, range: 26, arc: 1.6, onHit: { status: 'bleed', stacks: 1, chance: 0.45 }, skill: 'dashStab' }, { agi: 6, str: 3 }, { price: 280, tags: ['bleed'], boost: { devour: 0.4, bite: 0.4 }, bdesc: '「포식」·「물어뜯기」 피해 +40%' }),
  stoneClub: W('behemoth', '돌 곤봉', { kind: 'melee', dmg: 'phys', mul: 1.3, speed: 1.0, range: 34, arc: 2.2, skill: 'slam' }, { vit: 3 }),
  tectonicHammer: W('behemoth', '지각판 망치', { kind: 'melee', dmg: 'phys', mul: 1.6, speed: 0.95, range: 36, arc: 2.4, armorBreak: true, skill: 'slam' }, { vit: 5, str: 4 }, { price: 280, tags: ['giant'], boost: { tremor: 0.4, headbutt: 0.4 }, bdesc: '「지축 울림」·「박치기 돌격」 피해 +40%' }),
  elemStaff: W('elementalist', '원소 지팡이', { kind: 'proj', dmg: 'mag', mul: 1.4, speed: 1.5, projSpeed: 250, range: 190, splash: 24, mana: 5, skill: 'nova' }, { mag: 3 }),
  triOrb: W('elementalist', '삼원소 보주', { kind: 'proj', dmg: 'mag', mul: 1.85, speed: 1.5, projSpeed: 260, range: 200, splash: 28, mana: 5, skill: 'nova' }, { mag: 7, spi: 3 }, { price: 300, boost: { grandFireball: 0.35, elemBolt: 0.35 }, bdesc: '「거대 화염구」·「원소탄」 피해 +35%' }),
  hourglassStaff: W('chronomancer', '모래시계 지팡이', { kind: 'proj', dmg: 'mag', mul: 1.15, speed: 1.9, projSpeed: 280, range: 200, pierce: 1, mana: 4, skill: 'nova' }, { mag: 2, spi: 2 }),
  aeonPendulum: W('chronomancer', '영겁의 시계추', { kind: 'proj', dmg: 'mag', mul: 1.5, speed: 2.0, projSpeed: 300, range: 210, pierce: 2, mana: 4, skill: 'nova' }, { mag: 6, spi: 4 }, { price: 300, boost: { arcaneBarrage: 0.4, gravityCollapse: 0.4 }, bdesc: '「비전 연발」·「중력 붕괴」 피해 +40%' }),
  guardSword: W('guardian', '기사 장검과 방패', { kind: 'melee', dmg: 'phys', mul: 1.0, speed: 1.5, range: 30, arc: 1.9, skill: 'spin' }, { pres: 5 }),
  bastionBlade: W('guardian', '철벽의 성채방패', { kind: 'melee', dmg: 'phys', mul: 1.25, speed: 1.5, range: 32, arc: 2.0, skill: 'spin' }, { pres: 10, vit: 4 }, { price: 280, tags: ['reflect'], boost: { shieldBash: 0.45, riposte: 0.45 }, bdesc: '「방패 강타」·「받아치기」 피해 +45%' }),
  steelGreatsword: W('greatsword', '강철 대검', { kind: 'melee', dmg: 'phys', mul: 1.4, speed: 0.9, range: 40, arc: 2.4, skill: 'slam' }, { str: 3 }),
  mountainCleaver: W('greatsword', '산을 가르는 검', { kind: 'melee', dmg: 'phys', mul: 1.8, speed: 0.88, range: 44, arc: 2.6, skill: 'slam' }, { str: 8 }, { price: 300, tags: ['giant'], boost: { skyfall: 0.35, swordWave: 0.4 }, bdesc: '「천붕참」 +35% · 「검기 날리기」 +40%' }),
  twoHandAxe: W('berserker', '양손 전투도끼', { kind: 'melee', dmg: 'phys', mul: 1.45, speed: 0.95, range: 34, arc: 2.2, skill: 'spin' }, { str: 3 }),
  bloodthirstAxe: W('berserker', '피에 굶주린 도끼', { kind: 'melee', dmg: 'phys', mul: 1.7, speed: 1.0, range: 36, arc: 2.3, onHit: { status: 'bleed', stacks: 1, chance: 0.3 }, skill: 'spin' }, { str: 7 }, { price: 290, tags: ['drain'], boost: { lastBlow: 0.4, axeSpin: 0.4 }, bdesc: '「최후의 일격」·「회전 도끼」 피해 +40%' }),
  throwHatchet: W('thrower', '투척 손도끼', { kind: 'proj', dmg: 'phys', mul: 1.05, speed: 1.4, projSpeed: 230, range: 130, boomerang: true, skill: 'axeStorm' }, { str: 3 }),
  twinReturnAxe: W('thrower', '귀환하는 쌍도끼', { kind: 'proj', dmg: 'phys', mul: 0.75, speed: 1.4, projSpeed: 240, range: 140, count: 2, spread: 0.2, boomerang: true, skill: 'axeStorm' }, { str: 7 }, { price: 290, tags: ['brawl'], boost: { axeThrow: 0.45, axeTempest: 0.35 }, bdesc: '「도끼 투척」 +45% · 「도끼 폭풍」 +35%' }),
  skullStaff: W('necromancer', '해골 지팡이', { kind: 'proj', dmg: 'mag', mul: 1.1, speed: 1.4, projSpeed: 220, range: 185, skill: 'nova' }, { mag: 3 }),
  deadScepter: W('necromancer', '망자의 홀', { kind: 'proj', dmg: 'mag', mul: 1.45, speed: 1.4, projSpeed: 230, range: 195, skill: 'nova' }, { mag: 6, spi: 4 }, { price: 300, boost: { corpseBlast: 0.45, lichLord: 0.35 }, bdesc: '「시체 폭발」 +45% · 「사령 군주」 +35%' }),
  cursedDoll: W('hexer', '저주 인형', { kind: 'proj', dmg: 'mag', mul: 1.0, speed: 1.4, projSpeed: 210, range: 185, onHit: { status: 'curse', stacks: 1, chance: 0.5 }, skill: 'poisonPool' }, { mag: 3 }),
  doomTome: W('hexer', '파멸의 서', { kind: 'proj', dmg: 'mag', mul: 1.3, speed: 1.4, projSpeed: 220, range: 195, onHit: { status: 'curse', stacks: 1, chance: 0.7 }, skill: 'poisonPool' }, { mag: 6, spi: 4 }, { price: 300, tags: ['curse'], boost: { soulBurst: 0.4, doomBrand: 0.35 }, bdesc: '「영혼 폭발」 +40% · 「파멸의 낙인」 +35%' }),
  twinDaggers: W('shadowblade', '쌍단검', { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.55, hits: 2, speed: 2.2, range: 24, arc: 1.6, skill: 'dashStab' }, { agi: 3 }),
  nightPiercer: W('shadowblade', '밤의 송곳', { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.7, hits: 2, speed: 2.3, range: 26, arc: 1.6, crit: 0.08, critDmg: 0.3, skill: 'dashStab' }, { agi: 6, sen: 4 }, { price: 290, tags: ['shadow'], boost: { execution: 0.4, ambush: 0.4 }, bdesc: '「그림자 처형」·「급습」 피해 +40%' }),
  blowgun: W('venomHunter', '바람총', { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 0.55, speed: 2.8, projSpeed: 340, range: 190, onHit: { status: 'poison', stacks: 1, chance: 1 }, skill: 'volley' }, { agi: 2, toxicity: 2 }),
  viperBlowgun: W('venomHunter', '독사 송곳 바람총', { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 0.5, speed: 2.8, projSpeed: 360, range: 200, count: 2, spread: 0.1, onHit: { status: 'poison', stacks: 1, chance: 1 }, skill: 'volley' }, { agi: 5, toxicity: 5 }, { price: 290, tags: ['poison'], boost: { venomBurst: 0.4, dartVolley: 0.45 }, bdesc: '「맹독 폭발」 +40% · 「독침」 +45%' }),
  spiritBranch: W('spiritcaller', '정령의 나뭇가지', { kind: 'proj', dmg: 'mag', mul: 1.0, speed: 1.6, projSpeed: 240, range: 190, skill: 'nova' }, { mag: 2, agi: 2 }),
  worldTreeStaff: W('spiritcaller', '세계수 지팡이', { kind: 'proj', dmg: 'mag', mul: 1.35, speed: 1.7, projSpeed: 250, range: 200, pierce: 1, skill: 'nova' }, { mag: 6, agi: 3 }, { price: 300, tags: ['wind'], boost: { spiritFusion: 0.45, spiritKing: 0.35 }, bdesc: '「정령 융합」 +45% · 「정령왕 소환」 +35%' }),
  rangerBow: W('ranger', '사냥 활', { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 1.3, speed: 1.6, projSpeed: 300, range: 200, pierce: 1, skill: 'volley' }, { sen: 3 }),
  galeLongbow: W('ranger', '바람결 장궁', { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 1.5, speed: 1.4, projSpeed: 380, range: 260, pierce: 2, skill: 'rain' }, { sen: 5, agi: 4 }, { price: 300, tags: ['wind'], boost: { pierceArrow: 0.45, arrowRain: 0.35 }, bdesc: '「관통 화살」 +45% · 「화살비」 +35%' }),
  rockFist: W('rockguard', '바위 주먹', { kind: 'melee', dmg: 'phys', mul: 1.15, speed: 1.2, range: 26, arc: 1.8, skill: 'slam' }, { pres: 4 }),
  mountainHeart: W('rockguard', '산맥의 심장', { kind: 'melee', dmg: 'phys', mul: 1.45, speed: 1.2, range: 28, arc: 2.0, armorBreak: true, skill: 'slam' }, { pres: 10, vit: 4 }, { price: 280, tags: ['reflect', 'giant'], boost: { quake: 0.45, colossus: 0.35 }, bdesc: '「지진 강타」 +45% · 「거신화」 +35%' }),
  iceFist: W('frostGolem', '얼음 주먹', { kind: 'melee', dmg: 'phys', mul: 1.1, speed: 1.2, range: 26, arc: 1.8, onHit: { status: 'chill', stacks: 1, chance: 0.4 }, skill: 'slam' }, { iceAff: 2 }),
  permafrostCore: W('frostGolem', '영구 동토의 핵', { kind: 'melee', dmg: 'phys', mul: 1.4, speed: 1.25, range: 28, arc: 2.0, onHit: { status: 'chill', stacks: 1, chance: 0.6 }, skill: 'frostRing' }, { iceAff: 6, pres: 4 }, { price: 290, tags: ['ice'], boost: { glacialSpikes: 0.45, absoluteZero: 0.35 }, bdesc: '「빙하 가시」 +45% · 「절대 영도」 +35%' }),
  dragonSpear: W('dragoon', '용비늘 창', { kind: 'melee', dmg: 'phys', mul: 1.2, speed: 1.3, range: 46, shape: 'thrust', width: 10, onHit: { status: 'burn', stacks: 1, chance: 0.3 }, skill: 'dashStab' }, { str: 2, fireAff: 2 }),
  wyrmFang: W('dragoon', '화룡의 이빨', { kind: 'melee', dmg: 'phys', mul: 1.5, speed: 1.35, range: 50, shape: 'thrust', width: 12, onHit: { status: 'burn', stacks: 1, chance: 0.45 }, skill: 'dashStab' }, { str: 6, fireAff: 4 }, { price: 300, tags: ['fire'], boost: { breath: 0.4, igniteBurst: 0.4 }, bdesc: '「화염 숨결」·「발화 폭발」 피해 +40%' }),
  dragonTome: W('dragonSage', '용언 마도서', { kind: 'proj', dmg: 'mag', mul: 0.6, speed: 1.4, projSpeed: 230, range: 185, count: 2, spread: 0.18, splash: 20, mana: 6, onHit: { status: 'burn', stacks: 1, chance: 0.35 }, skill: 'nova' }, { mag: 3, fireAff: 2 }),
  elderHeartstone: W('dragonSage', '고룡의 심장석', { kind: 'proj', dmg: 'mag', mul: 0.8, speed: 1.4, projSpeed: 240, range: 195, count: 3, spread: 0.2, splash: 22, mana: 6, onHit: { status: 'burn', stacks: 1, chance: 0.4 }, skill: 'meteor' }, { mag: 7, fireAff: 4 }, { price: 300, tags: ['fire'], boost: { meteorDrop: 0.4, wildfire: 0.35 }, bdesc: '「운석」 +40% · 「대화재」 +35%' }),
});

// 플레이 스타일 → 시작 무기 / 핵심 태그 / 추천 종족
export const STYLES = {
  frost: { name: '서리 지배자', desc: '냉기를 쌓아 둔화시키고 얼려서 묶는다', tags: ['ice', 'curse'], weapon: 'apprenticeWand', stats: ['mag', 'spi'], races: { wizard: 2, elf: 1 } },
  fire: { name: '화염술사', desc: '화상을 퍼뜨려 무리를 태운다', tags: ['fire'], weapon: 'oldTome', stats: ['mag'], races: { wizard: 2, dragon: 2 } },
  poison: { name: '독살자', desc: '강적 하나에 독을 깊게 쌓아 녹인다', tags: ['poison', 'curse'], weapon: 'mossStaff', stats: ['mag', 'toxicity'], races: { undead: 2, wizard: 1 } },
  shadow: { name: '그림자 암살자', desc: '피하고 파고들어 치명타와 출혈로 벤다', tags: ['shadow', 'bleed'], weapon: 'dagger', stats: ['agi', 'sen'], races: { assassin: 2, dino: 1 } },
  wind: { name: '바람 사수', desc: '계속 움직이며 쏜다', tags: ['wind'], weapon: 'huntBow', stats: ['agi', 'sen'], races: { elf: 2, assassin: 1 } },
  giant: { name: '거인 파쇄자', desc: '높은 체력으로 버티며 긴 쿨타임의 큰 한 방', tags: ['giant', 'brawl'], weapon: 'heavySword', stats: ['str', 'vit'], races: { golem: 2, orc: 1, knight: 1 } },
  blood: { name: '피의 광전사', desc: '맞으면서 흡혈로 버틴다', tags: ['drain', 'brawl'], weapon: 'handAxe', stats: ['str'], races: { orc: 2, dino: 2 } },
  mirror: { name: '거울 수호자', desc: '맞을수록 적이 죽는 반사 탱커', tags: ['reflect', 'giant', 'slime'], weapon: 'knightSword', stats: ['pres', 'mres'], races: { knight: 2, golem: 1 } },
};

export const STARTER_ITEMS = ['rustySword'];

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
  lash: { name: '채찍 휘감기', desc: '앞쪽을 세 번 넓게 휘갈기고, 마지막에 맞은 적을 내 앞으로 끌어온다', cd: 7 },
  flurry: { name: '난타', desc: '0.6초 동안 주먹으로 여섯 번 친다. 마지막 주먹은 적을 날려 보낸다', cd: 6 },
  knifeFan: { name: '단검 폭풍', desc: '단검 열 자루를 사방으로 던진다', cd: 7 },
  boomStorm: { name: '부메랑 폭풍', desc: '돌아오는 부메랑 여섯 개를 사방으로 던진다', cd: 7 },
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

  // ── 성지의 보물: 한 성지의 축복을 5단계까지 받으면 그 성지가 내어 준다 (상점에 없다) ──
  starOrb: { name: '별의 보주', slot: 'acc', price: 0, treasure: 'wizard', stats: { mag: 6, spi: 6 }, tags: [],
    effects: [{ type: 'mul', key: 'manaRegen', v: 1.3, text: '마나 회복 +30%' }] },
  worldLeaf: { name: '세계수의 잎', slot: 'acc', price: 0, treasure: 'elf', stats: { mag: 5, agi: 5 }, tags: ['wind'],
    effects: [{ type: 'add', key: 'regen', v: 0.004, text: '자연 회복 · 초당 최대 체력의 0.4%' }] },
  royalCrest: { name: '왕가의 휘장', slot: 'acc', price: 0, treasure: 'knight', stats: { pres: 12, vit: 5 }, tags: [],
    effects: [{ type: 'mul', key: 'dmgTakenMul', v: 0.93, text: '받는 피해 -7%' }] },
  championHorn: { name: '투사의 뿔', slot: 'acc', price: 0, treasure: 'orc', stats: { str: 7, vit: 4 }, tags: ['brawl'],
    effects: [{ type: 'mul', key: 'dmgMul', v: 1.08, text: '모든 피해 +8%' }] },
  lichCrown: { name: '망자의 왕관', slot: 'acc', price: 0, treasure: 'undead', stats: { mag: 6, mres: 10 }, tags: ['drain'],
    effects: [{ type: 'stat', stat: 'lifesteal', v: 4, text: '흡혈 +4%' }] },
  shadowSeal: { name: '그림자 인장 반지', slot: 'acc', price: 0, treasure: 'assassin', stats: { agi: 6, sen: 6 }, tags: ['shadow'],
    effects: [{ type: 'add', key: 'crit', v: 0.05, text: '치명타 확률 +5%' }] },
  primalFang: { name: '태고의 송곳니', slot: 'acc', price: 0, treasure: 'dino', stats: { str: 6, agi: 6 }, tags: ['bleed'],
    effects: [{ type: 'mul', key: 'moveSpeed', v: 1.06, text: '이동 속도 +6%' }] },
  dragonHeart: { name: '용의 심장', slot: 'acc', price: 0, treasure: 'dragon', stats: { str: 5, mag: 5, vit: 4 }, tags: ['fire'],
    effects: [{ type: 'mul', key: 'burnMul', v: 1.25, text: '화상 피해 +25%' }] },
  // ── 종족의 증표: 성지 친밀도가 '가족'이 되면 우두머리가 준다 (상점에 없다) ──
  tokenWizard: { name: '마탑의 별 반지', slot: 'acc', price: 0, treasure: 'wizard', token: true, stats: { mag: 4, spi: 4, mres: 6 }, tags: [] },
  tokenElf: { name: '여왕의 은빛 깃털', slot: 'acc', price: 0, treasure: 'elf', token: true, stats: { agi: 4, sen: 4, mag: 3 }, tags: ['wind'] },
  tokenKnight: { name: '근위대 훈장', slot: 'acc', price: 0, treasure: 'knight', token: true, stats: { pres: 8, vit: 4 }, tags: [] },
  tokenOrc: { name: '투사의 이빨 팔찌', slot: 'acc', price: 0, treasure: 'orc', token: true, stats: { str: 5, vit: 4 }, tags: ['brawl'] },
  tokenUndead: { name: '망자의 반지', slot: 'acc', price: 0, treasure: 'undead', token: true, stats: { mag: 4, mres: 6, spi: 2 }, tags: [] },
  tokenAssassin: { name: '그림자 깃 장식', slot: 'acc', price: 0, treasure: 'assassin', token: true, stats: { agi: 5, sen: 4 }, tags: ['shadow'] },
  tokenDino: { name: '태고의 송곳니 목걸이', slot: 'acc', price: 0, treasure: 'dino', token: true, stats: { str: 4, agi: 4 }, tags: [] },
  tokenDragon: { name: '용왕의 비늘 목걸이', slot: 'acc', price: 0, treasure: 'dragon', token: true, stats: { str: 3, mag: 3, mres: 4 }, tags: ['fire'] },
};

// ── 대장간에서 만드는 장비 (상점에서 팔지 않는다: 캔 광석 · 벤 나무 · 바다의 산호로 만든다) ──
const F = (name, slot, extra) => ({ name, slot, price: 0, forged: true, stats: {}, tags: [], ...extra });
Object.assign(ITEMS, {
  copperDagger: F('구리 단검', 'weapon', { weapon: { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.78, speed: 3.0, range: 24, arc: 1.5, skill: 'dashStab' }, stats: { agi: 3 } }),
  copperSword: F('구리 검', 'weapon', { weapon: { kind: 'melee', dmg: 'phys', mul: 1.05, speed: 1.6, range: 30, arc: 1.9, skill: 'spin' }, stats: { str: 3 } }),
  huntersBow: F('사냥꾼의 활', 'weapon', { weapon: { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 1.35, speed: 1.6, projSpeed: 320, range: 220, pierce: 1, skill: 'volley' }, stats: { sen: 4, agi: 2 }, tags: ['wind'] }),
  ironSword: F('철 장검', 'weapon', { weapon: { kind: 'melee', dmg: 'phys', mul: 1.25, speed: 1.5, range: 33, arc: 2.0, skill: 'spin' }, stats: { str: 5, vit: 2 } }),
  ironWaraxe: F('철 전투도끼', 'weapon', { weapon: { kind: 'melee', dmg: 'phys', mul: 1.6, speed: 0.95, range: 34, arc: 2.3, skill: 'slam' }, stats: { str: 7 }, tags: ['brawl'] }),
  silverRapier: F('은 레이피어', 'weapon', { weapon: { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 1.0, speed: 2.2, range: 40, shape: 'thrust', width: 8, crit: 0.1, critDmg: 0.3, skill: 'dashStab' }, stats: { agi: 5, sen: 5 }, tags: ['shadow'] }),
  crystalStaff: F('수정 지팡이', 'weapon', { weapon: { kind: 'proj', dmg: 'mag', mul: 1.9, speed: 1.5, projSpeed: 260, range: 200, splash: 26, mana: 5, skill: 'nova' }, stats: { mag: 7, spi: 3 } }),
  coralTrident: F('산호 삼지창', 'weapon', { weapon: { kind: 'melee', dmg: 'phys', mul: 1.45, speed: 1.35, range: 48, shape: 'thrust', width: 12, onHit: { status: 'chill', stacks: 1, chance: 0.3 }, skill: 'dashStab' }, stats: { str: 5, agi: 4 }, tags: ['ice'] }),
  obsidianBlade: F('흑요석 대검', 'weapon', { weapon: { kind: 'melee', dmg: 'phys', mul: 1.95, speed: 0.85, range: 42, arc: 2.6, armorBreak: true, skill: 'slam' }, stats: { str: 10 }, tags: ['giant'] }),
  starTome: F('별빛 마도서', 'weapon', { weapon: { kind: 'proj', dmg: 'mag', mul: 0.75, speed: 1.5, projSpeed: 250, range: 200, count: 3, spread: 0.2, splash: 22, mana: 6, skill: 'meteor' }, stats: { mag: 9, spi: 5 },
    effects: [{ type: 'mul', key: 'reactionMul', v: 1.15, text: '원소 반응 피해 +15%' }] }),
  copperMail: F('구리 흉갑', 'armor', { stats: { pres: 10, vit: 2 } }),
  ironPlate: F('철 판금 갑옷', 'armor', { stats: { pres: 24, vit: 5, agi: -2 }, tags: ['giant'] }),
  rubyRing: F('루비 반지', 'acc', { stats: { fireAff: 4, mag: 3 }, tags: ['fire'] }),
  sapphireRing: F('사파이어 반지', 'acc', { stats: { iceAff: 4, spi: 3 }, tags: ['ice'] }),
  emeraldAmulet: F('에메랄드 목걸이', 'acc', { stats: { agi: 4, vit: 3 }, effects: [{ type: 'add', key: 'regen', v: 0.002, text: '자연 회복 · 초당 최대 체력의 0.2%' }] }),
});

// ── 클래스 전용 무기: [시작 무기, 상위 무기]. 상위 무기의 boost는 자기 클래스일 때만 스킬 피해를 올린다 ──
const W = (cls, name, weapon, stats, extra = {}) => ({ name, slot: 'weapon', cls, price: extra.price ?? 0, starter: !extra.price, weapon, stats, tags: extra.tags || [], boost: extra.boost, bdesc: extra.bdesc });
Object.assign(ITEMS, {
  boneKnuckle: W('predator', '뼈 송곳니 너클', { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.72, speed: 2.6, range: 24, arc: 1.5, onHit: { status: 'bleed', stacks: 1, chance: 0.3 }, skill: 'dashStab' }, { agi: 3 }),
  predatorFang: W('predator', '포식왕의 이빨', { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.9, speed: 2.8, range: 26, arc: 1.6, onHit: { status: 'bleed', stacks: 1, chance: 0.45 }, skill: 'dashStab' }, { agi: 6, str: 3 }, { price: 280, tags: ['bleed'], boost: { devour: 0.4, pounce: 0.4 }, bdesc: '「포식」·「덮치기」 피해 +40%' }),
  stoneClub: W('behemoth', '돌 곤봉', { kind: 'melee', dmg: 'phys', mul: 1.3, speed: 1.0, range: 34, arc: 2.2, skill: 'slam' }, { vit: 3 }),
  tectonicHammer: W('behemoth', '지각판 망치', { kind: 'melee', dmg: 'phys', mul: 1.6, speed: 0.95, range: 36, arc: 2.4, armorBreak: true, skill: 'slam' }, { vit: 5, str: 4 }, { price: 280, tags: ['giant'], boost: { tremor: 0.4, headbutt: 0.4 }, bdesc: '「지축 울림」·「박치기」 피해 +40%' }),
  elemStaff: W('elementalist', '원소 지팡이', { kind: 'proj', dmg: 'mag', mul: 1.4, speed: 1.5, projSpeed: 250, range: 190, splash: 24, mana: 5, skill: 'nova' }, { mag: 3 }),
  triOrb: W('elementalist', '삼원소 보주', { kind: 'proj', dmg: 'mag', mul: 1.85, speed: 1.5, projSpeed: 260, range: 200, splash: 28, mana: 5, skill: 'nova' }, { mag: 7, spi: 3 }, { price: 300, boost: { grandFireball: 0.35, flameBurst: 0.35 }, bdesc: '「거대 화염구」·「화염 작렬」 피해 +35%' }),
  hourglassStaff: W('chronomancer', '모래시계 지팡이', { kind: 'proj', dmg: 'mag', mul: 1.15, speed: 1.9, projSpeed: 280, range: 200, pierce: 1, mana: 4, skill: 'nova' }, { mag: 2, spi: 2 }),
  aeonPendulum: W('chronomancer', '영겁의 시계추', { kind: 'proj', dmg: 'mag', mul: 1.5, speed: 2.0, projSpeed: 300, range: 210, pierce: 2, mana: 4, skill: 'nova' }, { mag: 6, spi: 4 }, { price: 300, boost: { arcaneBarrage: 0.4, gravityCollapse: 0.4 }, bdesc: '「비전 연발」·「중력 붕괴」 피해 +40%' }),
  guardSword: W('guardian', '기사 장검과 방패', { kind: 'melee', dmg: 'phys', mul: 1.0, speed: 1.5, range: 30, arc: 1.9, skill: 'spin' }, { pres: 5 }),
  bastionBlade: W('guardian', '철벽의 성채방패', { kind: 'melee', dmg: 'phys', mul: 1.25, speed: 1.5, range: 32, arc: 2.0, skill: 'spin' }, { pres: 10, vit: 4 }, { price: 280, tags: ['reflect'], boost: { shieldBash: 0.45, riposte: 0.45 }, bdesc: '「방패 강타」·「받아치기」 피해 +45%' }),
  steelGreatsword: W('greatsword', '강철 대검', { kind: 'melee', dmg: 'phys', mul: 1.4, speed: 0.9, range: 40, arc: 2.4, skill: 'slam' }, { str: 3 }),
  mountainCleaver: W('greatsword', '산을 가르는 검', { kind: 'melee', dmg: 'phys', mul: 1.8, speed: 0.88, range: 44, arc: 2.6, skill: 'slam' }, { str: 8 }, { price: 300, tags: ['giant'], boost: { skyfall: 0.35, swordWave: 0.4 }, bdesc: '「천붕참」 +35% · 「검기 날리기」 +40%' }),
  twoHandAxe: W('berserker', '양손 전투도끼', { kind: 'melee', dmg: 'phys', mul: 1.45, speed: 0.95, range: 34, arc: 2.2, skill: 'spin' }, { str: 3 }),
  bloodthirstAxe: W('berserker', '피에 굶주린 도끼', { kind: 'melee', dmg: 'phys', mul: 1.7, speed: 1.0, range: 36, arc: 2.3, onHit: { status: 'bleed', stacks: 1, chance: 0.3 }, skill: 'spin' }, { str: 7 }, { price: 290, tags: ['drain'], boost: { rageBurst: 0.4, crushingBlows: 0.4 }, bdesc: '「분노 폭발」·「분쇄 연타」 피해 +40%' }),
  throwHatchet: W('thrower', '투척 손도끼', { kind: 'melee', dmg: 'phys', mul: 1.15, speed: 1.3, range: 32, arc: 2.0, skill: 'axeStorm' }, { str: 3 }),
  twinReturnAxe: W('thrower', '귀환하는 쌍도끼', { kind: 'melee', dmg: 'phys', mul: 0.8, hits: 2, speed: 1.35, range: 34, arc: 2.2, skill: 'axeStorm' }, { str: 7 }, { price: 290, tags: ['brawl'], boost: { greatAxe: 0.45, axeLegion: 0.35 }, bdesc: '「거대 도끼」 +45% · 「도끼 군단」 +35%' }),
  skullStaff: W('necromancer', '해골 지팡이', { kind: 'proj', dmg: 'mag', mul: 1.1, speed: 1.4, projSpeed: 220, range: 185, skill: 'nova' }, { mag: 3 }),
  deadScepter: W('necromancer', '망자의 홀', { kind: 'proj', dmg: 'mag', mul: 1.45, speed: 1.4, projSpeed: 230, range: 195, skill: 'nova' }, { mag: 6, spi: 4 }, { price: 300, boost: { corpseBlast: 0.45, lichLord: 0.35 }, bdesc: '「시체 폭발」 +45% · 「사령 군주」 +35%' }),
  cursedDoll: W('hexer', '저주 인형', { kind: 'proj', dmg: 'mag', mul: 1.0, speed: 1.4, projSpeed: 210, range: 185, onHit: { status: 'curse', stacks: 1, chance: 0.5 }, skill: 'poisonPool' }, { mag: 3 }),
  doomTome: W('hexer', '파멸의 서', { kind: 'proj', dmg: 'mag', mul: 1.3, speed: 1.4, projSpeed: 220, range: 195, onHit: { status: 'curse', stacks: 1, chance: 0.7 }, skill: 'poisonPool' }, { mag: 6, spi: 4 }, { price: 300, tags: ['curse'], boost: { contagion: 0.4, doomBrand: 0.35 }, bdesc: '「전염」 +40% · 「파멸의 낙인」 +35%' }),
  twinDaggers: W('shadowblade', '쌍단검', { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.55, hits: 2, speed: 2.2, range: 24, arc: 1.6, skill: 'dashStab' }, { agi: 3 }),
  nightPiercer: W('shadowblade', '밤의 송곳', { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.7, hits: 2, speed: 2.3, range: 26, arc: 1.6, crit: 0.08, critDmg: 0.3, skill: 'dashStab' }, { agi: 6, sen: 4 }, { price: 290, tags: ['shadow'], boost: { shadowDance: 0.4, ambush: 0.4 }, bdesc: '「그림자 춤」·「급습」 피해 +40%' }),
  blowgun: W('venomHunter', '바람총', { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 0.55, speed: 2.8, projSpeed: 340, range: 190, onHit: { status: 'poison', stacks: 1, chance: 1 }, skill: 'volley' }, { agi: 2, toxicity: 2 }),
  viperBlowgun: W('venomHunter', '독사 송곳 바람총', { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 0.5, speed: 2.8, projSpeed: 360, range: 200, count: 2, spread: 0.1, onHit: { status: 'poison', stacks: 1, chance: 1 }, skill: 'volley' }, { agi: 5, toxicity: 5 }, { price: 290, tags: ['poison'], boost: { venomBurst: 0.4, dartFan: 0.45 }, bdesc: '「맹독 폭발」 +40% · 「독침 난사」 +45%' }),
  spiritBow: W('spiritcaller', '정령의 활', { kind: 'proj', dmg: 'mag', mul: 1.0, speed: 1.6, projSpeed: 300, range: 200, projKind: 'arrow', skill: 'volley' }, { mag: 2, agi: 2 }),
  worldTreeBow: W('spiritcaller', '세계수 장궁', { kind: 'proj', dmg: 'mag', mul: 1.35, speed: 1.6, projSpeed: 330, range: 220, pierce: 1, projKind: 'arrow', skill: 'rain' }, { mag: 6, agi: 3 }, { price: 300, tags: ['wind'], boost: { spiritArrow: 0.45, spiritKing: 0.35 }, bdesc: '「정령의 화살」 +45% · 「정령왕 강림」 +35%' }),
  rangerBow: W('ranger', '사냥 활', { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 1.3, speed: 1.6, projSpeed: 300, range: 200, pierce: 1, skill: 'volley' }, { sen: 3 }),
  galeLongbow: W('ranger', '바람결 장궁', { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 1.5, speed: 1.4, projSpeed: 380, range: 260, pierce: 2, skill: 'rain' }, { sen: 5, agi: 4 }, { price: 300, tags: ['wind'], boost: { pierceArrow: 0.45, skyPiercer: 0.35 }, bdesc: '「관통 화살」 +45% · 「천공의 한 발」 +35%' }),
  rockFist: W('rockguard', '바위 주먹', { kind: 'melee', dmg: 'phys', mul: 1.15, speed: 1.2, range: 26, arc: 1.8, skill: 'slam' }, { pres: 4 }),
  mountainHeart: W('rockguard', '산맥의 심장', { kind: 'melee', dmg: 'phys', mul: 1.45, speed: 1.2, range: 28, arc: 2.0, armorBreak: true, skill: 'slam' }, { pres: 10, vit: 4 }, { price: 280, tags: ['reflect', 'giant'], boost: { quake: 0.45, colossus: 0.35 }, bdesc: '「지진 강타」 +45% · 「거신화」 +35%' }),
  iceFist: W('frostGolem', '얼음 주먹', { kind: 'melee', dmg: 'phys', mul: 1.1, speed: 1.2, range: 26, arc: 1.8, onHit: { status: 'chill', stacks: 1, chance: 0.4 }, skill: 'slam' }, { iceAff: 2 }),
  permafrostCore: W('frostGolem', '영구 동토의 핵', { kind: 'melee', dmg: 'phys', mul: 1.4, speed: 1.25, range: 28, arc: 2.0, onHit: { status: 'chill', stacks: 1, chance: 0.6 }, skill: 'frostRing' }, { iceAff: 6, pres: 4 }, { price: 290, tags: ['ice'], boost: { glacialSpikes: 0.45, absoluteZero: 0.35 }, bdesc: '「빙하 가시」 +45% · 「절대 영도」 +35%' }),
  dragonSpear: W('dragoon', '용비늘 창', { kind: 'melee', dmg: 'phys', mul: 1.2, speed: 1.3, range: 46, shape: 'thrust', width: 10, onHit: { status: 'burn', stacks: 1, chance: 0.3 }, skill: 'dashStab' }, { str: 2, fireAff: 2 }),
  wyrmFang: W('dragoon', '화룡의 이빨', { kind: 'melee', dmg: 'phys', mul: 1.5, speed: 1.35, range: 50, shape: 'thrust', width: 12, onHit: { status: 'burn', stacks: 1, chance: 0.45 }, skill: 'dashStab' }, { str: 6, fireAff: 4 }, { price: 300, tags: ['fire'], boost: { breath: 0.4, soar: 0.4 }, bdesc: '「화염 숨결」·「비상」 피해 +40%' }),
  dragonTome: W('dragonSage', '용언 마도서', { kind: 'proj', dmg: 'mag', mul: 0.6, speed: 1.4, projSpeed: 230, range: 185, count: 2, spread: 0.18, splash: 20, mana: 6, onHit: { status: 'burn', stacks: 1, chance: 0.35 }, skill: 'nova' }, { mag: 3, fireAff: 2 }),
  elderHeartstone: W('dragonSage', '고룡의 심장석', { kind: 'proj', dmg: 'mag', mul: 0.8, speed: 1.4, projSpeed: 240, range: 195, count: 3, spread: 0.2, splash: 22, mana: 6, onHit: { status: 'burn', stacks: 1, chance: 0.4 }, skill: 'meteor' }, { mag: 7, fireAff: 4 }, { price: 300, tags: ['fire'], boost: { wordSky: 0.4, wordFire: 0.35 }, bdesc: '「용언: 하늘」 +40% · 「용언: 불」 +35%' }),
});

// ── 무기 갈래: 스킬이 이 무기로 되는지 · 얼마나 잘 되는지 (skills.js FIT) ──
// blade 한손 칼 · great 대검 · axe 도끼 · blunt 둔기 · polearm 창 · fist 주먹 · bow 활 · tube 바람총 · throw 던지는 무기 · staff 지팡이 · tome 마도서 · shield 검과 방패 · whip 채찍 · scythe 낫
const WCAT = {
  blade: ['knightSword', 'rustySword', 'dagger', 'heavySword', 'dualBlades', 'katana', 'rotDagger', 'copperDagger', 'copperSword', 'ironSword', 'silverRapier', 'twinDaggers', 'nightPiercer'],
  great: ['riftGreatsword', 'steelGreatsword', 'mountainCleaver', 'obsidianBlade'],
  axe: ['handAxe', 'battleAxe', 'doubleAxe', 'ironWaraxe', 'twoHandAxe', 'bloodthirstAxe', 'throwHatchet', 'twinReturnAxe'],
  blunt: ['mace', 'stoneClub', 'tectonicHammer', 'rockFist', 'mountainHeart', 'iceFist', 'permafrostCore'],
  polearm: ['spear', 'coralTrident', 'dragonSpear', 'wyrmFang'],
  fist: ['boneKnuckle', 'predatorFang'],
  bow: ['huntBow', 'longbow', 'huntersBow', 'rangerBow', 'galeLongbow', 'spiritBow', 'worldTreeBow'],
  tube: ['blowgun', 'viperBlowgun'],
  throw: ['throwingAxe'],
  staff: ['apprenticeWand', 'mossStaff', 'apprenticeStaff', 'frostWand', 'poisonStaff', 'archStaff', 'crystalStaff', 'elemStaff', 'triOrb', 'hourglassStaff', 'aeonPendulum', 'skullStaff', 'deadScepter', 'cursedDoll', 'elderHeartstone'],
  tome: ['oldTome', 'tome', 'starTome', 'doomTome', 'dragonTome'],
  shield: ['guardSword', 'bastionBlade'],
};
for (const [cat, ids] of Object.entries(WCAT)) for (const id of ids) { const it = ITEMS[id]; if (it?.weapon) { it.cat = cat; it.weapon.cat = cat; if (cat === 'great') it.weapon.great = true; } }
// 한손 · 양손: 한손 무기를 들면 왼손에 보조 도구(부적 · 손쇠뇌 · 작은 방패 · 투척 주머니)를 들 수 있다. 양손 무기는 두 손을 다 쓴다
export const CAT_HANDS = { blade: 1, axe: 1, blunt: 1, whip: 1, throw: 1, tome: 1, great: 2, polearm: 2, bow: 2, tube: 2, staff: 2, scythe: 2, fist: 2, shield: 2 };
const HANDS = { // 분류와 다른 것: 쌍검 · 큰 도끼 · 큰 곤봉은 양손, 완드 · 보주 · 홀 · 인형 · 시계추 · 심장석은 한손
  dualBlades: 2, twinDaggers: 2, katana: 2, doubleAxe: 2, twoHandAxe: 2, bloodthirstAxe: 2, twinReturnAxe: 2, stoneClub: 2, tectonicHammer: 2, rockFist: 2, mountainHeart: 2, iceFist: 2, permafrostCore: 2,
  apprenticeWand: 1, frostWand: 1, triOrb: 1, cursedDoll: 1, deadScepter: 1, aeonPendulum: 1, elderHeartstone: 1,
};
for (const [id, it] of Object.entries(ITEMS)) if (it.weapon && !it.hands) it.hands = HANDS[id] || CAT_HANDS[it.cat] || 1;
// 왼손 도구: 한손 무기와 함께 들면 그 종류의 스킬을 이 힘으로 쓴다 (off: 스킬 종류 → 힘)
Object.assign(ITEMS, {
  talisman: { name: '마법 부적', slot: 'off', price: 120, stats: { mag: 2 }, tags: [], off: { spell: 0.9 }, odesc: '마법을 90% 힘으로 쓴다' },
  starCharm: { name: '별빛 부적', slot: 'off', price: 600, stats: { mag: 5, spi: 2 }, tags: [], off: { spell: 1 }, odesc: '마법을 온전한 힘으로 쓴다' },
  handCrossbow: { name: '손쇠뇌', slot: 'off', price: 150, stats: { agi: 2 }, tags: [], off: { shoot: 0.8 }, odesc: '쏘기 스킬을 80% 힘으로 쓴다 (쇠살)' },
  repeatCrossbow: { name: '연발 손쇠뇌', slot: 'off', price: 650, stats: { agi: 4, sen: 2 }, tags: [], off: { shoot: 0.95 }, odesc: '쏘기 스킬을 95% 힘으로 쓴다 (쇠살)' },
  buckler: { name: '작은 방패', slot: 'off', price: 100, stats: { pres: 5 }, tags: [], off: { shield: 1, parry: 1 }, odesc: '방패 · 받아치기 스킬을 온전히 쓴다' },
  knightBuckler: { name: '기사단 원형 방패', slot: 'off', price: 550, stats: { pres: 12, vit: 3 }, tags: [], off: { shield: 1, parry: 1 }, odesc: '방패 · 받아치기 스킬을 온전히 쓴다' },
  throwPouch: { name: '투척 주머니', slot: 'off', price: 90, stats: { str: 1, agi: 1 }, tags: [], off: { throw: 0.85 }, odesc: '던지기 스킬을 85% 힘으로 쓴다' },
  curseDoll: { name: '저주 인형', slot: 'off', price: 320, stats: { mag: 3, spi: 2 }, tags: ['curse'], off: { spell: 0.85 }, offCurse: { chance: 0.3, stacks: 1 }, odesc: '마법을 85% 힘으로 쓴다 · 내 공격에 맞은 적은 30% 확률로 저주 1중첩 (중첩마다 지속 피해, 받는 피해 +2%)' },
  knifeBelt: { name: '투척 단검 띠', slot: 'off', price: 550, stats: { agi: 3, sen: 2 }, tags: [], off: { throw: 1 }, odesc: '던지기 스킬을 온전한 힘으로 쓴다' },
});
// 장비 값: 예전보다 두 배 (돈이 너무 쉽게 남지 않게)
for (const it of Object.values(ITEMS)) if (it.price) it.price = Math.round(it.price * 2);
export const OFF_LOOK = { curseDoll: 'doll', talisman: 'charm', starCharm: 'charm', handCrossbow: 'xbow', repeatCrossbow: 'xbow', buckler: 'buckler', knightBuckler: 'buckler', throwPouch: 'pouch', knifeBelt: 'pouch' };
export const WCAT_NAME = { blade: '한손 칼', great: '대검', axe: '도끼', blunt: '둔기', polearm: '창', fist: '주먹', bow: '활 · 석궁', tube: '바람총', throw: '던지는 무기', staff: '지팡이', tome: '마도서', shield: '검과 방패', whip: '채찍', scythe: '낫' };
export const weaponHands = (it) => it?.hands || CAT_HANDS[it?.weapon?.cat || it?.cat] || 1;
export const weaponCat = (it) => it?.weapon?.cat || it?.cat || (it?.weapon?.kind === 'proj' ? (it.weapon.dmg === 'mag' ? 'staff' : 'bow') : 'blade');

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

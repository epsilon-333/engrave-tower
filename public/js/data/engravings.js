// 각인: 신체 부위에 새기는 고대 문양. 잔향을 모아 공명 제단에서 새긴다.
// grade 1~5, load = 각인 부하. 고등급은 부하가 크고 태그가 적다 → 많이 끼우면 과부하.
// effects[].when = 발동 조건 (conditions.js 형식)

export const ENGRAVINGS = {
  // ── 이끼 동굴 ──
  slimeSkin: {
    name: '끈적한 점액', slot: 'leg', grade: 1, load: 2, tags: ['slime'],
    stats: { vit: 4, pres: 3 },
    effects: [
      { type: 'flag', flag: 'slimeSlow', text: '나를 때린 적에게 냉기 1중첩' },
    ],
    recipe: { goo: 4 },
  },
  batWing: {
    name: '워골의 발놀림', slot: 'back', grade: 1, load: 2, tags: ['wind', 'drain'],
    stats: { agi: 5, lifesteal: 3 },
    effects: [
      { when: { stat: 'agi', gte: 30 }, type: 'add', key: 'dodge', v: 0.06, text: '회피 +6%' },
    ],
    recipe: { wing: 4 },
  },
  goblinGreed: {
    name: '고블린의 탐욕', slot: 'arm', grade: 1, load: 2, tags: ['bleed'],
    stats: { str: 4, sen: 2 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.25, action: { status: 'bleed', stacks: 1 }, text: '공격 시 25% 출혈' },
      { type: 'add', key: 'goldMul', v: 0.2, text: '골드 획득 +20%' },
    ],
    recipe: { rust: 5 },
  },
  chiefWill: {
    name: '족장의 투지', slot: 'heart', grade: 3, load: 5, tags: ['brawl'],
    stats: { str: 10, vit: 6 },
    effects: [
      { when: { stat: 'str', gte: 40 }, type: 'on', event: 'kill', chance: 1, action: { heal: 0.04 }, text: '처치 시 HP 4% 회복' },
      { when: { tag: 'brawl', gte: 2 }, type: 'mul', key: 'physAtk', v: 1.15, text: '물리 공격력 +15%' },
    ],
    recipe: { chief: 1, rust: 6 },
  },

  // ── 독늪 ──
  toadGland: {
    name: '진흙 독샘', slot: 'head', grade: 2, load: 3, tags: ['poison'],
    stats: { mag: 3, toxicity: 3 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.4, action: { status: 'poison', stacks: 1 }, text: '공격 시 40% 중독' },
    ],
    recipe: { venom: 5 },
  },
  leechFang: {
    name: '거머리 송곳니', slot: 'arm', grade: 2, load: 3, tags: ['drain', 'bleed'],
    stats: { lifesteal: 6 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.3, action: { status: 'bleed', stacks: 1 }, text: '공격 시 30% 출혈' },
      { when: { race: 'undead' }, type: 'flag', flag: 'undeadLifesteal', text: '언데드도 흡혈로 회복 가능' },
    ],
    recipe: { blood: 5 },
  },
  sporeSac: {
    name: '포자 주머니', slot: 'back', grade: 2, load: 3, tags: ['poison', 'slime'],
    stats: { vit: 3, toxicity: 2 },
    effects: [
      { type: 'on', event: 'kill', chance: 0.5, action: { cloud: { r: 30, dur: 3 } }, text: '처치 시 50% 독 구름' },
      { when: { stat: 'toxicity', gte: 8 }, type: 'add', key: 'cloudSize', v: 0.5, text: '독 구름 크기 +50%' },
    ],
    recipe: { spore: 4, goo: 3 },
  },
  queenCrown: {
    name: '늪 거인의 왕관', slot: 'head', grade: 4, load: 7, tags: ['poison'],
    stats: { toxicity: 8, spi: 6, mag: 4 },
    effects: [
      { type: 'add', key: 'poisonCap', v: 10, text: '독 최대 중첩 +10' },
      { when: { tag: 'poison', gte: 3 }, type: 'flag', flag: 'poisonSpread', text: '중독된 적이 죽으면 주변으로 독 전염' },
    ],
    recipe: { queen: 1, venom: 8 },
  },

  // ── 화산 균열 ──
  emberHeart: {
    name: '악귀의 불씨', slot: 'heart', grade: 2, load: 3, tags: ['fire'],
    stats: { mag: 5, fireAff: 5 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.35, action: { status: 'burn', stacks: 1 }, text: '공격 시 35% 화상' },
    ],
    recipe: { ember: 5 },
  },
  magmaHide: {
    name: '용암 피부', slot: 'leg', grade: 3, load: 5, tags: ['fire', 'giant'],
    stats: { pres: 14, tenacity: 10, agi: -4 },
    effects: [
      { type: 'on', event: 'hurt', chance: 1, action: { status: 'burn', stacks: 2 }, text: '나를 때린 적에게 화상 2중첩' },
    ],
    recipe: { magma: 6 },
  },
  impTrick: {
    name: '임프의 장난', slot: 'back', grade: 1, load: 2, tags: ['fire', 'wind'],
    stats: { agi: 4 },
    effects: [
      { type: 'on', event: 'dodge', chance: 1, action: { aoe: { r: 44, mul: 0.8, type: 'mag', status: 'burn' } }, text: '회피 시 주변에 화염 폭발' },
      { type: 'on', event: 'dash', chance: 1, action: { aoe: { r: 30, mul: 0.4, type: 'mag', status: 'burn' } }, text: '대시 시 작은 화염' },
    ],
    recipe: { cinder: 4 },
  },
  riftCore: {
    name: '균열의 핵', slot: 'heart', grade: 5, load: 11, tags: ['fire'],
    stats: { mag: 18, fireAff: 15 },
    effects: [
      { type: 'mul', key: 'magAtk', v: 1.2, text: '마법 공격력 +20%' },
      { when: { stat: 'mag', gte: 60 }, type: 'flag', flag: 'burnExplode', text: '화상 5중첩 시 폭발' },
    ],
    recipe: { core: 2, ember: 10, magma: 5 },
  },

  // ── 서리 회랑 ──
  frostFang: {
    name: '서리 망자의 손톱', slot: 'arm', grade: 2, load: 3, tags: ['ice'],
    stats: { agi: 4, iceAff: 5 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.35, action: { status: 'chill', stacks: 1 }, text: '공격 시 35% 냉기' },
    ],
    recipe: { frost: 5 },
  },
  mirrorShell: {
    name: '거울 정령의 파편', slot: 'back', grade: 3, load: 5, tags: ['reflect'],
    stats: { reflect: 12, mres: 6 },
    effects: [
      { when: { diff: ['pres', 'mres'], lte: 10 }, type: 'stat', stat: 'reflect', v: 12, text: '반사 +12%' },
    ],
    recipe: { mirror: 6 },
  },
  iceCore: {
    name: '오우거의 빙핵', slot: 'heart', grade: 3, load: 5, tags: ['ice', 'giant'],
    stats: { vit: 8, mres: 10 },
    effects: [
      { type: 'on', event: 'hurt', chance: 1, action: { status: 'chill', stacks: 1 }, text: '나를 때린 적에게 냉기' },
    ],
    recipe: { icecore: 5 },
  },
  meltCore: {
    name: '녹아내린 빙핵', slot: 'heart', grade: 4, load: 6, tags: ['fire', 'ice'],
    stats: { mag: 8, fireAff: 8, iceAff: 8 },
    effects: [
      { type: 'flag', flag: 'steamMaster', text: '증기 폭발 피해 2배, 범위 증가' },
      { type: 'on', event: 'hit', chance: 0.2, action: { status: 'chill', stacks: 1 }, text: '공격 시 20% 냉기' },
    ],
    recipe: { meltcore: 3 },
  },
  witchEye: {
    name: '서리 마녀의 눈', slot: 'head', grade: 4, load: 7, tags: ['ice', 'curse'],
    stats: { mag: 10, sen: 6 },
    effects: [
      { when: { stat: 'iceAff', gte: 10 }, type: 'add', key: 'freezeReduce', v: 2, text: '빙결에 필요한 냉기 -2' },
      { type: 'mul', key: 'statusDmgMul', v: 1.15, text: '상태이상 피해 +15%' },
    ],
    recipe: { witch: 1, frost: 8 },
  },

  // ── 그림자 묘지 ──
  boneFrame: {
    name: '해골의 뼈대', slot: 'leg', grade: 2, load: 3, tags: ['giant', 'undying'],
    stats: { pres: 10, vit: 3 },
    effects: [
      { when: { race: 'undead' }, type: 'stat', stat: 'pres', v: 10, text: '물리 저항 +10' },
    ],
    recipe: { bone: 5 },
  },
  wraithWhisper: {
    name: '망령술사의 속삭임', slot: 'head', grade: 3, load: 5, tags: ['shadow', 'curse'],
    stats: { spi: 8, mag: 6 },
    effects: [
      { type: 'on', event: 'kill', chance: 0.4, action: { shards: { n: 3, mul: 0.6, type: 'mag' } }, text: '처치 시 40% 혼 탄환 3발' },
    ],
    recipe: { soul: 6 },
  },
  ghoulHunger: {
    name: '구울의 굶주림', slot: 'arm', grade: 2, load: 3, tags: ['drain', 'undying'],
    stats: { str: 5, lifesteal: 5 },
    effects: [
      { type: 'flag', flag: 'lowHpDrain', text: 'HP 50% 이하일 때 흡혈 2배' },
    ],
    recipe: { rot: 5 },
  },
  graveContract: {
    name: '묘지기의 계약', slot: 'back', grade: 5, load: 10, tags: ['shadow'],
    stats: { str: 10, mag: 10, sen: 8 },
    effects: [
      { type: 'mul', key: 'dmgMul', v: 1.4, text: '모든 피해 +40%' },
      { type: 'flag', flag: 'noHeal', text: '대가: 모든 회복 불가' },
    ],
    recipe: { grave: 1, bone: 10, soul: 5 },
  },
};

// 태그 시너지: 장착한 각인 + 장비의 태그 개수
export const TAGS = {
  fire: { name: '화염', color: '#ff7a2a', tiers: [
    { n: 2, text: '화상 피해 +30%', effects: [{ type: 'mul', key: 'burnMul', v: 1.3 }] },
    { n: 4, text: '화상 걸린 적이 죽으면 주변에 불이 옮겨붙음', effects: [{ type: 'flag', flag: 'burnSpread' }] },
  ] },
  ice: { name: '냉기', color: '#9fe3ff', tiers: [
    { n: 2, text: '냉기 둔화 효과 증가', effects: [{ type: 'mul', key: 'chillMul', v: 1.4 }] },
    { n: 4, text: '빙결된 적이 받는 피해 +50%', effects: [{ type: 'flag', flag: 'frozenVuln' }] },
  ] },
  poison: { name: '독', color: '#9be15d', tiers: [
    { n: 2, text: '독 최대 중첩 +5', effects: [{ type: 'add', key: 'poisonCap', v: 5 }] },
    { n: 4, text: '중독된 적이 죽으면 독 구름', effects: [{ type: 'flag', flag: 'poisonBurst' }] },
  ] },
  bleed: { name: '출혈', color: '#e0445a', tiers: [
    { n: 2, text: '출혈 피해 +40%', effects: [{ type: 'mul', key: 'bleedMul', v: 1.4 }] },
    { n: 3, text: '치명타가 출혈 2중첩', effects: [{ type: 'flag', flag: 'critBleed' }] },
  ] },
  drain: { name: '흡혈', color: '#c4304a', tiers: [
    { n: 2, text: '흡혈 +4%', effects: [{ type: 'stat', stat: 'lifesteal', v: 4 }] },
    { n: 3, text: '넘친 회복량은 보호막으로', effects: [{ type: 'flag', flag: 'overhealShield' }] },
  ] },
  wind: { name: '바람', color: '#bfe8d0', tiers: [
    { n: 2, text: '이동 속도 +15%', effects: [{ type: 'mul', key: 'moveSpeed', v: 1.15 }] },
    { n: 3, text: '대시 쿨타임 -40%, 대시 잔상', effects: [{ type: 'mul', key: 'dashCd', v: 0.6 }, { type: 'flag', flag: 'dashAfterimage' }] },
  ] },
  giant: { name: '거체', color: '#b08a5a', tiers: [
    { n: 2, text: '최대 HP +15%', effects: [{ type: 'mul', key: 'maxHp', v: 1.15 }] },
    { n: 3, text: '받는 피해 -12%', effects: [{ type: 'mul', key: 'dmgTakenMul', v: 0.88 }] },
  ] },
  reflect: { name: '반사', color: '#e6f3ff', tiers: [
    { n: 2, text: '반사 +8%', effects: [{ type: 'stat', stat: 'reflect', v: 8 }] },
    { n: 3, text: '반사 피해가 주변 모든 적에게', effects: [{ type: 'flag', flag: 'reflectAoe' }] },
  ] },
  slime: { name: '점액', color: '#7ed957', tiers: [
    { n: 2, text: '물리·마법 저항 +6', effects: [{ type: 'stat', stat: 'pres', v: 6 }, { type: 'stat', stat: 'mres', v: 6 }] },
  ] },
  shadow: { name: '그림자', color: '#8a6aff', tiers: [
    { n: 2, text: '치명타 확률 +12%', effects: [{ type: 'add', key: 'crit', v: 0.12 }] },
  ] },
  curse: { name: '저주', color: '#b7a4ff', tiers: [
    { n: 2, text: '상태이상 피해 +25%', effects: [{ type: 'mul', key: 'statusDmgMul', v: 1.25 }] },
  ] },
  undying: { name: '불사', color: '#e8e2cf', tiers: [
    { n: 2, text: '사냥마다 1번, 죽으면 HP 30%로 부활', effects: [{ type: 'flag', flag: 'undying' }] },
  ] },
  brawl: { name: '투사', color: '#ffb347', tiers: [
    { n: 2, text: '근력 +10%', effects: [{ type: 'statPct', stat: 'str', v: 0.1 }] },
  ] },
};

// 원소 상쇄: 화염과 냉기가 둘 다 4개 이상이면 둘 다 꺼진다
export const CANCELS = [{ a: 'fire', b: 'ice', n: 4, name: '원소 상쇄' }];

// 원소 반응 (도감 기록용 설명)
export const REACTIONS = {
  steam: { name: '증기 폭발', recipe: '화상 + 냉기', desc: '두 상태를 소모해 큰 마법 폭발' },
  toxic: { name: '유독 연기', recipe: '중독 + 화상', desc: '화상을 소모해 지속 피해 구름 생성' },
  bloodIce: { name: '혈빙', recipe: '출혈 + 냉기', desc: '출혈을 소모해 즉시 빙결 + 피해' },
  septic: { name: '패혈', recipe: '중독 + 출혈', desc: '3초간 독 피해 2배' },
};

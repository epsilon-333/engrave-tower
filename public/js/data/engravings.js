// 각인: 신체 부위에 새기는 고대 문양. 잔향을 모아 공명 제단에서 새긴다.
// grade 1~5, load = 각인 부하. 고등급은 부하가 크고 태그가 적다 → 많이 끼우면 과부하.
// effects[].when = 발동 조건 (conditions.js 형식)

export const ENGRAVINGS = {
  // ── 이끼 동굴 ──
  slimeSkin: {
    name: '끈적한 점액', slot: 'leg', grade: 1, load: 2, tags: ['slime'],
    stats: { vit: 6, pres: 4 },
    effects: [
      { type: 'flag', flag: 'slimeSlow', text: '나를 때린 적에게 냉기 1중첩' },
      { type: 'add', key: 'regen', v: 0.004, text: '초당 HP 0.4% 회복' },
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
    stats: { pres: 14, vit: 4, agi: -4 },
    effects: [
      { type: 'on', event: 'hurt', chance: 1, action: { status: 'burn', stacks: 2 }, text: '나를 때린 적에게 화상 2중첩' },
    ],
    recipe: { magma: 6 },
  },
  impTrick: {
    name: '임프의 장난', slot: 'back', grade: 1, load: 2, tags: ['fire', 'wind'],
    stats: { agi: 6, fireAff: 2 },
    effects: [
      { type: 'on', event: 'dodge', chance: 1, action: { aoe: { r: 48, mul: 1.0, type: 'mag', status: 'burn' } }, text: '회피 시 주변에 화염 폭발' },
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
    stats: { pres: 12, vit: 4 },
    effects: [
      { when: { race: 'undead' }, type: 'stat', stat: 'pres', v: 10, text: '물리 저항 +10' },
      { type: 'on', event: 'hurt', chance: 0.2, action: { shield: 0.03 }, text: '맞으면 20% 확률로 보호막' },
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
      { type: 'mul', key: 'dmgMul', v: 1.3, text: '모든 피해 +30%' },
      { type: 'flag', flag: 'noHeal', text: '대가: 모든 회복 불가' },
    ],
    recipe: { grave: 1, bone: 10, soul: 5 },
  },

  // ════════ 추가 각인 ════════
  // ── 이끼 동굴 ──
  slimeArmor: {
    name: '점액 갑주', slot: 'leg', grade: 1, load: 2, tags: ['slime', 'giant'],
    stats: { vit: 3, pres: 5 },
    effects: [{ when: { tag: 'slime', gte: 2 }, type: 'add', key: 'statusRes', v: 0.15, text: '상태이상 저항 +15%' }],
    recipe: { goo: 5 },
  },
  wogolEye: {
    name: '워골의 눈', slot: 'head', grade: 1, load: 2, tags: ['shadow'],
    stats: { sen: 5 },
    effects: [{ type: 'on', event: 'crit', chance: 0.4, action: { status: 'bleed', stacks: 1 }, text: '치명타 시 40% 출혈' }],
    recipe: { wing: 5 },
  },
  goblinThrow: {
    name: '고블린 투척술', slot: 'arm', grade: 2, load: 3, tags: ['bleed', 'wind'],
    stats: { agi: 3, str: 3 },
    effects: [{ type: 'on', event: 'dash', chance: 1, action: { shards: { n: 3, mul: 0.6, type: 'phys', dash: true } }, text: '대시할 때 대시한 방향으로 단검 3개 투척 (공격력 60%)' }],
    recipe: { rust: 4, wing: 3 },
  },
  rustChain: {
    name: '녹슨 쇠사슬', slot: 'back', grade: 2, load: 3, tags: ['giant', 'brawl'],
    stats: { pres: 8, str: 3 },
    effects: [{ when: { stat: 'pres', gte: 30 }, type: 'on', event: 'hurt', chance: 0.5, action: { aoe: { r: 40, mul: 0.7, type: 'phys' } }, text: '맞으면 50% 확률로 쇠사슬 휘두르기' }],
    recipe: { rust: 6 },
  },
  chiefRoar: {
    name: '족장의 함성', slot: 'head', grade: 3, load: 5, tags: ['brawl'],
    stats: { str: 6, vit: 4 },
    effects: [{ type: 'on', event: 'kill', chance: 1, action: { shield: 0.05 }, text: '처치 시 최대 HP 5% 보호막' }],
    recipe: { chief: 1, goo: 4 },
  },
  // ── 독늪 ──
  mudShell: {
    name: '진흙 껍질', slot: 'leg', grade: 2, load: 3, tags: ['slime', 'poison'],
    stats: { mres: 8, toxicity: 2 },
    effects: [{ type: 'on', event: 'hurt', chance: 1, action: { status: 'poison', stacks: 2 }, text: '나를 때린 적 중독 2중첩' }],
    recipe: { venom: 3, goo: 3 },
  },
  stingTail: {
    name: '독침 꼬리', slot: 'back', grade: 2, load: 3, tags: ['poison', 'wind'],
    stats: { agi: 4, toxicity: 2 },
    effects: [{ type: 'on', event: 'dodge', chance: 1, action: { cloud: { r: 30, dur: 3 } }, text: '회피하면 독 구름' }],
    recipe: { venom: 4, wing: 2 },
  },
  bloodOath: {
    name: '피의 맹세', slot: 'heart', grade: 3, load: 5, tags: ['drain', 'brawl'],
    stats: { str: 6, lifesteal: 5 },
    effects: [{ when: { stat: 'lifesteal', gte: 10 }, type: 'mul', key: 'dmgMul', v: 1.12, text: '모든 피해 +12%' }],
    recipe: { blood: 6, rust: 3 },
  },
  rotSporeHeart: {
    name: '부패한 포자심', slot: 'heart', grade: 2, load: 3, tags: ['poison', 'undying'],
    stats: { vit: 5, toxicity: 3 },
    effects: [{ when: { race: 'undead' }, type: 'add', key: 'poisonCap', v: 8, text: '독 최대 중첩 +8' }],
    recipe: { spore: 5 },
  },
  leechLordMaw: {
    name: '거머리 군주의 입', slot: 'head', grade: 4, load: 7, tags: ['drain', 'bleed'],
    stats: { lifesteal: 8, sen: 4 },
    effects: [
      { type: 'on', event: 'crit', chance: 1, action: { heal: 0.02 }, text: '치명타 시 HP 2% 회복' },
      { type: 'flag', flag: 'lowHpDrain', text: 'HP 50% 이하일 때 흡혈 2배' },
    ],
    recipe: { queen: 1, blood: 8 },
  },
  giantHeart: {
    name: '늪 거인의 심장', slot: 'heart', grade: 5, load: 10, tags: ['poison', 'giant'],
    stats: { vit: 15, toxicity: 10 },
    effects: [
      { type: 'add', key: 'poisonCap', v: 10, text: '독 최대 중첩 +10' },
      { when: { stat: 'vit', gte: 50 }, type: 'flag', flag: 'poisonBurst', text: '중독된 적이 죽으면 독 구름' },
    ],
    recipe: { queen: 2, venom: 6, spore: 6 },
  },
  // ── 화산 균열 ──
  cinderGlove: {
    name: '잿불 장갑', slot: 'arm', grade: 2, load: 3, tags: ['fire', 'brawl'],
    stats: { str: 4 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.25, action: { status: 'burn', stacks: 1 }, text: '공격 시 25% 화상' },
      { when: { cmp: ['str', '>', 'mag'] }, type: 'mul', key: 'physAtk', v: 1.08, text: '물리 공격력 +8%' },
    ],
    recipe: { cinder: 3, ember: 3 },
  },
  demonHorn: {
    name: '악귀의 뿔', slot: 'head', grade: 2, load: 3, tags: ['fire', 'curse'],
    stats: { mag: 4, fireAff: 3 },
    effects: [{ type: 'mul', key: 'statusDmgMul', v: 1.1, text: '상태이상 피해 +10%' }],
    recipe: { ember: 5 },
  },
  magmaCore: {
    name: '마그마 핵', slot: 'heart', grade: 3, load: 5, tags: ['fire', 'giant'],
    stats: { vit: 6, pres: 6 },
    effects: [{ type: 'on', event: 'hurt', chance: 0.6, action: { aoe: { r: 36, mul: 0.6, type: 'mag', status: 'burn' } }, text: '맞으면 60% 확률로 화염 분출' }],
    recipe: { magma: 6, cinder: 2 },
  },
  impWings: {
    name: '임프의 날개', slot: 'back', grade: 2, load: 3, tags: ['fire', 'wind'],
    stats: { agi: 5 },
    effects: [
      { type: 'mul', key: 'dashCd', v: 0.8, text: '대시 쿨타임 -20%' },
      { type: 'on', event: 'dash', chance: 1, action: { aoe: { r: 32, mul: 0.5, type: 'mag', status: 'burn' } }, text: '대시 위치에 불꽃' },
    ],
    recipe: { cinder: 5 },
  },
  riftShard: {
    name: '균열 파편', slot: 'arm', grade: 4, load: 7, tags: ['fire', 'shadow'],
    stats: { mag: 8, sen: 6 },
    effects: [{ type: 'on', event: 'crit', chance: 1, action: { aoe: { r: 36, mul: 0.8, type: 'mag', status: 'burn' } }, text: '치명타 시 폭발' }],
    recipe: { core: 1, ember: 6 },
  },
  volcanoRage: {
    name: '화산의 분노', slot: 'heart', grade: 5, load: 11, tags: ['fire', 'brawl'],
    stats: { str: 14, fireAff: 10 },
    effects: [{ when: { stat: 'str', gte: 60 }, type: 'on', event: 'hit', chance: 1, action: { status: 'burn', stacks: 1 }, text: '모든 공격에 화상' }],
    recipe: { core: 2, magma: 8 },
  },
  // ── 서리 회랑 ──
  frostPlate: {
    name: '서리 갑옷 조각', slot: 'leg', grade: 2, load: 3, tags: ['ice', 'giant'],
    stats: { pres: 6, mres: 6 },
    effects: [{ type: 'on', event: 'hurt', chance: 1, action: { status: 'chill', stacks: 1 }, text: '나를 때린 적에게 냉기' }],
    recipe: { frost: 4, icecore: 2 },
  },
  deadBreath: {
    name: '망자의 숨결', slot: 'head', grade: 2, load: 3, tags: ['ice', 'curse'],
    stats: { mag: 4, iceAff: 4 },
    effects: [{ type: 'on', event: 'kill', chance: 1, action: { aoe: { r: 40, mul: 0.3, type: 'mag', status: 'chill' } }, text: '처치 시 냉기 파동' }],
    recipe: { frost: 5 },
  },
  mirrorPupil: {
    name: '거울 눈동자', slot: 'head', grade: 3, load: 5, tags: ['reflect', 'shadow'],
    stats: { sen: 6, reflect: 6 },
    effects: [{ when: { stat: 'reflect', gte: 20 }, type: 'add', key: 'crit', v: 0.1, text: '치명타 확률 +10%' }],
    recipe: { mirror: 5, wing: 3 },
  },
  ogreFist: {
    name: '얼음 오우거의 주먹', slot: 'arm', grade: 3, load: 5, tags: ['ice', 'brawl'],
    stats: { str: 8 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.2, action: { status: 'chill', stacks: 1 }, text: '공격 시 20% 냉기' },
      { when: { stat: 'iceAff', gte: 10 }, type: 'flag', flag: 'frozenVuln', text: '빙결된 적이 받는 피해 +50%' },
    ],
    recipe: { icecore: 5, rust: 3 },
  },
  freezeCrystal: {
    name: '빙결 결정', slot: 'back', grade: 4, load: 7, tags: ['ice'],
    stats: { iceAff: 10, spi: 5 },
    effects: [{ type: 'add', key: 'freezeReduce', v: 1, text: '빙결에 필요한 냉기 -1' }],
    recipe: { witch: 1, icecore: 4 },
  },
  witchCrown: {
    name: '서리 마녀의 관', slot: 'head', grade: 5, load: 10, tags: ['ice', 'curse'],
    stats: { mag: 14, iceAff: 12 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.4, action: { status: 'chill', stacks: 1 }, text: '공격 시 40% 냉기' },
      { when: { stat: 'mag', gte: 60 }, type: 'on', event: 'kill', chance: 1, action: { shards: { n: 4, mul: 0.5, type: 'mag' } }, text: '처치 시 얼음 파편 4개' },
    ],
    recipe: { witch: 2, frost: 8 },
  },
  // ── 그림자 묘지 ──
  boneShield: {
    name: '뼈 방패', slot: 'arm', grade: 2, load: 3, tags: ['giant', 'undying'],
    stats: { pres: 10 },
    effects: [{ type: 'on', event: 'hurt', chance: 0.25, action: { shield: 0.04 }, text: '맞으면 25% 확률로 보호막' }],
    recipe: { bone: 5 },
  },
  soulFlame: {
    name: '혼불', slot: 'back', grade: 2, load: 3, tags: ['shadow', 'curse'],
    stats: { mag: 4, spi: 4 },
    effects: [{ type: 'on', event: 'kill', chance: 0.5, action: { shards: { n: 2, mul: 0.6, type: 'mag' } }, text: '처치 시 50% 혼 탄환 2발' }],
    recipe: { soul: 5 },
  },
  ghoulTeeth: {
    name: '구울 이빨', slot: 'head', grade: 2, load: 3, tags: ['drain', 'poison'],
    stats: { lifesteal: 4, toxicity: 3 },
    effects: [{ type: 'on', event: 'hit', chance: 0.25, action: { status: 'poison', stacks: 1 }, text: '공격 시 25% 중독' }],
    recipe: { rot: 5 },
  },
  wraithCloak: {
    name: '망령의 망토', slot: 'back', grade: 3, load: 5, tags: ['shadow', 'wind'],
    stats: { agi: 6, sen: 4 },
    effects: [
      { type: 'add', key: 'dodge', v: 0.05, text: '회피 +5%' },
      { type: 'on', event: 'dodge', chance: 1, action: { aoe: { r: 34, mul: 0.7, type: 'phys', status: 'bleed' } }, text: '회피하면 그림자 베기' },
    ],
    recipe: { soul: 4, wing: 4 },
  },
  necroHeart: {
    name: '사령의 심장', slot: 'heart', grade: 4, load: 7, tags: ['undying', 'curse'],
    stats: { spi: 8, vit: 6 },
    effects: [
      { when: { race: 'undead' }, type: 'mul', key: 'dmgMul', v: 1.15, text: '모든 피해 +15%' },
      { type: 'mul', key: 'statusDmgMul', v: 1.1, text: '상태이상 피해 +10%' },
    ],
    recipe: { grave: 1, bone: 4 },
  },
  graveScythe: {
    name: '묘지기의 낫', slot: 'arm', grade: 5, load: 10, tags: ['shadow', 'bleed'],
    stats: { str: 10, sen: 10 },
    effects: [
      { type: 'flag', flag: 'critBleed', text: '치명타가 출혈 2중첩' },
      { when: { stat: 'sen', gte: 50 }, type: 'add', key: 'lowHunt', v: 0.25, text: 'HP 30% 이하인 적에게 주는 피해 +25%' },
    ],
    recipe: { grave: 2, bone: 6 },
  },
  // ── 자원 각인 (오러 · 종족 자원 · 분노) ──
  auraSigil: {
    name: '오러 증폭 문양', slot: 'heart', grade: 3, load: 5, tags: ['brawl'],
    stats: { str: 4, pres: 4 },
    effects: [
      { when: { race: 'knight' }, type: 'add', key: 'hurtRes', v: 0.5, text: '맞아서 얻는 오러 +50%' },
      { when: { race: 'knight' }, type: 'flag', flag: 'resGuard', text: '오러 50 이상이면 받는 피해 -10%' },
    ],
    recipe: { chief: 1, rust: 4 },
  },
  manaSpring: {
    name: '샘솟는 기운', slot: 'head', grade: 3, load: 5, tags: ['curse'],
    stats: { spi: 6, mag: 3 },
    effects: [
      { type: 'on', event: 'kill', chance: 1, action: { res: 8 }, text: '처치 시 종족 자원 +8' },
      { type: 'mul', key: 'resGain', v: 1.1, text: '얻는 종족 자원 +10%' },
    ],
    recipe: { soul: 3, spore: 3 },
  },
  bloodMagic: {
    name: '피의 마법', slot: 'heart', grade: 4, load: 6, tags: ['drain', 'curse'],
    stats: { mag: 6, vit: 6 },
    effects: [
      { type: 'flag', flag: 'bloodMagic', text: '종족 자원이 모자라면 모자란 만큼 체력으로 스킬을 쓴다 (1당 최대 HP 0.5%)' },
      { when: { stat: 'lifesteal', gte: 5 }, type: 'mul', key: 'magAtk', v: 1.1, text: '마법 공격력 +10%' },
    ],
    recipe: { blood: 6, soul: 3 },
  },
  rageFang: {
    name: '분노의 송곳니', slot: 'arm', grade: 3, load: 5, tags: ['brawl', 'drain'],
    stats: { str: 5 },
    effects: [
      { when: { race: 'orc' }, type: 'flag', flag: 'rageFast', text: '분노가 1.5배 빨리 참' },
      { type: 'on', event: 'kill', chance: 0.5, action: { heal: 0.03 }, text: '처치 시 50% 확률로 HP 3% 회복' },
    ],
    recipe: { rust: 4, blood: 4 },
  },

  // ── 혼합 문양 (여러 지역의 잔향) ──
  steamEngine: {
    name: '증기 기관', slot: 'heart', grade: 4, load: 6, tags: ['fire', 'ice'],
    stats: { mag: 6 },
    effects: [{ type: 'mul', key: 'reactionMul', v: 1.3, text: '원소 반응 피해 +30%' }],
    recipe: { ember: 5, frost: 5 },
  },
  toxicFlask: {
    name: '독불 주머니', slot: 'back', grade: 3, load: 5, tags: ['poison', 'fire'],
    stats: { toxicity: 4, fireAff: 4 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.2, action: { status: 'poison', stacks: 1 }, text: '공격 시 20% 중독' },
      { type: 'on', event: 'hit', chance: 0.2, action: { status: 'burn', stacks: 1 }, text: '공격 시 20% 화상' },
    ],
    recipe: { venom: 4, ember: 4 },
  },
  bloodFrost: {
    name: '피얼음 칼날', slot: 'arm', grade: 3, load: 5, tags: ['bleed', 'ice'],
    stats: { str: 4, iceAff: 4 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.25, action: { status: 'bleed', stacks: 1 }, text: '공격 시 25% 출혈' },
      { type: 'on', event: 'hit', chance: 0.25, action: { status: 'chill', stacks: 1 }, text: '공격 시 25% 냉기' },
    ],
    recipe: { blood: 4, frost: 4 },
  },
  septicClaw: {
    name: '패혈의 손톱', slot: 'arm', grade: 3, load: 5, tags: ['poison', 'bleed'],
    stats: { toxicity: 4, sen: 3 },
    effects: [
      { type: 'on', event: 'hit', chance: 0.25, action: { status: 'poison', stacks: 1 }, text: '공격 시 25% 중독' },
      { type: 'on', event: 'hit', chance: 0.25, action: { status: 'bleed', stacks: 1 }, text: '공격 시 25% 출혈' },
    ],
    recipe: { blood: 4, venom: 4 },
  },
  balanceSigil: {
    name: '균형의 문양', slot: 'heart', grade: 3, load: 4, tags: [],
    stats: { pres: 5, mres: 5 },
    effects: [{ when: { diff: ['pres', 'mres'], lte: 5 }, type: 'mul', key: 'dmgTakenMul', v: 0.85, text: '받는 피해 -15%' }],
    recipe: { mirror: 3, bone: 3 },
  },
  allroundSigil: {
    name: '만능의 문양', slot: 'head', grade: 4, load: 6, tags: [],
    stats: { str: 3, mag: 3, agi: 3, vit: 3, sen: 3, spi: 3 },
    effects: [{ when: { minBase: 25 }, type: 'mul', key: 'dmgMul', v: 1.2, text: '모든 피해 +20%' }],
    recipe: { rust: 5, spore: 5, cinder: 5 },
  },
  extremeSigil: {
    name: '극한의 문양', slot: 'back', grade: 4, load: 6, tags: ['brawl'],
    stats: {},
    effects: [
      { when: { extreme: true }, type: 'mul', key: 'dmgMul', v: 1.22, text: '극한일 때 모든 피해 +22%' },
      { type: 'mul', key: 'maxHp', v: 0.92, text: '대가: 최대 HP -8%' },
    ],
    recipe: { chief: 1, magma: 4, icecore: 4 },
  },
  berserkBlood: {
    name: '광전사의 피', slot: 'heart', grade: 3, load: 5, tags: ['drain', 'brawl'],
    stats: { lifesteal: 4, str: 4 },
    effects: [
      { type: 'flag', flag: 'lowHpDrain', text: 'HP 50% 이하일 때 흡혈 2배' },
      { when: { race: 'orc' }, type: 'add', key: 'regen', v: 0.005, text: '초당 HP 0.5% 회복' },
    ],
    recipe: { blood: 5, rust: 5 },
  },
  hunterMark: {
    name: '사냥꾼의 표식', slot: 'head', grade: 3, load: 5, tags: ['shadow', 'wind'],
    stats: { sen: 5, agi: 3 },
    effects: [{ type: 'flag', flag: 'markOnCrit', text: '치명타가 적에게 표식(+20% 피해)' }],
    recipe: { wing: 5, frost: 3 },
  },
  echoAmplifier: {
    name: '공명 증폭기', slot: 'back', grade: 4, load: 8, tags: ['curse'],
    stats: { spi: 6, mag: 4 },
    effects: [
      { when: { tag: 'curse', gte: 2 }, type: 'mul', key: 'statusDmgMul', v: 1.2, text: '상태이상 피해 +20%' },
      { when: { stat: 'spi', gte: 40 }, type: 'add', key: 'loadCap', v: 4, text: '각인 부하 한도 +4' },
    ],
    recipe: { soul: 4, spore: 4, mirror: 2 },
  },

  // ════════ 탑의 문양 (탑을 오르며 자주 만나는 각인 · 제단에서도 새길 수 있다) ════════
  emberSpark: {
    name: '불티', slot: 'arm', grade: 1, load: 2, tags: ['fire'],
    stats: { fireAff: 3, mag: 2 },
    effects: [{ type: 'on', event: 'hit', chance: 0.2, action: { status: 'burn', stacks: 1 }, text: '공격 시 20% 화상' }],
    recipe: { ember: 3 },
  },
  frostBite: {
    name: '동상', slot: 'arm', grade: 1, load: 2, tags: ['ice'],
    stats: { iceAff: 3, agi: 2 },
    effects: [{ type: 'on', event: 'hit', chance: 0.2, action: { status: 'chill', stacks: 1 }, text: '공격 시 20% 냉기' }],
    recipe: { frost: 3 },
  },
  ironHide: {
    name: '무쇠 가죽', slot: 'leg', grade: 1, load: 2, tags: ['giant'],
    stats: { pres: 8, vit: 4 },
    effects: [{ type: 'mul', key: 'dmgTakenMul', v: 0.97, text: '받는 피해 -3%' }],
    recipe: { rust: 4 },
  },
  quickHands: {
    name: '빠른 손놀림', slot: 'arm', grade: 1, load: 2, tags: ['wind'],
    stats: { agi: 3 },
    effects: [{ type: 'mul', key: 'atkSpeed', v: 1.06, text: '공격 속도 +6%' }],
    recipe: { wing: 4 },
  },
  hungryBlade: {
    name: '굶주린 칼날', slot: 'arm', grade: 2, load: 3, tags: ['drain', 'bleed'],
    stats: { lifesteal: 4, str: 3 },
    effects: [{ type: 'on', event: 'kill', chance: 1, action: { heal: 0.03 }, text: '처치 시 체력 3% 회복' }],
    recipe: { blood: 4, rust: 2 },
  },
  windStep: {
    name: '바람 발걸음', slot: 'leg', grade: 2, load: 3, tags: ['wind'],
    stats: { agi: 4 },
    effects: [{ type: 'on', event: 'dash', chance: 1, action: { shards: { n: 4, mul: 0.5, type: 'phys', dash: true } }, text: '대시하면 가는 쪽으로 칼날 4개 (공격력 50%)' }],
    recipe: { wing: 5, frost: 2 },
  },
  mirrorWard: {
    name: '거울 결계', slot: 'back', grade: 2, load: 3, tags: ['reflect'],
    stats: { reflect: 8, mres: 4 },
    effects: [{ type: 'on', event: 'hurtMag', chance: 1, action: { shield: 0.05 }, text: '마법 피해를 받으면 최대 체력 5% 보호막' }],
    recipe: { mirror: 4 },
  },
  curseBrand: {
    name: '저주 낙인', slot: 'head', grade: 2, load: 3, tags: ['curse'],
    stats: { mag: 4, spi: 2 },
    effects: [{ type: 'on', event: 'hit', chance: 0.3, action: { status: 'curse', stacks: 1 }, text: '공격 시 30% 저주' }],
    recipe: { soul: 4 },
  },
  chainEmber: {
    name: '화염 연쇄', slot: 'heart', grade: 3, load: 5, tags: ['fire', 'wind'],
    stats: { mag: 5, fireAff: 4 },
    effects: [{ type: 'on', event: 'kill', chance: 1, action: { aoe: { r: 50, mul: 0.8, type: 'mag', status: 'burn' } }, text: '처치 시 둘레 50에 화염 폭발 (마법 공격력 80%)' }],
    recipe: { ember: 6, cinder: 3 },
  },
  frostNova: {
    name: '서리 파동', slot: 'back', grade: 3, load: 5, tags: ['ice'],
    stats: { mres: 6, iceAff: 4 },
    effects: [{ type: 'on', event: 'hurt', chance: 0.35, action: { aoe: { r: 60, mul: 0.6, type: 'mag', status: 'chill' } }, text: '맞으면 35% 확률로 둘레 60에 서리 파동 (마법 공격력 60%)' }],
    recipe: { frost: 5, icecore: 2 },
  },
  venomCloak: {
    name: '독 망토', slot: 'back', grade: 3, load: 5, tags: ['poison', 'shadow'],
    stats: { toxicity: 4, agi: 3 },
    effects: [{ type: 'on', event: 'dodge', chance: 1, action: { cloud: { r: 36, dur: 3 } }, text: '공격을 피하면 그 자리에 독 구름' }, { type: 'on', event: 'dash', chance: 0.5, action: { cloud: { r: 28, dur: 2 } }, text: '대시하면 50% 독 구름' }],
    recipe: { venom: 5, spore: 3 },
  },
  giantGrip: {
    name: '거인의 손아귀', slot: 'arm', grade: 3, load: 5, tags: ['giant', 'brawl'],
    stats: { str: 6, vit: 3 },
    effects: [{ type: 'mul', key: 'physAtk', v: 1.12, text: '물리 공격력 +12%' }, { type: 'add', key: 'knockback', v: 60, text: '밀쳐내기 +60' }],
    recipe: { magma: 4, rust: 4 },
  },
  shadowStrike: {
    name: '그림자 일격', slot: 'arm', grade: 3, load: 5, tags: ['shadow'],
    stats: { sen: 5 },
    effects: [{ type: 'add', key: 'crit', v: 0.08, text: '치명타 확률 +8%' }, { type: 'on', event: 'crit', chance: 0.5, action: { aoe: { r: 28, mul: 0.6, type: 'phys' } }, text: '치명타면 50% 확률로 둘레 28에 그림자 베기 (60%)' }],
    recipe: { soul: 4, wing: 4 },
  },
  bloodRitual: {
    name: '피의 의식', slot: 'heart', grade: 4, load: 7, tags: ['bleed', 'drain'],
    stats: { str: 6, lifesteal: 4 },
    effects: [{ type: 'on', event: 'crit', chance: 1, action: { status: 'bleed', stacks: 2, heal: 0.015 }, text: '치명타면 출혈 2중첩 · 체력 1.5% 회복' }, { type: 'mul', key: 'bleedMul', v: 1.3, text: '출혈 피해 +30%' }],
    recipe: { blood: 8, chief: 1 },
  },
  slimeRebirth: {
    name: '점액의 부활', slot: 'heart', grade: 4, load: 7, tags: ['slime', 'undying'],
    stats: { vit: 8, pres: 4 },
    effects: [{ type: 'flag', flag: 'undying', text: '쓰러지면 한 번 체력 30%로 되살아난다' }, { type: 'add', key: 'regen', v: 0.002, text: '초당 체력 0.2% 회복' }],
    recipe: { goo: 10, queen: 1 },
  },
  stormHeart: {
    name: '폭풍의 심장', slot: 'heart', grade: 5, load: 10, tags: ['wind', 'fire'],
    stats: { agi: 8, mag: 6 },
    effects: [{ type: 'mul', key: 'atkSpeed', v: 1.18, text: '공격 속도 +18%' }, { type: 'on', event: 'dash', chance: 1, action: { aoe: { r: 60, mul: 1.2, type: 'mag', status: 'burn' } }, text: '대시하면 둘레 60에 불꽃 폭풍 (마법 공격력 120%)' }],
    recipe: { cinder: 8, wing: 8, core: 1 },
  },
  glacierCore: {
    name: '빙하의 심장', slot: 'heart', grade: 5, load: 10, tags: ['ice', 'giant'],
    stats: { vit: 10, mres: 8, iceAff: 6 },
    effects: [{ type: 'mul', key: 'dmgTakenMul', v: 0.85, text: '받는 피해 -15%' }, { type: 'flag', flag: 'frozenVuln', text: '얼어붙은 적에게 주는 피해 +50%' }, { type: 'on', event: 'hurt', chance: 1, action: { status: 'chill', stacks: 2 }, text: '나를 때린 적에게 냉기 2중첩' }],
    recipe: { icecore: 6, witch: 1 },
  },
  plagueKing: {
    name: '역병의 군주', slot: 'head', grade: 5, load: 10, tags: ['poison', 'curse'],
    stats: { toxicity: 10, mag: 6 },
    effects: [{ type: 'flag', flag: 'poisonSpread', text: '중독된 적이 죽으면 주변으로 독이 번진다' }, { type: 'flag', flag: 'poisonBurst', text: '중독된 적이 죽으면 독 구름' }, { type: 'on', event: 'hit', chance: 0.3, action: { status: 'poison', stacks: 2 }, text: '공격 시 30% 중독 2중첩' }],
    recipe: { venom: 8, spore: 6, grave: 1 },
  },
};

// 태그 시너지: 장착한 각인 + 장비의 태그 개수
export const TAGS = {
  fire: { name: '화염', color: '#ff7a2a', tiers: [
    { n: 2, text: '화상 걸린 적이 죽으면 주변으로 불이 번짐, 화상 피해 +15%', effects: [{ type: 'flag', flag: 'burnSpread' }, { type: 'mul', key: 'burnMul', v: 1.15 }] },
    { n: 4, text: '화상 피해 +40%, 화상이 닿은 적 주변으로도 옮겨붙음', effects: [{ type: 'mul', key: 'burnMul', v: 1.4 }, { type: 'flag', flag: 'burnCatch' }] },
  ] },
  ice: { name: '냉기', color: '#9fe3ff', tiers: [
    { n: 2, text: '둔화 효과 증가, 빙결 시간 +30%', effects: [{ type: 'mul', key: 'chillMul', v: 1.5 }, { type: 'mul', key: 'freezeTime', v: 1.3 }] },
    { n: 4, text: '빙결된 적이 받는 피해 +50%, 빙결에 필요한 냉기 -1', effects: [{ type: 'flag', flag: 'frozenVuln' }, { type: 'add', key: 'freezeReduce', v: 1 }] },
  ] },
  poison: { name: '독', color: '#9be15d', tiers: [
    { n: 2, text: '독 최대 중첩 +5', effects: [{ type: 'add', key: 'poisonCap', v: 5 }] },
    { n: 4, text: '맹독: 독이 5중첩을 넘으면 중첩마다 독 피해 +8% (한 대상에 집중)', effects: [{ type: 'flag', flag: 'poisonDeep' }] },
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
    { n: 3, text: '쏘는 동안 느려지지 않음, 대시 쿨타임 -40%', effects: [{ type: 'flag', flag: 'noAimSlow' }, { type: 'mul', key: 'dashCd', v: 0.6 }] },
  ] },
  giant: { name: '거체', color: '#b08a5a', tiers: [
    { n: 2, text: '최대 HP +15%', effects: [{ type: 'mul', key: 'maxHp', v: 1.15 }] },
    { n: 3, text: '받는 피해 -12%', effects: [{ type: 'mul', key: 'dmgTakenMul', v: 0.88 }] },
  ] },
  reflect: { name: '반사', color: '#e6f3ff', tiers: [
    { n: 2, text: '반사 +8%', effects: [{ type: 'stat', stat: 'reflect', v: 8 }] },
    { n: 3, text: '반사 피해의 절반이 주변 적에게도', effects: [{ type: 'flag', flag: 'reflectAoe' }] },
  ] },
  slime: { name: '점액', color: '#7ed957', tiers: [
    { n: 2, text: '물리·마법 저항 +6, 나를 때린 적 둔화', effects: [{ type: 'stat', stat: 'pres', v: 6 }, { type: 'stat', stat: 'mres', v: 6 }, { type: 'flag', flag: 'slimeSlow' }] },
  ] },
  shadow: { name: '그림자', color: '#8a6aff', tiers: [
    { n: 2, text: '치명타 +12%, 대시 쿨타임 -25%, 대시 후 첫 공격 확정 치명타', effects: [{ type: 'add', key: 'crit', v: 0.12 }, { type: 'mul', key: 'dashCd', v: 0.75 }, { type: 'flag', flag: 'dashCrit' }] },
    { n: 3, text: '회피 +8%', effects: [{ type: 'add', key: 'dodge', v: 0.08 }] },
  ] },
  curse: { name: '저주', color: '#b7a4ff', tiers: [
    { n: 2, text: '상태이상 피해 +25%', effects: [{ type: 'mul', key: 'statusDmgMul', v: 1.25 }] },
  ] },
  undying: { name: '불사', color: '#e8e2cf', tiers: [
    { n: 2, text: '사냥마다 1번, 죽으면 HP 30%로 부활', effects: [{ type: 'flag', flag: 'undying' }] },
  ] },
  brawl: { name: '투사', color: '#ffb347', tiers: [
    { n: 2, text: '근력 +10%, 넉백 강화', effects: [{ type: 'statPct', stat: 'str', v: 0.1 }, { type: 'add', key: 'knockback', v: 30 }] },
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
  overload: { name: '과부하', recipe: '화상 + 감전', desc: '두 상태를 소모해 주변에 번개 폭발' },
  superconduct: { name: '순간 빙결', recipe: '냉기 + 감전', desc: '두 상태를 소모해 바로 얼리고 피해' },
};

// 몬스터와 문양 잔향. 원하는 각인을 만들려면 그 잔향을 남기는 몬스터를 골라 사냥해야 한다.

export const ECHOES = {
  goo: { name: '점액 잔향', color: '#7ed957' },
  wing: { name: '발톱 잔향', color: '#9a8cff' },
  rust: { name: '녹슨 잔향', color: '#c08a4a' },
  chief: { name: '족장의 잔향', color: '#ffb347', rare: true },
  venom: { name: '독액 잔향', color: '#9be15d' },
  blood: { name: '피 잔향', color: '#e0445a' },
  spore: { name: '포자 잔향', color: '#d9b36b' },
  queen: { name: '거인의 잔향', color: '#5dff9e', rare: true },
  ember: { name: '불씨 잔향', color: '#ff7a2a' },
  magma: { name: '마그마 잔향', color: '#ff4a1a' },
  cinder: { name: '재 잔향', color: '#ffb066' },
  core: { name: '균열핵 잔향', color: '#ffe14a', rare: true },
  frost: { name: '서리 잔향', color: '#9fe3ff' },
  mirror: { name: '거울 잔향', color: '#e6f3ff' },
  icecore: { name: '빙핵 잔향', color: '#5ac8ff' },
  meltcore: { name: '녹은 빙핵 잔향', color: '#ff9fdc', rare: true },
  witch: { name: '마녀의 잔향', color: '#b7a4ff', rare: true },
  bone: { name: '뼈 잔향', color: '#e8e2cf' },
  soul: { name: '혼 잔향', color: '#8ad8ff' },
  rot: { name: '부패 잔향', color: '#8a9a4a' },
  grave: { name: '묘지기의 잔향', color: '#c45cff', rare: true },
};

// ai: chase | erratic | ranged | charge | boss
export const MONSTERS = {
  slime: { name: '이끼 늪괴', shape: 'blob', pal: { a: '#5fbf4a', b: '#3a7d2c', c: '#a6ef8a', e: '#102010' }, hp: 34, atk: 6, type: 'phys', speed: 38, ai: 'chase', r: 6, xp: 4, gold: 2, pres: 0, mres: 10, echo: { id: 'goo', rate: 0.45 } },
  bat: { name: '동굴 워골', shape: 'flyer', pal: { a: '#6a5aa8', b: '#40356e', c: '#9a8cff', e: '#ff4040' }, hp: 20, atk: 5, type: 'phys', speed: 82, ai: 'erratic', r: 5, xp: 4, gold: 2, pres: 0, mres: 0, echo: { id: 'wing', rate: 0.45 } },
  goblin: { name: '고블린', shape: 'humanoid', pal: { s: '#6fa83a', h: '#3a2a1a', a: '#7a5a3a', b: '#4a3422', e: '#ffee00' }, hp: 44, atk: 8, type: 'phys', speed: 52, ai: 'chase', r: 6, xp: 6, gold: 4, pres: 10, mres: 0, echo: { id: 'rust', rate: 0.4 } },
  goblinChief: { name: '가면 족장', shape: 'humanoid', scale: 1.6, elite: true, pal: { s: '#5a9a2a', h: '#c0302a', a: '#8a6a2a', b: '#5a4218', e: '#ff3300' }, hp: 320, atk: 15, type: 'phys', speed: 46, ai: 'charge', r: 9, xp: 40, gold: 30, pres: 20, mres: 5, echo: { id: 'chief', rate: 1 } },

  toad: { name: '진흙 괴물', shape: 'blob', pal: { a: '#6a8a2a', b: '#3e5a14', c: '#b8d86a', e: '#ffdd00' }, hp: 70, atk: 9, type: 'mag', speed: 30, ai: 'ranged', range: 120, proj: { speed: 120, color: '#9be15d', status: 'poison' }, r: 7, xp: 9, gold: 5, pres: 10, mres: 15, echo: { id: 'venom', rate: 0.4 } },
  leech: { name: '거대 거머리', shape: 'blob', pal: { a: '#7a2a3a', b: '#4a1420', c: '#c45a6a', e: '#ffcccc' }, hp: 60, atk: 10, type: 'phys', speed: 60, ai: 'chase', status: 'bleed', r: 6, xp: 9, gold: 5, pres: 5, mres: 5, echo: { id: 'blood', rate: 0.4 } },
  shroom: { name: '포자 시체', shape: 'humanoid', pal: { s: '#e8d8b0', h: '#c0402a', a: '#d9b36b', b: '#9a7a3a', e: '#2a1a0a' }, hp: 80, atk: 9, type: 'phys', speed: 34, ai: 'chase', onDeath: { cloud: { r: 34, dps: 8, dur: 3 } }, r: 7, xp: 10, gold: 6, pres: 15, mres: 10, echo: { id: 'spore', rate: 0.4 } },
  swampQueen: { name: '늪의 거인', shape: 'blob', scale: 2, elite: true, pal: { a: '#2a9a5a', b: '#14603a', c: '#7dffb0', e: '#ff00aa' }, hp: 900, atk: 16, type: 'mag', speed: 28, ai: 'boss', range: 140, proj: { speed: 110, color: '#5dff9e', status: 'poison', spread: 5 }, r: 12, xp: 120, gold: 80, pres: 25, mres: 30, echo: { id: 'queen', rate: 1 } },

  salamander: { name: '화염 악귀', shape: 'quad', pal: { a: '#d8501a', b: '#8a2a0a', c: '#ffa04a', e: '#ffee44' }, hp: 120, atk: 14, type: 'mag', speed: 50, ai: 'ranged', range: 110, proj: { speed: 150, color: '#ff7a2a', status: 'burn' }, r: 7, xp: 16, gold: 9, pres: 20, mres: 40, echo: { id: 'ember', rate: 0.4 } },
  magmaGolem: { name: '용암 오우거', shape: 'golem', scale: 1.3, pal: { a: '#5a3a30', b: '#2a1a14', c: '#ff5a1a', e: '#ffcc00' }, hp: 320, atk: 22, type: 'phys', speed: 26, ai: 'chase', status: 'burn', r: 9, xp: 24, gold: 14, pres: 90, mres: 20, echo: { id: 'magma', rate: 0.4 } },
  imp: { name: '화염 임프', shape: 'flyer', pal: { a: '#c0302a', b: '#7a1a14', c: '#ff8a4a', e: '#ffff66' }, hp: 80, atk: 12, type: 'mag', speed: 95, ai: 'erratic', status: 'burn', r: 5, xp: 14, gold: 8, pres: 10, mres: 30, echo: { id: 'cinder', rate: 0.4 } },
  riftGuard: { name: '균열 수호자', shape: 'golem', scale: 2, elite: true, pal: { a: '#3a2a3a', b: '#1a101a', c: '#ffe14a', e: '#ff3300' }, hp: 2200, atk: 28, type: 'mag', speed: 30, ai: 'boss', range: 150, proj: { speed: 140, color: '#ffe14a', status: 'burn', spread: 7 }, r: 14, xp: 260, gold: 160, pres: 80, mres: 60, echo: { id: 'core', rate: 1 } },

  frostWolf: { name: '서리 망자', shape: 'quad', pal: { a: '#c8dcec', b: '#7a90a8', c: '#ffffff', e: '#3ab0ff' }, hp: 170, atk: 18, type: 'phys', speed: 92, ai: 'chase', status: 'chill', r: 7, xp: 22, gold: 12, pres: 30, mres: 30, echo: { id: 'frost', rate: 0.4 } },
  glassSpider: { name: '거울 정령', shape: 'quad', pal: { a: '#cfe8ff', b: '#7aa0c8', c: '#ffffff', e: '#ff3a8a' }, hp: 160, atk: 16, type: 'phys', speed: 60, ai: 'chase', reflect: 0.3, r: 7, xp: 24, gold: 14, pres: 40, mres: 60, echo: { id: 'mirror', rate: 0.4 } },
  iceGolem: { name: '얼음 오우거', shape: 'golem', scale: 1.3, pal: { a: '#7ac8f0', b: '#3a7aa8', c: '#e0f6ff', e: '#1a3a8a' }, hp: 450, atk: 26, type: 'phys', speed: 24, ai: 'chase', status: 'chill', r: 9, xp: 34, gold: 18, pres: 60, mres: 110, echo: { id: 'icecore', rate: 0.4 }, condEcho: { id: 'meltcore', rate: 0.6, when: 'burning', hint: '불타는 상태로 처치' } },
  frostWitch: { name: '서리 마녀', shape: 'humanoid', scale: 1.7, elite: true, pal: { s: '#dfe8ff', h: '#f0f8ff', a: '#4a6ad0', b: '#2a3a8a', e: '#00e0ff' }, hp: 3000, atk: 30, type: 'mag', speed: 40, ai: 'boss', range: 160, proj: { speed: 150, color: '#9fe3ff', status: 'chill', spread: 9 }, r: 11, xp: 400, gold: 240, pres: 60, mres: 90, echo: { id: 'witch', rate: 1 } },

  skeleton: { name: '해골 병사', shape: 'humanoid', pal: { s: '#e8e2cf', h: '#e8e2cf', a: '#a8a28f', b: '#6a665a', e: '#ff3a3a' }, hp: 300, atk: 26, type: 'phys', speed: 50, ai: 'chase', r: 6, xp: 34, gold: 18, pres: 140, mres: 10, echo: { id: 'bone', rate: 0.4 } },
  wraith: { name: '망령술사', shape: 'flyer', ghost: true, pal: { a: '#8ad8ff', b: '#4a8ab8', c: '#e0f6ff', e: '#ffffff' }, hp: 260, atk: 24, type: 'mag', speed: 70, ai: 'erratic', r: 6, xp: 36, gold: 20, pres: 260, mres: 20, echo: { id: 'soul', rate: 0.4 } },
  ghoul: { name: '구울', shape: 'humanoid', pal: { s: '#8a9a6a', h: '#3a3a2a', a: '#5a5a3a', b: '#3a3a24', e: '#ffee00' }, hp: 380, atk: 30, type: 'phys', speed: 66, ai: 'chase', status: 'poison', r: 7, xp: 38, gold: 22, pres: 50, mres: 50, echo: { id: 'rot', rate: 0.4 } },
  graveKeeper: { name: '묘지기', shape: 'golem', scale: 2.2, elite: true, pal: { a: '#3a2a4a', b: '#1a1024', c: '#c45cff', e: '#00ff9a' }, hp: 5200, atk: 38, type: 'mag', speed: 34, ai: 'boss', range: 170, proj: { speed: 150, color: '#c45cff', status: 'bleed', spread: 11 }, r: 15, xp: 700, gold: 400, pres: 100, mres: 100, echo: { id: 'grave', rate: 1 } },
};

// liquid: 밟을 수 있는 지형 효과 (water 감속, lava 화상, snow 감속, mist 없음)
export const ZONES = [
  { id: 'cave', name: '이끼 동굴', floor: 1, rec: 1, pal: ['#2c3b2b', '#33452f', '#283626'], wall: ['#151d14', '#2a3826', '#3d5236'], liquid: 'water', liquidPal: ['#1d4a5a', '#2a6a7a'], dark: 0.62, deco: ['moss', 'moss', 'glowshroom', 'pebble', 'fern'], portal: '#7ed957', pool: ['slime', 'bat', 'goblin'], elite: 'goblinChief' },
  { id: 'swamp', name: '독늪', floor: 2, rec: 5, pal: ['#2c3524', '#35402a', '#283020'], wall: ['#121a0e', '#26331c', '#3a4a28'], liquid: 'water', liquidPal: ['#2a4a2a', '#3e6a34'], dark: 0.45, deco: ['reed', 'reed', 'lily', 'glowshroom', 'pebble'], portal: '#9be15d', pool: ['toad', 'leech', 'shroom'], elite: 'swampQueen' },
  { id: 'rift', name: '화산 균열', floor: 3, rec: 10, pal: ['#3a2622', '#452c26', '#30201c'], wall: ['#170c0a', '#3a1f18', '#5a2e22'], liquid: 'lava', liquidPal: ['#c8401a', '#ff8a2a'], dark: 0.5, deco: ['ember', 'pebble', 'bone', 'crystalR'], portal: '#ff7a2a', pool: ['salamander', 'magmaGolem', 'imp'], elite: 'riftGuard' },
  { id: 'frost', name: '서리 회랑', floor: 4, rec: 15, pal: ['#3a4656', '#435264', '#36404e'], wall: ['#141c26', '#3a4e66', '#6a88a8'], liquid: 'snow', liquidPal: ['#c8dcec', '#e8f4ff'], dark: 0.35, deco: ['crystalB', 'crystalB', 'pebble', 'icicle'], portal: '#9fe3ff', pool: ['frostWolf', 'glassSpider', 'iceGolem'], elite: 'frostWitch' },
  { id: 'grave', name: '그림자 묘지', floor: 5, rec: 20, pal: ['#2a2434', '#322a3e', '#241f2e'], wall: ['#0e0a14', '#2a2238', '#40345a'], liquid: 'mist', liquidPal: ['#3a3450', '#4a4466'], dark: 0.7, deco: ['tomb', 'candle', 'bone', 'bone', 'pebble'], portal: '#c45cff', pool: ['skeleton', 'wraith', 'ghoul'], elite: 'graveKeeper' },
];

// 광장 수련장 허수아비 (빌드 테스트용)
export const DUMMIES = {
  dummy: { name: '나무 허수아비', shape: 'dummy', pal: { a: '#b08a5a', b: '#6a4a2a', c: '#e0c080', e: '#2a1a0a' }, hp: 1e9, atk: 0, type: 'phys', speed: 0, ai: 'dummy', r: 7, xp: 0, gold: 0, pres: 0, mres: 0, echo: { id: 'goo', rate: 0 } },
  dummyP: { name: '강철 허수아비', shape: 'dummy', pal: { a: '#8a94a8', b: '#4a5266', c: '#d0d8e8', e: '#1a1a2a' }, hp: 1e9, atk: 0, type: 'phys', speed: 0, ai: 'dummy', r: 7, xp: 0, gold: 0, pres: 100, mres: 0, echo: { id: 'goo', rate: 0 } },
  dummyM: { name: '룬석 허수아비', shape: 'dummy', pal: { a: '#6a5aa8', b: '#3a2e6a', c: '#b8a8ff', e: '#00e0ff' }, hp: 1e9, atk: 0, type: 'mag', speed: 0, ai: 'dummy', r: 7, xp: 0, gold: 0, pres: 0, mres: 100, echo: { id: 'goo', rate: 0 } },
};

// 고대 석판 (탐험 보상: 숨은 조합 힌트)
export const LORES = [
  '…얼음 오우거의 심장을 불꽃으로 녹인 자만이, 녹아내린 핵을 얻으리라.',
  '…마력이 완력을 넘어서는 순간, 학자의 반지는 칼끝을 마법으로 바꾼다.',
  '…불과 서리가 한 몸에서 넷씩 만나면, 둘 다 꺼진다. 욕심을 경계하라.',
  '…피를 흘리는 자를 얼리면, 피는 칼날이 되어 터진다.',
  '…독에 잠긴 자에게 불을 놓으면, 숨 막히는 연기가 피어오른다.',
  '…두 저항이 균형을 이루면, 거울은 두 배로 빛난다.',
  '…한 길만 판 자는 문을 연다. 서른, 쉰, 일흔, 아흔.',
  '…가장 높은 힘이 그다음 힘의 두 배라면, 그것을 극한이라 부른다.',
  '…망령술사는 칼을 비웃는다. 마법이나 독으로 다스려라.',
  '…해골은 마법에 약하고, 오우거는 지속되는 고통에 약하다.',
  '…모든 힘이 스물을 넘는 자에게 현자의 돌이 응답한다.',
  '…각인은 몸이 버틸 수 있을 만큼만. 정신이 그 그릇을 넓힌다.',
  '…죽지 않는 자 둘이 모이면, 한 번은 죽음을 거절한다.',
  '…중독과 출혈이 겹친 피는 썩어, 독이 두 배로 퍼진다.',
];

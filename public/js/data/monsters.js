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

// ai: chase | erratic | ranged | charge | boss | kamikaze(다가와 자폭) | summoner(부하 소환) | burrow(땅속 잠복) | flee(도망)
// shield: 정면 공격 피해 감소
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
  // ── 추가 몬스터 (층마다 3종) ──
  mossSlug: { name: '이끼 민달팽이', shape: 'blob', pal: { a: '#7ed957' }, hp: 26, atk: 14, type: 'phys', speed: 58, ai: 'kamikaze', boom: { r: 34, color: '#7ed957' }, r: 5, xp: 5, gold: 3, pres: 0, mres: 0, echo: { id: 'goo', rate: 0.4 } },
  goblinShaman: { name: '고블린 주술사', shape: 'humanoid', pal: { a: '#6fa83a' }, hp: 50, atk: 7, type: 'mag', speed: 40, ai: 'summoner', summon: 'goblin', range: 120, proj: { speed: 120, color: '#c8e04a' }, r: 6, xp: 9, gold: 6, pres: 5, mres: 15, echo: { id: 'rust', rate: 0.45 } },
  caveLurker: { name: '동굴 잠복자', shape: 'quad', pal: { a: '#5a4a7a' }, hp: 46, atk: 11, type: 'phys', speed: 70, ai: 'burrow', r: 6, xp: 7, gold: 4, pres: 10, mres: 5, echo: { id: 'wing', rate: 0.45 } },

  gasBloat: { name: '가스 부풀이', shape: 'blob', pal: { a: '#d8d04a' }, hp: 60, atk: 16, type: 'mag', speed: 48, ai: 'kamikaze', boom: { r: 40, color: '#c8e04a', cloud: true }, r: 7, xp: 10, gold: 5, pres: 0, mres: 10, echo: { id: 'spore', rate: 0.4 } },
  bogWitch: { name: '늪 마녀', shape: 'humanoid', pal: { a: '#3a7a3a' }, hp: 90, atk: 10, type: 'mag', speed: 36, ai: 'summoner', summon: 'leech', range: 130, proj: { speed: 120, color: '#9be15d', status: 'poison' }, r: 6, xp: 14, gold: 8, pres: 10, mres: 25, echo: { id: 'venom', rate: 0.45 } },
  mudLurker: { name: '진흙 잠복자', shape: 'blob', pal: { a: '#7a5a3a' }, hp: 85, atk: 14, type: 'phys', speed: 62, ai: 'burrow', status: 'bleed', r: 7, xp: 12, gold: 7, pres: 15, mres: 10, echo: { id: 'blood', rate: 0.45 } },

  pumpkinFiend: { name: '불꽃 호박귀', shape: 'humanoid', pal: { a: '#ff8a2a' }, hp: 95, atk: 30, type: 'mag', speed: 70, ai: 'kamikaze', boom: { r: 44, color: '#ff7a2a', status: 'burn' }, r: 6, xp: 16, gold: 9, pres: 10, mres: 20, echo: { id: 'cinder', rate: 0.4 } },
  chortShaman: { name: '악귀 술사', shape: 'humanoid', pal: { a: '#c0302a' }, hp: 150, atk: 13, type: 'mag', speed: 40, ai: 'summoner', summon: 'imp', range: 130, proj: { speed: 140, color: '#ff7a2a', status: 'burn' }, r: 6, xp: 22, gold: 12, pres: 15, mres: 40, echo: { id: 'ember', rate: 0.45 } },
  shieldDemon: { name: '방패 악귀', shape: 'humanoid', pal: { a: '#8a2a2a' }, hp: 260, atk: 20, type: 'phys', speed: 40, ai: 'chase', shield: 0.6, r: 7, xp: 24, gold: 14, pres: 50, mres: 20, echo: { id: 'magma', rate: 0.45 } },

  frostSlug: { name: '얼음 민달팽이', shape: 'blob', pal: { a: '#9fe3ff' }, hp: 120, atk: 30, type: 'mag', speed: 64, ai: 'kamikaze', boom: { r: 42, color: '#9fe3ff', status: 'chill' }, r: 6, xp: 20, gold: 11, pres: 20, mres: 30, echo: { id: 'frost', rate: 0.4 } },
  iceShaman: { name: '서리 주술사', shape: 'humanoid', pal: { a: '#4a8ad0' }, hp: 200, atk: 16, type: 'mag', speed: 40, ai: 'summoner', summon: 'frostWolf', range: 140, proj: { speed: 150, color: '#9fe3ff', status: 'chill' }, r: 6, xp: 30, gold: 16, pres: 20, mres: 60, echo: { id: 'icecore', rate: 0.45 } },
  snowLurker: { name: '설원 잠복자', shape: 'blob', pal: { a: '#e8f4ff' }, hp: 190, atk: 22, type: 'phys', speed: 66, ai: 'burrow', status: 'chill', r: 7, xp: 26, gold: 14, pres: 30, mres: 40, echo: { id: 'mirror', rate: 0.45 } },

  tinyCorpse: { name: '꼬마 시체', shape: 'humanoid', pal: { a: '#8a9a6a' }, hp: 160, atk: 36, type: 'phys', speed: 74, ai: 'kamikaze', boom: { r: 42, color: '#8a9a4a', cloud: true }, r: 5, xp: 28, gold: 15, pres: 40, mres: 20, echo: { id: 'rot', rate: 0.4 } },
  necroAcolyte: { name: '사령 수련생', shape: 'humanoid', pal: { a: '#5b3a7a' }, hp: 240, atk: 20, type: 'mag', speed: 40, ai: 'summoner', summon: 'skeleton', range: 140, proj: { speed: 150, color: '#c45cff' }, r: 6, xp: 40, gold: 22, pres: 30, mres: 70, echo: { id: 'soul', rate: 0.45 } },
  boneGuard: { name: '뼈 방패병', shape: 'humanoid', pal: { a: '#e8e2cf' }, hp: 420, atk: 28, type: 'phys', speed: 44, ai: 'chase', shield: 0.6, r: 7, xp: 42, gold: 24, pres: 160, mres: 20, echo: { id: 'bone', rate: 0.45 } },

  treasureGoblin: { name: '보물 고블린', shape: 'humanoid', pal: { a: '#ffcf3a' }, hp: 120, atk: 0, type: 'phys', speed: 92, ai: 'flee', r: 6, xp: 30, gold: 120, pres: 20, mres: 20, echo: { id: 'rust', rate: 1 }, treasure: true },

  // ── 바깥 세계 몬스터 (지역마다) ──
  sandScorpion: { name: '모래 전갈', shape: 'quad', pal: { a: '#d8a050' }, hp: 150, atk: 15, type: 'phys', speed: 58, ai: 'chase', status: 'poison', r: 6, xp: 18, gold: 9, pres: 40, mres: 10, echo: { id: 'venom', rate: 0.4 } },
  hyena: { name: '하이에나', shape: 'quad', pal: { a: '#c8a070' }, hp: 110, atk: 13, type: 'phys', speed: 96, ai: 'chase', status: 'bleed', r: 6, xp: 16, gold: 8, pres: 10, mres: 10, echo: { id: 'blood', rate: 0.4 } },
  orcRaider: { name: '오크 약탈자', shape: 'humanoid', pal: { a: '#8a6a3a' }, hp: 220, atk: 19, type: 'phys', speed: 52, ai: 'charge', r: 7, xp: 24, gold: 14, pres: 35, mres: 10, echo: { id: 'rust', rate: 0.45 } },
  raptor: { name: '랩터', shape: 'quad', pal: { a: '#5aa040' }, hp: 160, atk: 17, type: 'phys', speed: 104, ai: 'chase', status: 'bleed', r: 6, xp: 22, gold: 11, pres: 15, mres: 10, echo: { id: 'blood', rate: 0.45 } },
  jungleWasp: { name: '독침 말벌', shape: 'flyer', pal: { a: '#e8c83a' }, hp: 90, atk: 13, type: 'phys', speed: 100, ai: 'erratic', status: 'poison', r: 5, xp: 16, gold: 8, pres: 0, mres: 10, echo: { id: 'venom', rate: 0.4 } },
  bigBeetle: { name: '거대 딱정벌레', shape: 'golem', scale: 1.2, pal: { a: '#3a6a5a' }, hp: 340, atk: 21, type: 'phys', speed: 30, ai: 'chase', shield: 0.5, r: 8, xp: 28, gold: 15, pres: 80, mres: 20, echo: { id: 'spore', rate: 0.45 } },
  royalGuard: { name: '왕국 병사', shape: 'humanoid', pal: { a: '#c8b060' }, hp: 170, atk: 17, type: 'phys', speed: 70, ai: 'chase', r: 6, xp: 22, gold: 16, pres: 35, mres: 15, echo: { id: 'blood', rate: 0.3 } },
  bandit: { name: '도적', shape: 'humanoid', pal: { a: '#5a5a6a' }, hp: 150, atk: 17, type: 'phys', speed: 74, ai: 'chase', status: 'bleed', r: 6, xp: 20, gold: 18, pres: 20, mres: 15, echo: { id: 'blood', rate: 0.4 } },
  coralCrab: { name: '산호 게', shape: 'quad', pal: { a: '#ff7a5a' }, hp: 260, atk: 22, type: 'phys', speed: 44, ai: 'chase', shield: 0.5, r: 7, xp: 30, gold: 16, pres: 70, mres: 30, echo: { id: 'mirror', rate: 0.4 } },
  jellyfish: { name: '해파리', shape: 'flyer', ghost: true, pal: { a: '#ff9ad8' }, hp: 160, atk: 20, type: 'mag', speed: 50, ai: 'erratic', status: 'chill', r: 6, xp: 26, gold: 14, pres: 30, mres: 60, echo: { id: 'frost', rate: 0.4 } },
  seaSerpent: { name: '바다뱀', shape: 'blob', pal: { a: '#3ab8b0' }, hp: 240, atk: 24, type: 'mag', speed: 60, ai: 'ranged', range: 130, proj: { speed: 140, color: '#7ae8ff', status: 'chill' }, r: 7, xp: 30, gold: 16, pres: 20, mres: 50, echo: { id: 'icecore', rate: 0.4 } },
  // 우두머리 (안쪽 깊은 곳 · 성물을 지닌다)
  dragonGuard: { name: '용궁 수문장', shape: 'golem', scale: 2, elite: true, pal: { a: '#2a8a9a', b: '#14505a', c: '#9af0ff', e: '#ffe14a' }, hp: 2600, atk: 30, type: 'mag', speed: 32, ai: 'boss', range: 160, proj: { speed: 150, color: '#7ae8ff', status: 'chill', spread: 7 }, r: 14, xp: 320, gold: 220, pres: 60, mres: 80, echo: { id: 'meltcore', rate: 1 } },
  labyrinthLord: { name: '미궁의 군주', shape: 'golem', scale: 1.9, elite: true, pal: { a: '#6a2a2a', b: '#3a1414', c: '#ff8a4a', e: '#ffcc00' }, hp: 1800, atk: 30, type: 'phys', speed: 50, ai: 'charge', r: 13, xp: 240, gold: 180, pres: 70, mres: 30, echo: { id: 'chief', rate: 1 } },
  orcWarlord: { name: '오크 족장', shape: 'humanoid', scale: 1.7, elite: true, pal: { a: '#6a8a3a', b: '#3a5a1a', c: '#c8a050', e: '#ff3300' }, hp: 1200, atk: 26, type: 'phys', speed: 50, ai: 'charge', r: 10, xp: 160, gold: 120, pres: 50, mres: 15, echo: { id: 'chief', rate: 1 } },
  raptorAlpha: { name: '우두머리 랩터', shape: 'quad', scale: 1.7, elite: true, pal: { a: '#3a8a2a', b: '#1a5a14', c: '#c8f07a', e: '#ffee00' }, hp: 1300, atk: 27, type: 'phys', speed: 90, ai: 'charge', status: 'bleed', r: 10, xp: 170, gold: 120, pres: 30, mres: 20, echo: { id: 'queen', rate: 1 } },
  fallenKnight: { name: '타락한 기사', shape: 'humanoid', scale: 1.7, elite: true, pal: { a: '#4a4a5a', b: '#2a2a3a', c: '#c45cff', e: '#ff3a3a' }, hp: 1500, atk: 27, type: 'phys', speed: 44, ai: 'charge', shield: 0.4, r: 10, xp: 180, gold: 130, pres: 90, mres: 40, echo: { id: 'grave', rate: 1 } },

  graveKeeper: { name: '묘지기', shape: 'golem', scale: 2.2, elite: true, pal: { a: '#3a2a4a', b: '#1a1024', c: '#c45cff', e: '#00ff9a' }, hp: 5200, atk: 38, type: 'mag', speed: 34, ai: 'boss', range: 170, proj: { speed: 150, color: '#c45cff', status: 'bleed', spread: 11 }, r: 15, xp: 700, gold: 400, pres: 100, mres: 100, echo: { id: 'grave', rate: 1 } },
};

// ── 새 몬스터 2: 직접 그린 그림 (render/beasts.js) ──
Object.assign(MONSTERS, {
  poisonSpider: { name: '독거미', shape: 'quad', pal: { a: '#8a40b8' }, hp: 110, atk: 12, type: 'phys', speed: 82, ai: 'chase', status: 'poison', moves: ['leap', 'combo'], r: 6, xp: 18, gold: 9, pres: 10, mres: 10, echo: {'id': 'venom', 'rate': 0.4} },
  chargeBoar: { name: '돌진 멧돼지', shape: 'quad', pal: { a: '#8a5a34' }, hp: 90, atk: 11, type: 'phys', speed: 60, ai: 'chase', moves: ['charge'], r: 7, xp: 10, gold: 5, pres: 12, mres: 0, echo: {'id': 'goo', 'rate': 0.4} },
  iceWolf: { name: '얼음 늑대', shape: 'quad', pal: { a: '#6a9ac8' }, hp: 180, atk: 18, type: 'phys', speed: 100, ai: 'chase', status: 'chill', moves: ['combo', 'leap'], r: 6, xp: 30, gold: 16, pres: 20, mres: 30, echo: {'id': 'frost', 'rate': 0.4} },
  fireBat: { name: '화염 박쥐', shape: 'flyer', pal: { a: '#ff7a2a' }, hp: 90, atk: 16, type: 'mag', speed: 112, ai: 'erratic', status: 'burn', proj: { speed: 170, color: '#ff7a2a', status: 'burn' }, moves: ['leap', 'fan'], r: 5, xp: 22, gold: 12, pres: 0, mres: 40, echo: {'id': 'cinder', 'rate': 0.4} },
  toxShroom: { name: '독버섯', shape: 'quad', pal: { a: '#9a3ab0' }, hp: 140, atk: 10, type: 'mag', speed: 30, ai: 'chase', status: 'poison', moves: ['pool'], r: 7, xp: 16, gold: 8, pres: 10, mres: 20, echo: {'id': 'spore', 'rate': 0.4} },
  rockGolem: { name: '바위 골렘', shape: 'golem', pal: { a: '#7a7680' }, hp: 420, atk: 24, type: 'phys', speed: 32, ai: 'chase', moves: ['quake', 'combo'], r: 9, xp: 46, gold: 24, pres: 120, mres: 30, echo: {'id': 'rust', 'rate': 0.4} },
  desertScorpion: { name: '사막 전갈', shape: 'quad', pal: { a: '#c8944e' }, hp: 170, atk: 16, type: 'phys', speed: 70, ai: 'chase', status: 'poison', proj: { speed: 160, color: '#c8e040', status: 'poison' }, moves: ['combo', 'spiral'], r: 7, xp: 28, gold: 15, pres: 40, mres: 10, echo: {'id': 'venom', 'rate': 0.4} },
  shadeWraith: { name: '망령', shape: 'flyer', ghost: true, pal: { a: '#9a6ae0' }, hp: 200, atk: 20, type: 'mag', speed: 80, ai: 'erratic', moves: ['blink', 'combo'], blinkInv: 1, r: 6, xp: 34, gold: 18, pres: 200, mres: 20, echo: {'id': 'soul', 'rate': 0.4} },
  spikeSlime: { name: '가시 슬라임', shape: 'blob', pal: { a: '#8a3ad0' }, hp: 100, atk: 9, type: 'phys', speed: 55, ai: 'chase', reflect: 0.3, proj: { speed: 150, color: '#d8b8ff', spread: 5 }, moves: ['leap', 'fan'], r: 7, xp: 12, gold: 6, pres: 10, mres: 10, echo: {'id': 'goo', 'rate': 0.45} },
  lizardWarrior: { name: '도마뱀 전사', shape: 'humanoid', pal: { a: '#5aa040' }, hp: 200, atk: 20, type: 'phys', speed: 80, ai: 'chase', moves: ['combo', 'retreat', 'leap'], r: 6, xp: 32, gold: 17, pres: 30, mres: 15, echo: {'id': 'blood', 'rate': 0.45} },
  darkArcher: { name: '어둠 궁수', shape: 'humanoid', pal: { a: '#3a2a4a' }, hp: 130, atk: 17, type: 'phys', speed: 75, ai: 'ranged', proj: { speed: 210, color: '#8a6aaa' }, moves: ['retreat', 'fan'], r: 6, xp: 26, gold: 14, pres: 10, mres: 20, echo: {'id': 'rust', 'rate': 0.4} },
  ironBeetle: { name: '철갑 딱정벌레', shape: 'quad', pal: { a: '#5a7088' }, hp: 260, atk: 18, type: 'phys', speed: 50, ai: 'chase', moves: ['leap'], frontGuard: true, r: 8, xp: 34, gold: 18, pres: 80, mres: 20, echo: {'id': 'spore', 'rate': 0.45} },
  fireSpirit: { name: '불꽃 정령', shape: 'flyer', pal: { a: '#ff7a2a' }, hp: 70, atk: 30, type: 'mag', speed: 60, ai: 'ranged', status: 'burn', proj: { speed: 190, color: '#ff7a2a', status: 'burn' }, r: 5, xp: 30, gold: 16, pres: 0, mres: 30, echo: {'id': 'ember', 'rate': 0.4} },
  waterSpirit: { name: '물의 정령', shape: 'flyer', pal: { a: '#3a9ae0' }, hp: 160, atk: 12, type: 'mag', speed: 55, ai: 'ranged', status: 'chill', proj: { speed: 170, color: '#4aa8e8', status: 'chill' }, moves: ['heal'], splitAt: 0.5, r: 6, xp: 18, gold: 9, pres: 10, mres: 40, echo: {'id': 'frost', 'rate': 0.4} },
  watcherEye: { name: '감시안', shape: 'flyer', pal: { a: '#f0e8ec' }, hp: 180, atk: 22, type: 'mag', speed: 50, ai: 'ranged', proj: { speed: 200, color: '#ff3a3a' }, moves: ['beam'], r: 7, xp: 32, gold: 17, pres: 20, mres: 50, echo: {'id': 'mirror', 'rate': 0.4} },
  shadowPanther: { name: '그림자 표범', shape: 'quad', pal: { a: '#2a2434' }, hp: 200, atk: 22, type: 'phys', speed: 120, ai: 'chase', status: 'bleed', moves: ['leap', 'leap', 'blink'], r: 7, xp: 36, gold: 19, pres: 20, mres: 20, echo: {'id': 'blood', 'rate': 0.4} },
  mimic: { name: '미믹', shape: 'quad', pal: { a: '#a8743e' }, hp: 300, atk: 26, type: 'phys', speed: 70, ai: 'chase', moves: ['combo', 'leap'], mimic: true, r: 7, xp: 40, gold: 60, pres: 40, mres: 40, echo: {'id': 'rust', 'rate': 1} },
});

// ── 공격당한 주민 (NPC가 화나서 싸울 때의 몸) ──
Object.assign(MONSTERS, { townsfolk: { name: '화난 주민', shape: 'humanoid', pal: { a: '#c8a888' }, hp: 160, atk: 10, type: 'phys', speed: 70, ai: 'chase', r: 6, xp: 0, gold: 0, pres: 10, mres: 10 } });

// ── 레이드 보스: 체력이 셋으로 나뉘어 단계마다 기술이 바뀐다 (phaseMoves) ──
Object.assign(MONSTERS, {
  raidGolem: { name: '고대 골렘', shape: 'golem', scale: 2.4, elite: true, raid: true, pal: { a: '#8a7a5a' }, hp: 14000, atk: 34, type: 'phys', speed: 34, ai: 'boss', proj: { speed: 160, color: '#c8a86a', spread: 3 }, shield: 0.2, r: 16, xp: 600, gold: 400, pres: 80, mres: 30, echo: { id: 'core', rate: 1 },
    phaseMoves: [['leap', 'combo', 'nova'], ['leap', 'nova', 'adds', 'rain'], ['leap', 'nova', 'rain', 'charge', 'adds']], adds: 'ruinSentinel' },
  raidQueen: { name: '서리 여왕', shape: 'humanoid', scale: 2.2, elite: true, raid: true, pal: { a: '#9fe3ff' }, hp: 16000, atk: 36, type: 'mag', speed: 40, ai: 'boss', status: 'chill', proj: { speed: 180, color: '#9fe3ff', status: 'chill', spread: 5 }, r: 14, xp: 800, gold: 500, pres: 30, mres: 80, echo: { id: 'witch', rate: 1 },
    phaseMoves: [['fan', 'rain', 'blink'], ['mark', 'rain', 'fan', 'adds'], ['mark', 'nova', 'rain', 'blink', 'adds']], adds: 'iceArcher' },
  raidDragon: { name: '화룡왕', shape: 'quad', scale: 2.6, elite: true, raid: true, pal: { a: '#d8501a' }, hp: 19000, atk: 40, type: 'mag', speed: 46, ai: 'boss', status: 'burn', proj: { speed: 190, color: '#ff7a2a', status: 'burn', spread: 5 }, r: 17, xp: 1000, gold: 650, pres: 60, mres: 60, echo: { id: 'magma', rate: 1 },
    phaseMoves: [['charge', 'fan', 'combo'], ['charge', 'rain', 'mark', 'adds'], ['charge', 'nova', 'rain', 'mark', 'adds']], adds: 'lavaLizard' },
});

// ── 새 몬스터: 지역마다 하나둘 (기술은 moves — 연속 베기 · 뛰어들기 · 부채꼴 · 물러나며 쏘기 · 장판 · 회복 · 순간이동) ──
Object.assign(MONSTERS, {
  boarRunner: { name: '멧돼지 돌격병', shape: 'quad', pal: { a: '#8a5a3a', b: '#5a3a22', c: '#c8a07a', e: '#ffdd44' }, hp: 46, atk: 7, type: 'phys', speed: 66, ai: 'chase', moves: ['leap', 'combo'], r: 7, xp: 5, gold: 3, pres: 8, mres: 0, echo: { id: 'goo', rate: 0.4 } },
  thornSprite: { name: '가시 요정', shape: 'flyer', pal: { a: '#7ad85a', b: '#3a8a2a', c: '#e0ffb0', e: '#ff5a8a' }, hp: 34, atk: 6, type: 'phys', speed: 70, ai: 'ranged', range: 110, proj: { speed: 150, color: '#9be15d', status: 'bleed' }, moves: ['fan', 'retreat'], r: 5, xp: 6, gold: 3, pres: 0, mres: 10, echo: { id: 'wing', rate: 0.4 } },
  vineSpirit: { name: '덩굴 정령', shape: 'blob', pal: { a: '#3a8a3a', b: '#1e5a1e', c: '#8ae07a', e: '#ffee66' }, hp: 70, atk: 8, type: 'mag', speed: 34, ai: 'summoner', summon: 'slime', range: 120, proj: { speed: 130, color: '#7be38a', status: 'poison' }, moves: ['pool', 'heal'], r: 7, xp: 10, gold: 6, pres: 5, mres: 20, echo: { id: 'spore', rate: 0.4 } },
  forestArcher: { name: '숲 도적 궁수', shape: 'humanoid', pal: { s: '#c8a07a', h: '#3a2a1a', a: '#3a6a2a', b: '#2a4a1a', e: '#ffee00' }, hp: 60, atk: 9, type: 'phys', speed: 58, ai: 'ranged', range: 140, proj: { speed: 190, color: '#e8d8b0' }, moves: ['fan', 'retreat'], r: 6, xp: 9, gold: 7, pres: 8, mres: 5, echo: { id: 'rust', rate: 0.4 } },
  swampTroll: { name: '늪 트롤', shape: 'humanoid', scale: 1.3, pal: { s: '#5a7a4a', h: '#2a3a1a', a: '#4a5a2a', b: '#2a3a14', e: '#ff8a2a' }, hp: 160, atk: 14, type: 'phys', speed: 40, ai: 'chase', status: 'poison', moves: ['combo', 'leap'], r: 8, xp: 18, gold: 10, pres: 25, mres: 10, echo: { id: 'venom', rate: 0.4 } },
  ruinSentinel: { name: '폐허 파수꾼', shape: 'golem', pal: { a: '#8a8478', b: '#5a564e', c: '#c8c0a8', e: '#5ad8ff' }, hp: 200, atk: 15, type: 'phys', speed: 34, ai: 'charge', shield: 0.4, moves: ['leap', 'combo'], r: 9, xp: 22, gold: 14, pres: 60, mres: 20, echo: { id: 'rust', rate: 0.4 } },
  cultist: { name: '그림자 교도', shape: 'humanoid', pal: { s: '#c8b0a8', h: '#1a1420', a: '#3a2a4a', b: '#1e1428', e: '#c45cff' }, hp: 110, atk: 13, type: 'mag', speed: 50, ai: 'summoner', summon: 'imp', range: 130, proj: { speed: 150, color: '#c45cff', status: 'curse' }, moves: ['pool', 'blink', 'heal'], r: 6, xp: 18, gold: 14, pres: 10, mres: 40, echo: { id: 'soul', rate: 0.4 } },
  wraithKnight: { name: '망령 기사', shape: 'humanoid', ghost: true, pal: { s: '#a8d8ff', h: '#4a5a7a', a: '#5a6a8a', b: '#3a4a6a', e: '#8af0ff' }, hp: 230, atk: 20, type: 'mag', speed: 56, ai: 'chase', status: 'chill', moves: ['combo', 'leap', 'blink'], r: 7, xp: 30, gold: 18, pres: 120, mres: 30, echo: { id: 'soul', rate: 0.4 } },
  boneArcher: { name: '해골 궁수', shape: 'humanoid', pal: { s: '#e8e0d0', h: '#c8c0a8', a: '#8a8070', b: '#5a5246', e: '#ff3a3a' }, hp: 120, atk: 16, type: 'phys', speed: 50, ai: 'ranged', range: 150, proj: { speed: 200, color: '#e8e0d0' }, moves: ['fan', 'retreat'], r: 6, xp: 20, gold: 12, pres: 30, mres: 10, echo: { id: 'bone', rate: 0.4 } },
  iceArcher: { name: '얼음 궁수', shape: 'humanoid', pal: { s: '#d8ecf8', h: '#6a8aa8', a: '#7aa8c8', b: '#4a7090', e: '#3ab0ff' }, hp: 140, atk: 17, type: 'phys', speed: 54, ai: 'ranged', range: 150, proj: { speed: 200, color: '#9fe3ff', status: 'chill' }, moves: ['fan', 'retreat'], r: 6, xp: 22, gold: 12, pres: 20, mres: 30, echo: { id: 'frost', rate: 0.4 } },
  yeti: { name: '설원 예티', shape: 'quad', scale: 1.4, pal: { a: '#e8f0f8', b: '#a8b8c8', c: '#ffffff', e: '#3a6aff' }, hp: 260, atk: 21, type: 'phys', speed: 60, ai: 'chase', status: 'chill', moves: ['leap', 'combo'], r: 9, xp: 30, gold: 16, pres: 40, mres: 30, echo: { id: 'frost', rate: 0.4 } },
  rockThrower: { name: '바위 투척꾼', shape: 'humanoid', scale: 1.2, pal: { s: '#a89880', h: '#5a4a3a', a: '#7a6a5a', b: '#4a3e32', e: '#ffaa3a' }, hp: 120, atk: 14, type: 'phys', speed: 44, ai: 'ranged', range: 140, proj: { speed: 160, color: '#a89880' }, moves: ['fan', 'pool'], r: 7, xp: 16, gold: 10, pres: 40, mres: 5, echo: { id: 'rust', rate: 0.4 } },
  harpy: { name: '하피', shape: 'flyer', pal: { a: '#c8a07a', b: '#7a5a3a', c: '#ffe8c8', e: '#ff3a3a' }, hp: 90, atk: 13, type: 'phys', speed: 96, ai: 'erratic', status: 'bleed', moves: ['leap', 'combo'], r: 6, xp: 14, gold: 8, pres: 5, mres: 10, echo: { id: 'wing', rate: 0.4 } },
  lavaLizard: { name: '용암 도마뱀', shape: 'quad', pal: { a: '#3a2a2a', b: '#1a1010', c: '#ff7a2a', e: '#ffee44' }, hp: 170, atk: 18, type: 'mag', speed: 60, ai: 'chase', status: 'burn', moves: ['pool', 'leap', 'combo'], r: 7, xp: 22, gold: 12, pres: 30, mres: 40, echo: { id: 'ember', rate: 0.4 } },
  sandWorm: { name: '모래 벌레', shape: 'blob', scale: 1.3, pal: { a: '#c89a5a', b: '#8a6a3a', c: '#f0d8a8', e: '#ff3a3a' }, hp: 190, atk: 19, type: 'phys', speed: 50, ai: 'burrow', moves: ['leap', 'combo'], r: 8, xp: 22, gold: 12, pres: 30, mres: 10, echo: { id: 'venom', rate: 0.4 } },
  venomSpitter: { name: '독침 개구리', shape: 'blob', pal: { a: '#3ab05a', b: '#1a6a2a', c: '#c8f07a', e: '#ff3aa8' }, hp: 140, atk: 15, type: 'mag', speed: 44, ai: 'ranged', range: 130, proj: { speed: 160, color: '#9be15d', status: 'poison' }, moves: ['fan', 'pool', 'retreat'], r: 7, xp: 18, gold: 10, pres: 10, mres: 20, echo: { id: 'blood', rate: 0.4 } },
});

// liquid: 밟을 수 있는 지형 효과 (water 감속, lava 화상, snow 감속, mist 없음)
export const ZONES = [
  { id: 'cave', name: '이끼 동굴', floor: 1, rec: 1, pal: ['#2c3b2b', '#33452f', '#283626'], wall: ['#151d14', '#2a3826', '#3d5236'], liquid: 'water', liquidPal: ['#1d4a5a', '#2a6a7a'], dark: 0.62, deco: ['moss', 'moss', 'glowshroom', 'pebble', 'fern'], portal: '#7ed957', pool: ['slime', 'bat', 'goblin', 'mossSlug', 'goblinShaman', 'caveLurker'], regions: ['이끼 굴', '고블린 야영지', '물웅덩이 동굴', '버섯 숲'], elite: 'goblinChief' },
  { id: 'swamp', name: '독늪', floor: 2, rec: 5, pal: ['#2c3524', '#35402a', '#283020'], wall: ['#121a0e', '#26331c', '#3a4a28'], liquid: 'water', liquidPal: ['#2a4a2a', '#3e6a34'], dark: 0.45, deco: ['reed', 'reed', 'lily', 'glowshroom', 'pebble'], portal: '#9be15d', pool: ['toad', 'leech', 'shroom', 'gasBloat', 'bogWitch', 'mudLurker'], regions: ['썩은 갈대밭', '가라앉은 사원', '거머리 소굴', '안개 늪'], elite: 'swampQueen' },
  { id: 'rift', name: '화산 균열', floor: 3, rec: 10, pal: ['#3a2622', '#452c26', '#30201c'], wall: ['#170c0a', '#3a1f18', '#5a2e22'], liquid: 'lava', liquidPal: ['#c8401a', '#ff8a2a'], dark: 0.5, deco: ['ember', 'pebble', 'bone', 'crystalR'], portal: '#ff7a2a', pool: ['salamander', 'magmaGolem', 'imp', 'pumpkinFiend', 'chortShaman', 'shieldDemon'], regions: ['재의 들판', '용암 강', '악귀 제단', '부서진 대장간'], elite: 'riftGuard' },
  { id: 'frost', name: '서리 회랑', floor: 4, rec: 15, pal: ['#3a4656', '#435264', '#36404e'], wall: ['#141c26', '#3a4e66', '#6a88a8'], liquid: 'snow', liquidPal: ['#c8dcec', '#e8f4ff'], dark: 0.35, deco: ['crystalB', 'crystalB', 'pebble', 'icicle'], portal: '#9fe3ff', pool: ['frostWolf', 'glassSpider', 'iceGolem', 'frostSlug', 'iceShaman', 'snowLurker'], regions: ['얼어붙은 회랑', '거울 동굴', '눈보라 언덕', '빙하 감옥'], elite: 'frostWitch' },
  { id: 'grave', name: '그림자 묘지', floor: 5, rec: 20, pal: ['#2a2434', '#322a3e', '#241f2e'], wall: ['#0e0a14', '#2a2238', '#40345a'], liquid: 'mist', liquidPal: ['#3a3450', '#4a4466'], dark: 0.7, deco: ['tomb', 'candle', 'bone', 'bone', 'pebble'], portal: '#c45cff', pool: ['skeleton', 'wraith', 'ghoul', 'tinyCorpse', 'necroAcolyte', 'boneGuard'], regions: ['무너진 묘역', '사령의 탑', '뼈 무덤', '그림자 숲'], elite: 'graveKeeper' },
];

// 강화 개체 접두어: 일반 몬스터가 가끔 달고 나온다 (잔향·경험치 2배)
export const AFFIXES = {
  giant: { name: '거대한', color: '#ffb347', scale: 1.4, hp: 2.2, atk: 1.3 },
  frenzied: { name: '광폭한', color: '#ff5050', speed: 1.5, atkRate: 1.6 },
  toxic: { name: '독성', color: '#9be15d', deathCloud: true },
  vampiric: { name: '흡혈', color: '#e0445a', drain: 0.25 },
  frozen: { name: '얼어붙은', color: '#9fe3ff', status: 'chill' },
};

// 광장 수련장 허수아비 (빌드 테스트용)
export const DUMMIES = {
  dummy: { name: '나무 허수아비', shape: 'dummy', pal: { a: '#b08a5a', b: '#6a4a2a', c: '#e0c080', e: '#2a1a0a' }, hp: 1e9, atk: 0, type: 'phys', speed: 0, ai: 'dummy', r: 7, xp: 0, gold: 0, pres: 0, mres: 0, echo: { id: 'goo', rate: 0 } },
  dummyP: { name: '강철 허수아비', shape: 'dummy', pal: { a: '#8a94a8', b: '#4a5266', c: '#d0d8e8', e: '#1a1a2a' }, hp: 1e9, atk: 0, type: 'phys', speed: 0, ai: 'dummy', r: 7, xp: 0, gold: 0, pres: 100, mres: 0, echo: { id: 'goo', rate: 0 } },
  // 성지 수련: 과녁(한 번 맞히면 넘어간다) · 버팀목(피해를 잰다, 회복하지 않는다)
  trainTarget: { name: '수련 과녁', shape: 'dummy', pal: { a: '#c8a070', b: '#6a4a2a', c: '#f0e0b0', e: '#2a1a0a' }, hp: 1, atk: 0, type: 'phys', speed: 0, ai: 'target', r: 7, xp: 0, gold: 0, pres: 0, mres: 0, echo: { id: 'goo', rate: 0 } },
  trainPost: { name: '근위대 허수아비', shape: 'dummy', pal: { a: '#9aa0b0', b: '#5a6070', c: '#e0e4f0', e: '#1a1a2a' }, hp: 1e9, atk: 0, type: 'phys', speed: 0, ai: 'target', r: 8, xp: 0, gold: 0, pres: 0, mres: 0, echo: { id: 'goo', rate: 0 } },
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

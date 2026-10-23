// 정치: 세력(아우렐리온 · 녹타리스 · 무소속) · 계급 · 지위 · 공훈/투쟁/명성/악명 · 종족 충성도 · 고위 관계자 · 벌어지는 일 · 연대기
// 정해진 이야기는 없다. 섬에서 일이 벌어지고, 플레이어가 원하는 쪽에 끼어든다. 무엇을 고를지는 플레이어 몫.

export const FACTIONS = {
  aurelion: { name: '아우렐리온', desc: '에드릭 왕에게 충성을 맹세한 기사 · 관리 · 영주들', color: '#ffd76a', point: 'merit', pointName: '공훈' },
  noctaris: { name: '녹타리스', desc: '옛 기사단장 카일라가 이끄는 봉기군 · 비밀 결사', color: '#c8a0ff', point: 'struggle', pointName: '투쟁' },
};
// 계급: need = 그 세력 점수, cond = 함께 채워야 하는 공적 (위로 갈수록 어렵다)
export const RANKS = {
  aurelion: [
    { name: '견습생', need: 0 }, { name: '종사', need: 80 }, { name: '남작', need: 250 }, { name: '자작', need: 600 }, { name: '백작', need: 1200 },
    { name: '후작', need: 2000, cond: 'nocOfficer', condText: '녹타리스 간부를 쓰러뜨린다' },
    { name: '공작', need: 3500, cond: 'nocLeader', condText: '녹타리스의 수장 카일라를 쓰러뜨린다' },
  ],
  noctaris: [
    { name: '반란군', need: 0 }, { name: '정예병', need: 80 }, { name: '투사', need: 250 },
    { name: '분대장', need: 600, cond: 'aurOfficer', condText: '왕국 장교(세리장 등)를 쓰러뜨린다' },
    { name: '대대장', need: 1200, cond: 'aurCore', condText: '왕국 중심인물(재무대신 · 기사단장 · 왕실 마법사)을 쓰러뜨린다' },
    { name: '군단장', need: 2500, cond: 'king', condText: '에드릭 왕을 쓰러뜨린다' },
  ],
};
// 종족별 왕실 충성도: 시작 평판 · 모병관 말투 · 시험 임무가 달라진다 (선악은 아니다)
export const LOYALTY = {
  knight: { lv: 2, name: '매우 높음', why: '왕성과 함께 자란 종족' }, wizard: { lv: 1, name: '높음', why: '마탑은 대대로 왕실 고문' },
  dragon: { lv: 0.5, name: '조금 높음', why: '오래된 동맹 맹약' }, elf: { lv: 0, name: '보통', why: '세계수 숲은 중립을 지켜 옴' },
  dino: { lv: -0.5, name: '조금 낮음', why: '사냥터 세금에 불만' }, assassin: { lv: -1, name: '낮음', why: '왕실의 더러운 일을 해 왔고 버림받음' },
  orc: { lv: -1, name: '낮음', why: '황야 투기장이 세금으로 무너지는 중' }, undead: { lv: -2, name: '매우 낮음', why: '오래 박해받아 옴' },
};
export const newPol = (race) => ({ faction: null, rank: 0, merit: 0, struggle: 0, kills: {}, raids: 0, cult: 0, traitor: 0, left: null, tested: (LOYALTY[race]?.lv ?? 0) >= 0, title: null });

// 대표 지위 하나 (이름 위에 보인다)
export function titleOf(save) {
  const P = save.pol || {}, R = save.rep || { fame: 0, infamy: 0 }, K = P.kills || {};
  if (K.king && !P.faction) return { text: '왕 시해자', color: '#ff4a4a' };
  if (K.nocLeader && !P.faction) return { text: '무명의 영웅', color: '#ffe8a8' };
  if (P.cult >= 3) return { text: '그림자 사도', color: '#8a6aff' };
  if (P.traitor && Date.now() - P.traitor < 3 * 864e5) return { text: '배신자', color: '#ff7a5a' };
  if (R.infamy >= 40) return { text: '현상수배범', color: '#ff5a5a' };
  if (P.raids >= 15) return { text: '전설의 약탈자', color: '#ff9a3a' };
  if (P.faction) { const F = FACTIONS[P.faction]; return { text: `${F.name} ${RANKS[P.faction][P.rank].name}`, color: F.color }; }
  if (save.trade?.joined && (save.trade.revenue || 0) >= 50000) return { text: '무역왕', color: '#ffd27a' };
  if (R.fame >= 100) return { text: '수호자', color: '#9fe8b0' };
  if (P.left || R.fame >= 40) return { text: '방랑가', color: '#bfe8ff' };
  return { text: '여행자', color: '#d8d0e8' };
}
export const bounty = (save) => { const inf = save.rep?.infamy || 0; return inf >= 30 ? Math.round(inf * 12) : 0; };

// 고위 관계자: 세계에 실제로 있는 사람. 쓰러뜨리면 자리가 비고, 시간이 지나면 새 사람이 앉는다 ("직책은 남고 사람은 바뀐다")
export const OFFICIALS = {
  taxChief: { side: 'aurelion', title: '세리장', where: 'castle', at: [-12, 6], monster: 'bandit', lv: 25, hp: 6, guards: [['royalGuard', 2]], cond: 'aurOfficer', respawnH: 2 },
  treasurer: { side: 'aurelion', title: '재무대신', where: 'castle', at: [10, 6], monster: 'necroAcolyte', lv: 32, hp: 8, guards: [['royalGuard', 3]], cond: 'aurCore', respawnH: 3 },
  knightCommander: { side: 'aurelion', title: '기사단장', where: 'castle', at: [-8, 11], monster: 'fallenKnight', lv: 38, hp: 10, guards: [['royalGuard', 3]], cond: 'aurCore', respawnH: 3 },
  royalMage: { side: 'aurelion', title: '왕실 마법사', where: 'castle', at: [8, 11], monster: 'iceShaman', lv: 40, hp: 9, guards: [['royalGuard', 2], ['iceShaman', 1]], cond: 'aurCore', respawnH: 3 },
  king: { side: 'aurelion', title: '국왕', firstName: '에드릭', where: 'castle', at: [0, -2], monster: 'fallenKnight', lv: 55, hp: 30, guards: [['royalGuard', 5], ['fallenKnight', 1]], cond: 'king', respawnH: 24, king: true },
  quartermaster: { side: 'noctaris', title: '녹타리스 보급관', where: 'nokt', at: [64, 33], monster: 'bandit', lv: 25, hp: 6, guards: [['bandit', 2]], cond: 'nocOfficer', respawnH: 2 },
  spymaster: { side: 'noctaris', title: '녹타리스 정보 책임자', where: 'nokt', at: [34, 33], monster: 'darkArcher', lv: 32, hp: 8, guards: [['bandit', 3]], cond: 'nocOfficer', respawnH: 3 },
  leader: { side: 'noctaris', title: '녹타리스의 수장', where: 'nokt', at: [50, 49], monster: 'wraithKnight', lv: 55, hp: 30, guards: [['bandit', 4], ['darkArcher', 2]], cond: 'nocLeader', respawnH: 24, king: true, firstName: '카일라' },
};
const NAMES = ['알도', '베르닌', '카스파', '도렌', '에르마', '펠릭', '가렌', '힐다', '이브론', '조엘', '케이란', '로시', '마르텐', '니벨', '오스릭', '프리다', '라젤', '세브린', '토르반', '울리카'];
export function officialName(id, gen) {
  const O = OFFICIALS[id];
  if (gen === 1) return O.firstName || (O.king ? '에드릭' : NAMES[(id.length * 7) % NAMES.length]);
  return NAMES[(id.length * 7 + gen * 5) % NAMES.length];
}
// 지금 그 자리에 누가 있나 (비어 있으면 null)
export function officialNow(save, id) {
  const S = (save.officials ||= {}), st = (S[id] ||= { gen: 1, deadAt: 0 });
  const O = OFFICIALS[id];
  if (st.deadAt && Date.now() - st.deadAt < O.respawnH * 3600e3) return null;
  if (st.deadAt) { st.deadAt = 0; st.gen++; }
  return { id, gen: st.gen, name: officialName(id, st.gen), ...O };
}

// 벌어지는 일: 섬에서 저절로 생기고, 다가가면 선택지가 뜬다 (아무것도 안 해도 된다)
export const HAPPENINGS = {
  caravan: {
    name: '상단이 지나간다', icon: 'wagon', minutes: 4,
    text: '짐마차 두 대가 길을 따라 느릿느릿 간다. 상인이 호위가 모자라다며 걱정스럽게 주위를 살핀다.',
    choices: [
      { id: 'escort', label: '호위한다', hint: '매복한 도적을 물리치면 명성 · 공훈 · 수고비', fight: 'bandits', reward: { fame: 3, merit: 25, gold: 60 } },
      { id: 'raid', label: '습격한다', hint: '호위병을 쓰러뜨리면 교역품 · 돈 · 악명 · 투쟁', fight: 'guards', reward: { infamy: 6, struggle: 20, gold: 120, cargo: 3, raid: 1 } },
      { id: 'toll', label: '통행료를 뜯는다', hint: '돈 조금 · 악명', reward: { infamy: 2, gold: 30 } },
      { id: 'leave', label: '지나친다', hint: '아무 일도 없다' },
    ],
  },
  taxWagon: {
    name: '세금 마차', icon: 'taxWagon', minutes: 4, needs: 'taxChief',
    text: '왕국 깃발을 단 마차가 마을에서 걷은 세금을 싣고 간다. 농부들이 멀찍이서 마차를 노려본다.',
    choices: [
      { id: 'guard', label: '지킨다', hint: '노리던 반란군을 물리치면 공훈 · 명성', fight: 'rebels', reward: { merit: 35, fame: 2, gold: 40 } },
      { id: 'rob', label: '턴다', hint: '세금 호위병을 쓰러뜨리면 큰돈 · 투쟁 · 악명', fight: 'guards', reward: { struggle: 35, infamy: 5, gold: 220 } },
      { id: 'ledger', label: '몰래 장부를 훔친다', hint: '들키면 싸움. 장부는 중개인이 산다 (녹타리스 가입 증거)', sneak: 0.6, fight: 'guards', reward: { item: 'taxLedger', struggle: 10 } },
      { id: 'leave', label: '지나친다', hint: '아무 일도 없다' },
    ],
  },
  patrol: {
    name: '순찰대가 농부를 괴롭힌다', icon: 'patrol', minutes: 3,
    text: '왕국 순찰대가 「세금이 모자란다」며 농부의 수레를 엎었다. 농부의 아이가 울고 있다.',
    choices: [
      { id: 'stop', label: '말린다', hint: '순찰대와 싸운다 · 명성 · 공훈이 깎인다', fight: 'patrol', reward: { fame: 5, merit: -15, struggle: 10 } },
      { id: 'side', label: '순찰대 편을 든다', hint: '공훈 조금 · 악명', reward: { merit: 10, infamy: 3 } },
      { id: 'leave', label: '모른 척한다', hint: '아무 일도 없다' },
    ],
  },
  cult: {
    name: '교단 신도의 의식', icon: 'cult', minutes: 4,
    text: '검은 옷의 사람들이 둥글게 서서 꺼진 등불을 들고 낮게 노래한다. 땅에 그려진 눈 모양 표식이 희미하게 빛난다.',
    choices: [
      { id: 'stop', label: '막는다', hint: '신도들을 물리치면 명성', fight: 'cultists', reward: { fame: 5, gold: 50 } },
      { id: 'listen', label: '엿듣는다', hint: '교단의 기록 하나 (안개 너머 뱃길의 단서)', reward: { lore: true } },
      { id: 'help', label: '돕는다', hint: '숨겨진 길 · 교단의 신뢰', reward: { cult: 1, infamy: 2 } },
      { id: 'leave', label: '지나친다', hint: '아무 일도 없다' },
    ],
  },
};
// 싸움 상대 묶음 [몬스터, 수, 이름표]
export const FOES = {
  bandits: [['bandit', 3, '매복한 도적'], ['darkArcher', 1, '도적 궁수']],
  guards: [['royalGuard', 2, '호위병'], ['bandit', 1, '용병']],
  rebels: [['bandit', 3, '반란군']],
  patrol: [['royalGuard', 3, '왕국 순찰병']],
  cultists: [['cultist', 3, '교단 신도'], ['necroAcolyte', 1, '교단 사제']],
};
export const CULT_LORE = [
  '신도의 노래: 여덟 불꽃이 꺼지면 탑은 잠들고, 잠든 탑 아래 섬은 새로 태어난다. 안개의 길은 해골 바다와 서리 바다 사이에 있다.',
  '의식 두루마리: 안개 너머로 가려는 자는 꺼진 등불을 세 번 보았어야 한다. 그때 바다가 길을 연다.',
  '신도의 쪽지: 서리왕관과 해골 군도의 뱃사람들은 안개 속 섬을 안다. 다만 입을 열지 않을 뿐.',
];
// 안개 너머 뱃길이 열리는 단서 (도감 기록에서 세어 본다)
export const MIST_CLUE_WORDS = ['안개', '꺼진 등불', '교단', '불꽃이 꺼지면', '빛은 여덟'];
export const mistClues = (save) => (save.codex?.lore || []).filter((t) => MIST_CLUE_WORDS.some((w) => t.includes(w))).length;
export const MIST_NEED = 3;

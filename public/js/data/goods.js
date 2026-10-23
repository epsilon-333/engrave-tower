// 물건 (가방에 쌓이는 것): 광석 · 보석 · 나무 · 채집물 · 땅에서 나온 것 · 물고기 · 작물 · 씨앗 · 미끼
// + 도구(곡괭이 · 도끼 · 삽 · 괭이 · 물뿌리개 · 낚싯대) · 자원 덩어리 · 땅 파기 · 낚시 · 농사 · 대장간 제작 · 잡화점 시세
// icon: 그림 종류(t)와 색(c). 그림은 render/icons.js 가 그린다.

export const GOOD_CATS = { food: '요리', ore: '광석 · 돌', gem: '보석', wood: '나무', forage: '채집물', meat: '고기', part: '몬스터 부산물', dig: '땅에서 나온 것', bait: '미끼', fish: '물고기', crop: '작물', seed: '씨앗', potion: '물약', scroll: '주문서', junk: '잡동사니', cargo: '교역품' };

// ── 가방: 물건 종류마다 한 칸 (같은 물건은 몇 개든 한 칸). 잡화점에서 칸을 늘린다 ──
export const BAG_START = 30;
export const BAG_UPGRADES = [[40, 400], [50, 1200], [60, 3000], [80, 8000]]; // [늘어난 칸, 골드]
export const bagUsed = (bag) => { let n = 0; for (const k in bag) if (bag[k] > 0) n++; return n; };
export const bagFits = (life, id) => (life.bag[id] || 0) > 0 || bagUsed(life.bag) < (life.cap || BAG_START);
export function bagAdd(life, id, n = 1) { if (!bagFits(life, id)) return false; life.bag[id] = (life.bag[id] || 0) + n; return true; }

export const GOODS = {
  // ── 광석 · 돌 ──
  stone: { name: '돌', cat: 'ore', price: 2, desc: '어디서나 나는 돌.', icon: { t: 'ore', c: ['#8a8a86', '#a8a8a2', '#cfcfc8'] } },
  coal: { name: '석탄', cat: 'ore', price: 6, desc: '대장간 화로를 달군다.', icon: { t: 'ore', c: ['#6a6670', '#26222a', '#4a4650'] } },
  copperOre: { name: '구리 광석', cat: 'ore', price: 8, desc: '들판과 산기슭의 바위에서 난다. 구리 도구와 무기의 재료.', icon: { t: 'ore', c: ['#7a7068', '#d0763a', '#f4b07a'] } },
  ironOre: { name: '철광석', cat: 'ore', price: 16, desc: '바위산과 동굴에서 난다. 구리 곡괭이가 있어야 캔다.', icon: { t: 'ore', c: ['#6a6670', '#a4acbc', '#e8eef8'] } },
  silverOre: { name: '은광석', cat: 'ore', price: 30, desc: '설원과 깊은 동굴에서 난다. 철 곡괭이가 있어야 캔다.', icon: { t: 'ore', c: ['#646070', '#d4d8e6', '#ffffff'] } },
  goldOre: { name: '금광석', cat: 'ore', price: 48, desc: '황야와 화산에서 난다. 철 곡괭이가 있어야 캔다.', icon: { t: 'ore', c: ['#7a6a58', '#f0c040', '#fff2a8'] } },
  manaCrystal: { name: '마력 수정', cat: 'ore', price: 65, desc: '마력이 굳은 보랏빛 수정. 설원 깊은 곳에서 자란다.', icon: { t: 'crystal', c: ['#8a6ad8', '#d4c0ff', '#5a3aa8'] } },
  obsidian: { name: '흑요석', cat: 'ore', price: 55, desc: '용암이 식어 굳은 검은 유리. 수정 곡괭이로만 캔다.', icon: { t: 'shard', c: ['#3a2e48', '#8a7aaa', '#16101e'] } },
  // ── 보석 ──
  ruby: { name: '루비', cat: 'gem', price: 130, desc: '금 광맥과 흑요석에서 드물게 나온다.', icon: { t: 'gem', c: ['#e0303a', '#ff9a9a', '#8a1020'] } },
  sapphire: { name: '사파이어', cat: 'gem', price: 130, desc: '은 광맥에서 드물게 나온다.', icon: { t: 'gem', c: ['#3060e0', '#9ab8ff', '#10308a'] } },
  emerald: { name: '에메랄드', cat: 'gem', price: 130, desc: '마력 수정 곁에서 드물게 나온다.', icon: { t: 'gem', c: ['#2ea84e', '#9af0aa', '#106a2a'] } },
  pearl: { name: '진주', cat: 'gem', price: 150, desc: '바다에서 아주 드물게 건진다.', icon: { t: 'pearl', c: ['#f4f0ea', '#ffffff', '#c8bcd0'] } },
  // ── 나무 ──
  wood: { name: '나무', cat: 'wood', price: 3, desc: '나무를 베면 나온다.', icon: { t: 'log', c: ['#7a5232', '#d0a874', '#a87c4c'] } },
  hardwood: { name: '단단한 나무', cat: 'wood', price: 12, desc: '굵은 나무에서 나온다. 구리 도끼가 있어야 얻는다.', icon: { t: 'log', c: ['#4a3020', '#a0703e', '#7a5028'] } },
  // ── 채집물 ──
  herb: { name: '약초', cat: 'forage', price: 8, desc: '숲과 들에서 자란다.', icon: { t: 'leaf', c: ['#3e8a32', '#8ad060', '#2a5e22'] } },
  mushroom: { name: '버섯', cat: 'forage', price: 10, desc: '그늘진 숲과 늪에서 자란다.', icon: { t: 'mushroom', c: ['#c84a3a', '#ffffff', '#e8d8c0'] } },
  berry: { name: '산딸기', cat: 'forage', price: 6, desc: '덤불에서 딴다.', icon: { t: 'berry', c: ['#d42a4a', '#ff8aa0', '#3e8a32'] } },
  frostLily: { name: '서리 백합', cat: 'forage', price: 40, desc: '눈 속에서만 피는 푸른 꽃.', icon: { t: 'flower', c: ['#bfe8ff', '#ffffff', '#5aa0c8'] } },
  fireBloom: { name: '불꽃 꽃', cat: 'forage', price: 40, desc: '화산재 위에서 피는 붉은 꽃. 만지면 따뜻하다.', icon: { t: 'flower', c: ['#ff7a2a', '#ffe08a', '#c83a1a'] } },
  truffle: { name: '송로버섯', cat: 'forage', price: 70, desc: '숲의 땅속에 숨어 있는 귀한 버섯.', icon: { t: 'truffle', c: ['#4a3a30', '#7a6050', '#2a201a'] } },
  seaweed: { name: '해초', cat: 'forage', price: 4, desc: '물가에 떠밀려 오거나 낚싯바늘에 걸린다.', icon: { t: 'weed', c: ['#3a8a5a', '#6ac080', '#1e5a38'] } },
  coral: { name: '산호 조각', cat: 'forage', price: 22, desc: '바다와 용궁에서 난다.', icon: { t: 'coral', c: ['#ff7a8a', '#ffc0c8', '#c83a5a'] } },
  shell: { name: '소라 껍데기', cat: 'forage', price: 6, desc: '바닷가 모래에서 줍는다.', icon: { t: 'shell', c: ['#f0d8c0', '#ffffff', '#c89a7a'] } },
  // ── 땅에서 나온 것 · 미끼 ──
  worm: { name: '지렁이', cat: 'bait', price: 2, desc: '낚시 미끼. 가지고 있으면 한 마리씩 써서 물고기가 빨리, 귀한 것이 더 자주 문다.', icon: { t: 'worm', c: ['#e88a8a', '#ffb8b0', '#a85a5a'] } },
  clay: { name: '점토', cat: 'dig', price: 5, desc: '땅을 파면 나온다.', icon: { t: 'lump', c: ['#b07a5a', '#d4a07a', '#7a5038'] } },
  oldCoin: { name: '옛 동전', cat: 'dig', price: 30, desc: '오래전 왕국의 동전.', icon: { t: 'coin', c: ['#d8a840', '#fff0a0', '#8a6a20'] } },
  bone: { name: '오래된 뼈', cat: 'dig', price: 4, desc: '묘지의 땅에서 나온다.', icon: { t: 'bone', c: ['#e8e0cc', '#ffffff', '#a8a090'] } },
  // ── 고기 (몬스터가 떨어뜨린다 · 요리 재료) ──
  beastMeat: { name: '짐승 고기', cat: 'meat', price: 14, desc: '하이에나 · 랩터 · 서리 망자에게서 얻는다. 구우면 힘이 난다.', icon: { t: 'meat', c: ['#c8504a', '#f0a0a0', '#f4ecd8'] } },
  crabMeat: { name: '게살', cat: 'meat', price: 18, desc: '산호 게의 단단한 살. 먹으면 몸이 단단해진다.', icon: { t: 'meat', c: ['#f0a080', '#ffe0d0', '#e8603a'] } },
  serpentMeat: { name: '바다뱀 살', cat: 'meat', price: 20, desc: '바다뱀의 살. 먹으면 물속에서 숨이 길어진다.', icon: { t: 'meat', c: ['#6ac8c0', '#c8f0e8', '#3a8a8a'] } },
  frogLeg: { name: '개구리 다리', cat: 'meat', price: 9, desc: '늪의 진흙 괴물에게서 얻는다. 먹으면 몸이 가벼워진다.', icon: { t: 'meat', c: ['#8ab060', '#d8e8b0', '#5a7a3a'] } },
  // ── 잡동사니 ──
  oldBoot: { name: '낡은 장화', cat: 'junk', price: 1, desc: '누군가 잃어버린 장화. 물이 줄줄 샌다.', icon: { t: 'boot', c: ['#6a4a32', '#8a6a4a', '#3a2818'] } },
  // ── 정령석: 세계수 성지에서 정령과 계약할 때 바친다 (몬스터가 가끔 떨어뜨리고, 숲에서 더 자주) ──
  spiritStone: { name: '정령석', cat: 'gem', price: 40, desc: '정령의 숨이 깃든 맑은 돌. 세계수 성지의 「정령 계약」에서 하나를 바치면 정령 하나와 계약한다.', icon: { t: 'crystal', c: ['#9bffb0', '#e8fff0', '#3a9a6a'] } },
  // ── 마탑 주문서 (1회용 · 가방에서 '읽기') ──
  scroll_breath: { name: '수중 호흡 주문서', cat: 'scroll', price: 30, desc: '읽으면 3분 동안 물속에서 숨이 줄지 않는다.', use: { kind: 'buff', buff: 'waterBreath', t: 180, color: '#7ad8ff', name: '수중 호흡' }, icon: { t: 'scroll', c: ['#3a8ad8'] } },
  scroll_return: { name: '귀환 주문서', cat: 'scroll', price: 40, desc: '읽으면 바람결 마을로 돌아간다. 던전에서 읽으면 얻은 것을 모두 지킨 채 밖으로 나온다.', use: { kind: 'return' }, icon: { t: 'scroll', c: ['#e8a83a'] } },
  scroll_teleport: { name: '이동 주문서', cat: 'scroll', price: 50, desc: '읽으면 깨운 이동 포탈 가운데 한 곳으로 바로 간다. (바깥 세계에서)', use: { kind: 'teleport' }, icon: { t: 'scroll', c: ['#8a6aff'] } },
  scroll_light: { name: '빛의 주문서', cat: 'scroll', price: 25, desc: '읽으면 5분 동안 내 둘레가 환히 밝아진다. 어두운 던전과 밤에.', use: { kind: 'buff', buff: 'scrollLight', t: 300, color: '#fff0a0', name: '빛의 주문서' }, icon: { t: 'scroll', c: ['#d8b830'] } },
  scroll_haste: { name: '바람의 주문서', cat: 'scroll', price: 35, desc: '읽으면 3분 동안 이동 속도 +25%.', use: { kind: 'buff', buff: 'scrollHaste', t: 180, mods: { moveSpeed: 1.25 }, color: '#bfffd0', name: '바람의 주문서' }, icon: { t: 'scroll', c: ['#3ab878'] } },
  scroll_reveal: { name: '탐색 주문서', cat: 'scroll', price: 60, desc: '읽으면 지금 있는 던전 층의 지도가 모두 드러난다. 바깥 세계에서는 둘레의 넓은 땅이 드러난다.', use: { kind: 'reveal' }, icon: { t: 'scroll', c: ['#c83a3a'] } },
  // ── 물약 (가방에서 '마시기' · Z로 빨리 마시기 · 한 번 마시면 8초 뒤에 다시) ──
  potion1: { name: '체력 포션', cat: 'potion', price: 20, desc: '마시면 체력을 30% 되찾는다.', use: { kind: 'potion', heal: 0.3 }, icon: { t: 'potion', c: ['#e04a4a'] } },
  potion2: { name: '상급 체력 포션', cat: 'potion', price: 60, desc: '마시면 체력을 55% 되찾는다.', use: { kind: 'potion', heal: 0.55 }, icon: { t: 'potion', c: ['#d8306a'], k: 2 } },
  potion3: { name: '최상급 체력 포션', cat: 'potion', price: 150, desc: '마시면 체력을 모두 되찾는다.', use: { kind: 'potion', heal: 1 }, icon: { t: 'potion', c: ['#f0c040'], k: 3 } },
};

// ── 물고기: 사는 물(water) · 지역(biome, 없으면 어디든) · 잘 걸리는 정도(w) · 크기(cm) · 값 ──
// beat: 리듬 낚시의 난이도(1 쉬움 ~ 5 전설) · style: 박자 모양 (calm 고른 박 · dart 빠른 두 번 · erratic 엇박 · sink 쉬었다 몰아치기 · wave 길고 짧게)
// water: fresh(호수 · 연못) · river(강) · sea(바다) · bog(늪) · lava(용암, 화염 낚싯대) · cave(동굴 물) · palace(용궁)
const F = (name, water, w, size, price, beat, style, icon, extra = {}) => ({ name, water, w, size, price, beat, style, icon, ...extra });
export const FISH = {
  // 호수 · 연못
  crucian: F('붕어', ['fresh', 'river'], 30, [12, 30], 8, 1, 'calm', ['#9a8a5a', '#6a5a3a', '#d8c898']),
  carp: F('잉어', ['fresh', 'river'], 20, [30, 75], 15, 2, 'calm', ['#b88a4a', '#7a5a2a', '#e8d0a0']),
  bluegill: F('블루길', ['fresh'], 22, [10, 22], 9, 1, 'dart', ['#5a7aa8', '#3a4a6a', '#e8c060'], { shape: 'tall' }),
  goldfish: F('금붕어', ['fresh'], 12, [6, 14], 20, 1, 'wave', ['#f08a2a', '#d85a1a', '#ffd08a'], { biome: ['plains', 'meadow', 'lake'], shape: 'round' }),
  mirrorMinnow: F('거울 송사리', ['fresh'], 14, [5, 10], 25, 2, 'dart', ['#d8e8f0', '#8ab0c8', '#ffffff'], { biome: ['lake'], shape: 'slim' }),
  catfish: F('메기', ['fresh'], 10, [40, 110], 30, 3, 'sink', ['#5a5a4a', '#3a3a2e', '#a8a890'], { shape: 'long' }),
  snakehead: F('가물치', ['fresh', 'bog'], 8, [40, 90], 40, 3, 'sink', ['#4a4a3a', '#2a2a1e', '#8a8a6a'], { shape: 'big' }),
  koi: F('비단잉어', ['fresh'], 4, [40, 80], 120, 4, 'wave', ['#f4f0e8', '#e8483a', '#ffffff']),
  sturgeon: F('철갑상어', ['fresh'], 2, [100, 220], 180, 4, 'sink', ['#7a8090', '#4a5060', '#c8ccd8'], { biome: ['lake'], shape: 'big' }),
  goldCarp: F('황금 잉어', ['fresh'], 1, [40, 85], 250, 5, 'dart', ['#f0c040', '#c88a20', '#fff2b0'], { legend: true }),
  // 강
  minnow: F('피라미', ['river'], 30, [8, 15], 6, 1, 'dart', ['#b8c8d0', '#6a8a9a', '#ffffff'], { shape: 'slim' }),
  sweetfish: F('은어', ['river'], 14, [15, 28], 30, 2, 'calm', ['#c8d8c0', '#7a9a8a', '#f0f0d8'], { shape: 'slim' }),
  trout: F('송어', ['river'], 22, [25, 55], 20, 2, 'dart', ['#8aa0a8', '#4a6a72', '#f0a0a0']),
  kkeokji: F('꺽지', ['river'], 12, [15, 28], 22, 2, 'erratic', ['#6a7a4a', '#3a4a2a', '#c8d0a0']),
  rainbowTrout: F('무지개송어', ['river'], 10, [30, 60], 35, 3, 'dart', ['#8ab0b8', '#4a6a72', '#f08aa0'], { biome: ['mountains', 'snow', 'lake', 'tower'] }),
  mandarin: F('쏘가리', ['river'], 5, [25, 50], 55, 4, 'dart', ['#c8b060', '#5a4a2a', '#f0e0a0']),
  salmon: F('연어', ['river'], 5, [50, 90], 70, 4, 'wave', ['#c86a5a', '#7a3a32', '#f0b0a0'], { shape: 'big' }),
  // 설원
  smelt: F('빙어', ['fresh', 'river'], 34, [8, 14], 10, 1, 'calm', ['#d8eef8', '#9ac0d8', '#ffffff'], { biome: ['snow'], shape: 'slim' }),
  arcticChar: F('북극 곤들매기', ['fresh', 'river'], 12, [30, 60], 45, 3, 'calm', ['#b85a3a', '#4a5a6a', '#f08a5a'], { biome: ['snow', 'mountains'] }),
  icePike: F('얼음 강꼬치', ['fresh', 'river'], 8, [50, 100], 60, 4, 'dart', ['#a8d0e8', '#5a8aa8', '#ffffff'], { biome: ['snow'], shape: 'long' }),
  // 원시림
  discus: F('디스커스', ['fresh', 'river'], 12, [12, 20], 40, 2, 'calm', ['#3a8ad8', '#e8603a', '#ffd080'], { biome: ['jungle'], shape: 'tall' }),
  piranha: F('피라냐', ['fresh', 'river'], 22, [18, 35], 32, 3, 'dart', ['#8a8a9a', '#5a5a6a', '#e84a3a'], { biome: ['jungle'], shape: 'round' }),
  arowana: F('아로와나', ['fresh', 'river'], 4, [60, 100], 140, 4, 'wave', ['#d8c890', '#8a7a4a', '#fff0c0'], { biome: ['jungle'], shape: 'long' }),
  electricEel: F('전기뱀장어', ['fresh', 'river'], 5, [80, 200], 110, 4, 'erratic', ['#3a4a3a', '#1e2a1e', '#e8e070'], { biome: ['jungle'], shape: 'long' }),
  // 늪
  loach: F('미꾸라지', ['bog'], 30, [10, 20], 9, 1, 'erratic', ['#8a7a4a', '#5a4a2a', '#c8b888'], { shape: 'long' }),
  stickleback: F('독가시고기', ['bog'], 14, [6, 12], 25, 2, 'erratic', ['#7a9a3a', '#3a5a1a', '#c8e070'], { shape: 'slim' }),
  bogEel: F('늪 장어', ['bog'], 16, [40, 95], 26, 3, 'dart', ['#4a5a2a', '#2a3418', '#8a9a5a'], { shape: 'long' }),
  lungfish: F('폐어', ['bog'], 8, [50, 100], 55, 3, 'sink', ['#6a6a4a', '#3a3a28', '#a8a888'], { shape: 'long' }),
  // 바다
  mackerel: F('고등어', ['sea'], 30, [25, 42], 12, 1, 'calm', ['#5a8ab0', '#2a4a6a', '#e8eef4'], { shape: 'slim' }),
  seabream: F('도미', ['sea'], 16, [30, 60], 30, 2, 'calm', ['#e87a8a', '#b84a5a', '#ffd8d8'], { shape: 'tall' }),
  flatfish: F('가자미', ['sea'], 16, [20, 45], 22, 2, 'sink', ['#a8906a', '#6a5a3a', '#e8d8b8'], { shape: 'flat' }),
  squid: F('오징어', ['sea'], 14, [20, 40], 28, 2, 'erratic', ['#f0d8d8', '#d88a8a', '#ffffff'], { shape: 'squid' }),
  crab: F('꽃게', ['sea'], 12, [12, 22], 30, 2, 'erratic', ['#e8603a', '#a83a1a', '#ffc0a0'], { shape: 'crab' }),
  seahorse: F('해마', ['sea'], 5, [8, 16], 70, 2, 'calm', ['#f0a040', '#b86a20', '#ffe0a0'], { shape: 'horse' }),
  cutlass: F('갈치', ['sea'], 10, [60, 120], 40, 3, 'wave', ['#e8eef4', '#a8b8c8', '#ffffff'], { shape: 'long' }),
  octopus: F('문어', ['sea'], 8, [40, 90], 45, 3, 'sink', ['#c86a5a', '#8a3a32', '#f0a090'], { shape: 'octopus' }),
  puffer: F('복어', ['sea'], 12, [15, 32], 35, 3, 'erratic', ['#d8c070', '#8a7a3a', '#fff8d8'], { shape: 'round' }),
  tuna: F('참치', ['sea'], 4, [80, 220], 110, 4, 'sink', ['#3a4a7a', '#1a2448', '#c8d0e0'], { shape: 'big' }),
  sunfish: F('개복치', ['sea'], 2, [100, 250], 160, 4, 'calm', ['#a8b0b8', '#6a7280', '#e0e4ea'], { shape: 'sun' }),
  angler: F('아귀', ['sea'], 3, [40, 90], 90, 4, 'sink', ['#6a5a4a', '#3a2e24', '#ffe080'], { shape: 'angler' }),
  marlin: F('청새치', ['sea'], 1, [180, 350], 300, 5, 'dart', ['#3a5a9a', '#1a2a5a', '#d8e0f0'], { shape: 'marlin', legend: true }),
  dragonCarp: F('용왕의 잉어', ['sea', 'palace'], 1, [60, 120], 400, 5, 'erratic', ['#e8483a', '#f0c040', '#fff0d0'], { near: 'palace', legend: true }),
  // 동굴
  caveFish: F('눈먼 동굴어', ['cave'], 30, [10, 25], 18, 1, 'calm', ['#e8d8e8', '#b8a8c0', '#ffffff']),
  glowJelly: F('빛 해파리', ['cave', 'palace'], 10, [10, 30], 50, 2, 'wave', ['#a8e8ff', '#5ac0e8', '#ffffff'], { shape: 'jelly' }),
  axolotl: F('동굴 도롱뇽', ['cave'], 8, [15, 25], 60, 3, 'wave', ['#f0b8c8', '#d87a9a', '#ffe0e8'], { shape: 'axolotl' }),
  crystalShrimp: F('수정 새우', ['cave'], 8, [5, 12], 75, 3, 'erratic', ['#a8e8ff', '#5ac0e8', '#ffffff'], { shape: 'shrimp' }),
  // 용궁
  clownfish: F('흰동가리', ['palace'], 18, [8, 14], 35, 1, 'dart', ['#f08a2a', '#f08a2a', '#ffd0a0'], { shape: 'clown' }),
  coralFish: F('산호어', ['palace'], 26, [15, 35], 45, 2, 'dart', ['#ff8a4a', '#ffffff', '#ffd0a0'], { shape: 'tall' }),
  // 밤에만 문다
  moonTrout: F('달빛 송어', ['river'], 9, [30, 60], 70, 3, 'wave', ['#c8d0f0', '#6a7ab0', '#ffffff'], { time: 'night' }),
  glowCatfish: F('반딧불 메기', ['fresh'], 8, [40, 100], 80, 3, 'sink', ['#5a6a5a', '#2a3a2a', '#d8ff8a'], { time: 'night', shape: 'long' }),
  ghostJelly: F('유령 해파리', ['sea'], 7, [20, 50], 90, 3, 'erratic', ['#d8e8ff', '#a0b8e8', '#ffffff'], { time: 'night', shape: 'jelly' }),
  // 용암 (화염 낚싯대)
  magmaCrab: F('마그마 게', ['lava'], 14, [15, 30], 120, 3, 'erratic', ['#3a2a2a', '#ff6a1a', '#ffb04a'], { shape: 'crab' }),
  lavaEel: F('용암 장어', ['lava'], 20, [50, 130], 140, 3, 'dart', ['#3a2a2a', '#ff6a1a', '#ffb04a'], { shape: 'long' }),
  flameCarp: F('불꽃 잉어', ['lava'], 6, [30, 65], 260, 5, 'erratic', ['#ff8a1a', '#d83a1a', '#ffe08a'], { legend: true }),
};
// 낚싯바늘에 걸리는 다른 것 (물고기 대신)
export const FISH_JUNK = [['oldBoot', 5], ['seaweed', 7], ['bottleLetter', 2], ['pearl', 0.6]];

// ── 작물: 씨앗 → 단계마다 물을 주면 stageSec초 뒤 다음 단계 → 수확 (regrow: 수확 뒤 그 단계로 돌아가 다시 열린다) ──
export const CROPS = {
  turnip: { name: '순무', seedPrice: 10, stages: 3, stageSec: 40, price: 28, yield: [1, 2], icon: ['#f0e8f4', '#a85ab8', '#5aa848'] },
  wheat: { name: '밀', seedPrice: 8, stages: 4, stageSec: 35, price: 16, yield: [2, 3], icon: ['#e8c060', '#b88a30', '#8aa040'] },
  carrot: { name: '당근', seedPrice: 12, stages: 3, stageSec: 50, price: 32, yield: [1, 2], icon: ['#f08a2a', '#c85a1a', '#5aa848'] },
  potato: { name: '감자', seedPrice: 15, stages: 4, stageSec: 45, price: 38, yield: [1, 3], icon: ['#c8a070', '#8a6a42', '#5aa848'] },
  strawberry: { name: '딸기', seedPrice: 30, stages: 4, stageSec: 55, price: 24, yield: [2, 3], regrow: 2, icon: ['#e8303a', '#ffd040', '#3e8a32'] },
  pumpkin: { name: '호박', seedPrice: 45, stages: 5, stageSec: 70, price: 140, yield: [1, 1], icon: ['#f08a2a', '#b85a14', '#4a7a2a'] },
  starflower: { name: '별빛 꽃', seedPrice: 0, rare: true, stages: 5, stageSec: 90, price: 260, yield: [1, 1], icon: ['#fff2a0', '#b0a0ff', '#3e8a52'] },
};
for (const [id, c] of Object.entries(CROPS)) {
  GOODS[id] = { name: c.name, cat: 'crop', price: c.price, desc: `밭에서 키운 ${c.name}.`, icon: { t: 'crop', k: id, c: c.icon } };
  GOODS[id + 'Seed'] = { name: `${c.name} 씨앗`, cat: 'seed', price: Math.max(2, Math.floor((c.seedPrice || 60) / 2)), crop: id,
    desc: c.rare ? '땅속이나 물속에서 아주 드물게 나오는 씨앗. 밭에 심으면 밤처럼 빛나는 꽃이 핀다.' : `밭을 갈고 심은 뒤 물을 주면 자란다 (${c.stages}단계 · 단계마다 ${c.stageSec}초).`,
    icon: { t: 'seed', c: c.icon } };
}
for (const [id, f] of Object.entries(FISH)) GOODS[id] = { name: f.name, cat: 'fish', price: f.price, desc: `${f.size[0]}~${f.size[1]}cm${f.legend ? ' · 전설의 물고기' : ''}`, icon: { t: 'fish', c: f.icon, shape: f.shape } };

// ── 몬스터 부산물: 무기를 만들 때 넣으면 그 몬스터를 닮은 능력이 붙는다 (crafting.js 의 PART_FX) ──
const PT = (name, shape, c, from, price, rare = false) => ({ name, cat: 'part', price, desc: `${from}에게서 얻는다.${rare ? ' 우두머리만 지닌 귀한 것.' : ''} 무기를 만들 때 넣으면 능력이 붙는다.`, icon: { t: 'part', k: shape, c }, rare });
Object.assign(GOODS, {
  slimeGel: PT('끈적한 점액', 'gel', ['#7ed957', '#c8ffb0', '#3a7d2c'], '이끼 늪괴 · 민달팽이', 6),
  batWing: PT('박쥐 날개', 'wing', ['#6a5aa8', '#9a8cff', '#3a2e6a'], '동굴 워골 · 동굴 잠복자', 8),
  goblinTooth: PT('고블린 이빨', 'fang', ['#e8dca0', '#ffffff', '#a89a5a'], '고블린 · 고블린 주술사', 8),
  poisonGland: PT('독샘', 'gland', ['#9be15d', '#e0ffb0', '#4a7a2a'], '진흙 괴물 · 늪 마녀', 12),
  leechFang: PT('거머리 이빨', 'fang', ['#e0445a', '#ffb0b8', '#7a1a28'], '거대 거머리 · 진흙 잠복자', 12),
  sporeSac: PT('포자 주머니', 'sac', ['#d9b36b', '#fff0b0', '#8a6a2a'], '포자 시체 · 가스 부풀이', 12),
  salaTail: PT('불도롱뇽 꼬리', 'tail', ['#ff7a2a', '#ffd08a', '#a83a0a'], '화염 악귀 · 악귀 술사', 18),
  emberDust: PT('불씨 가루', 'dust', ['#ffb066', '#fff0c0', '#c85a1a'], '화염 임프 · 불꽃 호박귀', 18),
  magmaCore: PT('마그마 핵', 'core', ['#ff5a1a', '#ffd040', '#3a1a10'], '용암 오우거', 26),
  demonHorn: PT('악귀 뿔', 'horn', ['#8a2a2a', '#d86a5a', '#3a0e0e'], '방패 악귀', 22),
  frostFang: PT('서리 송곳니', 'fang', ['#c8e8ff', '#ffffff', '#5a90b8'], '서리 망자 · 서리 주술사', 22),
  iceCore: PT('얼음 핵', 'core', ['#7ac8f0', '#e0f6ff', '#1a3a8a'], '얼음 오우거 · 얼음 민달팽이', 28),
  mirrorShard: PT('거울 조각', 'shard', ['#e6f3ff', '#ffffff', '#7aa0c8'], '거울 정령 · 설원 잠복자', 24),
  boneShard: PT('뼛조각', 'bone', ['#e8e2cf', '#ffffff', '#8a8470'], '해골 병사 · 뼈 방패병', 20),
  soulDust: PT('영혼 가루', 'dust', ['#8ad8ff', '#e0f6ff', '#3a6a9a'], '망령술사 · 사령 수련생', 26),
  rotFlesh: PT('썩은 살점', 'flesh', ['#8a9a4a', '#c8d080', '#4a5420'], '구울 · 꼬마 시체', 20),
  scorpionSting: PT('전갈 독침', 'sting', ['#d8a050', '#ffe0a0', '#7a5020'], '모래 전갈', 20),
  hyenaFang: PT('하이에나 이빨', 'fang', ['#f0e8d0', '#ffffff', '#a89a7a'], '하이에나', 16),
  orcTusk: PT('오크 엄니', 'tusk', ['#f0e8c8', '#ffffff', '#a8a07a'], '오크 약탈자', 20),
  raptorClaw: PT('랩터 발톱', 'claw', ['#e8dcc0', '#ffffff', '#8a7a5a'], '랩터', 20),
  waspSting: PT('말벌 독침', 'sting', ['#e8c83a', '#fff4a0', '#5a4a10'], '독침 말벌', 18),
  beetleShell: PT('딱정벌레 껍질', 'shell', ['#3a6a5a', '#7ab0a0', '#1a3a30'], '거대 딱정벌레', 24),
  banditCloth: PT('도적의 두건', 'cloth', ['#5a5a6a', '#9a9aaa', '#2a2a36'], '도적', 18),
  crabClaw: PT('산호 집게', 'claw', ['#ff7a5a', '#ffc0a8', '#a83a2a'], '산호 게', 26),
  jellyTentacle: PT('해파리 촉수', 'tentacle', ['#ff9ad8', '#ffe0f4', '#a84a8a'], '해파리', 26),
  serpentScale: PT('바다뱀 비늘', 'scale', ['#3ab8b0', '#a8f0e8', '#1a6a6a'], '바다뱀', 28),
  wispEssence: PT('도깨비불 정수', 'flame', ['#7ae8ff', '#e8ffff', '#2a7ab8'], '밤에 떠도는 도깨비불', 22),
  // 우두머리
  chiefMask: PT('족장의 가면', 'mask', ['#c0302a', '#ff8a6a', '#5a1410'], '가면 족장', 90, true),
  giantHeart: PT('늪 거인의 심장', 'heart', ['#2a9a5a', '#7dffb0', '#0e4a2a'], '늪의 거인', 120, true),
  riftCore: PT('균열핵', 'core', ['#ffe14a', '#fff8c0', '#5a3a10'], '균열 수호자', 160, true),
  witchCrown: PT('서리 마녀의 왕관 조각', 'crown', ['#9fe3ff', '#ffffff', '#2a5aa8'], '서리 마녀', 180, true),
  graveLantern: PT('묘지기의 등불', 'lantern', ['#c45cff', '#f0c0ff', '#3a1a5a'], '묘지기', 200, true),
  dragonScale: PT('용궁 비늘', 'scale', ['#2a8a9a', '#9af0ff', '#ffe14a'], '용궁 수문장', 180, true),
  lordHorn: PT('미궁 군주의 뿔', 'horn', ['#6a2a2a', '#ff8a4a', '#2a0e0e'], '미궁의 군주', 150, true),
  warlordTusk: PT('족장의 엄니', 'tusk', ['#f4ecc8', '#ffffff', '#c8a050'], '오크 족장', 130, true),
  alphaClaw: PT('우두머리 발톱', 'claw', ['#c8f07a', '#ffffff', '#3a8a2a'], '우두머리 랩터', 130, true),
  fallenCrest: PT('타락한 문장', 'crest', ['#4a4a5a', '#c45cff', '#ff3a3a'], '타락한 기사', 140, true),
  golemHeart: PT('고대 골렘의 심장', 'core', ['#c8a86a', '#fff0c0', '#5a4a2a'], '고대 골렘 (레이드)', 600, true),
  queenTear: PT('서리 여왕의 눈물', 'shard', ['#9fe3ff', '#ffffff', '#3a6a9a'], '서리 여왕 (레이드)', 800, true),
  dragonCrest: PT('화룡왕의 문장', 'crest', ['#ff7a3a', '#ffe14a', '#5a1a0a'], '화룡왕 (레이드)', 1000, true),
});
// 몬스터 → 떨어뜨리는 것 [물건, 확률] (우두머리는 반드시)
export const MONSTER_DROPS = {
  slime: [['slimeGel', 0.22]], mossSlug: [['slimeGel', 0.18]], bat: [['batWing', 0.22]], caveLurker: [['batWing', 0.2]],
  goblin: [['goblinTooth', 0.2]], goblinShaman: [['goblinTooth', 0.25]], toad: [['poisonGland', 0.22], ['frogLeg', 0.3]], bogWitch: [['poisonGland', 0.3]],
  leech: [['leechFang', 0.22]], mudLurker: [['leechFang', 0.2]], shroom: [['sporeSac', 0.22]], gasBloat: [['sporeSac', 0.25]],
  salamander: [['salaTail', 0.22]], chortShaman: [['salaTail', 0.25]], imp: [['emberDust', 0.22]], pumpkinFiend: [['emberDust', 0.25]],
  magmaGolem: [['magmaCore', 0.2]], shieldDemon: [['demonHorn', 0.22]], frostWolf: [['frostFang', 0.22], ['beastMeat', 0.25]], iceShaman: [['frostFang', 0.25]],
  iceGolem: [['iceCore', 0.2]], frostSlug: [['iceCore', 0.15]], glassSpider: [['mirrorShard', 0.22]], snowLurker: [['mirrorShard', 0.2]],
  skeleton: [['boneShard', 0.24]], boneGuard: [['boneShard', 0.3]], wraith: [['soulDust', 0.22]], necroAcolyte: [['soulDust', 0.25]],
  ghoul: [['rotFlesh', 0.22]], tinyCorpse: [['rotFlesh', 0.2]], sandScorpion: [['scorpionSting', 0.22]], hyena: [['hyenaFang', 0.22], ['beastMeat', 0.3]],
  orcRaider: [['orcTusk', 0.22]], raptor: [['raptorClaw', 0.22], ['beastMeat', 0.3]], jungleWasp: [['waspSting', 0.22]], bigBeetle: [['beetleShell', 0.22]],
  bandit: [['banditCloth', 0.22]], coralCrab: [['crabClaw', 0.22], ['crabMeat', 0.3]], jellyfish: [['jellyTentacle', 0.22]], seaSerpent: [['serpentScale', 0.22], ['serpentMeat', 0.3]],
  wisp: [['wispEssence', 0.35]],
  raidGolem: [['golemHeart', 1]], raidQueen: [['queenTear', 1]], raidDragon: [['dragonCrest', 1]],
  boarRunner: [['beastMeat', 0.35]], thornSprite: [['herb', 0.25]], vineSpirit: [['sporeSac', 0.25], ['herb', 0.2]], forestArcher: [['goblinTooth', 0.2]], swampTroll: [['poisonGland', 0.3], ['rotFlesh', 0.2]],
  ruinSentinel: [['ironOre', 0.3]], cultist: [['soulDust', 0.25]], wraithKnight: [['soulDust', 0.3]], boneArcher: [['boneShard', 0.3]], iceArcher: [['frostFang', 0.25]], yeti: [['beastMeat', 0.35], ['frostFang', 0.2]],
  rockThrower: [['stone', 0.5], ['ironOre', 0.15]], harpy: [['batWing', 0.3]], lavaLizard: [['emberDust', 0.3], ['salaTail', 0.2]], sandWorm: [['scorpionSting', 0.25]], venomSpitter: [['poisonGland', 0.3], ['frogLeg', 0.3]],
  goblinChief: [['chiefMask', 1]], swampQueen: [['giantHeart', 1]], riftGuard: [['riftCore', 1]], frostWitch: [['witchCrown', 1]], graveKeeper: [['graveLantern', 1]],
  dragonGuard: [['dragonScale', 1]], labyrinthLord: [['lordHorn', 1]], orcWarlord: [['warlordTusk', 1]], raptorAlpha: [['alphaClaw', 1], ['beastMeat', 1]], fallenKnight: [['fallenCrest', 1]],
};

// ── 도구: 단계(1~4)가 오를수록 세진다. 단계 1은 처음부터 가진다 ──
export const TOOLS = {
  pickaxe: { name: '곡괭이', tiers: ['낡은 곡괭이', '구리 곡괭이', '철 곡괭이', '수정 곡괭이'], what: ['돌 · 석탄 · 구리', '철광석까지', '은 · 금 · 마력 수정까지', '흑요석까지 · 더 빨리'] },
  axe: { name: '도끼', tiers: ['낡은 도끼', '구리 도끼', '철 도끼', '수정 도끼'], what: ['나무 (세 번)', '단단한 나무도 나온다', '두 번에 쓰러뜨린다', '한 번에 쓰러뜨린다'] },
  shovel: { name: '삽', tiers: ['낡은 삽', '구리 삽', '철 삽', '수정 삽'], what: ['땅 파기', '귀한 것이 조금 더', '한 번에 두 가지', '보석 · 유물이 훨씬 자주'] },
  hoe: { name: '괭이', tiers: ['낡은 괭이', '구리 괭이', '철 괭이', '수정 괭이'], what: ['한 칸씩', '가로 3칸', '3×3칸', '3×3칸'] },
  can: { name: '물뿌리개', tiers: ['낡은 물뿌리개', '구리 물뿌리개', '철 물뿌리개', '수정 물뿌리개'], what: ['한 칸씩', '가로 3칸', '3×3칸', '3×3칸'] },
  rod: { name: '낚싯대', tiers: ['대나무 낚싯대', '구리 낚싯대', '철 낚싯대', '화염 낚싯대'], what: ['낚싯줄 3개', '판정이 넉넉해지고 낚싯줄 4개', '귀한 물고기가 더 자주 문다', '용암에서도 낚는다 · 낚싯줄 5개'] },
};
export const TOOL_COLOR = ['#8a6a4a', '#d0763a', '#b8c0cc', '#a88aff'];
// 도구를 다음 단계로 (인덱스 = 올릴 단계)
export const TOOL_UPGRADE = {
  2: { mats: { copperOre: 5, wood: 4 }, gold: 50 },
  3: { mats: { ironOre: 6, hardwood: 3, coal: 2 }, gold: 150 },
  4: { mats: { manaCrystal: 3, silverOre: 4 }, gold: 350 },
};
export const ROD4 = { mats: { obsidian: 3, fireBloom: 2, silverOre: 2 }, gold: 350 }; // 화염 낚싯대만 재료가 다르다
export const toolUpgradeCost = (kind, tier) => (kind === 'rod' && tier === 4 ? ROD4 : TOOL_UPGRADE[tier]);

// ── 캐는 것: 바위 · 광맥 · 덤불 · 꽃 (tool: 필요한 도구, tier: 필요한 단계, hp: 내려칠 횟수 × 단계 힘) ──
export const NODES = {
  rock: { name: '바위', tool: 'pickaxe', tier: 1, hp: 3, drops: [['stone', 2, 3]], extra: [['coal', 0.15], ['copperOre', 0.1]], respawn: 240 },
  coal: { name: '석탄 광맥', tool: 'pickaxe', tier: 1, hp: 4, drops: [['coal', 2, 3]], extra: [['stone', 0.5]], respawn: 300 },
  copper: { name: '구리 광맥', tool: 'pickaxe', tier: 1, hp: 4, drops: [['copperOre', 2, 3]], extra: [['stone', 0.5]], respawn: 300 },
  iron: { name: '철 광맥', tool: 'pickaxe', tier: 2, hp: 6, drops: [['ironOre', 2, 3]], extra: [['coal', 0.3]], respawn: 360 },
  silver: { name: '은 광맥', tool: 'pickaxe', tier: 3, hp: 7, drops: [['silverOre', 2, 3]], extra: [['sapphire', 0.06]], respawn: 420 },
  gold: { name: '금 광맥', tool: 'pickaxe', tier: 3, hp: 8, drops: [['goldOre', 1, 3]], extra: [['ruby', 0.06]], respawn: 420 },
  crystal: { name: '마력 수정', tool: 'pickaxe', tier: 3, hp: 8, drops: [['manaCrystal', 1, 2]], extra: [['emerald', 0.07]], respawn: 480 },
  obsidian: { name: '흑요석 덩어리', tool: 'pickaxe', tier: 4, hp: 10, drops: [['obsidian', 1, 2]], extra: [['ruby', 0.08]], respawn: 480 },
  herb: { name: '약초', tier: 0, hp: 1, drops: [['herb', 1, 2]], respawn: 180 },
  berry: { name: '산딸기 덤불', tier: 0, hp: 1, drops: [['berry', 2, 4]], respawn: 200 },
  mushroom: { name: '버섯', tier: 0, hp: 1, drops: [['mushroom', 1, 2]], respawn: 200 },
  frostLily: { name: '서리 백합', tier: 0, hp: 1, drops: [['frostLily', 1, 1]], respawn: 300 },
  fireBloom: { name: '불꽃 꽃', tier: 0, hp: 1, drops: [['fireBloom', 1, 1]], respawn: 300 },
  shell: { name: '소라 껍데기', tier: 0, hp: 1, drops: [['shell', 1, 1]], extra: [['pearl', 0.02]], respawn: 240 },
  // 바닷속
  clam: { name: '큰 조개', tier: 0, hp: 1, drops: [['shell', 1, 2]], extra: [['pearl', 0.12]], respawn: 300 },
  coralNode: { name: '산호', tool: 'pickaxe', tier: 1, hp: 3, drops: [['coral', 1, 2]], extra: [['pearl', 0.03]], respawn: 360 },
  kelp: { name: '해초', tier: 0, hp: 1, drops: [['seaweed', 2, 3]], respawn: 200 },
};
// 지역별로 놓이는 것 [종류, 가중치]
export const BIOME_NODES = {
  plains: [['rock', 5], ['copper', 2], ['herb', 3], ['berry', 3]],
  meadow: [['rock', 3], ['copper', 2], ['herb', 3], ['berry', 4]],
  forest: [['rock', 2], ['copper', 2], ['herb', 4], ['mushroom', 4], ['berry', 2]],
  swamp: [['herb', 4], ['mushroom', 5], ['rock', 1]],
  ruins: [['rock', 5], ['copper', 2], ['iron', 2], ['herb', 1]],
  graveyard: [['rock', 3], ['iron', 1], ['mushroom', 3], ['coal', 2]],
  snow: [['rock', 3], ['silver', 3], ['crystal', 2], ['frostLily', 3], ['iron', 2]],
  mountains: [['rock', 5], ['iron', 4], ['coal', 4], ['silver', 2], ['copper', 2]],
  volcano: [['rock', 2], ['obsidian', 3], ['gold', 3], ['coal', 3], ['fireBloom', 3]],
  wasteland: [['rock', 4], ['gold', 3], ['copper', 3], ['iron', 2]],
  jungle: [['herb', 4], ['berry', 3], ['mushroom', 2], ['gold', 1], ['rock', 2]],
  lake: [['rock', 2], ['herb', 2], ['berry', 2]],
  coast: [['shell', 6], ['rock', 1]],
};
// 동굴 · 던전 안의 광맥 (지역 주제별)
export const THEME_NODES = {
  cave: [['rock', 4], ['copper', 4], ['iron', 3], ['coal', 3], ['mushroom', 2]],
  swamp: [['mushroom', 4], ['herb', 3], ['iron', 2], ['rock', 2]],
  frost: [['silver', 4], ['crystal', 3], ['iron', 2], ['rock', 2]],
  rift: [['obsidian', 3], ['gold', 3], ['coal', 3], ['rock', 2]],
  grave: [['iron', 3], ['silver', 2], ['coal', 3], ['rock', 2]],
  labyrinth: [['iron', 3], ['silver', 3], ['gold', 2], ['rock', 2]],
  palace: [['crystal', 2], ['silver', 2], ['shell', 3]],
};

// ── 땅 파기: 반짝이는 흙을 삽으로 판다 ──
export const ARTIFACTS = {
  brokenCrown: { name: '깨진 왕관', biome: 'meadow', icon: 'crown', text: '보석 자리가 텅 빈 왕관 조각. 무너진 왕성에서 흘러나왔을까.' },
  rustHelm: { name: '녹슨 투구', biome: 'plains', icon: 'helm', text: '옛 전쟁의 흔적. 안쪽에 누군가의 이름이 새겨져 있지만 읽을 수 없다.' },
  oldPot: { name: '고대 토기', biome: 'ruins', icon: 'pot', text: '폐허 도시가 번성하던 때의 그릇. 바닥에 탑 문양이 찍혀 있다.' },
  dragonFossil: { name: '용 비늘 화석', biome: 'volcano', icon: 'fossil', text: '돌이 된 용의 비늘. 아직도 손끝이 따뜻하다.' },
  frozenQuill: { name: '얼어붙은 깃펜', biome: 'snow', icon: 'quill', text: '마탑의 마법사가 떨어뜨린 깃펜. 잉크가 얼어 있다.' },
  pirateCompass: { name: '해적의 나침반', biome: 'coast', icon: 'compass', text: '바늘이 북쪽이 아니라 바다 한가운데를 가리킨다. 용궁 쪽이다.' },
  starStone: { name: '별 모양 돌', biome: 'mountains', icon: 'star', text: '하늘에서 떨어진 돌. 밤이 되면 희미하게 빛난다.' },
  raptorClaw: { name: '랩터 발톱 화석', biome: 'jungle', icon: 'claw', text: '지금의 랩터보다 훨씬 큰 발톱. 태고의 둥지에 사는 이들의 조상일지도.' },
  boneFlute: { name: '뼈 피리', biome: 'graveyard', icon: 'flute', text: '불면 묘지의 안개가 잠시 걷힌다고 한다.' },
  mossDoll: { name: '이끼 낀 인형', biome: 'forest', icon: 'doll', text: '엘프 아이의 장난감. 세계수의 잎으로 만든 옷을 입고 있다.' },
  witchRing: { name: '늪 마녀의 반지', biome: 'swamp', icon: 'ring', text: '끼면 개구리 울음소리가 들린다. 빼는 게 좋겠다.' },
  sandIdol: { name: '모래 우상', biome: 'wasteland', icon: 'idol', text: '투기장의 오크들이 섬기던 작은 우상. 이빨 자국이 나 있다.' },
  lakeMirror: { name: '거울 호수의 조각', biome: 'lake', icon: 'mirror', text: '물처럼 일렁이는 거울 조각. 비춰 보면 하늘이 거꾸로 보인다.' },
  towerKey: { name: '탑의 녹슨 열쇠', biome: 'tower', icon: 'key', text: '각인의 탑 문양이 새겨진 열쇠. 어느 문에 맞는지는 아직 모른다.' },
};
// 땅 파기 결과 [물건, 가중치] — 지역에 따라 몇 가지가 더 붙는다
export const DIG_BASE = [['worm', 30], ['clay', 16], ['stone', 14], ['oldCoin', 6], ['seed', 5], ['gem', 1.5], ['artifact', 4]];
export const DIG_BIOME = { forest: [['truffle', 6]], graveyard: [['bone', 18]], coast: [['shell', 14], ['pearl', 0.6]], volcano: [['obsidian', 4]], snow: [['frostLily', 3]], swamp: [['worm', 15]] };

// ── 대장간: 만들 수 있는 장비 (장비 정보는 items.js 의 forged) ──
export const FORGE = [
  { id: 'copperDagger', mats: { copperOre: 4, wood: 2 }, gold: 30 },
  { id: 'copperSword', mats: { copperOre: 6, wood: 2 }, gold: 40 },
  { id: 'copperMail', mats: { copperOre: 8, clay: 2 }, gold: 45 },
  { id: 'huntersBow', mats: { hardwood: 4, wood: 4 }, gold: 60 },
  { id: 'ironSword', mats: { ironOre: 6, hardwood: 1, coal: 2 }, gold: 90 },
  { id: 'ironWaraxe', mats: { ironOre: 8, hardwood: 2, coal: 2 }, gold: 110 },
  { id: 'ironPlate', mats: { ironOre: 10, coal: 3 }, gold: 130 },
  { id: 'silverRapier', mats: { silverOre: 6, ironOre: 2 }, gold: 160 },
  { id: 'crystalStaff', mats: { manaCrystal: 5, hardwood: 2 }, gold: 180 },
  { id: 'rubyRing', mats: { ruby: 1, goldOre: 2 }, gold: 120 },
  { id: 'sapphireRing', mats: { sapphire: 1, silverOre: 2 }, gold: 120 },
  { id: 'emeraldAmulet', mats: { emerald: 1, goldOre: 2 }, gold: 120 },
  { id: 'coralTrident', mats: { coral: 6, silverOre: 4, pearl: 1 }, gold: 220 },
  { id: 'obsidianBlade', mats: { obsidian: 8, ironOre: 4, coal: 4 }, gold: 260 },
  { id: 'starTome', mats: { manaCrystal: 4, starflower: 2, hardwood: 2 }, gold: 300 },
];
// 무기 강화 (단계마다 모든 피해 +6%, 최대 5단계). 인덱스 = 올릴 단계 - 1
export const REINFORCE = [
  { mats: { copperOre: 4, coal: 1 }, gold: 30 },
  { mats: { ironOre: 5, coal: 2 }, gold: 80 },
  { mats: { silverOre: 5, coal: 3 }, gold: 160 },
  { mats: { goldOre: 4, coal: 4 }, gold: 280 },
  { mats: { manaCrystal: 4, obsidian: 2 }, gold: 450 },
];
export const REINFORCE_MAX = 5;

// ── 잡화점: 파는 것 · 시세 (1시간마다 종류별로 값이 오르내리고, 두 가지는 인기 상품 ×1.8) ──
export const SHOP_STOCK = ['potion1', 'potion2', 'potion3', 'turnipSeed', 'wheatSeed', 'carrotSeed', 'potatoSeed', 'strawberrySeed', 'pumpkinSeed', 'worm'];
export const SCROLL_SHOP = ['scroll_breath', 'scroll_return', 'scroll_teleport', 'scroll_light', 'scroll_haste', 'scroll_reveal']; // 마탑에서 판다
export const buyPrice = (id) => (GOODS[id].cat === 'seed' ? Math.round(CROPS[GOODS[id].crop].seedPrice * 1.5) : Math.max(3, GOODS[id].price * 3));
const SELL_CATS = ['ore', 'gem', 'wood', 'forage', 'dig', 'fish', 'crop', 'junk', 'bait', 'seed'];
export function market(now = Date.now()) {
  const win = Math.floor(now / 3600000);
  let r = (win * 2654435761) >>> 0;
  const rnd = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r / 4294967296; };
  const mul = {};
  for (const c of SELL_CATS) mul[c] = Math.round((0.8 + rnd() * 0.45) * 100) / 100;
  const pool = Object.keys(GOODS).filter((id) => ['fish', 'crop', 'ore', 'forage', 'gem'].includes(GOODS[id].cat) && !CROPS[id]?.rare);
  const hot = [];
  while (hot.length < 2) { const id = pool[Math.floor(rnd() * pool.length)]; if (!hot.includes(id)) hot.push(id); }
  return { win, mul, hot, nextIn: (win + 1) * 3600000 - now };
}
export const SELL_BONUS = { v: 1 }; // 숙련 「흥정」이면 1.1
export function sellPrice(id, mk = market()) {
  const g = GOODS[id];
  if (!g || !g.price) return 0;
  return Math.max(1, Math.round(g.price * 0.6 * SELL_BONUS.v * (mk.mul[g.cat] || 1) * (mk.hot.includes(id) ? 1.8 : 1))); // 파는 값은 원래의 60%
}

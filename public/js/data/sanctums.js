// 종족 성지: 성물을 바치면 축복이 쌓인다 (5단계). 어느 종족이든 모든 성지의 축복을 받을 수 있고, 내 종족의 성지는 힘이 1.5배.
// 단계가 오를수록 드는 성물이 늘지만(1·2·3·4·5개) 오르는 힘은 훨씬 커진다(누적 1·3·6·11·18) → 여러 곳을 조금씩보다 한 곳에 집중하는 쪽이 강하다.
// 성물: 그 지역 바깥에 숨겨진 2개 + 그 땅 지하 우두머리를 처음 잡으면 1개, 나머지는 '성물 조각' 5개를 모아 만든다.
// 조각은 그 성지의 땅(바깥 지역의 몬스터 · 지하 던전의 몬스터와 우두머리)에서만 나온다.

export const SANCTUMS = {
  wizard: { name: '마탑', place: '서리 설원', biome: 'snow', dungeon: '얼음 동굴', keeper: '마탑지기 엘리아', relic: '마력 결정', color: '#b58aff', unit: { mag: 1, spi: 1 },
    perk: { text: '스킬 재사용 대기 -10%', effects: [{ type: 'mul', key: 'skillCdMul', v: 0.9 }] }, treasure: 'starOrb',
    lore: ['눈보라 너머 우뚝 선 이 탑에서, 마법사들은 별의 흐름을 읽어 왔다.', '마력 결정은 설원 곳곳에 흩어져 있다. 얼음 동굴 깊은 곳의 서리 마녀도 하나를 품고 있지.'] },
  elf: { name: '세계수', place: '이끼 숲', biome: 'forest', dungeon: '이끼 동굴', keeper: '세계수의 무녀 루미', relic: '세계수의 씨앗', color: '#7be38a', unit: { mag: 1, agi: 1 },
    perk: { text: '자연 회복 · 초당 최대 체력의 0.5%', effects: [{ type: 'add', key: 'regen', v: 0.005 }] }, treasure: 'worldLeaf',
    lore: ['이 나무는 섬보다 오래 살았다. 엘프는 모두 이 나무 아래에서 태어난다.', '세계수의 씨앗은 숲 곳곳으로 흩어졌다. 이끼 동굴의 가면 족장이 하나를 훔쳐 갔다고 들었다.'] },
  knight: { name: '무너진 왕성', place: '꽃바람 들판', biome: 'meadow', dungeon: '왕성 지하 감옥', keeper: '마지막 근위병 하겐', relic: '왕가의 문장', color: '#ffd76a', unit: { vit: 1, pres: 1 },
    perk: { text: '받는 피해 -10%', effects: [{ type: 'mul', key: 'dmgTakenMul', v: 0.9 }] }, treasure: 'royalCrest',
    lore: ['왕은 떠났고 성은 무너졌지만, 맹세는 남았다.', '왕가의 문장이 들판에 흩어졌다. 성 지하 감옥의 타락한 기사가 마지막 하나를 지키고 있다.'] },
  orc: { name: '황야의 투기장', place: '메마른 황야', biome: 'wasteland', dungeon: '황야의 구멍', keeper: '투기장 주인 그롬', relic: '투사의 이빨', color: '#ff7a5a', unit: { str: 1, vit: 1 },
    perk: { text: '모든 피해 +10%', effects: [{ type: 'mul', key: 'dmgMul', v: 1.1 }] }, treasure: 'championHorn',
    lore: ['여기서는 강한 자가 말한다. 약한 자는 듣는다.', '황야의 투사들이 남긴 이빨을 찾아라. 황야의 구멍 아래 오크 족장도 하나를 목에 걸고 있다.'] },
  undead: { name: '잿빛 영묘', place: '그림자 묘지', biome: 'graveyard', dungeon: '지하 묘지', keeper: '영묘지기 모르', relic: '봉인된 유골', color: '#c45cff', unit: { mag: 1, mres: 1 },
    perk: { text: '흡혈 +5%', effects: [{ type: 'stat', stat: 'lifesteal', v: 5 }] }, treasure: 'lichCrown',
    lore: ['죽음은 끝이 아니다. 잠시 쉬는 것일 뿐.', '봉인된 유골은 묘지 곳곳에 묻혀 있다. 지하 묘지의 묘지기가 가장 오래된 것을 지킨다.'] },
  assassin: { name: '그림자 길드', place: '폐허 도시', biome: 'ruins', dungeon: '잊힌 미궁', keeper: '길드장 녹턴', relic: '그림자 인장', color: '#8a6aff', unit: { agi: 1, sen: 1 },
    perk: { text: '치명타 확률 +8%', effects: [{ type: 'add', key: 'crit', v: 0.08 }] }, treasure: 'shadowSeal',
    lore: ['…들어왔다는 건, 길을 아는 자라는 뜻이군.', '그림자 인장이 폐허에 흩어져 있다. 잊힌 미궁의 군주가 하나를 삼켰다더군.'] },
  dino: { name: '태고의 둥지', place: '원시림', biome: 'jungle', dungeon: '원시림의 구멍', keeper: '둥지 장로 크라', relic: '태고의 알 조각', color: '#9be15d', unit: { str: 1, agi: 1 },
    perk: { text: '이동 속도 +10%', effects: [{ type: 'mul', key: 'moveSpeed', v: 1.1 }] }, treasure: 'primalFang',
    lore: ['우리 조상은 이 둥지에서 처음 눈을 떴다.', '태고의 알 조각을 찾아오너라. 원시림의 구멍 아래 우두머리 랩터가 하나를 품고 있다.'] },
  dragon: { name: '홍염 분화구', place: '화산 지대', biome: 'volcano', dungeon: '균열 동굴', keeper: '용족 원로 이그니', relic: '용린', color: '#ff8a3a', unit: { str: 1, mag: 1 },
    perk: { text: '화상 피해 +30%', effects: [{ type: 'mul', key: 'burnMul', v: 1.3 }] }, treasure: 'dragonHeart',
    lore: ['불은 우리를 낳았고, 우리는 불을 지킨다.', '용린은 화산 곳곳에 떨어져 있다. 균열 동굴의 수호자가 가장 큰 것을 지닌다.'] },
};
export const SANCTUM_MAX = 5;
export const TIER_COST = [1, 2, 3, 4, 5];        // n+1단계로 오를 때 바치는 성물 수 (인덱스 = 지금 단계)
export const TIER_UNITS = [0, 1, 3, 6, 11, 18];  // 단계별 누적 축복 (한 단위 = 능력치 +1)
export const PERK_TIER = 3, TREASURE_TIER = 5, OWN_MUL = 1.5, SHARDS_PER_RELIC = 5;
// 바깥 지역(지역 id) → 그 땅의 성지
export const BIOME_SANCTUM = Object.fromEntries(Object.entries(SANCTUMS).map(([race, s]) => [s.biome, race]));
const STAT_NAME = { str: '근력', mag: '마력', agi: '민첩', vit: '체력', sen: '감각', spi: '정신', pres: '물리 저항', mres: '마법 저항' };

// 한 성지의 단계만큼 오르는 능력치 (own: 내 종족의 성지면 1.5배)
export function sanctumStats(race, tier, own) {
  const s = SANCTUMS[race], out = {};
  if (!s || !tier) return out;
  const units = TIER_UNITS[Math.min(SANCTUM_MAX, tier)] * (own ? OWN_MUL : 1);
  for (const [k, v] of Object.entries(s.unit)) out[k] = Math.round(v * units);
  return out;
}
// 받은 모든 성지의 능력치 · 은총 효과를 합친다
export function allSanctums(lo) {
  const stats = {}, effects = [];
  for (const [race, tier] of Object.entries(lo.sanctum || {})) {
    if (!SANCTUMS[race] || !tier) continue;
    for (const [k, v] of Object.entries(sanctumStats(race, tier, race === lo.race))) stats[k] = (stats[k] || 0) + v;
    if (tier >= PERK_TIER) effects.push(...SANCTUMS[race].perk.effects);
  }
  return { stats, effects };
}
export function sanctumBonusText(race, tier, own) {
  const st = sanctumStats(race, tier, own);
  return Object.entries(st).map(([k, v]) => `${STAT_NAME[k]} +${v}`).join(' · ') || '없음';
}

// ───── 성지 마을: 우두머리 · 주민 · 날아다니는 것 · 전용 의뢰 · 친밀도 · 수련 ─────
// 친밀도: 의뢰 · 선물 · 수련으로 오른다. 단계마다 보상이 하나씩 열린다
// 종족 상점: 그 종족의 손을 거친 물건 (그 땅의 재료 · 약 · 주문서) + 그 종족 클래스의 무기
// 다른 종족은 친밀도 「친구」부터 무기를 살 수 있고, 값은 30% 더 비싸다
export const RACE_SHOP = {
  wizard: ['manaCrystal', 'scroll_reveal', 'scroll_teleport', 'potion2', 'sapphire'],
  elf: ['herb', 'spiritStone', 'potion1', 'emerald', 'truffle'],
  knight: ['ironOre', 'potion2', 'potion3', 'silverOre', 'scroll_return'],
  orc: ['beastMeat', 'orcTusk', 'potion1', 'ironOre', 'hyenaFang'],
  undead: ['bone', 'soulDust', 'boneShard', 'scroll_light', 'potion2'],
  assassin: ['poisonGland', 'scroll_haste', 'banditCloth', 'potion1', 'oldCoin'],
  dino: ['beastMeat', 'raptorClaw', 'berry', 'waspSting', 'potion1'],
  dragon: ['obsidian', 'fireBloom', 'emberDust', 'ruby', 'magmaCore'],
};
export const AFF_LV = [0, 40, 110, 220, 380]; // 친구가 되기는 쉽지 않다 (예전 0 · 20 · 50 · 90 · 150)
export const AFF_NAME = ['낯선 이', '아는 사이', '친구', '동료', '가족'];
export const AFF_REWARD = [null, '환영 선물 (그 땅의 물건 · 골드 150)', '수련 한도 5 → 10단계', '우두머리가 하루 한 번 성물 조각을 준다', '종족의 증표 (장신구)'];
export const affLevel = (pts) => { let l = 0; for (let i = 0; i < AFF_LV.length; i++) if ((pts || 0) >= AFF_LV[i]) l = i; return l; };
// 수련 한도: 친밀도 「친구」부터 10단계. 내 종족의 성지는 5단계 더 (같은 핏줄이라 더 깊이 배운다)
export const OWN_TRAIN_CAP = 5, OWN_TRAIN_EASE = 1;
export const trainCap = (affLv, own = false) => (affLv >= 2 ? 10 : 5) + (own ? OWN_TRAIN_CAP : 0);
// 수련 내용: 단계(rank = 지금까지 이긴 수)가 오를수록 빡빡해진다. 내 종족이면 두 단계 쉬운 난이도로 치른다
export function trainSpec(race, rank, own = false) {
  const L = SANCT_LIFE[race]?.train;
  if (!L) return null;
  const e = Math.max(0, Math.round(2 + (rank || 0) * 1.4 - (own ? OWN_TRAIN_EASE : 0))), S = { ...L, eff: e }, r1 = (v) => Math.round(v * 10) / 10; // 처음부터 빡빡하고 단계마다 더 가파르게
  switch (L.mode) {
    case 'order': { // 마탑: 번호 순서대로 (틀리면 시간을 잃는다)
      S.set = Math.min(6, 3 + Math.floor(e / 3)); S.n = S.set * (3 + Math.floor(e / 5)); S.time = Math.round(S.n * Math.max(1.35, 3 - e * 0.12)); S.penalty = 2;
      S.desc = `${S.time}초 안에 룬석 ${S.n}개를 번호 순서대로 맞힌다. 한 번에 ${S.set}개씩 떠오르고, 순서가 틀리면 ${S.penalty}초를 잃는다.`; break;
    }
    case 'slide': { // 세계수 숲: 좌우로 미끄러지는 과녁
      S.n = 8 + e; S.time = Math.max(16, Math.round(30 - e * 0.9)); S.amp = Math.min(44, 14 + e * 2.2); S.speed = r1(0.9 + e * 0.2);
      S.desc = `${S.time}초 안에 좌우로 움직이는 과녁 ${S.n}개를 맞힌다. 과녁은 ${Math.round(S.amp)}칸 너비로 오가고, 단계가 오를수록 빠르다 (빠르기 ×${r1(S.speed / 0.9)}).`; break;
    }
    case 'guard': { // 왕성: 방패를 든 허수아비는 피해가 조금만 들어간다
      S.time = 20; S.needMul = r1(16 + e * 2.4); S.sw = e >= 2 ? r1(Math.max(1.8, 4.2 - e * 0.18)) : 0;
      S.desc = `20초 동안 근위대 허수아비 두 개에 피해를 넣는다 (내 공격력 ×${S.needMul}).${S.sw ? ` 방패를 든 쪽은 피해가 15%만 들어가고, 방패는 ${S.sw}초마다 다른 허수아비로 옮겨 간다.` : ''}`; break;
    }
    case 'arena': { // 투기장: 갈수록 여럿이 세게 덤비고, 마지막엔 챔피언
      S.n = 8 + e; S.live = Math.min(5, 2 + Math.floor(e / 3)); S.time = Math.max(30, Math.round(S.n * 4.4 - e * 0.6)); S.hpMul = r1(2.2 + e * 0.3); S.atkMul = 0.06 + e * 0.014; S.champion = e >= 3;
      S.desc = `${S.time}초 안에 수련 투사 ${S.n}명을 쓰러뜨린다. 한 번에 ${S.live}명씩 덤비고${S.champion ? ', 마지막엔 투기장 챔피언(체력 3배)이 나온다' : ''}. 투사는 단계마다 단단해진다.`; break;
    }
    case 'revive': { // 납골당: 쓰러진 해골이 뼈 무더기가 되었다가 다시 일어난다
      S.n = 8 + e; S.live = Math.min(5, 2 + Math.floor(e / 4)); S.time = Math.max(30, Math.round(S.n * 4.4 - e * 0.5)); S.revive = Math.min(0.9, 0.3 + e * 0.06); S.boneT = r1(Math.max(1.4, 3 - e * 0.1)); S.hpMul = r1(2 + e * 0.22); S.atkMul = 0.06 + e * 0.01;
      S.desc = `${S.time}초 안에 수련 해골 ${S.n}구를 완전히 쓰러뜨린다. 쓰러진 해골의 ${Math.round(S.revive * 100)}%는 뼈 무더기가 되어 ${S.boneT}초 뒤 다시 일어난다 — 그 전에 한 번 더 치면 끝난다.`; break;
    }
    case 'decoy': { // 그림자 길드: 금방 사라지는 과녁 · 붉은 눈은 가짜
      S.n = 10 + e; S.time = Math.max(18, Math.round(S.n * 2.6 - e * 0.5)); S.life = r1(Math.max(1.6, 4 - e * 0.18)); S.decoy = Math.min(0.45, 0.12 + e * 0.03); S.penalty = 2;
      S.desc = `${S.time}초 안에 그림자 과녁 ${S.n}개를 맞힌다. 과녁은 ${S.life}초 뒤 사라지고, 붉은 눈(${Math.round(S.decoy * 100)}%)은 가짜다 — 치면 ${S.penalty}초를 잃는다.`; break;
    }
    case 'flee': { // 거대 둥지: 달아나는 랩터를 쫓아 잡는다
      S.n = 6 + e; S.live = Math.min(4, 2 + Math.floor(e / 4)); S.time = Math.max(28, Math.round(S.n * 5.2 - e * 0.8)); S.speed = 44 + e * 5; S.hpMul = r1(1.6 + e * 0.2);
      S.desc = `${S.time}초 안에 달아나는 수련 랩터 ${S.n}마리를 잡는다. 랩터는 나를 피해 수련장을 돌며, 단계가 오를수록 빠르다 (초당 ${S.speed}칸). 얼리거나 묶으면 멈춘다.`; break;
    }
    case 'keepLit': { // 용의 둥지: 화로를 모두 한꺼번에 타오르게
      S.k = Math.min(6, 3 + Math.floor(e / 3)); S.burn = r1(Math.max(2.6, 8 - e * 0.4)); S.time = Math.max(18, Math.round(32 - e * 0.8)); S.n = S.k;
      S.desc = `${S.time}초 안에 화로 ${S.k}개가 한꺼번에 타오르게 한다. 화로는 치면 불이 붙고, ${S.burn}초면 꺼진다.`; break;
    }
  }
  return S;
}
export const GIFT_AFF = 2, GIFTS_PER_DAY = 2, TRAIN_AFF = 3, TRAINS_PER_DAY = 2;
// 수련 단계마다 그 종족의 능력치(축복 한 단위와 같은 것)가 1씩 오른다
export function trainStats(lo) {
  const out = {};
  for (const [race, rank] of Object.entries(lo.train || {})) {
    const s = SANCTUMS[race];
    if (!s || !rank) continue;
    for (const [k, v] of Object.entries(s.unit)) out[k] = (out[k] || 0) + v * rank;
  }
  return out;
}
// 성지 기록 (저장의 story.sanct[race])
export function sanctState(story, race) {
  story.sanct ||= {};
  return (story.sanct[race] ||= { aff: 0, step: 0, cur: null, train: 0, trainDay: -1, trainToday: 0, giftDay: -1, gifts: 0, shardDay: -1, welcome: false, token: false });
}

// look: 찾는 물건 그림 · 과녁 그림, act: 주민이 하는 일, at: 성지 문 앞(가운데 아래)에서의 칸 위치
export const SANCT_LIFE = {
  wizard: {
    leader: { name: '대현자 오르비스', base: 'wizzard_m', tint: 'hue-rotate(205deg) saturate(1.2) brightness(1.08)', crown: 'hat', cape: '#4a2a9a', hi: '#c9a8ff',
      lines: ['별은 거짓말을 하지 않는다. 사람만이 거짓말을 하지.', '마탑의 문은 배우려는 자에게 늘 열려 있다네.', '자네의 마력, 아직 덜 여물었군. 그래도 빛은 곧다.'] },
    house: 'mage', ambient: 'runes',
    residents: [
      { name: '견습 마법사 미라', base: 'wizzard_f', act: 'caster', at: [-6, 5], face: -1, prop: 'runeCrystal', pat: [-11, 5] },
      { name: '견습 마법사 토비', base: 'wizzard_m', tint: 'hue-rotate(120deg)', act: 'caster', at: [6, 5], face: 1, prop: 'runeCrystal', pat: [11, 5] },
      { name: '서고지기 벨라', base: 'wizzard_f', tint: 'hue-rotate(260deg)', act: 'read', at: [-9, 10], face: 1, prop: 'lectern', pat: [-7, 10] },
      { name: '별지기 하멜', base: 'wizzard_m', tint: 'grayscale(0.5) brightness(1.15)', act: 'stargaze', at: [9, 10], face: -1, prop: 'telescope', pat: [11, 10] },
    ],
    talk: ['룬석에 불꽃을 맞히는 연습 중이에요. 아직 반은 빗나가지만요.', '마탑 꼭대기 구슬은 백 년째 떠 있대요.', '책을 빌려 가실 거면 접지 말고 돌려주세요.', '오늘 밤은 별이 낮게 떠요. 좋은 징조죠.'],
    likes: ['manaCrystal', 'starflower', 'sapphire'],
    quests: [
      { id: 'wiz1', kind: 'kill', targets: ['iceShaman', 'frostSlug', 'snowLurker'], n: 8, title: '별빛을 가리는 자들', text: '얼음 주술사들이 눈보라를 불러 마탑의 별빛을 가린다. 설원에서 얼음 주술사 · 서리 민달팽이 · 눈 속 매복자 8마리를 물리쳐 다오.', reward: { gold: 150, aff: 15 } },
      { id: 'wiz2', kind: 'bring', item: 'manaCrystal', n: 3, title: '마력 수정', text: '연구에 쓸 마력 수정이 바닥났다. 바위산이나 동굴에서 캐어 3개만 구해 와 주겠나?', reward: { gold: 200, aff: 15, goods: { sapphire: 1 } } },
      { id: 'wiz3', kind: 'find', n: 3, look: 'runePage', title: '날아간 별의 책장', text: '눈보라에 별의 책장 세 장이 날아갔다. 설원 어딘가에서 푸르게 빛나고 있을 게다.', reward: { gold: 250, aff: 20 } },
    ],
    daily: { kind: 'kill', targets: ['frostWolf', 'glassSpider', 'iceShaman', 'frostSlug', 'snowLurker', 'iceGolem'], n: 8, title: '설원 순찰', text: '오늘도 설원의 짐승들이 탑 가까이 내려왔다. 8마리만 쫓아내 다오.', reward: { gold: 80, aff: 8 } },
    train: { name: '룬석 순서 맞히기', kind: 'targets', mode: 'order', look: 'rune' },
    token: 'tokenWizard',
  },
  elf: {
    leader: { name: '엘프 여왕 실바니엘', base: 'elf_f', tint: 'brightness(1.1) saturate(1.1)', crown: 'tiara', cape: '#2e7a3a', hi: '#bfffc8',
      lines: ['세계수의 그늘에 온 것을 환영한다, 바람의 아이여.', '숲은 기억한다. 누가 꺾고, 누가 심었는지.', '정령들이 너를 반기는구나. 드문 일이지.'] },
    house: 'elf', ambient: 'spirits',
    residents: [
      { name: '궁수 리엔', base: 'elf_m', act: 'archer', at: [-6, 6], face: -1, prop: 'archTarget', pat: [-14, 6] },
      { name: '궁수 아엘', base: 'elf_f', act: 'archer', at: [-6, 9], face: -1, prop: 'archTarget', pat: [-14, 9] },
      { name: '정령지기 피오', base: 'elf_m', tint: 'hue-rotate(60deg)', act: 'tend', at: [7, 6], face: 1, prop: 'flowerBed', pat: [9, 7] },
      { name: '꼬마 엘프 니나', base: 'elf_f', tint: 'brightness(1.15)', act: 'wander', at: [5, 10], small: true },
    ],
    talk: ['과녁 한가운데를 맞히면 정령이 웃어요. 정말이에요!', '세계수의 이슬은 아침에만 맺혀요.', '숲에서 길을 잃으면 반딧불을 따라가세요.', '활시위는 숨을 내쉴 때 놓는 거예요.'],
    likes: ['herb', 'berry', 'starflower'],
    quests: [
      { id: 'elf1', kind: 'kill', targets: ['goblin', 'goblinShaman'], n: 10, title: '숲을 어지럽히는 고블린', text: '고블린들이 어린 나무를 베어 불을 지핀다. 숲에서 고블린 · 고블린 주술사 10마리를 쫓아내 다오.', reward: { gold: 120, aff: 15 } },
      { id: 'elf2', kind: 'bring', item: 'herb', n: 8, title: '세계수에 바칠 약초', text: '세계수의 뿌리가 지쳐 있다. 약초 8포기를 모아 오면 뿌리에 덮어 주겠다.', reward: { gold: 150, aff: 15, goods: { berry: 3 } } },
      { id: 'elf3', kind: 'find', n: 3, look: 'lostSpirit', title: '길 잃은 꼬마 정령', text: '꼬마 정령 셋이 놀다가 숲에서 길을 잃었다. 초록빛으로 깜빡이는 것을 찾으면 말을 걸어 다오.', reward: { gold: 220, aff: 20 } },
    ],
    daily: { kind: 'kill', targets: ['goblin', 'goblinShaman', 'caveLurker', 'bat'], n: 8, title: '숲 지키기', text: '오늘도 숲을 해치는 것들이 들어왔다. 8마리만 물리쳐 다오.', reward: { gold: 70, aff: 8 } },
    train: { name: '움직이는 과녁', kind: 'targets', mode: 'slide', look: 'archery' },
    token: 'tokenElf',
  },
  knight: {
    leader: { name: '왕녀 아델하이트', base: 'knight_f', tint: 'brightness(1.12)', crown: 'crown', cape: '#2a4a9a', hi: '#ffe8a0',
      lines: ['왕국은 무너졌어도, 맹세는 아직 서 있어요.', '이 성벽을 다시 쌓는 날, 당신 이름도 새길게요.', '검은 지키라고 드는 거예요. 잊지 마세요.'] },
    house: 'knight', ambient: 'doves',
    residents: [
      { name: '기사 로렌', base: 'knight_m', act: 'spar', at: [-4, 7], face: 1, pair: 1 },
      { name: '기사 브리트', base: 'knight_f', act: 'spar', at: [-1, 7], face: -1, pair: 0 },
      { name: '종자 핀', base: 'knight_m', tint: 'brightness(1.2) saturate(0.8)', act: 'smith', at: [8, 6], face: -1, prop: 'anvil', pat: [6, 6] },
      { name: '파수꾼 오스', base: 'knight_m', tint: 'hue-rotate(20deg)', act: 'patrol', at: [9, 11], face: 1 },
    ],
    talk: ['한 번 더! 이번엔 방패를 낮추지 않을게.', '왕녀님은 매일 아침 성벽을 한 바퀴 도세요.', '갑옷은 닦을수록 가벼워져요. 기분 탓이지만요.', '저 탑의 깃발, 제가 다시 달았어요.'],
    likes: ['ironOre', 'wheat', 'ruby'],
    quests: [
      { id: 'kni1', kind: 'kill', targets: ['goblin', 'mudLurker', 'slime'], n: 10, title: '들판의 약탈자', text: '들판의 마을 길에 고블린과 진흙 매복자가 들끓어요. 10마리만 쫓아 주세요.', reward: { gold: 120, aff: 15 } },
      { id: 'kni2', kind: 'bring', item: 'ironOre', n: 5, title: '갑옷 수선', text: '근위대 갑옷이 녹슬었어요. 철광석 5개면 다시 두드려 쓸 수 있어요.', reward: { gold: 180, aff: 15, goods: { ruby: 1 } } },
      { id: 'kni3', kind: 'find', n: 3, look: 'oldShield', title: '흩어진 근위대 방패', text: '왕성이 무너지던 날, 근위대 방패 셋이 들판에 버려졌어요. 찾아 주시겠어요?', reward: { gold: 240, aff: 20 } },
    ],
    daily: { kind: 'kill', targets: ['goblin', 'slime', 'mudLurker'], n: 8, title: '들판 순찰', text: '오늘의 순찰이에요. 들판의 무리 8마리.', reward: { gold: 70, aff: 8 } },
    train: { name: '방패 허수아비', kind: 'damage', mode: 'guard', look: 'post' },
    token: 'tokenKnight',
  },
  orc: {
    leader: { name: '대족장 우르가쉬', base: 'orc_warrior', tint: 'hue-rotate(-15deg) saturate(1.3)', crown: 'horns', cape: '#8a2a1a', hi: '#ffb08a', big: true,
      lines: ['크하하! 작지만 눈빛은 살아 있군!', '투기장에서는 말이 아니라 주먹이 말한다.', '오늘 쓰러져도 내일 일어나면 진 게 아니다.'] },
    house: 'orc', ambient: 'vultures',
    residents: [
      { name: '투사 그락', base: 'orc_warrior', act: 'spar', at: [-4, 7], face: 1, pair: 1 },
      { name: '투사 모르가', base: 'masked_orc', act: 'spar', at: [-1, 7], face: -1, pair: 0 },
      { name: '북잡이 둠', base: 'orc_shaman', act: 'drum', at: [7, 6], face: -1, prop: 'warDrum', pat: [5, 6] },
      { name: '사냥꾼 카르', base: 'orc_warrior', tint: 'hue-rotate(30deg)', act: 'wander', at: [8, 11] },
    ],
    talk: ['둥! 둥! 북소리가 멈추면 싸움도 멈춘다!', '어제는 졌다. 오늘은 안 진다.', '황야의 하이에나는 이빨이 제일 맛있다… 장식으로.', '족장님 주먹은 바위도 쪼갠다.'],
    likes: ['beastMeat', 'hyenaFang', 'orcTusk'],
    quests: [
      { id: 'orc1', kind: 'kill', targets: ['hyena', 'sandScorpion'], n: 10, title: '황야의 하이에나', text: '하이에나 떼가 투기장 고기를 훔쳐 간다. 하이에나 · 모래 전갈 10마리를 잡아 와라!', reward: { gold: 130, aff: 15 } },
      { id: 'orc2', kind: 'bring', item: 'hyenaFang', n: 5, title: '투사의 장식', text: '새 투사에게 걸어 줄 이빨 목걸이를 만든다. 하이에나 이빨 5개!', reward: { gold: 170, aff: 15, goods: { beastMeat: 3 } } },
      { id: 'orc3', kind: 'find', n: 3, look: 'warBanner', title: '빼앗긴 전투 깃발', text: '약탈자들이 투기장 깃발 셋을 훔쳐 황야에 꽂아 놨다. 되찾아 와라!', reward: { gold: 240, aff: 20 } },
    ],
    daily: { kind: 'kill', targets: ['hyena', 'sandScorpion', 'orcRaider'], n: 8, title: '오늘의 사냥', text: '오늘 밤 잔치에 쓸 사냥감 8마리!', reward: { gold: 80, aff: 8 } },
    train: { name: '투기장 버티기', kind: 'waves', mode: 'arena', foe: 'orcRaider' },
    token: 'tokenOrc',
  },
  undead: {
    leader: { name: '망자의 왕 모르데카이', base: 'necromancer', tint: 'hue-rotate(80deg) brightness(1.1)', crown: 'crown', cape: '#3a1a4a', hi: '#d8a8ff',
      lines: ['산 자가 이곳을 찾다니… 재미있군.', '죽음은 끝이 아니다. 기다림일 뿐.', '등불이 꺼지지 않는 한, 우리는 잊히지 않는다.'] },
    house: 'undead', ambient: 'wisps',
    residents: [
      { name: '묘지기 그레이', base: 'skelet', act: 'dig', at: [-7, 7], face: 1, prop: 'grave', pat: [-5, 7] },
      { name: '촛불지기 엘', base: 'necromancer', tint: 'hue-rotate(40deg)', act: 'read', at: [7, 6], face: -1, prop: 'candles', pat: [5, 6] },
      { name: '해골 병사 둘', base: 'skelet', act: 'patrol', at: [-8, 11], face: 1 },
      { name: '꼬마 망령 피피', base: 'tiny_zombie', act: 'wander', at: [6, 10] },
    ],
    talk: ['이 무덤은… 아직 비어 있습니다. 서두르지 마세요.', '촛불 하나에 이름 하나. 꺼지면 다시 켜요.', '덜그럭. (해골이 인사한다)', '저도 예전엔 사람이었대요. 기억은 안 나지만요.'],
    likes: ['bone', 'soulDust', 'mushroom'],
    quests: [
      { id: 'und1', kind: 'kill', targets: ['wraith', 'ghoul'], n: 8, title: '잠들지 못한 망령', text: '이름을 잃은 망령과 구울이 묘지를 헤맨다. 8마리를 잠재워 다오.', reward: { gold: 140, aff: 15 } },
      { id: 'und2', kind: 'bring', item: 'bone', n: 6, title: '흩어진 뼈', text: '흩어진 뼈를 모아 제자리에 묻어 주고 싶다. 오래된 뼈 6개.', reward: { gold: 160, aff: 15, goods: { soulDust: 2 } } },
      { id: 'und3', kind: 'find', n: 3, look: 'soulLantern', title: '꺼진 영혼 등불', text: '묘지 어딘가에 꺼진 영혼 등불 셋이 있다. 찾아서 다시 불을 붙여 다오.', reward: { gold: 240, aff: 20 } },
    ],
    daily: { kind: 'kill', targets: ['skeleton', 'wraith', 'ghoul', 'tinyCorpse', 'necroAcolyte'], n: 8, title: '묘지 정리', text: '오늘 밤도 무덤에서 기어 나온 것들이 있다. 8마리.', reward: { gold: 80, aff: 8 } },
    train: { name: '일어서는 해골', kind: 'waves', mode: 'revive', foe: 'skeleton' },
    token: 'tokenUndead',
  },
  assassin: {
    leader: { name: '그림자 여왕 세릴', base: 'hood_assassin', tint: 'hue-rotate(250deg) brightness(1.15)', crown: 'mask', cape: '#1a1424', hi: '#b8a0ff',
      lines: ['…용케 찾아왔군. 길을 아는 자는 드물지.', '그림자는 빛이 있어야 생긴다. 잊지 마.', '말이 많은 자는 오래 못 산다. 너는 괜찮아 보이는군.'] },
    house: 'assassin', ambient: 'crows',
    residents: [
      { name: '수련생 키라', base: 'hood_assassin', act: 'thrower', at: [-6, 6], face: -1, prop: 'knifeBoard', pat: [-12, 6] },
      { name: '수련생 반', base: 'hood_assassin', tint: 'hue-rotate(40deg)', act: 'thrower', at: [-6, 9], face: -1, prop: 'knifeBoard', pat: [-12, 9] },
      { name: '정보상 쥐잡이', base: 'hood_assassin', tint: 'sepia(0.6)', act: 'idle', at: [8, 7], face: -1, prop: 'crates', pat: [10, 7] },
      { name: '파수 그림자', base: 'hood_assassin', tint: 'brightness(0.8)', act: 'patrol', at: [7, 11], face: 1 },
    ],
    talk: ['…쉿. 과녁이 놀라잖아.', '칼은 던지는 게 아니라 보내는 거야.', '폐허 북쪽 우물엔 아무것도 없어. 정말로.', '정보가 필요하면 금화부터.'],
    likes: ['oldCoin', 'emerald', 'banditCloth'],
    quests: [
      { id: 'asn1', kind: 'kill', targets: ['bandit'], n: 8, title: '길드를 판 도적들', text: '길드를 배신한 도적들이 폐허에 숨어 있다. 8명.', reward: { gold: 140, aff: 15 } },
      { id: 'asn2', kind: 'bring', item: 'oldCoin', n: 5, title: '옛 왕국의 동전', text: '옛 동전 5닢. 땅을 파면 나온다더군. 이유는 묻지 마.', reward: { gold: 200, aff: 15, goods: { emerald: 1 } } },
      { id: 'asn3', kind: 'find', n: 3, look: 'stolenSeal', title: '도둑맞은 인장', text: '길드 인장 셋이 폐허에 흩어졌다. 보랏빛으로 반짝이는 것을 찾아라.', reward: { gold: 250, aff: 20 } },
    ],
    daily: { kind: 'kill', targets: ['bandit', 'imp', 'shieldDemon', 'goblinShaman'], n: 8, title: '그림자 의뢰', text: '오늘의 일거리. 폐허의 골칫거리 8.', reward: { gold: 80, aff: 8 } },
    train: { name: '그림자와 가짜', kind: 'targets', mode: 'decoy', look: 'shadow' },
    token: 'tokenAssassin',
  },
  dino: {
    leader: { name: '태고의 족장 라오르', base: 'lizard_m', tint: 'hue-rotate(-50deg) saturate(1.4) brightness(1.05)', crown: 'feathers', cape: '#5a7a2a', hi: '#d8ff9a', big: true,
      lines: ['크르르… 작은 것, 둥지에 온 걸 환영한다.', '알은 약하다. 그래서 우리는 강해야 한다.', '사냥은 배를 채우려고 한다. 자랑하려고 하지 않는다.'] },
    house: 'dino', ambient: 'pteros',
    residents: [
      { name: '알지기 시라', base: 'lizard_f', act: 'tend', at: [-6, 6], face: 1, prop: 'eggClutch', pat: [-8, 7] },
      { name: '사냥꾼 그릭', base: 'lizard_m', act: 'spar', at: [3, 7], face: 1, pair: 2 },
      { name: '사냥꾼 타오', base: 'lizard_m', tint: 'hue-rotate(40deg)', act: 'spar', at: [6, 7], face: -1, pair: 1 },
      { name: '새끼 도마뱀 쿠', base: 'lizard_f', tint: 'brightness(1.2)', act: 'wander', at: [-5, 11], small: true },
    ],
    talk: ['쉬잇, 알이 듣고 있어요.', '크르릉! (덤벼 보라는 뜻이다)', '원시림의 말벌은 알을 노려요. 조심하세요.', '족장님 깃털은 해마다 하나씩 늘어요.'],
    likes: ['beastMeat', 'raptorClaw', 'frogLeg'],
    quests: [
      { id: 'din1', kind: 'kill', targets: ['jungleWasp', 'bigBeetle'], n: 10, title: '알을 노리는 벌레들', text: '말벌과 딱정벌레가 둥지의 알을 노린다. 10마리.', reward: { gold: 130, aff: 15 } },
      { id: 'din2', kind: 'bring', item: 'beastMeat', n: 5, title: '새끼들 먹이', text: '새끼들이 배고프다. 짐승 고기 5덩이.', reward: { gold: 160, aff: 15, goods: { raptorClaw: 1 } } },
      { id: 'din3', kind: 'find', n: 3, look: 'lostEgg', title: '굴러간 알', text: '폭우에 알 셋이 원시림으로 굴러갔다. 따뜻한 알을 찾아 와 다오.', reward: { gold: 240, aff: 20 } },
    ],
    daily: { kind: 'kill', targets: ['raptor', 'jungleWasp', 'bigBeetle'], n: 8, title: '둥지 지키기', text: '오늘도 둥지 둘레를 어슬렁대는 것들이 있다. 8마리.', reward: { gold: 80, aff: 8 } },
    train: { name: '사냥 놀이', kind: 'waves', mode: 'flee', foe: 'raptor' },
    token: 'tokenDino',
  },
  dragon: {
    leader: { name: '용왕 이그니스', base: 'dragonkin', tint: 'saturate(1.3) brightness(1.08)', crown: 'crown', cape: '#8a1a10', hi: '#ffc080', big: true,
      lines: ['불의 아이여, 둥지의 열기를 견디는구나.', '불은 모든 것을 태우지만, 지킬 것도 비춘다.', '용의 말은 짧다. 그래서 무겁다.'] },
    house: 'dragon', ambient: 'drakes',
    residents: [
      { name: '용인 대장장이 카스', base: 'dragonkin', tint: 'hue-rotate(20deg)', act: 'smith', at: [-7, 6], face: 1, prop: 'anvil', pat: [-5, 6] },
      { name: '불씨지기 엠버', base: 'dragonkin', tint: 'hue-rotate(-20deg) brightness(1.1)', act: 'meditate', at: [6, 6], face: -1, prop: 'brazier', pat: [8, 6] },
      { name: '알지기 루비', base: 'dragonkin', tint: 'hue-rotate(40deg)', act: 'tend', at: [7, 10], face: -1, prop: 'eggClutch', pat: [9, 11] },
      { name: '새끼 용인 피크', base: 'dragonkin', tint: 'brightness(1.2)', act: 'wander', at: [-6, 11], small: true },
    ],
    talk: ['쇠는 용암보다 뜨거울 때 두드려야 해.', '불씨가 꺼지면 둥지가 식어요. 그래서 밤새 지켜요.', '알에서 소리가 나요! …아직 멀었대요.', '용왕님 비늘은 칼도 튕겨 낸대!'],
    likes: ['obsidian', 'fireBloom', 'ruby'],
    quests: [
      { id: 'drg1', kind: 'kill', targets: ['salamander', 'imp'], n: 10, title: '둥지를 넘보는 자들', text: '불도롱뇽과 임프가 알을 훔치러 온다. 10마리를 태워 버려라.', reward: { gold: 150, aff: 15 } },
      { id: 'drg2', kind: 'bring', item: 'obsidian', n: 4, title: '흑요석 비늘 닦기', text: '비늘을 닦을 흑요석이 필요하다. 4개.', reward: { gold: 200, aff: 15, goods: { ruby: 1 } } },
      { id: 'drg3', kind: 'find', n: 3, look: 'emberStone', title: '식어 버린 불씨 돌', text: '둥지를 데우던 불씨 돌 셋이 화산 지대로 굴러갔다. 붉게 숨 쉬는 돌을 찾아라.', reward: { gold: 250, aff: 20 } },
    ],
    daily: { kind: 'kill', targets: ['salamander', 'imp', 'magmaGolem', 'pumpkinFiend', 'chortShaman'], n: 8, title: '화산 순찰', text: '오늘도 둥지 아래가 소란하다. 8마리.', reward: { gold: 90, aff: 8 } },
    train: { name: '꺼지지 않는 화로', kind: 'keep', mode: 'keepLit', look: 'brazier' },
    token: 'tokenDragon',
  },
};
// 찾는 물건 이름
export const FIND_NAME = { runePage: '별의 책장', lostSpirit: '꼬마 정령', oldShield: '근위대 방패', warBanner: '전투 깃발', soulLantern: '영혼 등불', stolenSeal: '길드 인장', lostEgg: '굴러간 알', emberStone: '불씨 돌' };
// 맡은 의뢰의 정의 (이야기 의뢰 · 매일 의뢰)
export const sanctQuestDef = (race, id) => (id === 'daily' ? SANCT_LIFE[race]?.daily : SANCT_LIFE[race]?.quests.find((q) => q.id === id));

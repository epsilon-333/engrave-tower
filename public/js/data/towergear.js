// 탑의 방어구 · 장신구 · 왼손 장비: 등급(일반 · 희귀 · 영웅 · 전설 · 신화)마다 갈래별로 여섯 종 → 방어구 30 · 장신구 30 · 왼손 30.
// 하나하나 이름 · 이야기 · 능력치 · 효과가 다르다. 영웅부터는 발동하는 효과에 그 장비만의 연출이 있다.
// 탑에서만 드물게 떨어진다 (탑의 무기와 같은 자리에서). 높은 층일수록 높은 등급이 잘 나온다.
import { ITEMS } from './items.js';
import { W_RARITY } from './weapons.js';

const mul = (key, v, text) => ({ type: 'mul', key, v, text });
const add = (key, v, text) => ({ type: 'add', key, v, text });
const on = (event, chance, action, text) => ({ type: 'on', event, chance, action, text });
const strike = (r, m, elem, fx, rar, extra = {}) => ({ strike: { r, mul: m, elem, fx, rar, type: elem && elem !== 'phys' ? 'mag' : 'phys', ...extra } });
const buff = (id, dur, mods, name, color) => ({ buff: { id: 'g_' + id, dur, mods, name, color } });
const SHIELD = { off: { shield: 1, parry: 1 }, odesc: '방패 · 받아치기 스킬을 온전히 쓴다' };
const SPELL = { off: { spell: 1 }, odesc: '마법을 온전한 힘으로 쓴다' };
const SHOOT = { off: { shoot: 1 }, odesc: '쏘기 스킬을 온전한 힘으로 쓴다' };
const THROW = { off: { throw: 1 }, odesc: '던지기 스킬을 온전한 힘으로 쓴다' };

// [아이디, 이름, 능력치, 효과, 이야기, 왼손 성질]
const GEAR = {
  armor: [
    [ // 일반
      ['tgQuilted', '누비 갑옷', { pres: 4, vit: 2 }, [], '천을 겹겹이 누빈 갑옷. 탑 아래층 문지기들이 입는다.'],
      ['tgHunterHide', '사냥꾼 가죽옷', { agi: 3, sen: 2 }, [], '소리 없이 움직이도록 무두질한 가죽.'],
      ['tgNoviceRobe', '견습 로브', { mres: 4, spi: 2 }, [], '소매 끝에 그을린 자국이 남은 로브.'],
      ['tgPilgrimCoat', '순례자 외투', { vit: 3, spi: 2 }, [add('regen', 0.001, '초당 최대 HP 0.1% 회복')], '탑을 오르다 돌아온 이가 두고 간 외투.'],
      ['tgGuardMail', '경비병 사슬', { pres: 6, agi: -1 }, [], '무겁지만 믿음직하다.'],
      ['tgMinerGarb', '광부 작업복', { str: 3, pres: 2 }, [], '돌가루가 빠지지 않는 두꺼운 옷.'],
    ],
    [ // 희귀
      ['tgBogScale', '늪지기 비늘 갑옷', { pres: 6, mres: 4 }, [add('statusRes', 0.1, '받는 상태이상 지속 -10%')], '늪 도마뱀 비늘을 엮었다. 독이 잘 스미지 않는다.'],
      ['tgShadowCloak', '그림자 망토', { agi: 5, sen: 3 }, [add('dodge', 0.02, '회피 +2%')], '빛을 먹는 천. 가장자리가 흐릿하다.'],
      ['tgStarRobe', '별무늬 로브', { mag: 5, mres: 4 }, [mul('magAtk', 1.04, '마법 공격력 +4%')], '밤하늘을 수놓은 로브. 별이 천천히 돈다.'],
      ['tgGladiatorPlate', '투사의 흉갑', { str: 5, pres: 4 }, [mul('physAtk', 1.04, '물리 공격력 +4%')], '투기장의 흠집이 훈장처럼 남았다.'],
      ['tgMonkGi', '수도승 도복', { spi: 5, vit: 3 }, [mul('costMul', 0.95, '스킬 자원 -5%')], '숨을 고르면 몸이 가벼워진다.'],
      ['tgFrostFur', '서리 털외투', { vit: 5, mres: 3 }, [on('hurt', 0.15, { status: 'chill' }, '맞으면 15% 확률로 때린 적에게 냉기')], '서리 늑대의 털. 닿는 손이 얼어붙는다.'],
    ],
    [ // 영웅
      ['tgThornPlate', '가시덩굴 갑주', { pres: 9, vit: 5 }, [add('reflect', 8, '반사 +8%'), on('hurt', 0.2, strike(46, 0.8, 'forest', 'vines', 2), '맞으면 20% 확률로 덩굴이 솟는다')], '갑옷 틈마다 가시덩굴이 자란다.'],
      ['tgGaleMail', '바람결 경갑', { agi: 8, sen: 5 }, [on('dash', 1, buff('gale', 2.5, { moveSpeed: 1.15, atkSpeed: 1.1 }, '바람결', '#c8ffe0'), '대시하면 2.5초 동안 이동 +15% · 공격 속도 +10%')], '바람을 타는 이를 위한 가벼운 비늘.'],
      ['tgBloodPlate', '선혈의 판금', { str: 8, vit: 6 }, [on('kill', 0.35, strike(40, 1.0, 'phys', 'thorns', 2), '처치하면 35% 확률로 피의 가시가 솟는다')], '쓰러뜨린 자의 피를 마신다는 판금.'],
      ['tgArcaneWeave', '비전 직조 로브', { mag: 8, spi: 6 }, [on('crit', 0.3, strike(36, 1.0, 'arcane', 'shards', 2), '치명타면 30% 확률로 수정 파편이 터진다')], '실 한 올 한 올에 비전이 감겨 있다.'],
      ['tgWraithShroud', '망령의 수의', { mres: 9, spi: 5 }, [on('hurt', 0.2, { shield: 0.04 }, '맞으면 20% 확률로 보호막(최대 체력 4%)')], '입으면 몸이 반쯤 이 세상에서 벗어난다.'],
      ['tgMagmaScale', '용암 비늘 갑주', { pres: 8, mres: 6 }, [on('hurt', 0.18, strike(44, 1.0, 'fire', 'burst', 2, { status: 'burn' }), '맞으면 18% 확률로 때린 적 자리에 용암이 터진다')], '식지 않는 용암 도마뱀의 비늘.'],
    ],
    [ // 전설
      ['tgBoneKing', '해골왕의 갈비 갑주', { pres: 12, vit: 8, str: 4 }, [mul('dmgTakenMul', 0.95, '받는 피해 -5%'), on('hurt', 0.25, strike(56, 1.4, 'phys', 'bones', 3), '맞으면 25% 확률로 뼈 가시가 솟는다')], '죽지 않는 왕의 갈비뼈로 짰다.'],
      ['tgStormMantle', '폭풍 망토', { agi: 10, sen: 8, mag: 4 }, [on('dodge', 1, strike(50, 1.6, 'lightning', 'burst', 3, { status: 'shock' }), '회피하면 그 자리에 벼락')], '펄럭일 때마다 하늘이 운다.'],
      ['tgSunPlate', '태양의 판금', { pres: 12, mres: 10 }, [on('kill', 0.3, strike(50, 1.6, 'holy', 'holy', 3), '처치하면 30% 확률로 빛기둥이 내리꽂힌다')], '한낮의 해를 두드려 편 판금.'],
      ['tgAbyssRobe', '심연의 로브', { mag: 12, spi: 8, mres: 4 }, [mul('magAtk', 1.06, '마법 공격력 +6%'), on('crit', 0.25, strike(54, 1.6, 'dark', 'doom', 3), '치명타면 25% 확률로 어둠의 문이 열린다')], '안감 너머로 끝없는 어둠이 보인다.'],
      ['tgFrostQueen', '서리 여왕의 드레스', { mres: 12, vit: 8, mag: 4 }, [on('hurt', 0.25, strike(56, 1.2, 'ice', 'ice', 3, { status: 'chill' }), '맞으면 25% 확률로 얼음 가시가 솟는다')], '서리 회랑의 여왕이 입던 옷. 숨결이 얼어붙는다.'],
      ['tgStarfallCoat', '유성의 외투', { sen: 12, agi: 8 }, [on('hit', 0.08, strike(40, 1.4, 'holy', 'starfall', 3), '공격하면 8% 확률로 별똥이 떨어진다')], '하늘에서 떨어진 별의 조각을 꿰매 달았다.'],
    ],
    [ // 신화
      ['tgEngravedAegis', '각인의 성갑', { pres: 16, mres: 14, vit: 8 }, [mul('dmgTakenMul', 0.9, '받는 피해 -10%'), on('hurt', 0.25, strike(70, 1.8, 'holy', 'holy', 4), '맞으면 25% 확률로 각인이 빛기둥으로 터진다')], '탑의 꼭대기에서 각인을 새긴 갑옷.'],
      ['tgVoidSkin', '공허의 거죽', { agi: 14, sen: 12, str: 6 }, [add('dodge', 0.04, '회피 +4%'), on('dodge', 1, strike(60, 2.0, 'dark', 'doom', 4), '회피하면 그 자리에 공허가 열린다')], '빛도 소리도 빨아들이는 거죽.'],
      ['tgDragonHeart', '용심 갑주', { str: 14, vit: 12, pres: 8 }, [mul('maxHp', 1.08, '최대 HP +8%'), on('kill', 0.4, strike(64, 2.0, 'fire', 'burst', 4, { status: 'burn' }), '처치하면 40% 확률로 용의 불길이 터진다')], '용의 심장이 아직 갑옷 안에서 뛴다.'],
      ['tgWorldRobe', '세계수 법의', { mag: 16, spi: 12, mres: 6 }, [mul('magAtk', 1.08, '마법 공격력 +8%'), on('crit', 0.3, strike(60, 1.8, 'forest', 'vines', 4), '치명타면 30% 확률로 세계수 덩굴이 휘감는다')], '세계수의 껍질로 지은 법의. 입은 자 곁에 싹이 튼다.'],
      ['tgCrimsonBloom', '핏빛 꽃의 갑주', { str: 14, agi: 10, vit: 8 }, [mul('physAtk', 1.08, '물리 공격력 +8%'), on('hit', 0.1, strike(50, 1.6, 'phys', 'thorns', 4), '공격하면 10% 확률로 피의 가시')], '피어날 때마다 누군가 쓰러진다는 꽃.'],
      ['tgMirrorMail', '천 개의 거울 갑옷', { pres: 14, mres: 14, sen: 6 }, [add('reflect', 15, '반사 +15%'), on('hurtMag', 0.35, strike(56, 1.6, 'arcane', 'shards', 4), '마법에 맞으면 35% 확률로 거울 파편이 튄다')], '모든 비늘이 거울이다. 날아든 마법을 되돌린다.'],
    ],
  ],
  acc: [
    [
      ['tgCopperRing', '구리 반지', { str: 2, agi: 1 }, [], '손때가 묻어 반들반들하다.'],
      ['tgBoneCharmNeck', '뼈 목걸이', { vit: 2, pres: 1 }, [], '작은 짐승 뼈를 꿴 목걸이.'],
      ['tgGlassEar', '유리 귀걸이', { mag: 2, spi: 1 }, [], '빛을 받으면 무지개가 진다.'],
      ['tgHuntTooth', '사냥 송곳니', { sen: 2, agi: 1 }, [], '첫 사냥의 기념.'],
      ['tgLuckyCoin', '행운의 동전', { sen: 1, agi: 1, vit: 1 }, [], '앞면만 나온다는 동전.'],
      ['tgMossBand', '이끼 팔찌', { vit: 2, mres: 1 }, [], '이끼가 살아 있다. 가끔 물을 줘야 한다.'],
    ],
    [
      ['tgEagleEye', '매의 눈 반지', { sen: 4, agi: 2 }, [add('crit', 0.02, '치명타 확률 +2%')], '멀리 있는 것이 또렷이 보인다.'],
      ['tgOxNeck', '황소 목걸이', { str: 4, vit: 2 }, [mul('maxHp', 1.03, '최대 HP +3%')], '황소의 뿔을 깎았다.'],
      ['tgSageEar', '현자의 귀걸이', { mag: 4, spi: 2 }, [mul('costMul', 0.96, '스킬 자원 -4%')], '속삭임이 들린다. 대개는 맞는 말이다.'],
      ['tgVenomRing', '독사 반지', { sen: 3, toxicity: 3 }, [on('hit', 0.08, { status: 'poison' }, '공격하면 8% 확률로 중독')], '반지 안쪽에 독니가 숨어 있다.'],
      ['tgEmberNeck', '불씨 목걸이', { mag: 3, fireAff: 2 }, [on('hit', 0.08, { status: 'burn' }, '공격하면 8% 확률로 화상')], '꺼지지 않는 불씨를 유리에 가뒀다.'],
      ['tgSwiftAnklet', '날쌘 발찌', { agi: 4, sen: 2 }, [mul('dashCd', 0.94, '대시 쿨타임 -6%')], '발이 땅에 덜 닿는다.'],
    ],
    [
      ['tgStormRing', '천둥 반지', { sen: 6, agi: 4 }, [on('crit', 0.25, strike(36, 1.0, 'lightning', 'burst', 2, { status: 'shock' }), '치명타면 25% 확률로 벼락')], '끼면 머리카락이 곤두선다.'],
      ['tgBloodNeck', '피의 목걸이', { lifesteal: 1, str: 6, vit: 4 }, [on('kill', 0.25, strike(36, 1.0, 'phys', 'thorns', 2), '처치하면 25% 확률로 피의 가시')], '붉은 구슬이 맥박처럼 뛴다.'],
      ['tgCrystalEar', '수정 귀걸이', { mag: 6, spi: 4 }, [on('crit', 0.3, strike(34, 1.0, 'arcane', 'shards', 2), '치명타면 30% 확률로 수정 파편')], '맑은 수정이 마력을 모아 둔다.'],
      ['tgGaleFeather', '돌풍 깃털', { agi: 6, sen: 4 }, [on('dash', 1, strike(40, 0.9, 'wind', 'gale', 2), '대시하면 둘레에 바람 칼날')], '폭풍새의 꽁지깃.'],
      ['tgBogEye', '늪의 눈', { spi: 5, toxicity: 5 }, [on('kill', 0.3, { cloud: { r: 40, dur: 3 } }, '처치하면 30% 확률로 독구름')], '늪 마녀의 감기지 않는 눈.'],
      ['tgGraveBell', '묘지기의 방울', { spi: 6, mres: 4 }, [on('hurt', 0.15, { shield: 0.03 }, '맞으면 15% 확률로 보호막(최대 체력 3%)')], '흔들면 망령이 물러난다.'],
    ],
    [
      ['tgDragonEye', '용의 눈 반지', { sen: 8, str: 6 }, [add('critDmg', 0.2, '치명타 피해 +20%'), on('crit', 0.25, strike(46, 1.4, 'fire', 'burst', 3, { status: 'burn' }), '치명타면 25% 확률로 용의 불길')], '반지 속 눈동자가 적을 따라 움직인다.'],
      ['tgStarNeck', '별의 목걸이', { mag: 8, sen: 6 }, [on('hit', 0.07, strike(40, 1.3, 'holy', 'starfall', 3), '공격하면 7% 확률로 별똥')], '밤마다 별 하나가 더 빛난다.'],
      ['tgSoulEar', '영혼 귀걸이', { spi: 8, mag: 6 }, [mul('resGain', 1.1, '종족 자원 +10%'), on('kill', 0.3, strike(44, 1.3, 'dark', 'doom', 3), '처치하면 30% 확률로 어둠의 문')], '쓰러진 이의 영혼이 귓가에서 운다.'],
      ['tgGiantBelt', '거인의 허리띠', { str: 8, vit: 8 }, [mul('physAtk', 1.05, '물리 공격력 +5%'), on('hit', 0.06, strike(44, 1.4, 'phys', 'bones', 3), '공격하면 6% 확률로 뼈 가시')], '거인의 허리에서 풀어낸 띠.'],
      ['tgFrostCrown', '서리 왕관 고리', { mres: 8, mag: 6 }, [on('hurt', 0.25, strike(48, 1.1, 'ice', 'ice', 3, { status: 'chill' }), '맞으면 25% 확률로 얼음 가시')], '서리 왕관에서 떨어진 고리 하나.'],
      ['tgWindHeart', '바람의 심장', { agi: 10, sen: 4 }, [mul('atkSpeed', 1.06, '공격 속도 +6%'), on('dash', 1, strike(50, 1.2, 'wind', 'gale', 3), '대시하면 둘레에 바람 칼날')], '가슴에 대면 바람 소리가 난다.'],
    ],
    [
      ['tgEngraveSeal', '각인의 인장', { str: 6, agi: 6, mag: 6, sen: 6 }, [mul('dmgMul', 1.06, '모든 피해 +6%'), on('crit', 0.3, strike(56, 1.8, 'holy', 'holy', 4), '치명타면 30% 확률로 각인 빛기둥')], '탑의 주인이 쓰던 인장.'],
      ['tgVoidEye', '공허의 눈', { sen: 12, mag: 8 }, [add('crit', 0.05, '치명타 확률 +5%'), on('crit', 0.3, strike(56, 1.8, 'dark', 'doom', 4), '치명타면 30% 확률로 공허가 열린다')], '들여다보면 들여다본다.'],
      ['tgPhoenixNeck', '불사조의 깃 목걸이', { vit: 12, mag: 8 }, [add('regen', 0.002, '초당 최대 HP 0.2% 회복'), on('kill', 0.35, strike(56, 1.6, 'fire', 'burst', 4, { status: 'burn' }), '처치하면 35% 확률로 불사조의 불길')], '재 속에서 다시 타오르는 깃.'],
      ['tgBloodMoon', '핏빛 달 반지', { lifesteal: 2, str: 12, agi: 8 }, [on('hit', 0.1, strike(46, 1.5, 'phys', 'thorns', 4), '공격하면 10% 확률로 피의 가시')], '붉은 달이 뜨는 밤에만 빛난다.'],
      ['tgCometEar', '혜성 귀걸이', { mag: 12, sen: 8 }, [mul('magAtk', 1.06, '마법 공격력 +6%'), on('hit', 0.09, strike(48, 1.6, 'holy', 'starfall', 4), '공격하면 9% 확률로 별똥')], '꼬리를 끄는 별이 귓가에 매달렸다.'],
      ['tgMirrorHeart', '거울 심장', { pres: 8, mres: 8, sen: 8 }, [add('reflect', 10, '반사 +10%'), on('hurt', 0.3, strike(50, 1.4, 'arcane', 'shards', 4), '맞으면 30% 확률로 거울 파편')], '깨진 거울 조각이 심장처럼 뛴다.'],
    ],
  ],
  off: [
    [
      ['tgPlankShield', '널빤지 방패', { pres: 4 }, [], '문짝을 뜯어 손잡이를 달았다.', SHIELD],
      ['tgPaperCharm', '종이 부적', { mag: 3 }, [], '먹이 번진 부적. 그래도 효험은 있다.', SPELL],
      ['tgReedQuiver', '갈대 화살통', { sen: 3 }, [], '가볍고 꺼내기 쉽다.', SHOOT],
      ['tgKnifeBelt', '단도 띠', { agi: 3 }, [], '던질 단도 여섯 자루가 꽂혀 있다.', THROW],
      ['tgBuckler', '작은 원방패', { pres: 3, agi: 1 }, [], '쳐 내기 좋게 작다.', SHIELD],
      ['tgCandleLantern', '촛불 등불', { spi: 2, mag: 1 }, [], '바람에도 꺼지지 않는 촛불.', SPELL],
    ],
    [
      ['tgScaleShield', '비늘 방패', { pres: 6, mres: 3 }, [mul('dmgTakenMul', 0.97, '받는 피해 -3%')], '늪 도마뱀 비늘을 덧댄 방패.', SHIELD],
      ['tgRuneCharm', '룬 부적', { mag: 5, spi: 2 }, [mul('magAtk', 1.04, '마법 공격력 +4%')], '새긴 룬이 희미하게 빛난다.', SPELL],
      ['tgHawkQuiver', '매깃 화살통', { sen: 5, agi: 2 }, [mul('atkSpeed', 1.04, '공격 속도 +4%')], '매의 깃으로 만든 화살이 가득하다.', SHOOT],
      ['tgStarKnives', '별 표창 주머니', { agi: 5, sen: 2 }, [add('crit', 0.02, '치명타 확률 +2%')], '별 모양 표창. 던지면 휘파람 소리가 난다.', THROW],
      ['tgIceLantern', '서리 등불', { mag: 4, mres: 3 }, [on('hit', 0.08, { status: 'chill' }, '공격하면 8% 확률로 냉기')], '푸른 불꽃이 차갑게 탄다.', SPELL],
      ['tgSpikedShield', '가시 방패', { pres: 5, str: 2 }, [add('reflect', 5, '반사 +5%')], '방패 앞면에 가시가 돋았다.', SHIELD],
    ],
    [
      ['tgThornAegis', '가시덩굴 방패', { pres: 8, vit: 5 }, [on('hurt', 0.22, strike(44, 0.9, 'forest', 'vines', 2), '맞으면 22% 확률로 덩굴이 솟는다')], '방패에서 덩굴이 자라 적을 휘감는다.', SHIELD],
      ['tgSkullTome', '해골 경전', { mag: 7, spi: 5 }, [on('kill', 0.3, strike(42, 1.1, 'phys', 'bones', 2), '처치하면 30% 확률로 뼈 가시')], '해골 표지의 경전. 죽은 자의 기도가 적혀 있다.', SPELL],
      ['tgGaleQuiver', '돌풍 화살통', { sen: 7, agi: 5 }, [on('dash', 1, strike(42, 0.9, 'wind', 'gale', 2), '대시하면 둘레에 바람 칼날')], '화살이 바람을 타고 휜다.', SHOOT],
      ['tgVenomKnives', '독니 단도 띠', { agi: 7, toxicity: 4 }, [on('kill', 0.3, { cloud: { r: 38, dur: 3 } }, '처치하면 30% 확률로 독구름')], '단도마다 독이 발려 있다.', THROW],
      ['tgCrystalOrb', '수정 구슬', { mag: 8, sen: 4 }, [on('crit', 0.3, strike(36, 1.0, 'arcane', 'shards', 2), '치명타면 30% 확률로 수정 파편')], '구슬 속에 작은 폭풍이 갇혀 있다.', SPELL],
      ['tgEmberShield', '불씨 방패', { pres: 7, mres: 5 }, [on('hurt', 0.2, strike(40, 1.0, 'fire', 'burst', 2, { status: 'burn' }), '맞으면 20% 확률로 불씨가 터진다')], '방패 안쪽에 불씨를 품었다.', SHIELD],
    ],
    [
      ['tgBoneWall', '해골 성벽 방패', { pres: 12, vit: 8 }, [mul('dmgTakenMul', 0.94, '받는 피해 -6%'), on('hurt', 0.25, strike(54, 1.3, 'phys', 'bones', 3), '맞으면 25% 확률로 뼈 가시')], '무너진 성벽의 해골들이 아직 지킨다.', SHIELD],
      ['tgStarChart', '별자리 지도', { mag: 11, sen: 6 }, [mul('magAtk', 1.06, '마법 공격력 +6%'), on('hit', 0.08, strike(42, 1.3, 'holy', 'starfall', 3), '공격하면 8% 확률로 별똥')], '펼치면 별이 지도 위로 떨어진다.', SPELL],
      ['tgStormQuiver', '폭풍 화살통', { sen: 11, agi: 6 }, [on('crit', 0.3, strike(48, 1.4, 'lightning', 'burst', 3, { status: 'shock' }), '치명타면 30% 확률로 벼락')], '꺼내는 화살마다 번개가 감긴다.', SHOOT],
      ['tgBloodKnives', '선혈 단도 띠', { lifesteal: 1, agi: 10, str: 6 }, [on('crit', 0.3, strike(42, 1.4, 'phys', 'thorns', 3), '치명타면 30% 확률로 피의 가시')], '피를 마실수록 날이 붉어진다.', THROW],
      ['tgAbyssLantern', '심연의 등불', { mag: 10, spi: 8 }, [on('kill', 0.3, strike(50, 1.4, 'dark', 'doom', 3), '처치하면 30% 확률로 어둠의 문')], '빛 대신 어둠을 비춘다.', SPELL],
      ['tgFrostAegis', '서리 성채 방패', { pres: 10, mres: 10 }, [on('hurt', 0.25, strike(52, 1.1, 'ice', 'ice', 3, { status: 'chill' }), '맞으면 25% 확률로 얼음 가시')], '얼음 성채의 문을 떼어 왔다.', SHIELD],
    ],
    [
      ['tgEngraveAegis', '각인의 큰방패', { pres: 16, mres: 12, vit: 8 }, [mul('dmgTakenMul', 0.9, '받는 피해 -10%'), on('hurt', 0.3, strike(64, 1.8, 'holy', 'holy', 4), '맞으면 30% 확률로 각인 빛기둥')], '탑의 문을 지키던 마지막 방패.', SHIELD],
      ['tgVoidTome', '공허의 서', { mag: 16, spi: 10 }, [mul('magAtk', 1.1, '마법 공격력 +10%'), on('crit', 0.3, strike(60, 1.9, 'dark', 'doom', 4), '치명타면 30% 확률로 공허가 열린다')], '읽을수록 글자가 사라진다.', SPELL],
      ['tgCometQuiver', '혜성 화살통', { sen: 16, agi: 8 }, [mul('atkSpeed', 1.08, '공격 속도 +8%'), on('hit', 0.1, strike(50, 1.6, 'holy', 'starfall', 4), '공격하면 10% 확률로 별똥')], '화살 끝마다 혜성이 매달려 있다.', SHOOT],
      ['tgCrimsonStars', '핏빛 별 표창', { agi: 16, sen: 8 }, [add('crit', 0.05, '치명타 확률 +5%'), on('crit', 0.35, strike(50, 1.7, 'phys', 'thorns', 4), '치명타면 35% 확률로 피의 가시')], '던질 때마다 붉은 꽃잎이 흩날린다.', THROW],
      ['tgPhoenixLantern', '불사조 등불', { mag: 14, vit: 10 }, [add('regen', 0.002, '초당 최대 HP 0.2% 회복'), on('kill', 0.4, strike(58, 1.7, 'fire', 'burst', 4, { status: 'burn' }), '처치하면 40% 확률로 불사조의 불길')], '꺼져도 다시 붙는 불.', SPELL],
      ['tgMirrorAegis', '천 개의 거울 방패', { pres: 14, mres: 14 }, [add('reflect', 15, '반사 +15%'), on('hurtMag', 0.4, strike(56, 1.6, 'arcane', 'shards', 4), '마법에 맞으면 40% 확률로 거울 파편')], '방패 하나에 거울 천 개. 마법이 길을 잃는다.', SHIELD],
    ],
  ],
};

export const TOWER_GEAR = {};
export const TOWER_GEAR_BY_RARITY = [[], [], [], [], []];
for (const [slot, ranks] of Object.entries(GEAR)) ranks.forEach((list, r) => {
  const R = W_RARITY[r];
  for (const [id, name, stats, effects, lore, extra] of list) {
    TOWER_GEAR[id] = { r, slot }; TOWER_GEAR_BY_RARITY[r].push(id);
    ITEMS[id] = {
      name, slot, price: 0, towerGear: true, tier: r * 2 + 1, rarity: r, rarityColor: R.color, stats, tags: [], effects, ...(extra || {}),
      desc: lore, lines: [`${R.name} ${slot === 'armor' ? '방어구' : slot === 'acc' ? '장신구' : '왼손'}`, ...effects.map((e) => e.text)],
    };
  }
});
// 높은 층일수록 높은 등급이 잘 나온다
const R_WEIGHT = [10, 6, 3, 1.2, 0.4];
export function rollTowerGear(f, rnd) {
  const band = Math.max(1, Math.min(10, Math.ceil(f / 10)));
  const w = R_WEIGHT.map((v, r) => v * Math.pow(1 + 0.18 * (band - 1), r));
  let u = rnd() * w.reduce((a, b) => a + b, 0), r = 0;
  for (; r < 4; r++) { u -= w[r]; if (u <= 0) break; }
  const pool = TOWER_GEAR_BY_RARITY[r];
  return pool[Math.floor(rnd() * pool.length)];
}

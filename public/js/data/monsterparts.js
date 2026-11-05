// 몬스터 개체마다 고유한 부산물 · 그 부산물로 새기는 각인.
// 개체가 다르면 부산물도 다르다. 각인의 패시브는 그 몬스터의 특징을 닮고, 액티브는 이미 있는 스킬을 쓴다 (전설은 궁극기).
// 몬스터를 잡으면 계열 잔향(원래 것)과 따로 이 부산물이 떨어진다. 각인 = 그 몬스터의 부산물 + 계열 잔향.
// 효과는 숫자로 분명하게. 다른 것이 먼저 깔려 있어야만 켜지는 효과는 쓰지 않는다.

const on = (event, chance, action, text) => ({ type: 'on', event, chance, action, text });
const mul = (key, v, text) => ({ type: 'mul', key, v, text });
const add = (key, v, text) => ({ type: 'add', key, v, text });
const st = (status, stacks = 1) => ({ status, stacks });
const strike = (r, m, elem, fx, extra = {}) => ({ strike: { r, mul: m, elem, fx, type: elem && elem !== 'phys' ? 'mag' : 'phys', ...extra } });
const buff = (id, dur, mods, name, color) => ({ buff: { id: 'p_' + id, dur, mods, name, color } });
const shards = (n, m, type = 'phys') => ({ shards: { n, mul: m, type } });
const ts = (stat, v, dur) => ({ tstat: { stat, v, dur } }); // 잠깐 스탯 (한 스탯에 합쳐서 +60까지)
const conv = (from, per, to, text) => ({ type: 'conv', from, per, to, text }); // 스탯 바꾸기
// 사건: hit 맞힘 · crit 치명타 · kill 처치 · hurt 맞음 · dodge 회피 · dash 대시 · cast 스킬 사용 · shield 보호막 얻음 · awaken 싸우는 중 각성 문턱을 넘음

// [개체(같은 종의 다른 아이디는 /로), 부산물 이름, 각인 이름, 부위, 등급, 태그, 능력치, 효과, 액티브 스킬]
const P = [
  // ── 이끼 굴 · 숲 ──
  ['slime', '늪괴의 이끼 덩이', '늪괴의 끈적임', 'leg', 1, ['slime'], { vit: 4, pres: 2 }, [on('hurt', 0.25, st('chill'), '맞으면 25% 확률로 때린 적에게 냉기')], 'hardenShell'],
  ['bat', '워골의 날개막', '워골의 날갯짓', 'back', 1, ['wind'], { agi: 3 }, [mul('dashCd', 0.92, '대시 쿨타임 -8%')], 'shadowEvade'],
  ['goblin', '고블린의 녹슨 단도', '고블린의 잔꾀', 'arm', 1, ['bleed'], { agi: 2, sen: 1 }, [on('hit', 0.12, st('bleed'), '공격하면 12% 확률로 출혈')], 'rakeRetreat'],
  ['goblinChief/climbChief', '족장의 깨진 가면', '가면 족장의 돌격', 'heart', 4, ['brawl'], { str: 6, vit: 4 }, [on('dash', 1, strike(44, 1.2, 'phys', 'quake', { stun: 0.4 }), '대시가 끝난 자리를 내려찍는다 (피해 120%)'), mul('physAtk', 1.06, '물리 공격력 +6%'), on('kill', 1, ts('str', 3, 10), '처치하면 10초 동안 근력 +3')], 'chargeSmash'],
  ['toad', '진흙 괴물의 독샘', '진흙 독침', 'head', 1, ['poison'], { toxicity: 2, mag: 1 }, [on('hit', 0.15, st('poison'), '공격하면 15% 확률로 중독')], 'ePoisonBurst'],
  ['leech', '거머리의 빨판', '빨판 흡혈', 'arm', 2, ['drain', 'bleed'], { lifesteal: 2, vit: 2 }, [on('hit', 0.1, st('bleed'), '공격하면 10% 확률로 출혈')], 'devour'],
  ['shroom', '포자 시체의 갓', '썩은 갓', 'back', 1, ['poison', 'undying'], { vit: 3, toxicity: 1 }, [on('kill', 0.25, { cloud: { r: 32, dur: 3 } }, '처치하면 25% 확률로 포자 구름')], 'toxicArrow'],
  ['swampQueen/climbQueen', '늪 거인의 심장 덩이', '늪 거인의 맥박', 'heart', 5, ['giant', 'poison'], { vit: 10, toxicity: 5, pres: 4 }, [mul('maxHp', 1.12, '최대 HP +12%'), on('hurt', 0.2, { cloud: { r: 44, dur: 4 } }, '맞으면 20% 확률로 둘레에 독 웅덩이')], 'extinction'],
  ['mossSlug', '민달팽이 점액주머니', '터지는 점액', 'leg', 1, ['slime'], { vit: 2, pres: 2 }, [on('kill', 0.2, strike(34, 0.7, 'phys', 'splash', { status: 'chill' }), '처치하면 20% 확률로 점액이 터진다')], 'snare'],
  ['caveLurker', '잠복자의 갈고리 발톱', '땅속 기습', 'arm', 2, ['shadow'], { agi: 3, sen: 2 }, [on('dash', 1, buff('lurk', 2, { physAtk: 1.2 }, '기습', '#b8a0ff'), '대시 뒤 2초 동안 물리 공격력 +20%')], 'ambush'],
  ['gasBloat', '부풀이의 가스 주머니', '부푼 독가스', 'back', 2, ['poison'], { toxicity: 4 }, [on('hurt', 0.15, strike(40, 0.8, 'poison', 'miasma', { status: 'poison', stacks: 2 }), '맞으면 15% 확률로 독가스가 터진다')], 'deathFog'],
  ['chargeBoar', '멧돼지 엄니', '멧돼지 돌진', 'leg', 1, ['brawl'], { str: 2, vit: 2 }, [add('knockback', 40, '넉백 +40')], 'chargeSmash'],
  ['boarRunner', '돌격병의 굳은 가죽', '돌격병의 기세', 'leg', 2, ['brawl', 'giant'], { str: 3, pres: 3 }, [on('dash', 1, buff('boar', 1.5, { dmgTakenMul: 0.8 }, '기세', '#d8a060'), '대시 뒤 1.5초 동안 받는 피해 -20%')], 'rush'],
  ['spikeSlime', '가시 슬라임 가시', '가시 점액', 'back', 2, ['slime', 'reflect'], { pres: 4 }, [add('reflect', 6, '반사 +6%'), on('hurt', 0.2, shards(4, 0.5), '맞으면 20% 확률로 가시 4개가 튄다')], 'tailSwipe'],
  ['thornSprite', '요정의 가시 날개', '가시 요정의 장난', 'back', 2, ['wind', 'bleed'], { agi: 3, sen: 2 }, [on('dodge', 1, shards(3, 0.6), '회피하면 가시 3개를 쏜다')], 'shurikenFan'],
  ['vineSpirit', '덩굴 정령의 씨앗', '휘감는 덩굴', 'leg', 3, ['curse'], { spi: 4, mag: 3 }, [on('hit', 0.1, strike(36, 0.8, 'forest', 'vines', { stun: 0.5 }), '공격하면 10% 확률로 덩굴이 솟아 0.5초 묶는다')], 'vineSnare'],
  ['mossLord', '이끼 군주의 뿌리', '군주의 뿌리 흡수', 'heart', 4, ['drain', 'giant'], { vit: 8, spi: 4 }, [add('regen', 0.002, '초당 최대 HP 0.2% 회복'), on('kill', 0.3, strike(48, 1.2, 'forest', 'vines'), '처치하면 30% 확률로 뿌리가 솟는다'), conv('vit', 4, 'str', '체력 4마다 근력 +1')], 'natureWrath'],
  // ── 독늪 ──
  ['bogWitch', '늪 마녀의 저주 인형', '늪 마녀의 저주', 'head', 2, ['curse', 'poison'], { mag: 3, toxicity: 2 }, [on('hit', 0.12, st('curse'), '공격하면 12% 확률로 저주')], 'curse'],
  ['bogHag', '마녀 수장의 환영 거울', '환영 분신', 'head', 4, ['curse', 'shadow'], { mag: 6, spi: 4 }, [on('hurt', 0.2, buff('hag', 2, { dodge: 1.5 }, '환영', '#a8ff9a'), '맞으면 20% 확률로 2초 동안 회피 1.5배')], 'blinkBlast'],
  ['mudLurker', '진흙 잠복자의 이빨', '진흙 속 송곳니', 'arm', 2, ['bleed'], { str: 3, agi: 2 }, [on('crit', 0.3, st('bleed', 2), '치명타면 30% 확률로 출혈 2중첩')], 'pounce'],
  ['sandScorpion', '모래 전갈 독침', '전갈의 꼬리', 'arm', 2, ['poison'], { toxicity: 3, agi: 2 }, [on('hit', 0.18, st('poison'), '공격하면 18% 확률로 중독')], 'toxicArrow'],
  ['desertScorpion', '사막 전갈 집게', '사막의 집게', 'arm', 3, ['poison', 'brawl'], { str: 4, toxicity: 3 }, [on('crit', 0.4, st('poison', 2), '치명타면 40% 확률로 중독 2중첩'), add('critDmg', 0.1, '치명타 피해 +10%')], 'crushingBlows'],
  ['jungleWasp', '말벌 독침', '말벌 떼', 'back', 2, ['poison', 'wind'], { agi: 3, toxicity: 2 }, [mul('atkSpeed', 1.05, '공격 속도 +5%'), on('hit', 0.08, st('poison'), '공격하면 8% 확률로 중독'), on('cast', 1, ts('agi', 4, 5), '스킬을 쓰면 5초 동안 민첩 +4')], 'dartFan'],
  ['poisonSpider', '독거미 독낭', '독거미의 실', 'leg', 2, ['poison'], { toxicity: 3, sen: 2 }, [on('hit', 0.1, strike(30, 0.5, 'poison', 'miasma', { status: 'poison' }), '공격하면 10% 확률로 독이 튄다')], 'snare'],
  ['swampTroll', '늪 트롤의 재생 살점', '트롤의 재생', 'heart', 3, ['giant', 'poison'], { vit: 6, str: 2 }, [add('regen', 0.003, '초당 최대 HP 0.3% 회복'), on('hurt', 0.3, ts('vit', 4, 6), '맞으면 30% 확률로 6초 동안 체력 +4')], 'braceForIt'],
  ['sandWorm', '모래 벌레의 이빨 고리', '땅속의 입', 'leg', 3, ['brawl'], { str: 4, vit: 3 }, [on('dash', 1, strike(40, 1.0, 'phys', 'quake'), '대시가 끝난 자리에서 땅이 솟는다 (피해 100%)')], 'tremor'],
  ['toxShroom', '독버섯 포자', '독버섯 포자', 'head', 2, ['poison'], { toxicity: 4 }, [mul('statusDmgMul', 1.08, '상태이상 피해 +8%')], 'ePoisonBurst'],
  ['bigBeetle', '딱정벌레 등껍질', '단단한 등껍질', 'back', 2, ['giant'], { pres: 5, vit: 2 }, [mul('dmgTakenMul', 0.96, '받는 피해 -4%'), on('shield', 1, strike(40, 0.9, 'phys', 'quake'), '보호막을 얻으면 둘레를 내려찍는다 (피해 90%)')], 'hardenShell'],
  ['ironBeetle', '철갑 딱정벌레 껍질', '철갑', 'back', 3, ['giant', 'reflect'], { pres: 7 }, [mul('dmgTakenMul', 0.94, '받는 피해 -6%'), add('reflect', 5, '반사 +5%'), conv('pres', 4, 'vit', '물리 저항 4마다 체력 +1')], 'stoneSkin'],
  ['venomSpitter', '독침 개구리 혀', '끈적한 혀', 'head', 2, ['poison'], { sen: 3, toxicity: 2 }, [on('crit', 0.3, st('poison', 2), '치명타면 30% 확률로 중독 2중첩')], 'harpoon'],
  // ── 화산 ──
  ['salamander', '화염 악귀의 비늘', '악귀의 불씨', 'heart', 2, ['fire'], { mag: 3, fireAff: 2 }, [on('hit', 0.15, st('burn'), '공격하면 15% 확률로 화상'), on('kill', 0.5, ts('mag', 2, 8), '처치하면 50% 확률로 8초 동안 마력 +2')], 'eFirePillar'],
  ['magmaGolem', '용암 오우거의 굳은 용암', '흐르는 용암', 'leg', 3, ['fire', 'giant'], { vit: 5, pres: 3 }, [on('hurt', 0.2, st('burn', 2), '맞으면 20% 확률로 때린 적에게 화상 2중첩')], 'quake'],
  ['imp', '임프의 꼬리 불꽃', '임프의 장난', 'back', 1, ['fire', 'wind'], { agi: 2, fireAff: 1 }, [on('dodge', 1, st('burn'), '회피하면 가까운 적에게 화상')], 'blinkBlast'],
  ['riftGuard/climbRift', '균열 수호자의 핵 조각', '회전하는 균열', 'heart', 5, ['fire', 'curse'], { mag: 10, fireAff: 6 }, [mul('magAtk', 1.1, '마법 공격력 +10%'), on('crit', 0.3, strike(56, 1.6, 'fire', 'burst', { status: 'burn', stacks: 2 }), '치명타면 30% 확률로 균열이 터진다')], 'grandFireball'],
  ['pumpkinFiend', '호박귀의 불타는 속', '터지는 호박', 'back', 2, ['fire'], { mag: 2, fireAff: 3 }, [on('kill', 0.3, strike(40, 0.9, 'fire', 'burst', { status: 'burn' }), '처치하면 30% 확률로 불꽃이 터진다')], 'flameBurst'],
  ['chortShaman', '악귀 술사의 주문서', '악귀의 주문', 'head', 3, ['fire', 'curse'], { mag: 5, spi: 2 }, [mul('magAtk', 1.05, '마법 공격력 +5%'), on('crit', 0.2, st('burn', 2), '치명타면 20% 확률로 화상 2중첩')], 'wordFire'],
  ['shieldDemon', '방패 악귀의 방패 조각', '악귀의 방패', 'arm', 3, ['reflect', 'giant'], { pres: 6, vit: 2 }, [add('reflect', 8, '반사 +8%')], 'ironWall'],
  ['demonCaptain', '대장의 반사 방패', '반사하는 방패', 'arm', 4, ['reflect', 'fire'], { pres: 8, mres: 4 }, [add('reflect', 12, '반사 +12%'), on('hurt', 0.2, strike(44, 1.0, 'fire', 'burst', { status: 'burn' }), '맞으면 20% 확률로 방패에서 불길')], 'reflectCrystal'],
  ['fireBat', '화염 박쥐 날개', '불붙은 날개', 'back', 2, ['fire', 'wind'], { agi: 3, fireAff: 2 }, [on('dash', 1, st('burn'), '대시하면 가까운 적에게 화상')], 'soar'],
  ['fireSpirit', '불꽃 정령의 핵', '정령의 불꽃', 'heart', 3, ['fire'], { mag: 5, fireAff: 3 }, [mul('burnMul', 1.12, '화상 피해 +12%')], 'breath'],
  ['lavaLizard', '용암 도마뱀 꼬리', '용암 꼬리', 'leg', 2, ['fire'], { str: 2, fireAff: 2 }, [on('hit', 0.1, st('burn'), '공격하면 10% 확률로 화상')], 'dragonClaw'],
  ['raidDragon', '화룡왕의 역린', '화룡의 역린', 'heart', 5, ['fire', 'brawl'], { str: 10, mag: 8, fireAff: 6 }, [mul('dmgMul', 1.08, '모든 피해 +8%'), on('kill', 0.35, strike(60, 1.8, 'fire', 'meteor', { status: 'burn', stacks: 2 }), '처치하면 35% 확률로 용의 불덩이')], 'dragonForm'],
  // ── 서리 ──
  ['frostWolf', '서리 망자의 손톱', '얼어붙은 손톱', 'arm', 1, ['ice'], { str: 2, iceAff: 1 }, [on('hit', 0.15, st('chill'), '공격하면 15% 확률로 냉기')], 'frostChain'],
  ['glassSpider', '거울 정령의 파편', '비추는 파편', 'back', 2, ['reflect'], { mres: 4, sen: 1 }, [add('reflect', 6, '반사 +6%'), on('hurtMag', 0.3, shards(3, 0.5, 'mag'), '마법에 맞으면 30% 확률로 파편 3개')], 'eMirrorWall'],
  ['iceGolem', '얼음 오우거의 빙핵', '얼음 주먹', 'arm', 3, ['ice', 'giant'], { str: 4, vit: 4 }, [on('hit', 0.12, strike(36, 0.9, 'ice', 'ice', { status: 'chill' }), '공격하면 12% 확률로 얼음 가시')], 'glacialSpikes'],
  ['frostWitch/climbWitch', '서리 마녀의 눈동자', '서리 고리', 'head', 5, ['ice', 'curse'], { mag: 10, iceAff: 6, spi: 4 }, [mul('chillMul', 1.25, '냉기 효과 +25%'), on('hurt', 0.25, strike(60, 1.2, 'ice', 'ice', { status: 'chill', stacks: 2 }), '맞으면 25% 확률로 둘레에 얼음 고리')], 'absoluteZero'],
  ['frostSlug', '얼음 민달팽이 껍질', '얼음 점액', 'leg', 1, ['ice', 'slime'], { vit: 2, iceAff: 1 }, [on('kill', 0.2, strike(30, 0.6, 'ice', 'ice', { status: 'chill' }), '처치하면 20% 확률로 얼음이 터진다')], 'iceChunk'],
  ['iceShaman', '서리 주술사의 지팡이 끝', '서리 주문', 'head', 3, ['ice'], { mag: 5, iceAff: 2 }, [mul('freezeTime', 1.2, '빙결 시간 +20%'), on('awaken', 1, strike(50, 1.3, 'ice', 'ice', { status: 'chill', stacks: 2 }), '싸우는 중 각성하면 얼음 가시가 솟는다')], 'iceShards'],
  ['snowLurker', '설원 잠복자의 하얀 털', '눈 속 기습', 'leg', 2, ['ice', 'shadow'], { agi: 3, iceAff: 2 }, [on('dash', 1, buff('snow', 2, { crit: 1.5 }, '눈 속 기습', '#cfefff'), '대시 뒤 2초 동안 치명타 확률 1.5배')], 'frostCharge'],
  ['jellyfish', '해파리 촉수', '찌르는 촉수', 'back', 2, ['ice'], { mag: 3, iceAff: 2 }, [on('hurt', 0.25, st('chill', 2), '맞으면 25% 확률로 때린 적에게 냉기 2중첩')], 'eFrostNova'],
  ['seaSerpent', '바다뱀 비늘', '파도 비늘', 'back', 3, ['ice', 'wind'], { mres: 5, agi: 3 }, [mul('moveSpeed', 1.06, '이동 속도 +6%'), on('dodge', 0.5, st('chill', 2), '회피하면 50% 확률로 가까운 적에게 냉기 2중첩')], 'frostField'],
  ['dragonGuard', '용궁 수문장의 뿔', '수문장의 물결', 'head', 4, ['ice', 'fire'], { mag: 7, mres: 5 }, [mul('reactionMul', 1.2, '원소 반응 피해 +20%')], 'iceComet'],
  ['iceWolf', '얼음 늑대 송곳니', '얼음 송곳니', 'arm', 2, ['ice', 'bleed'], { agi: 3, iceAff: 2 }, [on('crit', 0.3, st('chill', 2), '치명타면 30% 확률로 냉기 2중첩')], 'pounce'],
  ['waterSpirit', '물의 정령 방울', '맑은 물방울', 'heart', 2, ['ice'], { spi: 4 }, [mul('costMul', 0.95, '스킬 자원 -5%'), on('cast', 1, ts('spi', 4, 6), '스킬을 쓰면 6초 동안 정신 +4')], 'iceChunk'],
  ['iceArcher', '얼음 궁수의 화살촉', '얼음 화살촉', 'arm', 2, ['ice'], { sen: 3, iceAff: 2 }, [on('hit', 0.12, st('chill'), '공격하면 12% 확률로 냉기')], 'pierceArrow'],
  ['yeti', '예티의 흰 털가죽', '설원의 털가죽', 'back', 3, ['giant', 'ice'], { vit: 6, mres: 3 }, [mul('maxHp', 1.06, '최대 HP +6%'), add('statusRes', 0.1, '받는 상태이상 지속 -10%')], 'tremor'],
  ['frostOgre', '오우거 왕의 빙핵', '숨 고르는 왕', 'heart', 4, ['ice', 'giant'], { vit: 8, str: 5 }, [on('hurt', 0.15, { shield: 0.05 }, '맞으면 15% 확률로 보호막(최대 체력 5%)'), mul('physAtk', 1.05, '물리 공격력 +5%'), on('shield', 1, strike(48, 1.0, 'ice', 'ice', { status: 'chill' }), '보호막을 얻으면 둘레에 얼음 가시')], 'groundSmash'],
  ['raidQueen', '서리 여왕의 왕관 조각', '서리 여왕의 숨', 'head', 5, ['ice', 'curse'], { mag: 12, iceAff: 6 }, [mul('magAtk', 1.1, '마법 공격력 +10%'), on('crit', 0.3, strike(60, 1.6, 'ice', 'ice', { status: 'chill', stacks: 3 }), '치명타면 30% 확률로 얼음 폭풍')], 'timeStop'],
  // ── 묘지 ──
  ['skeleton', '해골 병사의 뼈', '덜그럭 뼈', 'leg', 1, ['undying'], { vit: 2, pres: 2 }, [on('kill', 0.2, strike(30, 0.6, 'phys', 'bones'), '처치하면 20% 확률로 뼈 가시')], 'boneSpear'],
  ['wraith', '망령술사의 혼 구슬', '혼 구슬', 'head', 2, ['shadow', 'curse'], { mag: 3, spi: 2 }, [on('hit', 0.1, st('curse'), '공격하면 10% 확률로 저주')], 'soulRend'],
  ['ghoul', '구울의 썩은 손톱', '구울의 손톱', 'arm', 2, ['poison', 'drain'], { str: 3, toxicity: 2 }, [on('kill', 0.3, { heal: 0.008 }, '처치하면 30% 확률로 체력 0.8% 회복')], 'frenzyClaws'],
  ['tinyCorpse', '꼬마 시체의 부푼 배', '터지는 시체', 'back', 1, ['poison', 'undying'], { vit: 2 }, [on('kill', 0.2, strike(32, 0.7, 'poison', 'miasma', { status: 'poison' }), '처치하면 20% 확률로 시체가 터진다')], 'acidRain'],
  ['necroAcolyte', '수련생의 금서 쪽지', '금지된 주문', 'head', 2, ['curse'], { mag: 3, spi: 2 }, [mul('statusDmgMul', 1.06, '상태이상 피해 +6%')], 'boneSpear'],
  ['boneGuard', '뼈 방패병의 방패', '뼈 방패', 'arm', 2, ['giant', 'undying'], { pres: 5, vit: 2 }, [mul('dmgTakenMul', 0.96, '받는 피해 -4%'), on('awaken', 1, { shield: 0.05 }, '싸우는 중 각성하면 보호막(최대 체력 5%)')], 'riposte'],
  ['shadeWraith', '망령의 잔영', '흐릿한 잔영', 'back', 2, ['shadow'], { agi: 3, spi: 2 }, [add('dodge', 0.02, '회피 +2%')], 'shadowEvade'],
  ['fallenKnight', '타락한 기사의 검자루', '타락한 맹세', 'arm', 4, ['brawl', 'curse'], { str: 7, pres: 4 }, [mul('physAtk', 1.06, '물리 공격력 +6%'), on('crit', 0.25, st('curse', 2), '치명타면 25% 확률로 저주 2중첩'), conv('pres', 3, 'str', '물리 저항 3마다 근력 +1')], 'crossCut'],
  ['graveKeeper', '묘지기의 등불', '묘지기의 등불', 'head', 4, ['shadow', 'undying'], { spi: 6, mag: 5 }, [on('kill', 0.3, strike(48, 1.3, 'dark', 'doom'), '처치하면 30% 확률로 어둠의 문'), on('awaken', 1, strike(56, 1.6, 'dark', 'doom'), '싸우는 중 각성하면 어둠의 문이 열린다')], 'eSoulHarvest'],
  ['cultist', '교도의 검은 두건', '그림자 기도', 'head', 3, ['shadow', 'curse'], { mag: 4, spi: 3 }, [on('hit', 0.1, st('curse'), '공격하면 10% 확률로 저주'), mul('magAtk', 1.04, '마법 공격력 +4%'), on('kill', 0.5, ts('mag', 3, 8), '처치하면 50% 확률로 8초 동안 마력 +3')], 'painLink'],
  ['wraithKnight', '망령 기사의 투구 깃', '망령 기사의 돌격', 'heart', 3, ['shadow', 'ice'], { str: 4, mres: 3 }, [on('dash', 1, st('chill', 2), '대시하면 가까운 적에게 냉기 2중첩')], 'shieldCharge'],
  ['boneArcher', '해골 궁수의 활시위', '뼈 화살', 'arm', 2, ['undying'], { sen: 3, agi: 2 }, [on('crit', 0.3, strike(28, 0.6, 'phys', 'bones'), '치명타면 30% 확률로 뼈 가시')], 'arrowRain'],
  ['wraithLord', '기사단장의 혼불', '혼령화', 'heart', 5, ['shadow', 'undying'], { spi: 8, mag: 8, mres: 5 }, [on('hurt', 0.15, buff('ghost', 1.5, { dmgTakenMul: 0.5 }, '혼령화', '#c8b0ff'), '맞으면 15% 확률로 1.5초 동안 받는 피해 -50%'), mul('magAtk', 1.08, '마법 공격력 +8%')], 'shadowDance'],
  ['engraveKing', '각인의 왕의 왕관', '왕의 각인', 'heart', 5, ['curse', 'brawl'], { str: 8, mag: 8, agi: 6, sen: 6 }, [mul('dmgMul', 1.1, '모든 피해 +10%'), on('crit', 0.3, strike(60, 2.0, 'holy', 'holy'), '치명타면 30% 확률로 각인이 빛기둥으로 터진다'), on('awaken', 1, strike(70, 2.0, 'holy', 'holy'), '싸우는 중 각성하면 각인이 빛기둥으로 터진다')], 'doomBrand'],
  // ── 들판 · 초원 · 폐허 ──
  ['goblinShaman', '주술사의 깃털 장식', '고블린 주문', 'head', 2, ['curse'], { mag: 3, spi: 1 }, [on('hit', 0.1, st('shock'), '공격하면 10% 확률로 감전')], 'eChainBolt'],
  ['treasureGoblin', '보물 고블린의 금 주머니', '금 냄새', 'back', 2, ['wind'], { agi: 3, sen: 2 }, [mul('goldMul', 1.15, '얻는 금화 +15%'), mul('moveSpeed', 1.04, '이동 속도 +4%')], 'smokeBomb'],
  ['hyena', '하이에나의 이빨', '무리 사냥', 'arm', 2, ['bleed'], { agi: 3, str: 2 }, [add('lowHunt', 0.1, 'HP 30% 이하 적에게 피해 +10%'), on('kill', 1, ts('agi', 3, 8), '처치하면 8초 동안 민첩 +3')], 'rakeRetreat'],
  ['orcRaider', '오크 약탈자의 전리품', '약탈자의 돌격', 'leg', 2, ['brawl'], { str: 4, vit: 2 }, [on('kill', 0.3, buff('raid', 3, { atkSpeed: 1.12 }, '약탈', '#e8a060'), '처치하면 30% 확률로 3초 동안 공격 속도 +12%')], 'chargeSmash'],
  ['raptor', '랩터의 갈고리 발톱', '갈고리 발톱', 'leg', 2, ['bleed', 'wind'], { agi: 4, str: 1 }, [on('crit', 0.35, st('bleed', 2), '치명타면 35% 확률로 출혈 2중첩'), on('crit', 1, ts('agi', 2, 6), '치명타면 6초 동안 민첩 +2')], 'pounce'],
  ['raptorAlpha', '우두머리의 볏', '우두머리의 포효', 'head', 4, ['bleed', 'brawl'], { agi: 6, str: 5 }, [on('kill', 0.4, buff('alpha', 4, { moveSpeed: 1.15, physAtk: 1.1 }, '사냥 개시', '#ff9a6a'), '처치하면 40% 확률로 4초 동안 이동 +15% · 물리 공격 +10%'), on('kill', 1, ts('str', 4, 8), '처치하면 8초 동안 근력 +4')], 'apexPredator'],
  ['royalGuard', '왕국 병사의 문장', '근위의 맹세', 'arm', 2, ['giant'], { pres: 4, str: 2 }, [mul('dmgTakenMul', 0.97, '받는 피해 -3%'), on('shield', 1, ts('str', 6, 6), '보호막을 얻으면 6초 동안 근력 +6')], 'shieldBash'],
  ['bandit', '도적의 굽은 칼', '뒷골목 칼질', 'arm', 2, ['bleed', 'shadow'], { agi: 3, sen: 2 }, [add('crit', 0.03, '치명타 확률 +3%'), on('kill', 1, ts('sen', 3, 8), '처치하면 8초 동안 감각 +3')], 'ambush'],
  ['coralCrab', '산호 게 집게', '산호 껍질', 'arm', 2, ['reflect', 'giant'], { pres: 4, mres: 2 }, [add('reflect', 6, '반사 +6%')], 'hardenShell'],
  ['labyrinthLord', '미궁 군주의 열쇠', '미궁의 돌진', 'heart', 4, ['brawl'], { str: 7, vit: 5 }, [on('dash', 1, strike(50, 1.3, 'phys', 'quake', { stun: 0.6 }), '대시가 끝난 자리를 내려찍고 0.6초 기절'), on('dash', 1, ts('str', 4, 5), '대시하면 5초 동안 근력 +4')], 'stampede'],
  ['orcWarlord', '오크 족장의 뿔 투구', '족장의 함성', 'head', 4, ['brawl'], { str: 8, vit: 4 }, [mul('physAtk', 1.08, '물리 공격력 +8%'), on('kill', 0.25, { res: 15 }, '처치하면 25% 확률로 종족 자원 +15'), on('cast', 1, ts('str', 5, 6), '스킬을 쓰면 6초 동안 근력 +5')], 'warCry'],
  ['rockGolem', '바위 골렘의 돌심장', '돌심장', 'heart', 3, ['giant'], { vit: 5, pres: 4 }, [mul('maxHp', 1.05, '최대 HP +5%')], 'stoneFist'],
  ['lizardWarrior', '도마뱀 전사의 비늘 방패', '비늘 전사', 'arm', 2, ['giant', 'bleed'], { str: 3, pres: 3 }, [on('hurt', 0.15, st('bleed'), '맞으면 15% 확률로 때린 적에게 출혈')], 'comboSlash'],
  ['darkArcher', '어둠 궁수의 검은 깃', '검은 화살', 'arm', 2, ['shadow'], { sen: 4, agi: 1 }, [add('critDmg', 0.12, '치명타 피해 +12%'), on('crit', 1, ts('sen', 2, 6), '치명타면 6초 동안 감각 +2')], 'aimedShot'],
  ['shadowPanther', '그림자 표범 수염', '그림자 도약', 'leg', 3, ['shadow', 'bleed'], { agi: 5, sen: 3 }, [on('dash', 1, buff('panther', 1.5, { crit: 1.6 }, '도약', '#a080ff'), '대시 뒤 1.5초 동안 치명타 확률 1.6배')], 'shadowStep'],
  ['mimic', '미믹의 혀', '탐욕스러운 혀', 'head', 3, ['drain'], { vit: 4, str: 3 }, [mul('goldMul', 1.1, '얻는 금화 +10%'), on('kill', 0.2, { heal: 0.012 }, '처치하면 20% 확률로 체력 3% 회복'), conv('str', 3, 'vit', '근력 3마다 체력 +1')], 'devour'],
  ['raidGolem', '고대 골렘의 핵', '고대의 핵', 'heart', 5, ['giant', 'reflect'], { pres: 10, vit: 10 }, [mul('dmgTakenMul', 0.9, '받는 피해 -10%'), on('hurt', 0.2, strike(56, 1.5, 'phys', 'quake', { stun: 0.5 }), '맞으면 20% 확률로 땅이 울린다')], 'colossus'],
  ['forestArcher', '숲 도적의 깃털 화살', '숲의 사격', 'arm', 2, ['wind'], { sen: 3, agi: 2 }, [mul('atkSpeed', 1.04, '공격 속도 +4%')], 'galeShot'],
  ['ruinSentinel', '파수꾼의 금 간 눈', '폐허의 파수', 'head', 3, ['giant', 'brawl'], { pres: 5, str: 3 }, [on('dash', 1, buff('sentinel', 2, { dmgTakenMul: 0.75 }, '파수', '#c0b090'), '대시 뒤 2초 동안 받는 피해 -25%')], 'shieldCharge'],
  ['rockThrower', '투척꾼의 둥근 돌', '굴러가는 돌', 'arm', 2, ['brawl'], { str: 3, sen: 1 }, [on('crit', 0.3, strike(30, 0.7, 'phys', 'rocks', { stun: 0.3 }), '치명타면 30% 확률로 돌이 떨어진다')], 'boulderToss'],
  ['harpy', '하피의 깃털', '하피의 날갯짓', 'back', 2, ['wind', 'bleed'], { agi: 4 }, [on('dash', 1, strike(36, 0.6, 'wind', 'gale', { status: 'bleed' }), '대시하면 둘레에 바람 칼날')], 'windStep'],
  ['watcherEye', '감시안의 눈알', '지켜보는 눈', 'head', 3, ['reflect', 'curse'], { sen: 4, mres: 3 }, [add('crit', 0.03, '치명타 확률 +3%'), on('hurtMag', 0.3, shards(3, 0.6, 'mag'), '마법에 맞으면 30% 확률로 광선 파편 3개'), conv('sen', 3, 'mag', '감각 3마다 마력 +1')], 'weakMark'],
];

// ── 몬스터에 붙이고 각인 · 잔향 목록에 올린다 (monsters.js · engravings.js · skills.js 가 불러 쓴다) ──
const FAM_COLOR = { goo: '#7ed957', wing: '#9a8cff', rust: '#c08a4a', chief: '#ffb347', venom: '#9be15d', blood: '#e0445a', spore: '#d9b36b', queen: '#5dff9e', ember: '#ff7a2a', magma: '#ff5a2a', cinder: '#ffa060', core: '#ff8a40', frost: '#9fe3ff', mirror: '#e8f4ff', icecore: '#7fc8ff', witch: '#b8e8ff', bone: '#efe6d0', soul: '#c8a8ff', rot: '#9a9a5a', meltcore: '#ffa0c0', grave: '#c45cff' };
export const PART_LIST = P.map(([who, part, name, slot, grade, tags, stats, effects, skill]) => {
  const ids = who.split('/'), key = 'p_' + ids[0];
  return { key, ids, part, eng: 'm_' + ids[0], name, slot, grade, tags, stats, effects, skill };
});
// 부산물 = 잔향의 한 종류 (가방 · 제단 · 도감이 같은 방식으로 다룬다)
export function registerParts(ECHOES, MONSTERS) {
  for (const p of PART_LIST) {
    const fam = MONSTERS[p.ids[0]]?.echo?.id;
    ECHOES[p.key] = { name: p.part, color: FAM_COLOR[fam] || '#e8dcc8', rare: p.grade >= 4, part: true, fam };
    for (const id of p.ids) if (MONSTERS[id]) MONSTERS[id].part = p.key;
  }
}
// 각인: 부산물 (등급만큼) + 그 몬스터의 계열 잔향
export function registerPartEngravings(ENGRAVINGS, MONSTERS) {
  for (const p of PART_LIST) {
    const fam = MONSTERS[p.ids[0]]?.echo?.id;
    ENGRAVINGS[p.eng] = {
      name: p.name, slot: p.slot, grade: p.grade, load: [0, 2, 3, 5, 7, 10][p.grade], tags: p.tags, stats: p.stats, effects: p.effects,
      recipe: { [p.key]: 1 + p.grade, ...(fam ? { [fam]: 2 + p.grade } : {}) }, from: p.ids[0],
    };
  }
}
export function registerPartSkills(ENGRAVING_SKILLS) { for (const p of PART_LIST) ENGRAVING_SKILLS[p.eng] = p.skill; }

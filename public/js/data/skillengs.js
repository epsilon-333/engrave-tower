// 스킬 각인: 각인이 없던 스킬마다 각인 하나 (잔향을 모아 새긴다 — 몬스터 부산물 각인과 따로)
// 패시브는 그 스킬의 느낌을 닮게, 숫자로 분명하게. 마무리(30레벨) 스킬은 영웅(4), 궁극기는 전설(5) — 궁극기는 그 종족만 쓴다(engravingSkillFor)
// 물속 숨 · 잠수는 생활 기술이라 각인으로 주지 않는다

const on = (event, chance, action, text) => ({ type: 'on', event, chance, action, text });
const mul = (key, v, text) => ({ type: 'mul', key, v, text });
const add = (key, v, text) => ({ type: 'add', key, v, text });
const st = (status, stacks = 1) => ({ status, stacks });
const strike = (r, m, elem, fx, extra = {}) => ({ strike: { r, mul: m, elem, fx, type: elem && elem !== 'phys' ? 'mag' : 'phys', ...extra } });
const buff = (id, dur, mods, name, color) => ({ buff: { id: 's_' + id, dur, mods, name, color } });

// [각인 아이디, 이름, 부위, 등급, 태그, 능력치, 효과, 재료(잔향), 스킬]
const L = [
  // ── 공룡수인 ──
  ['eHerdRoar', '몰이꾼의 함성', 'head', 2, ['brawl'], { str: 3, vit: 3 }, [on('kill', 0.25, buff('herd', 3, { moveSpeed: 1.15 }, '몰이', '#ffb070'), '처치하면 25% 확률로 3초 동안 이동 +15%')], { blood: 4, rust: 3 }, 'herdRoar'],
  ['eHeadbutt', '단단한 이마뼈', 'head', 2, ['brawl', 'giant'], { str: 4, pres: 2 }, [add('knockback', 30, '넉백 +30'), on('hit', 0.1, { stun: 0.3 }, '공격하면 10% 확률로 0.3초 기절')], { bone: 4, goo: 3 }, 'headbutt'],
  // ── 원소술사 ──
  ['eLightningChain', '번개 맺힌 손끝', 'arm', 2, ['wind'], { mag: 4, sen: 2 }, [on('crit', 0.3, st('shock'), '치명타면 30% 확률로 감전')], { wing: 4, mirror: 3 }, 'lightningChain'],
  ['eElemSurge', '세 원소의 고리', 'heart', 3, ['fire', 'ice'], { mag: 6, spi: 4 }, [mul('reactionMul', 1.15, '원소 반응 피해 +15%')], { ember: 4, frost: 4, mirror: 2 }, 'elemSurge'],
  ['eThunderStorm', '폭풍의 눈', 'head', 4, ['wind'], { mag: 9, sen: 5 }, [on('cast', 0.25, strike(44, 1.2, 'lightning', 'burst', { status: 'shock' }), '스킬을 쓰면 25% 확률로 둘레에 벼락')], { wing: 6, mirror: 5, core: 1 }, 'thunderStorm'],
  // ── 시간술사 ──
  ['eSlowField', '느린 모래', 'leg', 2, ['ice'], { spi: 4, mag: 2 }, [on('hurt', 0.2, st('chill', 2), '맞으면 20% 확률로 때린 적에게 냉기 2중첩')], { frost: 4, spore: 3 }, 'slowField'],
  ['eGravityCollapse', '무거운 별', 'heart', 3, ['giant'], { mag: 6, pres: 3 }, [mul('magAtk', 1.06, '마법 공격력 +6%')], { mirror: 4, icecore: 3, bone: 2 }, 'gravityCollapse'],
  ['eSingularity', '한 점의 어둠', 'heart', 4, ['curse'], { mag: 10, spi: 4 }, [on('kill', 0.3, strike(40, 1.0, 'arcane', 'implode'), '처치하면 30% 확률로 그 자리가 짓눌려 터진다')], { soul: 5, mirror: 5, witch: 1 }, 'singularity'],
  // ── 수호기사 ──
  ['eProvoke', '도전의 깃발', 'back', 2, ['reflect'], { pres: 4, vit: 2 }, [add('reflect', 6, '반사 +6%')], { rust: 4, bone: 3 }, 'provoke'],
  ['eUndying', '꺾이지 않는 심장', 'heart', 5, ['undying'], { vit: 12, pres: 8 }, [mul('dmgTakenMul', 0.92, '받는 피해 -8%'), on('hurt', 0.15, { shield: 0.05 }, '맞으면 15% 확률로 보호막(최대 체력 5%)')], { bone: 6, soul: 5, chief: 2, grave: 1 }, 'undying'],
  ['eJudgement', '심판의 저울', 'head', 4, ['reflect'], { pres: 8, mres: 6 }, [on('kill', 0.25, strike(44, 1.2, 'holy', 'holy'), '처치하면 25% 확률로 빛기둥')], { mirror: 5, bone: 5, chief: 1 }, 'judgement'],
  // ── 대검 · 공통 ──
  ['eSweep', '넓은 칼자국', 'arm', 2, ['bleed'], { str: 4, agi: 2 }, [on('hit', 0.12, st('bleed'), '공격하면 12% 확률로 출혈')], { rust: 4, blood: 3 }, 'sweep'],
  ['eSwordWave', '칼바람 흔적', 'arm', 2, ['wind'], { str: 3, sen: 3 }, [mul('atkSpeed', 1.05, '공격 속도 +5%')], { wing: 4, rust: 3 }, 'swordWave'],
  ['eCrushBlow', '쪼개진 모루', 'arm', 3, ['giant', 'brawl'], { str: 7, pres: 3 }, [add('critDmg', 0.2, '치명타 피해 +20%')], { rust: 5, cinder: 3, bone: 2 }, 'crushBlow'],
  ['eBladeStorm', '쉬지 않는 칼날', 'back', 4, ['brawl', 'bleed'], { str: 9, agi: 5 }, [on('kill', 0.3, buff('storm', 4, { atkSpeed: 1.15 }, '칼날 폭풍', '#e8e2cf'), '처치하면 30% 확률로 4초 동안 공격 속도 +15%')], { rust: 6, blood: 5, chief: 1 }, 'bladeStorm'],
  // ── 광전사 ──
  ['eBerserk', '끓는 피', 'heart', 3, ['brawl', 'drain'], { str: 6, vit: 4, lifesteal: 2 }, [mul('atkSpeed', 1.05, '공격 속도 +5%')], { blood: 5, magma: 3 }, 'berserkSkill'],
  ['eRageBurst', '터지는 분노', 'heart', 5, ['brawl', 'fire'], { str: 14, vit: 6 }, [mul('physAtk', 1.08, '물리 공격력 +8%'), on('hurt', 0.12, strike(48, 1.2, 'fire', 'burst'), '맞으면 12% 확률로 붉은 기운이 터진다')], { blood: 6, magma: 5, chief: 2, core: 1 }, 'rageBurst'],
  ['eEarthSplitter', '갈라진 대지', 'leg', 4, ['giant'], { str: 9, pres: 5 }, [on('dash', 1, strike(36, 0.8, 'phys', 'quake'), '대시가 끝난 자리를 내려찍는다 (피해 80%)')], { cinder: 5, bone: 5, chief: 1 }, 'earthSplitter'],
  // ── 투척 ──
  ['eRapidThrow', '가벼운 손목', 'arm', 2, ['wind'], { agi: 4, str: 2 }, [mul('atkSpeed', 1.06, '공격 속도 +6%')], { wing: 4, rust: 3 }, 'rapidThrow'],
  ['eGreatAxe', '무거운 도끼날', 'arm', 2, ['giant'], { str: 5, vit: 1 }, [add('critDmg', 0.15, '치명타 피해 +15%')], { rust: 5, bone: 2 }, 'greatAxe'],
  ['eLeap', '도약하는 다리', 'leg', 3, ['wind', 'brawl'], { agi: 5, str: 4 }, [mul('dashCd', 0.9, '대시 쿨타임 -10%')], { wing: 5, blood: 3 }, 'leap'],
  ['eAxeLegion', '도끼 군단의 깃발', 'back', 5, ['brawl'], { str: 12, agi: 8 }, [on('hit', 0.08, strike(30, 0.9, 'phys', 'sweep'), '공격하면 8% 확률로 도는 도끼가 벤다')], { rust: 7, cinder: 5, chief: 2, core: 1 }, 'axeLegion'],
  ['eTomahawkRain', '하늘의 도끼', 'arm', 3, ['brawl'], { str: 5, sen: 4 }, [on('crit', 0.2, strike(30, 0.8, 'phys', 'rocks'), '치명타면 20% 확률로 도끼가 떨어진다')], { rust: 5, wing: 3 }, 'tomahawkRain'],
  ['eWhirlingAxe', '휘도는 도끼날', 'arm', 4, ['brawl', 'bleed'], { str: 9, agi: 5 }, [on('hit', 0.12, st('bleed', 2), '공격하면 12% 확률로 출혈 2중첩')], { rust: 6, blood: 5, chief: 1 }, 'whirlingAxe'],
  // ── 사령술사 ──
  ['eRaiseSouls', '망자의 명부', 'head', 3, ['undying'], { spi: 6, mag: 3 }, [on('kill', 0.15, { heal: 0.012 }, '처치하면 15% 확률로 체력 1.2% 회복')], { bone: 5, soul: 4 }, 'raiseSouls'],
  ['eDeathCall', '부름의 종', 'head', 2, ['undying', 'reflect'], { spi: 3, pres: 3 }, [mul('dmgTakenMul', 0.96, '받는 피해 -4%')], { bone: 4, soul: 3 }, 'deathCall'],
  ['eSkeletons', '덜그럭 뼈 주머니', 'back', 2, ['undying'], { spi: 3, vit: 3 }, [add('regen', 0.0003, '초당 최대 HP 0.03% 회복')], { bone: 5, rot: 2 }, 'skeletons'],
  ['eWraiths', '망령의 실', 'back', 2, ['shadow'], { spi: 4, agi: 2 }, [add('dodge', 0.02, '회피 +2%')], { soul: 4, rot: 3 }, 'wraiths'],
  ['eSoulDrain', '영혼 빨대', 'arm', 2, ['drain'], { mag: 3, spi: 3, lifesteal: 2 }, [on('kill', 0.15, { res: 8 }, '처치하면 15% 확률로 자원 +8')], { soul: 4, blood: 3 }, 'soulDrain'],
  ['eBoneCage', '뼈 창살', 'leg', 2, ['undying', 'curse'], { pres: 3, spi: 3 }, [on('hurt', 0.15, st('curse'), '맞으면 15% 확률로 때린 적에게 저주')], { bone: 5, soul: 2 }, 'boneCage'],
  ['eCorpseBlast', '부푼 시체', 'heart', 3, ['poison', 'undying'], { mag: 5, toxicity: 3 }, [on('kill', 0.25, strike(36, 0.9, 'dark', 'corpse'), '처치하면 25% 확률로 적이 터진다')], { rot: 5, bone: 4 }, 'corpseBlast'],
  ['eGiantCorpse', '거인의 해골', 'heart', 3, ['giant', 'undying'], { vit: 6, spi: 3 }, [mul('maxHp', 1.06, '최대 HP +6%')], { bone: 6, queen: 1 }, 'giantCorpse'],
  ['eGraspWraith', '움켜쥐는 손', 'arm', 2, ['shadow', 'curse'], { spi: 4, mag: 2 }, [on('hit', 0.1, { stun: 0.3 }, '공격하면 10% 확률로 0.3초 기절')], { soul: 4, rot: 3 }, 'graspWraith'],
  ['eLichLord', '리치의 성물함', 'heart', 5, ['undying', 'curse'], { mag: 12, spi: 10 }, [mul('magAtk', 1.08, '마법 공격력 +8%'), on('kill', 0.2, { heal: 0.016 }, '처치하면 20% 확률로 체력 1.6% 회복')], { soul: 6, bone: 6, grave: 2 }, 'lichLord'],
  ['eDeathNova', '죽음의 숨', 'head', 4, ['curse', 'undying'], { mag: 9, spi: 5 }, [on('hurt', 0.15, strike(44, 1.0, 'dark', 'doom'), '맞으면 15% 확률로 죽음의 기운이 터진다')], { soul: 5, rot: 5, grave: 1 }, 'deathNova'],
  // ── 저주술사 ──
  ['eContagion', '옮는 저주', 'head', 3, ['curse', 'poison'], { mag: 5, toxicity: 4 }, [mul('statusDmgMul', 1.1, '상태이상 피해 +10%')], { rot: 5, venom: 3 }, 'contagion'],
  ['ePlagueNova', '역병의 씨', 'heart', 4, ['poison', 'curse'], { mag: 8, toxicity: 6 }, [on('kill', 0.3, { cloud: { r: 40, dur: 3 } }, '처치하면 30% 확률로 역병 구름')], { rot: 6, venom: 5, witch: 1 }, 'plagueNova'],
  // ── 그림자검 ──
  ['eStealth', '그림자 두건', 'head', 3, ['shadow'], { agi: 6, sen: 3 }, [add('dodge', 0.03, '회피 +3%'), add('crit', 0.03, '치명타 +3%')], { wing: 5, soul: 3 }, 'stealth'],
  ['eThousandCuts', '천 개의 칼집', 'arm', 4, ['shadow', 'bleed'], { agi: 9, sen: 5 }, [on('dodge', 1, st('bleed', 2), '회피하면 때린 적에게 출혈 2중첩')], { blood: 6, wing: 5, grave: 1 }, 'thousandCuts'],
  // ── 독사냥꾼 ──
  ['eBait', '썩은 미끼', 'arm', 2, ['poison'], { sen: 3, toxicity: 3 }, [mul('goldMul', 1.1, '골드 획득 +10%')], { spore: 4, rot: 3 }, 'bait'],
  ['eVenomBurst', '독주머니 왕관', 'head', 5, ['poison'], { toxicity: 12, agi: 6, sen: 4 }, [mul('statusDmgMul', 1.15, '상태이상 피해 +15%'), on('crit', 0.25, strike(40, 1.2, 'poison', 'miasma', { status: 'poison', stacks: 2 }), '치명타면 25% 확률로 독이 터진다')], { venom: 7, spore: 5, queen: 2 }, 'venomBurst'],
  // ── 정령사 ──
  ['eSummonSpirit', '정령의 부름', 'head', 2, ['wind'], { spi: 4, mag: 2 }, [mul('resGain', 1.06, '자원 회복 +6%')], { wing: 3, goo: 3, ember: 2 }, 'summonSpirit'],
  ['eSpiritEmpower', '정령의 숨결', 'heart', 3, ['wind'], { spi: 6, mag: 3 }, [mul('magAtk', 1.05, '마법 공격력 +5%')], { wing: 4, frost: 3, ember: 3 }, 'spiritEmpower'],
  ['eSpiritGuard', '정령의 품', 'back', 3, ['reflect'], { spi: 5, mres: 4 }, [on('hurt', 0.15, { shield: 0.04 }, '맞으면 15% 확률로 보호막(최대 체력 4%)')], { goo: 4, mirror: 4 }, 'spiritGuard'],
  ['eSpiritAbsorb', '생기 거두기', 'arm', 2, ['drain'], { spi: 3, vit: 3 }, [on('kill', 0.2, { heal: 0.008 }, '처치하면 20% 확률로 체력 0.8% 회복')], { goo: 4, spore: 3 }, 'spiritAbsorb'],
  ['eSpiritArrow', '정령의 깃', 'arm', 3, ['wind'], { sen: 5, spi: 4 }, [add('crit', 0.04, '치명타 +4%')], { wing: 5, mirror: 3 }, 'spiritArrow'],
  ['eSpiritKing', '정령왕의 왕관', 'head', 5, ['wind', 'giant'], { spi: 12, mag: 8 }, [mul('magAtk', 1.07, '마법 공격력 +7%'), on('cast', 0.2, strike(40, 1.0, 'wind', 'gale'), '스킬을 쓰면 20% 확률로 정령의 바람이 몰아친다')], { wing: 6, goo: 5, queen: 1, core: 1 }, 'spiritKing'],
  ['eSpiritBurst', '터지는 정령석', 'heart', 3, ['wind'], { spi: 5, mag: 4 }, [on('crit', 0.2, strike(30, 0.8, 'wind', 'gale'), '치명타면 20% 확률로 바람이 터진다')], { wing: 4, mirror: 4 }, 'spiritBurst'],
  // ── 순찰자 ──
  ['ePushArrow', '밀어내는 깃', 'arm', 2, ['wind'], { sen: 4, agi: 2 }, [add('knockback', 30, '넉백 +30')], { wing: 4, goo: 2 }, 'pushArrow'],
  ['eSkyPiercer', '하늘을 꿴 활시위', 'arm', 5, ['wind'], { sen: 14, agi: 6 }, [add('critDmg', 0.3, '치명타 피해 +30%'), add('crit', 0.04, '치명타 +4%')], { wing: 7, mirror: 5, core: 2 }, 'skyPiercer'],
  // ── 용기사 · 용현자 ──
  ['eSnatch', '움켜쥐는 발톱', 'arm', 3, ['fire', 'brawl'], { str: 6, agi: 3 }, [on('hit', 0.08, { stun: 0.4 }, '공격하면 8% 확률로 0.4초 기절')], { magma: 4, wing: 4 }, 'snatch'],
  ['eInfernoDive', '떨어지는 불꽃', 'leg', 4, ['fire'], { str: 8, vit: 6 }, [on('dash', 1, strike(34, 0.8, 'fire', 'burst', { status: 'burn' }), '대시가 끝난 자리에 불꽃이 터진다')], { magma: 6, ember: 5, core: 1 }, 'infernoDive'],
  ['eWordWing', '날개의 언령', 'back', 2, ['wind'], { spi: 4, agi: 2 }, [mul('dashCd', 0.93, '대시 쿨타임 -7%')], { wing: 4, cinder: 2 }, 'wordWing'],
  ['eWordSky', '하늘의 언령', 'head', 2, ['fire'], { mag: 4, spi: 2 }, [on('crit', 0.15, strike(28, 0.7, 'fire', 'meteor'), '치명타면 15% 확률로 작은 운석')], { ember: 4, cinder: 3 }, 'wordSky'],
  ['eWordScale', '비늘의 언령', 'leg', 2, ['reflect'], { pres: 4, spi: 2 }, [on('shield', 0.5, buff('scaleWord', 3, { dmgTakenMul: 0.9 }, '비늘', '#ffd27a'), '보호막을 얻으면 50% 확률로 3초 동안 받는 피해 -10%')], { cinder: 4, mirror: 2 }, 'wordScale'],
  ['eWordEarth', '대지의 언령', 'leg', 3, ['giant'], { spi: 5, pres: 4 }, [mul('dmgTakenMul', 0.95, '받는 피해 -5%')], { cinder: 5, bone: 3 }, 'wordEarth'],
  ['eWordSilence', '침묵의 언령', 'head', 5, ['curse'], { spi: 14, mag: 6 }, [mul('costMul', 0.9, '스킬 자원 -10%'), on('cast', 0.2, strike(40, 0.6, 'dark', 'doom', { status: 'curse', stacks: 2 }), '스킬을 쓰면 20% 확률로 둘레에 저주 2중첩')], { witch: 2, soul: 6, cinder: 5 }, 'wordSilence'],
  ['eWordThunder', '벼락의 언령', 'head', 3, ['wind'], { mag: 5, spi: 4 }, [on('crit', 0.25, st('shock'), '치명타면 25% 확률로 감전')], { wing: 5, ember: 3 }, 'wordThunder'],
  ['eWordCataclysm', '대재앙의 언령', 'heart', 4, ['fire'], { mag: 9, spi: 5 }, [mul('burnMul', 1.15, '화상 피해 +15%'), on('kill', 0.2, strike(40, 1.0, 'fire', 'pillar'), '처치하면 20% 확률로 불기둥')], { ember: 6, magma: 5, core: 1 }, 'wordCataclysm'],
  // ── 바위수호 · 서리 ──
  ['eCrystalPrison', '결정 감옥', 'leg', 3, ['ice', 'reflect'], { pres: 5, mres: 4 }, [on('hurt', 0.12, { stun: 0.5 }, '맞으면 12% 확률로 때린 적이 0.5초 결정에 갇힌다')], { mirror: 5, icecore: 3 }, 'crystalPrison'],
  ['eMeteorFall', '떨어진 별돌', 'heart', 4, ['giant', 'fire'], { pres: 8, str: 6 }, [on('kill', 0.25, strike(40, 1.0, 'phys', 'meteor'), '처치하면 25% 확률로 바위가 떨어진다')], { cinder: 6, magma: 5, core: 1 }, 'meteorFall'],
  ['eBlizzard', '눈보라의 심장', 'heart', 4, ['ice'], { vit: 8, mres: 6 }, [mul('chillMul', 1.15, '냉기 효과 +15%'), on('hurt', 0.15, st('chill', 2), '맞으면 15% 확률로 때린 적에게 냉기 2중첩')], { frost: 6, icecore: 5, meltcore: 1 }, 'blizzard'],
  // ── 배우는 기술 (클래스 없음) ──
  ['eEnchantLightning', '번개 숫돌', 'arm', 2, ['wind'], { str: 2, mag: 3 }, [on('hit', 0.08, st('shock'), '공격하면 8% 확률로 감전')], { wing: 4, mirror: 2 }, 'enchantLightning'],
  ['eStunStrike', '정수리 치기', 'arm', 2, ['brawl'], { str: 4, sen: 2 }, [on('crit', 0.2, { stun: 0.4 }, '치명타면 20% 확률로 0.4초 기절')], { rust: 4, bone: 2 }, 'stunStrike'],
  ['eBolas', '사냥꾼의 올가미', 'leg', 2, ['ice'], { agi: 3, sen: 3 }, [on('hit', 0.1, st('chill'), '공격하면 10% 확률로 냉기')], { frost: 3, rust: 3 }, 'bolas'],
  ['eQuakeStomp', '구르는 발', 'leg', 2, ['giant'], { vit: 3, pres: 3 }, [on('hurt', 0.12, strike(30, 0.6, 'phys', 'quake', { stun: 0.3 }), '맞으면 12% 확률로 땅을 굴러 밀쳐낸다')], { goo: 3, bone: 3 }, 'quakeStomp'],
  ['eFearShout', '겁주는 목청', 'head', 2, ['curse'], { str: 3, spi: 3 }, [on('hurt', 0.15, { fear: 1.5 }, '맞으면 15% 확률로 때린 적이 1.5초 겁에 질린다')], { blood: 3, soul: 3 }, 'fearShout'],
  ['eSilenceSeal', '봉인의 인장', 'head', 3, ['curse'], { spi: 6, mres: 3 }, [add('statusRes', 0.1, '받는 상태이상 지속 -10%')], { soul: 4, witch: 1 }, 'silenceSeal'],
];

export const SKILL_ENGS = L.map(([id, name, slot, grade, tags, stats, effects, recipe, skill]) => ({ id, name, slot, grade, tags, stats, effects, recipe: Object.fromEntries(Object.entries(recipe).filter(([, n]) => n > 0)), skill }));
export function registerSkillEngravings(ENGRAVINGS) {
  for (const e of SKILL_ENGS) ENGRAVINGS[e.id] = { name: e.name, slot: e.slot, grade: e.grade, load: [0, 2, 3, 5, 7, 10][e.grade], tags: e.tags, stats: e.stats, effects: e.effects, recipe: e.recipe };
}
export function registerSkillEngravingSkills(ENGRAVING_SKILLS) { for (const e of SKILL_ENGS) ENGRAVING_SKILLS[e.id] = e.skill; }

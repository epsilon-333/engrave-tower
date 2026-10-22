// 클래스와 액티브 스킬. 종족마다 클래스 2개, 클래스마다 스킬 6개(1·1·3·6·10·15레벨에 배움). 최대 4개 장착(Q·E·R·F).
// 콤보 역할: 준비(자원·약화) → 강화(버프) → 마무리(자원 소모 큰 한 방), 궁극(15레벨, 자원 전부)
// cost: 자원 소모, costAll: 자원 전부 소모(min 이상 필요, 소모량만큼 강해짐), gain: 자원 획득
// cast: 시전 시간(초, 시전 중 이동 불가), scale: 피해 기준 공격력(phys/mag/best)
// elem: fire/ice/lightning/poison/dark/phys/current(현재 속성)
// aim: 자동 조준 규칙 (생략하면 동작을 보고 정한다)
//   near 가까운 적 · tank 체력 높은 적 · low 체력 낮은 적 · cluster 적이 많이 모인 곳 · fresh 표식 없는 적
//   stack 상태이상이 많이 쌓인 적 · crowd 무리 속으로 · away 적이 없는 쪽 · back 적의 등 뒤 · none 조준 없음

export const ROLE_COLOR = { 준비: '#8fd0ff', 강화: '#ffcf5a', 마무리: '#ff7a6a', 제어: '#c9a8ff', 이동: '#bfe8d0', 방어: '#a8b0c8', 소환: '#9be15d', 전환: '#e8a8ff', 연타: '#ffb066', 공격: '#e8e0f4', 장판: '#7ad0b0', 궁극: '#ff5ad0' };
export const ELEM = {
  fire: { name: '화염', color: '#ff7a2a', status: 'burn' },
  ice: { name: '냉기', color: '#9fe3ff', status: 'chill' },
  lightning: { name: '번개', color: '#f8f070', status: 'shock' },
  poison: { name: '독', color: '#9be15d', status: 'poison' },
  dark: { name: '암흑', color: '#c45cff', status: 'curse' },
  arcane: { name: '비전', color: '#b98aff' },
  phys: { name: '물리', color: '#e8e0f4' },
  wind: { name: '바람', color: '#bfffd0' },
  forest: { name: '숲', color: '#7be38a' },
};
export const ELEM_CYCLE = ['fire', 'ice', 'lightning'];

// 클래스: 종족마다 2개. weapons = [시작 무기, 상위 무기], style = 각인 추천 필터, trait = 클래스 특성(평타·상시 효과)
// 각인 목록: 클래스마다 잘 맞는 각인의 태그 (공명 제단에서 '내 클래스'로 거를 때)
export const CLASS_TAGS = {
  predator: ['bleed', 'drain', 'brawl'], behemoth: ['giant', 'brawl', 'reflect'],
  elementalist: ['fire', 'ice'], chronomancer: ['ice', 'curse'],
  guardian: ['reflect', 'giant', 'undying'], greatsword: ['giant', 'brawl', 'bleed'],
  berserker: ['drain', 'brawl', 'undying'], thrower: ['brawl', 'giant', 'bleed'],
  necromancer: ['curse', 'poison', 'undying'], hexer: ['curse', 'poison'],
  shadowblade: ['shadow', 'bleed'], venomHunter: ['poison', 'shadow'],
  spiritcaller: ['wind', 'fire'], ranger: ['wind', 'bleed'],
  rockguard: ['reflect', 'giant', 'slime'], frostGolem: ['ice', 'giant'],
  dragoon: ['fire', 'brawl'], dragonSage: ['fire', 'curse'],
};
export const CLASSES = {
  predator: { race: 'dino', name: '포식자', desc: '물고 빠지며 출혈을 남기고, 피 냄새를 따라 쫓는다.', trait: '출혈 걸린 적에게 다가갈 때 이동 속도 +25%. 출혈 걸린 적을 때리면 체력이 조금씩 회복된다.', weapons: ['boneKnuckle', 'predatorFang'], style: 'blood',
    skills: ['pounce', 'rakeRetreat', 'maul', 'herdRoar', 'devour', 'apexPredator'] },
  behemoth: { race: 'dino', name: '대지 거수', desc: '달려들어 들이받는다. 날려 보낸 적이 벽이나 다른 적에 부딪히면 기절한다.', trait: '내가 밀쳐낸 적이 벽이나 다른 적에 부딪히면 피해를 받고 1초 기절한다.', weapons: ['stoneClub', 'tectonicHammer'], style: 'giant',
    skills: ['tailSwipe', 'rush', 'headbutt', 'tremor', 'hardenShell', 'extinction'] },
  elementalist: { race: 'wizard', name: '원소술사', desc: '서로 다른 속성을 한 적에게 겹쳐 반응을 일으킨다. 시전 중에는 움직일 수 없다.', trait: '평타는 마지막으로 쓴 스킬의 속성을 따라간다. 화염+냉기 증기 폭발, 냉기+번개 순간 빙결, 화염+번개 과부하.', weapons: ['elemStaff', 'triOrb'], style: 'fire',
    skills: ['flameBurst', 'frostChain', 'lightningChain', 'elemMark', 'elemSurge', 'grandFireball'] },
  chronomancer: { race: 'wizard', name: '시공술사', desc: '시간을 늦추고, 되감고, 공간을 접는다.', trait: '느려지거나 얼어 있는 적에게 주는 피해 +20%.', weapons: ['hourglassStaff', 'aeonPendulum'], style: 'frost',
    skills: ['arcaneBarrage', 'blinkBlast', 'slowField', 'rewind', 'gravityCollapse', 'timeStop'] },
  guardian: { race: 'knight', name: '수호기사', desc: '정면을 방패로 막고 받아친다.', trait: '정면에서 오는 피해 -25%, 정면으로 막을 때마다 오러 +4 · 받은 피해의 25%를 때린 적에게 되갚는다.', weapons: ['guardSword', 'bastionBlade'], style: 'mirror',
    skills: ['riposte', 'shieldCharge', 'provoke', 'ironWall', 'shieldBash', 'undying'] },
  greatsword: { race: 'knight', name: '대검술사', desc: '느리지만 묵직하다. 힘을 모을수록 강해진다.', trait: '「차지」 스킬은 길게 누르면 1~3단계로 힘을 모은다. 모으는 동안 받는 피해 -25%.', weapons: ['steelGreatsword', 'mountainCleaver'], style: 'giant',
    skills: ['comboSlash', 'dashSlash', 'swordWave', 'steadfast', 'crushBlow', 'skyfall'] },
  berserker: { race: 'orc', name: '광전사', desc: '맞을수록 분노가 차오르고, 분노가 높을수록 세진다.', trait: '분노 1당 공격력 +0.4% (분노 100이면 +40%). 분노를 쓰면 그만큼 약해진다.', weapons: ['twoHandAxe', 'bloodthirstAxe'], style: 'blood',
    skills: ['warCry', 'chargeSmash', 'crushingBlows', 'braceForIt', 'berserkSkill', 'rageBurst'] },
  thrower: { race: 'orc', name: '투척 전사', desc: '도끼를 휘두르고, 던지고, 작살로 끌어와 제압한다.', trait: '평타로 도끼를 휘두른다. 우클릭은 사방으로 도끼를 던지는 도끼 폭풍.', weapons: ['throwHatchet', 'twinReturnAxe'], style: 'giant',
    skills: ['harpoon', 'rapidThrow', 'greatAxe', 'groundSmash', 'leap', 'axeLegion'] },
  necromancer: { race: 'undead', name: '사령술사', desc: '해골 병사 · 붙잡는 망령 · 거대 시체 · 리치를 부려 싸운다. 부하는 쓰러질 때까지 남고, 약해진 부하는 터뜨린다.', weapons: ['skullStaff', 'deadScepter'], style: 'poison',
    skills: ['skeletons', 'graspWraith', 'soulDrain', 'corpseBlast', 'giantCorpse', 'lichLord'] },
  hexer: { race: 'undead', name: '저주술사', desc: '저주로 적의 행동을 벌하고, 저주를 옆으로 번지게 한다.', trait: '평타가 저주를 건다.', weapons: ['cursedDoll', 'doomTome'], style: 'poison',
    skills: ['curse', 'painLink', 'retribution', 'deathFog', 'contagion', 'doomBrand'] },
  shadowblade: { race: 'assassin', name: '그림자 칼날', desc: '숨었다가 등 뒤를 친다.', trait: '은신 중 첫 공격 3배.', weapons: ['twinDaggers', 'nightPiercer'], style: 'shadow',
    skills: ['shadowStep', 'weakMark', 'ambush', 'stealth', 'shadowEvade', 'shadowDance'] },
  venomHunter: { race: 'assassin', name: '독침 사냥꾼', desc: '덫을 깔고 미끼로 몬스터를 끌어들인다.', trait: '평타가 독을 건다.', weapons: ['blowgun', 'viperBlowgun'], style: 'poison',
    skills: ['snare', 'retreatShot', 'bait', 'dartFan', 'smokeBomb', 'venomBurst'] },
  spiritcaller: { race: 'elf', name: '정령사', desc: '정령과 계약해 함께 싸운다. 불러낸 정령이 버프를 주고 적을 공격한다.', trait: '정령을 셋까지 함께 데리고 다닌다(둘째 · 셋째는 버프 70%). 세계수 성지의 「정령 계약」에서 정령석을 바쳐 정령과 계약한다(속성 6 · 등급 4, 확률). 같은 정령과 또 계약하면 결속이 올라 강해진다. 「정령 부르기」로 함께하는 정령을 꺼낸다.', weapons: ['spiritBow', 'worldTreeBow'], style: 'wind',
    skills: ['summonSpirit', 'spiritAbsorb', 'spiritEmpower', 'spiritArrow', 'spiritGuard', 'spiritKing'] },
  ranger: { race: 'elf', name: '숲의 사수', desc: '멈춰서 집중하고 멀리서 꿰뚫는다.', trait: '가만히 서 있으면 집중이 쌓인다(0.5초마다 1단계, 최대 3). 다음 사격 피해 단계당 +25%.', weapons: ['rangerBow', 'galeLongbow'], style: 'wind',
    skills: ['pierceArrow', 'windStep', 'vineSnare', 'pushArrow', 'aimedShot', 'skyPiercer'] },
  rockguard: { race: 'golem', name: '바위 수호자', desc: '무엇이든 버티고 되돌려준다.', weapons: ['rockFist', 'mountainHeart'], style: 'mirror',
    skills: ['stoneSkin', 'reflectCrystal', 'quake', 'crystalPrison', 'rockTremor', 'colossus'] },
  frostGolem: { race: 'golem', name: '얼음 골렘', desc: '둔화시키고 얼린 뒤 깨부순다.', weapons: ['iceFist', 'permafrostCore'], style: 'frost',
    skills: ['iceChunk', 'frostField', 'frostCharge', 'iceArmor', 'glacialSpikes', 'absoluteZero'] },
  dragoon: { race: 'dragon', name: '화룡 전사', desc: '날아올라 내리꽂고, 적을 낚아채 떨어뜨린다.', trait: '불타는 적에게 주는 피해 +15% (용족).', weapons: ['dragonSpear', 'wyrmFang'], style: 'fire',
    skills: ['breath', 'dragonClaw', 'soar', 'snatch', 'scales', 'dragonForm'] },
  dragonSage: { race: 'dragon', name: '용언 술사', desc: '용의 말을 이어 문장을 만든다.', trait: '용언 스킬을 쓸 때마다 단어가 쌓이고, 3개가 차면 문장이 발동한다. 첫 단어가 문장의 몸통이라 순서가 바뀌면 다른 문장이 된다. 마력 언령(불 · 하늘)은 마력으로, 정신 언령(비늘 · 대지 · 날개)은 정신으로 힘이 정해진다. 같은 단어는 강세, 같은 계열은 합성, 다른 계열을 아무렇게나 이으면 말이 엇갈려 약해진다. 용의 혀로만 말할 수 있어 다른 종족은 배우지 못한다.', weapons: ['dragonTome', 'elderHeartstone'], style: 'fire',
    skills: ['wordFire', 'wordWing', 'wordSky', 'wordScale', 'wordEarth', 'wordSilence'] },
};
export const RACE_CLASSES = (race) => Object.keys(CLASSES).filter((k) => CLASSES[k].race === race);
export const UNLOCKS = [1, 1, 3, 6, 10, 15];

export const SKILLS = {
  // ══════ 공룡 수인 · 포식자 ══════
  pounce: { name: '덮치기', role: '이동', cd: 5, gain: 8, scale: 'phys', fx: 'dash', aim: 'crowd', mo: 'leap',
    desc: '적에게 날아들어 출혈 2중첩을 걸고 0.5초 기절시킨다. 본능 +8.', do: [{ op: 'dash', dist: 110, mul: 1.3, status: 'bleed', stacks: 2, stun: 0.5 }] },
  rakeRetreat: { name: '할퀴고 빠지기', role: '공격', cd: 4, gain: 6, scale: 'phys', fx: 'claws', mo: 'claw',
    desc: '앞쪽을 할퀴어 출혈 2중첩을 걸고 뒤로 뛰어 물러난다. 본능 +6.',
    do: [{ op: 'cone', range: 42, angle: 1.8, mul: 1.2, status: 'bleed', stacks: 2, fx: 'claws' }, { op: 'dash', dist: -80, mul: 0, delay: 0.08 }] },
  maul: { name: '물어 흔들기', role: '제어', cd: 9, cost: 15, scale: 'phys', fx: 'bite', aim: 'tank', mo: 'bite',
    desc: '적 하나를 2초 동안 물고 놓지 않는다(기절). 그동안 출혈이 계속 쌓인다. 본능 15.',
    do: [{ op: 'single', range: 46, mul: 0.6, stun: 2, status: 'bleed', stacks: 1, fx: 'bite' }, { op: 'channel', dur: 1.8, every: 0.3, sub: { op: 'single', range: 56, mul: 0.35, status: 'bleed', stacks: 1, fx: 'bite' } }] },
  herdRoar: { name: '몰이 포효', role: '제어', cd: 12, cost: 20, scale: 'phys', fx: 'roar', mo: 'roar',
    desc: '가장 가까운 적 하나만 빼고 주변 적을 3초 동안 도망치게 한다. 본능 20.', do: [{ op: 'aoe', at: 'self', r: 110, mul: 0.2, flee: 3, spareNearest: true }] },
  devour: { name: '포식', role: '마무리', cd: 7, cost: 30, scale: 'phys', fx: 'bite', aim: 'stack', mo: 'bite',
    desc: '크게 문다. 그 적의 출혈 중첩만큼 체력을 회복한다(중첩당 1.5%). 출혈은 그대로 남는다. 본능 30.', do: [{ op: 'single', range: 54, mul: 2.6, healPerBleed: 0.015, fx: 'bite' }] },
  apexPredator: { name: '최상위 포식자', role: '궁극', cd: 30, costAll: { min: 60 }, scale: 'phys', fx: 'buff', ult: true, mo: 'roar',
    desc: '12초 동안 이동 속도 +40%, 모든 공격에 출혈 2중첩, 흡혈 +15%. 본능이 많을수록 공격력도 오른다.',
    do: [{ op: 'aoe', at: 'self', r: 90, mul: 1.0, status: 'bleed', stacks: 2, fx: 'roar' }, { op: 'buff', id: 'apex', dur: 12, mods: { moveSpeed: 1.4, lifesteal: 15, dmgMul: 1.1 }, color: '#e0445a', scaleRes: true }] },

  // ══════ 공룡 수인 · 대지 거수 ══════
  tailSwipe: { name: '꼬리 휘두르기', role: '공격', cd: 4, gain: 10, scale: 'phys', fx: 'spin', mo: 'spin',
    desc: '꼬리로 주변을 한 바퀴 쳐서 밀쳐낸다. 본능 +10.', do: [{ op: 'aoe', at: 'self', r: 54, mul: 1.1, knock: 190, fx: 'spin' }] },
  rush: { name: '돌격', role: '이동', cd: 8, cost: 10, scale: 'phys', fx: 'dash', aim: 'crowd', mo: 'charge', hold: true,
    desc: '누르고 있는 동안 최대 2초 달린다. 앞의 적을 밀고 가며, 오래 달릴수록 부딪히는 피해가 커진다. 본능 10.', do: [{ op: 'rush', dur: 2, speed: 230, mul: 0.8 }] },
  headbutt: { name: '박치기', role: '공격', cd: 6, cost: 15, scale: 'phys', fx: 'smash', aim: 'near', mo: 'headbutt',
    desc: '적 하나를 멀리 날려 보낸다. 날아간 적이 부딪힌 적도 함께 기절한다. 본능 15.', do: [{ op: 'single', range: 46, mul: 1.6, knock: 460, launch: true }] },
  tremor: { name: '지축 울림', role: '제어', cd: 11, cost: 25, scale: 'phys', fx: 'quake', mo: 'stomp',
    desc: '발을 굴러 주변 적을 1.5초 기절시킨다. 본능 25.', do: [{ op: 'aoe', at: 'self', r: 80, mul: 1.3, stun: 1.5 }] },
  hardenShell: { name: '껍질 굳히기', role: '방어', cd: 14, gain: 15, scale: 'phys', fx: 'bubble', mo: 'guard',
    desc: '6초 동안 받는 피해 -35%, 나에게 닿는 적을 튕겨낸다. 본능 +15.',
    do: [{ op: 'buff', id: 'shell', dur: 6, mods: { dmgTakenMul: 0.65 }, color: '#c8b088', bubble: true }] },
  extinction: { name: '대멸종', role: '궁극', cd: 32, costAll: { min: 60 }, scale: 'phys', fx: 'quake', ult: true, mo: 'stomp',
    desc: '10초 동안 거대해지고 빨라진다. 받는 피해 -40%, 닿는 적을 모두 들이받아 튕겨낸다. 본능이 많을수록 강하다.',
    do: [{ op: 'aoe', at: 'self', r: 110, mul: 2.2, stun: 1.0, scaleRes: true, knock: 260, fx: 'quake' }, { op: 'buff', id: 'giant', dur: 10, mods: { dmgTakenMul: 0.6, moveSpeed: 1.45, dmgMul: 1.2 }, color: '#ffb066', scaleRes: true }] },

  // ══════ 마법사 · 원소술사 (시전 중 이동 불가) ══════
  flameBurst: { name: '화염 작렬', role: '공격', cd: 2.5, cost: 12, cast: 0.3, elem: 'fire', scale: 'mag', fx: 'bolt', mo: 'cast',
    desc: '터지면서 주변에도 화상 2중첩을 거는 화염구. 마력 12.', do: [{ op: 'proj', n: 1, speed: 270, range: 220, mul: 1.6, splash: 36, stacks: 2, kind: 'fireball' }] },
  frostChain: { name: '서리 사슬', role: '제어', cd: 6, cost: 18, cast: 0.4, elem: 'ice', scale: 'mag', fx: 'ice', mo: 'cast',
    desc: '얼음 사슬이 적 2마리를 꿰뚫어 냉기 3중첩, 1.2초 속박. 마력 18.', do: [{ op: 'proj', n: 1, speed: 260, range: 210, mul: 1.3, stacks: 3, stun: 1.2, kind: 'ice', pierce: 2 }] },
  lightningChain: { name: '번개 사슬', role: '공격', cd: 5, cost: 22, cast: 0.45, elem: 'lightning', scale: 'mag', fx: 'bolt', mo: 'castBig',
    desc: '번개가 적 사이를 6번 튄다. 감전된 적은 받는 피해 +15%. 마력 22.', do: [{ op: 'chain', jumps: 6, range: 95, mul: 1.45, stacks: 1 }] },
  elemMark: { name: '원소 표식', role: '준비', cd: 9, cost: 8, cast: 0.2, scale: 'mag', fx: 'rune', aim: 'fresh', mo: 'cast',
    desc: '표식 범위의 적에게 8초 동안 속성 피해 +40%, 원소 반응 피해 +50%. 마력 8.', do: [{ op: 'aoe', at: 'aim', r: 56, mul: 0.2, mark: 8 }] },
  elemSurge: { name: '원소 폭주', role: '강화', cd: 16, cost: 30, scale: 'mag', fx: 'buff', mo: 'castBig',
    desc: '6초 동안 모든 속성 공격이 다음 속성(화염→냉기→번개)까지 함께 남긴다. 마력 30.',
    do: [{ op: 'buff', id: 'surge', dur: 6, mods: {}, color: '#e8a8ff' }] },
  grandFireball: { name: '거대 화염구', role: '궁극', cd: 22, cost: 60, cast: 1.3, elem: 'fire', scale: 'mag', fx: 'meteor', ult: true, aim: 'cluster', mo: 'castBig',
    desc: '하늘에서 거대한 불덩이가 떨어진다. 넓은 범위에 엄청난 피해와 화상 5중첩, 표식 대상에게 효과가 크다. 마력 60.',
    do: [{ op: 'aoe', at: 'aim', r: 96, mul: 5.2, stacks: 5, bonusIf: 'marked', delay: 0.7, fall: 'fireball', fx: 'meteor' }] },

  // ══════ 마법사 · 시공술사 ══════
  arcaneBarrage: { name: '비전 연발', role: '공격', cd: 3, cost: 14, cast: 0.3, scale: 'mag', elem: 'arcane', fx: 'bolt', mo: 'cast',
    desc: '적을 쫓아가는 비전 화살 7발을 연달아 쏜다. 마력 14.',
    do: [{ op: 'channel', dur: 0.7, every: 0.1, sub: { op: 'proj', n: 1, speed: 300, range: 260, mul: 0.75, homing: true, kind: 'arcane' } }] },
  blinkBlast: { name: '점멸', role: '이동', cd: 5, cost: 12, scale: 'mag', elem: 'arcane', fx: 'blink', aim: 'away', mo: 'cast',
    desc: '순간이동한다. 떠난 자리에 남은 잔상이 1.5초 뒤 비전 폭발을 일으킨다. 마력 12.',
    do: [{ op: 'teleport', dist: 110, echo: { delay: 1.5, r: 56, mul: 1.8 } }] },
  slowField: { name: '시간 감속장', role: '장판', cd: 12, cost: 20, cast: 0.3, scale: 'mag', elem: 'arcane', fx: 'rune', aim: 'cluster', mo: 'cast',
    desc: '6초 동안 시간이 느려지는 장판. 안의 적과 적 투사체가 60% 느려지고, 받는 피해 +20%. 마력 20.',
    do: [{ op: 'zone', kind: 'slow', r: 72, dur: 6, at: 'aim' }] },
  rewind: { name: '되감기', role: '방어', cd: 18, cost: 25, scale: 'mag', fx: 'blink', aim: 'none', mo: 'castBig',
    desc: '3초 전의 위치와 체력으로 돌아간다(지금 체력이 더 높으면 그대로). 마력 25.', do: [{ op: 'rewind', sec: 3 }] },
  gravityCollapse: { name: '중력 붕괴', role: '마무리', cd: 9, cost: 30, cast: 0.5, scale: 'mag', elem: 'arcane', fx: 'burst', aim: 'cluster', mo: 'castBig',
    desc: '한 점으로 적들을 끌어모은 뒤 짓눌러 폭발시킨다. 모인 적이 많을수록 강하다. 마력 30.',
    do: [{ op: 'aoe', at: 'aim', r: 100, mul: 0.3, pullTo: true, fx: 'gravity' }, { op: 'aoe', at: 'aim', r: 60, mul: 2.6, perHit: 0.15, delay: 0.45, fx: 'implode' }] },
  timeStop: { name: '시간 정지', role: '궁극', cd: 34, costAll: { min: 60 }, cast: 0.6, scale: 'mag', elem: 'arcane', fx: 'timestop', ult: true, mo: 'castBig',
    desc: '주변의 시간을 3초 동안 멈춘다. 멈춘 적은 받는 피해 +50%, 풀리는 순간 비전 폭발.',
    do: [{ op: 'aoe', at: 'self', r: 150, mul: 0.5, stun: 3, freezeTime: 3, fx: 'timestop' }, { op: 'aoe', at: 'self', r: 150, mul: 2.5, scaleRes: true, delay: 3, fx: 'arcane' }] },

  // ══════ 기사 · 수호기사 (오러) ══════
  riposte: { name: '받아치기', role: '방어', cd: 7, scale: 'phys', fx: 'parry', mo: 'guard',
    desc: '0.8초 동안 막기 자세. 그사이 공격받으면 무효로 하고 반격, 주변 적 1.5초 기절, 오러 +30.', do: [{ op: 'parry', dur: 0.8, mul: 2.6, r: 54, gain: 30, stun: 1.5 }] },
  shieldCharge: { name: '방패 돌진', role: '이동', cd: 6, gain: 10, scale: 'phys', fx: 'dash', aim: 'crowd', mo: 'charge',
    desc: '방패를 들고 멀리 돌진해 길 위의 적에게 공격력 160% 피해, 밀쳐내고 0.8초 기절시킨다. 오러 +10.', do: [{ op: 'dash', dist: 125, mul: 1.6, knock: 220, stun: 0.8 }] },
  provoke: { name: '도발', role: '제어', cd: 10, cost: 10, scale: 'phys', fx: 'roar', aim: 'none', mo: 'roar',
    desc: '주변 적이 6초 동안 나만 노린다. 원거리 적도 거리를 두지 않고 다가온다. 오러 10.', do: [{ op: 'provoke', r: 130, dur: 6 }] },
  ironWall: { name: '철벽', role: '방어', cd: 14, cost: 15, scale: 'phys', fx: 'bubble', mo: 'guard',
    desc: '4초 동안 정면 피해를 완전히 막고, 막은 피해의 80%를 때린 적에게 되돌려 준다. 그동안 오러를 2배로 얻는다. 오러 15.',
    do: [{ op: 'buff', id: 'ironWall', dur: 4, mods: {}, color: '#a8c8ff', bubble: true }] },
  shieldBash: { name: '방패 강타', role: '마무리', cd: 8, cost: 30, scale: 'phys', fx: 'smash', aim: 'tank', mo: 'bash',
    desc: '오러를 실어 방패로 내리친다. 공격력 360% 피해와 1.5초 기절, 강하게 밀쳐낸다. 오러 30.', do: [{ op: 'single', range: 50, mul: 3.6, stun: 1.5, knock: 260 }] },
  undying: { name: '불굴', role: '궁극', cd: 40, costAll: { min: 50 }, scale: 'phys', fx: 'buff', ult: true, mo: 'power',
    desc: '8초 동안 체력이 1 아래로 떨어지지 않고, 받는 피해 -30%. 받은 피해만큼 오러가 차오르고 주변에 충격파.',
    do: [{ op: 'aoe', at: 'self', r: 90, mul: 2.2, scaleRes: true, knock: 200, fx: 'holy' }, { op: 'buff', id: 'undying', dur: 8, mods: { dmgTakenMul: 0.7 }, color: '#ffd84a', bubble: true }] },

  // ══════ 기사 · 대검술사 (차지) ══════
  sweep: { name: '횡베기', role: '공격', cd: 5, gain: 12, scale: 'phys', fx: 'sweep', mo: 'sweep', charge: true,
    desc: '[차지] 넓은 반원을 베어 밀쳐낸다. 모을수록 범위와 피해가 커진다. 오러 +12.', do: [{ op: 'cone', range: 62, angle: 3.0, mul: 1.5, knock: 150, fx: 'sweep', chargeRange: 0.25 }] },
  comboSlash: { name: '연속베기', role: '공격', cd: 5, gain: 12, scale: 'phys', fx: 'spin', mo: 'spin',
    desc: '앞으로 나아가며 몸을 돌려 세 번 벤다. 한 바퀴마다 둘레의 적을 베고 밀쳐내며, 세 번째가 가장 세다. 오러 +12.',
    do: [{ op: 'comboSpin', n: 3, every: 0.22, step: 24, r: 54, mul: 0.95, last: 1.7, knock: 120 }] },
  dashSlash: { name: '돌진 베기', role: '이동', cd: 7, gain: 8, scale: 'phys', fx: 'dash', aim: 'crowd', mo: 'dashSlash', charge: true,
    desc: '[차지] 앞으로 돌진하며 벤다. 모을수록 멀리 간다. 오러 +8.', do: [{ op: 'dash', dist: 90, mul: 1.4, chargeDist: 40 }] },
  swordWave: { name: '검기 날리기', role: '공격', cd: 6, cost: 15, scale: 'phys', fx: 'wave', mo: 'overhead', charge: true,
    desc: '[차지] 거대한 검기를 날린다. 3단계까지 모으면 모든 적을 관통한다. 오러 15.', do: [{ op: 'proj', n: 1, speed: 300, range: 240, mul: 1.8, pierce: 1, kind: 'wave', fullPierce: true }] },
  steadfast: { name: '버티기 자세', role: '방어', cd: 15, cost: 10, scale: 'phys', fx: 'charge', mo: 'guard',
    desc: '4초 동안 받는 피해 -30%. 그동안 받은 피해의 3배가 다음 공격이나 스킬에 더해진다. 오러 10.',
    do: [{ op: 'buff', id: 'steadfast', dur: 4, mods: { dmgTakenMul: 0.7 }, color: '#ffe080', bubble: true }] },
  crushBlow: { name: '파쇄 일격', role: '마무리', cd: 8, cost: 40, scale: 'phys', fx: 'smash', aim: 'tank', mo: 'overhead', charge: true,
    desc: '[차지] 대검을 내리찍는다. 방어 50% 무시, 갑옷 부수기 3중첩. 오러 40.',
    do: [{ op: 'aoe', at: 'front', dist: 34, r: 50, mul: 2.8, pen: 0.5, armorBreak: 3, fx: 'quake' }] },
  skyfall: { name: '천붕참', role: '궁극', cd: 30, costAll: { min: 60 }, cast: 0.5, scale: 'phys', fx: 'skyfall', ult: true, aim: 'cluster', mo: 'overhead',
    desc: '하늘을 가르는 거대한 일격. 앞으로 길게 뻗는 참격이 일직선의 적 모두에게 엄청난 피해.',
    do: [{ op: 'line', len: 260, w: 40, mul: 5.0, scaleRes: true, stun: 0.8, delay: 0.15, fx: 'skyfall' }] },

  // ══════ 오크 · 광전사 (분노) ══════
  warCry: { name: '전투 함성', role: '준비', cd: 12, gain: 30, scale: 'phys', fx: 'roar', mo: 'roar',
    desc: '분노 +30. 주변 적을 약화시킨다(받는 피해 +35%, 5초).', do: [{ op: 'aoe', at: 'self', r: 84, mul: 0.3, weak: 5 }] },
  chargeSmash: { name: '돌진 강타', role: '이동', cd: 6, gain: 10, scale: 'phys', fx: 'dash', aim: 'crowd', mo: 'leap',
    desc: '돌진한 뒤 도착한 곳을 내려찍는다. 분노 +10.', do: [{ op: 'dash', dist: 110, mul: 0.8 }, { op: 'aoe', at: 'self', r: 50, mul: 1.6, delay: 0.18, fx: 'slam' }] },
  crushingBlows: { name: '분쇄 연타', role: '연타', cd: 7, cost: 15, scale: 'phys', fx: 'smash', mo: 'chop',
    desc: '세 번 연달아 내려친다. 마지막 타격이 1초 기절시킨다. 분노 15.',
    do: [{ op: 'channel', dur: 0.4, every: 0.2, sub: { op: 'aoe', at: 'front', dist: 26, r: 34, mul: 0.9, fx: 'slam' } }, { op: 'aoe', at: 'front', dist: 26, r: 40, mul: 1.4, stun: 1, delay: 0.45, fx: 'quake' }] },
  braceForIt: { name: '맞받기', role: '방어', cd: 14, scale: 'phys', fx: 'bubble', mo: 'guard',
    desc: '4초 동안 받는 피해 -30%, 맞을 때 얻는 분노 2배.', do: [{ op: 'buff', id: 'brace', dur: 4, mods: { dmgTakenMul: 0.7 }, color: '#ff8a5a', bubble: true }] },
  berserkSkill: { name: '광전사화', role: '강화', cd: 18, cost: 20, scale: 'phys', fx: 'buff', mo: 'power',
    desc: '8초 동안 분노가 저절로 줄지 않고 공격 속도 +35%. 분노 20.',
    do: [{ op: 'buff', id: 'berserk', dur: 8, mods: { atkSpeed: 1.35 }, color: '#ff3a2a' }] },
  rageBurst: { name: '분노 폭발', role: '궁극', cd: 20, costAll: { min: 50 }, scale: 'phys', fx: 'rage', ult: true, mo: 'overhead',
    desc: '분노를 모두 쏟아 주변을 내려친다. 몸에서 붉은 기운이 터져 나와 땅이 갈라진다. 분노가 많을수록 강하다.', do: [{ op: 'aoe', at: 'self', r: 92, mul: 3.4, scaleRes: true, knock: 220, fx: 'rage' }] },

  // ══════ 오크 · 투척 전사 ══════
  harpoon: { name: '작살', role: '제어', cd: 7, cost: 10, scale: 'phys', fx: 'throw', aim: 'tank', mo: 'throw',
    desc: '작살을 던져 맞은 적을 내 앞으로 끌어오고 0.6초 기절. 분노 10.', do: [{ op: 'proj', n: 1, speed: 340, range: 230, mul: 1.2, pull: true, stun: 0.6, kind: 'harpoon' }] },
  rapidThrow: { name: '연속 투척', role: '연타', cd: 6, cost: 15, scale: 'phys', fx: 'throw', mo: 'throw',
    desc: '도끼 3자루를 연달아 던진다. 도끼는 끝까지 날아갔다가 돌아오며 한 번 더 벤다. 분노 15.',
    do: [{ op: 'channel', dur: 0.48, every: 0.16, sub: { op: 'proj', n: 1, spread: 0, speed: 260, range: 190, mul: 0.8, kind: 'axe', boomerang: true, pierce: 99 } }] },
  greatAxe: { name: '거대 도끼', role: '공격', cd: 7, cost: 20, scale: 'phys', fx: 'throw', aim: 'cluster', mo: 'throwBig',
    desc: '느리게 날아가는 큰 도끼. 모든 적을 관통하고 갑옷 부수기 3중첩. 분노 20.', do: [{ op: 'proj', n: 1, speed: 150, range: 230, mul: 2.2, pierce: 99, armorBreak: 3, kind: 'bigaxe' }] },
  groundSmash: { name: '지면 분쇄', role: '제어', cd: 9, cost: 25, scale: 'phys', fx: 'quake', mo: 'stomp',
    desc: '땅을 깨뜨려 주변 적에게 피해와 1초 기절, 둔화. 분노 25.', do: [{ op: 'aoe', at: 'self', r: 74, mul: 1.6, stun: 1.0, status: 'chill', stacks: 2 }] },
  leap: { name: '도약', role: '이동', cd: 7, gain: 15, scale: 'phys', fx: 'slam', aim: 'cluster', mo: 'leap',
    desc: '조준한 곳으로 뛰어올라 착지하며 주변 적을 밀쳐낸다. 공중에서는 무적. 분노 +15.', do: [{ op: 'leap', dist: 130, air: 0.38, r: 52, mul: 1.3, knock: 170 }] },
  axeLegion: { name: '도끼 군단', role: '궁극', cd: 28, costAll: { min: 50 }, scale: 'phys', fx: 'throw', ult: true, aim: 'none', mo: 'power',
    desc: '8초 동안 도끼 6자루가 내 주위를 돌며 적을 베고, 평타를 휘두를 때마다 도끼 3자루가 함께 날아간다. 분노가 많을수록 강하다.',
    do: [{ op: 'buff', id: 'axeLegion', dur: 8, mods: {}, color: '#e8e0f4', scaleRes: true }, { op: 'orbit', n: 6, dur: 8, r: 30, mul: 0.6 }] },

  // ══════ 언데드 · 사령술사 ══════
  raiseSouls: { name: '망자 부르기', role: '소환', cd: 6, cost: 15, scale: 'mag', fx: 'summon', aim: 'none',
    desc: '해골 전사 둘과 뼈 방패병 하나를 부른다. 쓰러질 때까지 남고 다른 곳에 가도 따라온다 (첫 한 대는 막는다). 부하는 최대 10마리. 영혼 15.',
    do: [{ op: 'raiseSouls', n: 10 }] },
  deathCall: { name: '망자의 부름', role: '제어', cd: 10, cost: 15, scale: 'mag', fx: 'roar', aim: 'none',
    desc: '내 부하들이 울부짖어 주변 적의 시선을 끈다. 6초 동안 적들이 부하만 노리고, 부하는 받는 피해 -30%.',
    do: [{ op: 'taunt', r: 110, dur: 6 }] },
  skeletons: { name: '해골 병사', role: '소환', cd: 12, cost: 20, scale: 'mag', fx: 'summon',
    desc: '쓰러질 때까지 싸우는 해골 병사 2마리를 부른다 (최대 4마리). 체력이 있어서 적의 공격을 받아낼 수 있다.', do: [{ op: 'summon', kind: 'skeleton', n: 2, dur: 20, mul: 0.55, perm: true, max: 4 }] },
  wraiths: { name: '망령 소환', role: '소환', cd: 14, cost: 20, scale: 'mag', fx: 'summon',
    desc: '10초 동안 적을 쫓는 망령 2마리를 부른다.', do: [{ op: 'summon', kind: 'ghost', n: 2, dur: 10, mul: 0.5 }] },
  soulDrain: { name: '영혼 흡수', role: '준비', cd: 3, scale: 'mag', elem: 'dark', fx: 'soul',
    desc: '영혼을 빨아들이는 탄. 맞히면 영혼 +12, 체력 3% 회복.', do: [{ op: 'proj', n: 1, speed: 240, range: 210, mul: 1.5, kind: 'soul', onHitGain: 12, onHitHeal: 0.03 }] },
  boneCage: { name: '뼈 감옥', role: '제어', cd: 11, cost: 15, scale: 'mag', fx: 'bones', aim: 'tank',
    desc: '뼈 우리로 적을 2.5초 가둔다. 갇힌 적은 받는 피해 +30%.', do: [{ op: 'aoe', at: 'aim', r: 36, mul: 0.4, stun: 2.5, prison: true, fx: 'bones' }] },
  corpseBlast: { name: '시체 폭발', role: '마무리', cd: 8, cost: 25, scale: 'mag', elem: 'dark', fx: 'burst', aim: 'none',
    desc: '체력이 가장 낮은 부하 3마리만 터뜨려 큰 범위 피해. 부하의 최대 체력이 클수록 강하다. 부하가 없으면 근처 적 하나를 터뜨린다.', do: [{ op: 'blastSummons', r: 64, mul: 2.4, n: 3 }] },
  giantCorpse: { name: '거대 시체', role: '소환', cd: 25, cost: 30, scale: 'mag', fx: 'summon',
    desc: '쓰러질 때까지 싸우는 거대 시체를 부른다 (하나만). 느리지만 체력이 많고, 내려쳐 둘레 적에게 피해와 저주. 다른 곳에 가도 따라온다.',
    do: [{ op: 'summon', kind: 'lich', n: 1, dur: 15, mul: 1.6, perm: true, max: 1 }] },
  graspWraith: { name: '붙잡는 망령', role: '소환', cd: 14, cost: 20, scale: 'mag', fx: 'summon', aim: 'none',
    desc: '나와 일정 거리를 두고 떠 있는 망령을 부른다 (하나만 · 쓰러질 때까지). 5초 동안 기를 모은 뒤 팔을 길게 뻗어, 나와 가장 가까운 적(200 안)을 자기 쪽으로 끌어온다 (정예는 반쯤). 영혼 20.',
    do: [{ op: 'summon', kind: 'grasper', n: 1, dur: 15, mul: 0.4, perm: true, max: 1 }] },
  lichLord: { name: '리치 소환', role: '궁극', cd: 40, costAll: { min: 60 }, scale: 'mag', fx: 'summon', ult: true,
    desc: '쓰러질 때까지 싸우는 해골 마법사 리치를 부른다 (하나만). 떨어져서 어둠 탄을 쏘고, 8초마다 해골 병사를 하나 일으킨다 (리치의 해골은 15초 · 최대 3). 영혼이 많을수록 강하다. 다른 곳에 가도 따라온다.',
    do: [{ op: 'summon', kind: 'lichMage', n: 1, dur: 15, mul: 1.5, scaleRes: true, perm: true, max: 1 }] },

  // ══════ 언데드 · 저주술사 ══════
  curse: { name: '저주', role: '준비', cd: 4, gain: 8, scale: 'mag', elem: 'dark', fx: 'rune', aim: 'cluster', mo: 'cast',
    desc: '적이 모인 곳에 저주(지속 피해, 쌓일수록 강함)를 3중첩. 영혼 +8.', do: [{ op: 'aoe', at: 'aim', r: 50, mul: 0.3, stacks: 3 }] },
  painLink: { name: '고통 연결', role: '제어', cd: 12, cost: 15, scale: 'mag', elem: 'dark', fx: 'rune', aim: 'cluster', mo: 'cast',
    desc: '조준한 곳의 적 최대 3마리를 6초 동안 사슬로 잇는다. 한 마리가 받은 피해의 50%를 나머지도 받는다. 영혼 15.', do: [{ op: 'link', r: 80, n: 3, dur: 6, share: 0.5 }] },
  retribution: { name: '응보의 저주', role: '제어', cd: 10, cost: 12, scale: 'mag', elem: 'dark', fx: 'rune', aim: 'cluster', mo: 'cast',
    desc: '6초 동안 걸린 적이 나를 공격하면 그 공격력의 2배 피해를 자기가 받는다. 영혼 12.', do: [{ op: 'aoe', at: 'aim', r: 60, mul: 0.2, retrib: 6, stacks: 1 }] },
  deathFog: { name: '죽음의 안개', role: '장판', cd: 12, cost: 20, scale: 'mag', elem: 'dark', fx: 'fog', aim: 'cluster', mo: 'castBig',
    desc: '6초 안개. 안의 적은 지속 피해, 받는 피해 +20%, 저주가 저절로 쌓인다. 영혼 20.', do: [{ op: 'zone', kind: 'fog', r: 66, dur: 6, at: 'aim' }] },
  contagion: { name: '전염', role: '마무리', cd: 8, cost: 25, scale: 'mag', elem: 'dark', fx: 'burst', aim: 'none', mo: 'castBig',
    desc: '저주받은 모든 적의 저주가 주변 적에게 번진다. 번질 때 중첩이 2배가 된다. 영혼 25.', do: [{ op: 'spread', what: 'curse', r: 70, mul: 0.4 }] },
  doomBrand: { name: '파멸의 낙인', role: '궁극', cd: 28, costAll: { min: 50 }, scale: 'mag', elem: 'dark', fx: 'doom', ult: true, aim: 'tank', mo: 'castBig',
    desc: '적 하나에 낙인. 큰 피해를 주고, 그 적이 죽으면 주변 모든 적에게 저주 6중첩과 폭발이 퍼진다.',
    do: [{ op: 'single', range: 220, mul: 3.0, scaleRes: true, doom: true, stacks: 5 }] },

  // ══════ 암살자 · 그림자 칼날 ══════
  shadowStep: { name: '그림자 이동', role: '이동', cd: 4, cost: 15, scale: 'phys', fx: 'blink', aim: 'back', mo: 'dash',
    desc: '가장 위협적인 적의 등 뒤로 순간이동한다. 그림자 15.', do: [{ op: 'teleport', dist: 110 }] },
  weakMark: { name: '약점 표식', role: '준비', cd: 7, gain: 10, scale: 'phys', fx: 'rune', aim: 'fresh', mo: 'point',
    desc: '적의 약점을 드러낸다. 8초 동안 받는 피해 +35%. 그림자 +10.', do: [{ op: 'single', range: 180, mul: 0.2, weak: 8 }] },
  ambush: { name: '급습', role: '연타', cd: 6, gain: 10, scale: 'phys', fx: 'dash', mo: 'stab',
    desc: '겨눈 적(없으면 가장 가까운 적)의 등 뒤로 순식간에 옮겨 가 3번 찌른다. 등 뒤에서 치니 1.5배, 출혈. 그림자 +10.',
    do: [{ op: 'behind', range: 220 }, { op: 'channel', dur: 0.36, every: 0.12, sub: { op: 'single', range: 40, mul: 0.8, backstab: true, status: 'bleed', stacks: 1, fx: 'stab' } }] },
  stealth: { name: '은신', role: '방어', cd: 14, cost: 20, scale: 'phys', fx: 'smoke', aim: 'none', mo: 'crouch',
    desc: '6초 동안 모습을 감춘다. 적이 나를 놓치고, 은신 중 첫 공격은 2배. 공격하면 풀린다. 그림자 20.', do: [{ op: 'stealth', dur: 6 }] },
  shadowEvade: { name: '그림자 회피', role: '방어', cd: 9, gain: 25, scale: 'phys', fx: 'blink', aim: 'away', mo: 'dash',
    desc: '적이 없는 쪽으로 물러나며 0.8초 무적. 그림자 +25.', do: [{ op: 'dash', dist: 80, mul: 0, invuln: 0.8 }] },
  shadowDance: { name: '그림자 춤', role: '궁극', cd: 24, costAll: { min: 50 }, scale: 'phys', fx: 'slashX', ult: true, aim: 'none', mo: 'stab',
    desc: '4초 동안 무적 상태로 주변 적 사이를 오가며 8번 벤다. 그림자가 많을수록 강하다.',
    do: [{ op: 'channel', dur: 4, every: 0.5, invuln: true, sub: { op: 'danceStrike', r: 130, mul: 1.2, scaleRes: true } }] },

  // ══════ 암살자 · 독침 사냥꾼 ══════
  snare: { name: '덫 설치', role: '제어', cd: 4, cost: 10, scale: 'phys', fx: 'trap', aim: 'none', mo: 'crouch',
    desc: '내가 선 자리에 덫을 놓는다. 밟은 적은 공격력 150% 피해를 받고 2초 묶이며 독 4중첩. 최대 3개. 그림자 10.', do: [{ op: 'zone', kind: 'trap', r: 18, dur: 30, at: 'self', max: 3 }] },
  retreatShot: { name: '후퇴 사격', role: '이동', cd: 6, gain: 15, scale: 'phys', fx: 'dart', aim: 'near', mo: 'shoot',
    desc: '뒤로 뛰면서 독침 5발을 분다. 그림자 +15.', do: [{ op: 'dash', dist: -80, mul: 0 }, { op: 'proj', n: 5, spread: 0.18, speed: 340, range: 210, mul: 0.7, status: 'poison', stacks: 1, kind: 'dart' }] },
  bait: { name: '미끼', role: '제어', cd: 14, cost: 15, scale: 'phys', fx: 'trap', aim: 'cluster', mo: 'throw',
    desc: '고기를 던진다. 6초 동안 주변 몬스터가 미끼로 몰려간다 — 나를 쫓던 적은 50%, 아니면 75% 확률 (정예는 짧게). 깔아 둔 덫이 있으면 미끼를 덫 위에 놓는다. 그림자 15.', do: [{ op: 'zone', kind: 'bait', r: 150, dur: 6, at: 'aim' }] },
  dartFan: { name: '독침 난사', role: '공격', cd: 6, cost: 18, scale: 'phys', fx: 'dart', mo: 'blow3',
    desc: '바람총을 세 번 연달아 불어 독침 3발씩, 모두 9발을 흩뿌린다. 맞을 때마다 독 2중첩. 그림자 18.', do: [{ op: 'channel', dur: 0.6, every: 0.2, sub: { op: 'proj', n: 3, spread: 0.16, speed: 360, range: 200, mul: 0.55, status: 'poison', stacks: 2, kind: 'dart' } }] },
  smokeBomb: { name: '연막탄', role: '방어', cd: 14, gain: 20, scale: 'phys', fx: 'smoke', aim: 'none', mo: 'crouch',
    desc: '발밑에 연막을 터뜨린다. 6초 동안 연기가 퍼진 자리에 있으면 적이 나를 놓친다 (바로 붙어 있는 적은 그래도 친다). 4초 동안 회피 +50%. 그림자 +20.',
    do: [{ op: 'zone', kind: 'smoke', r: 66, dur: 6, at: 'self', max: 2 }, { op: 'buff', id: 'smoke', dur: 4, mods: { dodge: 0.5 }, color: '#8a8aa0' }] },
  venomBurst: { name: '맹독 폭발', role: '궁극', cd: 16, costAll: { min: 40 }, scale: 'phys', elem: 'poison', fx: 'burst', ult: true, aim: 'none', mo: 'power',
    desc: '독이 쌓인 모든 적의 독을 한꺼번에 터뜨린다. 중첩과 그림자가 많을수록 크다.', do: [{ op: 'detonate', what: 'poison', mul: 1.1, r: 46, scaleRes: true }] },

  // ══════ 엘프 · 정령사 (깃드는 정령) ══════
  summonSpirit: { name: '정령 부르기', role: '소환', cd: 12, cost: 15, scale: 'best', fx: 'spiritIn', aim: 'none', mo: 'castBig',
    desc: '계약한 정령 가운데 함께하는 정령을 불러낸다(30초). 나와 있는 동안 정령의 버프가 붙고, 정령이 가까운 적을 그 속성으로 공격한다. 다시 쓰면 시간이 처음부터. 정령력 15.', do: [{ op: 'summonSpirit', dur: 30 }] },
  spiritEmpower: { name: '정령 강화', role: '강화', cd: 16, cost: 20, scale: 'best', fx: 'spiritIn', aim: 'none', mo: 'castBig',
    desc: '함께하는 정령이 8초 동안 강해진다: 공격이 2배 빠르고 피해 +60%, 버프 1.5배. 정령이 나와 있지 않으면 강해진 채로 불러낸다(20초). 정령력 20.', do: [{ op: 'spiritEmpower', dur: 8 }] },
  spiritGuard: { name: '정령의 품', role: '방어', cd: 14, cost: 20, scale: 'best', fx: 'spiritIn', aim: 'none', mo: 'castBig',
    desc: '함께하는 정령이 나를 감싸 4초 동안 받는 피해 -40%, 다가온 적을 밀쳐낸다. 정령이 나와 있지 않으면 불러낸다(20초). 정령력 20.', do: [{ op: 'spiritGuard', dur: 4 }] },
  spiritAbsorb: { name: '정령 흡수', role: '준비', cd: 7, scale: 'best', fx: 'absorb', mo: 'channel',
    desc: '1.2초 동안 주변 적의 생기를 빨아들인다 (0.3초마다 공격력 45%). 맞힌 적 하나마다 정령력 +4.',
    do: [{ op: 'channel', dur: 1.2, every: 0.3, sub: { op: 'aoe', at: 'self', r: 80, mul: 0.45, gainPerHit: 4, fx: 'absorb' } }] },
  spiritArrow: { name: '정령의 화살', role: '공격', cd: 3.5, cost: 15, scale: 'best', fx: 'bolt', mo: 'shoot',
    desc: '정령의 힘으로 관통하는 큰 화살을 쏜다. 정령이 나와 있으면 그 정령의 속성이 붙고 피해 +50% (등급 · 결속이 높을수록 더). 정령력 15.', do: [{ op: 'spiritArrow', speed: 340, range: 260, mul: 1.7, per: 0.45 }] },
  spiritKing: { name: '정령왕 강림', role: '궁극', cd: 36, costAll: { min: 60 }, scale: 'best', fx: 'summon', ult: true, mo: 'castBig',
    desc: '15초 동안 정령왕이 나타나 주먹으로 싸운다. 함께하는 정령이 불 · 바람 · 숲이면 그 왕이, 아니면 불→바람→숲 차례로 온다. 바람은 멀리 날려 버리고, 불은 화염으로 태우고, 숲은 덩굴로 묶는다. 정령력이 많을수록 강하다.',
    do: [{ op: 'kingDescend', dur: 15, mul: 1.1, scaleRes: true }] },

  // ══════ 엘프 · 숲의 사수 ══════
  pierceArrow: { name: '관통 화살', role: '공격', cd: 3, gain: 8, scale: 'phys', fx: 'arrow', mo: 'shoot',
    desc: '일직선의 적을 모두 꿰뚫는 강한 화살. 정령력 +8.', do: [{ op: 'proj', n: 1, speed: 420, range: 280, mul: 2.0, pierce: 99, kind: 'arrow', focus: true }] },
  windStep: { name: '바람 걸음', role: '이동', cd: 5, gain: 10, scale: 'phys', fx: 'dash', aim: 'away', mo: 'dash',
    desc: '적이 없는 쪽으로 미끄러진다. 집중 1단계를 바로 얻는다. 정령력 +10.', do: [{ op: 'dash', dist: 90, mul: 0, focusGain: 1 }] },
  vineSnare: { name: '덩굴 속박', role: '제어', cd: 9, cost: 15, scale: 'phys', fx: 'vines', aim: 'cluster', mo: 'cast',
    desc: '고른 자리에서 덩굴이 솟아 범위 안의 적을 2초 묶는다. 정령력 15.', do: [{ op: 'aoe', at: 'aim', r: 58, mul: 0.6, stun: 2.0, root: true, fx: 'vines' }] },
  pushArrow: { name: '밀쳐내기 화살', role: '제어', cd: 6, cost: 12, scale: 'phys', fx: 'arrow', mo: 'shoot',
    desc: '맞은 적을 멀리 밀어낸다. 정령력 12.', do: [{ op: 'proj', n: 1, speed: 400, range: 220, mul: 1.2, knock: 420, kind: 'arrow', focus: true }] },
  aimedShot: { name: '조준', role: '강화', cd: 15, cost: 20, scale: 'phys', fx: 'buff', mo: 'aim',
    desc: '6초 동안 사거리 +50%, 치명타 확률 +25%, 대신 이동 속도 -30%. 정령력 20.',
    do: [{ op: 'buff', id: 'aimed', dur: 6, mods: { crit: 0.25, moveSpeed: 0.7, projRange: 1.5 }, color: '#ffe080' }] },
  skyPiercer: { name: '천공의 한 발', role: '궁극', cd: 26, costAll: { min: 50 }, cast: 1.0, scale: 'phys', fx: 'skyfall', ult: true, aim: 'cluster', mo: 'aim',
    desc: '1초 동안 조준한 뒤 끝까지 꿰뚫는 거대한 화살을 쏜다. 정령력이 많을수록 강하다.',
    do: [{ op: 'line', len: 420, w: 26, mul: 4.2, scaleRes: true, fx: 'arrowBeam' }] },

  // ══════ 용족 · 화룡 전사 ══════
  breath: { name: '화염 숨결', role: '공격', cd: 7, scale: 'best', elem: 'fire', fx: 'breath', mo: 'breath',
    desc: '1.2초 동안 앞쪽에 불을 뿜어 화상을 계속 쌓는다. 맞힐 때마다 용기 +1.',
    do: [{ op: 'channel', dur: 1.2, every: 0.1, sub: { op: 'cone', range: 86, angle: 0.8, mul: 0.3, stacks: 1, gainPerHit: 1, fx: 'breath' } }] },
  dragonClaw: { name: '용 발톱', role: '공격', cd: 4, gain: 8, scale: 'best', elem: 'fire', fx: 'claws', mo: 'claw',
    desc: '크게 두 번 할퀸다. 불타는 적에게 1.5배. 용기 +8.', do: [{ op: 'channel', dur: 0.24, every: 0.12, sub: { op: 'cone', range: 50, angle: 1.8, mul: 1.1, bonusIf: 'burning', fx: 'claws' } }] },
  soar: { name: '비상', role: '이동', cd: 8, cost: 15, scale: 'best', elem: 'fire', fx: 'pillar', aim: 'cluster', mo: 'leap',
    desc: '날아올라 1.2초 동안 공격을 받지 않고 빠르게 움직인다. 다시 누르거나 시간이 다 되면 그 자리에 불길과 함께 내리꽂힌다. 용기 15.', do: [{ op: 'soar', dur: 1.2, r: 58, mul: 1.9, stacks: 2 }] },
  snatch: { name: '낚아채기', role: '제어', cd: 10, cost: 20, scale: 'best', elem: 'fire', fx: 'claws', aim: 'near', mo: 'claw',
    desc: '적을 움켜쥐고 날아올랐다가 떨어뜨린다. 떨어진 자리 주변에도 피해. 정예는 잠깐 기절만. 용기 20.', do: [{ op: 'snatch', range: 60, dur: 0.8, r: 44, mul: 2.0 }] },
  scales: { name: '비늘 갑옷', role: '방어', cd: 14, cost: 10, scale: 'best', fx: 'bubble', mo: 'guard',
    desc: '6초 동안 받는 피해 -30%, 나를 때린 적은 화상 2중첩. 용기 10.', do: [{ op: 'buff', id: 'scales', dur: 6, mods: { dmgTakenMul: 0.7 }, color: '#ff8a4a', bubble: true }] },
  dragonForm: { name: '용화', role: '궁극', cd: 30, costAll: { min: 60 }, scale: 'best', fx: 'buff', ult: true, mo: 'power',
    desc: '10초 동안 진짜 용으로 변한다. 공격력 +40%, 평타가 화염 브레스가 되고 모든 공격에 화상, 숨결 재사용 대기 없음, 할퀴기·숨결 범위 1.4배.',
    do: [{ op: 'aoe', at: 'self', r: 100, mul: 1.6, stacks: 3, elemFire: true, fx: 'pillar' }, { op: 'buff', id: 'dragonForm', dur: 10, mods: { dmgMul: 1.4 }, color: '#ff5a2a', scaleRes: true }] },

  // ══════ 용족 · 용언 술사 (단어 → 문장) ══════
  wordFire: { name: '용언: 불', role: '공격', cd: 2, cost: 10, scale: 'mag', elem: 'fire', fx: 'bolt', mo: 'cast', word: 'fire',
    desc: '화염구를 쏜다. 마력 언령 「불」 — 문장의 몸통이면 조준한 곳이 폭발한다. 하늘 다음이면 「떨어지는 태양」. 용기 10.', do: [{ op: 'proj', n: 1, speed: 270, range: 220, mul: 1.2, splash: 30, stacks: 1, kind: 'fireball' }] },
  wordWing: { name: '용언: 날개', role: '이동', cd: 5, gain: 10, scale: 'mag', fx: 'blink', aim: 'away', mo: 'cast', word: 'wing',
    desc: '짧게 순간이동한다. 정신 언령 「날개」 — 몸통이면 사방으로 바람 칼날. 날개 → 하늘은 「하늘 걸음」. 용기 +10.', do: [{ op: 'teleport', dist: 90 }] },
  wordSky: { name: '용언: 하늘', role: '공격', cd: 4, cost: 16, scale: 'mag', elem: 'fire', fx: 'meteor', aim: 'cluster', mo: 'castBig', word: 'sky',
    desc: '작은 운석을 떨어뜨린다. 마력 언령 「하늘」 — 몸통이면 운석이 여러 개 떨어진다. 불 다음이면 「불비」. 용기 16.', do: [{ op: 'aoe', at: 'aim', r: 40, mul: 1.5, stacks: 1, delay: 0.5, fall: 'meteor', fx: 'meteor' }] },
  wordScale: { name: '용언: 비늘', role: '방어', cd: 6, cost: 14, scale: 'mag', fx: 'bubble', aim: 'none', mo: 'guard', word: 'scale',
    desc: '보호막(최대 체력 8%)을 얻는다. 정신 언령 「비늘」 — 몸통이면 큰 보호막, 강하게 말하면 잠깐 무적. 대지 다음이면 「바위 갑옷」. 용기 14.', do: [{ op: 'shield', v: 0.08 }] },
  wordEarth: { name: '용언: 대지', role: '제어', cd: 7, cost: 20, scale: 'mag', fx: 'quake', mo: 'stomp', word: 'earth',
    desc: '주변 적을 0.8초 기절시킨다. 정신 언령 「대지」 — 몸통이면 넓은 지진과 기절. 대지 → 불은 「용암 땅」. 용기 20.', do: [{ op: 'aoe', at: 'self', r: 60, mul: 0.8, stun: 0.8 }] },
  wordSilence: { name: '용언: 침묵', role: '궁극', cd: 34, costAll: { min: 60 }, cast: 0.6, scale: 'mag', fx: 'roar', ult: true, aim: 'none', mo: 'castBig',
    desc: '용의 말로 침묵을 명한다. 주변의 모든 적이 4초 동안 공격하지 못한다. 용기가 많을수록 오래(최대 8초).', do: [{ op: 'silence', r: 150, dur: 4 }] },

  // ══════ 골렘족 · 바위 수호자 ══════
  stoneSkin: { name: '암석 갑옷', role: '방어', cd: 14, gain: 15, scale: 'phys', fx: 'bubble',
    desc: '6초 동안 물리 저항 +60, 받는 피해 -20%. 끝날 때 주변으로 파편이 튄다.',
    do: [{ op: 'buff', id: 'stoneSkin', dur: 6, mods: { pres: 60, dmgTakenMul: 0.8 }, color: '#b8a888', bubble: true }, { op: 'aoe', at: 'self', r: 64, mul: 1.4, delay: 6, fx: 'rocks' }] },
  reflectCrystal: { name: '반사 결정', role: '방어', cd: 15, cost: 15, scale: 'phys', fx: 'crystal',
    desc: '5초 동안 받는 피해의 80%를 되돌려준다.', do: [{ op: 'buff', id: 'reflect', dur: 5, mods: { reflect: 80 }, color: '#c8f0ff', bubble: true }] },
  quake: { name: '지진 강타', role: '공격', cd: 6, gain: 10, scale: 'phys', fx: 'quake',
    desc: '땅을 내리쳐 주변 적에게 피해와 둔화.', do: [{ op: 'aoe', at: 'self', r: 66, mul: 1.6, stun: 0.4, status: 'chill', stacks: 1 }] },
  crystalPrison: { name: '결정 감옥', role: '제어', cd: 12, cost: 20, scale: 'phys', fx: 'crystal', aim: 'tank',
    desc: '적을 결정에 2.5초 가둔다. 갇힌 적은 받는 피해 +30%.', do: [{ op: 'aoe', at: 'aim', r: 36, mul: 0.3, stun: 2.5, prison: true }] },
  rockTremor: { name: '바위 진동', role: '제어', cd: 10, gain: 20, scale: 'phys', fx: 'roar',
    desc: '주변 적을 끌어당기고, 5초 동안 반사 +40%.', do: [{ op: 'aoe', at: 'self', r: 100, mul: 0.3, pull: true }, { op: 'buff', id: 'tremorReflect', dur: 5, mods: { reflect: 40 }, color: '#c8b088' }] },
  colossus: { name: '거신화', role: '궁극', cd: 34, costAll: { min: 60 }, scale: 'phys', fx: 'quake', ult: true,
    desc: '12초 동안 거대해진다. 받는 피해 -40%, 공격력 +35%, 변신하며 큰 지진.',
    do: [{ op: 'aoe', at: 'self', r: 120, mul: 2.6, scaleRes: true, stun: 1, fx: 'quake' }, { op: 'buff', id: 'giant', dur: 12, mods: { dmgTakenMul: 0.6, dmgMul: 1.35 }, color: '#c8b088' }] },

  // ══════ 골렘족 · 얼음 골렘 ══════
  iceChunk: { name: '얼음 덩이 투척', role: '준비', cd: 3, gain: 12, scale: 'phys', elem: 'ice', fx: 'throw',
    desc: '얼음 덩이를 던진다. 맞은 자리에 서리가 퍼져 냉기 2중첩.', do: [{ op: 'proj', n: 1, speed: 220, range: 200, mul: 2.0, splash: 40, stacks: 2, kind: 'icerock' }] },
  frostField: { name: '서리 장판', role: '장판', cd: 11, cost: 15, scale: 'phys', elem: 'ice', fx: 'ice', aim: 'cluster',
    desc: '6초 동안 서리 장판. 위의 적이 점점 느려지다 얼어붙는다.', do: [{ op: 'zone', kind: 'frost', r: 70, dur: 6, at: 'aim' }] },
  frostCharge: { name: '빙결 돌진', role: '이동', cd: 7, gain: 10, scale: 'phys', elem: 'ice', fx: 'dash', aim: 'crowd',
    desc: '돌진해 경로의 적에게 냉기 3중첩. 지나간 길은 얼음으로 덮인다.', do: [{ op: 'dash', dist: 120, mul: 1.3, stacks: 3, iceTrail: true }] },
  iceArmor: { name: '얼음 갑옷', role: '방어', cd: 14, scale: 'phys', fx: 'bubble',
    desc: '8초 동안 받는 피해 -25%. 나를 때린 적은 냉기 3중첩.', do: [{ op: 'buff', id: 'iceArmor', dur: 8, mods: { dmgTakenMul: 0.75 }, color: '#9fe3ff', bubble: true }] },
  glacialSpikes: { name: '빙하 가시', role: '마무리', cd: 7, cost: 30, scale: 'phys', elem: 'ice', fx: 'spikes', aim: 'cluster',
    desc: '앞으로 얼음 가시가 줄지어 솟는다. 얼어 있는 적은 산산조각 나며 2.5배 피해.', do: [{ op: 'line', len: 200, w: 30, mul: 2.4, bonusIf: 'frozen', stacks: 2, fx: 'spikes' }] },
  absoluteZero: { name: '절대 영도', role: '궁극', cd: 32, costAll: { min: 60 }, cast: 0.5, scale: 'phys', elem: 'ice', fx: 'ice', ult: true,
    desc: '주변의 모든 적을 3초 동안 얼리고, 풀리는 순간 산산조각 낸다.',
    do: [{ op: 'aoe', at: 'self', r: 140, mul: 0.6, stacks: 10, fx: 'zero' }, { op: 'aoe', at: 'self', r: 140, mul: 3.0, scaleRes: true, bonusIf: 'frozen', delay: 2.8, fx: 'shatter' }] },

  // ══════ 각인 스킬 (어느 종족이든 각인을 새기면 사용) ══════
  eFirePillar: { engraving: true, name: '화염 기둥', role: '공격', cd: 9, scale: 'best', elem: 'fire', fx: 'pillar',
    desc: '조준한 곳에 불기둥. 화상 3중첩.', do: [{ op: 'aoe', at: 'aim', r: 36, mul: 2.0, stacks: 3, delay: 0.3 }] },
  eFrostNova: { engraving: true, name: '서리 파동', role: '제어', cd: 10, scale: 'best', elem: 'ice', fx: 'ice',
    desc: '주변에 냉기 2중첩과 피해.', do: [{ op: 'aoe', at: 'self', r: 62, mul: 1.0, stacks: 2 }] },
  ePoisonBurst: { engraving: true, name: '독 분출', role: '준비', cd: 10, scale: 'best', elem: 'poison', fx: 'fog',
    desc: '조준한 곳에 진한 독 웅덩이.', do: [{ op: 'zone', kind: 'poison', r: 50, dur: 5, at: 'aim' }] },
  eBloodPact: { engraving: true, name: '피의 계약', role: '준비', cd: 15, scale: 'best', fx: 'buff', aim: 'none',
    desc: '체력 15%를 바쳐 종족 자원 +40. 마무리 스킬 직전에 쓰자.', do: [{ op: 'hpToRes', hp: 0.15, gain: 40 }] },
  eMirrorWall: { engraving: true, name: '거울 방벽', role: '방어', cd: 14, scale: 'best', fx: 'bubble',
    desc: '4초 동안 받는 피해 -20%, 반사 +50%.', do: [{ op: 'buff', id: 'mirror', dur: 4, mods: { dmgTakenMul: 0.8, reflect: 50 }, color: '#e6f3ff', bubble: true }] },
  eShadowStep: { engraving: true, name: '그림자 걸음', role: '이동', cd: 6, scale: 'best', fx: 'blink',
    desc: '짧게 순간이동하고 다음 공격 확정 치명타.', do: [{ op: 'teleport', dist: 80 }, { op: 'buff', id: 'nextCrit', dur: 3, mods: {} }] },
  eChainBolt: { engraving: true, name: '공명 번개', role: '공격', cd: 8, scale: 'best', elem: 'lightning', fx: 'bolt',
    desc: '번개가 적 사이를 4번 튄다.', do: [{ op: 'chain', jumps: 4, range: 85, mul: 1.2 }] },
  eWarHorn: { engraving: true, name: '전쟁 나팔', role: '강화', cd: 16, gain: 20, scale: 'best', fx: 'roar',
    desc: '6초 동안 공격력 +20%, 종족 자원 +20.', do: [{ op: 'buff', id: 'warHorn', dur: 6, mods: { dmgMul: 1.2 }, color: '#ffcf5a' }] },
  eSoulHarvest: { engraving: true, name: '영혼 수확', role: '마무리', cd: 12, scale: 'best', elem: 'dark', fx: 'burst',
    desc: '주변을 베어 거둔다. 처치한 적마다 종족 자원 +10.', do: [{ op: 'aoe', at: 'self', r: 62, mul: 1.6, gainPerKill: 10 }] },

  // ══════ 세상에서 배우는 기술 (클래스와 상관없이 누구나: 석판 · 스승 · 정령) ══════
  enchantFire: { general: true, name: '화염 부여', role: '강화', cd: 16, cost: 15, scale: 'best', elem: 'fire', fx: 'enchant', aim: 'none', mo: 'power',
    desc: '15초 동안 무기에 불을 붙인다. 평타 · 무기 기술이 공격력 40%만큼 화염 피해를 더 주고 화상 1중첩. 활이면 불화살이 된다.', do: [{ op: 'enchant', elem: 'fire', dur: 15, pow: 0.4 }] },
  enchantIce: { general: true, name: '냉기 부여', role: '강화', cd: 16, cost: 15, scale: 'best', elem: 'ice', fx: 'enchant', aim: 'none', mo: 'power',
    desc: '15초 동안 무기에 서리를 두른다. 평타 · 무기 기술이 공격력 30%만큼 냉기 피해를 더 주고 냉기 1중첩(4중첩이면 얼어붙는다).', do: [{ op: 'enchant', elem: 'ice', dur: 15, pow: 0.3 }] },
  enchantLightning: { general: true, name: '번개 부여', role: '강화', cd: 16, cost: 15, scale: 'best', elem: 'lightning', fx: 'enchant', aim: 'none', mo: 'power',
    desc: '15초 동안 무기에 번개를 담는다. 평타 · 무기 기술이 공격력 30%만큼 번개 피해를 더 주고 감전. 30% 확률로 가까운 적 하나에게 한 번 더 튄다.', do: [{ op: 'enchant', elem: 'lightning', dur: 15, pow: 0.3 }] },
  enchantPoison: { general: true, name: '독 부여', role: '강화', cd: 16, cost: 15, scale: 'best', elem: 'poison', fx: 'enchant', aim: 'none', mo: 'power',
    desc: '15초 동안 무기에 독을 바른다. 평타 · 무기 기술이 공격력 20%만큼 독 피해를 더 주고 독 2중첩.', do: [{ op: 'enchant', elem: 'poison', dur: 15, pow: 0.2, stacks: 2 }] },
  waterBreath: { general: true, name: '수중 호흡', role: '강화', cd: 30, cost: 20, scale: 'mag', fx: 'bubbleIn', aim: 'none', mo: 'cast',
    desc: '3분 동안 물속에서 숨이 줄지 않는다. 그동안 깊은 물에서 헤엄치고, 헤엄치다가 G를 누르면 바닷속으로 내려간다.', do: [{ op: 'waterBreath', min: 180 }] },
  dive: { general: true, name: '잠수', role: '이동', cd: 4, scale: 'phys', fx: 'splash', aim: 'none', mo: 'leap',
    desc: '물가나 물 위에서 쓰면 물속으로 뛰어든다. 배우면 물속 숨이 8초 → 20초로 길어진다 (다 떨어지면 체력이 줄고 물 위로 떠오른다).', do: [{ op: 'dive' }] },
};

// 스킬 → 클래스·종족·배우는 레벨
for (const [cid, c] of Object.entries(CLASSES)) {
  c.skills.forEach((sid, i) => {
    const sk = SKILLS[sid];
    if (!sk) throw new Error('missing skill ' + sid);
    sk.cls = cid; sk.race = c.race; sk.unlock = UNLOCKS[i];
  });
}
for (const sk of Object.values(SKILLS)) if (sk.engraving) sk.race = 'engraving';
for (const sk of Object.values(SKILLS)) if (sk.general) sk.race = 'general';

// ── 스킬의 몸놀림: 무기에 따라 쓸 수 있는지 · 얼마나 잘 쓰는지가 달라진다 ──
// slash 베기 · smash 내려찍기 · thrust 찌르기 · shoot 쏘기(활 · 석궁 · 바람총) · throw 던지기 · spell 마법 · parry 받아치기 · shield 방패 · body 몸(무기 상관없음)

// ── 스킬 밸런스 보정 (tools/balance.mjs: 단단한 적 3마리에게 6초 동안 넣은 피해 ÷ 재사용 대기, 중간값에서 많이 벗어난 것만) ──
export const SKILL_BAL = {}; // 스킬 하나씩은 보정하지 않는다 (한 번의 피해로는 알 수 없다) — 클래스 단위 CLASS_BAL로
// ── 클래스 밸런스 보정 (tools/balance.mjs: 30초 실제 싸움 · 무리 / 단단한 적) ──
export const CLASS_BAL = {"predator": 1, "behemoth": 0.92, "elementalist": 1.07, "chronomancer": 0.9, "guardian": 1.6, "greatsword": 1.6, "berserker": 0.8, "thrower": 1.08, "necromancer": 0.71, "hexer": 0.96, "shadowblade": 0.97, "venomHunter": 1.6, "spiritcaller": 1.5, "ranger": 1.04, "dragoon": 0.68, "dragonSage": 1.09};

// ── 돈 · 미션으로 얻는 CC기 (누구나 · 어떤 무기로든 · 내 종족의 자원으로 쓴다) ──
export const CC_EXTRA = {
  stunStrike: { buy: 1500, how: '종족 상점 기술서 · 1500 골드' },
  bolas: { buy: 1200, how: '종족 상점 기술서 · 1200 골드' },
  quakeStomp: { buy: 1800, how: '종족 상점 기술서 · 1800 골드' },
  fearShout: { mission: 'quests', need: 5, how: '마을 · 성지 의뢰를 5번 끝내면' },
  silenceSeal: { mission: 'tower', need: 10, how: '각인의 탑 10층을 깨면' },
  chainHook: { mission: 'duel', need: 3, how: '결투에서 3번 이기면' },
};
Object.assign(SKILLS, {
  stunStrike: { name: '기절 일격', role: '제어', cd: 10, cost: 15, scale: 'best', fx: 'smash', aim: 'tank', mo: 'bash',
    desc: '앞의 적 하나를 세게 쳐서 공격력 130% 피해 · 1.3초 기절.', do: [{ op: 'single', range: 42, mul: 1.3, stun: 1.3, knock: 120 }] },
  bolas: { name: '올가미', role: '제어', cd: 9, cost: 12, scale: 'best', fx: 'throw', aim: 'near', mo: 'throw',
    desc: '올가미를 던져 맞은 적에게 공격력 80% 피해 · 1초 기절 · 냉기 2중첩(느려짐).', do: [{ op: 'proj', n: 1, speed: 300, range: 210, mul: 0.8, stun: 1.0, status: 'chill', stacks: 2, kind: 'harpoon' }] },
  quakeStomp: { name: '발 구르기', role: '제어', cd: 12, cost: 18, scale: 'best', fx: 'smash', aim: 'none', mo: 'bash',
    desc: '땅을 굴러 둘레 55 안의 적에게 공격력 90% 피해 · 0.8초 기절.', do: [{ op: 'aoe', at: 'self', r: 55, mul: 0.9, stun: 0.8, fx: 'spin' }] },
  fearShout: { name: '공포의 외침', role: '제어', cd: 14, cost: 20, scale: 'best', fx: 'buff', aim: 'none', mo: 'power',
    desc: '둘레 75 안의 적이 2.5초 동안 겁에 질려 달아난다 (공격력 30% 피해).', do: [{ op: 'aoe', at: 'self', r: 75, mul: 0.3, flee: 2.5, fx: 'roar' }] },
  silenceSeal: { name: '침묵의 인장', role: '제어', cd: 16, cost: 20, scale: 'best', fx: 'rune', aim: 'none', mo: 'cast',
    desc: '둘레 90 안의 적이 3초 동안 공격 · 기술을 쓰지 못한다.', do: [{ op: 'silence', r: 90, dur: 3 }] },
  chainHook: { name: '쇠사슬 낚기', role: '제어', cd: 8, cost: 12, scale: 'best', fx: 'throw', aim: 'tank', mo: 'throw',
    desc: '쇠사슬로 적 하나를 내 앞까지 끌어오고 0.5초 기절 (공격력 90% 피해).', do: [{ op: 'proj', n: 1, speed: 360, range: 230, mul: 0.9, pull: true, stun: 0.5, kind: 'harpoon' }] },
});

// CC기(역할 「제어」)는 피해가 거의 없다: 공격력 15% (기절 · 속박 · 공포 · 침묵 · 끌어오기가 본업) · 설명의 피해 숫자도 맞춘다
for (const sk of Object.values(SKILLS)) {
  if (sk.role !== '제어') continue;
  const low = (o) => { if (!o) return; if (o.mul > 0.15) o.mul = 0.15; low(o.sub); };
  sk.do.forEach(low);
  sk.desc = sk.desc.replace(/공격력 \d+% ?(피해)?/g, '공격력 15% 피해').replace(/\(공격력 \d+% 피해\)/g, '(공격력 15% 피해)');
  sk.aim ||= 'near'; // 자동 조준: 가장 가까운 적 (사람도)
}

const SKILL_KIND = {
  stunStrike: 'body', bolas: 'body', quakeStomp: 'body', fearShout: 'body', silenceSeal: 'body', chainHook: 'body',
  sweep: 'slash', dashSlash: 'slash', swordWave: 'slash', skyfall: 'slash', shadowDance: 'slash', eSoulHarvest: 'slash',
  crushBlow: 'smash', chargeSmash: 'smash', crushingBlows: 'smash', rageBurst: 'smash', groundSmash: 'smash',
  ambush: 'thrust', comboSlash: 'slash',
  summonSpirit: 'body', spiritEmpower: 'body', spiritGuard: 'body', spiritAbsorb: 'body', spiritKing: 'body', spiritArrow: 'shoot',
  retreatShot: 'shoot', dartFan: 'shoot', pierceArrow: 'shoot', pushArrow: 'shoot', skyPiercer: 'shoot',
  harpoon: 'throw', rapidThrow: 'throw', greatAxe: 'throw', axeLegion: 'throw',
  riposte: 'parry', shieldCharge: 'shield', ironWall: 'shield', shieldBash: 'shield',
  vineSnare: 'spell', waterBreath: 'spell', eFirePillar: 'spell', eFrostNova: 'spell', ePoisonBurst: 'spell', eMirrorWall: 'spell', eChainBolt: 'spell',
};
for (const [id, sk] of Object.entries(SKILLS)) {
  sk.kind = SKILL_KIND[id] || (['wizard', 'undead'].includes(sk.race) || ['spiritcaller', 'dragonSage'].includes(sk.cls) ? 'spell' : 'body');
}
// 무기 갈래 × 몸놀림 → 피해 배율 (0 = 그 무기로는 쓸 수 없다)
export const FIT = { // 제 무기면 1 (더 세지지는 않는다), 맞지 않는 무기일수록 약해지고, 0이면 아예 쓸 수 없다
  slash: { blade: 1, great: 1, scythe: 1, shield: 1, axe: 0.9, polearm: 0.85, whip: 0.7, blunt: 0.6, fist: 0.55, throw: 0.6, staff: 0.3, tome: 0.25, bow: 0.3, tube: 0.25 },
  smash: { blunt: 1, great: 1, axe: 1, fist: 0.9, shield: 0.9, polearm: 0.8, blade: 0.8, scythe: 0.75, throw: 0.6, staff: 0.5, whip: 0.4, tome: 0.3, bow: 0.3, tube: 0.25 },
  thrust: { polearm: 1, blade: 1, shield: 0.85, great: 0.75, fist: 0.7, scythe: 0.6, axe: 0.6, throw: 0.6, blunt: 0.5, whip: 0.5, staff: 0.45, tome: 0.25, bow: 0.3, tube: 0.3 },
  shoot: { bow: 1, tube: 1 },
  throw: { throw: 1, axe: 1, polearm: 0.9, blade: 0.8, blunt: 0.75, scythe: 0.7, shield: 0.6 },
  spell: { staff: 1, tome: 1, _: 0.75 },
  parry: { shield: 1, blade: 1, great: 1, axe: 1, blunt: 1, polearm: 1, scythe: 0.9, fist: 0.9, throw: 0.7, staff: 0.7, whip: 0.6, tome: 0.6, bow: 0.5, tube: 0.5 },
  shield: { shield: 1 },
  body: { _: 1 },
};
export const KIND_NAME = { slash: '베기', smash: '내려찍기', thrust: '찌르기', shoot: '쏘기', throw: '던지기', spell: '마법', parry: '받아치기', shield: '방패', body: '몸' };
export const CANT_TEXT = { shoot: '활 · 석궁 · 바람총이 있어야 쏠 수 있다', throw: '던질 무기(도끼 · 창 · 단검 · 부메랑)가 있어야 한다', shield: '방패가 있어야 쓸 수 있다', slash: '이 무기로는 벨 수 없다', smash: '이 무기로는 내려찍을 수 없다', thrust: '이 무기로는 찌를 수 없다' };
export function skillFit(def, wcat) {
  if (!def) return 1;
  const t = FIT[def.kind || 'body'] || FIT.body;
  return t[wcat] ?? t._ ?? 0;
}
// 두 손 중 더 맞는 쪽: 오른손 무기, 또는 (한손 무기일 때) 왼손 도구
export function handFit(def, b) {
  const main = skillFit(def, b?.wcat), off = b?.offItem && (b.hands || 1) < 2 ? b.offItem.off?.[def?.kind || 'body'] || 0 : 0;
  return off > main ? { fit: off, hand: 'off' } : { fit: main, hand: 'main' };
}
// 다른 종족의 클래스 스킬을 배우는 조건: 스킬 종류에 맞는 능력치 + 그 종족 성지의 친밀도
export const CROSS_STAT = { spell: 'mag', shoot: 'agi', throw: 'agi' };
export function crossReq(def) {
  const stat = CROSS_STAT[def.kind] || (def.scale === 'mag' ? 'mag' : def.scale === 'dex' ? 'agi' : 'str');
  return { stat, need: def.ult ? 50 : 30, full: def.ult ? 70 : 50, aff: 2, gold: (def.ult ? 900 : 250) + (def.unlock || 1) * 50 };
}
// 다른 종족의 스킬은 능력치가 '온전' 기준에 못 미치면 85% 힘
export const crossMul = (def, b) => { if (!def?.race || def.race === b.race || def.scroll) return 1; const r = crossReq(def); return (b.stats?.[r.stat] || 0) >= r.full ? 1 : 0.85; };
// 배울 수 없는 것: 그 클래스만 모으는 것(영혼 · 깃든 정령 · 부하)이 있어야 쓰는 스킬
// 궁극기와 용언(용의 혀로만 말한다)은 그 종족만 쓴다
export const crossOk = (id) => { const s = SKILLS[id]; return !!s && !!s.cls && !s.ult && !s.word && !s.needSpirit && !s.do.some((o) => ['raiseSouls', 'blastSummons'].includes(o.op)); };
// 설명 끝의 '정령력 20.' 같은 원래 종족 자원 이야기를 뗀다 (다른 종족이 배우면 내 자원으로 쓰니까)
const RES_TAIL = /\s*(마력|기력|분노|오러|본능|영혼|그림자|정령력|용기|암석 에너지)\s*[+]?\d+\+?\s*(전부|씩)?\.?\s*$/;
export const plainDesc = (s) => (s?.desc || '').replace(RES_TAIL, '');
export const fitText = (f) => (f <= 0 ? '쓸 수 없음' : f >= 0.99 ? '제대로 쓴다' : `피해 ${Math.round(f * 100)}%`);

// 언령: 단어의 계열과 순서가 있는 조합 (앞 단어 > 뒤 단어). 조합이 없으면 계열 규칙(강세 · 합성 · 엇갈림)을 따른다
export const WORD_FAMILY = { fire: 'mana', sky: 'mana', scale: 'mind', earth: 'mind', wing: 'mind' };
export const WORD_COMBO = {
  'sky>fire': { name: '떨어지는 태양', run(pw, c, ctx) {
    const { x, y } = c, r = 70;
    this.emit({ t: 'telegraphCircle', x, y, r, dur: 0.8 }); this.emit({ t: 'fall', x, y, r, dur: 0.8, kind: 'meteor' });
    this.delayed.push({ t: 0.8, run: () => { this.emit({ t: 'skillAoe', x, y, r, elem: 'fire', fx: 'meteor', ult: true }); for (const e of this.enemiesNear(x, y, r)) this.skillHit(e, { mul: 3.6 * pw, stacks: 4 }, ctx); } });
  } },
  'fire>sky': { name: '불비', run(pw, c, ctx) {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05, d = 20 + (i % 3) * 22, x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.6;
      this.delayed.push({ t: 0.15 + i * 0.12, run: () => { this.emit({ t: 'skillAoe', x, y, r: 30, elem: 'fire', fx: 'pillar' }); for (const e of this.enemiesNear(x, y, 30)) this.skillHit(e, { mul: 1.1 * pw, stacks: 1 }, ctx); } });
    }
  } },
  'earth>fire': { name: '용암 땅', run(pw, c, ctx) {
    this.wordEffect('earth', pw * 0.8, c, ctx);
    const p = this.player;
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; this.zones.push({ kind: 'fire', x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 18, r: 18, t: 4, max: 4, tick: 0, atk: ctx.atk * pw }); }
  } },
  'scale>fire': { name: '불꽃 비늘', run(pw, c, ctx) {
    this.wordEffect('scale', pw, c, ctx);
    this.player.buffs.scales = { t: 6, max: 6, mods: { dmgTakenMul: 0.8 }, color: '#ff8a4a', bubble: true }; // 나를 때린 적은 화상
  } },
  'wing>sky': { name: '하늘 걸음', run(pw, c, ctx) {
    const p = this.player, dx = c.x - p.x, dy = c.y - p.y, l = Math.hypot(dx, dy) || 1, d = Math.min(120, l - 24);
    if (d > 0 && !this.blocked(p.x + dx / l * d, p.y + dy / l * d, 5)) { p.x += dx / l * d; p.y += dy / l * d; p.invuln = Math.max(p.invuln, 0.4); this.emit({ t: 'land', x: p.x, y: p.y }); }
    this.wordEffect('sky', pw, c, ctx);
  } },
  'earth>scale': { name: '바위 갑옷', run(pw, c, ctx) {
    this.wordEffect('scale', pw * 1.5, c, ctx);
    const p = this.player;
    this.emit({ t: 'skillAoe', x: p.x, y: p.y, r: 60, fx: 'quake' });
    for (const e of this.enemiesNear(p.x, p.y, 60)) this.stunE(e, 0.8);
  } },
  'scale>earth': { name: '굳건한 땅', run(pw, c, ctx) { this.wordEffect('earth', pw, c, ctx); this.player.invuln = Math.max(this.player.invuln, 1); } },
  'fire>wing': { name: '불바람', run(pw, c, ctx) {
    this.wordEffect('wing', pw, c, ctx);
    for (const e of this.enemiesNear(this.player.x, this.player.y, 110)) this.applyStatus(e, 'burn', 2);
  } },
};

// 대전(PvP) 보정: 사람끼리 싸울 때는 피해 · 회복 · 보호막 · CC를 줄여 한 번에 끝나지 않게
export const PVP = { dmg: 0.4, heal: 0.5, shield: 0.6, cc: 0.6 }; // 대전: 너무 빨리 끝나지 않게 피해는 40%
// CC 종류 (숫자로 분명하게): 기절 = 아무것도 못 함 · 빙결 = 못 움직이고 못 때림 · 속박 = 못 움직임 · 공포 = 도망 · 침묵 = 스킬 못 씀 · 둔화 = 느려짐
export const CC_NAME = { stun: '기절', frozen: '빙결', root: '속박', fear: '공포', silence: '침묵', slow: '둔화' };

// 각인 → 스킬
export const ENGRAVING_SKILLS = {
  emberHeart: 'eFirePillar', frostFang: 'eFrostNova', toadGland: 'ePoisonBurst', bloodOath: 'eBloodPact',
  mirrorShell: 'eMirrorWall', wraithCloak: 'eShadowStep', echoAmplifier: 'eChainBolt', chiefRoar: 'eWarHorn', graveContract: 'eSoulHarvest',
};

// 자동 조준 규칙: 스킬에 적힌 aim이 없으면 동작을 보고 고른다
export function aimRule(def) {
  if (def.aim) return def.aim;
  const op = def.do[0];
  const o = op.op === 'channel' ? op.sub : op;
  switch (o.op) {
    case 'dash': return o.dist < 0 ? 'near' : o.toward ? 'near' : 'crowd';
    case 'teleport': return 'crowd';
    case 'aoe': case 'zone': return o.at === 'aim' ? 'cluster' : 'near';
    case 'single':
      if (o.bonusIf === 'lowhp' || o.healOnKill) return 'low';
      if (o.weak || o.mark) return 'fresh';
      if (o.scaleRes || o.mul >= 2.5) return 'tank';
      return 'near';
    case 'line': return o.mul >= 3 ? 'tank' : 'cluster';
    case 'cone': return o.mul >= 2.5 ? 'tank' : 'near';
    case 'detonate': return 'none';
    case 'proj': return o.mul >= 2.5 ? 'tank' : 'near';
    default: return 'near';
  }
}

// 층마다 약한 속성(×1.4) / 강한 속성(×0.7)
export const ZONE_ELEM = {
  cave: { weak: 'fire', resist: 'ice' },
  swamp: { weak: 'lightning', resist: 'poison' },
  rift: { weak: 'ice', resist: 'fire' },
  frost: { weak: 'fire', resist: 'ice' },
  grave: { weak: 'lightning', resist: 'dark' },
};

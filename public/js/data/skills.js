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
export const CLASSES = {
  predator: { race: 'dino', name: '포식자', desc: '물고 빠지며 출혈을 남기고, 피 냄새를 따라 쫓는다.', trait: '출혈 걸린 적에게 다가갈 때 이동 속도 +25%. 출혈 걸린 적을 때리면 체력이 조금씩 회복된다.', weapons: ['boneKnuckle', 'predatorFang'], style: 'blood',
    skills: ['pounce', 'rakeRetreat', 'maul', 'herdRoar', 'devour', 'apexPredator'] },
  behemoth: { race: 'dino', name: '대지 거수', desc: '달려들어 들이받는다. 날려 보낸 적이 벽이나 다른 적에 부딪히면 기절한다.', trait: '내가 밀쳐낸 적이 벽이나 다른 적에 부딪히면 피해를 받고 1초 기절한다.', weapons: ['stoneClub', 'tectonicHammer'], style: 'giant',
    skills: ['tailSwipe', 'rush', 'headbutt', 'tremor', 'hardenShell', 'extinction'] },
  elementalist: { race: 'wizard', name: '원소술사', desc: '서로 다른 속성을 한 적에게 겹쳐 반응을 일으킨다. 시전 중에는 움직일 수 없다.', trait: '평타는 마지막으로 쓴 스킬의 속성을 따라간다. 화염+냉기 증기 폭발, 냉기+번개 순간 빙결, 화염+번개 과부하.', weapons: ['elemStaff', 'triOrb'], style: 'fire',
    skills: ['flameBurst', 'frostChain', 'lightningChain', 'elemMark', 'elemSurge', 'grandFireball'] },
  chronomancer: { race: 'wizard', name: '시공술사', desc: '시간을 늦추고, 되감고, 공간을 접는다.', trait: '느려지거나 얼어 있는 적에게 주는 피해 +20%.', weapons: ['hourglassStaff', 'aeonPendulum'], style: 'frost',
    skills: ['arcaneBarrage', 'blinkBlast', 'slowField', 'rewind', 'gravityCollapse', 'timeStop'] },
  guardian: { race: 'knight', name: '수호기사', desc: '정면을 방패로 막고 받아친다.', trait: '정면에서 오는 피해 -25%, 정면으로 막을 때마다 오러 +4.', weapons: ['guardSword', 'bastionBlade'], style: 'mirror',
    skills: ['riposte', 'shieldCharge', 'provoke', 'ironWall', 'shieldBash', 'undying'] },
  greatsword: { race: 'knight', name: '대검술사', desc: '느리지만 묵직하다. 힘을 모을수록 강해진다.', trait: '「차지」 스킬은 길게 누르면 1~3단계로 힘을 모은다. 모으는 동안 받는 피해 -25%.', weapons: ['steelGreatsword', 'mountainCleaver'], style: 'giant',
    skills: ['sweep', 'dashSlash', 'swordWave', 'steadfast', 'crushBlow', 'skyfall'] },
  berserker: { race: 'orc', name: '광전사', desc: '맞을수록 분노가 차오르고, 분노가 높을수록 세진다.', trait: '분노 1당 공격력 +0.4% (분노 100이면 +40%). 분노를 쓰면 그만큼 약해진다.', weapons: ['twoHandAxe', 'bloodthirstAxe'], style: 'blood',
    skills: ['warCry', 'chargeSmash', 'crushingBlows', 'braceForIt', 'berserkSkill', 'rageBurst'] },
  thrower: { race: 'orc', name: '투척 전사', desc: '도끼를 휘두르고, 던지고, 작살로 끌어와 제압한다.', trait: '평타로 도끼를 휘두른다. 우클릭은 사방으로 도끼를 던지는 도끼 폭풍.', weapons: ['throwHatchet', 'twinReturnAxe'], style: 'giant',
    skills: ['harpoon', 'rapidThrow', 'greatAxe', 'groundSmash', 'leap', 'axeLegion'] },
  necromancer: { race: 'undead', name: '사령술사', desc: '쓰러뜨린 몬스터의 영혼을 거둬(50%, 최대 10개) 부하로 되살린다. 부하에게 적을 몰아주고, 약해진 부하는 터뜨린다.', weapons: ['skullStaff', 'deadScepter'], style: 'poison',
    skills: ['raiseSouls', 'soulDrain', 'skeletons', 'deathCall', 'corpseBlast', 'lichLord'] },
  hexer: { race: 'undead', name: '저주술사', desc: '저주로 적의 행동을 벌하고, 저주를 옆으로 번지게 한다.', trait: '평타가 저주를 건다.', weapons: ['cursedDoll', 'doomTome'], style: 'poison',
    skills: ['curse', 'painLink', 'retribution', 'deathFog', 'contagion', 'doomBrand'] },
  shadowblade: { race: 'assassin', name: '그림자 칼날', desc: '숨었다가 등 뒤를 친다.', trait: '은신 중 첫 공격 3배.', weapons: ['twinDaggers', 'nightPiercer'], style: 'shadow',
    skills: ['shadowStep', 'weakMark', 'ambush', 'stealth', 'shadowEvade', 'shadowDance'] },
  venomHunter: { race: 'assassin', name: '독침 사냥꾼', desc: '덫을 깔고 미끼로 몬스터를 끌어들인다.', trait: '평타가 독을 건다.', weapons: ['blowgun', 'viperBlowgun'], style: 'poison',
    skills: ['snare', 'retreatShot', 'bait', 'dartFan', 'smokeBomb', 'venomBurst'] },
  spiritcaller: { race: 'elf', name: '정령사', desc: '정령을 몸에 깃들여 싸운다. 깃든 정령은 내 주위를 떠다닌다.', trait: '정령은 최대 3개, 12초 동안 깃든다. 같은 정령을 겹치면 효과가 깊어지고, 서로 다른 정령을 섞으면 조합 효과가 붙는다.', weapons: ['spiritBranch', 'worldTreeStaff'], style: 'wind',
    skills: ['fireSpirit', 'windSpirit', 'forestSpirit', 'spiritAbsorb', 'spiritArrow', 'spiritKing'] },
  ranger: { race: 'elf', name: '숲의 사수', desc: '멈춰서 집중하고 멀리서 꿰뚫는다.', trait: '가만히 서 있으면 집중이 쌓인다(0.5초마다 1단계, 최대 3). 다음 사격 피해 단계당 +25%.', weapons: ['rangerBow', 'galeLongbow'], style: 'wind',
    skills: ['pierceArrow', 'windStep', 'vineSnare', 'pushArrow', 'aimedShot', 'skyPiercer'] },
  rockguard: { race: 'golem', name: '바위 수호자', desc: '무엇이든 버티고 되돌려준다.', weapons: ['rockFist', 'mountainHeart'], style: 'mirror',
    skills: ['stoneSkin', 'reflectCrystal', 'quake', 'crystalPrison', 'rockTremor', 'colossus'] },
  frostGolem: { race: 'golem', name: '얼음 골렘', desc: '둔화시키고 얼린 뒤 깨부순다.', weapons: ['iceFist', 'permafrostCore'], style: 'frost',
    skills: ['iceChunk', 'frostField', 'frostCharge', 'iceArmor', 'glacialSpikes', 'absoluteZero'] },
  dragoon: { race: 'dragon', name: '화룡 전사', desc: '날아올라 내리꽂고, 적을 낚아채 떨어뜨린다.', trait: '불타는 적에게 주는 피해 +15% (용족).', weapons: ['dragonSpear', 'wyrmFang'], style: 'fire',
    skills: ['breath', 'dragonClaw', 'soar', 'snatch', 'scales', 'dragonForm'] },
  dragonSage: { race: 'dragon', name: '용언 술사', desc: '용의 말을 이어 문장을 만든다.', trait: '용언 스킬을 쓸 때마다 단어가 쌓이고, 3개가 차면 문장이 자동으로 발동한다. 같은 단어를 겹칠수록 제곱으로 강해진다.', weapons: ['dragonTome', 'elderHeartstone'], style: 'fire',
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
    desc: '방패를 들고 돌진해 적을 밀쳐내고 0.6초 기절시킨다. 오러 +10.', do: [{ op: 'dash', dist: 90, mul: 1.2, knock: 220, stun: 0.6 }] },
  provoke: { name: '도발', role: '제어', cd: 10, cost: 10, scale: 'phys', fx: 'roar', aim: 'none', mo: 'roar',
    desc: '주변 적이 6초 동안 나만 노린다. 원거리 적도 거리를 두지 않고 다가온다. 오러 10.', do: [{ op: 'provoke', r: 130, dur: 6 }] },
  ironWall: { name: '철벽', role: '방어', cd: 14, cost: 15, scale: 'phys', fx: 'bubble', mo: 'guard',
    desc: '4초 동안 정면 피해를 완전히 막고, 그동안 오러를 2배로 얻는다. 오러 15.',
    do: [{ op: 'buff', id: 'ironWall', dur: 4, mods: {}, color: '#a8c8ff', bubble: true }] },
  shieldBash: { name: '방패 강타', role: '마무리', cd: 8, cost: 35, scale: 'phys', fx: 'smash', aim: 'tank', mo: 'bash',
    desc: '오러를 실어 방패로 내리친다. 큰 피해와 1.5초 기절, 강하게 밀쳐낸다. 오러 35.', do: [{ op: 'single', range: 50, mul: 3.0, stun: 1.5, knock: 260 }] },
  undying: { name: '불굴', role: '궁극', cd: 40, costAll: { min: 50 }, scale: 'phys', fx: 'buff', ult: true, mo: 'power',
    desc: '8초 동안 체력이 1 아래로 떨어지지 않고, 받는 피해 -30%. 받은 피해만큼 오러가 차오르고 주변에 충격파.',
    do: [{ op: 'aoe', at: 'self', r: 90, mul: 1.5, scaleRes: true, knock: 200, fx: 'holy' }, { op: 'buff', id: 'undying', dur: 8, mods: { dmgTakenMul: 0.7 }, color: '#ffd84a', bubble: true }] },

  // ══════ 기사 · 대검술사 (차지) ══════
  sweep: { name: '횡베기', role: '공격', cd: 5, gain: 12, scale: 'phys', fx: 'sweep', mo: 'sweep', charge: true,
    desc: '[차지] 넓은 반원을 베어 밀쳐낸다. 모을수록 범위와 피해가 커진다. 오러 +12.', do: [{ op: 'cone', range: 62, angle: 3.0, mul: 1.5, knock: 150, fx: 'sweep', chargeRange: 0.25 }] },
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
  rageBurst: { name: '분노 폭발', role: '궁극', cd: 20, costAll: { min: 50 }, scale: 'phys', fx: 'quake', ult: true, mo: 'overhead',
    desc: '분노를 모두 쏟아 주변을 내려친다. 분노가 많을수록 강하다.', do: [{ op: 'aoe', at: 'self', r: 92, mul: 3.4, scaleRes: true, knock: 220, fx: 'quake' }] },

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
  raiseSouls: { name: '영혼 소환', role: '소환', cd: 4, cost: 10, scale: 'mag', fx: 'summon', aim: 'none',
    desc: '거둔 영혼을 한 번에 최대 5개 되살린다. 원래 몬스터의 체력·공격력 50%로, 쓰러질 때까지 함께 싸운다. 부하는 최대 5마리, 나에게서 너무 멀어지면 돌아온다.',
    do: [{ op: 'raiseSouls', n: 5 }] },
  deathCall: { name: '망자의 부름', role: '제어', cd: 10, cost: 15, scale: 'mag', fx: 'roar', aim: 'none',
    desc: '내 부하들이 울부짖어 주변 적의 시선을 끈다. 6초 동안 적들이 부하만 노리고, 부하는 받는 피해 -30%.',
    do: [{ op: 'taunt', r: 110, dur: 6 }] },
  skeletons: { name: '해골 병사', role: '소환', cd: 12, cost: 20, scale: 'mag', fx: 'summon',
    desc: '20초 동안 싸우는 해골 병사 2마리를 부른다. 체력이 있어서 적의 공격을 받아낼 수 있다.', do: [{ op: 'summon', kind: 'skeleton', n: 2, dur: 20, mul: 0.55 }] },
  wraiths: { name: '망령 소환', role: '소환', cd: 14, cost: 20, scale: 'mag', fx: 'summon',
    desc: '10초 동안 적을 쫓는 망령 2마리를 부른다.', do: [{ op: 'summon', kind: 'ghost', n: 2, dur: 10, mul: 0.5 }] },
  soulDrain: { name: '영혼 흡수', role: '준비', cd: 3, scale: 'mag', elem: 'dark', fx: 'soul',
    desc: '영혼을 빨아들이는 탄. 맞히면 영혼 +12, 체력 3% 회복.', do: [{ op: 'proj', n: 1, speed: 240, range: 210, mul: 1.5, kind: 'soul', onHitGain: 12, onHitHeal: 0.03 }] },
  boneCage: { name: '뼈 감옥', role: '제어', cd: 11, cost: 15, scale: 'mag', fx: 'bones', aim: 'tank',
    desc: '뼈 우리로 적을 2.5초 가둔다. 갇힌 적은 받는 피해 +30%.', do: [{ op: 'aoe', at: 'aim', r: 36, mul: 0.4, stun: 2.5, prison: true, fx: 'bones' }] },
  corpseBlast: { name: '시체 폭발', role: '마무리', cd: 8, cost: 25, scale: 'mag', elem: 'dark', fx: 'burst', aim: 'none',
    desc: '체력이 가장 낮은 부하 3마리만 터뜨려 큰 범위 피해. 부하의 최대 체력이 클수록 강하다. 부하가 없으면 근처 적 하나를 터뜨린다.', do: [{ op: 'blastSummons', r: 64, mul: 2.4, n: 3 }] },
  lichLord: { name: '사령 군주', role: '궁극', cd: 30, costAll: { min: 60 }, scale: 'mag', fx: 'summon', ult: true,
    desc: '15초 동안 강력한 사령 군주를 부르고, 해골 병사 2마리를 함께 일으킨다. 영혼이 많을수록 강하다.',
    do: [{ op: 'summon', kind: 'lich', n: 1, dur: 15, mul: 1.8, scaleRes: true }, { op: 'summon', kind: 'skeleton', n: 2, dur: 15, mul: 0.6 }] },

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
    desc: '적에게 파고들어 3번 찌른다. 등 뒤에서 치면 1.5배, 출혈. 그림자 +10.',
    do: [{ op: 'dash', dist: 150, mul: 0.6, toward: 'nearest' }, { op: 'channel', dur: 0.36, every: 0.12, sub: { op: 'single', range: 40, mul: 0.8, backstab: true, status: 'bleed', stacks: 1, fx: 'stab' } }] },
  stealth: { name: '은신', role: '방어', cd: 14, cost: 20, scale: 'phys', fx: 'smoke', aim: 'none', mo: 'crouch',
    desc: '3초 동안 모습을 감춘다. 적이 나를 놓치고, 은신 중 첫 공격은 3배. 공격하면 풀린다. 그림자 20.', do: [{ op: 'stealth', dur: 3 }] },
  shadowEvade: { name: '그림자 회피', role: '방어', cd: 9, gain: 25, scale: 'phys', fx: 'blink', aim: 'away', mo: 'dash',
    desc: '적이 없는 쪽으로 물러나며 0.8초 무적. 그림자 +25.', do: [{ op: 'dash', dist: 80, mul: 0, invuln: 0.8 }] },
  shadowDance: { name: '그림자 춤', role: '궁극', cd: 24, costAll: { min: 50 }, scale: 'phys', fx: 'slashX', ult: true, aim: 'none', mo: 'stab',
    desc: '4초 동안 무적 상태로 주변 적 사이를 오가며 8번 벤다. 그림자가 많을수록 강하다.',
    do: [{ op: 'channel', dur: 4, every: 0.5, invuln: true, sub: { op: 'danceStrike', r: 130, mul: 1.2, scaleRes: true } }] },

  // ══════ 암살자 · 독침 사냥꾼 ══════
  snare: { name: '덫 설치', role: '제어', cd: 4, cost: 10, scale: 'phys', fx: 'trap', aim: 'cluster', mo: 'throw',
    desc: '덫을 던져 놓는다. 밟은 적은 2초 묶이고 독 4중첩. 최대 3개. 그림자 10.', do: [{ op: 'zone', kind: 'trap', r: 20, dur: 20, at: 'aim', max: 3 }] },
  retreatShot: { name: '후퇴 사격', role: '이동', cd: 6, gain: 15, scale: 'phys', fx: 'dart', aim: 'near', mo: 'shoot',
    desc: '뒤로 뛰면서 독침 5발을 분다. 그림자 +15.', do: [{ op: 'dash', dist: -80, mul: 0 }, { op: 'proj', n: 5, spread: 0.18, speed: 340, range: 210, mul: 0.7, status: 'poison', stacks: 1, kind: 'dart' }] },
  bait: { name: '미끼', role: '제어', cd: 14, cost: 15, scale: 'phys', fx: 'trap', aim: 'cluster', mo: 'throw',
    desc: '고기를 던진다. 6초 동안 주변 몬스터가 미끼로 몰려간다(정예는 짧게). 그림자 15.', do: [{ op: 'zone', kind: 'bait', r: 150, dur: 6, at: 'aim' }] },
  dartFan: { name: '독침 난사', role: '공격', cd: 6, cost: 18, scale: 'phys', fx: 'dart', mo: 'blow3',
    desc: '바람총을 세 번 연달아 불어 독침 3발씩, 모두 9발을 흩뿌린다. 맞을 때마다 독 2중첩. 그림자 18.', do: [{ op: 'channel', dur: 0.6, every: 0.2, sub: { op: 'proj', n: 3, spread: 0.16, speed: 360, range: 200, mul: 0.55, status: 'poison', stacks: 2, kind: 'dart' } }] },
  smokeBomb: { name: '연막탄', role: '방어', cd: 14, gain: 20, scale: 'phys', fx: 'smoke', aim: 'none', mo: 'crouch',
    desc: '연기를 터뜨린다. 4초 동안 회피 +50%, 주변 적이 나를 놓친다. 그림자 +20.',
    do: [{ op: 'aoe', at: 'self', r: 80, mul: 0, lose: true, fx: 'smoke' }, { op: 'buff', id: 'smoke', dur: 4, mods: { dodge: 0.5 }, color: '#8a8aa0' }] },
  venomBurst: { name: '맹독 폭발', role: '궁극', cd: 16, costAll: { min: 40 }, scale: 'phys', elem: 'poison', fx: 'burst', ult: true, aim: 'none', mo: 'power',
    desc: '독이 쌓인 모든 적의 독을 한꺼번에 터뜨린다. 중첩과 그림자가 많을수록 크다.', do: [{ op: 'detonate', what: 'poison', mul: 1.1, r: 46, scaleRes: true }] },

  // ══════ 엘프 · 정령사 (깃드는 정령) ══════
  fireSpirit: { name: '화염 정령', role: '강화', cd: 3, cost: 20, scale: 'best', fx: 'spiritIn', aim: 'none', mo: 'castBig',
    desc: '화염 정령이 깃든다(12초). 정령 하나당 공격력 +6%, 공격 시 30% 확률로 화상. 정령력 20.', do: [{ op: 'bind', elem: 'fire', dur: 12 }] },
  windSpirit: { name: '바람 정령', role: '강화', cd: 3, cost: 20, scale: 'best', fx: 'spiritIn', aim: 'none', mo: 'castBig',
    desc: '바람 정령이 깃든다(12초). 정령 하나당 공격 속도 +10%, 이동 속도 +6%, 평타 관통 +1. 정령력 20.', do: [{ op: 'bind', elem: 'wind', dur: 12 }] },
  forestSpirit: { name: '숲 정령', role: '방어', cd: 3, cost: 25, scale: 'best', fx: 'spiritIn', aim: 'none', mo: 'castBig',
    desc: '숲 정령이 깃든다(12초). 깃들 때 보호막(최대 체력 6%×정령 수), 정령 하나당 초당 체력 0.8% 회복. 정령력 25.', do: [{ op: 'bind', elem: 'forest', dur: 12 }] },
  spiritAbsorb: { name: '정령 흡수', role: '준비', cd: 7, scale: 'best', fx: 'absorb', mo: 'channel',
    desc: '1.2초 동안 주변 적의 생기를 빨아들인다. 맞힌 적 하나마다 정령력 +3.',
    do: [{ op: 'channel', dur: 1.2, every: 0.3, sub: { op: 'aoe', at: 'self', r: 80, mul: 0.35, gainPerHit: 3, fx: 'absorb' } }] },
  spiritArrow: { name: '정령의 화살', role: '공격', cd: 4, cost: 15, scale: 'best', fx: 'bolt', mo: 'cast', needSpirit: true,
    desc: '깃든 정령의 힘으로 관통하는 큰 화살을 쏜다. 정령이 많을수록 강하다. 깃든 정령이 없으면 쓸 수 없다. 정령력 15.', do: [{ op: 'spiritArrow', speed: 340, range: 260, mul: 1.4, per: 0.45 }] },
  spiritKing: { name: '정령왕 강림', role: '궁극', cd: 36, costAll: { min: 60 }, scale: 'best', fx: 'summon', ult: true, mo: 'castBig',
    desc: '15초 동안 가장 많이 깃든 정령의 왕이 나타나 주먹으로 싸운다. 바람은 멀리 날려 버리고, 불은 화염으로 태우고, 숲은 덩굴로 묶는다. 정령 칸도 그 정령으로 가득 찬다(깃든 정령이 없으면 불→바람→숲 차례). 정령력이 많을수록 강하다.',
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
    desc: '화염구를 쏜다. 단어 「불」 — 문장에서 조준한 곳에 폭발(겹칠수록 제곱으로 커짐). 용기 10.', do: [{ op: 'proj', n: 1, speed: 270, range: 220, mul: 1.2, splash: 30, stacks: 1, kind: 'fireball' }] },
  wordWing: { name: '용언: 날개', role: '이동', cd: 5, gain: 10, scale: 'mag', fx: 'blink', aim: 'away', mo: 'cast', word: 'wing',
    desc: '짧게 순간이동한다. 단어 「날개」 — 문장에서 사방으로 바람 칼날. 용기 +10.', do: [{ op: 'teleport', dist: 90 }] },
  wordSky: { name: '용언: 하늘', role: '공격', cd: 4, cost: 16, scale: 'mag', elem: 'fire', fx: 'meteor', aim: 'cluster', mo: 'castBig', word: 'sky',
    desc: '작은 운석을 떨어뜨린다. 단어 「하늘」 — 문장에서 운석이 여러 개 떨어진다. 용기 16.', do: [{ op: 'aoe', at: 'aim', r: 40, mul: 1.5, stacks: 1, delay: 0.5, fall: 'meteor', fx: 'meteor' }] },
  wordScale: { name: '용언: 비늘', role: '방어', cd: 6, cost: 14, scale: 'mag', fx: 'bubble', aim: 'none', mo: 'guard', word: 'scale',
    desc: '보호막(최대 체력 8%)을 얻는다. 단어 「비늘」 — 문장에서 큰 보호막, 3개면 2초 무적. 용기 14.', do: [{ op: 'shield', v: 0.08 }] },
  wordEarth: { name: '용언: 대지', role: '제어', cd: 7, cost: 20, scale: 'mag', fx: 'quake', mo: 'stomp', word: 'earth',
    desc: '주변 적을 0.8초 기절시킨다. 단어 「대지」 — 문장에서 넓은 지진과 긴 기절. 용기 20.', do: [{ op: 'aoe', at: 'self', r: 60, mul: 0.8, stun: 0.8 }] },
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

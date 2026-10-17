// 클래스와 액티브 스킬. 종족마다 클래스 2개, 클래스마다 스킬 6개(1·1·3·6·10·15레벨에 배움). 최대 3개 장착.
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
};
export const ELEM_CYCLE = ['fire', 'ice', 'lightning'];

// 클래스: 종족마다 2개. weapons = [시작 무기, 상위 무기], style = 각인 추천 필터
export const CLASSES = {
  predator: { race: 'dino', name: '포식자', desc: '출혈을 걸고 물어뜯어 흡혈하며 연타한다.', weapons: ['boneKnuckle', 'predatorFang'], style: 'blood',
    skills: ['bite', 'pounce', 'clawFrenzy', 'bloodScent', 'devour', 'rampage'] },
  behemoth: { race: 'dino', name: '대지 거수', desc: '돌격하고 들이받아 기절시키는 탱커.', weapons: ['stoneClub', 'tectonicHammer'], style: 'giant',
    skills: ['tailSwipe', 'headbutt', 'hardenShell', 'tremor', 'roar', 'extinction'] },
  elementalist: { race: 'wizard', name: '원소술사', desc: '속성을 바꿔 층의 약점을 찌른다. 시전 중에는 움직일 수 없다.', weapons: ['elemStaff', 'triOrb'], style: 'fire',
    skills: ['elemBolt', 'elemShift', 'elemMark', 'frostChain', 'lightningChain', 'grandFireball'] },
  chronomancer: { race: 'wizard', name: '시공술사', desc: '공간을 접어 끌어모으고, 시간을 늦춰 몰아친다.', weapons: ['hourglassStaff', 'aeonPendulum'], style: 'frost',
    skills: ['blinkBlast', 'arcaneBarrage', 'slowField', 'gravityCollapse', 'haste', 'timeStop'] },
  guardian: { race: 'knight', name: '수호기사', desc: '방패로 막고 받아친다. 맞을수록 오러가 쌓인다.', weapons: ['guardSword', 'bastionBlade'], style: 'mirror',
    skills: ['shieldCharge', 'ironWall', 'riposte', 'provoke', 'shieldBash', 'undying'] },
  greatsword: { race: 'knight', name: '대검술사', desc: '느리지만 묵직하다. 힘을 모아 한 방에 쓸어버린다.', weapons: ['steelGreatsword', 'mountainCleaver'], style: 'giant',
    skills: ['downSlash', 'sweep', 'swordWave', 'chargeUp', 'crushBlow', 'skyfall'] },
  berserker: { race: 'orc', name: '광전사', desc: '피를 흘릴수록 강해지는 근접 폭딜.', weapons: ['twoHandAxe', 'bloodthirstAxe'], style: 'blood',
    skills: ['warCry', 'chargeSmash', 'axeSpin', 'bloodThirst', 'berserkSkill', 'lastBlow'] },
  thrower: { race: 'orc', name: '투척 전사', desc: '도끼를 던지고 작살로 끌어와 중거리에서 제압한다.', weapons: ['throwHatchet', 'twinReturnAxe'], style: 'giant',
    skills: ['axeThrow', 'harpoon', 'sunder', 'groundSmash', 'warDrum', 'axeTempest'] },
  necromancer: { race: 'undead', name: '사령술사', desc: '해골과 망령을 부려 싸우고, 소환수를 터뜨린다.', weapons: ['skullStaff', 'deadScepter'], style: 'poison',
    skills: ['skeletons', 'wraiths', 'soulDrain', 'boneCage', 'corpseBlast', 'lichLord'] },
  hexer: { race: 'undead', name: '저주술사', desc: '저주를 쌓고 한꺼번에 터뜨린다.', weapons: ['cursedDoll', 'doomTome'], style: 'poison',
    skills: ['curse', 'plague', 'enfeeble', 'deathFog', 'soulBurst', 'doomBrand'] },
  shadowblade: { race: 'assassin', name: '그림자 칼날', desc: '등 뒤로 파고들어 약점을 처형한다.', weapons: ['twinDaggers', 'nightPiercer'], style: 'shadow',
    skills: ['shadowStep', 'weakMark', 'ambush', 'shadowClone', 'shadowEvade', 'execution'] },
  venomHunter: { race: 'assassin', name: '독침 사냥꾼', desc: '바람총 독침과 덫으로 멀리서 독을 쌓는다.', weapons: ['blowgun', 'viperBlowgun'], style: 'poison',
    skills: ['dartVolley', 'coatPoison', 'snare', 'smokeBomb', 'retreatShot', 'venomBurst'] },
  spiritcaller: { race: 'elf', name: '정령사', desc: '정령을 불러 함께 싸운다.', weapons: ['spiritBranch', 'worldTreeStaff'], style: 'wind',
    skills: ['fireSpirit', 'frostSpirit', 'stormSpirit', 'windBlessing', 'spiritFusion', 'spiritKing'] },
  ranger: { race: 'elf', name: '숲의 사수', desc: '멀리서 꿰뚫고 묶는다. 멀수록 강하다.', weapons: ['rangerBow', 'galeLongbow'], style: 'wind',
    skills: ['pierceArrow', 'multiShot', 'vineSnare', 'windStep', 'hawkEye', 'arrowRain'] },
  rockguard: { race: 'golem', name: '바위 수호자', desc: '무엇이든 버티고 되돌려준다.', weapons: ['rockFist', 'mountainHeart'], style: 'mirror',
    skills: ['stoneSkin', 'reflectCrystal', 'quake', 'crystalPrison', 'rockTremor', 'colossus'] },
  frostGolem: { race: 'golem', name: '얼음 골렘', desc: '둔화시키고 얼린 뒤 깨부순다.', weapons: ['iceFist', 'permafrostCore'], style: 'frost',
    skills: ['iceChunk', 'frostField', 'frostCharge', 'iceArmor', 'glacialSpikes', 'absoluteZero'] },
  dragoon: { race: 'dragon', name: '화룡 전사', desc: '불을 뿜고 할퀴는 근접 화염 전사.', weapons: ['dragonSpear', 'wyrmFang'], style: 'fire',
    skills: ['breath', 'wingDash', 'dragonClaw', 'scales', 'igniteBurst', 'dragonForm'] },
  dragonSage: { race: 'dragon', name: '용언 술사', desc: '용의 말로 불을 불러내는 원거리 화염 마법사.', weapons: ['dragonTome', 'elderHeartstone'], style: 'fire',
    skills: ['dragonFireball', 'flameWall', 'dragonRoar', 'meteorDrop', 'dragonBlood', 'wildfire'] },
};
export const RACE_CLASSES = (race) => Object.keys(CLASSES).filter((k) => CLASSES[k].race === race);
export const UNLOCKS = [1, 1, 3, 6, 10, 15];

export const SKILLS = {
  // ══════ 공룡 수인 · 포식자 ══════
  bite: { name: '물어뜯기', role: '준비', cd: 3, gain: 12, scale: 'phys', fx: 'bite',
    desc: '앞의 적을 물어 출혈 2중첩. 본능 +12.', do: [{ op: 'single', range: 46, mul: 1.5, status: 'bleed', stacks: 2 }] },
  pounce: { name: '맹습', role: '이동', cd: 5, gain: 10, scale: 'phys', fx: 'dash', aim: 'crowd',
    desc: '적에게 덮쳐 경로의 적에게 피해와 출혈. 다음 공격 확정 치명타.',
    do: [{ op: 'dash', dist: 110, mul: 1.4, status: 'bleed', stacks: 2 }, { op: 'buff', id: 'nextCrit', dur: 3, mods: {} }] },
  clawFrenzy: { name: '발톱 난무', role: '연타', cd: 6, scale: 'phys', fx: 'claws',
    desc: '1초 동안 앞쪽을 6번 할퀸다. 맞힐 때마다 본능 +3.',
    do: [{ op: 'channel', dur: 1.0, every: 0.16, sub: { op: 'cone', range: 40, angle: 1.4, mul: 0.5, gainPerHit: 3, fx: 'claws' } }] },
  bloodScent: { name: '피의 냄새', role: '제어', cd: 12, cost: 15, scale: 'phys', fx: 'roar',
    desc: '주변 적에게 출혈 3중첩. 8초 동안 흡혈 +12%.',
    do: [{ op: 'aoe', at: 'self', r: 80, mul: 0.4, status: 'bleed', stacks: 3, fx: 'blood' }, { op: 'buff', id: 'scent', dur: 8, mods: { lifesteal: 12 }, color: '#e0445a' }] },
  devour: { name: '포식', role: '마무리', cd: 8, costAll: { min: 20 }, scale: 'phys', fx: 'bite', aim: 'low',
    desc: '본능을 모두 써서 물어 끝낸다. 체력이 낮은 적에게 2배, 처치하면 체력 12% 회복.',
    do: [{ op: 'single', range: 60, mul: 2.8, scaleRes: true, bonusIf: 'lowhp', healOnKill: 0.12, teleportTo: true }] },
  rampage: { name: '원시 폭주', role: '궁극', cd: 30, costAll: { min: 60 }, scale: 'phys', fx: 'buff', ult: true,
    desc: '10초 동안 공격 속도 +50%, 흡혈 +15%, 이동 속도 +30%. 본능이 많을수록 공격력도 오른다.',
    do: [{ op: 'aoe', at: 'self', r: 90, mul: 1.2, fx: 'roar', fear: 2 }, { op: 'buff', id: 'rampage', dur: 10, mods: { atkSpeed: 1.5, lifesteal: 15, moveSpeed: 1.3, dmgMul: 1.15 }, color: '#ff4a2a', scaleRes: true }] },

  // ══════ 공룡 수인 · 대지 거수 ══════
  tailSwipe: { name: '꼬리 휘두르기', role: '준비', cd: 4, gain: 12, scale: 'phys', fx: 'spin',
    desc: '꼬리로 주변을 한 바퀴 쳐서 밀쳐낸다. 본능 +12.', do: [{ op: 'aoe', at: 'self', r: 52, mul: 1.2, knock: 160, fx: 'spin' }] },
  headbutt: { name: '박치기 돌격', role: '이동', cd: 7, gain: 10, scale: 'phys', fx: 'dash', aim: 'crowd',
    desc: '머리를 숙이고 돌진해 경로의 적을 1초 기절시킨다.', do: [{ op: 'dash', dist: 130, mul: 1.5, stun: 1.0, knock: 120 }] },
  hardenShell: { name: '껍질 굳히기', role: '방어', cd: 14, scale: 'phys', fx: 'bubble',
    desc: '6초 동안 받는 피해 -35%, 물리 저항 +40.',
    do: [{ op: 'buff', id: 'shell', dur: 6, mods: { dmgTakenMul: 0.65, pres: 40 }, color: '#c8b088', bubble: true }] },
  tremor: { name: '지축 울림', role: '제어', cd: 10, cost: 20, scale: 'phys', fx: 'quake',
    desc: '발을 굴러 주변 적을 1.5초 기절시킨다.', do: [{ op: 'aoe', at: 'self', r: 78, mul: 1.4, stun: 1.5 }] },
  roar: { name: '포효', role: '강화', cd: 12, gain: 25, scale: 'phys', fx: 'roar',
    desc: '주변 적을 위축시키고(공격력 -30%, 둔화) 6초 동안 공격력 +25%.',
    do: [{ op: 'aoe', at: 'self', r: 84, mul: 0.4, fear: 4 }, { op: 'buff', id: 'roarBuff', dur: 6, mods: { dmgMul: 1.25 }, color: '#ff9a3a' }] },
  extinction: { name: '대멸종', role: '궁극', cd: 32, costAll: { min: 60 }, scale: 'phys', fx: 'quake', ult: true,
    desc: '거대해진다. 12초 동안 받는 피해 -40%, 공격력 +40%. 변신하며 주변을 짓밟아 기절시킨다.',
    do: [{ op: 'aoe', at: 'self', r: 110, mul: 2.4, stun: 1.2, scaleRes: true, fx: 'quake' }, { op: 'buff', id: 'giant', dur: 12, mods: { dmgTakenMul: 0.6, dmgMul: 1.4 }, color: '#ffb066' }] },

  // ══════ 마법사 · 원소술사 (시전 중 이동 불가) ══════
  elemBolt: { name: '원소탄', role: '공격', cd: 1.2, cost: 8, cast: 0.25, elem: 'current', scale: 'mag', fx: 'bolt',
    desc: '현재 속성(화염·냉기·번개)의 마법탄. 터지면 주변에도 피해.',
    do: [{ op: 'proj', n: 1, speed: 280, range: 220, mul: 1.7, splash: 30, stacks: 2, kind: 'elem' }] },
  elemShift: { name: '원소 전환', role: '전환', cd: 2, scale: 'mag', fx: 'shift', aim: 'none',
    desc: '속성을 화염→냉기→번개 순으로 바꾼다. 바꾼 직후 다음 마법 피해 +30%. 층마다 약한 속성이 다르다.', do: [{ op: 'shift' }] },
  elemMark: { name: '원소 표식', role: '준비', cd: 8, cost: 10, cast: 0.2, scale: 'mag', fx: 'rune', aim: 'fresh',
    desc: '적이 모인 곳에 표식. 8초 동안 속성 피해 +40%.', do: [{ op: 'aoe', at: 'aim', r: 50, mul: 0.2, mark: 8 }] },
  frostChain: { name: '서리 사슬', role: '제어', cd: 6, cost: 15, cast: 0.45, elem: 'ice', scale: 'mag', fx: 'ice',
    desc: '얼음 사슬로 적을 묶는다. 냉기 3중첩, 1.2초 속박.', do: [{ op: 'proj', n: 1, speed: 260, range: 210, mul: 1.3, stacks: 3, stun: 1.2, kind: 'ice', pierce: 2 }] },
  lightningChain: { name: '번개 사슬', role: '공격', cd: 5, cost: 18, cast: 0.5, elem: 'lightning', scale: 'mag', fx: 'bolt',
    desc: '번개가 적 사이를 6번 튄다. 감전된 적은 받는 피해 +15%.', do: [{ op: 'chain', jumps: 6, range: 95, mul: 1.45 }] },
  grandFireball: { name: '거대 화염구', role: '궁극', cd: 22, cost: 60, cast: 1.3, elem: 'fire', scale: 'mag', fx: 'meteor', ult: true, aim: 'cluster',
    desc: '하늘에서 거대한 불덩이가 떨어진다. 넓은 범위에 엄청난 피해와 화상 5중첩, 표식 대상에게 효과가 크다.',
    do: [{ op: 'aoe', at: 'aim', r: 96, mul: 5.2, stacks: 5, bonusIf: 'marked', delay: 0.7, fall: 'fireball', fx: 'meteor' }] },

  // ══════ 마법사 · 시공술사 ══════
  blinkBlast: { name: '점멸', role: '이동', cd: 4, cost: 10, scale: 'mag', elem: 'arcane', fx: 'blink', aim: 'crowd',
    desc: '순간이동하고, 도착한 자리에 비전 폭발을 일으킨다.',
    do: [{ op: 'teleport', dist: 110 }, { op: 'aoe', at: 'self', r: 56, mul: 1.6, fx: 'arcane' }] },
  arcaneBarrage: { name: '비전 연발', role: '공격', cd: 3, cost: 14, cast: 0.3, scale: 'mag', elem: 'arcane', fx: 'bolt',
    desc: '적을 쫓아가는 비전 화살 7발을 연달아 쏜다.',
    do: [{ op: 'channel', dur: 0.7, every: 0.1, sub: { op: 'proj', n: 1, speed: 300, range: 260, mul: 0.75, homing: true, kind: 'arcane' } }] },
  slowField: { name: '시간 감속장', role: '장판', cd: 12, cost: 20, cast: 0.3, scale: 'mag', elem: 'arcane', fx: 'rune', aim: 'cluster',
    desc: '6초 동안 시간이 느려지는 장판. 안의 적과 적 투사체가 60% 느려지고, 받는 피해 +20%.',
    do: [{ op: 'zone', kind: 'slow', r: 72, dur: 6, at: 'aim' }] },
  gravityCollapse: { name: '중력 붕괴', role: '마무리', cd: 9, cost: 30, cast: 0.5, scale: 'mag', elem: 'arcane', fx: 'burst', aim: 'cluster',
    desc: '한 점으로 적들을 끌어모은 뒤 짓눌러 폭발시킨다. 모인 적이 많을수록 강하다.',
    do: [{ op: 'aoe', at: 'aim', r: 100, mul: 0.3, pullTo: true, fx: 'gravity' }, { op: 'aoe', at: 'aim', r: 60, mul: 2.6, perHit: 0.15, delay: 0.45, fx: 'implode' }] },
  haste: { name: '시간 가속', role: '강화', cd: 18, cost: 25, scale: 'mag', fx: 'buff',
    desc: '6초 동안 공격 속도 +40%, 이동 속도 +30%, 스킬 재사용 2배 빠르게.',
    do: [{ op: 'buff', id: 'haste', dur: 6, mods: { atkSpeed: 1.4, moveSpeed: 1.3, cdRate: 2 }, color: '#b98aff' }] },
  timeStop: { name: '시간 정지', role: '궁극', cd: 34, costAll: { min: 60 }, cast: 0.6, scale: 'mag', elem: 'arcane', fx: 'timestop', ult: true,
    desc: '주변의 시간을 3초 동안 멈춘다. 멈춘 적은 받는 피해 +50%, 풀리는 순간 비전 폭발.',
    do: [{ op: 'aoe', at: 'self', r: 150, mul: 0.5, stun: 3, freezeTime: 3, fx: 'timestop' }, { op: 'aoe', at: 'self', r: 150, mul: 2.5, scaleRes: true, delay: 3, fx: 'arcane' }] },

  // ══════ 기사 · 수호기사 (오러) ══════
  shieldCharge: { name: '방패 돌진', role: '이동', cd: 6, gain: 10, scale: 'phys', fx: 'dash', aim: 'crowd',
    desc: '방패를 들고 돌진해 적을 밀쳐내고 0.6초 기절시킨다.', do: [{ op: 'dash', dist: 90, mul: 1.2, knock: 220, stun: 0.6 }] },
  ironWall: { name: '철벽', role: '방어', cd: 12, scale: 'phys', fx: 'bubble',
    desc: '4초 동안 받는 피해 -50%. 그동안 맞으면 오러를 2배로 얻는다.',
    do: [{ op: 'buff', id: 'ironWall', dur: 4, mods: { dmgTakenMul: 0.5 }, color: '#a8c8ff', bubble: true }] },
  riposte: { name: '받아치기', role: '준비', cd: 7, scale: 'phys', fx: 'parry',
    desc: '0.8초 동안 막기 자세. 그사이 공격받으면 무효로 하고 큰 반격 + 오러 30.', do: [{ op: 'parry', dur: 0.8, mul: 2.8, r: 50, gain: 30 }] },
  provoke: { name: '도발', role: '제어', cd: 10, scale: 'phys', fx: 'roar',
    desc: '주변 적을 끌어당긴다. 끌려온 적 하나당 오러 +6.', do: [{ op: 'aoe', at: 'self', r: 100, mul: 0.2, pull: true, gainPerHit: 6 }] },
  shieldBash: { name: '방패 강타', role: '마무리', cd: 7, cost: 30, scale: 'phys', fx: 'smash', aim: 'tank',
    desc: '오러를 실어 방패로 내리친다. 큰 피해와 1.5초 기절, 강하게 밀쳐낸다.', do: [{ op: 'single', range: 50, mul: 3.0, stun: 1.5, knock: 260 }] },
  undying: { name: '불굴', role: '궁극', cd: 40, costAll: { min: 50 }, scale: 'phys', fx: 'buff', ult: true,
    desc: '8초 동안 체력이 1 아래로 떨어지지 않고, 받는 피해 -30%. 받은 피해만큼 오러가 차오르고 주변에 충격파.',
    do: [{ op: 'aoe', at: 'self', r: 90, mul: 1.5, scaleRes: true, knock: 200, fx: 'holy' }, { op: 'buff', id: 'undying', dur: 8, mods: { dmgTakenMul: 0.7 }, color: '#ffd84a', bubble: true }] },

  // ══════ 기사 · 대검술사 ══════
  downSlash: { name: '내려찍기', role: '준비', cd: 3, gain: 14, scale: 'phys', fx: 'smash',
    desc: '대검을 내려찍어 앞쪽 범위에 피해. 오러 +14.', do: [{ op: 'aoe', at: 'front', dist: 30, r: 34, mul: 1.6, fx: 'slam' }] },
  sweep: { name: '횡베기', role: '공격', cd: 5, scale: 'phys', fx: 'sweep',
    desc: '넓은 반원을 베어 적을 밀쳐낸다.', do: [{ op: 'cone', range: 60, angle: 3.0, mul: 1.6, knock: 150, fx: 'sweep' }] },
  swordWave: { name: '검기 날리기', role: '공격', cd: 5, cost: 15, scale: 'phys', fx: 'wave',
    desc: '관통하는 거대한 검기를 날린다.', do: [{ op: 'proj', n: 1, speed: 300, range: 240, mul: 2.0, pierce: 99, kind: 'wave' }] },
  chargeUp: { name: '힘 모으기', role: '강화', cd: 10, cast: 0.9, gain: 20, scale: 'phys', fx: 'charge', aim: 'none',
    desc: '0.9초 동안 힘을 모은다. 다음 스킬이나 공격 한 번의 피해 2.5배.', do: [{ op: 'buff', id: 'charged', dur: 6, mods: {}, color: '#ffe080' }] },
  crushBlow: { name: '파쇄 일격', role: '마무리', cd: 8, costAll: { min: 30 }, scale: 'phys', fx: 'smash', aim: 'tank',
    desc: '오러를 모두 실어 내리친다. 방어 50% 무시, 갑옷 부수기 3중첩. 오러가 많을수록 강하다.',
    do: [{ op: 'aoe', at: 'front', dist: 32, r: 48, mul: 2.8, scaleRes: true, pen: 0.5, armorBreak: 3, fx: 'quake' }] },
  skyfall: { name: '천붕참', role: '궁극', cd: 30, costAll: { min: 60 }, cast: 0.5, scale: 'phys', fx: 'skyfall', ult: true, aim: 'cluster',
    desc: '하늘을 가르는 거대한 일격. 앞으로 길게 뻗는 참격이 일직선의 적 모두에게 엄청난 피해.',
    do: [{ op: 'line', len: 260, w: 40, mul: 5.0, scaleRes: true, stun: 0.8, delay: 0.15, fx: 'skyfall' }] },

  // ══════ 오크 · 광전사 ══════
  warCry: { name: '전투 함성', role: '준비', cd: 12, gain: 30, scale: 'phys', fx: 'roar',
    desc: '분노 +30. 주변 적을 약화시킨다(받는 피해 +35%, 5초).', do: [{ op: 'aoe', at: 'self', r: 84, mul: 0.3, weak: 5 }] },
  chargeSmash: { name: '돌진 강타', role: '이동', cd: 6, gain: 10, scale: 'phys', fx: 'dash', aim: 'crowd',
    desc: '돌진한 뒤 도착한 곳을 내려찍는다.', do: [{ op: 'dash', dist: 110, mul: 0.8 }, { op: 'aoe', at: 'self', r: 50, mul: 1.6, delay: 0.18, fx: 'slam' }] },
  axeSpin: { name: '회전 도끼', role: '연타', cd: 7, cost: 15, scale: 'phys', fx: 'spin',
    desc: '1.6초 동안 회전하며 주변을 계속 벤다.', do: [{ op: 'channel', dur: 1.6, every: 0.2, sub: { op: 'aoe', at: 'self', r: 52, mul: 0.65, fx: 'spin' } }] },
  bloodThirst: { name: '피의 갈증', role: '강화', cd: 14, cost: 10, scale: 'phys', fx: 'buff',
    desc: '8초 동안 흡혈 +18%.', do: [{ op: 'buff', id: 'thirst', dur: 8, mods: { lifesteal: 18 }, color: '#c02030' }] },
  berserkSkill: { name: '광전사화', role: '강화', cd: 18, cost: 40, scale: 'phys', fx: 'buff',
    desc: '8초 동안 공격 속도 +35%, 공격력 +25%. 체력이 낮을수록 더 강해진다.',
    do: [{ op: 'buff', id: 'berserk', dur: 8, mods: { atkSpeed: 1.35, dmgMul: 1.25, lowHpDmg: 0.6 }, color: '#ff3a2a' }] },
  lastBlow: { name: '최후의 일격', role: '궁극', cd: 14, costAll: { min: 50 }, scale: 'phys', fx: 'smash', ult: true, aim: 'low',
    desc: '분노를 모두 쏟는 일격. 분노가 많을수록 강하고, 체력 30% 이하 적에게 2배.',
    do: [{ op: 'single', range: 60, mul: 4.4, scaleRes: true, bonusIf: 'lowhp', teleportTo: true }] },

  // ══════ 오크 · 투척 전사 ══════
  axeThrow: { name: '도끼 투척', role: '준비', cd: 2, gain: 10, scale: 'phys', fx: 'throw',
    desc: '도끼 2자루를 던진다. 맞히면 분노 +5씩.', do: [{ op: 'proj', n: 2, spread: 0.15, speed: 260, range: 200, mul: 1.1, kind: 'axe', onHitGain: 5 }] },
  harpoon: { name: '작살', role: '제어', cd: 7, scale: 'phys', fx: 'throw', aim: 'tank',
    desc: '작살을 던져 맞은 적을 내 앞으로 끌어오고 0.6초 기절.', do: [{ op: 'proj', n: 1, speed: 340, range: 230, mul: 1.2, pull: true, stun: 0.6, kind: 'harpoon' }] },
  sunder: { name: '파쇄 강타', role: '공격', cd: 5, gain: 10, scale: 'phys', fx: 'smash',
    desc: '방어를 깨부순다. 갑옷 부수기 3중첩(물리 저항 -15%).', do: [{ op: 'single', range: 46, mul: 1.9, armorBreak: 3 }] },
  groundSmash: { name: '지면 분쇄', role: '제어', cd: 9, cost: 20, scale: 'phys', fx: 'quake',
    desc: '땅을 깨뜨려 주변 적에게 피해와 1초 기절, 둔화.', do: [{ op: 'aoe', at: 'self', r: 74, mul: 1.6, stun: 1.0, status: 'chill', stacks: 2 }] },
  warDrum: { name: '전쟁 북', role: '강화', cd: 16, cost: 25, scale: 'phys', fx: 'roar',
    desc: '8초 동안 공격 속도 +30%, 공격력 +15%, 스킬 재사용 1.5배 빠르게.',
    do: [{ op: 'buff', id: 'drum', dur: 8, mods: { atkSpeed: 1.3, dmgMul: 1.15, cdRate: 1.5 }, color: '#ff8a4a' }] },
  axeTempest: { name: '도끼 폭풍', role: '궁극', cd: 26, costAll: { min: 50 }, scale: 'phys', fx: 'throw', ult: true, aim: 'none',
    desc: '사방으로 도끼를 세 번 연달아 흩뿌린다(48자루).',
    do: [{ op: 'channel', dur: 0.9, every: 0.3, sub: { op: 'proj', n: 16, spread: Math.PI * 2 / 16, speed: 240, range: 170, mul: 0.9, scaleRes: true, kind: 'axe', pierce: 1 } }] },

  // ══════ 언데드 · 사령술사 ══════
  skeletons: { name: '해골 병사', role: '소환', cd: 12, cost: 20, scale: 'mag', fx: 'summon',
    desc: '12초 동안 싸우는 해골 병사 2마리를 부른다.', do: [{ op: 'summon', kind: 'skeleton', n: 2, dur: 12, mul: 0.55 }] },
  wraiths: { name: '망령 소환', role: '소환', cd: 14, cost: 20, scale: 'mag', fx: 'summon',
    desc: '10초 동안 적을 쫓는 망령 2마리를 부른다.', do: [{ op: 'summon', kind: 'ghost', n: 2, dur: 10, mul: 0.5 }] },
  soulDrain: { name: '영혼 흡수', role: '준비', cd: 3, scale: 'mag', elem: 'dark', fx: 'soul',
    desc: '영혼을 빨아들이는 탄. 맞히면 영혼 +12, 체력 3% 회복.', do: [{ op: 'proj', n: 1, speed: 240, range: 210, mul: 1.5, kind: 'soul', onHitGain: 12, onHitHeal: 0.03 }] },
  boneCage: { name: '뼈 감옥', role: '제어', cd: 11, cost: 15, scale: 'mag', fx: 'bones', aim: 'tank',
    desc: '뼈 우리로 적을 2.5초 가둔다. 갇힌 적은 받는 피해 +30%.', do: [{ op: 'aoe', at: 'aim', r: 36, mul: 0.4, stun: 2.5, prison: true, fx: 'bones' }] },
  corpseBlast: { name: '시체 폭발', role: '마무리', cd: 8, cost: 25, scale: 'mag', elem: 'dark', fx: 'burst', aim: 'none',
    desc: '내 소환수를 모두 터뜨려 각각 큰 범위 피해. 소환수가 없으면 근처 적 하나를 터뜨린다.', do: [{ op: 'blastSummons', r: 60, mul: 2.6 }] },
  lichLord: { name: '사령 군주', role: '궁극', cd: 30, costAll: { min: 60 }, scale: 'mag', fx: 'summon', ult: true,
    desc: '15초 동안 강력한 사령 군주를 부르고, 해골 병사 2마리를 함께 일으킨다. 영혼이 많을수록 강하다.',
    do: [{ op: 'summon', kind: 'lich', n: 1, dur: 15, mul: 1.8, scaleRes: true }, { op: 'summon', kind: 'skeleton', n: 2, dur: 15, mul: 0.6 }] },

  // ══════ 언데드 · 저주술사 ══════
  curse: { name: '저주', role: '준비', cd: 4, gain: 8, scale: 'mag', elem: 'dark', fx: 'rune', aim: 'cluster',
    desc: '적이 모인 곳에 저주(지속 피해, 쌓일수록 강함)를 3중첩.', do: [{ op: 'aoe', at: 'aim', r: 50, mul: 0.3, stacks: 3 }] },
  plague: { name: '역병', role: '공격', cd: 6, cost: 10, scale: 'mag', elem: 'poison', fx: 'fog',
    desc: '역병 구체. 맞은 적과 주변에 독 4중첩, 저주 1중첩.', do: [{ op: 'proj', n: 1, speed: 200, range: 200, mul: 1.2, stacks: 4, splash: 46, kind: 'plague', extraStatus: 'curse' }] },
  enfeeble: { name: '쇠약', role: '제어', cd: 10, cost: 10, scale: 'mag', elem: 'dark', fx: 'rune', aim: 'cluster',
    desc: '적들이 6초 동안 주는 피해 -30%, 둔화, 받는 피해 +35%.', do: [{ op: 'aoe', at: 'aim', r: 64, mul: 0.2, fear: 6, weak: 6 }] },
  deathFog: { name: '죽음의 안개', role: '장판', cd: 12, cost: 15, scale: 'mag', elem: 'dark', fx: 'fog', aim: 'cluster',
    desc: '6초 안개. 안의 적은 지속 피해, 받는 피해 +20%, 저주가 저절로 쌓인다.', do: [{ op: 'zone', kind: 'fog', r: 66, dur: 6, at: 'aim' }] },
  soulBurst: { name: '영혼 폭발', role: '마무리', cd: 8, cost: 25, scale: 'mag', elem: 'dark', fx: 'burst', aim: 'none',
    desc: '저주받은 모든 적의 저주를 한 번에 터뜨린다. 중첩이 많을수록 크다.', do: [{ op: 'detonate', what: 'curse', mul: 1.3, r: 44 }] },
  doomBrand: { name: '파멸의 낙인', role: '궁극', cd: 28, costAll: { min: 50 }, scale: 'mag', elem: 'dark', fx: 'doom', ult: true, aim: 'tank',
    desc: '적 하나에 낙인. 큰 피해를 주고, 그 적이 죽으면 주변 모든 적에게 저주 6중첩과 폭발이 퍼진다.',
    do: [{ op: 'single', range: 220, mul: 3.0, scaleRes: true, doom: true, stacks: 5 }] },

  // ══════ 암살자 · 그림자 칼날 ══════
  shadowStep: { name: '그림자 이동', role: '이동', cd: 3, cost: 15, scale: 'phys', fx: 'blink', aim: 'back',
    desc: '가장 위협적인 적의 등 뒤로 순간이동한다. 다음 공격은 확정 치명타.', do: [{ op: 'teleport', dist: 110 }, { op: 'buff', id: 'nextCrit', dur: 3, mods: {} }] },
  weakMark: { name: '약점 표식', role: '준비', cd: 7, gain: 10, scale: 'phys', fx: 'rune', aim: 'fresh',
    desc: '적의 약점을 드러낸다. 8초 동안 받는 피해 +35%.', do: [{ op: 'single', range: 180, mul: 0.2, weak: 8 }] },
  ambush: { name: '급습', role: '연타', cd: 6, gain: 10, scale: 'phys', fx: 'dash',
    desc: '적에게 파고들어 3번 찌른다. 등 뒤에서 치면 1.5배, 출혈.',
    do: [{ op: 'dash', dist: 150, mul: 0.6, toward: 'nearest' }, { op: 'channel', dur: 0.36, every: 0.12, sub: { op: 'single', range: 40, mul: 0.8, backstab: true, status: 'bleed', stacks: 1, fx: 'stab' } }] },
  shadowClone: { name: '그림자 분신', role: '소환', cd: 15, cost: 25, scale: 'phys', fx: 'summon',
    desc: '8초 동안 나를 따라 공격하는 분신 2명을 만든다.', do: [{ op: 'summon', kind: 'clone', n: 2, dur: 8, mul: 0.5 }] },
  shadowEvade: { name: '그림자 회피', role: '방어', cd: 9, gain: 25, scale: 'phys', fx: 'blink', aim: 'away',
    desc: '적이 없는 쪽으로 물러나며 0.8초 무적. 그림자 +25.', do: [{ op: 'dash', dist: 80, mul: 0, invuln: 0.8 }] },
  execution: { name: '그림자 처형', role: '궁극', cd: 12, costAll: { min: 50 }, scale: 'phys', fx: 'slashX', ult: true, aim: 'low',
    desc: '그림자를 모두 써서 적을 다섯 번 벤다. 그림자가 많을수록 강하고, 약점 표식 대상에게 2배.',
    do: [{ op: 'single', range: 80, mul: 0.2, teleportTo: true }, { op: 'channel', dur: 0.5, every: 0.1, sub: { op: 'single', range: 60, mul: 1.1, scaleRes: true, bonusIf: 'weak', fx: 'slashX' } }] },

  // ══════ 암살자 · 독침 사냥꾼 ══════
  dartVolley: { name: '독침', role: '준비', cd: 1.5, gain: 6, scale: 'phys', fx: 'dart',
    desc: '독침 3발을 부채꼴로 분다. 맞을 때마다 독 1중첩.', do: [{ op: 'proj', n: 3, spread: 0.16, speed: 340, range: 210, mul: 0.7, status: 'poison', stacks: 1, kind: 'dart' }] },
  coatPoison: { name: '독 바르기', role: '강화', cd: 14, cost: 15, scale: 'phys', fx: 'buff',
    desc: '8초 동안 모든 공격에 독 2중첩이 붙는다.', do: [{ op: 'buff', id: 'venom', dur: 8, mods: {}, color: '#9be15d' }] },
  snare: { name: '덫 설치', role: '제어', cd: 4, cost: 10, scale: 'phys', fx: 'trap', aim: 'cluster',
    desc: '덫을 던져 놓는다. 밟은 적은 2초 묶이고 독 4중첩. 최대 3개.', do: [{ op: 'zone', kind: 'trap', r: 20, dur: 20, at: 'aim', max: 3 }] },
  smokeBomb: { name: '연막탄', role: '방어', cd: 14, gain: 20, scale: 'phys', fx: 'smoke',
    desc: '연기를 터뜨린다. 4초 동안 회피 +50%, 주변 적은 위축, 다음 공격 확정 치명타.',
    do: [{ op: 'aoe', at: 'self', r: 70, mul: 0, fear: 3, fx: 'smoke' }, { op: 'buff', id: 'smoke', dur: 4, mods: { dodge: 0.5 }, color: '#8a8aa0' }, { op: 'buff', id: 'nextCrit', dur: 4, mods: {} }] },
  retreatShot: { name: '후퇴 사격', role: '이동', cd: 6, gain: 15, scale: 'phys', fx: 'dart', aim: 'near',
    desc: '뒤로 뛰면서 독침 5발을 분다.', do: [{ op: 'dash', dist: -80, mul: 0 }, { op: 'proj', n: 5, spread: 0.18, speed: 340, range: 210, mul: 0.7, status: 'poison', stacks: 1, kind: 'dart' }] },
  venomBurst: { name: '맹독 폭발', role: '궁극', cd: 16, costAll: { min: 40 }, scale: 'phys', elem: 'poison', fx: 'burst', ult: true, aim: 'none',
    desc: '독이 쌓인 모든 적의 독을 한꺼번에 터뜨린다. 중첩과 그림자가 많을수록 크다.', do: [{ op: 'detonate', what: 'poison', mul: 1.1, r: 46, scaleRes: true }] },

  // ══════ 엘프 · 정령사 ══════
  fireSpirit: { name: '화염 정령', role: '소환', cd: 10, cost: 20, scale: 'best', fx: 'summon',
    desc: '14초 동안 화염탄을 쏘는 정령을 부른다.', do: [{ op: 'summon', kind: 'spirit', elem: 'fire', n: 1, dur: 14, mul: 0.5 }] },
  frostSpirit: { name: '냉기 정령', role: '소환', cd: 10, cost: 20, scale: 'best', fx: 'summon',
    desc: '14초 동안 적을 얼리는 냉기 정령을 부른다.', do: [{ op: 'summon', kind: 'spirit', elem: 'ice', n: 1, dur: 14, mul: 0.45 }] },
  stormSpirit: { name: '폭풍 정령', role: '소환', cd: 10, cost: 20, scale: 'best', fx: 'summon',
    desc: '14초 동안 빠르게 번개를 튀기는 정령을 부른다.', do: [{ op: 'summon', kind: 'spirit', elem: 'lightning', n: 1, dur: 14, mul: 0.35 }] },
  windBlessing: { name: '바람의 가호', role: '강화', cd: 14, cost: 15, scale: 'best', fx: 'wind',
    desc: '8초 동안 공격 속도 +35%, 이동 속도 +35%. 정령도 함께 빨라진다.', do: [{ op: 'buff', id: 'wind', dur: 8, mods: { atkSpeed: 1.35, moveSpeed: 1.35 }, color: '#bfffd0' }] },
  spiritFusion: { name: '정령 융합', role: '마무리', cd: 14, cost: 30, scale: 'best', fx: 'meteor', aim: 'cluster',
    desc: '정령들이 한 점으로 날아가 합쳐 터진다. 정령 수와 서로 다른 속성 조합만큼 강하다. 정령은 사라지지 않는다.',
    do: [{ op: 'resonance', r: 90, mul: 2.6, keep: true }] },
  spiritKing: { name: '정령왕 소환', role: '궁극', cd: 36, costAll: { min: 60 }, scale: 'best', fx: 'summon', ult: true,
    desc: '불·얼음·번개 중 무작위 속성의 정령왕을 15초 동안 부른다. 거대한 원소 공격을 퍼붓는다.',
    do: [{ op: 'summon', kind: 'spiritKing', n: 1, dur: 15, mul: 1.1, scaleRes: true }] },

  // ══════ 엘프 · 숲의 사수 ══════
  pierceArrow: { name: '관통 화살', role: '준비', cd: 2.5, gain: 10, scale: 'phys', fx: 'arrow',
    desc: '일직선의 적을 모두 꿰뚫는 강한 화살.', do: [{ op: 'proj', n: 1, speed: 420, range: 280, mul: 2.0, pierce: 99, kind: 'arrow' }] },
  multiShot: { name: '다중 사격', role: '공격', cd: 4, cost: 10, scale: 'phys', fx: 'arrow',
    desc: '화살 7발을 부채꼴로 쏜다.', do: [{ op: 'proj', n: 7, spread: 0.13, speed: 380, range: 230, mul: 0.9, pierce: 1, kind: 'arrow' }] },
  vineSnare: { name: '덩굴 속박', role: '제어', cd: 9, cost: 15, scale: 'phys', fx: 'vines', aim: 'cluster',
    desc: '고른 자리에서 덩굴이 솟아 범위 안의 적을 2초 묶는다.', do: [{ op: 'aoe', at: 'aim', r: 58, mul: 0.6, stun: 2.0, root: true, fx: 'vines' }] },
  windStep: { name: '바람 걸음', role: '이동', cd: 5, gain: 10, scale: 'phys', fx: 'dash', aim: 'away',
    desc: '적이 없는 쪽으로 미끄러진다. 다음 공격 피해 +60%.', do: [{ op: 'dash', dist: 90, mul: 0 }, { op: 'buff', id: 'charged', dur: 3, mods: {}, power: 1.6, color: '#bfffd0' }] },
  hawkEye: { name: '매의 눈', role: '강화', cd: 16, cost: 20, scale: 'phys', fx: 'buff',
    desc: '8초 동안 치명타 확률 +30%, 공격력 +15%.', do: [{ op: 'buff', id: 'hawk', dur: 8, mods: { crit: 0.3, dmgMul: 1.15 }, color: '#ffe080' }] },
  arrowRain: { name: '화살비', role: '궁극', cd: 22, costAll: { min: 50 }, scale: 'phys', fx: 'rain', ult: true, aim: 'cluster',
    desc: '넓은 범위에 3초 동안 화살이 쏟아진다. 정령력이 많을수록 강하다.', do: [{ op: 'zone', kind: 'arrows', r: 90, dur: 3, at: 'aim', scaleRes: true }] },

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

  // ══════ 용족 · 화룡 전사 ══════
  breath: { name: '화염 숨결', role: '준비', cd: 7, scale: 'best', elem: 'fire', fx: 'breath',
    desc: '1.2초 동안 앞쪽에 불을 뿜어 화상을 계속 쌓는다.',
    do: [{ op: 'channel', dur: 1.2, every: 0.1, sub: { op: 'cone', range: 86, angle: 0.8, mul: 0.3, stacks: 1, gainPerHit: 1, fx: 'breath' } }] },
  wingDash: { name: '날개 돌진', role: '이동', cd: 7, gain: 10, scale: 'best', elem: 'fire', fx: 'dash', aim: 'crowd',
    desc: '날개를 펴고 돌진한다. 지나간 자리에 불길이 남는다.', do: [{ op: 'dash', dist: 130, mul: 1.1, stacks: 1, fireTrail: true }] },
  dragonClaw: { name: '용 발톱', role: '공격', cd: 4, gain: 8, scale: 'best', elem: 'fire', fx: 'claws',
    desc: '크게 두 번 할퀸다. 불타는 적에게 1.5배.', do: [{ op: 'channel', dur: 0.24, every: 0.12, sub: { op: 'cone', range: 50, angle: 1.8, mul: 1.1, bonusIf: 'burning', fx: 'claws' } }] },
  scales: { name: '비늘 갑옷', role: '방어', cd: 14, scale: 'best', fx: 'bubble',
    desc: '6초 동안 받는 피해 -30%, 나를 때린 적은 화상 2중첩.', do: [{ op: 'buff', id: 'scales', dur: 6, mods: { dmgTakenMul: 0.7 }, color: '#ff8a4a', bubble: true }] },
  igniteBurst: { name: '발화 폭발', role: '마무리', cd: 10, cost: 30, scale: 'best', elem: 'fire', fx: 'burst', aim: 'none',
    desc: '불타는 모든 적의 화상을 한꺼번에 터뜨린다. 중첩이 많을수록 크다.', do: [{ op: 'detonate', what: 'burn', mul: 1.0, r: 46 }] },
  dragonForm: { name: '용화', role: '궁극', cd: 30, costAll: { min: 60 }, scale: 'best', fx: 'buff', ult: true,
    desc: '10초 동안 용으로 각성한다. 공격력 +40%, 모든 공격에 화상, 숨결 재사용 대기 없음.',
    do: [{ op: 'aoe', at: 'self', r: 100, mul: 1.6, stacks: 3, elemFire: true, fx: 'pillar' }, { op: 'buff', id: 'dragonForm', dur: 10, mods: { dmgMul: 1.4 }, color: '#ff5a2a', scaleRes: true }] },

  // ══════ 용족 · 용언 술사 ══════
  dragonFireball: { name: '용언 화염구', role: '준비', cd: 2, gain: 10, cast: 0.2, scale: 'mag', elem: 'fire', fx: 'bolt',
    desc: '터지면서 주변에 화상 2중첩을 거는 화염구.', do: [{ op: 'proj', n: 1, speed: 260, range: 220, mul: 1.6, splash: 40, stacks: 2, kind: 'fireball' }] },
  flameWall: { name: '불꽃 방벽', role: '장판', cd: 12, cost: 15, scale: 'mag', elem: 'fire', fx: 'pillar', aim: 'cluster',
    desc: '조준한 곳에 가로로 불의 벽을 세운다. 지나가는 적은 계속 불탄다.', do: [{ op: 'zone', kind: 'fire', r: 20, dur: 6, at: 'aim', wall: 5 }] },
  dragonRoar: { name: '용의 포효', role: '제어', cd: 12, cost: 20, scale: 'mag', elem: 'fire', fx: 'roar',
    desc: '주변 적을 위축시키고, 이미 불타는 적에게 화상 3중첩을 더한다.', do: [{ op: 'aoe', at: 'self', r: 90, mul: 0.5, fear: 3, stacksIfBurning: 3 }] },
  meteorDrop: { name: '운석', role: '마무리', cd: 9, cost: 35, cast: 0.6, scale: 'mag', elem: 'fire', fx: 'meteor', aim: 'cluster',
    desc: '적이 가장 많이 모인 곳에 운석이 떨어진다. 화상 3중첩.', do: [{ op: 'aoe', at: 'aim', r: 70, mul: 3.4, stacks: 3, delay: 0.6, fall: 'meteor', fx: 'meteor' }] },
  dragonBlood: { name: '용혈 각성', role: '강화', cd: 16, cost: 20, scale: 'mag', fx: 'buff',
    desc: '8초 동안 공격력 +30%, 스킬 재사용 1.5배 빠르게.', do: [{ op: 'buff', id: 'dragonBlood', dur: 8, mods: { dmgMul: 1.3, cdRate: 1.5 }, color: '#ff6a2a' }] },
  wildfire: { name: '대화재', role: '궁극', cd: 34, costAll: { min: 60 }, cast: 0.8, scale: 'mag', elem: 'fire', fx: 'meteor', ult: true, aim: 'cluster',
    desc: '넓은 지역을 6초 동안 불바다로 만들고, 운석 세 개가 연달아 떨어진다.',
    do: [{ op: 'zone', kind: 'inferno', r: 110, dur: 6, at: 'aim', scaleRes: true }, { op: 'aoe', at: 'aim', r: 60, mul: 2.4, stacks: 3, delay: 0.5, fall: 'meteor', jitter: 50 }, { op: 'aoe', at: 'aim', r: 60, mul: 2.4, stacks: 3, delay: 1.0, fall: 'meteor', jitter: 50 }, { op: 'aoe', at: 'aim', r: 60, mul: 2.4, stacks: 3, delay: 1.5, fall: 'meteor', jitter: 50 }] },

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

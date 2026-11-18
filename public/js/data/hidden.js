// 숨은 각인: 얻는 방법을 알려 주지 않는 아주 센 각인. 조건을 채우면 그 각인의 「증표」(잔향)를 받고 공명 제단에서 새긴다.
// 얻으면 칭호가 붙는다 (히든 클래스 느낌). 조건 검사는 sim/hidden.js · 제단에는 증표를 가진 각인만 보인다 (나머지는 ???)
// 1단계 (2026-11-18): 위업 아홉. 금기 · 종족 스승 · 전설 몬스터 · 도플갱어는 다음 단계
// 이 파일은 다른 데이터를 가져오지 않는다 (skills · engravings · monsters 가 여기서 가져간다)

const on = (event, chance, action, text) => ({ type: 'on', event, chance, action, text });
const mul = (key, v, text) => ({ type: 'mul', key, v, text });
const add = (key, v, text) => ({ type: 'add', key, v, text });
const flag = (f, text) => ({ type: 'flag', flag: f, text });

// id · 칭호 · 각인 이름 · 갈래(feat 위업) · 조건(얻은 뒤에만 보인다) · 힌트(못 얻었을 때 ??? 아래 한 줄) · 능력치 · 효과 · 스킬
export const HIDDEN = [
  { id: 'fistKing', title: '권왕', name: '맨몸의 전설', kind: 'feat', color: '#ffb070',
    cond: '무기(맨손) · 방어구 · 왼손 · 장신구 없이 30층의 주인을 쓰러뜨린다', hint: '아무것도 쥐지 않은 손',
    stats: { str: 14, agi: 10, vit: 8 },
    effects: [flag('bareKing', '무기(맨손) · 왼손 · 갑옷 · 장신구 칸이 하나 빌 때마다 모든 기본 스탯 +8% (최대 +40%)')],
    skill: 'hFistStorm', weapons: ['fist'] },
  { id: 'noShadow', title: '무영', name: '그림자 없는 발', kind: 'feat', color: '#cfe8ff',
    cond: '한 대도 맞지 않고 10층의 주인을 쓰러뜨린다', hint: '닿지 않는 그림자',
    stats: { agi: 14, sen: 10 },
    effects: [flag('noShadow', '5초 동안 맞지 않으면 다음 평타 피해 ×3'), add('dodge', 0.05, '회피 +5%')],
    skill: 'hShadowless' },
  { id: 'gale', title: '질풍', name: '탑을 가르는 바람', kind: 'feat', color: '#bfe8ff',
    cond: '1층부터 10층의 주인까지 5분 안에 오른다', hint: '아무도 따라잡지 못한 걸음',
    stats: { agi: 16, str: 6 },
    effects: [mul('moveSpeed', 1.2, '이동 속도 +20%'), mul('dashCd', 0.8, '대시 쿨타임 -20%')],
    skill: 'hGaleCut' },
  { id: 'voidVessel', title: '공허의 그릇', name: '비어 있는 그릇', kind: 'feat', color: '#b8a8ff',
    cond: '각인을 하나도 끼우지 않고 20층의 주인을 쓰러뜨린다', hint: '아무것도 새기지 않은 몸',
    stats: { str: 10, agi: 10, vit: 10 },
    effects: [flag('voidVessel', '비어 있는 각인 칸 하나마다 평타 피해 +25% (최대 +100%)')],
    skill: 'hVoidStrike' },
  { id: 'bladeGhost', title: '검귀', name: '베어 넘긴 여섯', kind: 'feat', color: '#e8e2cf',
    cond: '한 번의 등반에서 1~30층의 수호자 · 주인 여섯을 모두 싸움을 시작하고 30초 안에 쓰러뜨린다', hint: '여섯 번의 한숨',
    stats: { str: 16, sen: 8 },
    effects: [flag('bossReset', '수호자 · 주인을 쓰러뜨리면 모든 스킬 쿨타임이 끝난다'), add('critDmg', 0.3, '치명타 피해 +30%')],
    skill: 'hGhostCut' },
  { id: 'berserk', title: '광전사', name: '멈추지 않는 팔', kind: 'feat', color: '#ff5a4a',
    cond: '10층의 주인을 처음부터 끝까지 1초 넘게 쉬지 않고 계속 쳐서 쓰러뜨린다', hint: '쉬지 않는 팔',
    stats: { str: 14, vit: 10 },
    effects: [flag('frenzy', '칠 때마다 공격 속도 +3% (최대 +60%) · 1초 동안 치지 않으면 사라진다')],
    skill: 'hFrenzy' },
  { id: 'slaughter', title: '학살자', name: '쉰 개의 무덤', kind: 'feat', color: '#e0445a',
    cond: '어디서든 10초 안에 몬스터 50마리를 쓰러뜨린다', hint: '눈 깜짝할 사이의 무덤',
    stats: { str: 12, vit: 8, agi: 6 },
    effects: [flag('slaughter', '쓰러뜨릴 때마다 5초 동안 피해 +5% (최대 10중첩 · +50%)')],
    skill: 'hButcher' },
  { id: 'bulwark', title: '철벽', name: '부서지지 않는 성벽', kind: 'feat', color: '#a8c8ff',
    cond: '20층의 주인의 공격을 방패로 정면에서 5번 넘게 받아 내고, 그 밖에는 한 대도 맞지 않고 쓰러뜨린다', hint: '정면으로만 받은 성벽',
    stats: { pres: 18, vit: 12 },
    effects: [flag('shieldX2', '방패로 막을 때 줄이는 피해 2배'), flag('frontGuard', '정면 피해 -25%, 정면으로 막으면 막은 피해의 25%를 되갚는다')],
    skill: 'hCounterWall' },
  { id: 'rebel', title: '탑의 반역자', name: '탑을 거스른 낙인', kind: 'feat', color: '#c45cff',
    cond: '서약을 모두 최대로 걸고 1층부터 50층의 주인까지 한 번의 등반으로 오른다', hint: '탑이 건 모든 저주를 지고',
    stats: { str: 10, mag: 10, vit: 10, pres: 6, mres: 6 },
    effects: [flag('rebel', '나에게 걸린 상태이상 하나마다 피해 +10% · 탑 안에서는 건 서약 하나마다 피해 +2%')],
    skill: 'hRebelBrand' },
];
export const HIDDEN_BY_ID = Object.fromEntries(HIDDEN.map((h) => [h.id, h]));
export const hiddenEngId = (id) => 'h_' + id; // 각인 아이디
export const hiddenEcho = (id) => 'hx_' + id; // 증표 (잔향) 아이디

// 스킬: 자원을 쓰지 않는다 (어느 종족이든 같은 힘) · 쿨타임으로만 묶는다 · 무기와 상관없이 쓴다(몸)
export const HIDDEN_SKILLS = {
  hFistStorm: { name: '백열권', role: '연타', cd: 9, scale: 'phys', fx: 'smash', mo: 'blow3', aim: 'tank', hidden: true,
    desc: '앞으로 주먹을 여덟 번 내지르고(한 번에 공격력 55%) 마지막에 땅을 울리는 일격(공격력 320% · 0.8초 기절). 맨손이면 피해 +50%.',
    do: [{ op: 'channel', dur: 0.8, every: 0.1, sub: { op: 'aoe', at: 'front', dist: 22, r: 30, mul: 0.55, fx: 'fist', bare: 1.5 } }, { op: 'aoe', at: 'front', dist: 26, r: 56, mul: 3.2, stun: 0.8, delay: 0.85, fx: 'quake', bare: 1.5 }] },
  hShadowless: { name: '무영보', role: '이동', cd: 6, scale: 'phys', fx: 'blink', mo: 'dashSlash', aim: 'crowd', hidden: true,
    desc: '1초 동안 아무것도 닿지 않는 걸음으로 멀리 내달린다. 지나간 길의 적에게 공격력 240% 피해.',
    do: [{ op: 'dash', dist: 150, mul: 2.4, invuln: 1.0 }] },
  hGaleCut: { name: '질풍참', role: '공격', cd: 7, scale: 'phys', fx: 'dash', mo: 'dashSlash', aim: 'crowd', hidden: true,
    desc: '바람처럼 두 번 내달리며 길 위의 적을 모두 벤다 (한 번에 공격력 200%).',
    do: [{ op: 'dash', dist: 120, mul: 2.0 }, { op: 'dash', dist: 120, mul: 2.0, delay: 0.25 }] },
  hVoidStrike: { name: '공허 일격', role: '마무리', cd: 10, scale: 'phys', fx: 'smash', mo: 'overhead', aim: 'tank', hidden: true,
    desc: '텅 빈 힘으로 한 적을 내리친다. 공격력 400% · 비어 있는 각인 칸 하나마다 +100%.',
    do: [{ op: 'single', range: 60, mul: 4.0, voidMul: 1.0 }] },
  hGhostCut: { name: '귀참', role: '마무리', cd: 14, scale: 'phys', fx: 'skyfall', mo: 'overhead', aim: 'cluster', hidden: true,
    desc: '눈에 보이지 않는 한 칼. 앞으로 뻗는 참격이 일직선의 적 모두에게 공격력 600% 피해.',
    do: [{ op: 'line', len: 220, w: 34, mul: 6.0, delay: 0.1, fx: 'skyfall' }] },
  hFrenzy: { name: '광란', role: '강화', cd: 16, scale: 'phys', fx: 'buff', mo: 'roar', hidden: true,
    desc: '6초 동안 공격 속도 +40%, 「멈추지 않는 팔」 중첩이 바로 가득 찬다.',
    do: [{ op: 'buff', id: 'hFrenzyBurst', dur: 6, mods: { atkSpeed: 1.4 }, color: '#ff5a4a', frenzyFill: true }] },
  hButcher: { name: '도륙', role: '공격', cd: 8, scale: 'phys', fx: 'spin', mo: 'spin', hidden: true,
    desc: '몸을 세 번 크게 돌려 둘레를 휩쓴다. 마지막 바퀴가 가장 세다 (공격력 160% · 160% · 300%).',
    do: [{ op: 'comboSpin', n: 3, every: 0.24, step: 18, r: 70, mul: 1.6, last: 3.0, knock: 140 }] },
  hCounterWall: { name: '반격의 벽', role: '방어', cd: 14, scale: 'phys', fx: 'bubble', mo: 'guard', hidden: true,
    desc: '5초 동안 정면 피해를 완전히 막고, 막은 피해의 80%를 때린 적에게 되돌려 준다.',
    do: [{ op: 'buff', id: 'ironWall', dur: 5, mods: {}, color: '#a8c8ff', bubble: true }] },
  hRebelBrand: { name: '반역의 낙인', role: '제어', cd: 15, scale: 'phys', fx: 'roar', mo: 'roar', hidden: true,
    desc: '내 몸의 상태이상을 모두 털어 내 둘레의 적에게 옮기고(하나마다 3중첩), 공격력 260% 피해.',
    do: [{ op: 'aoe', at: 'self', r: 90, mul: 2.6, rebelPass: true, fx: 'doom' }] },
};

// 데이터 등록 (다른 표에 붙인다)
export function registerHiddenEngravings(ENGRAVINGS) {
  for (const h of HIDDEN) ENGRAVINGS[hiddenEngId(h.id)] = { name: h.name, slot: 'heart', grade: 5, load: 10, hidden: h.id, weapons: h.weapons || 'all', tags: [], stats: h.stats, effects: h.effects, recipe: { [hiddenEcho(h.id)]: 1 } };
}
export function registerHiddenSkills(SKILLS, ENGRAVING_SKILLS) {
  Object.assign(SKILLS, HIDDEN_SKILLS);
  for (const h of HIDDEN) ENGRAVING_SKILLS[hiddenEngId(h.id)] = h.skill;
}
export function registerHiddenEchoes(ECHOES) {
  for (const h of HIDDEN) ECHOES[hiddenEcho(h.id)] = { name: `${h.title}의 증표`, color: h.color, rare: true, hidden: h.id };
}

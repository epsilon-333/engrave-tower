// 숨은 각인: 얻는 방법을 알려 주지 않는 아주 센 각인. 조건을 채우면 그 각인의 「증표」(잔향)를 받고 공명 제단에서 새긴다.
// 얻으면 칭호가 붙는다 (히든 클래스 느낌). 조건 검사는 sim/hidden.js · 제단에는 증표를 가진 각인만 보인다 (나머지는 ???)
// 갈래: feat 위업 · taboo 금기 · teacher 숨은 스승(40층 주인을 쓰러뜨린 무기 갈래마다 하나 · sim/teacher.js) · doppel 나의 그림자 · legend 전설 몬스터
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
  // ── 금기: 일부러 노려야만 쌓인다 ──
  { id: 'necro', title: '사령군주', name: '망자의 군주', kind: 'taboo', color: '#7ae8ff',
    cond: '사람을 100번 쓰러뜨린다', hint: '쓰러진 이들의 그림자',
    stats: { spi: 14, mag: 10 },
    effects: [flag('soulThrall', '몬스터를 쓰러뜨리면 30% 확률로 그 영혼이 20초 동안 수하가 된다 (최대 3)')],
    skill: 'hSoulCall' },
  { id: 'seaWitch', title: '심해의 마녀', name: '가라앉은 숨', kind: 'taboo', color: '#5ac8ff',
    cond: '바닷속에서 숨이 막혀 50번 쓰러진다', hint: '바다가 삼킨 숨',
    stats: { spi: 12, mag: 12 },
    effects: [flag('deepBreath', '물속에서 숨이 줄지 않는다 (숨 무한)'), mul('magAtk', 1.08, '마법 공격력 +8%')],
    skill: 'hBubble' },
  { id: 'venomless', title: '만독불침', name: '독을 마신 몸', kind: 'taboo', color: '#9be15d',
    cond: '늪의 거인(20층)과 싸우는 동안 처음 독에 걸린 뒤 한 번도 독이 풀리지 않고, 독액 웅덩이 안에서 마무리한다', hint: '독이 풀리지 않는 싸움',
    stats: { vit: 14, toxicity: 12 },
    effects: [flag('venomImmune', '독에 걸리지 않는다'), flag('oozeHeal', '독액 · 독구름 위에 서 있으면 초당 체력 2% 회복')],
    skill: 'hVenomBreath' },
  { id: 'bloodBlade', title: '혈귀', name: '피를 먹는 칼날', kind: 'taboo', color: '#ff3a4a',
    cond: '「피를 먹는 칼」을 들고 층의 주인 셋을 쓰러뜨린다 (칼이 깨어나 체력을 먹지 않는다)', hint: '피를 먹는 칼',
    stats: { str: 14, vit: 8, lifesteal: 20 },
    effects: [mul('physAtk', 1.08, '물리 공격력 +8%')],
    skill: 'hBloodFeast' },
  // ── 숨은 스승: 40층의 주인을 쓰러뜨린 무기 갈래의 스승이 탑 문 앞 「스승의 방」에 나타난다. 딜로는 이길 수 없고 그 무기를 이해해야 이긴다 ──
  { id: 'swordSaint', title: '검성', name: '칼집 속의 번개', kind: 'teacher', fam: 'sword', color: '#e8f0ff',
    cond: '「스승의 방」에서 「발도」를 쓰는 노검객을 쓰러뜨린다 (휘두른 뒤의 빈틈만 제대로 들어간다)', hint: '칼이 빈 순간',
    stats: { str: 14, sen: 12 },
    effects: [add('crit', 0.1, '치명타 +10%'), add('critDmg', 0.4, '치명타 피해 +40%')],
    skill: 'hIaido' },
  { id: 'warchief', title: '대족장', name: '피로 쓴 함성', kind: 'teacher', fam: 'heavy', color: '#ff7a5a',
    cond: '「스승의 방」에서 「피로 쓴 함성」을 쓰는 피 묻은 사슬의 챔피언을 쓰러뜨린다 (몰아쳐 막기를 부순 뒤에만 들어간다)', hint: '부서진 방패',
    stats: { str: 14, vit: 12 },
    effects: [flag('payback', '스킬을 쓰면 최근 8초 동안 받은 피해(최대 체력의 60%까지)를 둘레로 터뜨린다')],
    skill: 'hChiefCall' },
  { id: 'archmage', title: '대마도사', name: '끝없는 주문', kind: 'teacher', fam: 'magic', color: '#b58aff',
    cond: '「스승의 방」에서 「마력 폭주」를 쓰는 봉인된 대마법사를 쓰러뜨린다 (주문을 외는 동안 마법으로만)', hint: '외는 동안',
    stats: { mag: 16, spi: 10 },
    effects: [mul('magAtk', 1.1, '마법 공격력 +10%')],
    skill: 'hManaSurge' },
  { id: 'lich', title: '리치', name: '죽음을 거부한 심장', kind: 'teacher', fam: 'scythe', color: '#c45cff',
    cond: '「스승의 방」에서 죽음을 거부하는 첫 번째 망자를 쓰러뜨린다 (한 번에 둘 이상을 베어야 한다)', hint: '셋으로 갈라진 망자',
    stats: { spi: 12, vit: 12, mag: 6 },
    effects: [flag('lichRise', '쓰러지면 체력 1로 일어나 3초 무적 · 10초 동안 공격력 2배 (탑은 한 등반에 한 번 · 바깥은 나갈 때마다 한 번)')],
    skill: 'hReaper' },
  { id: 'shadowKing', title: '그림자 왕', name: '그림자를 쥔 손', kind: 'teacher', fam: 'dagger', color: '#8a6aff',
    cond: '「스승의 방」에서 「그림자 손」을 쓰는 얼굴 없는 자를 쓰러뜨린다 (분신 가운데 진짜만)', hint: '그림자가 진한 쪽',
    stats: { agi: 14, sen: 12 },
    effects: [add('dodge', 0.08, '회피 +8%')],
    skill: 'hShadowHands' },
  { id: 'skyBow', title: '천궁', name: '하늘을 겨눈 시위', kind: 'teacher', fam: 'bow', color: '#fff0a0',
    cond: '「스승의 방」에서 「천궁의 화살비」를 쓰는 노궁수를 쓰러뜨린다 (멀리서 쏜 것만)', hint: '멀리서 쏜 화살',
    stats: { agi: 12, sen: 14 },
    effects: [flag('ricochet', '평타 화살이 맞으면 가까운 다른 적에게 두 번까지 튕긴다 (튕길 때마다 피해 70%)')],
    skill: 'hLightRain' },
  { id: 'primal', title: '원시의 왕', name: '태고의 송곳니', kind: 'teacher', fam: 'fist', color: '#9be15d',
    cond: '「스승의 방」에서 「원시의 돌진」을 쓰는 태고의 포식자를 쓰러뜨린다 (끊기지 않는 연타만)', hint: '끊기지 않는 주먹',
    stats: { str: 12, agi: 12, vit: 6 },
    effects: [add('knockback', 60, '넉백 +60'), mul('moveSpeed', 1.1, '이동 속도 +10%')],
    skill: 'hRam' },
  { id: 'elderDragon', title: '고룡', name: '잠든 용의 비늘', kind: 'teacher', fam: 'spear', color: '#ff8a3a',
    cond: '「스승의 방」에서 「용암 균열」을 쓰는 잠든 고룡을 쓰러뜨린다 (창끝이 닿는 거리에서만)', hint: '창끝의 거리',
    stats: { str: 12, vit: 12, pres: 6 },
    effects: [flag('burnSpread', '화상 걸린 적이 쓰러지면 둘레 적에게 화상 2중첩이 옮는다'), mul('burnMul', 1.25, '화상 피해 +25%')],
    skill: 'hLavaRift' },
  // ── 나의 그림자 ──
  { id: 'doppel', title: '도플갱어', name: '나를 이긴 나', kind: 'doppel', color: '#a8a0c8',
    cond: '30층 이상의 주인을 쓰러뜨린 뒤 드물게 나타나는 「나의 그림자」를 쓰러뜨린다', hint: '거울 너머의 나',
    stats: { agi: 10, sen: 10, str: 6 },
    effects: [add('crit', 0.08, '치명타 +8%')],
    skill: 'hDoppel' },
  // ── 전설 몬스터: 조건이 겹칠 때만 나오고, 한 번 잡으면 다시 나오지 않는다 ──
  { id: 'frostSteed', title: '서리 기수', name: '서리 백마의 갈기', kind: 'legend', color: '#cfefff',
    cond: '서리 설원에서 새벽(4~6시)에 1분 동안 움직이지 않으면 다가오는 서리 백마를 쓰러뜨린다', hint: '새벽 눈밭의 고요',
    stats: { agi: 12, vit: 8, mres: 6 },
    effects: [mul('chillMul', 1.25, '냉기 효과 +25%'), mul('moveSpeed', 1.1, '이동 속도 +10%')],
    skill: 'hFrostCharge' },
  { id: 'bellWraith', title: '종지기', name: '자정의 종', kind: 'legend', color: '#c8a8ff',
    cond: '그림자 묘지에서 자정부터 한 시간(게임 시간) 동안만 보이는 종지기 망령을 쓰러뜨린다', hint: '자정의 종소리',
    stats: { spi: 12, mag: 8, mres: 8 },
    effects: [mul('statusDmgMul', 1.15, '상태이상 피해 +15%')],
    skill: 'hDeathBell' },
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
  // ── 금기 ──
  hSoulCall: { name: '영혼 소집', role: '소환', cd: 18, scale: 'phys', fx: 'buff', mo: 'cast', hidden: true,
    desc: '최근에 쓰러뜨린 몬스터 셋의 영혼을 20초 동안 부른다 (공격력 90%). 쓰러뜨린 몬스터가 없으면 해골 셋.',
    do: [{ op: 'soulCall', n: 3, dur: 20, mul: 0.9 }] },
  hBubble: { name: '물풍선', role: '제어', cd: 12, scale: 'mag', fx: 'splash', mo: 'cast', aim: 'tank', hidden: true,
    desc: '한 적을 물풍선에 가둔다. 3초 동안 움직이지 못하고(보스 1초) 초당 최대 체력 4%(보스는 1%)를 익사 피해로 잃는다.',
    do: [{ op: 'bubble', range: 170, dur: 3, bossDur: 1, pct: 0.04, bossPct: 0.01 }] },
  hVenomBreath: { name: '독룡의 숨', role: '공격', cd: 9, scale: 'mag', elem: 'poison', fx: 'fog', mo: 'roar', hidden: true,
    desc: '앞쪽으로 독안개를 길게 뿜는다. 공격력 260% · 독 4중첩.',
    do: [{ op: 'cone', range: 96, angle: 1.0, mul: 2.6, stacks: 4, fx: 'fog' }] },
  hBloodFeast: { name: '피의 축제', role: '공격', cd: 10, scale: 'phys', fx: 'doom', mo: 'roar', hidden: true,
    desc: '둘레 적의 피를 빨아들인다. 공격력 240% · 맞은 적마다 체력 4% 회복.',
    do: [{ op: 'aoe', at: 'self', r: 90, mul: 2.4, healPerHit: 0.04, fx: 'doom' }] },
  // ── 숨은 스승 ──
  hIaido: { name: '발도', role: '마무리', cd: 10, scale: 'phys', fx: 'skyfall', mo: 'dashSlash', aim: 'cluster', hidden: true,
    desc: '칼집에 손을 얹고 0.3초 숨을 고른 뒤, 앞으로 뻗는 한 칼. 일직선의 적 모두에게 공격력 400%.',
    do: [{ op: 'line', len: 200, w: 30, mul: 4.0, delay: 0.3, fx: 'skyfall' }] },
  hChiefCall: { name: '대족장의 외침', role: '방어', cd: 14, scale: 'phys', fx: 'roar', mo: 'roar', hidden: true,
    desc: '둘레 적이 6초 동안 나만 노리고, 5초 동안 받는 피해 -30%. (「피로 쓴 함성」으로 받은 피해를 모아 다음 스킬에 터뜨리기 좋다)',
    do: [{ op: 'provoke', r: 130, dur: 6 }, { op: 'buff', id: 'hChief', dur: 5, mods: { dmgTakenMul: 0.7 }, color: '#ff7a5a', bubble: true }] },
  hManaSurge: { name: '마력 폭주', role: '강화', cd: 30, scale: 'mag', fx: 'buff', mo: 'castBig', hidden: true,
    desc: '8초 동안 모든 마법 스킬을 쿨타임 없이 쓴다. 마법 하나를 쓰면 0.5초 뒤에 다음 마법.',
    do: [{ op: 'buff', id: 'hSurge', dur: 8, mods: {}, color: '#b58aff' }] },
  hReaper: { name: '망자의 낫', role: '공격', cd: 8, scale: 'phys', fx: 'sweep', mo: 'spin', hidden: true,
    desc: '앞쪽을 크게 베어 낸다. 공격력 280% · 맞은 적마다 체력 3% 회복.',
    do: [{ op: 'cone', range: 72, angle: 2.6, mul: 2.8, healPerHit: 0.03, fx: 'sweep' }] },
  hShadowHands: { name: '그림자 손', role: '제어', cd: 14, scale: 'phys', fx: 'doom', mo: 'cast', hidden: true,
    desc: '몸에서 그림자가 뻗어 둘레 적 다섯까지 끌고 온다. 남은 체력이 내 체력보다 낮은 적은 그 자리에서 쓰러지고, 보스는 공격력 500% 피해.',
    do: [{ op: 'shadowHands', r: 170, n: 5, bossMul: 5 }] },
  hLightRain: { name: '천궁의 화살비', role: '공격', cd: 9, scale: 'phys', fx: 'lightRain', mo: 'aim', aim: 'cluster', hidden: true,
    desc: '하늘로 쏜 화살이 빛줄기가 되어 조준한 곳에 네 번 쏟아진다 (한 번에 공격력 150%).',
    do: [0.3, 0.5, 0.7, 0.9].map((d) => ({ op: 'aoe', at: 'aim', r: 72, mul: 1.5, fx: 'lightRain', delay: d })) },
  hRam: { name: '원시의 돌진', role: '이동', cd: 9, scale: 'phys', fx: 'dash', mo: 'charge', aim: 'tank', hidden: true,
    desc: '앞으로 들이받아 처음 부딪힌 적을 밀고 간다. 벽에 박으면 공격력 450% · 1.5초 기절, 아니면 공격력 180%.',
    do: [{ op: 'ram', dist: 170, mul: 1.8, wallMul: 4.5, stun: 1.5 }] },
  hLavaRift: { name: '용암 균열', role: '공격', cd: 10, scale: 'phys', elem: 'fire', fx: 'quake', mo: 'stomp', hidden: true,
    desc: '창을 땅에 꽂아 앞으로 땅을 가른다. 일직선 공격력 260% · 화상 2중첩, 갈라진 자리는 3초 동안 용암.',
    do: [{ op: 'line', len: 190, w: 30, mul: 2.6, stacks: 2, fx: 'quake', lava: 3 }] },
  // ── 나의 그림자 · 전설 ──
  hDoppel: { name: '분신', role: '소환', cd: 16, scale: 'phys', fx: 'blink', mo: 'cast', hidden: true,
    desc: '8초 동안 나를 따라 싸우는 그림자 분신을 둘 부른다 (공격력 50%).',
    do: [{ op: 'summon', kind: 'clone', n: 2, dur: 8, mul: 0.5 }] },
  hFrostCharge: { name: '서리 돌진', role: '이동', cd: 8, scale: 'phys', elem: 'ice', fx: 'dash', mo: 'charge', aim: 'crowd', hidden: true,
    desc: '백마처럼 내달려 길 위의 적에게 공격력 220% · 냉기 3중첩, 지나간 길은 3초 동안 얼어붙는다.',
    do: [{ op: 'dash', dist: 170, mul: 2.2, stacks: 3, iceTrail: true }] },
  hDeathBell: { name: '죽음의 종', role: '제어', cd: 14, scale: 'mag', fx: 'doom', mo: 'roar', hidden: true,
    desc: '자정의 종을 울린다. 둘레 적에게 공격력 120% 피해, 8초 동안 받는 피해 +30%.',
    do: [{ op: 'aoe', at: 'self', r: 110, mul: 1.2, weak: 8, weakK: 1.3, fx: 'doom' }] },
};

// 숨은 스승: 무기 갈래 → 스승 (sim/teacher.js)
export const TEACHERS = {
  sword: { id: 'swordSaint', name: '노검객', mon: 'tchSword', hint: '「칼은 휘두른 뒤에 빈다.」', rule: '휘두른 뒤의 빈틈(하얗게 빛날 때)에 벤 것만 제대로 들어간다' },
  heavy: { id: 'warchief', name: '피 묻은 사슬의 챔피언', mon: 'tchHeavy', hint: '「내 방패를 부숴 봐라. 쉬지 말고.」', rule: '2.5초 안에 세 번 몰아쳐 막기를 부수면 2초 동안 제대로 들어간다 · 그동안 받은 만큼 「피로 쓴 함성」이 세진다' },
  magic: { id: 'archmage', name: '봉인된 대마법사', mon: 'tchMagic', hint: '「주문을 외는 자는 무방비다.」', rule: '주문을 외는 동안의 마법 피해만 제대로 들어간다' },
  scythe: { id: 'lich', name: '첫 번째 망자', mon: 'tchScythe', hint: '「나는 셋이다. 하나씩은 베지 못한다.」', rule: '한 번의 공격 · 스킬로 망자 둘 이상을 맞혀야 제대로 들어간다 · 한 번은 죽음을 거부한다' },
  dagger: { id: 'shadowKing', name: '얼굴 없는 자', mon: 'tchDagger', hint: '「그림자가 진한 것이 나다.」', rule: '분신 다섯 가운데 진짜(흐리지 않은 것)만 · 가짜를 베면 반격' },
  bow: { id: 'skyBow', name: '노궁수', mon: 'tchBow', hint: '「멀리서 쏘아라. 가까이 온 화살은 화살이 아니다.」', rule: '90 넘는 거리에서 쏜 것만 제대로 들어간다' },
  fist: { id: 'primal', name: '태고의 포식자', mon: 'tchFist', hint: '「끊기면 처음부터다.」', rule: '0.6초 안에 이어지는 연타의 세 번째부터 제대로 들어간다' },
  spear: { id: 'elderDragon', name: '잠든 고룡', mon: 'tchSpear', hint: '「내 발톱이 닿는 곳에선 아무것도 닿지 않는다.」', rule: '창끝(무기 사거리의 70% 너머)에서 찌른 것만 제대로 들어간다' },
};
export const HIDDEN_COUNTS = { npcDown: [100, 'necro'], drown: [50, 'seaWitch'], bloodLords: [3, 'bloodBlade'] }; // 일부러 쌓는 것

// 시련 · 그림자 · 전설 몬스터 (도감에 넣지 않는다: DUMMIES 에 붙인다)
const T = (name, extra) => ({ name, shape: 'humanoid', hp: 1e9, atk: 20, type: 'phys', speed: 0, ai: 'trial', r: 7, xp: 0, gold: 0, pres: 0, mres: 0, echo: { id: 'goo', rate: 0 }, trial: true, ...extra }); // ai 'trial': 움직임은 sim/teacher.js 가 맡는다
export const HIDDEN_MONSTERS = {
  tchSword: T('노검객', { pal: { a: '#c8ccd8' } }), tchHeavy: T('피 묻은 사슬의 챔피언', { pal: { a: '#a83a2a' }, r: 8 }),
  tchMagic: T('봉인된 대마법사', { pal: { a: '#8a6ad8' } }), tchScythe: T('첫 번째 망자', { pal: { a: '#c45cff' } }),
  tchDagger: T('얼굴 없는 자', { pal: { a: '#3a2e48' } }), tchBow: T('노궁수', { pal: { a: '#5a8a4a' } }),
  tchTarget: T('움직이는 과녁', { ai: 'target', shape: 'dummy', pal: { a: '#c8a070', b: '#6a4a2a', c: '#f0e0b0', e: '#2a1a0a' } }),
  tchFist: T('태고의 포식자', { pal: { a: '#6a9a3a' }, r: 8 }), tchSpear: T('잠든 고룡', { pal: { a: '#d8501a' }, r: 8 }),
  myShadow: { name: '나의 그림자', shape: 'humanoid', ghost: true, pal: { a: '#3a2e48' }, hp: 600, atk: 34, type: 'phys', speed: 78, ai: 'chase', raceLook: true, moves: ['combo', 'leap', 'combo'], r: 6, xp: 0, gold: 0, pres: 60, mres: 60, echo: { id: 'goo', rate: 0 }, elite: true },
  frostSteed: { name: '서리 백마', shape: 'quad', pal: { a: '#e8f4ff', b: '#9fc8e8', c: '#ffffff', e: '#3ab0ff' }, hp: 1600, atk: 30, type: 'phys', speed: 110, ai: 'chase', status: 'chill', moves: ['charge', 'stomp'], r: 9, xp: 0, gold: 200, pres: 60, mres: 60, echo: { id: 'goo', rate: 0 }, elite: true },
  bellWraith: { name: '종지기 망령', shape: 'flyer', ghost: true, pal: { a: '#c8a8ff', b: '#6a4a9a', c: '#ffffff', e: '#ffe066' }, hp: 1500, atk: 30, type: 'mag', speed: 60, ai: 'ranged', range: 140, proj: { speed: 150, color: '#c8a8ff', status: 'curse' }, moves: ['spiral', 'retreat'], r: 8, xp: 0, gold: 200, pres: 40, mres: 80, echo: { id: 'goo', rate: 0 }, elite: true },
};
export const HIDDEN_ART = {
  // 스승: 플레이어와 같은 종족 캐릭터 그림 (RACE_ART) + 종족 상징색 외곽선 · 무기 갈래마다 크기와 명암을 조금씩 (sim/teacher.js teacherLook)
  tchSword: { teacherLook: true }, tchHeavy: { teacherLook: true }, tchMagic: { teacherLook: true }, tchScythe: { teacherLook: true },
  tchDagger: { teacherLook: true }, tchBow: { teacherLook: true }, tchFist: { teacherLook: true }, tchSpear: { teacherLook: true },
  myShadow: { raceLook: true, ghost: true, tint: 'brightness(0.35) saturate(0.4) hue-rotate(220deg)' },
  frostSteed: { base: 'c_horse', tint: 'grayscale(0.7) brightness(1.55) hue-rotate(170deg) saturate(1.4)', scale: 1.3 },
  bellWraith: { beast: 'ghost', ghost: true, fly: true, tint: 'hue-rotate(40deg) saturate(1.6) brightness(1.2)', scale: 1.4 },
};

// 데이터 등록 (다른 표에 붙인다)
export function registerHiddenEngravings(ENGRAVINGS) {
  for (const h of HIDDEN) ENGRAVINGS[hiddenEngId(h.id)] = { name: h.name, slot: 'heart', grade: 5, load: 10, hidden: h.id, weapons: h.weapons || 'all', tags: [], stats: h.stats, effects: h.effects, recipe: { [hiddenEcho(h.id)]: 1 } };
}
export function registerHiddenSkills(SKILLS, ENGRAVING_SKILLS) {
  Object.assign(SKILLS, HIDDEN_SKILLS);
  for (const h of HIDDEN) ENGRAVING_SKILLS[hiddenEngId(h.id)] = h.skill;
}
export function registerHiddenMonsters(DUMMIES) { Object.assign(DUMMIES, HIDDEN_MONSTERS); }
export function registerHiddenEchoes(ECHOES) {
  for (const h of HIDDEN) ECHOES[hiddenEcho(h.id)] = { name: `${h.title}의 증표`, color: h.color, rare: true, hidden: h.id };
}

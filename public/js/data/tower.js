// 각인의 탑 100층: 층마다 짧은 던전 하나. 계단에 닿으면 클리어 → 시간 · 받은 피해로 등급(S·A·B·C)과 보상.
// 5층마다 층 수호자(보스)를 쓰러뜨려야 계단이 열린다. 몬스터는 층마다 복리로 강해져서 마지막 층은 거의 깨지 못한다.
// (예전의 층(이끼 동굴 · 독늪 · …)은 지우지 않고 보류 — 탑 문에서는 더 이상 들어가지 않는다)
export const TOWER_TOP = 100;
// 10층마다 풍경이 바뀐다: 옛 층의 땅 · 몬스터를 빌려 쓴다
export const TOWER_THEME = ['cave', 'swamp', 'rift', 'frost', 'grave'];
export const towerZoneId = (f) => TOWER_THEME[Math.floor((f - 1) / 10) % TOWER_THEME.length]; // 100층: 다섯 풍경을 두 번 돈다
export const towerMul = (f) => ({ hp: 1 + 0.07 * (f - 1), atk: 1 + 0.06 * (f - 1) }); // 100층: 체력 약 8배 · 공격 약 7배 (나머지는 층에 맞춰 떨어지는 무기로 따라간다)
export const isBossFloor = (f) => f % 5 === 0;
// 짧은 층: 작은 동굴 (층이 오를수록 조금씩 넓어진다)
export const towerSize = (f) => ({ tw: 60 + Math.min(18, Math.floor(f / 2)), th: 40 + Math.min(12, Math.floor(f / 4)) });
export const parTime = (f) => 60 + f * 2 + (isBossFloor(f) ? 45 : 0);
// 등급: 빠르고(기준 시간) 덜 맞을수록(받은 피해 / 최대 체력) 높다
export function towerGrade({ time, hurt, maxHp, f }) {
  const par = parTime(f), hp = hurt / Math.max(1, maxHp);
  const ts = time <= par * 0.6 ? 3 : time <= par ? 2 : time <= par * 1.7 ? 1 : 0;
  const hs = hp <= 0.15 ? 3 : hp <= 0.5 ? 2 : hp <= 1.2 ? 1 : 0;
  const s = ts + hs;
  return s >= 6 ? 'S' : s >= 4 ? 'A' : s >= 2 ? 'B' : 'C';
}
export const GRADES = ['C', 'B', 'A', 'S'];
// 다시 시작할 수 있는 층: 1층, 그리고 지금까지 오른 층까지의 5층 단위 다음 층 (6 · 11 · 16 …)
export const towerStarts = (maxCleared = 0) => [1, ...Array.from({ length: Math.floor(maxCleared / 5) }, (_, i) => (i + 1) * 5 + 1)].filter((f) => f <= TOWER_TOP);
// 층 수호자: 5층마다 다른 수호자. 수호자마다 대처법이 분명한 대표 기술이 있다 (55층부터는 같은 수호자가 각성해서 더 자주 · 더 많이 쓴다)
// phases: 체력 100~66% · 66~33% · 33% 아래에서 고르는 기술. names: 기술을 쓸 때 머리 위에 뜨는 이름
export const BOSS_KITS = [
  { title: '돌진의 수호자', hint: '돌진을 벽으로 유도하면 부딪혀 기절한다', wallStun: true,
    phases: [['charge', 'combo'], ['charge', 'combo', 'adds'], ['charge', 'charge', 'adds', 'quake']],
    names: { charge: '들이받기', combo: '난도질', adds: '부하 호출', quake: '땅 구르기' } },
  { title: '늪의 마녀', hint: '회복 의식은 세게 때려서 끊을 수 있다',
    phases: [['pool', 'spiral', 'channel'], ['pool', 'rain', 'channel'], ['rain', 'spiral', 'channel', 'pool']],
    names: { pool: '독 웅덩이', spiral: '독 소용돌이', channel: '늪의 회복 의식', rain: '독비' } },
  { title: '불꽃 거인', hint: '기술을 몇 번 쓰면 과열되어 핵이 드러난다 (피해 2배)', vent: 3,
    phases: [['fan', 'quake'], ['fan', 'quake', 'nova'], ['fan', 'nova', 'quake', 'charge']],
    names: { fan: '화염 숨', quake: '용암 내려치기', nova: '열 폭발', charge: '불꽃 돌진' } },
  { title: '서리 여왕', hint: '얼음 고리는 바깥이 위험하다. 여왕 가까이 붙어라',
    phases: [['donut', 'spiral'], ['donut', 'mark', 'spiral'], ['donut', 'mark', 'split', 'donut']],
    names: { donut: '서리 고리', spiral: '눈보라', mark: '얼음 표식', split: '빙창' } },
  { title: '망령 기사', hint: '분신은 금방 부서진다. 맞았을 때 버티는 쪽이 진짜', blinkInv: 0,
    phases: [['combo', 'leap', 'clones'], ['combo', 'clones', 'blink'], ['clones', 'leap', 'combo', 'blink']],
    names: { combo: '망령 베기', leap: '그림자 도약', clones: '분신', blink: '그림자 걸음' } },
  { title: '균열 감시자', hint: '회전 광선은 도는 방향으로 같이 돌아라',
    phases: [['beam', 'split'], ['sweep', 'beam', 'blink'], ['sweep', 'split', 'beam', 'sweep']],
    names: { beam: '감시 광선', split: '균열 탄', sweep: '회전 광선', blink: '차원 이동' } },
  { title: '하늘의 포식자', hint: '날아오르면 맞지 않는다. 떨어지는 자리를 피해라',
    phases: [['fan', 'charge'], ['fan', 'soar', 'charge'], ['soar', 'fan', 'rain', 'charge']],
    names: { fan: '불꽃 숨결', charge: '활강 돌격', soar: '비상', rain: '불비' } },
  { title: '미궁의 군주', hint: '반사 방패가 빛나는 동안 때리면 내가 다친다',
    phases: [['whirl', 'shove', 'mirror'], ['whirl', 'leap', 'mirror'], ['mirror', 'whirl', 'leap', 'quake']],
    names: { whirl: '회전 베기', shove: '방패 밀치기', mirror: '반사 방패', leap: '내려찍기', quake: '미궁 흔들기' } },
  { title: '죽음의 사제', hint: '의식이 끝나기 전에 제물을 모두 쓰러뜨려라',
    phases: [['spiral', 'nova', 'ritual'], ['spiral', 'ritual', 'blink'], ['ritual', 'nova', 'spiral', 'blink']],
    names: { spiral: '영혼 소용돌이', nova: '죽음의 파동', ritual: '제물 의식', blink: '망자의 걸음' } },
  { title: '탑의 주인', hint: '지금까지의 수호자가 쓰던 기술을 모두 쓴다', wallStun: true, vent: 5,
    phases: [['charge', 'donut', 'beam', 'channel'], ['sweep', 'clones', 'mirror', 'donut'], ['ritual', 'soar', 'sweep', 'donut', 'charge']],
    names: { charge: '주인의 돌진', donut: '심판의 고리', beam: '탑의 시선', channel: '탑의 숨결', sweep: '천벌 광선', clones: '거울 그림자', mirror: '반사의 율법', ritual: '마지막 의식', soar: '승천' } },
];
export const bossKit = (f) => ({ ...BOSS_KITS[(Math.floor(f / 5) - 1) % BOSS_KITS.length], awake: f > 50, final: f === TOWER_TOP });
// 등반의 수호자 · 주인: 원래 기술에 대표 기술 하나씩을 더한다 (단계마다 더할 기술). 55층부터는 같은 보스가 각성해서 돌아온다
export const CLIMB_SIGS = {
  climbChief: { wallStun: true, add: [['charge'], ['charge', 'jumps3'], ['charge', 'jumps3']], names: { jumps3: '족장의 세 번 뛰기' }, hint: '돌격을 벽으로 유도하면 부딪혀 기절한다',
    passives: ['hunt', 'frenzy'], phase2: { text: '족장이 가면을 벗었다', atk: 1.3, speed: 1.15, add: ['jumps3'] }, phase3: { text: '족장이 피를 뒤집어썼다', atk: 1.2, speed: 1.15, passives: ['burnAura'], add: ['charge'] }, looks: ['saturate(1.6) hue-rotate(-15deg) brightness(1.1)', 'saturate(2.2) hue-rotate(-35deg) brightness(0.85) contrast(1.3)'] },
  mossLord: { add: [['channel'], ['channel', 'spikeTrail'], ['channel', 'spikeTrail']], names: { channel: '뿌리 흡수', spikeTrail: '뿌리 가시 길' }, hint: '뿌리로 회복할 때 세게 때려 끊어라',
    passives: ['pull', 'regrow', 'summonTimer'], phase2: { text: '이끼가 온몸을 덮었다', atk: 1.2, passives: ['shieldPulse'], add: ['spikeTrail'] }, phase3: { text: '고목이 썩어 무너진다', atk: 1.2, speed: 1.2, passives: ['poisonAura'], add: ['ripple'] }, looks: ['hue-rotate(40deg) saturate(1.8) brightness(1.05)', 'hue-rotate(60deg) saturate(1.4) brightness(0.6) contrast(1.4)'] },
  bogHag: { add: [['clones'], ['clones', 'ripple'], ['clones', 'ripple']], names: { clones: '환영 분신', ripple: '저주의 파문' }, hint: '분신은 금방 부서진다. 버티는 쪽이 진짜',
    passives: ['ward', 'curseMark'], phase2: { text: '마녀가 진짜 모습을 드러냈다', atk: 1.25, speed: 1.2, add: ['ripple', 'meteorRain'] }, phase3: { text: '마녀가 늪과 하나가 되었다', atk: 1.2, passives: ['poisonAura'], add: ['clones'] }, looks: ['hue-rotate(250deg) saturate(1.8) brightness(1.1)', 'hue-rotate(270deg) saturate(2) brightness(0.6) contrast(1.5)'] },
  climbQueen: { add: [['meteorRain'], ['ritual', 'meteorRain'], ['ritual', 'meteorRain']], names: { ritual: '늪의 제물', meteorRain: '독덩이 비' }, hint: '제물을 모두 쓰러뜨리면 거인이 무너진다',
    passives: ['pull', 'poisonAura'], phase2: { text: '늪이 넘쳐흐른다', atk: 1.2, speed: 1.2, add: ['ripple'] }, phase3: { text: '거인이 독을 토해 낸다', atk: 1.25, speed: 1.15, passives: ['frenzy'], add: ['meteorRain'] }, looks: ['hue-rotate(30deg) saturate(2.2) brightness(1.15)', 'hue-rotate(70deg) saturate(2.6) brightness(0.75) contrast(1.4)'] },
  demonCaptain: { add: [['mirror'], ['mirror', 'cleave'], ['mirror', 'cleave', 'grab']], names: { mirror: '반사 방패', cleave: '악귀의 대베기', grab: '쇠사슬 끌어당기기' }, hint: '방패가 빛나는 동안 때리면 내가 다친다',
    passives: ['ward', 'thorns'], phase2: { text: '방패가 불타오른다', atk: 1.3, passives: ['burnAura'], add: ['cleave'] }, phase3: { text: '악귀 대장이 방패를 내던졌다', atk: 1.3, speed: 1.25, passives: ['frenzy'], add: ['jumps3'] }, looks: ['sepia(0.6) saturate(2.4) hue-rotate(-20deg) brightness(1.1)', 'saturate(3) hue-rotate(-40deg) brightness(0.7) contrast(1.5)'] },
  climbRift: { add: [['sweep'], ['sweep', 'crossBeam'], ['sweep', 'crossBeam']], names: { sweep: '회전 균열 광선', crossBeam: '십자 균열' }, hint: '도는 광선은 같은 방향으로 돌며 피해라',
    passives: ['hunt', 'shieldPulse'], phase2: { text: '균열이 넓어졌다', atk: 1.25, add: ['crossBeam', 'meteorRain'] }, phase3: { text: '균열이 수호자를 집어삼킨다', atk: 1.25, speed: 1.15, passives: ['curseMark'], add: ['ripple'] }, looks: ['hue-rotate(220deg) saturate(2) brightness(1.2)', 'hue-rotate(250deg) saturate(2.4) brightness(0.55) contrast(1.6)'] },
  frostOgre: { vent: 3, ventText: '숨이 찼다! 약점이 드러났다', add: [['grab'], ['jumps3', 'grab'], ['jumps3', 'grab']], names: { grab: '얼음 손아귀', jumps3: '눈사태 뜀' }, hint: '기술을 몇 번 쓰면 숨을 고른다 (피해 2배)',
    passives: ['hunt', 'frostAura'], phase2: { text: '오우거가 분노했다', atk: 1.35, speed: 1.2, add: ['jumps3'] }, phase3: { text: '오우거가 얼음 갑옷을 깨뜨렸다', atk: 1.3, speed: 1.25, passives: ['frenzy'], add: ['cleave'] }, looks: ['hue-rotate(170deg) saturate(1.8) brightness(1.2)', 'hue-rotate(190deg) saturate(2.4) brightness(0.65) contrast(1.4)'] },
  climbWitch: { add: [['donut'], ['donut', 'ripple'], ['donut', 'ripple', 'meteorRain']], names: { donut: '서리 고리', ripple: '서리 파문', meteorRain: '우박' }, hint: '서리 고리는 바깥이 위험하다. 마녀 곁으로',
    passives: ['ward', 'frostAura', 'curseMark'], phase2: { text: '눈보라가 몰아친다', atk: 1.25, add: ['meteorRain', 'crossBeam'] }, phase3: { text: '마녀가 눈보라가 되었다', atk: 1.25, speed: 1.2, passives: ['shieldPulse'], add: ['donut'] }, looks: ['hue-rotate(160deg) saturate(1.4) brightness(1.4)', 'grayscale(0.5) brightness(1.7) contrast(1.2)'] },
  wraithLord: { add: [['spikeTrail'], ['soar', 'spikeTrail'], ['soar', 'cleave']], names: { soar: '혼령화', spikeTrail: '망령의 길', cleave: '사형 집행' }, hint: '혼령이 되면 맞지 않는다. 떨어지는 자리를 피해라',
    passives: ['pull', 'frenzy', 'deathRattle'], phase2: { text: '망령 기사단이 깨어났다', atk: 1.25, passives: ['summonTimer'], add: ['cleave'] }, phase3: { text: '기사단장의 혼이 풀려났다', atk: 1.3, speed: 1.2, passives: ['curseMark'], add: ['soar'] }, looks: ['hue-rotate(200deg) saturate(1.6) brightness(1.2)', 'hue-rotate(260deg) saturate(2) brightness(0.5) contrast(1.6)'] },
  engraveKing: { wallStun: true, vent: 6, add: [['donut', 'channel', 'crossBeam'], ['sweep', 'clones', 'mirror', 'ripple'], ['ritual', 'soar', 'sweep', 'donut', 'meteorRain']],
    names: { donut: '심판의 고리', channel: '각인 흡수', sweep: '천벌 광선', clones: '거울 그림자', mirror: '반사의 율법', ritual: '마지막 의식', soar: '승천', crossBeam: '각인의 십자', ripple: '꺼져 가는 빛의 파문', meteorRain: '문양의 비', cleave: '왕의 대베기' },
    hint: '모든 수호자의 기술을 쓴다', passives: ['ward', 'shieldPulse', 'thorns', 'deathRattle'], phase2: { text: '각인이 불타오른다', atk: 1.3, speed: 1.15, passives: ['burnAura'], add: ['cleave', 'meteorRain'] }, phase3: { text: '왕이 마지막 각인을 새긴다', atk: 1.3, speed: 1.2, passives: ['frenzy', 'curseMark'], add: ['ripple', 'crossBeam'] }, looks: ['sepia(1) saturate(3.4) hue-rotate(-20deg) brightness(1.25)', 'sepia(1) saturate(2) hue-rotate(-50deg) brightness(0.55) contrast(1.6)'] },
};
// 51~100층 새 구역의 수호자 · 주인 (fresh: 처음부터 제 기술을 다 쓴다 · 각성 없음)
const NO_ADD = [[], [], []];
Object.assign(CLIMB_SIGS, {
  stormHarpy: { fresh: true, add: NO_ADD, names: { gust: '폭풍의 날갯짓', tornado: '회오리' }, hint: '깃털 폭풍은 빈 틈으로 · 내리꽂기는 세 번: 멈추지 마라 · 폭풍 길은 줄 사이로',
    passives: ['hunt', 'frenzy'], phase2: { text: '여왕이 폭풍을 부른다', atk: 1.2, speed: 1.15, add: ['galeLanes'] }, phase3: { text: '폭풍의 눈이 열렸다', atk: 1.25, speed: 1.15, passives: ['shieldPulse'], add: ['soar'] }, looks: ['hue-rotate(200deg) saturate(2.2) brightness(1.2) contrast(1.2)', 'hue-rotate(230deg) saturate(2.6) brightness(0.8) contrast(1.5)'] },
  skyWhale: { fresh: true, add: NO_ADD, names: { whalePass: '하늘 가르기', collapse: '구름 붕괴', gust: '고래의 숨' }, hint: '입 앞 부채꼴에서 옆으로 빠져라(빨려 든다) · 노래의 물결은 초록 줄(빈 틈)로 지나라 · 3단계엔 바닥 절반이 꺼진다',
    passives: ['pull', 'summonTimer'], phase2: { text: '아에로가 노래한다', atk: 1.2, passives: ['shieldPulse'], add: ['songWave'] }, phase3: { text: '구름 바다가 꺼져 간다', atk: 1.25, speed: 1.15, passives: ['frostAura'], add: ['collapse'] }, looks: ['hue-rotate(20deg) saturate(1.2) brightness(1.5)', 'hue-rotate(40deg) saturate(1.6) brightness(0.8) contrast(1.4)'] },
  mirrorSelf: { fresh: true, add: NO_ADD, names: {}, hint: '방패가 빛나면 때리지 마라 · 수정 검기는 첫 세 줄 사이 → 다음 두 줄 사이로 · 감옥은 초록 길로 나가라',
    passives: ['hunt', 'thorns'], phase2: { text: '수정이 갑옷을 덮는다', atk: 1.2, speed: 1.15, add: ['shardRing'] }, phase3: { text: '거울 기사가 수정 감옥을 세운다', atk: 1.3, speed: 1.2, passives: ['frenzy'], add: ['crystalCage'] }, looks: ['grayscale(0.6) brightness(1.3) contrast(1.5)', 'grayscale(0.2) hue-rotate(180deg) brightness(0.7) contrast(1.7)'] },
  shardQueen: { fresh: true, add: NO_ADD, names: { shardHide: '거울 숨바꼭질' }, hint: '얼음창은 한 줄 → X 두 줄 · 얼음 감옥은 초록 길로 · 거울 여섯 중 진짜를 때려라',
    passives: ['ward', 'curseMark'], phase2: { text: '바닥의 거울이 깨어난다', atk: 1.2, passives: ['shieldPulse'], add: ['iceCage'] }, phase3: { text: '여왕의 거울이 산산이 부서진다', atk: 1.25, speed: 1.2, passives: ['frenzy'], add: ['donut'] }, looks: ['grayscale(0.5) hue-rotate(190deg) saturate(1.6) brightness(1.5)', 'grayscale(0.3) hue-rotate(300deg) saturate(1.8) brightness(0.8) contrast(1.5)'] },
  foreman: { fresh: true, wallStun: true, vent: 4, ventText: '증기를 빼는 중! 약점이 드러났다', add: NO_ADD, names: { beltFlip: '컨베이어 역회전' }, hint: '바닥의 금빛 줄 사이 칸에 서라(관이 솟는다) · 벽의 관은 가로 → 세로 · 굴러다니는 톱니는 구르면 지나간다 · 돌진을 벽으로 유도하면 기절',
    passives: ['pull', 'burnAura'], phase2: { text: '거신이 증기 관을 연다', atk: 1.2, speed: 1.15, add: ['pipesWall'] }, phase3: { text: '보일러가 붉게 달아올랐다', atk: 1.3, speed: 1.2, passives: ['frenzy'], add: ['beltFlip'] }, looks: ['sepia(1) saturate(2.4) hue-rotate(-20deg) brightness(1.2)', 'sepia(1) saturate(3) hue-rotate(-40deg) brightness(0.75) contrast(1.5)'] },
  clockKeeper: { fresh: true, add: NO_ADD, names: {}, hint: '보라 숨결은 도는 쪽 반대로 돌아 뒤로 · 뼈 가시는 세 갈래 사이로 · 포효는 초록 줄(빈 틈)로',
    passives: ['hunt', 'curseMark'], phase2: { text: '뼈 용이 사슬을 끊는다', atk: 1.2, add: ['roarWave'] }, phase3: { text: '시계탑이 뼈 용의 숨결에 무너진다', atk: 1.25, speed: 1.2, passives: ['shieldPulse'], add: ['soar'] }, looks: ['sepia(1) saturate(1.6) brightness(1.5)', 'sepia(1) hue-rotate(180deg) saturate(1.4) brightness(0.8) contrast(1.4)'] },
  archivist: { fresh: true, add: NO_ADD, names: { shelfFall: '책장 쓰러뜨리기' }, hint: '금서는 따라오다 멈춰 터진다. 멈추면 떨어져라 · 봉인 마법진은 안쪽이 먼저, 바깥이 나중 · 책장 줄 사이로',
    passives: ['ward', 'summonTimer'], phase2: { text: '금서고의 문이 열렸다', atk: 1.2, passives: ['curseMark'], add: ['sealCircle'] }, phase3: { text: '대서고관이 서고를 무너뜨린다', atk: 1.25, speed: 1.2, passives: ['frenzy'], add: ['spiral'] }, looks: ['hue-rotate(240deg) saturate(1.8) brightness(1.3)', 'hue-rotate(280deg) saturate(2.2) brightness(0.7) contrast(1.5)'] },
  starReader: { fresh: true, add: NO_ADD, names: { constellation: '별자리 긋기' }, hint: '유성은 세 번 내 자리에 · 별의 문 광선은 나를 지나는 줄: 옆으로 · 별빛 다섯 줄은 줄 사이를 따라 돌아라',
    passives: ['pull', 'burnAura'], phase2: { text: '별을 읽는 자가 하늘을 펼친다', atk: 1.2, passives: ['shieldPulse'], add: ['starGate'] }, phase3: { text: '하늘의 별이 하나씩 꺼진다', atk: 1.3, speed: 1.15, passives: ['curseMark'], add: ['starSpin'], dark: 0.25 }, looks: ['hue-rotate(220deg) saturate(1.6) brightness(1.4)', 'hue-rotate(250deg) saturate(2) brightness(0.6) contrast(1.6)'] },
  highPriest: { fresh: true, add: NO_ADD, names: { douse: '빛 끄기' }, hint: '빛의 바퀴는 갔다가 돌아온다. 두 번 피하라 · 빛기둥은 줄지어 다가온다. 옆으로 · 꺼진 빛기둥을 다시 깨워라(G)',
    passives: ['ward', 'curseMark'], phase2: { text: '교단의 기도가 빛을 삼킨다', atk: 1.2, add: ['crossBeam'] }, phase3: { text: '대사제가 어둠 그 자체가 되었다', atk: 1.25, speed: 1.2, passives: ['deathRattle'], add: ['rain'] }, looks: ['saturate(2) hue-rotate(260deg) brightness(0.9) contrast(1.3)', 'brightness(0.4) saturate(2.4) hue-rotate(280deg) contrast(1.8)'] },
  lastKing: { fresh: true, wallStun: true, add: NO_ADD, names: { raceArt: '각인 빌리기', lightCore: '빛의 핵' }, hint: '푸른 불꽃 검기는 앞 → 뒤 반원: 왕 곁을 돌아라 · 빛의 원은 광선 뒤를 따라 돌아라 · 3단계 빛의 핵이 드러날 때 몰아쳐라',
    passives: ['hunt', 'shieldPulse', 'thorns'], phase2: { text: '왕이 8종족의 각인을 깨운다', atk: 1.25, speed: 1.1, passives: ['curseMark'], add: ['spinBeam'] }, phase3: { text: '꺼져 가는 빛의 핵이 드러났다', atk: 1.3, speed: 1.2, passives: ['frenzy', 'deathRattle'], add: ['lightCore'] }, looks: ['sepia(0.6) saturate(2.2) brightness(1.6) contrast(1.1)', 'sepia(1) saturate(3) hue-rotate(-15deg) brightness(1.2) contrast(1.6)'] },
});
// 보스 패시브: 이름 · 설명 (보스가 나올 때 보여 준다)
export const BOSS_PASSIVES = {
  frenzy: { name: '광분', text: '15초마다 공격 속도 +10%' },
  regrow: { name: '재생', text: '3초 동안 맞지 않으면 초당 체력 1% 회복' },
  summonTimer: { name: '무리', text: '18초마다 부하 둘을 부른다' },
  curseMark: { name: '저주의 표식', text: '12초마다 표식: 4초 동안 받는 피해 +30%' },
  poisonAura: { name: '독 기운', text: '5초마다 둘레가 맥동한다 (1.1초 예고 원 · 한두 걸음 물러나면 피한다) · 맞으면 피해와 중독' },
  frostAura: { name: '냉기', text: '5초마다 둘레가 맥동한다 (1.1초 예고 원 · 한두 걸음 물러나면 피한다) · 맞으면 피해와 냉기' },
  burnAura: { name: '불꽃 몸', text: '5초마다 둘레가 맥동한다 (1.1초 예고 원 · 한두 걸음 물러나면 피한다) · 맞으면 피해와 화상' },
  shieldPulse: { name: '보호막', text: '20초마다 최대 체력 12% 보호막' },
  thorns: { name: '가시 갑옷', text: '12초마다 3초 동안 가시를 세운다 · 그동안 때리면 피해의 15%가 되돌아온다 (거리 상관없이)' },
  deathRattle: { name: '최후의 발악', text: '쓰러지면 1.4초 뒤 둘레가 크게 터진다' },
  // 원거리를 압박하는 패시브 (보스마다 하나씩 · 근접만 손해 보지 않게)
  hunt: { name: '사냥 본능', text: '10초마다 가장 멀리 있는 사람에게 뛰어든다 (예고 원)' },
  pull: { name: '끌어당김', text: '12초마다 7칸 밖에 있으면 사슬로 끌어당긴다 (0.8초 예고선 · 구르면 끊긴다)' },
  ward: { name: '화살 막이', text: '15초마다 4초 동안 투사체 피해 -40%' },
};

// 1~50층 보스의 기술 이펙트: 보내 주신 그림에 맞춘 재질 [이펙트, 원소] (몸 둘레 고리 대신)
// slam 내려찍기 · 도약 착지 · 땅 찍기 · nova 둘레 폭발 · rain 떨어지는 장판 · mark 표식 · pool 장판 · fall 하늘에서 떨어지는 것 · trail 가시 길 · donut 바깥 고리 · beam 광선 빛깔
const FX = (slam, nova, rain, mark, pool, fall, trail, donut, beam) => ({ slam, nova, rain, mark, pool, fall, trail, donut, beam });
export const BOSS_FX = {
  climbChief: FX(['quake', 'phys'], ['quake', 'phys'], ['rocks', 'phys'], ['rocks', 'phys'], ['quake', 'phys'], ['rocks', 'phys'], ['spikes', 'phys'], ['quake', 'phys'], 'dark'), // 땅 갈라짐 · 흙먼지 · 돌
  mossLord: FX(['quake', 'forest'], ['burst', 'forest'], ['vines', 'forest'], ['vines', 'forest'], ['vines', 'forest'], ['vines', 'forest'], ['vines', 'forest'], ['vines', 'forest'], 'forest'), // 뿌리 · 덩굴
  bogHag: FX(['fog', 'poison'], ['burst', 'poison'], ['fog', 'poison'], ['burst', 'poison'], ['fog', 'poison'], ['fog', 'poison'], ['vines', 'poison'], ['fog', 'poison'], 'poison'), // 독 구름 · 초록 마법
  climbQueen: FX(['quake', 'poison'], ['burst', 'poison'], ['fog', 'poison'], ['burst', 'poison'], ['fog', 'poison'], ['fog', 'poison'], ['fog', 'poison'], ['fog', 'poison'], 'poison'), // 독 늪 폭발
  demonCaptain: FX(['burst', 'fire'], ['burst', 'fire'], ['meteor', 'fire'], ['burst', 'fire'], ['burst', 'fire'], ['meteor', 'fire'], ['burst', 'fire'], ['burst', 'fire'], 'fire'), // 불꽃 사슬 · 불타는 방패
  climbRift: FX(['burst', 'fire'], ['burst', 'fire'], ['meteor', 'fire'], ['burst', 'fire'], ['burst', 'fire'], ['meteor', 'fire'], ['burst', 'fire'], ['burst', 'fire'], 'fire'), // 용암 폭발 · 핵 광선
  frostOgre: FX(['ice', 'ice'], ['zero', 'ice'], ['rocks', 'ice'], ['ice', 'ice'], ['ice', 'ice'], ['shatter', 'ice'], ['ice', 'ice'], ['ice', 'ice'], 'ice'), // 얼음 가시 · 우박
  climbWitch: FX(['ice', 'ice'], ['zero', 'ice'], ['shatter', 'ice'], ['crystal', 'ice'], ['ice', 'ice'], ['shatter', 'ice'], ['ice', 'ice'], ['ice', 'ice'], 'ice'), // 얼음 결정 · 서리 폭발
  wraithLord: FX(['doom', 'dark'], ['doom', 'dark'], ['doom', 'dark'], ['doom', 'dark'], ['doom', 'dark'], ['doom', 'dark'], ['bones', 'phys'], ['doom', 'dark'], 'dark'), // 어둠의 문 · 뼈 가시
  engraveKing: FX(['holy', 'holy'], ['holy', 'holy'], ['holy', 'holy'], ['holy', 'holy'], ['holy', 'holy'], ['holy', 'holy'], ['holy', 'holy'], ['holy', 'holy'], 'holy'), // 빛기둥 · 금빛 광선
};

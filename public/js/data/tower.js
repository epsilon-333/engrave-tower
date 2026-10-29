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
export const GRADE_MUL = { S: 2, A: 1.5, B: 1.1, C: 0.8 };
export const GRADE_COLOR = { S: '#ffd84a', A: '#7ad8ff', B: '#9fe3a8', C: '#c8c0d0' };
export const betterGrade = (a, b) => (GRADES.indexOf(a) >= GRADES.indexOf(b) ? a : b);
// 보상: 골드는 층의 제곱으로, 등급 배율 · 처음 깬 층 2배. 보스 층은 정령석, S등급은 물약
export function towerReward(f, grade, first) {
  const g = GRADE_MUL[grade];
  return {
    gold: Math.round((25 + f * f * 3) * g * (first ? 2 : 1)),
    stones: isBossFloor(f) ? (grade === 'S' ? 2 : 1) * (first ? 2 : 1) : 0,
    potion: grade === 'S' ? (f >= 30 ? 'potion3' : f >= 12 ? 'potion2' : 'potion1') : null,
  };
}
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
  { title: '서리 여왕', hint: '얼음 고리는 바깥이 위험하다 — 여왕 가까이 붙어라',
    phases: [['donut', 'spiral'], ['donut', 'mark', 'spiral'], ['donut', 'mark', 'split', 'donut']],
    names: { donut: '서리 고리', spiral: '눈보라', mark: '얼음 표식', split: '빙창' } },
  { title: '망령 기사', hint: '분신은 금방 부서진다 — 맞았을 때 버티는 쪽이 진짜', blinkInv: 0,
    phases: [['combo', 'leap', 'clones'], ['combo', 'clones', 'blink'], ['clones', 'leap', 'combo', 'blink']],
    names: { combo: '망령 베기', leap: '그림자 도약', clones: '분신', blink: '그림자 걸음' } },
  { title: '균열 감시자', hint: '회전 광선은 도는 방향으로 같이 돌아라',
    phases: [['beam', 'split'], ['sweep', 'beam', 'blink'], ['sweep', 'split', 'beam', 'sweep']],
    names: { beam: '감시 광선', split: '균열 탄', sweep: '회전 광선', blink: '차원 이동' } },
  { title: '하늘의 포식자', hint: '날아오르면 맞지 않는다 — 떨어지는 자리를 피해라',
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
  climbChief: { wallStun: true, add: [['charge'], ['charge'], ['charge']], hint: '돌격을 벽으로 유도하면 부딪혀 기절한다' },
  mossLord: { add: [['channel'], ['channel'], ['channel']], names: { channel: '뿌리 흡수' }, hint: '뿌리로 회복할 때 세게 때려 끊어라' },
  bogHag: { add: [['clones'], ['clones'], ['clones']], names: { clones: '환영 분신' }, hint: '분신은 금방 부서진다 — 버티는 쪽이 진짜' },
  climbQueen: { add: [[], ['ritual'], ['ritual']], names: { ritual: '늪의 제물' }, hint: '제물을 모두 쓰러뜨리면 거인이 무너진다' },
  demonCaptain: { add: [['mirror'], ['mirror'], ['mirror']], names: { mirror: '반사 방패' }, hint: '방패가 빛나는 동안 때리면 내가 다친다' },
  climbRift: { add: [['sweep'], ['sweep'], ['sweep']], names: { sweep: '회전 균열 광선' }, hint: '도는 광선은 같은 방향으로 돌며 피해라' },
  frostOgre: { vent: 3, ventText: '숨이 찼다! 약점이 드러났다', add: [[], [], []], hint: '기술을 몇 번 쓰면 숨을 고른다 (피해 2배)' },
  climbWitch: { add: [['donut'], ['donut'], ['donut']], names: { donut: '서리 고리' }, hint: '서리 고리는 바깥이 위험하다 — 마녀 곁으로' },
  wraithLord: { add: [[], ['soar'], ['soar']], names: { soar: '혼령화' }, hint: '혼령이 되면 맞지 않는다 — 떨어지는 자리를 피해라' },
  engraveKing: { wallStun: true, vent: 6, add: [['donut', 'channel'], ['sweep', 'clones', 'mirror'], ['ritual', 'soar', 'sweep', 'donut']],
    names: { donut: '심판의 고리', channel: '각인 흡수', sweep: '천벌 광선', clones: '거울 그림자', mirror: '반사의 율법', ritual: '마지막 의식', soar: '승천' }, hint: '모든 수호자의 기술을 쓴다' },
};

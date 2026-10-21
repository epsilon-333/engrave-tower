// 각인의 탑 50층: 층마다 짧은 던전 하나. 계단에 닿으면 클리어 → 시간 · 받은 피해로 등급(S·A·B·C)과 보상.
// 5층마다 층 수호자(보스)를 쓰러뜨려야 계단이 열린다. 몬스터는 층마다 복리로 강해져서 마지막 층은 거의 깨지 못한다.
// (예전의 층(이끼 동굴 · 독늪 · …)은 지우지 않고 보류 — 탑 문에서는 더 이상 들어가지 않는다)
export const TOWER_TOP = 50;
// 10층마다 풍경이 바뀐다: 옛 층의 땅 · 몬스터를 빌려 쓴다
export const TOWER_THEME = ['cave', 'swamp', 'rift', 'frost', 'grave'];
export const towerZoneId = (f) => TOWER_THEME[Math.min(TOWER_THEME.length - 1, Math.floor((f - 1) / 10))];
// 몬스터 배율: 체력 ×1.13, 공격 ×1.095 (층마다 복리) — 10층 3.0배 · 2.3배, 30층 34배 · 14배, 50층 400배 · 85배
export const towerMul = (f) => ({ hp: Math.pow(1.13, f - 1), atk: Math.pow(1.095, f - 1) });
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

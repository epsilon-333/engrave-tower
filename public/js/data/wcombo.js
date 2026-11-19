// 무기마다 고유한 평타 콤보 (2026-11-19)
// 한 번 누를 때마다 다음 동작으로 넘어가고, 잠깐 쉬면(그 무기 한 동작 시간의 1.6배) 처음부터.
//  m     동작 이름 (renderer comboPose가 그림을 만든다)
//  t     이 동작에 걸리는 시간 (초 · 공격 속도로 줄지만 min 아래로는 줄지 않는다)
//  hit   맞는 순간 (동작 시간의 몇 %)
//  mul   피해 배율 · arc 휘두르는 각 · range 사거리 배율 · thrust 일직선 찌르기 · full 몸 둘레 전부
//  step  맞기 직전에 내딛는 거리 · stop 맞은 뒤 멈춤(박힘) · kb 넉백 배율
// 1초 평균 피해는 tools/wpnbal.mjs gen 이 다시 맞춘다
export const WCOMBO = {
  blunt: { min: 0.95, list: [ // 둔기: 머리 위에서 내려찍기 → 허리를 돌려 옆으로 후려치기 → 아래에서 퍼 올리기
    { m: 'down', t: 1.0, hit: 0.78, mul: 1.0, arc: 1.4, step: 6, stop: 0.12 },
    { m: 'side', t: 0.9, hit: 0.62, mul: 0.9, arc: 2.6, kb: 1.4 },
    { m: 'up', t: 1.0, hit: 0.66, mul: 1.3, arc: 1.6, step: 8, stop: 0.08 },
  ] },
  long: { min: 0.5, list: [ // 장검: 대각 베기 → 되돌려 베기 → 내딛으며 길게 찌르기
    { m: 'diag', t: 1.0, hit: 0.45, mul: 0.95, arc: 1.9, step: 5 },
    { m: 'rdiag', t: 0.85, hit: 0.4, mul: 0.95, arc: 1.9 },
    { m: 'thrust', t: 1.15, hit: 0.5, mul: 1.3, range: 1.3, thrust: true, step: 12 },
  ] },
  scythe: { min: 0.6, list: [ // 낫: 몸 뒤에서 앞으로 끌어당겨 거두기 → 손잡이를 돌려 반대로 거두기 → 머리 위로 한 바퀴
    { m: 'reap', t: 1.0, hit: 0.55, mul: 1.0, arc: 2.4 },
    { m: 'rreap', t: 0.9, hit: 0.5, mul: 1.0, arc: 2.4 },
    { m: 'whirl', t: 1.25, hit: 0.55, mul: 1.15, full: true },
  ] },
  axe: { min: 0.6, list: [ // 도끼: 어깨 위에서 내리찍기(박혔다 뽑힌다) → 허리를 돌려 옆으로 베기
    { m: 'chop', t: 1.0, hit: 0.65, mul: 1.05, arc: 1.5, stop: 0.12 },
    { m: 'aside', t: 0.95, hit: 0.6, mul: 0.95, arc: 2.6, kb: 1.2 },
  ] },
  blade: { min: 0.22, list: [ // 한손검: 베기 → 되돌려 베기 → 짧게 찌르기
    { m: 'slash', t: 1.0, hit: 0.3, mul: 0.95, arc: 1.9 },
    { m: 'rslash', t: 1.0, hit: 0.3, mul: 0.95, arc: 1.9 },
    { m: 'stab', t: 1.1, hit: 0.4, mul: 1.15, range: 1.15, thrust: true, step: 6 },
  ] },
  dagger: { min: 0.14, list: [ // 단검: 빠른 찌르기 둘 → 칼을 거꾸로 쥐고 베기
    { m: 'stab', t: 0.9, hit: 0.35, mul: 0.9, thrust: true, step: 4 },
    { m: 'stab', t: 0.9, hit: 0.35, mul: 0.9, thrust: true, step: 4 },
    { m: 'rslash', t: 1.2, hit: 0.35, mul: 1.25, arc: 2.2 },
  ] },
  spear: { min: 0.32, list: [ // 창: 찌르기 → 찌르기 → 몸을 던져 깊게 찌르기 (언제나 창끝으로 · 옆으로 휘두르지 않는다)
    { m: 'thrust', t: 1.0, hit: 0.42, mul: 1.0, thrust: true },
    { m: 'thrust', t: 1.0, hit: 0.42, mul: 1.0, thrust: true, step: 6 },
    { m: 'lunge', t: 1.25, hit: 0.6, mul: 1.25, thrust: true, range: 1.25, step: 16, kb: 1.5 }, // 몸을 던져 깊게 찌르기 (창은 언제나 창끝으로)
  ] },
};

// 들고 있는 무기의 콤보 갈래 (대검 · 주먹 · 채찍 · 던지기는 따로 · 없으면 null)
export function comboFam(b) {
  const it = b?.weaponItem, w = b?.weapon, c = b?.wcat;
  if (!w || w.kind !== 'melee' || w.great || c === 'fist' || w.shape === 'whip' || c === 'whip') return null;
  if (c === 'blunt') return 'blunt';
  if (c === 'scythe') return 'scythe';
  if (c === 'axe') return 'axe';
  if (c === 'polearm' || w.shape === 'thrust') return 'spear';
  if (c === 'blade' || c === 'shield') return w.hits === 2 ? 'dagger' : (it?.hands === 2 || w.hands === 2) ? 'long' : w.scale === 'agi' ? 'dagger' : 'blade';
  return 'blade';
}

import { CURVE_HP, CURVE_ATK } from './curve.js';
// 탑 등반 (본편): 층 · 문 · 서약. 탑 안에는 각인 · 보상이 없고 층마다 몬스터만 나온다.
// 한 번의 등반 = run. 층을 깨면 문이 열려 다음 층으로. 10층마다(구역의 주인) 다음 시작 층이 기록된다.
// DOM을 쓰지 않는 순수 데이터 · 함수 (시뮬레이션 테스트에서 그대로 쓴다)
import { MONSTERS } from './monsters.js';

export const CLIMB_TOP = 100;
// 한 등반에서 새길 수 있는 각인은 6개까지 (다 차면 가진 각인의 연마만 나온다)
export const MAX_ENG = 6;

// 구역: 10층마다 풍경 · 몬스터가 바뀐다. 5층에 수호자, 10층에 구역의 주인
export const ACTS = [
  { n: 1, from: 1, to: 10, zone: 'cave', name: '이끼 굴', guardian: 'climbChief', lord: 'mossLord', rec: 1, color: '#7ed957' },
  { n: 2, from: 11, to: 20, zone: 'swamp', name: '독늪', guardian: 'bogHag', lord: 'climbQueen', rec: 10, color: '#9be15d' },
  { n: 3, from: 21, to: 30, zone: 'rift', name: '화산 균열', guardian: 'demonCaptain', lord: 'climbRift', rec: 19, color: '#ff7a2a' },
  { n: 4, from: 31, to: 40, zone: 'frost', name: '서리 회랑', guardian: 'frostOgre', lord: 'climbWitch', rec: 28, color: '#9fe3ff' },
  { n: 5, from: 41, to: 50, zone: 'grave', name: '그림자 묘지', guardian: 'wraithLord', lord: 'engraveKing', rec: 37, color: '#c45cff' },
  // 51~100층: 같은 풍경이 더 깊어지고, 수호자 · 주인이 각성해서 돌아온다
  { n: 6, from: 51, to: 60, zone: 'cave', name: '잠식된 이끼 굴', guardian: 'climbChief', lord: 'mossLord', rec: 44, color: '#5fbf3a' },
  { n: 7, from: 61, to: 70, zone: 'swamp', name: '썩어 가는 늪', guardian: 'bogHag', lord: 'climbQueen', rec: 49, color: '#7fc04a' },
  { n: 8, from: 71, to: 80, zone: 'rift', name: '타오르는 심연', guardian: 'demonCaptain', lord: 'climbRift', rec: 54, color: '#ff5a1a' },
  { n: 9, from: 81, to: 90, zone: 'frost', name: '영겁의 서리', guardian: 'frostOgre', lord: 'climbWitch', rec: 58, color: '#7fd0ff' },
  { n: 10, from: 91, to: 100, zone: 'grave', name: '탑의 꼭대기', guardian: 'wraithLord', lord: 'engraveKing', rec: 62, color: '#e07aff' },
];
export const actOf = (f) => ACTS[Math.max(0, Math.min(ACTS.length - 1, Math.floor((f - 1) / 10)))];
export const floorKind = (f) => (f % 10 === 0 ? 'lord' : f % 5 === 0 ? 'guardian' : 'fight');
// 권장 레벨: 구역 안에서도 조금씩 오른다 (화면에 보여 준다)
export const recLevel = (f) => Math.max(1, Math.round(actOf(f).rec + ((f - 1) % 10) * 1.0)); // 구역 안에서 층마다 권장 레벨 +1
// 권장 레벨보다 낮으면: 레벨 하나마다 몬스터 공격력 +8% (최대 +120%) · 체력 +5% (최대 +80%) — 레벨을 올리고 스킬 조합을 바꿔 가며 오른다
export function levelGap(f, level) {
  const gap = Math.max(0, recLevel(f) - (level || 1));
  return { gap, atk: 1 + Math.min(1.2, 0.08 * gap), hp: 1 + Math.min(0.8, 0.05 * gap) }; // 레벨 하나마다 공격 +8% · 체력 +5% (층마다 갑자기 뛰지 않게) // 레벨이 모자라면 크게 세진다: 레벨 하나마다 공격 +20% · 체력 +12%
}

export const BOSS_HP = { guardian: 1.4, lord: 1.0 }; // 수호자 · 주인 체력 배율 (보통 몬스터 체력은 data/curve.js 표)
// 보스 컨셉: 단단한 보스는 약하게 때리고, 세게 때리는 보스는 무르다 [체력, 공격]
export const BOSS_STYLE = {
  mossLord: [1.2, 0.8], climbQueen: [1.2, 0.8], demonCaptain: [1.25, 0.75], frostOgre: [1.2, 0.8], // 단단함
  climbChief: [0.75, 1.25], bogHag: [0.75, 1.25], climbWitch: [0.75, 1.25], wraithLord: [0.7, 1.3], // 날카로움
  climbRift: [1, 1], engraveKing: [1, 1], // 균형
};
export const BOSS_ATK = { guardian: 1.4, lord: 1.3 }; // 수호자 · 주인은 레벨이 모자라면 벽이 된다 (권장 레벨에서 두 레벨 이상 낮으면 공격 배율을 다 받는다)
const ZONE_REF = {}; // zone id → { hp, atk } 그 구역 몬스터의 평균
export function setZoneRef(zoneId, pool) {
  const list = pool.map((id) => MONSTERS[id]).filter(Boolean);
  if (!list.length) return;
  ZONE_REF[zoneId] = { hp: list.reduce((a, m) => a + m.hp, 0) / list.length, atk: list.reduce((a, m) => a + m.atk, 0) / list.length };
}
const BASE_REF = { hp: 48, atk: 8.5 }; // 1층(이끼 굴) 몬스터 평균에 맞춘 기준
export function climbMul(f, zoneId, oath = {}) {
  const ref = ZONE_REF[zoneId] || BASE_REF;
  // 난이도 표 하나 (data/curve.js · tools/curve.mjs 로 만든다): 층 f 의 보통 몬스터 평균 체력 · 공격력. 구역마다 몬스터 기본값이 달라도 평균이 표에 맞게 나눠 준다
  const i = Math.max(1, Math.min(100, f)), over = Math.pow(1.03, Math.max(0, f - 100)); // 100층 너머는 층마다 3%씩
  const hp = CURVE_HP[i] * over / ref.hp * (1 + 0.15 * (oath.hide || 0));
  const atk = CURVE_ATK[i] * over / ref.atk * (1 + 0.15 * (oath.fangs || 0));
  return { hp, atk };
}
// 층의 특성: 4층부터 싸움터의 1/4 정도에 붙는다 (같은 층이 되풀이되는 느낌을 줄인다)
export const FLOOR_MODS = {
  dark: { name: '어둠의 층', text: '빛이 거의 없다', color: '#8a7aa8' },
  swift: { name: '광풍의 층', text: '적이 25% 빠르다', color: '#a8f0c8' },
  bloodmoon: { name: '피의 달', text: '적 공격력 +15% · 처치마다 체력 2% 회복', color: '#e0445a' },
  horde: { name: '무리의 층', text: '적이 40% 많다', color: '#ff9a5a' },
};
export function rollFloorMod(f, kind, rng) {
  if (kind !== 'fight' || f < 4 || !rng.chance(0.27)) return null;
  return rng.pick(Object.keys(FLOOR_MODS));
}
// 층마다 나오는 적 수 (물결 셋으로 나눠 나온다)
export const floorFoes = (f, trial = false) => Math.round((8 + f * 0.45) * (trial ? 1.15 : 1));

// ───── 문 (층을 깨면 열린다) ─────
// 탑 안에는 보상 · 상인 · 제단이 없다: 다음 층은 언제나 몬스터 (5층 수호자 · 10층 구역의 주인)
export const REWARDS = {
  fight: { name: '다음 층', icon: 'fight', color: '#e8dcc0', desc: '몬스터' },
  guardian: { name: '수호자', icon: 'boss', color: '#ff8a5a', desc: '5층의 수호자' },
  lord: { name: '구역의 주인', icon: 'boss', color: '#ff4a3a', desc: '구역의 주인 · 쓰러뜨리면 다음부터 여기서 시작' },
};

// ───── 새 등반 ─────
export function newRun({ startF = 1, seed = 1, oath = {} } = {}) {
  return {
    f: startF - 1, startF, seed: seed >>> 0,
    kills: 0, time: 0, hurt: 0, hpFrac: 1, floorsCleared: 0,
    oath: { ...oath }, bosses: [],
  };
}

export function rollDoors(run) {
  const nf = run.f + 1;
  if (nf > CLIMB_TOP) return [];
  return [{ kind: floorKind(nf) }];
}

// ───── 이번 등반이 빌드에 더하는 것 (computeBuild 의 extraEffects) ─────
// 탑의 가호: 탑 안에서는 누구나 최대 체력 +250 (몸이 약한 클래스도 버틸 수 있게)
export const TOWER_HP = 250;
export function runEffects(run) {
  const fx = [{ type: 'add', key: 'maxHp', v: TOWER_HP }];
  if (run.oath?.drought) fx.push({ type: 'mul', key: 'healMul', v: 1 - 0.25 * run.oath.drought });
  return fx;
}

// ───── 서약 (난이도 · 10층의 주인을 처음 쓰러뜨리면 열린다) ─────
export const OATHS = {
  hide: { name: '강철 피부', max: 3, text: (n) => `적 체력 +${15 * n}%` },
  fangs: { name: '날카로운 이빨', max: 3, text: (n) => `적 공격력 +${15 * n}%` },
  drought: { name: '메마른 샘', max: 2, text: (n) => `모든 회복 -${25 * n}%` },
  elite: { name: '정예의 시대', max: 3, text: (n) => `강화 개체 확률 +${20 * n}%` },
  wrath: { name: '수호자의 분노', max: 2, text: (n) => `수호자 · 주인 체력 +${25 * n}%${n >= 2 ? ' · 처음부터 분노' : ''}` },
  haste: { name: '조급한 탑', max: 1, text: () => '한 층에 90초가 넘으면 초마다 최대 체력 2% 피해' },
};
export const oathScore = (o = {}) => Object.entries(o).reduce((a, [k, v]) => a + (OATHS[k] ? v : 0), 0);

// 시작할 수 있는 층 (세이브는 10층마다): 1층, 그리고 쓰러뜨린 구역의 주인 다음 층 (11 · 21 · 31 …)
export function climbStarts(lords = {}) {
  const out = [1];
  for (const a of ACTS) if (lords[a.n] && a.to < CLIMB_TOP) out.push(a.to + 1);
  return out;
}

export function newClimbSave() {
  return { best: 0, runs: 0, wins: 0, oath: {}, oathBest: 0, lords: {}, kills: 0, bestRun: null };
}

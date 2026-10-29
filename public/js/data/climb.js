// 탑 등반 (본편 로그라이트): 층 · 보상 · 문 · 각인 제안 · 축복 · 탑의 축복(영구) · 서약
// 한 번의 등반 = run. 층을 깨면 보상을 고르고, 문을 골라 다음 층으로. 쓰러져도 별빛은 남는다.
// DOM을 쓰지 않는 순수 데이터 · 함수 (시뮬레이션 테스트에서 그대로 쓴다)
import { ENGRAVINGS, TAGS } from './engravings.js';
import { MONSTERS } from './monsters.js';

export const CLIMB_TOP = 100;

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
// 권장 레벨보다 낮으면: 레벨 하나마다 몬스터 공격력 +20% (최대 +300%) · 체력 +12% (최대 +200%) — 레벨을 올리고 스킬 조합을 바꿔 가며 오른다
export function levelGap(f, level) {
  const gap = Math.max(0, recLevel(f) - (level || 1));
  return { gap, atk: 1 + Math.min(3, 0.2 * gap), hp: 1 + Math.min(2, 0.12 * gap) }; // 레벨이 모자라면 크게 세진다: 레벨 하나마다 공격 +20% · 체력 +12%
}

// 몬스터 세기: 구역마다 몬스터 종류의 기본 체력이 다르므로 구역 평균으로 나눠 맞춘 뒤 층마다 오른다.
// 층마다 복리로 강해진다 (100층까지 끝없이): 레벨 · 무기 · 각인이 받쳐 줘야 오른다
const HP_GROW = 1.06, ATK_GROW = 1.042;
// 탑의 몬스터는 바깥보다 단단하다 (보통 몹도 서너 번은 때려야 쓰러진다) · 수호자 · 주인은 그보다 더
const CLIMB_HP = 2.3, CLIMB_ATK = 1.15; // 3.2 → 2.3: 맞으면 잘 쓰러지게 (보통 몹은 두세 번)
export const BOSS_HP = { guardian: 2.2, lord: 2.5 }; export const BOSS_ATK = { guardian: 1.4, lord: 1.3 }; // 수호자 · 주인은 레벨이 모자라면 벽이 된다 (권장 레벨에서 두 레벨 이상 낮으면 공격 배율을 다 받는다)
const ZONE_REF = {}; // zone id → { hp, atk } 그 구역 몬스터의 평균
export function setZoneRef(zoneId, pool) {
  const list = pool.map((id) => MONSTERS[id]).filter(Boolean);
  if (!list.length) return;
  ZONE_REF[zoneId] = { hp: list.reduce((a, m) => a + m.hp, 0) / list.length, atk: list.reduce((a, m) => a + m.atk, 0) / list.length };
}
const BASE_REF = { hp: 48, atk: 8.5 }; // 1층(이끼 굴) 몬스터 평균에 맞춘 기준
// 구역이 바뀔 때마다 한 계단 더 (뒤 구역일수록 각인이 쌓여 강해지므로)
const ACT_HP = [1, 1.3, 1.75, 2.4, 3.3], ACT_ATK = [1, 1.18, 1.4, 1.68, 2.0]; // 51층부터는 마지막 계단 그대로 (층마다 조금씩 오르는 몫만)
export function climbMul(f, zoneId, oath = {}) {
  const ref = ZONE_REF[zoneId] || BASE_REF, ai = Math.max(0, Math.min(4, Math.floor((f - 1) / 10)));
  const hp = CLIMB_HP * ACT_HP[ai] * Math.pow(HP_GROW, f - 1) * (BASE_REF.hp / ref.hp) * (1 + 0.15 * (oath.hide || 0));
  const atk = CLIMB_ATK * ACT_ATK[ai] * Math.pow(ATK_GROW, f - 1) * (BASE_REF.atk / ref.atk) * (1 + 0.15 * (oath.fangs || 0));
  return { hp, atk };
}
// 층의 특성: 4층부터 싸움터의 1/4 정도에 붙는다 (같은 층이 되풀이되는 느낌을 줄인다)
export const FLOOR_MODS = {
  dark: { name: '어둠의 층', text: '빛이 거의 없다 · 탑 금화 +30%', color: '#8a7aa8', gold: 1.3 },
  swift: { name: '광풍의 층', text: '적이 25% 빠르다 · 탑 금화 +50%', color: '#a8f0c8', gold: 1.5 },
  bloodmoon: { name: '피의 달', text: '적 공격력 +15% · 처치마다 체력 2% 회복', color: '#e0445a', gold: 1.2 },
  treasure: { name: '보물의 층', text: '보물 고블린 둘 · 보물 상자', color: '#ffd84a', gold: 1 },
  horde: { name: '무리의 층', text: '적이 40% 많다 · 별빛 +2', color: '#ff9a5a', gold: 1.2, shards: 2 },
};
export function rollFloorMod(f, kind, rng) {
  if (kind !== 'fight' || f < 4 || !rng.chance(0.27)) return null;
  return rng.pick(Object.keys(FLOOR_MODS));
}
// 층마다 나오는 적 수 (물결 셋으로 나눠 나온다)
export const floorFoes = (f, trial = false) => Math.round((8 + f * 0.45) * (trial ? 1.15 : 1));

// ───── 보상 (문에 붙는 것) ─────
// room: 싸움 없는 방 (들어가면 바로 그 일)
export const REWARDS = {
  eng: { name: '각인', icon: 'eng', color: '#ffcf5a', desc: '각인 3개 중 하나를 새긴다' },
  hone: { name: '연마', icon: 'hone', color: '#7ad8ff', desc: '가진 각인 하나를 한 단계 연마 (+12%)' },
  bless: { name: '축복', icon: 'bless', color: '#ff9ad8', desc: '수치 축복 3개 중 하나' },
  gold: { name: '금화', icon: 'gold', color: '#ffd84a', desc: '탑 금화 (상인에게 쓴다)' },
  heal: { name: '샘', icon: 'heal', color: '#7be38a', desc: '체력 25% 회복' },
  shard: { name: '별빛', icon: 'shard', color: '#b8a8ff', desc: '별빛 파편 (영구 성장)' },
  trial: { name: '시련', icon: 'trial', color: '#ff6a5a', desc: '강화된 적 · 희귀 이상 각인 + 별빛 3' },
  shop: { name: '상인', icon: 'shop', color: '#e8c070', desc: '싸움 없는 상인의 방', room: true },
  altar: { name: '제단', icon: 'altar', color: '#c45cff', desc: '위험과 보상을 바꾸는 선택', room: true },
  rest: { name: '쉼터', icon: 'rest', color: '#8ad8ff', desc: '체력 35% 회복 또는 연마', room: true },
  guardian: { name: '수호자', icon: 'boss', color: '#ff8a5a', desc: '5층의 수호자 · 영웅 이상 각인' },
  lord: { name: '구역의 주인', icon: 'boss', color: '#ff4a3a', desc: '구역의 주인 · 전설 각인 + 별빛' },
};

// 층의 깨는 보상 (문 종류 → 무엇을 주나)
export function clearReward(kind) {
  if (kind === 'trial') return { type: 'eng', minGrade: 3, shards: 3 };
  if (kind === 'guardian') return { type: 'eng', minGrade: 4, shards: 5 };
  if (kind === 'lord') return { type: 'eng', minGrade: 4, legendary: true, shards: 12 };
  return { type: kind };
}

// ───── 새 등반 ─────
export function newRun({ startF = 1, seed = 1, meta = {}, oath = {} } = {}) {
  return {
    f: startF - 1, startF, seed: seed >>> 0, next: startF === 1 ? 'eng' : 'eng', // 다음 층 보상
    eng: [],          // [{ id, lv }] 이번 등반에서 새긴 각인
    bless: {},        // { id: 개수 }
    curse: {},        // 제단에서 받은 대가 { maxHp: 0.85, dmg: 1.25, hurt: 1.2 }
    gold: 0, shards: 0, kills: 0, time: 0, hurt: 0,
    rerolls: meta.reroll || 0, revives: meta.revive || 0,
    hpFrac: 1, lastShop: -9, floorsCleared: 0,
    oath: { ...oath }, history: [], bosses: [],
  };
}

// ───── 문 고르기 ─────
const DOOR_W = { eng: 30, bless: 20, hone: 10, gold: 9, heal: 8, shard: 8, trial: 9, shop: 9, altar: 7 };
export function rollDoors(run, rng, meta = {}) {
  const nf = run.f + 1;
  if (nf > CLIMB_TOP) return [];
  const k = floorKind(nf);
  if (k !== 'fight') return [{ kind: k }];
  let n = 2 + (meta.wide ? 1 : 0) - (run.oath.narrow ? 1 : 0);
  n = Math.max(1, n);
  const out = [];
  // 수호자 바로 앞 층: 쉼터가 꼭 하나
  if (floorKind(nf + 1) !== 'fight') out.push({ kind: 'rest' });
  const hpLow = run.hpFrac < 0.5;
  const w = { ...DOOR_W };
  if (!run.eng.length) w.hone = 0;
  if (nf < 3) { w.shop = 0; w.trial = 0; w.altar = 0; w.hone = 0; }
  if (nf - run.lastShop < 4) w.shop = 0;
  if (hpLow) w.heal *= 3;
  if (run.f + 1 <= run.startF + 1) { out.push({ kind: 'eng' }); } // 첫 층은 각인부터
  while (out.length < n) {
    const keys = Object.keys(w).filter((x) => w[x] > 0 && !out.some((o) => o.kind === x));
    if (!keys.length) break;
    const tot = keys.reduce((a, x) => a + w[x], 0);
    let r = rng.next() * tot, pick = keys[0];
    for (const x of keys) { r -= w[x]; if (r <= 0) { pick = x; break; } }
    out.push({ kind: pick });
  }
  return out.slice(0, Math.max(n, out.length));
}

// ───── 각인 제안 ─────
// 등급 확률 (구역마다): 1 일반 · 2 고급 · 3 희귀 · 4 영웅 · 5 전설
const GRADE_W = [[58, 32, 9, 1, 0], [36, 36, 21, 6, 1], [20, 33, 30, 13, 4], [10, 26, 34, 22, 8], [5, 18, 35, 29, 13]];
export const GRADE_NAME = ['', '일반', '고급', '희귀', '영웅', '전설'];
export const GRADE_COLOR = ['', '#c8c8d0', '#6fd06a', '#5aa8ff', '#c27bff', '#ffc84a'];
const ENG_IDS = Object.keys(ENGRAVINGS);
export function runTags(run) {
  const t = {};
  for (const { id } of run.eng) for (const g of ENGRAVINGS[id]?.tags || []) t[g] = (t[g] || 0) + 1;
  return t;
}
export function offerEngravings(run, rng, { n = 3, minGrade = 1, legendary = false, luck = 0 } = {}) {
  const band = GRADE_W[Math.min(GRADE_W.length - 1, Math.floor(Math.max(0, run.f) / 10))];
  const tags = runTags(run), owned = new Map(run.eng.map((e) => [e.id, e.lv]));
  const cands = [];
  for (const id of ENG_IDS) {
    const e = ENGRAVINGS[id];
    if (e.grade < minGrade) continue;
    const lv = owned.get(id);
    if (lv != null && lv >= 5) continue;
    let w = band[e.grade - 1] || 0.5;
    if (minGrade > 1) w = Math.max(w, 6);
    if (e.grade >= 3) w *= 1 + luck * 0.25;
    const shared = (e.tags || []).filter((g) => tags[g]).length;
    w *= 1 + 0.9 * shared;
    if (lv != null) w *= 0.45;
    if (w > 0) cands.push({ id, w, up: lv != null });
  }
  const out = [];
  if (legendary) { // 구역의 주인: 전설 하나는 꼭
    const leg = cands.filter((c) => ENGRAVINGS[c.id].grade === 5);
    if (leg.length) { const c = pickW(leg, rng); out.push(c); }
  }
  while (out.length < n && cands.length > out.length) {
    const rest = cands.filter((c) => !out.includes(c));
    out.push(pickW(rest, rng));
  }
  return out.map((c) => ({ id: c.id, up: c.up }));
}
function pickW(list, rng) {
  const tot = list.reduce((a, c) => a + c.w, 0);
  let r = rng.next() * tot;
  for (const c of list) { r -= c.w; if (r <= 0) return c; }
  return list[list.length - 1];
}
export function addEngraving(run, id) {
  const cur = run.eng.find((e) => e.id === id);
  if (cur) { cur.lv = Math.min(5, cur.lv + 1); return cur; }
  const e = { id, lv: 0 }; run.eng.push(e); return e;
}
// 연마: 가진 각인 중 아직 다 연마하지 않은 것 셋
export function offerHone(run, rng, n = 3) {
  const list = run.eng.filter((e) => e.lv < 5).map((e) => ({ id: e.id, w: 1 + ENGRAVINGS[e.id].grade * 0.4 }));
  const out = [];
  while (out.length < n && list.length > out.length) out.push(pickW(list.filter((c) => !out.includes(c)), rng));
  return out.map((c) => c.id);
}

// ───── 축복 (수치가 분명한 것만 · 같은 것을 여러 번 고를 수 있다) ─────
export const BLESSINGS = {
  power: { name: '날카로움', text: '모든 피해 +8%', color: '#ff8a5a', fx: [{ type: 'mul', key: 'dmgMul', v: 1.08 }] },
  vigor: { name: '굳센 심장', text: '최대 체력 +12%', color: '#ff6a7a', fx: [{ type: 'mul', key: 'maxHp', v: 1.12 }] },
  haste: { name: '빠른 손', text: '공격 속도 +8%', color: '#ffd04a', fx: [{ type: 'mul', key: 'atkSpeed', v: 1.08 }] },
  precision: { name: '매의 눈', text: '치명타 확률 +6%', color: '#ffe8a8', fx: [{ type: 'add', key: 'crit', v: 0.06 }] },
  fury: { name: '급소 찌르기', text: '치명타 피해 +25%', color: '#ffb07a', fx: [{ type: 'add', key: 'critDmg', v: 0.25 }] },
  focus: { name: '맑은 정신', text: '스킬 재사용 시간 -8%', color: '#7ad8ff', fx: [{ type: 'mul', key: 'skillCdMul', v: 0.92 }] },
  swift: { name: '바람걸음', text: '이동 속도 +7%', color: '#a8f0c8', fx: [{ type: 'mul', key: 'moveSpeed', v: 1.07 }] },
  thirst: { name: '피의 갈증', text: '흡혈 +3%', color: '#e0445a', fx: [{ type: 'stat', stat: 'lifesteal', v: 3 }] },
  guard: { name: '돌가죽', text: '받는 피해 -7%', color: '#c8b8a0', fx: [{ type: 'mul', key: 'dmgTakenMul', v: 0.93 }] },
  regen: { name: '끝없는 숨', text: '초당 최대 체력 0.4% 회복', color: '#7be38a', fx: [{ type: 'add', key: 'regen', v: 0.004 }] },
  dash: { name: '그림자 발', text: '대시 재사용 시간 -15%', color: '#b8a8ff', fx: [{ type: 'mul', key: 'dashCd', v: 0.85 }] },
  status: { name: '독한 손길', text: '상태이상 피해 +15%', color: '#9be15d', fx: [{ type: 'mul', key: 'statusDmgMul', v: 1.15 }] },
  spirit: { name: '타오르는 혼', text: '종족 자원 얻는 양 +15%', color: '#c45cff', fx: [{ type: 'mul', key: 'resGain', v: 1.15 }] },
};
export function offerBless(run, rng, n = 3) {
  const ids = Object.keys(BLESSINGS), out = [];
  while (out.length < n) { const id = rng.pick(ids); if (!out.includes(id)) out.push(id); }
  return out;
}

// ───── 제단 (위험과 보상) ─────
export const ALTARS = {
  bloodPact: { name: '피의 계약', text: '최대 체력 -15% (이번 등반) → 영웅 이상 각인 하나', risk: true },
  gamble: { name: '도박꾼의 동전', text: '탑 금화 절반을 건다 → 반반: 두 배 또는 잃음' },
  cursedPower: { name: '저주받은 힘', text: '모든 피해 +20% · 받는 피해 +20% (이번 등반)', risk: true },
  quietSpring: { name: '고요한 샘', text: '체력을 모두 회복한다 · 다음 층은 시련' },
  reforge: { name: '잊힌 각인사', text: '가진 각인 하나를 버리고 → 한 등급 높은 각인 둘 중 하나' },
  starAltar: { name: '별의 제단', text: '별빛 +6 또는 탑 금화 +80 중 하나' },
};
export function rollAltars(run, rng) {
  const ids = Object.keys(ALTARS).filter((id) => (id !== 'reforge' || run.eng.length) && (id !== 'gamble' || run.gold >= 20));
  const out = [];
  while (out.length < 2 && ids.length > out.length) { const id = rng.pick(ids); if (!out.includes(id)) out.push(id); }
  return out;
}

// ───── 상인 ─────
export const ENG_PRICE = [0, 45, 70, 110, 170, 260];
export function shopPrice(base, run, meta = {}) {
  const act = actOf(Math.max(1, run.f)).n - 1;
  return Math.round(base * (1 + 0.2 * act) * (1 - 0.1 * (meta.trade || 0)) * (run.oath.greed ? 1.4 : 1));
}
export function rollShop(run, rng, meta = {}) {
  const engs = offerEngravings(run, rng, { n: 3, luck: meta.luck || 0 });
  return [
    ...engs.map((e) => ({ kind: 'eng', id: e.id, up: e.up, price: shopPrice(ENG_PRICE[ENGRAVINGS[e.id].grade], run, meta) })),
    { kind: 'bless', id: rng.pick(Object.keys(BLESSINGS)), price: shopPrice(90, run, meta) },
    { kind: 'heal', price: shopPrice(40, run, meta) },
    { kind: 'hone', price: shopPrice(75, run, meta) },
    { kind: 'reroll', price: shopPrice(35, run, meta) },
  ];
}

// ───── 이번 등반이 빌드에 더하는 것 (computeBuild 의 runEng · extraEffects) ─────
// 탑의 가호: 탑 안에서는 누구나 최대 체력 +250 (몸이 약한 클래스도 버틸 수 있게)
export const TOWER_HP = 250;
export function runEffects(run, meta = {}) {
  const fx = [{ type: 'add', key: 'maxHp', v: TOWER_HP }];
  for (const [id, n] of Object.entries(run.bless || {})) {
    const b = BLESSINGS[id]; if (!b) continue;
    for (const e of b.fx) for (let i = 0; i < n; i++) fx.push(e);
  }
  if (meta.hp) fx.push({ type: 'mul', key: 'maxHp', v: 1 + 0.04 * meta.hp });
  if (meta.dmg) fx.push({ type: 'mul', key: 'dmgMul', v: 1 + 0.03 * meta.dmg });
  const c = run.curse || {};
  if (c.maxHp) fx.push({ type: 'mul', key: 'maxHp', v: c.maxHp });
  if (c.dmg) fx.push({ type: 'mul', key: 'dmgMul', v: c.dmg });
  if (c.hurt) fx.push({ type: 'mul', key: 'dmgTakenMul', v: c.hurt });
  if (run.oath.drought) fx.push({ type: 'mul', key: 'healMul', v: 1 - 0.25 * run.oath.drought });
  return fx;
}

// ───── 별빛 · 탑 금화 ─────
export function shardGain(base, run, meta = {}) {
  return Math.max(0, Math.round(base * (1 + 0.1 * (meta.star || 0)) * (1 + 0.1 * oathScore(run.oath))));
}
export function goldGain(base, run, meta = {}) {
  const extra = run.bless?.wealth ? 0.2 * run.bless.wealth : 0;
  return Math.round(base * (1 + 0.15 * (meta.gold || 0) + extra));
}
export const floorGold = (f) => 10 + f;          // 층을 깰 때마다
export const goldReward = (f) => 55 + f * 4;      // 금화 보상
export const shardReward = (f) => 4 + Math.floor(f / 8); // 별빛 보상

// ───── 탑의 축복 (영구 · 별빛으로 배운다) ─────
export const META = {
  hp: { name: '단단한 몸', max: 5, cost: (n) => 10 + n * 10, text: (n) => `최대 체력 +${4 * n}%` },
  dmg: { name: '날 선 의지', max: 5, cost: (n) => 12 + n * 12, text: (n) => `모든 피해 +${3 * n}%` },
  revive: { name: '두 번째 숨', max: 1, cost: () => 150, text: () => '쓰러지면 체력 25%로 한 번 일어난다 (등반마다 1번)' },
  reroll: { name: '다시 보는 눈', max: 3, cost: (n) => 20 + n * 20, text: (n) => `보상 다시 고르기 ${n}번 (등반마다)` },
  wide: { name: '넓은 길', max: 1, cost: () => 80, text: () => '문이 하나 더 열린다 (3개)' },
  luck: { name: '행운의 문양', max: 4, cost: (n) => 15 + n * 15, text: (n) => `희귀 이상 각인이 ${n * 25}% 더 잘 나온다` },
  trade: { name: '상인의 벗', max: 3, cost: (n) => 15 + n * 15, text: (n) => `상인 가격 -${10 * n}%` },
  start: { name: '출발의 각인', max: 2, cost: (n) => [40, 100][n], text: (n) => `등반을 시작할 때 각인 ${n}개를 고른다` },
  spring: { name: '샘물의 기억', max: 3, cost: (n) => 15 + n * 15, text: (n) => `층을 깰 때마다 체력 +${3 * n}%` },
  gold: { name: '금빛 손', max: 3, cost: (n) => 12 + n * 12, text: (n) => `탑 금화 +${15 * n}%` },
  star: { name: '별의 인도', max: 5, cost: (n) => 20 + n * 15, text: (n) => `별빛 +${10 * n}%` },
};

// ───── 서약 (난이도 · 10층의 주인을 처음 쓰러뜨리면 열린다) ─────
export const OATHS = {
  hide: { name: '강철 피부', max: 3, text: (n) => `적 체력 +${15 * n}%` },
  fangs: { name: '날카로운 이빨', max: 3, text: (n) => `적 공격력 +${15 * n}%` },
  drought: { name: '메마른 샘', max: 2, text: (n) => `모든 회복 -${25 * n}%` },
  elite: { name: '정예의 시대', max: 3, text: (n) => `강화 개체 확률 +${20 * n}%` },
  wrath: { name: '수호자의 분노', max: 2, text: (n) => `수호자 · 주인 체력 +${25 * n}%${n >= 2 ? ' · 처음부터 분노' : ''}` },
  narrow: { name: '좁은 문', max: 1, text: () => '문이 하나 줄어든다' },
  haste: { name: '조급한 탑', max: 1, text: () => '한 층에 90초가 넘으면 초마다 최대 체력 2% 피해' },
  greed: { name: '탐욕의 대가', max: 1, text: () => '상인 가격 +40%' },
};
export const oathScore = (o = {}) => Object.entries(o).reduce((a, [k, v]) => a + (OATHS[k] ? v : 0), 0);

// 시작할 수 있는 층: 1층, 그리고 쓰러뜨린 구역의 주인 다음 구역 첫 층
export const climbStarts = () => [1]; // 한 번 쓰러지면 언제나 1층부터 (레벨 · 무기가 쌓여야 더 높이 오른다)
// 중간 구역부터 시작하면: 구역마다 각인 2개 · 축복 1개를 먼저 고른다
export const startBonus = (startF) => ({ eng: Math.floor((startF - 1) / 10) * 2, bless: Math.floor((startF - 1) / 10) });

export function newClimbSave() {
  return { best: 0, runs: 0, wins: 0, shards: 0, meta: {}, oath: {}, oathBest: 0, lords: {}, kills: 0, bestRun: null };
}
export const TAG_NAME = (t) => TAGS[t]?.name || t;

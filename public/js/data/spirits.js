// 정령 계약: 정령석을 바쳐 정령과 계약한다 (확률). 속성 6가지 × 등급 4가지 = 정령 24.
// 싸울 때는 '정령 부르기' 스킬로 함께하는 정령을 꺼낸다. 나와 있는 동안 정령은 버프를 주고 가까운 적을 공격한다.
// 같은 정령과 또 계약하면 결속(★)이 오른다 (최대 5) — 결속마다 힘 +15%.

export const SPIRIT_GRADES = [
  { name: '일반', color: '#c8c4d0', mul: 1, rate: 0.55 },
  { name: '희귀', color: '#6ab8ff', mul: 1.5, rate: 0.3 },
  { name: '영웅', color: '#c27aff', mul: 2.2, rate: 0.12 },
  { name: '전설', color: '#ffc840', mul: 3.2, rate: 0.03 },
];
export const SPIRIT_STAR_MAX = 5, STAR_MUL = 0.15;
export const STONE_PRICE = 150; // 세계수 성지에서 정령석 하나 값
// 정령사는 정령과 가깝다: 정령석이 싸고, 좋은 정령이 조금 더 잘 온다
export const STONE_PRICE_CALLER = 100;
export const CALLER_RATES = [0.45, 0.33, 0.17, 0.05];
// 정령 레벨: 함께 싸운 시간(초)이 쌓이면 오른다. 레벨마다 힘 +6% (최대 10)
export const SPIRIT_LV_XP = [0, 120, 300, 600, 1000, 1500, 2200, 3000, 4000, 5400], SPIRIT_LV_MUL = 0.06;
export const spiritLevel = (xp = 0) => { let l = 1; for (let i = 0; i < SPIRIT_LV_XP.length; i++) if (xp >= SPIRIT_LV_XP[i]) l = i + 1; return l; };
export const PULL10_GUARANTEE = 1; // 10회 계약은 희귀 이상 하나를 보장

// 속성: 색 3가지(밝음 · 몸 · 그늘) · 버프(등급 1배 · 결속 1 기준) · 공격 모양
export const SPIRIT_ELEMS = {
  fire: { name: '불', pal: ['#fff0a0', '#ff8a2a', '#c8401a'], buff: { dmgMul: 0.06 }, buffText: (v) => `주는 피해 +${pct(v.dmgMul)}%`, status: 'burn', atk: 1.0 },
  ice: { name: '얼음', pal: ['#f0fbff', '#8ad8ff', '#3a7ab8'], buff: { dmgTakenMul: -0.06 }, buffText: (v) => `받는 피해 -${pct(-v.dmgTakenMul)}%`, status: 'chill', atk: 0.85 },
  lightning: { name: '번개', pal: ['#ffffe0', '#f8e050', '#b89020'], buff: { crit: 0.05 }, buffText: (v) => `치명타 확률 +${pct(v.crit)}%`, status: 'shock', atk: 0.95, chain: true },
  wind: { name: '바람', pal: ['#f0fff4', '#9ef0c0', '#3aa878'], buff: { moveSpeed: 0.08, atkSpeed: 0.06 }, buffText: (v) => `이동 속도 +${pct(v.moveSpeed)}% · 공격 속도 +${pct(v.atkSpeed)}%`, atk: 0.9, pierce: true },
  forest: { name: '숲', pal: ['#e8ffc8', '#7be36a', '#3a8a3a'], buff: { regen: 0.006 }, buffText: (v) => `초당 체력 ${(v.regen * 100).toFixed(1)}% 회복`, status: 'poison', atk: 0.8 },
  dark: { name: '어둠', pal: ['#e8d8ff', '#9a6ad8', '#3a2058'], buff: { lifesteal: 4 }, buffText: (v) => `준 피해의 ${Math.round(v.lifesteal)}% 흡혈`, status: 'curse', atk: 0.95 },
};
const pct = (v) => Math.round(v * 100);

// 등급별 모습: 0 방울(동그란 정령) · 1 요정(날개 달린 작은 사람) · 2 짐승 · 3 정령왕
const NAMES = {
  fire: ['불씨 방울', '불꽃 요정', '화염 여우', '화염의 정령왕'],
  ice: ['서리 방울', '눈꽃 요정', '얼음 늑대', '빙결의 정령왕'],
  lightning: ['번쩍 방울', '뇌전 요정', '천둥 매', '뇌신의 정령왕'],
  wind: ['산들 방울', '바람 요정', '질풍 독수리', '바람의 정령왕'],
  forest: ['새싹 방울', '숲 요정', '이끼 사슴', '숲의 정령왕'],
  dark: ['그림자 방울', '어스름 요정', '그림자 박쥐', '어둠의 정령왕'],
};
export const SPIRITS = {};
for (const [elem, names] of Object.entries(NAMES)) names.forEach((name, grade) => { SPIRITS[`${elem}${grade}`] = { id: `${elem}${grade}`, elem, grade, name }; });

// 결속을 넣은 힘 배율 · 버프 수치
export const spiritPower = (id, star = 1, lv = 1) => { const s = SPIRITS[id]; return s ? SPIRIT_GRADES[s.grade].mul * (1 + STAR_MUL * (Math.max(1, star) - 1)) * (1 + SPIRIT_LV_MUL * (Math.max(1, lv) - 1)) : 1; };
export function spiritBuff(id, star = 1, boost = 1, lv = 1) {
  const s = SPIRITS[id], E = SPIRIT_ELEMS[s.elem], k = spiritPower(id, star, lv) * boost, out = {};
  for (const [key, v] of Object.entries(E.buff)) out[key] = v * k;
  return out;
}
// buff 수치 → 게임의 버프(mods) 모양: 곱하는 것은 1+v, 더하는 것은 그대로
export function buffMods(b) {
  const m = {};
  for (const [key, v] of Object.entries(b)) m[key] = ['dmgMul', 'dmgTakenMul', 'moveSpeed', 'atkSpeed'].includes(key) ? 1 + v : v;
  return m;
}
export const spiritBuffText = (id, star = 1, lv = 1) => SPIRIT_ELEMS[SPIRITS[id].elem].buffText(spiritBuff(id, star, 1, lv));

// 계약 한 번: 등급을 고르고 그 등급의 정령 중 하나 (rng: () => 0~1)
export function rollSpirit(rng, minGrade = 0, rates = null) {
  let r = rng(), grade = 0;
  const R = rates || SPIRIT_GRADES.map((G) => G.rate);
  for (let g = SPIRIT_GRADES.length - 1; g >= 0; g--) { const cum = R.slice(g).reduce((a, x) => a + x, 0); if (r < cum) { grade = g; break; } }
  grade = Math.max(minGrade, grade);
  const pool = Object.values(SPIRITS).filter((s) => s.grade === grade);
  return pool[Math.floor(rng() * pool.length) % pool.length].id;
}
// 계약 결과를 저장에 넣는다: 새 정령이면 결속 1, 있던 정령이면 결속 +1 (최대면 정령석 하나로 돌려받는다)
export function addSpirit(sv, id) {
  sv.spirits ||= { owned: {}, main: null, pulls: 0 };
  const o = sv.spirits.owned[id];
  let res;
  if (!o) { sv.spirits.owned[id] = { star: 1 }; res = 'new'; }
  else if (o.star < SPIRIT_STAR_MAX) { o.star++; res = 'star'; }
  else { sv.bag ||= {}; sv.bag.spiritStone = (sv.bag.spiritStone || 0) + 1; res = 'refund'; }
  if (!sv.spirits.main) sv.spirits.main = id;
  return res;
}

// ── 정령 고유 기술: 함께하는 동안 저절로 쓴다. 등급이 높을수록 자주 · 정령왕은 훨씬 크게 ──
export const SPIRIT_SPECIAL = {
  fire: { name: '불꽃 폭발', king: '화염 기둥', text: '가까운 적 자리에 불꽃이 터진다 (화상 2중첩)', kingText: '거대한 화염 기둥이 솟는다 (화상 4중첩)' },
  ice: { name: '서리 가시', king: '빙결 파동', text: '가까운 적 하나를 1초 얼린다 (냉기 3중첩)', kingText: '둘레의 적을 모두 1.2초 얼린다' },
  lightning: { name: '낙뢰', king: '뇌우', text: '둘레의 적 셋에게 벼락 (감전)', kingText: '둘레의 적 여섯에게 벼락' },
  wind: { name: '회오리', king: '폭풍의 눈', text: '내 둘레의 적을 밀쳐 낸다', kingText: '크게 밀쳐 내고 4초 동안 이동 속도 +25%' },
  forest: { name: '덩굴 올가미', king: '세계수의 가호', text: '둘레의 적을 1.2초 묶는다', kingText: '둘레를 묶고 최대 체력 8% 보호막' },
  dark: { name: '저주 전염', king: '어둠의 문', text: '가까운 적 셋에게 저주 3중첩', kingText: '어둠의 문이 열려 둘레를 크게 터뜨린다' },
};
export const spiritSpecialCd = (grade) => 9 - grade * 1.2; // 일반 9초 · 희귀 7.8 · 영웅 6.6 · 전설 5.4
export const spiritSpecialText = (id) => { const s = SPIRITS[id], X = SPIRIT_SPECIAL[s.elem]; return s.grade >= 3 ? `${X.king}: ${X.kingText}` : `${X.name}: ${X.text}`; };

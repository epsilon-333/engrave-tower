// 해방: 탑을 오를수록 섬의 지역 · 체계가 열린다.
// 조건은 하나 — 탑에서 깬 가장 높은 층(climb.best). 5층마다 수호자, 10층마다 구역의 주인.
// 새로 시작한 저장(save.gated)에만 적용한다. 예전 저장은 모두 열린 그대로.

// f: 이 층을 깨면 열린다 · regions: 바깥 지역(BIOMES id) · systems: 체계 · entrances: 들어가는 곳(ENTRANCES id)
export const UNLOCKS = [
  { f: 5, systems: ['fishing'] },
  { f: 10, regions: ['forest', 'mistcoast', 'swamp'], systems: ['sanctum', 'spirit', 'coach'] },
  { f: 15, entrances: ['mossCave'] },
  { f: 20, regions: ['ruins', 'jungle', 'volcano'], systems: ['farming', 'social'] },
  { f: 30, regions: ['wasteland', 'mountains'], systems: ['mount', 'sailing', 'raid:golem'] },
  { f: 40, regions: ['snow', 'graveyard'], systems: ['politics', 'raid:queen'] },
  { f: 50, regions: ['canyon'], systems: ['oath', 'rank', 'raid:dragon'], entrances: ['palace'] },
];

export const SYSTEM_NAME = {
  fishing: '낚시', sanctum: '종족 성지 · 수련', spirit: '정령 계약', farming: '농사', social: '동료 (파티 · 결투 · 길드)', coach: '역마차 (왕도행)',
  mount: '탈것', sailing: '항해 · 섬', 'raid:golem': '레이드 · 고대 골렘', politics: '왕도 정치', 'raid:queen': '레이드 · 서리 여왕',
  oath: '서약', rank: '랭킹', 'raid:dragon': '레이드 · 화룡왕',
};

// 무엇이 몇 층에서 열리나: need('region', 'forest') → 10 · 처음부터 열린 것은 0
const NEED = {};
for (const u of UNLOCKS) for (const kind of ['regions', 'systems', 'entrances']) for (const id of u[kind] || []) NEED[`${kind}:${id}`] = u.f;
export const need = (kind, id) => NEED[`${kind}:${id}`] || 0;

export const towerBest = (save) => save?.climb?.best || 0;
export function isOpen(save, kind, id) {
  if (!save?.gated) return true;
  return towerBest(save) >= need(kind, id);
}
// 잠겼을 때 보여 줄 글 (열려 있으면 null)
export function lockText(save, kind, id) {
  if (isOpen(save, kind, id)) return null;
  const f = need(kind, id);
  return `탑 ${f}층의 ${f % 10 === 0 ? '주인' : '수호자'}을 쓰러뜨리면 열린다`;
}
// prev층 다음부터 best층까지 새로 열린 것 (탑에서 돌아왔을 때 알려 준다)
export const openedBetween = (prev, best) => UNLOCKS.filter((u) => u.f > prev && u.f <= best);

// 세계(World)에 넘기는 잠금: 바깥 지역 번호(BIOMES 순서) → 안내 글, 그리고 체계 · 들어가는 곳 확인 함수. 다 열렸으면 null
export function makeLocks(save, biomes) {
  if (!save?.gated) return null;
  const regions = new Map();
  biomes.forEach((b, i) => { const t = lockText(save, 'regions', b.id); if (t) regions.set(i, { text: t, name: b.name }); });
  return { regions, text: (kind, id) => lockText(save, kind, id) };
}

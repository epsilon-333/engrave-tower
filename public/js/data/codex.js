// 도감 = 탑의 기록. 몬스터 · 장소 · 기록 · 사람을 알아갈수록 도감 점수가 쌓이고, 점수로 레벨이 오른다.
import { MONSTERS, ZONES, LORES } from './monsters.js';
import { JOURNALS, PEOPLE } from './story.js';
import { CAVE1_PLACES } from './maps/cave1.js';
import { OW_PLACES, WORLD_ZONE } from './maps/overworld.js';
import { FISH, ARTIFACTS } from './goods.js';
export const PLACE_ZONES = [WORLD_ZONE, ...ZONES];

// 몬스터 도감 단계: 처치 수 1 / 5 / 15 (정예 · 보물 고블린은 1마리로 완성)
export const STAGE_KILLS = [1, 5, 15];
export const STAGE_POINTS = [1, 1, 2];
export const PLACE_POINTS = 2, JOURNAL_POINTS = 2, LORE_POINTS = 1;
export const PERSON_POINTS = [1, 1, 1, 2]; // 사연 단계마다
export const FISH_POINTS = 1, ARTIFACT_POINTS = 2; // 새 물고기 · 땅에서 찾은 유물

const oneKill = (m) => m.elite || m.treasure;
export function monsterStage(id, kills) {
  const m = MONSTERS[id];
  if (!m || !kills) return 0;
  if (oneKill(m)) return 3;
  return STAGE_KILLS.filter((k) => kills >= k).length;
}
const stagePts = (stage) => STAGE_POINTS.slice(0, stage).reduce((a, b) => a + b, 0);

// 층마다의 장소 이름 (1층은 직접 설계한 방들, 나머지는 구역 이름)
export function zonePlaces(z) { return z.id === 'world' ? OW_PLACES : z.id === 'cave' ? CAVE1_PLACES : z.regions || []; }
export const placeKey = (zoneId, name) => `${zoneId}:${name}`;

export function codexPoints(s) {
  const c = s.codex || {}, f = s.story?.flags || {};
  let pts = 0;
  for (const [id, n] of Object.entries(c.kills || {})) pts += stagePts(monsterStage(id, n));
  pts += Object.keys(c.places || {}).length * PLACE_POINTS;
  pts += Object.keys(c.journals || {}).filter((id) => JOURNALS[id]).length * JOURNAL_POINTS;
  pts += (c.lore || []).length * LORE_POINTS;
  for (const p of Object.values(PEOPLE)) p.steps.forEach((st, i) => { if (f[st]) pts += PERSON_POINTS[i]; });
  pts += Object.keys(s.fishLog || {}).filter((id) => FISH[id]).length * FISH_POINTS;
  pts += Object.keys(s.artifacts || {}).filter((id) => ARTIFACTS[id]).length * ARTIFACT_POINTS;
  return pts;
}

// 레벨 L → L+1 에 필요한 점수: 3 + L
export const levelCost = (L) => 3 + L;
export function levelFor(points) {
  let L = 1, need = levelCost(1);
  while (points >= need) { points -= need; L++; need = levelCost(L); }
  return { level: L, into: points, need };
}

// 도감 전체 칸 수 (진행률 표시용)
export function codexTotals(s) {
  const c = s.codex || {};
  const mons = Object.keys(MONSTERS);
  return {
    monsters: { done: mons.filter((id) => monsterStage(id, c.kills?.[id]) >= 3).length, seen: mons.filter((id) => c.kills?.[id]).length, all: mons.length },
    places: { done: Object.keys(c.places || {}).length, all: PLACE_ZONES.reduce((a, z) => a + zonePlaces(z).length, 0) },
    records: { done: Object.keys(c.journals || {}).length + (c.lore || []).length, all: Object.keys(JOURNALS).length + LORES.length },
    people: { done: Object.values(PEOPLE).filter((p) => s.story?.flags?.[p.steps[p.steps.length - 1]]).length, all: Object.keys(PEOPLE).length },
    fish: { done: Object.keys(s.fishLog || {}).filter((id) => FISH[id]).length, all: Object.keys(FISH).length },
    artifacts: { done: Object.keys(s.artifacts || {}).filter((id) => ARTIFACTS[id]).length, all: Object.keys(ARTIFACTS).length },
  };
}

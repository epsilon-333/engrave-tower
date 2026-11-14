// 저장 데이터 (지금은 브라우저 저장, 나중에 서버 계정으로 옮길 수 있게 순수 JSON)
import { spiritLevel } from './data/spirits.js';
import { pointsAt } from './data/races.js';
import { codexPoints, levelFor } from './data/codex.js';
import { newStory } from './data/story.js';
import { ZONES, MONSTERS, ECHOES } from './data/monsters.js';
import { newClock } from './sim/time.js';
import { CLASSES, SKILLS, ENGRAVING_SKILLS, RACE_CLASSES } from './data/skills.js';
import { ENGRAVINGS } from './data/engravings.js';
import { LV_GRADE } from './data/skillengs.js';

const KEY = 'engrave-tower-save-v1';

export function newSave(race) {
  return {
    v: 1, gated: 1, race, level: 1, xp: 0, points: 0, alloc: {}, gold: 30, // gated: 탑을 올라 지역 · 체계를 해방한다 (data/unlocks.js)
    echoes: {}, owned: {}, slots: {}, items: ['rustySword'], gear: { weapon: 'rustySword' },
    codex: { kills: {}, echoes: {}, reactions: {}, condSeen: {}, places: {}, journals: {}, lore: [] },
    story: newStory(),
    runs: 0, seed: (Date.now() % 1e9) | 0,
    time: newClock(), effects: [], learned: [], abilities: {}, crafted: {}, chest: {}, bagCap: 30, dishLog: {}, quickFood: null,
    ...newLife(),
  };
}
// 생활: 가방 · 도구(처음엔 낡은 도구 한 벌) · 캔 자리 · 벤 나무 · 밭 · 물고기 기록 · 유물
export function newLife() {
  return { bag: {}, tools: { pickaxe: 1, axe: 1, shovel: 1, hoe: 1, can: 1, rod: 1 }, nodes: {}, chopped: {}, farm: {}, fishLog: {}, artifacts: {}, farmOpts: {} };
}

// 저장 백업: 10분마다 이전 저장을 두 칸(b1 → b2)에 돌려 둔다. 본 저장이 깨지면 백업에서 되살린다
const BACKUPS = [KEY + '-b1', KEY + '-b2'];
let lastBackup = 0;
export function loadSave() {
  for (const k of [KEY, ...BACKUPS]) {
    try { const s = localStorage.getItem(k); if (!s) continue; const v = JSON.parse(s); if (v && typeof v === 'object' && v.race) { if (k !== KEY) console.warn('저장이 깨져 백업에서 되살렸다:', k); return v; } } catch { /* 깨진 칸: 다음 백업으로 */ }
  }
  return null;
}
let saveHook = null;
export function setSaveHook(f) { saveHook = f; }
// 같은 브라우저의 창끼리: 누가 더 새 진행을 저장했는지 알린다 (옛 창이 서버를 덮어쓰지 않게)
const TAB = Math.random().toString(36).slice(2);
let chan = null; try { chan = new BroadcastChannel('et-save'); chan.unref?.(); } catch { /* 지원 안 함 */ }
let staleHook = null;
let stale = false; // 다른 창이 더 새 진행을 저장했다: 이 창은 더 쓰지 않는다
let myAcct = ''; // 이 창이 쓰는 저장의 계정 (다른 계정 · 게스트 창이 저장했다고 이 창을 멈추지 않게)
export function setStaleHook(f) { staleHook = f; if (chan) chan.onmessage = (m) => { if (m.data?.tab !== TAB && m.data?.t === 'saved' && (m.data.acct || '') === myAcct && !stale) { stale = true; staleHook?.(); } }; }
export let localSaveError = null; // 브라우저 저장소가 꽉 찼는지 (조용히 실패하지 않게)
const saveListeners = new Set();
export function onLocalSave(f) { saveListeners.add(f); } // 저장할 때마다 실패 여부를 알린다 (화면에 띄우기용)
export const isStale = () => stale;
// 브라우저가 공간이 모자랄 때 이 사이트의 저장을 지우지 않게 요청한다 (크롬 · 사파리 · 파이어폭스)
try { navigator.storage?.persist?.().catch(() => {}); } catch { /* 무시 */ }
export function writeSave(s) {
  if (stale) return;
  s.updatedAt = Date.now();
  saveHook?.(s); // 서버 저장 (계정 표시 s.acct도 여기서 붙는다)
  myAcct = s.acct || '';
  try {
    if (Date.now() - lastBackup > 10 * 60 * 1000) { // 백업 돌리기 (지금 칸 → b1 → b2)
      lastBackup = Date.now();
      const cur = localStorage.getItem(KEY), b1 = localStorage.getItem(BACKUPS[0]);
      if (b1) localStorage.setItem(BACKUPS[1], b1);
      if (cur) localStorage.setItem(BACKUPS[0], cur);
    }
  } catch { /* 저장소가 꽉 찼으면 백업은 건너뛴다 */ }
  const json = JSON.stringify(s);
  try { localStorage.setItem(KEY, json); localSaveError = null; }
  catch (e) { // 저장 공간이 모자라면 백업 칸을 비우고 한 번 더 (본 저장이 먼저)
    try { for (const k of BACKUPS) localStorage.removeItem(k); localStorage.setItem(KEY, json); localSaveError = null; }
    catch (e2) { localSaveError = e2?.name || 'error'; }
  }
  saveListeners.forEach((f) => f(localSaveError));
  try { chan?.postMessage({ t: 'saved', tab: TAB, acct: myAcct }); } catch { /* 무시 */ }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); for (const k of BACKUPS) localStorage.removeItem(k); } catch { /* 무시 */ }
}

export function toLoadout(s) {
  return { race: s.race, level: s.level, alloc: s.alloc, engravings: s.slots, gear: s.gear, skills: s.skills, cls: s.cls, engLv: s.engLv, sanctum: s.sanctum, reinforce: s.reinforce, learned: s.learned, abilities: s.abilities, spirit: s.race === 'elf' && s.spirits?.main ? { /* 정령은 엘프만 */ id: s.spirits.main, star: s.spirits.owned?.[s.spirits.main]?.star || 1, lv: spiritLevel(s.spirits.owned?.[s.spirits.main]?.xp) } : null, spirits2: s.cls === 'spiritcaller' ? (s.spirits?.extra || []).filter((id) => s.spirits.owned?.[id] && id !== s.spirits.main).slice(0, 2).map((id) => ({ id, star: s.spirits.owned[id].star || 1, lv: spiritLevel(s.spirits.owned[id].xp) })) : [], train: Object.fromEntries(Object.entries(s.story?.sanct || {}).map(([r, v]) => [r, v.train || 0])) };
}

// 사냥 결과 반영. keep = 잔향 보존 비율
export function applyRun(s, loot, keep, discovered) {
  const kept = {};
  for (const [id, n] of Object.entries(loot.echoes)) {
    const k = keep >= 1 ? n : Math.floor(n * keep);
    if (k > 0) { kept[id] = k; s.echoes[id] = (s.echoes[id] || 0) + k; }
    s.codex.echoes[id] = true;
  }
  for (const r of discovered) s.codex.reactions[r] = true;
  const gold = Math.floor(loot.gold * (keep >= 1 ? 1 : keep));
  s.gold += gold;
  const ups = syncLevel(s);
  s.runs++;
  s.seed = (s.seed * 1103515245 + 12345) & 0x7fffffff;
  return { kept, gold, ups };
}

// 도감 점수로 레벨을 맞춘다 (레벨은 내려가지 않는다). 오른 만큼 스탯 포인트를 준다
export function syncLevel(s) {
  s.codex ||= {}; s.story ||= newStory();
  const { level } = levelFor(codexPoints(s));
  let ups = 0;
  while (s.level < level) { s.level++; s.points += pointsAt(s.level) - pointsAt(s.level - 1); ups++; }
  grantClassEngravings(s);
  return ups;
}

// 내 클래스 스킬 각인은 레벨업으로 얻는다: 스킬이 열리는 레벨(unlock)에 그 스킬을 단 각인 하나를 준다
// 고르는 각인: 몬스터 부산물(m_)보다 원래 각인, 그중 낮은 등급. 스킬마다 한 번만 (s.classEng에 적어 둔다)
export function classEngravingFor(skillId) {
  const L = Object.keys(ENGRAVING_SKILLS).filter((e) => ENGRAVING_SKILLS[e] === skillId && ENGRAVINGS[e]);
  const want = (SKILLS[skillId]?.unlock || 1) <= 1 ? 1 : LV_GRADE(SKILLS[skillId]); // 받는 레벨에 맞는 등급
  L.sort((a, b) => (!!ENGRAVINGS[b].start - !!ENGRAVINGS[a].start) || (Math.abs(ENGRAVINGS[a].grade - want) - Math.abs(ENGRAVINGS[b].grade - want)) || (!!ENGRAVINGS[b].lvEng - !!ENGRAVINGS[a].lvEng) || (a.startsWith('m_') - b.startsWith('m_')) || (ENGRAVINGS[a].grade - ENGRAVINGS[b].grade)); // 종족 시작 각인 → 등급이 맞는 것
  return L[0] || null;
}
// 클래스는 없다: 종족의 스킬(예전 두 클래스의 것 모두)이 그 레벨이 되면 각인으로 온다 · 1레벨 넷이 시작 각인
export const raceSkills = (race) => [...new Set(RACE_CLASSES(race).flatMap((c) => CLASSES[c].skills))];
export function grantClassEngravings(s) {
  if (!RACE_CLASSES(s.race).length) return [];
  s.owned ||= {}; s.classEng ||= {};
  const got = [];
  for (const sk of raceSkills(s.race)) {
    if (!SKILLS[sk] || s.classEng[sk] || (SKILLS[sk].unlock || 1) > (s.level || 1)) continue;
    const eid = classEngravingFor(sk); if (!eid) continue;
    s.classEng[sk] = eid;
    if ((s.owned[eid] || 0) > 0) continue; // 이미 가진 각인은 또 주지 않는다 (같은 각인은 하나만)
    s.owned[eid] = 1;
    got.push(eid);
  }
  if (got.length) (s.newEng ||= []).push(...got); // 화면에 알릴 것 (보여 주고 비운다)
  return got;
}

// ───── 의뢰 (광장 게시판) ─────

export function refreshQuests(s, seedBump = 0) {
  s.quests ||= [];
  let r = (s.seed + s.runs * 977 + seedBump * 31 + s.quests.length * 13) >>> 0;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const zones = ZONES.filter((z) => z.rec <= s.level + 3);
  let guard = 0;
  while (s.quests.length < 3 && guard++ < 50) {
    const z = zones[Math.floor(rnd() * zones.length)];
    const kind = ['kill', 'kill', 'echo', 'chest', 'explore'][Math.floor(rnd() * 5)];
    const f = z.floor;
    let q;
    if (kind === 'kill') { const m = z.pool[Math.floor(rnd() * z.pool.length)]; q = { kind, zone: z.id, target: m, n: 6 + Math.floor(rnd() * 6), text: `${MONSTERS[m].name} 처치` }; }
    else if (kind === 'echo') { const m = z.pool[Math.floor(rnd() * z.pool.length)]; const e = MONSTERS[m].echo.id; q = { kind, zone: z.id, target: e, n: 3 + Math.floor(rnd() * 3), text: `${ECHOES[e].name} 가져오기` }; }
    else if (kind === 'chest') q = { kind, zone: z.id, n: 2 + Math.floor(rnd() * 2), text: `${z.name}의 보물 상자 열기` };
    else q = { kind, zone: z.id, n: 50 + Math.floor(rnd() * 4) * 10, text: `${z.name} 탐험률 달성` };
    if (s.quests.some((o) => o.kind === q.kind && o.target === q.target && o.zone === q.zone)) continue;
    q.id = `${Date.now().toString(36)}${Math.floor(rnd() * 1e6)}`;
    q.progress = 0;
    q.reward = { gold: Math.round((40 * f + Math.floor(rnd() * 10) * f) * 0.65) };
    s.quests.push(q);
  }
}

export function progressQuests(s, run) {
  for (const q of s.quests || []) {
    if (q.done || q.zone !== run.zone) continue;
    if (q.kind === 'kill') q.progress += run.kills[q.target] || 0;
    if (q.kind === 'echo') q.progress += run.kept[q.target] || 0;
    if (q.kind === 'chest') q.progress += run.chests;
    if (q.kind === 'explore') q.progress = Math.max(q.progress, Math.round(run.explored * 100));
    if (q.progress >= q.n) { q.progress = q.n; q.done = true; }
  }
}

export function claimQuest(s, id) {
  const i = (s.quests || []).findIndex((q) => q.id === id && q.done);
  if (i < 0) return null;
  const q = s.quests[i];
  s.quests.splice(i, 1);
  s.gold += q.reward.gold;
  s.questsDone = (s.questsDone || 0) + 1; // CC 기술 미션
  refreshQuests(s, 1);
  return { q, ups: 0 };
}

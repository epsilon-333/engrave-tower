// 저장 데이터 (지금은 브라우저 저장, 나중에 서버 계정으로 옮길 수 있게 순수 JSON)
import { POINTS_PER_LEVEL, xpToNext, RACES } from './data/races.js';
import { ZONES, MONSTERS, ECHOES } from './data/monsters.js';

const KEY = 'engrave-tower-save-v1';

export function newSave(race) {
  return {
    v: 1, race, level: 1, xp: 0, points: 0, alloc: {}, gold: 30,
    echoes: {}, owned: {}, slots: {}, items: ['rustySword'], gear: { weapon: 'rustySword' },
    codex: { kills: {}, echoes: {}, reactions: {}, condSeen: {} },
    runs: 0, seed: (Date.now() % 1e9) | 0,
  };
}

export function loadSave() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
let saveHook = null;
export function setSaveHook(f) { saveHook = f; }
export function writeSave(s) {
  s.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 불가 환경 */ }
  saveHook?.(s);
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

export function toLoadout(s) {
  return { race: s.race, level: s.level, alloc: s.alloc, engravings: s.slots, gear: s.gear, skills: s.skills };
}

// 사냥 결과 반영. keep = 잔향 보존 비율
export function applyRun(s, loot, keep, discovered) {
  const kept = {};
  for (const [id, n] of Object.entries(loot.echoes)) {
    const k = keep >= 1 ? n : Math.floor(n * keep);
    if (k > 0) { kept[id] = k; s.echoes[id] = (s.echoes[id] || 0) + k; }
    s.codex.echoes[id] = true;
  }
  for (const [id, n] of Object.entries(loot.kills)) s.codex.kills[id] = (s.codex.kills[id] || 0) + n;
  for (const r of discovered) s.codex.reactions[r] = true;
  const gold = Math.floor(loot.gold * (keep >= 1 ? 1 : keep));
  s.gold += gold;
  s.xp += loot.xp;
  let ups = 0;
  while (s.xp >= xpToNext(s.level)) { s.xp -= xpToNext(s.level); s.level++; s.points += POINTS_PER_LEVEL + (RACES[s.race].bonusPoints || 0); ups++; }
  s.runs++;
  s.seed = (s.seed * 1103515245 + 12345) & 0x7fffffff;
  return { kept, gold, xp: loot.xp, ups };
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
    q.reward = { gold: 25 * f + Math.floor(rnd() * 10) * f, xp: 15 * f };
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
  s.xp += q.reward.xp;
  let ups = 0;
  while (s.xp >= xpToNext(s.level)) { s.xp -= xpToNext(s.level); s.level++; s.points += POINTS_PER_LEVEL + (RACES[s.race].bonusPoints || 0); ups++; }
  refreshQuests(s, 1);
  return { q, ups };
}

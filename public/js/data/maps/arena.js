// 연습 실험장: 넓고 밝은 돌바닥 방 (기둥 몇 개). 연습 모드에서 고른 적을 불러 스킬 · 무기를 시험한다.
import { T_FLOOR, T_WALL } from '../../sim/mapgen.js';

export const ARENA_ZONE = {
  id: 'arena', name: '연습 실험장', floor: 1, rec: 1, pal: ['#4a4a56', '#52525e', '#44444e'], wall: ['#1a1a22', '#3a3a48', '#5a5a6a'],
  liquid: 'water', liquidPal: ['#1d4a5a', '#2a6a7a'], dark: 0.05, deco: ['pebble'], portal: '#7ad8ff', pool: ['slime'], regions: ['실험장'], elite: 'slime',
};
// 실험할 상대: [몬스터, 수] 묶음
export const ARENA_SETS = {
  weak: { name: '약한 몬스터 무리', list: [['slime', 8], ['bat', 6], ['goblin', 6], ['mossSlug', 4]], note: '무리를 한꺼번에 쓸어 보는 곳' },
  tank1: { name: '체력 높은 적 하나', list: [['ogreTarget', 1]], note: '단일 대상 피해를 길게 재 보는 곳' },
  tankN: { name: '체력 높은 적 여럿', list: [['boneTarget', 5]], note: '범위 스킬로 여러 단단한 적을 함께' },
  hitters: { name: '공격력 높은 적', list: [['bruiser', 4]], note: '막기 · 회피 · 보호막 · 받아치기를 시험' },
  ranged: { name: '멀리서 쏘는 적', list: [['toad', 3], ['salamander', 2], ['goblinShaman', 2]], note: '접근 · 엄폐 · 투사체 피하기' },
  elite: { name: '정예 우두머리', list: [['frostWitch', 1]], note: '진짜 우두머리와 싸워 보기' },
  dummies: { name: '허수아비 (초당 피해 표시)', list: [['dummy', 1], ['dummyP', 1], ['dummyM', 1]], note: '물리 저항 · 마법 저항이 다른 허수아비' },
  empty: { name: '빈 곳', list: [], note: '아무도 없다' },
};
// 실험용 몬스터 바꾸기 (원래 몬스터를 바탕으로)
export const ARENA_MODS = {
  ogreTarget: { base: 'magmaGolem', hp: 80000, atk: 0.3, label: '튼튼한 표적', boss: true }, // 우두머리 체력바로 보인다
  boneTarget: { base: 'boneGuard', hp: 20000, atk: 0.3, label: '단단한 뼈 방패병' },
  bruiser: { base: 'orcRaider', hpMul: 3, atk: 4, label: '센 주먹 오크' },
};

export function buildArena() {
  const tw = 60, th = 42, t = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) t[y * tw + x] = x < 2 || y < 2 || x >= tw - 2 || y >= th - 2 ? T_WALL : T_FLOOR;
  for (const [px, py] of [[14, 10], [44, 10], [14, 30], [44, 30]]) for (let y = py; y < py + 2; y++) for (let x = px; x < px + 2; x++) t[y * tw + x] = T_WALL; // 기둥
  const deco = [];
  for (let i = 0; i < 60; i++) deco.push({ x: (3 + ((i * 37) % (tw - 6))) * 16 + 8, y: (3 + ((i * 53) % (th - 6))) * 16 + 8, kind: 'pebble', v: i % 3 });
  return {
    tw, th, tiles: t, start: { x: tw / 2 - 2, y: th / 2 }, lair: { x: tw - 4, y: th - 4 }, stairs: null,
    camps: [], champions: [], chests: [], lores: [], secrets: [], deco, regions: null, regionInfo: [{ name: '실험장', types: ['slime'] }],
    camp: [], merchant: [], shrines: [], goblins: [], objects: [], arena: true,
  };
}

// 결투장: 모래를 깐 둥근 투기장 (돌담 · 화로 · 흩어진 뼈). 온라인 결투에서 두 사람만 들어온다.
export const DUEL_ZONE = {
  ...ARENA_ZONE, id: 'duel', name: '결투장', pal: ['#a88a5c', '#b39466', '#9c7f52'], wall: ['#1e1612', '#4a3a2c', '#6e5a44'],
  dark: 0.35, deco: ['pebble'], regions: ['결투장'],
};
export function buildDuelArena() {
  const tw = 36, th = 26, t = new Uint8Array(tw * th), cx = tw / 2, cy = th / 2, rx = tw / 2 - 2.5, ry = th / 2 - 2.5;
  const inside = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) t[y * tw + x] = inside(x, y) ? T_FLOOR : T_WALL;
  const deco = [];
  // 담 안쪽 가장자리에 화로 8개 (빛이 둘레를 밝힌다)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, x = cx + Math.cos(a) * (rx - 1.2), y = cy + Math.sin(a) * (ry - 1.2);
    deco.push({ x: Math.round(x * 16), y: Math.round(y * 16), kind: 'brazier', v: i % 2 });
  }
  // 모래 위 자갈 · 뼈 (가운데는 비워 둔다)
  for (let i = 0; i < 40; i++) {
    const x = 3 + ((i * 37) % (tw - 6)), y = 3 + ((i * 53) % (th - 6));
    if (!inside(x, y) || Math.hypot((x - cx) / rx, (y - cy) / ry) < 0.45) continue;
    deco.push({ x: x * 16 + 8, y: y * 16 + 8, kind: i % 5 === 0 ? 'bone' : 'pebble', v: i % 3 });
  }
  return {
    tw, th, tiles: t, start: { x: cx, y: cy }, lair: { x: cx, y: cy }, stairs: null,
    camps: [], champions: [], chests: [], lores: [], secrets: [], deco, regions: null, regionInfo: [{ name: '결투장', types: [] }],
    camp: [], merchant: [], shrines: [], goblins: [], objects: [], arena: true,
  };
}

// 고른 묶음을 플레이어 둘레에 세운다 (먼저 있던 적 · 적 투사체는 치운다)
export function spawnArenaSet(w, kind) {
  const set = ARENA_SETS[kind] || ARENA_SETS.weak, p = w.player;
  w.enemies = []; w.camps = []; w.projs = w.projs.filter((x) => x.owner === 'p'); w.dmgLog = [];
  const total = set.list.reduce((a, [, k]) => a + k, 0);
  let n = 0;
  for (const [id, cnt] of set.list) for (let i = 0; i < cnt; i++, n++) {
    const mod = ARENA_MODS[id], base = mod ? mod.base : id;
    const a = (n / Math.max(1, total)) * Math.PI * 2, d = total > 6 ? 90 + (n % 3) * 26 : 70 + (n % 2) * 20;
    let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.8;
    if (w.blocked(x, y, 6)) { x = p.x + Math.cos(a) * 50; y = p.y + Math.sin(a) * 40; }
    const e = w.makeEnemy(base, x, y, { noAffix: true });
    if (mod) {
      e.maxHp = e.hp = mod.hp || Math.round(e.maxHp * (mod.hpMul || 1)); e.atk = Math.round(e.atk * (mod.atk ?? 1));
      if (mod.boss) e.champion = mod.label; else e.tag = mod.label; // 우두머리 체력바 또는 머리 위 이름표
    }
    e.home = { x, y };
    w.enemies.push(e);
  }
}

// 보스 레이드: 레이드 제단에서 고르는 거대한 보스 셋. 파티(최대 4명)로 들어가는 둥근 보스방 · 체력이 셋으로 나뉘어 단계마다 패턴이 바뀐다
import { T_FLOOR, T_WALL } from '../sim/mapgen.js';

export const RAIDS = {
  golem: { name: '고대 골렘', boss: 'raidGolem', rec: 15, color: '#c8a86a', desc: '폐허 아래 잠든 돌의 거인. 뛰어올라 내려찍고, 땅을 울려 둘레를 쓸고, 돌 부하를 깨운다.',
    zone: { id: 'raid_golem', name: '고대 골렘의 방', pal: ['#5a5248', '#625a4e', '#544c42'], wall: ['#1a1612', '#3a3228', '#5a4e40'], liquid: 'water', liquidPal: ['#1d4a5a', '#2a6a7a'], dark: 0.3, deco: ['pebble'], portal: '#ffd27a', pool: ['ruinSentinel'], regions: ['고대 골렘의 방'], elite: 'raidGolem', floor: 6 } },
  queen: { name: '서리 여왕', boss: 'raidQueen', rec: 25, color: '#9fe3ff', desc: '얼어붙은 왕좌의 여왕. 얼음비를 내리고, 한 사람을 노려 얼음을 떨어뜨리고, 둘레를 얼린다.',
    zone: { id: 'raid_queen', name: '서리 여왕의 왕좌', pal: ['#4a5666', '#526072', '#46505e'], wall: ['#141c26', '#3a4e66', '#6a88a8'], liquid: 'water', liquidPal: ['#3a6a8a', '#5a8aaa'], dark: 0.35, deco: ['icicle'], portal: '#9fe3ff', pool: ['iceArcher'], regions: ['서리 여왕의 왕좌'], elite: 'raidQueen', floor: 8 } },
  dragon: { name: '화룡왕', boss: 'raidDragon', rec: 35, color: '#ff7a3a', desc: '화산 깊은 곳의 용의 왕. 일직선으로 돌진하고, 불비를 내리고, 체력이 줄면 둘레를 불태운다.',
    zone: { id: 'raid_dragon', name: '화룡왕의 둥지', pal: ['#4a2e26', '#54342a', '#422822'], wall: ['#170c0a', '#3a1f18', '#5a2e22'], liquid: 'lava', liquidPal: ['#ff5a1a', '#ffaa3a'], dark: 0.4, deco: ['ember'], portal: '#ff7a3a', pool: ['lavaLizard'], regions: ['화룡왕의 둥지'], elite: 'raidDragon', floor: 10 } },
};
export const RAID_BOSS = new Set(Object.values(RAIDS).map((r) => r.boss));
// 이번 주 번호 (주간 보물상자)
export const raidWeek = () => Math.floor(Date.now() / (7 * 24 * 3600 * 1000));

// 보스방: 둥근 방 · 둘레에 화로 · 가운데에 보스
export function buildRaidArena() {
  const tw = 44, th = 32, t = new Uint8Array(tw * th), cx = tw / 2, cy = th / 2, rx = tw / 2 - 2.5, ry = th / 2 - 2.5;
  const inside = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) t[y * tw + x] = inside(x, y) ? T_FLOOR : T_WALL;
  const deco = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; deco.push({ x: Math.round((cx + Math.cos(a) * (rx - 1.2)) * 16), y: Math.round((cy + Math.sin(a) * (ry - 1.2)) * 16), kind: 'brazier', v: i % 2 }); }
  return {
    tw, th, tiles: t, start: { x: cx, y: th - 5 }, lair: { x: cx, y: cy - 2 }, stairs: null,
    camps: [], champions: [], chests: [], lores: [], secrets: [], deco, regions: null, regionInfo: [{ name: '보스방', types: [] }],
    camp: [], merchant: [], shrines: [], goblins: [], objects: [], arena: true,
  };
}

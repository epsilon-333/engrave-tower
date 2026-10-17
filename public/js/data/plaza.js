// 중앙 광장: 탑 아래의 큰 홀. 시설·NPC·수련장·의뢰 게시판·사냥터 관문
import { TILE, T_FLOOR, T_WALL, T_BUILD } from '../sim/mapgen.js';
import { ZONES } from './monsters.js';

const at = (tx, ty) => ({ x: tx * TILE + 8, y: ty * TILE + 8 });

export function buildPlaza() {
  const tw = 44, th = 30;
  const t = new Uint8Array(tw * th);
  const set = (x, y, v) => { t[y * tw + x] = v; };
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (x < 1 || y < 3 || x >= tw - 1 || y >= th - 1) set(x, y, T_WALL);
  }
  // 기둥 / 책장 / 게시판 / 모루 (밟을 수 없는 소품)
  const props = [];
  const prop = (kind, tx, ty, w = 1, h = 1) => { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) set(x, y, T_BUILD); props.push({ kind, x: tx, y: ty, w, h }); };
  for (const [x, y] of [[15, 11], [29, 11], [15, 21], [29, 21]]) prop('column', x, y);
  prop('shelf', 3, 21, 3, 1); prop('shelf', 7, 21, 3, 1);
  prop('board', 21, 7, 2, 1);
  prop('anvil', 36, 6, 1, 1);
  prop('crate', 40, 4, 1, 1); prop('crate', 41, 4, 1, 1); prop('crate', 41, 5, 1, 1);
  prop('altarStone', 5, 6, 3, 1);

  const station = (kind, tx, ty, label, panel, name) => ({ kind: 'station', station: kind, ...at(tx, ty), label, panel, npc: { name } });
  const objects = [
    station('altar', 6, 8, '공명 제단 · 각인 새기기', 'altar', '각인사 루네'),
    station('shop', 38, 7, '대장간 · 장비', 'shop', '대장장이 브론'),
    station('library', 6, 23, '서고 · 도감', 'codex', '사서 에일'),
    station('trainer', 35, 20, '수련 교관 · 스탯 배분', 'char', '교관 가르'),
    station('board', 24, 8, '의뢰 게시판', 'quest', '의뢰인 마르코'),
  ];
  ZONES.forEach((z, i) => {
    const tx = 14 + i * 4;
    objects.push({ kind: 'gate', ...at(tx, 3), x: tx * TILE + 16, door: tx, zone: z.id, label: `${z.floor}층 ${z.name} (권장 Lv ${z.rec})`, color: z.portal });
  });

  const dummies = [['dummy', 32, 25], ['dummyP', 35, 25], ['dummyM', 38, 25]].map(([id, x, y]) => ({ id, ...at(x, y) }));

  // 벽 장식 (북쪽 벽면 y=2)
  const wallDeco = [];
  for (const x of [3, 9, 12, 32, 35, 40]) wallDeco.push({ kind: 'torch', x, y: 2 });
  for (const [x, c] of [[5, 'red'], [8, 'blue'], [33, 'green'], [37, 'yellow']]) wallDeco.push({ kind: 'banner', x, y: 2, c });
  wallDeco.push({ kind: 'fountain', x: 6, y: 2, c: 'red' });
  wallDeco.push({ kind: 'fountain', x: 11, y: 2, c: 'blue' });
  wallDeco.push({ kind: 'fountain', x: 34, y: 2, c: 'blue' });
  wallDeco.push({ kind: 'rack', x: 38, y: 2 });

  const deco = [];
  const rugs = [{ x: 2, y: 4, w: 9, h: 7, c: '#5a2a4a' }, { x: 34, y: 4, w: 8, h: 6, c: '#5a3a1a' }, { x: 2, y: 20, w: 9, h: 7, c: '#1e4a3a' }, { x: 30, y: 19, w: 12, h: 9, c: '#3a3a4a' }];
  for (let i = 0; i < 40; i++) {
    const x = 2 + ((i * 7919) % 40), y = 4 + ((i * 104729) % 24);
    if (t[y * tw + x] !== T_FLOOR) continue;
    deco.push({ x: x * TILE + (i * 37) % 12 + 2, y: y * TILE + (i * 53) % 12 + 3, kind: i % 4 ? 'pebble' : 'skullDeco', v: i % 4 });
  }

  return { tw, th, tiles: t, start: { x: 22, y: 17 }, objects, dummies, deco, props, wallDeco, rugs, rune: at(22, 15), plaza: true };
}

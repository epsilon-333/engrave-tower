// 마을의 집: 바깥 모습(종류 · 크기)과 안쪽 방(가구 · 벽 장식 · 주인 NPC). 문으로 들어가고, 아래쪽 문으로 나온다.
// 방: 맨 위 줄은 벽 윗면, 1~2줄은 뒷벽(벽면 장식), 양옆 · 맨 아래 줄은 벽, 아래 가운데 두 칸이 문.
import { TILE, T_FLOOR, T_WALL, T_BUILD } from '../../sim/mapgen.js';

export const HOUSES = {
  altar: { name: '공명 제단', owner: '각인사 루네', panel: 'altar', station: 'altar', label: '각인사 루네와 이야기 · 각인 새기기', w: 6, h: 4, floor: 'darkwood', wall: 'violet' },
  library: { name: '서고', owner: '사서 에일', panel: 'codex', station: 'library', label: '사서 에일과 이야기 · 도감', w: 6, h: 4, floor: 'wood', wall: 'green' },
  guild: { name: '의뢰소', owner: '의뢰인 마르코', panel: 'quest', station: 'board', label: '의뢰인 마르코와 이야기 · 의뢰', w: 6, h: 4, floor: 'wood', wall: 'cream' },
  forge: { name: '대장간', owner: '대장장이 브론', panel: 'shop', station: 'shop', label: '대장장이 브론과 이야기 · 장비 · 제작 · 강화', w: 7, h: 4, floor: 'stone', wall: 'brick' },
  shop: { name: '잡화점', owner: '잡화점 주인 토비', panel: 'trade', station: 'store', label: '잡화점 주인 토비와 이야기 · 사고팔기', w: 6, h: 4, floor: 'wood', wall: 'cream' },
  dojo: { name: '수련장', owner: '교관 가르', panel: 'char', station: 'trainer', label: '교관 가르와 이야기 · 스탯 배분 · 기술 배우기', w: 7, h: 4, floor: 'tatami', wall: 'wood' },
  home: { name: '내 집', owner: '나', w: 6, h: 4, floor: 'wood', wall: 'cream', mine: true },
};

const at = (tx, ty, oy = 8) => ({ x: tx * TILE + 8, y: ty * TILE + oy });

export function buildHouse(kind) {
  const H = HOUSES[kind];
  const tw = kind === 'forge' || kind === 'dojo' ? 16 : 14, th = kind === 'library' || kind === 'dojo' ? 11 : 10;
  const t = new Uint8Array(tw * th), cx = tw >> 1;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) t[y * tw + x] = y <= 2 || x === 0 || x === tw - 1 || y === th - 1 ? T_WALL : T_FLOOR;
  t[(th - 1) * tw + cx - 1] = T_FLOOR; t[(th - 1) * tw + cx] = T_FLOOR; // 문
  const props = [], wallDeco = [], rugs = [], objects = [], dummies = [];
  const prop = (k, x, y, w = 1, h = 1, extra = {}) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) t[yy * tw + xx] = T_BUILD; props.push({ kind: k, x, y, w, h, ...extra }); };
  const deco = (k, x, w, extra = {}) => wallDeco.push({ kind: k, x, w, ...extra });
  let npc = { x: cx, y: 5 };

  if (kind === 'forge') {
    prop('furnace', 2, 3, 4, 2); deco('chimney', 2, 4);
    prop('anvil', 7, 5, 2, 1); prop('quench', 2, 7, 2, 1);
    prop('oreCrate', 11, 3, 2, 1); prop('barrel', 13, 3); prop('barrel', 14, 3); prop('coalPile', 13, 7, 2, 1);
    deco('weaponRack', 7, 4); deco('toolRack', 11, 4); deco('window', 9, 1);
    npc = { x: 8, y: 6.3 };
  } else if (kind === 'altar') {
    deco('runeArch', 5, 4); prop('runeAltar', 6, 3, 2, 2);
    prop('candles', 4, 3); prop('candles', 9, 3);
    prop('bookshelf', 1, 3, 2, 1); prop('bookshelf', 11, 3, 2, 1);
    prop('plant', 1, 7); prop('plant', 12, 7); deco('window', 3, 1); deco('window', 10, 1);
    rugs.push({ x: 4, y: 5, w: 6, h: 3, c: '#4a2a5a', trim: '#c8a0ff' });
    npc = { x: 7, y: 5.6 };
  } else if (kind === 'library') {
    prop('bookshelf', 1, 3, 3, 1); prop('bookshelf', 5, 3, 4, 1); prop('bookshelf', 10, 3, 3, 1);
    prop('desk', 5, 6, 4, 1, { books: true }); prop('globe', 11, 7); prop('table', 2, 8, 2, 1); prop('plant', 12, 9);
    deco('clock', 9, 1); deco('window', 4, 1);
    rugs.push({ x: 4, y: 7, w: 6, h: 3, c: '#2a4a3a', trim: '#e8d8a0' });
    npc = { x: 7, y: 5.0 };
  } else if (kind === 'guild') {
    deco('questBoard', 2, 4); deco('mapScroll', 9, 3);
    prop('desk', 5, 5, 4, 1, { papers: true }); prop('chair', 4, 7); prop('chair', 9, 7);
    prop('bench', 1, 7, 2, 1); prop('barrel', 12, 3); prop('plant', 12, 7);
    rugs.push({ x: 4, y: 6, w: 6, h: 2, c: '#5a3a24', trim: '#e8c070' });
    npc = { x: 7, y: 4.0 };
  } else if (kind === 'shop') {
    prop('goodsShelf', 1, 3, 3, 1); prop('seedRack', 5, 3, 4, 1); prop('goodsShelf', 10, 3, 3, 1);
    prop('counter', 4, 5, 6, 1); prop('sacks', 1, 6, 2, 1); prop('barrel', 12, 6); prop('crate', 11, 7); prop('crate', 12, 7);
    deco('window', 9, 1); deco('sign', 4, 1);
    npc = { x: 7, y: 4.0 };
  } else if (kind === 'home') {
    // 내 집: 침대(잠) · 부엌(요리) · 보관함(물건 맡기기) · 작업대(무기 만들기)
    prop('bed', 1, 3, 2, 2); prop('nightstand', 3, 3);
    prop('storage', 5, 3, 2, 1);
    prop('stove', 9, 3, 2, 1); prop('kitchen', 11, 3, 2, 1);
    deco('hood', 9, 2); deco('shelf', 11, 2); deco('window', 6, 1); deco('painting', 3, 1);
    prop('table', 6, 6, 2, 1); prop('chair', 5, 6); prop('chair', 8, 6);
    prop('workbench', 10, 7, 2, 1); prop('woodpile', 12, 7);
    prop('plant', 1, 8); prop('barrel', 12, 8);
    rugs.push({ x: 4, y: 5, w: 6, h: 3, c: '#7a3a2a', trim: '#e8c070' });
    objects.push({ kind: 'station', station: 'bed', ...at(2, 5, 4), label: '침대 · 잠자기', reach: 24 });
    objects.push({ kind: 'station', station: 'chest', panel: 'storage', ...at(6, 4, 6), label: '보관함 · 물건 넣고 빼기', reach: 24 });
    objects.push({ kind: 'station', station: 'stove', panel: 'cook', ...at(10, 4, 6), label: '부엌 · 요리하기', reach: 24 });
    objects.push({ kind: 'station', station: 'bench', panel: 'craft', ...at(11, 8, 6), label: '작업대 · 무기 만들기', reach: 24 });
    npc = null;
  } else if (kind === 'dojo') {
    deco('weaponRack', 2, 4); deco('banner', 8, 1, { c: '#b83a3a' }); deco('banner', 13, 1, { c: '#3a5ab8' }); deco('window', 10, 2);
    prop('bench', 1, 8, 3, 1); prop('plant', 14, 9);
    rugs.push({ x: 8, y: 4, w: 7, h: 4, c: '#3a4a2a', trim: '#c8c090', mat: true });
    for (const [id, x] of [['dummy', 9], ['dummyP', 11.5], ['dummyM', 14]]) dummies.push({ id, ...at(x, 6, 4) });
    npc = { x: 4, y: 5 };
  }
  if (npc) objects.push({ kind: 'station', station: H.station, ...at(npc.x, npc.y), label: H.label, panel: H.panel, npc: { name: H.owner }, reach: 40 });
  objects.push({ kind: 'exit', x: cx * TILE, y: (th - 1) * TILE + 6, label: '밖으로 나가기', reusable: true });
  return { tw, th, tiles: t, start: { x: cx - 0.5, y: th - 2 }, objects, dummies, deco: [], props, wallDeco, rugs, indoor: true, house: kind, floorStyle: H.floor, wallStyle: H.wall, plaza: false };
}

// 항해: 배 갑판 위를 걸어 다니며 간다. 둘레는 바다(난간으로 막힘), 돛대 둘 · 짐 상자 · 선장 · 선원 · 상인 정보원.
// 동쪽(오른쪽)이 뱃머리. 바다 물결은 렌더러가 뒤로(왼쪽으로) 흘려 배가 나아가는 것처럼 보인다.
import { T_FLOOR, T_WALL, T_LIQUID } from '../../sim/mapgen.js';

export const SHIP_ZONE = {
  id: 'ship', name: '항해 중', floor: 1, rec: 1, pal: ['#8a6440', '#946c46', '#7c5a3a'], wall: ['#24160c', '#5a3a22', '#7a5232'],
  liquid: 'water', liquidPal: ['#1d5a86', '#3a8cc0'], dark: 0, deco: ['pebble'], portal: '#7ad8ff', pool: ['bandit'], regions: ['갑판'], elite: 'bandit',
};

export function buildShipDeck() {
  const tw = 52, th = 26, t = new Uint8Array(tw * th).fill(T_LIQUID);
  const cy = 12.5;
  // 갑판 모양: 고물(왼쪽)은 네모, 이물(오른쪽)은 뾰족하게
  const half = (x) => (x < 38 ? 6 : Math.max(0, 6 - (x - 38) * 0.75));
  const inside = (x, y) => x >= 9 && x <= 45 && Math.abs(y + 0.5 - cy) <= half(x);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    t[y * tw + x] = edge ? T_WALL : T_FLOOR; // 난간
  }
  const props = [];
  const block = (kind, x, y, w = 1, h = 1, extra = {}) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) t[yy * tw + xx] = T_WALL; props.push({ kind, x, y, w, h, ...extra }); };
  block('mast', 20, 12, 1, 1, { sail: 'main' });
  block('mast', 32, 12, 1, 1, { sail: 'fore' });
  block('crate', 13, 9); block('crate', 14, 9); block('crate', 13, 16); block('barrelProp', 26, 8); block('barrelProp', 27, 8); block('crate', 38, 15);
  const at = (x, y) => ({ x: x * 16 + 8, y: y * 16 + 8 });
  const objects = [
    { kind: 'npc', id: 'ship_captain', art: 'shipCaptain', ...at(11, 12), label: '선장과 이야기 · 남은 뱃길', reusable: true },
    { kind: 'npc', id: 'ship_sailor', art: 'sailor', ...at(25, 15), label: '선원과 이야기 · 소문', reusable: true },
    { kind: 'npc', id: 'ship_info', art: 'infoMerchant', ...at(36, 10), label: '상인 정보원과 이야기 · 시세 소식', reusable: true },
  ];
  // 해적이 올라타는 자리: 위 · 아래 난간 안쪽
  const board = [];
  for (let x = 14; x <= 38; x += 4) board.push(at(x, 8), at(x, 17));
  return {
    tw, th, tiles: t, start: { x: 22, y: 14 }, lair: { x: 40, y: 12 }, stairs: null, props,
    camps: [], champions: [], chests: [], lores: [], secrets: [], deco: [], regions: null, regionInfo: [{ name: '갑판', types: ['bandit'], lv: [8, 12] }],
    camp: [], merchant: [], shrines: [], goblins: [], objects, arena: true, ship: true, board,
  };
}

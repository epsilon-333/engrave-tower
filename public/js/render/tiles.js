// 맵 전체를 한 장의 캔버스로 미리 그린다 (0x72 타일 + 지역 색조)
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD } from '../sim/mapgen.js';
import { sprite } from './assets.js';
import { ZONE_TINT } from '../data/art.js';

export function hash(x, y, s = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

const FLOORS = [...Array(20).fill('floor_1'), ...Array(8).fill('floor_5'), 'floor_2', 'floor_3', 'floor_3', 'floor_4', 'floor_6', 'floor_7', 'floor_8'];
const VOID = '#1c1720';

export function renderMap(world) {
  const { tw, th, tiles } = world;
  const z = world.zone;
  const raw = document.createElement('canvas');
  raw.width = tw * TILE; raw.height = th * TILE;
  const g = raw.getContext('2d');
  g.imageSmoothingEnabled = false;
  const at = (x, y) => (x < 0 || y < 0 || x >= tw || y >= th ? T_WALL : tiles[y * tw + x]);
  const solid = (t) => t === T_WALL || t === T_CRACK;
  const open = (t) => !solid(t);
  const face = (x, y) => solid(at(x, y)) && open(at(x, y + 1));
  const put = (name, x, y) => { const s = sprite(name); if (s) g.drawImage(s, x, y); };

  g.fillStyle = VOID; g.fillRect(0, 0, raw.width, raw.height);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const t = at(x, y), px = x * TILE, py = y * TILE;
    if (open(t)) {
      const h = hash(x, y);
      put(FLOORS[h % FLOORS.length], px, py);
    } else if (face(x, y)) {
      const l = open(at(x - 1, y)), r = open(at(x + 1, y));
      const h = hash(x, y, 3);
      let name = l && !r ? 'wall_left' : r && !l ? 'wall_right' : 'wall_mid';
      if (name === 'wall_mid' && !world.map.plaza && h % 11 === 0) name = h % 2 ? 'wall_hole_1' : 'wall_hole_2';
      if (name === 'wall_mid' && z && z.id === 'swamp' && h % 7 === 0) name = 'wall_goo';
      put(name, px, py);
      if (t === T_CRACK) crackLines(g, px, py);
    } else {
      // 벽 윗면: 바로 아래가 벽면이면 윗단(캡) 표시
      if (face(x, y + 1)) put('wall_top_mid', px, py);
      if (t === T_CRACK) crackLines(g, px, py);
    }
  }
  // 바닥 그림자 + 벽 테두리 (밝은 돌 테두리)
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const t = at(x, y), px = x * TILE, py = y * TILE;
    if (open(t)) {
      if (face(x, y - 1)) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(px, py, TILE, 4); }
      if (solid(at(x - 1, y)) && !face(x - 1, y)) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py, 3, TILE); }
      continue;
    }
    if (face(x, y)) continue;
    g.fillStyle = '#8f8070';
    if (open(at(x + 1, y))) g.fillRect(px + TILE - 2, py, 2, TILE);
    if (open(at(x - 1, y))) g.fillRect(px, py, 2, TILE);
    if (open(at(x, y - 1))) g.fillRect(px, py, TILE, 2);
    g.fillStyle = '#5e5248';
    if (open(at(x + 1, y))) g.fillRect(px + TILE - 3, py, 1, TILE);
    if (open(at(x - 1, y))) g.fillRect(px + 2, py, 1, TILE);
  }

  if (world.map.plaza) plazaStatic(g, world.map);
  for (const d of world.map.deco) drawDeco(g, d);

  if (!z) return raw;
  const out = document.createElement('canvas');
  out.width = raw.width; out.height = raw.height;
  const og = out.getContext('2d');
  og.filter = ZONE_TINT[z.id] || 'none';
  og.drawImage(raw, 0, 0);
  og.filter = 'none';
  // 물·용암은 색조 없이 원래 색으로
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (at(x, y) === T_LIQUID) liquid(og, x * TILE, y * TILE, x, y, z, at);
  return out;
}

function crackLines(g, px, py) {
  g.fillStyle = '#0d0b10';
  const cx = px + 7;
  g.fillRect(cx, py + 3, 1, 4); g.fillRect(cx - 1, py + 6, 1, 4); g.fillRect(cx, py + 9, 1, 4); g.fillRect(cx + 1, py + 12, 1, 4);
  g.fillRect(cx - 4, py + 8, 3, 1); g.fillRect(cx + 2, py + 11, 3, 1);
  g.fillStyle = 'rgba(255,220,140,0.55)';
  g.fillRect(cx + 1, py + 4, 1, 2); g.fillRect(cx, py + 10, 1, 2); g.fillRect(cx - 3, py + 9, 2, 1);
}

const LIQ = {
  water: ['rgba(40,110,150,0.78)', 'rgba(140,210,240,0.5)'],
  lava: ['rgba(230,80,20,0.92)', 'rgba(255,210,80,0.8)'],
  snow: ['rgba(225,240,255,0.85)', 'rgba(255,255,255,0.9)'],
  mist: ['rgba(90,70,130,0.55)', 'rgba(170,150,220,0.4)'],
};
function liquid(g, px, py, x, y, z, at) {
  const [c0, c1] = LIQ[z?.liquid || 'water'];
  g.fillStyle = c0; g.fillRect(px, py, TILE, TILE);
  for (let i = 0; i < 2; i++) {
    const hh = hash(x, y, i + 20);
    g.fillStyle = c1; g.fillRect(px + (hh % 10), py + 2 + ((hh >> 4) % 12), 3 + (hh >> 9) % 4, 1);
  }
  const edge = (t) => t === T_FLOOR || t === T_BUILD;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  if (edge(at(x, y - 1))) g.fillRect(px, py, TILE, 2);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  if (edge(at(x, y + 1))) g.fillRect(px, py + TILE - 1, TILE, 1);
}

function plazaStatic(g, m) {
  // 양탄자
  for (const r of m.rugs) {
    const x = r.x * TILE + 4, y = r.y * TILE + 4, w = r.w * TILE - 8, h = r.h * TILE - 8;
    g.fillStyle = '#0d0b10'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = r.c; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,220,150,0.35)'; g.strokeStyle = 'rgba(255,220,150,0.35)';
    g.fillRect(x + 3, y + 3, w - 6, 1); g.fillRect(x + 3, y + h - 4, w - 6, 1); g.fillRect(x + 3, y + 3, 1, h - 6); g.fillRect(x + w - 4, y + 3, 1, h - 6);
    for (let i = x + 8; i < x + w - 8; i += 8) { g.fillRect(i, y + 6, 2, 2); g.fillRect(i, y + h - 8, 2, 2); }
  }
  // 깃발 / 무기 거치대
  for (const d of m.wallDeco) {
    const px = d.x * TILE, py = d.y * TILE;
    if (d.kind === 'banner') { const s = sprite(`wall_banner_${d.c}`); if (s) g.drawImage(s, px, py); }
    if (d.kind === 'rack') {
      g.fillStyle = '#4a3020'; g.fillRect(px - 8, py + 3, 48, 2);
      ['weapon_regular_sword', 'weapon_axe', 'weapon_spear', 'weapon_hammer', 'weapon_bow'].forEach((n, i) => {
        const s = sprite(n); if (!s) return;
        const sc = Math.min(1, 14 / s.height);
        g.drawImage(s, px - 6 + i * 9, py + 1, s.width * sc, s.height * sc);
      });
    }
  }
}

function drawDeco(g, d) {
  const { x, y, v } = d;
  const P = (c, dx, dy, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  switch (d.kind) {
    case 'moss': P('#4a7a3a', -2, 0, 4, 1); P('#5f9a48', -1, -1, 2, 1); P('#3a5a2a', 1, 1, 2, 1); break;
    case 'fern': P('#3e7a32', 0, -4, 1, 4); P('#5aa048', -2, -3, 2, 1); P('#5aa048', 1, -2, 2, 1); P('#5aa048', -2, -1, 2, 1); break;
    case 'pebble': P('#0d0b10', -2, -1, 4, 3); P('#7a6a5a', -1, -1, 2, 2); P('#a8988a', -1, -1, 1, 1); break;
    case 'glowshroom': P('#e8e0d0', 0, -2, 1, 3); P('#0d0b10', -2, -4, 5, 2); P(v % 2 ? '#5affd0' : '#8affa0', -1, -4, 3, 1); P('#ffffff', 0, -4, 1, 1); break;
    case 'reed': P('#5a7a2a', 0, -6, 1, 6); P('#4a6a22', 2, -5, 1, 5); P('#8a6a3a', 0, -7, 1, 2); break;
    case 'lily': P('#3a7a3a', -2, 0, 5, 2); P('#e88ab8', 0, -1, 1, 1); break;
    case 'ember': P('#ff7a2a', 0, 0, 2, 1); P('#ffd24a', 0, 0, 1, 1); break;
    case 'bone': case 'skullDeco': { const s = sprite('skull'); if (s && v % 2 === 0) g.drawImage(s, x - 8, y - 12); else { P('#d8d2bf', -3, 0, 6, 1); P('#d8d2bf', -4, -1, 1, 3); P('#d8d2bf', 2, -1, 1, 3); } break; }
    case 'crystalR': P('#0d0b10', -2, -6, 5, 7); P('#ff5a2a', -1, -5, 3, 5); P('#ffb08a', -1, -5, 1, 2); break;
    case 'crystalB': P('#0d0b10', -2, -7, 5, 8); P('#7ad8ff', -1, -6, 3, 6); P('#e8f8ff', -1, -6, 1, 3); break;
    case 'icicle': P('#a8d8f0', -2, -2, 4, 1); P('#c8ecff', -1, -1, 2, 2); break;
    case 'tomb': P('#0d0b10', -4, -9, 9, 10); P('#6a6478', -3, -8, 7, 8); P('#8a849a', -3, -8, 7, 1); P('#4a4458', 0, -6, 1, 4); P('#4a4458', -1, -5, 3, 1); break;
    case 'candle': P('#e8e0c8', 0, -3, 2, 3); P('#ffd24a', 0, -5, 1, 2); break;
  }
}

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
  if (world.map.palace) palaceStatic(og, world.map.palace);
  return out;
}

// 용궁: 붉은 비단길(금빛 테 · 구름무늬)과 용왕의 옥좌
function palaceStatic(g, p) {
  const rug = ([x0, y0, x1, y1]) => {
    const x = x0 * TILE + 3, y = y0 * TILE + 3, w = (x1 - x0 + 1) * TILE - 6, h = (y1 - y0 + 1) * TILE - 6;
    g.fillStyle = '#1a0a0e'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#7a1824'; g.fillRect(x, y, w, h);
    g.fillStyle = '#9a2834'; g.fillRect(x + 2, y + 2, w - 4, h - 4);
    g.fillStyle = '#e8c060'; g.fillRect(x + 3, y + 3, w - 6, 1); g.fillRect(x + 3, y + h - 4, w - 6, 1); g.fillRect(x + 3, y + 3, 1, h - 6); g.fillRect(x + w - 4, y + 3, 1, h - 6);
    g.fillStyle = 'rgba(240,200,110,0.5)';
    for (let yy = y + 9; yy < y + h - 8; yy += 14) for (let xx = x + 8; xx < x + w - 8; xx += 12) { g.fillRect(xx - 2, yy, 5, 1); g.fillRect(xx - 1, yy - 1, 1, 1); g.fillRect(xx + 1, yy - 1, 1, 1); g.fillRect(xx, yy + 1, 1, 1); }
  };
  for (const r of p.rugs) rug(r);
  const tx = p.throne.x * TILE + 8, ty = p.throne.y * TILE + 8;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(tx - 15, ty + 12, 30, 4);
  g.fillStyle = '#1a0a0e'; g.fillRect(tx - 14, ty - 16, 28, 30);
  g.fillStyle = '#b8862e'; g.fillRect(tx - 13, ty - 15, 26, 28);               // 금빛 등받이
  g.fillStyle = '#e8c060'; g.fillRect(tx - 11, ty - 13, 22, 2); g.fillRect(tx - 1, ty - 18, 2, 4); g.fillRect(tx - 4, ty - 17, 8, 2);
  g.fillStyle = '#2a8a6a'; g.fillRect(tx - 2, ty - 10, 4, 4); g.fillStyle = '#8affd8'; g.fillRect(tx - 1, ty - 9, 1, 1); // 비취 구슬
  g.fillStyle = '#7a1824'; g.fillRect(tx - 9, ty - 4, 18, 14);                 // 붉은 방석
  g.fillStyle = '#a8303a'; g.fillRect(tx - 7, ty - 2, 14, 6);
  for (const sx of [-1, 1]) {                                                   // 용머리 팔걸이
    const ax = tx + sx * 13;
    g.fillStyle = '#1a0a0e'; g.fillRect(ax - 3, ty - 2, 6, 12);
    g.fillStyle = '#e8c060'; g.fillRect(ax - 2, ty - 1, 4, 10); g.fillRect(ax - 2 + sx, ty - 3, 4, 3);
    g.fillStyle = '#2a8a6a'; g.fillRect(ax + sx, ty - 2, 1, 1);
  }
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

export function drawDeco(g, d) {
  const { x, y, v } = d;
  const P = (c, dx, dy, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  switch (d.kind) {
    case 'moss': P('#4a7a3a', -2, 0, 4, 1); P('#5f9a48', -1, -1, 2, 1); P('#3a5a2a', 1, 1, 2, 1); break;
    // 바닷속
    case 'kelp': { const hgt = 9 + v * 3; for (let i = 0; i < hgt; i++) { const sx = Math.round(Math.sin(i * 0.5 + v) * 1.2); P('#1e3a1e', sx - 1, -i, 3, 1); P(i % 3 ? '#3a7a3a' : '#4e9a48', sx, -i, 1, 1); } for (let i = 2; i < hgt; i += 3) { const sx = Math.round(Math.sin(i * 0.5 + v) * 1.2); P('#5aaa50', sx + 1, -i, 2, 1); P('#5aaa50', sx - 2, -i - 1, 2, 1); } break; }
    case 'coralFan': { const col = ['#e86a7a', '#f0a050', '#c85ab8', '#ff8a6a'][v]; P('#1a1410', -4, -7, 9, 7); for (let i = 0; i < 4; i++) P(col, -3 + i * 2, -6 + (i % 2), 1, 6); P(col, -3, -6, 7, 1); P('#ffffff', -2, -6, 1, 1); P('#5a3a2a', 0, -1, 1, 2); break; }
    case 'coralBranch': { const col = ['#ff7a8a', '#ffb070', '#e080d8', '#ff9a7a'][v]; P('#1a1410', -1, -8, 3, 9); P(col, 0, -8, 1, 8); P('#1a1410', -4, -6, 4, 2); P(col, -3, -6, 3, 1); P(col, -3, -8, 1, 2); P('#1a1410', 1, -5, 4, 2); P(col, 2, -5, 2, 1); P(col, 3, -7, 1, 2); break; }
    case 'seaShell': P('#1a1410', -2, -2, 5, 3); P('#f0d8c0', -1, -2, 3, 2); P('#c89a7a', 0, -1, 1, 1); break;
    case 'starfish': P('#e8603a', 0, -3, 1, 5); P('#e8603a', -2, -1, 5, 1); P('#e8603a', -1, 0, 1, 1); P('#e8603a', 1, 0, 1, 1); P('#ffb08a', 0, -1, 1, 1); break;
    case 'seaRock': P('#1a1410', -3, -2, 6, 3); P('#6a707a', -2, -2, 4, 2); P('#8a9098', -2, -2, 2, 1); break;
    case 'glowPlant': P('#2a4a5a', 0, -5, 1, 5); P('#7af0ff', -1, -6, 3, 2); P('#ffffff', 0, -6, 1, 1); P('#5ac8e8', 2, -3, 1, 1); break;
    case 'lakeWeed': P('#3a6a3a', 0, -6, 1, 6); P('#4a8a42', -2, -4, 2, 1); P('#4a8a42', 1, -3, 2, 1); P('#3a6a3a', 2, -5, 1, 3); break;
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
    case 'coral': { // 산호 (용궁)
      const c = ['#ff7a8a', '#ff9a5a', '#c86aff', '#5ad8c8'][v % 4];
      P('#1a1410', -1, -7, 3, 8); P(c, 0, -6, 1, 7); P('#1a1410', -4, -5, 3, 2); P(c, -3, -5, 2, 1); P('#1a1410', 2, -4, 3, 2); P(c, 2, -4, 2, 1); P('#ffffff', 0, -6, 1, 1);
      break;
    }
    case 'chalk': { // 먼저 오른 사람이 남긴 분필 화살표 (v: 0 오른쪽 · 1 위 · 2 왼쪽 · 3 아래)
      const c = 'rgba(236,230,214,0.75)';
      if (v === 0) { P(c, -4, 0, 7, 1); P(c, 1, -2, 1, 1); P(c, 2, -1, 1, 1); P(c, 2, 1, 1, 1); P(c, 1, 2, 1, 1); }
      else if (v === 2) { P(c, -3, 0, 7, 1); P(c, -1, -2, 1, 1); P(c, -2, -1, 1, 1); P(c, -2, 1, 1, 1); P(c, -1, 2, 1, 1); }
      else if (v === 1) { P(c, 0, -4, 1, 7); P(c, -2, -2, 1, 1); P(c, -1, -3, 1, 1); P(c, 1, -3, 1, 1); P(c, 2, -2, 1, 1); }
      else { P(c, 0, -3, 1, 7); P(c, -2, 1, 1, 1); P(c, -1, 2, 1, 1); P(c, 1, 2, 1, 1); P(c, 2, 1, 1, 1); }
      P(c, 4, 3, 1, 1); P(c, 5, 3, 1, 1); break; // 작은 S 자 서명
    }
  }
}

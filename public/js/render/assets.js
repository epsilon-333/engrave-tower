// 에셋 로더: 0x72 DungeonTileset II (CC0) 시트 + 좌표 목록
// sprite(name, opts) → 색조·피격 흰색·좌우반전 처리된 캔버스 (캐시)
export const atlas = {};
let sheet = null;
const cache = new Map();
import { registerCustomArt } from './customart.js';

export async function loadAssets() {
  const [img, list] = await Promise.all([
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/0x72/sheet.png'; }),
    fetch('assets/0x72/tile_list.txt').then((r) => r.text()),
  ]);
  sheet = img;
  for (const line of list.split('\n')) {
    const [name, x, y, w, h] = line.trim().split(/\s+/);
    if (name && h) atlas[name] = { x: +x, y: +y, w: +w, h: +h };
  }
  // 원본 목록의 오타 보정 (zombie_anim_f10 → zombie_anim_f0)
  for (const k of Object.keys(atlas)) {
    const m = k.match(/^(.*)_f10$/);
    if (m && !atlas[`${m[1]}_f0`] && atlas[`${m[1]}_f1`]) atlas[`${m[1]}_f0`] = atlas[k];
  }
  registerCustomArt(atlas);
  // 직접 그린 · 잘라 낸 도트 시트: 목록 하나(assets/custom/sprites.json, tools/sprites.py가 만든다)를 읽어 같은 방식으로 올린다
  // 시트마다 { img, prefix, w, h, y0, anims: { 동작: { row, n } } } → 프레임 이름 {prefix}_{동작}_anim_f{i}, 자리 (i*w, y0 + row*h)
  const man = await fetch('assets/custom/sprites.json').then((r) => r.json()).catch(() => null);
  if (!man) return;
  const imgs = {};
  await Promise.all([...new Set(man.sheets.map((sh) => sh.img))].map((src) => new Promise((res) => { const i = new Image(); i.onload = () => { imgs[src] = i; res(); }; i.onerror = () => res(); i.src = 'assets/custom/' + src; })));
  for (const sh of man.sheets) {
    const img = imgs[sh.img]; if (!img) continue;
    for (const [anim, { row, n }] of Object.entries(sh.anims)) for (let i = 0; i < n; i++) atlas[`${sh.prefix}_${anim}_anim_f${i}`] = { x: i * sh.w, y: (sh.y0 || 0) + row * sh.h, w: sh.w, h: sh.h, src: img };
  }
  if (man.meta.true_dragon) atlas.true_dragon_meta = man.meta.true_dragon; // 용 · 정령왕: 크기 · 보폭 같은 그리기 정보
  if (man.meta.king) atlas.king_meta = man.meta.king;
}

// 애니메이션 프레임 이름 목록: base_idle_anim_f0.. / base_run_anim_f0.. / base_anim_f0..
export function frames(base, kind) {
  for (const key of [`${base}_${kind}_anim`, `${base}_idle_anim`, `${base}_anim`]) {
    if (atlas[key + '_f0']) {
      const out = [];
      for (let i = 0; atlas[`${key}_f${i}`]; i++) out.push(`${key}_f${i}`);
      return out;
    }
  }
  return [base];
}

// tint: CSS filter 문자열 (예: 'hue-rotate(180deg) saturate(1.2)')
export function sprite(name, tint = '', flash = false, flip = false) {
  const key = name + '|' + tint + '|' + flash + '|' + flip;
  let c = cache.get(key);
  if (c) return c;
  const a = atlas[name];
  if (!a) return null;
  c = document.createElement('canvas');
  c.width = a.w; c.height = a.h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (flip) { g.translate(a.w, 0); g.scale(-1, 1); }
  if (tint) g.filter = tint;
  g.drawImage(a.src || sheet, a.x, a.y, a.w, a.h, 0, 0, a.w, a.h);
  g.filter = 'none';
  if (flash) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = flash === true ? '#ffffff' : flash;
    g.fillRect(0, 0, a.w, a.h);
  }
  cache.set(key, c);
  return c;
}


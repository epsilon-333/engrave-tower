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
  // 뼈대 도트 시트 (tools/dragon.py · kings.py · dragonkin.py 로 생성): 동작마다 한 줄, 프레임마다 한 칸
  const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const json = (src) => fetch(src).then((r) => r.json()).catch(() => null);
  const reg = (img, meta, prefix) => {
    if (!img || !meta) return;
    for (const [anim, { row, n }] of Object.entries(meta.anims)) for (let i = 0; i < n; i++) atlas[`${prefix}_${anim}_anim_f${i}`] = { x: i * meta.w, y: row * meta.h, w: meta.w, h: meta.h, src: img };
  };
  // 용인족: 뼈대 도트(tools/dragonkin.py) · 용과 정령왕: 사용자 스프라이트 시트에서 잘라낸 동작 프레임(tools/cut_sheet.py)
  const [dkI, dkM, meta, drI, kF, kW, kG] = await Promise.all([
    load('assets/custom/dragonkin.png'), json('assets/custom/dragonkin.json'), json('assets/custom/sheet_meta.json'),
    load('assets/custom/dragon_fire.png'), load('assets/custom/king_fire.png'), load('assets/custom/king_wind.png'), load('assets/custom/king_forest.png'),
  ]);
  reg(dkI, dkM, 'dragonkin');
  // 사람: 뼈대 도트(tools/people.py) — 마을 사람 · 성지 주민 · 우두머리 · 관리 · 상인 · 사람 모양 몬스터를 하나하나 그렸다
  const [pI, pM] = await Promise.all([load('assets/custom/people.png'), json('assets/custom/people.json')]);
  if (pI && pM) for (const [id, c] of Object.entries(pM.chars)) reg(pI, { w: pM.w, h: pM.h, anims: c.anims }, 'p_' + id);
  // 랩터 (tools/raptor.py): 야생 · 우두머리 · 안장 얹은 탈것
  const [rM, r1, r2, r3] = await Promise.all([json('assets/custom/raptors.json'), load('assets/custom/raptor.png'), load('assets/custom/raptor_alpha.png'), load('assets/custom/raptor_mount.png')]);
  if (rM) { reg(r1, rM.raptor, 'raptor_beast'); reg(r2, rM.raptor_alpha, 'raptor_alpha'); reg(r3, rM.raptor_mount, 'raptor_mount'); }
  // 짐승 · 괴물 (tools/creatures.py): 크기가 제각각이라 한 장에 세로로 쌓여 있다 (y0 = 그 몬스터 칸의 시작 줄)
  const [cI, cM] = await Promise.all([load('assets/custom/creatures.png'), json('assets/custom/creatures.json')]);
  if (cI && cM) for (const [id, c] of Object.entries(cM)) for (const [anim, { row, n }] of Object.entries(c.anims)) for (let i = 0; i < n; i++) atlas[`c_${id}_${anim}_anim_f${i}`] = { x: i * c.w, y: c.y0 + row * c.h, w: c.w, h: c.h, src: cI };
  if (meta) {
    reg(drI, meta.dragon_fire, 'true_dragon'); atlas.true_dragon_meta = meta.dragon_fire;
    reg(kF, meta.king_fire, 'king_fire'); reg(kW, meta.king_wind, 'king_wind'); reg(kG, meta.king_forest, 'king_forest');
    atlas.king_meta = { fire: meta.king_fire, wind: meta.king_wind, forest: meta.king_forest };
  }
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

export function hasSprite(name) { return !!atlas[name]; }

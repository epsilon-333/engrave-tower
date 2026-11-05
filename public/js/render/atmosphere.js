// 렌더러 — 공기: 연기 · 낮과 밤 · 빛 · 잠긴 지역 안개 · 안 가 본 곳의 어둠
// Renderer.prototype 에 그대로 붙는다 (render/renderer.js 끝). 메서드 안의 this 는 Renderer

import { TILE, T_LIQUID } from '../sim/mapgen.js';
import { SANCTUMS } from '../data/sanctums.js';
import { PixelCtx } from './pixelctx.js';
import { G } from '../data/maps/overworld.js';
import { ELEM } from '../data/skills.js';
import { MONSTER_ART } from '../data/art.js';
import { REWARDS as CLIMB_REWARDS } from '../data/climb.js';
import { skyColor, darkness } from '../sim/time.js';
import { GLOW, hexA, fogSprites } from './renderer.js';

export const AtmosMethods = {
  // 연막: 뭉게뭉게 피어오르는 잿빛 연기 (반쯤 비쳐서 안이 보인다)
  drawSmoke(w, dt) {
    const g = this.g, t = w.t;
    for (const z of w.zones || []) {
      if (z.kind !== 'smoke') continue;
      const life = z.t / z.max, inA = Math.min(1, (z.max - z.t) / 0.35), outA = Math.min(1, z.t / 0.8), a = inA * outA;
      z.puffs ||= Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + Math.random() * 0.4, d: 0.25 + Math.random() * 0.65, r: 0.32 + Math.random() * 0.25, ph: Math.random() * 6 }));
      const grow = 0.75 + 0.25 * Math.min(1, (z.max - z.t) / 0.6);
      for (const pf of z.puffs) {
        const x = z.x + Math.cos(pf.a + t * 0.08) * z.r * pf.d * grow, y = z.y - 8 + Math.sin(pf.a + t * 0.08) * z.r * pf.d * 0.55 * grow + Math.sin(t * 0.7 + pf.ph) * 2;
        const rr = z.r * pf.r * grow * (1 + 0.08 * Math.sin(t * 0.9 + pf.ph));
        const gr = g.createRadialGradient(x, y, rr * 0.2, x, y, rr);
        gr.addColorStop(0, `rgba(196,198,210,${0.36 * a})`); gr.addColorStop(0.6, `rgba(170,172,186,${0.22 * a})`); gr.addColorStop(1, 'rgba(160,162,176,0)');
        g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      if (dt > 0 && Math.random() < 0.5 * life) this.parts.push({ x: z.x + (Math.random() - 0.5) * z.r * 1.4, y: z.y - 4 + (Math.random() - 0.5) * z.r * 0.7, vx: (Math.random() - 0.5) * 6, vy: -6 - Math.random() * 6, t: 1.6, max: 1.6, color: '#c8cad4', g: -1, steam: true });
    }
  },

  // ───────── 낮과 밤: 하늘빛을 곱해 어둡게 하고, 불빛 자리는 밝게 남긴다 ─────────
  drawDayNight(w, cx, cy, dt) {
    const c = w.clock, outdoor = !!w.map.outdoor, indoor = !!w.map.indoor;
    this.nightK = 0;
    if (!c || (!outdoor && !indoor)) return;
    let [r, gg, b] = skyColor(c.min), dk = darkness(c.min);
    if (w.map.underwater) { // 바닷속: 푸른 물빛을 곱하고, 밤이면 더 깊게. 불빛(거품 구멍 · 빛나는 풀 · 해파리)은 늘 보인다
      const dep = Math.min(1, (w.map.depth?.[Math.floor(w.player.y / TILE) * w.tw + Math.floor(w.player.x / TILE)] || 0) / 14);
      r = r * (0.42 - dep * 0.18) + 20; gg = gg * (0.62 - dep * 0.2) + 34; b = b * (0.8 - dep * 0.18) + 46; dk = Math.max(0.55, dk);
    }
    if (indoor) { r = 255 - (255 - r) * 0.5; gg = 255 - (255 - gg) * 0.5; b = 255 - (255 - b) * 0.42; dk *= 0.7; } // 집 안은 덜 어둡다 (등불 · 화로)
    if (!w.map.underwater) { r = 255 - (255 - r) * 0.72; gg = 255 - (255 - gg) * 0.72; b = 255 - (255 - b) * 0.62; } // 밤: 화면을 탁하게 덮지 않게 어둠을 덜고 푸른 쪽은 조금 남긴다
    this.nightK = dk;
    if (r > 252 && gg > 252 && b > 252) return;
    const lg = this.lg, VW = this.VW, VH = this.VH, p = w.player, t = w.t;
    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; lg.fillRect(0, 0, VW, VH);
    lg.globalCompositeOperation = 'lighter';
    const L = Math.min(1, dk * 1.25); // 불빛이 얼마나 두드러지는지 (낮엔 0)
    const inView = (x, y, rr) => x > cx - rr && x < cx + VW + rr && y > cy - rr && y < cy + VH + rr;
    const LC = (this.lightCache ||= new Map());
    const light = (x, y, rr, col, a = 1) => { // 불빛: 크기 · 색 · 세기마다 한 번 그려 둔 도트 빛을 찍는다 (매번 그라데이션을 새로 칠하지 않게)
      if (!inView(x, y, rr) || a <= 0.01) return;
      const R = Math.max(4, Math.round(rr / 2) * 2), A = Math.round(a * 16) / 16, key = R + col + A;
      let img = LC.get(key);
      if (!img) {
        const cv = document.createElement('canvas'); cv.width = cv.height = R * 2;
        const px = new PixelCtx(cv.getContext('2d')), gr = px.createRadialGradient(R, R, 0, R, R, R);
        gr.addColorStop(0, hexA(col, A)); gr.addColorStop(0.45, hexA(col, A * 0.55)); gr.addColorStop(1, hexA(col, 0));
        px.fillStyle = gr; px.fillRect(0, 0, R * 2, R * 2);
        img = cv; LC.set(key, img); if (LC.size > 300) LC.delete(LC.keys().next().value);
      }
      lg.drawImage(img, Math.round(x - cx - R), Math.round(y - cy - R));
    };
    const fl = (k) => 1 + Math.sin(t * 9 + k) * 0.05 + Math.sin(t * 23 + k * 3) * 0.03;
    if (L > 0) {
      light(p.x, p.y - 6, p.buffs?.scrollLight ? 150 : 78, p.buffs?.scrollLight ? '#fff2c8' : '#d8d0c0', (p.buffs?.scrollLight ? 0.85 : 0.5) * L); // 내 둘레는 늘 조금 보인다 (빛의 주문서면 환히)
      if (p.buffs?.enchant) light(p.x, p.y - 8, 54, ELEM[p.buffs.enchant.elem]?.color || '#ffffff', 0.5 * L);
      for (const o of w.objects) {
        if (!inView(o.x, o.y, 140)) continue;
        if (o.kind === 'rest' || o.kind === 'camp') light(o.x + (o.kind === 'camp' ? 11 : 0), o.y - 4, 128 * fl(o.x), '#ffb050', 0.95 * L);
        else if (o.kind === 'door') light(o.x, o.y - 18, 54, '#ffcf7a', 0.75 * L);
        else if (o.kind === 'sanctum') light(o.x + 16, o.y - 16, 72, SANCTUMS[o.race]?.color || '#ffffff', 0.55 * L);
        else if (o.kind === 'towerDoor') light(o.x, o.y - 8, 70, '#90ffe0', 0.6 * L);
        else if (o.kind === 'raidAltar') light(o.x, o.y - 18, 60, '#ff5a6a', 0.6 * L);
        else if (o.kind === 'waypoint' && o.active) light(o.x, o.y - 10, 60, '#8ad8ff', 0.6 * L);
        else if (o.kind === 'relic' && !o.opened) light(o.x, o.y - 14, 40, SANCTUMS[o.race]?.color || '#ffffff', 0.7 * L);
        else if (o.kind === 'merchant' || o.kind === 'npc' || o.kind === 'turtle') light(o.x, o.y - 10, 46, '#ffd890', 0.5 * L);
        else if (o.kind === 'shrine' && !o.opened) light(o.x, o.y - 24, 46, '#c9a8ff', 0.6 * L);
        else if (o.kind === 'lore' && !o.opened) light(o.x, o.y - 6, 26, '#8ad8ff', 0.5 * L);
        else if (o.kind === 'entrance') light(o.x, o.y - 10, 34, '#e8dcc0', 0.3 * L);
        else if (o.kind === 'node' && !o.depleted && (o.type === 'crystal' || o.type === 'obsidian')) light(o.x, o.y - 6, 28, o.type === 'crystal' ? '#c0a0ff' : '#ff8a5a', 0.45 * L);
        else if (o.kind === 'station') light(o.x, o.y - 8, 34, '#ffd890', 0.35 * L);
      }
      if (w.map.props) for (const pr of w.map.props) {
        const px = (pr.x + pr.w / 2) * TILE, py = (pr.y + pr.h) * TILE;
        if (!inView(px, py, 220)) continue;
        if (pr.kind.startsWith('house_')) { light(pr.x * TILE + 16, py - 22, 34, '#ffc870', 0.7 * L); light((pr.x + pr.w) * TILE - 16, py - 22, 34, '#ffc870', 0.7 * L); }
        else if (pr.kind === 'tower') { light(px, py - 194, 96, '#90ffe0', 0.85 * L); light(px, py - 6, 46, '#90ffe0', 0.5 * L); }
        else if (pr.kind === 'furnace' || pr.kind === 'stove' || pr.kind === 'fireplace') light(px, py - 14, 84 * fl(px), '#ff9a40', 0.85 * L);
        else if (pr.kind === 'candles') light(px, py - 10, 46 * fl(px), '#ffc070', 0.8 * L);
        else if (pr.kind === 'desk' && pr.books) light((pr.x + pr.w) * TILE - 12, py - 20, 36, '#ffc070', 0.7 * L);
        else if (pr.kind === 'runeAltar') light(px, py - 22, 60, '#c0a0ff', 0.75 * L);
        else if (pr.kind === 'lampPost') light(px, py - 30, 84, '#ffd890', 0.9 * L); // 가로등은 흔들리지 않는 고른 빛 (깜박이지 않게)
        else if (pr.kind === 'mageTower' || pr.kind === 'worldTree' || pr.kind === 'dragonNest' || pr.kind === 'mausoleum') light(px, py - 30, 70, pr.kind === 'worldTree' ? '#8affb0' : pr.kind === 'dragonNest' ? '#ff8a40' : pr.kind === 'mausoleum' ? '#c45cff' : '#b0a0ff', 0.5 * L);
      }
      if (indoor) light(p.x, p.y - 6, 60, '#ffd8a0', 0.35 * L);
      if (w.map.underwater) {
        light(p.x, p.y - 6, 96, '#bfe8ff', 0.6); // 물속에서도 둘레는 보인다
        for (const o of w.objects) { if (o.kind === 'vent') light(o.x, o.y - 6, 52 + Math.sin(t * 3 + o.x) * 4, '#a8f0ff', 0.75); else if (o.kind === 'palaceGate') light(o.x, o.y - 16, 110, '#7af0e0', 0.9); else if (o.kind === 'chest' && !o.opened && (!o.hidden || o.found)) light(o.x, o.y - 4, 26, '#ffe8a0', 0.5); }
      }
      for (const d of this.glowDeco || []) if (inView(d.x, d.y, 40)) { const [rr, col] = GLOW[d.kind]; light(d.x, d.y - 3, rr * 1.4, col, 0.75 * L); }
      for (const [k] of w.burning || []) { const x = (k % w.tw) * TILE + 8, y = Math.floor(k / w.tw) * TILE + 8; light(x, y, 44 * fl(k), '#ff9040', 0.8 * L); }
      if (outdoor) { // 용암: 보이는 칸만 (두 칸마다 하나씩)
        const x0 = Math.max(0, Math.floor(cx / TILE) - 2), y0 = Math.max(0, Math.floor(cy / TILE) - 2), x1 = Math.min(w.tw - 1, Math.ceil((cx + VW) / TILE) + 2), y1 = Math.min(w.th - 1, Math.ceil((cy + VH) / TILE) + 2);
        for (let y = y0 - (y0 & 1); y <= y1; y += 2) for (let x = x0 - (x0 & 1); x <= x1; x += 2) if (w.map.ground[y * w.tw + x] === G.LAVA) light(x * TILE + 8, y * TILE + 8, 40, '#ff7a30', 0.55 * L);
      }
      if (w.farmRect && w.life) for (const [key, pl] of Object.entries(w.life.farm)) if (pl.crop === 'starflower' && pl.stage >= 3) { const [fx, fy] = key.split(',').map(Number); light(fx * TILE + 8, fy * TILE + 4, 30, '#fff2a0', 0.6 * L); }
      for (const pr of w.projs) light(pr.x, pr.y, 34, pr.color || '#ffffff', 0.7 * L);
      for (const e of w.enemies) {
        if (e.dead || !inView(e.x, e.y, 40)) continue;
        if (e.def.glow || e.def.ghost) light(e.x, e.y - 10, e.def.glow ? 58 : 34, e.def.glowColor || e.def.pal?.a || '#8ad8ff', 0.7 * L);
        else if (e.st.burn) light(e.x, e.y - 8, 30, '#ff8a3a', 0.6 * L);
      }
      for (const dr of w.drops) light(dr.x, dr.y, 16, '#fff0c0', 0.4 * L);
    }
    lg.globalCompositeOperation = 'source-over';
    const g = this.g;
    g.save(); this.viewTf(g);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(this.light, 0, 0);
    g.restore(); g.imageSmoothingEnabled = false;
    this.worldTf(g);
    // 반딧불이 (밤의 풀숲 · 숲)
    if (outdoor && dk > 0.55 && dt > 0) {
      const ff = this.fireflies ||= [];
      const bi = w.map.biome?.[Math.floor(p.y / TILE) * w.tw + Math.floor(p.x / TILE)];
      const lush = bi != null && [0, 1, 2, 3, 10, 11].includes(bi);
      if (lush && ff.length < 26 && Math.random() < dt * 6) ff.push({ x: cx + Math.random() * VW, y: cy + Math.random() * VH, ph: Math.random() * 6, life: 5 + Math.random() * 5, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 6 });
      g.globalCompositeOperation = 'lighter';
      for (const f of ff) {
        f.life -= dt; f.ph += dt; f.x += (f.vx + Math.sin(f.ph * 1.3) * 6) * dt; f.y += (f.vy + Math.cos(f.ph * 0.9) * 5) * dt;
        const a = Math.max(0, Math.min(1, f.life)) * (0.5 + 0.5 * Math.sin(f.ph * 3)) * Math.min(1, (dk - 0.55) * 3);
        if (a <= 0.02) continue;
        g.fillStyle = `rgba(200,255,120,${0.22 * a})`; g.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2, 5, 5);
        g.fillStyle = `rgba(235,255,170,${a})`; g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
      }
      g.globalCompositeOperation = 'source-over';
      this.fireflies = ff.filter((f) => f.life > 0);
    }
  },

  // ───────── 조명 / 안개 ─────────
  drawLight(w, cx, cy) {
    const z = w.zone, lg = this.lg, p = w.player, VW = this.VW, VH = this.VH;
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, VW, VH);
    lg.fillStyle = `rgba(6,4,14,${z.dark})`;
    lg.fillRect(0, 0, VW, VH);
    lg.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const gr = lg.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = gr; lg.fillRect(x - cx - r, y - cy - r, r * 2, r * 2);
    };
    const flick = 1 + Math.sin(w.t * 9) * 0.02 + Math.sin(w.t * 23) * 0.015;
    hole(p.x, p.y - 6, (p.buffs?.scrollLight ? 250 : 160) * flick); // 빛의 주문서: 더 넓게
    const inView = (x, y) => x > cx - 80 && x < cx + VW + 80 && y > cy - 80 && y < cy + VH + 80;
    const colored = [];
    for (const d of this.glowDeco) if (inView(d.x, d.y)) { const [r, c] = GLOW[d.kind]; hole(d.x, d.y - 3, r * (1 + Math.sin(w.t * 3 + d.x) * 0.08), 0.9); colored.push([d.x, d.y - 3, r * 0.8, c]); }
    for (const o of w.objects) if (inView(o.x, o.y)) {
      if (o.kind === 'portal') { hole(o.x, o.y, 70); colored.push([o.x, o.y, 50, o.color]); }
      else if (o.kind === 'lightPillar') { if (o.litT > 0) { hole(o.x, o.y - 16, 120 * flick); colored.push([o.x, o.y - 16, 96, '#ffe8a0']); } else hole(o.x, o.y - 30, 26, 0.6); }
      else if (o.kind === 'climbDoor') { hole(o.x, o.y - 16, 60); colored.push([o.x, o.y - 16, 46, CLIMB_REWARDS[o.next]?.color || '#ffffff']); }
      else if (o.kind === 'camp') { hole(o.x + 11, o.y - 2, 80); colored.push([o.x + 11, o.y - 2, 60, '#ffa040']); }
      else if (o.kind === 'shrine' && !o.opened) { hole(o.x, o.y - 28, 40, 0.8); colored.push([o.x, o.y - 28, 30, '#c9a8ff']); }
      else if (o.kind === 'stairs' || o.kind === 'merchant' || o.kind === 'npc') { hole(o.x, o.y - 6, 40, 0.7); }
      else if (o.kind === 'barrier') { if (!o.opened && o.look === 'thorn') hole(o.x, o.y - 4, 26, 0.5); }
      else if (!o.opened) { hole(o.x, o.y - 6, 30, 0.7); colored.push([o.x, o.y - 6, 22, o.kind === 'lore' ? '#8ad8ff' : '#ffd88a']); }
    }
    for (const pr of w.projs) if (inView(pr.x, pr.y)) { hole(pr.x, pr.y, 24, 0.8); colored.push([pr.x, pr.y, 14, pr.color]); }
    for (const e of w.enemies) {
      if (!inView(e.x, e.y)) continue;
      if (e.st.burn) { hole(e.x, e.y - 8, 30, 0.8); colored.push([e.x, e.y - 8, 22, '#ff7a2a']); }
      if (e.def.elite) hole(e.x, e.y - 10, 44, 0.6);
      if (MONSTER_ART[e.defId]?.sheet) hole(e.x, e.y - 30, 100, 0.8); // 큰 보스는 어두운 층에서도 몸 전체가 보이게
    }
    for (const dr of w.drops) if (inView(dr.x, dr.y)) hole(dr.x, dr.y, 14, 0.7);
    if (z.liquid === 'lava') {
      const x0 = Math.max(0, Math.floor(cx / TILE) - 2), y0 = Math.max(0, Math.floor(cy / TILE) - 2);
      for (let y = y0; y < Math.min(w.th, y0 + Math.ceil(VH / TILE) + 4); y++) for (let x = x0; x < Math.min(w.tw, x0 + Math.ceil(VW / TILE) + 4); x++) if (w.tiles[y * w.tw + x] === T_LIQUID) { hole(x * TILE + 8, y * TILE + 8, 26, 0.35); }
    }
    lg.globalCompositeOperation = 'lighter';
    for (const [x, y, r, c] of colored) {
      const gr = lg.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r);
      gr.addColorStop(0, hexA(c, 0.22)); gr.addColorStop(1, hexA(c, 0));
      lg.fillStyle = gr; lg.fillRect(x - cx - r, y - cy - r, r * 2, r * 2);
    }
    lg.globalCompositeOperation = 'source-over';
    const g = this.g;
    this.viewTf(g);
    g.drawImage(this.light, 0, 0);
    this.worldTf(g);
  },

  // 안 가 본 곳의 어둠: 칸 가운데 네 곳(가 봤나 · 안 가 봤나)으로 정해지는 16가지 모양을 미리 점묘로 찍어 두고, 보이는 칸마다 붙인다
  // (진하기 네 단계 + 바둑판 점묘 · 칸에 맞춰 있어 걸어도 무늬가 흔들리지 않는다)
  // 해방되지 않은 지역의 안개 (칸 하나 = 점 하나인 그림을 키워 그린다 · 부드럽게 번진 경계)
  sealCanvas(w) {
    if (this.sealC && !this.sealDirty && this.sealW === w) return this.sealC;
    this.sealDirty = false; this.sealW = w; this.sealFdirty = true;
    const c = (this.sealC ||= document.createElement('canvas')); c.width = w.tw; c.height = w.th;
    const L = w.locks?.regions, R = w.map.regions, gc = c.getContext('2d'), img = gc.createImageData(w.tw, w.th), d = img.data;
    if (L?.size && R) { // 경계에서 안쪽으로 4칸에 걸쳐 점점 짙게 (열린 땅에서 몇 칸 떨어졌나)
      const tw = w.tw, n = R.length, dist = new Uint8Array(n).fill(255), q = [];
      for (let i = 0; i < n; i++) if (!L.has(R[i])) { dist[i] = 0; q.push(i); }
      for (let h = 0; h < q.length; h++) { const i = q[h], x = i % tw; if (dist[i] >= 4) continue; for (const j of [x > 0 ? i - 1 : -1, x < tw - 1 ? i + 1 : -1, i - tw, i + tw]) if (j >= 0 && j < n && dist[j] === 255) { dist[j] = dist[i] + 1; q.push(j); } }
      for (let i = 0; i < n; i++) if (dist[i]) { d[i * 4] = 30; d[i * 4 + 1] = 18; d[i * 4 + 2] = 48; d[i * 4 + 3] = Math.round(185 * Math.min(1, dist[i] / 4)); }
    }
    for (const k of w.locks?.keep || []) { const r = k.r / TILE, cx = k.x / TILE, cy = k.y / TILE; for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(w.th - 1, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w.tw - 1, cx + r); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r) d[(y * w.tw + x) * 4 + 3] = 0; } // 열어 둔 곳 (내 종족 성지 둘레)
    gc.putImageData(img, 0, 0);
    return c;
  },
  // 세계에 덮는 안개: 칸(16px)보다 잘게(8px) — 칸 그림의 짙기를 이웃 칸과 섞어 경계가 계단처럼 보이지 않게
  sealFine(w) {
    const tile = this.sealCanvas(w);
    if (this.sealF && this.sealFsrc === tile && !this.sealFdirty && this.sealFw === w) return this.sealF;
    this.sealFsrc = tile; this.sealFw = w; this.sealFdirty = false;
    const tw = w.tw, th = w.th, A = tile.getContext('2d').getImageData(0, 0, tw, th).data, W2 = tw * 2, H2 = th * 2;
    const c = (this.sealF ||= document.createElement('canvas')); c.width = W2; c.height = H2;
    const gc = c.getContext('2d'), img = gc.createImageData(W2, H2), d = img.data;
    const a = (x, y) => A[((Math.max(0, Math.min(th - 1, y))) * tw + Math.max(0, Math.min(tw - 1, x))) * 4 + 3];
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      const fx = x / 2 - 0.25, fy = y / 2 - 0.25, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
      const al = (a(x0, y0) * (1 - u) + a(x0 + 1, y0) * u) * (1 - v) + (a(x0, y0 + 1) * (1 - u) + a(x0 + 1, y0 + 1) * u) * v;
      if (al < 2) continue;
      const i = (y * W2 + x) * 4; d[i] = 30; d[i + 1] = 18; d[i + 2] = 48; d[i + 3] = al;
    }
    gc.putImageData(img, 0, 0);
    return c;
  },
  drawSeals(w, dt) {
    const g = this.g, c = this.sealFine(w), p = w.player;
    this.worldTf(g);
    g.drawImage(c, 0, 0, w.tw * TILE, w.th * TILE);
    if (dt > 0 && Math.random() < 0.5) { // 안개 속을 떠도는 보랏빛 티끌 (가까운 경계에서만)
      const x = p.x + (Math.random() - 0.5) * 360, y = p.y + (Math.random() - 0.5) * 220;
      if (w.sealAt(x, y)) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 8, t: 1.6, max: 1.6, color: Math.random() < 0.5 ? '#b89cff' : '#7a5ad8', g: -2 });
    }
  },
  drawFog(w, cx, cy) {
    const g = this.g, VW = this.VW, VH = this.VH, ex = w.explored, tw = w.tw, th = w.th, spr = (this.fogSpr ||= fogSprites());
    const fog = (x, y) => (x < 0 || y < 0 || x >= tw || y >= th || !ex[y * tw + x] ? 1 : 0);
    this.worldTf(g);
    g.fillStyle = '#05040a';
    const i0 = Math.floor((cx - 8) / TILE), i1 = Math.floor((cx + VW - 8) / TILE), j0 = Math.floor((cy - 8) / TILE), j1 = Math.floor((cy + VH - 8) / TILE);
    for (let j = j0; j <= j1; j++) {
      let run = -1; // 꽉 찬 어둠은 가로로 이어서 한 번에
      for (let i = i0; i <= i1 + 1; i++) {
        const m = i > i1 ? 0 : fog(i, j) | (fog(i + 1, j) << 1) | (fog(i, j + 1) << 2) | (fog(i + 1, j + 1) << 3);
        if (m === 15) { if (run < 0) run = i; continue; }
        if (run >= 0) { g.fillRect(run * TILE + 8, j * TILE + 8, (i - run) * TILE, TILE); run = -1; }
        if (m) g.drawImage(spr[m], i * TILE + 8, j * TILE + 8);
      }
    }
  },

};

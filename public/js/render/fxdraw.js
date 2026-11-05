// 렌더러 — 이펙트 그리기 (this.fx 목록 · 바닥 층과 공중 층)
// Renderer.prototype 에 그대로 붙는다 (render/renderer.js 끝). 메서드 안의 this 는 Renderer

import { sprite, frames } from './assets.js';
import { RACE_ART } from '../data/art.js';
import { GROUND_FX, easeOut, WORD_COLOR, hexA, disc, ellipse, smear } from './renderer.js';

export const FxMethods = {
  // 이펙트는 두 층: 바닥에 붙는 것(예고 원 · 예고선 · 갈라짐 · 그을음 · 마법진)은 사람 · 보스 · 소품보다 아래, 나머지는 위
  drawFx(w, dt, ground = false) {
    const g = this.g, p = w.player;
    for (const f of this.fx) {
      if (GROUND_FX.has(f.k) !== ground) continue;
      f.t -= dt;
      const k = Math.max(0, f.t / f.max);
      if (f.k === 'ring') {
        // 퍼지는 충격: 고리를 그리지 않고, 사방으로 흩어지는 빛 조각 · 흙먼지와 부드러운 빛으로
        const rr = f.r * (1 - k * 0.6), n = Math.max(10, Math.round(f.r / 3));
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(f.x, f.y, rr * 0.2, f.x, f.y, rr);
        gr.addColorStop(0, hexA(f.color, 0.12 * k)); gr.addColorStop(0.6, hexA(f.color, 0.06 * k)); gr.addColorStop(1, hexA(f.color, 0)); // 가운데가 밝은 둥근 빛 (띠 모양이 아니게)
        g.fillStyle = gr; g.save(); g.translate(f.x, f.y); g.scale(1, 0.62); g.translate(-f.x, -f.y); g.fillRect(f.x - rr, f.y - rr, rr * 2, rr * 2); g.restore();
        if (!f.spread) { // 한 번만: 방향 · 속도를 흩뜨려 고리 꼴이 되지 않게
          f.spread = true;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = f.r * (1.2 + Math.random() * 2.2) / Math.max(0.3, f.max);
            this.parts.push({ x: f.x + Math.cos(a) * 4, y: f.y + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55, t: f.max * (0.6 + Math.random() * 0.5), max: f.max * 1.1, color: f.color, g: 0, glow: true, size: 1 });
            if (i % 2 === 0) this.parts.push({ x: f.x + Math.cos(a) * 6, y: f.y + 2 + Math.sin(a) * 3, vx: Math.cos(a) * sp * 0.4, vy: Math.sin(a) * sp * 0.22, t: 0.7, max: 0.7, color: '#b0a290', g: -4, steam: true });
          }
        }
        g.restore();
      } else if (f.k === 'slash') {
        // 휘두른 궤적의 초승달 잔상: 끝에서부터 사라짐
        const prog = easeOut(Math.min(1, 1 - (f.t - 0.08) / f.dur));
        const half = f.arc / 2 + 0.25;
        const a0 = f.ang - f.dir * half, a1 = a0 + f.dir * half * 2 * prog;
        const tail = Math.max(0, 1 - k * 1.6);
        const as = a0 + f.dir * half * 2 * prog * tail;
        const col = f.aura ? '#ffd84a' : f.heavy ? '#ffd050' : f.type === 'mag' ? '#c9a8ff' : '#ffffff';
        if (f.thrust) {
          // 창끝 앞으로 뾰족하게 뻗는 바람 자국 두세 줄 (막대처럼 보이지 않게 끝만)
          const a2 = Math.min(1, k * 2.2), prog = 1 - k;
          const ux = Math.cos(f.ang), uy = Math.sin(f.ang), nx = -uy, ny = ux;
          const base = 24 + 8 * prog, tipL = base + 10 + 8 * prog;
          g.save(); g.globalCompositeOperation = 'lighter';
          g.fillStyle = hexA(f.aura ? '#ffd84a' : '#fff4d8', 0.85 * a2);
          g.beginPath(); g.moveTo(p.x + ux * base + nx * 2.5, p.y - 7 + uy * base + ny * 2.5); g.lineTo(p.x + ux * tipL, p.y - 7 + uy * tipL); g.lineTo(p.x + ux * base - nx * 2.5, p.y - 7 + uy * base - ny * 2.5); g.closePath(); g.fill();
          for (const o of [-5, 5]) { g.strokeStyle = hexA('#ffffff', 0.45 * a2); g.lineWidth = 1; g.beginPath(); g.moveTo(p.x + ux * base * 0.8 + nx * o, p.y - 7 + uy * base * 0.8 + ny * o); g.lineTo(p.x + ux * (base + 8) + nx * o * 0.6, p.y - 7 + uy * (base + 8) + ny * o * 0.6); g.stroke(); }
          g.restore();
          continue;
        }
        if (f.fist) { // 주먹: 내지른 자리에 짧은 바람 자국과 충격
          const a2 = Math.min(1, k * 2.4), L = f.range + 2, ux = Math.cos(f.ang), uy = Math.sin(f.ang), nx = -uy, ny = ux;
          g.strokeStyle = hexA(f.heavy ? '#ffd050' : '#ffffff', 0.7 * a2); g.lineWidth = 1;
          for (const o of [-3, 0, 3]) { g.beginPath(); g.moveTo(p.x + ux * (L - 10) + nx * o, p.y - 7 + uy * (L - 10) + ny * o); g.lineTo(p.x + ux * (L - 2) + nx * o * 0.5, p.y - 7 + uy * (L - 2) + ny * o * 0.5); g.stroke(); }
          continue;
        }
        if (f.whip) continue; // 채찍은 줄을 직접 그린다 (무기 그림)
        const R = f.range + 4, r = Math.max(6, f.range * 0.35);
        const px = p.x, py = p.y - 6;
        const alpha = Math.min(1, k * 2.2);
        g.fillStyle = hexA(col, 0.55 * alpha);
        smear(g, px, py, R, (f.heavy ? 10 : 7), as, a1);
        g.fillStyle = hexA('#ffffff', 0.95 * alpha);
        smear(g, px, py, R, (f.heavy ? 4 : 2.5), as, a1);
      } else if (f.k === 'trail') { // 돌진한 길: 도착한 쪽이 굵고 처음 쪽은 뾰족한 바람 자국. 꼬리부터 따라 줄어든다 (막대 선 대신)
        const dx = f.x2 - f.x1, dy = f.y2 - f.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, prog = 1 - k;
        const sx = f.x1 + dx * prog * 0.85, sy = f.y1 - 6 + dy * prog * 0.85, ex = f.x2, ey = f.y2 - 6, W = Math.min(7, (f.w || 6) * 0.5) * (0.4 + 0.6 * k);
        for (const [c, wm, al] of [[f.color, 1, 0.32], [f.color, 0.55, 0.45], ['#ffffff', 0.18, 0.6]]) {
          g.fillStyle = hexA(c, al * k); g.beginPath(); g.moveTo(sx, sy);
          g.quadraticCurveTo(ex - dx / L * 6 + nx * W * wm, ey - dy / L * 6 + ny * W * wm, ex, ey);
          g.quadraticCurveTo(ex - dx / L * 6 - nx * W * wm, ey - dy / L * 6 - ny * W * wm, sx, sy); g.closePath(); g.fill();
        }
      } else if (f.k === 'impact') {
        g.fillStyle = hexA(f.color || '#ffffff', k);
        const r = f.r * (1.2 - k * 0.4);
        g.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.3 : r; g.lineTo(f.x + Math.cos(a) * rr, f.y - 8 + Math.sin(a) * rr); }
        g.closePath(); g.fill();
      } else if (f.k === 'bolt') { // 번개: 도트 지그재그 (가운데 흰 줄 · 양옆 번개색 · 가지), 30분의 1초마다 모양이 바뀐다 — 맞은 자리는 pixelfx 감전 불꽃
        const fr = Math.floor(this.world.t * 30), col = f.color;
        const P = (x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
        for (let i = 1; i < f.pts.length; i++) {
          const A = f.pts[i - 1], B = f.pts[i], L = Math.hypot(B.x - A.x, B.y - A.y) || 1, nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L, M = Math.max(3, Math.round(L / 8));
          let px0 = A.x, py0 = A.y;
          for (let j = 1; j <= M; j++) {
            const u = j / M, jit = j === M ? 0 : (Math.sin(f.seed + fr * 7.1 + i * 13 + j * 3.3) * 5), x = A.x + (B.x - A.x) * u + nx * jit, y = A.y + (B.y - A.y) * u + ny * jit, n = Math.max(1, Math.ceil(Math.hypot(x - px0, y - py0)));
            for (let q = 0; q <= n; q++) { const qx = px0 + (x - px0) * q / n, qy = py0 + (y - py0) * q / n; if (k > 0.25) { P(qx + nx, qy + ny, col); P(qx - nx, qy - ny, col); } P(qx, qy, k > 0.15 ? '#ffffff' : col); }
            if (j === Math.floor(M / 2) && k > 0.3) { let bx = x, by = y; for (let q = 0; q < 6; q++) { bx += nx * 1.2 + (B.x - A.x) / L * 0.8; by += ny * 1.2 + (B.y - A.y) / L * 0.8; P(bx, by, col); } }
            px0 = x; py0 = y;
          }
        }
      } else if (f.k === 'cone') {
        g.fillStyle = hexA(f.color, 0.28 * k);
        g.beginPath(); g.moveTo(f.x, f.y - 6); g.arc(f.x, f.y - 6, f.range, f.ang - f.angle / 2, f.ang + f.angle / 2); g.closePath(); g.fill();
      } else if (f.k === 'claws') {
        g.strokeStyle = hexA('#ffffff', k); g.lineWidth = 2.5;
        for (let i = -1; i <= 1; i++) {
          const a = f.ang + Math.PI / 2, ox = Math.cos(a) * i * 6, oy = Math.sin(a) * i * 6;
          const cx = f.x + Math.cos(f.ang) * f.r * 0.7, cy = f.y - 6 + Math.sin(f.ang) * f.r * 0.7;
          g.beginPath(); g.moveTo(cx - Math.cos(f.ang + 0.9) * 12 + ox, cy - Math.sin(f.ang + 0.9) * 12 + oy); g.lineTo(cx + Math.cos(f.ang + 0.9) * 12 + ox, cy + Math.sin(f.ang + 0.9) * 12 + oy); g.stroke();
        }
      } else if (f.k === 'slashX') {
        g.strokeStyle = hexA(f.color, k); g.lineWidth = 5 * k + 1;
        const L = 22 * (1.3 - k * 0.3);
        for (const s2 of [1, -1]) { g.beginPath(); g.moveTo(f.x - L, f.y - L * s2); g.lineTo(f.x + L, f.y + L * s2); g.stroke(); }
        g.strokeStyle = hexA('#ffffff', k); g.lineWidth = 1.5;
        for (const s2 of [1, -1]) { g.beginPath(); g.moveTo(f.x - L, f.y - L * s2); g.lineTo(f.x + L, f.y + L * s2); g.stroke(); }
      } else if (f.k === 'bite2') {
        g.fillStyle = hexA('#ffffff', k);
        for (let i = 0; i < 5; i++) { const x = f.x - 12 + i * 6, o = (1 - k) * 6; g.beginPath(); g.moveTo(x, f.y - 12 + o); g.lineTo(x + 3, f.y - 3 + o); g.lineTo(x + 6, f.y - 12 + o); g.fill(); g.beginPath(); g.moveTo(x, f.y + 12 - o); g.lineTo(x + 3, f.y + 3 - o); g.lineTo(x + 6, f.y + 12 - o); g.fill(); }
      } else if (f.k === 'pillar') {
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(0, f.y - 120, 0, f.y);
        gr.addColorStop(0, hexA(f.color, 0)); gr.addColorStop(1, hexA(f.color, 0.7 * k));
        g.fillStyle = gr; const pw = f.r * 0.8 * (0.5 + k * 0.5);
        g.fillRect(f.x - pw / 2, f.y - 120, pw, 120);
        g.fillStyle = hexA('#ffffff', 0.6 * k); g.fillRect(f.x - pw / 6, f.y - 120, pw / 3, 120);
        g.restore();
      } else if (f.k === 'cracks') { // 땅 갈라짐: 가운데에서 들쭉날쭉 뻗고 잔가지가 난다 (빠르게 번졌다가 옅어진다)
        if (!f.lines) {
          f.lines = [];
          const n = 7 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            let a = (i / n) * Math.PI * 2 + Math.random() * 0.5, x = 0, y = 0; const pts = [[0, 0]], len = f.r * (0.45 + Math.random() * 0.4);
            for (let j = 0; j < 6; j++) {
              a += (Math.random() - 0.5) * 0.9; x += Math.cos(a) * len / 6; y += Math.sin(a) * len / 6 * 0.6; pts.push([x, y]);
              if (j === 2 || (j === 4 && Math.random() < 0.5)) { const ba = a + (Math.random() < 0.5 ? 0.8 : -0.8), bl = len * 0.22; f.lines.push({ pts: [[x, y], [x + Math.cos(ba) * bl * 0.5, y + Math.sin(ba) * bl * 0.3], [x + Math.cos(ba + 0.3) * bl, y + Math.sin(ba + 0.3) * bl * 0.6]], d: (j + 1) / 6 }); }
            }
            f.lines.push({ pts, d: 0 });
          }
        }
        const grow = Math.min(1, (f.max - f.t) / 0.14), a = Math.min(1, k * 1.8);
        for (const ln of f.lines) {
          if (grow < ln.d) continue;
          const upto = Math.max(1, Math.round((ln.pts.length - 1) * Math.min(1, ln.d ? (grow - ln.d) / (1 - ln.d + 0.001) * 2 : grow)));
          const path = (dx, dy) => { g.beginPath(); ln.pts.slice(0, upto + 1).forEach(([px, py], i) => (i ? g.lineTo(f.x + px + dx, f.y + py + dy) : g.moveTo(f.x + px + dx, f.y + py + dy))); g.stroke(); };
          g.strokeStyle = hexA('#e8dcc4', 0.35 * a); g.lineWidth = 1; path(0, 1);   // 깨진 가장자리의 밝은 면
          g.strokeStyle = hexA('#1e1610', 0.75 * a); g.lineWidth = ln.d ? 0.8 : 1.3; path(0, 0); // 갈라진 틈
        }
      } else if (f.k === 'shards') {
        g.fillStyle = hexA(f.color, k);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + f.seed, d2 = f.r * (0.3 + 0.6 * ((i * 37) % 10) / 10);
          const x = f.x + Math.cos(a) * d2, y = f.y + Math.sin(a) * d2 * 0.6, h = 10 * k + 4;
          g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 3, y); g.lineTo(x - 3, y); g.closePath(); g.fill();
        }
      } else if (f.k === 'castCircle') {
        const p2 = this.world.player, prog = 1 - k, open = easeOut(Math.min(1, (f.max - f.t) / 0.15));
        // 바닥 고리 대신: 발밑이 은은히 밝아지고, 주변의 기운이 지팡이 끝으로 빨려든다
        this.glow(p2.x, p2.y + 2, 16 * open, f.color, 0.35 + 0.3 * prog);
        if (Math.random() < 0.7) this.parts.push({ x: p2.x + (Math.random() - 0.5) * 34, y: p2.y + 3 + (Math.random() - 0.5) * 12, vx: 0, vy: -40 - Math.random() * 40, t: 0.6, max: 0.6, color: f.color, g: -10, glow: true });
        for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 10, tx = p2.x + p2.dir * 7, ty = p2.y - 22; this.parts.push({ x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, vx: -Math.cos(a) * d * 3.2, vy: -Math.sin(a) * d * 3.2, t: 0.3, max: 0.3, color: i ? '#ffffff' : f.color, g: 0, glow: true, size: 1 }); }
        if (this.world.player.castT <= 0) f.t = 0;
      } else if (f.k === 'rune') {
        this.runeCircle(f.x, f.y, f.r * (0.6 + 0.4 * easeOut(1 - k)), f.color, this.world.t * 1.5, k);
      } else if (f.k === 'beam') { // 감시안의 광선: 붉은 빛줄기가 굵어졌다 가늘어진다
        const q = k, w1 = 5 * q;
        g.save(); g.lineCap = 'round';
        g.strokeStyle = `rgba(255,40,40,${0.5 * q})`; g.lineWidth = w1 + 4; g.beginPath(); g.moveTo(f.x1, f.y1); g.lineTo(f.x2, f.y2); g.stroke();
        g.strokeStyle = `rgba(255,200,180,${q})`; g.lineWidth = Math.max(1, w1); g.beginPath(); g.moveTo(f.x1, f.y1); g.lineTo(f.x2, f.y2); g.stroke();
        g.restore();
      } else if (f.k === 'arm') { // 망령의 팔: 마디진 창백한 팔이 쭉 뻗어 움켜쥐고 줄어든다
        const age = f.max - f.t, out = easeOut(Math.min(1, age / 0.14)), back = age > 0.3 ? 1 - (age - 0.3) / 0.25 : 1, r = out * Math.max(0, back);
        const ex = f.x1 + (f.x2 - f.x1) * r, ey = f.y1 + (f.y2 - f.y1) * r, n = 7, ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
        g.save(); g.lineCap = 'round';
        for (const [w0, c] of [[5, 'rgba(20,14,30,0.85)'], [3, 'rgba(200,190,230,0.9)']]) {
          g.strokeStyle = c; g.lineWidth = w0; g.beginPath(); g.moveTo(f.x1, f.y1);
          for (let i = 1; i <= n; i++) { const q = i / n, wob = Math.sin(q * 9 + age * 30) * 1.6 * (1 - q); g.lineTo(f.x1 + (ex - f.x1) * q - Math.sin(ang) * wob, f.y1 + (ey - f.y1) * q + Math.cos(ang) * wob); }
          g.stroke();
        }
        g.fillStyle = 'rgba(235,228,255,0.95)';
        for (let i = 1; i < n; i++) { const q = i / n; g.fillRect(Math.round(f.x1 + (ex - f.x1) * q) - 1, Math.round(f.y1 + (ey - f.y1) * q) - 1, 2, 2); } // 마디
        g.strokeStyle = 'rgba(235,228,255,0.95)'; g.lineWidth = 1.5;
        for (const da of [-0.7, 0, 0.7]) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + Math.cos(ang + da) * 5, ey + Math.sin(ang + da) * 5); g.stroke(); } // 손가락
        g.restore();
        if (Math.random() < 0.5) this.parts.push({ x: ex, y: ey, vx: (Math.random() - 0.5) * 20, vy: -10, t: 0.4, max: 0.4, color: '#c8b8ff', g: -10, glow: true });
      } else if (f.k === 'scrape') {
        g.fillStyle = `rgba(30,22,16,${0.35 * k})`; g.fillRect(Math.round(f.x) - 1, Math.round(f.y), 2, 1);
      } else if (f.k === 'scorch') { // 그을린 땅: 얼룩덜룩한 검댕, 가운데 불씨는 시간이 지나며 식는다
        const a = Math.min(1, k * 2.2), heat = Math.max(0, 1 - (f.max - f.t) / 2.2);
        f.blots ||= Array.from({ length: 9 }, (_, i) => { const an = Math.random() * Math.PI * 2, d = i ? f.r * (0.25 + Math.random() * 0.55) : 0; return { x: Math.cos(an) * d, y: Math.sin(an) * d * 0.55, r: f.r * (i ? 0.22 + Math.random() * 0.2 : 0.5) }; });
        for (const b of f.blots) { g.fillStyle = `rgba(24,14,10,${0.2 * a})`; ellipse(g, f.x + b.x, f.y + b.y, b.r, b.r * 0.55); }
        if (heat > 0) for (const b of f.blots) { g.fillStyle = `rgba(255,${100 + 60 * heat | 0},40,${0.22 * heat * (0.6 + 0.4 * Math.sin(this.world.t * 7 + b.x))})`; ellipse(g, f.x + b.x, f.y + b.y, b.r * 0.35, b.r * 0.2); }
        if (Math.random() < 0.15 * heat) this.parts.push({ x: f.x + (Math.random() - 0.5) * f.r * 1.2, y: f.y + (Math.random() - 0.5) * f.r * 0.5, vx: 0, vy: -20, t: 0.6, max: 0.6, color: '#ff8a3a', g: -20, glow: true, size: 1 });
      } else if (f.k === 'glow') {
        this.glow(f.x, f.y, f.r * (1.3 - k * 0.3), f.color, k);
      } else if (f.k === 'echo') {
        const p2 = this.world.player, img = sprite(frames(RACE_ART[w.b.race].base, 'idle')[0], 'brightness(1.6) sepia(1) hue-rotate(220deg) saturate(3)', false, p2.dir < 0);
        if (img) { g.globalAlpha = 0.35 + 0.25 * Math.sin(this.world.t * 20); g.drawImage(img, Math.round(f.x - img.width / 2), Math.round(f.y + 5 - img.height)); g.globalAlpha = 1; }
        this.runeCircle(f.x, f.y + 3, f.r * 0.5 * (1 - k * 0.5), '#b98aff', this.world.t * 2, 0.6);
      } else if (f.k === 'path') {
        g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = hexA('#b98aff', 0.8 * k); g.lineWidth = 2; g.setLineDash([3, 3]);
        g.beginPath(); f.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y - 6) : g.moveTo(q.x, q.y - 6))); g.stroke(); g.setLineDash([]); g.restore();
      } else if (f.k === 'chain') {
        const e1 = w.enemies.find((e) => e.id === f.a), e2 = w.enemies.find((e) => e.id === f.b);
        if (!e1 || !e2) { f.t = 0; continue; }
        g.strokeStyle = hexA('#c45cff', 0.7); g.lineWidth = 1.5; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(e1.x, e1.y - 6); g.lineTo(e2.x, e2.y - 6); g.stroke(); g.setLineDash([]);
      } else if (f.k === 'parryStance') {
        const p2 = this.world.player;
        g.strokeStyle = `rgba(255,240,180,${0.5 + 0.3 * Math.sin(this.world.t * 20)})`; g.lineWidth = 2;
        g.beginPath(); g.arc(p2.x + p2.aimX * 6, p2.y - 7 + p2.aimY * 6, 13, Math.atan2(p2.aimY, p2.aimX) - 1.2, Math.atan2(p2.aimY, p2.aimX) + 1.2); g.stroke();
        if (this.world.player.parryT <= 0) f.t = 0;
      } else if (f.k === 'link') {
        g.strokeStyle = hexA(f.color || '#c45cff', k); g.lineWidth = 1.5; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(f.x1, f.y1 - 6); g.lineTo(f.x2, f.y2 - 6); g.stroke(); g.setLineDash([]);
      } else if (f.k === 'lock') { // 자동 조준 표적 (도트): 바깥에서 조여드는 네 모서리 꺾쇠 + 맞물리는 순간 가운데 십자
        const col = f.ult ? '#ff5ad0' : f.kind === 'tank' ? '#ff6a4a' : f.kind === 'low' ? '#ff3a6a' : f.kind === 'cluster' ? '#ffcf5a' : f.kind === 'away' ? '#bfe8d0' : '#7ad8ff';
        const age = f.max - f.t, shrink = easeOut(Math.min(1, age / 0.18)), al = Math.min(1, k * 2);
        const R = Math.round(19 - 8 * shrink), cx = Math.round(f.x), cy = Math.round(f.y - 6), L = f.ult ? 5 : 4;
        const arms = (x, y, sx, sy, d) => { // 꺾쇠 한 개: 가로 팔 + 세로 팔 (d만큼 두껍게 = 테두리)
          g.fillRect((sx < 0 ? x : x - L + 1) - d, y - d, L + d * 2, 1 + d * 2);
          g.fillRect(x - d, (sy < 0 ? y : y - L + 1) - d, 1 + d * 2, L + d * 2);
        };
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        g.fillStyle = hexA('#120c1a', 0.75 * al); for (const [sx, sy] of corners) arms(cx + sx * R, cy + sy * R, sx, sy, 1);
        g.fillStyle = hexA(col, al); for (const [sx, sy] of corners) arms(cx + sx * R, cy + sy * R, sx, sy, 0);
        if (f.ult) { g.fillStyle = hexA(col, 0.55 * al); for (const [sx, sy] of corners) arms(cx + sx * (R + 3), cy + sy * (R + 3), sx, sy, 0); }
        if (shrink >= 1 && age < 0.3) { // 맞물림: 흰 십자가 잠깐 반짝
          const fl = 1 - (age - 0.18) / 0.12;
          g.fillStyle = hexA('#120c1a', 0.6 * fl); g.fillRect(cx - 3, cy - 1, 7, 3); g.fillRect(cx - 1, cy - 3, 3, 7);
          g.fillStyle = hexA('#ffffff', 0.95 * fl); g.fillRect(cx - 2, cy, 5, 1); g.fillRect(cx, cy - 2, 1, 5);
        }
      } else if (f.k === 'fall' && f.kind === 'fireball') {
        const prog = 1 - k, h = 220 * (1 - prog * prog);
        const x = f.x - h * 0.45, y = f.y - h, t2 = this.world.t;
        // 땅의 예고 그림자와 빛
        g.fillStyle = `rgba(0,0,0,${0.3 * prog})`; ellipse(g, f.x, f.y, f.r * 0.7 * prog, f.r * 0.35 * prog);
        this.glow(f.x, f.y, f.r * prog, '#ff6a1a', 0.5 * prog);
        // 꼬리
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 12; i >= 1; i--) { const tx = x + i * 0.45 * 6, ty = y - i * 6; g.fillStyle = hexA(i > 7 ? '#ff3a0a' : i > 3 ? '#ff7a1a' : '#ffc040', 0.18); disc(g, tx + Math.sin(t2 * 20 + i) * 2, ty, 20 - i * 1.2); }
        this.glow(x, y, 60, '#ff7a2a', 0.9);
        g.restore();
        // 불덩이 몸통: 바깥 불꽃 혀 → 주황 → 노랑 → 흰 심
        for (let i = 0; i < 10; i++) { const a = t2 * 6 + i * 0.63, rr = 20 + Math.sin(t2 * 17 + i * 2) * 4; g.fillStyle = i % 2 ? '#ff4a12' : '#ff7a1a'; g.beginPath(); g.moveTo(x + Math.cos(a - 0.3) * 14, y + Math.sin(a - 0.3) * 14); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); g.lineTo(x + Math.cos(a + 0.3) * 14, y + Math.sin(a + 0.3) * 14); g.fill(); }
        g.fillStyle = '#e8400e'; disc(g, x, y, 16); g.fillStyle = '#ff8a1a'; disc(g, x - 1, y - 1, 12.5); g.fillStyle = '#ffd040'; disc(g, x - 2, y - 2, 8); g.fillStyle = '#fff6d0'; disc(g, x - 3, y - 3, 4);
        for (let i = 0; i < 4; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 24, vx: 40 + Math.random() * 40, vy: -60 - Math.random() * 40, t: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd040', g: -10, glow: true, size: 2 });
        if (f.t < 0.03 && !f.boom) { f.boom = true; this.fireballBoom(f.x, f.y, f.r); }
      } else if (f.k === 'fall') {
        // 하늘에서 떨어지는 운석
        const prog = 1 - k, h = 180 * (1 - prog * prog);
        const x = f.x - h * 0.35, y = f.y - h;
        const big = f.kind === 'fireball' ? 1.6 : 1;
        this.glow(x, y, 26, '#ff7a2a', 0.8);
        g.fillStyle = `rgba(0,0,0,${0.25 * prog})`; ellipse(g, f.x, f.y, f.r * 0.5 * prog * big, f.r * 0.2 * prog * big);
        for (let i = 6; i >= 1; i--) { g.fillStyle = hexA(i > 3 ? '#ff5a1a' : '#ffb040', 0.25); disc(g, x + i * 0.35 * 5, y - i * 5, (9 - i) * big); }
        g.fillStyle = '#ff7a2a'; disc(g, x, y, 11 * big); g.fillStyle = '#ffd040'; disc(g, x - 1, y - 1, 7 * big); g.fillStyle = '#fff6c0'; disc(g, x - 2, y - 2, 3.5 * big);
        if (Math.random() < 0.9) this.parts.push({ x: x + (Math.random() - 0.5) * 10 * big, y: y + (Math.random() - 0.5) * 10 * big, vx: 30, vy: -40, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd040', g: -20 });
      } else if (f.k === 'lineTele') { // 예고선: 땅 위 점묘 띠 · 가장자리 실선, 시작점부터 끝까지 진하게 차오르면 그때 맞는다
        const L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1) || 1, ux = (f.x2 - f.x1) / L, uy = (f.y2 - f.y1) / L, hw = Math.max(1, Math.round((f.w || 6) / 2)), fill = (1 - k) * L, col = f.color || '#ff5a3a';
        for (let d = 0; d < L; d += 1) for (let h = -hw; h <= hw; h++) {
          const x = Math.round(f.x1 + ux * d - uy * h), y = Math.round(f.y1 + uy * d + ux * h), edge = Math.abs(h) === hw;
          if (edge) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } else if (d < fill ? (x + y) % 2 === 0 : (x + y) % 4 === 0) { g.fillStyle = d < fill ? col : hexA(col, 0.6); g.fillRect(x, y, 1, 1); }
        }
      } else if (f.k === 'line') {
        if (f.fx === 'spikes') {
          const n = Math.floor(Math.hypot(f.x2 - f.x1, f.y2 - f.y1) / 12);
          for (let i = 1; i <= n; i++) {
            const x = f.x1 + (f.x2 - f.x1) * i / n, y = f.y1 + (f.y2 - f.y1) * i / n, h = (14 + (i % 3) * 5) * Math.min(1, (f.max - f.t) * 10 - i * 0.12 + 0.5);
            if (h <= 0) continue;
            g.fillStyle = hexA('#c8f0ff', k); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 4, y + 2); g.lineTo(x - 4, y + 2); g.closePath(); g.fill();
            g.fillStyle = hexA('#ffffff', k); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 1, y); g.lineTo(x - 1.5, y); g.closePath(); g.fill();
          }
        } else { // 일직선 일격: 앞으로 날아가는 머리(참격 초승달 · 거대한 화살) + 머리 쪽이 굵고 꼬리가 가는 바람 자국 (빛 막대 대신)
          const dx = f.x2 - f.x1, dy = f.y2 - f.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, ang = Math.atan2(dy, dx);
          const age = f.max - f.t, travel = Math.min(1, age / 0.16), tailU = Math.max(0, Math.min(travel, (age - 0.05) / (f.max * 0.8)));
          const hx = f.x1 + dx * travel, hy = f.y1 - 6 + dy * travel, tx = f.x1 + dx * tailU, ty = f.y1 - 6 + dy * tailU, W = f.w * 0.5 * (0.5 + 0.5 * k);
          if (f.fx === 'skyfall') { // 땅에 남는 칼자국
            g.strokeStyle = hexA('#1e1610', 0.6 * k); g.lineWidth = 1.5; g.beginPath(); g.moveTo(f.x1, f.y1 + 2); g.lineTo(f.x1 + dx * travel, f.y1 + 2 + dy * travel); g.stroke();
            g.strokeStyle = hexA('#fff0b0', 0.5 * k); g.lineWidth = 0.8; g.beginPath(); g.moveTo(f.x1, f.y1 + 1); g.lineTo(f.x1 + dx * travel, f.y1 + 1 + dy * travel); g.stroke();
          }
          for (const [c, wm, al] of [[f.color, 1, 0.22], [f.color, 0.55, 0.4], ['#ffffff', 0.16, 0.7]]) {
            g.fillStyle = hexA(c, al * k); g.beginPath(); g.moveTo(tx, ty);
            g.quadraticCurveTo(hx - ux * 14 + nx * W * wm, hy - uy * 14 + ny * W * wm, hx, hy);
            g.quadraticCurveTo(hx - ux * 14 - nx * W * wm, hy - uy * 14 - ny * W * wm, tx, ty); g.closePath(); g.fill();
          }
          if (travel < 1 || age < 0.24) {
            const ha = travel < 1 ? 1 : Math.max(0, 1 - (age - 0.16) / 0.08);
            g.save(); g.translate(hx, hy); g.rotate(ang);
            if (f.fx === 'arrowBeam') { // 거대한 화살: 촉 · 살대 · 깃
              g.globalAlpha = ha;
              g.fillStyle = '#5a4a36'; g.fillRect(-26, -1.2, 24, 2.4);
              g.fillStyle = '#e8ffd0'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-3, -5); g.lineTo(-1, 0); g.lineTo(-3, 5); g.closePath(); g.fill();
              g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-1, -2); g.lineTo(-1, 2); g.closePath(); g.fill();
              g.fillStyle = '#c8e8a8'; for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(-20, 0); g.lineTo(-27, sy * 5); g.lineTo(-23, sy * 1); g.closePath(); g.fill(); }
              g.globalAlpha = 1;
            } else { // 참격: 앞으로 볼록한 초승달
              g.fillStyle = hexA(f.color, 0.55 * ha); smear(g, -W * 0.9, 0, W * 1.1, W * 0.55, -1.15, 1.15);
              g.fillStyle = hexA('#ffffff', 0.9 * ha); smear(g, -W * 0.9, 0, W * 1.1, W * 0.18, -1.05, 1.05);
            }
            g.restore();
            if (dt > 0 && travel < 1) for (let i = 0; i < 3; i++) { const o = (Math.random() - 0.5) * W * 2; this.parts.push({ x: hx - ux * 6 + nx * o, y: hy + 6 - uy * 6 + ny * o * 0.6, vx: -ux * 40 + nx * o * 3, vy: -uy * 40 - 10, t: 0.5, max: 0.5, color: '#c8bca8', g: -4, steam: true }); }
          }
        }
      } else if (f.k === 'gravity') {
        for (let i = 0; i < 3; i++) { g.strokeStyle = hexA('#b98aff', 0.6 * k); g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, f.r * (k * (1 - i * 0.25)), this.world.t * 6 + i, this.world.t * 6 + i + 4); g.stroke(); }
        g.fillStyle = hexA('#1a0a30', 0.6); disc(g, f.x, f.y, 6 + 6 * (1 - k));
        for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r, vx: -Math.cos(a) * f.r * 2.5, vy: -Math.sin(a) * f.r * 2.5, t: 0.35, max: 0.35, color: '#b98aff', g: 0 }); }
      } else if (f.k === 'implode') {
        g.fillStyle = hexA(f.color, 0.35 * k); disc(g, f.x, f.y, f.r * (1.2 - k * 0.6));
        g.fillStyle = hexA('#ffffff', 0.7 * k); disc(g, f.x, f.y, f.r * 0.25 * k);
      } else if (f.k === 'vines') {
        // 땅을 뚫고 솟는 덩굴 줄기: 외곽선 · 잎 · 끝이 말린 모양
        const al = Math.min(1, k * 3), grow = easeOut(Math.min(1, (f.max - f.t) * 5));
        g.fillStyle = `rgba(50,36,22,${0.5 * al})`; ellipse(g, f.x, f.y, f.r, f.r * 0.5);
        for (let i = 0; i < 11; i++) {
          const a = (i / 11) * Math.PI * 2 + f.seed, rr = f.r * (0.25 + ((i * 7) % 5) / 6.5);
          const x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.5, h = (12 + (i % 3) * 5) * grow;
          const sw = Math.sin(this.world.t * 3 + i) * 3, cx2 = x + sw, cy2 = y - h * 0.55, ex = x + 4 * (i % 2 ? 1 : -1) + sw * 0.5, ey = y - h;
          for (const [lw, c2] of [[3.2, `rgba(16,36,12,${al})`], [1.8, hexA(f.color, al)]]) { g.strokeStyle = c2; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx2, cy2, ex, ey); g.stroke(); }
          g.strokeStyle = hexA(f.color, al); g.lineWidth = 1.2; g.beginPath(); g.arc(ex + (i % 2 ? -2 : 2), ey, 2, 0, Math.PI * 1.4); g.stroke();
          if (grow > 0.6) { g.fillStyle = `rgba(150,230,100,${al})`; g.fillRect(Math.round(cx2 + 1), Math.round(cy2), 3, 2); g.fillStyle = `rgba(210,255,160,${al})`; g.fillRect(Math.round(cx2 + 1), Math.round(cy2), 1, 1); }
        }
      } else if (f.k === 'arrowDrop') {
        const h = 40 * k;
        g.strokeStyle = '#e8d8b0'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(f.x + h * 0.3, f.y - h - 10); g.lineTo(f.x + h * 0.3 - 3, f.y - h); g.stroke();
        if (f.t < 0.03) this.sparkBurst(f.x, f.y, '#e8d8b0', 3);
      } else if (f.k === 'chargeGlow') {
        const p2 = this.world.player;
        for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: p2.x + Math.cos(a) * 26, y: p2.y - 8 + Math.sin(a) * 26, vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 70, t: 0.35, max: 0.35, color: '#ffe080', g: 0 }); }
      } else if (f.k === 'bloom') { // 빛 번짐: 빠르게 커지며 사라진다
        const rr = f.r * (0.55 + 0.45 * (1 - k * k)), gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
        gr.addColorStop(0, hexA('#ffffff', 0.75 * k)); gr.addColorStop(0.25, hexA(f.color, 0.55 * k)); gr.addColorStop(1, hexA(f.color, 0));
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.translate(f.x, f.y); g.scale(1, 0.75); g.translate(-f.x, -f.y); g.beginPath(); g.arc(f.x, f.y, rr, 0, Math.PI * 2); g.fill(); g.restore();
      } else if (f.k === 'starburst') { // 별빛살: 가늘고 날카로운 빛줄기가 뻗었다 줄어든다
        g.save(); g.globalCompositeOperation = 'lighter'; g.translate(f.x, f.y);
        const ext = f.r * (0.4 + 0.6 * Math.sqrt(1 - k));
        for (let i = 0; i < f.n; i++) {
          const a = f.rot + (i / f.n) * Math.PI * 2, L = ext * (i % 2 ? 0.6 : 1), wd = (i % 2 ? 1.2 : 2.2) * k + 0.4;
          const ca = Math.cos(a), sa = Math.sin(a) * 0.7, nx = -sa, ny = ca;
          g.fillStyle = hexA(i % 2 ? f.color : '#ffffff', 0.85 * k);
          g.beginPath(); g.moveTo(nx * wd, ny * wd); g.lineTo(ca * L, sa * L); g.lineTo(-nx * wd, -ny * wd); g.closePath(); g.fill();
        }
        g.restore();
      } else if (f.k === 'scorch') { // 그을린 자리: 땅에 남았다가 서서히 옅어진다 (가장자리는 속성 빛이 식어 간다)
        const a = Math.min(1, k * 2.5);
        g.save(); g.translate(f.x, f.y); g.scale(1, 0.5);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, f.r);
        gr.addColorStop(0, `rgba(20,14,12,${0.42 * a})`); gr.addColorStop(0.7, `rgba(30,20,16,${0.25 * a})`); gr.addColorStop(1, 'rgba(30,20,16,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, f.r, 0, Math.PI * 2); g.fill();
        if (k > 0.5) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = hexA(f.color, (k - 0.5) * 0.9); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, f.r * 0.82, 0, Math.PI * 2); g.stroke(); }
        g.restore();
      } else if (f.k === 'pillar') { // 빛기둥: 하늘에서 꽂혀 굵어졌다 가늘어진다
        const prog = 1 - k, wd = f.r * (prog < 0.15 ? prog / 0.15 : 1 - (prog - 0.15) * 0.9), top = f.y - 260;
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(f.x - wd, 0, f.x + wd, 0);
        gr.addColorStop(0, hexA(f.color, 0)); gr.addColorStop(0.5, hexA('#ffffff', 0.9 * k)); gr.addColorStop(1, hexA(f.color, 0));
        g.fillStyle = gr; g.fillRect(f.x - wd, top, wd * 2, f.y - top);
        const g2 = g.createLinearGradient(f.x - wd * 2.2, 0, f.x + wd * 2.2, 0); g2.addColorStop(0, hexA(f.color, 0)); g2.addColorStop(0.5, hexA(f.color, 0.35 * k)); g2.addColorStop(1, hexA(f.color, 0));
        g.fillStyle = g2; g.fillRect(f.x - wd * 2.2, top, wd * 4.4, f.y - top);
        g.restore();
      } else if (f.k === 'after') { // 여진: 잠깐 뒤 한 번 더 울린다
        if (!f.done && k < 0.05) { f.done = true; this.shockwave(f.x, f.y, f.r * 0.8, f.color, 24); this.shake = Math.max(this.shake, 5); this.fx.push({ k: 'bloom', x: f.x, y: f.y - 4, r: f.r * 1.2, color: f.color, t: 0.3, max: 0.3 }); }
      } else if (f.k === 'tdonut') { // 고리 폭발: 바깥 고리가 위험 · 안쪽 원은 안전 (초록)
        const ry = 0.62, a = 0.12 + 0.3 * (1 - k);
        g.save(); g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * ry, 0, 0, Math.PI * 2); g.ellipse(f.x, f.y, f.inner, f.inner * ry, 0, 0, Math.PI * 2);
        g.fillStyle = `rgba(150,215,255,${a})`; g.fill('evenodd'); g.restore();
        this.dline(f.x, f.y, f.r, f.r * ry, 'rgba(225,245,255,0.95)', this.world.t * 6, 3, 2);
        this.dline(f.x, f.y, f.inner + (f.r - f.inner) * (1 - k), (f.inner + (f.r - f.inner) * (1 - k)) * ry, 'rgba(255,255,255,0.9)', -this.world.t * 9, 2, 1);
        this.dline(f.x, f.y, f.inner, f.inner * ry, 'rgba(140,255,170,0.95)', -this.world.t * 5, 3, 2);
      } else if (f.k === 'tcircle') {
        if (f.follow) { f.x = this.world.player.x; f.y = this.world.player.y; }
        this.dfill(f.x, f.y, f.r, f.r * 0.62, '#ff5a3a', 0.1 + 0.22 * (1 - k)); // 떨어질 자리: 점묘가 점점 짙어진다
        this.dline(f.x, f.y, f.r, f.r * 0.62, 'rgba(255,214,180,0.95)', this.world.t * 8, 3, 2);
        if (k < 0.97) this.dline(f.x, f.y, f.r * (1 - k), f.r * 0.62 * (1 - k), 'rgba(255,255,255,0.95)', -this.world.t * 10, 2, 1);
        g.fillStyle = 'rgba(255,240,255,0.9)'; for (const [dx, dy] of [[-3, 0], [3, 0], [0, -2], [0, 2]]) g.fillRect(Math.round(f.x + dx), Math.round(f.y + dy), 1, 1);
      } else if (f.k === 'spin') {
        // 칼을 든 내 회전은 칼 잔상(bladeTrail)이 칼끝을 따라 그린다. 칼이 없는 회전(꼬리 · 몸통)만 짧은 초승달 하나 (몸을 감싸는 고리는 그리지 않는다)
        const bladeOn = f.own && this.trailDrawnT != null && w.t - this.trailDrawnT < 0.06;
        if (!bladeOn) {
          const prog = 1 - k, head = f.a0 + f.dir * Math.PI * 1.7 * Math.min(1, prog * 1.4), tail = head - f.dir * 1.8;
          const cx = f.follow ? p.x : f.x, cy = (f.follow ? p.y : f.y) - 6, R = (f.r || 40) * 0.8, col = f.heavy ? '#ffd050' : f.type === 'mag' ? '#c9a8ff' : '#e8f0ff';
          g.save(); g.translate(cx, cy); g.scale(1, 0.8);
          g.fillStyle = hexA(col, 0.4 * Math.min(1, k * 2)); smear(g, 0, 0, R, f.heavy ? 11 : 8, f.dir > 0 ? tail : head, f.dir > 0 ? head : tail);
          g.fillStyle = hexA('#ffffff', 0.9 * Math.min(1, k * 2)); smear(g, 0, 0, R, f.heavy ? 3.5 : 2.5, f.dir > 0 ? tail : head, f.dir > 0 ? head : tail);
          g.restore();
        }
      } else if (f.k === 'nova') {
        // 마력이 몸에서 터져 나간다: 짧은 빛 줄기들이 바깥으로 뻗었다 사라진다 (고리 없음)
        const col = f.color || '#b58cff', prog = 1 - k, n = 14;
        f.seed ??= Math.random() * 1000;
        g.save(); g.globalCompositeOperation = 'lighter';
        this.glow(f.x, f.y - 6, f.r * 0.6, col, k * 0.8);
        for (let i = 0; i < n; i++) {
          const h = Math.sin(f.seed + i * 7.31) * 9547.13, rnd = h - Math.floor(h), a = (i / n) * Math.PI * 2 + rnd * 0.4;
          const r0 = f.r * (0.15 + prog * 0.75), r1 = r0 + f.r * (0.18 + rnd * 0.12) * k;
          g.strokeStyle = hexA(i % 3 ? col : '#ffffff', 0.9 * k); g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(f.x + Math.cos(a) * r0, f.y - 6 + Math.sin(a) * r0 * 0.62); g.lineTo(f.x + Math.cos(a) * r1, f.y - 6 + Math.sin(a) * r1 * 0.62); g.stroke();
        }
        g.restore();
      } else if (f.k === 'claw') {
        g.strokeStyle = hexA('#ff4040', k); g.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          g.beginPath(); g.arc(f.x, f.y - 4, f.r + i * 3, f.ang - 0.6, f.ang + 0.6); g.stroke();
        }
      } else if (f.k === 'ghost') {
        const art = RACE_ART[w.b.race];
        const img = sprite(frames(art.base, 'run')[0], f.tint || 'brightness(2) saturate(0)', false, (f.dir || p.dir) < 0);
        if (img) { g.globalAlpha = k * (f.tint ? 0.7 : 0.5); g.drawImage(img, Math.round(f.x - img.width / 2), Math.round(f.y + 5 - img.height)); g.globalAlpha = 1; }
      } else if (f.k === 'spellBlade') { // 근접 마법 초승달: 바깥은 속성 빛, 안쪽은 흰 날
        const prog = 1 - k, a0 = f.ang - f.angle / 2, a1 = a0 + f.angle * Math.min(1, prog * 3.2);
        g.save(); g.translate(f.x, f.y - 6); g.scale(1, 0.62);
        g.fillStyle = hexA(f.col, 0.55 * Math.min(1, k * 2.2)); smear(g, 0, 0, f.r * 0.92, 9, a0, a1);
        g.fillStyle = hexA('#ffffff', 0.85 * Math.min(1, k * 2.2)); smear(g, 0, 0, f.r * 0.92, 2.5, a0, a1);
        g.restore();
      } else if (f.k === 'cut') { // 초승달 칼자국 두 줄 (가운데가 두껍고 끝이 가늘다)
        const prog = 1 - k;
        for (const [o, col, th] of [[-3, '#8a6aff', 5], [3, '#c8b0ff', 4], [0, '#ffffff', 1.6]]) {
          g.fillStyle = hexA(col, Math.min(1, k * 2.2)); const a0 = f.ang - 1.0 + o * 0.05, a1 = a0 + 2.0 * Math.min(1, prog * 3);
          g.save(); g.translate(f.x, f.y); g.scale(1, 0.75); smear(g, 0, o, 14, th, a0, a1); g.restore();
        }
      } else if (f.k === 'debris') { // 거대 화염구 잔해: 날아가 떨어진 바위 덩이가 한동안 달아올라 연기를 내다 사라진다
        const age = f.max - f.t, fade = Math.min(1, f.t / 1.2);
        for (const pc of f.pieces) {
          const q = Math.min(1, age / pc.fly), x = pc.x0 + (pc.x1 - pc.x0) * q, y = pc.y0 + (pc.y1 - pc.y0) * q - Math.sin(q * Math.PI) * pc.h;
          const s = pc.s, heat = Math.max(0, 1 - age / 2.6);
          g.globalAlpha = fade;
          if (q >= 1) { g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + s * 0.5, s, s * 0.35); }
          g.fillStyle = '#1a1210'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = pc.rot + i * Math.PI / 3, rr = s * (0.75 + ((i * 37) % 5) / 10); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } g.closePath(); g.fill();
          g.fillStyle = '#4a3a34'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = pc.rot + i * Math.PI / 3, rr = s * (0.6 + ((i * 37) % 5) / 12); g.lineTo(x + Math.cos(a) * rr - 0.5, y + Math.sin(a) * rr * 0.8 - 0.5); } g.closePath(); g.fill();
          if (heat > 0) { g.fillStyle = hexA(heat > 0.5 ? '#ffb040' : '#ff5a1a', 0.9 * heat); g.fillRect(Math.round(x - s * 0.3), Math.round(y - 0.5), Math.max(1, Math.round(s * 0.6)), 1); g.fillRect(Math.round(x), Math.round(y - s * 0.4), 1, Math.max(1, Math.round(s * 0.5))); }
          g.globalAlpha = 1;
          if (q >= 1 && heat > 0.1 && Math.random() < 0.05) this.parts.push({ x: x + (Math.random() - 0.5) * s, y: y - s * 0.4, vx: 2, vy: -14, t: 1.2, max: 1.2, color: '#5a4e50', g: -3, steam: true });
          if (q >= 1 && heat > 0.3 && Math.random() < 0.04) this.parts.push({ x, y: y - s * 0.6, vx: 0, vy: -18, t: 0.4, max: 0.4, g: -20, flame: true, size: 0.8, color: '#ffffff' });
        }
      } else if (f.k === 'fireColumn') { // 거대 화염구: 떨어진 자리에서 불길이 솟구쳤다 잦아든다
        const age = f.max - f.t, n = dt > 0 ? Math.round(10 * k) : 0;
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * f.r * 0.3 * (0.5 + age * 2); this.parts.push({ x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d * 0.5, vx: Math.cos(a) * 20, vy: -110 - Math.random() * 110 * k, t: 0.45 + Math.random() * 0.25, max: 0.7, g: -20, flame: true, size: 1 + Math.random() * 0.9, color: '#ffffff' }); }
      } else if (f.k === 'rageSpikes') { // 분노 폭발: 몸에서 끝이 뾰족한 붉은 기운이 사방으로 뻗었다 사그라든다
        const age = f.max - f.t, grow = easeOut(Math.min(1, age / 0.12)), fade = Math.min(1, f.t / 0.25);
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const sp of f.spikes) {
          const L = sp.len * grow, ca = Math.cos(sp.a), sa = Math.sin(sp.a), nx = -sa, ny = ca * 0.7;
          const mx = f.x + Math.cos(sp.a + sp.bend) * L * 0.5, my = f.y + Math.sin(sp.a + sp.bend) * L * 0.35, tx = f.x + ca * L, ty = f.y + sa * L * 0.7;
          for (const [col, wid, al] of [['#ff2a10', sp.w, 0.55], ['#ff8a3a', sp.w * 0.5, 0.8], ['#fff0c0', sp.w * 0.18, 0.9]]) {
            g.fillStyle = hexA(col, al * fade); g.beginPath();
            g.moveTo(f.x + nx * wid, f.y + ny * wid); g.quadraticCurveTo(mx + nx * wid * 0.5, my + ny * wid * 0.5, tx, ty);
            g.quadraticCurveTo(mx - nx * wid * 0.5, my - ny * wid * 0.5, f.x - nx * wid, f.y - ny * wid); g.closePath(); g.fill();
          }
        }
        g.restore();
      } else if (f.k === 'rageHeat') { // 터진 뒤에도 몸에서 붉은 열기가 피어오른다
        const p2 = this.world.player;
        if (dt > 0 && Math.random() < 0.9 * k) this.parts.push({ x: p2.x + (Math.random() - 0.5) * 12, y: p2.y - Math.random() * 16, vx: (Math.random() - 0.5) * 10, vy: -26 - Math.random() * 24, t: 0.6, max: 0.6, g: -12, glow: true, size: 1, color: Math.random() < 0.3 ? '#ffb060' : '#ff4a22' });
      } else if (f.k === 'rageCracks') { // 땅에 번지는 붉은 균열 (분노 폭발)
        const grow = Math.min(1, (f.max - f.t) / 0.18), a = Math.min(1, f.t / 0.6);
        for (const cr of f.list) {
          g.strokeStyle = hexA('#2a0a06', 0.8 * a); g.lineWidth = 3; g.beginPath(); cr.forEach(([x, y], i) => { const u = Math.min(1, grow * cr.length / (i + 1)); if (!i) g.moveTo(f.x + x, f.y + y); else if (u >= 1) g.lineTo(f.x + x, f.y + y); }); g.stroke();
          g.strokeStyle = hexA('#ff5a2a', a); g.lineWidth = 1.5; g.beginPath(); cr.forEach(([x, y], i) => { if (!i) g.moveTo(f.x + x, f.y + y); else if (i / cr.length <= grow) g.lineTo(f.x + x, f.y + y); }); g.stroke();
          g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = hexA('#ffb060', 0.5 * a); g.lineWidth = 0.8; g.beginPath(); cr.forEach(([x, y], i) => { if (!i) g.moveTo(f.x + x, f.y + y); else if (i / cr.length <= grow) g.lineTo(f.x + x, f.y + y); }); g.stroke(); g.restore();
        }
      } else if (f.k === 'glyphs') { // 용언 문장: 허공에 세 글자를 한 획씩 써 내려가고 → 가운데로 모여 하나가 되고 → 목표에 날아가 땅에 새겨진다
        const age = f.max - f.t, WRITE = 0.15, MERGE = 0.45, FLY = 0.58, HIT = 0.72;
        const ox = f.x, oy = f.y - 44, cols = f.words.map((wd) => WORD_COLOR[wd] || '#ffb066');
        if (age < FLY) { // 쓰기 · 합치기
          const mk = Math.max(0, Math.min(1, (age - MERGE) / (FLY - MERGE))), mE = mk * mk;
          f.words.forEach((wd, i) => {
            const prog = Math.max(0, Math.min(1, (age - i * WRITE) / WRITE));
            if (prog <= 0) return;
            const gx = ox + (i - 1) * 22 * (1 - mE), gy = oy + Math.sin(age * 5 + i) * 1.2, pen = {};
            this.drawGlyph(wd, gx, gy, 1.5 * (1 - 0.3 * mE), cols[i], 1, 0, prog, pen);
            if (prog < 1 && dt > 0) for (let j = 0; j < 2; j++) this.parts.push({ x: pen.x, y: pen.y, vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 20, t: 0.35, max: 0.35, color: Math.random() < 0.5 ? '#fff6e0' : cols[i], g: 60, glow: true, size: 1 });
          });
          if (mk > 0) { g.save(); g.globalCompositeOperation = 'lighter'; this.glow(ox, oy, 18 + 22 * mk, cols[1], 0.5 + 0.5 * mk); g.restore(); }
        } else if (age < HIT) { // 하나로 합쳐진 글자가 목표로 날아간다 (세 빛 꼬리)
          const q = (age - FLY) / (HIT - FLY), e2 = q * q, x = ox + (f.tx - ox) * e2, y = oy + (f.ty - 10 - oy) * e2 - Math.sin(q * Math.PI) * 26;
          if (dt > 0) cols.forEach((c, i) => this.parts.push({ x: x + (i - 1) * 3, y: y + (i - 1) * 2, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, t: 0.35, max: 0.35, color: c, g: 0, glow: true, size: 1.6 }));
          this.drawGlyph(f.words[1], x, y, 1.3, f.same ? '#ffe08a' : cols[1], 1, age * 6);
        } else { // 땅에 새겨진 글자: 납작하게 눕힌 세 글자가 빛나다가 스러진다
          if (!f.landed) {
            f.landed = true;
            this.shake = Math.max(this.shake, f.same ? 9 : 6); this.hitstop = Math.max(this.hitstop, 0.06);
            for (let i = 0; i < 36; i++) { const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 170; this.parts.push({ x: f.tx, y: f.ty - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 40, t: 0.4 + Math.random() * 0.4, max: 0.8, color: cols[i % 3], g: 90, glow: true, size: 1.4 }); }
          }
          const fade = Math.max(0, 1 - (age - HIT) / (f.max - HIT));
          g.save(); g.translate(f.tx, f.ty); g.scale(1, 0.5);
          f.words.forEach((wd, i) => this.drawGlyph(wd, (i - 1) * 20, 0, 1.4, cols[i], fade * (0.6 + 0.4 * Math.sin(age * 9 + i)), 0));
          g.restore();
        }
      }
    }
    if (!ground) this.fx = this.fx.filter((f) => f.t > 0);
  },

};

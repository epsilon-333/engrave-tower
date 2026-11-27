// 렌더러 — 독창 스킬 그림 (사건 'ofx' · 탄의 겉모습 pr.oskin). Renderer.prototype 에 붙는다 (this 는 Renderer)
// 원칙(CLAUDE.md 그래픽 취향): 짙은 외곽선 + 가운데 색 + 밝은 면 · 조각 · 잔상 · 타원 고리 없이 · 바닥 그림(ofxG)은 땅에만(clipTiles)
// 사건: { t: 'ofx', s: 모양, pal: 색 이름, x, y, r, ang, x2, y2, n, dur, tier }
import { classHit, skillClass, keepsSpike, palClass, CLASS_LOOK, KEEP_SPIKE } from './classfx.js';
import { hexA } from './color.js';
import { disc } from './renderer.js';
import { sfx } from '../audio.js';

export const OPAL = { // [외곽선, 가운데, 밝은 면]
  fire: ['#4a1206', '#ff6a1a', '#ffe08a'], lava: ['#2e0802', '#e0401a', '#ffd070'], ice: ['#123056', '#78c4ff', '#eef9ff'],
  water: ['#0c2552', '#3a8ae0', '#c8f0ff'], poison: ['#17300a', '#78c83a', '#e0ffa0'], slime: ['#12361a', '#5ad06a', '#d8ffd0'],
  shadow: ['#0e0818', '#5a3a8a', '#c8a8ff'], curse: ['#24082e', '#a83ae0', '#f4d0ff'], holy: ['#5a3c06', '#ffcc3a', '#fffbe0'],
  earth: ['#24160a', '#8a6a40', '#e0c8a0'], wind: ['#163e40', '#86dcc8', '#f2fffa'], blood: ['#300410', '#d0283a', '#ffb4bc'],
  bolt: ['#30280a', '#f6dc3a', '#ffffff'], glass: ['#22324e', '#a4d4f0', '#ffffff'], steam: ['#3e3e48', '#c4c6d0', '#ffffff'],
  gold: ['#4e3206', '#f0b030', '#fff2b8'], ink: ['#050308', '#2c2444', '#9a8ac8'], bone: ['#342e22', '#d8d0b8', '#ffffff'],
  petal: ['#4a1638', '#f07ab8', '#ffe0f0'], sand: ['#3e2c10', '#d8b060', '#fff0c0'], metal: ['#20242c', '#8a96a8', '#eef2f8'],
};
const P = (n) => OPAL[n] || OPAL.holy;
const TAU = Math.PI * 2;

// 짙은 외곽선을 두른 다각형 (pts: [[x,y]...]) — 외곽선은 1px 바깥으로 넓힌 같은 모양
function outlined(g, pts, pal, a = 1, hi = true) {
  if (pts.length < 3) return;
  let cx = 0, cy = 0; for (const q of pts) { cx += q[0]; cy += q[1]; } cx /= pts.length; cy /= pts.length;
  const grow = (s) => pts.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + (dx / l) * s, y + (dy / l) * s]; });
  const poly = (ps) => { g.beginPath(); g.moveTo(ps[0][0], ps[0][1]); for (let i = 1; i < ps.length; i++) g.lineTo(ps[i][0], ps[i][1]); g.closePath(); g.fill(); };
  g.fillStyle = hexA(pal[0], a); poly(grow(1.2));
  g.fillStyle = hexA(pal[1], a); poly(pts);
  if (hi) { g.fillStyle = hexA(pal[2], a * 0.9); poly(pts.map(([x, y]) => [cx + (x - cx) * 0.45 - 0.6, cy + (y - cy) * 0.45 - 0.8])); }
}
// 외곽선 + 몸 + 빛 원판 (작은 덩이)
function blob(g, x, y, r, pal, a = 1) {
  g.fillStyle = hexA(pal[0], a); disc(g, x, y, r + 1.2);
  g.fillStyle = hexA(pal[1], a); disc(g, x, y, r);
  g.fillStyle = hexA(pal[2], a); disc(g, x - r * 0.35, y - r * 0.35, Math.max(0.6, r * 0.38));
}
// 굵기가 줄어드는 끈 (외곽선 + 몸 + 가운데 빛줄)
function rope(g, pts, w0, w1, pal, a = 1) {
  const n = pts.length; if (n < 2) return;
  for (let pass = 0; pass < 3; pass++) {
    g.fillStyle = hexA(pal[pass], pass === 2 ? a * 0.85 : a);
    for (let i = 0; i < n - 1; i++) {
      const u = i / (n - 1), w = (w0 + (w1 - w0) * u) * (pass === 0 ? 1 : pass === 1 ? 0.7 : 0.28) + (pass === 0 ? 1.2 : 0);
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w;
      g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.lineTo(x1 + nx, y1 + ny); g.lineTo(x1 - nx, y1 - ny); g.lineTo(x0 - nx, y0 - ny); g.closePath(); g.fill();
      disc(g, x1, y1, w);
    }
  }
}
// 뾰족한 빛살 하나 (from 안쪽 → 끝)
function spike(g, x, y, a, r0, r1, w, col) {
  const x0 = x + Math.cos(a) * r0, y0 = y + Math.sin(a) * r0, x1 = x + Math.cos(a) * r1, y1 = y + Math.sin(a) * r1;
  g.fillStyle = col; g.beginPath(); g.moveTo(x0 - Math.sin(a) * w, y0 + Math.cos(a) * w); g.lineTo(x1, y1); g.lineTo(x0 + Math.sin(a) * w, y0 - Math.cos(a) * w); g.closePath(); g.fill();
}
const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const GROUND = new Set(['splat', 'trap', 'sigil', 'web', 'crack', 'path']);

export const OrigFxMethods = {
  // 사건 → fx 목록 (+ 조각)
  origFx(ev) {
    if (ev.s === 'spikes' && ev.pal !== 'ice' && ev.pal !== 'bone') { // 가시는 가시 스킬만 (2026-11-27): 나머지는 그 갈래의 그림으로
      const sk = ev.sk || this._evSk, cls = sk ? skillClass(sk) : null;
      if (!(sk && keepsSpike(sk) && (KEEP_SPIKE.has(sk) || cls === 'chronomancer' || /thorn|spike|spine|vine|bramble|caltrop/i.test(sk) || !cls))) {
        const c = CLASS_LOOK[cls] ? cls : palClass(ev.pal), w = this.world, o = { tier: ev.tier || 2, hand: true, max: Math.min(1.2, ev.dur || 0.6) };
        if (ev.x2 != null) { const ang = Math.atan2(ev.y2 - ev.y1, ev.x2 - ev.x1); for (const u of [0.2, 0.6, 1]) classHit(this, w, c, ev.x1 + (ev.x2 - ev.x1) * u, ev.y1 + (ev.y2 - ev.y1) * u, 16, { ...o, ang, dir: ang }); }
        else classHit(this, w, c, ev.x, ev.y, (ev.r || 16) * 1.1, o);
        return;
      }
    }
    const pal = P(ev.pal), T = ev.dur || { rays: 0.32, burst: 0.4, spikes: 0.7, wall: ev.dur || 2, tether: 0.3, bolt: 0.22, beam: 0.35, cage: 1.2, star: 1, bell: 1, rock: 0.6, mark: 1, glyph: 1, blade: 1, column: 0.9, gust: 0.6, mirage: 2, pillar: 0.6, orb: 0.6, swirl: 1, slash: 0.25, splat: 1.2, trap: 3, sigil: 1.5, web: 1.6, crack: 0.9, path: 1.4, fist: 0.3, wing: 0.35, ghost: 0.4 }[ev.s] || 0.4;
    const tier = ev.tier || 2, big = tier >= 4 ? 1.25 : tier >= 3 ? 1.1 : 1;
    const f = { k: GROUND.has(ev.s) ? 'ofxG' : 'ofx', ...ev, pal, t: T, max: T, big, seed: Math.random() * 99 };
    this.fx.push(f);
    const x = ev.x ?? ev.x1, y = ev.y ?? ev.y1, r = (ev.r || 20) * big;
    // 함께 튀는 조각
    const chips = (n, sp, up = 60, glow = false) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (0.4 + Math.random() * 0.8); this.parts.push({ x, y: y - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - up * Math.random(), t: 0.45 + Math.random() * 0.25, max: 0.7, color: pal[i % 3 === 0 ? 2 : 1], g: glow ? -10 : 260, floor: glow ? undefined : y + 2 + Math.sin(a) * 6, glow, size: 1 + (i % 3 === 0 ? 1 : 0), chunk: !glow }); } };
    switch (ev.s) {
      case 'burst': chips(10 + tier * 3, r * 4, 80); this.shake = Math.max(this.shake, 2 + tier); sfx('hitHeavy', { vol: 0.6, rate: 1.1 }); break;
      case 'rays': chips(6 + tier * 2, r * 4, 20, true); this.shake = Math.max(this.shake, 1.5 + tier * 0.5); break;
      case 'spikes': chips(6 + tier * 2, r * 2.5, 90); this.shake = Math.max(this.shake, 3); sfx('crack', { vol: 0.5, rate: 1.2 }); break;
      case 'pillar': for (let i = 0; i < 10 + tier * 3; i++) this.parts.push({ x: x + (Math.random() - 0.5) * r, y: y - Math.random() * r * 2, vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 80, t: 0.6, max: 0.6, color: pal[1 + (i % 2)], g: -20, glow: true, size: 1 + (i % 2) }); this.shake = Math.max(this.shake, 3); break;
      case 'splat': chips(8, r * 3, 70); break;
      case 'wall': chips(10, 60, 100); this.shake = Math.max(this.shake, 4); sfx('crack', { vol: 0.6, rate: 0.8 }); break;
      case 'trap': sfx('open', { vol: 0.4, rate: 1.4 }); break;
      default: break;
    }
  },

  // fx 한 장 그리기 (drawFx 에서 부른다) · k = 남은 비율
  drawOfx(g, f, k) {
    const pal = f.pal, age = f.max - f.t, e = 1 - k, t = this.world.t, big = f.big || 1;
    const x = f.x ?? f.x1, y = f.y ?? f.y1, R = (f.r || 20) * big;
    switch (f.s) {
      case 'burst': case 'rays': { // 별 모양으로 터지는 빛살 (가운데 섬광 · 둘레 고리 없이)
        const n = f.n || (f.s === 'burst' ? 12 : 8), sp = f.spread ?? TAU, a0 = (f.ang ?? -Math.PI / 2) - (sp < TAU ? sp / 2 : 0), rr = R * (0.35 + Math.min(1, e * 2.2) * 0.75), cy = y - 6;
        this.glow(x, cy, rr * 1.5, pal[1], k * 0.7);
        for (let i = 0; i < n; i++) { const a = a0 + (sp < TAU ? (i / (n - 1)) * sp : (i / n) * TAU + rnd(f.seed + i) * 0.3), L = rr * (i % 2 ? 0.6 : 1) * (0.8 + rnd(f.seed + i * 3) * 0.4), w = (f.s === 'burst' ? 3.2 : 2.2) * k + 0.6;
          spike(g, x, cy, a, rr * 0.15, L + 1.5, w + 1, hexA(pal[0], k)); spike(g, x, cy, a, rr * 0.15, L, w, hexA(i % 2 ? pal[1] : pal[2], k)); }
        g.fillStyle = hexA(pal[2], k); disc(g, x, cy, rr * 0.3 * k + 1.5);
        return;
      }
      case 'spikes': { // 땅에서 솟는 가시 (원 안 여기저기 · 또는 x→x2 줄을 따라)
        const n = f.n || 9, up = Math.min(1, age / 0.08) * Math.min(1, f.t / 0.18);
        for (let i = 0; i < n; i++) {
          let sx, sy; if (f.x2 != null) { const u = (i + 0.5) / n; sx = f.x1 + (f.x2 - f.x1) * u + (rnd(f.seed + i) - 0.5) * 6; sy = f.y1 + (f.y2 - f.y1) * u + (rnd(f.seed + i * 2) - 0.5) * 4; }
          else { const a = rnd(f.seed + i) * TAU, d = Math.sqrt(rnd(f.seed + i * 5)) * R; sx = x + Math.cos(a) * d; sy = y + Math.sin(a) * d * 0.6; }
          const h = (f.h || 16) * big * (0.6 + rnd(f.seed + i * 7) * 0.6) * up, w = 2.5 + rnd(f.seed + i * 9) * 2; if (h < 1) continue;
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(Math.round(sx - w - 1), Math.round(sy), Math.round(w * 2 + 2), 2);
          outlined(g, [[sx - w, sy + 1], [sx + (rnd(i) - 0.5) * 2, sy - h], [sx + w, sy + 1]], pal, 1, false);
          g.fillStyle = pal[2]; g.fillRect(Math.round(sx - 1), Math.round(sy - h * 0.8), 1, Math.round(h * 0.6));
        }
        return;
      }
      case 'wall': { // 서 있는 벽: 석판이 줄을 따라 솟는다 (윗면 밝게 · 옆면 그늘 · 금)
        const up = Math.min(1, age / 0.15) * Math.min(1, f.t / 0.25), L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1), n = Math.max(3, Math.round(L / 9));
        for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, sx = Math.round(f.x1 + (f.x2 - f.x1) * u), sy = Math.round(f.y1 + (f.y2 - f.y1) * u), h = Math.round((f.h || 20) * up * (0.85 + rnd(f.seed + i) * 0.3)), w = 5;
          if (h < 1) continue;
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(sx - w - 1, sy - 1, w * 2 + 2, 2); g.fillRect(sx - w + 1, sy + 1, w * 2 - 3, 1);
          // 직사각형 대신: 칸마다 윗면 높이가 들쭉날쭉한 돌 · 쇠 덩이 (깨진 윗면 · 옆 그늘 · 금 · 쇠는 리벳)
          const top = (c) => sy - h + Math.round((rnd(f.seed + i * 7 + c * 13) - 0.3) * 4 * up) + (c === -w || c === w - 1 ? 1 : 0);
          for (let c = -w - 1; c <= w; c++) { const ty = top(Math.max(-w, Math.min(w - 1, c))); g.fillStyle = pal[0]; g.fillRect(sx + c, ty - 1, 1, sy - ty + 2); }
          for (let c = -w; c < w; c++) { const ty = top(c); g.fillStyle = c >= w - 2 ? hexA(pal[0], 0.55) : pal[1]; g.fillRect(sx + c, ty, 1, sy - ty); g.fillStyle = pal[2]; g.fillRect(sx + c, ty, 1, c === -w ? sy - ty : 1 + (c + i) % 2); }
          g.fillStyle = hexA(pal[0], 0.8); // 금: 위에서 비스듬히 내려오는 갈라짐
          let cx2 = sx - 2 + Math.round(rnd(f.seed + i) * 3);
          for (let yy = sy - h + 4; yy < sy - 3; yy += 2) { g.fillRect(cx2, yy, 1, 2); if (rnd(f.seed + yy + i) > 0.6) cx2 += rnd(f.seed + yy) > 0.5 ? 1 : -1; }
          if (f.pal === 'metal' && h > 9) { for (const ry of [sy - h + 4, sy - 4]) { g.fillStyle = pal[0]; g.fillRect(sx - w + 1, ry, 2, 2); g.fillRect(sx + w - 3, ry, 2, 2); g.fillStyle = pal[2]; g.fillRect(sx - w + 1, ry, 1, 1); g.fillRect(sx + w - 3, ry, 1, 1); } } // 리벳
        }
        return;
      }
      case 'tether': case 'tongue': { // 끈 · 혀 · 사슬: x1,y1 → x2,y2 (뻗었다 거둔다) · 끝에 덩이
        const L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1), out = f.s === 'tongue' ? Math.min(1, age / (f.max * 0.4)) * Math.min(1, f.t / (f.max * 0.5)) : 1, n = Math.max(3, Math.round(L / 6)), pts = [];
        for (let i = 0; i <= n; i++) { const u = (i / n) * out, wob = Math.sin(u * 9 + t * 20 + f.seed) * (f.wob ?? 3) * Math.sin(u * Math.PI); const dx = (f.x2 - f.x1) / (L || 1), dy = (f.y2 - f.y1) / (L || 1); pts.push([f.x1 + (f.x2 - f.x1) * u - dy * wob, f.y1 + (f.y2 - f.y1) * u + dx * wob]); }
        const a = f.s === 'tongue' ? 1 : k;
        rope(g, pts, f.w || 2.6, (f.w || 2.6) * 0.7, pal, a);
        const tip = pts[pts.length - 1]; blob(g, tip[0], tip[1], (f.w || 2.6) * 1.3, pal, a);
        return;
      }
      case 'bolt': { // 꺾인 번개 (짙은 외곽 + 밝은 심)
        const pts = [], n = 7; for (let i = 0; i <= n; i++) { const u = i / n, j = i && i < n ? (rnd(f.seed + i + Math.floor(age * 30)) - 0.5) * 12 : 0, L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1) || 1; pts.push([f.x1 + (f.x2 - f.x1) * u - (f.y2 - f.y1) / L * j, f.y1 + (f.y2 - f.y1) * u + (f.x2 - f.x1) / L * j]); }
        rope(g, pts, 2.4 * k + 0.8, 1.6 * k + 0.6, pal, 1); this.glow(f.x2, f.y2, 16, pal[1], k);
        return;
      }
      case 'pillar': { // 땅에서 솟는 기둥 (물 · 빛 · 김 · 용암)
        const up = Math.min(1, age / 0.1), h = (f.h || 46) * big * up, w = R * 0.45 * (0.6 + k * 0.4), sx = x, sy = y;
        this.glow(sx, sy - h * 0.5, w * 3, pal[1], k * 0.6);
        const wav = (yy) => Math.sin(yy * 0.3 + t * 25) * 1.2;
        const col = (ww, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(sx - ww, sy); for (let yy = 0; yy <= h; yy += 4) g.lineTo(sx - ww * (1 - yy / h * 0.35) + wav(yy), sy - yy); g.lineTo(sx, sy - h - ww * 0.6); for (let yy = h; yy >= 0; yy -= 4) g.lineTo(sx + ww * (1 - yy / h * 0.35) + wav(yy + 3), sy - yy); g.closePath(); g.fill(); };
        col(w + 1.5, hexA(pal[0], k)); col(w, hexA(pal[1], k)); col(w * 0.4, hexA(pal[2], k));
        return;
      }
      case 'orb': { // 떠 있는 빛 덩이 (물방울 · 혼 · 등불 · 금화)
        const bob = Math.sin(t * 6 + f.seed) * 1.5, rr = (f.r || 5) * big * (age < 0.1 ? age / 0.1 : 1), oy = y - (f.h ?? 10) + bob;
        this.glow(x, oy, rr * 3.5, pal[1], 0.5 * k + 0.2);
        blob(g, x, oy, rr, pal, Math.min(1, k * 3));
        return;
      }
      case 'swirl': { // 소용돌이: 안으로 감겨 드는 팔 (가늘어지는 꼬리 · 고리 없이)
        const arms = Math.min(4, f.n || 4), Rs = Math.min(R, 48), spin = (f.ccw ? -1 : 1) * t * 6, a0 = Math.min(1, age / 0.15) * Math.min(1, f.t / 0.3);
        for (let j = 0; j < arms; j++) { const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10, a = spin + (j / arms) * TAU + u * 2.6, d = Rs * (1 - u * 0.85); pts.push([x + Math.cos(a) * d, y - 6 + Math.sin(a) * d * 0.55]); } rope(g, pts, 0.4, 1.6 * big, pal, a0 * 0.75); }
        g.fillStyle = hexA(pal[2], a0); disc(g, x, y - 6, 2.5 * big);
        return;
      }
      case 'slash': { // 굵은 초승달 칼자국 (외곽선 · 밝은 날)
        const a = f.ang || 0, rr = R, sw = f.spread || 2.2, pts = [], n = 10;
        for (let i = 0; i <= n; i++) { const u = i / n, aa = a - sw / 2 + sw * u, th = Math.sin(u * Math.PI) * (5 * big) * k + 0.5; pts.push([x + Math.cos(aa) * (rr + th), y - 6 + Math.sin(aa) * (rr + th) * 0.7]); }
        for (let i = n; i >= 0; i--) { const u = i / n, aa = a - sw / 2 + sw * u; pts.push([x + Math.cos(aa) * rr, y - 6 + Math.sin(aa) * rr * 0.7]); }
        outlined(g, pts, pal, Math.min(1, k * 1.5), false);
        g.fillStyle = hexA(pal[2], k); for (let i = 2; i < n - 1; i++) { const aa = a - sw / 2 + sw * i / n; g.fillRect(Math.round(x + Math.cos(aa) * (rr + 1.5)), Math.round(y - 6 + Math.sin(aa) * (rr + 1.5) * 0.7), 1, 1); }
        return;
      }
      case 'fist': case 'wing': case 'ghost': { // 날개 · 손 · 꼬리: 부채꼴 깃 (ang 방향)
        const a = f.ang || 0, n = f.n || 5, rr = R * (0.5 + Math.min(1, age / 0.1) * 0.5);
        for (let i = 0; i < n; i++) { const aa = a + (i / (n - 1) - 0.5) * (f.spread || 1.6), L = rr * (0.7 + 0.3 * Math.sin((i / (n - 1)) * Math.PI));
          const px = x + Math.cos(aa) * L, py = y - 6 + Math.sin(aa) * L * 0.7, nx = -Math.sin(aa) * 2.4, ny = Math.cos(aa) * 2.4;
          outlined(g, [[x + nx, y - 6 + ny], [px + nx * 0.6, py + ny * 0.6], [px + Math.cos(aa) * 4, py + Math.sin(aa) * 3], [px - nx * 0.6, py - ny * 0.6], [x - nx, y - 6 - ny]], pal, k, true); }
        return;
      }
      case 'bugs': { // 벌레 떼: 노랑 · 검정 줄무늬 몸 + 반짝이는 날개가 떼 중심 둘레를 잉잉 돈다
        const n = f.n || 6;
        for (let i = 0; i < n; i++) { const a = t * (9 + i) + i * 2.1, d = R * (0.4 + rnd(f.seed + i) * 0.6), bx = Math.round(x + Math.cos(a) * d), by = Math.round(y + Math.sin(a * 1.3) * d * 0.6);
          g.fillStyle = '#1a1206'; g.fillRect(bx - 2, by - 1, 4, 3); g.fillStyle = pal[1]; g.fillRect(bx - 1, by, 1, 1); g.fillRect(bx + 1, by, 1, 1);
          g.fillStyle = hexA('#eef6ff', Math.sin(t * 60 + i) > 0 ? 0.9 : 0.4); g.fillRect(bx - 1, by - 2, 1, 1); g.fillRect(bx + 1, by - 2, 1, 1); }
        return;
      }
      case 'beam': { // 굵은 빛줄기 x1,y1 → x2,y2 (짙은 외곽 · 가운데 색 · 흰 심 · 끝에 섬광) — 프리즘 · 십자 · 토해 내는 빛
        const L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1) || 1, out = Math.min(1, age / 0.07), w = (f.w || 5) * big * (0.35 + 0.65 * k) * (1 + Math.sin(t * 50 + f.seed) * 0.08);
        const ex = f.x1 + (f.x2 - f.x1) * out, ey = f.y1 + (f.y2 - f.y1) * out, nx = -(f.y2 - f.y1) / L, ny = (f.x2 - f.x1) / L;
        const band = (ww, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(f.x1 + nx * ww * 0.6, f.y1 + ny * ww * 0.6); g.lineTo(ex + nx * ww, ey + ny * ww); g.lineTo(ex + (f.x2 - f.x1) / L * ww, ey + (f.y2 - f.y1) / L * ww); g.lineTo(ex - nx * ww, ey - ny * ww); g.lineTo(f.x1 - nx * ww * 0.6, f.y1 - ny * ww * 0.6); g.closePath(); g.fill(); };
        band(w + 1.6, hexA(pal[0], k)); band(w, hexA(pal[1], k)); band(w * 0.38, hexA(pal[2], k));
        this.glow(ex, ey, w * 4, pal[1], k * 0.8); this.glow(f.x1, f.y1, w * 3, pal[2], k * 0.5);
        for (let i = 0; i < 6; i++) spike(g, ex, ey, rnd(f.seed + i + Math.floor(age * 20)) * TAU, 0, w * 2.2, 1.4, hexA(pal[2], k));
        return;
      }
      case 'cage': { // 뼈 우리: 둘레에서 뼈 창살이 솟아 안쪽으로 굽고 (닫히면) 꼭대기에서 맞물린다
        const n = f.n || 8, up = Math.min(1, age / 0.18), close = Math.min(1, age / (f.max * 0.85)), rr = R, H = (f.h || 26) * big * up, fade = Math.min(1, f.t / 0.15);
        const bars = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.3, bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr * 0.5; bars.push({ a, bx, by, front: Math.sin(a) > 0 }); }
        const bar = (b) => { const tx = x + (b.bx - x) * (0.25 + 0.5 * (1 - close)), ty = y - H, pts = []; for (let j = 0; j <= 6; j++) { const u = j / 6, q = u * u; pts.push([b.bx + (tx - b.bx) * q, b.by + (ty - b.by) * u]); } rope(g, pts, 2.6, 1.6, pal, fade); blob(g, b.bx, b.by, 2, pal, fade); };
        for (const b of bars) if (!b.front) bar(b);
        if (close > 0.6) { g.fillStyle = hexA(pal[0], fade); disc(g, x, y - H, 4); g.fillStyle = hexA(pal[1], fade); disc(g, x, y - H, 3); g.fillStyle = hexA(pal[2], fade); disc(g, x - 1, y - H - 1, 1.2); }
        for (const b of bars) if (b.front) bar(b);
        return;
      }
      case 'star': { // 반짝이는 별 (네 갈래 빛 · 외곽선) — 별자리 · 별 지도
        const tw = 0.75 + 0.25 * Math.sin(t * 14 + f.seed), rr = R * tw * Math.min(1, age / 0.1), sy = y - (f.h ?? 8), fade = Math.min(1, f.t / 0.2);
        this.glow(x, sy, rr * 2.2, pal[1], 0.6 * fade);
        const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, d = i % 2 ? rr * 0.28 : rr * (i % 4 ? 0.7 : 1); pts.push([x + Math.cos(a) * d, sy + Math.sin(a) * d]); }
        outlined(g, pts, pal, fade);
        return;
      }
      case 'bell': { // 종: 위에서 흔들리는 종 + 추
        const sw = Math.sin(age * 14) * 0.35 * k, by = y - (f.h ?? 30), rr = R;
        const loc = (u, v) => [x + Math.cos(sw) * u - Math.sin(sw) * v, by + Math.sin(sw) * u + Math.cos(sw) * v];
        const pts = [[-rr * 0.35, 0], [-rr * 0.45, rr * 0.5], [-rr * 0.7, rr * 1.05], [rr * 0.7, rr * 1.05], [rr * 0.45, rr * 0.5], [rr * 0.35, 0]].map(([u, v]) => loc(u, v));
        outlined(g, pts, pal, Math.min(1, k * 2));
        const cl = loc(Math.sin(age * 20) * rr * 0.25, rr * 1.2); blob(g, cl[0], cl[1], 2.2, pal, Math.min(1, k * 2));
        return;
      }
      case 'rock': { // 하늘에서 떨어지는 바위 (h 높이에서 내려와 땅에 닿는다)
        const fall = Math.min(1, age / (f.fall || f.max * 0.7)), rr = R, sy = y - (f.h ?? 120) * (1 - fall * fall), rot = age * 6 + f.seed;
        g.fillStyle = hexA('#000000', 0.15 + 0.25 * fall); g.beginPath(); g.ellipse(x, y + 2, rr * (0.5 + fall * 0.5), rr * 0.3 * (0.5 + fall * 0.5), 0, 0, TAU); g.fill();
        if (fall >= 1) return;
        const pts = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + rot, d = rr * (0.8 + rnd(f.seed + i) * 0.3); pts.push([x + Math.cos(a) * d, sy - rr + Math.sin(a) * d]); }
        outlined(g, pts, pal);
        return;
      }
      case 'mark': { // 적 머리 위 표식: skull · crown · z · clock · brand (짙은 외곽선 도트)
        const bob = Math.sin(t * 6 + f.seed) * 1, fade = Math.min(1, f.t / 0.2) * Math.min(1, age / 0.08), mx = Math.round(x), my = Math.round(y - (f.h ?? 24) + bob), sc = Math.max(1, Math.round(big * (f.sc || 1)));
        const icons = { skull: ['.###.', '#####', '#.#.#', '#####', '.#.#.'], crown: ['#.#.#', '#####', '#####'], z: ['####', '..#.', '.#..', '####'], clock: ['.###.', '#.#.#', '#.##.', '#...#', '.###.'], brand: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'] };
        const ic = icons[f.icon] || icons.brand, w = ic[0].length, h = ic.length, ox = mx - Math.floor(w * sc / 2), oy = my - h * sc;
        g.fillStyle = hexA(pal[0], fade); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (ic[j][i] === '#') g.fillRect(ox + i * sc - 1, oy + j * sc - 1, sc + 2, sc + 2);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (ic[j][i] === '#') { g.fillStyle = hexA(j === 0 ? pal[2] : pal[1], fade); g.fillRect(ox + i * sc, oy + j * sc, sc, sc); }
        if (f.n > 1) for (let i = 0; i < f.n; i++) { g.fillStyle = hexA(pal[2], fade); g.fillRect(mx - f.n * 2 + i * 4, my + 2, 2, 2); }
        return;
      }
      case 'glyph': { // 떠오르는 불 글자 (획을 그어 나가며 타오른다)
        const draw = Math.min(1, age / 0.25), fade = Math.min(1, f.t / 0.25), rr = R, sy = y - 10 - Math.min(1, age / 0.3) * 4;
        const strokes = [[[-1, -1], [1, -1]], [[0, -1], [0, 1]], [[-1, 0.2], [1, 1]], [[-1, 1], [0.4, 0.2]]].slice(0, 2 + (Math.floor(f.seed * 7) % 3));
        for (const [lw, c] of [[3.4, hexA(pal[0], fade)], [1.8, hexA(pal[1], fade)], [0.8, hexA(pal[2], fade)]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
          strokes.forEach(([a, b], i) => { const u = Math.min(1, Math.max(0, draw * strokes.length - i)); if (u <= 0) return; g.moveTo(x + a[0] * rr, sy + a[1] * rr); g.lineTo(x + (a[0] + (b[0] - a[0]) * u) * rr, sy + (a[1] + (b[1] - a[1]) * u) * rr); }); g.stroke(); }
        this.glow(x, sy, rr * 2, pal[1], 0.5 * fade);
        if (Math.random() < 0.3) this.parts.push({ x: x + (Math.random() - 0.5) * rr * 2, y: sy, vx: 0, vy: -30, t: 0.4, max: 0.4, color: pal[2], g: -20, flame: true, glow: true, size: 1 });
        return;
      }
      case 'blade': { // 돌아가는 칼바퀴 · 톱날
        const bx = x, by = y - 4, n = f.n || 6, rr = (f.size || 7) * big, rot = t * 22, fade = Math.min(1, f.t / 0.2);
        for (let i = 1; i <= 3; i++) { g.fillStyle = hexA(pal[1], 0.22 * fade / i); disc(g, bx - Math.cos(rot) * i, by - Math.sin(rot) * i, rr * 0.9); }
        const pts = []; for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU + (i % 2 ? 0.25 : 0), d = i % 2 ? rr * 0.55 : rr; pts.push([bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.8]); }
        outlined(g, pts, pal, fade, false); g.fillStyle = hexA(pal[0], fade); disc(g, bx, by, rr * 0.25 + 0.8); g.fillStyle = hexA(pal[2], fade); g.fillRect(Math.round(bx + Math.cos(rot) * rr * 0.7), Math.round(by + Math.sin(rot) * rr * 0.55), 1, 1);
        return;
      }
      case 'column': { // 쓰러지는 돌기둥: 서 있다가 ang 쪽으로 넘어가 땅에 눕는다
        const fall = Math.min(1, Math.max(0, (age - 0.15) / 0.35)), q = fall * fall, Lc = f.len || 80, wd = (f.w || 9) * big, fade = Math.min(1, f.t / 0.25);
        const tx = x + Math.cos(f.ang) * Lc * q, ty = y + Math.sin(f.ang) * Lc * 0.7 * q - Lc * (1 - q) * 0.9, nx = -(ty - y), ny = tx - x, l = Math.hypot(nx, ny) || 1;
        const c = [[x + nx / l * wd, y + ny / l * wd * 0.6], [tx + nx / l * wd, ty + ny / l * wd * 0.6], [tx - nx / l * wd, ty - ny / l * wd * 0.6], [x - nx / l * wd, y - ny / l * wd * 0.6]];
        outlined(g, c, pal, fade, false); g.fillStyle = hexA(pal[2], fade); g.beginPath(); g.moveTo(c[0][0], c[0][1]); g.lineTo(c[1][0], c[1][1]); g.lineTo((c[1][0] + c[2][0]) / 2, (c[1][1] + c[2][1]) / 2); g.lineTo((c[0][0] + c[3][0]) / 2, (c[0][1] + c[3][1]) / 2); g.closePath(); g.fill();
        blob(g, tx, ty, wd * 0.9, pal, fade);
        return;
      }
      case 'gust': { // 바람결: ang 쪽으로 흘러가는 바람 줄기 (in: true 면 안으로)
        const n = f.n || 6, Lg = R, fade = Math.min(1, f.t / 0.25), a = f.ang || 0, ca = Math.cos(a), sa = Math.sin(a);
        for (let i = 0; i < n; i++) { const off = (rnd(f.seed + i) - 0.5) * (f.wide || R * 0.8), ph = (age * 2.4 + rnd(f.seed + i * 3)) % 1, u0 = f.in ? 1 - ph : ph, pts = [];
          for (let j = 0; j <= 6; j++) { const u = u0 * Lg - j * 5 * (f.in ? -1 : 1), wv = Math.sin(j * 0.9 + t * 12 + i) * 1.5; pts.push([x + ca * u - sa * (off + wv), y - 6 + sa * u + ca * (off + wv) * 0.7]); }
          rope(g, pts, 2.2 * big, 0.4, pal, fade * Math.sin(ph * Math.PI)); }
        return;
      }
      case 'mirage': { // 잔영 셋이 내 둘레를 돈다 — 맞으면 하나씩 깨진다
        const P0 = this.world.player, n = P0.origGuard ? Math.max(0, 3 - (P0.origGuard.n || 0)) : 0; if (!n) { f.t = Math.min(f.t, 0.01); return; }
        for (let i = 0; i < n; i++) { const a = t * 3 + (i / 3) * TAU, mx = P0.x + Math.cos(a) * 14, my = P0.y + Math.sin(a) * 6;
          const pts = [[mx, my - 18], [mx + 4, my - 14], [mx + 5, my - 4], [mx + 3, my + 2], [mx - 3, my + 2], [mx - 5, my - 4], [mx - 4, my - 14]];
          outlined(g, pts, pal, 0.55 + 0.15 * Math.sin(t * 9 + i), true); }
        return;
      }
      // ── 바닥 (땅에만) ──
      case 'splat': { // 웅덩이: 울퉁불퉁한 외곽선 + 밝은 물기 (끈끈이 · 먹 · 독 · 용암)
        const grow = Math.min(1, age / 0.15), fade = Math.min(1, f.t / 0.35), rr = R * grow, n = 14, pts = [];
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU, d = rr * (0.75 + rnd(f.seed + i) * 0.4 + Math.sin(t * 3 + i) * 0.04); pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.55]); }
        outlined(g, pts, pal, 0.85 * fade, false);
        g.fillStyle = hexA(pal[2], 0.8 * fade); for (let i = 0; i < 4; i++) { const a = rnd(f.seed + i * 11) * TAU, d = rr * 0.5 * rnd(f.seed + i * 13); disc(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.55, 1 + rnd(i) * 1.5); }
        if (f.bubble && Math.random() < 0.25) this.parts.push({ x: x + (Math.random() - 0.5) * rr * 1.4, y: y + (Math.random() - 0.5) * rr * 0.6, vx: 0, vy: -16, t: 0.5, max: 0.5, color: pal[2], g: -6, glow: f.pal === OPAL.lava, size: 1 });
        return;
      }
      case 'trap': { // 덫 · 지뢰: 톱니 이빨이 둘러선 판 + 가운데서 깜빡이는 불 (밟으면 터진다)
        const rr = R, teeth = f.n || 8, blink = 0.5 + 0.5 * Math.sin(t * 10 + f.seed), fade = Math.min(1, f.t / 0.2) * Math.min(1, age / 0.1);
        g.fillStyle = hexA('#000000', 0.3 * fade); g.beginPath(); g.ellipse(x, y + 1, rr + 2, (rr + 2) * 0.5, 0, 0, TAU); g.fill();
        const plate = []; for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * TAU, d = i % 2 ? rr * 0.65 : rr; plate.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5]); }
        outlined(g, plate, pal, fade, false);
        g.fillStyle = hexA(pal[0], fade); g.beginPath(); g.ellipse(x, y, rr * 0.45, rr * 0.22, 0, 0, TAU); g.fill();
        g.fillStyle = hexA(pal[2], fade * (0.4 + blink * 0.6)); disc(g, x, y - 0.5, 1.2 + blink);
        if (blink > 0.9) this.glow(x, y, rr * 1.4, pal[1], 0.3 * fade);
        return;
      }
      case 'sigil': { // 바닥 문양: 별 모양으로 그어 나간 획 (가운데 눈 · 고리 없이)
        const n = f.n || 5, step = n === 6 ? 2 : 2, draw = Math.min(1, age / 0.35), fade = Math.min(1, f.t / 0.3), rr = R;
        const vs = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n) * TAU + (f.rot || 0) + age * 0.6; vs.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.5]); }
        const seq = []; let j = 0; for (let i = 0; i <= n; i++) { seq.push(vs[j]); j = (j + step) % n; }
        const segs = Math.floor(draw * n * 100) / 100 * n;
        for (const [lw, c] of [[3, hexA(pal[0], fade)], [1.5, hexA(pal[1], fade)]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(seq[0][0], seq[0][1]);
          for (let i = 1; i < seq.length; i++) { const u = Math.min(1, Math.max(0, segs - (i - 1))); if (u <= 0) break; g.lineTo(seq[i - 1][0] + (seq[i][0] - seq[i - 1][0]) * u, seq[i - 1][1] + (seq[i][1] - seq[i - 1][1]) * u); } g.stroke(); }
        for (const v of vs) { g.fillStyle = hexA(pal[2], fade); g.fillRect(Math.round(v[0]) - 1, Math.round(v[1]) - 1, 2, 2); }
        this.glow(x, y, rr, pal[1], 0.3 * fade);
        return;
      }
      case 'web': { // 거미줄: 바퀴살 + 이어진 실 (외곽 짙게 · 실 밝게)
        const rr = R * Math.min(1, age / 0.12), fade = Math.min(1, f.t / 0.3), sp = 8;
        const spoke = (i) => (i / sp) * TAU + 0.2;
        for (const [lw, c] of [[2.2, hexA(pal[0], 0.7 * fade)], [1, hexA(pal[2], fade)]]) {
          g.strokeStyle = c; g.lineWidth = lw;
          g.beginPath(); for (let i = 0; i < sp; i++) { g.moveTo(x, y); g.lineTo(x + Math.cos(spoke(i)) * rr, y + Math.sin(spoke(i)) * rr * 0.55); } g.stroke();
          for (let ring = 1; ring <= 3; ring++) { const d = rr * ring / 3.2; g.beginPath(); for (let i = 0; i <= sp; i++) { const a = spoke(i % sp), sag = i % 2 ? 0.9 : 1; const px = x + Math.cos(a) * d * sag, py = y + Math.sin(a) * d * 0.55 * sag; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
        }
        return;
      }
      case 'crack': { // 갈라지는 금 (x1 → x2 · 빛이 새어 나온다)
        const L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1) || 1, out = Math.min(1, age / 0.12), fade = Math.min(1, f.t / 0.3), n = Math.max(3, Math.round(L / 7)), pts = [];
        for (let i = 0; i <= n * out; i++) { const u = i / n, j = i ? (rnd(f.seed + i) - 0.5) * 6 : 0; pts.push([f.x1 + (f.x2 - f.x1) * u - (f.y2 - f.y1) / L * j, f.y1 + (f.y2 - f.y1) * u + (f.x2 - f.x1) / L * j]); }
        if (pts.length > 1) rope(g, pts, 2.6, 0.8, [pal[0], pal[1], pal[2]], fade);
        return;
      }
      case 'path': { // 남긴 길: 흔적 조각을 이은 띠 (얼음길 · 불씨 길 · 유리 조각)
        const fade = Math.min(1, f.t / 0.4), L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1) || 1, n = Math.max(3, Math.round(L / 5));
        for (let i = 0; i <= n; i++) { const u = i / n, sx = f.x1 + (f.x2 - f.x1) * u + (rnd(f.seed + i) - 0.5) * 6, sy = f.y1 + (f.y2 - f.y1) * u + (rnd(f.seed + i * 3) - 0.5) * 5, s = 1.5 + rnd(f.seed + i * 7) * 2.5;
          outlined(g, [[sx - s, sy], [sx, sy - s * 0.6], [sx + s, sy], [sx, sy + s * 0.6]], pal, fade, false); g.fillStyle = hexA(pal[2], fade); g.fillRect(Math.round(sx), Math.round(sy - 1), 1, 1); }
        return;
      }
      default: return;
    }
  },

  // 독창 스킬의 톱날 (allies orbitAxe + orig): 이빨이 둘러선 쇠 톱니가 돌며 불똥
  drawOrigSaw(g, al, fade) {
    const t = this.world.t, pal = OPAL.metal, rr = 7, rot = t * 20 + al.phase, x = al.x, y = al.y;
    for (let i = 1; i <= 3; i++) { g.fillStyle = hexA(pal[1], 0.18 * fade / i); disc(g, x - Math.cos(al.phase + Math.PI / 2) * i * 3, y - Math.sin(al.phase + Math.PI / 2) * i * 2, rr); }
    const pts = []; for (let i = 0; i < 16; i++) { const a = rot + (i / 16) * TAU + (i % 2 ? 0.18 : 0), d = i % 2 ? rr * 0.7 : rr; pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85]); }
    outlined(g, pts, pal, fade, false); g.fillStyle = hexA(pal[0], fade); disc(g, x, y, 2.2); g.fillStyle = hexA(pal[2], fade); disc(g, x - 2, y - 2, 1.2);
    if (Math.random() < 0.35) this.parts.push({ x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 30, t: 0.25, max: 0.25, color: '#ffd27a', g: 200, glow: true, size: 1 });
  },

  // 독창 스킬 탄 (pr.oskin): 외곽선 · 밝은 면 · 지나온 길의 잔상
  drawOrigProj(pr) {
    const g = this.g, pal = P(pr.opal), a = Math.atan2(pr.vy, pr.vx), t = this.world.t, s = pr.oskin, x = pr.x, y = pr.y;
    const tail = (n, gap, r0, col) => { for (let i = n; i >= 1; i--) { g.fillStyle = hexA(col, 0.5 * (1 - i / (n + 1))); disc(g, x - Math.cos(a) * i * gap, y - Math.sin(a) * i * gap, r0 * (1 - i / (n + 2))); } };
    const dir = (pts) => pts.map(([u, v]) => [x + Math.cos(a) * u - Math.sin(a) * v, y + Math.sin(a) * u + Math.cos(a) * v]);
    if (s === 'glob') { tail(4, 3, 4, pal[1]); const w = Math.sin(t * 18) * 0.6; const pts = []; for (let i = 0; i < 10; i++) { const b = (i / 10) * TAU; pts.push([Math.cos(b) * (5 + w) * (Math.cos(b) < 0 ? 1.25 : 1), Math.sin(b) * (4.2 - w)]); } outlined(g, dir(pts), pal); if (Math.random() < 0.3) this.parts.push({ x, y, vx: 0, vy: 0, t: 0.4, max: 0.4, color: pal[1], g: 200, size: 1, floor: y + 8 }); }
    else if (s === 'seed') { tail(3, 3, 3, pal[1]); outlined(g, dir([[5, 0], [0, 3], [-4, 0], [0, -3]]), pal); this.glow(x, y, 8, pal[1], 0.4); }
    else if (s === 'thorn' || s === 'feather' || s === 'shard' || s === 'spine') { tail(3, 3.5, 2, pal[1]); const L = s === 'feather' ? 8 : 6; outlined(g, dir(s === 'feather' ? [[L, 0], [0, 2.6], [-L, 0.6], [-L + 2, 0], [-L, -0.6], [0, -2.6]] : s === 'shard' ? [[L, 0], [1, 2.4], [-L * 0.6, 1], [-L * 0.4, -2]] : [[L, 0], [-2, 2.2], [-L * 0.5, 0], [-2, -2.2]]), pal); }
    else if (s === 'wisp') { tail(6, 2.5, 4, pal[1]); blob(g, x, y, 3.6, pal); this.glow(x, y, 12, pal[1], 0.5); }
    else if (s === 'comet') { tail(6, 3, 5, pal[1]); blob(g, x, y, 5, pal); this.glow(x, y, 16, pal[1], 0.6); if (Math.random() < 0.6) this.parts.push({ x, y, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30 - 10, t: 0.35, max: 0.35, color: pal[2], g: -20, flame: pal === OPAL.fire, glow: true, size: 1 }); }
    else if (s === 'snow') { tail(4, 3, 4, '#ffffff'); blob(g, x, y - 1, 5, pal); if (Math.random() < 0.4) this.parts.push({ x, y, vx: 0, vy: 10, t: 0.4, max: 0.4, color: '#ffffff', g: 60, size: 1 }); }
    else if (s === 'arrow' || s === 'harpoon') { tail(4, 3, 1.6, pal[1]); const L = s === 'harpoon' ? 10 : 8; outlined(g, dir([[L, 0], [L - 4, 3], [L - 4, 1], [-L, 1], [-L - 2, 3], [-L + 1, 0], [-L - 2, -3], [-L, -1], [L - 4, -1], [L - 4, -3]]), pal, 1, false); const [hx, hy] = dir([[L - 2, 0]])[0]; g.fillStyle = pal[2]; g.fillRect(Math.round(hx), Math.round(hy), 1, 1); }
    else if (s === 'knife') { tail(3, 3, 2, pal[1]); const r = t * 30; const d2 = (pts) => pts.map(([u, v]) => [x + Math.cos(r) * u - Math.sin(r) * v, y + Math.sin(r) * u + Math.cos(r) * v]); outlined(g, d2([[6, 0], [0, 2], [-4, 1.5], [-6, 0], [-4, -1.5], [0, -2]]), pal); }
    else if (s === 'rock' || s === 'bone') { tail(3, 3, 3, pal[1]); const r = t * 12, pts = []; for (let i = 0; i < 7; i++) { const b = (i / 7) * TAU + r, d = (s === 'bone' ? (i % 2 ? 2 : 4.5) : 4.5) * (0.85 + rnd(i) * 0.3); pts.push([x + Math.cos(b) * d, y + Math.sin(b) * d]); } outlined(g, pts, pal); }
    else if (s === 'gale') { tail(7, 2.5, 4, pal[2]); for (let j = 0; j < 3; j++) { const pts = []; for (let i = 0; i <= 6; i++) { const u = -i * 3, v = Math.sin(i * 0.9 + t * 20 + j * 2) * (2 + i * 0.5); pts.push(dir([[u, v + (j - 1) * 3]])[0]); } rope(g, pts, 2.4, 0.4, pal, 0.9); } blob(g, x, y, 3.5, pal); }
    else blob(g, x, y, 4, pal);
  },
};

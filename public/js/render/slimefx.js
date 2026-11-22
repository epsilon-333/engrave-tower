// 슬라임 왕 이펙트: 슬라임공(통통 튀며 나는 도트 덩이) · 터지는 방울 · 내려치기 철퍼덕 · 꿀렁 순간이동(웅덩이) · 떨어져 나오는 작은 덩이 · 지나간 길의 점액
// 색은 보내 주신 그림의 초록. 연기 구름은 쓰지 않는다. Renderer.prototype 에 붙는다 — this 는 Renderer
import { sfx } from '../audio.js';

const G = { ink: '#14260c', dark: '#2f6a1e', mid: '#4f9a2e', hi: '#8fd85a', shine: '#d8ffb0', mud: '#3a2c1c' };
const R = Math.round;
const cache = new Map();
function blob(g, x, y, rx, ry, col) { g.fillStyle = col; const ri = Math.max(1, R(ry)); for (let dy = -ri; dy <= ri; dy++) { const w = R(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ri + 0.5) * (ri + 0.5))))); g.fillRect(R(x) - w, R(y) + dy, w * 2 + 1, 1); } }
// 도트 슬라임 덩이: 짙은 테 · 아래 그늘 · 왼쪽 위 빛 (sq: 눌림 정도)
function goo(r, sq) {
  const key = `${r}|${sq}`; let c = cache.get(key); if (c) return c;
  const W = r * 2 + 4, H = r * 2 + 4; c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), cx = W / 2, cy = H / 2, rx = r * (1 + sq * 0.12), ry = r * (1 - sq * 0.12);
  blob(g, cx, cy, rx + 1, ry + 1, G.ink); blob(g, cx, cy, rx, ry, G.dark); blob(g, cx - rx * 0.12, cy - ry * 0.18, rx * 0.78, ry * 0.7, G.mid);
  blob(g, cx - rx * 0.3, cy - ry * 0.38, rx * 0.32, ry * 0.22, G.hi); g.fillStyle = G.shine; g.fillRect(R(cx - rx * 0.42), R(cy - ry * 0.5), 1, 1);
  cache.set(key, c); return c;
}

export const SlimeFxMethods = {
  sWater(x, y) { return !!this.world?.isWaterAt?.(x, y); },
  sDrops(x, y, n, sp = 80, up = 100) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random() * 0.8); this.parts.push({ x, y: y - 3, vx: Math.cos(a) * s, vy: -up * (0.3 + Math.random() * 0.8), t: 0.6, max: 0.6, color: Math.random() < 0.6 ? G.hi : G.mid, g: 320, chunk: true, floor: y + 1 + Math.sin(a) * 6 }); } },
  sSplat(x, y, r, life = 2) { if (this.sWater(x, y)) { this.gSplash?.(x, y, Math.ceil(r / 2), 120); return; } (this.sfx2 ||= []).push({ k: 'splat', x, y, r, t: life, max: life, seed: Math.random() * 100 }); },
  slimeEvent(w, ev) {
    const L = (this.sfx2 ||= []);
    switch (ev.t) {
      case 'slimeNone': return true;
      case 'slimeLaunch': { const e = w.enemies.find((o) => o.id === ev.id); if (e) L.push({ k: 'launch', id: e.id, t: ev.dur + 0.3, max: ev.dur + 0.3, wind: ev.dur }); sfx('reaction', { vol: 0.5, rate: 0.7 }); return true; }
      case 'slimeFall': L.push({ k: 'fall', x: ev.x, y: ev.y, t: ev.dur, max: ev.dur }); return true;
      case 'slimeLand': this.sDrops(ev.x, ev.y, 14, 100, 120); this.sSplat(ev.x, ev.y + 2, ev.r * 0.6, 2.2); sfx('hitHeavy', { vol: 0.6, rate: 1.1 }); return true;
      case 'slimeSwell': { const e = w.enemies.find((o) => o.id === ev.id); if (e) L.push({ k: 'swell', id: e.id, t: ev.dur, max: ev.dur, big: ev.big }); sfx('reaction', { vol: 0.4, rate: 0.6 }); return true; }
      case 'slimeThrow': this.sDrops(ev.x, ev.y, 6, 60, 80); sfx('heavySwing', { vol: 0.5, rate: 1.2 }); return true;
      case 'slimePop': this.sDrops(ev.x, ev.y + 4, ev.big ? 28 : 14, ev.big ? 140 : 110, 110); this.sSplat(ev.x, ev.y + 6, ev.big ? 18 : 9, ev.big ? 2.5 : 1.6); L.push({ k: 'pop', x: ev.x, y: ev.y, t: 0.22, max: 0.22 }); sfx('hitHeavy', { vol: 0.5, rate: 1.5 }); return true;
      case 'slimeSlam': this.sDrops(ev.x, ev.y, 16, 120, 110); this.sSplat(ev.x, ev.y + 2, 16, 2.5); if (!this.sWater(ev.x, ev.y)) this.gChips?.(ev.x, ev.y, 6, 80); sfx('hitHeavy', { vol: 0.9, rate: 0.7 }); return true;
      case 'slimeSinkStart': L.push({ k: 'puddle', id: ev.id, x: ev.x, y: ev.y, t: 1.2, max: 1.2, grow: 0.5 }); sfx('reaction', { vol: 0.5, rate: 0.5 }); return true;
      case 'slimeSinkEnd': L.push({ k: 'puddle', x: ev.x, y: ev.y, t: ev.dur + 0.6, max: ev.dur + 0.6, grow: ev.dur, boil: true }); return true;
      case 'slimeRise': this.sDrops(ev.x, ev.y, 22, 130, 150); this.sSplat(ev.x, ev.y + 2, ev.r * 0.5, 2.5); if (this.sWater(ev.x, ev.y)) this.gSplash?.(ev.x, ev.y, 18, 150); sfx('hitHeavy', { vol: 0.9, rate: 0.6 }); return true;
      case 'slimeDrip': L.push({ k: 'drip', x1: ev.x, y1: ev.y, x2: ev.tx, y2: ev.ty, t: 0.35, max: 0.35 }); return true;
      case 'slimeSplit': this.sDrops(ev.x, ev.y - 6, 30, 140, 170); this.sSplat(ev.x, ev.y + 2, 26, 3); sfx('hitHeavy', { vol: 1, rate: 0.5 }); sfx('reaction', { vol: 0.6, rate: 0.5 }); return true;
    }
    return false;
  },
  drawSlimeProj(pr) {
    const g = this.g;
    if (pr.skind === 'slimeShard') { blob(g, pr.x, pr.y + 5, 2, 1, 'rgba(10,20,6,0.3)'); blob(g, pr.x, pr.y, 2.5, 2, G.ink); blob(g, pr.x, pr.y, 1.6, 1.2, G.mid); g.fillStyle = G.hi; g.fillRect(R(pr.x) - 1, R(pr.y) - 1, 1, 1); return; }
    const bigB = pr.skind === 'slimeBig', t = this.world.t * (bigB ? 9 : 14) + (pr.seed || 0), hop = Math.abs(Math.sin(t * 0.5)) * 5, sq = (Math.cos(t) + 1) / 2 > 0.85 ? 1 : 0; // 통통 튀며 난다
    blob(g, pr.x, pr.y + (bigB ? 12 : 7), bigB ? 9 : 5, bigB ? 2.5 : 1.5, 'rgba(10,20,6,0.35)');
    const img = goo(bigB ? 11 : 6, sq); g.drawImage(img, R(pr.x - img.width / 2), R(pr.y - img.height / 2 - hop));
    if (Math.random() < 0.25) this.parts.push({ x: pr.x + (Math.random() - 0.5) * 6, y: pr.y + 3 - hop, vx: 0, vy: 15, t: 0.4, max: 0.4, color: G.mid, g: 200, chunk: true, floor: pr.y + 7 });
  },
  // 바닥 층: 지나간 길의 점액 · 철퍼덕 자국 · 순간이동 웅덩이
  drawSlimeGround(w, dt) {
    const g = this.g;
    for (const o of w.slimeTrail || []) { const a = Math.min(1, o.t / 0.8, (o.max - o.t) / 0.15) * 0.8; if (a <= 0) continue; g.globalAlpha = a;
      blob(g, o.x, o.y, o.r, o.r * 0.42, G.dark); blob(g, o.x - 1, o.y - 0.5, o.r * 0.7, o.r * 0.25, G.mid); if ((o.s | 0) % 3 === 0) { g.fillStyle = G.hi; g.fillRect(R(o.x - o.r * 0.3), R(o.y - 1), 2, 1); } }
    g.globalAlpha = 1;
    const L = this.sfx2; if (!L?.length) return;
    for (const f of L) {
      if (f.k !== 'splat' && f.k !== 'puddle') continue;
      f.t -= dt; const k = Math.max(0, f.t / f.max);
      if (f.k === 'splat') { g.globalAlpha = Math.min(1, k * 2.5) * 0.85;
        for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI * 2 + f.seed, d = f.r * (0.55 + 0.3 * Math.sin(f.seed + i * 2.3)); blob(g, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d * 0.45, f.r * 0.28, f.r * 0.13, G.dark); }
        blob(g, f.x, f.y, f.r * 0.6, f.r * 0.26, G.dark); blob(g, f.x - 1, f.y - 1, f.r * 0.4, f.r * 0.14, G.mid); g.globalAlpha = 1; }
      else { const e = f.id != null ? w.enemies.find((o) => o.id === f.id) : null, u = Math.min(1, (f.max - f.t) / f.grow), rr = 22 * u * Math.min(1, f.t / 0.4), x = e && f.id != null ? f.x : f.x; // 웅덩이: 퍼지고 · 끓는다
        if (rr > 1) { blob(g, x, f.y + 2, rr + 1, rr * 0.4 + 1, G.ink); blob(g, x, f.y + 2, rr, rr * 0.4, G.dark); blob(g, x - rr * 0.15, f.y + 1, rr * 0.6, rr * 0.18, G.mid); }
        if (f.boil && Math.random() < 0.5) this.parts.push({ x: x + (Math.random() - 0.5) * rr * 1.4, y: f.y + 2 + (Math.random() - 0.5) * rr * 0.5, vx: 0, vy: -20, t: 0.3, max: 0.3, color: G.hi, g: 120, chunk: true, floor: f.y + 3 }); }
    }
  },
  // 공중 층: 부풀기(던지기 준비) · 터지는 순간 · 떨어져 나오는 덩이
  drawSlimeAir(w, dt) {
    const L = this.sfx2; if (!L?.length) return;
    const g = this.g;
    for (const f of L) {
      if (f.k === 'splat' || f.k === 'puddle') continue;
      f.t -= dt; const k = Math.max(0, f.t / f.max), u = 1 - k;
      if (f.k === 'swell') { const e = w.enemies.find((o) => o.id === f.id); if (!e) { f.t = 0; continue; } // 몸 위로 슬라임공 셋이 부풀어 오른다
        if (f.big) { const img = goo(Math.max(1, R(2 + u * 9)), 0); g.drawImage(img, R(e.x - img.width / 2), R(e.y - 38 - img.height / 2)); } // 거대 슬라임공: 머리 위에서 하나가 크게 부푼다
        else for (let i = 0; i < 3; i++) { const img = goo(Math.max(1, R(2 + u * 4)), 0); g.drawImage(img, R(e.x + (i - 1) * 12 - img.width / 2), R(e.y - 34 - Math.sin(u * Math.PI) * 4 - img.height / 2)); } }
      else if (f.k === 'launch') { const e = w.enemies.find((o) => o.id === f.id); if (!e) { f.t = 0; continue; } const el = f.max - f.t; // 하늘로 뿜는다: 몸 위에서 덩이가 위로 솟아 사라진다
        if (el > f.wind * 0.6 && Math.random() < 0.6) this.parts.push({ x: e.x + (Math.random() - 0.5) * 14, y: e.y - 30, vx: (Math.random() - 0.5) * 30, vy: -260 - Math.random() * 80, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? G.mid : G.hi, g: 0 });
        if (el > f.wind && el < f.wind + 0.25) { const img = goo(4, 1), yy = e.y - 36 - (el - f.wind) * 600; g.drawImage(img, R(e.x - img.width / 2), R(yy)); } }
      else if (f.k === 'fall') { const h = 230 * (1 - u * u), img = goo(6, 0); // 하늘에서 떨어진다: 그림자가 커지고 덩이가 빨라진다
        blob(g, f.x, f.y + 2, 2 + 6 * u, 1 + 2 * u, 'rgba(10,20,6,' + (0.15 + 0.3 * u) + ')');
        if (h < 220) { g.drawImage(img, R(f.x - img.width / 2), R(f.y - h - 6 - img.height / 2)); g.fillStyle = 'rgba(143,216,90,0.4)'; g.fillRect(R(f.x) - 1, R(f.y - h - 6 - img.height / 2 - 6), 2, 5); } }
      else if (f.k === 'pop') { const rr = 4 + u * 10; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.fillStyle = i % 2 ? G.hi : G.shine; g.globalAlpha = k * 4 > 1 ? 1 : k * 4; g.fillRect(R(f.x + Math.cos(a) * rr), R(f.y + Math.sin(a) * rr * 0.7), 2, 2); } g.globalAlpha = 1; }
      else if (f.k === 'drip') { const x = f.x1 + (f.x2 - f.x1) * u, y = f.y1 + (f.y2 - f.y1) * u - Math.sin(u * Math.PI) * 16, img = goo(3, 0); g.drawImage(img, R(x - img.width / 2), R(y - img.height / 2)); if (f.t <= 0) this.sDrops(f.x2, f.y2, 6, 50, 60); }
    }
    this.sfx2 = L.filter((f) => f.t > 0);
  },
};

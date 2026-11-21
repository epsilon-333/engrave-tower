// 늪 마녀 이펙트: 맹독 구슬 · 터지는 독액 · 덩굴 속박 · 땅을 뚫는 뿌리 · 늪으로 바뀐 물 · 출렁이며 퍼지는 늪의 파동 · 지팡이 휘두르기
// 모두 도트로 직접 찍는다 (몸 둘레 고리 · 빛나는 막대 없이). 바닥이 물이면 물보라 · 물결, 땅이면 흙. Renderer.prototype 에 붙는다 — this 는 Renderer
import { sfx } from '../audio.js';

const V = { ink: '#12200a', dark: '#2c5418', mid: '#4f8a22', hi: '#8fd84a', glow: '#d4ff92', purple: '#6a3f78' }; // 독 (마녀의 초록 구슬 색)
const BARK = { ink: '#1a120c', dark: '#3e2c1c', mid: '#5e4428', hi: '#86643e', moss: '#5f7f2a' };
const BOG = [[44, 48, 22], [58, 64, 28], [34, 36, 18], [96, 110, 44]]; // 늪 바탕 · 밝은 얼룩 · 짙은 얼룩 · 이끼 거품
const R = Math.round;
const hsh = (a, b, c = 0) => { let h = (Math.imul(a + 7, 374761393) + Math.imul(b + 3, 668265263) + Math.imul(c + 1, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const cache = new Map();
// 맹독 구슬 (도트): 짙은 테 · 안에서 소용돌이치는 독 · 왼쪽 위 빛 · f: 4장 (소용돌이가 돈다)
function orbSprite(r, f) {
  const key = `o${r}|${f}`; let c = cache.get(key); if (c) return c;
  const S = r * 2 + 3; c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data, cx = S / 2, cy = S / 2;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const P = { ink: hex(V.ink), dark: hex(V.dark), mid: hex(V.mid), hi: hex(V.hi), glow: hex(V.glow), pu: hex(V.purple) };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dd = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const rr = r + 0.6 * Math.sin(a * 3 + f * 1.57); if (dd > rr) continue;
    const edge = dd > rr - 1.1, l = (-dx * 0.6 - dy * 0.8) / r, sw = Math.sin(a * 2 + dd * 0.9 - f * 1.57);
    let col = edge ? P.ink : dd < r * 0.35 ? P.hi : sw > 0.55 ? P.hi : sw < -0.6 ? P.pu : l > 0.2 ? P.mid : P.dark;
    if (!edge && l > 0.55 && dd > r * 0.35 && dd < r * 0.75) col = P.glow; // 빛
    const i = (y * S + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); cache.set(key, c); return c;
}
// 도트 원 (가로줄로 채운다 · 납작하게)
function blob(g, x, y, rx, ry, col) { g.fillStyle = col; const ri = Math.max(1, R(ry)); for (let dy = -ri; dy <= ri; dy++) { const w = R(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ri + 0.5) * (ri + 0.5))))); g.fillRect(R(x) - w, R(y) + dy, w * 2 + 1, 1); } }
// 덩굴 · 뿌리 한 가닥: 굵기가 줄어드는 곡선 (바탕 → 끝) · 짙은 테 → 몸 → 위쪽 밝은 면
function strand(g, pts, w0, w1, C) {
  const n = pts.length; if (n < 2) return;
  for (const [pass, add] of [[C.ink, 1], [C.dark, 0], [C.mid, -0.6]]) {
    g.fillStyle = pass;
    for (let i = 0; i < n; i++) { const [x, y] = pts[i], w = Math.max(0.5, w0 + (w1 - w0) * (i / (n - 1)) + add); if (w <= 0.4) continue; const s = Math.max(1, R(w * 2)); g.fillRect(R(x - s / 2), R(y - s / 2), s, s); }
  }
  g.fillStyle = C.hi; for (let i = 1; i < n - 1; i += 2) { const [x, y] = pts[i], w = w0 + (w1 - w0) * (i / (n - 1)); if (w > 1.4) g.fillRect(R(x - w * 0.5), R(y - w * 0.6), 1, 1); }
}
const VINE = { ink: V.ink, dark: V.dark, mid: V.mid, hi: V.hi };
// 촉수 줄기 (도트): 곡선을 1px 간격으로 다시 찍어 매끈하게 · 짙은 테 → 몸 → 빛 받는 쪽(왼쪽 위) 밝은 면 · 반대쪽 그늘
//   마디 띠 · 바깥으로 난 가시 · 끝은 뾰족하게
const TEN = { ink: '#0e1a08', shade: '#1f3c10', dark: '#2c5418', mid: '#4f8a22', hi: '#8fd84a', shine: '#c8f08a', band: '#1a3410', thorn: '#d8f0a0' };
function tentacle(g, pts, w0, w1, seed = 0) {
  const P = []; // 1px 간격으로 다시 찍기
  for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay))); for (let k = 0; k < n; k++) P.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); }
  P.push(pts[pts.length - 1]); const N = P.length; if (N < 3) return;
  const W = (i) => { const s = i / (N - 1); return w1 + (w0 - w1) * Math.pow(1 - s, 0.8); };
  const nor = (i) => { const [ax, ay] = P[Math.max(0, i - 2)], [bx, by] = P[Math.min(N - 1, i + 2)], l = Math.hypot(bx - ax, by - ay) || 1; let nx = -(by - ay) / l, ny = (bx - ax) / l; if (nx * -0.6 + ny * -0.8 < 0) { nx = -nx; ny = -ny; } return [nx, ny]; }; // 빛 받는 쪽 법선
  const disc = (x, y, r, col) => { g.fillStyle = col; const ri = Math.max(0, Math.round(r)); for (let dy = -ri; dy <= ri; dy++) { const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy))); g.fillRect(Math.round(x) - hw, Math.round(y) + dy, hw * 2 + 1, 1); } };
  for (let i = 0; i < N; i++) disc(P[i][0], P[i][1], W(i) + 1, TEN.ink); // 테
  for (let i = 0; i < N; i++) disc(P[i][0], P[i][1], W(i), TEN.shade); // 그늘 (아래쪽에 남는다)
  for (let i = 0; i < N; i++) { const [nx, ny] = nor(i), w = W(i); disc(P[i][0] + nx * w * 0.3, P[i][1] + ny * w * 0.3, w * 0.72, TEN.dark); }
  for (let i = 0; i < N; i++) { const [nx, ny] = nor(i), w = W(i); if (w > 1.6) disc(P[i][0] + nx * w * 0.45, P[i][1] + ny * w * 0.45, w * 0.38, TEN.mid); }
  for (let i = 0; i < N; i += 1) { const [nx, ny] = nor(i), w = W(i); if (w > 2.2) { g.fillStyle = i % 9 < 5 ? TEN.hi : TEN.mid; g.fillRect(Math.round(P[i][0] + nx * w * 0.62), Math.round(P[i][1] + ny * w * 0.62), 1, 1); } }
  for (let i = 6; i < N - 6; i += 7) { const [nx, ny] = nor(i), w = W(i); g.fillStyle = TEN.band; for (let d = -w * 0.8; d <= w * 0.5; d += 0.7) g.fillRect(Math.round(P[i][0] + nx * d), Math.round(P[i][1] + ny * d), 1, 1); } // 마디
  for (let i = 9, sd = 1; i < N - 4; i += 9, sd = -sd) { const [nx, ny] = nor(i), w = W(i), bx = P[i][0] + nx * sd * (w + 0.5), by = P[i][1] + ny * sd * (w + 0.5), [tx, ty] = P[Math.min(N - 1, i + 3)], fx = (tx - P[i][0]) * 0.4, fy = (ty - P[i][1]) * 0.4; // 가시: 바깥 + 끝쪽으로
    g.fillStyle = TEN.ink; g.fillRect(Math.round(bx), Math.round(by), 1, 1); g.fillStyle = TEN.thorn; g.fillRect(Math.round(bx + nx * sd * 1.2 + fx), Math.round(by + ny * sd * 1.2 + fy), 1, 1); g.fillStyle = TEN.ink; g.fillRect(Math.round(bx + nx * sd * 2.2 + fx * 1.8), Math.round(by + ny * sd * 2.2 + fy * 1.8), 1, 1); }
  const [ex, ey] = P[N - 1]; g.fillStyle = TEN.shine; g.fillRect(Math.round(ex), Math.round(ey), 1, 1);
}


export const WitchFxMethods = {
  wWater(x, y) { return !!this.world?.isWaterAt?.(x, y); },
  wDrops(x, y, n, sp = 70, up = 90, col) { // 독액 방울: 솟았다 떨어져 바닥에서 튄다
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random() * 0.8); this.parts.push({ x, y: y - 3, vx: Math.cos(a) * s, vy: -up * (0.4 + Math.random() * 0.8), t: 0.6, max: 0.6, color: col || (Math.random() < 0.6 ? V.hi : V.mid), g: 300, chunk: true, floor: y + 1 + Math.sin(a) * 5 }); }
  },
  witchEvent(w, ev) {
    const L = (this.wfx ||= []);
    switch (ev.t) {
      case 'witchNone': return true;
      case 'witchCast': L.push({ k: 'cast', id: ev.id, t: ev.dur, max: ev.dur, big: ev.big, orb: ev.orb }); sfx('cast', { vol: 0.5, rate: ev.big ? 0.6 : 0.8 }); return true;
      case 'witchSwing': L.push({ k: 'swing', ...ev, t: 0.2, max: 0.2 });
        for (let i = 0; i < 8; i++) { const a = ev.ang - 1.1 + (i / 7) * 2.2; this.parts.push({ x: ev.x + Math.cos(a) * ev.r * 0.8, y: ev.y + Math.sin(a) * ev.r * 0.5, vx: Math.cos(a) * 60, vy: Math.sin(a) * 30 - 30, t: 0.45, max: 0.45, color: i % 2 ? V.hi : V.mid, g: 260, chunk: true, floor: ev.y + 10 + Math.sin(a) * 8 }); }
        sfx('heavySwing', { vol: 0.6, rate: 1.1 }); return true;
      case 'witchBindTele': L.push({ k: 'sprout', x: ev.x, y: ev.y, t: ev.dur, max: ev.dur, seed: Math.random() * 100, water: this.wWater(ev.x, ev.y) }); return true;
      case 'witchBind': L.push({ k: 'bind', t: ev.dur + 0.25, max: ev.dur + 0.25, seed: Math.random() * 100 }); { const p = w.player; this.wDrops(p.x, p.y, 6, 50, 60, V.mid); if (this.wWater(p.x, p.y)) this.gSplash(p.x, p.y, 8, 80); } sfx('hitHeavy', { vol: 0.6, rate: 1.2 }); sfx('reaction', { vol: 0.4, rate: 0.7 }); return true;
      case 'witchBindMiss': L.push({ k: 'whip', x: ev.x, y: ev.y, t: 0.45, max: 0.45, seed: Math.random() * 100 }); return true;
      case 'witchRootRise': { // 내 자리에서 초록 줄기가 길게 솟는다
        L.push({ k: 'stalk', id: ev.id, x: ev.x, y: ev.y, el: 0, rise: ev.dur, len: 80, t: 9, max: 9, seed: Math.random() * 100 });
        if (this.wWater(ev.x, ev.y)) this.gSplash(ev.x, ev.y, 12, 120); else this.gChips(ev.x, ev.y, 8, 70);
        sfx('crack', { vol: 0.5, rate: 1.2 }); return true; }
      case 'witchRootAim': { const f = L.find((o) => o.k === 'stalk' && o.id === ev.id); if (f) { f.ang = ev.ang; f.len = ev.len; f.aimAt = f.el; f.aimDur = ev.dur; } return true; }
      case 'witchRootWhip': { const f = L.find((o) => o.k === 'stalk' && o.id === ev.id); if (f) f.slamAt = f.el; sfx('heavySwing', { vol: 0.6, rate: 0.8 }); return true; }
      case 'witchRootSlam': { // 내 쪽으로 내려쳤다: 줄기가 닿은 자리마다 흙 · 물보라
        const f = L.find((o) => o.k === 'stalk' && o.id === ev.id); if (f) { f.landAt = f.el; f.t = f.max = 0.7; }
        for (let d = 14; d <= ev.len; d += 12) { const x = ev.x + Math.cos(ev.ang) * d, y = ev.y + Math.sin(ev.ang) * d; if (this.wWater(x, y)) this.gSplash(x, y, 5, 90); else this.gChips(x, y, 3, 60); }
        sfx('hitHeavy', { vol: 0.8, rate: 0.75 }); sfx('crack', { vol: 0.6, rate: 0.9 }); return true; }
      case 'witchOrbShot': for (let i = 0; i < 4; i++) this.parts.push({ x: ev.x, y: ev.y, vx: Math.cos(ev.ang) * 30 + (Math.random() - 0.5) * 30, vy: Math.sin(ev.ang) * 20 - 10, t: 0.4, max: 0.4, color: V.hi, g: 200 }); sfx('cast', { vol: 0.4, rate: 0.6 }); return true;
      case 'witchOrbPop': { // 맹독 구슬이 터진다: 독액이 사방으로 · 독 연기 · 바닥에 독액 자국 (물이면 초록 물결)
        const wet = this.wWater(ev.x, ev.y + 6);
        this.wDrops(ev.x, ev.y, 18, 110, 120);
        L.push({ k: 'pop', x: ev.x, y: ev.y, r: ev.r, t: 0.3, max: 0.3 });
        L.push(wet ? { k: 'gripple', x: ev.x, y: ev.y + 6, r: ev.r, t: 1, max: 1 } : { k: 'splat', x: ev.x, y: ev.y + 6, r: ev.r * 0.7, t: 2.5, max: 2.5, seed: Math.random() * 100 });
        sfx('hitHeavy', { vol: 0.6, rate: 1.3 }); sfx('reaction', { vol: 0.35, rate: 1.4 }); return true; }
      case 'witchSwampTele': L.push({ k: 'boil', x: ev.x, y: ev.y, r: ev.r, t: ev.dur, max: ev.dur }); return true;
      case 'witchSwamp': L.push({ k: 'boil', x: ev.x, y: ev.y, r: ev.r, t: 1.2, max: 1.2, gas: true }); sfx('reaction', { vol: 0.5, rate: 0.5 }); sfx('echo', { vol: 0.4, rate: 0.5 }); return true;
      case 'witchWave': L.push({ k: 'wave', x: ev.x, y: ev.y, r: ev.r, t: ev.dur + 0.25, max: ev.dur + 0.25, dur: ev.dur, seed: Math.random() * 100 }); this.wDrops(ev.x, ev.y, 10, 60, 120); sfx('hitHeavy', { vol: 0.7, rate: 0.6 }); sfx('reaction', { vol: 0.5, rate: 0.6 }); return true;
    }
    return false;
  },
  drawVenomOrb(pr) { // 맹독 구슬: 통통 튀듯 출렁이며 날아간다 · 독 방울이 떨어진다 · 바닥에 그림자
    const g = this.g, f = ((this.world.t * 8 + (pr.seed || 0)) | 0) & 3, r = pr.rad || 8, bob = Math.sin(this.world.t * 9 + (pr.seed || 0)) * 1.5;
    g.fillStyle = 'rgba(12,20,8,0.35)'; blob(g, pr.x, pr.y + 9, r * 0.8, 2, 'rgba(12,20,8,0.35)');
    const img = orbSprite(r, f); g.drawImage(img, R(pr.x - img.width / 2), R(pr.y - img.height / 2 + bob));
    if (Math.random() < 0.35) this.parts.push({ x: pr.x + (Math.random() - 0.5) * r, y: pr.y + r * 0.6, vx: 0, vy: 10, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? V.hi : V.mid, g: 200, chunk: true, floor: pr.y + 9 });
  },
  // 늪이 된 물 칸: 탁한 올리브빛 · 얼룩 · 이끼 거품 · 보글보글 (퍼질 때는 가운데부터 · 끝날 때는 옅어진다)
  drawBog(w, cx, cy) {
    const bog = w.bog; if (!bog?.size) return;
    const g = this.g, VW = this.VW, VH = this.VH, tw = w.tw, tt = w.t;
    for (const [i, o] of bog) {
      if (o.d > 0) continue;
      const x = (i % tw) * 16, y = ((i / tw) | 0) * 16; if (x < cx - 16 || x > cx + VW || y < cy - 16 || y > cy + VH) continue;
      const a = Math.min(1, (o.max - o.d - o.t) / 0.35 + 0.15, o.t / 1.5);
      const tx = i % tw, ty = (i / tw) | 0;
      g.fillStyle = `rgba(${BOG[0]},${0.82 * a})`; g.fillRect(x, y, 16, 16);
      for (let q = 0; q < 14; q++) { const h = hsh(tx, ty, q), px = x + ((h * 16) | 0), py = y + ((hsh(ty, tx, q) * 16) | 0), c = q < 6 ? BOG[1] : q < 11 ? BOG[2] : BOG[3]; g.fillStyle = `rgba(${c},${a * 0.9})`; g.fillRect(px, py, q < 3 ? 2 : 1, 1); }
      const ph = tt * 2 + hsh(tx, ty, 9) * 6; g.fillStyle = `rgba(150,170,70,${a * (0.2 + 0.15 * Math.sin(ph))})`; g.fillRect(x + ((hsh(tx, ty, 3) * 10) | 0), y + 4 + ((hsh(tx, ty, 4) * 9) | 0), 4, 1); // 흐릿한 윤
      if (a > 0.6 && Math.random() < 0.012) this.parts.push({ x: x + 3 + Math.random() * 10, y: y + 4 + Math.random() * 9, vx: 0, vy: -4, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#8a9a3a' : '#a8b850', g: 0 }); // 거품이 터진다
    }
  },
  drawWitchFx(w, dt, ground) {
    const L = this.wfx; if (!L?.length) return;
    const g = this.g;
    for (const f of L) {
      const gr = f.k === 'splat' || f.k === 'gripple' || f.k === 'boil' || f.k === 'wave';
      if (gr !== !!ground) continue;
      f.t -= dt; const k = Math.max(0, f.t / f.max), u = 1 - k;
      if (f.k === 'cast') { // 지팡이 끝에 독 방울이 모인다 (들어 올린 손 위)
        const e = w.enemies.find((o) => o.id === f.id); if (!e || e.dead) { f.t = 0; continue; }
        const hx = e.x + (e.dir || 1) * 10, hy = e.y - 34;
        if (Math.random() < (f.big ? 0.9 : 0.6)) { const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 10; this.parts.push({ x: hx + Math.cos(a) * d, y: hy + Math.sin(a) * d * 0.7, vx: -Math.cos(a) * d * 3, vy: -Math.sin(a) * d * 2, t: 0.3, max: 0.3, color: Math.random() < 0.6 ? V.hi : V.glow, g: 0 }); }
        if (f.orb || f.big) { const rr = Math.max(1, R((f.big ? 4 : 3) * u)); blob(g, hx, hy, rr + 1, rr + 1, V.ink); blob(g, hx, hy, rr, rr, V.mid); g.fillStyle = V.glow; g.fillRect(R(hx - rr * 0.4), R(hy - rr * 0.4), 1, 1); }
        if (Math.random() < 0.3) this.parts.push({ x: hx + (Math.random() - 0.5) * 4, y: hy + 3, vx: 0, vy: 20, t: 0.4, max: 0.4, color: V.mid, g: 200, chunk: true, floor: e.y + 2 });
      } else if (f.k === 'swing') { // 지팡이가 지나간 자리: 독액이 흩뿌려진 초승달 (점으로)
        const a0 = f.ang - 1.2, a1 = f.ang + 1.2, n = 18, sh = u * 2.4;
        for (let i = 0; i <= n; i++) { const s = i / n; if (s > sh) break; const a = a0 + (a1 - a0) * s, rr = f.r * (0.75 + 0.2 * Math.sin(s * Math.PI));
          g.fillStyle = s > sh - 0.25 ? V.glow : i % 2 ? V.hi : V.mid; g.globalAlpha = Math.min(1, k * 2.5); g.fillRect(R(f.x + Math.cos(a) * rr), R(f.y + Math.sin(a) * rr * 0.6), 2, 1); g.fillStyle = V.dark; g.fillRect(R(f.x + Math.cos(a) * (rr - 3)), R(f.y + Math.sin(a) * (rr - 3) * 0.6), 1, 1); }
        g.globalAlpha = 1;
      } else if (f.k === 'sprout' || f.k === 'whip') { // 속박 예고: 덩굴 끝이 땅에서 꿈틀대며 솟는다 / 빗나감: 허공을 휘감고 가라앉는다
        const n = 5, grow = f.k === 'sprout' ? Math.min(1, u * 1.3) : Math.sin(u * Math.PI);
        for (let s = 0; s < n; s++) { const a = (s / n) * Math.PI * 2 + f.seed, bx = f.x + Math.cos(a) * 12, by = f.y + Math.sin(a) * 7, H = (f.k === 'sprout' ? 7 : 20) * grow * (0.7 + hsh(s, 1, f.seed | 0) * 0.5), pts = [];
          for (let j = 0; j <= 8; j++) { const s2 = j / 8; pts.push([bx - Math.cos(a) * s2 * (f.k === 'whip' ? 8 : 2) + Math.sin(w.t * 10 + s * 2 + s2 * 4) * 1.5 * s2, by - H * s2]); }
          if (H > 1) strand(g, pts, 1.0, 0.3, VINE); }
      } else if (f.k === 'bind') { // 덩굴이 몸을 휘감았다: 발밑에서 감아 올라가며 조인다 · 잎
        const p = w.player, gr2 = Math.min(1, u * 6), fade = Math.min(1, f.t / 0.25);
        if (fade <= 0) continue; g.globalAlpha = fade;
        for (let s = 0; s < 3; s++) { const pts = [], ph = f.seed + s * 2.09, H = 20 * gr2;
          for (let j = 0; j <= 16; j++) { const s2 = j / 16, a = ph + s2 * 5.5 + Math.sin(w.t * 6) * 0.15; pts.push([p.x + Math.cos(a) * (6.5 - s2 * 1.5), p.y + 2 - H * s2 + Math.sin(a) * 2]); }
          strand(g, pts, 0.6, 0.4, VINE);
          const [lx, ly] = pts[10 + s * 2] || pts[pts.length - 1]; g.fillStyle = V.hi; g.fillRect(R(lx), R(ly) - 1, 2, 1); g.fillStyle = V.glow; g.fillRect(R(lx) + 1, R(ly) - 2, 1, 1); }
        g.globalAlpha = 1;
        if (Math.random() < 0.15) this.parts.push({ x: p.x + (Math.random() - 0.5) * 8, y: p.y - Math.random() * 16, vx: 0, vy: 20, t: 0.4, max: 0.4, color: V.mid, g: 200, chunk: true, floor: p.y + 2 });
      } else if (f.k === 'stalk') { // 초록 줄기: 솟는다(살랑) → 내 반대쪽으로 젖혔다가 → 내 쪽으로 내려친다 → 땅에 누웠다 → 땅속으로 빨려 들어간다
        f.el += dt; const el = f.el, ang = f.ang ?? 0;
        let grow = Math.min(1, el / f.rise), shrink = 1;
        grow = 1 - (1 - grow) * (1 - grow) * (1 - grow);
        const N = 28, WHIP = 0.22, lean = f.aimAt != null ? Math.min(1, (el - f.aimAt) / f.aimDur) : 0;
        const sp = f.slamAt != null ? (el - f.slamAt) / WHIP : -1; // 채찍: 0 → 1 동안 밑동부터 차례로 눕는다
        if (f.landAt != null) { const back = el - f.landAt - 0.25; if (back > 0) shrink = Math.max(0, 1 - back / 0.35); }
        const Ls = f.len * grow * shrink, cx = Math.cos(ang), cy = Math.sin(ang), seg = Ls / N, pts = [[f.x, f.y]];
        let x = f.x, y = f.y, flat = false;
        for (let j = 1; j <= N; j++) { const s = j / N;
          let th; // 이 마디가 세로에서 내 쪽으로 기운 각 (0 = 곧게 섰다 · π/2 = 땅에 누웠다)
          if (sp < 0) th = Math.sin(el * 6 + s * 3.5 + f.seed) * 0.22 * s - lean * (0.25 + 0.55 * s) + (s > 0.8 ? -(s - 0.8) * 2.5 * (1 - lean) : 0); // 살랑 · 젖히기 · 끝이 말린다
          else { const q = Math.max(0, Math.min(1, sp * 2.3 - s * 1.3)), e2 = q * q * (3 - 2 * q), from = -lean * (0.25 + 0.55 * s); th = from + (Math.PI / 2 - from) * e2; // 밑동이 먼저 · 끝은 한참 늦게 따라온다
            if (q < 1 && q > 0) th -= Math.sin(q * Math.PI) * 0.9 * s * s; // 늦게 오는 끝이 뒤로 휘어 S자로 출렁인다
            const after = sp - 1; if (after > 0 && after < 1.6) th -= Math.sin(after * 9) * Math.exp(-after * 3.5) * 0.35 * s * s; } // 닿은 뒤 끝이 한두 번 튀었다 가라앉는다
          const dirx = sp < 0 && f.aimAt == null ? 1 : cx, diry = sp < 0 && f.aimAt == null ? 0 : cy; // 겨누기 전에는 옆으로 살랑
          x += dirx * Math.sin(th) * seg; y += diry * Math.sin(th) * seg - Math.cos(th) * seg;
          pts.push([x, y]); }
        blob(g, f.x, f.y + 1, 5, 2, this.wWater(f.x, f.y) ? '#2e4a5a' : '#2a1e14'); // 뚫고 나온 구멍
        if (Ls > 2) { if (sp > 0.6) for (const [px, py] of pts) { g.fillStyle = 'rgba(10,16,6,0.35)'; g.fillRect(R(px) - 1, R(py) + 2, 3, 1); } // 누운 줄기의 그림자
          tentacle(g, pts, 3.2, 1.3, f.seed); }
      } else if (f.k === 'pop') { // 터지는 순간: 짙은 테가 부풀다 찢어진다
        const rr = f.r * (0.3 + u * 0.7); g.globalAlpha = k;
        for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, j = 0.85 + hsh(i, 3) * 0.3; g.fillStyle = i % 3 ? V.hi : V.glow; g.fillRect(R(f.x + Math.cos(a) * rr * j), R(f.y + Math.sin(a) * rr * j * 0.62), 2, 2); }
        g.globalAlpha = 1;
      } else if (f.k === 'splat') { // 바닥에 남은 독액 자국: 울퉁불퉁 · 옅어지며 마른다
        const a = Math.min(1, k * 2); g.globalAlpha = a * 0.85;
        for (let i = 0; i < 7; i++) { const an = (i / 7) * Math.PI * 2 + f.seed, d = f.r * 0.5 * hsh(i, 5, f.seed | 0); blob(g, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d * 0.5, f.r * 0.35, f.r * 0.15, V.dark); }
        blob(g, f.x, f.y, f.r * 0.45, f.r * 0.2, V.mid); g.fillStyle = V.hi; g.fillRect(R(f.x - f.r * 0.2), R(f.y - 1), 2, 1);
        g.globalAlpha = 1;
      } else if (f.k === 'gripple') { // 물 위: 초록 독이 번지는 물결
        for (const [kk, col] of [[1, V.hi], [0.6, '#9ccfe8']]) { const rr = f.r * (0.2 + u * 0.9) * kk, n = Math.max(8, R(rr * 2.2)); g.fillStyle = col; g.globalAlpha = k * 0.85;
          for (let i = 0; i < n; i++) { if (i % 3 === 2) continue; const a = (i / n) * Math.PI * 2; g.fillRect(R(f.x + Math.cos(a) * rr), R(f.y + Math.sin(a) * rr * 0.42), 1, 1); } }
        g.globalAlpha = 1;
      } else if (f.k === 'boil') { // 물이 늪으로: 거품이 끓고 · 독 연기가 오른다
        const n = f.gas ? 4 : 2;
        for (let i = 0; i < n; i++) { if (Math.random() > 0.7) continue; const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * f.r, x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d * 0.7; if (!this.wWater(x, y)) continue;
          this.parts.push({ x, y, vx: 0, vy: -8, t: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#a8c050' : '#c8e070', g: 0 }); }
      } else if (f.k === 'wave') { // 늪의 파동: 늪액이 출렁이며 둥글게 퍼진다 (덩이마다 오르내리고 · 마루에서 방울이 튄다 · 벽에서 끊긴다)
        const s = Math.min(1, (f.max - f.t) / f.dur), rr = f.r * (1 - (1 - s) * (1 - s)), fade = Math.min(1, f.t / 0.25), n = Math.max(16, R(rr * 1.1));
        g.globalAlpha = fade;
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.62; if (w.wallAt?.(x, y)) continue;
          const h = (4 + 3 * Math.sin(i * 1.9 + w.t * 18 + f.seed)) * (1 - s * 0.55), bw = 3 + (1 - s) * 3;
          const ix = f.x + Math.cos(a) * (rr - 6), iy = f.y + Math.sin(a) * (rr - 6) * 0.62; if (i % 2 === 0 && rr > 10) { g.fillStyle = V.dark; g.fillRect(R(ix), R(iy), 2, 1); } // 지나간 자리에 남는 늪액
          blob(g, x, y + 1, bw + 1, 2, V.ink); blob(g, x, y - h * 0.5, bw, Math.max(1.5, h * 0.6), V.dark); blob(g, x, y - h * 0.7, bw * 0.7, Math.max(1, h * 0.35), V.mid);
          g.fillStyle = i % 2 ? V.hi : V.glow; g.fillRect(R(x - 1), R(y - h - 0.5), 2, 1); // 출렁이는 마루의 거품
          if (Math.random() < 0.07 * (1 - s)) this.parts.push({ x, y: y - h, vx: Math.cos(a) * 30, vy: -50 - Math.random() * 40, t: 0.45, max: 0.45, color: V.hi, g: 280, chunk: true, floor: y + 2 }); }
        g.globalAlpha = 1;
      }
    }
    this.wfx = L.filter((f) => f.t > 0);
  },
};

// 이끼 골렘 이펙트: 돌던지기(포물선으로 나는 큰 돌) · 돌떨구기(하늘에서 떨어지는 돌) · 땅 갈라짐 · 흙먼지 · 돌 파편 · 작은 돌(돌뿌리기) · 자가수복(돌이 몸으로 돌아오고 이끼가 돋는다)
// 돌은 골렘 그림과 같은 색으로 도트를 찍는다 (밝은 윗면 · 짙은 아랫면 · 테두리 · 이끼). Renderer.prototype 에 붙는다 — this 는 Renderer
import { sfx } from '../audio.js';

const ROCK = { hi: [194, 171, 145], mid: [158, 138, 120], lo: [99, 86, 79], ink: [20, 14, 18], moss: [99, 115, 67], moss2: [130, 153, 77] };
const R = Math.round;
const cache = new Map();
const hsh = (a, b, c = 0) => { let h = (Math.imul(a + 7, 374761393) + Math.imul(b + 3, 668265263) + Math.imul(c + 1, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 도트 돌: 울퉁불퉁한 둥근 덩이 · 왼쪽 위가 밝다 · v: 모양 갈래(0~3) · moss: 윗면 이끼
function rockSprite(r, v = 0, moss = false) {
  const key = `${r}|${v}|${moss}`; let c = cache.get(key); if (c) return c;
  const S = r * 2 + 3; c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data, cx = S / 2, cy = S / 2;
  const inside = (x, y) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = Math.atan2(dy, dx), k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 7); return Math.hypot(dx, dy) <= r * (0.82 + 0.3 * hsh(k, v, r)); };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
    const lx = (x + 0.5 - cx) / r, ly = (y + 0.5 - cy) / r, l = -lx * 0.6 - ly * 0.8;
    let col = edge ? ROCK.ink : l > 0.35 ? ROCK.hi : l > -0.25 ? ROCK.mid : ROCK.lo;
    if (!edge && moss && ly < -0.15 && hsh(x, y, v) < 0.75) col = l > 0.2 ? ROCK.moss2 : ROCK.moss;
    const i = (y * S + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); cache.set(key, c); return c;
}
// 돌을 90도씩 돌려 찍는다 (도트가 번지지 않게)
function drawRock(g, x, y, r, v, rot, moss) {
  const img = rockSprite(r, v & 3, moss), q = ((rot | 0) % 4 + 4) % 4;
  g.save(); g.translate(R(x), R(y)); g.rotate(q * Math.PI / 2); g.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2)); g.restore();
}
function shadowAt(g, x, y, rx, a) { // 납작한 도트 그림자
  g.fillStyle = `rgba(16,10,12,${a})`; const ry = Math.max(1, R(rx * 0.35));
  for (let dy = -ry; dy <= ry; dy++) { const hw = R(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))))); g.fillRect(R(x) - hw, R(y) + dy, hw * 2 + 1, 1); }
}

export const GolemFxMethods = {
  // 바닥에 따라: 물 위면 물보라 · 물방울 · 물결, 땅이면 흙먼지 · 돌 파편 · 갈라짐
  gWater(x, y) { const w = this.world; return !!w?.isWaterAt?.(x, y); },
  gSplash(x, y, n, up = 110) { // 물보라: 하얀 물방울이 솟았다 떨어지고 · 물거품 · 물결
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 50; this.parts.push({ x: x + Math.cos(a) * 3, y: y - 2, vx: Math.cos(a) * s, vy: -up * (0.5 + Math.random() * 0.7), t: 0.55, max: 0.55, color: Math.random() < 0.6 ? '#e8f8ff' : '#9ccfe8', g: 340 }); }
    for (let i = 0; i < Math.ceil(n / 4); i++) this.parts.push({ x: x + (Math.random() - 0.5) * 10, y: y, vx: (Math.random() - 0.5) * 16, vy: -6, t: 0.6, max: 0.6, color: '#eef8ff', g: 0, puff: true, size: 2 });
    (this.gfx ||= []).push({ k: 'ripple', x, y, r: 6 + n * 1.2, t: 0.8, max: 0.8 });
  },
  gDust(x, y, n, sp = 60, up = 20) {
    if (this.gWater(x, y)) return this.gSplash(x, y, n); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random() * 0.8); this.parts.push({ x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - up * Math.random(), t: 0.6 + Math.random() * 0.3, max: 0.9, color: Math.random() < 0.5 ? '#a89880' : '#8a7a66', g: -4, puff: true, size: 2 + Math.random() * 2 }); } },
  gChips(x, y, n, sp = 90) { if (this.gWater(x, y)) return this.gSplash(x, y, Math.ceil(n / 2), 80); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x, y: y - 4, vx: Math.cos(a) * sp * (0.4 + Math.random()), vy: -50 - Math.random() * 80, t: 0.7, max: 0.7, color: ['#c2ab91', '#9e8a78', '#63564f'][i % 3], g: 300, chunk: true, floor: y + 2 + Math.sin(a) * 6 }); } },
  gCrack(x, y, n, len, life = 1.4) { // 땅 갈라짐: 가운데서 뻗는 들쭉날쭉한 금 (점마다 미리 정해 둔다)
    if (this.gWater(x, y)) { (this.gfx ||= []).push({ k: 'ripple', x, y, r: len, t: 1, max: 1 }, { k: 'ripple', x, y, r: len * 0.6, t: 0.8, max: 0.8 }); return; } // 물 위: 금 대신 퍼지는 물결
    const lines = [];
    for (let i = 0; i < n; i++) { let a = (i / n) * Math.PI * 2 + Math.random() * 0.5, px = x, py = y; const pts = [], L = len * (0.6 + Math.random() * 0.5);
      for (let s = 0; s < L; s += 1) { a += (Math.random() - 0.5) * 0.35; px += Math.cos(a); py += Math.sin(a) * 0.7; const w = this.world; if (w && (w.isWaterAt?.(px, py) || w.wallAt?.(px, py))) break; pts.push([R(px), R(py)]); } // 금은 땅에서만 (물 · 벽에 닿으면 멈춘다)
      lines.push(pts); }
    (this.gfx ||= []).push({ k: 'crack', lines, t: life, max: life, grow: 0.12 });
  },
  golemEvent(w, ev) {
    const L = (this.gfx ||= []);
    switch (ev.t) {
      case 'golemPunch': this.gDust(ev.x, ev.y, 10, 70); this.gChips(ev.x, ev.y, 8); this.gCrack(ev.x, ev.y, 4, 12, 1); sfx('hitHeavy', { vol: 0.9, rate: 0.55 }); return true;
      case 'golemThrow': L.push({ k: 'throw', ...ev, t: ev.dur, max: ev.dur, v: (Math.random() * 4) | 0 }); sfx('heavySwing', { vol: 0.8, rate: 0.5 }); return true;
      case 'golemRockLand': this.gDust(ev.x, ev.y, 14, 80); this.gChips(ev.x, ev.y, 14, 110); this.gCrack(ev.x, ev.y, 6, ev.r); L.push({ k: 'bits', x: ev.x, y: ev.y, t: 0.5, max: 0.5, seed: Math.random() * 100 }); sfx('hitHeavy', { vol: 1, rate: 0.5 }); sfx('crack', { vol: 0.6 }); return true;
      case 'golemMeteor': L.push({ k: 'meteor', ...ev, t: ev.dur, max: ev.dur, v: (Math.random() * 4) | 0 }); return true;
      case 'golemMeteorHit': this.gDust(ev.x, ev.y, 18, 100, 30); this.gChips(ev.x, ev.y, 16, 120); this.gCrack(ev.x, ev.y, 7, ev.r + 6, 1.8); if (!this.gWater(ev.x, ev.y)) L.push({ k: 'crater', x: ev.x, y: ev.y, r: ev.r * 0.6, t: 2.2, max: 2.2 }); else this.gSplash(ev.x, ev.y, 22, 170); L.push({ k: 'bits', x: ev.x, y: ev.y, t: 0.6, max: 0.6, seed: Math.random() * 100 }); sfx('hitHeavy', { vol: 1, rate: 0.45 }); sfx('crack', { vol: 0.7, rate: 0.8 }); return true;
      case 'golemRoar': { const e = w.enemies.find((o) => o.id === ev.id); if (e) L.push({ k: 'raise', id: e.id, t: 0.6, max: 0.6 }); this.shake = Math.max(this.shake, 3); sfx('hitHeavy', { vol: 0.7, rate: 0.4 }); return true; }
      case 'golemDust': if (this.gWater(ev.x, ev.y)) { for (let i = 0; i < 3; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 12, y: ev.y, vx: -Math.cos(ev.ang) * 30 + (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 40, t: 0.45, max: 0.45, color: Math.random() < 0.6 ? '#e8f8ff' : '#9ccfe8', g: 320 }); if (Math.random() < 0.3) L.push({ k: 'ripple', x: ev.x, y: ev.y, r: 10, t: 0.6, max: 0.6 }); return true; }
        for (let i = 0; i < (ev.roll ? 3 : 2); i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 10, y: ev.y + 2, vx: -Math.cos(ev.ang) * (20 + Math.random() * 30) + (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 14, t: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#a89880' : '#8a7a66', g: -2, puff: true, size: 3 });
        if (ev.roll && Math.random() < 0.6) this.gChips(ev.x, ev.y, 1, 40); if (Math.random() < 0.35) sfx('step', { vol: 0.5, rate: 0.5 }); return true;
      case 'golemImpact': this.gChips(ev.x, ev.y, 10, 100); this.gDust(ev.x, ev.y + 4, 6, 50); L.push({ k: 'bits', x: ev.x, y: ev.y, t: 0.4, max: 0.4, seed: Math.random() * 100 }); sfx('hitHeavy', { vol: 1, rate: 0.7 }); return true;
      case 'golemLand': // 착지 땅울림: 둘레로 갈라짐 · 바깥으로 퍼지는 흙먼지 · 튀는 돌
        this.gCrack(ev.x, ev.y, 9, ev.r, 2);
        if (this.gWater(ev.x, ev.y)) this.gSplash(ev.x, ev.y, 26, 150);
        for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, s = 110 + Math.random() * 50; if (this.gWater(ev.x + Math.cos(a) * 14, ev.y + Math.sin(a) * 10)) continue; this.parts.push({ x: ev.x + Math.cos(a) * 12, y: ev.y + 2 + Math.sin(a) * 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, t: 0.6, max: 0.6, color: i % 3 ? '#a89880' : '#7a6a58', g: 0, puff: true, size: 3 }); }
        this.gChips(ev.x, ev.y, 16, 130); sfx('hitHeavy', { vol: 1, rate: 0.4 }); sfx('crack', { vol: 0.8, rate: 0.7 }); return true;
      case 'golemSlam': this.gCrack(ev.x, ev.y, 6, ev.r, 1.4); this.gDust(ev.x, ev.y, 14, 90); sfx('hitHeavy', { vol: 0.9, rate: 0.5 }); return true;
      case 'pebbleHit': this.gChips(ev.x, ev.y, 3, 50); return true;
      case 'golemUncurl': this.gDust(ev.x, ev.y, 8, 40); return true;
      case 'golemRepairStart': { const e = w.enemies.find((o) => o.id === ev.id); if (e) this.rimFlash = { color: '#9be15d', t: 0.4, max: 0.4 }; sfx('echo', { vol: 0.6, rate: 0.6 }); return true; }
      case 'golemRepair': { // 땅의 돌 조각이 몸으로 날아와 붙고 · 이끼 빛이 돋는다
        for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 30; L.push({ k: 'pull', id: ev.id, x0: ev.x + Math.cos(a) * d, y0: ev.y + Math.sin(a) * d * 0.6, t: 0.45, max: 0.45, v: (Math.random() * 4) | 0, ty: -8 - Math.random() * 22, tx: (Math.random() - 0.5) * 20 }); }
        for (let i = 0; i < 2; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 30, y: ev.y - 10 - Math.random() * 24, vx: (Math.random() - 0.5) * 8, vy: 8, t: 0.7, max: 0.7, color: Math.random() < 0.5 ? '#63734a' : '#82994d', g: 120, chunk: true, floor: ev.y + 3 }); // 이끼 부스러기
        if (Math.random() < 0.4) sfx('step', { vol: 0.3, rate: 1.3 }); return true; }
      case 'golemRepairBreak': this.gChips(ev.x, ev.y - 10, 20, 140); this.gDust(ev.x, ev.y, 14, 90); sfx('crack', { vol: 1, rate: 0.9 }); sfx('hitHeavy', { vol: 0.8, rate: 0.8 }); return true;
    }
    return false;
  },
  drawPebble(pr) { // 돌뿌리기의 작은 돌: 굴러가며 날아간다 (그림자는 바닥에)
    const g = this.g; pr.spin = (pr.spin || 0) + 0.25; shadowAt(g, pr.x, pr.y + 2, 3, 0.3);
    drawRock(g, pr.x, pr.y - 6, 3, (pr.spin * 3) | 0, pr.spin | 0, false);
  },
  drawGolemFx(w, dt, ground) {
    const L = this.gfx; if (!L?.length) return;
    const g = this.g;
    for (const f of L) {
      const gr = f.k === 'crack' || f.k === 'crater' || f.k === 'ripple';
      if (gr !== !!ground) continue;
      f.t -= dt; const k = Math.max(0, f.t / f.max), u = 1 - k;
      if (f.k === 'crack') { // 금: 빠르게 뻗고 · 끝에 흐려진다 (짙은 금 + 아래쪽 밝은 테)
        const show = Math.min(1, (f.max - f.t) / f.grow), a = Math.min(1, k * 2.5);
        for (const pts of f.lines) { const n = Math.floor(pts.length * show);
          for (let i = 0; i < n; i++) { const [x, y] = pts[i]; g.fillStyle = `rgba(36,26,20,${a * 0.9})`; g.fillRect(x, y, 1, 1); if (i % 2 === 0) { g.fillStyle = `rgba(190,170,140,${a * 0.5})`; g.fillRect(x, y + 1, 1, 1); } } }
      } else if (f.k === 'ripple') { // 물결: 물 위에 납작하게 퍼지는 점선 테 두 겹
        for (const [kk, col] of [[1, '#e8f8ff'], [0.65, '#9ccfe8']]) { const rr = f.r * (0.25 + u * 0.9) * kk, n = Math.max(8, R(rr * 2.2));
          g.fillStyle = col; g.globalAlpha = k * 0.85; for (let i = 0; i < n; i++) { if (i % 3 === 2) continue; const a = (i / n) * Math.PI * 2; g.fillRect(R(f.x + Math.cos(a) * rr), R(f.y + Math.sin(a) * rr * 0.42), 1, 1); } }
        g.globalAlpha = 1;
      } else if (f.k === 'crater') { // 패인 자국: 가운데가 짙고 둘레에 돌 부스러기
        g.globalAlpha = Math.min(1, k * 2); shadowAt(g, f.x, f.y + 1, f.r, 0.45); shadowAt(g, f.x, f.y + 1, f.r * 0.55, 0.4); g.globalAlpha = 1;
      } else if (f.k === 'throw') { // 큰 돌: 포물선 · 90도씩 구른다 · 땅에는 그림자
        const s = u, x = f.x1 + (f.x2 - f.x1) * s, gy = f.y1 + 30 + (f.y2 - (f.y1 + 30)) * s, h = Math.sin(s * Math.PI) * 52 + (1 - s) * 30;
        shadowAt(g, x, gy + 2, 7 * (0.5 + s * 0.5), 0.35); drawRock(g, x, gy - h, 7, f.v, (u * 10) | 0, true);
      } else if (f.k === 'meteor') { // 하늘에서 떨어지는 돌: 그림자가 커지고 · 돌이 빨라지며 내려온다 · 뒤로 흙 꼬리
        const h = 240 * (1 - u * u), r = f.r > 24 ? 8 : 6;
        shadowAt(g, f.x, f.y + 2, 4 + 8 * u, 0.15 + 0.35 * u);
        if (h < 230) { drawRock(g, f.x, f.y - h - 4, r, f.v, (u * 6) | 0, false);
          for (let i = 1; i <= 3; i++) { g.fillStyle = `rgba(200,180,150,${0.35 - i * 0.09})`; g.fillRect(R(f.x) - 2, R(f.y - h - 4 - r - i * 5), 4, 4); } }
      } else if (f.k === 'bits') { // 깨진 돌 조각 몇 개가 튀어 오르다 떨어진다
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + f.seed, d = u * 22, hh = Math.sin(u * Math.PI) * 14; drawRock(g, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.6 - hh - 4, 2, i, i, i === 0); }
      } else if (f.k === 'raise') { // 돌떨구기 외침: 몸 둘레에서 흙이 솟는다
        const e = w.enemies.find((o) => o.id === f.id); if (e && Math.random() < 0.7) this.parts.push({ x: e.x + (Math.random() - 0.5) * 40, y: e.y + 2, vx: 0, vy: -40 - Math.random() * 40, t: 0.5, max: 0.5, color: '#8a7a66', g: 60, chunk: true, floor: e.y + 3 });
      } else if (f.k === 'pull') { // 수복: 돌 조각이 땅에서 몸으로 빨려 들어간다
        const e = w.enemies.find((o) => o.id === f.id); if (!e) { f.t = 0; continue; }
        const s = u * u, x = f.x0 + (e.x + f.tx - f.x0) * s, y = f.y0 + (e.y + f.ty - f.y0) * s - Math.sin(u * Math.PI) * 10;
        drawRock(g, x, y, 2, f.v, f.v, f.v === 0);
        if (f.t <= 0) this.parts.push({ x: e.x + f.tx, y: e.y + f.ty, vx: (Math.random() - 0.5) * 20, vy: -20, t: 0.3, max: 0.3, color: '#a89880', g: 200 }); // 붙는 순간 부스러기
      }
    }
    this.gfx = L.filter((f) => f.t > 0);
  },
};

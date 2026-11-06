// 탑 51~100층 그리기: 구역 장치(톱니 띠 · 별자리 · 시계 문자판 · 빛기둥 · 회오리) · 돌풍 · 시간 · 보스 등장 연출
// 모두 칸에 맞춘 도트로 그린다 (몸 둘레 고리 · 빛나는 막대 없이)
import { TILE, T_LIQUID } from '../sim/mapgen.js';
import { renderMap } from './tiles.js';
import { sprite, frames } from './assets.js';
import { RACE_ART } from '../data/art.js';
import { sfx } from '../audio.js';

const hexA = (hex, a) => { const n = parseInt((hex || '#ffffff').slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; };
const px = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// 점묘 원 (바닥에 깔리는 장판)
function ditherDisc(g, cx, cy, rx, ry, col, d) {
  g.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    const k = 1 - ((y - cy) / ry) ** 2; if (k <= 0) continue;
    const hw = rx * Math.sqrt(k);
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) if (BAYER[(y & 3) * 4 + (x & 3)] / 16 < d) g.fillRect(x, y, 1, 1);
  }
}

// ───── 사건 ─────
export function towerEvent(R, w, ev) {
  switch (ev.t) {
    case 'note': R.note(ev.text, ev.color); return true;
    case 'mapChanged': R.mapCanvas = renderMap(w); return true;
    case 'tileWarn': (R.tileWarns ||= []).push({ tiles: ev.tiles, t: ev.dur, max: ev.dur, color: ev.color }); sfx('windup', { vol: 0.5, rate: 0.7 }); return true;
    case 'gustTele': R.gustTele = { ang: ev.ang, t: ev.dur, max: ev.dur }; sfx('dash', { vol: 0.4, rate: 0.6 }); return true;
    case 'gust': { // 바람줄기가 화면을 가로지른다 · 꽃잎이 흩날린다
      R.gustTele = null; R.shake = Math.max(R.shake, 2);
      const c = Math.cos(ev.ang), s = Math.sin(ev.ang);
      for (let i = 0; i < 46; i++) {
        const x = R.cx + Math.random() * R.VW - c * 120, y = R.cy + Math.random() * R.VH - s * 120, sp = 260 + Math.random() * 160;
        R.parts.push({ x, y, vx: c * sp, vy: s * sp, t: 0.45 + Math.random() * 0.3, max: 0.75, color: i % 5 ? 'rgba(235,248,255,0.8)' : '#ffc0e0', g: 0, line: i % 5 !== 0 });
      }
      sfx('dash', { vol: 0.8, rate: 0.5 }); return true;
    }
    case 'fall': { // 하늘로 떨어짐: 구름 조각이 흩어진다
      for (let i = 0; i < (ev.enemy ? 10 : 18); i++) { const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50; R.parts.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 + 20, t: 0.8, max: 0.8, color: '#e8f4ff', g: 30, puff: true, size: 3 }); }
      sfx('dash', { vol: 0.7, rate: 0.4 }); return true;
    }
    case 'bell': R.bellFx = { t: ev.dur, max: ev.dur }; sfx('reaction', { vol: 0.9, rate: 0.6 }); sfx('reaction', { vol: 0.5, rate: 1.2 }); return true;
    case 'timeStop': R.timeStopFx = { t: ev.dur, max: ev.dur }; sfx('reaction', { vol: 0.8, rate: 0.45 }); return true;
    case 'timeBlade': (R.blades ||= []).push({ x: ev.x, y: ev.y, t: ev.dur, max: ev.dur }); sfx('swing', { vol: 0.3, rate: 1.6 }); return true;
    case 'ghostTele': R.ghost = { x: ev.x, y: ev.y, t: ev.dur, max: ev.dur }; return true;
    case 'whaleShadow': R.whale = { ...ev, t: ev.dur, max: ev.dur }; R.shake = Math.max(R.shake, 6); sfx('hitHeavy', { vol: 0.8, rate: 0.5 }); return true;
    case 'shelfFx': { // 쓰러진 책장: 줄을 따라 종잇조각 · 먼지
      for (let i = 0; i < 26; i++) { const k = Math.random(), x = ev.x1 + (ev.x2 - ev.x1) * k, y = ev.y1 + (ev.y2 - ev.y1) * k; if (x < R.cx - 20 || x > R.cx + R.VW + 20 || y < R.cy - 20 || y > R.cy + R.VH + 20) continue; R.parts.push({ x, y: y - 6, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, t: 0.9, max: 0.9, color: i % 3 ? '#e8dcc0' : '#8a6a4a', g: 90, size: 2 }); }
      sfx('hitHeavy', { vol: 0.7, rate: 0.8 }); return true;
    }
    case 'pillarLit': for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 60; R.parts.push({ x: ev.x, y: ev.y - 22, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, t: 0.7, max: 0.7, color: i % 2 ? '#fff0b0' : '#ffd84a', g: 20, size: 2 }); } sfx('levelup', { vol: 0.5, rate: 1.3 }); return true;
    case 'bossIntro': {
      R.intro = { ...ev, t: ev.dur, max: ev.dur };
      R.camFocus = { x: ev.x, y: ev.y - 10, t: ev.dur };
      R.banner = null;
      sfx('reaction', { vol: 0.8, rate: 0.5 });
      return true;
    }
  }
  return false;
}

// ───── 바닥 (지도 바로 위 · 사람과 몬스터 아래) ─────
export function drawTowerFloor(R, w, g, cx, cy) {
  const C = w.climb; if (!C) return;
  const t = w.t, inView = (x, y, m = 40) => x > cx - m && x < cx + R.VW + m && y > cy - m && y < cy + R.VH + m;
  if (w.voidZone) drawSky(R, w, g, cx, cy);
  // 시계 문자판: 바닥에 새긴 큰 원 · 눈금 열둘 · 도는 두 바늘 (시간이 멈추면 바늘도 멈춘다)
  const cf = w.map.climb?.clockFace;
  if (cf) {
    const x0 = cf.x * TILE, y0 = cf.y * TILE, r = cf.r * TILE, stop = R.timeStopFx?.t > 0;
    R.clockA = (R.clockA || 0) + (stop ? 0 : 1 / 60);
    g.strokeStyle = 'rgba(255,224,160,0.35)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x0, y0, r, r, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(x0, y0, r * 0.82, r * 0.82, 0, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + i * Math.PI / 6, xx = x0 + Math.cos(a) * r * 0.9, yy = y0 + Math.sin(a) * r * 0.9; px(g, '#4a3a20', xx - 2, yy - 2, 5, 5); px(g, i % 3 ? '#c8a060' : '#ffe0a0', xx - 1, yy - 1, 3, 3); }
    for (const [len, sp, col, wd] of [[r * 0.72, 0.05, '#e8c880', 3], [r * 0.48, 0.6, '#ffe0a0', 2]]) {
      const a = -Math.PI / 2 + R.clockA * sp;
      for (let k = 6; k < len; k += 2) px(g, k > len - 6 ? '#fff4d0' : col, x0 + Math.cos(a) * k - wd / 2, y0 + Math.sin(a) * k - wd / 2, wd, wd);
    }
    px(g, '#2a1e10', x0 - 4, y0 - 4, 9, 9); px(g, '#ffe0a0', x0 - 3, y0 - 3, 7, 7); px(g, '#8a6a3a', x0 - 1, y0 - 1, 3, 3);
  }
  // 톱니 띠: 쇠판 위로 화살 무늬가 흐른다 · 양 끝에 도는 톱니바퀴
  for (const b of C.belts || []) {
    const X0 = b.x0 * TILE, Y0 = b.y0 * TILE, W = (b.x1 - b.x0 + 1) * TILE, H = (b.y1 - b.y0 + 1) * TILE;
    if (!inView(X0 + W / 2, Y0 + H / 2, W)) continue;
    px(g, '#1a140e', X0, Y0, W, H); px(g, '#4a3e30', X0 + 1, Y0 + 1, W - 2, H - 2);
    px(g, '#6a5a44', X0 + 1, Y0 + 1, W - 2, 1); px(g, '#2a2018', X0 + 1, Y0 + H - 2, W - 2, 1);
    const fast = C.gz?.beltMul > 1, off = ((t * 16 * (C.gz?.beltMul || 1)) % 8) * Math.sign(b.dx || 1);
    for (let x = X0 - 8; x < X0 + W + 8; x += 8) {
      const xx = Math.round(x + off); if (xx < X0 + 2 || xx > X0 + W - 6) continue;
      for (let k = 0; k < H - 6; k++) { const d = Math.abs(k - (H - 6) / 2); px(g, fast ? '#ff9a4a' : '#d8a860', xx + (b.dx > 0 ? -d * 0.5 : d * 0.5) + 2, Y0 + 3 + k, 1, 1); }
    }
    for (const gx of [X0 - 2, X0 + W + 2]) { // 톱니바퀴
      const a0 = t * 2 * Math.sign(b.dx || 1), cyg = Y0 + H / 2;
      px(g, '#1a140e', gx - 5, cyg - 5, 11, 11); px(g, '#8a6a3a', gx - 4, cyg - 4, 9, 9); px(g, '#c8a060', gx - 3, cyg - 3, 7, 7); px(g, '#2a2018', gx - 1, cyg - 1, 3, 3);
      for (let i = 0; i < 6; i++) { const a = a0 + i * Math.PI / 3; px(g, '#c8a060', gx + Math.cos(a) * 6 - 1, cyg + Math.sin(a) * 6 - 1, 2, 2); }
    }
  }
  // 별자리 장판: 남빛 점묘 · 별 다섯을 잇는 선 · 누군가 서 있으면 밝아진다
  for (const s of C.stars || []) {
    const x0 = s.x * TILE + 8, y0 = s.y * TILE + 8, r = s.r * TILE;
    if (!inView(x0, y0, r)) continue;
    const busy = Math.hypot(w.player.x - x0, w.player.y - y0) < r || w.enemies.some((e) => !e.dead && Math.hypot(e.x - x0, e.y - y0) < r);
    ditherDisc(g, x0, y0, r, r * 0.7, busy ? '#8aa8ff' : '#4a5aa8', busy ? 0.42 : 0.28);
    const pts = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.3 + s.x; pts.push([x0 + Math.cos(a) * r * 0.62, y0 + Math.sin(a) * r * 0.42]); }
    g.strokeStyle = busy ? 'rgba(220,232,255,0.8)' : 'rgba(170,190,255,0.45)'; g.lineWidth = 1; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(Math.round(x) + 0.5, Math.round(y) + 0.5) : g.moveTo(Math.round(x) + 0.5, Math.round(y) + 0.5))); g.stroke();
    pts.forEach(([x, y], i) => { const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7); px(g, '#ffffff', x - 1, y, 3, 1); px(g, '#ffffff', x, y - 1, 1, 3); if (tw > 0.7) px(g, '#dce8ff', x - 2, y, 5, 1); });
  }
  // 바뀔 칸 예고: 깜빡이는 점묘
  if (R.tileWarns?.length) {
    for (const tw of R.tileWarns) {
      tw.t -= 1 / 60; const k = 1 - tw.t / tw.max, blink = Math.floor(t * (6 + k * 10)) % 2;
      g.fillStyle = hexA(tw.color, blink ? 0.45 : 0.22);
      for (const i of tw.tiles) { const x = (i % w.tw) * TILE, y = Math.floor(i / w.tw) * TILE; if (!inView(x, y)) continue; for (let yy = 0; yy < TILE; yy += 2) g.fillRect(x + ((yy >> 1) % 2), y + yy, TILE, 1); }
    }
    R.tileWarns = R.tileWarns.filter((x) => x.t > 0);
  }
  // 회오리 (발밑 그림자)
  for (const h of C.gz?.hz || []) if (h.k === 'tornado' && inView(h.x, h.y)) ditherDisc(g, h.x, h.y + 2, 16, 6, '#1a2430', 0.5);
}

// 하늘 정원: 발밑이 하늘인 칸 — 물이 아니라 아득한 아래 하늘: 위(화면 위)는 짙은 파랑 → 아래로 갈수록 밝아지고,
// 멀리 구름 바다가 천천히(시차) 흐르고, 가까운 구름 자락이 더 빨리 스쳐 간다 · 섬 가장자리에는 흙 · 바위 밑동과 늘어진 뿌리
const SKY = ['#3f78c8', '#4c88d4', '#5b98de', '#6ea8e6', '#86baee', '#a2ccf4'];
function cloud(g, x, y, s, lit, mid, dark) { // 뭉게구름 하나 (도트 덩어리 셋)
  px(g, dark, x - s * 2, y + 1, s * 4, Math.max(2, s >> 1) + 1);
  px(g, mid, x - s * 2, y - s + 1, s * 4, s); px(g, mid, x - s, y - s * 2 + 2, s * 2, s);
  px(g, lit, x - s * 2 + 1, y - s + 1, s * 2, 1); px(g, lit, x - s + 1, y - s * 2 + 2, s + 1, 1);
}
function drawSky(R, w, g, cx, cy) {
  const t = w.t, x0 = Math.max(0, Math.floor(cx / TILE) - 1), y0 = Math.max(0, Math.floor(cy / TILE) - 1);
  const x1 = Math.min(w.tw - 1, x0 + Math.ceil(R.VW / TILE) + 2), y1 = Math.min(w.th - 1, y0 + Math.ceil(R.VH / TILE) + 2);
  const voids = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (w.tiles[y * w.tw + x] === T_LIQUID) voids.push(x, y);
  if (!voids.length) return;
  g.save(); g.beginPath();
  for (let i = 0; i < voids.length; i += 2) g.rect(voids[i] * TILE, voids[i + 1] * TILE, TILE, TILE);
  g.clip();
  // 하늘 띠 (화면에 붙어 있다 = 아주 멀다) · 띠 사이는 점묘로 섞는다
  const VX = Math.floor(cx), VY = Math.floor(cy), bh = Math.ceil(R.VH / SKY.length) + 1;
  for (let b = 0; b < SKY.length; b++) {
    px(g, SKY[b], VX - 2, VY + b * bh, R.VW + 4, bh + 1);
    if (b) { g.fillStyle = SKY[b - 1]; for (let xx = 0; xx < R.VW + 4; xx += 2) { g.fillRect(VX - 2 + xx, VY + b * bh, 1, 1); g.fillRect(VX - 1 + xx, VY + b * bh + 2, 1, 1); } }
  }
  // 먼 구름 바다 (시차 0.35)
  const far = (lx, ly, sc, sp, cols, n, seed) => {
    const ox = cx * sc - t * sp, oy = cy * sc, span = R.VW + 120, vspan = R.VH + 80;
    for (let i = 0; i < n; i++) {
      const hx = ((i * 97 + seed) * 7919) % span, hy = ((i * 61 + seed) * 4513) % vspan;
      const X = VX + ((((hx - ox) % span) + span) % span) - 60, Y = VY + ((((hy - oy) % vspan) + vspan) % vspan) - 40;
      cloud(g, Math.round(X), Math.round(Y), lx + (i % 3), ...cols);
    }
  };
  far(3, 0, 0.35, 3, ['#f4faff', '#d6e8f8', '#a8c4e2'], 14, 11);
  far(2, 0, 0.75, 9, ['#ffffff', '#e8f2fc', '#bcd4ec'], 8, 53); // 가까운 구름 자락
  g.restore();
  // 섬 밑동: 위 칸이 땅이면 흙 · 바위가 아래로 내려오고 끝이 들쭉날쭉 · 뿌리가 늘어진다 · 밑동 아래 옅은 안개
  for (let i = 0; i < voids.length; i += 2) {
    const x = voids[i], y = voids[i + 1];
    if (y === 0 || w.tiles[(y - 1) * w.tw + x] === T_LIQUID) continue;
    const X = x * TILE, Y = y * TILE, h = (x * 13 + y * 7) % 5;
    px(g, '#6a5236', X, Y, TILE, 3); px(g, '#4e3c2a', X, Y + 3, TILE, 4); px(g, '#3a2e22', X, Y + 7, TILE, 2);
    for (let k = 0; k < TILE; k += 4) { const d = (k * 3 + h * 5) % 5; px(g, '#3a2e22', X + k, Y + 9, 4 - (d & 1), d); px(g, '#2a2018', X + k + 1, Y + 9 + d, 2, 1); }
    px(g, '#7c6446', X, Y, TILE, 1); px(g, '#8a8a80', X + h * 2, Y + 4, 3, 2); px(g, '#6a6a62', X + h * 2, Y + 5, 3, 1);
    if (h < 2) { px(g, '#5a4228', X + 4 + h * 5, Y + 9, 1, 6); px(g, '#5a4228', X + 5 + h * 5, Y + 14, 1, 3); }
  }
}

// ───── 위 (사람과 몬스터 위) ─────
export function drawTowerOver(R, w, g, cx, cy) {
  const C = w.climb; if (!C) return;
  const t = w.t, dt = 1 / 60;
  // 회오리: 위로 넓어지는 깔때기 · 빙글 도는 바람줄 · 끌려 들어가는 먼지
  for (const h of C.gz?.hz || []) if (h.k === 'tornado') {
    for (let k = 0; k < 14; k++) {
      const yy = h.y - k * 3, rw = 3 + k * 1.3, a = t * 9 - k * 0.6;
      for (let j = 0; j < 3; j++) { const aa = a + j * 2.1; px(g, j === 0 ? 'rgba(235,248,255,0.85)' : 'rgba(180,210,235,0.6)', h.x + Math.cos(aa) * rw, yy + Math.sin(aa) * rw * 0.25, 2, 1); }
    }
    if (Math.random() < 0.5) { const a = Math.random() * Math.PI * 2; R.parts.push({ x: h.x + Math.cos(a) * 40, y: h.y + Math.sin(a) * 18, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 30 - 10, t: 0.5, max: 0.5, color: '#d8e8f0', g: 0, size: 1 }); }
  }
  // 시간 칼날: 멈춘 시간 동안 하늘에 걸린 칼 (끝날 때 떨어진다)
  if (R.blades?.length) {
    for (const b of R.blades) {
      b.t -= dt; const k = 1 - Math.max(0, b.t) / b.max, lift = 26 + 6 * Math.sin(t * 4 + b.x);
      const x = Math.round(b.x), y = Math.round(b.y - lift * (1 - k * 0.3));
      px(g, '#1a1410', x - 1, y - 12, 3, 14); px(g, '#e8e8f0', x, y - 11, 1, 12); px(g, '#ffffff', x, y - 11, 1, 4);
      px(g, '#1a1410', x - 3, y - 13, 7, 2); px(g, '#c8a060', x - 2, y - 13, 5, 1); px(g, '#8a6a3a', x, y - 16, 1, 3); px(g, '#ffe0a0', x, y - 17, 1, 1);
    }
    R.blades = R.blades.filter((b) => b.t > 0);
  }
  // 되감기: 2초 전의 나 (잔상)
  if (R.ghost) {
    const G = R.ghost; G.t -= dt; if (G.t <= 0) R.ghost = null;
    else { const art = RACE_ART[w.b?.race] || RACE_ART.knight, fr = sprite(frames(art.base, 'idle')[0], 'grayscale(1) brightness(1.9) sepia(0.6)', false, (w.player.dir || 1) < 0); if (fr) { g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 14); g.drawImage(fr, Math.round(G.x - fr.width / 2), Math.round(G.y + 4 - fr.height)); g.globalAlpha = 1; } }
  }
  // 하늘 고래의 그림자: 넓고 짙은 그림자가 줄을 따라 지나간다
  if (R.whale) {
    const W = R.whale; W.t -= dt; if (W.t <= 0) R.whale = null;
    else { const k = 1 - W.t / W.max, x = W.x1 + (W.x2 - W.x1) * k, y = W.y1 + (W.y2 - W.y1) * k, horiz = Math.abs(W.x2 - W.x1) > Math.abs(W.y2 - W.y1); ditherDisc(g, x, y, horiz ? 70 : 34, horiz ? 26 : 60, '#0a1220', 0.55); ditherDisc(g, x, y, horiz ? 46 : 22, horiz ? 16 : 40, '#0a1220', 0.75); }
  }
  // 돌풍 예고: 내 앞에 바람 화살 셋이 바람 쪽으로 깜빡인다
  if (R.gustTele) {
    const G = R.gustTele; G.t -= dt; if (G.t <= 0) R.gustTele = null;
    else {
      const p = w.player, c = Math.cos(G.ang), s = Math.sin(G.ang), on = Math.floor(t * 10) % 2;
      for (let i = 0; i < 3; i++) {
        const d = 22 + i * 12 + ((1 - G.t / G.max) * 10), x = p.x + c * d, y = p.y - 8 + s * d;
        for (let k = -4; k <= 4; k++) { const bx = x - c * Math.abs(k) * 1.2 - s * k, by = y - s * Math.abs(k) * 1.2 + c * k; px(g, on ? '#ffffff' : '#bfe8ff', bx, by, 2, 2); }
      }
    }
  }
}

// ───── 빛기둥 (물건) ─────
export function drawLightPillar(R, w, o) {
  const g = R.g, x = Math.round(o.x), y = Math.round(o.y), lit = o.litT > 0, t = w.t;
  if (lit) ditherDisc(g, x, y, 92, 58, '#ffe8a0', 0.12 + 0.03 * Math.sin(t * 3)); // 빛이 닿는 바닥 (반경 6칸)
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x - 7, y - 1, 15, 3);
  px(g, '#1a1610', x - 6, y - 26, 13, 26); // 돌 받침과 기둥
  px(g, '#6a6050', x - 5, y - 4, 11, 3); px(g, '#8a8068', x - 5, y - 4, 11, 1);
  px(g, '#5a5244', x - 4, y - 24, 9, 20); px(g, '#7a7260', x - 4, y - 24, 3, 20); px(g, '#3a3428', x + 3, y - 24, 2, 20);
  for (let k = 0; k < 3; k++) px(g, lit ? '#ffe8a0' : '#8a7a50', x - 1, y - 20 + k * 6, 3, 2); // 새긴 문양
  const glow = lit ? (0.75 + 0.25 * Math.sin(t * 5)) : 0.3;
  px(g, '#1a1610', x - 4, y - 33, 9, 8); px(g, lit ? '#fff4c8' : '#8a8060', x - 3, y - 32, 7, 6); px(g, lit ? '#ffffff' : '#a89a70', x - 1, y - 31, 3, 3); // 꼭대기 수정
  if (lit) { g.fillStyle = hexA('#fff0b0', glow * 0.5); g.fillRect(x - 5, y - 34, 11, 10); if (Math.random() < 0.3) R.parts.push({ x: x + (Math.random() - 0.5) * 10, y: y - 30, vx: 0, vy: -14, t: 0.8, max: 0.8, color: '#fff0b0', g: -4, size: 1 }); }
  if (lit && o.litT < 6 && Math.floor(t * 6) % 2) px(g, '#ff9a6a', x - 1, y - 36, 3, 1); // 곧 꺼진다
  // 남은 시간 막대 (작게)
  if (lit) { px(g, '#1a1610', x - 8, y + 4, 17, 3); px(g, '#ffd84a', x - 7, y + 5, Math.round(15 * o.litT / 30), 1); }
  o._top = y - 36;
}

// ───── 화면 (글 · 띠 · 색조) ─────
export function drawTowerScreen(R, w, g, W, H, u, dt) {
  // 시간의 종: 화면 가장자리가 금빛으로 울린다
  if (R.bellFx) {
    const B = R.bellFx; B.t -= dt; if (B.t <= 0) R.bellFx = null;
    else { const a = 0.22 * Math.min(1, B.t) * (0.7 + 0.3 * Math.sin(w.t * 10)), gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7); gr.addColorStop(0, 'rgba(255,224,160,0)'); gr.addColorStop(1, `rgba(255,214,120,${a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  }
  // 멈춘 시간: 빛바랜 화면 · 초침 소리
  if (R.timeStopFx) {
    const T = R.timeStopFx; T.t -= dt; if (T.t <= 0) R.timeStopFx = null;
    else { const a = Math.min(1, (T.max - T.t) * 4, T.t * 4); g.fillStyle = `rgba(60,48,30,${0.38 * a})`; g.fillRect(0, 0, W, H); g.fillStyle = `rgba(255,236,190,${0.06 * a})`; for (let y = 0; y < H; y += 3 * u) g.fillRect(0, y, W, u); if (Math.floor(T.t * 2.5) !== Math.floor((T.t + dt) * 2.5)) sfx('click', { vol: 0.5, rate: 0.7 }); }
  }
  // 보스 등장: 위아래 검은 띠 · 이름 · 한마디
  if (R.intro) {
    const I = R.intro; I.t -= dt; if (I.t <= 0) { R.intro = null; return; }
    const k = Math.min(1, (I.max - I.t) / 0.3, I.t / 0.3), bar = Math.round(H * 0.11 * k);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    const ap = Math.min(1, (I.max - I.t) / 0.5) * Math.min(1, I.t / 0.35), y = H * 0.68;
    g.globalAlpha = ap;
    R.text(I.title || '', W / 2, y - 22 * u, u, '#d8cbb8', 'center', true);
    R.text(I.name, W / 2, y, 3 * u, I.color || '#ffb07a', 'center', true, true);
    g.fillStyle = hexA(I.color || '#ffb07a', 0.8); g.fillRect(Math.round(W / 2 - 90 * u * k), Math.round(y + 30 * u), Math.round(180 * u * k), u);
    if (I.sub) R.text(I.sub, W / 2, y + 36 * u, u, '#e8d8a8', 'center', true);
    if (I.line && I.max - I.t > 0.6) { g.globalAlpha = ap * Math.min(1, (I.max - I.t - 0.6) / 0.4); R.text(I.line, W / 2, y + 52 * u, u, '#f0e8f8', 'center', true); }
    g.globalAlpha = 1;
  }
}

// 보스 등장 동안 몸을 어떻게 보여 줄까: 떨어져 내린다(drop) · 땅에서 솟는다(rise) · 빛 조각이 모인다(form) · 걸어 나온다(walk)
export function introPose(R, w, e) {
  if (!(e.introT > 0) || !e.introMax) return null;
  const k = 1 - e.introT / e.introMax;
  if (e.introStyle === 'drop') { const q = Math.min(1, k / 0.45); if (q < 1 && Math.random() < 0.3) R.parts.push({ x: e.x + (Math.random() - 0.5) * 30, y: e.y - 200 * (1 - q) ** 2, vx: 0, vy: 40, t: 0.4, max: 0.4, color: '#e8f0ff', g: 0, line: true }); return { lift: 220 * (1 - q) ** 2, alpha: 1, shadow: 0.3 + 0.7 * q }; }
  if (e.introStyle === 'rise') { const q = Math.min(1, k / 0.5); if (q < 1 && Math.random() < 0.6) R.parts.push({ x: e.x + (Math.random() - 0.5) * e.r * 3, y: e.y + 2, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 40, t: 0.6, max: 0.6, color: '#6a5a44', g: 160, size: 2 }); if (q < 1 && Math.random() < 0.2) R.shake = Math.max(R.shake, 2); return { sink: 1 - q, alpha: 1, shadow: q }; }
  if (e.introStyle === 'form') { const q = Math.min(1, k / 0.55); if (q < 1) for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 40; R.parts.push({ x: e.x + Math.cos(a) * r, y: e.y - 16 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 2, vy: -Math.sin(a) * r * 1.2, t: 0.45, max: 0.45, color: e.def.proj?.color || '#e8dcff', g: 0, size: 1 }); } return { lift: 0, alpha: q * q, shadow: q }; }
  return { lift: 0, alpha: 1, shadow: 1, walk: k < 0.6 };
}

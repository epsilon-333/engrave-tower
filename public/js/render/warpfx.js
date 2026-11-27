// 시공간 연출: 시간 · 공간에 손대는 스킬은 땅을 부수지 않고 「세계 자체」를 뒤튼다
// 1배 세계 판(R.lo)을 화면으로 옮기기 바로 전에, 그 판을 한 장 베껴 두고 띠 · 고리 조각을 어긋나게 / 돌려 / 당겨 다시 그린다 (drawImage 몇 번 · 렉 없음)
// 종류: swirl 소용돌이 비틀림 · pinch 렌즈 당김(음수면 부풀림) · glitch 가로 줄 어긋남 · gray 색 빠짐(푸른 회색) · freeze 멈춘 잔상 + 시계 문양
//       crack 금 간 유리 · tear 찢어진 틈(지퍼처럼 벌어졌다 닫힘) · streak 별빛 실선이 휘어 빨려 듦 · fold 접혔다 펴지는 반전 · clock 느린 시계 바늘 · 톱니
import { sfx } from '../audio.js';
const TAU = Math.PI * 2;
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const env = (k, a = 0.15, b = 0.25) => Math.max(0, Math.min(1, k / a, (1 - k) / b));
let scratch = null, sg = null;

export function addWarp(R, o) { (R.warps ||= []).push({ t: 0, seed: (Math.random() * 1e9) | 0, delay: 0, ...o }); if (R.warps.length > 28) R.warps.shift(); }

// 들쭉날쭉한 테두리 (2칸 계단 · 꼭짓점마다 길이가 다르다): 고리 경계가 매끈한 타원으로 보이지 않게
function blobPath(g, x, y, r, sq, seed, n = 18) {
  const rr = rnd(seed); g.beginPath();
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, d = r * (0.8 + rr() * 0.32); const px = Math.round(x + Math.cos(a) * d), py = Math.round(y + Math.sin(a) * d * sq); i ? g.lineTo(px, py) : g.moveTo(px, py); const a2 = ((i + 0.5) / n) * TAU, d2 = r * (0.86 + rr() * 0.2); g.lineTo(Math.round(x + Math.cos(a2) * d2), Math.round(y + Math.sin(a2) * d2 * sq)); }
  g.closePath();
}
const SQ = 0.62;

const KIND = {
  // 소용돌이: 안쪽 고리일수록 더 많이 돈다 (고리 경계는 들쭉날쭉해 픽셀이 비틀려 찢긴 결이 보인다)
  swirl(g, w, k, x, y) {
    const e = env(k, w.in ?? 0.25, w.out ?? 0.35), N = 7, A = w.ang * e * (w.spin ? Math.sin(w.t * w.spin) : 1);
    for (let i = 0; i < N; i++) {
      const ro = w.r * (1 - i / N), th = A * Math.pow((i + 1) / N, 1.6); if (Math.abs(th) < 0.01) continue;
      g.save(); blobPath(g, x, y, ro, SQ, w.seed + i * 7, 14); g.clip();
      g.translate(x, y); g.scale(1, SQ); g.rotate(th); g.scale(1, 1 / SQ); g.translate(-x, -y); g.drawImage(scratch, 0, 0); g.restore();
    }
  },
  // 렌즈: 가운데로 픽셀이 빨려 든다 (amt < 0 이면 바깥으로 부풀어 「펴지는」 것)
  pinch(g, w, k, x, y) {
    const e = env(k, w.in ?? 0.3, w.out ?? 0.3), N = 7;
    for (let i = 0; i < N; i++) {
      const ro = w.r * (1 - i / N), s = 1 - w.amt * e * Math.pow((i + 1) / N, 1.3); if (Math.abs(s - 1) < 0.01) continue;
      g.save(); blobPath(g, x, y, ro, SQ, w.seed + i * 5, 14); g.clip();
      g.translate(x, y); g.scale(s, s); g.translate(-x, -y); g.drawImage(scratch, 0, 0); g.restore();
    }
  },
  // 가로 줄 어긋남: 1~4칸 띠가 좌우로 튄다 (0.05초마다 새로) · 몇 줄은 청보라로 물든다
  glitch(g, w, k, x, y) {
    const e = env(k, 0.1, 0.4), rr = rnd(w.seed + Math.floor(w.t * 20)), x0 = Math.round(x - w.w), W = Math.round(w.w * 2), y1 = y + w.h;
    for (let yy = Math.round(y - w.h); yy < y1;) {
      const h = 1 + ((rr() * 4) | 0); if (rr() < 0.55) { const dx = Math.round((rr() - 0.5) * 2 * w.amp * e); if (dx) g.drawImage(scratch, x0, yy, W, h, x0 + dx, yy, W, h); if (rr() < 0.12 && dx) { const sw = Math.round(W * (0.2 + rr() * 0.4)), sx0 = x0 + Math.round(rr() * (W - sw)); g.globalCompositeOperation = 'lighter'; g.fillStyle = rr() < 0.5 ? `rgba(90,60,200,${0.3 * e})` : `rgba(40,140,170,${0.25 * e})`; g.fillRect(sx0 + dx, yy, sw, 1); g.globalCompositeOperation = 'source-over'; } }
      yy += h;
    }
  },
  // 색 빠짐: 범위 안이 흑백 · 푸른 회색으로 바랜다 (번지듯 퍼졌다가 · 끝에 확 돌아온다) · 가장자리는 1칸 서리 점
  gray(g, w, k, x, y) {
    const grow = Math.min(1, w.t / 0.25), e = k > 1 - (w.out ?? 0.06) ? (1 - k) / (w.out ?? 0.06) : 1, r = w.r * (0.3 + 0.7 * (1 - Math.pow(1 - grow, 3)));
    g.save(); blobPath(g, x, y, r, SQ, w.seed, 22); g.clip();
    g.globalAlpha = e * (w.str ?? 1); g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);
    g.globalCompositeOperation = 'color'; g.globalAlpha = e * 0.35 * (w.str ?? 1); g.fillStyle = '#6a7cb8'; g.fillRect(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);
    g.restore();
    const rr = rnd(w.seed + 3); g.fillStyle = `rgba(200,212,240,${0.55 * e})`;
    for (let i = 0; i < 40; i++) { const a = rr() * TAU, d = r * (0.84 + rr() * 0.14); g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * SQ), 1, 1); }
  },
  // 멈춘 잔상: 멈춘 순간의 모습을 떠 두고 좌우로 흐리게 겹친다 · 머리 위엔 바늘이 멈춘 작은 시계 (도트)
  freeze(g, w, k, x, y, R) {
    const e = k > 0.94 ? (1 - k) / 0.06 : Math.min(1, w.t / 0.2);
    w.snaps ||= w.pts.map(([px, py]) => { const sx = Math.round(px - R.cx - 12), sy = Math.round(py - R.cy - 26), c = document.createElement('canvas'); c.width = 24; c.height = 30; c.getContext('2d').drawImage(scratch, sx, sy, 24, 30, 0, 0, 24, 30); return { c, px, py }; });
    for (const s of w.snaps) {
      const sx = Math.round(s.px - R.cx - 12), sy = Math.round(s.py - R.cy - 26);
      g.globalAlpha = 0.28 * e; g.drawImage(s.c, sx - 3, sy); g.drawImage(s.c, sx + 3, sy); g.globalAlpha = 0.16 * e; g.drawImage(s.c, sx - 6, sy);
      g.globalAlpha = e; clockGlyph(g, Math.round(s.px - R.cx), Math.round(s.py - R.cy - 30), w.seed + s.px, 0);
    }
    g.globalAlpha = 1;
  },
  // 금 간 유리: 가운데서 뻗는 갈라진 금 (1칸 밝은 선 + 짙은 그늘) · 금 사이 조각은 바깥으로 1~2칸 밀렸다 돌아온다
  crack(g, w, k, x, y) {
    const e = 1 - k, rr = rnd(w.seed), n = 9, rays = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rr() * 0.5, L = w.r * (0.6 + rr() * 0.55), pts = [[x, y]]; let px = x, py = y, aa = a; for (let s = 0; s < 6; s++) { aa += (rr() - 0.5) * 0.7; px += Math.cos(aa) * L / 6; py += Math.sin(aa) * L / 6 * SQ; pts.push([Math.round(px), Math.round(py)]); } rays.push({ a, pts }); }
    const off = 2.5 * e;
    for (let i = 0; i < n; i++) { // 조각 밀림
      const A = rays[i], B = rays[(i + 1) % n], m = (A.a + B.a) / 2 + (i === n - 1 ? Math.PI : 0);
      g.save(); g.beginPath(); g.moveTo(x, y); for (const p of A.pts) g.lineTo(p[0], p[1]); for (const p of B.pts.slice().reverse()) g.lineTo(p[0], p[1]); g.closePath(); g.clip();
      g.drawImage(scratch, Math.round(Math.cos(m) * off), Math.round(Math.sin(m) * off * SQ)); g.restore();
    }
    g.lineWidth = 1;
    for (const ray of rays) {
      g.strokeStyle = `rgba(20,14,40,${0.7 * e})`; g.beginPath(); ray.pts.forEach(([px, py], j) => (j ? g.lineTo(px + 0.5, py + 1.5) : g.moveTo(px + 0.5, py + 1.5))); g.stroke();
      g.strokeStyle = `rgba(232,240,255,${0.95 * e})`; g.beginPath(); ray.pts.forEach(([px, py], j) => (j ? g.lineTo(px + 0.5, py + 0.5) : g.moveTo(px + 0.5, py + 0.5))); g.stroke();
      const q = ray.pts[3]; g.strokeStyle = `rgba(190,200,255,${0.7 * e})`; g.beginPath(); g.moveTo(q[0] + 0.5, q[1] + 0.5); g.lineTo(q[0] + Math.cos(ray.a + 0.9) * 7 + 0.5, q[1] + Math.sin(ray.a + 0.9) * 5 + 0.5); g.stroke();
    }
  },
  // 찢어진 틈: 지퍼처럼 이가 맞물린 금이 벌어졌다 닫힌다 · 양쪽 화면은 밀려나고 · 틈 속은 별이 박힌 어둠
  tear(g, w, k, x, y) {
    const o = Math.sin(Math.min(1, k) * Math.PI), L = w.len, hw = w.wid * o, ux = Math.cos(w.ang), uy = Math.sin(w.ang), nx = -uy, ny = ux, N = 12, Lp = [], Rp = [];
    if (hw < 0.4) return;
    for (let i = 0; i <= N; i++) { const u = i / N, s = (u - 0.5) * L, prof = Math.sin(u * Math.PI), zz = (i % 2 ? 1 : -1) * 1.2 * o, d = hw * prof; const cx = x + ux * s + nx * zz, cy = y + uy * s + ny * zz; Lp.push([cx + nx * d, cy + ny * d]); Rp.unshift([cx - nx * d, cy - ny * d]); }
    for (const sd of [1, -1]) { // 양쪽 화면이 밀려난다
      g.save(); g.beginPath(); g.moveTo(x - ux * L * 0.6, y - uy * L * 0.6); g.lineTo(x + ux * L * 0.6, y + uy * L * 0.6); g.lineTo(x + ux * L * 0.6 + nx * sd * hw * 4, y + uy * L * 0.6 + ny * sd * hw * 4); g.lineTo(x - ux * L * 0.6 + nx * sd * hw * 4, y - uy * L * 0.6 + ny * sd * hw * 4); g.closePath(); g.clip();
      g.drawImage(scratch, Math.round(nx * sd * hw * 0.8), Math.round(ny * sd * hw * 0.8)); g.restore();
    }
    const poly = (pts) => { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); };
    g.fillStyle = w.c0 || '#9a80f0'; poly(Lp.map(([a, b], i) => [a + nx * (i % 2 ? 1 : 0.4), b + ny * (i % 2 ? 1 : 0.4)]).concat(Rp.map(([a, b], i) => [a - nx * (i % 2 ? 1 : 0.4), b - ny * (i % 2 ? 1 : 0.4)]))); g.fill();
    g.fillStyle = '#0a0418'; poly(Lp.concat(Rp)); g.fill();
    const rr = rnd(w.seed + Math.floor(w.t * 12)); g.fillStyle = '#f4eaff';
    for (let i = 0; i < 5; i++) { const u = 0.2 + rr() * 0.6, s = (u - 0.5) * L, d = (rr() - 0.5) * hw; g.fillRect(Math.round(x + ux * s + nx * d), Math.round(y + uy * s + ny * d), 1, 1); }
    g.fillStyle = w.c1 || '#d6c8ff'; for (const [px, py] of Lp.slice(2, -2).filter((_, i) => i % 2 === 0)) g.fillRect(Math.round(px), Math.round(py), 1, 1);
  },
  // 별빛 실선: 바깥에서 가운데로 휘어 감기며 빨려 든다 (빛 막대가 아니라 도트 점선 꼬리)
  streak(g, w, k, x, y) {
    const e = env(k, 0.2, 0.2), rr = rnd(w.seed); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < w.n; i++) {
      const a0 = rr() * TAU, ph = rr(), u = (w.t * 0.9 + ph) % 1;
      for (let j = 0; j < 7; j++) { const uu = Math.max(0, u - j * 0.035), d = w.r * (1 - uu), a = a0 + uu * 3.4 * (w.dir || 1); g.fillStyle = j === 0 ? `rgba(244,234,255,${e})` : `rgba(150,128,240,${e * (1 - j / 7) * 0.9})`; g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * SQ), 1, 1); }
    }
    g.globalCompositeOperation = 'source-over';
  },
  // 접힘 · 펴짐: 범위가 한순간 색이 뒤집혔다 돌아온다
  fold(g, w, k, x, y) {
    const e = env(k, 0.15, 0.7); g.save(); blobPath(g, x, y, w.r, SQ, w.seed, 16); g.clip();
    g.globalCompositeOperation = 'difference'; g.globalAlpha = 0.85 * e; g.fillStyle = '#e8dcff'; g.fillRect(x - w.r, y - w.r, w.r * 2, w.r * 2); g.restore();
  },
  // 느린 시계: 금빛 바늘 둘이 천천히 돌고 · 톱니 조각이 바늘을 따라 굴러간다 (점으로 찍은 바늘)
  clock(g, w, k, x, y) {
    const e = env(k, 0.08, 0.1), r = w.r;
    const hand = (a, L, c) => { g.fillStyle = c; for (let d = 2; d < L; d += 1.5) g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * SQ), d < L * 0.7 ? 2 : 1, 1); };
    g.globalAlpha = 0.75 * e;
    hand(w.t * 0.5 * (w.dir || 1) - 1.2, r * 0.82, '#ffd84a'); hand(w.t * 0.08 * (w.dir || 1) + 0.6, r * 0.5, '#c8a030');
    for (let i = 0; i < 3; i++) { const a = w.t * 0.35 * (w.dir || 1) + i * 2.1, d = r * (0.45 + i * 0.17); cog(g, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * SQ), w.t * (i % 2 ? -1 : 1) * 1.2); }
    g.fillStyle = '#fff0a8'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    g.globalAlpha = 1;
  },
};
// 작은 톱니 (도트): 바깥 이 여섯 · 가운데 구멍
function cog(g, x, y, rot) {
  g.fillStyle = '#7a5e18'; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = '#c8a030'; g.fillRect(x - 1, y - 2, 3, 5); g.fillRect(x - 2, y - 1, 5, 3);
  for (let i = 0; i < 6; i++) { const a = rot + (i / 6) * TAU; g.fillStyle = '#ffd84a'; g.fillRect(Math.round(x + Math.cos(a) * 3.4), Math.round(y + Math.sin(a) * 3.4), 1, 1); }
  g.fillStyle = '#2a2008'; g.fillRect(x, y, 1, 1);
}
// 바늘이 멈춘 작은 시계 (7칸)
function clockGlyph(g, x, y) {
  g.fillStyle = '#2a2008'; g.fillRect(x - 3, y - 2, 7, 5); g.fillRect(x - 2, y - 3, 5, 7);
  g.fillStyle = '#e8f0ff'; g.fillRect(x - 2, y - 2, 5, 5); g.fillRect(x - 1, y - 3, 3, 1); g.fillRect(x - 1, y + 3, 3, 1);
  g.fillStyle = '#c8a030'; g.fillRect(x, y - 2, 1, 3); g.fillRect(x, y, 2, 1);
}

// 렌더러가 세계 판을 화면으로 옮기기 바로 전에 부른다
export function drawWarps(R) {
  const L = R.warps; if (!L?.length) return;
  const now = performance.now() / 1000, dt = Math.min(0.05, Math.max(0, now - (R._warpT || now))); R._warpT = now;
  const lo = R.lo, g = lo.getContext('2d');
  if (!scratch || scratch.width !== lo.width || scratch.height !== lo.height) { scratch = document.createElement('canvas'); scratch.width = lo.width; scratch.height = lo.height; sg = scratch.getContext('2d'); }
  sg.clearRect(0, 0, scratch.width, scratch.height); sg.drawImage(lo, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  for (const w of L) {
    if (w.delay > 0) { w.delay -= dt; continue; }
    w.t += dt; const k = Math.min(1, w.t / w.max);
    const f = KIND[w.kind]; if (f) { g.save(); f(g, w, k, Math.round(w.x - R.cx), Math.round(w.y - R.cy), R); g.restore(); }
    if (w.t >= w.max && w.onEnd) { w.onEnd(); w.onEnd = null; }
  }
  g.restore();
  R.warps = L.filter((w) => w.delay > 0 || w.t < w.max);
}

// ───── 사건 → 연출 ─────
// 시공 스킬: 땅을 부수는 가시 · 파편 대신 세계가 뒤틀린다
export const SPACETIME = new Set(['timeStop', 'slowField', 'singularity', 'gravityCollapse', 'blinkBlast', 'shadowStep', 'rewind', 'timeBlades', 'hVoidStrike', 'hManaSurge', 'o_timeDebt', 'o_splitBlink', 'o_returnSlash']);
const tears = (R, x1, y1, x2, y2, c0, c1) => {
  const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
  addWarp(R, { kind: 'tear', x: x1, y: y1 - 8, len: 36, wid: 5, ang: a, max: 0.55, c0, c1 });
  addWarp(R, { kind: 'tear', x: x2, y: y2 - 8, len: 36, wid: 5, ang: a, max: 0.55, delay: 0.06, c0, c1 });
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  addWarp(R, { kind: 'glitch', x: mx, y: my - 8, w: Math.abs(x2 - x1) / 2 + 18, h: Math.abs(y2 - y1) / 2 + 14, amp: 6, max: 0.28 });
};
export function spacetimeFx(ev, w) {
  const sk = ev.sk; if (!sk || ev.foe || !SPACETIME.has(sk)) return false;
  const R = this, t = ev.t, p = w.player;
  const now = performance.now() / 1000;
  if (t === 'cast') { // 준비: 몸 둘레 공간이 천천히 비틀린다
    if (p) addWarp(R, { kind: 'swirl', x: p.x, y: p.y - 8, r: sk === 'timeStop' ? 70 : 46, ang: sk === 'timeStop' ? -0.9 : 0.7, max: (ev.dur || 0.5) + 0.15, in: 0.6, out: 0.2 });
    if (sk === 'timeStop' && p) addWarp(R, { kind: 'clock', x: p.x, y: p.y - 6, r: 34, dir: 8, max: (ev.dur || 0.6) + 0.1 });
    sfx('cast', { vol: 0.5, rate: 0.5 });
    return 'own';
  }
  if (sk === 'timeStop' && t === 'skillAoe') {
    if (ev.fx === 'timestop') { // 멈춤: 색이 빠지고 · 멈춘 적에 잔상 · 시계 문양 · 화면이 한 번 덜컥 어긋난다
      const r = ev.r || 150, pts = (w.enemies || []).filter((e) => !e.dead && e.hp > 0 && Math.hypot(e.x - ev.x, e.y - ev.y) < r).slice(0, 12).map((e) => [e.x, e.y]);
      addWarp(R, { kind: 'gray', x: ev.x, y: ev.y, r: r * 1.05, max: 3.05 });
      addWarp(R, { kind: 'freeze', x: ev.x, y: ev.y, pts, max: 3 });
      addWarp(R, { kind: 'clock', x: ev.x, y: ev.y - 4, r: r * 0.55, dir: 0.15, max: 3 });
      addWarp(R, { kind: 'glitch', x: ev.x, y: ev.y - 6, w: r * 0.7, h: r * 0.4, amp: 6, max: 0.2 });
      R.shake = Math.max(R.shake, 3); sfx('reaction', { vol: 0.7, rate: 0.5 });
    } else { // 풀림: 색이 확 돌아오며 공간이 유리처럼 깨진다
      const r = ev.r || 150;
      addWarp(R, { kind: 'crack', x: ev.x, y: ev.y - 6, r: r * 0.9, max: 0.6 });
      addWarp(R, { kind: 'fold', x: ev.x, y: ev.y - 6, r: r * 0.7, max: 0.22 });
      addWarp(R, { kind: 'glitch', x: ev.x, y: ev.y - 6, w: r * 0.7, h: r * 0.4, amp: 6, max: 0.3 });
      R.flash = { color: '214,200,255', t: 0.18, max: 0.18 }; R.shake = Math.max(R.shake, 6); R.addStop?.(0.1); sfx('hitHeavy', { vol: 0.8, rate: 0.6 });
    }
    return 'own';
  }
  if ((sk === 'singularity' || sk === 'gravityCollapse') && t === 'skillAoe') {
    const key = '_st_' + sk, pull = !R[key] || now - R[key] > 1.2;
    if (pull) { // 빨아들임: 화면이 가운데로 당겨지는 렌즈 · 소용돌이 · 별빛 실선
      R[key] = now; const r = (ev.r || 90) * 1.2, d = sk === 'singularity' ? 0.75 : 0.55;
      addWarp(R, { kind: 'pinch', x: ev.x, y: ev.y - 6, r, amt: 0.75, max: d + 0.1, in: 0.6, out: 0.15 });
      addWarp(R, { kind: 'swirl', x: ev.x, y: ev.y - 6, r: r * 0.8, ang: 2.8, max: d + 0.1, in: 0.7, out: 0.15 });
      addWarp(R, { kind: 'streak', x: ev.x, y: ev.y - 6, r: r * 1.1, n: 22, max: d + 0.1 });
      addWarp(R, { kind: 'gray', x: ev.x, y: ev.y - 4, r: r * 0.7, str: 0.7, max: d + 0.35, out: 0.2 });
      R.shake = Math.max(R.shake, 2); sfx('cast', { vol: 0.6, rate: 0.4 });
    } else { // 접혔다 펴짐: 한순간 부풀고 색이 뒤집히며 가로 줄이 어긋난다
      R[key] = 0; const r = (ev.r || 64) * 1.5;
      addWarp(R, { kind: 'pinch', x: ev.x, y: ev.y - 6, r, amt: -0.5, max: 0.4, in: 0.15, out: 0.7 });
      addWarp(R, { kind: 'fold', x: ev.x, y: ev.y - 6, r: r * 0.75, max: 0.2 });
      addWarp(R, { kind: 'glitch', x: ev.x, y: ev.y - 6, w: r, h: r * 0.5, amp: 9, max: 0.3 });
      addWarp(R, { kind: 'crack', x: ev.x, y: ev.y - 6, r: r * 0.6, max: 0.45 });
      R.flash = { color: '180,150,255', t: 0.12, max: 0.12 }; R.shake = Math.max(R.shake, 6); sfx('hitHeavy', { vol: 0.8, rate: 0.5 });
    }
    return 'own';
  }
  if (t === 'skillFall' && (sk === 'timeStop' || sk === 'singularity' || sk === 'gravityCollapse')) return 'own';
  if (sk === 'slowField' && t === 'zoneFx') { // 감속장: 옅게 바랜 땅 · 느린 금빛 바늘 · 아주 천천히 비틀리는 공간
    const r = ev.r || 72;
    addWarp(R, { kind: 'gray', x: ev.x, y: ev.y, r, str: 0.55, max: 6, out: 0.08 });
    addWarp(R, { kind: 'clock', x: ev.x, y: ev.y, r: r * 0.9, dir: 1, max: 6 });
    addWarp(R, { kind: 'swirl', x: ev.x, y: ev.y, r: r * 0.9, ang: 0.12, spin: 0.9, max: 6, in: 0.05, out: 0.05 });
    addWarp(R, { kind: 'glitch', x: ev.x, y: ev.y - 4, w: r, h: r * 0.5, amp: 4, max: 0.25 });
    sfx('cast', { vol: 0.5, rate: 0.35 });
    return false;
  }
  if (t === 'blink') { tears(R, ev.x1, ev.y1, ev.x2, ev.y2, sk === 'shadowStep' ? '#5a1f86' : undefined); return false; }
  if (t === 'rewind') { // 되감기: 잔상이 거꾸로 빨려 들고 · 시계 바늘이 거꾸로 돈다
    if (ev.x2 == null) { addWarp(R, { kind: 'swirl', x: ev.x, y: ev.y - 8, r: 70, ang: -1.6, max: 0.6, in: 0.2, out: 0.6 }); addWarp(R, { kind: 'crack', x: ev.x, y: ev.y - 6, r: 60, max: 0.5 }); addWarp(R, { kind: 'glitch', x: ev.x, y: ev.y - 8, w: 70, h: 30, amp: 7, max: 0.3 }); return false; }
    addWarp(R, { kind: 'swirl', x: ev.x2, y: ev.y2 - 8, r: 44, ang: -1.4, max: 0.5, in: 0.2, out: 0.6 });
    addWarp(R, { kind: 'clock', x: ev.x2, y: ev.y2 - 6, r: 30, dir: -14, max: 0.6 });
    tears(R, ev.x1, ev.y1, ev.x2, ev.y2);
    return false;
  }
  if (t === 'skillAoe' && (sk === 'o_timeDebt' || sk === 'o_splitBlink')) {
    const r = ev.r || 60;
    addWarp(R, { kind: 'swirl', x: ev.x, y: ev.y - 6, r, ang: sk === 'o_timeDebt' ? -1.1 : 0.9, max: 0.45, in: 0.2, out: 0.6 });
    addWarp(R, { kind: 'glitch', x: ev.x, y: ev.y - 6, w: r, h: r * 0.5, amp: 6, max: 0.25 });
    if (sk === 'o_timeDebt') addWarp(R, { kind: 'crack', x: ev.x, y: ev.y - 6, r: r * 0.8, max: 0.5 });
    return false;
  }
  if (t === 'skillFx' && sk === 'hVoidStrike') { // 공허 일격: 앞 공간이 찢어지고 빨려 든다
    const x = ev.x + Math.cos(ev.ang || 0) * 22, y = ev.y + Math.sin(ev.ang || 0) * 22 - 6;
    addWarp(R, { kind: 'tear', x, y, len: 40, wid: 5, ang: (ev.ang || 0) + Math.PI / 2, max: 0.55, c0: '#5a1f86', c1: '#d098ff' });
    addWarp(R, { kind: 'pinch', x, y, r: 50, amt: 0.4, max: 0.5, in: 0.4, out: 0.3 });
    addWarp(R, { kind: 'glitch', x, y, w: 50, h: 24, amp: 7, max: 0.3, delay: 0.2 });
    return false;
  }
  if (t === 'buff' && sk === 'hManaSurge') { // 마력 폭주: 몸 둘레가 빠르게 비틀리며 깜빡 어긋난다
    addWarp(R, { kind: 'swirl', x: ev.x, y: ev.y - 8, r: 40, ang: 1.2, spin: 9, max: 1, in: 0.15, out: 0.4 });
    addWarp(R, { kind: 'glitch', x: ev.x, y: ev.y - 8, w: 40, h: 22, amp: 5, max: 0.5 });
    return false;
  }
  if ((t === 'skillDash' || t === 'echoMark') && sk === 'o_returnSlash') { addWarp(R, { kind: 'swirl', x: ev.x ?? p?.x, y: (ev.y ?? p?.y) - 8, r: 34, ang: -1, max: 0.4, in: 0.2, out: 0.6 }); return false; }
  if (t === 'skillFx' && sk === 'timeBlades' && p) { addWarp(R, { kind: 'clock', x: p.x, y: p.y - 6, r: 24, dir: 10, max: 0.4 }); return false; }
  return false;
}

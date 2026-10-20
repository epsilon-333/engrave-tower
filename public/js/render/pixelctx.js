// 도트 그리기 판: 세계를 1배 해상도로 그리는 판을 감싸서, 원 · 타원 · 다각형 · 선 · 곡선을
// 캔버스의 흐릿한(안티에일리어싱) 가장자리 대신 칸(도트) 단위로 채운다. 칸의 한가운데가 도형 안이면 그 칸을 칠한다.
// 이미지 · 글씨 · 무늬 채우기 · 점선은 원래 판에 그대로 맡기고, 그라데이션은 계단식 띠 + 바둑판 디더링으로 칠한다.
// 칠할 구간은 하나의 정수 버퍼에 모아 다시 쓴다 (매번 작은 배열을 만들지 않아 멈칫하지 않게).
import { BAYER4 } from './pxfx.js';
const TAU = Math.PI * 2;

// ───── 다시 쓰는 버퍼들 ─────
let SB = new Int32Array(3 * 8192), SN = 0;           // 칠할 구간 [y, a, b] 들
const pushSpan = (y, a, b) => { if (SN * 3 + 3 > SB.length) { const n = new Int32Array(SB.length * 2); n.set(SB); SB = n; } const i = SN * 3; SB[i] = y; SB[i + 1] = a; SB[i + 2] = b; SN++; };
let EB = new Float64Array(5 * 512), EN = 0;           // 다각형 변 [x0, y0, x1, y1, 방향]
let XS = new Float64Array(256), WS = new Int8Array(256); // 한 줄의 교차점
let scr = null;                                        // 그라데이션 · 점묘를 찍어 두는 판
const GLOW = new Map();                                // 빛 번짐 도트 그림 (크기 · 색 단계마다)
const scratch = (w, h) => {
  if (!scr || scr.c.width < w || scr.c.height < h) { const c = document.createElement('canvas'); c.width = Math.max(w, scr?.c.width || 0); c.height = Math.max(h, scr?.c.height || 0); const g = c.getContext('2d'); scr = { c, g, img: g.createImageData(c.width, c.height) }; }
  const W = scr.c.width, d = scr.img.data;
  for (let y = 0; y < h; y++) d.fill(0, y * W * 4, (y * W + w) * 4);
  return scr;
};
const PROPS = ['lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'globalAlpha', 'globalCompositeOperation', 'font', 'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'filter', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'lineDashOffset', 'direction'];

export class PixelCtx {
  constructor(ctx) {
    this.c = ctx; this.m = [1, 0, 0, 1, 0, 0]; this.ms = [];
    this.sub = []; this.cur = null; this.only = null; this.lazy = null; this.has = false; this.lx = 0; this.ly = 0; this.sx0 = 0; this.sy0 = 0; this.dash = false; this.pxFill = null;
  }
  get canvas() { return this.c.canvas; }

  // ───── 변환 (원래 판에도 그대로 건다) ─────
  save() { this.ms.push(this.m.slice()); this.c.save(); }
  restore() { if (this.ms.length) this.m = this.ms.pop(); this.c.restore(); }
  setTransform(a, b, c, d, e, f) { if (typeof a === 'object') ({ a, b, c, d, e, f } = a); this.m = [a, b, c, d, e, f]; this.c.setTransform(a, b, c, d, e, f); }
  resetTransform() { this.setTransform(1, 0, 0, 1, 0, 0); }
  getTransform() { return this.c.getTransform(); }
  transform(a, b, c, d, e, f) { const [A, B, C, D, E, F] = this.m; this.m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F]; this.c.transform(a, b, c, d, e, f); }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; this.c.translate(x, y); }
  scale(x, y) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; this.c.scale(x, y); }
  rotate(r) { const cs = Math.cos(r), sn = Math.sin(r), m = this.m, a = m[0], b = m[1], c = m[2], d = m[3]; m[0] = a * cs + c * sn; m[1] = b * cs + d * sn; m[2] = c * cs - a * sn; m[3] = d * cs - b * sn; this.c.rotate(r); }

  // ───── 경로 (내 쪽은 화면 칸 좌표로 펴 두고, 원래 판에도 같이 그어 둔다: clip 용) ─────
  P(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  beginPath() { this.sub = []; this.cur = null; this.only = null; this.lazy = null; this.has = false; this.c.beginPath(); }
  // 지금 하위 경로가 없으면 (x, y)에서 새로 연다. 빈 경로의 첫 lineTo는 moveTo와 같다 (캔버스 규칙)
  open(x, y) { if (!this.has) { this.lx = this.sx0 = x; this.ly = this.sy0 = y; this.has = true; } if (!this.cur) { this.cur = [this.P(this.lx, this.ly)]; this.sub.push(this.cur); } }
  // 통째 원 하나로 미뤄 둔 경로를 점들로 편다 (선을 긋거나 다른 경로가 이어질 때만)
  real() { const L = this.lazy; if (!L) return; this.lazy = null; this.only = null; this.flatArc(L.x, L.y, L.rx, L.ry, L.rot, L.a0, L.d, L.m); }
  moveTo(x, y) { this.real(); this.cur = [this.P(x, y)]; this.sub.push(this.cur); this.lx = this.sx0 = x; this.ly = this.sy0 = y; this.has = true; this.only = null; this.c.moveTo(x, y); }
  lineTo(x, y) {
    this.real(); this.open(x, y);
    this.cur.push(this.P(x, y)); this.lx = x; this.ly = y; this.only = null; this.c.lineTo(x, y);
  }
  closePath() { this.real(); if (this.cur) { this.cur.closed = true; this.cur = null; this.lx = this.sx0; this.ly = this.sy0; } this.c.closePath(); }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  quadraticCurveTo(cx, cy, x, y) {
    this.real(); this.open(cx, cy);
    const x0 = this.lx, y0 = this.ly, n = this.segs(Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy));
    for (let i = 1; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; this.cur.push(this.P(a * x0 + b * cx + c * x, a * y0 + b * cy + c * y)); }
    this.lx = x; this.ly = y; this.only = null; this.c.quadraticCurveTo(cx, cy, x, y);
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    this.real(); this.open(c1x, c1y);
    const x0 = this.lx, y0 = this.ly, n = this.segs(Math.hypot(c1x - x0, c1y - y0) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(x - c2x, y - c2y));
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.cur.push(this.P(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y)); }
    this.lx = x; this.ly = y; this.only = null; this.c.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
  }
  arcTo(x1, y1, x2, y2, r) { this.lineTo(x1, y1); this.c.arcTo(x1, y1, x2, y2, r); }
  segs(len) { const sc = Math.sqrt(Math.abs(this.m[0] * this.m[3] - this.m[1] * this.m[2])) || 1; return Math.max(4, Math.min(48, Math.ceil((len * sc) / 3))); }
  sweep(a0, a1, ccw) { // 브라우저와 같은 규칙으로 돌아가는 각 (거꾸로 0 → 2π 도 한 바퀴)
    const d = a1 - a0;
    if (!ccw) return d >= TAU ? TAU : d < 0 ? TAU - ((-d) % TAU) : d;
    return -d >= TAU ? -TAU : d > 0 ? -(TAU - (d % TAU)) : d;
  }
  arc(x, y, r, a0, a1, ccw = false) { this.ellipse(x, y, r, r, 0, a0, a1, ccw, true); }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw = false, isArc = false) {
    if (isArc) this.c.arc(x, y, rx, a0, a1, ccw); else this.c.ellipse(x, y, rx, ry, rot, a0, a1, ccw);
    rx = Math.abs(rx); ry = Math.abs(ry);
    const d = this.sweep(a0, a1, ccw), m = this.m;
    // 경로가 통째로 원 · 타원 하나이고 돌리지 않았으면, 줄마다 바로 폭을 셈한다 (점으로 펴는 것은 필요할 때만)
    if (!this.sub.length && !this.lazy && Math.abs(d) >= TAU - 1e-6 && Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9 && (Math.abs(rot % Math.PI) < 1e-9 || rx === ry)) {
      this.only = { cx: m[0] * x + m[4], cy: m[3] * y + m[5], rx: rx * Math.abs(m[0]), ry: ry * Math.abs(m[3]) };
      this.lazy = { x, y, rx, ry, rot, a0, d, m: m.slice() }; this.has = true;
      return;
    }
    this.real(); this.only = null;
    this.flatArc(x, y, rx, ry, rot, a0, d, m);
  }
  flatArc(x, y, rx, ry, rot, a0, d, m) {
    const cs = Math.cos(rot), sn = Math.sin(rot), sc = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
    const n = Math.max(6, Math.min(72, Math.ceil((Math.abs(d) * Math.max(rx, ry) * sc) / 2.2)));
    const pt = (t) => { const ex = Math.cos(t) * rx, ey = Math.sin(t) * ry, ux = x + ex * cs - ey * sn, uy = y + ex * sn + ey * cs; return [m[0] * ux + m[2] * uy + m[4], m[1] * ux + m[3] * uy + m[5], ux, uy]; };
    const s = pt(a0);
    if (this.cur) this.cur.push([s[0], s[1]]); else { this.cur = [[s[0], s[1]]]; this.sub.push(this.cur); this.sx0 = s[2]; this.sy0 = s[3]; }
    this.has = true;
    let e = s;
    for (let i = 1; i <= n; i++) { e = pt(a0 + (d * i) / n); this.cur.push([e[0], e[1]]); }
    this.lx = e[2]; this.ly = e[3];
  }

  // ───── 채우기 · 긋기 ─────
  fill(rule) {
    const c = this.c;
    if (this.pxFill) { this.collect(rule === 'evenodd'); return this.gradSpans(); }
    if (typeof c.fillStyle !== 'string') { if (rule) c.fill(rule); else c.fill(); return; }
    this.collect(rule === 'evenodd');
    this.emit();
  }
  collect(evenodd) { if (this.only) ellipseSpans(this.only.cx, this.only.cy, this.only.rx, this.only.ry); else polySpans(this.sub, evenodd, true); }
  stroke() {
    const c = this.c;
    if (typeof c.strokeStyle !== 'string' || this.dash) { c.stroke(); return; }
    this.real();
    const m = this.m, sc = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1, lw = Math.max(1, c.lineWidth * sc), hw = lw / 2;
    const cap = c.lineCap, polys = [];
    for (const sp of this.sub) {
      const pts = sp.closed && sp.length > 2 ? [...sp, sp[0]] : sp;
      if (pts.length === 1) { if (cap !== 'butt') polys.push(dot(pts[0][0], pts[0][1], hw, cap)); continue; }
      for (let i = 1; i < pts.length; i++) {
        let [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
        if (L < 1e-6) continue;
        const nx = (-dy / L) * hw, ny = (dx / L) * hw;
        if (cap === 'square' && !sp.closed) { if (i === 1) { x0 -= (dx / L) * hw; y0 -= (dy / L) * hw; } if (i === pts.length - 1) { x1 += (dx / L) * hw; y1 += (dy / L) * hw; } }
        polys.push([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
        if (lw >= 2 && i < pts.length - 1) polys.push(dot(x1, y1, hw, 'round')); // 꺾이는 곳 메우기
      }
      if (cap === 'round' && !sp.closed && pts.length > 1) { polys.push(dot(pts[0][0], pts[0][1], hw, 'round')); polys.push(dot(pts[pts.length - 1][0], pts[pts.length - 1][1], hw, 'round')); }
    }
    if (!polys.length) return;
    SN = 0;
    for (const p of polys) polySpans([p], false, false);
    if (polys.length > 1) mergeAll(); // 겹친 곳을 덧칠하지 않게 (반투명 선)
    const fs = c.fillStyle; c.fillStyle = c.strokeStyle;
    this.emit();
    c.fillStyle = fs;
  }
  fillRect(x, y, w, h) {
    const c = this.c, m = this.m;
    if (this.pxFill) {
      if (this.glowSprite(x, y, w, h)) return;
      SN = 0; polySpans([[this.P(x, y), this.P(x + w, y), this.P(x + w, y + h), this.P(x, y + h)]], false, false);
      return this.gradSpans();
    }
    if (typeof c.fillStyle !== 'string') { c.fillRect(x, y, w, h); return; }
    if (Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9) { // 돌리지 않았다: 칸에 맞춰 반올림 (얇아도 한 칸은 남긴다)
      const X0 = m[0] * x + m[4], X1 = m[0] * (x + w) + m[4], Y0 = m[3] * y + m[5], Y1 = m[3] * (y + h) + m[5];
      let ax = Math.round(Math.min(X0, X1)), bx = Math.round(Math.max(X0, X1)), ay = Math.round(Math.min(Y0, Y1)), by = Math.round(Math.max(Y0, Y1));
      if (bx === ax && Math.abs(X1 - X0) >= 0.3) bx = ax + 1;
      if (by === ay && Math.abs(Y1 - Y0) >= 0.3) by = ay + 1;
      if (bx > ax && by > ay) { if (this.isInt()) c.fillRect(ax - m[4], ay - m[5], bx - ax, by - ay); else { c.setTransform(1, 0, 0, 1, 0, 0); c.fillRect(ax, ay, bx - ax, by - ay); c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); } }
      return;
    }
    SN = 0; polySpans([[this.P(x, y), this.P(x + w, y), this.P(x + w, y + h), this.P(x, y + h)]], false, false);
    this.emit();
  }
  strokeRect(x, y, w, h) { const s = this.sub, cu = this.cur, o = this.only, lz = this.lazy, hs = this.has; this.sub = []; this.cur = null; this.only = null; this.lazy = null; this.rect(x, y, w, h); this.stroke(); this.sub = s; this.cur = cu; this.only = o; this.lazy = lz; this.has = hs; this.c.beginPath(); }
  isInt() { const m = this.m; return m[0] === 1 && m[3] === 1 && m[1] === 0 && m[2] === 0 && Number.isInteger(m[4]) && Number.isInteger(m[5]); }
  // 화면 칸 좌표로 그린다 (지금 변환이 정수 이동뿐이면 변환을 바꾸지 않고 바로)
  dev(fn) {
    const c = this.c, m = this.m;
    if (this.isInt()) { c.translate(-m[4], -m[5]); fn(c); c.translate(m[4], m[5]); return; }
    c.setTransform(1, 0, 0, 1, 0, 0); fn(c); c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  }
  // 모은 구간을 칠한다: 위아래로 이어진 같은 구간은 한 번에
  emit() {
    if (!SN) return;
    const c = this.c, m = this.m, int = this.isInt(), ox = int ? m[4] : 0, oy = int ? m[5] : 0;
    if (!int) c.setTransform(1, 0, 0, 1, 0, 0);
    let pa = 0, pb = 0, py = 0, ph = 0;
    for (let i = 0; i < SN * 3; i += 3) {
      const y = SB[i], a = SB[i + 1], b = SB[i + 2];
      if (ph && a === pa && b === pb && y === py + ph) { ph++; continue; }
      if (ph) c.fillRect(pa - ox, py - oy, pb - pa, ph);
      pa = a; pb = b; py = y; ph = 1;
    }
    if (ph) c.fillRect(pa - ox, py - oy, pb - pa, ph);
    if (!int) c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    SN = 0;
  }
  spanBox() { let xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity; for (let i = 0; i < SN * 3; i += 3) { const y = SB[i]; if (y < ya) ya = y; if (y > yb) yb = y; if (SB[i + 1] < xa) xa = SB[i + 1]; if (SB[i + 2] > xb) xb = SB[i + 2]; } return [xa, ya, xb, yb]; }
  // 그라데이션: 칸마다 위치(t)를 구해 몇 단계 띠로 끊고, 띠 사이는 바둑판 디더링으로 섞는다 (도트식 빛 번짐)
  gradSpans() {
    if (!SN) return;
    const gr = this.pxFill, m = this.m, det = m[0] * m[3] - m[1] * m[2];
    if (!det) { SN = 0; return; }
    const ia = m[3] / det, ib = -m[1] / det, ic = -m[2] / det, id = m[0] / det, ie = (m[2] * m[5] - m[3] * m[4]) / det, iff = (m[1] * m[4] - m[0] * m[5]) / det;
    const [xa, ya, xb, yb] = this.spanBox(), W = xb - xa, Hh = yb - ya + 1;
    if (W <= 0 || Hh <= 0 || W * Hh > 1200000) { SN = 0; return; }
    const sc = Math.sqrt(Math.abs(det)), span = gr.size() * sc, N = span < 10 ? 2 : span < 30 ? 3 : span < 90 ? 4 : 5;
    const S = scratch(W, Hh), d = S.img.data, SW = S.c.width;
    for (let j = 0; j < SN * 3; j += 3) {
      const y = SB[j], by = BAYER4[y & 3], py = y + 0.5;
      for (let x = SB[j + 1]; x < SB[j + 2]; x++) {
        const px = x + 0.5, tt = gr.t(ia * px + ic * py + ie, ib * px + id * py + iff);
        const k = tt >= 1 ? N : Math.max(0, Math.min(N, Math.floor(tt * N + by[x & 3] - 0.5)));
        const col = gr.rgba(k, N);
        if (!col) continue;
        const i = ((y - ya) * SW + (x - xa)) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = col[3];
      }
    }
    SN = 0;
    S.g.putImageData(S.img, 0, 0, 0, 0, W, Hh);
    this.dev((g) => g.drawImage(S.c, 0, 0, W, Hh, xa, ya, W, Hh));
  }
  // 빛 번짐 (동심원 그라데이션을 네모에 칠할 때): 크기 · 납작한 정도 · 색마다 한 번 만든 디더링 도트 그림을 다시 쓴다
  glowSprite(x, y, w, h) {
    const gr = this.pxFill, m = this.m;
    if (gr.kind !== 'r' || m[1] !== 0 || m[2] !== 0 || m[0] <= 0 || m[3] <= 0) return false;
    const [x0, y0, r0, x1, y1, r1] = gr.a;
    if (x0 !== x1 || y0 !== y1 || r1 <= 0) return false;
    const sx = m[0], sy = m[3], q = Math.round((sy / sx) * 20) / 20; // 납작한 정도 (세로 / 가로)
    if (q < 0.25 || q > 4) return false;
    const cx = sx * x1 + m[4], cy = sy * y1 + m[5], R = r1 * sx, RY = r1 * sy;
    const X0 = sx * x + m[4], Y0 = sy * y + m[5], X1 = X0 + sx * w, Y1 = Y0 + sy * h;
    if (Math.min(X0, X1) > cx - R + 0.5 || Math.max(X0, X1) < cx + R - 0.5 || Math.min(Y0, Y1) > cy - RY + 0.5 || Math.max(Y0, Y1) < cy + RY - 0.5) return false; // 네모가 원을 다 덮지 않으면 일반 방법으로
    // 크기는 몇 단계로 묶고(큰 빛일수록 성기게), 밝기는 그림을 만든 뒤 투명도로 준다 → 움직이는 빛도 같은 그림을 다시 쓴다
    const Rq = Math.max(1, R <= 16 ? Math.round(R) : R <= 40 ? Math.round(R / 2) * 2 : R <= 80 ? Math.round(R / 6) * 6 : Math.round(R / 16) * 16), RYq = Math.max(1, Math.round(Rq * q)), mx = gr.maxA();
    if (mx < 0.01) return true;
    const key = `${Rq}|${RYq}|${Math.round((r0 / r1) * 20)}|${gr.sigN()}`;
    let spr = GLOW.get(key);
    if (!spr) {
      const N = Rq * 2 < 10 ? 2 : Rq * 2 < 30 ? 3 : Rq * 2 < 90 ? 4 : 5, SW = Rq * 2 + 1, SH = RYq * 2 + 1, c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const g = c.getContext('2d'), img = g.createImageData(SW, SH), d = img.data, rr0 = (r0 / r1) * Rq, k = Rq / RYq;
      const cols = []; for (let n = 0; n <= N; n++) { const col = gr.rgba(n, N); cols.push(col ? [col[0], col[1], col[2], Math.min(255, Math.round(col[3] / mx))] : null); }
      const put = (xx, yy, t) => { // 같은 거리라도 칸마다 바둑판 문턱이 달라 띠 사이가 섞인다
        const n = t >= 1 ? N : Math.max(0, Math.min(N, Math.floor(Math.max(0, t) * N + BAYER4[yy & 3][xx & 3] - 0.5))), col = cols[n];
        if (!col) return;
        const i = (yy * SW + xx) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = col[3];
      };
      for (let dy = 0; dy <= RYq; dy++) for (let dx = 0; dx <= Rq; dx++) { // 4분의 1만 거리를 재고 대칭으로
        const t = (Math.sqrt(dx * dx + dy * k * (dy * k)) - rr0) / (Rq - rr0 || 1);
        if (t >= 1 && !cols[N]) continue;
        put(Rq + dx, RYq + dy, t); if (dx) put(Rq - dx, RYq + dy, t); if (dy) { put(Rq + dx, RYq - dy, t); if (dx) put(Rq - dx, RYq - dy, t); }
      }
      g.putImageData(img, 0, 0);
      spr = c; GLOW.set(key, spr);
      if (GLOW.size > 700) GLOW.delete(GLOW.keys().next().value);
    }
    const px = Math.round(cx - 0.5) - Rq, py = Math.round(cy - 0.5) - RYq, ga = this.c.globalAlpha;
    this.c.globalAlpha = ga * mx;
    this.dev((g) => g.drawImage(spr, px, py));
    this.c.globalAlpha = ga;
    return true;
  }
  // 도트식 반투명: 비율(density)만큼의 칸만 칠한다. 바둑판 무늬는 세계에 붙어 있어 화면이 움직여도 흔들리지 않는다
  ditherEllipse(x, y, rx, ry, color, density) {
    if (!(density > 0.01)) return;
    const m = this.m;
    ellipseSpans(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5], Math.abs(rx * m[0]), Math.abs(ry * m[3]));
    this.ditherSpans(color, density);
  }
  ditherPoly(pts, color, density) { if (!(density > 0.01)) return; SN = 0; polySpans([pts.map(([x, y]) => this.P(x, y))], false, false); this.ditherSpans(color, density); }
  ditherSpans(color, density) {
    if (!SN) return;
    const [xa, ya, xb, yb] = this.spanBox(), W = xb - xa, Hh = yb - ya + 1;
    if (W <= 0 || Hh <= 0 || W * Hh > 1200000) { SN = 0; return; }
    const [r, g2, b2, a2] = parseColor(color), A = Math.round(Math.min(1, a2) * 255), ox = Math.round(this.m[4]), oy = Math.round(this.m[5]);
    const S = scratch(W, Hh), d = S.img.data, SW = S.c.width;
    for (let j = 0; j < SN * 3; j += 3) {
      const y = SB[j], by = BAYER4[(((y - oy) % 4) + 4) % 4];
      for (let x = SB[j + 1]; x < SB[j + 2]; x++) {
        if (by[(((x - ox) % 4) + 4) % 4] >= density) continue;
        const i = ((y - ya) * SW + (x - xa)) * 4; d[i] = r; d[i + 1] = g2; d[i + 2] = b2; d[i + 3] = A;
      }
    }
    SN = 0;
    S.g.putImageData(S.img, 0, 0, 0, 0, W, Hh);
    this.dev((g) => g.drawImage(S.c, 0, 0, W, Hh, xa, ya, W, Hh));
  }
  // 점선 테두리: 타원 둘레의 칸을 on칸 칠하고 off칸 건넌다 (phase만큼 돌아간다)
  dashEllipse(x, y, rx, ry, color, on = 3, off = 2, phase = 0) {
    const m = this.m, cx = m[0] * x + m[2] * y + m[4], cy = m[1] * x + m[3] * y + m[5], RX = Math.abs(rx * m[0]), RY = Math.abs(ry * m[3]);
    if (RX < 1 || RY < 1) return;
    const n = Math.ceil(Math.PI * (RX + RY) * 1.5), per = on + off, ph = Math.floor(phase), c = this.c, fs = c.fillStyle;
    c.fillStyle = color;
    let lx = 1e9, ly = 1e9, k = 0;
    this.dev((g) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU, X = Math.floor(cx + Math.cos(a) * RX), Y = Math.floor(cy + Math.sin(a) * RY); if (X === lx && Y === ly) continue; lx = X; ly = Y; if (((k++ + ph) % per + per) % per < on) g.fillRect(X, Y, 1, 1); } });
    c.fillStyle = fs;
  }

  // ───── 그대로 넘기는 것 ─────
  drawImage(...a) { this.c.drawImage(...a); }
  fillText(...a) { this.c.fillText(...a); }
  strokeText(...a) { this.c.strokeText(...a); }
  measureText(t) { return this.c.measureText(t); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new PxGrad('r', [x0, y0, r0, x1, y1, r1]); }
  createLinearGradient(x0, y0, x1, y1) { return new PxGrad('l', [x0, y0, x1, y1]); }
  createPattern(...a) { return this.c.createPattern(...a); }
  clearRect(...a) { this.c.clearRect(...a); }
  clip(...a) { this.c.clip(...a); }
  setLineDash(d) { this.dash = !!(d && d.length); this.c.setLineDash(d); }
  getLineDash() { return this.c.getLineDash(); }
  getImageData(...a) { return this.c.getImageData(...a); }
  putImageData(...a) { this.c.putImageData(...a); }
  isPointInPath(...a) { return this.c.isPointInPath(...a); }
}
for (const k of PROPS) Object.defineProperty(PixelCtx.prototype, k, { get() { return this.c[k]; }, set(v) { this.c[k] = v; } });
Object.defineProperty(PixelCtx.prototype, 'fillStyle', {
  get() { return this.pxFill || this.c.fillStyle; },
  set(v) { if (v instanceof PxGrad) { this.pxFill = v; this.c.fillStyle = v.mid(); } else { this.pxFill = null; this.c.fillStyle = v; } },
});
Object.defineProperty(PixelCtx.prototype, 'strokeStyle', {
  get() { return this.c.strokeStyle; },
  set(v) { this.c.strokeStyle = v instanceof PxGrad ? v.mid() : v; },
});

// 원 · 타원: 줄마다 칸 한가운데가 안에 드는 구간 (버퍼를 비우고 채운다)
function ellipseSpans(cx, cy, rx, ry) {
  SN = 0;
  if (rx < 0.35 || ry < 0.35) { pushSpan(Math.floor(cy), Math.floor(cx), Math.floor(cx) + 1); return; } // 아주 작은 원은 한 칸
  const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    const t = (y + 0.5 - cy) / ry;
    if (t <= -1 || t >= 1) continue;
    const h = rx * Math.sqrt(1 - t * t), a = Math.ceil(cx - h - 0.5), b = Math.floor(cx + h - 0.5) + 1;
    if (b > a) pushSpan(y, a, b);
  }
  if (!SN) pushSpan(Math.floor(cy), Math.floor(cx), Math.floor(cx) + 1);
}
// 다각형들 (한 경로의 하위 경로들): 0이 아닌 감김 규칙(또는 짝홀 규칙)으로 줄마다 구간. reset이면 버퍼를 비우고, 아니면 뒤에 덧붙인다
function polySpans(subs, evenodd, reset) {
  if (reset) SN = 0;
  EN = 0;
  let ymin = Infinity, ymax = -Infinity;
  for (const s of subs) {
    const n = s.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const p = s[i], q = s[(i + 1) % n], y0 = p[1], y1 = q[1];
      if (y0 === y1) continue;
      if (EN * 5 + 5 > EB.length) { const nb = new Float64Array(EB.length * 2); nb.set(EB); EB = nb; }
      const k = EN * 5;
      if (y0 < y1) { EB[k] = p[0]; EB[k + 1] = y0; EB[k + 2] = q[0]; EB[k + 3] = y1; EB[k + 4] = 1; } else { EB[k] = q[0]; EB[k + 1] = y1; EB[k + 2] = p[0]; EB[k + 3] = y0; EB[k + 4] = -1; }
      EN++;
      if (y0 < ymin) ymin = y0; if (y1 < ymin) ymin = y1; if (y0 > ymax) ymax = y0; if (y1 > ymax) ymax = y1;
    }
  }
  if (!EN) return;
  if (XS.length < EN) { XS = new Float64Array(EN * 2); WS = new Int8Array(EN * 2); }
  const ya = Math.floor(ymin), yb = Math.ceil(ymax);
  for (let y = ya; y <= yb; y++) {
    const yc = y + 0.5;
    let nx = 0;
    for (let k = 0; k < EN * 5; k += 5) {
      if (yc < EB[k + 1] || yc >= EB[k + 3]) continue;
      const x = EB[k] + ((yc - EB[k + 1]) * (EB[k + 2] - EB[k])) / (EB[k + 3] - EB[k + 1]), w = EB[k + 4];
      let j = nx++; // 넣으며 정렬 (교차점은 몇 개뿐이다)
      while (j > 0 && XS[j - 1] > x) { XS[j] = XS[j - 1]; WS[j] = WS[j - 1]; j--; }
      XS[j] = x; WS[j] = w;
    }
    if (nx < 2) continue;
    let wind = 0, la = 0, lb = -1e9;
    for (let i = 0; i < nx - 1; i++) {
      wind = evenodd ? wind ^ 1 : wind + WS[i];
      if (wind === 0) continue;
      const a = Math.ceil(XS[i] - 0.5), b = Math.floor(XS[i + 1] - 0.5) + 1;
      if (b <= a) continue;
      if (a <= lb) { lb = Math.max(lb, b); continue; } // 앞 구간과 이어 붙인다
      if (lb > -1e9) pushSpan(y, la, lb);
      la = a; lb = b;
    }
    if (lb > -1e9) pushSpan(y, la, lb);
  }
}
// 버퍼의 구간들을 줄 · 왼쪽 순으로 정렬해 겹친 것을 합친다 (여러 도형을 겹친 선)
function mergeAll() {
  if (SN < 2) return;
  const idx = new Array(SN);
  for (let i = 0; i < SN; i++) idx[i] = i;
  idx.sort((p, q) => (SB[p * 3] - SB[q * 3]) || (SB[p * 3 + 1] - SB[q * 3 + 1]));
  const out = [];
  for (const i of idx) {
    const y = SB[i * 3], a = SB[i * 3 + 1], b = SB[i * 3 + 2], L = out.length;
    if (L && out[L - 3] === y && a <= out[L - 1]) out[L - 1] = Math.max(out[L - 1], b); else out.push(y, a, b);
  }
  SN = 0;
  for (let i = 0; i < out.length; i += 3) pushSpan(out[i], out[i + 1], out[i + 2]);
}
function dot(x, y, r, cap) { // 선 끝 · 마디를 메우는 작은 원 (8각형)
  if (cap === 'square') return [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
  const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } return pts;
}

// 도트 그라데이션: 색 단계를 기억해 두고, 칸의 위치(t)마다 띠 색을 돌려준다
class PxGrad {
  constructor(kind, a) { this.kind = kind; this.a = a; this.stops = []; this.cache = new Map(); }
  addColorStop(o, col) { this.stops.push([Math.max(0, Math.min(1, o)), parseColor(col)]); this.stops.sort((p, q) => p[0] - q[0]); this.cache.clear(); this._sigN = null; }
  maxA() { return this.stops.reduce((m, [, c]) => Math.max(m, c[3]), 0); }
  sigN() { if (!this._sigN) { const mx = this.maxA() || 1; this._sigN = this.stops.map(([o, c]) => `${Math.round(o * 20)}:${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.round((c[3] / mx) * 16)}`).join(';'); } return this._sigN; }
  size() { const a = this.a; return this.kind === 'r' ? Math.max(a[2], a[5]) * 2 : Math.hypot(a[2] - a[0], a[3] - a[1]); }
  t(x, y) {
    const a = this.a;
    if (this.kind === 'l') { const dx = a[2] - a[0], dy = a[3] - a[1], L2 = dx * dx + dy * dy || 1; return Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); }
    const x0 = a[0], y0 = a[1], r0 = a[2], x1 = a[3], y1 = a[4], r1 = a[5];
    if (x0 === x1 && y0 === y1) { const dr = r1 - r0 || 1e-6; return Math.max(0, Math.min(1, (Math.hypot(x - x1, y - y1) - r0) / dr)); }
    // 두 원 사이의 그라데이션 (가운데가 치우친 빛): |p - (c0 + t·dc)| = r0 + t·dr 의 큰 근
    const cdx = x - x0, cdy = y - y0, dcx = x1 - x0, dcy = y1 - y0, dr = r1 - r0;
    const A = dcx * dcx + dcy * dcy - dr * dr, B = cdx * dcx + cdy * dcy + r0 * dr, C = cdx * cdx + cdy * cdy - r0 * r0;
    let t;
    if (Math.abs(A) < 1e-9) t = C / (2 * B || 1e-9);
    else { const D = B * B - A * C; if (D < 0) return 1; const sq = Math.sqrt(D); t = (B + sq) / A; if (r0 + t * dr < 0) t = (B - sq) / A; }
    return Math.max(0, Math.min(1, t));
  }
  rgba(k, N) { // 띠 k의 색 [r, g, b, 0~255] (투명하면 null)
    const key = k * 8 + N;
    if (this.cache.has(key)) return this.cache.get(key);
    const col = this.at(k >= N ? 1 : (k + 0.5) / N), out = col[3] < 0.012 ? null : [col[0] | 0, col[1] | 0, col[2] | 0, Math.round(Math.min(1, col[3]) * 255)];
    this.cache.set(key, out);
    return out;
  }
  at(t) {
    const S = this.stops;
    if (!S.length) return [0, 0, 0, 0];
    if (t <= S[0][0]) return S[0][1];
    for (let i = 1; i < S.length; i++) if (t <= S[i][0]) { const [o0, c0] = S[i - 1], [o1, c1] = S[i], k = (t - o0) / (o1 - o0 || 1); return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k, c0[3] + (c1[3] - c0[3]) * k]; }
    return S[S.length - 1][1];
  }
  mid() { const c = this.at(0.3); return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.min(1, c[3]).toFixed(3)})`; }
}
const COLOR_CACHE = new Map();
function parseColor(s) {
  const hit = COLOR_CACHE.get(s);
  if (hit) return hit;
  let out = [0, 0, 0, 0];
  const t = String(s).trim();
  if (t[0] === '#') {
    if (t.length === 4) out = [parseInt(t[1] + t[1], 16), parseInt(t[2] + t[2], 16), parseInt(t[3] + t[3], 16), 1];
    else { const n = parseInt(t.slice(1, 7), 16), a = t.length >= 9 ? parseInt(t.slice(7, 9), 16) / 255 : 1; out = [n >> 16, (n >> 8) & 255, n & 255, a]; }
  } else {
    const m = t.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(',').map((v) => parseFloat(v)); out = [p[0] || 0, p[1] || 0, p[2] || 0, p.length > 3 ? p[3] : 1]; }
  }
  if (COLOR_CACHE.size > 4000) COLOR_CACHE.clear();
  COLOR_CACHE.set(s, out);
  return out;
}

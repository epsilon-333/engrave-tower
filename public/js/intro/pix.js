// 인트로용 도트 붓: 320×180 판 위에 칸 단위로 그린다 (PixelCtx가 원 · 다각형 · 선 · 그라데이션을 칸에 맞춰 준다)
export const IW = 320, IH = 180;
export const H = (a, b = 0, c = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a)); // t가 [a, b] 사이 어디쯤 (0~1)
export const eOut = (k) => 1 - (1 - k) ** 3;
export const eIn = (k) => k * k * k;
export const eIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const hexA = (hex, a) => { const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a)})`; };

export const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
export const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
export function poly(g, pts, c) { if (pts.length < 3) return; g.fillStyle = c; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); }
export function circ(g, x, y, r, c) { if (r <= 0) return; g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
export function ell(g, x, y, rx, ry, c) { if (rx <= 0 || ry <= 0) return; g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
export function line(g, x0, y0, x1, y1, c, w = 1) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
export function path(g, pts, c, w = 1) { if (pts.length < 2) return; g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }
// 위아래 그라데이션 (띠 + 바둑판 점묘)
export function vgrad(g, y0, y1, stops, x0 = 0, x1 = IW) { const gr = g.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) gr.addColorStop(o, c); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
// 둥근 빛 (도트 띠로 번진다). add면 더하기로
export function glow(g, x, y, r, col, a = 1, add = true) {
  if (a <= 0.01 || r < 1) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, hexA(col, a)); gr.addColorStop(0.4, hexA(col, a * 0.45)); gr.addColorStop(1, hexA(col, 0));
  if (add) g.globalCompositeOperation = 'lighter';
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  g.globalCompositeOperation = 'source-over';
}
// 점들을 (cx, cy) 둘레로 돌린다 · 옮기고 키운다
export const rot = (pts, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); };
export const tf = (pts, ox, oy, s = 1, flip = 1) => pts.map(([x, y]) => [ox + x * s * flip, oy + y * s]);
// 실루엣 + 테두리빛: 빛 쪽으로 한 칸 밝은 띠가 남는다 (dx, dy는 그림자 쪽)
export function sil(g, pts, dark, rim, dx = 1, dy = 0) { if (rim) poly(g, pts, rim); poly(g, rim ? pts.map(([x, y]) => [x + dx, y + dy]) : pts, dark); }
// 테두리빛 실루엣 (여러 도형): 한 번은 빛 색으로, (dx, dy)만큼 옮겨 어두운 색으로 다시 그린다
export function rimmed(g, rim, dark, dx, dy, fn) { if (rim) fn(rim); g.save(); g.translate(dx, dy); fn(dark); g.restore(); }
export const bz2 = (p0, p1, p2, u) => { const a = 1 - u; return [a * a * p0[0] + 2 * a * u * p1[0] + u * u * p2[0], a * a * p0[1] + 2 * a * u * p1[1] + u * u * p2[1]]; };
export const bz3 = (p0, p1, p2, p3, u) => { const a = 1 - u; return [a * a * a * p0[0] + 3 * a * a * u * p1[0] + 3 * a * u * u * p2[0] + u * u * u * p3[0], a * a * a * p0[1] + 3 * a * a * u * p1[1] + 3 * a * u * u * p2[1] + u * u * u * p3[1]]; };
// 인물을 발밑 (ox, oy) 기준으로 s배 키워 그린다 · 그 안의 점을 화면 좌표로
export function big(g, ox, oy, s, fn) { g.save(); g.translate(ox, oy); g.scale(s, s); g.translate(-ox, -oy); fn(); g.restore(); }
export const bp = (ox, oy, s, p) => [ox + (p[0] - ox) * s, oy + (p[1] - oy) * s];
// 역광 실루엣: 빛이 뒤에서 오면 양옆과 위 가장자리가 모두 밝다
export function rim2(g, rim, dark, fn) { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) { g.save(); g.translate(dx, dy); fn(rim); g.restore(); } fn(dark); }
// 화면 흔들림: t0부터 d초 동안 amp칸에서 줄어든다
export const shakeAt = (t, t0, d, amp) => { const k = t - t0; if (k < 0 || k > d) return [0, 0]; const a = amp * (1 - k / d), f = Math.floor(t * 40); return [Math.round((H(f, 7) - 0.5) * 2 * a), Math.round((H(f, 8) - 0.5) * 2 * a)]; };
// 일렁이는 불 혀 (바깥 붉은 불 → 주황 → 노란 속불)
export function tongue(g, x, y, h, w, t, seed, cols = ['#b8280a', '#ff6a1a', '#ffc848']) {
  const hk = 0.8 + 0.35 * H(Math.floor(t * 14), seed);
  cols.forEach((c, li) => {
    const k = 1 - li * 0.3, hh = h * k * hk, ww = w * k, sw = Math.sin(t * 8 + seed) * ww * 1.2, L = [], R = [];
    for (let i = 0; i <= 7; i++) { const s = i / 7, hw = ww * Math.pow(1 - s, 0.85), cx = x + sw * s * s, yy = y - hh * s; L.push([cx - hw, yy]); R.push([cx + hw, yy]); }
    poly(g, [[x, y + ww * 0.3], ...L, ...R.reverse()], c);
  });
}
// 별 하늘: 반짝임은 시간에 따라
export function stars(g, n, seed, ymax, t, bright = 1) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(H(i, seed) * IW), y = Math.floor(H(i, seed + 1) * ymax), b = H(i, seed + 2), tw = 0.5 + 0.5 * Math.sin(t * (1.2 + b * 3) + i * 1.7);
    if (b > 0.94) { px(g, x, y, '#ffffff'); if (tw > 0.55) { const c = hexA('#a0b0e0', 0.8 * bright); px(g, x - 1, y, c); px(g, x + 1, y, c); px(g, x, y - 1, c); px(g, x, y + 1, c); } }
    else px(g, x, y, hexA(b > 0.6 ? '#d0d8f8' : '#8090c0', (0.25 + 0.6 * tw) * bright));
  }
}
// 바둑판 문턱 (4×4)
export const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const patCache = new Map();
// 화면 전체를 col로 a만큼 덮는다 (도트식 점묘 전환)
export function cover(raw, a, col = '#000000') {
  const n = Math.round(clamp(a) * 16);
  if (n <= 0) return;
  if (n >= 16) { raw.fillStyle = col; raw.fillRect(0, 0, IW, IH); return; }
  const key = n + col;
  let pat = patCache.get(key);
  if (!pat) { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = col; for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) if (BAY[yy][xx] < n) x.fillRect(xx, yy, 1, 1); pat = raw.createPattern(c, 'repeat'); patCache.set(key, pat); }
  raw.fillStyle = pat; raw.fillRect(0, 0, IW, IH);
}
// 종족 각인 (9×9 문양)
export const GLYPHS = {
  wizard: ['....#....', '....#....', '..#.#.#..', '...###...', '#########', '...###...', '..#.#.#..', '....#....', '....#....'],
  elf: ['....#....', '...###...', '..##.##..', '.##.#.##.', '.#..#..#.', '.##.#.##.', '..##.##..', '...###...', '....#....'],
  knight: ['#########', '#...#...#', '#...#...#', '#########', '#...#...#', '.#..#..#.', '..#.#.#..', '...###...', '....#....'],
  orc: ['#.......#', '##.....##', '.#.....#.', '.##...##.', '..#####..', '..#.#.#..', '..#####..', '...#.#...', '...#.#...'],
  undead: ['..#####..', '.#######.', '##..#..##', '##..#..##', '#########', '.###.###.', '..#####..', '..#.#.#..', '.........'],
  assassin: ['....#....', '....#....', '...###...', '.#######.', '##.###.##', '.#######.', '...###...', '....#....', '....#....'],
  dino: ['#...#...#', '#...#...#', '##..#..##', '.##.#.##.', '..#####..', '...###...', '...###...', '....#....', '.........'],
  dragon: ['....#....', '...##....', '...###...', '..####.#.', '..#####..', '.###.###.', '.##...##.', '.##...##.', '..#####..'],
};
export const RACE_COL = { wizard: '#b58aff', elf: '#7be38a', knight: '#ffd76a', orc: '#ff5a3a', undead: '#7ae8ff', assassin: '#a68aff', dino: '#c8e85a', dragon: '#ff8a3a' };
export function glyph(g, race, cx, cy, s, a = 1, col = RACE_COL[race]) {
  if (a <= 0.02) return;
  const G = GLYPHS[race], x0 = Math.round(cx - 4.5 * s), y0 = Math.round(cy - 4.5 * s);
  glow(g, cx, cy, 9 * s, col, 0.55 * a);
  g.globalAlpha = a;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (G[y][x] === '#') rect(g, x0 + x * s - 1, y0 + y * s - 1, s + 2, s + 2, '#0a0610');
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (G[y][x] === '#') rect(g, x0 + x * s, y0 + y * s, s, s, y < 4 ? '#ffffff' : col);
  g.globalAlpha = 1;
}

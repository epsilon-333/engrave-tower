// 도트 입자: 불꽃 혀 · 연기 · 먼지 덩이 · 반짝이 빛을 손으로 찍은 듯한 작은 도트 그림으로 만든다.
// 크기 · 색 · 모양마다 한 번만 그려 두고 다시 쓴다 (네모 · 동그라미 입자 대신).
const cache = new Map();
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rgbOf = (hex) => { const n = parseInt(String(hex || '#ffffff').slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const shade = ([r, g, b], k) => [Math.max(0, Math.min(255, r + k)), Math.max(0, Math.min(255, g + k)), Math.max(0, Math.min(255, b + k))];
const H = (a, b, c = 0) => { let h = (Math.imul(a + 7, 374761393) + Math.imul(b + 3, 668265263) + Math.imul(c + 1, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function paint(w, h, fn) { // fn(x, y) → [r,g,b,a] 또는 null
  const c = canvasOf(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = fn(x, y); if (!p) continue; const i = (y * w + x) * 4; d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = p[3] ?? 255; }
  g.putImageData(img, 0, 0);
  return c;
}

// 불꽃 혀: 둥근 밑동 · 위로 갈라지는 끝 · 가운데가 가장 밝다. heat 0(희게 뜨거움) ~ 3(식어서 연기)
const FLAME = [
  ['#fff6d0', '#ffd040', '#ff8a1a', '#e0401a'],
  ['#ffe080', '#ffa030', '#f0601a', '#b8301a'],
  ['#ff9a30', '#e8501a', '#b8301a', '#6a2a1e'],
  ['#7a6a66', '#62544f', '#4e4240', '#3a3030'],
].map((row) => row.map(rgbOf));
export function flameSprite(R, frame, heat) {
  R = Math.max(1, Math.min(8, R | 0)); frame &= 3; heat = Math.max(0, Math.min(3, heat | 0));
  const key = `f${R}|${frame}|${heat}`;
  let c = cache.get(key);
  if (c) return c;
  const w = R * 2 + 1, h = Math.round(R * 2.7) + 2, cx = R + 0.5, cy = h - R - 0.5, tip = 1.5 + 0.35 * H(frame, R, 1);
  const pal = FLAME[heat];
  c = paint(w, h, (x, y) => {
    const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / R;
    const sway = Math.sin(dy * 2.4 + frame * 1.7) * 0.22 * Math.max(0, -dy);
    let inside;
    if (dy >= 0) inside = dx * dx + dy * dy <= 1.02;
    else { const half = (1 - Math.pow(-dy / tip, 1.15)) * (1 - 0.18 * H(y, frame, 2)); inside = Math.abs(dx - sway) <= half; }
    if (!inside) return null;
    const d = Math.hypot(dx - sway * 0.6, (dy - 0.15) * 0.75);
    const z = d < 0.32 ? 0 : d < 0.58 ? 1 : d < 0.84 ? 2 : 3;
    return pal[R <= 1 ? Math.min(3, z + 1) : z];
  });
  cache.set(key, c);
  return c;
}
// 연기 · 먼지 덩이: 서너 개의 둥근 덩이가 뭉친 울퉁불퉁한 구름. 위 왼쪽은 밝고 아래 오른쪽은 그늘
export function puffSprite(R, hex, v = 0) {
  R = Math.max(1, Math.min(14, R | 0)); v &= 3;
  const key = `p${R}|${hex}|${v}`;
  let c = cache.get(key);
  if (c) return c;
  const base = rgbOf(hex), hi = shade(base, 30), lo = shade(base, -28);
  const lobes = [[0, 0, 1], [-0.55 - 0.1 * H(v, 1), 0.2, 0.7], [0.55 + 0.1 * H(v, 2), 0.25, 0.68], [0.12 - 0.2 * H(v, 3), -0.45, 0.62]];
  const w = Math.ceil(R * 3.4) + 2, h = Math.ceil(R * 2.6) + 2, ox = w / 2, oy = h / 2 + R * 0.12;
  const inAny = (px, py) => lobes.some(([lx, ly, lr]) => (px - lx) ** 2 + (py - ly) ** 2 <= lr * lr);
  c = paint(w, h, (x, y) => {
    const px = (x + 0.5 - ox) / R, py = (y + 0.5 - oy) / R;
    if (R === 1) { if (Math.abs(px) + Math.abs(py) > 1.1) return null; return base; }
    if (!inAny(px, py)) return null;
    const e = 1 / R; // 한 칸
    const lit = !inAny(px - e, py - e), dark = !inAny(px + e, py + e);
    return lit ? hi : dark ? lo : base;
  });
  cache.set(key, c);
  return c;
}
// 반짝이: 밝은 심 + 십자 빛살 (작은 것은 + 모양, 큰 것은 마름모 심에 긴 빛살)
export function sparkSprite(size, hex) {
  size = Math.max(1, Math.min(3, size | 0));
  const key = `s${size}|${hex}`;
  let c = cache.get(key);
  if (c) return c;
  const col = rgbOf(hex), core = shade(col, 90).map((v, i) => Math.round((v + 255) / 2));
  const S = size * 2 + 3, m = (S - 1) / 2;
  c = paint(S, S, (x, y) => {
    const dx = Math.abs(x - m), dy = Math.abs(y - m);
    if (dx + dy <= size - 1) return [...core, 255];
    if ((dx === 0 || dy === 0) && dx + dy <= size + 1) return [...col, dx + dy === size + 1 ? 110 : 200];
    if (size >= 2 && dx === 1 && dy === 1) return [...col, 90];
    return null;
  });
  cache.set(key, c);
  return c;
}
// 발 먼지: 처음엔 뭉친 흙 몇 칸 → 퍼지며 → 듬성듬성 흩어진다 (단계 3개, 같은 모양이 커지기만 해서 깜빡이지 않는다)
export function dustSprite(stage, hex, v = 0) {
  stage = Math.max(0, Math.min(2, stage | 0)); v &= 3;
  const key = `d${stage}|${hex}|${v}`;
  let c = cache.get(key);
  if (c) return c;
  const base = rgbOf(hex), hi = shade(base, 26), lo = shade(base, -18);
  const rx = [1.6, 2.6, 3.4][stage], ry = [1.1, 1.6, 2][stage], keep = [1, 0.72, 0.4][stage];
  const w = Math.ceil(rx * 2) + 2, h = Math.ceil(ry * 2) + 2, cx = w / 2, cy = h / 2;
  c = paint(w, h, (x, y) => {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
    if (d > 1) return null;
    if (H(x, y, v + 11) > keep * (1.15 - d * 0.5)) return null; // 바깥으로 갈수록, 늦을수록 성기게
    return dy < -0.3 ? hi : dy > 0.4 ? lo : base;
  });
  cache.set(key, c);
  return c;
}
// 빛 번짐 디더링에 쓰는 4×4 바둑 문턱값 (0~1)
export const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16));

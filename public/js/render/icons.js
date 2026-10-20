// 물건 · 도구 · 유물 아이콘 (16×16 도트). 평평한 모양을 그린 뒤 가장자리에 빛·그늘을 넣고 검은 외곽선을 두른다.
import { GOODS, TOOLS, TOOL_COLOR, ARTIFACTS } from '../data/goods.js';
import { registerDish } from '../data/cooking.js';

const OL = '#1a1410';
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function mix(a, b, k) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k); }
const lighter = (c, k = 0.35) => mix(c, '#ffffff', k), darker = (c, k = 0.35) => mix(c, '#000000', k);

// 작은 도트 화폭
class Pix {
  constructor(n = 16) { this.n = n; this.c = new Array(n * n).fill(null); }
  set(x, y, col) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.n && y < this.n) this.c[y * this.n + x] = col; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.n && y < this.n ? this.c[y * this.n + x] : null; }
  rect(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col); }
  ellipse(cx, cy, rx, ry, col) { for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.set(x, y, col); }
  circle(cx, cy, r, col) { this.ellipse(cx, cy, r, r, col); }
  poly(pts, col) {
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
      const px = x + 0.5, py = y + 0.5; let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y, col);
    }
  }
  line(x0, y0, x1, y1, col, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; this.rect(Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), w, w, col); }
  }
  // 위·왼쪽 가장자리는 밝게, 아래·오른쪽은 어둡게
  bevel(kl = 0.32, kd = 0.3) {
    const src = this.c.slice(), n = this.n, at = (x, y) => (x >= 0 && y >= 0 && x < n && y < n ? src[y * n + x] : null);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = src[y * n + x]; if (!v) continue;
      if (!at(x, y - 1) || !at(x - 1, y)) this.c[y * n + x] = lighter(v, kl);
      else if (!at(x, y + 1) || !at(x + 1, y)) this.c[y * n + x] = darker(v, kd);
    }
  }
  outline(col = OL) {
    const src = this.c.slice(), n = this.n, at = (x, y) => (x >= 0 && y >= 0 && x < n && y < n ? src[y * n + x] : null);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!src[y * n + x] && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) this.c[y * n + x] = col;
  }
  canvas() {
    const cv = document.createElement('canvas'); cv.width = cv.height = this.n;
    const g = cv.getContext('2d');
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) { const v = this.c[y * this.n + x]; if (v) { g.fillStyle = v; g.fillRect(x, y, 1, 1); } }
    return cv;
  }
}

// ───── 모양별 그림 ─────
const DRAW = {
  ore(P, [rock, ore, hi]) {
    P.ellipse(8, 9, 6.5, 5.2, rock); P.ellipse(6.5, 7.5, 3.5, 2.6, rock); P.bevel(0.3, 0.32);
    for (const [x, y] of [[5, 7], [9, 9], [6, 11], [11, 7]]) { P.rect(x, y, 2, 2, ore); P.set(x, y, hi); }
    P.set(8, 6, ore); P.set(12, 10, ore);
    P.outline();
  },
  crystal(P, [main, light, dark]) {
    P.poly([[3, 14], [3, 8], [5, 5], [7, 8], [7, 14]], main); P.poly([[7, 14], [7, 5], [9.5, 1], [12, 5], [12, 14]], main); P.poly([[11, 14], [11, 9], [13, 7], [15, 9], [15, 14]], dark);
    P.bevel(0.35, 0.3);
    for (let y = 4; y < 13; y++) P.set(8, y, light); for (let y = 8; y < 13; y++) P.set(4, y, light);
    P.set(9, 3, '#ffffff'); P.set(8, 5, '#ffffff');
    P.outline();
  },
  shard(P, [main, light, dark]) {
    P.poly([[2, 11], [6, 3], [11, 2], [14, 7], [10, 14], [4, 14]], main); P.poly([[9, 8], [14, 7], [10, 14]], dark); P.bevel(0.25, 0.25);
    P.line(5, 10, 9, 4, light); P.set(7, 6, '#ffffff');
    P.outline();
  },
  gem(P, [main, light, dark]) {
    P.poly([[3, 6], [6, 3], [10, 3], [13, 6], [8, 14]], main);
    P.poly([[3, 6], [13, 6], [10, 3], [6, 3]], light); P.poly([[8, 14], [13, 6], [9, 6]], dark);
    for (let x = 4; x < 13; x++) P.set(x, 6, lighter(main, 0.15));
    P.set(6, 4, '#ffffff'); P.set(5, 5, '#ffffff'); P.set(7, 8, lighter(light, 0.3));
    P.outline();
  },
  pearl(P, [main, light, dark]) { P.circle(8, 8.5, 5, main); P.bevel(0.2, 0.35); P.rect(5, 5, 2, 2, '#ffffff'); P.set(10, 11, dark); P.outline(); },
  log(P, [bark, wood, ring]) {
    P.rect(2, 6, 10, 7, bark); P.bevel(0.25, 0.35);
    for (const x of [4, 7, 10]) P.set(x, 8, darker(bark, 0.3));
    P.set(5, 11, darker(bark, 0.3)); P.set(9, 10, darker(bark, 0.3));
    P.ellipse(12, 9.5, 2.6, 3.6, wood); P.set(12, 9, ring); P.set(12, 10, ring); P.set(11, 8, ring); P.set(13, 11, ring);
    P.outline();
  },
  leaf(P, [g, light, dark]) {
    P.line(8, 14, 8, 5, dark);
    P.poly([[8, 9], [3, 6], [2, 3], [6, 4]], g); P.poly([[8, 7], [13, 4], [14, 1], [10, 2]], g); P.poly([[8, 12], [13, 10], [15, 7], [10, 8]], g); P.poly([[8, 11], [3, 10], [1, 8], [5, 7]], g);
    P.bevel(0.3, 0.25);
    P.line(8, 9, 4, 5, light); P.line(8, 7, 12, 3, light);
    P.outline();
  },
  mushroom(P, [cap, spot, stem]) {
    P.ellipse(8, 9, 6.2, 5.4, cap);
    for (let y = 9; y < 16; y++) for (let x = 0; x < 16; x++) P.set(x, y, null); // 갓은 위쪽 반만
    P.rect(6, 9, 4, 5, stem);
    P.bevel(0.3, 0.3);
    P.rect(5, 5, 2, 2, spot); P.rect(10, 6, 2, 1, spot); P.set(8, 4, spot); P.rect(6, 9, 4, 1, darker(stem, 0.25));
    P.outline();
  },
  berry(P, [red, light, leaf]) {
    P.circle(6, 10, 3, red); P.circle(10, 10.5, 3, red); P.circle(8, 7, 3, red); P.bevel(0.3, 0.35);
    P.set(7, 6, light); P.set(5, 9, light); P.set(9, 9, light);
    P.poly([[8, 4], [11, 1], [13, 3], [10, 5]], leaf); P.line(8, 5, 8, 3, darker(leaf, 0.3));
    P.outline();
  },
  flower(P, [petal, center, stemC]) {
    P.line(8, 15, 8, 8, '#3e8a32'); P.poly([[8, 12], [11, 9], [13, 10], [10, 13]], '#3e8a32');
    for (const [x, y] of [[8, 3.5], [11.5, 6], [10.5, 9.5], [5.5, 9.5], [4.5, 6]]) P.circle(x, y, 2.3, petal);
    P.bevel(0.3, 0.25); P.circle(8, 7, 1.6, center); P.set(9, 8, stemC);
    P.outline();
  },
  truffle(P, [main, light, dark]) { P.ellipse(8, 9, 5.5, 4.5, main); P.circle(5, 8, 2.5, main); P.circle(11, 7.5, 2.5, main); P.bevel(0.25, 0.35); for (const [x, y] of [[6, 9], [9, 7], [10, 11], [5, 11]]) P.set(x, y, dark); P.set(6, 6, light); P.outline(); },
  weed(P, [main, light, dark]) {
    for (const [x0, ph] of [[5, 0], [8, 1.5], [11, 0.7]]) for (let y = 3; y < 15; y++) { const x = x0 + Math.round(Math.sin(y * 0.7 + ph) * 1.2); P.set(x, y, main); P.set(x + 1, y, y % 3 ? main : light); }
    P.bevel(0.25, 0.25); P.outline();
  },
  coral(P, [main, light, dark]) {
    P.line(8, 14, 8, 6, main, 2); P.line(8, 10, 4, 6, main, 2); P.line(4, 6, 4, 3, main, 2); P.line(9, 8, 12, 5, main, 2); P.line(12, 5, 12, 2, main, 2); P.line(6, 8, 6, 5, main);
    P.bevel(0.3, 0.3); P.rect(5, 14, 7, 1, dark); P.outline();
  },
  shell(P, [main, light, dark]) {
    P.poly([[2, 12], [8, 2], [14, 12]], main); P.ellipse(8, 12, 6, 2, main); P.bevel(0.3, 0.3);
    for (const x of [5, 8, 11]) P.line(8, 3, x, 12, dark);
    P.outline();
  },
  worm(P, [main, light, dark]) { for (let x = 2; x < 14; x++) { const y = 8 + Math.round(Math.sin(x * 0.75) * 2.5); P.rect(x, y, 1, 2, main); } P.bevel(0.25, 0.3); P.set(13, 7 + Math.round(Math.sin(13 * 0.75) * 2.5), '#1a1410'); P.outline(); },
  lump(P, [main, light, dark]) { P.ellipse(8, 10, 6, 4, main); P.ellipse(7, 8, 3.5, 2.5, main); P.bevel(0.3, 0.35); P.set(10, 10, dark); P.set(5, 11, dark); P.outline(); },
  coin(P, [main, light, dark]) {
    P.circle(8, 8, 5.6, main); P.bevel(0.35, 0.4); P.ellipse(8, 8, 3.2, 3.2, darker(main, 0.15));
    P.rect(7, 6, 2, 4, light); P.rect(6, 7, 4, 2, light); P.set(5, 4, '#ffffff');
    P.outline();
  },
  bone(P, [main, light, dark]) { P.line(4, 11, 11, 4, main, 2); for (const [x, y] of [[3, 11], [4, 12], [11, 3], [12, 4]]) P.circle(x + 0.5, y + 0.5, 1.6, main); P.bevel(0.2, 0.3); P.outline(); },
  boot(P, [main, light, dark]) { P.poly([[4, 2], [9, 2], [9, 10], [14, 11], [14, 14], [3, 14]], main); P.bevel(0.25, 0.35); P.rect(4, 3, 5, 1, dark); P.set(12, 12, light); P.outline(); },
  bottle(P) { P.rect(5, 5, 6, 9, '#8ac8b8'); P.rect(7, 2, 2, 3, '#8ac8b8'); P.rect(6, 1, 4, 1, '#8a6a4a'); P.bevel(0.35, 0.3); P.rect(7, 7, 2, 5, '#f4e8c8'); P.set(6, 6, '#ffffff'); P.outline(); },
  fish(P, [body, back, belly], shape = 'normal') {
    if (shape === 'long') {
      for (let x = 1; x < 14; x++) { const y = 8 + Math.round(Math.sin(x * 0.55) * 1.3); P.rect(x, y - 1, 1, 3, body); P.set(x, y - 1, back); }
      P.bevel(0.25, 0.3); P.set(13, 7 + Math.round(Math.sin(13 * 0.55) * 1.3), '#ffffff'); P.outline(); return;
    }
    if (shape === 'horse') {
      P.circle(9, 4, 2.2, body); P.line(9, 5, 8, 11, body, 3); P.line(8, 11, 10, 13, body, 2); P.set(11, 13, body); P.line(11, 4, 13, 4, body);
      P.bevel(0.3, 0.3); P.set(9, 3, '#1a1410'); for (let y = 6; y < 11; y++) P.set(7, y, back); P.outline(); return;
    }
    if (shape === 'flat') { // 가자미: 납작한 몸, 두 눈이 위쪽에
      P.ellipse(8, 9, 6.5, 4.2, body); P.poly([[1.5, 6], [3.5, 9], [1.5, 12]], back);
      for (let x = 3; x < 14; x++) { P.set(x, Math.round(9 - Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 8) / 6.5) ** 2)) * 4.2), back); P.set(x, Math.round(9 + Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 8) / 6.5) ** 2)) * 4.2) - 1, back); }
      P.bevel(0.25, 0.3);
      for (const [x, y] of [[6, 8], [9, 10], [7, 11], [10, 7]]) P.set(x, y, darker(body, 0.2));
      P.set(11, 7, '#ffffff'); P.set(12, 8, '#ffffff'); P.set(11, 8, '#1a1410'); P.set(12, 9, '#1a1410');
      P.outline(); return;
    }
    if (shape === 'squid') { // 오징어: 세모 지느러미 몸통 + 다리
      P.poly([[8, 1], [11, 4], [10, 9], [6, 9], [5, 4]], body); P.poly([[8, 1], [12, 3], [11, 5]], back); P.poly([[8, 1], [4, 3], [5, 5]], back);
      for (const x of [6, 7, 9, 10]) P.line(x, 9, x + (x < 8 ? -1 : 1), 14, body);
      P.line(8, 9, 8, 15, back);
      P.bevel(0.3, 0.25); P.set(7, 7, '#1a1410'); P.set(9, 7, '#1a1410'); P.outline(); return;
    }
    if (shape === 'octopus') { // 문어: 둥근 머리 + 구불구불한 다리
      P.ellipse(8, 5.5, 4.6, 4.2, body);
      for (let i = 0; i < 5; i++) { const x0 = 4.5 + i * 1.8; for (let k = 0; k < 6; k++) P.set(x0 + Math.sin(k * 0.9 + i) * 1.1 + (i - 2) * k * 0.25, 9 + k, k % 2 ? body : back); }
      P.bevel(0.3, 0.3); P.set(6, 6, '#ffffff'); P.set(10, 6, '#ffffff'); P.set(6, 7, '#1a1410'); P.set(10, 7, '#1a1410'); P.outline(); return;
    }
    if (shape === 'crab') { // 게: 넓은 등딱지 + 집게 + 다리
      P.ellipse(8, 9.5, 5.5, 3.6, body);
      P.circle(2.5, 5, 2, body); P.circle(13.5, 5, 2, body); P.set(2, 3, back); P.set(14, 3, back);
      P.line(3, 6, 4, 8, body); P.line(13, 6, 12, 8, body);
      for (const [x, d] of [[4, -1], [6, -1], [10, 1], [12, 1]]) P.line(x, 12, x + d * 1.5, 14, back);
      P.bevel(0.3, 0.3); P.set(6, 7, '#1a1410'); P.set(10, 7, '#1a1410'); P.rect(6, 6, 1, 1, '#ffffff'); P.rect(10, 6, 1, 1, '#ffffff');
      P.set(7, 10, lighter(body, 0.4)); P.outline(); return;
    }
    if (shape === 'sun') { // 개복치: 크고 둥근 몸, 위아래 긴 지느러미
      P.ellipse(8, 8, 5.2, 5.6, body); P.poly([[8, 3], [10, -0.5], [11, 3]], back); P.poly([[8, 13], [10, 16.5], [11, 13]], back); P.rect(2, 6, 2, 5, back);
      P.bevel(0.3, 0.3); P.set(11, 7, '#ffffff'); P.set(11, 8, '#1a1410'); P.line(10, 10, 12, 10, darker(body, 0.3)); P.outline(); return;
    }
    if (shape === 'angler') { // 아귀: 큰 머리 · 이빨 · 빛나는 미끼
      P.ellipse(8.5, 9.5, 5.8, 4.6, body); P.poly([[1, 6], [3.5, 9.5], [1, 13]], back);
      P.line(9, 5, 11, 1, back); P.line(11, 1, 13, 2, back); P.circle(13.5, 3, 1.4, belly);
      P.bevel(0.25, 0.35);
      for (const x of [9, 11, 13]) P.set(x, 11, '#ffffff'); P.line(8, 11, 14, 11, darker(body, 0.4)); for (const x of [9, 11, 13]) P.set(x, 11, '#f4f0e8');
      P.set(11, 7, '#ffe080'); P.set(11, 8, '#1a1410'); P.outline(); return;
    }
    if (shape === 'marlin') { // 청새치: 긴 부리 · 높은 돛 지느러미
      P.ellipse(8, 9, 5.5, 2.6, body); P.poly([[2, 6], [4, 9], [2, 12]], back); P.line(13, 9, 16, 8, belly);
      P.poly([[5, 7], [7, 1.5], [11, 2.5], [11, 7]], back);
      P.bevel(0.3, 0.3); for (let x = 5; x < 12; x++) P.set(x, 10, belly); P.set(12, 8, '#ffffff'); P.set(12, 9, '#1a1410'); P.outline(); return;
    }
    if (shape === 'axolotl') { // 도롱뇽: 넓은 머리 + 아가미 깃털 + 꼬리
      P.ellipse(5.5, 8, 3.5, 3, body); P.ellipse(10, 9, 4, 2.2, body); P.poly([[13, 8], [16, 6.5], [15, 10]], body);
      for (const [x, y] of [[2, 4], [1, 7], [2, 11]]) P.line(x + 1, y, x + 3, y + (y < 8 ? 1 : y > 8 ? -1 : 0), back);
      P.line(7, 11, 6, 13, body); P.line(11, 11, 12, 13, body);
      P.bevel(0.3, 0.25); P.set(4, 7, '#1a1410'); P.set(7, 7, '#1a1410'); P.line(4, 9, 6, 9, darker(body, 0.3)); P.outline(); return;
    }
    if (shape === 'jelly') { // 해파리: 둥근 갓 + 늘어진 촉수
      P.ellipse(8, 6, 5.5, 4.2, body); for (let x = 2; x < 15; x++) for (let y = 6; y < 11; y++) if (P.get(x, y) === body && y > 7) P.set(x, y, null);
      for (const x of [4, 6, 8, 10, 12]) for (let k = 0; k < 7; k++) P.set(x + Math.round(Math.sin(k * 0.9 + x) * 0.8), 8 + k, k % 2 ? back : body);
      P.bevel(0.35, 0.2); P.set(6, 4, '#ffffff'); P.set(7, 3, '#ffffff'); P.outline(); return;
    }
    if (shape === 'shrimp') {
      for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.12); P.circle(8 + Math.cos(a) * 4.5, 9 - Math.sin(a) * 4.5, 1.7 - i * 0.08, i % 2 ? body : back); }
      P.bevel(0.3, 0.25); P.line(12, 6, 14, 2, belly); P.outline(); return;
    }
    const clown = shape === 'clown', big = shape === 'big', tall = shape === 'tall' || clown, round = shape === 'round', slim = shape === 'slim';
    const rx = big ? 6.2 : round ? 4.6 : 5.5, ry = big ? 3.6 : tall ? 4.4 : round ? 4.4 : slim ? 2.4 : 3.2, cx = round ? 8 : 7.5;
    P.poly([[2, 8 - (tall ? 4 : 3)], [5, 8], [2, 8 + (tall ? 4 : 3)]], back); // 꼬리
    P.ellipse(cx + 1.5, 8, rx, ry, body);
    P.poly([[cx, 8 - ry + 0.5], [cx + 3, 8 - ry - 1.6], [cx + 4, 8 - ry + 0.8]], back); // 등지느러미
    P.bevel(0.3, 0.32);
    for (let x = Math.ceil(cx - rx + 3); x < cx + rx; x++) { const y = Math.round(8 + ry * 0.55); if (P.get(x, y)) P.set(x, y, belly); }
    if (round) for (const [x, y] of [[5, 4], [12, 4], [4, 11], [13, 12]]) P.set(x, y, back);
    if (clown) for (const bx of [7, 11]) for (let y = 0; y < 16; y++) if (P.get(bx, y) && P.get(bx, y) !== back) { P.set(bx, y, '#ffffff'); if (P.get(bx - 1, y)) P.set(bx - 1, y, '#1a1410'); } // 흰 줄무늬
    P.set(Math.round(cx + rx - 1), 7, '#ffffff'); P.set(Math.round(cx + rx - 1), 8, '#1a1410');
    P.outline();
  },
  seed(P, [c0]) { // 끈으로 묶은 씨앗 자루 + 앞에 붙은 씨앗 그림
    P.ellipse(8, 10.5, 6, 4.6, '#d4b67e'); P.rect(6, 5, 4, 2, '#d4b67e'); P.poly([[3.5, 1.5], [12.5, 1.5], [10, 5], [6, 5]], '#d4b67e');
    P.bevel(0.3, 0.32);
    P.rect(5, 5, 6, 1, '#7a5a2e'); P.set(11, 6, '#7a5a2e'); P.set(12, 7, '#7a5a2e');
    P.circle(8, 11, 2.3, c0); P.set(7, 10, lighter(c0, 0.45)); P.set(9, 12, darker(c0, 0.3));
    P.outline();
  },
  crop(P, c, k) {
    const [a, b, leaf] = c;
    if (k === 'turnip') { P.circle(8, 10, 4.5, a); P.rect(4, 6, 9, 3, b); P.circle(8, 10, 4.5, a); for (let x = 4; x < 13; x++) for (let y = 6; y < 9; y++) if (P.get(x, y)) P.set(x, y, b); P.bevel(0.25, 0.3); P.poly([[7, 6], [4, 1], [7, 2]], leaf); P.poly([[9, 6], [12, 1], [9, 2]], leaf); P.line(8, 14, 8, 15, a); }
    else if (k === 'wheat') { for (const x0 of [5, 8, 11]) { P.line(x0, 15, x0, 6, '#b8a050'); for (let y = 2; y < 8; y++) P.set(x0 + (y % 2 ? -1 : 1), y, a), P.set(x0, y, b); } P.bevel(0.25, 0.2); }
    else if (k === 'carrot') { P.poly([[4, 5], [12, 5], [8, 15]], a); P.bevel(0.3, 0.3); for (const y of [7, 9, 11]) P.set(7 + (y % 4 ? 1 : -1), y, b); P.poly([[6, 5], [5, 1], [8, 3], [11, 0], [10, 5]], leaf); }
    else if (k === 'potato') { P.ellipse(8, 9, 6, 4.5, a); P.bevel(0.25, 0.35); for (const [x, y] of [[5, 8], [9, 7], [10, 11], [6, 11]]) P.set(x, y, b); }
    else if (k === 'strawberry') { P.poly([[3, 6], [13, 6], [12, 10], [8, 15], [4, 10]], a); P.bevel(0.3, 0.3); for (const [x, y] of [[5, 8], [8, 8], [11, 8], [6, 11], [10, 11], [8, 13]]) P.set(x, y, b); P.poly([[4, 6], [8, 3], [12, 6], [8, 5]], leaf); P.line(8, 3, 9, 1, leaf); }
    else if (k === 'pumpkin') { P.ellipse(8, 10, 7, 5, a); P.bevel(0.25, 0.35); for (const x of [5, 8, 11]) for (let y = 6; y < 15; y++) if (P.get(x, y) === a) P.set(x, y, b); P.rect(7, 3, 2, 3, leaf); P.set(9, 3, leaf); }
    else if (k === 'starflower') { const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.6 : 6.4, an = -Math.PI / 2 + i * Math.PI / 5; pts.push([8 + Math.cos(an) * r, 8 + Math.sin(an) * r]); } P.poly(pts, a); P.bevel(0.35, 0.25); P.circle(8, 8, 1.8, b); P.set(8, 7, '#ffffff'); }
    P.outline();
  },
  // 유물
  crown(P) { P.poly([[2, 13], [2, 5], [5, 9], [8, 3], [11, 9], [14, 5], [14, 13]], '#f0c040'); P.bevel(0.35, 0.35); P.rect(3, 11, 11, 1, '#b8862e'); P.set(8, 9, '#3a8ac8'); P.set(5, 11, '#e8303a'); P.outline(); },
  helm(P) { P.ellipse(8, 9, 6, 6, '#8a8e96'); P.rect(2, 9, 12, 5, '#8a8e96'); P.bevel(0.3, 0.35); P.rect(4, 9, 8, 1, '#26222a'); P.rect(7, 9, 2, 4, '#26222a'); P.set(5, 5, '#b84a2a'); P.set(10, 12, '#9a5a3a'); P.outline(); },
  pot(P) { P.ellipse(8, 10, 5.5, 4.5, '#b8724a'); P.rect(6, 3, 4, 4, '#b8724a'); P.rect(5, 2, 6, 1, '#b8724a'); P.bevel(0.3, 0.35); P.rect(4, 9, 9, 1, '#7a4a2a'); P.set(8, 11, '#e8d8b0'); P.outline(); },
  fossil(P) { P.ellipse(8, 8.5, 6.2, 5.5, '#a89a86'); P.bevel(0.25, 0.35); for (let i = 0; i < 18; i++) { const a = i * 0.55, r = 0.6 + i * 0.22; P.set(8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r, '#6a5e4e'); } P.outline(); },
  quill(P) { P.poly([[3, 14], [12, 2], [14, 3], [5, 14]], '#e8f0ff'); P.bevel(0.2, 0.3); P.line(3, 14, 12, 3, '#8ab0d8'); P.set(3, 14, '#2a3a5a'); P.outline(); },
  compass(P) { P.circle(8, 8, 6, '#c8a040'); P.bevel(0.3, 0.35); P.circle(8, 8, 4.4, '#f4ecd8'); P.line(8, 8, 11, 5, '#d83a3a'); P.line(8, 8, 5, 11, '#5a6a8a'); P.set(8, 8, '#1a1410'); P.outline(); },
  star(P) { const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.8 : 6.6, an = -Math.PI / 2 + i * Math.PI / 5; pts.push([8 + Math.cos(an) * r, 8.5 + Math.sin(an) * r]); } P.poly(pts, '#8a96b8'); P.bevel(0.35, 0.3); P.set(8, 7, '#e8f0ff'); P.outline(); },
  claw(P) { for (let i = 0; i < 9; i++) { const a = Math.PI * (0.95 - i * 0.09), r = 7; P.circle(12 + Math.cos(a) * r, 13 - Math.sin(a) * r, 2.2 - i * 0.2, '#e8dcc0'); } P.bevel(0.2, 0.35); P.outline(); },
  flute(P) { P.line(2, 12, 13, 3, '#e8e0cc', 3); P.bevel(0.2, 0.35); for (const k of [0.3, 0.5, 0.7]) P.set(2 + 11 * k, 12 - 9 * k, '#5a4a3a'); P.outline(); },
  doll(P) { // 잎 옷을 입은 작은 헝겊 인형
    P.circle(8, 4.5, 2.8, '#e8c8a0'); P.line(4, 8, 12, 8, '#e8c8a0', 2); P.poly([[5.5, 7], [10.5, 7], [12.5, 14], [3.5, 14]], '#5aa848');
    P.rect(5, 14, 2, 1, '#e8c8a0'); P.rect(9, 14, 2, 1, '#e8c8a0');
    P.bevel(0.3, 0.3);
    P.rect(5, 2, 6, 1, '#7a4a2a'); P.set(5, 3, '#7a4a2a'); P.set(10, 3, '#7a4a2a');
    P.set(7, 4, '#1a1410'); P.set(9, 4, '#1a1410'); P.rect(6, 10, 4, 1, '#8ad060'); P.set(8, 12, '#3e7a2a');
    P.outline();
  },
  ring(P) { P.circle(8, 9.5, 5, '#f0c040'); P.circle(8, 9.5, 2.8, null); P.bevel(0.35, 0.35); P.circle(8, 4, 2, '#5aa848'); P.set(7, 3, '#c8ffc8'); P.outline(); },
  idol(P) { P.circle(8, 4.5, 3, '#d8b070'); P.rect(5, 7, 6, 7, '#d8b070'); P.rect(4, 13, 8, 2, '#b88a50'); P.bevel(0.3, 0.35); P.set(7, 4, '#1a1410'); P.set(9, 4, '#1a1410'); P.rect(7, 6, 2, 1, '#8a5a2a'); P.outline(); },
  mirror(P) { P.ellipse(8, 7, 5, 6, '#c8a040'); P.bevel(0.3, 0.35); P.ellipse(8, 7, 3.6, 4.6, '#a8d8f0'); P.set(6, 4, '#ffffff'); P.set(6, 5, '#ffffff'); P.rect(7, 13, 2, 2, '#8a6a2a'); P.outline(); },
  key(P) { P.circle(5, 5, 3.2, '#a8743a'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x + 0.5 - 5) ** 2 + (y + 0.5 - 5) ** 2) < 2) P.set(x, y, null); P.line(7, 7, 13, 13, '#a8743a', 2); P.rect(11, 13, 2, 2, '#a8743a'); P.rect(13, 11, 2, 2, '#a8743a'); P.bevel(0.3, 0.35); P.outline(); },
};

// 물약: 둥근 유리병 + 코르크 (등급이 오를수록 병이 크고 목에 띠가 감긴다)
DRAW.potion = (P, [liq], k = 1) => {
  const r = k >= 3 ? 5.5 : k >= 2 ? 5 : 4.5;
  P.ellipse(8, 10.5, r, r - 0.3, '#d8e8f0'); P.ellipse(8, 11, r - 1, r - 1.3, liq); P.rect(6, 3, 4, 4, '#d8e8f0'); P.rect(6, 1, 4, 2, '#a87a48');
  if (k >= 2) P.rect(6, 5, 4, 1, k >= 3 ? '#f0c040' : '#c8c8d8');
  P.bevel(0.35, 0.3); P.set(5, 9, '#ffffff'); P.set(5, 10, '#ffffff'); P.outline();
};
// 주문서: 양 끝을 만 종이 + 마법 글귀 (글귀 색 = 마법의 색)
DRAW.scroll = (P, [ink]) => {
  P.rect(4, 4, 8, 9, '#efe4c8'); P.rect(2, 3, 3, 11, '#c8a878'); P.rect(11, 3, 3, 11, '#c8a878'); P.rect(3, 3, 1, 11, '#e8d4a8'); P.rect(12, 3, 1, 11, '#e8d4a8');
  P.bevel(0.3, 0.3);
  for (const [y, w] of [[6, 5], [8, 4], [10, 5]]) P.rect(5, y, w, 1, ink);
  P.set(10, 8, ink); P.outline();
};
// ───── 고기 · 몬스터 부산물 ─────
DRAW.meat = (P, [a, b, bone]) => { // 뼈 달린 고기
  P.ellipse(7, 7.5, 5.5, 4.5, a); P.line(10, 10, 14, 14, bone, 2); P.circle(14.2, 14.2, 1.3, bone); P.circle(13, 15, 1.1, bone);
  P.bevel(0.3, 0.3); P.line(4, 6, 8, 5, b); P.set(5, 9, b); P.outline();
};
function part(P, k, [a, b, c]) {
  switch (k) {
    case 'gel': P.ellipse(8, 10, 6, 4.5, a); P.ellipse(7, 7, 3.5, 3, a); P.bevel(0.35, 0.3); P.rect(5, 6, 2, 2, b); P.set(10, 11, c); P.set(4, 13, a); break;
    case 'wing': P.poly([[1, 4], [8, 2], [15, 4], [13, 9], [10, 7], [8, 11], [6, 7], [3, 9]], a); P.bevel(0.3, 0.35); P.line(8, 2, 8, 10, c); P.line(8, 3, 3, 8, c); P.line(8, 3, 13, 8, c); break;
    case 'fang': P.poly([[5, 2], [11, 2], [10, 7], [8, 15], [6, 7]], a); P.bevel(0.35, 0.35); P.line(7, 3, 7, 9, b); P.rect(5, 2, 6, 1, c); break;
    case 'gland': P.ellipse(8, 9, 5.5, 5, a); P.rect(7, 2, 2, 3, c); P.bevel(0.35, 0.3); P.rect(5, 6, 2, 2, b); P.set(10, 11, c); P.set(9, 7, b); break;
    case 'sac': P.ellipse(8, 9.5, 5.8, 5, a); P.poly([[6, 5], [10, 5], [9, 2], [7, 2]], c); P.bevel(0.3, 0.3); for (const [x, y] of [[6, 8], [10, 10], [8, 12], [11, 7]]) P.set(x, y, b); break;
    case 'tail': for (let i = 0; i < 12; i++) { const t = i / 11; P.circle(3 + t * 10, 4 + Math.sin(t * 3.2) * 4 + t * 6, 2.6 - t * 1.6, a); } P.bevel(0.3, 0.3); P.set(4, 4, b); P.set(6, 6, b); P.set(12, 13, c); break;
    case 'dust': P.ellipse(8, 11, 6, 3.5, a); P.ellipse(8, 9, 4, 3, a); P.bevel(0.4, 0.3); for (const [x, y] of [[5, 9], [9, 8], [11, 11], [7, 12], [3, 4], [12, 3], [8, 4]]) P.set(x, y, b); break;
    case 'core': P.poly([[8, 1], [14, 6], [12, 14], [4, 14], [2, 6]], c); P.circle(8, 8.5, 3.6, a); P.bevel(0.25, 0.3); P.circle(8, 8.5, 1.6, b); P.set(5, 4, a); P.set(12, 11, a); break;
    case 'horn': P.poly([[3, 14], [6, 14], [10, 8], [14, 1], [8, 6]], a); P.bevel(0.35, 0.35); P.line(5, 13, 9, 8, b); P.rect(3, 13, 4, 2, c); break;
    case 'shard': P.poly([[3, 12], [6, 2], [10, 1], [13, 6], [11, 14], [5, 14]], a); P.poly([[9, 7], [13, 6], [11, 14]], c); P.bevel(0.3, 0.25); P.line(5, 11, 9, 3, b); P.set(8, 4, '#ffffff'); break;
    case 'bone': P.line(4, 12, 12, 4, a, 3); P.circle(3, 12, 1.8, a); P.circle(5, 14, 1.8, a); P.circle(11, 2, 1.8, a); P.circle(13, 4, 1.8, a); P.bevel(0.3, 0.35); P.set(7, 9, b); break;
    case 'flesh': P.ellipse(8, 9, 6, 4.5, a); P.ellipse(6, 7, 3, 2.5, a); P.bevel(0.3, 0.3); P.line(5, 9, 11, 10, c); P.set(9, 7, b); P.set(4, 11, c); break;
    case 'sting': P.poly([[2, 3], [5, 2], [14, 14], [13, 15]], a); P.circle(4, 4, 2.6, c); P.bevel(0.3, 0.3); P.line(6, 5, 12, 12, b); break;
    case 'tusk': for (let i = 0; i < 12; i++) { const t = i / 11, an = Math.PI * (1.05 - t * 0.7); P.circle(12 + Math.cos(an) * 9, 14 - Math.sin(an) * 9, 2.4 - t * 1.6, a); } P.bevel(0.3, 0.35); P.rect(2, 12, 3, 3, c); break;
    case 'claw': for (let i = 0; i < 10; i++) { const t = i / 9, an = Math.PI * (0.95 - t * 0.5); P.circle(13 + Math.cos(an) * 10, 15 - Math.sin(an) * 10, 2.4 - t * 1.8, a); } P.bevel(0.3, 0.35); P.rect(2, 12, 4, 3, c); break;
    case 'shell': P.ellipse(8, 9, 6.5, 5.5, a); P.bevel(0.3, 0.35); P.line(8, 4, 8, 14, c); P.line(3, 8, 13, 8, c); P.set(5, 6, b); P.set(11, 11, b); break;
    case 'cloth': P.poly([[2, 3], [14, 3], [13, 10], [10, 14], [6, 14], [3, 10]], a); P.bevel(0.3, 0.35); P.rect(2, 3, 12, 2, c); P.rect(6, 7, 1, 1, '#1a1410'); P.rect(9, 7, 1, 1, '#1a1410'); break;
    case 'tentacle': for (let k = 0; k < 3; k++) for (let i = 0; i < 12; i++) P.circle(4 + k * 4 + Math.sin(i * 0.8 + k) * 1.3, 2 + i, 1.3 - i * 0.05, k === 1 ? b : a); P.bevel(0.3, 0.3); break;
    case 'scale': P.poly([[8, 1], [14, 6], [12, 13], [8, 15], [4, 13], [2, 6]], a); P.bevel(0.3, 0.35); P.line(8, 3, 8, 13, c); P.line(5, 7, 11, 7, b); break;
    case 'flame': P.poly([[8, 1], [12, 6], [13, 11], [8, 15], [3, 11], [4, 6], [6, 8]], a); P.poly([[8, 6], [10, 10], [8, 13], [6, 10]], b); P.bevel(0.3, 0.2); break;
    case 'mask': P.ellipse(8, 8, 6.5, 6.5, a); P.bevel(0.3, 0.35); P.rect(4, 6, 3, 2, '#1a1410'); P.rect(9, 6, 3, 2, '#1a1410'); P.rect(5, 11, 6, 1, c); P.line(2, 3, 5, 5, b); P.line(14, 3, 11, 5, b); break;
    case 'heart': P.circle(5.5, 6, 3.5, a); P.circle(10.5, 6, 3.5, a); P.poly([[2, 7], [14, 7], [8, 15]], a); P.bevel(0.35, 0.3); P.rect(4, 4, 2, 2, b); P.line(8, 6, 8, 12, c); break;
    case 'crown': P.poly([[2, 13], [2, 6], [5, 9], [8, 3], [11, 9], [14, 6], [14, 13]], a); P.bevel(0.4, 0.3); P.rect(3, 11, 10, 1, c); P.set(8, 9, '#ffffff'); break;
    case 'lantern': P.rect(5, 4, 6, 9, c); P.rect(6, 5, 4, 7, a); P.rect(4, 3, 8, 1, c); P.rect(4, 13, 8, 1, c); P.rect(7, 1, 2, 2, c); P.bevel(0.25, 0.3); P.rect(7, 7, 2, 3, b); break;
    case 'crest': P.poly([[3, 2], [13, 2], [13, 8], [8, 15], [3, 8]], a); P.bevel(0.3, 0.35); P.line(8, 4, 8, 11, b); P.line(5, 6, 11, 6, b); P.set(8, 6, c); break;
    default: P.ellipse(8, 9, 5, 4, a); P.bevel(0.3, 0.3);
  }
  P.outline();
}
// ───── 요리 ─────
function dish(P, k, [vessel, food, garnish]) {
  const steam = () => { for (const [x, y] of [[5, 1], [8, 0], [11, 1]]) { P.set(x, y, '#e8ecf4'); P.set(x + 1, y + 1, '#e8ecf4'); } };
  switch (k) {
    case 'bowl': P.ellipse(8, 9, 6.5, 2.4, food); P.poly([[1.5, 9], [14.5, 9], [12, 14], [4, 14]], vessel); P.ellipse(8, 9, 6.5, 2.4, food); P.bevel(0.3, 0.3); P.set(6, 8, garnish); P.set(10, 9, garnish); P.set(8, 8, lighter(food, 0.4)); P.rect(4, 14, 8, 1, darker(vessel, 0.3)); steam(); break;
    case 'pot': P.rect(2, 7, 12, 7, vessel); P.ellipse(8, 7, 6, 2, food); P.rect(0, 8, 2, 2, vessel); P.rect(14, 8, 2, 2, vessel); P.bevel(0.25, 0.3); P.set(6, 7, garnish); P.set(10, 6, garnish); P.set(8, 7, lighter(food, 0.4)); steam(); break;
    case 'cup': P.rect(4, 7, 7, 7, vessel); P.ellipse(7.5, 7, 3.5, 1.5, food); P.rect(11, 9, 2, 3, vessel); P.bevel(0.3, 0.3); P.set(7, 7, garnish); P.rect(3, 14, 9, 1, darker(vessel, 0.25)); steam(); break;
    case 'bottle': P.ellipse(8, 11, 5, 4, vessel); P.rect(6, 3, 4, 5, vessel); P.ellipse(8, 11.5, 4, 3, food); P.rect(7, 6, 2, 3, food); P.rect(6, 1, 4, 2, garnish); P.bevel(0.35, 0.3); P.rect(5, 9, 1, 3, '#ffffff'); P.set(10, 12, lighter(food, 0.5)); break;
    case 'plateFish': P.ellipse(8, 11, 7.5, 3.5, vessel); P.ellipse(8, 9.5, 5.5, 2.4, food); P.poly([[1.5, 7.5], [4, 9.5], [1.5, 11.5]], food); P.bevel(0.3, 0.3); P.line(4, 9, 12, 9, darker(food, 0.35)); P.set(11, 9, '#1a1410'); P.set(13, 11, garnish); P.set(12, 12, garnish); break;
    case 'plateFish2': P.ellipse(8, 11.5, 7.5, 3.5, vessel); P.ellipse(6, 9, 4.5, 1.8, food); P.ellipse(10, 11, 4.5, 1.8, darker(food, 0.1)); P.bevel(0.3, 0.3); P.set(4, 9, '#1a1410'); P.set(12, 11, '#1a1410'); P.set(13, 13, garnish); P.set(3, 12, garnish); break;
    case 'sushi': for (const ox of [3, 9]) { P.rect(ox, 8, 5, 5, food); P.rect(ox, 6, 5, 3, garnish); P.rect(ox + 1, 10, 3, 1, vessel); } P.bevel(0.3, 0.3); P.rect(2, 13, 12, 1, '#8a5a32'); break;
    case 'feast': P.ellipse(8, 11.5, 7.5, 3.5, '#e8e4dc'); P.ellipse(5, 9, 3.5, 2.5, food); P.ellipse(11, 9, 3.5, 1.8, garnish); P.line(5, 7, 4, 4, '#f4ecd8'); P.bevel(0.3, 0.3); P.set(11, 9, '#1a1410'); P.set(8, 12, '#5aa848'); P.set(9, 11, '#e8603a'); break;
    case 'skewer': P.line(2, 14, 14, 2, '#c8a070'); for (const [x, y, c] of [[5, 11, food], [8, 8, garnish], [11, 5, food]]) P.circle(x, y, 2.2, c); P.bevel(0.35, 0.3); break;
    case 'plate': P.ellipse(8, 11.5, 7.5, 3.5, vessel); P.ellipse(8, 9.5, 5, 2.5, food); P.bevel(0.3, 0.3); for (const [x, y] of [[5, 9], [10, 10], [8, 8]]) P.set(x, y, garnish); P.set(7, 10, lighter(food, 0.35)); steam(); break;
    case 'bread': P.ellipse(8, 9.5, 6.5, 4.5, vessel); P.bevel(0.35, 0.35); for (const x of [5, 8, 11]) P.line(x - 1, 7, x + 1, 9, food); break;
    case 'pie': P.ellipse(8, 10, 7, 3.6, vessel); P.ellipse(8, 9, 5.5, 2.6, food); P.bevel(0.3, 0.3); P.line(4, 9, 12, 9, vessel); P.line(8, 7, 8, 11, vessel); P.set(5, 8, garnish); P.set(11, 10, garnish); break;
    default: P.ellipse(8, 10, 6, 4, food); P.bevel(0.3, 0.3);
  }
  P.outline();
}

// 도구 (손잡이 + 머리, 단계 색)
function drawToolIcon(P, kind, tier) {
  const head = TOOL_COLOR[Math.max(0, tier - 1)], handle = '#8a5a32', wood = tier <= 1;
  const hc = wood && kind !== 'rod' ? '#9a9a94' : head;
  if (kind === 'pickaxe') { P.line(4, 14, 11, 4, handle, 2); P.poly([[2, 6], [6, 2], [12, 1], [15, 4], [13, 5], [11, 3.5], [7, 4]], hc); }
  else if (kind === 'axe') { P.line(4, 14, 10, 3, handle, 2); P.poly([[9, 2], [14, 1], [15, 6], [12, 8], [9, 6]], hc); }
  else if (kind === 'shovel') { P.line(10, 2, 6, 10, handle, 2); P.rect(9, 1, 3, 2, handle); P.poly([[3, 10], [8, 8], [9, 12], [5, 15], [2, 13]], hc); }
  else if (kind === 'hoe') { P.line(3, 14, 11, 3, handle, 2); P.poly([[9, 2], [14, 2], [14, 6], [12, 6], [12, 4], [9, 4]], hc); }
  else if (kind === 'can') { P.ellipse(7, 10, 5, 4, hc); P.rect(2, 7, 10, 6, hc); P.line(11, 9, 15, 5, hc, 2); P.line(4, 5, 9, 5, darker(hc, 0.25)); P.rect(3, 4, 1, 3, darker(hc, 0.25)); P.rect(9, 4, 1, 3, darker(hc, 0.25)); }
  else if (kind === 'rod') { P.line(2, 15, 14, 1, tier >= 4 ? '#3a2a2a' : tier >= 2 ? head : '#c8b070', 1); P.line(3, 14, 6, 11, '#5a3a22', 2); P.circle(5, 12, 1.6, tier >= 4 ? '#ff7a2a' : '#9a9aa4'); for (let y = 2; y < 9; y++) P.set(14, y, '#e8e8e8'); P.set(14, 9, '#d83a3a'); }
  P.bevel(0.3, 0.3);
  P.outline();
}

const cache = new Map(), urls = new Map();
export function iconCanvas(key) {
  if (cache.has(key)) return cache.get(key);
  const P = new Pix(16);
  try {
    if (key.startsWith('tool:')) { const [, kind, tier] = key.split(':'); drawToolIcon(P, kind, +tier); }
    else if (key.startsWith('art:')) { const a = ARTIFACTS[key.slice(4)]; DRAW[a?.icon || 'pot'](P); }
    else if (key.startsWith('shard:')) DRAW.shard(P, [key.slice(6), lighter(key.slice(6), 0.5), darker(key.slice(6), 0.4)]);
    else {
      const g = GOODS[key] || (key.startsWith('dish:') ? registerDish(key) : null), ic = g?.icon;
      if (!ic) DRAW.lump(P, ['#888888', '#aaaaaa', '#555555']);
      else if (ic.t === 'crop') DRAW.crop(P, ic.c, ic.k);
      else if (ic.t === 'fish') DRAW.fish(P, ic.c, ic.shape);
      else if (ic.t === 'part') part(P, ic.k, ic.c);
      else if (ic.t === 'dish') dish(P, ic.k, ic.c);
      else if (ic.t === 'potion') DRAW.potion(P, ic.c, ic.k || 1);
      else (DRAW[ic.t] || DRAW.lump)(P, ic.c || []);
    }
  } catch { /* 그림 실패 시 빈 칸 */ }
  const cv = P.canvas();
  cache.set(key, cv);
  return cv;
}
export function iconURL(key) {
  if (!urls.has(key)) { const src = iconCanvas(key), big = document.createElement('canvas'); big.width = big.height = 32; const g = big.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, 32, 32); urls.set(key, big.toDataURL()); }
  return urls.get(key);
}
// 화면에 그리기 (가운데 기준)
export function drawIcon(g, key, x, y, s = 1) { const cv = iconCanvas(key); g.drawImage(cv, Math.round(x - 8 * s), Math.round(y - 8 * s), 16 * s, 16 * s); }
export const toolKey = (kind, tier) => `tool:${kind}:${tier}`;
export const toolName = (kind, tier) => TOOLS[kind]?.tiers[Math.max(0, tier - 1)] || TOOLS[kind]?.name;

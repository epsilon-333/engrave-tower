// 계약한 정령의 도트 그림: 등급마다 모습이 다르다 (방울 · 요정 · 짐승 · 정령왕), 속성마다 색과 짐승 모양이 다르다.
// 칸마다 '몸 · 날개 · 눈 · 빛'을 정해 두고, 테두리는 몸 둘레 칸, 위 왼쪽은 밝게 · 아래 오른쪽은 그늘로 찍는다.
import { SPIRITS, SPIRIT_ELEMS } from '../data/spirits.js';

const cache = new Map();
const rgb = (h) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const OL = [22, 16, 30], EYE = [26, 16, 40], WHITE = [255, 255, 255];
const ell = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const tri = (x, y, ax, ay, bx, by, cx2, cy2) => { // 칸 한가운데가 세모 안인가
  const px = x + 0.5, py = y + 0.5, s = (x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d1 = s(ax, ay, bx, by), d2 = s(bx, by, cx2, cy2), d3 = s(cx2, cy2, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
// 1 몸 · 2 날개(밝은 반투명) · 3 눈 · 4 흰 빛 · 5 밝은 장식(갈기 · 뿔 · 왕관)
function paint(w, h, part, pal) {
  const grid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grid[y * w + x] = part(x, y) || 0;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : grid[y * w + x]);
  const [A, B, C] = pal.map(rgb);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = at(x, y), i = (y * w + x) * 4;
    let col = null, a = 255;
    if (!v) { if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) col = OL; }
    else if (v === 1) col = !at(x - 1, y - 1) || !at(x, y - 1) ? A : !at(x + 1, y + 1) || !at(x, y + 1) ? C : B;
    else if (v === 2) { col = A; a = 190; }
    else if (v === 3) col = EYE;
    else if (v === 4) col = WHITE;
    else if (v === 5) col = !at(x, y - 1) ? WHITE : A;
    if (!col) continue;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// 0 방울: 동그란 몸 위로 속성의 끝이 솟는다 (불꽃 · 서리 결정 · 번개 · 바람 소용돌이 · 새싹 · 그림자 뿔)
function wisp(elem, f) {
  const sway = [0, 0.6, 0, -0.6][f];
  return paint(11, 13, (x, y) => {
    if ((x === 4 || x === 6) && y === 8) return 3;
    if (x === 3 && y === 6) return 4;
    if (ell(x, y, 5.5, 8.4, 3.7, 3.5)) return 1;
    const t = (8 - (y + 0.5)) / 5.5; // 위로 갈수록 0 → 1
    if (y < 8 && t > 0 && t < 1) {
      if (elem === 'forest') return (x === 5 && y >= 3) || (y === 4 && (x === 4 || x === 6)) || (y === 3 && (x === 3 || x === 7)) ? 1 : 0;
      if (elem === 'dark') return (Math.abs(x + 0.5 - 3.5) < 1 - t && y >= 3) || (Math.abs(x + 0.5 - 7.5) < 1 - t && y >= 3) ? 1 : 0;
      if (elem === 'lightning') return (y >= 2 && ((y < 5 && x === 6 - (y > 3 ? 1 : 0)) || (y >= 5 && x === 5))) ? 5 : 0;
      if (elem === 'ice') return (x === 5 && y >= 2) || (y === 4 && x >= 4 && x <= 6) ? 5 : 0;
      return Math.abs(x + 0.5 - 5.5 - sway * t * 2) < (1 - t) * 3.1 ? 1 : 0; // 불 · 바람: 흔들리는 끝
    }
    return 0;
  }, SPIRIT_ELEMS[elem].pal);
}
const seg = (x, y, ax, ay, bx, by, r) => { // 칸 한가운데가 선분(굵기 r) 안인가
  const px = x + 0.5, py = y + 0.5, vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t)) <= r;
};
// 1 요정: 작은 사람 + 어깨에서 비스듬히 뻗은 잠자리 날개 두 쌍 (위 날개가 크고 아래가 작다)
function fairy(elem, f) {
  const flap = [0, 1, 2, 1][f]; // 날개 끝이 오르내린다
  return paint(17, 16, (x, y) => {
    if ((x === 7 || x === 9) && y === 4) return 3;
    if (ell(x, y, 8.5, 4, 2.7, 2.6)) return 1;
    if (y >= 6 && y <= 12 && Math.abs(x + 0.5 - 8.5) <= 1.2 + (y - 6) * 0.3) return 1; // 몸 · 치맛자락
    if ((y === 7 || y === 8) && (x === 6 || x === 10)) return 1; // 팔
    if (seg(x, y, 6.5, 7, 1.6, 3.6 + flap, 1.25) || seg(x, y, 10.5, 7, 15.4, 3.6 + flap, 1.25)) return 2; // 위 날개
    if (seg(x, y, 6.6, 8.6, 2.8, 10.6 - flap * 0.5, 0.95) || seg(x, y, 10.4, 8.6, 14.2, 10.6 - flap * 0.5, 0.95)) return 2; // 아래 날개
    if (y === 1 && (x === 7 || x === 9) && elem !== 'dark') return 5; // 더듬이 끝
    if (elem === 'dark' && y <= 2 && (x === 6 || x === 10)) return 1; // 어스름 요정: 작은 뿔
    return 0;
  }, SPIRIT_ELEMS[elem].pal);
}
// 2 짐승: 불 여우 · 얼음 늑대 · 숲 사슴(네 발) / 번개 매 · 바람 독수리 · 어둠 박쥐(날개)
function beast(elem, f) {
  const pal = SPIRIT_ELEMS[elem].pal;
  if (elem === 'lightning' || elem === 'wind' || elem === 'dark') {
    // 날개를 활짝 편 앞모습: 가운데 몸 · 위에 머리(눈 둘) · 양옆 날개 (날갯짓으로 끝이 오르내린다) · 아래 꽁지
    const lift = [-2, 0, 2, 0][f], bat = elem === 'dark';
    return paint(21, 16, (x, y) => {
      if ((x === 9 || x === 11) && y === 4) return bat ? 4 : 3;
      if (ell(x, y, 10.5, 4.4, 2, 1.9)) return 1;                                       // 머리
      if (!bat && x === 10 && y === 6) return 5;                                         // 부리
      if (bat && y >= 1 && y <= 2 && (x === 9 || x === 11)) return 1;                    // 박쥐 귀
      if (ell(x, y, 10.5, 8.6, 2.2, 3)) return 1;                                        // 몸
      if (!bat && tri(x, y, 8.6, 10.5, 12.4, 10.5, 10.5, 14.6)) return 1;               // 꽁지깃
      const tip = 4 + lift;
      if (tri(x, y, 9.2, 6.6, 0.8, tip, 9.2, 10) || tri(x, y, 11.8, 6.6, 20.2, tip, 11.8, 10)) { // 날개
        const edge = (xx) => tip + 1.2 + (9.2 - xx) * (6 - lift) / 8.4; // 날개 아랫선
        if (bat && y >= edge(x < 10 ? x : 20 - x) - 0.5 && (x % 3 === 0)) return 0;      // 박쥐 날개 아래 톱니
        if (!bat && y >= edge(x < 10 ? x : 20 - x) - 0.5 && (x + y) % 2 === 0) return 5; // 깃털 끝 (밝게)
        return 1;
      }
      return 0;
    }, pal);
  }
  const step = f % 2;
  return paint(19, 15, (x, y) => {
    if (x === 15 && y === 5) return 3;
    if (ell(x, y, 9, 8.5, 5.2, 2.7)) return 1;                     // 몸
    if (ell(x, y, 14.6, 6, 2.5, 2.3)) return 1;                    // 머리
    if (y === 7 && (x === 17 || x === 18) && elem !== 'forest') return 1; // 주둥이
    if (y >= 10 && y <= 13) { const legs = step ? [5, 8, 11, 13] : [6, 9, 10, 12]; if (legs.includes(x)) return 1; }
    if (elem === 'fire') { if (ell(x, y, 2.6, 6, 2.8, 2.2) || ell(x, y, 1.6, 4.5, 1.5, 1.4)) return 5; if (tri(x, y, 13, 4, 14, 1, 15, 4)) return 1; } // 불꽃 꼬리 · 귀
    if (elem === 'ice') { if (tri(x, y, 13.5, 4, 14.5, 1.5, 15.6, 4)) return 1; if (y >= 6 && y <= 8 && x >= 2 && x <= 4 && x - 2 >= y - 6 - 1) return 1; if (y === 6 && x >= 6 && x <= 11 && x % 2 === 0) return 5; } // 귀 · 꼬리 · 등 서리
    if (elem === 'forest') { if ((x === 13 && y <= 3) || (x === 16 && y <= 3) || (y === 1 && (x === 12 || x === 17)) || (y === 2 && (x === 14 || x === 15))) return 5; if (x === 3 && y === 7) return 1; } // 뿔 · 꼬리
    return 0;
  }, pal);
}
// 3 정령왕: 빛나는 눈 · 속성 왕관 · 아래로 갈수록 흩어지는 몸 (땅에 발을 딛지 않는다)
function lord(elem, f) {
  const sway = [0, 0.5, 0, -0.5][f];
  return paint(19, 23, (x, y) => {
    if ((x === 8 || x === 10) && y === 6) return 4;
    if (ell(x, y, 9.5, 6.2, 3, 2.9)) return 1;                                  // 머리
    if (y >= 2 && y <= 3 && (x === 7 || x === 12)) return 5; // 왕관 세 가닥 (가운데가 가장 높다)
    if (y >= 0 && y <= 3 && (x === 9 || x === 10)) return 5;
    if (y >= 9 && y <= 15 && Math.abs(x + 0.5 - 9.5) <= (y === 9 ? 4.4 : 3.6 - (y - 10) * 0.25)) return 1; // 어깨 · 몸통 (위가 넓다)
    if (seg(x, y, 5.6, 9.8, 3.6, 15.2, 0.95) || seg(x, y, 13.4, 9.8, 15.4, 15.2, 0.95)) return 1;   // 팔
    if (ell(x, y, 3.4, 16, 1.3, 1.2) || ell(x, y, 15.6, 16, 1.3, 1.2)) return 5;                   // 손끝의 속성 빛
    if (y >= 16 && y <= 22) { const k = (y - 16) / 6, cx = 9.5 + Math.sin(y * 0.9 + f) * 0.7 + sway * k * 3; if (Math.abs(x + 0.5 - cx) <= 2.9 * (1 - k * 0.85)) return (y + x + f) % 3 === 0 && k > 0.45 ? 0 : 1; } // 흩어지는 꼬리
    return 0;
  }, SPIRIT_ELEMS[elem].pal);
}

export function spiritSprite(id, frame = 0) {
  const s = SPIRITS[id];
  if (!s) return null;
  const f = ((frame % 4) + 4) % 4, key = `${id}|${f}`;
  let c = cache.get(key);
  if (!c) { c = [wisp, fairy, beast, lord][s.grade](s.elem, f); cache.set(key, c); }
  return c;
}
// 창(HTML)에 넣을 큰 그림
const urls = new Map();
export function spiritIconURL(id, scale = 4) {
  const k = `${id}|${scale}`;
  if (urls.has(k)) return urls.get(k);
  const src = spiritSprite(id, 0), c = document.createElement('canvas');
  c.width = 23 * scale; c.height = 23 * scale;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(src, Math.round((23 - src.width) / 2) * scale, Math.round((23 - src.height) / 2) * scale, src.width * scale, src.height * scale);
  const u = c.toDataURL(); urls.set(k, u); return u;
}

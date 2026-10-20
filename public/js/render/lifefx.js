// 생활 그림: 바위 · 광맥 · 덤불 · 꽃 · 반짝이는 흙 · 그루터기 · 손에 든 도구 · 찌와 낚싯줄 · 밭과 작물
import { TILE } from '../sim/mapgen.js';
import { CROPS } from '../data/goods.js';
import { iconCanvas, toolKey } from './icons.js';

const OL = '#1a1410';
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const disc = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); };
const ell = (g, x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); g.fill(); };
const shade = (g, x, y, rx, ry = rx * 0.35, a = 0.3) => ell(g, x, y, rx, ry, `rgba(0,0,0,${a})`);
const ORE = { coal: ['#26222a', '#4a4650'], copper: ['#d0763a', '#f4b07a'], iron: ['#a4acbc', '#e8eef8'], silver: ['#d4d8e6', '#ffffff'], gold: ['#f0c040', '#fff2a8'] };

// 바위 덩어리: 외곽선 · 몸통 · 밝은 윗면 · 그늘
function boulder(g, x, y, w, h, cols) {
  shade(g, x, y + 1, w * 0.62, 3.5);
  g.fillStyle = OL; g.beginPath(); g.moveTo(x - w / 2 - 1, y + 1); g.lineTo(x - w / 2 + 1, y - h * 0.62); g.lineTo(x - w * 0.15, y - h - 1); g.lineTo(x + w * 0.28, y - h * 0.92 - 1); g.lineTo(x + w / 2 + 1, y - h * 0.45); g.lineTo(x + w / 2, y + 1); g.closePath(); g.fill();
  g.fillStyle = cols[0]; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2 + 2, y - h * 0.6); g.lineTo(x - w * 0.15, y - h); g.lineTo(x + w * 0.27, y - h * 0.9); g.lineTo(x + w / 2, y - h * 0.44); g.lineTo(x + w / 2 - 1, y); g.closePath(); g.fill();
  g.fillStyle = cols[1]; g.beginPath(); g.moveTo(x - w / 2 + 2, y - h * 0.6); g.lineTo(x - w * 0.15, y - h); g.lineTo(x + w * 0.27, y - h * 0.9); g.lineTo(x + w * 0.1, y - h * 0.55); g.lineTo(x - w * 0.25, y - h * 0.45); g.closePath(); g.fill();
  g.fillStyle = cols[2]; g.beginPath(); g.moveTo(x + w * 0.1, y - h * 0.55); g.lineTo(x + w * 0.27, y - h * 0.9); g.lineTo(x + w / 2, y - h * 0.44); g.lineTo(x + w / 2 - 1, y); g.lineTo(x + w * 0.12, y); g.closePath(); g.fill();
}
export function drawNode(g, o, t) {
  const x = Math.round(o.x + (o.hitT > 0 ? Math.sin(t * 90) * 1.2 : 0)), y = Math.round(o.y + 4);
  if (o.hitT > 0) o.hitT -= 1 / 60;
  const dmg = o.hp != null ? 1 - o.hp / (o.maxHp || o.hp0 || o.hp) : 0;
  if (o.depleted) { // 남은 자리: 돌 부스러기 · 새싹
    if (['herb', 'berry', 'mushroom', 'frostLily', 'fireBloom', 'shell'].includes(o.type)) { if (o.type !== 'shell') { R(g, '#3e7a2a', x - 1, y - 3, 1, 3); R(g, '#5aa848', x, y - 4, 2, 1); } return; }
    for (const [dx, dy, s] of [[-5, 0, 3], [2, 1, 2], [5, -1, 3], [-1, 2, 2]]) { R(g, OL, x + dx - 1, y + dy - s, s + 2, s + 1); R(g, '#8a8680', x + dx, y + dy - s + 1, s, s - 1); }
    return;
  }
  switch (o.type) {
    case 'clam': { // 큰 조개: 숨 쉬듯 살짝 벌어진다
      shade(g, x, y + 1, 9, 3);
      const op = Math.max(0, Math.sin(t * 1.4 + o.x)) * 2;
      g.fillStyle = OL; g.beginPath(); g.ellipse(x, y - 3, 8, 5, 0, Math.PI, 0); g.fill(); R(g, OL, x - 8, y - 4, 16, 3);
      g.fillStyle = '#8a7aa8'; g.beginPath(); g.ellipse(x, y - 3, 7, 4, 0, Math.PI, 0); g.fill();
      for (const dx of [-4, 0, 4]) R(g, '#6a5a88', x + dx, y - 6, 1, 3);
      R(g, '#b8a8d8', x - 5, y - 6, 3, 1);
      R(g, OL, x - 8, y - 3 + op, 16, 3); R(g, '#7a6a98', x - 7, y - 2 + op, 14, 2);
      if (op > 1) { R(g, '#f8f4ff', x - 1, y - 3, 2, 1); }
      return;
    }
    case 'coralNode': { // 산호 덩이
      shade(g, x, y + 1, 11, 3);
      for (const [dx, hh, col] of [[-5, 10, '#e86a7a'], [0, 14, '#ff8a6a'], [5, 9, '#f0a050']]) {
        R(g, OL, x + dx - 2, y - hh - 1, 4, hh + 2); R(g, col, x + dx - 1, y - hh, 2, hh);
        R(g, OL, x + dx - 4, y - hh + 3, 3, 2); R(g, col, x + dx - 3, y - hh + 3, 2, 1);
        R(g, OL, x + dx + 1, y - hh + 6, 3, 2); R(g, col, x + dx + 1, y - hh + 6, 2, 1);
        R(g, '#ffd8c8', x + dx - 1, y - hh, 1, 2);
      }
      if (dmg > 0.3) R(g, OL, x - 1, y - 6, 3, 1);
      return;
    }
    case 'kelp': { // 해초 덤불: 흔들린다
      shade(g, x, y + 1, 8, 2.5);
      for (const [dx, hh, ph] of [[-4, 14, 0], [0, 18, 1.3], [4, 12, 2.4]]) for (let i = 0; i < hh; i++) {
        const sx = Math.round(Math.sin(t * 1.6 + ph + i * 0.35) * (i / hh) * 3);
        R(g, '#1e3a1e', x + dx + sx - 1, y - i, 3, 1); R(g, i % 4 < 2 ? '#3a8a3a' : '#5aaa4a', x + dx + sx, y - i, 1, 1);
      }
      return;
    }
    case 'rock': case 'coal': case 'copper': case 'iron': case 'silver': case 'gold': {
      const big = o.type === 'rock' ? 22 : 24, h = o.type === 'rock' ? 15 : 17;
      boulder(g, x, y, big, h, o.type === 'coal' ? ['#5a5660', '#7a7680', '#3e3a44'] : ['#8a8680', '#aaa69e', '#686460']);
      const ore = ORE[o.type];
      if (ore) for (const [dx, dy, s] of [[-6, -9, 3], [1, -12, 2], [4, -6, 3], [-2, -4, 2], [7, -10, 2]]) { R(g, OL, x + dx - 1, y + dy - 1, s + 2, s + 2); R(g, ore[0], x + dx, y + dy, s, s); R(g, ore[1], x + dx, y + dy, 1, 1); }
      if (o.type === 'gold' || o.type === 'silver') if (Math.sin(t * 3 + o.x) > 0.85) R(g, '#ffffff', x + 2, y - 11, 1, 1);
      if (dmg > 0.2) { R(g, OL, x - 2, y - h + 4, 1, 5); R(g, OL, x - 1, y - h + 8, 1, 3); }
      if (dmg > 0.5) { R(g, OL, x + 3, y - 9, 4, 1); R(g, OL, x + 6, y - 8, 1, 4); R(g, OL, x - 7, y - 6, 3, 1); }
      return;
    }
    case 'crystal': {
      shade(g, x, y + 1, 12, 3.5);
      const a = 0.4 + 0.25 * Math.sin(t * 2.2 + o.x);
      const gl = g.createRadialGradient(x, y - 10, 1, x, y - 10, 18); gl.addColorStop(0, `rgba(190,160,255,${a})`); gl.addColorStop(1, 'rgba(190,160,255,0)'); g.fillStyle = gl; g.fillRect(x - 18, y - 28, 36, 36);
      for (const [dx, hh, ww, col] of [[-6, 12, 5, '#7a5ac8'], [5, 14, 5, '#8a6ad8'], [-1, 20, 6, '#a88aff']]) {
        g.fillStyle = OL; g.beginPath(); g.moveTo(x + dx - ww / 2 - 1, y + 1); g.lineTo(x + dx - ww / 2 - 1, y - hh + 3); g.lineTo(x + dx, y - hh - 1); g.lineTo(x + dx + ww / 2 + 1, y - hh + 3); g.lineTo(x + dx + ww / 2 + 1, y + 1); g.fill();
        g.fillStyle = col; g.beginPath(); g.moveTo(x + dx - ww / 2, y); g.lineTo(x + dx - ww / 2, y - hh + 3); g.lineTo(x + dx, y - hh); g.lineTo(x + dx + ww / 2, y - hh + 3); g.lineTo(x + dx + ww / 2, y); g.fill();
        R(g, '#d8c8ff', x + dx - ww / 2 + 1, y - hh + 4, 1, hh - 6);
      }
      if (dmg > 0.3) R(g, OL, x - 1, y - 12, 2, 1);
      return;
    }
    case 'obsidian': {
      shade(g, x, y + 1, 12, 3.5);
      g.fillStyle = OL; g.beginPath(); g.moveTo(x - 11, y + 1); g.lineTo(x - 8, y - 9); g.lineTo(x - 2, y - 17); g.lineTo(x + 4, y - 12); g.lineTo(x + 10, y - 14); g.lineTo(x + 12, y + 1); g.fill();
      g.fillStyle = '#2e2438'; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x - 7, y - 9); g.lineTo(x - 2, y - 15); g.lineTo(x + 4, y - 11); g.lineTo(x + 9, y - 12); g.lineTo(x + 11, y); g.fill();
      R(g, '#8a7aaa', x - 6, y - 10, 1, 6); R(g, '#8a7aaa', x - 2, y - 13, 1, 4); R(g, '#6a5a8a', x + 5, y - 9, 1, 5);
      if (Math.sin(t * 2 + o.x) > 0.7) R(g, '#ffffff', x - 2, y - 12, 1, 1);
      return;
    }
    case 'herb': {
      shade(g, x, y, 8, 2.5);
      for (const [dx, h, lean] of [[-4, 9, -2], [0, 12, 0], [4, 10, 2], [-2, 7, -3], [2, 8, 3]]) { g.strokeStyle = OL; g.lineWidth = 3; g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + lean * 0.3, y - h * 0.6, x + dx + lean, y - h); g.stroke(); }
      for (const [dx, h, lean, col] of [[-4, 9, -2, '#3e8a32'], [0, 12, 0, '#4a9a3a'], [4, 10, 2, '#3e8a32'], [-2, 7, -3, '#5aac44'], [2, 8, 3, '#5aac44']]) { g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + lean * 0.3, y - h * 0.6, x + dx + lean, y - h); g.stroke(); }
      for (const [dx, dy] of [[0, -12], [-4, -9], [4, -10]]) { R(g, OL, x + dx - 1, y + dy - 1, 3, 3); R(g, '#f4f0e8', x + dx, y + dy, 1, 1); }
      return;
    }
    case 'berry': {
      shade(g, x, y + 1, 10, 3);
      for (const [dx, dy, r] of [[-5, -6, 6], [5, -6, 6], [0, -10, 6], [0, -4, 6]]) disc(g, x + dx, y + dy, r + 1, OL);
      for (const [dx, dy, r] of [[-5, -6, 6], [5, -6, 6], [0, -10, 6], [0, -4, 6]]) disc(g, x + dx, y + dy, r, '#3e7a32');
      for (const [dx, dy, r] of [[-6, -8, 3], [4, -9, 3], [-1, -12, 3]]) disc(g, x + dx, y + dy, r, '#5a9a44');
      for (const [dx, dy] of [[-6, -5], [3, -7], [6, -3], [-2, -9], [1, -4], [-4, -10]]) { R(g, OL, x + dx - 1, y + dy - 1, 3, 3); R(g, '#d42a4a', x + dx, y + dy, 2, 2); R(g, '#ff8aa0', x + dx, y + dy, 1, 1); }
      return;
    }
    case 'mushroom': {
      shade(g, x, y, 8, 2.5);
      for (const [dx, h, s] of [[-4, 6, 4], [3, 9, 5], [0, 4, 3]]) {
        R(g, OL, x + dx - 2, y - h, 4, h + 1); R(g, '#e8d8c0', x + dx - 1, y - h, 2, h);
        g.fillStyle = OL; g.beginPath(); g.ellipse(x + dx, y - h, s + 1, s * 0.7 + 1, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#c84a3a'; g.beginPath(); g.ellipse(x + dx, y - h, s, s * 0.7, 0, Math.PI, 0); g.fill();
        R(g, '#ffffff', x + dx - 2, y - h - 2, 1, 1); R(g, '#ffffff', x + dx + 1, y - h - 3, 1, 1);
      }
      return;
    }
    case 'frostLily': case 'fireBloom': {
      const fire = o.type === 'fireBloom', pc = fire ? '#ff7a2a' : '#bfe8ff', cc = fire ? '#ffe08a' : '#ffffff';
      shade(g, x, y, 6, 2);
      if (fire) { const a = 0.35 + 0.2 * Math.sin(t * 4 + o.x); const gl = g.createRadialGradient(x, y - 9, 1, x, y - 9, 12); gl.addColorStop(0, `rgba(255,140,40,${a})`); gl.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gl; g.fillRect(x - 12, y - 21, 24, 24); }
      R(g, OL, x - 1, y - 9, 3, 9); R(g, '#3e8a32', x, y - 8, 1, 8); R(g, OL, x - 5, y - 5, 5, 3); R(g, '#3e8a32', x - 4, y - 4, 3, 1);
      const sw = Math.sin(t * 1.6 + o.x) * 0.8;
      for (const [dx, dy] of [[0, -14], [3, -11], [2, -8], [-2, -8], [-3, -11]]) { disc(g, x + dx + sw, y + dy, 2.6, OL); }
      for (const [dx, dy] of [[0, -14], [3, -11], [2, -8], [-2, -8], [-3, -11]]) { disc(g, x + dx + sw, y + dy, 1.8, pc); }
      R(g, cc, x - 1 + sw, y - 12, 2, 2);
      return;
    }
    case 'shell': {
      R(g, OL, x - 5, y - 6, 10, 7); R(g, '#f0d8c0', x - 4, y - 5, 8, 5); R(g, '#c89a7a', x - 1, y - 5, 1, 5); R(g, '#c89a7a', x + 2, y - 4, 1, 4); R(g, '#ffffff', x - 3, y - 5, 1, 1);
      g.fillStyle = OL; g.beginPath(); g.moveTo(x - 6, y - 1); g.lineTo(x, y - 9); g.lineTo(x + 6, y - 1); g.fill(); g.fillStyle = '#f4e0c8'; g.beginPath(); g.moveTo(x - 4, y - 2); g.lineTo(x, y - 8); g.lineTo(x + 4, y - 2); g.fill();
      return;
    }
  }
}
// 반짝이는 흙: 봉긋한 흙 더미와 반짝임 (판 자리는 구멍)
export function drawDig(g, o, t) {
  const x = Math.round(o.x), y = Math.round(o.y);
  if (o.depleted) { ell(g, x, y, 6, 3, '#3a2818'); ell(g, x, y - 1, 4, 2, '#24180e'); R(g, '#6a4a2e', x - 7, y - 1, 2, 1); R(g, '#6a4a2e', x + 5, y + 1, 2, 1); return; }
  ell(g, x, y, 7, 3.5, OL); ell(g, x, y - 1, 6, 3, '#7a5a38'); ell(g, x - 1, y - 2, 4, 1.8, '#9a7a50');
  for (const [dx, dy] of [[-3, 0], [2, -1], [4, 1]]) R(g, '#5a3e24', x + dx, y + dy, 1, 1);
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.9 + i * 0.37 + o.x * 0.01) % 1;
    if (ph < 0.35) { const k = Math.sin(ph / 0.35 * Math.PI), sx = x - 4 + i * 4, sy = y - 4 - i % 2 * 2; g.fillStyle = `rgba(255,248,210,${k})`; g.fillRect(sx, sy - 1, 1, 3); g.fillRect(sx - 1, sy, 3, 1); }
  }
}
// 그루터기 (다시 자라는 중)
export function drawStump(g, pr, burnt) {
  const x = pr.x * TILE + 8, y = pr.y * TILE + 14;
  shade(g, x, y, 8, 2.5);
  if (pr.tree === 'cactus') { // 벤 선인장: 초록 밑동 · 잘린 면 · 가시
    R(g, OL, x - 4, y - 9, 8, 10); R(g, burnt ? '#3a3028' : '#4a8a3a', x - 3, y - 8, 6, 8); R(g, burnt ? '#4a3e34' : '#86c46a', x - 2, y - 8, 1, 8); R(g, burnt ? '#241c16' : '#2e5e24', x + 2, y - 8, 1, 8);
    R(g, OL, x - 4, y - 10, 8, 2); R(g, burnt ? '#5a4e44' : '#c8e8a8', x - 3, y - 10, 6, 1); R(g, '#9ac87a', x - 1, y - 10, 2, 1);
    if (!burnt) { R(g, '#ffe8a8', x - 4, y - 6, 1, 1); R(g, '#ffe8a8', x + 3, y - 4, 1, 1); R(g, '#ffe8a8', x - 4, y - 2, 1, 1); }
    return;
  }
  R(g, OL, x - 6, y - 7, 12, 8); R(g, burnt ? '#3a3028' : '#7a5232', x - 5, y - 6, 10, 6); R(g, burnt ? '#241c16' : '#5a3a22', x + 2, y - 6, 3, 6);
  ell(g, x, y - 7, 6, 2.6, OL); ell(g, x, y - 7, 5, 2, burnt ? '#4a3e34' : '#d0a874'); ell(g, x, y - 7, 2.5, 1, burnt ? '#2a221c' : '#a87c4c');
  R(g, burnt ? '#2a221c' : '#5a3a22', x - 8, y - 2, 3, 2); R(g, burnt ? '#2a221c' : '#5a3a22', x + 5, y - 1, 3, 2);
  if (!burnt) { R(g, '#5aa848', x + 3, y - 10, 1, 3); R(g, '#7ac860', x + 4, y - 11, 2, 1); } // 새싹
}

// 손에 든 도구 (아이콘을 손잡이 끝을 축으로 돌려 그린다). ang: 도구가 가리키는 방향(라디안)
export function drawToolAt(g, kind, tier, hx, hy, ang, dir) {
  const ic = iconCanvas(toolKey(kind, Math.max(1, tier)));
  g.save(); g.translate(Math.round(hx), Math.round(hy));
  g.rotate(ang + Math.PI / 4); // 아이콘은 왼쪽 아래 → 오른쪽 위 대각선
  if (dir < 0) g.scale(1, -1);
  g.drawImage(ic, -3, -13);
  g.restore();
}
// 도구 휘두르기 자세: 들어 올렸다가 내려친다 (k: 0~1)
export function swingAngle(kind, k) {
  if (kind === 'can') return 0.5 + Math.sin(k * Math.PI) * 0.5; // 기울여 붓기
  if (kind === 'hand') return 0.6 + k * 0.6;
  const up = -2.4, down = kind === 'shovel' || kind === 'hoe' ? 0.9 : 0.7;
  if (k < 0.55) return -0.9 + (up + 0.9) * (k / 0.55); // 천천히 들어 올리고
  const q = Math.min(1, (k - 0.55) / 0.12);              // 빠르게 내려친다
  return up + (down - up) * (q * q);
}

// 찌 · 낚싯줄
export function drawFishing(g, p, f, tipX, tipY, t) {
  let bx = f.bx, by = f.by;
  if (f.phase === 'cast') { const k = Math.min(1, f.t / 0.45); bx = tipX + (f.bx - tipX) * k; by = tipY + (f.by - tipY) * k - Math.sin(k * Math.PI) * 26; }
  else if (f.phase === 'wait') by += Math.sin(t * 3) * 0.8 + (f.nibble > 0 ? 2 : 0);
  else if (f.phase === 'bite') by += 3 + Math.sin(t * 30) * 1.5;
  else if (f.phase === 'rhythm') { bx += Math.sin(t * 11) * 2.5; by += 2 + Math.sin(t * 7) * 1.5; }
  // 줄: 처지는 곡선 (당기면 팽팽)
  const tight = f.phase === 'rhythm' || f.phase === 'bite';
  g.strokeStyle = 'rgba(240,240,240,0.85)'; g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(tipX, tipY); g.quadraticCurveTo((tipX + bx) / 2, Math.max(tipY, by) + (tight ? 2 : 12), bx, by - 2); g.stroke();
  if (f.phase !== 'cast') { // 물결
    const ph = (t * 0.8) % 1; g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ph)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(bx, by + 1, 3 + ph * 8, 1 + ph * 3, 0, 0, Math.PI * 2); g.stroke();
  }
  R(g, OL, bx - 2, by - 5, 5, 7); R(g, '#e83a3a', bx - 1, by - 4, 3, 3); R(g, '#ffffff', bx - 1, by - 1, 3, 2); R(g, OL, bx, by - 7, 1, 2);
  return { bx, by };
}
// 밭 한 칸: 간 흙 (물 주면 짙고 반짝)
export function drawSoil(g, x, y, wet, t) {
  const px = x * TILE, py = y * TILE;
  R(g, wet ? '#4a321e' : '#6a4a2e', px + 1, py + 1, 14, 14);
  for (let k = 0; k < 4; k++) { R(g, wet ? '#36240f' : '#523822', px + 1, py + 3 + k * 4, 14, 1); R(g, wet ? '#5e4228' : '#86623e', px + 1, py + 2 + k * 4, 14, 1); }
  R(g, 'rgba(0,0,0,0.25)', px + 1, py + 14, 14, 1);
  if (wet && Math.sin(t * 2 + x * 3 + y) > 0.6) R(g, 'rgba(180,220,255,0.6)', px + 4 + (x * 7 % 7), py + 5 + (y * 5 % 6), 2, 1);
}
// 작물 (단계별)
export function drawCrop(g, x, y, pl, t) {
  const c = CROPS[pl.crop]; if (!c) return;
  const cx = x * TILE + 8, by = y * TILE + 13, k = pl.stage / c.stages, ripe = pl.stage >= c.stages;
  const sw = Math.sin(t * 1.8 + x * 1.3 + y) * (ripe ? 0.6 : 0.4);
  const [a, b, leaf] = c.icon;
  if (pl.stage === 0) { R(g, '#3a2818', cx - 1, by - 1, 3, 2); R(g, leaf, cx, by - 3, 1, 2); return; } // 막 심은 씨앗 · 싹
  const leaves = (n, h, spread, col = leaf) => { for (let i = 0; i < n; i++) { const dx = (i - (n - 1) / 2) * spread; g.strokeStyle = OL; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, by); g.quadraticCurveTo(cx + dx * 0.4, by - h * 0.6, cx + dx + sw, by - h); g.stroke(); } for (let i = 0; i < n; i++) { const dx = (i - (n - 1) / 2) * spread; g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, by); g.quadraticCurveTo(cx + dx * 0.4, by - h * 0.6, cx + dx + sw, by - h); g.stroke(); } };
  if (!ripe) { leaves(2 + Math.floor(k * 3), 4 + k * 8, 2.5 + k * 2); return; }
  switch (pl.crop) {
    case 'turnip': R(g, OL, cx - 5, by - 6, 10, 7); R(g, a, cx - 4, by - 5, 8, 5); R(g, b, cx - 4, by - 5, 8, 2); leaves(3, 10, 4); break;
    case 'carrot': leaves(4, 11, 3.5); R(g, OL, cx - 3, by - 3, 6, 4); R(g, a, cx - 2, by - 2, 4, 3); break;
    case 'potato': leaves(5, 9, 3.5); for (const [dx, dy] of [[-3, -9], [3, -8]]) { R(g, OL, cx + dx - 1, by + dy - 1, 4, 4); R(g, '#f4f0ff', cx + dx, by + dy, 2, 2); R(g, '#e8c040', cx + dx, by + dy, 1, 1); } break;
    case 'wheat': for (let i = -2; i <= 2; i++) { const xx = cx + i * 3 + sw * 2; R(g, '#b8a050', cx + i * 3, by - 10, 1, 10); R(g, OL, xx - 2, by - 16, 4, 7); R(g, a, xx - 1, by - 15, 2, 5); R(g, b, xx - 1, by - 15, 1, 5); } break;
    case 'strawberry': leaves(5, 8, 3.5); for (const [dx, dy] of [[-4, -3], [3, -5], [0, -2]]) { R(g, OL, cx + dx - 2, by + dy - 2, 5, 5); R(g, a, cx + dx - 1, by + dy - 1, 3, 3); R(g, b, cx + dx, by + dy, 1, 1); } break;
    case 'pumpkin': { leaves(3, 7, 6, '#4a7a2a'); g.fillStyle = OL; g.beginPath(); g.ellipse(cx, by - 5, 8, 6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = a; g.beginPath(); g.ellipse(cx, by - 5, 7, 5, 0, 0, Math.PI * 2); g.fill(); for (const dx of [-3, 0, 3]) R(g, b, cx + dx, by - 9, 1, 8); R(g, '#ffc070', cx - 4, by - 8, 2, 2); R(g, OL, cx - 1, by - 13, 3, 3); R(g, '#4a7a2a', cx, by - 12, 1, 2); break; }
    case 'starflower': {
      leaves(3, 9, 4, '#3e8a52');
      const a2 = 0.45 + 0.3 * Math.sin(t * 3 + x); const gl = g.createRadialGradient(cx, by - 12, 1, cx, by - 12, 14); gl.addColorStop(0, `rgba(255,240,160,${a2})`); gl.addColorStop(1, 'rgba(255,240,160,0)'); g.fillStyle = gl; g.fillRect(cx - 14, by - 26, 28, 28);
      g.fillStyle = OL; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.4 : 6, an = -Math.PI / 2 + i * Math.PI / 5 + sw * 0.05; g.lineTo(cx + Math.cos(an) * (r + 1), by - 12 + Math.sin(an) * (r + 1)); } g.fill();
      g.fillStyle = a; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2 : 5, an = -Math.PI / 2 + i * Math.PI / 5 + sw * 0.05; g.lineTo(cx + Math.cos(an) * r, by - 12 + Math.sin(an) * r); } g.fill();
      R(g, b, cx - 1, by - 13, 2, 2);
      break;
    }
  }
}

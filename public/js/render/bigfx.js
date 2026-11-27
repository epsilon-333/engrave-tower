// 렌더러 — 대표 기술 연출 (혜성 · 운석 · 폭풍 · 지진 · 심판 · 용 · 시간 정지 …)
// 「멋진 스킬은 화려하게」: 준비(기가 모이고 하늘이 어두워진다) → 본동작(꼬리를 끌며 비스듬히 내리꽂힘) → 맞는 순간(번쩍 · 흔들림 · 조각난 땅 · 가시) → 여운(서리 · 연기 · 불씨)
// 층을 겹친다: 뒤 빛(더하기) · 짙은 외곽선 몸통 · 밝은 면 · 앞 파편 · 바닥 자국. 원 · 타원 · 막대 그대로 쓰지 않는다 (들쭉날쭉한 외곽 · 조각 · 결)
// 그림 사건만 쓴다 (시뮬레이션 수치는 건드리지 않는다). this 는 Renderer
import { hexA } from './color.js';
import { sfx } from '../audio.js';
import { classHit, skillClass, keepsSpike } from './classfx.js';

const TAU = Math.PI * 2;
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// 어둠 → 흰빛 여섯 단계 (0 외곽선 · 1 그늘 · 2 몸 · 3 밝은 몸 · 4 빛 · 5 흰 심)
export const BPAL = {
  ice: ['#0a1a34', '#1f4f86', '#3f8cd0', '#86d0f4', '#d0f4ff', '#ffffff'],
  fire: ['#2a0804', '#7a1c08', '#d0441a', '#ff8a2a', '#ffd25a', '#fff6d8'],
  bolt: ['#1a1a3a', '#4a4a9a', '#8a8ae8', '#e8e870', '#fffbb0', '#ffffff'],
  holy: ['#2a2008', '#7a5e18', '#c8a030', '#ffd84a', '#fff0a8', '#ffffff'],
  dark: ['#0c0418', '#2e0f4a', '#5a1f86', '#9048d0', '#d098ff', '#f4e4ff'],
  arcane: ['#120a2e', '#33207a', '#5e45c0', '#9a80f0', '#d6c8ff', '#ffffff'],
  earth: ['#1a1208', '#4a3418', '#7a5a30', '#a88454', '#d8c094', '#f4ead0'],
  poison: ['#0e1e08', '#2a4a12', '#4f8a1e', '#86c83a', '#c8f08a', '#f4ffd8'],
  blood: ['#1e0408', '#5a0c18', '#a8202e', '#e04a4a', '#ff9a8a', '#fff0e8'],
  forest: ['#0e1e0a', '#24461a', '#3f7a2a', '#6fb84a', '#b8f08a', '#f0ffe0'],
};
// 대표 기술: pal 색 · fall 하늘에서 떨어지는 것(comet 얼음 혜성 · meteor 불 운석 · spear 빛 창 · orb 거대 화염구) · spike 맞은 자리에서 솟는 것 · dim 하늘 어둡게 · big 크기
export const BIG = {
  iceComet: { pal: 'ice', fall: 'comet', spike: 'ice', dim: 0.28, big: 1.1 },
  meteorFall: { pal: 'fire', fall: 'meteor', spike: 'fire', dim: 0.3, big: 1.2 },
  grandFireball: { pal: 'fire', fall: 'orb', spike: 'fire', dim: 0.22, big: 1.1 },
  wordSky: { pal: 'fire', fall: 'meteor', spike: 'fire', dim: 0.3, big: 1.1 },
  wordCataclysm: { pal: 'fire', fall: 'meteor', spike: 'fire', dim: 0.4, big: 1.2 },
  absoluteZero: { pal: 'ice', spike: 'ice', dim: 0.3, big: 1.3 },
  blizzard: { pal: 'ice', spike: 'ice', dim: 0.3, big: 1.1 },
  glacialSpikes: { pal: 'ice', spike: 'ice', big: 1 },
  thunderStorm: { pal: 'bolt', spike: 'bolt', dim: 0.4, big: 1 },
  wordThunder: { pal: 'bolt', spike: 'bolt', dim: 0.3, big: 0.9 },
  judgement: { pal: 'holy', fall: 'spear', spike: 'holy', dim: 0.32, big: 1.2 },
  hLightRain: { pal: 'holy', spike: 'holy', dim: 0.25, big: 0.7, light: true },
  skyfall: { pal: 'holy', spike: 'earth', dim: 0.25, big: 1.2 },
  skyPiercer: { pal: 'holy', spike: 'holy', dim: 0.2, big: 1 },
  quake: { pal: 'earth', spike: 'earth', big: 1.1 },
  extinction: { pal: 'earth', spike: 'earth', dim: 0.35, big: 1.4 },
  colossus: { pal: 'earth', spike: 'earth', big: 1.2 },
  wordEarth: { pal: 'earth', spike: 'earth', big: 1 },
  hLavaRift: { pal: 'fire', spike: 'fire', dim: 0.2, big: 1.2 },
  spiritBurst: { pal: 'forest', spike: 'forest', big: 1 },
  rageBurst: { pal: 'blood', spike: 'fire', big: 1 },
  dragonForm: { pal: 'fire', spike: 'fire', dim: 0.25, big: 1.2 },
  apexPredator: { pal: 'blood', spike: 'earth', big: 1.1 },
  undying: { pal: 'holy', spike: 'holy', dim: 0.2, big: 1 },
  venomBurst: { pal: 'poison', spike: 'poison', big: 1 },
  doomBrand: { pal: 'dark', spike: 'dark', dim: 0.2, big: 0.9 },
  corpseBlast: { pal: 'dark', spike: 'dark', big: 0.9 },
  plagueNova: { pal: 'poison', spike: 'poison', big: 1 },
  arrowRain: { pal: 'earth', spike: 'earth', big: 0.6, light: true },
  wordFire: { pal: 'fire', spike: 'fire', big: 0.9 },
  bladeStorm: { pal: 'earth', spike: 'earth', big: 0.8, light: true },
  thunderClap: { pal: 'bolt', spike: 'bolt', big: 0.9 },
};
// 범용 범위 그림이 동그란 고리를 겹쳐 그리는 것들: 대표 기술은 그 고리를 그리지 않는다
const RING_FX = new Set(['shatter', 'zero', 'timestop', 'arcane', 'implode', 'holy', 'doom', 'corpse', 'ice']);

// ───── 모양 도우미 ─────
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
// 들쭉날쭉한 덩이 (결정 · 바위 · 불덩이): 꼭짓점마다 길이가 다르다
function lump(x, y, r, n, seed, rot = 0, sq = 1) { const rr = rnd(seed), pts = []; for (let i = 0; i < n; i++) { const a = rot + (i / n) * TAU, d = r * (0.62 + rr() * 0.5); pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * sq]); } return pts; }
// 꼬리: 몸에서 뒤로 가늘어지며 가장자리가 일렁이는 띠 (지그재그 외곽 · 끝은 조각으로 흩어진다)
function ribbon(x, y, ux, uy, L, w0, seed, t, wob = 0.45) {
  const rr = rnd(seed + Math.floor(t * 20)), nx = -uy, ny = ux, N = 18, L1 = [], R1 = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, w = w0 * Math.pow(1 - u, 0.75) * (1 + (rr() - 0.5) * wob * 2) * (i % 2 && i > 2 ? 0.62 : 1), sw = Math.sin(t * 18 + i * 1.3 + seed) * w0 * 0.25 * u;
    const cx = x - ux * L * u + nx * sw, cy = y - uy * L * u + ny * sw;
    L1.push([cx + nx * w, cy + ny * w]); R1.unshift([cx - nx * w * (0.8 + rr() * 0.4), cy - ny * w * (0.8 + rr() * 0.4)]);
  }
  return L1.concat(R1);
}
// 끝이 뾰족한 가시 (아래 넓고 위 뾰족 · 왼쪽 그늘 · 오른쪽 밝은 면)
function spike(g, x, y, h, w, lean, P, al = 1) {
  const tx = x + lean * h, ty = y - h;
  g.globalAlpha = al;
  g.fillStyle = P[0]; poly(g, [[x - w - 1, y + 1], [tx, ty - 1.5], [x + w + 1, y + 1], [x, y + 2.5]]); g.fill();
  g.fillStyle = P[2]; poly(g, [[x - w, y], [tx, ty], [x, y + 1.5]]); g.fill();
  g.fillStyle = P[4]; poly(g, [[x, y + 1.5], [tx, ty], [x + w, y]]); g.fill();
  g.fillStyle = P[5]; g.fillRect(Math.round(tx + (x - tx) * 0.25), Math.round(ty + (y - ty) * 0.25), 1, 2);
  g.globalAlpha = 1;
}

// 불꽃 혀: 아래가 넓고 위로 꼬이며 끝이 갈라진다 (짙은 테 · 주황 몸 · 노란 속 · 흰 심)
function tongue(g, x, y, h, w, ph, t, P) {
  const layer = (hh, ww, c) => { const L = [], Rt = [], N = 6; for (let i = 0; i <= N; i++) { const u = i / N, sw = Math.sin(t * 14 + ph + u * 4) * ww * 0.6 * u, wd = ww * Math.pow(1 - u, 0.8) * (1 + 0.25 * Math.sin(t * 20 + i * 2 + ph)); L.push([x + sw - wd, y - hh * u]); Rt.unshift([x + sw + wd, y - hh * u]); } g.fillStyle = c; poly(g, L.concat(Rt)); g.fill(); };
  layer(h + 2, w + 1.2, P[1]); layer(h, w, P[3]); layer(h * 0.66, w * 0.62, P[4]); layer(h * 0.3, w * 0.3, P[5]);
}
// ───── 그림 (skillanim 의 DRAW 에 붙는다: (R, g, a, k, dt)) ─────
export const BIG_DRAW = {
  // 떨어지는 것: 하늘 높은 곳에서 비스듬히 · 꼬리를 길게 끌며 · 결정 조각과 서리 안개 / 불씨 · 연기를 흘린다. 땅엔 점묘 그림자가 커진다
  bigFall(R, g, a, k) {
    const P = BPAL[a.pal], S = a.size, kk = a.style === 'spear' ? k * k * k : k * k;
    const sx = a.x + a.ox, sy = a.y + a.oy, x = sx + (a.x - sx) * kk, y = sy + (a.y - sy) * kk;
    const dx = a.x - sx, dy = a.y - sy, L0 = Math.hypot(dx, dy) || 1, ux = dx / L0, uy = dy / L0;
    { // 땅: 점묘 그림자 + 가까워질수록 밝아지는 땅의 빛 점
      const rx = Math.round(S * (0.8 + k * 1.6)), ry = Math.max(1, Math.round(rx * 0.42));
      for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) { const q = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry); if (q > 1) continue; if (((xx + yy) & 1) && q > 0.35 && k < 0.8) continue; g.fillStyle = q < 0.3 * k ? hexA(P[3], 0.5 * k) : 'rgba(14,10,18,0.5)'; g.fillRect(Math.round(a.x + xx), Math.round(a.y + 2 + yy), 1, 1); }
    }
    const tl = (a.style === 'spear' ? 1.4 : 1) * S * 9 * Math.min(1, k * 2.5), w0 = S * (a.style === 'spear' ? 0.45 : 1);
    g.save();
    g.globalCompositeOperation = 'lighter'; // 뒤 빛: 꼬리 둘레의 흐린 빛 (약하게)
    g.fillStyle = hexA(P[2], 0.12); poly(g, ribbon(x, y, ux, uy, tl * 1.05, w0 * 1.6, a.seed, a.t, 0.5)); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = P[0]; poly(g, ribbon(x, y, ux, uy, tl * 0.85, w0 * 1.05, a.seed + 5, a.t)); g.fill(); // 꼬리: 짙은 테 → 몸 → 밝은 속 → 흰 심
    g.fillStyle = P[2]; poly(g, ribbon(x, y, ux, uy, tl * 0.75, w0 * 0.8, a.seed + 6, a.t)); g.fill();
    g.fillStyle = P[3]; poly(g, ribbon(x, y, ux, uy, tl * 0.5, w0 * 0.5, a.seed + 7, a.t)); g.fill();
    g.fillStyle = P[5]; poly(g, ribbon(x, y, ux, uy, tl * 0.25, w0 * 0.2, a.seed + 9, a.t, 0.2)); g.fill();
    // 몸통: 짙은 외곽 → 몸 → 밝은 면 → 흰 점 (얼음은 결정 뿔이 뒤로 뻗는다)
    const rot = a.t * (a.style === 'comet' ? 2 : 5);
    if (a.style === 'comet') for (let i = 0; i < 4; i++) { const an = Math.atan2(-uy, -ux) + (i - 1.5) * 0.45, l = S * (1.5 + (i % 2) * 0.6); g.fillStyle = P[0]; poly(g, [[x + Math.cos(an + 1.4) * S * 0.4, y + Math.sin(an + 1.4) * S * 0.4], [x + Math.cos(an) * l, y + Math.sin(an) * l], [x + Math.cos(an - 1.4) * S * 0.4, y + Math.sin(an - 1.4) * S * 0.4]]); g.fill(); g.fillStyle = P[3]; poly(g, [[x, y], [x + Math.cos(an) * (l - 1.5), y + Math.sin(an) * (l - 1.5)], [x + Math.cos(an - 1.2) * S * 0.3, y + Math.sin(an - 1.2) * S * 0.3]]); g.fill(); }
    const n = a.style === 'spear' ? 5 : 8, bs = a.style === 'spear' ? S * 0.7 : S;
    g.fillStyle = P[0]; poly(g, lump(x, y, bs + 1.5, n, a.seed, rot)); g.fill();
    g.fillStyle = P[2]; poly(g, lump(x, y, bs, n, a.seed, rot)); g.fill();
    g.fillStyle = P[4]; poly(g, lump(x - ux * bs * 0.25 - bs * 0.15, y - uy * bs * 0.25 - bs * 0.2, bs * 0.55, 5, a.seed + 1, rot)); g.fill();
    g.fillStyle = P[5]; g.fillRect(Math.round(x - bs * 0.3), Math.round(y - bs * 0.35), 2, 1); g.fillRect(Math.round(x - bs * 0.1), Math.round(y - bs * 0.15), 1, 1);
    g.restore();
    // 흘리는 것 (프레임마다 조금만: 렉 방지)
    const pt = R.parts;
    if (pt.length < 520) {
      if (Math.random() < 0.8) pt.push({ x: x - ux * bs, y: y - uy * bs, vx: -ux * 60 + (Math.random() - 0.5) * 50, vy: -uy * 60 + (Math.random() - 0.5) * 50, t: 0.35, max: 0.35, color: P[4], g: 0, streak: true, w: 1 });
      if (Math.random() < 0.6) pt.push({ x: x - ux * tl * Math.random() * 0.6, y: y - uy * tl * Math.random() * 0.6, vx: (Math.random() - 0.5) * 16, vy: -8 - Math.random() * 10, t: 0.8, max: 0.8, color: a.pal === 'ice' ? '#e8f8ff' : a.pal === 'fire' ? '#4a3a3a' : P[3], g: -4, steam: true });
      if (a.style === 'comet' && Math.random() < 0.5) pt.push({ x, y, vx: -ux * 80 + (Math.random() - 0.5) * 70, vy: -uy * 80 + (Math.random() - 0.5) * 70, t: 0.5, max: 0.5, color: P[3], g: 120, chunk: true, floor: a.y + 4 });
    }
  },
  // 맞는 순간의 번쩍: 가시가 제각각인 별꽃이 확 피었다 사라진다 (둥근 빛 대신)
  bigBloom(R, g, a, k) {
    const P = BPAL[a.pal], rr = rnd(a.seed), n = 12, e = k < 0.25 ? k / 0.25 : 1, al = 1 - Math.max(0, (k - 0.2) / 0.8), Rr = Math.min(a.r, 46) * (0.5 + 0.6 * e);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [m, c, aa] of [[1, P[3], 0.3], [0.7, P[4], 0.5], [0.38, P[5], 0.85]]) {
      const pts = []; for (let i = 0; i < n * 2; i++) { const an = (i / (n * 2)) * TAU + a.seed, d = i % 2 ? Rr * m * 0.28 : Rr * m * (0.6 + rr() * 0.6); pts.push([a.x + Math.cos(an) * d, a.y - 6 + Math.sin(an) * d * 0.62]); }
      g.fillStyle = hexA(c, aa * al); poly(g, pts); g.fill();
    }
    g.restore();
  },
  // 조각난 땅: 깨진 돌판(얼음판)이 밖으로 튀며 들렸다 떨어진다 · 윗면 밝게 · 짙은 외곽선
  bigShards(R, g, a, k) {
    const P = BPAL[a.slab], rr = rnd(a.seed), n = a.n, out = 1 - Math.pow(1 - k, 3), al = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    g.save(); g.globalAlpha = al;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + rr() * 0.4, d = a.r * (0.25 + out * (0.8 + rr() * 0.5)), s = 2.5 + rr() * 3.5 * a.sz, h = Math.sin(Math.min(1, k * 1.6) * Math.PI) * (6 + rr() * 10) * a.sz;
      const x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d * 0.6, ro = an + k * (rr() - 0.5) * 6;
      g.fillStyle = 'rgba(12,8,6,0.4)'; g.fillRect(Math.round(x - s), Math.round(y + 1), Math.round(s * 2), 1);
      const pts = lump(x, y - h, s, 4 + (i % 2), a.seed + i, ro, 0.7);
      g.fillStyle = P[0]; poly(g, pts.map(([px, py]) => [px + (px - x) * 0.25, py + (py - (y - h)) * 0.25 + 0.6])); g.fill();
      g.fillStyle = P[2]; poly(g, pts); g.fill();
      g.fillStyle = P[4]; poly(g, pts.slice(0, 3).concat([[x, y - h]])); g.fill();
    }
    g.restore();
  },
  // 솟는 것: 성질마다 다른 가시가 차례로 솟았다 무너진다 (얼음 결정 · 바위 · 불꽃 혀 · 어둠 가시 · 빛 결정 · 독 거품 가시)
  bigSpikes(R, g, a, k) {
    const P = BPAL[a.pal], rr = rnd(a.seed), n = a.n, fire = a.kind === 'fire';
    const list = []; for (let i = 0; i < n; i++) { const an = rr() * TAU, d = a.r * (0.3 + Math.sqrt(rr()) * 0.75); list.push({ x: a.x + Math.cos(an) * d, y: a.y + Math.sin(an) * d * 0.6, h: Math.min(34, a.r * (0.25 + rr() * 0.35)) * a.sz, w: 2.5 + rr() * 3 * a.sz, d: rr() * 0.25, lean: (rr() - 0.5) * 0.5, ph: rr() * 6 }); }
    list.sort((p, q) => p.y - q.y);
    for (const s of list) {
      const kk = Math.max(0, (k - s.d) / (1 - s.d)); if (kk <= 0) continue;
      const grow = kk < 0.2 ? 1 + 2.2 * Math.pow(kk / 0.2 - 1, 3) + 1.2 * Math.pow(kk / 0.2 - 1, 2) : 1, fall = kk < 0.65 ? 1 : 1 - (kk - 0.65) / 0.35;
      let h = s.h * Math.max(0, grow) * fall; if (h < 1.5) continue;
      if (fire) { h *= 0.85 + 0.25 * Math.sin(a.t * 22 + s.ph); tongue(g, s.x, s.y, h, s.w * 1.3, s.ph, a.t, P); }
      else spike(g, s.x, s.y, h, s.w, s.lean, P);
    }
    if (!a.broke && k > 0.62 && !fire) { a.broke = true; for (const s of list.slice(0, 10)) for (let i = 0; i < 2; i++) R.parts.push({ x: s.x, y: s.y - s.h * Math.random() * 0.8, vx: (Math.random() - 0.5) * 110, vy: -50 - Math.random() * 70, t: 0.6, max: 0.6, color: P[i ? 4 : 2], g: 380, chunk: true, floor: s.y + 2 }); }
  },
  // 기가 모인다: 성질 빛 조각이 소용돌이치며 몸으로 빨려 들고, 끝에 손끝에서 별꽃이 깜빡인다
  bigCharge(R, g, a, k) {
    const p = R.world?.player, P = BPAL[a.pal]; if (!p) return;
    const x = p.x, y = p.y - 10, rr = rnd(a.seed);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const ph = rr(), u = (k * 1.6 + ph) % 1, d = (1 - u) * 46 * a.sz + 3, an = rr() * TAU + u * 3.2, px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * 0.6;
      const tx = x + Math.cos(an - 0.35) * (d + 7), ty = y + Math.sin(an - 0.35) * (d + 7) * 0.6;
      g.strokeStyle = hexA(P[3], 0.55 * u); g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = hexA(i % 3 ? P[4] : P[5], 0.9 * u); g.fillRect(Math.round(px), Math.round(py), 1 + (i % 2), 1 + (i % 2));
    }
    if (k > 0.45) { const s = 4 + 8 * (k - 0.45) * (1 + Math.sin(a.t * 40) * 0.25), pts = []; for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU + a.t * 3, d = i % 2 ? s * 0.25 : s; pts.push([x + Math.cos(an) * d, y + Math.sin(an) * d]); } g.fillStyle = hexA(P[4], 0.85); poly(g, pts); g.fill(); g.fillStyle = P[5]; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); }
    g.restore();
  },
};
export const BIG_DUR = { bigFall: 0.5, bigBloom: 0.28, bigShards: 0.9, bigSpikes: 1.3, bigCharge: 0.6 };

// ───── 사건 → 연출 ─────
const SPIKE_PAL = { ice: 'ice', earth: 'earth', fire: 'fire', holy: 'holy', dark: 'dark', arcane: 'arcane', poison: 'poison', forest: 'forest', bolt: 'bolt' };
function linger(R, x, y, r, pal, n) { // 여운: 서리 · 연기 · 불씨가 천천히 떠오르며 사라진다
  const P = BPAL[pal], cold = pal === 'ice', hot = pal === 'fire' || pal === 'blood';
  for (let i = 0; i < n; i++) { const an = Math.random() * TAU, d = Math.random() * r; R.parts.push({ x: x + Math.cos(an) * d, y: y + Math.sin(an) * d * 0.6, vx: (Math.random() - 0.5) * 10, vy: -6 - Math.random() * 16, t: 1.2 + Math.random() * 1.2, max: 2.4, color: cold ? (i % 2 ? '#e8f8ff' : '#b8e4f8') : hot ? (i % 3 ? '#3a3034' : '#5a4a44') : P[3], g: -3, steam: true }); }
  for (let i = 0; i < n; i++) { const an = Math.random() * TAU, d = Math.random() * r * 0.8; R.parts.push({ x: x + Math.cos(an) * d, y: y + Math.sin(an) * d * 0.6, vx: (Math.random() - 0.5) * 14, vy: -10 - Math.random() * 26, t: 1 + Math.random(), max: 2, color: i % 3 ? P[4] : P[5], g: cold ? 6 : -8, size: 1 }); }
}
function impact(R, w, ev, C, opt = {}) {
  const A = R.anims, x = ev.x, y = ev.y, r = Math.max(26, (ev.r || 30)) * (C.big || 1) * (opt.scale || 1), light = C.light || opt.light;
  const now = performance.now() / 1000, first = now - (R._bigT || 0) > 0.35; R._bigT = now; // 연달아 터질 때(폭풍 · 화살비)는 큰 번쩍 · 흔들림을 한 번만
  const onLand = !w.wallAt?.(x, y) && !w.solid?.(x, y);
  A.add('bigBloom', { x, y, r: r * (light ? 0.6 : 0.9), pal: C.pal });
  if (onLand) A.add('bigShards', { x, y, r: r * 0.9, n: light ? 6 : 12, sz: light ? 0.7 : 1 * (C.big || 1), slab: C.spike === 'ice' || C.pal === 'ice' ? 'ice' : 'earth' });
  const sp = SPIKE_PAL[C.spike] || C.pal;
  if (onLand && C.spike === 'bolt') { if (!light) A.add('lightning', { x, y, r: r * 0.6 }); }
  else if (onLand && !keepsSpike(ev.sk) && classHit(R, w, skillClass(ev.sk), x, y, r * 0.9, { tier: 5, hand: true, el: C.pal === 'ice' ? 'ice' : C.pal === 'bolt' ? 'bolt' : 'fire' })) { /* 갈래 그림 */ } // 갈래 그림 (가시는 가시 스킬만 · 2026-11-27)
  else if (onLand) A.add('bigSpikes', { x, y, r: r * 0.85, n: light ? 5 : Math.round(9 + 5 * (C.big || 1)), sz: light ? 0.6 : C.big || 1, pal: sp, kind: C.spike, max: C.spike === 'fire' ? 1.1 : 1.3 });
  if (onLand && !light) A.add('cracks', { x, y, r: r * 1.1, col: BPAL[C.pal][3], max: 2.6 });
  for (let i = 0; i < (light ? 6 : 16); i++) { const an = Math.random() * TAU, v = 80 + Math.random() * 140; R.parts.push({ x, y: y - 4, vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.6 - 60, t: 0.5 + Math.random() * 0.3, max: 0.8, color: BPAL[C.pal][i % 2 ? 3 : 5], g: 300, chunk: true, floor: y + Math.sin(an) * 10 + 4 }); }
  linger(R, x, y, r * 0.8, C.pal, light ? 3 : 9);
  if (!first || light) { R.shake = Math.max(R.shake, light ? 2 : 4); return; }
  R.shake = Math.max(R.shake, Math.min(9, 5 + 3 * (C.big || 1)));
  const P = BPAL[C.pal][4], hx = P.replace('#', ''), rgb = [0, 2, 4].map((i) => parseInt(hx.slice(i, i + 2), 16)).join(',');
  R.flash = { color: rgb, t: 0.12, max: 0.12 };
  if (C.fall || (C.big || 1) >= 1.2) R.addStop(0.1);
}
// 하늘을 어둡게: 준비 동안 천천히 · 맞은 뒤 천천히 걷힌다 (renderer 가 this.dim 을 그린다)
function dimSky(R, a, dur) { const t = dur + 0.7; if (!R.dim || R.dim.a <= a || R.dim.t < t) R.dim = { a, t, max: t }; }

export function bigFx(ev, w) {
  const C = BIG[ev.sk]; if (!C) return false;
  const t = ev.t;
  if (t === 'cast') { // 준비: 기가 모인다 · 큰 기술은 하늘이 어두워진다
    this.anims.add('bigCharge', { pal: C.pal, sz: C.big || 1, max: ev.dur || 0.5 });
    if (C.dim) dimSky(this, C.dim, ev.dur || 0.5);
    sfx('cast', { vol: 0.5, rate: 0.6 });
    return false;
  }
  if (t === 'skillFall' && C.fall) { // 본동작: 하늘에서 비스듬히 내리꽂힘
    const S = Math.max(5, Math.min(9, (ev.r || 40) * 0.15)) * (C.big || 1), spear = C.fall === 'spear';
    const side = (w.player && ev.x < w.player.x) ? 1 : -1;
    this.anims.add('bigFall', { x: ev.x, y: ev.y, ox: spear ? side * 30 : side * 170, oy: spear ? -320 : -300, size: S, pal: C.pal, style: C.fall, max: Math.max(0.25, ev.dur || 0.4) });
    if (C.dim) dimSky(this, C.dim, ev.dur || 0.4);
    sfx('cast', { vol: 0.6, rate: 0.5 });
    return 'own';
  }
  if (t === 'skillAoe') { impact(this, w, ev, C); return RING_FX.has(ev.fx) || C.fall ? 'own' : false; }
  if (t === 'skillLine') { // 일직선: 끝 쪽으로 가며 차례로 터진다
    const n = 4; for (let i = 1; i <= n; i++) { const u = i / n; impact(this, w, { x: ev.x1 + (ev.x2 - ev.x1) * u, y: ev.y1 + (ev.y2 - ev.y1) * u, r: (ev.w || 24) * 1.1, sk: ev.sk }, C, { scale: 0.55 + u * 0.3, light: i < n }); }
    return false;
  }
  if (t === 'skillSingle') { impact(this, w, { x: ev.x, y: ev.y, r: 30, sk: ev.sk }, C, { scale: 0.8 }); return false; }
  if (t === 'buff' && (C.big || 1) >= 1 && !keepsSpike(ev.sk) && classHit(this, w, skillClass(ev.sk), ev.x, ev.y, 26, { tier: 5, max: 1 })) { linger(this, ev.x, ev.y, 20, C.pal, 5); return false; }
  if (t === 'buff' && (C.big || 1) >= 1) { this.anims.add('bigSpikes', { x: ev.x, y: ev.y, r: 30, n: 10, sz: 0.8, pal: SPIKE_PAL[C.spike] || C.pal, kind: C.spike === 'fire' ? 'fire' : 'x', max: 1 }); linger(this, ev.x, ev.y, 20, C.pal, 5); return false; }
  return false;
}

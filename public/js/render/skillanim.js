// 스킬 애니메이션: 반짝이가 아니라 '물체'가 생기고 · 움직이고 · 변한다.
// 떨어지는 운석 · 부풀었다 연기가 되는 폭발 · 땅에서 솟았다 부서지는 얼음 가시 · 하늘에서 내리꽂는 빛기둥 · 갈라지는 땅
// 어둠의 문과 촉수 · 자라났다 시드는 덩굴 · 화살비 · 하늘에서 떨어지는 벼락 · 독구름 · 모여드는 비전 문양 · 칼날 초승달
// 평타에는 쓰지 않는다 (스킬 · 무기 기술 · 보스 기술만)
const hexA = (hex, a) => { const n = parseInt((hex || '#ffffff').slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; };
const ease = { out: (k) => 1 - (1 - k) * (1 - k), in: (k) => k * k, outBack: (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2) };
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// 모양 도우미: 원 · 타원 대신 가늘어지는 가시 · 오목한 별 · 일렁이는 덩어리
const spikePath = (g, x0, y0, x1, y1, w, bend = 0) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend; g.moveTo(x0 + nx * w, y0 + ny * w); g.quadraticCurveTo(mx + nx * w * 0.6, my + ny * w * 0.6, x1, y1); g.quadraticCurveTo(mx - nx * w * 0.6, my - ny * w * 0.6, x0 - nx * w, y0 - ny * w); g.closePath(); };
const starPath = (g, x, y, s, n = 4, rot = 0, pinch = 0.18) => { for (let i = 0; i < n; i++) { const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2; if (!i) g.moveTo(x + Math.cos(a0) * s, y + Math.sin(a0) * s); g.quadraticCurveTo(x + Math.cos(am) * s * pinch, y + Math.sin(am) * s * pinch, x + Math.cos(a1) * s, y + Math.sin(a1) * s); } g.closePath(); };
const blobPath = (g, x, y, rx, ry, t, seed, n = 9, wob = 0.22) => { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, f = 1 + wob * Math.sin(t * 1.7 + i * 2.1 + seed) + wob * 0.5 * Math.sin(t * 2.9 + i * 1.3 + seed * 2); pts.push([x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f]); } for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (!i) g.moveTo(mx, my); else g.quadraticCurveTo(p[0], p[1], mx, my); } const p0 = pts[0], q0 = pts[1]; g.quadraticCurveTo(p0[0], p0[1], (p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2); g.closePath(); };
// 독 안개: 땅에 고인 독 웅덩이(일렁이는 테두리) + 감겨 오르는 안개 줄기 + 부풀었다 터지는 거품 — 스킬 구름과 깔린 독구름이 함께 쓴다
export function drawMiasma(g, x, y, r, t, al, seed, pal = ['#2e4a16', '#6aa82a', '#b8f060', '#e8ffb0'], R = null) {
  if (al <= 0.01 || r < 2) return;
  g.save();
  g.fillStyle = hexA(pal[0], 0.4 * al); g.beginPath(); blobPath(g, x, y + 2, r * 0.95, r * 0.3, t * 0.5, seed, 13, 0.24); g.fill(); // 번진 독 얼룩
  { const rp = rnd(seed * 3 + 5); for (let i = 0; i < 4; i++) { const px = x + (rp() - 0.5) * r * 1.1, py = y + (rp() - 0.5) * r * 0.3, pr = r * (0.18 + rp() * 0.16); g.fillStyle = hexA(i % 2 ? pal[1] : pal[0], 0.45 * al); g.beginPath(); blobPath(g, px, py, pr, pr * 0.32, t * 0.9, seed + i * 5, 8, 0.28); g.fill(); g.strokeStyle = hexA(pal[2], 0.35 * al); g.lineWidth = 0.7; g.beginPath(); g.moveTo(px - pr * 0.5, py - pr * 0.12); g.quadraticCurveTo(px, py - pr * 0.25, px + pr * 0.4, py - pr * 0.1); g.stroke(); } } // 고인 웅덩이 · 젖은 빛
  const rr = rnd(seed * 7 + 1), n = Math.round(4 + r / 10);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) { // 안개 줄기: 아래가 굵고 위로 갈수록 가늘게 꼬이며 오른다
    const bx = x + (rr() - 0.5) * r * 1.4, by = y + (rr() - 0.5) * r * 0.5, h = r * (0.5 + rr() * 0.6), ph = rr() * 6, life = (t * (0.35 + rr() * 0.3) + rr()) % 1, fade = Math.sin(life * Math.PI);
    let px = bx, py = by; const SEG = 8;
    for (let j = 1; j <= SEG; j++) {
      const u = j / SEG, nx = bx + Math.sin(t * 1.6 + ph + u * 4) * r * 0.18 * u, ny = by - h * u * (0.6 + life * 0.6);
      g.strokeStyle = hexA(j < 3 ? pal[1] : pal[2], 0.28 * al * fade * (1 - u * 0.6)); g.lineWidth = Math.max(0.8, r * 0.16 * (1 - u * 0.85)); g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke(); px = nx; py = ny;
    }
  }
  for (let i = 0; i < 5; i++) { // 거품: 부풀며 테두리가 빛나다 터진다 (터질 때 가는 금)
    const bx = x + (rr() - 0.5) * r * 1.2, by = y + (rr() - 0.5) * r * 0.45, life = (t * (0.6 + rr() * 0.5) + rr()) % 1, s = 1.5 + life * (2 + rr() * 3);
    if (life < 0.85) { g.fillStyle = hexA(pal[1], 0.6 * al); g.beginPath(); blobPath(g, bx, by - s * 0.6, s, s * 0.8, t * 4, seed + i, 6, 0.08); g.fill(); g.strokeStyle = hexA(pal[3], 0.8 * al); g.lineWidth = 0.8; g.beginPath(); g.moveTo(bx - s * 0.5, by - s * 1.1); g.quadraticCurveTo(bx - s * 0.1, by - s * 1.4, bx + s * 0.3, by - s * 1.2); g.stroke(); }
    else { const k2 = (life - 0.85) / 0.15; g.strokeStyle = hexA(pal[3], 0.8 * al * (1 - k2)); g.lineWidth = 0.8; g.beginPath(); for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2; g.moveTo(bx + Math.cos(a) * s * 0.5, by - s * 0.6 + Math.sin(a) * s * 0.4); g.lineTo(bx + Math.cos(a) * s * (0.9 + k2), by - s * 0.6 + Math.sin(a) * s * 0.7 * (0.9 + k2)); } g.stroke(); }
  }
  g.restore();
  if (R && Math.random() < 0.25 * al) R.parts.push({ x: x + (Math.random() - 0.5) * r, y: y - Math.random() * r * 0.3, vx: (Math.random() - 0.5) * 8, vy: -18 - Math.random() * 12, t: 0.7, max: 0.7, color: pal[2], g: 0, glow: true, size: 1 });
}
const FIRE = ['#ffffff', '#fff2a0', '#ffc040', '#ff7a2a', '#c8301a', '#3a2a28'];
const ELEM_COL = { fire: '#ff7a2a', ice: '#9fe3ff', lightning: '#f8f070', poison: '#9be15d', dark: '#c45cff', arcane: '#b98aff', wind: '#bfffd0', forest: '#7be38a', holy: '#fff0a0', phys: '#e8dcc8' };

export class SkillAnims {
  constructor(r) { this.r = r; this.list = []; }
  add(type, o) { const max = o.max ?? DUR[type] ?? 0.8; this.list.push({ type, t: 0, max, seed: (Math.random() * 1e9) | 0, ...o, max }); if (this.list.length > 60) this.list.shift(); }

  // 사건 → 애니메이션 고르기 (범위 스킬이 터지는 자리)
  onAoe(ev) {
    const fx = ev.fx, el = ev.elem, r = Math.max(18, Math.min(130, ev.r || 30)), x = ev.x, y = ev.y, big = !!ev.ult;
    if (fx === 'meteor' || (fx === 'burst' && (el === 'fire' || !el) && r >= 30)) return this.add('explosion', { x, y, r, big, col: el ? ELEM_COL[el] : '#ffc040', fire: el === 'fire' || fx === 'meteor' });
    if (fx === 'burst' && el === 'lightning') return this.add('lightning', { x, y, r });
    if (fx === 'burst' && el === 'ice') return this.add('iceSpikes', { x, y, r });
    if (fx === 'burst' && el === 'dark') return this.add('portal', { x, y, r });
    if (fx === 'burst' && (el === 'arcane' || el === 'wind' || el === 'forest')) return this.add('runeBurst', { x, y, r, col: ELEM_COL[el] });
    if (fx === 'burst') return this.add('explosion', { x, y, r, col: ELEM_COL[el] || '#ffc040', fire: el === 'fire' });
    if (fx === 'ice' || fx === 'shatter' || fx === 'zero' || fx === 'crystal') return this.add('iceSpikes', { x, y, r, big: fx === 'zero' || big });
    if (fx === 'holy' || fx === 'pillar') return this.add('lightPillar', { x, y, r, col: fx === 'holy' ? '#fff0a0' : ELEM_COL[el] || '#fff0a0' });
    if (fx === 'doom' || fx === 'corpse') return this.add('portal', { x, y, r });
    if (fx === 'spikes' || fx === 'vines') return this.add('vines', { x, y, r, col: el === 'phys' ? '#c8b088' : '#5fbf4a' });
    if (fx === 'rain') return this.add('arrowRain', { x, y, r, col: ELEM_COL[el] || '#e8dcc8' });
    if (fx === 'rocks') return this.add('rockRain', { x, y, r, col: el === 'ice' ? '#cfefff' : '#9a8a72' });
    if (fx === 'fog' || fx === 'miasma') return this.add('cloud', { x, y, r, col: '#9be15d' });
    if (fx === 'thorns') return this.add('bloodThorns', { x, y, r });
    if (fx === 'bones') return this.add('boneSpikes', { x, y, r });
    if (fx === 'starfall') return this.add('starfall', { x, y, r, col: ELEM_COL[el] || '#bfe0ff' });
    if (fx === 'shards') return this.add('shardBurst', { x, y, r, col: '#e8f4ff' });
    if (fx === 'gale') return this.add('gale', { x, y, r, col: '#c8ffe0' });
    if (fx === 'arcane' || fx === 'implode' || fx === 'timestop') return this.add('runeBurst', { x, y, r, col: ELEM_COL[el] || '#b98aff', implode: fx === 'implode' });
    if (fx === 'quake' || fx === 'smash' || fx === 'slam') return this.add('cracks', { x, y, r, col: el === 'fire' ? '#ff8a3a' : el === 'ice' ? '#9fe3ff' : '#ffd890' });
    if (fx === 'splash') return this.add('cloud', { x, y, r, col: '#8ad8ff', bubble: true });
  }
  // 예고 시간이 있는 범위 스킬: 떨어지는 동안
  onFall(ev) {
    const fx = ev.fx, el = ev.elem;
    if (fx === 'meteor' || (fx === 'burst' && el === 'fire')) this.add('meteorFall', { x: ev.x, y: ev.y, r: ev.r, max: ev.dur, col: '#ff7a2a' });
    else if (fx === 'shatter' || fx === 'ice' || fx === 'zero') this.add('meteorFall', { x: ev.x, y: ev.y, r: ev.r, max: ev.dur, col: '#9fe3ff', ice: true });
    else if (fx === 'holy') this.add('pillarCharge', { x: ev.x, y: ev.y, r: ev.r, max: ev.dur });
  }
  onLine(ev) { this.add('fissure', { x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, w: ev.w || 24, col: ELEM_COL[ev.elem] || '#ffd890', big: ev.ult }); }
  onCone(ev) { if (ev.fx === 'sweep' || ev.fx === 'slashX' || ev.fx === 'claws') this.add('bladeArc', { x: ev.x, y: ev.y, ang: ev.ang, range: ev.range, angle: ev.angle, col: ELEM_COL[ev.elem] || '#f4f0ff', claws: ev.fx === 'claws' }); }

  draw(g, dt) {
    for (const a of this.list) { a.t += dt; const k = Math.min(1, a.t / a.max); const f = DRAW[a.type]; if (f) f(this.r, g, a, k, dt); }
    this.list = this.list.filter((a) => a.t < a.max);
  }
}
// 등급 표식 (탑의 무기 · 장비): 희귀 반짝임 · 영웅 수정 파편 · 전설 금빛 깃털 · 신화 붉은 꽃잎과 빛살
export const RARITY_ANIM = [null, 'glint', 'shardBurst', 'featherBurst', 'mythBloom'];
const DUR = { glint: 0.6, shardBurst: 0.9, featherBurst: 1.4, mythBloom: 1.3, bloodThorns: 1.4, boneSpikes: 1.3, starfall: 1.0, gale: 0.8, explosion: 1.3, lightning: 0.5, iceSpikes: 1.3, lightPillar: 0.9, portal: 1.4, vines: 1.8, arrowRain: 0.9, rockRain: 1.0, cloud: 2.2, runeBurst: 0.8, cracks: 1.4, fissure: 1.3, bladeArc: 0.28, meteorFall: 0.8, pillarCharge: 0.6 };

const DRAW = {
  // 떨어지는 운석 / 얼음덩이: 비스듬히 내려오며 꼬리를 끌고, 땅의 그림자가 커진다
  meteorFall(R, g, a, k) {
    const kk = ease.in(k), sx = a.x - 150, sy = a.y - 280, x = sx + (a.x - sx) * kk, y = sy + (a.y - sy) * kk, sz = Math.max(5, a.r * 0.28);
    g.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * k})`; g.beginPath(); g.ellipse(a.x, a.y + 2, sz * (0.6 + k), sz * 0.4 * (0.6 + k), 0, 0, Math.PI * 2); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 6; i >= 1; i--) { const u = i * 0.05, tx = x - (a.x - sx) * u * 0.6, ty = y - (a.y - sy) * u * 0.6; g.fillStyle = hexA(a.ice ? ['#ffffff', '#e8f8ff', '#bfe8ff', '#8ad8ff', '#5aa8e0', '#3a7ab8'][i - 1] : FIRE[Math.min(5, i - 1)], 0.5 - i * 0.06); g.beginPath(); g.arc(tx, ty, sz * (1 - i * 0.08), 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.fillStyle = a.ice ? '#dff6ff' : '#3a2620'; g.beginPath(); for (let i = 0; i < 7; i++) { const an = (i / 7) * Math.PI * 2 + a.t * 3, rr = sz * (0.8 + 0.25 * Math.sin(i * 2.3 + a.seed)); g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } g.closePath(); g.fill();
    g.strokeStyle = a.ice ? '#ffffff' : '#ffc040'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - sz * 0.4, y - sz * 0.2); g.lineTo(x + sz * 0.1, y + sz * 0.1); g.lineTo(x + sz * 0.3, y - sz * 0.4); g.stroke();
    if (Math.random() < 0.6) R.parts.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, t: 0.4, max: 0.4, color: a.ice ? '#e8f8ff' : '#ff9a3a', g: 0, glow: true, size: 1.5 });
  },
  // 폭발: 하얀 핵 → 부풀어 오르는 불덩이(덩어리 여럿이 색을 바꾸며) → 위로 피어오르는 연기
  explosion(R, g, a, k, dt) {
    const rr = rnd(a.seed), n = a.big ? 18 : 12, Rr = a.r * (a.big ? 1.05 : 0.85), fire = a.fire || !a.col;
    if (k < 0.1) { g.save(); g.globalCompositeOperation = 'lighter'; const rad = Rr * (0.35 + k * 5); const gr = g.createRadialGradient(a.x, a.y - 6, 0, a.x, a.y - 6, rad); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, hexA(fire ? '#fff2a0' : a.col, 0.5)); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(a.x, a.y - 6, rad, 0, Math.PI * 2); g.fill(); g.restore(); }
    // 덩어리: 터지며 바깥으로 · 위로 솟고, 하양 → 노랑 → 주황 → 빨강 → 검은 연기로 식는다 (가운데가 밝고 가장자리는 투명)
    const blobs = [];
    for (let i = 0; i < n; i++) {
      const an = rr() * Math.PI * 2, dist = Rr * (0.1 + rr() * 0.55), delay = rr() * 0.1, kk = Math.max(0, (k - delay) / (1 - delay)), rise = 0.4 + rr() * 0.8, sz = 0.16 + rr() * 0.14;
      if (kk <= 0) continue;
      const push = ease.out(Math.min(1, kk * 2.2));
      blobs.push({ x: a.x + Math.cos(an) * dist * push, y: a.y - 6 + Math.sin(an) * dist * 0.55 * push - kk * kk * Rr * rise, r: Rr * sz * (0.6 + push * 0.8 + kk * 0.9), kk });
    }
    blobs.sort((p, q) => q.kk - p.kk); // 식은(연기) 덩어리를 먼저 · 뜨거운 덩어리를 위에
    for (const b of blobs) {
      const kk = b.kk, smoke = kk > 0.45;
      if (smoke) { const al = 0.55 * (1 - (kk - 0.45) / 0.55); const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); gr.addColorStop(0, hexA('#4a4048', al)); gr.addColorStop(0.7, hexA('#2e2830', al * 0.8)); gr.addColorStop(1, hexA('#2e2830', 0)); g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); continue; }
      const heat = kk / 0.45, c0 = fire ? (heat < 0.3 ? '#ffffff' : heat < 0.6 ? '#fff2a0' : '#ffc040') : heat < 0.4 ? '#ffffff' : a.col, c1 = fire ? (heat < 0.5 ? '#ff9a3a' : '#e0481a') : a.col;
      const gr = g.createRadialGradient(b.x - b.r * 0.2, b.y - b.r * 0.25, 0, b.x, b.y, b.r);
      gr.addColorStop(0, hexA(c0, 0.95)); gr.addColorStop(0.55, hexA(c1, 0.85)); gr.addColorStop(0.85, hexA(fire ? '#8a2410' : '#3a3050', 0.5)); gr.addColorStop(1, hexA('#2a1a14', 0));
      g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
    }
    if (a.t < dt * 1.5) { for (let i = 0; i < (a.big ? 26 : 14); i++) { const an = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160; R.parts.push({ x: a.x, y: a.y - 4, vx: Math.cos(an) * sp, vy: -60 - Math.random() * 140, t: 0.6 + Math.random() * 0.5, max: 1.1, color: i % 3 ? '#5a4a3a' : '#ffb040', g: 420, chunk: true, floor: a.y + (Math.random() - 0.3) * 14 }); } }
    if (k > 0.2 && Math.random() < 0.5) R.parts.push({ x: a.x + (Math.random() - 0.5) * Rr, y: a.y - Math.random() * Rr * 0.6, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30, t: 0.7, max: 0.7, color: '#ff9a3a', g: -10, glow: true, size: 1.5 });
  },
  // 벼락: 하늘에서 지그재그로 내리꽂고 가지가 갈라진다, 땅에 빛 번짐
  lightning(R, g, a, k) {
    const rr = rnd(a.seed + Math.floor(a.t * 30)), top = a.y - 300, al = k < 0.25 ? 1 : 1 - (k - 0.25) / 0.75;
    const pts = [[a.x + (rr() - 0.5) * 40, top]]; const N = 9;
    for (let i = 1; i <= N; i++) { const u = i / N; pts.push([a.x + (rr() - 0.5) * 26 * (1 - u * 0.7), top + (a.y - 4 - top) * u]); }
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, c, aa] of [[7, '#f8f070', 0.35], [3, '#fffbd0', 0.8], [1.2, '#ffffff', 1]]) { g.strokeStyle = hexA(c, aa * al); g.lineWidth = w; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); }
    for (let b = 0; b < 3; b++) { const s = pts[2 + b * 2]; if (!s) continue; let [bx, by] = s; g.strokeStyle = hexA('#fffbd0', 0.6 * al); g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx, by); for (let j = 0; j < 3; j++) { bx += (rr() - 0.5) * 30 + (b - 1) * 8; by += 12 + rr() * 10; g.lineTo(bx, by); } g.stroke(); }
    const gr = g.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r * 1.2); gr.addColorStop(0, hexA('#ffffff', 0.7 * al)); gr.addColorStop(0.4, hexA('#f8f070', 0.4 * al)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(a.x, a.y, a.r * 1.2, a.r * 0.7, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  },
  // 얼음 가시: 땅에서 차례로 솟아올랐다가 금이 가며 부서진다
  iceSpikes(R, g, a, k, dt) {
    const rr = rnd(a.seed), n = a.big ? 16 : 9, spikes = [];
    for (let i = 0; i < n; i++) { const an = rr() * Math.PI * 2, d = a.r * Math.sqrt(rr()) * 0.9; spikes.push({ x: a.x + Math.cos(an) * d, y: a.y + Math.sin(an) * d * 0.6, h: a.r * (0.35 + rr() * 0.5) * (a.big ? 1.3 : 1), w: 4 + rr() * 5, d: rr() * 0.18, lean: (rr() - 0.5) * 0.5 }); }
    spikes.sort((p, q) => p.y - q.y);
    const breakAt = 0.62;
    for (const s of spikes) {
      const kk = Math.max(0, Math.min(1, (k - s.d) / 0.18)); if (kk <= 0) continue;
      const grow = k < breakAt ? ease.outBack(kk) : 1, shrink = k < breakAt ? 1 : 1 - (k - breakAt) / (1 - breakAt), h = s.h * Math.min(1.05, grow) * shrink;
      if (h < 1) continue;
      const tx = s.x + s.lean * h, ty = s.y - h;
      g.fillStyle = 'rgba(20,40,60,0.25)'; g.beginPath(); g.ellipse(s.x, s.y + 1, s.w * 1.2, s.w * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = hexA('#5aa8e0', 0.95 * shrink + 0.05); g.beginPath(); g.moveTo(s.x - s.w, s.y); g.lineTo(tx, ty); g.lineTo(s.x, s.y + 1); g.closePath(); g.fill();
      g.fillStyle = hexA('#dff6ff', 0.95 * shrink + 0.05); g.beginPath(); g.moveTo(s.x, s.y + 1); g.lineTo(tx, ty); g.lineTo(s.x + s.w, s.y); g.closePath(); g.fill();
      g.strokeStyle = hexA('#ffffff', 0.9); g.lineWidth = 1; g.beginPath(); g.moveTo(s.x + s.w * 0.15, s.y - 1); g.lineTo(tx, ty + 1); g.stroke();
      if (k > breakAt - 0.08 && k < breakAt + 0.1) { g.strokeStyle = 'rgba(30,60,90,0.8)'; g.beginPath(); g.moveTo(s.x - s.w * 0.4, s.y - h * 0.3); g.lineTo(s.x + s.w * 0.2, s.y - h * 0.5); g.lineTo(s.x - s.w * 0.1, s.y - h * 0.7); g.stroke(); }
    }
    if (!a.broke && k >= breakAt) { a.broke = true; for (const s of spikes) for (let i = 0; i < 3; i++) R.parts.push({ x: s.x, y: s.y - s.h * Math.random(), vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, t: 0.6, max: 0.6, color: i % 2 ? '#dff6ff' : '#8ad8ff', g: 380, chunk: true, floor: s.y + 2 }); }
  },
  // 빛기둥: 가는 빛이 먼저 꽂히고, 굵어졌다가, 가늘어지며 사라진다. 바닥에서 빛 알갱이가 오른다
  lightPillar(R, g, a, k) {
    const top = a.y - 320, w0 = a.r * 0.55, w = k < 0.12 ? w0 * 0.12 : k < 0.35 ? w0 * (0.12 + (k - 0.12) / 0.23 * 0.88) : w0 * (1 - (k - 0.35) / 0.65), drop = Math.min(1, k / 0.1);
    g.save(); g.globalCompositeOperation = 'lighter';
    const bottom = top + (a.y - top) * drop;
    for (const [mw, c, al] of [[2.2, a.col, 0.25], [1, a.col, 0.55], [0.35, '#ffffff', 0.95]]) { const gr = g.createLinearGradient(a.x - w * mw, 0, a.x + w * mw, 0); gr.addColorStop(0, hexA(c, 0)); gr.addColorStop(0.5, hexA(c, al)); gr.addColorStop(1, hexA(c, 0)); g.fillStyle = gr; g.fillRect(a.x - w * mw, top, w * mw * 2, bottom - top); }
    if (drop >= 1) { const gr = g.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r * 1.3); gr.addColorStop(0, hexA('#ffffff', 0.8 * (1 - k))); gr.addColorStop(0.5, hexA(a.col, 0.4 * (1 - k))); gr.addColorStop(1, hexA(a.col, 0)); g.fillStyle = gr; g.beginPath(); g.ellipse(a.x, a.y, a.r * 1.3, a.r * 0.65, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    if (drop >= 1 && Math.random() < 0.8) R.parts.push({ x: a.x + (Math.random() - 0.5) * a.r * 1.4, y: a.y + (Math.random() - 0.5) * a.r * 0.5, vx: 0, vy: -50 - Math.random() * 60, t: 0.8, max: 0.8, color: Math.random() < 0.5 ? '#ffffff' : a.col, g: -10, glow: true, size: 2 });
  },
  pillarCharge(R, g, a, k) { // 빛기둥 예고: 하늘에서 가는 빛이 흔들리며 내려온다
    g.save(); g.globalCompositeOperation = 'lighter'; const w = 1 + k * 2, al = 0.3 + 0.5 * k * (0.7 + 0.3 * Math.sin(a.t * 40));
    g.fillStyle = hexA('#fff0a0', al); g.fillRect(a.x - w / 2, a.y - 320, w, 320); g.restore();
  },
  // 어둠의 문: 바닥에 소용돌이 문이 열리고, 촉수가 솟았다 들어가고, 문이 닫힌다
  portal(R, g, a, k) {
    const open = k < 0.2 ? ease.out(k / 0.2) : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1, rx = a.r * 0.85 * open, ry = rx * 0.45;
    if (rx < 1) return;
    const gr = g.createRadialGradient(a.x, a.y, 0, a.x, a.y, rx); gr.addColorStop(0, 'rgba(8,0,16,0.95)'); gr.addColorStop(0.7, 'rgba(60,10,90,0.85)'); gr.addColorStop(1, 'rgba(196,92,255,0.0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(a.x, a.y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.ellipse(a.x, a.y, rx, ry, 0, 0, Math.PI * 2); g.clip(); g.strokeStyle = hexA('#c45cff', 0.7); g.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { g.beginPath(); for (let j = 0; j <= 20; j++) { const u = j / 20, an = u * Math.PI * 1.6 + a.t * 4 + i * 2.1, d = rx * (1 - u); g.lineTo(a.x + Math.cos(an) * d, a.y + Math.sin(an) * d * 0.45); } g.stroke(); }
    g.restore();
    const rr = rnd(a.seed), n = Math.round(4 + a.r / 15);
    for (let i = 0; i < n; i++) { // 촉수: 마디마다 흔들리며 끝으로 갈수록 가늘어지고, 끝이 말린다
      const an = rr() * Math.PI * 2, bx = a.x + Math.cos(an) * rx * 0.6, by = a.y + Math.sin(an) * ry * 0.6, ph = Math.max(0, Math.sin(Math.min(1, Math.max(0, (k - 0.12 - rr() * 0.1) / 0.6)) * Math.PI)), h = a.r * (0.55 + rr() * 0.5) * ph, side = rr() < 0.5 ? -1 : 1, ph0 = rr() * 6;
      if (h < 3) continue;
      const SEG = 10, pts = [];
      for (let j = 0; j <= SEG; j++) { const u = j / SEG, wob = Math.sin(a.t * 7 + ph0 + u * 5) * 6 * u, curl = u > 0.75 ? (u - 0.75) * 4 : 0; pts.push([bx + side * (u * u * 14 + wob) + side * curl * 8, by - h * u + curl * curl * 6]); }
      for (let j = 0; j < SEG; j++) { const u = j / SEG, wd = (6 * (1 - u) + 1) * (0.5 + ph * 0.5); g.strokeStyle = '#1e0628'; g.lineCap = 'round'; g.lineWidth = wd + 1.5; g.beginPath(); g.moveTo(pts[j][0], pts[j][1]); g.lineTo(pts[j + 1][0], pts[j + 1][1]); g.stroke(); g.strokeStyle = j % 2 ? '#5a1a78' : '#6a2488'; g.lineWidth = wd; g.beginPath(); g.moveTo(pts[j][0], pts[j][1]); g.lineTo(pts[j + 1][0], pts[j + 1][1]); g.stroke(); }
      g.strokeStyle = hexA('#d890ff', 0.6); g.lineWidth = 1; g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px - side * 1.5, py) : g.moveTo(px - side * 1.5, py))); g.stroke(); // 한쪽 가장자리의 빛
      for (let j = 2; j < SEG - 1; j += 3) { g.fillStyle = '#e8b8ff'; g.fillRect(Math.round(pts[j][0] + side * 2), Math.round(pts[j][1]), 1, 1); } // 빨판
    }
  },
  // 덩굴 · 가시: 땅에서 휘어 자라고, 가시가 돋고, 갈색으로 시들며 들어간다
  vines(R, g, a, k) {
    const rr = rnd(a.seed), n = Math.round(5 + a.r / 10), wither = k > 0.65 ? (k - 0.65) / 0.35 : 0;
    for (let i = 0; i < n; i++) {
      const an = rr() * Math.PI * 2, d = a.r * Math.sqrt(rr()) * 0.85, bx = a.x + Math.cos(an) * d, by = a.y + Math.sin(an) * d * 0.55;
      const grow = ease.out(Math.min(1, Math.max(0, (k - rr() * 0.15) / 0.25))) * (1 - wither * 0.8), h = a.r * (0.45 + rr() * 0.45) * grow, side = rr() < 0.5 ? -1 : 1;
      if (h < 2) continue;
      const cx = bx + side * h * 0.5, tx = bx + side * h * 0.15, ty = by - h, col = wither > 0.3 ? '#6a5a3a' : a.col;
      g.lineCap = 'round'; g.strokeStyle = '#1e3a18'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx, by - h * 0.55, tx, ty); g.stroke();
      g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx, by - h * 0.55, tx, ty); g.stroke();
      for (let j = 1; j <= 3; j++) { const u = j / 4, px = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * cx + u * u * tx, py = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * (by - h * 0.55) + u * u * ty; g.fillStyle = wither > 0.3 ? '#8a7a5a' : '#d8f0a0'; g.beginPath(); g.moveTo(px, py); g.lineTo(px + 4 * (j % 2 ? 1 : -1), py - 2); g.lineTo(px, py - 3); g.closePath(); g.fill(); }
    }
  },
  // 화살비: 하늘에서 비스듬히 쏟아져 땅에 꽂힌다
  arrowRain(R, g, a, k) {
    const rr = rnd(a.seed), n = Math.round(8 + a.r / 5);
    for (let i = 0; i < n; i++) {
      const tx = a.x + (rr() - 0.5) * a.r * 1.8, ty = a.y + (rr() - 0.5) * a.r * 0.9, d = rr() * 0.35, kk = Math.min(1, Math.max(0, (k - d) / 0.18));
      if (kk <= 0) continue;
      const fall = kk < 1, x = tx - 60 * (1 - kk), y = ty - 160 * (1 - kk), al = k > 0.8 ? (1 - k) / 0.2 : 1;
      g.strokeStyle = hexA('#3a2a1a', al); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (fall ? 9 : 5), y - (fall ? 24 : 12)); g.stroke();
      g.fillStyle = hexA(a.col, al); g.fillRect(Math.round(x - (fall ? 9 : 5)) - 1, Math.round(y - (fall ? 24 : 12)) - 1, 3, 3);
      if (!fall) { g.fillStyle = hexA('#000000', 0.25 * al); g.fillRect(Math.round(tx) - 2, Math.round(ty), 4, 1); }
    }
  },
  // 돌 · 우박 비: 떨어져 튀고 부서진다
  rockRain(R, g, a, k) {
    const rr = rnd(a.seed), n = Math.round(5 + a.r / 10);
    for (let i = 0; i < n; i++) {
      const tx = a.x + (rr() - 0.5) * a.r * 1.6, ty = a.y + (rr() - 0.5) * a.r * 0.8, d = rr() * 0.3, kk = Math.min(1, Math.max(0, (k - d) / 0.22)), s = 3 + rr() * 4;
      if (kk <= 0) continue;
      if (kk < 1) { const x = tx - 40 * (1 - kk), y = ty - 180 * (1 - ease.in(kk)); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(tx, ty + 1, s * kk, s * 0.4 * kk, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = a.col; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(x - s * 0.3, y - s * 0.3, s * 0.4, 0, Math.PI * 2); g.fill(); }
      else if (!a['hit' + i]) { a['hit' + i] = true; for (let j = 0; j < 4; j++) R.parts.push({ x: tx, y: ty, vx: (Math.random() - 0.5) * 90, vy: -40 - Math.random() * 60, t: 0.5, max: 0.5, color: a.col, g: 380, chunk: true, floor: ty + 2 }); R.parts.push({ x: tx, y: ty, vx: 0, vy: -10, t: 0.5, max: 0.5, color: '#b8a890', g: 0, puff: true, size: 3 }); }
    }
  },
  // 독구름: 독 웅덩이가 번지고 안개 줄기가 감겨 오르고 거품이 터진다 (물보라는 푸른빛)
  cloud(R, g, a, k) {
    const grow = ease.out(Math.min(1, k * 3)), fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    drawMiasma(g, a.x, a.y, a.r * grow, a.t, fade, a.seed % 97, a.bubble ? ['#1a3a5a', '#4a9ad8', '#9ad8ff', '#e8f8ff'] : undefined, R);
  },
  // 비전 문양: 문양 조각들이 한가운데로 모였다가 터져 흩어진다
  runeBurst(R, g, a, k) {
    const rr = rnd(a.seed), n = 8, conv = Math.min(1, k / 0.45), out = k > 0.45 ? (k - 0.45) / 0.55 : 0;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const an = (i / n) * Math.PI * 2 + rr() * 0.4 + a.t * (a.implode ? 2 : 1), d = out ? a.r * 1.2 * ease.out(out) : a.r * 1.1 * (1 - ease.in(conv)), x = a.x + Math.cos(an) * d, y = a.y - 8 + Math.sin(an) * d * 0.55, s = 5 * (out ? 1 - out : 1);
      if (s <= 0.3) continue;
      g.strokeStyle = hexA(a.col, 0.9); g.lineWidth = 1.5; g.beginPath();
      const t = i % 3; // 문양 세 가지
      if (t === 0) { g.moveTo(x - s, y); g.lineTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.closePath(); }
      else if (t === 1) { g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); }
      else { g.arc(x, y, s * 0.8, 0, Math.PI * 1.5); g.moveTo(x, y - s); g.lineTo(x, y + s); }
      g.stroke();
    }
    if (out > 0 && out < 0.5) { const gr = g.createRadialGradient(a.x, a.y - 8, 0, a.x, a.y - 8, a.r); gr.addColorStop(0, hexA('#ffffff', 0.8 * (1 - out * 2))); gr.addColorStop(0.4, hexA(a.col, 0.5 * (1 - out * 2))); gr.addColorStop(1, hexA(a.col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(a.x, a.y - 8, a.r, 0, Math.PI * 2); g.fill(); }
    g.restore();
  },
  // 땅울림: 한가운데서 금이 사방으로 번지고, 금 사이로 빛이 새고, 돌판이 들썩인다
  cracks(R, g, a, k) {
    const rr = rnd(a.seed), n = 7, spread = ease.out(Math.min(1, k / 0.25)), fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const an = (i / n) * Math.PI * 2 + rr() * 0.6, L = a.r * (0.7 + rr() * 0.5) * spread; let x = a.x, y = a.y; const pts = [[x, y]];
      for (let j = 1; j <= 4; j++) { const u = j / 4, aa = an + (rr() - 0.5) * 0.7; x = a.x + Math.cos(aa) * L * u; y = a.y + Math.sin(aa) * L * u * 0.55; pts.push([x, y]); }
      g.strokeStyle = `rgba(30,20,14,${0.8 * fade})`; g.lineWidth = 3; g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = hexA(a.col, 0.8 * fade); g.lineWidth = 1.2; g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); g.restore();
      const [sx, sy] = pts[2], lift = Math.sin(Math.min(1, k / 0.3) * Math.PI) * 5; // 들썩이는 돌판
      g.fillStyle = `rgba(110,96,78,${fade})`; g.fillRect(Math.round(sx - 3), Math.round(sy - 2 - lift), 6, 3); g.fillStyle = `rgba(160,146,120,${fade})`; g.fillRect(Math.round(sx - 3), Math.round(sy - 2 - lift), 6, 1);
    }
  },
  // 갈라지는 땅 (일직선 스킬): 시작점에서 끝까지 금이 달려가고, 돌판이 솟았다 가라앉는다
  fissure(R, g, a, k) {
    const run = ease.out(Math.min(1, k / 0.2)), fade = k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1, dx = a.x2 - a.x1, dy = a.y2 - a.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, rr = rnd(a.seed);
    const pts = []; for (let j = 0; j <= 12; j++) { const u = (j / 12) * run, off = Math.sin(j * 1.7 + a.seed) * a.w * 0.12 + (rr() - 0.5) * a.w * 0.06; pts.push([a.x1 + dx * u - uy * off, a.y1 + dy * u + ux * off]); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = `rgba(24,16,12,${0.85 * fade})`; g.lineWidth = Math.max(3, a.w * 0.22); g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = hexA(a.col, 0.9 * fade); g.lineWidth = Math.max(1.5, a.w * 0.09); g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); g.restore();
    for (let j = 1; j < pts.length; j += 2) { // 길 양옆의 돌판
      const [px, py] = pts[j], lift = Math.sin(Math.min(1, Math.max(0, (k - j * 0.012) / 0.3)) * Math.PI) * (a.big ? 9 : 6), side = j % 4 === 1 ? 1 : -1, ox = -uy * a.w * 0.4 * side, oy = ux * a.w * 0.4 * side;
      g.fillStyle = `rgba(100,86,70,${fade})`; g.beginPath(); g.moveTo(px + ox - 4, py + oy); g.lineTo(px + ox - 2, py + oy - 4 - lift); g.lineTo(px + ox + 4, py + oy - 3 - lift); g.lineTo(px + ox + 4, py + oy); g.closePath(); g.fill();
      g.fillStyle = `rgba(170,150,120,${fade})`; g.fillRect(Math.round(px + ox - 2), Math.round(py + oy - 4 - lift), 5, 1);
    }
  },
  // 칼날 초승달: 실제로 휘두르는 방향을 따라 두꺼운 날빛이 쓸고 지나간다 (가장자리는 밝고 몸통은 옅게)
  bladeArc(R, g, a, k) {
    const half = Math.min(Math.PI * 0.95, (a.angle || 2) / 2), prog = ease.out(Math.min(1, k / 0.6)), fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    const a0 = a.ang - half, a1 = a0 + half * 2 * prog, Rr = (a.range || 40) * 0.95, inner = Rr * 0.45;
    g.save(); g.translate(a.x, a.y - 6); g.scale(1, 0.75); g.globalCompositeOperation = 'lighter';
    const steps = 10;
    for (let i = 0; i < steps; i++) { // 몸통: 지나간 쪽일수록 옅게
      const u0 = a0 + (a1 - a0) * (i / steps), u1 = a0 + (a1 - a0) * ((i + 1) / steps), al = (0.08 + 0.4 * (i / steps)) * fade;
      g.fillStyle = hexA(a.col, al); g.beginPath(); g.arc(0, 0, Rr, u0, u1); g.arc(0, 0, inner + (Rr - inner) * 0.4 * (1 - i / steps), u1, u0, true); g.closePath(); g.fill();
    }
    g.strokeStyle = hexA('#ffffff', 0.95 * fade); g.lineWidth = a.claws ? 1.5 : 2.5; g.beginPath(); g.arc(0, 0, Rr, a0 + (a1 - a0) * 0.35, a1); g.stroke();
    if (a.claws) for (const off of [-6, 6]) { g.beginPath(); g.arc(0, 0, Rr + off, a0 + (a1 - a0) * 0.35, a1); g.stroke(); }
    g.restore();
  },

  // ── 등급 표식 ──
  // 희귀: 날카로운 네 갈래 빛이 몇 군데서 번쩍였다 사라진다
  glint(R, g, a, k) {
    const rr = rnd(a.seed); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const d = rr() * 0.3, kk = Math.max(0, Math.min(1, (k - d) / 0.5)); if (kk <= 0 || kk >= 1) continue; const s = (a.r * 0.35 + rr() * 6) * Math.sin(kk * Math.PI), x = a.x + (rr() - 0.5) * a.r * 1.2, y = a.y - 8 + (rr() - 0.5) * a.r * 0.6;
      g.fillStyle = hexA(a.col, 0.8); g.beginPath(); starPath(g, x, y, s, 4, kk * 0.8, 0.12); g.fill(); g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); starPath(g, x, y, s * 0.45, 4, kk * 0.8 + 0.78, 0.15); g.fill(); }
    g.restore();
  },
  // 수정 파편: 각진 파편들이 돌며 바깥으로 튀고, 면마다 밝기가 다르다
  shardBurst(R, g, a, k) {
    const rr = rnd(a.seed), n = 10, out = ease.out(k), fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2 + rr() * 0.5, d = a.r * (0.2 + 1.0 * out) * (0.7 + rr() * 0.5), x = a.x + Math.cos(an) * d, y = a.y - 8 + Math.sin(an) * d * 0.55 - Math.sin(k * Math.PI) * 10, s = 3 + rr() * 4, rot = an + k * (4 + rr() * 6);
      const pts = [[0, -s * 1.6], [s * 0.7, 0], [0, s * 0.9], [-s * 0.6, -s * 0.1]].map(([px, py]) => [x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
      g.fillStyle = hexA(a.col, 0.95 * fade); g.beginPath(); g.moveTo(...pts[0]); g.lineTo(...pts[1]); g.lineTo(...pts[2]); g.closePath(); g.fill();
      g.fillStyle = hexA('#3a2a5a', 0.7 * fade); g.beginPath(); g.moveTo(...pts[0]); g.lineTo(...pts[2]); g.lineTo(...pts[3]); g.closePath(); g.fill();
      g.strokeStyle = hexA('#ffffff', 0.9 * fade); g.lineWidth = 0.8; g.beginPath(); g.moveTo(...pts[0]); g.lineTo(...pts[1]); g.stroke(); }
  },
  // 금빛 깃털: 깃털이 흩날리며 천천히 떨어지고, 가늘어지는 빛살이 뻗는다
  featherBurst(R, g, a, k) {
    const rr = rnd(a.seed), fade = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
    g.save(); g.globalCompositeOperation = 'lighter';
    if (k < 0.4) { const rk = 1 - k / 0.4; for (let i = 0; i < 10; i++) { const an = (i / 10) * Math.PI * 2 + a.seed, L = a.r * (0.9 + (i % 2) * 0.5) * ease.out(k / 0.4); g.fillStyle = hexA(a.col, 0.55 * rk); g.beginPath(); spikePath(g, a.x, a.y - 8, a.x + Math.cos(an) * L, a.y - 8 + Math.sin(an) * L * 0.6, 2.2); g.fill(); } }
    g.restore();
    for (let i = 0; i < 9; i++) { const an = rr() * Math.PI * 2, sp = a.r * (0.5 + rr() * 0.6), x = a.x + Math.cos(an) * sp * ease.out(Math.min(1, k * 2)) + Math.sin(k * 6 + i) * 6, y = a.y - 14 + Math.sin(an) * sp * 0.4 * ease.out(Math.min(1, k * 2)) - 18 * Math.sin(Math.min(1, k * 2) * Math.PI / 2) + k * 30, rot = Math.sin(k * 5 + i * 1.7) * 0.9 + an, L = 9 + rr() * 4;
      const tx = x + Math.cos(rot) * L, ty = y + Math.sin(rot) * L;
      g.fillStyle = hexA(a.col, 0.95 * fade); g.beginPath(); spikePath(g, x, y, tx, ty, 2.6, 2.5); g.fill();
      g.strokeStyle = hexA('#fff8e0', 0.9 * fade); g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke();
      g.strokeStyle = hexA('#b07a10', 0.6 * fade); g.beginPath(); for (let j = 1; j < 4; j++) { const u = j / 4, px = x + (tx - x) * u, py = y + (ty - y) * u; g.moveTo(px, py); g.lineTo(px + Math.cos(rot + 2.2) * 2.5, py + Math.sin(rot + 2.2) * 2.5); } g.stroke(); }
  },
  // 신화: 붉은 꽃잎이 겹겹이 피었다 흩어지고, 가운데서 금빛 빛살이 터지고, 문양 조각이 떠오른다
  mythBloom(R, g, a, k) {
    const open = ease.outBack(Math.min(1, k / 0.35)), fade = k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1, cx = a.x, cy = a.y - 10;
    for (const [layer, n, col, sc] of [[0, 8, '#8a1430', 1.25], [1, 8, '#ff4a6a', 1.0], [2, 6, '#ffc0d0', 0.6]]) {
      for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2 + layer * 0.4 + k * (layer % 2 ? -1 : 1) * 1.2 + (k > 0.55 ? (i % 2 ? 1 : -1) * (k - 0.55) * 3 : 0), L = a.r * 0.75 * sc * open, drift = k > 0.55 ? (k - 0.55) * a.r * 1.4 : 0;
        const bx = cx + Math.cos(an) * drift, by = cy + Math.sin(an) * drift * 0.55, tx = bx + Math.cos(an) * L, ty = by + Math.sin(an) * L * 0.6;
        g.fillStyle = hexA(col, 0.85 * fade); g.beginPath(); g.moveTo(bx, by); g.bezierCurveTo(bx + Math.cos(an - 0.6) * L * 0.6, by + Math.sin(an - 0.6) * L * 0.36, tx + Math.cos(an - 1.4) * L * 0.2, ty + Math.sin(an - 1.4) * L * 0.12, tx, ty); g.bezierCurveTo(tx + Math.cos(an + 1.4) * L * 0.2, ty + Math.sin(an + 1.4) * L * 0.12, bx + Math.cos(an + 0.6) * L * 0.6, by + Math.sin(an + 0.6) * L * 0.36, bx, by); g.fill(); }
    }
    g.save(); g.globalCompositeOperation = 'lighter';
    if (k < 0.5) { const rk = 1 - k / 0.5; for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2 + 0.13, L = a.r * (1.1 + (i % 3) * 0.35) * ease.out(k / 0.5); g.fillStyle = hexA(i % 2 ? '#ffd060' : '#ffffff', 0.7 * rk); g.beginPath(); spikePath(g, cx, cy, cx + Math.cos(an) * L, cy + Math.sin(an) * L * 0.6, 2.6); g.fill(); } }
    g.fillStyle = hexA('#fff4d0', 0.9 * fade); g.beginPath(); starPath(g, cx, cy, 6 + 6 * Math.sin(Math.min(1, k * 2) * Math.PI), 8, k * 2, 0.35); g.fill();
    g.restore();
  },
  // ── 계열 연출 ──
  // 피의 가시: 바닥이 붉게 번지고, 휘어진 가시가 차례로 찔러 올라왔다가 핏방울을 남기고 들어간다
  bloodThorns(R, g, a, k) {
    const rr = rnd(a.seed), n = Math.round(6 + a.r / 9), fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    g.fillStyle = hexA('#4a0a14', 0.45 * fade); g.beginPath(); blobPath(g, a.x, a.y, a.r * 0.9 * ease.out(Math.min(1, k * 4)), a.r * 0.38, a.t, a.seed % 50, 10, 0.25); g.fill();
    const th = []; for (let i = 0; i < n; i++) { const an = rr() * Math.PI * 2, d = a.r * Math.sqrt(rr()) * 0.85; th.push({ x: a.x + Math.cos(an) * d, y: a.y + Math.sin(an) * d * 0.45, h: a.r * (0.4 + rr() * 0.5), w: 2.5 + rr() * 2.5, bend: (rr() - 0.5) * 16, d: rr() * 0.25 }); }
    th.sort((p, q) => p.y - q.y);
    for (const t of th) { const kk = Math.max(0, Math.min(1, (k - t.d) / 0.15)), back = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1, h = t.h * ease.outBack(kk) * back; if (h < 2) continue;
      g.fillStyle = '#2a040a'; g.beginPath(); spikePath(g, t.x, t.y, t.x + t.bend * 0.5, t.y - h, t.w + 1, t.bend); g.fill();
      g.fillStyle = '#b01830'; g.beginPath(); spikePath(g, t.x, t.y, t.x + t.bend * 0.5, t.y - h, t.w, t.bend); g.fill();
      g.strokeStyle = '#ff7a8a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(t.x - t.w * 0.4, t.y - 1); g.quadraticCurveTo(t.x + t.bend * 0.3, t.y - h * 0.5, t.x + t.bend * 0.5, t.y - h); g.stroke();
      if (kk >= 1 && !t.dripped && Math.random() < 0.15) R.parts.push({ x: t.x + t.bend * 0.5, y: t.y - h, vx: (Math.random() - 0.5) * 20, vy: -20, t: 0.6, max: 0.6, color: '#d02040', g: 260, chunk: true, floor: t.y + 2 }); }
  },
  // 뼈 가시: 갈비뼈 같은 흰 뼈가 땅을 찢고 솟는다 (마디와 그림자), 부서지며 가루가 된다
  boneSpikes(R, g, a, k) {
    const rr = rnd(a.seed), n = Math.round(5 + a.r / 12), brk = 0.65;
    const bs = []; for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2 + rr() * 0.4, d = a.r * (0.35 + rr() * 0.5); bs.push({ x: a.x + Math.cos(an) * d, y: a.y + Math.sin(an) * d * 0.45, an, h: a.r * (0.45 + rr() * 0.4), d: rr() * 0.15 }); }
    bs.sort((p, q) => p.y - q.y);
    for (const b of bs) { const kk = Math.max(0, Math.min(1, (k - b.d) / 0.16)), sh = k > brk ? 1 - (k - brk) / (1 - brk) : 1, h = b.h * ease.outBack(kk) * sh; if (h < 2) continue;
      const lean = Math.cos(b.an) * h * 0.45, tx = b.x + lean, ty = b.y - h;
      g.fillStyle = 'rgba(30,20,14,0.5)'; g.beginPath(); blobPath(g, b.x, b.y + 1, 5, 2, 0, b.d * 99, 6, 0.3); g.fill();
      g.fillStyle = '#8a7a64'; g.beginPath(); spikePath(g, b.x, b.y, tx, ty, 3.6, lean * 0.4); g.fill();
      g.fillStyle = '#efe6d0'; g.beginPath(); spikePath(g, b.x - 0.8, b.y - 1, tx, ty, 2.6, lean * 0.4); g.fill();
      g.strokeStyle = '#8a7a64'; g.lineWidth = 0.8; g.beginPath(); for (let j = 1; j < 4; j++) { const u = j / 4, px = b.x + (tx - b.x) * u + lean * 0.4 * Math.sin(u * Math.PI) * 0.5, py = b.y + (ty - b.y) * u; g.moveTo(px - 2.4 * (1 - u), py); g.lineTo(px + 2.4 * (1 - u), py - 1); } g.stroke(); }
    if (!a.broke && k > brk) { a.broke = true; for (const b of bs) for (let i = 0; i < 3; i++) R.parts.push({ x: b.x, y: b.y - b.h * Math.random(), vx: (Math.random() - 0.5) * 80, vy: -50 - Math.random() * 50, t: 0.5, max: 0.5, color: i % 2 ? '#efe6d0' : '#b8a888', g: 380, chunk: true, floor: b.y + 2 }); }
  },
  // 별똥: 꼬리가 가늘어지는 별이 비스듬히 내리꽂히고, 닿은 자리에 네 갈래 별빛이 핀다
  starfall(R, g, a, k) {
    const rr = rnd(a.seed); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) { const tx = a.x + (rr() - 0.5) * a.r * 1.2, ty = a.y + (rr() - 0.5) * a.r * 0.5, d = rr() * 0.3, kk = Math.max(0, Math.min(1, (k - d) / 0.3)); if (kk <= 0) continue;
      if (kk < 1) { const x = tx - 90 * (1 - kk), y = ty - 220 * (1 - ease.in(kk)); g.fillStyle = hexA(a.col, 0.7); g.beginPath(); spikePath(g, x, y, x - 30, y - 70, 3); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); starPath(g, x, y, 5, 4, kk * 6, 0.2); g.fill(); }
      else { const bk = Math.min(1, (k - d - 0.3) / 0.4); g.fillStyle = hexA(a.col, 0.8 * (1 - bk)); g.beginPath(); starPath(g, tx, ty - 4, a.r * 0.5 * ease.out(bk) + 4, 4, 0.785, 0.1); g.fill(); g.fillStyle = hexA('#ffffff', 0.9 * (1 - bk)); g.beginPath(); starPath(g, tx, ty - 4, a.r * 0.25 * ease.out(bk) + 3, 4, 0, 0.12); g.fill(); } }
    g.restore();
  },
  // 바람 칼날: 초승달 모양 바람 날이 사방으로 날아가며 휘고, 뒤로 가는 바람 결과 나뭇잎이 끌려간다
  gale(R, g, a, k) {
    const rr = rnd(a.seed), fade = k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1, n = 6;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * Math.PI * 2 + rr() * 0.5, d = a.r * (0.15 + 1.0 * ease.out(k)), cx = a.x + Math.cos(an) * d, cy = a.y - 8 + Math.sin(an) * d * 0.55, L = a.r * (0.7 + rr() * 0.25), bend = L * 0.4, swirl = an + Math.PI / 2 + k * 1.2;
      const x0 = cx - Math.cos(swirl) * L / 2, y0 = cy - Math.sin(swirl) * L / 2 * 0.6, x1 = cx + Math.cos(swirl) * L / 2, y1 = cy + Math.sin(swirl) * L / 2 * 0.6, ox = Math.cos(an) * bend, oy = Math.sin(an) * bend * 0.55;
      g.fillStyle = hexA(a.col, 0.8 * fade); g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx + ox, cy + oy, x1, y1); g.quadraticCurveTo(cx + ox * 0.25, cy + oy * 0.4, x0, y0); g.fill();
      g.strokeStyle = hexA('#ffffff', 0.85 * fade); g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx + ox, cy + oy, x1, y1); g.stroke();
      for (let j = 1; j <= 2; j++) { const bx = cx - Math.cos(an) * j * 7, by = cy - Math.sin(an) * j * 4; g.strokeStyle = hexA(a.col, 0.35 * fade / j); g.lineWidth = 0.8; g.beginPath(); g.moveTo(bx - Math.cos(swirl) * L * 0.3, by - Math.sin(swirl) * L * 0.18); g.quadraticCurveTo(bx + ox * 0.6, by + oy * 0.6, bx + Math.cos(swirl) * L * 0.3, by + Math.sin(swirl) * L * 0.18); g.stroke(); }
      const lx = cx + ox * 0.7, ly = cy + oy * 0.7, lr = k * 9 + i; g.fillStyle = hexA(i % 2 ? '#8ad070' : '#d0f0a0', 0.9 * fade); g.beginPath(); spikePath(g, lx - Math.cos(lr) * 2.5, ly - Math.sin(lr) * 2.5, lx + Math.cos(lr) * 2.5, ly + Math.sin(lr) * 2.5, 1.4, 1); g.fill();
    }
  },
};

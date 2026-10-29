// 스킬 애니메이션: 반짝이가 아니라 '물체'가 생기고 · 움직이고 · 변한다.
// 떨어지는 운석 · 부풀었다 연기가 되는 폭발 · 땅에서 솟았다 부서지는 얼음 가시 · 하늘에서 내리꽂는 빛기둥 · 갈라지는 땅
// 어둠의 문과 촉수 · 자라났다 시드는 덩굴 · 화살비 · 하늘에서 떨어지는 벼락 · 독구름 · 모여드는 비전 문양 · 칼날 초승달
// 평타에는 쓰지 않는다 (스킬 · 무기 기술 · 보스 기술만)
const hexA = (hex, a) => { const n = parseInt((hex || '#ffffff').slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; };
const ease = { out: (k) => 1 - (1 - k) * (1 - k), in: (k) => k * k, outBack: (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2) };
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
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
    if (fx === 'fog') return this.add('cloud', { x, y, r, col: '#9be15d' });
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
const DUR = { explosion: 1.3, lightning: 0.5, iceSpikes: 1.3, lightPillar: 0.9, portal: 1.4, vines: 1.8, arrowRain: 0.9, rockRain: 1.0, cloud: 2.2, runeBurst: 0.8, cracks: 1.4, fissure: 1.3, bladeArc: 0.28, meteorFall: 0.8, pillarCharge: 0.6 };

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
  // 독구름: 방울진 구름이 부풀어 일렁이고, 거품이 터진다
  cloud(R, g, a, k) {
    const rr = rnd(a.seed), n = 10, grow = ease.out(Math.min(1, k * 3)), fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    for (let i = 0; i < n; i++) { const an = rr() * Math.PI * 2 + a.t * (0.4 + rr() * 0.5), d = a.r * 0.55 * rr() * grow, br = a.r * (0.25 + rr() * 0.2) * grow; g.fillStyle = hexA(i % 3 ? a.col : '#4a7a2a', 0.35 * fade); g.beginPath(); g.arc(a.x + Math.cos(an) * d, a.y - 6 + Math.sin(an) * d * 0.5 - k * 8, br, 0, Math.PI * 2); g.fill(); }
    if (Math.random() < 0.4 * fade) R.parts.push({ x: a.x + (Math.random() - 0.5) * a.r, y: a.y - 6 + (Math.random() - 0.5) * a.r * 0.5, vx: 0, vy: -14, t: 0.6, max: 0.6, color: a.bubble ? '#e0f6ff' : '#d8ffa0', g: 0, bubble: true });
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
};

// 가면 족장 이펙트: 보라 불덩이 · 지팡이 휘두르기 · 포효 · 저주 마법진 · 고블린 소환진 · 제물 선택(표식 → 보라 불에 타 죽고 넋이 날아가 → 모아 터뜨린다)
// 모두 도트로 직접 찍는다 (몸 둘레 고리 · 빛나는 막대 없이). Renderer.prototype 에 붙는다 — this 는 Renderer
import { sfx } from '../audio.js';
import { flameSprite } from './pxfx.js';

const VOID = { core: '#fbeaff', hot: '#e2a8ff', mid: '#b56cff', deep: '#7a34d0', dark: '#3a1a5a', ink: '#1a0e24' };
const R = Math.round;
// 도트 원 (가로줄로 채운다)
function dotDisc(g, cx, cy, r, col) {
  g.fillStyle = col; const ri = Math.max(0, r);
  for (let dy = -Math.floor(ri); dy <= Math.floor(ri); dy++) { const w = Math.floor(Math.sqrt(Math.max(0, ri * ri - dy * dy)) + 0.35); g.fillRect(R(cx) - w, R(cy) + dy, w * 2 + 1, 1); }
}
// 도트 원호 (점을 찍어 잇는다)
function dotArc(g, cx, cy, r, a0, a1, col, sq = 0.8, w = 1) {
  g.fillStyle = col; const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r));
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; g.fillRect(R(cx + Math.cos(a) * r), R(cy + Math.sin(a) * r * sq), w, w); }
}
// 해골 표식 (7×7 도트): 보라 불 위에 뜬다
const SKULL = ['.WWWWW.', 'WWWWWWW', 'WKKWKKW', 'WKKWKKW', 'WWWKWWW', '.WWWWW.', '.W.W.W.'];
function drawSkull(g, x, y, a = 1) {
  g.globalAlpha = a;
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) { const c = SKULL[j][i]; if (c === '.') continue; g.fillStyle = c === 'K' ? VOID.deep : VOID.core; g.fillRect(R(x) - 3 + i, R(y) - 3 + j, 1, 1); }
  g.fillStyle = VOID.ink; for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (SKULL[j][i] !== '.') { // 외곽선
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + dx, jj = j + dy; if (ii < 0 || jj < 0 || ii > 6 || jj > 6 || SKULL[jj][ii] === '.') g.fillRect(R(x) - 3 + ii, R(y) - 3 + jj, 1, 1); }
  }
  g.globalAlpha = 1;
}

export const ChiefFxMethods = {
  vflame(x, y, vx, vy, t, size = 1.6) { this.parts.push({ x, y, vx, vy, t, max: t, g: -30, flame: true, hue: 'void', size, color: '#ffffff' }); },
  vspark(x, y, n, sp = 80, col = VOID.hot) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random() * 0.8); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - 20, t: 0.45, max: 0.45, color: Math.random() < 0.3 ? VOID.core : col, g: 40, glow: true, size: 1.2 + Math.random() }); } },
  // 사건 → 이펙트 (처리했으면 true)
  chiefEvent(w, ev) {
    const L = (this.cfx ||= []);
    switch (ev.t) {
      case 'voidCast': { // 지팡이 끝에서 불이 튄다
        const e = w.enemies.find((o) => o.id === ev.id), dir = e?.dir || 1, x = ev.x + dir * 12, y = ev.y - 22;
        for (let i = 0; i < 5; i++) this.vflame(x + (Math.random() - 0.5) * 4, y, Math.cos(ev.ang) * 40 + (Math.random() - 0.5) * 20, -20 - Math.random() * 20, 0.3, 1.2);
        this.vspark(x, y, 4, 50); sfx('cast', { vol: 0.35, rate: 1.4 }); return true;
      }
      case 'voidHit': { // 불덩이가 터진다: 보라 불혀 · 불똥 · 검보라 연기
        const y = ev.y - 10;
        for (let i = 0; i < 9; i++) { const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 50; this.vflame(ev.x + Math.cos(a) * 3, y + Math.sin(a) * 3, Math.cos(a) * s, Math.sin(a) * s * 0.6 - 10, 0.35 + Math.random() * 0.2, 1.4 + Math.random()); }
        this.vspark(ev.x, y, 7, 110);
        for (let i = 0; i < 3; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 8, y: y - 2, vx: (Math.random() - 0.5) * 16, vy: -14, t: 0.6, max: 0.6, color: '#4a3a5a', g: -6, puff: true, size: 3 });
        L.push({ k: 'flash', x: ev.x, y, r: 7, t: 0.12, max: 0.12 }); sfx('reaction', { vol: 0.35, rate: 1.6 }); return true;
      }
      case 'chiefSwing': L.push({ k: 'swing', ...ev, t: 0.28, max: 0.28 }); sfx('heavySwing', { vol: 0.8, rate: 0.75 });
        for (let i = 0; i < 8; i++) { const a = ev.ang + (Math.random() - 0.5) * ev.arc * 1.6; this.parts.push({ x: ev.x + Math.cos(a) * ev.r * 0.8, y: ev.y + 2 + Math.sin(a) * ev.r * 0.5, vx: Math.cos(a) * 40, vy: -10 - Math.random() * 20, t: 0.4, max: 0.4, color: '#a89880', g: 60, dust: true, v: (Math.random() * 4) | 0 }); }
        return true;
      case 'chiefRoarWind': { const e = w.enemies.find((o) => o.id === ev.id); if (e) L.push({ k: 'inhale', id: e.id, t: ev.dur, max: ev.dur }); sfx('windup', { vol: 0.6, rate: 0.6 }); return true; }
      case 'chiefRoar': { // 포효: 입에서 퍼지는 소리 물결(도트 호) · 바닥을 쓸고 나가는 흙먼지 · 튀는 돌
        L.push({ k: 'roar', ...ev, t: 0.5, max: 0.5 });
        for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, s = 140 + Math.random() * 60; this.parts.push({ x: ev.x + Math.cos(a) * 10, y: ev.y + 2 + Math.sin(a) * 7, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, t: 0.55, max: 0.55, color: i % 3 ? '#a89880' : '#7a6a58', g: 0, puff: true, size: 3 }); }
        for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: ev.x + Math.cos(a) * 14, y: ev.y, vx: Math.cos(a) * 90, vy: -60 - Math.random() * 50, t: 0.7, max: 0.7, color: '#6a5a4a', g: 260, chunk: true, floor: ev.y + 3 + Math.sin(a) * 10 }); }
        sfx('hitHeavy', { vol: 1, rate: 0.45 }); sfx('reaction', { vol: 0.6, rate: 0.5 }); return true;
      }
      case 'chiefSigil': L.push({ k: 'sigil', ...ev, t: ev.dur, max: ev.dur, rot: Math.random() * 6 }); if (ev.curse) sfx('cast', { vol: 0.5, rate: 0.7 }); return true;
      case 'chiefSigilFire': { // 마법진이 다 찼다: 가운데서 보라 불기둥이 솟는다
        const n = ev.small ? 6 : 16;
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * ev.r * 0.7; this.vflame(ev.x + Math.cos(a) * d, ev.y + Math.sin(a) * d * 0.6, (Math.random() - 0.5) * 12, -50 - Math.random() * 60, 0.45 + Math.random() * 0.3, ev.small ? 1.4 : 1.8 + Math.random()); }
        this.vspark(ev.x, ev.y - 8, ev.small ? 3 : 8, 70); L.push({ k: 'flash', x: ev.x, y: ev.y - 4, r: ev.small ? 6 : 12, t: 0.15, max: 0.15 });
        if (!ev.small) sfx('reaction', { vol: 0.55, rate: 0.9 }); return true;
      }
      case 'chiefRise': { // 고블린이 마법진에서 솟는다: 보라 불기둥 · 흙이 튀고 · 검보라 연기
        for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * 8; this.vflame(ev.x + Math.cos(a) * d, ev.y + Math.sin(a) * d * 0.6, (Math.random() - 0.5) * 14, -60 - Math.random() * 50, 0.4 + Math.random() * 0.25, 1.4 + Math.random()); }
        for (let i = 0; i < 8; i++) { const a = Math.PI + Math.random() * Math.PI; this.parts.push({ x: ev.x, y: ev.y + 2, vx: Math.cos(a) * 60, vy: -40 - Math.random() * 50, t: 0.5, max: 0.5, color: i % 2 ? '#7a5a38' : '#5a3e24', g: 240, chunk: true, floor: ev.y + 3 }); }
        for (let i = 0; i < 3; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 10, y: ev.y - 4, vx: (Math.random() - 0.5) * 12, vy: -12, t: 0.8, max: 0.8, color: '#3c2e4c', g: -6, puff: true, size: 3 });
        this.vspark(ev.x, ev.y - 6, 4, 50); L.push({ k: 'flash', x: ev.x, y: ev.y - 4, r: 8, t: 0.14, max: 0.14 }); sfx('reaction', { vol: 0.35, rate: 1.1 }); return true;
      }
      case 'chiefCursed': L.push({ k: 'skullPop', x: ev.x, y: ev.y, t: 0.9, max: 0.9 }); this.vspark(ev.x, ev.y - 20, 10, 70); sfx('death', { vol: 0.4, rate: 1.3 }); return true;
      case 'chiefSacMark': L.push({ k: 'mark', id: ev.id, from: ev.from, t: ev.dur, max: ev.dur }); sfx('echo', { vol: 0.4, rate: 0.6 }); return true;
      case 'chiefSacBurn': { // 제물이 보라 불에 휩싸여 타 죽는다 → 넋이 족장에게 날아간다
        for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * 7; this.vflame(ev.x + Math.cos(a) * d, ev.y - Math.random() * 10, (Math.random() - 0.5) * 20, -60 - Math.random() * 70, 0.35 + Math.random() * 0.3, 1.2 + Math.random()); }
        for (let i = 0; i < 6; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 10, y: ev.y - 14, vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 10, t: 1, max: 1, color: '#3c2e4c', g: -6, puff: true, size: 4 });
        for (let i = 0; i < 8; i++) this.parts.push({ x: ev.x, y: ev.y - 6, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60, t: 0.6, max: 0.6, color: i % 2 ? '#2a2030' : '#5a4a5a', g: 240, chunk: true, floor: ev.y + 3 }); // 그을린 재
        L.push({ k: 'flash', x: ev.x, y: ev.y - 8, r: 10, t: 0.16, max: 0.16 });
        L.push({ k: 'soul', x0: ev.x, y0: ev.y - 10, from: ev.from, tx: ev.tx, ty: ev.ty - 18, t: ev.fly, max: ev.fly, side: Math.random() < 0.5 ? -1 : 1 });
        sfx('death', { vol: 0.5, rate: 0.7 }); sfx('reaction', { vol: 0.4, rate: 1.2 }); return true;
      }
      case 'chiefSacCharge': L.push({ k: 'gather', ...ev, t: ev.dur, max: ev.dur }); sfx('windup', { vol: 0.8, rate: 0.5 }); return true;
      case 'chiefSacBlast': { // 모은 넋이 터진다: 땅을 따라 퍼지는 보라 불의 물결 · 판 전체에서 솟는 불혀 · 하얀 섬광
        L.push({ k: 'wave', x: ev.x, y: ev.y, r: ev.r, t: 0.45, max: 0.45 });
        L.push({ k: 'flash', x: ev.x, y: ev.y - 14, r: 12 + ev.n * 2, t: 0.16, max: 0.16 });
        const n = 30 + ev.n * 14;
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * ev.r; this.vflame(ev.x + Math.cos(a) * d, ev.y + Math.sin(a) * d * 0.75, Math.cos(a) * 14, -50 - Math.random() * 80, 0.45 + Math.random() * 0.4, 1.4 + Math.random() * 1.4); }
        for (let i = 0; i < 18 + ev.n * 4; i++) this.vflame(ev.x + (Math.random() - 0.5) * 12, ev.y - Math.random() * 6, (Math.random() - 0.5) * 24, -120 - Math.random() * 120, 0.5 + Math.random() * 0.3, 2.2 + Math.random() * 1.6); // 가운데서 치솟는 불기둥
        this.vspark(ev.x, ev.y - 14, 20, 160);
        this.flash = { color: '194,124,255', t: 0.2, max: 0.2 }; sfx('hitHeavy', { vol: 1, rate: 0.5 }); sfx('reaction', { vol: 1, rate: 0.6 }); return true;
      }
    }
    return false;
  },
  // 보라 불덩이: 떠서 날고(그림자는 바닥에) · 꼬리에 불혀가 남는다
  drawVoidFire(pr) {
    const g = this.g, t = performance.now() / 1000, x = pr.x, y = pr.y - 10, a = Math.atan2(pr.vy, pr.vx), fl = Math.sin(t * 30 + x) * 0.4;
    g.fillStyle = 'rgba(20,10,30,0.35)'; g.fillRect(R(x) - 3, R(pr.y) + 1, 7, 2); // 그림자
    // 혜성 모양 불꽃: 둥근 머리(반지름 4.5) + 뒤로 가늘어지며 일렁이는 꼬리(14) · 가운데일수록 밝고 가장자리는 짙은 외곽선
    const ca = Math.cos(a), sa = Math.sin(a), ph = t * 26 + x * 0.1, HR = 4.5 + fl * 0.5, TL = 14;
    const inside = (dx, dy) => { const u = dx * ca + dy * sa, v = -dx * sa + dy * ca; if (u >= 0) return u * u + v * v <= HR * HR; if (u < -TL) return false; const k = 1 + u / TL; return Math.abs(v - Math.sin(u * 0.8 + ph) * 1.3 * (1 - k)) <= HR * Math.pow(k, 0.8); };
    const X = R(x), Y = R(y);
    for (let dy = -10; dy <= 10; dy++) for (let dx = -16; dx <= 16; dx++) {
      if (!inside(dx, dy)) continue;
      const edge = !inside(dx + 1, dy) || !inside(dx - 1, dy) || !inside(dx, dy + 1) || !inside(dx, dy - 1);
      const u = dx * ca + dy * sa, v = -dx * sa + dy * ca, d = Math.hypot((u - 1) * (u > 0 ? 1 : 0.42), v) / HR;
      g.fillStyle = edge ? VOID.ink : d < 0.18 ? VOID.core : d < 0.4 ? VOID.hot : d < 0.72 ? VOID.mid : VOID.deep;
      g.fillRect(X + dx, Y + dy, 1, 1);
    }
    if (Math.random() < 0.5) this.vflame(x - Math.cos(a) * 5 + (Math.random() - 0.5) * 3, y - Math.sin(a) * 5 + (Math.random() - 0.5) * 3, -pr.vx * 0.15, -pr.vy * 0.15 - 10, 0.25 + Math.random() * 0.1, 1.2 + Math.random() * 0.6);
  },
  // ground: 바닥에 그리는 것(마법진) · 아니면 공중
  drawChiefFx(w, dt, ground) {
    const g = this.g;
    if (ground) for (const e of w.enemies) if (e.def?.ownKit && e.jumpH > 1 && !e.dead) { // 뛰어오른 족장: 땅의 그림자 (높을수록 작고 옅게)
      const k = Math.max(0.4, 1 - e.jumpH / 50), rx = Math.round(11 * k), ry = Math.max(2, Math.round(4 * k));
      g.fillStyle = `rgba(16,10,22,${0.45 * k})`; for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry + 0.5))); g.fillRect(Math.round(e.x) - hw, Math.round(e.y + 3) + dy, hw * 2 + 1, 1); }
    }
    const L = this.cfx; if (!L?.length && !(w.player.markT > 0)) return;
    if (!ground && w.player.markT > 0 && Math.random() < 0.35) { const p = w.player; this.vflame(p.x + (Math.random() - 0.5) * 10, p.y - 4 - Math.random() * 12, 0, -24, 0.4, 1.1); } // 저주받은 동안: 몸에서 보라 불이 피어오른다
    if (!L) return;
    for (const f of L) {
      if ((f.k === 'sigil') !== !!ground) continue;
      f.t -= dt; const k = Math.max(0, f.t / f.max), u = 1 - k;
      const en = f.id != null ? w.enemies.find((o) => o.id === f.id) : null;
      if (f.k === 'sigil') { // 마법진: 바깥 원이 그려지며 차오르고 · 룬 다섯이 돌고 · 다 차면 번쩍
        const x = f.x, y = f.y, r = f.r, rot = f.rot + u * (f.curse ? 3 : 2), fill = Math.min(1, u * 1.25), pulse = 0.55 + 0.45 * Math.sin(u * 30);
        g.globalAlpha = 0.25 + 0.35 * u; dotDisc(g, x, y, r * 0.95, VOID.dark); g.globalAlpha = 1; // 어둡게 물드는 바닥
        dotArc(g, x, y, r, rot, rot + Math.PI * 2 * fill, VOID.mid, 0.6, 1); dotArc(g, x, y, r + 1, rot, rot + Math.PI * 2 * fill, VOID.deep, 0.6, 1);
        dotArc(g, x, y, r * 0.62, -rot * 1.3, -rot * 1.3 + Math.PI * 2 * fill, VOID.hot, 0.6, 1);
        if (r > 20) for (let i = 0; i < 5; i++) { // 별 모양 줄 (마법진 안)
          const a1 = rot + (i / 5) * Math.PI * 2, a2 = rot + ((i + 2) / 5) * Math.PI * 2, n = 12;
          if (fill < (i + 1) / 5) break;
          g.fillStyle = VOID.mid; for (let s = 0; s <= n; s++) { const t2 = s / n; g.fillRect(R(x + (Math.cos(a1) * (1 - t2) + Math.cos(a2) * t2) * r * 0.62), R(y + (Math.sin(a1) * (1 - t2) + Math.sin(a2) * t2) * r * 0.62 * 0.6), 1, 1); }
        }
        for (let i = 0; i < (r > 20 ? 5 : 3); i++) { const a = rot + (i / (r > 20 ? 5 : 3)) * Math.PI * 2, rx = x + Math.cos(a) * r, ry = y + Math.sin(a) * r * 0.6; g.fillStyle = VOID.ink; g.fillRect(R(rx) - 2, R(ry) - 2, 5, 5); g.fillStyle = pulse > 0.7 ? VOID.core : VOID.hot; g.fillRect(R(rx) - 1, R(ry) - 1, 3, 3); }
        if (Math.random() < 0.5 * u) this.vspark(x + (Math.random() - 0.5) * r * 1.4, y + (Math.random() - 0.5) * r * 0.8, 1, 20);
      } else if (f.k === 'flash') { // 하얀 보라 섬광 (짧게)
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = k; dotDisc(g, f.x, f.y, f.r * (0.6 + u * 0.6), '#7a34d0'); dotDisc(g, f.x, f.y, f.r * 0.5 * (0.6 + u * 0.6), '#fbeaff'); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      } else if (f.k === 'swing') { // 지팡이가 지나간 초승달: 앞쪽부터 그어지고 · 굵은 흰 날 → 보라 꼬리로 식는다
        const sweep = Math.min(1, u / 0.35), a0 = f.ang - f.arc * (f.dir ?? 1), span = f.arc * 2 * sweep, cy = f.y - 8;
        for (let j = 0; j < 7; j++) { // 안쪽 → 바깥 겹 (가장 바깥이 가장 밝다)
          const rr = f.r * (0.55 + j * 0.07), col = j >= 5 ? (k > 0.5 ? VOID.core : VOID.hot) : j >= 3 ? VOID.hot : VOID.mid;
          const tail = span * (0.35 + j * 0.09); g.globalAlpha = Math.min(1, k * 1.6) * (0.5 + j * 0.08);
          dotArc(g, f.x, cy, rr, a0 + span - tail, a0 + span, col, 0.7, j >= 5 ? 2 : 1);
        }
        g.globalAlpha = 1;
        if (u < 0.4) for (let i = 0; i < 2; i++) { const a = a0 + span; this.vspark(f.x + Math.cos(a) * f.r, cy + Math.sin(a) * f.r * 0.7, 1, 40, VOID.core); }
      } else if (f.k === 'inhale') { // 포효 준비: 숨을 들이켜며 둘레의 먼지가 입으로 빨려 든다
        if (en && Math.random() < 0.8) { const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 30; this.parts.push({ x: en.x + Math.cos(a) * d, y: en.y - 16 + Math.sin(a) * d * 0.6, vx: -Math.cos(a) * d * 2.4, vy: -Math.sin(a) * d * 1.4, t: 0.35, max: 0.35, color: '#c8b8a0', g: 0, line: true }); }
      } else if (f.k === 'roar') { // 소리 물결: 입 앞으로 퍼지는 겹 호 셋 (몸 둘레가 아니라 바라보는 쪽으로)
        const hx = f.x + f.dir * 8, hy = f.y - 20;
        for (let j = 0; j < 3; j++) { const v = u * 1.4 - j * 0.18; if (v <= 0 || v > 1) continue; const rr = 10 + v * f.r, ca = f.dir > 0 ? 0 : Math.PI; g.globalAlpha = (1 - v) * 0.9;
          dotArc(g, hx, hy, rr, ca - 0.9, ca + 0.9, j === 0 ? '#fff6e0' : '#e8d8b8', 0.9, 2); dotArc(g, hx - f.dir * 2, hy, rr * 0.92, ca + Math.PI - 0.5, ca + Math.PI + 0.5, '#e8d8b8', 0.9, 1); }
        g.globalAlpha = 1;
      } else if (f.k === 'skullPop') { // 저주: 해골이 머리 위로 솟아 커졌다 사라진다
        const p = w.player; drawSkull(g, p.x, p.y - 30 - u * 8, Math.min(1, k * 2)); if (Math.random() < 0.6) this.vflame(p.x + (Math.random() - 0.5) * 6, p.y - 28 - u * 8, 0, -20, 0.3, 1.2);
      } else if (f.k === 'mark') { // 제물 표식: 머리 위 해골이 떨리며 밝아지고 · 넋의 끈이 족장에게 흘러간다
        const m = w.enemies.find((o) => o.id === f.id), b = w.enemies.find((o) => o.id === f.from);
        if (!m || m.dead) { f.t = 0; continue; }
        const shake = (Math.random() - 0.5) * 2 * u; drawSkull(g, m.x + shake, m.y - 26 - Math.sin(u * 8) * 1.5, 0.6 + 0.4 * u);
        if (Math.random() < 0.5 + u * 0.5) this.vflame(m.x + (Math.random() - 0.5) * 10, m.y - Math.random() * 6, 0, -30, 0.35, 1 + u);
        if (b) { const n = 10; for (let i = 0; i < n; i++) { const s = ((i / n) + u * 1.6) % 1, x = m.x + (b.x - m.x) * s, y = m.y - 10 + (b.y - 22 - (m.y - 10)) * s - Math.sin(s * Math.PI) * 14; g.fillStyle = i % 3 ? VOID.mid : VOID.core; g.fillRect(R(x), R(y), 2, 2); } }
      } else if (f.k === 'soul') { // 넋: 휘어 날아가는 보라 불덩이 (꼬리) → 족장 몸에 닿으면 불똥
        const b = w.enemies.find((o) => o.id === f.from), tx = b ? b.x : f.tx, ty = b ? b.y - 18 : f.ty, s = u * u * (3 - 2 * u);
        const x = f.x0 + (tx - f.x0) * s + Math.sin(s * Math.PI) * 24 * f.side, y = f.y0 + (ty - f.y0) * s - Math.sin(s * Math.PI) * 26;
        dotDisc(g, x, y, 3.6, VOID.deep); dotDisc(g, x, y, 2.4, VOID.hot); g.fillStyle = VOID.core; g.fillRect(R(x) - 1, R(y) - 1, 2, 2);
        this.vflame(x, y, 0, -10, 0.3, 1.3);
        if (f.t <= 0) { this.vspark(tx, ty, 6, 60); sfx('echo', { vol: 0.3, rate: 1.4 }); }
      } else if (f.k === 'gather') { // 모으기: 불혀가 둘레에서 족장에게 빨려 들고 · 지팡이 끝 불이 커진다
        const b = en; if (!b) continue;
        const cx = b.x, cy = b.y - 16, inten = 0.4 + u;
        for (let i = 0; i < 2 + (f.n || 1) / 2; i++) { const a = Math.random() * Math.PI * 2, d = f.r * (0.6 + Math.random() * 0.4); this.parts.push({ x: cx + Math.cos(a) * d, y: b.y + Math.sin(a) * d * 0.7, vx: -Math.cos(a) * d * 2.2, vy: -Math.sin(a) * d * 1.5 - 20, t: 0.4, max: 0.4, color: Math.random() < 0.3 ? VOID.core : VOID.mid, g: 0, glow: true, size: 1.5 }); }
        const img = flameSprite(Math.min(8, R(2 + inten * 3 + (f.n || 1) * 0.4)), (performance.now() / 100) | 0, 0, 'void');
        g.drawImage(img, R(cx + (b.dir || 1) * 12 - img.width / 2), R(cy - 8 - img.height / 2));
      } else if (f.k === 'wave') { // 땅을 따라 퍼지는 불의 물결 (가장자리에 불혀가 줄지어 솟는다)
        const rr = f.r * Math.min(1, u / 0.6), n = Math.max(10, R(rr / 3));
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + u, x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.75; if (u < 0.65 && Math.random() < 0.35) this.vflame(x, y, Math.cos(a) * 20, -30 - Math.random() * 30, 0.35, 1.6 + Math.random()); g.globalAlpha = k; g.fillStyle = i % 2 ? VOID.hot : VOID.mid; g.fillRect(R(x) - 1, R(y) - 1, 3, 2); }
        g.globalAlpha = 1;
      }
    }
    this.cfx = L.filter((f) => f.t > 0);
  },
};

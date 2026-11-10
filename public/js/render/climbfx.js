// 탑 등반의 것들 그리기: 다음 층으로 가는 문(위에 다음 층 그림) · 등반 HUD
import { hexA } from './color.js';
import { REWARDS, actOf, oathScore, recLevel, levelGap, FLOOR_MODS } from '../data/climb.js';

const px = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

// 보상 그림 (가운데 x, y · 약 11×11 도트)
export function rewardIcon(g, kind, x, y, t = 0) {
  x = Math.round(x); y = Math.round(y);
  const O = '#0d0b10';
  switch (kind) {
    case 'fight': { // 다음 층: 엇갈린 두 칼
      for (let i = -4; i <= 4; i++) { px(g, O, x + i - 1, y + i - 1, 3, 3); px(g, O, x - i - 1, y + i - 1, 3, 3); }
      for (let i = -4; i <= 4; i++) { px(g, '#e8e8f0', x + i, y + i, 1, 1); px(g, '#e8e8f0', x - i, y + i, 1, 1); }
      px(g, '#ff6a5a', x - 5, y + 3, 3, 1); px(g, '#ff6a5a', x + 3, y + 3, 3, 1); px(g, '#ff6a5a', x - 1, y - 1, 3, 3);
      break;
    }
    case 'guardian': case 'lord': case 'boss': { // 보스: 붉은 해골
      const c = kind === 'lord' ? '#ff4a3a' : '#ff8a5a';
      px(g, O, x - 5, y - 6, 11, 10); px(g, O, x - 3, y + 4, 7, 3);
      px(g, '#f0e8d8', x - 4, y - 5, 9, 8); px(g, '#f0e8d8', x - 2, y + 3, 5, 2);
      px(g, c, x - 3, y - 2, 2, 2); px(g, c, x + 2, y - 2, 2, 2); px(g, O, x, y + 1, 1, 1); px(g, O, x - 1, y + 4, 1, 1); px(g, O, x + 1, y + 4, 1, 1);
      if (kind === 'lord') { px(g, O, x - 5, y - 9, 11, 3); px(g, '#ffd84a', x - 4, y - 8, 9, 1); px(g, '#ffd84a', x - 4, y - 9, 1, 1); px(g, '#ffd84a', x, y - 9, 1, 1); px(g, '#ffd84a', x + 4, y - 9, 1, 1); }
      break;
    }
    default: px(g, '#ffffff', x - 1, y - 1, 3, 3);
  }
}

export function drawClimbObject(R, w, o, dt) {
  const g = R.g, t = w.t;
  if (o.kind === 'climbDoor') {
    const x = Math.round(o.x), y = Math.round(o.y), Rw = REWARDS[o.next] || { color: '#ffffff' }, col = Rw.color;
    const age = Math.min(1, (t - (o.born || 0)) / 0.6), near = w.near === o;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y + 6, 17, 5, 0, 0, Math.PI * 2); g.fill();
    // 돌 문틀 (아치)
    g.fillStyle = '#0d0b10'; g.fillRect(x - 16, y - 32, 32, 38);
    g.fillStyle = '#5a5464'; g.fillRect(x - 15, y - 31, 30, 37); g.fillStyle = '#7a7486'; g.fillRect(x - 15, y - 31, 30, 3);
    g.fillStyle = '#4a4454'; for (let i = 0; i < 5; i++) g.fillRect(x - 15 + (i % 2) * 24, y - 25 + i * 6, 6, 1);
    // 문 안쪽: 다음 층의 빛 (보상 색)
    const glow = 0.55 + 0.25 * Math.sin(t * 3 + x) + (near ? 0.2 : 0);
    g.fillStyle = '#100c18'; g.fillRect(x - 10, y - 25, 20, 31);
    g.fillStyle = hexA(col, glow * age); g.fillRect(x - 10, y - 25 + Math.round(31 * (1 - age)), 20, Math.round(31 * age));
    g.fillStyle = hexA('#ffffff', 0.25 * age); g.fillRect(x - 3, y - 25, 6, 31);
    for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i / 3 + x * 0.01) % 1; g.fillStyle = hexA('#ffffff', 0.7 * (1 - ph) * age); g.fillRect(x - 7 + i * 6, Math.round(y + 4 - ph * 26), 1, 2); }
    // 문 위의 보상 그림 (둥근 판 위)
    const iy = y - 44 + Math.sin(t * 2.4 + x) * 1.5;
    g.fillStyle = '#0d0b10'; g.beginPath(); g.arc(x, iy, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#241e30'; g.beginPath(); g.arc(x, iy, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = hexA(col, 0.9); g.lineWidth = 1; g.beginPath(); g.arc(x, iy, 8.5, 0, Math.PI * 2); g.stroke();
    rewardIcon(g, o.next, x, iy, t);
    if (near && Math.random() < 0.3) R.parts.push({ x: x + (Math.random() - 0.5) * 18, y: y - Math.random() * 20, vx: 0, vy: -20, t: 0.6, max: 0.6, color: col, g: -10, glow: true, size: 1 });
    o._top = iy - 12;
    return;
  }
}

// 등반 HUD: 위 가운데(층 · 남은 적), 작은 지도 아래(이 층 시간 · 서약 · 권장 레벨), 문이 화면 밖이면 화살표
export function drawClimbHud(R, w, topY) {
  const C = w.climb, run = C.run, u = R.u, g = R.g, W = R.c.width, H = R.c.height, tu = Math.max(1, u - 1);
  const act = actOf(C.f);
  // 위 가운데
  const big = C.kind === 'guardian' || C.kind === 'lord';
  R.text(`각인의 탑 ${C.f}층 · ${act.name}`, W / 2, topY, u, act.color, 'center', true, true);
  if (!big || C.phase !== 'fight') {
    let sub = '', col = '#e8dcc0';
    if (C.phase === 'fight') {
      const alive = w.enemies.filter((e) => !e.dead && e.climb && !e.summoned).length + C.waves.slice(C.waveI).reduce((a, x) => a + x.filter((q) => !q.treasure).length, 0);
      sub = `남은 적 ${alive}`; col = alive <= 2 ? '#ffe8a8' : '#ff9a8a';
    } else sub = '문이 열렸다. 문 앞에서 G';
    R.text(sub, W / 2, topY + 15 * u, tu, col, 'center', true, false);
    const M = FLOOR_MODS[C.mod]; if (M) R.text(`${M.name} · ${M.text}`, W / 2, topY + 28 * u, tu, M.color, 'center', true, false);
  }
  // 문 이름 (문 위)
  for (const o of w.objects) {
    if (o.kind !== 'climbDoor' || o._top == null) continue;
    const Rw = REWARDS[o.next]; if (!Rw) continue;
    R.text(Rw.name, R.sx(o.x), R.sy(o._top) - 6 * u, u, Rw.color, 'center', true, true);
  }
  // 작은 지도 아래
  const x = W - 10 * u;
  let y = (R.minimapBottom || 80 * u) + 14 * u;
  const tt = w.tower?.t || 0, hasteOver = C.oath.haste && tt > 90;
  R.text(`이 층 ${Math.floor(tt / 60)}:${String(Math.floor(tt % 60)).padStart(2, '0')}${C.oath.haste ? ' / 1:30' : ''}`, x, y, tu, hasteOver ? '#ff8a7a' : '#b8b0c8', 'right'); y += 13 * u;
  const sc = oathScore(run.oath); if (sc) { R.text(`서약 ${sc}`, x, y, tu, '#ff8a7a', 'right'); y += 13 * u; }
  const lg = levelGap(C.f, w.b.level); if (lg.gap) { R.text(`권장 Lv ${recLevel(C.f)} · 적 공격 +${Math.round((lg.atk - 1) * 100)}%`, x, y, tu, '#ff9a8a', 'right'); y += 13 * u; }
  // 문이 화면 밖이면 가장자리 화살표
  if (C.phase !== 'fight') { const p = w.player; let best = null, bd = 1e9; for (const o of w.objects) if (o.kind === 'climbDoor') { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } } if (best) R.edgeArrow(best.x, best.y - 16, '#c8b8ff', '문', false); }
  R.drawTip();
}

// 탑 등반의 것들 그리기: 다음 층으로 가는 문(위에 보상 그림) · 층을 깨면 나타나는 보상 제단 · 쉬는 방의 상인 · 제단 · 모닥불
import { REWARDS, actOf, BLESSINGS, GRADE_COLOR, GRADE_NAME, oathScore, recLevel, levelGap, FLOOR_MODS } from '../data/climb.js';
import { ENGRAVINGS, TAGS } from '../data/engravings.js';
import { STAT_INFO, SPECIAL_INFO } from '../data/stats.js';

const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const px = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

// 보상 그림 (가운데 x, y · 약 11×11 도트)
export function rewardIcon(g, kind, x, y, t = 0) {
  x = Math.round(x); y = Math.round(y);
  const O = '#0d0b10';
  switch (kind) {
    case 'eng': { // 각인: 금빛 마름모 문양
      const c = '#ffcf5a', d = '#a8781a', l = '#fff2b8';
      for (let i = 0; i <= 5; i++) { px(g, O, x - i - 1, y - 5 + i, 2 * i + 3, 1); px(g, O, x - i - 1, y + 5 - i, 2 * i + 3, 1); }
      for (let i = 0; i <= 4; i++) { px(g, c, x - i, y - 4 + i, 2 * i + 1, 1); px(g, d, x - i, y + 4 - i, 2 * i + 1, 1); }
      px(g, O, x - 2, y, 5, 1); px(g, O, x, y - 2, 1, 5); px(g, l, x - 1, y - 3, 1, 1); px(g, l, x - 3, y - 1, 1, 1);
      break;
    }
    case 'hone': { // 연마: 숫돌과 불꽃
      px(g, O, x - 5, y + 1, 11, 5); px(g, '#6a7a8a', x - 4, y + 2, 9, 3); px(g, '#9aaabb', x - 4, y + 2, 9, 1);
      const f = Math.floor(t * 8) % 2;
      px(g, '#7ad8ff', x - 1 + f, y - 4, 1, 1); px(g, '#ffffff', x + 1 - f, y - 2, 1, 1); px(g, '#7ad8ff', x + 3, y - 3 + f, 1, 1); px(g, '#bff0ff', x - 3, y - 1, 1, 1);
      break;
    }
    case 'bless': { // 축복: 분홍 별꽃
      px(g, O, x - 1, y - 6, 3, 13); px(g, O, x - 6, y - 1, 13, 3); px(g, O, x - 3, y - 3, 7, 7);
      px(g, '#ff9ad8', x, y - 5, 1, 11); px(g, '#ff9ad8', x - 5, y, 11, 1); px(g, '#ff9ad8', x - 2, y - 2, 5, 5); px(g, '#ffe0f4', x - 1, y - 1, 2, 2);
      break;
    }
    case 'gold': { // 금화 더미
      for (const [ox, oy] of [[-3, 1], [2, 1], [-1, -3]]) { px(g, O, x + ox - 3, y + oy - 3, 7, 7); px(g, '#ffd84a', x + ox - 2, y + oy - 2, 5, 5); px(g, '#a87a1a', x + ox - 2, y + oy + 2, 5, 1); px(g, '#fff2a8', x + ox - 1, y + oy - 1, 1, 2); }
      break;
    }
    case 'heal': { // 샘: 초록 물방울
      px(g, O, x - 1, y - 6, 3, 2); px(g, O, x - 3, y - 4, 7, 3); px(g, O, x - 5, y - 1, 11, 6); px(g, O, x - 4, y + 5, 9, 1);
      px(g, '#7be38a', x, y - 5, 1, 2); px(g, '#7be38a', x - 2, y - 3, 5, 3); px(g, '#7be38a', x - 4, y, 9, 4); px(g, '#3a9a4a', x - 3, y + 4, 7, 1); px(g, '#e0ffe8', x - 2, y - 1, 1, 2);
      break;
    }
    case 'shard': { // 별빛: 보랏빛 네 갈래 별
      const s = 1 + Math.round(Math.sin(t * 4) * 0.5);
      px(g, O, x - 1, y - 6 - s, 3, 13 + 2 * s); px(g, O, x - 6 - s, y - 1, 13 + 2 * s, 3);
      px(g, '#b8a8ff', x, y - 5 - s, 1, 11 + 2 * s); px(g, '#b8a8ff', x - 5 - s, y, 11 + 2 * s, 1); px(g, '#ffffff', x, y, 1, 1); px(g, '#e0d8ff', x - 1, y - 1, 3, 3); px(g, '#ffffff', x, y, 1, 1);
      break;
    }
    case 'trial': { // 시련: 엇갈린 두 칼
      for (let i = -4; i <= 4; i++) { px(g, O, x + i - 1, y + i - 1, 3, 3); px(g, O, x - i - 1, y + i - 1, 3, 3); }
      for (let i = -4; i <= 4; i++) { px(g, '#e8e8f0', x + i, y + i, 1, 1); px(g, '#e8e8f0', x - i, y + i, 1, 1); }
      px(g, '#ff6a5a', x - 5, y + 3, 3, 1); px(g, '#ff6a5a', x + 3, y + 3, 3, 1); px(g, '#ff6a5a', x - 1, y - 1, 3, 3);
      break;
    }
    case 'shop': { // 상인: 금화 주머니
      px(g, O, x - 5, y - 2, 11, 9); px(g, O, x - 2, y - 5, 5, 4);
      px(g, '#c8945a', x - 4, y - 1, 9, 7); px(g, '#8a5a32', x - 4, y + 5, 9, 1); px(g, '#c8945a', x - 1, y - 4, 3, 3); px(g, '#ffd84a', x - 1, y + 1, 3, 3); px(g, '#e8b878', x - 3, y, 1, 2);
      break;
    }
    case 'altar': { // 제단: 보랏빛 촛불 셋
      px(g, O, x - 6, y + 2, 13, 4); px(g, '#5a4a6a', x - 5, y + 3, 11, 2);
      for (const ox of [-4, 0, 4]) { px(g, O, x + ox - 1, y - 3, 3, 6); px(g, '#e8e0d0', x + ox, y - 2, 1, 5); const f = Math.sin(t * 9 + ox) > 0 ? 1 : 0; px(g, '#c45cff', x + ox, y - 5 - f, 1, 2); }
      break;
    }
    case 'rest': { // 쉼터: 모닥불
      px(g, O, x - 6, y + 3, 13, 3); px(g, '#7a5232', x - 5, y + 4, 11, 1);
      const f = Math.round(Math.sin(t * 10));
      px(g, O, x - 4, y - 4 + f, 9, 8); px(g, '#e8501a', x - 3, y - 3 + f, 7, 6); px(g, '#ffb040', x - 2, y - 1 + f, 5, 4); px(g, '#fff2b0', x - 1, y + 1, 3, 2);
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
  if (o.kind === 'climbReward') {
    const x = Math.round(o.x), y = Math.round(o.y), col = REWARDS[o.reward]?.color || '#ffffff';
    if (o.opened) { // 받은 뒤: 빈 받침돌
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 4, 12, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0d0b10'; g.fillRect(x - 9, y - 6, 18, 11); g.fillStyle = '#4a4454'; g.fillRect(x - 8, y - 5, 16, 9); g.fillStyle = '#6a6474'; g.fillRect(x - 8, y - 5, 16, 2);
      o._top = y - 8; return;
    }
    const age = Math.min(1, (t - (o.born || 0)) / 0.8);
    // 빛기둥
    const gr = g.createLinearGradient(0, y - 70, 0, y);
    gr.addColorStop(0, hexA(col, 0)); gr.addColorStop(1, hexA(col, 0.35 * age));
    g.fillStyle = gr; g.fillRect(x - 9, y - 70, 18, 70);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 4, 13, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0d0b10'; g.fillRect(x - 10, y - 7, 20, 12);
    g.fillStyle = '#5a5464'; g.fillRect(x - 9, y - 6, 18, 10); g.fillStyle = '#7a7486'; g.fillRect(x - 9, y - 6, 18, 2);
    g.fillStyle = hexA(col, 0.8); g.fillRect(x - 6, y - 2, 12, 1);
    const iy = y - 20 - Math.sin(t * 2.6) * 2.5 - (1 - age) * 12;
    g.fillStyle = hexA(col, 0.25 + 0.15 * Math.sin(t * 5)); g.beginPath(); g.arc(x, iy, 11, 0, Math.PI * 2); g.fill();
    rewardIcon(g, o.reward === 'eng' && o.minGrade >= 4 ? (o.legendary ? 'lord' : 'eng') : o.reward, x, iy, t);
    if (Math.random() < 0.25) R.parts.push({ x: x + (Math.random() - 0.5) * 16, y: y - 6, vx: 0, vy: -26, t: 1, max: 1, color: col, g: -6, glow: true, size: 1 });
    o._top = iy - 14;
    return;
  }
  if (o.kind === 'climbRoom') {
    if (o.room === 'shop') { R.drawNpc(w, o); return; }
    if (o.room === 'rest') { R.drawObject(w, { kind: 'rest', x: o.x, y: o.y }, dt); o._top = o.y - 24; return; }
    if (o.room === 'altar') {
      const x = Math.round(o.x), y = Math.round(o.y), lit = !o.used;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y + 4, 18, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0d0b10'; g.fillRect(x - 17, y - 14, 34, 19); g.fillStyle = '#3a3048'; g.fillRect(x - 16, y - 13, 32, 17); g.fillStyle = '#54486a'; g.fillRect(x - 16, y - 13, 32, 3);
      g.fillStyle = lit ? '#c45cff' : '#4a4058'; for (let i = 0; i < 5; i++) g.fillRect(x - 12 + i * 6, y - 7, 3, 1);
      for (const ox of [-12, 0, 12]) { g.fillStyle = '#0d0b10'; g.fillRect(x + ox - 2, y - 24, 4, 11); g.fillStyle = '#e8e0d0'; g.fillRect(x + ox - 1, y - 23, 2, 10); if (lit) { const f = Math.sin(t * 9 + ox) > 0 ? 1 : 0; g.fillStyle = '#c45cff'; g.fillRect(x + ox - 1, y - 27 - f, 2, 3); g.fillStyle = '#ffffff'; g.fillRect(x + ox, y - 26, 1, 1); } }
      if (lit && Math.random() < 0.15) R.parts.push({ x: x + (Math.random() - 0.5) * 26, y: y - 26, vx: 0, vy: -14, t: 1, max: 1, color: '#c45cff', g: -5, glow: true, size: 1 });
      o._top = y - 30;
      return;
    }
  }
}

// 등반 HUD: 위 가운데(층 · 남은 적), 작은 지도 아래(금화 · 별빛 · 다시 고르기 · 두 번째 숨 · 서약), 왼쪽 아래(새긴 각인 · 축복)
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
    } else if (C.phase === 'reward') sub = w.objects.some((o) => o.kind === 'climbReward' && !o.opened) ? '보상을 받자 — 가운데 빛 앞에서 G' : '문을 골라 나아가자 — 문 위의 그림이 다음 층의 보상';
    else if (C.phase === 'room') sub = '문을 골라 나아가자';
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
  R.text(`◆ 탑 금화 ${run.gold}`, x, y, u, '#ffd84a', 'right', true, true); y += 15 * u;
  R.text(`✦ 별빛 ${run.shards}`, x, y, u, '#b8a8ff', 'right', true, true); y += 15 * u;
  const tt = w.tower?.t || 0, hasteOver = C.oath.haste && tt > 90;
  R.text(`이 층 ${Math.floor(tt / 60)}:${String(Math.floor(tt % 60)).padStart(2, '0')}${C.oath.haste ? ' / 1:30' : ''}`, x, y, tu, hasteOver ? '#ff8a7a' : '#b8b0c8', 'right'); y += 13 * u;
  if (run.rerolls) { R.text(`다시 고르기 ${run.rerolls}`, x, y, tu, '#ffe8a8', 'right'); y += 13 * u; }
  if (run.revives) { R.text(`두 번째 숨 ${run.revives}`, x, y, tu, '#8ad8ff', 'right'); y += 13 * u; }
  const sc = oathScore(run.oath); if (sc) { R.text(`서약 ${sc}`, x, y, tu, '#ff8a7a', 'right'); y += 13 * u; }
  const lg = levelGap(C.f, w.b.level); if (lg.gap) { R.text(`권장 Lv ${recLevel(C.f)} · 적 공격 +${Math.round((lg.atk - 1) * 100)}%`, x, y, tu, '#ff9a8a', 'right'); y += 13 * u; }
  // 보상 · 문이 화면 밖이면 가장자리 화살표
  const ro = w.objects.find((o) => o.kind === 'climbReward' && !o.opened);
  if (ro && C.phase === 'reward') R.edgeArrow(ro.x, ro.y - 14, '#ffe8a8', '보상', true);
  else if (C.phase !== 'fight') { const p = w.player; let best = null, bd = 1e9; for (const o of w.objects) if (o.kind === 'climbDoor') { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } } if (best) R.edgeArrow(best.x, best.y - 16, '#c8b8ff', '문', false); }
  // 왼쪽 아래: 새긴 각인 · 축복
  const cs = 14 * u, gap = 3 * u, x0 = 10 * u, y0 = H - 78 * u;
  let cx = x0, row = 0;
  const tips = R.tipRects || (R.tipRects = []);
  const chip = (col, label, title, lines, lv) => {
    if (cx + cs > W * 0.3) { cx = x0; row++; }
    const yy = y0 - row * (cs + gap);
    g.fillStyle = '#0d0b10'; g.fillRect(cx - u, yy - u, cs + 2 * u, cs + 2 * u);
    g.fillStyle = '#1a1626'; g.fillRect(cx, yy, cs, cs);
    g.fillStyle = col; g.fillRect(cx, yy, cs, 2 * u); g.fillRect(cx, yy + cs - u, cs, u);
    R.text(label, cx + cs / 2, yy + cs / 2 + u, tu, col, 'center', false, true);
    if (lv) R.text(`+${lv}`, cx + cs - u, yy + 3 * u, Math.max(1, tu - (tu > 1 ? 1 : 0)), '#ffffff', 'right', true, true);
    tips.push({ x: cx, y: yy, w: cs, h: cs, title, color: col, lines, up: true });
    cx += cs + gap;
  };
  for (const e of run.eng) {
    const d = ENGRAVINGS[e.id]; if (!d) continue;
    const st = Object.entries(d.stats || {}).map(([k, v]) => `${(STAT_INFO[k] || SPECIAL_INFO[k] || { name: k }).name} ${v > 0 ? '+' : ''}${v}`).join(' · ');
    chip(GRADE_COLOR[d.grade], d.name.slice(0, 1), `${d.name}${e.lv ? ` +${e.lv}` : ''}`, [`${GRADE_NAME[d.grade]} · ${(d.tags || []).map((t) => TAGS[t]?.name || t).join(' · ')}`, ...(st ? [st] : []), ...(d.effects || []).map((x) => x.text)], e.lv);
  }
  for (const [id, n] of Object.entries(run.bless || {})) {
    const B = BLESSINGS[id]; if (!B) continue;
    chip(B.color, B.name.slice(0, 1), `${B.name}${n > 1 ? ` ×${n}` : ''}`, [B.text + (n > 1 ? ` (×${n})` : '')], n > 1 ? n : 0);
  }
  R.drawTip();
}

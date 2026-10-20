// 성지 마을을 그린다: 우두머리(왕관 · 망토) · 하는 일이 보이는 주민 · 날아다니는 것들 · 수련 과녁 · 수련 화면 · 말풍선
import { TILE } from '../sim/mapgen.js';
import { sprite } from './assets.js';
import { SANCTUMS, SANCT_LIFE, FIND_NAME } from '../data/sanctums.js';
import { hash } from './tiles.js';
import { flameSprite } from './pxfx.js';

const OL = '#0d0b10';
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const disc = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); };
const glowAt = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
const poly = (g, col, pts) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; };

// ───── 우두머리: 조금 크게, 망토 · 머리 장식, 의뢰가 있으면 ! (끝낸 의뢰는 ?) ─────
export function drawLeader(r, w, o) {
  const g = r.g, A = o.art, sc = A.big ? 1.28 : 1.16, dir = w.player.x < o.x ? -1 : 1;
  const img = sprite(r.animFrame(A.base, 'idle', w.t + o.x * 0.01, 4), A.tint || '', false, dir < 0);
  r.shadow(o.x, o.y + 4, 8);
  if (!img) return;
  const W0 = img.width * sc, H0 = img.height * sc, x0 = o.x - W0 / 2, y0 = o.y + 5 - H0, sw = Math.sin(w.t * 1.6 + o.x) * 1.5;
  // 망토 (몸 뒤에서 바람에 날린다)
  const top = y0 + H0 * 0.34, bot = o.y + 4;
  poly(g, OL, [[o.x - 7, top], [o.x + 7, top], [o.x + 9 - dir * 4 + sw, bot], [o.x - 9 - dir * 4 + sw, bot]]);
  poly(g, A.cape, [[o.x - 6, top + 1], [o.x + 6, top + 1], [o.x + 8 - dir * 4 + sw, bot - 1], [o.x - 8 - dir * 4 + sw, bot - 1]]);
  poly(g, 'rgba(255,255,255,0.12)', [[o.x - 6, top + 1], [o.x - 2, top + 1], [o.x - 4 - dir * 4 + sw, bot - 1], [o.x - 8 - dir * 4 + sw, bot - 1]]);
  g.drawImage(img, Math.round(x0), Math.round(y0), Math.round(W0), Math.round(H0));
  crown(g, A.crown, o.x + dir * 0.5, y0 + 2 * sc, A.hi, w.t, dir);
  o._top = y0 - 4;
  const st = w.story?.sanct?.[o.race], L = SANCT_LIFE[o.race];
  const ready = !!st?.cur?.done, fresh = !st?.cur && (st?.step || 0) < L.quests.length;
  if (ready || fresh) mark(g, o.x, o._top - 22 + Math.sin(w.t * 5) * 1.5, ready ? '?' : '!'); // 이름표 위
}
function mark(g, x, y, k) { // 머리 위 노란 ! · ?
  x = Math.round(x); y = Math.round(y);
  if (k === '!') { R(g, OL, x - 2, y - 1, 5, 11); R(g, '#ffd040', x - 1, y, 3, 6); R(g, '#ffd040', x - 1, y + 7, 3, 2); return; }
  R(g, OL, x - 3, y - 1, 7, 12); R(g, '#ffd040', x - 2, y, 5, 2); R(g, '#ffd040', x + 1, y + 1, 2, 3); R(g, '#ffd040', x - 1, y + 4, 3, 2); R(g, '#ffd040', x - 1, y + 8, 3, 2);
}
function crown(g, kind, x, y, hi, t, dir) {
  x = Math.round(x); y = Math.round(y);
  if (kind === 'crown') { R(g, OL, x - 5, y - 4, 11, 6); R(g, '#e8c040', x - 4, y - 3, 9, 4); for (const dx of [-4, 0, 4]) { R(g, OL, x + dx - 1, y - 7, 3, 4); R(g, '#ffd860', x + dx, y - 6, 1, 3); } R(g, '#e83a3a', x - 1, y - 2, 2, 2); }
  else if (kind === 'tiara') { R(g, OL, x - 5, y - 2, 11, 3); R(g, '#e8eef4', x - 4, y - 1, 9, 1); R(g, OL, x - 2, y - 5, 5, 4); R(g, '#7be38a', x - 1, y - 4, 3, 2); glowAt(g, x, y - 3, 6, 'rgba(150,255,170,A)', 0.4 + 0.2 * Math.sin(t * 2)); }
  else if (kind === 'hat') { poly(g, OL, [[x - 8, y + 1], [x + 8, y + 1], [x + 2 + dir * 4, y - 14], [x - 1 + dir * 5, y - 16]]); poly(g, '#4a2a9a', [[x - 7, y], [x + 7, y], [x + 2 + dir * 4, y - 13]]); R(g, '#ffd76a', x - 2, y - 6, 2, 2); R(g, '#ffd76a', x + 2, y - 9, 1, 1); R(g, OL, x - 9, y, 18, 2); R(g, '#5a3ab0', x - 8, y, 16, 1); }
  else if (kind === 'horns') { for (const s of [-1, 1]) { poly(g, OL, [[x + s * 3, y - 1], [x + s * 10, y - 9], [x + s * 6, y - 1]]); poly(g, '#f0e6cc', [[x + s * 4, y - 1], [x + s * 9, y - 8], [x + s * 6, y - 2]]); } R(g, OL, x - 5, y - 2, 11, 3); R(g, '#7a5a3a', x - 4, y - 1, 9, 1); }
  else if (kind === 'mask') { R(g, OL, x - 5, y + 3, 11, 4); R(g, '#c8c0d8', x - 4, y + 4, 9, 2); R(g, '#b8a0ff', x - 3 + dir, y + 4, 2, 1); R(g, '#b8a0ff', x + 1 + dir, y + 4, 2, 1); }
  else if (kind === 'feathers') { for (const [dx, c, h] of [[-3, '#e8503a', 9], [0, '#ffd040', 12], [3, '#3aa0e0', 9]]) { const wv = Math.sin(t * 2 + dx) * 1; poly(g, OL, [[x + dx - 2, y], [x + dx + wv, y - h - 1], [x + dx + 2, y]]); poly(g, c, [[x + dx - 1, y], [x + dx + wv, y - h], [x + dx + 1, y]]); } }
}

// ───── 주민: 하는 일마다 동작 · 손에 든 것 · 날아가는 화살 · 마법 · 칼 ─────
const CYCLE = { archer: 2.6, caster: 3.0, thrower: 2.2, spar: 1.5, drum: 0.75, dig: 1.8, smith: 1.1, read: 5, stargaze: 6, meditate: 4, tend: 3, wander: 3, patrol: 3, idle: 4 };
export function drawResident(r, w, o, dt) {
  const g = r.g, rd = o.rd, t = w.t, act = o.say ? 'idle' : rd.act, sc = rd.small ? 0.78 : 1;
  const cyc = CYCLE[act] || 3, k = ((t + o.phase * 0.5) % cyc) / cyc, prevK = o._k ?? k; o._k = k;
  const crossed = (at) => (prevK < at && k >= at) || (prevK > k && at < k); // 이번 프레임에 그 순간을 지났다
  const face = o.say ? (Math.sign(w.player.x - o.x) || 1) : (o.face || 1);
  const pat = o.pat;
  let bob = 0, lean = 0, sy = 1, hold = null;
  if (act === 'archer') { const pull = k < 0.55 ? k / 0.55 : 0; hold = { item: 'bow', pull, ang: pat ? Math.atan2(pat.y - 22 - (o.y - 10), (pat.x - o.x)) : 0 }; lean = -pull; if (crossed(0.55) && pat) shoot(r, w, o, 'arrow'); }
  else if (act === 'caster') { const up = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) * 2; hold = { item: 'staff', up }; if (k > 0.3 && k < 0.5 && Math.random() < 0.4) r.parts.push({ x: o.x + face * 6, y: o.y - 22 - up * 4, vx: (Math.random() - 0.5) * 10, vy: -10, t: 0.4, max: 0.4, color: '#c9a8ff', g: 0, glow: true, size: 1 }); if (crossed(0.5) && pat) shoot(r, w, o, 'bolt'); }
  else if (act === 'thrower') { const wind = k < 0.45 ? k / 0.45 : 0; hold = { item: 'knife', wind }; lean = k > 0.45 && k < 0.6 ? 1.5 : -wind; if (crossed(0.45) && pat) shoot(r, w, o, 'knife'); }
  else if (act === 'spar') { const mine = rd.pair % 2 === 0 ? k < 0.5 : k >= 0.5, q = mine ? Math.sin(((k % 0.5) / 0.5) * Math.PI) : 0; lean = q * 3; hold = { item: rd.base.startsWith('orc') || rd.base.startsWith('masked') ? 'axe' : rd.base.startsWith('lizard') ? 'spear' : 'sword', swing: q }; if (rd.pair % 2 === 0 && (crossed(0.2) || crossed(0.7))) clash(r, o, face); }
  else if (act === 'drum') { const q = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) * 2; hold = { item: 'stick', q }; if (crossed(0.5) && pat) { hitProp(w, pat); for (let i = 0; i < 4; i++) r.parts.push({ x: pat.x + (Math.random() - 0.5) * 16, y: pat.y - 6, vx: (Math.random() - 0.5) * 30, vy: -10, t: 0.4, max: 0.4, color: '#c8b8a0', g: 0, steam: true }); } }
  else if (act === 'dig') { const q = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) * 2; hold = { item: 'shovel', q }; lean = q * 1.5; if (crossed(0.5) && pat) for (let i = 0; i < 6; i++) r.parts.push({ x: o.x + face * 9, y: o.y + 2, vx: face * (10 + Math.random() * 30), vy: -30 - Math.random() * 30, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#5a4a3a' : '#7a6a54', g: 200 }); }
  else if (act === 'smith') { const q = k < 0.6 ? k / 0.6 : 1 - (k - 0.6) / 0.4; hold = { item: 'hammer', q }; if (crossed(0.6) && pat) { hitProp(w, pat); for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2; r.parts.push({ x: pat.x, y: pat.y - 16, vx: Math.cos(a) * (40 + Math.random() * 60), vy: Math.sin(a) * (40 + Math.random() * 60), t: 0.35, max: 0.35, color: Math.random() < 0.5 ? '#ffd27a' : '#fff4d0', g: 260, glow: true, size: 1 }); } } }
  else if (act === 'read') { hold = { item: 'book' }; bob = Math.sin(t * 1.2 + o.phase) * 0.3; }
  else if (act === 'stargaze') { lean = -1; }
  else if (act === 'meditate') { sy = 0.82; bob = 3; if (Math.random() < 0.15) r.parts.push({ x: o.x + (Math.random() - 0.5) * 14, y: o.y - Math.random() * 10, vx: 0, vy: -20, t: 0.8, max: 0.8, color: Math.random() < 0.5 ? '#ff8a3a' : '#ffd040', g: -10, glow: true, size: 1 }); }
  else if (act === 'tend') { if (!o.moving && pat && Math.hypot(o.x - pat.x, o.y - pat.y) < 22) { sy = 0.9; if (Math.random() < 0.06) r.parts.push({ x: pat.x + (Math.random() - 0.5) * 12, y: pat.y - 6, vx: 0, vy: -16, t: 0.7, max: 0.7, color: SANCTUMS[o.race].color, g: -8, glow: true, size: 1 }); } }
  const moving = o.moving && !o.say;
  const img = sprite(r.animFrame(rd.base, moving ? 'run' : 'idle', t + o.phase, moving ? 10 : 4), rd.tint || '', false, face < 0);
  r.shadow(o.x, o.y + 4, 6 * sc);
  if (!img) return;
  const W0 = img.width * sc, H0 = img.height * sc * sy, x0 = Math.round(o.x - W0 / 2 + lean * face), y0 = Math.round(o.y + 5 - H0 + bob);
  const front = hold && hold.item !== 'book' && hold.item !== 'shovel'; // 손에 든 것은 대개 몸 앞에 (삽은 몸 뒤로)
  if (hold && !front && hold.item !== 'book') heldItem(g, hold, o.x + face * (5 + Math.max(0, lean)), o.y - 9 * sc + bob, face, t);
  g.drawImage(img, x0, y0, Math.round(W0), Math.round(H0));
  if (front) heldItem(g, hold, o.x + face * (6 + Math.max(0, lean)), o.y - 9 * sc + bob, face, t);
  if (hold?.item === 'book') { R(g, OL, o.x + face * 3 - 4, o.y - 9, 8, 6); R(g, '#8a3a3a', o.x + face * 3 - 3, o.y - 8, 6, 4); R(g, '#f4ecd8', o.x + face * 3 - 3, o.y - 8, 6, 1); }
  o._top = y0;
}
function heldItem(g, h, x, y, face, t) {
  g.save(); g.translate(Math.round(x), Math.round(y));
  if (h.item === 'bow') { // 활: 조준 쪽으로, 시위를 당긴 만큼 휜다
    g.scale(face, 1); g.rotate(face > 0 ? h.ang : Math.PI - h.ang); // 바라보는 쪽으로 뒤집은 뒤 과녁 쪽으로
    g.strokeStyle = OL; g.lineWidth = 3; g.beginPath(); g.arc(-2, 0, 8, -1.2, 1.2); g.stroke();
    g.strokeStyle = '#8a5a32'; g.lineWidth = 1.5; g.beginPath(); g.arc(-2, 0, 8, -1.2, 1.2); g.stroke();
    const sx = 1 - h.pull * 8; g.strokeStyle = '#e8e2cf'; g.lineWidth = 1; g.beginPath(); g.moveTo(1, -7.5); g.lineTo(sx, 0); g.lineTo(1, 7.5); g.stroke();
    if (h.pull > 0.15) { R(g, '#d8c8a0', sx, -0.5, 12, 1); R(g, '#e8eef4', sx + 11, -1, 2, 2); }
  } else if (h.item === 'staff') { g.rotate(-1.2 - h.up * 0.5); R(g, OL, -1, -16, 3, 20); R(g, '#6a4a2e', 0, -15, 1, 18); disc(g, 0.5, -17, 3, OL); disc(g, 0.5, -17, 2, '#c9a8ff'); glowAt(g, 0.5, -17, 7, 'rgba(200,170,255,A)', 0.3 + h.up * 0.4); }
  else if (h.item === 'knife') { g.rotate(face > 0 ? -0.5 - h.wind * 1.6 : Math.PI + 0.5 + h.wind * 1.6); R(g, OL, -1, -1, 9, 3); R(g, '#d0d8e4', 2, 0, 6, 1); R(g, '#5a3a5a', -1, 0, 3, 1); }
  else if (h.item === 'sword' || h.item === 'axe' || h.item === 'spear') {
    g.scale(face, 1); g.rotate(-0.9 + h.swing * 1.9);
    if (h.item === 'sword') { R(g, OL, -1, -15, 3, 16); R(g, '#e8eef4', 0, -14, 1, 13); R(g, OL, -3, -2, 7, 2); R(g, '#c8a040', -2, -2, 5, 1); }
    else if (h.item === 'axe') { R(g, OL, -1, -14, 3, 16); R(g, '#7a5432', 0, -13, 1, 14); poly(g, OL, [[1, -14], [7, -16], [7, -8], [1, -9]]); poly(g, '#a8b0bc', [[2, -13], [6, -15], [6, -9], [2, -10]]); }
    else { R(g, OL, -1, -20, 3, 22); R(g, '#8a6a3a', 0, -19, 1, 20); poly(g, '#e8eef4', [[-1, -20], [0.5, -26], [2, -20]]); }
  } else if (h.item === 'stick') { g.rotate(-1.6 + h.q * 1.4); R(g, OL, -1, -10, 3, 11); R(g, '#a87a48', 0, -9, 1, 9); disc(g, 0.5, -10, 2.2, '#e8dcc0'); }
  else if (h.item === 'shovel') { g.rotate(-0.3 + h.q * 1.1); R(g, OL, -1, -14, 3, 18); R(g, '#8a5a32', 0, -13, 1, 16); R(g, OL, -3, 3, 7, 6); R(g, '#a8a8b0', -2, 4, 5, 4); }
  else if (h.item === 'hammer') { g.scale(face, 1); g.rotate(-1.9 + h.q * 2.1); R(g, OL, -1, -12, 3, 13); R(g, '#7a5432', 0, -11, 1, 11); R(g, OL, -4, -15, 9, 5); R(g, '#5a5a66', -3, -14, 7, 3); }
  g.restore();
}
function hitProp(w, pt) { // 그 자리의 소품을 흔든다 (과녁 · 북 · 모루 …)
  const tx = Math.floor(pt.x / TILE), ty = Math.floor(pt.y / TILE);
  const pr = w.map.props?.find((p) => p.x === tx && p.y === ty);
  if (pr) pr.hitT = 0.4;
  return pr;
}
function clash(r, o, face) { const x = o.x + face * 12, y = o.y - 12; for (let i = 0; i < 5; i++) { const a = Math.random() * Math.PI * 2; r.parts.push({ x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20, t: 0.22, max: 0.22, color: Math.random() < 0.5 ? '#fff4d0' : '#ffd27a', g: 200, glow: true, size: 1 }); } }
function shoot(r, w, o, kind) {
  const p = o.pat, x0 = o.x + (o.face || 1) * 10, y0 = o.y - 10, x1 = p.x + (Math.random() - 0.5) * 6, y1 = p.y - 22 + (Math.random() - 0.5) * 6;
  (r.vfx ||= []).push({ kind, x0, y0, x1, y1, t: 0, dur: Math.hypot(x1 - x0, y1 - y0) / (kind === 'bolt' ? 160 : 260), w, pat: p });
}
// 날아가는 화살 · 마법 · 칼 (그림만): 닿으면 소품에 꽂히고 흔들린다
export function drawVfx(r, w, dt) {
  const g = r.g, list = r.vfx || [];
  for (const v of list) {
    v.t += dt;
    const q = Math.min(1, v.t / v.dur), x = v.x0 + (v.x1 - v.x0) * q, y = v.y0 + (v.y1 - v.y0) * q - Math.sin(q * Math.PI) * (v.kind === 'arrow' ? 6 : 2), a = Math.atan2(v.y1 - v.y0, v.x1 - v.x0);
    if (v.kind === 'bolt') { glowAt(g, x, y, 9, 'rgba(190,150,255,A)', 0.7); disc(g, x, y, 2.5, '#e8dcff'); if (Math.random() < 0.5) r.parts.push({ x, y, vx: 0, vy: 0, t: 0.25, max: 0.25, color: '#b58cff', g: 0, glow: true, size: 1 }); }
    else { g.save(); g.translate(x, y); g.rotate(a); if (v.kind === 'arrow') { R(g, '#7a5a3a', -9, -0.5, 9, 1); R(g, '#e8eef4', 0, -1, 2, 2); R(g, '#f0f0f0', -10, -1.5, 2, 3); } else { g.rotate(v.t * 20); R(g, '#d0d8e4', -3, -0.5, 6, 1); R(g, OL, -4, -1, 2, 2); } g.restore(); }
    if (q >= 1 && !v.done) {
      v.done = true;
      const pr = hitProp(v.w, v.pat);
      if (pr && v.kind === 'arrow') { (pr.arrows ||= []).push([v.x1 - (pr.x * TILE + 8), v.y1 - (pr.y * TILE + 16 - 22) ]); if (pr.arrows.length > 4) pr.arrows.shift(); }
      if (pr && v.kind === 'knife') { (pr.knives ||= []).push([v.x1 - (pr.x * TILE + 8), v.y1 - (pr.y * TILE + 16 - 22)]); if (pr.knives.length > 4) pr.knives.shift(); }
      for (let i = 0; i < (v.kind === 'bolt' ? 8 : 4); i++) { const an = Math.random() * Math.PI * 2; r.parts.push({ x: v.x1, y: v.y1, vx: Math.cos(an) * 40, vy: Math.sin(an) * 40 - 10, t: 0.3, max: 0.3, color: v.kind === 'bolt' ? '#d8c8ff' : '#e8d8a0', g: v.kind === 'bolt' ? 0 : 160, glow: v.kind === 'bolt', size: 1 }); }
    }
  }
  r.vfx = list.filter((v) => !v.done);
  for (const pr of w.map.props || []) if (pr.hitT > 0) pr.hitT = Math.max(0, pr.hitT - dt);
}

// ───── 날아다니는 것들: 성지 둘레 (가까이 있을 때만) ─────
const FLY = { spirits: 8, runes: 6, doves: 5, vultures: 3, wisps: 7, crows: 5, pteros: 3, drakes: 3 };
export function drawFlyers(r, w, dt) {
  const vs = w.map.villages;
  if (!vs) return;
  const g = r.g, t = w.t, cx = r.cam.x + r.VW / 2, cy = r.cam.y + r.VH / 2;
  for (const [race, v] of Object.entries(vs)) {
    if (Math.abs(v.center.x - cx) > r.VW + 300 || Math.abs(v.center.y - cy) > r.VH + 300) continue;
    const kind = SANCT_LIFE[race].ambient, n = FLY[kind] || 4, C = v.center;
    for (let i = 0; i < n; i++) {
      const ph = i * 2.399 + race.length, s = 0.25 + (hash(i, race.length, 7) % 100) / 300;
      if (kind === 'spirits') { // 초록 · 금빛 · 하늘빛 정령이 세계수 둘레를 떠돈다 (꼬리를 남긴다)
        const a = t * s + ph, x = C.x + Math.cos(a) * (90 + (i % 3) * 40), y = C.y - 120 - (i % 4) * 30 + Math.sin(a * 1.7) * 26;
        const col = ['#bfffc8', '#fff0a8', '#a8e8ff'][i % 3];
        glowAt(g, x, y, 10, `rgba(${col === '#bfffc8' ? '190,255,200' : col === '#fff0a8' ? '255,240,170' : '170,230,255'},A)`, 0.55);
        disc(g, x, y, 2, col); R(g, '#ffffff', x - 0.5, y - 0.5, 1, 1);
        if (Math.random() < 0.3) r.parts.push({ x, y, vx: 0, vy: 4, t: 0.6, max: 0.6, color: col, g: 0, glow: true, size: 1 });
      } else if (kind === 'runes') { // 보랏빛 룬 조각이 탑 위쪽을 돈다
        const a = t * s * 1.2 + ph, x = C.x + Math.cos(a) * (50 + (i % 2) * 24), y = C.y - 200 - (i % 3) * 40 + Math.sin(a) * 10, sp = Math.sin(t * 2 + i);
        glowAt(g, x, y, 9, 'rgba(190,150,255,A)', 0.45);
        g.save(); g.translate(x, y); g.rotate(t * 0.8 + i); R(g, OL, -3, -3, 6, 6); R(g, '#c9a8ff', -2, -2, 4, 4); R(g, '#ffffff', -1, -2, 1, 3 + (sp > 0 ? 0 : 0)); g.restore();
      } else if (kind === 'doves' || kind === 'vultures' || kind === 'crows' || kind === 'pteros') { // 새 · 익룡: 날갯짓하며 맴돈다
        const big = kind === 'vultures' ? 1.4 : kind === 'pteros' ? 1.8 : 1, rad = kind === 'vultures' ? 150 : kind === 'pteros' ? 170 : 100 + (i % 2) * 40;
        const a = t * s * (kind === 'vultures' ? 0.5 : 1) + ph, x = C.x + Math.cos(a) * rad, y = C.y - (kind === 'vultures' ? 210 : 140) - (i % 3) * 22 + Math.sin(a * 2) * 12, dir = -Math.sin(a) >= 0 ? 1 : -1;
        const flap = Math.sin(t * (kind === 'vultures' ? 4 : 10) + i * 3), col = kind === 'doves' ? '#f4f0e8' : kind === 'pteros' ? '#7a8a5a' : '#2a2430';
        birdAt(g, x, y, big, flap, dir, col, kind === 'pteros');
      } else if (kind === 'wisps') { // 도깨비불: 무덤가 낮은 곳을 떠돌며 깜빡인다
        const a = t * s * 0.6 + ph, x = C.x + Math.cos(a) * (60 + (i % 3) * 50), y = C.y + 60 + Math.sin(a * 1.3) * 50 - 14 + Math.sin(t * 3 + i) * 3, fl = 0.5 + 0.5 * Math.sin(t * 5 + i * 2);
        glowAt(g, x, y, 12, i % 2 ? 'rgba(180,120,255,A)' : 'rgba(120,200,255,A)', 0.35 + fl * 0.3);
        poly(g, i % 2 ? '#d8b0ff' : '#b0e0ff', [[x - 2, y + 2], [x, y - 5 - fl * 2], [x + 2, y + 2]]); disc(g, x, y + 1, 2, '#ffffff');
      } else if (kind === 'drakes') { // 새끼 용: 머리뼈 둘레를 날며 불티를 흘린다
        const a = t * s * 0.9 + ph, x = C.x + Math.cos(a) * 130, y = C.y - 150 - (i % 2) * 30 + Math.sin(a * 2) * 16, dir = -Math.sin(a) >= 0 ? 1 : -1, flap = Math.sin(t * 8 + i * 2);
        drakeAt(g, x, y, flap, dir);
        if (Math.random() < 0.3) r.parts.push({ x: x - dir * 8, y: y + 2, vx: -dir * 10, vy: 10, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#ff8a3a' : '#ffd040', g: 20, glow: true, size: 1 });
      }
    }
  }
}
function birdAt(g, x, y, s, flap, dir, col, ptero) {
  x = Math.round(x); y = Math.round(y);
  const wy = flap * 4 * s;
  g.strokeStyle = OL; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(x - 7 * s, y - wy); g.quadraticCurveTo(x - 3 * s, y - 2 * s, x, y); g.quadraticCurveTo(x + 3 * s, y - 2 * s, x + 7 * s, y - wy); g.stroke();
  g.strokeStyle = col; g.lineWidth = 1.4 * s; g.beginPath(); g.moveTo(x - 7 * s, y - wy); g.quadraticCurveTo(x - 3 * s, y - 2 * s, x, y); g.quadraticCurveTo(x + 3 * s, y - 2 * s, x + 7 * s, y - wy); g.stroke();
  R(g, OL, x - 1, y - 1, 3, 3); R(g, col, x, y, 1, 1);
  if (ptero) { R(g, OL, x + dir * 2, y - 2, dir * 5, 2); R(g, '#c8a060', x + dir * 6, y - 2, dir * 2, 1); }
}
function drakeAt(g, x, y, flap, dir) {
  x = Math.round(x); y = Math.round(y);
  g.save(); g.translate(x, y); g.scale(dir, 1);
  const wy = flap * 5;
  poly(g, OL, [[-2, -2], [-8, -8 - wy], [-12, -2 - wy * 0.5], [-3, 1]]); poly(g, '#c83a1a', [[-2, -2], [-7, -7 - wy], [-10, -2 - wy * 0.5], [-3, 0]]);
  R(g, OL, -6, -2, 13, 5); R(g, '#e8502a', -5, -1, 11, 3); R(g, OL, 6, -4, 5, 4); R(g, '#e8502a', 7, -3, 3, 2); R(g, '#ffd040', 9, -3, 1, 1);
  R(g, OL, -10, 0, 5, 2); R(g, '#c83a1a', -9, 0, 4, 1);
  g.restore();
}

// 작은 도트 숫자 (3×5): 룬석 순서 표시
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
function digit(g, n, x, y, col) {
  const b = DIG[n % 10];
  g.fillStyle = OL; for (let i = 0; i < 15; i++) if (b[i] === '1') g.fillRect(x + (i % 3) - 1, y + ((i / 3) | 0) - 1, 3, 3);
  g.fillStyle = col; for (let i = 0; i < 15; i++) if (b[i] === '1') g.fillRect(x + (i % 3), y + ((i / 3) | 0), 1, 1);
}
// ───── 수련 과녁 · 허수아비 ─────
export function drawTrainTarget(r, w, e) {
  const g = r.g, t = w.t, x = Math.round(e.x), y = Math.round(e.y), age = t - (e.born || 0), pop = Math.min(1, age / 0.2);
  r.shadow(x, y + 4, 7);
  g.save(); g.translate(x, y + 4); g.scale(pop, pop); g.translate(-x, -(y + 4));
  const fl = e.hitFlash > 0 ? 1 : 0;
  if (e.look === 'archery') {
    R(g, OL, x - 7, y - 8, 3, 12); R(g, OL, x + 4, y - 8, 3, 12); R(g, '#8a5a32', x - 6, y - 7, 1, 11); R(g, '#8a5a32', x + 5, y - 7, 1, 11);
    disc(g, x, y - 14, 10, OL); disc(g, x, y - 14, 9, fl ? '#ffffff' : '#e8d8a0'); disc(g, x, y - 14, 6.5, '#d84a3a'); disc(g, x, y - 14, 4.3, '#f4ecd8'); disc(g, x, y - 14, 2.2, '#d84a3a');
  } else if (e.look === 'rune') {
    const oy = y - 14 + Math.sin(t * 3 + x) * 2;
    glowAt(g, x, oy, 14, 'rgba(180,150,255,A)', 0.55);
    poly(g, OL, [[x, oy - 11], [x + 7, oy], [x, oy + 10], [x - 7, oy]]); poly(g, fl ? '#ffffff' : '#a888ff', [[x, oy - 10], [x + 6, oy], [x, oy + 9], [x - 6, oy]]); poly(g, '#d8c8ff', [[x, oy - 10], [x - 6, oy], [x, oy - 2]]);
    if (e.num) { const nxt = w.training?.next === e.num; digit(g, e.num, x - 1, Math.round(oy) - 2, nxt ? '#fff2a0' : '#3a2a6a'); if (nxt) { R(g, '#fff2a0', x - 1, Math.round(oy) - 15, 3, 1); R(g, '#fff2a0', x, Math.round(oy) - 14, 1, 1); } } // 다음에 칠 번호는 금빛
  } else if (e.look === 'shadow') {
    const life = w.training?.spec?.life || 4, left = Math.max(0, life - age), a = left < 1 ? left : 1;
    g.globalAlpha = a;
    poly(g, '#140e20', [[x - 7, y + 3], [x - 5, y - 16], [x, y - 22], [x + 5, y - 16], [x + 7, y + 3]]);
    const eye = e.decoy ? '#ff4a4a' : '#b8a0ff'; // 붉은 눈은 가짜
    disc(g, x, y - 18, 5, '#140e20'); R(g, eye, x - 3, y - 19, 2, 1); R(g, eye, x + 1, y - 19, 2, 1);
    g.globalAlpha = 1;
  } else if (e.look === 'brazier') {
    R(g, OL, x - 1, y - 8, 3, 11); R(g, OL, x - 6, y + 2, 12, 2);
    R(g, OL, x - 8, y - 15, 16, 8); R(g, fl ? '#a89aa0' : '#4a4046', x - 7, y - 14, 14, 6); R(g, '#6a5e64', x - 7, y - 14, 14, 1);
    if (e.lit > 0) { // 타오르는 화로: 꺼질 때가 다가오면 불이 작아진다
      const burn = w.training?.spec?.burn || 6, k = Math.min(1, e.lit / burn), Rr = k > 0.6 ? 4 : k > 0.3 ? 3 : 2, img = flameSprite(Rr, ((t * 9) | 0) + x, k > 0.3 ? 0 : 1);
      R(g, '#ff8a2a', x - 6, y - 15, 12, 1);
      g.drawImage(img, x - ((img.width / 2) | 0), y - 15 - img.height + 2);
      if (k < 0.3 && Math.floor(t * 6) % 2) R(g, '#ffd27a', x - 1, y - 18, 2, 1);
    } else if (Math.random() < 0.12) r.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y - 16, vx: 0, vy: -10, t: 0.8, max: 0.8, color: '#6a6060', g: -4, steam: true });
  } else { // 근위대 허수아비 (단단한 버팀목)
    const sway = e.hitFlash > 0 ? Math.sin(t * 50) * 1.5 : 0;
    R(g, OL, x - 2, y - 22, 5, 26); R(g, '#8a5a32', x - 1, y - 21, 3, 24);
    R(g, OL, x - 11 + sway, y - 20, 22, 4); R(g, '#8a5a32', x - 10 + sway, y - 19, 20, 2);
    R(g, OL, x - 8 + sway, y - 22, 16, 18); R(g, fl ? '#ffffff' : '#8a94a8', x - 7 + sway, y - 21, 14, 16); R(g, '#c8d0e0', x - 7 + sway, y - 21, 3, 16); R(g, '#5a6070', x - 7 + sway, y - 12, 14, 2);
    disc(g, x + sway, y - 27, 6, OL); disc(g, x + sway, y - 27, 5, '#d8c890'); R(g, '#5a6070', x - 5 + sway, y - 30, 10, 3);
    if (e.guarded) { // 방패를 든 허수아비: 몸 앞에 큰 방패 (피해가 조금만 들어간다)
      const sx = x + sway;
      R(g, OL, sx - 7, y - 20, 14, 17); R(g, '#3a5aa8', sx - 6, y - 19, 12, 14); R(g, '#5a7ad0', sx - 6, y - 19, 12, 2); R(g, '#ffd76a', sx - 1, y - 18, 2, 12); R(g, '#ffd76a', sx - 5, y - 14, 10, 2);
      R(g, OL, sx - 5, y - 4, 10, 2); R(g, '#3a5aa8', sx - 4, y - 5, 8, 1);
    }
  }
  g.restore();
  e._top = y - 26;
}

// ───── 수련 안내판 · 찾는 물건 ─────
export function drawTrainBoard(g, o, t) {
  const x = Math.round(o.x), y = Math.round(o.y) + 4, col = SANCTUMS[o.race]?.color || '#ffe8a8';
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 1, 10, 3, 0, 0, Math.PI * 2); g.fill();
  R(g, OL, x - 9, y - 16, 3, 17); R(g, OL, x + 7, y - 16, 3, 17); R(g, '#7a5432', x - 8, y - 15, 1, 15); R(g, '#7a5432', x + 8, y - 15, 1, 15);
  R(g, OL, x - 12, y - 28, 25, 15); R(g, '#a87a48', x - 11, y - 27, 23, 13); R(g, '#c8945a', x - 11, y - 27, 23, 2);
  R(g, col, x - 7, y - 23, 3, 3); R(g, col, x - 1, y - 23, 3, 3); R(g, col, x + 5, y - 23, 3, 3); // 과녁 그림 셋
  R(g, '#5a3a22', x - 8, y - 18, 17, 1);
  o._top = o.y - 26;
}
export function drawQuestThing(r, w, o) {
  const g = r.g, t = w.t, x = Math.round(o.x), y = Math.round(o.y), col = SANCTUMS[o.race]?.color || '#ffffff', pulse = 0.55 + 0.35 * Math.sin(t * 3 + x);
  const rgb = `${parseInt(col.slice(1, 3), 16)},${parseInt(col.slice(3, 5), 16)},${parseInt(col.slice(5, 7), 16)}`;
  glowAt(g, x, y - 8, 16, `rgba(${rgb},A)`, pulse * 0.6);
  const bob = Math.sin(t * 2.2 + x) * 1.5;
  switch (o.look) {
    case 'lostSpirit': disc(g, x, y - 12 + bob, 4, OL); disc(g, x, y - 12 + bob, 3, '#bfffc8'); R(g, OL, x - 2, y - 13 + bob, 1, 1); R(g, OL, x + 1, y - 13 + bob, 1, 1); poly(g, '#bfffc8', [[x - 2, y - 9 + bob], [x, y - 4 + bob], [x + 2, y - 9 + bob]]); break;
    case 'runePage': R(g, OL, x - 5, y - 9, 10, 8); R(g, '#f4ecd8', x - 4, y - 8, 8, 6); R(g, '#7a9aff', x - 2, y - 7, 1, 4); R(g, '#7a9aff', x + 1, y - 6, 2, 1); break;
    case 'oldShield': R(g, OL, x - 6, y - 13, 12, 14); R(g, '#2a4a9a', x - 5, y - 12, 10, 12); R(g, '#ffd76a', x - 1, y - 11, 2, 10); R(g, '#ffd76a', x - 4, y - 7, 8, 2); break;
    case 'warBanner': R(g, OL, x - 1, y - 22, 3, 22); poly(g, OL, [[x + 1, y - 21], [x + 13, y - 17], [x + 1, y - 12]]); poly(g, '#a8261a', [[x + 2, y - 20], [x + 11, y - 17], [x + 2, y - 13]]); break;
    case 'soulLantern': R(g, OL, x - 4, y - 14, 8, 12); R(g, '#3a3444', x - 3, y - 13, 6, 10); R(g, OL, x - 1, y - 17, 2, 3); break;
    case 'stolenSeal': disc(g, x, y - 7 + bob, 5, OL); disc(g, x, y - 7 + bob, 4, '#8a6aff'); R(g, '#e8e0ff', x - 1, y - 9 + bob, 2, 2); break;
    case 'lostEgg': g.fillStyle = OL; g.beginPath(); g.ellipse(x, y - 6, 5, 7, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e8e0c8'; g.beginPath(); g.ellipse(x, y - 6, 4, 6, 0, 0, Math.PI * 2); g.fill(); R(g, '#9aa880', x - 2, y - 8, 1, 1); R(g, '#9aa880', x + 1, y - 4, 1, 1); break;
    case 'emberStone': disc(g, x, y - 5, 5, OL); disc(g, x, y - 5, 4, '#4a3a36'); R(g, `rgba(255,120,40,${pulse})`, x - 2, y - 6, 4, 1); R(g, `rgba(255,170,60,${pulse})`, x, y - 8, 1, 4); break;
  }
  if (Math.random() < 0.08) r.parts.push({ x: x + (Math.random() - 0.5) * 10, y: y - 10, vx: 0, vy: -12, t: 0.8, max: 0.8, color: col, g: 0, glow: true, size: 1 });
  o._top = y - 22;
}

// 수련 해골이 쓰러져 남긴 뼈 무더기: 해골 하나 + 엇갈린 뼈. 다시 일어서기 직전엔 들썩인다
export function drawBonePile(r, w, e) {
  const g = r.g, x = Math.round(e.x), y = Math.round(e.y) + 3, sh = e.bones < 0.6 && Math.floor(w.t * 16) % 2 ? 1 : 0;
  r.shadow(x, y + 1, 7);
  R(g, OL, x - 8, y - 3, 16, 4); R(g, '#d8d0b8', x - 7, y - 2, 14, 2); R(g, OL, x - 6, y - 5, 3, 3); R(g, OL, x + 3, y - 5, 3, 3);
  R(g, OL, x - 4 + sh, y - 9 - sh, 9, 7); R(g, '#e8e0c8', x - 3 + sh, y - 8 - sh, 7, 5); R(g, OL, x - 2 + sh, y - 7 - sh, 2, 2); R(g, OL, x + 1 + sh, y - 7 - sh, 2, 2); R(g, '#a8a090', x - 3 + sh, y - 4 - sh, 7, 1);
  e._top = y - 14;
}
// ───── 수련 화면: 남은 시간 · 맞힌 수 (또는 넣은 피해) ─────
export function drawTrainHud(r, w) {
  const tr = w.training;
  if (!tr) return;
  const g = r.g, u = r.u, W = r.c.width, L = SANCT_LIFE[tr.race], col = SANCTUMS[tr.race].color;
  const y = 76 * u, bw = 190 * u, x = W / 2 - bw / 2; // 위쪽 저장 표시 아래
  g.fillStyle = 'rgba(10,8,16,0.82)'; g.fillRect(x, y - 16 * u, bw, 30 * u);
  g.fillStyle = hexA(col, 0.9); g.fillRect(x, y - 16 * u, bw, 1.5 * u);
  if (tr.ready > 0) { r.text(`${L.train.name} · 준비`, W / 2, y - 1 * u, Math.max(1, u), '#ffffff', 'center', true); return; }
  const prog = tr.kind === 'damage' ? Math.min(1, tr.dealt / tr.need) : Math.min(1, tr.got / tr.n);
  g.fillStyle = '#1a1626'; g.fillRect(x + 6 * u, y + 6 * u, bw - 12 * u, 4 * u);
  g.fillStyle = col; g.fillRect(x + 6 * u, y + 6 * u, (bw - 12 * u) * prog, 4 * u);
  const left = Math.max(0, tr.t);
  const what = tr.kind === 'damage' ? `피해 ${Math.round(tr.dealt)} / ${tr.need}` : tr.mode === 'keepLit' ? `타오르는 화로 ${tr.got} / ${tr.n}` : tr.mode === 'order' ? `${tr.got} / ${tr.n} · 다음 ${tr.next}번` : `${tr.got} / ${tr.n}`;
  r.text(`${L.train.name} ${(tr.rank || 0) + 1}단계 · ${what} · ${left.toFixed(1)}초`, W / 2, y - 4 * u, Math.max(1, u), left < 6 ? '#ff9a7a' : '#ffffff', 'center', true);
}
// 주민 말풍선 (머리 위 흰 풍선, 어두운 글씨)
export function drawBubbles(r, w) {
  for (const o of w.objects) {
    if (o.kind !== 'resident' || !o.say || o._top == null) continue;
    const a = Math.min(1, o.say.t / 0.4), u = r.u, n = Math.max(1, u - (u > 2 ? 1 : 0)), g = r.g;
    const px = r.sx(o.x), py = r.sy(o._top - 4), tw = o.say.text.length * 10.5 * n + 12 * u, th = 15 * n;
    g.globalAlpha = a;
    g.fillStyle = '#3a3040'; g.fillRect(Math.round(px - tw / 2) - u, Math.round(py - th - 4 * u) - u, Math.round(tw) + 2 * u, Math.round(th) + 2 * u);
    g.fillStyle = '#faf6ec'; g.fillRect(Math.round(px - tw / 2), Math.round(py - th - 4 * u), Math.round(tw), Math.round(th));
    g.beginPath(); g.moveTo(px - 3 * u, py - 4 * u); g.lineTo(px + 3 * u, py - 4 * u); g.lineTo(px, py); g.fill();
    r.text(o.say.text, px, py - 4 * u - th / 2, n, '#2a2230', 'center', false);
    g.globalAlpha = 1;
  }
}
export const findName = (look) => FIND_NAME[look] || '';

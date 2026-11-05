// 렌더러 — 화면 위 HUD: 체력 · 스킬 칸 · 작은 지도 · 큰 지도 · 여정 · 글 로그 · 이름표
// Renderer.prototype 에 그대로 붙는다 (render/renderer.js 끝). 메서드 안의 this 는 Renderer

import { keyFor, keyLabel } from '../settings.js';
import { TILE } from '../sim/mapgen.js';
import { iconCanvas } from './icons.js';
import { SANCTUMS } from '../data/sanctums.js';
import { G, BIOME_LIST } from '../data/maps/overworld.js';
import { sprite, frames } from './assets.js';
import { ECHOES, AFFIXES } from '../data/monsters.js';
import { WEAPON_SKILLS } from '../data/items.js';
import { SKILLS, ELEM, ROLE_COLOR } from '../data/skills.js';
import { RACES } from '../data/races.js';
import { RACE_ART } from '../data/art.js';
import { storyObjective } from '../data/story.js';
import { drawClimbHud } from './climbfx.js';
import { drawTowerScreen } from './towerfx.js';
import { REWARDS as CLIMB_REWARDS } from '../data/climb.js';
import { skyColor, darkness, clockText } from '../sim/time.js';
import { PASSIVE_NAME, FONT, ROLE_GLYPH, fmt, modLines } from './renderer.js';

export const HudMethods = {
  drawTexts(w, dt) {
    const g = this.g, u = this.u;
    g.setTransform(1, 0, 0, 1, 0, 0);
    // 이름표
    for (const o of w.objects) if (o.npc && o._top != null && Math.abs(o.x - w.player.x) < 220) this.text(o.npc.name, this.sx(o.x), this.sy(o._top - 5), u, '#ffe8a8', 'center');
    for (const o of w.objects) if (o.kind === 'waypoint' && o._top != null && Math.hypot(o.x - w.player.x, o.y - w.player.y) < 110) this.text(o.active ? `${o.name} 포탈` : '잠든 포탈', this.sx(o.x), this.sy(o._top - 5), u, o.active ? '#bfefff' : '#b0a8bc', 'center');
    if (w.mode === 'plaza' || w.practice) { // 허수아비 이름 · 초당 피해 (광장 · 연습 실험장)
      for (const e of w.enemies) if (e.tag && !e.dead && e._top != null) this.text(e.tag, this.sx(e.x), this.sy(e._top - 9), Math.max(1, u - 1), '#ffd8a0', 'center', true);
      if (w.title && w.mode === 'field' && !w.pvp) this.text(w.title.text, this.sx(w.player.x), this.sy(w.player.y - 34), Math.max(1, u - 1), w.title.color, 'center', true);
      if (w.track) { // 고른 일 · 목적지로 가는 방향 화살표 (화면 가장자리)
        const W = this.c.width, H = this.c.height, tx = this.sx(w.track.x), ty = this.sy(w.track.y), m = 34 * u / 2;
        const on = tx > m && tx < W - m && ty > m && ty < H - m;
        const g2 = this.g;
        if (on) { const b = Math.sin(w.t * 5) * 4; g2.fillStyle = '#ffd040'; g2.beginPath(); g2.moveTo(tx, ty - 30 + b); g2.lineTo(tx - 7, ty - 42 + b); g2.lineTo(tx + 7, ty - 42 + b); g2.closePath(); g2.fill(); }
        else {
          const cx = W / 2, cy = H / 2, a = Math.atan2(ty - cy, tx - cx), k = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
          const ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k, r = 10 * Math.max(1, u / 2);
          g2.fillStyle = 'rgba(10,8,16,0.75)'; g2.beginPath(); g2.arc(ax, ay, r + 5, 0, Math.PI * 2); g2.fill();
          g2.fillStyle = '#ffd040'; g2.beginPath(); g2.moveTo(ax + Math.cos(a) * r, ay + Math.sin(a) * r); g2.lineTo(ax + Math.cos(a + 2.4) * r, ay + Math.sin(a + 2.4) * r); g2.lineTo(ax + Math.cos(a - 2.4) * r, ay + Math.sin(a - 2.4) * r); g2.closePath(); g2.fill();
          const dist = Math.round(Math.hypot(w.track.x - w.player.x, w.track.y - w.player.y) / 16);
          this.text(`${w.track.name || ''} ${dist}칸`, ax - Math.cos(a) * (r + 18), ay - Math.sin(a) * (r + 12), Math.max(1, u - 1), '#ffe8a8', 'center', true);
        }
      }
      for (const e of w.enemies) if (e.def.ai === 'dummy') {
        this.text(e.def.name, this.sx(e.x), this.sy(e.y + 14), u, '#d8d0e8', 'center');
        if (e.dps > 0) this.text(`DPS ${Math.round(e.dps)}`, this.sx(e.x), this.sy(e.y - 20), u, '#ffcf5a', 'center', true, true);
      }
      for (const o of w.objects) if (o.kind === 'gate') this.text(o.label.split(' (')[0], this.sx(o.x), this.sy(o.y + 12), u, o.color, 'center');
    }
    for (const e of w.enemies) if (e.affix && !e.champion && e._top != null && ((this.hpShow.get(e.id) ?? 0) > w.t || Math.hypot(e.x - w.player.x, e.y - w.player.y) < 60)) { // 강화 개체 이름: 맞은 직후 · 가까이 왔을 때만
      this.text(`${AFFIXES[e.affix].name} ${e.def.name}`, this.sx(e.x), this.sy(e._top - 8), Math.max(1, u - 1), AFFIXES[e.affix].color, 'center', true);
    }
    for (const e of w.enemies) if ((e.def.elite || e.champion) && e !== this.hudBoss && e._top != null && Math.abs(e.x - w.player.x) < 260 && Math.abs(e.y - w.player.y) < 160) {
      this.text(`${e.lv ? `Lv ${e.lv} ` : ''}${e.champion || e.def.name}`, this.sx(e.x), this.sy(e._top - 8), u, '#ff9a8a', 'center', true, true);
    }
    { // 몬스터 레벨: 내 레벨보다 5 넘게 높으면 빨강, 5 넘게 낮으면 회색
      const my = w.b.level || 1;
      for (const e of w.enemies) if (e.lv && Math.abs(e.lv - my) > 5 && !e.dead && !e.champion && !e.def.elite && !e.affix && e._top != null && Math.abs(e.x - w.player.x) < 150 && Math.abs(e.y - w.player.y) < 100) // 레벨이 비슷하면 숨긴다
        this.text(`Lv ${e.lv}`, this.sx(e.x), this.sy(e._top - 6), Math.max(1, u - 1), e.lv > my + 5 ? '#ff6a5a' : e.lv < my - 5 ? '#9a96a4' : '#f0e6c8', 'center', true);
    }
    for (const e of w.enemies) if (e._pips) {
      let px = Math.round(e.x - (e._pips.length * 6) / 2);
      for (const [, n] of e._pips) { if (n > 1) this.text(String(n), this.sx(px + 2), this.sy(e._top - 17), Math.max(1, u - 1), '#ffffff', 'center'); px += 6; }
    }
    for (const t of this.texts) {
      t.t -= dt; t.y += t.vy * dt; t.x += (t.vx || 0) * dt; t.vy *= 0.93;
      if (t.pop) t.pop = Math.max(0, t.pop - dt);
      let n = u + ((t.size || (t.crit || t.heavy ? 2 : 1)) > 1 ? 1 : 0);
      if (t.small) n = Math.max(1, u - 1);
      const txt = t.crit ? t.text + '!' : t.text;
      g.globalAlpha = Math.min(1, t.t * 3);
      this.text(txt, this.sx(t.x), this.sy(t.y), n, t.crit ? '#ffe040' : t.color, 'center', true, !t.label);
      g.globalAlpha = 1;
    }
    this.texts = this.texts.filter((t) => t.t > 0);
  },

  // ───────── HUD ─────────
  // 왼쪽 위 효과 목록에 마우스를 올렸을 때: 이름 · 효과 · 남은 시간
  drawTip() {
    const m = this.mouse, u = this.u, g = this.g;
    if (!m) return;
    const tp = this.tipRects.find((r) => m.x >= r.x - u && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h);
    if (!tp) return;
    const tu = Math.max(1, u - 1), lh = 12 * tu, maxW = 190 * u;
    g.font = `${11 * tu}px ${FONT}`;
    const wrap = (str) => { const out = []; let line = ''; for (const word of str.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; };
    const body = tp.lines.flatMap(wrap);
    const left = tp.left == null ? null : tp.left >= 60 ? `남은 시간 ${Math.ceil(tp.left / 60)}분` : `남은 시간 ${tp.left.toFixed(1)}초`;
    if (left) body.push(left);
    g.font = `bold ${11 * u}px ${FONT}`;
    const wd = Math.min(maxW, Math.max(g.measureText(tp.title).width, ...body.map((l) => { g.font = `${11 * tu}px ${FONT}`; return g.measureText(l).width; }))) + 12 * u;
    const ht = 16 * u + body.length * lh + 4 * u, x = Math.round(Math.min(this.c.width - wd - 4 * u, tp.x)), y = Math.round(tp.up ? tp.y - ht - 4 * u : tp.y + tp.h + 4 * u);
    this.panel(x, y, wd, ht);
    this.text(tp.title, x + 6 * u, y + 9 * u, u, tp.color, 'left', true, true);
    body.forEach((l, i) => this.text(l, x + 6 * u, y + 18 * u + i * lh + lh / 2, tu, i === body.length - 1 && left ? '#b8b0c8' : '#e8e0f0', 'left', false));
  },

  panel(x, y, w, h) {
    const g = this.g, b = this.u;
    g.fillStyle = '#0c0a0b'; g.fillRect(x - b, y - b, w + 2 * b, h + 2 * b);
    g.fillStyle = 'rgba(27,23,24,0.93)'; g.fillRect(x, y, w, h);
    g.fillStyle = '#5e5253'; g.fillRect(x, y, w, b); g.fillRect(x, y, b, h);
    g.fillStyle = '#141011'; g.fillRect(x, y + h - b, w, b); g.fillRect(x + w - b, y, b, h);
  },

  drawHud(w, dt) {
    const g = this.g, p = w.player, d = w.d, u = this.u, S = this.S;
    const W = this.c.width, H = this.c.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const m = 10 * u;
    // 데스크톱: 내 상태는 왼쪽 아래 한 덩어리 (Hades · Dead Cells처럼 화면 가운데를 비운다). 모바일: 예전처럼 왼쪽 위 (아래는 조이스틱)
    const desk = !document.body.classList.contains('touch');
    const R = RACES[w.b.race]?.res;
    const pw = (desk ? 24 : 26) * u, bw = (desk ? 120 : 110) * u, bh = (desk ? 9 : 10) * u, gh = desk ? 5 * u : 7 * u;
    const extra = R && (w.b.cls === 'necromancer' || w.b.race === 'wizard') ? 10 * u : 0;
    const frameH = Math.max(pw, bh + (R ? 3 * u + gh : 0) + extra);
    const fx = m, fy = desk ? H - m - frameH - 6 * u : m;
    this.hudFrameTop = fy;
    // 초상화 + 체력
    this.panel(fx, fy, pw, pw);
    const art = RACE_ART[w.b.race];
    const face = sprite(frames(art.base, 'idle')[0], art.tint || '');
    if (face) { g.imageSmoothingEnabled = false; const fs = Math.floor((pw - 4 * u) / 16); g.drawImage(face, Math.round((face.width - 16) / 2), face.height - 24, 16, 16, fx + (pw - 16 * fs) / 2, fy + (pw - 16 * fs) / 2, 16 * fs, 16 * fs); }
    const bx = fx + pw + 6 * u, m0 = fy;
    this.panel(bx, m0, bw, bh);
    const hpK = Math.max(0, Math.min(1, p.hp / d.maxHp));
    g.fillStyle = '#3a1016'; g.fillRect(bx + u, m0 + u, bw - 2 * u, bh - 2 * u);
    g.fillStyle = hpK < 0.3 && Math.floor(w.t * 3) % 2 ? '#e8404c' : '#c8303c'; g.fillRect(bx + u, m0 + u, (bw - 2 * u) * hpK, bh - 2 * u);
    g.fillStyle = '#ff6a6a'; g.fillRect(bx + u, m0 + u, (bw - 2 * u) * hpK, 2 * u);
    if (p.shield > 0) { g.fillStyle = '#a8d8ff'; g.fillRect(bx + u, m0 + bh - 3 * u, (bw - 2 * u) * Math.min(1, p.shield / d.maxHp), 2 * u); }
    this.text(`${Math.ceil(p.hp)} / ${d.maxHp}`, desk ? bx + bw - 4 * u : bx + bw / 2, m0 + bh / 2, desk ? Math.max(1, u - 1) : u, '#ffffff', desk ? 'right' : 'center');
    // 종족 자원 게이지
    let ry = m0 + bh + 3 * u;
    if (R) {
      this.panel(bx, ry, bw, gh);
      g.fillStyle = '#100d0e'; g.fillRect(bx + u, ry + u, bw - 2 * u, gh - 2 * u);
      g.globalAlpha = 0.22; g.fillStyle = R.color; g.fillRect(bx + u, ry + u, bw - 2 * u, gh - 2 * u); g.globalAlpha = 1; // 비어 있어도 막대가 보이게 (자원이 있다는 것을 알 수 있게)
      const k = Math.max(0, Math.min(1, p.res / 100));
      g.fillStyle = R.color; g.fillRect(bx + u, ry + u, (bw - 2 * u) * k, gh - 2 * u);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(bx + u, ry + u, (bw - 2 * u) * k, u);
      for (const t of [0.25, 0.5, 0.75]) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(bx + u + (bw - 2 * u) * t, ry + u, u, gh - 2 * u); }
      if (k >= 1 && Math.floor(w.t * 4) % 2) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx + u, ry + u, bw - 2 * u, gh - 2 * u); }
      if (desk) this.text(`${R.name} ${Math.floor(p.res)}`, bx + bw + 4 * u, ry + gh / 2, Math.max(1, u - 1), R.color, 'left'); // 얇은 막대: 이름 · 수치는 막대 오른쪽에
      else this.text(`${R.name} ${Math.floor(p.res)}`, bx + bw / 2, ry + gh / 2, Math.max(1, u - 1), '#ffffff', 'center');
      ry += gh + 2 * u;
      if (w.b.cls === 'necromancer') { this.text(`거둔 영혼 ${p.souls.length} / 10`, bx, ry + 5 * u, Math.max(1, u - 1), '#7ae8ff'); ry += 10 * u; }
      if (w.b.race === 'wizard') { const el = ELEM[p.elem]; this.text(`속성: ${el.name}${w.zElem?.weak === p.elem ? ' (약점!)' : w.zElem?.resist === p.elem ? ' (내성)' : ''}`, bx, ry + 5 * u, Math.max(1, u - 1), el.color); ry += 10 * u; }
    }
    // 데스크톱: 버프 · 상태이상은 막대 위쪽 줄에 (위로 쌓인다) / 모바일: 막대 아래
    if (desk) ry = fy - 10 * u;
    // 버프 (마우스를 올리면 설명)
    const tips = this.tipRects = [], tu = Math.max(1, u - 1);
    let bxx = bx;
    for (const [id, bf] of Object.entries(p.buffs)) {
      if (id === 'nextCrit') { this.text('다음 치명타', bxx, ry + 5 * u, tu, '#ffe040'); tips.push({ x: bxx, y: ry, w: 46 * u, h: 10 * u, title: '다음 치명타', color: '#ffe040', lines: ['다음 공격이 반드시 치명타가 된다.'], left: bf.t }); bxx += 50 * u; continue; }
      const sk = Object.values(SKILLS).find((k) => k.do.some((o) => o.op === 'buff' && o.id === id));
      const nm = bf.name || sk?.name || id;
      const left = bf.t >= 60 ? `${Math.ceil(bf.t / 60)}분` : bf.t.toFixed(bf.persist ? 0 : 1), label = `${nm} ${left}`;
      this.g.font = `${11 * tu}px ${FONT}`;
      const lw = this.g.measureText(label).width;
      if (bxx > bx && bxx + lw > bx + 250 * u) { bxx = bx; ry += desk ? -10 * u : 10 * u; } // 길면 다음 줄로 (데스크톱은 위로)
      this.text(label, bxx, ry + 5 * u, tu, bf.color || '#ffffff');
      const lines = modLines(bf.mods);
      if (!lines.length && sk?.desc) lines.push(sk.desc.replace(/\s*(마력|기력|분노|마나|기운|영혼)\s*\d+\.?$/, ''));
      if (bf.persist) lines.push(id === 'meal' ? '음식 효과 · 새 음식을 먹으면 바뀐다' : id === 'rested' ? '잘 자고 일어난 효과 · 저녁 6시까지' : '오래가는 효과', '게임 시간으로 끝난다 (집을 드나들어도 이어진다)');
      tips.push({ x: bxx, y: ry, w: lw + 3 * u, h: 10 * u, title: nm, color: bf.color || '#ffffff', lines, left: bf.t });
      bxx += lw + 8 * u;
    }
    if (Object.keys(p.buffs).length) ry += desk ? -10 * u : 10 * u;
    // 상태이상
    const names = { burn: ['화상', '#ff7a2a', '불에 데어 잠깐 동안 계속 피해를 받는다. 물에 들어가면 꺼진다.'], poison: ['중독', '#9be15d', '독이 퍼져 잠깐 동안 계속 피해를 받는다.'], bleed: ['출혈', '#e0445a', '피를 흘려 잠깐 동안 계속 피해를 받는다. 겹칠수록 세다.'], chill: ['냉기', '#9fe3ff', '몸이 얼어 이동 · 공격이 느려진다.'], curse: ['저주', '#b7a4ff', '저주가 몸을 갉아 잠깐 동안 계속 피해를 받는다.'], shock: ['감전', '#ffe14a', '몸이 저려 받는 피해가 15% 늘어난다.'] };
    let sxx = bx;
    for (const k of Object.keys(p.st)) { const nm = names[k] || ['상태이상', '#ffffff', '']; this.text(nm[0], sxx, ry + 5 * u, u, nm[1]); tips.push({ x: sxx, y: ry, w: 26 * u, h: 10 * u, title: nm[0], color: nm[1], lines: [nm[2]].filter(Boolean), left: p.st[k]?.t }); sxx += 30 * u; }
    this.drawSkillBar(w);
    // 데스크톱: 미니맵 아래 정보띠(시계 · 골드 · 지역)에 시계를 넣고, 여정은 그 밑 오른쪽 (퀘스트 추적 칸)
    if (desk && w.mode === 'field') { this.drawMinimap(w); this.hudRightY = this.hudRightBottom || 120 * u; }
    else if (w.mode !== 'field') this.drawClock(w); // 바깥(미니맵이 있는 곳)은 미니맵 아래 정보띠에 시계가 있다
    this.journeyBottom = 0;
    if (this.journey && !w.climb && !w.pvp && !w.practice) {
      if (desk) this.drawJourney(w, null, (w.mode === 'field' ? this.hudRightY : 34 * u) + 4 * u, W - 10 * u);
      else this.drawJourney(w, bx, ry + 6 * u);
    }
    this.drawTip();

    if (w.mode === 'field' && !desk) this.drawMinimap(w);
    else if (!document.body.classList.contains('touch') && w.t < 8 && !w.climb && !w.pvp && w.map?.indoor) { // 안내 띠: 집 · 실내에 들어온 뒤 8초만 (탑 · 보스전에는 띄우지 않는다)
      const hint = 'G 상호작용 · I 장비 · B 가방 · C 캐릭터 · 아래쪽 문으로 나가기';
      g.font = `${11 * u}px ${FONT}`;
      const tw2 = g.measureText(hint).width + 20 * u;
      const vv = Math.max(2, u), hy0 = H - 32 * vv - 26 * u; // 스킬바 위로
      g.fillStyle = 'rgba(13,11,16,0.7)'; g.fillRect((W - tw2) / 2, hy0 - 8 * u, tw2, 16 * u);
      this.text(hint, W / 2, hy0, u, '#dcd2c6', 'center', false);
    }

    // 온라인: 다른 사람의 이름 · 말풍선
    for (const rp of w.remotes || []) {
      const tx = this.sx(rp.x), ty = this.sy(rp._top ?? rp.y - 18) - 6 * u;
      if (tx < -40 || tx > W + 40 || ty < -40 || ty > H + 40) continue;
      const mate = w.myParty && rp.party === w.myParty;
      this.text(`${rp.gname ? `[${rp.gname}] ` : ''}${rp.name}${rp.duel ? ' ⚔' : ''}`, tx, ty, Math.max(1, u - 1), mate ? '#a9d89a' : '#bfe8ff', 'center', true, true);
      if (rp.say && rp.say.until > performance.now()) {
        g.font = `${10 * Math.max(1, u - 1)}px ${FONT}`;
        const tw2 = Math.min(220 * u, g.measureText(rp.say.text).width + 12 * u), by = ty - 16 * u;
        g.fillStyle = 'rgba(250,246,236,0.95)'; g.fillRect(Math.round(tx - tw2 / 2), Math.round(by - 7 * u), Math.round(tw2), Math.round(13 * u));
        this.text(rp.say.text.length > 34 ? rp.say.text.slice(0, 33) + '…' : rp.say.text, tx, by, Math.max(1, u - 1), '#2a2230', 'center', false);
      }
    }
    // 상호작용 안내
    const anim = w.player.fallInto || w.player.drop || w.player.hop; // 뛰어내리는 동안은 안내를 숨긴다
    if (w.near && !w.player.fish && !w.player.gather && !anim) {
      const o = w.near;
      const label = o.kind === 'chest' ? `${o.label} 열기` : o.label;
      const top = o._top != null ? o._top : o.kind === 'gate' ? o.y - 40 : o.y - 22;
      const tx = this.sx(o.x), ty = o.say ? this.sy(o.y + 12) + 10 * u : this.sy(top) - 14 * u; // 말풍선이 떠 있으면 발밑에
      g.font = `${11 * u}px ${FONT}`;
      const tw2 = g.measureText(label).width + 30 * u;
      this.panel(tx - tw2 / 2, ty - 8 * u, tw2, 16 * u);
      g.fillStyle = '#e9b85c'; g.fillRect(tx - tw2 / 2 + 3 * u, ty - 5 * u, 10 * u, 10 * u);
      this.text('G', tx - tw2 / 2 + 8 * u, ty, u, '#241a00', 'center', false, true);
      this.text(label, tx + 7 * u, ty, u, '#ffffff', 'center', false);
    }

    else if (w.act && !w.player.fish && !w.player.gather && !anim) {
      const a = w.act, label = a.label, tx = this.sx(a.x), ty = this.sy(a.y - 22) - 10 * u;
      g.font = `${11 * u}px ${FONT}`;
      const tw2 = g.measureText(label).width + 30 * u;
      this.panel(tx - tw2 / 2, ty - 8 * u, tw2, 16 * u);
      const can = !/필요하다|없다|용암 낚시는|자라는 중/.test(label);
      g.fillStyle = can ? '#e9b85c' : '#8a8090'; g.fillRect(tx - tw2 / 2 + 3 * u, ty - 5 * u, 10 * u, 10 * u);
      this.text('G', tx - tw2 / 2 + 8 * u, ty, u, '#241a00', 'center', false, true);
      this.text(label, tx + 7 * u, ty, u, can ? '#ffffff' : '#c8c0d0', 'center', false);
    }
    else if (w.nearRemote && !anim) { // 온라인: 가까운 사람에게 결투 신청
      const rp = w.nearRemote, label = rp.duel ? `${rp.name} (결투 중)` : `${rp.name} · 결투 · 파티 · 길드`, tx = this.sx(rp.x), ty = this.sy(rp.y + 14) + 10 * u;
      g.font = `${11 * u}px ${FONT}`;
      const tw2 = g.measureText(label).width + 30 * u;
      this.panel(tx - tw2 / 2, ty - 8 * u, tw2, 16 * u);
      g.fillStyle = rp.duel ? '#8a8090' : '#ff9a7a'; g.fillRect(tx - tw2 / 2 + 3 * u, ty - 5 * u, 10 * u, 10 * u);
      this.text('G', tx - tw2 / 2 + 8 * u, ty, u, '#241a00', 'center', false, true);
      this.text(label, tx + 7 * u, ty, u, '#ffffff', 'center', false);
    }
    else if (w.waterAct && !w.player.fish && !anim) {
      const label = w.waterAct, tx = this.sx(w.player.x), ty = this.sy(w.player.y - 30) - 10 * u;
      g.font = `${11 * u}px ${FONT}`;
      const tw2 = g.measureText(label).width + 30 * u;
      this.panel(tx - tw2 / 2, ty - 8 * u, tw2, 16 * u);
      g.fillStyle = '#7ad8ff'; g.fillRect(tx - tw2 / 2 + 3 * u, ty - 5 * u, 10 * u, 10 * u);
      this.text('G', tx - tw2 / 2 + 8 * u, ty, u, '#002030', 'center', false, true);
      this.text(label, tx + 7 * u, ty, u, '#e0f6ff', 'center', false);
    }
    // 숨 (바닷속): 거품 열 개
    if (w.map.underwater && p.breathMax) {
      const n = 10, k = p.breath / p.breathMax, full = Math.ceil(k * n - 0.001), bx0 = bx, by0 = ry + 8 * u;
      this.text(p.buffs.waterBreath ? '숨 · 수중 호흡 중' : `숨 ${Math.ceil(p.breath)}초`, bx0, by0, Math.max(1, u - 1), k < 0.3 ? '#e8907c' : '#bfe8ff');
      for (let i = 0; i < n; i++) {
        const x = bx0 + 70 * u + i * 9 * u, y = by0, on = i < full, last = i === full - 1 && k * n % 1 < 0.35 && !p.buffs.waterBreath;
        g.strokeStyle = on ? '#e0f6ff' : 'rgba(224,246,255,0.25)'; g.lineWidth = u; g.beginPath(); g.arc(x, y, (last ? 2.4 : 3) * u, 0, Math.PI * 2); g.stroke();
        if (on) { g.fillStyle = 'rgba(160,220,255,0.35)'; g.beginPath(); g.arc(x, y, 2.5 * u, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(x - u, y - 2 * u, u, u); }
      }
    }
    // 위쪽 가운데 글(결투 · 탑 시간, 정예 체력바)은 저장 안내 칩 아래에 둔다
    const topY = Math.max(46 * u, this.topSafe() + 9 * u);
    // 결투: 남은 시간 (30초 안쪽은 붉게)
    if (w.pvp && w.pvp.left != null) {
      const v = Math.ceil(w.pvp.left);
      this.text(`결투 ${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`, W / 2, topY, u, v <= 30 ? '#ff8a7a' : '#e8d8a8', 'center', true, true);
    }
    if (w.climb) drawClimbHud(this, w, topY); // 탑 등반
    // 각인의 탑: 이 층의 우두머리 목록 (쓰러뜨리면 빨간 줄)
    if (!w.climb && w.tower?.bosses?.length) {
      let y = topY + 46 * u;
      const x = W - 10 * u;
      this.text('우두머리', x, y, Math.max(1, u - 1), '#c8b8a0', 'right', true, true);
      for (const b of w.tower.bosses) {
        y += 13 * u;
        const name = b.champion || b.def.name, col = b.dead ? '#8a8090' : b === w.tower.boss ? '#ff9a7a' : '#f0c878';
        this.text(name, x, y, Math.max(1, u - 1), col, 'right', true, true);
        if (b.dead) { g.font = `${10 * Math.max(1, u - 1)}px ${FONT}`; const tw2 = g.measureText(name).width; g.fillStyle = '#ff3a3a'; g.fillRect(Math.round(x - tw2), Math.round(y), Math.round(tw2), Math.max(2, u)); }
      }
    }
    // 각인의 탑: 층 · 걸린 시간 / 기준 시간 (넘기면 붉게)
    if (w.tower && !w.climb) {
      const par = 60 + w.tower.f * 2 + (w.tower.f % 5 === 0 ? 45 : 0), tt = w.tower.t, over = tt > par;
      const fmt = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
      this.text(`각인의 탑 ${w.tower.f}층 · ${fmt(tt)} / ${fmt(par)}`, W / 2, topY, u, over ? '#ff8a7a' : '#e8d8a8', 'center', true, true);
    }
    // 정예 체력바
    const tb = w.tower?.boss && !w.tower.boss.dead ? w.tower.boss : null;
    const boss = w.climb?.intro ? null : tb || w.enemies.find((e) => (e.def.elite || e.champion) && e.state === 'chase' && !e.dead);
    this.hudBoss = boss; // 체력바에 이름이 나온 보스 (몸 위 이름은 숨긴다)
    if (boss && w.climb && !boss.dead) this.edgeArrow(boss.x, (boss._top ?? boss.y - 60) + 20, '#ff7a5a', boss.champion || boss.def.name, false); // 보스가 화면 밖이면 가장자리에 화살표 (보일 때는 그리지 않는다) // 탑: 진짜 보스 체력 (분신 · 가짜 거울이 아니라) · 등장 연출 동안은 감춘다
    if (boss) {
      const bw2 = Math.min(W * 0.5, 260 * u), bx2 = (W - bw2) / 2, by2 = topY + 28 * u; // 화면 위쪽 (아래 스킬 칸 · 위쪽 저장 안내를 가리지 않게)
      this.text(boss.champion || boss.def.name, W / 2, by2 - 9 * u, u, '#e8907c', 'center', true, true);
      this.panel(bx2, by2, bw2, 8 * u);
      g.fillStyle = '#3a1016'; g.fillRect(bx2 + u, by2 + u, bw2 - 2 * u, 6 * u);
      g.fillStyle = '#e8483a'; g.fillRect(bx2 + u, by2 + u, (bw2 - 2 * u) * boss.hp / boss.maxHp, 6 * u);
      if (boss.bshield > 0) { g.fillStyle = 'rgba(200,236,255,0.85)'; g.fillRect(bx2 + u, by2 + u, (bw2 - 2 * u) * Math.min(1, boss.bshield / boss.maxHp), 3 * u); } // 보호막: 체력바 위쪽 반에 흰빛
      // 패시브 · 변신까지 남은 시간
      const tags = (boss.passives || []).map((k) => PASSIVE_NAME[k]).filter(Boolean);
      if (boss.forms) { // 단계 눈금 (66% · 33%): 여기까지 깎으면 변신한다
        for (const f of [0.66, 0.33]) { const tx = Math.round(bx2 + u + (bw2 - 2 * u) * f); g.fillStyle = '#ffe8b0'; g.fillRect(tx, by2 - u, u, 10 * u); }
        tags.unshift(`${(boss.bphase || 0) + 1}단계`);
      }
      if (tags.length) this.text(tags.join(' · '), W / 2, by2 + 12 * u, u, boss.bphase >= 2 ? '#ff5a3a' : boss.bphase >= 1 ? '#ff9a6a' : '#e8c8b0', 'center');
    }

    if (this.notes?.length) this.drawNotes(dt);
    if (w.player.fish) this.drawRhythm(w, dt);
    if (this.bigMap && w.map.outdoor) this.drawBigMap(w);
    if (this.vista) this.drawVista(w, dt);
    if (this.banner) {
      this.banner.t -= dt;
      g.globalAlpha = Math.min(1, this.banner.t * 1.5);
      const bY = Math.max(H * 0.22, boss ? topY + 64 * u : w.climb ? topY + 44 * u : 0); // 보스 체력바 · 등반 글 아래로
      { // 뒤에 옅은 어둠 띠: 세계 위의 이름표 · 글과 겹쳐 읽히지 않게
        g.font = `bold ${33 * u}px ${FONT}`; const tw = g.measureText(this.banner.text).width;
        g.font = `${11 * u}px ${FONT}`; const sw = this.banner.sub ? g.measureText(this.banner.sub).width : 0;
        const bw = Math.min(W - 8 * u, Math.max(tw, sw) + 40 * u), bh = (this.banner.sub ? 52 : 40) * u;
        const a0 = g.globalAlpha; g.globalAlpha = a0 * 0.55; g.fillStyle = '#0c0a0b'; g.fillRect(Math.round(W / 2 - bw / 2), Math.round(bY - 22 * u), Math.round(bw), Math.round(bh)); g.globalAlpha = a0;
      }
      this.text(this.banner.text, W / 2, bY, 3 * u, this.banner.color, 'center', true, true);
      if (this.banner.sub) this.text(this.banner.sub, W / 2, bY + 26 * u, u, '#dcd2c6', 'center');
      g.globalAlpha = 1;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (w.climb) drawTowerScreen(this, w, g, W, H, u, dt); // 시간의 종 · 멈춘 시간 · 보스 등장 띠와 이름
  },

  // 여정: 지금의 목표 하나 (왼쪽 위 · 체력 아래) + 장소가 있으면 화면 가장자리 화살표
  drawJourney(w, x, y, right = null) {
    const J = this.journey, u = this.u, tu = Math.max(1, u - 1), g = this.g;
    g.font = `bold ${11 * u}px ${FONT}`;
    const tw = Math.max(150 * u, g.measureText(J.title).width + 16 * u);
    if (right != null) x = right - tw; // 오른쪽 맞춤 (미니맵 아래)
    g.font = `${11 * tu}px ${FONT}`;
    const hint = J.hint || '', lines = [];
    let line = '';
    for (const word of hint.split(' ')) { const t2 = line ? line + ' ' + word : word; if (g.measureText(t2).width > tw - 14 * u && line) { lines.push(line); line = word; } else line = t2; }
    if (line) lines.push(line);
    const show = lines.slice(0, 3), h = 30 * u + show.length * 12 * tu;
    this.panel(x, y, tw, h);
    this.journeyBottom = y + h;
    g.fillStyle = J.done ? '#8fcf7a' : '#e9b85c'; g.fillRect(x, y, 2 * u, h);
    this.text(`여정 ${J.n} / ${J.total}${J.done ? ' · 완료!' : ''}`, x + 7 * u, y + 7 * u, tu, J.done ? '#8fcf7a' : '#c8b88a', 'left', false);
    this.text(J.title, x + 7 * u, y + 19 * u, u, '#f6dfae', 'left', true, true);
    show.forEach((l, i) => this.text(l, x + 7 * u, y + 31 * u + i * 12 * tu, tu, '#c9beb2', 'left', false));
    this.tipRects.push({ x, y, w: tw, h, title: '여정 (J로 전체 보기)', color: '#e9b85c', lines: ['하나를 마치면 보상을 받고 다음 목표가 보인다', J.reward ? `보상: ${J.reward}` : ''].filter(Boolean) });
    if (J.target) this.edgeArrow(J.target.x, J.target.y, '#e9b85c', J.target.label);
  },
  // 화면 밖의 목표를 가리키는 화살표 (화면 안이면 머리 위에 작은 표시)
  edgeArrow(tx, ty, color, label, bounce = true) {
    const g = this.g, u = this.u, W = this.c.width, H = this.c.height, sx = this.sx(tx), sy = this.sy(ty), m = 34 * u;
    const mt = 78 * u, mb = 70 * u, ml = 30 * u, mr = 30 * u; // 위 · 아래는 HUD 가 있어 더 안쪽에
    const p = this.world?.player;
    const dist = p ? Math.round(Math.hypot(tx - p.x, ty - p.y) / TILE) : 0;
    if (sx > m && sx < W - m && sy > m && sy < H - m) { // 보이는 곳: 위에서 통통 튀는 표시
      if (!bounce) return;
      const by = sy - 46 * u + Math.sin(performance.now() / 180) * 3 * u;
      g.fillStyle = '#0c0a0b'; g.beginPath(); g.moveTo(sx - 7 * u, by - 2 * u); g.lineTo(sx + 7 * u, by - 2 * u); g.lineTo(sx, by + 8 * u); g.closePath(); g.fill();
      g.fillStyle = color; g.beginPath(); g.moveTo(sx - 5 * u, by - u); g.lineTo(sx + 5 * u, by - u); g.lineTo(sx, by + 6 * u); g.closePath(); g.fill();
      return;
    }
    const cx = (ml + W - mr) / 2, cy = (mt + H - mb) / 2, ang = Math.atan2(sy - cy, sx - cx);
    const k = Math.min((W - ml - mr) / 2 / Math.max(1e-3, Math.abs(Math.cos(ang))), (H - mt - mb) / 2 / Math.max(1e-3, Math.abs(Math.sin(ang))));
    const ax = cx + Math.cos(ang) * k, ay = cy + Math.sin(ang) * k;
    g.save(); g.translate(ax, ay); g.rotate(ang);
    g.fillStyle = '#0c0a0b'; g.beginPath(); g.moveTo(14 * u, 0); g.lineTo(-6 * u, -10 * u); g.lineTo(-2 * u, 0); g.lineTo(-6 * u, 10 * u); g.closePath(); g.fill();
    g.fillStyle = color; g.beginPath(); g.moveTo(11 * u, 0); g.lineTo(-4 * u, -7 * u); g.lineTo(-1 * u, 0); g.lineTo(-4 * u, 7 * u); g.closePath(); g.fill();
    g.restore();
    const lx = ax - Math.cos(ang) * 22 * u, ly = ay - Math.sin(ang) * 18 * u;
    this.text(`${label ? label + ' · ' : ''}${dist}칸`, Math.max(40 * u, Math.min(W - 40 * u, lx)), ly, Math.max(1, u - 1), color, 'center', true, true);
  },

  // 시계: 하늘빛 동그라미(해 · 달) + 날짜 · 시각
  drawClock(w) {
    const c = w.clock; if (!c) return;
    const g = this.g, u = this.u, W = this.c.width;
    const mapW = w.mode === 'field' ? (w.map.outdoor ? Math.round(110 * u * 1.3) : Math.round(w.tw * u * 0.75)) + 4 * u : -6 * u;
    const ch = 18 * u, cw = 92 * u, x = W - 10 * u - mapW - 6 * u - cw, y = 8 * u;
    this.panel(x, y, cw, ch);
    const [r, gg, b] = skyColor(c.min), dk = darkness(c.min), R = 6 * u, ox = x + 4 * u + R, oy = y + ch / 2;
    g.fillStyle = `rgb(${Math.min(255, r * 0.55 + 40) | 0},${Math.min(255, gg * 0.62 + 50) | 0},${Math.min(255, b * 0.8 + 50) | 0})`;
    g.beginPath(); g.arc(ox, oy, R, 0, Math.PI * 2); g.fill();
    const h = c.min / 60, sunUp = h >= 5.5 && h < 19.5;
    // 해 · 달이 하늘을 가로지른다 (왼쪽에서 떠서 오른쪽으로 진다)
    const k = sunUp ? (h - 5.5) / 14 : ((h + 24 - 19.5) % 24) / 10, ang = Math.PI + k * Math.PI;
    const bx = ox + Math.cos(ang) * R * 0.62, byy = oy + 1 * u + Math.sin(ang) * R * 0.62;
    g.save(); g.beginPath(); g.arc(ox, oy, R, 0, Math.PI * 2); g.clip();
    if (sunUp) { g.fillStyle = '#ffe070'; g.beginPath(); g.arc(bx, byy, 2.2 * u, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff6c0'; g.fillRect(bx - u, byy - u, u, u); }
    else { g.fillStyle = '#f0f0ff'; g.beginPath(); g.arc(bx, byy, 2 * u, 0, Math.PI * 2); g.fill(); g.fillStyle = `rgb(${Math.min(255, r * 0.55 + 40) | 0},${Math.min(255, gg * 0.62 + 50) | 0},${Math.min(255, b * 0.8 + 50) | 0})`; g.beginPath(); g.arc(bx + u, byy - 0.6 * u, 1.7 * u, 0, Math.PI * 2); g.fill(); if (dk > 0.6) { g.fillStyle = '#ffffff'; g.fillRect(ox - 3 * u, oy - 3 * u, u, u); g.fillRect(ox + 2 * u, oy - 4 * u, u, u); } }
    g.fillStyle = '#3a5a2a'; g.fillRect(ox - R, oy + 2 * u, R * 2, R); // 땅
    g.restore();
    g.strokeStyle = '#0c0a0b'; g.lineWidth = u; g.beginPath(); g.arc(ox, oy, R, 0, Math.PI * 2); g.stroke();
    this.text(`${c.day}일 · ${clockText(c)}`, x + 8 * u + R * 2 + 36 * u, oy, u, dk > 0.6 ? '#c8d0ff' : '#f6dfae', 'center');
  },

  // 스킬바: 대시 + 장착 스킬 4칸 (화면 아래 가운데)
  drawSkillBar(w) {
    const g = this.g, p = w.player, d = w.d, u = this.u, v = Math.max(2, u), W = this.c.width, H = this.c.height;
    const touch = document.body.classList.contains('touch');
    const box = (touch ? 16 : 20) * v, gap = 12 * v;
    const sk4 = (w.b.skills || []).filter((x) => x !== 'weapon'); while (sk4.length < 4) sk4.push(null); // Q · E · R · F 자리는 늘 그대로 (빈 각인 칸은 빈 칸)
    // 빈 칸 아래 안내: 다음 클래스 스킬이 열리는 레벨, 이미 열렸으면 공명 제단에서 끼운다
    const nextLv = Math.min(...Object.values(SKILLS).filter((sk) => sk.cls === w.b.cls && (sk.unlock || 1) > w.b.level).map((sk) => sk.unlock));
    const emptyHint = (w.b.available || []).some((id) => SKILLS[id]?.cls && !sk4.includes(id)) ? '제단에서' : Number.isFinite(nextLv) ? `Lv ${nextLv}` : '빈 칸';
    const slots = [...sk4.slice(0, 4), 'weapon'];
    const keys = [...['KeyQ', 'KeyE', 'KeyR', 'KeyF'].map((k) => keyLabel(keyFor(k))), touch ? '무기' : '우클릭']; // 키 바꾸기를 따른다
    const n = slots.length + 1;
    const total = n * box + (n - 1) * gap;
    const x0 = touch ? W - total - 8 * u : (W - total) / 2, y0 = touch ? Math.round(H * 0.2) : H - box - 12 * v; // 모바일: 오른쪽 작은 지도 아래 (체력 · 저장 안내와 겹치지 않게)
    // 대시
    const dashMax = d.dashCd * (1 - d.cdr), dashK = p.dashCharges > 0 ? 1 : Math.min(1, 1 - p.dashRecharge / dashMax);
    this.cooldownBox(x0, y0, box, dashK, touch ? '대시' : keyLabel(keyFor('Space')), '', null, p.dashCharges > 0 ? 0 : p.dashRecharge);
    // 빠른 칸 음식 (H)
    const qf = w.life?.quickFood;
    if (qf && !touch) {
      const qx = x0 - box - gap, n = w.life?.bag?.[qf] || 0;
      this.panel(qx, y0, box, box);
      if (n > 0) { g.imageSmoothingEnabled = false; const ic = iconCanvas(qf), s2 = Math.floor((box - 4 * u) / 16); g.drawImage(ic, Math.round(qx + (box - 16 * s2) / 2), Math.round(y0 + (box - 16 * s2) / 2), 16 * s2, 16 * s2); this.text(String(n), qx + box - 3 * v, y0 + box - 5 * v, Math.max(1, u - 1), '#ffffff', 'right'); }
      else { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(qx + u, y0 + u, box - 2 * u, box - 2 * u); }
      this.text('H', qx + 4 * v, y0 + 5 * v, Math.max(1, u - 1), '#f6dfae', 'left', true, true);
    }
    // 물약 (Z): 가진 물약 수 · 다시 마실 때까지
    const pots = ['potion1', 'potion2', 'potion3'].filter((id) => w.life?.bag?.[id] > 0);
    if (pots.length && !touch) {
      const px2 = x0 + n * (box + gap), cnt = pots.reduce((a, id) => a + w.life.bag[id], 0);
      this.cooldownBox(px2, y0, box, p.potionCd > 0 ? 1 - p.potionCd / 8 : 1, 'Z', '', null, p.potionCd);
      g.imageSmoothingEnabled = false; const ic = iconCanvas(pots[0]), s2 = Math.max(1, Math.floor((box - 8 * u) / 16)); g.drawImage(ic, Math.round(px2 + (box - 16 * s2) / 2), Math.round(y0 + (box - 16 * s2) / 2 + 2 * u), 16 * s2, 16 * s2);
      this.text(String(cnt), px2 + box - 3 * v, y0 + box - 5 * v, Math.max(1, u - 1), '#ffffff', 'right');
      this.text('물약', px2 + box / 2, y0 + box + 7 * v, Math.max(1, u - 1), '#dcd2c6', 'center');
    }
    slots.forEach((id, i) => {
      const x = x0 + (i + 1) * (box + gap);
      if (id === 'weapon') {
        const k = p.skillCd > 0 ? 1 - p.skillCd / p.skillMax : 1;
        this.cooldownBox(x, y0, box, k, keys[i], '', null, p.skillCd);
        this.text(this.fitName(WEAPON_SKILLS[w.b.weapon.skill]?.name || '무기', box * 1.3, Math.max(1, u - 1)), x + box / 2, y0 + box + 7 * v, Math.max(1, u - 1), '#dcd2c6', 'center');
        return;
      }
      if (!id) { if (touch) return; this.cooldownBox(x, y0, box, 1, keys[i], '', null, 0); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x + u, y0 + u, box - 2 * u, box - 2 * u); this.text(emptyHint, x + box / 2, y0 + box + 7 * v, Math.max(1, u - 1), '#8c8079', 'center'); return; }
      const sk = SKILLS[id];
      const cd = p.cds[id] || 0, max = p.cdMax?.[id] || sk.cd;
      const k = cd > 0 ? 1 - cd / max : 1;
      const need = sk.costAll ? sk.costAll.min : sk.cost || 0;
      const lack = need > p.res;
      this.cooldownBox(x, y0, box, k, keys[i], '', ROLE_COLOR[sk.role], cd, sk);
      if (lack && k >= 1) { g.fillStyle = 'rgba(40,0,0,0.55)'; g.fillRect(x + u, y0 + u, box - 2 * u, box - 2 * u); }
      this.text(this.fitName(sk.name, box * 1.3, Math.max(1, u - 1)), x + box / 2, y0 + box + 7 * v, Math.max(1, u - 1), lack ? '#e88a78' : '#dcd2c6', 'center'); // 한 줄 · 작은 글씨 (이웃 칸과 겹치지 않게)
      if (need) this.text(String(need), x + box - 3 * v, y0 + 5 * v, Math.max(1, u - 1), lack ? '#e88a78' : RACES[w.b.race].res.color, 'right');
    });
    // 시전바
    if (p.castT > 0) {
      const cw = 90 * v, cx = W / 2 - cw / 2, cy = touch ? H * 0.62 : y0 - 18 * v;
      this.panel(cx, cy, cw, 7 * v);
      g.fillStyle = '#7aa8ff'; g.fillRect(cx + u, cy + u, (cw - 2 * u) * (1 - p.castT / p.castMax), 5 * u);
      this.text(`${p.castSkill?.def.name || ''} 시전 중`, W / 2, cy - 6 * v, u, '#c8d8ff', 'center');
    }
  },

  // 스킬 칸 그림: 역할마다 7×7 도트 그림 (Dead Cells처럼 칸만 봐도 무슨 기술인지), 색은 원소 · 역할 색
  skillGlyph(x, y, s, sk) {
    const G = ROLE_GLYPH[sk.role] || ROLE_GLYPH['공격'], g = this.g, px = Math.max(1, Math.floor(s / 11)), ox = Math.round(x + (s - 7 * px) / 2), oy = Math.round(y + (s - 7 * px) / 2) - px;
    const col = ELEM[sk.elem]?.color || ROLE_COLOR[sk.role] || '#ede4d8';
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (G[r][c] !== '.') { g.fillStyle = '#0c0a0b'; g.fillRect(ox + c * px + px, oy + r * px + px, px, px); }
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) { const ch = G[r][c]; if (ch === '.') continue; g.fillStyle = ch === '#' ? col : '#ffffff'; g.fillRect(ox + c * px, oy + r * px, px, px); }
  },
  // 스킬 칸: 기다리는 동안은 어둡게 덮고 남은 초를 크게, 다 차면 금빛 테두리
  cooldownBox(x, y, s, k, key, label, border, rem = 0, sk = null) {
    const g = this.g, u = this.u;
    this.panel(x, y, s, s);
    if (sk) this.skillGlyph(x, y, s, sk);
    if (border) { g.fillStyle = border; g.fillRect(x, y + s - 2 * u, s, 2 * u); }
    if (k < 1) {
      g.fillStyle = 'rgba(0,0,0,0.74)';
      g.beginPath(); g.moveTo(x + s / 2, y + s / 2);
      g.arc(x + s / 2, y + s / 2, s * 0.7, -Math.PI / 2 + k * Math.PI * 2, Math.PI * 1.5); g.closePath();
      g.save(); g.beginPath(); g.rect(x + u, y + u, s - 2 * u, s - 2 * u); g.clip();
      g.beginPath(); g.moveTo(x + s / 2, y + s / 2); g.arc(x + s / 2, y + s / 2, s, -Math.PI / 2 + k * Math.PI * 2, Math.PI * 1.5); g.closePath(); g.fill();
      g.restore();
      if (rem > 0.05) { // 남은 시간: 칸 가운데 크게, 키 이름은 왼쪽 위에 작게
        if (sk) { g.save(); g.globalAlpha = 0.4; this.skillGlyph(x, y, s, sk); g.restore(); } // 재사용 중에도 그림이 흐리게 보이게
        g.fillStyle = 'rgba(8,6,12,0.7)'; g.fillRect(x + u, y + s - 10 * u, s - 2 * u, 9 * u);
        this.text(rem >= 3 ? String(Math.ceil(rem)) : rem.toFixed(1), x + s / 2, y + s - 5 * u, Math.max(1, u - 1), '#ffffff', 'center', true, true); // 남은 시간은 칸 아래쪽에 작게 (그림을 가리지 않게)
        this.text(key, x + 3 * u, y + 5 * u, Math.max(1, u - 1), '#a89a8f', 'left', true, true);
        return;
      }
    } else {
      g.fillStyle = 'rgba(255,207,90,0.16)'; g.fillRect(x + u, y + u, s - 2 * u, s - 2 * u);
      g.strokeStyle = '#e9b85c'; g.lineWidth = u; g.strokeRect(x + 1.5 * u, y + 1.5 * u, s - 3 * u, s - 3 * u);
    }
    if (sk) this.text(key, x + 3 * u, y + 5 * u, Math.max(1, u - 1), k >= 1 ? '#f6dfae' : '#8c8079', 'left', true, true); // 그림이 있으면 키는 왼쪽 위에 작게
    else this.text(key, x + s / 2, y + s / 2, key.length > 1 ? Math.max(1, u - 1) || 1 : u, k >= 1 ? '#f6dfae' : '#8c8079', 'center', true, true);
  },

  drawMinimap(w) {
    const g = this.g, u = this.u, W = this.c.width;
    let s = u * 0.75, mw = Math.round(w.tw * s), mh = Math.round(w.th * s), ox = 0, oy = 0;
    if (w.map.outdoor) { // 넓은 세계: 나를 가운데 둔 110×80칸 창
      const vw = 110, vh = 80; s = u * 1.3; mw = Math.round(vw * s); mh = Math.round(vh * s);
      ox = Math.max(0, Math.min(w.tw - vw, Math.floor(w.player.x / TILE) - vw / 2)); oy = Math.max(0, Math.min(w.th - vh, Math.floor(w.player.y / TILE) - vh / 2));
    }
    const mx = W - mw - 10 * u, my = 10 * u;
    this.panel(mx - 2 * u, my - 2 * u, mw + 4 * u, mh + 4 * u);
    g.fillStyle = '#05040a'; g.fillRect(mx, my, mw, mh);
    g.imageSmoothingEnabled = false;
    if (w.map.outdoor) g.drawImage(this.mini, ox, oy, mw / s, mh / s, mx, my, mw, mh); else g.drawImage(this.mini, mx, my, mw, mh);
    if (w.locks?.regions.size && w.map.regions) g.drawImage(this.sealCanvas(w), ox, oy, mw / s, mh / s, mx, my, mw, mh); // 해방되지 않은 지역
    const dot = (x, y, c, r = 1.5) => { const tx = x / TILE - ox, ty = y / TILE - oy; if (tx < 0 || ty < 0 || tx * s > mw || ty * s > mh) return; g.fillStyle = c; g.fillRect(Math.round(mx + tx * s - r * u), Math.round(my + ty * s - r * u), r * 2 * u, r * 2 * u); };
    const seen = (x, y) => w.explored[Math.floor(y / TILE) * w.tw + Math.floor(x / TILE)];
    for (const o of w.objects) {
      if (o.kind === 'questThing') { if (Math.floor(w.t * 3) % 2 === 0) dot(o.x, o.y, '#ffe040', 2.2); continue; }
      if (!seen(o.x, o.y)) continue;
      if (o.kind === 'portal') dot(o.x, o.y, o.color, 2);
      else if (o.kind === 'chest' && !o.opened && o.spotted) dot(o.x, o.y, o.rich ? '#d8a8ff' : '#e9b85c'); // 상자는 내 눈으로 본 것만 지도에
      else if (o.kind === 'lore' && !o.opened) dot(o.x, o.y, '#8ad8ff');
      else if (o.kind === 'camp') dot(o.x, o.y, '#ffa040', 2);
      else if (o.kind === 'merchant') dot(o.x, o.y, '#8fcf7a', 2);
      else if (o.kind === 'shrine' && !o.opened) dot(o.x, o.y, '#c9a8ff');
      else if (o.kind === 'stairs') dot(o.x, o.y, '#ff6040', 2);
      else if (o.kind === 'journal' && !o.read) dot(o.x, o.y, '#f0e0b0', 2);
      else if (o.kind === 'npc') dot(o.x, o.y, '#8fcf7a', 2);
      else if (o.kind === 'barrier' && !o.opened) dot(o.x, o.y, '#d07a4a', 1.5);
      else if (o.kind === 'sanctum') dot(o.x, o.y, SANCTUMS[o.race]?.color || '#fff', 2.2);
      else if (o.kind === 'waypoint') dot(o.x, o.y, o.active ? '#8ad8ff' : '#6a6478', o.active ? 2 : 1.4);
      else if (o.kind === 'entrance') dot(o.x, o.y, '#e8dcc0', 1.8);
      else if (o.kind === 'relic' && !o.opened) dot(o.x, o.y, SANCTUMS[o.race]?.color || '#fff', 1.4);
    }
    for (const e of w.enemies) if ((e.def.elite || e.champion) && seen(e.x, e.y)) dot(e.x, e.y, '#ff4040', 2);
    if (Math.floor(w.t * 4) % 2 === 0) dot(w.player.x, w.player.y, '#ffffff', 1.5);
    this.minimapBottom = my + mh;
    if (w.climb) { this.hudRightBottom = my + mh + 8 * this.u; for (const o of w.objects) if (o.kind === 'climbDoor') dot(o.x, o.y, CLIMB_REWARDS[o.next]?.color || '#fff', 2); else if (o.kind === 'climbReward' && !o.opened) dot(o.x, o.y, '#f6dfae', 2.2); return; } // 탑 등반: 아래 글은 등반 HUD 가 그린다
    if (!this.pctT || this.pctT < w.t) { this.pctT = w.t + 0.5; this.pctV = Math.round(w.exploredPct() * 100); }
    // 정보띠: 미니맵 바로 아래 한 상자에 시계 · 골드 / 지역 · 탐험 (따로 떠 있던 글자를 모은다)
    const sw = mw + 4 * u, sx0 = mx - 2 * u, sy0 = my + mh + 4 * u, tu2 = Math.max(1, u - 1), stripH = 24 * u;
    this.panel(sx0, sy0, sw, stripH);
    const c = w.clock;
    if (c) { const dk = darkness(c.min); this.text(`${c.day}일 · ${clockText(c)}`, sx0 + 5 * u, sy0 + 7 * u, tu2, dk > 0.6 ? '#c8d0ff' : '#f6dfae', 'left', false); }
    { const wallet = this.walletGold ?? 0, carry = w.loot?.gold || 0; this.text(`◆ ${wallet}${carry ? ` +${carry}` : ''}`, sx0 + sw - 5 * u, sy0 + 7 * u, tu2, '#e9b85c', 'right', false, true); } // 가진 골드 (+ 주웠지만 아직 맡기지 않은 골드)
    this.text(`${w.zone.name}${w.depth ? ` 지하 ${w.depth + 1}층` : ''} · 탐험 ${this.pctV}%`, sx0 + 5 * u, sy0 + 17 * u, tu2, '#c9beb2', 'left', false);
    let y = sy0 + stripH + 10 * u;
    if (w.loot.banked) { this.text('야영지에 잔향을 맡김', mx + mw, y, tu2, '#ffd88a', 'right'); y += 12 * u; }
    for (const [id, n] of Object.entries(w.loot.echoes)) {
      this.text(`◇ ${ECHOES[id].name} ${n}`, mx + mw, y, tu2, ECHOES[id].color, 'right');
      y += 12 * u;
    }
    if (w.goalNeeds?.length) {
      y += 20 * u;
      this.text('★ 목표 잔향', mx + mw, y, u, '#e9b85c', 'right');
      for (const gn of w.goalNeeds) {
        y += 14 * u;
        const got = Math.min(gn.need, gn.have + (w.loot.echoes[gn.id] || 0));
        this.text(`${ECHOES[gn.id].name} ${got}/${gn.need}`, mx + mw, y, Math.max(1, u - 1), got >= gn.need ? '#93d47f' : ECHOES[gn.id].color, 'right');
      }
    }
    const obj = w.zone.id === 'cave' && !w.depth ? storyObjective(w.story) : null;
    if (obj) {
      y += 20 * u;
      this.text('★ 이야기', mx + mw, y, u, '#f0e0b0', 'right');
      for (const line of obj) { y += 14 * u; this.text(line, mx + mw, y, Math.max(1, u - 1), '#e8dcc0', 'right'); }
    }    this.hudRightBottom = y + 8 * u;
  },

  // 큰 지도: 가 본 곳만 보이고, 성지 · 입구 · 마을 · 탑 · 내 위치를 표시
  drawBigMap(w) {
    const g = this.g, W = this.c.width, H = this.c.height, u = this.u;
    g.fillStyle = 'rgba(6,5,10,0.95)'; g.fillRect(0, 0, W, H);
    const s = Math.min((W - 40 * u) / w.tw, (H - 80 * u) / w.th), mw = w.tw * s, mh = w.th * s, mx = (W - mw) / 2, my = (H - mh) / 2 + 10 * u;
    // 가 보지 않은 곳: 짙은 밤바다 + 옅은 눈금
    g.fillStyle = '#0c1422'; g.fillRect(mx, my, mw, mh);
    g.fillStyle = 'rgba(120,150,190,0.07)';
    for (let x = 40; x < w.tw; x += 40) g.fillRect(Math.round(mx + x * s), my, 1, mh);
    for (let y = 40; y < w.th; y += 40) g.fillRect(mx, Math.round(my + y * s), mw, 1);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mini, mx, my, mw, mh);
    if (w.locks?.regions.size && w.map.regions) { // 해방되지 않은 지역: 안개 + 「탑 N층」
      g.drawImage(this.sealCanvas(w), mx, my, mw, mh);
      BIOME_LIST.forEach((b, i) => { const L = w.locks.regions.get(i); if (L) { this.text(`${b.name} · 잠김`, mx + b.x * s, my + b.y * s - 6 * u, Math.max(1, u - 1), '#c8b0ff', 'center'); this.text(L.text.replace('을 쓰러뜨리면 열린다', ''), mx + b.x * s, my + b.y * s + 6 * u, Math.max(1, u - 1), '#9a88c8', 'center'); } });
    }
    g.strokeStyle = 'rgba(232,220,192,0.6)'; g.lineWidth = 2; g.strokeRect(mx - 2, my - 2, mw + 4, mh + 4);
    // 가 본 지역의 이름
    for (const b of BIOME_LIST) if (b.id !== 'tower' && w.explored[b.y * w.tw + b.x]) { this.text(b.name, mx + b.x * s, my + b.y * s, Math.max(1, u - 1), 'rgba(255,244,214,0.75)', 'center'); if (b.lv) this.text(`Lv ${b.lv[0]}~${b.lv[1]}`, mx + b.x * s, my + b.y * s + 9 * u, Math.max(1, u - 1), 'rgba(255,214,150,0.7)', 'center'); }
    const seen = (x, y) => w.explored[Math.floor(y / TILE) * w.tw + Math.floor(x / TILE)];
    const P = (x, y) => [mx + (x / TILE) * s, my + (y / TILE) * s];
    for (const o of w.objects) {
      if (!seen(o.x, o.y)) continue;
      const [px, py] = P(o.x, o.y);
      if (o.kind === 'sanctum') { g.fillStyle = SANCTUMS[o.race]?.color || '#fff'; g.beginPath(); g.arc(px, py, 4 * u, 0, Math.PI * 2); g.fill(); this.text(SANCTUMS[o.race]?.name || '', px, py - 9 * u, Math.max(1, u - 1), '#ffffff', 'center'); }
      else if (o.kind === 'entrance') { g.fillStyle = '#e8dcc0'; g.fillRect(px - 2 * u, py - 2 * u, 4 * u, 4 * u); }
      else if (o.kind === 'waypoint') { g.fillStyle = '#0d0b10'; g.fillRect(px - 3 * u, py - 4 * u, 6 * u, 7 * u); g.fillStyle = o.active ? '#8ad8ff' : '#6a6478'; g.fillRect(px - 2 * u, py - 3 * u, 4 * u, 5 * u); if (o.active) { g.fillStyle = '#e8faff'; g.fillRect(px - u, py - 2 * u, 2 * u, 2 * u); } }
      else if (o.kind === 'rest') this.text('바람결 마을', px, py - 10 * u, Math.max(1, u - 1), '#ffd76a', 'center');
      else if (o.kind === 'towerDoor') this.text('각인의 탑', px, py - 26 * u, Math.max(1, u - 1), '#9ff0d8', 'center');
      else if (o.kind === 'raidAltar') this.text('레이드', px, py - 26 * u, Math.max(1, u - 1), '#ff9aa8', 'center');
    }
    const [ppx, ppy] = P(w.player.x, w.player.y);
    if (Math.floor(w.t * 3) % 2 === 0) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ppx, ppy, 3.5 * u, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#1a1410'; g.stroke(); }
    this.text('M · 지도 닫기', W / 2, my + mh + 16 * u, u, '#d8d0e8', 'center');
    this.text(`탐험 ${Math.round(w.exploredPct() * 100)}%`, W / 2, my - 14 * u, u, '#e8dcc0', 'center');
  },

  // 왼쪽 알림 (도감 단계 · 이야기 물건)
  drawNotes(dt) {
    const u = this.u, H = this.c.height;
    let y = H * 0.5;
    for (const n of this.notes) {
      n.t -= dt;
      this.g.globalAlpha = Math.max(0, Math.min(1, n.t));
      this.text(n.text, 12 * u, y, u, n.color, 'left', true);
      y += 14 * u;
    }
    this.g.globalAlpha = 1;
    this.notes = this.notes.filter((n) => n.t > 0);
  },
};

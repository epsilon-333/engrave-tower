// 캔버스 렌더러: world 상태를 읽어서 그리기만 한다 (게임 로직 없음)
// 화면 크기에 맞춰 정수 배율(S)로 도트를 키우고, 글씨는 실제 해상도로 따로 그린다.
import { TILE, T_LIQUID, T_WALL, T_CRACK, T_BUILD } from '../sim/mapgen.js';
import { getSprite, drawEchoGem } from './sprites.js';
import { sprite, frames } from './assets.js';
import { renderMap, hash } from './tiles.js';
import { ECHOES } from '../data/monsters.js';
import { RACE_ART, MONSTER_ART, NPC_ART, WEAPON_ART } from '../data/art.js';
import { sfx } from '../audio.js';

const FONT = 'Galmuri11, "Malgun Gothic", sans-serif';
const GLOW = { glowshroom: [26, '#5affd0'], candle: [30, '#ffb04a'], ember: [18, '#ff7a2a'], crystalB: [22, '#7ad8ff'], crystalR: [22, '#ff5a2a'] };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lg = this.light.getContext('2d');
    this.fx = []; this.texts = []; this.parts = []; this.corpses = [];
    this.alerts = new Map(); this.squash = new Map(); this.chestOpen = new Map();
    this.shake = 0; this.banner = null; this.hitstop = 0; this.fade = 1; this.hurtFlash = 0;
    this.cam = { x: 0, y: 0 };
    this.world = null; this.lastStep = 0;
    this.resize(innerWidth, innerHeight, devicePixelRatio || 1);
  }

  resize(cssW, cssH, dpr) {
    const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    this.c.width = W; this.c.height = H;
    this.c.style.width = cssW + 'px'; this.c.style.height = cssH + 'px';
    this.S = Math.max(2, Math.round(H / 290));
    this.VW = Math.ceil(W / this.S); this.VH = Math.ceil(H / this.S);
    this.u = Math.max(1, Math.round(this.S / 2)); // 글씨 배율 (Galmuri11 × u)
    this.light.width = this.VW; this.light.height = this.VH;
  }

  // 화면 좌표 → 월드 좌표 (마우스)
  toWorld(clientX, clientY) {
    const r = this.c.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * this.VW + this.cam.x, y: ((clientY - r.top) / r.height) * this.VH + this.cam.y };
  }

  setWorld(w) {
    this.world = w;
    this.mapCanvas = renderMap(w);
    this.fx = []; this.texts = []; this.parts = []; this.corpses = []; this.alerts.clear(); this.squash.clear(); this.chestOpen.clear();
    this.banner = null; this.fade = 1;
    this.cam.x = w.player.x - this.VW / 2; this.cam.y = w.player.y - this.VH / 2;
    this.fog = document.createElement('canvas'); this.fog.width = w.tw; this.fog.height = w.th;
    this.fg = this.fog.getContext('2d');
    this.fg.fillStyle = '#05040a'; this.fg.fillRect(0, 0, w.tw, w.th);
    this.mini = document.createElement('canvas'); this.mini.width = w.tw; this.mini.height = w.th;
    this.mg = this.mini.getContext('2d');
    this.applyReveal(true);
    if (w.zone) this.banner = { text: `${w.zone.floor}층 · ${w.zone.name}`, sub: '몬스터는 지역마다 무리지어 산다. 탐험하라.', t: 3.2, color: '#ffe8a8' };
    this.glowDeco = w.map.deco.filter((d) => GLOW[d.kind]);
  }

  applyReveal(all) {
    const w = this.world;
    const paint = (i) => {
      const x = i % w.tw, y = (i / w.tw) | 0, t = w.tiles[i];
      this.fg.clearRect(x, y, 1, 1);
      this.mg.fillStyle = t === T_WALL || t === T_CRACK ? '#211b28' : t === T_LIQUID ? '#3a6a9a' : t === T_BUILD ? '#5a4a3a' : '#8a7a6a';
      this.mg.fillRect(x, y, 1, 1);
    };
    if (all) { for (let i = 0; i < w.explored.length; i++) if (w.explored[i]) paint(i); }
    for (const i of w.revealed) if (i >= 0) paint(i);
    w.revealed.length = 0;
  }

  near(x, y) { const p = this.world.player; return Math.abs(x - p.x) < this.VW && Math.abs(y - p.y) < this.VH; }

  consume(w) {
    for (const ev of w.events) {
      switch (ev.t) {
        case 'dmg':
          if (ev.who === 'p') {
            this.texts.push({ x: ev.x, y: ev.y, text: fmt(ev.v), color: '#ff6060', t: 0.9, vy: -26, vx: 0, size: 2, pop: 0.12 });
            this.hurtFlash = 0.35; sfx('hurt', { vol: 0.8 });
            break;
          }
          this.texts.push({ x: ev.x + (Math.random() - 0.5) * 6, y: ev.y, text: fmt(ev.v), color: ev.color, t: 0.75, crit: ev.crit, heavy: ev.heavy, small: ev.small, vy: -34, vx: (Math.random() - 0.5) * 24, pop: ev.crit || ev.heavy ? 0.14 : 0.07 });
          if (ev.id != null) this.squash.set(ev.id, 0.14);
          if (ev.src === 'attack') {
            this.sparkBurst(ev.x, ev.y + 8, ev.crit ? '#ffe060' : '#ffffff', ev.crit ? 8 : 4);
            sfx(ev.armored ? 'hitArmor' : ev.crit || ev.heavy ? 'hitHeavy' : 'hit', { vol: 0.75 });
          } else if (ev.src === 'aoe' || ev.src === 'reaction') sfx('hit', { vol: 0.4, rate: 1.2 });
          break;
        case 'text':
          this.texts.push({ x: ev.x, y: ev.y, text: ev.text, color: ev.color, t: 1.1, vy: -16, vx: 0, label: true });
          if (ev.text === '빙결') sfx('freeze', { vol: 0.6 });
          break;
        case 'reaction':
          this.texts.push({ x: ev.x, y: ev.y, text: ev.text + '!', color: ev.color, t: 1.4, vy: -12, vx: 0, label: true, size: 2, pop: 0.2 });
          if (ev.r) this.fx.push({ k: 'ring', x: ev.x, y: ev.y + 20, r: ev.r, color: ev.color, t: 0.45, max: 0.45, w: 3 });
          this.burst(ev.x, ev.y + 20, ev.color, 22, 130);
          this.shake = Math.max(this.shake, 3); sfx('reaction', { vol: 0.5 });
          break;
        case 'ring': this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: ev.color, t: 0.3, max: 0.3, w: 2 }); break;
        case 'swing': this.fx.push({ k: 'slash', ...ev, t: ev.dur + 0.08, max: ev.dur + 0.08 }); sfx(ev.heavy ? 'heavySwing' : 'swing', { vol: 0.55 }); break;
        case 'shoot': sfx(ev.type === 'mag' ? 'cast' : 'shoot', { vol: 0.4, rate: ev.type === 'mag' ? 1.6 : 1.3 }); break;
        case 'spin': this.fx.push({ k: 'spin', ...ev, t: 0.32, max: 0.32 }); this.shake = 3; sfx('skill', { vol: 0.6 }); sfx('heavySwing', { vol: 0.7 }); break;
        case 'nova': this.fx.push({ k: 'nova', ...ev, t: 0.4, max: 0.4 }); this.burst(ev.x, ev.y, '#c9a8ff', 30, 160); this.shake = 4; sfx('skill', { vol: 0.6 }); sfx('reaction', { vol: 0.4, rate: 1.4 }); break;
        case 'volley': sfx('skill', { vol: 0.5 }); sfx('shoot', { vol: 0.6 }); break;
        case 'afterimage': this.fx.push({ k: 'line', ...ev, t: 0.3, max: 0.3 }); break;
        case 'dash': this.burst(ev.x, ev.y + 4, '#d8f0ff', 10, 60); this.fx.push({ k: 'ghost', x: ev.x, y: ev.y, t: 0.25, max: 0.25 }); sfx('dash', { vol: 0.6 }); break;
        case 'death': {
          this.burst(ev.x, ev.y - 6, ev.color, ev.big ? 60 : 16, ev.big ? 170 : 100);
          this.burst(ev.x, ev.y - 6, '#ffffff', 6, 60);
          if (ev.defId) this.corpses.push({ defId: ev.defId, x: ev.x, y: ev.y, dir: ev.dir, t: 0.4, max: 0.4 });
          if (ev.big) this.shake = 8;
          sfx('death', { vol: ev.big ? 1 : 0.6, rate: ev.big ? 0.7 : 1 });
          break;
        }
        case 'echo':
          this.texts.push({ x: ev.x, y: ev.y - 18, text: '+' + ECHOES[ev.id].name, color: ECHOES[ev.id].color, t: 1.5, vy: -12, vx: 0, label: true });
          this.burst(ev.x, ev.y, ECHOES[ev.id].color, 10, 50);
          sfx('echo', { vol: 0.6 });
          break;
        case 'pickup': this.sparkBurst(ev.x, ev.y - 4, '#ffcf3a', 3); sfx('coin', { vol: 0.35, rate: 1.2 }); break;
        case 'shake': this.shake = Math.max(this.shake, ev.v); break;
        case 'telegraph': this.fx.push({ k: 'tele', ...ev, t: 0.6, max: 0.6 }); break;
        case 'windup': this.alerts.set(ev.id, 0.4); break;
        case 'strike': this.fx.push({ k: 'claw', ...ev, t: 0.16, max: 0.16 }); break;
        case 'banner': this.banner = { text: ev.text, t: 2.5, color: ev.color }; sfx('levelup', { vol: 0.6 }); break;
        case 'hitstop': this.hitstop = Math.max(this.hitstop, ev.v); break;
        case 'alert': this.alerts.set(ev.id, -0.7); break;
        case 'spark': this.sparkBurst(ev.x, ev.y, ev.color, 4); break;
        case 'chest': this.chestOpen.set(`${ev.x},${ev.y}`, 0); this.burst(ev.x, ev.y - 6, ev.rich ? '#d8a8ff' : '#ffe08a', 30, 120); this.shake = 2; sfx('chest', { vol: 0.7 }); sfx('coin', { vol: 0.6 }); break;
        case 'crackHit': this.burst(ev.x, ev.y, '#a89880', 6, 60); this.shake = Math.max(this.shake, 1.5); sfx('crack', { vol: 0.6 }); break;
        case 'crackBreak': this.burst(ev.x, ev.y, '#a89880', 30, 130); this.shake = 5; this.mapCanvas = renderMap(w); sfx('crack', { vol: 1, rate: 0.7 }); break;
      }
    }
    w.events.length = 0;
    if (w.revealed.length) this.applyReveal(false);
  }

  burst(x, y, color, n, speed = 90) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, t: 0.35 + Math.random() * 0.45, max: 0.8, color, g: 160, z: 1 });
    }
  }
  sparkBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 100;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.12 + Math.random() * 0.12, max: 0.24, color, g: 0, line: true });
    }
  }

  // ─────────────────────────── 그리기 ───────────────────────────
  draw(w, dt) {
    const g = this.g, S = this.S, VW = this.VW, VH = this.VH;
    const p = w.player;
    const tx = p.x - VW / 2 + p.aimX * 16, ty = p.y - VH / 2 + p.aimY * 10;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);
    const mw = w.tw * TILE, mh = w.th * TILE;
    this.cam.x = mw <= VW ? (mw - VW) / 2 : Math.max(0, Math.min(mw - VW, this.cam.x));
    this.cam.y = mh <= VH ? (mh - VH) / 2 : Math.max(0, Math.min(mh - VH, this.cam.y));
    this.shake = Math.max(0, this.shake - dt * 22);
    const cx = Math.round((this.cam.x + (Math.random() - 0.5) * this.shake) * S) / S;
    const cy = Math.round((this.cam.y + (Math.random() - 0.5) * this.shake) * S) / S;
    this.cx = cx; this.cy = cy;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0a080e'; g.fillRect(0, 0, this.c.width, this.c.height);
    g.setTransform(S, 0, 0, S, -cx * S, -cy * S);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mapCanvas, 0, 0);
    this.drawLiquidAnim(w, cx, cy);
    if (w.mode === 'plaza') this.drawPlazaFloor(w);

    for (const c of w.clouds) {
      const a = Math.min(1, c.t / 0.5) * 0.3;
      g.fillStyle = c.owner === 'p' ? `rgba(150,230,90,${a})` : `rgba(190,160,80,${a})`;
      disc(g, c.x, c.y, c.r);
      for (let i = 0; i < 6; i++) {
        const an = w.t * 0.7 + i * 1.1;
        g.fillStyle = c.owner === 'p' ? `rgba(210,255,150,${a * 1.4})` : `rgba(230,200,120,${a * 1.4})`;
        disc(g, c.x + Math.cos(an) * c.r * 0.55, c.y + Math.sin(an * 1.3) * c.r * 0.45, 3 + (i % 3));
      }
    }
    for (const f of this.fx) if (f.k === 'tele') {
      const e = w.enemies.find((x) => x.id === f.id);
      if (!e) continue;
      const k = 1 - f.t / f.max;
      g.fillStyle = `rgba(255,40,40,${0.12 + 0.25 * k})`;
      g.save(); g.translate(e.x, e.y); g.rotate(Math.atan2(f.dy, f.dx));
      g.fillRect(0, -e.r, 150, e.r * 2);
      g.fillStyle = `rgba(255,80,80,${0.5 * k})`; g.fillRect(0, -e.r, 150 * k, e.r * 2);
      g.restore();
    }

    // 엔티티 (y 정렬)
    const vis = (x, y) => x > cx - 48 && x < cx + VW + 48 && y > cy - 48 && y < cy + VH + 64;
    const list = [];
    for (const o of w.objects) if (vis(o.x, o.y)) list.push({ o, y: o.kind === 'gate' ? -1e9 : o.y });
    for (const dr of w.drops) list.push({ dr, y: dr.y });
    for (const e of w.enemies) if (vis(e.x, e.y)) list.push({ e, y: e.y });
    for (const c of this.corpses) list.push({ c, y: c.y });
    list.push({ p, y: p.y });
    if (w.mode === 'plaza') {
      for (const pr of w.map.props) list.push({ prop: pr, y: (pr.y + pr.h) * TILE - 2 });
      for (const d of w.map.wallDeco) list.push({ wd: d, y: -1e9 + 1 });
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.p) this.drawPlayer(w, p, dt);
      else if (it.e) this.drawEnemy(w, it.e, dt);
      else if (it.o) this.drawObject(w, it.o, dt);
      else if (it.dr) this.drawDrop(w, it.dr);
      else if (it.c) this.drawCorpse(it.c, dt);
      else if (it.prop) this.drawProp(w, it.prop);
      else if (it.wd) this.drawWallDeco(w, it.wd);
    }
    this.corpses = this.corpses.filter((c) => c.t > 0);

    for (const pr of w.projs) this.drawProj(pr);
    this.drawFx(w, dt);

    for (const q of this.parts) {
      q.t -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9;
      const a = Math.min(1, (q.t / q.max) * 1.6);
      if (q.line) {
        g.strokeStyle = hexA(q.color, a); g.lineWidth = 1;
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); g.stroke();
      } else { g.fillStyle = hexA(q.color, a); g.fillRect(Math.round(q.x), Math.round(q.y), q.t > 0.4 ? 2 : 1, q.t > 0.4 ? 2 : 1); }
    }
    this.parts = this.parts.filter((q) => q.t > 0);

    if (w.mode === 'field') { this.drawLight(w, cx, cy); this.drawFog(w, cx, cy); }

    this.drawTexts(w, dt);
    this.drawHud(w, dt);

    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.hurtFlash > 0) {
      this.hurtFlash -= dt;
      const gr = g.createRadialGradient(this.c.width / 2, this.c.height / 2, this.c.height * 0.3, this.c.width / 2, this.c.height / 2, this.c.height * 0.8);
      gr.addColorStop(0, 'rgba(200,0,0,0)'); gr.addColorStop(1, `rgba(200,0,0,${this.hurtFlash})`);
      g.fillStyle = gr; g.fillRect(0, 0, this.c.width, this.c.height);
    }
    if (w.mode === 'field' && p.hp < w.d.maxHp * 0.3) {
      const k = 0.25 + 0.15 * Math.sin(w.t * 6);
      const gr = g.createRadialGradient(this.c.width / 2, this.c.height / 2, this.c.height * 0.35, this.c.width / 2, this.c.height / 2, this.c.height * 0.85);
      gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(120,0,0,${k})`);
      g.fillStyle = gr; g.fillRect(0, 0, this.c.width, this.c.height);
    }
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt * 1.8);
      g.fillStyle = `rgba(5,4,10,${this.fade})`; g.fillRect(0, 0, this.c.width, this.c.height);
    }
  }

  drawLiquidAnim(w, cx, cy) {
    if (!w.zone) return;
    const g = this.g, z = w.zone;
    const x0 = Math.max(0, Math.floor(cx / TILE)), y0 = Math.max(0, Math.floor(cy / TILE));
    const x1 = Math.min(w.tw - 1, x0 + Math.ceil(this.VW / TILE) + 1), y1 = Math.min(w.th - 1, y0 + Math.ceil(this.VH / TILE) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (w.tiles[y * w.tw + x] !== T_LIQUID) continue;
      const h = hash(x, y, 77);
      const ph = w.t * (z.liquid === 'lava' ? 1.3 : 2) + (h % 100) / 16;
      const ox = Math.round((Math.sin(ph) + 1) * 4), oy = 3 + (h % 9);
      g.fillStyle = z.liquid === 'lava' ? `rgba(255,220,90,${0.35 + 0.35 * Math.sin(ph * 1.7)})` : z.liquid === 'mist' ? `rgba(200,180,255,${0.15 + 0.1 * Math.sin(ph)})` : 'rgba(255,255,255,0.22)';
      g.fillRect(x * TILE + ox, y * TILE + oy, 5, 1);
      if (z.liquid === 'lava' && h % 5 === 0 && Math.random() < 0.01) this.parts.push({ x: x * TILE + 8, y: y * TILE + 8, vx: 0, vy: -20, t: 0.6, max: 0.6, color: '#ffb040', g: -20 });
    }
  }

  drawPlazaFloor(w) {
    const g = this.g, r = w.map.rune, t = w.t;
    for (let ring = 0; ring < 2; ring++) {
      const R = ring ? 34 : 22;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + t * (ring ? 0.15 : -0.25);
        g.fillStyle = `rgba(160,140,255,${0.35 + 0.25 * Math.sin(t * 2 + i)})`;
        g.fillRect(Math.round(r.x + Math.cos(a) * R), Math.round(r.y + Math.sin(a) * R * 0.6), 2, 2);
      }
    }
    g.fillStyle = `rgba(190,170,255,${0.4 + 0.2 * Math.sin(t * 3)})`;
    g.fillRect(r.x - 1, r.y - 6, 2, 12); g.fillRect(r.x - 6, r.y - 1, 12, 2);
  }

  shadow(x, y, w) { this.g.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(this.g, x, y, w, Math.max(1.5, w * 0.35)); }

  animFrame(base, kind, t, speed = 8) {
    const fr = frames(base, kind);
    return fr[Math.floor(t * speed) % fr.length];
  }

  drawEnemy(w, e, dt) {
    const g = this.g, def = e.def;
    if (def.ai === 'dummy') return this.drawDummy(w, e);
    const art = MONSTER_ART[e.defId] || { base: 'goblin' };
    const sc = art.scale || 1;
    const name = this.animFrame(art.base, e.moving ? 'run' : 'idle', w.t + e.phase, e.moving ? 10 : 6);
    const wind = e.windT > 0;
    const flash = e.hitFlash > 0 ? true : wind && Math.floor(w.t * 20) % 2 ? '#ff4040' : false;
    // 그림이 없으면 투명해지지 않도록 고블린 그림으로 대체
    const img = sprite(name, art.tint || '', flash, e.dir < 0) || sprite(frames('goblin', 'idle')[0], '', flash, e.dir < 0);
    if (!img) return;
    let sq = this.squash.get(e.id) || 0;
    if (sq > 0) { sq -= dt; this.squash.set(e.id, sq); }
    const k = Math.max(0, sq) / 0.14;
    const sx = 1 + 0.25 * k, sy = 1 - 0.2 * k;
    const wobble = wind ? (Math.random() - 0.5) * 1.5 : 0;
    const w0 = img.width * sc * sx, h0 = img.height * sc * sy;
    if (def.elite) { g.fillStyle = `rgba(255,60,40,${0.18 + 0.1 * Math.sin(w.t * 4)})`; ellipse(g, e.x, e.y + 3, w0 * 0.55, w0 * 0.2); }
    this.shadow(e.x, e.y + 3, Math.max(5, img.width * sc * 0.32));
    if (art.ghost) g.globalAlpha = 0.65 + 0.15 * Math.sin(w.t * 3 + e.phase);
    const dx = Math.round(e.x - w0 / 2 + wobble), dy = Math.round(e.y + 4 - h0);
    g.drawImage(img, dx, dy, Math.round(w0), Math.round(h0));
    g.globalAlpha = 1;
    if (e.st.frozen > 0) {
      g.fillStyle = 'rgba(170,225,255,0.5)'; g.fillRect(dx, dy + 2, Math.round(w0), Math.round(h0) - 2);
      g.fillStyle = '#e8f8ff'; g.fillRect(dx + 1, dy + 3, 2, 1); g.fillRect(dx + Math.round(w0) - 4, dy + 6, 2, 1);
    }
    if (e.st.burn && Math.random() < 0.35) this.parts.push({ x: e.x + (Math.random() - 0.5) * w0 * 0.6, y: e.y - h0 * 0.4, vx: 0, vy: -30, t: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffd040', g: -40 });
    if (e.st.poison && Math.random() < 0.15) this.parts.push({ x: e.x + (Math.random() - 0.5) * w0 * 0.6, y: e.y - h0 * 0.3, vx: 0, vy: -15, t: 0.5, max: 0.5, color: '#9be15d', g: -20 });
    if (e.st.bleed && Math.random() < 0.12) this.parts.push({ x: e.x + (Math.random() - 0.5) * w0 * 0.4, y: e.y - h0 * 0.5, vx: 0, vy: 10, t: 0.5, max: 0.5, color: '#c02030', g: 120 });
    e._top = e.y + 4 - h0;
    // 체력바
    if (e.hp < e.maxHp && !def.elite) {
      const bw = Math.max(16, Math.round(w0 * 0.9));
      const bx = Math.round(e.x - bw / 2), by = Math.round(e._top - 5);
      g.fillStyle = '#0d0b10'; g.fillRect(bx - 1, by - 1, bw + 2, 4);
      g.fillStyle = '#3a1418'; g.fillRect(bx, by, bw, 2);
      g.fillStyle = '#e8484a'; g.fillRect(bx, by, Math.max(0, Math.round(bw * e.hp / e.maxHp)), 2);
    }
    // 상태이상 아이콘
    const pips = [];
    if (e.st.burn) pips.push(['#ff7a2a', e.st.burn.n]);
    if (e.st.poison) pips.push(['#9be15d', e.st.poison.n]);
    if (e.st.bleed) pips.push(['#e0445a', e.st.bleed.n]);
    if (e.st.chill) pips.push(['#9fe3ff', e.st.chill.n]);
    if (e.st.mark > 0) pips.push(['#ffe040', 0]);
    if (e.st.septic > 0) pips.push(['#c8e04a', 0]);
    let px = Math.round(e.x - (pips.length * 6) / 2);
    const py = Math.round(e._top - 11);
    for (const [c] of pips) {
      g.fillStyle = '#0d0b10'; g.fillRect(px - 1, py - 1, 6, 6);
      g.fillStyle = c; g.fillRect(px, py, 4, 4);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(px, py, 2, 1);
      px += 6;
    }
    e._pips = pips;
    // 발견(!)/예고 표시
    const al = this.alerts.get(e.id);
    if (al != null) {
      if (al < 0) { // 발견: 노란 느낌표
        this.alerts.set(e.id, al + dt);
        this.bang(e.x, e._top - 14 + (al + 0.7) * -6, '#ffd040');
        if (al + dt >= 0) this.alerts.delete(e.id);
      } else if (e.windT > 0) this.bang(e.x, e._top - 14, '#ff3030');
      else this.alerts.delete(e.id);
    }
  }

  bang(x, y, c) {
    const g = this.g; x = Math.round(x); y = Math.round(y);
    g.fillStyle = '#0d0b10'; g.fillRect(x - 2, y - 1, 5, 11);
    g.fillStyle = c; g.fillRect(x - 1, y, 3, 6); g.fillRect(x - 1, y + 7, 3, 2);
  }

  drawDummy(w, e) {
    const g = this.g;
    this.shadow(e.x, e.y + 3, 6);
    const off = e.wobble > 0 ? Math.round(Math.sin(e.wobble * 50) * 2) : 0;
    const img = getSprite('dummy', e.def.pal, 0, e.hitFlash > 0, false);
    g.drawImage(img, Math.round(e.x - 8 + off), Math.round(e.y - 12));
    e._top = e.y - 12;
  }

  drawCorpse(c, dt) {
    const art = MONSTER_ART[c.defId]; if (!art) { c.t = 0; return; }
    c.t -= dt;
    const k = 1 - c.t / c.max;
    const img = sprite(frames(art.base, 'idle')[0], art.tint || '', k < 0.3, c.dir < 0);
    if (!img) return;
    const g = this.g, sc = art.scale || 1;
    g.globalAlpha = Math.max(0, 1 - k);
    const w0 = img.width * sc * (1 + k * 0.3), h0 = img.height * sc * (1 - k * 0.7);
    g.drawImage(img, Math.round(c.x - w0 / 2), Math.round(c.y + 4 - h0), Math.round(w0), Math.round(h0));
    g.globalAlpha = 1;
  }

  drawPlayer(w, p, dt) {
    const g = this.g;
    const art = RACE_ART[w.b.race];
    const moving = p.moving && p.dashT <= 0;
    const name = this.animFrame(art.base, moving ? 'run' : 'idle', moving ? p.walkT : w.t, moving ? 11 : 6);
    if (moving) {
      const step = Math.floor(p.walkT * 5.5);
      if (step !== this.lastStep) { this.lastStep = step; sfx('step', { vol: 0.18, jitter: 0.15 }); if (p.onLiquid) this.burst(p.x, p.y + 3, '#a8d8ff', 2, 20); }
    }
    const blink = p.invuln > 0 && p.dashT <= 0 && Math.floor(w.t * 20) % 2 === 0;
    const img = sprite(name, art.tint || '', p.hitFlash > 0 ? '#ff6060' : false, p.dir < 0);
    // 공격 순간 몸을 앞으로 내밀기
    const sk = p.swingMax ? p.swingT / p.swingMax : 0;
    const lunge = sk > 0 ? Math.sin(sk * Math.PI) * 2.5 : 0;
    const ox = Math.cos(p.swingAng) * lunge, oy = Math.sin(p.swingAng) * lunge;
    if (p.shield > 0) { g.fillStyle = 'rgba(170,215,255,0.22)'; ellipse(g, p.x, p.y - 8, 12, 14); }
    this.shadow(p.x, p.y + 4, 6);
    const pose = this.weaponPose(w, p);
    if (pose.behind) this.drawWeapon(w, p, pose, ox, oy);
    if (!blink && img) g.drawImage(img, Math.round(p.x - img.width / 2 + ox), Math.round(p.y + 5 - img.height + oy));
    if (!pose.behind) this.drawWeapon(w, p, pose, ox, oy);
  }

  // 무기 자세: 캐릭터가 바라보는 방향(좌/우) 기준 각도. 0 = 정면 수평, 음수 = 위쪽
  weaponPose(w, p) {
    const wpn = w.b.weapon, wa = WEAPON_ART[w.b.weaponId] || {};
    const breathe = Math.sin(w.t * 3) * 0.05;
    if (p.spinT > 0) return { a: -1.2 + (1 - p.spinT / 0.3) * Math.PI * 2, behind: false };
    if (wa.bow) {
      // 활: 공격 버튼을 누르는 동안 시위를 당기고, 쏘는 순간 놓는다
      let pull = 0;
      if (p.attackHeld && p.atkPeriod) pull = Math.min(1, 1 - p.atkCd / p.atkPeriod);
      if (p.swingT > 0) pull = 0;
      return { a: -0.15 + breathe * 0.5, pull, snap: p.swingT > 0 ? p.swingT / 0.1 : 0, behind: false };
    }
    const k = p.swingMax && p.swingT > 0 ? 1 - p.swingT / p.swingMax : -1;
    if (wpn.kind === 'proj') {
      // 지팡이: 들어 올렸다가 앞으로 뻗는다
      if (k < 0) return { a: -1.25 + breathe, behind: false };
      const a = k < 0.35 ? -1.25 - 0.8 * (k / 0.35) : -2.05 + 1.85 * easeOut((k - 0.35) / 0.65);
      return { a, cast: k, behind: a < -1.7 };
    }
    // 근접: 머리 위로 들었다가(준비) 내려친다 / 다음 공격은 올려 벤다
    if (k < 0) return { a: -1.05 + breathe, behind: false };
    const down = p.swingDir > 0;
    const from = down ? -2.4 : 1.0, to = down ? 1.0 : -2.2;
    const wind = 0.18;
    const a = k < wind ? from + (down ? -0.25 : 0.25) * (k / wind) : from + (to - from) * easeOut((k - wind) / (1 - wind));
    return { a, behind: a < -1.8 };
  }

  drawWeapon(w, p, pose, ox, oy) {
    const g = this.g, dir = p.dir;
    const wa = WEAPON_ART[w.b.weaponId] || WEAPON_ART.rustySword;
    const img = sprite(wa.s, wa.tint || '');
    if (!img) return;
    const world = dir > 0 ? pose.a : Math.PI - pose.a;
    const hx = p.x + ox + dir * 4, hy = p.y - 7 + oy;
    g.save();
    g.translate(Math.round(hx), Math.round(hy));
    if (wa.bow) {
      // 활은 세워서 앞으로 든다. 시위를 당기면 화살이 걸린다
      const back = 7 * (pose.pull || 0), bh = img.height;
      g.scale(dir, 1);
      g.drawImage(img, 1, Math.round(-bh / 2));
      const sx = 2 - back - (pose.snap ? Math.sin(pose.snap * 12) * 1.2 : 0);
      g.strokeStyle = '#e8e2cf'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(3, -bh / 2 + 2); g.lineTo(sx, 0); g.lineTo(3, bh / 2 - 2); g.stroke();
      if ((pose.pull || 0) > 0.15) {
        const ar = sprite('weapon_arrow');
        if (ar) { g.save(); g.translate(sx, 0); g.rotate(Math.PI / 2); g.drawImage(ar, -Math.round(ar.width / 2), -ar.height + 3); g.restore(); }
      }
    } else {
      g.rotate(world + Math.PI / 2);
      const sc = Math.min(1, 24 / img.height);
      g.drawImage(img, Math.round(-img.width * sc / 2), Math.round(-img.height * sc + 3), Math.round(img.width * sc), Math.round(img.height * sc));
    }
    g.restore();
    if (w.b.weapon.dmg === 'mag' && w.b.weapon.kind === 'proj') {
      const len = 20, tx = hx + Math.cos(world) * len, ty = hy + Math.sin(world) * len;
      const glow = pose.cast != null ? 0.9 : 0.3 + 0.2 * Math.sin(w.t * 8);
      g.fillStyle = `rgba(200,160,255,${glow})`; disc(g, tx, ty, pose.cast != null ? 4 : 2.5);
    }
  }

  drawProj(pr) {
    const g = this.g;
    if (pr.kind === 'arrow') {
      const img = sprite('weapon_arrow');
      if (img) {
        g.save(); g.translate(Math.round(pr.x), Math.round(pr.y)); g.rotate(Math.atan2(pr.vy, pr.vx) + Math.PI / 2);
        g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2)); g.restore();
        return;
      }
    }
    const x = Math.round(pr.x), y = Math.round(pr.y);
    for (let i = 1; i <= 3; i++) {
      g.fillStyle = hexA(pr.color, 0.4 - i * 0.1);
      disc(g, x - pr.vx * 0.012 * i, y - pr.vy * 0.012 * i, 3 - i * 0.6);
    }
    g.fillStyle = '#0d0b10'; disc(g, x, y, 3.5);
    g.fillStyle = pr.color; disc(g, x, y, 2.5);
    g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 1, 1, 1);
  }

  drawFx(w, dt) {
    const g = this.g, p = w.player;
    for (const f of this.fx) {
      f.t -= dt;
      const k = Math.max(0, f.t / f.max);
      if (f.k === 'ring') {
        g.strokeStyle = hexA(f.color, k); g.lineWidth = f.w || 2;
        g.beginPath(); g.arc(f.x, f.y, f.r * (1 - k * 0.6), 0, Math.PI * 2); g.stroke();
      } else if (f.k === 'slash') {
        // 휘두른 궤적의 초승달 잔상: 끝에서부터 사라짐
        const prog = easeOut(Math.min(1, 1 - (f.t - 0.08) / f.dur));
        const half = f.arc / 2 + 0.25;
        const a0 = f.ang - f.dir * half, a1 = a0 + f.dir * half * 2 * prog;
        const tail = Math.max(0, 1 - k * 1.6);
        const as = a0 + f.dir * half * 2 * prog * tail;
        const col = f.heavy ? '#ffd050' : f.type === 'mag' ? '#c9a8ff' : '#ffffff';
        const R = f.range + 4, r = Math.max(6, f.range * 0.35);
        const px = p.x, py = p.y - 6;
        const alpha = Math.min(1, k * 2.2);
        g.fillStyle = hexA(col, 0.55 * alpha);
        smear(g, px, py, R, (f.heavy ? 10 : 7), as, a1);
        g.fillStyle = hexA('#ffffff', 0.95 * alpha);
        smear(g, px, py, R, (f.heavy ? 4 : 2.5), as, a1);
      } else if (f.k === 'spin') {
        g.strokeStyle = hexA(f.type === 'mag' ? '#c9a8ff' : '#ffffff', k); g.lineWidth = 5 * k + 1;
        g.beginPath(); g.arc(p.x, p.y - 6, f.r * (1 - k * 0.3), 0, Math.PI * 2); g.stroke();
        g.strokeStyle = hexA('#ffd050', k * 0.6); g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y - 6, f.r * (1 - k * 0.3) - 5, 0, Math.PI * 2); g.stroke();
      } else if (f.k === 'nova') {
        g.fillStyle = hexA('#b58cff', 0.35 * k); disc(g, f.x, f.y - 6, f.r * (1 - k));
        g.strokeStyle = hexA('#e8d8ff', k); g.lineWidth = 3;
        g.beginPath(); g.arc(f.x, f.y - 6, f.r * (1 - k), 0, Math.PI * 2); g.stroke();
      } else if (f.k === 'claw') {
        g.strokeStyle = hexA('#ff4040', k); g.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          g.beginPath(); g.arc(f.x, f.y - 4, f.r + i * 3, f.ang - 0.6, f.ang + 0.6); g.stroke();
        }
      } else if (f.k === 'line') {
        g.strokeStyle = hexA('#bfe8ff', k * 0.7); g.lineWidth = 7;
        g.beginPath(); g.moveTo(f.x1, f.y1); g.lineTo(f.x2, f.y2); g.stroke();
      } else if (f.k === 'ghost') {
        const art = RACE_ART[w.b.race];
        const img = sprite(frames(art.base, 'run')[0], 'brightness(2) saturate(0)', false, p.dir < 0);
        if (img) { g.globalAlpha = k * 0.5; g.drawImage(img, Math.round(f.x - img.width / 2), Math.round(f.y + 5 - img.height)); g.globalAlpha = 1; }
      }
    }
    this.fx = this.fx.filter((f) => f.t > 0);
  }

  drawDrop(w, dr) {
    const g = this.g;
    const bob = Math.sin(w.t * 5 + dr.x) * 1.5;
    this.shadow(dr.x, dr.y + 4, 3);
    if (dr.kind === 'gold') {
      const img = sprite(frames('coin', 'idle')[Math.floor(w.t * 10 + dr.x) % 4]);
      if (img) g.drawImage(img, Math.round(dr.x - 3), Math.round(dr.y - 4 + bob));
    } else {
      g.fillStyle = hexA(ECHOES[dr.id].color, 0.25 + 0.15 * Math.sin(w.t * 6)); disc(g, dr.x, dr.y - 3 + bob, 6);
      drawEchoGem(g, Math.round(dr.x), Math.round(dr.y - 3 + bob), ECHOES[dr.id].color, 3);
    }
  }

  drawObject(w, o, dt) {
    const g = this.g, t = w.t;
    if (o.kind === 'gate') {
      const x = o.door * TILE, y = 1 * TILE;
      g.fillStyle = hexA(o.color, 0.55 + 0.2 * Math.sin(t * 3)); g.fillRect(x + 3, y + 3, 26, 29);
      for (let i = 0; i < 4; i++) { const ph = (t * 0.7 + i / 4) % 1; g.fillStyle = hexA('#ffffff', 0.6 * (1 - ph)); g.fillRect(Math.round(x + 6 + i * 6), Math.round(y + 30 - ph * 24), 2, 2); }
      const fl = sprite('doors_frame_left'), fr = sprite('doors_frame_right'), ft = sprite('doors_frame_top'), leaf = sprite('doors_leaf_open');
      if (leaf) g.drawImage(leaf, x, y);
      if (fl) g.drawImage(fl, x - 16, y); if (fr) g.drawImage(fr, x + 32, y); if (ft) g.drawImage(ft, x, y - 16);
      g.fillStyle = hexA(o.color, 0.25); ellipse(g, x + 16, y + 34, 16, 4);
      return;
    }
    if (o.kind === 'station') return this.drawNpc(w, o);
    if (o.kind === 'portal') {
      const img = sprite('floor_stairs');
      g.fillStyle = hexA(o.color, 0.25 + 0.1 * Math.sin(t * 3)); ellipse(g, o.x, o.y + 4, 16, 8);
      if (img) g.drawImage(img, Math.round(o.x - 8), Math.round(o.y - 4));
      for (let i = 0; i < 3; i++) { const ph = (t * 0.8 + i / 3) % 1; g.fillStyle = hexA(o.color, 1 - ph); g.fillRect(Math.round(o.x - 5 + i * 5), Math.round(o.y + 6 - ph * 20), 1, 3); }
      return;
    }
    if (o.kind === 'chest') {
      const key = `${o.x},${o.y}`;
      let fr = 0;
      if (o.opened) { const ot = (this.chestOpen.get(key) ?? 1) + dt; this.chestOpen.set(key, ot); fr = Math.min(2, Math.floor(ot * 12)); }
      const img = sprite(`chest_full_open_anim_f${fr}`, o.rich ? 'hue-rotate(230deg) saturate(1.6) brightness(1.1)' : '');
      this.shadow(o.x, o.y + 6, 7);
      if (img) g.drawImage(img, Math.round(o.x - 8), Math.round(o.y - 9));
      if (!o.opened && Math.sin(t * 3 + o.x) > 0.7) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(o.x - 5 + ((t * 9) | 0) % 10), Math.round(o.y - 10), 1, 1); }
      return;
    }
    if (o.kind === 'lore') {
      const x = Math.round(o.x - 6), y = Math.round(o.y - 18);
      this.shadow(o.x, o.y + 4, 7);
      g.fillStyle = '#0d0b10'; g.fillRect(x - 1, y - 1, 14, 22);
      g.fillStyle = '#5e5664'; g.fillRect(x, y, 12, 21);
      g.fillStyle = '#7e7686'; g.fillRect(x, y, 12, 2); g.fillRect(x, y, 2, 21);
      g.fillStyle = '#3e3844'; g.fillRect(x + 10, y + 2, 2, 19);
      const glow = o.opened ? '#4a4458' : `rgba(140,220,255,${0.6 + 0.4 * Math.sin(t * 3)})`;
      g.fillStyle = glow;
      g.fillRect(x + 3, y + 4, 6, 1); g.fillRect(x + 5, y + 4, 1, 9); g.fillRect(x + 3, y + 9, 2, 1); g.fillRect(x + 7, y + 11, 2, 1); g.fillRect(x + 3, y + 15, 6, 1);
    }
  }

  drawNpc(w, o) {
    const g = this.g;
    const art = NPC_ART[o.station];
    const name = this.animFrame(art.base, 'idle', w.t + o.x * 0.01, 5);
    const img = sprite(name, '', false, w.player.x < o.x);
    this.shadow(o.x, o.y + 4, 6);
    if (img) g.drawImage(img, Math.round(o.x - img.width / 2), Math.round(o.y + 5 - img.height));
    o._top = o.y + 5 - (img ? img.height : 24);
    if (o.station === 'board' && w.questReady) this.bang(o.x, o._top - 12 + Math.sin(w.t * 5) * 1.5, '#ffd040');
  }

  drawProp(w, pr) {
    const g = this.g, x = pr.x * TILE, y = pr.y * TILE;
    if (pr.kind === 'column') { const s = sprite('column'); if (s) g.drawImage(s, x, y + TILE - 48); return; }
    if (pr.kind === 'crate') { const s = sprite('crate'); if (s) g.drawImage(s, x, y - 8); return; }
    if (pr.kind === 'shelf') {
      const W = pr.w * TILE;
      g.fillStyle = '#0d0b10'; g.fillRect(x - 1, y - 17, W + 2, 34);
      g.fillStyle = '#5a3a24'; g.fillRect(x, y - 16, W, 32);
      g.fillStyle = '#3a2416'; for (const sy of [y - 6, y + 5]) g.fillRect(x, sy, W, 2);
      const cols = ['#8a2a2a', '#2a5a8a', '#3a7a3a', '#8a6a2a', '#5a3a7a', '#7a7a6a'];
      for (let row = 0; row < 3; row++) for (let i = 0; i < W / 3 - 1; i++) {
        const h = hash(pr.x * 31 + i, row);
        g.fillStyle = cols[h % cols.length];
        g.fillRect(x + 2 + i * 3, y - 15 + row * 11 + (h % 3), 2, 8 - (h % 3));
      }
      return;
    }
    if (pr.kind === 'board') {
      g.fillStyle = '#0d0b10'; g.fillRect(x - 1, y - 17, 34, 28);
      g.fillStyle = '#6a4a2a'; g.fillRect(x, y - 16, 32, 22);
      g.fillStyle = '#4a3018'; g.fillRect(x + 2, y + 6, 3, 10); g.fillRect(x + 27, y + 6, 3, 10);
      for (const [px, py, c] of [[3, -13, '#e8dcc0'], [13, -14, '#f0e8d0'], [22, -12, '#e0d4b0'], [8, -4, '#e8dcc0'], [19, -3, '#f0e8d0']]) {
        g.fillStyle = c; g.fillRect(x + px, y + py, 8, 9);
        g.fillStyle = '#8a7a6a'; g.fillRect(x + px + 1, y + py + 2, 6, 1); g.fillRect(x + px + 1, y + py + 4, 5, 1);
        g.fillStyle = '#c03030'; g.fillRect(x + px + 3, y + py, 2, 1);
      }
      return;
    }
    if (pr.kind === 'anvil') {
      g.fillStyle = '#0d0b10'; g.fillRect(x, y + 1, 16, 12);
      g.fillStyle = '#5a5a66'; g.fillRect(x + 1, y + 2, 14, 4); g.fillRect(x + 5, y + 6, 6, 4); g.fillRect(x + 3, y + 10, 10, 2);
      g.fillStyle = '#8a8a96'; g.fillRect(x + 1, y + 2, 14, 1);
      if (Math.random() < 0.02) this.sparkBurst(x + 8, y + 2, '#ffb040', 4);
      return;
    }
    if (pr.kind === 'altarStone') {
      const W = pr.w * TILE;
      g.fillStyle = '#0d0b10'; g.fillRect(x - 1, y - 5, W + 2, 20);
      g.fillStyle = '#5e5664'; g.fillRect(x, y - 4, W, 18);
      g.fillStyle = '#7e7686'; g.fillRect(x, y - 4, W, 3);
      const a = 0.5 + 0.4 * Math.sin(w.t * 2.5);
      g.fillStyle = `rgba(200,140,255,${a})`;
      for (let i = 0; i < 5; i++) g.fillRect(x + 6 + i * 8, y + 3 + (i % 2) * 3, 4, 2);
      if (Math.random() < 0.08) this.parts.push({ x: x + Math.random() * W, y: y - 4, vx: 0, vy: -20, t: 0.8, max: 0.8, color: '#c9a8ff', g: -10 });
    }
  }

  drawWallDeco(w, d) {
    const g = this.g, x = d.x * TILE, y = d.y * TILE;
    if (d.kind === 'torch') {
      g.fillStyle = '#3a2a1a'; g.fillRect(x + 7, y + 6, 2, 6);
      const fl = Math.sin(w.t * 14 + x) * 1;
      g.fillStyle = '#ff7a2a'; g.fillRect(x + 6, y + 2 + fl, 4, 5);
      g.fillStyle = '#ffd040'; g.fillRect(x + 7, y + 3 + fl, 2, 3);
    }
    if (d.kind === 'fountain') {
      const fr = Math.floor(w.t * 6) % 3;
      const top = sprite('wall_fountain_top_1'), mid = sprite(`wall_fountain_mid_${d.c}_anim_f${fr}`), basin = sprite(`wall_fountain_basin_${d.c}_anim_f${fr}`);
      if (top) g.drawImage(top, x, y - TILE); if (mid) g.drawImage(mid, x, y); if (basin) g.drawImage(basin, x, y + TILE);
    }
  }

  // ───────── 조명 / 안개 ─────────
  drawLight(w, cx, cy) {
    const z = w.zone, lg = this.lg, p = w.player, VW = this.VW, VH = this.VH;
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, VW, VH);
    lg.fillStyle = `rgba(6,4,14,${z.dark})`;
    lg.fillRect(0, 0, VW, VH);
    lg.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const gr = lg.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = gr; lg.fillRect(x - cx - r, y - cy - r, r * 2, r * 2);
    };
    const flick = 1 + Math.sin(w.t * 9) * 0.02 + Math.sin(w.t * 23) * 0.015;
    hole(p.x, p.y - 6, 160 * flick);
    const inView = (x, y) => x > cx - 80 && x < cx + VW + 80 && y > cy - 80 && y < cy + VH + 80;
    const colored = [];
    for (const d of this.glowDeco) if (inView(d.x, d.y)) { const [r, c] = GLOW[d.kind]; hole(d.x, d.y - 3, r * (1 + Math.sin(w.t * 3 + d.x) * 0.08), 0.9); colored.push([d.x, d.y - 3, r * 0.8, c]); }
    for (const o of w.objects) if (inView(o.x, o.y)) {
      if (o.kind === 'portal') { hole(o.x, o.y, 70); colored.push([o.x, o.y, 50, o.color]); }
      else if (!o.opened) { hole(o.x, o.y - 6, 30, 0.7); colored.push([o.x, o.y - 6, 22, o.kind === 'lore' ? '#8ad8ff' : '#ffd88a']); }
    }
    for (const pr of w.projs) if (inView(pr.x, pr.y)) { hole(pr.x, pr.y, 24, 0.8); colored.push([pr.x, pr.y, 14, pr.color]); }
    for (const e of w.enemies) {
      if (!inView(e.x, e.y)) continue;
      if (e.st.burn) { hole(e.x, e.y - 8, 30, 0.8); colored.push([e.x, e.y - 8, 22, '#ff7a2a']); }
      if (e.def.elite) hole(e.x, e.y - 10, 44, 0.6);
    }
    for (const dr of w.drops) if (inView(dr.x, dr.y)) hole(dr.x, dr.y, 14, 0.7);
    if (z.liquid === 'lava') {
      const x0 = Math.max(0, Math.floor(cx / TILE) - 2), y0 = Math.max(0, Math.floor(cy / TILE) - 2);
      for (let y = y0; y < Math.min(w.th, y0 + Math.ceil(VH / TILE) + 4); y++) for (let x = x0; x < Math.min(w.tw, x0 + Math.ceil(VW / TILE) + 4); x++) if (w.tiles[y * w.tw + x] === T_LIQUID) { hole(x * TILE + 8, y * TILE + 8, 26, 0.35); }
    }
    lg.globalCompositeOperation = 'lighter';
    for (const [x, y, r, c] of colored) {
      const gr = lg.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r);
      gr.addColorStop(0, hexA(c, 0.22)); gr.addColorStop(1, hexA(c, 0));
      lg.fillStyle = gr; lg.fillRect(x - cx - r, y - cy - r, r * 2, r * 2);
    }
    lg.globalCompositeOperation = 'source-over';
    const g = this.g;
    g.setTransform(this.S, 0, 0, this.S, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.light, 0, 0);
    g.imageSmoothingEnabled = false;
  }

  drawFog(w, cx, cy) {
    const g = this.g, S = this.S;
    g.setTransform(S, 0, 0, S, -cx * S, -cy * S);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.fog, -0.5, -0.5, w.tw, w.th, -TILE / 2, -TILE / 2, w.tw * TILE, w.th * TILE);
    g.imageSmoothingEnabled = false;
  }

  // ───────── 글씨 (실제 해상도) ─────────
  text(s, x, y, n, color, align = 'left', outline = true, bold = false) {
    const g = this.g, size = 11 * n;
    g.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    g.textAlign = align; g.textBaseline = 'middle';
    x = Math.round(x); y = Math.round(y);
    if (outline) {
      g.fillStyle = '#0d0b10';
      const o = Math.max(1, Math.round(n));
      for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) g.fillText(s, x + dx, y + dy);
    }
    g.fillStyle = color; g.fillText(s, x, y);
  }
  sx(x) { return (x - this.cx) * this.S; }
  sy(y) { return (y - this.cy) * this.S; }

  drawTexts(w, dt) {
    const g = this.g, u = this.u;
    g.setTransform(1, 0, 0, 1, 0, 0);
    // 이름표
    if (w.mode === 'plaza') {
      for (const o of w.objects) if (o.npc && o._top != null) this.text(o.npc.name, this.sx(o.x), this.sy(o._top - 5), u, '#ffe8a8', 'center');
      for (const e of w.enemies) if (e.def.ai === 'dummy') {
        this.text(e.def.name, this.sx(e.x), this.sy(e.y + 14), u, '#d8d0e8', 'center');
        if (e.dps > 0) this.text(`DPS ${Math.round(e.dps)}`, this.sx(e.x), this.sy(e.y - 20), u, '#ffcf5a', 'center', true, true);
      }
      for (const o of w.objects) if (o.kind === 'gate') this.text(o.label.split(' (')[0], this.sx(o.x), this.sy(o.y + 12), u, o.color, 'center');
    }
    for (const e of w.enemies) if (e.def.elite && e._top != null && Math.abs(e.x - w.player.x) < 260 && Math.abs(e.y - w.player.y) < 160) {
      this.text(e.def.name, this.sx(e.x), this.sy(e._top - 8), u, '#ff9a8a', 'center', true, true);
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
  }

  // ───────── HUD ─────────
  panel(x, y, w, h) {
    const g = this.g, b = this.u;
    g.fillStyle = '#0d0b10'; g.fillRect(x - b, y - b, w + 2 * b, h + 2 * b);
    g.fillStyle = 'rgba(24,20,34,0.92)'; g.fillRect(x, y, w, h);
    g.fillStyle = '#5a4e72'; g.fillRect(x, y, w, b); g.fillRect(x, y, b, h);
    g.fillStyle = '#120e1a'; g.fillRect(x, y + h - b, w, b); g.fillRect(x + w - b, y, b, h);
  }

  drawHud(w, dt) {
    const g = this.g, p = w.player, d = w.d, u = this.u, S = this.S;
    const W = this.c.width, H = this.c.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const m = 10 * u;
    // 초상화 + 체력
    const pw = 26 * u;
    this.panel(m, m, pw, pw);
    const art = RACE_ART[w.b.race];
    const face = sprite(frames(art.base, 'idle')[0], art.tint || '');
    if (face) { g.imageSmoothingEnabled = false; const fs = Math.floor((pw - 4 * u) / 16); g.drawImage(face, 0, face.height - 24, 16, 16, m + (pw - 16 * fs) / 2, m + (pw - 16 * fs) / 2, 16 * fs, 16 * fs); }
    const bx = m + pw + 6 * u, bw = 110 * u, bh = 10 * u;
    this.panel(bx, m, bw, bh);
    const hpK = Math.max(0, p.hp / d.maxHp);
    g.fillStyle = '#3a1016'; g.fillRect(bx + u, m + u, bw - 2 * u, bh - 2 * u);
    g.fillStyle = '#c8303c'; g.fillRect(bx + u, m + u, (bw - 2 * u) * hpK, bh - 2 * u);
    g.fillStyle = '#ff6a6a'; g.fillRect(bx + u, m + u, (bw - 2 * u) * hpK, 2 * u);
    if (p.shield > 0) { g.fillStyle = '#a8d8ff'; g.fillRect(bx + u, m + bh - 3 * u, (bw - 2 * u) * Math.min(1, p.shield / d.maxHp), 2 * u); }
    this.text(`${Math.ceil(p.hp)} / ${d.maxHp}`, bx + bw / 2, m + bh / 2, u, '#ffffff', 'center');
    // 대시 / 스킬
    const dashMax = d.dashCd * (1 - d.cdr), dashK = Math.min(1, 1 - p.dashCd / dashMax);
    const sy0 = m + bh + 4 * u, box = 14 * u;
    this.cooldownBox(bx, sy0, box, dashK, 'Space', '대시');
    const sk = p.skillCd > 0 ? 1 - p.skillCd / p.skillMax : 1;
    const skName = w.b.weapon.kind === 'melee' ? '회전베기' : w.b.weapon.dmg === 'mag' ? '마력 폭발' : '일제 사격';
    this.cooldownBox(bx + box + 4 * u, sy0, box, sk, 'Q', skName);
    // 상태이상
    const names = { burn: ['화상', '#ff7a2a'], poison: ['중독', '#9be15d'], bleed: ['출혈', '#e0445a'], chill: ['냉기', '#9fe3ff'] };
    let sxx = bx + (box + 4 * u) * 2 + 4 * u;
    for (const k of Object.keys(p.st)) { this.text(names[k][0], sxx, sy0 + box / 2, u, names[k][1]); sxx += 30 * u; }
    if (w.b.race === 'beast' && p.momentum > 0) this.text(`사냥 본능 ×${p.momentum}`, sxx, sy0 + box / 2, u, '#ffcc22');

    if (w.mode === 'field') this.drawMinimap(w);
    else {
      const hint = 'WASD 이동 · 좌클릭 공격 · Q 스킬 · Space 대시 · E 상호작용 · C 캐릭터';
      g.font = `${11 * u}px ${FONT}`;
      const tw2 = g.measureText(hint).width + 20 * u;
      g.fillStyle = 'rgba(13,11,16,0.7)'; g.fillRect((W - tw2) / 2, H - 22 * u, tw2, 16 * u);
      this.text(hint, W / 2, H - 14 * u, u, '#d8d0e8', 'center', false);
    }

    // 상호작용 안내
    if (w.near) {
      const o = w.near;
      const label = o.kind === 'chest' ? `${o.label} 열기` : o.label;
      const top = o._top != null ? o._top : o.kind === 'gate' ? o.y - 40 : o.y - 22;
      const tx = this.sx(o.x), ty = this.sy(top) - 14 * u;
      g.font = `${11 * u}px ${FONT}`;
      const tw2 = g.measureText(label).width + 30 * u;
      this.panel(tx - tw2 / 2, ty - 8 * u, tw2, 16 * u);
      g.fillStyle = '#ffcf5a'; g.fillRect(tx - tw2 / 2 + 3 * u, ty - 5 * u, 10 * u, 10 * u);
      this.text('E', tx - tw2 / 2 + 8 * u, ty, u, '#241a00', 'center', false, true);
      this.text(label, tx + 7 * u, ty, u, '#ffffff', 'center', false);
    }

    // 정예 체력바
    const boss = w.enemies.find((e) => e.def.elite && e.state === 'chase');
    if (boss) {
      const bw2 = Math.min(W * 0.5, 260 * u), bx2 = (W - bw2) / 2, by2 = H - 26 * u;
      this.text(boss.def.name, W / 2, by2 - 9 * u, u, '#ff9a8a', 'center', true, true);
      this.panel(bx2, by2, bw2, 8 * u);
      g.fillStyle = '#3a1016'; g.fillRect(bx2 + u, by2 + u, bw2 - 2 * u, 6 * u);
      g.fillStyle = '#e8483a'; g.fillRect(bx2 + u, by2 + u, (bw2 - 2 * u) * boss.hp / boss.maxHp, 6 * u);
    }

    if (this.banner) {
      this.banner.t -= dt;
      g.globalAlpha = Math.min(1, this.banner.t * 1.5);
      this.text(this.banner.text, W / 2, H * 0.22, 3 * u, this.banner.color, 'center', true, true);
      if (this.banner.sub) this.text(this.banner.sub, W / 2, H * 0.22 + 26 * u, u, '#d8d0e8', 'center');
      g.globalAlpha = 1;
      if (this.banner.t <= 0) this.banner = null;
    }
  }

  cooldownBox(x, y, s, k, key, label) {
    const g = this.g, u = this.u;
    this.panel(x, y, s, s);
    if (k < 1) {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.beginPath(); g.moveTo(x + s / 2, y + s / 2);
      g.arc(x + s / 2, y + s / 2, s * 0.7, -Math.PI / 2 + k * Math.PI * 2, Math.PI * 1.5); g.closePath();
      g.save(); g.beginPath(); g.rect(x + u, y + u, s - 2 * u, s - 2 * u); g.clip();
      g.beginPath(); g.moveTo(x + s / 2, y + s / 2); g.arc(x + s / 2, y + s / 2, s, -Math.PI / 2 + k * Math.PI * 2, Math.PI * 1.5); g.closePath(); g.fill();
      g.restore();
    } else { g.fillStyle = 'rgba(255,207,90,0.18)'; g.fillRect(x + u, y + u, s - 2 * u, s - 2 * u); }
    this.text(key, x + s / 2, y + s / 2, key.length > 1 ? Math.max(1, u - 1) || 1 : u, k >= 1 ? '#ffe8a8' : '#8a8098', 'center', true, true);
  }

  drawMinimap(w) {
    const g = this.g, u = this.u, W = this.c.width;
    const s = u, mw = Math.round(w.tw * s), mh = Math.round(w.th * s);
    const mx = W - mw - 10 * u, my = 10 * u;
    this.panel(mx - 2 * u, my - 2 * u, mw + 4 * u, mh + 4 * u);
    g.fillStyle = '#05040a'; g.fillRect(mx, my, mw, mh);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mini, mx, my, mw, mh);
    const dot = (x, y, c, r = 1.5) => { g.fillStyle = c; g.fillRect(Math.round(mx + (x / TILE) * s - r * u), Math.round(my + (y / TILE) * s - r * u), r * 2 * u, r * 2 * u); };
    const seen = (x, y) => w.explored[Math.floor(y / TILE) * w.tw + Math.floor(x / TILE)];
    for (const o of w.objects) {
      if (!seen(o.x, o.y)) continue;
      if (o.kind === 'portal') dot(o.x, o.y, o.color, 2);
      else if (o.kind === 'chest' && !o.opened) dot(o.x, o.y, o.rich ? '#d8a8ff' : '#ffcf5a');
      else if (o.kind === 'lore' && !o.opened) dot(o.x, o.y, '#8ad8ff');
    }
    for (const e of w.enemies) if (e.def.elite && seen(e.x, e.y)) dot(e.x, e.y, '#ff4040', 2);
    if (Math.floor(w.t * 4) % 2 === 0) dot(w.player.x, w.player.y, '#ffffff', 1.5);
    let y = my + mh + 12 * u;
    this.text(`${w.zone.name} · 탐험 ${Math.round(w.exploredPct() * 100)}%`, mx + mw, y, u, '#d8d0e8', 'right');
    y += 16 * u;
    for (const [id, n] of Object.entries(w.loot.echoes)) {
      this.text(`◆ ${ECHOES[id].name} ${n}`, mx + mw, y, u, ECHOES[id].color, 'right');
      y += 14 * u;
    }
    this.text(`골드 ${w.loot.gold}`, mx + mw, y, u, '#ffcf5a', 'right');
  }
}

function fmt(v) { return v >= 1 ? String(Math.round(v)) : v.toFixed(1); }
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
function disc(g, cx, cy, r) { g.beginPath(); g.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); }
function ellipse(g, cx, cy, rx, ry) { g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); g.fill(); }
// 꼬리는 가늘고 머리(현재 칼끝)는 두꺼운 베기 잔상
function smear(g, x, y, R, thick, a0, a1) {
  if (Math.abs(a1 - a0) < 0.02) return;
  const N = 14, outer = [], inner = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, a = a0 + (a1 - a0) * s;
    const th = thick * Math.pow(s, 0.8);
    outer.push([x + Math.cos(a) * R, y + Math.sin(a) * R]);
    inner.push([x + Math.cos(a) * (R - th), y + Math.sin(a) * (R - th)]);
  }
  g.beginPath();
  g.moveTo(outer[0][0], outer[0][1]);
  for (const [px, py] of outer) g.lineTo(px, py);
  for (let i = inner.length - 1; i >= 0; i--) g.lineTo(inner[i][0], inner[i][1]);
  g.closePath(); g.fill();
}
function crescent(g, x, y, r1, r2, a0, a1, dir) {
  if (Math.abs(a1 - a0) < 0.01) return;
  const ccw = dir < 0;
  g.beginPath();
  g.arc(x, y, r2, a0, a1, ccw);
  g.arc(x, y, r1, a1, a0, !ccw);
  g.closePath(); g.fill();
}

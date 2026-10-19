// 캔버스 렌더러: world 상태를 읽어서 그리기만 한다 (게임 로직 없음)
// 화면 크기에 맞춰 정수 배율(S)로 도트를 키우고, 글씨는 실제 해상도로 따로 그린다.
import { TILE, T_LIQUID, T_WALL, T_CRACK, T_BUILD, T_DEEP } from '../sim/mapgen.js';
import { renderOutdoor, paintTile, drawOutdoorProp } from './outdoor.js';
import { G } from '../data/maps/overworld.js';
import { getSprite, drawEchoGem } from './sprites.js';
import { sprite, frames, atlas } from './assets.js';
import { renderMap, hash } from './tiles.js';
import { ECHOES, AFFIXES } from '../data/monsters.js';
import { WEAPON_SKILLS } from '../data/items.js';
import { SKILLS, ELEM, ROLE_COLOR } from '../data/skills.js';
import { RACES } from '../data/races.js';
import { RACE_ART, MONSTER_ART, NPC_ART, WEAPON_ART } from '../data/art.js';
import { STORY_ITEMS, storyObjective, pinoTalk } from '../data/story.js';
import { sfx } from '../audio.js';

const FONT = 'Galmuri11, "Malgun Gothic", sans-serif';
const GLOW = { glowshroom: [26, '#5affd0'], candle: [30, '#ffb04a'], ember: [18, '#ff7a2a'], crystalB: [22, '#7ad8ff'], crystalR: [22, '#ff5a2a'] };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// 대검 회전 진행도: 앞 40%는 세제곱으로 천천히 가속, 뒤 60%는 관성으로 감속 (두 구간의 속도가 이어지게 맞춤)
// 0~35%: 반대쪽으로 살짝 젖히며 버팀 · 35~60%: 세제곱으로 폭발하듯 가속(던지기) · 60~100%: 관성으로 돌다 급히 느려짐
// (던지기 끝과 관성 시작의 속도가 같도록 7.7제곱으로 맞춤)
export const greatSpin = (k) => (k < 0.35 ? -0.04 * Math.sin((k / 0.35) * Math.PI / 2) : k < 0.6 ? -0.04 + 0.64 * Math.pow((k - 0.35) / 0.25, 3) : 0.6 + 0.4 * (1 - Math.pow(1 - (k - 0.6) / 0.4, 7.7)));
// 용 브레스 목 굽힘: 머리 쪽으로 갈수록 더 많이 돌린다 (몸통 · 다리 · 날개는 그대로)
// u = 그림 기준 가로(0 꼬리 ~ 1 머리), v = 세로. 각도별로 한 번 계산해 둔다
const DRAGON_NECK = { pu: 0.62, pv: 0.6, u0: 0.56, uh: 0.8, vt: 0.21, vb: 0.62 };
const BEND = new Map();
function bendDragon(src, tilt, R, key) {
  const ck = key + '|' + tilt.toFixed(2);
  let c = BEND.get(ck);
  if (c) return c;
  const N = DRAGON_NECK, W = src.width, H = src.height, PAD = 40, SS = 3;
  const sd = src.getContext('2d').getImageData(0, 0, W, H).data;
  c = document.createElement('canvas'); c.width = W + PAD * 2; c.height = H + PAD * 2; c.pad = PAD;
  const cg = c.getContext('2d'), out = cg.createImageData(c.width, c.height), od = out.data, OW = c.width, OH = c.height;
  const rot = R ? tilt : -tilt, pvx = (R ? N.pu : 1 - N.pu) * W, pvy = N.pv * H;
  const wgt = (u, v) => {
    if (u <= N.u0 || (u < N.uh && v < N.vt)) return 0;   // 몸 · 머리 뒤 날개
    let k = Math.min(1, (u - N.u0) / (N.uh - N.u0)); k = k * k * (3 - 2 * k);
    return k * (v < N.vb ? 1 : v > N.vb + 0.1 ? 0 : 1 - (v - N.vb) / 0.1);   // 가슴 아래로는 점점 덜 돈다
  };
  const put = (X, Y, i) => { if (X < 0 || Y < 0 || X >= OW || Y >= OH) return; const o = (Y * OW + X) * 4; od[o] = sd[i]; od[o + 1] = sd[i + 1]; od[o + 2] = sd[i + 2]; od[o + 3] = sd[i + 3]; };
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < W; j++) {
      const x = R ? j : W - 1 - j, u = R ? (x + 0.5) / W : 1 - (x + 0.5) / W;   // 꼬리 → 머리 순서 (머리가 위에 그려진다)
      for (let y = 0; y < H; y++) {
        const i = (y * W + x) * 4;
        if (sd[i + 3] < 128) continue;
        const wt = wgt(u, (y + 0.5) / H);
        if ((wt > 0) !== (pass === 1)) continue;
        if (!pass) { put(x + PAD, y + PAD, i); continue; }
        const an = rot * wt, ca = Math.cos(an), sa = Math.sin(an);
        for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
          const dx = x + (sx + 0.5) / SS - pvx, dy = y + (sy + 0.5) / SS - pvy;
          put(Math.floor(pvx + dx * ca - dy * sa) + PAD, Math.floor(pvy + dx * sa + dy * ca) + PAD, i);
        }
      }
    }
  }
  cg.putImageData(out, 0, 0);
  BEND.set(ck, c);
  return c;
}
const greatSpinSpeed = (k) => (k < 0.35 ? 0 : k < 0.6 ? Math.pow((k - 0.35) / 0.25, 2) : Math.pow(1 - (k - 0.6) / 0.4, 6.7));
// 무기를 쥔 손 색 (종족별)
// 종족별 입 높이 (발 기준, 바람총을 대는 자리)
const MOUTH_Y = { assassin: -6, dragon: -9, knight: -10, wizard: -9, elf: -9, orc: -8, dino: -9, undead: -9, golem: -12 };
const HAND_COLOR = { knight: '#c8d8e8', wizard: '#d8a878', elf: '#f0c8a0', orc: '#6a9a4a', dino: '#5aa84a', undead: '#b8b0c8', assassin: '#3a3040', golem: '#8a8478', dragon: '#e8b48a' };
// 클래스별 마법 색 (속성이 없는 마법)
const CLASS_MAGIC = { chronomancer: '#b98aff', necromancer: '#7ae8ff', hexer: '#c45cff', spiritcaller: '#9bffb0', dragonSage: '#ff9a4a' };
const WORD_NAME = { fire: '불', sky: '하늘', scale: '비늘', wing: '날개', earth: '대지' };
const WORD_COLOR = { fire: '#ff7a2a', sky: '#ffcf5a', scale: '#ffb066', wing: '#bfffd0', earth: '#c8a878' };

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lg = this.light.getContext('2d');
    this.fx = []; this.texts = []; this.parts = []; this.corpses = [];
    this.alerts = new Map(); this.squash = new Map(); this.chestOpen = new Map(); this.lunge = new Map();
    this.shake = 0; this.banner = null; this.hitstop = 0; this.fade = 1; this.hurtFlash = 0; this.flash = null; this.ultName = null;
    this.cam = { x: 0, y: 0 };
    this.world = null; this.lastStep = 0;
    this.resize(document.documentElement.clientWidth || innerWidth, document.documentElement.clientHeight || innerHeight, devicePixelRatio || 1);
  }

  resize(cssW, cssH, dpr) {
    const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    this.c.width = W; this.c.height = H;
    this.S = Math.max(2, Math.round(Math.max(W, H) / 480));
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
    this.mapCanvas = w.map.outdoor ? renderOutdoor(w) : renderMap(w);
    this.fx = []; this.texts = []; this.parts = []; this.corpses = []; this.alerts.clear(); this.squash.clear(); this.chestOpen.clear();
    this.banner = null; this.fade = 1;
    this.cam.x = w.player.x - this.VW / 2; this.cam.y = w.player.y - this.VH / 2;
    this.fog = document.createElement('canvas'); this.fog.width = w.tw; this.fog.height = w.th;
    this.fg = this.fog.getContext('2d');
    this.fg.fillStyle = '#05040a'; this.fg.fillRect(0, 0, w.tw, w.th);
    this.mini = document.createElement('canvas'); this.mini.width = w.tw; this.mini.height = w.th;
    this.mg = this.mini.getContext('2d');
    this.applyReveal(true);
    if (w.zone) this.banner = w.map.outdoor ? { text: w.zone.name, sub: '어디로든 갈 수 있다. 저 멀리 탑이 보인다.', t: 3.6, color: '#ffe8a8' } : { text: `${w.zone.floor}층 · ${w.zone.name}`, sub: '몬스터는 지역마다 무리지어 산다. 탐험하라.', t: 3.2, color: '#ffe8a8' };
    this.glowDeco = w.map.deco.filter((d) => GLOW[d.kind]);
    this.notes = []; this.vista = null;
    if (w.mapKnown) this.knowMap(w);
  }

  // 피노의 지도: 아직 안 가 본 곳도 작은 지도에 흐릿하게
  knowMap(w) {
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.explored[i]) continue;
      const t = w.tiles[i], x = i % w.tw, y = (i / w.tw) | 0;
      if (t === T_WALL) continue;
      this.mg.fillStyle = t === T_LIQUID ? '#24405e' : t === T_CRACK ? '#211b28' : '#4a4038';
      this.mg.fillRect(x, y, 1, 1);
    }
  }

  // 왼쪽에 잠깐 떴다 사라지는 알림 (도감 · 이야기 물건)
  note(text, color) { this.notes.push({ text, color, t: 4 }); if (this.notes.length > 5) this.notes.shift(); }

  levelUp(w, level, pts) {
    const p = w.player;
    this.banner = { text: `레벨 업!  Lv ${level}`, sub: `도감이 채워질수록 강해진다 · 스탯 포인트 +${pts} (광장의 수련 교관)`, t: 4, color: '#ffe080' };
    this.shockwave(p.x, p.y, 60, '#ffe080', 30); this.burst(p.x, p.y - 8, '#ffe080', 40, 140);
    sfx('levelup', { vol: 0.9 });
  }

  // 바깥 세계: 칸 하나와 이웃을 다시 그린다
  repaint(w, k) {
    const g = this.mapCanvas.getContext('2d'), x0 = k % w.tw, y0 = Math.floor(k / w.tw);
    for (let y = y0 - 1; y <= y0 + 1; y++) for (let x = x0 - 1; x <= x0 + 1; x++) if (x >= 0 && y >= 0 && x < w.tw && y < w.th) paintTile(g, w, x, y);
    if (w.explored[k]) w.revealed.push(k);
  }

  applyReveal(all) {
    const w = this.world;
    const paint = (i) => {
      const x = i % w.tw, y = (i / w.tw) | 0, t = w.tiles[i];
      this.fg.clearRect(x, y, 1, 1);
      if (w.map.outdoor) {
        const gr = w.map.ground[i];
        this.mg.fillStyle = t === T_DEEP ? '#2c5a8a' : t === T_LIQUID ? '#4a8ab8' : t === T_WALL || t === T_CRACK ? '#6a5a48' : t === T_BUILD ? '#3e5a2e'
          : ({ [G.DIRT]: '#a8834f', [G.SAND]: '#d8c88e', [G.ROCK]: '#8a9076', [G.SNOW]: '#e8eef4', [G.STONE]: '#b0aca6', [G.FOREST]: '#3d6b2f', [G.BURNT]: '#3a3028', [G.ICE]: '#c4ecf8', [G.BRIDGE]: '#9a6a3c', [G.TALL]: '#4e8a30' })[gr] || '#5d9e3b';
      } else
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
            this.sparkBurst(ev.x, ev.y + 8, ev.crit ? '#ffe060' : '#ffffff', ev.crit ? 10 : 5);
            this.fx.push({ k: 'glow', x: ev.x, y: ev.y + 4, r: ev.crit || ev.heavy ? 22 : 14, color: ev.crit ? '#ffe060' : '#fff4e0', t: 0.12, max: 0.12 });
            this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 8, r: ev.crit || ev.heavy ? 12 : 8, color: ev.crit ? '#ffe060' : ev.color, t: 0.12, max: 0.12 });
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
        case 'swing': {
          this.fx.push({ k: 'slash', ...ev, t: ev.dur + 0.1, max: ev.dur + 0.1 });
          const col = ev.heavy ? '#ffd050' : ev.type === 'mag' ? '#c9a8ff' : '#e8f0ff';
          for (let i = 0; i < (ev.heavy ? 12 : 6); i++) {
            const a = ev.ang + (Math.random() - 0.5) * (ev.arc || 1.5), rr = ev.range * (0.7 + Math.random() * 0.4);
            this.parts.push({ x: ev.x + Math.cos(a) * rr, y: ev.y - 6 + Math.sin(a) * rr, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, t: 0.25, max: 0.25, color: col, g: 0, line: true });
          }
          if (ev.heavy) { this.shake = Math.max(this.shake, 2); this.burst(ev.x + Math.cos(ev.ang) * 18, ev.y + Math.sin(ev.ang) * 18, '#c8b898', 8, 60); }
          sfx(ev.heavy ? 'heavySwing' : 'swing', { vol: 0.55 });
          break;
        }
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
        case 'strike': this.fx.push({ k: 'claw', ...ev, t: 0.16, max: 0.16 }); this.lunge.set(ev.id, { t: 0.14, ang: ev.ang }); break;
        case 'banner': this.banner = { text: ev.text, sub: ev.sub, t: ev.sub ? 3.5 : 2.5, color: ev.color }; sfx('levelup', { vol: 0.6 }); break;
        case 'hitstop': this.hitstop = Math.max(this.hitstop, ev.v); break;
        case 'alert': this.alerts.set(ev.id, -0.7); break;
        case 'spark': this.sparkBurst(ev.x, ev.y, ev.color, 4); break;
        case 'chest': this.chestOpen.set(`${ev.x},${ev.y}`, 0); this.burst(ev.x, ev.y - 6, ev.rich ? '#d8a8ff' : '#ffe08a', 30, 120); this.shake = 2; sfx('chest', { vol: 0.7 }); sfx('coin', { vol: 0.6 }); break;
        case 'crackHit': this.burst(ev.x, ev.y, '#a89880', 6, 60); this.shake = Math.max(this.shake, 1.5); sfx('crack', { vol: 0.6 }); break;
        case 'region':
          if (ev.vista && ev.first) break; // 전망대는 따로 연출
          this.banner = { text: ev.name, sub: ev.first ? '새 장소 발견 · 도감 +2' : '', t: ev.first ? 3 : 2.2, color: '#e8dcc0' };
          if (ev.first) sfx('levelup', { vol: 0.4, rate: 1.2 });
          break;
        case 'vista': this.vista = { t: 0, name: ev.name }; sfx('levelup', { vol: 0.5, rate: 0.6 }); break;
        case 'codexStage':
          this.note(ev.stage >= 3 ? `도감 · ${ev.name} 완성!` : `도감 · ${ev.name} ${ev.stage}단계 (다음: ${ev.next}마리)`, ev.stage >= 3 ? '#ffe080' : '#c8e8ff');
          this.texts.push({ x: ev.x, y: ev.y - 20, text: ev.stage >= 3 ? '도감 완성' : `도감 ${ev.stage}단계`, color: '#c8e8ff', t: 1.4, vy: -12, vx: 0, label: true });
          sfx('echo', { vol: 0.5, rate: 0.8 });
          break;
        case 'storyItem': {
          const it = STORY_ITEMS[ev.id];
          this.note(`${it.name}${it.max > 1 ? ` ${Math.min(ev.n, it.max)}/${it.max}` : ''}`, it.color);
          this.texts.push({ x: ev.x, y: ev.y - 18, text: '+' + it.name, color: it.color, t: 1.6, vy: -12, vx: 0, label: true });
          this.burst(ev.x, ev.y, it.color, 14, 60);
          if (ev.n === 1 && !this.seenItem?.[ev.id]) { (this.seenItem ||= {})[ev.id] = 1; this.banner = { text: it.name, sub: it.desc, t: 3.5, color: it.color }; }
          sfx('lore', { vol: 0.5 });
          break;
        }
        case 'barrierOpen': this.burst(ev.x, ev.y, ev.look === 'thorn' ? '#6a9a3a' : ev.look === 'bars' ? '#a8885a' : '#8a7a6a', 40, 120); this.shake = 4; sfx('crack', { vol: 0.9, rate: 0.8 }); break;
        case 'locked': sfx('error', { vol: 0.3 }); break;
        case 'aura': this.rimFlash = { color: '#ffd84a', t: 0.6, max: 0.6 }; this.shockwave(ev.x, ev.y, 46, '#ffd84a', 26); this.burst(ev.x, ev.y - 6, '#ffd84a', 30, 120); sfx('reaction', { vol: 0.6, rate: 1.3 }); this.shake = 3; break;
        case 'rage': this.rimFlash = { color: '#ff4030', t: 0.6, max: 0.6 }; this.shockwave(ev.x, ev.y, 46, '#ff4030', 26); this.burst(ev.x, ev.y - 6, '#ff4030', 30, 120); sfx('hitHeavy', { vol: 0.7, rate: 0.7 }); this.shake = 4; break;
        case 'skill': sfx('skill', { vol: 0.55 }); break;
        case 'slam': this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#ffe8a0', t: 0.45, max: 0.45, w: 5 }); this.burst(ev.x, ev.y, '#c8b898', 40, 150); this.shake = 7; sfx('hitHeavy', { vol: 1, rate: 0.6 }); break;
        case 'meteor': this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#c9a8ff', t: 0.6, max: 0.6, w: 6 }); this.burst(ev.x, ev.y, '#c9a8ff', 60, 200); this.burst(ev.x, ev.y, '#ffffff', 20, 120); sfx('reaction', { vol: 1, rate: 0.7 }); break;
        case 'telegraphCircle': this.fx.push({ k: 'tcircle', x: ev.x, y: ev.y, r: ev.r, t: ev.dur, max: ev.dur, follow: ev.follow }); break;
        case 'noMana':
          if ((this.noManaT || 0) < w.t) { this.noManaT = w.t + 1; this.texts.push({ x: ev.x, y: ev.y - 22, text: '마나 부족', color: '#7aa8ff', t: 0.9, vy: -14, vx: 0, label: true }); sfx('error', { vol: 0.3 }); }
          break;
        case 'fuse': this.alerts.set(ev.id, 0.55); sfx('windup', { vol: 0.6, rate: 1.6 }); break;
        case 'emerge': this.burst(ev.x, ev.y + 2, '#8a7a5a', 18, 90); sfx('crack', { vol: 0.5, rate: 1.3 }); break;
        case 'summon': this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: 26, color: '#c45cff', t: 0.4, max: 0.4, w: 2 }); this.burst(ev.x, ev.y, '#c45cff', 12, 60); break;
        case 'camp': this.burst(ev.x, ev.y - 4, '#ffd88a', 16, 60); sfx('levelup', { vol: 0.4 }); break;
        case 'skillFx': this.skillFx(ev); break;
        case 'soulGet': {
          const pl = w.player;
          for (let i = 0; i < 10; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 8, y: ev.y - 6, vx: (pl.x - ev.x) * 1.6 + (Math.random() - 0.5) * 40, vy: (pl.y - ev.y) * 1.6 - 40, t: 0.6, max: 0.6, color: '#7ae8ff', g: 60 });
          this.texts.push({ x: ev.x, y: ev.y - 20, text: `영혼 ${ev.n}/10`, color: '#7ae8ff', t: 0.9, vy: -14, vx: 0, label: true });
          sfx('echo', { vol: 0.35, rate: 1.4 });
          break;
        }
        case 'tauntLink': this.fx.push({ k: 'link', ...ev, color: ev.color || '#c45cff', t: 0.5, max: 0.5 }); break;
        case 'allyHurt': this.sparkBurst(ev.x, ev.y - 6, '#7ae8ff', 3); break;
        case 'lockOn': this.fx.push({ k: 'lock', x: ev.x, y: ev.y, kind: ev.kind, ult: ev.ult, t: ev.dur ? ev.dur + 0.35 : 0.45, max: ev.dur ? ev.dur + 0.35 : 0.45 }); sfx('open', { vol: 0.25, rate: 1.8 }); break;
        case 'fall': this.fx.push({ k: 'fall', x: ev.x, y: ev.y, r: ev.r, kind: ev.kind, t: ev.dur, max: ev.dur }); break;
        case 'lineTele': this.fx.push({ k: 'lineTele', ...ev, t: ev.dur, max: ev.dur }); break;
        case 'skillLine': {
          const col = ev.fx === 'spikes' ? '#c8f0ff' : ev.fx === 'skyfall' ? '#fff0b0' : ev.fx === 'arrowBeam' ? '#e8ffd0' : ELEM[ev.elem]?.color || '#ffffff';
          this.fx.push({ k: 'line', ...ev, color: col, t: ev.ult ? 0.6 : 0.45, max: ev.ult ? 0.6 : 0.45 });
          const n = Math.floor(Math.hypot(ev.x2 - ev.x1, ev.y2 - ev.y1) / 14);
          for (let i = 0; i <= n; i++) this.burst(ev.x1 + (ev.x2 - ev.x1) * i / n, ev.y1 + (ev.y2 - ev.y1) * i / n, col, ev.ult ? 6 : 3, ev.ult ? 140 : 90);
          this.shake = Math.max(this.shake, ev.ult ? 12 : 5); this.hitstop = Math.max(this.hitstop, ev.ult ? 0.14 : 0.05);
          if (ev.ult) this.flash = { color: '255,250,220', t: 0.25, max: 0.25 };
          sfx(ev.fx === 'spikes' ? 'freeze' : 'hitHeavy', { vol: 1, rate: ev.ult ? 0.5 : 0.8 });
          break;
        }
        case 'shatter': this.burst(ev.x, ev.y - 6, '#e0f8ff', 18, 160); this.fx.push({ k: 'shards', x: ev.x, y: ev.y, r: 16, color: '#e0f8ff', t: 0.35, max: 0.35, seed: Math.random() * 100 }); sfx('freeze', { vol: 0.7, rate: 1.4 }); break;
        case 'doomMark': this.texts.push({ x: w.enemies.find((e) => e.id === ev.id)?.x || 0, y: (w.enemies.find((e) => e.id === ev.id)?.y || 0) - 26, text: '낙인', color: '#c45cff', t: 1.2, vy: -8, vx: 0, label: true, size: 2 }); break;
        case 'zoneFx': this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r * 1.1, color: ev.kind === 'slow' ? '#b98aff' : ev.kind === 'frost' ? '#c8f0ff' : ev.kind === 'trap' ? '#9be15d' : ev.kind === 'arrows' ? '#ffe080' : '#ff8a3a', t: 0.4, max: 0.4, w: 3 }); break;
        case 'arrowDrop': this.fx.push({ k: 'arrowDrop', x: ev.x, y: ev.y, t: 0.18, max: 0.18 }); if (Math.random() < 0.3) sfx('shoot', { vol: 0.25, rate: 1.6 }); break;
        case 'skillDash': {
          const col = ELEM[ev.elem]?.color || '#ffffff';
          this.fx.push({ k: 'trail', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, color: col, t: 0.35, max: 0.35, w: 10 });
          for (let i = 0; i <= 6; i++) this.burst(ev.x1 + (ev.x2 - ev.x1) * i / 6, ev.y1 + (ev.y2 - ev.y1) * i / 6 - 4, col, 3, 50);
          this.shake = Math.max(this.shake, 2); sfx('dash', { vol: 0.7 }); sfx('swing', { vol: 0.5, rate: 0.8 });
          break;
        }
        case 'blink':
          for (const [x, y] of [[ev.x1, ev.y1], [ev.x2, ev.y2]]) { this.burst(x, y - 6, '#5a4a8a', 18, 70); this.fx.push({ k: 'ring', x, y: y - 4, r: 14, color: '#8a6aff', t: 0.3, max: 0.3, w: 3 }); }
          sfx('dash', { vol: 0.6, rate: 1.4 });
          break;
        case 'skillAoe': this.aoeFx(ev); break;
        case 'skillCone': if (ev.fx === 'sweep') { this.fx.push({ k: 'spin', x: ev.x, y: ev.y, r: ev.range, type: 'phys', t: 0.25, max: 0.25 }); this.shake = Math.max(this.shake, 4); sfx('heavySwing', { vol: 0.9 }); }
          if (ev.fx !== 'breath') this.fx.push({ k: 'cone', ...ev, color: ELEM[ev.elem]?.color || (ev.fx === 'claws' ? '#ffffff' : '#ffb066'), t: 0.22, max: 0.22 });
          if (ev.fx === 'claws') { this.fx.push({ k: 'claws', x: ev.x, y: ev.y, ang: ev.ang + (Math.random() - 0.5) * 0.6, r: ev.range, t: 0.18, max: 0.18 }); sfx('swing', { vol: 0.5, rate: 1.4 }); }
          else if (ev.fx === 'breath') this.flameStream(ev);
          else { this.shake = Math.max(this.shake, 4); sfx('hitHeavy', { vol: 0.8, rate: 0.7 }); }
          break;
        case 'skillSingle': {
          const col = ELEM[ev.elem]?.color || '#ffffff';
          if (ev.fx === 'stab') { this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 2, r: 12, color: '#b89aff', t: 0.15, max: 0.15 }); this.sparkBurst(ev.x, ev.y - 6, '#b89aff', 8); sfx('swing', { vol: 0.5, rate: 1.6 }); break; }
          if (ev.fx === 'slashX') { this.fx.push({ k: 'slashX', x: ev.x, y: ev.y - 6, color: '#b89aff', t: 0.35, max: 0.35 }); this.burst(ev.x, ev.y - 6, '#8a6aff', 30, 160); }
          else if (ev.fx === 'bite') { this.fx.push({ k: 'bite2', x: ev.x, y: ev.y - 6, t: 0.3, max: 0.3 }); this.burst(ev.x, ev.y - 6, '#e0445a', 24, 130); }
          else { this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: 30, color: col, t: 0.35, max: 0.35, w: 4 }); this.burst(ev.x, ev.y - 4, '#c8b898', 24, 140); }
          this.shake = Math.max(this.shake, ev.big ? 7 : 4); this.hitstop = Math.max(this.hitstop, ev.big ? 0.1 : 0.05);
          sfx('hitHeavy', { vol: 1, rate: ev.big ? 0.6 : 0.85 });
          break;
        }
        case 'bolt': this.fx.push({ k: 'bolt', pts: ev.pts, color: ev.color, t: 0.22, max: 0.22, seed: Math.random() * 1000 }); for (const pt of ev.pts.slice(1)) this.sparkBurst(pt.x, pt.y, ev.color, 5); sfx('cast', { vol: 0.5, rate: 2 }); break;
        case 'cast': this.fx.push({ k: 'castCircle', color: ELEM[ev.elem]?.color || CLASS_MAGIC[w.b.cls] || '#9ab8ff', t: ev.dur, max: ev.dur }); sfx('cast', { vol: 0.4, rate: 0.8 }); break;
        case 'parryStance': this.fx.push({ k: 'parryStance', t: ev.dur, max: ev.dur }); sfx('open', { vol: 0.5 }); break;
        case 'parry': this.rimFlash = { color: '#fff6c0', t: 0.4, max: 0.4 }; this.shockwave(ev.x, ev.y, 40, '#fff6c0', 24); this.burst(ev.x, ev.y - 6, '#fff6c0', 30, 160); this.texts.push({ x: ev.x, y: ev.y - 26, text: '받아치기!', color: '#ffe080', t: 1, vy: -14, vx: 0, label: true, size: 2 }); this.shake = 5; sfx('hitArmor', { vol: 1 }); sfx('reaction', { vol: 0.5, rate: 1.5 }); break;
        case 'buff': this.rimFlash = { color: ev.color || '#ffffff', t: 0.5, max: 0.5 }; for (let i = 0; i < 16; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 16, y: ev.y, vx: 0, vy: -40 - Math.random() * 40, t: 0.7, max: 0.7, color: ev.color, g: -10 }); sfx('echo', { vol: 0.5 }); break;
        case 'elemShift': this.fx.push({ k: 'ring', x: ev.x, y: ev.y - 6, r: 24, color: ELEM[ev.elem].color, t: 0.4, max: 0.4, w: 3 }); this.burst(ev.x, ev.y - 6, ELEM[ev.elem].color, 16, 80); this.texts.push({ x: ev.x, y: ev.y - 24, text: `${ELEM[ev.elem].name}${ev.weak ? ' · 약점!' : ''}`, color: ELEM[ev.elem].color, t: 1, vy: -12, vx: 0, label: true }); sfx('open', { vol: 0.5, rate: 1.2 }); break;
        case 'summonFx': { const col = ev.elem ? ELEM[ev.elem].color : ev.kind === 'clone' ? '#8a6aff' : ev.kind === 'skeleton' ? '#e8e0d0' : '#c45cff';
          if (ev.big && !ev.out) { this.fx.push({ k: 'pillar', x: ev.x, y: ev.y, r: 50, color: col, t: 0.8, max: 0.8 }); for (let i = 0; i < 3; i++) this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: 30 + i * 20, color: col, t: 0.5 + i * 0.1, max: 0.5 + i * 0.1, w: 4 }); this.burst(ev.x, ev.y, col, 50, 160); this.shake = 8; } this.burst(ev.x, ev.y, col, ev.out ? 8 : 18, 70); if (!ev.out) { this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: 16, color: col, t: 0.35, max: 0.35, w: 2 }); sfx('echo', { vol: 0.35, rate: 1.3 }); } break; }
        case 'allyHit': this.sparkBurst(ev.x, ev.y - 4, ev.kind === 'clone' ? '#b89aff' : '#c45cff', 4); break;
        case 'noRes':
          if ((this.noResT || 0) < w.t) { this.noResT = w.t + 0.8; this.texts.push({ x: ev.x, y: ev.y - 22, text: ev.text || `${ev.name} 부족`, color: '#ff8a80', t: 0.9, vy: -14, vx: 0, label: true }); sfx('step', { vol: 0.3 }); }
          break;
        case 'focus': this.sparkBurst(ev.x, ev.y - 22, ev.n >= 3 ? '#fff2a0' : '#bfffd0', 3 + ev.n); if (ev.n >= 3) sfx('open', { vol: 0.35, rate: 1.8 }); break;
        case 'chargeStart': sfx('windup', { vol: 0.5, rate: 0.8 }); break;
        case 'chargeLvl': this.rimFlash = { color: ev.lvl >= 3 ? '#fff2a0' : '#ffcf5a', t: 0.3, max: 0.3 }; this.shockwave(ev.x, ev.y, 14 + ev.lvl * 6, '#ffe080', 8 + ev.lvl * 4); sfx('open', { vol: 0.4, rate: 1 + ev.lvl * 0.25 }); if (ev.lvl >= 3) this.shake = Math.max(this.shake, 2); break;
        case 'rushStart': sfx('dash', { vol: 0.7, rate: 0.7 }); this.burst(ev.x, ev.y + 3, '#a89880', 12, 70); break;
        case 'rushDust': this.parts.push({ x: ev.x - ev.dx * 6, y: ev.y + 3, vx: -ev.dx * 40 + (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, t: 0.5, max: 0.5, color: '#a89880', g: 30 }); this.shake = Math.max(this.shake, 1.2); if (Math.random() < 0.5) sfx('step', { vol: 0.35, rate: 0.6 }); break;
        case 'soarUp': this.burst(ev.x, ev.y + 2, '#ffb066', 18, 90); this.fx.push({ k: 'ring', x: ev.x, y: ev.y + 3, r: 22, color: '#ffcf8a', t: 0.35, max: 0.35, w: 3 }); sfx('dash', { vol: 0.7, rate: 0.6 }); break;
        case 'land': this.fx.push({ k: 'ring', x: ev.x, y: ev.y + 3, r: ev.big ? 40 : 24, color: '#e8d8b8', t: 0.4, max: 0.4, w: 4 }); this.burst(ev.x, ev.y + 3, '#a89880', ev.big ? 26 : 12, 140); this.shake = Math.max(this.shake, ev.big ? 7 : 3); this.hitstop = Math.max(this.hitstop, 0.05); sfx('hitHeavy', { vol: 0.9, rate: 0.6 }); break;
        case 'rewind': this.fx.push({ k: 'path', pts: ev.pts, t: 0.6, max: 0.6 }); for (const [x, y] of [[ev.x1, ev.y1], [ev.x2, ev.y2]]) { this.fx.push({ k: 'glow', x, y: y - 8, r: 26, color: '#b98aff', t: 0.5, max: 0.5 }); this.burst(x, y - 6, '#b98aff', 16, 80); } this.flash = { color: '185,138,255', t: 0.2, max: 0.2 }; sfx('reaction', { vol: 0.6, rate: 1.6 }); break;
        case 'echoMark': this.fx.push({ k: 'echo', x: ev.x, y: ev.y, r: ev.r, t: ev.dur, max: ev.dur }); break;
        case 'stealthOn': for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50; this.parts.push({ x: ev.x, y: ev.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, t: 1, max: 1, color: Math.random() < 0.5 ? '#3a3450' : '#5a5478', g: -8 }); } sfx('dash', { vol: 0.5, rate: 0.6 }); break;
        case 'stealthOff': this.sparkBurst(ev.x, ev.y - 8, '#b89aff', 8); break;
        case 'spiritIn': { const col = ELEM[ev.elem].color; this.rimFlash = { color: col, t: 0.5, max: 0.5 }; for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: ev.x + Math.cos(a) * 26, y: ev.y - 8 + Math.sin(a) * 16, vx: -Math.cos(a) * 80, vy: -Math.sin(a) * 50, t: 0.35, max: 0.35, color: col, g: 0, glow: true }); } this.texts.push({ x: ev.x, y: ev.y - 30, text: `${ELEM[ev.elem].name} 정령 ×${ev.n}`, color: col, t: 0.9, vy: -12, vx: 0, label: true }); sfx('echo', { vol: 0.5, rate: 1.2 }); break; }
        case 'spiritOut': this.burst(ev.x, ev.y - 10, ELEM[ev.elem].color, 8, 50); break;
        case 'wordAdd': { const pl = w.player, wd = ev.words[ev.words.length - 1]; this.texts.push({ x: pl.x, y: pl.y - 34, text: WORD_NAME[wd], color: WORD_COLOR[wd], t: 0.8, vy: -14, vx: 0, label: true, size: 2, pop: 0.12 }); sfx('open', { vol: 0.35, rate: 1.4 }); break; }
        case 'sentence': { const txt = ev.words.map((x) => WORD_NAME[x]).join(' · '); this.ultName = { text: `「${txt}」`, color: WORD_COLOR[ev.words[0]], t: 1.1, max: 1.1 }; this.rimFlash = { color: '#ff9a4a', t: 0.6, max: 0.6 }; this.fx.push({ k: 'glow', x: ev.x, y: ev.y - 8, r: 40, color: '#ffb066', t: 0.5, max: 0.5 }); sfx('levelup', { vol: 0.5, rate: 1.1 }); break; }
        case 'block': this.sparkBurst(ev.x, ev.y, '#e8f0ff', ev.small ? 4 : 10); this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 8, r: ev.small ? 7 : 12, color: '#c8d8ff', t: 0.12, max: 0.12 }); sfx('hitArmor', { vol: ev.small ? 0.5 : 0.9 }); if (!ev.small) this.texts.push({ x: ev.x, y: ev.y - 14, text: '막음', color: '#c8d8ff', t: 0.7, vy: -14, vx: 0, label: true }); break;
        case 'bump': this.burst(ev.x, ev.y - 4, '#e8d8b8', 8, 90); sfx('hitHeavy', { vol: 0.6, rate: 0.8 }); break;
        case 'collide': this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 4, r: 16, color: '#ffe8a0', t: 0.18, max: 0.18 }); this.burst(ev.x, ev.y - 6, ev.wall ? '#a89880' : '#ffe8a0', 16, 130); this.texts.push({ x: ev.x, y: ev.y - 20, text: ev.wall ? '쾅!' : '충돌!', color: '#ffe080', t: 0.8, vy: -16, vx: 0, label: true, size: 2, pop: 0.15 }); this.shake = Math.max(this.shake, 5); this.hitstop = Math.max(this.hitstop, 0.06); sfx('hitHeavy', { vol: 1, rate: 0.7 }); sfx('crack', { vol: 0.5 }); break;
        case 'heavySwing': sfx('heavySwing', { vol: 1, rate: 0.6 }); this.burst(ev.x, ev.y + 3, '#9a8a76', 10, 90); break;
        case 'kingPunch': {
          const col = ev.spirit === 'fire' ? '#ff7a26' : ev.spirit === 'wind' ? '#e8f6ff' : '#9ae070';
          this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 2, r: 16, color: col, t: 0.16, max: 0.16 });
          this.fx.push({ k: 'glow', x: ev.x, y: ev.y - 8, r: 30, color: col, t: 0.25, max: 0.25 });
          if (ev.spirit === 'wind') { this.shockwave(ev.x, ev.y, 40, '#e8f6ff', 26); for (let i = 0; i < 10; i++) { const a = Math.atan2(ev.y - ev.fy, ev.x - ev.fx) + (Math.random() - 0.5) * 0.8; this.parts.push({ x: ev.x, y: ev.y - 8, vx: Math.cos(a) * 260, vy: Math.sin(a) * 160, t: 0.3, max: 0.3, color: '#ffffff', g: 0, line: true }); } }
          else if (ev.spirit === 'fire') this.burst(ev.x, ev.y - 6, '#ff7a26', 26, 150);
          else this.burst(ev.x, ev.y - 6, '#9ae070', 18, 110);
          this.shake = Math.max(this.shake, 4); this.hitstop = Math.max(this.hitstop, 0.04);
          sfx('hitHeavy', { vol: 0.9, rate: ev.spirit === 'wind' ? 0.9 : 0.7 });
          break;
        }
        case 'silence': {
          this.rimFlash = { color: '#d8c8ff', t: 0.8, max: 0.8 }; this.shockwave(ev.x, ev.y, ev.r * 0.6, '#d8c8ff', 60);
          this.flash = { color: '200,190,255', t: 0.25, max: 0.25 }; this.shake = Math.max(this.shake, 6);
          this.ultName = { text: '「침묵」', color: '#d8c8ff', t: 1.2, max: 1.2 };
          sfx('reaction', { vol: 0.8, rate: 0.5 });
          break;
        }
        case 'crackBreak': this.burst(ev.x, ev.y, '#a89880', 30, 130); this.shake = 5; if (w.map.outdoor) this.repaint(w, ev.tile); else this.mapCanvas = renderMap(w); sfx('crack', { vol: 1, rate: 0.7 }); break;
        case 'groundChange': this.repaint(w, ev.k); if (w.map.ground[ev.k] === G.ICE) { const x = (ev.k % w.tw) * TILE + 8, y = Math.floor(ev.k / w.tw) * TILE + 8; this.burst(x, y, '#d8f4ff', 3, 30); } break;
        case 'treeBurn': this.burst(ev.x, ev.y - 20, '#ff9a3a', 24, 90); sfx('reaction', { vol: 0.3, rate: 0.8 }); break;
      }
    }
    w.events.length = 0;
    if (w.revealed.length) this.applyReveal(false);
  }

  // 스킬 시작 연출 (시전자 쪽)
  skillFx(ev) {
    const col = ELEM[ev.elem]?.color || '#ffffff';
    if (ev.ult) {
      this.ultName = { text: ev.name, color: col === '#ffffff' ? '#ffd27a' : col, t: 1.4, max: 1.4 };
      this.flash = { color: '255,255,255', t: 0.18, max: 0.18 };
      this.hitstop = Math.max(this.hitstop, 0.12); this.shake = Math.max(this.shake, 6);
      this.rimFlash = { color: col === '#ffffff' ? '#ffd27a' : col, t: 0.8, max: 0.8 };
      this.shockwave(ev.x, ev.y, 90, col === '#ffffff' ? '#ffd27a' : col, 48);
      this.burst(ev.x, ev.y - 6, col, 40, 200);
      sfx('levelup', { vol: 0.7, rate: 0.8 }); sfx('reaction', { vol: 0.8, rate: 0.6 });
      return;
    }
    if (ev.fx === 'charge') this.fx.push({ k: 'chargeGlow', t: 1.0, max: 1.0 });
    if (ev.charge >= 3) { this.flash = { color: '255,240,190', t: 0.12, max: 0.12 }; this.shake = Math.max(this.shake, 5); this.hitstop = Math.max(this.hitstop, 0.06); }
    if (ev.elem && ev.elem !== 'phys') { const c2 = ELEM[ev.elem]?.color || col; this.fx.push({ k: 'glow', x: ev.x + Math.cos(ev.ang) * 14, y: ev.y - 10 + Math.sin(ev.ang) * 10, r: 26, color: c2, t: 0.25, max: 0.25 }); }
    if (ev.fx === 'wind') { for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: ev.x + Math.cos(a) * 20, y: ev.y - 6 + Math.sin(a) * 12, vx: -Math.sin(a) * 90, vy: Math.cos(a) * 50, t: 0.6, max: 0.6, color: '#d8ffe0', g: 0 }); } sfx('dash', { vol: 0.5, rate: 1.3 }); }
    if (ev.fx === 'roar') { this.shockwave(ev.x, ev.y, 70, '#ffcf8a', 36); this.shake = 4; sfx('hitHeavy', { vol: 0.8, rate: 0.55 }); }
    if (ev.fx === 'spin') { this.fx.push({ k: 'spin', x: ev.x, y: ev.y, r: 46, type: 'phys', t: 0.3, max: 0.3 }); }
    this.texts.push({ x: ev.x, y: ev.y - 30, text: ev.name, color: col === '#ffffff' ? '#ffe8a8' : col, t: 0.9, vy: -10, vx: 0, label: true });
  }

  // 범위 스킬 연출 (맞는 쪽)
  aoeFx(ev) {
    const col = ELEM[ev.elem]?.color || '#ffe8a0';
    const fx = ev.fx;
    if (ev.ult) { this.flash = { color: '255,240,210', t: 0.22, max: 0.22 }; this.shake = Math.max(this.shake, 12); this.hitstop = Math.max(this.hitstop, 0.12); }
    if (fx === 'arcane' || fx === 'implode' || fx === 'holy' || fx === 'corpse' || fx === 'doom' || fx === 'shatter' || fx === 'zero' || fx === 'timestop') {
      const c2 = fx === 'holy' ? '#fff0a0' : fx === 'corpse' || fx === 'doom' ? '#c45cff' : fx === 'shatter' || fx === 'zero' ? '#c8f0ff' : '#b98aff';
      for (let i = 0; i < 3; i++) this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r * (0.6 + i * 0.25), color: i === 1 ? '#ffffff' : c2, t: 0.35 + i * 0.1, max: 0.35 + i * 0.1, w: 5 - i });
      if (fx === 'implode' || fx === 'timestop' || fx === 'zero') this.fx.push({ k: 'implode', x: ev.x, y: ev.y, r: ev.r, color: c2, t: 0.4, max: 0.4 });
      if (fx === 'shatter' || fx === 'zero') this.fx.push({ k: 'shards', x: ev.x, y: ev.y, r: ev.r, color: '#e0f8ff', t: 0.7, max: 0.7, seed: Math.random() * 100 });
      if (fx === 'timestop') this.flash = { color: '185,138,255', t: 0.5, max: 0.5 };
      this.burst(ev.x, ev.y, c2, 40, 190); this.burst(ev.x, ev.y, '#ffffff', 14, 120);
      this.shake = Math.max(this.shake, 7); this.hitstop = Math.max(this.hitstop, 0.07);
      sfx(fx === 'shatter' || fx === 'zero' ? 'freeze' : 'reaction', { vol: 0.9, rate: 0.75 });
      return;
    }
    if (ev.r && fx !== 'taunt' && fx !== 'provoke' && fx !== 'absorb') this.fx.push({ k: 'glow', x: ev.x, y: ev.y - 4, r: ev.r * 1.1, color: col, t: 0.3, max: 0.3 });
    if (fx === 'provoke') { this.rimFlash = { color: '#ffd84a', t: 0.6, max: 0.6 }; this.shockwave(ev.x, ev.y, ev.r * 0.8, '#ffd84a', 40); this.shake = Math.max(this.shake, 3); sfx('hitHeavy', { vol: 0.7, rate: 0.5 }); return; }
    if (fx === 'spread') { this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#c45cff', t: 0.4, max: 0.4, w: 2 }); this.burst(ev.x, ev.y - 6, '#c45cff', 14, 90); sfx('reaction', { vol: 0.4, rate: 0.9 }); return; }
    if (fx === 'absorb') { for (const e of this.world.enemies) if (!e.dead && Math.hypot(e.x - ev.x, e.y - ev.y) < ev.r + e.r) for (let i = 0; i < 3; i++) this.parts.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 8, vx: (ev.x - e.x) * 2.2, vy: (ev.y - 8 - e.y) * 2.2, t: 0.45, max: 0.45, color: '#9bffb0', g: 0, glow: true }); this.fx.push({ k: 'rune', x: ev.x, y: ev.y + 3, r: ev.r * 0.6, color: '#9bffb0', t: 0.3, max: 0.3 }); return; }
    if (fx === 'taunt') { this.fx.push({ k: 'ring', x: ev.x, y: ev.y - 6, r: 34, color: '#c45cff', t: 0.5, max: 0.5, w: 3 }); this.texts.push({ x: ev.x, y: ev.y - 26, text: '!', color: '#ff5a7a', t: 0.8, vy: -10, vx: 0, label: true, size: 2 }); sfx('hitHeavy', { vol: 0.4, rate: 0.6 }); return; }
    if (fx === 'gravity') { this.fx.push({ k: 'gravity', x: ev.x, y: ev.y, r: ev.r, t: 0.5, max: 0.5 }); sfx('cast', { vol: 0.7, rate: 0.5 }); return; }
    if (fx === 'vines' || fx === 'bones' || fx === 'trap') {
      this.fx.push({ k: 'vines', x: ev.x, y: ev.y, r: ev.r, color: fx === 'bones' ? '#e8e0d0' : fx === 'trap' ? '#9be15d' : '#5fbf4a', t: 2, max: 2, seed: Math.random() * 100 });
      this.burst(ev.x, ev.y, fx === 'bones' ? '#e8e0d0' : '#7be38a', 24, 110);
      sfx('crack', { vol: 0.7, rate: 1.3 }); return;
    }
    if (fx === 'smoke') { for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 60; this.parts.push({ x: ev.x, y: ev.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, t: 1.4, max: 1.4, color: Math.random() < 0.5 ? '#6a6a7a' : '#9a9aaa', g: -6, big: true }); } sfx('dash', { vol: 0.6, rate: 0.7 }); return; }
    if (fx === 'slam' || fx === 'blood') {
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: fx === 'blood' ? '#e0445a' : '#ffe8b0', t: 0.35, max: 0.35, w: 5 });
      if (fx === 'slam') this.fx.push({ k: 'cracks', x: ev.x, y: ev.y, r: ev.r, t: 0.6, max: 0.6, seed: Math.random() * 100 });
      this.burst(ev.x, ev.y, fx === 'blood' ? '#c02030' : '#c8b898', 28, 150);
      this.shake = Math.max(this.shake, 5); sfx('hitHeavy', { vol: 0.9, rate: 0.7 }); return;
    }
    if (fx === 'pillar' || fx === 'meteor') {
      this.fx.push({ k: 'pillar', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.5, max: 0.5 });
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.55, max: 0.55, w: 6 });
      this.burst(ev.x, ev.y, col, 50, 200); this.burst(ev.x, ev.y, '#ffffff', 16, 120);
      this.shake = Math.max(this.shake, 7); this.hitstop = Math.max(this.hitstop, 0.08);
      sfx('reaction', { vol: 0.9, rate: 0.7 });
    } else if (fx === 'quake' || fx === 'smash') {
      this.fx.push({ k: 'cracks', x: ev.x, y: ev.y, r: ev.r, t: 0.8, max: 0.8, seed: Math.random() * 100 });
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#e8d8b8', t: 0.4, max: 0.4, w: 5 });
      this.burst(ev.x, ev.y, '#a89880', 40, 170);
      this.shake = Math.max(this.shake, 8); sfx('hitHeavy', { vol: 1, rate: 0.5 });
    } else if (fx === 'crystal' || fx === 'ice') {
      this.fx.push({ k: 'shards', x: ev.x, y: ev.y, r: ev.r, color: fx === 'crystal' ? '#c8f0ff' : col, t: 0.5, max: 0.5, seed: Math.random() * 100 });
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#c8f0ff', t: 0.4, max: 0.4, w: 3 });
      sfx('freeze', { vol: 0.8 });
    } else if (fx === 'burst' || fx === 'pop' || fx === 'rocks') {
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.35, max: 0.35, w: 4 });
      this.burst(ev.x, ev.y, fx === 'rocks' ? '#a89880' : col, 26, 140);
      sfx(fx === 'rocks' ? 'crack' : 'reaction', { vol: 0.6, rate: 1.2 });
    } else if (fx === 'roar') {
      // 시전자 연출에서 처리
    } else if (fx === 'spin') {
      this.sparkBurst(ev.x, ev.y - 4, '#ffffff', 6);
    } else {
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.4, max: 0.4, w: 4 });
      this.burst(ev.x, ev.y, col, 24, 120);
      sfx('reaction', { vol: 0.5, rate: 1.1 });
    }
  }

  // 거대 화염구 착탄: 하얀 섬광 → 불의 고리 → 솟는 불기둥 → 연기 · 그을린 땅
  fireballBoom(x, y, r) {
    this.flash = { color: '255,200,140', t: 0.3, max: 0.3 };
    this.shake = Math.max(this.shake, 14); this.hitstop = Math.max(this.hitstop, 0.12);
    this.fx.push({ k: 'glow', x, y: y - 10, r: r * 2, color: '#ffb040', t: 0.6, max: 0.6 });
    this.fx.push({ k: 'scorch', x, y, r: r * 0.9, t: 4, max: 4 });
    for (let i = 0; i < 3; i++) this.fx.push({ k: 'ring', x, y, r: r * (0.7 + i * 0.35), color: i ? '#ff6a1a' : '#fff0c0', t: 0.45 + i * 0.12, max: 0.45 + i * 0.12, w: 6 - i * 2 });
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, d = r * 0.5; this.fx.push({ k: 'pillar', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.55, r: 18, color: '#ff7a2a', t: 0.5 + i * 0.03, max: 0.5 + i * 0.03 }); }
    this.fx.push({ k: 'pillar', x, y, r: r * 0.9, color: '#ffb040', t: 0.6, max: 0.6 });
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 220; this.parts.push({ x, y: y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 60, t: 0.5 + Math.random() * 0.6, max: 1.1, color: ['#ff4a12', '#ff8a2a', '#ffd040', '#fff2c0'][i % 4], g: 120, glow: true, size: 2 }); }
    for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 60; this.parts.push({ x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.2, vx: Math.cos(a) * s, vy: -20 - Math.random() * 30, t: 1.4, max: 1.4, color: Math.random() < 0.5 ? '#3a3036' : '#5a4e50', g: -12, big: true }); }
    sfx('reaction', { vol: 1, rate: 0.5 }); sfx('hitHeavy', { vol: 1, rate: 0.45 });
  }

  // 땅을 따라 퍼지는 충격: 흙먼지와 빛 조각이 바깥으로 흩어진다 (그려진 고리 없음)
  shockwave(x, y, r, color, n = 30) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2, sp = r * (2.2 + Math.random() * 1.2);
      this.parts.push({ x: x + Math.cos(a) * 6, y: y + 2 + Math.sin(a) * 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55, t: 0.35, max: 0.35, color, g: 0, glow: true, size: 1.5 });
      if (i % 2 === 0) this.parts.push({ x: x + Math.cos(a) * 8, y: y + 3 + Math.sin(a) * 4, vx: Math.cos(a) * sp * 0.5, vy: Math.sin(a) * sp * 0.3 - 10, t: 0.5, max: 0.5, color: '#9a8a76', g: 20, big: true });
    }
  }

  // 불 숨결: 입(용화면 용의 입, 아니면 얼굴 앞)에서 불꽃 덩어리를 뿜는다
  flameStream(ev) {
    const pl = this.world.player, M = atlas.true_dragon_meta;
    const big = !!pl.buffs?.dragonForm && !!M && this.dragonBy != null;
    // 용: 이 순간의 조준으로 고개를 숙인 브레스 자세의 입을 바로 구하고, 입 끝에서 조금 앞에서 뿜는다
    const dm = big ? this.dragonMouthAt(pl, this.dragonBy, 'breath', M.anims.breath.n - 1, this.dragonTilt(Math.cos(ev.ang), Math.sin(ev.ang))) : null;
    const ox = dm ? dm.x + Math.cos(ev.ang) * 3 : ev.x + Math.cos(ev.ang) * 7, oy = dm ? dm.y + Math.sin(ev.ang) * 3 : ev.y - 12 + Math.sin(ev.ang) * 4;
    const reach = ev.range * (big ? 1.4 : 1);
    for (let i = 0; i < (big ? 9 : 6); i++) {
      const a = ev.ang + (Math.random() - 0.5) * ev.angle * 0.8, sp = reach * (2.4 + Math.random() * 1.2);
      this.parts.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.42, max: 0.42, g: -24, flame: true, size: big ? 2.2 : 1.6, color: '#ffffff' });
    }
    if (Math.random() < 0.6) this.parts.push({ x: ox, y: oy, vx: Math.cos(ev.ang) * 200 + (Math.random() - 0.5) * 80, vy: Math.sin(ev.ang) * 200 - 30, t: 0.4, max: 0.4, color: '#ffe080', g: 60, line: true });
    this.fx.push({ k: 'glow', x: ox, y: oy, r: big ? 22 : 14, color: '#ffb040', t: 0.1, max: 0.1 });
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
    if (w.map.outdoor) this.drawOutdoorLife(w, cx, cy);
    this.drawLiquidAnim(w, cx, cy);
    if (w.mode === 'plaza') this.drawPlazaFloor(w);

    for (const z of w.zones || []) {
      const k = Math.min(1, z.t / 0.4);
      if (z.kind === 'slow') {
        g.fillStyle = `rgba(150,110,230,${0.16 * k})`; ellipse(g, z.x, z.y, z.r, z.r * 0.62);
        g.strokeStyle = `rgba(200,170,255,${0.7 * k})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(z.x, z.y, z.r, z.r * 0.62, 0, 0, Math.PI * 2); g.stroke();
        // 시계 바늘
        for (const [len, sp] of [[z.r * 0.7, 0.5], [z.r * 0.45, 2]]) { const a = w.t * sp; g.beginPath(); g.moveTo(z.x, z.y); g.lineTo(z.x + Math.cos(a) * len, z.y + Math.sin(a) * len * 0.62); g.stroke(); }
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillStyle = `rgba(220,200,255,${0.7 * k})`; g.fillRect(z.x + Math.cos(a) * z.r * 0.88 - 1, z.y + Math.sin(a) * z.r * 0.55 - 1, 2, 2); }
        continue;
      }
      if (z.kind === 'trap') {
        g.fillStyle = '#3a3020'; ellipse(g, z.x, z.y, 7, 3.5);
        g.fillStyle = '#c8c0a8'; for (let i = -2; i <= 2; i++) { g.fillRect(z.x + i * 2.5 - 0.5, z.y - 3, 1, 3); }
        g.fillStyle = `rgba(155,225,93,${0.3 + 0.2 * Math.sin(w.t * 6)})`; disc(g, z.x, z.y - 1, 1.5);
        continue;
      }
      if (z.kind === 'arrows') {
        g.fillStyle = `rgba(40,30,10,${0.18 * k})`; ellipse(g, z.x, z.y, z.r, z.r * 0.6);
        g.strokeStyle = `rgba(255,224,128,${0.5 * k})`; g.lineWidth = 1; g.beginPath(); g.ellipse(z.x, z.y, z.r, z.r * 0.6, 0, 0, Math.PI * 2); g.stroke();
        continue;
      }
      if (z.kind === 'frost') {
        g.fillStyle = `rgba(170,225,255,${0.22 * k})`; ellipse(g, z.x, z.y, z.r, z.r * 0.6);
        for (let i = 0; i < 6; i++) { const a = i * 1.05 + z.x; g.fillStyle = `rgba(230,250,255,${0.6 * k})`; g.fillRect(z.x + Math.cos(a) * z.r * 0.6, z.y + Math.sin(a) * z.r * 0.35, 2, 2); }
        if (Math.random() < 0.2) this.parts.push({ x: z.x + (Math.random() - 0.5) * z.r * 1.6, y: z.y + (Math.random() - 0.5) * z.r, vx: 0, vy: -10, t: 0.8, max: 0.8, color: '#e8f8ff', g: -2 });
        continue;
      }
      if (z.kind === 'inferno') {
        g.fillStyle = `rgba(255,90,20,${0.22 * k})`; ellipse(g, z.x, z.y, z.r, z.r * 0.62);
        g.fillStyle = `rgba(255,200,60,${0.12 * k})`; ellipse(g, z.x, z.y, z.r * 0.7, z.r * 0.42);
        for (let i = 0; i < 3; i++) this.parts.push({ x: z.x + (Math.random() - 0.5) * z.r * 1.8, y: z.y + (Math.random() - 0.5) * z.r * 1.1, vx: 0, vy: -50 - Math.random() * 40, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd040', g: -40 });
        continue;
      }
      if (z.kind === 'sanctuary') {
        g.fillStyle = `rgba(255,230,140,${0.12 * k})`; ellipse(g, z.x, z.y, z.r, z.r * 0.6);
        g.strokeStyle = `rgba(255,230,140,${0.6 * k})`; g.lineWidth = 2; g.beginPath(); g.ellipse(z.x, z.y, z.r, z.r * 0.6, 0, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 8; i++) { const a = w.t * 0.6 + i * 0.785; g.fillStyle = `rgba(255,240,180,${0.8 * k})`; g.fillRect(z.x + Math.cos(a) * z.r * 0.85 - 1, z.y + Math.sin(a) * z.r * 0.51 - 1, 3, 3); }
        if (Math.random() < 0.3) this.parts.push({ x: z.x + (Math.random() - 0.5) * z.r * 1.6, y: z.y + (Math.random() - 0.5) * z.r, vx: 0, vy: -30, t: 0.8, max: 0.8, color: '#fff0b0', g: -5 });
      } else {
        const col = z.kind === 'fog' ? [140, 70, 200] : z.kind === 'poison' ? [140, 220, 90] : [255, 120, 40];
        g.fillStyle = `rgba(${col},${0.22 * k})`; disc(g, z.x, z.y, z.r);
        for (let i = 0; i < 5; i++) { const a = w.t * 0.8 + i * 1.3; g.fillStyle = `rgba(${col},${0.3 * k})`; disc(g, z.x + Math.cos(a) * z.r * 0.55, z.y + Math.sin(a * 1.3) * z.r * 0.4, 4 + (i % 3)); }
        if (z.kind === 'fire' && Math.random() < 0.5) this.parts.push({ x: z.x + (Math.random() - 0.5) * z.r, y: z.y, vx: 0, vy: -40, t: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd040', g: -30 });
      }
    }
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
    for (const al of w.allies || []) list.push({ al, y: al.y });
    if (w.map.props) for (const pr of w.map.props) { const px = (pr.x + pr.w / 2) * TILE, py = (pr.y + pr.h) * TILE; if (vis(px, py - 40) || pr.kind === 'tower') list.push({ prop: pr, y: py - 2 }); }
    if (w.mode === 'plaza') for (const d of w.map.wallDeco) list.push({ wd: d, y: -1e9 + 1 });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.p) this.drawPlayer(w, p, dt);
      else if (it.e) this.drawEnemy(w, it.e, dt);
      else if (it.o) this.drawObject(w, it.o, dt);
      else if (it.dr) this.drawDrop(w, it.dr);
      else if (it.c) this.drawCorpse(it.c, dt);
      else if (it.prop) this.drawProp(w, it.prop);
      else if (it.wd) this.drawWallDeco(w, it.wd);
      else if (it.al) this.drawAlly(w, it.al);
    }
    this.corpses = this.corpses.filter((c) => c.t > 0);

    // 고통 연결: 같은 사슬의 적끼리 보라 사슬
    const links = new Map();
    for (const e of w.enemies) if (e.link && !e.dead) { const L = links.get(e.link.id) || []; L.push(e); links.set(e.link.id, L); }
    for (const L of links.values()) for (let i = 1; i < L.length; i++) {
      const a = L[i - 1], b = L[i];
      g.strokeStyle = 'rgba(30,10,40,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(a.x, a.y - 8); g.lineTo(b.x, b.y - 8); g.stroke();
      g.strokeStyle = `rgba(200,110,255,${0.6 + 0.3 * Math.sin(w.t * 8)})`; g.lineWidth = 1; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(a.x, a.y - 8); g.lineTo(b.x, b.y - 8); g.stroke(); g.setLineDash([]);
    }
    for (const pr of w.projs) this.drawProj(pr);
    this.drawFx(w, dt);

    for (const q of this.parts) {
      q.t -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9;
      const a = Math.min(1, (q.t / q.max) * 1.6);
      if (q.flame) {
        // 수명에 따라 커지며 색이 식는다
        const life = q.t / q.max, rr = (q.size || 1.6) * (1 + (1 - life) * 3.2);
        const col = life > 0.78 ? '#fff6d0' : life > 0.58 ? '#ffd040' : life > 0.38 ? '#ff7a1a' : life > 0.2 ? '#d8341a' : '#5a4a48';
        if (life > 0.2) {
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = hexA(col, 0.35); g.fillRect(Math.round(q.x - rr * 1.5), Math.round(q.y - rr * 1.5), Math.ceil(rr * 3), Math.ceil(rr * 3));
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = hexA(col, 0.95); g.fillRect(Math.round(q.x - rr), Math.round(q.y - rr), Math.ceil(rr * 2), Math.ceil(rr * 2));
          if (life > 0.5) { g.fillStyle = hexA('#fffbe8', 0.9); g.fillRect(Math.round(q.x - rr * 0.4), Math.round(q.y - rr * 0.4), Math.max(1, Math.ceil(rr * 0.8)), Math.max(1, Math.ceil(rr * 0.8))); }
        } else { g.fillStyle = hexA(col, life * 2.5); g.fillRect(Math.round(q.x - rr), Math.round(q.y - rr), Math.ceil(rr * 2), Math.ceil(rr * 2)); }
      } else if (q.glow) {
        g.globalCompositeOperation = 'lighter';
        const r = (q.size || 1.5) * (0.6 + 0.4 * a);
        g.fillStyle = hexA(q.color, 0.35 * a); g.fillRect(Math.round(q.x - r * 1.5), Math.round(q.y - r * 1.5), Math.ceil(r * 3), Math.ceil(r * 3));
        g.fillStyle = hexA(q.color, a); g.fillRect(Math.round(q.x - r / 2), Math.round(q.y - r / 2), Math.max(1, Math.round(r)), Math.max(1, Math.round(r)));
        g.globalCompositeOperation = 'source-over';
      } else if (q.line) {
        g.strokeStyle = hexA(q.color, a); g.lineWidth = 1;
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); g.stroke();
      } else if (q.big) { g.fillStyle = hexA(q.color, a * 0.55); const r2 = 2 + (1 - q.t / q.max) * 4; g.fillRect(Math.round(q.x - r2), Math.round(q.y - r2), Math.round(r2 * 2), Math.round(r2 * 2)); }
      else { g.fillStyle = hexA(q.color, a); g.fillRect(Math.round(q.x), Math.round(q.y), q.t > 0.4 ? 2 : 1, q.t > 0.4 ? 2 : 1); }
    }
    this.parts = this.parts.filter((q) => q.t > 0);

    if (w.mode === 'field' && !w.map.outdoor) { this.drawLight(w, cx, cy); this.drawFog(w, cx, cy); } // 바깥 세계는 화면을 가리지 않는다 (안 가 본 곳은 지도에서만)

    this.drawTexts(w, dt);
    this.drawHud(w, dt);

    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.flash) {
      this.flash.t -= dt;
      if (this.flash.t <= 0) this.flash = null;
      else { g.fillStyle = `rgba(${this.flash.color},${0.55 * this.flash.t / this.flash.max})`; g.fillRect(0, 0, this.c.width, this.c.height); }
    }
    if (this.ultName) {
      const un = this.ultName; un.t -= dt;
      if (un.t <= 0) this.ultName = null;
      else {
        const age = un.max - un.t, a = Math.min(1, un.t / 0.3), sc = 1 + Math.max(0, 0.25 - age) * 3;
        const W = this.c.width, H = this.c.height, u = this.u;
        g.fillStyle = `rgba(0,0,0,${0.35 * a})`; g.fillRect(0, H * 0.3 - 18 * u, W, 36 * u);
        g.fillStyle = hexA(un.color, 0.8 * a); g.fillRect(0, H * 0.3 - 18 * u, W * Math.min(1, age * 5), 1.5 * u); g.fillRect(W * (1 - Math.min(1, age * 5)), H * 0.3 + 16.5 * u, W, 1.5 * u);
        g.globalAlpha = a; this.text(un.text, W / 2, H * 0.3, Math.round(3 * u * sc), un.color, 'center', true, true); g.globalAlpha = 1;
      }
    }
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
    if (e.hidden) {
      // 땅속 잠복: 흙더미만 보인다
      const bump = Math.sin(w.t * 3 + e.phase) * 0.6;
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, e.x, e.y + 3, 8, 3);
      g.fillStyle = '#5a4a36'; ellipse(g, e.x, e.y + 1 + bump, 7, 3.5);
      g.fillStyle = '#7a6a4e'; ellipse(g, e.x - 1, e.y + bump, 4, 2);
      e._top = null;
      return;
    }
    const sc = (art.scale || 1) * (e.scale || 1);
    const name = this.animFrame(art.base, e.moving ? 'run' : 'idle', w.t + e.phase, e.moving ? 10 : 6);
    const wind = e.windT > 0;
    const fuse = e.fuse > 0;
    const flash = e.hitFlash > 0 ? true : (wind || fuse) && Math.floor(w.t * (fuse ? 30 : 20)) % 2 ? (fuse ? '#ffffff' : '#ff4040') : false;
    // 그림이 없으면 투명해지지 않도록 고블린 그림으로 대체
    const img = sprite(name, art.tint || '', flash, e.dir < 0) || sprite(frames('goblin', 'idle')[0], '', flash, e.dir < 0);
    if (!img) return;
    let sq = this.squash.get(e.id) || 0;
    if (sq > 0) { sq -= dt; this.squash.set(e.id, sq); }
    const k = Math.max(0, sq) / 0.14;
    const sx = 1 + 0.25 * k, sy = 1 - 0.2 * k;
    let wobble = wind ? (Math.random() - 0.5) * 1.5 : 0;
    // 공격하는 순간 몸을 앞으로 내민다 · 예고 중에는 뒤로 움츠린다
    const lg = this.lunge.get(e.id);
    let lungeY = 0;
    if (lg) { lg.t -= dt; if (lg.t <= 0) this.lunge.delete(e.id); else { const q = Math.sin((lg.t / 0.14) * Math.PI); wobble += Math.cos(lg.ang) * 4 * q; lungeY = Math.sin(lg.ang) * 2 * q; } }
    else if (wind) wobble -= e.dir * 1.5;
    const w0 = img.width * sc * sx, h0 = img.height * sc * sy;
    if (def.elite || e.champion) { g.fillStyle = `rgba(255,60,40,${0.18 + 0.1 * Math.sin(w.t * 4)})`; ellipse(g, e.x, e.y + 3, w0 * 0.55, w0 * 0.2); }
    else if (e.affix) { g.fillStyle = hexA(AFFIXES[e.affix].color, 0.25 + 0.1 * Math.sin(w.t * 5)); ellipse(g, e.x, e.y + 3, w0 * 0.5, w0 * 0.18); }
    if (fuse) { g.fillStyle = `rgba(255,120,60,${0.25 + 0.25 * Math.sin(w.t * 30)})`; disc(g, e.x, e.y, def.boom?.r || 30); }
    this.shadow(e.x, e.y + 3, Math.max(5, img.width * sc * 0.32));
    if (art.ghost) g.globalAlpha = 0.65 + 0.15 * Math.sin(w.t * 3 + e.phase);
    const carryLift = e.carried > 0 ? 18 + (w.player.air || 0) : 0;
    const dx = Math.round(e.x - w0 / 2 + wobble), dy = Math.round(e.y + 4 - h0 - carryLift + lungeY);
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
    if (e.hp < e.maxHp && !def.elite && !e.champion) {
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
    if (e.st.curse) pips.push(['#c45cff', e.st.curse.n]);
    if (e.st.shock > 0) pips.push(['#f8f070', 0]);
    if (e.st.weak > 0) pips.push(['#ff3a3a', 0]);
    if (e.st.fear > 0) pips.push(['#6a8aff', 0]);
    if (e.st.elemMark > 0) { g.strokeStyle = `rgba(232,168,255,${0.5 + 0.3 * Math.sin(w.t * 6)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(e.x, e.y + 3, 10, 4, 0, 0, Math.PI * 2); g.stroke(); }
    if (e.rooted > 0 && e.vineT0 != null) this.drawVines(w, e, dx, dy, w0, h0);
    if (e.st.stun > 0) {
      if (e.prison) { g.fillStyle = 'rgba(190,240,255,0.45)'; g.fillRect(dx - 2, dy - 2, Math.round(w0) + 4, Math.round(h0) + 4); g.strokeStyle = 'rgba(230,250,255,0.9)'; g.lineWidth = 1; g.strokeRect(dx - 2, dy - 2, Math.round(w0) + 4, Math.round(h0) + 4); }
      else for (let i = 0; i < 3; i++) { const a = w.t * 6 + i * 2.1; g.fillStyle = '#ffe060'; g.fillRect(Math.round(e.x + Math.cos(a) * 7), Math.round(dy - 4 + Math.sin(a) * 2), 2, 2); }
    }
    if (e.st.septic > 0) pips.push(['#c8e04a', 0]);
    if (e.silenceT > 0) {
      // 침묵: 머리 위에 입을 막은 표시 (보라 원 + 가로줄)
      const sx2 = Math.round(e.x), sy2 = Math.round(e._top - 16 + Math.sin(w.t * 4) * 1);
      g.fillStyle = '#0d0b10'; g.fillRect(sx2 - 4, sy2 - 4, 9, 9);
      g.fillStyle = '#b8a8ff'; g.fillRect(sx2 - 3, sy2 - 3, 7, 7);
      g.fillStyle = '#2a1a4a'; g.fillRect(sx2 - 2, sy2, 5, 1);
    }
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

  // 덩굴 감기: 네 가닥이 발밑에서 나선으로 올라와 몸을 감싼다 (뒤쪽은 어둡게)
  drawVines(w, e, dx, dy, w0, h0) {
    const g = this.g, age = w.t - e.vineT0, grow = Math.min(1, age / 0.35);
    const fade = Math.min(1, e.rooted / 0.3);
    const top = h0 * 0.85 * easeOut(grow), foot = e.y + 3, rx = Math.max(5, w0 * 0.48);
    for (let s = 0; s < 4; s++) {
      const ph = s * Math.PI / 2 + e.id;
      let px = null, py = null;
      for (let yy = 0; yy <= top; yy += 1.5) {
        const a = ph + yy * 0.32, x = e.x + Math.cos(a) * rx * (1 - yy / (h0 * 2.2)), y = foot - yy;
        const front = Math.sin(a) > -0.1;
        if (px != null) {
          g.strokeStyle = front ? `rgba(18,40,14,${fade})` : `rgba(18,40,14,${0.5 * fade})`; g.lineWidth = 3;
          g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
          g.strokeStyle = front ? `rgba(80,170,60,${fade})` : `rgba(50,100,40,${0.6 * fade})`; g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
          if (front && Math.floor(yy) % 6 === 0) { g.fillStyle = `rgba(140,220,90,${fade})`; g.fillRect(Math.round(x + (Math.cos(a) > 0 ? 1 : -3)), Math.round(y - 1), 2, 2); g.fillStyle = `rgba(200,255,150,${fade})`; g.fillRect(Math.round(x + (Math.cos(a) > 0 ? 1 : -3)), Math.round(y - 1), 1, 1); }
        }
        px = x; py = y;
      }
    }
    // 발밑 흙더미와 뿌리
    g.fillStyle = `rgba(60,44,28,${0.8 * fade})`; ellipse(g, e.x, foot, rx + 3, 3);
    g.fillStyle = `rgba(90,170,60,${0.9 * fade})`; for (let i = -2; i <= 2; i++) g.fillRect(Math.round(e.x + i * rx * 0.45), Math.round(foot - 2), 1, 2);
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
    const soaring = art.base === 'dragonkin' && (p.airT > 0 || p.motion?.kind === 'soar');
    const name = soaring ? this.animFrame('dragonkin', 'soar', w.t, 12) : this.animFrame(art.base, moving ? 'run' : 'idle', moving ? p.walkT : w.t, moving ? 11 : 6);
    if (moving && !(p.air > 0)) {
      const step = Math.floor(p.walkT * 5.5);
      if (step !== this.lastStep) {
        this.lastStep = step; sfx('step', { vol: 0.18, jitter: 0.15 });
        if (p.onLiquid) this.burst(p.x, p.y + 3, '#a8d8ff', 2, 20);
        else for (let i = 0; i < 2; i++) this.parts.push({ x: p.x - p.dir * 2 + (Math.random() - 0.5) * 4, y: p.y + 4, vx: -p.dir * (8 + Math.random() * 10), vy: -6 - Math.random() * 6, t: 0.35, max: 0.35, color: '#8a7e70', g: 10, big: true }); // 발 먼지
      }
    }
    const blink = p.invuln > 0 && p.dashT <= 0 && !p.channel && !(p.air > 0) && Math.floor(w.t * 20) % 2 === 0;
    const img = sprite(name, art.tint || '', p.hitFlash > 0 ? '#ff6060' : false, p.dir < 0);
    const pose = this.playerPose(w, p);
    if (img && img.height < 26) pose.hy *= img.height / 26; // 키가 작은 종족은 손도 낮게
    const lift = (p.air || 0) + pose.lift;
    // 몸에 두르는 효과는 타원 대신 실루엣 테두리 빛 + 몸에서 피어오르는 입자로
    const rims = [];
    const bf = Object.values(p.buffs || {}).find((x) => x.color);
    if (bf) { rims.push([bf.color, 0.45 + 0.2 * Math.sin(w.t * 8)]); if (Math.random() < 0.35) this.parts.push({ x: p.x + (Math.random() - 0.5) * 12, y: p.y - Math.random() * 16 - lift, vx: 0, vy: -26 - Math.random() * 20, t: 0.5, max: 0.5, color: bf.color, g: -10, glow: true, size: 1 }); }
    if (p.shield > 0) { rims.push(['#a8d8ff', 0.55]); if (Math.random() < 0.15) this.parts.push({ x: p.x + (Math.random() - 0.5) * 14, y: p.y - 4 - Math.random() * 16 - lift, vx: 0, vy: 0, t: 0.3, max: 0.3, color: '#e8f6ff', g: 0, glow: true, size: 1 }); }
    if (p.parryT > 0) rims.push(['#fff0b0', 0.8]);
    if (p.charging?.lvl >= 3) rims.push(['#ffe080', 0.6 + 0.3 * Math.sin(w.t * 30)]);
    if (this.rimFlash) { this.rimFlash.t -= dt; if (this.rimFlash.t <= 0) this.rimFlash = null; else rims.push([this.rimFlash.color, this.rimFlash.t / this.rimFlash.max]); }
    this.shadow(p.x, p.y + 4, lift > 4 ? Math.max(3, 6 - lift / 8) : 6);
    if (p.stealthT > 0) g.globalAlpha = 0.32 + 0.08 * Math.sin(w.t * 9);
    const gs = p.buffs?.giant ? 1.5 : p.buffs?.dragonForm ? 1.2 : 1;
    const bx = p.x + pose.ox, by = p.y + pose.oy - lift;
    if (p.buffs?.dragonForm) { this.drawTrueDragon(w, p, by); g.globalAlpha = 1; return; }
    if (w.state === 'dead' && img) {
      // 쓰러진 모습: 옆으로 쓰러져 눕는다
      this.deadT = (this.deadT || 0) + dt;
      const k = easeOut(Math.min(1, this.deadT / 0.35));
      g.save(); g.translate(Math.round(p.x), Math.round(p.y + 4)); g.rotate(-p.dir * k * Math.PI / 2);
      g.drawImage(img, -img.width / 2, -img.height + 1); g.restore();
      g.globalAlpha = 1;
      return;
    }
    this.deadT = 0;
    this.weaponTrail(w, p, pose, bx, by, gs);
    if (pose.drag && !p.motion && p.swingT <= 0) {
      // 칼끝이 바닥을 긁는다: 불티 · 흙먼지 · 긁힌 자국
      const tx = bx + p.dir * pose.hx + Math.cos(pose.ang) * 30, ty = by + pose.hy + Math.sin(pose.ang) * 30;
      if (Math.random() < 0.35) this.parts.push({ x: tx, y: ty, vx: -p.dir * (20 + Math.random() * 40), vy: -20 - Math.random() * 30, t: 0.25, max: 0.25, color: Math.random() < 0.6 ? '#ffd27a' : '#fff4d0', g: 220, glow: true, size: 1 });
      if (Math.random() < 0.25) this.parts.push({ x: tx, y: ty + 1, vx: (Math.random() - 0.5) * 10, vy: -8, t: 0.5, max: 0.5, color: '#8a7a66', g: 0 });
      if (Math.random() < 0.5) this.fx.push({ k: 'scrape', x: tx, y: ty + 1, t: 0.6, max: 0.6 });
    }
    if (pose.behind) this.drawWeapon(w, p, pose, bx, by, gs);
    if (!blink && img && rims.length) {
      const [col, a] = rims[rims.length - 1];
      const sil = sprite(name, art.tint || '', col, p.dir < 0);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= Math.max(0, Math.min(1, a));
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.drawBody(sil, bx + ox, by + oy, gs, pose, p.dir);
      g.restore();
    }
    if (!blink && img) this.drawBody(img, bx, by, gs, pose, p.dir);
    if (!pose.behind) this.drawWeapon(w, p, pose, bx, by, gs);
    g.globalAlpha = 1;
    this.drawPlayerExtras(w, p, bx, by - (img ? img.height * gs : 24) + 4);
  }

  // 용화: 날갯짓하는 붉은 용. 숨결은 입에서 나온다
  // 용화: 대기 · 걷기 · 달리기 · 비행 · 할퀴기(일반 공격) · 브레스 · 피격 프레임
  // 용의 입 위치: 그림에서 머리 쪽 맨 끝 열(위아래 턱 끝)의 가운데 = 벌린 입 (프레임마다 한 번만 찾음) → 목을 굽힌 만큼 돌린다
  dragonMouthAt(p, by, anim, f, tilt) {
    const M = atlas.true_dragon_meta, sc = M.scale || 1, dw = Math.round(M.w * sc), dh = Math.round(M.h * sc);
    const x0 = Math.round(p.x - dw / 2), y0 = Math.round(by + 6 - dh), R = p.dir > 0, rot = R ? tilt : -tilt;
    const U = (u) => (R ? x0 + u * dw : x0 + (1 - u) * dw);
    const key = `${anim}_${f}`;
    let mo = (this.mouthCache ||= {})[key];
    if (!mo) {
      const src = sprite(`true_dragon_${anim}_anim_f${f}`), W = src.width, H = src.height, lim = Math.floor(H * 0.6);
      const d = src.getContext('2d').getImageData(0, 0, W, H).data;
      let best = -1, ys = [];
      for (let y = 0; y < lim; y++) for (let x = W - 1; x > best - 1; x--) {
        if (d[(y * W + x) * 4 + 3] < 128) continue;
        if (x > best) { best = x; ys = [y]; } else ys.push(y);
        break;
      }
      mo = this.mouthCache[key] = { u: (best - 2) / W, v: ys.reduce((s, y) => s + y, 0) / Math.max(1, ys.length) / H };
    }
    const pvx = U(DRAGON_NECK.pu), pvy = y0 + dh * DRAGON_NECK.pv, mx0 = U(mo.u), my0 = y0 + mo.v * dh;
    return { x: pvx + (mx0 - pvx) * Math.cos(rot) - (my0 - pvy) * Math.sin(rot), y: pvy + (mx0 - pvx) * Math.sin(rot) + (my0 - pvy) * Math.cos(rot) };
  }

  // 브레스 자세에서 목을 얼마나 굽히나 (조준 각도 → 위 · 아래 기울기)
  dragonTilt(ax, ay) { return Math.round(Math.max(-0.35, Math.min(0.8, Math.atan2(ay, Math.abs(ax)))) / 0.07) * 0.07; }

  drawTrueDragon(w, p, by) {
    const g = this.g, M = atlas.true_dragon_meta;
    if (!M) return;
    const A = M.anims, sw = p.swingMax && p.swingT > 0 ? 1 - p.swingT / p.swingMax : -1, mo = p.motion?.kind;
    const born = p.buffs.dragonForm.max - p.buffs.dragonForm.t;
    let anim = 'idle', f = Math.floor(w.t * 10) % A.idle.n;
    if (p.channel || sw >= 0 || mo === 'breath') { anim = 'breath'; f = p.channel || mo === 'breath' || sw > 0.3 ? A.breath.n - 1 : Math.min(A.breath.n - 1, Math.floor((sw / 0.3) * A.breath.n)); }
    else if (mo === 'claw' || mo === 'bite') { anim = 'attack'; f = Math.min(A.attack.n - 1, Math.floor((p.motion.t / p.motion.dur) * A.attack.n)); }
    else if (p.hitFlash > 0) { anim = 'hit'; f = Math.min(A.hit.n - 1, Math.floor((1 - p.hitFlash / 0.15) * A.hit.n)); }
    else if (p.airT > 0 || mo === 'soar' || mo === 'leap' || born < 0.5) { anim = 'fly'; f = Math.floor(w.t * 16) % A.fly.n; }
    let phase = 0;
    if (anim === 'idle' && p.moving) {
      anim = this.world.mod('moveSpeed') > 1.15 ? 'run' : 'walk';
      const spd = this.world.d.moveSpeed * this.world.mod('moveSpeed'), cycle = (M.stride?.[anim] || 9) * 4 * (M.scale || 1);   // 한 주기에 몸이 나아가는 거리 = 발이 앞뒤로 가는 거리 × 4 (발이 미끄러지지 않게)
      phase = p.walkT * spd / cycle;                      // 지나간 걸음 주기 수
      f = Math.floor(phase * A[anim].n) % A[anim].n;
      const ddx = p.x - (this.dragonPrevX ?? p.x);
      if (Math.abs(ddx) > 0.01) this.dragonBack = ddx * p.dir < 0;
      if (this.dragonBack) f = A[anim].n - 1 - f;   // 바라보는 반대쪽으로 갈 땐 뒷걸음질
    }
    this.dragonPrevX = p.x;
    const img = sprite(`true_dragon_${anim}_anim_f${f}`, '', false, p.dir < 0);
    if (!img) return;
    const sc = M.scale || 1, dw = Math.round(M.w * sc), dh = Math.round(M.h * sc);
    const step = anim === 'walk' || anim === 'run' ? Math.abs(Math.sin(phase * Math.PI * 2)) : 0;   // 한 주기에 두 번 오르내림
    const lift = anim === 'fly' ? 8 + Math.sin(w.t * 8) * 2 : 0;   // 걸을 때 오르내림은 그림에 들어 있다
    if (step > 0.95 && Math.random() < 0.5) this.burst(p.x - p.dir * 10, by + 5, '#9a8a76', 4, 40);
    const x0 = Math.round(p.x - dw / 2), y0 = Math.round(by + 6 - dh - lift);
    this.glow(p.x, by - 16, 44, '#ff6a2a', 0.3 + 0.12 * Math.sin(w.t * 6));
    if (born < 0.35) { this.g.globalAlpha = born / 0.35; }
    // 브레스: 몸통 · 다리 · 날개는 그대로, 목만 휘고 머리가 조준 쪽(위 · 아래)으로 돈다 (bendDragon)
    const tilt = anim === 'breath' ? this.dragonTilt(p.aimX, p.aimY) : 0;
    const R = p.dir > 0, rot = R ? tilt : -tilt;
    const U = (u) => (R ? x0 + u * dw : x0 + (1 - u) * dw);  // 그림 기준 가로 위치(0 꼬리 · 1 머리) → 화면
    const pvx = U(DRAGON_NECK.pu), pvy = y0 + dh * DRAGON_NECK.pv;
    const drawAll = (im, fk) => {
      if (!tilt) { g.drawImage(im, x0, y0, dw, dh); return; }
      const c = bendDragon(im, tilt, R, fk), kx = dw / im.width, ky = dh / im.height;
      g.drawImage(c, x0 - c.pad * kx, y0 - c.pad * ky, c.width * kx, c.height * ky);
    };
    drawAll(img, `${anim}${f}${R}`);
    if (p.hitFlash > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; drawAll(sprite(`true_dragon_${anim}_anim_f${f}`, '', '#ff6060', p.dir < 0), `${anim}${f}${R}hit`); g.restore(); }
    g.globalAlpha = 1;
    this.dragonBy = by;
    const { x: mx, y: my } = this.dragonMouthAt(p, by, anim, f, tilt);
    if (Math.random() < 0.25) this.parts.push({ x: mx, y: my, vx: p.dir * (10 + Math.random() * 20), vy: -15, t: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd040', g: -30, glow: true, size: 1 });
  }

  // 몸 그리기: 줄마다 정수 칸만큼 밀어서 기울인다 (도트 격자를 깨지 않는 기울임) + 눌림/늘어남
  drawBody(img, x, y, gs, pose, dir) {
    const g = this.g;
    const W = img.width * gs * pose.sx, H = img.height * gs * pose.sy;
    const x0 = Math.round(x - W / 2), y0 = Math.round(y + 5 - H);
    const lean = pose.lean * dir;
    if (Math.abs(lean) < 0.5) { g.drawImage(img, x0, y0, Math.round(W), Math.round(H)); return; }
    const rows = img.height, rh = H / rows;
    for (let r = 0; r < rows; r++) {
      const sh = Math.round(lean * (1 - r / rows));
      g.drawImage(img, 0, r, img.width, 1, x0 + sh, Math.round(y0 + r * rh), Math.round(W), Math.ceil(rh));
    }
  }

  // 자세: 몸(기울기·눌림·위치)과 무기(각도·손 위치). 각도는 바라보는 쪽 기준 (0 = 앞, -π/2 = 위, π/2 = 아래)
  playerPose(w, p) {
    const wpn = w.b.weapon, wa = WEAPON_ART[w.b.weaponId] || {}, dir = p.dir;
    const aimF = Math.atan2(p.aimY, p.aimX * dir); // 조준 방향을 바라보는 쪽 기준으로 (스킬 동작 중에는 조준이 고정됨)
    const breathe = Math.sin(w.t * 3) * 0.04;
    const kind = wa.bow ? 'bow' : wa.great ? 'great' : wa.spear ? 'spear' : wpn.kind === 'proj' && wpn.dmg === 'mag' ? 'staff' : wpn.boomerang ? 'axe' : wpn.kind === 'proj' ? 'tube' : 'melee';
    const P = { lean: 0, ox: 0, oy: 0, sx: 1, sy: 1, lift: 0, a: 0.55 + breathe, hx: 4, hy: -5, behind: false, kind, glow: 0 };
    // 평소 자세
    if (kind === 'great') { P.a = 2.86 + breathe * 0.5; P.hx = -1; P.hy = -5; P.behind = true; } // 칼끝을 뒤쪽 땅에 내려 둔다
    else if (kind === 'staff') { P.a = -1.5 + breathe; P.hx = 5; P.hy = -7; }
    else if (kind === 'spear') { P.a = -1.2 + breathe; P.hx = 5; P.hy = -7; }
    else if (kind === 'tube') { P.a = 1.2 + breathe; P.hx = 4; P.hy = -6; } // 바람총: 옆구리에 비스듬히
    else if (kind === 'axe') { P.a = 0.9 + breathe; P.hx = 4; P.hy = -5; }
    else if (kind === 'bow') { P.a = 0.3 + breathe; P.hx = 4; P.hy = -6; P.bowIdle = true; } // 활: 옆구리에 세워 쥔다
    if (p.moving && p.dashT <= 0) { P.lean = 1; P.oy = Math.abs(Math.sin(p.walkT * 11)) > 0.7 ? -1 : 0; if (kind === 'bow' || kind === 'tube') P.a += Math.sin(p.walkT * 11) * 0.12; }
    if (p.hitFlash > 0) { P.lean -= 2; P.ox -= p.dir * 1; } // 맞으면 움찔
    if (p.dashT > 0) { P.lean = 3; P.sx = 1.08; P.sy = 0.92; }
    if (kind === 'great' && p.moving && p.dashT <= 0) { P.a = 2.86 + Math.sin(p.walkT * 11) * 0.03; P.hx = -1; P.hy = -5; P.behind = true; P.drag = true; P.lean = 1.5; }

    // 평타
    const k = p.swingMax && p.swingT > 0 ? 1 - p.swingT / p.swingMax : -1;
    if (k >= 0 && !p.motion) {
      if (kind === 'spear') {
        // 창: 뒤로 당겼다가 조준 방향으로 곧게 찌른다
        const back = Math.min(1, k / 0.3), fw = k < 0.3 ? 0 : easeOut(Math.min(1, (k - 0.3) / 0.35));
        P.a = aimF; P.hx = k < 0.3 ? 4 - 4 * back : 10 * fw + (1 - fw) * 0; P.hy = -7; P.lean = k < 0.3 ? -1.5 * back : 3 * fw; P.ox = Math.cos(p.swingAng) * (k < 0.3 ? -1 : 3 * fw);
      } else if (kind === 'great') {
        // 무거운 대검을 허리 높이에서 옆으로 돌려 던지듯 휘두른다. th = 바닥 위 방향(0 앞 · π/2 화면 앞쪽 · π 뒤 · -π/2 몸 너머)
        const s = greatSpin(k), th = (Math.PI - 0.5) - Math.PI * 2 * s;
        const c = Math.cos(th), sn = Math.sin(th);
        const v = greatSpinSpeed(k), wind = k < 0.35 ? k / 0.35 : 0;
        const reach = 3.5 + 4.5 * Math.min(1, v);          // 던질 때는 팔을 쭉 뻗는다
        P.a = Math.atan2(sn * 0.3 + 0.1, c);
        P.len = Math.sqrt(c * c + 0.09 * sn * sn);
        // 칼을 손목으로 돌려 날을 세운다: 빨라질수록 면 → 날(얇게), 느려지면 다시 면으로. 폭이 속도를 따라 서서히 바뀐다
        { const tw = Math.min(1, v * 1.4); P.wid = 1 - 0.66 * tw * tw * (3 - 2 * tw); }
        P.hx = reach * c; P.hy = -7 + 1.5 * sn;
        if (k < 0.35) { P.lean = -2.8 * wind; P.sy = 1 - 0.1 * wind; P.ox = -p.dir * 2 * wind + (wind > 0.7 ? (Math.random() - 0.5) * 1.2 : 0); } // 비틀어 버티기 (막바지엔 힘이 들어가 떨림)
        else { P.lean = -2.8 * (1 - Math.min(1, v * 2)) + 4 * Math.min(1, v) * c; P.sy = 0.9 + 0.1 * Math.min(1, (k - 0.35) * 4); P.ox = Math.cos(p.swingAng) * 4 * Math.min(1, v + (k > 0.6 ? 0.3 : 0)); }
        P.behind = sn < -0.15;
        P.whoosh = v;
      } else if (kind === 'melee') {
        const down = p.swingDir > 0, big = kind === 'great';
        const wind = big ? 0.3 : 0.2;
        const from = big ? -2.7 : down ? -2.2 : 1.3, to = big ? 1.4 : down ? 1.2 : -1.9;
        if (k < wind) { const q = k / wind; P.a = from + (down || big ? -0.25 : 0.25) * q; P.lean = -1.5 * q; P.hx = 1; P.hy = big ? -15 : -11; P.sy = 1 + 0.04 * q; }
        else { const q = easeOut((k - wind) / (1 - wind)); P.a = from + (to - from) * q; P.lean = (big ? 3.5 : 2.5) * Math.sin(Math.min(1, q * 1.4) * Math.PI * 0.9); P.ox = Math.cos(p.swingAng) * 2.5 * (1 - q * 0.5); P.oy = Math.sin(p.swingAng) * 1.5; P.hx = 2 + 5 * q; P.hy = (big ? -15 : -11) + (big ? 11 : 6) * q; if (big && q > 0.6) P.sy = 0.9 + 0.1 * (q - 0.6) / 0.4; }
        P.behind = P.a < -1.6 || P.a > 2.2;
        if (wpn.shape === 'thrust') { P.a = aimF; P.hx = k < 0.3 ? 0 : 8 * Math.sin(Math.min(1, (k - 0.3) / 0.4) * Math.PI / 2); P.hy = -7; P.lean = k < 0.3 ? -1 : 2.5; P.ox = Math.cos(p.swingAng) * (k < 0.3 ? -1 : 3); P.behind = false; }
      } else if (kind === 'staff') {
        // 세워 든 지팡이를 뒤로 젖혔다가 조준 방향으로 휘두른다
        if (k < 0.35) { const q = k / 0.35; P.a = -1.5 - 0.6 * q; P.hx = 4; P.hy = -8; P.lean = -1.2 * q; P.glow = q; }
        else { const q = easeOut((k - 0.35) / 0.65); P.a = -2.1 + (aimF + 2.1) * q; P.hx = 4 + 4 * Math.sin(q * Math.PI); P.hy = -8; P.lean = -1.2 + 3 * Math.sin(q * Math.PI * 0.8); P.glow = 1 - q; }
      } else if (kind === 'tube') {
        // 바람총을 입에 대고 분다: 볼이 부풀듯 몸이 살짝 뒤로 젖혀진다
        P.a = aimF; P.hx = 4; P.hy = (MOUTH_Y[w.b.race] ?? -9); P.tubeMouth = true; P.lean = k < 0.4 ? -1.5 : -1.5 + 2 * (k - 0.4); P.sy = k < 0.3 ? 1.03 : 1;
      } else if (kind === 'axe') {
        if (k < 0.35) { P.a = -2.4; P.hx = -2; P.hy = -13; P.lean = -1.5; P.behind = true; }
        else { const q = (k - 0.35) / 0.65; P.a = aimF; P.hx = 7 * (1 - q * 0.5); P.hy = -8; P.lean = 2.5 * (1 - q); }
      }
    }
    if (kind === 'tube' && p.attackHeld && k < 0 && !p.motion) { P.a = aimF; P.hx = 4; P.hy = (MOUTH_Y[w.b.race] ?? -9); P.tubeMouth = true; P.lean = -1; }
    if (kind === 'bow' && (p.attackHeld || p.swingT > 0)) {
      const pull = p.attackHeld && p.atkPeriod && p.swingT <= 0 ? Math.min(1, 1 - p.atkCd / p.atkPeriod) : 0;
      P.a = aimF; P.hx = 12; P.hy = -8; P.pull = pull; P.snap = p.swingT > 0 ? p.swingT / 0.1 : 0; P.aiming = true; P.bowIdle = false; P.lean = -1 * pull;
      P.behind = Math.sin(Math.atan2(p.aimY, p.aimX)) < -0.5;
    }

    // 스킬 동작
    const m = p.motion;
    if (m) this.motionPose(w, p, m, P, aimF);
    if (p.charging) {
      const lvl = p.charging.lvl, sh = lvl >= 3 ? (Math.random() - 0.5) * 1.5 : 0;
      P.lean = -1.5; P.sy = 0.9; P.ox = sh; P.glow = 0.4 + lvl * 0.2;
      if (P.kind === 'great') { P.a = 3.0 + Math.sin(w.t * 30) * 0.02 * lvl; P.hx = -2; P.hy = -5; P.sy = 0.88; P.behind = true; }
      else if (P.kind === 'melee') { P.a = -2.5 + Math.sin(w.t * 30) * 0.03 * lvl; P.hx = -1; P.hy = -12; P.behind = true; }
    }
    if (p.air > 0 && !m) { P.sy = 0.94; P.a = P.kind === 'great' || P.kind === 'melee' ? -1.9 : P.a; }
    P.ang = dir > 0 ? P.a : Math.PI - P.a;
    return P;
  }

  motionPose(w, p, m, P, aimF) {
    const k = Math.min(1, m.t / m.dur), melee = P.kind === 'melee' || P.kind === 'great' || P.kind === 'axe';
    const big = P.kind === 'great';
    const phase = (a, b) => Math.max(0, Math.min(1, (k - a) / (b - a)));
    const set = (o) => Object.assign(P, o);
    switch (m.kind) {
      case 'overhead': if (big) {
        const ease = (q) => (q < 0.5 ? 2 * q * q : 1 - 2 * (1 - q) * (1 - q));
        if (k < 0.25) { const q = k / 0.25; set({ a: 2.86 + 0.16 * q, hx: -1 - q, hy: -5, lean: -1.6 * q, sy: 1 - 0.08 * q, behind: true }); }
        else if (k < 0.45) { const q = Math.pow((k - 0.25) / 0.2, 3); set({ a: 3.02 + (-1.05 - 3.02) * q, hx: -2 + 8 * q, hy: -4 - 7 * q, lean: -1.6 + 3 * q, sy: 0.92 + 0.08 * q, behind: q < 0.25 }); }
        else if (k < 0.6) { const q = Math.pow((k - 0.45) / 0.15, 2); set({ a: -1.05 + 2.45 * q, hx: 6 + q, hy: -11 + 6 * q, lean: 1.4 + 2.6 * q, sy: q > 0.8 ? 0.86 : 1, ox: Math.cos(m.ang) * 3 * q }); }
        else { const q = easeOut((k - 0.6) / 0.4); set({ a: 1.4 + 1.46 * q, hx: 7 - 8 * q, hy: -5, lean: 4 - 2.5 * q, sy: 0.86 + 0.14 * q, behind: 1.4 + 1.46 * q > 2.2 }); }
        if (k >= 0.58 && k < 0.62) P.impact = true;
        break;
      } // falls through for other weapons
      case 'chop': {
        const kk = m.kind === 'chop' ? (k * 3) % 1 : k;
        const up = Math.min(1, kk / 0.4), dn = easeOut(Math.max(0, Math.min(1, (kk - 0.4) / 0.18)));
        if (kk < 0.4) set({ a: (melee ? 0.6 : -1.2) + (-2.75 - (melee ? 0.6 : -1.2)) * easeOut(up), hx: 1, hy: -10 - 6 * up, lean: -2 * up, sy: 1 + 0.07 * up, behind: true });
        else set({ a: -2.75 + (1.45 + 2.75) * dn, hx: 1 + 6 * dn, hy: -16 + 12 * dn, lean: -2 + 5.5 * dn, sy: dn >= 1 ? 0.86 + 0.14 * Math.min(1, (kk - 0.58) / 0.3) : 1.05, ox: Math.cos(m.ang) * 2 * dn, behind: dn < 0.35 });
        if (big && kk >= 0.58 && kk < 0.62) P.impact = true;
        break;
      }
      case 'sweep': case 'slash': {
        const wind = phase(0, 0.3), sw = easeOut(phase(0.3, 0.6));
        if (k < 0.3) set({ a: 0.6 + (2.6 - 0.6) * wind, hx: -1 - 2 * wind, hy: -6, lean: -2 * wind, behind: true, sx: 1 + 0.04 * wind });
        else set({ a: 2.6 - (2.6 + 0.9) * sw, hx: -3 + 11 * Math.sin(sw * Math.PI * 0.8), hy: -6 - 2 * sw, lean: -2 + 5 * sw, ox: Math.cos(m.ang) * 2 * sw, behind: sw < 0.25 });
        break;
      }
      case 'dashSlash': {
        if (k < 0.55) set({ a: 2.4, hx: -2, hy: -6, lean: 3.5, sx: 1.1, sy: 0.9, behind: true });
        else { const q = easeOut(phase(0.55, 0.8)); set({ a: 2.4 - 3.3 * q, hx: -2 + 10 * q, hy: -6, lean: 3 - q, behind: q < 0.3 }); }
        break;
      }
      case 'thrust': case 'stab': {
        const back = phase(0, 0.25), fwd = easeOut(phase(0.25, 0.5));
        set({ a: aimF, hx: k < 0.25 ? -2 * back : -2 + 11 * fwd, hy: -7, lean: k < 0.25 ? -1.5 * back : 3 * fwd, ox: Math.cos(m.ang) * (k < 0.25 ? -back : 3 * fwd) });
        break;
      }
      case 'spin': {
        const a = 0.4 + k * Math.PI * 2;
        set({ a: a, hx: Math.cos(a) * 3, hy: -7, lean: 0, behind: Math.sin(a) < -0.2 && Math.cos(a) < 0.5 });
        if (Math.floor(k * 4) % 2) P.flip = true;
        break;
      }
      case 'dash': case 'charge': case 'bash': {
        const lean = m.kind === 'bash' ? 4 * Math.sin(Math.min(1, k * 2.2) * Math.PI) : 3.5;
        set({ lean, sx: 1.08, sy: 0.92, ox: m.kind === 'bash' ? Math.cos(m.ang) * 3 * Math.sin(k * Math.PI) : 0 });
        if (melee) set({ a: m.kind === 'bash' ? -1.25 : 0.35, hx: m.kind === 'bash' ? 9 : 5, hy: m.kind === 'bash' ? -9 : -5 });
        break;
      }
      case 'headbutt': case 'bite': {
        const q = Math.sin(Math.min(1, k * 1.8) * Math.PI);
        set({ lean: 5 * q, ox: Math.cos(m.ang) * 4 * q, oy: Math.sin(m.ang) * 2 * q, sx: 1 + 0.08 * q, sy: 1 - 0.06 * q });
        if (melee) set({ a: 1.1, hx: 3, hy: -4 });
        break;
      }
      case 'claw': {
        const q = easeOut(phase(0.15, 0.6));
        set({ lean: k < 0.15 ? -1.5 : 3 * (1 - q * 0.3), a: -1.6 + 2.9 * q, hx: 2 + 7 * q, hy: -12 + 7 * q, ox: Math.cos(m.ang) * 2 * q, behind: q < 0.2 });
        break;
      }
      case 'leap': case 'soar': {
        const up = phase(0, 0.15), land = phase(0.8, 1);
        set({ sy: k < 0.15 ? 1 - 0.12 * up : k > 0.85 ? 0.86 + 0.14 * land : 1.04, a: melee ? (k < 0.8 ? -2.2 : -2.2 + 3.6 * easeOut(land * 2)) : -1.4, hx: 2, hy: k < 0.8 ? -15 : -6, lean: k < 0.8 ? -1 : 3, behind: k < 0.8 && melee });
        break;
      }
      case 'throw': case 'throwBig': {
        const wind = m.kind === 'throwBig' ? 0.45 : 0.35;
        if (k < wind) { const q = k / wind; set({ a: -2.5, hx: -3, hy: -13, lean: -2.5 * q, sx: 1 + 0.03 * q, behind: true }); }
        else { const q = easeOut(phase(wind, wind + 0.25)); set({ a: -2.5 + (aimF + 2.5) * q, hx: -3 + 11 * q, hy: -13 + 5 * q, lean: -2.5 + 5.5 * q, ox: Math.cos(m.ang) * 2 * q, sy: m.kind === 'throwBig' && q > 0.8 ? 0.92 : 1 }); }
        break;
      }
      case 'roar': {
        const q = phase(0.25, 0.4);
        if (k < 0.25) set({ lean: -2.5 * (k / 0.25), sy: 1 + 0.06 * (k / 0.25), a: 1.0, hx: 2, hy: -4 });
        else set({ lean: 2 + (k < 0.8 ? (Math.random() - 0.5) * 1.5 : 0), sy: 0.94 + 0.06 * q, a: 1.0, hx: 3, hy: -4, ox: (Math.random() - 0.5) * (k < 0.8 ? 1.2 : 0) });
        break;
      }
      case 'guard': {
        set({ sy: 0.92, lean: 1, a: -1.35, hx: 6, hy: -9, behind: false });
        break;
      }
      case 'power': {
        if (k < 0.3) set({ sy: 1 - 0.14 * (k / 0.3), lean: -1, a: 1.2, hx: 2, hy: -4 });
        else set({ sy: 1.1 - 0.1 * phase(0.3, 1), a: -1.45, hx: 7, hy: -11, lean: -1, glow: 1 - phase(0.3, 1) });
        break;
      }
      case 'stomp': {
        const up = phase(0, 0.4), dn = phase(0.4, 0.55);
        if (k < 0.4) set({ lift: 7 * Math.sin(up * Math.PI / 2), sy: 1.05, a: melee ? -2.3 : P.a, hx: 1, hy: -14, behind: melee });
        else set({ lift: 7 * (1 - dn), sy: dn >= 1 ? 0.82 + 0.18 * phase(0.55, 1) : 1.05, a: melee ? 1.4 : P.a, hx: 6, hy: -4, lean: 2 });
        break;
      }
      case 'breath': {
        set({ lean: 3 + (Math.random() - 0.5), ox: Math.cos(m.ang) * 2, sy: 0.96 });
        break;
      }
      case 'point': set({ a: aimF, hx: 9, hy: -9, lean: 1.5 }); break;
      case 'blow3': {
        const kk = (k * 3) % 1, puff = kk > 0.35 && kk < 0.6;
        set({ a: aimF, hx: 4, hy: MOUTH_Y[w.b.race] ?? -9, tubeMouth: true, lean: puff ? 0.8 : -1.2, sy: puff ? 1 : 1.04 });
        break;
      }
      case 'shoot': {
        const rel = k > 0.45, q = Math.min(1, k / 0.45);
        if (P.kind === 'bow') set({ a: aimF, hx: 12, hy: -8, aiming: true, bowIdle: false, pull: rel ? 0 : q, snap: rel ? Math.max(0, 1 - (k - 0.45) / 0.15) : 0, lean: rel ? 1 - (k - 0.45) : -1.5 * q });
        else if (P.kind === 'tube') set({ a: aimF, hx: 4, hy: (MOUTH_Y[w.b.race] ?? -9), tubeMouth: true, lean: rel ? 0.5 : -1.5 * q, sy: rel ? 1 : 1 + 0.04 * q });
        else set({ a: aimF, hx: rel ? 9 : 4, hy: -9, lean: rel ? 2 : -1 });
        break;
      }
      case 'crouch': set({ sy: 0.82, lean: 1.5 }); break;
      case 'channel': set({ lift: 2 + Math.sin(w.t * 6), sy: 1.03, a: -1.35, hx: 7, hy: -10, glow: 0.8 }); break;
      case 'aim': set({ lean: -1.5, a: aimF, hx: 4, hy: -8, aiming: P.kind === 'bow', pull: Math.min(1, k * 2), bowIdle: false }); break;
      case 'cast': case 'castRelease': {
        const up = phase(0, 0.35), fw = easeOut(phase(0.35, 0.6));
        set({ a: k < 0.35 ? -1.2 + (-0.9 + 1.2) * up : -0.9 + (aimF + 0.9) * fw, hx: k < 0.35 ? 5 + 2 * up : 7 + 3 * fw, hy: k < 0.35 ? -7 - 4 * up : -11 + 3 * fw, lean: k < 0.35 ? -1 : 2 * fw, glow: k < 0.5 ? 1 : 1 - fw });
        break;
      }
      case 'castBig': case 'castBigRelease': {
        const up = easeOut(phase(0, 0.4)), fw = phase(0.55, 0.8);
        set({ a: -1.4 + (aimF + 1.4) * fw * 0.7, hx: 5 + 2 * up + 2 * fw, hy: -8 - 4 * up + 2 * fw, lean: -1.5 * up + 3 * fw, sy: 1 + 0.08 * up - 0.08 * fw, glow: 1 - fw * 0.6, lift: 2 * up * (1 - fw) });
        break;
      }
      case 'castHold': if (P.kind === 'bow' || P.kind === 'tube') { set({ lean: -1.5, a: aimF, hx: P.kind === 'bow' ? 12 : 4, hy: P.kind === 'tube' ? (MOUTH_Y[w.b.race] ?? -9) : -8, aiming: P.kind === 'bow', pull: Math.min(1, m.t / 0.6), bowIdle: false, tubeMouth: P.kind === 'tube' }); break; }
        set({ a: -1.15 + Math.sin(w.t * 12) * 0.05, hx: 7, hy: -10, lean: -1, glow: 1 }); break;
      case 'castBigHold': set({ a: -1.55 + Math.sin(w.t * 10) * 0.05, hx: 6, hy: -13, lean: -1.5, sy: 1.06, glow: 1, lift: 2 + Math.sin(w.t * 8) }); break;
    }
  }

  // 칼끝 궤적: 무기가 빠르게 돌면 그 사이를 초승달 잔상으로 채운다
  weaponTrail(w, p, P, bx, by, gs) {
    if (P.kind === 'bow' || P.kind === 'staff' || P.kind === 'tube') { this.trail = []; return; }
    const len = (P.kind === 'great' ? 34 : 18) * gs * (P.len || 1);
    const hx = bx + p.dir * P.hx * gs, hy = by + P.hy * gs;
    const tip = { x: hx + Math.cos(P.ang) * len, y: hy + Math.sin(P.ang) * len, mx: hx + Math.cos(P.ang) * len * 0.45, my: hy + Math.sin(P.ang) * len * 0.45, a: P.ang };
    const tr = (this.trail ||= []);
    tr.push(tip); if (tr.length > 6) tr.shift();
    if (tr.length < 3) return;
    let turn = 0;
    for (let i = 1; i < tr.length; i++) { let d = tr[i].a - tr[i - 1].a; d = Math.atan2(Math.sin(d), Math.cos(d)); turn += Math.abs(d); }
    if (turn < 0.6) return;
    const g = this.g, col = p.buffs?.charged || P.kind === 'great' ? '#fff2c8' : '#ffffff';
    if (P.kind === 'great' && P.whoosh > 0.5 && Math.random() < 0.6) { const t2 = tr[tr.length - 1]; this.parts.push({ x: t2.x, y: t2.y, vx: (Math.random() - 0.5) * 30, vy: -10, t: 0.25, max: 0.25, color: '#fff4d8', g: 0, line: true }); }
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 1; i < tr.length; i++) {
      const a0 = tr[i - 1], a1 = tr[i], al = (i / tr.length) * Math.min(1, turn / 1.6);
      g.fillStyle = hexA(col, 0.55 * al);
      g.beginPath(); g.moveTo(a0.mx, a0.my); g.lineTo(a0.x, a0.y); g.lineTo(a1.x, a1.y); g.lineTo(a1.mx, a1.my); g.closePath(); g.fill();
    }
    g.restore();
  }

  drawWeapon(w, p, P, bx, by, gs = 1) {
    const g = this.g, dir = p.dir;
    const wa = WEAPON_ART[w.b.weaponId] || WEAPON_ART.rustySword;
    const img = sprite(wa.s, wa.tint || '');
    if (!img) return;
    const ang = P.ang;
    const hx = bx + dir * P.hx * gs, hy = by + P.hy * gs;
    g.save();
    g.translate(Math.round(hx), Math.round(hy));
    if (wa.bow) {
      g.rotate(ang);
      const bh = img.height;
      // 귀 위치까지의 거리 (조준 방향으로 잰 길이)
      const earX = bx - dir * 1, earY = by + (MOUTH_Y[w.b.race] ?? -9) - 2;
      const toEar = Math.max(3, (hx - earX) * Math.cos(ang) + (hy - earY) * Math.sin(ang));
      const back = toEar * (P.pull || 0);
      const gx = -Math.round(img.width * 0.86); // 활 등 가운데가 손에 오게
      const tipX = gx + img.width / 2 + 1;     // 시위가 걸린 활 끝 (그림의 시위 줄)
      const skinB = HAND_COLOR[w.b.race] || '#e8b48a';
      if (P.aiming) { g.save(); g.beginPath(); g.rect(tipX + 0.5, -bh, img.width, bh * 2); g.clip(); g.drawImage(img, gx, Math.round(-bh / 2)); g.restore(); }
      else g.drawImage(img, gx, Math.round(-bh / 2));
      if (P.aiming) {
        const sx = tipX + (-toEar - tipX) * (P.pull || 0) - (P.snap ? Math.sin(P.snap * 12) * 1.2 : 0);
        g.strokeStyle = '#e8e2cf'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(tipX + 0.5, -bh / 2 + 1); g.lineTo(sx, 0); g.lineTo(tipX + 0.5, bh / 2 - 1); g.stroke();
        // 시위를 당기는 손
        const skin2 = HAND_COLOR[w.b.race] || '#e8b48a';
        g.fillStyle = '#16121c'; g.fillRect(Math.round(sx) - 2, -2, 4, 4); g.fillStyle = skin2; g.fillRect(Math.round(sx) - 1, -1, 2, 2);
        if ((P.pull || 0) > 0.15) {
          const ar = sprite('weapon_arrow');
          if (ar) { g.save(); g.translate(sx, 0); g.rotate(Math.PI / 2); g.drawImage(ar, -Math.round(ar.width / 2), -ar.height + 3); g.restore(); }
        }
      }
      // 활 가운데를 쥔 손
      g.fillStyle = '#16121c'; g.fillRect(-2, -2, 4, 4); g.fillStyle = skinB; g.fillRect(-1, -1, 2, 2);
    } else {
      g.rotate(ang + Math.PI / 2);
      const great = wa.great, staff = P.kind === 'staff', spear = P.kind === 'spear';
      if (P.kind === 'tube' && P.tubeMouth) { g.restore(); g.save(); g.translate(Math.round(bx + dir * 2), Math.round(by + P.hy * gs)); g.rotate(ang + Math.PI / 2); g.drawImage(img, Math.round(-img.width / 2), -img.height); g.restore(); g.save(); g.translate(Math.round(hx), Math.round(hy)); g.globalAlpha = 0; }
      const sc = (great || spear ? 1 : staff ? 26 / img.height : Math.min(1, 20 / img.height)) * gs;
      const grip = great ? 7 : staff ? img.height / 2 : spear ? img.height * 0.36 : 2;
      if ((P.len && P.len < 0.999) || P.wid) g.scale(P.wid || 1, P.len || 1);
      g.drawImage(img, Math.round(-img.width * sc / 2), Math.round(-img.height * sc + grip * sc), Math.round(img.width * sc), Math.round(img.height * sc));
    }
    g.restore();
    // 손: 무기를 쥔 주먹 (두 손 무기는 두 개)
    const skin = HAND_COLOR[w.b.race] || '#e8b48a';
    const fist = (x, y) => { g.fillStyle = '#16121c'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); g.fillStyle = skin; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); };
    if (!P.behind && !wa.bow && !(P.kind === 'tube' && P.tubeMouth)) {
      fist(hx, hy);
      if (wa.great || wa.spear) fist(hx + Math.cos(ang) * (wa.spear ? -5 : 4), hy + Math.sin(ang) * (wa.spear ? -5 : 4));
    }
    if (P.kind === 'staff' && P.behind) fist(hx, hy);
    if (P.kind === 'tube' && P.tubeMouth) fist(bx + dir * 2 + Math.cos(ang) * 6, by + P.hy * gs + Math.sin(ang) * 6);
    // 지팡이 끝 빛: 시전할수록 밝아진다
    if (w.b.weapon.dmg === 'mag' && w.b.weapon.kind === 'proj') {
      const len = 12 * gs, tx = hx + Math.cos(ang) * len, ty = hy + Math.sin(ang) * len;
      const col = this.castColor(w, p);
      const k = Math.max(P.glow || 0, p.castT > 0 ? 1 : 0);
      const r = 2 + k * 2.2 + Math.sin(w.t * 12) * 0.4 * k;
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(tx, ty, 0, tx, ty, r * 2.2);
      gr.addColorStop(0, hexA(col, 0.5 + 0.4 * k)); gr.addColorStop(0.4, hexA(col, 0.2 + 0.25 * k)); gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr; g.fillRect(tx - r * 2.2, ty - r * 2.2, r * 4.4, r * 4.4);
      g.fillStyle = hexA(col, 0.9); disc(g, tx, ty, Math.max(1, r * 0.55));
      g.fillStyle = hexA('#ffffff', 0.6 + 0.4 * k); disc(g, tx, ty, Math.max(0.7, r * 0.3));
      g.restore();
      if (k > 0.3 && Math.random() < 0.5 * k) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: tx + Math.cos(a) * 8, y: ty + Math.sin(a) * 8, vx: -Math.cos(a) * 40, vy: -Math.sin(a) * 40, t: 0.25, max: 0.25, color: col, g: 0, glow: true }); }
    }
  }

  castColor(w, p) {
    const sk = p.castSkill?.def;
    const el = sk ? (sk.elem === 'current' ? p.elem : sk.elem) : w.b.cls === 'elementalist' ? p.elem : null;
    return ELEM[el]?.color || CLASS_MAGIC[w.b.cls] || '#c9a8ff';
  }

  // 머리 위 표시: 차지 단계 · 집중 · 용언 단어 · 깃든 정령
  drawPlayerExtras(w, p, x, top) {
    const g = this.g;
    if (p.charging) {
      const c = p.charging, k = Math.min(1, c.t / 1.2);
      for (let i = 0; i < 3; i++) {
        const on = c.lvl > i;
        g.fillStyle = '#0d0b10'; g.fillRect(Math.round(x - 10 + i * 7), Math.round(top - 8), 6, 4);
        g.fillStyle = on ? (c.lvl >= 3 ? '#fff2a0' : '#ffcf5a') : 'rgba(255,207,90,0.25)'; g.fillRect(Math.round(x - 9 + i * 7), Math.round(top - 7), 4, 2);
      }
      if (Math.random() < 0.3 + k * 0.5) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: x + Math.cos(a) * 22, y: top + 12 + Math.sin(a) * 18, vx: -Math.cos(a) * 80, vy: -Math.sin(a) * 80, t: 0.25, max: 0.25, color: '#ffe080', g: 0, glow: true }); }
    }
    if (w.b.cls === 'ranger' && p.focus > 0) {
      for (let i = 0; i < p.focus; i++) { const xx = Math.round(x - (p.focus - 1) * 3 + i * 6), yy = Math.round(top - 6); g.fillStyle = '#0d0b10'; g.fillRect(xx - 2, yy - 3, 5, 6); g.fillStyle = p.focus >= 3 ? '#fff2a0' : '#bfffd0'; g.fillRect(xx - 1, yy - 2, 3, 1); g.fillRect(xx, yy - 1, 1, 3); }
    }
    if (w.b.cls === 'dragonSage') {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const wd = p.words[i], xx = Math.round(x - 10 + i * 7), yy = Math.round(top - 8);
        g.fillStyle = '#0d0b10'; g.fillRect(xx - 1, yy - 1, 7, 7);
        g.fillStyle = wd ? WORD_COLOR[wd] : 'rgba(255,255,255,0.12)'; g.fillRect(xx, yy, 5, 5);
        if (wd) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(xx, yy, 2, 1); }
      }
    }
    // 깃든 정령: 내 주위를 도는 작은 정령 (불꽃 · 바람 · 나뭇잎 빛)
    if (p.spirits?.length) {
      g.save(); g.globalCompositeOperation = 'lighter';
      p.spirits.forEach((s, i) => {
        const a = s.phase + i * (Math.PI * 2 / p.spirits.length);
        const sx = p.x + Math.cos(a) * 15, sy = p.y - 10 + Math.sin(a) * 7 - (p.air || 0);
        const fade = Math.min(1, s.t / 1.5) * (s.t < 2 && Math.floor(w.t * 10) % 2 ? 0.5 : 1);
        const col = ELEM[s.elem].color;
        const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 9);
        gr.addColorStop(0, hexA(col, 0.7 * fade)); gr.addColorStop(1, hexA(col, 0));
        g.fillStyle = gr; g.fillRect(sx - 9, sy - 9, 18, 18);
        g.fillStyle = hexA('#ffffff', 0.9 * fade); disc(g, sx, sy, 1.5);
        if (Math.random() < 0.5) this.parts.push({ x: sx, y: sy, vx: -Math.sin(a) * 20, vy: s.elem === 'fire' ? -30 : Math.cos(a) * 10, t: 0.4, max: 0.4, color: col, g: s.elem === 'forest' ? 20 : -10, glow: true });
      });
      g.restore();
    }
  }

  // 정령왕: 대기 · 이동 · 공격(주먹 내리찍기) 프레임. 나타날 때는 스킬 프레임(회오리 · 용암 폭발 · 뿌리)으로 솟아나고, 사라질 때는 거꾸로 돌려 꺼진다
  drawSpiritKing(w, al, fade) {
    const g = this.g, t = w.t;
    const sp = al.spirit || (al.elem === 'fire' ? 'fire' : al.elem === 'lightning' ? 'wind' : 'forest');
    const M = atlas.king_meta?.[sp];
    if (!M) return;
    const A = M.anims, age = (al.max || 0) - al.t, SK = 0.6;
    let anim = 'idle', f = Math.floor(t * 11 + (al.id || 0)) % A.idle.n;
    if (age < SK) { anim = 'skill'; f = Math.min(A.skill.n - 1, Math.floor((age / SK) * A.skill.n)); }
    else if (al.t < SK) { anim = 'skill'; f = Math.min(A.skill.n - 1, Math.floor((al.t / SK) * A.skill.n)); }
    else if (al.punchT > 0) { anim = 'attack'; f = Math.min(A.attack.n - 1, Math.floor((1 - al.punchT / 0.4) * A.attack.n)); }
    else if (al.moving) { anim = 'walk'; f = Math.floor((al.walk || 0) * 15) % A.walk.n; }
    const img = sprite(`king_${sp}_${anim}_anim_f${f}`, '', false, (al.dir || 1) < 0);
    const glowC = { fire: '#ff6a1a', wind: '#bfe8ff', forest: '#7be38a' }[sp];
    const x = Math.round(al.x), y = Math.round(al.y + 4);
    if (anim !== 'skill') { g.fillStyle = 'rgba(0,0,0,0.32)'; ellipse(g, x, y - 1, 16, 4); }
    this.glow(x, y - 30, 46, glowC, 0.45);
    const ks = M.scale || 1, kw = Math.round(M.w * ks), kh = Math.round(M.h * ks);
    if (img) g.drawImage(img, x - Math.round(kw / 2), y + 2 - kh, kw, kh);
    if (Math.random() < 0.4) {
      const col = sp === 'fire' ? (Math.random() < 0.5 ? '#ff7a26' : '#ffd25a') : sp === 'wind' ? (Math.random() < 0.5 ? '#e8f6ff' : '#9aa8b8') : (Math.random() < 0.5 ? '#9ae070' : '#5aa040');
      const a = Math.random() * Math.PI * 2, d = 16 + Math.random() * 14;
      this.parts.push({ x: x + Math.cos(a) * d, y: y - 30 + Math.sin(a) * d, vx: sp === 'wind' ? -Math.sin(a) * 60 : (Math.random() - 0.5) * 20, vy: sp === 'fire' ? -40 : sp === 'forest' ? 16 : Math.cos(a) * 30, t: 0.6, max: 0.6, color: col, g: sp === 'forest' ? 10 : 0, glow: sp === 'fire', size: 1.5 });
    }
  }

  drawAlly(w, al) {
    const g = this.g, fade = Math.min(1, al.t / 0.5, (al.max - al.t) / 0.3 + 0.2);
    if (al.kind === 'orbitAxe') {
      const img = sprite('weapon_throwing_axe');
      if (img) { g.save(); g.globalAlpha = fade; g.translate(al.x, al.y); g.rotate(w.t * 18 + al.phase); g.drawImage(img, -img.width / 2, -img.height / 2); g.restore(); }
      if (Math.random() < 0.4) this.parts.push({ x: al.x, y: al.y, vx: 0, vy: 0, t: 0.2, max: 0.2, color: '#e8e0f4', g: 0 });
      return;
    }
    if (al.kind === 'spiritKing') { this.drawSpiritKing(w, al, fade); return; }
    if (al.kind === 'spirit') {
      const col = ELEM[al.elem].color;
      g.fillStyle = hexA(col, 0.25 * fade); disc(g, al.x, al.y, 8);
      g.fillStyle = hexA(col, 0.9 * fade); disc(g, al.x, al.y, 4);
      g.fillStyle = hexA('#ffffff', fade); disc(g, al.x - 1, al.y - 1, 1.5);
      if (Math.random() < 0.5) this.parts.push({ x: al.x, y: al.y, vx: (Math.random() - 0.5) * 20, vy: 10, t: 0.4, max: 0.4, color: col, g: 0 });
      return;
    }
    if (al.kind === 'soul') {
      const art = MONSTER_ART[al.defId] || { base: 'goblin' };
      const img2 = sprite(this.animFrame(art.base, 'run', w.t + al.id, 10), 'grayscale(1) brightness(1.3) sepia(1) hue-rotate(150deg) saturate(2.5)', false, al.dir < 0);
      if (img2) {
        const sc = (art.scale || 1) * (al.scale || 1);
        g.globalAlpha = 0.78 * fade;
        g.drawImage(img2, Math.round(al.x - img2.width * sc / 2), Math.round(al.y + 4 - img2.height * sc), img2.width * sc, img2.height * sc);
        g.globalAlpha = 1;
        if (al.tauntT > 0) { g.strokeStyle = `rgba(196,92,255,${0.5 + 0.3 * Math.sin(w.t * 10)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(al.x, al.y + 3, 10, 4, 0, 0, Math.PI * 2); g.stroke(); }
        const bw = 16, by = Math.round(al.y + 4 - img2.height * sc - 5);
        g.fillStyle = '#0d0b10'; g.fillRect(al.x - bw / 2 - 1, by - 1, bw + 2, 4);
        g.fillStyle = '#7ae8ff'; g.fillRect(al.x - bw / 2, by, Math.max(0, bw * al.hp / al.maxHp), 2);
      }
      if (Math.random() < 0.2) this.parts.push({ x: al.x + (Math.random() - 0.5) * 10, y: al.y - 6, vx: 0, vy: -20, t: 0.5, max: 0.5, color: '#7ae8ff', g: -10 });
      return;
    }
    const base = al.kind === 'lich' ? 'big_zombie' : al.kind === 'clone' ? RACE_ART[w.b.race].base : al.kind === 'skeleton' ? 'skelet' : 'necromancer';
    const tint = al.kind === 'skeleton' ? 'brightness(1.1)' : al.kind === 'lich' ? 'hue-rotate(220deg) saturate(1.4) brightness(0.9)' : al.kind === 'clone' ? 'brightness(0.25) saturate(0) contrast(1.4)' : 'grayscale(0.6) brightness(1.4) hue-rotate(180deg)';
    const img = sprite(this.animFrame(base, 'run', w.t + al.id, 10), tint, false, al.dir < 0);
    if (!img) return;
    g.globalAlpha = (al.kind === 'clone' ? 0.75 : 0.7) * fade;
    const sc = al.kind === 'lich' ? 1.1 : 1;
    g.drawImage(img, Math.round(al.x - img.width * sc / 2), Math.round(al.y + 4 - img.height * sc + Math.sin(w.t * 4 + al.id) * 1.5), img.width * sc, img.height * sc);
    g.globalAlpha = 1;
    if (Math.random() < 0.15) this.parts.push({ x: al.x, y: al.y - 4, vx: 0, vy: -20, t: 0.5, max: 0.5, color: al.kind === 'clone' ? '#8a6aff' : '#c45cff', g: -10 });
  }

  drawProj(pr) {
    const g = this.g;
    if (pr.kind === 'rock') {
      g.fillStyle = '#0d0b10'; disc(g, pr.x, pr.y, 6.5); g.fillStyle = '#8a7a66'; disc(g, pr.x, pr.y, 5.5); g.fillStyle = '#b0a088'; disc(g, pr.x - 1.5, pr.y - 1.5, 2.5);
      if (Math.random() < 0.4) this.parts.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.3, max: 0.3, color: '#a89880', g: 40 });
      return;
    }
    if (pr.skind === 'axe' || pr.skind === 'harpoon') {
      const img = sprite(pr.skind === 'axe' ? 'weapon_throwing_axe' : 'weapon_spear');
      if (img) { g.save(); g.translate(pr.x, pr.y); g.rotate(pr.skind === 'axe' ? pr.spin : Math.atan2(pr.vy, pr.vx) + Math.PI / 2); g.drawImage(img, -img.width / 2, -img.height / 2); g.restore(); }
      if (Math.random() < 0.4) this.parts.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.2, max: 0.2, color: '#e8e0f4', g: 0 });
      return;
    }
    if (pr.skind === 'arrow' || pr.skind === 'dart') {
      const a = Math.atan2(pr.vy, pr.vx), L = pr.skind === 'arrow' ? 10 : 6;
      g.strokeStyle = pr.skind === 'dart' ? '#9be15d' : '#fff0c8'; g.lineWidth = pr.skind === 'arrow' ? 2 : 1.5;
      g.beginPath(); g.moveTo(pr.x - Math.cos(a) * L, pr.y - Math.sin(a) * L); g.lineTo(pr.x, pr.y); g.stroke();
      g.strokeStyle = hexA(pr.skind === 'dart' ? '#9be15d' : '#ffe080', 0.35); g.lineWidth = 3;
      g.beginPath(); g.moveTo(pr.x - Math.cos(a) * L * 2.4, pr.y - Math.sin(a) * L * 2.4); g.lineTo(pr.x - Math.cos(a) * L, pr.y - Math.sin(a) * L); g.stroke();
      return;
    }
    if (pr.skind === 'wave') {
      const a = Math.atan2(pr.vy, pr.vx);
      for (const [r, col, wd] of [[16, 'rgba(255,240,190,0.35)', 7], [14, 'rgba(255,250,230,0.9)', 3]]) { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.arc(pr.x - Math.cos(a) * 8, pr.y - Math.sin(a) * 8, r, a - 1.1, a + 1.1); g.stroke(); }
      if (Math.random() < 0.8) this.parts.push({ x: pr.x + (Math.random() - 0.5) * 16, y: pr.y + (Math.random() - 0.5) * 16, vx: -pr.vx * 0.1, vy: -pr.vy * 0.1, t: 0.3, max: 0.3, color: '#fff0c0', g: 0 });
      return;
    }
    if (pr.skind === 'bigaxe') {
      const img = sprite('weapon_double_axe');
      if (img) { g.save(); g.translate(pr.x, pr.y); g.rotate(pr.spin * 0.6); g.drawImage(img, -img.width, -img.height, img.width * 2, img.height * 2); g.restore(); }
      if (Math.random() < 0.6) this.parts.push({ x: pr.x + (Math.random() - 0.5) * 16, y: pr.y + (Math.random() - 0.5) * 16, vx: 0, vy: 0, t: 0.25, max: 0.25, color: '#e8e0f4', g: 0 });
      return;
    }
    if (pr.kind === 'skill' || pr.big || pr.kind === 'orb') { this.drawMagicProj(pr); return; }
    if (pr.kind === 'axe') {
      const img = sprite('weapon_throwing_axe');
      if (img) { g.save(); g.translate(Math.round(pr.x), Math.round(pr.y)); g.rotate(pr.spin || 0); g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2)); g.restore(); return; }
    }
    if (pr.kind === 'arrow') {
      const img = sprite('weapon_arrow');
      if (img) {
        g.save(); g.translate(Math.round(pr.x), Math.round(pr.y)); g.rotate(Math.atan2(pr.vy, pr.vx) + Math.PI / 2);
        g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2)); g.restore();
        return;
      }
    }
    const x = Math.round(pr.x), y = Math.round(pr.y);
    if (Math.random() < 0.35) this.parts.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.2, max: 0.2, color: pr.color, g: 0 });
    for (let i = 1; i <= 3; i++) {
      g.fillStyle = hexA(pr.color, 0.4 - i * 0.1);
      disc(g, x - pr.vx * 0.012 * i, y - pr.vy * 0.012 * i, 3 - i * 0.6);
    }
    g.fillStyle = '#0d0b10'; disc(g, x, y, 3.5);
    g.fillStyle = pr.color; disc(g, x, y, 2.5);
    g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 1, 1, 1);
  }

  // 마법 투사체: 바깥 빛무리 → 꼬리 → 원소 모양 심 → 흰 중심. lighter 로 겹쳐 빛나게
  drawMagicProj(pr) {
    const g = this.g, t = this.world.t;
    const col = pr.color || '#c9a8ff';
    const sp = Math.hypot(pr.vx, pr.vy) || 1, ux = pr.vx / sp, uy = pr.vy / sp, a = Math.atan2(pr.vy, pr.vx);
    const el = pr.elem || (pr.skind === 'fireball' ? 'fire' : pr.skind === 'icerock' || pr.skind === 'ice' ? 'ice' : pr.skind === 'arcane' ? 'arcane' : pr.skind === 'soul' ? 'soul' : pr.skind === 'plague' ? 'poison' : pr.kind === 'orb' ? 'orb' : 'arcane');
    const big = pr.skind === 'fireball' || pr.skind === 'spiritArrow' || pr.skind === 'icerock' ? 1.5 : pr.kind === 'orb' ? 0.8 : 1;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 14 * big);
    halo.addColorStop(0, hexA(col, 0.55)); halo.addColorStop(0.4, hexA(col, 0.18)); halo.addColorStop(1, hexA(col, 0));
    g.fillStyle = halo; g.fillRect(pr.x - 14 * big, pr.y - 14 * big, 28 * big, 28 * big);
    // 꼬리
    const L = (pr.skind === 'spiritArrow' ? 26 : 16) * big;
    const tg = g.createLinearGradient(pr.x, pr.y, pr.x - ux * L, pr.y - uy * L);
    tg.addColorStop(0, hexA(col, 0.8)); tg.addColorStop(1, hexA(col, 0));
    g.strokeStyle = tg; g.lineCap = 'round';
    g.lineWidth = 5 * big; g.beginPath(); g.moveTo(pr.x, pr.y); g.lineTo(pr.x - ux * L, pr.y - uy * L); g.stroke();
    g.lineWidth = 1.5 * big; g.strokeStyle = hexA('#ffffff', 0.7); g.beginPath(); g.moveTo(pr.x, pr.y); g.lineTo(pr.x - ux * L * 0.5, pr.y - uy * L * 0.5); g.stroke();
    g.lineCap = 'butt';
    g.restore();
    g.save(); g.translate(pr.x, pr.y); g.rotate(a);
    if (el === 'fire') {
      // 일렁이는 불꽃 방울
      const fl = Math.sin(t * 40 + pr.x) * 1.2;
      g.fillStyle = '#ff5a1a'; g.beginPath(); g.ellipse(-2, 0, 7 * big + fl, 4.5 * big, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffb030'; g.beginPath(); g.ellipse(0, 0, 4.5 * big, 3.2 * big, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff3c0'; g.beginPath(); g.ellipse(1, 0, 2.2 * big, 1.8 * big, 0, 0, Math.PI * 2); g.fill();
    } else if (el === 'ice') {
      // 얼음 송곳
      g.fillStyle = '#5ab8e8'; g.beginPath(); g.moveTo(8 * big, 0); g.lineTo(-2, 3.5 * big); g.lineTo(-7 * big, 0); g.lineTo(-2, -3.5 * big); g.closePath(); g.fill();
      g.fillStyle = '#d8f6ff'; g.beginPath(); g.moveTo(7 * big, 0); g.lineTo(-1, 1.5 * big); g.lineTo(-4 * big, 0); g.lineTo(-1, -1.5 * big); g.closePath(); g.fill();
    } else if (el === 'lightning') {
      g.strokeStyle = '#fff8a0'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-6, 0); for (let i = 1; i <= 4; i++) g.lineTo(-6 + i * 3.5, (Math.random() - 0.5) * 6); g.stroke();
      g.fillStyle = '#ffffff'; disc(g, 0, 0, 2.5);
    } else if (el === 'wind') {
      g.strokeStyle = '#e8fff0'; g.lineWidth = 2;
      g.beginPath(); g.arc(-4, 0, 7, -1.2, 1.2); g.stroke();
      g.strokeStyle = hexA('#bfffd0', 0.7); g.lineWidth = 1; g.beginPath(); g.arc(-7, 0, 6, -1.0, 1.0); g.stroke();
    } else if (el === 'dark' || el === 'soul') {
      const c2 = el === 'soul' ? '#7ae8ff' : '#c45cff';
      g.fillStyle = '#1a0e24'; disc(g, 0, 0, 4.5 * big);
      g.fillStyle = c2; disc(g, 0, 0, 3 * big);
      g.fillStyle = '#ffffff'; disc(g, 0.5, -0.5, 1.2 * big);
      for (let i = 0; i < 3; i++) { const q = t * 8 + i * 2.1; g.fillStyle = hexA(c2, 0.8); g.fillRect(Math.cos(q) * 5 - 0.5, Math.sin(q) * 5 - 0.5, 1.5, 1.5); }
    } else if (el === 'poison') {
      g.fillStyle = '#4a8a2a'; disc(g, 0, 0, 4.5 * big); g.fillStyle = '#9be15d'; disc(g, 0, 0, 3.2 * big); g.fillStyle = '#e0ffb0'; disc(g, -1, -1, 1.3 * big);
    } else {
      // 비전·일반 마력 구슬: 도는 빛 조각
      g.fillStyle = hexA(col, 0.95); disc(g, 0, 0, 3.4 * big);
      g.fillStyle = '#ffffff'; disc(g, 0, 0, 1.6 * big);
      for (let i = 0; i < 2; i++) { const q = t * 14 + i * Math.PI; g.fillStyle = '#ffffff'; g.fillRect(Math.cos(q) * 5 * big - 0.5, Math.sin(q) * 5 * big - 0.5, 1.5, 1.5); }
    }
    g.restore();
    if (pr.skind === 'spiritArrow' && pr.spiritElems) {
      // 깃든 정령 색이 화살 주위를 나선으로 돈다
      pr.spiritElems.forEach((e2, i) => { const q = t * 18 + i * 2.1; this.parts.push({ x: pr.x - ux * 4 + Math.cos(q) * -uy * 5, y: pr.y - uy * 4 + Math.cos(q) * ux * 5, vx: -pr.vx * 0.1, vy: -pr.vy * 0.1, t: 0.35, max: 0.35, color: ELEM[e2].color, g: 0, glow: true }); });
    }
    if (Math.random() < 0.8) {
      const pc = el === 'fire' ? (Math.random() < 0.5 ? '#ff7a2a' : '#ffd040') : el === 'ice' ? '#e0f8ff' : col;
      this.parts.push({ x: pr.x + (Math.random() - 0.5) * 6, y: pr.y + (Math.random() - 0.5) * 6, vx: -pr.vx * 0.15 + (Math.random() - 0.5) * 20, vy: -pr.vy * 0.15 + (Math.random() - 0.5) * 20 - (el === 'fire' ? 20 : 0), t: 0.35, max: 0.35, color: pc, g: el === 'ice' ? 40 : -10, glow: true });
    }
  }

  // 룬 원: 바깥 이중 고리 + 안쪽 별(육각) + 도는 글자 눈금. 바닥에 납작하게
  runeCircle(x, y, r, col, t, a = 1) {
    if (r < 1) return;
    const g = this.g, ry = 0.5;
    g.save(); g.globalCompositeOperation = 'lighter';
    const fill = g.createRadialGradient(x, y, 0, x, y, r);
    fill.addColorStop(0, hexA(col, 0.18 * a)); fill.addColorStop(1, hexA(col, 0.04 * a));
    g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, r, r * ry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = hexA(col, 0.85 * a); g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(x, y, r, r * ry, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = hexA(col, 0.5 * a); g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, r * 0.82, r * 0.82 * ry, 0, 0, Math.PI * 2); g.stroke();
    // 별
    g.strokeStyle = hexA(col, 0.7 * a); g.beginPath();
    for (let i = 0; i <= 6; i++) { const q = -t * 0.8 + i * (Math.PI * 2 / 3) * (i % 2 ? 1 : 1); const q2 = q + (i % 2) * Math.PI / 3; const px = x + Math.cos(q2) * r * 0.8, py = y + Math.sin(q2) * r * 0.8 * ry; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    g.beginPath();
    for (let i = 0; i <= 3; i++) { const q = -t * 0.8 + i * (Math.PI * 2 / 3); const px = x + Math.cos(q) * r * 0.8, py = y + Math.sin(q) * r * 0.8 * ry; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    g.beginPath();
    for (let i = 0; i <= 3; i++) { const q = -t * 0.8 + Math.PI / 3 + i * (Math.PI * 2 / 3); const px = x + Math.cos(q) * r * 0.8, py = y + Math.sin(q) * r * 0.8 * ry; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    // 글자 눈금
    for (let i = 0; i < 12; i++) {
      const q = t * 1.2 + i * Math.PI / 6, px = x + Math.cos(q) * r * 0.91, py = y + Math.sin(q) * r * 0.91 * ry;
      g.fillStyle = hexA(i % 3 ? col : '#ffffff', 0.9 * a); g.fillRect(Math.round(px) - (i % 2), Math.round(py), 1 + (i % 2), 1);
    }
    g.restore();
  }

  // 빛 퍼짐 (lighter 원형 그라디언트)
  glow(x, y, r, color, a = 1) {
    const g = this.g;
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, hexA(color, 0.6 * a)); gr.addColorStop(0.45, hexA(color, 0.22 * a)); gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  }

  drawFx(w, dt) {
    const g = this.g, p = w.player;
    for (const f of this.fx) {
      f.t -= dt;
      const k = Math.max(0, f.t / f.max);
      if (f.k === 'ring') {
        const rr = f.r * (1 - k * 0.6);
        g.save(); g.globalCompositeOperation = 'lighter';
        g.strokeStyle = hexA(f.color, k * 0.35); g.lineWidth = (f.w || 2) * 2.5;
        g.beginPath(); g.ellipse(f.x, f.y, rr, rr * 0.62, 0, 0, Math.PI * 2); g.stroke();
        g.restore();
        g.strokeStyle = hexA(f.color, k); g.lineWidth = f.w || 2;
        g.beginPath(); g.ellipse(f.x, f.y, rr, rr * 0.62, 0, 0, Math.PI * 2); g.stroke();
      } else if (f.k === 'slash') {
        // 휘두른 궤적의 초승달 잔상: 끝에서부터 사라짐
        const prog = easeOut(Math.min(1, 1 - (f.t - 0.08) / f.dur));
        const half = f.arc / 2 + 0.25;
        const a0 = f.ang - f.dir * half, a1 = a0 + f.dir * half * 2 * prog;
        const tail = Math.max(0, 1 - k * 1.6);
        const as = a0 + f.dir * half * 2 * prog * tail;
        const col = f.aura ? '#ffd84a' : f.heavy ? '#ffd050' : f.type === 'mag' ? '#c9a8ff' : '#ffffff';
        if (f.thrust) {
          // 창끝 앞으로 뾰족하게 뻗는 바람 자국 두세 줄 (막대처럼 보이지 않게 끝만)
          const a2 = Math.min(1, k * 2.2), prog = 1 - k;
          const ux = Math.cos(f.ang), uy = Math.sin(f.ang), nx = -uy, ny = ux;
          const base = 24 + 8 * prog, tipL = base + 10 + 8 * prog;
          g.save(); g.globalCompositeOperation = 'lighter';
          g.fillStyle = hexA(f.aura ? '#ffd84a' : '#fff4d8', 0.85 * a2);
          g.beginPath(); g.moveTo(p.x + ux * base + nx * 2.5, p.y - 7 + uy * base + ny * 2.5); g.lineTo(p.x + ux * tipL, p.y - 7 + uy * tipL); g.lineTo(p.x + ux * base - nx * 2.5, p.y - 7 + uy * base - ny * 2.5); g.closePath(); g.fill();
          for (const o of [-5, 5]) { g.strokeStyle = hexA('#ffffff', 0.45 * a2); g.lineWidth = 1; g.beginPath(); g.moveTo(p.x + ux * base * 0.8 + nx * o, p.y - 7 + uy * base * 0.8 + ny * o); g.lineTo(p.x + ux * (base + 8) + nx * o * 0.6, p.y - 7 + uy * (base + 8) + ny * o * 0.6); g.stroke(); }
          g.restore();
          continue;
        }
        const R = f.range + 4, r = Math.max(6, f.range * 0.35);
        const px = p.x, py = p.y - 6;
        const alpha = Math.min(1, k * 2.2);
        g.fillStyle = hexA(col, 0.55 * alpha);
        smear(g, px, py, R, (f.heavy ? 10 : 7), as, a1);
        g.fillStyle = hexA('#ffffff', 0.95 * alpha);
        smear(g, px, py, R, (f.heavy ? 4 : 2.5), as, a1);
      } else if (f.k === 'trail') {
        g.strokeStyle = hexA(f.color, k * 0.55); g.lineWidth = f.w * k + 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(f.x1, f.y1 - 6); g.lineTo(f.x2, f.y2 - 6); g.stroke();
        g.strokeStyle = hexA('#ffffff', k * 0.8); g.lineWidth = 2;
        g.beginPath(); g.moveTo(f.x1, f.y1 - 6); g.lineTo(f.x2, f.y2 - 6); g.stroke(); g.lineCap = 'butt';
      } else if (f.k === 'impact') {
        g.fillStyle = hexA(f.color || '#ffffff', k);
        const r = f.r * (1.2 - k * 0.4);
        g.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.3 : r; g.lineTo(f.x + Math.cos(a) * rr, f.y - 8 + Math.sin(a) * rr); }
        g.closePath(); g.fill();
      } else if (f.k === 'bolt') {
        // 번개: 빛무리 + 지그재그 세 겹 + 가지
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const pt of f.pts.slice(1)) this.glow(pt.x, pt.y, 18, f.color, k);
        for (let i = 1; i < f.pts.length; i++) {
          const pv = f.pts[i - 1], pt = f.pts[i];
          for (let b = 0; b < 2; b++) {
            const s2 = (Math.sin(f.seed + i * 3.7 + b * 11) + 1) / 2, mx = pv.x + (pt.x - pv.x) * s2, my = pv.y + (pt.y - pv.y) * s2;
            const ba = Math.atan2(pt.y - pv.y, pt.x - pv.x) + (b ? 0.9 : -0.9);
            g.strokeStyle = hexA(f.color, 0.6 * k); g.lineWidth = 1; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(ba) * 9 + Math.sin(this.world.t * 50 + b) * 2, my + Math.sin(ba) * 9); g.stroke();
          }
        }
        g.restore();
        for (const [wd, col] of [[7, hexA(f.color, k * 0.25)], [4, hexA(f.color, k * 0.6)], [1.5, hexA('#ffffff', k)]]) {
          g.strokeStyle = col; g.lineWidth = wd; g.beginPath();
          f.pts.forEach((pt, i) => {
            if (!i) { g.moveTo(pt.x, pt.y); return; }
            const pv = f.pts[i - 1];
            for (let j = 1; j <= 4; j++) {
              const tt = j / 4, jx = (Math.sin(f.seed + i * 7 + j * 13 + this.world.t * 40) * 6) * (j < 4 ? 1 : 0);
              g.lineTo(pv.x + (pt.x - pv.x) * tt + jx, pv.y + (pt.y - pv.y) * tt - jx * 0.6);
            }
          });
          g.stroke();
        }
      } else if (f.k === 'cone') {
        g.fillStyle = hexA(f.color, 0.28 * k);
        g.beginPath(); g.moveTo(f.x, f.y - 6); g.arc(f.x, f.y - 6, f.range, f.ang - f.angle / 2, f.ang + f.angle / 2); g.closePath(); g.fill();
      } else if (f.k === 'claws') {
        g.strokeStyle = hexA('#ffffff', k); g.lineWidth = 2.5;
        for (let i = -1; i <= 1; i++) {
          const a = f.ang + Math.PI / 2, ox = Math.cos(a) * i * 6, oy = Math.sin(a) * i * 6;
          const cx = f.x + Math.cos(f.ang) * f.r * 0.7, cy = f.y - 6 + Math.sin(f.ang) * f.r * 0.7;
          g.beginPath(); g.moveTo(cx - Math.cos(f.ang + 0.9) * 12 + ox, cy - Math.sin(f.ang + 0.9) * 12 + oy); g.lineTo(cx + Math.cos(f.ang + 0.9) * 12 + ox, cy + Math.sin(f.ang + 0.9) * 12 + oy); g.stroke();
        }
      } else if (f.k === 'slashX') {
        g.strokeStyle = hexA(f.color, k); g.lineWidth = 5 * k + 1;
        const L = 22 * (1.3 - k * 0.3);
        for (const s2 of [1, -1]) { g.beginPath(); g.moveTo(f.x - L, f.y - L * s2); g.lineTo(f.x + L, f.y + L * s2); g.stroke(); }
        g.strokeStyle = hexA('#ffffff', k); g.lineWidth = 1.5;
        for (const s2 of [1, -1]) { g.beginPath(); g.moveTo(f.x - L, f.y - L * s2); g.lineTo(f.x + L, f.y + L * s2); g.stroke(); }
      } else if (f.k === 'bite2') {
        g.fillStyle = hexA('#ffffff', k);
        for (let i = 0; i < 5; i++) { const x = f.x - 12 + i * 6, o = (1 - k) * 6; g.beginPath(); g.moveTo(x, f.y - 12 + o); g.lineTo(x + 3, f.y - 3 + o); g.lineTo(x + 6, f.y - 12 + o); g.fill(); g.beginPath(); g.moveTo(x, f.y + 12 - o); g.lineTo(x + 3, f.y + 3 - o); g.lineTo(x + 6, f.y + 12 - o); g.fill(); }
      } else if (f.k === 'pillar') {
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(0, f.y - 120, 0, f.y);
        gr.addColorStop(0, hexA(f.color, 0)); gr.addColorStop(1, hexA(f.color, 0.7 * k));
        g.fillStyle = gr; const pw = f.r * 0.8 * (0.5 + k * 0.5);
        g.fillRect(f.x - pw / 2, f.y - 120, pw, 120);
        g.fillStyle = hexA('#ffffff', 0.6 * k); g.fillRect(f.x - pw / 6, f.y - 120, pw / 3, 120);
        g.restore();
      } else if (f.k === 'cracks') {
        g.strokeStyle = hexA('#2a2018', Math.min(1, k * 1.5)); g.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          let a = (i / 8) * Math.PI * 2 + f.seed, x = f.x, y = f.y;
          g.beginPath(); g.moveTo(x, y);
          for (let j = 0; j < 4; j++) { a += Math.sin(f.seed + i * 3 + j) * 0.5; x += Math.cos(a) * f.r / 4; y += Math.sin(a) * f.r / 4 * 0.6; g.lineTo(x, y); }
          g.stroke();
        }
      } else if (f.k === 'shards') {
        g.fillStyle = hexA(f.color, k);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + f.seed, d2 = f.r * (0.3 + 0.6 * ((i * 37) % 10) / 10);
          const x = f.x + Math.cos(a) * d2, y = f.y + Math.sin(a) * d2 * 0.6, h = 10 * k + 4;
          g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 3, y); g.lineTo(x - 3, y); g.closePath(); g.fill();
        }
      } else if (f.k === 'castCircle') {
        const p2 = this.world.player, prog = 1 - k, open = easeOut(Math.min(1, (f.max - f.t) / 0.15));
        // 바닥 고리 대신: 발밑이 은은히 밝아지고, 주변의 기운이 지팡이 끝으로 빨려든다
        this.glow(p2.x, p2.y + 2, 16 * open, f.color, 0.35 + 0.3 * prog);
        if (Math.random() < 0.7) this.parts.push({ x: p2.x + (Math.random() - 0.5) * 34, y: p2.y + 3 + (Math.random() - 0.5) * 12, vx: 0, vy: -40 - Math.random() * 40, t: 0.6, max: 0.6, color: f.color, g: -10, glow: true });
        for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 10, tx = p2.x + p2.dir * 7, ty = p2.y - 22; this.parts.push({ x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, vx: -Math.cos(a) * d * 3.2, vy: -Math.sin(a) * d * 3.2, t: 0.3, max: 0.3, color: i ? '#ffffff' : f.color, g: 0, glow: true, size: 1 }); }
        if (this.world.player.castT <= 0) f.t = 0;
      } else if (f.k === 'rune') {
        this.runeCircle(f.x, f.y, f.r * (0.6 + 0.4 * easeOut(1 - k)), f.color, this.world.t * 1.5, k);
      } else if (f.k === 'scrape') {
        g.fillStyle = `rgba(30,22,16,${0.35 * k})`; g.fillRect(Math.round(f.x) - 1, Math.round(f.y), 2, 1);
      } else if (f.k === 'scorch') {
        const a = Math.min(1, k * 2);
        g.fillStyle = `rgba(20,10,6,${0.45 * a})`; ellipse(g, f.x, f.y, f.r, f.r * 0.55);
        g.fillStyle = `rgba(255,120,40,${0.25 * a * (0.6 + 0.4 * Math.sin(this.world.t * 7 + f.x))})`; ellipse(g, f.x, f.y, f.r * 0.55, f.r * 0.3);
        if (Math.random() < 0.15 * a) this.parts.push({ x: f.x + (Math.random() - 0.5) * f.r * 1.4, y: f.y + (Math.random() - 0.5) * f.r * 0.6, vx: 0, vy: -20, t: 0.6, max: 0.6, color: '#ff8a3a', g: -20, glow: true, size: 1 });
      } else if (f.k === 'glow') {
        this.glow(f.x, f.y, f.r * (1.3 - k * 0.3), f.color, k);
      } else if (f.k === 'echo') {
        const p2 = this.world.player, img = sprite(frames(RACE_ART[w.b.race].base, 'idle')[0], 'brightness(1.6) sepia(1) hue-rotate(220deg) saturate(3)', false, p2.dir < 0);
        if (img) { g.globalAlpha = 0.35 + 0.25 * Math.sin(this.world.t * 20); g.drawImage(img, Math.round(f.x - img.width / 2), Math.round(f.y + 5 - img.height)); g.globalAlpha = 1; }
        this.runeCircle(f.x, f.y + 3, f.r * 0.5 * (1 - k * 0.5), '#b98aff', this.world.t * 2, 0.6);
      } else if (f.k === 'path') {
        g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = hexA('#b98aff', 0.8 * k); g.lineWidth = 2; g.setLineDash([3, 3]);
        g.beginPath(); f.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y - 6) : g.moveTo(q.x, q.y - 6))); g.stroke(); g.setLineDash([]); g.restore();
      } else if (f.k === 'chain') {
        const e1 = w.enemies.find((e) => e.id === f.a), e2 = w.enemies.find((e) => e.id === f.b);
        if (!e1 || !e2) { f.t = 0; continue; }
        g.strokeStyle = hexA('#c45cff', 0.7); g.lineWidth = 1.5; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(e1.x, e1.y - 6); g.lineTo(e2.x, e2.y - 6); g.stroke(); g.setLineDash([]);
      } else if (f.k === 'parryStance') {
        const p2 = this.world.player;
        g.strokeStyle = `rgba(255,240,180,${0.5 + 0.3 * Math.sin(this.world.t * 20)})`; g.lineWidth = 2;
        g.beginPath(); g.arc(p2.x + p2.aimX * 6, p2.y - 7 + p2.aimY * 6, 13, Math.atan2(p2.aimY, p2.aimX) - 1.2, Math.atan2(p2.aimY, p2.aimX) + 1.2); g.stroke();
        if (this.world.player.parryT <= 0) f.t = 0;
      } else if (f.k === 'link') {
        g.strokeStyle = hexA(f.color || '#c45cff', k); g.lineWidth = 1.5; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(f.x1, f.y1 - 6); g.lineTo(f.x2, f.y2 - 6); g.stroke(); g.setLineDash([]);
      } else if (f.k === 'lock') {
        // 자동 조준 표적: 바깥에서 조여드는 네 모서리 + 회전하는 고리
        const col = f.ult ? '#ff5ad0' : f.kind === 'tank' ? '#ff6a4a' : f.kind === 'low' ? '#ff3a6a' : f.kind === 'cluster' ? '#ffcf5a' : f.kind === 'away' ? '#bfe8d0' : '#7ad8ff';
        const shrink = Math.min(1, (f.max - f.t) / 0.18);
        const R = 22 - 10 * shrink;
        g.strokeStyle = hexA(col, Math.min(1, k * 2)); g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + Math.PI / 4 + this.world.t * 3;
          const cx = f.x + Math.cos(a) * R, cy = f.y - 6 + Math.sin(a) * R;
          g.beginPath(); g.moveTo(cx - Math.cos(a) * 5 + Math.cos(a + Math.PI / 2) * 4, cy - Math.sin(a) * 5 + Math.sin(a + Math.PI / 2) * 4);
          g.lineTo(cx, cy); g.lineTo(cx - Math.cos(a) * 5 - Math.cos(a + Math.PI / 2) * 4, cy - Math.sin(a) * 5 - Math.sin(a + Math.PI / 2) * 4); g.stroke();
        }
        g.strokeStyle = hexA(col, 0.6 * k); g.lineWidth = 1;
        g.beginPath(); g.arc(f.x, f.y - 6, R + 4, this.world.t * -4, this.world.t * -4 + Math.PI * 1.4); g.stroke();
        if (shrink >= 1 && f.max - f.t < 0.25) { g.fillStyle = hexA('#ffffff', 0.8 * (1 - (f.max - f.t - 0.18) / 0.07)); disc(g, f.x, f.y - 6, 6); }
      } else if (f.k === 'fall' && f.kind === 'fireball') {
        const prog = 1 - k, h = 220 * (1 - prog * prog);
        const x = f.x - h * 0.45, y = f.y - h, t2 = this.world.t;
        // 땅의 예고 그림자와 빛
        g.fillStyle = `rgba(0,0,0,${0.3 * prog})`; ellipse(g, f.x, f.y, f.r * 0.7 * prog, f.r * 0.35 * prog);
        this.glow(f.x, f.y, f.r * prog, '#ff6a1a', 0.5 * prog);
        // 꼬리
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 12; i >= 1; i--) { const tx = x + i * 0.45 * 6, ty = y - i * 6; g.fillStyle = hexA(i > 7 ? '#ff3a0a' : i > 3 ? '#ff7a1a' : '#ffc040', 0.18); disc(g, tx + Math.sin(t2 * 20 + i) * 2, ty, 20 - i * 1.2); }
        this.glow(x, y, 60, '#ff7a2a', 0.9);
        g.restore();
        // 불덩이 몸통: 바깥 불꽃 혀 → 주황 → 노랑 → 흰 심
        for (let i = 0; i < 10; i++) { const a = t2 * 6 + i * 0.63, rr = 20 + Math.sin(t2 * 17 + i * 2) * 4; g.fillStyle = i % 2 ? '#ff4a12' : '#ff7a1a'; g.beginPath(); g.moveTo(x + Math.cos(a - 0.3) * 14, y + Math.sin(a - 0.3) * 14); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); g.lineTo(x + Math.cos(a + 0.3) * 14, y + Math.sin(a + 0.3) * 14); g.fill(); }
        g.fillStyle = '#e8400e'; disc(g, x, y, 16); g.fillStyle = '#ff8a1a'; disc(g, x - 1, y - 1, 12.5); g.fillStyle = '#ffd040'; disc(g, x - 2, y - 2, 8); g.fillStyle = '#fff6d0'; disc(g, x - 3, y - 3, 4);
        for (let i = 0; i < 4; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 24, vx: 40 + Math.random() * 40, vy: -60 - Math.random() * 40, t: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd040', g: -10, glow: true, size: 2 });
        if (f.t < 0.03 && !f.boom) { f.boom = true; this.fireballBoom(f.x, f.y, f.r); }
      } else if (f.k === 'fall') {
        // 하늘에서 떨어지는 운석
        const prog = 1 - k, h = 180 * (1 - prog * prog);
        const x = f.x - h * 0.35, y = f.y - h;
        const big = f.kind === 'fireball' ? 1.6 : 1;
        this.glow(x, y, 26, '#ff7a2a', 0.8);
        g.fillStyle = `rgba(0,0,0,${0.25 * prog})`; ellipse(g, f.x, f.y, f.r * 0.5 * prog * big, f.r * 0.2 * prog * big);
        for (let i = 6; i >= 1; i--) { g.fillStyle = hexA(i > 3 ? '#ff5a1a' : '#ffb040', 0.25); disc(g, x + i * 0.35 * 5, y - i * 5, (9 - i) * big); }
        g.fillStyle = '#ff7a2a'; disc(g, x, y, 11 * big); g.fillStyle = '#ffd040'; disc(g, x - 1, y - 1, 7 * big); g.fillStyle = '#fff6c0'; disc(g, x - 2, y - 2, 3.5 * big);
        if (Math.random() < 0.9) this.parts.push({ x: x + (Math.random() - 0.5) * 10 * big, y: y + (Math.random() - 0.5) * 10 * big, vx: 30, vy: -40, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd040', g: -20 });
      } else if (f.k === 'lineTele') {
        g.strokeStyle = `rgba(255,240,190,${0.3 + 0.5 * (1 - k)})`; g.lineWidth = f.w * (1 - k * 0.7);
        g.beginPath(); g.moveTo(f.x1, f.y1); g.lineTo(f.x2, f.y2); g.stroke();
      } else if (f.k === 'line') {
        if (f.fx === 'spikes') {
          const n = Math.floor(Math.hypot(f.x2 - f.x1, f.y2 - f.y1) / 12);
          for (let i = 1; i <= n; i++) {
            const x = f.x1 + (f.x2 - f.x1) * i / n, y = f.y1 + (f.y2 - f.y1) * i / n, h = (14 + (i % 3) * 5) * Math.min(1, (f.max - f.t) * 10 - i * 0.12 + 0.5);
            if (h <= 0) continue;
            g.fillStyle = hexA('#c8f0ff', k); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 4, y + 2); g.lineTo(x - 4, y + 2); g.closePath(); g.fill();
            g.fillStyle = hexA('#ffffff', k); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 1, y); g.lineTo(x - 1.5, y); g.closePath(); g.fill();
          }
        } else {
          for (const [wd, col] of [[f.w * 1.4, hexA(f.color, 0.25 * k)], [f.w, hexA(f.color, 0.6 * k)], [f.w * 0.3, hexA('#ffffff', k)]]) {
            g.strokeStyle = col; g.lineWidth = wd * (0.6 + 0.4 * k); g.lineCap = 'round';
            g.beginPath(); g.moveTo(f.x1, f.y1 - 6); g.lineTo(f.x2, f.y2 - 6); g.stroke();
          }
          g.lineCap = 'butt';
        }
      } else if (f.k === 'gravity') {
        for (let i = 0; i < 3; i++) { g.strokeStyle = hexA('#b98aff', 0.6 * k); g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, f.r * (k * (1 - i * 0.25)), this.world.t * 6 + i, this.world.t * 6 + i + 4); g.stroke(); }
        g.fillStyle = hexA('#1a0a30', 0.6); disc(g, f.x, f.y, 6 + 6 * (1 - k));
        for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r, vx: -Math.cos(a) * f.r * 2.5, vy: -Math.sin(a) * f.r * 2.5, t: 0.35, max: 0.35, color: '#b98aff', g: 0 }); }
      } else if (f.k === 'implode') {
        g.fillStyle = hexA(f.color, 0.35 * k); disc(g, f.x, f.y, f.r * (1.2 - k * 0.6));
        g.fillStyle = hexA('#ffffff', 0.7 * k); disc(g, f.x, f.y, f.r * 0.25 * k);
      } else if (f.k === 'vines') {
        // 땅을 뚫고 솟는 덩굴 줄기: 외곽선 · 잎 · 끝이 말린 모양
        const al = Math.min(1, k * 3), grow = easeOut(Math.min(1, (f.max - f.t) * 5));
        g.fillStyle = `rgba(50,36,22,${0.5 * al})`; ellipse(g, f.x, f.y, f.r, f.r * 0.5);
        for (let i = 0; i < 11; i++) {
          const a = (i / 11) * Math.PI * 2 + f.seed, rr = f.r * (0.25 + ((i * 7) % 5) / 6.5);
          const x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.5, h = (12 + (i % 3) * 5) * grow;
          const sw = Math.sin(this.world.t * 3 + i) * 3, cx2 = x + sw, cy2 = y - h * 0.55, ex = x + 4 * (i % 2 ? 1 : -1) + sw * 0.5, ey = y - h;
          for (const [lw, c2] of [[3.2, `rgba(16,36,12,${al})`], [1.8, hexA(f.color, al)]]) { g.strokeStyle = c2; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx2, cy2, ex, ey); g.stroke(); }
          g.strokeStyle = hexA(f.color, al); g.lineWidth = 1.2; g.beginPath(); g.arc(ex + (i % 2 ? -2 : 2), ey, 2, 0, Math.PI * 1.4); g.stroke();
          if (grow > 0.6) { g.fillStyle = `rgba(150,230,100,${al})`; g.fillRect(Math.round(cx2 + 1), Math.round(cy2), 3, 2); g.fillStyle = `rgba(210,255,160,${al})`; g.fillRect(Math.round(cx2 + 1), Math.round(cy2), 1, 1); }
        }
      } else if (f.k === 'arrowDrop') {
        const h = 40 * k;
        g.strokeStyle = '#e8d8b0'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(f.x + h * 0.3, f.y - h - 10); g.lineTo(f.x + h * 0.3 - 3, f.y - h); g.stroke();
        if (f.t < 0.03) this.sparkBurst(f.x, f.y, '#e8d8b0', 3);
      } else if (f.k === 'chargeGlow') {
        const p2 = this.world.player;
        for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: p2.x + Math.cos(a) * 26, y: p2.y - 8 + Math.sin(a) * 26, vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 70, t: 0.35, max: 0.35, color: '#ffe080', g: 0 }); }
      } else if (f.k === 'tcircle') {
        if (f.follow) { f.x = this.world.player.x; f.y = this.world.player.y; }
        g.fillStyle = `rgba(200,150,255,${0.15 + 0.25 * (1 - k)})`; disc(g, f.x, f.y, f.r);
        g.strokeStyle = 'rgba(230,200,255,0.8)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(f.x, f.y, f.r * (1 - k), 0, Math.PI * 2); g.stroke();
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
    } else if (dr.kind === 'story') {
      const it = STORY_ITEMS[dr.id], x = Math.round(dr.x), y = Math.round(dr.y - 4 + bob);
      g.fillStyle = hexA(it.color, 0.3 + 0.2 * Math.sin(w.t * 6)); disc(g, x, y, 8);
      drawStoryItem(g, dr.id, x, y);
      if (Math.random() < 0.15) this.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y - 2, vx: 0, vy: -14, t: 0.6, max: 0.6, color: it.color, g: -6 });
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
    if (o.kind === 'station' || o.kind === 'merchant') return this.drawNpc(w, o);
    if (o.kind === 'npc') {
      if (o.leaving != null) { o.leaving -= dt * 0.6; if (o.leaving <= 0) { w.objects.splice(w.objects.indexOf(o), 1); return; } g.globalAlpha = o.leaving; }
      this.drawNpc(w, o);
      g.globalAlpha = 1;
      // 건넬 물건이 있거나 처음 만나면 머리 위에 느낌표
      if (o.id === 'pino' && o.leaving == null && w.story) { const tk = pinoTalk(w.story); if (tk.set) this.bang(o.x, o._top - 12 + Math.sin(w.t * 5) * 1.5, '#ffd040'); }
      return;
    }
    if (o.kind === 'barrier') { if (!o.opened) this.drawBarrier(w, o); return; }
    if (o.kind === 'journal') {
      const x = Math.round(o.x), y = Math.round(o.y);
      if (o.look === 'campfire') {
        // 꺼진 모닥불 · 그 옆에 펼쳐진 일지
        g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + 3, 11, 4);
        g.fillStyle = '#2a2018'; g.fillRect(x - 7, y, 14, 3);
        g.fillStyle = '#4a3828'; g.fillRect(x - 6, y - 1, 5, 2); g.fillRect(x + 1, y - 2, 5, 2);
        g.fillStyle = '#5a5a5a'; for (let i = 0; i < 5; i++) g.fillRect(x - 6 + i * 3, y + 2, 2, 2);
        if (Math.random() < 0.06) this.parts.push({ x: x + (Math.random() - 0.5) * 4, y: y - 2, vx: 2, vy: -8, t: 1.4, max: 1.4, color: '#8a8478', g: -2 });
        drawBook(g, x + 11, y + 1, o.read);
      } else {
        g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + 3, 7, 3);
        drawBook(g, x, y, o.read);
      }
      if (!o.read && Math.sin(t * 3 + o.x) > 0.6) { g.fillStyle = '#fff4d8'; g.fillRect(x + (o.look === 'campfire' ? 9 : -2) + ((t * 6) | 0) % 5, y - 5, 1, 1); }
      o._top = y - 10;
      return;
    }
    if (o.kind === 'stairs') {
      const img = sprite('floor_stairs');
      g.fillStyle = hexA('#ff6040', 0.2 + 0.1 * Math.sin(t * 2)); ellipse(g, o.x, o.y + 4, 14, 7);
      if (img) g.drawImage(img, Math.round(o.x - 8), Math.round(o.y - 4));
      o._top = o.y - 10;
      return;
    }
    if (o.kind === 'camp') {
      const x = Math.round(o.x), y = Math.round(o.y);
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + 4, 16, 5);
      // 천막
      g.fillStyle = '#0d0b10'; g.beginPath(); g.moveTo(x - 20, y + 2); g.lineTo(x - 9, y - 16); g.lineTo(x + 2, y + 2); g.closePath(); g.fill();
      g.fillStyle = '#8a5a3a'; g.beginPath(); g.moveTo(x - 18, y + 1); g.lineTo(x - 9, y - 14); g.lineTo(x, y + 1); g.closePath(); g.fill();
      g.fillStyle = '#3a2418'; g.fillRect(x - 10, y - 6, 3, 7);
      // 모닥불
      g.fillStyle = '#4a3020'; g.fillRect(x + 6, y + 1, 10, 2);
      const fl = Math.sin(t * 14) * 1;
      g.fillStyle = '#ff7a2a'; g.fillRect(x + 8, y - 5 + fl, 6, 6);
      g.fillStyle = '#ffd040'; g.fillRect(x + 10, y - 3 + fl, 2, 4);
      if (Math.random() < 0.2) this.parts.push({ x: x + 11, y: y - 4, vx: (Math.random() - 0.5) * 10, vy: -25, t: 0.6, max: 0.6, color: '#ffb040', g: -15 });
      o._top = y - 18;
      return;
    }
    if (o.kind === 'shrine') {
      const x = Math.round(o.x), y = Math.round(o.y);
      const img = sprite('column');
      this.shadow(x, y + 4, 8);
      if (img) g.drawImage(img, x - 8, y + 4 - 34, 16, 34);
      const glow = o.opened ? 0.15 : 0.5 + 0.3 * Math.sin(t * 3);
      g.fillStyle = `rgba(200,160,255,${glow})`; disc(g, x, y - 30, 4);
      if (!o.opened && Math.random() < 0.1) this.parts.push({ x: x + (Math.random() - 0.5) * 10, y: y - 28, vx: 0, vy: -15, t: 0.8, max: 0.8, color: '#c9a8ff', g: -8 });
      o._top = y - 36;
      return;
    }
    if (o.kind === 'portal') {
      // 귀환 포탈: 빛나는 원
      for (let i = 0; i < 5; i++) {
        const k = 1 - i / 5;
        g.fillStyle = i % 2 ? hexA(o.color, 0.35 + 0.15 * Math.sin(t * 4 + i)) : hexA('#ffffff', 0.15 + 0.1 * Math.sin(t * 3 - i));
        ellipse(g, o.x, o.y, 14 * k, 7 * k);
      }
      for (let i = 0; i < 3; i++) { const ph = (t * 0.8 + i / 3) % 1; g.fillStyle = hexA(o.color, 1 - ph); g.fillRect(Math.round(o.x - 6 + i * 6), Math.round(o.y - ph * 22), 1, 3); }
      o._top = o.y - 16;
      return;
    }
    if (o.kind === 'portal_old') {
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
    const art = NPC_ART[o.art || o.station || o.kind];
    const name = this.animFrame(art.base, 'idle', w.t + o.x * 0.01, 5);
    const img = sprite(name, art.tint || '', false, w.player.x < o.x);
    this.shadow(o.x, o.y + 4, 6);
    if (img) g.drawImage(img, Math.round(o.x - img.width / 2), Math.round(o.y + 5 - img.height));
    o._top = o.y + 5 - (img ? img.height : 24);
    if (o.station === 'board' && w.questReady) this.bang(o.x, o._top - 12 + Math.sin(w.t * 5) * 1.5, '#ffd040');
  }

  // 길을 막는 것: 가시덩굴 · 녹슨 철창 · 무너진 바위 (막힌 칸마다)
  drawBarrier(w, o) {
    const g = this.g, t = w.t;
    for (const i of o.tiles) {
      const tx = (i % w.tw) * TILE, ty = Math.floor(i / w.tw) * TILE, h = (i * 2654435761) >>> 0;
      if (o.look === 'thorn') {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(tx, ty + 12, TILE, 4);
        for (let k = 0; k < 4; k++) {
          const sw = Math.sin(t * 1.6 + k + i) * 1.2, bx = tx + 2 + k * 4 + sw;
          g.fillStyle = k % 2 ? '#2e4a1e' : '#3e6226';
          g.fillRect(Math.round(bx), ty - 6 + ((h >> k) & 3), 2, 22);
          g.fillStyle = '#c8b878'; g.fillRect(Math.round(bx) + (k % 2 ? -1 : 2), ty - 2 + k * 4, 1, 1); g.fillRect(Math.round(bx) + (k % 2 ? 2 : -1), ty + 6 + k * 2, 1, 1);
        }
        g.fillStyle = '#5a8a32'; g.fillRect(tx + 1, ty + 2, 14, 2); g.fillRect(tx + 3, ty + 9, 12, 2);
      } else if (o.look === 'bars') {
        // 세로 철창: 너머가 보인다
        g.fillStyle = '#2a2018'; g.fillRect(tx + 6, ty - 14, 4, 30);
        for (let k = 0; k < 3; k++) { g.fillStyle = '#0d0b10'; g.fillRect(tx + 2 + k * 5, ty - 12, 2, 28); g.fillStyle = k === 1 ? '#a8885a' : '#7a5a3a'; g.fillRect(tx + 2 + k * 5, ty - 12, 1, 28); }
        g.fillStyle = '#5a4028'; g.fillRect(tx, ty - 12, TILE, 2); g.fillRect(tx, ty + 12, TILE, 2);
      } else {
        // 무너진 바위 더미
        const rock = (x, y, s, c) => { g.fillStyle = '#0d0b10'; g.fillRect(x - 1, y - 1, s + 2, s + 2); g.fillStyle = c; g.fillRect(x, y, s, s); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, s, 1); };
        rock(tx + 1, ty + 4, 7, '#6a5e52'); rock(tx + 8, ty + 6, 6, '#5a5048'); rock(tx + 4, ty - 2, 8, '#7a6e60'); rock(tx + 10, ty - 1, 4, '#5a5048');
      }
    }
    o._top = o.y - 18;
  }

  // 전망대: 탑 밖의 하늘을 처음 보는 장면 (천천히 밝아졌다가 사라진다)
  drawVista(w, dt) {
    const v = this.vista, g = this.g, W = this.c.width, H = this.c.height, u = this.u;
    v.t += dt;
    const D = 7, a = v.t < 1.2 ? v.t / 1.2 : v.t > D - 1.5 ? Math.max(0, (D - v.t) / 1.5) : 1;
    if (v.t >= D) { this.vista = null; return; }
    g.save(); g.globalAlpha = a * 0.94;
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0c1030'); sky.addColorStop(0.55, '#3a3060'); sky.addColorStop(0.8, '#c86a5a'); sky.addColorStop(1, '#f0b070');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { const x = ((i * 7919) % 1000) / 1000 * W, y = ((i * 104729) % 1000) / 1000 * H * 0.55; g.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(w.t * 1.5 + i))); g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), Math.round(y), u, u); }
    g.globalAlpha = a;
    // 먼 산 · 아래 마을의 불빛
    g.fillStyle = '#2a2040';
    g.beginPath(); g.moveTo(0, H * 0.82); for (let x = 0; x <= W; x += W / 12) g.lineTo(x, H * (0.74 + 0.06 * Math.sin(x * 0.013 + 1))); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#1a1428'; g.fillRect(0, H * 0.9, W, H * 0.1);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,200,110,${0.5 + 0.5 * Math.sin(w.t * 3 + i * 1.7)})`; g.fillRect(Math.round(W * (0.55 + (i % 7) * 0.025)), Math.round(H * (0.88 + Math.floor(i / 7) * 0.02)), u, u); }
    // 탑 꼭대기의 빛 (세린이 본 그 빛)
    const tx = W * 0.2;
    g.fillStyle = '#100c1c'; g.fillRect(Math.round(tx - 9 * u), Math.round(H * 0.08), 18 * u, H);
    const blink = 0.5 + 0.5 * Math.sin(w.t * 2.2);
    g.fillStyle = `rgba(255,240,180,${0.3 + 0.7 * blink})`; disc(g, tx, H * 0.08, 3 * u);
    g.fillStyle = `rgba(255,240,180,${0.15 * blink})`; disc(g, tx, H * 0.08, 14 * u);
    this.text(v.name, W / 2, H * 0.3, 3 * u, '#fff0d0', 'center', true, true);
    this.text('탑 밖, 처음 보는 하늘', W / 2, H * 0.3 + 26 * u, u, '#f0e0d0', 'center');
    if (v.t > 2.2) { g.globalAlpha = a * Math.min(1, (v.t - 2.2) / 1); this.text('저 위에서, 무언가 깜빡인다.', W / 2, H * 0.3 + 44 * u, u, '#ffe8b0', 'center'); }
    g.restore();
  }

  // 바깥 세계의 움직임: 타오르는 풀, 반짝이는 물
  drawOutdoorLife(w, cx, cy) {
    const g = this.g, VW = this.VW, VH = this.VH;
    let n = 0;
    for (const [k, t] of w.burning) {
      const x = (k % w.tw) * TILE, y = Math.floor(k / w.tw) * TILE;
      if (x < cx - 20 || x > cx + VW + 20 || y < cy - 20 || y > cy + VH + 20) continue;
      const f = 0.6 + 0.4 * Math.sin(w.t * 18 + k);
      g.fillStyle = `rgba(255,120,30,${0.55 * f})`; g.fillRect(x + 2, y + 6, 12, 9);
      g.fillStyle = `rgba(255,220,90,${0.7 * f})`; g.fillRect(x + 5, y + 8 - f * 3, 6, 6);
      if (n++ < 60 && Math.random() < 0.35) this.parts.push({ x: x + 3 + Math.random() * 10, y: y + 10, vx: (Math.random() - 0.5) * 12, vy: -30 - Math.random() * 25, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd040', g: -20, glow: true, size: 1 });
      if (Math.random() < 0.04) this.parts.push({ x: x + 8, y: y + 2, vx: 4, vy: -14, t: 1.4, max: 1.4, color: '#5a5048', g: -4, size: 2 });
    }
    // 물 반짝임 (보이는 물 칸 몇 개만)
    const x0 = Math.max(0, Math.floor(cx / TILE)), y0 = Math.max(0, Math.floor(cy / TILE)), x1 = Math.min(w.tw - 1, Math.ceil((cx + VW) / TILE)), y1 = Math.min(w.th - 1, Math.ceil((cy + VH) / TILE));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = w.tiles[y * w.tw + x];
      if (t !== T_DEEP && t !== T_LIQUID) continue;
      const ph = (w.t * 0.8 + hash(x, y, 77) / 4294967296 * 6) % 6;
      if (ph < 0.5) { g.fillStyle = `rgba(255,255,255,${0.7 * Math.sin(ph / 0.5 * Math.PI)})`; const hx = hash(x, y, 78) % 12, hy = hash(x, y, 79) % 12; g.fillRect(x * TILE + hx, y * TILE + hy + 2, 3, 1); g.fillRect(x * TILE + hx + 1, y * TILE + hy + 1, 1, 1); }
    }
  }

  drawProp(w, pr) {
    const g = this.g, x = pr.x * TILE, y = pr.y * TILE;
    if (w.map.outdoor) return drawOutdoorProp(g, pr, w.t, false, w.burntTrees);
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
      else if (o.kind === 'camp') { hole(o.x + 11, o.y - 2, 80); colored.push([o.x + 11, o.y - 2, 60, '#ffa040']); }
      else if (o.kind === 'shrine' && !o.opened) { hole(o.x, o.y - 28, 40, 0.8); colored.push([o.x, o.y - 28, 30, '#c9a8ff']); }
      else if (o.kind === 'stairs' || o.kind === 'merchant' || o.kind === 'npc') { hole(o.x, o.y - 6, 40, 0.7); }
      else if (o.kind === 'barrier') { if (!o.opened && o.look === 'thorn') hole(o.x, o.y - 4, 26, 0.5); }
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
    for (const o of w.objects) if (o.npc && o._top != null && Math.abs(o.x - w.player.x) < 220) this.text(o.npc.name, this.sx(o.x), this.sy(o._top - 5), u, '#ffe8a8', 'center');
    if (w.mode === 'plaza') {
      for (const o of w.objects) if (o.npc && o._top != null && false) this.text(o.npc.name, this.sx(o.x), this.sy(o._top - 5), u, '#ffe8a8', 'center');
      for (const e of w.enemies) if (e.def.ai === 'dummy') {
        this.text(e.def.name, this.sx(e.x), this.sy(e.y + 14), u, '#d8d0e8', 'center');
        if (e.dps > 0) this.text(`DPS ${Math.round(e.dps)}`, this.sx(e.x), this.sy(e.y - 20), u, '#ffcf5a', 'center', true, true);
      }
      for (const o of w.objects) if (o.kind === 'gate') this.text(o.label.split(' (')[0], this.sx(o.x), this.sy(o.y + 12), u, o.color, 'center');
    }
    for (const e of w.enemies) if (e.affix && !e.champion && e._top != null && Math.abs(e.x - w.player.x) < 200 && Math.abs(e.y - w.player.y) < 130) {
      this.text(`${AFFIXES[e.affix].name} ${e.def.name}`, this.sx(e.x), this.sy(e._top - 8), Math.max(1, u - 1), AFFIXES[e.affix].color, 'center', true);
    }
    for (const e of w.enemies) if ((e.def.elite || e.champion) && e._top != null && Math.abs(e.x - w.player.x) < 260 && Math.abs(e.y - w.player.y) < 160) {
      this.text(e.champion || e.def.name, this.sx(e.x), this.sy(e._top - 8), u, '#ff9a8a', 'center', true, true);
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
    if (face) { g.imageSmoothingEnabled = false; const fs = Math.floor((pw - 4 * u) / 16); g.drawImage(face, Math.round((face.width - 16) / 2), face.height - 24, 16, 16, m + (pw - 16 * fs) / 2, m + (pw - 16 * fs) / 2, 16 * fs, 16 * fs); }
    const bx = m + pw + 6 * u, bw = 110 * u, bh = 10 * u;
    this.panel(bx, m, bw, bh);
    const hpK = Math.max(0, p.hp / d.maxHp);
    g.fillStyle = '#3a1016'; g.fillRect(bx + u, m + u, bw - 2 * u, bh - 2 * u);
    g.fillStyle = '#c8303c'; g.fillRect(bx + u, m + u, (bw - 2 * u) * hpK, bh - 2 * u);
    g.fillStyle = '#ff6a6a'; g.fillRect(bx + u, m + u, (bw - 2 * u) * hpK, 2 * u);
    if (p.shield > 0) { g.fillStyle = '#a8d8ff'; g.fillRect(bx + u, m + bh - 3 * u, (bw - 2 * u) * Math.min(1, p.shield / d.maxHp), 2 * u); }
    this.text(`${Math.ceil(p.hp)} / ${d.maxHp}`, bx + bw / 2, m + bh / 2, u, '#ffffff', 'center');
    // 종족 자원 게이지
    let ry = m + bh + 3 * u;
    const R = RACES[w.b.race]?.res;
    if (R) {
      const gh = 7 * u;
      this.panel(bx, ry, bw, gh);
      g.fillStyle = '#0d0b18'; g.fillRect(bx + u, ry + u, bw - 2 * u, gh - 2 * u);
      const k = Math.max(0, Math.min(1, p.res / 100));
      g.fillStyle = R.color; g.fillRect(bx + u, ry + u, (bw - 2 * u) * k, gh - 2 * u);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(bx + u, ry + u, (bw - 2 * u) * k, u);
      for (const t of [0.25, 0.5, 0.75]) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(bx + u + (bw - 2 * u) * t, ry + u, u, gh - 2 * u); }
      if (k >= 1 && Math.floor(w.t * 4) % 2) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx + u, ry + u, bw - 2 * u, gh - 2 * u); }
      this.text(`${R.name} ${Math.floor(p.res)}`, bx + bw / 2, ry + gh / 2, Math.max(1, u - 1), '#ffffff', 'center');
      ry += gh + 2 * u;
      if (w.b.cls === 'necromancer') { this.text(`거둔 영혼 ${p.souls.length} / 10`, bx, ry + 5 * u, Math.max(1, u - 1), '#7ae8ff'); ry += 10 * u; }
      if (w.b.race === 'wizard') { const el = ELEM[p.elem]; this.text(`속성: ${el.name}${w.zElem?.weak === p.elem ? ' (약점!)' : w.zElem?.resist === p.elem ? ' (내성)' : ''}`, bx, ry + 5 * u, Math.max(1, u - 1), el.color); ry += 10 * u; }
    }
    // 버프
    let bxx = bx;
    for (const [id, bf] of Object.entries(p.buffs)) {
      if (id === 'nextCrit') { this.text('다음 치명타', bxx, ry + 5 * u, Math.max(1, u - 1), '#ffe040'); bxx += 50 * u; continue; }
      const nm = Object.values(SKILLS).find((sk) => sk.do.some((o) => o.op === 'buff' && o.id === id))?.name || id;
      this.text(`${nm} ${bf.t.toFixed(1)}`, bxx, ry + 5 * u, Math.max(1, u - 1), bf.color || '#ffffff');
      bxx += 56 * u;
    }
    if (Object.keys(p.buffs).length) ry += 10 * u;
    // 상태이상
    const names = { burn: ['화상', '#ff7a2a'], poison: ['중독', '#9be15d'], bleed: ['출혈', '#e0445a'], chill: ['냉기', '#9fe3ff'] };
    let sxx = bx;
    for (const k of Object.keys(p.st)) { this.text(names[k][0], sxx, ry + 5 * u, u, names[k][1]); sxx += 30 * u; }
    this.drawSkillBar(w);

    if (w.mode === 'field') this.drawMinimap(w);
    else if (!document.body.classList.contains('touch')) {
      const hint = document.body.classList.contains('touch') ? '시설 가까이 가서 확인 버튼 · 캐릭터 버튼으로 스탯 배분' : 'WASD 이동 · 좌클릭 공격 · 우클릭 무기 기술 · Q·E·R·F 스킬 · Space 대시 · G 상호작용 · C 캐릭터';
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
      this.text('G', tx - tw2 / 2 + 8 * u, ty, u, '#241a00', 'center', false, true);
      this.text(label, tx + 7 * u, ty, u, '#ffffff', 'center', false);
    }

    // 정예 체력바
    const boss = w.enemies.find((e) => (e.def.elite || e.champion) && e.state === 'chase' && !e.dead);
    if (boss) {
      const bw2 = Math.min(W * 0.5, 260 * u), bx2 = (W - bw2) / 2, by2 = H - 26 * u;
      this.text(boss.champion || boss.def.name, W / 2, by2 - 9 * u, u, '#ff9a8a', 'center', true, true);
      this.panel(bx2, by2, bw2, 8 * u);
      g.fillStyle = '#3a1016'; g.fillRect(bx2 + u, by2 + u, bw2 - 2 * u, 6 * u);
      g.fillStyle = '#e8483a'; g.fillRect(bx2 + u, by2 + u, (bw2 - 2 * u) * boss.hp / boss.maxHp, 6 * u);
    }

    if (this.notes?.length) this.drawNotes(dt);
    if (this.vista) this.drawVista(w, dt);
    if (this.banner) {
      this.banner.t -= dt;
      g.globalAlpha = Math.min(1, this.banner.t * 1.5);
      this.text(this.banner.text, W / 2, H * 0.22, 3 * u, this.banner.color, 'center', true, true);
      if (this.banner.sub) this.text(this.banner.sub, W / 2, H * 0.22 + 26 * u, u, '#d8d0e8', 'center');
      g.globalAlpha = 1;
      if (this.banner.t <= 0) this.banner = null;
    }
  }

  // 스킬바: 대시 + 장착 스킬 4칸 (화면 아래 가운데)
  drawSkillBar(w) {
    const g = this.g, p = w.player, d = w.d, u = this.u, v = Math.max(2, u), W = this.c.width, H = this.c.height;
    const touch = document.body.classList.contains('touch');
    const box = (touch ? 16 : 20) * v, gap = 12 * v;
    const slots = [...(w.b.skills || []).filter((x) => x !== 'weapon'), 'weapon'];
    const keys = [...['Q', 'E', 'R', 'F'].slice(0, slots.length - 1), touch ? '무기' : '우클릭'];
    const n = slots.length + 1;
    const total = n * box + (n - 1) * gap;
    const x0 = touch ? 10 * u : (W - total) / 2, y0 = touch ? 10 * v + 70 * v : H - box - 12 * v;
    // 대시
    const dashMax = d.dashCd * (1 - d.cdr), dashK = p.dashCharges > 0 ? 1 : Math.min(1, 1 - p.dashRecharge / dashMax);
    this.cooldownBox(x0, y0, box, dashK, touch ? '대시' : 'Space', '');
    slots.forEach((id, i) => {
      const x = x0 + (i + 1) * (box + gap);
      if (id === 'weapon') {
        const k = p.skillCd > 0 ? 1 - p.skillCd / p.skillMax : 1;
        this.cooldownBox(x, y0, box, k, keys[i], '');
        this.text((WEAPON_SKILLS[w.b.weapon.skill]?.name || '무기').slice(0, 4), x + box / 2, y0 + box + (7 + (i % 2) * 9) * v, Math.max(1, u - 1), '#d8d0e8', 'center');
        return;
      }
      const sk = SKILLS[id];
      const cd = p.cds[id] || 0, max = p.cdMax?.[id] || sk.cd;
      const k = cd > 0 ? 1 - cd / max : 1;
      const need = sk.costAll ? sk.costAll.min : sk.cost || 0;
      const lack = need > p.res;
      this.cooldownBox(x, y0, box, k, keys[i], '', ROLE_COLOR[sk.role]);
      if (lack && k >= 1) { g.fillStyle = 'rgba(40,0,0,0.55)'; g.fillRect(x + u, y0 + u, box - 2 * u, box - 2 * u); }
      this.text(sk.name.slice(0, 4), x + box / 2, y0 + box + (7 + (i % 2) * 9) * v, u, lack ? '#ff8a80' : '#d8d0e8', 'center');
      if (need) this.text(String(need), x + box - 3 * v, y0 + 5 * v, Math.max(1, u - 1), lack ? '#ff8a80' : RACES[w.b.race].res.color, 'right');
    });
    // 시전바
    if (p.castT > 0) {
      const cw = 90 * v, cx = W / 2 - cw / 2, cy = touch ? H * 0.62 : y0 - 18 * v;
      this.panel(cx, cy, cw, 7 * v);
      g.fillStyle = '#7aa8ff'; g.fillRect(cx + u, cy + u, (cw - 2 * u) * (1 - p.castT / p.castMax), 5 * u);
      this.text(`${p.castSkill?.def.name || ''} 시전 중`, W / 2, cy - 6 * v, u, '#c8d8ff', 'center');
    }
  }

  cooldownBox(x, y, s, k, key, label, border) {
    const g = this.g, u = this.u;
    this.panel(x, y, s, s);
    if (border) { g.fillStyle = border; g.fillRect(x, y + s - 2 * u, s, 2 * u); }
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
    const s = u * 0.75, mw = Math.round(w.tw * s), mh = Math.round(w.th * s);
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
      else if (o.kind === 'camp') dot(o.x, o.y, '#ffa040', 2);
      else if (o.kind === 'merchant') dot(o.x, o.y, '#7be38a', 2);
      else if (o.kind === 'shrine' && !o.opened) dot(o.x, o.y, '#c9a8ff');
      else if (o.kind === 'stairs') dot(o.x, o.y, '#ff6040', 2);
      else if (o.kind === 'journal' && !o.read) dot(o.x, o.y, '#f0e0b0', 2);
      else if (o.kind === 'npc') dot(o.x, o.y, '#7be38a', 2);
      else if (o.kind === 'barrier' && !o.opened) dot(o.x, o.y, '#d07a4a', 1.5);
    }
    for (const e of w.enemies) if ((e.def.elite || e.champion) && seen(e.x, e.y)) dot(e.x, e.y, '#ff4040', 2);
    if (Math.floor(w.t * 4) % 2 === 0) dot(w.player.x, w.player.y, '#ffffff', 1.5);
    let y = my + mh + 12 * u;
    if (!this.pctT || this.pctT < w.t) { this.pctT = w.t + 0.5; this.pctV = Math.round(w.exploredPct() * 100); }
    this.text(`${w.zone.name}${w.depth ? ` 지하 ${w.depth + 1}층` : ''} · 탐험 ${this.pctV}%`, mx + mw, y, u, '#d8d0e8', 'right');
    if (w.loot.banked) { y += 14 * u; this.text('야영지에 잔향을 맡김', mx + mw, y, Math.max(1, u - 1), '#ffd88a', 'right'); }
    y += 16 * u;
    for (const [id, n] of Object.entries(w.loot.echoes)) {
      this.text(`◆ ${ECHOES[id].name} ${n}`, mx + mw, y, u, ECHOES[id].color, 'right');
      y += 14 * u;
    }
    this.text(`골드 ${w.loot.gold}`, mx + mw, y, u, '#ffcf5a', 'right');
    if (w.goalNeeds?.length) {
      y += 20 * u;
      this.text('★ 목표 잔향', mx + mw, y, u, '#ffcf5a', 'right');
      for (const gn of w.goalNeeds) {
        y += 14 * u;
        const got = Math.min(gn.need, gn.have + (w.loot.echoes[gn.id] || 0));
        this.text(`${ECHOES[gn.id].name} ${got}/${gn.need}`, mx + mw, y, Math.max(1, u - 1), got >= gn.need ? '#8af08a' : ECHOES[gn.id].color, 'right');
      }
    }
    const obj = w.zone.id === 'cave' && !w.depth ? storyObjective(w.story) : null;
    if (obj) {
      y += 20 * u;
      this.text('✦ 이야기', mx + mw, y, u, '#f0e0b0', 'right');
      for (const line of obj) { y += 14 * u; this.text(line, mx + mw, y, Math.max(1, u - 1), '#e8dcc0', 'right'); }
    }
  }

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
  }
}

function fmt(v) { return v >= 1 ? String(Math.round(v)) : v.toFixed(1); }
// 펼친 일지 (읽은 것은 어둡게)
function drawBook(g, x, y, read) {
  g.fillStyle = '#0d0b10'; g.fillRect(x - 6, y - 5, 12, 7);
  g.fillStyle = read ? '#b8a888' : '#efe2c0'; g.fillRect(x - 5, y - 4, 5, 5); g.fillRect(x + 1, y - 4, 4, 5);
  g.fillStyle = '#6a4a2a'; g.fillRect(x, y - 4, 1, 6);
  g.fillStyle = '#8a7a5a'; g.fillRect(x - 4, y - 3, 3, 1); g.fillRect(x - 4, y - 1, 3, 1); g.fillRect(x + 2, y - 3, 2, 1); g.fillRect(x + 2, y - 1, 2, 1);
}
// 이야기 물건 아이콘
function drawStoryItem(g, id, x, y) {
  const P = (c, dx, dy, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  if (id === 'mapScrap') { P('#0d0b10', -4, -4, 8, 8); P('#e8d8a8', -3, -3, 6, 6); P('#a89060', -2, -1, 3, 1); P('#c06040', 1, 0, 1, 1); P('#a89060', -1, 1, 2, 1); }
  else if (id === 'glowMoss') { P('#0d0b10', -3, -3, 7, 6); P('#3a9a6a', -2, -2, 5, 4); P('#7affc8', -1, -2, 2, 2); P('#e8fff4', 1, 0, 1, 1); }
  else if (id === 'rustyKey') { P('#0d0b10', -4, -3, 9, 6); P('#d0a868', -3, -2, 3, 3); P('#d0a868', 0, -1, 4, 1); P('#d0a868', 3, 0, 1, 1); P('#3a2a18', -2, -1, 1, 1); }
  else { P('#0d0b10', -3, -4, 6, 8); P('#9affd8', -2, -3, 4, 6); P('#ffffff', -1, -2, 1, 2); }
}
function hexA(hex, a) {
  if (!hex) hex = '#ffffff';
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

function lerpAngle(a, b, t) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; }

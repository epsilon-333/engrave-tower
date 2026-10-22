// 캔버스 렌더러: world 상태를 읽어서 그리기만 한다 (게임 로직 없음)
// 화면 크기에 맞춰 정수 배율(S)로 도트를 키우고, 글씨는 실제 해상도로 따로 그린다.
import { TILE, T_LIQUID, T_WALL, T_CRACK, T_BUILD, T_DEEP } from '../sim/mapgen.js';
import { paintTile, drawOutdoorProp, renderChunk, CHUNK, drawRelic, drawSign, drawTurtle } from './outdoor.js';
import { renderInterior, drawInteriorProp } from './interior.js';
import { drawNode, drawDig, drawToolAt, swingAngle, drawFishing, drawSoil, drawCrop } from './lifefx.js';
import { iconCanvas } from './icons.js';
import { GOODS, FISH, ARTIFACTS } from '../data/goods.js';
import { SANCTUMS } from '../data/sanctums.js';
import { drawLeader, drawResident, drawVfx, drawFlyers, drawTrainTarget, drawTrainBoard, drawQuestThing, drawTrainHud, drawBubbles, drawBonePile } from './village.js';
import { LANDMARK_BOX } from './landmarks.js';
import { PixelCtx } from './pixelctx.js';
import { flameSprite, puffSprite, sparkSprite, dustSprite, BAYER4 } from './pxfx.js';
import { spiritSprite } from './spirits.js';
import { G, BIOME_LIST } from '../data/maps/overworld.js';
import { getSprite, drawEchoGem } from './sprites.js';
import { sprite, frames, atlas } from './assets.js';
import { renderMap, hash } from './tiles.js';
import { ECHOES, AFFIXES } from '../data/monsters.js';
import { WEAPON_SKILLS, ITEMS, OFF_LOOK } from '../data/items.js';
import { SKILLS, ELEM, ROLE_COLOR } from '../data/skills.js';
import { RACES } from '../data/races.js';
import { RACE_ART, MONSTER_ART, NPC_ART, WEAPON_ART, weaponArt } from '../data/art.js';
import { STORY_ITEMS, storyObjective, pinoTalk } from '../data/story.js';
import { sfx, tone } from '../audio.js';
import { skyColor, darkness, clockText, partOfDay } from '../sim/time.js';

const FONT = 'Galmuri11, "Malgun Gothic", sans-serif';
const GLOW = { glowshroom: [26, '#5affd0'], candle: [30, '#ffb04a'], brazier: [46, '#ffa040'], ember: [18, '#ff7a2a'], crystalB: [22, '#7ad8ff'], crystalR: [22, '#ff5a2a'], glowPlant: [24, '#7af0ff'] };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// 활을 겨눈 손: 어깨에서 조준 쪽으로 팔을 뻗은 자리 (위 · 아래로 쏠 때도 활이 겨눈 쪽에 온다)
const bowHand = (a) => ({ hx: 1 + Math.cos(a) * 11, hy: -9 + Math.sin(a) * 10 });
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
// 용언 문장: 첫 단어는 꾸밈말, 둘째는 주어, 셋째는 끝말이 되어 한 줄의 용의 말이 된다
const WORD_PHRASE = {
  fire: ['타오르는', '불꽃이', '불사른다'], sky: ['드높은', '하늘이', '내리친다'], scale: ['굳센', '비늘이', '감싼다'],
  wing: ['날랜', '날개가', '휘몰아친다'], earth: ['깊은', '대지가', '뒤흔든다'],
};
const sentenceLine = (ws) => `${WORD_PHRASE[ws[0]]?.[0] || ''} ${WORD_PHRASE[ws[1]]?.[1] || ''} ${WORD_PHRASE[ws[2]]?.[2] || ''}`.trim();
const WORD_COLOR = { fire: '#ff7a2a', sky: '#ffcf5a', scale: '#ffb066', wing: '#bfffd0', earth: '#c8a878' };

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.g = this.mainG = canvas.getContext('2d');
    // 세계는 1배(도트) 해상도 판에 그린 뒤 화면 배율로 키운다: 원 · 선 · 빛도 스프라이트와 같은 크기의 도트가 된다
    this.lo = document.createElement('canvas');
    this.wg = new PixelCtx(this.lo.getContext('2d'));
    this.light = document.createElement('canvas');
    this.lg = new PixelCtx(this.light.getContext('2d')); // 빛 · 어둠도 계단식 띠 + 바둑판 점묘 (흐릿한 그라데이션 대신)
    this.mouse = null; this.tipRects = []; // 왼쪽 위 효과 목록에 마우스를 올리면 설명
    canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); this.mouse = { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height }; });
    canvas.addEventListener('mouseleave', () => { this.mouse = null; });
    this.fx = []; this.texts = []; this.parts = []; this.corpses = []; this.ambient = [];
    this.alerts = new Map(); this.squash = new Map(); this.chestOpen = new Map(); this.lunge = new Map();
    this.shake = 0; this.banner = null; this.hitstop = 0; this.fade = 1; this.hurtFlash = 0; this.flash = null; this.ultName = null;
    this.cam = { x: 0, y: 0 };
    this.world = null; this.lastStep = 0;
    this.resize(document.documentElement.clientWidth || innerWidth, document.documentElement.clientHeight || innerHeight, devicePixelRatio || 1);
  }

  resize(cssW, cssH, dpr) {
    const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    this.c.width = W; this.c.height = H;
    this.baseS = Math.max(2, Math.round(Math.max(W, H) / 480));
    this.u = Math.max(1, Math.round(this.baseS / 2)); // 글씨 배율 (Galmuri11 × u)
    this.applyZoom(this.world);
  }
  // 화면 배율: 집 안은 방이 화면에 꽉 차게 크게 (글씨 · 화면 표시는 그대로)
  applyZoom(w) {
    const W = this.c.width, H = this.c.height;
    let S = this.baseS || 2;
    if (w?.map?.indoor) S = Math.max(S, Math.min(S * 2, Math.floor(Math.min(W / ((w.tw + 2) * TILE), H / ((w.th + 4) * TILE)))));
    this.S = S; this.VW = Math.ceil(W / S); this.VH = Math.ceil(H / S);
    this.light.width = this.VW; this.light.height = this.VH;
    if (this.lo) { this.lo.width = this.VW; this.lo.height = this.VH; }
  }

  // 세계 판의 좌표계: 세계 좌표 (카메라만큼 옮긴 1배 칸) · 화면 크기 그림(빛 판)을 카메라 자리에
  worldTf(g = this.g) { g.setTransform(1, 0, 0, 1, -this.cx, -this.cy); }
  viewTf(g = this.g) { g.setTransform(1, 0, 0, 1, 0, 0); }

  // 화면 좌표 → 월드 좌표 (마우스)
  toWorld(clientX, clientY) {
    const r = this.c.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * this.VW + this.cam.x, y: ((clientY - r.top) / r.height) * this.VH + this.cam.y };
  }

  setWorld(w) {
    this.world = w;
    this.applyZoom(w);
    this.chunks = null; this.mapCanvas = null; this.bigMap = false;
    if (w.map.outdoor) {
      // 큰 세계는 16×16칸 조각으로 나눠, 보이는 조각만 그린다 (장식은 조각마다 미리 나눠 둔다). 집에서 나오면 그려 둔 조각을 그대로 쓴다
      const S = CHUNK * TILE;
      if (w._chunks) { this.chunks = w._chunks; this.decoBuckets = w._decoBuckets; }
      else {
        this.chunks = w._chunks = new Map(); this.decoBuckets = w._decoBuckets = new Map();
        for (const d of w.map.deco) { const k = `${Math.floor(d.x / S)},${Math.floor(d.y / S)}`; if (!this.decoBuckets.has(k)) this.decoBuckets.set(k, []); this.decoBuckets.get(k).push(d); }
      }
      const hw = (this.VW || 640) / 2 + S, hh = (this.VH || 400) / 2 + S; // 처음 보이는 곳은 미리 다 그려 둔다
      for (let cy = Math.floor((w.player.y - hh) / S); cy <= Math.floor((w.player.y + hh) / S); cy++) for (let cx = Math.floor((w.player.x - hw) / S); cx <= Math.floor((w.player.x + hw) / S); cx++) this.chunkAt(w, cx, cy, true);
    } else { this.mapCanvas = w.map.indoor ? renderInterior(w) : renderMap(w); this.mapCanvasNight = w.map.indoor ? renderInterior(w, true) : null; }
    this.fx = []; this.texts = []; this.parts = []; this.corpses = []; this.ambient = []; this.alerts.clear(); this.squash.clear(); this.chestOpen.clear();
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
    const x0 = k % w.tw, y0 = Math.floor(k / w.tw), S = CHUNK * TILE;
    for (let y = y0 - 1; y <= y0 + 1; y++) for (let x = x0 - 1; x <= x0 + 1; x++) {
      if (x < 0 || y < 0 || x >= w.tw || y >= w.th) continue;
      const c = this.chunks?.get(`${Math.floor(x / CHUNK)},${Math.floor(y / CHUNK)}`);
      if (!c) continue; // 아직 안 그린 조각은 나중에 그릴 때 반영된다
      const g = c.getContext('2d'), ox = Math.floor(x / CHUNK) * S, oy = Math.floor(y / CHUNK) * S;
      g.setTransform(1, 0, 0, 1, -ox, -oy); paintTile(g, w, x, y, ox, oy); g.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (w.explored[k]) w.revealed.push(k);
  }
  chunkAt(w, cx, cy, force) {
    if (cx < 0 || cy < 0 || cx * CHUNK >= w.tw || cy * CHUNK >= w.th) return null;
    const key = `${cx},${cy}`;
    let c = this.chunks.get(key);
    if (!c && force) { c = renderChunk(w, cx, cy, this.decoBuckets.get(key)); this.chunks.set(key, c); this.chunkFresh++; }
    return c;
  }
  // 보이는 조각 그리기: 화면에 든 조각은 바로 그리고, 이번 프레임에 새로 그린 게 없으면 주변 조각을 하나씩 미리 그려 둔다
  drawChunks(w, cx, cy) {
    const g = this.g, S = CHUNK * TILE;
    this.chunkFresh = 0;
    const x0 = Math.floor(cx / S), y0 = Math.floor(cy / S), x1 = Math.floor((cx + this.VW) / S), y1 = Math.floor((cy + this.VH) / S);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = this.chunkAt(w, x, y, true); if (c) g.drawImage(c, x * S, y * S); }
    if (!this.chunkFresh) {
      pre: for (let r = 1; r <= 2; r++) for (let y = y0 - r; y <= y1 + r; y++) for (let x = x0 - r; x <= x1 + r; x++) {
        if (x >= x0 - r + 1 && x <= x1 + r - 1 && y >= y0 - r + 1 && y <= y1 + r - 1) continue; // 이번 고리만
        if (!this.chunks.has(`${x},${y}`) && this.chunkAt(w, x, y, true)) break pre;
      }
    }
    // 멀리 떨어진 조각은 버린다 (다시 오면 지금 땅 모습 그대로 다시 그린다)
    if (this.chunks.size > 180) {
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const far = [...this.chunks.keys()].map((k) => { const [a, b] = k.split(',').map(Number); return [k, Math.abs(a - mx) + Math.abs(b - my)]; }).sort((p, q) => q[1] - p[1]);
      for (let i = 0; i < far.length - 120; i++) this.chunks.delete(far[i][0]);
    }
  }

  applyReveal(all) {
    const w = this.world;
    const paint = (i) => {
      const x = i % w.tw, y = (i / w.tw) | 0, t = w.tiles[i];
      this.fg.clearRect(x, y, 1, 1);
      if (w.map.outdoor) {
        const gr = w.map.ground[i];
        this.mg.fillStyle = gr === G.LAVA ? '#e8501a' : gr === G.BOG && (t === T_DEEP || t === T_LIQUID) ? '#4e5a2a' : t === T_DEEP ? '#2c5a8a' : t === T_LIQUID ? '#4a8ab8' : t === T_WALL || t === T_CRACK ? '#6a5a48' : t === T_BUILD ? '#3e5a2e'
          : ({ [G.DIRT]: '#a8834f', [G.SAND]: '#d8c88e', [G.ROCK]: '#8a9076', [G.SNOW]: '#e8eef4', [G.STONE]: '#b0aca6', [G.FOREST]: '#3d6b2f', [G.BURNT]: '#3a3028', [G.ICE]: '#c4ecf8', [G.THIN]: '#8ccbe2', [G.ASH]: '#6e6866', [G.BLACKROCK]: '#3e383a', [G.REDSAND]: '#c87a4a', [G.CRACKED]: '#b08a5a', [G.MUD]: '#5e4c34', [G.DEADGRASS]: '#8a8458', [G.JUNGLE]: '#2f6a2a', [G.COBBLE]: '#8a8680', [G.OBSIDIAN]: '#2a2232', [G.STAIRS]: '#b6b2ab', [G.BRIDGE]: '#9a6a3c', [G.TALL]: '#4e8a30' })[gr] || '#5d9e3b';
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
      if (this.lifeEvent(w, ev)) continue;
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
        case 'dodgeFx': { // 회피: 큰 「회피!」 + 맞을 쪽 반대로 비켜서는 흐린 잔영
          this.texts.push({ x: ev.x, y: ev.y - 20, text: '회피!', color: '#bfffe0', t: 0.9, vy: -18, vx: 0, label: true, size: 2, pop: 0.15 });
          const sd = ev.x >= ev.fx ? 1 : -1;
          this.fx.push({ k: 'line', x1: ev.x - sd * 8, y1: ev.y - 6, x2: ev.x + sd * 6, y2: ev.y - 6, t: 0.25, max: 0.25 });
          this.dodgeLean = { t: 0.18, sd };
          sfx('dash', { vol: 0.35, rate: 1.4 });
          break;
        }
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
          if (ev.enchant) this.enchantTrail(ev);
          sfx(ev.whip ? 'swing' : ev.heavy ? 'heavySwing' : 'swing', { vol: 0.55, rate: ev.whip ? 1.5 : ev.fist ? 1.7 : 1 });
          break;
        }
        case 'shoot': sfx(ev.type === 'mag' ? 'cast' : 'shoot', { vol: 0.4, rate: ev.type === 'mag' ? 1.6 : 1.3 }); break;
        case 'spin': {
          const pl = this.world?.player, own = !!pl && Math.hypot(ev.x - pl.x, ev.y - pl.y) < 40; // 내가 도는 베기: 칼 잔상이 그린다
          if (own) this.trailStyle = { col: ev.heavy ? '#ffd870' : ev.type === 'mag' ? '#c9a8ff' : '#dcecff', reach: ev.r || 40, until: (this.world?.t || 0) + 0.45 };
          this.fx.push({ k: 'spin', ...ev, own, a0: ev.ang ?? Math.random() * 6.28, dir: ev.dir || (Math.random() < 0.5 ? 1 : -1), t: 0.3, max: 0.3 });
          // 발밑 흙먼지가 바깥으로 튄다
          for (let i = 0; i < (ev.heavy ? 12 : 7); i++) { const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 60; this.parts.push({ x: ev.x + Math.cos(a) * 4, y: ev.y + 2 + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.45, t: 0.5, max: 0.5, color: '#d8ccb4', g: -8, steam: true }); }
          this.shake = Math.max(this.shake, ev.heavy ? 4 : 2.5); sfx('heavySwing', { vol: 0.7, rate: 0.9 + Math.random() * 0.2 });
          break;
        }
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
          this.banner = { text: ev.name, sub: [ev.lv ? `권장 Lv ${ev.lv[0]}~${ev.lv[1]}` : '', ev.first ? '새 장소 발견 · 도감 +2' : ''].filter(Boolean).join(' · '), t: ev.first ? 3 : 2.2, color: '#e8dcc0' };
          if (ev.first) sfx('levelup', { vol: 0.4, rate: 1.2 });
          break;
        case 'vista': this.vista = { t: 0, name: ev.name }; sfx('levelup', { vol: 0.5, rate: 0.6 }); break;
        case 'codexStage':
          this.note(ev.stage >= 3 ? `도감 · ${ev.name} 완성!` : `도감 · ${ev.name} ${ev.stage}단계 (다음: ${ev.next}마리)`, ev.stage >= 3 ? '#ffe080' : '#c8e8ff');
          this.texts.push({ x: ev.x, y: ev.y - 20, text: ev.stage >= 3 ? '도감 완성' : `도감 ${ev.stage}단계`, color: '#c8e8ff', t: 1.4, vy: -12, vx: 0, label: true });
          sfx('echo', { vol: 0.5, rate: 0.8 });
          break;
        case 'shardGet': {
          const S = SANCTUMS[ev.race];
          this.note(`${S.relic} 조각 (${S.name})`, S.color);
          this.texts.push({ x: ev.x, y: ev.y - 18, text: `+${S.relic} 조각`, color: S.color, t: 1.4, vy: -12, vx: 0, label: true });
          this.burst(ev.x, ev.y, S.color, 10, 50);
          sfx('echo', { vol: 0.5, rate: 1.3 });
          break;
        }
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
          if ((this.noManaT || 0) < w.t) { this.noManaT = w.t + 1; this.texts.push({ x: ev.x, y: ev.y - 22, text: '마력 부족', color: '#7aa8ff', t: 0.9, vy: -14, vx: 0, label: true }); sfx('error', { vol: 0.3 }); }
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
        case 'lockOn': sfx('open', { vol: 0.25, rate: 1.8 }); break; // 자동 조준 표적은 그리지 않는다 (네 모서리 꺾쇠가 바닥의 노란 화살표처럼 보였다)
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
        case 'zoneFx': if (ev.kind === 'smoke') { for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 60; this.parts.push({ x: ev.x, y: ev.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 10, t: 1.2, max: 1.2, color: '#d0d2dc', g: -4, steam: true }); } sfx('dash', { vol: 0.6, rate: 0.5 }); break; }
          if (ev.kind === 'trap' || ev.kind === 'bait') { this.burst(ev.x, ev.y, ev.kind === 'trap' ? '#8a7a5a' : '#c8504a', 8, 40); sfx('step', { vol: 0.5, rate: 0.8 }); break; }
          this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r * 1.1, color: ev.kind === 'slow' ? '#b98aff' : ev.kind === 'frost' ? '#c8f0ff' : ev.kind === 'trap' ? '#9be15d' : ev.kind === 'arrows' ? '#ffe080' : '#ff8a3a', t: 0.4, max: 0.4, w: 3 }); break;
        case 'arrowDrop': this.fx.push({ k: 'arrowDrop', x: ev.x, y: ev.y, t: 0.18, max: 0.18 }); if (Math.random() < 0.3) sfx('shoot', { vol: 0.25, rate: 1.6 }); break;
        case 'skillDash': {
          const col = ELEM[ev.elem]?.color || '#ffffff';
          this.fx.push({ k: 'trail', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, color: col, t: 0.3, max: 0.3, w: 10 });
          for (let i = 1; i <= 3; i++) { const u = i / 4; this.fx.push({ k: 'ghost', x: ev.x1 + (ev.x2 - ev.x1) * u, y: ev.y1 + (ev.y2 - ev.y1) * u, t: 0.12 + u * 0.14, max: 0.26, dir: ev.x2 > ev.x1 ? 1 : -1 }); }
          for (let i = 0; i < 5; i++) this.parts.push({ x: ev.x1 + (Math.random() - 0.5) * 6, y: ev.y1 + 2, vx: (ev.x1 - ev.x2) * 0.4 + (Math.random() - 0.5) * 20, vy: -6, t: 0.45, max: 0.45, color: '#c8bca8', g: -4, steam: true });
          this.shake = Math.max(this.shake, 2); sfx('dash', { vol: 0.7 }); sfx('swing', { vol: 0.5, rate: 0.8 });
          break;
        }
        case 'blink':
          for (const [x, y] of [[ev.x1, ev.y1], [ev.x2, ev.y2]]) for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 40; this.parts.push({ x: x + Math.cos(a) * 4, y: y - 8 + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 8, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#3a2e58' : '#6a5a9a', g: -6, steam: true }); }
          this.fx.push({ k: 'ghost', x: ev.x1, y: ev.y1, t: 0.3, max: 0.3 });
          sfx('dash', { vol: 0.6, rate: 1.4 });
          break;
        case 'danceDash': { // 그림자 춤: 적 사이를 달려 지나가며 벤다 (지나간 길에 잔상)
          const ddx = ev.x2 - ev.x1, ddy = ev.y2 - ev.y1, dl = Math.hypot(ddx, ddy) || 1, ux = ddx / dl, uy = ddy / dl;
          for (let i = 1; i <= 5; i++) { const u = i / 6; this.fx.push({ k: 'ghost', x: ev.x1 + ddx * u, y: ev.y1 + ddy * u, t: 0.16 + u * 0.18, max: 0.34, tint: 'brightness(0.35) sepia(1) hue-rotate(220deg) saturate(3)', dir: ev.x2 > ev.x1 ? 1 : -1 }); }
          // 지나간 길: 긴 선 대신 짧은 바람 줄기 몇 가닥 · 발밑에 이는 그림자 먼지
          for (let i = 0; i < 10; i++) { const u = Math.random(), off = (Math.random() - 0.5) * 10; this.parts.push({ x: ev.x1 + ddx * u - uy * off, y: ev.y1 - 6 + ddy * u + ux * off * 0.6, vx: ux * 160, vy: uy * 160, t: 0.1 + Math.random() * 0.12, max: 0.22, color: i % 3 ? '#9a80d8' : '#e8e0ff', g: 0, line: true }); }
          for (let i = 0; i < 4; i++) this.parts.push({ x: ev.x1 + (Math.random() - 0.5) * 6, y: ev.y1 + 2, vx: -ux * 30 + (Math.random() - 0.5) * 20, vy: -uy * 15 - 5, t: 0.5, max: 0.5, color: '#4a3a5a', g: -4, steam: true });
          sfx('dash', { vol: 0.55, rate: 1.6 });
          break;
        }
        case 'danceCut': { // 지나가며 긋는 초승달 칼자국 두 줄
          this.fx.push({ k: 'cut', x: ev.x, y: ev.y - 8, ang: ev.ang, t: 0.28, max: 0.28 });
          this.sparkBurst(ev.x, ev.y - 8, '#c8b0ff', 8); this.sparkBurst(ev.x, ev.y - 8, '#ffffff', 4);
          this.shake = Math.max(this.shake, 3); this.hitstop = Math.max(this.hitstop, 0.04);
          sfx('swing', { vol: 0.7, rate: 1.5 }); sfx('hit', { vol: 0.6, rate: 1.3 });
          break;
        }
        case 'skillAoe': this.aoeFx(ev); break;
        case 'skillCone': if (ev.fx === 'spellBlade') { // 근접 무기로 쓴 마법: 그 속성 빛의 초승달이 앞을 휩쓴다
            const col = ELEM[ev.elem]?.color || '#c9a8ff';
            this.fx.push({ k: 'spellBlade', x: ev.x, y: ev.y, ang: ev.ang, r: ev.range, angle: ev.angle, col, t: 0.26, max: 0.26 });
            for (let i = 0; i < 6; i++) { const a = ev.ang + (Math.random() - 0.5) * ev.angle, d = ev.range * (0.45 + Math.random() * 0.55); this.parts.push({ x: ev.x + Math.cos(a) * d, y: ev.y - 6 + Math.sin(a) * d * 0.62, vx: Math.cos(a) * 30, vy: Math.sin(a) * 16 - 8, t: 0.3, max: 0.3, color: col, g: -20, glow: true, size: 1 }); }
            if (ev.elem === 'fire') for (let i = 0; i < 6; i++) { const a = ev.ang + (Math.random() - 0.5) * ev.angle, d = ev.range * (0.5 + Math.random() * 0.5); this.parts.push({ x: ev.x + Math.cos(a) * d, y: ev.y + Math.sin(a) * d * 0.62, vx: 0, vy: -30, t: 0.4, max: 0.4, g: -20, flame: true, size: 1, color: '#ffffff' }); }
            this.shake = Math.max(this.shake, 2); sfx('reaction', { vol: 0.45, rate: 1.5 });
          } else if (ev.fx === 'sweep') { this.fx.push({ k: 'spin', x: ev.x, y: ev.y, r: ev.range, type: 'phys', t: 0.25, max: 0.25 }); this.shake = Math.max(this.shake, 4); sfx('heavySwing', { vol: 0.9 }); }
          if (ev.fx !== 'breath' && ev.fx !== 'spellBlade') this.fx.push({ k: 'cone', ...ev, color: ELEM[ev.elem]?.color || (ev.fx === 'claws' ? '#ffffff' : '#ffb066'), t: 0.22, max: 0.22 });
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
        case 'buff': this.rimFlash = { color: ev.color || '#ffffff', t: 0.35, max: 0.35 * 1.8 }; for (let i = 0; i < 7; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 14, y: ev.y, vx: 0, vy: -30 - Math.random() * 25, t: 0.55, max: 0.55, color: ev.color, g: -8 }); sfx('echo', { vol: 0.5 }); break;
        case 'elemShift': this.fx.push({ k: 'ring', x: ev.x, y: ev.y - 6, r: 24, color: ELEM[ev.elem].color, t: 0.4, max: 0.4, w: 3 }); this.burst(ev.x, ev.y - 6, ELEM[ev.elem].color, 16, 80); this.texts.push({ x: ev.x, y: ev.y - 24, text: `${ELEM[ev.elem].name}${ev.weak ? ' · 약점!' : ''}`, color: ELEM[ev.elem].color, t: 1, vy: -12, vx: 0, label: true }); sfx('open', { vol: 0.5, rate: 1.2 }); break;
        case 'graspArm': this.fx.push({ k: 'arm', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t: 0.55, max: 0.55 }); sfx('dash', { vol: 0.5, rate: 0.6 }); break;
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
        case 'steamPuff': for (let i = 0; i < 8; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 14, y: ev.y - 2, vx: (Math.random() - 0.5) * 16, vy: -18 - Math.random() * 22, t: 0.9, max: 0.9, color: Math.random() < 0.5 ? '#e8eef2' : '#c4ccd4', g: -8, big: true }); break; // 얼린 용암에서 김
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
        case 'sentence': { // 용의 말: 허공에 세 글자를 한 획씩 쓰고 → 하나로 합쳐 → 목표에 날아가 땅에 새긴다
          const same = ev.words.every((x) => x === ev.words[0]);
          this.ultName = { text: `「 ${sentenceLine(ev.words)} 」`, sub: ev.words.map((x) => WORD_NAME[x]).join(' · ') + (same ? ' · 완전한 문장' : ''), color: same ? '#ffe08a' : WORD_COLOR[ev.words[0]], t: 1.6, max: 1.6 };
          this.rimFlash = { color: WORD_COLOR[ev.words[0]] || '#ff9a4a', t: 0.9, max: 0.9 };
          this.fx.push({ k: 'glyphs', words: ev.words, same, x: ev.x, y: ev.y, tx: ev.tx ?? ev.x, ty: ev.ty ?? ev.y, t: 1.9, max: 1.9 });
          this.hitstop = Math.max(this.hitstop, 0.05);
          ev.words.forEach((wd, i) => tone(392 * Math.pow(2, [0, 4, 7][i] / 12), { dur: 0.26, type: 'triangle', vol: 0.12, when: i * 0.15 }));
          tone(196, { dur: 0.5, type: 'sawtooth', vol: 0.06, when: 0.62 }); tone(98, { dur: 0.6, type: 'triangle', vol: 0.1, when: 0.68 });
          sfx('levelup', { vol: 0.5, rate: 0.9 });
          break;
        }
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
  // 속성이 깃든 무기의 궤적: 불은 불티와 불꽃, 얼음은 서리 가루, 번개는 튀는 불꽃, 독은 떨어지는 방울
  enchantTrail(ev) {
    const col = ELEM[ev.enchant].color, n = ev.whip ? 10 : 8, R = ev.range || 30;
    for (let i = 0; i < n; i++) {
      const a = ev.ang + (Math.random() - 0.5) * (ev.thrust ? 0.3 : ev.arc || 1.6), rr = R * (0.45 + Math.random() * 0.6), x = ev.x + Math.cos(a) * rr, y = ev.y - 6 + Math.sin(a) * rr;
      if (ev.enchant === 'fire') this.parts.push({ x, y, vx: Math.cos(a) * 20, vy: -30 - Math.random() * 30, t: 0.4, max: 0.4, g: -40, flame: true, size: 1.2, color: '#ffffff' });
      else if (ev.enchant === 'ice') this.parts.push({ x, y, vx: Math.cos(a) * 15, vy: Math.sin(a) * 15 - 6, t: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#e8f8ff' : col, g: 20, glow: true, size: 1 });
      else if (ev.enchant === 'lightning') this.parts.push({ x, y, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, t: 0.12, max: 0.12, color: Math.random() < 0.5 ? '#ffffff' : col, g: 0, line: true });
      else this.parts.push({ x, y, vx: 0, vy: 10, t: 0.6, max: 0.6, color: col, g: 160, glow: true, size: 1 });
    }
  }

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
      if (fx === 'pillar') this.fx.push({ k: 'pillar', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.5, max: 0.5 });
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.55, max: 0.55, w: 6 });
      this.burst(ev.x, ev.y, col, 50, 200); this.burst(ev.x, ev.y, '#ffffff', 16, 120);
      this.shake = Math.max(this.shake, 7); this.hitstop = Math.max(this.hitstop, 0.08);
      sfx('reaction', { vol: 0.9, rate: 0.7 });
    } else if (fx === 'rage') { this.rageBlast(ev.x, ev.y, ev.r); return;
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

  // 거대 화염구 착탄: 섬광 → 솟구치는 불길 · 사방으로 튀는 불똥 → 날아가 떨어진 돌 조각이 달아올랐다 식는다 → 연기 · 그을린 땅이 사라진다
  fireballBoom(x, y, r) {
    this.flash = { color: '255,200,140', t: 0.3, max: 0.3 };
    this.shake = Math.max(this.shake, 14); this.hitstop = Math.max(this.hitstop, 0.12);
    this.fx.push({ k: 'glow', x, y: y - 10, r: r * 1.6, color: '#ffb040', t: 0.6, max: 0.6 });
    this.fx.push({ k: 'scorch', x, y, r: r * 0.75, t: 4.5, max: 4.5 });
    this.fx.push({ k: 'fireColumn', x, y, r, t: 0.55, max: 0.55 });
    this.shockwave(x, y, r * 0.9, '#ffb060', 40);
    const pieces = [];
    for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, d = r * (0.35 + Math.random() * 0.75); pieces.push({ x0: x, y0: y - 4, x1: x + Math.cos(a) * d, y1: y + Math.sin(a) * d * 0.6, h: 20 + Math.random() * 40, fly: 0.3 + Math.random() * 0.25, s: 2 + Math.random() * 3.5, rot: Math.random() * 6 }); }
    this.fx.push({ k: 'debris', pieces, t: 4.2, max: 4.2 });
    for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI * 2, s2 = 60 + Math.random() * 220; this.parts.push({ x, y: y - 6, vx: Math.cos(a) * s2, vy: Math.sin(a) * s2 * 0.6 - 60, t: 0.5 + Math.random() * 0.6, max: 1.1, color: ['#ff4a12', '#ff8a2a', '#ffd040', '#fff2c0'][i % 4], g: 120, glow: true, size: 1.6 }); }
    for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2, s2 = 14 + Math.random() * 40; this.parts.push({ x: x + Math.cos(a) * r * 0.35, y: y - 6 + Math.sin(a) * r * 0.18, vx: Math.cos(a) * s2, vy: -18 - Math.random() * 26, t: 1.6 + Math.random() * 0.8, max: 2.4, color: Math.random() < 0.5 ? '#3a3036' : '#5a4e50', g: -6, puff: true, size: 3 + Math.random() * 3 }); }
    sfx('reaction', { vol: 1, rate: 0.5 }); sfx('hitHeavy', { vol: 1, rate: 0.45 });
  }

  // 땅을 따라 퍼지는 충격: 흙먼지와 빛 조각이 바깥으로 흩어진다 (그려진 고리 없음)
  // 터지는 순간 사방으로 튀는 빛 알갱이 · 흙먼지 (방향 · 속도를 흩뜨려서 고르게 늘어선 고리가 되지 않게)
  shockwave(x, y, r, color, n = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = r * (0.8 + Math.random() * 2.6);
      this.parts.push({ x: x + Math.cos(a) * 4, y: y + 2 + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55 - Math.random() * 30, t: 0.25 + Math.random() * 0.2, max: 0.45, color, g: 0, glow: true, size: 1.2 });
      if (i % 3 === 0) this.parts.push({ x: x + Math.cos(a) * 6, y: y + 3 + Math.sin(a) * 3, vx: Math.cos(a) * sp * 0.35, vy: Math.sin(a) * sp * 0.2, t: 0.6, max: 0.6, color: '#a89a86', g: -4, steam: true });
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
    const main = this.mainG, S = this.S, VW = this.VW, VH = this.VH;
    const p = w.player;
    const tx = p.x - VW / 2 + p.aimX * 16, ty = p.y - VH / 2 + p.aimY * 10;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);
    const mw = w.tw * TILE, mh = w.th * TILE;
    this.cam.x = mw <= VW ? (mw - VW) / 2 : Math.max(0, Math.min(mw - VW, this.cam.x));
    this.cam.y = mh <= VH ? (mh - VH) / 2 : Math.max(0, Math.min(mh - VH, this.cam.y));
    this.shake = Math.max(0, this.shake - dt * 22);
    // 카메라는 1배 칸에 맞춘다 (세계를 칸 단위로 그려서, 움직이는 것과 바닥이 서로 떨리지 않게)
    const cx = Math.round(this.cam.x + (Math.random() - 0.5) * this.shake);
    const cy = Math.round(this.cam.y + (Math.random() - 0.5) * this.shake);
    this.cx = cx; this.cy = cy;

    let g = this.g = this.wg;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0a080e'; g.fillRect(0, 0, VW, VH);
    this.worldTf(g);
    g.imageSmoothingEnabled = false;
    if (w.map.outdoor) { this.drawChunks(w, cx, cy); this.drawOutdoorLife(w, cx, cy); if (w.farmRect && w.life) for (const [key, pl] of Object.entries(w.life.farm)) { const [fx, fy] = key.split(',').map(Number); drawSoil(g, fx, fy, !!pl.wateredAt, w.t); } }
    else g.drawImage(this.mapCanvasNight && (this.nightK || 0) > 0.42 ? this.mapCanvasNight : this.mapCanvas, 0, 0);
    this.drawLiquidAnim(w, cx, cy);
    if (w.map.plaza) this.drawPlazaFloor(w);

    const dfill = (x, y, rx, ry, hex, d) => { if (g.ditherEllipse) g.ditherEllipse(x, y, rx, ry, hex, d * 0.72); else { g.fillStyle = hexA(hex, d * 0.6); ellipse(g, x, y, rx, ry); } };
    const dline = (x, y, rx, ry, col, ph = 0, on = 3, off = 2) => { if (g.dashEllipse) g.dashEllipse(x, y, rx, ry, col, on, off, ph); else { g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.stroke(); } };
    this.dfill = dfill; this.dline = dline;
    for (const z of w.zones || []) {
      const k = Math.min(1, z.t / 0.4);
      if (z.kind === 'slow') { // 시간 둔화: 보랏빛 점묘 바닥 · 도는 점선 테두리 · 시계 바늘 · 눈금
        dfill(z.x, z.y, z.r, z.r * 0.62, '#9670e6', 0.28 * k);
        dline(z.x, z.y, z.r, z.r * 0.62, hexA('#d8c4ff', 0.85 * k), w.t * 6);
        g.strokeStyle = hexA('#e8dcff', 0.8 * k); g.lineWidth = 1;
        for (const [len, sp] of [[z.r * 0.7, 0.5], [z.r * 0.45, 2]]) { const a = w.t * sp; g.beginPath(); g.moveTo(z.x, z.y); g.lineTo(z.x + Math.cos(a) * len, z.y + Math.sin(a) * len * 0.62); g.stroke(); }
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillStyle = hexA('#e8dcff', 0.8 * k); g.fillRect(Math.round(z.x + Math.cos(a) * z.r * 0.86) - 1, Math.round(z.y + Math.sin(a) * z.r * 0.53) - 1, 2, 2); }
        continue;
      }
      if (z.kind === 'trap') {
        g.fillStyle = '#3a3020'; ellipse(g, z.x, z.y, 7, 3.5);
        g.fillStyle = '#c8c0a8'; for (let i = -2; i <= 2; i++) { g.fillRect(z.x + i * 2.5 - 0.5, z.y - 3, 1, 3); }
        g.fillStyle = `rgba(155,225,93,${0.3 + 0.2 * Math.sin(w.t * 6)})`; disc(g, z.x, z.y - 1, 1.5);
        continue;
      }
      if (z.kind === 'smoke') continue; // 연기는 사람 위에 따로 그린다
      if (z.kind === 'bait') { // 미끼: 바닥에 놓인 고기 덩이 + 냄새
        g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, z.x, z.y + 2, 6, 2);
        g.fillStyle = '#1a1410'; ellipse(g, z.x, z.y - 1, 6, 4); g.fillStyle = '#c8504a'; ellipse(g, z.x, z.y - 1.5, 5, 3); g.fillStyle = '#f0a0a0'; g.fillRect(Math.round(z.x - 3), Math.round(z.y - 3), 3, 1);
        g.fillStyle = '#f4ecd8'; g.fillRect(Math.round(z.x + 3), Math.round(z.y - 3), 4, 2);
        if (Math.random() < 0.15) this.parts.push({ x: z.x + (Math.random() - 0.5) * 6, y: z.y - 4, vx: (Math.random() - 0.5) * 6, vy: -12, t: 1, max: 1, color: '#c8a87a', g: -2, steam: true });
        continue;
      }
      if (z.kind === 'arrows') { // 화살비: 그늘진 점묘 바닥 · 금빛 점선 테두리
        dfill(z.x, z.y, z.r, z.r * 0.6, '#281e0a', 0.3 * k);
        dline(z.x, z.y, z.r, z.r * 0.6, hexA('#ffe080', 0.7 * k), -w.t * 4, 2, 2);
        continue;
      }
      if (z.kind === 'frost') { // 서리 바닥: 하늘빛 점묘
        dfill(z.x, z.y, z.r, z.r * 0.6, '#aae1ff', 0.32 * k); dfill(z.x, z.y, z.r * 0.6, z.r * 0.36, '#e8f8ff', 0.2 * k);
        for (let i = 0; i < 6; i++) { const a = i * 1.05 + z.x; g.fillStyle = `rgba(230,250,255,${0.6 * k})`; g.fillRect(z.x + Math.cos(a) * z.r * 0.6, z.y + Math.sin(a) * z.r * 0.35, 2, 2); }
        if (Math.random() < 0.2) this.parts.push({ x: z.x + (Math.random() - 0.5) * z.r * 1.6, y: z.y + (Math.random() - 0.5) * z.r, vx: 0, vy: -10, t: 0.8, max: 0.8, color: '#e8f8ff', g: -2 });
        continue;
      }
      if (z.kind === 'inferno') { // 불바다: 붉은 점묘 위에 노란 점묘
        dfill(z.x, z.y, z.r, z.r * 0.62, '#ff5a14', 0.34 * k); dfill(z.x, z.y, z.r * 0.7, z.r * 0.42, '#ffc83c', 0.24 * k);
        for (let i = 0; i < 3; i++) this.parts.push({ x: z.x + (Math.random() - 0.5) * z.r * 1.8, y: z.y + (Math.random() - 0.5) * z.r * 1.1, vx: 0, vy: -50 - Math.random() * 40, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd040', g: -40 });
        continue;
      }
      if (z.kind === 'sanctuary') { // 성역: 금빛 점묘 · 도는 점선 테두리
        dfill(z.x, z.y, z.r, z.r * 0.6, '#ffe68c', 0.2 * k);
        dline(z.x, z.y, z.r, z.r * 0.6, hexA('#fff0b0', 0.85 * k), w.t * 5, 4, 2);
        for (let i = 0; i < 8; i++) { const a = w.t * 0.6 + i * 0.785; g.fillStyle = `rgba(255,240,180,${0.8 * k})`; g.fillRect(z.x + Math.cos(a) * z.r * 0.85 - 1, z.y + Math.sin(a) * z.r * 0.51 - 1, 3, 3); }
        if (Math.random() < 0.3) this.parts.push({ x: z.x + (Math.random() - 0.5) * z.r * 1.6, y: z.y + (Math.random() - 0.5) * z.r, vx: 0, vy: -30, t: 0.8, max: 0.8, color: '#fff0b0', g: -5 });
      } else {
        // 안개 · 독 · 불 구름: 점묘 바닥 위에 울퉁불퉁한 구름 덩이가 맴돈다
        const hex = z.kind === 'fog' ? '#8c46c8' : z.kind === 'poison' ? '#8cdc5a' : '#ff7828';
        dfill(z.x, z.y, z.r, z.r * 0.8, hex, 0.3 * k);
        for (let i = 0; i < 5; i++) { const a = w.t * 0.8 + i * 1.3, img = puffSprite(4 + (i % 3), hex, i); g.globalAlpha = 0.55 * k; g.drawImage(img, Math.round(z.x + Math.cos(a) * z.r * 0.55 - img.width / 2), Math.round(z.y + Math.sin(a * 1.3) * z.r * 0.4 - img.height / 2)); g.globalAlpha = 1; }
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

    // 탑: 층을 깨면 문까지 가는 길이 바닥에 빛나는 점으로 이어진다
    if (w.tower) {
      const path = w.towerPath?.();
      if (path) {
        let acc = 0;
        for (let i = 1; i < path.length; i++) {
          const a0 = path[i - 1], a1 = path[i], seg = Math.hypot(a1.x - a0.x, a1.y - a0.y);
          for (let d = (10 - acc % 10) % 10; d < seg; d += 10) {
            const k = d / seg, x = a0.x + (a1.x - a0.x) * k, y = a0.y + (a1.y - a0.y) * k, ph = (acc + d) / 10 - w.t * 3;
            const al = 0.45 + 0.4 * Math.max(0, Math.sin(ph));
            g.fillStyle = hexA('#120c1a', 0.5 * al); g.fillRect(Math.round(x) - 2, Math.round(y) - 1, 4, 4);
            g.fillStyle = hexA('#ffe8a8', al); g.fillRect(Math.round(x) - 1, Math.round(y), 2, 2);
          }
          acc += seg;
        }
      }
    }
    // 엔티티 (y 정렬)
    const vis = (x, y) => x > cx - 48 && x < cx + VW + 48 && y > cy - 48 && y < cy + VH + 64;
    const list = [];
    for (const o of w.objects) if (vis(o.x, o.y)) list.push({ o, y: o.kind === 'gate' ? -1e9 : o.y });
    for (const dr of w.drops) list.push({ dr, y: dr.y });
    for (const e of w.enemies) if (vis(e.x, e.y)) list.push({ e, y: e.y });
    for (const c of this.corpses) list.push({ c, y: c.y });
    list.push({ p, y: p.y });
    for (const rp of w.remotes || []) if (vis(rp.x, rp.y)) list.push({ rp, y: rp.y }); // 온라인: 같은 지도의 다른 사람
    for (const al of w.allies || []) list.push({ al, y: al.y });
    if (w.map.props) for (const pr of w.map.props) { const px = (pr.x + pr.w / 2) * TILE, py = (pr.y + pr.h) * TILE, big = pr.kind !== 'tree' && pr.kind !== 'well' && pr.kind !== 'house'; if (pr.big ? Math.abs(px - (cx + VW / 2)) < VW / 2 + 240 && py > cy - 40 && py < cy + VH + 460 : big ? Math.abs(px - (cx + VW / 2)) < VW / 2 + 140 && py > cy - 40 && py < cy + VH + 260 : vis(px, py - 40)) list.push({ prop: pr, y: py - 2 }); }
    if (w.map.plaza) for (const d of w.map.wallDeco) list.push({ wd: d, y: -1e9 + 1 });
    if (w.farmRect && w.life) for (const [key, pl] of Object.entries(w.life.farm)) if (pl.crop) { const [fx, fy] = key.split(',').map(Number); if (vis(fx * TILE + 8, fy * TILE + 8)) list.push({ crop: { x: fx, y: fy, pl }, y: fy * TILE + 13 }); }
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
      else if (it.rp) this.drawRemote(w, it.rp);
      else if (it.crop) drawCrop(g, it.crop.x, it.crop.y, it.crop.pl, w.t);
    }
    this.corpses = this.corpses.filter((c) => c.t > 0);
    if (w.map.villages) { drawVfx(this, w, dt); drawFlyers(this, w, dt); } // 성지 마을: 주민이 쏜 화살 · 날아다니는 것들

    // 고통 연결: 같은 사슬의 적끼리 보라 사슬
    const links = new Map();
    for (const e of w.enemies) if (e.link && !e.dead) { const L = links.get(e.link.id) || []; L.push(e); links.set(e.link.id, L); }
    for (const L of links.values()) for (let i = 1; i < L.length; i++) { // 사슬: 고리가 이어진 쇠사슬 (늘어지게 살짝 처진다)
      const a = L[i - 1], b = L[i], ax = a.x, ay = a.y - 8, bx2 = b.x, by2 = b.y - 8, len = Math.hypot(bx2 - ax, by2 - ay), n = Math.max(2, Math.floor(len / 6));
      const sag = Math.min(10, len * 0.06);
      for (let k = 0; k <= n; k++) {
        const u = k / n, x = ax + (bx2 - ax) * u, y = ay + (by2 - ay) * u + Math.sin(u * Math.PI) * sag, ang = Math.atan2(by2 - ay, bx2 - ax);
        g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(k % 2 ? ang : ang + Math.PI / 2);
        g.strokeStyle = '#1a0e24'; g.lineWidth = 2; g.strokeRect(-2, -1, 4, 2);
        g.strokeStyle = `rgba(206,140,255,${0.75 + 0.2 * Math.sin(w.t * 6 + k)})`; g.lineWidth = 1; g.strokeRect(-1.5, -0.5, 3, 1);
        g.restore();
      }
    }
    this.drawSmoke(w, dt);
    this.drawDayNight(w, cx, cy, dt);
    for (const pr of w.projs) this.drawProj(pr);
    this.drawFx(w, dt);

    for (const q of this.parts) {
      q.t -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9;
      const a = Math.min(1, (q.t / q.max) * 1.6);
      if (q.flame) { // 불꽃 혀 (도트): 수명에 따라 커지며 흰빛 → 노랑 → 주황 → 붉게 식다가 연기가 된다
        const life = q.t / q.max, rr = (q.size || 1.6) * (1 + (1 - life) * 3.2);
        const heat = life > 0.72 ? 0 : life > 0.46 ? 1 : life > 0.22 ? 2 : 3, R = Math.max(1, Math.round(rr * 0.8));
        q.fr ??= (Math.random() * 4) | 0;
        const img = flameSprite(R, q.fr + ((w.t * 9) | 0), heat);
        if (heat === 3) g.globalAlpha = Math.min(1, life * 4.5);
        g.drawImage(img, Math.round(q.x - img.width / 2), Math.round(q.y + R + 1 - img.height));
        g.globalAlpha = 1;
      } else if (q.glow) { // 반짝이 (도트 + 빛살): 크기는 처음 그대로 두고 밝기만 서서히 줄인다 (크기가 바뀌며 깜빡이지 않게)
        q.sz ??= (q.size || 1.5) < 1.3 ? 1 : (q.size || 1.5) < 2.3 ? 2 : 3;
        const img = sparkSprite(q.sz, q.color);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, a) * 0.8;
        g.drawImage(img, Math.round(q.x - img.width / 2), Math.round(q.y - img.height / 2));
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      } else if (q.line) {
        g.strokeStyle = hexA(q.color, a); g.lineWidth = 1;
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); g.stroke();
      } else if (q.steam) { // 김 · 흙먼지 (작은 구름 덩이)
        q.v ??= (Math.random() * 4) | 0;
        const img = puffSprite(Math.round(1 + (1 - q.t / q.max) * 2.6), q.color, q.v);
        g.globalAlpha = Math.min(1, 0.5 * a); g.drawImage(img, Math.round(q.x - img.width / 2), Math.round(q.y - img.height / 2)); g.globalAlpha = 1;
        q.vx += Math.sin(q.t * 6) * 2;
      }
      else if (q.puff) { // 연기 덩이: 커지며 옅어진다
        q.v ??= (Math.random() * 4) | 0;
        const life = 1 - q.t / q.max, rr = (q.size || 3) * (0.6 + life * 1.8), img = puffSprite(Math.round(rr * 0.85), q.color, q.v);
        g.globalAlpha = 0.5 * Math.min(1, q.t / q.max * 2) * Math.min(1, life * 6); g.drawImage(img, Math.round(q.x - img.width / 2), Math.round(q.y - img.height / 2)); g.globalAlpha = 1;
      }
      else if (q.dust) { // 발 먼지: 뭉쳤다 → 퍼졌다 → 흩어진다 (자리는 칸에 맞춰, 투명도는 그대로)
        const life = 1 - q.t / q.max, img = dustSprite(life < 0.3 ? 0 : life < 0.65 ? 1 : 2, q.color, q.v);
        g.globalAlpha = 0.7; g.drawImage(img, Math.round(q.x - img.width / 2), Math.round(q.y - img.height / 2)); g.globalAlpha = 1;
      }
      else if (q.bubble) { g.strokeStyle = hexA('#e0f6ff', a * 0.9); g.lineWidth = 1; g.beginPath(); g.arc(q.x, q.y, 1.2 + (1 - q.t / q.max) * 1.4, 0, Math.PI * 2); g.stroke(); q.vx += Math.sin(q.t * 9) * 4; }
      else if (q.big) { q.v ??= (Math.random() * 4) | 0; const img = puffSprite(Math.round(1.5 + (1 - q.t / q.max) * 3), q.color, q.v); g.globalAlpha = Math.min(1, a * 0.6); g.drawImage(img, Math.round(q.x - img.width / 2), Math.round(q.y - img.height / 2)); g.globalAlpha = 1; }
      else { g.fillStyle = hexA(q.color, a); g.fillRect(Math.round(q.x), Math.round(q.y), q.t > 0.4 ? 2 : 1, q.t > 0.4 ? 2 : 1); }
    }
    this.parts = this.parts.filter((q) => q.t > 0);

    if (w.zone?.id === 'palace' || w.zone?.id === 'labyrinth' || w.zone?.id === 'seabed') this.drawAmbience(w, cx, cy, dt);
    if (w.mode === 'field' && !w.map.outdoor) { this.drawLight(w, cx, cy); this.drawFog(w, cx, cy); } // 바깥 세계는 화면을 가리지 않는다 (안 가 본 곳은 지도에서만)

    // 1배 세계 판을 화면 배율로 키워 옮긴다 (도트 그대로). 글씨 · 화면 표시는 그 위에 실제 해상도로
    this.g = g = main;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.drawImage(this.lo, 0, 0, VW * S, VH * S);
    this.drawTexts(w, dt);
    drawBubbles(this, w);
    this.drawHud(w, dt);
    drawTrainHud(this, w);

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
        g.globalAlpha = a; this.text(un.text, W / 2, H * 0.3 - (un.sub ? 4 * u : 0), Math.round(3 * u * sc), un.color, 'center', true, true);
        if (un.sub) this.text(un.sub, W / 2, H * 0.3 + 10 * u, Math.max(1, u), '#f0e6d8', 'center', true);
        g.globalAlpha = 1;
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

  // 용궁 · 미궁의 공기: 물속(물방울 · 물빛 · 빛줄기), 오래된 돌길(먼지)
  drawAmbience(w, cx, cy, dt) {
    const g = this.g, VW = this.VW, VH = this.VH, t = w.t, sea = w.zone.id === 'palace' || w.zone.id === 'seabed';
    const list = this.ambient ||= [];
    if (list.length < (sea ? 46 : 30) && Math.random() < dt * (sea ? 14 : 8)) {
      list.push(sea ? { x: cx + Math.random() * VW, y: cy + VH + 4, vy: -(10 + Math.random() * 16), r: Math.random() < 0.25 ? 2 : 1, ph: Math.random() * 6, life: 4 + Math.random() * 4 }
        : { x: cx + Math.random() * VW, y: cy + Math.random() * VH, vy: -2 - Math.random() * 3, r: 1, ph: Math.random() * 6, life: 3 + Math.random() * 4, max: 7 });
    }
    if (sea) { // 위에서 비치는 빛줄기 (천천히 흔들린다)
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const bx = cx + ((i * 97 + t * 6) % (VW + 120)) - 60, sway = Math.sin(t * 0.4 + i) * 10;
        g.fillStyle = `rgba(120,220,255,${0.035 + 0.015 * Math.sin(t * 0.7 + i * 2)})`;
        g.beginPath(); g.moveTo(bx + sway, cy); g.lineTo(bx + sway + 22, cy); g.lineTo(bx - 30, cy + VH); g.lineTo(bx - 70, cy + VH); g.closePath(); g.fill();
      }
      // 바닥에 일렁이는 물빛
      g.fillStyle = 'rgba(150,235,255,0.05)';
      for (let i = 0; i < 9; i++) {
        const ox = cx + ((i * 71 + Math.sin(t * 0.3 + i) * 30) % VW + VW) % VW, oy = cy + ((i * 53 + t * 4) % VH);
        ellipse(g, ox, oy, 14 + 6 * Math.sin(t + i), 5 + 2 * Math.cos(t * 1.3 + i));
      }
      g.restore();
    }
    for (const b of list) {
      b.life -= dt; b.y += b.vy * dt; b.x += Math.sin(t * 2 + b.ph) * (sea ? 6 : 3) * dt;
      if (sea) {
        g.fillStyle = 'rgba(200,245,255,0.55)'; g.fillRect(Math.round(b.x) - b.r, Math.round(b.y), b.r * 2 + 1, 1); g.fillRect(Math.round(b.x) - b.r, Math.round(b.y) - b.r * 2, b.r * 2 + 1, 1);
        g.fillRect(Math.round(b.x) - b.r - 1, Math.round(b.y) - b.r * 2 + 1, 1, b.r * 2 - 1 || 1); g.fillRect(Math.round(b.x) + b.r + 1, Math.round(b.y) - b.r * 2 + 1, 1, b.r * 2 - 1 || 1);
        g.fillStyle = '#ffffff'; g.fillRect(Math.round(b.x) - b.r + 1, Math.round(b.y) - b.r * 2 + 1, 1, 1);
      } else {
        g.fillStyle = `rgba(255,226,170,${0.35 * Math.min(1, b.life, b.max - b.life)})`; g.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
      }
    }
    this.ambient = list.filter((b) => b.life > 0 && b.y > cy - 10);
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

  // 다른 사람 (온라인 · 결투 상대): 그 종족의 몸 · 든 무기 · 걷기
  // 운영자 모습: 둥근 얼굴에 팔다리가 달린 흰 사람 (짙은 테두리로 어디서든 보인다) · 발이 (x, y)
  drawAdminFigure(x, y, dir, moving, t, atk = false, s = 1) {
    const g = this.g, sw = moving ? Math.sin(t * 11) : 0, bob = moving ? Math.abs(Math.sin(t * 11)) * 1 : Math.sin(t * 2) * 0.4;
    const hipY = y - 7 * s, neckY = y - 15 * s - bob, headY = y - 20 * s - bob;
    const armA = atk ? -1.2 : sw * 0.7, legA = sw * 0.6;
    const limbs = [
      [x, neckY, x, hipY], // 몸
      [x, hipY, x + Math.sin(legA) * 6 * s, y], [x, hipY, x - Math.sin(legA) * 6 * s, y], // 다리
      [x, neckY + 1, x + dir * Math.sin(armA + 0.4) * 6 * s, neckY + 1 + Math.cos(armA + 0.4) * 6 * s], // 앞팔
      [x, neckY + 1, x - dir * Math.sin(-armA + 0.4) * 6 * s, neckY + 1 + Math.cos(-armA + 0.4) * 6 * s], // 뒤팔
    ];
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, c] of [[4 * s, '#1c1c26'], [2 * s, '#ffffff']]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath();
      for (const [a, b, c2, d] of limbs) { g.moveTo(a, b); g.lineTo(c2, d); }
      g.stroke();
      g.fillStyle = c; g.beginPath(); g.arc(x, headY, 4.2 * s + (w - 2 * s) / 2, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#1c1c26'; g.fillRect(Math.round(x + dir * 1.5 * s), Math.round(headY - 1 * s), Math.max(1, s), Math.max(1, s)); // 눈 (보는 쪽)
    g.restore();
  }
  drawRemote(w, rp) {
    const g = this.g, art = RACE_ART[rp.race] || RACE_ART.knight, moving = !rp.down && (rp.moving || rp.mo === 'run'), dir = rp.dir || 1;
    const fr = frames(art.base, moving ? 'run' : 'idle'), img = sprite(fr[Math.floor(w.t * (moving ? 10 : 4) + (rp.id || 0)) % fr.length], (art.tint || '') + (rp.flash > 0 ? ' brightness(2.2)' : ''), false, dir < 0);
    this.shadow(rp.x, rp.y + 6, 6);
    if (rp.down) { // 파티 탑에서 쓰러진 동료: 옆으로 누워 흐리게 (층을 깨면 일어난다)
      g.save(); g.globalAlpha = 0.5; g.translate(Math.round(rp.x), Math.round(rp.y + 4)); g.rotate(-dir * Math.PI / 2);
      if (img) g.drawImage(img, Math.round(-img.width / 2), Math.round(3 - img.height));
      g.restore(); rp._top = rp.y - 10; return;
    }
    if (rp.admin) { this.drawAdminFigure(rp.x, rp.y + 6, dir, moving, w.t + (rp.id || 0), rp.mo === 'atk'); rp._top = rp.y - 22; return; } // 운영자: 흰 사람 모습 (무기 없이)
    if (img) g.drawImage(img, Math.round(rp.x - img.width / 2), Math.round(rp.y + 7 - img.height));
    const wa = rp.weapon && ITEMS[rp.weapon] ? weaponArt(rp.weapon, ITEMS) : null, wimg = wa && sprite(wa.s, wa.tint || '');
    if (rp.mo === 'atk') rp.swingT = (rp.swingT || 0) + 1 / 60; else rp.swingT = 0;
    const sw = rp.swingT > 0 ? -1.3 + ((rp.swingT * 6) % 1) * 2.6 : 0; // 공격 중: 위에서 아래로 크게 휘두른다
    if (wimg) { const sc = Math.min(1, 16 / wimg.height); g.save(); g.translate(Math.round(rp.x + dir * 4), Math.round(rp.y - 2)); g.rotate(dir * (0.9 + sw)); g.scale(sc, sc); g.drawImage(wimg, -wimg.width / 2, -wimg.height + 2); g.restore(); }
    rp._top = rp.y - (img ? img.height - 7 : 18);
  }

  // 저장 안내 칩(#cloudChip)이 화면 가운데 위를 덮는 높이 (캔버스 픽셀) · 0.5초마다 다시 잰다
  topSafe() {
    const now = performance.now();
    if (this._topSafe && now - this._topSafe.at < 500) return this._topSafe.v;
    let v = 0;
    const el = document.getElementById('cloudChip');
    if (el && !el.hidden && el.getClientRects().length) { // position: fixed 라 offsetParent 로는 못 잰다
      const r = el.getBoundingClientRect(), cr = this.c.getBoundingClientRect(), mid = cr.left + cr.width / 2;
      if (r.left < mid && r.right > mid && cr.height > 0) v = Math.max(0, (r.bottom - cr.top) * this.c.height / cr.height);
    }
    this._topSafe = { at: now, v };
    return v;
  }

  drawEnemy(w, e, dt) {
    const g = this.g, def = e.def;
    if (e.remote) { this.drawRemote(w, { ...e.rp, x: e.x, y: e.y, dir: e.dir, moving: e.moving, flash: e.hitFlash }); e._top = e.y - 18; return; }
    if (def.ai === 'dummy') return this.drawDummy(w, e);
    if (def.ai === 'target') return drawTrainTarget(this, w, e);
    if (e.bones > 0) return drawBonePile(this, w, e); // 수련: 쓰러진 해골이 뼈 무더기로 (곧 다시 일어선다)
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
        else this.parts.push({ x: p.x - p.dir * 3, y: p.y + 4, vx: -p.dir * (6 + Math.random() * 6), vy: -2, t: 0.42, max: 0.42, color: '#9a8e7e', g: 0, dust: true, v: (Math.random() * 4) | 0 }); // 발 먼지
      }
    }
    const blink = p.invuln > 0 && p.dashT <= 0 && !p.channel && !(p.air > 0) && Math.floor(w.t * 20) % 2 === 0;
    const img = sprite(name, art.tint || '', p.hitFlash > 0 ? '#ff6060' : false, p.dir < 0);
    const pose = this.playerPose(w, p);
    if (img && img.height < 26) pose.hy *= img.height / 26; // 키가 작은 종족은 손도 낮게
    const lift = (p.air || 0) + pose.lift;
    // 몸에 두르는 효과는 타원 대신 실루엣 테두리 빛 + 몸에서 피어오르는 입자로
    const rims = [];
    // 몸에 보이는 효과는 짧은 것만 (음식 · 개운함처럼 오래가는 효과는 왼쪽 위 목록에만). 천천히 숨 쉬듯, 입자는 가끔
    const bf = Object.values(p.buffs || {}).find((x) => x.color && !x.persist && (x.max || x.t) <= 30);
    if (bf) { rims.push([bf.color, 0.3 + 0.06 * Math.sin(w.t * 2.5)]); if (dt > 0 && Math.random() < 0.06) this.parts.push({ x: p.x + (Math.random() - 0.5) * 12, y: p.y - Math.random() * 16 - lift, vx: 0, vy: -18 - Math.random() * 10, t: 0.6, max: 0.6, color: bf.color, g: -6, size: 1 }); }
    if (p.shield > 0) rims.push(['#a8d8ff', 0.38]);
    if (p.parryT > 0) rims.push(['#fff0b0', 0.6]);
    if (p.charging?.lvl >= 3) rims.push(['#ffe080', 0.45 + 0.1 * Math.sin(w.t * 6)]);
    if (this.rimFlash) { this.rimFlash.t -= dt; if (this.rimFlash.t <= 0) this.rimFlash = null; else rims.push([this.rimFlash.color, this.rimFlash.t / this.rimFlash.max]); }
    this.shadow(p.x, p.y + 4, lift > 4 ? Math.max(3, 6 - lift / 8) : 6);
    if (p.stealthT > 0) g.globalAlpha = 0.32 + 0.08 * Math.sin(w.t * 9);
    let gs = p.buffs?.giant ? 1.5 : p.buffs?.dragonForm ? 1.2 : 1;
    let fallA = 1;
    if (p.fallInto) { const k = Math.min(1, p.fallInto.t / p.fallInto.dur); if (k > 0.4) { const q = (k - 0.4) / 0.6; gs *= 1 - 0.85 * q * q; fallA = 1 - q * 0.8; } }
    if (this.dodgeLean) { this.dodgeLean.t -= dt; if (this.dodgeLean.t <= 0) this.dodgeLean = null; }
    const bx = p.x + pose.ox + (this.dodgeLean ? this.dodgeLean.sd * 4 * (this.dodgeLean.t / 0.18) : 0), by = p.y + pose.oy - lift + (p.fallInto && p.fallInto.t / p.fallInto.dur > 0.4 ? (p.fallInto.t / p.fallInto.dur - 0.4) * 14 : 0);
    if (fallA < 1) g.globalAlpha = fallA;
    if (p.buffs?.dragonForm) { this.drawTrueDragon(w, p, by); g.globalAlpha = 1; return; }
    if (p.down) g.globalAlpha = 0.5;
    if ((w.state === 'dead' || p.down) && img) {
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
      if (dt > 0 && Math.random() < 0.07) this.parts.push({ x: tx, y: ty, vx: -p.dir * (20 + Math.random() * 30), vy: -16 - Math.random() * 20, t: 0.22, max: 0.22, color: '#ffd27a', g: 220, glow: true, size: 1 });
      if (dt > 0 && Math.random() < 0.08) this.parts.push({ x: tx, y: ty + 1, vx: -p.dir * 4, vy: -1, t: 0.4, max: 0.4, color: '#8a7a66', g: 0, dust: true, v: (Math.random() * 4) | 0 });
      if (dt > 0 && Math.random() < 0.3) this.fx.push({ k: 'scrape', x: tx, y: ty + 1, t: 0.6, max: 0.6 });
    }
    const busy = p.gather || p.fish, hideW = busy || p.swim; // 헤엄칠 때는 무기를 들지 않는다
    if (p.boat) this.drawBoat(w, p.x, p.y, p.dir, p.moving, 'back');
    if (w.map.underwater && dt > 0 && Math.random() < dt * 1.6) this.parts.push({ x: bx + p.dir * 3, y: by - 14, vx: (Math.random() - 0.5) * 6, vy: -26 - Math.random() * 14, t: 1.4, max: 1.4, color: '#e0f6ff', g: -6, bubble: true });
    const wart = weaponArt(w.b.weaponId, ITEMS);
    if ((wart.shield || w.b.wcat === 'shield') && !hideW) this.drawShield(w, p, pose, bx, by, gs);
    else if (w.b.offItem && !hideW) this.drawOffhand(w, p, pose, bx, by, gs); // 왼손 도구 (한손 무기일 때)
    if (pose.kind === 'fist' && !hideW) { const back = pose.punch > 0.05 && pose.offhand; this.fistAt(w, bx - p.dir * (back ? -1 : 4) * gs, by - (back ? 7 : 5) * gs, this.fistMetal(wart), p.dir); }
    if (pose.behind && !hideW) this.drawWeapon(w, p, pose, bx, by, gs);
    const sink = p.swim ? by - 7 : p.boat ? by - 1 : null;
    if (sink != null) { g.save(); g.beginPath(); g.rect(bx - 30, by - 80, 60, sink - (by - 80)); g.clip(); }
    const admin = this.admin && !w.pvp; // 운영자: 종족 그림 대신 흰 사람 모습
    if (!blink && img && rims.length && !admin) {
      const [col, a] = rims[rims.length - 1];
      const sil = sprite(name, art.tint || '', col, p.dir < 0);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= Math.max(0, Math.min(1, a));
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.drawBody(sil, bx + ox, by + oy, gs, pose, p.dir);
      g.restore();
    }
    if (!blink && admin) this.drawAdminFigure(bx, by + 2, p.dir, moving, p.walkT || w.t, p.swingT > 0, gs);
    else if (!blink && img) this.drawBody(img, bx, by, gs, pose, p.dir);
    if (!blink && w.b.offItem && !hideW && OFF_LOOK[w.b.offId] === 'xbow') this.drawOffhand(w, p, pose, bx, by, gs, 'front'); // 손쇠뇌는 몸 앞에
    if (sink != null) g.restore();
    if (p.swim) this.drawSwimLine(w, p, bx, by, dt);
    if (p.boat) this.drawBoat(w, p.x, p.y, p.dir, p.moving, 'front');
    if (!pose.behind && !hideW) this.drawWeapon(w, p, pose, bx, by, gs);
    if (p.familiar) { this.drawFamiliar(w, p); for (const x of p.famExtra || []) this.drawFamiliar(w, p, x); } // 불러낸 정령 (어깨 위 · 정령사는 셋까지)
    if (busy) this.drawLifeTool(w, p, bx, by);
    if (this.caught) { // 잡은 것을 머리 위로 들어 보인다
      this.caught.t -= dt;
      if (this.caught.t <= 0) this.caught = null;
      else { const ic = iconCanvas(this.caught.id), lift2 = Math.min(1, (2.2 - this.caught.t) * 4) * 8; g.drawImage(ic, Math.round(bx - 8), Math.round(by - 34 - lift2)); }
    }
    g.globalAlpha = 1;
    this.drawPlayerExtras(w, p, bx, by - (img ? img.height * gs : 24) + 4);
  }

  // 나룻배 (바라보는 쪽이 뱃머리). part: back(배 몸 · 안쪽) / front(앞쪽 뱃전) / all
  drawBoat(w, x, y, dir, moving, part) {
    const g = this.g, t = w.t, bob = Math.round(Math.sin(t * 2.2 + x * 0.1));
    g.save(); g.translate(Math.round(x), Math.round(y) + 3 + bob); g.scale(dir || 1, 1);
    if (part !== 'front') {
      g.fillStyle = 'rgba(10,30,60,0.32)'; ellipse(g, 1, 5, 19, 4.5);
      g.fillStyle = '#1a1410'; g.beginPath(); g.moveTo(-17, -4); g.quadraticCurveTo(-16, 6, -8, 7); g.lineTo(9, 7); g.quadraticCurveTo(17, 5, 20, -5); g.closePath(); g.fill();
      g.fillStyle = '#8a5a32'; g.beginPath(); g.moveTo(-16, -3); g.quadraticCurveTo(-15, 5, -8, 6); g.lineTo(9, 6); g.quadraticCurveTo(16, 4, 18, -4); g.closePath(); g.fill();
      g.fillStyle = '#6a4024'; for (const yy of [0, 3]) g.fillRect(-14, yy, 29, 1);
      g.fillStyle = '#5a3418'; g.beginPath(); g.moveTo(-13, -3); g.lineTo(14, -3); g.quadraticCurveTo(12, 1, 8, 2); g.lineTo(-9, 2); g.quadraticCurveTo(-12, 1, -13, -3); g.fill(); // 안쪽
      g.fillStyle = '#a8784a'; g.fillRect(-2, -3, 4, 5); g.fillStyle = '#7a5232'; g.fillRect(-2, 1, 4, 1); // 가운데 걸상
      // 노 (움직이면 젓는다)
      const row = moving ? Math.sin(t * 7) : 0.3, ox = Math.cos(row) * 4;
      g.strokeStyle = '#1a1410'; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, -2); g.lineTo(-6 - ox, -9); g.stroke();
      g.strokeStyle = '#c8945a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, -2); g.lineTo(-6 - ox, -9); g.stroke();
      g.fillStyle = '#1a1410'; g.fillRect(Math.round(-8 - ox), -12, 4, 4); g.fillStyle = '#c8945a'; g.fillRect(Math.round(-7 - ox), -11, 2, 2);
    }
    if (part !== 'back') {
      g.fillStyle = '#1a1410'; g.beginPath(); g.moveTo(-17, 1); g.quadraticCurveTo(-16, 7, -8, 8); g.lineTo(9, 8); g.quadraticCurveTo(17, 6, 19, 0); g.lineTo(17, 0); g.quadraticCurveTo(15, 4, 9, 5); g.lineTo(-8, 5); g.quadraticCurveTo(-14, 4, -15, 1); g.closePath(); g.fill();
      g.fillStyle = '#a8784a'; g.beginPath(); g.moveTo(-15, 2); g.quadraticCurveTo(-14, 6, -8, 7); g.lineTo(9, 7); g.quadraticCurveTo(15, 5, 17, 1); g.lineTo(9, 6); g.lineTo(-8, 6); g.closePath(); g.fill();
      const row = moving ? Math.sin(t * 7 + 1.2) : 0.3, ox = Math.cos(row) * 4; // 앞쪽 노
      g.strokeStyle = '#1a1410'; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, 4); g.lineTo(-6 - ox, 11); g.stroke();
      g.strokeStyle = '#c8945a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, 4); g.lineTo(-6 - ox, 11); g.stroke();
    }
    g.restore();
    if (part === 'front' && moving && Math.random() < 0.5) this.parts.push({ x: x - (dir || 1) * 16, y: y + 8, vx: -(dir || 1) * 20 + (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 8, t: 0.6, max: 0.6, color: '#e8f8ff', g: 0 });
  }
  // 헤엄: 물에 잠긴 가슴께에 물결과 거품
  drawSwimLine(w, p, bx, by, dt) {
    const g = this.g, t = w.t, y = Math.round(by - 7);
    g.fillStyle = 'rgba(46,120,180,0.6)'; g.fillRect(Math.round(bx - 8), y, 16, 4);
    for (let i = -8; i < 8; i += 2) { g.fillStyle = (i + Math.floor(t * 8)) % 4 === 0 ? '#ffffff' : '#a8dcf4'; g.fillRect(Math.round(bx + i), y - 1 + Math.round(Math.sin(t * 6 + i) * 0.6), 2, 1); }
    if (p.moving && dt > 0 && Math.random() < 0.6) this.parts.push({ x: bx - p.dir * 7 + (Math.random() - 0.5) * 4, y: y + 1, vx: -p.dir * 14, vy: (Math.random() - 0.5) * 6, t: 0.5, max: 0.5, color: '#e8f8ff', g: 0 });
  }

  // 생활 도구: 휘두르는 곡괭이 · 도끼 · 삽 · 괭이, 기울이는 물뿌리개, 낚싯대(찌 · 줄 · 줄다리기 막대)
  drawLifeTool(w, p, bx, by) {
    const g = this.g, dir = p.dir;
    const scr = (a) => (dir > 0 ? a : Math.PI - a);
    if (p.gather) {
      const gt = p.gather, k = Math.min(1, gt.t / gt.dur), kind = gt.kind === 'hand' ? null : gt.kind;
      if (!kind) return;
      const a = swingAngle(kind, k), raise = Math.max(0, -Math.sin(a)) * 5;
      const tier = w.life?.tools?.[kind === 'pickaxe' ? 'pickaxe' : kind] || 1;
      drawToolAt(g, kind, tier, bx + dir * 4, by - 6 - raise, scr(a), dir);
      if (kind === 'can' && k > 0.25 && k < 0.85) for (let i = 0; i < 2; i++) this.parts.push({ x: bx + dir * 14 + (Math.random() - 0.5) * 3, y: by - 4, vx: dir * (10 + Math.random() * 10), vy: 20 + Math.random() * 20, t: 0.35, max: 0.35, color: '#8ad0f0', g: 160 });
      return;
    }
    const f = p.fish, tier = w.life?.tools?.rod || 1;
    let a = -0.85;
    if (f.phase === 'cast') { const k = Math.min(1, f.t / 0.45); a = k < 0.4 ? -0.85 - 1.4 * (k / 0.4) : -2.25 + 1.6 * ((k - 0.4) / 0.6); }
    else if (f.phase === 'bite') a = -0.7 + Math.sin(w.t * 30) * 0.08;
    else if (f.phase === 'rhythm') a = -1.05 + Math.sin(w.t * 12) * 0.1 - (this.beatPulse || 0) * 0.25;
    const hx = bx + dir * 4, hy = by - 6, th = scr(a) + Math.PI / 4, lx = 11, ly = dir < 0 ? 12 : -12;
    drawToolAt(g, 'rod', tier, hx, hy, scr(a), dir);
    const tipX = hx + lx * Math.cos(th) - ly * Math.sin(th), tipY = hy + lx * Math.sin(th) + ly * Math.cos(th);
    drawFishing(g, p, f, tipX, tipY, w.t);
    if (f.phase === 'bite') this.bang(p.x, p.y - 34 + Math.sin(w.t * 20) * 1.5, '#ffd040');
  }
  // 리듬 낚시: 오른쪽에서 흘러오는 박이 왼쪽 원에 닿을 때 누른다
  drawRhythm(w, dt) {
    const g = this.g, u = this.u, v = Math.max(1.5, u * 1.3), p = w.player, f = p.fish, Wc = this.c.width;
    this.beatPulse = Math.max(0, (this.beatPulse || 0) - dt * 4);
    const px = this.sx(p.x), py = this.sy(p.y - 34);
    if (f.phase === 'wait') { g.globalAlpha = 0.75; this.text('찌를 지켜보세요 · 가라앉으면 G', px, py - 8 * u, Math.max(1, u - 1), '#d8e8f4', 'center'); g.globalAlpha = 1; return; }
    if (f.phase === 'bite') {
      const s2 = 1 + 0.12 * Math.sin(w.t * 18), bw = 92 * u * s2, bh = 22 * u * s2;
      this.panel(px - bw / 2, py - 30 * u - bh / 2, bw, bh);
      this.text('지금! G', px, py - 30 * u, 2 * u, '#ffd040', 'center', true, true);
      return;
    }
    if (f.phase !== 'rhythm') return;
    const ch = f.chart, W = 240 * v, H = 34 * v, x0 = Math.max(8 * v, Math.min(Wc - W - 8 * v, px - W / 2)), y0 = Math.max(70 * v, py - H - 26 * v), cy = y0 + H / 2;
    this.panel(x0, y0, W, H);
    const lg = g.createLinearGradient(0, y0, 0, y0 + H); lg.addColorStop(0, '#1c4a6e'); lg.addColorStop(1, '#0e2a44');
    g.fillStyle = lg; g.fillRect(x0 + 2 * v, y0 + 2 * v, W - 4 * v, H - 4 * v);
    for (let i = 0; i < 6; i++) { const wx = x0 + ((i * 47 * v + w.t * 30 * v) % (W - 8 * v)) + 4 * v; g.fillStyle = 'rgba(160,220,255,0.12)'; g.fillRect(Math.round(wx), Math.round(cy + Math.sin(w.t * 2 + i) * 8 * v), 10 * v, u); }
    const hx = x0 + 30 * v, lead = 3.2 * ch.spb, pxs = (W - 46 * v) / lead;
    // 박 줄 (한 박마다 세로선)
    for (let b = Math.ceil(f.t / ch.spb); b * ch.spb < f.t + lead; b++) { const bx = hx + (b * ch.spb - f.t) * pxs; g.fillStyle = b % 4 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'; g.fillRect(Math.round(bx), y0 + 4 * v, Math.max(1, u), H - 8 * v); }
    // 맞히는 원 (박마다 커졌다 줄어든다)
    const pulse = 1 + 0.28 * (this.beatPulse || 0);
    g.strokeStyle = '#1a1410'; g.lineWidth = 4 * v; g.beginPath(); g.arc(hx, cy, 11 * v * pulse, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#ffe8a8'; g.lineWidth = 2 * v; g.beginPath(); g.arc(hx, cy, 11 * v * pulse, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,232,168,0.15)'; g.beginPath(); g.arc(hx, cy, 9 * v, 0, Math.PI * 2); g.fill();
    // 박 (물방울)
    const tierCol = ['#7be38a', '#7be38a', '#9ad8ff', '#ffd040', '#ff9a5a', '#ff6ad8'][FISH[f.catch]?.beat || 1];
    for (const n of ch.notes) {
      if (n.hit === 'perfect' || n.hit === 'good') continue;
      const dx = (n.t - f.t) * pxs, nx = hx + dx;
      if (nx > x0 + W - 8 * v || nx < x0 + 4 * v) continue;
      const missed = n.hit === 'miss', ny = cy + (missed ? Math.min(14 * v, (f.t - n.t) * 60 * v) : 0);
      g.globalAlpha = missed ? 0.45 : 1;
      g.fillStyle = '#1a1410'; g.beginPath(); g.arc(nx, ny, 8 * v, 0, Math.PI * 2); g.fill();
      g.fillStyle = missed ? '#6a6878' : tierCol; g.beginPath(); g.arc(nx, ny, 6.5 * v, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(Math.round(nx - 3 * v), Math.round(ny - 4 * v), 2 * v, 2 * v);
      g.globalAlpha = 1;
    }
    // 걸린 물고기 (오른쪽 끝에서 퍼덕인다)
    const ic = iconCanvas(f.catch), shake = (this.missShake || 0) > 0 ? Math.sin(w.t * 60) * 3 * v : Math.sin(w.t * 8) * v;
    this.missShake = Math.max(0, (this.missShake || 0) - dt);
    g.imageSmoothingEnabled = false; g.drawImage(ic, Math.round(x0 + W - 30 * v + shake), Math.round(cy - 12 * v), 24 * v, 24 * v);
    // 진행 · 낚싯줄 · 난이도
    const done = ch.notes.filter((n) => n.hit).length;
    g.fillStyle = '#0d0b10'; g.fillRect(x0 + 4 * v, y0 + H + 2 * v, W - 8 * v, 4 * v);
    g.fillStyle = '#7be38a'; g.fillRect(x0 + 4 * v, y0 + H + 2 * v, (W - 8 * v) * done / ch.notes.length, 4 * v);
    for (let i = 0; i < f.maxLives; i++) { const lx = x0 + 52 * v + i * 11 * v, ly = y0 - 9 * v, on = i < f.lives; g.fillStyle = on ? '#e8eef4' : 'rgba(120,120,140,0.5)'; g.fillRect(Math.round(lx), Math.round(ly - 4 * v), u, 7 * v); g.fillRect(Math.round(lx - 3 * v), Math.round(ly + 2 * v), 4 * v, u); g.fillRect(Math.round(lx - 3 * v), Math.round(ly), u, 2 * v); }
    const lvl = FISH[f.catch]?.beat || 1;
    this.text(`${'★'.repeat(lvl)}${'☆'.repeat(5 - lvl)}  ${ch.bpm} BPM`, x0 + W - 4 * v, y0 - 7 * v, Math.max(1, u - 1), tierCol, 'right');
    this.text('G · Space · 클릭', x0 + W / 2, y0 + H + 14 * v, Math.max(1, u - 1), '#c8d8e8', 'center');
    if (f.combo >= 3) this.text(`${f.combo} 연속!`, hx, y0 - 18 * v, u, '#ffe8a8', 'center', true);
    // 판정 글씨
    this.rhythmFx = (this.rhythmFx || []).filter((r) => (r.t -= dt) > 0);
    for (const r of this.rhythmFx) { g.globalAlpha = Math.min(1, r.t * 3); this.text(r.text, hx, cy - 16 * v - (0.6 - r.t) * 24 * v, u, r.color, 'center', true, true); }
    g.globalAlpha = 1;
  }
  // 물건을 주웠다: 같은 물건은 한 줄로 모아 센다
  goodNote(id, n) {
    const ex = this.notes.find((x) => x.good === id && x.t > 0.5);
    if (ex) { ex.n += n; ex.t = 4; ex.text = `+ ${GOODS[id].name} ×${ex.n}`; return; }
    this.notes.push({ text: `+ ${GOODS[id].name} ×${n}`, color: '#e8f0c8', t: 4, good: id, n }); if (this.notes.length > 6) this.notes.shift();
  }
  lifeEvent(w, ev) {
    const P = (o) => this.parts.push(o), rnd = Math.random;
    switch (ev.t) {
      case 'trainStart': // 수련장으로 옮겨 왔다: 화면을 바로 옮기고 잠깐 어둡게
        this.cam.x = w.player.x - this.VW / 2; this.cam.y = w.player.y - this.VH / 2; this.fade = Math.max(this.fade, 0.7);
        this.banner = { text: SANCTUMS[ev.race] ? `수련 · ${w.training?.kind === 'damage' ? '허수아비에 피해 넣기' : w.training?.kind === 'waves' ? '수련 상대 쓰러뜨리기' : '과녁 맞히기'}` : '수련', sub: '곧 시작한다 · 수련장(말뚝 안)을 벗어나면 끝난다', t: 1.8, color: SANCTUMS[ev.race]?.color || '#ffe8a8' };
        sfx('open', { vol: 0.6 }); return true;
      case 'trainGo': this.ultName = { text: '시작!', color: '#ffe8a8', t: 0.9, max: 0.9 }; sfx('levelup', { vol: 0.45, rate: 1.4 }); return true;
      case 'trainPop': for (let i = 0; i < 8; i++) { const an = rnd() * Math.PI * 2; P({ x: ev.x + Math.cos(an) * 6, y: ev.y + 2, vx: Math.cos(an) * 24, vy: Math.sin(an) * 12 - 6, t: 0.5, max: 0.5, color: '#c8bca8', g: -4, steam: true }); } return true;
      case 'trainVanish': for (let i = 0; i < 10; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - rnd() * 20, vx: (rnd() - 0.5) * 20, vy: -10, t: 0.6, max: 0.6, color: '#3a2e48', g: -6, steam: true }); return true;
      case 'trainHit': { // 과녁마다 다르게 부서진다
        const look = ev.look, c = look === 'rune' ? '#c8b0ff' : look === 'shadow' ? '#5a4a7a' : look === 'brazier' ? '#ffb040' : '#e8d8a0';
        for (let i = 0; i < 12; i++) { const an = rnd() * Math.PI * 2, sp = 40 + rnd() * 80; P({ x: ev.x, y: ev.y - 14, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 40, t: 0.45, max: 0.45, color: i % 3 ? c : '#ffffff', g: look === 'rune' || look === 'shadow' ? 0 : 220, glow: look === 'rune' || look === 'brazier', size: 1.2 }); }
        if (look === 'brazier') for (let i = 0; i < 14; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - 18, vx: (rnd() - 0.5) * 20, vy: -60 - rnd() * 60, t: 0.6, max: 0.6, g: -20, flame: true, size: 1, color: '#ffffff' });
        if (look === 'shadow') for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - rnd() * 22, vx: (rnd() - 0.5) * 16, vy: -14, t: 0.7, max: 0.7, color: '#2a2038', g: -6, steam: true });
        this.texts.push({ x: ev.x, y: ev.y - 30, text: String(ev.n), color: '#ffe8a8', t: 0.6, vy: -24, vx: 0, label: true, size: 2, pop: 0.12 });
        sfx(look === 'brazier' ? 'reaction' : look === 'rune' ? 'freeze' : 'hit', { vol: 0.6, rate: 1.3 }); return true;
      }
      case 'trainMiss': for (let i = 0; i < 6; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y - 12, vx: (rnd() - 0.5) * 30, vy: -20, t: 0.4, max: 0.4, color: '#ff8a7a', g: 60 }); sfx('error', { vol: 0.4 }); return true;
      case 'trainBones': for (let i = 0; i < 10; i++) { const an = rnd() * Math.PI * 2; P({ x: ev.x, y: ev.y - 8, vx: Math.cos(an) * 50, vy: Math.sin(an) * 30 - 40, t: 0.4, max: 0.4, color: i % 2 ? '#e8e0c8' : '#a8a090', g: 260 }); } this.texts.push({ x: ev.x, y: ev.y - 26, text: '뼈 무더기 — 한 번 더!', color: '#e8e0c8', t: 1, vy: -14, vx: 0, label: true }); sfx('hitArmor', { vol: 0.5, rate: 1.4 }); return true;
      case 'trainRise': for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 12, y: ev.y + 2, vx: (rnd() - 0.5) * 20, vy: -12, t: 0.6, max: 0.6, color: '#8a8070', g: -4, dust: true, v: (rnd() * 4) | 0 }); this.texts.push({ x: ev.x, y: ev.y - 26, text: '다시 일어섰다', color: '#c8b8ff', t: 0.9, vy: -14, vx: 0, label: true }); sfx('death', { vol: 0.4, rate: 1.5 }); return true;
      case 'trainGuard': sfx('hitArmor', { vol: 0.35, rate: 1.2 }); for (let i = 0; i < 6; i++) P({ x: ev.x + (rnd() - 0.5) * 14, y: ev.y - 16, vx: 0, vy: -20, t: 0.4, max: 0.4, color: '#bfe0ff', g: 0, glow: true, size: 1 }); return true;
      case 'trainLight': for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - 16, vx: (rnd() - 0.5) * 16, vy: -50 - rnd() * 40, t: 0.5, max: 0.5, g: -20, flame: true, size: 1, color: '#ffffff' }); sfx('reaction', { vol: 0.45, rate: 1.4 }); return true;
      case 'trainOut': for (let i = 0; i < 5; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y - 16, vx: (rnd() - 0.5) * 8, vy: -14, t: 0.8, max: 0.8, color: '#6a6060', g: -4, steam: true }); sfx('close', { vol: 0.3, rate: 0.7 }); return true;
      case 'trainEnd': for (let i = 0; i < (ev.ok ? 30 : 10); i++) { const an = rnd() * Math.PI * 2, sp = 40 + rnd() * 100; P({ x: ev.x, y: ev.y - 12, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6 - 50, t: 0.8, max: 0.8, color: ev.ok ? (rnd() < 0.5 ? '#ffe080' : '#ffffff') : '#a8a0b0', g: 80, glow: ev.ok, size: 1.2 }); } return true;
      case 'questFind': for (let i = 0; i < 20; i++) { const an = rnd() * Math.PI * 2, sp = 30 + rnd() * 60; P({ x: ev.x, y: ev.y - 10, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6 - 40, t: 0.8, max: 0.8, color: rnd() < 0.5 ? ev.color : '#ffffff', g: 40, glow: true, size: 1.2 }); } sfx('lore', { vol: 0.5 }); return true;
      case 'npcTalk': sfx('open', { vol: 0.25, rate: 1.6 }); return true;
      case 'wpOpen': // 포탈이 깨어난다: 기둥의 문양에 빛이 차오르고 빛 알갱이가 솟는다
        for (let i = 0; i < 28; i++) { const s2 = rnd() < 0.5 ? -1 : 1; P({ x: ev.x + s2 * 13 + (rnd() - 0.5) * 6, y: ev.y + 4 - rnd() * 26, vx: (rnd() - 0.5) * 20, vy: -30 - rnd() * 40, t: 0.9, max: 0.9, color: rnd() < 0.5 ? '#bfefff' : '#ffffff', g: -10, glow: true, size: 1.2 }); }
        this.fx.push({ k: 'glow', x: ev.x, y: ev.y - 10, r: 34, color: '#8ad8ff', t: 0.8, max: 0.8 });
        this.shake = Math.max(this.shake, 2); sfx('levelup', { vol: 0.5, rate: 1.25 }); return true;
      case 'wpLeave': for (let i = 0; i < 22; i++) { const an = rnd() * Math.PI * 2; P({ x: ev.x, y: ev.y - 8, vx: Math.cos(an) * 40, vy: Math.sin(an) * 30 - 30, t: 0.6, max: 0.6, color: rnd() < 0.5 ? '#8ad8ff' : '#ffffff', g: -20, glow: true, size: 1.2 }); } return true;
      case 'wpArrive': // 건너왔다: 화면을 그 자리로 옮기고 잠깐 어두웠다 밝아진다
        this.cam.x = w.player.x - this.VW / 2; this.cam.y = w.player.y - this.VH / 2; this.fade = Math.max(this.fade, 1.1);
        for (let i = 0; i < 24; i++) { const an = rnd() * Math.PI * 2, sp = 20 + rnd() * 50; P({ x: ev.x, y: ev.y - 8, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6 - 20, t: 0.8, max: 0.8, color: rnd() < 0.5 ? '#8ad8ff' : '#e8faff', g: -10, glow: true, size: 1.2 }); }
        sfx('reaction', { vol: 0.6, rate: 1.6 }); sfx('dash', { vol: 0.5, rate: 0.8 }); return true;
      case 'toolSwing': sfx(ev.kind === 'axe' ? 'heavySwing' : 'swing', { vol: 0.35, rate: 0.9 }); return true;
      case 'gatherHit': {
        const ore = { coal: '#4a4650', copper: '#f0a060', iron: '#e0e8f4', silver: '#ffffff', gold: '#ffe070', crystal: '#d8c8ff', obsidian: '#8a7aaa' }[ev.type];
        const plant = ['herb', 'berry', 'mushroom', 'frostLily', 'fireBloom'].includes(ev.type);
        for (let i = 0; i < (plant ? 8 : 10); i++) { const an = -Math.PI * rnd(); P({ x: ev.x, y: ev.y, vx: Math.cos(an) * (30 + rnd() * 50), vy: Math.sin(an) * (40 + rnd() * 50), t: 0.45, max: 0.45, color: plant ? (rnd() < 0.5 ? '#5aa848' : '#3e7a2a') : rnd() < 0.6 ? '#8a8680' : '#5a5650', g: 220 }); }
        if (ore) for (let i = 0; i < 5; i++) P({ x: ev.x, y: ev.y - 2, vx: (rnd() - 0.5) * 120, vy: -40 - rnd() * 60, t: 0.3, max: 0.3, color: ore, g: 200, glow: true, size: 1 });
        if (!plant) { this.shake = Math.max(this.shake, 1.2); sfx(ev.type === 'crystal' ? 'freeze' : 'crack', { vol: 0.6, rate: 0.9 + rnd() * 0.2 }); } else sfx('dash', { vol: 0.4, rate: 1.3 });
        return true;
      }
      case 'nodeBreak': this.burst(ev.x, ev.y, '#8a8680', 18, 90); this.shake = Math.max(this.shake, 2.2); sfx('hitHeavy', { vol: 0.5, rate: 0.8 }); return true;
      case 'chopHit': for (let i = 0; i < 7; i++) P({ x: ev.x + (rnd() - 0.5) * 6, y: ev.y, vx: (rnd() - 0.5) * 90, vy: -30 - rnd() * 50, t: 0.5, max: 0.5, color: rnd() < 0.5 ? '#c8a070' : '#8a6038', g: 200 }); for (let i = 0; i < 4; i++) P({ x: ev.x + (rnd() - 0.5) * 22, y: ev.y - 26 - rnd() * 10, vx: (rnd() - 0.5) * 30, vy: 10 + rnd() * 20, t: 1.2, max: 1.2, color: rnd() < 0.5 ? '#5a9a3a' : '#86c454', g: 30 }); this.shake = Math.max(this.shake, 1); sfx('hurt', { vol: 0.55, rate: 1.1 + rnd() * 0.2 }); return true;
      case 'treeFall': for (let i = 0; i < 26; i++) P({ x: ev.x + (rnd() - 0.5) * 30, y: ev.y + (rnd() - 0.5) * 20, vx: (rnd() - 0.5) * 70, vy: -20 + rnd() * 40, t: 1.4, max: 1.4, color: ev.burnt ? '#3a3028' : rnd() < 0.5 ? '#5a9a3a' : '#86c454', g: 40, big: rnd() < 0.3 }); this.shake = Math.max(this.shake, 3); sfx('hitHeavy', { vol: 0.6, rate: 0.6 }); return true;
      case 'treeGrow': this.sparkBurst(ev.x, ev.y - 10, '#9be15d', 6); return true;
      case 'digDone': for (let i = 0; i < 16; i++) { const an = -Math.PI * rnd(); P({ x: ev.x, y: ev.y, vx: Math.cos(an) * (30 + rnd() * 60), vy: Math.sin(an) * (40 + rnd() * 60), t: 0.55, max: 0.55, color: rnd() < 0.5 ? '#7a5a38' : '#5a3e24', g: 240, big: rnd() < 0.3 }); } sfx('step', { vol: 0.7, rate: 0.7 }); sfx('drop', { vol: 0.4 }); return true;
      case 'goodGet': this.goodNote(ev.id, ev.n); sfx('echo', { vol: 0.25, rate: 1.5 + rnd() * 0.3 }); return true;
      case 'artifact': { const a = ARTIFACTS[ev.id]; this.banner = { text: `유물 발견 · ${a.name}`, sub: a.text, t: 4.5, color: '#ffd88a' }; this.burst(ev.x, ev.y, '#ffd88a', 24, 80); this.note(`유물 도감 · ${a.name}`, '#ffd88a'); sfx('lore', { vol: 0.6 }); sfx('levelup', { vol: 0.4 }); return true; }
      case 'fishCast': sfx('swing', { vol: 0.5, rate: 0.8 }); return true;
      case 'fishSplash': for (let i = 0; i < 8; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 40, vy: -30 - rnd() * 30, t: 0.4, max: 0.4, color: '#bfe8ff', g: 200 }); sfx('drop', { vol: 0.35, rate: 1.4 }); return true;
      case 'fishNibble': for (let i = 0; i < 3; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 20, vy: -15, t: 0.3, max: 0.3, color: '#e8f8ff', g: 120 }); return true;
      case 'fishBite': for (let i = 0; i < 12; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 70, vy: -40 - rnd() * 40, t: 0.5, max: 0.5, color: '#bfe8ff', g: 220 }); sfx('reaction', { vol: 0.35, rate: 1.8 }); return true;
      case 'fishHook': this.shake = Math.max(this.shake, 1.5); sfx('hit', { vol: 0.5 }); this.rhythmFx = []; this.banner = { text: '걸렸다!', sub: '박이 원에 닿을 때 G · Space · 클릭', t: 1.4, color: '#9ad8ff' }; return true;
      case 'beatTick': this.beatPulse = 1; tone(ev.count ? 1320 : 880, { dur: 0.05, type: 'sine', vol: ev.count ? 0.16 : 0.07 }); return true;
      case 'beatHit': {
        const scale = [0, 2, 4, 7, 9, 12, 9, 7, 4, 7, 9, 12, 14, 16, 12, 9], semi = scale[ev.idx % scale.length], fq = 523.25 * Math.pow(2, semi / 12);
        tone(fq, { dur: 0.22, type: 'triangle', vol: 0.2 });
        if (ev.grade === 'perfect') tone(fq * 2, { dur: 0.12, type: 'sine', vol: 0.08, when: 0.02 });
        (this.rhythmFx ||= []).push({ text: ev.grade === 'perfect' ? '완벽!' : '좋아', color: ev.grade === 'perfect' ? '#ffe070' : '#ffffff', t: 0.6 });
        for (let i = 0; i < (ev.grade === 'perfect' ? 6 : 3); i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 50, vy: -30 - rnd() * 30, t: 0.4, max: 0.4, color: '#bfe8ff', g: 200 });
        return true;
      }
      case 'beatMiss': tone(140, { dur: 0.18, type: 'square', vol: 0.06 }); (this.rhythmFx ||= []).push({ text: '놓침', color: '#a8a8b8', t: 0.6 }); this.missShake = 0.3; this.shake = Math.max(this.shake, 1.2); return true;
      case 'fishEnd': {
        if (!ev.ok || !ev.id) return true;
        const f = FISH[ev.id], name = GOODS[ev.id]?.name || (ev.id === 'bottleLetter' ? '유리병 편지' : ev.id);
        this.caught = { id: ev.id, t: 2.2 };
        this.texts.push({ x: ev.x, y: ev.y - 40, text: f ? `${name} ${ev.size}cm!` : `${name}!`, color: f?.legend ? '#ffd040' : '#e8f8ff', t: 2, vy: -8, vx: 0, label: true });
        if (ev.first) { this.banner = { text: `새 물고기 · ${name}`, sub: `${ev.size}cm · 물고기 도감에 남겼다${f.legend ? ' · 전설의 물고기!' : ''}${ev.allPerfect ? ' · 완벽한 박자!' : ''}`, t: 3.4, color: f.legend ? '#ffd040' : '#9ad8ff' }; sfx('levelup', { vol: 0.5 }); }
        else if (ev.allPerfect) this.banner = { text: '완벽한 박자!', sub: `${name} ${ev.size}cm — 박자를 다 맞추면 더 큰 물고기가 잡힌다`, t: 2.4, color: '#ffe070' };
        else if (ev.record) this.note(`${name} 최대 크기 경신 · ${ev.size}cm`, '#9ad8ff');
        for (const [k, fq] of [[0, 523.25], [1, 659.25], [2, 783.99], [3, 1046.5]]) tone(fq, { dur: 0.18, type: 'triangle', vol: 0.12, when: k * 0.07 });
        if (GOODS[ev.id]) this.goodNote(ev.id, 1);
        for (let i = 0; i < 14; i++) P({ x: ev.x, y: ev.y - 20, vx: (rnd() - 0.5) * 80, vy: -50 - rnd() * 40, t: 0.6, max: 0.6, color: '#bfe8ff', g: 220 });
        sfx('coin', { vol: 0.5 }); return true;
      }
      case 'farmTill': for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y, vx: (rnd() - 0.5) * 50, vy: -30 - rnd() * 30, t: 0.4, max: 0.4, color: rnd() < 0.5 ? '#7a5a38' : '#5a3e24', g: 220 }); sfx('step', { vol: 0.5, rate: 0.8 }); return true;
      case 'farmPlant': this.sparkBurst(ev.x, ev.y - 2, '#9be15d', 5); sfx('drop', { vol: 0.35, rate: 1.2 }); return true;
      case 'farmWater': for (let i = 0; i < 6; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - 6, vx: (rnd() - 0.5) * 20, vy: 10 + rnd() * 20, t: 0.4, max: 0.4, color: '#8ad0f0', g: 120 }); sfx('drop', { vol: 0.3, rate: 1.6 }); return true;
      case 'farmHarvest': this.burst(ev.x, ev.y - 4, '#9be15d', 12, 60); sfx('coin', { vol: 0.4, rate: 1.2 }); return true;
      case 'potion': { // 물약: 병에서 올라오는 붉은 거품 몇 개
        for (let i = 0; i < 6; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 8, y: ev.y - 4, vx: (Math.random() - 0.5) * 8, vy: -24 - Math.random() * 14, t: 0.6, max: 0.6, color: ev.color || '#e04a4a', g: -6, bubble: true });
        sfx('echo', { vol: 0.4, rate: 1.5 });
        return true;
      }
      case 'eat': {
        const nm = GOODS[ev.id]?.name || '';
        this.texts.push({ x: ev.x, y: ev.y - 30, text: `+${ev.heal}`, color: '#8af08a', t: 1.1, vy: -18, vx: 0, size: 2, pop: 0.12 });
        if (ev.eff) this.texts.push({ x: ev.x, y: ev.y - 44, text: ev.eff, color: ev.color || '#ffe8a8', t: 1.4, vy: -10, vx: 0, label: true });
        this.note(`${nm} · 체력 +${ev.heal}${ev.eff ? ' · ' + ev.eff : ''}`, ev.color || '#8af08a');
        for (let i = 0; i < 10; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - 10 - rnd() * 10, vx: (rnd() - 0.5) * 20, vy: -20 - rnd() * 25, t: 0.7, max: 0.7, color: i % 2 ? '#8af08a' : ev.color || '#ffffff', g: -10, glow: true, size: 1 });
        tone(660, { dur: 0.08, type: 'triangle', vol: 0.1 }); tone(880, { dur: 0.1, type: 'triangle', vol: 0.1, when: 0.07 });
        return true;
      }
      case 'enchant': { // 무기에 속성이 깃든다: 손 둘레로 그 속성 알갱이가 빨려 든다
        const col = ELEM[ev.elem].color;
        this.rimFlash = { color: col, t: 0.4, max: 0.4 };
        for (let i = 0; i < 18; i++) { const a = rnd() * Math.PI * 2, r = 18 + rnd() * 10; P({ x: ev.x + Math.cos(a) * r, y: ev.y - 8 + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 2, t: 0.3, max: 0.3, color: col, g: 0, glow: true, size: 1 }); }
        sfx(ev.elem === 'ice' ? 'freeze' : ev.elem === 'lightning' ? 'cast' : 'skill', { vol: 0.5, rate: 1.3 });
        return true;
      }
      case 'waterBreath': for (let i = 0; i < 16; i++) P({ x: ev.x + (rnd() - 0.5) * 16, y: ev.y - rnd() * 8, vx: (rnd() - 0.5) * 10, vy: -30 - rnd() * 30, t: 1, max: 1, color: '#bfe8ff', g: -10, bubble: true }); sfx('drop', { vol: 0.5, rate: 0.8 }); return true;
      case 'splash': for (let i = 0; i < (ev.big ? 22 : 10); i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y, vx: (rnd() - 0.5) * 70, vy: -50 - rnd() * 60, t: 0.6, max: 0.6, color: rnd() < 0.5 ? '#e8f8ff' : '#8ad0f0', g: 260 }); sfx('drop', { vol: ev.big ? 0.8 : 0.45, rate: ev.big ? 0.6 : 1.1 }); return true;
      case 'boatOn': case 'boatOff': for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 16, y: ev.y + 4, vx: (rnd() - 0.5) * 40, vy: -20 - rnd() * 20, t: 0.4, max: 0.4, color: '#e8f8ff', g: 200 }); sfx('step', { vol: 0.5, rate: 0.7 }); return true;
      case 'hopStart': for (let i = 0; i < 6; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y + 4, vx: (rnd() - 0.5) * 30, vy: -8 - rnd() * 10, t: 0.4, max: 0.4, color: '#a89880', g: 20, big: true }); sfx('dash', { vol: 0.4, rate: 1.3 }); return true;
      case 'thud': { // 착지: 양옆으로 퍼지는 흙먼지 · 튀는 돌 부스러기 · 화면 흔들림
        const n = ev.big ? 22 : 12;
        for (let i = 0; i < n; i++) { const s = rnd() < 0.5 ? -1 : 1; P({ x: ev.x + s * rnd() * 6, y: ev.y + 4, vx: s * (40 + rnd() * 70), vy: -6 - rnd() * 14, t: 0.55, max: 0.55, color: rnd() < 0.5 ? '#a89880' : '#8a7a66', g: 30, big: true }); }
        for (let i = 0; i < (ev.big ? 8 : 4); i++) P({ x: ev.x, y: ev.y + 2, vx: (rnd() - 0.5) * 90, vy: -60 - rnd() * 50, t: 0.5, max: 0.5, color: '#6a5e50', g: 320 });
        this.shake = Math.max(this.shake, ev.big ? 6 : 2.5); if (ev.big) this.hitstop = Math.max(this.hitstop, 0.05);
        sfx('hitHeavy', { vol: ev.big ? 0.8 : 0.45, rate: ev.big ? 0.5 : 0.75 }); sfx('step', { vol: 0.6, rate: 0.6 });
        return true;
      }
      case 'emberPop': for (let i = 0; i < 10; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y, vx: (rnd() - 0.5) * 60, vy: -30 - rnd() * 40, t: 0.45, max: 0.45, g: -20, flame: true, size: 1.2, color: '#ffffff' }); sfx('hit', { vol: 0.3, rate: 0.7 }); return true;
      case 'linkPulse': { // 고통이 사슬을 타고 건너간다
        for (let i = 0; i < 6; i++) { const u = i / 5; P({ x: ev.x1 + (ev.x2 - ev.x1) * u, y: ev.y1 + (ev.y2 - ev.y1) * u, vx: (rnd() - 0.5) * 10, vy: -6, t: 0.25 + u * 0.1, max: 0.35, color: '#e0a8ff', g: 0, glow: true, size: 1 }); }
        return true;
      }
      case 'linkBreak': for (let i = 0; i < 8; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 80, vy: -20 - rnd() * 40, t: 0.4, max: 0.4, color: '#b88ad8', g: 200 }); sfx('crack', { vol: 0.35, rate: 1.6 }); return true;
      case 'reel': sfx('dash', { vol: 0.5, rate: 0.7 }); return true;
      case 'whipCrack': for (let i = 0; i < 6; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 120, vy: (rnd() - 0.5) * 120, t: 0.14, max: 0.14, color: '#fff4d8', g: 0, line: true }); sfx('hitArmor', { vol: 0.35, rate: 1.8 }); return true;
    }
    return false;
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
    const wpn = w.b.weapon, wa = weaponArt(w.b.weaponId, ITEMS), dir = p.dir;
    const aimF = Math.atan2(p.aimY, p.aimX * dir); // 조준 방향을 바라보는 쪽 기준으로 (스킬 동작 중에는 조준이 고정됨)
    const breathe = Math.sin(w.t * 3) * 0.04;
    const kind = wa.bow ? 'bow' : wa.crossbow ? 'crossbow' : wa.fist ? 'fist' : wa.whip ? 'whip' : wa.orb ? 'orb' : wa.tome ? 'tome' : wa.great ? 'great' : wa.spear ? 'spear' : wa.thrown ? 'axe' : wpn.kind === 'proj' && wpn.dmg === 'mag' ? 'staff' : wpn.boomerang ? 'axe' : wpn.kind === 'proj' ? 'tube' : 'melee';
    const P = { lean: 0, ox: 0, oy: 0, sx: 1, sy: 1, lift: 0, a: 0.55 + breathe, hx: 4, hy: -5, behind: false, kind, glow: 0 };
    // 평소 자세
    if (kind === 'great') { P.a = 2.86 + breathe * 0.5; P.hx = -1; P.hy = -5; P.behind = true; } // 칼끝을 뒤쪽 땅에 내려 둔다
    else if (kind === 'staff') { P.a = -1.5 + breathe; P.hx = 5; P.hy = -7; }
    else if (kind === 'spear') { P.a = -1.2 + breathe; P.hx = 5; P.hy = -7; }
    else if (kind === 'tube') { P.a = 1.2 + breathe; P.hx = 4; P.hy = -6; } // 바람총: 옆구리에 비스듬히
    else if (kind === 'axe') { P.a = 0.9 + breathe; P.hx = 4; P.hy = -5; }
    else if (kind === 'bow') { P.a = 0.04 + breathe * 0.4; P.hx = 9; P.hy = -8; P.bowIdle = true; } // 활: 옆으로 쏠 때처럼 앞에 세워 든다 (시위는 당기지 않는다)
    else if (kind === 'crossbow') { P.a = 0.35 + breathe * 0.5; P.hx = 4; P.hy = -5; } // 석궁: 허리춤에 앞을 낮춰 든다
    else if (kind === 'fist') { P.a = 0; P.hx = 5; P.hy = -5 + Math.sin(w.t * 3) * 0.6; } // 주먹: 가볍게 쥐고 선다
    else if (kind === 'whip') { P.a = 1.25 + breathe; P.hx = 4; P.hy = -5; } // 채찍: 손잡이를 아래로 쥐고 줄은 감아 둔다
    else if (kind === 'orb') { P.a = -1.5; P.hx = 6; P.hy = -11 + Math.sin(w.t * 2.4) * 1.2; } // 구슬: 손 위에 떠 있다
    else if (kind === 'tome') { P.a = 0.15 + breathe; P.hx = 5; P.hy = -6; } // 마도서: 옆구리에 끼고 다닌다
    if (wa.long && kind === 'melee') { P.a = -1.3 + breathe; P.hx = 4; P.hy = -6; } // 낫: 날을 위로 세워 어깨에 기대 든다
    if (p.moving && p.dashT <= 0) { P.lean = 1; P.oy = Math.abs(Math.sin(p.walkT * 11)) > 0.7 ? -1 : 0; if (kind === 'bow' || kind === 'tube') P.a += Math.sin(p.walkT * 11) * 0.12; }
    if (p.hitFlash > 0) { P.lean -= 2; P.ox -= p.dir * 1; } // 맞으면 움찔
    if (p.dashT > 0) { P.lean = 3; P.sx = 1.08; P.sy = 0.92; }
    if (kind === 'great' && p.moving && p.dashT <= 0) { P.a = 2.86 + Math.sin(p.walkT * 11) * 0.03; P.hx = -1; P.hy = -5; P.behind = true; P.drag = true; P.lean = 1.5; }

    // 평타
    const k = p.swingMax && p.swingT > 0 ? 1 - p.swingT / p.swingMax : -1;
    if (k >= 0 && !p.motion) {
      if (kind === 'fist') { // 주먹: 조준 쪽으로 곧게 내지른다 (왼손 · 오른손 번갈아)
        const out = k < 0.45 ? easeOut(k / 0.45) : 1 - (k - 0.45) / 0.55;
        P.a = aimF; P.hx = 5 + 8 * out; P.hy = -6 + Math.sin(aimF) * 3 * out; P.lean = 2.5 * out; P.ox = Math.cos(p.swingAng) * 2 * out; P.punch = out; P.offhand = p.swingDir > 0;
      } else if (kind === 'whip') { // 채찍: 머리 위로 들었다가 앞으로 내리친다 (줄이 뒤따라 뻗는다)
        const up = Math.min(1, k / 0.3), dn = k < 0.3 ? 0 : easeOut(Math.min(1, (k - 0.3) / 0.25));
        P.a = k < 0.3 ? 1.25 - 3.6 * up : -2.35 + (aimF + 2.35) * dn; P.hx = k < 0.3 ? 2 : 2 + 6 * dn; P.hy = k < 0.3 ? -8 - 5 * up : -13 + 7 * dn; P.lean = k < 0.3 ? -1.5 * up : 2.5 * dn; P.lash = k; P.behind = k < 0.2;
      } else if (kind === 'crossbow') { P.a = aimF; P.hx = 7; P.hy = -4; P.aiming = true; P.recoil = Math.max(0, 1 - k * 3); P.lean = -1.5 * P.recoil; }
      else if (kind === 'orb') { const q = Math.sin(Math.min(1, k * 1.4) * Math.PI); P.a = aimF; P.hx = 6 + 6 * q; P.hy = -11 + Math.sin(aimF) * 4 * q; P.lean = 1.5 * q; P.glow = q; }
      else if (kind === 'tome') { const q = Math.sin(Math.min(1, k * 1.2) * Math.PI); P.a = aimF; P.hx = 8 + 3 * q; P.hy = -8; P.open = 1; P.lean = -1 + 2 * q; P.glow = q; }
      else if (kind === 'spear') {
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
    if (kind === 'crossbow' && p.attackHeld && k < 0 && !p.motion) { P.a = aimF; P.hx = 7; P.hy = -4; P.aiming = true; }
    if (kind === 'tome' && (p.castT > 0 || p.attackHeld)) { P.a = aimF; P.hx = 8; P.hy = -8; P.open = 1; }
    if (kind === 'bow' && (p.attackHeld || p.swingT > 0)) {
      const pull = p.attackHeld && p.atkPeriod && p.swingT <= 0 ? Math.min(1, 1 - p.atkCd / p.atkPeriod) : 0;
      P.a = aimF; Object.assign(P, bowHand(aimF)); P.pull = pull; P.snap = p.swingT > 0 ? p.swingT / 0.1 : 0; P.aiming = true; P.bowIdle = false; P.lean = -1 * pull;
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
    if (p.drop) { P.sy = 1.08; P.sx = 0.94; P.lean = 0; } // 떨어지는 동안 몸이 늘어난다
    if (p.landT > 0) { const q = p.landT / 0.32; P.sy = 1 - 0.2 * q; P.sx = 1 + 0.14 * q; P.oy += 1; } // 착지: 찌그러졌다 펴진다
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
      case 'spin': { // 도는 베기 (연속베기 등): 평타 대검처럼 허리 높이에서 몸 둘레를 바닥과 나란히 한 바퀴. 앞뒤로 돌 때 칼이 짧아 보인다
        const turn = p.combo ? ((p.combo.i - 1) % 2 ? -1 : 1) : 1;  // 연속베기는 한 바퀴마다 방향을 바꾼다
        const s2 = k < 0.15 ? 0.5 * (k / 0.15) * (k / 0.15) * 0.15 : 0.075 + (k - 0.15) / 0.85 * 0.925; // 처음만 살짝 붙었다가 일정하게
        const th = (Math.PI - 0.5) - turn * Math.PI * 2 * s2, c = Math.cos(th), sn = Math.sin(th);
        set({ a: Math.atan2(sn * 0.3 + 0.1, c), hx: 7 * c, hy: -7 + 1.5 * sn, lean: 2.5 * c, ox: 1.5 * c, behind: sn < -0.15 });
        P.len = Math.sqrt(c * c + 0.09 * sn * sn); P.wid = 0.5; P.whoosh = 1; // 빠르게 돌 때는 날을 세워 얇게
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
        if (P.kind === 'bow') set({ a: aimF, ...bowHand(aimF), aiming: true, bowIdle: false, pull: rel ? 0 : q, snap: rel ? Math.max(0, 1 - (k - 0.45) / 0.15) : 0, lean: rel ? 1 - (k - 0.45) : -1.5 * q });
        else if (P.kind === 'tube') set({ a: aimF, hx: 4, hy: (MOUTH_Y[w.b.race] ?? -9), tubeMouth: true, lean: rel ? 0.5 : -1.5 * q, sy: rel ? 1 : 1 + 0.04 * q });
        else set({ a: aimF, hx: rel ? 9 : 4, hy: -9, lean: rel ? 2 : -1 });
        break;
      }
      case 'crouch': set({ sy: 0.82, lean: 1.5 }); break;
      case 'channel': set({ lift: 2 + Math.sin(w.t * 6), sy: 1.03, a: -1.35, hx: 7, hy: -10, glow: 0.8 }); break;
      case 'aim': set({ lean: -1.5, a: aimF, ...(P.kind === 'bow' ? bowHand(aimF) : { hx: 4, hy: -8 }), aiming: P.kind === 'bow', pull: Math.min(1, k * 2), bowIdle: false }); break;
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
      case 'castHold': if (P.kind === 'bow' || P.kind === 'tube') { set({ lean: -1.5, a: aimF, ...(P.kind === 'bow' ? bowHand(aimF) : { hx: 4, hy: MOUTH_Y[w.b.race] ?? -9 }), aiming: P.kind === 'bow', pull: Math.min(1, m.t / 0.6), bowIdle: false, tubeMouth: P.kind === 'tube' }); break; }
        set({ a: -1.15 + Math.sin(w.t * 12) * 0.05, hx: 7, hy: -10, lean: -1, glow: 1 }); break;
      case 'castBigHold': set({ a: -1.55 + Math.sin(w.t * 10) * 0.05, hx: 6, hy: -13, lean: -1.5, sy: 1.06, glow: 1, lift: 2 + Math.sin(w.t * 8) }); break;
    }
  }

  // 칼끝 궤적: 무기가 빠르게 돌면 지난 0.12초 동안 칼날이 지나간 자리를 잔상으로 채운다.
  // 표본 사이는 각도 · 길이 · 손 위치를 잘게 나눠 이어서, 한 프레임에 많이 돌아도 끊긴 햇살처럼 보이지 않는다
  weaponTrail(w, p, P, bx, by, gs) {
    const K = P.kind;
    if (K === 'bow' || K === 'staff' || K === 'tube' || K === 'crossbow' || K === 'orb' || K === 'tome' || K === 'fist' || K === 'whip' || p.swim) { this.trail = []; return; }
    const wa = weaponArt(w.b.weaponId, ITEMS), img = sprite(wa.s, wa.tint || '');
    if (!img) return;
    const L = this.bladeLen(wa, P, img, gs), now = w.t, LIFE = 0.12;
    const hx = bx + p.dir * P.hx * gs, hy = by + P.hy * gs;
    let tr = (this.trail ||= []);
    if (tr.length && (now < tr[tr.length - 1].t || this.trailWorld !== w)) tr = this.trail = []; // 새 세계(층 · 던전)는 시간이 0부터 — 예전 세계의 잔상이 바닥에 박혀 남지 않게
    this.trailWorld = w;
    if (!tr.length || tr[tr.length - 1].t !== now) tr.push({ x: hx, y: hy, a: P.ang, L, t: now });
    while (tr.length > 2 && now - tr[0].t > LIFE) tr.shift();
    if (tr.length < 3) return;
    let turn = 0;
    for (let i = 1; i < tr.length; i++) turn += Math.abs(Math.atan2(Math.sin(tr[i].a - tr[i - 1].a), Math.cos(tr[i].a - tr[i - 1].a)));
    if (turn < 0.6) return;
    const g = this.g, st = this.trailStyle && this.trailStyle.until > now ? this.trailStyle : null, spin = p.motion?.kind === 'spin';
    const col = st?.col || (p.buffs?.charged || K === 'great' ? '#fff2c8' : '#e8f2ff'), strength = Math.min(1, turn / 1.6);
    if (K === 'great' && P.whoosh > 0.5 && Math.random() < 0.6) { const t2 = tr[tr.length - 1]; this.parts.push({ x: t2.x + Math.cos(t2.a) * t2.L, y: t2.y + Math.sin(t2.a) * t2.L, vx: (Math.random() - 0.5) * 30, vy: -10, t: 0.25, max: 0.25, color: '#fff4d8', g: 0, line: true }); }
    this.trailDrawnT = now;
    // 잔상 띠 대신: 칼끝이 지나간 자리에 짧게 반짝이는 불티 (휘두른 만큼만)
    const last = tr[tr.length - 1], prev = tr[tr.length - 2];
    if (this.sparkT === now) return; this.sparkT = now; // 세계가 멈추면 불티도 멈춘다
    const n = Math.min(4, Math.ceil(strength * 3));
    for (let i = 0; i < n; i++) {
      const k = Math.random(), a = prev.a + (last.a - prev.a) * k, Lk = prev.L + (last.L - prev.L) * k * (0.85 + Math.random() * 0.15);
      const x = prev.x + (last.x - prev.x) * k + Math.cos(a) * Lk, y = prev.y + (last.y - prev.y) * k + Math.sin(a) * Lk;
      this.parts.push({ x, y, vx: -Math.sin(a) * (20 + Math.random() * 30) * Math.sign(last.a - prev.a || 1), vy: Math.cos(a) * (20 + Math.random() * 30) * Math.sign(last.a - prev.a || 1) - 10, t: 0.16 + Math.random() * 0.1, max: 0.24, color: col, g: 60, glow: true, size: 1 });
    }
  }

  // 무기 그림의 배율 · 쥐는 자리 (칼날 길이 계산과 같이 쓴다)
  bladeGeom(wa, P, img, gs) {
    const great = wa.great, staff = P.kind === 'staff', spear = P.kind === 'spear', long = !!wa.long;
    const sc = (great || spear || long ? 1 : staff ? 26 / img.height : Math.min(1, (wa.thrown ? 16 : 20) / img.height)) * gs;
    const grip = great ? 7 : staff ? img.height / 2 : spear ? img.height * 0.36 : long ? img.height * 0.3 : 2;
    return { sc, grip };
  }
  bladeLen(wa, P, img, gs) { const { sc, grip } = this.bladeGeom(wa, P, img, gs); return (img.height - grip) * sc * (P.len || 1); }
  drawWeapon(w, p, P, bx, by, gs = 1) {
    const g = this.g, dir = p.dir;
    const wa = weaponArt(w.b.weaponId, ITEMS);
    const ang = P.ang;
    const hx = bx + dir * P.hx * gs, hy = by + P.hy * gs;
    if (this.drawSpecialWeapon(w, p, P, wa, bx, by, hx, hy, ang, gs)) return;
    const img = sprite(wa.s, wa.tint || '');
    if (!img) return;
    // 던진 부메랑이 날아가는 동안은 손이 빈다
    if (wa.thrown && w.b.weapon.boomerang && w.projs.some((pr) => pr.owner === 'p' && pr.boomerang && pr.weaponHit)) { this.fistAt(w, hx, hy); return; }
    if (w.b.weapon.hits === 2 && !wa.bow && !wa.thrown) { // 쌍검: 왼손에 한 자루 더 (오른손 칼과 엇갈리게, 휘두를 때는 반대 박자로)
      const { sc, grip } = this.bladeGeom(wa, P, img, gs), sw = p.swingT > 0 ? Math.sin(Math.min(1, 1 - p.swingT / Math.max(0.01, p.swingMax || 0.3)) * Math.PI) : 0;
      const ox = bx - dir * (2 - sw * 3) * gs, oy = hy + (2 - sw) * gs, a2 = ang + dir * (0.75 - sw * 1.3);
      g.save(); g.translate(Math.round(ox), Math.round(oy)); g.rotate(a2 + Math.PI / 2);
      g.drawImage(img, Math.round(-img.width * sc / 2), Math.round(-img.height * sc + grip * sc), Math.round(img.width * sc), Math.round(img.height * sc));
      g.restore();
      const sk2 = HAND_COLOR[w.b.race] || '#e8b48a';
      g.fillStyle = '#16121c'; g.fillRect(Math.round(ox) - 2, Math.round(oy) - 2, 4, 4); g.fillStyle = sk2; g.fillRect(Math.round(ox) - 1, Math.round(oy) - 1, 2, 2);
    }
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
      const { sc, grip } = this.bladeGeom(wa, P, img, gs);
      if (P.kind === 'tube' && P.tubeMouth) { g.restore(); g.save(); g.translate(Math.round(bx + dir * 2), Math.round(by + P.hy * gs)); g.rotate(ang + Math.PI / 2); g.drawImage(img, Math.round(-img.width / 2), -img.height); g.restore(); g.save(); g.translate(Math.round(hx), Math.round(hy)); g.globalAlpha = 0; }
      if ((P.len && P.len < 0.999) || P.wid) g.scale(P.wid || 1, P.len || 1);
      g.drawImage(img, Math.round(-img.width * sc / 2), Math.round(-img.height * sc + grip * sc), Math.round(img.width * sc), Math.round(img.height * sc));
    }
    g.restore();
    // 손: 무기를 쥔 주먹 (두 손 무기는 두 개)
    const skin = HAND_COLOR[w.b.race] || '#e8b48a';
    const fist = (x, y) => { g.fillStyle = '#16121c'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); g.fillStyle = skin; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); };
    if (!P.behind && !wa.bow && !(P.kind === 'tube' && P.tubeMouth)) {
      fist(hx, hy);
      if (wa.great || wa.spear || wa.long) fist(hx + Math.cos(ang) * (wa.spear || wa.long ? -5 : 4), hy + Math.sin(ang) * (wa.spear || wa.long ? -5 : 4));
    }
    if (P.kind === 'staff' && P.behind) fist(hx, hy);
    if (P.kind === 'tube' && P.tubeMouth) fist(bx + dir * 2 + Math.cos(ang) * 6, by + P.hy * gs + Math.sin(ang) * 6);
    // 지팡이 끝 빛: 시전할수록 밝아진다
    if (w.b.weapon.dmg === 'mag' && w.b.weapon.kind === 'proj') {
      const len = 12 * gs, tx = hx + Math.cos(ang) * len, ty = hy + Math.sin(ang) * len;
      const col = this.castColor(w, p);
      const k = Math.max(P.glow || 0, p.castT > 0 ? 1 : 0);
      const r = 2 + k * 2.2; // 떨리지 않게 (도트 빛은 크기가 바뀌면 깜빡여 보인다)
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(tx, ty, 0, tx, ty, r * 2.2);
      gr.addColorStop(0, hexA(col, 0.5 + 0.4 * k)); gr.addColorStop(0.4, hexA(col, 0.2 + 0.25 * k)); gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr; g.fillRect(tx - r * 2.2, ty - r * 2.2, r * 4.4, r * 4.4);
      g.fillStyle = hexA(col, 0.9); disc(g, tx, ty, Math.max(1, r * 0.55));
      g.fillStyle = hexA('#ffffff', 0.6 + 0.4 * k); disc(g, tx, ty, Math.max(0.7, r * 0.3));
      g.restore();
      if (k > 0.3 && Math.random() < 0.2 * k) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: tx + Math.cos(a) * 8, y: ty + Math.sin(a) * 8, vx: -Math.cos(a) * 40, vy: -Math.sin(a) * 40, t: 0.25, max: 0.25, color: col, g: 0, glow: true }); }
    }
  }

  // 손에 든 것: 주먹 장갑 · 채찍 · 마법 구슬 · 마도서 · 석궁 (그림을 직접 그린다). 그렸으면 true
  fistAt(w, x, y, metal, dir = 1) {
    const g = this.g, skin = HAND_COLOR[w.b.race] || '#e8b48a';
    if (metal) { // 너클 낀 주먹: 마디 쇠 · 손목 가죽 띠
      const X = Math.round(x), Y = Math.round(y), f = dir > 0 ? 1 : -1;
      g.fillStyle = '#16121c'; g.fillRect(X - 3, Y - 3, 7, 6);
      g.fillStyle = '#6a4a2a'; g.fillRect(f > 0 ? X - 2 : X + 1, Y - 2, 2, 4); // 손목 띠
      g.fillStyle = metal; g.fillRect(f > 0 ? X : X - 2, Y - 2, 3, 4);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(f > 0 ? X : X - 2, Y - 2, 3, 1);
      g.fillStyle = '#16121c'; g.fillRect(f > 0 ? X + 3 : X - 3, Y - 2, 1, 1); g.fillRect(f > 0 ? X + 3 : X - 3, Y, 1, 1); // 마디 가시
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(f > 0 ? X : X - 2, Y + 1, 3, 1);
      return;
    }
    g.fillStyle = '#16121c'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); g.fillStyle = skin; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  fistMetal(wa) { const t = wa.tint || ''; return wa.metal || (t.startsWith('sepia(1) saturate(2.3)') ? '#d0763a' : t.includes('brightness(0.42)') ? '#5a4a6a' : t.includes('grayscale(0.85)') ? '#e0e4ee' : t.includes('grayscale(1)') ? '#8a8a86' : t.includes('saturate(3)') ? '#f0c040' : t.includes('sepia(0.35)') ? '#e8e0cc' : '#b8c0cc'); }
  drawSpecialWeapon(w, p, P, wa, bx, by, hx, hy, ang, gs) {
    const g = this.g, dir = p.dir, t = w.t;
    const metal = this.fistMetal(wa);
    if (P.kind === 'fist') { // 주먹 장갑: 내지르는 손 (반대 손은 몸 뒤에서 따로 그린다)
      this.fistAt(w, hx, hy, metal, dir);
      if (P.punch > 0.6) for (let i = 0; i < 2; i++) this.parts.push({ x: hx + Math.cos(ang) * 4, y: hy + Math.sin(ang) * 4, vx: Math.cos(ang) * 60 + (Math.random() - 0.5) * 30, vy: Math.sin(ang) * 60 + (Math.random() - 0.5) * 30, t: 0.12, max: 0.12, color: '#ffffff', g: 0, line: true });
      return true;
    }
    if (P.kind === 'orb') { // 마법 구슬: 손바닥 위에 떠서 천천히 돈다
      const ox = Math.round(hx), oy = Math.round(hy - 3), r = 3.4 * gs, tn = wa.tint || '';
      const col = tn.includes('hue-rotate(150deg)') ? '#5ac8f0' : tn.includes('saturate(3)') ? '#f0b830' : tn.includes('brightness(0.42)') ? '#7a4ac8' : tn.includes('hue-rotate(-40deg)') ? '#f06a7a' : tn.includes('grayscale(1)') ? '#7a8a9a' : '#8a9ad8';
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(ox, oy, 0, ox, oy, r * 2.6); gr.addColorStop(0, hexA(col, 0.22 + 0.4 * (P.glow || 0))); gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr; g.fillRect(ox - r * 2.6, oy - r * 2.6, r * 5.2, r * 5.2); g.restore();
      const bodyG = g.createRadialGradient(ox - r * 0.4, oy - r * 0.5, 0.5, ox, oy, r);
      bodyG.addColorStop(0, '#ffffff'); bodyG.addColorStop(0.3, col); bodyG.addColorStop(1, '#16121c');
      g.fillStyle = '#16121c'; disc(g, ox, oy, r + 1); g.fillStyle = bodyG; disc(g, ox, oy, r);
      const sw = t * 2.4; g.fillStyle = hexA('#ffffff', 0.75); // 안에서 도는 빛 두 점
      for (const k of [0, Math.PI]) g.fillRect(Math.round(ox + Math.cos(sw + k) * r * 0.45), Math.round(oy + Math.sin(sw + k) * r * 0.3), 1, 1);
      if (Math.random() < 0.06 + 0.3 * (P.glow || 0)) this.parts.push({ x: ox + (Math.random() - 0.5) * r * 2, y: oy + (Math.random() - 0.5) * r * 2, vx: 0, vy: -10, t: 0.4, max: 0.4, color: col, g: 0, glow: true, size: 1 });
      this.fistAt(w, hx - dir * 1, hy + 5);
      return true;
    }
    if (P.kind === 'tome') { // 마도서: 펼치면 책장이 넘어간다 (가슴께에 들어 얼굴을 가리지 않게)
      const img = sprite(wa.s, wa.tint || ''); if (!img) return false;
      const X = Math.round(hx + dir * 1), Y = Math.round(hy + 3);
      g.save(); g.translate(X, Y);
      if (P.open) {
        const flip = (t * 5) % 1;
        g.fillStyle = '#16121c'; g.fillRect(-7, -5, 14, 8);
        g.drawImage(img, 1, 1, 2, img.height - 2, -7, -4, 1, 6); g.drawImage(img, img.width - 3, 1, 2, img.height - 2, 6, -4, 1, 6); // 앞뒤 표지
        g.fillStyle = '#f4ecd8'; g.fillRect(-6, -4, 5, 6); g.fillRect(1, -4, 5, 6);
        g.fillStyle = '#c8b898'; g.fillRect(-1, -4, 2, 6);
        g.fillStyle = '#8a7a6a'; for (let k = 0; k < 2; k++) { g.fillRect(-5, -2 + k * 2, 3, 1); g.fillRect(2, -2 + k * 2, 3, 1); }
        if (P.glow > 0.2 || p.castT > 0) { const fx = flip < 0.6 ? Math.round(-5 + flip / 0.6 * 10) : 5; g.fillStyle = '#ffffff'; g.fillRect(fx, -5, 1, 7); }
        g.restore();
        if ((P.glow > 0.3 || p.castT > 0) && Math.random() < 0.18) this.parts.push({ x: X + (Math.random() - 0.5) * 10, y: Y - 5, vx: (Math.random() - 0.5) * 10, vy: -22, t: 0.45, max: 0.45, color: this.castColor(w, p), g: 0, glow: true, size: 1 });
        this.fistAt(w, X - 7, Y); this.fistAt(w, X + 7, Y);
        return true;
      }
      g.rotate(dir > 0 ? 0.2 : -0.2); g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2)); g.restore();
      this.fistAt(w, hx, hy + 3);
      return true;
    }
    if (P.kind === 'crossbow') { // 석궁: 조준 쪽으로 눕혀 든다 (왼쪽을 보면 위아래를 뒤집는다)
      const img = sprite(wa.s, wa.tint || ''); if (!img) return false;
      g.save(); g.translate(Math.round(hx - Math.cos(ang) * 2 * (P.recoil || 0)), Math.round(hy - Math.sin(ang) * 2 * (P.recoil || 0)));
      g.rotate(ang); if (dir < 0) g.scale(1, -1);
      g.drawImage(img, -8, -Math.round(img.height / 2));
      // 시위: 쏜 뒤에는 앞으로 풀리고, 다시 당겨진다
      const drawn = P.recoil ? 1 - P.recoil : 1, nx = 6 + 5 * drawn;
      g.strokeStyle = '#e8e2cf'; g.lineWidth = 1; g.beginPath(); g.moveTo(8.5, -4); g.lineTo(-8 + nx, 0); g.lineTo(8.5, 4); g.stroke();
      if (drawn > 0.95) { g.fillStyle = '#c8ccd8'; g.fillRect(-8 + nx, -1, 10, 1); g.fillStyle = '#e8eef4'; g.fillRect(-8 + nx + 9, -1, 2, 1); }
      g.restore();
      this.fistAt(w, hx, hy); this.fistAt(w, hx + Math.cos(ang) * 7, hy + Math.sin(ang) * 7);
      return true;
    }
    if (P.kind === 'whip') { // 채찍: 손잡이 + 가죽 줄 (쉴 때는 허리에 감아 두고, 휘두르면 앞으로 뻗었다가 돌아온다)
      const img = sprite(wa.s, wa.tint || '');
      if (img) { g.save(); g.translate(Math.round(hx), Math.round(hy)); g.rotate(ang + Math.PI / 2); g.drawImage(img, -Math.round(img.width / 2), -img.height + 2); g.restore(); }
      const tx = hx + Math.cos(ang) * 8, ty = hy + Math.sin(ang) * 8, rope = '#7a5232', ropeD = '#3a2414';
      if (P.lash == null) { // 감아 둔 줄
        const cx = bx + dir * 6, cy = by - 3;
        g.strokeStyle = ropeD; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, 4, 2.6, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = rope; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, 4, 2.6, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = rope; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + dir * 2, cy - 6, cx - dir * 3, cy - 1); g.stroke();
      } else {
        const k = P.lash, aimA = Math.atan2(p.aimY, p.aimX), reach = w.b.weapon.range || 70;
        const ext = k < 0.3 ? 0.25 : k < 0.6 ? 0.25 + 0.75 * easeOut((k - 0.3) / 0.3) : 1 - 0.7 * ((k - 0.6) / 0.4);
        const L = reach * ext, ex = p.x + Math.cos(aimA) * L, ey = p.y - 6 + Math.sin(aimA) * L;
        const nx = -Math.sin(aimA), ny = Math.cos(aimA), wave = (k < 0.6 ? 1 - k / 0.6 : 0) * 14 * (p.swingDir || 1);
        const c1x = tx + (ex - tx) * 0.35 + nx * wave, c1y = ty + (ey - ty) * 0.35 + ny * wave, c2x = tx + (ex - tx) * 0.7 - nx * wave * 0.6, c2y = ty + (ey - ty) * 0.7 - ny * wave * 0.6;
        for (const [col, wd] of [[ropeD, 2.6], [rope, 1.3]]) { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.moveTo(tx, ty); g.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey); g.stroke(); }
        if (k > 0.45 && k < 0.62) { g.fillStyle = '#fff4d8'; g.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3); for (let i = 0; i < 2; i++) this.parts.push({ x: ex, y: ey, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, t: 0.12, max: 0.12, color: '#fff4d8', g: 0, line: true }); }
      }
      this.fistAt(w, hx, hy);
      return true;
    }
    return false;
  }
  // 방패 (검과 방패): 반대 팔에 든다. 몸 뒤쪽 가장자리에 걸쳐 보인다
  drawShield(w, p, P, bx, by, gs) {
    const g = this.g, dir = p.dir, x = Math.round(bx - dir * 5 * gs), y = Math.round(by - 9 * gs);
    const front = w.b.wcat === 'shield' && w.b.weaponId === 'bastionBlade' ? '#d8c070' : '#8a96b0', rim = '#4a4a56';
    g.fillStyle = '#16121c'; g.beginPath(); g.moveTo(x - 5, y - 6); g.lineTo(x + 5, y - 6); g.lineTo(x + 5, y + 2); g.lineTo(x, y + 7); g.lineTo(x - 5, y + 2); g.closePath(); g.fill();
    g.fillStyle = rim; g.beginPath(); g.moveTo(x - 4, y - 5); g.lineTo(x + 4, y - 5); g.lineTo(x + 4, y + 2); g.lineTo(x, y + 6); g.lineTo(x - 4, y + 2); g.closePath(); g.fill();
    g.fillStyle = front; g.beginPath(); g.moveTo(x - 3, y - 4); g.lineTo(x + 3, y - 4); g.lineTo(x + 3, y + 2); g.lineTo(x, y + 5); g.lineTo(x - 3, y + 2); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x - 3, y - 4, 6, 1);
    g.fillStyle = '#c83a3a'; g.fillRect(x - 1, y - 3, 2, 6); g.fillRect(x - 2, y - 1, 4, 2);
  }

  // 불러낸 정령: 도트 그림이 날갯짓 · 흔들림 4장으로 움직인다. 강화 중엔 속성 빛 알갱이, 정령의 품이면 내 둘레를 도는 작은 빛 넷
  drawFamiliar(w, p, which = null) {
    const g = this.g, f = which || p.familiar, img = spiritSprite(f.id, Math.floor(w.t * (f.emp > 0 ? 10 : 6)) + (f.phase | 0));
    if (!img) return;
    const col = ELEM[{ fire: 'fire', ice: 'ice', lightning: 'lightning', wind: 'wind', forest: 'poison', dark: 'dark' }[f.elem]]?.color || '#9bffb0';
    const fade = f.t < 2 && Math.floor(w.t * 8) % 2 ? 0.45 : 1; // 곧 떠난다
    this.shadow(f.x, p.y + 3, Math.max(3, img.width / 4));
    g.globalAlpha = fade;
    g.save(); g.translate(Math.round(f.x), Math.round(f.y)); if (p.dir < 0) g.scale(-1, 1);
    g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2));
    g.restore();
    g.globalAlpha = 1;
    if (f.emp > 0 && Math.random() < 0.25) this.parts.push({ x: f.x + (Math.random() - 0.5) * img.width, y: f.y + (Math.random() - 0.5) * img.height, vx: 0, vy: -18, t: 0.45, max: 0.45, color: col, g: 0, glow: true, size: 1 });
    if (f.guard > 0) for (let i = 0; i < 4; i++) { const a = w.t * 3 + (i / 4) * Math.PI * 2, x = Math.round(p.x + Math.cos(a) * 13), y = Math.round(p.y - 8 + Math.sin(a) * 7); g.fillStyle = '#16121c'; g.fillRect(x - 2, y - 2, 4, 4); g.fillStyle = col; g.fillRect(x - 1, y - 1, 2, 2); }
  }

  // 왼손 도구: 둥근 작은 방패 · 매달린 부적 · 앞을 겨눈 손쇠뇌 · 허리춤 주머니
  drawOffhand(w, p, P, bx, by, gs, layer = 'back') {
    const g = this.g, dir = p.dir, id = w.b.offId, look = OFF_LOOK[id], O = '#16121c';
    if ((look === 'xbow') !== (layer === 'front')) return;
    const x = Math.round(bx - dir * 5 * gs), y = Math.round(by - 8 * gs);
    if (look === 'buckler') {
      const fine = id === 'knightBuckler';
      g.fillStyle = O; disc(g, x, y, 5); g.fillStyle = fine ? '#7a86a0' : '#7a5a36'; disc(g, x, y, 4);
      g.fillStyle = fine ? '#a8b4c8' : '#a07a4a'; g.fillRect(x - 3, y - 3, 3, 2); g.fillRect(x - 3, y - 1, 1, 2);
      g.fillStyle = fine ? '#e8d070' : '#c8b088'; g.fillRect(x - 1, y - 1, 2, 2);
    } else if (look === 'charm') {
      const fine = id === 'starCharm', sw = Math.round(Math.sin(w.t * 2.6 + 1) * 0.8), cx = x + sw;
      g.fillStyle = O; g.fillRect(x - 1, y - 2, 2, 2); g.fillRect(cx - 2, y - 1, 5, 9);
      g.fillStyle = fine ? '#ece6ff' : '#f2e6c4'; g.fillRect(cx - 1, y, 3, 7);
      g.fillStyle = fine ? '#7a5ae8' : '#c8302c'; g.fillRect(cx, y + 1, 1, 5); g.fillRect(cx - 1, y + 3, 3, 1);
      if ((p.castT > 0 || P.glow > 0.3) && Math.random() < 0.15) this.parts.push({ x: cx + 0.5, y: y + 3, vx: 0, vy: -14, t: 0.4, max: 0.4, color: fine ? '#c8b8ff' : '#ffd8a0', g: 0, glow: true, size: 1 });
    } else if (look === 'xbow') { // 허리 높이에서 앞을 겨눈 손쇠뇌: 개머리 · 활대 · 쇠살 끝 (몸 앞에 그린다)
      const fine = id === 'repeatCrossbow', y2 = Math.round(by - 2 * gs), x0 = Math.round(bx - dir * 1 * gs), tip = x0 + dir * 8, lo = Math.min(x0, tip);
      g.fillStyle = O; g.fillRect(lo - 1, y2 - 2, 10, 4); g.fillRect(tip - 1, y2 - 5, 3, 10); g.fillRect(x0 - 1, y2, 3, 4);
      g.fillStyle = fine ? '#5a4a6a' : '#8a5a32'; g.fillRect(lo, y2 - 1, 8, 2); g.fillRect(x0, y2 + 1, 1, 2);
      g.fillStyle = fine ? '#8a7aa0' : '#b07a48'; g.fillRect(lo, y2 - 1, 8, 1);
      g.fillStyle = fine ? '#e0e6f0' : '#c8ccd4'; g.fillRect(tip, y2 - 4, 1, 8);
      g.fillStyle = '#f0ece4'; g.fillRect(tip + dir, y2 - 1, 1, 1);
      if (fine) { g.fillStyle = '#c8ccd4'; g.fillRect(x0 + dir * 3, y2 - 3, 2, 1); } // 연발 탄창
    } else if (look === 'doll') { // 저주 인형: 왼손에 매달린 헝겊 인형, 바늘 하나
      const sw = Math.round(Math.sin(w.t * 2.2) * 0.8), cx = x + sw;
      g.fillStyle = O; g.fillRect(cx - 3, y - 3, 6, 10); g.fillRect(cx - 4, y + 1, 8, 2);
      g.fillStyle = '#c8b090'; g.fillRect(cx - 2, y - 2, 4, 4); g.fillStyle = '#8a6a8a'; g.fillRect(cx - 2, y + 2, 4, 4); g.fillRect(cx - 3, y + 2, 6, 1);
      g.fillStyle = '#1a1020'; g.fillRect(cx - 1, y - 1, 1, 1); g.fillRect(cx + 1, y - 1, 1, 1);
      g.fillStyle = '#e0e4ec'; g.fillRect(cx + 2, y - 4, 1, 4);
      if (Math.random() < 0.05) this.parts.push({ x: cx, y: y - 3, vx: 0, vy: -10, t: 0.5, max: 0.5, color: '#b070ff', g: 0, glow: true, size: 1 });
    } else if (w.b.offIsWeapon) { // 왼손에 든 한손 무기: 몸 뒤에서 비스듬히
      const wa = weaponArt(id, ITEMS), img = sprite(wa.s, wa.tint || '');
      if (img) { const sc = Math.min(1, 14 / img.height); g.save(); g.translate(x, y + 2); g.rotate(dir * 2.4); g.scale(sc, sc); g.drawImage(img, -img.width / 2, -2); g.restore(); }
    } else if (look === 'pouch') { // 등 쪽 허리춤 (몸 뒤로 삐져나오게)
      const hx = Math.round(bx - dir * 7 * gs), hy = Math.round(by - 4 * gs), fine = id === 'knifeBelt';
      g.fillStyle = O; g.fillRect(hx - 3, hy - 3, 6, 6); g.fillStyle = '#7a5434'; g.fillRect(hx - 2, hy - 2, 4, 4); g.fillStyle = '#a07448'; g.fillRect(hx - 2, hy - 2, 4, 1);
      if (fine) { g.fillStyle = O; g.fillRect(hx - 2, hy - 6, 1, 4); g.fillRect(hx + 1, hy - 6, 1, 4); g.fillStyle = '#c8d0dc'; g.fillRect(hx - 2, hy - 7, 1, 1); g.fillRect(hx + 1, hy - 7, 1, 1); }
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
      for (let i = 0; i < p.focus; i++) { // 집중: 작은 깃 달린 화살촉 (단계마다 하나)
        const xx = Math.round(x - (p.focus - 1) * 3.5 + i * 7), yy = Math.round(top - 6 + Math.sin(w.t * 4 + i) * 0.6), col = p.focus >= 3 ? '#fff2a0' : '#bfffd0';
        g.fillStyle = '#0d0b10'; g.fillRect(xx - 2, yy - 2, 5, 3); g.fillRect(xx - 1, yy + 1, 3, 1); g.fillRect(xx, yy + 2, 1, 1);
        g.fillStyle = col; g.fillRect(xx - 1, yy - 1, 3, 1); g.fillRect(xx, yy, 1, 2);
      }
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
        if (Math.random() < 0.2) this.parts.push({ x: sx, y: sy, vx: -Math.sin(a) * 20, vy: s.elem === 'fire' ? -30 : Math.cos(a) * 10, t: 0.4, max: 0.4, color: col, g: s.elem === 'forest' ? 20 : -10, glow: true });
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
    const g = this.g, fade = Math.min(1, al.perm ? 1 : al.t / 0.5, (al.age ?? (al.max - al.t)) / 0.3 + 0.2);
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
    if (al.kind === 'grasper' && (al.chg || 0) > 0 && Math.random() < 0.12 + 0.12 * (al.chg / 5)) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: al.x + Math.cos(a) * 16, y: al.y - 8 + Math.sin(a) * 10, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 20, t: 0.5, max: 0.5, color: '#c8b8ff', g: 0, glow: true }); } // 기를 모은다
    const base = al.kind === 'lich' ? 'big_zombie' : al.kind === 'lichMage' ? 'skelet' : al.kind === 'clone' ? RACE_ART[w.b.race].base : al.kind === 'skeleton' ? 'skelet' : 'necromancer';
    const tint = al.kind === 'lichMage' ? 'hue-rotate(240deg) saturate(2) brightness(0.95)' : al.kind === 'grasper' ? 'grayscale(0.8) brightness(1.6) hue-rotate(220deg)' : al.kind === 'skeleton' ? 'brightness(1.1)' : al.kind === 'lich' ? 'hue-rotate(220deg) saturate(1.4) brightness(0.9)' : al.kind === 'clone' ? 'brightness(0.25) saturate(0) contrast(1.4)' : 'grayscale(0.6) brightness(1.4) hue-rotate(180deg)';
    const img = sprite(this.animFrame(base, 'run', w.t + al.id, 10), tint, false, al.dir < 0);
    if (!img) return;
    g.globalAlpha = (al.kind === 'clone' ? 0.75 : 0.7) * fade;
    const sc = al.kind === 'lich' ? 1.1 : al.kind === 'lichMage' ? 1.3 : 1;
    g.drawImage(img, Math.round(al.x - img.width * sc / 2), Math.round(al.y + 4 - img.height * sc + Math.sin(w.t * 4 + al.id) * 1.5), img.width * sc, img.height * sc);
    g.globalAlpha = 1;
    if (Math.random() < 0.15) this.parts.push({ x: al.x, y: al.y - 4, vx: 0, vy: -20, t: 0.5, max: 0.5, color: al.kind === 'clone' ? '#8a6aff' : '#c45cff', g: -10 });
  }

  // 속성이 깃든 화살 · 쇠살의 꼬리
  projTrail(pr) {
    const e = pr.ench;
    if (e === 'fire' && Math.random() < 0.8) this.parts.push({ x: pr.x, y: pr.y, vx: -pr.vx * 0.05, vy: -pr.vy * 0.05 - 10, t: 0.3, max: 0.3, g: -30, flame: true, size: 1.1, color: '#ffffff' });
    else if (e === 'ice' && Math.random() < 0.6) this.parts.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.45, max: 0.45, color: '#e8f8ff', g: 10, glow: true, size: 1 });
    else if (e === 'lightning' && Math.random() < 0.5) this.parts.push({ x: pr.x, y: pr.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, t: 0.08, max: 0.08, color: '#fff8a0', g: 0, line: true });
    else if (e === 'poison' && Math.random() < 0.5) this.parts.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.4, max: 0.4, color: '#9be15d', g: 80, glow: true, size: 1 });
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
    if (pr.kind === 'boomerang' || pr.skind === 'boomerang') {
      const wa = weaponArt(this.world.b.weaponId, ITEMS), img = sprite('cw_boomerang', wa.thrown && wa.s === 'cw_boomerang' ? wa.tint || '' : '');
      if (img) { g.save(); g.translate(Math.round(pr.x), Math.round(pr.y - 4)); g.rotate((pr.spin || 0) * 1.4); g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2)); g.restore(); }
      if (Math.random() < 0.3) this.parts.push({ x: pr.x, y: pr.y - 4, vx: 0, vy: 0, t: 0.18, max: 0.18, color: '#e8d8b0', g: 0 });
      return;
    }
    if (pr.kind === 'knife' || pr.skind === 'knife') {
      const img = sprite('weapon_knife');
      if (img) { g.save(); g.translate(Math.round(pr.x), Math.round(pr.y)); g.rotate(Math.atan2(pr.vy, pr.vx) + Math.PI / 2); g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2)); g.restore(); }
      return;
    }
    if (pr.kind === 'bolt' || pr.skind === 'bolt') { // 석궁 쇠살: 짧고 굵다
      const a = Math.atan2(pr.vy, pr.vx), ux = Math.cos(a), uy = Math.sin(a);
      g.strokeStyle = '#16121c'; g.lineWidth = 3; g.beginPath(); g.moveTo(pr.x - ux * 9, pr.y - uy * 9); g.lineTo(pr.x + ux * 2, pr.y + uy * 2); g.stroke();
      g.strokeStyle = '#8a5a32'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(pr.x - ux * 8, pr.y - uy * 8); g.lineTo(pr.x, pr.y); g.stroke();
      g.fillStyle = '#e8eef4'; g.fillRect(Math.round(pr.x + ux * 1) - 1, Math.round(pr.y + uy * 1) - 1, 2, 2);
      g.strokeStyle = hexA('#ffffff', 0.25); g.lineWidth = 2; g.beginPath(); g.moveTo(pr.x - ux * 22, pr.y - uy * 22); g.lineTo(pr.x - ux * 9, pr.y - uy * 9); g.stroke();
      if (pr.ench) this.projTrail(pr);
      return;
    }
    if (pr.kind === 'skill' || pr.big || pr.kind === 'orb') { this.drawMagicProj(pr); return; }
    if (pr.ench) this.projTrail(pr);
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
    const big = pr.skind === 'fireball' || pr.skind === 'spiritArrow' || pr.skind === 'icerock' ? 1.5 : pr.kind === 'orb' ? 0.8 : pr.skind === 'spiritBolt' ? 0.7 : 1; // 정령 탄은 작게
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
    if (Math.random() < (pr.skind === 'spiritBolt' ? 0.3 : 0.8)) {
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
        // 퍼지는 충격: 고리를 그리지 않고, 사방으로 흩어지는 빛 조각 · 흙먼지와 부드러운 빛으로
        const rr = f.r * (1 - k * 0.6), n = Math.max(10, Math.round(f.r / 3));
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(f.x, f.y, rr * 0.2, f.x, f.y, rr);
        gr.addColorStop(0, hexA(f.color, 0.12 * k)); gr.addColorStop(0.6, hexA(f.color, 0.06 * k)); gr.addColorStop(1, hexA(f.color, 0)); // 가운데가 밝은 둥근 빛 (띠 모양이 아니게)
        g.fillStyle = gr; g.save(); g.translate(f.x, f.y); g.scale(1, 0.62); g.translate(-f.x, -f.y); g.fillRect(f.x - rr, f.y - rr, rr * 2, rr * 2); g.restore();
        if (!f.spread) { // 한 번만: 방향 · 속도를 흩뜨려 고리 꼴이 되지 않게
          f.spread = true;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = f.r * (1.2 + Math.random() * 2.2) / Math.max(0.3, f.max);
            this.parts.push({ x: f.x + Math.cos(a) * 4, y: f.y + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55, t: f.max * (0.6 + Math.random() * 0.5), max: f.max * 1.1, color: f.color, g: 0, glow: true, size: 1 });
            if (i % 2 === 0) this.parts.push({ x: f.x + Math.cos(a) * 6, y: f.y + 2 + Math.sin(a) * 3, vx: Math.cos(a) * sp * 0.4, vy: Math.sin(a) * sp * 0.22, t: 0.7, max: 0.7, color: '#b0a290', g: -4, steam: true });
          }
        }
        g.restore();
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
        if (f.fist) { // 주먹: 내지른 자리에 짧은 바람 자국과 충격
          const a2 = Math.min(1, k * 2.4), L = f.range + 2, ux = Math.cos(f.ang), uy = Math.sin(f.ang), nx = -uy, ny = ux;
          g.strokeStyle = hexA(f.heavy ? '#ffd050' : '#ffffff', 0.7 * a2); g.lineWidth = 1;
          for (const o of [-3, 0, 3]) { g.beginPath(); g.moveTo(p.x + ux * (L - 10) + nx * o, p.y - 7 + uy * (L - 10) + ny * o); g.lineTo(p.x + ux * (L - 2) + nx * o * 0.5, p.y - 7 + uy * (L - 2) + ny * o * 0.5); g.stroke(); }
          continue;
        }
        if (f.whip) continue; // 채찍은 줄을 직접 그린다 (무기 그림)
        const R = f.range + 4, r = Math.max(6, f.range * 0.35);
        const px = p.x, py = p.y - 6;
        const alpha = Math.min(1, k * 2.2);
        g.fillStyle = hexA(col, 0.55 * alpha);
        smear(g, px, py, R, (f.heavy ? 10 : 7), as, a1);
        g.fillStyle = hexA('#ffffff', 0.95 * alpha);
        smear(g, px, py, R, (f.heavy ? 4 : 2.5), as, a1);
      } else if (f.k === 'trail') { // 돌진한 길: 도착한 쪽이 굵고 처음 쪽은 뾰족한 바람 자국. 꼬리부터 따라 줄어든다 (막대 선 대신)
        const dx = f.x2 - f.x1, dy = f.y2 - f.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, prog = 1 - k;
        const sx = f.x1 + dx * prog * 0.85, sy = f.y1 - 6 + dy * prog * 0.85, ex = f.x2, ey = f.y2 - 6, W = Math.min(7, (f.w || 6) * 0.5) * (0.4 + 0.6 * k);
        for (const [c, wm, al] of [[f.color, 1, 0.32], [f.color, 0.55, 0.45], ['#ffffff', 0.18, 0.6]]) {
          g.fillStyle = hexA(c, al * k); g.beginPath(); g.moveTo(sx, sy);
          g.quadraticCurveTo(ex - dx / L * 6 + nx * W * wm, ey - dy / L * 6 + ny * W * wm, ex, ey);
          g.quadraticCurveTo(ex - dx / L * 6 - nx * W * wm, ey - dy / L * 6 - ny * W * wm, sx, sy); g.closePath(); g.fill();
        }
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
      } else if (f.k === 'cracks') { // 땅 갈라짐: 가운데에서 들쭉날쭉 뻗고 잔가지가 난다 (빠르게 번졌다가 옅어진다)
        if (!f.lines) {
          f.lines = [];
          const n = 7 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            let a = (i / n) * Math.PI * 2 + Math.random() * 0.5, x = 0, y = 0; const pts = [[0, 0]], len = f.r * (0.45 + Math.random() * 0.4);
            for (let j = 0; j < 6; j++) {
              a += (Math.random() - 0.5) * 0.9; x += Math.cos(a) * len / 6; y += Math.sin(a) * len / 6 * 0.6; pts.push([x, y]);
              if (j === 2 || (j === 4 && Math.random() < 0.5)) { const ba = a + (Math.random() < 0.5 ? 0.8 : -0.8), bl = len * 0.22; f.lines.push({ pts: [[x, y], [x + Math.cos(ba) * bl * 0.5, y + Math.sin(ba) * bl * 0.3], [x + Math.cos(ba + 0.3) * bl, y + Math.sin(ba + 0.3) * bl * 0.6]], d: (j + 1) / 6 }); }
            }
            f.lines.push({ pts, d: 0 });
          }
        }
        const grow = Math.min(1, (f.max - f.t) / 0.14), a = Math.min(1, k * 1.8);
        for (const ln of f.lines) {
          if (grow < ln.d) continue;
          const upto = Math.max(1, Math.round((ln.pts.length - 1) * Math.min(1, ln.d ? (grow - ln.d) / (1 - ln.d + 0.001) * 2 : grow)));
          const path = (dx, dy) => { g.beginPath(); ln.pts.slice(0, upto + 1).forEach(([px, py], i) => (i ? g.lineTo(f.x + px + dx, f.y + py + dy) : g.moveTo(f.x + px + dx, f.y + py + dy))); g.stroke(); };
          g.strokeStyle = hexA('#e8dcc4', 0.35 * a); g.lineWidth = 1; path(0, 1);   // 깨진 가장자리의 밝은 면
          g.strokeStyle = hexA('#1e1610', 0.75 * a); g.lineWidth = ln.d ? 0.8 : 1.3; path(0, 0); // 갈라진 틈
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
      } else if (f.k === 'arm') { // 망령의 팔: 마디진 창백한 팔이 쭉 뻗어 움켜쥐고 줄어든다
        const age = f.max - f.t, out = easeOut(Math.min(1, age / 0.14)), back = age > 0.3 ? 1 - (age - 0.3) / 0.25 : 1, r = out * Math.max(0, back);
        const ex = f.x1 + (f.x2 - f.x1) * r, ey = f.y1 + (f.y2 - f.y1) * r, n = 7, ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
        g.save(); g.lineCap = 'round';
        for (const [w0, c] of [[5, 'rgba(20,14,30,0.85)'], [3, 'rgba(200,190,230,0.9)']]) {
          g.strokeStyle = c; g.lineWidth = w0; g.beginPath(); g.moveTo(f.x1, f.y1);
          for (let i = 1; i <= n; i++) { const q = i / n, wob = Math.sin(q * 9 + age * 30) * 1.6 * (1 - q); g.lineTo(f.x1 + (ex - f.x1) * q - Math.sin(ang) * wob, f.y1 + (ey - f.y1) * q + Math.cos(ang) * wob); }
          g.stroke();
        }
        g.fillStyle = 'rgba(235,228,255,0.95)';
        for (let i = 1; i < n; i++) { const q = i / n; g.fillRect(Math.round(f.x1 + (ex - f.x1) * q) - 1, Math.round(f.y1 + (ey - f.y1) * q) - 1, 2, 2); } // 마디
        g.strokeStyle = 'rgba(235,228,255,0.95)'; g.lineWidth = 1.5;
        for (const da of [-0.7, 0, 0.7]) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + Math.cos(ang + da) * 5, ey + Math.sin(ang + da) * 5); g.stroke(); } // 손가락
        g.restore();
        if (Math.random() < 0.5) this.parts.push({ x: ex, y: ey, vx: (Math.random() - 0.5) * 20, vy: -10, t: 0.4, max: 0.4, color: '#c8b8ff', g: -10, glow: true });
      } else if (f.k === 'scrape') {
        g.fillStyle = `rgba(30,22,16,${0.35 * k})`; g.fillRect(Math.round(f.x) - 1, Math.round(f.y), 2, 1);
      } else if (f.k === 'scorch') { // 그을린 땅: 얼룩덜룩한 검댕, 가운데 불씨는 시간이 지나며 식는다
        const a = Math.min(1, k * 2.2), heat = Math.max(0, 1 - (f.max - f.t) / 2.2);
        f.blots ||= Array.from({ length: 9 }, (_, i) => { const an = Math.random() * Math.PI * 2, d = i ? f.r * (0.25 + Math.random() * 0.55) : 0; return { x: Math.cos(an) * d, y: Math.sin(an) * d * 0.55, r: f.r * (i ? 0.22 + Math.random() * 0.2 : 0.5) }; });
        for (const b of f.blots) { g.fillStyle = `rgba(24,14,10,${0.2 * a})`; ellipse(g, f.x + b.x, f.y + b.y, b.r, b.r * 0.55); }
        if (heat > 0) for (const b of f.blots) { g.fillStyle = `rgba(255,${100 + 60 * heat | 0},40,${0.22 * heat * (0.6 + 0.4 * Math.sin(this.world.t * 7 + b.x))})`; ellipse(g, f.x + b.x, f.y + b.y, b.r * 0.35, b.r * 0.2); }
        if (Math.random() < 0.15 * heat) this.parts.push({ x: f.x + (Math.random() - 0.5) * f.r * 1.2, y: f.y + (Math.random() - 0.5) * f.r * 0.5, vx: 0, vy: -20, t: 0.6, max: 0.6, color: '#ff8a3a', g: -20, glow: true, size: 1 });
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
      } else if (f.k === 'lock') { // 자동 조준 표적 (도트): 바깥에서 조여드는 네 모서리 꺾쇠 + 맞물리는 순간 가운데 십자
        const col = f.ult ? '#ff5ad0' : f.kind === 'tank' ? '#ff6a4a' : f.kind === 'low' ? '#ff3a6a' : f.kind === 'cluster' ? '#ffcf5a' : f.kind === 'away' ? '#bfe8d0' : '#7ad8ff';
        const age = f.max - f.t, shrink = easeOut(Math.min(1, age / 0.18)), al = Math.min(1, k * 2);
        const R = Math.round(19 - 8 * shrink), cx = Math.round(f.x), cy = Math.round(f.y - 6), L = f.ult ? 5 : 4;
        const arms = (x, y, sx, sy, d) => { // 꺾쇠 한 개: 가로 팔 + 세로 팔 (d만큼 두껍게 = 테두리)
          g.fillRect((sx < 0 ? x : x - L + 1) - d, y - d, L + d * 2, 1 + d * 2);
          g.fillRect(x - d, (sy < 0 ? y : y - L + 1) - d, 1 + d * 2, L + d * 2);
        };
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        g.fillStyle = hexA('#120c1a', 0.75 * al); for (const [sx, sy] of corners) arms(cx + sx * R, cy + sy * R, sx, sy, 1);
        g.fillStyle = hexA(col, al); for (const [sx, sy] of corners) arms(cx + sx * R, cy + sy * R, sx, sy, 0);
        if (f.ult) { g.fillStyle = hexA(col, 0.55 * al); for (const [sx, sy] of corners) arms(cx + sx * (R + 3), cy + sy * (R + 3), sx, sy, 0); }
        if (shrink >= 1 && age < 0.3) { // 맞물림: 흰 십자가 잠깐 반짝
          const fl = 1 - (age - 0.18) / 0.12;
          g.fillStyle = hexA('#120c1a', 0.6 * fl); g.fillRect(cx - 3, cy - 1, 7, 3); g.fillRect(cx - 1, cy - 3, 3, 7);
          g.fillStyle = hexA('#ffffff', 0.95 * fl); g.fillRect(cx - 2, cy, 5, 1); g.fillRect(cx, cy - 2, 1, 5);
        }
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
        } else { // 일직선 일격: 앞으로 날아가는 머리(참격 초승달 · 거대한 화살) + 머리 쪽이 굵고 꼬리가 가는 바람 자국 (빛 막대 대신)
          const dx = f.x2 - f.x1, dy = f.y2 - f.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, ang = Math.atan2(dy, dx);
          const age = f.max - f.t, travel = Math.min(1, age / 0.16), tailU = Math.max(0, Math.min(travel, (age - 0.05) / (f.max * 0.8)));
          const hx = f.x1 + dx * travel, hy = f.y1 - 6 + dy * travel, tx = f.x1 + dx * tailU, ty = f.y1 - 6 + dy * tailU, W = f.w * 0.5 * (0.5 + 0.5 * k);
          if (f.fx === 'skyfall') { // 땅에 남는 칼자국
            g.strokeStyle = hexA('#1e1610', 0.6 * k); g.lineWidth = 1.5; g.beginPath(); g.moveTo(f.x1, f.y1 + 2); g.lineTo(f.x1 + dx * travel, f.y1 + 2 + dy * travel); g.stroke();
            g.strokeStyle = hexA('#fff0b0', 0.5 * k); g.lineWidth = 0.8; g.beginPath(); g.moveTo(f.x1, f.y1 + 1); g.lineTo(f.x1 + dx * travel, f.y1 + 1 + dy * travel); g.stroke();
          }
          for (const [c, wm, al] of [[f.color, 1, 0.22], [f.color, 0.55, 0.4], ['#ffffff', 0.16, 0.7]]) {
            g.fillStyle = hexA(c, al * k); g.beginPath(); g.moveTo(tx, ty);
            g.quadraticCurveTo(hx - ux * 14 + nx * W * wm, hy - uy * 14 + ny * W * wm, hx, hy);
            g.quadraticCurveTo(hx - ux * 14 - nx * W * wm, hy - uy * 14 - ny * W * wm, tx, ty); g.closePath(); g.fill();
          }
          if (travel < 1 || age < 0.24) {
            const ha = travel < 1 ? 1 : Math.max(0, 1 - (age - 0.16) / 0.08);
            g.save(); g.translate(hx, hy); g.rotate(ang);
            if (f.fx === 'arrowBeam') { // 거대한 화살: 촉 · 살대 · 깃
              g.globalAlpha = ha;
              g.fillStyle = '#5a4a36'; g.fillRect(-26, -1.2, 24, 2.4);
              g.fillStyle = '#e8ffd0'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-3, -5); g.lineTo(-1, 0); g.lineTo(-3, 5); g.closePath(); g.fill();
              g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-1, -2); g.lineTo(-1, 2); g.closePath(); g.fill();
              g.fillStyle = '#c8e8a8'; for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(-20, 0); g.lineTo(-27, sy * 5); g.lineTo(-23, sy * 1); g.closePath(); g.fill(); }
              g.globalAlpha = 1;
            } else { // 참격: 앞으로 볼록한 초승달
              g.fillStyle = hexA(f.color, 0.55 * ha); smear(g, -W * 0.9, 0, W * 1.1, W * 0.55, -1.15, 1.15);
              g.fillStyle = hexA('#ffffff', 0.9 * ha); smear(g, -W * 0.9, 0, W * 1.1, W * 0.18, -1.05, 1.05);
            }
            g.restore();
            if (dt > 0 && travel < 1) for (let i = 0; i < 3; i++) { const o = (Math.random() - 0.5) * W * 2; this.parts.push({ x: hx - ux * 6 + nx * o, y: hy + 6 - uy * 6 + ny * o * 0.6, vx: -ux * 40 + nx * o * 3, vy: -uy * 40 - 10, t: 0.5, max: 0.5, color: '#c8bca8', g: -4, steam: true }); }
          }
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
        this.dfill(f.x, f.y, f.r, f.r * 0.62, '#c896ff', 0.1 + 0.22 * (1 - k)); // 떨어질 자리: 점묘가 점점 짙어진다
        this.dline(f.x, f.y, f.r, f.r * 0.62, 'rgba(240,220,255,0.9)', this.world.t * 8, 3, 2);
        if (k < 0.97) this.dline(f.x, f.y, f.r * (1 - k), f.r * 0.62 * (1 - k), 'rgba(255,255,255,0.95)', -this.world.t * 10, 2, 1);
        g.fillStyle = 'rgba(255,240,255,0.9)'; for (const [dx, dy] of [[-3, 0], [3, 0], [0, -2], [0, 2]]) g.fillRect(Math.round(f.x + dx), Math.round(f.y + dy), 1, 1);
      } else if (f.k === 'spin') {
        // 칼을 든 내 회전은 칼 잔상(bladeTrail)이 칼끝을 따라 그린다. 칼이 없는 회전(꼬리 · 몸통)만 짧은 초승달 하나 (몸을 감싸는 고리는 그리지 않는다)
        const bladeOn = f.own && this.trailDrawnT != null && w.t - this.trailDrawnT < 0.06;
        if (!bladeOn) {
          const prog = 1 - k, head = f.a0 + f.dir * Math.PI * 1.7 * Math.min(1, prog * 1.4), tail = head - f.dir * 1.8;
          const cx = f.follow ? p.x : f.x, cy = (f.follow ? p.y : f.y) - 6, R = (f.r || 40) * 0.8, col = f.heavy ? '#ffd050' : f.type === 'mag' ? '#c9a8ff' : '#e8f0ff';
          g.save(); g.translate(cx, cy); g.scale(1, 0.8);
          g.fillStyle = hexA(col, 0.4 * Math.min(1, k * 2)); smear(g, 0, 0, R, f.heavy ? 11 : 8, f.dir > 0 ? tail : head, f.dir > 0 ? head : tail);
          g.fillStyle = hexA('#ffffff', 0.9 * Math.min(1, k * 2)); smear(g, 0, 0, R, f.heavy ? 3.5 : 2.5, f.dir > 0 ? tail : head, f.dir > 0 ? head : tail);
          g.restore();
        }
      } else if (f.k === 'nova') {
        // 마력이 몸에서 터져 나간다: 짧은 빛 줄기들이 바깥으로 뻗었다 사라진다 (고리 없음)
        const col = f.color || '#b58cff', prog = 1 - k, n = 14;
        f.seed ??= Math.random() * 1000;
        g.save(); g.globalCompositeOperation = 'lighter';
        this.glow(f.x, f.y - 6, f.r * 0.6, col, k * 0.8);
        for (let i = 0; i < n; i++) {
          const h = Math.sin(f.seed + i * 7.31) * 9547.13, rnd = h - Math.floor(h), a = (i / n) * Math.PI * 2 + rnd * 0.4;
          const r0 = f.r * (0.15 + prog * 0.75), r1 = r0 + f.r * (0.18 + rnd * 0.12) * k;
          g.strokeStyle = hexA(i % 3 ? col : '#ffffff', 0.9 * k); g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(f.x + Math.cos(a) * r0, f.y - 6 + Math.sin(a) * r0 * 0.62); g.lineTo(f.x + Math.cos(a) * r1, f.y - 6 + Math.sin(a) * r1 * 0.62); g.stroke();
        }
        g.restore();
      } else if (f.k === 'claw') {
        g.strokeStyle = hexA('#ff4040', k); g.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          g.beginPath(); g.arc(f.x, f.y - 4, f.r + i * 3, f.ang - 0.6, f.ang + 0.6); g.stroke();
        }
      } else if (f.k === 'ghost') {
        const art = RACE_ART[w.b.race];
        const img = sprite(frames(art.base, 'run')[0], f.tint || 'brightness(2) saturate(0)', false, (f.dir || p.dir) < 0);
        if (img) { g.globalAlpha = k * (f.tint ? 0.7 : 0.5); g.drawImage(img, Math.round(f.x - img.width / 2), Math.round(f.y + 5 - img.height)); g.globalAlpha = 1; }
      } else if (f.k === 'spellBlade') { // 근접 마법 초승달: 바깥은 속성 빛, 안쪽은 흰 날
        const prog = 1 - k, a0 = f.ang - f.angle / 2, a1 = a0 + f.angle * Math.min(1, prog * 3.2);
        g.save(); g.translate(f.x, f.y - 6); g.scale(1, 0.62);
        g.fillStyle = hexA(f.col, 0.55 * Math.min(1, k * 2.2)); smear(g, 0, 0, f.r * 0.92, 9, a0, a1);
        g.fillStyle = hexA('#ffffff', 0.85 * Math.min(1, k * 2.2)); smear(g, 0, 0, f.r * 0.92, 2.5, a0, a1);
        g.restore();
      } else if (f.k === 'cut') { // 초승달 칼자국 두 줄 (가운데가 두껍고 끝이 가늘다)
        const prog = 1 - k;
        for (const [o, col, th] of [[-3, '#8a6aff', 5], [3, '#c8b0ff', 4], [0, '#ffffff', 1.6]]) {
          g.fillStyle = hexA(col, Math.min(1, k * 2.2)); const a0 = f.ang - 1.0 + o * 0.05, a1 = a0 + 2.0 * Math.min(1, prog * 3);
          g.save(); g.translate(f.x, f.y); g.scale(1, 0.75); smear(g, 0, o, 14, th, a0, a1); g.restore();
        }
      } else if (f.k === 'debris') { // 거대 화염구 잔해: 날아가 떨어진 바위 덩이가 한동안 달아올라 연기를 내다 사라진다
        const age = f.max - f.t, fade = Math.min(1, f.t / 1.2);
        for (const pc of f.pieces) {
          const q = Math.min(1, age / pc.fly), x = pc.x0 + (pc.x1 - pc.x0) * q, y = pc.y0 + (pc.y1 - pc.y0) * q - Math.sin(q * Math.PI) * pc.h;
          const s = pc.s, heat = Math.max(0, 1 - age / 2.6);
          g.globalAlpha = fade;
          if (q >= 1) { g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + s * 0.5, s, s * 0.35); }
          g.fillStyle = '#1a1210'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = pc.rot + i * Math.PI / 3, rr = s * (0.75 + ((i * 37) % 5) / 10); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } g.closePath(); g.fill();
          g.fillStyle = '#4a3a34'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = pc.rot + i * Math.PI / 3, rr = s * (0.6 + ((i * 37) % 5) / 12); g.lineTo(x + Math.cos(a) * rr - 0.5, y + Math.sin(a) * rr * 0.8 - 0.5); } g.closePath(); g.fill();
          if (heat > 0) { g.fillStyle = hexA(heat > 0.5 ? '#ffb040' : '#ff5a1a', 0.9 * heat); g.fillRect(Math.round(x - s * 0.3), Math.round(y - 0.5), Math.max(1, Math.round(s * 0.6)), 1); g.fillRect(Math.round(x), Math.round(y - s * 0.4), 1, Math.max(1, Math.round(s * 0.5))); }
          g.globalAlpha = 1;
          if (q >= 1 && heat > 0.1 && Math.random() < 0.05) this.parts.push({ x: x + (Math.random() - 0.5) * s, y: y - s * 0.4, vx: 2, vy: -14, t: 1.2, max: 1.2, color: '#5a4e50', g: -3, steam: true });
          if (q >= 1 && heat > 0.3 && Math.random() < 0.04) this.parts.push({ x, y: y - s * 0.6, vx: 0, vy: -18, t: 0.4, max: 0.4, g: -20, flame: true, size: 0.8, color: '#ffffff' });
        }
      } else if (f.k === 'fireColumn') { // 거대 화염구: 떨어진 자리에서 불길이 솟구쳤다 잦아든다
        const age = f.max - f.t, n = dt > 0 ? Math.round(10 * k) : 0;
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * f.r * 0.3 * (0.5 + age * 2); this.parts.push({ x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d * 0.5, vx: Math.cos(a) * 20, vy: -110 - Math.random() * 110 * k, t: 0.45 + Math.random() * 0.25, max: 0.7, g: -20, flame: true, size: 1 + Math.random() * 0.9, color: '#ffffff' }); }
      } else if (f.k === 'rageSpikes') { // 분노 폭발: 몸에서 끝이 뾰족한 붉은 기운이 사방으로 뻗었다 사그라든다
        const age = f.max - f.t, grow = easeOut(Math.min(1, age / 0.12)), fade = Math.min(1, f.t / 0.25);
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const sp of f.spikes) {
          const L = sp.len * grow, ca = Math.cos(sp.a), sa = Math.sin(sp.a), nx = -sa, ny = ca * 0.7;
          const mx = f.x + Math.cos(sp.a + sp.bend) * L * 0.5, my = f.y + Math.sin(sp.a + sp.bend) * L * 0.35, tx = f.x + ca * L, ty = f.y + sa * L * 0.7;
          for (const [col, wid, al] of [['#ff2a10', sp.w, 0.55], ['#ff8a3a', sp.w * 0.5, 0.8], ['#fff0c0', sp.w * 0.18, 0.9]]) {
            g.fillStyle = hexA(col, al * fade); g.beginPath();
            g.moveTo(f.x + nx * wid, f.y + ny * wid); g.quadraticCurveTo(mx + nx * wid * 0.5, my + ny * wid * 0.5, tx, ty);
            g.quadraticCurveTo(mx - nx * wid * 0.5, my - ny * wid * 0.5, f.x - nx * wid, f.y - ny * wid); g.closePath(); g.fill();
          }
        }
        g.restore();
      } else if (f.k === 'rageHeat') { // 터진 뒤에도 몸에서 붉은 열기가 피어오른다
        const p2 = this.world.player;
        if (dt > 0 && Math.random() < 0.9 * k) this.parts.push({ x: p2.x + (Math.random() - 0.5) * 12, y: p2.y - Math.random() * 16, vx: (Math.random() - 0.5) * 10, vy: -26 - Math.random() * 24, t: 0.6, max: 0.6, g: -12, glow: true, size: 1, color: Math.random() < 0.3 ? '#ffb060' : '#ff4a22' });
      } else if (f.k === 'rageCracks') { // 땅에 번지는 붉은 균열 (분노 폭발)
        const grow = Math.min(1, (f.max - f.t) / 0.18), a = Math.min(1, f.t / 0.6);
        for (const cr of f.list) {
          g.strokeStyle = hexA('#2a0a06', 0.8 * a); g.lineWidth = 3; g.beginPath(); cr.forEach(([x, y], i) => { const u = Math.min(1, grow * cr.length / (i + 1)); if (!i) g.moveTo(f.x + x, f.y + y); else if (u >= 1) g.lineTo(f.x + x, f.y + y); }); g.stroke();
          g.strokeStyle = hexA('#ff5a2a', a); g.lineWidth = 1.5; g.beginPath(); cr.forEach(([x, y], i) => { if (!i) g.moveTo(f.x + x, f.y + y); else if (i / cr.length <= grow) g.lineTo(f.x + x, f.y + y); }); g.stroke();
          g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = hexA('#ffb060', 0.5 * a); g.lineWidth = 0.8; g.beginPath(); cr.forEach(([x, y], i) => { if (!i) g.moveTo(f.x + x, f.y + y); else if (i / cr.length <= grow) g.lineTo(f.x + x, f.y + y); }); g.stroke(); g.restore();
        }
      } else if (f.k === 'glyphs') { // 용언 문장: 허공에 세 글자를 한 획씩 써 내려가고 → 가운데로 모여 하나가 되고 → 목표에 날아가 땅에 새겨진다
        const age = f.max - f.t, WRITE = 0.15, MERGE = 0.45, FLY = 0.58, HIT = 0.72;
        const ox = f.x, oy = f.y - 44, cols = f.words.map((wd) => WORD_COLOR[wd] || '#ffb066');
        if (age < FLY) { // 쓰기 · 합치기
          const mk = Math.max(0, Math.min(1, (age - MERGE) / (FLY - MERGE))), mE = mk * mk;
          f.words.forEach((wd, i) => {
            const prog = Math.max(0, Math.min(1, (age - i * WRITE) / WRITE));
            if (prog <= 0) return;
            const gx = ox + (i - 1) * 22 * (1 - mE), gy = oy + Math.sin(age * 5 + i) * 1.2, pen = {};
            this.drawGlyph(wd, gx, gy, 1.5 * (1 - 0.3 * mE), cols[i], 1, 0, prog, pen);
            if (prog < 1 && dt > 0) for (let j = 0; j < 2; j++) this.parts.push({ x: pen.x, y: pen.y, vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 20, t: 0.35, max: 0.35, color: Math.random() < 0.5 ? '#fff6e0' : cols[i], g: 60, glow: true, size: 1 });
          });
          if (mk > 0) { g.save(); g.globalCompositeOperation = 'lighter'; this.glow(ox, oy, 18 + 22 * mk, cols[1], 0.5 + 0.5 * mk); g.restore(); }
        } else if (age < HIT) { // 하나로 합쳐진 글자가 목표로 날아간다 (세 빛 꼬리)
          const q = (age - FLY) / (HIT - FLY), e2 = q * q, x = ox + (f.tx - ox) * e2, y = oy + (f.ty - 10 - oy) * e2 - Math.sin(q * Math.PI) * 26;
          if (dt > 0) cols.forEach((c, i) => this.parts.push({ x: x + (i - 1) * 3, y: y + (i - 1) * 2, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, t: 0.35, max: 0.35, color: c, g: 0, glow: true, size: 1.6 }));
          this.drawGlyph(f.words[1], x, y, 1.3, f.same ? '#ffe08a' : cols[1], 1, age * 6);
        } else { // 땅에 새겨진 글자: 납작하게 눕힌 세 글자가 빛나다가 스러진다
          if (!f.landed) {
            f.landed = true;
            this.shake = Math.max(this.shake, f.same ? 9 : 6); this.hitstop = Math.max(this.hitstop, 0.06);
            for (let i = 0; i < 36; i++) { const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 170; this.parts.push({ x: f.tx, y: f.ty - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 40, t: 0.4 + Math.random() * 0.4, max: 0.8, color: cols[i % 3], g: 90, glow: true, size: 1.4 }); }
          }
          const fade = Math.max(0, 1 - (age - HIT) / (f.max - HIT));
          g.save(); g.translate(f.tx, f.ty); g.scale(1, 0.5);
          f.words.forEach((wd, i) => this.drawGlyph(wd, (i - 1) * 20, 0, 1.4, cols[i], fade * (0.6 + 0.4 * Math.sin(age * 9 + i)), 0));
          g.restore();
        }
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
    } else if (dr.kind === 'good') { // 캐고 · 벤 물건: 작은 아이콘이 통통 튄다
      const ic = iconCanvas(dr.id), x = Math.round(dr.x), y = Math.round(dr.y - 6 + bob);
      g.drawImage(ic, x - 6, y - 6, 12, 12);
    } else if (dr.kind === 'shard') { // 성물 조각: 그 성지의 빛을 내는 작은 결정 조각
      const col = SANCTUMS[dr.id]?.color || '#ffffff', x = Math.round(dr.x), y = Math.round(dr.y - 4 + bob);
      g.fillStyle = hexA(col, 0.3 + 0.2 * Math.sin(w.t * 6)); disc(g, x, y, 6);
      g.fillStyle = '#16121c'; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 3, y - 1); g.lineTo(x + 1, y + 4); g.lineTo(x - 3, y + 1); g.closePath(); g.fill();
      g.fillStyle = col; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 2, y - 1); g.lineTo(x + 1, y + 3); g.lineTo(x - 2, y + 1); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 2, 1, 2);
      if (Math.random() < 0.1) this.parts.push({ x: x + (Math.random() - 0.5) * 6, y: y - 2, vx: 0, vy: -12, t: 0.6, max: 0.6, color: col, g: -6, glow: true, size: 1 });
    } else if (dr.kind === 'story') {
      const it = STORY_ITEMS[dr.id], x = Math.round(dr.x), y = Math.round(dr.y - 4 + bob);
      g.fillStyle = hexA(it.color, 0.3 + 0.2 * Math.sin(w.t * 6)); disc(g, x, y, 8);
      drawStoryItem(g, dr.id, x, y);
      if (Math.random() < 0.15) this.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y - 2, vx: 0, vy: -14, t: 0.6, max: 0.6, color: it.color, g: -6 });
    } else {
      if (!ECHOES[dr.id]) return;
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
    if (o.kind === 'station' && !o.npc) return; // 가구 자리 (침대 · 화덕 · 보관함 · 작업대): 가구 그림이 따로 있다
    if (o.kind === 'station' || o.kind === 'merchant') return this.drawNpc(w, o);
    if (o.kind === 'relic') { drawRelic(this.g, o, w.t, SANCTUMS[o.race]?.color || '#ffffff', o.opened); return; }
    if (o.kind === 'sign') { drawSign(this.g, o); o._top = o.y - 22; return; }
    if (o.kind === 'turtle') { drawTurtle(this.g, o, w.t); o._top = o.y - 12; return; }
    if (o.kind === 'boat') { if (!o.riding) this.drawBoat(w, o.x, o.y, o.dir || 1, false, 'all'); o._top = o.y - 12; return; }
    if (o.kind === 'vent') { // 거품 구멍: 바위 틈에서 거품이 끊임없이 솟는다
      const x = Math.round(o.x), y = Math.round(o.y);
      g.fillStyle = '#1a1410'; g.beginPath(); g.ellipse(x, y + 1, 9, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a6474'; g.beginPath(); g.ellipse(x, y, 8, 3.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7a8494'; g.fillRect(x - 6, y - 2, 4, 1); g.fillStyle = '#0a1a28'; g.beginPath(); g.ellipse(x, y, 3, 1.4, 0, 0, Math.PI * 2); g.fill();
      if (Math.random() < 0.4) this.parts.push({ x: x + (Math.random() - 0.5) * 4, y: y - 2, vx: (Math.random() - 0.5) * 6, vy: -30 - Math.random() * 20, t: 1.6, max: 1.6, color: '#e0f6ff', g: -8, bubble: true });
      o._top = o.y - 10; return;
    }
    if (o.kind === 'palaceGate') { // 용궁의 문: 산호 아치 · 일렁이는 물빛
      const x = Math.round(o.x), y = Math.round(o.y) + 6;
      for (const s of [-1, 1]) { g.fillStyle = '#1a1410'; g.fillRect(x + s * 14 - 4, y - 34, 8, 34); g.fillStyle = '#e86a7a'; g.fillRect(x + s * 14 - 3, y - 33, 6, 33); g.fillStyle = '#ffb0b8'; g.fillRect(x + s * 14 - 3, y - 33, 2, 33); g.fillStyle = '#c84a5a'; for (let k = 0; k < 4; k++) g.fillRect(x + s * 14 - 3 + (k % 2) * 3, y - 28 + k * 7, 3, 2); }
      g.fillStyle = '#1a1410'; g.beginPath(); g.ellipse(x, y - 34, 19, 8, 0, Math.PI, 0); g.fill(); g.fillStyle = '#ff8a6a'; g.beginPath(); g.ellipse(x, y - 34, 17, 6.5, 0, Math.PI, 0); g.fill();
      const a = 0.5 + 0.3 * Math.sin(t * 2.4);
      g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, y - 34, 0, y); gr.addColorStop(0, `rgba(120,255,230,${0.2 * a})`); gr.addColorStop(1, `rgba(120,255,230,${0.55 * a})`); g.fillStyle = gr; g.fillRect(x - 11, y - 34, 22, 34); g.restore();
      if (Math.random() < 0.3) this.parts.push({ x: x + (Math.random() - 0.5) * 18, y: y - Math.random() * 30, vx: 0, vy: -10, t: 1, max: 1, color: '#bfffee', g: 0, glow: true, size: 1 });
      o._top = o.y - 36; return;
    }
    if (o.kind === 'skillStone') { // 옛 기술 석판: 선 돌판에 새긴 문양 (그 기술의 속성 색으로 빛난다, 배우면 빛이 잦아든다)
      const x = Math.round(o.x), y = Math.round(o.y) + 4, sk = SKILLS[o.skill], learned = (w.b.available || []).includes(o.skill);
      const col = ELEM[sk?.elem]?.color || ({ windStep: '#bfffd0', shadowStep: '#b89aff', vineSnare: '#7be38a', retreatShot: '#9be15d', leap: '#ffb066', harpoon: '#8ad8ff' })[o.skill] || '#e8dcc0';
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + 1, 11, 3);
      g.fillStyle = '#1a1410'; g.beginPath(); g.moveTo(x - 9, y + 1); g.lineTo(x - 8, y - 24); g.quadraticCurveTo(x, y - 31, x + 8, y - 24); g.lineTo(x + 9, y + 1); g.closePath(); g.fill();
      g.fillStyle = '#7a7670'; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x - 7, y - 23); g.quadraticCurveTo(x, y - 29, x + 7, y - 23); g.lineTo(x + 8, y); g.closePath(); g.fill();
      g.fillStyle = '#9a968e'; g.fillRect(x - 7, y - 22, 2, 21); g.fillStyle = '#5e5a54'; g.fillRect(x + 5, y - 22, 2, 21);
      g.fillStyle = '#5a7a3a'; g.fillRect(x - 8, y - 3, 4, 3); g.fillRect(x + 4, y - 6, 3, 2); // 이끼
      const a = learned ? 0.35 : 0.65 + 0.3 * Math.sin(t * 2.6 + x);
      if (!learned) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y - 14, 1, x, y - 14, 16); gr.addColorStop(0, hexA(col, 0.4 * a)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(x - 16, y - 30, 32, 32); g.restore(); }
      g.fillStyle = hexA(col, a); g.fillRect(x - 1, y - 21, 2, 12); g.fillRect(x - 4, y - 17, 8, 2); g.fillRect(x - 4, y - 11, 2, 2); g.fillRect(x + 2, y - 11, 2, 2); g.fillRect(x - 3, y - 23, 6, 1);
      if (!learned && Math.random() < 0.08) this.parts.push({ x: x + (Math.random() - 0.5) * 10, y: y - 16, vx: 0, vy: -14, t: 0.8, max: 0.8, color: col, g: 0, glow: true, size: 1 });
      o._top = o.y - 28; return;
    }
    if (o.kind === 'leader') { drawLeader(this, w, o); return; }
    if (o.kind === 'resident') { drawResident(this, w, o, dt); return; }
    if (o.kind === 'trainBoard') { drawTrainBoard(g, o, t); return; }
    if (o.kind === 'questThing') { drawQuestThing(this, w, o); return; }
    if (o.kind === 'waypoint') { // 이동 포탈: 이끼 낀 두 돌기둥과 아치. 깨어나면 문 안이 푸른 빛으로 일렁이고 새긴 문양이 빛난다
      const x = Math.round(o.x), y = Math.round(o.y) + 6, on = o.active, a = on ? 0.6 + 0.25 * Math.sin(t * 2.2 + x) : 0;
      const doorway = () => { g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x - 9, y - 24); g.quadraticCurveTo(x, y - 34, x + 9, y - 24); g.lineTo(x + 9, y); g.closePath(); };
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + 1, 21, 4);
      if (on) {
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(0, y - 32, 0, y); gr.addColorStop(0, `rgba(140,220,255,${0.22 * a})`); gr.addColorStop(1, `rgba(140,220,255,${0.62 * a})`);
        g.fillStyle = gr; doorway(); g.fill();
        for (let i = 0; i < 7; i++) { const ph = (t * 0.55 + i / 7) % 1, an = t * 2.6 + i * 0.9, rr = 1 - ph; g.fillStyle = `rgba(230,250,255,${0.85 * rr})`; g.fillRect(Math.round(x + Math.cos(an) * 7 * rr), Math.round(y - 13 + Math.sin(an) * 10 * rr), 1, 1); }
        g.restore();
        if (Math.random() < 0.12) this.parts.push({ x: x + (Math.random() - 0.5) * 16, y: y - 4 - Math.random() * 22, vx: 0, vy: -12, t: 1, max: 1, color: '#bfefff', g: 0, glow: true, size: 1 });
      } else { g.fillStyle = 'rgba(12,10,16,0.5)'; doorway(); g.fill(); }
      for (const s2 of [-1, 1]) { // 돌기둥
        const px = x + s2 * 13;
        g.fillStyle = '#1a1410'; g.fillRect(px - 5, y - 30, 10, 31);
        g.fillStyle = '#7a7670'; g.fillRect(px - 4, y - 29, 8, 29);
        g.fillStyle = '#9a968e'; g.fillRect(px - 4, y - 29, 2, 29); g.fillStyle = '#5e5a54'; g.fillRect(px + 2, y - 29, 2, 29);
        g.fillStyle = '#5a7a3a'; g.fillRect(px - 4, y - 4, 3, 3); g.fillRect(px + 1, y - 18, 2, 2);
        g.fillStyle = on ? `rgba(150,230,255,${a})` : 'rgba(40,36,40,0.85)'; g.fillRect(px - 1, y - 24, 2, 6); g.fillRect(px - 2, y - 16, 4, 1); g.fillRect(px - 1, y - 12, 2, 4);
      }
      g.fillStyle = '#1a1410'; g.beginPath(); g.ellipse(x, y - 30, 19, 7, 0, Math.PI, 0); g.fill(); g.fillRect(x - 19, y - 31, 38, 4);
      g.fillStyle = '#8a867e'; g.beginPath(); g.ellipse(x, y - 30, 17, 5.5, 0, Math.PI, 0); g.fill(); g.fillRect(x - 17, y - 31, 34, 3);
      g.fillStyle = '#a8a49c'; g.fillRect(x - 15, y - 32, 30, 1);
      g.fillStyle = on ? `rgba(170,240,255,${a})` : '#4a4644'; g.fillRect(x - 2, y - 36, 4, 3); // 아치 가운데 돌 (깨어나면 빛난다)
      o._top = o.y - 34; return;
    }
    if (o.kind === 'waterSpirit') { // 물의 정령: 물빛 아가씨가 물가에 떠 있다 (몸은 반쯤 비친다)
      const fr = frames('elf_f', 'idle'), img = sprite(fr[Math.floor(t * 5) % fr.length], 'hue-rotate(175deg) saturate(1.6) brightness(1.35)');
      const bob = Math.sin(t * 2) * 2, x = Math.round(o.x), y = Math.round(o.y - 2 + bob);
      g.fillStyle = 'rgba(80,160,220,0.25)'; ellipse(g, o.x, o.y + 5, 9, 3);
      if (img) { g.save(); g.globalAlpha = 0.78; g.globalCompositeOperation = 'source-over'; g.drawImage(img, x - Math.round(img.width / 2), y + 4 - img.height); g.restore(); }
      if (Math.random() < 0.25) this.parts.push({ x: o.x + (Math.random() - 0.5) * 12, y: o.y - Math.random() * 20, vx: 0, vy: 12, t: 0.6, max: 0.6, color: '#bfe8ff', g: 60, glow: true, size: 1 });
      if (Math.random() < 0.06) this.parts.push({ x: o.x + (Math.random() - 0.5) * 14, y: o.y + 4, vx: 0, vy: -10, t: 1, max: 1, color: '#e0f6ff', g: -4, bubble: true });
      o._top = o.y - 30; return;
    }
    if (o.kind === 'entrance') { o._top = o.y - 26; return; }
    if (o.kind === 'door') { o._top = o.y - 42; return; }
    if (o.kind === 'rest') { // 마을 모닥불: 돌 둘레 · 장작 · 타오르는 불 · 앉는 통나무
      const x = Math.round(o.x), y = Math.round(o.y), f = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.7);
      const gl = g.createRadialGradient(x, y - 4, 2, x, y - 4, 46); gl.addColorStop(0, `rgba(255,170,70,${0.32 * f})`); gl.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gl; g.fillRect(x - 46, y - 50, 92, 92);
      for (const [lx, ly, lw] of [[-26, 4, 18], [10, 4, 18]]) { g.fillStyle = '#1a1410'; g.fillRect(x + lx - 1, y + ly - 1, lw + 2, 7); g.fillStyle = '#7a5232'; g.fillRect(x + lx, y + ly, lw, 5); g.fillStyle = '#a87a4a'; g.fillRect(x + lx, y + ly, lw, 1); g.fillStyle = '#c8a070'; g.fillRect(x + lx + lw - 3, y + ly, 3, 5); }
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + 4, 12, 4);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, sx = Math.round(x + Math.cos(a) * 10), sy = Math.round(y + 1 + Math.sin(a) * 4.5); g.fillStyle = '#1a1410'; g.fillRect(sx - 3, sy - 2, 6, 5); g.fillStyle = i % 2 ? '#8a8680' : '#a8a49c'; g.fillRect(sx - 2, sy - 1, 4, 3); }
      g.fillStyle = '#1a1410'; g.fillRect(x - 8, y - 2, 16, 4); g.fillStyle = '#5a3a22'; g.fillRect(x - 7, y - 1, 14, 2); g.fillStyle = '#3a2418'; g.fillRect(x - 3, y - 4, 7, 3);
      const fl = (k) => Math.sin(t * (11 + k) + k * 2) * 1.5;
      g.fillStyle = '#e8501a'; g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x - 6 + fl(1), y - 12 * f, x, y - 18 * f + fl(2)); g.quadraticCurveTo(x + 6 + fl(3), y - 12 * f, x + 7, y); g.fill();
      g.fillStyle = '#ffb040'; g.beginPath(); g.moveTo(x - 4, y); g.quadraticCurveTo(x - 3 + fl(4), y - 8 * f, x + fl(5) * 0.5, y - 12 * f); g.quadraticCurveTo(x + 4 + fl(6), y - 7 * f, x + 4, y); g.fill();
      g.fillStyle = '#fff2b0'; g.fillRect(x - 1, y - 6, 3, 5);
      if (Math.random() < 0.3) this.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y - 10, vx: (Math.random() - 0.5) * 14, vy: -30 - Math.random() * 20, t: 0.8, max: 0.8, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffd040', g: -12, glow: true, size: 1 });
      if (Math.random() < 0.06) this.parts.push({ x: x + (Math.random() - 0.5) * 4, y: y - 18, vx: 4, vy: -16, t: 2, max: 2, color: '#8a8478', g: -3, big: true });
      o._top = y - 24;
      return;
    }
    if (o.kind === 'exit') { o._top = o.y - 10; return; }
    if (o.kind === 'node') { drawNode(g, o, t); o._top = o.y - (o.depleted ? 6 : 22); return; }
    if (o.kind === 'dig') { drawDig(g, o, t); o._top = o.y - 8; return; }
    if (o.kind === 'sanctum') { this.drawNpc(w, o); return; }
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
    if (o.kind === 'raidAltar') { // 레이드 제단: 검은 돌 제단 위에 붉은 결정이 떠 있다
      const x = Math.round(o.x), y = Math.round(o.y), b = Math.sin(t * 2.2) * 1.5;
      g.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(g, x, y + 5, 15, 5);
      g.fillStyle = '#0d0b10'; g.fillRect(x - 13, y - 9, 26, 15);
      g.fillStyle = '#3a3440'; g.fillRect(x - 12, y - 8, 24, 13); g.fillStyle = '#5a5262'; g.fillRect(x - 12, y - 8, 24, 2);
      g.fillStyle = '#2a2430'; g.fillRect(x - 9, y - 4, 18, 1);
      g.fillStyle = '#0d0b10'; g.fillRect(x - 5, y - 25 + b, 10, 13);
      g.fillStyle = '#c8243a'; g.fillRect(x - 4, y - 24 + b, 8, 11); g.fillStyle = '#ff5a6a'; g.fillRect(x - 3, y - 23 + b, 3, 6); g.fillStyle = '#ffd0d8'; g.fillRect(x - 2, y - 22 + b, 1, 2);
      if (Math.random() < 0.08) this.parts.push({ x: x + (Math.random() - 0.5) * 10, y: y - 18, vx: 0, vy: -14, t: 0.9, max: 0.9, color: '#ff5a6a', g: -8, glow: true });
      o._top = o.y - 30;
      return;
    }
    if (o.kind === 'stairs' && o.door) { // 탑의 문: 돌 문틀과 두 짝 나무문 · 층을 깨면 열리며 빛이 샌다
      const x = Math.round(o.x), y = Math.round(o.y), tr = w.tower, open = tr && (!tr.boss || tr.boss.dead);
      g.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(g, x, y + 5, 16, 5);
      g.fillStyle = '#0d0b10'; g.fillRect(x - 15, y - 31, 30, 36);
      g.fillStyle = '#6a6474'; g.fillRect(x - 14, y - 30, 28, 34); g.fillStyle = '#8a8496'; g.fillRect(x - 14, y - 30, 28, 3);
      g.fillStyle = '#4a4454'; for (let i = 0; i < 4; i++) g.fillRect(x - 14 + (i % 2) * 22, y - 24 + i * 7, 6, 1);
      const gap = open ? 5 : 0;
      if (open) { g.fillStyle = hexA('#ffe8a8', 0.75 + 0.2 * Math.sin(t * 3)); g.fillRect(x - 9, y - 24, 18, 28); }
      g.fillStyle = '#5a3a22'; g.fillRect(x - 9, y - 24, 9 - gap, 28); g.fillRect(x + gap, y - 24, 9 - gap, 28);
      g.fillStyle = '#7a5232'; g.fillRect(x - 9, y - 24, 9 - gap, 2); g.fillRect(x + gap, y - 24, 9 - gap, 2);
      g.fillStyle = '#c8a050'; g.fillRect(x - 3 - gap, y - 11, 2, 2); g.fillRect(x + 1 + gap, y - 11, 2, 2);
      o._top = o.y - 34;
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
      if (o.hidden && !o.found) { // 숨은 상자: 보이지 않는다. 아주 가까이 가면 가끔 반짝일 뿐
        if (Math.hypot(o.x - w.player.x, o.y - w.player.y) < 70 && (t % 3.2) < 0.18) { g.fillStyle = '#fff6c8'; g.fillRect(Math.round(o.x), Math.round(o.y - 6), 1, 1); }
        return;
      }
      if (!o.spotted && Math.hypot(o.x - w.player.x, o.y - w.player.y) < 120) o.spotted = true; // 가까이서 봐야 지도에 적힌다
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
      const gr = w.map.ground[y * w.tw + x];
      if (gr === G.LAVA) { // 용암: 일렁이는 빛 · 튀는 불씨
        const f = 0.5 + 0.5 * Math.sin(w.t * 2.4 + hash(x, y, 80) % 7);
        g.fillStyle = `rgba(255,200,80,${0.18 * f})`; g.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (Math.random() < 0.012) this.parts.push({ x: x * TILE + Math.random() * 16, y: y * TILE + 8, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 30, t: 0.7, max: 0.7, color: '#ffb040', g: 60, glow: true, size: 1 });
        continue;
      }
      if (gr === G.BOG) { if (Math.random() < 0.004) this.parts.push({ x: x * TILE + Math.random() * 16, y: y * TILE + 10, vx: 0, vy: -6, t: 0.8, max: 0.8, color: '#a8b860', g: 0, size: 2 }); continue; }
      const ph = (w.t * 0.8 + hash(x, y, 77) / 4294967296 * 6) % 6;
      if (ph < 0.5) { g.fillStyle = `rgba(255,255,255,${0.7 * Math.sin(ph / 0.5 * Math.PI)})`; const hx = hash(x, y, 78) % 12, hy = hash(x, y, 79) % 12; g.fillRect(x * TILE + hx, y * TILE + hy + 2, 3, 1); g.fillRect(x * TILE + hx + 1, y * TILE + hy + 1, 1, 1); }
    }
  }

  // 도트 판에 매 프레임 새로 그리면 무거운 장식물(집 · 상징물 · 마을 물건)은 따로 그려 두고 초당 6번만 고친다
  drawPropCached(w, pr) {
    const night = (this.nightK || 0) > 0.42, q = Math.floor(w.t * 6), cache = (this.propCache ||= new Map());
    const PX = pr.big ? 140 : 48, PT = pr.big ? 280 : 96, PB = pr.big ? 48 : 24, x0 = pr.x * TILE - PX, y0 = pr.y * TILE - PT;
    let c = cache.get(pr);
    if (c) { cache.delete(pr); cache.set(pr, c); }
    else {
      const cv = document.createElement('canvas'); cv.width = pr.w * TILE + PX * 2; cv.height = pr.h * TILE + PT + PB;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      c = { cv, ctx, px: new PixelCtx(ctx), q: -1, night: null };
      cache.set(pr, c);
      if (cache.size > 64) cache.delete(cache.keys().next().value);
    }
    if (c.q !== q || c.night !== night || pr.shakeT > 0) {
      c.ctx.setTransform(1, 0, 0, 1, 0, 0); c.ctx.clearRect(0, 0, c.cv.width, c.cv.height);
      c.px.setTransform(1, 0, 0, 1, -x0, -y0);
      drawOutdoorProp(c.px, pr, w.t, night, w.burntTrees);
      c.q = q; c.night = night;
    }
    this.g.drawImage(c.cv, x0, y0);
  }

  drawProp(w, pr) {
    const g = this.g, x = pr.x * TILE, y = pr.y * TILE;
    if (w.map.indoor) {
      if (pr.kind === 'stove' && Math.random() < 0.08) this.parts.push({ x: x + pr.w * TILE - 9 + (Math.random() - 0.5) * 6, y: y + pr.h * TILE - 34, vx: (Math.random() - 0.5) * 5, vy: -10 - Math.random() * 6, t: 1.2, max: 1.2, color: '#f0f0f8', g: -2, steam: true }); // 냄비 김
      drawInteriorProp(g, pr, w.t); if (pr.kind === 'furnace' && Math.random() < 0.25) this.parts.push({ x: x + pr.w * 8 + (Math.random() - 0.5) * 16, y: y + pr.h * 16 - 14, vx: (Math.random() - 0.5) * 12, vy: -30 - Math.random() * 30, t: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffd040', g: -10, glow: true, size: 1 }); return; }
    if (w.map.outdoor) {
      // 나무가 나를 가리면 그 나무만 반투명하게 (빽빽한 숲에서도 내 둘레가 보이게)
      const p = w.player, near = pr.kind === 'tree' && y + 16 > p.y && Math.abs(x + 8 - p.x) < 34 && p.y - 10 > y - 52 && p.y - 10 < y + 4;
      if (near) g.globalAlpha = 0.42;
      if (pr.big && LANDMARK_BOX[pr.kind]) { // 커다란 상징물 뒤(위쪽)에 들어가면 반쯤 비쳐서 내가 보인다
        const [l, top, rr] = LANDMARK_BOX[pr.kind], bx = x + pr.w * 8, by2 = y + pr.h * TILE;
        if (p.y < by2 - 2 && p.y > by2 + top + 20 && p.x > bx + l && p.x < bx + rr) g.globalAlpha = 0.5;
      }
      if (pr.kind === 'tree' && !pr.big) drawOutdoorProp(g, pr, w.t, (this.nightK || 0) > 0.42, w.burntTrees);
      else this.drawPropCached(w, pr); // 마을 · 상징물: 미리 그린 그림을 쓴다 (초당 6번만 다시 그린다)
      g.globalAlpha = 1;
      if (pr.smokeAt && Math.random() < (pr.smokeAt.heavy ? 0.22 : 0.06)) this.parts.push({ x: pr.smokeAt.x + (Math.random() - 0.5) * 4, y: pr.smokeAt.y, vx: 6 + Math.random() * 6, vy: -14 - Math.random() * 8, t: 2.2, max: 2.2, color: pr.smokeAt.heavy ? '#5a5458' : '#a8a4a8', g: -2, big: true }); // 굴뚝 연기
      return;
    }
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

  // 용언 글자: 불(불꽃) · 하늘(별) · 비늘(방패) · 날개(깃) · 대지(산) — 굵은 획의 용의 글자
  drawGlyph(wd, x, y, sc, col, a, rot = 0, prog = 1, pen = null) {
    const g = this.g, S = (v) => v * sc;
    const strokes = {
      fire: [[[0, -7], [3, -2], [1, 0], [4, 4], [0, 7], [-4, 4], [-1, 0], [-3, -2], [0, -7]]],
      sky: [[[0, -7], [2, -2], [7, -2], [3, 1], [5, 7], [0, 3], [-5, 7], [-3, 1], [-7, -2], [-2, -2], [0, -7]]],
      scale: [[[-6, -6], [6, -6], [6, 1], [0, 7], [-6, 1], [-6, -6]], [[-3, -2], [3, -2]], [[0, -4], [0, 3]]],
      wing: [[[-6, 6], [-2, -6], [6, -7], [3, -2], [6, 0], [2, 2], [4, 5], [-6, 6]], [[-4, 4], [2, -4]]],
      earth: [[[-7, 6], [-2, -4], [1, 1], [3, -6], [7, 6], [-7, 6]], [[-2, 2], [0, 4]]],
    }[wd] || [[[-5, -5], [5, 5]], [[5, -5], [-5, 5]]];
    // 써 내려간 만큼만: 획 길이를 모두 더해 prog 비율까지 잇는다 (붓끝 자리는 pen에 돌려준다)
    const segs = []; let total = 0;
    for (const st of strokes) for (let i = 1; i < st.length; i++) { const l = Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]); segs.push([st, i, l, i === 1]); total += l; }
    let left = total * Math.max(0, Math.min(1, prog)), tipX = 0, tipY = 0;
    const paths = [];
    for (const [st, i, l, first] of segs) {
      if (left <= 0) break;
      const q = Math.min(1, left / l), [ax, ay] = st[i - 1], bx = ax + (st[i][0] - ax) * q, by = ay + (st[i][1] - ay) * q;
      if (first || !paths.length) paths.push([[ax, ay]]);
      paths[paths.length - 1].push([bx, by]); tipX = bx; tipY = by; left -= l;
    }
    g.save(); g.translate(x, y); g.rotate(rot * 0.15); g.globalAlpha = Math.max(0, Math.min(1, a));
    g.save(); g.globalCompositeOperation = 'lighter'; this.glow(0, 0, S(14), col, 0.8 * Math.min(1, prog * 1.5)); g.restore();
    for (const [w0, c0] of [[S(3.2), '#1a0e0a'], [S(1.8), col], [S(0.7), '#fff6e0']]) {
      g.strokeStyle = c0; g.lineWidth = w0; g.lineJoin = 'round'; g.lineCap = 'round';
      for (const st of paths) { g.beginPath(); st.forEach(([px, py], i) => (i ? g.lineTo(S(px), S(py)) : g.moveTo(S(px), S(py)))); g.stroke(); }
    }
    g.restore(); g.lineCap = 'butt'; g.lineJoin = 'miter';
    if (pen) { const c = Math.cos(rot * 0.15), s2 = Math.sin(rot * 0.15); pen.x = x + (S(tipX) * c - S(tipY) * s2); pen.y = y + (S(tipX) * s2 + S(tipY) * c); }
  }
  // 분노 폭발: 몸에서 붉은 기운이 터져 나와 땅이 갈라진다 (고리 없이 균열 · 파편 · 붉은 불길)
  // 분노 폭발: 몸에서 붉은 기운이 뾰족하게 터져 나가고, 땅이 붉게 갈라지며 돌 조각 · 흙먼지가 튄다. 터진 뒤에도 한동안 몸에서 열기가 피어오른다
  rageBlast(x, y, r) {
    this.flash = { color: '255,60,30', t: 0.28, max: 0.28 };
    this.shake = Math.max(this.shake, 13); this.hitstop = Math.max(this.hitstop, 0.14);
    this.rimFlash = { color: '#ff3a1a', t: 1.1, max: 1.1 };
    const list = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4; let px = 0, py = 0; const cr = [[0, 0]]; const len = r * (0.7 + Math.random() * 0.35); for (let s2 = 0; s2 < 7; s2++) { const aa = a + (Math.random() - 0.5) * 0.7; px += Math.cos(aa) * len / 7; py += Math.sin(aa) * len / 7 * 0.6; cr.push([px, py]); } list.push(cr); }
    this.fx.push({ k: 'rageCracks', x, y: y + 2, list, t: 1.8, max: 1.8 });
    const spikes = Array.from({ length: 11 }, (_, i) => ({ a: (i / 11) * Math.PI * 2 + (Math.random() - 0.5) * 0.45, len: r * (0.4 + Math.random() * 0.4), w: 2.5 + Math.random() * 2.5, bend: (Math.random() - 0.5) * 0.7 }));
    this.fx.push({ k: 'rageSpikes', x, y: y - 8, spikes, t: 0.42, max: 0.42 });
    this.fx.push({ k: 'glow', x, y: y - 8, r: r * 0.8, color: '#ff3a1a', t: 0.45, max: 0.45 });
    this.fx.push({ k: 'rageHeat', x, y, t: 1.3, max: 1.3 });
    for (let i = 0; i < 34; i++) { const a = Math.random() * Math.PI * 2, s2 = 90 + Math.random() * 260; this.parts.push({ x, y: y - 8, vx: Math.cos(a) * s2, vy: Math.sin(a) * s2 * 0.6, t: 0.25 + Math.random() * 0.2, max: 0.45, color: i % 3 ? '#ff4a2a' : '#ffd0a0', g: 0, line: true }); }
    for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2, s2 = 40 + Math.random() * 120; this.parts.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 3, vx: Math.cos(a) * s2, vy: -80 - Math.random() * 70, t: 0.75, max: 0.75, color: i % 2 ? '#5a4438' : '#3a2c26', g: 320 }); }
    for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, s2 = 30 + Math.random() * 90; this.parts.push({ x: x + Math.cos(a) * 6, y: y + 2 + Math.sin(a) * 3, vx: Math.cos(a) * s2, vy: Math.sin(a) * s2 * 0.45, t: 0.9, max: 0.9, color: '#9a8070', g: -6, steam: true }); }
    this.texts.push({ x, y: y - 34, text: '분노 폭발!', color: '#ff5a3a', t: 1.1, vy: -14, vx: 0, label: true, size: 2, pop: 0.2 });
    sfx('hitHeavy', { vol: 1, rate: 0.4 }); sfx('reaction', { vol: 0.9, rate: 0.5 });
  }

  // 연막: 뭉게뭉게 피어오르는 잿빛 연기 (반쯤 비쳐서 안이 보인다)
  drawSmoke(w, dt) {
    const g = this.g, t = w.t;
    for (const z of w.zones || []) {
      if (z.kind !== 'smoke') continue;
      const life = z.t / z.max, inA = Math.min(1, (z.max - z.t) / 0.35), outA = Math.min(1, z.t / 0.8), a = inA * outA;
      z.puffs ||= Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + Math.random() * 0.4, d: 0.25 + Math.random() * 0.65, r: 0.32 + Math.random() * 0.25, ph: Math.random() * 6 }));
      const grow = 0.75 + 0.25 * Math.min(1, (z.max - z.t) / 0.6);
      for (const pf of z.puffs) {
        const x = z.x + Math.cos(pf.a + t * 0.08) * z.r * pf.d * grow, y = z.y - 8 + Math.sin(pf.a + t * 0.08) * z.r * pf.d * 0.55 * grow + Math.sin(t * 0.7 + pf.ph) * 2;
        const rr = z.r * pf.r * grow * (1 + 0.08 * Math.sin(t * 0.9 + pf.ph));
        const gr = g.createRadialGradient(x, y, rr * 0.2, x, y, rr);
        gr.addColorStop(0, `rgba(196,198,210,${0.36 * a})`); gr.addColorStop(0.6, `rgba(170,172,186,${0.22 * a})`); gr.addColorStop(1, 'rgba(160,162,176,0)');
        g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      if (dt > 0 && Math.random() < 0.5 * life) this.parts.push({ x: z.x + (Math.random() - 0.5) * z.r * 1.4, y: z.y - 4 + (Math.random() - 0.5) * z.r * 0.7, vx: (Math.random() - 0.5) * 6, vy: -6 - Math.random() * 6, t: 1.6, max: 1.6, color: '#c8cad4', g: -1, steam: true });
    }
  }

  // ───────── 낮과 밤: 하늘빛을 곱해 어둡게 하고, 불빛 자리는 밝게 남긴다 ─────────
  drawDayNight(w, cx, cy, dt) {
    const c = w.clock, outdoor = !!w.map.outdoor, indoor = !!w.map.indoor;
    this.nightK = 0;
    if (!c || (!outdoor && !indoor)) return;
    let [r, gg, b] = skyColor(c.min), dk = darkness(c.min);
    if (w.map.underwater) { // 바닷속: 푸른 물빛을 곱하고, 밤이면 더 깊게. 불빛(거품 구멍 · 빛나는 풀 · 해파리)은 늘 보인다
      const dep = Math.min(1, (w.map.depth?.[Math.floor(w.player.y / TILE) * w.tw + Math.floor(w.player.x / TILE)] || 0) / 14);
      r = r * (0.42 - dep * 0.18) + 20; gg = gg * (0.62 - dep * 0.2) + 34; b = b * (0.8 - dep * 0.18) + 46; dk = Math.max(0.55, dk);
    }
    if (indoor) { r = 255 - (255 - r) * 0.5; gg = 255 - (255 - gg) * 0.5; b = 255 - (255 - b) * 0.42; dk *= 0.7; } // 집 안은 덜 어둡다 (등불 · 화로)
    this.nightK = dk;
    if (r > 252 && gg > 252 && b > 252) return;
    const lg = this.lg, VW = this.VW, VH = this.VH, p = w.player, t = w.t;
    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; lg.fillRect(0, 0, VW, VH);
    lg.globalCompositeOperation = 'lighter';
    const L = Math.min(1, dk * 1.25); // 불빛이 얼마나 두드러지는지 (낮엔 0)
    const inView = (x, y, rr) => x > cx - rr && x < cx + VW + rr && y > cy - rr && y < cy + VH + rr;
    const LC = (this.lightCache ||= new Map());
    const light = (x, y, rr, col, a = 1) => { // 불빛: 크기 · 색 · 세기마다 한 번 그려 둔 도트 빛을 찍는다 (매번 그라데이션을 새로 칠하지 않게)
      if (!inView(x, y, rr) || a <= 0.01) return;
      const R = Math.max(4, Math.round(rr / 2) * 2), A = Math.round(a * 16) / 16, key = R + col + A;
      let img = LC.get(key);
      if (!img) {
        const cv = document.createElement('canvas'); cv.width = cv.height = R * 2;
        const px = new PixelCtx(cv.getContext('2d')), gr = px.createRadialGradient(R, R, 0, R, R, R);
        gr.addColorStop(0, hexA(col, A)); gr.addColorStop(0.45, hexA(col, A * 0.55)); gr.addColorStop(1, hexA(col, 0));
        px.fillStyle = gr; px.fillRect(0, 0, R * 2, R * 2);
        img = cv; LC.set(key, img); if (LC.size > 300) LC.delete(LC.keys().next().value);
      }
      lg.drawImage(img, Math.round(x - cx - R), Math.round(y - cy - R));
    };
    const fl = (k) => 1 + Math.sin(t * 9 + k) * 0.05 + Math.sin(t * 23 + k * 3) * 0.03;
    if (L > 0) {
      light(p.x, p.y - 6, p.buffs?.scrollLight ? 150 : 78, p.buffs?.scrollLight ? '#fff2c8' : '#d8d0c0', (p.buffs?.scrollLight ? 0.85 : 0.5) * L); // 내 둘레는 늘 조금 보인다 (빛의 주문서면 환히)
      if (p.buffs?.enchant) light(p.x, p.y - 8, 54, ELEM[p.buffs.enchant.elem]?.color || '#ffffff', 0.5 * L);
      for (const o of w.objects) {
        if (!inView(o.x, o.y, 140)) continue;
        if (o.kind === 'rest' || o.kind === 'camp') light(o.x + (o.kind === 'camp' ? 11 : 0), o.y - 4, 128 * fl(o.x), '#ffb050', 0.95 * L);
        else if (o.kind === 'door') light(o.x, o.y - 18, 54, '#ffcf7a', 0.75 * L);
        else if (o.kind === 'sanctum') light(o.x + 16, o.y - 16, 72, SANCTUMS[o.race]?.color || '#ffffff', 0.55 * L);
        else if (o.kind === 'towerDoor') light(o.x, o.y - 8, 70, '#90ffe0', 0.6 * L);
        else if (o.kind === 'raidAltar') light(o.x, o.y - 18, 60, '#ff5a6a', 0.6 * L);
        else if (o.kind === 'waypoint' && o.active) light(o.x, o.y - 10, 60, '#8ad8ff', 0.6 * L);
        else if (o.kind === 'relic' && !o.opened) light(o.x, o.y - 14, 40, SANCTUMS[o.race]?.color || '#ffffff', 0.7 * L);
        else if (o.kind === 'merchant' || o.kind === 'npc' || o.kind === 'turtle') light(o.x, o.y - 10, 46, '#ffd890', 0.5 * L);
        else if (o.kind === 'shrine' && !o.opened) light(o.x, o.y - 24, 46, '#c9a8ff', 0.6 * L);
        else if (o.kind === 'lore' && !o.opened) light(o.x, o.y - 6, 26, '#8ad8ff', 0.5 * L);
        else if (o.kind === 'entrance') light(o.x, o.y - 10, 34, '#e8dcc0', 0.3 * L);
        else if (o.kind === 'node' && !o.depleted && (o.type === 'crystal' || o.type === 'obsidian')) light(o.x, o.y - 6, 28, o.type === 'crystal' ? '#c0a0ff' : '#ff8a5a', 0.45 * L);
        else if (o.kind === 'station') light(o.x, o.y - 8, 34, '#ffd890', 0.35 * L);
      }
      if (w.map.props) for (const pr of w.map.props) {
        const px = (pr.x + pr.w / 2) * TILE, py = (pr.y + pr.h) * TILE;
        if (!inView(px, py, 220)) continue;
        if (pr.kind.startsWith('house_')) { light(pr.x * TILE + 16, py - 22, 34, '#ffc870', 0.7 * L); light((pr.x + pr.w) * TILE - 16, py - 22, 34, '#ffc870', 0.7 * L); }
        else if (pr.kind === 'tower') { light(px, py - 194, 96, '#90ffe0', 0.85 * L); light(px, py - 6, 46, '#90ffe0', 0.5 * L); }
        else if (pr.kind === 'furnace' || pr.kind === 'stove' || pr.kind === 'fireplace') light(px, py - 14, 84 * fl(px), '#ff9a40', 0.85 * L);
        else if (pr.kind === 'candles') light(px, py - 10, 46 * fl(px), '#ffc070', 0.8 * L);
        else if (pr.kind === 'desk' && pr.books) light((pr.x + pr.w) * TILE - 12, py - 20, 36, '#ffc070', 0.7 * L);
        else if (pr.kind === 'runeAltar') light(px, py - 22, 60, '#c0a0ff', 0.75 * L);
        else if (pr.kind === 'lampPost') light(px, py - 30, 84, '#ffd890', 0.9 * L); // 가로등은 흔들리지 않는 고른 빛 (깜박이지 않게)
        else if (pr.kind === 'mageTower' || pr.kind === 'worldTree' || pr.kind === 'dragonNest' || pr.kind === 'mausoleum') light(px, py - 30, 70, pr.kind === 'worldTree' ? '#8affb0' : pr.kind === 'dragonNest' ? '#ff8a40' : pr.kind === 'mausoleum' ? '#c45cff' : '#b0a0ff', 0.5 * L);
      }
      if (indoor) light(p.x, p.y - 6, 60, '#ffd8a0', 0.35 * L);
      if (w.map.underwater) {
        light(p.x, p.y - 6, 96, '#bfe8ff', 0.6); // 물속에서도 둘레는 보인다
        for (const o of w.objects) { if (o.kind === 'vent') light(o.x, o.y - 6, 52 + Math.sin(t * 3 + o.x) * 4, '#a8f0ff', 0.75); else if (o.kind === 'palaceGate') light(o.x, o.y - 16, 110, '#7af0e0', 0.9); else if (o.kind === 'chest' && !o.opened && (!o.hidden || o.found)) light(o.x, o.y - 4, 26, '#ffe8a0', 0.5); }
      }
      for (const d of this.glowDeco || []) if (inView(d.x, d.y, 40)) { const [rr, col] = GLOW[d.kind]; light(d.x, d.y - 3, rr * 1.4, col, 0.75 * L); }
      for (const [k] of w.burning || []) { const x = (k % w.tw) * TILE + 8, y = Math.floor(k / w.tw) * TILE + 8; light(x, y, 44 * fl(k), '#ff9040', 0.8 * L); }
      if (outdoor) { // 용암: 보이는 칸만 (두 칸마다 하나씩)
        const x0 = Math.max(0, Math.floor(cx / TILE) - 2), y0 = Math.max(0, Math.floor(cy / TILE) - 2), x1 = Math.min(w.tw - 1, Math.ceil((cx + VW) / TILE) + 2), y1 = Math.min(w.th - 1, Math.ceil((cy + VH) / TILE) + 2);
        for (let y = y0 - (y0 & 1); y <= y1; y += 2) for (let x = x0 - (x0 & 1); x <= x1; x += 2) if (w.map.ground[y * w.tw + x] === G.LAVA) light(x * TILE + 8, y * TILE + 8, 40, '#ff7a30', 0.55 * L);
      }
      if (w.farmRect && w.life) for (const [key, pl] of Object.entries(w.life.farm)) if (pl.crop === 'starflower' && pl.stage >= 3) { const [fx, fy] = key.split(',').map(Number); light(fx * TILE + 8, fy * TILE + 4, 30, '#fff2a0', 0.6 * L); }
      for (const pr of w.projs) light(pr.x, pr.y, 34, pr.color || '#ffffff', 0.7 * L);
      for (const e of w.enemies) {
        if (e.dead || !inView(e.x, e.y, 40)) continue;
        if (e.def.glow || e.def.ghost) light(e.x, e.y - 10, e.def.glow ? 58 : 34, e.def.glowColor || e.def.pal?.a || '#8ad8ff', 0.7 * L);
        else if (e.st.burn) light(e.x, e.y - 8, 30, '#ff8a3a', 0.6 * L);
      }
      for (const dr of w.drops) light(dr.x, dr.y, 16, '#fff0c0', 0.4 * L);
    }
    lg.globalCompositeOperation = 'source-over';
    const g = this.g;
    g.save(); this.viewTf(g);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(this.light, 0, 0);
    g.restore(); g.imageSmoothingEnabled = false;
    this.worldTf(g);
    // 반딧불이 (밤의 풀숲 · 숲)
    if (outdoor && dk > 0.55 && dt > 0) {
      const ff = this.fireflies ||= [];
      const bi = w.map.biome?.[Math.floor(p.y / TILE) * w.tw + Math.floor(p.x / TILE)];
      const lush = bi != null && [0, 1, 2, 3, 10, 11].includes(bi);
      if (lush && ff.length < 26 && Math.random() < dt * 6) ff.push({ x: cx + Math.random() * VW, y: cy + Math.random() * VH, ph: Math.random() * 6, life: 5 + Math.random() * 5, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 6 });
      g.globalCompositeOperation = 'lighter';
      for (const f of ff) {
        f.life -= dt; f.ph += dt; f.x += (f.vx + Math.sin(f.ph * 1.3) * 6) * dt; f.y += (f.vy + Math.cos(f.ph * 0.9) * 5) * dt;
        const a = Math.max(0, Math.min(1, f.life)) * (0.5 + 0.5 * Math.sin(f.ph * 3)) * Math.min(1, (dk - 0.55) * 3);
        if (a <= 0.02) continue;
        g.fillStyle = `rgba(200,255,120,${0.22 * a})`; g.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2, 5, 5);
        g.fillStyle = `rgba(235,255,170,${a})`; g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
      }
      g.globalCompositeOperation = 'source-over';
      this.fireflies = ff.filter((f) => f.life > 0);
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
    hole(p.x, p.y - 6, (p.buffs?.scrollLight ? 250 : 160) * flick); // 빛의 주문서: 더 넓게
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
    this.viewTf(g);
    g.drawImage(this.light, 0, 0);
    this.worldTf(g);
  }

  // 안 가 본 곳의 어둠: 칸 가운데 네 곳(가 봤나 · 안 가 봤나)으로 정해지는 16가지 모양을 미리 점묘로 찍어 두고, 보이는 칸마다 붙인다
  // (진하기 네 단계 + 바둑판 점묘 · 칸에 맞춰 있어 걸어도 무늬가 흔들리지 않는다)
  drawFog(w, cx, cy) {
    const g = this.g, VW = this.VW, VH = this.VH, ex = w.explored, tw = w.tw, th = w.th, spr = (this.fogSpr ||= fogSprites());
    const fog = (x, y) => (x < 0 || y < 0 || x >= tw || y >= th || !ex[y * tw + x] ? 1 : 0);
    this.worldTf(g);
    g.fillStyle = '#05040a';
    const i0 = Math.floor((cx - 8) / TILE), i1 = Math.floor((cx + VW - 8) / TILE), j0 = Math.floor((cy - 8) / TILE), j1 = Math.floor((cy + VH - 8) / TILE);
    for (let j = j0; j <= j1; j++) {
      let run = -1; // 꽉 찬 어둠은 가로로 이어서 한 번에
      for (let i = i0; i <= i1 + 1; i++) {
        const m = i > i1 ? 0 : fog(i, j) | (fog(i + 1, j) << 1) | (fog(i, j + 1) << 2) | (fog(i + 1, j + 1) << 3);
        if (m === 15) { if (run < 0) run = i; continue; }
        if (run >= 0) { g.fillRect(run * TILE + 8, j * TILE + 8, (i - run) * TILE, TILE); run = -1; }
        if (m) g.drawImage(spr[m], i * TILE + 8, j * TILE + 8);
      }
    }
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
    for (const o of w.objects) if (o.kind === 'waypoint' && o._top != null && Math.hypot(o.x - w.player.x, o.y - w.player.y) < 110) this.text(o.active ? `${o.name} 포탈` : '잠든 포탈', this.sx(o.x), this.sy(o._top - 5), u, o.active ? '#bfefff' : '#b0a8bc', 'center');
    if (w.mode === 'plaza' || w.practice) { // 허수아비 이름 · 초당 피해 (광장 · 연습 실험장)
      for (const e of w.enemies) if (e.tag && !e.dead && e._top != null) this.text(e.tag, this.sx(e.x), this.sy(e._top - 9), Math.max(1, u - 1), '#ffd8a0', 'center', true);
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
      this.text(`${e.lv ? `Lv ${e.lv} ` : ''}${e.champion || e.def.name}`, this.sx(e.x), this.sy(e._top - 8), u, '#ff9a8a', 'center', true, true);
    }
    { // 몬스터 레벨: 내 레벨보다 5 넘게 높으면 빨강, 5 넘게 낮으면 회색
      const my = w.b.level || 1;
      for (const e of w.enemies) if (e.lv && !e.dead && !e.champion && !e.def.elite && !e.affix && e._top != null && Math.abs(e.x - w.player.x) < 150 && Math.abs(e.y - w.player.y) < 100)
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
  }

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
    const ht = 16 * u + body.length * lh + 4 * u, x = Math.round(Math.min(this.c.width - wd - 4 * u, tp.x)), y = Math.round(tp.y + tp.h + 4 * u);
    this.panel(x, y, wd, ht);
    this.text(tp.title, x + 6 * u, y + 9 * u, u, tp.color, 'left', true, true);
    body.forEach((l, i) => this.text(l, x + 6 * u, y + 18 * u + i * lh + lh / 2, tu, i === body.length - 1 && left ? '#b8b0c8' : '#e8e0f0', 'left', false));
  }

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
      if (bxx > bx && bxx + lw > bx + 250 * u) { bxx = bx; ry += 10 * u; } // 길면 다음 줄로
      this.text(label, bxx, ry + 5 * u, tu, bf.color || '#ffffff');
      const lines = modLines(bf.mods);
      if (!lines.length && sk?.desc) lines.push(sk.desc.replace(/\s*(마력|기력|분노|마나|기운|영혼)\s*\d+\.?$/, ''));
      if (bf.persist) lines.push(id === 'meal' ? '음식 효과 · 새 음식을 먹으면 바뀐다' : id === 'rested' ? '잘 자고 일어난 효과 · 저녁 6시까지' : '오래가는 효과', '게임 시간으로 끝난다 (집을 드나들어도 이어진다)');
      tips.push({ x: bxx, y: ry, w: lw + 3 * u, h: 10 * u, title: nm, color: bf.color || '#ffffff', lines, left: bf.t });
      bxx += lw + 8 * u;
    }
    if (Object.keys(p.buffs).length) ry += 10 * u;
    // 상태이상
    const names = { burn: ['화상', '#ff7a2a', '불에 데어 잠깐 동안 계속 피해를 받는다. 물에 들어가면 꺼진다.'], poison: ['중독', '#9be15d', '독이 퍼져 잠깐 동안 계속 피해를 받는다.'], bleed: ['출혈', '#e0445a', '피를 흘려 잠깐 동안 계속 피해를 받는다. 겹칠수록 세다.'], chill: ['냉기', '#9fe3ff', '몸이 얼어 이동 · 공격이 느려진다.'] };
    let sxx = bx;
    for (const k of Object.keys(p.st)) { const nm = names[k] || [k, '#ffffff', '']; this.text(nm[0], sxx, ry + 5 * u, u, nm[1]); tips.push({ x: sxx, y: ry, w: 26 * u, h: 10 * u, title: nm[0], color: nm[1], lines: [nm[2]].filter(Boolean), left: p.st[k]?.t }); sxx += 30 * u; }
    this.drawSkillBar(w);
    this.drawClock(w);
    this.drawTip();

    if (w.mode === 'field') this.drawMinimap(w);
    else if (!document.body.classList.contains('touch')) {
      const hint = document.body.classList.contains('touch') ? '시설 가까이 가서 확인 버튼 · 캐릭터 버튼으로 스탯 배분' : 'WASD 이동 · G 상호작용 · I 장비 · B 가방 · C 캐릭터 · 아래쪽 문으로 나가기';
      g.font = `${11 * u}px ${FONT}`;
      const tw2 = g.measureText(hint).width + 20 * u;
      const vv = Math.max(2, u), hy0 = H - 32 * vv - 26 * u; // 스킬바 위로
      g.fillStyle = 'rgba(13,11,16,0.7)'; g.fillRect((W - tw2) / 2, hy0 - 8 * u, tw2, 16 * u);
      this.text(hint, W / 2, hy0, u, '#d8d0e8', 'center', false);
    }

    // 온라인: 다른 사람의 이름 · 말풍선
    for (const rp of w.remotes || []) {
      const tx = this.sx(rp.x), ty = this.sy(rp._top ?? rp.y - 18) - 6 * u;
      if (tx < -40 || tx > W + 40 || ty < -40 || ty > H + 40) continue;
      const mate = w.myParty && rp.party === w.myParty;
      this.text(`${rp.gname ? `[${rp.gname}] ` : ''}${rp.name}${rp.duel ? ' ⚔' : ''}`, tx, ty, Math.max(1, u - 1), mate ? '#a8f0a0' : '#bfe8ff', 'center', true, true);
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
      g.fillStyle = '#ffcf5a'; g.fillRect(tx - tw2 / 2 + 3 * u, ty - 5 * u, 10 * u, 10 * u);
      this.text('G', tx - tw2 / 2 + 8 * u, ty, u, '#241a00', 'center', false, true);
      this.text(label, tx + 7 * u, ty, u, '#ffffff', 'center', false);
    }

    else if (w.act && !w.player.fish && !w.player.gather && !anim) {
      const a = w.act, label = a.label, tx = this.sx(a.x), ty = this.sy(a.y - 22) - 10 * u;
      g.font = `${11 * u}px ${FONT}`;
      const tw2 = g.measureText(label).width + 30 * u;
      this.panel(tx - tw2 / 2, ty - 8 * u, tw2, 16 * u);
      const can = !/필요하다|없다|용암 낚시는|자라는 중/.test(label);
      g.fillStyle = can ? '#ffcf5a' : '#8a8090'; g.fillRect(tx - tw2 / 2 + 3 * u, ty - 5 * u, 10 * u, 10 * u);
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
      this.text(p.buffs.waterBreath ? '숨 · 수중 호흡 중' : `숨 ${Math.ceil(p.breath)}초`, bx0, by0, Math.max(1, u - 1), k < 0.3 ? '#ff9a8a' : '#bfe8ff');
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
    // 각인의 탑: 이 층의 우두머리 목록 (쓰러뜨리면 빨간 줄)
    if (w.tower?.bosses?.length) {
      let y = topY + 46 * u;
      const x = W - 10 * u;
      this.text('우두머리', x, y, Math.max(1, u - 1), '#c8b8a0', 'right', true, true);
      for (const b of w.tower.bosses) {
        y += 13 * u;
        const name = b.champion || b.def.name, col = b.dead ? '#8a8090' : b === w.tower.boss ? '#ff9a7a' : '#ffd27a';
        this.text(name, x, y, Math.max(1, u - 1), col, 'right', true, true);
        if (b.dead) { g.font = `${10 * Math.max(1, u - 1)}px ${FONT}`; const tw2 = g.measureText(name).width; g.fillStyle = '#ff3a3a'; g.fillRect(Math.round(x - tw2), Math.round(y), Math.round(tw2), Math.max(2, u)); }
      }
    }
    // 각인의 탑: 층 · 걸린 시간 / 기준 시간 (넘기면 붉게)
    if (w.tower) {
      const par = 60 + w.tower.f * 2 + (w.tower.f % 5 === 0 ? 45 : 0), tt = w.tower.t, over = tt > par;
      const fmt = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
      this.text(`각인의 탑 ${w.tower.f}층 · ${fmt(tt)} / ${fmt(par)}`, W / 2, topY, u, over ? '#ff8a7a' : '#e8d8a8', 'center', true, true);
    }
    // 정예 체력바
    const boss = w.enemies.find((e) => (e.def.elite || e.champion) && e.state === 'chase' && !e.dead);
    if (boss) {
      const bw2 = Math.min(W * 0.5, 260 * u), bx2 = (W - bw2) / 2, by2 = topY + 28 * u; // 화면 위쪽 (아래 스킬 칸 · 위쪽 저장 안내를 가리지 않게)
      this.text(boss.champion || boss.def.name, W / 2, by2 - 9 * u, u, '#ff9a8a', 'center', true, true);
      this.panel(bx2, by2, bw2, 8 * u);
      g.fillStyle = '#3a1016'; g.fillRect(bx2 + u, by2 + u, bw2 - 2 * u, 6 * u);
      g.fillStyle = '#e8483a'; g.fillRect(bx2 + u, by2 + u, (bw2 - 2 * u) * boss.hp / boss.maxHp, 6 * u);
    }

    if (this.notes?.length) this.drawNotes(dt);
    if (w.player.fish) this.drawRhythm(w, dt);
    if (this.bigMap && w.map.outdoor) this.drawBigMap(w);
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
    g.strokeStyle = '#0d0b10'; g.lineWidth = u; g.beginPath(); g.arc(ox, oy, R, 0, Math.PI * 2); g.stroke();
    this.text(`${c.day}일 · ${clockText(c)}`, x + 8 * u + R * 2 + 36 * u, oy, u, dk > 0.6 ? '#c8d0ff' : '#ffe8a8', 'center');
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
    const x0 = touch ? W - total - 8 * u : (W - total) / 2, y0 = touch ? Math.round(H * 0.2) : H - box - 12 * v; // 모바일: 오른쪽 작은 지도 아래 (체력 · 저장 안내와 겹치지 않게)
    // 대시
    const dashMax = d.dashCd * (1 - d.cdr), dashK = p.dashCharges > 0 ? 1 : Math.min(1, 1 - p.dashRecharge / dashMax);
    this.cooldownBox(x0, y0, box, dashK, touch ? '대시' : 'Space', '', null, p.dashCharges > 0 ? 0 : p.dashRecharge);
    // 빠른 칸 음식 (H)
    const qf = w.life?.quickFood;
    if (qf && !touch) {
      const qx = x0 - box - gap, n = w.life?.bag?.[qf] || 0;
      this.panel(qx, y0, box, box);
      if (n > 0) { g.imageSmoothingEnabled = false; const ic = iconCanvas(qf), s2 = Math.floor((box - 4 * u) / 16); g.drawImage(ic, Math.round(qx + (box - 16 * s2) / 2), Math.round(y0 + (box - 16 * s2) / 2), 16 * s2, 16 * s2); this.text(String(n), qx + box - 3 * v, y0 + box - 5 * v, Math.max(1, u - 1), '#ffffff', 'right'); }
      else { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(qx + u, y0 + u, box - 2 * u, box - 2 * u); }
      this.text('H', qx + 4 * v, y0 + 5 * v, Math.max(1, u - 1), '#ffe8a8', 'left', true, true);
    }
    // 물약 (Z): 가진 물약 수 · 다시 마실 때까지
    const pots = ['potion1', 'potion2', 'potion3'].filter((id) => w.life?.bag?.[id] > 0);
    if (pots.length && !touch) {
      const px2 = x0 + n * (box + gap), cnt = pots.reduce((a, id) => a + w.life.bag[id], 0);
      this.cooldownBox(px2, y0, box, p.potionCd > 0 ? 1 - p.potionCd / 8 : 1, 'Z', '', null, p.potionCd);
      g.imageSmoothingEnabled = false; const ic = iconCanvas(pots[0]), s2 = Math.max(1, Math.floor((box - 8 * u) / 16)); g.drawImage(ic, Math.round(px2 + (box - 16 * s2) / 2), Math.round(y0 + (box - 16 * s2) / 2 + 2 * u), 16 * s2, 16 * s2);
      this.text(String(cnt), px2 + box - 3 * v, y0 + box - 5 * v, Math.max(1, u - 1), '#ffffff', 'right');
      this.text('물약', px2 + box / 2, y0 + box + 7 * v, Math.max(1, u - 1), '#d8d0e8', 'center');
    }
    slots.forEach((id, i) => {
      const x = x0 + (i + 1) * (box + gap);
      if (id === 'weapon') {
        const k = p.skillCd > 0 ? 1 - p.skillCd / p.skillMax : 1;
        this.cooldownBox(x, y0, box, k, keys[i], '', null, p.skillCd);
        this.text((WEAPON_SKILLS[w.b.weapon.skill]?.name || '무기').slice(0, 4), x + box / 2, y0 + box + (7 + (i % 2) * 9) * v, Math.max(1, u - 1), '#d8d0e8', 'center');
        return;
      }
      const sk = SKILLS[id];
      const cd = p.cds[id] || 0, max = p.cdMax?.[id] || sk.cd;
      const k = cd > 0 ? 1 - cd / max : 1;
      const need = sk.costAll ? sk.costAll.min : sk.cost || 0;
      const lack = need > p.res;
      this.cooldownBox(x, y0, box, k, keys[i], '', ROLE_COLOR[sk.role], cd);
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

  // 스킬 칸: 기다리는 동안은 어둡게 덮고 남은 초를 크게, 다 차면 금빛 테두리
  cooldownBox(x, y, s, k, key, label, border, rem = 0) {
    const g = this.g, u = this.u;
    this.panel(x, y, s, s);
    if (border) { g.fillStyle = border; g.fillRect(x, y + s - 2 * u, s, 2 * u); }
    if (k < 1) {
      g.fillStyle = 'rgba(0,0,0,0.74)';
      g.beginPath(); g.moveTo(x + s / 2, y + s / 2);
      g.arc(x + s / 2, y + s / 2, s * 0.7, -Math.PI / 2 + k * Math.PI * 2, Math.PI * 1.5); g.closePath();
      g.save(); g.beginPath(); g.rect(x + u, y + u, s - 2 * u, s - 2 * u); g.clip();
      g.beginPath(); g.moveTo(x + s / 2, y + s / 2); g.arc(x + s / 2, y + s / 2, s, -Math.PI / 2 + k * Math.PI * 2, Math.PI * 1.5); g.closePath(); g.fill();
      g.restore();
      if (rem > 0.05) { // 남은 시간: 칸 가운데 크게, 키 이름은 왼쪽 위에 작게
        this.text(rem >= 3 ? String(Math.ceil(rem)) : rem.toFixed(1), x + s / 2, y + s / 2 + u, u + 1, '#ffffff', 'center', true, true);
        this.text(key, x + 3 * u, y + 5 * u, Math.max(1, u - 1), '#a89cb8', 'left', true, true);
        return;
      }
    } else {
      g.fillStyle = 'rgba(255,207,90,0.16)'; g.fillRect(x + u, y + u, s - 2 * u, s - 2 * u);
      g.strokeStyle = '#ffcf5a'; g.lineWidth = u; g.strokeRect(x + 1.5 * u, y + 1.5 * u, s - 3 * u, s - 3 * u);
    }
    this.text(key, x + s / 2, y + s / 2, key.length > 1 ? Math.max(1, u - 1) || 1 : u, k >= 1 ? '#ffe8a8' : '#8a8098', 'center', true, true);
  }

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
    const dot = (x, y, c, r = 1.5) => { const tx = x / TILE - ox, ty = y / TILE - oy; if (tx < 0 || ty < 0 || tx * s > mw || ty * s > mh) return; g.fillStyle = c; g.fillRect(Math.round(mx + tx * s - r * u), Math.round(my + ty * s - r * u), r * 2 * u, r * 2 * u); };
    const seen = (x, y) => w.explored[Math.floor(y / TILE) * w.tw + Math.floor(x / TILE)];
    for (const o of w.objects) {
      if (o.kind === 'questThing') { if (Math.floor(w.t * 3) % 2 === 0) dot(o.x, o.y, '#ffe040', 2.2); continue; }
      if (!seen(o.x, o.y)) continue;
      if (o.kind === 'portal') dot(o.x, o.y, o.color, 2);
      else if (o.kind === 'chest' && !o.opened && o.spotted) dot(o.x, o.y, o.rich ? '#d8a8ff' : '#ffcf5a'); // 상자는 내 눈으로 본 것만 지도에
      else if (o.kind === 'lore' && !o.opened) dot(o.x, o.y, '#8ad8ff');
      else if (o.kind === 'camp') dot(o.x, o.y, '#ffa040', 2);
      else if (o.kind === 'merchant') dot(o.x, o.y, '#7be38a', 2);
      else if (o.kind === 'shrine' && !o.opened) dot(o.x, o.y, '#c9a8ff');
      else if (o.kind === 'stairs') dot(o.x, o.y, '#ff6040', 2);
      else if (o.kind === 'journal' && !o.read) dot(o.x, o.y, '#f0e0b0', 2);
      else if (o.kind === 'npc') dot(o.x, o.y, '#7be38a', 2);
      else if (o.kind === 'barrier' && !o.opened) dot(o.x, o.y, '#d07a4a', 1.5);
      else if (o.kind === 'sanctum') dot(o.x, o.y, SANCTUMS[o.race]?.color || '#fff', 2.2);
      else if (o.kind === 'waypoint') dot(o.x, o.y, o.active ? '#8ad8ff' : '#6a6478', o.active ? 2 : 1.4);
      else if (o.kind === 'entrance') dot(o.x, o.y, '#e8dcc0', 1.8);
      else if (o.kind === 'relic' && !o.opened) dot(o.x, o.y, SANCTUMS[o.race]?.color || '#fff', 1.4);
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
// 효과(mods) → 사람이 읽는 글
const pctS = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const MOD_TEXT = {
  dmgMul: (v) => `주는 피해 ${pctS(v - 1)}`, dmgTakenMul: (v) => `받는 피해 ${pctS(v - 1)}`, moveSpeed: (v) => `이동 속도 ${pctS(v - 1)}`, atkSpeed: (v) => `공격 속도 ${pctS(v - 1)}`,
  cdRate: (v) => `스킬 재사용 대기 -${Math.round((1 - 1 / v) * 100)}%`, regen: (v) => `초당 체력 ${(v * 100).toFixed(1)}% 회복`, crit: (v) => `치명타 확률 ${pctS(v)}`, dodge: (v) => `공격을 ${Math.round(v * 100)}% 확률로 피한다`,
  lifesteal: (v) => `준 피해의 ${v}%만큼 체력 회복`, reflect: (v) => `받은 피해의 ${v}%를 되돌려준다`, pres: (v) => `물리 저항 +${v}`, mres: (v) => `마법 저항 +${v}`, projRange: (v) => `투사체 사거리 ${pctS(v - 1)}`,
  breath: (v) => `물속 숨 ×${v}`, luck: (v) => `귀한 물고기 · 부산물 확률 ${pctS(v)}`,
};
function fogSprites() { // 네 모서리(0 밝음 · 1 어둠)를 이어 칸 안을 채운 16가지 점묘 그림
  const out = [];
  for (let m = 0; m < 16; m++) {
    const c = document.createElement('canvas'); c.width = c.height = TILE;
    const g = c.getContext('2d'), img = g.createImageData(TILE, TILE), d = img.data, a00 = m & 1, a10 = (m >> 1) & 1, a01 = (m >> 2) & 1, a11 = (m >> 3) & 1;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const u = (x + 0.5) / TILE, v = (y + 0.5) / TILE, a = (a00 * (1 - u) + a10 * u) * (1 - v) + (a01 * (1 - u) + a11 * u) * v;
      const q = Math.max(0, Math.min(4, Math.floor(a * 4 + BAYER4[y & 3][x & 3] - 0.5)));
      if (!q) continue;
      const i = (y * TILE + x) * 4; d[i] = 5; d[i + 1] = 4; d[i + 2] = 10; d[i + 3] = Math.round(q * 63.75);
    }
    g.putImageData(img, 0, 0); out.push(c);
  }
  return out;
}
function modLines(mods) { return Object.entries(mods || {}).filter(([k]) => MOD_TEXT[k]).map(([k, v]) => MOD_TEXT[k](v)); }
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

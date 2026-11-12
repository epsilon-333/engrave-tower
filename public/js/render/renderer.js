// 캔버스 렌더러: world 상태를 읽어서 그리기만 한다 (게임 로직 없음)
// 화면 크기에 맞춰 정수 배율(S)로 도트를 키우고, 글씨는 실제 해상도로 따로 그린다.
import { hexA } from './color.js';
export { hexA };
import { opts } from '../settings.js';
import { TILE, T_LIQUID, T_WALL, T_CRACK, T_BUILD, T_DEEP } from '../sim/mapgen.js';
import { paintTile, drawOutdoorProp, renderChunk, CHUNK, drawRelic, drawSign, drawTurtle } from './outdoor.js';
import { renderInterior, drawInteriorProp } from './interior.js';
import { drawNode, drawDig, drawToolAt, swingAngle, drawFishing, drawSoil, drawCrop } from './lifefx.js';
import { iconCanvas } from './icons.js';
import { GOODS, FISH } from '../data/goods.js';
import { SANCTUMS } from '../data/sanctums.js';
import { drawLeader, drawResident, drawVfx, drawFlyers, drawTrainTarget, drawTrainBoard, drawQuestThing, drawTrainHud, drawBubbles, drawBonePile } from './village.js';
import { LANDMARK_BOX } from './landmarks.js';
import { PixelCtx } from './pixelctx.js';
import { flameSprite, puffSprite, sparkSprite, dustSprite, BAYER4 } from './pxfx.js';
import { spiritSprite } from './spirits.js';
import { G } from '../data/maps/overworld.js';
import { beastImg } from './beasts.js';
import { getSprite, drawEchoGem } from './sprites.js';
import { sprite, frames, atlas } from './assets.js';
import { renderMap, hash } from './tiles.js';
import { ECHOES, AFFIXES } from '../data/monsters.js';
import { ITEMS, OFF_LOOK } from '../data/items.js';
import { SKILLS, ELEM } from '../data/skills.js';
import { RACE_ART, MONSTER_ART, NPC_ART, weaponArt, RACE_LOOK } from '../data/art.js';
import { BOSS_PASSIVES } from '../data/tower.js';
import { SkillAnims, drawMiasma, RARITY_ANIM, PAL } from './skillanim.js';
export const GROUND_MARKS = new Set(['ink', 'cracks', 'scorch', 'scrape', 'rageCracks']); // 그 가운데 땅에 새겨지는 것 (벽 · 물 · 허공에는 안 생긴다)
export const GROUND_FX = new Set(['ink', 'tcircle', 'tdonut', 'lineTele', 'cracks', 'scorch', 'scrape', 'castCircle', 'rune', 'glyphs', 'rageCracks', 'path']); // 바닥에 그리는 이펙트
const BOSS_MELEE = new Set(['combo', 'cleave', 'whirl', 'shove', 'charge', 'leap', 'jumps3', 'quake', 'grab', 'retreat']);
const SHEET_LOOKS = ['saturate(1.25) contrast(1.1) brightness(1.08)', 'saturate(1.5) contrast(1.3) brightness(0.92)']; // 보스 시트 2 · 3단계: 색을 돌리지 않고 진하게만
export const PASSIVE_NAME = Object.fromEntries(Object.entries(BOSS_PASSIVES).map(([k, v]) => [k, v.name]));
import { STORY_ITEMS, pinoTalk } from '../data/story.js';
import { sfx } from '../audio.js';
import { drawClimbObject } from './climbfx.js';
import { drawTowerFloor, drawTowerOver, drawLightPillar, introPose } from './towerfx.js';

export const FONT = 'Galmuri11, "Malgun Gothic", sans-serif';
export const GLOW = { mirrorShard: [16, '#e8f4ff'], lightShard: [18, '#ffe8a0'], starDust: [14, '#c8d8ff'], glowshroom: [26, '#5affd0'], candle: [30, '#ffb04a'], brazier: [46, '#ffa040'], ember: [18, '#ff7a2a'], crystalB: [22, '#7ad8ff'], crystalR: [22, '#ff5a2a'], glowPlant: [24, '#7af0ff'] };
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
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
export const CLASS_MAGIC = { chronomancer: '#b98aff', necromancer: '#7ae8ff', hexer: '#c45cff', spiritcaller: '#9bffb0', dragonSage: '#ff9a4a' };
export const WORD_NAME = { fire: '불', sky: '하늘', scale: '비늘', wing: '날개', earth: '대지' };
// 용언 문장: 첫 단어는 꾸밈말, 둘째는 주어, 셋째는 끝말이 되어 한 줄의 용의 말이 된다
const WORD_PHRASE = {
  fire: ['타오르는', '불꽃이', '불사른다'], sky: ['드높은', '하늘이', '내리친다'], scale: ['굳센', '비늘이', '감싼다'],
  wing: ['날랜', '날개가', '휘몰아친다'], earth: ['깊은', '대지가', '뒤흔든다'],
};
export const sentenceLine = (ws) => `${WORD_PHRASE[ws[0]]?.[0] || ''} ${WORD_PHRASE[ws[1]]?.[1] || ''} ${WORD_PHRASE[ws[2]]?.[2] || ''}`.trim();
export const WORD_COLOR = { fire: '#ff7a2a', sky: '#ffcf5a', scale: '#ffb066', wing: '#bfffd0', earth: '#c8a878' };

// 리치(해골 마법사): 금빛 왕관 · 보라 눈 · 금빛 어깨 갑옷과 보석 · 찢어진 검은 로브 (팔은 따로 그려 움직인다)
const LICH_ROWS = [
  '.........KK.........',
  '........KYGK........',
  '...K....KGGK....K...',
  '..KGK..KGYGGK..KGK..',
  '..KGGK.KGGGGK.KGGK..',
  '...KGGKKGPPGKKGGK...',
  '....KGGGGPPGGGGK....',
  '....KgGGGGGGGGgK....',
  '....KBBBBBBBBBBK....',
  '....KBBBBBBBBBbK....',
  '....KBKKBBBBKKbK....',
  '....KBKPKBBKPKbK....',
  '....KBBKBBBBKBbK....',
  '....KBBBBKKBBBbK....',
  '.....KBKBKBKBbK.....',
  '.....KKBKBKBKKK.....',
  '..KKKKKKbbbbKKKKKK..',
  '.KGGGGGKBBBBKGGGGGK.',
  '.KGYGGgKBKKBKgGGYGK.',
  '..KGGgKBBPPBBKgGGK..',
  '...KKKKBKPPKBKKKK...',
  '....KRKBBBBBBKRK....',
  '....KRKKBKKBKKRK....',
  '....KRRKgGGgKRRK....',
  '...KRRRKGPPGKRRRK...',
  '...KRrRRKggKRRrRK...',
  '...KRrRRRRRRRRrRK...',
  '..KRRrRRgRRgRRrRRK..',
  '..KRRrRRgRRgRRrRRK..',
  '..KRRrRgGRRGgRrRRK..',
  '.KRRrRRgRRRRgRRrRRK.',
  '.KRKRrKRRKKRRKrRKRK.',
  '.K.KRK.KRK.KRK.KRK..',
  '....K...K....K...K..',
];
const LICH_PAL = { K: '#141018', G: '#d8b048', g: '#8a6a28', Y: '#fff0a0', B: '#e8e0c8', b: '#a89c84', P: '#c070ff', R: '#2a2030', r: '#4a3c58' };
const lichCache = {};
function lichSprite(frame, flip) { // frame 0~3: 로브 자락이 흔들린다
  const key = frame + (flip ? 'f' : '');
  if (lichCache[key]) return lichCache[key];
  const c = document.createElement('canvas'); c.width = 22; c.height = LICH_ROWS.length; const g = c.getContext('2d');
  LICH_ROWS.forEach((row, y) => {
    const sh = y >= 29 ? Math.round(Math.sin(frame * Math.PI / 2 + y * 0.6) * (y - 28) * 0.5) : 0;
    for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = LICH_PAL[ch]; g.fillRect((flip ? 19 - x : x) + 1 + sh, y, 1, 1); }
  });
  return (lichCache[key] = c);
}

// 스킬 역할 그림 (7×7, # = 색 · o = 흰 빛)
export const ROLE_GLYPH = {
  공격: ['......o', '.....#.', '....#..', '.#.#...', '..#....', '.#.#...', '#......'],
  연타: ['#..#..#', '.#..#..', '..#..#.', '.#..#..', '#..#..#', '.......', '.......'].map((r, i) => i < 5 ? r : '.......'),
  이동: ['...#...', '....#..', '#######', '....#..', '...#...', '.......', '.......'].map((r, i, a) => a[(i + 6) % 7]),
  방어: ['.#####.', '#ooooo#', '#o###o#', '#o###o#', '.#o#o#.', '..#o#..', '...#...'],
  제어: ['.##.##.', '#..#..#', '#..#..#', '.##.##.', '...#...', '..#.#..', '.#...#.'],
  마무리: ['...#...', '..#o#..', '#######', '.#ooo#.', '..#o#..', '.#.#.#.', '#.....#'],
  궁극: ['#.#.#.#', '#######', '#o#o#o#', '#######', '.#####.', '.......', '.......'].map((r, i, a) => a[(i + 6) % 7]),
  강화: ['...#...', '..###..', '.#####.', '...#...', '...#...', '..###..', '.......'],
  준비: ['.......', '.#####.', '#.ooo.#', '#.o#o.#', '#.ooo.#', '.#####.', '.......'],
  소환: ['.#####.', '#.....#', '#o#.#o#', '#.....#', '.#.#.#.', '..###..', '.......'],
  장판: ['.......', '.......', '.#####.', '#ooooo#', '.#####.', '.......', '.......'],
  전환: ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'],
};
import { HudMethods } from './hud.js';
import { FxMethods } from './fxdraw.js';
import { EventMethods } from './events.js';
import { AtmosMethods } from './atmosphere.js';
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
    this.alerts = new Map(); this.hpShow = new Map(); this.healFx = new Map(); this.squash = new Map(); this.chestOpen = new Map(); this.lunge = new Map();
    this.shake = 0; this.banner = null; this.hitstop = 0; this.fade = 1; this.hurtFlash = 0; this.flash = null; this.ultName = null;
    this.cam = { x: 0, y: 0 };
    this.anims = new SkillAnims(this); // 스킬 애니메이션 (render/skillanim.js)
    this.world = null; this.lastStep = 0;
    this.resize(document.documentElement.clientWidth || innerWidth, document.documentElement.clientHeight || innerHeight, devicePixelRatio || 1);
  }

  resize(cssW, cssH, dpr) {
    const k = Math.min(dpr, Math.sqrt((1920 * 1080) / Math.max(1, cssW * cssH))); // 화면 그림은 1920×1080칸까지 (고해상도 · 전체 화면에서 큰 판을 매 프레임 칠하느라 느렸다 · 브라우저가 늘려 보여 준다)
    const W = Math.round(cssW * k), H = Math.round(cssH * k);
    this.c.width = W; this.c.height = H;
    this.baseS = Math.max(2, Math.round(Math.min(W, H) / 270)); // 짧은 변 기준: 어느 화면비든 짧은 쪽으로 약 270칸이 보인다 (긴 변 기준이면 휴대폰 세로 · 21:9에서 시야가 좁아졌다)
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
    if (w.climb) this.fade = 0.5; // 탑의 층: 문을 지나면 어둠에서 밝아진다
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
    this.fx = []; this.texts = []; this.parts = []; this.corpses = []; this.ambient = []; this.alerts.clear(); this.hpShow.clear(); this.healFx.clear(); this.squash.clear(); this.chestOpen.clear();
    this.banner = null; this.fade = 1;
    this.cam.x = w.player.x - this.VW / 2; this.cam.y = w.player.y - this.VH / 2;
    this.fog = document.createElement('canvas'); this.fog.width = w.tw; this.fog.height = w.th;
    this.fg = this.fog.getContext('2d');
    this.fg.fillStyle = '#05040a'; this.fg.fillRect(0, 0, w.tw, w.th);
    this.mini = document.createElement('canvas'); this.mini.width = w.tw; this.mini.height = w.th;
    this.mg = this.mini.getContext('2d');
    if (w.map.outdoor) this.silhouette(w); // 바깥 세계: 안 가 본 곳도 땅 · 바다 윤곽만 흐리게 (무엇이 있는지는 가 봐야 보인다)
    this.applyReveal(true);
    if (w.zone) this.banner = w.map.outdoor ? { text: w.zone.name, sub: '어디로든 갈 수 있다. 저 멀리 탑이 보인다.', t: 3.6, color: '#ffe8a8' } : { text: `${w.zone.floor}층 · ${w.zone.name}`, sub: '몬스터는 지역마다 무리지어 산다. 탐험하라.', t: 3.2, color: '#ffe8a8' };
    this.glowDeco = w.map.deco.filter((d) => GLOW[d.kind]);
    this.notes = []; this.vista = null;
    if (w.mapKnown) this.knowMap(w);
  }

  silhouette(w) {
    const img = this.mg.createImageData(w.tw, w.th), d = img.data;
    for (let i = 0; i < w.tw * w.th; i++) {
      const t = w.tiles[i], sea = t === T_DEEP || t === T_LIQUID, c = sea ? [12, 18, 32] : t === T_WALL ? [30, 30, 34] : [34, 40, 36];
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    this.mg.putImageData(img, 0, 0);
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
    const fight = w.enemies?.some((e) => !e.dead && !e.npcRef && Math.hypot(e.x - p.x, e.y - p.y) < 220);
    if (fight) this.note(`레벨 업! Lv ${level} · 스탯 포인트 +${pts} (C 캐릭터)`, '#ffe080'); // 싸우는 중에는 화면 가운데를 가리지 않게 작게
    else this.banner = { text: `레벨 업!  Lv ${level}`, sub: `스탯 포인트 +${pts} · C 캐릭터 창에서 나눈다`, t: 3, color: '#ffe080' };
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
    if (!this.chunkFresh && (this.chunkTurn = ((this.chunkTurn || 0) + 1) % 3) === 0) { // 미리 그리기는 세 프레임에 한 조각 (조각 하나가 5~7ms라 연달아 그리면 걷는 내내 버벅였다)
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
    this.juice(ev.x + Math.cos(ev.ang || 0) * 10, ev.y - 8 + Math.sin(ev.ang || 0) * 6, col === '#ffffff' ? '#ffe08a' : col, ev.ult ? 'ultCast' : 'cast', 26);
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
    // 보통 스킬은 이름 글자를 띄우지 않는다 (아래 스킬 칸에 이미 있다 · 싸움 화면이 글자로 덮이지 않게). 궁극기만 위에서 크게
  }

  // 탑의 무기 등급 연출: 등급이 높을수록 화려하게 (희귀 반짝임 → 영웅 충격파 · 불티 → 전설 금빛 빛살 · 떠오르는 불씨 → 신화 두 겹 충격파 · 화면 번쩍 · 별빛 폭발)
  rarityFx(ev, col) { // 그 등급의 표식 하나만 (아래 등급 표식을 겹쳐 쌓으면 무기마다 같은 덩어리로 섞여 보였다)
    const r = ev.rar, rc = ['#c8c0d0', '#7ac4ff', '#c890ff', '#ffc84a', '#ff5a7a'][r], R = Math.max(24, ev.r || 30);
    this.anims.add(RARITY_ANIM[r], { x: ev.x, y: ev.y, r: R * (0.8 + 0.12 * r), col: rc });
    if (r >= 3) this.shake = Math.max(this.shake, r);
    if (r >= 4) this.hitstop = Math.max(this.hitstop, 0.05);
  }

  // 범위 스킬 연출 (맞는 쪽)
  // lite: 평타 · 맞음 · 처치로 저절로 터지는 무기 · 장비 효과 — 같은 모습을 작게, 화면 흔들림 · 멈칫 · 번쩍임 없이, 등급 표식은 한 겹만
  aoeFx(ev) {
    if (!ev.lite) return this.aoeFxFull(ev);
    // 저절로 터지는 효과: 큰 폭발 그림 대신 작은 타격 — 원소 색 불꽃이 튀고 짧게 빛난다 (높은 등급은 반짝임 하나)
    const col = ELEM[ev.elem]?.color && ev.elem !== 'phys' ? ELEM[ev.elem].color : '#ffe8b0', R = Math.min(30, (ev.r || 30) * 0.55);
    this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 2, r: R * 0.6, color: col, t: 0.14, max: 0.14 });
    this.fx.push({ k: 'glow', x: ev.x, y: ev.y - 6, r: R, color: col, t: 0.18, max: 0.18 });
    this.sparkBurst(ev.x, ev.y - 4, col, 6);
    if (ev.elem === 'fire') for (let i = 0; i < 5; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * R, y: ev.y - 4, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30, t: 0.4, max: 0.4, g: -40, flame: true, size: 1, color: '#ffffff' });
    else if (ev.elem === 'ice') for (let i = 0; i < 5; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * R, y: ev.y - 6, vx: (Math.random() - 0.5) * 40, vy: -10, t: 0.5, max: 0.5, color: '#e8f8ff', g: 30, glow: true, size: 1 });
    else if (ev.elem === 'lightning') for (let i = 0; i < 4; i++) this.parts.push({ x: ev.x, y: ev.y - 8, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 120, t: 0.12, max: 0.12, color: '#ffffff', g: 0, line: true });
    if (ev.rar >= 3) this.anims.add('glint', { x: ev.x, y: ev.y, r: R, col: ['#c8c0d0', '#7ac4ff', '#c890ff', '#ffc84a', '#ff5a7a'][ev.rar] });
    sfx('hit', { vol: 0.3, rate: 1.2 });
  }
  // 무기 스킬(우클릭)의 무기 종류 표식: 같은 원소라도 칼은 X자 베기, 망치는 땅이 갈라지고, 활은 화살비, 지팡이는 문양이 터진다
  weaponSig(ev) {
    const rar = ev.rar || 0, c = ev.wcat, col = ELEM[ev.elem]?.color && ev.elem !== 'phys' ? ELEM[ev.elem].color : ['#f4f0ff', '#cfe6ff', '#e4cfff', '#ffe6a0', '#ffc0cc'][rar], r = Math.max(26, ev.r || 30) * (1 + 0.12 * rar), A = this.anims, x = ev.x, y = ev.y;
    // 등급이 높을수록: 표식이 커지고(+12%/등급) · 영웅부터 한 번 더 · 전설부터 등급 색 충격파와 불티 · 신화는 화면이 번쩍이고 테두리가 물든다
    if (rar >= 2) setTimeout(() => { if (this.world) this.weaponSig({ ...ev, rar: 0, r: (ev.r || 30) * 0.8 }); }, 140);
    if (rar >= 3) { const rc = ['#c8c0d0', '#7ac4ff', '#c890ff', '#ffc84a', '#ff5a7a'][rar]; this.shockwave(x, y, r * 1.1, rc, 36); this.burst(x, y - 6, rc, 24, 170); }
    if (rar >= 4) { this.flash = { color: '255,220,230', t: 0.16, max: 0.16 }; this.rimFlash = { color: '#ff5a7a', t: 0.5, max: 0.5 }; this.hitstop = Math.max(this.hitstop, 0.06); this.shockwave(x, y, r * 1.5, '#ffffff', 44); }
    switch (c) {
      case 'blade': A.add('bladeArc', { x, y, ang: -0.7, range: r, angle: 2.4, col }); A.add('bladeArc', { x, y, ang: Math.PI + 0.7, range: r, angle: 2.4, col, max: 0.34 }); break;
      case 'great': A.add('bladeArc', { x, y, ang: Math.PI / 2, range: r * 1.15, angle: 3.4, col }); break;
      case 'axe': A.add('cracks', { x, y, r, col }); this.burst(x, y, '#a89880', 14, 120); break;
      case 'blunt': A.add('cracks', { x, y, r: r * 1.1, col }); break;
      case 'scythe': A.add('bladeArc', { x, y, ang: 0, range: r, angle: 6.1, col }); break;
      case 'polearm': A.add('shardBurst', { x, y, r: r * 0.8, col }); break;
      case 'whip': A.add('gale', { x, y, r: r * 0.8, col }); break;
      case 'fist': this.shockwave(x, y, r * 0.9, col, 22); break;
      case 'shield': this.shockwave(x, y, r * 0.9, col, 26); break;
      case 'bow': case 'tube': A.add('arrowRain', { x, y, r: r * 0.8 }); break;
      case 'throw': A.add('rockRain', { x, y, r: r * 0.7, col: '#c8c0b0' }); break;
      case 'staff': A.add('runeBurst', { x, y, r, col }); break;
      case 'tome': A.add('runeBurst', { x, y, r, col, implode: true }); break;
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

  // ───── 손맛: 세기를 셋으로 나눈다 (평타 < 스킬 < 궁극기). 평타는 작게 두어야 스킬이 돋보인다 ─────
  // 손맛: 흔들림 · 맞는 순간 멈춤만 (빛 번짐 · 반짝이는 없앴다 — 그림은 pixelfx 이펙트가 맡는다). 세기는 평타 < 스킬 < 궁극기
  juice(x, y, col, tier) {
    const big = tier === 'ult' || tier === 'ultCast';
    if (tier === 'cast' || tier === 'pop') return;
    this.shake = Math.max(this.shake, big ? 9 : 3); this.hitstop = Math.max(this.hitstop, big ? 0.1 : 0.035);
  }
  hitPop(x, y, col, lv) { // 맞는 자리: 평타 · 보통 스킬은 작은 타격 불꽃(절반 크기), 치명타는 큰 불꽃
    if (lv === 2) { this.anims.px.add('impacts/hit-spark', x, y + 4, { scale: 0.95, max: 0.5, floor: 0, rot: (Math.random() - 0.5) * 0.6 }); this.sparkBurst(x, y - 4, '#fff09a', 5); } // 치명타: 큰 타격 불꽃 (예전 crit-hit은 둘레에 큰 고리가 퍼져 싸울 때마다 내 둘레에 원이 생겼다)
    else if (this.anims.px.list.length < 10) this.anims.px.add('impacts/hit-spark', x, y + 4, { scale: lv ? 0.7 : 0.5, max: 0.45, floor: 0, rot: (Math.random() - 0.5) * 0.6 });
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
  // 급하지 않은 큰 알림(처음 주운 물건 · 깨달음 · 새 기술): 싸우는 중이면 미뤘다가 조용해지면 보여 준다
  calmBanner(b) { (this.calmQueue ||= []).push(b); }
  inCombat(w) {
    const p = w.player;
    return !!w.climb?.boss && !w.climb.boss.dead || w.enemies.some((e) => !e.dead && !e.hidden && e.state === 'chase' && Math.hypot(e.x - p.x, e.y - p.y) < 220);
  }
  draw(w, dt) {
    if (this.calmQueue?.length && !this.banner && !this.inCombat(w)) this.banner = this.calmQueue.shift();
    const main = this.mainG, S = this.S, VW = this.VW, VH = this.VH;
    const p = w.player;
    const foc = this.camFocus?.t > 0 ? this.camFocus : null; if (foc) foc.t -= dt; // 보스 등장: 카메라가 보스를 비춘다
    let tx = foc ? foc.x - VW / 2 : p.x - VW / 2 + (p.aimX || 0) * 16, ty = foc ? foc.y - VH / 2 : p.y - VH / 2 + (p.aimY || 0) * 10;
    { // 보스 층: 보스 쪽으로 조금 당기고, 큰 보스의 머리가 화면 위로 잘리지 않게 (나는 화면 아래 40px 안쪽에 남는다)
      const bo = !foc && w.climb?.boss && !w.climb.boss.dead ? w.climb.boss : null;
      if (bo && Math.abs(bo.y - p.y) < VH && Math.abs(bo.x - p.x) < VW) {
        const top = bo._top ?? bo.y - 90;
        tx += (bo.x - p.x) * 0.25; ty += ((top + bo.y) / 2 - p.y) * 0.25;
        const hud = 96 / (this.S || 1); // 화면 위 보스 체력바 높이만큼 비운다
        if (top - hud < ty) ty = Math.max(top - hud, p.y - VH + 40);
      }
    }
    if (!Number.isFinite(this.cam.x) || !Number.isFinite(this.cam.y)) { this.cam.x = tx; this.cam.y = ty; } // 카메라가 한 번 NaN이 되면 조준 → 카메라로 계속 번지므로 바로 되돌린다
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);
    const mw = w.tw * TILE, mh = w.th * TILE;
    this.cam.x = mw <= VW ? (mw - VW) / 2 : Math.max(0, Math.min(mw - VW, this.cam.x));
    this.cam.y = mh <= VH ? (mh - VH) / 2 : Math.max(0, Math.min(mh - VH, this.cam.y));
    this.shake = Math.max(0, this.shake - dt * 22);
    // 카메라는 1배 칸에 맞춘다 (세계를 칸 단위로 그려서, 움직이는 것과 바닥이 서로 떨리지 않게)
    const shk = this.shake * opts.shake; // 설정: 화면 흔들림 세기
    const cx = Math.round(this.cam.x + (Math.random() - 0.5) * shk);
    const cy = Math.round(this.cam.y + (Math.random() - 0.5) * shk);
    this.cx = cx; this.cy = cy;

    let g = this.g = this.wg;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0a080e'; g.fillRect(0, 0, VW, VH);
    this.worldTf(g);
    g.imageSmoothingEnabled = false;
    if (w.map.outdoor) { this.drawChunks(w, cx, cy); this.drawOutdoorLife(w, cx, cy); if (w.farmRect && w.life) for (const [key, pl] of Object.entries(w.life.farm)) { const [fx, fy] = key.split(',').map(Number); drawSoil(g, fx, fy, !!pl.wateredAt, w.t); } }
    else g.drawImage(this.mapCanvasNight && (this.nightK || 0) > 0.42 ? this.mapCanvasNight : this.mapCanvas, 0, 0);
    this.drawLiquidAnim(w, cx, cy);
    if (w.climb) drawTowerFloor(this, w, g, cx, cy); // 톱니 띠 · 별자리 · 시계 문자판 · 하늘 · 바뀔 칸 예고
    if (w.map.ship) this.drawSailing(w);
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
    for (const c of w.clouds) { // 독구름: 고인 독 · 감겨 오르는 안개 · 터지는 거품 (적의 것은 누런 독)
      const al = Math.min(1, c.t / 0.5, (c.max - c.t) / 0.3 + 0.2);
      drawMiasma(g, c.x, c.y, c.r, w.t, al, (c.x * 13 + c.y * 7) % 97 | 0, c.owner === 'p' ? undefined : ['#4a3a10', '#a8902a', '#e8d070', '#fff4c0'], this);
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
    // 바닥 이펙트는 지형을 따른다: 땅에 새기는 것(갈라짐 · 그을음 · 먹물 · 긁힌 자국)은 걸을 수 있는 땅에만, 예고 원 · 마법진은 벽 위로만 안 보이게
    this.clipTiles(w, cx, cy, true); this.anims.drawGround(g, dt); this.drawFx(w, dt, true, true); g.restore();
    this.clipTiles(w, cx, cy, false); this.drawFx(w, dt, true, false); g.restore();
    // 엔티티 (y 정렬)
    const vis = (x, y) => x > cx - 48 && x < cx + VW + 48 && y > cy - 48 && y < cy + VH + 64;
    const list = [];
    for (const o of w.objects) if (vis(o.x, o.y)) list.push({ o, y: o.kind === 'gate' ? -1e9 : o.sortY ?? o.y }); // sortY: 처형대 위 사람처럼 바닥보다 높이 선 것
    for (const dr of w.drops) list.push({ dr, y: dr.y });
    for (const e of w.enemies) if (vis(e.x, e.y)) list.push({ e, y: e.y });
    for (const c of this.corpses) list.push({ c, y: c.y });
    list.push({ p, y: p.y });
    for (const rp of w.remotes || []) if (vis(rp.x, rp.y)) list.push({ rp, y: rp.y }); // 온라인: 같은 지도의 다른 사람
    for (const al of w.allies || []) list.push({ al, y: al.y });
    if (w.map.props) for (const pr of w.map.props) { const px = (pr.x + pr.w / 2) * TILE, py = (pr.y + pr.h) * TILE, big = pr.kind !== 'tree' && pr.kind !== 'well' && pr.kind !== 'house'; if (pr.big ? Math.abs(px - (cx + VW / 2)) < VW / 2 + 240 && py > cy - 40 && py < cy + VH + 460 : big ? Math.abs(px - (cx + VW / 2)) < VW / 2 + 140 && py > cy - 40 && py < cy + VH + 260 : vis(px, py - 40)) list.push({ prop: pr, y: py - 2 }); }
    if (w.map.plaza) for (const d of w.map.wallDeco) list.push({ wd: d, y: -1e9 + 1 });
    if (w.farmRect && w.life) for (const [key, pl] of Object.entries(w.life.farm)) if (pl.crop) { const [fx, fy] = key.split(',').map(Number); if (vis(fx * TILE + 8, fy * TILE + 8)) list.push({ crop: { x: fx, y: fy, pl }, y: fy * TILE + 13 }); }
    this.anims.px.update(dt); for (const pe of this.anims.px.list) list.push({ pxe: pe, y: (pe.sortY ?? pe.y) + 2 }); // 스킬 이펙트(pixelfx)도 같은 줄에: 앞에 선 건물이 가린다
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.pxe) this.anims.px.drawOne(g, it.pxe);
      else if (it.p) { this.drawPlayer(w, p, dt); if (p.webT > 0) drawWeb(g, p.x, p.y, w.t, Math.min(1, p.webT * 3)); } // 거미줄에 묶였다: 몸에 감긴 실
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
    this.anims.draw(this.g, dt);

    if (w.climb) drawTowerOver(this, w, g, cx, cy); // 회오리 · 시간 칼날 · 되감기 잔상 · 고래 그림자 · 돌풍 예고
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
      } else if (q.streak) { // 꼬리 불똥: 빛을 더하며 그린다 (가운데는 희게)
        const L = 0.045, x2 = q.x - q.vx * L, y2 = q.y - q.vy * L;
        g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        g.strokeStyle = hexA(q.color, a * 0.8); g.lineWidth = q.w + 1; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(x2, y2); g.stroke();
        g.strokeStyle = hexA('#ffffff', a * 0.9); g.lineWidth = Math.max(0.8, q.w - 0.7); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo((q.x + x2) / 2, (q.y + y2) / 2); g.stroke();
        g.globalCompositeOperation = 'source-over'; g.lineCap = 'butt';
      } else if (q.chunk) { // 돌 파편: 떨어져 바닥에서 한 번 튄다
        if (q.y > q.floor && q.vy > 0) { q.y = q.floor; q.vy *= -0.35; q.vx *= 0.6; }
        q.vx /= 0.9; q.vy /= 0.9; q.vx *= 0.985; // 공기 저항은 약하게
        g.fillStyle = hexA('#1a1410', a * 0.5); g.fillRect(Math.round(q.x), Math.round(q.floor + 1), 2, 1);
        g.fillStyle = hexA(q.color, a); g.fillRect(Math.round(q.x - 1), Math.round(q.y - 1), 2, 2); g.fillStyle = hexA('#c8b8a0', a); g.fillRect(Math.round(q.x - 1), Math.round(q.y - 1), 1, 1);
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
    if (w.locks?.regions.size && w.map.regions) this.drawSeals(w, dt); // 해방되지 않은 지역: 보랏빛 안개
    if (w.mode === 'field' && !w.map.outdoor && !w.map.ship) { this.drawLight(w, cx, cy); this.drawFog(w, cx, cy); } // 바깥 세계는 화면을 가리지 않는다 (안 가 본 곳은 지도에서만)

    // 1배 세계 판을 화면 배율로 키워 옮긴다 (도트 그대로). 글씨 · 화면 표시는 그 위에 실제 해상도로
    this.g = g = main;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.drawImage(this.lo, 0, 0, VW * S, VH * S);
    this.drawTexts(w, dt);
    drawBubbles(this, w);
    this.drawHud(w, dt);
    if (this.fade > 0) { const g2 = this.g; g2.setTransform(1, 0, 0, 1, 0, 0); g2.fillStyle = `rgba(5,4,10,${Math.min(1, this.fade / 0.5)})`; g2.fillRect(0, 0, this.c.width, this.c.height); this.fade -= Math.min(dt, 0.05); }
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

  // 항해 중: 바다 물결 · 거품이 뒤(왼쪽)로 흘러가 배가 나아가는 것처럼 보인다. 싸우는 동안은 배가 멈춘다
  drawSailing(w) {
    const g = this.g, v = w.voyage, spd = v && !v.fighting ? 70 : 8, W = w.tw * TILE, H = w.th * TILE;
    const st = (this.sailFx ||= { off: 0, foam: [] });
    st.off = (st.off + spd / 60) % 64;
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let y = 8; y < H; y += 22) for (let x = -64 + ((y * 7) % 64); x < W + 64; x += 64) {
      const xx = Math.round(x - st.off), yy = y + Math.round(Math.sin((x + y) * 0.05 + w.t * 1.5) * 2);
      g.fillRect(xx, yy, 14, 1); g.fillRect(xx + 4, yy + 1, 8, 1);
    }
    if (Math.random() < 0.6) st.foam.push({ x: W * 0.86 + Math.random() * 30, y: (12.5 + (Math.random() < 0.5 ? -6.6 : 6.6)) * TILE + Math.random() * 6 - 3, t: 2.4 });
    g.fillStyle = 'rgba(235,248,255,0.65)';
    for (const f of st.foam) { f.t -= 1 / 60; f.x -= spd / 60 * 1.6; const k = Math.max(0, f.t / 2.4); g.globalAlpha = k * 0.8; g.fillRect(Math.round(f.x), Math.round(f.y), 3 + Math.round((1 - k) * 6), 1); }
    g.globalAlpha = 1;
    st.foam = st.foam.filter((f) => f.t > 0);
    const A = v?.approach; if (A) this.drawApproach(w, A, W, H); // 다가오는 배 · 바다뱀
  }
  // 수평선에서 다가오는 것: 해적선(검은 돛 · 해골) · 상선(흰 돛) · 바다뱀(물결 사이 등지느러미)
  drawApproach(w, A, W, H) {
    const g = this.g, k = Math.min(1, A.t / A.dur), x = Math.round(W + 60 - k * (W * 0.12 + 110)), y = Math.round(12.5 * TILE + Math.sin(w.t * 1.2) * 3), s = 0.55 + k * 0.45;
    if (A.id === 'serpent') {
      for (let i = 0; i < 4; i++) { const bx = x + i * 14 * s, by = y + Math.sin(w.t * 3 + i) * 3; g.fillStyle = '#1a3a3a'; g.beginPath(); g.ellipse(bx, by, 7 * s, 4 * s, 0, Math.PI, 0); g.fill(); g.fillStyle = '#3a7a6a'; g.beginPath(); g.ellipse(bx, by, 6 * s, 3 * s, 0, Math.PI, 0); g.fill(); }
      g.fillStyle = 'rgba(235,248,255,0.6)'; for (let i = 0; i < 3; i++) g.fillRect(x - 6 + i * 20 * s, y + 2, 6, 1);
      return;
    }
    if (A.id === 'castaway') { // 뗏목 위의 표류자
      g.fillStyle = '#1a1410'; g.fillRect(x - 13, y - 2, 26, 6); g.fillStyle = '#8a6a3a'; g.fillRect(x - 12, y - 1, 24, 4); g.fillStyle = '#5a4028'; for (let i = -10; i <= 10; i += 5) g.fillRect(x + i, y - 1, 1, 4);
      g.fillStyle = '#1a1410'; g.fillRect(x - 3, y - 12, 6, 10); g.fillStyle = '#c8a07a'; g.fillRect(x - 2, y - 11, 4, 4); g.fillStyle = '#6a8ab8'; g.fillRect(x - 2, y - 7, 4, 5);
      if (Math.floor(w.t * 2) % 2) { g.fillStyle = '#c8a07a'; g.fillRect(x + 2, y - 15, 1, 4); } // 손을 흔든다
      return;
    }
    const pirate = A.id === 'pirates';
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 10, 40, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1410'; g.beginPath(); g.moveTo(-40, 0); g.lineTo(40, 0); g.lineTo(30, 10); g.lineTo(-32, 10); g.closePath(); g.fill();
    g.fillStyle = pirate ? '#3a2418' : '#6a4a2a'; g.fillRect(-36, 1, 70, 6); g.fillStyle = pirate ? '#5a3a24' : '#8a6a3a'; g.fillRect(-36, 1, 70, 2);
    g.fillStyle = '#2a1a10'; g.fillRect(-2, -46, 3, 46); g.fillRect(-22, -32, 2, 32);
    const sail = pirate ? '#1a1a22' : '#ece4d0', edge = pirate ? '#3a3a48' : '#c8bca0';
    g.fillStyle = edge; g.fillRect(-16, -44, 30, 26); g.fillStyle = sail; g.fillRect(-15, -43, 28, 24);
    g.fillStyle = edge; g.fillRect(-32, -30, 20, 18); g.fillStyle = sail; g.fillRect(-31, -29, 18, 16);
    if (pirate) { g.fillStyle = '#e8e0c8'; g.fillRect(-4, -36, 6, 5); g.fillRect(-3, -31, 4, 2); g.fillStyle = '#1a1a22'; g.fillRect(-3, -35, 1, 1); g.fillRect(0, -35, 1, 1); g.fillStyle = '#c02020'; g.fillRect(0, -54, 8, 4); } // 해골 · 붉은 깃발
    else { g.fillStyle = '#ffd76a'; g.fillRect(0, -54, 8, 4); }
    g.restore();
  }

  drawLiquidAnim(w, cx, cy) {
    if (!w.zone || w.zone.liquid === 'void') return; // 하늘 정원의 하늘은 물결이 아니다 (towerfx의 drawSky가 그린다)
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

  // 몬스터 그림: 내 모습을 비추는 거울 보스 · 8종족 옛 전사(나올 때 정한 종족)는 그때그때 고른다
  enemyArt(w, e) {
    const art = MONSTER_ART[e.defId] || { base: 'goblin' };
    if (art.mirrorPlayer) return { ...art, base: (RACE_ART[e.mirrorRace || w.b?.race] || RACE_ART.knight).base };
    if (art.raceLook) return { ...art, base: RACE_LOOK[e.raceLook] || RACE_LOOK.knight };
    return art;
  }
  // 보스 시트: 지금 하는 일에 맞는 자세 그림 하나를 통째로 (조각을 움직이지 않는다)
  // 서기 = 두 자세를 천천히 번갈아 (숨쉬기) · 걷기 = 두 자세를 빠르게 · 내려치기 · 돌진 · 도약 = 공격 자세 · 그 밖의 큰 기술 = 기술 자세
  // 보스 시트 그림 고르기. 걷기는 「걸은 거리」로 넘기고(발이 미끄러지지 않게), 잠깐 멈춘 것은 걷기로 둔다(깜빡이지 않게),
  // 자세가 바뀌면 그 줄의 첫 장면부터, 공격 · 기술이 끝나면 마지막 장면을 잠깐 붙든 뒤 서기로
  bossFrame(w, e, art) {
    const base = art.phase3 && e.bphase >= 2 ? art.phase3 : art.base;
    const M = (e._bm ||= { lx: e.x, ly: e.y, lt: w.t, still: 1, dist: 0, kind: 'idle', kT: w.t, last: null, endT: -9 });
    { // 얼마나 걸었나 (그릴 때마다 · 순간이동은 걸음으로 치지 않는다)
      const d = Math.hypot(e.x - M.lx, e.y - M.ly), dtt = Math.max(0, w.t - M.lt);
      if (d < 48) M.dist += d;
      M.still = d > 0.15 ? 0 : M.still + dtt; M.lx = e.x; M.ly = e.y; M.lt = w.t;
    }
    const charging = e.mv?.k === 'charge' && e.mv.t <= e.mv.run; // 돌진: 달리는 그림을 빠르게
    let kind;
    if (e.introT > 0) kind = 1 - e.introT / (e.introMax || 1) > 0.55 ? 'skill' : 'idle'; // 등장: 마지막에 포효 자세
    else if (e.soaring || e.morphT > 0) kind = 'skill';
    else if (charging) kind = 'run';
    else if (e.mv) kind = art.skl?.includes(e.mv.k) ? 'skill' : art.atk?.includes(e.mv.k) ? 'attack' : BOSS_MELEE.has(e.mv.k) ? 'attack' : 'skill'; // 보스마다 그림에 맞춘 줄
    else if (art.mirrorSkill && e.mirrorT > 0) kind = 'skill'; // 반사 방패: 방패가 빛나는 그림
    else if (e.windT > 0 || this.lunge.has(e.id)) kind = 'attack';
    else kind = M.still < 0.15 ? 'run' : 'idle'; // 0.15초 넘게 멈춰야 선 자세
    const full = !!atlas[`${base}_hit_anim_f0`]; // 보내 주신 동작 시트가 있는 보스 (맞음 · 쓰러짐까지)
    if (full && !e.mv && !(e.introT > 0) && (e.exposedT > 0 || e.st?.stun > 0)) kind = 'hit'; // 기절 · 빈틈: 맞은 자세
    // 공격 · 기술이 막 끝났으면 마지막 장면을 0.15초 붙든다 (뚝 끊기지 않게)
    if ((kind === 'idle' || kind === 'run') && (M.kind === 'attack' || M.kind === 'skill') && M.last) { if (M.endT < 0) M.endT = w.t; if (w.t - M.endT < 0.15) return M.last; }
    if (kind !== M.kind) { M.kind = kind; M.kT = w.t; M.endT = -1; if (kind === 'run') M.dist = 0; }
    const fr = frames(base, kind), since = w.t - M.kT;
    let name;
    if (kind === 'run') { const stride = Math.max(8, (e.r || 10) * 0.9) * (charging ? 1.6 : 1) / 2; name = fr[Math.floor(M.dist / stride) % fr.length]; } // 한 장면 = 몇 px 걸음 (사이 그림이 들어가 장면이 두 배: tools/boss_tween.py)
    // 넘기는 빠르기는 사이 그림을 넣은 뒤의 장수 기준 (원래 장면 하나 = 두 장)
    else if (kind === 'attack') name = full ? (e.windT > 0 || fr.length < 2 ? fr[0] : fr[Math.min(fr.length - 1, 1 + Math.floor(since * 18))]) // 준비 자세는 예고 동안 그대로 → 내려치기 · 따라가기 한 번
      : fr.length >= 3 ? (e.windT > 0 ? fr[0] : fr[1 + (Math.floor(since * 12) % (fr.length - 1))]) : fr[Math.floor(since * 4) % fr.length];
    else if (kind === 'skill') name = full ? fr[Math.min(fr.length - 1, Math.floor(since * 12))] : fr[Math.floor(since * 3) % fr.length]; // 기술: 차례로 넘기고 마지막 장면을 끝까지
    else name = fr[Math.floor(since * (fr.length >= 8 ? 4.8 : 2.8)) % fr.length]; // 서기 · 맞음: 자세가 바뀐 때부터 첫 장면
    if (kind === 'attack' || kind === 'skill') M.last = name;
    return name;
  }
  drawEnemy(w, e, dt) {
    const g = this.g, def = e.def;
    if (e.npcRef) { e._top = null; return; } // 화난 NPC는 NPC 그림으로 그린다
    if (e.remote) { this.drawRemote(w, { ...e.rp, x: e.x, y: e.y, dir: e.dir, moving: e.moving, flash: e.hitFlash }); e._top = e.y - 18; return; }
    if (def.ai === 'dummy') return this.drawDummy(w, e);
    if (def.ai === 'target') return drawTrainTarget(this, w, e);
    if (e.bones > 0) return drawBonePile(this, w, e); // 수련: 쓰러진 해골이 뼈 무더기로 (곧 다시 일어선다)
    const art = this.enemyArt(w, e);
    if (e.blinkAt != null && w.t - e.blinkAt < 0.16) { e._top = e.y - 40; return; } // 순간이동: 잠깐 비웠다가 도착 자리에 모인다 (blink 연출)
    if (e.passives && dt > 0) { // 보스 기운: 몸 둘레에서 피어오르는 독 방울 · 서리 알갱이 · 불티 (고리는 그리지 않는다)
      const au = e.passives.includes('burnAura') ? '#ff8a3a' : e.passives.includes('frostAura') ? '#cfefff' : e.passives.includes('poisonAura') ? '#9be15d' : null;
      if (au && Math.random() < 0.5) { const a = Math.random() * Math.PI * 2, rr = e.r + 10 + Math.random() * 50; this.parts.push({ x: e.x + Math.cos(a) * rr, y: e.y + Math.sin(a) * rr * 0.6, vx: 0, vy: -14 - Math.random() * 18, t: 0.9, max: 0.9, color: au, g: -4, glow: true, size: 1.5 }); }
      if (e.bphase >= 1 && Math.random() < (e.bphase >= 2 ? 0.6 : 0.3)) this.parts.push({ x: e.x + (Math.random() - 0.5) * e.r * 2, y: e.y - Math.random() * e.r * 2, vx: 0, vy: -30, t: 0.6, max: 0.6, color: '#ff5a3a', g: -10, flame: true, size: e.bphase >= 2 ? 1.8 : 1.3 });
      if (e.bphase >= 2 && Math.random() < 0.25) this.parts.push({ x: e.x + (Math.random() - 0.5) * e.r * 1.6, y: e.y - Math.random() * e.r, vx: (Math.random() - 0.5) * 10, vy: -16, t: 1.0, max: 1.0, color: '#1a1020', g: -4, puff: true, size: 3 });
    }
    if (e.soaring && art.ghostSoar) { // 망령 기사단장 혼령화: 하늘로 날아가지 않고 유령 그림(기술 줄)으로 그 자리에서 흐려진다 · 맞지 않는다
      const fr = sprite(this.bossFrame(w, e, art), '', false, e.dir < 0);
      if (fr) { this.shadow(e.x, e.y + 3, fr.width * 0.25); g.globalAlpha = 0.55 + 0.2 * Math.sin(w.t * 9); g.drawImage(fr, Math.round(e.x - fr.width / 2), Math.round(e.y + 4 - fr.height)); g.globalAlpha = 1; }
      if (dt > 0 && Math.random() < 0.5) this.parts.push({ x: e.x + (Math.random() - 0.5) * 30, y: e.y - Math.random() * 50, vx: 0, vy: -24, t: 0.7, max: 0.7, color: '#7ab0ff', g: -6, puff: true, size: 2 });
      e._top = e.y - 70; return;
    }
    if (e.soaring) { // 날아오름: 몸이 웅크렸다 하늘로 솟구쳐 화면 밖으로 · 땅에는 작아졌다 커지는 그림자 (떨어질 때는 뛰어내리기 동작이 이어 받는다)
      const up = 2.6 - (e.mv?.t ?? 0), k = Math.min(1, up / 0.4), sc = art.sheet ? 1 : (art.scale || 1) * (e.scale || 1);
      const fr = sprite(art.sheet ? this.bossFrame(w, e, art) : this.animFrame(art.base, 'idle', w.t, 6), e.tintX || art.tint || '', false, e.dir < 0) || sprite(frames('goblin', 'idle')[0], '', false, e.dir < 0);
      const shK = Math.max(0.25, 1 - k * 0.75);
      g.fillStyle = `rgba(0,0,0,${0.12 + 0.22 * shK})`; ellipse(g, e.x, e.y + 3, e.r * 1.2 * shK, e.r * 0.45 * shK);
      if (fr && k < 1) { const off = k * k * 260, sq = up < 0.08 ? 0.8 : 1; g.drawImage(fr, Math.round(e.x - fr.width * sc / 2), Math.round(e.y + 4 - fr.height * sc * sq - off), Math.round(fr.width * sc), Math.round(fr.height * sc * sq)); }
      if (up < 0.05 && dt > 0) for (let i = 0; i < 8; i++) this.parts.push({ x: e.x + (Math.random() - 0.5) * e.r * 2, y: e.y + 3, vx: (Math.random() - 0.5) * 40, vy: -8, t: 0.6, max: 0.6, color: '#a89880', g: 0, puff: true, size: 4 }); // 박차는 순간 먼지
      e._top = null; return;
    }
    if (e.under) { // 땅굴 기습: 땅속을 파고 다가오는 흙 고랑
      const bump = Math.abs(Math.sin(w.t * 9 + e.phase)) * 1.2;
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, e.x, e.y + 3, 9, 3);
      g.fillStyle = '#5a4a36'; ellipse(g, e.x, e.y + 1 - bump, 8, 3.5); g.fillStyle = '#8a7a5e'; ellipse(g, e.x - 2, e.y - bump, 4, 1.6);
      if (dt > 0 && Math.random() < 0.5) this.parts.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 20, t: 0.4, max: 0.4, color: '#7a6448', g: 300, chunk: true, floor: e.y + 3 });
      e._top = null; return;
    }
    if (e.hidden) {
      // 땅속 잠복: 흙더미만 보인다
      const bump = Math.sin(w.t * 3 + e.phase) * 0.6;
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, e.x, e.y + 3, 8, 3);
      g.fillStyle = '#5a4a36'; ellipse(g, e.x, e.y + 1 + bump, 7, 3.5);
      g.fillStyle = '#7a6a4e'; ellipse(g, e.x - 1, e.y + bump, 4, 2);
      e._top = null;
      return;
    }
    if (e.morphT > 0) e.morphT -= dt;
    const sc = art.sheet ? (e.morphT > 0 ? 1 + 0.06 * Math.sin((1 - e.morphT / 0.9) * Math.PI) : 1) // 보스 시트: 도트 그대로 1:1 (키우면 번진다)
      : (art.scale || 1) * (e.scale || 1) * (e.morphT > 0 ? 1 + 0.18 * Math.sin((1 - e.morphT / 0.9) * Math.PI) : 1);
    const name = art.sheet ? this.bossFrame(w, e, art) : this.animFrame(art.base, e.moving ? 'run' : 'idle', w.t + e.phase, e.moving ? 10 : 6);
    const wind = e.windT > 0;
    const fuse = e.fuse > 0;
    const flash = e.hitFlash > 0 ? true : ((wind && (!e.pose || e.windT < 0.22)) || fuse) && Math.floor(w.t * (fuse ? 30 : 20)) % 2 ? (fuse ? '#ffffff' : '#ff4040') : false; // 몸 기술: 준비 동작이 보이게 마지막 순간에만 번쩍
    // 그림이 없으면 투명해지지 않도록 고블린 그림으로 대체
    const pose = e.pose && art.beast ? e.pose.k : wind ? 'wind' : e.moving ? 'walk' : 'idle', bf = Math.floor((w.t + e.phase) * (e.pose?.k === 'crouch' ? 10 : e.moving || art.fly ? 9 : 3)) % 4; // 몸 기술 동작은 그 동작 그림으로
    const img = art.beast ? beastImg(art.beast, pose, bf, e.dir < 0, flash, e.tintX || art.tint || '')
      : art.mimic ? sprite(e.dormant ? 'chest_full_open_anim_f0' : `chest_mimic_open_anim_f${e.moving || wind ? 1 + (Math.floor(w.t * 8) % 2) : 2}`, '', flash, e.dir < 0)
      : art.sheet ? sprite(name, e.mirrorT > 0 && !art.mirrorSkill ? 'grayscale(1) brightness(1.75) contrast(1.4)' : [art.tint || '', ...SHEET_LOOKS][(e.bphase || 0)] + (art.tint && e.bphase ? ' ' + art.tint : ''), // 큰 보스: 맞으면 살짝 밝아지기만 (몸 전체가 흰 덩어리가 되지 않게)
        e.morphT > 0 && Math.floor(w.t * 24) % 2 ? 'rgba(255,255,255,0.45)' : (this.healFx.get(e.id)?.t > 0 || e.mv?.k === 'channel') && Math.floor(w.t * 8) % 2 ? 'rgba(120,255,140,0.34)' : e.wardT > w.t ? 'rgba(150,205,255,0.24)' : e.thornsT > w.t && Math.floor(w.t * 10) % 2 ? 'rgba(240,220,180,0.3)' : flash === true ? 'rgba(255,255,255,0.32)' : flash ? 'rgba(255,60,40,0.26)' : false, e.dir < 0)
      : sprite(name, e.mirrorT > 0 ? 'grayscale(1) brightness(1.75) contrast(1.4)' : e.tintX || art.tint || '', e.morphT > 0 && Math.floor(w.t * 24) % 2 ? '#ffffff' : flash, e.dir < 0) || sprite(frames('goblin', 'idle')[0], '', flash, e.dir < 0);
    if (!img) return;
    { const hf = this.healFx.get(e.id); if (hf) { hf.t -= dt; if (hf.t <= 0) this.healFx.delete(e.id); } } // 회복 번쩍임 시간
    if (dt > 0 && e.thornsT > w.t && Math.random() < 0.7) { const a = Math.random() * Math.PI * 2, r = (e.r || 10) * 1.6; this.parts.push({ x: e.x + Math.cos(a) * r, y: e.y - 14 + Math.sin(a) * r * 0.8, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30, t: 0.22, max: 0.22, color: Math.random() < 0.5 ? '#f0e0c0' : '#a89078', g: 0, size: 2 }); } // 가시 세움: 몸에서 가시 조각이 튄다
    if (dt > 0 && e.wardT > w.t && Math.random() < 0.6) { const a = Math.random() * Math.PI * 2, r = (e.r || 10) * 1.8; this.parts.push({ x: e.x + Math.cos(a) * r, y: e.y - 16 + Math.sin(a) * r * 0.7, vx: -Math.sin(a) * 20, vy: Math.cos(a) * 14 - 6, t: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#bfe8ff' : '#7ab8ff', g: -4, size: 2 }); } // 화살 막이: 둘레를 도는 푸른 빛
    if (e.mv?.k === 'channel' && dt > 0) { // 회복 의식: 둘레의 초록 기운이 보스에게 빨려 든다 · 발밑이 초록으로 밝다
      for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 30, x = e.x + Math.cos(a) * r, y = e.y - 10 + Math.sin(a) * r * 0.6, T = 0.55; this.parts.push({ x, y, vx: (e.x - x) / T, vy: (e.y - 16 - y) / T, t: T, max: T, color: i ? '#7be38a' : '#d8ffc0', g: 0, size: 2 }); }
      g.fillStyle = `rgba(123,227,138,${0.16 + 0.08 * Math.sin(w.t * 8)})`; ellipse(g, e.x, e.y + 3, (e.r || 10) * 2.6, (e.r || 10) * 0.9);
    }
    if (art.sheet) { // 돌진: 지나온 자리에 옅은 잔상 셋 · 발밑에 이는 흙먼지 (순간이동처럼 보이지 않게)
      const tr = (e._trail ||= []);
      if (e.mv?.k === 'charge' && e.mv.t <= e.mv.run) {
        if (!tr.length || w.t - tr[tr.length - 1].t > 0.05) { tr.push({ x: e.x, y: e.y, t: w.t, img }); if (tr.length > 3) tr.shift(); }
        if (dt > 0 && Math.random() < 0.7) this.parts.push({ x: e.x + (Math.random() - 0.5) * e.r * 1.4, y: e.y + 3, vx: -Math.cos(e.mv.ang) * (30 + Math.random() * 30), vy: -6 - Math.random() * 10, t: 0.45, max: 0.45, color: '#b8a888', g: -2, puff: true, size: 2 });
      }
      for (const q of tr) { const a = 0.3 * (1 - (w.t - q.t) / 0.25); if (a > 0) { g.globalAlpha = a; g.drawImage(q.img, Math.round(q.x - q.img.width / 2), Math.round(q.y + 4 - q.img.height)); } }
      g.globalAlpha = 1; e._trail = tr.filter((q) => w.t - q.t < 0.25);
    }
    let sq = art.sheet ? 0 : this.squash.get(e.id) || 0; // 보스 시트 그림은 찌그러뜨리지 않는다 (통째로 그린 그림이 늘어나 보이지 않게)
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
    const ip = e.introT > 0 ? introPose(this, w, e) : null; // 보스 등장: 떨어져 내린다 · 솟는다 · 모인다
    this.shadow(e.x, e.y + 3, Math.max(5, img.width * sc * 0.32) * (ip ? Math.max(0.2, ip.shadow) : 1));
    if (art.ghost) g.globalAlpha = 0.65 + 0.15 * Math.sin(w.t * 3 + e.phase);
    if (def.veil && !(e.revealT > 0)) g.globalAlpha = 0.13 + 0.05 * Math.sin(w.t * 5 + e.phase); // 지워진 기록: 맞기 전에는 거의 보이지 않는다
    const carryLift = e.carried > 0 ? 18 + (w.player.air || 0) : 0;
    const flyUp = art.fly ? 6 + Math.sin(w.t * 3 + e.phase) * 2 : 0; // 나는 몬스터는 땅 위에 떠 있다
    const dx = Math.round(e.x - w0 / 2 + wobble), dy = Math.round(e.y + 4 - h0 - carryLift + lungeY - flyUp - (ip?.lift || 0) + (ip?.sink || 0) * h0);
    if (ip) { g.globalAlpha *= ip.alpha; if (ip.sink > 0) { g.save(); g.beginPath(); g.rect(dx - 4, dy - 4, Math.round(w0) + 8, Math.round(e.y + 4 - dy) + 4); g.clip(); } }
    const bp = e.pose ? beastPose(e.pose, e.dir || 1, w.t) : null; // 몸 기술 동작: 몸 전체가 일어서고 · 웅크리고 · 내밀고 · 내려찍는다
    if (bp) {
      g.save(); g.translate(Math.round(e.x + wobble + bp.x), Math.round(e.y + 4 - carryLift - flyUp + bp.y)); g.rotate(bp.rot); g.scale(bp.sx, bp.sy);
      g.drawImage(img, Math.round(-w0 / 2), Math.round(-h0), Math.round(w0), Math.round(h0)); g.restore();
      if (e.pose.k === 'dizzy') for (let i = 0; i < 3; i++) { const a = w.t * 7 + i * 2.1; g.fillStyle = '#ffe060'; g.fillRect(Math.round(e.x + Math.cos(a) * 8), Math.round(dy - 5 + Math.sin(a) * 2), 2, 2); }
      if ((e.pose.k === 'crouch' && e.mv?.k === 'headbutt') && dt > 0 && Math.random() < 0.35) this.parts.push({ x: e.x - (e.dir || 1) * e.r, y: e.y + 3, vx: -(e.dir || 1) * (30 + Math.random() * 40), vy: -20 - Math.random() * 20, t: 0.45, max: 0.45, color: '#a89880', g: 200, puff: true, size: 2 }); // 뒷발로 땅을 긁는 흙먼지
    } else g.drawImage(img, dx, dy, Math.round(w0), Math.round(h0));
    if (ip?.sink > 0) g.restore();
    g.globalAlpha = 1;
    if (e.st.frozen > 0) {
      g.fillStyle = 'rgba(170,225,255,0.5)'; g.fillRect(dx, dy + 2, Math.round(w0), Math.round(h0) - 2);
      g.fillStyle = '#e8f8ff'; g.fillRect(dx + 1, dy + 3, 2, 1); g.fillRect(dx + Math.round(w0) - 4, dy + 6, 2, 1);
    }
    if (e.st.burn && Math.random() < 0.35) this.parts.push({ x: e.x + (Math.random() - 0.5) * w0 * 0.6, y: e.y - h0 * 0.4, vx: 0, vy: -30, t: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffd040', g: -40 });
    if (e.st.poison && Math.random() < 0.15) this.parts.push({ x: e.x + (Math.random() - 0.5) * w0 * 0.6, y: e.y - h0 * 0.3, vx: 0, vy: -15, t: 0.5, max: 0.5, color: '#9be15d', g: -20 });
    if (e.st.bleed && Math.random() < 0.12) this.parts.push({ x: e.x + (Math.random() - 0.5) * w0 * 0.4, y: e.y - h0 * 0.5, vx: 0, vy: 10, t: 0.5, max: 0.5, color: '#c02030', g: 120 });
    e._top = e.y + 4 - h0;
    if (e.def?.boss) e._vis = h0 * (1 - opaqueTop(img)); // 보스: 그림 속 몸의 실제 키 (광선이 가슴께에서 나가게)
    // 체력바: 맞은 뒤 3초 동안만 (무리일 때 막대가 화면을 덮지 않게)
    if (e.hp < e.maxHp && !def.elite && !e.champion && (this.hpShow.get(e.id) ?? 0) > w.t) {
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
      if (al < 0) { // 발견: 노란 느낌표 (정예 · 강화 개체만 — 보통 몬스터까지 띄우면 무리일 때 느낌표 덩어리가 된다)
        this.alerts.set(e.id, al + dt);
        if (def.elite || e.champion || e.affix) this.bang(e.x, e._top - 14 + (al + 0.7) * -6, '#ffd040');
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
    if (art.sheet && atlas[`${art.base}_death_anim_f0`]) { // 보스: 시트의 쓰러지는 장면 → 누운 채 4초 → 흐려진다
      if (!c.sheet) { c.sheet = true; c.t = c.max = 5; this.shake = Math.max(this.shake, 8); }
      c.t -= dt; const el = c.max - c.t, fr = frames(art.base, 'death'), img = sprite(fr[Math.min(fr.length - 1, Math.floor(el * 10))], '', false, c.dir < 0);
      if (!img) return;
      this.shadow(c.x, c.y + 3, img.width * 0.32);
      this.g.globalAlpha = Math.min(1, c.t / 0.8); this.g.drawImage(img, Math.round(c.x - img.width / 2), Math.round(c.y + 4 - img.height)); this.g.globalAlpha = 1;
      return;
    }
    c.t -= dt;
    const el = c.max - c.t, g = this.g, sc = (art.scale || 1) * (c.big ? 1.2 : 1);
    const img = art.beast ? beastImg(art.beast, 'idle', 0, c.dir < 0, false) : sprite(frames(art.base, 'idle')[0], art.tint || '', el < 0.08, c.dir < 0);
    if (!img) return;
    if (c.sky) { this.drawSkyFall(img, c.x, c.y, el / c.max, c.dir, sc); return; } // 하늘로 떨어짐: 허우적대며 작아져 구름 아래로
    const W = img.width * sc, H = img.height * sc, fallT = 0.28, sinkT = c.max - 0.75;
    // 넘어지기: 발을 축으로 뒤쪽(맞은 반대편)으로 90도 · 끝에 살짝 튄다
    const fk = Math.min(1, el / fallT), bounce = fk < 1 ? fk * fk : 1 + Math.sin(Math.min(1, (el - fallT) / 0.18) * Math.PI) * 0.06 * (1 - Math.min(1, (el - fallT) / 0.18));
    const ang = -c.dir * (Math.PI / 2) * Math.min(1.04, bounce);
    if (!c.landed && fk >= 1) { // 땅에 닿는 순간: 먼지 · 작은 흙
      c.landed = true;
      for (let i = 0; i < (c.big ? 14 : 7); i++) this.parts.push({ x: c.x - c.dir * H * 0.5 + (Math.random() - 0.5) * H, y: c.y + 3, vx: (Math.random() - 0.5) * 40, vy: -6 - Math.random() * 10, t: 0.6, max: 0.6, color: '#a89880', g: 0, puff: true, size: c.big ? 4 : 3 });
      if (c.big) this.shake = Math.max(this.shake, 6);
    }
    // 가라앉기: 누운 몸이 땅선 아래로 내려가며 땅선 위로 보이는 부분만 그린다 (가장자리에 흙이 들썩인다)
    const sink = el > sinkT ? Math.min(1, (el - sinkT) / 0.75) : 0, ground = Math.round(c.y + 4);
    g.save();
    if (sink > 0) { g.beginPath(); g.rect(c.x - H - W, ground - H - W, (H + W) * 2, H + W); g.clip(); }
    g.translate(Math.round(c.x), ground + Math.round(sink * W * 0.9));
    g.rotate(ang);
    g.drawImage(img, Math.round(-W / 2), Math.round(-H), Math.round(W), Math.round(H));
    g.restore();
    if (sink > 0 && sink < 1 && Math.random() < 0.6) this.parts.push({ x: c.x - c.dir * H * 0.5 + (Math.random() - 0.5) * H, y: ground - 1, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20, t: 0.35, max: 0.35, color: Math.random() < 0.5 ? '#6a5640' : '#8a7458', g: 300, chunk: true, floor: ground });
  }

  // 하늘로 떨어지는 몸: 발이 미끄러져 휘청 → 몸이 기울며 아래로 빨려 들 듯 작아지고 빙글 돈다 · 바람 줄기가 위로 스쳐 간다
  drawSkyFall(img, x, y, k, dir, sc = 1) {
    const g = this.g, slip = Math.min(1, k / 0.18), fall = Math.max(0, (k - 0.18) / 0.82), e = fall * fall;
    const size = sc * (1 - 0.85 * e), drop = 4 * slip + e * 46, ang = dir * (slip * 0.5 + e * Math.PI * 2.6);
    const W = img.width * size, H = img.height * size;
    if (fall < 1) { g.fillStyle = `rgba(20,30,50,${0.3 * (1 - fall)})`; ellipse(g, x, y + 3, 6 * (1 - fall), 2 * (1 - fall)); } // 가장자리에 남는 그림자 (몸이 멀어지며 작아진다)
    if (size > 0.06) { g.save(); g.translate(Math.round(x), Math.round(y + drop - H * 0.5)); g.rotate(ang); g.drawImage(img, Math.round(-W / 2), Math.round(-H / 2), Math.round(W), Math.round(H)); g.restore(); }
    if (fall > 0 && fall < 0.9 && Math.random() < 0.7) this.parts.push({ x: x + (Math.random() - 0.5) * 20, y: y + drop + 6, vx: 0, vy: -160 - Math.random() * 80, t: 0.18, max: 0.18, color: '#eef8ff', g: 0, line: true });
  }
  drawPlayer(w, p, dt) {
    const g = this.g;
    if (p.skyFall) { const art0 = RACE_ART[w.b.race], im = sprite(this.animFrame(art0.base, 'run', w.t, 16), art0.tint || '', false, p.dir < 0); if (im) this.drawSkyFall(im, p.skyFall.x, p.skyFall.y, Math.min(1, p.skyFall.t / p.skyFall.dur), p.skyFall.spin); return; } // 하늘로 떨어지는 중 (허우적대는 달리기 그림)
    if (this.castGather && dt > 0) { // 시전 중: 둘레에서 손끝으로 빨려 드는 원소 알갱이 (끝으로 갈수록 빽빽하게)
      const cg = this.castGather; cg.t -= dt;
      if (cg.t <= 0 || !(p.castT > 0)) this.castGather = null;
      else { const hx = p.x + p.dir * 7, hy = p.y - 12, k = 1 - cg.t / cg.max; for (let i = 0; i < 1 + Math.round(k * 3); i++) { const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 10; this.parts.push({ x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * r / 0.28, vy: -Math.sin(a) * r * 0.7 / 0.28, t: 0.26, max: 0.26, color: Math.random() < 0.3 ? '#ffffff' : cg.color, g: 0, glow: true, size: 1 }); } }
    }
    if (p.dashT > 0 && dt > 0) { const sk = this.anims.curSkid; if (sk && sk.t < 0.4) { const L = sk.pts[sk.pts.length - 1]; if (Math.hypot(p.x - L.x, p.y + 4 - L.y) >= 2) sk.pts.push({ x: p.x, y: p.y + 4 }); if (Math.random() < 0.5) this.parts.push({ x: p.x, y: p.y + 4, vx: (Math.random() - 0.5) * 10, vy: -6, t: 0.4, max: 0.4, color: '#b0a088', g: 0, puff: true, size: 2 }); } } // 구르는 동안: 미끄러진 자국을 잇고 흙먼지
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
    const busy = p.gather || p.fish, hideW = busy || p.swim || p.riding || blink; // 헤엄칠 때는 무기를 들지 않는다 · 무적 깜빡임은 무기 · 방패도 함께 (몸만 사라져 칼이 떠 보이지 않게)
    if (p.boat) this.drawBoat(w, p.x, p.y, p.dir, p.moving, 'back');
    if (w.map.underwater && dt > 0 && Math.random() < dt * 1.6) this.parts.push({ x: bx + p.dir * 3, y: by - 14, vx: (Math.random() - 0.5) * 6, vy: -26 - Math.random() * 14, t: 1.4, max: 1.4, color: '#e0f6ff', g: -6, bubble: true });
    const wart = weaponArt(w.b.weaponId, ITEMS);
    if ((wart.shield || w.b.wcat === 'shield') && !hideW) this.drawShield(w, p, pose, bx, by, gs);
    else if (w.b.offItem && !hideW) this.drawOffhand(w, p, pose, bx, by, gs); // 왼손 도구 (한손 무기일 때)
    if (pose.kind === 'fist' && !hideW) { const back = pose.punch > 0.05 && pose.offhand; this.fistAt(w, bx - p.dir * (back ? -1 : 4) * gs, by - (back ? 7 : 5) * gs, this.fistMetal(wart), p.dir); }
    if (pose.behind && !hideW) this.drawWeapon(w, p, pose, bx, by, gs);
    let rideY = 0;
    if (p.riding) { // 탄 랩터: 달리면 달리기 동작, 서 있으면 숨쉬기 · 위로 들썩인다
      const rmov = p.moving && p.dashT <= 0, rf = this.animFrame('raptor_mount', rmov ? 'run' : 'idle', rmov ? p.walkT * 1.4 : w.t, rmov ? 14 : 5);
      const rimg = sprite(rf, '', p.hitFlash > 0 ? '#ff6060' : false, p.dir < 0);
      const bounce = rmov ? Math.round(Math.abs(Math.sin(p.walkT * 9)) * 1.5) : 0;
      if (rimg) g.drawImage(rimg, Math.round(p.x - rimg.width / 2 + p.dir * 2), Math.round(p.y + 6 - rimg.height - bounce));
      rideY = 11 + bounce; // 엉덩이가 안장(발에서 7px 위)에 닿게 앉힌다 — 몸 그림은 발이 by+5
    }
    const sink = p.swim ? by - 7 : p.boat ? by - 1 : p.riding ? by - rideY : null; // 탄 사람의 다리는 랩터 몸에 가린다
    if (sink != null) { g.save(); g.beginPath(); g.rect(bx - 30, by - 80, 60, sink - (by - 80)); g.clip(); if (p.riding) g.translate(0, -rideY); }
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
    if (!blink && w.b.offItem && !hideW && OFF_LOOK[String(w.b.offId).split('#')[0]] === 'xbow') this.drawOffhand(w, p, pose, bx, by, gs, 'front'); // 손쇠뇌는 몸 앞에
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
    if (f.phase === 'wait') { g.globalAlpha = 0.75; this.text('찌가 가라앉으면 G', px, py - 8 * u, Math.max(1, u - 1), '#d8e8f4', 'center'); g.globalAlpha = 1; return; }
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
    const g = this.g, dir = p.dir, id = w.b.offId, look = OFF_LOOK[String(id).split('#')[0]], O = '#16121c';
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
    if (al.whelp) { // 아기 용: 작은 붉은 용이 파닥거리며 따라온다
      const x = Math.round(al.x), y = Math.round(al.y + Math.sin(w.t * 6) * 2), f = Math.sin(w.t * 18) > 0, d = w.player.x < al.x ? -1 : 1;
      g.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(g, x, al.y + 14, 6, 2);
      g.fillStyle = '#1a0c0a'; g.fillRect(x - 6, y - 4, 12, 8); g.fillStyle = '#d8482a'; g.fillRect(x - 5, y - 3, 10, 6); g.fillStyle = '#ffb060'; g.fillRect(x - 3, y, 6, 2);
      g.fillStyle = '#1a0c0a'; g.fillRect(x + d * 4, y - 8, 6 * d, 6); g.fillStyle = '#e8582a'; g.fillRect(x + d * 5, y - 7, 4 * d, 4); g.fillStyle = '#ffe080'; g.fillRect(x + d * 7, y - 6, 1, 1);
      g.fillStyle = '#a8301a'; if (f) { g.fillRect(x - 9, y - 9, 6, 5); g.fillRect(x + 3, y - 9, 6, 5); } else { g.fillRect(x - 10, y - 2, 6, 3); g.fillRect(x + 4, y - 2, 6, 3); }
      g.fillStyle = '#d8482a'; g.fillRect(x - d * 9, y + 1, 4, 2);
      if (Math.random() < 0.15) this.parts.push({ x: x + d * 9, y: y - 5, vx: d * 20, vy: -6, t: 0.4, max: 0.4, color: '#ff9a3a', g: -10 });
      return;
    }
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
    if (al.kind === 'lichMage') { this.drawLich(w, al, fade); return; }
    if (al.kind === 'grasper') { // 붙잡는 망령: 떠서 흔들리고, 기를 모을수록 손을 든다
      const img = beastImg('grasper', (al.chg || 0) > 3.5 ? 'wind' : 'idle', Math.floor(w.t * 5 + al.id) % 4, (al.dir || 1) < 0, false);
      const fy = Math.sin(w.t * 2.4 + al.id) * 2;
      this.shadow(al.x, al.y + 4, 5);
      g.globalAlpha = 0.85 * fade; g.drawImage(img, Math.round(al.x - img.width / 2), Math.round(al.y - img.height - 4 + fy)); g.globalAlpha = 1;
      if (al.maxHp && al.hp < al.maxHp) { const bw = 16, by = Math.round(al.y - img.height - 8 + fy); g.fillStyle = '#0d0b10'; g.fillRect(al.x - bw / 2 - 1, by - 1, bw + 2, 4); g.fillStyle = '#7ae8ff'; g.fillRect(al.x - bw / 2, by, Math.max(0, bw * al.hp / al.maxHp), 2); }
      al._top = al.y - img.height - 4;
      if ((al.chg || 0) > 0 && Math.random() < 0.1 + 0.15 * (al.chg / 5)) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: al.x + Math.cos(a) * 16, y: al.y - 14 + Math.sin(a) * 10, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 20, t: 0.5, max: 0.5, color: '#9ae8ff', g: 0, glow: true }); }
      return;
    }
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

  // 리치: 몸은 픽셀 그림, 팔은 뼈 · 금빛 손톱으로 따로 그려 동작마다 움직인다 (쏠 때 앞으로 · 해골을 일으킬 때 두 팔을 든다)
  drawLich(w, al, fade) {
    const g = this.g, dir = al.dir || 1, fr = Math.floor(w.t * 5 + al.id) % 4, img = lichSprite(fr, dir < 0);
    const bob = Math.sin(w.t * 2.2 + al.id) * 1.5, x0 = Math.round(al.x - 11), y0 = Math.round(al.y + 4 - img.height + bob);
    this.shadow(al.x, al.y + 4, 8);
    const cast = Math.max(0, al.castT || 0) / 0.35, lift = Math.max(0, al.liftT || 0) / 0.9;
    const arm = (side) => { // side 1 = 보는 쪽 팔
      const sx = al.x + side * dir * 7, sy = y0 + 18;
      let a = Math.PI / 2 + side * dir * 0.5; // 아래로 비스듬히
      if (lift > 0) a = -Math.PI / 2 + side * dir * 0.45; // 두 팔을 머리 위로
      else if (cast > 0 && side === 1) a = dir > 0 ? -0.15 : Math.PI + 0.15; // 앞으로 뻗는다
      a += Math.sin(w.t * 2 + side) * 0.08;
      const ex = sx + Math.cos(a) * 9, ey = sy + Math.sin(a) * 9;
      g.save(); g.lineCap = 'round'; g.strokeStyle = '#141018'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = '#e8e0c8'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = '#d8b048'; for (const da of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + Math.cos(a + da) * 3.5, ey + Math.sin(a + da) * 3.5); g.stroke(); } // 금빛 갈고리 손톱
      g.restore();
      if ((cast > 0 && side === 1) || lift > 0) { this.glow(ex, ey, 5, '#c070ff', 0.6); if (Math.random() < 0.4) this.parts.push({ x: ex, y: ey, vx: (Math.random() - 0.5) * 16, vy: -14, t: 0.4, max: 0.4, color: '#c070ff', g: -10, glow: true }); }
    };
    g.globalAlpha = fade;
    arm(-1);
    g.drawImage(img, x0, y0);
    arm(1);
    g.globalAlpha = 1;
    this.glow(al.x + dir * 0, y0 + 11, 4, '#c070ff', 0.35 + 0.15 * Math.sin(w.t * 5)); // 빛나는 눈
    this.glow(al.x, y0 + 20, 3, '#c070ff', 0.3);
    if (Math.random() < 0.12) this.parts.push({ x: al.x + (Math.random() - 0.5) * 14, y: al.y + 2, vx: 0, vy: -8, t: 0.8, max: 0.8, color: '#6a2aa8', g: -4, glow: true }); // 발밑 보라 안개
    if (al.maxHp && al.hp < al.maxHp) { const bw = 18, by = y0 - 4; g.fillStyle = '#0d0b10'; g.fillRect(al.x - bw / 2 - 1, by - 1, bw + 2, 4); g.fillStyle = '#c070ff'; g.fillRect(al.x - bw / 2, by, Math.max(0, bw * al.hp / al.maxHp), 2); }
    al._top = y0;
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
    { // pixelfx 탄: 불은 불덩이(꼬리를 끄는 불꽃), 나머지는 그 속성 색의 플라스마 덩이 — 평타 · 정령 탄은 작게
      const el0 = pr.elem || (pr.skind === 'fireball' ? 'fire' : pr.skind === 'icerock' || pr.skind === 'ice' ? 'ice' : pr.skind === 'arcane' ? 'arcane' : null);
      if (!pr.pxe) {
        const fire = el0 === 'fire', small = pr.kind === 'orb' || pr.skind === 'spiritBolt' || pr.weaponHit;
        pr.pxe = this.anims.px.add(fire ? 'fire/fireball' : 'projectiles/plasma-shot', pr.x, pr.y, { palette: fire ? undefined : PAL[el0] || (pr.skind === 'spiritBolt' ? PAL.forest : PAL.arcane), scale: small ? 0.45 : pr.big || pr.skind === 'fireball' ? 0.9 : 0.65, floor: 0, max: 99 }) || 'none';
      }
      if (pr.pxe !== 'none') { this.anims.px.hold(pr.pxe, pr.x, pr.y, Math.atan2(pr.vy, pr.vx)); return; }
    }
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
    } else if (dr.kind === 'weapon' || dr.kind === 'tweapon') { // 떨어진 무기: 날아와 땅에 비스듬히 꽂힌다 (흙이 튀고 · 작은 흙더미) — 등급 색은 손잡이 보석의 반짝임으로만
      const r = dr.kind === 'tweapon' ? ITEMS[dr.id]?.rarity ?? 0 : dr.id.loot.r, col = ['#c8c0d0', '#5ab0ff', '#c070ff', '#ffb030', '#ff4a6a'][r];
      const stuck = Math.hypot(dr.vx || 0, dr.vy || 0) < 8, x = Math.round(dr.x), y = Math.round(dr.y);
      if (stuck && !dr.planted) { dr.planted = true; for (let i = 0; i < 5; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 30, t: 0.4, max: 0.4, color: '#7a6448', g: 380, chunk: true, floor: y + 1 }); this.parts.push({ x, y: y - 1, vx: 0, vy: -6, t: 0.5, max: 0.5, color: '#b0a088', g: 0, puff: true, size: 3 }); }
      g.fillStyle = '#5a4634'; g.fillRect(x - 3, y, 6, 1); g.fillStyle = '#8a7356'; g.fillRect(x - 2, y - 1, 4, 1); // 흙더미
      const wa = dr.kind === 'tweapon' ? weaponArt(dr.id, ITEMS) : null, img = wa && sprite(wa.s, wa.tint || '');
      g.save(); g.translate(x, y - (stuck ? 0 : 4)); g.rotate(stuck ? -2.4 : (w.t * 12) % (Math.PI * 2)); // 날아오는 동안은 빙글빙글
      if (img) g.drawImage(img, Math.round(-img.width / 2), Math.round(-img.height * 0.85));
      else { g.fillStyle = '#16121c'; g.fillRect(-1.5, -12, 3, 13); g.fillStyle = '#e8eef8'; g.fillRect(-0.5, -11, 1.5, 11); g.fillStyle = '#6a5040'; g.fillRect(-3, 1, 6, 2); }
      g.restore();
      if (r >= 1 && stuck) { const tw = (Math.floor(w.t * 3 + dr.x) % (6 - Math.min(4, r))) === 0; g.fillStyle = tw ? '#ffffff' : col; g.fillRect(x + 4, y - 9, 1, 1); if (tw) { g.fillStyle = col; g.fillRect(x + 3, y - 9, 3, 1); g.fillRect(x + 4, y - 10, 1, 3); } } // 손잡이 보석: 등급이 높을수록 자주 반짝
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
    if (o.kind === 'climbDoor') return drawClimbObject(this, w, o, dt); // 탑 등반
    if (o.kind === 'lightPillar') return drawLightPillar(this, w, o); // 빛의 정상: 빛기둥
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
    if (o.kind === 'hiddenWay') { o._top = o.y - 26; return; }
    if (o.kind === 'chronicle') { // 연대기 비석: 이름이 새겨진 검은 돌
      const x = Math.round(o.x), y = Math.round(o.y);
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + 4, 12, 3);
      g.fillStyle = '#16141c'; g.fillRect(x - 10, y - 30, 20, 34); g.fillStyle = '#3a3848'; g.fillRect(x - 9, y - 29, 18, 32);
      g.fillStyle = '#4a4858'; g.fillRect(x - 9, y - 29, 18, 3); g.fillStyle = '#ffd27a'; g.fillRect(x - 5, y - 24, 10, 1);
      g.fillStyle = '#a8a4b8'; for (let k = 0; k < 6; k++) g.fillRect(x - 6, y - 19 + k * 3, 6 + ((k * 3) % 6), 1);
      o._top = y - 32; return;
    }
    if (o.kind === 'happening') { this.drawHappening(w, o); return; }
    if (o.kind === 'ladderUp') { // 위로 이어진 나무 사다리 · 위에서 새어 드는 빛
      const x = Math.round(o.x), y = Math.round(o.y);
      const gr = g.createLinearGradient(0, y - 60, 0, y); gr.addColorStop(0, 'rgba(255,240,200,0.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr; g.fillRect(x - 14, y - 60, 28, 60);
      g.fillStyle = '#1a1410'; g.fillRect(x - 8, y - 46, 3, 50); g.fillRect(x + 5, y - 46, 3, 50);
      g.fillStyle = '#8a6440'; g.fillRect(x - 7, y - 46, 1, 50); g.fillRect(x + 6, y - 46, 1, 50);
      for (let k = 0; k < 7; k++) { g.fillStyle = '#1a1410'; g.fillRect(x - 6, y - 42 + k * 7, 12, 3); g.fillStyle = '#a07a52'; g.fillRect(x - 6, y - 42 + k * 7, 12, 1); }
      o._top = y - 48; return;
    }
    if (o.kind === 'priceBoard') { // 시세판: 나무 판 두 장에 분필 글씨
      const x = Math.round(o.x), y = Math.round(o.y);
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + 4, 12, 3);
      g.fillStyle = '#1a1410'; g.fillRect(x - 10, y - 4, 3, 9); g.fillRect(x + 7, y - 4, 3, 9); g.fillRect(x - 14, y - 26, 28, 20);
      g.fillStyle = '#2a3a2e'; g.fillRect(x - 13, y - 25, 26, 18); g.fillStyle = '#7a5232'; g.fillRect(x - 14, y - 27, 28, 2);
      g.fillStyle = '#e8e4d8'; for (let k = 0; k < 4; k++) { g.fillRect(x - 11, y - 22 + k * 4, 9, 1); g.fillRect(x + 1, y - 22 + k * 4, 7 + (k % 2) * 2, 1); }
      g.fillStyle = '#ffd27a'; g.fillRect(x + 9, y - 22, 2, 1); g.fillStyle = '#7ae87a'; g.fillRect(x + 9, y - 18, 2, 1);
      o._top = o.y - 28; return;
    }
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
    if (o.kind === 'coach') { if (o.vy) this.drawCoachV(w, o); else this.drawHappening(w, { ...o, etype: 'caravan', dest: o.moving, engaged: !o.moving }); o._top = o.y - 30; return; } // 역마차 (세로로 가면 앞 · 뒷모습)
    if (o.kind === 'npc') {
      if (o.away) { o._top = null; return; }
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

  // 역마차 앞 · 뒷모습: 말이 앞에서 끌고(아래로 가면 아래에), 덮개 마차 뒤로 바퀴 둘이 보인다
  drawCoachV(w, o) {
    const g = this.g, x = Math.round(o.x), y = Math.round(o.y), down = o.vy > 0, bob = o.moving ? Math.floor(w.t * 8) % 2 : 0;
    const horse = (hy) => { // 말 (위에서 비스듬히 본 모습): 몸통 · 머리 · 다리
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, hy + 6, 6, 3);
      g.fillStyle = '#1a1410'; g.fillRect(x - 5, hy - 9, 10, 15);
      g.fillStyle = '#7a4e2a'; g.fillRect(x - 4, hy - 8, 8, 13); g.fillStyle = '#9a6a3a'; g.fillRect(x - 3, hy - 8, 2, 12);
      g.fillStyle = '#3a2416'; g.fillRect(x - 1, hy - 8, 2, 13); // 갈기
      const hh = down ? hy + 5 : hy - 12; g.fillStyle = '#1a1410'; g.fillRect(x - 3, hh - 1, 6, 7); g.fillStyle = '#8a5a32'; g.fillRect(x - 2, hh, 4, 5); if (down) { g.fillStyle = '#141018'; g.fillRect(x - 2, hh + 1, 1, 1); g.fillRect(x + 1, hh + 1, 1, 1); }
      g.fillStyle = '#2a1a10'; for (const lx of [-4, 3]) { g.fillRect(x + lx, hy + 4 + (lx < 0 ? bob : 1 - bob), 1, 3); }
    };
    const cart = (cy) => {
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, cy + 8, 13, 4);
      g.fillStyle = '#1a1410'; g.fillRect(x - 12, cy - 16, 24, 22);
      g.fillStyle = '#7a4e2a'; g.fillRect(x - 11, cy - 6, 22, 11); g.fillStyle = '#9a6a3a'; g.fillRect(x - 11, cy - 6, 22, 2);
      g.fillStyle = '#ece0c4'; g.fillRect(x - 11, cy - 15, 22, 9); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = -6; k <= 6; k += 6) g.fillRect(x + k, cy - 15, 1, 9); // 덮개
      if (!down) { g.fillStyle = '#2a1a10'; g.fillRect(x - 5, cy - 12, 10, 6); } // 뒤에서 보면 덮개 안이 어둡다
      for (const sx of [-12, 10]) { g.fillStyle = '#1a1410'; g.fillRect(x + sx, cy - 2, 3, 9); g.fillStyle = '#7a5232'; g.fillRect(x + sx + 1, cy - 1 + bob, 1, 7); } // 바퀴 (옆에서 본 테두리)
    };
    if (down) { cart(y - 6); horse(y + 12); } else { horse(y - 20); cart(y + 2); }
  }

  // 벌어지는 일: 상단 마차 · 세금 마차 · 순찰대 · 교단 신도
  drawHappening(w, o) {
    const g = this.g, x = Math.round(o.x), y = Math.round(o.y), d = o.dir || 1;
    const person = (base, tint, px, py, face) => { const img = sprite(this.animFrame(base, o.dest && !o.engaged ? 'run' : 'idle', w.t + px * 0.1, 8), tint || '', false, face < 0); if (img) { this.shadow(px, py + 4, 5); g.drawImage(img, Math.round(px - img.width / 2), Math.round(py + 5 - img.height)); } };
    const moving = o.dest && !o.engaged;
    if (o.etype === 'caravan' || o.etype === 'taxWagon') {
      // 말이 앞에서 끌고 · 마부는 앞 마차 마부석에 앉는다 · 세금 마차는 호위병이 옆에서 걷는다
      const tax = o.etype === 'taxWagon';
      const wagon = (wx, front) => {
        g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, wx, y + 6, 15, 4);
        g.fillStyle = '#1a1410'; g.fillRect(wx - 13, y - 14, 26, 16); g.fillStyle = tax ? '#5a3a7a' : '#7a4e2a'; g.fillRect(wx - 12, y - 13, 24, 11);
        g.fillStyle = tax ? '#7a5a9a' : '#9a6a3a'; g.fillRect(wx - 12, y - 13, 24, 2); g.fillStyle = '#4a3020'; for (let k = -8; k <= 8; k += 8) g.fillRect(wx + k, y - 11, 1, 9);
        g.fillStyle = '#1a1410'; g.beginPath(); g.ellipse(wx - d * 2, y - 14, 12, 9, 0, Math.PI, 0); g.fill();
        g.fillStyle = tax ? '#e8d8a8' : '#ece0c4'; g.beginPath(); g.ellipse(wx - d * 2, y - 14, 11, 8, 0, Math.PI, 0); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = -6; k <= 6; k += 6) g.fillRect(wx - d * 2 + k, y - 21, 1, 7);
        if (tax) { g.fillStyle = '#1a1410'; g.fillRect(wx - 3, y - 20, 6, 5); g.fillStyle = '#ffd76a'; g.fillRect(wx - 2, y - 19, 4, 3); } // 왕실 문장
        if (front) { g.fillStyle = '#1a1410'; g.fillRect(wx + d * 9 - 4, y - 16, 9, 4); g.fillStyle = '#7a4e2a'; g.fillRect(wx + d * 9 - 3, y - 15, 7, 2); } // 마부석
        const rot = moving ? w.t * 6 : 0;
        for (const sx of [-8, 8]) {
          g.fillStyle = '#1a1410'; g.beginPath(); g.arc(wx + sx, y + 2, 4.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#7a5232'; g.beginPath(); g.arc(wx + sx, y + 2, 3.5, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#3a2618'; for (let k = 0; k < 2; k++) { const a = rot + k * Math.PI / 2; g.fillRect(Math.round(wx + sx + Math.cos(a) * 2.5) - 0.5, Math.round(y + 2 + Math.sin(a) * 2.5) - 0.5, 1, 1); g.fillRect(Math.round(wx + sx - Math.cos(a) * 2.5) - 0.5, Math.round(y + 2 - Math.sin(a) * 2.5) - 0.5, 1, 1); }
        }
      };
      const front = x + d * 6, back = x - d * 24;
      const hf = sprite(this.animFrame('c_horse', moving ? 'run' : 'idle', w.t + o.x * 0.01, moving ? 9 : 4), '', false, d < 0);
      const hx = front + d * 31;
      if (hf) { this.shadow(hx, y + 4, 10); g.drawImage(hf, Math.round(hx - hf.width / 2), Math.round(y + 5 - hf.height)); }
      g.strokeStyle = '#3a2214'; g.lineWidth = 1; g.beginPath(); g.moveTo(front + d * 12, y - 6); g.lineTo(hx - d * 6, y - 12); g.stroke(); // 끌채
      if (!tax) wagon(back, false);
      wagon(front, true);
      // 마부: 마부석에 앉아 고삐를 잡는다 (다리는 마차에 가려진다)
      const dr = sprite(this.animFrame(tax ? 'p_taxman' : 'p_wagonDriver', 'idle', w.t, 4), '', false, d < 0);
      if (dr) { g.save(); g.beginPath(); g.rect(front + d * 9 - 14, y - 60, 28, 46); g.clip(); g.drawImage(dr, Math.round(front + d * 9 - dr.width / 2), Math.round(y - 13 - dr.height + 8)); g.restore(); }
      if (tax) person('p_royalGuard', '', x - d * 24, y + 10, d);
    } else if (o.etype === 'patrol') {
      // 순찰대가 농부를 다그친다: 병사 둘 · 무릎 꿇은 농부 · 우는 아이 · 엎어진 수레
      person('p_royalGuard', '', x - 16, y - 2, 1); person('p_royalGuard', '', x + 16, y - 2, -1);
      person('p_farmer', '', x, y + 6, 1); person('p_peasantKid', '', x - 30, y + 10, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(g, x + 34, y + 6, 10, 3);
      g.fillStyle = '#1a1410'; g.fillRect(x + 25, y - 4, 18, 9); g.fillStyle = '#7a5232'; g.fillRect(x + 26, y - 3, 16, 7); g.fillStyle = '#5a3a22'; g.fillRect(x + 26, y + 1, 16, 1); // 엎어진 수레
      g.fillStyle = '#1a1410'; g.beginPath(); g.arc(x + 41, y - 6, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#7a5232'; g.beginPath(); g.arc(x + 41, y - 6, 3, 0, Math.PI * 2); g.fill();
      for (const [ox, oy, c] of [[22, 6, '#c8a040'], [19, 8, '#d84a3a'], [46, 7, '#c8a040'], [24, 9, '#8ac848']]) { g.fillStyle = '#1a1410'; g.fillRect(x + ox - 1, y + oy - 1, 4, 4); g.fillStyle = c; g.fillRect(x + ox, y + oy, 2, 2); } // 쏟아진 곡식 · 사과
    } else if (o.etype === 'cult') {
      // 교단 의식: 가운데 돌 제단과 촛불, 신도 넷이 둘러선다
      g.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(g, x, y + 5, 12, 3);
      g.fillStyle = '#1a1418'; g.fillRect(x - 10, y - 8, 20, 13); g.fillStyle = '#5a5262'; g.fillRect(x - 9, y - 7, 18, 11); g.fillStyle = '#6e6678'; g.fillRect(x - 9, y - 7, 18, 2); g.fillStyle = '#3a3442'; g.fillRect(x - 9, y + 2, 18, 2);
      g.fillStyle = '#4a1a5a'; g.fillRect(x - 6, y - 7, 12, 8); g.fillStyle = '#b98aff'; g.fillRect(x - 1, y - 5, 2, 4); g.fillRect(x - 2, y - 4, 4, 1); // 제단 천 · 꺼진 등불 문양
      for (const cx of [-7, 7]) { g.fillStyle = '#1a1418'; g.fillRect(x + cx - 1, y - 13, 3, 6); g.fillStyle = '#e8e0d0'; g.fillRect(x + cx, y - 12, 1, 5); const fl = Math.sin(w.t * 9 + cx) > 0 ? 1 : 0; g.fillStyle = '#b98aff'; g.fillRect(x + cx, y - 15 - fl, 1, 2 + fl); }
      const spots = [[-26, -6, 1], [26, -6, -1], [-20, 12, 1], [20, 12, -1]];
      for (const [ox, oy, f] of spots.filter((s) => s[1] < 0)) person('p_m_cultist', '', x + ox, y + oy, f);
      for (const [ox, oy, f] of spots.filter((s) => s[1] > 0)) person('p_m_cultist', '', x + ox, y + oy, f);
    }
    if (!o.engaged && !o.gone) this.bang(x, y - 34 + Math.sin(w.t * 5) * 1.5, o.etype === 'cult' ? '#b98aff' : '#ffd040');
    o._top = y - 30;
  }

  drawNpc(w, o) {
    const g = this.g;
    if (o.away) { o._top = null; return; } // 기절 · 집 안
    const art = NPC_ART[o.art || o.station || o.kind] || { base: 'p_' + (o.art || o.station || 'farmer') }; // 그 밖의 사람은 people.py 그림 이름 그대로
    const act = o.act || 'idle', kind = act === 'walk' || act === 'run' || act === 'fight' ? 'run' : act === 'work' || act === 'spar' || act === 'hunt' || act === 'gather' ? 'work' : 'idle';
    const name = this.animFrame(art.base, kind, w.t + o.x * 0.01, kind === 'run' ? 9 : kind === 'work' ? 7 : 5);
    const face = o.face != null ? o.face < 0 : w.player.x < o.x;
    const img = sprite(name, art.tint || '', o.hostile?.hitFlash > 0 ? true : false, face);
    this.shadow(o.x, o.y + 4, 6);
    if (act === 'doze' && Math.random() < 0.01) this.texts.push({ x: o.x + 6, y: o.y - 26, text: 'z', color: '#c8d8ff', t: 1.4, vy: -10, vx: 4 }); // 잘 곳이 없으면 선 채로 꾸벅꾸벅
    const bob = act === 'play' ? Math.abs(Math.sin(w.t * 5 + o.x)) * 2 : act === 'gather' ? Math.abs(Math.sin(w.t * 6 + o.x)) * 1.5 : 0, lunge = act === 'spar' || act === 'hunt' ? Math.sin(w.t * 9 + o.x) * 2.5 * (face ? -1 : 1) : 0;
    if (img) g.drawImage(img, Math.round(o.x - img.width / 2 + lunge), Math.round(o.y + 5 - img.height - bob));
    o._top = o.y + 5 - (img ? img.height : 24);
    if (act === 'watch' && o.night && w.night) this.glow?.(o.x + (face ? -5 : 5), o.y - 14, 10, '#ffb050', 0.55); // 밤 근무조의 횃불
    if (act === 'talk' && Math.random() < 0.006) this.texts.push({ x: o.x, y: o._top - 2, text: ['…', '그래서?', '하하', '정말?', '흠'][Math.floor(Math.random() * 5)], color: '#f4ecd8', t: 1.4, vy: -8, vx: 0 });
    if (act === 'demand' && Math.random() < 0.012) this.texts.push({ x: o.x, y: o._top - 2, text: ['세금 내놔!', '왕명이다!', '이것뿐이야?'][Math.floor(Math.random() * 3)], color: '#ffb0a0', t: 1.6, vy: -8, vx: 0 });
    if (act === 'cower' && Math.random() < 0.01) this.texts.push({ x: o.x, y: o._top - 2, text: ['제발…', '돈이 없어요', '내일 드릴게요'][Math.floor(Math.random() * 3)], color: '#d8d0e8', t: 1.6, vy: -8, vx: 0 });
    if (act === 'eat' && Math.random() < 0.006) this.texts.push({ x: o.x, y: o._top - 2, text: '냠', color: '#ffe0a0', t: 1, vy: -8, vx: 0 });
    if (act === 'play' && Math.random() < 0.004) this.texts.push({ x: o.x, y: o._top - 2, text: ['♪', '하하', '…', '오!', '♫'][Math.floor(Math.random() * 5)], color: '#ffe8a8', t: 1.4, vy: -8, vx: 0 });
    if (act === 'spar' && Math.random() < 0.05) { this.parts.push({ x: o.x + (face ? -7 : 7), y: o.y - 10, vx: (Math.random() - 0.5) * 60, vy: -30, t: 0.25, max: 0.25, color: '#fff0b0', g: 120, glow: true }); if (Math.random() < 0.2) sfx('hit', { vol: 0.12, rate: 1.4 }); }
    if (!o.hostile && o.hp < o.maxHp) { const bw = 14, by = Math.round(o._top - 5); g.fillStyle = '#0d0b10'; g.fillRect(o.x - bw / 2 - 1, by - 1, bw + 2, 4); g.fillStyle = '#7be38a'; g.fillRect(o.x - bw / 2, by, Math.max(0, bw * o.hp / o.maxHp), 2); } // 사냥하다 다친 사람
    if (o.hostile && o.hostile.hp < o.hostile.maxHp) { const bw = 16, by = Math.round(o._top - 5); g.fillStyle = '#0d0b10'; g.fillRect(o.x - bw / 2 - 1, by - 1, bw + 2, 4); g.fillStyle = '#e8484a'; g.fillRect(o.x - bw / 2, by, Math.max(0, bw * o.hostile.hp / o.hostile.maxHp), 2); }
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
      if (cache.size > 200) cache.delete(cache.keys().next().value); // 왕도 성벽 조각이 많아 넉넉히
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
    if (pr.kind === 'barrelProp') { // 갑판의 술통
      g.fillStyle = '#1a1410'; g.fillRect(x + 2, y - 6, 12, 20); g.fillStyle = '#8a5a32'; g.fillRect(x + 3, y - 5, 10, 18);
      g.fillStyle = '#a8703e'; g.fillRect(x + 5, y - 5, 3, 18); g.fillStyle = '#4a4a52'; g.fillRect(x + 3, y - 2, 10, 2); g.fillRect(x + 3, y + 8, 10, 2);
      g.fillStyle = '#6a4226'; g.fillRect(x + 4, y - 6, 8, 2); return;
    }
    if (pr.kind === 'mast') { // 돛대: 갑판에서 솟아 화면 위로, 펄럭이는 큰 돛
      const mx = x + 8, top = y - 150, sw = pr.sail === 'main' ? 92 : 74, sh = pr.sail === 'main' ? 96 : 80, sway = Math.sin(w.t * 1.6) * 3;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(mx - 30, y + 10, 60, 5);
      g.fillStyle = '#1a1410'; g.fillRect(mx - 4, top, 8, 166); g.fillStyle = '#7a5232'; g.fillRect(mx - 3, top, 6, 166); g.fillStyle = '#a07a52'; g.fillRect(mx - 2, top, 2, 166);
      g.fillStyle = '#1a1410'; g.fillRect(mx - sw / 2 - 2, top + 10, sw + 4, 5); g.fillRect(mx - sw / 2 + 6, top + 14 + sh, sw - 12, 4);
      g.globalAlpha = 0.93;
      g.fillStyle = '#1a1410'; g.beginPath(); g.moveTo(mx - sw / 2 - 1, top + 13); g.lineTo(mx + sw / 2 + 1, top + 13); g.quadraticCurveTo(mx + sw / 2 + 10 + sway, top + 14 + sh / 2, mx + sw / 2 - 6, top + 15 + sh); g.lineTo(mx - sw / 2 + 6, top + 15 + sh); g.quadraticCurveTo(mx - sw / 2 + 10 + sway, top + 14 + sh / 2, mx - sw / 2 - 1, top + 13); g.fill();
      g.fillStyle = '#f2ead6'; g.beginPath(); g.moveTo(mx - sw / 2, top + 14); g.lineTo(mx + sw / 2, top + 14); g.quadraticCurveTo(mx + sw / 2 + 9 + sway, top + 14 + sh / 2, mx + sw / 2 - 6, top + 14 + sh); g.lineTo(mx - sw / 2 + 6, top + 14 + sh); g.quadraticCurveTo(mx - sw / 2 + 9 + sway, top + 14 + sh / 2, mx - sw / 2, top + 14); g.fill();
      g.fillStyle = '#d8ccb0'; for (let k = 1; k < 4; k++) g.fillRect(mx - sw / 2 + 4, top + 14 + k * sh / 4, sw - 4, 1);
      g.fillStyle = '#3a6a9a'; g.fillRect(mx - sw / 2 + 6, top + 14 + sh * 0.45, sw - 8, 7);
      g.globalAlpha = 1;
      const fw = Math.round(14 + Math.sin(w.t * 6) * 3); g.fillStyle = '#1a1410'; g.fillRect(mx, top - 10, fw + 2, 9); g.fillStyle = '#c8402a'; g.fillRect(mx + 1, top - 9, fw, 7);
      return;
    }
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

  // ───────── 글씨 (실제 해상도) ─────────
  // 칸 아래 이름: 칸 너비에 맞게. 넘치면 낱말 단위로 줄이고(「할퀴고 빠지기」 → 「할퀴고」), 그래도 넘치면 글자를 줄인다
  fitName(name, maxW, n) {
    const g = this.g; g.font = `${11 * n}px ${FONT}`;
    if (g.measureText(name).width <= maxW) return name;
    const words = name.split(' '); let out = words[0];
    for (let i = 1; i < words.length && g.measureText(out + ' ' + words[i]).width <= maxW; i++) out += ' ' + words[i];
    while (out.length > 2 && g.measureText(out).width > maxW) out = out.slice(0, -1);
    return out;
  }
  text(s, x, y, n, color, align = 'left', outline = true, bold = false) {
    const g = this.g, size = 11 * n;
    g.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    g.textAlign = align; g.textBaseline = 'middle';
    x = Math.round(x); y = Math.round(y);
    if (outline) {
      g.fillStyle = '#0c0a0b';
      const o = Math.max(1, Math.round(n));
      for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) g.fillText(s, x + dx, y + dy);
    }
    g.fillStyle = color; g.fillText(s, x, y);
  }
  sx(x) { return (x - this.cx) * this.S; }
  sy(y) { return (y - this.cy) * this.S; }

}

export function fmt(v) { return v >= 1 ? String(Math.round(v)) : v.toFixed(1); }
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
export function disc(g, cx, cy, r) { g.beginPath(); g.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); }
// 효과(mods) → 사람이 읽는 글
const pctS = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const MOD_TEXT = {
  dmgMul: (v) => `주는 피해 ${pctS(v - 1)}`, dmgTakenMul: (v) => `받는 피해 ${pctS(v - 1)}`, moveSpeed: (v) => `이동 속도 ${pctS(v - 1)}`, atkSpeed: (v) => `공격 속도 ${pctS(v - 1)}`,
  cdRate: (v) => `스킬 재사용 대기 -${Math.round((1 - 1 / v) * 100)}%`, regen: (v) => `초당 체력 ${(v * 100).toFixed(1)}% 회복`, crit: (v) => `치명타 확률 ${pctS(v)}`, dodge: (v) => `공격을 ${Math.round(v * 100)}% 확률로 피한다`,
  lifesteal: (v) => `준 피해의 ${v}%만큼 체력 회복`, reflect: (v) => `받은 피해의 ${v}%를 되돌려준다`, pres: (v) => `물리 저항 +${v}`, mres: (v) => `마법 저항 +${v}`, projRange: (v) => `투사체 사거리 ${pctS(v - 1)}`,
  breath: (v) => `물속 숨 ×${v}`, luck: (v) => `귀한 물고기 · 부산물 확률 ${pctS(v)}`,
};
export function fogSprites() { // 네 모서리(0 밝음 · 1 어둠)를 이어 칸 안을 채운 16가지 점묘 그림
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
export function modLines(mods) { return Object.entries(mods || {}).filter(([k]) => MOD_TEXT[k]).map(([k, v]) => MOD_TEXT[k](v)); }
// 그림 위쪽 빈칸을 뺀, 처음 칠해진 줄의 높이 비율 (그림마다 한 번만 잰다)
const OPAQUE_TOP = new WeakMap();
export function opaqueTop(img) {
  if (!img || !img.width) return 0;
  let v = OPAQUE_TOP.get(img); if (v != null) return v;
  v = 0;
  try {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    find: for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { v = y / c.height; break find; }
  } catch { v = 0; }
  OPAQUE_TOP.set(img, v); return v;
}
export function ellipse(g, cx, cy, rx, ry) { g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); g.fill(); }
// 꼬리는 가늘고 머리(현재 칼끝)는 두꺼운 베기 잔상
export function smear(g, x, y, R, thick, a0, a1) {
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

// 몸 기술 동작 → 그림 변형 (발밑 기준). k: 0 → 1 진행
function beastPose(ps, dir, t) {
  const k = 1 - Math.max(0, ps.t) / ps.max, out = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 }, ease = (v) => 1 - (1 - v) * (1 - v), back = -dir;
  switch (ps.k) {
    case 'crouch': { const q = ease(Math.min(1, k * 2.5)); out.sy = 1 - 0.22 * q; out.sx = 1 + 0.12 * q; out.rot = dir * 0.12 * q; out.x = back * 2 * q + Math.sin(t * 40) * 0.6 * q; break; } // 고개를 숙이고 뒤로 몸을 당긴다 (떨림)
    case 'lunge': { out.rot = dir * 0.2; out.sx = 1.18; out.sy = 0.9; break; } // 머리부터 내민다
    case 'rear': { const q = ease(Math.min(1, k * 1.6)); out.sy = 1 + 0.2 * q; out.sx = 1 - 0.08 * q; out.rot = back * 0.35 * q; out.y = -3 * q; break; } // 뒷발로 일어선다
    case 'slam': { const q = Math.max(0, 1 - k * 3); out.sy = 1 - 0.25 * q; out.sx = 1 + 0.2 * q; out.rot = dir * 0.25 * q; break; } // 내려찍은 직후 납작
    case 'spit': { const q = Math.sin(Math.min(1, k * 1.5) * Math.PI); out.rot = back * 0.15 * q; out.sy = 1 - 0.1 * q; break; }
    case 'howl': { const q = Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.5); out.rot = back * 0.4 * q; out.sy = 1 + 0.12 * q; out.y = -2 * q; break; } // 고개를 하늘로
    case 'coil': { const q = ease(k); out.rot = back * 0.3 * q; out.sx = 1 - 0.1 * q; break; } // 몸을 비튼다
    case 'leap': { out.rot = dir * (0.35 - 0.7 * k); out.sx = 0.92; out.sy = 1.12; break; } // 날아오를 때 앞으로, 떨어질 때 아래로
    case 'recover': { const q = 1 - k; out.sy = 1 - 0.06 * q; out.y = Math.sin(t * 6) * 0.5; break; } // 숨을 고른다 (빈틈)
    case 'dizzy': { out.rot = Math.sin(t * 7) * 0.18; out.x = Math.sin(t * 5) * 1.5; break; }
    case 'burrow': { const q = ease(k); out.sy = 1 - 0.9 * q; out.y = 2 * q; break; } // 땅속으로 파고든다
  }
  return out;
}

// 몸에 감긴 거미줄: 엇갈린 흰 실 몇 가닥 + 바닥에 붙은 실
function drawWeb(g, x, y, t, a) {
  g.save(); g.globalAlpha = 0.85 * a; g.strokeStyle = '#f4f2ea'; g.lineWidth = 1;
  for (const [x1, y1, x2, y2] of [[-7, -16, 6, -3], [6, -17, -7, -2], [-8, -9, 8, -9], [-6, -3, -10, 4], [6, -3, 10, 4], [0, -18, 0, 2]]) { g.beginPath(); g.moveTo(x + x1, y + y1); g.quadraticCurveTo(x + (x1 + x2) / 2, y + (y1 + y2) / 2 + 2, x + x2, y + y2); g.stroke(); }
  g.fillStyle = 'rgba(244,242,234,0.5)'; g.fillRect(Math.round(x - 9), Math.round(y + 3), 18, 1);
  g.restore();
}

// 나눠 둔 메서드를 Renderer 에 붙인다
Object.assign(Renderer.prototype, HudMethods, FxMethods, EventMethods, AtmosMethods);

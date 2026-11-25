// 렌더러 — 스킬마다 다른 그림 (사건에 붙은 스킬 id ev.sk · sim/skillrun.js execSkill)
// 같은 범용 사건(촉수 · 빛기둥 · 시계 고리)을 여러 스킬이 나눠 쓰던 것을 스킬 모양대로 바꾼다.
// SK_FX[스킬](ev, w) — this 는 Renderer. true 를 돌려주면 그 사건의 범용 그림은 그리지 않는다(소리 · 흔들림은 여기서)
// 원칙(CLAUDE.md 그래픽 취향): 짙은 외곽선 + 가운데 색 + 밝은 면(origFx) · 타원 고리 · 빛 막대 없이 · 숨은 각인(5등급)은 가장 화려하게
import { sfx } from '../audio.js';

const TAU = Math.PI * 2;
const near = (w, x, y, r, n = 6) => w.enemies.filter((e) => !e.dead && Math.hypot(e.x - x, e.y - y) < r + (e.r || 8)).slice(0, n);
const facing = (w) => { const p = w.player; return Math.atan2(p.aimY || 0, p.aimX || p.dir || 1); };
// 둘레로 터지는 조각 (짙은 테가 있는 덩이: parts 의 chunk)
function chips(R, x, y, col, n, sp = 120, up = 80) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (0.4 + Math.random() * 0.8); R.parts.push({ x, y: y - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - up * Math.random(), t: 0.5 + Math.random() * 0.3, max: 0.8, color: col, g: 260, chunk: true, floor: y + 2 + Math.sin(a) * 6 }); } }
function motes(R, x, y, col, n, r = 20, up = 40) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = Math.random() * r; R.parts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.5, vx: 0, vy: -up * (0.5 + Math.random()), t: 0.6 + Math.random() * 0.4, max: 1, color: col, g: -10, glow: true, size: 1 }); } }

export const SK_FX = {
  // ───── 종족 스킬 ─────
  elemSurge(ev) { if (ev.t !== 'buff') return; // 원소 쇄도: 넷의 원소 덩이가 몸 둘레에서 솟는다
    ['fire', 'ice', 'bolt', 'poison'].forEach((pal, i) => { const a = (i / 4) * TAU; this.origFx({ s: 'orb', x: ev.x + Math.cos(a) * 12, y: ev.y + Math.sin(a) * 5, r: 3.5, h: 16, pal, tier: 3, dur: 0.7 }); });
    this.origFx({ s: 'rays', x: ev.x, y: ev.y - 4, r: 18, n: 8, spread: 2.4, ang: -Math.PI / 2, pal: 'curse', tier: 3, dur: 0.45 }); },
  berserkSkill(ev) { if (ev.t !== 'buff') return; // 광폭화: 피 김 · 붉은 빛살 · 땅을 박찬 흙
    this.origFx({ s: 'rays', x: ev.x, y: ev.y - 2, r: 22, n: 10, spread: 2.6, ang: -Math.PI / 2, pal: 'blood', tier: 3, dur: 0.5 }); this.origFx({ s: 'burst', x: ev.x, y: ev.y + 4, r: 10, pal: 'blood', tier: 2, dur: 0.3 });
    for (let i = 0; i < 10; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 12, y: ev.y - 4, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 30, t: 0.7, max: 0.7, color: i % 2 ? '#d0283a' : '#ff8a8a', g: -10, steam: true });
    this.shake = Math.max(this.shake, 4); },
  gravityCollapse(ev) { if (ev.t !== 'skillAoe') return;
    if (ev.fx === 'gravity') { this.origFx({ s: 'swirl', x: ev.x, y: ev.y + 6, r: ev.r * 0.6, n: 4, pal: 'curse', tier: 4, dur: 0.6, ccw: true }); this.origFx({ s: 'gust', x: ev.x, y: ev.y, r: ev.r * 0.8, ang: 0, in: true, n: 8, wide: ev.r, pal: 'curse', tier: 3, dur: 0.5 }); sfx('cast', { vol: 0.7, rate: 0.5 }); return true; }
    if (ev.fx === 'implode') { this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: ev.r * 0.6, n: 14, pal: 'curse', tier: 4, dur: 0.45 }); this.origFx({ s: 'spikes', x: ev.x, y: ev.y, r: ev.r * 0.7, n: 10, h: 18, pal: 'shadow', tier: 4, dur: 0.6 }); chips(this, ev.x, ev.y, '#5a3a8a', 12); this.addStop(0.06); sfx('reaction', { vol: 0.9, rate: 0.6 }); return true; } },
  singularity(ev) { if (ev.t !== 'skillAoe') return;
    if (ev.fx === 'implode') { this.origFx({ s: 'swirl', x: ev.x, y: ev.y + 6, r: ev.r * 0.7, n: 4, pal: 'ink', tier: 4, dur: 0.7, ccw: true }); this.origFx({ s: 'orb', x: ev.x, y: ev.y + 6, r: 6, h: 14, pal: 'ink', tier: 4, dur: 0.65 }); sfx('cast', { vol: 0.8, rate: 0.4 }); return true; }
    if (ev.fx === 'arcane') { this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: ev.r * 0.75, n: 16, pal: 'curse', tier: 4, dur: 0.5 }); this.origFx({ s: 'bolt', x1: ev.x - 30, y1: ev.y - 26, x2: ev.x + 4, y2: ev.y, pal: 'curse', dur: 0.25 }); this.origFx({ s: 'bolt', x1: ev.x + 34, y1: ev.y - 20, x2: ev.x, y2: ev.y + 2, pal: 'curse', dur: 0.25 }); chips(this, ev.x, ev.y, '#a83ae0', 14); this.shake = Math.max(this.shake, 8); this.addStop(0.08); sfx('reaction', { vol: 1, rate: 0.6 }); return true; } },
  timeStop(ev) { if (ev.t !== 'skillAoe') return; // 시간 정지: 짙은 타원 판 대신 땅에 새긴 시계 문양 + 멈춘 빛 조각 · 풀릴 때 비전 빛살
    if (ev.fx === 'timestop') { this.origFx({ s: 'sigil', x: ev.x, y: ev.y, r: 42, n: 5, pal: 'curse', tier: 3, dur: 3 }); this.origFx({ s: 'rays', x: ev.x, y: ev.y - 4, r: 30, n: 12, pal: 'curse', tier: 5, dur: 0.5 }); for (const e of near(this.world, ev.x, ev.y, ev.r, 8)) this.origFx({ s: 'mark', x: e.x, y: e.y, icon: 'clock', pal: 'curse', tier: 4, dur: 3 }); this.flash = { color: '185,138,255', t: 0.25, max: 0.25 }; this.shake = Math.max(this.shake, 8); sfx('reaction', { vol: 0.9, rate: 0.5 }); return true; }
    if (ev.fx === 'arcane') { this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 48, n: 18, pal: 'curse', tier: 5, dur: 0.55 }); for (const e of near(this.world, ev.x, ev.y, ev.r, 8)) this.origFx({ s: 'burst', x: e.x, y: e.y, r: 14, pal: 'glass', tier: 3, dur: 0.35 }); this.shake = Math.max(this.shake, 10); this.addStop(0.1); sfx('reaction', { vol: 1, rate: 0.7 }); return true; } },
  undying(ev) { if (ev.t !== 'skillAoe') return; // 불굴: 화면을 덮는 흰 빛 대신 땅에서 솟는 금빛 기둥 · 빛살 · 금 간 땅
    this.origFx({ s: 'pillar', x: ev.x, y: ev.y + 2, r: 22, h: 60, pal: 'holy', tier: 5, dur: 0.7 }); this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 34, n: 16, pal: 'holy', tier: 5, dur: 0.5 });
    this.anims.groundSlam(ev.x, ev.y, ev.r * 0.7, 'phys', true); motes(this, ev.x, ev.y, '#ffe08a', 16, 40, 60); this.addStop(0.1); sfx('hitHeavy', { vol: 1, rate: 0.5 }); return true; },
  deathCall(ev) { if (ev.t !== 'skillAoe' || ev.fx !== 'taunt') return; // 죽음의 부름: 부하 머리 위 해골 · 부르는 빛살
    this.origFx({ s: 'mark', x: ev.x, y: ev.y, icon: 'skull', pal: 'curse', tier: 3, dur: 1 }); this.origFx({ s: 'rays', x: ev.x, y: ev.y - 4, r: 16, n: 8, pal: 'curse', tier: 3, dur: 0.4 }); sfx('hitHeavy', { vol: 0.4, rate: 0.6 }); return true; },
  provoke(ev) { if (ev.t !== 'skillAoe') return; // 도발: 몸에서 터지는 금빛 빛살 + 적 머리 위 「!」 대신 왕관 표식
    this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 26, n: 12, pal: 'holy', tier: 3, dur: 0.4 }); this.origFx({ s: 'rays', x: ev.x, y: ev.y - 8, r: 20, n: 8, spread: 2.4, ang: -Math.PI / 2, pal: 'holy', tier: 3, dur: 0.45 }); for (const e of near(this.world, ev.x, ev.y, ev.r)) this.origFx({ s: 'mark', x: e.x, y: e.y, icon: 'crown', pal: 'holy', tier: 2, dur: 1 }); this.rimFlash = { color: '#ffd84a', t: 0.5, max: 0.5 }; this.shake = Math.max(this.shake, 4); sfx('hitHeavy', { vol: 0.7, rate: 0.5 }); return true; },
  corpseBlast(ev) { if (ev.t !== 'skillAoe' || ev.fx !== 'corpse') return; // 시체 폭발: 촉수 대신 뼈 · 살점이 터지고 뼈 가시
    this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: ev.r * 0.45, n: 12, pal: 'curse', tier: 4, dur: 0.4 }); this.origFx({ s: 'spikes', x: ev.x, y: ev.y, r: ev.r * 0.6, n: 8, h: 16, pal: 'bone', tier: 3, dur: 0.6 }); this.origFx({ s: 'splat', x: ev.x, y: ev.y + 2, r: Math.min(14, ev.r * 0.2), pal: 'blood', tier: 2, dur: 1.2 });
    chips(this, ev.x, ev.y, '#d8d0b8', 10); chips(this, ev.x, ev.y, '#a8283a', 6); this.shake = Math.max(this.shake, 6); this.addStop(0.06); sfx('hitHeavy', { vol: 0.9, rate: 0.7 }); return true; },
  plagueNova(ev) { if (ev.t !== 'skillAoe' || ev.fx !== 'doom') return; // 역병 폭발: 촉수 대신 독 소용돌이 · 웅덩이 · 거품
    this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 34, n: 14, pal: 'poison', tier: 4, dur: 0.45 }); this.origFx({ s: 'swirl', x: ev.x, y: ev.y + 6, r: ev.r * 0.7, n: 4, pal: 'poison', tier: 4, dur: 0.8 }); this.origFx({ s: 'splat', x: ev.x, y: ev.y + 4, r: Math.min(20, ev.r * 0.22), pal: 'poison', tier: 3, dur: 1.4, bubble: true });
    this.anims.add('cloud', { x: ev.x, y: ev.y, r: ev.r * 0.8, max: 1.4 }); this.shake = Math.max(this.shake, 6); sfx('reaction', { vol: 0.9, rate: 0.7 }); return true; },
  stealth(ev) { if (ev.t !== 'stealthOn' && ev.t !== 'skillAoe') return; // 은신: 몸이 그림자로 가라앉는다 (먹 웅덩이 · 잉크 조각)
    if (ev.t === 'skillAoe') return true;
    this.origFx({ s: 'splat', x: ev.x, y: ev.y + 3, r: 14, pal: 'ink', tier: 3, dur: 0.9 }); this.origFx({ s: 'ghost', x: ev.x, y: ev.y, r: 16, ang: -Math.PI / 2, n: 5, spread: 2.2, pal: 'shadow', tier: 3, dur: 0.45 });
    for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, sp = 20 + Math.random() * 40; this.parts.push({ x: ev.x, y: ev.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, t: 0.7, max: 0.7, color: i % 2 ? '#2c2444' : '#5a3a8a', g: -8 }); }
    sfx('dash', { vol: 0.5, rate: 0.6 }); return true; },
  contagion(ev) { if (ev.t !== 'skillAoe' || ev.fx !== 'spread') return; // 전염: 저주가 옮는 자리에 해골 표식 · 보라 빛살
    this.origFx({ s: 'rays', x: ev.x, y: ev.y - 2, r: 16, n: 8, pal: 'curse', tier: 3, dur: 0.4 }); this.origFx({ s: 'mark', x: ev.x, y: ev.y, icon: 'skull', pal: 'curse', tier: 3, dur: 0.9 }); sfx('reaction', { vol: 0.4, rate: 0.9 }); return true; },
  wordSilence(ev) { return silenceFx.call(this, ev, 5); },
  silenceSeal(ev) { return silenceFx.call(this, ev, 3); },
  wordEarth(ev) { if (ev.t !== 'skillAoe') return; // 용언: 대지 — 발밑이 갈라지고 돌 가시
    this.anims.groundSlam(ev.x, ev.y, ev.r, 'phys', false); this.origFx({ s: 'spikes', x: ev.x, y: ev.y, r: ev.r * 0.8, n: 10, h: 14, pal: 'earth', tier: 3, dur: 0.6 }); sfx('crack', { vol: 0.7, rate: 0.8 }); return true; },
  quakeStomp(ev) { if (ev.t !== 'skillAoe') return; // 지진 발구르기: 회전 베기 그림 대신 땅 울림
    this.anims.groundSlam(ev.x, ev.y, ev.r, 'phys', false); this.origFx({ s: 'spikes', x: ev.x, y: ev.y, r: ev.r * 0.7, n: 8, h: 10, pal: 'earth', tier: 2, dur: 0.5 }); this.addStop(0.05); sfx('hitHeavy', { vol: 0.9, rate: 0.6 }); return true; },
  fearShout(ev) { if (ev.t !== 'skillAoe') return; // 공포의 외침: 밖으로 퍼지는 바람결 + 적 머리 위 해골
    this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 22, n: 12, pal: 'curse', tier: 3, dur: 0.4 }); this.origFx({ s: 'rays', x: ev.x, y: ev.y - 6, r: 18, n: 8, spread: 2.2, ang: -Math.PI / 2, pal: 'curse', tier: 3, dur: 0.4 });
    for (const e of near(this.world, ev.x, ev.y, ev.r)) this.origFx({ s: 'mark', x: e.x, y: e.y, icon: 'skull', pal: 'curse', tier: 2, dur: 1.2 }); this.shake = Math.max(this.shake, 4); sfx('hitHeavy', { vol: 0.6, rate: 0.5 }); return true; },
  retribution(ev) { if (ev.t !== 'skillAoe') return; // 응보: 땅에 그은 문양 · 그림자 가시
    this.origFx({ s: 'sigil', x: ev.x, y: ev.y, r: ev.r * 0.6, n: 5, pal: 'curse', tier: 3, dur: 1 }); this.origFx({ s: 'spikes', x: ev.x, y: ev.y, r: ev.r * 0.6, n: 7, h: 14, pal: 'shadow', tier: 3, dur: 0.6 }); sfx('reaction', { vol: 0.6, rate: 0.8 }); return true; },
  bloodDraw(ev) { if (ev.t !== 'skillAoe') return; // 피 뽑기: 불 폭발 대신 핏빛 터짐 · 피 웅덩이 · 가시
    this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 26, n: 12, pal: 'blood', tier: 3, dur: 0.4 }); this.origFx({ s: 'spikes', x: ev.x, y: ev.y, r: ev.r * 0.7, n: 8, h: 14, pal: 'blood', tier: 3, dur: 0.55 }); this.origFx({ s: 'splat', x: ev.x, y: ev.y + 3, r: Math.min(12, ev.r * 0.22), pal: 'blood', tier: 2, dur: 1.1 });
    this.shake = Math.max(this.shake, 5); sfx('hitHeavy', { vol: 0.9, rate: 0.8 }); return true; },
  dragonForm(ev) { // 용화: 화면을 덮는 흰 빛기둥 대신 불기둥 셋 · 불 빛살 · 날개 깃
    if (ev.t === 'skillAoe') { for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 1.1; this.origFx({ s: 'pillar', x: ev.x + Math.cos(a) * 18 * (i === 1 ? 0 : 1), y: ev.y + 4, r: i === 1 ? 20 : 12, h: i === 1 ? 64 : 40, pal: 'fire', tier: 5, dur: 0.7 }); }
      this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 36, n: 16, pal: 'fire', tier: 5, dur: 0.5 }); this.anims.groundSlam(ev.x, ev.y, ev.r * 0.6, 'fire', true); this.addStop(0.1); sfx('hitHeavy', { vol: 1, rate: 0.5 }); return true; }
    if (ev.t === 'buff') { for (const s of [-1, 1]) this.origFx({ s: 'wing', x: ev.x, y: ev.y - 4, r: 26, ang: s > 0 ? -0.5 : Math.PI + 0.5, n: 5, spread: 1.4, pal: 'fire', tier: 5, dur: 0.6 }); return true; } },
  enchantLightning(ev) { if (ev.t !== 'enchant') return; for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.7; this.origFx({ s: 'bolt', x1: ev.x + Math.cos(a) * 26, y1: ev.y - 10 + Math.sin(a) * 20, x2: ev.x + 4, y2: ev.y - 8, pal: 'bolt', dur: 0.25 }); } this.origFx({ s: 'rays', x: ev.x, y: ev.y - 6, r: 14, n: 8, pal: 'bolt', tier: 3, dur: 0.35 }); },
  resFlame(ev) { if (ev.t !== 'enchant') return; this.origFx({ s: 'pillar', x: ev.x, y: ev.y + 2, r: 10, h: 30, pal: 'fire', tier: 3, dur: 0.5 }); this.origFx({ s: 'rays', x: ev.x, y: ev.y - 6, r: 14, n: 8, spread: 2.4, ang: -Math.PI / 2, pal: 'fire', tier: 3, dur: 0.4 }); },
  quietBreath(ev) { if (ev.t !== 'skillFx') return; this.origFx({ s: 'swirl', x: ev.x, y: ev.y + 4, r: 18, n: 3, pal: 'wind', tier: 2, dur: 1.2 }); this.origFx({ s: 'orb', x: ev.x, y: ev.y, r: 3, h: 22, pal: 'wind', tier: 2, dur: 1.2 }); },
  resMark(ev) { if (ev.t !== 'skillFx') return; for (const e of near(this.world, ev.x, ev.y, 160, 2)) this.origFx({ s: 'mark', x: e.x, y: e.y, icon: 'brand', pal: 'gold', tier: 3, dur: 1.2 }); this.origFx({ s: 'star', x: ev.x + Math.cos(ev.ang || 0) * 10, y: ev.y, r: 6, h: 14, pal: 'gold', tier: 3, dur: 0.5 }); },
  wordScale(ev) { if (ev.t !== 'buff') return; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; this.origFx({ s: 'orb', x: ev.x + Math.cos(a) * 11, y: ev.y + Math.sin(a) * 5, r: 2.6, h: 10, pal: 'fire', tier: 3, dur: 0.6 }); } },
  snatch(ev) { if (ev.t !== 'skillSingle') return; this.origFx({ s: 'fist', x: ev.x - 12, y: ev.y, r: 20, ang: 0, n: 4, spread: 0.9, pal: 'fire', tier: 3, dur: 0.35 }); },

  // ───── 숨은 각인 (5등급: 가장 화려하게) ─────
  hShadowHands(ev) { if (ev.t !== 'skillAoe' || ev.fx !== 'doom') return; // 끌려온 적마다: 무거운 촉수 그림(여럿이면 페이지가 멈췄다) 대신 가벼운 그림자 손 · 먹빛 터짐
    this.origFx({ s: 'fist', x: ev.x, y: ev.y, r: 18, ang: -Math.PI / 2, n: 5, spread: 1.6, pal: 'shadow', tier: 5, dur: 0.5 }); this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 14, n: 10, pal: 'curse', tier: 5, dur: 0.4 }); this.origFx({ s: 'splat', x: ev.x, y: ev.y + 3, r: 10, pal: 'ink', tier: 4, dur: 1 }); return true; },
  hShadowless(ev) { if (ev.t !== 'skillDash') return; // 무영보: 지나간 길에 그림자 조각 · 길 위 칼자국 셋 · 끝에서 먹빛 터짐
    this.origFx({ s: 'path', x1: ev.x1, y1: ev.y1 + 4, x2: ev.x2, y2: ev.y2 + 4, pal: 'ink', tier: 5, dur: 1.2 });
    const a = Math.atan2(ev.y2 - ev.y1, ev.x2 - ev.x1); for (let i = 1; i <= 3; i++) { const u = i / 4; this.origFx({ s: 'slash', x: ev.x1 + (ev.x2 - ev.x1) * u, y: ev.y1 + (ev.y2 - ev.y1) * u, ang: a + (i % 2 ? 1.2 : -1.2), r: 18, spread: 2.4, pal: 'shadow', tier: 5, dur: 0.3 + i * 0.05 }); }
    this.origFx({ s: 'burst', x: ev.x2, y: ev.y2, r: 18, n: 12, pal: 'shadow', tier: 5, dur: 0.4 }); },
  hGaleCut(ev) { if (ev.t !== 'skillDash') return; // 질풍참: 바람 줄기를 끌고 가로지르는 큰 칼자국
    const a = Math.atan2(ev.y2 - ev.y1, ev.x2 - ev.x1), L = Math.hypot(ev.x2 - ev.x1, ev.y2 - ev.y1);
    this.origFx({ s: 'gust', x: ev.x1, y: ev.y1, r: L, ang: a, n: 6, wide: 26, pal: 'wind', tier: 5, dur: 0.5 });
    this.origFx({ s: 'slash', x: (ev.x1 + ev.x2) / 2, y: (ev.y1 + ev.y2) / 2, ang: a + Math.PI / 2, r: L * 0.35, spread: 1.4, pal: 'wind', tier: 5, dur: 0.35 }); this.origFx({ s: 'rays', x: ev.x2, y: ev.y2, r: 16, n: 8, pal: 'wind', tier: 4, dur: 0.3 }); },
  hVoidStrike(ev) { if (ev.t === 'skillFx') { const a = ev.ang || 0; this.origFx({ s: 'slash', x: ev.x + Math.cos(a) * 8, y: ev.y + Math.sin(a) * 6, ang: a, r: 26, spread: 2.2, pal: 'ink', tier: 5, dur: 0.35 }); this.origFx({ s: 'rays', x: ev.x, y: ev.y - 8, r: 18, n: 8, spread: 2.2, ang: -Math.PI / 2, pal: 'curse', tier: 5, dur: 0.4 }); return; }
    if (ev.t !== 'skillSingle') return; // 공허 일격: 위에서 내리꽂히는 먹빛 기둥 · 갈라진 땅 · 보라 빛살
    this.origFx({ s: 'beam', x1: ev.x, y1: ev.y - 90, x2: ev.x, y2: ev.y - 2, w: 6, pal: 'ink', tier: 5, dur: 0.35 }); this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 30, n: 16, pal: 'curse', tier: 5, dur: 0.5 });
    this.anims.groundSlam(ev.x, ev.y, 40, 'phys', true); this.origFx({ s: 'spikes', x: ev.x, y: ev.y, r: 26, n: 8, h: 18, pal: 'ink', tier: 5, dur: 0.7 }); chips(this, ev.x, ev.y, '#2c2444', 12); },
  hFrenzy(ev) { if (ev.t !== 'buff') return; // 광란: 핏빛 불기둥 · 피 김 · 빛살
    this.origFx({ s: 'pillar', x: ev.x, y: ev.y + 2, r: 16, h: 50, pal: 'blood', tier: 5, dur: 0.6 }); this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 26, n: 14, pal: 'blood', tier: 5, dur: 0.45 }); this.anims.groundSlam(ev.x, ev.y, 30, 'phys', false);
    for (let i = 0; i < 14; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 16, y: ev.y - 4, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 40, t: 0.8, max: 0.8, color: i % 2 ? '#d0283a' : '#ff8a8a', g: -10, steam: true }); },
  hCounterWall(ev) { if (ev.t !== 'buff') return; // 반격의 벽: 앞에 강철 석판이 솟는다
    const a = facing(this.world), cx = ev.x + Math.cos(a) * 16, cy = ev.y + Math.sin(a) * 10, nx = -Math.sin(a), ny = Math.cos(a);
    this.origFx({ s: 'wall', x1: cx - nx * 24, y1: cy - ny * 14, x2: cx + nx * 24, y2: cy + ny * 14, h: 30, pal: 'metal', tier: 5, dur: 1.1 }); this.origFx({ s: 'rays', x: cx, y: cy - 6, r: 20, n: 10, pal: 'glass', tier: 5, dur: 0.4 }); sfx('hitArmor', { vol: 0.8 }); },
  hRebelBrand(ev) { if (ev.t !== 'skillAoe') return; // 반역의 낙인: 촉수 대신 몸에서 털어 낸 붉은 낙인이 둘레 적에게 박힌다
    this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 36, n: 16, pal: 'blood', tier: 5, dur: 0.5 }); this.origFx({ s: 'sigil', x: ev.x, y: ev.y, r: ev.r * 0.6, n: 5, pal: 'blood', tier: 5, dur: 1.2 });
    for (const e of near(this.world, ev.x, ev.y, ev.r)) { this.origFx({ s: 'tether', x1: ev.x, y1: ev.y - 8, x2: e.x, y2: e.y - 8, w: 2.4, pal: 'blood', dur: 0.35 }); this.origFx({ s: 'mark', x: e.x, y: e.y, icon: 'brand', pal: 'blood', tier: 4, dur: 1.4 }); }
    this.shake = Math.max(this.shake, 8); this.addStop(0.08); sfx('hitHeavy', { vol: 1, rate: 0.6 }); return true; },
  hBloodFeast(ev) { if (ev.t !== 'skillAoe') return; // 피의 축제: 둘레 적에게서 피 줄기가 나에게 빨려 든다 · 피 소용돌이
    this.origFx({ s: 'swirl', x: ev.x, y: ev.y + 6, r: ev.r * 0.6, n: 4, pal: 'blood', tier: 5, dur: 0.8, ccw: true }); this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 30, n: 14, pal: 'blood', tier: 5, dur: 0.45 });
    for (const e of near(this.world, ev.x, ev.y, ev.r)) { this.origFx({ s: 'tongue', x1: e.x, y1: e.y - 8, x2: ev.x, y2: ev.y - 8, w: 2.6, pal: 'blood', dur: 0.5 }); this.origFx({ s: 'burst', x: e.x, y: e.y, r: 12, pal: 'blood', tier: 4, dur: 0.3 }); }
    this.shake = Math.max(this.shake, 7); this.addStop(0.06); sfx('hitHeavy', { vol: 0.9, rate: 0.7 }); return true; },
  hDeathBell(ev) { if (ev.t !== 'skillAoe') return; // 죽음의 종: 머리 위에 종이 울리고, 울림이 바람결로 퍼진다 · 적 머리 위 해골
    this.origFx({ s: 'bell', x: ev.x, y: ev.y, r: 18, h: 56, pal: 'bone', tier: 5, dur: 1.3 }); this.origFx({ s: 'sigil', x: ev.x, y: ev.y, r: 40, n: 5, pal: 'curse', tier: 4, dur: 1.3 }); this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 26, n: 14, pal: 'curse', tier: 5, dur: 0.45 });
    this.origFx({ s: 'rays', x: ev.x, y: ev.y - 40, r: 24, n: 12, pal: 'curse', tier: 5, dur: 0.5 });
    for (const e of near(this.world, ev.x, ev.y, ev.r)) this.origFx({ s: 'mark', x: e.x, y: e.y, icon: 'skull', pal: 'curse', tier: 4, dur: 1.6 });
    this.shake = Math.max(this.shake, 6); sfx('reaction', { vol: 1, rate: 0.4 }); sfx('levelup', { vol: 0.4, rate: 0.5 }); return true; },
  hManaSurge(ev) { if (ev.t !== 'buff') return; // 마력 폭주: 보랏빛 기둥 · 땅의 문양 · 떠오르는 불 글자
    this.origFx({ s: 'pillar', x: ev.x, y: ev.y + 2, r: 18, h: 60, pal: 'curse', tier: 5, dur: 0.8 }); this.origFx({ s: 'sigil', x: ev.x, y: ev.y + 2, r: 26, n: 5, pal: 'curse', tier: 4, dur: 1.6 });
    this.origFx({ s: 'swirl', x: ev.x, y: ev.y + 4, r: 30, n: 4, pal: 'curse', tier: 5, dur: 1.2 }); for (const dx of [-16, 16]) this.origFx({ s: 'glyph', x: ev.x + dx, y: ev.y - 10, r: 4, pal: 'curse', tier: 4, dur: 1 }); },
  hSoulCall(ev) { if (ev.t !== 'skillFx') return; // 영혼 소집: 혼불이 땅에서 피어 오르고 소용돌이
    this.origFx({ s: 'swirl', x: ev.x, y: ev.y + 4, r: 34, n: 3, pal: 'wind', tier: 5, dur: 1 }); for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; this.origFx({ s: 'orb', x: ev.x + Math.cos(a) * 18, y: ev.y + Math.sin(a) * 8, r: 4, h: 18, pal: 'ice', tier: 5, dur: 0.9 }); }
    this.origFx({ s: 'sigil', x: ev.x, y: ev.y + 2, r: 26, n: 5, pal: 'ice', tier: 5, dur: 1.2 }); },
  hBubble(ev) { if (ev.t !== 'skillAoe' || ev.fx !== 'splash') return; // 물풍선: 적을 감싸는 물방울 · 물기둥 · 물보라
    if ((ev.r || 0) >= 22) { this.origFx({ s: 'orb', x: ev.x, y: ev.y + 10, r: 13, h: 12, pal: 'water', tier: 5, dur: 1 }); this.origFx({ s: 'pillar', x: ev.x, y: ev.y + 2, r: 14, h: 40, pal: 'water', tier: 5, dur: 0.5 }); }
    this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 14, n: 10, pal: 'water', tier: 4, dur: 0.35 }); this.origFx({ s: 'splat', x: ev.x, y: ev.y + 3, r: 14, pal: 'water', tier: 4, dur: 1 }); sfx('freeze', { vol: 0.5, rate: 0.7 }); return true; },
  hDoppel(ev) { if (ev.t !== 'summonFx' && ev.t !== 'skillFx') return; // 분신: 내 발밑 그림자가 갈라져 일어선다
    if (ev.t === 'skillFx') { this.origFx({ s: 'splat', x: ev.x, y: ev.y + 3, r: 13, pal: 'ink', tier: 5, dur: 1 }); this.origFx({ s: 'swirl', x: ev.x, y: ev.y + 4, r: 26, n: 3, pal: 'shadow', tier: 5, dur: 0.8 }); this.origFx({ s: 'rays', x: ev.x, y: ev.y - 4, r: 20, n: 10, pal: 'shadow', tier: 5, dur: 0.4 }); return; }
    this.origFx({ s: 'ghost', x: ev.x, y: ev.y, r: 18, ang: -Math.PI / 2, n: 5, spread: 2, pal: 'shadow', tier: 5, dur: 0.5 }); this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 14, n: 10, pal: 'shadow', tier: 5, dur: 0.4 }); return true; },
  hChiefCall(ev) { if (ev.t === 'buff') { this.origFx({ s: 'burst', x: ev.x, y: ev.y, r: 30, n: 14, pal: 'fire', tier: 5, dur: 0.45 }); this.origFx({ s: 'rays', x: ev.x, y: ev.y - 6, r: 30, n: 12, spread: 2.6, ang: -Math.PI / 2, pal: 'fire', tier: 5, dur: 0.5 }); this.anims.groundSlam(ev.x, ev.y, 40, 'phys', true); } },
};
// 침묵: 둘레로 퍼지는 고리(타원) 대신 땅에 그은 봉인 문양 · 적 머리 위 봉인 표식
function silenceFx(ev, tier) {
  if (ev.t !== 'silence') return;
  this.origFx({ s: 'sigil', x: ev.x, y: ev.y, r: Math.min(60, ev.r * 0.45), n: 5, pal: 'curse', tier, dur: 1.2 }); this.origFx({ s: 'rays', x: ev.x, y: ev.y - 6, r: tier >= 5 ? 30 : 20, n: 12, pal: 'curse', tier, dur: 0.45 });
  for (const e of near(this.world, ev.x, ev.y, ev.r, 8)) this.origFx({ s: 'mark', x: e.x, y: e.y, icon: 'z', pal: 'curse', tier: 3, dur: 1.5 });
  this.rimFlash = { color: '#d8c8ff', t: 0.5, max: 0.5 }; this.shake = Math.max(this.shake, tier >= 5 ? 6 : 3);
  if (tier >= 5) this.ultName = { text: '「침묵」', color: '#d8c8ff', t: 1.2, max: 1.2 };
  sfx('reaction', { vol: 0.8, rate: 0.5 }); return true;
}

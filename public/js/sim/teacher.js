// 숨은 스승의 시련 (data/hidden.js TEACHERS): 40층의 주인을 쓰러뜨린 무기 갈래의 스승과 「스승의 방」에서 싸운다.
// · 스승은 이기면 받는 각인의 스킬(발도 · 피로 쓴 함성 · 마력 폭주 · 리치 · 그림자 손 · 천궁의 화살비 · 원시의 돌진 · 용암 균열)을 쓴다
// · 딜로 밀어붙일 수 없다: 스승의 체력은 내 공격력에 맞춰 정해지고(TR.hpMul · 제대로 든 공격 약 스물다섯 번), 한 대에 들어가는 피해는 스승 체력의 4%까지.
//   그 무기를 이해한 공격(검은 빈틈 · 창은 창끝 거리 …)만 제대로 들어가고, 나머지는 0.4%까지만 (TR.okCap · TR.badCap)
// · 스승의 공격은 내 최대 체력 비율로 들어온다 (내가 세져도 똑같이 아프다). 내 체력이 다하면 실패 (죽지는 않는다)
// TeacherMethods 는 World.prototype 에 붙는다 (sim/world.js 끝) — 메서드 안의 this 는 World
import { TEACHERS } from '../data/hidden.js';
const DT = 1 / 60; // sim/world.js 의 DT 와 같다 (world.js 를 가져오면 서로 물린다)

// 무기 → 스승 갈래
export function weaponFam(b) {
  const it = b?.weaponItem, c = b?.wcat;
  if (!it) return 'sword';
  if (it.weapon?.dmg === 'mag' || ['staff', 'tome'].includes(c)) return 'magic';
  if (c === 'blade') return it.weapon?.scale === 'agi' ? 'dagger' : 'sword';
  if (c === 'great' || c === 'shield') return 'sword';
  if (c === 'axe' || c === 'blunt') return 'heavy';
  if (c === 'scythe' || c === 'whip') return 'scythe';
  if (c === 'throw') return 'dagger';
  if (c === 'bow' || c === 'tube') return 'bow';
  if (c === 'fist') return 'fist';
  if (c === 'polearm') return 'spear';
  return 'sword';
}

export const TR = {
  hpMul: 25,      // 스승 체력 = 내 공격력 × 25 (제대로 든 평타 약 스물다섯 번)
  okCap: 0.04,    // 무기를 이해한 공격: 한 대에 스승 체력의 4%까지
  badCap: 0.004,  // 그 밖의 공격: 0.4%까지
  hit: 0.08,      // 스승의 보통 공격: 내 최대 체력의 8%
  sig: 0.22,      // 스승의 각인 스킬: 22%
  sigEvery: 7,    // 각인 스킬 간격 (초)
};
const SPD = { sword: 72, heavy: 60, magic: 0, scythe: 0, dagger: 0, bow: 60, fist: 92, spear: 112 };
const SIG_NAME = { sword: '발도', heavy: '피로 쓴 함성', magic: '마력 폭주', scythe: '망자의 낫', dagger: '그림자 손', bow: '천궁의 화살비', fist: '원시의 돌진', spear: '용암 균열' };

export const TeacherMethods = {
  startTrial(fam) {
    const T = TEACHERS[fam]; if (!T) return;
    const p = this.player, d = this.d, lx = (this.map.lair?.x ?? Math.floor(this.tw / 2)) * 16 + 8, ly = (this.map.lair?.y ?? Math.floor(this.th / 2)) * 16 + 8;
    for (const e of this.enemies) e.dead = true;
    this.enemies = [];
    const power = Math.max(d.physAtk, d.dexAtk, d.magAtk) * (this.b.wScale?.dmg ?? 1); // 내 공격력에 맞춘다
    const Tr = this.trial = { fam, T, s: 'intro', t: 2.6, bodies: [], chain: 0, lastHit: -9, lastOk: -9, guardN: 0, guardT: 0, brokenT: 0, tok: new Map(), msgT: 0, done: false, cx: lx, cy: ly,
      maxHp: Math.round(power * TR.hpMul), hp: 0, sigT: 4, took: [], revived: false, invulnT: 0, rageT: 0 };
    Tr.hp = Tr.maxHp;
    const mk = (x, y, extra = {}) => { const e = this.makeEnemy(T.mon, x, y, { noAffix: true }); Object.assign(e, { state: 'idle', home: { x, y }, trialOf: fam, champion: T.name, maxHp: Tr.maxHp, hp: Tr.maxHp }, extra); this.enemies.push(e); Tr.bodies.push(e); return e; };
    if (fam === 'scythe') for (let i = 0; i < 3; i++) mk(lx + Math.cos(i * 2.1) * 50, ly + Math.sin(i * 2.1) * 30, { ang: i * 2.1 });
    else if (fam === 'dagger') { for (let i = 0; i < 5; i++) mk(lx, ly, { ang: (i / 5) * Math.PI * 2 }); }
    else mk(lx, ly);
    Tr.main = Tr.bodies[0];
    this.tower = { f: 40, t: 0, hurt: 0, boss: Tr.main }; // 보스 체력 줄을 보여 준다
    for (const [ox, oy] of [[0, 80], [0, 60], [60, 40], [-60, 40], [0, 40]]) if (!this.blocked(lx + ox, ly + oy, 6)) { p.x = lx + ox; p.y = ly + oy; break; } // 스승 앞에 선다
    if (fam === 'dagger') this.trialShuffle();
    p.hp = d.maxHp;
    this.emit({ t: 'banner', text: `${T.name}의 시련`, sub: `${T.hint} · 「${SIG_NAME[fam]}」을 쓴다`, color: '#ffe8a8' });
  },
  trialSay(e, text, color = '#e8e2cf') { this.emit({ t: 'text', x: e.x, y: e.y - 26, text, color }); },
  trialEnd(ok) {
    const Tr = this.trial; if (!Tr || Tr.done) return;
    Tr.done = true;
    if (ok) for (const b of Tr.bodies) { b.dead = true; this.emit({ t: 'death', x: b.x, y: b.y, color: '#e8e2cf', defId: b.defId, dir: b.dir }); }
    this.emit({ t: 'banner', text: ok ? `${Tr.T.name}: 「…됐다. 가져가라.」` : `${Tr.T.name}: 「아직이다.」`, sub: ok ? '시련을 넘었다' : `스승의 남은 체력 ${Math.round((Tr.hp / Tr.maxHp) * 100)}%`, color: ok ? '#fff0a0' : '#ff9a7a' });
    this.delayed.push({ t: 2.2, run: () => this.signals.push({ t: 'trialDone', ok, fam: Tr.fam }) });
  },
  // 내 체력이 다했다 (sim/world.js checkDeath 가 부른다): 실패 · 죽지 않는다
  trialDown() { const p = this.player; p.hp = 1; p.invuln = 3; p.st = {}; this.trialEnd(false); },
  trialNo(e, text) { const Tr = this.trial; if (this.t < Tr.msgT) return; Tr.msgT = this.t + 0.7; this.trialSay(e, text, '#a8b0c0'); },
  // 스승이 받은 공격 (sim/world.js damageEnemy 맨 앞): 제대로 든 공격만 크게, 나머지는 아주 조금
  trialHit(e, amount, type, opt = {}) {
    const Tr = this.trial, p = this.player;
    if (!Tr || Tr.done || Tr.s === 'intro' || e.dead) return 0;
    if (Tr.invulnT > 0) { this.trialNo(e, '죽음을 거부한다'); return 0; }
    const f = Tr.fam;
    let good = false, why = '';
    if (opt.fromDot) good = false;
    else if (f === 'sword') { good = Tr.s === 'open'; why = '칼로 받아냈다 · 휘두른 뒤를 노려라'; }
    else if (f === 'heavy') {
      if (Tr.brokenT > 0) good = true;
      else { Tr.guardN = this.t - Tr.guardT > 2.5 ? 1 : Tr.guardN + 1; Tr.guardT = this.t; if (Tr.guardN >= 3) { Tr.brokenT = 2; Tr.guardN = 0; this.trialSay(e, '막기가 부서졌다!', '#ffb070'); this.emit({ t: 'shake', v: 4 }); good = true; } else why = `막았다 ${Tr.guardN}/3`; }
    } else if (f === 'magic') { good = Tr.s === 'cast' && type === 'mag'; why = type !== 'mag' ? '마법이 아니면 닿지 않는다' : '마력의 벽 · 외는 동안을 노려라'; }
    else if (f === 'scythe') {
      const tok = this.curTok ?? `t${Math.floor(this.t * 8)}`, set = Tr.tok.get(tok) || new Set();
      set.add(e.id); Tr.tok.set(tok, set); if (Tr.tok.size > 40) Tr.tok.clear();
      good = set.size >= 2; why = '하나로는 부족하다 · 둘 이상을 함께 베라';
    } else if (f === 'dagger') {
      if (e !== Tr.main) { e.dead = true; this.emit({ t: 'death', x: e.x, y: e.y, color: '#3a2e48', defId: e.defId }); this.trialSay(Tr.main, '가짜다', '#c8a8ff'); this.trialStrike(Tr.main, p.x, p.y, 0.25, 28); return 0; }
      good = true;
    } else if (f === 'bow') { good = Math.hypot(e.x - p.x, e.y - p.y) >= 90; why = '너무 가깝다 · 멀리서 쏘아라'; }
    else if (f === 'fist') { Tr.chain = this.t - Tr.lastHit <= 0.6 ? Tr.chain + 1 : 1; Tr.lastHit = this.t; good = Tr.chain >= 3; why = `${Tr.chain}연타 · 끊기지 말고 이어라`; }
    else if (f === 'spear') { good = Math.hypot(e.x - p.x, e.y - p.y) - e.r >= (this.b.weapon?.range || 40) * 0.7; why = '발톱 안쪽이다 · 창끝으로 찔러라'; }
    const v = Math.min(amount, Tr.maxHp * (good ? TR.okCap : TR.badCap));
    Tr.hp -= v; Tr.took.push([this.t, v]); e.hitFlash = 0.08;
    this.emit({ t: 'dmg', x: e.x, y: e.y - e.r - 10, v, color: good ? '#ffe066' : '#8a8f9a', small: !good, id: e.id });
    if (good) { Tr.lastOk = this.t; if (f === 'dagger') this.delayed.push({ t: 0.15, run: () => { if (!Tr.done) this.trialShuffle(); } }); }
    else if (why) this.trialNo(e, why);
    if (Tr.hp <= 0) {
      if (f === 'scythe' && !Tr.revived) { // 리치: 한 번은 죽음을 거부한다
        Tr.revived = true; Tr.hp = Tr.maxHp * 0.3; Tr.invulnT = 3; Tr.rageT = 10;
        for (const b of Tr.bodies) { this.emit({ t: 'skillAoe', x: b.x, y: b.y, r: 40, elem: 'dark', fx: 'doom' }); }
        this.emit({ t: 'banner', text: '첫 번째 망자: 「죽음은 나를 거부한다.」', sub: '3초 무적 · 10초 동안 공격 2배', color: '#c45cff' });
      } else this.trialEnd(true);
    }
    return 0;
  },
  // 분신을 다시 늘어세운다 (얼굴 없는 자): 하나가 진짜 (흐리지 않다)
  trialShuffle() {
    const Tr = this.trial, p = this.player, live = Tr.bodies;
    const real = this.rng.int(0, live.length - 1), a0 = this.rng.range(0, Math.PI * 2);
    live.forEach((e, i) => {
      e.dead = false;
      const a = a0 + (i / live.length) * Math.PI * 2; let x = p.x + Math.cos(a) * 72, y = p.y + Math.sin(a) * 48;
      if (this.blocked(x, y, 6)) { x = Tr.cx + Math.cos(a) * 60; y = Tr.cy + Math.sin(a) * 40; }
      this.emit({ t: 'blink', x1: e.x, y1: e.y, x2: x, y2: y }); e.x = x; e.y = y;
      e.fakeGhost = i !== real; if (i === real) Tr.main = e;
      if (!this.enemies.includes(e)) this.enemies.push(e);
    });
    if (this.tower) this.tower.boss = Tr.main;
    Tr.shufT = 3.2;
  },
  trialBlink(e, d) {
    const p = this.player, a = Math.atan2(e.y - p.y, e.x - p.x) + this.rng.range(-0.8, 0.8);
    let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (this.blocked(x, y, 6)) { x = this.trial.cx; y = this.trial.cy; }
    this.emit({ t: 'blink', x1: e.x, y1: e.y, x2: x, y2: y }); e.x = x; e.y = y;
  },
  trialDmg(k) { return this.d.maxHp * k * (this.trial.rageT > 0 ? 2 : 1); }, // 내 최대 체력 비율 (리치가 일어난 뒤 2배)
  // 예고 원 뒤 한 대
  trialStrike(e, x, y, wind = 0.7, r = 34, k = TR.hit, fx = 'quake') {
    this.emit({ t: 'windup', id: e.id }); this.emit({ t: 'telegraphCircle', x, y, r, dur: wind });
    this.delayed.push({ t: wind, run: () => {
      if (!this.trial || this.trial.done || e.dead) return;
      this.emit({ t: 'strike', id: e.id, x, y, ang: Math.atan2(y - e.y, x - e.x) });
      this.emit({ t: 'skillAoe', x, y, r, elem: fx === 'lightRain' ? 'holy' : 'phys', fx });
      const p = this.player; if (Math.hypot(p.x - x, p.y - y) < r + 5) this.hurtPlayer(this.trialDmg(k), 'phys', e, { fromX: e.x, fromY: e.y });
    } });
  },
  // 예고 선 뒤 일직선 (발도 · 돌진 · 용암 균열 · 화살)
  trialLine(e, len, w, wind, k, fx, after) {
    const p = this.player, a = Math.atan2(p.y - e.y, p.x - e.x), dx = Math.cos(a), dy = Math.sin(a);
    this.emit({ t: 'windup', id: e.id }); this.emit({ t: 'telegraph', id: e.id, x: e.x, y: e.y, dx, dy, len, w });
    for (let i = 1; i <= 4; i++) this.emit({ t: 'telegraphCircle', x: e.x + dx * len * i / 4, y: e.y + dy * len * i / 4, r: w / 2, dur: wind });
    this.delayed.push({ t: wind, run: () => {
      if (!this.trial || this.trial.done || e.dead) return;
      const x1 = e.x, y1 = e.y, x2 = x1 + dx * len, y2 = y1 + dy * len;
      this.emit({ t: 'skillLine', x1, y1, x2, y2, w, elem: fx === 'lava' ? 'fire' : 'phys', fx: fx === 'lava' ? 'quake' : fx });
      const q = this.player, t = Math.max(0, Math.min(1, ((q.x - x1) * dx + (q.y - y1) * dy) / len)), cx = x1 + dx * len * t, cy = y1 + dy * len * t;
      if (Math.hypot(q.x - cx, q.y - cy) < w / 2 + 5) this.hurtPlayer(this.trialDmg(k), 'phys', e, { fromX: e.x, fromY: e.y });
      after?.(x2, y2);
    } });
  },
  // 스승의 각인 스킬 (이기면 받는 것과 같은 것)
  trialSig() {
    const Tr = this.trial, e = Tr.main, p = this.player, f = Tr.fam;
    this.trialSay(e, `「${SIG_NAME[f]}」`, '#ffe8a8');
    if (f === 'sword') { Tr.s = 'sig'; Tr.t = 1.2; this.trialLine(e, 200, 30, 0.6, TR.sig, 'skyfall'); } // 칼집에 손을 얹고 0.6초 뒤 한 칼
    else if (f === 'heavy') { // 최근 8초 동안 받은 피해만큼 세게 터뜨린다 → 몰아친 뒤에는 물러나라
      Tr.s = 'sig'; Tr.t = 1.1;
      Tr.took = Tr.took.filter(([t]) => this.t - t <= 8);
      const stored = Tr.took.reduce((a, [, v]) => a + v, 0) / Tr.maxHp; Tr.took = [];
      this.trialStrike(e, e.x, e.y, 0.9, 96, TR.hit + Math.min(0.3, stored * 4), 'rage');
    } else if (f === 'magic') { Tr.s = 'surge'; Tr.t = 3.2; for (let i = 0; i < 6; i++) this.delayed.push({ t: i * 0.5, run: () => { if (!Tr.done) this.trialStrike(e, this.player.x, this.player.y, 0.55, 28, 0.08, 'burst'); } }); } // 마력 폭주: 0.5초마다 주문
    else if (f === 'scythe') { const b = Tr.bodies[this.rng.int(0, Tr.bodies.length - 1)]; this.trialStrike(b, b.x + (p.x - b.x) * 0.5, b.y + (p.y - b.y) * 0.5, 0.8, 70, TR.sig, 'sweep'); }
    else if (f === 'dagger') { // 그림자 손: 둘레를 끌어당긴다 · 내 체력 비율이 스승보다 낮으면 훨씬 아프다
      this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 170, dur: 1.0 });
      this.delayed.push({ t: 1.0, run: () => {
        if (Tr.done) return; const q = this.player;
        if (Math.hypot(q.x - e.x, q.y - e.y) > 170 || q.invuln > 0) return;
        this.emit({ t: 'skillDash', x1: q.x, y1: q.y, x2: e.x, y2: e.y, elem: 'dark' });
        const nx = e.x + (q.x > e.x ? 18 : -18); if (!this.blocked(nx, e.y, 5)) { q.x = nx; q.y = e.y; }
        this.hurtPlayer(this.trialDmg(q.hp / this.d.maxHp < Tr.hp / Tr.maxHp ? 0.45 : TR.sig), 'phys', e, { fromX: e.x, fromY: e.y, direct: true });
      } });
    } else if (f === 'bow') { for (let i = 0; i < 4; i++) this.delayed.push({ t: i * 0.3, run: () => { if (!Tr.done) this.trialStrike(e, this.player.x + this.rng.range(-30, 30), this.player.y + this.rng.range(-20, 20), 0.7, 40, 0.12, 'lightRain'); } }); }
    else if (f === 'fist') { Tr.s = 'sig'; Tr.t = 1.0; this.trialLine(e, 170, 28, 0.55, TR.sig, 'dash', (x2, y2) => { let x = x2, y = y2; while (this.blocked(x, y, 6) && Math.hypot(x - e.x, y - e.y) > 6) { x -= (x2 - e.x) / 20; y -= (y2 - e.y) / 20; } this.emit({ t: 'skillDash', x1: e.x, y1: e.y, x2: x, y2: y }); e.x = x; e.y = y; }); }
    else if (f === 'spear') { Tr.s = 'sig'; Tr.t = 1.4; this.trialLine(e, 190, 30, 0.7, TR.sig, 'lava', () => this.delayed.push({ t: 0.5, run: () => { if (!Tr.done) this.trialLine(e, 190, 30, 0.5, 0.12, 'lava'); } })); } // 갈라진 땅이 한 번 더 터진다
    Tr.sigT = TR.sigEvery;
  },
  stepToward(e, tx, ty, spd) {
    const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1, s = Math.min(l, spd * DT);
    const nx = e.x + (dx / l) * s, ny = e.y + (dy / l) * s;
    if (!this.blocked(nx, e.y, 6)) e.x = nx; if (!this.blocked(e.x, ny, 6)) e.y = ny;
    e.moving = s > 0.1; if (Math.abs(dx) > 1) e.dir = dx > 0 ? 1 : -1;
  },
  trialTick() {
    const Tr = this.trial; if (!Tr || Tr.done) return;
    const p = this.player, e = Tr.main, f = Tr.fam;
    for (const b of Tr.bodies) { b.hp = Math.max(1, Tr.hp); b.maxHp = Tr.maxHp; if (!b.dead) b.dir = p.x > b.x ? 1 : -1; }
    if (Tr.s === 'intro') { if ((Tr.t -= DT) <= 0) { Tr.s = 'move'; Tr.t = 0.5; } return; }
    if (Tr.brokenT > 0) Tr.brokenT -= DT;
    if (Tr.invulnT > 0) Tr.invulnT -= DT;
    if (Tr.rageT > 0) Tr.rageT -= DT;
    Tr.t -= DT; Tr.sigT -= DT;
    const dist = Math.hypot(p.x - e.x, p.y - e.y), toward = () => this.stepToward(e, p.x, p.y, SPD[f] || 70);
    const free = Tr.s === 'move' || Tr.s === 'rest';
    if (Tr.sigT <= 0 && free) return this.trialSig();
    if (Tr.s === 'sig' || Tr.s === 'surge') { if (Tr.t <= 0) { Tr.s = 'move'; Tr.t = 0.6; } return; }
    // 근접 스승 (검 · 몰아치기 · 주먹 · 창): 다가가서 → 예고 → 친다 → 빈틈
    if (f === 'sword' || f === 'heavy' || f === 'fist' || f === 'spear') {
      if (Tr.s === 'move') { if (dist > 26) toward(); if ((dist < 40 && Tr.t <= 0) || Tr.t < -3) { Tr.s = 'wind'; const l = dist || 1; Tr.t = f === 'fist' ? 0.5 : 0.7; this.trialStrike(e, e.x + (p.x - e.x) / l * 24, e.y + (p.y - e.y) / l * 24, Tr.t); } }
      else if (Tr.s === 'wind') { if (Tr.t <= 0) { Tr.s = 'open'; Tr.t = f === 'sword' ? 0.9 : 0.5; if (f === 'sword') this.trialSay(e, '빈틈', '#fff0a0'); if (f === 'spear') this.trialBlink(e, 60); } }
      else if (Tr.s === 'open') { e.hitFlash = f === 'sword' ? 0.05 : 0; if (Tr.t <= 0) { Tr.s = 'move'; Tr.t = f === 'heavy' ? 0.3 : 0.6; } }
    } else if (f === 'magic') { // 순간이동 → 주문을 외는 동안만 들어간다 (외는 동안에도 내 자리에 떨어진다)
      if (Tr.s === 'move') { this.trialBlink(e, 110); Tr.s = 'cast'; Tr.t = 2.2; this.trialSay(e, '주문을 왼다…', '#c8a8ff'); this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 20, dur: 2.2 }); for (const dt of [0.2, 0.9, 1.6]) this.delayed.push({ t: dt, run: () => { if (!Tr.done) this.trialStrike(e, this.player.x, this.player.y, 0.6, 30); } }); }
      else if (Tr.s === 'cast' && Tr.t <= 0) { Tr.s = 'rest'; Tr.t = 1.2; this.trialStrike(e, p.x, p.y, 0.8, 40); }
      else if (Tr.s === 'rest' && Tr.t <= 0) Tr.s = 'move';
    } else if (f === 'scythe') { // 셋이 둘레를 돈다 · 하나씩 번갈아 친다
      for (const b of Tr.bodies) { b.ang += DT * 0.7; this.stepToward(b, p.x + Math.cos(b.ang) * 44, p.y + Math.sin(b.ang) * 30, 90); }
      if (Tr.t <= 0) { const b = Tr.bodies[this.rng.int(0, Tr.bodies.length - 1)]; this.trialStrike(b, p.x, p.y, 0.8, 30); Tr.t = 1.8; }
    } else if (f === 'dagger') {
      if ((Tr.shufT -= DT) <= 0) this.trialShuffle();
      if (Tr.t <= 0) { this.trialStrike(e, p.x, p.y, 0.7, 28); Tr.t = 2.1; }
    } else if (f === 'bow') { // 노궁수: 거리를 벌리며 쏜다 (가까이 오면 물러난다)
      if (dist < 110) this.stepToward(e, e.x - (p.x - e.x), e.y - (p.y - e.y), SPD.bow);
      if (Tr.t <= 0) { Tr.t = 1.6; this.trialLine(e, 260, 14, 0.7, TR.hit, 'arrowBeam'); }
    }
  },
};

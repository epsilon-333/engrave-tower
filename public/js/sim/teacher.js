// 숨은 스승의 시련 (data/hidden.js TEACHERS): 40층의 주인을 쓰러뜨린 무기 갈래의 스승과 「스승의 방」에서 싸운다.
// · 스승은 이기면 받는 각인의 스킬(발도 · 피로 쓴 함성 · 마력 폭주 · 리치 · 그림자 손 · 천궁의 화살비 · 원시의 돌진 · 용암 균열)을 쓴다
// · 딜로 밀어붙일 수 없다: 스승의 체력은 내 공격력에 맞춰 정해지고(TR.hpMul · 제대로 든 공격 약 스물다섯 번), 한 대에 들어가는 피해는 스승 체력의 4%까지.
//   그 무기를 이해한 공격(검은 빈틈 · 창은 창끝 거리 …)만 제대로 들어가고, 나머지는 0.4%까지만 (TR.okCap · TR.badCap)
// · 스승의 공격은 내 최대 체력 비율로 들어온다 (내가 세져도 똑같이 아프다). 내 체력이 다하면 실패 (죽지는 않는다)
// TeacherMethods 는 World.prototype 에 붙는다 (sim/world.js 끝) — 메서드 안의 this 는 World
import { TEACHERS } from '../data/hidden.js';
import { RACE_ART } from '../data/art.js';
import { ITEMS } from '../data/items.js';
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

// 스승의 모습: 내 종족의 상징색(성지 색)을 입힌다 · 무기 갈래마다 크기 · 명암을 조금씩 바꾼다
const RACE_HUE = { wizard: '#b58aff', elf: '#7be38a', knight: '#ffd76a', orc: '#ff7a5a', undead: '#c45cff', assassin: '#8a6aff', dino: '#9be15d', dragon: '#ff8a3a' };
const FAM_LOOK = { sword: [1.25, 1.05, 1.2], heavy: [1.38, 0.9, 1.3], magic: [1.2, 1.12, 1.1], scythe: [1.25, 0.8, 1.35], dagger: [1.15, 0.85, 1.25], bow: [1.2, 1.05, 1.15], fist: [1.32, 0.95, 1.25], spear: [1.3, 1.0, 1.2] }; // 크기 · 밝기 · 대비
export function teacherLook(race, fam) {
  const [scale, br, ct] = FAM_LOOK[fam] || FAM_LOOK.sword;
  return { scale, outline: RACE_HUE[race] || RACE_HUE.knight, tint: `${RACE_ART[race]?.tint ? RACE_ART[race].tint + ' ' : ''}saturate(1.2) brightness(${(br * 0.92).toFixed(2)}) contrast(${(ct + 0.1).toFixed(2)})` }; // 원래 그림의 색은 그대로(피부색이 바뀌지 않게) · 명암만 진하게 · 종족 색은 외곽선과 불티로
}

export const TR = {
  hpMul: 25,      // 스승 체력 = 내 공격력 × 25 (제대로 든 평타 약 스물다섯 번)
  okCap: 0.04,    // 무기를 이해한 공격: 한 대에 스승 체력의 4%까지
  badCap: 0.004,  // 그 밖의 공격: 0.4%까지
  hit: 0.08,      // 스승의 보통 공격: 내 최대 체력의 8%
  sig: 0.22,      // 스승의 각인 스킬: 22%
  sigEvery: 7,    // 각인 스킬 간격 (초)
};
// 스승의 평타 = 든 무기의 실제 동작 (2026-11-19): 준비(무기를 치켜든다) → 휘두른다 → 빈틈. 피해는 내 최대 체력 비율
const ATK = {
  sword: { wind: 0.5, range: 38, arc: 2.0, k: 0.08, kind: 'slash' },
  heavy: { wind: 0.95, range: 44, arc: 2.3, k: 0.11, kind: 'smash' },
  fist: { wind: 0.32, range: 30, arc: 1.5, k: 0.06, kind: 'punch', n: 2 },
  spear: { wind: 0.55, range: 64, arc: 0.45, k: 0.08, kind: 'thrust' },
  scythe: { wind: 0.8, range: 46, arc: 2.8, k: 0.08, kind: 'reap' },
  dagger: { wind: 0.4, range: 28, arc: 1.2, k: 0.08, kind: 'stab' },
};
const HEAL = { n: 3, frac: 0.06, t: 1.5 };   // 체력이 25%씩 줄 때마다 한 번 · 1.5초 자세 · 최대 체력 6% 회복 (제대로 든 공격이 들어가면 끊긴다)
const DASH = { cd: 4.5, dur: 0.2 };          // 대시: 멀면 붙고, 몰리면 빠진다
// 이 갈래의 대표 무기 (플레이어가 같은 갈래 무기를 들었으면 그 무기를 든다)
const FAM_WEAPON = {};
export function teacherWeaponId(b, fam) {
  if (b?.weaponId && weaponFam(b) === fam && b.weaponId !== 'bareHands') return b.weaponId;
  if (FAM_WEAPON[fam]) return FAM_WEAPON[fam];
  const pref = fam === 'scythe' ? 'scythe' : null; // 낫의 스승은 낫을 든다 (채찍도 같은 갈래)
  const all = Object.entries(ITEMS).filter(([, it]) => it.slot === 'weapon' && it.weapon).sort((x, y) => (x[1].cat === pref ? 0 : 1) - (y[1].cat === pref ? 0 : 1) || (x[1].towerWeapon ? 1 : 0) - (y[1].towerWeapon ? 1 : 0) || (x[1].price || 0) - (y[1].price || 0)); // 일반 무기 먼저 (낫 · 채찍은 탑 무기뿐)
  for (const [id, it] of all) if (weaponFam({ weaponItem: it, wcat: it.cat }) === fam) return (FAM_WEAPON[fam] = id);
  return (FAM_WEAPON[fam] = 'rustySword');
}
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
    const look = teacherLook(this.b.race, fam);
    const mk = (x, y, extra = {}) => { const e = this.makeEnemy(T.mon, x, y, { noAffix: true }); Object.assign(e, { state: 'idle', home: { x, y }, trialOf: fam, champion: T.name, maxHp: Tr.maxHp, hp: Tr.maxHp, raceLook: this.b.race, tintX: look.tint, scale: look.scale, outline: look.outline }, extra); this.enemies.push(e); Tr.bodies.push(e); return e; };
    if (fam === 'scythe') for (let i = 0; i < 3; i++) mk(lx + Math.cos(i * 2.1) * 50, ly + Math.sin(i * 2.1) * 30, { ang: i * 2.1 });
    else if (fam === 'dagger') { for (let i = 0; i < 5; i++) mk(lx, ly, { ang: (i / 5) * Math.PI * 2 }); }
    else mk(lx, ly);
    Tr.wid = teacherWeaponId(this.b, fam); Tr.dashCd = 2.5; Tr.okHits = []; Tr.heals = 0; Tr.dash = null;
    for (const b of Tr.bodies) b.held = { id: Tr.wid, ang: 0, off: 0, kind: fam };
    Tr.main = Tr.bodies[0];
    this.tower = { f: 40, t: 0, hurt: 0, boss: Tr.main }; // 보스 체력 줄을 보여 준다
    for (const [ox, oy] of [[0, 80], [0, 60], [60, 40], [-60, 40], [0, 40]]) if (!this.blocked(lx + ox, ly + oy, 6)) { p.x = lx + ox; p.y = ly + oy; break; } // 스승 앞에 선다
    if (fam === 'dagger') this.trialShuffle();
    p.hp = d.maxHp;
    this.emit({ t: 'banner', text: `${T.name}의 시련`, sub: `${T.hint} · 무기를 들고 싸운다 · 대시와 회복을 쓴다 · 「${SIG_NAME[fam]}」`, color: '#ffe8a8' });
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
    else if (f === 'sword') { good = Tr.s === 'open' || Tr.s === 'heal'; why = '칼로 받아냈다 · 휘두른 뒤를 노려라'; }
    else if (f === 'heavy') {
      if (Tr.brokenT > 0) good = true;
      else { Tr.guardN = this.t - Tr.guardT > 2.5 ? 1 : Tr.guardN + 1; Tr.guardT = this.t; if (Tr.guardN >= 3) { Tr.brokenT = 2; Tr.guardN = 0; this.trialSay(e, '막기가 부서졌다!', '#ffb070'); this.emit({ t: 'shake', v: 4 }); good = true; } else why = `막았다 ${Tr.guardN}/3`; }
    } else if (f === 'magic') { good = (Tr.s === 'cast' || Tr.s === 'heal') && type === 'mag'; why = type !== 'mag' ? '마법이 아니면 닿지 않는다' : '마력의 벽 · 외는 동안을 노려라'; }
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
    if (good) { Tr.lastOk = this.t; Tr.okHits.push(this.t); Tr.okHits = Tr.okHits.filter((t) => this.t - t < 3);
      if (Tr.s === 'heal') { Tr.s = ['sword', 'heavy', 'fist', 'spear'].includes(f) ? 'open' : 'move'; Tr.t = 0.8; this.trialSay(e, '회복이 끊겼다!', '#ffb070'); this.emit({ t: 'shake', v: 3 }); } if (f === 'dagger') this.delayed.push({ t: 0.15, run: () => { if (!Tr.done) this.trialShuffle(); } }); }
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
  // ───── 무기를 든 스승의 동작 ─────
  trialDash(e, ang, dist) {
    const Tr = this.trial; let d = Math.max(20, dist);
    while (d > 12 && this.blocked(e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d, 6)) d -= 8;
    if (d <= 12) { Tr.dashCd = 1; return; }
    const x1 = e.x + Math.cos(ang) * d, y1 = e.y + Math.sin(ang) * d;
    Tr.dash = { x0: e.x, y0: e.y, x1, y1, t0: this.t, dur: DASH.dur }; Tr.dashCd = DASH.cd; e.dir = Math.cos(ang) >= 0 ? 1 : -1;
    this.emit({ t: 'meleeStep', x1: e.x, y1: e.y, x2: x1, y2: y1, elem: 'phys' });
  },
  beginAtk(e, fam) {
    const A = ATK[fam] || { wind: 0.7, range: 190, arc: 0, k: TR.hit, kind: 'shoot' }, p = this.player;
    e.tatk = { fam, cfg: A, t0: this.t, wind: fam === 'bow' ? 0.8 : A.wind, ang: Math.atan2(p.y - e.y, p.x - e.x), hit: false, n: 1 };
    this.emit({ t: 'windup', id: e.id });
  },
  // 준비(무기를 치켜든다 · 겨누는 쪽을 따라간다) → 휘두름(맞는 자리가 정해진다) → 거두기
  tickAtk(e) {
    const Tr = this.trial, p = this.player, H = e.held; if (!H) return;
    const A = e.tatk, toward = Math.atan2(p.y - e.y, p.x - e.x), dir = Math.cos(toward) >= 0 ? 1 : -1;
    H.off = 0;
    if (!A) { // 서 있을 때: 무기를 비스듬히 든다
      H.ang = toward - dir * (H.kind === 'magic' ? 1.25 : H.kind === 'spear' ? 0.5 : 0.95); H.pull = 0; return;
    }
    const el = this.t - A.t0, k = A.cfg.kind;
    if (!A.hit && el < A.wind * 0.65) A.ang = toward; // 겨누는 것은 준비의 앞쪽만 · 뒤에는 고정(피할 수 있다)
    e.dir = Math.cos(A.ang) >= 0 ? 1 : -1;
    const dd = Math.cos(A.ang) >= 0 ? 1 : -1;
    if (el < A.wind) { // 준비
      const w = el / A.wind;
      H.ang = k === 'thrust' ? A.ang : k === 'shoot' ? A.ang : A.ang - dd * (0.9 + 1.2 * w);
      if (k === 'thrust') H.off = -6 * w; H.pull = k === 'shoot' ? w : 0;
      return;
    }
    if (!A.hit) { A.hit = true; this.trialSwingHit(e, A); }
    const s = Math.min(1, (el - A.wind) / 0.2);
    H.pull = 0;
    H.ang = k === 'thrust' ? A.ang : k === 'shoot' ? A.ang : k === 'smash' ? A.ang - dd * (2.1 - 2.5 * s) : A.ang - dd * (2.1 - 3.2 * s);
    if (k === 'thrust') H.off = -6 + 16 * Math.sin(s * Math.PI * 0.5);
    if (el >= A.wind + 0.2) { // 주먹은 두 번 이어 친다
      if (A.cfg.n > A.n) { A.n++; A.t0 = this.t; A.wind = 0.28; A.hit = false; A.ang = toward; this.emit({ t: 'windup', id: e.id }); }
      else e.tatk = null;
    }
  },
  trialSwingHit(e, A) {
    const p = this.player, C = A.cfg, a = A.ang, dir = Math.cos(a) >= 0 ? 1 : -1;
    if (C.kind === 'shoot') { // 활: 화살이 일직선으로 날아간다 (피할 수 있다)
      this.emit({ t: 'shoot', x: e.x, y: e.y, ang: a, type: 'phys' });
      this.trialLine(e, 260, 14, 0.05, TR.hit, 'arrowBeam'); return;
    }
    this.emit({ t: 'swing', x: e.x, y: e.y, ang: a, range: C.range, arc: C.arc, heavy: C.kind === 'smash', type: 'phys', dir, dur: C.kind === 'smash' ? 0.24 : 0.14, thrust: C.kind === 'thrust', whip: false, fist: C.kind === 'punch' });
    this.emit({ t: 'strike', id: e.id, x: e.x + Math.cos(a) * C.range * 0.6, y: e.y + Math.sin(a) * C.range * 0.6, ang: a });
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    const da = Math.abs(((Math.atan2(dy, dx) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d <= C.range + 6 && da <= C.arc / 2 + 0.25) this.hurtPlayer(this.trialDmg(C.k), 'phys', e, { fromX: e.x, fromY: e.y });
    if (C.kind === 'smash') this.emit({ t: 'shake', v: 3 });
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
    if (wind >= 0.1) { // 각인 스킬(예고 선) · 활의 화살은 준비 자세가 예고라서 선을 그리지 않는다
      this.emit({ t: 'windup', id: e.id }); this.emit({ t: 'telegraph', id: e.id, x: e.x, y: e.y, dx, dy, len, w });
      for (let i = 1; i <= 4; i++) this.emit({ t: 'telegraphCircle', x: e.x + dx * len * i / 4, y: e.y + dy * len * i / 4, r: w / 2, dur: wind });
    }
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
    for (const b of Tr.bodies) this.tickAtk(b);                  // 무기를 휘두르는 동작 (준비 → 휘두름)
    Tr.dashCd -= DT;
    if (Tr.dash) { const D = Tr.dash, k = Math.min(1, (this.t - D.t0) / D.dur); e.x = D.x0 + (D.x1 - D.x0) * k; e.y = D.y0 + (D.y1 - D.y0) * k; e.moving = true; if (k >= 1) { Tr.dash = null; Tr.t = Math.min(Tr.t, 0.1); } return; }
    const free = Tr.s === 'move' || Tr.s === 'rest';
    // 회복: 체력이 25%씩 줄 때마다 한 번, 자세를 잡는 1.5초 동안 제대로 든 공격이 들어오면 끊긴다
    if (free && Tr.heals < HEAL.n && Tr.hp <= Tr.maxHp * (1 - 0.25 * (Tr.heals + 1)) && !e.tatk) {
      Tr.heals++; Tr.s = 'heal'; Tr.t = HEAL.t; e.moving = false;
      this.trialSay(e, '숨을 고른다…', '#9be8a0'); this.emit({ t: 'windup', id: e.id }); return;
    }
    if (Tr.s === 'heal') {
      e.moving = false;
      if (Tr.t <= 0) {
        const from = Tr.hp / Tr.maxHp; Tr.hp = Math.min(Tr.maxHp, Tr.hp + Tr.maxHp * HEAL.frac);
        this.emit({ t: 'bossHeal', id: e.id, x: e.x, y: e.y, from, to: Tr.hp / Tr.maxHp, big: false });
        this.emit({ t: 'dmg', x: e.x, y: e.y - e.r - 10, v: Math.round(Tr.maxHp * HEAL.frac), color: '#7be38a', small: true, id: e.id });
        Tr.s = 'move'; Tr.t = 0.6;
      }
      return;
    }
    if (Tr.sigT <= 0 && free && !e.tatk) return this.trialSig();
    if (Tr.s === 'sig' || Tr.s === 'surge') { if (Tr.t <= 0) { Tr.s = 'move'; Tr.t = 0.6; } return; }
    // 근접 스승 (검 · 몰아치기 · 주먹 · 창): 멀면 대시로 붙고 → 무기를 치켜들고(준비) → 휘두르고 → 빈틈. 몰리면 대시로 빠진다
    if (f === 'sword' || f === 'heavy' || f === 'fist' || f === 'spear') {
      if (Tr.s === 'move') {
        if (Tr.dashCd <= 0) {
          const pressed = Tr.okHits.filter((t) => this.t - t < 2.5).length >= 2;
          if (dist > 120) { this.trialDash(e, Math.atan2(p.y - e.y, p.x - e.x), Math.min(dist - 34, 100)); return; }
          if (pressed && dist < 60) { this.trialDash(e, Math.atan2(e.y - p.y, e.x - p.x), 80); Tr.okHits = []; return; }
        }
        if (dist > 26) toward();
        if ((dist < 44 && Tr.t <= 0) || Tr.t < -3) { Tr.s = 'wind'; this.beginAtk(e, f); }
      } else if (Tr.s === 'wind') {
        if (!e.tatk) { Tr.s = 'open'; Tr.t = f === 'sword' ? 0.9 : 0.5; if (f === 'sword') this.trialSay(e, '빈틈', '#fff0a0'); if (f === 'spear' && Tr.dashCd <= 0) this.trialDash(e, Math.atan2(e.y - p.y, e.x - p.x), 60); } // 창: 찌른 뒤 물러난다
      } else if (Tr.s === 'open') { e.hitFlash = f === 'sword' ? 0.05 : 0; if (Tr.t <= 0) { Tr.s = 'move'; Tr.t = f === 'heavy' ? 0.3 : 0.6; } }
    } else if (f === 'magic') { // 순간이동 → 주문을 외는 동안만 들어간다 (외는 동안에도 내 자리에 떨어진다)
      if (Tr.s === 'move') { this.trialBlink(e, 110); Tr.s = 'cast'; Tr.t = 2.2; this.trialSay(e, '주문을 왼다…', '#c8a8ff'); this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 20, dur: 2.2 }); for (const dt of [0.2, 0.9, 1.6]) this.delayed.push({ t: dt, run: () => { if (!Tr.done && Tr.s === 'cast') this.trialStrike(e, this.player.x, this.player.y, 0.6, 30); } }); }
      else if (Tr.s === 'cast' && Tr.t <= 0) { Tr.s = 'rest'; Tr.t = 1.2; this.trialStrike(e, p.x, p.y, 0.8, 40); }
      else if (Tr.s === 'rest' && Tr.t <= 0) Tr.s = 'move';
    } else if (f === 'scythe') { // 셋이 둘레를 돈다 · 하나씩 번갈아 낫을 크게 휘두른다
      for (const b of Tr.bodies) { b.ang += DT * 0.7; if (!b.tatk) this.stepToward(b, p.x + Math.cos(b.ang) * 44, p.y + Math.sin(b.ang) * 30, 90); }
      if (Tr.t <= 0) { const b = Tr.bodies[this.rng.int(0, Tr.bodies.length - 1)]; this.beginAtk(b, 'scythe'); Tr.t = 1.8; }
    } else if (f === 'dagger') { // 분신 다섯 중 하나가 진짜 · 가까이 파고들어 빠르게 찌른다
      if ((Tr.shufT -= DT) <= 0) this.trialShuffle();
      if (Tr.t <= 0) { if (Math.hypot(p.x - e.x, p.y - e.y) > 36) this.trialDash(e, Math.atan2(p.y - e.y, p.x - e.x), Math.hypot(p.x - e.x, p.y - e.y) - 24); this.beginAtk(e, 'dagger'); Tr.t = 2.1; }
    } else if (f === 'bow') { // 노궁수: 거리를 벌리며 쏜다 (가까이 오면 대시로 물러난다)
      if (dist < 110 && Tr.dashCd <= 0) { this.trialDash(e, Math.atan2(e.y - p.y, e.x - p.x), 90); return; }
      if (dist < 110) this.stepToward(e, e.x - (p.x - e.x), e.y - (p.y - e.y), SPD.bow);
      if (Tr.t <= 0 && !e.tatk) { Tr.t = 1.6; this.beginAtk(e, 'bow'); }
    }
  },
};

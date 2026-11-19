// 숨은 스승의 시련 (data/hidden.js TEACHERS): 40층의 주인을 쓰러뜨린 무기 갈래의 스승과 「스승의 방」에서 싸운다.
// · 스승은 이기면 받는 각인의 스킬(발도 · 피로 쓴 함성 · 마력 폭주 · 리치 · 그림자 손 · 천궁의 화살비 · 원시의 돌진 · 용암 균열)을 쓴다
// · 딜로 밀어붙일 수 없다: 스승의 체력은 내 공격력에 맞춰 정해지고(TR.hpMul · 제대로 든 공격 약 스물다섯 번), 한 대에 들어가는 피해는 스승 체력의 4%까지.
//   그 무기를 이해한 공격(검은 빈틈 · 창은 창끝 거리 …)만 제대로 들어가고, 나머지는 0.4%까지만 (TR.okCap · TR.badCap)
// · 스승의 공격은 내 최대 체력 비율로 들어온다 (내가 세져도 똑같이 아프다). 내 체력이 다하면 실패 (죽지는 않는다)
// TeacherMethods 는 World.prototype 에 붙는다 (sim/world.js 끝) — 메서드 안의 this 는 World
import { WCOMBO, comboFam } from '../data/wcombo.js';
import { computeBuild } from './build.js';
import { RACES } from '../data/races.js';
import { TEACHERS } from '../data/hidden.js';
import { SIG_SKILL } from './teacherskills.js';
import { RACE_ART, weaponArt } from '../data/art.js';
import { ITEMS, WEAPON_SKILLS } from '../data/items.js';
const DT = 1 / 60; // sim/world.js 의 DT 와 같다 (world.js 를 가져오면 서로 물린다)

// 무기 → 스승 갈래
export function weaponFam(b) {
  const it = b?.weaponItem, c = b?.wcat;
  if (!it) return 'sword';
  if (it.weapon?.dmg === 'mag' || ['staff', 'tome'].includes(c)) return 'magic';
  if (c === 'blade') return it.weapon?.scale === 'agi' ? 'dagger' : 'sword';
  if (c === 'great' || c === 'shield') return 'sword';
  if (c === 'axe' || c === 'blunt' || c === 'whip') return 'heavy'; // 채찍 → 피 묻은 사슬의 챔피언 (2026-11-19)
  if (c === 'scythe') return 'scythe';
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
  hpMul: 50,      // 스승 체력 = 내 레벨 기준 공격력 × 50 (평타 약 쉰 번 · 체력 막대는 다섯 겹)
  okCap: 0.04,    // 무기를 이해한 공격: 한 대에 스승 체력의 4%까지
  badCap: 0.004,  // 그 밖의 공격: 0.4%까지
  hit: 0.08,      // 스승의 보통 공격: 내 최대 체력의 8%
  sig: 0.22,      // 스승의 각인 스킬: 22%
  sigEvery: 7,    // 각인 스킬 간격 (초)
};
const SIG_MAX = { sword: 200, scythe: 80, fist: 170, spear: 190, dagger: 170 }; // 이기면 받는 스킬: 닿는 거리에서만
const SIG_K = 0.055; // 이기면 받는 스킬의 피해: 플레이어 공격력 100%당 → 스승판은 내 최대 체력 5.5%
// 스승의 평타 = 든 무기의 실제 동작 (2026-11-19): 준비(무기를 치켜든다) → 휘두른다 → 빈틈. 피해는 내 최대 체력 비율
const ATK = {
  sword: { wind: 0.5, range: 38, arc: 2.0, k: 0.08, kind: 'slash' },
  heavy: { wind: 0.85, range: 44, arc: 2.3, k: 0.11, kind: 'smash' },
  fist: { wind: 0.3, range: 30, arc: 1.5, k: 0.05, kind: 'punch', n: 2 },
  spear: { wind: 0.55, range: 64, arc: 0.45, k: 0.08, kind: 'thrust' },
  scythe: { wind: 0.8, range: 46, arc: 2.8, k: 0.08, kind: 'reap' },
  dagger: { wind: 0.4, range: 28, arc: 1.2, k: 0.08, kind: 'stab' },
};
// 플레이어 그림(renderer.playerPose)과 같은 자세표를 쓴다: 무기 종류(kind)마다 동작 안에서 「준비」가 차지하는 비율이 다르다
export function heldKind(id) {
  const it = ITEMS[id], wa = weaponArt(id, ITEMS), wpn = it?.weapon || {};
  return wa.bow ? 'bow' : wa.crossbow ? 'crossbow' : wa.fist ? 'fist' : wa.whip ? 'whip' : wa.orb ? 'orb' : wa.tome ? 'tome' : wa.great ? 'great' : wa.spear ? 'spear' : wa.thrown ? 'axe' : wpn.kind === 'proj' && wpn.dmg === 'mag' ? 'staff' : wpn.boomerang ? 'axe' : wpn.kind === 'proj' ? 'tube' : 'melee';
}
const WIND_FRAC = { melee: 0.2, great: 0.3, axe: 0.35, spear: 0.36, staff: 0.35, whip: 0.3, fist: 0, bow: 0 };
const HEAL = { n: 3, frac: 0.06, t: 1.5 };   // 체력이 25%씩 줄 때마다 한 번 · 1.5초 자세 · 최대 체력 6% 회복 (제대로 든 공격이 들어가면 끊긴다)
const DASH = { cd: 4.5, dur: 0.2 };          // 대시: 멀면 붙고, 몰리면 빠진다
// 무기 능력: 스승은 그 무기를 다룬 자 — 우클릭 무기 능력 같은 기술을 6.5초마다 (이름은 든 무기의 능력 이름)
const WS_NAME = { sword: '회전베기', heavy: '충전 일격', spear: '돌진 찌르기', scythe: '회오리', dagger: '단검 폭풍', bow: '차지 사격', fist: '난타', magic: '서리 고리' };
const BOX_COMBOS = [[0, 1, 2], [0, 2, 3], [1, 3, 4], [0, 0, 2], [3, 4]]; // 복서 스승의 콤보 (잽 0 · 스트레이트 2 · 훅 3 · 어퍼컷 4)
// 이 갈래의 대표 무기 (플레이어가 같은 갈래 무기를 들었으면 그 무기를 든다)
const FAM_WEAPON = {};
export function teacherWeaponId(b, fam) {
  if (b?.weaponId && weaponFam(b) === fam && b.weaponId !== 'bareHands') return b.weaponId;
  if (FAM_WEAPON[fam]) return FAM_WEAPON[fam];
  const pref = fam === 'scythe' ? 'scythe' : null; // 낫의 스승은 낫을 든다
  const all = Object.entries(ITEMS).filter(([, it]) => it.slot === 'weapon' && it.weapon).sort((x, y) => (x[1].cat === pref ? 0 : 1) - (y[1].cat === pref ? 0 : 1) || (x[1].towerWeapon ? 1 : 0) - (y[1].towerWeapon ? 1 : 0) || (x[1].price || 0) - (y[1].price || 0)); // 일반 무기 먼저 (낫 · 채찍은 탑 무기뿐)
  for (const [id, it] of all) if (weaponFam({ weaponItem: it, wcat: it.cat }) === fam) return (FAM_WEAPON[fam] = id);
  return (FAM_WEAPON[fam] = 'rustySword');
}
export const TELE_K = 0.7; // 스승 예고(준비) 시간 배율 — 짧게 (2026-11-19)
// 스승의 스탯 (플레이어와 같은 여덟 가지) — 근력 · 마력: 주는 피해 · 민첩: 회피 · 공격 속도 · 이동 속도 · 체력: 최대 체력 · 감각: 치명타(감각/400 · 1.5배)
//  정신: 스킬 쿨타임(정신/400만큼 짧게) · 물리 저항 · 마법 저항: 받는 피해 감소 (저항/(저항+200))
const TEACHER_STATS = {
  sword: { str: 70, mag: 10, agi: 45, vit: 55, sen: 60, spi: 45, pres: 45, mres: 30 },
  heavy: { str: 90, mag: 5, agi: 15, vit: 80, sen: 30, spi: 35, pres: 70, mres: 25 },
  magic: { str: 10, mag: 95, agi: 40, vit: 35, sen: 45, spi: 80, pres: 15, mres: 70 },
  scythe: { str: 55, mag: 60, agi: 20, vit: 60, sen: 40, spi: 60, pres: 35, mres: 55 },
  dagger: { str: 55, mag: 20, agi: 95, vit: 35, sen: 85, spi: 40, pres: 20, mres: 25 },
  bow: { str: 50, mag: 30, agi: 65, vit: 40, sen: 90, spi: 45, pres: 25, mres: 35 },
  fist: { str: 80, mag: 5, agi: 65, vit: 70, sen: 50, spi: 40, pres: 55, mres: 30 },
  spear: { str: 75, mag: 40, agi: 50, vit: 60, sen: 55, spi: 45, pres: 50, mres: 50 },
};
export const teacherStats = (fam) => TEACHER_STATS[fam];
// 내 레벨에 맞춘 난이도 (쉬우면 안 된다): 레벨 40(스승이 처음 나오는 즈음)이 기준 1, 레벨 100이면 2
//  · 스승의 여덟 스탯이 레벨 40 넘는 만큼 0.6씩 오른다 · 주는 피해 ×(1.2 × √배율) · 준비 · 스킬 사이가 짧아진다
// 레벨 lv의 기준 캐릭터(오크 · 스탯 60% 근력 · 40% 체력 · 맨몸): 스승 체력 = 기준 공격력 × 25, 스승 피해 = 기준 최대 체력 비율
const REF = new Map();
export function teacherRef(lv = 40) {
  lv = Math.max(1, Math.min(100, Math.round(lv || 40))); if (REF.has(lv)) return REF.get(lv);
  const pts = Math.floor((lv - 1) * 1.75), b = computeBuild({ race: 'orc', level: lv, alloc: { str: Math.ceil(pts * 0.6), vit: Math.floor(pts * 0.4) }, engravings: {}, gear: {} }), d = b.derived;
  let hs = 0, hn = 0; for (const race of Object.keys(RACES)) { hs += computeBuild({ race, level: lv, alloc: { str: pts }, engravings: {}, gear: {} }).derived.maxHp; hn++; } // 맞는 쪽 기준 체력: 종족 평균 · 체력에 하나도 안 찍은 몸 (보통 공격 열 대쯤에 쓰러진다)
  const r = { atk: Math.max(d.physAtk, d.dexAtk, d.magAtk), hp: hs / hn }; REF.set(lv, r); return r;
}
export const teacherLvK = (lv = 40) => 1 + Math.max(0, Math.min(60, (lv || 40) - 40)) / 60;
export const teacherStatsAt = (fam, lv = 40) => { const B = TEACHER_STATS[fam] || TEACHER_STATS.sword, up = Math.max(0, Math.min(60, (lv || 40) - 40)) * 0.6; return Object.fromEntries(Object.entries(B).map(([k, v]) => [k, Math.round(v + up)])); };
const SPD = { sword: 72, heavy: 60, magic: 0, scythe: 0, dagger: 0, bow: 60, fist: 92, spear: 112 };
const SIG_NAME = { sword: '발도', heavy: '피로 쓴 함성', magic: '마력 폭주', scythe: '망자의 낫', dagger: '그림자 손', bow: '천궁의 화살비', fist: '원시의 돌진', spear: '용암 균열' };

export const TeacherMethods = {
  startTrial(fam) {
    const T = TEACHERS[fam]; if (!T) return;
    const p = this.player, d = this.d, lx = (this.map.lair?.x ?? Math.floor(this.tw / 2)) * 16 + 8, ly = (this.map.lair?.y ?? Math.floor(this.th / 2)) * 16 + 8;
    for (const e of this.enemies) e.dead = true;
    this.enemies = [];
    const ref = teacherRef(this.b.level), power = ref.atk; // 내 공격력 · 체력이 아니라 내 레벨의 기준 캐릭터에 맞춘다 (무기 · 공속 · 원거리 · 근거리와 상관없이)
    const Tr = this.trial = { fam, T, s: 'intro', t: 2.6, bodies: [], chain: 0, lastHit: -9, lastOk: -9, guardN: 0, guardT: 0, brokenT: 0, tok: new Map(), msgT: 0, done: false, cx: lx, cy: ly,
      lvK: teacherLvK(this.b.level), st: teacherStatsAt(fam, this.b.level), maxHp: Math.round(power * TR.hpMul * (1 + (teacherStatsAt(fam, this.b.level).vit - 50) / 200)), hp: 0, sigT: 4, took: [], revived: false, invulnT: 0, rageT: 0 };
    Tr.hp = Tr.maxHp;
    const look = teacherLook(this.b.race, fam);
    const mk = (x, y, extra = {}) => { const e = this.makeEnemy(T.mon, x, y, { noAffix: true }); Object.assign(e, { state: 'idle', home: { x, y }, trialOf: fam, champion: T.name, maxHp: Tr.maxHp, hp: Tr.maxHp, raceLook: this.b.race, tintX: look.tint, scale: look.scale, outline: look.outline }, extra); this.enemies.push(e); Tr.bodies.push(e); return e; };
    if (false) {} // (첫 번째 망자는 한 명 — 2026-11-19)
    else if (fam === 'dagger') mk(lx, ly); // 본체 하나 — 분신 셋은 함께 벨 때만 본체에서 튀어나온다
    else mk(lx, ly);
    Tr.wid = teacherWeaponId(this.b, fam); Tr.skT = 2.5; Tr.skCd = {}; Tr.zones = []; Tr.minions = []; Tr.corpses = []; Tr.powT = 0; Tr.curseT = 0; Tr.counterT = 0; Tr.wsT = 4.5; Tr.dodgeCd = 0; Tr.strafe = 1; Tr.strafeT = 0.8; Tr.dashCd = 2.5; Tr.okHits = []; Tr.heals = 0; Tr.dash = null;
    for (const b of Tr.bodies) b.held = { id: Tr.wid, kind: fam, toward: 0, swingT: 0, swingMax: 0, swingAng: 0, swingDir: 1, aim: false, dash: false };
    Tr.main = Tr.bodies[0]; Tr.mkBody = mk; Tr.emergeT = -9;
    this.tower = { f: 40, t: 0, hurt: 0, boss: Tr.main }; // 보스 체력 줄을 보여 준다
    for (const [ox, oy] of [[0, 80], [0, 60], [60, 40], [-60, 40], [0, 40]]) if (!this.blocked(lx + ox, ly + oy, 6)) { p.x = lx + ox; p.y = ly + oy; break; } // 스승 앞에 선다
    p.hp = d.maxHp;
    this.emit({ t: 'banner', text: `${T.name}의 시련`, sub: `${T.hint} · 무기를 들고 싸운다 · 대시와 회복을 쓴다 · 「${SIG_NAME[fam]}」`, color: '#ffe8a8' });
  },
  trialSay(e, text, color = '#e8e2cf') { this.emit({ t: 'text', x: e.x, y: e.y - 26, text, color }); },
  trialEnd(ok) {
    const Tr = this.trial; if (!Tr || Tr.done) return;
    Tr.done = true; this.trialSkillEnd();
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
    if (Tr.invulnT > 0) { this.trialNo(e, Tr.invulnMsg || '죽음을 거부한다'); return 0; }
    { // 스승의 민첩: 갈래마다 회피율이 있다 (휘두르는 중 · 회복 자세 · 지속 피해는 못 피한다 · 한 번 피하면 0.7초 동안은 안 피한다)
      const ev = Math.max(0, ((Tr.st?.agi || 0) - 20) / 250); // 민첩 → 회피
      if (ev > 0 && !opt.fromDot && !e.tatk && Tr.s !== 'heal' && Tr.s !== 'cast' && !e.shadowSink && this.t - (Tr.evadeT ?? -9) > 0.7 && this.rng.chance(ev)) {
        Tr.evadeT = this.t; this.emit({ t: 'text', x: e.x, y: e.y - e.r - 12, text: '회피', color: '#cfe8ff' });
        if (!Tr.dash) { const a = Math.atan2(e.y - p.y, e.x - p.x) + (this.rng.chance(0.5) ? 1.4 : -1.4); this.trialDash(e, a, 26, 0.1, Tr.dashCd); }
        return 0;
      }
    }
    if (Tr.counterT > 0 && !opt.fromDot && e === Tr.main) { // 받아치기 · 맞받기: 그 사이에 친 공격은 막히고 되돌아온다
      Tr.counterT = 0; const p0 = this.player, a0 = Math.atan2(p0.y - e.y, p0.x - e.x);
      this.trialSay(e, '받아쳤다!', '#fff0a0'); this.emit({ t: 'block', x: e.x, y: e.y - 6 }); this.emit({ t: 'swing', x: e.x, y: e.y, ang: a0, range: 40, arc: 1.8, type: 'phys', dir: 1, dur: 0.12, heavy: true });
      this.hurtPlayer(this.trialDmg(Tr.counterK || 0.12), 'phys', e, { fromX: e.x, fromY: e.y }); this.knockPlayer(e.x, e.y, 26); return 0;
    }
    const f = Tr.fam;
    if (f === 'dagger' && e !== Tr.main) { e.hitFlash = 0.08; this.trialNo(e, '분신이다'); return 0; } // 분신: 피해만 안 들어간다
    const good = true, why = ''; // 「제대로 든 공격」 규칙은 없앴다 (2026-11-19): 모든 공격이 같이 들어간다 (한 대 상한 4%)
    let v = Math.min(amount, Tr.maxHp * (good ? TR.okCap : TR.badCap));
    if (Tr.shoutT > 0) v *= 0.7; // 대족장의 외침: 받는 피해 -30%
    { const S = Tr.st || {}, R = type === 'mag' ? S.mres || 0 : S.pres || 0; v *= 1 - R / (R + 200); } // 물리 · 마법 저항
    if (Tr.pCurse && Tr.pCurse.until > this.t) v *= Math.max(0.5, 1 - 0.03 * Tr.pCurse.n); // 언데드의 저주: 중첩마다 내가 주는 피해 -3%
    Tr.hp -= v; Tr.took.push([this.t, v]); e.hitFlash = 0.08;
    this.emit({ t: 'dmg', x: e.x, y: e.y - e.r - 10, v, color: good ? '#ffe066' : '#8a8f9a', small: !good, id: e.id });
    if (good) { Tr.lastOk = this.t; Tr.okHits.push(this.t); Tr.okHits = Tr.okHits.filter((t) => this.t - t < 3);
      if (Tr.s === 'heal') { Tr.s = ['sword', 'heavy', 'fist', 'spear'].includes(f) ? 'open' : 'move'; Tr.t = 0.8; this.trialSay(e, '회복이 끊겼다!', '#ffb070'); this.emit({ t: 'shake', v: 3 }); } }
    else if (why) this.trialNo(e, why);
    if (Tr.hp <= 0) {
      if (f === 'scythe' && !Tr.revived) { // 리치: 한 번은 죽음을 거부한다
        Tr.revived = true; Tr.hp = Tr.maxHp * 0.3; Tr.invulnT = 3; Tr.lichMul = 1.5;
        for (const b of Tr.bodies) { this.emit({ t: 'skillAoe', x: b.x, y: b.y, r: 40, elem: 'dark', fx: 'doom' }); }
        this.emit({ t: 'banner', text: '첫 번째 망자: 「죽음은 나를 거부한다.」', sub: '체력 30%로 일어났다 · 이제 공격 1.5배', color: '#c45cff' });
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
  trialDash(e, ang, dist, dur = DASH.dur, cd = DASH.cd) {
    const Tr = this.trial; let d = Math.max(12, dist);
    while (d > 12 && this.blocked(e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d, 6)) d -= 8;
    if (d <= 8) { Tr.dashCd = Math.min(cd, 1); return; }
    const x1 = e.x + Math.cos(ang) * d, y1 = e.y + Math.sin(ang) * d;
    Tr.dash = { x0: e.x, y0: e.y, x1, y1, t0: this.t, dur }; Tr.dashCd = cd; e.dir = Math.cos(ang) >= 0 ? 1 : -1;
    this.emit({ t: 'meleeStep', x1: e.x, y1: e.y, x2: x1, y2: y1, elem: 'phys', foe: true });
  },
  beginAtk(e, fam, over = {}) {
    const A0 = ATK[fam] || { wind: 0.7, range: 190, arc: 0, k: TR.hit, kind: 'shoot' }, A = over.cfg ? { ...A0, ...over.cfg } : A0, p = this.player;
    const wind = (over.wind ?? (fam === 'bow' ? 0.8 : A.wind)) * TELE_K / Math.pow(this.trial?.lvK || 1, 0.25) / (1 + 0.4 * (this.trial?.st?.agi || 0) / ((this.trial?.st?.agi || 0) + 90)) * 1.15 /* 민첩 → 공격 속도 (민첩 50 언저리가 예전 그대로) */, wf = ITEMS[e.held?.id]?.cat === 'blunt' ? 0.8 : WIND_FRAC[heldKind(e.held?.id)] ?? 0.2; // 둔기는 천천히 들고(80%) 빠르게 내려친다
    // 준비는 준비 시간대로(자세표의 준비 구간을 그 시간에 맞춰 늘린다) · 휘두름은 짧고 빠르게 (sd초)
    const sd = fam === 'bow' ? 0.14 : fam === 'fist' ? 0.1 : 0.12; // 휘두름은 빠르게 (준비는 그대로)
    const it = ITEMS[e.held?.id], cf = A.kind !== 'shoot' && fam !== 'fist' && it ? comboFam({ weaponItem: it, weapon: it.weapon, wcat: it.cat }) : null; // 플레이어와 같은 무기 콤보
    let mv = null, wf2 = wf, sd2 = sd;
    if (cf) { e.cmbN = e.cmbFam === cf && this.t - (e.cmbLast ?? -9) < 1.6 ? ((e.cmbN ?? -1) + 1) % WCOMBO[cf].list.length : 0; e.cmbFam = cf; e.cmbLast = this.t; mv = WCOMBO[cf].list[e.cmbN]; wf2 = mv.hit; sd2 = 0.3; }
    e.tatk = { fam, cfg: A, t0: this.t, wind, wf: wf2, sd: sd2, total: wind + sd2, mv, ang: Math.atan2(p.y - e.y, p.x - e.x), hit: false, n: 1, combo: over.combo, cw: over.cw };
    this.emit({ t: 'windup', id: e.id });
  },
  // 준비(겨누는 쪽을 따라간다) → 휘두름(맞는 자리가 정해진다) → 거두기. 모양은 그리는 쪽이 플레이어와 같은 자세표로 그린다 (e.held 에 휘두름 상태만 적는다)
  tickAtk(e) {
    const Tr = this.trial, p = this.player, H = e.held; if (!H) return;
    const toward = Math.atan2(p.y - e.y, p.x - e.x), A = e.tatk;
    H.toward = toward; H.dash = !!(Tr.dash && e === Tr.main);
    if (H.motion) { H.motion.t += DT; if (H.motion.t >= H.motion.dur) H.motion = null; } // 스킬 동작 (플레이어의 p.motion 과 같다)
    if (!A) {
      H.swingT = 0; H.swingMax = 0; H.aim = false;
      if (H.kind === 'magic' && Tr.s === 'cast') { H.swingMax = 0.7; H.swingT = 0.7 - ((this.t - (Tr.castT0 || this.t)) % 0.7); H.swingAng = toward; } // 주문을 외는 동안 지팡이를 휘두르며 빛을 모은다
      return;
    }
    const el = this.t - A.t0, shoot = A.cfg.kind === 'shoot';
    if (!A.hit && el < A.wind * 0.8) { const L = this.trialLead(Math.max(0, A.wind - el) * 0.8); A.ang = Math.atan2(L.y - e.y, L.x - e.x); } // 겨누는 것은 준비의 80%까지 · 내가 갈 자리를 읽고 겨눈다 (마지막 20%는 고정 · 피할 수 있다)
    e.dir = Math.cos(A.ang) >= 0 ? 1 : -1;
    H.swingAng = A.ang; H.swingDir = A.n % 2 ? 1 : -1; H.swingMove = A.mv?.m || null; H.cmbFam = e.cmbFam; H.cmbN = e.cmbN; H.cmbDur = A.mv ? A.wind / Math.max(0.1, A.wf) : 0; H.boxN = A.combo ? A.combo[A.n - 1] : (A.n - 1) % 5;
    if (shoot) {
      if (!A.hit) { H.aim = true; H.swingT = 0; H.swingMax = 0; H.atkPeriod = A.wind; H.atkCd = Math.max(0, A.wind - el); }
      else { H.aim = false; H.swingMax = 0.1; H.swingT = Math.max(0.001, 0.1 - (el - A.wind)); }
    } else { // 자세표의 진행(k): 준비 동안은 0 → 준비 비율, 휘두름 동안은 준비 비율 → 1
      const k = el < A.wind ? A.wf * (el / A.wind) : Math.min(1, A.wf + (1 - A.wf) * ((el - A.wind) / A.sd));
      H.aim = false; H.swingMax = 1; H.swingT = Math.max(0.001, 1 - k);
    }
    if (!A.hit && el >= A.wind) { A.hit = true; this.trialSwingHit(e, A); }
    if (el >= A.total) { // 주먹은 두 번 이어 친다
      if ((A.combo ? A.combo.length : A.cfg.n || 1) > A.n) { A.n++; A.t0 = this.t; A.wind = A.cw ?? 0.28; A.total = A.wind + A.sd; A.hit = false; A.ang = toward; this.emit({ t: 'windup', id: e.id }); }
      else { e.tatk = null; H.swingMove = null; }
    }
  },
  trialSwingHit(e, A) {
    const p = this.player, C = A.cfg, a = A.ang, dir = Math.cos(a) >= 0 ? 1 : -1;
    if (C.kind === 'shoot') { // 활: 화살이 일직선으로 날아간다 (피할 수 있다) · 차지 사격은 굵고 세다
      this.emit({ t: 'shoot', x: e.x, y: e.y, ang: a, type: 'phys' });
      if (C.big) { this.trialRay(e, a, 330, 30, C.k, 'arrowBeam'); this.emit({ t: 'shake', v: 4 }); this.emit({ t: 'hitstop', v: 0.05 }); }
      else this.trialRay(e, a, 260, 14, TR.hit, 'arrowBeam');
      return;
    }
    if (C.spin) { // 회전베기 · 회오리: 몸 둘레를 한 바퀴
      this.emit({ t: 'spin', x: e.x, y: e.y, r: C.range, ang: a, heavy: false, foe: true });
      if (Math.hypot(p.x - e.x, p.y - e.y) <= C.range + 6) this.hurtPlayer(this.trialDmg(C.k), 'phys', e, { fromX: e.x, fromY: e.y });
      return;
    }
    this.emit({ t: 'swing', x: e.x, y: e.y, ang: a, range: C.range, arc: C.arc, heavy: C.kind === 'smash', type: 'phys', dir, dur: C.kind === 'smash' ? 0.24 : 0.14, thrust: C.kind === 'thrust', whip: false, fist: C.kind === 'punch' });
    this.emit({ t: 'strike', id: e.id, x: e.x + Math.cos(a) * C.range * 0.6, y: e.y + Math.sin(a) * C.range * 0.6, ang: a });
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    const da = Math.abs(((Math.atan2(dy, dx) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const hit = d <= C.range + 6 && da <= C.arc / 2 + 0.25;
    if (hit) this.hurtPlayer(this.trialDmg(C.k), 'phys', e, { fromX: e.x, fromY: e.y });
    if (hit && this.trial.fam === 'scythe') this.addPlayerCurse(1); // 첫 번째 망자: 낫에 맞으면 저주 1중첩
    if (hit && C.heal) { const T2 = this.trial, from = T2.hp / T2.maxHp; T2.hp = Math.min(T2.maxHp, T2.hp + T2.maxHp * C.heal); this.emit({ t: 'bossHeal', id: e.id, x: e.x, y: e.y, from, to: T2.hp / T2.maxHp, big: false }); } // 망자의 낫: 맞히면 체력 3%
    const knock = C.knock ?? (C.kind === 'smash' ? 26 : 0) + (A.combo && A.n === A.combo.length && A.combo[A.n - 1] === 4 ? 22 : 0); // 내려찍기 · 어퍼컷은 나를 밀어낸다
    if (hit && knock) this.knockPlayer(e.x, e.y, knock);
    if (C.fx) this.emit({ t: 'skillAoe', x: e.x + Math.cos(a) * C.range * 0.6, y: e.y + Math.sin(a) * C.range * 0.6, r: C.range * 0.6, elem: 'phys', fx: C.fx });
    if (C.kind === 'smash') this.emit({ t: 'shake', v: C.knock ? 5 : 3 });
  },
  // 얼굴 없는 자: 다섯이 한꺼번에 몸을 낮췄다가(0.35초) 나를 꿰뚫고 반대편까지 달리며 벤다 · 길이 나를 지나면 맞는다 (진짜 8% · 가짜 4%)
  beginCross() {
    const Tr = this.trial, p = this.player, M = Tr.main, a0 = this.rng.range(0, Math.PI * 2);
    Tr.cross = { t: 0, spread: 0.22, wind: 0.5, dur: 0.28, list: [] };
    const spots = [];
    for (let i = 0; i < 4; i++) { const a = a0 + (i / 4) * Math.PI * 2; let x = p.x + Math.cos(a) * 70, y = p.y + Math.sin(a) * 50; if (this.blocked(x, y, 6)) { x = p.x + Math.cos(a) * 36; y = p.y + Math.sin(a) * 28; } spots.push([x, y]); }
    const list = [M];
    for (let i = 0; i < 3; i++) { const c = Tr.mkBody(M.x, M.y); c.fakeGhost = true; c.clone = true; c.held = { ...M.held, motion: null }; list.push(c); } // 본체에서 튀어나온다
    list.forEach((b, i) => {
      const [sx, sy] = spots[i]; const a = Math.atan2(p.y - sy, p.x - sx), d = Math.hypot(p.x - sx, p.y - sy);
      let L = Math.min(170, d + 44); while (L > 20 && this.blocked(sx + Math.cos(a) * L, sy + Math.sin(a) * L, 5)) L -= 8;
      Tr.cross.list.push({ b, ox: b.x, oy: b.y, x0: sx, y0: sy, x1: sx + Math.cos(a) * L, y1: sy + Math.sin(a) * L, a, hit: false, k: b === M ? 0.08 : 0.04 });
      this.emit({ t: 'meleeStep', x1: b.x, y1: b.y, x2: sx, y2: sy, elem: 'dark', foe: true });
    });
    this.trialSay(M, '…', '#c8a8ff');
  },
  // 얼굴 없는 자의 그림자 순간이동: 가라앉고(0.3초 · 맞지 않는다) → 다른 자리에서 솟는다(0.25초). 솟은 뒤 1.2초가 노릴 때
  beginShadowSink(e) {
    const Tr = this.trial, p = this.player, a = this.rng.range(0, Math.PI * 2);
    let x = p.x + Math.cos(a) * this.rng.range(55, 90), y = p.y + Math.sin(a) * this.rng.range(40, 70); if (this.blocked(x, y, 6)) { x = e.x; y = e.y; }
    e.shadowSink = { t: 0, sink: 0.3, rise: 0.25, moved: false, x1: x, y1: y };
    Tr.invulnT = 0.55; Tr.invulnMsg = '그림자 속이다';
    this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 14, elem: 'dark', fx: 'doom', lite: true });
  },
  tickShadowSink(e) {
    const S = e.shadowSink, Tr = this.trial; S.t += DT; e.moving = false;
    if (!S.moved && S.t >= S.sink) { S.moved = true; e.x = S.x1; e.y = S.y1; this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 14, elem: 'dark', fx: 'doom', lite: true }); }
    if (S.t >= S.sink + S.rise) { e.shadowSink = null; Tr.emergeT = this.t; this.emit({ t: 'text', x: e.x, y: e.y - 26, text: '지금!', color: '#fff0a0' }); }
  },
  tickCross() {
    const Tr = this.trial, C = Tr.cross; if (!C) return false;
    C.t += DT; const q = this.player;
    if (C.t < C.spread) { const k = C.t / C.spread; for (const o of C.list) { o.b.x = o.ox + (o.x0 - o.ox) * k; o.b.y = o.oy + (o.y0 - o.oy) * k; o.b.moving = true; } return true; } // 본체에서 튀어나와 둘레로 흩어진다
    if (C.t < C.spread + C.wind) { if (!C.wound) { C.wound = true; for (const o of C.list) { o.b.x = o.x0; o.b.y = o.y0; this.emit({ t: 'windup', id: o.b.id }); this.trialMotion(o.b, 'ambush'); o.b.dir = Math.cos(o.a) >= 0 ? 1 : -1; } } return true; }
    const k = Math.min(1, (C.t - C.spread - C.wind) / C.dur);
    for (const o of C.list) {
      if (o.b.dead) continue;
      if (!o.started) { o.started = true; this.emit({ t: 'meleeStep', x1: o.x0, y1: o.y0, x2: o.x1, y2: o.y1, elem: 'dark', foe: true }); }
      const px = o.b.x, py = o.b.y; o.b.x = o.x0 + (o.x1 - o.x0) * k; o.b.y = o.y0 + (o.y1 - o.y0) * k; o.b.moving = true;
      if (!o.hit) {
        const dx = o.b.x - px, dy = o.b.y - py, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((q.x - px) * dx + (q.y - py) * dy) / L2));
        if (Math.hypot(q.x - (px + dx * t), q.y - (py + dy * t)) < 14) { o.hit = true; this.emit({ t: 'swing', x: o.b.x, y: o.b.y, ang: o.a, range: 26, arc: 1.4, type: 'phys', dir: 1, dur: 0.12 }); this.hurtPlayer(this.trialDmg(o.k), 'phys', o.b, { fromX: o.x0, fromY: o.y0 }); }
      }
    }
    if (k >= 1) { // 분신은 그림자 속으로 사라진다
      for (const o of C.list) if (o.b.clone) { this.emit({ t: 'skillAoe', x: o.b.x, y: o.b.y, r: 14, elem: 'dark', fx: 'doom', lite: true }); o.b.dead = true; }
      Tr.bodies = Tr.bodies.filter((b) => !b.clone); this.enemies = this.enemies.filter((x) => !x.clone);
      Tr.cross = null;
    }
    return true;
  },
  // 내 움직임을 읽고 t초 뒤 자리를 앞질러 노린다 (대마도사)
  trialLead(t) { const Tr = this.trial, p = this.player, v = Tr.pv || { x: 0, y: 0 }; const x = p.x + v.x * t, y = p.y + v.y * t; return this.blocked(x, y, 4) ? { x: p.x, y: p.y } : { x, y }; },
  // 언데드의 저주 (나에게): 중첩마다 스승에게 받는 피해 +2% · 스승에게 주는 피해 -3% · 6초 (최대 10중첩)
  addPlayerCurse(n) {
    const Tr = this.trial, p = this.player, c = Tr.pCurse && Tr.pCurse.until > this.t ? Tr.pCurse.n : 0;
    Tr.pCurse = { n: Math.min(10, c + n), until: this.t + 6 };
    this.emit({ t: 'text', x: p.x, y: p.y - 26, text: `저주 ${Tr.pCurse.n}중첩`, color: '#c45cff' });
  },
  // 일직선이 벽에 막히는 거리: 시작점에서 앞으로 나가며 처음 벽을 만나는 곳까지 (화살 · 검기 · 뼈 창이 벽을 뚫지 않는다)
  rayLen(x1, y1, a, len) { const dx = Math.cos(a), dy = Math.sin(a); for (let d = 6; d < len; d += 4) if (this.wallAt(x1 + dx * d, y1 + dy * d)) return Math.max(4, d - 4); return len; },
  trialRay(e, a, len, w, k, fx) {
    const dx = Math.cos(a), dy = Math.sin(a), x1 = e.x, y1 = e.y;
    const L = this.rayLen(x1, y1, a, len); // 벽 앞에서 끊긴다
    const x2 = x1 + dx * L, y2 = y1 + dy * L;
    this.emit({ t: 'skillLine', x1, y1, x2, y2, w, elem: 'phys', fx });
    const q = this.player, t = Math.max(0, Math.min(1, ((q.x - x1) * dx + (q.y - y1) * dy) / L)), cx = x1 + dx * L * t, cy = y1 + dy * L * t;
    if (Math.hypot(q.x - cx, q.y - cy) < w / 2 + 5) { this.hurtPlayer(this.trialDmg(k), 'phys', e, { fromX: e.x, fromY: e.y }); return true; }
    return false;
  },
  // 무기 능력 (6.5초마다): 그 무기를 마스터한 자의 기술
  trialWeaponSkill() {
    const Tr = this.trial, e = Tr.main, p = this.player, f = Tr.fam, a = Math.atan2(p.y - e.y, p.x - e.x);
    const ws = WEAPON_SKILLS[ITEMS[Tr.wid]?.weapon?.skill], name = ws?.name || WS_NAME[f];
    this.trialSay(e, `「${name}」`, '#ffe0a0'); Tr.wsT = 6.5; Tr.s = 'wskill';
    if (f === 'sword') { Tr.t = 0.8; this.beginAtk(e, 'sword', { wind: 0.45, cfg: { range: 46, k: 0.12, spin: true } }); }
    else if (f === 'heavy') { Tr.t = 1.3; this.beginAtk(e, 'heavy', { wind: 0.95, cfg: { range: 62, arc: 1.7, k: 0.16, kind: 'smash', knock: 46, fx: 'quake' } }); }
    else if (f === 'spear') { // 돌진 찌르기: 잠깐 겨눴다가 일직선으로 뚫고 지나간다
      Tr.t = 0.75; this.emit({ t: 'windup', id: e.id });
      this.delayed.push({ t: 0.35, run: () => { if (Tr.done) return; const a2 = Math.atan2(this.player.y - e.y, this.player.x - e.x); const x0 = e.x, y0 = e.y; this.trialDash(e, a2, 120, 0.16, Tr.dashCd); this.delayed.push({ t: 0.16, run: () => { if (Tr.done) return; this.emit({ t: 'swing', x: e.x, y: e.y, ang: a2, range: 40, arc: 0.3, type: 'phys', dir: 1, dur: 0.14, thrust: true }); const q = this.player, L = Math.hypot(e.x - x0, e.y - y0) || 1, t2 = Math.max(0, Math.min(1, ((q.x - x0) * (e.x - x0) + (q.y - y0) * (e.y - y0)) / (L * L))); if (Math.hypot(q.x - (x0 + (e.x - x0) * t2), q.y - (y0 + (e.y - y0) * t2)) < 16) { this.hurtPlayer(this.trialDmg(0.13), 'phys', e, { fromX: x0, fromY: y0 }); this.knockPlayer(x0, y0, 24); } } }); } });
    } else if (f === 'scythe') { // 회오리: 하나가 1초 동안 돌며 둘레를 네 번 벤다
      Tr.t = 1.2; const b = e;
      for (let i = 0; i < 4; i++) this.delayed.push({ t: 0.25 + i * 0.25, run: () => { if (Tr.done || b.dead) return; this.emit({ t: 'spin', x: b.x, y: b.y, r: 50, heavy: false }); if (Math.hypot(this.player.x - b.x, this.player.y - b.y) <= 56) this.hurtPlayer(this.trialDmg(0.05), 'phys', b, { fromX: b.x, fromY: b.y }); } });
    } else if (f === 'dagger') { // 단검 폭풍: 여덟 방향으로 단검을 던진다
      Tr.t = 0.8; this.emit({ t: 'windup', id: e.id });
      this.delayed.push({ t: 0.4, run: () => { if (Tr.done) return; const a0 = this.rng.range(0, Math.PI / 4); for (let i = 0; i < 8; i++) this.trialRay(e, a0 + (i / 8) * Math.PI * 2, 150, 12, 0.07, 'arrowBeam'); } });
    } else if (f === 'bow') { // 차지 사격: 1.2초 동안 시위를 끝까지 당겼다가 굵고 센 한 발 (예고 선이 보인다)
      Tr.t = 1.5; this.beginAtk(e, 'bow', { wind: 1.2, cfg: { k: 0.26, big: true } });
      this.emit({ t: 'telegraph', id: e.id, x: e.x, y: e.y, dx: Math.cos(a), dy: Math.sin(a), len: this.rayLen(e.x, e.y, a, 330), w: 30 }); this.trialSay(e, '차지…', '#ffe8a8');
    } else if (f === 'fist') { // 난타: 파고들어 여섯 번 몰아친다 · 마지막 주먹은 나를 밀어낸다
      Tr.t = 1.1; if (Math.hypot(p.x - e.x, p.y - e.y) > 30) this.trialDash(e, a, Math.hypot(p.x - e.x, p.y - e.y) - 22, 0.1, Tr.dashCd);
      this.beginAtk(e, 'fist', { wind: 0.12, cw: 0.07, combo: [0, 1, 0, 1, 2, 4], cfg: { k: 0.035 } });
    } else { // 서리 고리: 둘레를 얼린다 (밖으로 나가면 피한다)
      Tr.t = 1.0; this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 84, dur: 0.7 });
      this.delayed.push({ t: 0.7, run: () => { if (Tr.done) return; this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 84, elem: 'ice', fx: 'ice' }); if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= 88) { this.hurtPlayer(this.trialDmg(0.1), 'mag', e, { fromX: e.x, fromY: e.y }); this.ccPlayer({ slow: 1.5 }); } } });
    }
  },
  trialBlink(e, d) {
    const p = this.player, a = Math.atan2(e.y - p.y, e.x - p.x) + this.rng.range(-0.8, 0.8);
    let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (this.blocked(x, y, 6)) { x = this.trial.cx; y = this.trial.cy; }
    this.emit({ t: 'blink', x1: e.x, y1: e.y, x2: x, y2: y }); e.x = x; e.y = y;
  },
  trialDmg(k) { const Tr = this.trial, cs = Tr.pCurse && Tr.pCurse.until > this.t ? Tr.pCurse.n : 0, S = Tr.st || {}, crit = this.rng.chance((S.sen || 0) / 400); if (crit) this.emit({ t: 'text', x: this.player.x, y: this.player.y - 30, text: '치명타', color: '#ff7a5a' }); return teacherRef(this.b.level).hp * k * (1 + (Math.max(S.str || 50, S.mag || 50) - 60) / 250) * (crit ? 1.5 : 1) * 1.2 * (Tr.lichMul || 1) * (Tr.powT > 0 ? 1.3 : 1) * (1 + 0.02 * cs); }, // 내 최대 체력 비율 (리치가 일어난 뒤 2배)
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
    const p = this.player, a = Math.atan2(p.y - e.y, p.x - e.x), dx = Math.cos(a), dy = Math.sin(a); len = this.rayLen(e.x, e.y, a, len);
    if (wind >= 0.1) { // 각인 스킬(예고 선) · 활의 화살은 준비 자세가 예고라서 선을 그리지 않는다
      this.emit({ t: 'windup', id: e.id }); this.emit({ t: 'telegraph', id: e.id, x: e.x, y: e.y, dx, dy, len, w });
      for (let i = 1; i <= 4; i++) this.emit({ t: 'telegraphCircle', x: e.x + dx * len * i / 4, y: e.y + dy * len * i / 4, r: w / 2, dur: wind });
    }
    this.delayed.push({ t: wind, run: () => {
      if (!this.trial || this.trial.done || e.dead) return;
      const x1 = e.x, y1 = e.y; len = this.rayLen(x1, y1, a, len); const x2 = x1 + dx * len, y2 = y1 + dy * len;
      this.emit({ t: 'skillLine', x1, y1, x2, y2, w, elem: fx === 'lava' ? 'fire' : 'phys', fx: fx === 'lava' ? 'quake' : fx });
      const q = this.player, t = Math.max(0, Math.min(1, ((q.x - x1) * dx + (q.y - y1) * dy) / len)), cx = x1 + dx * len * t, cy = y1 + dy * len * t;
      if (Math.hypot(q.x - cx, q.y - cy) < w / 2 + 5) this.hurtPlayer(this.trialDmg(k), 'phys', e, { fromX: e.x, fromY: e.y });
      after?.(x2, y2);
    } });
  },
  // 스승의 각인 스킬 = 이기면 받는 스킬을 플레이어가 쓸 때와 똑같이 (범위 · 폭 · 지연 · 효과 그대로, 피해는 공격력 100%당 내 최대 체력 5.5% `SIG_K`)
  trialSig() {
    const Tr = this.trial, e = Tr.main, p = this.player, f = Tr.fam, a = Math.atan2(p.y - e.y, p.x - e.x);
    this.trialSay(e, `「${SIG_NAME[f]}」`, '#ffe8a8');
    this.trialMotion(e, SIG_SKILL[f]); // 플레이어가 이 스킬을 쓸 때와 같은 동작
    this.trialPayback(e);
    Tr.sigT = TR.sigEvery; Tr.s = 'wskill'; Tr.t = 0.8;
    if (f === 'sword') { // 발도: 0.3초 숨을 고른 뒤 앞으로 뻗는 한 칼 · 길이 200 · 폭 30 · 400%
      this.tsRays(e, [a], { len: 200, w: 30, k: 4 * SIG_K, wind: 0.3, fx: 'skyfall', tele: true, shake: 4 });
    } else if (f === 'heavy') { // 대족장의 외침: 5초 동안 받는 피해 -30% (함성 · 몸이 붉게)
      Tr.shoutT = 5; this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 60, elem: 'fire', fx: 'roar' }); this.emit({ t: 'bossHeal', id: e.id, x: e.x, y: e.y, from: 1, to: 1, big: false });
      this.emit({ t: 'text', x: e.x, y: e.y - 30, text: '받는 피해 -30%', color: '#ff7a5a' }); Tr.t = 0.6;
    } else if (f === 'magic') { // 마력 폭주 (스승판): 10초 동안 주문을 빠르게 (쿨타임 없이 1초에 하나)
      Tr.surgeT = 10; Tr.skT = 0.3; this.emit({ t: 'buff', x: e.x, y: e.y, color: '#b58aff' }); this.emit({ t: 'text', x: e.x, y: e.y - 30, text: '10초 동안 주문이 쉬지 않는다', color: '#b58aff' }); Tr.s = 'move'; Tr.t = 0.2;
    } else if (f === 'scythe') { // 망자의 낫: 앞쪽 크게 (거리 72 · 각 2.6) · 280% · 맞히면 체력 3% 회복
      this.tsMelee(e, 'scythe', 0.35, { range: 72, arc: 2.6, k: 2.8 * SIG_K, heal: 0.03 });
    } else if (f === 'dagger') { // 그림자 손: 둘레 170 안의 나를 끌고 와 최대 체력 50% (공격력 200%~600% 사이)
      this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 170, dur: 1.0 }); Tr.t = 1.3;
      this.tsLater(1.0, () => {
        const q = this.player; if (Math.hypot(q.x - e.x, q.y - e.y) > 170 || q.invuln > 0) return;
        const a2 = Math.atan2(q.y - e.y, q.x - e.x), d2 = Math.hypot(q.x - e.x, q.y - e.y);
        const gx = e.x + Math.cos(a2) * 20, gy = e.y + Math.sin(a2) * 20; if (!this.blocked(gx, gy, 5)) { q.x = gx; q.y = gy; } // 스승 앞으로 끌려온다 (촉수 줄 없이)
        this.tsLater(0.05, () => { this.hurtPlayer(this.trialDmg(Math.max(2 * SIG_K, Math.min(6 * SIG_K, 0.5))), 'phys', e, { fromX: e.x, fromY: e.y, direct: true }); this.ccPlayer({ stun: 1.5 }); }); // 최대 체력 50%(공격력 200%~600% → 내 최대 체력 11%~33%) · 1.5초 경직
      });
    } else if (f === 'bow') { // 천궁의 화살비: 내 자리에 빛줄기 네 번 (반경 72 · 0.3 · 0.5 · 0.7 · 0.9초 · 한 번에 150%)
      const x = p.x, y = p.y; for (let i = 0; i < 4; i++) this.tsCircle(e, x, y, { r: 72, k: 1.5 * SIG_K, wind: 0.3 + i * 0.2, fx: 'lightRain', elem: 'holy' });
      Tr.t = 1.2;
    } else if (f === 'fist') { // 원시의 돌진: 앞으로 170 들이받아 나를 밀고 간다 · 벽에 박으면 450% · 1.5초 기절, 아니면 180% · 0.4초 기절
      Tr.t = 0.8; this.emit({ t: 'windup', id: e.id });
      this.tsLater(0.25, () => {
        const q = this.player, ax = Math.cos(a), ay = Math.sin(a), x1 = e.x, y1 = e.y;
        let dist = 170; while (dist > 0 && this.blocked(x1 + ax * dist, y1 + ay * dist, 5)) dist -= 6;
        const wall = dist < 170 - 6, t = (q.x - x1) * ax + (q.y - y1) * ay, onPath = t > 0 && t < dist + 12 && Math.hypot(q.x - (x1 + ax * t), q.y - (y1 + ay * t)) < 16;
        this.trialDash(e, a, dist, 0.22, Tr.dashCd); this.emit({ t: 'skillDash', x1, y1, x2: x1 + ax * dist, y2: y1 + ay * dist, elem: 'phys' });
        if (onPath) this.tsLater(0.22, () => {
          const ex = x1 + ax * (dist + 10), ey = y1 + ay * (dist + 10); if (!this.blocked(ex, ey, 5)) { q.x = ex; q.y = ey; }
          if (wall) { this.emit({ t: 'skillAoe', x: q.x, y: q.y, r: 30, elem: 'phys', fx: 'quake' }); this.emit({ t: 'shake', v: 5 }); this.emit({ t: 'text', x: q.x, y: q.y - 24, text: '벽에 박혔다!', color: '#ff9a7a' }); }
          this.hurtPlayer(this.trialDmg((wall ? 5 : 2.8) * SIG_K), 'phys', e, { fromX: x1, fromY: y1, direct: true }); this.ccPlayer({ stun: wall ? 1.5 : 0.4 });
        });
      });
    } else if (f === 'spear') { // 용암 균열: 앞으로 땅을 가른다 (길이 190 · 폭 30 · 260% · 화상 2중첩) · 갈라진 자리는 3초 동안 용암
      this.tsRays(e, [a], { len: 190, w: 30, k: 3.6 * SIG_K, wind: 0.35, fx: 'quake', tele: true, burn: 2 });
      this.tsLater(0.35, () => { for (let i = 1; i <= 5; i++) { const zx = e.x + Math.cos(a) * 190 * i / 5, zy = e.y + Math.sin(a) * 190 * i / 5; if (!this.blocked(zx, zy, 4)) (Tr.zones ||= []).push({ x: zx, y: zy, r: 16, until: this.t + 3, k: 0.02, lava: true, next: 0 }); } });
    }
  },
  // 대족장의 「피로 쓴 함성」 패시브: 스킬을 쓰면 최근 8초 동안 받은 피해를 둘레(96)로 터뜨린다 (플레이어는 받은 피해 ×2 · 스승은 받은 몫만큼 내 최대 체력 비율로, 60%까지)
  trialPayback(e) {
    const Tr = this.trial; if (Tr.fam !== 'heavy') return;
    Tr.took = Tr.took.filter(([t]) => this.t - t <= 8);
    const frac = Math.min(0.6, (Tr.took.reduce((a, [, v]) => a + v, 0) / Tr.maxHp) * 2); Tr.took = [];
    if (frac < 0.01) return;
    this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 96, elem: 'fire', fx: 'rage' }); this.emit({ t: 'text', x: e.x, y: e.y - 30, text: `되갚기 ${Math.round(frac * 100)}%`, color: '#ff7a5a' });
    const p = this.player; if (Math.hypot(p.x - e.x, p.y - e.y) <= 96) this.hurtPlayer(this.trialDmg(frac), 'phys', e, { fromX: e.x, fromY: e.y });
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
    const dist = Math.hypot(p.x - e.x, p.y - e.y), toward = () => this.stepToward(e, p.x, p.y, (SPD[f] || 70) * (1 + 0.3 * ((Tr.st?.agi || 0) - 50) / 100));
    { const vx = (p.x - (Tr.ppx ?? p.x)) / DT, vy = (p.y - (Tr.ppy ?? p.y)) / DT, pv = Tr.pv || { x: 0, y: 0 }; Tr.pv = { x: pv.x + (vx - pv.x) * 0.2, y: pv.y + (vy - pv.y) * 0.2 }; if (p.dashT > 0 || p.stealthT > 0 || Math.hypot(p.x - (Tr.ppx ?? p.x), p.y - (Tr.ppy ?? p.y)) > 12) Tr.pMobT = this.t; Tr.ppx = p.x; Tr.ppy = p.y; } // 내 움직임 (대시 · 돌진 · 순간이동 · 은신 = 얼굴 없는 자 판정) (예측 · 창 판정)
    for (const b of Tr.bodies) this.tickAtk(b);                  // 무기를 휘두르는 동작 (준비 → 휘두름)
    if (e.shadowSink) { this.tickShadowSink(e); return; }         // 얼굴 없는 자: 그림자로 가라앉았다 나온다
    for (const b of Tr.bodies) if (b.kbx || b.kby) { // 넉백: 스승도 밀린다 (벽에서 멈춘다)
      const nx = b.x + (b.kbx || 0) * DT, ny = b.y + (b.kby || 0) * DT;
      if (!this.blocked(nx, b.y, 6)) b.x = nx; if (!this.blocked(b.x, ny, 6)) b.y = ny;
      b.kbx *= 0.85; b.kby *= 0.85; if (Math.abs(b.kbx) < 2) b.kbx = 0; if (Math.abs(b.kby) < 2) b.kby = 0;
    }
    Tr.dashCd -= DT; Tr.wsT -= DT; Tr.dodgeCd -= DT;
    this.trialSkillTick();
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
    if (Tr.sigT <= 0 && free && !e.tatk && dist <= (SIG_MAX[f] || 999)) return this.trialSig();
    if (Tr.s === 'sig' || Tr.s === 'surge') { if (Tr.t <= 0) { Tr.s = 'move'; Tr.t = 0.6; } return; }
    Tr.skT -= DT; // 스킬: 원래 쓰던 무기 능력 + 그 무기의 각인 스킬 여섯 (sim/teacherskills.js)
    if (Tr.skT <= 0 && free && !e.tatk && this.trialUseSkill(dist)) return;
    if (Tr.s === 'wskill') {
      if ((f === 'magic' || f === 'bow') && !e.tatk && Tr.t < 0.5) { // 마법사 · 궁수는 주문을 날린 뒤엔 옆걸음으로 계속 움직인다 (외는 동안만 멈춤)
        if ((Tr.strafeT -= DT) <= 0) { Tr.strafe = -Tr.strafe; Tr.strafeT = this.rng.range(0.7, 1.3); }
        const aa = Math.atan2(e.y - p.y, e.x - p.x) + Tr.strafe * 0.6, R = f === 'bow' ? 150 : 130; this.stepToward(e, p.x + Math.cos(aa) * R, p.y + Math.sin(aa) * R, 75);
      }
      if (Tr.t <= 0 && !e.tatk) { Tr.s = 'move'; Tr.t = 0.4; } return;
    }
    // 복서 (주먹): 짧은 대시로 파고들고 · 옆으로 피하고 · 콤보를 넣고 · 한 걸음 빠진다
    if (f === 'fist') {
      const a2 = Math.atan2(p.y - e.y, p.x - e.x);
      const threat = (p.swingT > 0 || p.castT > 0 || p.charging || (p.motion && p.motion.t < 0.15)) && dist < 60; // 내가 치려 한다
      if (Tr.backT && this.t - Tr.backT > 0.28) { Tr.backT = 0; if (dist > 28) { this.trialDash(e, a2, dist - 22, 0.1, 0.4); return; } } // 빠졌다가 다시 파고든다
      if (threat && !Tr.backT && Tr.dashCd <= 0 && !e.tatk) { this.trialDash(e, a2 + Math.PI + this.rng.range(-0.7, 0.7), 34, 0.1, 0.3); Tr.backT = this.t; return; }
      if (e.tatk && dist > 22) this.stepToward(e, p.x, p.y, SPD.fist * 0.75); // 치면서도 따라붙는다
      if (Tr.s === 'move') {
        if (Tr.dashCd <= 0 && dist > 48) { this.trialDash(e, a2 + this.rng.range(-0.4, 0.4), Math.min(dist - 26, 56), 0.12, 0.65); return; } // 짧게 파고든다
        if (Tr.dashCd <= 0 && dist < 48 && Tr.t > 0.05 && this.rng.chance(0.06)) { this.trialDash(e, a2 + (this.rng.chance(0.5) ? 1 : -1) * Math.PI / 2, 30, 0.1, 0.5); return; } // 위빙: 옆으로 비킨다
        if (dist > 24) toward();
        if (dist < 40 && Tr.t <= 0) { Tr.s = 'wind'; this.beginAtk(e, 'fist', { combo: BOX_COMBOS[this.rng.int(0, BOX_COMBOS.length - 1)], cw: 0.16 }); }
      } else if (Tr.s === 'wind') {
        if (!e.tatk) { Tr.s = 'open'; Tr.t = 0.2; if (Tr.dashCd <= 0.4) this.trialDash(e, a2 + Math.PI + this.rng.range(-0.6, 0.6), 38, 0.12, 0.6); } // 치고 빠진다
      } else if (Tr.s === 'open') { if (dist > 24) toward(); if (Tr.t <= 0) { Tr.s = 'move'; Tr.t = 0.2; } }
      return;
    }
    // 근접 스승 (검 · 몰아치기 · 주먹 · 창): 멀면 대시로 붙고 → 무기를 치켜들고(준비) → 휘두르고 → 빈틈. 몰리면 대시로 빠진다
    if (f === 'sword' || f === 'heavy' || f === 'spear') {
      if (Tr.s === 'move') {
        if (Tr.dashCd <= 0) {
          const pressed = Tr.okHits.filter((t) => this.t - t < 2.5).length >= 2;
          if (dist > 120) { this.trialDash(e, Math.atan2(p.y - e.y, p.x - e.x), Math.min(dist - 34, 100)); return; }
          if (pressed && dist < 60) { this.trialDash(e, Math.atan2(e.y - p.y, e.x - p.x), 80); Tr.okHits = []; return; }
        }
        if (dist > 26) toward();
        if (dist < 44 && Tr.t <= 0) { Tr.s = 'wind'; this.beginAtk(e, f); } // 닿는 거리에서만 친다
      } else if (Tr.s === 'wind') {
        if (!e.tatk) { Tr.s = 'open'; Tr.t = f === 'sword' ? 0.6 : 0.3; if (f === 'sword') this.trialSay(e, '빈틈', '#fff0a0'); if (f === 'spear' && Tr.dashCd <= 0) this.trialDash(e, Math.atan2(e.y - p.y, e.x - p.x), 60); } // 창: 찌른 뒤 물러난다
      } else if (Tr.s === 'open') { e.hitFlash = f === 'sword' ? 0.05 : 0; if (Tr.t <= 0) { Tr.s = 'move'; Tr.t = f === 'heavy' ? 0.15 : 0.3; } }
    } else if (f === 'magic') { // 대마도사: 옆걸음으로 움직이다가 주문을 욀 때만 멈춘다 · 내 움직임을 읽고 앞질러 떨어뜨린다 (크기 1.5배)
      if (Tr.s === 'move') {
        if (dist < 70 && Tr.dashCd <= 0) { this.trialBlink(e, 130); Tr.dashCd = 3; }
        if ((Tr.strafeT -= DT) <= 0) { Tr.strafe = -Tr.strafe; Tr.strafeT = this.rng.range(0.7, 1.3); }
        const aa = Math.atan2(e.y - p.y, e.x - p.x) + Tr.strafe * 0.6; this.stepToward(e, p.x + Math.cos(aa) * 130, p.y + Math.sin(aa) * 130, 75);
        if (Tr.t <= 0) {
          Tr.s = 'cast'; Tr.t = 1.6; Tr.castT0 = this.t; e.moving = false; this.trialSay(e, '주문을 왼다…', '#c8a8ff');
          for (const dt of [0.15, 0.75, 1.35]) this.tsLater(dt, () => { if (Tr.s !== 'cast') return; const L = this.trialLead(0.6); this.trialStrike(e, L.x, L.y, 0.6, 45, 0.08, 'burst'); });
        }
      } else if (Tr.s === 'cast') { e.moving = false; if (Tr.t <= 0) { Tr.s = 'move'; Tr.t = 1.3; const L = this.trialLead(0.8); this.trialStrike(e, L.x, L.y, 0.8, 60, TR.hit, 'burst'); } }
      else Tr.s = 'move';
    } else if (f === 'scythe') { // 첫 번째 망자: 둘레를 돌다가 닿을 때만 낫을 크게 휘두른다
      for (const b of Tr.bodies) { b.ang = (b.ang ?? Math.atan2(b.y - p.y, b.x - p.x)) + DT * 0.7; if (!b.tatk) this.stepToward(b, p.x + Math.cos(b.ang) * 44, p.y + Math.sin(b.ang) * 30, 90); }
      if (Tr.t <= 0 && dist <= 58) { this.beginAtk(e, 'scythe'); Tr.t = 1.6; }
    } else if (f === 'dagger') { // 얼굴 없는 자: 대시로 좌우를 오가다 → 갑자기 파고들어 찌르고 빠진다 · 그림자로 가라앉았다 다른 자리에서 나온다 · 가끔 분신 셋을 꺼내 함께 벤다
      if (this.tickCross()) return;
      const a2 = Math.atan2(p.y - e.y, p.x - e.x);
      Tr.blinkT = (Tr.blinkT ?? 5) - DT; Tr.crossT = (Tr.crossT ?? 5) - DT;
      if (e.tatk) return;
      if (Tr.crossT <= 0) { Tr.crossT = this.rng.range(9, 12); this.beginCross(); return; }
      if (Tr.blinkT <= 0) { Tr.blinkT = this.rng.range(6, 8); this.beginShadowSink(e); return; }
      if (Tr.t <= 0 && Tr.dashCd <= 0 && dist < 120) { // 가끔 갑자기 돌진해 찌르고 → 바로 빠진다
        Tr.t = this.rng.range(3.2, 4.5); Tr.dashCd = 2.4; this.trialDash(e, a2, Math.max(0, dist - 20), 0.11, 0.2);
        this.tsLater(0.12, () => { this.beginAtk(e, 'dagger', { wind: 0.12 }); this.tsLater(0.4, () => this.trialDash(e, Math.atan2(e.y - this.player.y, e.x - this.player.x) + this.rng.range(-0.6, 0.6), 70, 0.13, 2.4)); });
        return;
      }
      if (dist > 60) { const aa = Math.atan2(e.y - p.y, e.x - p.x) + Tr.strafe * 0.5; this.stepToward(e, p.x + Math.cos(aa) * 70, p.y + Math.sin(aa) * 70, 62); } // 평소엔 걸어서 거리를 잰다
      if ((Tr.strafeT -= DT) <= 0) { Tr.strafe = -Tr.strafe; Tr.strafeT = this.rng.range(1.2, 2.2); }
      if (Tr.dashCd <= 0 && this.rng.chance(0.25)) { // 가끔 옆으로 짧게 대시
        Tr.strafe = -Tr.strafe; const want = dist < 60 ? 1.9 : dist > 110 ? 1.1 : Math.PI / 2;
        this.trialDash(e, a2 + Tr.strafe * want, 44, 0.14, this.rng.range(1.6, 2.4)); return;
      }
    } else if (f === 'bow') { // 노궁수: 거리를 두고 좌우로 오가며(와리가리) 쏜다 · 날아오는 내 화살은 옆으로 대시해 피한다 · 붙으면 여러 방향으로 빠진다
      if (Tr.dodgeCd <= 0 && !e.tatk) for (const pr of this.projs) {
        if (pr.owner !== 'p' || pr.life <= 0) continue;
        const rx = e.x - pr.x, ry = e.y - pr.y, dd = Math.hypot(rx, ry); if (dd > 120) continue;
        const v = Math.hypot(pr.vx, pr.vy) || 1; if ((rx * pr.vx + ry * pr.vy) / (dd * v) < 0.75) continue; // 나를 향해 오는 화살만
        const side = pr.vx * ry - pr.vy * rx > 0 ? 1 : -1, a3 = Math.atan2(pr.vy, pr.vx) + side * Math.PI / 2 + this.rng.range(-0.5, 0.5);
        this.trialDash(e, a3, 64, 0.14, Math.max(Tr.dashCd, 0.7)); Tr.dodgeCd = 1.0; this.trialSay(e, '흥', '#c8d8ff'); return;
      }
      if (dist < 95 && Tr.dashCd <= 0) { // 붙으면 뒤 · 옆 · 비스듬히 아무 쪽으로나 빠진다
        const away = Math.atan2(e.y - p.y, e.x - p.x); this.trialDash(e, away + this.rng.range(-1.6, 1.6), 90, 0.18, 1.6); return;
      }
      if ((Tr.strafeT -= DT) <= 0) { Tr.strafe = -Tr.strafe; Tr.strafeT = this.rng.range(0.5, 1.1); if (Tr.dashCd <= 0 && this.rng.chance(0.35)) { const aa = Math.atan2(e.y - p.y, e.x - p.x) + Tr.strafe * 1.3; this.trialDash(e, aa, 60, 0.14, 1.4); return; } }
      if (!e.tatk || !e.tatk.cfg.big) { // 와리가리: 나를 중심으로 옆으로 돈다 (거리 150 안팎) · 쏘면서도 움직이고 차지할 때만 멈춘다
        const aa = Math.atan2(e.y - p.y, e.x - p.x) + Tr.strafe * 0.7, R = 150;
        this.stepToward(e, p.x + Math.cos(aa) * R, p.y + Math.sin(aa) * R, SPD.bow + 25);
      }
      if (Tr.t <= 0 && !e.tatk) { Tr.t = 1.25; this.beginAtk(e, 'bow'); }
    }
  },
};

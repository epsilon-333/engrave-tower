// 숨은 각인 (data/hidden.js): 조건 검사 · 패시브 효과 · 얻기
// HiddenMethods 는 World.prototype 에 붙는다 (sim/world.js 끝) — 메서드 안의 this 는 World
// 등반 전체를 봐야 하는 위업(질풍 · 검귀 · 반역자)은 climbFeats 로 ui/climb.js 가 층을 깰 때 검사한다
import { HIDDEN_BY_ID, hiddenEcho, hiddenEngId, TEACHERS } from '../data/hidden.js';
import { OATHS } from '../data/climb.js';
import { SLOTS } from './build.js';
import { BIOME_LIST } from '../data/maps/overworld.js';
import { weaponFam } from './teacher.js';

// 이미 얻은 숨은 각인 (main.js 가 저장을 이어 준다): 한 번 잡은 전설 몬스터 · 그림자는 다시 나오지 않는다
let OWNED = () => ({});
export const setHiddenSource = (fn) => { OWNED = fn; };
const owned = (id) => !!OWNED()?.[id];

export const HID = {
  restGap: 1.0,      // 광전사: 이만큼 쉬면 실패
  frenzyMax: 20,     // 멈추지 않는 팔: 3% × 20 = +60%
  frenzyStep: 0.03,
  slaughterN: 50, slaughterT: 10, // 학살자: 10초 안에 50마리
  slaughterMax: 10,  // 쉰 개의 무덤: 5% × 10
  fastBoss: 30,      // 검귀: 싸움 시작부터 30초 안에
  bulwarkBlocks: 5,  // 철벽: 방패로 정면에서 5번 넘게
  noShadowT: 5,      // 그림자 없는 발: 5초 동안 안 맞으면
};
const PASS_ST = ['burn', 'poison', 'bleed', 'chill', 'shock', 'curse'];

// 비어 있는 각인 칸 (공허의 그릇)
export const emptyEngSlots = (b) => SLOTS.filter((sl) => !b?.lo?.engravings?.[sl]).length;
// 맨몸 (권왕): 맨손 · 왼손 · 갑옷 · 장신구 둘이 빈 칸 수
export function bareSlots(gear = {}) {
  let n = 0;
  if (!gear.weapon || gear.weapon === 'bareHands') n++;
  for (const k of ['off', 'armor', 'acc1', 'acc2']) if (!gear[k]) n++;
  return n;
}

export const HiddenMethods = {
  hidInit() {
    const C = this.climb;
    this.hid = { kills: [], slaughterSent: false, lastHurt: this.t, boss: !!(C && (C.kind === 'lord' || C.kind === 'guardian')), hits: 0, blocks: 0, other: 0, fightT: 0, lastAtk: null, restFail: false, pay: [], souls: [], psn: false, psnBroke: false };
  },
  // 내가 쳤다 (평타 · 스킬)
  hidAttack() {
    const H = this.hid; if (!H) return;
    H.lastAtk = this.t;
    if (this.f.has('frenzy')) { const p = this.player; p.hFrenzyN = Math.min(HID.frenzyMax, (p.hFrenzyN || 0) + 1); p.hFrenzyT = HID.restGap; }
  },
  // 평타 한 번의 배율 (그림자 없는 발 · 비어 있는 그릇)
  hidBasicMul() {
    const p = this.player; let m = 1;
    if (p.buffs.hNoShadow) { m *= 3; delete p.buffs.hNoShadow; this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '무영', color: '#cfe8ff' }); }
    if (this.f.has('voidVessel')) m *= 1 + 0.25 * Math.min(4, emptyEngSlots(this.b));
    return m;
  },
  // 맞았다 (회피 · 받아치기 · 무적으로 막은 것은 오지 않는다). shield: 방패로 정면에서 받았다
  hidHurt(shield, dmg = 0) {
    const H = this.hid; if (!H) return;
    H.lastHurt = this.t; delete this.player.buffs.hNoShadow; // 패시브(무영 · 되갚기)는 스승의 방에서도 그대로
    if (this.f.has('payback') && dmg > 0) H.pay.push([this.t, dmg]);
    if (this.trial || !H.boss) return; // 스승의 방: 위업 기록은 하지 않는다
    H.hits++;
    if (shield) H.blocks++; else H.other++;
  },
  hidKill(e) {
    const H = this.hid; if (!H || this.practice || this.pvp || this.mode === 'plaza' || e.trainee || e.def?.ai === 'dummy' || e.npcRef) return;
    const p = this.player;
    if (e.defId === 'myShadow') this.signals.push({ t: 'hiddenFeat', id: 'doppel' });
    if (e.legend) this.signals.push({ t: 'hiddenFeat', id: e.legend });
    if (e === this.climb?.boss) { H.oozeKill = p.oozeT > 0 && !!p.st.poison; this.hidShadowRoll(e); }
    if (!e.summoned && !e.def?.boss) { H.souls.push(e.defId); if (H.souls.length > 6) H.souls.shift(); }
    if (this.f.has('soulThrall') && !e.summoned && !e.def?.boss && !e.def?.trial && this.rng.chance(0.3) && this.allies.filter((a) => a.thrall && a.t > 0).length < 3) this.hidRaise(e.defId, 20, this.skillAtk('phys') * 0.5, true, e.x, e.y);
    if (this.f.has('slaughter')) { p.hSlaughterN = Math.min(HID.slaughterMax, (p.hSlaughterN || 0) + 1); p.hSlaughterT = 5; }
    if (this.f.has('bossReset') && e.def?.boss) { p.cds = {}; this.emit({ t: 'text', x: p.x, y: p.y - 28, text: '검귀', color: '#e8e2cf', big: true }); }
    H.kills.push(this.t);
    while (H.kills.length && H.kills[0] < this.t - HID.slaughterT) H.kills.shift();
    if (!H.slaughterSent && H.kills.length >= HID.slaughterN) { H.slaughterSent = true; this.signals.push({ t: 'hiddenFeat', id: 'slaughter' }); }
  },
  hidTick(DT) {
    { const p = this.player; if (p.buffs.hSurge) { p.surgeAcc = (p.surgeAcc || 0) + DT; while (p.surgeAcc >= 0.1) { p.surgeAcc -= 0.1; this.addRes(1); } } else p.surgeAcc = 0; } // 마력 폭주: 0.1초마다 자원 +1
    const H = this.hid, p = this.player; if (!H) return;
    if (this.trial) this.trialTick();
    if (this.f.has('oozeHeal') && p.oozeT > 0) this.heal(this.d.maxHp * 0.02 * DT, 'regen');
    if (this.f.has('bloodHunger') && this.state === 'play' && !this.practice && this.mode !== 'plaza') p.hp = Math.max(1, p.hp - this.d.maxHp * 0.01 * DT); // 피를 먹는 칼 (깨어나기 전)
    if (H.boss && this.climb?.boss?.defId === 'climbQueen' && !this.climb.boss.dead) { if (p.st.poison) H.psn = true; else if (H.psn) H.psnBroke = true; } // 만독불침
    if (this.zone?.id === 'world' && this.clock && this.map.biome) this.hidLegends();
    // 보스 싸움 기록: 등장 연출이 끝나고 보스가 살아 있는 동안
    const boss = this.climb?.boss;
    if (H.boss && boss && !boss.dead && !this.climb.intro) {
      H.fightT += DT;
      if (H.fightT > HID.restGap && (H.lastAtk == null || this.t - H.lastAtk > HID.restGap)) H.restFail = true;
    }
    // 패시브: 버프로 보이게 (HUD에 아이콘 · 피해는 mod 로 곱해진다)
    if (this.f.has('noShadow') && this.t - H.lastHurt >= HID.noShadowT && !p.buffs.hNoShadow) p.buffs.hNoShadow = { t: 9999, max: 9999, mods: {}, color: '#cfe8ff', name: '무영' };
    if (p.hFrenzyN) {
      if ((p.hFrenzyT -= DT) <= 0 && !p.buffs.hFrenzyBurst) p.hFrenzyN = 0;
      if (p.buffs.hFrenzyBurst) p.hFrenzyN = HID.frenzyMax;
      if (p.hFrenzyN) p.buffs.hFrenzy = { t: 0.3, max: 0.3, mods: { atkSpeed: 1 + HID.frenzyStep * p.hFrenzyN }, color: '#ff5a4a', name: `멈추지 않는 팔 ${p.hFrenzyN}` };
    }
    if (p.hSlaughterN) {
      if ((p.hSlaughterT -= DT) <= 0) p.hSlaughterN = 0;
      else p.buffs.hSlaughter = { t: p.hSlaughterT, max: 5, mods: { dmgMul: 1 + 0.05 * p.hSlaughterN }, color: '#e0445a', name: `쉰 개의 무덤 ${p.hSlaughterN}` };
    }
    if (this.f.has('rebel')) {
      const n = PASS_ST.filter((k) => p.st[k]).length, o = this.climb ? Object.values(this.climb.oath || {}).reduce((a, b) => a + (b || 0), 0) : 0;
      if (n || o) p.buffs.hRebel = { t: 0.3, max: 0.3, mods: { dmgMul: 1 + 0.1 * n + 0.02 * o }, color: '#c45cff', name: '반역' };
    }
  },
  // 반역의 낙인: 내 상태이상을 적에게 옮긴다 (스킬 한 번에 한 번 털고, 맞은 적마다 옮긴다)
  hidRebelPass(e, ctx) {
    const p = this.player;
    if (!ctx._rebel) { ctx._rebel = PASS_ST.filter((k) => p.st[k]); for (const k of ctx._rebel) delete p.st[k]; }
    for (const k of ctx._rebel) if (!e.dead) this.applyStatus(e, k, 3);
  },
  // 대족장 「피로 쓴 함성」: 스킬을 쓰면 최근 8초 동안 받은 피해를 둘레로 터뜨린다
  hidCast() {
    const H = this.hid, p = this.player; if (!H || !this.f.has('payback')) return;
    H.pay = H.pay.filter(([t]) => this.t - t <= 8);
    const sum = Math.min(this.d.maxHp * 0.6, H.pay.reduce((a, [, v]) => a + v, 0)); H.pay = [];
    if (sum < 1) return;
    this.emit({ t: 'skillAoe', x: p.x, y: p.y, r: 96, elem: 'fire', fx: 'rage' });
    this.emit({ t: 'text', x: p.x, y: p.y - 30, text: `되갚기 ${Math.round(sum * 2)}`, color: '#ff7a5a' });
    for (const e of this.enemiesNear(p.x, p.y, 96)) this.damageEnemy(e, sum * 2, 'phys', { src: 'aoe' });
  },
  // 영혼 수하 (사령군주)
  hidRaise(defId, dur, atk, thrall, x, y) {
    const p = this.player, a = this.rng.range(0, Math.PI * 2);
    x ??= p.x + Math.cos(a) * 18; y ??= p.y + Math.sin(a) * 18;
    if (this.blocked(x, y, 5)) { x = p.x; y = p.y; }
    const hp = this.d.maxHp * 0.4;
    this.allies.push({ id: this.nextId++, kind: 'soul', defId: defId || 'skeleton', thrall, hp, maxHp: hp, x, y, t: dur, max: dur, atk, cd: 0.4, phase: a, dir: 1, r: 6, scale: 1 });
    this.emit({ t: 'summonFx', x, y, kind: 'soul' });
  },
  // 숨은 각인 스킬의 특수 동작 (sim/skillrun.js runOp 에서)
  hidOp(op, ctx) {
    const p = this.player;
    switch (op.op) {
      case 'soulCall': {
        const ids = [...new Set(this.hid.souls.slice().reverse())].slice(0, op.n);
        while (ids.length < op.n) ids.push('skeleton');
        ids.forEach((id) => this.hidRaise(id, op.dur, ctx.atk * op.mul * ctx.bonus, false));
        this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '영혼 소집', color: '#7ae8ff' });
        break;
      }
      case 'bubble': {
        const e = ctx.target && !ctx.target.dead && Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) < op.range + 30 ? ctx.target : this.nearestEnemy(op.range);
        if (!e) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        const big = !!(e.def.boss || e.def.elite), dur = big ? op.bossDur : op.dur, pct = big ? op.bossPct : op.pct;
        e.st.stun = Math.max(e.st.stun || 0, dur); e.rooted = Math.max(e.rooted || 0, dur); e.windT = 0;
        this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 22, elem: 'ice', fx: 'splash' });
        this.emit({ t: 'text', x: e.x, y: e.y - 24, text: '물풍선', color: '#8ad8ff' });
        for (let i = 1; i <= Math.ceil(dur); i++) this.delayed.push({ t: Math.min(i, dur), run: () => { if (e.dead) return; this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 20, elem: 'ice', fx: 'splash' }); this.damageEnemy(e, e.maxHp * pct * Math.min(1, dur - (i - 1)), 'mag', { src: 'aoe', color: '#8ad8ff' }); } });
        break;
      }
      case 'shadowHands': {
        const list = this.enemiesNear(p.x, p.y, op.r).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, op.n);
        if (!list.length) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '닿는 적이 없다', color: '#a8b0c0' }); break; }
        list.forEach((e, i) => {
          let x = e.x, y = e.y; // 내 앞 빈자리로 끌어온다 (막혀 있으면 다른 방향 · 더 가까이)
          for (const [da, dd] of [[0, 18], [0.6, 18], [-0.6, 18], [Math.PI, 16], [1.6, 14], [-1.6, 14], [0, 8]]) { const a = Math.atan2(p.aimY, p.aimX) + (i - (list.length - 1) / 2) * 0.5 + da, cx = p.x + Math.cos(a) * (dd + e.r), cy = p.y + Math.sin(a) * (dd + e.r); if (!this.blocked(cx, cy, e.r)) { x = cx; y = cy; break; } }
          const atk = this.skillAtk('phys'), dmg = Math.max(atk * op.minMul, Math.min(atk * op.maxMul, e.maxHp * op.frac)); // 최대 체력의 50% · 공격력 200% ~ 600% 사이
          if (!e.def.boss) { e.x = x; e.y = y; e.kbx = e.kby = 0; } // 내 앞으로 끌어온다 (촉수 줄은 그리지 않는다)
          this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 16, elem: 'dark', fx: 'doom' }); this.damageEnemy(e, dmg, 'phys', { src: 'aoe', color: '#8a6aff' });
          if (!e.dead) { this.stunE(e, 1.5); this.emit({ t: 'text', x: e.x, y: e.y - 20, text: '경직', color: '#b89aff' }); } // 살아남으면 1.5초 경직
        });
        break;
      }
      case 'ram': {
        const ax = p.aimX, ay = p.aimY, x1 = p.x, y1 = p.y;
        let dist = op.dist; while (dist > 0 && this.blocked(x1 + ax * dist, y1 + ay * dist, 5)) dist -= 6;
        const wall = dist < op.dist - 6;
        const hit = this.enemies.filter((e) => !e.dead && !e.hidden).map((e) => ({ e, t: (e.x - x1) * ax + (e.y - y1) * ay })).filter((o) => o.t > 0 && o.t < dist + 10 && Math.hypot(o.e.x - (x1 + ax * o.t), o.e.y - (y1 + ay * o.t)) < o.e.r + 12).sort((a, b) => a.t - b.t)[0]?.e;
        const dur = 0.22; p.dashT = dur; p.dvx = ax * dist / dur; p.dvy = ay * dist / dur; p.invuln = Math.max(p.invuln, 0.3);
        this.emit({ t: 'skillDash', x1, y1, x2: x1 + ax * dist, y2: y1 + ay * dist, elem: ctx.elem });
        if (hit) this.delayed.push({ t: dur, run: () => {
          if (hit.dead) return;
          const ex = x1 + ax * (dist + hit.r + 4), ey = y1 + ay * (dist + hit.r + 4);
          if (!hit.def.boss && !this.blocked(ex, ey, hit.r)) { hit.x = ex; hit.y = ey; }
          if (wall) { this.emit({ t: 'skillAoe', x: hit.x, y: hit.y, r: 30, elem: 'phys', fx: 'quake' }); this.emit({ t: 'shake', v: 5 }); this.emit({ t: 'text', x: hit.x, y: hit.y - 24, text: '벽에 박았다!', color: '#c8e8a0' }); }
          this.skillHit(hit, { mul: wall ? op.wallMul : op.mul, stun: wall ? op.stun : 0.4 }, ctx);
        } });
        break;
      }
    }
  },
  // 전설 몬스터: 조건이 겹치면 나온다 (바깥 세계)
  hidLegends() {
    const H = this.hid, p = this.player, m = this.map, tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16), bi = m.biome[ty * this.tw + tx], min = this.clock.min;
    const at = (id) => BIOME_LIST.findIndex((b) => b.id === id);
    const spawn = (id, legend) => {
      for (let k = 0; k < 30; k++) {
        const a = this.rng.range(0, Math.PI * 2), x = p.x + Math.cos(a) * 150, y = p.y + Math.sin(a) * 110;
        if (this.blocked(x, y, 8)) continue;
        const e = this.makeEnemy(id, x, y, { noAffix: true }); e.legend = legend; e.state = 'chase';
        const rg = m.regions?.[ty * this.tw + tx]; if (rg >= 0) { e.region = rg; this.applyLevel(e, this.regionLevel(rg, tx, ty) + 3); } // 그 지역보다 세 레벨 위
        e.hp = e.maxHp = e.maxHp * 4;
        this.enemies.push(e); this.aggro(e);
        this.emit({ t: 'banner', text: e.def.name, sub: legend === 'frostSteed' ? '고요한 새벽, 눈밭 너머에서 무언가 다가온다' : '자정의 종이 울린다', color: '#e8e2ff' });
        return e;
      }
      return null;
    };
    if (!H.steed && !owned('frostSteed') && bi === at('snow') && min >= 240 && min < 360 && (p.stillT || 0) >= 60) H.steed = spawn('frostSteed', 'frostSteed');
    if (!H.bell && !owned('bellWraith') && bi === at('graveyard') && min < 60) H.bell = spawn('bellWraith', 'bellWraith');
    if (H.bell && !H.bell.dead && min >= 60) { H.bell.dead = true; this.emit({ t: 'death', x: H.bell.x, y: H.bell.y, color: '#c8a8ff', defId: 'bellWraith' }); this.emit({ t: 'text', x: H.bell.x, y: H.bell.y - 24, text: '종소리가 그쳤다', color: '#c8a8ff' }); }
  },
  // 나의 그림자: 30층 이상의 주인을 쓰러뜨리면 드물게 (20%)
  hidShadowRoll(boss) {
    const C = this.climb;
    if (!C || C.kind !== 'lord' || C.f < 30 || this.coop || owned('doppel') || !this.rng.chance(0.2)) return;
    const e = this.makeEnemy('myShadow', boss.x, boss.y, { noAffix: true });
    e.raceLook = this.b.race; e.climb = true; e.home = { x: boss.x, y: boss.y }; e.state = 'chase';
    e.hp = e.maxHp = boss.maxHp * 0.5; e.atk = boss.atk * 0.9; e.scale = 1.1;
    this.enemies.push(e); this.aggro(e);
    this.emit({ t: 'banner', text: '나의 그림자', sub: '쓰러진 주인의 그림자에서 내가 걸어 나온다', color: '#a8a0c8' });
  },
};

// 층을 깼을 때 검사 (탑 · 혼자 오를 때만). r = 등반 기록 · w = 그 층의 세계 · 돌려주는 것: 이번에 채운 위업 아이디들
export function climbFeats(r, w, f, kind) {
  const out = [], H = w?.hid;
  if (!r || !w || w.coop || !H) return out;
  const boss = kind === 'lord' || kind === 'guardian';
  r.hid ||= { fast: 0 };
  if (boss && H.fightT <= HID.fastBoss) r.hid.fast++;
  if (kind !== 'lord') return out;
  const lo = w.b.lo || {}, startOne = r.startF === 1;
  if (f === 10 && H.hits === 0) out.push('noShadow');
  if (f === 10 && !H.restFail && H.lastAtk != null) out.push('berserk');
  if (f === 10 && startOne && (r.time + (w.tower?.t || 0)) <= 300) out.push('gale');
  if (f === 20 && !Object.values(lo.engravings || {}).some(Boolean) && !(lo.runEng || []).length) out.push('voidVessel');
  if (f === 20 && H.blocks > HID.bulwarkBlocks && H.other === 0) out.push('bulwark');
  if (f === 30 && bareSlots(lo.gear) === 5) out.push('fistKing');
  if (f === 30 && startOne && r.hid.fast >= 6) out.push('bladeGhost');
  if (f === 50 && startOne && Object.entries(OATHS).every(([k, o]) => (r.oath?.[k] || 0) >= o.max)) out.push('rebel');
  if (f === 20 && H.psn && !H.psnBroke && H.oozeKill) out.push('venomless');
  if (f === 40) out.push('teacher:' + weaponFam(w.b)); // 숨은 스승: 40층의 주인을 쓰러뜨린 무기 갈래
  if (w.b.weaponId === 'bloodEater') out.push('count:bloodLords');
  return out;
}
export const teacherFor = (fam) => TEACHERS[fam] && HIDDEN_BY_ID[TEACHERS[fam].id];

// 얻기: 증표(잔향) 하나 · 칭호. 이미 얻었으면 false
export function grantHidden(s, id) {
  const h = HIDDEN_BY_ID[id]; if (!h) return false;
  s.hidden ||= {};
  if (s.hidden[id]) return false;
  s.hidden[id] = Date.now();
  s.echoes ||= {}; s.codex ||= {}; s.codex.echoes ||= {};
  const ex = hiddenEcho(id);
  if (!(s.owned?.[hiddenEngId(id)] > 0)) s.echoes[ex] = (s.echoes[ex] || 0) + 1;
  s.codex.echoes[ex] = (s.codex.echoes[ex] || 0) + 1;
  (s.titles ||= []).includes(h.title) || s.titles.push(h.title);
  s.title ||= h.title;
  return true;
}

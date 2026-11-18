// 숨은 각인 (data/hidden.js): 조건 검사 · 패시브 효과 · 얻기
// HiddenMethods 는 World.prototype 에 붙는다 (sim/world.js 끝) — 메서드 안의 this 는 World
// 등반 전체를 봐야 하는 위업(질풍 · 검귀 · 반역자)은 climbFeats 로 ui/climb.js 가 층을 깰 때 검사한다
import { HIDDEN_BY_ID, hiddenEcho, hiddenEngId } from '../data/hidden.js';
import { OATHS } from '../data/climb.js';
import { SLOTS } from './build.js';

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
    this.hid = { kills: [], slaughterSent: false, lastHurt: this.t, boss: !!(C && (C.kind === 'lord' || C.kind === 'guardian')), hits: 0, blocks: 0, other: 0, fightT: 0, lastAtk: null, restFail: false };
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
  hidHurt(shield) {
    const H = this.hid; if (!H) return;
    H.lastHurt = this.t; delete this.player.buffs.hNoShadow;
    if (!H.boss) return;
    H.hits++;
    if (shield) H.blocks++; else H.other++;
  },
  hidKill(e) {
    const H = this.hid; if (!H || this.practice || this.pvp || this.mode === 'plaza' || e.trainee || e.def?.ai === 'dummy' || e.npcRef) return;
    const p = this.player;
    if (this.f.has('slaughter')) { p.hSlaughterN = Math.min(HID.slaughterMax, (p.hSlaughterN || 0) + 1); p.hSlaughterT = 5; }
    if (this.f.has('bossReset') && e.def?.boss) { p.cds = {}; this.emit({ t: 'text', x: p.x, y: p.y - 28, text: '검귀', color: '#e8e2cf', big: true }); }
    H.kills.push(this.t);
    while (H.kills.length && H.kills[0] < this.t - HID.slaughterT) H.kills.shift();
    if (!H.slaughterSent && H.kills.length >= HID.slaughterN) { H.slaughterSent = true; this.signals.push({ t: 'hiddenFeat', id: 'slaughter' }); }
  },
  hidTick(DT) {
    const H = this.hid, p = this.player; if (!H) return;
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
  return out;
}

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

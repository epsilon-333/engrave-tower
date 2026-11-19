// 숨은 스승의 스킬 (2026-11-19) — 스승은 그 무기를 완전히 다룬 자. 각인 스킬 가운데 그 무기에 맞는 것 여섯 + 원래 쓰던 무기 능력(trialWeaponSkill)을
// 거리와 쿨타임에 맞춰 골라 쓴다. 이름 · 모양은 플레이어의 그 스킬을 따르고, 피해는 내 최대 체력 비율(trialDmg). 큰 기술은 예고(준비 자세 · 예고 선 · 예고 원)가 있다.
// TeacherSkillMethods 는 World.prototype 에 붙는다 (sim/world.js 끝) — 메서드 안의 this 는 World
import { SKILLS } from '../data/skills.js';
import { MOTION_DUR } from './world.js'; // 함수 안에서만 쓴다 (서로 가져오는 파일이라 맨 위에서 쓰면 안 된다)
const DT = 1 / 60;
// 스승이 스킬을 쓸 때 몸 동작은 플레이어가 그 스킬을 쓸 때와 같은 동작(SKILLS[].mo · MOTION_DUR · renderer motionPose)
const MO_OF = { counter: 'braceForIt', berserk: 'berserkSkill', firePillar: 'eFirePillar', spinThrust: 'comboSlash' };
export const SIG_SKILL = { sword: 'hIaido', heavy: 'hChiefCall', magic: 'hManaSurge', scythe: 'hReaper', dagger: 'hShadowHands', bow: 'hLightRain', fist: 'hRam', spear: 'hLavaRift' };
const SUMMON_MAX = 3; // 리치의 해골 병사 (몬스터 소환 규칙: 한 소환사당 3)

// [아이디, 이름, 쿨타임(초), 쓰는 거리 [최소, 최대], 실행]  — 실행(ctx): ctx = { w, Tr, e, p, a(나를 향한 각), d(거리) }
const S = (id, name, cd, min, max, run) => ({ id, name, cd, min, max, run });
export const TEACHER_SKILLS = {
  sword: [
    S('sweep', '횡베기', 5, 0, 60, ({ w, e }) => w.tsMelee(e, 'sword', 0.35, { range: 46, arc: 3.0, k: 0.1, knock: 18 })),
    S('comboSlash', '연속베기', 6, 0, 55, ({ w, e }) => w.tsMelee(e, 'sword', 0.3, { k: 0.06 }, { combo: [0, 1, 0], cw: 0.14 })),
    S('dashSlash', '돌진 베기', 7, 60, 170, ({ w, e }) => w.tsDashHit(e, 120, 0.3, 0.12, 14)),
    S('swordWave', '검기 날리기', 6, 50, 220, ({ w, e, a }) => w.tsRays(e, [a], { len: 220, w: 22, k: 0.1, wind: 0.45, fx: 'skyfall', tele: true })),
    S('riposte', '받아치기', 9, 0, 70, ({ w, Tr }) => w.tsCounter(Tr, 0.9, 0.14)),
    S('skyfall', '천붕참', 14, 0, 200, ({ w, e, a }) => w.tsRays(e, [a - 0.18, a, a + 0.18], { len: 240, w: 34, k: 0.2, wind: 0.95, fx: 'skyfall', tele: true, shake: 6 })),
  ],
  heavy: [
    S('crushBlow', '파쇄 일격', 6, 0, 60, ({ w, e }) => w.tsMelee(e, 'heavy', 0.8, { range: 46, k: 0.15, kind: 'smash', knock: 30, fx: 'quake' })),
    S('chargeSmash', '돌진 강타', 7, 60, 170, ({ w, e, a }) => { w.tsDash(e, a, 100, 0.22); w.tsLater(0.24, () => w.tsCircle(e, e.x, e.y, { r: 52, k: 0.12, wind: 0.01, fx: 'quake', knock: 30 })); }),
    S('crushingBlows', '분쇄 연타', 8, 0, 55, ({ w, e }) => w.tsMelee(e, 'heavy', 0.45, { k: 0.07, kind: 'smash' }, { combo: [0, 1, 2], cw: 0.3 })),
    S('groundSmash', '지면 분쇄', 9, 0, 80, ({ w, e }) => w.tsCircle(e, e.x, e.y, { r: 74, k: 0.12, wind: 0.75, fx: 'quake', slow: 1.0, windup: true })),
    S('greatAxe', '거대 도끼', 7, 60, 230, ({ w, e, a }) => w.tsRays(e, [a], { len: 230, w: 24, k: 0.12, wind: 0.5, fx: 'arrowBeam', tele: true })),
    S('warCry', '전투 함성', 15, 0, 999, ({ w, Tr, e }) => w.tsPower(Tr, e, 5, '전투 함성')),
  ],
  magic: [
    S('flameBurst', '화염 작렬', 4, 0, 260, ({ w, e, p }) => w.tsCircle(e, p.x, p.y, { r: 34, k: 0.1, wind: 0.6, elem: 'fire', fx: 'burst' })),
    S('frostChain', '서리 사슬', 6, 0, 230, ({ w, e, a }) => w.tsRays(e, [a], { len: 230, w: 16, k: 0.08, wind: 0.45, fx: 'arrowBeam', tele: true, slow: 1.2, elem: 'ice' })),
    S('lightningChain', '번개 사슬', 6, 0, 260, ({ w, e, p }) => { w.tsCircle(e, p.x, p.y, { r: 28, k: 0.08, wind: 0.4, elem: 'lightning', fx: 'burst' }); w.tsLater(0.45, () => w.tsCircle(e, w.player.x, w.player.y, { r: 28, k: 0.08, wind: 0.35, elem: 'lightning', fx: 'burst' })); }),
    S('blinkBlast', '점멸', 7, 0, 70, ({ w, e }) => { const x = e.x, y = e.y; w.trialBlink(e, 110); w.tsCircle(e, x, y, { r: 52, k: 0.08, wind: 0.3, elem: 'arcane', fx: 'burst' }); }),
    S('slowField', '시간 감속장', 12, 0, 260, ({ w, Tr, p }) => w.tsZone(Tr, p.x, p.y, { r: 62, dur: 6, slow: true, color: '#9fd8ff' })),
    S('grandFireball', '거대 화염구', 14, 0, 300, ({ w, e, p }) => w.tsCircle(e, p.x, p.y, { r: 80, k: 0.24, wind: 1.4, elem: 'fire', fx: 'meteor', shake: 6 })),
  ],
  scythe: [
    S('skeletons', '해골 병사', 10, 0, 999, ({ w, Tr, e }) => w.tsSummon(Tr, e)),
    S('graspWraith', '망령 소환', 8, 0, 240, ({ w, e, p }) => w.tsCircle(e, p.x, p.y, { r: 30, k: 0.05, wind: 0.8, elem: 'dark', fx: 'doom', root: 1.0 })),
    S('boneSpear', '뼈 창', 5, 40, 260, ({ w, e, a }) => w.tsRays(e, [a], { len: 250, w: 14, k: 0.1, wind: 0.4, fx: 'arrowBeam', tele: true })),
    S('curse', '저주', 8, 0, 240, ({ w, Tr, e, p }) => w.tsCircle(e, p.x, p.y, { r: 50, k: 0, wind: 0.5, elem: 'dark', fx: 'doom', curse: 3 })), // 언데드의 저주 3중첩
    S('deathFog', '죽음의 안개', 12, 0, 240, ({ w, Tr, p }) => w.tsZone(Tr, p.x, p.y, { r: 56, dur: 5, k: 0.03, color: '#8a6aa8' })),
    S('corpseBlast', '시체 폭발', 6, 0, 999, ({ w, Tr, e }) => w.tsCorpses(Tr, e), (Tr) => Tr.corpses?.length > 0),
  ],
  dagger: [
    S('ambush', '급습', 6, 0, 200, ({ w, e }) => { w.tsBehind(e); w.tsMelee(e, 'dagger', 0.25, { k: 0.1 }); }),
    S('shadowStep', '그림자 이동', 5, 0, 80, ({ w, e, a }) => w.tsDash(e, a + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2, 70, 0.12)),
    S('smokeBomb', '연막탄', 12, 0, 120, ({ w, Tr, e }) => { w.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 48, elem: 'dark', fx: 'smoke' }); Tr.invulnT = 1.2; Tr.invulnMsg = '연막 속이다'; e.fakeGhost = true; w.tsLater(1.2, () => { if (Tr.main === e) e.fakeGhost = false; w.tsBehind(e); w.tsMelee(e, 'dagger', 0.2, { k: 0.12 }); }); }),
    S('dartFan', '독침 난사', 6, 30, 200, ({ w, e, a }) => w.tsRays(e, [-0.5, -0.25, 0, 0.25, 0.5].map((o) => a + o), { len: 170, w: 10, k: 0.05, wind: 0.4, fx: 'arrowBeam', tele: true })),
    S('shadowBind', '그림자 꿰기', 9, 30, 220, ({ w, e, a }) => w.tsRays(e, [a], { len: 220, w: 14, k: 0.06, wind: 0.4, fx: 'arrowBeam', tele: true, root: 1.0, elem: 'dark' })),
    S('shadowDance', '그림자 춤', 15, 0, 160, ({ w, e }) => { for (let i = 0; i < 5; i++) w.tsLater(0.2 + i * 0.22, () => { w.tsBehind(e, i * 1.3); w.tsSlashNow(e, 32, 0.06); }); }),
  ],
  bow: [
    S('pierceArrow', '관통 화살', 4, 40, 320, ({ w, e, a }) => w.tsRays(e, [a], { len: 320, w: 14, k: 0.1, wind: 0.35, fx: 'arrowBeam', tele: true })),
    S('retreatShot', '후퇴 사격', 6, 0, 110, ({ w, e, a }) => { w.tsDash(e, a + Math.PI + (Math.random() - 0.5), 80, 0.16); w.tsLater(0.2, () => w.tsRays(e, [Math.atan2(w.player.y - e.y, w.player.x - e.x)], { len: 260, w: 14, k: 0.08, wind: 0.05, fx: 'arrowBeam' })); }),
    S('pushArrow', '밀쳐내기 화살', 7, 0, 160, ({ w, e, a }) => w.tsRays(e, [a], { len: 240, w: 18, k: 0.07, wind: 0.4, fx: 'arrowBeam', tele: true, knock: 44 })),
    S('volley', '일제 사격', 7, 40, 300, ({ w, e, a }) => w.tsRays(e, [-0.4, -0.2, 0, 0.2, 0.4].map((o) => a + o), { len: 280, w: 12, k: 0.06, wind: 0.5, fx: 'arrowBeam', tele: true })),
    S('spiritArrow', '정령의 화살', 6, 60, 320, ({ w, e }) => { w.trialSay(e, '「정령의 화살」', '#9be8a0'); w.tsLater(0.7, () => w.tsRays(e, [Math.atan2(w.player.y - e.y, w.player.x - e.x)], { len: 320, w: 16, k: 0.09, wind: 0.05, fx: 'arrowBeam' })); }), // 날아가기 직전에 다시 겨눈다 (따라오는 화살)
    S('skyPiercer', '천공의 한 발', 14, 60, 330, ({ w, Tr, e, a }) => { w.beginAtk(e, 'bow', { wind: 1.2, cfg: { k: 0.26, big: true } }); w.emit({ t: 'telegraph', id: e.id, x: e.x, y: e.y, dx: Math.cos(a), dy: Math.sin(a), len: 330, w: 30 }); w.trialSay(e, '차지…', '#ffe8a8'); Tr.t = 1.5; }),
  ],
  fist: [
    S('counter', '맞받기', 8, 0, 60, ({ w, Tr }) => w.tsCounter(Tr, 0.8, 0.12)),
    S('rush', '돌격', 7, 60, 200, ({ w, e }) => w.tsDashHit(e, 150, 0.25, 0.1, 30)),
    S('headbutt', '박치기', 7, 0, 40, ({ w, e }) => w.tsMelee(e, 'fist', 0.3, { range: 26, k: 0.1, stun: 0.4 })),
    S('tremor', '지축 울림', 10, 0, 90, ({ w, e }) => w.tsCircle(e, e.x, e.y, { r: 70, k: 0.08, wind: 0.6, fx: 'quake', slow: 1.2, windup: true })),
    S('berserk', '광전사화', 16, 0, 999, ({ w, Tr, e }) => w.tsPower(Tr, e, 6, '광전사화')),
    S('rakeRetreat', '치고 빠지기', 6, 0, 50, ({ w, Tr, e }) => { w.tsMelee(e, 'fist', 0.15, { k: 0.05 }, { combo: [0, 2], cw: 0.1 }); w.tsLater(0.6, () => w.tsDash(e, Math.atan2(e.y - w.player.y, e.x - w.player.x), 60, 0.12)); }),
  ],
  spear: [
    S('harpoon', '작살', 9, 70, 240, ({ w, e, a }) => w.tsRays(e, [a], { len: 240, w: 14, k: 0.06, wind: 0.5, fx: 'arrowBeam', tele: true, pull: true })),
    S('leap', '도약', 9, 50, 220, ({ w, Tr, e, p }) => w.tsLeap(Tr, e, p.x, p.y)),
    S('dragonClaw', '용 발톱', 6, 0, 60, ({ w, e }) => w.tsMelee(e, 'spear', 0.3, { range: 50, arc: 1.2, k: 0.06, kind: 'slash' }, { combo: [0, 1, 0], cw: 0.15 })),
    S('breath', '화염 숨결', 9, 0, 110, ({ w, Tr, e, a }) => w.tsBreath(Tr, e, a)),
    S('spinThrust', '회오리 찌르기', 7, 0, 60, ({ w, e }) => w.tsMelee(e, 'spear', 0.4, { range: 54, k: 0.1, spin: true })),
    S('firePillar', '화염 기둥', 8, 40, 260, ({ w, e, p }) => w.tsCircle(e, p.x, p.y, { r: 36, k: 0.12, wind: 0.7, elem: 'fire', fx: 'burst' })),
  ],
};

export const TeacherSkillMethods = {
  // 이번에 쓸 스킬을 고른다: 쿨타임이 돈 것 가운데 거리가 맞는 것 (원래 쓰던 무기 능력도 함께)
  trialUseSkill(dist) {
    const Tr = this.trial, e = Tr.main, p = this.player, list = TEACHER_SKILLS[Tr.fam] || [];
    Tr.skCd ||= {};
    const surge = Tr.surgeT > 0; // 마력 폭주: 주문은 쿨타임 없이 · 하나 쓰면 1초
    const pool = list.filter((s) => (surge || (Tr.skCd[s.id] || 0) <= this.t) && dist >= s.min && dist <= s.max && (!s.need || s.need(Tr)) && !(surge && s.id === 'slowField'));
    const WS_MAX = { sword: 55, heavy: 70, scythe: 60, magic: 90 }; // 무기 능력도 닿는 거리에서만
    if (!surge && (Tr.skCd.weapon || 0) <= this.t && dist < (WS_MAX[Tr.fam] || 170)) pool.push({ id: 'weapon', cd: 6.5 });
    if (!pool.length) { Tr.skT = 0.5; return false; }
    const s = pool[this.rng.int(0, pool.length - 1)];
    Tr.skCd[s.id] = this.t + s.cd; Tr.skT = surge ? 1.0 : 2.2; // 스킬과 스킬 사이 2.2초 (평타 · 움직임이 그 사이에)
    this.trialPayback(e); // 대족장: 스킬을 쓸 때마다 받은 피해를 되갚는다
    if (s.id === 'weapon') { this.trialWeaponSkill(); return true; }
    Tr.s = 'wskill'; Tr.t = 0.8;
    this.trialSay(e, `「${s.name}」`, '#ffe0a0');
    this.trialMotion(e, MO_OF[s.id] || s.id);
    s.run({ w: this, Tr, e, p, a: Math.atan2(p.y - e.y, p.x - e.x), d: dist });
    return true;
  },
  // 매 프레임: 남는 장판 · 힘 · 저주 · 받아치기 · 소환체
  trialSkillTick() {
    const Tr = this.trial, p = this.player;
    if (Tr.powT > 0) Tr.powT -= DT;
    if (Tr.shoutT > 0) Tr.shoutT -= DT;
    if (Tr.surgeT > 0) Tr.surgeT -= DT;
    if (Tr.counterT > 0) { Tr.counterT -= DT; if (Math.random() < 0.3) this.emit({ t: 'spark', x: Tr.main.x, y: Tr.main.y - 10, color: '#fff0a0' }); }
    for (const z of Tr.zones || []) {
      if ((z.next -= DT) > 0) continue;
      z.next = 0.5;
      this.emit({ t: 'skillAoe', x: z.x, y: z.y, r: z.r, elem: z.lava ? 'fire' : z.slow ? 'ice' : 'dark', fx: z.lava ? 'burst' : z.slow ? 'ice' : 'fog', lite: true });
      if (Math.hypot(p.x - z.x, p.y - z.y) <= z.r) { if (z.k) this.hurtPlayer(this.trialDmg(z.k), z.lava ? 'phys' : 'mag', Tr.main, { direct: true, status: z.lava ? 'burn' : undefined }); if (z.slow) this.ccPlayer({ slow: 0.6 }); }
    }
    if (Tr.zones) Tr.zones = Tr.zones.filter((z) => z.until > this.t);
    if (Tr.minions?.length) { // 쓰러진 해골은 시체로 남는다 (시체 폭발)
      for (const m of Tr.minions) if (m.dead && !m.corpsed) { m.corpsed = true; (Tr.corpses ||= []).push({ x: m.x, y: m.y }); }
      Tr.minions = Tr.minions.filter((m) => !m.dead);
    }
  },
  // 플레이어가 그 스킬을 쓸 때와 같은 몸 동작을 건다 (그리는 쪽은 e.held.motion 을 플레이어의 p.motion 처럼 쓴다)
  trialMotion(e, id) {
    const def = SKILLS[id], H = e?.held; if (!H) return;
    const mo = def?.mo || (def?.kind === 'spell' ? 'cast' : null); if (!mo) return;
    const p = this.player;
    H.motion = { kind: mo, t: 0, dur: (MOTION_DUR[mo] || 0.35) * (def?.cast ? 1 : 1), ang: Math.atan2(p.y - e.y, p.x - e.x), dir: p.x >= e.x ? 1 : -1, lock: true };
    e.dir = H.motion.dir;
  },
  trialSkillEnd() { const Tr = this.trial; for (const m of Tr?.minions || []) m.dead = true; },

  // ───── 재료 ─────
  tsLater(t, f) { const Tr = this.trial; this.delayed.push({ t, run: () => { if (this.trial === Tr && !Tr.done) f(); } }); },
  tsMelee(e, fam, wind, cfg, over = {}) { this.beginAtk(e, fam, { wind, cfg, ...over }); this.trial.t = wind + 0.5; },
  tsDash(e, a, dist, dur = 0.18) { const Tr = this.trial; this.trialDash(e, a, dist, dur, Tr.dashCd); },
  tsDashHit(e, dist, wind, k, knock = 0) { // 겨눴다가 일직선으로 뚫고 지나간다 (지나간 길에 있으면 맞는다)
    const Tr = this.trial; this.emit({ t: 'windup', id: e.id });
    this.tsLater(wind, () => {
      const p = this.player, a = Math.atan2(p.y - e.y, p.x - e.x), x0 = e.x, y0 = e.y;
      this.trialDash(e, a, dist, 0.16, Tr.dashCd);
      this.tsLater(0.16, () => {
        this.emit({ t: 'swing', x: e.x, y: e.y, ang: a, range: 40, arc: 0.4, type: 'phys', dir: 1, dur: 0.14, thrust: true });
        const q = this.player, dx = e.x - x0, dy = e.y - y0, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((q.x - x0) * dx + (q.y - y0) * dy) / L2));
        if (Math.hypot(q.x - (x0 + dx * t), q.y - (y0 + dy * t)) < 18) { this.hurtPlayer(this.trialDmg(k), 'phys', e, { fromX: x0, fromY: y0 }); if (knock) this.knockPlayer(x0, y0, knock); }
      });
    });
    Tr.t = wind + 0.5;
  },
  // 일직선 여러 줄 (화살 · 검기 · 뼈 창 · 작살): 예고 선 → wind초 뒤에 날아간다
  tsRays(e, angs, o) {
    const Tr = this.trial;
    if (o.tele) for (const a of angs) this.emit({ t: 'telegraph', id: e.id, x: e.x, y: e.y, dx: Math.cos(a), dy: Math.sin(a), len: o.len, w: o.w });
    this.emit({ t: 'windup', id: e.id });
    this.tsLater(o.wind, () => {
      this.emit({ t: 'shoot', x: e.x, y: e.y, ang: angs[0], type: 'phys' });
      for (const a of angs) if (this.trialRay(e, a, o.len, o.w, o.k, o.fx)) {
        const p = this.player;
        if (o.knock) this.knockPlayer(e.x, e.y, o.knock);
        if (o.pull) { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d > 30) this.knockPlayer(e.x, e.y, Math.min(d - 26, 140), { ang: Math.atan2(e.y - p.y, e.x - p.x) }); this.trialSay(e, '이리 와라', '#ffb070'); } // 작살: 끌어당긴다
        if (o.slow) this.ccPlayer({ slow: o.slow });
        if (o.root) this.ccPlayer({ root: o.root, say: '묶였다' });
        if (o.burn) for (let i = 0; i < o.burn; i++) this.applyPlayerStatus?.('burn', this.d.maxHp * 0.02);
      }
      if (o.shake) this.emit({ t: 'shake', v: o.shake });
    });
    Tr.t = o.wind + 0.5;
  },
  // 원: 예고 원 → wind초 뒤에 터진다
  tsCircle(e, x, y, o) {
    const Tr = this.trial;
    if (o.wind > 0.05) this.emit({ t: 'telegraphCircle', x, y, r: o.r, dur: o.wind });
    if (o.windup) this.emit({ t: 'windup', id: e.id });
    this.tsLater(o.wind, () => {
      this.emit({ t: 'skillAoe', x, y, r: o.r, elem: o.elem || 'phys', fx: o.fx || 'burst' });
      if (o.shake) this.emit({ t: 'shake', v: o.shake });
      const p = this.player; if (Math.hypot(p.x - x, p.y - y) > o.r + 5) return;
      if (o.k) this.hurtPlayer(this.trialDmg(o.k), o.elem && o.elem !== 'phys' ? 'mag' : 'phys', e, { fromX: x, fromY: y });
      if (o.knock) this.knockPlayer(x, y, o.knock);
      if (o.slow) this.ccPlayer({ slow: o.slow });
      if (o.root) this.ccPlayer({ root: o.root, say: '붙잡혔다' });
      if (o.curse) this.addPlayerCurse(o.curse);
    });
    Tr.t = Math.max(Tr.t, o.wind + 0.4);
  },
  tsZone(Tr, x, y, o) { (Tr.zones ||= []).push({ x, y, r: o.r, until: this.t + o.dur, k: o.k || 0, slow: !!o.slow, next: 0.3 }); this.emit({ t: 'telegraphCircle', x, y, r: o.r, dur: 0.3 }); Tr.t = 0.6; },
  tsPower(Tr, e, dur, name) { Tr.powT = dur; this.emit({ t: 'bossHeal', id: e.id, x: e.x, y: e.y, from: 1, to: 1, big: false }); this.emit({ t: 'text', x: e.x, y: e.y - 30, text: `${name} · 공격 +30%`, color: '#ff8a5a' }); Tr.t = 0.6; },
  tsCounter(Tr, dur, k) { Tr.counterT = dur; Tr.counterK = k; this.emit({ t: 'windup', id: Tr.main.id }); Tr.t = dur; },
  tsBehind(e, rot = 0) { // 내 등 뒤(또는 둘레)로 순간이동
    const p = this.player, a0 = Math.atan2(p.aimY ?? 0, p.aimX ?? 1) + Math.PI + rot;
    for (const d of [26, 34, 44]) { const x = p.x + Math.cos(a0) * d, y = p.y + Math.sin(a0) * d; if (!this.blocked(x, y, 6)) { this.emit({ t: 'blink', x1: e.x, y1: e.y, x2: x, y2: y }); e.x = x; e.y = y; return; } }
  },
  tsSlashNow(e, r, k) { const p = this.player, a = Math.atan2(p.y - e.y, p.x - e.x); this.emit({ t: 'swing', x: e.x, y: e.y, ang: a, range: r, arc: 1.8, type: 'phys', dir: 1, dur: 0.12 }); if (Math.hypot(p.x - e.x, p.y - e.y) <= r + 8) this.hurtPlayer(this.trialDmg(k), 'phys', e, { fromX: e.x, fromY: e.y }); },
  tsLeap(Tr, e, x, y) { // 도약: 뛰어올라 내 자리에 내려찍는다 (그림자 · 예고 원)
    const x0 = e.x, y0 = e.y, T = 0.9;
    this.emit({ t: 'telegraphCircle', x, y, r: 54, dur: T });
    for (let i = 1; i <= 9; i++) this.tsLater((T * i) / 9, () => { const k = i / 9; e.x = x0 + (x - x0) * k; e.y = y0 + (y - y0) * k; e.jumpH = Math.sin(k * Math.PI) * 34; });
    this.tsLater(T, () => { e.jumpH = 0; if (this.blocked(e.x, e.y, 6)) { e.x = x0; e.y = y0; } this.tsCircle(e, e.x, e.y, { r: 54, k: 0.14, wind: 0.01, fx: 'quake', knock: 34, shake: 5 }); });
    Tr.t = T + 0.4;
  },
  tsBreath(Tr, e, a) { // 화염 숨결: 1초 동안 앞쪽 부채꼴을 태운다 (방향은 처음에 정해진다)
    this.emit({ t: 'telegraph', id: e.id, x: e.x, y: e.y, dx: Math.cos(a), dy: Math.sin(a), len: 100, w: 60 });
    for (let i = 0; i < 7; i++) this.tsLater(0.35 + i * 0.15, () => {
      this.emit({ t: 'skillCone', x: e.x, y: e.y, ang: a, range: 72, angle: 0.9, elem: 'fire', fx: 'breath' });
      const p = this.player, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy); let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (d <= 104 && Math.abs(da) <= 0.5) this.hurtPlayer(this.trialDmg(0.03), 'mag', e, { fromX: e.x, fromY: e.y, direct: true });
    });
    Tr.t = 1.5;
  },
  tsSummon(Tr, e) { // 해골 병사: 한 번에 셋까지 (약해서 몇 대면 쓰러진다 · 쓰러지면 시체가 남는다)
    Tr.minions = (Tr.minions || []).filter((m) => !m.dead);
    const n = SUMMON_MAX - Tr.minions.length; if (n <= 0) { Tr.t = 0.2; return; }
    const power = Math.max(this.d.physAtk, this.d.dexAtk, this.d.magAtk);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = e.x + Math.cos(a) * 34, y = e.y + Math.sin(a) * 26; if (this.blocked(x, y, 6)) continue;
      const m = this.makeEnemy('skeleton', x, y, { noAffix: true }); if (!m) continue;
      m.hp = m.maxHp = Math.round(power * 2.5); m.atk = this.d.maxHp * 0.05; m.state = 'chase'; m.trialMinion = true;
      this.enemies.push(m); Tr.minions.push(m); this.emit({ t: 'skillAoe', x, y, r: 16, elem: 'dark', fx: 'doom', lite: true });
    }
    Tr.t = 0.8;
  },
  tsCorpses(Tr, e) { // 시체 폭발: 쓰러진 해골 자리마다 터진다
    const list = (Tr.corpses || []).splice(0, 4);
    for (const c of list) this.tsCircle(e, c.x, c.y, { r: 46, k: 0.12, wind: 0.6, elem: 'dark', fx: 'doom' });
    Tr.t = 1.0;
  },
};

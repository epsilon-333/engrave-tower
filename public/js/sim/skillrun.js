// World — 플레이어 스킬 실행 (스킬 효과 op · 시전 · 특수 동작 · 발동 효과)
// World.prototype 에 그대로 붙는다 (sim/world.js 끝). 메서드 안의 this 는 World

import { WEAPON_SKILLS } from '../data/items.js';
import { SKILLS, ELEM, ELEM_CYCLE, handFit, crossMul, CANT_TEXT, SKILL_BAL } from '../data/skills.js';
import { SPIRITS, SPIRIT_GRADES } from '../data/spirits.js';
import { skillScale } from '../data/statscale.js';
import { absMin } from './time.js';
import { DT, MOTION_DUR, SKILL_TSTAT, SPIRIT_DMG_ELEM, SPIRIT_OPS, STATUS_COLOR, WINDUP, distToSeg } from './world.js';

export const SkillMethods = {
  runOp(op, ctx) {
    const p = this.player;
    if (ctx.auto) {
      if (ctx.target && !ctx.target.dead) this.faceTo(ctx.target.x, ctx.target.y);
      else if (ctx.point) this.faceTo(ctx.point.x, ctx.point.y);
    }
    const ang = Math.atan2(p.aimY, p.aimX);
    const countHits = (list, extra = 1) => {
      let hits = 0, kills = 0;
      for (const e of list) { hits++; if (this.skillHit(e, op, ctx, extra)) kills++; }
      if (op.gainPerHit) this.addRes(op.gainPerHit * hits);
      if (op.gainPerKill) this.addRes(op.gainPerKill * kills);
      if (op.healOnKill && kills) this.heal(this.d.maxHp * op.healOnKill, 'skill');
      return hits;
    };
    switch (op.op) {
      case 'dash': {
        if (op.delay && !op._now) { this.delayed.push({ t: op.delay, run: () => this.runOp({ ...op, _now: true }, ctx) }); break; }
        let dx = p.aimX, dy = p.aimY, dist = op.dist + (op.chargeDist || 0) * (ctx.charge || 0);
        if (op.focusGain) { p.focus = Math.max(p.focus, op.focusGain); p.focusKeep = true; }
        if (op.toward === 'farthestEngaged') { // 나를 쫓는(싸우고 있는) 적 가운데 가장 먼 적, 없으면 가장 가까운 적
          const fight = this.enemies.filter((e) => !e.dead && !e.hidden && e.def.ai !== 'dummy' && (e.state === 'chase' || this.mode === 'plaza' || this.practice) && Math.hypot(e.x - p.x, e.y - p.y) < op.dist);
          const t = fight.length ? fight.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) > Math.hypot(a.x - p.x, a.y - p.y) ? b : a)) : this.nearestEnemy(op.dist);
          if (t) { const vx = t.x - p.x, vy = t.y - p.y, l = Math.hypot(vx, vy) || 1; dx = vx / l; dy = vy / l; dist = Math.max(0, l - t.r - 6); this.faceTo(t.x, t.y); ctx.target = t; }
        } else if (op.toward === 'nearest') {
          const t = this.nearestEnemy(op.dist);
          if (t) { const vx = t.x - p.x, vy = t.y - p.y, l = Math.hypot(vx, vy) || 1; dx = vx / l; dy = vy / l; dist = Math.max(0, l - t.r - 6); }
        }
        else if (ctx.auto && op.dist > 0 && ctx.target && !ctx.target.dead) dist = Math.min(op.dist, Math.max(20, Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) - 6));
        if (dist < 0) { dx = -dx; dy = -dy; dist = -dist; }
        // 벽에 박히지 않게
        while (dist > 0 && this.blocked(p.x + dx * dist, p.y + dy * dist, 5)) dist -= 6;
        dist = Math.max(0, dist);
        const x1 = p.x, y1 = p.y;
        const dur = 0.18;
        p.dashT = dur; p.dvx = dx * dist / dur; p.dvy = dy * dist / dur;
        p.invuln = Math.max(p.invuln, op.invuln || 0.25);
        const x2 = x1 + dx * dist, y2 = y1 + dy * dist;
        this.emit({ t: 'skillDash', x1, y1, x2, y2, elem: ctx.elem });
        if (op.mul) countHits(this.enemies.filter((e) => !e.dead && !e.hidden && distToSeg(e.x, e.y, x1, y1, x2, y2) < e.r + 14));
        if (op.iceTrail) for (let i = 1; i <= 4; i++) this.zones.push({ kind: 'frost', x: x1 + (x2 - x1) * i / 4, y: y1 + (y2 - y1) * i / 4, r: 20, t: 3, max: 3, tick: 0, atk: ctx.atk });
        if (op.fireTrail) for (let i = 1; i <= 4; i++) this.zones.push({ kind: 'fire', x: x1 + (x2 - x1) * i / 4, y: y1 + (y2 - y1) * i / 4, r: 18, t: 3, tick: 0, atk: ctx.atk });
        break;
      }
      case 'behind': { // 적의 등 뒤로 옮겨 간다 (등이 막혀 있으면 옆 · 앞)
        const t = ctx.target && !ctx.target.dead ? ctx.target : this.nearestEnemy(op.range, false);
        if (!t || Math.hypot(t.x - p.x, t.y - p.y) > op.range) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '닿는 적이 없다', color: '#a8b0c0' }); break; }
        const x1 = p.x, y1 = p.y, fd = t.dir || (p.x < t.x ? 1 : -1), gap = t.r + p.r + 4;
        const spots = [[-fd * gap, 0], [0, gap], [0, -gap], [fd * gap, 0]];
        const sp = spots.find(([ox, oy]) => !this.blocked(t.x + ox, t.y + oy, 5)) || [0, 0];
        p.x = t.x + sp[0]; p.y = t.y + sp[1]; this.faceTo(t.x, t.y);
        p.invuln = Math.max(p.invuln, 0.25);
        this.emit({ t: 'blink', x1, y1, x2: p.x, y2: p.y });
        ctx.target = t;
        break;
      }
      case 'teleport': {
        const x1 = p.x, y1 = p.y;
        let dist = op.dist;
        if (ctx.tp && !this.blocked(ctx.tp.x, ctx.tp.y, 5) && Math.hypot(ctx.tp.x - p.x, ctx.tp.y - p.y) < op.dist * 2.2) { p.x = ctx.tp.x; p.y = ctx.tp.y; dist = -1; if (ctx.target) this.faceTo(ctx.target.x, ctx.target.y); }
        else if (ctx.auto && ctx.target && !ctx.target.dead) dist = Math.min(op.dist, Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) - 10);
        else if (ctx.auto && ctx.point) dist = Math.min(op.dist, Math.hypot(ctx.point.x - p.x, ctx.point.y - p.y));
        if (dist >= 0) {
          while (dist > 0 && this.blocked(p.x + p.aimX * dist, p.y + p.aimY * dist, 5)) dist -= 6;
          p.x += p.aimX * Math.max(0, dist); p.y += p.aimY * Math.max(0, dist);
        }
        p.invuln = Math.max(p.invuln, 0.2);
        this.emit({ t: 'blink', x1, y1, x2: p.x, y2: p.y });
        if (op.echo) {
          const ec = op.echo;
          this.emit({ t: 'echoMark', x: x1, y: y1, dur: ec.delay, r: ec.r });
          this.delayed.push({ t: ec.delay, run: () => { this.emit({ t: 'skillAoe', x: x1, y: y1, r: ec.r, elem: 'arcane', fx: 'arcane' }); for (const e of this.enemiesNear(x1, y1, ec.r)) this.skillHit(e, { mul: ec.mul }, ctx); } });
        }
        if (this.raceRes?.dash) this.addRes(this.raceRes.dash);
        break;
      }
      case 'aoe': {
        const c = op.at === 'aim' ? (ctx.auto && ctx.point ? { ...ctx.point } : this.aimPoint(op.range || 200)) : op.at === 'front' ? { x: p.x + p.aimX * (op.dist || 26), y: p.y + p.aimY * (op.dist || 26) } : { x: p.x, y: p.y };
        if (op.at === 'aim' && ctx.auto && ctx.target && !ctx.point) { c.x = ctx.target.x; c.y = ctx.target.y; }
        if (op.jitter) { c.x += this.rng.range(-op.jitter, op.jitter); c.y += this.rng.range(-op.jitter, op.jitter); }
        const follow = op.at === 'self';
        const run = () => {
          if (follow) { c.x = p.x; c.y = p.y; }
          let list = this.enemiesNear(c.x, c.y, op.r);
          if (op.spareNearest && list.length > 1) { const nn = list.reduce((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b)); list = list.filter((e) => e !== nn); this.emit({ t: 'lockOn', x: nn.x, y: nn.y, kind: 'low' }); }
          if (op.pullTo) for (const e of list) if (!e.def.elite || true) { const dx = c.x - e.x, dy = c.y - e.y, l = Math.hypot(dx, dy) || 1; const k = e.def.elite ? 0.5 : 1; e.kbx += (dx / l) * Math.min(320, l * 7) * k; e.kby += (dy / l) * Math.min(320, l * 7) * k; }
          this.emit({ t: 'skillAoe', x: c.x, y: c.y, r: op.r, elem: ctx.elem, fx: op.fx || ctx.def.fx, ult: ctx.def.ult, rar: ctx.def.weaponSkill && this.b.weaponItem?.towerWeapon ? this.b.weaponItem.rarity : undefined, wcat: ctx.def.weaponSkill ? this.b.wcat : undefined });
          countHits(list, op.perHit ? 1 + op.perHit * Math.max(0, list.length - 1) : 1);
        };
        if (op.delay) {
          // 내 스킬은 빨간 예고 원 없이 (떨어지는 것 · 모여드는 것이 자리를 보여 준다)
          this.emit({ t: 'skillFall', x: c.x, y: c.y, r: op.r, dur: op.delay, fx: op.fx || ctx.def.fx, elem: ctx.elem });
          if (op.fall) this.emit({ t: 'fall', x: c.x, y: c.y, r: op.r, dur: op.delay, kind: op.fall });
          this.delayed.push({ t: op.delay, run });
        } else run();
        break;
      }
      case 'cone': {
        if (op.chargeRange && ctx.charge) op = { ...op, range: op.range * (1 + op.chargeRange * ctx.charge) };
        if (op._form === 'melee' && ctx.target && !ctx.target.dead) { // 근접 마법: 표적이 조금 멀면 한 걸음 파고든다
          const dd = Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) - ctx.target.r - op.range * 0.7;
          if (dd > 0 && dd < 60) { let st = dd; while (st > 0 && this.blocked(p.x + p.aimX * st, p.y + p.aimY * st, 5)) st -= 6; if (st > 0) { const x1 = p.x, y1 = p.y; p.x += p.aimX * st; p.y += p.aimY * st; this.emit({ t: 'skillDash', x1, y1, x2: p.x, y2: p.y, elem: ctx.elem }); } }
        }
        if (p.buffs.dragonForm) op = { ...op, range: op.range * 1.4, angle: op.angle * 1.2 }; // 용의 몸집만큼 넓게
        const list = this.enemies.filter((e) => {
          if (e.dead || e.hidden) return false;
          const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
          if (dist > op.range + e.r) return false;
          let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
          return Math.abs(da) <= op.angle / 2 || dist < e.r + 8;
        });
        this.emit({ t: 'skillCone', x: p.x, y: p.y, ang, range: op.range, angle: op.angle, elem: ctx.elem, fx: op._form === 'melee' ? 'spellBlade' : op.fx || ctx.def.fx });
        const hits = countHits(list);
        if (hits && op.onHitGain) this.addRes(op.onHitGain);
        if (hits && op.onHitHeal) this.heal(this.d.maxHp * op.onHitHeal, 'skill');
        break;
      }
      case 'single': {
        const e = ctx.target && !ctx.target.dead && Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) < op.range + 40 ? ctx.target : this.nearestEnemy(op.range);
        if (!e) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        if (op.teleportTo) { const side = e.dir > 0 ? -1 : 1; let tx = e.x + side * (e.r + 8); if (this.blocked(tx, e.y, 5)) tx = e.x - side * (e.r + 8); this.emit({ t: 'blink', x1: p.x, y1: p.y, x2: tx, y2: e.y }); p.x = tx; p.y = e.y; }
        this.emit({ t: 'skillSingle', x: e.x, y: e.y, fx: op.fx || ctx.def.fx, elem: ctx.elem, big: !!op.scaleRes || ctx.def.ult });
        const bleedN = e.st.bleed?.n || 0;
        countHits([e]);
        if (op.healPerBleed && bleedN) { this.heal(this.d.maxHp * op.healPerBleed * Math.min(5, bleedN), 'skill'); /* 다섯 중첩까지 */ this.emit({ t: 'text', x: p.x, y: p.y - 22, text: `포식 +${bleedN}`, color: '#e0445a' }); }
        break;
      }
      case 'proj': {
        // 무기에 따라 마법 모양이 바뀐다: 근접 무기면 앞쪽을 휩쓰는 짧고 센 마법, 활 · 바람총이면 빠르고 멀리 가는 마법 화살
        if (ctx.def.kind === 'spell' && !op._form) {
          if (this.b.weapon.kind === 'melee') { const n = op.n || 1; return this.runOp({ ...op, op: 'cone', _form: 'melee', range: 62, angle: 1.7, mul: (op.mul || 1) * 1.2 * (n > 1 ? 1 + 0.3 * (n - 1) : 1) }, ctx); }
          if (this.b.wcat === 'bow' || this.b.wcat === 'tube') op = { ...op, _form: 'bow', speed: op.speed * 1.5, range: op.range * 1.3 };
        }
        if (ctx.def.kind === 'shoot' && ctx.hand === 'off') op = { ...op, kind: 'bolt', status: op.status === 'poison' ? null : op.status }; // 왼손 손쇠뇌: 쇠살
        if (ctx.def.kind === 'shoot' && ctx.hand !== 'off') { // 든 무기가 쏜다: 활이면 화살, 석궁이면 쇠살, 바람총이면 독침
          const wc = this.b.wcat, bolt = this.b.weapon.projKind === 'bolt';
          if (wc === 'bow' && (op.kind === 'dart' || bolt)) op = { ...op, kind: bolt ? 'bolt' : 'arrow', status: op.status === 'poison' ? null : op.status };
          else if (wc === 'tube' && op.kind === 'arrow') op = { ...op, kind: 'dart' };
        }
        if (op.focus && this.b.cls === 'ranger' && p.focus > 0) { ctx = { ...ctx, bonus: ctx.bonus * (1 + 0.25 * p.focus) }; p.focus = 0; p.focusT = 0; }
        if (op.fullPierce && ctx.charge >= 3) op = { ...op, pierce: 99, mul: op.mul * 1.2 };
        for (let i = 0; i < (op.n || 1); i++) {
          const a = ang + (i - ((op.n || 1) - 1) / 2) * (op.spread || 0);
          const mz = this.muzzle(a);
          this.projs.push({
            owner: 'p', x: mz.x, y: mz.y, vx: Math.cos(a) * op.speed, vy: Math.sin(a) * op.speed,
            life: op.range / op.speed, maxLife: op.range / op.speed, boomerang: !!op.boomerang, dmg: 0, type: 'mag', pierce: op.pierce || 0, hit: new Set(), splash: 0,
            color: ELEM[ctx.elem]?.color || '#e8e0f4', kind: op.kind === 'rock' ? 'rock' : 'skill', skind: op.kind, elem: ctx.elem, big: true, homing: op.homing, rot: a,
            skillHit: (e, pr) => {
              this.skillHit(e, op, ctx);
              if (op.onHitGain) this.addRes(op.onHitGain);
              if (op.onHitHeal) this.heal(this.d.maxHp * op.onHitHeal, 'skill');
              if (op.splash) {
                this.emit({ t: 'skillAoe', x: pr.x, y: pr.y, r: op.splash, elem: ctx.elem, fromProj: true, fx: op.kind === 'rock' ? 'rocks' : op.kind === 'icerock' ? 'ice' : op.kind === 'plague' ? 'fog' : 'pop' });
                for (const o of this.enemiesNear(pr.x, pr.y, op.splash)) if (o !== e) this.skillHit(o, op, ctx, 0.6);
              }
            },
          });
        }
        break;
      }
      case 'chain': {
        let cur = ctx.target && !ctx.target.dead ? ctx.target : this.nearestEnemy(170);
        const pts = [{ x: p.x, y: p.y - 6 }], hit = new Set();
        for (let j = 0; j < op.jumps && cur; j++) {
          hit.add(cur.id); pts.push({ x: cur.x, y: cur.y - 6 });
          this.skillHit(cur, op, ctx, j === 0 ? 1 : 0.85);
          let nx = null, nd = op.range;
          for (const e of this.enemies) { if (e.dead || e.hidden || hit.has(e.id)) continue; const dd = Math.hypot(e.x - cur.x, e.y - cur.y); if (dd < nd) { nd = dd; nx = e; } }
          cur = nx;
        }
        this.emit({ t: 'bolt', pts, color: ELEM[ctx.elem]?.color || '#f8f070' });
        break;
      }
      case 'channel': p.channel = { t: op.dur, every: op.every, tick: 0, sub: op.sub, ctx, invuln: op.invuln }; break;
      case 'comboSpin': p.combo = { op, ctx, i: 0, t: 0, ang }; break;
      case 'enchant': { // 무기에 속성을 입힌다 (평타 · 무기 기술에 그 속성 피해가 더해진다)
        p.buffs.enchant = { t: op.dur, max: op.dur, mods: {}, color: ELEM[op.elem].color, name: ctx.def.name, elem: op.elem, pow: op.pow, stacks: op.stacks || 1 };
        this.emit({ t: 'enchant', x: p.x, y: p.y, elem: op.elem });
        break;
      }
      case 'waterBreath': { // 저장에 남는다 (바닷속은 다른 세계라서)
        if (this.persist && this.clock) {
          const now = absMin(this.clock), i = this.persist.findIndex((e) => e.id === 'waterBreath');
          if (i >= 0) this.persist.splice(i, 1);
          this.persist.push({ id: 'waterBreath', name: '수중 호흡', mods: {}, color: '#7ad8ff', until: now + op.min, dur: op.min, src: 'skill' });
          this.applyPersist();
        } else p.buffs.waterBreath = { t: op.min, max: op.min, mods: {}, color: '#7ad8ff', name: '수중 호흡' };
        this.emit({ t: 'waterBreath', x: p.x, y: p.y });
        break;
      }
      case 'dive': this.tryDive(true); break;
      case 'buff': {
        const mods = { ...op.mods };
        if (op.scaleRes && mods.dmgMul) mods.dmgMul = 1 + (mods.dmgMul - 1) * (1 + ctx.spent / 100);
        p.buffs[op.id] = { t: op.dur, max: op.dur, mods, color: op.color, bubble: op.bubble, power: op.power };
        if (op.id !== 'nextCrit') this.emit({ t: 'buff', x: p.x, y: p.y, color: op.color || '#ffffff', bubble: op.bubble });
        break;
      }
      case 'parry': p.parryT = op.dur; p.parry = { mul: op.mul, r: op.r, gain: op.gain, stun: op.stun }; this.emit({ t: 'parryStance', x: p.x, y: p.y, dur: op.dur }); break;
      case 'summon': {
        if (op.max) { const mine = this.allies.filter((a) => a.kind === op.kind && a.t > 0); while (mine.length + op.n > op.max && mine.length) { const old = mine.shift(); old.t = 0; old.hp = 0; } } // 오래된 것부터 돌려보낸다
        for (let i = 0; i < op.n; i++) {
          const a = this.rng.range(0, Math.PI * 2);
          const elem = op.kind === 'spiritKing' ? ELEM_CYCLE[this.rng.int(0, 2)] : op.elem;
          if (op.kind === 'spiritKing') this.emit({ t: 'banner', text: `${ELEM[elem].name}의 정령왕 강림`, color: ELEM[elem].color });
          const hp = op.kind === 'skeleton' ? this.d.maxHp * 0.35 : op.kind === 'lich' ? this.d.maxHp * 0.8 : op.kind === 'lichMage' ? this.d.maxHp * 0.6 : op.kind === 'grasper' ? this.d.maxHp * 0.3 : 0, atk = ctx.atk * op.mul * (op.scaleRes ? ctx.resMul : 1) * ctx.bonus;
          if (op.perm && hp > 0) { const m = { kind: op.kind, maxHp: hp, atk, r: op.kind === 'lich' ? 8 : 6, scale: op.kind === 'lichMage' ? 1.25 : 1 }; this.minions.push(m); this.spawnMinion(m, p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, i); }
          else this.allies.push({ id: this.nextId++, kind: op.kind, perm: !!op.perm, elem, hp, maxHp: hp, x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, t: op.dur, max: op.dur,
            atk, cd: 0.3 + i * 0.2, phase: a, dir: 1 });
          this.emit({ t: 'summonFx', x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, kind: op.kind, elem, big: op.kind === 'spiritKing' || op.kind === 'lich' });
        }
        break;
      }
      case 'detonate': {
        const key = op.what;
        let n = 0;
        for (const e of [...this.enemies]) {
          if (e.dead || !e.st[key]) continue;
          const stacks = e.st[key].n;
          e.st[key] = null; n++;
          this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: op.r, elem: ctx.elem, fx: 'burst' });
          this.skillHit(e, { mul: op.mul * stacks, scaleRes: op.scaleRes }, ctx);
          for (const o of this.enemiesNear(e.x, e.y, op.r)) if (o !== e) this.skillHit(o, { mul: op.mul * stacks * 0.4, scaleRes: op.scaleRes }, ctx);
        }
        if (!n) this.emit({ t: 'text', x: p.x, y: p.y - 20, text: key === 'curse' ? '저주받은 적이 없다' : key === 'poison' ? '중독된 적이 없다' : '불타는 적이 없다', color: '#a8b0c0' });
        break;
      }
      case 'zone': {
        let c = op.at === 'aim' ? (ctx.auto && ctx.point ? { ...ctx.point } : ctx.auto && ctx.target ? { x: ctx.target.x, y: ctx.target.y } : this.aimPoint(200)) : { x: p.x, y: p.y + 2 };
        if (op.kind === 'bait') { const traps = this.zones.filter((z) => z.kind === 'trap' && z.t > 0); if (traps.length) { const tr = traps.reduce((a, b) => (Math.hypot(b.x - c.x, b.y - c.y) < Math.hypot(a.x - c.x, a.y - c.y) ? b : a)); c = { x: tr.x, y: tr.y }; this.emit({ t: 'text', x: c.x, y: c.y - 18, text: '덫 위에 미끼', color: '#ffcf8a' }); } }
        const atk = ctx.atk * ctx.bonus * (op.scaleRes ? ctx.resMul : 1);
        if (op.max) { const mine = this.zones.filter((z) => z.kind === op.kind); while (mine.length >= op.max) { const old = mine.shift(); old.t = 0; } }
        if (op.wall) {
          const nx = -p.aimY, ny = p.aimX;
          for (let i = 0; i < op.wall; i++) { const k = (i - (op.wall - 1) / 2) * op.r * 1.6; this.zones.push({ kind: op.kind, x: c.x + nx * k, y: c.y + ny * k, r: op.r, t: op.dur, max: op.dur, tick: 0, atk }); }
        } else this.zones.push({ kind: op.kind, x: c.x, y: c.y, r: op.r, t: op.dur, max: op.dur, tick: 0, atk });
        this.emit({ t: 'zoneFx', x: c.x, y: c.y, r: op.r, kind: op.kind });
        break;
      }
      case 'shift': {
        p.elem = ELEM_CYCLE[(ELEM_CYCLE.indexOf(p.elem) + 1) % ELEM_CYCLE.length];
        p.elemBonusT = 4;
        this.emit({ t: 'elemShift', x: p.x, y: p.y, elem: p.elem, weak: this.zElem?.weak === p.elem });
        break;
      }
      case 'spiritShift': {
        let n = 0;
        for (const al of this.allies) if (al.kind === 'spirit') { al.elem = ELEM_CYCLE[(ELEM_CYCLE.indexOf(al.elem) + 1) % ELEM_CYCLE.length]; n++; this.emit({ t: 'summonFx', x: al.x, y: al.y, kind: 'spirit', elem: al.elem }); }
        if (!n) this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '정령이 없다', color: '#a8b0c0' });
        break;
      }
      case 'resonance': {
        const sp = this.allies.filter((a) => a.kind === 'spirit');
        if (!sp.length) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '정령이 없다', color: '#a8b0c0' }); break; }
        const c = ctx.auto && ctx.point ? ctx.point : ctx.auto && ctx.target ? { x: ctx.target.x, y: ctx.target.y } : this.aimPoint(160);
        const elems = [...new Set(sp.map((a) => a.elem))];
        for (const a of sp) { if (!op.keep) a.t = 0; this.emit({ t: 'skillDash', x1: a.x, y1: a.y, x2: c.x, y2: c.y, elem: a.elem }); }
        this.emit({ t: 'skillAoe', x: c.x, y: c.y, r: op.r, elem: elems[0], fx: 'meteor' });
        for (const e of this.enemiesNear(c.x, c.y, op.r)) {
          this.skillHit(e, { mul: op.mul * (1 + 0.35 * (sp.length - 1)) }, { ...ctx, elem: elems[0] });
          for (const el of elems) this.applyStatus(e, ELEM[el].status, 2);
        }
        break;
      }
      case 'raiseSouls': { // 망자 부르기: 정해진 부하(해골 전사 둘 · 뼈 방패병 하나)를 부른다 · 쓰러질 때까지 남는다
        const room = 10 - this.minions.length;
        if (room <= 0) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '부하는 최대 10마리', color: '#a8b0c0' }); p.cds[ctx.id] = 0.5; this.addRes(ctx.spent); break; }
        const list = ['skeleton', 'skeleton', 'boneGuard'].slice(0, Math.min(op.n || 3, room));
        list.forEach((defId, i) => {
          const a = (i / list.length) * Math.PI * 2 + 0.5;
          let x = p.x + Math.cos(a) * 20, y = p.y + Math.sin(a) * 20;
          if (this.blocked(x, y, 5)) { x = p.x; y = p.y; }
          const m = { kind: 'soul', defId, maxHp: this.d.maxHp * (defId === 'boneGuard' ? 0.6 : 0.4), atk: ctx.atk * (defId === 'boneGuard' ? 0.5 : 0.7) * ctx.bonus, r: 6, scale: defId === 'boneGuard' ? 1.2 : 1 };
          this.minions.push(m); this.spawnMinion(m, x, y, i);
          this.emit({ t: 'summonFx', x, y, kind: 'soul', big: i === 0 });
        });
        this.emit({ t: 'text', x: p.x, y: p.y - 24, text: `망자 ${list.length} 소환 · 부하 ${this.minions.length}/10`, color: '#7ae8ff' });
        break;
      }
      case 'taunt': {
        const mine = this.allies.filter((a) => a.hp > 0);
        if (!mine.length) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '부하가 없다', color: '#a8b0c0' }); break; }
        for (const al of mine) { al.tauntT = op.dur; this.emit({ t: 'skillAoe', x: al.x, y: al.y, r: 40, elem: 'dark', fx: 'taunt' }); }
        for (const e of this.enemies) {
          if (e.dead || e.hidden || e.def.ai === 'dummy') continue;
          let best = null, bd = op.r;
          for (const al of mine) { const dd = Math.hypot(al.x - e.x, al.y - e.y); if (dd < bd) { bd = dd; best = al; } }
          if (!best && Math.hypot(e.x - p.x, e.y - p.y) < op.r) best = mine.reduce((a, b) => (Math.hypot(a.x - e.x, a.y - e.y) < Math.hypot(b.x - e.x, b.y - e.y) ? a : b));
          if (best) { e.taunt = best; e.tauntT = op.dur; this.aggro(e); this.emit({ t: 'tauntLink', x1: best.x, y1: best.y, x2: e.x, y2: e.y }); }
        }
        break;
      }
      case 'line': {
        const x1 = p.x, y1 = p.y, ax = p.aimX, ay = p.aimY;
        let len = op.len;
        const run = () => {
          const x2 = x1 + ax * len, y2 = y1 + ay * len;
          this.emit({ t: 'skillLine', x1, y1, x2, y2, w: op.w, elem: ctx.elem, fx: op.fx || ctx.def.fx, ult: ctx.def.ult });
          countHits(this.enemies.filter((e) => !e.dead && !e.hidden && distToSeg(e.x, e.y, x1, y1, x2, y2) < e.r + op.w / 2));
        };
        if (op.delay) this.delayed.push({ t: op.delay, run }); // 내 일직선 스킬은 예고선 없이 (땅이 갈라지는 것으로 보인다)
        else run();
        break;
      }
      case 'blastSummons': {
        let mine = this.allies.filter((a) => a.kind !== 'spirit' && a.kind !== 'spiritKing');
        if (op.n) mine = mine.sort((a, b) => (a.maxHp ? a.hp / a.maxHp : 1) - (b.maxHp ? b.hp / b.maxHp : 1)).slice(0, op.n);
        if (!mine.length) {
          const e = ctx.target && !ctx.target.dead ? ctx.target : this.nearestEnemy(160);
          if (!e) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '터뜨릴 대상이 없다', color: '#a8b0c0' }); break; }
          this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: op.r, elem: 'dark', fx: 'corpse' });
          for (const o of this.enemiesNear(e.x, e.y, op.r)) this.skillHit(o, { mul: op.mul * 0.8 }, ctx);
          break;
        }
        for (const a of mine) {
          a.t = 0;
          this.emit({ t: 'skillAoe', x: a.x, y: a.y, r: op.r, elem: 'dark', fx: 'corpse' });
          for (const o of this.enemiesNear(a.x, a.y, op.r)) { this.skillHit(o, { mul: op.mul * (a.kind === 'lich' ? 2 : 1) }, ctx); if (a.maxHp && !o.dead) this.damageEnemy(o, a.maxHp * 0.25, 'mag', { src: 'aoe', elem: 'dark' }); }
        }
        this.emit({ t: 'shake', v: 6 });
        break;
      }
      case 'rush': {
        // 대지 거수 돌격: 누르고 있는 동안 달린다 (updateSpecialMove 에서 진행)
        p.rush = { t: 0, dur: op.dur, speed: op.speed, mul: op.mul, ctx, slot: ctx.slot, hit: new Set() };
        this.emit({ t: 'rushStart', x: p.x, y: p.y });
        break;
      }
      case 'leap': {
        let tx, ty;
        if (ctx.auto && ctx.point) { tx = ctx.point.x; ty = ctx.point.y; }
        else if (ctx.auto && ctx.target) { tx = ctx.target.x; ty = ctx.target.y; }
        else { const ap = this.aimPoint(op.dist); tx = ap.x; ty = ap.y; }
        let vx = tx - p.x, vy = ty - p.y;
        const l = Math.hypot(vx, vy) || 1;
        let dist = Math.min(op.dist, l);
        vx /= l; vy /= l;
        while (dist > 0 && this.blocked(p.x + vx * dist, p.y + vy * dist, 5)) dist -= 6;
        p.leap = { t: 0, dur: op.air, x1: p.x, y1: p.y, x2: p.x + vx * Math.max(0, dist), y2: p.y + vy * Math.max(0, dist), op, ctx };
        this.motion('leap', op.air + 0.15);
        break;
      }
      case 'soar': {
        p.airT = op.dur; p.soar = { op, ctx, max: op.dur };
        p.invuln = Math.max(p.invuln, op.dur);
        this.emit({ t: 'soarUp', x: p.x, y: p.y });
        this.motion('soar', op.dur + 0.2);
        break;
      }
      case 'snatch': {
        const e = ctx.target && !ctx.target.dead && Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) < op.range + 30 ? ctx.target : this.nearestEnemy(op.range);
        if (!e) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        this.emit({ t: 'skillSingle', x: e.x, y: e.y, fx: 'claws', elem: ctx.elem });
        if (e.def.elite || e.champion || e.def.ai === 'dummy') { this.skillHit(e, { mul: op.mul * 0.6, stun: 0.5 }, ctx); break; }
        e.carried = op.dur; e.windT = 0;
        p.airT = op.dur; p.invuln = Math.max(p.invuln, op.dur);
        this.motion('soar', op.dur + 0.2);
        this.delayed.push({ t: op.dur, run: () => {
          p.airT = 0; e.carried = 0;
          if (e.dead) return;
          e.x = p.x + p.aimX * 10; e.y = p.y + p.aimY * 6;
          if (this.blocked(e.x, e.y, 4)) { e.x = p.x; e.y = p.y; }
          this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: op.r, elem: 'fire', fx: 'quake' });
          this.emit({ t: 'land', x: p.x, y: p.y, big: true });
          this.skillHit(e, { mul: op.mul, stun: 0.8 }, ctx);
          for (const o of this.enemiesNear(e.x, e.y, op.r)) if (o !== e) this.skillHit(o, { mul: op.mul * 0.5, stacks: 1 }, ctx);
        } });
        break;
      }
      case 'rewind': {
        const back = Math.round(op.sec * 10);
        const h = p.hist[Math.max(0, p.hist.length - 1 - back)];
        if (!h) break;
        const x1 = p.x, y1 = p.y;
        const pts = p.hist.slice(-back).map((q) => ({ x: q.x, y: q.y }));
        if (!this.blocked(h.x, h.y, 5)) { p.x = h.x; p.y = h.y; }
        const healed = Math.max(0, h.hp - p.hp);
        p.hp = Math.max(p.hp, Math.min(this.d.maxHp, h.hp));
        p.invuln = Math.max(p.invuln, 0.4);
        this.emit({ t: 'rewind', x1, y1, x2: p.x, y2: p.y, pts });
        if (healed > 0) this.emit({ t: 'text', x: p.x, y: p.y - 22, text: `+${Math.round(healed)}`, color: '#b98aff' });
        break;
      }
      case 'provoke': {
        let n = 0;
        for (const e of this.enemies) {
          if (e.dead || e.hidden || e.def.ai === 'dummy' || Math.hypot(e.x - p.x, e.y - p.y) > op.r) continue;
          e.provokeT = op.dur; e.provokeBy = null; e.taunt = null; e.tauntT = 0; e.loseT = 0; e.lureT = 0; this.aggro(e); n++;
          this.emit({ t: 'tauntLink', x1: p.x, y1: p.y, x2: e.x, y2: e.y, color: '#ffd84a' });
        }
        this.emit({ t: 'skillAoe', x: p.x, y: p.y, r: op.r, fx: 'provoke' });
        if (!n) this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '주변에 적이 없다', color: '#a8b0c0' });
        break;
      }
      case 'link': {
        const c = ctx.auto && ctx.point ? ctx.point : ctx.auto && ctx.target ? { x: ctx.target.x, y: ctx.target.y } : this.aimPoint(200);
        const list = this.enemiesNear(c.x, c.y, op.r).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, op.n);
        if (list.length < 2) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '이을 적이 부족하다', color: '#a8b0c0' }); if (list[0]) this.applyStatus(list[0], 'curse', 2); break; }
        const id = this.linkSeq++;
        for (const e of list) { e.link = { id, t: op.dur, share: op.share }; this.applyStatus(e, 'curse', 1); }
        this.emit({ t: 'skillAoe', x: c.x, y: c.y, r: op.r * 0.6, elem: 'dark', fx: 'rune' });
        break;
      }
      case 'spread': {
        const src = this.enemies.filter((e) => !e.dead && e.st[op.what]);
        if (!src.length) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '저주받은 적이 없다', color: '#a8b0c0' }); break; }
        const snap = src.map((e) => [e, e.st[op.what].n]);
        for (const [e, n] of snap) {
          this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: op.r, elem: 'dark', fx: 'spread' });
          for (const o of this.enemiesNear(e.x, e.y, op.r)) {
            if (o === e) continue;
            this.emit({ t: 'tauntLink', x1: e.x, y1: e.y, x2: o.x, y2: o.y, color: '#c45cff' });
            this.applyStatus(o, op.what, n * 2);
            this.skillHit(o, { mul: op.mul * Math.min(6, n) * 0.3 }, ctx);
          }
          this.skillHit(e, { mul: op.mul * Math.min(6, n) * 0.3 }, ctx);
        }
        break;
      }
      case 'stealth': {
        p.stealthT = op.dur; p.invuln = Math.max(p.invuln, 0.3);
        for (const e of this.enemies) if (!e.dead && e.state === 'chase') { e.loseT = op.dur; e.windT = 0; }
        this.emit({ t: 'stealthOn', x: p.x, y: p.y });
        break;
      }
      case 'danceStrike': {
        const cand = this.enemiesNear(p.x, p.y, op.r).filter((e) => this.targetable(e));
        if (!cand.length) break;
        let e = cand[this.rng.int(0, cand.length - 1)];
        if (cand.length > 1 && e.id === p.lastDance) e = cand.find((o) => o.id !== p.lastDance);
        p.lastDance = e.id;
        // 적을 꿰뚫고 지나가는 자리 (적 너머로): 달려가 지나가면서 벤다
        const ang0 = Math.atan2(e.y - p.y, e.x - p.x) + this.rng.range(-0.5, 0.5), over = e.r + 14;
        let tx = e.x + Math.cos(ang0) * over, ty = e.y + Math.sin(ang0) * over;
        if (this.blocked(tx, ty, 5)) { tx = e.x - Math.cos(ang0) * over; ty = e.y - Math.sin(ang0) * over; if (this.blocked(tx, ty, 5)) { tx = e.x; ty = e.y; } }
        this.emit({ t: 'danceDash', x1: p.x, y1: p.y, x2: tx, y2: ty });
        p.dance = { x0: p.x, y0: p.y, x1: tx, y1: ty, t: 0, dur: 0.08, e, op, ctx, ang: ang0 }; // 그림자 춤: 한 번 스치는 데 0.08초
        this.faceTo(tx, ty);
        this.motion('stab', 0.3);
        break;
      }
      case 'bind': {
        if (p.spirits.length >= 3) { const old = p.spirits.shift(); this.emit({ t: 'spiritOut', x: p.x, y: p.y, elem: old.elem }); }
        p.spirits.push({ elem: op.elem, t: op.dur, max: op.dur, phase: this.rng.range(0, 6.28) });
        if (op.elem === 'forest') p.shield = Math.min(this.d.maxHp * 0.5, p.shield + this.d.maxHp * 0.06 * this.spiritCount('forest'));
        this.emit({ t: 'spiritIn', x: p.x, y: p.y, elem: op.elem, n: this.spiritCount(op.elem) });
        break;
      }
      case 'summonSpirit': this.summonFamiliar(op.dur, 0); break;
      case 'spiritEmpower': { if (!p.familiar) this.summonFamiliar(20, op.dur); else { p.familiar.emp = op.dur; this.emit({ t: 'spiritIn', x: p.familiar.x, y: p.familiar.y + 10, elem: p.familiar.elem, n: 3 }); } this.emit({ t: 'text', x: p.x, y: p.y - 30, text: '정령 강화!', color: SPIRIT_GRADES[SPIRITS[this.b.spirit.id].grade].color }); break; }
      case 'spiritGuard': { if (!p.familiar) this.summonFamiliar(20, 0); p.familiar.guard = op.dur; p.familiar.pushT = 0; this.emit({ t: 'buff', x: p.x, y: p.y, color: ELEM[SPIRIT_DMG_ELEM[p.familiar.elem]]?.color || '#9bffb0' }); break; }
      case 'spiritArrow': {
        const f = p.familiar, n = p.spirits.length;
        const cnt = (k) => this.spiritCount(k);
        const dom = f ? f.elem : ['fire', 'wind', 'forest'].reduce((a, b) => (cnt(b) > cnt(a) ? b : a));
        const elem = f ? SPIRIT_DMG_ELEM[f.elem] : dom === 'fire' ? 'fire' : dom === 'forest' ? 'poison' : null;
        const c2 = { ...ctx, elem, bonus: ctx.bonus * (f ? 1.5 * (1 + 0.1 * f.grade + 0.05 * (f.star - 1)) : 1 + op.per * Math.max(0, n - 1)) }; // 정령이 나와 있으면 그 속성 · 피해 +50%
        this.projs.push({ owner: 'p', x: p.x + p.aimX * 6, y: p.y - 4 + p.aimY * 6, vx: p.aimX * op.speed, vy: p.aimY * op.speed, life: op.range / op.speed, dmg: 0, type: 'mag', pierce: 99, hit: new Set(),
          color: (ELEM[elem] || ELEM[dom] || ELEM.wind).color, kind: 'skill', skind: 'spiritArrow', spiritElems: f ? [SPIRIT_DMG_ELEM[f.elem]] : p.spirits.map((q) => q.elem), big: true,
          skillHit: (e) => this.skillHit(e, { mul: op.mul, stacks: 2 }, c2) });
        this.emit({ t: 'shoot', type: 'mag', x: p.x, y: p.y });
        break;
      }
      case 'kingDescend': {
        const cnt = (k) => this.spiritCount(k);
        const cycle = ['fire', 'wind', 'forest'];
        const fe = p.familiar?.elem; // 함께하는 정령이 불 · 바람 · 숲이면 그 왕
        const dom = cycle.includes(fe) ? fe : p.spirits.length ? cycle.reduce((a, b) => (cnt(b) > cnt(a) ? b : a)) : cycle[(p.kingCycle = ((p.kingCycle ?? -1) + 1) % 3)];
        p.spirits = [0, 1, 2].map((i) => ({ elem: dom, t: op.dur, max: op.dur, phase: i * 2.1 }));
        p.kingT = op.dur;
        const elem = dom === 'fire' ? 'fire' : dom === 'wind' ? 'lightning' : 'poison';
        this.emit({ t: 'banner', text: `${ELEM[dom].name}의 정령왕 강림`, color: ELEM[dom].color });
        for (const a of this.allies) if (a.kind === 'spiritKing') a.t = 0;
        let kx = p.x + p.dir * 26, ky = p.y;
        if (this.blocked(kx, ky, 6)) kx = p.x;
        this.allies.push({ id: this.nextId++, kind: 'spiritKing', elem, spirit: dom, hp: 0, maxHp: 0, x: kx, y: ky, t: op.dur, max: op.dur,
          atk: ctx.atk * op.mul * (op.scaleRes ? ctx.resMul : 1) * ctx.bonus, cd: 0.6, phase: 0, dir: p.dir, punchT: 0 });
        this.emit({ t: 'summonFx', x: kx, y: ky - 24, kind: 'spiritKing', elem, big: true });
        break;
      }
      case 'shield': {
        p.shield = Math.min(this.d.maxHp * 0.6, p.shield + this.d.maxHp * op.v);
        this.emit({ t: 'buff', x: p.x, y: p.y, color: '#ffb066', bubble: true });
        break;
      }
      case 'fillWords': {
        while (p.words.length < 3) p.words.push(op.word);
        this.emit({ t: 'wordAdd', words: [...p.words] });
        this.sentence();
        break;
      }
      case 'orbit': {
        for (const al of this.allies) if (al.kind === 'orbitAxe') al.t = 0;
        for (let i = 0; i < op.n; i++) this.allies.push({ id: this.nextId++, kind: 'orbitAxe', x: p.x, y: p.y, t: op.dur, max: op.dur, phase: (i / op.n) * Math.PI * 2, r: op.r,
          atk: ctx.atk * op.mul * ctx.resMul * ctx.bonus, hitCd: {}, dir: 1, cd: 0 });
        break;
      }
      case 'silence': {
        const dur = op.dur * Math.min(2, ctx.resMul);
        let n = 0;
        for (const e of this.enemiesNear(p.x, p.y, op.r)) { if (e.def.ai === 'dummy') continue; e.silenceT = dur; e.windT = 0; e.fuse = 0; n++; }
        this.emit({ t: 'silence', x: p.x, y: p.y, r: op.r });
        if (!n) this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '주변에 적이 없다', color: '#a8b0c0' });
        break;
      }
      case 'hpToRes': {
        p.hp = Math.max(1, p.hp - this.d.maxHp * op.hp);
        this.addRes(op.gain);
        this.emit({ t: 'buff', x: p.x, y: p.y, color: '#e0445a' });
        break;
      }
    }
  },

  // 무기 스킬 (Q / 우클릭). 적중 시 각인 트리거가 그대로 발동한다
  useSkill() {
    const p = this.player, d = this.d, w = this.b.weapon;
    const wdef = SKILLS[w.skill];
    if (wdef?.weaponSkill) { // 이름 붙은 무기의 고유 기술: 스킬과 같은 방식으로 쓰고, 무기 위력만큼 세다
      if (wdef.mana && !this.payMana(wdef.mana)) { this.emit({ t: 'noMana', x: p.x, y: p.y }); p.skillCd = 0.3; return; }
      p.skillMax = wdef.cd * d.skillCdMul * (1 - d.cdr); p.skillCd = p.skillMax;
      this.execSkill(wdef, 0, w.skill, { weapon: true });
      return;
    }
    const sk = WEAPON_SKILLS[w.skill] || WEAPON_SKILLS.spin;
    if (sk.mana && !this.payMana(sk.mana)) { this.emit({ t: 'noMana', x: p.x, y: p.y }); p.skillCd = 0.3; return; }
    p.skillMax = sk.cd * d.skillCdMul * (1 - d.cdr); p.skillCd = p.skillMax;
    let type = w.dmg;
    if (type === 'phys' && this.f.has('physToMag')) type = 'mag';
    const atk = (type === 'phys' ? (w.scale === 'agi' ? d.dexAtk : d.physAtk) : d.magAtk) * (this.b.wScale?.dmg ?? 1); // 무기 스탯 계수
    const ang = Math.atan2(p.aimY, p.aimX);
    const aimX = p.x + p.aimX * Math.min(160, this.aimDist || 120), aimY = p.y + p.aimY * Math.min(160, this.aimDist || 120);
    const hitAll = (list, mul, dtype = type) => { for (const e of list) this.hitEnemy(e, atk * w.mul * mul, dtype, true, false, { weapon: true }); };
    this.emit({ t: 'skill', id: w.skill, x: p.x, y: p.y, ang, tx: aimX, ty: aimY });
    const WM = { slam: ['overhead', 0.5], dashStab: ['thrust', 0.3], whirl: ['spin', 1.2], volley: ['shoot', 0.35], rain: ['aim', 0.45], axeStorm: ['spin', 0.4], boomStorm: ['spin', 0.4], knifeFan: ['spin', 0.4], lash: ['lash', 0.7], flurry: ['flurry', 0.65], frostRing: ['castBig', 0.45], poisonPool: ['cast', 0.35], meteor: ['castBig', 0.6], nova: ['castBig', 0.45] }[w.skill] || ['spin', 0.38];
    this.motion(WM[0], WM[1]);
    switch (w.skill) {
      case 'slam': {
        const cx = p.x + Math.cos(ang) * 26, cy = p.y + Math.sin(ang) * 26;
        p.windupT = 0.2;
        this.delayed.push({ t: 0.2, run: () => {
          p.windupT = 0;
          this.emit({ t: 'slam', x: cx, y: cy, r: 58 });
          this.emit({ t: 'hitstop', v: 0.1 });
          for (const e of this.enemiesNear(cx, cy, 58)) { this.hitEnemy(e, atk * w.mul * 2.2, type, true, false, { weapon: true }); if (!e.def.elite) { e.windT = 0; e.atkCd = Math.max(e.atkCd, 1.2); } }
        } });
        break;
      }
      case 'dashStab': {
        const len = 90, ex = p.x + Math.cos(ang) * len, ey = p.y + Math.sin(ang) * len;
        p.dashT = 0.2; p.dvx = Math.cos(ang) * len / 0.2; p.dvy = Math.sin(ang) * len / 0.2; p.invuln = Math.max(p.invuln, 0.3);
        this.emit({ t: 'afterimage', x1: p.x, y1: p.y, x2: ex, y2: ey });
        for (const e of this.enemies) if (!e.dead && distToSeg(e.x, e.y, p.x, p.y, ex, ey) < e.r + 12) this.hitEnemy(e, atk * w.mul * 1.9, type, true, false, { weapon: true });
        if (this.f.has('dashCrit')) p.dashCritReady = true;
        break;
      }
      case 'whirl': p.whirlT = 1.2; p.whirlTick = 0; break;
      case 'volley': {
        const sp = w.projSpeed * d.projMul * 1.3;
        for (let i = -2; i <= 2; i++) {
          const a = ang + i * 0.14;
          this.projs.push({ owner: 'p', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (w.range * 1.4 * d.projMul) / sp, dmg: atk * w.mul * 1.1, type, pierce: 3, hit: new Set(), color: '#ffe8a0', kind: 'arrow', ox: p.x, oy: p.y, weaponHit: true });
        }
        break;
      }
      case 'rain': {
        for (let i = 0; i < 6; i++) this.delayed.push({ t: 0.25 + i * 0.22, kind: 'aoe', x: aimX, y: aimY, r: 50, dmg: atk * w.mul * 0.75, type, fx: 'rain' });
        break;
      }
      case 'axeStorm': case 'boomStorm': {
        const n = w.skill === 'boomStorm' ? 6 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, sp = 200;
          this.projs.push({ owner: 'p', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9, maxLife: 0.9, dmg: atk * w.mul * 0.85, type, pierce: 99, hit: new Set(), color: '#e8e2cf', kind: w.skill === 'boomStorm' ? 'boomerang' : 'axe', boomerang: true, ox: p.x, oy: p.y, weaponHit: true });
        }
        break;
      }
      case 'knifeFan': {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + ang, sp = 360;
          this.projs.push({ owner: 'p', x: p.x, y: p.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, maxLife: 0.5, dmg: atk * w.mul * 1.6, type, pierce: 1, hit: new Set(), color: '#e8eef4', kind: 'knife', ox: p.x, oy: p.y, weaponHit: true });
        }
        break;
      }
      case 'lash': { // 앞쪽을 세 번 휘갈기고, 마지막에 맞은 적을 끌어온다
        for (let k = 0; k < 3; k++) this.delayed.push({ t: 0.08 + k * 0.2, run: () => {
          const a = Math.atan2(p.aimY, p.aimX), last = k === 2;
          this.emit({ t: 'swing', x: p.x, y: p.y, ang: a, range: w.range, arc: 1.3, type, dir: k % 2 ? -1 : 1, dur: 0.16, whip: true, wide: true, enchant: p.buffs.enchant?.elem });
          for (const e of this.enemies) {
            if (e.dead || e.hidden) continue;
            const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
            if (dist > w.range + e.r) continue;
            let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
            if (Math.abs(da) > 0.7) continue;
            this.hitEnemy(e, atk * w.mul * (last ? 1.4 : 0.9), type, last, false, { weapon: true });
            if (last && !e.def.elite && !e.dead) { const l = dist || 1; e.kbx -= (dx / l) * Math.min(300, l * 7); e.kby -= (dy / l) * Math.min(300, l * 7); this.stunE(e, 0.5); }
          }
        } });
        break;
      }
      case 'flurry': { // 주먹 여섯 번, 마지막은 날려 보낸다
        for (let k = 0; k < 6; k++) this.delayed.push({ t: 0.05 + k * 0.1, run: () => {
          const a = Math.atan2(p.aimY, p.aimX), last = k === 5;
          p.swingDir = k % 2 ? 1 : -1; p.swingMax = 0.1; p.swingT = 0.1; p.swingAng = a;
          this.emit({ t: 'swing', x: p.x, y: p.y, ang: a, range: w.range + 6, arc: 1.4, type, dir: p.swingDir, dur: 0.1, fist: true, heavy: last, enchant: p.buffs.enchant?.elem });
          for (const e of this.enemies) {
            if (e.dead || e.hidden) continue;
            const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
            if (dist > w.range + 6 + e.r) continue;
            let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
            if (Math.abs(da) > 0.8 && dist > e.r + 6) continue;
            this.hitEnemy(e, atk * w.mul * (last ? 2.2 : 0.8), type, last, false, { weapon: true });
            if (last && !e.def.elite && !e.dead) { const l = dist || 1; e.kbx += (dx / l) * 520; e.kby += (dy / l) * 520; }
          }
          if (last) this.emit({ t: 'hitstop', v: 0.06 });
        } });
        break;
      }
      case 'frostRing': {
        this.emit({ t: 'nova', x: p.x, y: p.y, r: 72, color: '#9fe3ff' });
        for (const e of this.enemiesNear(p.x, p.y, 72)) { this.hitEnemy(e, atk * w.mul * 0.9, 'mag', true); this.applyStatus(e, 'chill', 3); }
        break;
      }
      case 'poisonPool': {
        this.emit({ t: 'ring', x: aimX, y: aimY, r: 50, color: '#9be15d' });
        this.addCloud(aimX, aimY, 50 * (1 + d.cloudSize), (6 + (this.s.toxicity || 0) * 1.2 + d.magAtk * 0.45) * 1.4, 5, 'p');
        for (const e of this.enemiesNear(aimX, aimY, 50)) this.applyStatus(e, 'poison', 3);
        break;
      }
      case 'meteor': {
        this.emit({ t: 'telegraphCircle', x: aimX, y: aimY, r: 60, dur: 0.7 });
        this.delayed.push({ t: 0.7, kind: 'aoe', x: aimX, y: aimY, r: 60, dmg: atk * w.mul * 3.2, type: 'mag', fx: 'meteor', big: true });
        break;
      }
      case 'nova': {
        this.emit({ t: 'nova', x: p.x, y: p.y, r: 66 });
        this.emit({ t: 'hitstop', v: 0.05 });
        hitAll(this.enemiesNear(p.x, p.y, 66), 1.9, 'mag');
        break;
      }
      default: { // spin
        const r = w.range * 1.5 + 8;
        p.spinT = 0.3;
        this.emit({ t: 'spin', x: p.x, y: p.y, r, type });
        this.emit({ t: 'hitstop', v: 0.04 });
        hitAll(this.enemiesNear(p.x, p.y, r), 1.6);
      }
    }
  },

  castSkillId0(id, slot) {
    const p = this.player;
    if (p.riding) this.dismount();
    // 비상 중에 다시 누르면 바로 내리꽂는다
    if (id === 'soar' && p.airT > 0) { this.landSoar(); return; }
    if (p.castT > 0 || p.channel || p.charging || p.rush || p.leap || p.windupT > 0 || p.combo || p.fallInto || p.drop || p.hop) return;
    if (id === 'weapon') { if (p.skillCd <= 0) { this.breakStealth(); this.useSkill(); } return; }
    const def = SKILLS[id];
    if (!def || p.cds[id] > 0) return;
    const fit = handFit(def, this.b).fit;
    if (fit <= 0) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: def.name, text: (CANT_TEXT[def.kind] || '이 무기로는 쓸 수 없다') + (this.b.hands < 2 ? ' · 왼손 도구로도 쓸 수 있다' : '') }); p.cds[id] = 0.4; return; }    if (p.swim && !['dive', 'waterBreath'].includes(id)) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: def.name, text: '헤엄치는 중에는 쓸 수 없다' }); p.cds[id] = 0.3; return; }
    if (def.needSpirit && !p.spirits.length) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: '깃든 정령', text: '깃든 정령이 없다' }); p.cds[id] = 0.3; return; }
    if (def.do.some((o) => SPIRIT_OPS.has(o.op)) && !SPIRITS[this.b.spirit?.id]) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: def.name, text: '계약한 정령이 없다 · 세계수 성지의 「정령 계약」' }); p.cds[id] = 0.5; return; }
    let spent = 0;
    if (def.costAll) {
      if (p.res < def.costAll.min) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: this.raceRes?.name || '자원' }); p.cds[id] = 0.3; return; }
      spent = p.res; p.res = 0;
    } else if (def.cost) {
      const cost = def.cost * (this.d.costMul || 1); // 정신 70: 쓰는 자원 -30%
      if (p.res < cost && !this.bloodPay(cost - p.res)) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: this.raceRes?.name || '자원' }); p.cds[id] = 0.3; return; }
      p.res = Math.max(0, p.res - cost); spent = cost;
    }
    if (def.gain) this.addRes(def.gain);
    let cd = def.cd * this.d.skillCdMul * (1 - this.d.cdr) * skillScale(id, this.b).cd; // 스탯 70: 재사용 -20%
    if (id === 'breath' && p.buffs.dragonForm) cd = 0.3;
    if (this.practice?.noCd) cd = Math.min(cd, 0.25);
    p.cds[id] = cd; p.cdMax ||= {}; p.cdMax[id] = cd;
    p.lastFight = this.t;
    if (this.pvp) this.pvp.out.push({ t: 'dskill', id });
    if (def.kind === 'spell') this.knack('castSpell');
    if (id !== 'stealth') this.breakStealth();
    // 차지: 누르고 있는 동안 힘을 모은다 (떼면 발동)
    if (def.charge) {
      p.charging = { id, def, spent, slot, t: 0, lvl: 0 };
      this.motion(def.mo, 1.4, { charge: true });
      this.emit({ t: 'chargeStart', x: p.x, y: p.y });
      return;
    }
    if (def.cast) {
      const ct = def.cast * (this.d.castMul || 1);
      p.castT = ct; p.castMax = ct; p.castSkill = { def, spent, id };
      if (this.autoAim) { const tg0 = this.pickTarget(def); if (tg0 && tg0.kind !== 'none') this.faceTo(tg0.x, tg0.y); }
      this.motion(def.mo === 'castBig' ? 'castBigHold' : 'castHold', def.cast + 0.05);
      if (this.autoAim) { const tg = this.pickTarget(def); if (tg) this.emit({ t: 'lockOn', x: tg.x, y: tg.y, kind: tg.kind, dur: def.cast }); }
      this.emit({ t: 'cast', x: p.x, y: p.y, dur: def.cast, elem: def.elem === 'current' ? p.elem : def.elem });
      return;
    }
    this.execSkill(def, spent, id, { slot });
  },

  execSkill(def, spent, id, opt = {}) {
    if (!opt.weapon) { const ts = SKILL_TSTAT[id]; if (ts) for (const [k, v, dur] of ts) this.addTemp(k, v, dur, def.name); this.chainEvent('cast', null, this.player); }
    const p = this.player;
    const elem = def.elem === 'current' ? p.elem : def.elem;
    if (this.b.cls === 'elementalist' && ELEM_CYCLE.includes(elem)) p.elem = elem;
    let bonus = 1;
    const lvl = opt.charge || 0;
    if (def.charge) bonus *= [1, 1.35, 1.75, 2.2][lvl];
    if (p.elemBonusT > 0 && elem && elem !== 'phys') { bonus = 1.3; p.elemBonusT = 0; }
    // 힘 모으기: 다음 스킬 한 번이 강해진다
    if (p.buffs.charged && id !== 'chargeUp') { bonus *= p.buffs.charged.power || 2.5; p.buffs.charged.t = Math.min(p.buffs.charged.t, 0.05); }
    const boost = opt.weapon ? this.b.weapon.mul : this.weaponBoost(id), hf = opt.weapon ? { fit: 1, hand: 'main' } : handFit(def, this.b), fit = hf.fit, cross = opt.weapon ? 1 : crossMul(def, this.b); // 다른 종족 스킬: 능력치가 모자라면 85%
    const sc = opt.weapon ? this.b.wScale : skillScale(id, this.b); // 스탯 계수 (이 스킬 · 무기가 따라가는 스탯)
    const ctx = { def, id, spent, elem, bonus: bonus * boost * fit * cross * (SKILL_BAL[id] ?? 1) * (sc?.dmg ?? 1), // SKILL_BAL: 종족 스킬 밸런스 보정
      fit, hand: hf.hand, atk: this.skillAtk(def.scale), resMul: 1 + spent / 100, charge: lvl, slot: opt.slot };
    if (fit < 0.95 && fit > 0) this.emit({ t: 'text', x: p.x, y: p.y - 26, text: `무기가 맞지 않다 · 피해 ${Math.round(fit * 100)}%`, color: '#c8b8a0' });
    if (this.autoAim) {
      const tg = this.pickTarget(def);
      if (tg) {
        ctx.auto = true; ctx.target = tg.e; ctx.point = tg.e ? null : { x: tg.x, y: tg.y }; ctx.tp = tg.tp;
        this.faceTo(tg.x, tg.y);
        if (tg.kind !== 'none') this.emit({ t: 'lockOn', x: tg.x, y: tg.y, kind: tg.kind, ult: def.ult });
      }
    }
    this.emit({ t: 'skillFx', fx: def.fx, x: p.x, y: p.y, ang: Math.atan2(p.aimY, p.aimX), elem, name: def.name, ult: def.ult, role: def.role, charge: lvl });
    if (!def.charge && !def.cast) this.motion(def.mo, MOTION_DUR[def.mo] || 0.35);
    else if (def.charge || def.cast) this.motion(def.mo === 'castBig' ? 'castBigRelease' : def.mo === 'cast' ? 'castRelease' : def.mo, MOTION_DUR[def.mo] || 0.35, { charge: lvl });
    const fire = () => { for (const op of def.do) this.runOp(op, ctx); if (def.word) this.addWord(def.word); };
    const wu = !def.cast && !opt.now ? WINDUP[def.mo] || 0 : 0; // 차지 스킬도 휘두르는 동작이 지나간 뒤에 나간다
    if (wu > 0) { p.windupT = wu; this.delayed.push({ t: wu, run: () => { p.windupT = 0; fire(); } }); }
    else fire();
  },

  // 스킬 피해 한 번: 치명타·각인 트리거가 붙는다
  skillHit(e, op, ctx, mulExtra = 1) {
    if (!e || e.dead) return false;
    const p = this.player;
    let mul = (op.mul || 0) * ctx.bonus * mulExtra;
    if (op.scaleRes) mul *= ctx.resMul;
    if (op.bonusIf === 'marked' && e.st.elemMark > 0) mul *= 1.6;
    if (op.bonusIf === 'weak' && e.st.weak > 0) mul *= 2;
    if (op.bonusIf === 'prison' && e.st.stun > 0) mul *= 2;
    if (op.bonusIf === 'lowhp' && e.hp < e.maxHp * 0.3) mul *= 2;
    if (op.bonusIf === 'frozen' && (e.st.frozen > 0 || e.st.chill?.n >= 4)) { mul *= 2.5; this.emit({ t: 'shatter', x: e.x, y: e.y }); }
    if (op.bonusIf === 'burning' && e.st.burn) mul *= 1.5;
    if (op.backstab && Math.sign(p.x - e.x) !== e.dir) mul *= 1.5;
    const type = ctx.def.scale === 'mag' || (ctx.elem && ctx.elem !== 'phys') ? 'mag' : 'phys';
    if (mul > 0) this.hitEnemy(e, ctx.atk * mul, type, true, false, { elem: ctx.elem, pen: op.pen, skill: true });
    if (e.dead) return true;
    const status = ctx.elem && ELEM[ctx.elem]?.status;
    if (status && op.stacks) this.applyStatus(e, status, op.stacks);
    // 원소 폭주: 다음 속성까지 함께 남긴다
    if (p.buffs.surge && ELEM_CYCLE.includes(ctx.elem) && !e.dead) { const nx = ELEM_CYCLE[(ELEM_CYCLE.indexOf(ctx.elem) + 1) % 3]; this.applyStatus(e, ELEM[nx].status, Math.max(1, Math.ceil((op.stacks || 1) / 2))); }
    if (op.flee && !e.def.elite) { e.st.flee = Math.max(e.st.flee || 0, op.flee); e.windT = 0; }
    else if (op.flee) this.fearE(e, op.flee);
    if (op.retrib) e.st.retrib = Math.max(e.st.retrib || 0, op.retrib);
    if (op.lose && e.state === 'chase') { e.loseT = 4; e.windT = 0; }
    if (op.status) this.applyStatus(e, op.status, op.stacks || 1);
    if (op.extraStatus && !e.dead) this.applyStatus(e, op.extraStatus, 1);
    if (op.elemFire && !e.dead) this.applyStatus(e, 'burn', op.stacks || 1);
    if (op.doom && !e.dead) { e.doom = { atk: ctx.atk * ctx.resMul }; this.emit({ t: 'doomMark', id: e.id }); }
    if (op.root && !e.dead) { e.rooted = Math.max(e.rooted || 0, op.stun || 1.5); e.vineT0 = this.t; }
    if (op.stacksIfBurning && e.st.burn) this.applyStatus(e, 'burn', op.stacksIfBurning);
    if (op.stun && !e.def.elite) { this.stunE(e, op.stun); e.windT = 0; if (op.prison) e.prison = true; }
    else if (op.stun && e.def.elite) { this.stunE(e, op.stun * 0.35); if (op.prison) e.prison = true; }
    if (op.fear) this.fearE(e, op.fear);
    if (op.mark) e.st.elemMark = Math.max(e.st.elemMark || 0, op.mark);
    if (op.weak) e.st.weak = Math.max(e.st.weak || 0, op.weak);
    if (op.armorBreak) { e.armorBreak = Math.min(5, (e.armorBreak || 0) + op.armorBreak); e.armorBreakT = 6; }
    if (op.knock && !e.def.elite) {
      const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1;
      e.kbx += (dx / l) * op.knock * 2; e.kby += (dy / l) * op.knock * 2;
      if (this.b.cls === 'behemoth') { e.kbHot = op.launch ? 0.7 : 0.45; e.kbAtk = ctx.atk; }
    }
    if (op.pull) { e.reelT = 0.6; e.reelK = e.def.elite ? 0.85 : 1; /* 쇠사슬 · 작살: 내 바로 앞까지 */ e.reelX0 = e.x; e.reelY0 = e.y; e.kbx = 0; e.kby = 0; this.aggro(e); this.emit({ t: 'reel', id: e.id }); }
    return false;
  },

  doAction(a, target, pos) {
    const d = this.d, s = this.s;
    if (a.buff) { // 잠깐 강해진다 (무기 · 각인 효과)
      const p = this.player, B = a.buff, prev = p.buffs[B.id];
      p.buffs[B.id] = { t: B.dur, max: B.dur, mods: B.stack && prev ? Object.fromEntries(Object.entries(B.mods).map(([k, v]) => [k, Math.min(B.cap?.[k] ?? 9, (prev.mods[k] || 1) * v)])) : B.mods, color: B.color, name: B.name };
      if (B.name && !prev) this.emit({ t: 'text', x: p.x, y: p.y - 26, text: B.name, color: B.color || '#ffd27a' });
    }
    if (a.strike && pos) { // 내리치는 일격: 그 자리에 속성 폭발 (번개 · 불기둥 · 얼음 가시 …)
      const S = a.strike, base = (S.type === 'mag' ? d.magAtk : Math.max(d.physAtk, d.dexAtk || 0)) * S.mul;
      this.emit({ t: 'skillAoe', x: pos.x, y: pos.y, r: S.r, elem: S.elem, fx: S.fx || 'burst', lite: true, rar: S.rar ?? (this.b.weaponItem?.towerWeapon ? this.b.weaponItem.rarity : undefined) }); // 평타 · 맞음 · 처치로 저절로 터지는 효과: 연출은 작게 (우클릭 무기 스킬만 화려하게)
      for (const o of this.enemiesNear(pos.x, pos.y, S.r)) { this.damageEnemy(o, base, S.type || 'phys', { src: 'aoe', color: S.elem ? ELEM[S.elem]?.color : null }); if (S.status) this.applyStatus(o, S.status, S.stacks || 1); if (S.stun && !o.dead) this.stunE(o, o.def.elite ? S.stun * 0.35 : S.stun); if (!o.dead) this.chainEvent('hit', o, o); } // 일격에 맞은 적: 맞힘 효과가 다음 순간 다시 깨어난다 (연쇄)
    }
    if (a.status && target) this.applyStatus(target, a.status, a.stacks || 1);
    if (a.stun && target && !target.dead && target.def) this.stunE(target, target.def.elite || target.champion ? a.stun * 0.35 : a.stun); // 각인: 잠깐 기절
    if (a.fear && target && !target.dead && target.def) this.fearE(target, a.fear);
    if (a.heal) this.heal(d.maxHp * a.heal, 'skill');
    if (a.res) this.addRes(a.res);
    if (a.tstat) this.addTemp(a.tstat.stat, a.tstat.v, a.tstat.dur || 8, a.tstat.name);
    if (a.shield) this.chainEvent('shield', null, this.player);
    if (a.shield) { const p = this.player, k = this.climb ? 0.5 : 1; p.shield = Math.min(d.maxHp * (this.climb ? 0.25 : 0.4), p.shield + d.maxHp * a.shield * k); } // 탑: 각인 보호막 절반 · 최대 25%
    if (a.aoe) {
      const base = (a.aoe.type === 'phys' ? d.physAtk : d.magAtk) * a.aoe.mul;
      this.emit({ t: 'ring', x: pos.x, y: pos.y, r: a.aoe.r, color: a.aoe.status ? STATUS_COLOR[a.aoe.status] : '#ffffff' });
      for (const o of this.enemiesNear(pos.x, pos.y, a.aoe.r)) {
        this.damageEnemy(o, base, a.aoe.type, { src: 'aoe' });
        if (a.aoe.status) this.applyStatus(o, a.aoe.status, 1);
      }
    }
    if (a.cloud) this.addCloud(pos.x, pos.y, a.cloud.r * (1 + d.cloudSize), 4 + (s.toxicity || 0) * 0.8 + d.magAtk * 0.2, a.cloud.dur, 'p');
    if (a.shards) {
      const aimed = a.shards.dash && pos.dir != null; // 대시하며 던지는 단검: 대시한 쪽으로 부채꼴
      for (let i = 0; i < a.shards.n; i++) {
        const ang = aimed ? pos.dir + (i - (a.shards.n - 1) / 2) * 0.16 : this.rng.range(0, Math.PI * 2), spd = aimed ? 300 : 200;
        this.projs.push({ owner: 'p', x: pos.x, y: pos.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0.9, dmg: (a.shards.type === 'phys' ? d.physAtk : d.magAtk) * a.shards.mul, type: a.shards.type, kind: aimed ? 'knife' : undefined, pierce: 0, hit: new Set(), color: '#8ad8ff', homing: !aimed, noTrigger: true });
      }
    }
  },

  updateSpecialMove(inp, mx, my, ml) {
    const p = this.player, d = this.d;
    if (p.dance) { // 그림자 춤: 적을 스치며 지나간다 (지나가는 순간 벤다)
      const D = p.dance; D.t += DT;
      const k = Math.min(1, D.t / D.dur);
      p.x = D.x0 + (D.x1 - D.x0) * k; p.y = D.y0 + (D.y1 - D.y0) * k; p.invuln = Math.max(p.invuln, 0.15);
      if (!D.hit && k >= 0.55) { D.hit = true; if (!D.e.dead) { this.emit({ t: 'danceCut', x: D.e.x, y: D.e.y, ang: D.ang }); this.skillHit(D.e, D.op, D.ctx); } }
      if (k >= 1) { p.dance = null; if (!D.e.dead) this.faceTo(D.e.x, D.e.y); }
      return true;
    }
    if (p.combo) { // 연속베기: 한 바퀴마다 앞으로 한 걸음 나아가며 둘레를 벤다
      const C = p.combo, op = C.op;
      C.t -= DT;
      if (C.t <= 0) {
        if (C.i >= op.n) { p.combo = null; return false; }
        const last = C.i === op.n - 1, ux = Math.cos(C.ang), uy = Math.sin(C.ang);
        let step = op.step; while (step > 0 && this.blocked(p.x + ux * step, p.y + uy * step, 5)) step -= 4;
        p.dashT = 0.12; p.dvx = ux * step / 0.12; p.dvy = uy * step / 0.12;
        this.motion('spin', op.every + 0.05);
        this.emit({ t: 'spin', x: p.x + ux * step, y: p.y + uy * step, r: op.r, type: 'phys', ang: C.ang + C.i * 2.1, dir: C.i % 2 ? -1 : 1, heavy: last, follow: true });
        this.emit({ t: 'hitstop', v: last ? 0.06 : 0.025 });
        const cx = p.x + ux * step * 0.6, cy = p.y + uy * step * 0.6;
        for (const e of this.enemiesNear(cx, cy, op.r)) this.skillHit(e, { mul: last ? op.last : op.mul, knock: last ? op.knock * 1.8 : op.knock }, C.ctx);
        C.i++; C.t = op.every;
      }
      if (p.dashT > 0) { p.dashT -= DT; this.move(p, p.dvx * DT, p.dvy * DT); }
      return true;
    }
    if (p.fallInto) { // 구멍으로 뛰어든다: 가장자리로 한 번 뛰고, 작아지며 빨려 들어간다
      const F = p.fallInto; F.t += DT;
      const k = Math.min(1, F.t / F.dur), q = Math.min(1, k / 0.4), e = 1 - (1 - q) * (1 - q);
      p.x = F.x0 + (F.tx - F.x0) * e; p.y = F.y0 + (F.ty - F.y0) * e;
      p.air = k < 0.4 ? Math.sin(q * Math.PI) * 12 : 0;
      p.invuln = 1; p.moving = false;
      if (k >= 1 && !F.sent) { F.sent = true; this.signals.push({ t: 'enterZone', entrance: F.id, x: F.ox, y: F.oy }); }
      return true;
    }
    if (p.drop) { // 위에서 떨어져 내린다 (구멍 아래 · 천장에서)
      const D = p.drop; D.v += 900 * DT; D.h = Math.max(0, D.h - D.v * DT);
      p.air = D.h; p.invuln = Math.max(p.invuln, 0.3); p.moving = false;
      if (D.h <= 0) { p.drop = null; p.air = 0; p.landT = 0.32; this.emit({ t: 'thud', x: p.x, y: p.y, big: true }); }
      return true;
    }
    if (p.hop) { // 절벽에서 뛰어내린다: 살짝 뛰었다가 아래로 떨어져 착지
      const H = p.hop; H.t += DT;
      const k = Math.min(1, H.t / H.dur);
      p.x = H.x0 + (H.x1 - H.x0) * k; p.y = H.y0 + (H.y1 - H.y0) * (k * k * 0.65 + k * 0.35);
      p.air = Math.sin(k * Math.PI) * H.h;
      p.invuln = Math.max(p.invuln, 0.1);
      if (k >= 1) { p.hop = null; p.air = 0; p.landT = 0.22; this.emit({ t: 'thud', x: p.x, y: p.y }); }
      return true;
    }
    const lg = ml > 0 && !p.dashT && !p.charging && !p.rush && !p.leap && !(p.airT > 0) ? this.ledgeTarget(mx, my) : null;
    if (lg) {
      p.ledgeT = (p.ledgeT || 0) + DT;
      if (p.ledgeT > 0.14) { p.ledgeT = 0; p.hop = { t: 0, dur: 0.3 + 0.06 * lg.k, x0: p.x, y0: p.y, x1: lg.x, y1: lg.y, h: 9 + lg.k * 2 }; this.motion('leap', p.hop.dur); this.emit({ t: 'hopStart', x: p.x, y: p.y }); return true; }
    } else p.ledgeT = 0;
    if (p.charging) {
      const c = p.charging;
      c.t += DT;
      const lvl = Math.min(3, Math.floor(c.t / 0.4));
      if (lvl > c.lvl) { c.lvl = lvl; this.emit({ t: 'chargeLvl', x: p.x, y: p.y, lvl }); }
      const held = c.slot == null ? c.t < 0.8 : !!this.inpHold?.['h' + (c.slot + 1)];
      if (p.motion) p.motion.t = Math.min(p.motion.t, 0.2);
      if (!held || c.t >= 1.3) {
        p.charging = null;
        this.execSkill(c.def, c.spent, c.id, { charge: c.lvl, slot: c.slot });
      }
      return false; // 느리게 걷기는 일반 이동에서 처리
    }
    if (p.rush) {
      const r = p.rush;
      r.t += DT;
      const held = r.slot == null ? r.t < 1.2 : !!this.inpHold?.['h' + (r.slot + 1)];
      const dx = p.aimX, dy = p.aimY;
      const spd = r.speed * (0.7 + Math.min(1, r.t * 2) * 0.5);
      const bx = p.x, by = p.y;
      this.move(p, dx * spd * DT, dy * spd * DT);
      const stuck = Math.hypot(p.x - bx, p.y - by) < spd * DT * 0.3;
      p.walkT += DT * 2; p.moving = true;
      if (!this.motionIs('charge')) this.motion('charge', 9);
      // 앞의 적을 밀고 간다
      for (const e of this.enemiesNear(p.x + dx * 8, p.y + dy * 8, 12)) {
        if (e.def.ai === 'dummy') { if (!r.hit.has(e.id)) { r.hit.add(e.id); this.skillHit(e, { mul: r.mul }, r.ctx); } continue; }
        if (!r.hit.has(e.id)) { r.hit.add(e.id); this.skillHit(e, { mul: r.mul * (1 + r.t) }, r.ctx); }
        if (!e.def.elite) { e.kbx = dx * spd * 1.3; e.kby = dy * spd * 1.3; e.kbHot = 0.4; this.stunE(e, 0.2); }
      }
      if (Math.floor(r.t * 12) !== Math.floor((r.t - DT) * 12)) this.emit({ t: 'rushDust', x: p.x, y: p.y, dx, dy });
      if (!held || r.t >= r.dur || stuck) {
        p.rush = null;
        const cx = p.x + dx * 18, cy = p.y + dy * 18;
        this.emit({ t: 'skillAoe', x: cx, y: cy, r: 44, fx: 'quake' });
        this.emit({ t: 'shake', v: 4 + r.t * 3 });
        for (const e of this.enemiesNear(cx, cy, 44)) this.skillHit(e, { mul: r.mul * (1 + r.t * 1.5), knock: 280 }, r.ctx);
        p.motion = null; this.motion('headbutt', 0.3);
      }
      return true;
    }
    if (p.leap) {
      const L = p.leap;
      L.t += DT;
      const k = Math.min(1, L.t / L.dur);
      p.x = L.x1 + (L.x2 - L.x1) * k; p.y = L.y1 + (L.y2 - L.y1) * k;
      p.air = Math.sin(k * Math.PI) * 26;
      p.invuln = Math.max(p.invuln, 0.1);
      if (k >= 1) {
        p.leap = null; p.air = 0;
        const op = L.op;
        this.emit({ t: 'skillAoe', x: p.x, y: p.y, r: op.r, fx: 'slam' });
        this.emit({ t: 'land', x: p.x, y: p.y, big: true });
        for (const e of this.enemiesNear(p.x, p.y, op.r)) this.skillHit(e, op, L.ctx);
      }
      return true;
    }
    if (p.airT > 0) {
      p.airT -= DT;
      const sk = p.soar;
      const spd = d.moveSpeed * this.mod('moveSpeed') * 1.5;
      this.move(p, mx * spd * DT, my * spd * DT);
      p.moving = ml > 0; if (p.moving) p.walkT += DT;
      p.air = Math.min(30, (p.air || 0) + DT * 160);
      if (sk && p.airT <= 0) this.landSoar();
      return true;
    }
    if (p.air) p.air = Math.max(0, p.air - DT * 200);
    return false;
  },

};

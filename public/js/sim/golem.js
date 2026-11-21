// 이끼 골렘 (10층 주인 mossLord): 거리와 상황에 맞춰 기술을 고르고, 가끔 연계한다 (data/monsters.js mossLord.ownKit = 'golem')
//   가까이: 때리기 · 돌뿌리기 · 발구르기 / 가운데: 점프 · 돌뿌리기 / 멀리: 돌던지기 · 돌떨구기 · 돌진 · 점프
//   자가수복: 체력이 줄었을 때 내가 멀거나 기절해 있으면 — 5초 동안 회복, 그동안 체력 5%만큼 맞으면 끊기고 빈틈
//   연계 (가끔 · 연계 기술은 피해 ×1.3): 돌진에 벽까지 밀려 기절 → 50% 자가수복 / 점프 착지 → 돌뿌리기 / 발구르기에 기절 → 때리기 / 돌던지기 → 돌떨구기
// World.prototype 에 붙는다 (sim/world.js 끝). 메서드 안의 this 는 World
import { DT } from './world.js';

export const GOLEM = {
  near: 62, far: 150, gap: [1.2, 2.0], comboMul: 1.3, comboCd: 8,
  punch: { r: 50, arc: 1.2, k: 1.4, wind: 0.37, after: 0.2 },          // 때리기: 앞 반원 · 공격력 140% (준비 0.37초)
  throw: { wind: 0.65, fly: 0.75, r: 30, k: 1.3, cd: 5 },               // 돌던지기: 내 자리에 큰 돌 (포물선)
  meteor: { n: 5, wind: 0.8, fall: 1.0, gap: 0.22, r: 26, k: 1.1, cd: 9 }, // 돌떨구기: 하늘에서 돌 다섯 (첫 돌은 내 자리)
  charge: { wind: 0.8, run: 0.75, k: 1.4, cd: 9, stun: 1.2, push: 320 },  // 돌진: 맞으면 벽까지 밀려나고 벽에 부딪히면 1.2초 기절
  jump: { t: 0.9, r: 55, k: 1.5, push: 55, cd: 8 },                      // 점프: 내 자리로 · 착지 땅울림(둘레 55) · 밀려남
  scatter: { n: 12, nCombo: 20, speed: 170, k: 0.6, wind: 0.6, cd: 12 },  // 돌뿌리기: 사방으로 작은 돌
  stomp: { wind: 0.5, r: 70, k: 1.0, stun: 0.5, cd: 9 },                // 발구르기: 둘레 70 · 맞으면 0.5초 기절
  repair: { t: 5, heal: 0.15, cut: 0.05, cd: 25, below: 0.75, chance: 0.5 }, // 자가수복: 5초 동안 15% · 5% 맞으면 끊김
};
const G = GOLEM;

export const GolemMethods = {
  golemTimers(e) {
    const K = (e.gk ||= { cd: { throw: 1, meteor: 4, charge: 2, jump: 2, scatter: 2, stomp: 3, repair: 8 }, comboCd: 0, closeT: 0 });
    for (const k in K.cd) K.cd[k] -= DT;
    K.comboCd -= DT;
    // 걷다가 끼였나 (벽 모서리): 1.2초 넘으면 점프로 넘어온다
    if (!e.mv && !(e.windT > 0) && e.speedMul > 0.3 && Math.hypot(e.x - (K.lx ?? e.x + 1), e.y - (K.ly ?? e.y)) < 0.25 && Math.hypot(this.player.x - e.x, this.player.y - e.y) > G.near) K.stuckT = (K.stuckT || 0) + DT;
    else K.stuckT = Math.max(0, (K.stuckT || 0) - DT * 2);
    K.lx = e.x; K.ly = e.y;
    if (!e.mv) e.jumpH = 0; // 기술이 끊겼을 때 (얼음 · 기절) 몸을 바로 세운다
    this.golemAfter(e);
    return K;
  },
  golemGap(e) { const [a, b] = G.gap; e.mvCd = this.rng.range(a, b) / (e.enraged ? 1.3 : 1); },
  golemPick(e, p, dist) {
    const K = e.gk;
    if (e.windT > 0) return false;
    if (K.next) { const nx = K.next; K.next = null; return this.golemStart(e, p, nx, true); } // 연계: 앞 기술이 끝나자마자 이어서
    if ((e.mvCd ??= 1.2) > 0) { e.mvCd -= DT; return false; }
    if (K.stuckT > 1.2) { K.stuckT = 0; return this.golemStart(e, p, 'jump'); }
    if (dist > 320) return false;
    const can = (k) => K.cd[k] <= 0;
    // 자가수복: 체력이 줄었고 내가 멀거나 기절해 있을 때 (가끔)
    if (can('repair') && e.hp < e.maxHp * G.repair.below && (dist > 140 || this.player.ccT > 0) && this.rng.chance(G.repair.chance)) return this.golemStart(e, p, 'repair');
    const aim = Math.atan2(p.y - e.y, p.x - e.x), pool = [];
    if (dist < G.near) { pool.push('punch', 'punch', 'punch'); if (can('scatter')) pool.push('scatter'); if (can('stomp')) pool.push('stomp'); }
    else if (dist < G.far) { if (can('jump')) pool.push('jump'); if (can('scatter')) pool.push('scatter'); if (can('throw')) pool.push('throw', 'throw'); if (can('meteor')) pool.push('meteor'); }
    else {
      if (can('throw')) pool.push('throw', 'throw'); if (can('meteor')) pool.push('meteor', 'meteor'); if (can('jump')) pool.push('jump');
      if (can('charge') && this.bodyRay(e, aim, Math.min(dist, 260)) >= Math.min(dist, 260) - 6) pool.push('charge'); // 나까지 몸이 막히지 않을 때만
    }
    if (!pool.length) return false; // 걸어서 다가온다
    return this.golemStart(e, p, pool[this.rng.int(0, pool.length - 1)]);
  },
  // 연계를 걸지: 연계 쿨타임이 끝났고 확률을 넘으면 next에 넣는다
  golemCombo(e, k, chance) {
    const K = e.gk; if (K.comboCd > 0 || !this.rng.chance(chance)) return false;
    K.comboCd = G.comboCd; K.next = k; e.mvCd = 0; return true;
  },
  golemStart(e, p, k, combo = false) {
    const K = e.gk, aim = Math.atan2(p.y - e.y, p.x - e.x), mul = combo ? G.comboMul : 1;
    this.golemGap(e);
    switch (k) {
      case 'punch':
        e.mv = { k, own: 'golem', t: G.punch.wind + G.punch.after, ang: aim, mul }; e.windT = G.punch.wind; e.windMax = G.punch.wind; this.emit({ t: 'windup', id: e.id }); return true;
      case 'throw': { K.cd.throw = G.throw.cd;
        e.mv = { k, own: 'golem', t: G.throw.wind + 0.25, mul }; e.windT = G.throw.wind; e.windMax = G.throw.wind; return true; }
      case 'meteor': K.cd.meteor = G.meteor.cd;
        e.mv = { k, own: 'golem', t: G.meteor.wind + 0.35, mul, n: combo ? 3 : G.meteor.n }; e.windT = G.meteor.wind; e.windMax = G.meteor.wind; return true;
      case 'charge': { K.cd.charge = G.charge.cd;
        const run = Math.max(40, this.bodyRay(e, aim, 260));
        e.mv = { k, own: 'golem', t: G.charge.wind + G.charge.run, run: G.charge.run, ang: aim, dist: run, mul }; e.windT = G.charge.wind; e.windMax = G.charge.wind; this.mobPose(e, 'crouch', G.charge.wind);
        this.emit({ t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(aim) * (run + e.r), y2: e.y + Math.sin(aim) * (run + e.r), dur: G.charge.wind, color: '#ff3a3a', w: e.r * 2 }); return true; }
      case 'jump': { K.cd.jump = G.jump.cd;
        const q = this.chiefLanding(e);
        e.mv = { k, own: 'golem', t: G.jump.t, max: G.jump.t, x0: e.x, y0: e.y, tx: q.x, ty: q.y, mul };
        this.emit({ t: 'telegraphCircle', x: q.x, y: q.y, r: G.jump.r, dur: G.jump.t }); return true; }
      case 'scatter': K.cd.scatter = G.scatter.cd;
        e.mv = { k, own: 'golem', t: G.scatter.wind + 0.3, mul, n: combo ? G.scatter.nCombo : G.scatter.n }; e.windT = G.scatter.wind; e.windMax = G.scatter.wind; return true;
      case 'stomp': K.cd.stomp = G.stomp.cd;
        e.mv = { k, own: 'golem', t: G.stomp.wind + 0.35, mul }; e.windT = G.stomp.wind; e.windMax = G.stomp.wind; this.mobPose(e, 'rear', G.stomp.wind + 0.1);
        this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: G.stomp.r, dur: G.stomp.wind }); return true;
      case 'repair': K.cd.repair = G.repair.cd;
        e.mv = { k, own: 'golem', t: G.repair.t, taken: 0, fx: 0, h0: e.hp }; this.emit({ t: 'golemRepairStart', id: e.id }); return true;
    }
    return false;
  },
  golemTick(e, p, mv) {
    const def = e.def, K = e.gk;
    if (e.windT > 0) e.windT = Math.max(0, e.windT - DT);
    const hitAll = (test, hit) => { const prev = this.coTgt; for (const q of this.coTargets()) if (test(q)) { this.coTgt = q === this.player ? null : q; hit(q); } this.coTgt = prev; };
    const dmg = (k) => e.atk * k * (mv.mul || 1);
    switch (mv.k) {
      case 'punch': {
        if (!mv.done && mv.t <= G.punch.after) {
          mv.done = true; const fx = e.x + Math.cos(mv.ang) * 26, fy = e.y + Math.sin(mv.ang) * 18;
          hitAll((q) => { const dx = q.x - e.x, dy = q.y - e.y; let da = Math.atan2(dy, dx) - mv.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.hypot(dx, dy) < G.punch.r + (q.r || 5) && Math.abs(da) < G.punch.arc; },
            () => this.hurtPlayer(dmg(G.punch.k), def.type, e, { fromX: e.x, fromY: e.y }));
          this.emit({ t: 'golemPunch', x: fx, y: fy, ang: mv.ang }); this.emit({ t: 'shake', v: 4 });
        }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'throw': {
        if (!mv.done && mv.t <= 0.25) { // 머리 위로 든 돌을 내 자리로
          mv.done = true; const q = this.floorNear(p.x, p.y, 6) || { x: p.x, y: p.y }, fly = G.throw.fly, m = mv.mul || 1;
          this.emit({ t: 'golemThrow', x1: e.x + (e.dir || 1) * 6, y1: e.y - 30, x2: q.x, y2: q.y, dur: fly }); this.emit({ t: 'telegraphCircle', x: q.x, y: q.y, r: G.throw.r, dur: fly });
          this.delayed.push({ t: fly, run: () => { if (e.dead) return; this.enemyArea(e, q.x, q.y, G.throw.r, e.atk * G.throw.k * m, def.type, null); this.emit({ t: 'golemRockLand', x: q.x, y: q.y, r: G.throw.r }); this.emit({ t: 'shake', v: 3 }); } });
          if (!mv.mul || mv.mul === 1) this.golemCombo(e, 'meteor', 0.25); // 돌던지기 → 돌떨구기
        }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'meteor': {
        if (!mv.done && mv.t <= 0.35) {
          mv.done = true; const m = mv.mul || 1, M = G.meteor;
          for (let i = 0; i < mv.n; i++) {
            const tq = i === 0 || mv.n <= 3 ? { x: p.x, y: p.y } : this.floorNear(p.x + this.rng.range(-70, 70), p.y + this.rng.range(-55, 55), 6);
            if (!tq) continue; const q = { x: tq.x, y: tq.y }, dl = i * M.gap;
            this.delayed.push({ t: dl, run: () => { if (e.dead) return; if (mv.n <= 3) { q.x = this.player.x; q.y = this.player.y; } // 연계: 셋 모두 그때의 내 자리
              this.emit({ t: 'telegraphCircle', x: q.x, y: q.y, r: M.r, dur: M.fall }); this.emit({ t: 'golemMeteor', x: q.x, y: q.y, r: M.r, dur: M.fall });
              this.delayed.push({ t: M.fall, run: () => { if (e.dead) return; this.enemyArea(e, q.x, q.y, M.r, e.atk * M.k * m, def.type, null); this.emit({ t: 'golemMeteorHit', x: q.x, y: q.y, r: M.r }); this.emit({ t: 'shake', v: 4 }); } }); } });
          }
          this.emit({ t: 'golemRoar', id: e.id, x: e.x, y: e.y });
        }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'charge': {
        if (mv.t > mv.run) return true; // 예고
        e.windT = 0;
        const u = 1 - mv.t / mv.run, ease = Math.max(0.25, Math.min(1, u / 0.2, (1 - u) / 0.25));
        const sp = (mv.dist / (mv.run * 0.775)) * ease * DT, nx = e.x + Math.cos(mv.ang) * sp, ny = e.y + Math.sin(mv.ang) * sp;
        if (this.blocked(nx, ny, e.r)) { mv.t = 0; this.emit({ t: 'collide', x: e.x + Math.cos(mv.ang) * e.r, y: e.y + Math.sin(mv.ang) * e.r, wall: true }); }
        else { e.x = nx; e.y = ny; e.moving = true; if ((mv.dt = (mv.dt || 0) - DT) <= 0) { mv.dt = 0.05; this.emit({ t: 'golemDust', x: e.x - Math.cos(mv.ang) * e.r, y: e.y, ang: mv.ang }); } }
        if (!mv.hit && Math.hypot(p.x - e.x, p.y - e.y) < e.r + (p.r || 5) + 4) { // 들이받았다: 벽까지 밀려나고 벽에 부딪히면 기절
          mv.hit = true; this.hurtPlayer(dmg(G.charge.k), def.type, e, { fromX: e.x, fromY: e.y });
          if (this.hurtLanded) { const L = this.rayLen(p.x, p.y, mv.ang, G.charge.push); this.knockPlayer(e.x, e.y, Math.min(G.charge.push, L + 14), { ang: mv.ang, wallStun: L < G.charge.push ? G.charge.stun : 0 }); mv.pushed = true; }
          this.emit({ t: 'golemImpact', x: (e.x + p.x) / 2, y: (e.y + p.y) / 2 - 6 }); this.emit({ t: 'shake', v: 5 });
        }
        if (mv.t > 0) return true;
        e.mv = null;
        if (mv.pushed) { mv.wait = true; e.gk.chargeCheck = 0.45; } // 밀려난 뒤 벽에 부딪혔는지 잠깐 뒤에 본다
        return true;
      }
      case 'jump': {
        const k = 1 - Math.max(0, mv.t) / mv.max, a = Math.max(0, (k - 0.25) / 0.75), ea = a * a * (3 - 2 * a);
        if (k >= 0.25) { e.x = mv.x0 + (mv.tx - mv.x0) * ea; e.y = mv.y0 + (mv.ty - mv.y0) * ea; e.moving = true; }
        e.jumpH = k < 0.25 ? 0 : Math.sin(a * Math.PI) * 46;
        if (mv.t > 0) return true;
        e.jumpH = 0; e.x = mv.tx; e.y = mv.ty;
        hitAll((q) => Math.hypot(q.x - e.x, q.y - e.y) < G.jump.r + (q.r || 5), (q) => { this.hurtPlayer(dmg(G.jump.k), def.type, e, { fromX: e.x, fromY: e.y }); if (q === this.player && this.hurtLanded) this.knockPlayer(e.x, e.y, G.jump.push); });
        this.emit({ t: 'golemLand', x: e.x, y: e.y, r: G.jump.r }); this.emit({ t: 'shake', v: 7 }); this.emit({ t: 'hitstop', v: 0.06, id: e.id });
        e.mv = null;
        if (!mv.mul || mv.mul === 1) this.golemCombo(e, 'scatter', 0.35); // 점프 → 돌뿌리기
        return true;
      }
      case 'scatter': {
        if (!mv.done && mv.t <= 0.3) {
          mv.done = true; const n = mv.n, off = this.rng.range(0, Math.PI * 2);
          for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2, sp = G.scatter.speed * (n > G.scatter.n && i % 2 ? 0.7 : 1);
            this.projs.push({ owner: 'e', src: e, x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.3, dmg: dmg(G.scatter.k), type: def.type, skind: 'pebble', hitFx: 'pebbleHit', spin: this.rng.range(0, 6), color: '#a89880' }); }
          this.emit({ t: 'golemSlam', x: e.x, y: e.y, r: 40 }); this.emit({ t: 'shake', v: 5 });
        }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'stomp': {
        if (!mv.done && e.windT <= 0) { // 발을 굴렀다: 둘레를 치고 맞으면 0.5초 기절
          mv.done = true;
          hitAll((q) => Math.hypot(q.x - e.x, q.y - e.y) < G.stomp.r + (q.r || 5), (q) => { this.hurtPlayer(dmg(G.stomp.k), def.type, e, { fromX: e.x, fromY: e.y }); if (q === this.player && this.hurtLanded) { this.ccPlayer({ stun: G.stomp.stun }); mv.stunned = true; } });
          this.emit({ t: 'golemLand', x: e.x, y: e.y, r: G.stomp.r }); this.emit({ t: 'shake', v: 6 }); this.emit({ t: 'hitstop', v: 0.06, id: e.id });
        }
        if (mv.t > 0) return true;
        e.mv = null;
        if (mv.stunned && (!mv.mul || mv.mul === 1)) this.golemCombo(e, 'punch', 0.6); // 발구르기에 기절 → 때리기
        return true;
      }
      case 'repair': {
        const R = G.repair;
        if (mv.taken >= e.maxHp * R.cut) { this.emit({ t: 'golemRepairBreak', x: e.x, y: e.y }); this.exposeBoss(e, 2.5, 1.5, '수복이 끊겼다'); return false; }
        const h0 = e.hp; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * R.heal / R.t * DT);
        if ((mv.fx -= DT) <= 0) { mv.fx = 0.25; this.emit({ t: 'golemRepair', id: e.id, x: e.x, y: e.y }); }
        mv.healed = (mv.healed || 0) + e.hp - h0;
        if (mv.t > 0) return true;
        this.emit({ t: 'bossHeal', id: e.id, x: e.x, y: e.y, from: mv.h0 / e.maxHp, to: e.hp / e.maxHp, big: true });
        e.mv = null; return false;
      }
    }
    e.mv = null; return false;
  },
  // 돌진에 밀려난 뒤: 벽에 부딪혀 기절했으면 50% 자가수복 연계
  golemAfter(e) {
    const K = e.gk; if (!(K?.chargeCheck > 0)) return;
    if ((K.chargeCheck -= DT) > 0) return;
    K.chargeCheck = 0;
    if (this.player.ccT > 0 && e.hp < e.maxHp) this.golemCombo(e, 'repair', 0.5);
  },
};

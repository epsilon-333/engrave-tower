// World — 독창 스킬 실행 (data/origskills.js · runOp 'orig' → origOp). 메서드 안의 this 는 World
// 각인 하나에 실행 종류(k) 하나: 있는 그림 재료(skillAoe · skillCone · bolt · blink · afterimage · danceCut · inkBind · zone …)를 조합해 동작마다 다르게
// 피해는 언제나 skillHit(치명타 · 표식 · 각인 연쇄가 붙는다) · 바닥 효과는 groundPoint로 땅에만 · 뒤에 이어지는 일은 delayed(등급이 붙는다)
import { ELEM } from '../data/skills.js';
import { distToSeg } from './world.js';

const AT = (e) => e && !e.dead && !e.hidden;
const STATUS_KINDS = ['bleed', 'poison', 'burn', 'chill', 'shock', 'curse', 'stun', 'weak', 'slowZ', 'frozen'];

export const OrigMethods = {
  origOp(op, ctx) {
    const W = this, p = this.player, ang = Math.atan2(p.aimY, p.aimX), el = ctx.elem, col = ELEM[el]?.color || '#e8e0f4';
    const H = (e, mul, x = {}) => AT(e) && W.skillHit(e, { mul, ...x }, ctx);
    const tier = this._tier;
    const later = (t, fn) => W.delayed.push({ t, tier, run: fn });
    const every = (dt, n, fn, end) => { let i = 0; const go = () => { if (W.state && W.state !== 'play' && W.state !== 'dead') return; if (fn(i) === false) { end?.(); return; } i++; if (i < n) later(dt, go); else end?.(); }; later(dt, go); };
    const AOE = (x, y, r, fx, extra = {}) => W.emit({ t: 'skillAoe', x, y, r, elem: el, fx: fx || ctx.def.fx, ...extra });
    const near = (x, y, r, skip) => { let b = null, bd = r; for (const e of W.enemies) { if (!AT(e) || skip?.has(e.id)) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; b = e; } } return b; };
    const tgt = (r) => (AT(ctx.target) && Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) < r + 30 ? ctx.target : near(p.x, p.y, r));
    const aimAt = (r) => { const c = ctx.auto && AT(ctx.target) ? { x: ctx.target.x, y: ctx.target.y } : ctx.auto && ctx.point ? { ...ctx.point } : W.aimPoint(r); const d = Math.hypot(c.x - p.x, c.y - p.y); if (d > r) { c.x = p.x + (c.x - p.x) * r / d; c.y = p.y + (c.y - p.y) * r / d; } return W.groundPoint(c.x, c.y); };
    const pullTo = (e, x, y, k = 1) => { if (!AT(e)) return; const dx = x - e.x, dy = y - e.y, l = Math.hypot(dx, dy) || 1, m = (e.def.elite ? 0.4 : 1) * k; e.kbx += (dx / l) * Math.min(320, l * 7) * m; e.kby += (dy / l) * Math.min(320, l * 7) * m; };
    const knock = (e, x, y, f) => { if (!AT(e) || e.def.elite) return; const dx = e.x - x, dy = e.y - y, l = Math.hypot(dx, dy) || 1; e.kbx += (dx / l) * f * 2; e.kby += (dy / l) * f * 2; };
    const stun = (e, t) => { if (AT(e)) { W.stunE(e, e.def.elite ? t * 0.35 : t); e.windT = 0; } };
    const reel = (e) => { if (!AT(e)) return; e.reelT = 0.6; e.reelK = e.def.elite ? 0.85 : 1; e.reelX0 = e.x; e.reelY0 = e.y; e.kbx = 0; e.kby = 0; W.aggro(e); W.emit({ t: 'reel', id: e.id }); };
    const segHits = (x1, y1, x2, y2, w) => W.enemies.filter((e) => AT(e) && distToSeg(e.x, e.y, x1, y1, x2, y2) < e.r + w);
    const moveTo = (x, y) => { if (!W.blocked(x, y, 5)) { p.x = x; p.y = y; return true; } return false; };
    const rayEnd = (a, len) => { const L = W.rayLen(p.x, p.y, a, len); return { x: p.x + Math.cos(a) * L, y: p.y + Math.sin(a) * L, L }; };
    const shoot = (x, y, a, speed, range, skind, onHit, o = {}) => W.projs.push({ owner: 'p', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: range / speed, maxLife: range / speed, dmg: 0, type: 'mag', pierce: o.pierce || 0, hit: new Set(o.skip || []), splash: 0,
      color: o.color || col, kind: 'skill', skind, elem: el, big: true, rot: a, ox: x, oy: y, skillHit: (e, pr) => onHit(e, pr) });
    const zone = (kind, x, y, r, t, atk = ctx.atk * ctx.bonus * 0.3) => { const c = W.groundPoint(x, y); const z = { kind, x: c.x, y: c.y, r, t, max: t, tick: 0, atk }; W.zones.push(z); W.emit({ t: 'zoneFx', x: c.x, y: c.y, r, kind }); return z; };
    const dash = (dist, o = {}) => W.runOp({ op: 'dash', dist, mul: 0, ...o }, ctx);

    switch (op.k) {
      case 'stickyGlob': { // 붙었다 1.5초 뒤 끌어모으며 터진다
        shoot(p.x, p.y - 4, ang, 220, 160, 'plague', (e) => {
          H(e, op.mul);
          W.emit({ t: 'inkBind', x: e.x, y: e.y, r: e.r, dur: 1.5 });
          later(1.5, () => { const x = e.dead ? e.x : e.x, y = e.y; for (const o of W.enemiesNear(x, y, op.r)) if (o !== e) pullTo(o, x, y); later(0.15, () => { AOE(x, y, 40, 'splash'); for (const o of W.enemiesNear(x, y, 40)) { H(o, op.mul2); o.st.slowZ = Math.max(o.st.slowZ || 0, 2); } }); });
        });
        break;
      }
      case 'rollBack': { // 굴러가 치고 되굴러 온다
        p.buffs.oRoll = { t: 1.2, max: 1.2, mods: { dmgTakenMul: 0.7 }, name: '등껍질', color: '#c8b088' };
        W.emit({ t: 'spin', x: p.x, y: p.y, r: 22 });
        dash(op.dist, { mul: op.mul });
        later(0.35, () => { p.aimX = -p.aimX; p.aimY = -p.aimY; dash(op.dist, { mul: op.mul }); p.aimX = -p.aimX; p.aimY = -p.aimY; W.emit({ t: 'spin', x: p.x, y: p.y, r: 22 }); });
        break;
      }
      case 'spineShell': { // 막는 동안 맞은 횟수만큼 가시
        const g = (p.origGuard = { k: 0.6, acc: 0, n: 0, until: W.t + op.dur });
        W.emit({ t: 'parryStance', x: p.x, y: p.y, dur: op.dur });
        later(op.dur, () => {
          if (p.origGuard === g) p.origGuard = null;
          const n = Math.min(12, 4 + g.n * 2);
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; shoot(p.x, p.y - 4, a, 240, 110, 'icerock', (e) => H(e, op.mul), { color: '#f0a890' }); }
          W.emit({ t: 'text', x: p.x, y: p.y - 24, text: `가시 ×${n}`, color: '#f0a890' });
        });
        break;
      }
      case 'bounce3': { // 세 번 튀어 가며 내려찍기
        const steps = [40, 75, 100];
        p.invuln = Math.max(p.invuln, 0.8);
        steps.forEach((d, i) => later(0.22 * (i + 1), () => {
          const e = rayEnd(ang, d); const x1 = p.x, y1 = p.y;
          if (moveTo(e.x, e.y)) W.emit({ t: 'afterimage', x1, y1, x2: p.x, y2: p.y });
          W.emit({ t: 'land', x: p.x, y: p.y, big: i === 0 });
          for (const o of W.enemiesNear(p.x, p.y, op.rs[i])) H(o, op.muls[i]);
        }));
        break;
      }
      case 'absorbWave': { // 막은 만큼 되돌리는 파동
        const g = (p.origGuard = { k: 0.3, acc: 0, n: 0, until: W.t + op.dur });
        W.emit({ t: 'parryStance', x: p.x, y: p.y, dur: op.dur });
        later(op.dur, () => {
          if (p.origGuard === g) p.origGuard = null;
          const extra = Math.min(3, (g.acc * 3) / Math.max(1, ctx.atk * ctx.bonus));
          const a = Math.atan2(p.aimY, p.aimX);
          W.emit({ t: 'skillCone', x: p.x, y: p.y, ang: a, range: 90, angle: 1.6, elem: el, fx: 'wave' });
          for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y, dd = Math.hypot(dx, dy); let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (dd < 90 + e.r && (Math.abs(da) < 0.8 || dd < e.r + 8)) { H(e, op.mul + extra); knock(e, p.x, p.y, 40); } }
          if (extra > 0.05) W.emit({ t: 'text', x: p.x, y: p.y - 24, text: `되돌림 +${Math.round(extra * 100)}%`, color: '#ffe8a0' });
        });
        break;
      }
      case 'sandStab': { // 모래 → 등 뒤 찌르기
        W.emit({ t: 'skillCone', x: p.x, y: p.y, ang, range: 50, angle: 1.6, elem: el, fx: 'smoke' });
        for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y; let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.hypot(dx, dy) < 50 + e.r && Math.abs(da) < 0.8) { H(e, op.mul); stun(e, 0.6); } }
        later(0.15, () => { W.runOp({ op: 'behind', range: 90 }, ctx); const t = tgt(90); if (t && Math.hypot(t.x - p.x, t.y - p.y) < 40) { W.emit({ t: 'skillSingle', x: t.x, y: t.y, fx: 'stab', elem: el }); H(t, op.mul2, { backstab: true }); } });
        break;
      }
      case 'packBite': { // 둘레 적 수만큼 물기
        const t = tgt(60); if (!t) { W.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.meleeStep(ctx, 40, t);
        const n = Math.min(6, 1 + W.enemiesNear(p.x, p.y, 90).filter((e) => e !== t).length);
        let i = 0; const bite = () => { if (!AT(t)) return; W.emit({ t: 'skillSingle', x: t.x, y: t.y, fx: 'bite', elem: el }); H(t, op.mul, { status: 'bleed', stacks: 1 }); if (++i < n) later(0.12, bite); };
        bite(); if (n > 1) W.emit({ t: 'text', x: t.x, y: t.y - 22, text: `무리 ×${n}`, color: '#e0445a' });
        break;
      }
      case 'sawOrbit': { // 톱날 셋 · 맞힌 횟수만큼 다음 스킬 강화
        const S = { hits: 0 };
        for (const al of W.allies) if (al.kind === 'orbitAxe' && al.orig) al.t = 0;
        for (let i = 0; i < 3; i++) W.allies.push({ id: W.nextId++, kind: 'orbitAxe', orig: true, x: p.x, y: p.y, t: op.dur, max: op.dur, phase: (i / 3) * Math.PI * 2, r: 34, atk: 0, hitCd: {}, dir: 1, cd: 0, onHit: (e) => { S.hits++; H(e, op.mul); } });
        later(op.dur, () => { if (!S.hits) return; const mul = 1 + Math.min(0.6, 0.06 * S.hits); p.origNext = { mul, until: W.t + 6, from: ctx.id }; W.emit({ t: 'text', x: p.x, y: p.y - 26, text: `다음 스킬 +${Math.round((mul - 1) * 100)}%`, color: '#ffd27a' }); });
        break;
      }
      case 'returnSlash': { // 표식 → 물러남 → 표식으로 되돌아가며 베기
        const mx = p.x, my = p.y;
        W.emit({ t: 'echoMark', x: mx, y: my, dur: 0.9, r: 12 });
        W.runOp({ op: 'cone', range: 42, angle: 1.6, mul: op.mul, fx: 'claws' }, ctx);
        later(0.08, () => dash(-70));
        later(0.9, () => { const x1 = p.x, y1 = p.y; if (W.blocked(mx, my, 5)) return; p.x = mx; p.y = my; p.invuln = Math.max(p.invuln, 0.2); W.emit({ t: 'danceDash', x1, y1, x2: mx, y2: my }); for (const e of segHits(x1, y1, mx, my, 14)) { H(e, op.mul2); W.emit({ t: 'danceCut', x: e.x, y: e.y, ang: Math.atan2(my - y1, mx - x1) }); } });
        break;
      }
      case 'tongue': { // 처음 닿은 적을 끌어와 문다
        const e2 = rayEnd(ang, op.range);
        const list = segHits(p.x, p.y, e2.x, e2.y, 8).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        const t = list[0];
        W.emit({ t: 'bolt', pts: [{ x: p.x, y: p.y - 6 }, t ? { x: t.x, y: t.y - 6 } : { x: e2.x, y: e2.y - 6 }], color: '#e07a9a' });
        if (!t) break;
        H(t, op.mul, { status: 'poison', stacks: 2 }); reel(t);
        later(0.3, () => { if (AT(t)) { W.emit({ t: 'skillSingle', x: t.x, y: t.y, fx: 'bite', elem: el }); H(t, op.mul2); } });
        break;
      }
      case 'sporeMines': { // 다가오면 터지는 버섯 셋
        const c = aimAt(120), nx = -p.aimY, ny = p.aimX;
        for (let i = -1; i <= 1; i++) {
          const z = zone('poison', c.x + nx * i * 30, c.y + ny * i * 30, 8, op.life, 0);
          let done = false;
          const boom = () => { if (done) return; done = true; z.t = 0; AOE(z.x, z.y, 40, 'fog'); for (const o of W.enemiesNear(z.x, z.y, 40)) H(o, op.mul, { status: 'poison', stacks: 2 }); };
          every(0.1, Math.round(op.life / 0.1), () => { if (W.enemiesNear(z.x, z.y, 22).length) { boom(); return false; } }, boom);
        }
        break;
      }
      case 'rotSeed': { // 쓰러지면 독 폭발 · 버티면 씨앗이 터진다
        const mz0 = W.muzzle(ang); shoot(mz0.x, mz0.y, ang, 300, 220, 'dart', (e) => {
          H(e, op.mul);
          if (e.dead) { AOE(e.x, e.y, 50, 'fog'); for (const o of W.enemiesNear(e.x, e.y, 50)) H(o, op.mul2, { status: 'poison', stacks: 2 }); return; }
          W.emit({ t: 'inkBind', x: e.x, y: e.y, r: e.r, dur: 3 });
          every(0.1, 30, () => { if (e.dead) { AOE(e.x, e.y, 50, 'fog'); for (const o of W.enemiesNear(e.x, e.y, 50)) H(o, op.mul2, { status: 'poison', stacks: 2 }); return false; } }, () => { if (AT(e)) { W.emit({ t: 'emberPop', x: e.x, y: e.y }); H(e, 0.5, { status: 'poison', stacks: 3 }); } });
        });
        break;
      }
      case 'statusStab': { // 상태이상 종류만큼 연타
        const t = tgt(60); if (!t) { W.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.meleeStep(ctx, 40, t);
        H(t, op.mul, { status: 'poison', stacks: 1 }); W.emit({ t: 'skillSingle', x: t.x, y: t.y, fx: 'stab', elem: el });
        const kinds = STATUS_KINDS.filter((k) => { const v = t.st?.[k]; return typeof v === 'number' ? v > 0 : !!v; }).length;
        const n = Math.min(4, kinds);
        for (let i = 1; i <= n; i++) later(0.1 * i, () => { if (AT(t)) { W.emit({ t: 'danceCut', x: t.x, y: t.y, ang: ang + (i % 2 ? 0.6 : -0.6) }); H(t, op.mul); } });
        if (n) W.emit({ t: 'text', x: t.x, y: t.y - 22, text: `독침 ×${n + 1}`, color: '#9ae070' });
        break;
      }
      case 'growArrow': { // 멀수록 굵다
        const mz = W.muzzle(ang);
        shoot(mz.x, mz.y, ang, 280, 260, 'arrow', (e, pr) => {
          const d = Math.hypot(e.x - pr.ox, e.y - pr.oy), k = Math.min(1, d / 240), r = 10 + d * 0.15;
          H(e, op.mul + op.far * k, { status: 'poison', stacks: 1 });
          AOE(e.x, e.y, r, 'pop', { fromProj: true });
          for (const o of W.enemiesNear(e.x, e.y, r)) if (o !== e) H(o, (op.mul + op.far * k) * 0.5, { status: 'poison', stacks: 1 });
        }, { color: '#c8f070' });
        break;
      }
      case 'emberTrail': { // 달린 길에 불씨 → 차례로 터짐
        const x1 = p.x, y1 = p.y; dash(op.dist);
        later(0.2, () => {
          const x2 = p.x, y2 = p.y, pts = [1, 2, 3, 4, 5].map((i) => W.groundPoint(x1 + (x2 - x1) * i / 5, y1 + (y2 - y1) * i / 5));
          for (const q of pts) W.emit({ t: 'emberPop', x: q.x, y: q.y });
          pts.forEach((q, i) => later(1.0 + i * 0.08, () => { AOE(q.x, q.y, 28, 'burst'); for (const o of W.enemiesNear(q.x, q.y, 28)) H(o, op.mul, { status: 'burn', stacks: 1 }); }));
        });
        break;
      }
      case 'decoy': { // 환영이 남아 벤다
        const dx = p.x, dy = p.y; let side = -p.aimY, sy = p.aimX;
        if (W.blocked(p.x + side * 50, p.y + sy * 50, 5)) { side = -side; sy = -sy; }
        const x1 = p.x, y1 = p.y; if (moveTo(p.x + side * 50, p.y + sy * 50)) W.emit({ t: 'blink', x1, y1, x2: p.x, y2: p.y });
        p.invuln = Math.max(p.invuln, 0.3);
        for (const e of W.enemiesNear(dx, dy, 120)) if (e.state === 'chase') { e.loseT = 1.2; e.windT = 0; }
        every(0.5, 5, () => { W.emit({ t: 'afterimage', x1: dx, y1: dy, x2: dx + 1, y2: dy }); const e = near(dx, dy, 70); if (e) { W.emit({ t: 'danceCut', x: e.x, y: e.y, ang: Math.atan2(e.y - dy, e.x - dx) }); H(e, op.mul); } }, () => { AOE(dx, dy, 50, 'implode'); for (const o of W.enemiesNear(dx, dy, 50)) H(o, op.mul2); });
        break;
      }
      case 'swap': { // 자리 바꾸기
        const t = tgt(op.range); if (!t) { W.emit({ t: 'text', x: p.x, y: p.y - 20, text: '닿는 적이 없다', color: '#a8b0c0' }); break; }
        const ox = p.x, oy = p.y, tx = t.x, ty = t.y;
        if (!W.blocked(tx, ty, 5)) { p.x = tx; p.y = ty; t.x = ox; t.y = oy; t.kbx = 0; t.kby = 0; }
        p.invuln = Math.max(p.invuln, 0.25);
        W.emit({ t: 'blink', x1: ox, y1: oy, x2: p.x, y2: p.y }); W.emit({ t: 'blink', x1: tx, y1: ty, x2: t.x, y2: t.y });
        later(0.25, () => { const x = AT(t) ? t.x : ox, y = AT(t) ? t.y : oy; AOE(x, y, 36, 'burst'); for (const o of W.enemiesNear(x, y, 36)) H(o, op.mul, { status: 'burn', stacks: 1 }); });
        break;
      }
      case 'tendrils': { // 촉수를 꽂아 계속 찌른다
        const list = W.enemiesNear(p.x, p.y, 80).slice(0, 4); if (!list.length) { W.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        const live = new Set(list.map((e) => e.id));
        every(0.3, 5, () => { for (const e of list) { if (!live.has(e.id) || !AT(e)) continue; if (Math.hypot(e.x - p.x, e.y - p.y) > 100) { live.delete(e.id); continue; } W.emit({ t: 'bolt', pts: [{ x: p.x, y: p.y - 6 }, { x: (p.x + e.x) / 2 + Math.sin(W.t * 9) * 6, y: (p.y + e.y) / 2 - 10 }, { x: e.x, y: e.y - 6 }], color: '#9ae0ff' }); H(e, op.mul, { status: 'chill', stacks: 1 }); } });
        break;
      }
      case 'hexShare': { // 낙인 찍힌 적의 아픔을 나눈다
        const t = tgt(150); if (!t) { W.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.emit({ t: 'doomMark', id: t.id }); W.emit({ t: 'skillSingle', x: t.x, y: t.y, fx: 'rune', elem: el });
        let last = t.hp; H(t, op.mul, { status: 'curse', stacks: 2 });
        every(0.1, 30, () => { if (!AT(t) && !t.dead) return false; const lost = Math.max(0, last - Math.max(0, t.hp)); last = Math.max(0, t.hp); if (lost > 0) for (const o of W.enemiesNear(t.x, t.y, 80)) if (o !== t) { W.damageEnemy(o, lost * op.share, 'mag', { src: 'linked', color: '#e0a8ff' }); W.emit({ t: 'linkPulse', x1: t.x, y1: t.y - 6, x2: o.x, y2: o.y - 6 }); } if (t.dead) return false; });
        break;
      }
      case 'moveHurt': { // 움직이면 바늘
        const t = tgt(150); if (!t) { W.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.emit({ t: 'skillSingle', x: t.x, y: t.y, fx: 'rune', elem: el }); H(t, op.mul, { status: 'curse', stacks: 2 });
        let lx = t.x, ly = t.y, acc = 0;
        every(0.1, 25, () => { if (!AT(t)) return false; acc += Math.hypot(t.x - lx, t.y - ly); lx = t.x; ly = t.y; while (acc >= 10) { acc -= 10; W.emit({ t: 'whipCrack', x: t.x, y: t.y - 6 }); H(t, op.per); } }, () => { if (AT(t)) { W.emit({ t: 'inkBurst', x: t.x, y: t.y, r: t.r }); H(t, 0.4); } });
        break;
      }
      case 'gazeBeam': { // 노려볼수록 세지는 시선
        const t = tgt(160); if (!t) { W.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        let i = 0; const look = () => { if (!AT(t) || Math.hypot(t.x - p.x, t.y - p.y) > 200) return; W.faceTo(t.x, t.y); W.emit({ t: 'bolt', pts: [{ x: p.x, y: p.y - 10 }, { x: t.x, y: t.y - 6 }], color: '#ffe0f0' }); H(t, op.mul * (1 + i * 0.3)); if (++i < 6) later(0.25, look); else { t.st.weak = Math.max(t.st.weak || 0, 2); t.st.weakK = Math.max(t.st.weakK || 0, 1.35); W.emit({ t: 'shatter', x: t.x, y: t.y }); } };
        look();
        break;
      }
      case 'ricochet': { // 맞을 때마다 다음 적으로 튕긴다
        const hit = new Set(); let left = op.n;
        const fly = (x, y, a, skip) => shoot(x, y, a, 300, 160, 'dart', (e) => { hit.add(e.id); H(e, op.mul, { status: 'bleed', stacks: 1 }); if (--left <= 0) return; const nx = near(e.x, e.y, 120, hit); if (nx) later(0.02, () => fly(e.x, e.y - 4, Math.atan2(nx.y - e.y, nx.x - e.x), [...hit])); }, { skip, color: '#d8f0a0' });
        const mz = W.muzzle(ang); fly(mz.x, mz.y, ang, []);
        break;
      }
      case 'vortex': { // 끌어당기는 꽃잎 소용돌이
        const c = aimAt(150);
        every(0.3, 8, (i) => { AOE(c.x, c.y, op.r * 0.6, 'wind', { lite: true }); for (const o of W.enemiesNear(c.x, c.y, op.r)) { pullTo(o, c.x, c.y, 0.35); H(o, op.mul); } }, () => { AOE(c.x, c.y, op.r, 'wind'); for (const o of W.enemiesNear(c.x, c.y, op.r)) { H(o, op.mul2); knock(o, c.x, c.y, 70); } });
        break;
      }
      case 'slimeTrap': { // 밟으면 끌어모아 터진다
        const c = aimAt(110), z = zone('slow', c.x, c.y, 14, 4, 0); let done = false;
        const boom = () => { if (done) return; done = true; z.t = 0; for (const o of W.enemiesNear(z.x, z.y, 70)) pullTo(o, z.x, z.y); later(0.2, () => { AOE(z.x, z.y, 40, 'splash'); for (const o of W.enemiesNear(z.x, z.y, 40)) { H(o, op.mul); o.st.slowZ = Math.max(o.st.slowZ || 0, 2); } }); };
        every(0.1, 40, () => { if (W.enemiesNear(z.x, z.y, 20).length) { boom(); return false; } }, boom);
        break;
      }
      case 'web': { // 묶고 · 풀릴 때 묶인 수만큼
        const c = aimAt(150), list = W.enemiesNear(c.x, c.y, 46);
        AOE(c.x, c.y, 46, 'trap');
        for (const e of list) { H(e, op.mul, { status: 'poison', stacks: 1 }); if (AT(e)) { e.rooted = Math.max(e.rooted || 0, 1.5); e.vineT0 = W.t; W.emit({ t: 'inkBind', x: e.x, y: e.y, r: e.r, dur: 1.5 }); } }
        later(1.5, () => { const live = list.filter(AT), k = op.per * Math.min(5, live.length); for (const e of live) { W.emit({ t: 'whipCrack', x: e.x, y: e.y - 6 }); H(e, k); } });
        break;
      }
      case 'launchTrap': { // 띄웠다가 떨어뜨린다
        const c = aimAt(110), z = zone('slow', c.x, c.y, 12, 3, 0); let done = false;
        const pop = () => { if (done) return; done = true; z.t = 0; W.emit({ t: 'whipCrack', x: z.x, y: z.y });
          for (const o of W.enemiesNear(z.x, z.y, 34)) { H(o, op.mul); if (!AT(o)) continue; stun(o, 1); o.liftT = 1; W.emit({ t: 'raptorLeap', x: o.x, y: o.y });
            later(1, () => { if (!o.dead) { W.emit({ t: 'land', x: o.x, y: o.y }); for (const q of W.enemiesNear(o.x, o.y, 30)) H(q, op.mul2); } }); } };
        every(0.1, 30, () => { if (W.enemiesNear(z.x, z.y, 22).length) { pop(); return false; } }, pop);
        break;
      }
      case 'shotgun': { // 가까우면 넓게 · 멀면 좁게
        const e0 = near(p.x, p.y, 200), d = e0 ? Math.hypot(e0.x - p.x, e0.y - p.y) : 120, spread = d < 50 ? 0.32 : d < 100 ? 0.18 : 0.06;
        const a0 = e0 ? Math.atan2(e0.y - p.y, e0.x - p.x) : ang;
        for (let i = 0; i < op.n; i++) { const a = a0 + (i - (op.n - 1) / 2) * spread, mz = W.muzzle(a); shoot(mz.x, mz.y, a, 320, 170, 'dart', (e) => H(e, op.mul, { status: 'poison', stacks: 1 })); }
        later(0.05, () => dash(-60));
        break;
      }
      case 'lavaFlow': { // 한 칸씩 흘러가는 용암
        const x0 = p.x, y0 = p.y, a = ang, L = W.rayLen(x0, y0, a, 150);
        every(0.22, 6, (i) => { const d = 25 * (i + 1); if (d > L) return false; const q = W.groundPoint(x0 + Math.cos(a) * d, y0 + Math.sin(a) * d); AOE(q.x, q.y, 22, 'quake', { lite: i % 2 === 1 }); zone('fire', q.x, q.y, 18, 3, ctx.atk); for (const o of W.enemiesNear(q.x, q.y, 22)) H(o, op.mul, { status: 'burn', stacks: 1 }); });
        break;
      }
      case 'pierceBlast': { // 꿰뚫고 · 길이 터진다
        const x1 = p.x, y1 = p.y; dash(op.dist, { mul: op.mul });
        later(0.2, () => { const x2 = p.x, y2 = p.y; const pts = [0, 1, 2, 3, 4].map((i) => W.groundPoint(x1 + (x2 - x1) * (i + 0.5) / 5, y1 + (y2 - y1) * (i + 0.5) / 5)); for (const q of pts) W.emit({ t: 'emberPop', x: q.x, y: q.y });
          later(1.3, () => { W.emit({ t: 'skillLine', x1, y1, x2, y2, w: 20, elem: el, fx: 'pillar' }); for (const q of pts) { AOE(q.x, q.y, 26, 'pillar', { lite: true }); for (const o of W.enemiesNear(q.x, q.y, 26)) H(o, op.mul2, { status: 'burn', stacks: 1 }); } W.emit({ t: 'shake', v: 4 }); }); });
        break;
      }
      case 'burrow': { // 숨었다 솟구친다
        const c = aimAt(110);
        W.emit({ t: 'shadowBlink', x1: p.x, y1: p.y, x2: c.x, y2: c.y, dur: 0.9 });
        p.stealthT = Math.max(p.stealthT || 0, 0.9); p.invuln = Math.max(p.invuln, 0.95);
        for (const e of W.enemies) if (!e.dead && e.state === 'chase') { e.loseT = 0.9; e.windT = 0; }
        later(0.9, () => { const tt = AT(ctx.target) && Math.hypot(ctx.target.x - c.x, ctx.target.y - c.y) < 40 ? ctx.target : null; const q = W.groundPoint(tt ? tt.x : c.x, tt ? tt.y + 4 : c.y); moveTo(q.x, q.y); p.stealthT = 0; AOE(p.x, p.y, 44, 'ice'); W.emit({ t: 'shatter', x: p.x, y: p.y }); for (const o of W.enemiesNear(p.x, p.y, 44)) { H(o, op.mul, { status: 'chill', stacks: 2 }); stun(o, 0.4); } });
        break;
      }
      case 'tide': { // 밀물 → 썰물
        W.emit({ t: 'skillCone', x: p.x, y: p.y, ang, range: 80, angle: 1.4, elem: el, fx: 'wave' });
        const cone = (R, f) => { const a = Math.atan2(p.aimY, p.aimX); for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y; let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.hypot(dx, dy) < R + e.r && (Math.abs(da) < 0.7 || Math.hypot(dx, dy) < e.r + 8)) f(e); } };
        cone(80, (e) => { H(e, op.mul); knock(e, p.x, p.y, 60); });
        later(0.8, () => { W.emit({ t: 'skillCone', x: p.x, y: p.y, ang: Math.atan2(p.aimY, p.aimX), range: 120, angle: 1.4, elem: el, fx: 'wave' }); cone(120, (e) => { H(e, op.mul); reel(e); }); });
        break;
      }
      case 'spiralIce': { // 바깥에서 안으로 세 번
        const c = aimAt(150);
        [70, 48, 26].forEach((r, i) => later(0.3 * i + 0.05, () => { AOE(c.x, c.y, r, 'ice', { lite: i < 2 }); for (const o of W.enemiesNear(c.x, c.y, r)) H(o, op.mul, { status: 'chill', stacks: 1 }); }));
        break;
      }
      case 'shieldBounce': { // 튕기고 돌아와 보호막
        const hit = new Set(); let cur = tgt(110), from = { x: p.x, y: p.y - 6 }, n = 0;
        const hop = () => { if (!cur || n >= op.n) { if (n) { const sh = Math.min(0.12, 0.04 * n); p.shield = Math.max(p.shield || 0, W.d.maxHp * sh); W.emit({ t: 'buff', x: p.x, y: p.y, color: '#ffe8a0' }); W.emit({ t: 'text', x: p.x, y: p.y - 24, text: `보호막 ${Math.round(sh * 100)}%`, color: '#ffe8a0' }); } return; }
          W.emit({ t: 'afterimage', x1: from.x, y1: from.y, x2: cur.x, y2: cur.y - 6 }); W.emit({ t: 'skillSingle', x: cur.x, y: cur.y, fx: 'parry', elem: el });
          hit.add(cur.id); H(cur, op.mul); n++; from = { x: cur.x, y: cur.y - 6 }; cur = near(cur.x, cur.y, 110, hit); later(0.12, hop); };
        hop();
        break;
      }
      case 'wall': { // 벽을 세워 부딪힌 적 기절
        const cx = p.x + p.aimX * 60, cy = p.y + p.aimY * 60, nx = -p.aimY, ny = p.aimX, ax = p.aimX, ay = p.aimY;
        const w1 = { x: cx + nx * 40, y: cy + ny * 40 }, w2 = { x: cx - nx * 40, y: cy - ny * 40 };
        W.emit({ t: 'skillLine', x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y, w: 10, elem: el, fx: 'spikes' });
        W.runOp({ op: 'cone', range: 55, angle: 1.8, mul: op.mul, knock: 70, fx: 'smash' }, ctx);
        const done = new Set();
        every(0.05, 40, (i) => {
          if (i % 10 === 9) W.emit({ t: 'skillLine', x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y, w: 10, elem: el, fx: 'spikes' });
          for (const e of W.enemies) { if (!AT(e)) continue; if (distToSeg(e.x, e.y, w1.x, w1.y, w2.x, w2.y) > e.r + 6) continue;
            const side = (e.x - cx) * ax + (e.y - cy) * ay, s = side >= 0 ? 1 : -1; e.x += ax * s * 3; e.y += ay * s * 3; e.kbx = 0; e.kby = 0; // 벽을 넘지 못한다
            if (!done.has(e.id)) { done.add(e.id); W.emit({ t: 'thud', x: e.x, y: e.y }); stun(e, 1); H(e, op.mul2); } }
        });
        break;
      }
      case 'lantern': { // 약하게 하는 등불 · 곁에서 회복
        const c = W.groundPoint(p.x + p.aimX * 20, p.y + p.aimY * 20);
        zone('sanctuary', c.x, c.y, 50, 4, 0);
        every(0.5, 8, () => { AOE(c.x, c.y, 24, 'holy', { lite: true }); for (const o of W.enemiesNear(c.x, c.y, 60)) { H(o, op.mul); if (AT(o)) { o.st.weak = Math.max(o.st.weak || 0, 0.6); o.st.weakK = Math.max(o.st.weakK || 0, 1.35); } } });
        break;
      }
      case 'prayer': { // 기도 → 모든 그림자에서 손
        p.castT = Math.max(p.castT || 0, 0.8); p.castMax = 0.8; p.castSkill = null;
        W.emit({ t: 'cast', x: p.x, y: p.y, dur: 0.8, elem: el });
        later(0.8, () => { p.castT = 0; for (const o of W.enemiesNear(p.x, p.y, 200)) { W.emit({ t: 'inkBurst', x: o.x, y: o.y, r: o.r }); H(o, op.mul); stun(o, 0.6); } W.emit({ t: 'shake', v: 3 }); });
        break;
      }
      case 'sigilLine': { // 두 성표 사이를 베는 줄
        const a = W.groundPoint(p.x, p.y + 2), b = aimAt(140);
        W.emit({ t: 'inkBind', x: a.x, y: a.y, r: 8, dur: 2 }); W.emit({ t: 'inkBind', x: b.x, y: b.y, r: 8, dur: 2 });
        every(0.25, 8, () => { W.emit({ t: 'linkPulse', x1: a.x, y1: a.y - 2, x2: b.x, y2: b.y - 2 }); for (const e of segHits(a.x, a.y, b.x, b.y, 10)) H(e, op.mul, { status: 'curse', stacks: 1 }); });
        break;
      }
      case 'swarm': { // 쫓아다니는 말벌 떼
        const s = { x: p.x + p.aimX * 14, y: p.y - 6 };
        every(0.1, Math.round(op.dur / 0.1), (i) => { const e = near(s.x, s.y, 220); if (!e) return; const dx = e.x - s.x, dy = e.y - 6 - s.y, l = Math.hypot(dx, dy) || 1, st = Math.min(l, 15); s.x += dx / l * st; s.y += dy / l * st;
          if (i % 2 === 0) W.emit({ t: 'whipCrack', x: s.x, y: s.y });
          if (i % 3 === 0 && l < 16) H(e, op.mul, { status: 'poison', stacks: 1 }); });
        break;
      }
      case 'shardBurst': { // 박힌 깃이 깨진다
        for (let i = 0; i < 5; i++) {
          const a = ang + (i - 2) * 0.22, end = rayEnd(a, 110), mz = W.muzzle(a), S = { x: end.x, y: end.y };
          shoot(mz.x, mz.y, a, 320, end.L, 'knife', (e) => { H(e, op.mul); S.x = e.x; S.y = e.y; S.e = e; }, { color: '#c8f0ff' });
          later(1.0, () => { const x = S.e && AT(S.e) ? S.e.x : S.x, y = S.e && AT(S.e) ? S.e.y : S.y; W.emit({ t: 'shatter', x, y }); AOE(x, y, 26, 'shatter', { lite: true }); for (const o of W.enemiesNear(x, y, 26)) H(o, op.mul2, { status: 'bleed', stacks: 2 }); });
        }
        break;
      }
      case 'hop3': { // 적 사이를 세 번 튕긴다
        const hit = new Set(); let last = null;
        for (let i = 0; i < 3; i++) later(0.18 * i, () => {
          let e = near(p.x, p.y, 100, hit) || (AT(last) ? last : null); if (!e) return; hit.add(e.id); last = e;
          const a = Math.atan2(p.y - e.y, p.x - e.x) + (i % 2 ? 1.2 : -1.2), x1 = p.x, y1 = p.y;
          const tx = e.x + Math.cos(a) * (e.r + 8), ty = e.y + Math.sin(a) * (e.r + 8);
          if (moveTo(tx, ty)) W.emit({ t: 'afterimage', x1, y1, x2: p.x, y2: p.y });
          p.invuln = Math.max(p.invuln, 0.2); W.faceTo(e.x, e.y);
          W.emit({ t: 'danceCut', x: e.x, y: e.y, ang: Math.atan2(e.y - y1, e.x - x1) }); H(e, op.mul, { status: 'bleed', stacks: 1 });
        });
        break;
      }
      case 'featherNova': { // 날아올라 내려앉으며 칼깃
        const c = aimAt(90), x1 = p.x, y1 = p.y;
        p.invuln = Math.max(p.invuln, 0.55); W.emit({ t: 'soarUp', x: p.x, y: p.y });
        later(0.5, () => { moveTo(c.x, c.y); W.emit({ t: 'afterimage', x1, y1, x2: p.x, y2: p.y }); W.emit({ t: 'land', x: p.x, y: p.y, big: true }); for (const o of W.enemiesNear(p.x, p.y, 30)) H(o, op.mul);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; shoot(p.x, p.y - 4, a, 260, 100, 'knife', (e) => H(e, op.mul2, { status: 'bleed', stacks: 1 }), { color: '#e8f6ff' }); } });
        break;
      }
      case 'stormEye': { // 따라오는 폭풍
        every(0.3, Math.round(op.dur / 0.3), () => {
          const list = W.enemiesNear(p.x, p.y, 120); if (!list.length) return;
          for (const o of list) pullTo(o, p.x, p.y, 0.12);
          const e = list[Math.floor(W.rng.range(0, list.length)) % list.length];
          W.emit({ t: 'bolt', pts: [{ x: e.x + W.rng.range(-8, 8), y: e.y - 90 }, { x: e.x + W.rng.range(-6, 6), y: e.y - 45 }, { x: e.x, y: e.y - 4 }], color: '#f8f070' });
          AOE(e.x, e.y, 26, 'bolt', { lite: true }); for (const o of W.enemiesNear(e.x, e.y, 26)) H(o, op.mul, { status: 'shock', stacks: 1 });
        });
        break;
      }
      case 'soulOrbs': { // 혼을 뽑아 한꺼번에 날린다
        const list = W.enemiesNear(p.x, p.y, 120).slice(0, 3); let n = 0;
        for (const e of list) { W.emit({ t: 'linkPulse', x1: e.x, y1: e.y - 6, x2: p.x, y2: p.y - 8 }); H(e, op.mul); n++; }
        if (!n) { W.emit({ t: 'text', x: p.x, y: p.y - 20, text: '거둘 혼이 없다', color: '#a8b0c0' }); break; }
        later(1.2, () => { const a = Math.atan2(p.aimY, p.aimX); for (let i = 0; i < n; i++) { const b = a + (i - (n - 1) / 2) * 0.12; shoot(p.x, p.y - 8, b, 240, 200, 'skill', (e) => H(e, op.mul2), { pierce: 1, color: '#c8a8ff' }); } });
        break;
      }
      case 'burnHarvest': { // 화상을 거둬 한 방에
        const list = W.enemiesNear(p.x, p.y, 100); let total = 0;
        for (const e of list) { const n = e.st.burn?.n || 0; if (n) { total += n; delete e.st.burn; W.emit({ t: 'linkPulse', x1: e.x, y1: e.y - 6, x2: p.x, y2: p.y - 8 }); } }
        if (!total) { AOE(p.x, p.y, 60, 'burst'); for (const e of W.enemiesNear(p.x, p.y, 60)) H(e, op.mul2, { status: 'burn', stacks: 2 }); break; }
        const k = Math.min(2.8, 0.25 * total), mz = W.muzzle(ang);
        W.emit({ t: 'text', x: p.x, y: p.y - 26, text: `불꽃 ${total} 거둠`, color: '#ff9a40' });
        shoot(mz.x, mz.y, ang, 260, 200, 'fireball', (e, pr) => { H(e, op.mul * (1 + k)); AOE(pr.x, pr.y, 30, 'burst', { fromProj: true }); }, { pierce: 3, color: '#ff7a26' });
        break;
      }
      case 'iceSlide': { // 얼음길을 미끄러지며 옆으로 밀어낸다
        const x1 = p.x, y1 = p.y, nx = -p.aimY, ny = p.aimX;
        dash(op.dist, { iceTrail: true });
        later(0.05, () => { const end = { x: x1 + p.aimX * op.dist, y: y1 + p.aimY * op.dist };
          for (const e of segHits(x1, y1, end.x, end.y, 14)) { H(e, op.mul, { status: 'chill', stacks: 2 }); if (AT(e) && !e.def.elite) { const s = (e.x - x1) * nx + (e.y - y1) * ny >= 0 ? 1 : -1; e.kbx += nx * s * 180; e.kby += ny * s * 180; } } });
        break;
      }
      default: break;
    }
  },
};

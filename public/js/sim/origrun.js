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
    const AOE = (x, y, r, fx, extra = {}) => W.emit({ t: 'skillAoe', x, y, r, elem: el, fx: fx || ctx.def.fx, ...extra, quiet: true });
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
      color: o.color || col, kind: 'skill', skind, elem: el, big: true, rot: a, ox: x, oy: y, skillHit: (e, pr) => onHit(e, pr), oskin: o.skin, opal: o.pal });
    const zone = (kind, x, y, r, t, atk = ctx.atk * ctx.bonus * 0.3) => { const c = W.groundPoint(x, y); const z = { kind, x: c.x, y: c.y, r, t, max: t, tick: 0, atk }; W.zones.push(z); W.emit({ t: 'zoneFx', x: c.x, y: c.y, r, kind }); return z; };
    const coneHits = (a, R, half) => W.enemies.filter((e) => { if (!AT(e)) return false; const dx = e.x - p.x, dy = e.y - p.y; let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.hypot(dx, dy) < R + e.r && Math.abs(da) < half + 0.15; });
    const moveE = (e, x, y) => { if (!AT(e) || W.blocked(x, y, e.r * 0.6)) return false; e.x = x; e.y = y; e.kbx = 0; e.kby = 0; return true; };
    const QUIET = new Set(['skillAoe', 'skillCone', 'skillLine']); const E = (ev) => W.emit(QUIET.has(ev.t) ? { ...ev, quiet: true } : ev); // 범용 범위 그림은 소리만 (그림은 ofx)
    const F = (s, o) => W.emit({ t: 'ofx', s, tier, ...o }); // 독창 스킬 그림 (render/origfx.js)
    const dash = (dist, o = {}) => W.runOp({ op: 'dash', dist, mul: 0, ...o }, ctx);

    switch (op.k) {
      case 'stickyGlob': { // 붙었다 1.5초 뒤 끌어모으며 터진다
        shoot(p.x, p.y - 4, ang, 220, 160, 'plague', (e) => {
          H(e, op.mul);
          E({ t: 'inkBind', x: e.x, y: e.y, r: e.r, dur: 1.5 }); F('splat', { x: e.x, y: e.y + 2, r: 13, pal: 'slime', dur: 1.6, bubble: true });
          later(1.5, () => { const x = e.dead ? e.x : e.x, y = e.y; for (const o of W.enemiesNear(x, y, op.r)) if (o !== e) pullTo(o, x, y); later(0.15, () => { AOE(x, y, 40, 'splash'); F('burst', { x, y, r: 24, pal: 'slime' }); F('splat', { x, y: y + 2, r: 26, pal: 'slime', dur: 1 }); for (const o of W.enemiesNear(x, y, 40)) { H(o, op.mul2); o.st.slowZ = Math.max(o.st.slowZ || 0, 2); } }); });
        }, { skin: 'glob', pal: 'slime' });
        break;
      }
      case 'rollBack': { // 굴러가 치고 되굴러 온다
        p.buffs.oRoll = { t: 1.2, max: 1.2, mods: { dmgTakenMul: 0.7 }, name: '등껍질', color: '#c8b088' };
        E({ t: 'spin', x: p.x, y: p.y, r: 22 }); F('slash', { x: p.x, y: p.y, r: 16, ang, spread: 5.5, pal: 'earth' });
        dash(op.dist, { mul: op.mul });
        later(0.35, () => { p.aimX = -p.aimX; p.aimY = -p.aimY; dash(op.dist, { mul: op.mul }); p.aimX = -p.aimX; p.aimY = -p.aimY; E({ t: 'spin', x: p.x, y: p.y, r: 22 }); F('slash', { x: p.x, y: p.y, r: 16, ang: ang + Math.PI, spread: 5.5, pal: 'earth' }); F('burst', { x: p.x, y: p.y, r: 18, pal: 'earth', n: 8 }); });
        break;
      }
      case 'spineShell': { // 막는 동안 맞은 횟수만큼 가시
        const g = (p.origGuard = { k: 0.6, acc: 0, n: 0, until: W.t + op.dur });
        E({ t: 'parryStance', x: p.x, y: p.y, dur: op.dur }); F('spikes', { x: p.x, y: p.y + 2, r: 13, n: 8, h: 11, pal: 'petal', dur: op.dur });
        later(op.dur, () => {
          if (p.origGuard === g) p.origGuard = null;
          const n = Math.min(12, 4 + g.n * 2);
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; shoot(p.x, p.y - 4, a, 240, 110, 'icerock', (e) => { H(e, op.mul); F('rays', { x: e.x, y: e.y, r: 10, pal: 'blood', n: 5 }); }, { color: '#f0a890', skin: 'spine', pal: 'petal' }); }
          F('burst', { x: p.x, y: p.y, r: 26, pal: 'petal', n });
          E({ t: 'text', x: p.x, y: p.y - 24, text: `가시 ×${n}`, color: '#f0a890' });
        });
        break;
      }
      case 'bounce3': { // 세 번 튀어 가며 내려찍기
        const steps = [40, 75, 100];
        p.invuln = Math.max(p.invuln, 0.8);
        steps.forEach((d, i) => later(0.22 * (i + 1), () => {
          const e = rayEnd(ang, d); const x1 = p.x, y1 = p.y;
          if (moveTo(e.x, e.y)) E({ t: 'afterimage', x1, y1, x2: p.x, y2: p.y });
          E({ t: 'land', x: p.x, y: p.y, big: i === 0 }); F('splat', { x: p.x, y: p.y + 2, r: op.rs[i] * 0.7, pal: 'slime', dur: 1.2, bubble: true }); F('burst', { x: p.x, y: p.y, r: op.rs[i] * 0.6, pal: 'slime', n: 8 + i * 3 });
          for (const o of W.enemiesNear(p.x, p.y, op.rs[i])) H(o, op.muls[i]);
        }));
        break;
      }
      case 'absorbWave': { // 막은 만큼 되돌리는 파동
        const g = (p.origGuard = { k: 0.3, acc: 0, n: 0, until: W.t + op.dur });
        E({ t: 'parryStance', x: p.x, y: p.y, dur: op.dur }); F('wall', { x1: p.x + p.aimX * 10 - p.aimY * 12, y1: p.y + p.aimY * 10 + p.aimX * 12 + 4, x2: p.x + p.aimX * 10 + p.aimY * 12, y2: p.y + p.aimY * 10 - p.aimX * 12 + 4, h: 14, pal: 'earth', dur: op.dur });
        later(op.dur, () => {
          if (p.origGuard === g) p.origGuard = null;
          const extra = Math.min(3, (g.acc * 3) / Math.max(1, ctx.atk * ctx.bonus));
          const a = Math.atan2(p.aimY, p.aimX);
          E({ t: 'skillCone', x: p.x, y: p.y, ang: a, range: 90, angle: 1.6, elem: el, fx: 'wave' }); F('slash', { x: p.x, y: p.y, r: 60 + extra * 8, ang: a, spread: 1.6, pal: 'gold', dur: 0.35 }); F('rays', { x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, r: 50, ang: a, spread: 1.6, n: 9 + Math.round(extra * 3), pal: 'gold' });
          for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y, dd = Math.hypot(dx, dy); let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (dd < 90 + e.r && (Math.abs(da) < 0.8 || dd < e.r + 8)) { H(e, op.mul + extra); knock(e, p.x, p.y, 40); } }
          if (extra > 0.05) E({ t: 'text', x: p.x, y: p.y - 24, text: `되돌림 +${Math.round(extra * 100)}%`, color: '#ffe8a0' });
        });
        break;
      }
      case 'sandStab': { // 모래 → 등 뒤 찌르기
        E({ t: 'skillCone', x: p.x, y: p.y, ang, range: 50, angle: 1.6, elem: el, fx: 'smoke' }); F('rays', { x: p.x + Math.cos(ang) * 10, y: p.y + Math.sin(ang) * 10, r: 46, ang, spread: 1.6, n: 11, pal: 'sand' });
        for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y; let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.hypot(dx, dy) < 50 + e.r && Math.abs(da) < 0.8) { H(e, op.mul); stun(e, 0.6); } }
        later(0.15, () => { W.runOp({ op: 'behind', range: 90 }, ctx); const t = tgt(90); if (t && Math.hypot(t.x - p.x, t.y - p.y) < 40) { E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'stab', elem: el }); F('slash', { x: t.x, y: t.y, r: 13, ang: Math.atan2(t.y - p.y, t.x - p.x), spread: 1.4, pal: 'metal' }); F('rays', { x: t.x, y: t.y, r: 16, pal: 'blood', n: 6 }); H(t, op.mul2, { backstab: true }); } });
        break;
      }
      case 'packBite': { // 둘레 적 수만큼 물기
        const t = tgt(60); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.meleeStep(ctx, 40, t);
        const n = Math.min(6, 1 + W.enemiesNear(p.x, p.y, 90).filter((e) => e !== t).length);
        let i = 0; const bite = () => { if (!AT(t)) return; E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'bite', elem: el }); F('slash', { x: t.x, y: t.y, r: 11, ang: ang + (i % 2 ? 0.9 : -0.9) + Math.PI / 2, spread: 1.6, pal: 'blood' }); H(t, op.mul, { status: 'bleed', stacks: 1 }); if (++i < n) later(0.12, bite); };
        bite(); if (n > 1) E({ t: 'text', x: t.x, y: t.y - 22, text: `무리 ×${n}`, color: '#e0445a' });
        break;
      }
      case 'sawOrbit': { // 톱날 셋 · 맞힌 횟수만큼 다음 스킬 강화
        const S = { hits: 0 };
        for (const al of W.allies) if (al.kind === 'orbitAxe' && al.orig) al.t = 0;
        F('rays', { x: p.x, y: p.y, r: 30, pal: 'metal', n: 10 }); for (let i = 0; i < 3; i++) W.allies.push({ id: W.nextId++, kind: 'orbitAxe', orig: true, x: p.x, y: p.y, t: op.dur, max: op.dur, phase: (i / 3) * Math.PI * 2, r: 34, atk: 0, hitCd: {}, dir: 1, cd: 0, onHit: (e) => { S.hits++; H(e, op.mul); } });
        later(op.dur, () => { if (!S.hits) return; const mul = 1 + Math.min(0.6, 0.06 * S.hits); p.origNext = { mul, until: W.t + 6, from: ctx.id }; E({ t: 'text', x: p.x, y: p.y - 26, text: `다음 스킬 +${Math.round((mul - 1) * 100)}%`, color: '#ffd27a' }); });
        break;
      }
      case 'returnSlash': { // 표식 → 물러남 → 표식으로 되돌아가며 베기
        const mx = p.x, my = p.y;
        E({ t: 'echoMark', x: mx, y: my, dur: 0.9, r: 12 });
        W.runOp({ op: 'cone', range: 42, angle: 1.6, mul: op.mul, fx: 'claws' }, ctx);
        later(0.08, () => dash(-70));
        later(0.9, () => { const x1 = p.x, y1 = p.y; if (W.blocked(mx, my, 5)) return; p.x = mx; p.y = my; p.invuln = Math.max(p.invuln, 0.2); E({ t: 'danceDash', x1, y1, x2: mx, y2: my }); for (const e of segHits(x1, y1, mx, my, 14)) { H(e, op.mul2); E({ t: 'danceCut', x: e.x, y: e.y, ang: Math.atan2(my - y1, mx - x1) }); F('slash', { x: e.x, y: e.y, r: 14, ang: Math.atan2(my - y1, mx - x1) + Math.PI / 2, pal: 'shadow' }); } });
        break;
      }
      case 'tongue': { // 처음 닿은 적을 끌어와 문다
        const e2 = rayEnd(ang, op.range);
        const list = segHits(p.x, p.y, e2.x, e2.y, 8).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        const t = list[0];
        { const q = t ? { x: t.x, y: t.y - 6 } : { x: e2.x, y: e2.y - 6 }; F('tongue', { x1: p.x + Math.cos(ang) * 6, y1: p.y - 7, x2: q.x, y2: q.y, pal: 'petal', w: 2.8, wob: 2, dur: 0.38 }); }
        if (!t) break;
        H(t, op.mul, { status: 'poison', stacks: 2 }); reel(t);
        later(0.3, () => { if (AT(t)) { E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'bite', elem: el }); F('burst', { x: t.x, y: t.y, r: 16, pal: 'poison', n: 8 }); H(t, op.mul2); } });
        break;
      }
      case 'sporeMines': { // 다가오면 터지는 버섯 셋
        const c = aimAt(120), nx = -p.aimY, ny = p.aimX;
        for (let i = -1; i <= 1; i++) {
          const z = zone('poison', c.x + nx * i * 30, c.y + ny * i * 30, 8, op.life, 0);
          let done = false;
          const boom = () => { if (done) return; done = true; z.t = 0; AOE(z.x, z.y, 40, 'fog'); F('burst', { x: z.x, y: z.y, r: 30, pal: 'poison', n: 12 }); F('splat', { x: z.x, y: z.y, r: 26, pal: 'poison', dur: 1.2, bubble: true }); for (const o of W.enemiesNear(z.x, z.y, 40)) H(o, op.mul, { status: 'poison', stacks: 2 }); };
          every(0.1, Math.round(op.life / 0.1), (j) => { if (W.enemiesNear(z.x, z.y, 22).length) { boom(); return false; } if (j % 5 === 0) F('trap', { x: z.x, y: z.y, r: 8, n: 6, pal: 'poison', dur: 0.55 }); }, boom);
        }
        break;
      }
      case 'rotSeed': { // 쓰러지면 독 폭발 · 버티면 씨앗이 터진다
        const mz0 = W.muzzle(ang); shoot(mz0.x, mz0.y, ang, 300, 220, 'dart', (e) => {
          H(e, op.mul);
          if (e.dead) { AOE(e.x, e.y, 50, 'fog'); F('burst', { x: e.x, y: e.y, r: 36, pal: 'poison', n: 14 }); for (const o of W.enemiesNear(e.x, e.y, 50)) H(o, op.mul2, { status: 'poison', stacks: 2 }); return; }
          E({ t: 'inkBind', x: e.x, y: e.y, r: e.r, dur: 3 }); F('splat', { x: e.x, y: e.y + 2, r: 12, pal: 'poison', dur: 3, bubble: true });
          every(0.1, 30, () => { if (e.dead) { AOE(e.x, e.y, 50, 'fog'); F('burst', { x: e.x, y: e.y, r: 36, pal: 'poison', n: 14 }); for (const o of W.enemiesNear(e.x, e.y, 50)) H(o, op.mul2, { status: 'poison', stacks: 2 }); return false; } }, () => { if (AT(e)) { E({ t: 'emberPop', x: e.x, y: e.y }); F('spikes', { x: e.x, y: e.y, r: 12, n: 6, h: 14, pal: 'poison' }); H(e, 0.5, { status: 'poison', stacks: 3 }); } });
        }, { skin: 'seed', pal: 'poison' });
        break;
      }
      case 'statusStab': { // 상태이상 종류만큼 연타
        const t = tgt(60); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.meleeStep(ctx, 40, t);
        H(t, op.mul, { status: 'poison', stacks: 1 }); E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'stab', elem: el }); F('rays', { x: t.x, y: t.y, r: 20, ang, spread: 1.1, n: 6, pal: 'poison' });
        const kinds = STATUS_KINDS.filter((k) => { const v = t.st?.[k]; return typeof v === 'number' ? v > 0 : !!v; }).length;
        const n = Math.min(4, kinds);
        for (let i = 1; i <= n; i++) later(0.1 * i, () => { if (AT(t)) { E({ t: 'danceCut', x: t.x, y: t.y, ang: ang + (i % 2 ? 0.6 : -0.6) }); F('rays', { x: t.x, y: t.y, r: 16, ang: ang + (i % 2 ? 0.6 : -0.6), spread: 0.9, n: 5, pal: 'poison' }); H(t, op.mul); } });
        if (n) E({ t: 'text', x: t.x, y: t.y - 22, text: `독침 ×${n + 1}`, color: '#9ae070' });
        break;
      }
      case 'growArrow': { // 멀수록 굵다
        const mz = W.muzzle(ang);
        shoot(mz.x, mz.y, ang, 280, 260, 'arrow', (e, pr) => {
          const d = Math.hypot(e.x - pr.ox, e.y - pr.oy), k = Math.min(1, d / 240), r = 10 + d * 0.15;
          H(e, op.mul + op.far * k, { status: 'poison', stacks: 1 });
          AOE(e.x, e.y, r, 'pop', { fromProj: true }); F('burst', { x: e.x, y: e.y, r: r * 0.9, pal: 'poison', n: 8 + Math.round(k * 8) }); F('splat', { x: e.x, y: e.y + 2, r: r * 0.7, pal: 'poison', dur: 0.9 });
          for (const o of W.enemiesNear(e.x, e.y, r)) if (o !== e) H(o, (op.mul + op.far * k) * 0.5, { status: 'poison', stacks: 1 });
        }, { color: '#c8f070', skin: 'arrow', pal: 'poison' });
        break;
      }
      case 'emberTrail': { // 달린 길에 불씨 → 차례로 터짐
        const x1 = p.x, y1 = p.y; dash(op.dist);
        later(0.2, () => {
          const x2 = p.x, y2 = p.y, pts = [1, 2, 3, 4, 5].map((i) => W.groundPoint(x1 + (x2 - x1) * i / 5, y1 + (y2 - y1) * i / 5));
          for (const q of pts) E({ t: 'emberPop', x: q.x, y: q.y }); F('path', { x1, y1, x2, y2, pal: 'fire', dur: 1.3 });
          pts.forEach((q, i) => later(1.0 + i * 0.08, () => { AOE(q.x, q.y, 28, 'burst'); F('burst', { x: q.x, y: q.y, r: 22, pal: 'fire', n: 10 }); for (const o of W.enemiesNear(q.x, q.y, 28)) H(o, op.mul, { status: 'burn', stacks: 1 }); }));
        });
        break;
      }
      case 'decoy': { // 환영이 남아 벤다
        const dx = p.x, dy = p.y; let side = -p.aimY, sy = p.aimX;
        if (W.blocked(p.x + side * 50, p.y + sy * 50, 5)) { side = -side; sy = -sy; }
        const x1 = p.x, y1 = p.y; if (moveTo(p.x + side * 50, p.y + sy * 50)) E({ t: 'blink', x1, y1, x2: p.x, y2: p.y });
        p.invuln = Math.max(p.invuln, 0.3);
        for (const e of W.enemiesNear(dx, dy, 120)) if (e.state === 'chase') { e.loseT = 1.2; e.windT = 0; }
        every(0.5, 5, () => { E({ t: 'afterimage', x1: dx, y1: dy, x2: dx + 1, y2: dy }); const e = near(dx, dy, 70); if (e) { E({ t: 'danceCut', x: e.x, y: e.y, ang: Math.atan2(e.y - dy, e.x - dx) }); F('slash', { x: e.x, y: e.y, r: 14, ang: Math.atan2(e.y - dy, e.x - dx) + Math.PI / 2, pal: 'shadow' }); H(e, op.mul); } }, () => { AOE(dx, dy, 50, 'implode'); F('burst', { x: dx, y: dy, r: 34, pal: 'shadow', n: 12 }); for (const o of W.enemiesNear(dx, dy, 50)) H(o, op.mul2); });
        break;
      }
      case 'swap': { // 자리 바꾸기
        const t = tgt(op.range); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '닿는 적이 없다', color: '#a8b0c0' }); break; }
        const ox = p.x, oy = p.y, tx = t.x, ty = t.y;
        if (!W.blocked(tx, ty, 5)) { p.x = tx; p.y = ty; t.x = ox; t.y = oy; t.kbx = 0; t.kby = 0; }
        p.invuln = Math.max(p.invuln, 0.25);
        E({ t: 'blink', x1: ox, y1: oy, x2: p.x, y2: p.y }); E({ t: 'blink', x1: tx, y1: ty, x2: t.x, y2: t.y });
        F('rays', { x: ox, y: oy, r: 18, pal: 'fire', n: 8 }); F('rays', { x: tx, y: ty, r: 18, pal: 'fire', n: 8 });
        later(0.25, () => { const x = AT(t) ? t.x : ox, y = AT(t) ? t.y : oy; AOE(x, y, 36, 'burst'); F('burst', { x, y, r: 30, pal: 'fire', n: 12 }); for (const o of W.enemiesNear(x, y, 36)) H(o, op.mul); });
        break;
      }
      case 'tendrils': { // 촉수를 꽂아 계속 찌른다
        const list = W.enemiesNear(p.x, p.y, 80).slice(0, 4); if (!list.length) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        const live = new Set(list.map((e) => e.id));
        every(0.3, 5, () => { for (const e of list) { if (!live.has(e.id) || !AT(e)) continue; if (Math.hypot(e.x - p.x, e.y - p.y) > 100) { live.delete(e.id); continue; } F('tether', { x1: p.x, y1: p.y - 6, x2: e.x, y2: e.y - 6, pal: 'water', w: 2.2, wob: 6, dur: 0.3 }); H(e, op.mul, { status: 'chill', stacks: 1 }); } });
        break;
      }
      case 'hexShare': { // 낙인 찍힌 적의 아픔을 나눈다
        const t = tgt(150); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        E({ t: 'doomMark', id: t.id }); E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'rune', elem: el }); F('sigil', { x: t.x, y: t.y + 2, r: 16, pal: 'curse', dur: 3 });
        let last = t.hp; H(t, op.mul, { status: 'curse', stacks: 2 });
        every(0.1, 30, () => { if (!AT(t) && !t.dead) return false; const lost = Math.max(0, last - Math.max(0, t.hp)); last = Math.max(0, t.hp); if (lost > 0) for (const o of W.enemiesNear(t.x, t.y, 80)) if (o !== t) { W.damageEnemy(o, lost * op.share, 'mag', { src: 'linked', color: '#e0a8ff' }); E({ t: 'linkPulse', x1: t.x, y1: t.y - 6, x2: o.x, y2: o.y - 6 }); F('tether', { x1: t.x, y1: t.y - 6, x2: o.x, y2: o.y - 6, pal: 'curse', w: 1.6, wob: 3, dur: 0.25 }); } if (t.dead) return false; });
        break;
      }
      case 'moveHurt': { // 움직이면 바늘
        const t = tgt(150); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'rune', elem: el }); F('mark', { x: t.x, y: t.y - 6, icon: 'brand', pal: 'curse', dur: 2.5 }); F('rays', { x: t.x, y: t.y, r: 16, pal: 'curse', n: 8 }); H(t, op.mul, { status: 'curse', stacks: 2 });
        let lx = t.x, ly = t.y, acc = 0;
        every(0.1, 25, () => { if (!AT(t)) return false; acc += Math.hypot(t.x - lx, t.y - ly); lx = t.x; ly = t.y; while (acc >= 10) { acc -= 10; E({ t: 'whipCrack', x: t.x, y: t.y - 6 }); F('rays', { x: t.x, y: t.y, r: 12, pal: 'curse', n: 4, dur: 0.2 }); H(t, op.per); } }, () => { if (AT(t)) { E({ t: 'inkBurst', x: t.x, y: t.y, r: t.r }); H(t, 0.4); } });
        break;
      }
      case 'gazeBeam': { // 노려볼수록 세지는 시선
        const t = tgt(160); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        let i = 0; const look = () => { if (!AT(t) || Math.hypot(t.x - p.x, t.y - p.y) > 200) return; W.faceTo(t.x, t.y); F('tether', { x1: p.x, y1: p.y - 10, x2: t.x, y2: t.y - 6, pal: 'holy', w: 1.4 + i * 0.5, wob: 0, dur: 0.24 }); F('rays', { x: t.x, y: t.y, r: 10 + i * 2, pal: 'holy', n: 6 }); H(t, op.mul * (1 + i * 0.3)); if (++i < 6) later(0.25, look); else { t.st.weak = Math.max(t.st.weak || 0, 2); t.st.weakK = Math.max(t.st.weakK || 0, 1.35); E({ t: 'shatter', x: t.x, y: t.y }); F('burst', { x: t.x, y: t.y, r: 28, pal: 'holy', n: 14 }); } };
        look();
        break;
      }
      case 'ricochet': { // 맞을 때마다 다음 적으로 튕긴다
        const hit = new Set(); let left = op.n;
        const fly = (x, y, a, skip) => shoot(x, y, a, 300, 160, 'dart', (e) => { hit.add(e.id); F('rays', { x: e.x, y: e.y, r: 13, pal: 'poison', n: 6 }); H(e, op.mul, { status: 'bleed', stacks: 1 }); if (--left <= 0) return; const nx = near(e.x, e.y, 120, hit); if (nx) later(0.02, () => fly(e.x, e.y - 4, Math.atan2(nx.y - e.y, nx.x - e.x), [...hit])); }, { skip, color: '#d8f0a0', skin: 'thorn', pal: 'poison' });
        const mz = W.muzzle(ang); fly(mz.x, mz.y, ang, []);
        break;
      }
      case 'vortex': { // 끌어당기는 꽃잎 소용돌이
        const c = aimAt(150); F('swirl', { x: c.x, y: c.y, r: op.r, n: 5, pal: 'petal', dur: 2.6 });
        every(0.3, 8, (i) => { AOE(c.x, c.y, op.r * 0.6, 'wind', { lite: true }); for (const o of W.enemiesNear(c.x, c.y, op.r)) { pullTo(o, c.x, c.y, 0.35); H(o, op.mul); } }, () => { AOE(c.x, c.y, op.r, 'wind'); F('burst', { x: c.x, y: c.y, r: op.r * 0.7, pal: 'petal', n: 14 }); for (const o of W.enemiesNear(c.x, c.y, op.r)) { H(o, op.mul2); knock(o, c.x, c.y, 70); } });
        break;
      }
      case 'slimeTrap': { // 밟으면 끌어모아 터진다
        const c = aimAt(110), z = zone('slow', c.x, c.y, 14, 4, 0); let done = false;
        const boom = () => { if (done) return; done = true; z.t = 0; for (const o of W.enemiesNear(z.x, z.y, 70)) pullTo(o, z.x, z.y); later(0.2, () => { AOE(z.x, z.y, 40, 'splash'); F('burst', { x: z.x, y: z.y, r: 28, pal: 'slime', n: 12 }); F('splat', { x: z.x, y: z.y, r: 30, pal: 'slime', dur: 1.4 }); for (const o of W.enemiesNear(z.x, z.y, 40)) { H(o, op.mul); o.st.slowZ = Math.max(o.st.slowZ || 0, 2); } }); };
        every(0.1, 40, (j) => { if (W.enemiesNear(z.x, z.y, 20).length) { boom(); return false; } if (j % 5 === 0) F('trap', { x: z.x, y: z.y, r: 12, n: 8, pal: 'slime', dur: 0.55 }); }, boom);
        break;
      }
      case 'web': { // 묶고 · 풀릴 때 묶인 수만큼
        const c = aimAt(150), list = W.enemiesNear(c.x, c.y, 46);
        AOE(c.x, c.y, 46, 'trap'); F('web', { x: c.x, y: c.y, r: 46, pal: 'bone', dur: 1.7 });
        for (const e of list) { H(e, op.mul, { status: 'poison', stacks: 1 }); if (AT(e)) { e.rooted = Math.max(e.rooted || 0, 1.5); e.vineT0 = W.t; E({ t: 'inkBind', x: e.x, y: e.y, r: e.r, dur: 1.5 }); } }
        later(1.5, () => { const live = list.filter(AT), k = op.per * Math.min(5, live.length); for (const e of live) { E({ t: 'whipCrack', x: e.x, y: e.y - 6 }); F('rays', { x: e.x, y: e.y, r: 16, pal: 'bone', n: 8 }); H(e, k); } });
        break;
      }
      case 'launchTrap': { // 띄웠다가 떨어뜨린다
        const c = aimAt(110), z = zone('slow', c.x, c.y, 12, 3, 0); let done = false; const trapFx = { x: c.x, y: c.y, r: 12, n: 8, pal: 'metal', dur: 3 }; F('trap', trapFx);
        const pop = () => { if (done) return; done = true; z.t = 0; E({ t: 'whipCrack', x: z.x, y: z.y }); F('spikes', { x: z.x, y: z.y, r: 16, n: 8, h: 18, pal: 'metal', dur: 0.4 }); F('burst', { x: z.x, y: z.y, r: 26, pal: 'earth', n: 10 });
          for (const o of W.enemiesNear(z.x, z.y, 34)) { H(o, op.mul); if (!AT(o)) continue; stun(o, 1); o.liftT = 1; E({ t: 'raptorLeap', x: o.x, y: o.y }); F('gust', { x: o.x, y: o.y + 6, r: 30, ang: -Math.PI / 2, n: 4, wide: 14, pal: 'wind', dur: 0.5 });
            later(1, () => { if (!o.dead) { E({ t: 'land', x: o.x, y: o.y }); F('burst', { x: o.x, y: o.y, r: 22, pal: 'earth', n: 10 }); for (const q of W.enemiesNear(o.x, o.y, 30)) H(q, op.mul2); } }); } };
        every(0.1, 30, () => { if (W.enemiesNear(z.x, z.y, 22).length) { pop(); return false; } }, pop);
        break;
      }
      case 'shotgun': { // 가까우면 넓게 · 멀면 좁게
        const e0 = near(p.x, p.y, 200), d = e0 ? Math.hypot(e0.x - p.x, e0.y - p.y) : 120, spread = d < 50 ? 0.32 : d < 100 ? 0.18 : 0.06;
        const a0 = e0 ? Math.atan2(e0.y - p.y, e0.x - p.x) : ang;
        for (let i = 0; i < op.n; i++) { const a = a0 + (i - (op.n - 1) / 2) * spread, mz = W.muzzle(a); shoot(mz.x, mz.y, a, 320, 170, 'dart', (e) => { H(e, op.mul, { status: 'poison', stacks: 1 }); F('rays', { x: e.x, y: e.y, r: 10, pal: 'poison', n: 5 }); }, { skin: 'thorn', pal: 'poison' }); } F('rays', { x: p.x + Math.cos(a0) * 10, y: p.y + Math.sin(a0) * 10, r: 30, ang: a0, spread: spread * op.n + 0.3, n: 7, pal: 'poison' });
        later(0.05, () => dash(-60));
        break;
      }
      case 'lavaFlow': { // 한 칸씩 흘러가는 용암
        const x0 = p.x, y0 = p.y, a = ang, L = W.rayLen(x0, y0, a, 150);
        every(0.22, 6, (i) => { const d = 25 * (i + 1); if (d > L) return false; const q = W.groundPoint(x0 + Math.cos(a) * d, y0 + Math.sin(a) * d); AOE(q.x, q.y, 22, 'quake', { lite: i % 2 === 1 }); F('splat', { x: q.x, y: q.y, r: 17, pal: 'lava', dur: 3, bubble: true }); F('rays', { x: q.x, y: q.y, r: 16, pal: 'fire', n: 6, ang: -Math.PI / 2, spread: 1.6 }); zone('fire', q.x, q.y, 18, 3, ctx.atk); for (const o of W.enemiesNear(q.x, q.y, 22)) H(o, op.mul, { status: 'burn', stacks: 1 }); });
        break;
      }
      case 'pierceBlast': { // 꿰뚫고 · 길이 터진다
        const x1 = p.x, y1 = p.y; dash(op.dist, { mul: op.mul });
        later(0.2, () => { const x2 = p.x, y2 = p.y; const pts = [0, 1, 2, 3, 4].map((i) => W.groundPoint(x1 + (x2 - x1) * (i + 0.5) / 5, y1 + (y2 - y1) * (i + 0.5) / 5)); for (const q of pts) { E({ t: 'emberPop', x: q.x, y: q.y }); F('splat', { x: q.x, y: q.y + 2, r: 9, pal: 'lava', dur: 1.4, bubble: true }); } F('crack', { x1, y1: y1 + 2, x2, y2: y2 + 2, pal: 'fire', dur: 1.4 }); F('slash', { x: x2, y: y2, r: 20, ang: Math.atan2(y2 - y1, x2 - x1), spread: 1.2, pal: 'fire' });
          later(1.3, () => { E({ t: 'skillLine', x1, y1, x2, y2, w: 20, elem: el, fx: 'pillar' }); for (const q of pts) { AOE(q.x, q.y, 26, 'pillar', { lite: true }); F('pillar', { x: q.x, y: q.y, r: 22, h: 44, pal: 'fire' }); for (const o of W.enemiesNear(q.x, q.y, 26)) H(o, op.mul2); } E({ t: 'shake', v: 4 }); }); });
        break;
      }
      case 'burrow': { // 숨었다 솟구친다
        const c = aimAt(110);
        E({ t: 'shadowBlink', x1: p.x, y1: p.y, x2: c.x, y2: c.y, dur: 0.9 }); F('splat', { x: p.x, y: p.y + 2, r: 14, pal: 'earth', dur: 0.9 }); F('crack', { x1: p.x, y1: p.y + 2, x2: c.x, y2: c.y + 2, pal: 'ice', dur: 1 });
        p.stealthT = Math.max(p.stealthT || 0, 0.9); p.invuln = Math.max(p.invuln, 0.95);
        for (const e of W.enemies) if (!e.dead && e.state === 'chase') { e.loseT = 0.9; e.windT = 0; }
        later(0.9, () => { const tt = AT(ctx.target) && Math.hypot(ctx.target.x - c.x, ctx.target.y - c.y) < 40 ? ctx.target : null; const q = W.groundPoint(tt ? tt.x : c.x, tt ? tt.y + 4 : c.y); moveTo(q.x, q.y); p.stealthT = 0; AOE(p.x, p.y, 44, 'ice'); E({ t: 'shatter', x: p.x, y: p.y }); F('spikes', { x: p.x, y: p.y, r: 38, n: 12, h: 22, pal: 'ice' }); for (const o of W.enemiesNear(p.x, p.y, 44)) { H(o, op.mul, { status: 'chill', stacks: 2 }); stun(o, 0.4); } });
        break;
      }
      case 'tide': { // 밀물 → 썰물
        E({ t: 'skillCone', x: p.x, y: p.y, ang, range: 80, angle: 1.4, elem: el, fx: 'wave' }); F('slash', { x: p.x, y: p.y, r: 56, ang, spread: 1.5, pal: 'water', dur: 0.4 }); F('rays', { x: p.x + Math.cos(ang) * 50, y: p.y + Math.sin(ang) * 50, r: 26, ang, spread: 1.4, n: 7, pal: 'water' });
        const cone = (R, f) => { const a = Math.atan2(p.aimY, p.aimX); for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y; let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.hypot(dx, dy) < R + e.r && (Math.abs(da) < 0.7 || Math.hypot(dx, dy) < e.r + 8)) f(e); } };
        cone(80, (e) => { H(e, op.mul); knock(e, p.x, p.y, 60); });
        later(0.8, () => { E({ t: 'skillCone', x: p.x, y: p.y, ang: Math.atan2(p.aimY, p.aimX), range: 120, angle: 1.4, elem: el, fx: 'wave' }); F('slash', { x: p.x, y: p.y, r: 96, ang: Math.atan2(p.aimY, p.aimX), spread: 1.4, pal: 'water', dur: 0.45 }); F('wing', { x: p.x, y: p.y, r: 80, ang: Math.atan2(p.aimY, p.aimX), n: 6, spread: 1.4, pal: 'water', dur: 0.4 }); cone(120, (e) => { H(e, op.mul); reel(e); }); });
        break;
      }
      case 'spiralIce': { // 바깥에서 안으로 세 번
        const c = aimAt(150);
        F('swirl', { x: c.x, y: c.y, r: 70, n: 5, pal: 'ice', dur: 1 }); [70, 48, 26].forEach((r, i) => later(0.3 * i + 0.05, () => { AOE(c.x, c.y, r, 'ice', { lite: i < 2 }); F('spikes', { x: c.x, y: c.y, r, n: 6 + i * 2, h: 12 + i * 6, pal: 'ice', dur: 0.6 }); if (i === 2) F('burst', { x: c.x, y: c.y, r: 30, pal: 'ice', n: 12 }); for (const o of W.enemiesNear(c.x, c.y, r)) H(o, op.mul, { status: 'chill', stacks: 1 }); }));
        break;
      }
      case 'shieldBounce': { // 튕기고 돌아와 보호막
        const hit = new Set(); let cur = tgt(110), from = { x: p.x, y: p.y - 6 }, n = 0;
        const hop = () => { if (!cur || n >= op.n) { if (n) { const sh = Math.min(0.12, 0.04 * n); p.shield = Math.max(p.shield || 0, W.d.maxHp * sh); E({ t: 'buff', x: p.x, y: p.y, color: '#ffe8a0' }); E({ t: 'text', x: p.x, y: p.y - 24, text: `보호막 ${Math.round(sh * 100)}%`, color: '#ffe8a0' }); } return; }
          E({ t: 'afterimage', x1: from.x, y1: from.y, x2: cur.x, y2: cur.y - 6 }); E({ t: 'skillSingle', x: cur.x, y: cur.y, fx: 'parry', elem: el }); F('beam', { x1: from.x, y1: from.y, x2: cur.x, y2: cur.y - 6, w: 4, pal: 'gold', dur: 0.4 }); F('blade', { x: cur.x, y: cur.y - 2, size: 9, n: 8, pal: 'gold', dur: 0.2 }); F('burst', { x: cur.x, y: cur.y, r: 24, pal: 'gold', n: 10 });
          hit.add(cur.id); H(cur, op.mul); n++; from = { x: cur.x, y: cur.y - 6 }; cur = near(cur.x, cur.y, 110, hit); later(0.12, hop); };
        hop();
        break;
      }
      case 'wall': { // 벽을 세워 부딪힌 적 기절
        const cx = p.x + p.aimX * 60, cy = p.y + p.aimY * 60, nx = -p.aimY, ny = p.aimX, ax = p.aimX, ay = p.aimY;
        const w1 = { x: cx + nx * 40, y: cy + ny * 40 }, w2 = { x: cx - nx * 40, y: cy - ny * 40 };
        E({ t: 'skillLine', x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y, w: 10, elem: el, fx: 'spikes' }); F('wall', { x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y, h: 22, pal: 'metal', dur: 2 });
        W.runOp({ op: 'cone', range: 55, angle: 1.8, mul: op.mul, knock: 70, fx: 'smash' }, ctx);
        const done = new Set();
        every(0.05, 40, (i) => {
          
          for (const e of W.enemies) { if (!AT(e)) continue; if (distToSeg(e.x, e.y, w1.x, w1.y, w2.x, w2.y) > e.r + 6) continue;
            const side = (e.x - cx) * ax + (e.y - cy) * ay, s = side >= 0 ? 1 : -1; e.x += ax * s * 3; e.y += ay * s * 3; e.kbx = 0; e.kby = 0; // 벽을 넘지 못한다
            if (!done.has(e.id)) { done.add(e.id); E({ t: 'thud', x: e.x, y: e.y }); F('burst', { x: e.x, y: e.y, r: 18, pal: 'metal', n: 8 }); stun(e, 1); H(e, op.mul2); } }
        });
        break;
      }
      case 'lantern': { // 약하게 하는 등불 · 곁에서 회복
        const c = W.groundPoint(p.x + p.aimX * 20, p.y + p.aimY * 20);
        zone('sanctuary', c.x, c.y, 50, 4, 0); F('orb', { x: c.x, y: c.y, r: 5, h: 16, pal: 'holy', dur: 4 }); F('sigil', { x: c.x, y: c.y + 2, r: 34, n: 6, pal: 'holy', dur: 4 });
        every(0.5, 8, (i) => { AOE(c.x, c.y, 24, 'holy', { lite: true }); if (i % 2 === 0) F('rays', { x: c.x, y: c.y - 10, r: 40, pal: 'holy', n: 10, dur: 0.3 }); for (const o of W.enemiesNear(c.x, c.y, 60)) { H(o, op.mul); if (AT(o)) { o.st.weak = Math.max(o.st.weak || 0, 0.6); o.st.weakK = Math.max(o.st.weakK || 0, 1.35); } } });
        break;
      }
      case 'prayer': { // 기도 → 모든 그림자에서 손
        p.castT = Math.max(p.castT || 0, 0.8); p.castMax = 0.8; p.castSkill = null;
        E({ t: 'cast', x: p.x, y: p.y, dur: 0.8, elem: el }); F('sigil', { x: p.x, y: p.y + 2, r: 22, pal: 'shadow', dur: 1.1 });
        later(0.8, () => { p.castT = 0; for (const o of W.enemiesNear(p.x, p.y, 200)) { E({ t: 'inkBurst', x: o.x, y: o.y, r: o.r }); F('fist', { x: o.x, y: o.y + 8, r: 18, ang: -Math.PI / 2, n: 5, spread: 1.1, pal: 'shadow', dur: 0.5 }); H(o, op.mul); stun(o, 0.6); } E({ t: 'shake', v: 3 }); });
        break;
      }
      case 'sigilLine': { // 두 성표 사이를 베는 줄
        const a = W.groundPoint(p.x, p.y + 2), b = aimAt(140);
        F('sigil', { x: a.x, y: a.y, r: 12, pal: 'curse', dur: 2.1 }); F('sigil', { x: b.x, y: b.y, r: 12, pal: 'curse', dur: 2.1 }); F('glyph', { x: a.x, y: a.y, r: 5, pal: 'curse', dur: 2.1 }); F('glyph', { x: b.x, y: b.y, r: 5, pal: 'curse', dur: 2.1 });
        every(0.25, 8, () => { F('beam', { x1: a.x, y1: a.y - 10, x2: b.x, y2: b.y - 10, w: 2.4, pal: 'curse', dur: 0.24 }); for (const e of segHits(a.x, a.y, b.x, b.y, 10)) H(e, op.mul, { status: 'curse', stacks: 1 }); });
        break;
      }
      case 'swarm': { // 쫓아다니는 말벌 떼
        const s = { x: p.x + p.aimX * 14, y: p.y - 6 };
        every(0.1, Math.round(op.dur / 0.1), (i) => { const e = near(s.x, s.y, 220); if (!e) return; const dx = e.x - s.x, dy = e.y - 6 - s.y, l = Math.hypot(dx, dy) || 1, st = Math.min(l, 15); s.x += dx / l * st; s.y += dy / l * st;
          F('bugs', { x: s.x, y: s.y, r: 9, n: 7, pal: 'gold', dur: 0.12 }); if (i % 4 === 0) E({ t: 'whipCrack', x: s.x, y: s.y });
          if (i % 3 === 0 && l < 16) H(e, op.mul, { status: 'poison', stacks: 1 }); });
        break;
      }
      case 'shardBurst': { // 박힌 깃이 깨진다
        for (let i = 0; i < 5; i++) {
          const a = ang + (i - 2) * 0.22, end = rayEnd(a, 110), mz = W.muzzle(a), S = { x: end.x, y: end.y };
          shoot(mz.x, mz.y, a, 320, end.L, 'knife', (e) => { H(e, op.mul); S.x = e.x; S.y = e.y; S.e = e; }, { color: '#c8f0ff', skin: 'shard', pal: 'glass' });
          later(1.0, () => { const x = S.e && AT(S.e) ? S.e.x : S.x, y = S.e && AT(S.e) ? S.e.y : S.y; E({ t: 'shatter', x, y }); F('rays', { x, y, r: 22, pal: 'glass', n: 9 }); AOE(x, y, 26, 'shatter', { lite: true }); for (const o of W.enemiesNear(x, y, 26)) H(o, op.mul2, { status: 'bleed', stacks: 2 }); });
        }
        break;
      }
      case 'hop3': { // 적 사이를 세 번 튕긴다
        const hit = new Set(); let last = null;
        for (let i = 0; i < 3; i++) later(0.18 * i, () => {
          let e = near(p.x, p.y, 100, hit) || (AT(last) ? last : null); if (!e) return; hit.add(e.id); last = e;
          const a = Math.atan2(p.y - e.y, p.x - e.x) + (i % 2 ? 1.2 : -1.2), x1 = p.x, y1 = p.y;
          const tx = e.x + Math.cos(a) * (e.r + 8), ty = e.y + Math.sin(a) * (e.r + 8);
          if (moveTo(tx, ty)) E({ t: 'afterimage', x1, y1, x2: p.x, y2: p.y });
          p.invuln = Math.max(p.invuln, 0.2); W.faceTo(e.x, e.y);
          E({ t: 'danceCut', x: e.x, y: e.y, ang: Math.atan2(e.y - y1, e.x - x1) }); F('slash', { x: e.x, y: e.y, r: 14, ang: Math.atan2(e.y - y1, e.x - x1) + Math.PI / 2, pal: 'wind' }); H(e, op.mul, { status: 'bleed', stacks: 1 });
        });
        break;
      }
      case 'featherNova': { // 날아올라 내려앉으며 칼깃
        const c = aimAt(90), x1 = p.x, y1 = p.y;
        p.invuln = Math.max(p.invuln, 0.55); E({ t: 'soarUp', x: p.x, y: p.y });
        later(0.5, () => { moveTo(c.x, c.y); E({ t: 'afterimage', x1, y1, x2: p.x, y2: p.y }); E({ t: 'land', x: p.x, y: p.y, big: true }); F('rays', { x: p.x, y: p.y, r: 30, n: 8, pal: 'wind' }); for (const o of W.enemiesNear(p.x, p.y, 30)) H(o, op.mul);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; shoot(p.x, p.y - 4, a, 260, 100, 'knife', (e) => H(e, op.mul2, { status: 'bleed', stacks: 1 }), { color: '#e8f6ff', skin: 'feather', pal: 'wind' }); } });
        break;
      }
      case 'stormEye': { // 따라오는 폭풍
        every(0.3, Math.round(op.dur / 0.3), () => {
          const list = W.enemiesNear(p.x, p.y, 120); if (!list.length) return;
          for (const o of list) pullTo(o, p.x, p.y, 0.12);
          const e = list[Math.floor(W.rng.range(0, list.length)) % list.length];
          F('bolt', { x1: e.x + W.rng.range(-8, 8), y1: e.y - 90, x2: e.x, y2: e.y - 4, pal: 'bolt', dur: 0.22 }); F('rays', { x: e.x, y: e.y + 2, r: 18, pal: 'bolt', n: 8 });
          AOE(e.x, e.y, 26, 'bolt', { lite: true }); for (const o of W.enemiesNear(e.x, e.y, 26)) H(o, op.mul, { status: 'shock', stacks: 1 });
        });
        break;
      }
      case 'soulOrbs': { // 혼을 뽑아 한꺼번에 날린다
        const list = W.enemiesNear(p.x, p.y, 120).slice(0, 3); let n = 0;
        for (const e of list) { E({ t: 'linkPulse', x1: e.x, y1: e.y - 6, x2: p.x, y2: p.y - 8 }); F('tether', { x1: e.x, y1: e.y - 6, x2: p.x, y2: p.y - 8, pal: 'curse', w: 1.8, wob: 4, dur: 0.35 }); F('orb', { x: p.x + (n - 1) * 8, y: p.y, r: 3, h: 22, pal: 'curse', dur: 1.25 }); H(e, op.mul); n++; }
        if (!n) { E({ t: 'text', x: p.x, y: p.y - 20, text: '거둘 혼이 없다', color: '#a8b0c0' }); break; }
        later(1.2, () => { const a = Math.atan2(p.aimY, p.aimX); for (let i = 0; i < n; i++) { const b = a + (i - (n - 1) / 2) * 0.12; shoot(p.x, p.y - 8, b, 240, 200, 'skill', (e) => { H(e, op.mul2); F('rays', { x: e.x, y: e.y, r: 16, pal: 'curse', n: 7 }); }, { pierce: 1, color: '#c8a8ff', skin: 'wisp', pal: 'curse' }); } });
        break;
      }
      case 'burnHarvest': { // 화상을 거둬 한 방에
        const list = W.enemiesNear(p.x, p.y, 100); let total = 0;
        for (const e of list) { const n = e.st.burn?.n || 0; if (n) { total += n; delete e.st.burn; E({ t: 'linkPulse', x1: e.x, y1: e.y - 6, x2: p.x, y2: p.y - 8 }); F('tether', { x1: e.x, y1: e.y - 6, x2: p.x, y2: p.y - 8, pal: 'fire', w: 2, wob: 4, dur: 0.3 }); } }
        if (!total) { AOE(p.x, p.y, 60, 'burst'); F('burst', { x: p.x, y: p.y, r: 44, pal: 'fire', n: 14 }); for (const e of W.enemiesNear(p.x, p.y, 60)) H(e, op.mul2, { status: 'burn', stacks: 2 }); break; }
        const k = Math.min(2.8, 0.25 * total), mz = W.muzzle(ang);
        E({ t: 'text', x: p.x, y: p.y - 26, text: `불꽃 ${total} 거둠`, color: '#ff9a40' });
        shoot(mz.x, mz.y, ang, 260, 200, 'fireball', (e, pr) => { H(e, op.mul * (1 + k)); AOE(pr.x, pr.y, 30, 'burst', { fromProj: true }); F('burst', { x: pr.x, y: pr.y, r: 26, pal: 'fire', n: 12 }); }, { pierce: 3, color: '#ff7a26', skin: 'comet', pal: 'fire' });
        break;
      }
      case 'iceSlide': { // 얼음길을 미끄러지며 옆으로 밀어낸다
        const x1 = p.x, y1 = p.y, nx = -p.aimY, ny = p.aimX;
        dash(op.dist, { iceTrail: true });
        later(0.05, () => { const end = { x: x1 + p.aimX * op.dist, y: y1 + p.aimY * op.dist }; F('splat', { x: (x1 + p.x) / 2, y: (y1 + p.y) / 2 + 2, r: Math.hypot(p.x - x1, p.y - y1) * 0.5, pal: 'ice', dur: 1.6 }); F('crack', { x1, y1: y1 + 2, x2: p.x, y2: p.y + 2, pal: 'glass', dur: 1.6 }); F('spikes', { x1: x1 + nx * 14, y1: y1 + ny * 14, x2: p.x + nx * 14, y2: p.y + ny * 14, n: 5, h: 10, pal: 'ice', dur: 0.7 }); F('spikes', { x1: x1 - nx * 14, y1: y1 - ny * 14, x2: p.x - nx * 14, y2: p.y - ny * 14, n: 5, h: 10, pal: 'ice', dur: 0.7 });
          for (const e of segHits(x1, y1, end.x, end.y, 14)) { H(e, op.mul, { status: 'chill', stacks: 2 }); if (AT(e) && !e.def.elite) { const s = (e.x - x1) * nx + (e.y - y1) * ny >= 0 ? 1 : -1; e.kbx += nx * s * 180; e.kby += ny * s * 180; } } });
        break;
      }
      // ── 2묶음 ──
      case 'dewOrbs': { // 물방울 셋이 하나씩 떨어진다 · 남은 방울은 회복
        for (let i = 0; i < 3; i++) { E({ t: 'skillFall', x: p.x + (i - 1) * 10, y: p.y - 4, r: 8, dur: 0.5 * (i + 1), fx: 'ice', elem: el }); F('orb', { x: p.x + (i - 1) * 9, y: p.y, r: 3.5, h: 24, pal: 'water', dur: 0.5 * (i + 1) }); }
        every(0.5, 3, () => { const e = near(p.x, p.y, 140); if (!e) { W.heal(W.d.maxHp * 0.02, 'skill'); E({ t: 'splash', x: p.x, y: p.y }); return; } AOE(e.x, e.y, 14, 'ice', { lite: true }); F('pillar', { x: e.x, y: e.y + 2, r: 14, h: 34, pal: 'water', dur: 0.45 }); F('burst', { x: e.x, y: e.y, r: 16, pal: 'water', n: 8 }); E({ t: 'shatter', x: e.x, y: e.y }); H(e, op.mul, { status: 'chill', stacks: 1 }); });
        break;
      }
      case 'coinLure': { // 나를 잊고 금화로 몰려든다
        const c = aimAt(120); E({ t: 'skillFall', x: c.x, y: c.y, r: 10, dur: 0.3, fx: 'wind', elem: el }); for (let i = 0; i < 4; i++) F('orb', { x: c.x + (i - 1.5) * 5, y: c.y + (i % 2) * 3, r: 2.6, h: 3 + (i % 2) * 2, pal: 'gold', dur: 2.1 });
        const lured = W.enemiesNear(c.x, c.y, 100);
        for (const e of lured) { if (e.state === 'chase') { e.loseT = 2; e.windT = 0; } E({ t: 'linkPulse', x1: e.x, y1: e.y - 6, x2: c.x, y2: c.y - 4 }); }
        every(0.25, 8, () => { for (const e of lured) if (AT(e) && Math.hypot(e.x - c.x, e.y - c.y) > 18) pullTo(e, c.x, c.y, 0.1); });
        later(2, () => { AOE(c.x, c.y, 45, 'wind'); E({ t: 'spark', x: c.x, y: c.y - 6, color: col }); F('burst', { x: c.x, y: c.y, r: 36, pal: 'gold', n: 14 }); for (const e of W.enemiesNear(c.x, c.y, 45)) H(e, op.mul); });
        break;
      }
      case 'missingHpBlast': { // 잃은 체력만큼 센 불길
        F('pillar', { x: p.x, y: p.y, r: 22, h: 50, pal: 'fire', dur: 0.6 }); F('rays', { x: p.x, y: p.y, r: 40, pal: 'fire', n: 12 }); F('wing', { x: p.x, y: p.y, r: 26, ang: -Math.PI / 2, n: 7, spread: 3, pal: 'lava', dur: 4 }); every(1, 4, () => { const lost = 1 - Math.max(0, p.hp) / W.d.maxHp, m = op.mul + op.lostK * lost; AOE(p.x, p.y, 70, 'burst'); F('burst', { x: p.x, y: p.y, r: 46 + lost * 24, pal: 'fire', n: 14 }); F('spikes', { x: p.x, y: p.y, r: 50, n: 10, h: 14, pal: 'lava' }); E({ t: 'shake', v: 2 + lost * 4 }); for (const e of W.enemiesNear(p.x, p.y, 70)) H(e, m); if (lost > 0.2) E({ t: 'text', x: p.x, y: p.y - 26, text: `역린 +${Math.round(op.lostK * lost * 100)}%`, color: '#ff8a40' }); });
        break;
      }
      case 'alphaRoar': { // 포효 → 잔영 랩터가 겁먹은 적을 꿰뚫는다
        const list = W.enemiesNear(p.x, p.y, 120);
        AOE(p.x, p.y, 120, 'wind', { lite: true }); E({ t: 'shake', v: 3 }); F('rays', { x: p.x, y: p.y, r: 70, n: 16, pal: 'blood' });
        for (const e of list) { H(e, op.mul); if (AT(e)) W.fearE(e, 1.5); }
        list.slice(0, 6).forEach((e, i) => later(1 + i * 0.12, () => { if (!AT(e)) return; const a = W.rng.range(0, Math.PI * 2), x1 = e.x + Math.cos(a) * 60, y1 = e.y + Math.sin(a) * 60, x2 = e.x - Math.cos(a) * 60, y2 = e.y - Math.sin(a) * 60;
          E({ t: 'danceDash', x1, y1, x2, y2 }); E({ t: 'danceCut', x: e.x, y: e.y, ang: a }); F('slash', { x: e.x, y: e.y, r: 15, ang: a + Math.PI / 2, pal: 'blood' }); H(e, op.mul2, { status: 'bleed', stacks: 2 }); }));
        break;
      }
      case 'corePulse': { // 커져 가는 네 번의 박동
        p.buffs.oCore = { t: 4, max: 4, mods: { dmgTakenMul: 0.7 }, name: '고대의 핵', color: '#ffb060' };
        [0, 1, 2, 3].forEach((i) => later(0.05 + i, () => { const r = op.rs[i]; AOE(p.x, p.y, r, 'quake', { lite: i < 3 }); F('burst', { x: p.x, y: p.y, r: r * 0.55, pal: 'lava', n: 10 + i * 2 }); if (i === 3) F('spikes', { x: p.x, y: p.y, r: r * 0.8, n: 14, h: 20, pal: 'earth' }); E({ t: 'shake', v: 2 + i * 2 }); for (const e of W.enemiesNear(p.x, p.y, r)) { H(e, op.muls[i]); knock(e, p.x, p.y, 30); if (i === 3) stun(e, 1); } }));
        break;
      }
      case 'dawnFall': { // 떠 있는 빛 → 떨어지는 새벽
        const c = aimAt(140); E({ t: 'skillFall', x: c.x, y: c.y, r: 110, dur: 2, fx: 'holy', elem: el }); F('orb', { x: c.x, y: c.y, r: 8, h: 44, pal: 'holy', dur: 2 }); F('sigil', { x: c.x, y: c.y + 2, r: 60, n: 6, pal: 'holy', dur: 2.1 });
        every(0.5, 4, () => { W.heal(W.d.maxHp * 0.015, 'skill'); for (const e of W.enemiesNear(c.x, c.y, 30)) H(e, op.mul); });
        later(2.05, () => { AOE(c.x, c.y, 110, 'holy'); E({ t: 'shake', v: 6 }); F('pillar', { x: c.x, y: c.y, r: 50, h: 120, pal: 'holy', dur: 0.7 }); F('burst', { x: c.x, y: c.y, r: 90, pal: 'holy', n: 20 }); for (const e of W.enemiesNear(c.x, c.y, 110)) { H(e, op.mul2); if (AT(e)) e.st.weak = Math.max(e.st.weak || 0, 2); } });
        break;
      }
      case 'curseCombo': { // 세 번 쳐 저주를 쌓고 봉인으로 거둔다
        const t = tgt(60); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.meleeStep(ctx, 40, t);
        for (let i = 0; i < 3; i++) later(0.14 * i, () => { if (!AT(t)) return; E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'rune', elem: el }); F('fist', { x: p.x, y: p.y, r: Math.hypot(t.x - p.x, t.y - p.y) + 4, ang: Math.atan2(t.y - p.y, t.x - p.x) + (i - 1) * 0.15, n: 3, spread: 0.25, pal: 'curse', dur: 0.2 }); F('burst', { x: t.x, y: t.y, r: 18 + i * 4, pal: 'curse', n: 8 + i * 2 }); F('mark', { x: t.x, y: t.y, icon: 'brand', pal: 'curse', n: i + 1, dur: 0.6 }); H(t, op.mul, { status: 'curse', stacks: 2 }); });
        later(0.6, () => { if (!AT(t)) return; const n = t.st.curse?.n || 0; E({ t: 'doomMark', id: t.id }); AOE(t.x, t.y, 20, 'rune', { lite: true }); F('sigil', { x: t.x, y: t.y + 2, r: 26, n: 6, pal: 'curse', dur: 1 }); F('cage', { x: t.x, y: t.y + 2, r: t.r + 6, n: 6, h: 22, pal: 'curse', dur: 0.5 }); F('burst', { x: t.x, y: t.y, r: 30 + n * 2, pal: 'curse', n: 16 }); F('pillar', { x: t.x, y: t.y, r: 16, h: 50, pal: 'curse', dur: 0.5 }); H(t, op.mul2 * (1 + 0.2 * n)); if (n) E({ t: 'text', x: t.x, y: t.y - 22, text: `봉인 +${n * 20}%`, color: '#c45cff' }); });
        break;
      }
      case 'blurGuard': { // 맞을 때마다 잔영이 대신 깨진다
        const g = (p.origGuard = { k: 0, acc: 0, n: 0, until: W.t + op.dur }); let used = 0;
        F('mirage', { x: p.x, y: p.y, pal: 'shadow', dur: op.dur }); F('burst', { x: p.x, y: p.y, r: 24, pal: 'shadow', n: 10 });
        every(0.05, Math.round(op.dur / 0.05), () => { while (used < g.n && used < 3) { used++; E({ t: 'afterimage', x1: p.x - 8, y1: p.y, x2: p.x + 8, y2: p.y }); E({ t: 'shatter', x: p.x, y: p.y }); F('burst', { x: p.x, y: p.y, r: 26, pal: 'shadow', n: 10 }); for (const e of W.enemiesNear(p.x, p.y, 50)) H(e, op.mul); } if (used >= 3) { if (p.origGuard === g) p.origGuard = null; return false; } },
          () => { if (p.origGuard === g) p.origGuard = null; const left = 3 - used; if (left > 0) { AOE(p.x, p.y, 50, 'blink', { lite: true }); F('burst', { x: p.x, y: p.y, r: 36 + left * 6, pal: 'shadow', n: 14 }); for (const e of W.enemiesNear(p.x, p.y, 50)) H(e, op.mul2 * left); } });
        break;
      }
      case 'wingBeats': { // 갈수록 좁고 멀리
        const R = [60, 90, 120], A = [1.8, 1.2, 0.7];
        for (let i = 0; i < 3; i++) later(0.35 * i, () => { const a = Math.atan2(p.aimY, p.aimX); E({ t: 'skillCone', x: p.x, y: p.y, ang: a, range: R[i], angle: A[i], elem: el, fx: 'wind' }); F('wing', { x: p.x, y: p.y, r: R[i] * 0.75, ang: a, n: 5 + i, spread: A[i], pal: 'shadow', dur: 0.3 });
          for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y; let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.hypot(dx, dy) < R[i] + e.r && Math.abs(da) < A[i] / 2 + 0.15) { H(e, op.mul); if (AT(e)) e.st.slowZ = (e.st.slowZ || 0) + 1; } } });
        break;
      }
      case 'inkSpread': { // 먹이 번진다
        const mz = W.muzzle(ang), end = rayEnd(ang, 150); let done = false;
        const spread = (x, y) => { if (done) return; done = true; const q = W.groundPoint(x, y); every(0.4, 6, (i) => { const r = 20 + i * 10; AOE(q.x, q.y, r, 'ink', { lite: i % 2 === 1 }); F('splat', { x: q.x, y: q.y + 2, r, pal: 'ink', dur: 0.7 + (5 - i) * 0.3 }); if (i === 0) F('burst', { x: q.x, y: q.y, r: 22, pal: 'ink', n: 10 }); for (const e of W.enemiesNear(q.x, q.y, r)) H(e, op.mul2, { status: 'chill', stacks: 1 }); }); };
        shoot(mz.x, mz.y, ang, 240, end.L, 'plague', (e) => { H(e, op.mul); spread(e.x, e.y); }, { color: '#2a2440', skin: 'glob', pal: 'ink' });
        later(end.L / 240 + 0.05, () => spread(end.x, end.y));
        break;
      }
      case 'bowlingHit': { // 걷어찬 적이 굴러가며 친다
        const t = tgt(120); if (!t) { dash(60); break; }
        W.meleeStep(ctx, Math.max(0, Math.hypot(t.x - p.x, t.y - p.y) - t.r - 8), t);
        const a = Math.atan2(t.y - p.y, t.x - p.x); H(t, op.mul); E({ t: 'slam', x: t.x, y: t.y }); F('burst', { x: t.x, y: t.y, r: 24, ang: a, spread: 2, n: 9, pal: 'earth' });
        if (t.def.elite || t.def.boss) break;
        const hit = new Set([t.id]); let i = 0;
        every(0.03, 13, () => { if (!AT(t)) return false; const nx = t.x + Math.cos(a) * 10, ny = t.y + Math.sin(a) * 10; i++;
          if (W.blocked(nx, ny, t.r)) { stun(t, 1); E({ t: 'collide', x: t.x, y: t.y }); E({ t: 'shake', v: 3 }); return false; }
          t.x = nx; t.y = ny; t.kbx = t.kby = 0; if (i % 3 === 0) { E({ t: 'rushDust', x: t.x, y: t.y, dx: Math.cos(a) }); F('slash', { x: t.x, y: t.y, r: 10, ang: a, spread: 4, pal: 'earth', dur: 0.15 }); }
          for (const o of W.enemiesNear(t.x, t.y, t.r + 10)) if (!hit.has(o.id)) { hit.add(o.id); H(o, op.mul2); knock(o, t.x, t.y, 50); } });
        break;
      }
      case 'plunderDash': { // 맞힌 만큼 약탈
        const x1 = p.x, y1 = p.y; dash(op.dist);
        later(0.22, () => { const L = segHits(x1, y1, p.x, p.y, 16).slice(0, 5); for (const e of L) { H(e, op.mul); E({ t: 'linkPulse', x1: e.x, y1: e.y - 6, x2: p.x, y2: p.y - 8 }); F('rays', { x: e.x, y: e.y, r: 14, pal: 'gold', n: 7 }); F('orb', { x: e.x, y: e.y, r: 2.6, h: 16, pal: 'gold', dur: 0.5 }); }
          if (L.length) { W.addRes(8 * L.length); p.shield = Math.min(W.d.maxHp * 0.6, (p.shield || 0) + W.d.maxHp * 0.03 * L.length); E({ t: 'text', x: p.x, y: p.y - 26, text: `약탈 ×${L.length}`, color: '#ffd27a' }); } });
        break;
      }
      case 'crackStar': { // 네 갈래 금
        E({ t: 'slam', x: p.x, y: p.y }); E({ t: 'shake', v: 3 }); F('burst', { x: p.x, y: p.y, r: 24, pal: 'earth', n: 10 });
        const hit = new Set();
        for (let d = 0; d < 4; d++) { F('crack', { x1: p.x, y1: p.y + 2, x2: p.x + Math.cos(ang + d * Math.PI / 2) * W.rayLen(p.x, p.y, ang + d * Math.PI / 2, 100), y2: p.y + 2 + Math.sin(ang + d * Math.PI / 2) * W.rayLen(p.x, p.y, ang + d * Math.PI / 2, 100), pal: 'earth', dur: 1.1 }); const a = ang + d * Math.PI / 2, L = W.rayLen(p.x, p.y, a, 100), x0 = p.x, y0 = p.y;
          every(0.075, 4, (i) => { const r1 = L * i / 4, r2 = L * (i + 1) / 4, xa = x0 + Math.cos(a) * r1, ya = y0 + Math.sin(a) * r1, xb = x0 + Math.cos(a) * r2, yb = y0 + Math.sin(a) * r2;
            E({ t: 'skillLine', x1: xa, y1: ya, x2: xb, y2: yb, w: 10, elem: el, fx: 'quake' }); F('spikes', { x1: xa, y1: ya, x2: xb, y2: yb, n: 3, h: 12, pal: 'earth', dur: 0.45 });
            for (const e of segHits(xa, ya, xb, yb, 10)) if (!hit.has(e.id)) { hit.add(e.id); H(e, op.mul); } }); }
        break;
      }
      case 'chewSpit': { // 물고 씹다가 뱉는다
        const t = tgt(60); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.meleeStep(ctx, 30, t); stun(t, 1.3);
        every(0.3, 4, () => { if (!AT(t)) return false; E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'bite', elem: el }); F('burst', { x: t.x, y: t.y, r: 14, pal: 'blood', n: 7 }); H(t, op.mul); W.heal(W.d.maxHp * 0.01, 'skill'); },
          () => { if (!AT(t) || t.def.elite) return; const a = Math.atan2(p.aimY, p.aimX), hit = new Set([t.id]);
            every(0.03, 10, () => { const nx = t.x + Math.cos(a) * 11, ny = t.y + Math.sin(a) * 11; if (!AT(t) || W.blocked(nx, ny, t.r)) return false; t.x = nx; t.y = ny; for (const o of W.enemiesNear(t.x, t.y, t.r + 10)) if (!hit.has(o.id)) { hit.add(o.id); H(o, op.mul2); } }); });
        break;
      }
      case 'delayedCuts': { // 스치고 지나간 뒤 한꺼번에 벌어진다
        const x1 = p.x, y1 = p.y; p.invuln = Math.max(p.invuln, 0.3); dash(op.dist);
        later(0.22, () => { const L = segHits(x1, y1, p.x, p.y, 16); E({ t: 'danceDash', x1, y1, x2: p.x, y2: p.y });
          for (const e of L) { E({ t: 'inkBind', x: e.x, y: e.y, r: e.r, dur: 0.8 }); F('crack', { x1: e.x - 8, y1: e.y - 12, x2: e.x + 8, y2: e.y, pal: 'blood', dur: 0.8 }); }
          later(0.8, () => { for (const e of L) if (AT(e)) { E({ t: 'danceCut', x: e.x, y: e.y, ang: ang + 1.2 }); F('slash', { x: e.x, y: e.y, r: 15, ang: ang + 1.2, pal: 'blood' }); F('rays', { x: e.x, y: e.y, r: 18, pal: 'blood', n: 8 }); H(e, op.mul, { status: 'bleed', stacks: 2 }); } }); });
        break;
      }
      case 'blankPage': { // 가까운 적부터 차례로 지운다 · 갈수록 세다
        const end = rayEnd(ang, 160);
        const L = segHits(p.x, p.y, end.x, end.y, 12).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        E({ t: 'lineTele', x1: p.x, y1: p.y, x2: end.x, y2: end.y, dur: 0.6, w: 12 }); F('path', { x1: p.x, y1: p.y + 2, x2: end.x, y2: end.y + 2, pal: 'bone', dur: 1.2 });
        for (const e of L) E({ t: 'doomMark', id: e.id });
        L.forEach((e, i) => later(0.6 + i * 0.15, () => { if (!AT(e)) return; E({ t: 'inkBurst', x: e.x, y: e.y, r: e.r }); F('slash', { x: e.x, y: e.y, r: 12 + i * 2, ang: 0, spread: 0.01 + 1.2, pal: 'ink' }); F('rays', { x: e.x, y: e.y, r: 14 + i * 3, pal: 'ink', n: 6 + i }); H(e, op.mul * (1 + op.step * i)); }));
        break;
      }
      case 'bumperAura': { // 닿는 적을 튕겨 낸다
        p.buffs.oFluff = { t: op.dur, max: op.dur, mods: { dmgTakenMul: 0.75 }, name: '솜털 구름', color: '#f4f4ff' };
        const last = {};
        every(0.1, Math.round(op.dur / 0.1), (i) => { if (i % 4 === 0) E({ t: 'steamPuff', x: p.x, y: p.y }); for (const e of W.enemiesNear(p.x, p.y, 30)) { if ((last[e.id] || -9) > W.t - 0.4) continue; last[e.id] = W.t; H(e, op.mul); knock(e, p.x, p.y, 110); E({ t: 'bump', x: e.x, y: e.y }); F('rays', { x: e.x, y: e.y, r: 16, pal: 'steam', n: 7, ang: Math.atan2(e.y - p.y, e.x - p.x), spread: 1.8 }); } });
        break;
      }
      case 'tossOver': { // 뿔로 떠서 등 뒤로 넘긴다
        const t = tgt(50); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.meleeStep(ctx, 30, t); H(t, op.mul); F('slash', { x: t.x, y: t.y, r: 14, ang: -Math.PI / 2, spread: 2, pal: 'bone' }); F('rays', { x: t.x, y: t.y, r: 16, pal: 'earth', n: 6 });
        if (!AT(t) || t.def.elite || t.def.boss) { stun(t, 0.5); break; }
        const a = Math.atan2(t.y - p.y, t.x - p.x), q = W.groundPoint(p.x - Math.cos(a) * 50, p.y - Math.sin(a) * 50);
        E({ t: 'afterimage', x1: t.x, y1: t.y - 10, x2: q.x, y2: q.y - 10 });
        later(0.25, () => { if (!AT(t) || W.blocked(q.x, q.y, t.r)) return; t.x = q.x; t.y = q.y; t.kbx = t.kby = 0; stun(t, 0.5); E({ t: 'land', x: q.x, y: q.y, big: true }); F('burst', { x: q.x, y: q.y, r: 26, pal: 'earth', n: 12 }); F('crack', { x1: q.x - 14, y1: q.y + 2, x2: q.x + 14, y2: q.y + 3, pal: 'earth', dur: 0.8 }); for (const o of W.enemiesNear(q.x, q.y, 30)) if (o !== t) H(o, op.mul2); });
        break;
      }
      case 'rearSweep': { // 뒤를 크게 · 앞을 가볍게, 뒤의 적은 앞으로 퍼 넘긴다
        E({ t: 'spin', x: p.x, y: p.y, r: 90 }); F('slash', { x: p.x, y: p.y, r: 70, ang: ang + Math.PI, spread: 3, pal: 'earth', dur: 0.35 }); F('slash', { x: p.x, y: p.y, r: 42, ang, spread: 1.4, pal: 'earth', dur: 0.25 });
        for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y, dd = Math.hypot(dx, dy), front = dx * p.aimX + dy * p.aimY >= 0;
          if (!front && dd < 90 + e.r) { H(e, op.mul); if (AT(e) && !e.def.elite) { const q = W.groundPoint(p.x + p.aimX * 40 - dx * 0.2, p.y + p.aimY * 40 - dy * 0.2); if (!W.blocked(q.x, q.y, e.r)) { E({ t: 'afterimage', x1: e.x, y1: e.y, x2: q.x, y2: q.y }); e.x = q.x; e.y = q.y; } } }
          else if (front && dd < 60 + e.r) H(e, op.mul2); }
        break;
      }
      case 'tetherChain': { // 적끼리 이어 묶어 뭉친다
        const first = tgt(140); if (!first) break;
        const L = [first], seen = new Set([first.id]);
        while (L.length < 4) { const n = near(L[L.length - 1].x, L[L.length - 1].y, 110, seen); if (!n) break; seen.add(n.id); L.push(n); }
        { let q = { x: p.x, y: p.y - 6 }; for (const e of L) { F('tether', { x1: q.x, y1: q.y, x2: e.x, y2: e.y - 6, pal: 'poison', w: 2.2, wob: 4, dur: 2 }); q = { x: e.x, y: e.y - 6 }; } }
        for (const e of L) { H(e, op.mul, { status: 'chill', stacks: 1 }); if (AT(e)) e.st.slowZ = Math.max(e.st.slowZ || 0, 2); }
        every(0.25, 8, (i) => { const A = L.filter(AT); if (A.length === 1) { if (i % 2 === 1) { E({ t: 'inkBind', x: A[0].x, y: A[0].y, r: A[0].r, dur: 0.4 }); H(A[0], op.mul2 * 2); } return; } if (A.length < 2) return; const cx = A.reduce((s, e) => s + e.x, 0) / A.length, cy = A.reduce((s, e) => s + e.y, 0) / A.length;
          for (const e of A) pullTo(e, cx, cy, 0.12);
          if (i % 2 === 1) { for (let j = 1; j < A.length; j++) F('tether', { x1: A[j - 1].x, y1: A[j - 1].y - 6, x2: A[j].x, y2: A[j].y - 6, pal: 'poison', w: 2.4, wob: 2, dur: 0.5 }); for (const e of A) if (A.some((o) => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < e.r + o.r + 12)) { H(e, op.mul2); E({ t: 'bump', x: e.x, y: e.y }); } } });
        break;
      }
      case 'circleBite': { // 둘레를 돌며 문다
        const t = tgt(60); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        const a0 = Math.atan2(p.y - t.y, p.x - t.x);
        for (let i = 0; i < 3; i++) later(0.15 * i, () => { if (!AT(t)) return; const a = a0 + (i + 1) * Math.PI / 3, x1 = p.x, y1 = p.y;
          if (moveTo(t.x + Math.cos(a) * (t.r + 10), t.y + Math.sin(a) * (t.r + 10))) E({ t: 'afterimage', x1, y1, x2: p.x, y2: p.y });
          p.invuln = Math.max(p.invuln, 0.15); W.faceTo(t.x, t.y); E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'bite', elem: el }); F('path', { x1, y1: y1 + 2, x2: p.x, y2: p.y + 2, pal: 'ice', dur: 0.9 }); F('slash', { x: t.x, y: t.y, r: 18, ang: a + Math.PI, spread: 1.6, pal: 'ice', dur: 0.3 }); F('slash', { x: t.x, y: t.y + 3, r: 14, ang: a, spread: 1.4, pal: 'glass', dur: 0.3 }); F('burst', { x: t.x, y: t.y, r: 20, pal: 'ice', n: 10 }); F('spikes', { x: t.x, y: t.y, r: 10, n: 4, h: 10, pal: 'ice', dur: 0.5 }); H(t, op.mul, { status: 'bleed', stacks: 1 }); if (AT(t)) W.applyStatus(t, 'chill', 1); });
        break;
      }
      case 'latchOn': { // 매달려 할퀸다
        const t = tgt(60); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        const ox = Math.sign(p.x - t.x) || -1;
        p.invuln = Math.max(p.invuln, 1.25); E({ t: 'raptorLeap', x: p.x, y: p.y });
        every(0.2, 6, () => { if (!AT(t)) return false; p.x = t.x + ox * (t.r * 0.5); p.y = t.y - 2; W.faceTo(t.x, t.y); E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'claws', elem: el }); F('slash', { x: t.x, y: t.y, r: 11, ang: W.rng.range(0, 6.28), spread: 1.6, pal: 'blood' }); H(t, op.mul, { status: 'bleed', stacks: 1 }); },
          () => { if (AT(t)) H(t, op.mul2); const q = { x: p.x + ox * 60, y: p.y }; const x1 = p.x, y1 = p.y; if (moveTo(q.x, q.y)) { E({ t: 'afterimage', x1, y1, x2: p.x, y2: p.y }); E({ t: 'land', x: p.x, y: p.y }); } else if (W.blocked(p.x, p.y, 5) && t) { p.x = t.x + ox * (t.r + 8); } });
        break;
      }
      case 'caltropTrail': { // 숨어서 유리 조각을 흘린다
        p.stealthT = Math.max(p.stealthT || 0, 2); E({ t: 'stealthOn', x: p.x, y: p.y });
        for (const e of W.enemies) if (!e.dead && e.state === 'chase') { e.loseT = 2; e.windT = 0; }
        const bits = []; let lx = null, ly = null;
        const drop = (x, y) => { if (bits.length >= 10) return; const q = W.groundPoint(x, y); bits.push({ x: q.x, y: q.y, t: 4, used: false }); E({ t: 'spark', x: q.x, y: q.y, color: col }); F('path', { x1: q.x - 5, y1: q.y, x2: q.x + 5, y2: q.y + 1, pal: 'glass', dur: 4 }); };
        drop(p.x + p.aimX * 30, p.y + p.aimY * 30); drop(p.x + p.aimX * 46, p.y + p.aimY * 46 + 8);
        every(0.1, 60, (i) => { if (i < 20 && (lx === null || Math.hypot(p.x - lx, p.y - ly) > 14)) { drop(p.x, p.y); lx = p.x; ly = p.y; }
          for (const b of bits) { if (b.used || (b.t -= 0.1) <= 0) continue; const e = W.enemiesNear(b.x, b.y, 14)[0]; if (e) { b.used = true; E({ t: 'shatter', x: b.x, y: b.y }); F('spikes', { x: b.x, y: b.y, r: 8, n: 5, h: 12, pal: 'glass' }); H(e, op.mul, { status: 'bleed', stacks: 2 }); } }
          if (!bits.some((b) => !b.used && b.t > 0) && i >= 20) return false; });
        break;
      }
      case 'gnaw': { // 갉을수록 저주가 쌓인다
        const t = tgt(60); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        W.meleeStep(ctx, 30, t);
        every(0.15, 10, () => { if (!AT(t) || Math.hypot(t.x - p.x, t.y - p.y) > 70) return false; W.faceTo(t.x, t.y); E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'bite', elem: el }); F('slash', { x: t.x, y: t.y, r: 8, ang: W.rng.range(0, 6.28), spread: 1.6, pal: 'bone', dur: 0.18 }); F('rays', { x: t.x, y: t.y, r: 9, pal: 'curse', n: 4, dur: 0.2 }); H(t, op.mul, { status: 'curse', stacks: 1 }); F('mark', { x: t.x, y: t.y - 6, icon: 'skull', pal: 'curse', n: Math.min(5, t.st.curse?.n || 0), dur: 0.2 }); });
        break;
      }
      case 'hammerSteps': { // 한 걸음씩 세 번
        const count = {};
        op.muls.forEach((m, i) => later(0.28 * i, () => { const x1 = p.x, y1 = p.y; moveTo(p.x + p.aimX * 16, p.y + p.aimY * 16); E({ t: 'meleeStep', x1, y1, x2: p.x, y2: p.y });
          const cx = p.x + p.aimX * 26, cy = p.y + p.aimY * 26; E({ t: 'slam', x: cx, y: cy }); AOE(cx, cy, 28, 'slam', { lite: i < 2 }); if (i === 2) E({ t: 'shake', v: 4 }); F('burst', { x: cx, y: cy, r: 18 + i * 6, pal: 'earth', n: 8 + i * 3 }); F('crack', { x1: cx - p.aimY * (10 + i * 5), y1: cy + p.aimX * (10 + i * 5) + 2, x2: cx + p.aimY * (10 + i * 5), y2: cy - p.aimX * (10 + i * 5) + 2, pal: 'earth', dur: 0.9 });
          for (const e of W.enemiesNear(cx, cy, 28)) { H(e, m); count[e.id] = (count[e.id] || 0) + 1; if (i === 2 && count[e.id] === 3) stun(e, 1); } }));
        break;
      }
      case 'repairWound': { // 받은 피해를 적었다가 되돌린다
        const g = (p.origGuard = { k: 1, acc: 0, n: 0, until: W.t + op.dur });
        E({ t: 'parryStance', x: p.x, y: p.y, dur: op.dur });
        F('sigil', { x: p.x, y: p.y + 2, r: 20, n: 7, pal: 'metal', dur: op.dur });
        later(op.dur, () => { if (p.origGuard === g) p.origGuard = null; const back = g.acc * 0.6; F('rays', { x: p.x, y: p.y, r: 50, n: 12, pal: 'metal' }); if (back > 0) { W.heal(back, 'skill'); E({ t: 'rewind', pts: [[p.x, p.y - 10], [p.x, p.y]], x1: p.x, y1: p.y, x2: p.x, y2: p.y }); E({ t: 'text', x: p.x, y: p.y - 26, text: `되돌림 ${Math.round(back)}`, color: '#b98aff' }); }
          for (let i = 0; i < 6; i++) E({ t: 'spark', x: p.x + Math.cos(i) * 30, y: p.y + Math.sin(i) * 30, color: col }); AOE(p.x, p.y, 60, 'rune', { lite: true }); for (const e of W.enemiesNear(p.x, p.y, 60)) H(e, op.mul); });
        // 적어 두는 동안에도 가까운 적을 톱니로 (시험 · 혼자 쓸 때 맞히게)
        for (const e of W.enemiesNear(p.x, p.y, 40)) H(e, op.mul * 0.5);
        break;
      }
      case 'snowballRoll': { // 실린 적과 함께 굴러간다
        const a = ang, L = W.rayLen(p.x, p.y, a, 160), riders = []; let x = p.x + Math.cos(a) * 14, y = p.y + Math.sin(a) * 14, i = 0, n = Math.max(2, Math.floor(L / 12));
        every(0.04, n, () => { x += Math.cos(a) * 12; y += Math.sin(a) * 12; i++; if (i % 2 === 0) E({ t: 'steamPuff', x, y }); F('orb', { x, y, r: 6 + riders.length * 2, h: 6 + riders.length * 2, pal: 'ice', dur: 0.05 }); F('path', { x1: x - Math.cos(a) * 12, y1: y + 2 - Math.sin(a) * 12, x2: x, y2: y + 2, pal: 'ice', dur: 0.8 });
          E({ t: 'skillAoe', x, y, r: 10 + riders.length * 3, elem: el, fx: 'ice', lite: true });
          for (const e of W.enemiesNear(x, y, 12 + riders.length * 3)) { if (e.def.elite || e.def.boss) return false; if (!riders.includes(e)) riders.push(e); }
          for (const e of riders) if (AT(e) && !e.def.elite && !e.def.boss && !W.blocked(x, y, e.r)) { e.x = x; e.y = y; e.kbx = e.kby = 0; } },
          () => { const m = op.mul * (1 + 0.2 * riders.length); AOE(x, y, 40, 'ice'); E({ t: 'shatter', x, y }); F('burst', { x, y, r: 34, pal: 'ice', n: 14 }); for (const e of W.enemiesNear(x, y, 40)) H(e, m, { status: 'chill', stacks: 2 }); });
        break;
      }
      case 'groundPillars': { // 가까운 적부터 차례로 돌기둥
        E({ t: 'slam', x: p.x, y: p.y }); E({ t: 'shake', v: 3 });
        const L = W.enemiesNear(p.x, p.y, 100).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 8);
        L.forEach((e, i) => later(0.12 * (i + 1), () => { if (!AT(e)) return; E({ t: 'emerge', x: e.x, y: e.y }); AOE(e.x, e.y, 16, 'spikes', { lite: true }); F('wall', { x1: e.x - 7, y1: e.y + 3, x2: e.x + 7, y2: e.y + 3, h: 28, pal: 'earth', dur: 0.8 }); F('burst', { x: e.x, y: e.y, r: 16, pal: 'earth', n: 8 }); H(e, op.mul); stun(e, 0.4); }));
        break;
      }
      case 'petrify': { // 돌로 굳었다 깨며 터진다
        p.invuln = Math.max(p.invuln, 1.05); p.rootT = Math.max(p.rootT || 0, 1);
        p.buffs.oStone = { t: 1, max: 1, mods: { moveSpeed: 0.01 }, name: '돌', color: '#a8a8a0' };
        E({ t: 'skillAoe', x: p.x, y: p.y, r: 16, elem: el, fx: 'rocks', lite: true }); F('spikes', { x: p.x, y: p.y + 2, r: 13, n: 9, h: 16, pal: 'metal', dur: 1.05 });
        later(1, () => { E({ t: 'shatter', x: p.x, y: p.y }); AOE(p.x, p.y, 70, 'rocks'); F('burst', { x: p.x, y: p.y, r: 50, pal: 'metal', n: 16 }); E({ t: 'shake', v: 4 }); for (const e of W.enemiesNear(p.x, p.y, 70)) { H(e, op.mul); knock(e, p.x, p.y, 70); } });
        break;
      }
      case 'crownCommand': { // 무릎 꿇린 수만큼 세진다
        const L = W.enemiesNear(p.x, p.y, 140); AOE(p.x, p.y, 120, 'wind', { lite: true }); E({ t: 'shake', v: 3 }); F('mark', { x: p.x, y: p.y - 4, icon: 'crown', pal: 'gold', sc: 2, dur: 1.5 }); F('rays', { x: p.x, y: p.y, r: 80, pal: 'gold', n: 16 });
        let n = 0; for (const e of L) { H(e, op.mul); if (AT(e)) { stun(e, 1); E({ t: 'land', x: e.x, y: e.y }); F('rock', { x: e.x, y: e.y, r: 6, h: 50, pal: 'earth', dur: 0.35 }); F('mark', { x: e.x, y: e.y, icon: 'crown', pal: 'earth', dur: 1 }); n++; } }
        if (n) { const k = Math.min(0.24, 0.04 * n); p.buffs.oCrown = { t: 5, max: 5, mods: { dmgMul: 1 + k }, name: '돌 왕관', color: '#e0c070' }; E({ t: 'text', x: p.x, y: p.y - 26, text: `위엄 +${Math.round(k * 100)}%`, color: '#e0c070' }); }
        later(0.9, () => { for (const e of L) if (AT(e) && e.st.stun > 0) { E({ t: 'slam', x: e.x, y: e.y }); F('burst', { x: e.x, y: e.y, r: 20, pal: 'gold', n: 10 }); H(e, op.mul2); } });
        break;
      }
      case 'harpoonAnchor': { // 작살을 박고 날아간다
        const end = rayEnd(ang, 140), x1 = p.x, y1 = p.y, nx = -p.aimY, ny = p.aimX;
        F('tongue', { x1, y1: y1 - 6, x2: end.x, y2: end.y - 4, pal: 'metal', w: 1.6, wob: 1, dur: 0.35 }); F('burst', { x: end.x, y: end.y, r: 16, pal: 'metal', n: 8 });
        later(0.15, () => { const q = W.groundPoint(end.x - Math.cos(ang) * 8, end.y - Math.sin(ang) * 8); if (!moveTo(q.x, q.y)) return; p.invuln = Math.max(p.invuln, 0.2); E({ t: 'danceDash', x1, y1, x2: p.x, y2: p.y });
          for (const e of segHits(x1, y1, p.x, p.y, 14)) { H(e, op.mul); if (AT(e) && !e.def.elite) { const s = (e.x - x1) * nx + (e.y - y1) * ny >= 0 ? 1 : -1; e.kbx += nx * s * 160; e.kby += ny * s * 160; } }
          E({ t: 'land', x: p.x, y: p.y }); F('burst', { x: p.x, y: p.y, r: 24, pal: 'water', n: 12 }); F('gust', { x: x1, y: y1, r: Math.hypot(p.x - x1, p.y - y1), ang, n: 5, wide: 16, pal: 'water', dur: 0.35 }); for (const e of W.enemiesNear(p.x, p.y, 30)) H(e, op.mul2); });
        break;
      }
      case 'constellation': { // 별을 새기고 선으로 잇는다
        const L = W.enemiesNear(p.x, p.y, 160).slice(0, 5); if (!L.length) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        for (const e of L) { H(e, op.mul); F('star', { x: e.x, y: e.y, r: 7, h: 26, pal: 'holy', dur: 1.3 }); F('sigil', { x: e.x, y: e.y + 2, r: 10, n: 5, pal: 'fire', dur: 1.3 }); }
        later(1.2, () => { const pts = L.map((e) => (AT(e) ? { x: e.x, y: e.y } : { x: e.x, y: e.y }));
          for (let i = 1; i < pts.length; i++) { const A = pts[i - 1], B = pts[i]; E({ t: 'skillLine', x1: A.x, y1: A.y, x2: B.x, y2: B.y, w: 10, elem: el, fx: 'pillar' }); F('beam', { x1: A.x, y1: A.y - 26, x2: B.x, y2: B.y - 26, w: 3, pal: 'holy', dur: 0.5 }); F('crack', { x1: A.x, y1: A.y + 2, x2: B.x, y2: B.y + 2, pal: 'fire', dur: 0.9 }); for (const e of segHits(A.x, A.y, B.x, B.y, 10)) if (!L.includes(e)) H(e, op.mul3); }
          for (const q of pts) { AOE(q.x, q.y, 24, 'burst', { lite: pts.length > 2 }); F('pillar', { x: q.x, y: q.y, r: 18, h: 60, pal: 'fire', dur: 0.5 }); F('burst', { x: q.x, y: q.y, r: 22, pal: 'holy', n: 10 }); for (const e of W.enemiesNear(q.x, q.y, 24)) H(e, op.mul2); }
          E({ t: 'shake', v: 5 }); });
        break;
      }
      case 'wedgeHeat': { // 박힌 쐐기가 달궈져 녹아 터진다
        const mz = W.muzzle(ang); shoot(mz.x, mz.y, ang, 280, 180, 'knife', (e) => {
          H(e, op.mul); F('mark', { x: e.x, y: e.y + 6, icon: 'brand', pal: 'metal', dur: 3 });
          every(1, 3, () => { if (!AT(e)) return false; W.applyStatus(e, 'burn', 1); E({ t: 'emberPop', x: e.x, y: e.y - 4 }); F('mark', { x: e.x, y: e.y + 6, icon: 'brand', pal: 'fire', dur: 1 }); F('rays', { x: e.x, y: e.y, r: 12, pal: 'fire', n: 6 }); },
            () => { const n = e.st.burn?.n || 0, x = e.x, y = e.y; AOE(x, y, 40, 'burst'); F('burst', { x, y, r: 36, pal: 'fire', n: 16 }); F('splat', { x, y: y + 2, r: 24, pal: 'lava', dur: 1.2, bubble: true }); for (const o of W.enemiesNear(x, y, 40)) H(o, op.per * Math.max(1, n)); });
        }, { color: '#ff9040', skin: 'shard', pal: 'metal' });
        break;
      }
      case 'emberHop': { // 땅을 튀며 나아가는 불씨
        const hops = [30, 40, 50, 60]; let d = 0, x0 = p.x, y0 = p.y;
        hops.forEach((h, i) => { d += h; const dd = Math.min(d, W.rayLen(x0, y0, ang, d)); const q = W.groundPoint(x0 + Math.cos(ang) * dd, y0 + Math.sin(ang) * dd);
          E({ t: 'skillFall', x: q.x, y: q.y, r: 24, dur: 0.18 * (i + 1), fx: 'burst', elem: el });
          later(0.18 * (i + 1), () => { E({ t: 'emberPop', x: q.x, y: q.y }); AOE(q.x, q.y, 24, 'burst', { lite: i < 3 }); F('orb', { x: q.x, y: q.y, r: 4, h: 6, pal: 'fire', dur: 0.18 }); F('burst', { x: q.x, y: q.y, r: 18 + i * 3, pal: 'fire', n: 8 }); F('splat', { x: q.x, y: q.y + 2, r: 10, pal: 'lava', dur: 0.8 }); for (const e of W.enemiesNear(q.x, q.y, 24)) H(e, op.mul, { status: 'burn', stacks: 1 }); }); });
        break;
      }
      case 'burningGlyphs': { // 글자 셋 → 타오르는 문장
        const c = aimAt(130), pts = [0, 1, 2].map((i) => W.groundPoint(c.x + Math.cos(ang + i * 2.094) * 34, c.y + Math.sin(ang + i * 2.094) * 34));
        pts.forEach((q, i) => later(0.3 * i, () => { F('glyph', { x: q.x, y: q.y, r: 6, pal: 'fire', dur: 1.1 - 0.3 * i }); F('sigil', { x: q.x, y: q.y + 2, r: 14, n: 5, pal: 'fire', dur: 1.1 - 0.3 * i }); AOE(q.x, q.y, 30, 'rune', { lite: true }); for (const e of W.enemiesNear(q.x, q.y, 30)) H(e, op.mul); }));
        later(0.9, () => { for (let i = 0; i < 3; i++) { const A = pts[i], B = pts[(i + 1) % 3]; E({ t: 'skillLine', x1: A.x, y1: A.y, x2: B.x, y2: B.y, w: 8, elem: el, fx: 'pillar' }); F('crack', { x1: A.x, y1: A.y + 2, x2: B.x, y2: B.y + 2, pal: 'fire', dur: 1 }); F('spikes', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, n: 5, h: 16, pal: 'fire', dur: 0.6 }); } AOE(c.x, c.y, 55, 'burst'); F('pillar', { x: c.x, y: c.y, r: 30, h: 70, pal: 'fire', dur: 0.6 }); F('burst', { x: c.x, y: c.y, r: 50, pal: 'fire', n: 18 }); E({ t: 'shake', v: 4 }); for (const e of W.enemiesNear(c.x, c.y, 55)) H(e, op.mul2); });
        break;
      }
      case 'reflectShots': { // 날아오는 탄을 되쏜다
        E({ t: 'skillCone', x: p.x, y: p.y, ang, range: 70, angle: 1.4, elem: el, fx: 'parry' }); { const cx = p.x + Math.cos(ang) * 16, cy = p.y + Math.sin(ang) * 16 + 4, nx = -Math.sin(ang) * 12, ny = Math.cos(ang) * 12; F('wall', { x1: cx - nx, y1: cy - ny, x2: cx + nx, y2: cy + ny, h: 18, pal: 'glass', dur: 1.5 }); F('rays', { x: cx, y: cy - 4, r: 60, ang, spread: 1.4, n: 9, pal: 'glass' }); }
        for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y; let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.hypot(dx, dy) < 70 + e.r && Math.abs(da) < 0.85) H(e, op.mul, { status: 'curse', stacks: 1 }); }
        every(0.05, 30, () => { for (const pr of W.projs) { if (pr.owner !== 'e' || Math.hypot(pr.x - p.x, pr.y - p.y) > 80) continue; const a = pr.src && !pr.src.dead ? Math.atan2(pr.src.y - pr.y, pr.src.x - pr.x) : Math.atan2(-pr.vy, -pr.vx), sp = Math.max(160, Math.hypot(pr.vx, pr.vy));
          E({ t: 'deflect', x: pr.x, y: pr.y }); F('rays', { x: pr.x, y: pr.y + 6, r: 14, pal: 'glass', n: 7 }); pr.life = 0; shoot(pr.x, pr.y, a, sp, 200, 'skill', (e) => H(e, op.mul2), { color: '#d8c8ff', skin: 'wisp', pal: 'shadow' }); } });
        break;
      }
      case 'glideLine': { // 천천히 활공하며 깃털을 떨군다
        const a = ang, L = W.rayLen(p.x, p.y, a, op.dist); p.invuln = Math.max(p.invuln, 1.05); E({ t: 'soarUp', x: p.x, y: p.y }); F('wing', { x: p.x, y: p.y, r: 30, ang: -Math.PI / 2, n: 7, spread: 2.8, pal: 'holy', dur: 0.5 });
        every(0.05, 20, (i) => { const x1 = p.x, y1 = p.y; moveTo(p.x + Math.cos(a) * L / 20, p.y + Math.sin(a) * L / 20); if (i % 2 === 1) F('wing', { x: p.x, y: p.y - 4, r: 24, ang: -Math.PI / 2, n: 6, spread: 2.6, pal: 'holy', dur: 0.15 }); if (i % 4 === 3) { E({ t: 'afterimage', x1, y1, x2: p.x, y2: p.y }); AOE(p.x, p.y, 40, 'holy', { lite: true }); for (let j = 0; j < 3; j++) F('path', { x1: p.x - 6 + j * 6, y1: p.y + 2, x2: p.x - 4 + j * 6, y2: p.y + 4, pal: 'holy', dur: 0.8 }); F('rays', { x: p.x, y: p.y + 4, r: 34, pal: 'holy', n: 8, ang: Math.PI / 2, spread: 2.4 }); for (const e of W.enemiesNear(p.x, p.y, 40)) H(e, op.mul); } },
          () => { E({ t: 'land', x: p.x, y: p.y }); W.heal(W.d.maxHp * 0.02, 'skill'); });
        break;
      }
      case 'heatClaws': { // 할퀼수록 뜨겁다
        const t = tgt(60); if (t) W.meleeStep(ctx, 34, t);
        for (let i = 0; i < 3; i++) later(0.15 * i, () => { const a = Math.atan2(p.aimY, p.aimX); E({ t: 'skillCone', x: p.x, y: p.y, ang: a + (i - 1) * 0.3, range: 44, angle: 1.4, elem: el, fx: 'claws' }); for (let j = 0; j < 3; j++) F('slash', { x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14 + (j - 1) * 4, r: 22, ang: a + (i - 1) * 0.3 + (i % 2 ? 0.5 : -0.5), spread: 1.3, pal: i === 2 ? 'lava' : 'fire', dur: 0.22 });
          for (const e of W.enemies) { if (!AT(e)) continue; const dx = e.x - p.x, dy = e.y - p.y; let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.hypot(dx, dy) < 44 + e.r && Math.abs(da) < 0.8) { const m = i === 2 && e.st.burn ? op.mul * 1.5 : op.mul; H(e, m); if (AT(e) && i === 2) W.applyStatus(e, 'burn', 1); } } });
        break;
      }
      case 'slimeReturn': { // 사방으로 흩어졌다 되돌아온다
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + ang, L = W.rayLen(p.x, p.y, a, 90), ex = p.x + Math.cos(a) * L, ey = p.y + Math.sin(a) * L;
          shoot(p.x, p.y - 4, a, 200, L, 'plague', (e) => H(e, op.mul), { color: '#a8e0f0', pierce: 3, skin: 'glob', pal: 'glass' });
          later(1, () => { const b = Math.atan2(p.y - ey, p.x - ex), d = Math.hypot(p.x - ex, p.y - ey); shoot(ex, ey, b, 220, Math.max(20, d), 'plague', (e) => H(e, op.mul2), { color: '#d0f4ff', pierce: 3, skin: 'glob', pal: 'glass' }); }); }
        F('burst', { x: p.x, y: p.y, r: 22, pal: 'glass', n: 6 });
        break;
      }
      case 'frozenHeart': { // 냉기를 쌓았다가 중첩만큼 터진다
        E({ t: 'skillAoe', x: p.x, y: p.y, r: 90, elem: el, fx: 'ice', lite: true }); F('swirl', { x: p.x, y: p.y, r: 80, n: 5, pal: 'ice', dur: 2 }); F('orb', { x: p.x, y: p.y, r: 4, h: 14, pal: 'ice', dur: 2 });
        every(0.5, 4, () => { for (const e of W.enemiesNear(p.x, p.y, 90)) { H(e, op.mul, { status: 'chill', stacks: 1 }); F('spikes', { x: e.x, y: e.y, r: 8, n: 3, h: 8, pal: 'ice', dur: 0.5 }); } F('rays', { x: p.x, y: p.y, r: 24, pal: 'ice', n: 6, dur: 0.25 }); },
          () => { AOE(p.x, p.y, 90, 'shatter'); E({ t: 'shake', v: 5 }); for (const e of W.enemiesNear(p.x, p.y, 90)) { const n = e.st.chill?.n || 0; H(e, op.mul2 * (1 + 0.25 * n)); if (AT(e)) e.st.frozen = Math.max(e.st.frozen || 0, e.def.boss ? 0.3 : 1); E({ t: 'shatter', x: e.x, y: e.y }); F('burst', { x: e.x, y: e.y, r: 16 + n * 3, pal: 'ice', n: 8 }); } F('spikes', { x: p.x, y: p.y, r: 80, n: 18, h: 22, pal: 'ice', dur: 0.8 }); F('burst', { x: p.x, y: p.y, r: 60, pal: 'glass', n: 20 }); });
        break;
      }
      case 'starMap': { // 별 다섯이 차례로 떨어진다
        const c = aimAt(140), first = near(c.x, c.y, 80);
        for (let i = 0; i < 5; i++) { const q = i === 0 && first ? { x: first.x, y: first.y } : W.groundPoint(c.x + W.rng.range(-80, 80) * 0.7, c.y + W.rng.range(-80, 80) * 0.7);
          E({ t: 'skillFall', x: q.x, y: q.y, r: 24, dur: 0.35 + 0.2 * i, fx: 'burst', elem: el }); F('star', { x: q.x, y: q.y, r: 5, h: 60, pal: 'holy', dur: 0.35 + 0.2 * i });
          later(0.35 + 0.2 * i, () => { AOE(q.x, q.y, 24, 'burst', { lite: i < 4 }); E({ t: 'emberPop', x: q.x, y: q.y }); F('pillar', { x: q.x, y: q.y, r: 14, h: 50, pal: 'fire', dur: 0.4 }); F('burst', { x: q.x, y: q.y, r: 24, pal: 'holy', n: 12 }); for (const e of W.enemiesNear(q.x, q.y, 24)) H(e, op.mul); }); }
        break;
      }
      // ── 3묶음 ──
      case 'flankArchers': { // 양옆 환영 궁수가 함께 쏜다
        const sx = -p.aimY, sy = p.aimX, A = [-1, 1].map((s) => W.groundPoint(p.x + sx * 30 * s, p.y + sy * 30 * s));
        for (const q of A) E({ t: 'afterimage', x1: p.x, y1: p.y, x2: q.x, y2: q.y });
        every(0.3, 4, () => { const t = near(p.x, p.y, 200); for (const q of A) { E({ t: 'afterimage', x1: q.x, y1: q.y, x2: q.x + 1, y2: q.y }); const a = t ? Math.atan2(t.y - q.y, t.x - q.x) : ang; F('rays', { x: q.x + Math.cos(a) * 8, y: q.y + Math.sin(a) * 8, r: 12, ang: a, spread: 1, n: 5, pal: 'shadow' }); shoot(q.x, q.y - 4, a, 300, 200, 'arrow', (e) => { H(e, op.mul); F('rays', { x: e.x, y: e.y, r: 12, pal: 'shadow', n: 6 }); }, { color: '#a890e0', skin: 'thorn', pal: 'shadow' }); } });
        break;
      }
      case 'skewerPin': { // 첫 적을 꿰어 끝까지 끌고 가 박는다
        const end = rayEnd(ang, 170), mz = W.muzzle(ang); let carried = null, arrow = null;
        shoot(mz.x, mz.y, ang, 320, end.L, 'arrow', (e) => { if (!carried && !e.def.elite && !e.def.boss) { carried = e; H(e, op.mul); } else H(e, carried ? op.mul2 : op.mul); F('rays', { x: e.x, y: e.y, r: 12, pal: 'blood', n: 5 }); }, { pierce: 9, skin: 'arrow', pal: 'metal' });
        arrow = W.projs[W.projs.length - 1];
        every(0.02, Math.ceil(end.L / 320 / 0.02), () => { if (carried && AT(carried) && arrow.life > 0) { moveE(carried, arrow.x, arrow.y + 4); } },
          () => { if (!AT(carried)) return; stun(carried, 1.2); E({ t: 'collide', x: carried.x, y: carried.y }); E({ t: 'shake', v: 3 }); F('burst', { x: carried.x, y: carried.y, r: 24, pal: 'metal', n: 12 }); F('mark', { x: carried.x, y: carried.y + 4, icon: 'brand', pal: 'metal', dur: 1.2 }); H(carried, op.mul2); });
        break;
      }
      case 'steamVent': { // 압력을 모았다가 증기를 뿜는다
        p.buffs.oPress = { t: 0.8, max: 0.8, mods: { dmgTakenMul: 0.75, moveSpeed: 0.5 }, name: '압력', color: '#e0e0e0' };
        E({ t: 'steamPuff', x: p.x, y: p.y - 6 }); F('pillar', { x: p.x, y: p.y, r: 10, h: 26, pal: 'steam', dur: 0.8 });
        later(0.8, () => every(0.1, 6, () => { const a = Math.atan2(p.aimY, p.aimX); E({ t: 'skillCone', x: p.x, y: p.y, ang: a, range: 90, angle: 1, elem: el, fx: 'smoke' }); F('rays', { x: p.x + Math.cos(a) * 10, y: p.y + Math.sin(a) * 10, r: 80, ang: a, spread: 1, n: 7, pal: 'steam', dur: 0.14 }); E({ t: 'steamPuff', x: p.x + Math.cos(a) * 40, y: p.y + Math.sin(a) * 40 });
          for (const e of coneHits(a, 90, 0.5)) { H(e, op.mul, { status: 'burn', stacks: 1 }); knock(e, p.x, p.y, 25); } }));
        break;
      }
      case 'launchSlam': { // 증기로 몸을 쏘아 올려 내리꽂는다
        const c = aimAt(160), x0 = p.x, y0 = p.y;
        AOE(x0, y0, 50, 'smoke'); E({ t: 'steamPuff', x: x0, y: y0 }); F('pillar', { x: x0, y: y0, r: 26, h: 70, pal: 'steam', dur: 0.6 }); F('burst', { x: x0, y: y0, r: 40, pal: 'steam', n: 12 }); F('trap', { x: c.x, y: c.y, r: 20, n: 10, pal: 'fire', dur: 0.6 }); for (const e of W.enemiesNear(x0, y0, 50)) { H(e, op.mul); knock(e, x0, y0, 40); }
        p.invuln = Math.max(p.invuln, 0.75); E({ t: 'soarUp', x: x0, y: y0 }); E({ t: 'skillFall', x: c.x, y: c.y, r: 80, dur: 0.6, fx: 'quake', elem: el });
        later(0.6, () => { moveTo(c.x, c.y); E({ t: 'land', x: p.x, y: p.y }); E({ t: 'slam', x: p.x, y: p.y }); AOE(p.x, p.y, 80, 'quake'); E({ t: 'shake', v: 8 }); F('burst', { x: p.x, y: p.y, r: 70, pal: 'fire', n: 20 }); for (let j = 0; j < 6; j++) { const a = j * 1.047 + 0.3; F('crack', { x1: p.x, y1: p.y + 2, x2: p.x + Math.cos(a) * 60, y2: p.y + 2 + Math.sin(a) * 36, pal: 'lava', dur: 1.2 }); } F('pillar', { x: p.x, y: p.y, r: 30, h: 40, pal: 'steam', dur: 0.6 });
          for (const e of W.enemiesNear(p.x, p.y, 80)) { H(e, op.mul2, { status: 'burn', stacks: 2 }); stun(e, 1); } });
        break;
      }
      case 'mossMask': { // 이끼를 붙여 칠 때마다 회복 · 끝에 조인다
        const L = W.enemiesNear(p.x, p.y, 110); AOE(p.x, p.y, 110, 'wind', { lite: true }); E({ t: 'shake', v: 2 }); F('rays', { x: p.x, y: p.y, r: 70, pal: 'slime', n: 14 });
        for (const e of L) { H(e, op.mul); if (AT(e)) { F('splat', { x: e.x, y: e.y + 2, r: e.r + 6, pal: 'slime', dur: 4 }); F('tether', { x1: p.x, y1: p.y - 8, x2: e.x, y2: e.y - 6, pal: 'slime', w: 1.6, wob: 5, dur: 0.4 }); } }
        const hp0 = new Map(L.map((e) => [e, e.hp]));
        every(0.2, 20, () => { for (const e of L) { if (!AT(e)) continue; if (e.hp < hp0.get(e) - 1) W.heal(W.d.maxHp * 0.005, 'skill'); hp0.set(e, e.hp); } },
          () => { for (const e of L) { if (!AT(e)) continue; E({ t: 'skillSingle', x: e.x, y: e.y, fx: 'trap', elem: el }); F('fist', { x: e.x, y: e.y + 8, r: 16, ang: -Math.PI / 2, n: 5, spread: 1.4, pal: 'slime', dur: 0.6 }); H(e, op.mul2); e.rooted = Math.max(e.rooted || 0, 1); } });
        break;
      }
      case 'liftSlab': { // 땅판을 들었다 덮어 찍는다
        const c = aimAt(120), L = W.enemiesNear(c.x, c.y, 50);
        E({ t: 'skillAoe', x: c.x, y: c.y, r: 50, elem: el, fx: 'rocks', lite: true }); E({ t: 'shake', v: 3 }); F('crack', { x1: c.x - 46, y1: c.y + 2, x2: c.x + 46, y2: c.y + 4, pal: 'earth', dur: 1.4 }); F('column', { x: c.x - 40, y: c.y + 4, ang: 0, len: 80, w: 14, pal: 'earth', dur: 0.8 }); F('burst', { x: c.x, y: c.y, r: 30, pal: 'earth', n: 10 });
        for (const e of L) { H(e, op.mul); stun(e, 0.8); }
        later(0.8, () => { AOE(c.x, c.y, 50, 'quake'); E({ t: 'slam', x: c.x, y: c.y }); E({ t: 'shake', v: 6 }); F('splat', { x: c.x, y: c.y + 2, r: 46, pal: 'earth', dur: 1 }); F('burst', { x: c.x, y: c.y, r: 56, pal: 'earth', n: 18 }); F('spikes', { x: c.x, y: c.y, r: 50, n: 10, h: 12, pal: 'earth', dur: 0.6 });
          for (const e of W.enemiesNear(c.x, c.y, 50)) H(e, op.mul2); for (const e of W.enemiesNear(c.x, c.y, 85)) if (Math.hypot(e.x - c.x, e.y - c.y) > 40) knock(e, c.x, c.y, 60); });
        break;
      }
      case 'sandSlow': { // 흘러내리는 모래가 갈수록 무겁고 끝에 멈춘다
        const c = aimAt(140); E({ t: 'skillFall', x: c.x, y: c.y, r: 80, dur: 3, fx: 'wind', elem: el }); F('swirl', { x: c.x, y: c.y, r: 70, n: 6, ccw: true, pal: 'sand', dur: 3.1 }); F('pillar', { x: c.x, y: c.y, r: 10, h: 70, pal: 'sand', dur: 3 });
        every(0.5, 6, (i) => { AOE(c.x, c.y, 80, 'wind', { lite: i < 5 }); for (const e of W.enemiesNear(c.x, c.y, 80)) { H(e, op.mul); if (!AT(e)) continue; e.st.slowZ = Math.max(e.st.slowZ || 0, 1); if (i === 5) { e.st.frozen = Math.max(e.st.frozen || 0, e.def.boss ? 0.4 : 1.5); E({ t: 'text', x: e.x, y: e.y - 20, text: '멈춤', color: '#f0d890' }); F('spikes', { x: e.x, y: e.y, r: 9, n: 6, h: 12, pal: 'sand' }); } } });
        break;
      }
      case 'timeDebt': { // 멈춘 동안 받은 피해를 한꺼번에 다시
        const L = W.enemiesNear(p.x, p.y, 130); AOE(p.x, p.y, 130, 'ice', { lite: true }); F('sigil', { x: p.x, y: p.y + 2, r: 60, n: 6, pal: 'gold', dur: 2 }); F('rays', { x: p.x, y: p.y, r: 60, pal: 'glass', n: 12 });
        const hp0 = new Map(); for (const e of L) { H(e, op.mul); if (AT(e)) { e.st.frozen = Math.max(e.st.frozen || 0, e.def.boss ? 0.5 : 2); hp0.set(e, e.hp); F('mark', { x: e.x, y: e.y, icon: 'clock', pal: 'gold', dur: 2 }); } }
        later(2, () => { E({ t: 'rewind', x: p.x, y: p.y }); E({ t: 'shake', v: 6 }); for (const [e, h] of hp0) { if (!AT(e)) continue; const debt = Math.max(0, h - e.hp); E({ t: 'shatter', x: e.x, y: e.y }); F('burst', { x: e.x, y: e.y, r: 20 + Math.min(20, debt / Math.max(1, ctx.atk) * 4), pal: 'gold', n: 12 }); F('slash', { x: e.x, y: e.y, r: 14, ang: 0.8, spread: 2, pal: 'glass' }); H(e, op.mul2 + Math.min(4, debt * 0.6 / Math.max(1, ctx.atk))); } });
        break;
      }
      case 'curseSpread': { // 저주탄 → 저주가 둘레로 옮는다
        const mz = W.muzzle(ang);
        shoot(mz.x, mz.y, ang, 260, 180, 'skill', (e) => { H(e, op.mul, { status: 'curse', stacks: 2 }); const n = Math.min(6, e.st.curse?.n || 2); F('sigil', { x: e.x, y: e.y + 2, r: 14, pal: 'curse', dur: 1 }); F('rays', { x: e.x, y: e.y, r: 16, pal: 'curse', n: 7 });
          for (const o of W.enemiesNear(e.x, e.y, 80)) if (o !== e) { E({ t: 'linkPulse', x1: e.x, y1: e.y - 6, x2: o.x, y2: o.y - 6 }); F('tether', { x1: e.x, y1: e.y - 6, x2: o.x, y2: o.y - 6, pal: 'curse', w: 1.6, wob: 4, dur: 0.35 }); H(o, op.mul2, { status: 'curse', stacks: n }); } }, { color: '#9a5cff', skin: 'wisp', pal: 'curse' });
        break;
      }
      case 'boneCage': { // 뼈 우리에 가두고 닫힐 때 파편
        const t = tgt(140); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        E({ t: 'skillAoe', x: t.x, y: t.y, r: 22, elem: el, fx: 'bones', lite: true }); F('cage', { x: t.x, y: t.y + 2, r: t.r + 8, n: 8, h: 26, pal: 'bone', dur: 2 }); F('splat', { x: t.x, y: t.y + 2, r: t.r + 10, pal: 'shadow', dur: 2 }); H(t, op.mul); stun(t, 2);
        every(0.5, 4, () => { if (!AT(t)) return false; F('rays', { x: t.x, y: t.y, r: 12, pal: 'bone', n: 5, dur: 0.2 }); H(t, op.mul * 0.5); },
          () => { const x = t.x, y = t.y; AOE(x, y, 60, 'bones'); E({ t: 'shatter', x, y }); F('burst', { x, y, r: 50, pal: 'bone', n: 18 }); for (let j = 0; j < 8; j++) { const a = j * 0.785; shoot(x, y - 6, a, 200, 60, 'icerock', () => {}, { skin: 'bone', pal: 'bone' }); } for (const e of W.enemiesNear(x, y, 60)) H(e, op.mul2); });
        break;
      }
      case 'crossRake': { // 앞 · 옆 · 뒤 · 옆 네 갈래
        [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((d, i) => later(0.1 * i, () => { const a = Math.atan2(p.aimY, p.aimX) + d; E({ t: 'skillCone', x: p.x, y: p.y, ang: a, range: 55, angle: 1.3, elem: el, fx: 'claws' }); for (let j = 0; j < 3; j++) F('slash', { x: p.x + Math.cos(a) * 12 - Math.sin(a) * (j - 1) * 5, y: p.y + Math.sin(a) * 12 + Math.cos(a) * (j - 1) * 5, r: 26, ang: a, spread: 1.2, pal: 'blood', dur: 0.24 });
          for (const e of coneHits(a, 55, 0.7)) H(e, op.mul, { status: 'bleed', stacks: 1 }); }));
        break;
      }
      case 'bellToll': { // 가라앉은 종이 세 번 운다
        const c = aimAt(130); E({ t: 'skillFall', x: c.x, y: c.y, r: 20, dur: 0.3, fx: 'slam', elem: el }); F('bell', { x: c.x, y: c.y, r: 12, h: 34, pal: 'metal', dur: 2 }); F('splat', { x: c.x, y: c.y + 2, r: 30, pal: 'water', dur: 2.2 });
        [0.3, 1.0, 1.7].forEach((t, i) => later(t, () => { const r = 50 + i * 20; AOE(c.x, c.y, r, 'fog', { lite: i < 2 }); E({ t: 'shake', v: 2 + i }); F('rays', { x: c.x, y: c.y - 14, r: r * 0.8, pal: 'poison', n: 12 + i * 4 }); F('splat', { x: c.x, y: c.y + 2, r: r * 0.85, pal: 'poison', dur: 0.8, bubble: true });
          for (const e of W.enemiesNear(c.x, c.y, r)) { const had = !!e.st.poison; H(e, op.mul, { status: had ? 'curse' : 'poison', stacks: 2 }); } }));
        break;
      }
      case 'wristLock': { // 다음 공격을 잡아 비틀어 넘긴다
        const g = (p.origGuard = { k: 0.2, acc: 0, n: 0, until: W.t + 0.9 }); E({ t: 'parryStance', x: p.x, y: p.y, dur: 0.9 }); F('fist', { x: p.x, y: p.y, r: 16, ang, n: 4, spread: 0.9, pal: 'earth', dur: 0.9 });
        let done = false;
        const flip = (caught) => { if (done) return; done = true; if (p.origGuard === g) p.origGuard = null; const t = near(p.x, p.y, 70); if (!t) return; const a = Math.atan2(t.y - p.y, t.x - p.x);
          E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'parry', elem: el }); E({ t: 'thud', x: t.x, y: t.y }); F('slash', { x: t.x, y: t.y, r: 16, ang: a - Math.PI / 2, spread: 3, pal: caught ? 'gold' : 'earth', dur: 0.35 }); F('burst', { x: p.x - Math.cos(a) * 20, y: p.y - Math.sin(a) * 20, r: caught ? 28 : 16, pal: 'earth', n: caught ? 14 : 8 }); H(t, caught ? op.mul2 : op.mul); stun(t, caught ? 1.2 : 0.4);
          if (!t.def.elite && !t.def.boss) moveE(t, p.x - Math.cos(a) * 20, p.y - Math.sin(a) * 20); };
        every(0.05, 18, () => { if (g.n > 0) { flip(true); return false; } }, () => flip(false));
        break;
      }
      case 'holyCross': { // 가로 · 세로 빛 기둥, 교차점에선 회복
        const c = aimAt(120);
        for (const a of [ang, ang + Math.PI / 2]) { const x1 = c.x - Math.cos(a) * 80, y1 = c.y - Math.sin(a) * 80, x2 = c.x + Math.cos(a) * 80, y2 = c.y + Math.sin(a) * 80; E({ t: 'lineTele', x1, y1, x2, y2, dur: 0.5 }); F('crack', { x1, y1: y1 + 2, x2, y2: y2 + 2, pal: 'holy', dur: 0.6 });
          later(0.5, () => { E({ t: 'skillLine', x1, y1, x2, y2, w: 12, elem: el, fx: 'pillar' }); F('beam', { x1, y1: y1 - 6, x2, y2: y2 - 6, w: 7, pal: 'holy', dur: 0.45 }); F('spikes', { x1, y1, x2, y2, n: 8, h: 14, pal: 'holy', dur: 0.5 }); for (const e of segHits(x1, y1, x2, y2, 12)) H(e, op.mul); }); }
        later(0.55, () => { AOE(c.x, c.y, 24, 'holy'); F('pillar', { x: c.x, y: c.y, r: 24, h: 80, pal: 'holy', dur: 0.6 }); F('burst', { x: c.x, y: c.y, r: 36, pal: 'holy', n: 16 }); if (Math.hypot(p.x - c.x, p.y - c.y) < 30) W.heal(W.d.maxHp * 0.05, 'skill'); for (const e of W.enemiesNear(c.x, c.y, 24)) H(e, op.mul2); });
        break;
      }
      case 'darkSnuff': { // 빛을 꺼 눈멀게 하고 어둠이 조인다
        const L = W.enemiesNear(p.x, p.y, 140); AOE(p.x, p.y, 140, 'dark', { lite: true }); F('swirl', { x: p.x, y: p.y, r: 110, n: 6, ccw: true, pal: 'ink', dur: 2.5 }); F('orb', { x: p.x, y: p.y, r: 4, h: 22, pal: 'holy', dur: 0.3 });
        for (const e of L) { F('splat', { x: e.x, y: e.y + 2, r: e.r + 8, pal: 'ink', dur: 2.5 }); F('mark', { x: e.x, y: e.y, icon: 'brand', pal: 'ink', dur: 2.5 }); H(e, op.mul, { status: 'curse', stacks: 3 }); if (AT(e)) { e.loseT = Math.max(e.loseT || 0, 2.5); e.windT = 0; } }
        later(2.5, () => { for (const e of L) { if (!AT(e)) continue; const n = e.st.curse?.n || 0; E({ t: 'inkBurst', x: e.x, y: e.y }); F('fist', { x: e.x, y: e.y + 6, r: 20, ang: -Math.PI / 2, n: 6, spread: 2.4, pal: 'ink', dur: 0.5 }); H(e, op.mul2 * (1 + 0.1 * n)); } E({ t: 'shake', v: 5 }); });
        break;
      }
      case 'toppleColumn': { // 기둥을 쓰러뜨린다
        const end = rayEnd(ang, 130); E({ t: 'lineTele', x1: p.x, y1: p.y, x2: end.x, y2: end.y, dur: 0.6 }); F('column', { x: p.x + Math.cos(ang) * 8, y: p.y + Math.sin(ang) * 8, ang, len: end.L - 8, w: 9, pal: 'earth', dur: 1.5 });
        later(0.6, () => { E({ t: 'skillLine', x1: p.x, y1: p.y, x2: end.x, y2: end.y, w: 16, elem: el, fx: 'rocks' }); E({ t: 'shake', v: 6 }); F('crack', { x1: p.x, y1: p.y + 2, x2: end.x, y2: end.y + 2, pal: 'earth', dur: 1.2 }); F('burst', { x: end.x, y: end.y, r: 32, pal: 'earth', n: 14 });
          for (const e of segHits(p.x, p.y, end.x, end.y, 16)) { H(e, op.mul); stun(e, 1); }
          E({ t: 'shatter', x: end.x, y: end.y }); for (const e of W.enemiesNear(end.x, end.y, 45)) H(e, op.mul2); });
        break;
      }
      case 'shieldPush': { // 방패를 내밀고 계속 밀며 걷는다
        p.buffs.oPush = { t: 1.2, max: 1.2, mods: { dmgTakenMul: 0.6, moveSpeed: 0.7 }, name: '밀고 가기', color: '#c8c8d8' };
        const walled = new Set();
        every(0.1, 12, (i) => { const a = Math.atan2(p.aimY, p.aimX); moveTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6); if (i % 3 === 0) { E({ t: 'rushDust', x: p.x, y: p.y, dx: Math.cos(a) }); F('wall', { x1: p.x + Math.cos(a) * 16 - Math.sin(a) * 12, y1: p.y + Math.sin(a) * 16 + Math.cos(a) * 12 + 4, x2: p.x + Math.cos(a) * 16 + Math.sin(a) * 12, y2: p.y + Math.sin(a) * 16 - Math.cos(a) * 12 + 4, h: 16, pal: 'metal', dur: 0.32 }); }
          for (const e of coneHits(a, 40, 0.9)) { const nx = e.x + Math.cos(a) * 8, ny = e.y + Math.sin(a) * 8;
            if (W.blocked(nx, ny, e.r)) { if (!walled.has(e.id)) { walled.add(e.id); E({ t: 'collide', x: e.x, y: e.y }); F('burst', { x: e.x, y: e.y, r: 24, pal: 'metal', n: 12 }); H(e, op.mul2); stun(e, 1); } } else if (!e.def.elite && !e.def.boss) moveE(e, nx, ny);
            if (i % 3 === 0) H(e, op.mul); } });
        break;
      }
      case 'sweepRain': { // 화살 장막이 옆으로 쓸고 지나간다
        const c = aimAt(130), sx = -Math.sin(ang), sy = Math.cos(ang);
        for (let i = 0; i < 7; i++) { const q = W.groundPoint(c.x + sx * (i - 3) * 18, c.y + sy * (i - 3) * 18), t = 0.25 + i * 0.12;
          E({ t: 'skillFall', x: q.x, y: q.y, r: 22, dur: t, fx: 'arrow', elem: el });
          later(t, () => { AOE(q.x, q.y, 22, 'arrow', { lite: i % 2 === 0 }); F('spikes', { x: q.x, y: q.y, r: 18, n: 6, h: 14, pal: 'wind', dur: 0.8 }); F('gust', { x: q.x - sx * 20, y: q.y - sy * 20, r: 40, ang: Math.atan2(sy, sx), n: 3, wide: 20, pal: 'wind', dur: 0.4 }); for (const e of W.enemiesNear(q.x, q.y, 22)) { H(e, op.mul); knock(e, q.x - sx * 10, q.y - sy * 10, 12); } }); }
        break;
      }
      case 'mirrorPincer': { // 거울의 나와 양쪽에서 동시에 벤다
        p.invuln = Math.max(p.invuln, 0.3);
        every(0.5, 5, () => { const t = near(p.x, p.y, 150); if (!t) return; const ax = t.x - p.x, ay = t.y - p.y, mx = t.x + ax, my = t.y + ay;
          E({ t: 'afterimage', x1: mx, y1: my, x2: t.x, y2: t.y }); E({ t: 'danceDash', x1: p.x, y1: p.y, x2: mx, y2: my }); E({ t: 'danceCut', x: t.x, y: t.y, ang: Math.atan2(ay, ax) }); F('slash', { x: t.x, y: t.y, r: 15, ang: Math.atan2(ay, ax) + 1.2, pal: 'glass' }); F('slash', { x: t.x, y: t.y, r: 15, ang: Math.atan2(ay, ax) + Math.PI + 1.2, pal: 'shadow' });
          for (const e of segHits(p.x, p.y, mx, my, 12)) if (e !== t) H(e, op.mul); H(t, op.mul2); },
          () => { AOE(p.x, p.y, 70, 'blink'); E({ t: 'shake', v: 5 }); F('burst', { x: p.x, y: p.y, r: 46, pal: 'glass', n: 16 }); for (const e of W.enemiesNear(p.x, p.y, 70)) H(e, op.mul2); });
        break;
      }
      case 'prismSplit': { // 빛살이 첫 적에서 세 갈래로 갈라진다
        const end = rayEnd(ang, 150), L = segHits(p.x, p.y, end.x, end.y, 8).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)), t = L[0];
        const hx = t ? t.x : end.x, hy = t ? t.y : end.y; E({ t: 'skillLine', x1: p.x, y1: p.y, x2: hx, y2: hy, w: 6, elem: el, fx: 'holy' }); F('beam', { x1: p.x, y1: p.y - 6, x2: hx, y2: hy - 6, w: 4, pal: 'holy', dur: 0.4 }); F('star', { x: hx, y: hy, r: 9, h: 6, pal: 'glass', dur: 0.5 });
        if (t) H(t, op.mul);
        later(0.1, () => { for (const d of [-0.5, 0, 0.5]) { const a = ang + d, L2 = W.rayLen(hx, hy, a, 110), x2 = hx + Math.cos(a) * L2, y2 = hy + Math.sin(a) * L2;
          E({ t: 'skillLine', x1: hx, y1: hy, x2, y2, w: 5, elem: el, fx: 'holy' }); F('beam', { x1: hx, y1: hy - 6, x2, y2: y2 - 6, w: 3, pal: d < 0 ? 'petal' : d > 0 ? 'water' : 'gold', dur: 0.4 }); for (const e of segHits(hx, hy, x2, y2, 8)) if (e !== t) H(e, op.mul2); } });
        break;
      }
      case 'skullRattle': { // 방울을 흔들 때마다 해골 표식 · 세 번째에 터진다
        const cnt = new Map();
        every(0.3, 6, () => { const L = W.enemiesNear(p.x, p.y, 120); if (!L.length) return; const e = L[Math.floor(W.rng.range(0, L.length)) % L.length]; F('bolt', { x1: p.x, y1: p.y - 12, x2: e.x, y2: e.y - 6, pal: 'curse' }); F('bell', { x: p.x + 6, y: p.y, r: 4, h: 20, pal: 'bone', dur: 0.3 });
          H(e, op.mul, { status: 'curse', stacks: 1 }); const n = (cnt.get(e) || 0) + 1; cnt.set(e, n); F('mark', { x: e.x, y: e.y, icon: 'skull', pal: 'bone', n, dur: 1 });
          if (n === 3 && AT(e)) { cnt.set(e, 0); E({ t: 'inkBurst', x: e.x, y: e.y }); F('burst', { x: e.x, y: e.y, r: 34, pal: 'curse', n: 14 }); F('rays', { x: e.x, y: e.y, r: 30, pal: 'bone', n: 8 }); for (const o of W.enemiesNear(e.x, e.y, 40)) H(o, op.mul2); } });
        break;
      }
      case 'glareBash': { // 방패로 빛을 비춰 눈부시게 하고 친다
        E({ t: 'skillCone', x: p.x, y: p.y, ang, range: 100, angle: 1.2, elem: 'light', fx: 'holy' }); F('rays', { x: p.x + Math.cos(ang) * 8, y: p.y + Math.sin(ang) * 8, r: 80, ang, spread: 1.2, n: 9, pal: 'holy' });
        for (const e of coneHits(ang, 100, 0.6)) { H(e, op.mul); if (AT(e)) { e.st.weak = Math.max(e.st.weak || 0, 2); e.windT = 0; } }
        const t = tgt(70); if (t) { W.meleeStep(ctx, 30, t); later(0.25, () => { if (!AT(t)) return; E({ t: 'slam', x: t.x, y: t.y }); F('burst', { x: t.x, y: t.y, r: 24, pal: 'holy', n: 12 }); H(t, op.mul2 * (t.st.weak ? 1.3 : 1)); knock(t, p.x, p.y, 60); }); }
        break;
      }
      case 'spiritFist': { // 기를 모아 흐릿한 주황 거대 주먹을 날린다 (꿰뚫고 밀어낸다)
        const T = op.charge || 0.7, N = 7; p.chargeT = T;
        every(T / N, N, (i) => E({ t: 'kiGather', k: (i + 1) / N, dur: T / N, tier }), // 손에 기운이 모인다 (그림만)
          () => { const a = Math.atan2(p.aimY, p.aimX), hit = new Set(); E({ t: 'shake', v: 3 }); E({ t: 'kiLaunch', x: p.x + Math.cos(a) * 12, y: p.y - 6 + Math.sin(a) * 12, ang: a });
            shoot(p.x + Math.cos(a) * 10, p.y - 6 + Math.sin(a) * 10, a, 220, op.range || 240, 'spiritFist', (e) => { if (hit.has(e.id)) return; hit.add(e.id); H(e, op.mul); knock(e, e.x - Math.cos(a) * 10, e.y - Math.sin(a) * 10, op.kb || 90); stun(e, op.stun || 0.6); E({ t: 'kiImpact', x: e.x, y: e.y - 6, ang: a }); }, { pierce: 99, color: '#ff9a3a' }); });
        break;
      }
      case 'rallyPull': { // 함성으로 끌어모으고 다가온 적을 친다
        const L = W.enemiesNear(p.x, p.y, 150); AOE(p.x, p.y, 150, 'wind', { lite: true }); E({ t: 'shake', v: 2 }); F('rays', { x: p.x, y: p.y, r: 60, pal: 'blood', n: 14 });
        for (const e of L) { H(e, op.mul); pullTo(e, p.x, p.y, 0.7); W.aggro(e); F('gust', { x: e.x, y: e.y, r: Math.hypot(p.x - e.x, p.y - e.y), ang: Math.atan2(p.y - e.y, p.x - e.x), n: 3, wide: 10, pal: 'earth', dur: 0.6 }); F('mark', { x: e.x, y: e.y, icon: 'brand', pal: 'blood', dur: 0.8 }); }
        later(0.8, () => { AOE(p.x, p.y, 45, 'slam'); F('slash', { x: p.x, y: p.y, r: 36, ang: ang, spread: 6, pal: 'earth', dur: 0.3 }); F('burst', { x: p.x, y: p.y, r: 36, pal: 'earth', n: 14 }); for (const e of W.enemiesNear(p.x, p.y, 45)) { H(e, op.mul2); stun(e, 0.5); } });
        break;
      }
      case 'hoverBlade': { // 던진 칼이 그 자리에서 돌다 돌아온다
        const c = aimAt(110), x0 = p.x, y0 = p.y; F('gust', { x: x0, y: y0, r: Math.hypot(c.x - x0, c.y - y0), ang: Math.atan2(c.y - y0, c.x - x0), n: 3, wide: 6, pal: 'metal', dur: 0.25 }); F('blade', { x: c.x, y: c.y, size: 10, n: 6, pal: 'metal', dur: 1.05 });
        for (const e of segHits(x0, y0, c.x, c.y, 10)) H(e, op.mul);
        every(0.2, 5, () => { F('slash', { x: c.x, y: c.y + 4, r: 22, ang: W.t * 9, spread: 2.6, pal: 'metal', dur: 0.2 }); for (const e of W.enemiesNear(c.x, c.y, 26)) H(e, op.mul); },
          () => { shoot(c.x, c.y - 4, Math.atan2(p.y - c.y, p.x - c.x), 400, Math.max(10, Math.hypot(p.x - c.x, p.y - c.y)), 'knife', () => {}, { pierce: 99, skin: 'knife', pal: 'metal' }); F('gust', { x: c.x, y: c.y, r: Math.hypot(p.x - c.x, p.y - c.y), ang: Math.atan2(p.y - c.y, p.x - c.x), n: 3, wide: 6, pal: 'metal', dur: 0.25 }); for (const e of segHits(c.x, c.y, p.x, p.y, 10)) H(e, op.mul2); });
        break;
      }
      case 'hawkStrike': { // 매가 체력이 가장 많은 적에게 내리꽂힌다
        E({ t: 'soarUp', x: p.x, y: p.y - 10 });
        later(0.9, () => { let t = null; for (const e of W.enemiesNear(p.x, p.y, 220)) if (!t || e.hp > t.hp) t = e; if (!t) return;
          E({ t: 'skillFall', x: t.x, y: t.y, r: 20, dur: 0.15, fx: 'wind', elem: el });
          F('wing', { x: t.x, y: t.y - 14, r: 24, ang: -Math.PI / 2, n: 7, spread: 2.6, pal: 'earth', dur: 0.3 });
          later(0.15, () => { if (!AT(t)) return; E({ t: 'danceCut', x: t.x, y: t.y, ang: Math.PI / 2 }); E({ t: 'shake', v: 3 }); F('burst', { x: t.x, y: t.y, r: 22, pal: 'wind', n: 10 }); H(t, op.mul, { status: 'bleed', stacks: 2 });
            every(0.4, 3, () => { if (AT(t)) { E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'claws', elem: el }); F('slash', { x: t.x, y: t.y, r: 12, ang: W.rng.range(0, 6.28), pal: 'wind' }); H(t, op.mul2); } }); }); });
        break;
      }
      case 'swallowBeam': { // 빛을 삼키며 숨고 · 한 줄로 토해 낸다
        p.invuln = Math.max(p.invuln, 0.8); E({ t: 'stealthOn', x: p.x, y: p.y }); F('swirl', { x: p.x, y: p.y, r: 80, n: 5, pal: 'shadow', dur: 0.85 });
        let eaten = 0;
        every(0.2, 4, () => { for (const e of W.enemiesNear(p.x, p.y, 90)) { F('tongue', { x1: e.x, y1: e.y - 6, x2: p.x, y2: p.y - 8, pal: 'holy', w: 1.4, wob: 2, dur: 0.22 }); H(e, op.mul); eaten++; } W.heal(W.d.maxHp * 0.006, 'skill'); },
          () => { const a = Math.atan2(p.aimY, p.aimX), end = rayEnd(a, 160); E({ t: 'skillLine', x1: p.x, y1: p.y, x2: end.x, y2: end.y, w: 10, elem: el, fx: 'dark' }); E({ t: 'shake', v: 4 }); F('beam', { x1: p.x, y1: p.y - 8, x2: end.x, y2: end.y - 8, w: 6 + Math.min(4, eaten * 0.3), pal: 'shadow', dur: 0.5 }); F('beam', { x1: p.x, y1: p.y - 8, x2: end.x, y2: end.y - 8, w: 2.5, pal: 'holy', dur: 0.4 });
            for (const e of segHits(p.x, p.y, end.x, end.y, 12)) H(e, op.mul2 * (1 + Math.min(1, eaten * 0.05))); });
        break;
      }
      case 'crossWind': { // 옆바람이 적을 한쪽으로 쓸어 몰아붙인다
        const c = aimAt(100), sx = -Math.sin(ang), sy = Math.cos(ang), walled = new Set();
        every(0.1, 10, (i) => { E({ t: 'skillCone', x: c.x - sx * 60, y: c.y - sy * 60, ang: Math.atan2(sy, sx), range: 120, angle: 0.8, elem: el, fx: 'wind', lite: true }); if (i % 3 === 0) F('wing', { x: c.x - sx * 50, y: c.y - sy * 50 + 6, r: 90, ang: Math.atan2(sy, sx), n: 4, spread: 0.7, pal: 'wind', dur: 0.32 });
          for (const e of W.enemiesNear(c.x, c.y, 70)) { if (i % 3 === 0) H(e, op.mul); if (!AT(e) || e.def.boss) continue; const nx = e.x + sx * 7, ny = e.y + sy * 7; if (W.blocked(nx, ny, e.r)) { if (!walled.has(e.id)) { walled.add(e.id); E({ t: 'collide', x: e.x, y: e.y }); H(e, op.mul2); stun(e, 0.8); } } else moveE(e, nx, ny); } });
        break;
      }
      case 'pushBlast': { // 바람탄이 꿰뚫고 밀어낸 거리만큼 세다
        const mz = W.muzzle(ang);
        shoot(mz.x, mz.y, ang, 280, 200, 'skill', (e) => { H(e, op.mul); if (e.def.boss) return; const x0 = e.x, y0 = e.y;
          every(0.03, 10, () => { if (!AT(e)) return false; const nx = e.x + Math.cos(ang) * 9, ny = e.y + Math.sin(ang) * 9; if (W.blocked(nx, ny, e.r)) { E({ t: 'collide', x: e.x, y: e.y }); stun(e, 0.8); return false; } moveE(e, nx, ny); },
            () => { if (!AT(e)) return; const d = Math.hypot(e.x - x0, e.y - y0); E({ t: 'skillSingle', x: e.x, y: e.y, fx: 'wind', elem: el }); F('gust', { x: x0, y: y0, r: Math.max(20, d), ang, n: 4, wide: 18, pal: 'wind', dur: 0.4 }); F('burst', { x: e.x, y: e.y, r: 16 + d * 0.15, pal: 'wind', n: 10 }); H(e, op.mul2 * (1 + d / 90)); }); }, { pierce: 6, color: '#d8f0ff', skin: 'gale', pal: 'wind' });
        break;
      }
      case 'boulderSplit': { // 하늘로 던진 바위가 떨어져 다섯 조각으로 굴러간다
        const c = aimAt(140); E({ t: 'skillFall', x: c.x, y: c.y, r: 40, dur: 0.7, fx: 'rocks', elem: el }); F('rock', { x: c.x, y: c.y, r: 16, h: 140, pal: 'earth', dur: 0.72, fall: 0.7 });
        later(0.7, () => { AOE(c.x, c.y, 40, 'rocks'); E({ t: 'shake', v: 5 }); F('burst', { x: c.x, y: c.y, r: 40, pal: 'earth', n: 16 }); F('crack', { x1: c.x - 30, y1: c.y + 2, x2: c.x + 30, y2: c.y + 4, pal: 'earth', dur: 1 }); for (const e of W.enemiesNear(c.x, c.y, 40)) H(e, op.mul);
          for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; shoot(c.x, c.y, a, 160, 90, 'icerock', (e) => { H(e, op.mul2); knock(e, c.x, c.y, 30); }, { color: '#b0a088', pierce: 2, skin: 'rock', pal: 'earth' }); } });
        break;
      }
      case 'sweepKnives': { // 팔을 휘둘러 칼을 부채꼴로 흩뿌린다
        for (let i = 0; i < 7; i++) later(0.05 * i, () => { const a = Math.atan2(p.aimY, p.aimX) - 0.6 + i * 0.2, mz = W.muzzle(a); shoot(mz.x, mz.y, a, 330, 170, 'knife', (e) => { H(e, op.mul); F('rays', { x: e.x, y: e.y, r: 10, pal: 'metal', n: 4 }); }, { skin: 'knife', pal: 'metal' }); if (i === 3) F('slash', { x: p.x, y: p.y, r: 20, ang: a, spread: 1.6, pal: 'metal', dur: 0.3 }); });
        break;
      }
      case 'boneShrapnel': { // 뼈 주머니가 흩어졌다 적에게 튀어 오른다
        const c = aimAt(110); E({ t: 'skillAoe', x: c.x, y: c.y, r: 50, elem: el, fx: 'bones', lite: true }); F('burst', { x: c.x, y: c.y, r: 44, pal: 'bone', n: 14 }); F('splat', { x: c.x, y: c.y + 2, r: 30, pal: 'shadow', dur: 1.2 }); for (const e of W.enemiesNear(c.x, c.y, 50)) H(e, op.mul);
        const pts = [0, 1, 2, 3, 4, 5].map((i) => W.groundPoint(c.x + Math.cos(i * 1.047) * 30, c.y + Math.sin(i * 1.047) * 30)); for (const q of pts) F('spikes', { x: q.x, y: q.y, r: 4, n: 2, h: 8, pal: 'bone', dur: 1.1 });
        later(1, () => pts.forEach((q, i) => later(0.06 * i, () => { const t = near(q.x, q.y, 140); if (!t) return; E({ t: 'emerge', x: q.x, y: q.y }); shoot(q.x, q.y, Math.atan2(t.y - q.y, t.x - q.x), 260, 150, 'icerock', (e) => { H(e, op.mul2); F('rays', { x: e.x, y: e.y, r: 12, pal: 'bone', n: 5 }); }, { color: '#e8e0c8', skin: 'bone', pal: 'bone' }); })));
        break;
      }
      case 'bloatSac': { // 맞을수록 부푸는 주머니가 터진다
        const t = tgt(140); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'plague', elem: el }); H(t, op.mul, { status: 'poison', stacks: 1 }); F('orb', { x: t.x, y: t.y, r: 5, h: 22, pal: 'poison', dur: 0.4 });
        let n = 1, last = t.hp;
        every(0.1, 30, () => { if (!AT(t)) return false; if (t.hp < last - 1 && n < 6) { n++; E({ t: 'text', x: t.x, y: t.y - 22, text: `부풂 ${n}`, color: '#a0e060' }); } last = t.hp; F('orb', { x: t.x, y: t.y, r: 3 + n * 1.3, h: 22, pal: 'poison', dur: 0.11 }); },
          () => { const x = t.x, y = t.y, r = 40 + n * 6; AOE(x, y, r, 'splash'); E({ t: 'shake', v: 2 + n }); F('burst', { x, y, r: r * 0.8, pal: 'poison', n: 12 + n * 2 }); F('splat', { x, y: y + 2, r: r * 0.7, pal: 'poison', dur: 1.4, bubble: true }); for (const e of W.enemiesNear(x, y, r)) H(e, op.mul2 * n, { status: 'poison', stacks: n }); });
        break;
      }
      case 'ankleDrag': { // 땅에서 손가락이 발목을 잡아 끌고 온다
        const t = tgt(160); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        E({ t: 'emerge', x: t.x, y: t.y });
        every(0.3, 5, () => { if (!AT(t)) return false; F('fist', { x: t.x, y: t.y + 6, r: 14, ang: -Math.PI / 2, n: 5, spread: 1.2, pal: 'shadow', dur: 0.32 }); F('splat', { x: t.x, y: t.y + 2, r: t.r + 6, pal: 'ink', dur: 0.4 }); F('path', { x1: t.x, y1: t.y + 2, x2: t.x + (p.x - t.x) * 0.3, y2: t.y + (p.y - t.y) * 0.3 + 2, pal: 'ink', dur: 0.8 });
          H(t, op.mul, { status: 'chill', stacks: 1 }); if (AT(t) && !t.def.boss) { const d = Math.hypot(p.x - t.x, p.y - t.y); if (d > 24) moveE(t, t.x + (p.x - t.x) / d * 14, t.y + (p.y - t.y) / d * 14); } if (AT(t)) t.windT = 0; },
          () => { if (AT(t)) { E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'trap', elem: el }); H(t, op.mul2); } });
        break;
      }
      case 'shadowRelay': { // 그림자가 적에서 적으로 건너가 묶고 나는 끝으로
        const seen = new Set(); let cur = { x: p.x, y: p.y };
        every(0.18, 4, () => { const e = near(cur.x, cur.y, 120, seen); if (!e) return false; seen.add(e.id); F('path', { x1: cur.x, y1: cur.y + 2, x2: e.x, y2: e.y + 2, pal: 'shadow', dur: 0.8 }); F('ghost', { x: e.x, y: e.y, r: 14, ang: -Math.PI / 2, n: 5, spread: 1.6, pal: 'shadow', dur: 0.4 });
          F('splat', { x: e.x, y: e.y + 2, r: e.r + 6, pal: 'ink', dur: 0.8 }); H(e, op.mul); if (AT(e)) e.rooted = Math.max(e.rooted || 0, 0.8); cur = { x: e.x, y: e.y }; },
          () => { if (!seen.size) return; const x1 = p.x, y1 = p.y; if (moveTo(cur.x - p.aimX * 14, cur.y - p.aimY * 14)) { E({ t: 'shadowBlink', x1, y1, x2: p.x, y2: p.y }); F('burst', { x: p.x, y: p.y, r: 30, pal: 'shadow', n: 12 }); for (const e of W.enemiesNear(p.x, p.y, 40)) H(e, op.mul2); } });
        break;
      }
      case 'lullaby': { // 잠재우고 · 처음 때리면 깨며 크게
        const L = W.enemiesNear(p.x, p.y, 130).slice(0, 5); AOE(p.x, p.y, 130, 'spiritIn', { lite: true }); F('gust', { x: p.x, y: p.y, r: 90, ang, n: 5, wide: 60, pal: 'wind', dur: 0.8 }); F('orb', { x: p.x, y: p.y, r: 4, h: 22, pal: 'wind', dur: 0.8 });
        const hp = new Map(); for (const e of L) { H(e, op.mul); if (AT(e)) { stun(e, 3); hp.set(e, e.hp); F('mark', { x: e.x, y: e.y, icon: 'z', pal: 'wind', dur: 3 }); F('splat', { x: e.x, y: e.y + 2, r: e.r + 4, pal: 'wind', dur: 3 }); } }
        every(0.1, 30, () => { for (const [e, h] of hp) { if (!AT(e)) { hp.delete(e); continue; } if (e.hp < h - 1) { hp.delete(e); e.st.stun = 0; E({ t: 'skillSingle', x: e.x, y: e.y, fx: 'wind', elem: el }); F('burst', { x: e.x, y: e.y, r: 26, pal: 'wind', n: 12 }); H(e, op.mul2); } } });
        break;
      }
      case 'inhaleExhale': { // 들이쉬어 끌어모으고 내쉬어 날린다
        F('swirl', { x: p.x, y: p.y, r: 100, n: 5, pal: 'wind', dur: 0.85 }); every(0.1, 8, (i) => { E({ t: 'skillAoe', x: p.x, y: p.y, r: 120, elem: el, fx: 'spiritIn', lite: true }); if (i % 3 === 0) for (let j = 0; j < 4; j++) F('gust', { x: p.x + Math.cos(j * 1.57 + i) * 100, y: p.y + Math.sin(j * 1.57 + i) * 60, r: 90, ang: j * 1.57 + i + Math.PI, n: 2, wide: 10, pal: 'wind', dur: 0.3 }); for (const e of W.enemiesNear(p.x, p.y, 120)) pullTo(e, p.x + p.aimX * 30, p.y + p.aimY * 30, 0.12); },
          () => { const a = Math.atan2(p.aimY, p.aimX); E({ t: 'skillCone', x: p.x, y: p.y, ang: a, range: 110, angle: 1.2, elem: el, fx: 'wind' }); E({ t: 'shake', v: 4 }); F('gust', { x: p.x, y: p.y, r: 110, ang: a, n: 9, wide: 70, pal: 'wind', dur: 0.5 }); F('slash', { x: p.x, y: p.y, r: 90, ang: a, spread: 1.2, pal: 'wind', dur: 0.35 });
            for (const e of coneHits(a, 110, 0.65)) { H(e, op.mul); knock(e, p.x, p.y, 90); } });
        break;
      }
      case 'lifeSip': { // 생기 줄을 이어 마신다 (멀어지면 끊긴다)
        const t = tgt(120); if (!t) { E({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        every(0.2, 8, () => { if (!AT(t) || Math.hypot(t.x - p.x, t.y - p.y) > 140) return false; F('tether', { x1: t.x, y1: t.y - 6, x2: p.x, y2: p.y - 8, pal: 'blood', w: 1.8, wob: 3, dur: 0.21 }); F('orb', { x: t.x + (p.x - t.x) * ((W.t * 2) % 1), y: t.y + (p.y - t.y) * ((W.t * 2) % 1), r: 2.5, h: 7, pal: 'holy', dur: 0.2 }); const h = t.hp; H(t, op.mul); W.heal(Math.max(0, h - t.hp) * 0.3, 'skill'); });
        break;
      }
      case 'curveArrow': { // 크게 휘어 적의 등 뒤에서 꽂힌다
        const t = tgt(200), tx = t ? t.x : p.x + p.aimX * 150, ty = t ? t.y : p.y + p.aimY * 150, sx = p.x, sy = p.y, dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
        let px0 = sx, py0 = sy; const N = 12;
        every(0.04, N, (i) => { const s = (i + 1) / N, bend = Math.sin(s * Math.PI) * 50, x = sx + dx * s + nx * bend, y = sy + dy * s + ny * bend;
          E({ t: 'skillLine', x1: px0, y1: py0, x2: x, y2: y, w: 3, elem: el, fx: 'wind' }); F('tether', { x1: px0, y1: py0 - 6, x2: x, y2: y - 6, pal: 'wind', w: 1.6, wob: 0, dur: 0.3 }); F('orb', { x, y, r: 3, h: 6, pal: 'wind', dur: 0.06 }); px0 = x; py0 = y; },
          () => { if (!AT(t)) { AOE(px0, py0, 20, 'wind', { lite: true }); for (const e of W.enemiesNear(px0, py0, 20)) H(e, op.mul); return; } E({ t: 'skillSingle', x: t.x, y: t.y, fx: 'arrow', elem: el }); F('wing', { x: t.x, y: t.y, r: 22, ang: Math.atan2(t.y - py0, t.x - px0), n: 5, spread: 1.4, pal: 'wind', dur: 0.35 }); F('burst', { x: t.x, y: t.y, r: 22, pal: 'wind', n: 10 }); H(t, op.mul * 1.5); for (const e of W.enemiesNear(t.x, t.y, 30)) if (e !== t) H(e, op.mul2); });
        break;
      }
      case 'skyDrop': { // 움켜쥐고 날아올라 떨어뜨린다
        const t = tgt(70); if (!t) { dash(60, { mul: op.mul }); break; }
        H(t, op.mul); const c = aimAt(130); p.invuln = Math.max(p.invuln, 1); E({ t: 'soarUp', x: p.x, y: p.y }); F('wing', { x: p.x, y: p.y, r: 30, ang: -Math.PI / 2, n: 7, spread: 2.8, pal: 'fire', dur: 0.5 }); F('trap', { x: c.x, y: c.y, r: 22, n: 10, pal: 'fire', dur: 0.85 });
        const carry = !t.def.elite && !t.def.boss; if (carry) stun(t, 1.2);
        every(0.05, 16, (i) => { moveTo(p.x + (c.x - p.x) / (16 - i), p.y + (c.y - p.y) / (16 - i)); if (carry && AT(t)) moveE(t, p.x, p.y - 4); },
          () => { const x = AT(t) ? t.x : p.x, y = AT(t) ? t.y : p.y; E({ t: 'slam', x, y }); AOE(x, y, 50, 'burst'); E({ t: 'shake', v: 5 }); F('burst', { x, y, r: 46, pal: 'fire', n: 18 }); F('splat', { x, y: y + 2, r: 30, pal: 'lava', dur: 1, bubble: true }); F('crack', { x1: x - 30, y1: y + 2, x2: x + 30, y2: y + 4, pal: 'fire', dur: 0.9 }); for (const e of W.enemiesNear(x, y, 50)) H(e, op.mul2); });
        break;
      }
      case 'splitBlink': { // 떠난 자리와 닿은 자리가 함께 터지고 사이의 적은 양옆으로
        const x0 = p.x, y0 = p.y, end = rayEnd(ang, 120); moveTo(end.x - p.aimX * 6, end.y - p.aimY * 6); p.invuln = Math.max(p.invuln, 0.3);
        E({ t: 'blink', x1: x0, y1: y0, x2: p.x, y2: p.y }); F('crack', { x1: x0, y1: y0 + 2, x2: p.x, y2: p.y + 2, pal: 'wind', dur: 0.6 }); F('wing', { x: p.x, y: p.y, r: 26, ang, n: 6, spread: 2.2, pal: 'wind', dur: 0.4 });
        later(0.15, () => { const sx = -Math.sin(ang), sy = Math.cos(ang);
          for (const e of segHits(x0, y0, p.x, p.y, 20)) { H(e, op.mul); if (!AT(e) || e.def.elite || e.def.boss) continue; const side = (e.x - x0) * sx + (e.y - y0) * sy >= 0 ? 1 : -1; e.kbx += sx * side * 140; e.kby += sy * side * 140; }
          F('beam', { x1: x0, y1: y0 - 6, x2: p.x, y2: p.y - 6, w: 3, pal: 'wind', dur: 0.3 }); for (const [x, y] of [[x0, y0], [p.x, p.y]]) { AOE(x, y, 36, 'wind'); F('burst', { x, y, r: 32, pal: 'wind', n: 12 }); for (const e of W.enemiesNear(x, y, 36)) H(e, op.mul2); } });
        break;
      }
      default: break;
    }
  },
};

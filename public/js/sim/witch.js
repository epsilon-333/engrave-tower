// 늪 마녀 수장 (15층 수호자 bogHag): 거리와 상황에 맞춰 기술을 고른다 (data/monsters.js bogHag.ownKit = 'witch')
//   가까이: 지팡이 휘두르기 · 늪의 파동 · 속박 / 가운데: 뿌리 조종 · 맹독 구슬(일렬 · 부채꼴) · 속박 · 늪의 파동 · 늪 바꾸기 / 멀리: 맹독 구슬 · 뿌리 조종 · 늪 바꾸기 · 속박
//   늪 바꾸기: 내 둘레의 물을 12초 동안 늪으로 — 늪에 들어가면 느려지고 중독(독은 쌓이지 않고 새로 걸릴 뿐)
// World.prototype 에 붙는다 (sim/world.js 끝). 메서드 안의 this 는 World
import { DT, T_LIQUID } from './world.js';

export const WITCH = {
  near: 58, far: 140, gap: [1.0, 1.7],
  melee: { r: 46, arc: 1.3, k: 1.3, wind: 0.38, after: 0.22 },               // 지팡이 휘두르기: 앞 반원 · 공격력 130%
  bind: { wind: 0.5, r: 20, stiff: 1.2, ticks: 4, k: 0.3, cd: 11 },          // 속박: 발밑에서 덩굴 · 1.2초 경직 · 그동안 4번 30%
  swamp: { wind: 0.7, r: 72, t: 12, spread: 0.7, slow: 0.5, tick: 0.5, k: 0.2, cd: 15 }, // 늪 바꾸기: 둘레 72의 물 칸 · 12초
  roots: { n: 3, wind: 0.45, gap: 0.5, rise: 0.45, aim: 0.25, whip: 0.22, len: 80, w: 8, k: 1.2, cd: 8 }, // 뿌리 조종: 내 자리에 줄기가 길게 솟고(0.45초) → 내 쪽으로 겨눠(0.25초) 내려친다 · 셋 차례로
  orbs: { n: 3, wind: 0.6, speed: 78, life: 2.6, rad: 8, burst: 34, k: 1.1, gapT: 0.28, fan: 0.42, cd: 8 }, // 맹독 구슬: 내 몸의 1.5배 · 벽 · 시간 · 나에 닿으면 터진다
  wave: { wind: 0.55, r: 120, t: 0.85, w: 12, k: 0.9, push: 38, cd: 9 },      // 늪의 파동: 사방으로 출렁이며 퍼진다 · 조금 밀고 중독
};
const W = WITCH;

export const WitchMethods = {
  witchTimers(e) {
    const K = (e.wk ||= { cd: { bind: 2, swamp: 3, roots: 1, orbs: 0.5, wave: 2 } });
    for (const k in K.cd) K.cd[k] -= DT;
    return K;
  },
  witchGap(e) { const [a, b] = W.gap; e.mvCd = this.rng.range(a, b) / (e.enraged ? 1.3 : 1); },
  // 내 둘레(r)의 물 칸
  witchWater(x, y, r) {
    const out = [], tx0 = Math.max(0, Math.floor((x - r) / 16)), tx1 = Math.min(this.tw - 1, Math.floor((x + r) / 16)), ty0 = Math.max(0, Math.floor((y - r) / 16)), ty1 = Math.min(this.th - 1, Math.floor((y + r) / 16));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const i = ty * this.tw + tx; if (this.tiles[i] !== T_LIQUID) continue; const d = Math.hypot(tx * 16 + 8 - x, ty * 16 + 8 - y); if (d <= r) out.push([i, d]); }
    return out;
  },
  witchPick(e, p, dist) {
    const K = e.wk;
    if (e.windT > 0) return false;
    if ((e.mvCd ??= 1.0) > 0) { e.mvCd -= DT; return false; }
    if (dist > 320) return false;
    const can = (k) => K.cd[k] <= 0, pool = [];
    const water = can('swamp') && this.witchWater(p.x, p.y, W.swamp.r).filter(([i]) => !(this.bog?.get(i)?.t > 3)).length >= 6; // 내 둘레에 늪으로 바꿀 물이 넉넉할 때
    if (dist < W.near) { pool.push('melee', 'melee', 'melee'); if (can('wave')) pool.push('wave', 'wave'); if (can('bind')) pool.push('bind'); }
    else if (dist < W.far) { if (can('roots')) pool.push('roots', 'roots'); if (can('orbs')) pool.push('orbs', 'orbFan'); if (can('bind')) pool.push('bind'); if (can('wave') && dist < 100) pool.push('wave'); if (water) pool.push('swamp', this.player.onLiquid ? 'swamp' : 'roots'); }
    else { if (can('orbs')) pool.push('orbs', 'orbFan', 'orbs'); if (can('roots')) pool.push('roots'); if (can('bind')) pool.push('bind'); if (water) pool.push('swamp', 'swamp'); }
    const pick = pool.filter((k) => k === 'melee' || k === 'orbFan' ? true : can(k));
    if (!pick.length) return false; // 걸어서 다가온다
    return this.witchStart(e, p, pick[this.rng.int(0, pick.length - 1)]);
  },
  witchStart(e, p, k) {
    const K = e.wk, aim = Math.atan2(p.y - e.y, p.x - e.x), wind = (t) => { e.windT = t; e.windMax = t; };
    this.witchGap(e);
    switch (k) {
      case 'melee':
        e.mv = { k, own: 'witch', t: W.melee.wind + W.melee.after, ang: aim }; wind(W.melee.wind); this.emit({ t: 'windup', id: e.id }); return true;
      case 'bind': { K.cd.bind = W.bind.cd;
        const q = { x: p.x, y: p.y };
        e.mv = { k, own: 'witch', t: W.bind.wind + 0.2, x: q.x, y: q.y }; wind(W.bind.wind);
        this.emit({ t: 'telegraphCircle', x: q.x, y: q.y, r: W.bind.r, dur: W.bind.wind }); this.emit({ t: 'witchBindTele', x: q.x, y: q.y, dur: W.bind.wind }); this.emit({ t: 'witchCast', id: e.id, dur: W.bind.wind }); return true; }
      case 'swamp': K.cd.swamp = W.swamp.cd;
        e.mv = { k, own: 'witch', t: W.swamp.wind + 0.3, x: p.x, y: p.y }; wind(W.swamp.wind);
        this.emit({ t: 'witchCast', id: e.id, dur: W.swamp.wind, big: true }); this.emit({ t: 'witchSwampTele', x: p.x, y: p.y, r: W.swamp.r, dur: W.swamp.wind }); return true;
      case 'roots': K.cd.roots = W.roots.cd;
        e.mv = { k, own: 'witch', t: W.roots.wind + 0.3 }; wind(W.roots.wind); this.emit({ t: 'witchCast', id: e.id, dur: W.roots.wind }); return true;
      case 'orbs': case 'orbFan': K.cd.orbs = W.orbs.cd;
        e.mv = { k, own: 'witch', t: W.orbs.wind + 0.3, ang: aim }; wind(W.orbs.wind); this.emit({ t: 'witchCast', id: e.id, dur: W.orbs.wind, orb: true }); return true;
      case 'wave': K.cd.wave = W.wave.cd;
        e.mv = { k, own: 'witch', t: W.wave.wind + W.wave.t, u: 0 }; wind(W.wave.wind); this.mobPose(e, 'crouch', W.wave.wind);
        this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: W.wave.r, dur: W.wave.wind }); this.emit({ t: 'witchCast', id: e.id, dur: W.wave.wind }); return true;
    }
    return false;
  },
  witchTick(e, p, mv) {
    const def = e.def;
    if (e.windT > 0) e.windT = Math.max(0, e.windT - DT);
    const hitAll = (test, hit) => { const prev = this.coTgt; for (const q of this.coTargets()) if (test(q)) { this.coTgt = q === this.player ? null : q; hit(q); } this.coTgt = prev; };
    const fire = e.windT <= 0 && !mv.done;
    switch (mv.k) {
      case 'melee':
        if (fire) { mv.done = true;
          hitAll((q) => { const dx = q.x - e.x, dy = q.y - e.y; let da = Math.atan2(dy, dx) - mv.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.hypot(dx, dy) < W.melee.r + (q.r || 5) && Math.abs(da) < W.melee.arc; },
            () => this.hurtPlayer(e.atk * W.melee.k, def.type, e, { fromX: e.x, fromY: e.y }));
          this.emit({ t: 'witchSwing', x: e.x, y: e.y - 8, ang: mv.ang, r: W.melee.r }); }
        break;
      case 'bind': // 덩굴이 솟아 휘감는다: 맞으면 경직 · 묶인 동안 조금씩 피해
        if (fire) { mv.done = true; let caught = false;
          hitAll((q) => Math.hypot(q.x - mv.x, q.y - mv.y) < W.bind.r + (q.r || 5), (q) => {
            this.hurtPlayer(e.atk * W.bind.k, def.type, e, { fromX: mv.x, fromY: mv.y });
            if (q !== this.player || !this.hurtLanded) return;
            caught = true; const res = 1 - (this.d.statusRes || 0) * 0.5, T = W.bind.stiff * res; q.ccT = Math.max(q.ccT || 0, T); q.bindT = T;
            this.emit({ t: 'text', x: q.x, y: q.y - 24, text: '묶였다', color: '#9be15d' }); this.emit({ t: 'witchBind', dur: T });
            for (let i = 1; i <= W.bind.ticks; i++) this.delayed.push({ t: (T / W.bind.ticks) * i, run: () => { if (e.dead || !(q.bindT > 0) || q.ccT <= 0) return; this.hurtPlayer(e.atk * W.bind.k, def.type, e, { direct: true }); } });
          });
          if (!caught) this.emit({ t: 'witchBindMiss', x: mv.x, y: mv.y }); }
        break;
      case 'swamp':
        if (fire) { mv.done = true; const S = W.swamp, bog = (this.bog ||= new Map()); this.bogAtk = e.atk;
          for (const [i, d] of this.witchWater(mv.x, mv.y, S.r)) { const o = bog.get(i), dl = (d / S.r) * S.spread; if (o && o.d <= 0) o.t = Math.max(o.t, S.t); else bog.set(i, { t: S.t + dl, max: S.t + dl, d: dl }); }
          this.emit({ t: 'witchSwamp', x: mv.x, y: mv.y, r: S.r }); }
        break;
      case 'roots': // 뿌리 셋: 차례로 그때의 내 자리에서
        if (fire) { mv.done = true; const R = W.roots;
          for (let i = 0; i < R.n; i++) this.delayed.push({ t: i * R.gap, run: () => { if (e.dead) return;
            const q = this.floorNear(this.player.x, this.player.y, 4) || { x: this.player.x, y: this.player.y }, id = (this.rootId = (this.rootId || 0) + 1);
            this.emit({ t: 'witchRootRise', id, x: q.x, y: q.y, dur: R.rise });
            this.delayed.push({ t: R.rise, run: () => { if (e.dead) return; // 솟은 줄기가 그때의 내 쪽을 겨눈다 (예고선)
              const ang = Math.atan2(this.player.y - q.y, this.player.x - q.x), L = Math.min(R.len, this.rayLen(q.x, q.y, ang, R.len) + 6);
              this.emit({ t: 'witchRootAim', id, ang, len: L, dur: R.aim }); this.emit({ t: 'lineTele', x1: q.x, y1: q.y, x2: q.x + Math.cos(ang) * L, y2: q.y + Math.sin(ang) * L, dur: R.aim, color: '#ff3a3a', w: R.w * 2 });
              this.delayed.push({ t: R.aim, run: () => { if (e.dead) return; this.emit({ t: 'witchRootWhip', id }); // 채찍처럼: 밑동부터 내려오고 끝이 마지막에 닿는다
              this.delayed.push({ t: R.whip, run: () => { if (e.dead) return; // 끝이 닿았다: 줄기가 닿는 길이 안
                const cx = Math.cos(ang), cy = Math.sin(ang);
                hitAll((t) => { const dx = t.x - q.x, dy = t.y - q.y, along = Math.max(0, Math.min(L, dx * cx + dy * cy)); return Math.hypot(dx - cx * along, dy - cy * along) < R.w + (t.r || 5); }, () => this.hurtPlayer(e.atk * R.k, def.type, e, { fromX: q.x, fromY: q.y }));
                this.emit({ t: 'witchRootSlam', id, x: q.x, y: q.y, ang, len: L }); this.emit({ t: 'shake', v: 4 }); } }); } }); } }); } }); }
        break;
      case 'orbs': case 'orbFan': // 맹독 구슬 셋: 일렬(차례로 나를 겨눈다) · 부채꼴(한꺼번에)
        if (fire) { mv.done = true; const O = W.orbs;
          const shoot = (a) => { if (e.dead) return; const sx = e.x + Math.cos(a) * 12, sy = e.y - 10 + Math.sin(a) * 8;
            this.projs.push({ owner: 'e', src: e, x: sx, y: sy, vx: Math.cos(a) * O.speed, vy: Math.sin(a) * O.speed, life: O.life, dmg: (e.atk * O.k) / 1.2, type: def.type, status: 'poison', burst: O.burst, burstOnly: true, burstFx: 'witchOrbPop', rad: O.rad, skind: 'venomOrb', hitFx: 'witchNone', color: '#9be15d', seed: this.rng.range(0, 6) });
            this.emit({ t: 'witchOrbShot', x: sx, y: sy, ang: a }); };
          if (mv.k === 'orbFan') for (let i = 0; i < O.n; i++) shoot(mv.ang + (i - (O.n - 1) / 2) * O.fan);
          else for (let i = 0; i < O.n; i++) this.delayed.push({ t: i * O.gapT, run: () => shoot(Math.atan2(this.player.y - e.y, this.player.x - e.x)) }); }
        break;
      case 'wave': { // 늪액이 사방으로 출렁이며 퍼진다: 물결 앞이 지나갈 때 한 번 맞는다
        if (e.windT > 0) break;
        if (!mv.started) { mv.started = true; this.emit({ t: 'witchWave', x: e.x, y: e.y, r: W.wave.r, dur: W.wave.t }); this.emit({ t: 'shake', v: 3 }); }
        mv.u = Math.min(1, mv.u + DT / W.wave.t); const rr = W.wave.r * (1 - (1 - mv.u) * (1 - mv.u));
        hitAll((q) => !(mv.hit ||= new Set()).has(q) && Math.abs(Math.hypot(q.x - e.x, q.y - e.y) - rr) < W.wave.w + (q.r || 5) && this.clearLine(e.x, e.y, q.x, q.y), (q) => {
          mv.hit.add(q); this.hurtPlayer(e.atk * W.wave.k, def.type, e, { fromX: e.x, fromY: e.y, status: 'poison' });
          if (q === this.player && this.hurtLanded) this.knockPlayer(e.x, e.y, W.wave.push); });
        break; }
    }
    if (mv.t > 0) return true;
    e.mv = null; return true;
  },
  // 늪이 된 물: 시간이 다 되면 물로 돌아간다 · 늪 위에 서 있으면 느려지고 중독 (독은 새로 걸릴 뿐 쌓이지 않는다)
  updateBog() {
    const bog = this.bog; if (!bog?.size) return;
    for (const [i, o] of bog) { if (o.d > 0) o.d -= DT; if ((o.t -= DT) <= 0) bog.delete(i); }
    const p = this.player, i = Math.floor((p.y + 3) / 16) * this.tw + Math.floor(p.x / 16), o = bog.get(i);
    if (!o || o.d > 0 || this.tiles[i] !== T_LIQUID || p.airT > 0 || p.leap) return;
    p.bogT = 0.15;
    if ((p.bogTick = (p.bogTick || 0) - DT) <= 0) { p.bogTick = W.swamp.tick; if (p.invuln <= 0) this.applyPlayerStatus('poison', (this.bogAtk || 10) * W.swamp.k * 4); }
  },
};

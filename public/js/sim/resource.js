// 종족 자원: 기본 수입 · 자원 각인의 스킬과 패시브 (data/resengs.js)
// 기본: 처치 +5(races.js kill) · 초당 +2 · 보스와 싸우는 중엔 초당 +5(죽이기 어려우니까)
const DT = 1 / 60;
import { RES_BASE } from '../data/resengs.js';

export const ResMethods = {
  // 보스와 싸우는 중: 가까이(깨어 있는) 보스가 있다
  bossFight() {
    const p = this.player;
    for (const e of this.enemies) if (!e.dead && (e.def?.boss || e.lair || e === this.tower?.boss) && !e.training && Math.hypot(e.x - p.x, e.y - p.y) < 420) return true;
    return false;
  },
  resTick() {
    const p = this.player, R = this.raceRes; if (!R) return;
    const base = R.regen ? (this.bossFight() ? RES_BASE.bossRegen : R.regen) : 0;
    if (base) this.addRes(base * DT, true);
    const low = this.d.lowRes; // 「벼랑 끝의 숨」
    if (low && p.hp <= this.d.maxHp * 0.3) this.addRes(low * DT, true);
    // 흡수의 화살: 박힌 적에게 지속 피해 · 1초마다 자원
    for (const e of this.enemies) {
      const a = e.absorb; if (!a) continue;
      if (e.dead || this.t >= a.until) { e.absorb = null; continue; }
      a.tick -= DT;
      if (a.tick <= 0) {
        a.tick += 0.5;
        this.damageEnemy(e, this.skillAtk('phys') * a.dps * 0.5, 'phys', { src: 'dot', fromDot: true, color: '#c8a0ff' });
        this.addRes(a.rate * 0.5);
        this.emit({ t: 'buff', x: e.x, y: e.y - 6, color: '#c8a0ff' });
      }
    }
    // 자원의 불꽃: 불타는 적(소환수가 붙인 불도) 한 마리당 초당 +N
    const fr = this.d.flameRes;
    if (fr) { let n = 0; for (const e of this.enemies) if (!e.dead && e.st?.burn) n++; if (n) this.addRes(fr * n * DT, true); }
  },
  // 공명의 표식을 단 적이 피해를 입을 때마다 (0.1초에 한 번까지)
  resMarkHit(e) {
    const m = e.resMark; if (!m) return;
    if (this.t >= m.until) { e.resMark = null; return; }
    if (this.t < m.next) return;
    m.next = this.t + 0.1; this.addRes(m.n);
  },
  absorbStart(e, A) { if (!e.dead) e.absorb = { dps: A.dps, rate: A.rate, until: this.t + A.max, tick: 0.5 }; },
  resOp(op, ctx) {
    const p = this.player;
    switch (op.op) {
      case 'resGain': this.addRes(op.n); this.emit({ t: 'buff', x: p.x, y: p.y, color: this.raceRes?.color || '#9ad0ff' }); break;
      case 'resMark': {
        const e = ctx.target && !ctx.target.dead ? ctx.target : this.nearestEnemy(220);
        if (!e) { p.cds[ctx.id] = 0.3; break; }
        e.resMark = { until: this.t + op.dur, n: op.n, next: 0 };
        this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 18, fx: 'rune', lite: true });
        break;
      }
    }
  },
};

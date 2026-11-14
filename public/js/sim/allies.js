// World — 함께 싸우는 것들 (소환수 · 사령 · 정령 · 길들인 짐승)
// World.prototype 에 그대로 붙는다 (sim/world.js 끝). 메서드 안의 this 는 World

import { ELEM } from '../data/skills.js';
import { SPIRITS, SPIRIT_ELEMS, spiritPower, spiritBuff, buffMods, SPIRIT_SPECIAL, spiritSpecialCd } from '../data/spirits.js';
import { DT, SPIRIT_DMG_ELEM } from './world.js';

export const AllyMethods = {
  updateAllies() {
    if (!this.allies.length) return;
    const p = this.player;
    for (const al of this.allies) {
      if (!al.perm) al.t -= DT; // 사령술사의 부하는 쓰러질 때까지
      al.age = (al.age || 0) + DT;
      al.cd -= DT * (p.buffs.fusion && al.kind === 'spirit' ? 2 : 1);
      const near = (r) => { let best = null, bd = r; for (const e of this.enemies) { if (!this.targetable(e)) continue; const dd = Math.hypot(e.x - al.x, e.y - al.y); if (dd < bd) { bd = dd; best = e; } } return best; };
      if (al.kind === 'orbitAxe') {
        al.phase += DT * 7;
        al.x = p.x + Math.cos(al.phase) * al.r; al.y = p.y - 4 + Math.sin(al.phase) * al.r * 0.7;
        for (const e of this.enemiesNear(al.x, al.y, 8)) {
          if ((al.hitCd[e.id] || 0) > this.t) continue;
          al.hitCd[e.id] = this.t + 0.35;
          this.damageEnemy(e, al.atk, 'phys', { src: 'aoe' });
          this.emit({ t: 'allyHit', x: e.x, y: e.y, kind: 'axe' });
        }
      } else if (al.kind === 'spiritKing') {
        // 정령왕: 걸어가서 주먹으로 친다. 바람 = 멀리 날림 · 불 = 화염 폭발 · 숲 = 덩굴로 묶음
        if (al.punchT > 0) al.punchT -= DT;
        if (al.max - al.t < 0.6 || al.t < 0.6) { al.moving = false; if (al.t <= 0) this.emit({ t: 'summonFx', x: al.x, y: al.y - 20, kind: 'spiritKing', elem: al.elem, out: true }); continue; }
        const pd = Math.hypot(al.x - p.x, al.y - p.y);
        if (pd > 300) { al.x = p.x - p.dir * 24; al.y = p.y; this.emit({ t: 'summonFx', x: al.x, y: al.y - 20, kind: 'spiritKing', elem: al.elem }); }
        let tgt = null, bd = 170;
        for (const e of this.enemies) {
          if (!this.targetable(e)) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) > 190) continue;
          const dd = Math.hypot(e.x - al.x, e.y - al.y);
          if (dd < bd) { bd = dd; tgt = e; }
        }
        const reach = tgt ? tgt.r + 20 : 0;
        let tx = p.x - p.dir * 26, ty = p.y + 4;
        if (tgt) { tx = tgt.x - Math.sign(tgt.x - al.x || 1) * (reach - 4); ty = tgt.y; }
        const vx = tx - al.x, vy = ty - al.y, l = Math.hypot(vx, vy);
        al.moving = false;
        if (l > 4 && !(al.punchT > 0.15)) {
          const spd = (tgt ? 105 : 120) * (l > 80 ? 1.4 : 1);
          al.r = 9; this.move(al, (vx / l) * spd * DT, (vy / l) * spd * DT);
          if (this.blocked(al.x, al.y, 4)) { al.x = p.x; al.y = p.y; }
          al.moving = true; al.walk = (al.walk || 0) + DT;
        }
        if (tgt && Math.abs(tgt.x - al.x) > 2) al.dir = tgt.x > al.x ? 1 : -1;
        else if (!tgt && Math.abs(vx) > 2) al.dir = vx > 0 ? 1 : -1;
        if (tgt && al.cd <= 0 && Math.hypot(tgt.x - al.x, tgt.y - al.y) < reach + 6) {
          al.cd = 0.85; al.punchT = 0.4; al.punchSide = -(al.punchSide || 1);
          const e = tgt, sp = al.spirit;
          this.delayed.push({ t: 0.14, run: () => {
            if (e.dead) return;
            const fx = al.x + al.dir * 22, fy = al.y - 24;
            this.emit({ t: 'kingPunch', x: e.x, y: e.y, fx, fy, spirit: sp });
            this.damageEnemy(e, al.atk * 2.2, 'mag', { src: 'aoe', heavy: true });
            if (e.dead) return;
            if (sp === 'wind') {
              if (!e.def.elite) { const dx = e.x - al.x, dy = e.y - al.y, dl = Math.hypot(dx, dy) || 1; e.kbx += (dx / dl) * 900; e.kby += (dy / dl) * 900; this.stunE(e, 0.4); }
              for (const o of this.enemiesNear(e.x, e.y, 30)) if (o !== e && !o.def.elite) { const dx = o.x - al.x, dy = o.y - al.y, dl = Math.hypot(dx, dy) || 1; o.kbx += (dx / dl) * 500; o.kby += (dy / dl) * 500; }
            } else if (sp === 'fire') {
              this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 38, elem: 'fire', fx: 'pillar' });
              for (const o of this.enemiesNear(e.x, e.y, 38)) { if (o !== e) this.damageEnemy(o, al.atk * 1.1, 'mag', { src: 'aoe', elem: 'fire' }); this.applyStatus(o, 'burn', 3); }
              this.zones.push({ kind: 'fire', x: e.x, y: e.y, r: 22, t: 2.5, max: 2.5, tick: 0, atk: al.atk });
            } else {
              for (const o of this.enemiesNear(e.x, e.y, 30)) { o.rooted = Math.max(o.rooted || 0, 2); o.vineT0 = this.t; this.stunE(o, o.def.elite ? 0.6 : 2); o.windT = 0; }
              this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 30, fx: 'vines' });
            }
          } });
        }
      } else if (al.kind === 'spirit') {
        al.phase += DT * 2.2 * (p.buffs.wind ? 1.4 : 1);
        const idx = this.allies.filter((a) => a.kind === 'spirit').indexOf(al);
        const a = al.phase + idx * 2.1;
        al.x += (p.x + Math.cos(a) * 20 - al.x) * 0.2; al.y += (p.y - 10 + Math.sin(a) * 12 - al.y) * 0.2;
        const tgt = near(180);
        if (tgt && al.cd <= 0) {
          al.cd = (al.elem === 'lightning' ? 0.45 : al.elem === 'ice' ? 1.0 : 0.8) / (p.buffs.wind ? 1.35 : 1);
          if (al.elem === 'lightning') {
            this.emit({ t: 'bolt', pts: [{ x: al.x, y: al.y }, { x: tgt.x, y: tgt.y - 6 }], color: ELEM.lightning.color });
            this.damageEnemy(tgt, al.atk, 'mag', { src: 'aoe', elem: 'lightning' }); this.applyStatus(tgt, 'shock', 1);
          } else {
            const vx = tgt.x - al.x, vy = tgt.y - al.y, l = Math.hypot(vx, vy) || 1;
            this.projs.push({ owner: 'p', x: al.x, y: al.y, vx: vx / l * 220, vy: vy / l * 220, life: 1, dmg: al.atk * 1.4, type: 'mag', pierce: 0, hit: new Set(), color: ELEM[al.elem].color, kind: 'skill', elem: al.elem, noTrigger: true,
              skillHit: (e) => { this.damageEnemy(e, al.atk * 1.4, 'mag', { src: 'aoe', elem: al.elem }); this.applyStatus(e, ELEM[al.elem].status, 1); } });
          }
        }
      } else if (al.kind === 'grasper' || al.kind === 'lichMage') {
        this.updateNecroSpecial(al, p);
      } else {
        // 망령·사령 군주·분신: 적을 쫓아가 공격
        // 부하마다 다른 적을 고른다: 이미 다른 부하가 노리는 적은 덜 고른다 (1초마다 다시 고름)
        let tgt;
        const leashed = al.kind === 'soul' || al.kind === 'skeleton' || al.kind === 'ghost' || al.kind === 'lich';
        const pd = Math.hypot(al.x - p.x, al.y - p.y);
        if (leashed) {
          if (pd > 360) { al.x = p.x + this.rng.range(-10, 10); al.y = p.y + this.rng.range(-10, 10); if (this.blocked(al.x, al.y, 4)) { al.x = p.x; al.y = p.y; } this.emit({ t: 'summonFx', x: al.x, y: al.y, kind: al.kind }); }
          if (pd > 150) al.returning = true;
          else if (pd < 60) al.returning = false;
          if (al.returning) al.tgt = null;
        }
        if (al.returning) tgt = null;
        else if (al.kind === 'soul' || al.kind === 'skeleton' || al.kind === 'ghost') {
          al.pickT = (al.pickT || 0) - DT;
          if (!al.tgt || al.tgt.dead || al.tgt.hidden || al.pickT <= 0) {
            al.pickT = 1;
            const claims = new Map();
            for (const o of this.allies) if (o !== al && o.tgt && !o.tgt.dead) claims.set(o.tgt.id, (claims.get(o.tgt.id) || 0) + 1);
            let best = null, bs = 1e9;
            for (const e of this.enemies) {
              if (!this.targetable(e)) continue;
              const dd = Math.hypot(e.x - al.x, e.y - al.y);
              if (dd > 220 || Math.hypot(e.x - p.x, e.y - p.y) > 130) continue;
              const sc = dd + (claims.get(e.id) || 0) * 70;
              if (sc < bs) { bs = sc; best = e; }
            }
            al.tgt = best;
          }
          tgt = al.tgt;
          if (tgt && Math.hypot(tgt.x - p.x, tgt.y - p.y) > 160) { al.tgt = null; tgt = null; }
        } else tgt = near(al.kind === 'clone' ? 120 : 220);
        let tx = p.x + (al.kind === 'clone' ? -p.dir * 14 : 0), ty = p.y;
        // 할 일이 없으면 내 주위에 둥글게 선다
        if (!tgt && al.kind !== 'clone') { const a = al.phase + al.id * 1.3; tx = p.x + Math.cos(a) * 24; ty = p.y + Math.sin(a) * 16; }
        if (tgt) { tx = tgt.x; ty = tgt.y; }
        const vx = tx - al.x, vy = ty - al.y, l = Math.hypot(vx, vy) || 1;
        const spd = al.kind === 'lich' ? 70 : al.kind === 'skeleton' || al.kind === 'soul' ? 95 : 110;
        al.r = al.r || 5;
        if (l > (tgt ? tgt.r + 8 : 6)) {
          const x0 = al.x, y0 = al.y;
          if (al.forcePath > 0) al.forcePath -= DT;
          const [mx, my] = this.pathDir(al, tx, ty);
          this.move(al, mx * spd * DT * (al.returning ? 1.4 : 1), my * spd * DT * (al.returning ? 1.4 : 1));
          // 벽에 끼었나: 가려는데 거의 못 움직이면 → 칸 단위 길찾기로 바꾸고, 그래도 오래 못 가면 내 곁 빈자리로 옮긴다
          if (Math.hypot(al.x - x0, al.y - y0) < spd * DT * 0.2) { al.stuckT = (al.stuckT || 0) + DT; if (al.stuckT > 0.25) al.forcePath = 1.2; } else al.stuckT = Math.max(0, (al.stuckT || 0) - DT * 2);
          if (al.stuckT > 1.6) { this.allyRescue(al); al.stuckT = 0; }
        } else al.stuckT = 0;
        for (const o of this.allies) { // 부하끼리 겹치지 않게 살짝 밀어 낸다 (벽 안으로는 밀지 않는다)
          if (o === al || o.kind === 'spirit' || o.kind === 'spiritKing') continue;
          const dx = al.x - o.x, dy = al.y - o.y, dd = Math.hypot(dx, dy);
          if (dd < 12 && dd > 0.01) this.move(al, (dx / dd) * (12 - dd) * 0.25, (dy / dd) * (12 - dd) * 0.25);
          else if (dd <= 0.01) this.move(al, al.id % 2 ? 1 : -1, 0);
        }
        if (this.blocked(al.x, al.y, Math.max(3, al.r - 1))) this.allyRescue(al); // 이미 벽에 박혀 있으면 바로 빼낸다
        if (Math.abs(vx) > 1) al.dir = vx > 0 ? 1 : -1;
        if (tgt && l < tgt.r + 14 && al.cd <= 0) {
          al.cd = al.kind === 'lich' ? 0.9 : al.kind === 'clone' ? 0.45 : al.kind === 'skeleton' ? 0.6 : al.kind === 'soul' ? 0.8 : 0.7;
          this.emit({ t: 'allyHit', x: tgt.x, y: tgt.y, kind: al.kind });
          if (al.kind === 'lich') { for (const e of this.enemiesNear(tgt.x, tgt.y, 40)) { this.damageEnemy(e, al.atk, 'mag', { src: 'aoe', elem: 'dark' }); this.applyStatus(e, 'curse', 1); } }
          else this.damageEnemy(tgt, al.atk, al.kind === 'clone' || al.kind === 'skeleton' || al.kind === 'soul' ? 'phys' : 'mag', { src: 'aoe', elem: al.kind === 'ghost' ? 'dark' : undefined });
        }
      }
      if (al.tauntT > 0) al.tauntT -= DT;
      if (al.maxHp && al.hp <= 0) al.t = 0;
      if (al.t <= 0 && al.mref) { const i = this.minions.indexOf(al.mref); if (i >= 0) this.minions.splice(i, 1); } // 쓰러진 부하는 사라진다
      if (al.t <= 0) this.emit({ t: 'summonFx', x: al.x, y: al.y, kind: al.kind, elem: al.elem, out: true });
    }
    this.allies = this.allies.filter((a) => a.t > 0);
  },

  // 사령술사의 특별한 부하: 붙잡는 망령 · 리치
  updateNecroSpecial(al, p) {
    const pd = Math.hypot(al.x - p.x, al.y - p.y);
    if (pd > 360) { al.x = p.x; al.y = p.y; this.emit({ t: 'summonFx', x: al.x, y: al.y, kind: al.kind }); }
    const foes = this.enemies.filter((e) => this.targetable(e));
    let tx, ty;
    if (al.kind === 'grasper') { // 내 뒤쪽 비스듬히 50만큼 떨어져 떠 있다
      al.side ||= -(p.dir || 1); // 처음 불렀을 때 내 뒤쪽 · 그 뒤로는 그쪽을 지킨다 (끌고 간 적이 다시 내 앞으로 오지 않게)
      const a = Math.atan2(-0.35, al.side); tx = p.x + Math.cos(a) * 125; ty = p.y + Math.sin(a) * 70; // 나와 멀리 떨어져 떠 있다
      al.chg = (al.chg || 0) + DT;
      if (al.chg >= 5) {
        let best = null, bd = 200;
        for (const e of foes) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
        if (best) {
          al.chg = 0; al.dir = best.x > al.x ? 1 : -1;
          best.graspT = 1.2; best.graspTo = al; best.graspK = 1; /* 정예까지 망령 앞까지 끝까지 끌려간다 */ best.graspX0 = best.x; best.graspY0 = best.y; best.kbx = 0; best.kby = 0; this.aggro(best);
          this.emit({ t: 'graspArm', x1: al.x, y1: al.y - 8, x2: best.x, y2: best.y - 6 });
        } else al.chg = 5;
      }
    } else { // 리치: 가장 가까운 적과 90쯤 떨어져 어둠 탄을 쏘고, 8초마다 해골을 일으킨다
      let tgt = null, bd = 240;
      for (const e of foes) { const d = Math.hypot(e.x - al.x, e.y - al.y); if (d < bd && Math.hypot(e.x - p.x, e.y - p.y) < 200) { bd = d; tgt = e; } }
      if (tgt) { const d = bd || 1, k = d < 70 ? -1 : d > 110 ? 1 : 0; tx = al.x + (tgt.x - al.x) / d * 30 * k; ty = al.y + (tgt.y - al.y) / d * 30 * k; al.dir = tgt.x > al.x ? 1 : -1; }
      else { const a = al.phase + al.id * 1.3; tx = p.x + Math.cos(a) * 30; ty = p.y + Math.sin(a) * 20; }
      if (tgt && al.cd <= 0) {
        al.cd = 1.2; al.castT = 0.35; const vx = tgt.x - al.x, vy = tgt.y - al.y, l = Math.hypot(vx, vy) || 1;
        this.projs.push({ owner: 'p', x: al.x, y: al.y - 10, vx: vx / l * 230, vy: vy / l * 230, life: 1.2, dmg: al.atk, type: 'mag', pierce: 0, hit: new Set(), color: '#b06aff', kind: 'skill', elem: 'dark', noTrigger: true,
          skillHit: (e) => { this.damageEnemy(e, al.atk, 'mag', { src: 'aoe', elem: 'dark' }); this.applyStatus(e, 'curse', 1); } });
      }
      al.raiseT = (al.raiseT ?? 3) - DT;
      if (al.raiseT <= 0) {
        al.raiseT = 8; al.liftT = 0.9;
        if (this.allies.filter((o) => o.lichOf === al.id && o.t > 0).length < 3) {
          const a = this.rng.range(0, Math.PI * 2); let x = al.x + Math.cos(a) * 16, y = al.y + Math.sin(a) * 16; if (this.blocked(x, y, 4)) { x = al.x; y = al.y; }
          const hp = this.d.maxHp * 0.2;
          this.allies.push({ id: this.nextId++, kind: 'skeleton', lichOf: al.id, hp, maxHp: hp, x, y, t: 15, max: 15, atk: al.atk * 0.45, cd: 0.5, phase: a, dir: 1, r: 5 });
          this.emit({ t: 'summonFx', x, y, kind: 'skeleton' });
        }
      }
    }
    const vx = tx - al.x, vy = ty - al.y, l = Math.hypot(vx, vy);
    if (l > 4) { const sp = (al.kind === 'grasper' ? 120 : 75) * DT * (pd > 150 ? 1.6 : 1); al.r = al.r || 5; if (al.kind === 'grasper') { al.x += vx / l * Math.min(l, sp); al.y += vy / l * Math.min(l, sp); } else { const [mx, my] = this.pathDir(al, tx, ty); this.move(al, mx * sp, my * sp); } }
    if (al.kind !== 'lichMage' || !al.dir) al.dir = al.dir || p.dir;
    if (al.castT > 0) al.castT -= DT; if (al.liftT > 0) al.liftT -= DT;
  },
  updateFamiliar() {
    const p = this.player, f = p.familiar;
    if (!f) { if (p.buffs.spiritBond) delete p.buffs.spiritBond; if (p.buffs.spiritGuard) delete p.buffs.spiritGuard; delete p.buffs.spiritBond2; delete p.buffs.spiritBond3; p.famExtra = null; return; }
    f.t -= DT; if (f.emp > 0) f.emp -= DT; if (f.guard > 0) f.guard -= DT;
    if (this.t - (p.lastFight ?? -99) < 5 && !this.practice) { f.xpAcc = (f.xpAcc || 0) + DT * (this.f.has('spiritBond') ? 1.5 : 1); if (f.xpAcc >= 5) { this.signals.push({ t: 'spiritXp', id: f.id, v: f.xpAcc }); f.xpAcc = 0; } } // 함께 싸운 시간 → 정령 레벨
    if (f.t <= 0 || this.state !== 'play') { this.emit({ t: 'spiritOut', x: f.x, y: f.y + 10, elem: SPIRIT_DMG_ELEM[f.elem] }); p.familiar = null; p.famExtra = null; delete p.buffs.spiritBond; delete p.buffs.spiritGuard; delete p.buffs.spiritBond2; delete p.buffs.spiritBond3; return; }
    // 어깨 위 (내 뒤쪽)로 따라온다
    f.phase += DT * 2.2;
    const tx = p.x - p.dir * 13, ty = p.y - 20 + Math.sin(f.phase) * 2, k = Math.min(1, DT * 6);
    f.x += (tx - f.x) * k; f.y += (ty - f.y) * k;
    // 버프: 나와 있는 동안 (강화 중이면 1.5배)
    const S = SPIRITS[f.id], E = SPIRIT_ELEMS[f.elem], col = ELEM[SPIRIT_DMG_ELEM[f.elem]]?.color || '#9bffb0';
    p.buffs.spiritBond = { t: f.t, max: f.max, mods: buffMods(spiritBuff(f.id, f.star, f.emp > 0 ? 1.5 : 1, f.lv)), color: col, name: `${S.name}${'★'.repeat(f.star)} Lv ${f.lv}`, spirit: true };
    if (f.guard > 0) { // 정령의 품: 받는 피해 -40% · 다가온 적을 밀쳐낸다
      p.buffs.spiritGuard = { t: f.guard, max: 4, mods: { dmgTakenMul: 0.6 }, color: col, name: '정령의 품' };
      if ((f.pushT = (f.pushT || 0) - DT) <= 0) { f.pushT = 0.5; for (const e of this.enemiesNear(p.x, p.y, 34)) { if (e.def.ai === 'dummy') continue; const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1, kb = e.def.elite ? 120 : 260; e.kbx += (dx / l) * kb; e.kby += (dy / l) * kb; } }
    } else delete p.buffs.spiritGuard;
    for (const x of p.famExtra || []) { // 둘째 · 셋째 정령: 뒤쪽에 줄지어 따라오며 버프 70%, 따로 쏜다
      x.phase += DT * 2.2;
      const ex = p.x - p.dir * (13 + 11 * x.slot), ey = p.y - 22 + x.slot * 5 + Math.sin(x.phase) * 2, kk = Math.min(1, DT * 5);
      x.x += (ex - x.x) * kk; x.y += (ey - x.y) * kk;
      const XS = SPIRITS[x.id], xc = ELEM[SPIRIT_DMG_ELEM[x.elem]]?.color || '#9bffb0';
      p.buffs['spiritBond' + (x.slot + 1)] = { t: f.t, max: f.max, mods: buffMods(spiritBuff(x.id, x.star, 0.7 * (f.emp > 0 ? 1.5 : 1), x.lv)), color: xc, name: `${XS.name}${'★'.repeat(x.star)} Lv ${x.lv}`, spirit: true };
      x.emp = f.emp; this.famShoot(x);
    }
    this.famShoot(f);
    this.famSpecial(f);
  },
  // 정령의 공격: 내 둘레 150 안의 가장 가까운 적에게 속성 탄 (강화 중이면 2배 빠르게 · 피해 +60%)
  famSpecial(f) { // 정령 고유 기술 (data/spirits.js SPIRIT_SPECIAL)
    const p = this.player;
    f.sp = (f.sp ?? 3) - DT * (f.emp > 0 ? 2 : 1);
    if (f.sp > 0) return;
    const near = this.enemies.filter((e) => this.targetable(e) && Math.hypot(e.x - p.x, e.y - p.y) < 170).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    if (!near.length) { f.sp = 0.5; return; }
    f.sp = spiritSpecialCd(f.grade);
    const king = f.grade >= 3, X = SPIRIT_SPECIAL[f.elem], elem = SPIRIT_DMG_ELEM[f.elem], col = ELEM[elem]?.color || '#9bffb0';
    const pow = this.skillAtk('best') * spiritPower(f.id, f.star, f.lv) * (f.emp > 0 ? 1.4 : 1);
    const hit = (e, m, st, n = 1) => { this.damageEnemy(e, pow * m, 'mag', { src: 'spirit', elem, color: col }); if (st && !e.dead) this.applyStatus(e, st, n); };
    const t0 = near[0];
    this.emit({ t: 'text', x: f.x, y: f.y - 16, text: king ? X.king : X.name, color: col });
    switch (f.elem) {
      case 'fire': { const r = king ? 70 : 40; this.emit({ t: 'skillAoe', x: t0.x, y: t0.y, r, elem: 'fire', fx: 'burst', ult: king }); for (const e of this.enemiesNear(t0.x, t0.y, r)) hit(e, king ? 3.0 : 1.4, 'burn', king ? 4 : 2); break; }
      case 'ice': {
        if (king) { this.emit({ t: 'skillAoe', x: p.x, y: p.y, r: 90, elem: 'ice', fx: 'zero', ult: true }); for (const e of this.enemiesNear(p.x, p.y, 90)) { hit(e, 1.6, 'chill', 3); if (!e.dead) e.st.stun = Math.max(e.st.stun || 0, 1.2); } }
        else { this.emit({ t: 'skillAoe', x: t0.x, y: t0.y, r: 22, elem: 'ice', fx: 'shatter' }); hit(t0, 1.2, 'chill', 3); if (!t0.dead) t0.st.stun = Math.max(t0.st.stun || 0, 1.0); }
        break;
      }
      case 'lightning': { for (const e of near.slice(0, king ? 6 : 3)) { this.emit({ t: 'bolt', pts: [{ x: e.x + 6, y: e.y - 120 }, { x: e.x - 4, y: e.y - 60 }, { x: e.x, y: e.y - 6 }], color: col }); hit(e, king ? 1.8 : 1.1, 'shock', 1); } break; }
      case 'wind': {
        const r = king ? 90 : 60; this.emit({ t: 'skillAoe', x: p.x, y: p.y, r, elem: 'wind', fx: 'burst', ult: king });
        for (const e of this.enemiesNear(p.x, p.y, r)) { hit(e, king ? 1.6 : 0.9); const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1, k = (king ? 260 : 180) * (e.def.elite || e.champion ? 0.3 : 1); e.kbx = (e.kbx || 0) + (dx / l) * k; e.kby = (e.kby || 0) + (dy / l) * k; }
        if (king) p.buffs.spiritGale = { t: 4, max: 4, mods: { moveSpeed: 1.25 }, color: col, name: '폭풍의 눈' };
        break;
      }
      case 'forest': {
        const r = king ? 80 : 60; this.emit({ t: 'skillAoe', x: p.x, y: p.y, r, elem: 'forest', fx: 'spikes', ult: king });
        for (const e of this.enemiesNear(p.x, p.y, r)) { hit(e, king ? 1.4 : 0.8, 'poison', 1); if (!e.dead) e.st.stun = Math.max(e.st.stun || 0, 1.2); }
        if (king) p.shield = Math.min(this.d.maxHp * 0.4, (p.shield || 0) + this.d.maxHp * 0.08);
        break;
      }
      case 'dark': {
        if (king) { this.emit({ t: 'skillAoe', x: t0.x, y: t0.y, r: 80, elem: 'dark', fx: 'doom', ult: true }); for (const e of this.enemiesNear(t0.x, t0.y, 80)) hit(e, 2.6, 'curse', 3); }
        else for (const e of near.slice(0, 3)) { this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 18, elem: 'dark', fx: 'doom' }); hit(e, 0.8, 'curse', 3); }
        break;
      }
    }
  },
};

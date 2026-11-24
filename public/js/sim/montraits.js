// World — 몬스터 특성: 몬스터마다 「이렇게 상대한다」는 규칙 하나 (data/monsters.js 의 MON_TRAIT 표)
// World.prototype 에 그대로 붙는다 (sim/world.js 끝). 메서드 안의 this 는 World
//   shield   방패병: 앞쪽 공격은 방패(체력 2배)가 먼저 받는다 · 등 뒤는 피해 1.5배 · 아주 느리게 돈다
//   stone    석화: 체력이 60% 밑이면 돌이 되어 5초 동안 움직이지 못하고 받는 피해 -80% (재사용 12초)
//   dig      구멍 파기: 땅속으로 들어가 다가왔다가 튀어나오며 둘레를 친다 (땅속에서는 맞지 않는다)
//   caster   마법: 멈춰서 1.2초 주문을 외우고 내 자리에 마법을 떨어뜨린다 (예고 원)
//   feign    죽은 척: 처음 쓰러지면 3초 동안 죽은 척하다가 체력 40%로 일어난다
//   split    분열: 쓰러지면 작은 것 둘로 갈라진다 (갈라진 것은 다시 갈라지지 않는다)
//   callHelp 도움 요청: 체력이 35% 밑이면 달아나며 둘레의 몬스터를 부른다 (한 번)
//   rammer   돌진꾼: 돌진하다 벽에 부딪히면 2초 기절 · 받는 피해 +50%
//   healer   치유사: 4초마다 둘레의 가장 다친 몬스터를 최대 체력 15% 회복
//   bomber   폭탄: 밀쳐내면 그 자리에서 바로 터지고, 터지면 둘레의 몬스터도 다친다
//   stalker  은신: 거의 보이지 않다가 가까이 오거나 맞으면 드러난다
//   carapace 갑각: 껍질(최대 체력 60%)이 남아 있으면 받는 피해 -75% · 깨지면 그대로
import { DT } from './world.js';

const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const TraitMethods = {
  traitInit(e) {
    const t = e.def.trait; if (!t) return;
    e.trait = t;
    if (t === 'shield') { e.shieldHp = e.maxHp * 2; e.face = 0; }
    if (t === 'carapace') e.shellHp = e.maxHp * 0.6;
    if (t === 'stalker') e.cloak = true;
    if (t === 'stone' || t === 'dig' || t === 'caster' || t === 'healer') e.trCd = 2 + this.rng.range(0, 2);
  },

  // 이번 틱을 특성이 맡았으면 true (평소 걷기 · 휘두르기는 쉰다)
  traitTick(e, p, dist, frozen) {
    const t = e.trait;
    if (e.trCd > 0) e.trCd -= DT;
    if (e.dazedT > 0) e.dazedT -= DT;
    if (e.stunSelfT > 0) { e.stunSelfT -= DT; e.moving = false; return true; } // 돌진꾼: 벽에 부딪혀 어질어질
    if (t === 'shield') { // 방패: 아주 느리게 나를 향해 돈다 (등 뒤로 돌아가면 한동안 등을 보인다)
      const want = Math.atan2(p.y - e.y, p.x - e.x), d = ang(want - e.face), turn = 0.9 * DT;
      e.face += Math.max(-turn, Math.min(turn, d));
      e.dir = Math.cos(e.face) >= 0 ? 1 : -1; e.faceLock = true;
      return false;
    }
    if (t === 'stone') {
      if (e.stoneT > 0) { e.stoneT -= DT; e.moving = false; e.windT = 0; if (e.stoneT <= 0) { e.tintX = null; this.emit({ t: 'text', x: e.x, y: e.y - 22, text: '돌이 풀렸다', color: '#c8c0b0' }); } return true; }
      if (!frozen && e.trCd <= 0 && e.hp < e.maxHp * 0.6) { e.stoneT = 5; e.trCd = 12; e.tintX = 'grayscale(1) brightness(0.95) contrast(1.2)'; this.emit({ t: 'text', x: e.x, y: e.y - 22, text: '석화!', color: '#c8c0b0' }); this.emit({ t: 'crackHit', x: e.x, y: e.y }); return true; }
      return false;
    }
    if (t === 'dig') {
      if (e.digInT > 0) { e.digInT -= DT; e.moving = false; e.windT = 0; if (e.digInT <= 0) { e.under = true; e.digT = 1.8; } return true; } // 땅을 파고 들어가는 중 (0.5초 · 그림은 renderer)
      if (e.under) {
        e.digT -= DT;
        const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
        if (l > 14 && e.digT > 0.5) this.move(e, (dx / l) * e.def.speed * 1.6 * DT, (dy / l) * e.def.speed * 1.6 * DT);
        if (e.digT <= 0.5 && !e.digTele) { e.digTele = true; this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 34, dur: 0.5 }); }
        if (e.digT <= 0) {
          e.under = false; e.digTele = false;
          this.emit({ t: 'emerge', x: e.x, y: e.y, id: e.id }); this.emit({ t: 'shake', v: 3 });
          this.enemyArea(e, e.x, e.y, 34, e.atk * 1.3, e.def.type);
        }
        return true;
      }
      if (!frozen && e.trCd <= 0 && dist > 40 && dist < 220) { e.digInT = 0.5; e.trCd = 8; this.emit({ t: 'text', x: e.x, y: e.y - 20, text: '땅속으로!', color: '#c8a878' }); return true; }
      return false;
    }
    if (t === 'caster') {
      if (e.castT > 0) {
        e.castT -= DT; e.moving = false;
        if (e.castT <= 0) { const c = e.castAt; this.emit({ t: 'skillAoe', x: c.x, y: c.y, r: 36, elem: e.def.type === 'mag' ? 'arcane' : 'phys', fx: 'burst' }); this.enemyArea(e, c.x, c.y, 36, e.atk * 1.6, 'mag'); }
        return true;
      }
      if (!frozen && e.trCd <= 0 && dist < 200) { e.castT = 1.2; e.trCd = 5; e.castAt = { x: p.x, y: p.y }; this.emit({ t: 'telegraphCircle', x: p.x, y: p.y, r: 36, dur: 1.2 }); this.emit({ t: 'text', x: e.x, y: e.y - 22, text: '주문!', color: '#c9a8ff' }); return true; }
      return false;
    }
    if (t === 'feign' && e.feignT > 0) {
      e.feignT -= DT; e.moving = false; e.windT = 0;
      if (e.feignT <= 0) { e.hp = e.maxHp * 0.4; this.emit({ t: 'text', x: e.x, y: e.y - 22, text: '속았지!', color: '#ff7a5a' }); e.atkCd = 0; }
      return true;
    }
    if (t === 'callHelp' && !e.calledHelp && e.hp < e.maxHp * 0.35) {
      e.calledHelp = true; e.st.flee = 2.5;
      let n = 0; for (const o of this.enemies) if (o !== e && !o.dead && o.state !== 'chase' && Math.hypot(o.x - e.x, o.y - e.y) < 220) { this.aggro(o); n++; }
      this.emit({ t: 'text', x: e.x, y: e.y - 22, text: n ? '도와줘!' : '살려 줘!', color: '#ffcf5a' });
      return false;
    }
    if (t === 'healer' && !frozen && e.trCd <= 0) {
      let best = null; for (const o of this.enemies) if (!o.dead && !o.hidden && o.hp < o.maxHp * 0.9 && Math.hypot(o.x - e.x, o.y - e.y) < 120 && (!best || o.hp / o.maxHp < best.hp / best.maxHp)) best = o;
      if (best) { e.trCd = 4; const v = best.maxHp * 0.15; best.hp = Math.min(best.maxHp, best.hp + v); this.emit({ t: 'healBeam', x1: e.x, y1: e.y - 10, x2: best.x, y2: best.y - 10 }); this.emit({ t: 'text', x: best.x, y: best.y - 22, text: `+${Math.round(v)}`, color: '#8af08a' }); this.emit({ t: 'bossHeal', id: best.id }); }
      return false;
    }
    if (t === 'stalker') { if (dist < 50 || e.windT > 0) e.revealT = Math.max(e.revealT || 0, 0.5); if (e.revealT > 0) e.revealT -= DT; return false; }
    if (t === 'rammer' && e.ai?.mode === 'dash') { // 앞이 벽이면 부딪혀 기절
      const ax = e.ai.dx, ay = e.ai.dy;
      if (this.blocked(e.x + ax * (e.r + 6), e.y + ay * (e.r + 6), 4)) { e.ai.mode = 'move'; e.ai.t = 3; e.stunSelfT = 2; e.dazedT = 2; this.emit({ t: 'text', x: e.x, y: e.y - 22, text: '쿵! 기절', color: '#ffd060' }); this.emit({ t: 'shake', v: 4 }); return true; }
    }
    if (t === 'bomber' && e.fuse <= 0 && Math.hypot(e.kbx, e.kby) > 150) { e.fuse = 0.05; e.knockedBomb = true; } // 밀쳐내면 바로 터진다
    return false;
  },

  // 받는 피해 배율 (석화 · 방패 등 뒤 · 돌진꾼 기절 · 죽은 척 · 땅속)
  traitTakeMul(e, opt) {
    const t = e.trait;
    if (e.feignT > 0) return 0;
    if (t === 'stone' && e.stoneT > 0) return 0.2;
    if (e.dazedT > 0) return 1.5;
    if (t === 'shield' && !opt.fromDot) {
      const p = this.player, from = Math.atan2(p.y - e.y, p.x - e.x);
      if (Math.abs(ang(from - e.face)) > Math.PI * 0.6) return 1.5; // 등 뒤
    }
    return 1;
  },
  // 방패 · 껍질이 피해를 먼저 받는다: 남은 피해를 돌려준다
  traitAbsorb(e, dmg, opt) {
    if (e.trait === 'stalker' && dmg > 0) e.revealT = 2;
    if (e.trait === 'shield' && e.shieldHp > 0 && !opt.fromDot) {
      const p = this.player, from = Math.atan2(p.y - e.y, p.x - e.x);
      if (Math.abs(ang(from - e.face)) < Math.PI * 0.45) { // 앞쪽: 방패가 받는다
        const ab = Math.min(e.shieldHp, dmg); e.shieldHp -= ab; dmg -= ab;
        if (Math.random() < 0.35) this.emit({ t: 'block', x: e.x + Math.cos(e.face) * 8, y: e.y - 6 + Math.sin(e.face) * 6, small: true });
        if (e.shieldHp <= 0) { this.emit({ t: 'text', x: e.x, y: e.y - 26, text: '방패가 부서졌다!', color: '#e8d8b0' }); this.emit({ t: 'crackHit', x: e.x, y: e.y }); }
      }
    }
    if (e.trait === 'carapace' && e.shellHp > 0) {
      const cut = dmg * 0.75, ab = Math.min(e.shellHp, cut); e.shellHp -= ab; dmg -= ab;
      if (e.shellHp <= 0) { this.emit({ t: 'text', x: e.x, y: e.y - 26, text: '껍질이 깨졌다!', color: '#e8d8b0' }); this.emit({ t: 'crackHit', x: e.x, y: e.y }); }
    }
    return dmg;
  },
  // 쓰러질 때: true면 쓰러지지 않는다 (죽은 척)
  traitDeath(e) {
    if (e.trait === 'feign' && !e.feigned && !e.summoned) {
      e.feigned = true; e.feignT = 3; e.hp = 1; e.st = {}; e.windT = 0;
      this.emit({ t: 'thud', x: e.x, y: e.y }); // 쓰러진 척 (그림은 누운 몸 · render)
      return true;
    }
    if (e.trait === 'split' && !e.splitChild) {
      for (let i = 0; i < 2; i++) {
        const a = this.rng.range(0, Math.PI * 2); let x = e.x + Math.cos(a) * 10, y = e.y + Math.sin(a) * 10; if (this.blocked(x, y, 4)) { x = e.x; y = e.y; }
        const m = this.makeEnemy(e.defId, x, y, { summoned: true, noAffix: true });
        m.splitChild = true; m.hp = m.maxHp = e.maxHp * 0.35; m.scale = 0.7; m.r = Math.max(4, e.r * 0.7); m.state = 'chase'; m.noLoot = true; m.trait = null;
        this.enemies.push(m);
      }
      this.emit({ t: 'text', x: e.x, y: e.y - 20, text: '갈라졌다!', color: '#9be15d' });
    }
    if (e.trait === 'bomber' && e.knockedBomb && !e.boomed) { e.boomed = true; e.dead = true; for (const o of this.enemiesNear(e.x, e.y, e.def.boom?.r || 30)) if (o !== e && !o.dead) this.damageEnemy(o, e.atk * 2, 'true', { src: 'aoe', color: '#ffb030' }); e.dead = false; } // 밀려나 터지면 둘레의 몬스터도 (한 번만 · 서로 터뜨리며 끝없이 돌지 않게)
    return false;
  },
};

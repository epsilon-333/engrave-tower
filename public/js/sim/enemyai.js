// World — 적 · 보스의 움직임과 기술 (쫓기 · 거리장 · 보스 기술 고르기 · 진행)
// World.prototype 에 그대로 붙는다 (sim/world.js 끝). 메서드 안의 this 는 World

import { AFFIXES } from '../data/monsters.js';
import { RACE_FX } from '../data/races.js';
import { BOSS_FX } from '../data/tower.js';
import { bossCan, bossAlias, bossPickX, bossTickX } from './towerzone.js';
import { SKILLS } from '../data/skills.js';
import { BEAST, BEAST_CAN, BEAST_KIT, BEAST_NAMES } from './beastmoves.js';
import { TILE, T_WALL, T_LIQUID, T_CRACK, T_BUILD, T_GATE, T_DEEP } from './mapgen.js';
import { G } from '../data/maps/overworld.js';
import { ACTIVE_RANGE, AI_MOVES, DT, N8, STATUS_COLOR, distToSeg } from './world.js';

export const EnemyAiMethods = {
  updateEnemies() {
    const P = this.player, d = this.d, s = this.s, host = !!this.coop; // 파티 탑: 내가 맡은 몬스터는 내 세계가 움직인다
    this.coRec = host;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.puppet) { this.updatePuppet(e); continue; }
      const p = this.coPick(e); // 이 적이 노리는 대상: 처음 어그로를 끈 사람 · 동료 · 소환체
      this.coTgt = p === P ? null : p;
      const def = e.def;
      e.hitFlash = Math.max(0, e.hitFlash - DT);
      e.wobble = Math.max(0, e.wobble - DT);
      const dxp = p.x - e.x, dyp = p.y - e.y, dist = Math.hypot(dxp, dyp) || 1;

      if (e.remote) { // 결투 상대: 상대의 화면이 알려 준 자리로 부드럽게 (여기서는 움직이지도 때리지도 않는다)
        const k = Math.min(1, DT * 12), mx = e.tx - e.x, my = e.ty - e.y;
        e.moving = Math.hypot(mx, my) > 1; e.x += mx * k; e.y += my * k;
        continue;
      }
      if (def.ai === 'target') continue; // 수련 과녁 · 허수아비: 가만히 서 있다
      if (e.introT > 0) { e.introT -= DT; e.moving = false; continue; } // 보스 등장 연출
      if (def.ai === 'dummy') {
        if (this.t - e.lastHit > 3) { e.hp = e.maxHp; e.st = {}; e.dmgLog.length = 0; }
        e.dmgLog = e.dmgLog.filter(([t]) => this.t - t < 5);
        const sum = e.dmgLog.reduce((a, [, v]) => a + v, 0);
        const span = e.dmgLog.length ? Math.max(1, this.t - e.dmgLog[0][0]) : 1;
        e.dps = sum / span;
      } else if (dist > ACTIVE_RANGE && e.state !== 'chase') continue;
      e.reactCd = Math.max(0, e.reactCd - DT);
      const st = e.st;

      // 지속 피해
      let burn = 0, poison = 0, bleed = 0;
      if (st.burn) { burn = st.burn.n * (2 + d.magAtk * 0.12) * (1 + (s.fireAff || 0) * 0.04) * d.burnMul * (this.b.race === 'dragon' ? RACE_FX.dragonFire : 1); if ((st.burn.t -= DT) <= 0) st.burn = null; } // 용족: 화염 피해 (화상도)
      if (st.poison) {
        const deep = this.f.has('poisonDeep') ? 1 + Math.max(0, st.poison.n - 5) * 0.08 : 1;
        poison = st.poison.n * (1.5 + (s.toxicity || 0) * 0.6) * (st.septic > 0 ? 2 : 1) * deep;
        if ((st.poison.t -= DT) <= 0) st.poison = null;
      }
      if (e.armorBreakT > 0 && (e.armorBreakT -= DT) <= 0) e.armorBreak = 0;
      if (st.bleed) { bleed = st.bleed.n * (1.5 + d.physAtk * 0.1) * d.bleedMul; if ((st.bleed.t -= DT) <= 0) st.bleed = null; }
      if (st.chill && (st.chill.t -= DT) <= 0) st.chill = null;
      let curse = 0;
      if (st.curse && (st.curse.t -= DT) <= 0) st.curse = null; // 저주: 피해는 없다 · 약하게 만든다 (CURSE)
      for (const k of ['shock', 'weak', 'elemMark', 'fear', 'stun']) if (st[k] > 0) { st[k] -= DT; if (st[k] <= 0 && k === 'stun') e.prison = false; }
      if (this.b.race === 'dragon' && st.burn) this.addRes(DT * (this.raceRes.burnTick || 1), true);
      for (const k of ['frozen', 'mark', 'septic', 'slowZ']) if (st[k] > 0) st[k] -= DT;
      if (e.guardT > 0) e.guardT -= DT;
      if (e.exposedT > 0) e.exposedT -= DT;
      if (e.passives && !e.dead) this.bossPassiveTick(e);
      if (e.mirrorT > 0) e.mirrorT -= DT; // 반사 방패: 몸이 거울처럼 번쩍인다 (렌더러)
      if (e.rooted > 0) e.rooted -= DT;
      const dot = burn + poison + bleed + curse;
      if (dot > 0) this.damageEnemy(e, dot * DT, 'true', { src: 'dot' });
      if (e.dead) continue;
      if (e.trainFlee || e.bones > 0) continue; // 수련: 달아나는 랩터 · 뼈 무더기는 수련이 직접 다룬다
      if (e.dormant) { // 미믹: 가까이 오면 깨어난다
        if (Math.hypot(P.x - e.x, P.y - e.y) < 34) { e.dormant = false; e.state = 'chase'; this.aggro(e); this.emit({ t: 'text', x: e.x, y: e.y - 20, text: '미믹!', color: '#ff5a3a' }); this.emit({ t: 'shake', v: 2 }); }
        else continue;
      }
      if (e.invulnT > 0) e.invulnT -= DT;
      if (e.def.splitAt && !e.didSplit && !e.summoned && e.hp > 0 && e.hp < e.maxHp * e.def.splitAt) { // 물의 정령: 체력이 절반이 되면 둘로 갈라진다
        e.didSplit = true; const half = Math.round(e.hp / 2); e.hp = half;
        const c2 = this.makeEnemy(e.defId, e.x + 10, e.y, { summoned: true, noAffix: true }); c2.maxHp = e.maxHp; c2.hp = half; c2.atk = e.atk; c2.lv = e.lv; c2.rewardMul = e.rewardMul; c2.didSplit = true; c2.state = 'chase'; c2.home = { ...(e.home || { x: e.x, y: e.y }) };
        if (this.blocked(c2.x, c2.y, c2.r)) { c2.x = e.x; c2.y = e.y; }
        this.enemies.push(c2); this.emit({ t: 'text', x: e.x, y: e.y - 20, text: '갈라졌다', color: '#7ad0ff' }); this.emit({ t: 'ring', x: e.x, y: e.y, r: 18, color: '#4aa8e8' });
      }
      if (e.graspT > 0) { // 붙잡는 망령의 팔에 끌려간다 (정예는 반쯤까지)
        e.graspT -= DT;
        const G = e.graspTo, gap = (G.r || 5) + e.r + 6, ang = Math.atan2(e.graspY0 - G.y, e.graspX0 - G.x);
        const tx = e.graspX0 + (G.x + Math.cos(ang) * gap - e.graspX0) * e.graspK, ty = e.graspY0 + (G.y + Math.sin(ang) * gap - e.graspY0) * e.graspK;
        const rx = tx - e.x, ry = ty - e.y, rl = Math.hypot(rx, ry);
        if (rl > 3 && e.graspT > 0) { const sp = Math.min(rl, 560 * DT); this.move(e, (rx / rl) * sp, (ry / rl) * sp); } else { e.graspT = 0; e.st.stun = Math.max(e.st.stun || 0, 0.6); } // 다 끌려가면 0.6초 붙잡혀 있다
        continue;
      }
      if (e.reelT > 0) { // 작살에 끌려온다: 내 앞 (정예는 반쯤까지)
        e.reelT -= DT;
        const gap = P.r + e.r + 2, tx = P.x + (e.reelX0 - P.x) * (1 - e.reelK) + P.aimX * gap * e.reelK, ty = P.y + (e.reelY0 - P.y) * (1 - e.reelK) + P.aimY * gap * e.reelK;
        const rx = tx - e.x, ry = ty - e.y, rl = Math.hypot(rx, ry);
        if (rl > 3) { const sp = Math.min(rl, 640 * DT); this.move(e, (rx / rl) * sp, (ry / rl) * sp); } else e.reelT = 0;
        continue;
      }
      e.dotT -= DT;
      if (e.dotT <= 0) {
        e.dotT = 0.5;
        if (e.dotAcc >= 0.5) {
          const c = burn >= poison && burn >= bleed ? 'burn' : poison >= bleed ? 'poison' : 'bleed';
          this.emit({ t: 'dmg', x: e.x + this.rng.range(-4, 4), y: e.y - e.r - 4, v: e.dotAcc, color: STATUS_COLOR[c], small: true });
          e.dotAcc = 0;
        }
      }
      if (def.ai === 'dummy') continue;
      // 낚아채기: 화룡 전사에게 붙잡혀 함께 날아간다
      if (e.carried > 0) { e.x = P.x; e.y = P.y + 1; e.moving = false; continue; }
      if (e.link) {
        e.link.t -= DT;
        // 사슬이 너무 늘어나면 (같은 사슬의 가장 가까운 적과 220보다 멀면) 끊어진다
        if (e.link.t > 0 && (this.t * 60 | 0) % 15 === 0) { let nd = 1e9; for (const o of this.enemies) if (o !== e && !o.dead && o.link?.id === e.link.id) nd = Math.min(nd, Math.hypot(o.x - e.x, o.y - e.y)); if (nd > 220) { this.emit({ t: 'linkBreak', x: e.x, y: e.y - 8 }); e.link = null; } }
        if (e.link && e.link.t <= 0) e.link = null;
      }
      for (const k of ['flee', 'retrib']) if (st[k] > 0) st[k] -= DT;
      if (e.provokeT > 0) e.provokeT -= DT;
      if (e.loseT > 0) e.loseT -= DT;
      if (e.lureT > 0) e.lureT -= DT;
      if (e.bumpCd > 0) e.bumpCd -= DT;
      if (e.silenceT > 0) { e.silenceT -= DT; e.shotCd = Math.max(e.shotCd, 0.2); e.summonCd = Math.max(e.summonCd, 0.2); e.windT = 0; e.fuse = 0; if (e.ai.mode === 'wind' || e.ai.mode === 'dash') { e.ai.mode = 'move'; e.ai.t = 1; } }

      e.atkCd -= DT * e.atkRate; e.shotCd -= DT; e.summonCd -= DT;
      const frozen = st.frozen > 0 || st.stun > 0;
      let slow = st.chill ? Math.min(0.6, st.chill.n * 0.12 * d.chillMul) : 0;
      if (this.zone && this.zone.liquid !== 'lava' && this.zone.liquid !== 'mist' && this.tileAt(e.x, e.y + 3) === T_LIQUID && def.shape !== 'flyer') slow = Math.max(slow, 0.3);
      if (st.fear > 0) slow = Math.max(slow, 0.4);
      if (st.slowZ > 0) slow = Math.max(slow, 0.6);
      if (this.zones.some((z) => z.kind === 'sanctuary' && Math.hypot(e.x - z.x, e.y - z.y) < z.r)) slow = Math.max(slow, 0.5);
      let spd = frozen ? 0 : def.speed * e.speedMul * (1 - slow);
      let vx = 0, vy = 0;
      if (e.tauntT > 0) {
        e.tauntT -= DT;
        const al = e.taunt;
        if (al && al.t > 0 && al.hp > 0 && !e.hidden) {
          const tx = al.x - e.x, ty = al.y - e.y, tl = Math.hypot(tx, ty) || 1;
          if (tl > e.r + 8) this.move(e, (tx / tl) * spd * DT, (ty / tl) * spd * DT);
          if (Math.abs(tx) > 1) e.dir = tx > 0 ? 1 : -1;
          e.moving = tl > e.r + 8;
          if (!frozen && tl < e.r + 14 && e.atkCd <= 0) {
            e.atkCd = def.elite ? 1.3 : 1.1;
            if (al.shield1) { al.shield1 = false; this.emit({ t: 'text', x: al.x, y: al.y - 16, text: '막음', color: '#bfe8ff' }); } else al.hp -= e.atk * (al.tauntT > 0 ? 0.7 : 1); // 되살린 영혼: 첫 한 대는 보호막
            this.emit({ t: 'allyHurt', x: al.x, y: al.y, v: e.atk });
            this.emit({ t: 'strike', x: e.x, y: e.y, ang: Math.atan2(ty, tx), r: e.r + 10, id: e.id });
          }
          continue;
        }
        e.tauntT = 0; e.taunt = null;
      }

      // 상태 전환
      // 땅속 잠복: 가까이 오면 튀어나온다
      if (e.hidden) {
        if (dist < 64 && !frozen) {
          e.hidden = false; this.aggro(e);
          e.windT = 0.3; e.windMax = 0.3;
          this.emit({ t: 'emerge', x: e.x, y: e.y, id: e.id });
        }
        continue;
      }
      if (e.state === 'idle') {
        const aggroR = def.elite || e.champion ? 130 : 105;
        if (dist < aggroR) this.aggro(e);
      }
      // 집으로 돌아가는 중: 잠깐(0.8초) 지나면 다시 가까이 온 나를 알아본다 · 길이 막혀 6초 넘게 못 가면 그 자리에서 멈춘다 (나를 무시하고 영영 돌아가던 것)
      if (e.state === 'return') {
        e.retT = (e.retT || 0) + DT;
        const fromHome = Math.hypot(e.x - e.home.x, e.y - e.home.y);
        if (e.retT > 0.8 && dist < (def.elite || e.champion ? 110 : 90) && fromHome < 380 && !frozen) { e.retT = 0; this.aggro(e); }
        else if (e.retT > 6) { e.retT = 0; e.state = 'idle'; e.home = { x: e.x, y: e.y }; e.hp = e.maxHp; e.st = {}; }
      } else e.retT = 0;
      if (e.state === 'chase') {
        const fromHome = Math.hypot(e.x - e.home.x, e.y - e.home.y);
        e.leashT = dist > 260 ? e.leashT + DT : 0;
        if (!this.climb && (fromHome > 420 || e.leashT > 3)) { e.state = 'return'; e.mv = null; }
      }
      if (e.state === 'chase' && this.enemyMove(e, p, dist, frozen)) { e.kbx *= 0.85; e.kby *= 0.85; continue; } // 몬스터 기술 (연속 베기 · 뛰어들기 · 부채꼴 · 장판 · 회복 · 순간이동)

      if (e.state === 'idle') {
        e.wanderT -= DT;
        if (e.wanderT <= 0) {
          e.wanderT = this.rng.range(1.5, 3.5);
          e.wander = this.rng.chance(0.6) ? { x: e.home.x + this.rng.range(-40, 40), y: e.home.y + this.rng.range(-40, 40) } : null;
        }
        if (e.wander) {
          const wx = e.wander.x - e.x, wy = e.wander.y - e.y, wl = Math.hypot(wx, wy);
          if (wl > 4) { vx = wx / wl; vy = wy / wl; spd *= 0.35; } else e.wander = null;
        }
      } else if (e.state === 'return') {
        const hx = e.home.x - e.x, hy = e.home.y - e.y, hl = Math.hypot(hx, hy);
        if (hl < 10) { e.state = 'idle'; e.hp = e.maxHp; e.st = {}; }
        else { vx = hx / hl; vy = hy / hl; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3 * DT); }
      } else if (st.flee > 0) {
        vx = -dxp / dist; vy = -dyp / dist; spd *= 1.15;
      } else if (e.loseT > 0 || p.stealthT > 0) {
        // 나를 놓쳤다: 제자리 주변을 두리번거린다
        e.wanderT -= DT;
        if (e.wanderT <= 0) { e.wanderT = this.rng.range(0.6, 1.4); e.wander = { x: e.x + this.rng.range(-30, 30), y: e.y + this.rng.range(-30, 30) }; }
        if (e.wander) { const wx = e.wander.x - e.x, wy = e.wander.y - e.y, wl = Math.hypot(wx, wy); if (wl > 4) { vx = wx / wl; vy = wy / wl; spd *= 0.4; } }
      } else if (e.lureT > 0 && !(e.provokeT > 0)) {
        const lx = e.lureX - e.x, ly = e.lureY - e.y, ll = Math.hypot(lx, ly);
        if (ll > 10) { vx = lx / ll; vy = ly / ll; spd *= 1.1; }
      } else if (e.provokeT > 0 && def.ai !== 'flee') {
        // 도발: 원거리 적도 거리를 두지 않고 나에게 다가온다
        const [ux, uy] = this.chaseDir(e);
        vx = ux; vy = uy;
        if (def.ai === 'ranged' && !frozen && e.shotCd <= 0 && dist < 120) { e.shotCd = 2.2; this.enemyShot(e, Math.atan2(dyp, dxp), 1, 0); }
      } else {
        const [ux, uy] = this.chaseDir(e);
        if (def.ai === 'flee') {
          // 보물 고블린: 도망치다 시간이 지나면 사라진다
          vx = -dxp / dist; vy = -dyp / dist;
          e.fleeT = (e.fleeT || 0) + DT;
          if (e.fleeT > 22) { e.dead = true; this.emit({ t: 'text', x: e.x, y: e.y - 16, text: '도망쳤다…', color: '#ffcf5a' }); this.emit({ t: 'death', x: e.x, y: e.y, color: '#ffcf5a' }); continue; }
        } else if (def.ai === 'kamikaze') {
          // 다가와서 자폭 (도화선이 타는 동안 피할 수 있다)
          if (e.fuse > 0) {
            spd = 0; e.fuse -= DT;
            if (e.fuse <= 0 && !(e.silenceT > 0)) { this.explode(e); continue; }
          } else {
            vx = ux; vy = uy; spd *= 1.15;
            if (dist < e.r + p.r + 10) { e.fuse = 0.55; this.emit({ t: 'fuse', id: e.id }); }
          }
        } else if (def.ai === 'summoner') {
          if (dist > def.range) { vx = ux; vy = uy; }
          else if (dist < def.range * 0.6) { vx = -dxp / dist; vy = -dyp / dist; }
          if (!frozen && e.shotCd <= 0 && dist < def.range + 40) { e.shotCd = 2.4; this.enemyShot(e, Math.atan2(dyp, dxp), 1, 0); }
          const alive = this.enemies.filter((o) => o.summoner === e.id && !o.dead).length;
          if (!frozen && e.summonCd <= 0 && alive < 4) {
            e.summonCd = 7;
            for (let i = 0; i < 2; i++) {
              const a = this.rng.range(0, Math.PI * 2);
              let x = e.x + Math.cos(a) * 20, y = e.y + Math.sin(a) * 20;
              if (this.blocked(x, y, 6)) { x = e.x; y = e.y; }
              const m = this.makeEnemy(def.summon, x, y, { summoned: true });
              m.summoner = e.id; m.state = 'chase'; m.home = { ...e.home };
              this.enemies.push(m);
            }
            this.emit({ t: 'summon', x: e.x, y: e.y });
          }
        } else if (def.ai === 'chase' || def.ai === 'burrow') { vx = ux; vy = uy; }
        else if (def.ai === 'erratic') {
          const w = Math.sin(this.t * 4 + e.phase) * 0.9;
          vx = ux * Math.cos(w) - uy * Math.sin(w); vy = ux * Math.sin(w) + uy * Math.cos(w);
        } else if (def.ai === 'ranged') {
          if (dist > def.range) { vx = ux; vy = uy; }
          else if (dist < def.range * 0.55) { vx = -dxp / dist; vy = -dyp / dist; }
          else { vx = -dyp / dist * 0.5; vy = dxp / dist * 0.5; }
          if (!frozen && e.shotCd <= 0 && dist < def.range + 50) { e.shotCd = 1.9; this.enemyShot(e, Math.atan2(dyp, dxp), 1, 0); }
        } else if (def.ai === 'charge' || def.ai === 'boss') {
          const ai = e.ai;
          ai.t -= DT;
          if (ai.mode === 'move') {
            vx = ux; vy = uy;
            if (def.ai === 'boss' && def.proj && !frozen && e.shotCd <= 0 && dist < 220) { e.shotCd = 2.4; this.enemyShot(e, Math.atan2(dyp, dxp), def.proj.spread, 0.22); }
            if (ai.t <= 0 && dist < 180) { ai.mode = 'wind'; ai.t = 0.6; ai.dx = dxp / dist; ai.dy = dyp / dist; this.emit({ t: 'telegraph', id: e.id, x: e.x, y: e.y, dx: ai.dx, dy: ai.dy }); }
          } else if (ai.mode === 'wind') {
            spd = 0;
            if (ai.t <= 0) { ai.mode = 'dash'; ai.t = 0.45; }
          } else if (ai.mode === 'dash') {
            vx = ai.dx; vy = ai.dy; spd = frozen ? 0 : def.speed * 5;
            if (ai.t <= 0) { ai.mode = 'move'; ai.t = 3 + this.rng.range(0, 1) * 2; }
          }
        }
      }
      if (e.windT > 0) spd *= 0.15;
      e.moving = (vx || vy) && spd > 0;
      if (e.moving) e.walkT += DT;
      if (Math.abs(vx) > 0.1) e.dir = vx > 0 ? 1 : -1;
      const ex0 = e.x, ey0 = e.y, kbSpd = Math.hypot(e.kbx, e.kby);
      this.move(e, (vx * spd + e.kbx) * DT, (vy * spd + e.kby) * DT);
      if (e.kbHot > 0) this.knockCollide(e, ex0, ey0, kbSpd);
      e.kbx *= 0.85; e.kby *= 0.85;
      if (p === P && this.b.cls === 'behemoth' && (P.buffs.shell || P.buffs.giant) && !(e.bumpCd > 0) && dist < e.r + P.r + (P.buffs.giant ? 12 : 6)) {
        e.bumpCd = 0.6;
        const big = !!P.buffs.giant;
        if (!e.def.elite) { e.kbx += (-dxp / dist) * (big ? 640 : 440); e.kby += (-dyp / dist) * (big ? 640 : 440); e.kbHot = 0.45; e.kbAtk = this.skillAtk('phys'); }
        if (big) this.damageEnemy(e, this.skillAtk('phys') * 1.2, 'phys', { src: 'aoe' });
        this.emit({ t: 'bump', x: (e.x + p.x) / 2, y: (e.y + p.y) / 2 });
      }

      // 근접 공격: 예고(빨간 번쩍임) 후 타격 → 대시로 피할 수 있다
      if (e.windT > 0) {
        if (frozen) e.windT = 0;
        else {
          e.windT -= DT;
          if (e.windT <= 0) {
            e.atkCd = def.elite ? 1.3 : 1.1;
            const reach = e.r + p.r + (def.elite || e.champion ? 14 : 9);
            this.emit({ t: 'strike', id: e.id, x: e.x, y: e.y, ang: Math.atan2(dyp, dxp), r: reach + 4 });
            if (Math.hypot(p.x - e.x, p.y - e.y) < reach) {
              this.hurtPlayer(e.atk * (st.fear > 0 ? 0.7 : 1), def.type, e, { status: def.status || (e.affix && AFFIXES[e.affix].status) });
              if (st.retrib > 0) { this.damageEnemy(e, e.atk * 2, 'true', { src: 'aoe', color: '#c45cff' }); this.emit({ t: 'text', x: e.x, y: e.y - 20, text: '응보', color: '#c45cff' }); }
            }
          }
        }
      } else if (e.state === 'chase' && !frozen && !(e.silenceT > 0) && !(st.flee > 0) && !(e.loseT > 0) && !(p.stealthT > 0) && !(e.lureT > 0 && !(e.provokeT > 0)) && def.ai !== 'flee' && def.ai !== 'kamikaze' && dist < e.r + p.r + 6 && e.atkCd <= 0 && (def.ai !== 'charge' && def.ai !== 'boss' || e.ai.mode === 'move')) {
        e.windT = def.elite ? 0.5 : 0.38; e.windMax = e.windT;
        this.emit({ t: 'windup', id: e.id });
      }
      if (e.ai.mode === 'dash' && dist < e.r + p.r + 2 && e.atkCd <= 0) { e.atkCd = 1; this.hurtPlayer(e.atk * 1.2, def.type, e, { status: def.status }); }
    }
    this.coTgt = null; this.coRec = false;
    // 겹침 방지 (가까운 적끼리만 · 동료 화면의 꼭두각시는 방장이 정한 자리 그대로)
    const es = this.enemies.filter((e) => !e.dead && !e.puppet && Math.abs(e.x - P.x) < 300 && Math.abs(e.y - P.y) < 220);
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 0.01, min = a.r + b.r;
      if (dd < min) {
        const push = (min - dd) / 2;
        if (a.def.ai !== 'dummy') this.move(a, -(dx / dd) * push, -(dy / dd) * push);
        if (b.def.ai !== 'dummy') this.move(b, (dx / dd) * push, (dy / dd) * push);
      }
    }
  },

  exposeBoss(e, t, mul, text) { // 빈틈: 잠깐 멈추고 더 아프게 맞는다
    e.st.stun = Math.max(e.st.stun || 0, t); e.exposedT = t; e.exposeMul = mul; e.mv = null; e.windT = 0;
    this.emit({ t: 'text', x: e.x, y: e.y - 34, text: '약점!', color: '#ffe066' }); // 설명 문장 대신 한마디 (text는 예전 호출 그대로 받기만 한다)
    this.emit({ t: 'shake', v: 5 }); if (!this.bossThemed(e)) this.emit({ t: 'ring', x: e.x, y: e.y, r: e.r + 20, color: '#ffe066' }); // 그림 보스는 맞은 자세 그림이 빈틈을 알린다
  },
  bossPick(e, p, pick) {
    const say = (txt, col = '#ffd0a0') => this.emit({ t: 'text', x: e.x, y: e.y - 30, text: txt, color: col });
    const nm = e.skillNames?.[pick];
    const aim = Math.atan2(p.y - e.y, p.x - e.x);
    switch (pick) {
      case 'vent':
        e.mv = null; this.exposeBoss(e, 4, 2, e.kit?.ventText || '과열! 핵이 드러났다'); if (!this.bossThemed(e)) this.emit({ t: 'ring', x: e.x, y: e.y, r: 60, color: '#ff8a3a' }); return true;
      case 'donut': // 바깥 고리가 터진다: 안쪽(수호자 곁)이 안전
        say(nm || '고리 폭발'); e.mv = { k: 'donut', boss: true, t: 1.4, r1: 46, r2: 190 }; e.windT = 1.4; e.windMax = 1.4;
        this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 190, inner: 46, dur: 1.4 }); this.emit({ t: 'text', x: e.x, y: e.y - 44, text: '안으로!', color: '#9fffb0' }); return true;
      case 'sweep': { // 회전 광선: 예고 뒤 한쪽으로 돌며 쓸고 지나간다
        const dir = this.rng.chance(0.5) ? 1 : -1; say(`${nm || '회전 광선'} ${dir > 0 ? '⟳' : '⟲'}`);
        const sw = e.def.beamHold ? 3.6 : 2.2; e.mv = { k: 'sweep', boss: true, t: 1.0 + sw, sw, wind: 1.0, ang: aim - dir * 0.6, dir, hitT: 0 }; /* 쓸고 지나가는 시간 (각인의 왕은 길게 · 더 넓게) */ e.windT = 1.0; e.windMax = 1.0;
        this.emit({ t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(e.mv.ang) * 240, y2: e.y + Math.sin(e.mv.ang) * 240, dur: 1.0, color: '#ff3a3a', w: 10 }); return true;
      }
      case 'channel': // 회복 의식: 3초 동안 버티면 체력 18% 회복, 그동안 체력 7%만큼 맞으면 끊기고 기절
        say(nm || '회복 의식', '#7be38a'); this.emit({ t: 'text', x: e.x, y: e.y - 44, text: '끊어라!', color: '#ffe066' });
        e.mv = { k: 'channel', boss: true, t: 3, taken: 0, fx: 0 }; return true;
      case 'soar': // 날아오른다: 무적 · 불비 두 번 · 내 자리로 떨어진다
        say(nm || '비상'); e.mv = { k: 'soar', boss: true, t: 2.6, wave: 0 }; e.invulnT = 2.6; e.soaring = true; return true;
      case 'mirror':
        say(nm || '반사 방패', '#9fe8ff'); this.emit({ t: 'text', x: e.x, y: e.y - 44, text: '때리지 마라!', color: '#9fe8ff' });
        e.mirrorT = e.kit?.awake ? 3.2 : 2.6; e.mirrorFx = 0; return false;
      case 'clones': { // 분신 둘: 금방 부서진다. 셋이 자리를 섞는다
        say(nm || '분신', '#c8a8ff'); const spots = [];
        for (let i = 0; i < 3; i++) { const a = aim + Math.PI + (i - 1) * 1.3; let x = p.x + Math.cos(a) * 80, y = p.y + Math.sin(a) * 80; if (this.blocked(x, y, e.r)) { x = e.x; y = e.y; } spots.push({ x, y }); }
        spots.sort(() => this.rng.range(-1, 1));
        for (let i = 0; i < 2; i++) {
          const c = this.makeEnemy(e.defId, spots[i].x, spots[i].y, { summoned: true }); // 보스와 똑같은 모습 (예전엔 구역 정예 모습이라 가짜가 바로 티 났다)
          c.hp = c.maxHp = e.maxHp * (e.kit?.awake ? 0.04 : 0.025); c.atk = e.atk * 0.45; c.scale = e.scale; c.champion = e.champion; c.decoyOf = e.id; c.tintX = e.tintX; c.mirrorRace = e.mirrorRace; c.summoner = e.id; c.state = 'chase'; c.home = { ...e.home }; c.noLoot = true; c.mvCd = 9;
          this.enemies.push(c); e.blinkAt = this.t; this.emit({ t: 'blink', x1: e.x, y1: e.y, x2: c.x, y2: c.y });
        }
        e.blinkAt = this.t; this.emit({ t: 'blink', x1: e.x, y1: e.y, x2: spots[2].x, y2: spots[2].y }); e.x = spots[2].x; e.y = spots[2].y; return false;
      }
      case 'meteorRain': // 운석 비: 내 자리에 세 번 떨어진다 (계속 움직여야 산다)
        say(nm || '운석 비'); e.mv = { k: 'meteorRain', boss: true, t: 2.2, n: 0 }; return false;
      case 'crossBeam': { // 십자 광선: + 모양 → 비스듬한 × 모양 (사이의 틈으로 피한다)
        say(nm || '십자 광선'); const a0 = this.rng.range(0, Math.PI / 2);
        e.mv = { k: 'crossBeam', boss: true, t: 2.3, a0, stage: 0 }; e.windT = 2.3; e.windMax = 2.3;
        for (let i = 0; i < 4; i++) { const a = a0 + (i * Math.PI) / 2; this.emit({ t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * 260, y2: e.y + Math.sin(a) * 260, dur: 0.9, color: '#ff3a3a', w: 14 }); }
        return true;
      }
      case 'cleave': { // 정면 대베기: 앞쪽 거의 반원 — 등 뒤로 돌아가야 산다
        say(nm || '대베기'); e.mv = { k: 'cleave', boss: true, t: 1.2, ang: aim }; e.windT = 1.2; e.windMax = 1.2;
        for (let i = -4; i <= 4; i++) { const a = aim + i * 0.4; this.emit({ t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * 130, y2: e.y + Math.sin(a) * 130, dur: 1.2, color: '#ff5a3a', w: 4 }); }
        this.emit({ t: 'text', x: e.x, y: e.y - 44, text: '뒤로 돌아가라!', color: '#ffe066' }); return true;
      }
      case 'grab': // 끌어당기기: 사슬 예고선 — 맞으면 보스 앞으로 끌려가고 곧 내려찍힌다
        say(nm || '끌어당기기'); e.mv = { k: 'grab', boss: true, t: 0.8, ang: aim }; e.windT = 0.8; e.windMax = 0.8;
        this.emit({ t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(aim) * 200, y2: e.y + Math.sin(aim) * 200, dur: 0.8, color: '#ffb03a', w: 12 }); return true;
      case 'spikeTrail': { // 가시 길: 보스에서 나를 향해 가시가 차례로 솟는다
        say(nm || '가시 길');
        for (let i = 1; i <= 7; i++) { const x = e.x + Math.cos(aim) * i * 30, y = e.y + Math.sin(aim) * i * 30, dl = 0.45 + i * 0.1; if (this.blocked(x, y, 6)) break; /* 가시 줄기는 벽에서 멈춘다 */ this.emit({ t: 'telegraphCircle', x, y, r: 22, dur: dl }); this.delayed.push({ t: dl, run: () => { if (e.dead) return; this.enemyArea(e, x, y, 22, e.atk * 1.2, 'phys', 'bleed'); if (!this.bfx(e, 'trail', x, y, 22)) this.emit({ t: 'skillAoe', x, y, r: 22, fx: 'spikes' }); } }); }
        return false;
      }
      case 'ripple': // 파문: 안 → 밖으로 고리 셋이 차례로 터진다 (터진 고리 안으로 들어가면 산다)
        say(nm || '파문'); e.mv = { k: 'ripple', boss: true, t: 2.6, n: 0 }; e.windT = 2.6; e.windMax = 2.6; return true;
      case 'jumps3': // 세 번 뛰기: 내 자리로 세 번 연달아 뛰어내린다
        say(nm || '세 번 뛰기'); e.mv = { k: 'jumps3', boss: true, t: 0.7, n: 0 }; this.emit({ t: 'telegraphCircle', x: p.x, y: p.y, r: 40, dur: 0.7 }); e.mv.tx = p.x; e.mv.ty = p.y; return true;
      case 'ritual': { // 제물 셋: 7초 안에 다 쓰러뜨리면 수호자가 무너진다, 아니면 큰 폭발
        this.emit({ t: 'banner', text: nm || '제물 의식', color: '#c8a8ff' });
        const ids = [];
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + this.rng.range(0, 1); let x = e.x + Math.cos(a) * 90, y = e.y + Math.sin(a) * 90; if (this.blocked(x, y, 7)) { x = e.x + Math.cos(a) * 40; y = e.y + Math.sin(a) * 40; }
          const m = this.makeEnemy(e.def.adds || this.zone.pool?.[0] || 'goblin', x, y, { summoned: true }); m.hp = m.maxHp = Math.max(m.maxHp * 1.5, e.maxHp * 0.03); m.ritualOf = e.id; m.summoner = e.id; m.state = 'idle'; m.speedMul = 0.001; m.noLoot = true; m.home = { x, y };
          this.enemies.push(m); ids.push(m.id); this.emit({ t: 'summon', x, y });
        }
        e.mv = { k: 'ritual', boss: true, t: e.kit?.awake ? 6 : 7, ids, fx: 0 }; return true;
      }
    }
    return bossPickX(this, e, p, pick) ?? false; // 51~100층 보스 기술 (towerzone.js)
  },
  bossLineHit(e, ang, len, w, dmg, status) {
    len = this.rayLen(e.x, e.y, ang, len); // 벽에서 멈춘다
    const x2 = e.x + Math.cos(ang) * len, y2 = e.y + Math.sin(ang) * len, prev = this.coTgt;
    for (const q of this.coTargets()) { const vx = x2 - e.x, vy = y2 - e.y, l2 = vx * vx + vy * vy, k = Math.max(0, Math.min(1, ((q.x - e.x) * vx + (q.y - e.y) * vy) / l2)); if (Math.hypot(q.x - e.x - vx * k, q.y - e.y - vy * k) < w + (q.r || 5)) { this.coTgt = q === this.player ? null : q; this.hurtPlayer(dmg, 'mag', e, { status, fromX: e.x, fromY: e.y }); } }
    this.coTgt = prev; this.emit({ t: 'beamFx', x1: e.x, y1: e.y - 6, x2, y2, elem: BOSS_FX[e.defId]?.beam, from: e.id });
  },
  bossMoveTick(e, p, mv) {
    const def = e.def;
    switch (mv.k) {
      case 'meteorRain': {
        if (mv.n < 3 && mv.t < 2.2 - mv.n * 0.6) { mv.n++; this.rainAt(e, [{ x: p.x, y: p.y }], 0.85); }
        if (mv.t > 0) return false;
        e.mv = null; return false;
      }
      case 'crossBeam': {
        if (mv.stage === 0 && mv.t <= 1.4) { mv.stage = 1; for (let i = 0; i < 4; i++) this.bossLineHit(e, mv.a0 + (i * Math.PI) / 2, 260, 14, e.atk * 1.8); this.emit({ t: 'shake', v: 5 });
          for (let i = 0; i < 4; i++) { const a = mv.a0 + Math.PI / 4 + (i * Math.PI) / 2; this.emit({ t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * 260, y2: e.y + Math.sin(a) * 260, dur: 0.8, color: '#ff3a3a', w: 14 }); } }
        if (mv.stage === 1 && mv.t <= 0.6) { mv.stage = 2; for (let i = 0; i < 4; i++) this.bossLineHit(e, mv.a0 + Math.PI / 4 + (i * Math.PI) / 2, 260, 14, e.atk * 1.8); this.emit({ t: 'shake', v: 5 }); }
        if (e.def.beamHold && mv.stage && (mv.fxT = (mv.fxT || 0) - DT) <= 0) { // 각인의 왕: 쏜 광선이 한동안 남는다 (보이기만)
          mv.fxT = 0.05; const live = mv.stage === 1 ? mv.t > 0.9 : mv.t > 0;
          if (live) for (let i = 0; i < 4; i++) { const a = mv.a0 + (mv.stage === 2 ? Math.PI / 4 : 0) + (i * Math.PI) / 2, bl = this.rayLen(e.x, e.y, a, 260); this.emit({ t: 'beamFx', x1: e.x, y1: e.y - 6, x2: e.x + Math.cos(a) * bl, y2: e.y + Math.sin(a) * bl, elem: BOSS_FX[e.defId]?.beam, from: e.id, quiet: true }); }
        }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'cleave': {
        if (mv.t > 0) return true;
        const prev = this.coTgt;
        for (const q of this.coTargets()) { const dx = q.x - e.x, dy = q.y - e.y, d = Math.hypot(dx, dy); let da = Math.atan2(dy, dx) - mv.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (d < 130 + (q.r || 5) && Math.abs(da) < 1.7) { this.coTgt = q === this.player ? null : q; this.hurtPlayer(e.atk * 2.6, def.type, e, { fromX: e.x, fromY: e.y }); } }
        this.coTgt = prev; this.emit({ t: 'skillCone', x: e.x, y: e.y, ang: mv.ang, range: 130, angle: 3.4, fx: 'sweep', elem: BOSS_FX[e.defId]?.beam }); this.emit({ t: 'shake', v: 7 });
        e.mv = null; return true;
      }
      case 'grab': {
        if (mv.t > 0) return true;
        const x2 = e.x + Math.cos(mv.ang) * 200, y2 = e.y + Math.sin(mv.ang) * 200;
        if (distToSeg(p.x, p.y, e.x, e.y, x2, y2) < 12 + (p.r || 5) && !(p.invuln > 0)) {
          const nx = e.x + Math.cos(mv.ang) * (e.r + 14), ny = e.y + Math.sin(mv.ang) * (e.r + 14);
          if (!this.blocked(nx, ny, p.r || 5)) { this.emit({ t: 'afterimage', x1: p.x, y1: p.y, x2: nx, y2: ny }); p.x = nx; p.y = ny; }
          this.hurtPlayer(e.atk * 0.8, def.type, e, { fromX: e.x, fromY: e.y }); this.emit({ t: 'text', x: p.x, y: p.y - 26, text: '끌려갔다!', color: '#ffb03a' });
          const sx = e.x, sy = e.y; this.emit({ t: 'telegraphCircle', x: sx, y: sy, r: e.r + 40, dur: 0.7 });
          this.delayed.push({ t: 0.7, run: () => { if (e.dead) return; this.enemyArea(e, sx, sy, e.r + 40, e.atk * 2.2, def.type, def.status); if (!this.bfx(e, 'slam', sx, sy, e.r + 40)) this.emit({ t: 'skillAoe', x: sx, y: sy, r: e.r + 40, fx: 'quake' }); } });
        }
        e.mv = null; return true;
      }
      case 'ripple': {
        const R = [[0, 60], [60, 115], [115, 170]];
        if (mv.n < 3 && mv.t <= 2.6 - mv.n * 0.55) { const [r1, r2] = R[mv.n]; this.emit(r1 ? { t: 'telegraphCircle', x: e.x, y: e.y, r: r2, inner: r1, dur: 0.9 } : { t: 'telegraphCircle', x: e.x, y: e.y, r: r2, dur: 0.9 }); const ex = e.x, ey = e.y, n = mv.n; mv.n++;
          this.delayed.push({ t: 0.9, run: () => { if (e.dead) return; const prev = this.coTgt; for (const q of this.coTargets()) { const d = Math.hypot(q.x - ex, q.y - ey); if (d >= R[n][0] && d < R[n][1] + (q.r || 5)) { this.coTgt = q === this.player ? null : q; this.hurtPlayer(e.atk * 1.6, 'mag', e, { status: def.status, fromX: ex, fromY: ey }); } } this.coTgt = prev; if (!this.bfx(e, 'nova', ex, ey, R[n][1])) this.emit({ t: 'skillAoe', x: ex, y: ey, r: R[n][1], fx: n === 2 ? 'zero' : 'arcane' }); } }); }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'jumps3': {
        if (mv.t > 0) return true;
        if (!this.blocked(mv.tx, mv.ty, e.r)) { e.blinkAt = this.t; this.emit({ t: 'blink', x1: e.x, y1: e.y, x2: mv.tx, y2: mv.ty }); e.x = mv.tx; e.y = mv.ty; }
        this.enemyArea(e, e.x, e.y, 40, e.atk * 1.7, def.type, def.status); if (!this.bfx(e, 'slam', e.x, e.y, 40)) this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 40, fx: 'quake' });
        if (++mv.n >= 3) { e.mv = null; return true; }
        mv.t = 0.55; mv.tx = p.x; mv.ty = p.y; this.emit({ t: 'telegraphCircle', x: p.x, y: p.y, r: 40, dur: 0.55 }); return true;
      }
      case 'donut': {
        if (mv.t > 0) return true;
        const prev = this.coTgt;
        for (const q of this.coTargets()) { const d = Math.hypot(q.x - e.x, q.y - e.y); if (d > mv.r1 && d < mv.r2 + (q.r || 5)) { this.coTgt = q === this.player ? null : q; this.hurtPlayer(e.atk * 2.2, 'mag', e, { status: 'chill', fromX: e.x, fromY: e.y }); } }
        this.coTgt = prev;
        if (this.bossThemed(e)) { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, rr = mv.r1 + (mv.r2 - mv.r1) * (i % 2 ? 0.75 : 0.45); this.bfx(e, 'donut', e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.8, 34); } } // 바깥 고리 자리마다 그 보스의 재질로 터진다
        else { this.emit({ t: 'ring', x: e.x, y: e.y, r: mv.r2, color: '#9fe8ff' }); this.emit({ t: 'ring', x: e.x, y: e.y, r: (mv.r1 + mv.r2) / 2, color: '#e8fbff' }); }
        this.emit({ t: 'shake', v: 6 });
        e.mv = null; return true;
      }
      case 'sweep': {
        if (mv.t > mv.sw) return true; // 예고
        mv.ang += mv.dir * (Math.PI * (mv.sw > 2.2 ? 1.6 : 1.15) / mv.sw) * DT;
        const bl = this.rayLen(e.x, e.y, mv.ang, 240), x2 = e.x + Math.cos(mv.ang) * bl, y2 = e.y + Math.sin(mv.ang) * bl; // 벽에서 멈춘다
        if ((mv.fxT = (mv.fxT || 0) - DT) <= 0) { mv.fxT = 0.05; this.emit({ t: 'beamFx', x1: e.x, y1: e.y - 6, x2, y2, elem: BOSS_FX[e.defId]?.beam, from: e.id }); }
        mv.hitT -= DT;
        if (mv.hitT <= 0) {
          const prev = this.coTgt;
          for (const q of this.coTargets()) { const vx = x2 - e.x, vy = y2 - e.y, l2 = vx * vx + vy * vy, k = Math.max(0, Math.min(1, ((q.x - e.x) * vx + (q.y - e.y) * vy) / l2)); if (Math.hypot(q.x - e.x - vx * k, q.y - e.y - vy * k) < 10 + (q.r || 5)) { this.coTgt = q === this.player ? null : q; this.hurtPlayer(e.atk * 1.1, 'mag', e, { fromX: e.x, fromY: e.y }); mv.hitT = 0.4; } }
          this.coTgt = prev;
        }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'channel': {
        if ((mv.fx -= DT) <= 0) { mv.fx = 0.5; if (!this.bossThemed(e)) this.emit({ t: 'ring', x: e.x, y: e.y, r: e.r + 18, color: '#7be38a' }); else this.emit({ t: 'spark', x: e.x, y: e.y - 10, color: '#7be38a' }); }
        if (mv.taken >= e.maxHp * 0.07) { this.exposeBoss(e, 3, 1.5, '의식이 끊겼다!'); return false; }
        if (mv.t > 0) return true;
        { const h0 = e.hp; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.18); this.emit({ t: 'bossHeal', id: e.id, x: e.x, y: e.y, from: h0 / e.maxHp, to: e.hp / e.maxHp, big: true }); } this.emit({ t: 'text', x: e.x, y: e.y - 30, text: '회복 +18%', color: '#7be38a' }); if (!this.bfx(e, 'nova', e.x, e.y, 60)) this.emit({ t: 'ring', x: e.x, y: e.y, r: 90, color: '#7be38a' });
        e.mv = null; return false;
      }
      case 'soar': {
        if (mv.t < 2.0 - mv.wave * 0.9 && mv.wave < 2) { // 불비 두 번
          mv.wave++;
          const spots = this.coTargets().map((q) => ({ x: q.x, y: q.y }));
          for (let i = 0; i < 4; i++) spots.push({ x: p.x + this.rng.range(-120, 120), y: p.y + this.rng.range(-90, 90) });
          this.rainAt(e, spots.map((q) => this.floorNear(q.x, q.y)).filter(Boolean), 0.9);
        }
        if (mv.t > 0) return true;
        e.soaring = false; e.invulnT = 0;
        e.mv = { k: 'leap', t: 0.9, max: 0.9, x0: e.x, y0: e.y, x: p.x, y: p.y }; this.emit({ t: 'telegraphCircle', x: p.x, y: p.y, r: 38, dur: 0.9 }); return true;
      }
      case 'ritual': {
        if ((mv.fx -= DT) <= 0) { mv.fx = 0.6; for (const id of mv.ids) { const m = this.enemies.find((o) => o.id === id && !o.dead); if (m) this.emit({ t: 'beamFx', x1: m.x, y1: m.y - 6, x2: e.x, y2: e.y - 8 }); } }
        const alive = mv.ids.filter((id) => this.enemies.some((o) => o.id === id && !o.dead));
        if (!alive.length) { this.exposeBoss(e, 4, 2, '의식 실패! 수호자가 무너진다'); return false; }
        if (mv.t > 0) return true;
        for (const m of this.enemies) if (m.ritualOf === e.id && !m.dead) { m.dead = true; this.emit({ t: 'blink', x1: m.x, y1: m.y, x2: e.x, y2: e.y }); }
        this.enemyArea(e, e.x, e.y, 600, e.atk * (3 + alive.length), 'mag', def.status);
        if (!this.bfx(e, 'nova', e.x, e.y, 130, { ult: true })) this.emit({ t: 'ring', x: e.x, y: e.y, r: 200, color: '#c8a8ff' }); this.emit({ t: 'shake', v: 9 }); this.emit({ t: 'banner', text: '의식 완성', color: '#c8a8ff' });
        e.mv = null; return true;
      }
    }
    { const r = bossTickX(this, e, p, mv); if (r !== undefined) return r; }
    e.mv = null; return false;
  },
  rainAt(e, spots, dur) { // 떨어질 자리 예고 뒤 터진다 (기술 진행과 따로 돈다)
    const [ffx, fel] = BOSS_FX[e?.defId]?.fall || ['meteor', 'fire']; // 그 보스의 재질로 떨어진다 (서리 마녀는 우박 · 왕은 빛 · 마녀는 독)
    for (const q of spots) { this.emit({ t: 'telegraphCircle', x: q.x, y: q.y, r: 30, dur }); this.emit({ t: 'skillFall', x: q.x, y: q.y, r: 30, dur, fx: ffx, elem: fel }); }
    (this.delayed ||= []).push({ t: dur, run: () => { for (const q of spots) { this.enemyArea(e, q.x, q.y, 30, e.atk * 0.9, e.def.type, e.def.status); this.emit({ t: 'skillAoe', x: q.x, y: q.y, r: 30, elem: fel, fx: ffx }); } } });
  },
  // 보스 기술 이펙트: 그 보스 그림에 맞춘 재질로 (BOSS_FX · 없으면 예전 고리). true면 그렸다
  bfx(e, kind, x, y, r, extra = {}) {
    const th = BOSS_FX[e?.defId]?.[kind]; if (!th) return false;
    this.emit({ t: 'skillAoe', x, y, r, fx: th[0], elem: th[1], ...extra }); return true;
  },
  bossThemed(e) { return !!BOSS_FX[e?.defId]; },
  enemyArea(e, x, y, r, dmg, type, status) {
    const prev = this.coTgt;
    for (const t of this.coTargets()) if (Math.hypot(t.x - x, t.y - y) < r + (t.r || 5)) { this.coTgt = t === this.player ? null : t; this.hurtPlayer(dmg, type, e, { status, fromX: x, fromY: y }); }
    this.coTgt = prev;
  },
  // true면 이번 틱은 기술 중 (평소 걷기 · 휘두르기는 쉰다)
  // 예고(바닥 원 · 선): 보스의 읽기 어려운 기술(hard)만 그린다. 나머지는 준비 동작(e.pose)으로 읽는다
  tele(e, hard, ev) { if (hard && (e.def?.elite || e.champion || e.kit)) this.emit(ev); },
  mobPose(e, k, dur) { e.pose = { k, t: dur, max: dur }; },
  enemyMove(e, p, dist, frozen) {
    const def = e.def;
    if (e.pose && (e.pose.t -= DT) <= 0) e.pose = null;
    if (frozen || e.silenceT > 0 || e.st.flee > 0 || e.loseT > 0 || e.remote || e.training) { if (e.mv && frozen) e.mv = null; return false; }
    // 정예 · 우두머리: 체력 절반 아래에서 분노 (빨라지고 자주 쓴다)
    if ((def.elite || e.champion) && !e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true; e.speedMul *= 1.3; e.atkRate *= 1.35;
      this.emit({ t: 'text', x: e.x, y: e.y - 30, text: '분노!', color: '#ff5a3a' }); this.emit({ t: 'shake', v: 3 });
    }
    const mv = e.mv;
    if (!mv) {
      if ((e.mvCd = (e.mvCd ?? 2 + this.rng.range(0, 2)) - DT) > 0 || e.windT > 0 || dist > 200) return false;
      if (!def.elite && !e.champion && this.t - (this.lastMobMoveT ?? -9) < 0.7) { e.mvCd = 0.3 + this.rng.range(0, 0.4); return false; } // 보통 몬스터는 기술을 번갈아 쓴다 (여럿이 한꺼번에 예고 원을 그리지 않게)
      const melee = e.r + (p.r || 5) + 10, tx = p.x, ty = p.y;
      const can = { combo: dist < melee + 16, leap: dist > 40 && dist < 170, fan: dist < 190, retreat: dist < 70, pool: dist < 200, blink: dist > 60,
        heal: this.enemies.some((o) => !o.dead && !o.remote && Math.hypot(o.x - e.x, o.y - e.y) < 100 && o.hp < o.maxHp * 0.7) };
      const phm = e.phaseMoves || def.phaseMoves;
      const phase = phm ? (e.hp > e.maxHp * 0.66 ? 0 : e.hp > e.maxHp * 0.33 ? 1 : 2) : 0;
      if (phm && !e.forms && phase !== (e.raidPhase ?? 0)) { e.raidPhase = phase; this.emit({ t: 'shake', v: 6 }); this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 80, elem: 'fire', fx: 'burst', ult: true }); }
      Object.assign(can, { beam: dist < 230, spiral: dist < 200, split: dist < 220, whirl: dist < melee + 22, shove: dist < melee + 10, quake: dist < 70,
        rain: dist < 260, adds: this.enemies.filter((o) => o.summoner === e.id && !o.dead).length < 3, charge: dist > 50 && dist < 260, mark: true, nova: dist < 120,
        donut: dist < 200, sweep: dist < 230, channel: true, soar: true, mirror: !(e.mirrorT > 0), clones: !this.enemies.some((o) => o.decoyOf === e.id && !o.dead),
        ritual: !this.enemies.some((o) => o.ritualOf === e.id && !o.dead),
        meteorRain: true, crossBeam: dist < 240, cleave: dist < 130, grab: dist > 50 && dist < 200, spikeTrail: dist < 230, ripple: dist < 170, jumps3: dist < 230 }, BEAST_CAN(e, dist, melee));
      if (e.kit) Object.assign(can, bossCan(this, e, p, dist)); // 51~100층 보스 기술
      const list = (phm ? phm[phase] : e.moves || BEAST_KIT[e.defId] || def.moves || AI_MOVES[def.ai] || []).filter((k) => can[k]); // 짐승은 몸에 맞는 기술 (beastmoves.js)
      if (!list.length) { e.mvCd = 0.3; return false; } // 지금 쓸 수 있는 기술이 없으면 조금 뒤 다시
      let pick = list[this.rng.int(0, list.length - 1)];
      e.aliasName = null;
      if (pick === 'copy' || pick === 'raceArt') { const al = bossAlias(this, e, p, pick, can, (id) => SKILLS[id]?.name); if (!al) { e.mvCd = 0.3; return false; } pick = al.pick; e.aliasName = al.name; } // 거울에 비친 나: 내 기술 · 마지막 왕: 8종족의 각인
      if (!def.elite && !e.champion) this.lastMobMoveT = this.t;
      if (e.kit?.vent && (e.heat = (e.heat || 0) + 1) > e.kit.vent) { pick = 'vent'; e.heat = 0; e.aliasName = null; } // 불꽃 거인: 기술을 몇 번 쓰면 과열
      e.mvCd = (def.elite || e.champion ? 2.4 : 3.5) / (e.enraged ? 1.4 : 1) / (e.moves ? 1.5 : 1) / (e.kit?.awake || e.kit?.fast ? 1.35 : 1) + this.rng.range(0, e.kit?.awake || e.kit?.fast ? 0.8 : 1.5); // 사람(경비 · 관리)은 기술을 더 자주 · 각성한 수호자도
      if (this.bossPick(e, p, pick)) return true;
      if (BEAST[pick]) { if (def.elite || e.champion || !e.saidBeast?.[pick]) { (e.saidBeast ||= {})[pick] = 1; this.emit({ t: 'text', x: e.x, y: e.y - 30, text: (e.skillNames || def.skillNames)?.[pick] || BEAST_NAMES[pick], color: '#ffd0a0' }); } BEAST[pick].start(this, e, p, dist); return true; } // 몸 기술: 처음 한 번은 이름이 뜬다
      const sn = e.aliasName || (e.skillNames || def.skillNames)?.[pick]; if (sn) this.emit({ t: 'text', x: e.x, y: e.y - 30, text: sn, color: '#ffd0a0' }); // 플레이어 스킬처럼 이름이 뜬다
      if (pick === 'combo' && dist < melee + 16) { e.mv = { k: 'combo', t: 0.35, n: 3 }; e.windT = 0.35; e.windMax = 0.35; this.emit({ t: 'windup', id: e.id }); return true; }
      if (pick === 'leap' && dist > 40 && dist < 170) { e.mv = { k: 'leap', t: 0.75, max: 0.75, x0: e.x, y0: e.y, x: tx, y: ty }; this.tele(e, false, { t: 'telegraphCircle', x: tx, y: ty, r: 30, dur: 0.75 }); this.mobPose(e, 'crouch', 0.3); return true; }
      if (pick === 'fan' && dist < 190) { e.mv = { k: 'fan', t: 0.45, ang: Math.atan2(ty - e.y, tx - e.x) }; e.windT = 0.45; e.windMax = 0.45; this.mobPose(e, 'spit', 0.45); this.tele(e, false, { t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(e.mv.ang) * 120, y2: e.y + Math.sin(e.mv.ang) * 120, dur: 0.45, color: '#ff5a5a' }); return true; }
      if (pick === 'retreat' && dist < 70) { const l = dist || 1; e.mv = { k: 'retreat', t: 0.35, vx: (e.x - p.x) / l, vy: (e.y - p.y) / l }; return true; }
      if (pick === 'pool' && dist < 200) { e.mv = { k: 'pool', t: 1.0, x: tx, y: ty }; this.tele(e, true, { t: 'telegraphCircle', x: tx, y: ty, r: 34, dur: 1.0 }); this.mobPose(e, 'spit', 1.0); this.emit({ t: 'windup', id: e.id }); return true; }
      if (pick === 'spiral' || pick === 'split') { // 빙글 도는 탄 · 갈라지는 탄
        e.mv = { k: pick, t: 0.45, ang: Math.atan2(ty - e.y, tx - e.x) }; e.windT = 0.45; e.windMax = 0.45; this.emit({ t: 'windup', id: e.id }); return true;
      }
      if (pick === 'whirl') { e.mv = { k: 'whirl', t: 0.55 }; this.tele(e, false, { t: 'telegraphCircle', x: e.x, y: e.y, r: e.r + 26, dur: 0.55 }); this.mobPose(e, 'coil', 0.55); e.windT = 0.55; e.windMax = 0.55; return true; }
      if (pick === 'shove') { e.mv = { k: 'shove', t: 0.4 }; e.windT = 0.4; e.windMax = 0.4; this.emit({ t: 'windup', id: e.id }); return true; }
      if (pick === 'quake') { e.mv = { k: 'quake', t: 0.8, r: 0 }; this.tele(e, false, { t: 'telegraphCircle', x: e.x, y: e.y, r: 70, dur: 0.8 }); this.mobPose(e, 'rear', 0.8); e.windT = 0.8; e.windMax = 0.8; return true; }
      if (pick === 'rain') { // 비: 모든 사람 발밑과 둘레에 장판이 떨어진다
        const spots = this.coTargets().map((q) => ({ x: q.x, y: q.y }));
        for (let i = 0; i < 3; i++) { const q = this.floorNear(e.x + this.rng.range(-110, 110), e.y + this.rng.range(-80, 80)); if (q) spots.push(q); } // 벽 위에는 떨어지지 않는다
        e.mv = { k: 'rain', t: 1.1, spots }; for (const q of spots) this.tele(e, true, { t: 'telegraphCircle', x: q.x, y: q.y, r: 30, dur: 1.1 }); this.mobPose(e, 'howl', 1.1); return true;
      }
      if (pick === 'adds') { // 부하를 깨운다
        for (let i = 0; i < 2; i++) { const a = this.rng.range(0, Math.PI * 2); let x = e.x + Math.cos(a) * 40, y = e.y + Math.sin(a) * 40; if (this.blocked(x, y, 6)) { x = e.x; y = e.y; } const m = this.makeEnemy(def.adds || 'goblin', x, y, { summoned: true }); m.summoner = e.id; m.state = 'chase'; m.home = { ...e.home }; this.enemies.push(m); }
        this.emit({ t: 'summon', x: e.x, y: e.y }); return false;
      }
      if (pick === 'charge' && this.rayLen(e.x, e.y, Math.atan2(ty - e.y, tx - e.x), 260) > 70) { // 돌진: 굵은 예고선을 따라 끝까지 (앞이 벽에 막혀 있으면 고르지 않는다)
        const a = Math.atan2(ty - e.y, tx - e.x); e.mv = { k: 'charge', t: 1.5, ang: a, run: 0.7, dist: Math.max(40, this.rayLen(e.x, e.y, a, 260) - e.r) }; /* 예고가 끝나면(0.8초) 예고선 끝(벽이면 벽 앞)까지 0.7초 */ this.mobPose(e, 'crouch', 0.8);
        this.tele(e, false, { t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * 260, y2: e.y + Math.sin(a) * 260, dur: 0.8, color: '#ff3a3a', w: e.r * 2 }); e.windT = 0.8; e.windMax = 0.8; return true;
      }
      if (pick === 'mark') { // 표식: 한 사람을 따라다니는 원이 터진다 (동료에게서 떨어져야 한다)
        const tg = this.rng.pick(this.coTargets()) || p; e.mv = { k: 'mark', t: 2.2, tg };
        this.emit({ t: 'telegraphCircle', x: tg.x, y: tg.y, r: 40, dur: 2.2, follow: tg === this.player ? 'p' : null }); this.emit({ t: 'text', x: tg.x, y: tg.y - 26, text: '표식!', color: '#ff5a5a' }); return true;
      }
      if (pick === 'nova') { // 둘레 폭발: 멀리 떨어져야 산다
        e.mv = { k: 'nova', t: 1.2 }; this.tele(e, true, { t: 'telegraphCircle', x: e.x, y: e.y, r: 110, dur: 1.2, follow: null }); this.mobPose(e, 'rear', 1.2); e.windT = 1.2; e.windMax = 1.2; return true;
      }
      if (pick === 'beam') { // 감시안: 조준선을 보여 준 뒤 광선
        const a = Math.atan2(ty - e.y, tx - e.x); e.mv = { k: 'beam', t: 0.9, ang: a };
        this.mobPose(e, 'spit', 0.9); this.tele(e, true, { t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * 230, y2: e.y + Math.sin(a) * 230, dur: 0.9, color: '#ff3a3a', w: 6 }); e.windT = 0.9; e.windMax = 0.9; return true;
      }
      if (pick === 'heal') {
        const hurt = this.enemies.filter((o) => !o.dead && !o.remote && Math.hypot(o.x - e.x, o.y - e.y) < 100 && o.hp < o.maxHp * 0.7);
        if (!hurt.length) return false;
        for (const o of hurt) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.25); o.guardT = 3; this.emit({ t: 'text', x: o.x, y: o.y - 18, text: '회복', color: '#7be38a' }); }
        this.emit({ t: 'ring', x: e.x, y: e.y, r: 100, color: '#7be38a' }); return false;
      }
      if (pick === 'blink' && dist > 60) {
        const a = this.rng.range(0, Math.PI * 2), nx = p.x + Math.cos(a) * 70, ny = p.y + Math.sin(a) * 70;
        if (!this.blocked(nx, ny, e.r)) { e.blinkAt = this.t; this.emit({ t: 'blink', x1: e.x, y1: e.y, x2: nx, y2: ny }); e.x = nx; e.y = ny; e.shotCd = Math.min(e.shotCd, 0.3); if (def.blinkInv) e.invulnT = def.blinkInv; }
        return false;
      }
      return false;
    }
    mv.t -= DT;
    if (mv.boss) return this.bossMoveTick(e, p, mv);
    if (BEAST[mv.k]) return BEAST[mv.k].tick(this, e, mv, p);
    switch (mv.k) {
      case 'combo': // 연속 베기: 예고 뒤 세 번 (0.22초 간격)
        if (mv.t > 0) return true;
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + (p.r || 5) + 12) this.hurtPlayer(e.atk * 0.6, def.type, e, { status: def.status });
        this.emit({ t: 'strike', id: e.id, x: e.x, y: e.y, ang: Math.atan2(p.y - e.y, p.x - e.x), r: e.r + 16 });
        if (--mv.n > 0) { mv.t = 0.22; return true; }
        e.mv = null; e.atkCd = 1; return true;
      case 'leap': { // 뛰어들기: 예고 원으로 날아가 내려찍는다
        const k = 1 - Math.max(0, mv.t) / mv.max, nx = mv.x0 + (mv.x - mv.x0) * k, ny = mv.y0 + (mv.y - mv.y0) * k;
        if (!this.blocked(nx, ny, e.r)) { e.x = nx; e.y = ny; }
        e.moving = true; e.jumpH = Math.sin(k * Math.PI) * 18;
        if (mv.t > 0) return true;
        e.jumpH = 0; this.enemyArea(e, e.x, e.y, 30, e.atk * 1.3, def.type, def.status);
        if (!this.bfx(e, 'slam', e.x, e.y, 36)) this.emit({ t: 'ring', x: e.x, y: e.y, r: 30, color: '#ff8a5a' }); this.emit({ t: 'shake', v: this.bossThemed(e) ? 5 : 2.5 });
        e.mv = null; return true;
      }
      case 'fan': { // 부채꼴: 다섯 발
        if (mv.t > 0) return true;
        const pr = def.proj || { speed: 150, color: def.type === 'mag' ? '#c9a8ff' : '#e8d8b0' };
        for (let i = 0; i < 5; i++) { const a = mv.ang + (i - 2) * 0.2; this.projs.push({ owner: 'e', src: e, x: e.x, y: e.y, vx: Math.cos(a) * pr.speed * 1.2, vy: Math.sin(a) * pr.speed * 1.2, life: 2, dmg: e.atk * 0.7, type: def.type, status: pr.status, color: pr.color }); }
        e.mv = null; return true;
      }
      case 'retreat': // 물러나며 한 발
        this.move(e, mv.vx * def.speed * 2.4 * DT, mv.vy * def.speed * 2.4 * DT); e.moving = true;
        if (mv.t > 0) return true;
        if (def.proj) this.enemyShot(e, Math.atan2(p.y - e.y, p.x - e.x), 1, 0);
        e.mv = null; return true;
      case 'spiral': case 'split': {
        if (mv.t > 0) return true;
        const pr = def.proj || { speed: 140, color: def.type === 'mag' ? '#c9a8ff' : '#e8d8b0' };
        if (mv.k === 'spiral') for (let i = 0; i < 2; i++) this.projs.push({ owner: 'e', src: e, x: e.x, y: e.y, vx: Math.cos(mv.ang) * pr.speed, vy: Math.sin(mv.ang) * pr.speed, life: 2.4, dmg: e.atk * 0.8, type: def.type, status: pr.status, color: pr.color, curve: i ? 2.6 : -2.6, big: true });
        else this.projs.push({ owner: 'e', src: e, x: e.x, y: e.y, vx: Math.cos(mv.ang) * pr.speed * 1.1, vy: Math.sin(mv.ang) * pr.speed * 1.1, life: 2, dmg: e.atk, type: def.type, status: pr.status, color: pr.color, splitT: 0.5, big: true });
        e.mv = null; return true;
      }
      case 'whirl': // 회전베기: 둘레를 한 바퀴
        if (mv.t > 0) return true;
        this.enemyArea(e, e.x, e.y, e.r + 26, e.atk * 1.2, def.type, def.status); if (!this.bfx(e, 'slam', e.x, e.y, e.r + 26)) this.emit({ t: 'ring', x: e.x, y: e.y, r: e.r + 26, color: '#ffd0a0' });
        e.mv = null; e.atkCd = 1; return true;
      case 'shove': { // 밀쳐내기: 세게 쳐서 멀리 날린다
        if (mv.t > 0) return true;
        const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
        if (l < e.r + (p.r || 5) + 16) {
          this.hurtPlayer(e.atk * 0.9, def.type, e, { status: def.status });
          if (p === this.player && !p.down) { for (let k = 0; k < 8; k++) this.move(p, (dx / l) * 6, (dy / l) * 6); p.invuln = Math.max(p.invuln, 0.1); }
          else if (p.kind) { p.x += (dx / l) * 40; p.y += (dy / l) * 40; }
        }
        this.emit({ t: 'strike', id: e.id, x: e.x, y: e.y, ang: Math.atan2(dy, dx), r: e.r + 18 }); this.emit({ t: 'shake', v: 2 });
        e.mv = null; e.atkCd = 1; return true;
      }
      case 'quake': // 땅 찍기: 퍼지는 충격파
        if (mv.t > 0) return true;
        this.enemyArea(e, e.x, e.y, 70, e.atk * 1.1, def.type, def.status); if (!this.bfx(e, 'slam', e.x, e.y, 70)) this.emit({ t: 'ring', x: e.x, y: e.y, r: 70, color: '#c8a070' }); this.emit({ t: 'shake', v: this.bossThemed(e) ? 6 : 3 });
        e.mv = null; return true;
      case 'rain':
        if (mv.t > 0) return true;
        for (const q of mv.spots) { this.enemyArea(e, q.x, q.y, 30, e.atk * 0.9, def.type, def.status); if (!this.bfx(e, 'rain', q.x, q.y, 30)) this.emit({ t: 'ring', x: q.x, y: q.y, r: 30, color: def.proj?.color || '#ff5a5a' }); }
        e.mv = null; return false;
      case 'beam': { // def.beamHold 초 동안 쏘아 댄다 (각인의 왕) — 처음 맞으면 1.5배, 그 뒤로 0.35초마다 0.5배
        if (mv.t > 0) return true;
        if (mv.hold == null) { mv.hold = e.def.beamHold || 0; mv.hitT = 0; mv.first = true; }
        const bl = this.rayLen(e.x, e.y, mv.ang, 230), x2 = e.x + Math.cos(mv.ang) * bl, y2 = e.y + Math.sin(mv.ang) * bl; // 벽에서 멈춘다
        if ((mv.hitT -= DT) <= 0) {
          mv.hitT = 0.35;
          for (const q of this.coTargets()) { const vx = x2 - e.x, vy = y2 - e.y, l2 = vx * vx + vy * vy, k = Math.max(0, Math.min(1, ((q.x - e.x) * vx + (q.y - e.y) * vy) / l2)); if (Math.hypot(q.x - e.x - vx * k, q.y - e.y - vy * k) < 7 + (q.r || 5)) this.enemyArea(e, q.x, q.y, 2, e.atk * (mv.first ? 1.5 : 0.5), def.type, def.status); }
          mv.first = false;
        }
        if ((mv.fxT = (mv.fxT || 0) - DT) <= 0) { mv.fxT = 0.05; this.emit({ t: 'beamFx', x1: e.x, y1: e.y - 6, x2, y2, elem: BOSS_FX[e.defId]?.beam, from: e.id }); }
        if ((mv.hold -= DT) > 0) { e.windT = 0; return true; }
        e.mv = null; return true;
      }
      case 'charge': {
        if (mv.t > mv.run) return true;
        // 출발은 붙고 · 끝은 늦춘다 (처음 20% 가속 · 마지막 25% 감속 — 순간이동처럼 튀어 나가지 않게, 가는 거리는 예전과 같다)
        e.windT = 0; // 예고가 끝났다: 달리는 그림으로
        const u = 1 - mv.t / mv.run, ease = Math.max(0.25, Math.min(1, u / 0.2, (1 - u) / 0.25));
        const sp = ((mv.dist ?? def.speed * 5) / (mv.run * 0.775)) * ease * DT, nx = e.x + Math.cos(mv.ang) * sp, ny = e.y + Math.sin(mv.ang) * sp;
        if (this.blocked(nx, ny, e.r)) { mv.t = 0; if (e.kit?.wallStun) { e.mv = null; this.exposeBoss(e, 2.6, 1.6, '벽에 부딪혀 기절!'); return false; } } else { e.x = nx; e.y = ny; e.moving = true; }
        for (const q of this.coTargets()) if (!mv.hit?.has(q) && Math.hypot(q.x - e.x, q.y - e.y) < e.r + (q.r || 5) + 4) { (mv.hit ||= new Set()).add(q); this.enemyArea(e, q.x, q.y, 2, e.atk * 1.6, def.type, def.status); }
        if (mv.t > 0) return true;
        this.emit({ t: 'shake', v: 3 }); e.mv = null; return true;
      }
      case 'mark':
        if (mv.t > 0) return false; // 표식 동안 보스는 움직인다
        this.enemyArea(e, mv.tg.x, mv.tg.y, 40, e.atk * 1.8, def.type, def.status); if (!this.bfx(e, 'mark', mv.tg.x, mv.tg.y, 40)) this.emit({ t: 'ring', x: mv.tg.x, y: mv.tg.y, r: 40, color: '#ff5a5a' }); this.emit({ t: 'shake', v: 3 });
        e.mv = null; return false;
      case 'nova':
        if (mv.t > 0) return true;
        this.enemyArea(e, e.x, e.y, 110, e.atk * 1.5, def.type, def.status); if (!this.bfx(e, 'nova', e.x, e.y, 110, { ult: true })) this.emit({ t: 'ring', x: e.x, y: e.y, r: 110, color: '#ff8a3a' }); this.emit({ t: 'shake', v: 5 });
        e.mv = null; return true;
      case 'pool': // 장판: 예고 원이 터진다
        if (mv.t > 0) return true;
        this.enemyArea(e, mv.x, mv.y, 34, e.atk * 1.4, 'mag', def.status || (def.type === 'mag' ? 'burn' : null));
        if (!this.bfx(e, 'pool', mv.x, mv.y, 34)) this.emit({ t: 'ring', x: mv.x, y: mv.y, r: 34, color: def.proj?.color || '#ff5a8a' });
        e.mv = null; return false;
    }
    e.mv = null; return false;
  },
  // 플레이어 위치에서 퍼지는 거리장 → 적이 벽을 돌아서 추격
  updateFlow() {
    if (this.mode !== 'field') return;
    this.flowT -= DT;
    if (this.flowT > 0) return;
    this.flowT = 0.2;
    const f = this.flow, tw = this.tw, th = this.th;
    f.fill(-1);
    const px = Math.floor(this.player.x / TILE), py = Math.floor(this.player.y / TILE);
    if (!(px >= 0 && py >= 0 && px < tw && py < th)) return; // 맵 밖 · NaN: 거리장을 비워 둔다 (큐가 끝없이 늘지 않게)
    const q = [py * tw + px]; f[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % tw, y = (i / tw) | 0, dv = f[i];
      if (dv >= 28) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + N8[k][0], ny = y + N8[k][1];
        if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
        const j = ny * tw + nx, tt = this.tiles[j];
        if (f[j] >= 0 || tt === T_WALL || tt === T_CRACK || tt === T_BUILD || tt === T_GATE || tt === T_DEEP) continue;
        f[j] = dv + 1; q.push(j);
      }
    }
  },

  chaseDir(e) {
    if (this.coTgt) return this.pathDir(e, this.coTgt.x, this.coTgt.y); // 동료를 쫓는다 (거리장은 방장 기준이라 길찾기로)
    const p = this.player;
    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
    if (dist < 40 || this.mode !== 'field') return [dx / dist, dy / dist];
    const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
    const cur = this.flow[ty * this.tw + tx];
    if (cur < 0) return [dx / dist, dy / dist];
    let best = null, bv = cur;
    for (const [ox, oy] of N8) {
      const nx = tx + ox, ny = ty + oy;
      if (nx < 0 || ny < 0 || nx >= this.tw || ny >= this.th) continue;
      const v = this.flow[ny * this.tw + nx];
      if (v < 0 || v >= bv) continue;
      if (ox && oy && (this.flow[ty * this.tw + nx] < 0 || this.flow[ny * this.tw + tx] < 0)) continue;
      bv = v; best = [nx, ny];
    }
    if (!best) return [dx / dist, dy / dist];
    const gx = best[0] * TILE + 8 - e.x, gy = best[1] * TILE + 8 - e.y, gl = Math.hypot(gx, gy) || 1;
    return [gx / gl, gy / gl];
  },

  // 소환수 길찾기: 곧장 갈 수 있으면 직진, 막히면 타일 단위 너비 우선 탐색으로 돌아간다 (0.4초마다 다시 계산)
  pathDir(o, tx, ty) {
    const dx = tx - o.x, dy = ty - o.y, l = Math.hypot(dx, dy) || 1;
    if (this.mode !== 'field' || (!(o.forcePath > 0) && this.clearLine(o.x, o.y, tx, ty))) { o.path = null; return [dx / l, dy / l]; } // forcePath: 벽 모서리에 걸려 못 가면 잠깐 칸 단위 길찾기로만
    const tw = this.tw, th = this.th;
    const sx = Math.floor(o.x / TILE), sy = Math.floor(o.y / TILE), gx = Math.floor(tx / TILE), gy = Math.floor(ty / TILE);
    o.pathT = (o.pathT || 0) - DT;
    if (!o.path || o.pathT <= 0 || o.path.goal !== gy * tw + gx) {
      o.pathT = 0.4;
      const start = sy * tw + sx, goal = gy * tw + gx;
      const prev = new Map([[start, -1]]), q = [start];
      let found = false;
      for (let h = 0; h < q.length && h < 2500; h++) {
        const i = q[h];
        if (i === goal) { found = true; break; }
        const x = i % tw, y = (i / tw) | 0;
        for (let k = 0; k < 4; k++) {
          const nx = x + N8[k][0], ny = y + N8[k][1];
          if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
          const j = ny * tw + nx, t = this.tiles[j];
          if (prev.has(j) || t === T_WALL || t === T_CRACK || t === T_BUILD || t === T_GATE || t === T_DEEP) continue;
          prev.set(j, i); q.push(j);
        }
      }
      // 첫 몇 칸만 기억: 시작점 다음 칸들
      const steps = [];
      if (found) { let c = goal; while (c !== -1 && c !== start) { steps.push(c); c = prev.get(c); } steps.reverse(); }
      o.path = { goal, steps };
    }
    while (o.path.steps.length) {
      const c = o.path.steps[0], cx = (c % tw) * TILE + 8, cy = ((c / tw) | 0) * TILE + 8;
      if (Math.hypot(cx - o.x, cy - o.y) < 5) { o.path.steps.shift(); continue; }
      const ax = cx - o.x, ay = cy - o.y, al = Math.hypot(ax, ay) || 1;
      return [ax / al, ay / al];
    }
    return [dx / l, dy / l];
  },

  // 방장: 이 적이 노릴 사람 — 가장 가까운 사람, 한 번 고르면 잠깐은 그대로 (도발한 사람이 있으면 그 사람)
  coPick(e) {
    const P = this.player, mates = this.coop?.mates || new Map();
    const alive = (t) => t && (t === P ? !P.down : t.maxHp > 0 && t.hp != null && t.kind ? t.hp > 0 && t.t > 0 && this.allies.includes(t) : !t.dead && mates.get(t.id) === t);
    if (e.provokeT > 0) {
      const pm = e.provokeBy ? mates.get(e.provokeBy) : null;
      if (pm && alive(pm)) return (e.tgt = pm);
      if (!e.provokeBy && !P.down) return (e.tgt = P);
    }
    // 처음 어그로를 끈 대상을 계속 쫓는다 (쓰러지거나 너무 멀어지면 다시 가장 가까운 대상)
    if (alive(e.tgt) && Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 340) return e.tgt;
    let best = null, bd = 1e9;
    for (const t of this.coTargets()) { const dd = Math.hypot(t.x - e.x, t.y - e.y); if (dd < bd) { bd = dd; best = t; } }
    return (e.tgt = best || P);
  },
};

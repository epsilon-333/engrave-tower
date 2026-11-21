// 가면 족장 (5층 수호자): 시간마다가 아니라 상황에 맞춰 기술을 고른다 (data/monsters.js climbChief.ownKit)
//   평타: 보라 불덩이 (멀리서 빠르게 · def.proj) — 몽둥이 평타 · 몸통 박치기는 하지 않는다
//   가까우면: 지팡이 휘두르기 · 포효(밀쳐내고 0.5초 경직) / 멀면: 족장의 세 번 뛰기 · 돌진 · 저주
//   일정 간격마다 고블린 다섯 소환 → 5초 뒤에도 남은 고블린은 「제물 선택」: 제물이 되어 죽고, 남은 수만큼 큰 폭발
// World.prototype 에 붙는다 (sim/world.js 끝). 메서드 안의 this 는 World
import { DT } from './world.js';

export const CHIEF = {
  near: 75, far: 130, gap: [1.3, 2.1],                     // 가까움 · 멂의 경계 · 기술 사이 쉬는 시간
  swing: { r: 54, arc: 1.4, k: 1.3, wind: 0.45 },           // 앞 반원(반각 1.4) · 공격력 130%
  roar: { r: 85, k: 0.6, push: 60, stun: 0.5, wind: 0.5, cd: 9 },
  jumps: { cd: 11 }, charge: { cd: 8 },
  curse: { r: 34, wind: 0.85, t: 6, k: 0.5, cd: 13 },       // 저주 = 받는 피해 +30% (p.markT · 보스 저주의 표식과 같은 규칙)
  summon: { n: 5, first: 7, every: 22, wind: 0.9, ring: 64 },
  sac: { after: 5, mark: 1.0, fly: 0.5, charge: 1.1, k: 0.9, r0: 70, rPer: 18, empty: 2.5 }, // 제물 하나마다 공격력 90% · 둘레 +18
};

export const ChiefMethods = {
  chiefTimers(e) {
    const K = (e.ck ||= { cd: { roar: 3, jumps: 1, charge: 0.5, curse: 2 }, sumT: CHIEF.summon.first, sacT: null, closeT: 0 });
    for (const k in K.cd) K.cd[k] -= DT;
    K.sumT -= DT; if (K.sacT != null) K.sacT -= DT;
    // 걷다가 끼였나: 기술 중이 아닌데 0.02초에 0.3px도 못 움직이면 쌓인다 (벽 모서리 · 울타리에 걸림)
    if (!e.mv && !(e.windT > 0) && e.speedMul > 0.3 && Math.hypot(e.x - (K.lx ?? e.x + 1), e.y - (K.ly ?? e.y)) < 0.3 && Math.hypot(this.player.x - e.x, this.player.y - e.y) > CHIEF.near) K.stuckT = (K.stuckT || 0) + DT;
    else K.stuckT = Math.max(0, (K.stuckT || 0) - DT * 2);
    K.lx = e.x; K.ly = e.y;
    return K;
  },
  // 몸(반지름 e.r)이 a 방향으로 벽에 닿지 않고 갈 수 있는 거리
  bodyRay(e, a, max) { const c = Math.cos(a), s = Math.sin(a); for (let d = 4; d <= max; d += 4) if (this.blocked(e.x + c * d, e.y + s * d, e.r)) return d - 4; return max; },
  // 걷는 방향: 몸이 곧장 갈 수 있으면 직진, 아니면 칸 단위 길찾기로 벽을 돌아온다
  chiefWalk(e) {
    const p = this.player, dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
    if (this.bodyRay(e, Math.atan2(dy, dx), l) >= l - 6) { e.path = null; return [dx / l, dy / l]; }
    e.forcePath = 1; return this.pathDir(e, p.x, p.y);
  },
  // 뛰어 내릴 자리: 나에게서 stop만큼 앞 (벽 위면 가까운 땅)
  chiefLanding(e, stop = 0) {
    const p = this.player, dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1, k = Math.max(0, l - stop) / l;
    return this.floorNear(e.x + dx * k, e.y + dy * k, e.r) || this.floorNear(p.x, p.y, e.r) || { x: e.x, y: e.y };
  },
  chiefHop(e, then) { // 한 번 크게 뛴다 (벽 위로도 넘는다) · then: 내려앉은 뒤 할 일
    const q = this.chiefLanding(e, then === 'sac' ? 28 : 0);
    e.mv = { k: 'hop', own: 'chief', t: 0.8, max: 0.8, x0: e.x, y0: e.y, tx: q.x, ty: q.y, then };
    this.emit({ t: 'telegraphCircle', x: q.x, y: q.y, r: 30, dur: 0.8 }); this.mobPose(e, 'crouch', 0.2);
    return true;
  },
  chiefSay(e, text, color = '#d8b0ff') { this.emit({ t: 'text', x: e.x, y: e.y - 34, text, color }); },
  // 다음 기술 고르기 (기술 중이 아닐 때만 · true면 이번 틱은 기술)
  chiefPick(e, p, dist) {
    const K = e.ck, C = CHIEF;
    K.closeT = dist < C.near ? K.closeT + DT : 0;
    if (e.windT > 0) return false;
    if (K.sacT != null && K.sacT <= 0) { // 소환 5초 뒤: 남은 고블린을 제물로 — 내가 폭발 안에 있으면 바로, 멀면 뛰어와서
      K.sacT = null;
      const n = this.enemies.filter((o) => o.sacOf === e.id && !o.dead).length, R = CHIEF.sac.r0 + CHIEF.sac.rPer * n;
      if (!n || dist < R - 20) return this.chiefSacrifice(e);
      this.emit({ t: 'banner', text: '제물 선택', color: '#c27cff' }); return this.chiefHop(e, 'sac');
    }
    if (K.stuckT > 1.2) { K.stuckT = 0; return this.chiefHop(e, null); } // 벽에 끼여 못 오면 뛰어넘는다
    if ((e.mvCd ??= 1.5) > 0) { e.mvCd -= DT; return false; }
    if (K.sumT <= 0) { K.sumT = C.summon.every; return this.gap(e), this.chiefSummon(e); }
    if (dist > 300) return false;
    const aim = Math.atan2(p.y - e.y, p.x - e.x);
    let pick = null;
    if (dist < C.near) pick = K.cd.roar <= 0 && (K.closeT > 1.5 || this.rng.chance(0.4)) ? 'roar' : 'swing';
    else if (dist > C.far) {
      const can = [];
      if (K.cd.jumps <= 0) can.push('jumps');
      if (K.cd.charge <= 0 && this.bodyRay(e, aim, Math.min(dist, 260)) >= Math.min(dist, 260) - 6) can.push('charge'); // 나까지 몸이 벽에 안 닿고 달려갈 수 있을 때만
      if (K.cd.curse <= 0 && !(p.markT > 0)) can.push('curse');
      if (can.length) pick = can[this.rng.int(0, can.length - 1)];
    }
    if (!pick) return false; // 가운데 거리: 걸어오며 불덩이만
    this.gap(e);
    if (pick === 'swing') {
      e.mv = { k: 'swing', own: 'chief', t: C.swing.wind + 0.3, ang: aim }; e.windT = C.swing.wind; e.windMax = C.swing.wind; this.emit({ t: 'windup', id: e.id });
    } else if (pick === 'roar') {
      K.cd.roar = C.roar.cd; this.chiefSay(e, '포효', '#ffb0a0');
      e.mv = { k: 'roar', own: 'chief', t: C.roar.wind + 0.45 }; e.windT = C.roar.wind; e.windMax = C.roar.wind; this.emit({ t: 'chiefRoarWind', id: e.id, dur: C.roar.wind });
    } else if (pick === 'jumps') {
      K.cd.jumps = C.jumps.cd; this.chiefSay(e, '족장의 세 번 뛰기', '#ffd0a0');
      const q = this.chiefLanding(e); e.mv = { k: 'jumps3', boss: true, t: 0.7, max: 0.7, n: 0, x0: e.x, y0: e.y, tx: q.x, ty: q.y }; this.emit({ t: 'telegraphCircle', x: q.x, y: q.y, r: 40, dur: 0.7 });
    } else if (pick === 'charge') { // 돌진: 예고선 0.8초 → 벽 앞까지 (벽에 부딪히면 기절 · enemyai 'charge')
      K.cd.charge = C.charge.cd; this.chiefSay(e, '족장의 돌격', '#ffd0a0');
      const run = Math.max(40, this.bodyRay(e, aim, 260)); e.mv = { k: 'charge', t: 1.5, ang: aim, run: 0.7, dist: run }; this.mobPose(e, 'crouch', 0.8);
      this.emit({ t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(aim) * (run + e.r), y2: e.y + Math.sin(aim) * (run + e.r), dur: 0.8, color: '#ff3a3a', w: e.r * 2 }); e.windT = 0.8; e.windMax = 0.8;
    } else if (pick === 'curse') { // 저주: 지금 내 자리에 마법진 → 다 그려질 때 안에 있으면 저주
      K.cd.curse = C.curse.cd; this.chiefSay(e, '저주', '#d070ff');
      e.mv = { k: 'curse', own: 'chief', t: C.curse.wind + 0.3, x: p.x, y: p.y }; e.windT = C.curse.wind; e.windMax = C.curse.wind;
      this.emit({ t: 'chiefSigil', x: p.x, y: p.y, r: C.curse.r, dur: C.curse.wind, curse: true });
    }
    return true;
  },
  gap(e) { const [a, b] = CHIEF.gap; e.mvCd = this.rng.range(a, b) / (e.enraged ? 1.3 : 1); },
  chiefSummon(e) {
    const C = CHIEF.summon, spots = [];
    for (let i = 0; i < C.n; i++) {
      const a = (i / C.n) * Math.PI * 2 + this.rng.range(-0.3, 0.3); let x = e.x + Math.cos(a) * C.ring, y = e.y + Math.sin(a) * C.ring * 0.8;
      if (this.blocked(x, y, 7)) { x = e.x + Math.cos(a) * 26; y = e.y + Math.sin(a) * 22; if (this.blocked(x, y, 7)) { x = e.x; y = e.y; } }
      spots.push({ x, y });
    }
    this.chiefSay(e, '고블린 소환');
    e.mv = { k: 'summon', own: 'chief', t: C.wind, spots };
    for (const q of spots) this.emit({ t: 'chiefSigil', x: q.x, y: q.y, r: 13, dur: C.wind });
    return true;
  },
  chiefSacrifice(e) {
    const alive = this.enemies.filter((o) => o.sacOf === e.id && !o.dead);
    if (!alive.length) { this.chiefSay(e, '제물이 없다!', '#ffe066'); this.exposeBoss(e, CHIEF.sac.empty, 1.5); return false; } // 고블린을 다 잡았으면 족장이 빈틈을 보인다
    if (!e.ck?.sacSaid) this.emit({ t: 'banner', text: '제물 선택', color: '#c27cff' });
    for (const m of alive) { m.st.stun = Math.max(m.st.stun || 0, CHIEF.sac.mark + 0.2); m.sacMarked = true; this.emit({ t: 'chiefSacMark', id: m.id, from: e.id, dur: CHIEF.sac.mark }); }
    e.mv = { k: 'sacrifice', own: 'chief', t: CHIEF.sac.mark + CHIEF.sac.fly + CHIEF.sac.charge, stage: 0, ids: alive.map((m) => m.id) };
    return true;
  },
  // 기술 진행 (true면 걷지 않는다)
  chiefTick(e, p, mv) {
    const C = CHIEF, def = e.def;
    if (e.windT > 0) e.windT = Math.max(0, e.windT - DT); // 기술 중엔 몬스터 걷기 코드가 쉬어서 예고 시간을 여기서 줄인다 (끝난 뒤 몸통 박치기가 따라 나오지 않게)
    const hitAll = (fn) => { const prev = this.coTgt; for (const q of this.coTargets()) if (fn(q)) { this.coTgt = q === this.player ? null : q; fn.hit(q); } this.coTgt = prev; };
    switch (mv.k) {
      case 'hop': { // 웅크렸다(25%) 포물선으로 날아 내려앉는다 · 공중에서는 벽 위도 지난다
        const k = 1 - Math.max(0, mv.t) / mv.max, a = Math.max(0, (k - 0.25) / 0.75), ea = a * a * (3 - 2 * a);
        if (k >= 0.25) { e.x = mv.x0 + (mv.tx - mv.x0) * ea; e.y = mv.y0 + (mv.ty - mv.y0) * ea; e.moving = true; }
        e.jumpH = k < 0.25 ? 0 : Math.sin(a * Math.PI) * 40;
        if (mv.t > 0) return true;
        e.jumpH = 0; e.x = mv.tx; e.y = mv.ty;
        this.enemyArea(e, e.x, e.y, 30, e.atk * 0.8, def.type, null); this.emit({ t: 'land', x: e.x, y: e.y, big: true });
        e.mv = null;
        if (mv.then === 'sac') { e.ck.sacSaid = true; const r = this.chiefSacrifice(e); e.ck.sacSaid = false; return r; }
        return true;
      }
      case 'swing': {
        if (!mv.done && mv.t <= 0.3) { // 예고가 끝났다: 앞 반원을 휩쓴다
          mv.done = true;
          const f = (q) => { const dx = q.x - e.x, dy = q.y - e.y; let da = Math.atan2(dy, dx) - mv.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.hypot(dx, dy) < C.swing.r + (q.r || 5) && Math.abs(da) < C.swing.arc; };
          f.hit = () => this.hurtPlayer(e.atk * C.swing.k, def.type, e, { fromX: e.x, fromY: e.y }); hitAll(f);
          this.emit({ t: 'chiefSwing', x: e.x, y: e.y, ang: mv.ang, r: C.swing.r, arc: C.swing.arc }); this.emit({ t: 'shake', v: 2.5 });
        }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'roar': {
        if (!mv.done && e.windT <= 0) {
          mv.done = true;
          const f = (q) => Math.hypot(q.x - e.x, q.y - e.y) < C.roar.r + (q.r || 5);
          f.hit = (q) => { this.hurtPlayer(e.atk * C.roar.k, def.type, e, { fromX: e.x, fromY: e.y }); if (q === this.player && this.hurtLanded) { this.knockPlayer(e.x, e.y, C.roar.push); this.ccPlayer({ stun: C.roar.stun }); } };
          hitAll(f);
          this.emit({ t: 'chiefRoar', x: e.x, y: e.y, r: C.roar.r, dir: e.dir || 1 }); this.emit({ t: 'shake', v: 7 }); this.emit({ t: 'hitstop', v: 0.06, id: e.id });
        }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'curse': {
        if (!mv.done && mv.t <= 0.3) {
          mv.done = true;
          if (Math.hypot(p.x - mv.x, p.y - mv.y) < C.curse.r + (p.r || 5) && !(p.invuln > 0)) {
            this.hurtPlayer(e.atk * C.curse.k, 'mag', e, { fromX: mv.x, fromY: mv.y });
            if (this.hurtLanded) { p.markT = C.curse.t; this.emit({ t: 'chiefCursed', x: p.x, y: p.y }); this.emit({ t: 'text', x: p.x, y: p.y - 30, text: '저주 · 받는 피해 +30%', color: '#d070ff' }); }
          }
          this.emit({ t: 'chiefSigilFire', x: mv.x, y: mv.y, r: C.curse.r });
        }
        if (mv.t > 0) return true;
        e.mv = null; return true;
      }
      case 'summon': {
        if (mv.t > 0) return true;
        for (const q of mv.spots) {
          const m = this.makeEnemy('goblin', q.x, q.y, { summoned: true });
          m.summoner = e.id; m.sacOf = e.id; m.noLoot = true; m.state = 'chase'; m.home = { ...e.home };
          this.enemies.push(m); this.emit({ t: 'chiefRise', x: q.x, y: q.y });
        }
        e.ck.sacT = C.sac.after;
        e.mv = null; return true;
      }
      case 'sacrifice': {
        const S = C.sac, age = S.mark + S.fly + S.charge - mv.t;
        if (mv.stage === 0 && age >= S.mark) { // 표식이 다 찼다: 아직 살아 있는 제물은 보라 불에 타 죽고 넋이 족장에게
          mv.stage = 1; mv.n = 0;
          for (const id of mv.ids) { const m = this.enemies.find((o) => o.id === id && !o.dead); if (!m) continue; mv.n++; m.dead = true; m.hp = 0; this.emit({ t: 'chiefSacBurn', x: m.x, y: m.y, tx: e.x, ty: e.y, from: e.id, fly: S.fly }); }
          if (!mv.n) { this.chiefSay(e, '제물이 없다!', '#ffe066'); this.exposeBoss(e, S.empty, 1.5); return false; } // 표식 동안 다 잡았다
          mv.r = S.r0 + S.rPer * mv.n;
          this.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: mv.r, dur: S.fly + S.charge }); this.emit({ t: 'chiefSacCharge', id: e.id, x: e.x, y: e.y, r: mv.r, dur: S.fly + S.charge, n: mv.n });
          this.emit({ t: 'text', x: e.x, y: e.y - 44, text: `제물 ${mv.n}`, color: '#e2a8ff' });
        }
        if (mv.t > 0) return true;
        this.enemyArea(e, e.x, e.y, mv.r, e.atk * S.k * mv.n, 'mag', null);
        this.emit({ t: 'chiefSacBlast', x: e.x, y: e.y, r: mv.r, n: mv.n }); this.emit({ t: 'shake', v: 6 + mv.n }); this.emit({ t: 'hitstop', v: 0.12 });
        e.mv = null; return true;
      }
    }
    e.mv = null; return false;
  },
};

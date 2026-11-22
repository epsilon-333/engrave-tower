// 늪의 거인 = 슬라임 왕 (20층 주인 climbQueen): 거리에 맞춰 기술을 고른다 (data/monsters.js climbQueen.ownKit = 'slime')
//   가까이: 내려치기 / 가운데 · 멀리: 슬라임공 셋(멀리 가거나 벽에 닿으면 터져 사방으로 방울) · 순간이동(꿀렁이며 땅으로 들어갔다 내 곁에서 솟는다)
//   거대 슬라임공: 터지면 작은 슬라임 셋 (보스 부하 최대 4) · 하늘에서 슬라임공 · 지나간 길에 3초 남는 점액(밟으면 느려진다)
//   처음 쓰러지면 둘로 갈라진다: 각자 원래 체력의 1/3 (한 단계만큼) · 둘 다 쓰러뜨려야 끝
// World.prototype 에 붙는다 (sim/world.js 끝). 메서드 안의 this 는 World
import { DT } from './world.js';
import { BOSS_ADDS_MAX } from './enemyai.js';

export const SLIME = {
  near: 60, gap: [1.1, 1.8],
  slam: { r: 52, arc: 1.4, k: 1.4, wind: 0.45, after: 0.25 },                       // 내려치기: 앞 반원 · 140%
  ball: { n: 3, wind: 0.55, speed: 140, dist: 150, fan: 0.35, k: 0.9, shards: 8, shardSpeed: 120, shardK: 0.45, cd: 5 }, // 슬라임공: 150 가거나 벽 · 나에 닿으면 터져 여덟 방울
  sink: { down: 0.6, under: 0.35, up: 0.4, near: 38, r: 42, k: 1.0, cd: 8 },          // 순간이동: 들어가기 0.6초 · 땅속 0.35초 · 솟기 0.4초 (솟을 때 둘레 42)
  split: { hp: 1 / 3, gap: 26 },                                                       // 첫 죽음: 둘로 · 각자 체력 1/3
  big: { wind: 0.8, speed: 95, dist: 170, rad: 11, k: 1.3, shards: 10, slimes: 3, cd: 13 },     // 거대 슬라임공: 터지면 방울 열 · 작은 슬라임 셋 (보스 부하 최대 4)
  rain: { n: 6, wind: 0.6, fall: 0.9, gap: 0.18, r: 24, k: 1.0, cd: 10 },                // 하늘에서 슬라임공: 첫 공은 내 자리 · 나머지는 둘레
  //                                                                  // 맞아서 떨어지는 슬라임 (너무 몰리지 않게 0.35초에 하나까지)
  trail: { every: 0.15, life: 3, r: 10 },                                              // 지나간 길: 3초 · 밟으면 느려진다
};
const S = SLIME;

export const SlimeMethods = {
  slimeTimers(e) {
    const K = (e.sk ||= { cd: { ball: 1, sink: 3, big: 4, rain: 6 }, trailT: 0 });
    for (const k in K.cd) K.cd[k] -= DT;
    if ((K.trailT -= DT) <= 0 && !(e.sinkT > 0) && Math.hypot(e.x - (K.lx ?? e.x + 9), e.y - (K.ly ?? e.y)) > 3) { // 움직였으면 점액 한 점
      K.trailT = S.trail.every; K.lx = e.x; K.ly = e.y;
      (this.slimeTrail ||= []).push({ x: e.x, y: e.y + 2, t: S.trail.life, max: S.trail.life, r: S.trail.r * (e.isHalf ? 0.75 : 1), s: Math.random() * 100 });
    }
    return K;
  },
  slimePick(e, p, dist) {
    const K = e.sk;
    if (e.windT > 0) return false;
    if ((e.mvCd ??= 1.0) > 0) { e.mvCd -= DT; return false; }
    if (dist > 320) return false;
    const can = (k) => K.cd[k] <= 0, pool = [];
    if (dist < S.near) { pool.push('slam', 'slam', 'slam'); if (can('sink')) pool.push('sink'); if (can('rain')) pool.push('rain'); }
    else { if (can('ball')) pool.push('ball', 'ball'); if (can('sink')) pool.push('sink', dist > 150 ? 'sink' : 'ball'); if (can('big')) pool.push('big', 'big'); if (can('rain')) pool.push('rain', 'rain'); }
    const pick = pool.filter((k) => k === 'slam' || can(k));
    if (!pick.length) return false; // 걸어서 다가온다
    return this.slimeStart(e, p, pick[this.rng.int(0, pick.length - 1)]);
  },
  slimeStart(e, p, k) {
    const K = e.sk, aim = Math.atan2(p.y - e.y, p.x - e.x), wind = (t) => { e.windT = t; e.windMax = t; };
    const [a, b] = S.gap; e.mvCd = this.rng.range(a, b) / (e.enraged ? 1.3 : 1);
    switch (k) {
      case 'slam':
        e.mv = { k, own: 'slime', t: S.slam.wind + S.slam.after, ang: aim }; wind(S.slam.wind); this.emit({ t: 'windup', id: e.id }); return true;
      case 'ball': K.cd.ball = S.ball.cd;
        e.mv = { k, own: 'slime', t: S.ball.wind + 0.3, ang: aim }; wind(S.ball.wind); this.emit({ t: 'slimeSwell', id: e.id, dur: S.ball.wind }); return true;
      case 'big': K.cd.big = S.big.cd;
        e.mv = { k, own: 'slime', t: S.big.wind + 0.35, ang: aim }; wind(S.big.wind); this.emit({ t: 'slimeSwell', id: e.id, dur: S.big.wind, big: true }); return true;
      case 'rain': K.cd.rain = S.rain.cd;
        e.mv = { k, own: 'slime', t: S.rain.wind + 0.4 }; wind(S.rain.wind); this.emit({ t: 'slimeLaunch', id: e.id, dur: S.rain.wind }); return true;
      case 'sink': { K.cd.sink = S.sink.cd; const T = S.sink;
        e.mv = { k, own: 'slime', t: T.down + T.under + T.up, max: T.down + T.under + T.up };
        e.slimeSink = { t: 0, down: T.down, under: T.under, up: T.up }; this.emit({ t: 'slimeSinkStart', id: e.id, x: e.x, y: e.y }); return true; }
    }
    return false;
  },
  slimeTick(e, p, mv) {
    const def = e.def;
    if (e.windT > 0) e.windT = Math.max(0, e.windT - DT);
    const hitAll = (test, hit) => { const prev = this.coTgt; for (const q of this.coTargets()) if (test(q)) { this.coTgt = q === this.player ? null : q; hit(q); } this.coTgt = prev; };
    const fire = e.windT <= 0 && !mv.done;
    switch (mv.k) {
      case 'slam':
        if (fire) { mv.done = true; const fx = e.x + Math.cos(mv.ang) * 26, fy = e.y + Math.sin(mv.ang) * 18;
          hitAll((q) => { const dx = q.x - e.x, dy = q.y - e.y; let da = Math.atan2(dy, dx) - mv.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.hypot(dx, dy) < S.slam.r * (e.isHalf ? 0.8 : 1) + (q.r || 5) && Math.abs(da) < S.slam.arc; },
            () => this.hurtPlayer(e.atk * S.slam.k, def.type, e, { fromX: e.x, fromY: e.y }));
          this.emit({ t: 'slimeSlam', x: fx, y: fy, ang: mv.ang, r: S.slam.r }); this.emit({ t: 'shake', v: 4 }); }
        break;
      case 'ball': // 슬라임공 셋: 부채꼴로 던진다
        if (fire) { mv.done = true; const B = S.ball, aim = Math.atan2(p.y - e.y, p.x - e.x);
          for (let i = 0; i < B.n; i++) { const a = aim + (i - (B.n - 1) / 2) * B.fan, sx = e.x + Math.cos(a) * 12, sy = e.y - 8;
            this.projs.push({ owner: 'e', src: e, x: sx, y: sy, vx: Math.cos(a) * B.speed, vy: Math.sin(a) * B.speed, life: B.dist / B.speed, dmg: e.atk * B.k, type: def.type, status: 'poison', rad: 6, skind: 'slimeBall', hitFx: 'slimeNone', color: '#7ad85a', shatter: { n: B.shards, sp: B.shardSpeed, dmg: e.atk * B.shardK }, seed: this.rng.range(0, 6) }); }
          this.emit({ t: 'slimeThrow', x: e.x, y: e.y - 10, ang: aim }); }
        break;
      case 'big': // 거대 슬라임공 하나: 터지면 방울 · 작은 슬라임 셋
        if (fire) { mv.done = true; const B = S.big, a = Math.atan2(p.y - e.y, p.x - e.x);
          this.projs.push({ owner: 'e', src: e, x: e.x + Math.cos(a) * 14, y: e.y - 10, vx: Math.cos(a) * B.speed, vy: Math.sin(a) * B.speed, life: B.dist / B.speed, dmg: e.atk * B.k, type: def.type, status: 'poison', rad: B.rad, skind: 'slimeBig', hitFx: 'slimeNone', color: '#7ad85a', shatter: { n: B.shards, sp: 110, dmg: e.atk * S.ball.shardK, slimes: B.slimes, of: e.splitOf || e.id }, seed: this.rng.range(0, 6) });
          this.emit({ t: 'slimeThrow', x: e.x, y: e.y - 10, ang: a }); this.emit({ t: 'shake', v: 3 }); }
        break;
      case 'rain': // 하늘로 뿜은 슬라임공이 떨어진다 (첫 공은 그때의 내 자리)
        if (fire) { mv.done = true; const Rn = S.rain;
          for (let i = 0; i < Rn.n; i++) this.delayed.push({ t: i * Rn.gap, run: () => { if (e.dead) return;
            const q = i === 0 ? { x: this.player.x, y: this.player.y } : this.floorNear(this.player.x + this.rng.range(-70, 70), this.player.y + this.rng.range(-50, 50), 6) || { x: this.player.x, y: this.player.y };
            this.emit({ t: 'telegraphCircle', x: q.x, y: q.y, r: Rn.r, dur: Rn.fall }); this.emit({ t: 'slimeFall', x: q.x, y: q.y, dur: Rn.fall });
            this.delayed.push({ t: Rn.fall, run: () => { if (e.dead) return; this.enemyArea(e, q.x, q.y, Rn.r, e.atk * Rn.k, def.type, 'poison'); this.emit({ t: 'slimeLand', x: q.x, y: q.y, r: Rn.r }); this.emit({ t: 'shake', v: 2 }); } }); } }); }
        break;
      case 'sink': { // 꿀렁이며 땅속으로 → 내 곁에서 솟는다 (땅속에서는 맞지 않는다)
        const T = S.sink, el = mv.max - mv.t; e.slimeSink.t = el;
        e.invulnT = el > T.down * 0.7 && el < T.down + T.under ? Math.max(e.invulnT || 0, DT * 2) : e.invulnT;
        if (!mv.moved && el >= T.down) { // 땅속: 내 곁으로 옮긴다
          mv.moved = true; let q = null;
          for (let k = 0; k < 10 && !q; k++) { const a = this.rng.range(0, Math.PI * 2); q = this.floorNear(p.x + Math.cos(a) * T.near, p.y + Math.sin(a) * T.near * 0.8, e.r); }
          q ||= { x: p.x, y: p.y }; e.x = q.x; e.y = q.y; this.emit({ t: 'slimeSinkEnd', id: e.id, x: q.x, y: q.y, dur: T.under + T.up }); this.emit({ t: 'telegraphCircle', x: q.x, y: q.y, r: T.r, dur: T.under + T.up * 0.6 });
        }
        if (!mv.done && el >= T.down + T.under + T.up * 0.6) { mv.done = true; // 솟는다: 둘레를 친다
          hitAll((q) => Math.hypot(q.x - e.x, q.y - e.y) < T.r + (q.r || 5), () => this.hurtPlayer(e.atk * T.k, def.type, e, { fromX: e.x, fromY: e.y }));
          this.emit({ t: 'slimeRise', x: e.x, y: e.y, r: T.r }); this.emit({ t: 'shake', v: 4 }); }
        if (mv.t <= 0) e.slimeSink = null;
        break; }
    }
    if (mv.t > 0) return true;
    e.mv = null; e.slimeSink = null; return true;
  },
  // 거대 슬라임공이 터진 자리에서 작은 슬라임 (보스 부하 최대 4)
  slimeSpawnAt(x, y, n, boss) {
    const alive = this.enemies.filter((o) => !o.dead && o.summoned && o.slimeOf === boss).length;
    for (let i = 0; i < Math.min(n, BOSS_ADDS_MAX - alive); i++) {
      const a = (i / n) * Math.PI * 2 + this.rng.range(0, 1), q = this.floorNear(x + Math.cos(a) * 14, y + Math.sin(a) * 10, 6); if (!q) continue;
      const m = this.makeEnemy('slime', q.x, q.y, { summoned: true, noAffix: true }); m.summoned = true; m.slimeOf = boss; m.summoner = boss; m.state = 'chase'; m.home = { x: q.x, y: q.y };
      this.enemies.push(m); this.emit({ t: 'slimeDrip', x, y: y - 6, tx: q.x, ty: q.y });
    }
  },
  // 처음 쓰러질 때: 둘로 갈라진다 (true면 죽지 않는다 — 큰 몸은 사라지고 작은 몸 둘이 남는다)
  slimeSplit(e) {
    if (e.isHalf) { // 갈라진 하나가 쓰러졌다: 남은 하나가 이 층의 주인
      const other = this.enemies.find((o) => o !== e && !o.dead && o.isHalf && o.splitOf === e.splitOf);
      if (other && this.climb?.boss === e) { this.climb.boss = other; if (this.tower) this.tower.boss = other; }
      return false;
    }
    const hp = e.maxHp * S.split.hp, halves = [];
    for (const sd of [-1, 1]) {
      const q = this.floorNear(e.x + sd * S.split.gap, e.y, 8) || { x: e.x, y: e.y };
      const h = this.makeEnemy(e.defId, q.x, q.y, { noAffix: true });
      Object.assign(h, { isHalf: true, splitOf: e.id, hp, maxHp: hp, atk: e.atk, scale: e.scale, state: 'chase', climb: e.climb, lair: false, enraged: e.enraged, dir: sd });
      h.r = Math.round(e.r * 0.75); h.invulnT = 0.5; h.mvCd = 0.8 + (sd > 0 ? 0.6 : 0); this.enemies.push(h); this.aggro(h); halves.push(h);
    }
    if (this.climb?.boss === e) this.climb.boss = halves[0];
    if (this.tower?.boss === e) this.tower.boss = halves[0];
    this.emit({ t: 'slimeSplit', x: e.x, y: e.y, ids: halves.map((h) => h.id) }); this.emit({ t: 'shake', v: 6 });
    e.dead = true; e.mv = null;
    this.emit({ t: 'text', x: e.x, y: e.y - 34, text: '둘로 갈라졌다!', color: '#9be15d' });
    return true;
  },
  // 지나간 길의 점액: 3초 · 밟으면 느려진다 (독액 웅덩이와 같은 끈적임 p.oozeT)
  updateSlimeTrail() {
    const L = this.slimeTrail; if (!L?.length) return;
    const p = this.player;
    for (const o of L) { o.t -= DT; if (o.t > 0 && Math.hypot(p.x - o.x, (p.y - o.y) / 0.6) < o.r && !(p.airT > 0)) p.oozeT = 0.15; }
    this.slimeTrail = L.filter((o) => o.t > 0);
  },
  // 슬라임공이 터진다: 사방으로 방울
  slimeShatter(pr) {
    const s = pr.shatter, off = this.rng.range(0, Math.PI);
    for (let i = 0; i < s.n; i++) { const a = off + (i / s.n) * Math.PI * 2;
      this.projs.push({ owner: 'e', src: pr.src, x: pr.x + Math.cos(a) * 9, y: pr.y + Math.sin(a) * 9, vx: Math.cos(a) * s.sp, vy: Math.sin(a) * s.sp, life: 0.9, dmg: s.dmg, type: pr.type, status: 'poison', skind: 'slimeShard', hitFx: 'slimeNone', color: '#7ad85a' }); }
    if (s.slimes) this.slimeSpawnAt(pr.x, pr.y, s.slimes, s.of);
    this.emit({ t: 'slimePop', x: pr.x, y: pr.y, big: !!s.slimes });
  },
};

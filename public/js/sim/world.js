// 전투·탐험 시뮬레이션. 고정 틱(60Hz) + 시드 난수 + 입력만으로 진행 → 서버 권한 방식으로 옮기기 쉽다.
// 렌더러는 world 상태와 world.events 만 읽고, main 은 world.signals 로 화면 전환을 한다.
import { MONSTERS, ZONES, DUMMIES, ECHOES, LORES } from '../data/monsters.js';
import { REACTIONS } from '../data/engravings.js';
import { createRng } from './rng.js';
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD, generateField } from './mapgen.js';

export { TILE };
export const DT = 1 / 60;
const STATUS_COLOR = { burn: '#ff7a2a', poison: '#9be15d', bleed: '#e0445a', chill: '#9fe3ff', true: '#ffffff' };
const ACTIVE_RANGE = 440;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL_MONSTERS = { ...MONSTERS, ...DUMMIES };

export class World {
  // mode: 'field' | 'plaza'
  constructor({ build, mode, zoneId, seed, map }) {
    this.mode = mode;
    this.setBuild(build);
    this.zone = zoneId ? ZONES.find((z) => z.id === zoneId) : null;
    this.rng = createRng(seed);
    this.map = map || generateField(this.zone, seed);
    const m = this.map;
    this.tw = m.tw; this.th = m.th; this.tiles = m.tiles;
    this.crackHp = new Map();
    this.t = 0; this.events = []; this.signals = [];
    this.enemies = []; this.projs = []; this.clouds = []; this.drops = []; this.objects = [];
    this.nextId = 1;
    const sx = m.start.x * TILE + 8, sy = m.start.y * TILE + 8;
    this.player = {
      x: sx + (mode === 'field' ? 28 : 0), y: sy, r: 5, hp: this.d.maxHp, shield: 0, aimX: 1, aimY: 0, dir: 1,
      atkCd: 0, atkCount: 0, dashCd: 0, dashT: 0, dvx: 0, dvy: 0, invuln: 0, st: {}, hitFlash: 0,
      undyingUsed: false, lastStandCd: 0, cleanseT: 8, momentum: 0, momentumT: 0, moving: false, pendingDouble: -1,
      swingT: 0, swingAng: 0, swingDir: 1, swingMax: 0.16, walkT: 0, liquidT: 0, onLiquid: false, skillCd: 0, skillMax: 6, spinT: 0,
    };
    this.state = 'play'; // play | dead | done
    this.loot = { echoes: {}, gold: 0, xp: 0, kills: {}, chests: 0, lores: [] };
    this.discovered = new Set();
    this.near = null;
    this.flow = new Int16Array(this.tw * this.th); this.flowT = 0;

    // 탐험 안개
    this.explored = new Uint8Array(this.tw * this.th);
    this.revealed = []; // 렌더러가 소비
    if (mode === 'plaza') this.explored.fill(1);

    if (mode === 'field') {
      this.camps = m.camps.map((c) => ({ ...c, members: [], respawnT: 0 }));
      for (const c of this.camps) this.spawnCamp(c);
      const elite = this.makeEnemy(this.zone.elite, m.lair.x * TILE + 8, m.lair.y * TILE + 8);
      elite.home = { x: elite.x, y: elite.y };
      this.enemies.push(elite);
      this.objects.push({ kind: 'portal', x: sx, y: sy - 14, label: '귀환 포탈 (잔향 전부 보존)', color: this.zone.portal });
      for (const c of m.chests) this.objects.push({ kind: 'chest', x: c.x * TILE + 8, y: c.y * TILE + 8, rich: c.rich, label: c.rich ? '숨겨진 보물 상자' : '보물 상자' });
      for (const l of m.lores) this.objects.push({ kind: 'lore', x: l.x * TILE + 8, y: l.y * TILE + 8, label: '고대 석판 읽기' });
      this.reveal(true);
    } else {
      for (const o of m.objects) this.objects.push({ ...o });
      for (const dm of m.dummies) { const e = this.makeEnemy(dm.id, dm.x, dm.y); e.home = { x: dm.x, y: dm.y }; this.enemies.push(e); }
    }
  }

  setBuild(build) {
    this.b = build; this.d = build.derived; this.f = build.flags; this.s = build.stats;
    if (this.player) this.player.hp = Math.min(this.player.hp, this.d.maxHp);
    if (this.player && this.mode === 'plaza') this.player.hp = this.d.maxHp;
  }

  emit(e) { this.events.push(e); }

  // ───────────── 타일 ─────────────
  tileAt(px, py) {
    const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
    if (x < 0 || y < 0 || x >= this.tw || y >= this.th) return T_WALL;
    return this.tiles[y * this.tw + x];
  }
  solid(px, py) { const t = this.tileAt(px, py); return t === T_WALL || t === T_CRACK || t === T_BUILD; }
  blocked(x, y, r) {
    return this.solid(x - r, y - r) || this.solid(x + r, y - r) || this.solid(x - r, y + r) || this.solid(x + r, y + r)
      || this.solid(x, y - r) || this.solid(x, y + r) || this.solid(x - r, y) || this.solid(x + r, y);
  }
  move(ent, dx, dy) {
    const r = Math.max(3, ent.r - 1);
    if (!this.blocked(ent.x + dx, ent.y, r)) ent.x += dx;
    if (!this.blocked(ent.x, ent.y + dy, r)) ent.y += dy;
  }

  reveal(force) {
    const p = this.player;
    const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE), R = 8;
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (x < 0 || y < 0 || x >= this.tw || y >= this.th) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
      const i = y * this.tw + x;
      if (!this.explored[i]) { this.explored[i] = 1; this.revealed.push(i); }
    }
    if (force) this.revealed.push(-1);
  }

  exploredPct() {
    let open = 0, seen = 0;
    for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] !== T_WALL) { open++; if (this.explored[i]) seen++; }
    return open ? seen / open : 0;
  }

  step(input) {
    if (this.state !== 'play') return;
    this.t += DT;
    this.updatePlayer(input);
    this.updateFlow();
    this.updateEnemies();
    this.updateProjs();
    this.updateClouds();
    this.updateDrops();
    this.updateCamps();
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.mode === 'field' && Math.floor(this.t * 60) % 6 === 0) this.reveal();
  }

  // ───────────── 플레이어 ─────────────
  updatePlayer(inp) {
    const p = this.player, d = this.d, f = this.f;
    for (const k of ['atkCd', 'dashCd', 'invuln', 'hitFlash', 'lastStandCd', 'swingT', 'liquidT', 'skillCd', 'spinT']) p[k] = Math.max(0, p[k] - DT);

    let slow = 0;
    for (const [k, st] of Object.entries(p.st)) {
      st.t -= DT;
      if (st.dps) this.damagePlayerDot(st.dps * DT);
      if (k === 'chill') slow = 0.35;
      if (st.t <= 0) delete p.st[k];
    }
    if (f.has('cleanse')) {
      p.cleanseT -= DT;
      if (p.cleanseT <= 0) {
        p.cleanseT = 8;
        if (Object.keys(p.st).length) { p.st = {}; this.emit({ t: 'text', x: p.x, y: p.y - 14, text: '정화', color: '#fff6a0' }); }
      }
    }
    if (d.regen) this.heal(d.maxHp * d.regen * DT, 'regen');
    if (this.mode === 'plaza') p.hp = d.maxHp;
    p.momentumT -= DT; if (p.momentumT <= 0) p.momentum = 0;

    // 지형 효과
    p.onLiquid = this.tileAt(p.x, p.y + 3) === T_LIQUID;
    if (p.onLiquid && this.zone) {
      const lq = this.zone.liquid;
      if (lq === 'water') slow = Math.max(slow, 0.35);
      if (lq === 'snow') slow = Math.max(slow, 0.25);
      if (lq === 'lava' && p.liquidT <= 0) { p.liquidT = 0.8; this.hurtPlayer(6 + this.zone.floor * 4, 'mag', null, { direct: true, status: 'burn' }); }
    }

    const ax = inp.aimX - p.x, ay = inp.aimY - p.y, al = Math.hypot(ax, ay) || 1;
    p.aimX = ax / al; p.aimY = ay / al;
    if (Math.abs(p.aimX) > 0.1) p.dir = p.aimX > 0 ? 1 : -1;

    let mx = inp.moveX, my = inp.moveY; const ml = Math.hypot(mx, my);
    if (ml > 0) { mx /= ml; my /= ml; }
    p.moving = ml > 0;
    if (p.moving) p.walkT += DT;
    if (p.dashT > 0) {
      p.dashT -= DT;
      this.move(p, p.dvx * DT, p.dvy * DT);
    } else {
      const spd = d.moveSpeed * (1 - slow);
      this.move(p, mx * spd * DT, my * spd * DT);
      if (inp.dash && p.dashCd <= 0) {
        const dx = ml > 0 ? mx : p.aimX, dy = ml > 0 ? my : p.aimY;
        p.dashT = 0.16; p.dvx = dx * 400; p.dvy = dy * 400; p.invuln = Math.max(p.invuln, 0.22);
        p.dashCd = d.dashCd * (1 - d.cdr);
        this.emit({ t: 'dash', x: p.x, y: p.y, dx, dy });
        if (f.has('dashAfterimage')) this.afterimage(p.x, p.y, p.x + dx * 64, p.y + dy * 64);
        for (const tr of this.b.triggers.dash) if (this.rng.chance(tr.chance)) this.doAction(tr.action, null, p);
      }
    }

    if (p.pendingDouble >= 0) { p.pendingDouble -= DT; if (p.pendingDouble < 0) this.attack(0.12); }
    if (inp.attack && p.atkCd <= 0) {
      const mom = this.b.race === 'beast' ? 1 + p.momentum * 0.04 : 1;
      p.atkCd = 1 / (this.b.weapon.speed * d.atkSpeed * mom);
      this.attack(0);
      if (f.has('doubleAttack') && this.rng.chance(0.3)) p.pendingDouble = 0.08;
    }

    if (inp.skill && p.skillCd <= 0) this.useSkill();

    // 상호작용 대상
    this.near = null;
    let bd = 26;
    for (const o of this.objects) {
      if (o.opened) continue;
      const dd = Math.hypot(o.x - p.x, o.y - p.y);
      if (dd < bd) { bd = dd; this.near = o; }
    }
    if (inp.interact && this.near) this.interact(this.near);
  }

  interact(o) {
    if (o.kind === 'portal') { this.state = 'done'; return; }
    if (o.kind === 'gate') { this.signals.push({ t: 'enterZone', zone: o.zone }); return; }
    if (o.kind === 'station') { this.signals.push({ t: 'openPanel', panel: o.panel }); return; }
    if (o.kind === 'chest') {
      o.opened = true;
      this.loot.chests++;
      this.emit({ t: 'chest', x: o.x, y: o.y, rich: o.rich });
      const ids = [...this.zone.pool.map((m) => MONSTERS[m].echo.id)];
      const n = o.rich ? this.rng.int(5, 7) : this.rng.int(2, 3);
      for (let i = 0; i < n; i++) this.spawnDrop(o.x, o.y, 'echo', this.rng.pick(ids));
      if (o.rich && this.rng.chance(0.35)) this.spawnDrop(o.x, o.y, 'echo', MONSTERS[this.zone.elite].echo.id);
      const gold = (o.rich ? 40 : 12) * this.zone.floor + this.rng.int(0, 10);
      for (let i = 0; i < 5; i++) this.spawnDrop(o.x, o.y, 'gold', null, Math.ceil(gold / 5));
      return;
    }
    if (o.kind === 'lore') {
      o.opened = true;
      const text = LORES[this.rng.int(0, LORES.length - 1)];
      this.loot.lores.push(text);
      this.loot.xp += 10 * this.zone.floor;
      this.signals.push({ t: 'lore', text });
      this.emit({ t: 'text', x: o.x, y: o.y - 16, text: `+${10 * this.zone.floor} 경험치`, color: '#8fd0ff' });
    }
  }

  attack(angOff) {
    const p = this.player, d = this.d, w = this.b.weapon;
    let type = w.dmg;
    if (type === 'phys' && this.f.has('physToMag')) type = 'mag';
    const atk = type === 'phys' ? d.physAtk : d.magAtk;
    p.atkCount++;
    let mul = w.mul, heavy = false;
    if (this.f.has('heavyHit') && p.atkCount % 4 === 0) { mul *= 2; heavy = true; }
    const base = atk * mul;
    const ang = Math.atan2(p.aimY, p.aimX) + angOff;
    if (w.kind === 'melee') {
      p.swingDir = p.atkCount % 2 ? 1 : -1;
      p.swingMax = Math.min(0.2, 0.6 / (w.speed * d.atkSpeed)); p.swingT = p.swingMax; p.swingAng = ang;
      this.emit({ t: 'swing', x: p.x, y: p.y, ang, range: w.range, arc: w.arc, heavy, type, dir: p.swingDir, dur: p.swingMax });
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
        if (dist > w.range + e.r) continue;
        let da = Math.atan2(dy, dx) - ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) <= w.arc / 2 || dist < e.r + 6) this.hitEnemy(e, base, type, heavy);
      }
      // 균열 벽 타격
      const hx = p.x + Math.cos(ang) * 14, hy = p.y + Math.sin(ang) * 14;
      if (this.tileAt(hx, hy) === T_CRACK) this.hitCrack(hx, hy, base);
    } else {
      const n = w.count || 1;
      for (let i = 0; i < n; i++) {
        const a = ang + (i - (n - 1) / 2) * (w.spread || 0);
        const sp = w.projSpeed * d.projMul;
        this.projs.push({
          owner: 'p', x: p.x + Math.cos(a) * 6, y: p.y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: (w.range * d.projMul) / sp, dmg: base, type, pierce: w.pierce || 0, hit: new Set(), heavy, splash: w.splash || 0,
          color: type === 'mag' ? '#b58cff' : '#e8e2cf', kind: type === 'phys' ? 'arrow' : 'orb',
        });
      }
      p.swingT = 0.1; p.swingMax = 0.1; p.swingAng = ang;
      this.emit({ t: 'shoot', type, x: p.x, y: p.y });
    }
  }

  // 무기 스킬 (Q): 근접 회전베기 / 활 관통 일제사격 / 마법 폭발. 적중 시 각인 트리거가 그대로 발동한다
  useSkill() {
    const p = this.player, d = this.d, w = this.b.weapon;
    let type = w.dmg;
    if (type === 'phys' && this.f.has('physToMag')) type = 'mag';
    const atk = type === 'phys' ? d.physAtk : d.magAtk;
    if (w.kind === 'melee') {
      p.skillMax = 6 * (1 - d.cdr); p.skillCd = p.skillMax;
      const r = w.range * 1.5 + 8;
      p.spinT = 0.3;
      this.emit({ t: 'spin', x: p.x, y: p.y, r, type });
      this.emit({ t: 'hitstop', v: 0.04 });
      for (const e of this.enemiesNear(p.x, p.y, r)) this.hitEnemy(e, atk * w.mul * 1.6, type, true);
    } else if (type === 'phys') {
      p.skillMax = 6 * (1 - d.cdr); p.skillCd = p.skillMax;
      const ang = Math.atan2(p.aimY, p.aimX), sp = w.projSpeed * d.projMul * 1.3;
      for (let i = -2; i <= 2; i++) {
        const a = ang + i * 0.14;
        this.projs.push({ owner: 'p', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (w.range * 1.4 * d.projMul) / sp, dmg: atk * w.mul * 1.1, type, pierce: 3, hit: new Set(), color: '#ffe8a0', kind: 'arrow' });
      }
      this.emit({ t: 'volley', x: p.x, y: p.y });
    } else {
      p.skillMax = 7 * (1 - d.cdr); p.skillCd = p.skillMax;
      const r = 64;
      this.emit({ t: 'nova', x: p.x, y: p.y, r });
      this.emit({ t: 'hitstop', v: 0.05 });
      for (const e of this.enemiesNear(p.x, p.y, r)) this.hitEnemy(e, atk * w.mul * 1.9, 'mag', true);
    }
  }

  hitCrack(x, y, dmg) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), i = ty * this.tw + tx;
    const hp = (this.crackHp.get(i) ?? 3) - 1;
    this.emit({ t: 'crackHit', x: tx * TILE + 8, y: ty * TILE + 8 });
    if (hp <= 0) {
      this.tiles[i] = T_FLOOR;
      this.crackHp.delete(i);
      this.emit({ t: 'crackBreak', x: tx * TILE + 8, y: ty * TILE + 8, tile: i });
      this.emit({ t: 'text', x: tx * TILE + 8, y: ty * TILE - 4, text: '숨겨진 통로!', color: '#ffe080' });
    } else this.crackHp.set(i, hp);
  }

  afterimage(x1, y1, x2, y2) {
    this.emit({ t: 'afterimage', x1, y1, x2, y2 });
    const base = Math.max(this.d.physAtk, this.d.magAtk) * 0.8;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (distToSeg(e.x, e.y, x1, y1, x2, y2) < e.r + 10) this.damageEnemy(e, base, this.d.physAtk >= this.d.magAtk ? 'phys' : 'mag', { src: 'aoe' });
    }
  }

  hitEnemy(e, base, type, heavy, proj = false) {
    const p = this.player, d = this.d, f = this.f;
    const crit = this.rng.chance(d.crit);
    this.aggro(e);
    this.damageEnemy(e, base * (crit ? d.critDmg : 1), type, { src: 'attack', crit, heavy, proj });
    if (!e.def.elite && e.def.ai !== 'dummy') {
      const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1;
      const kb = d.knockback * (heavy ? 2 : 1);
      e.kbx += (dx / l) * kb * 3; e.kby += (dy / l) * kb * 3;
    }
    if (e.def.ai === 'dummy') e.wobble = 0.3;
    if (heavy || crit) this.emit({ t: 'hitstop', v: heavy ? 0.06 : 0.03 });
    if (this.b.race === 'beast') { p.momentum = Math.min(10, p.momentum + 1); p.momentumT = 1.5; }
    for (const tr of this.b.triggers.hit) if (this.rng.chance(tr.chance)) this.doAction(tr.action, e, e);
    if (crit) {
      if (f.has('markOnCrit') && !e.dead) e.st.mark = 3;
      if (f.has('critBleed')) this.applyStatus(e, 'bleed', 2);
      for (const tr of this.b.triggers.crit) if (this.rng.chance(tr.chance)) this.doAction(tr.action, e, e);
    }
  }

  damageEnemy(e, amount, type, opt = {}) {
    if (e.dead) return 0;
    const d = this.d, p = this.player;
    let mult = d.dmgMul;
    if (type === 'phys' || type === 'mag') {
      const pen = Math.min(1, (type === 'phys' ? d.physPen : d.magPen) + (this.s.pierce || 0) / 100);
      const res = (type === 'phys' ? e.pres : e.mres) * (1 - pen);
      mult *= 1 - res / (res + 100);
    }
    if (opt.src === 'dot' || opt.src === 'reaction') mult *= d.statusDmgMul;
    if (e.st.mark > 0) mult *= 1.2;
    if (e.st.frozen > 0 && this.f.has('frozenVuln')) mult *= 1.5;
    if (this.b.race === 'orc') mult *= 1 + 0.35 * (1 - p.hp / d.maxHp);
    if (this.b.race === 'beast') mult *= 1 + p.momentum * 0.015;
    if (this.b.race === 'undead' && type === 'mag') mult *= 1.15;
    if (this.b.race === 'elf' && opt.proj) mult *= 1.2;
    const dmg = amount * mult;
    e.hp -= dmg;
    if (e.def.ai === 'dummy') { e.dmgLog.push([this.t, dmg]); e.lastHit = this.t; }
    else if (opt.src !== 'dot') this.aggro(e);

    if (opt.src === 'dot') { e.dotAcc += dmg; }
    else {
      e.hitFlash = 0.1;
      this.emit({ t: 'dmg', x: e.x, y: e.y - e.r - 10, v: dmg, crit: opt.crit, heavy: opt.heavy, src: opt.src, armored: (type === 'phys' ? e.pres : e.mres) >= 60, id: e.id, color: opt.color || (type === 'mag' ? '#c9a8ff' : '#ffffff') });
    }
    if (opt.src === 'attack' || opt.src === 'aoe') {
      let ls = this.s.lifesteal || 0;
      if (this.f.has('lowHpDrain') && p.hp < d.maxHp / 2) ls *= 2;
      if (ls > 0) this.heal((dmg * ls) / 100, 'steal');
    }
    if (opt.src === 'attack' && e.def.reflect) this.hurtPlayer(Math.min(dmg * e.def.reflect, d.maxHp * 0.08), 'phys', null, { direct: true });
    if (this.f.has('execute') && !e.def.elite && e.def.ai !== 'dummy' && e.hp > 0 && e.hp < e.maxHp * 0.15) {
      e.hp = 0; this.emit({ t: 'text', x: e.x, y: e.y - 16, text: '처형', color: '#ff5050' });
    }
    if (e.hp <= 0) this.killEnemy(e);
    return dmg;
  }

  aggro(e) {
    if (e.def.ai === 'dummy' || e.state === 'chase') return;
    e.state = 'chase'; e.leashT = 0;
    this.emit({ t: 'alert', id: e.id });
    for (const o of this.enemies) {
      if (o !== e && o.camp && o.camp === e.camp && o.state !== 'chase') { o.state = 'chase'; o.leashT = 0; }
    }
  }

  applyStatus(e, kind, stacks = 1) {
    if (!e || e.dead) return;
    const st = e.st;
    if (kind === 'burn') {
      st.burn = { n: Math.min(10, (st.burn?.n || 0) + stacks), t: 3 };
      if (this.f.has('burnExplode') && st.burn.n >= 5) {
        st.burn = null;
        const dmg = (10 + this.d.magAtk * 1.1) * (1 + (this.s.fireAff || 0) * 0.03);
        this.emit({ t: 'ring', x: e.x, y: e.y, r: 46, color: '#ffb030' });
        this.emit({ t: 'text', x: e.x, y: e.y - 18, text: '화염 폭발', color: '#ffb030' });
        for (const o of this.enemiesNear(e.x, e.y, 46)) this.damageEnemy(o, dmg, 'mag', { src: 'reaction', color: '#ffb030' });
        return;
      }
    } else if (kind === 'poison') {
      st.poison = { n: Math.min(this.d.poisonCap, (st.poison?.n || 0) + stacks), t: 5 };
    } else if (kind === 'bleed') {
      st.bleed = { n: Math.min(10, (st.bleed?.n || 0) + stacks), t: 4 };
    } else if (kind === 'chill') {
      if (e.def.elite && st.frozen > 0) return;
      const freezeAt = Math.max(2, 5 - this.d.freezeReduce) + (e.def.elite ? 3 : 0);
      const n = (st.chill?.n || 0) + stacks;
      if (n >= freezeAt) {
        st.chill = null; st.frozen = e.def.elite ? 0.6 : 1.3;
        this.emit({ t: 'text', x: e.x, y: e.y - 16, text: '빙결', color: '#9fe3ff' });
      } else st.chill = { n, t: 3 };
    }
    this.checkReactions(e);
  }

  checkReactions(e) {
    if (e.dead || e.reactCd > 0) return;
    const st = e.st, d = this.d, s = this.s;
    const cold = st.chill || st.frozen > 0;
    if (st.burn && cold) {
      const master = this.f.has('steamMaster');
      const r = master ? 62 : 44;
      const dmg = (12 + d.magAtk * 0.9 + (st.burn.n + (st.chill?.n || 2)) * 4) * d.reactionMul * (master ? 2 : 1) * (1 + ((s.fireAff || 0) + (s.iceAff || 0)) * 0.015);
      st.burn = null; st.chill = null;
      this.react(e, 'steam', '#e8f6ff', r);
      for (const o of this.enemiesNear(e.x, e.y, r)) this.damageEnemy(o, dmg, 'mag', { src: 'reaction', color: '#e8f6ff' });
    } else if (st.poison && st.burn) {
      st.burn = null;
      this.react(e, 'toxic', '#b6ff6a', 0);
      this.addCloud(e.x, e.y, 36 * (1 + d.cloudSize), (5 + (s.toxicity || 0) * 0.9 + d.magAtk * 0.25) * d.reactionMul, 3.5, 'p');
    } else if (st.bleed && cold) {
      const dmg = st.bleed.n * (5 + d.physAtk * 0.35) * d.reactionMul;
      st.bleed = null; st.chill = null; st.frozen = Math.max(st.frozen || 0, e.def.elite ? 0.6 : 1.4);
      this.react(e, 'bloodIce', '#ff8aa8', 0);
      this.damageEnemy(e, dmg, 'phys', { src: 'reaction', color: '#ff8aa8' });
    } else if (st.poison && st.bleed && !(st.septic > 0)) {
      st.septic = 3;
      this.react(e, 'septic', '#c8e04a', 0);
    }
  }

  react(e, id, color, r) {
    e.reactCd = 0.5;
    this.discovered.add(id);
    this.emit({ t: 'reaction', x: e.x, y: e.y - 20, text: REACTIONS[id].name, color, r });
    this.emit({ t: 'hitstop', v: 0.05 });
  }

  doAction(a, target, pos) {
    const d = this.d, s = this.s;
    if (a.status && target) this.applyStatus(target, a.status, a.stacks || 1);
    if (a.heal) this.heal(d.maxHp * a.heal, 'skill');
    if (a.aoe) {
      const base = (a.aoe.type === 'phys' ? d.physAtk : d.magAtk) * a.aoe.mul;
      this.emit({ t: 'ring', x: pos.x, y: pos.y, r: a.aoe.r, color: a.aoe.status ? STATUS_COLOR[a.aoe.status] : '#ffffff' });
      for (const o of this.enemiesNear(pos.x, pos.y, a.aoe.r)) {
        this.damageEnemy(o, base, a.aoe.type, { src: 'aoe' });
        if (a.aoe.status) this.applyStatus(o, a.aoe.status, 1);
      }
    }
    if (a.cloud) this.addCloud(pos.x, pos.y, a.cloud.r * (1 + d.cloudSize), 4 + (s.toxicity || 0) * 0.8 + d.magAtk * 0.2, a.cloud.dur, 'p');
    if (a.shards) {
      for (let i = 0; i < a.shards.n; i++) {
        const ang = this.rng.range(0, Math.PI * 2);
        this.projs.push({ owner: 'p', x: pos.x, y: pos.y, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200, life: 0.9, dmg: d.magAtk * a.shards.mul, type: a.shards.type, pierce: 0, hit: new Set(), color: '#8ad8ff', homing: true, noTrigger: true });
      }
    }
  }

  heal(amount, kind) {
    const p = this.player, d = this.d;
    if (amount <= 0 || this.state === 'dead' || this.f.has('noHeal')) return;
    if (this.b.race === 'undead' && kind !== 'drain' && !(kind === 'steal' && this.f.has('undeadLifesteal'))) amount *= 0.5;
    const room = d.maxHp - p.hp;
    if (amount <= room) p.hp += amount;
    else {
      p.hp = d.maxHp;
      if (this.f.has('overhealShield')) p.shield = Math.min(d.maxHp * 0.3, p.shield + (amount - room));
    }
  }

  hurtPlayer(amount, type, attacker, opt = {}) {
    const p = this.player, d = this.d, f = this.f;
    if (this.state !== 'play' || this.mode === 'plaza') return;
    if (!opt.direct) {
      if (p.invuln > 0) return;
      if (this.rng.chance(d.dodge)) {
        this.emit({ t: 'text', x: p.x, y: p.y - 14, text: '회피', color: '#bfe8d0' });
        p.invuln = 0.15;
        for (const tr of this.b.triggers.dodge) if (this.rng.chance(tr.chance)) this.doAction(tr.action, attacker, p);
        return;
      }
      if ((type === 'phys' && f.has('blockPhys')) || (type === 'mag' && f.has('blockMag'))) {
        if (this.rng.chance(0.15)) { this.emit({ t: 'text', x: p.x, y: p.y - 14, text: '막기', color: '#ffe080' }); p.invuln = 0.15; return; }
      }
    }
    const dr = type === 'phys' ? d.physDR : d.magDR;
    let dmg = amount * (1 - dr) * d.dmgTakenMul;
    if (p.shield > 0) { const a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a; }
    p.hp -= dmg; p.hitFlash = 0.15;
    if (!opt.direct) p.invuln = 0.3;
    this.emit({ t: 'dmg', x: p.x, y: p.y - 16, v: dmg, color: '#ff5a5a', who: 'p' });
    this.emit({ t: 'shake', v: Math.min(5, 1.5 + dmg / 12) });

    if (attacker && !opt.direct) {
      const refl = this.s.reflect || 0;
      if (refl > 0) {
        const rv = (amount * refl / 100) * d.reflectMul;
        const targets = f.has('reflectAoe') ? this.enemiesNear(p.x, p.y, 70) : [attacker];
        if (f.has('reflectAoe')) this.emit({ t: 'ring', x: p.x, y: p.y, r: 70, color: '#e6f3ff' });
        for (const o of targets) this.damageEnemy(o, rv, 'phys', { src: 'reflect', color: '#e6f3ff' });
      }
      if (f.has('slimeSlow')) this.applyStatus(attacker, 'chill', 1);
      for (const tr of this.b.triggers.hurt) if (this.rng.chance(tr.chance)) this.doAction(tr.action, attacker, attacker);
    }
    if (type === 'mag' && !opt.direct) for (const tr of this.b.triggers.hurtMag) if (this.rng.chance(tr.chance)) this.doAction(tr.action, attacker, p);
    if (opt.status) this.applyPlayerStatus(opt.status, amount);
    this.checkDeath();
  }

  damagePlayerDot(v) {
    const p = this.player;
    if (this.mode === 'plaza') return;
    if (p.shield > 0) { const a = Math.min(p.shield, v); p.shield -= a; v -= a; }
    p.hp -= v;
    this.checkDeath();
  }

  applyPlayerStatus(kind, power) {
    if (this.f.has('statusImmune') || this.mode === 'plaza') return;
    const dur = { burn: 3, poison: 4, bleed: 3, chill: 2 }[kind] * (1 - this.d.statusRes);
    if (dur <= 0.05) return;
    const dps = kind === 'chill' ? 0 : power * 0.18 * (1 - this.d.statusRes * 0.5);
    this.player.st[kind] = { t: dur, dps };
  }

  checkDeath() {
    const p = this.player;
    if (p.hp > 0 || this.state !== 'play') return;
    if (this.f.has('undying') && !p.undyingUsed) {
      p.undyingUsed = true; p.hp = this.d.maxHp * 0.3; p.invuln = 1;
      this.emit({ t: 'text', x: p.x, y: p.y - 18, text: '불사!', color: '#fff' });
      return;
    }
    if (this.f.has('lastStand') && p.lastStandCd <= 0) {
      p.lastStandCd = 60; p.hp = 1; p.invuln = 1;
      this.emit({ t: 'text', x: p.x, y: p.y - 18, text: '불굴!', color: '#ffd060' });
      return;
    }
    p.hp = 0; this.state = 'dead';
    this.emit({ t: 'death', x: p.x, y: p.y, color: '#ff4040', big: true });
  }

  // ───────────── 적 ─────────────
  makeEnemy(id, x, y) {
    const def = ALL_MONSTERS[id];
    return {
      id: this.nextId++, defId: id, def, x, y, r: def.r, hp: def.hp, maxHp: def.hp, atk: def.atk, pres: def.pres, mres: def.mres,
      st: {}, atkCd: 0.5 + this.rng.next(), shotCd: 1 + this.rng.next() * 1.5, kbx: 0, kby: 0, hitFlash: 0, dead: false,
      dotAcc: 0, dotT: 0.5, reactCd: 0, ai: { mode: 'move', t: 2 + this.rng.next() * 2, dx: 0, dy: 0 }, dir: 1, phase: this.rng.range(0, 6),
      state: 'idle', home: { x, y }, wander: null, wanderT: this.rng.range(0, 2), leashT: 0, moving: false, walkT: 0,
      dmgLog: [], lastHit: -9, wobble: 0, windT: 0, windMax: 0.4,
    };
  }

  spawnCamp(c) {
    c.members = [];
    for (let i = 0; i < c.n; i++) {
      let x, y, k = 0;
      do { x = c.x * TILE + 8 + this.rng.range(-28, 28); y = c.y * TILE + 8 + this.rng.range(-28, 28); k++; } while (this.blocked(x, y, 6) && k < 20);
      if (this.blocked(x, y, 6)) { x = c.x * TILE + 8; y = c.y * TILE + 8; }
      const e = this.makeEnemy(c.type, x, y);
      e.camp = c; e.home = { x: c.x * TILE + 8, y: c.y * TILE + 8 };
      c.members.push(e);
      this.enemies.push(e);
    }
  }

  updateCamps() {
    if (this.mode !== 'field') return;
    const p = this.player;
    for (const c of this.camps) {
      if (c.members.some((m) => !m.dead)) continue;
      if (c.respawnT <= 0) { c.respawnT = 45; continue; }
      c.respawnT -= DT;
      if (c.respawnT <= 0) {
        if (Math.hypot(c.x * TILE - p.x, c.y * TILE - p.y) > 360) this.spawnCamp(c);
        else c.respawnT = 3;
      }
    }
  }

  // 플레이어 위치에서 퍼지는 거리장 → 적이 벽을 돌아서 추격
  updateFlow() {
    if (this.mode !== 'field') return;
    this.flowT -= DT;
    if (this.flowT > 0) return;
    this.flowT = 0.2;
    const f = this.flow, tw = this.tw, th = this.th;
    f.fill(-1);
    const px = Math.floor(this.player.x / TILE), py = Math.floor(this.player.y / TILE);
    const q = [py * tw + px]; f[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % tw, y = (i / tw) | 0, dv = f[i];
      if (dv >= 28) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + N8[k][0], ny = y + N8[k][1];
        if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
        const j = ny * tw + nx, tt = this.tiles[j];
        if (f[j] >= 0 || tt === T_WALL || tt === T_CRACK || tt === T_BUILD) continue;
        f[j] = dv + 1; q.push(j);
      }
    }
  }

  chaseDir(e) {
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
  }

  updateEnemies() {
    const p = this.player, d = this.d, s = this.s;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const def = e.def;
      e.hitFlash = Math.max(0, e.hitFlash - DT);
      e.wobble = Math.max(0, e.wobble - DT);
      const dxp = p.x - e.x, dyp = p.y - e.y, dist = Math.hypot(dxp, dyp) || 1;

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
      if (st.burn) { burn = st.burn.n * (2 + d.magAtk * 0.12) * (1 + (s.fireAff || 0) * 0.04) * d.burnMul; if ((st.burn.t -= DT) <= 0) st.burn = null; }
      if (st.poison) { poison = st.poison.n * (1.5 + (s.toxicity || 0) * 0.6) * (st.septic > 0 ? 2 : 1); if ((st.poison.t -= DT) <= 0) st.poison = null; }
      if (st.bleed) { bleed = st.bleed.n * (1.5 + d.physAtk * 0.1) * d.bleedMul; if ((st.bleed.t -= DT) <= 0) st.bleed = null; }
      if (st.chill && (st.chill.t -= DT) <= 0) st.chill = null;
      for (const k of ['frozen', 'mark', 'septic']) if (st[k] > 0) st[k] -= DT;
      const dot = burn + poison + bleed;
      if (dot > 0) this.damageEnemy(e, dot * DT, 'true', { src: 'dot' });
      if (e.dead) continue;
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

      e.atkCd -= DT; e.shotCd -= DT;
      const frozen = st.frozen > 0;
      let slow = st.chill ? Math.min(0.6, st.chill.n * 0.12 * d.chillMul) : 0;
      if (this.zone && this.zone.liquid !== 'lava' && this.zone.liquid !== 'mist' && this.tileAt(e.x, e.y + 3) === T_LIQUID && def.shape !== 'flyer') slow = Math.max(slow, 0.3);
      let spd = frozen ? 0 : def.speed * (1 - slow);
      let vx = 0, vy = 0;

      // 상태 전환
      if (e.state === 'idle') {
        const aggroR = def.elite ? 130 : 105;
        if (dist < aggroR) this.aggro(e);
      }
      if (e.state === 'chase') {
        const fromHome = Math.hypot(e.x - e.home.x, e.y - e.home.y);
        e.leashT = dist > 260 ? e.leashT + DT : 0;
        if (fromHome > 420 || e.leashT > 3) { e.state = 'return'; }
      }

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
      } else {
        const [ux, uy] = this.chaseDir(e);
        if (def.ai === 'chase') { vx = ux; vy = uy; }
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
            if (def.ai === 'boss' && !frozen && e.shotCd <= 0 && dist < 220) { e.shotCd = 2.4; this.enemyShot(e, Math.atan2(dyp, dxp), def.proj.spread, 0.22); }
            if (ai.t <= 0 && dist < 180) { ai.mode = 'wind'; ai.t = 0.6; ai.dx = dxp / dist; ai.dy = dyp / dist; this.emit({ t: 'telegraph', id: e.id, x: e.x, y: e.y, dx: ai.dx, dy: ai.dy }); }
          } else if (ai.mode === 'wind') {
            spd = 0;
            if (ai.t <= 0) { ai.mode = 'dash'; ai.t = 0.45; }
          } else if (ai.mode === 'dash') {
            vx = ai.dx; vy = ai.dy; spd = frozen ? 0 : def.speed * 5;
            if (ai.t <= 0) { ai.mode = 'move'; ai.t = 3 + this.rng.next() * 2; }
          }
        }
      }
      if (e.windT > 0) spd *= 0.15;
      e.moving = (vx || vy) && spd > 0;
      if (e.moving) e.walkT += DT;
      if (Math.abs(vx) > 0.1) e.dir = vx > 0 ? 1 : -1;
      this.move(e, (vx * spd + e.kbx) * DT, (vy * spd + e.kby) * DT);
      e.kbx *= 0.85; e.kby *= 0.85;

      // 근접 공격: 예고(빨간 번쩍임) 후 타격 → 대시로 피할 수 있다
      if (e.windT > 0) {
        if (frozen) e.windT = 0;
        else {
          e.windT -= DT;
          if (e.windT <= 0) {
            e.atkCd = def.elite ? 1.3 : 1.1;
            const reach = e.r + p.r + (def.elite ? 14 : 9);
            this.emit({ t: 'strike', id: e.id, x: e.x, y: e.y, ang: Math.atan2(dyp, dxp), r: reach + 4 });
            if (Math.hypot(p.x - e.x, p.y - e.y) < reach) this.hurtPlayer(e.atk, def.type, e, { status: def.status });
          }
        }
      } else if (e.state === 'chase' && !frozen && dist < e.r + p.r + 6 && e.atkCd <= 0 && (def.ai !== 'charge' && def.ai !== 'boss' || e.ai.mode === 'move')) {
        e.windT = def.elite ? 0.5 : 0.38; e.windMax = e.windT;
        this.emit({ t: 'windup', id: e.id });
      }
      if (e.ai.mode === 'dash' && dist < e.r + p.r + 2 && e.atkCd <= 0) { e.atkCd = 1; this.hurtPlayer(e.atk * 1.2, def.type, e, { status: def.status }); }
    }
    // 겹침 방지 (가까운 적끼리만)
    const es = this.enemies.filter((e) => !e.dead && Math.abs(e.x - p.x) < 300 && Math.abs(e.y - p.y) < 220);
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 0.01, min = a.r + b.r;
      if (dd < min) {
        const push = (min - dd) / 2;
        if (a.def.ai !== 'dummy') this.move(a, -(dx / dd) * push, -(dy / dd) * push);
        if (b.def.ai !== 'dummy') this.move(b, (dx / dd) * push, (dy / dd) * push);
      }
    }
  }

  enemyShot(e, ang, n, spread) {
    const pr = e.def.proj;
    for (let i = 0; i < n; i++) {
      const a = ang + (i - (n - 1) / 2) * spread;
      this.projs.push({ owner: 'e', src: e, x: e.x, y: e.y, vx: Math.cos(a) * pr.speed, vy: Math.sin(a) * pr.speed, life: 3, dmg: e.atk, type: e.def.type, status: pr.status, color: pr.color });
    }
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    const def = e.def, st = e.st, d = this.d;
    this.loot.xp += def.xp;
    this.loot.kills[e.defId] = (this.loot.kills[e.defId] || 0) + 1;
    this.emit({ t: 'death', x: e.x, y: e.y, color: def.pal.a, big: def.elite, defId: e.defId, dir: e.dir });
    if (def.elite) { this.emit({ t: 'hitstop', v: 0.25 }); this.emit({ t: 'banner', text: `${def.name} 처치!`, color: '#ffcf5a' }); }
    const gold = Math.round(def.gold * d.goldMul);
    if (gold > 0) this.spawnDrop(e.x, e.y, 'gold', null, gold);
    if (this.rng.chance(def.echo.rate)) this.spawnDrop(e.x, e.y, 'echo', def.echo.id);
    if (def.condEcho && def.condEcho.when === 'burning' && st.burn && this.rng.chance(def.condEcho.rate)) this.spawnDrop(e.x, e.y, 'echo', def.condEcho.id);
    if (def.onDeath?.cloud) { const c = def.onDeath.cloud; this.addCloud(e.x, e.y, c.r, c.dps, c.dur, 'e'); }

    for (const tr of this.b.triggers.kill) if (this.rng.chance(tr.chance)) this.doAction(tr.action, null, e);
    if (st.poison && this.f.has('poisonSpread')) for (const o of this.enemiesNear(e.x, e.y, 60)) this.applyStatus(o, 'poison', Math.ceil(st.poison.n / 2));
    if (st.burn && this.f.has('burnSpread')) for (const o of this.enemiesNear(e.x, e.y, 60)) this.applyStatus(o, 'burn', 2);
    if (st.poison && this.f.has('poisonBurst')) this.addCloud(e.x, e.y, 34 * (1 + d.cloudSize), 4 + (this.s.toxicity || 0) * 0.8, 3, 'p');
    if (this.b.race === 'undead') this.heal(d.maxHp * 0.06, 'drain');
  }

  spawnDrop(x, y, kind, id, amount = 1) {
    const a = this.rng.range(0, Math.PI * 2), s = this.rng.range(40, 90);
    this.drops.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, kind, id, amount, t: 0 });
  }

  updateDrops() {
    const p = this.player;
    for (const dr of this.drops) {
      dr.t += DT;
      const dx = p.x - dr.x, dy = p.y - dr.y, dist = Math.hypot(dx, dy) || 1;
      if (dr.t > 0.45 && dist < 80) {
        const pull = 260 + (80 - dist) * 6;
        dr.vx += (dx / dist) * pull * DT * 4; dr.vy += (dy / dist) * pull * DT * 4;
      }
      dr.vx *= 0.9; dr.vy *= 0.9;
      dr.x += dr.vx * DT; dr.y += dr.vy * DT;
      if (dr.t > 0.45 && dist < 9) {
        dr.taken = true;
        if (dr.kind === 'gold') { this.loot.gold += dr.amount; this.emit({ t: 'pickup', kind: 'gold', x: p.x, y: p.y }); }
        else {
          this.loot.echoes[dr.id] = (this.loot.echoes[dr.id] || 0) + 1;
          this.emit({ t: 'echo', id: dr.id, x: p.x, y: p.y });
        }
      }
    }
    this.drops = this.drops.filter((d) => !d.taken);
  }

  enemiesNear(x, y, r) {
    return this.enemies.filter((o) => !o.dead && Math.hypot(o.x - x, o.y - y) <= r + o.r);
  }

  // ───────────── 투사체 / 구름 ─────────────
  updateProjs() {
    const p = this.player;
    for (const pr of this.projs) {
      if (pr.homing) {
        let best = null, bd = 160;
        for (const e of this.enemies) { if (e.dead || pr.hit.has(e.id)) continue; const dd = Math.hypot(e.x - pr.x, e.y - pr.y); if (dd < bd) { bd = dd; best = e; } }
        if (best) {
          const a = Math.atan2(best.y - pr.y, best.x - pr.x), sp = Math.hypot(pr.vx, pr.vy);
          pr.vx += (Math.cos(a) * sp - pr.vx) * 0.12; pr.vy += (Math.sin(a) * sp - pr.vy) * 0.12;
        }
      }
      pr.x += pr.vx * DT; pr.y += pr.vy * DT; pr.life -= DT;
      if (this.solid(pr.x, pr.y)) {
        if (pr.owner === 'p' && this.tileAt(pr.x, pr.y) === T_CRACK) this.hitCrack(pr.x, pr.y, pr.dmg);
        this.emit({ t: 'spark', x: pr.x - pr.vx * DT, y: pr.y - pr.vy * DT, color: pr.color });
        pr.life = 0;
      }
      if (pr.life <= 0) continue;
      if (pr.owner === 'p') {
        for (const e of this.enemies) {
          if (e.dead || pr.hit.has(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) > e.r + 3) continue;
          pr.hit.add(e.id);
          if (pr.noTrigger) this.damageEnemy(e, pr.dmg, pr.type, { src: 'aoe' });
          else this.hitEnemy(e, pr.dmg, pr.type, pr.heavy, true);
          if (pr.splash) { this.emit({ t: 'ring', x: pr.x, y: pr.y, r: pr.splash, color: pr.color }); for (const o of this.enemiesNear(pr.x, pr.y, pr.splash)) if (o !== e) this.damageEnemy(o, pr.dmg * 0.7, pr.type, { src: 'aoe' }); }
          if (pr.type === 'mag' && this.f.has('magicBurst') && !pr.noTrigger) this.doAction({ aoe: { r: 24, mul: 0.35, type: 'mag' } }, null, pr);
          if (pr.pierce-- <= 0) { pr.life = 0; break; }
        }
      } else if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + 3) {
        pr.life = 0;
        this.hurtPlayer(pr.dmg, pr.type, pr.src && !pr.src.dead ? pr.src : null, { status: pr.status });
      }
    }
    this.projs = this.projs.filter((pr) => pr.life > 0);
  }

  addCloud(x, y, r, dps, dur, owner) {
    this.clouds.push({ x, y, r, dps, t: dur, max: dur, owner, tick: 0 });
  }

  updateClouds() {
    const p = this.player;
    for (const c of this.clouds) {
      c.t -= DT; c.tick -= DT;
      if (c.tick > 0) continue;
      c.tick = 0.5;
      if (c.owner === 'p') {
        for (const e of this.enemiesNear(c.x, c.y, c.r)) { this.damageEnemy(e, c.dps * 0.5, 'true', { src: 'dot' }); this.applyStatus(e, 'poison', 1); }
      } else if (Math.hypot(p.x - c.x, p.y - c.y) < c.r + p.r) {
        this.damagePlayerDot(c.dps * 0.5 * (1 - this.d.magDR));
        this.applyPlayerStatus('poison', c.dps);
      }
    }
    this.clouds = this.clouds.filter((c) => c.t > 0);
  }
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export { ECHOES, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD };

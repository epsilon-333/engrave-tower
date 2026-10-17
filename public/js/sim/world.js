// 전투·탐험 시뮬레이션. 고정 틱(60Hz) + 시드 난수 + 입력만으로 진행 → 서버 권한 방식으로 옮기기 쉽다.
// 렌더러는 world 상태와 world.events 만 읽고, main 은 world.signals 로 화면 전환을 한다.
import { MONSTERS, ZONES, DUMMIES, ECHOES, LORES, AFFIXES } from '../data/monsters.js';
import { REACTIONS } from '../data/engravings.js';
import { WEAPON_SKILLS } from '../data/items.js';
import { SKILLS, ELEM, ELEM_CYCLE, ZONE_ELEM } from '../data/skills.js';
import { RACES } from '../data/races.js';
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
  constructor({ build, mode, zoneId, seed, map, memory, depth = 0 }) {
    this.depth = depth;
    this.mode = mode;
    this.setBuild(build);
    this.zone = zoneId ? ZONES.find((z) => z.id === zoneId) : null;
    this.rng = createRng(seed);
    this.map = map || generateField(this.zone, seed, depth);
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
      mana: this.d.maxMana, lastCast: -9, aura: 0, auraT: 0, rage: 0, rageT: 0, lastFight: -9,
      dashCharges: 1, dashRecharge: 0, dashCritReady: false, lastShot: -9, whirlT: 0, whirlTick: 0,
      res: RACES[this.b.race]?.res?.start || 0, elem: 'fire', elemBonusT: 0, buffs: {}, cds: {}, parryT: 0, parry: null,
      castT: 0, castMax: 0, castSkill: null, channel: null,
    };
    this.allies = []; this.zones = [];
    this.zElem = this.zone ? ZONE_ELEM[this.zone.id] : null;
    this.delayed = [];
    this.state = 'play'; // play | dead | done
    this.loot = { echoes: {}, gold: 0, xp: 0, kills: {}, chests: 0, lores: [], banked: null };
    this.regionSeen = new Set(); this.milestones = new Set(); this.regionCur = -1; this.regionT = 0; this.mileT = 0;
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
      // 구역 우두머리: 구역 몬스터의 강화판, 다시 생기지 않음
      for (const c of m.champions || []) {
        const e = this.makeEnemy(c.type, c.x * TILE + 8, c.y * TILE + 8, { champion: m.regionInfo[c.region].name });
        e.home = { x: e.x, y: e.y };
        this.enemies.push(e);
      }
      for (const g of m.goblins || []) {
        const e = this.makeEnemy('treasureGoblin', g.x * TILE + 8, g.y * TILE + 8, { noAffix: true });
        e.home = { x: e.x, y: e.y };
        this.enemies.push(e);
      }
      this.objects.push({ kind: 'portal', x: sx, y: sy - 14, label: '귀환 포탈 (잔향 전부 보존)', color: this.zone.portal });
      for (const c of m.chests) this.objects.push({ kind: 'chest', x: c.x * TILE + 8, y: c.y * TILE + 8, rich: c.rich, trap: c.trap, label: c.rich ? '숨겨진 보물 상자' : '보물 상자' });
      for (const c of m.camp || []) this.objects.push({ kind: 'camp', x: c.x * TILE + 8, y: c.y * TILE + 8, label: '야영지 · 잔향 맡기고 쉬기', reusable: true });
      for (const c of m.merchant || []) this.objects.push({ kind: 'merchant', x: c.x * TILE + 8, y: c.y * TILE + 8, label: '떠돌이 상인', reusable: true, npc: { name: '떠돌이 상인 오반' } });
      for (const c of m.shrines || []) this.objects.push({ kind: 'shrine', x: c.x * TILE + 8, y: c.y * TILE + 8, label: '낡은 제단 · 축복 받기' });
      if (m.stairs) this.objects.push({ kind: 'stairs', x: m.stairs.x * TILE + 8, y: m.stairs.y * TILE + 8, label: `아래층으로 (지하 ${depth + 2}층)`, reusable: true });
      for (const l of m.lores) this.objects.push({ kind: 'lore', x: l.x * TILE + 8, y: l.y * TILE + 8, label: '고대 석판 읽기' });
      if (memory) this.applyMemory(memory);
      this.reveal(true);
    } else {
      for (const o of m.objects) this.objects.push({ ...o });
      for (const dm of m.dummies) { const e = this.makeEnemy(dm.id, dm.x, dm.y); e.home = { x: dm.x, y: dm.y }; this.enemies.push(e); }
    }
  }

  // 층 기억: 탐험한 타일(비트), 열어 본 상자·석판(오브젝트 순번), 부순 균열 벽(타일 번호)
  exportMemory() {
    const bits = new Uint8Array(Math.ceil(this.explored.length / 8));
    for (let i = 0; i < this.explored.length; i++) if (this.explored[i]) bits[i >> 3] |= 1 << (i & 7);
    let bin = '';
    for (const b of bits) bin += String.fromCharCode(b);
    return {
      v: 1, tw: this.tw, th: this.th, explored: btoa(bin),
      opened: this.objects.map((o, i) => (o.opened ? i : -1)).filter((i) => i >= 0),
      broken: [...(this.broken || [])],
      regions: [...this.regionSeen], milestones: [...this.milestones],
    };
  }

  applyMemory(m) {
    if (!m || m.tw !== this.tw || m.th !== this.th) return;
    try {
      const bin = atob(m.explored || '');
      for (let i = 0; i < this.explored.length; i++) if (bin.charCodeAt(i >> 3) & (1 << (i & 7))) this.explored[i] = 1;
    } catch { /* 손상된 기록은 무시 */ }
    for (const i of m.opened || []) if (this.objects[i] && this.objects[i].kind !== 'portal') this.objects[i].opened = true;
    this.broken = new Set(m.broken || []);
    this.regionSeen = new Set(m.regions || []);
    this.milestones = new Set(m.milestones || []);
    for (const i of this.broken) if (this.tiles[i] === T_CRACK) this.tiles[i] = T_FLOOR;
  }

  setBuild(build) {
    this.b = build; this.d = build.derived; this.f = build.flags; this.s = build.stats;
    if (this.player) this.player.hp = Math.min(this.player.hp, this.d.maxHp);
    if (this.player && this.mode === 'plaza') this.player.hp = this.d.maxHp;
    if (this.player) this.player.mana = Math.min(this.player.mana ?? this.d.maxMana, this.d.maxMana);
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
    this.updateDelayed();
    this.updateAllies();
    this.updateZones();
    this.updateFlow();
    this.updateEnemies();
    this.updateProjs();
    this.updateClouds();
    this.updateDrops();
    this.updateCamps();
    this.updateExplore();
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.mode === 'field' && Math.floor(this.t * 60) % 6 === 0) this.reveal();
  }

  updateExplore() {
    if (this.mode !== 'field') return;
    const p = this.player, m = this.map;
    this.regionT -= DT;
    if (this.regionT <= 0 && m.regions) {
      this.regionT = 0.25;
      const r = m.regions[Math.floor(p.y / TILE) * this.tw + Math.floor(p.x / TILE)];
      if (r >= 0 && r !== this.regionCur) {
        this.regionCur = r;
        const info = m.regionInfo[r];
        const first = !this.regionSeen.has(r) && this.depth === 0;
        if (first) { this.regionSeen.add(r); this.loot.xp += 15 * this.zone.floor; }
        this.emit({ t: 'region', name: info.name, first, xp: first ? 15 * this.zone.floor : 0 });
      }
    }
    this.mileT -= DT;
    if (this.mileT <= 0) {
      this.mileT = 1;
      const pct = this.exploredPct();
      for (const ms of [50, 80, 100]) {
        if (pct * 100 >= ms - 0.5 && !this.milestones.has(ms) && this.depth === 0) {
          this.milestones.add(ms);
          const gold = ms * this.zone.floor;
          for (let i = 0; i < 4; i++) this.spawnDrop(p.x, p.y, 'gold', null, Math.ceil(gold / 4));
          const ids = this.zone.pool.map((id) => MONSTERS[id].echo.id);
          for (let i = 0; i < (ms === 100 ? 4 : 2); i++) this.spawnDrop(p.x, p.y, 'echo', this.rng.pick(ids));
          this.emit({ t: 'banner', text: `탐험 ${ms}% 달성!`, color: '#8fd0ff' });
        }
      }
    }
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
    // 마나: 3초 동안 마법을 안 쓰면 회복 2배
    p.mana = Math.min(d.maxMana, p.mana + d.manaRegen * (this.t - p.lastCast > 3 ? 2 : 1) * DT);
    // 종족 자원: 시간 회복, 전투 밖 감소
    const R = this.raceRes;
    if (R) {
      if (R.regen) this.addRes(R.regen * (this.b.race === 'wizard' ? 1 + (this.s.spi || 0) / 60 : 1) * DT, true);
      if (R.decay && this.t - p.lastFight > 3) p.res = Math.max(0, p.res - R.decay * DT);
    }
    // 버프·시전·받아치기
    for (const [k, bf] of Object.entries(p.buffs)) { bf.t -= DT; if (bf.t <= 0) delete p.buffs[k]; }
    if (p.elemBonusT > 0) p.elemBonusT -= DT;
    if (p.parryT > 0) p.parryT -= DT;
    for (const k of Object.keys(p.cds)) { p.cds[k] -= DT; if (p.cds[k] <= 0) delete p.cds[k]; }
    if (p.dashCharges < 1) {
      p.dashRecharge -= DT;
      if (p.dashRecharge <= 0) { p.dashCharges++; p.dashRecharge = d.dashCd * (1 - d.cdr); }
    }
    if (this.mode === 'plaza') p.hp = d.maxHp;


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
    this.aimDist = al;
    if (Math.abs(p.aimX) > 0.1) p.dir = p.aimX > 0 ? 1 : -1;

    let mx = inp.moveX, my = inp.moveY; const ml = Math.hypot(mx, my);
    if (ml > 0) { mx /= ml; my /= ml; }
    p.moving = ml > 0;
    if (p.moving) p.walkT += DT;
    if (p.dashT > 0) {
      p.dashT -= DT;
      this.move(p, p.dvx * DT, p.dvy * DT);
    } else {
      const aiming = this.f.has('aimSlow') && (inp.attack || p.atkCd > 0.05);
      const spd = p.castT > 0 ? 0 : d.moveSpeed * this.mod('moveSpeed') * (1 - slow) * (aiming ? d.aimSlow : 1) * (p.channel ? 0.5 : 1);
      this.move(p, mx * spd * DT, my * spd * DT);
      if (inp.dash && p.dashCharges > 0 && p.dashCd <= 0) {
        const dx = ml > 0 ? mx : p.aimX, dy = ml > 0 ? my : p.aimY;
        p.dashT = 0.16; p.dvx = dx * 400; p.dvy = dy * 400; p.invuln = Math.max(p.invuln, 0.22);
        p.dashCharges--; if (p.dashRecharge <= 0) p.dashRecharge = d.dashCd * (1 - d.cdr);
        if (p.castT > 0) { p.castT = 0; p.castSkill = null; this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '시전 취소', color: '#a8b0c0' }); }
        if (this.raceRes?.dash) this.addRes(this.raceRes.dash);
        p.dashCd = 0.25;
        if (f.has('dashCrit')) p.dashCritReady = true;
        this.emit({ t: 'dash', x: p.x, y: p.y, dx, dy });
        if (f.has('dashAfterimage')) this.afterimage(p.x, p.y, p.x + dx * 64, p.y + dy * 64);
        for (const tr of this.b.triggers.dash) if (this.rng.chance(tr.chance)) this.doAction(tr.action, null, p);
      }
    }

    p.attackHeld = !!inp.attack;
    if (p.pendingDouble >= 0) { p.pendingDouble -= DT; if (p.pendingDouble < 0) this.attack(0.12); }
    if (inp.attack && p.atkCd <= 0 && p.castT <= 0 && !p.channel) {
      const mom = this.mod('atkSpeed');
      p.atkCd = 1 / (this.b.weapon.speed * d.atkSpeed * mom);
      p.atkPeriod = p.atkCd;
      this.attack(0);
      if (f.has('doubleAttack') && this.rng.chance(0.3)) p.pendingDouble = 0.08;
    }

    const slots = this.b.skills || [];
    for (let i = 0; i < 3; i++) if (inp['s' + (i + 1)] && slots[i]) this.castSkillId(slots[i]);
    if (inp.skill && slots[0]) this.castSkillId(slots[0]);
    if (p.whirlT > 0) this.tickWhirl();
    if (p.castT > 0) {
      p.castT -= DT;
      if (p.castT <= 0 && p.castSkill) { const cs = p.castSkill; p.castSkill = null; this.execSkill(cs.def, cs.spent); }
    }
    if (p.channel) this.tickChannel();

    // 상호작용 대상
    this.near = null;
    let bd = 26;
    for (const o of this.objects) {
      if (o.opened && !o.reusable) continue;
      const dd = Math.hypot(o.x - p.x, o.y - p.y);
      if (dd < bd) { bd = dd; this.near = o; }
    }
    if (inp.interact && this.near) this.interact(this.near);
  }

  interact(o) {
    if (o.kind === 'portal') { this.state = 'done'; return; }
    if (o.kind === 'gate') { this.signals.push({ t: 'enterZone', zone: o.zone }); return; }
    if (o.kind === 'station') { this.signals.push({ t: 'openPanel', panel: o.panel }); return; }
    if (o.kind === 'camp') {
      // 야영지: 지금까지 모은 잔향과 골드를 맡긴다 (죽어도 잃지 않음) + 처음 한 번 체력 회복
      this.loot.banked = { echoes: { ...this.loot.echoes }, gold: this.loot.gold };
      if (!o.rested) { o.rested = true; this.player.hp = this.d.maxHp; this.player.mana = this.d.maxMana; }
      this.emit({ t: 'camp', x: o.x, y: o.y });
      this.emit({ t: 'text', x: o.x, y: o.y - 20, text: '잔향을 맡겼다', color: '#ffd88a' });
      return;
    }
    if (o.kind === 'merchant') { this.signals.push({ t: 'merchant', zone: this.zone.id, depth: this.depth }); return; }
    if (o.kind === 'stairs') { this.signals.push({ t: 'descend' }); return; }
    if (o.kind === 'shrine') {
      o.opened = true;
      const opts = [
        { name: '힘의 축복', good: '모든 피해 +25%', bad: '최대 HP -15%', apply: (d) => { d.dmgMul *= 1.25; d.maxHp = Math.round(d.maxHp * 0.85); } },
        { name: '강철의 축복', good: '받는 피해 -25%', bad: '이동 속도 -15%', apply: (d) => { d.dmgTakenMul *= 0.75; d.moveSpeed *= 0.85; } },
        { name: '바람의 축복', good: '이동·공격 속도 +20%', bad: '받는 피해 +15%', apply: (d) => { d.moveSpeed *= 1.2; d.atkSpeed *= 1.2; d.dmgTakenMul *= 1.15; } },
        { name: '피의 축복', good: '흡혈 +8%', bad: '자연 회복 없음', apply: (d, s) => { s.lifesteal = (s.lifesteal || 0) + 8; d.regen = 0; } },
        { name: '지혜의 축복', good: '스킬 쿨타임 -30%, 마나 회복 2배', bad: '최대 HP -10%', apply: (d) => { d.skillCdMul *= 0.7; d.manaRegen *= 2; d.maxHp = Math.round(d.maxHp * 0.9); } },
      ];
      const pick = opts[this.rng.int(0, opts.length - 1)];
      pick.apply(this.d, this.s);
      this.player.hp = Math.min(this.player.hp, this.d.maxHp);
      this.blessing = pick;
      this.emit({ t: 'banner', text: pick.name, sub: `${pick.good} · 대가: ${pick.bad}`, color: '#c9a8ff' });
      this.emit({ t: 'ring', x: o.x, y: o.y, r: 40, color: '#c9a8ff' });
      return;
    }
    if (o.kind === 'chest') {
      o.opened = true;
      this.loot.chests++;
      this.emit({ t: 'chest', x: o.x, y: o.y, rich: o.rich });
      if (o.trap) {
        // 함정 상자: 몬스터가 몰려온다. 대신 보상이 더 크다
        const r = this.map.regions?.[Math.floor(o.y / TILE) * this.tw + Math.floor(o.x / TILE)] ?? 0;
        const types = this.map.regionInfo?.[r]?.types || this.zone.pool;
        this.emit({ t: 'banner', text: '함정이다!', color: '#ff6060' });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          let x = o.x + Math.cos(a) * 46, y = o.y + Math.sin(a) * 46;
          if (this.blocked(x, y, 6)) { x = o.x; y = o.y; }
          const e = this.makeEnemy(this.rng.pick(types), x, y, { noAffix: true });
          e.state = 'chase'; e.home = { x: o.x, y: o.y };
          this.enemies.push(e);
          this.emit({ t: 'death', x, y, color: '#ff6060', big: false });
        }
      }
      const ids = [...this.zone.pool.map((m) => MONSTERS[m].echo.id)];
      const n = (o.rich ? this.rng.int(5, 7) : this.rng.int(2, 3)) + (o.trap ? 3 : 0);
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

  // 마법 무기: 마나가 모자라면 지팡이로 약하게 때린다 (피의 마법이면 체력으로 대신)
  payMana(cost) {
    const p = this.player;
    if (!cost || this.b.race !== 'wizard') return true;
    if (p.res >= cost) { p.res -= cost; p.lastCast = this.t; return true; }
    if (this.f.has('bloodMagic') && p.hp > this.d.maxHp * 0.2) { p.hp -= cost * 0.8; p.lastCast = this.t; return true; }
    return false;
  }

  attack(angOff) {
    const p = this.player, d = this.d, w = this.b.weapon;
    let type = w.dmg;
    if (type === 'phys' && this.f.has('physToMag')) type = 'mag';
    const ang = Math.atan2(p.aimY, p.aimX) + angOff;
    if (w.kind === 'proj' && w.mana && !this.payMana(w.mana)) {
      // 마나 부족: 지팡이 휘두르기
      p.atkCount++;
      p.swingDir = p.atkCount % 2 ? 1 : -1; p.swingMax = 0.16; p.swingT = 0.16; p.swingAng = ang;
      this.emit({ t: 'swing', x: p.x, y: p.y, ang, range: 22, arc: 1.4, heavy: false, type: 'phys', dir: p.swingDir, dur: 0.16 });
      this.emit({ t: 'noMana', x: p.x, y: p.y });
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
        if (dist > 22 + e.r) continue;
        let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) <= 0.7 || dist < e.r + 6) this.hitEnemy(e, d.physAtk * 0.5, 'phys', false);
      }
      return;
    }
    const atk = type === 'phys' ? (w.scale === 'agi' ? d.dexAtk : d.physAtk) : d.magAtk;
    p.atkCount++;
    let mul = w.mul, heavy = false;
    if (this.f.has('heavyHit') && p.atkCount % 4 === 0) { mul *= 2; heavy = true; }
    if (w.charge) { mul *= 1 + 0.6 * Math.min(1, (this.t - p.lastShot) / 1.6); }
    p.lastShot = this.t;
    const base = atk * mul;
    if (w.kind === 'melee') {
      p.swingDir = p.atkCount % 2 ? 1 : -1;
      p.swingMax = Math.min(0.2, 0.6 / (w.speed * d.atkSpeed)); p.swingT = p.swingMax; p.swingAng = ang;
      const thrust = w.shape === 'thrust';
      this.emit({ t: 'swing', x: p.x, y: p.y, ang, range: w.range, arc: thrust ? 0.3 : w.arc, heavy, type, dir: p.swingDir, dur: p.swingMax, thrust, aura: p.auraT > 0 });
      const hits = w.hits || 1;
      for (const e of this.enemies) {
        if (e.dead || e.hidden) continue;
        const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
        if (dist > w.range + e.r) continue;
        let ok;
        if (thrust) ok = distToSeg(e.x, e.y, p.x, p.y, p.x + Math.cos(ang) * w.range, p.y + Math.sin(ang) * w.range) < e.r + (w.width || 8);
        else {
          let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
          ok = Math.abs(da) <= w.arc / 2 || dist < e.r + 6;
        }
        if (!ok) continue;
        for (let h = 0; h < hits; h++) this.hitEnemy(e, base, type, heavy, false, { weapon: true });
      }
      const hx = p.x + Math.cos(ang) * 14, hy = p.y + Math.sin(ang) * 14;
      if (this.tileAt(hx, hy) === T_CRACK) this.hitCrack(hx, hy, base);
    } else {
      const n = w.count || 1;
      for (let i = 0; i < n; i++) {
        const a = ang + (i - (n - 1) / 2) * (w.spread || 0);
        const sp = w.projSpeed * d.projMul;
        this.projs.push({
          owner: 'p', x: p.x + Math.cos(a) * 6, y: p.y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: (w.range * d.projMul) / sp, maxLife: (w.range * d.projMul) / sp, dmg: base, type, pierce: w.boomerang ? 99 : w.pierce || 0, hit: new Set(), heavy, splash: w.splash || 0,
          color: type === 'mag' ? '#b58cff' : '#e8e2cf', kind: w.boomerang ? 'axe' : type === 'phys' ? 'arrow' : 'orb', ox: p.x, oy: p.y,
          boomerang: !!w.boomerang, weaponHit: true,
        });
      }
      p.swingT = 0.1; p.swingMax = 0.1; p.swingAng = ang;
      this.emit({ t: 'shoot', type, x: p.x, y: p.y });
    }
  }

  // 무기 스킬 (Q / 우클릭). 적중 시 각인 트리거가 그대로 발동한다
  useSkill() {
    const p = this.player, d = this.d, w = this.b.weapon;
    const sk = WEAPON_SKILLS[w.skill] || WEAPON_SKILLS.spin;
    if (sk.mana && !this.payMana(sk.mana)) { this.emit({ t: 'noMana', x: p.x, y: p.y }); p.skillCd = 0.3; return; }
    p.skillMax = sk.cd * d.skillCdMul * (1 - d.cdr); p.skillCd = p.skillMax;
    let type = w.dmg;
    if (type === 'phys' && this.f.has('physToMag')) type = 'mag';
    const atk = type === 'phys' ? (w.scale === 'agi' ? d.dexAtk : d.physAtk) : d.magAtk;
    const ang = Math.atan2(p.aimY, p.aimX);
    const aimX = p.x + p.aimX * Math.min(160, this.aimDist || 120), aimY = p.y + p.aimY * Math.min(160, this.aimDist || 120);
    const hitAll = (list, mul, dtype = type) => { for (const e of list) this.hitEnemy(e, atk * w.mul * mul, dtype, true); };
    this.emit({ t: 'skill', id: w.skill, x: p.x, y: p.y, ang, tx: aimX, ty: aimY });
    switch (w.skill) {
      case 'slam': {
        const cx = p.x + Math.cos(ang) * 26, cy = p.y + Math.sin(ang) * 26;
        this.emit({ t: 'slam', x: cx, y: cy, r: 58 });
        this.emit({ t: 'hitstop', v: 0.1 });
        for (const e of this.enemiesNear(cx, cy, 58)) { this.hitEnemy(e, atk * w.mul * 2.2, type, true); if (!e.def.elite) { e.windT = 0; e.atkCd = Math.max(e.atkCd, 1.2); } }
        break;
      }
      case 'dashStab': {
        const len = 90, ex = p.x + Math.cos(ang) * len, ey = p.y + Math.sin(ang) * len;
        p.dashT = 0.2; p.dvx = Math.cos(ang) * len / 0.2; p.dvy = Math.sin(ang) * len / 0.2; p.invuln = Math.max(p.invuln, 0.3);
        this.emit({ t: 'afterimage', x1: p.x, y1: p.y, x2: ex, y2: ey });
        for (const e of this.enemies) if (!e.dead && distToSeg(e.x, e.y, p.x, p.y, ex, ey) < e.r + 12) this.hitEnemy(e, atk * w.mul * 1.9, type, true);
        if (this.f.has('dashCrit')) p.dashCritReady = true;
        break;
      }
      case 'whirl': p.whirlT = 1.2; p.whirlTick = 0; break;
      case 'volley': {
        const sp = w.projSpeed * d.projMul * 1.3;
        for (let i = -2; i <= 2; i++) {
          const a = ang + i * 0.14;
          this.projs.push({ owner: 'p', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (w.range * 1.4 * d.projMul) / sp, dmg: atk * w.mul * 1.1, type, pierce: 3, hit: new Set(), color: '#ffe8a0', kind: 'arrow', ox: p.x, oy: p.y, weaponHit: true });
        }
        break;
      }
      case 'rain': {
        for (let i = 0; i < 6; i++) this.delayed.push({ t: 0.25 + i * 0.22, kind: 'aoe', x: aimX, y: aimY, r: 50, dmg: atk * w.mul * 0.75, type, fx: 'rain' });
        break;
      }
      case 'axeStorm': {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2, sp = 200;
          this.projs.push({ owner: 'p', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9, maxLife: 0.9, dmg: atk * w.mul * 0.85, type, pierce: 99, hit: new Set(), color: '#e8e2cf', kind: 'axe', boomerang: true, ox: p.x, oy: p.y });
        }
        break;
      }
      case 'frostRing': {
        this.emit({ t: 'nova', x: p.x, y: p.y, r: 72, color: '#9fe3ff' });
        for (const e of this.enemiesNear(p.x, p.y, 72)) { this.hitEnemy(e, atk * w.mul * 0.9, 'mag', true); this.applyStatus(e, 'chill', 3); }
        break;
      }
      case 'poisonPool': {
        this.emit({ t: 'ring', x: aimX, y: aimY, r: 50, color: '#9be15d' });
        this.addCloud(aimX, aimY, 50 * (1 + d.cloudSize), (6 + (this.s.toxicity || 0) * 1.2 + d.magAtk * 0.45) * 1.4, 5, 'p');
        for (const e of this.enemiesNear(aimX, aimY, 50)) this.applyStatus(e, 'poison', 3);
        break;
      }
      case 'meteor': {
        this.emit({ t: 'telegraphCircle', x: aimX, y: aimY, r: 60, dur: 0.7 });
        this.delayed.push({ t: 0.7, kind: 'aoe', x: aimX, y: aimY, r: 60, dmg: atk * w.mul * 3.2, type: 'mag', fx: 'meteor', big: true });
        break;
      }
      case 'nova': {
        this.emit({ t: 'nova', x: p.x, y: p.y, r: 66 });
        this.emit({ t: 'hitstop', v: 0.05 });
        hitAll(this.enemiesNear(p.x, p.y, 66), 1.9, 'mag');
        break;
      }
      default: { // spin
        const r = w.range * 1.5 + 8;
        p.spinT = 0.3;
        this.emit({ t: 'spin', x: p.x, y: p.y, r, type });
        this.emit({ t: 'hitstop', v: 0.04 });
        hitAll(this.enemiesNear(p.x, p.y, r), 1.6);
      }
    }
  }

  // ═══════ 종족 자원 / 버프 ═══════
  get raceRes() { return RACES[this.b.race]?.res; }
  addRes(n, passive = false) {
    const p = this.player;
    p.res = Math.max(0, Math.min(100, p.res + n));
    if (!passive && n > 0) p.lastFight = this.t;
  }
  mod(key) {
    const p = this.player;
    let m = 1;
    for (const bf of Object.values(p.buffs)) if (bf.mods[key] && key !== 'lifesteal' && key !== 'reflect' && key !== 'pres') m *= bf.mods[key];
    if (this.b.race === 'dino' && p.res >= 50 && (key === 'atkSpeed' || key === 'moveSpeed')) m *= 1.1;
    return m;
  }
  modAdd(key) {
    let v = 0;
    for (const bf of Object.values(this.player.buffs)) if (bf.mods[key]) v += bf.mods[key];
    return v;
  }
  skillAtk(scale) {
    const d = this.d;
    if (scale === 'mag') return d.magAtk;
    if (scale === 'phys') return Math.max(d.physAtk, d.dexAtk || 0);
    return Math.max(d.physAtk, d.dexAtk || 0, d.magAtk);
  }

  // ═══════ 스킬 사용 ═══════
  castSkillId(id) {
    const p = this.player;
    if (p.castT > 0 || p.channel) return;
    if (id === 'weapon') { if (p.skillCd <= 0) this.useSkill(); return; }
    const def = SKILLS[id];
    if (!def || p.cds[id] > 0) return;
    let spent = 0;
    if (def.costAll) {
      if (p.res < def.costAll.min) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: this.raceRes?.name || '자원' }); p.cds[id] = 0.3; return; }
      spent = p.res; p.res = 0;
    } else if (def.cost) {
      if (p.res < def.cost) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: this.raceRes?.name || '자원' }); p.cds[id] = 0.3; return; }
      p.res -= def.cost; spent = def.cost;
    }
    if (def.gain) this.addRes(def.gain);
    let cd = def.cd * this.d.skillCdMul * (1 - this.d.cdr);
    if (id === 'breath' && p.buffs.dragonForm) cd = 0.3;
    p.cds[id] = cd; p.cdMax ||= {}; p.cdMax[id] = cd;
    p.lastFight = this.t;
    if (def.cast) {
      p.castT = def.cast; p.castMax = def.cast; p.castSkill = { def, spent, id };
      this.emit({ t: 'cast', x: p.x, y: p.y, dur: def.cast, elem: def.elem === 'current' ? p.elem : def.elem });
      return;
    }
    this.execSkill(def, spent);
  }

  execSkill(def, spent) {
    const p = this.player;
    const elem = def.elem === 'current' ? p.elem : def.elem;
    let bonus = 1;
    if (p.elemBonusT > 0 && elem && elem !== 'phys') { bonus = 1.3; p.elemBonusT = 0; }
    const ctx = { def, spent, elem, bonus, atk: this.skillAtk(def.scale), resMul: 1 + spent / 100 };
    this.emit({ t: 'skillFx', fx: def.fx, x: p.x, y: p.y, ang: Math.atan2(p.aimY, p.aimX), elem, name: def.name });
    for (const op of def.do) this.runOp(op, ctx);
  }

  // 스킬 피해 한 번: 치명타·각인 트리거가 붙는다
  skillHit(e, op, ctx, mulExtra = 1) {
    if (!e || e.dead) return false;
    const p = this.player;
    let mul = (op.mul || 0) * ctx.bonus * mulExtra;
    if (op.scaleRes) mul *= ctx.resMul;
    if (op.bonusIf === 'marked' && e.st.elemMark > 0) mul *= 1.6;
    if (op.bonusIf === 'weak' && e.st.weak > 0) mul *= 2;
    if (op.bonusIf === 'prison' && e.st.stun > 0) mul *= 2;
    if (op.bonusIf === 'lowhp' && e.hp < e.maxHp * 0.3) mul *= 2;
    if (op.backstab && Math.sign(p.x - e.x) !== e.dir) mul *= 1.5;
    const type = ctx.def.scale === 'mag' || (ctx.elem && ctx.elem !== 'phys') ? 'mag' : 'phys';
    if (mul > 0) this.hitEnemy(e, ctx.atk * mul, type, true, false, { elem: ctx.elem, pen: op.pen });
    if (e.dead) return true;
    const status = ctx.elem && ELEM[ctx.elem]?.status;
    if (status && op.stacks) this.applyStatus(e, status, op.stacks);
    if (op.status) this.applyStatus(e, op.status, op.stacks || 1);
    if (op.stacksIfBurning && e.st.burn) this.applyStatus(e, 'burn', op.stacksIfBurning);
    if (op.stun && !e.def.elite) { e.st.stun = Math.max(e.st.stun || 0, op.stun); e.windT = 0; if (op.prison) e.prison = true; }
    else if (op.stun && e.def.elite) { e.st.stun = Math.max(e.st.stun || 0, op.stun * 0.35); if (op.prison) e.prison = true; }
    if (op.fear) e.st.fear = Math.max(e.st.fear || 0, op.fear);
    if (op.mark) e.st.elemMark = Math.max(e.st.elemMark || 0, op.mark);
    if (op.weak) e.st.weak = Math.max(e.st.weak || 0, op.weak);
    if (op.armorBreak) { e.armorBreak = Math.min(5, (e.armorBreak || 0) + op.armorBreak); e.armorBreakT = 6; }
    if (op.knock && !e.def.elite) { const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1; e.kbx += (dx / l) * op.knock * 2; e.kby += (dy / l) * op.knock * 2; }
    if (op.pull && !e.def.elite) { const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1; e.kbx += (dx / l) * Math.min(260, l * 6); e.kby += (dy / l) * Math.min(260, l * 6); this.aggro(e); }
    return false;
  }

  aimPoint(maxDist = 160) {
    const p = this.player, dist = Math.min(maxDist, this.aimDist || 100);
    return { x: p.x + p.aimX * dist, y: p.y + p.aimY * dist };
  }

  nearestEnemy(range, fromAim = true) {
    const p = this.player;
    let best = null, bd = range;
    for (const e of this.enemies) {
      if (e.dead || e.hidden || e.def.ai === 'dummy' && this.mode !== 'plaza') continue;
      const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      let score = dist;
      if (fromAim) { const dot = (dx * p.aimX + dy * p.aimY) / (dist || 1); score -= dot * 40; }
      if (score < bd) { bd = score; best = e; }
    }
    return best;
  }

  runOp(op, ctx) {
    const p = this.player;
    const ang = Math.atan2(p.aimY, p.aimX);
    const countHits = (list, extra = 1) => {
      let hits = 0, kills = 0;
      for (const e of list) { hits++; if (this.skillHit(e, op, ctx, extra)) kills++; }
      if (op.gainPerHit) this.addRes(op.gainPerHit * hits);
      if (op.gainPerKill) this.addRes(op.gainPerKill * kills);
      if (op.healOnKill && kills) this.heal(this.d.maxHp * op.healOnKill, 'skill');
      return hits;
    };
    switch (op.op) {
      case 'dash': {
        let dx = p.aimX, dy = p.aimY, dist = op.dist;
        if (op.toward === 'nearest') {
          const t = this.nearestEnemy(op.dist);
          if (t) { const vx = t.x - p.x, vy = t.y - p.y, l = Math.hypot(vx, vy) || 1; dx = vx / l; dy = vy / l; dist = Math.max(0, l - t.r - 6); }
        }
        if (dist < 0) { dx = -dx; dy = -dy; dist = -dist; }
        const x1 = p.x, y1 = p.y;
        const dur = 0.18;
        p.dashT = dur; p.dvx = dx * dist / dur; p.dvy = dy * dist / dur;
        p.invuln = Math.max(p.invuln, op.invuln || 0.25);
        const x2 = x1 + dx * dist, y2 = y1 + dy * dist;
        this.emit({ t: 'skillDash', x1, y1, x2, y2, elem: ctx.elem });
        if (op.mul) countHits(this.enemies.filter((e) => !e.dead && !e.hidden && distToSeg(e.x, e.y, x1, y1, x2, y2) < e.r + 14));
        if (op.fireTrail) for (let i = 1; i <= 4; i++) this.zones.push({ kind: 'fire', x: x1 + (x2 - x1) * i / 4, y: y1 + (y2 - y1) * i / 4, r: 18, t: 3, tick: 0, atk: ctx.atk });
        break;
      }
      case 'teleport': {
        const x1 = p.x, y1 = p.y;
        let dist = op.dist;
        while (dist > 0 && this.blocked(p.x + p.aimX * dist, p.y + p.aimY * dist, 5)) dist -= 6;
        p.x += p.aimX * Math.max(0, dist); p.y += p.aimY * Math.max(0, dist);
        p.invuln = Math.max(p.invuln, 0.2);
        this.emit({ t: 'blink', x1, y1, x2: p.x, y2: p.y });
        if (this.raceRes?.dash) this.addRes(this.raceRes.dash);
        break;
      }
      case 'aoe': {
        const c = op.at === 'aim' ? this.aimPoint() : op.at === 'front' ? { x: p.x + p.aimX * (op.dist || 26), y: p.y + p.aimY * (op.dist || 26) } : { x: p.x, y: p.y };
        const run = () => {
          this.emit({ t: 'skillAoe', x: c.x, y: c.y, r: op.r, elem: ctx.elem, fx: op.fx || ctx.def.fx });
          countHits(this.enemiesNear(c.x, c.y, op.r));
        };
        if (op.delay) { this.emit({ t: 'telegraphCircle', x: c.x, y: c.y, r: op.r, dur: op.delay }); this.delayed.push({ t: op.delay, run }); }
        else run();
        break;
      }
      case 'cone': {
        const list = this.enemies.filter((e) => {
          if (e.dead || e.hidden) return false;
          const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
          if (dist > op.range + e.r) return false;
          let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
          return Math.abs(da) <= op.angle / 2 || dist < e.r + 8;
        });
        this.emit({ t: 'skillCone', x: p.x, y: p.y, ang, range: op.range, angle: op.angle, elem: ctx.elem, fx: op.fx || ctx.def.fx });
        countHits(list);
        break;
      }
      case 'single': {
        const e = this.nearestEnemy(op.range);
        if (!e) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        if (op.teleportTo) { const side = e.dir > 0 ? -1 : 1; let tx = e.x + side * (e.r + 8); if (this.blocked(tx, e.y, 5)) tx = e.x - side * (e.r + 8); this.emit({ t: 'blink', x1: p.x, y1: p.y, x2: tx, y2: e.y }); p.x = tx; p.y = e.y; }
        this.emit({ t: 'skillSingle', x: e.x, y: e.y, fx: ctx.def.fx, elem: ctx.elem, big: !!op.scaleRes });
        countHits([e]);
        break;
      }
      case 'proj': {
        for (let i = 0; i < (op.n || 1); i++) {
          const a = ang + (i - ((op.n || 1) - 1) / 2) * (op.spread || 0);
          this.projs.push({
            owner: 'p', x: p.x + Math.cos(a) * 6, y: p.y - 4 + Math.sin(a) * 6, vx: Math.cos(a) * op.speed, vy: Math.sin(a) * op.speed,
            life: op.range / op.speed, dmg: 0, type: 'mag', pierce: op.pierce || 0, hit: new Set(), splash: 0,
            color: ELEM[ctx.elem]?.color || '#e8e0f4', kind: op.kind === 'rock' ? 'rock' : 'skill', elem: ctx.elem, big: true,
            skillHit: (e, pr) => {
              this.skillHit(e, op, ctx);
              if (op.onHitGain) this.addRes(op.onHitGain);
              if (op.onHitHeal) this.heal(this.d.maxHp * op.onHitHeal, 'skill');
              if (op.splash) {
                this.emit({ t: 'skillAoe', x: pr.x, y: pr.y, r: op.splash, elem: ctx.elem, fx: op.kind === 'rock' ? 'rocks' : 'pop' });
                for (const o of this.enemiesNear(pr.x, pr.y, op.splash)) if (o !== e) this.skillHit(o, op, ctx, 0.6);
              }
            },
          });
        }
        break;
      }
      case 'chain': {
        let cur = this.nearestEnemy(170);
        const pts = [{ x: p.x, y: p.y - 6 }], hit = new Set();
        for (let j = 0; j < op.jumps && cur; j++) {
          hit.add(cur.id); pts.push({ x: cur.x, y: cur.y - 6 });
          this.skillHit(cur, op, ctx, j === 0 ? 1 : 0.85);
          let nx = null, nd = op.range;
          for (const e of this.enemies) { if (e.dead || e.hidden || hit.has(e.id)) continue; const dd = Math.hypot(e.x - cur.x, e.y - cur.y); if (dd < nd) { nd = dd; nx = e; } }
          cur = nx;
        }
        this.emit({ t: 'bolt', pts, color: ELEM[ctx.elem]?.color || '#f8f070' });
        break;
      }
      case 'channel': p.channel = { t: op.dur, every: op.every, tick: 0, sub: op.sub, ctx }; break;
      case 'buff': {
        const mods = { ...op.mods };
        if (op.scaleRes && mods.dmgMul) mods.dmgMul = 1 + (mods.dmgMul - 1) * (1 + ctx.spent / 100);
        p.buffs[op.id] = { t: op.dur, max: op.dur, mods, color: op.color, bubble: op.bubble };
        if (op.id !== 'nextCrit') this.emit({ t: 'buff', x: p.x, y: p.y, color: op.color || '#ffffff', bubble: op.bubble });
        break;
      }
      case 'parry': p.parryT = op.dur; p.parry = { mul: op.mul, r: op.r, gain: op.gain }; this.emit({ t: 'parryStance', x: p.x, y: p.y, dur: op.dur }); break;
      case 'summon': {
        for (let i = 0; i < op.n; i++) {
          const a = this.rng.range(0, Math.PI * 2);
          this.allies.push({ id: this.nextId++, kind: op.kind, elem: op.elem, x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, t: op.dur, max: op.dur,
            atk: ctx.atk * op.mul * (op.scaleRes ? ctx.resMul : 1), cd: 0.3 + i * 0.2, phase: a, dir: 1 });
          this.emit({ t: 'summonFx', x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, kind: op.kind, elem: op.elem });
        }
        break;
      }
      case 'detonate': {
        const key = op.what;
        let n = 0;
        for (const e of [...this.enemies]) {
          if (e.dead || !e.st[key]) continue;
          const stacks = e.st[key].n;
          e.st[key] = null; n++;
          this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: op.r, elem: ctx.elem, fx: 'burst' });
          this.skillHit(e, { mul: op.mul * stacks }, ctx);
          for (const o of this.enemiesNear(e.x, e.y, op.r)) if (o !== e) this.skillHit(o, { mul: op.mul * stacks * 0.4 }, ctx);
        }
        if (!n) this.emit({ t: 'text', x: p.x, y: p.y - 20, text: key === 'curse' ? '저주받은 적이 없다' : '불타는 적이 없다', color: '#a8b0c0' });
        break;
      }
      case 'zone': {
        const c = op.at === 'aim' ? this.aimPoint() : { x: p.x, y: p.y };
        this.zones.push({ kind: op.kind, x: c.x, y: c.y, r: op.r, t: op.dur, max: op.dur, tick: 0, atk: ctx.atk, follow: op.kind === 'sanctuary' ? false : false });
        break;
      }
      case 'shift': {
        p.elem = ELEM_CYCLE[(ELEM_CYCLE.indexOf(p.elem) + 1) % ELEM_CYCLE.length];
        p.elemBonusT = 4;
        this.emit({ t: 'elemShift', x: p.x, y: p.y, elem: p.elem, weak: this.zElem?.weak === p.elem });
        break;
      }
      case 'spiritShift': {
        let n = 0;
        for (const al of this.allies) if (al.kind === 'spirit') { al.elem = ELEM_CYCLE[(ELEM_CYCLE.indexOf(al.elem) + 1) % ELEM_CYCLE.length]; n++; this.emit({ t: 'summonFx', x: al.x, y: al.y, kind: 'spirit', elem: al.elem }); }
        if (!n) this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '정령이 없다', color: '#a8b0c0' });
        break;
      }
      case 'resonance': {
        const sp = this.allies.filter((a) => a.kind === 'spirit');
        if (!sp.length) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '정령이 없다', color: '#a8b0c0' }); break; }
        const c = this.aimPoint(140);
        const elems = [...new Set(sp.map((a) => a.elem))];
        for (const a of sp) { a.t = 0; this.emit({ t: 'skillDash', x1: a.x, y1: a.y, x2: c.x, y2: c.y, elem: a.elem }); }
        this.emit({ t: 'skillAoe', x: c.x, y: c.y, r: op.r, elem: elems[0], fx: 'meteor' });
        for (const e of this.enemiesNear(c.x, c.y, op.r)) {
          this.skillHit(e, { mul: op.mul * (1 + 0.35 * (sp.length - 1)) }, { ...ctx, elem: elems[0] });
          for (const el of elems) this.applyStatus(e, ELEM[el].status, 2);
        }
        break;
      }
      case 'hpToRes': {
        p.hp = Math.max(1, p.hp - this.d.maxHp * op.hp);
        this.addRes(op.gain);
        this.emit({ t: 'buff', x: p.x, y: p.y, color: '#e0445a' });
        break;
      }
    }
  }

  tickChannel() {
    const p = this.player, ch = p.channel;
    ch.t -= DT; ch.tick -= DT;
    if (ch.tick <= 0) { ch.tick = ch.every; this.runOp(ch.sub, ch.ctx); }
    if (ch.t <= 0) p.channel = null;
  }

  // ═══════ 소환수 (정령·망령·분신·사령 군주) ═══════
  updateAllies() {
    if (!this.allies.length) return;
    const p = this.player;
    for (const al of this.allies) {
      al.t -= DT; al.cd -= DT * (p.buffs.fusion && al.kind === 'spirit' ? 2 : 1);
      const near = (r) => { let best = null, bd = r; for (const e of this.enemies) { if (e.dead || e.hidden || e.def.ai === 'dummy' && this.mode !== 'plaza') continue; const dd = Math.hypot(e.x - al.x, e.y - al.y); if (dd < bd) { bd = dd; best = e; } } return best; };
      if (al.kind === 'spirit') {
        al.phase += DT * 2.2;
        const idx = this.allies.filter((a) => a.kind === 'spirit').indexOf(al);
        const a = al.phase + idx * 2.1;
        al.x += (p.x + Math.cos(a) * 20 - al.x) * 0.2; al.y += (p.y - 10 + Math.sin(a) * 12 - al.y) * 0.2;
        const tgt = near(180);
        if (tgt && al.cd <= 0) {
          al.cd = al.elem === 'lightning' ? 0.45 : al.elem === 'ice' ? 1.0 : 0.8;
          if (al.elem === 'lightning') {
            this.emit({ t: 'bolt', pts: [{ x: al.x, y: al.y }, { x: tgt.x, y: tgt.y - 6 }], color: ELEM.lightning.color });
            this.damageEnemy(tgt, al.atk, 'mag', { src: 'aoe', elem: 'lightning' }); this.applyStatus(tgt, 'shock', 1);
          } else {
            const vx = tgt.x - al.x, vy = tgt.y - al.y, l = Math.hypot(vx, vy) || 1;
            this.projs.push({ owner: 'p', x: al.x, y: al.y, vx: vx / l * 220, vy: vy / l * 220, life: 1, dmg: al.atk * 1.4, type: 'mag', pierce: 0, hit: new Set(), color: ELEM[al.elem].color, kind: 'skill', elem: al.elem, noTrigger: true,
              skillHit: (e) => { this.damageEnemy(e, al.atk * 1.4, 'mag', { src: 'aoe', elem: al.elem }); this.applyStatus(e, ELEM[al.elem].status, 1); } });
          }
        }
      } else {
        // 망령·사령 군주·분신: 적을 쫓아가 공격
        const tgt = near(al.kind === 'clone' ? 120 : 220);
        let tx = p.x + (al.kind === 'clone' ? -p.dir * 14 : 0), ty = p.y;
        if (tgt) { tx = tgt.x; ty = tgt.y; }
        const vx = tx - al.x, vy = ty - al.y, l = Math.hypot(vx, vy) || 1;
        const spd = al.kind === 'lich' ? 70 : 110;
        if (l > (tgt ? tgt.r + 8 : 20)) { al.x += vx / l * spd * DT; al.y += vy / l * spd * DT; }
        if (Math.abs(vx) > 1) al.dir = vx > 0 ? 1 : -1;
        if (tgt && l < tgt.r + 14 && al.cd <= 0) {
          al.cd = al.kind === 'lich' ? 0.9 : al.kind === 'clone' ? 0.45 : 0.7;
          this.emit({ t: 'allyHit', x: tgt.x, y: tgt.y, kind: al.kind });
          if (al.kind === 'lich') { for (const e of this.enemiesNear(tgt.x, tgt.y, 40)) { this.damageEnemy(e, al.atk, 'mag', { src: 'aoe', elem: 'dark' }); this.applyStatus(e, 'curse', 1); } }
          else this.damageEnemy(tgt, al.atk, al.kind === 'clone' ? 'phys' : 'mag', { src: 'aoe', elem: al.kind === 'ghost' ? 'dark' : undefined });
        }
      }
      if (al.t <= 0) this.emit({ t: 'summonFx', x: al.x, y: al.y, kind: al.kind, elem: al.elem, out: true });
    }
    this.allies = this.allies.filter((a) => a.t > 0);
  }

  // ═══════ 장판 (성역·죽음의 안개·독 웅덩이·불길) ═══════
  updateZones() {
    if (!this.zones.length) return;
    const p = this.player;
    for (const z of this.zones) {
      z.t -= DT; z.tick -= DT;
      if (z.kind === 'sanctuary' && Math.hypot(p.x - z.x, p.y - z.y) < z.r) this.heal(this.d.maxHp * 0.03 * DT, 'skill');
      if (z.tick > 0) continue;
      z.tick = 0.5;
      if (z.kind === 'sanctuary') continue;
      for (const e of this.enemiesNear(z.x, z.y, z.r)) {
        if (z.kind === 'fog') { this.damageEnemy(e, z.atk * 0.22, 'mag', { src: 'dot', elem: 'dark' }); this.applyStatus(e, 'curse', 1); e.st.weak = Math.max(e.st.weak || 0, 0.6); }
        else if (z.kind === 'poison') { this.damageEnemy(e, z.atk * 0.25, 'true', { src: 'dot', elem: 'poison' }); this.applyStatus(e, 'poison', 2); }
        else if (z.kind === 'fire') { this.damageEnemy(e, z.atk * 0.2, 'mag', { src: 'dot', elem: 'fire' }); this.applyStatus(e, 'burn', 1); }
      }
    }
    this.zones = this.zones.filter((z) => z.t > 0);
  }

  tickWhirl() {
    const p = this.player, d = this.d, w = this.b.weapon;
    p.whirlT -= DT; p.whirlTick -= DT; p.spinT = 0.3;
    if (p.whirlTick > 0) return;
    p.whirlTick = 0.2;
    const r = w.range + 10;
    this.emit({ t: 'spin', x: p.x, y: p.y, r, type: 'phys' });
    for (const e of this.enemiesNear(p.x, p.y, r)) this.hitEnemy(e, d.physAtk * w.mul * 0.7, 'phys', false);
  }

  updateDelayed() {
    if (!this.delayed.length) return;
    for (const a of this.delayed) {
      a.t -= DT;
      if (a.t > 0) continue;
      a.done = true;
      if (a.run) { a.run(); continue; }
      this.emit({ t: a.fx === 'meteor' ? 'meteor' : 'ring', x: a.x, y: a.y, r: a.r, color: a.type === 'mag' ? '#c9a8ff' : '#ffe8a0' });
      if (a.big) { this.emit({ t: 'hitstop', v: 0.08 }); this.emit({ t: 'shake', v: 6 }); }
      for (const e of this.enemiesNear(a.x, a.y, a.r)) this.hitEnemy(e, a.dmg, a.type, !!a.big);
    }
    this.delayed = this.delayed.filter((a) => !a.done);
  }

  hitCrack(x, y, dmg) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), i = ty * this.tw + tx;
    const hp = (this.crackHp.get(i) ?? 3) - 1;
    this.emit({ t: 'crackHit', x: tx * TILE + 8, y: ty * TILE + 8 });
    if (hp <= 0) {
      this.tiles[i] = T_FLOOR;
      this.crackHp.delete(i);
      (this.broken ||= new Set()).add(i);
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

  hitEnemy(e, base, type, heavy, proj = false, opt = {}) {
    const p = this.player, d = this.d, f = this.f, w = this.b.weapon;
    let crit = this.rng.chance(d.crit);
    if (p.dashCritReady) { crit = true; p.dashCritReady = false; }
    if (p.buffs.nextCrit) { crit = true; delete p.buffs.nextCrit; }
    if (crit && this.raceRes?.crit) this.addRes(this.raceRes.crit);
    this.aggro(e);
    this.damageEnemy(e, base * (crit ? d.critDmg : 1), type, { src: 'attack', crit, heavy, proj, dist: opt.dist, elem: opt.elem, pen: opt.pen });
    if (opt.weapon) {
      if (w.onHit && this.rng.chance(w.onHit.chance)) this.applyStatus(e, w.onHit.status, w.onHit.stacks);
      if (w.armorBreak && !e.dead) { e.armorBreak = Math.min(5, (e.armorBreak || 0) + 1); e.armorBreakT = 5; }
    }
    if (this.b.race === 'orc') this.addRage(f.has('rageFast') ? 6 : 4);
    p.lastFight = this.t;
    if (!e.def.elite && e.def.ai !== 'dummy') {
      const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1;
      const kb = d.knockback * (heavy ? 2 : 1);
      e.kbx += (dx / l) * kb * 3; e.kby += (dy / l) * kb * 3;
    }
    if (e.def.ai === 'dummy') e.wobble = 0.3;
    if (f.has('stagger') && e.windT > 0 && !e.def.elite) {
      e.windT = 0; e.atkCd = Math.max(e.atkCd, 0.7);
      this.emit({ t: 'text', x: e.x, y: e.y - 18, text: '경직', color: '#ffe080' });
    }
    if (heavy || crit) this.emit({ t: 'hitstop', v: heavy ? 0.06 : 0.03 });
    if (this.raceRes?.hit) this.addRes(this.raceRes.hit);
    if (p.buffs.fusion) for (const al of this.allies) if (al.kind === 'spirit' && !e.dead) this.applyStatus(e, ELEM[al.elem].status, 1);
    if (p.buffs.dragonForm && !e.dead) this.applyStatus(e, 'burn', 1);
    for (const tr of this.b.triggers.hit) if (this.rng.chance(tr.chance)) this.doAction(tr.action, e, e);
    if (crit) {
      if (f.has('markOnCrit') && !e.dead) e.st.mark = 3;
      if (f.has('critBleed')) this.applyStatus(e, 'bleed', 2);
      for (const tr of this.b.triggers.crit) if (this.rng.chance(tr.chance)) this.doAction(tr.action, e, e);
    }
  }

  damageEnemy(e, amount, type, opt = {}) {
    if (e.dead || e.hidden) return 0;
    const d = this.d, p = this.player;
    let mult = d.dmgMul;
    if (type === 'phys' || type === 'mag') {
      const aura = type === 'phys' && p.auraT > 0 ? 0.5 : 0;
      const pen = Math.min(1, (type === 'phys' ? d.physPen : d.magPen) + (this.s.pierce || 0) / 100 + aura);
      const broken = type === 'phys' && e.armorBreak ? 1 - e.armorBreak * 0.05 : 1;
      const res = (type === 'phys' ? e.pres : e.mres) * broken * (1 - pen);
      mult *= 1 - res / (res + 100);
    }
    if (opt.src === 'dot' || opt.src === 'reaction') mult *= d.statusDmgMul;
    if (e.def.shield && (opt.src === 'attack') && Math.sign(p.x - e.x) === e.dir && !(e.st.frozen > 0)) {
      mult *= 1 - e.def.shield;
      if (this.rng.chance(0.3)) this.emit({ t: 'text', x: e.x, y: e.y - 18, text: '막힘', color: '#a8b0c0' });
    }
    if (e.st.mark > 0) mult *= 1.2;
    if (e.st.frozen > 0 && this.f.has('frozenVuln')) mult *= 1.5;
    // 새 상태이상·속성 상성·종족 특성
    if (e.st.shock > 0) mult *= 1.15;
    if (e.st.weak > 0) mult *= 1.35;
    if (e.st.stun > 0 && e.prison) mult *= 1.3;
    if (opt.elem && opt.elem !== 'phys') {
      if (e.st.elemMark > 0) mult *= 1.4;
      if (this.zElem?.weak === opt.elem) mult *= 1.4;
      else if (this.zElem?.resist === opt.elem) mult *= 0.7;
    }
    if (opt.pen) mult *= 1 + opt.pen * 0.5;
    mult *= this.mod('dmgMul');
    if (this.b.race === 'dragon' && e.st.burn) mult *= 1.15;
    if (this.b.race === 'assassin' && opt.src === 'attack' && Math.sign(p.x - e.x) !== e.dir) mult *= 1.3;
    if (this.b.race === 'undead' && type === 'mag') mult *= 1.12;
    if (this.b.race === 'elf' && opt.proj) mult *= 1 + 0.3 * Math.max(0, Math.min(1, ((opt.dist ?? 80) - 40) / 120));
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
      let ls = (this.s.lifesteal || 0) + this.modAdd('lifesteal');
      if (this.f.has('lowHpDrain') && p.hp < d.maxHp / 2) ls *= 2;
      if (ls > 0) this.heal((dmg * ls) / 100, 'steal');
    }
    if (opt.src === 'attack' && e.def.reflect) this.hurtPlayer(Math.min(dmg * e.def.reflect, d.maxHp * 0.08), 'phys', null, { direct: true });
    if (this.f.has('execute') && !e.def.elite && e.def.ai !== 'dummy' && e.hp > 0 && e.hp < e.maxHp * 0.1) {
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
    if (kind === 'curse') { st.curse = { n: Math.min(12, (st.curse?.n || 0) + stacks), t: 8 }; return; }
    if (kind === 'shock') { st.shock = Math.max(st.shock || 0, 4); return; }
    if (kind === 'burn') {
      const fresh = !st.burn;
      st.burn = { n: Math.min(10, (st.burn?.n || 0) + stacks), t: 3 };
      if (fresh && this.f.has('burnCatch') && !this._catching) {
        this._catching = true;
        for (const o of this.enemiesNear(e.x, e.y, 34)) if (o !== e && !o.st.burn) this.applyStatus(o, 'burn', 1);
        this._catching = false;
      }
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
        st.chill = null; st.frozen = (e.def.elite ? 0.6 : 1) * this.d.freezeTime;
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
    if (a.mana) this.addRes(a.mana);
    if (a.shield) { const p = this.player; p.shield = Math.min(d.maxHp * 0.4, p.shield + d.maxHp * a.shield); }
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
    if (p.parryT > 0 && !opt.direct) {
      // 받아치기 성공: 공격 무효 + 반격
      const pr = p.parry; p.parryT = 0;
      this.emit({ t: 'parry', x: p.x, y: p.y });
      this.emit({ t: 'hitstop', v: 0.12 });
      this.addRes(pr.gain);
      for (const e of this.enemiesNear(p.x, p.y, pr.r)) this.hitEnemy(e, this.skillAtk('phys') * pr.mul, 'phys', true);
      p.invuln = 0.4;
      return;
    }
    if (!opt.direct) {
      if (p.invuln > 0) return;
      if (this.rng.chance(d.dodge)) {
        if (this.raceRes?.dodge) this.addRes(this.raceRes.dodge);
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
    let dmg = amount * (1 - dr) * d.dmgTakenMul * this.mod('dmgTakenMul');
    if (this.b.race === 'knight') dmg *= 0.9;
    if (this.b.race === 'golem' && type === 'phys') dmg *= 0.85;
    if (p.buffs.stoneSkin && type === 'phys') dmg *= 1 - 60 / (60 + 100 + Math.max(0, this.s.pres));
    if (this.zones.some((z) => z.kind === 'sanctuary' && Math.hypot(p.x - z.x, p.y - z.y) < z.r)) dmg *= 0.6;
    if (this.raceRes?.hurt) this.addRes((dmg / d.maxHp) * this.raceRes.hurt * (p.buffs.ironWall ? 2 : 1));
    if (p.buffs.scales && attacker && !attacker.dead) this.applyStatus(attacker, 'burn', 2);
    if (p.shield > 0) { const a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a; }
    p.hp -= dmg; p.hitFlash = 0.15;
    if (attacker && attacker.affix === 'vampiric' && !attacker.dead) attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * 0.25);
    if (this.b.race === 'orc') this.addRage((dmg / d.maxHp) * 160 * (f.has('rageFast') ? 1.5 : 1));
    p.lastFight = this.t;
    if (!opt.direct) p.invuln = 0.3;
    this.emit({ t: 'dmg', x: p.x, y: p.y - 16, v: dmg, color: '#ff5a5a', who: 'p' });
    this.emit({ t: 'shake', v: Math.min(5, 1.5 + dmg / 12) });

    if (attacker && !opt.direct) {
      const refl = (this.s.reflect || 0) + this.modAdd('reflect');
      if (refl > 0) {
        const rv = (amount * refl / 100) * d.reflectMul;
        const targets = f.has('reflectAoe') ? [attacker, ...this.enemiesNear(p.x, p.y, 70).filter((o) => o !== attacker)] : [attacker];
        if (f.has('reflectAoe')) this.emit({ t: 'ring', x: p.x, y: p.y, r: 70, color: '#e6f3ff' });
        for (const o of targets) this.damageEnemy(o, o === attacker ? rv : rv * 0.5, 'phys', { src: 'reflect', color: '#e6f3ff' });
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
    if (this.b.race === 'undead' && (kind === 'poison' || kind === 'bleed')) return;
    if (this.b.race === 'dragon' && kind === 'burn') return;
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
      p.lastStandCd = 90; p.hp = 1; p.invuln = 1;
      this.emit({ t: 'text', x: p.x, y: p.y - 18, text: '불굴!', color: '#ffd060' });
      return;
    }
    p.hp = 0; this.state = 'dead';
    this.emit({ t: 'death', x: p.x, y: p.y, color: '#ff4040', big: true });
  }

  // ───────────── 적 ─────────────
  makeEnemy(id, x, y, opt = {}) {
    const def = ALL_MONSTERS[id];
    const dm = 1 + 0.4 * this.depth, am = 1 + 0.25 * this.depth;
    const e = {
      id: this.nextId++, defId: id, def, x, y, r: def.r, hp: def.hp * dm, maxHp: def.hp * dm, atk: def.atk * am, pres: def.pres, mres: def.mres,
      st: {}, atkCd: 0.5 + this.rng.next(), shotCd: 1 + this.rng.next() * 1.5, kbx: 0, kby: 0, hitFlash: 0, dead: false,
      dotAcc: 0, dotT: 0.5, reactCd: 0, ai: { mode: 'move', t: 2 + this.rng.next() * 2, dx: 0, dy: 0 }, dir: 1, phase: this.rng.range(0, 6),
      state: 'idle', home: { x, y }, wander: null, wanderT: this.rng.range(0, 2), leashT: 0, moving: false, walkT: 0,
      dmgLog: [], lastHit: -9, wobble: 0, windT: 0, windMax: 0.4, speedMul: 1, atkRate: 1, scale: 1,
      hidden: def.ai === 'burrow', summonCd: 3, fuse: 0, summoned: !!opt.summoned,
    };
    if (opt.champion) {
      e.champion = `${opt.champion}의 우두머리`;
      e.hp = e.maxHp = e.maxHp * 6; e.atk *= 1.6; e.scale = 1.5; e.r = def.r * 1.4; e.hidden = false;
    } else if (this.mode === 'field' && !def.elite && !opt.noAffix && !opt.summoned && def.ai !== 'flee' && this.rng.chance(0.12)) {
      const key = this.rng.pick(Object.keys(AFFIXES)), af = AFFIXES[key];
      e.affix = key;
      if (af.scale) { e.scale = af.scale; e.r = def.r * af.scale; }
      if (af.hp) e.hp = e.maxHp = e.maxHp * af.hp;
      if (af.atk) e.atk *= af.atk;
      if (af.speed) e.speedMul = af.speed;
      if (af.atkRate) e.atkRate = af.atkRate;
    }
    return e;
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
      if (st.poison) {
        const deep = this.f.has('poisonDeep') ? 1 + Math.max(0, st.poison.n - 5) * 0.08 : 1;
        poison = st.poison.n * (1.5 + (s.toxicity || 0) * 0.6) * (st.septic > 0 ? 2 : 1) * deep;
        if ((st.poison.t -= DT) <= 0) st.poison = null;
      }
      if (e.armorBreakT > 0 && (e.armorBreakT -= DT) <= 0) e.armorBreak = 0;
      if (st.bleed) { bleed = st.bleed.n * (1.5 + d.physAtk * 0.1) * d.bleedMul; if ((st.bleed.t -= DT) <= 0) st.bleed = null; }
      if (st.chill && (st.chill.t -= DT) <= 0) st.chill = null;
      let curse = 0;
      if (st.curse) { curse = st.curse.n * (2 + d.magAtk * 0.12) * (this.b.race === 'undead' ? 1.12 : 1); if ((st.curse.t -= DT) <= 0) st.curse = null; }
      for (const k of ['shock', 'weak', 'elemMark', 'fear', 'stun']) if (st[k] > 0) { st[k] -= DT; if (st[k] <= 0 && k === 'stun') e.prison = false; }
      if (this.b.race === 'dragon' && st.burn) this.addRes(DT * (this.raceRes.burnTick || 1), true);
      for (const k of ['frozen', 'mark', 'septic']) if (st[k] > 0) st[k] -= DT;
      const dot = burn + poison + bleed + curse;
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

      e.atkCd -= DT * e.atkRate; e.shotCd -= DT; e.summonCd -= DT;
      const frozen = st.frozen > 0 || st.stun > 0;
      let slow = st.chill ? Math.min(0.6, st.chill.n * 0.12 * d.chillMul) : 0;
      if (this.zone && this.zone.liquid !== 'lava' && this.zone.liquid !== 'mist' && this.tileAt(e.x, e.y + 3) === T_LIQUID && def.shape !== 'flyer') slow = Math.max(slow, 0.3);
      if (st.fear > 0) slow = Math.max(slow, 0.4);
      if (this.zones.some((z) => z.kind === 'sanctuary' && Math.hypot(e.x - z.x, e.y - z.y) < z.r)) slow = Math.max(slow, 0.5);
      let spd = frozen ? 0 : def.speed * e.speedMul * (1 - slow);
      let vx = 0, vy = 0;

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
        if (def.ai === 'flee') {
          // 보물 고블린: 도망치다 시간이 지나면 사라진다
          vx = -dxp / dist; vy = -dyp / dist;
          e.fleeT = (e.fleeT || 0) + DT;
          if (e.fleeT > 22) { e.dead = true; this.emit({ t: 'text', x: e.x, y: e.y - 16, text: '도망쳤다…', color: '#ffcf5a' }); this.emit({ t: 'death', x: e.x, y: e.y, color: '#ffcf5a' }); continue; }
        } else if (def.ai === 'kamikaze') {
          // 다가와서 자폭 (도화선이 타는 동안 피할 수 있다)
          if (e.fuse > 0) {
            spd = 0; e.fuse -= DT;
            if (e.fuse <= 0) { this.explode(e); continue; }
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
            const reach = e.r + p.r + (def.elite || e.champion ? 14 : 9);
            this.emit({ t: 'strike', id: e.id, x: e.x, y: e.y, ang: Math.atan2(dyp, dxp), r: reach + 4 });
            if (Math.hypot(p.x - e.x, p.y - e.y) < reach) this.hurtPlayer(e.atk * (st.fear > 0 ? 0.7 : 1), def.type, e, { status: def.status || (e.affix && AFFIXES[e.affix].status) });
          }
        }
      } else if (e.state === 'chase' && !frozen && def.ai !== 'flee' && def.ai !== 'kamikaze' && dist < e.r + p.r + 6 && e.atkCd <= 0 && (def.ai !== 'charge' && def.ai !== 'boss' || e.ai.mode === 'move')) {
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

  explode(e) {
    const p = this.player, b = e.def.boom;
    this.emit({ t: 'ring', x: e.x, y: e.y, r: b.r, color: b.color });
    this.emit({ t: 'shake', v: 4 });
    if (Math.hypot(p.x - e.x, p.y - e.y) < b.r + p.r) this.hurtPlayer(e.atk, e.def.type, null, { status: b.status });
    if (b.cloud) this.addCloud(e.x, e.y, b.r, e.atk * 0.25, 3, 'e');
    e.hp = 0; this.killEnemy(e, true);
  }

  enemyShot(e, ang, n, spread) {
    const pr = e.def.proj;
    for (let i = 0; i < n; i++) {
      const a = ang + (i - (n - 1) / 2) * spread;
      this.projs.push({ owner: 'e', src: e, x: e.x, y: e.y, vx: Math.cos(a) * pr.speed, vy: Math.sin(a) * pr.speed, life: 3, dmg: e.atk, type: e.def.type, status: pr.status, color: pr.color });
    }
  }

  killEnemy(e, selfDestruct = false) {
    if (e.dead) return;
    e.dead = true;
    const def = e.def, st = e.st, d = this.d;
    const bonus = (e.affix ? 2 : 1) * (e.champion ? 5 : 1) * (1 + 0.5 * this.depth);
    if (e.summoned) { this.emit({ t: 'death', x: e.x, y: e.y, color: def.pal.a, defId: e.defId, dir: e.dir }); return; }
    this.loot.xp += Math.round(def.xp * bonus);
    this.loot.kills[e.defId] = (this.loot.kills[e.defId] || 0) + 1;
    this.emit({ t: 'death', x: e.x, y: e.y, color: def.pal.a, big: def.elite, defId: e.defId, dir: e.dir });
    if (def.elite || e.champion) { this.emit({ t: 'hitstop', v: 0.25 }); this.emit({ t: 'banner', text: `${e.champion || def.name} 처치!`, color: '#ffcf5a' }); }
    if (e.affix && AFFIXES[e.affix].deathCloud) this.addCloud(e.x, e.y, 36, e.atk * 0.3, 3, 'e');
    const gold = Math.round(def.gold * d.goldMul * bonus);
    if (gold > 0) for (let i = 0, n = def.treasure || e.champion ? 6 : 1; i < n; i++) this.spawnDrop(e.x, e.y, 'gold', null, Math.ceil(gold / n));
    const echoTries = e.champion ? 3 : def.treasure ? 3 : e.affix ? 2 : 1;
    for (let i = 0; i < echoTries; i++) if (this.rng.chance(Math.min(1, def.echo.rate * (1 + 0.25 * this.depth)))) this.spawnDrop(e.x, e.y, 'echo', e.champion || def.treasure ? this.rng.pick(this.zone.pool.map((m) => MONSTERS[m].echo.id)) : def.echo.id);
    if (e.champion && this.rng.chance(0.3)) this.spawnDrop(e.x, e.y, 'echo', MONSTERS[this.zone.elite].echo.id);
    if (def.condEcho && def.condEcho.when === 'burning' && st.burn && this.rng.chance(def.condEcho.rate)) this.spawnDrop(e.x, e.y, 'echo', def.condEcho.id);
    if (def.onDeath?.cloud) { const c = def.onDeath.cloud; this.addCloud(e.x, e.y, c.r, c.dps, c.dur, 'e'); }

    for (const tr of this.b.triggers.kill) if (this.rng.chance(tr.chance)) this.doAction(tr.action, null, e);
    if (st.poison && this.f.has('poisonSpread')) for (const o of this.enemiesNear(e.x, e.y, 60)) this.applyStatus(o, 'poison', Math.ceil(st.poison.n / 2));
    if (st.burn && this.f.has('burnSpread')) for (const o of this.enemiesNear(e.x, e.y, 60)) this.applyStatus(o, 'burn', 2);
    if (st.poison && this.f.has('poisonBurst')) this.addCloud(e.x, e.y, 34 * (1 + d.cloudSize), 4 + (this.s.toxicity || 0) * 0.8, 3, 'p');
    if (this.b.race === 'undead') { this.heal(d.maxHp * 0.06, 'drain'); this.player.mana = Math.min(d.maxMana, this.player.mana + 8); }
    if (this.raceRes?.kill) this.addRes(this.raceRes.kill);
    this.lastKills = (this.lastKills || 0) + 1;
  }

  addRage() { /* 오크 분노는 종족 자원(res)으로 통합 */ }

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
    return this.enemies.filter((o) => !o.dead && !o.hidden && Math.hypot(o.x - x, o.y - y) <= r + o.r);
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
      if (pr.boomerang && !pr.returning && pr.life < pr.maxLife * 0.5) { pr.returning = true; pr.hit.clear(); }
      if (pr.returning) {
        const bx = this.player.x - pr.x, by = this.player.y - pr.y, bl = Math.hypot(bx, by) || 1, sp = Math.hypot(pr.vx, pr.vy) || 200;
        pr.vx = (bx / bl) * sp; pr.vy = (by / bl) * sp; pr.life = Math.max(pr.life, 0.1);
        if (bl < 10) { pr.life = 0; continue; }
      }
      pr.spin = (pr.spin || 0) + DT * 20;
      pr.x += pr.vx * DT; pr.y += pr.vy * DT; pr.life -= DT;
      if (this.solid(pr.x, pr.y) && !pr.returning) {
        if (pr.owner === 'p' && this.tileAt(pr.x, pr.y) === T_CRACK) this.hitCrack(pr.x, pr.y, pr.dmg);
        this.emit({ t: 'spark', x: pr.x - pr.vx * DT, y: pr.y - pr.vy * DT, color: pr.color });
        pr.life = 0;
      }
      if (pr.life <= 0) continue;
      if (pr.owner === 'p') {
        for (const e of this.enemies) {
          if (e.dead || e.hidden || pr.hit.has(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) > e.r + 3) continue;
          pr.hit.add(e.id);
          if (pr.skillHit) pr.skillHit(e, pr);
          else if (pr.noTrigger) this.damageEnemy(e, pr.dmg, pr.type, { src: 'aoe' });
          else {
            const dist = pr.ox != null ? Math.hypot(e.x - pr.ox, e.y - pr.oy) : 100;
            const range = pr.boomerang ? 1 : dist < 40 ? 0.7 : dist > 70 ? 1.1 : 1;
            this.hitEnemy(e, pr.dmg * range, pr.type, pr.heavy, true, { dist, weapon: pr.weaponHit });
          }
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

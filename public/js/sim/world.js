// 전투·탐험 시뮬레이션. 고정 틱(60Hz) + 시드 난수 + 입력만으로 진행 → 서버 권한 방식으로 옮기기 쉽다.
// 렌더러는 world 상태와 world.events 만 읽고, main 은 world.signals 로 화면 전환을 한다.
import { MONSTERS, ZONES, DUMMIES, ECHOES, LORES, AFFIXES } from '../data/monsters.js';
import { REACTIONS } from '../data/engravings.js';
import { WEAPON_SKILLS } from '../data/items.js';
import { knackTick, hasKnack, BEASTS } from '../data/knacks.js';
import { towerMul, isBossFloor } from '../data/tower.js';
import { SKILLS, ELEM, ELEM_CYCLE, ZONE_ELEM, aimRule, skillFit, handFit, crossMul, CANT_TEXT, PVP, WORD_FAMILY, WORD_COMBO, SKILL_BAL } from '../data/skills.js';
import { SPIRITS, SPIRIT_ELEMS, SPIRIT_GRADES, spiritPower, spiritBuff, buffMods } from '../data/spirits.js';
const SPIRIT_OPS = new Set(['summonSpirit', 'spiritEmpower', 'spiritGuard']);
const SPIRIT_DMG_ELEM = { fire: 'fire', ice: 'ice', lightning: 'lightning', wind: 'wind', forest: 'poison', dark: 'dark' };
import { RACES } from '../data/races.js';
import { createRng } from './rng.js';
import { TILE, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD, T_GATE, T_DEEP, generateField } from './mapgen.js';
import { buildOverworld, G, WORLD_ZONE, BIOME_LIST, ENTRANCES } from '../data/maps/overworld.js';
import { BIOME_SANCTUM, SANCTUMS, SANCT_LIFE, sanctQuestDef, FIND_NAME, trainSpec } from '../data/sanctums.js';
import { RACE_STORY } from '../data/lore.js';
import { GOODS, MONSTER_DROPS, bagFits, bagAdd } from '../data/goods.js';
import { eatInfo, mealEffect, registerDish } from '../data/cooking.js';
import { initLife, lifeAction, startAction, updateLife } from './life.js';
import { MIN_PER_SEC, absMin, isNight } from './time.js';
import { BREATH } from '../data/learn.js';
import { buildCave1 } from '../data/maps/cave1.js';
import { STORY_ITEMS, BARRIERS, JOURNALS } from '../data/story.js';
import { monsterStage, placeKey, STAGE_KILLS } from '../data/codex.js';

export { TILE };
export const DT = 1 / 60;
// 스킬 예비 동작(초): 이만큼 몸을 움직인 뒤 효과가 나간다
const WINDUP = { blow3: 0.08, throw: 0.12, throwBig: 0.2, shoot: 0.12, overhead: 0.3, sweep: 0.18, claw: 0.08, bite: 0.08, headbutt: 0.1, bash: 0.1, roar: 0.14, stomp: 0.2, point: 0.06, power: 0.15, stab: 0.06 };
// 스킬 몸 동작 길이(초)
const MOTION_DUR = { blow3: 0.68, slash: 0.3, sweep: 0.42, overhead: 0.5, thrust: 0.3, spin: 0.38, dash: 0.25, leap: 0.45, cast: 0.3, castBig: 0.45, throw: 0.3, throwBig: 0.45, roar: 0.55, guard: 0.5, bite: 0.35, shoot: 0.3, power: 0.6, stomp: 0.45, claw: 0.3, breath: 1.2, headbutt: 0.35, charge: 0.4, bash: 0.4, chop: 0.6, stab: 0.4, point: 0.3, crouch: 0.4, channel: 1.2, aim: 0.5, dashSlash: 0.35 };
const STATUS_COLOR = { burn: '#ff7a2a', poison: '#9be15d', bleed: '#e0445a', chill: '#9fe3ff', true: '#ffffff' };
const ACTIVE_RANGE = 440;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL_MONSTERS = { ...MONSTERS, ...DUMMIES };
// 파티 탑: 방장의 적이 낸 사건 중 동료 화면에도 보여 줄 것
const CO_EV = new Set(['windup', 'telegraph', 'strike', 'emerge', 'fuse', 'summon', 'alert', 'ring', 'shake', 'text']);
// 파티 탑 (동료): 내 기술이 적에게 건 것 중 방장에게 넘길 것 (적의 행동은 방장의 세계가 정한다)
const CO_SET = ['provokeT', 'silenceT', 'loseT', 'lureT', 'rooted'];
let OW_CACHE = null;
// 처음 만든 바깥 세계 지도 (바닷속 지도를 이것으로 만든다)
export function overworldBase() { OW_CACHE ||= buildOverworld(WORLD_ZONE); return OW_CACHE; }
function overworldMap(zone) {
  OW_CACHE ||= buildOverworld(zone);
  const m = OW_CACHE;
  return { ...m, tiles: new Uint8Array(m.tiles), ground: new Uint8Array(m.ground), props: m.props.slice(), objects: m.objects.map((o) => ({ ...o })) };
}

export class World {
  // mode: 'field' | 'plaza'
  constructor({ build, mode, zoneId, zone = null, seed, map, memory, depth = 0, practice = null, story = null, codex = null, life = null, clock = null, persist = null, tower = null, pvp = null, coop = null }) {
    this.depth = depth;
    // 파티 탑: 방장(host)은 적을 움직이고, 동료(member)는 방장이 알려 준 대로 적을 보여 주며 자기 공격을 방장에게 보낸다
    this.coop = coop ? { role: coop.role, mates: new Map(), out: [], ev: [], known: new Set(), deadIds: [], info: new Map() } : null;
    this.pvp = pvp ? { opp: pvp.opp, out: [] } : null; // 결투: 상대에게 보낼 것(피해 · CC · 상태 · 스킬)을 모아 둔다
    this.tower = tower ? { f: tower.f, t: 0, hurt: 0, boss: null } : null; // 각인의 탑: 층 · 걸린 시간 · 받은 피해
    this.clock = practice ? null : clock;     // 하루의 시간 { day, min } — 저장 데이터와 같은 객체
    this.persist = practice ? null : persist; // 오래가는 효과 (음식 · 잠) — 저장 데이터와 같은 배열
    this.story = practice ? null : story;   // { items, flags } — 저장 데이터와 같은 객체
    this.codex = practice ? null : codex;   // 도감 (처치 수 · 장소 · 일지)
    this.practice = practice; // { infRes, noCd }
    this.mode = mode;
    this.setBuild(build);
    this.zone = zone || (zoneId === 'world' ? WORLD_ZONE : zoneId ? ZONES.find((z) => z.id === zoneId) : null);
    this.rng = createRng(seed);
    this.map = map || (this.zone?.id === 'world' ? overworldMap(this.zone) : this.zone?.id === 'cave' && !depth && !practice ? buildCave1(this.zone) : generateField(this.zone, seed, depth));
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
      lastCast: -9, rage: 0, rageT: 0, lastFight: -9,
      dashCharges: 1, dashRecharge: 0, dashCritReady: false, lastShot: -9, whirlT: 0, whirlTick: 0,
      res: RACES[this.b.race]?.res?.start || 0, elem: 'fire', elemBonusT: 0, buffs: {}, cds: {}, parryT: 0, parry: null,
      castT: 0, castMax: 0, castSkill: null, channel: null, souls: [],
      spirits: [], words: [], focus: 0, focusT: 0, stealthT: 0, airT: 0, soar: null, rush: null, leap: null, charging: null, stored: 0, storedT: 0, hist: [], histT: 0,
      motion: null,
    };
    this.linkSeq = 1;
    this.allies = []; this.zones = [];
    this.zElem = this.zone ? ZONE_ELEM[this.zone.id] : null;
    this.delayed = [];
    this.state = 'play'; // play | dead | done
    this.loot = { echoes: {}, gold: 0, xp: 0, kills: {}, chests: 0, lores: [], banked: null };
    this.regionSeen = new Set(); this.milestones = new Set(); this.regionCur = -1; this.regionT = 0; this.mileT = 0;
    this.discovered = new Set();
    this.burning = new Map(); this.frozen = new Map(); this.burntTrees = new Set(); this.burntSoil = new Map(); this.burnOrig = new Map(); this.envT = 0;
    this.near = null;
    this.flow = new Int16Array(this.tw * this.th); this.flowT = 0;

    // 탐험 안개
    this.explored = new Uint8Array(this.tw * this.th);
    this.revealed = []; // 렌더러가 소비
    if (mode === 'plaza') this.explored.fill(1);

    if (mode === 'field') {
      this.camps = m.camps.map((c) => ({ ...c, members: [], respawnT: 0 }));
      for (const c of this.camps) this.spawnCamp(c);
      if (!this.tower || isBossFloor(this.tower.f)) { // 탑: 보스 층에만 층 수호자 (짧게)
        const elite = this.makeEnemy(this.zone.elite, m.lair.x * TILE + 8, m.lair.y * TILE + 8);
        elite.home = { x: elite.x, y: elite.y }; elite.lair = true;
        if (this.tower) { elite.hp = elite.maxHp = elite.maxHp * 2; elite.champion = `${this.tower.f}층 수호자`; elite.scale = 1.4; this.tower.boss = elite; }
        this.enemies.push(elite);
      }
      // 구역 우두머리: 구역 몬스터의 강화판, 다시 생기지 않음
      for (const c of m.champions || []) {
        const e = this.makeEnemy(c.type, c.x * TILE + 8, c.y * TILE + 8, { champion: m.regionInfo[c.region].name });
        e.home = { x: e.x, y: e.y }; e.region = c.region;
        this.enemies.push(e);
      }
      for (const g of m.goblins || []) {
        const e = this.makeEnemy('treasureGoblin', g.x * TILE + 8, g.y * TILE + 8, { noAffix: true });
        e.home = { x: e.x, y: e.y };
        this.enemies.push(e);
      }
      if (!m.outdoor) this.objects.push({ kind: 'portal', x: sx, y: sy - 14, label: '귀환 포탈 (잔향 전부 보존)', color: this.zone.portal });
      for (const o of m.objects || []) this.objects.push({ ...o });
      for (const c of m.chests) this.objects.push({ kind: 'chest', x: c.x * TILE + 8, y: c.y * TILE + 8, rich: c.rich, trap: c.trap, hidden: !!(c.rich && m.outdoor), label: c.rich ? '숨겨진 보물 상자' : '보물 상자' });
      for (const c of m.camp || []) this.objects.push({ kind: 'camp', x: c.x * TILE + 8, y: c.y * TILE + 8, label: '야영지 · 잔향 맡기고 쉬기', reusable: true });
      for (const c of m.merchant || []) this.objects.push({ kind: 'merchant', x: c.x * TILE + 8, y: c.y * TILE + 8, label: '떠돌이 상인', reusable: true, npc: { name: '떠돌이 상인 오반' } });
      for (const c of m.shrines || []) this.objects.push({ kind: 'shrine', x: c.x * TILE + 8, y: c.y * TILE + 8, label: '낡은 제단 · 축복 받기' });
      if (m.stairs && this.tower) { const dp = this.towerDoorSpot(m); m.stairs = dp; } // 탑: 문은 걸어서 닿는 넓은 바닥 가운데에
      if (m.stairs) this.objects.push({ kind: 'stairs', door: !!this.tower, reach: this.tower ? 30 : undefined, x: m.stairs.x * TILE + 8, y: m.stairs.y * TILE + 8, label: this.tower ? `계단 · ${this.tower.f}층 클리어` : `아래층으로 (지하 ${depth + 2}층)`, reusable: true });
      for (const l of m.lores) this.objects.push({ kind: 'lore', x: l.x * TILE + 8, y: l.y * TILE + 8, label: '고대 석판 읽기' });
      for (const b of m.barriers || []) {
        const def = BARRIERS[b.id], o = { kind: 'barrier', id: b.id, look: def.look, axis: b.axis, from: b.from, tiles: b.tiles, x: b.x * TILE + 8, y: b.y * TILE + 8, label: def.name, reusable: true };
        this.objects.push(o);
        if (this.story?.flags[`open:${b.id}`]) this.openBarrier(o, true);
      }
      for (const j of m.journals || []) {
        const def = JOURNALS[j.id];
        this.objects.push({ kind: 'journal', id: j.id, look: def.look, x: j.x * TILE + 8, y: j.y * TILE + 8, label: def.look === 'campfire' ? '꺼진 모닥불 · 일지 읽기' : `${def.title} 읽기`, reusable: true, read: !!this.codex?.journals?.[j.id] });
      }
      for (const n of m.npcs || []) if (!(n.id === 'pino' && this.story?.flags.pinoDone)) this.objects.push({ kind: 'npc', id: n.id, art: n.id, x: n.x * TILE + 8, y: n.y * TILE + 8, label: '지도 제작자 피노와 이야기', reusable: true });
      this.memObjCount = this.objects.length; // 기억(열어 본 것)은 이 순번까지의 오브젝트에만
      if (memory) this.applyMemory(memory);
      // 이동 포탈: 기억(오브젝트 순번) 뒤에 붙인다. 깨어났는지는 이야기 기록(story.flags)에 남는다 (마을 포탈은 처음부터 깨어 있다)
      for (const wp of m.waypoints || []) { const on = !!wp.start || !!this.story?.flags[`wp:${wp.id}`]; this.objects.push({ kind: 'waypoint', ...wp, active: on, label: on ? '이동 포탈 · 다른 포탈로 가기' : '잠든 포탈 깨우기', reusable: true }); }
      // 성지 마을: 우두머리 · 주민 · 수련 안내판 (역시 기억 뒤에), 맡고 있는 '찾기' 의뢰의 물건
      for (const [race, v] of Object.entries(m.villages || {})) this.addVillage(race, v);
      this.syncQuestThings();
      initLife(this, practice ? null : life); // 캐기 · 나무 · 땅 파기 · 낚시 · 밭
      for (const dk of m.docks || []) this.objects.push({ kind: 'boat', x: dk.bx * TILE + 8, y: dk.by * TILE + 8, label: '배 타기', reusable: true });
      this.reveal(true);
    } else {
      for (const o of m.objects) this.objects.push({ ...o });
      for (const dm of m.dummies) { const e = this.makeEnemy(dm.id, dm.x, dm.y); e.home = { x: dm.x, y: dm.y }; this.enemies.push(e); }
      this.life = life;
    }
    this.applyPersist();
    if (this.tower) this.tower.bosses = this.enemies.filter((e) => e.champion); // 탑: 이 층의 우두머리 목록 (쓰러뜨리면 줄이 그어진다)
  }

  // 탑의 문 자리: 시작점에서 걸어서 닿고, 둘레 3×3이 모두 바닥인 칸 중 원래 계단에 가장 가까운 곳
  towerDoorSpot(m) {
    const tw = m.tw, th = m.th, T = m.tiles, ok = (t) => t === T_FLOOR;
    const start = m.start.y * tw + m.start.x, seen = new Uint8Array(tw * th), q = [start]; seen[start] = 1;
    let best = null, bd = 1e9;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % tw, y = (i / tw) | 0;
      let wide = x > 1 && y > 1 && x < tw - 2 && y < th - 2;
      for (let dy = -1; wide && dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!ok(T[(y + dy) * tw + x + dx])) { wide = false; break; }
      const far = Math.hypot(x - m.start.x, y - m.start.y);
      if (wide && far > 6) { const d = Math.hypot(x - m.stairs.x, y - m.stairs.y); if (d < bd) { bd = d; best = { x, y }; } }
      for (const [ox, oy] of N8.slice(0, 4)) { const nx = x + ox, ny = y + oy, j = ny * tw + nx; if (nx < 0 || ny < 0 || nx >= tw || ny >= th || seen[j] || T[j] === T_WALL || T[j] === T_DEEP || T[j] === T_CRACK || T[j] === T_GATE || T[j] === T_BUILD) continue; seen[j] = 1; q.push(j); }
    }
    return best || m.stairs;
  }
  // 탑: 문으로 가는 길 (층을 깬 뒤 · 0.5초마다 다시)
  towerPath() {
    const tr = this.tower, door = this.objects.find((o) => o.kind === 'stairs');
    if (!tr || !door) return null;
    const open = tr.boss ? tr.boss.dead : this.enemies.filter((e) => !e.dead && !e.training).length <= Math.ceil((tr.total ||= this.enemies.length) * 0.4);
    if (!open) return null;
    if ((tr.pathT = (tr.pathT || 0) - DT) > 0 && tr.path) return tr.path;
    tr.pathT = 0.5;
    const tw = this.tw, p = this.player, sx = Math.floor(p.x / TILE), sy = Math.floor(p.y / TILE), gx = Math.floor(door.x / TILE), gy = Math.floor(door.y / TILE);
    const prev = new Int32Array(tw * this.th).fill(-2), q = [sy * tw + sx]; prev[q[0]] = -1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; if (i === gy * tw + gx) break;
      const x = i % tw, y = (i / tw) | 0;
      for (const [ox, oy] of N8.slice(0, 4)) { const nx = x + ox, ny = y + oy, j = ny * tw + nx; if (nx < 0 || ny < 0 || nx >= tw || ny >= this.th || prev[j] !== -2) continue; const t = this.tiles[j]; if (t === T_WALL || t === T_DEEP || t === T_CRACK || t === T_GATE || t === T_BUILD) continue; prev[j] = i; q.push(j); }
    }
    const pts = []; let c = gy * tw + gx;
    if (prev[c] === -2) return (tr.path = null);
    while (c >= 0) { pts.push({ x: (c % tw) * TILE + 8, y: ((c / tw) | 0) * TILE + 8 }); c = prev[c]; }
    return (tr.path = pts.reverse());
  }

  // 오래가는 효과 (음식 · 잠): 저장에 남아 있어서 집에 들어갔다 나와도 이어진다. 게임 시간으로 끝난다
  applyPersist() {
    const p = this.player;
    if (!this.persist || !this.clock) return;
    const now = absMin(this.clock);
    for (let i = this.persist.length - 1; i >= 0; i--) if (this.persist[i].until <= now) this.persist.splice(i, 1);
    for (const k of Object.keys(p.buffs)) if (p.buffs[k].persist) delete p.buffs[k];
    for (const e of this.persist) p.buffs[e.id] = { t: (e.until - now) / MIN_PER_SEC, max: e.dur / MIN_PER_SEC, mods: e.mods, color: e.color, name: e.name, persist: true };
  }
  get night() { return !!this.clock && isNight(this.clock.min); }

  // 층 기억: 탐험한 타일(비트), 열어 본 상자·석판(오브젝트 순번), 부순 균열 벽(타일 번호)
  exportMemory() {
    const bits = new Uint8Array(Math.ceil(this.explored.length / 8));
    for (let i = 0; i < this.explored.length; i++) if (this.explored[i]) bits[i >> 3] |= 1 << (i & 7);
    let bin = '';
    for (const b of bits) bin += String.fromCharCode(b);
    return {
      v: 1, tw: this.tw, th: this.th, explored: btoa(bin), sig: this.objSig(),
      opened: this.objects.map((o, i) => (o.opened ? i : -1)).filter((i) => i >= 0),
      broken: [...(this.broken || [])],
      regions: [...this.regionSeen], milestones: [...this.milestones],
    };
  }

  objSig() {
    let h = 7;
    for (let i = 0, n = this.memObjCount ?? this.objects.length; i < n; i++) { const o = this.objects[i]; h = (Math.imul(h, 31) + o.kind.charCodeAt(0) * 13 + Math.round(o.x) * 3 + Math.round(o.y) * 7) | 0; }
    return h;
  }
  applyMemory(m) {
    if (!m || m.tw !== this.tw || m.th !== this.th) return;
    try {
      const bin = atob(m.explored || '');
      for (let i = 0; i < this.explored.length; i++) if (bin.charCodeAt(i >> 3) & (1 << (i & 7))) this.explored[i] = 1;
    } catch { /* 손상된 기록은 무시 */ }
    // 오브젝트 배치가 바뀐 기억(예전 버전)이면 '열어 본 것'은 적용하지 않는다 (엉뚱한 것이 열린 채로 남지 않게)
    if (m.sig === this.objSig()) for (const i of m.opened || []) if (this.objects[i] && this.objects[i].kind !== 'portal') this.objects[i].opened = true;
    this.broken = new Set(m.broken || []);
    this.regionSeen = new Set(m.regions || []);
    this.milestones = new Set(m.milestones || []);
    for (const i of this.broken) if (this.tiles[i] === T_CRACK) this.tiles[i] = T_FLOOR;
  }

  setBuild(build) {
    this.b = build; this.d = build.derived; this.f = build.flags; this.s = build.stats;
    if (this.player) this.player.hp = Math.min(this.player.hp, this.d.maxHp);
    if (this.player && this.mode === 'plaza') this.player.hp = this.d.maxHp;
  }

  emit(e) {
    this.events.push(e);
    if (this.coRec && CO_EV.has(e.t)) this.coop.ev.push(e); // 파티 탑 (방장): 적이 낸 사건을 동료에게도
    if (this.map?.outdoor && (e.elem === 'fire' || e.elem === 'ice') && e.t && e.t.startsWith('skill')) this.elemReact(e);
  }

  // ───────────── 바깥 세계: 원소 반응 ─────────────
  elemReact(e) {
    if (e.t === 'skillFx') return; // 시전하는 몸짓(내 자리)에서는 붙지 않는다 — 불꽃이 닿은 곳 · 끝난 곳에서
    if (e.elem === 'ice' && e.fromProj) return; // 얼음 투사체는 지나간 자리만 언다 (터지는 자리는 얼리지 않는다)
    const tiles = new Set(), add = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (tx >= 0 && ty >= 0 && tx < this.tw && ty < this.th) tiles.add(ty * this.tw + tx); };
    const circle = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y += 8) for (let x = cx - r; x <= cx + r; x += 8) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) add(x, y); add(cx, cy); };
    if (e.t === 'skillAoe') circle(e.x, e.y, e.r || 24);
    else if (e.t === 'skillCone') { for (let d = Math.max(16, e.range * 0.45); d <= e.range; d += 8) for (let a = -e.angle / 2; a <= e.angle / 2; a += 0.15) add(e.x + Math.cos(e.ang + a) * d, e.y + Math.sin(e.ang + a) * d); } // 숨결 · 부채꼴: 불꽃 끝 쪽
    else if (e.t === 'skillLine' || e.t === 'skillDash') { const L = Math.hypot(e.x2 - e.x1, e.y2 - e.y1); for (let d = 0; d <= L; d += 8) circle(e.x1 + (e.x2 - e.x1) * d / L, e.y1 + (e.y2 - e.y1) * d / L, (e.w || 16) / 2); }
    else if (e.x != null) circle(e.x, e.y, 14);
    const p = this.player;
    for (const k of tiles) {
      if (e.elem === 'fire') { const x = (k % this.tw) * TILE + 8, y = Math.floor(k / this.tw) * TILE + 8; if (Math.hypot(x - p.x, y - p.y) < 15) continue; this.igniteTile(k, true); } // 내가 선 칸은 태우지 않는다
      else this.freezeTile(k);
    }
  }
  // 불이 붙는다: 그 둘레 칸 (투사체가 맞은 곳 · 날아가다 끝난 곳 · 불붙은 무기로 친 적의 발밑)
  igniteArea(x, y, r) {
    if (!this.map.outdoor || this.map.underwater) return;
    const p = this.player;
    for (let yy = y - r; yy <= y + r; yy += 8) for (let xx = x - r; xx <= x + r; xx += 8) {
      if ((xx - x) ** 2 + (yy - y) ** 2 > r * r || Math.hypot(xx - p.x, yy - p.y) < 15) continue;
      const tx = Math.floor(xx / TILE), ty = Math.floor(yy / TILE);
      if (tx >= 0 && ty >= 0 && tx < this.tw && ty < this.th) this.igniteTile(ty * this.tw + tx, true);
    }
  }
  igniteTile(k, direct = false) { // direct: 불꽃이 바로 닿았다 (낮은 풀도 반은 붙는다)
    const g = this.map.ground;
    if (this.tiles[k] === T_FLOOR && (g[k] === G.ICE || g[k] === G.THIN) && this.frozen.has(k)) { this.thawTile(k); return; }
    if (this.tiles[k] !== T_FLOOR || this.burning.has(k) || !(g[k] === G.TALL || g[k] === G.FLOWER || g[k] === G.DEADGRASS || (g[k] === G.GRASS || g[k] === G.FOREST || g[k] === G.JUNGLE) && this.rng.chance(direct ? 0.55 : 0.25))) return;
    this.burnStart(k);
  }
  burnStart(k) {
    const g = this.map.ground;
    if (!this.burnOrig.has(k)) this.burnOrig.set(k, g[k]);
    this.burning.set(k, g[k] === G.TALL ? 5.5 : g[k] === G.FLOWER || g[k] === G.DEADGRASS ? 3.5 : 2.5);
  }
  freezeTile(k) {
    const t = this.tiles[k], f = this.frozen.get(k);
    if (f) { f.t = 25; if (this.map.ground[k] === G.THIN) { this.map.ground[k] = G.ICE; this.emit({ t: 'groundChange', k }); } return; } // 다시 얼리면 시간이 처음으로
    if (t !== T_DEEP && t !== T_LIQUID) return;
    const lava = this.map.ground[k] === G.LAVA;
    this.frozen.set(k, { t: lava ? 18 : 25, tile: t, ground: this.map.ground[k], lava });
    this.tiles[k] = T_FLOOR; this.map.ground[k] = lava ? G.OBSIDIAN : G.ICE;
    if (lava) this.emit({ t: 'steamPuff', x: (k % this.tw) * TILE + 8, y: Math.floor(k / this.tw) * TILE + 8 });
    this.emit({ t: 'groundChange', k });
  }
  thawTile(k) {
    const f = this.frozen.get(k);
    if (!f) return;
    this.frozen.delete(k);
    this.tiles[k] = f.tile; this.map.ground[k] = f.ground;
    this.emit({ t: 'groundChange', k, thaw: true });
    // 녹은 물 위에 서 있으면 가까운 땅으로 밀어낸다 (물에 파묻히지 않게)
    for (const ent of [this.player, ...this.enemies]) {
      if (Math.floor(ent.x / TILE) + Math.floor(ent.y / TILE) * this.tw !== k || ent.def?.shape === 'flyer') continue;
      let best = null, bd = 1e9;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = ent.x + dx * TILE, y = ent.y + dy * TILE;
        if (!this.blocked(x, y, 4) && Math.hypot(dx, dy) < bd) { bd = Math.hypot(dx, dy); best = { x, y }; }
      }
      if (best) { ent.x = best.x; ent.y = best.y; if (ent === this.player) this.emit({ t: 'text', x: ent.x, y: ent.y - 20, text: '얼음이 녹았다!', color: '#bfe8ff' }); }
    }
  }
  updateOutdoor() {
    if (!this.map.outdoor) return;
    this.envT += DT;
    const tick = this.envT >= 0.25;
    if (tick) this.envT -= 0.25;
    const g = this.map.ground, tw = this.tw;
    for (const [k, t] of this.burning) {
      const nt = t - DT;
      if (nt <= 0) {
        this.burning.delete(k); g[k] = G.BURNT; this.burntSoil.set(k, 40 + this.rng.range(0, 15)); // 40~55초 뒤 새싹
        this.emit({ t: 'groundChange', k });
        continue;
      }
      this.burning.set(k, nt);
      if (!tick) continue;
      const x = k % tw, y = (k / tw) | 0;
      for (const o of [1, -1, tw, -tw]) {
        const j = k + o;
        if (j < 0 || j >= g.length || this.burning.has(j) || this.tiles[j] !== T_FLOOR) continue;
        if ((g[j] === G.TALL && this.rng.chance(0.04)) || (g[j] === G.FLOWER && this.rng.chance(0.025)) || (g[j] === G.DEADGRASS && this.rng.chance(0.05)) || (g[j] === G.GRASS && this.rng.chance(0.003))) this.burnStart(j);
      }
      // 옆의 나무에 옮겨 붙는다
      for (const pr of this.map.props) if (pr.kind === 'tree' && Math.abs(pr.x - x) <= 1 && Math.abs(pr.y - y) <= 1 && !this.burntTrees.has(`${pr.x},${pr.y}`) && this.rng.chance(0.08)) { this.burntTrees.add(`${pr.x},${pr.y}`); this.emit({ t: 'treeBurn', x: pr.x * TILE + 8, y: pr.y * TILE }); }
      // 불길 위에 있으면 탄다
      const cx = x * TILE + 8, cy = y * TILE + 8;
      for (const e of this.enemies) if (!e.dead && Math.abs(e.x - cx) < 10 && Math.abs(e.y - cy) < 10) this.applyStatus(e, 'burn', 1);
      const p = this.player;
      if (Math.abs(p.x - cx) < 9 && Math.abs(p.y - cy) < 9 && p.invuln <= 0) this.hurtPlayer(3, 'mag', null, { direct: true, status: 'burn' });
    }
    if (tick) {
      for (const [k, f] of this.frozen) { f.t -= 0.25; if (f.t <= 0) this.thawTile(k); else if (f.t <= 5 && this.map.ground[k] === G.ICE) { this.map.ground[k] = G.THIN; this.emit({ t: 'groundChange', k }); } }
      // 다시 자란다: 탄 땅 → 짧은 풀 → (원래 키 큰 풀 · 꽃이었으면) 원래대로
      for (const [k, t] of this.burntSoil) {
        if (t > 0.25) { this.burntSoil.set(k, t - 0.25); continue; }
        const orig = this.burnOrig.get(k) ?? G.GRASS;
        if (g[k] === G.BURNT) {
          g[k] = G.GRASS; this.emit({ t: 'groundChange', k });
          if (orig !== G.GRASS) { this.burntSoil.set(k, 35 + this.rng.range(0, 20)); continue; }
        } else if (g[k] === G.GRASS) { g[k] = orig; this.emit({ t: 'groundChange', k }); }
        this.burntSoil.delete(k); this.burnOrig.delete(k);
      }
    }
  }

  // ───────────── 타일 ─────────────
  tileAt(px, py) {
    const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
    if (x < 0 || y < 0 || x >= this.tw || y >= this.th) return T_WALL;
    return this.tiles[y * this.tw + x];
  }
  // mode: 'swim' 깊은 물도 지나간다 (용암 빼고) · 'boat' 물 위만 다닌다
  solid(px, py, mode = null) {
    const t = this.tileAt(px, py);
    if (mode === 'boat') return !this.isWaterAt(px, py, true);
    if (t === T_DEEP && mode === 'swim' && this.map.outdoor && !this.map.underwater && this.groundAt(px, py) !== G.LAVA) return false;
    return t === T_WALL || t === T_CRACK || t === T_BUILD || t === T_GATE || t === T_DEEP;
  }
  groundAt(px, py) { const g = this.map.ground; if (!g) return -1; const x = Math.floor(px / TILE), y = Math.floor(py / TILE); if (x < 0 || y < 0 || x >= this.tw || y >= this.th) return -1; return g[y * this.tw + x]; }
  isWaterAt(px, py, bridge = false) { const t = this.tileAt(px, py), gr = this.groundAt(px, py); return ((t === T_DEEP || t === T_LIQUID) && gr !== G.LAVA) || (bridge && gr === G.BRIDGE && t === T_FLOOR); }
  // 깊은 물: 누구나 헤엄치고 잠수할 수 있다 (물의 가호 · 잠수 기술 · 수중 호흡은 더 오래 · 더 빨리)
  get canSwim() { return true; }
  get canDive() { return true; }
  wallAt(px, py) { const t = this.tileAt(px, py); return t === T_WALL || t === T_CRACK || t === T_BUILD || t === T_GATE; }
  blocked(x, y, r, mode = null) {
    const s = (px, py) => this.solid(px, py, mode);
    return s(x - r, y - r) || s(x + r, y - r) || s(x - r, y + r) || s(x + r, y + r) || s(x, y - r) || s(x, y + r) || s(x - r, y) || s(x + r, y);
  }
  move(ent, dx, dy) {
    const r = Math.max(3, ent.r - 1), p = this.player;
    const mode = ent === p && this.map.outdoor && !this.map.underwater ? (p.boat ? 'boat' : this.canSwim ? 'swim' : null) : null;
    if (!this.blocked(ent.x + dx, ent.y, r, mode)) ent.x += dx;
    if (!this.blocked(ent.x, ent.y + dy, r, mode)) ent.y += dy;
  }
  // 물: 헤엄 · 배 · 바닷속 숨
  updateWater(inp) {
    const p = this.player, surface = this.map.outdoor && !this.map.underwater;
    if (p.boat) { p.boat.x = p.x; p.boat.y = p.y; p.swim = false; }
    else p.swim = surface && this.tileAt(p.x, p.y) === T_DEEP && this.groundAt(p.x, p.y) !== G.LAVA;
    if (p.swim && !this.canSwim) this.toShore('헤엄칠 수 없어 물가로 나왔다'); // 수중 호흡이 끝나면
    if (p.swim && !p.wasSwim) this.emit({ t: 'splash', x: p.x, y: p.y });
    if (p.swim) { p.swimAcc = (p.swimAcc || 0) + DT; if (p.swimAcc >= 1) { p.swimAcc = 0; this.knack('swim'); } }
    p.wasSwim = p.swim;
    if (!this.map.underwater) { p.breath = null; return; }
    const inf = !!p.buffs.waterBreath, max = ((this.b.abilities?.waterBlessing ? BREATH.blessing : this.b.available?.includes('dive') ? BREATH.dive : BREATH.free) + (this.hasKnack('swimmer') ? 6 : 0)) * this.mod('breath'); // 아무것도 없으면 숨이 짧다
    p.breathMax = max; if (p.breath == null) p.breath = max;
    const vent = this.objects.some((o) => o.kind === 'vent' && Math.hypot(o.x - p.x, o.y - p.y) < 24);
    if (inf) p.breath = max;
    else if (vent) p.breath = Math.min(max, p.breath + DT * 16);
    else p.breath = Math.max(0, p.breath - DT);
    if (p.breath <= 0) {
      p.drownT = (p.drownT || 0) - DT;
      if (p.drownT <= 0) { p.drownT = 1; this.hurtPlayer(this.d.maxHp * 0.08, 'phys', null, { direct: true }); this.emit({ t: 'text', x: p.x, y: p.y - 26, text: '숨이 막힌다!', color: '#9fd8ff' }); }
      if (p.hp < this.d.maxHp * 0.25 && !this.surfacing) { this.surfacing = true; this.signals.push({ t: 'surface', x: p.x, y: p.y, forced: true }); }
    }
  }
  // 가장 가까운 뭍으로
  toShore(text) {
    const p = this.player;
    for (let r = 8; r < 400; r += 8) for (let a = 0; a < 24; a++) {
      const x = p.x + Math.cos(a / 24 * Math.PI * 2) * r, y = p.y + Math.sin(a / 24 * Math.PI * 2) * r;
      if (!this.blocked(x, y, 4)) { p.x = x; p.y = y; p.swim = false; if (text) this.emit({ t: 'text', x, y: y - 24, text, color: '#bfe8ff' }); return; }
    }
  }
  tryDisembark() {
    const p = this.player; let best = null;
    for (let a = 0; a < 16; a++) {
      const ang = a / 16 * Math.PI * 2;
      for (const dd of [14, 20, 26]) { const x = p.x + Math.cos(ang) * dd, y = p.y + Math.sin(ang) * dd; if (!this.blocked(x, y, 4) && !this.isWaterAt(x, y)) { const sc = dd - (Math.cos(ang) * p.aimX + Math.sin(ang) * p.aimY) * 12; if (!best || sc < best.sc) best = { x, y, sc }; } }
    }
    if (!best) return false;
    const b = p.boat; b.riding = false; b.x = p.x; b.y = p.y; p.boat = null;
    p.x = best.x; p.y = best.y;
    this.emit({ t: 'boatOff', x: p.x, y: p.y });
    return true;
  }
  // 잠수: 헤엄치거나 배에 타고 있거나, 바로 앞이 깊은 물이면 바닷속으로
  tryDive(skill = false) {
    const p = this.player, say = (text) => this.emit({ t: 'text', x: p.x, y: p.y - 26, text, color: '#bfe8ff' });
    if (this.map.underwater) { if (skill) say('이미 물속이다'); return false; }
    if (!this.map.outdoor) { say('여기서는 잠수할 수 없다'); return false; }
    let x = p.x, y = p.y;
    if (!p.swim && !p.boat) {
      const fx = p.x + p.aimX * 20, fy = p.y + p.aimY * 20;
      if (this.tileAt(fx, fy) !== T_DEEP || this.groundAt(fx, fy) === G.LAVA) { say('깊은 물 가까이에서 잠수할 수 있다'); return false; }
      x = fx; y = fy;
    }
    if (!this.canDive) { say('물속에 들어갈 방법이 없다 (잠수 · 수중 호흡 · 물의 가호)'); return false; }
    this.emit({ t: 'splash', x, y, big: true });
    this.signals.push({ t: 'dive', x, y });
    return true;
  }

  reveal(force) {
    const p = this.player;
    const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE), R = this.map.outdoor ? 15 : 8; // 바깥은 눈에 보이는 만큼 지도에 남는다
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
    if (this.tower && this.state === 'play') this.tower.t += DT;
    if (this.player.ccT > 0 || this.player.down) { // 기절 (결투에서 상대의 CC를 맞았다) · 파티 탑에서 쓰러졌다: 아무것도 못 한다
      if (this.player.ccT > 0) this.player.ccT -= DT;
      input = { ...input, moveX: 0, moveY: 0, attack: false, dash: false, interact: false, skill: false, s1: false, s2: false, s3: false, s4: false, wskill: false };
    }
    if (this.state !== 'play') return;
    this.t += DT;
    if (this.clock) { this.clock.min += DT * MIN_PER_SEC; if (this.clock.min >= 1440) { this.clock.min -= 1440; this.clock.day++; } }
    this.updatePlayer(input);
    updateLife(this, input);
    this.updateDelayed();
    this.updateAllies();
    this.updateZones();
    this.updateFlow();
    this.updateEnemies();
    this.updateVillages();
    this.updateTraining();
    this.updateProjs();
    this.updateClouds();
    this.updateDrops();
    this.updateCamps();
    this.updateExplore();
    this.updateOutdoor();
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
        this.regionSeen.add(r);
        const key = placeKey(this.zone.id, info.name);
        const first = !!this.codex && !this.codex.places?.[key];
        if (first) { (this.codex.places ||= {})[key] = true; this.signals.push({ t: 'codex' }); }
        this.emit({ t: 'region', name: info.name, first, vista: info.vista });
        if (info.vista && this.story && !this.story.flags.vistaSeen) { this.story.flags.vistaSeen = true; this.emit({ t: 'vista', name: info.name }); this.signals.push({ t: 'save' }); }
      }
    }
    this.mileT -= DT;
    if (this.mileT <= 0 && !this.practice) {
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
  updatePlayer(inp0) {
    const p = this.player, d = this.d, f = this.f;
    // 캐거나 낚시하는 동안에는 걷기 · 공격 · 스킬을 쉰다 (G · 클릭은 생활 동작이 쓴다)
    const inp = p.gather || p.fish ? { ...inp0, moveX: 0, moveY: 0, attack: false, dash: false, s1: false, s2: false, s3: false, s4: false, wskill: false, skill: false, interact: false } : inp0;
    this.inpHold = inp;
    for (const k of ['atkCd', 'dashCd', 'invuln', 'hitFlash', 'lastStandCd', 'swingT', 'liquidT', 'skillCd', 'spinT', 'stealthT', 'storedT']) p[k] = Math.max(0, p[k] - DT);
    if (p.landT > 0) p.landT = Math.max(0, p.landT - DT);
    if (p.storedT <= 0) p.stored = 0;
    if (p.motion) { p.motion.t += DT; if (p.motion.t >= p.motion.dur) p.motion = null; }
    // 되감기용 기록 (0.1초마다, 4초 분량)
    p.histT -= DT;
    if (p.histT <= 0) { p.histT = 0.1; p.hist.push({ x: p.x, y: p.y, hp: p.hp }); if (p.hist.length > 40) p.hist.shift(); }
    this.updateSpirits();
    this.updateFamiliar();

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
    const fighting = this.t - (p.lastFight ?? -99) < 5, rgMul = fighting ? 0.4 : 1; // 싸우는 중에는 자연 회복이 느리다
    if (d.regen) this.heal(d.maxHp * d.regen * rgMul * DT, 'regen');
    { const rg = this.modAdd('regen'); if (rg && p.hp < d.maxHp) this.heal(d.maxHp * rg * rgMul * DT, 'regen'); } // 음식: 초당 최대 체력의 몇 %
    // 종족 자원: 시간 회복, 전투 밖 감소
    const R = this.raceRes;
    if (R) {
      if (R.regen) this.addRes(R.regen * (this.b.race === 'wizard' ? 1 + (this.s.spi || 0) / 60 : 1) * DT, true);
      if (R.decay && this.t - p.lastFight > 3 && !p.buffs.berserk) p.res = Math.max(0, p.res - R.decay * DT);
    }
    // 버프·시전·받아치기
    for (const [k, bf] of Object.entries(p.buffs)) { bf.t -= DT; if (bf.t <= 0) delete p.buffs[k]; }
    if (p.elemBonusT > 0) p.elemBonusT -= DT;
    if (p.parryT > 0) p.parryT -= DT;
    const cdRate = this.mod('cdRate');
    for (const k of Object.keys(p.cds)) { p.cds[k] -= DT * cdRate; if (p.cds[k] <= 0) delete p.cds[k]; }
    if (p.potionCd > 0) p.potionCd -= DT; // 물약은 한 번 마시면 8초 뒤에 다시
    if (this.practice) { if (this.practice.infRes) p.res = 100; p.hp = d.maxHp; }
    if (p.dashCharges < 1) {
      p.dashRecharge -= DT;
      if (p.dashRecharge <= 0) { p.dashCharges++; p.dashRecharge = d.dashCd * (1 - d.cdr); }
    }
    if (this.mode === 'plaza') p.hp = d.maxHp;


    // 지형 효과
    p.onLiquid = this.tileAt(p.x, p.y + 3) === T_LIQUID;
    if (p.onLiquid && this.zone) {
      const og = this.map.outdoor ? this.map.ground[Math.floor((p.y + 3) / TILE) * this.tw + Math.floor(p.x / TILE)] : -1;
      const lq = og === G.LAVA ? 'lava' : og === G.BOG ? 'bog' : this.zone.liquid;
      if (lq === 'bog') { slow = Math.max(slow, 0.45); if (p.liquidT <= 0) { p.liquidT = 1.2; if (this.rng.chance(0.35)) this.applyPlayerStatus('poison', 20); } }
      if (lq === 'water') slow = Math.max(slow, 0.35);
      if (lq === 'snow') slow = Math.max(slow, 0.25);
      if (lq === 'lava' && p.liquidT <= 0) { p.liquidT = 0.8; this.hurtPlayer(6 + this.zone.floor * 4, 'mag', null, { direct: true, status: 'burn' }); }
    }

    this.autoAim = inp.autoAim !== false;
    const locked = (p.motion && p.motion.lock) || p.windupT > 0 || p.castT > 0 || p.channel;
    if (!locked) {
      const ax = inp.aimX - p.x, ay = inp.aimY - p.y, al = Math.hypot(ax, ay) || 1;
      p.aimX = ax / al; p.aimY = ay / al;
      this.aimDist = al;
      if (Math.abs(p.aimX) > 0.1) p.dir = p.aimX > 0 ? 1 : -1;
    }

    this.updateWater(inp);
    let mx = inp.moveX, my = inp.moveY; const ml = Math.hypot(mx, my);
    if (ml > 0) { mx /= ml; my /= ml; }
    p.moving = ml > 0;
    if (p.moving) p.walkT += DT;
    // 대검 차지 · 돌격 · 도약 · 비상: 이동을 직접 다룬다
    const special = this.updateSpecialMove(inp, mx, my, ml);
    if (special) { /* 이동 처리 끝 */ }
    else if (p.dashT > 0) {
      p.dashT -= DT;
      this.move(p, p.dvx * DT, p.dvy * DT);
    } else {
      const aiming = this.f.has('aimSlow') && (inp.attack || p.atkCd > 0.05);
      const water = p.boat ? 150 / Math.max(1, d.moveSpeed) : p.swim ? (this.b.abilities?.waterBlessing ? 0.8 : 0.55) * (this.hasKnack('swimmer') ? 1.3 : 1) : this.map.underwater ? 0.8 : 1;
      const spd = p.castT > 0 ? 0 : d.moveSpeed * this.mod('moveSpeed') * (p.boat ? 1 : 1 - slow) * (aiming ? d.aimSlow : 1) * (p.channel ? 0.5 : 1) * (p.charging ? 0.4 : 1) * this.predatorSpeed(mx, my, ml) * water;
      this.move(p, mx * spd * DT, my * spd * DT);
      if (inp.dash && p.boat && this.canSwim) { p.boat.riding = false; p.boat = null; this.emit({ t: 'splash', x: p.x, y: p.y }); } // 배에서 물로 뛰어든다
      else if (inp.dash && (p.boat || p.swim)) { /* 물 위에서는 대시가 없다 */ }
      else if (inp.dash && p.dashCharges > 0 && p.dashCd <= 0) {
        const dx = ml > 0 ? mx : p.aimX, dy = ml > 0 ? my : p.aimY;
        p.dashT = 0.16; p.dvx = dx * 400; p.dvy = dy * 400; p.invuln = Math.max(p.invuln, 0.22);
        p.dashCharges--; if (p.dashRecharge <= 0) p.dashRecharge = d.dashCd * (1 - d.cdr);
        this.knack('dash');
        if (p.castT > 0) { p.castT = 0; p.castSkill = null; this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '시전 취소', color: '#a8b0c0' }); }
        if (this.raceRes?.dash) this.addRes(this.raceRes.dash);
        p.dashCd = 0.25;
        if (f.has('dashCrit')) p.dashCritReady = true;
        this.emit({ t: 'dash', x: p.x, y: p.y, dx, dy });
        if (f.has('dashAfterimage')) this.afterimage(p.x, p.y, p.x + dx * 64, p.y + dy * 64);
        for (const tr of this.b.triggers.dash) if (this.rng.chance(tr.chance)) this.doAction(tr.action, null, p);
      }
    }

    // 숲의 사수: 가만히 서 있으면 집중
    if (this.b.cls === 'ranger') {
      if (p.moving && p.dashT <= 0) { p.focusT = 0; if (!p.focusKeep) p.focus = 0; }
      else { p.focusT += DT; if (p.focusT >= 0.5) { p.focusT = 0; if (p.focus < 3) { p.focus++; this.emit({ t: 'focus', x: p.x, y: p.y, n: p.focus }); } } }
      if (p.dashT <= 0 && p.moving) p.focusKeep = false;
    }
    p.attackHeld = !!inp.attack;
    if (p.pendingDouble >= 0) { p.pendingDouble -= DT; if (p.pendingDouble < 0) this.attack(0.12); }
    if (inp.attack && p.atkCd <= 0 && p.castT <= 0 && !p.channel && !p.charging && !p.rush && !p.leap && !(p.windupT > 0) && !p.swim && !p.combo && !p.fallInto && !p.drop && !p.hop) {
      const mom = this.mod('atkSpeed');
      p.atkCd = 1 / (this.b.weapon.speed * d.atkSpeed * mom);
      p.atkPeriod = p.atkCd;
      this.attack(0);
      if (f.has('doubleAttack') && this.rng.chance(0.3)) p.pendingDouble = 0.08;
    }

    const slots = this.b.skills || [];
    for (let i = 0; i < 4; i++) if (inp['s' + (i + 1)] && slots[i]) this.castSkillId(slots[i], i);
    if (inp.wskill) this.castSkillId('weapon');
    if (inp.skill && slots[0]) this.castSkillId(slots[0]);
    if (p.whirlT > 0) this.tickWhirl();
    if (p.castT > 0) {
      p.castT -= DT;
      if (p.castT <= 0 && p.castSkill) { const cs = p.castSkill; p.castSkill = null; this.execSkill(cs.def, cs.spent, cs.id); }
    }
    if (p.channel) this.tickChannel();

    // 집 안: 아래쪽 문으로 걸어 나가면 밖으로
    if (this.map.indoor && p.y > (this.th - 1) * TILE + 3 && !this.exiting) { this.exiting = true; this.signals.push({ t: 'exitHouse' }); }
    // 상호작용 대상
    this.near = null;
    let bd = 1e9;
    for (const o of this.objects) {
      if (o.opened && !o.reusable) continue;
      if (o.noPrompt || o.riding) continue;
      const dd = Math.hypot(o.x - p.x, o.y - p.y);
      if (o.hidden && !o.found) { if (dd < 30) { o.found = true; this.emit({ t: 'text', x: o.x, y: o.y - 18, text: '숨겨진 상자를 찾았다!', color: '#ffe8a0' }); this.emit({ t: 'ring', x: o.x, y: o.y, r: 22, color: '#ffe8a0' }); } else continue; }
      if (dd < (o.reach || 26) && dd < bd) { bd = dd; this.near = o; } // 계산대 너머의 주인처럼 멀리서도 닿는 것은 reach
    }
    if (this.near && (this.near.kind === 'node' || this.near.kind === 'dig') && this.near.depleted) this.near = null;
    this.act = this.near || p.swim ? null : lifeAction(this); // 나무 · 밭 · 물가
    if (!this.near && !this.act) this.waterAct = p.boat ? (this.canLand() ? '배에서 내리기' : null) : p.swim && this.canDive ? '잠수하기' : this.map.underwater ? '물 위로 떠오르기' : null;
    else this.waterAct = p.boat && this.canLand() ? '배에서 내리기' : null;
    if (inp.interact) {
      if (p.boat && this.canLand() && !this.near) this.tryDisembark();
      else if (this.near) this.interact(this.near);
      else if (this.act) startAction(this, this.act);
      else if (p.swim) this.tryDive();
      else if (this.map.underwater) this.signals.push({ t: 'surface', x: p.x, y: p.y });
    }
  }

  // ───── 성지 마을 ─────
  addVillage(race, v) {
    const L = SANCT_LIFE[race];
    if (!L) return;
    if (v.leader) this.objects.push({ kind: 'leader', race, x: v.leader.x, y: v.leader.y, art: L.leader, label: `${L.leader.name}에게 말 걸기`, reusable: true, npc: { name: L.leader.name } });
    for (const r of v.residents) {
      const rd = L.residents[r.i];
      this.objects.push({ kind: 'resident', race, idx: r.i, x: r.x, y: r.y, hx: r.x, hy: r.y, pat: r.pat, rd, face: rd.face || 1, phase: this.rng.range(0, 6), label: `${rd.name}에게 말 걸기`, reusable: true, npc: { name: rd.name } });
    }
    if (v.board) this.objects.push({ kind: 'trainBoard', race, x: v.board.x, y: v.board.y, label: `수련장 · ${L.train.name}`, reusable: true });
  }
  // 주민: 돌아다니는 사람은 집 둘레를 천천히 거닌다 (말할 때는 멈춘다). 가까이 있을 때만
  updateVillages() {
    if (!this.map.villages) return;
    const p = this.player;
    for (const o of this.objects) {
      if (o.kind !== 'resident' || Math.abs(o.x - p.x) > 520 || Math.abs(o.y - p.y) > 400) continue;
      if (o.say) { o.say.t -= DT; if (o.say.t <= 0) o.say = null; o.moving = false; continue; }
      const act = o.rd.act;
      if (act !== 'wander' && act !== 'patrol' && act !== 'tend') continue;
      o.wt = (o.wt ?? this.rng.range(0, 2)) - DT;
      if (!o.goal || o.wt <= 0) {
        o.wt = 2 + this.rng.next() * 3;
        if (act === 'patrol') o.goal = { x: o.hx + (o.side = -(o.side || 1)) * 3 * TILE, y: o.hy };
        else if (act === 'tend' && o.pat) o.goal = this.rng.chance(0.5) ? { x: o.hx, y: o.hy } : { x: o.pat.x + this.rng.range(-10, 10), y: o.pat.y + 10 };
        else o.goal = { x: o.hx + this.rng.range(-2.5, 2.5) * TILE, y: o.hy + this.rng.range(-1.5, 1.5) * TILE };
      }
      const dx = o.goal.x - o.x, dy = o.goal.y - o.y, dl = Math.hypot(dx, dy);
      if (dl > 2 && o.wt < 4.2) {
        const sp = (act === 'patrol' ? 26 : 18) * DT * (o.rd.small ? 1.3 : 1), nx = o.x + (dx / dl) * sp, ny = o.y + (dy / dl) * sp;
        if (!this.blocked(nx, ny, 5) && Math.hypot(nx - p.x, ny - p.y) > 10) { o.x = nx; o.y = ny; o.moving = true; if (Math.abs(dx) > 1) o.face = Math.sign(dx); } else { o.goal = null; o.moving = false; }
      } else o.moving = false;
    }
  }
  // 성지 의뢰: 잡은 몬스터가 맡은 의뢰의 대상이면 센다
  sanctKill(e) {
    const all = this.story?.sanct;
    if (!all) return;
    for (const [race, st] of Object.entries(all)) {
      const q = st.cur, def = q && !q.done && sanctQuestDef(race, q.id);
      if (!def || def.kind !== 'kill' || !def.targets.includes(e.defId)) continue;
      q.progress = Math.min(def.n, (q.progress || 0) + 1);
      if (q.progress >= def.n) { q.done = true; this.signals.push({ t: 'sanctQuestDone', race }); }
      else this.emit({ t: 'text', x: e.x, y: e.y - 30, text: `${def.title} ${q.progress}/${def.n}`, color: SANCTUMS[race].color });
    }
  }
  // '찾기' 의뢰의 물건을 세계에 놓는다 (이미 찾은 것은 빼고)
  syncQuestThings() {
    this.objects = this.objects.filter((o) => o.kind !== 'questThing');
    if (!this.story?.sanct || !this.map.outdoor) return;
    for (const [race, st] of Object.entries(this.story.sanct)) {
      const q = st.cur, def = q && sanctQuestDef(race, q.id);
      if (!def || def.kind !== 'find' || q.done || !q.spots) continue;
      q.spots.forEach(([tx, ty], i) => { if (!(q.found || []).includes(i)) this.objects.push({ kind: 'questThing', race, idx: i, look: def.look, x: tx * TILE + 8, y: ty * TILE + 8, label: `${FIND_NAME[def.look]} 살펴보기`, reusable: true }); });
    }
  }
  findQuestThing(o) {
    this.objects = this.objects.filter((x) => x !== o);
    const q = this.story?.sanct?.[o.race]?.cur, def = q && sanctQuestDef(o.race, q.id);
    if (!def || q.done) return;
    q.found ||= []; if (!q.found.includes(o.idx)) q.found.push(o.idx);
    q.progress = q.found.length;
    this.emit({ t: 'questFind', x: o.x, y: o.y, look: o.look, color: SANCTUMS[o.race].color });
    if (q.progress >= def.n) { q.done = true; this.signals.push({ t: 'sanctQuestDone', race: o.race }); }
    else this.emit({ t: 'text', x: o.x, y: o.y - 24, text: `${FIND_NAME[o.look]} ${q.progress}/${def.n}`, color: SANCTUMS[o.race].color });
  }
  // 찾을 물건 자리: 그 성지의 땅에서, 걸어서 닿고 서로 떨어진 곳
  pickQuestSpots(race, n) {
    const m = this.map, bi = BIOME_LIST.findIndex((b) => b.id === SANCTUMS[race]?.biome), door = m.villages?.[race]?.door;
    if (bi < 0 || !m.biome) return [];
    const reach = this.reachMap(), out = [];
    for (let a = 0; a < 30000 && out.length < n; a++) {
      const x = 4 + Math.floor(this.rng.next() * (this.tw - 8)), y = 4 + Math.floor(this.rng.next() * (this.th - 8)), k = y * this.tw + x;
      if (m.biome[k] !== bi || this.tiles[k] !== T_FLOOR || !reach[k]) continue;
      if (door && Math.hypot(x * TILE - door.x, y * TILE - door.y) < 20 * TILE) continue;
      if (out.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < 14)) continue;
      if (this.objects.some((o) => Math.abs(o.x - (x * TILE + 8)) < 28 && Math.abs(o.y - (y * TILE + 8)) < 28)) continue;
      out.push([x, y]);
    }
    return out;
  }
  reachMap() { // 마을에서 걸어서 닿는 칸 (처음 한 번만 센다)
    if (this._reach) return this._reach;
    const W = this.tw, H = this.th, seen = new Uint8Array(W * H), q = new Int32Array(W * H);
    let qh = 0, qt = 0;
    const s0 = Math.floor(this.map.start.y) * W + Math.floor(this.map.start.x); seen[s0] = 1; q[qt++] = s0;
    while (qh < qt) {
      const i = q[qh++], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx, v = this.tiles[j]; if (!seen[j] && (v === T_FLOOR || v === T_LIQUID)) { seen[j] = 1; q[qt++] = j; } }
    }
    return (this._reach = seen);
  }

  // ───── 성지 수련: 종족마다 방식이 다르고, 단계가 오를수록 빡빡해진다 (내 종족은 두 단계 쉽게) ─────
  startTraining(race) {
    const v = this.map.villages?.[race], L = SANCT_LIFE[race];
    if (!v || !L || this.training) return false;
    const rank = this.story?.sanct?.[race]?.train || 0, own = this.b.race === race;
    const T = trainSpec(race, rank, own), d = this.d, atk = Math.max(d.physAtk || 0, d.magAtk || 0, 10), p = this.player;
    p.x = v.train.x; p.y = v.train.y + 10; p.dashT = 0;
    if (this.blocked(p.x, p.y, 5)) p.y = v.train.y; p.channel = null; p.motion = null;
    this.training = { race, mode: T.mode, kind: T.kind, look: T.look, foe: T.foe, n: T.n || 0, time: T.time, t: T.time, ready: 1.6, got: 0, dealt: 0, need: T.mode === 'guard' ? Math.round(atk * T.needMul) : 0, cx: v.train.x, cy: v.train.y, r: v.train.r, atk, spec: T, rank, own, next: 1, guard: 0, guardT: T.sw || 0 };
    const tr = this.training;
    if (T.mode === 'guard') tr.posts = [-1, 1].map((sd) => { const q = this.trainNear(v.train.x + sd * 36, v.train.y - 6); return this.spawnTrain('trainPost', q.x, q.y); });
    if (T.mode === 'keepLit') tr.braziers = Array.from({ length: T.k }, (_, i) => { const a = -Math.PI / 2 + (i / T.k) * Math.PI * 2, q = this.trainNear(v.train.x + Math.cos(a) * v.train.r * 0.62, v.train.y + Math.sin(a) * v.train.r * 0.46); return this.spawnTrain('trainPost', q.x, q.y); });
    this.emit({ t: 'trainStart', race, x: p.x, y: p.y });
    return true;
  }
  spawnTrain(id, x, y) {
    const tr = this.training, sp = tr.spec, e = this.makeEnemy(id, x, y, { noAffix: true });
    e.training = true; e.look = tr.look; e.home = { x, y }; e.born = this.t;
    if (id !== 'trainTarget' && id !== 'trainPost') {
      e.trainee = true; e.maxHp = e.hp = Math.round(tr.atk * (sp.hpMul || 2.6)); e.atk = Math.max(2, Math.round(tr.atk * (sp.atkMul ?? 0.08))); e.state = 'chase';
      if (tr.mode === 'flee') { e.trainFlee = true; e.atk = 0; e.state = 'idle'; }
    }
    this.enemies.push(e);
    this.emit({ t: 'trainPop', x, y, look: tr.look, trainee: !!e.trainee });
    return e;
  }
  // 수련 상대를 둘 수 있는 곳: 벽 · 물 · 용암 위가 아니고, 수련장 가운데에서 벽에 막히지 않고 보이는 곳
  trainOk(x, y, cx, cy) {
    const t = this.tileAt(x, y);
    return !this.blocked(x, y, 8) && t !== T_LIQUID && t !== T_DEEP && this.clearLine(cx, cy, x, y);
  }
  // 그 근처에서 둘 수 있는 가장 가까운 곳
  trainNear(x, y) {
    const tr = this.training;
    if (this.trainOk(x, y, tr.cx, tr.cy)) return { x, y };
    for (let r = 8; r <= 80; r += 8) for (let a = 0; a < 12; a++) { const nx = x + Math.cos(a * Math.PI / 6) * r, ny = y + Math.sin(a * Math.PI / 6) * r; if (this.trainOk(nx, ny, tr.cx, tr.cy)) return { x: nx, y: ny }; }
    return { x: tr.cx, y: tr.cy };
  }
  trainSpot() { // 수련장 안의 빈 곳 (나와 너무 붙지 않게)
    const tr = this.training, p = this.player;
    for (let a = 0; a < 60; a++) {
      const an = this.rng.range(0, Math.PI * 2), rr = tr.r * (0.3 + this.rng.next() * 0.65), x = tr.cx + Math.cos(an) * rr, y = tr.cy + Math.sin(an) * rr * 0.75;
      if (this.trainOk(x, y, tr.cx, tr.cy) && Math.hypot(x - p.x, y - p.y) > 40 && !this.enemies.some((e) => e.training && !e.dead && Math.hypot(e.x - x, e.y - y) < 26)) return { x, y };
    }
    return this.trainNear(tr.cx, tr.cy - 30);
  }
  updateTraining() {
    const tr = this.training;
    if (!tr) return;
    const p = this.player, sp = tr.spec;
    if (tr.ready > 0) { tr.ready -= DT; if (tr.ready <= 0) this.emit({ t: 'trainGo', x: p.x, y: p.y }); return; }
    tr.t -= DT;
    const alive = this.enemies.filter((e) => e.training && !e.dead);
    if (tr.mode === 'order') { // 한 묶음을 다 맞히면 다음 묶음 (번호 1부터)
      const left = tr.n - tr.got;
      if (!alive.length && left > 0) { const m = Math.min(sp.set, left); for (let i = 0; i < m; i++) { const s2 = this.trainSpot(), e = this.spawnTrain('trainTarget', s2.x, s2.y); e.num = i + 1; } tr.next = 1; }
    } else if (tr.mode === 'slide' || tr.mode === 'decoy') {
      if (tr.mode === 'decoy') for (const e of alive) if (this.t - e.born > sp.life) { e.dead = true; this.emit({ t: 'trainVanish', x: e.x, y: e.y }); }
      if (tr.mode === 'slide') for (const e of alive) { // 좌우로 미끄러진다 (막히면 그 자리에)
        const nx = e.home.x + Math.sin((this.t - e.born) * sp.speed * 2 + (e.ph || 0)) * sp.amp;
        if (!this.blocked(nx, e.y, 6)) e.x = nx;
      }
      const live = alive.filter((e) => !e.dead), left = tr.n - tr.got;
      for (let i = live.length; i < Math.min(3, left); i++) {
        const s2 = this.trainSpot(), e = this.spawnTrain('trainTarget', s2.x, s2.y);
        e.ph = this.rng.range(0, Math.PI * 2);
        if (tr.mode === 'decoy') e.decoy = live.some((o) => !o.decoy) && this.rng.chance(sp.decoy); // 진짜가 하나도 없게 두지는 않는다
        live.push(e);
      }
    } else if (tr.kind === 'waves') {
      for (const e of alive) if (e.bones > 0 && (e.bones -= DT) <= 0) { e.bones = 0; e.hp = e.maxHp * 0.6; e.state = 'chase'; this.emit({ t: 'trainRise', x: e.x, y: e.y }); } // 뼈 무더기가 다시 일어선다
      if (tr.mode === 'flee') for (const e of alive) this.trainFleeStep(e, sp);
      const live = alive.length, left = tr.n - tr.got - live;
      tr.spawnCd = (tr.spawnCd || 0) - DT;
      if (live < (sp.live || 3) && left > 0 && tr.spawnCd <= 0) {
        tr.spawnCd = 0.7;
        const an = this.rng.range(0, Math.PI * 2), x = tr.cx + Math.cos(an) * tr.r * 0.9, y = tr.cy + Math.sin(an) * tr.r * 0.7;
        const s2 = this.trainOk(x, y, tr.cx, tr.cy) ? { x, y } : this.trainSpot(), e = this.spawnTrain(tr.foe, s2.x, s2.y);
        if (sp.champion && left === 1) { e.champ = true; e.maxHp = e.hp = e.maxHp * 3; e.atk = Math.round(e.atk * 1.4); e.scale = 1.4; e.r *= 1.3; this.emit({ t: 'text', x: e.x, y: e.y - 26, text: '투기장 챔피언!', color: '#ff8a5a' }); }
      }
    } else if (tr.mode === 'guard' && sp.sw) { // 방패가 다른 허수아비로 옮겨 간다
      if ((tr.guardT -= DT) <= 0) { tr.guardT = sp.sw; tr.guard = 1 - tr.guard; this.emit({ t: 'trainGuard', x: tr.posts[tr.guard].x, y: tr.posts[tr.guard].y }); }
      tr.posts.forEach((e, i) => { e.guarded = i === tr.guard; });
    } else if (tr.mode === 'keepLit') { // 불이 꺼지기 전에 모두 타오르게
      for (const e of tr.braziers) if (e.lit > 0 && (e.lit -= DT) <= 0) { e.lit = 0; this.emit({ t: 'trainOut', x: e.x, y: e.y }); }
      tr.got = tr.braziers.filter((e) => e.lit > 0).length;
    }
    if (tr.mode === 'guard' ? tr.dealt >= tr.need : tr.got >= tr.n) return this.endTraining(true);
    if (tr.t <= 0) return this.endTraining(false, '시간이 다 됐다');
    if (Math.hypot(p.x - tr.cx, p.y - tr.cy) > tr.r * 2.4) return this.endTraining(false, '수련장을 벗어났다');
  }
  // 달아나는 랩터: 나를 등지고 달리다가 수련장 가장자리에 닿으면 가장자리를 따라 돈다. 얼거나 묶이면 멈춘다
  trainFleeStep(e, sp) {
    const p = this.player, tr = this.training;
    if (e.st.stun > 0 || e.st.frozen > 0 || e.rooted > 0) { e.moving = false; return; }
    const dx = e.x - p.x, dy = e.y - p.y, dd = Math.hypot(dx, dy) || 1;
    let vx = dx / dd, vy = dy / dd;
    const ox = e.x - tr.cx, oy = (e.y - tr.cy) / 0.75, od = Math.hypot(ox, oy) || 1;
    if (od > tr.r * 0.78) { const tx = -oy / od, ty = (ox / od) * 0.75, sd = tx * vx + ty * vy >= 0 ? 1 : -1; vx = vx * 0.25 + tx * sd - (ox / od) * 0.6; vy = vy * 0.25 + ty * sd - (oy / od) * 0.45; }
    const vl = Math.hypot(vx, vy) || 1, spd = Math.min(sp.speed, this.d.moveSpeed * 0.92) * (e.st.chill ? 0.55 : 1) * (dd < 120 ? 1 : 0.3);
    this.move(e, (vx / vl) * spd * DT, (vy / vl) * spd * DT);
    e.dir = vx < 0 ? -1 : 1; e.moving = spd > 1; e.walkT = (e.walkT || 0) + DT;
  }
  // 수련 상대에게 피해가 들어갈 때 (허수아비 · 화로)
  trainDamage(e, dmg) {
    const tr = this.training;
    if (tr.mode === 'guard') tr.dealt += dmg * (e.guarded ? 0.15 : 1);
    else if (tr.mode === 'keepLit' && e.look === 'brazier') { if (!(e.lit > 0)) this.emit({ t: 'trainLight', x: e.x, y: e.y }); e.lit = tr.spec.burn; }
  }
  // 수련 상대가 쓰러질 때: false면 쓰러지지 않는다 (순서가 틀림 · 가짜 · 뼈 무더기로 남음)
  trainKill(e) {
    const tr = this.training, sp = tr.spec;
    const back = (why, color, lose = 0) => { e.dead = false; e.hp = e.maxHp; if (lose) tr.t -= lose; this.emit({ t: 'text', x: e.x, y: e.y - 22, text: why, color }); this.emit({ t: 'trainMiss', x: e.x, y: e.y }); return false; };
    if (tr.mode === 'order' && e.num !== tr.next) return back(`순서! (${tr.next}번 먼저) -${sp.penalty}초`, '#ff9a7a', sp.penalty);
    if (tr.mode === 'decoy' && e.decoy) { this.emit({ t: 'trainVanish', x: e.x, y: e.y }); tr.t -= sp.penalty; this.emit({ t: 'text', x: e.x, y: e.y - 22, text: `가짜! -${sp.penalty}초`, color: '#ff7a7a' }); return false; }
    if (tr.mode === 'revive' && e.trainee && !e.revived && this.rng.chance(sp.revive)) { e.dead = false; e.hp = 1; e.revived = true; e.bones = sp.boneT; e.state = 'idle'; this.emit({ t: 'trainBones', x: e.x, y: e.y }); return false; }
    if (tr.mode === 'order') tr.next++;
    return true;
  }
  endTraining(ok, why) {
    const tr = this.training;
    if (!tr) return;
    for (const e of this.enemies) if (e.training) e.dead = true;
    this.training = null;
    this.emit({ t: 'trainEnd', ok, x: this.player.x, y: this.player.y });
    this.signals.push({ t: 'trainingDone', race: tr.race, ok, why, got: tr.got, n: tr.n, dealt: Math.round(tr.dealt), need: tr.need });
  }

  // 이동 포탈로 건너간다: 도착한 포탈 바로 앞(남쪽)에 선다. 부하 · 소환수도 함께 온다
  teleportTo(id) {
    const o = this.objects.find((q) => q.kind === 'waypoint' && q.id === id && q.active), p = this.player;
    if (!o || p.boat || p.swim) return false;
    this.emit({ t: 'wpLeave', x: p.x, y: p.y });
    let x = o.x, y = o.y + 18;
    if (this.blocked(x, y, p.r)) for (let a = 0; a < 16; a++) { const tx = o.x + Math.cos((a / 16) * Math.PI * 2) * 24, ty = o.y + 6 + Math.sin((a / 16) * Math.PI * 2) * 20; if (!this.blocked(tx, ty, p.r)) { x = tx; y = ty; break; } }
    p.x = x; p.y = y; p.dashT = 0; p.dvx = 0; p.dvy = 0; p.channel = null; p.motion = null; p.combo = null; p.dance = null; p.rush = null; p.leap = null; p.soar = null;
    for (const al of this.allies) { al.x = x + this.rng.range(-16, 16); al.y = y + 8 + this.rng.range(0, 10); }
    for (const e of this.enemies) if (e.state === 'chase') { e.state = 'idle'; e.leashT = 0; } // 쫓던 적은 놓친다
    this.reveal(true);
    this.emit({ t: 'wpArrive', x, y, ox: o.x, oy: o.y });
    return true;
  }

  canLand() {
    const p = this.player;
    for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2; const x = p.x + Math.cos(ang) * 20, y = p.y + Math.sin(ang) * 20; if (!this.blocked(x, y, 4) && !this.isWaterAt(x, y)) return true; }
    return false;
  }
  interact(o) {
    if (o.kind === 'portal') { this.state = 'done'; return; }
    if (o.kind === 'boat') { const p = this.player; p.boat = o; o.riding = true; p.x = o.x; p.y = o.y; p.swim = false; this.emit({ t: 'boatOn', x: o.x, y: o.y }); return; }
    if (o.kind === 'palaceGate') { this.signals.push({ t: 'enterZone', entrance: 'palace', x: o.x, y: o.y }); return; }
    if (o.kind === 'node' || o.kind === 'dig') { startAction(this, o); return; }
    if (o.kind === 'gate') { this.signals.push({ t: 'enterZone', zone: o.zone }); return; }
    if (o.kind === 'station' && o.station === 'bed') { this.signals.push({ t: 'sleep' }); return; }
    if (o.kind === 'station') { this.signals.push({ t: 'openPanel', panel: o.panel }); return; }
    if (o.kind === 'camp') {
      // 야영지: 지금까지 모은 잔향과 골드를 맡긴다 (죽어도 잃지 않음) + 처음 한 번 체력 회복
      this.loot.banked = { echoes: { ...this.loot.echoes }, gold: this.loot.gold };
      if (!o.rested) { o.rested = true; this.player.hp = this.d.maxHp; }
      this.emit({ t: 'camp', x: o.x, y: o.y });
      this.emit({ t: 'text', x: o.x, y: o.y - 20, text: '잔향을 맡겼다', color: '#ffd88a' });
      return;
    }
    if (o.kind === 'merchant') { this.signals.push({ t: 'merchant', zone: this.zone.id, depth: this.depth }); return; }
    if (o.kind === 'npc') { this.signals.push({ t: 'npc', id: o.id }); return; }
    if (o.kind === 'entrance') {
      if (ENTRANCES[o.id]?.prop === 'hole') { const p = this.player; p.fallInto = { t: 0, dur: 0.75, x0: p.x, y0: p.y, tx: o.x, ty: o.y - 14, id: o.id, ox: o.x, oy: o.y }; this.motion('leap', 0.4); this.emit({ t: 'hopStart', x: p.x, y: p.y }); return; }
      this.signals.push({ t: 'enterZone', entrance: o.id, x: o.x, y: o.y }); return;
    }
    if (o.kind === 'door') { this.signals.push({ t: 'enterHouse', house: o.house, x: o.x, y: o.y }); return; }
    if (o.kind === 'exit') { this.signals.push({ t: 'exitHouse' }); return; }
    if (o.kind === 'sanctum') { this.signals.push({ t: 'sanctum', race: o.race }); return; }
    if (o.kind === 'relic') { o.opened = true; this.emit({ t: 'ring', x: o.x, y: o.y - 14, r: 30, color: '#ffe8a8' }); this.signals.push({ t: 'relic', race: o.race, rid: o.rid }); return; }
    if (o.kind === 'sign') { this.signals.push({ t: 'sign', text: o.text }); return; }
    if (o.kind === 'turtle') { this.signals.push({ t: 'turtle' }); return; }
    if (o.kind === 'skillStone') { this.signals.push({ t: 'skillStone', skill: o.skill }); this.emit({ t: 'stoneRead', x: o.x, y: o.y, skill: o.skill }); return; }
    if (o.kind === 'waterSpirit') { this.signals.push({ t: 'waterSpirit' }); return; }
    if (o.kind === 'leader') { this.signals.push({ t: 'sanctLeader', race: o.race }); return; }
    if (o.kind === 'resident') { // 주민: 말을 걸면 돌아보고 한마디 한다 (말풍선)
      const L = SANCT_LIFE[o.race], talk = [...L.talk, ...(RACE_STORY[o.race]?.gossip || [])]; // 사는 이야기 + 다른 종족 소문
      o.sayN = (o.sayN ?? o.idx) + 1; o.say = { text: talk[o.sayN % talk.length], t: 3.6 };
      o.face = Math.sign(this.player.x - o.x) || o.face || 1; this.emit({ t: 'npcTalk', x: o.x, y: o.y });
      return;
    }
    if (o.kind === 'trainBoard') { this.signals.push({ t: 'sanctTrain', race: o.race }); return; }
    if (o.kind === 'questThing') { this.findQuestThing(o); return; }
    if (o.kind === 'waypoint') { // 이동 포탈: 처음 만지면 깨어나고, 깨어난 포탈에서는 다른 포탈로 건너간다
      if (!o.active) {
        o.active = true; o.label = '이동 포탈 · 다른 포탈로 가기';
        if (this.story) this.story.flags[`wp:${o.id}`] = 1;
        this.emit({ t: 'wpOpen', x: o.x, y: o.y });
        this.signals.push({ t: 'waypointOpen', id: o.id, name: o.name });
        return;
      }
      this.signals.push({ t: 'waypoint', id: o.id }); return;
    }
    if (o.kind === 'rest') { this.player.hp = this.d.maxHp; this.emit({ t: 'camp', x: o.x, y: o.y }); this.signals.push({ t: 'rest' }); return; }
    if (o.kind === 'caveDoor') { this.signals.push({ t: 'enterZone', zone: o.zone, from: 'cave' }); return; }
    if (o.kind === 'towerDoor') { this.signals.push({ t: 'tower' }); return; } // 각인의 탑 50층 (예전 층 고르기는 보류)
    if (o.kind === 'journal') {
      if (this.codex && !this.codex.journals?.[o.id]) { (this.codex.journals ||= {})[o.id] = true; this.signals.push({ t: 'codex' }); this.emit({ t: 'text', x: o.x, y: o.y - 18, text: '기록 도감에 남겼다', color: '#e8d8a8' }); }
      o.read = true;
      this.signals.push({ t: 'journal', id: o.id });
      return;
    }
    if (o.kind === 'barrier') {
      const def = BARRIERS[o.id], p = this.player, st = this.story;
      let ok = false;
      if (def.oneway) ok = o.from === 'north' ? p.y < o.y : o.from === 'south' ? p.y > o.y : o.from === 'west' ? p.x < o.x : p.x > o.x;
      else if (def.need && st && (st.items[def.need] || 0) > 0) { ok = true; if (!def.keep) st.items[def.need]--; }
      if (!ok) { this.emit({ t: 'text', x: o.x, y: o.y - 22, text: def.locked, color: '#d8c8a8' }); this.emit({ t: 'locked', x: o.x, y: o.y }); return; }
      this.openBarrier(o);
      this.emit({ t: 'banner', text: def.name, sub: def.open, color: '#e8dcc0' });
      return;
    }
    if (o.kind === 'stairs') {
      if (this.tower) { // 탑: 수호자를 쓰러뜨려야 계단이 열린다
        if (this.tower.boss && !this.tower.boss.dead) { this.emit({ t: 'text', x: o.x, y: o.y - 22, text: '층 수호자를 쓰러뜨려야 계단이 열린다', color: '#ff9a7a' }); return; }
        if (this.coop?.role === 'member') { this.signals.push({ t: 'coStairs' }); this.emit({ t: 'text', x: o.x, y: o.y - 22, text: '계단에 닿았다 — 다 같이 오른다', color: '#9fe6ff' }); return; } // 파티 탑: 층을 깨는 건 파티장의 세계
        this.signals.push({ t: 'towerClear', f: this.tower.f, time: this.tower.t, hurt: this.tower.hurt, maxHp: this.d.maxHp }); return;
      }
      if (this.coop?.role === 'member') { this.emit({ t: 'text', x: o.x, y: o.y - 22, text: '파티장이 내려가면 다 같이 내려간다', color: '#9fe6ff' }); return; }
      this.signals.push({ t: 'descend' }); return;
    }
    if (o.kind === 'shrine') {
      o.opened = true;
      const opts = [
        { name: '힘의 축복', good: '모든 피해 +25%', apply: (d) => { d.dmgMul *= 1.25; } },
        { name: '강철의 축복', good: '받는 피해 -25%', apply: (d) => { d.dmgTakenMul *= 0.75; } },
        { name: '바람의 축복', good: '이동·공격 속도 +20%', apply: (d) => { d.moveSpeed *= 1.2; d.atkSpeed *= 1.2; } },
        { name: '피의 축복', good: '흡혈 +8%', apply: (d, s) => { s.lifesteal = (s.lifesteal || 0) + 8; } },
        { name: '지혜의 축복', good: '스킬 쿨타임 -30%, 얻는 종족 자원 +30%', apply: (d) => { d.skillCdMul *= 0.7; d.resGain *= 1.3; } },
        { name: '생명의 축복', good: '최대 체력 +20%, 체력 모두 회복', apply: (d) => { d.maxHp = Math.round(d.maxHp * 1.2); } },
      ];
      const pick = opts[this.rng.int(0, opts.length - 1)];
      pick.apply(this.d, this.s);
      this.player.hp = pick.name === '생명의 축복' ? this.d.maxHp : Math.min(this.player.hp, this.d.maxHp);
      this.blessing = pick;
      this.emit({ t: 'banner', text: pick.name, sub: `${pick.good} · 이 지역을 떠날 때까지`, color: '#c9a8ff' });
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
      const gold = Math.round(((o.rich ? 40 : 12) * this.zone.floor + this.rng.int(0, 10)) * 0.55);
      for (let i = 0; i < 5; i++) this.spawnDrop(o.x, o.y, 'gold', null, Math.ceil(gold / 5));
      return;
    }
    if (o.kind === 'lore') {
      o.opened = true;
      const text = LORES[this.rng.int(0, LORES.length - 1)];
      this.loot.lores.push(text);
      if (this.codex && !(this.codex.lore || []).includes(text)) { (this.codex.lore ||= []).push(text); this.signals.push({ t: 'codex' }); this.emit({ t: 'text', x: o.x, y: o.y - 16, text: '새 기록 · 도감 +1', color: '#8fd0ff' }); }
      this.signals.push({ t: 'lore', text });
    }
  }

  // 길을 막는 것을 연다: 칸을 바닥으로 되돌리고 저장에 남긴다
  openBarrier(o, silent = false) {
    o.opened = true; o.reusable = false;
    for (const i of o.tiles) if (this.tiles[i] === T_GATE) this.tiles[i] = T_FLOOR;
    if (silent || !this.story) return;
    this.story.flags[`open:${o.id}`] = true;
    this.emit({ t: 'barrierOpen', x: o.x, y: o.y, look: o.look });
    this.signals.push({ t: 'save' });
  }

  // 피의 마법: 모자란 종족 자원 1당 최대 HP 0.5%를 대신 낸다 (HP 20%는 남긴다)
  bloodPay(short) {
    const p = this.player, cost = short * this.d.maxHp * 0.005;
    if (!this.f.has('bloodMagic') || p.hp - cost < this.d.maxHp * 0.2) return false;
    p.hp -= cost; p.res = 0;
    this.emit({ t: 'text', x: p.x, y: p.y - 24, text: `피의 마법 -${Math.round(cost)}`, color: '#ff5a6a' });
    return true;
  }
  // 마법 무기(마법사): 마력이 모자라면 지팡이로 약하게 때린다 (피의 마법이면 체력으로 대신)
  payMana(cost) {
    const p = this.player;
    if (!cost || this.b.race !== 'wizard') return true;
    if (p.res >= cost) { p.res -= cost; p.lastCast = this.t; return true; }
    if (this.bloodPay(cost - p.res)) { p.lastCast = this.t; return true; }
    return false;
  }

  attack(angOff) {
    const p = this.player, d = this.d, w = this.b.weapon;
    let type = w.dmg;
    if (type === 'phys' && this.f.has('physToMag')) type = 'mag';
    const ang = Math.atan2(p.aimY, p.aimX) + angOff;
    if (w.kind === 'proj' && w.mana && !this.payMana(w.mana)) {
      // 마력 부족: 지팡이 휘두르기
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
    // 용화: 평타가 화염 브레스가 된다 (앞쪽 원뿔, 화상)
    if (p.buffs.dragonForm) {
      p.atkCount++; this.breakStealth();
      p.swingMax = 0.3; p.swingT = 0.3; p.swingAng = ang;
      const range = 78, angle = 0.95, base = Math.max(atk, d.magAtk) * w.mul * 1.1;
      this.emit({ t: 'skillCone', x: p.x, y: p.y, ang, range: range / 1.4, angle, elem: 'fire', fx: 'breath' });
      for (const e of this.enemies) {
        if (e.dead || e.hidden) continue;
        const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
        if (dist > range + e.r) continue;
        let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > angle / 2 && dist > e.r + 10) continue;
        this.hitEnemy(e, base, 'mag', false, false, { elem: 'fire' });
        this.applyStatus(e, 'burn', 1);
      }
      return;
    }
    p.atkCount++;
    let mul = w.mul, heavy = false;
    if (this.f.has('heavyHit') && p.atkCount % 4 === 0) { mul *= 2; heavy = true; }
    if (w.charge) { mul *= 1 + 0.6 * Math.min(1, (this.t - p.lastShot) / 1.6); }
    if (this.b.cls === 'ranger' && p.focus > 0 && w.kind === 'proj') { mul *= 1 + 0.25 * p.focus; heavy = p.focus >= 3; p.focus = 0; p.focusT = 0; }
    p.lastShot = this.t;
    this.breakStealth();
    const base = atk * mul;
    if (w.kind === 'melee') {
      p.swingDir = p.atkCount % 2 ? 1 : -1;
      const great = !!w.great;
      p.swingMax = great ? Math.max(0.7, 0.95 / (d.atkSpeed * this.mod('atkSpeed'))) : Math.min(0.2, 0.6 / (w.speed * d.atkSpeed)); p.swingT = p.swingMax; p.swingAng = ang;
      const thrust = w.shape === 'thrust';
      const hits = w.hits || 1;
      const strike = (slam = false, mulK = 1) => {
      this.emit({ t: 'swing', x: p.x, y: p.y, ang, range: w.range, arc: thrust ? 0.3 : w.arc, heavy: heavy || great, type, dir: great ? (slam ? -1 : 1) : p.swingDir, dur: great ? 0.12 : p.swingMax, thrust, aura: p.auraT > 0, whip: w.shape === 'whip', fist: w.cat === 'fist', enchant: p.buffs.enchant?.elem });
      for (const e of this.enemies) {
        if (e.dead || e.hidden) continue;
        const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
        if (dist > w.range + e.r) continue;
        let ok;
        let tip = 1;
        if (great) ok = dist < w.range + e.r + 6; // 몸 둘레로 돌리는 칼: 주변 모두
        else if (thrust) ok = distToSeg(e.x, e.y, p.x, p.y, p.x + Math.cos(ang) * w.range, p.y + Math.sin(ang) * w.range) < e.r + (w.width || 8);
        else if (w.shape === 'whip') { // 채찍: 가늘고 길게. 끝에 맞으면 1.5배
          ok = distToSeg(e.x, e.y, p.x, p.y, p.x + Math.cos(ang) * w.range, p.y + Math.sin(ang) * w.range) < e.r + (w.width || 8);
          if (ok && dist > w.range * 0.7) { tip = 1.5; this.emit({ t: 'whipCrack', x: e.x, y: e.y - 6 }); }
        }
        else {
          let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
          ok = Math.abs(da) <= w.arc / 2 || dist < e.r + 6;
        }
        if (!ok) continue;
        for (let h = 0; h < hits; h++) this.hitEnemy(e, base * mulK * tip, type, heavy || slam || tip > 1, false, { weapon: true });
      }
      if (slam) this.emit({ t: 'heavySwing', x: p.x, y: p.y });
      const hx = p.x + Math.cos(ang) * 14, hy = p.y + Math.sin(ang) * 14;
      if (this.tileAt(hx, hy) === T_CRACK) this.hitCrack(hx, hy, base);
      };
      // 대검은 힘을 모으는 동안은 아직 맞지 않고, 칼이 지나가는 순간 맞는다
      // 대검: 퍼올리는 순간 한 번(약하게), 무게로 땅에 떨어지는 순간 한 번 더(강하게)
      if (great) {
        this.delayed.push({ t: p.swingMax * 0.42, run: () => { p.dashT = 0.12; p.dvx = Math.cos(ang) * 70; p.dvy = Math.sin(ang) * 70; } }); // 던지는 힘에 몸이 끌려 나간다
        this.delayed.push({ t: p.swingMax * 0.57, run: () => { strike(true, 1.3); this.emit({ t: 'hitstop', v: 0.07 }); this.emit({ t: 'shake', v: 5 }); } });
      } else strike();
      // 도끼 군단: 휘두를 때마다 돌아오는 도끼 3자루를 함께 던진다
      if (p.buffs.axeLegion && this.b.cls === 'thrower') for (let i = -1; i <= 1; i++) {
        const a = ang + i * 0.25;
        this.projs.push({ owner: 'p', x: p.x, y: p.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 0.6, maxLife: 0.6, dmg: base * 0.6, type, pierce: 99, hit: new Set(), color: '#e8e2cf', kind: 'axe', boomerang: true, ox: p.x, oy: p.y, weaponHit: true });
      }
    } else {
      const legion = false;
      const n = (w.count || 1) + (legion ? 2 : 0);
      const spread = legion ? Math.max(0.22, w.spread || 0) : w.spread || 0;
      const wind = this.spiritCount('wind');
      const elem = this.b.cls === 'elementalist' ? p.elem : null;
      const spiritCol = this.b.cls === 'spiritcaller' && p.spirits.length ? ELEM[p.spirits[p.spirits.length - 1].elem]?.color : null; // 정령 활: 깃든 정령의 빛
      const rangeMul = this.mod('projRange');
      for (let i = 0; i < n; i++) {
        const a = ang + (i - (n - 1) / 2) * spread;
        const sp = w.projSpeed * d.projMul;
        const mz = this.muzzle(a);
        this.projs.push({
          owner: 'p', x: mz.x, y: mz.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: (w.range * d.projMul * rangeMul) / sp, maxLife: (w.range * d.projMul * rangeMul) / sp, dmg: base, type, pierce: w.boomerang ? 99 : (w.pierce || 0) + wind, hit: new Set(), heavy, splash: w.splash || 0,
          color: p.buffs.enchant ? ELEM[p.buffs.enchant.elem].color : elem ? ELEM[elem].color : spiritCol || (type === 'mag' ? '#b58cff' : '#e8e2cf'), kind: w.projKind || (w.boomerang ? 'axe' : type === 'phys' ? 'arrow' : 'orb'), ox: p.x, oy: p.y,
          boomerang: !!w.boomerang, weaponHit: true, elem, focusShot: heavy, homing: !!w.homing, ench: p.buffs.enchant?.elem,
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
    const hitAll = (list, mul, dtype = type) => { for (const e of list) this.hitEnemy(e, atk * w.mul * mul, dtype, true, false, { weapon: true }); };
    this.emit({ t: 'skill', id: w.skill, x: p.x, y: p.y, ang, tx: aimX, ty: aimY });
    const WM = { slam: ['overhead', 0.5], dashStab: ['thrust', 0.3], whirl: ['spin', 1.2], volley: ['shoot', 0.35], rain: ['aim', 0.45], axeStorm: ['spin', 0.4], boomStorm: ['spin', 0.4], knifeFan: ['spin', 0.4], lash: ['lash', 0.7], flurry: ['flurry', 0.65], frostRing: ['castBig', 0.45], poisonPool: ['cast', 0.35], meteor: ['castBig', 0.6], nova: ['castBig', 0.45] }[w.skill] || ['spin', 0.38];
    this.motion(WM[0], WM[1]);
    switch (w.skill) {
      case 'slam': {
        const cx = p.x + Math.cos(ang) * 26, cy = p.y + Math.sin(ang) * 26;
        p.windupT = 0.2;
        this.delayed.push({ t: 0.2, run: () => {
          p.windupT = 0;
          this.emit({ t: 'slam', x: cx, y: cy, r: 58 });
          this.emit({ t: 'hitstop', v: 0.1 });
          for (const e of this.enemiesNear(cx, cy, 58)) { this.hitEnemy(e, atk * w.mul * 2.2, type, true, false, { weapon: true }); if (!e.def.elite) { e.windT = 0; e.atkCd = Math.max(e.atkCd, 1.2); } }
        } });
        break;
      }
      case 'dashStab': {
        const len = 90, ex = p.x + Math.cos(ang) * len, ey = p.y + Math.sin(ang) * len;
        p.dashT = 0.2; p.dvx = Math.cos(ang) * len / 0.2; p.dvy = Math.sin(ang) * len / 0.2; p.invuln = Math.max(p.invuln, 0.3);
        this.emit({ t: 'afterimage', x1: p.x, y1: p.y, x2: ex, y2: ey });
        for (const e of this.enemies) if (!e.dead && distToSeg(e.x, e.y, p.x, p.y, ex, ey) < e.r + 12) this.hitEnemy(e, atk * w.mul * 1.9, type, true, false, { weapon: true });
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
      case 'axeStorm': case 'boomStorm': {
        const n = w.skill === 'boomStorm' ? 6 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, sp = 200;
          this.projs.push({ owner: 'p', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9, maxLife: 0.9, dmg: atk * w.mul * 0.85, type, pierce: 99, hit: new Set(), color: '#e8e2cf', kind: w.skill === 'boomStorm' ? 'boomerang' : 'axe', boomerang: true, ox: p.x, oy: p.y, weaponHit: true });
        }
        break;
      }
      case 'knifeFan': {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + ang, sp = 360;
          this.projs.push({ owner: 'p', x: p.x, y: p.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, maxLife: 0.5, dmg: atk * w.mul * 1.6, type, pierce: 1, hit: new Set(), color: '#e8eef4', kind: 'knife', ox: p.x, oy: p.y, weaponHit: true });
        }
        break;
      }
      case 'lash': { // 앞쪽을 세 번 휘갈기고, 마지막에 맞은 적을 끌어온다
        for (let k = 0; k < 3; k++) this.delayed.push({ t: 0.08 + k * 0.2, run: () => {
          const a = Math.atan2(p.aimY, p.aimX), last = k === 2;
          this.emit({ t: 'swing', x: p.x, y: p.y, ang: a, range: w.range, arc: 1.3, type, dir: k % 2 ? -1 : 1, dur: 0.16, whip: true, wide: true, enchant: p.buffs.enchant?.elem });
          for (const e of this.enemies) {
            if (e.dead || e.hidden) continue;
            const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
            if (dist > w.range + e.r) continue;
            let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
            if (Math.abs(da) > 0.7) continue;
            this.hitEnemy(e, atk * w.mul * (last ? 1.4 : 0.9), type, last, false, { weapon: true });
            if (last && !e.def.elite && !e.dead) { const l = dist || 1; e.kbx -= (dx / l) * Math.min(300, l * 7); e.kby -= (dy / l) * Math.min(300, l * 7); this.stunE(e, 0.5); }
          }
        } });
        break;
      }
      case 'flurry': { // 주먹 여섯 번, 마지막은 날려 보낸다
        for (let k = 0; k < 6; k++) this.delayed.push({ t: 0.05 + k * 0.1, run: () => {
          const a = Math.atan2(p.aimY, p.aimX), last = k === 5;
          p.swingDir = k % 2 ? 1 : -1; p.swingMax = 0.1; p.swingT = 0.1; p.swingAng = a;
          this.emit({ t: 'swing', x: p.x, y: p.y, ang: a, range: w.range + 6, arc: 1.4, type, dir: p.swingDir, dur: 0.1, fist: true, heavy: last, enchant: p.buffs.enchant?.elem });
          for (const e of this.enemies) {
            if (e.dead || e.hidden) continue;
            const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
            if (dist > w.range + 6 + e.r) continue;
            let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
            if (Math.abs(da) > 0.8 && dist > e.r + 6) continue;
            this.hitEnemy(e, atk * w.mul * (last ? 2.2 : 0.8), type, last, false, { weapon: true });
            if (last && !e.def.elite && !e.dead) { const l = dist || 1; e.kbx += (dx / l) * 520; e.kby += (dy / l) * 520; }
          }
          if (last) this.emit({ t: 'hitstop', v: 0.06 });
        } });
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

  // 투사체가 나가는 자리 (무기 끝)
  muzzle(ang) {
    const p = this.player, id = this.b.weaponId || '', w = this.b.weapon;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    if (/blowgun/i.test(id)) return { x: p.x + ux * 14, y: p.y + ({ assassin: -6, knight: -10, orc: -8, golem: -12 }[this.b.race] ?? -9) + uy * 4 };
    if (/bow/i.test(id)) return { x: p.x + ux * 12, y: p.y - 9 + uy * 10 }; // 활을 겨눈 손 자리 (renderer의 bowHand와 같게)
    if (w.kind === 'proj' && w.dmg === 'mag') return { x: p.x + ux * 15, y: p.y - 8 + uy * 12 };
    return { x: p.x + ux * 8, y: p.y - 6 + uy * 6 };
  }

  // ═══════ 종족 자원 / 버프 ═══════
  get raceRes() { return RACES[this.b.race]?.res; }
  addRes(n, passive = false) {
    const p = this.player;
    p.res = Math.max(0, Math.min(100, p.res + (n > 0 ? n * this.d.resGain : n)));
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
  castSkillId(id, slot) {
    const p = this.player;
    // 비상 중에 다시 누르면 바로 내리꽂는다
    if (id === 'soar' && p.airT > 0) { this.landSoar(); return; }
    if (p.castT > 0 || p.channel || p.charging || p.rush || p.leap || p.windupT > 0 || p.combo || p.fallInto || p.drop || p.hop) return;
    if (id === 'weapon') { if (p.skillCd <= 0) { this.breakStealth(); this.useSkill(); } return; }
    const def = SKILLS[id];
    if (!def || p.cds[id] > 0) return;
    const fit = handFit(def, this.b).fit;
    if (fit <= 0) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: def.name, text: (CANT_TEXT[def.kind] || '이 무기로는 쓸 수 없다') + (this.b.hands < 2 ? ' · 왼손 도구로도 쓸 수 있다' : '') }); p.cds[id] = 0.4; return; }    if (p.swim && !['dive', 'waterBreath'].includes(id)) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: def.name, text: '헤엄치는 중에는 쓸 수 없다' }); p.cds[id] = 0.3; return; }
    if (def.needSpirit && !p.spirits.length) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: '깃든 정령', text: '깃든 정령이 없다' }); p.cds[id] = 0.3; return; }
    if (def.do.some((o) => SPIRIT_OPS.has(o.op)) && !SPIRITS[this.b.spirit?.id]) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: def.name, text: '계약한 정령이 없다 · 세계수 성지의 「정령 계약」' }); p.cds[id] = 0.5; return; }
    let spent = 0;
    if (def.costAll) {
      if (p.res < def.costAll.min) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: this.raceRes?.name || '자원' }); p.cds[id] = 0.3; return; }
      spent = p.res; p.res = 0;
    } else if (def.cost) {
      if (p.res < def.cost && !this.bloodPay(def.cost - p.res)) { this.emit({ t: 'noRes', x: p.x, y: p.y, name: this.raceRes?.name || '자원' }); p.cds[id] = 0.3; return; }
      p.res = Math.max(0, p.res - def.cost); spent = def.cost;
    }
    if (def.gain) this.addRes(def.gain);
    let cd = def.cd * this.d.skillCdMul * (1 - this.d.cdr);
    if (id === 'breath' && p.buffs.dragonForm) cd = 0.3;
    if (this.practice?.noCd) cd = Math.min(cd, 0.25);
    p.cds[id] = cd; p.cdMax ||= {}; p.cdMax[id] = cd;
    p.lastFight = this.t;
    if (this.pvp) this.pvp.out.push({ t: 'dskill', id });
    if (def.kind === 'spell') this.knack('castSpell');
    if (id !== 'stealth') this.breakStealth();
    // 차지: 누르고 있는 동안 힘을 모은다 (떼면 발동)
    if (def.charge) {
      p.charging = { id, def, spent, slot, t: 0, lvl: 0 };
      this.motion(def.mo, 1.4, { charge: true });
      this.emit({ t: 'chargeStart', x: p.x, y: p.y });
      return;
    }
    if (def.cast) {
      const ct = def.cast * (this.d.castMul || 1);
      p.castT = ct; p.castMax = ct; p.castSkill = { def, spent, id };
      if (this.autoAim) { const tg0 = this.pickTarget(def); if (tg0 && tg0.kind !== 'none') this.faceTo(tg0.x, tg0.y); }
      this.motion(def.mo === 'castBig' ? 'castBigHold' : 'castHold', def.cast + 0.05);
      if (this.autoAim) { const tg = this.pickTarget(def); if (tg) this.emit({ t: 'lockOn', x: tg.x, y: tg.y, kind: tg.kind, dur: def.cast }); }
      this.emit({ t: 'cast', x: p.x, y: p.y, dur: def.cast, elem: def.elem === 'current' ? p.elem : def.elem });
      return;
    }
    this.execSkill(def, spent, id, { slot });
  }

  // 캐릭터 몸 동작 (렌더러가 읽는다): kind, 진행 시간, 길이
  motion(kind, dur, extra = {}) {
    if (!kind) return;
    const p = this.player;
    p.motion = { kind, t: 0, dur, ang: Math.atan2(p.aimY, p.aimX), dir: p.dir, lock: extra.lock !== false, ...extra };
  }

  execSkill(def, spent, id, opt = {}) {
    const p = this.player;
    const elem = def.elem === 'current' ? p.elem : def.elem;
    if (this.b.cls === 'elementalist' && ELEM_CYCLE.includes(elem)) p.elem = elem;
    let bonus = 1;
    const lvl = opt.charge || 0;
    if (def.charge) bonus *= [1, 1.35, 1.75, 2.2][lvl];
    if (p.elemBonusT > 0 && elem && elem !== 'phys') { bonus = 1.3; p.elemBonusT = 0; }
    // 힘 모으기: 다음 스킬 한 번이 강해진다
    if (p.buffs.charged && id !== 'chargeUp') { bonus *= p.buffs.charged.power || 2.5; p.buffs.charged.t = Math.min(p.buffs.charged.t, 0.05); }
    const boost = this.weaponBoost(id), hf = handFit(def, this.b), fit = hf.fit, cross = crossMul(def, this.b); // 다른 종족 스킬: 능력치가 모자라면 85%
    const ctx = { def, id, spent, elem, bonus: bonus * boost * fit * cross * (SKILL_BAL[id] ?? 1), // SKILL_BAL: 종족 스킬 밸런스 보정
      fit, hand: hf.hand, atk: this.skillAtk(def.scale), resMul: 1 + spent / 100, charge: lvl, slot: opt.slot };
    if (fit < 0.95 && fit > 0) this.emit({ t: 'text', x: p.x, y: p.y - 26, text: `무기가 맞지 않다 · 피해 ${Math.round(fit * 100)}%`, color: '#c8b8a0' });
    if (this.autoAim) {
      const tg = this.pickTarget(def);
      if (tg) {
        ctx.auto = true; ctx.target = tg.e; ctx.point = tg.e ? null : { x: tg.x, y: tg.y }; ctx.tp = tg.tp;
        this.faceTo(tg.x, tg.y);
        if (tg.kind !== 'none') this.emit({ t: 'lockOn', x: tg.x, y: tg.y, kind: tg.kind, ult: def.ult });
      }
    }
    this.emit({ t: 'skillFx', fx: def.fx, x: p.x, y: p.y, ang: Math.atan2(p.aimY, p.aimX), elem, name: def.name, ult: def.ult, role: def.role, charge: lvl });
    if (!def.charge && !def.cast) this.motion(def.mo, MOTION_DUR[def.mo] || 0.35);
    else if (def.charge || def.cast) this.motion(def.mo === 'castBig' ? 'castBigRelease' : def.mo === 'cast' ? 'castRelease' : def.mo, MOTION_DUR[def.mo] || 0.35, { charge: lvl });
    const fire = () => { for (const op of def.do) this.runOp(op, ctx); if (def.word) this.addWord(def.word); };
    const wu = !def.cast && !opt.now ? WINDUP[def.mo] || 0 : 0; // 차지 스킬도 휘두르는 동작이 지나간 뒤에 나간다
    if (wu > 0) { p.windupT = wu; this.delayed.push({ t: wu, run: () => { p.windupT = 0; fire(); } }); }
    else fire();
  }

  // 상위 클래스 무기: 지정한 스킬 피해 증가
  weaponBoost(id) {
    const it = this.b.weaponItem;
    if (!it || !it.boost || it.cls !== this.b.cls) return 1;
    return 1 + (it.boost[id] || 0);
  }

  faceTo(x, y) {
    const p = this.player, dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy);
    if (l < 1) return;
    p.aimX = dx / l; p.aimY = dy / l; this.aimDist = l;
    if (Math.abs(p.aimX) > 0.1) p.dir = p.aimX > 0 ? 1 : -1;
  }

  // 자동 조준: 스킬 성격에 맞는 대상 / 지점을 고른다
  pickTarget(def) {
    const p = this.player, rule = aimRule(def), R = 280;
    const list = this.enemies.filter((e) => !e.dead && !e.hidden && (e.def.ai !== 'dummy' || this.mode === 'plaza' || this.practice) && Math.hypot(e.x - p.x, e.y - p.y) < R);
    if (!list.length) return null;
    const dist = (e) => Math.hypot(e.x - p.x, e.y - p.y);
    const nearest = () => list.reduce((a, b) => (dist(a) < dist(b) ? a : b));
    const hit = (e, kind) => ({ e, x: e.x, y: e.y, kind });
    const stacks = (e) => (e.st.burn?.n || 0) + (e.st.poison?.n || 0) + (e.st.curse?.n || 0) + (e.st.bleed?.n || 0);
    switch (rule) {
      case 'none': { const e = nearest(); return { e: null, x: e.x, y: e.y, kind: 'none' }; }
      case 'tank': return hit(list.reduce((a, b) => (b.hp * (b.def.elite || b.champion ? 3 : 1) > a.hp * (a.def.elite || a.champion ? 3 : 1) ? b : a)), 'tank');
      case 'low': return hit(list.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a)), 'low');
      case 'fresh': { const f = list.filter((e) => !(e.st.weak > 0) && !(e.st.elemMark > 0) && !e.st.curse); return hit((f.length ? f : list).reduce((a, b) => (dist(a) < dist(b) ? a : b)), 'fresh'); }
      case 'stack': return hit(list.reduce((a, b) => (stacks(b) > stacks(a) ? b : a)), 'stack');
      case 'back': {
        const e = list.reduce((a, b) => (b.maxHp > a.maxHp ? b : a));
        const side = e.dir > 0 ? -1 : 1;
        return { e, x: e.x, y: e.y, kind: 'back', tp: { x: e.x + side * (e.r + 10), y: e.y } };
      }
      case 'away': {
        let cx = 0, cy = 0;
        for (const e of list) { const w = 1 / Math.max(20, dist(e)); cx += (e.x - p.x) * w; cy += (e.y - p.y) * w; }
        const l = Math.hypot(cx, cy) || 1;
        return { e: null, x: p.x - (cx / l) * 80, y: p.y - (cy / l) * 80, kind: 'away' };
      }
      case 'cluster': case 'crowd': {
        let best = list[0], bn = -1;
        for (const c of list) {
          let n = 0;
          for (const o of list) if (Math.hypot(o.x - c.x, o.y - c.y) < 60) n += o.def.elite || o.champion ? 2 : 1;
          n -= dist(c) / 400;
          if (n > bn) { bn = n; best = c; }
        }
        // 무리의 무게중심
        let sx = 0, sy = 0, k = 0;
        for (const o of list) if (Math.hypot(o.x - best.x, o.y - best.y) < 60) { sx += o.x; sy += o.y; k++; }
        return { e: rule === 'crowd' ? best : null, x: sx / k, y: sy / k, kind: 'cluster' };
      }
      default: return hit(nearest(), 'near');
    }
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
    if (op.bonusIf === 'frozen' && (e.st.frozen > 0 || e.st.chill?.n >= 4)) { mul *= 2.5; this.emit({ t: 'shatter', x: e.x, y: e.y }); }
    if (op.bonusIf === 'burning' && e.st.burn) mul *= 1.5;
    if (op.backstab && Math.sign(p.x - e.x) !== e.dir) mul *= 1.5;
    const type = ctx.def.scale === 'mag' || (ctx.elem && ctx.elem !== 'phys') ? 'mag' : 'phys';
    if (mul > 0) this.hitEnemy(e, ctx.atk * mul, type, true, false, { elem: ctx.elem, pen: op.pen, skill: true });
    if (e.dead) return true;
    const status = ctx.elem && ELEM[ctx.elem]?.status;
    if (status && op.stacks) this.applyStatus(e, status, op.stacks);
    // 원소 폭주: 다음 속성까지 함께 남긴다
    if (p.buffs.surge && ELEM_CYCLE.includes(ctx.elem) && !e.dead) { const nx = ELEM_CYCLE[(ELEM_CYCLE.indexOf(ctx.elem) + 1) % 3]; this.applyStatus(e, ELEM[nx].status, Math.max(1, Math.ceil((op.stacks || 1) / 2))); }
    if (op.flee && !e.def.elite) { e.st.flee = Math.max(e.st.flee || 0, op.flee); e.windT = 0; }
    else if (op.flee) this.fearE(e, op.flee);
    if (op.retrib) e.st.retrib = Math.max(e.st.retrib || 0, op.retrib);
    if (op.lose && e.state === 'chase') { e.loseT = 4; e.windT = 0; }
    if (op.status) this.applyStatus(e, op.status, op.stacks || 1);
    if (op.extraStatus && !e.dead) this.applyStatus(e, op.extraStatus, 1);
    if (op.elemFire && !e.dead) this.applyStatus(e, 'burn', op.stacks || 1);
    if (op.doom && !e.dead) { e.doom = { atk: ctx.atk * ctx.resMul }; this.emit({ t: 'doomMark', id: e.id }); }
    if (op.root && !e.dead) { e.rooted = Math.max(e.rooted || 0, op.stun || 1.5); e.vineT0 = this.t; }
    if (op.stacksIfBurning && e.st.burn) this.applyStatus(e, 'burn', op.stacksIfBurning);
    if (op.stun && !e.def.elite) { this.stunE(e, op.stun); e.windT = 0; if (op.prison) e.prison = true; }
    else if (op.stun && e.def.elite) { this.stunE(e, op.stun * 0.35); if (op.prison) e.prison = true; }
    if (op.fear) this.fearE(e, op.fear);
    if (op.mark) e.st.elemMark = Math.max(e.st.elemMark || 0, op.mark);
    if (op.weak) e.st.weak = Math.max(e.st.weak || 0, op.weak);
    if (op.armorBreak) { e.armorBreak = Math.min(5, (e.armorBreak || 0) + op.armorBreak); e.armorBreakT = 6; }
    if (op.knock && !e.def.elite) {
      const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1;
      e.kbx += (dx / l) * op.knock * 2; e.kby += (dy / l) * op.knock * 2;
      if (this.b.cls === 'behemoth') { e.kbHot = op.launch ? 0.7 : 0.45; e.kbAtk = ctx.atk; }
    }
    if (op.pull) { e.reelT = e.def.elite ? 0.18 : 0.45; e.reelK = e.def.elite ? 0.45 : 1; e.reelX0 = e.x; e.reelY0 = e.y; e.kbx = 0; e.kby = 0; this.aggro(e); this.emit({ t: 'reel', id: e.id }); }
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
    if (ctx.auto) {
      if (ctx.target && !ctx.target.dead) this.faceTo(ctx.target.x, ctx.target.y);
      else if (ctx.point) this.faceTo(ctx.point.x, ctx.point.y);
    }
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
        if (op.delay && !op._now) { this.delayed.push({ t: op.delay, run: () => this.runOp({ ...op, _now: true }, ctx) }); break; }
        let dx = p.aimX, dy = p.aimY, dist = op.dist + (op.chargeDist || 0) * (ctx.charge || 0);
        if (op.focusGain) { p.focus = Math.max(p.focus, op.focusGain); p.focusKeep = true; }
        if (op.toward === 'farthestEngaged') { // 나를 쫓는(싸우고 있는) 적 가운데 가장 먼 적, 없으면 가장 가까운 적
          const fight = this.enemies.filter((e) => !e.dead && !e.hidden && e.def.ai !== 'dummy' && (e.state === 'chase' || this.mode === 'plaza' || this.practice) && Math.hypot(e.x - p.x, e.y - p.y) < op.dist);
          const t = fight.length ? fight.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) > Math.hypot(a.x - p.x, a.y - p.y) ? b : a)) : this.nearestEnemy(op.dist);
          if (t) { const vx = t.x - p.x, vy = t.y - p.y, l = Math.hypot(vx, vy) || 1; dx = vx / l; dy = vy / l; dist = Math.max(0, l - t.r - 6); this.faceTo(t.x, t.y); ctx.target = t; }
        } else if (op.toward === 'nearest') {
          const t = this.nearestEnemy(op.dist);
          if (t) { const vx = t.x - p.x, vy = t.y - p.y, l = Math.hypot(vx, vy) || 1; dx = vx / l; dy = vy / l; dist = Math.max(0, l - t.r - 6); }
        }
        else if (ctx.auto && op.dist > 0 && ctx.target && !ctx.target.dead) dist = Math.min(op.dist, Math.max(20, Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) - 6));
        if (dist < 0) { dx = -dx; dy = -dy; dist = -dist; }
        // 벽에 박히지 않게
        while (dist > 0 && this.blocked(p.x + dx * dist, p.y + dy * dist, 5)) dist -= 6;
        dist = Math.max(0, dist);
        const x1 = p.x, y1 = p.y;
        const dur = 0.18;
        p.dashT = dur; p.dvx = dx * dist / dur; p.dvy = dy * dist / dur;
        p.invuln = Math.max(p.invuln, op.invuln || 0.25);
        const x2 = x1 + dx * dist, y2 = y1 + dy * dist;
        this.emit({ t: 'skillDash', x1, y1, x2, y2, elem: ctx.elem });
        if (op.mul) countHits(this.enemies.filter((e) => !e.dead && !e.hidden && distToSeg(e.x, e.y, x1, y1, x2, y2) < e.r + 14));
        if (op.iceTrail) for (let i = 1; i <= 4; i++) this.zones.push({ kind: 'frost', x: x1 + (x2 - x1) * i / 4, y: y1 + (y2 - y1) * i / 4, r: 20, t: 3, max: 3, tick: 0, atk: ctx.atk });
        if (op.fireTrail) for (let i = 1; i <= 4; i++) this.zones.push({ kind: 'fire', x: x1 + (x2 - x1) * i / 4, y: y1 + (y2 - y1) * i / 4, r: 18, t: 3, tick: 0, atk: ctx.atk });
        break;
      }
      case 'teleport': {
        const x1 = p.x, y1 = p.y;
        let dist = op.dist;
        if (ctx.tp && !this.blocked(ctx.tp.x, ctx.tp.y, 5) && Math.hypot(ctx.tp.x - p.x, ctx.tp.y - p.y) < op.dist * 2.2) { p.x = ctx.tp.x; p.y = ctx.tp.y; dist = -1; if (ctx.target) this.faceTo(ctx.target.x, ctx.target.y); }
        else if (ctx.auto && ctx.target && !ctx.target.dead) dist = Math.min(op.dist, Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) - 10);
        else if (ctx.auto && ctx.point) dist = Math.min(op.dist, Math.hypot(ctx.point.x - p.x, ctx.point.y - p.y));
        if (dist >= 0) {
          while (dist > 0 && this.blocked(p.x + p.aimX * dist, p.y + p.aimY * dist, 5)) dist -= 6;
          p.x += p.aimX * Math.max(0, dist); p.y += p.aimY * Math.max(0, dist);
        }
        p.invuln = Math.max(p.invuln, 0.2);
        this.emit({ t: 'blink', x1, y1, x2: p.x, y2: p.y });
        if (op.echo) {
          const ec = op.echo;
          this.emit({ t: 'echoMark', x: x1, y: y1, dur: ec.delay, r: ec.r });
          this.delayed.push({ t: ec.delay, run: () => { this.emit({ t: 'skillAoe', x: x1, y: y1, r: ec.r, elem: 'arcane', fx: 'arcane' }); for (const e of this.enemiesNear(x1, y1, ec.r)) this.skillHit(e, { mul: ec.mul }, ctx); } });
        }
        if (this.raceRes?.dash) this.addRes(this.raceRes.dash);
        break;
      }
      case 'aoe': {
        const c = op.at === 'aim' ? (ctx.auto && ctx.point ? { ...ctx.point } : this.aimPoint(op.range || 200)) : op.at === 'front' ? { x: p.x + p.aimX * (op.dist || 26), y: p.y + p.aimY * (op.dist || 26) } : { x: p.x, y: p.y };
        if (op.at === 'aim' && ctx.auto && ctx.target && !ctx.point) { c.x = ctx.target.x; c.y = ctx.target.y; }
        if (op.jitter) { c.x += this.rng.range(-op.jitter, op.jitter); c.y += this.rng.range(-op.jitter, op.jitter); }
        const follow = op.at === 'self';
        const run = () => {
          if (follow) { c.x = p.x; c.y = p.y; }
          let list = this.enemiesNear(c.x, c.y, op.r);
          if (op.spareNearest && list.length > 1) { const nn = list.reduce((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b)); list = list.filter((e) => e !== nn); this.emit({ t: 'lockOn', x: nn.x, y: nn.y, kind: 'low' }); }
          if (op.pullTo) for (const e of list) if (!e.def.elite || true) { const dx = c.x - e.x, dy = c.y - e.y, l = Math.hypot(dx, dy) || 1; const k = e.def.elite ? 0.5 : 1; e.kbx += (dx / l) * Math.min(320, l * 7) * k; e.kby += (dy / l) * Math.min(320, l * 7) * k; }
          this.emit({ t: 'skillAoe', x: c.x, y: c.y, r: op.r, elem: ctx.elem, fx: op.fx || ctx.def.fx, ult: ctx.def.ult });
          countHits(list, op.perHit ? 1 + op.perHit * Math.max(0, list.length - 1) : 1);
        };
        if (op.delay) {
          this.emit({ t: 'telegraphCircle', x: c.x, y: c.y, r: op.r, dur: op.delay, follow });
          if (op.fall) this.emit({ t: 'fall', x: c.x, y: c.y, r: op.r, dur: op.delay, kind: op.fall });
          this.delayed.push({ t: op.delay, run });
        } else run();
        break;
      }
      case 'cone': {
        if (op.chargeRange && ctx.charge) op = { ...op, range: op.range * (1 + op.chargeRange * ctx.charge) };
        if (op._form === 'melee' && ctx.target && !ctx.target.dead) { // 근접 마법: 표적이 조금 멀면 한 걸음 파고든다
          const dd = Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) - ctx.target.r - op.range * 0.7;
          if (dd > 0 && dd < 60) { let st = dd; while (st > 0 && this.blocked(p.x + p.aimX * st, p.y + p.aimY * st, 5)) st -= 6; if (st > 0) { const x1 = p.x, y1 = p.y; p.x += p.aimX * st; p.y += p.aimY * st; this.emit({ t: 'skillDash', x1, y1, x2: p.x, y2: p.y, elem: ctx.elem }); } }
        }
        if (p.buffs.dragonForm) op = { ...op, range: op.range * 1.4, angle: op.angle * 1.2 }; // 용의 몸집만큼 넓게
        const list = this.enemies.filter((e) => {
          if (e.dead || e.hidden) return false;
          const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
          if (dist > op.range + e.r) return false;
          let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
          return Math.abs(da) <= op.angle / 2 || dist < e.r + 8;
        });
        this.emit({ t: 'skillCone', x: p.x, y: p.y, ang, range: op.range, angle: op.angle, elem: ctx.elem, fx: op._form === 'melee' ? 'spellBlade' : op.fx || ctx.def.fx });
        const hits = countHits(list);
        if (hits && op.onHitGain) this.addRes(op.onHitGain);
        if (hits && op.onHitHeal) this.heal(this.d.maxHp * op.onHitHeal, 'skill');
        break;
      }
      case 'single': {
        const e = ctx.target && !ctx.target.dead && Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) < op.range + 40 ? ctx.target : this.nearestEnemy(op.range);
        if (!e) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        if (op.teleportTo) { const side = e.dir > 0 ? -1 : 1; let tx = e.x + side * (e.r + 8); if (this.blocked(tx, e.y, 5)) tx = e.x - side * (e.r + 8); this.emit({ t: 'blink', x1: p.x, y1: p.y, x2: tx, y2: e.y }); p.x = tx; p.y = e.y; }
        this.emit({ t: 'skillSingle', x: e.x, y: e.y, fx: op.fx || ctx.def.fx, elem: ctx.elem, big: !!op.scaleRes || ctx.def.ult });
        const bleedN = e.st.bleed?.n || 0;
        countHits([e]);
        if (op.healPerBleed && bleedN) { this.heal(this.d.maxHp * op.healPerBleed * bleedN, 'skill'); this.emit({ t: 'text', x: p.x, y: p.y - 22, text: `포식 +${bleedN}`, color: '#e0445a' }); }
        break;
      }
      case 'proj': {
        // 무기에 따라 마법 모양이 바뀐다: 근접 무기면 앞쪽을 휩쓰는 짧고 센 마법, 활 · 바람총이면 빠르고 멀리 가는 마법 화살
        if (ctx.def.kind === 'spell' && !op._form) {
          if (this.b.weapon.kind === 'melee') { const n = op.n || 1; return this.runOp({ ...op, op: 'cone', _form: 'melee', range: 62, angle: 1.7, mul: (op.mul || 1) * 1.2 * (n > 1 ? 1 + 0.3 * (n - 1) : 1) }, ctx); }
          if (this.b.wcat === 'bow' || this.b.wcat === 'tube') op = { ...op, _form: 'bow', speed: op.speed * 1.5, range: op.range * 1.3 };
        }
        if (ctx.def.kind === 'shoot' && ctx.hand === 'off') op = { ...op, kind: 'bolt', status: op.status === 'poison' ? null : op.status }; // 왼손 손쇠뇌: 쇠살
        if (ctx.def.kind === 'shoot' && ctx.hand !== 'off') { // 든 무기가 쏜다: 활이면 화살, 석궁이면 쇠살, 바람총이면 독침
          const wc = this.b.wcat, bolt = this.b.weapon.projKind === 'bolt';
          if (wc === 'bow' && (op.kind === 'dart' || bolt)) op = { ...op, kind: bolt ? 'bolt' : 'arrow', status: op.status === 'poison' ? null : op.status };
          else if (wc === 'tube' && op.kind === 'arrow') op = { ...op, kind: 'dart' };
        }
        if (op.focus && this.b.cls === 'ranger' && p.focus > 0) { ctx = { ...ctx, bonus: ctx.bonus * (1 + 0.25 * p.focus) }; p.focus = 0; p.focusT = 0; }
        if (op.fullPierce && ctx.charge >= 3) op = { ...op, pierce: 99, mul: op.mul * 1.2 };
        for (let i = 0; i < (op.n || 1); i++) {
          const a = ang + (i - ((op.n || 1) - 1) / 2) * (op.spread || 0);
          const mz = this.muzzle(a);
          this.projs.push({
            owner: 'p', x: mz.x, y: mz.y, vx: Math.cos(a) * op.speed, vy: Math.sin(a) * op.speed,
            life: op.range / op.speed, maxLife: op.range / op.speed, boomerang: !!op.boomerang, dmg: 0, type: 'mag', pierce: op.pierce || 0, hit: new Set(), splash: 0,
            color: ELEM[ctx.elem]?.color || '#e8e0f4', kind: op.kind === 'rock' ? 'rock' : 'skill', skind: op.kind, elem: ctx.elem, big: true, homing: op.homing, rot: a,
            skillHit: (e, pr) => {
              this.skillHit(e, op, ctx);
              if (op.onHitGain) this.addRes(op.onHitGain);
              if (op.onHitHeal) this.heal(this.d.maxHp * op.onHitHeal, 'skill');
              if (op.splash) {
                this.emit({ t: 'skillAoe', x: pr.x, y: pr.y, r: op.splash, elem: ctx.elem, fromProj: true, fx: op.kind === 'rock' ? 'rocks' : op.kind === 'icerock' ? 'ice' : op.kind === 'plague' ? 'fog' : 'pop' });
                for (const o of this.enemiesNear(pr.x, pr.y, op.splash)) if (o !== e) this.skillHit(o, op, ctx, 0.6);
              }
            },
          });
        }
        break;
      }
      case 'chain': {
        let cur = ctx.target && !ctx.target.dead ? ctx.target : this.nearestEnemy(170);
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
      case 'channel': p.channel = { t: op.dur, every: op.every, tick: 0, sub: op.sub, ctx, invuln: op.invuln }; break;
      case 'comboSpin': p.combo = { op, ctx, i: 0, t: 0, ang }; break;
      case 'enchant': { // 무기에 속성을 입힌다 (평타 · 무기 기술에 그 속성 피해가 더해진다)
        p.buffs.enchant = { t: op.dur, max: op.dur, mods: {}, color: ELEM[op.elem].color, name: ctx.def.name, elem: op.elem, pow: op.pow, stacks: op.stacks || 1 };
        this.emit({ t: 'enchant', x: p.x, y: p.y, elem: op.elem });
        break;
      }
      case 'waterBreath': { // 저장에 남는다 (바닷속은 다른 세계라서)
        if (this.persist && this.clock) {
          const now = absMin(this.clock), i = this.persist.findIndex((e) => e.id === 'waterBreath');
          if (i >= 0) this.persist.splice(i, 1);
          this.persist.push({ id: 'waterBreath', name: '수중 호흡', mods: {}, color: '#7ad8ff', until: now + op.min, dur: op.min, src: 'skill' });
          this.applyPersist();
        } else p.buffs.waterBreath = { t: op.min, max: op.min, mods: {}, color: '#7ad8ff', name: '수중 호흡' };
        this.emit({ t: 'waterBreath', x: p.x, y: p.y });
        break;
      }
      case 'dive': this.tryDive(true); break;
      case 'buff': {
        const mods = { ...op.mods };
        if (op.scaleRes && mods.dmgMul) mods.dmgMul = 1 + (mods.dmgMul - 1) * (1 + ctx.spent / 100);
        p.buffs[op.id] = { t: op.dur, max: op.dur, mods, color: op.color, bubble: op.bubble, power: op.power };
        if (op.id !== 'nextCrit') this.emit({ t: 'buff', x: p.x, y: p.y, color: op.color || '#ffffff', bubble: op.bubble });
        break;
      }
      case 'parry': p.parryT = op.dur; p.parry = { mul: op.mul, r: op.r, gain: op.gain, stun: op.stun }; this.emit({ t: 'parryStance', x: p.x, y: p.y, dur: op.dur }); break;
      case 'summon': {
        if (op.max) { const mine = this.allies.filter((a) => a.kind === op.kind && a.t > 0); while (mine.length + op.n > op.max && mine.length) { const old = mine.shift(); old.t = 0; old.hp = 0; } } // 오래된 것부터 돌려보낸다
        for (let i = 0; i < op.n; i++) {
          const a = this.rng.range(0, Math.PI * 2);
          const elem = op.kind === 'spiritKing' ? ELEM_CYCLE[this.rng.int(0, 2)] : op.elem;
          if (op.kind === 'spiritKing') this.emit({ t: 'banner', text: `${ELEM[elem].name}의 정령왕 강림`, color: ELEM[elem].color });
          const hp = op.kind === 'skeleton' ? this.d.maxHp * 0.35 : op.kind === 'lich' ? this.d.maxHp * 0.8 : 0;
          this.allies.push({ id: this.nextId++, kind: op.kind, perm: !!op.perm, elem, hp, maxHp: hp, x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, t: op.dur, max: op.dur,
            atk: ctx.atk * op.mul * (op.scaleRes ? ctx.resMul : 1) * ctx.bonus, cd: 0.3 + i * 0.2, phase: a, dir: 1 });
          this.emit({ t: 'summonFx', x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, kind: op.kind, elem, big: op.kind === 'spiritKing' || op.kind === 'lich' });
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
          this.skillHit(e, { mul: op.mul * stacks, scaleRes: op.scaleRes }, ctx);
          for (const o of this.enemiesNear(e.x, e.y, op.r)) if (o !== e) this.skillHit(o, { mul: op.mul * stacks * 0.4, scaleRes: op.scaleRes }, ctx);
        }
        if (!n) this.emit({ t: 'text', x: p.x, y: p.y - 20, text: key === 'curse' ? '저주받은 적이 없다' : key === 'poison' ? '중독된 적이 없다' : '불타는 적이 없다', color: '#a8b0c0' });
        break;
      }
      case 'zone': {
        let c = op.at === 'aim' ? (ctx.auto && ctx.point ? { ...ctx.point } : ctx.auto && ctx.target ? { x: ctx.target.x, y: ctx.target.y } : this.aimPoint(200)) : { x: p.x, y: p.y + 2 };
        if (op.kind === 'bait') { const traps = this.zones.filter((z) => z.kind === 'trap' && z.t > 0); if (traps.length) { const tr = traps.reduce((a, b) => (Math.hypot(b.x - c.x, b.y - c.y) < Math.hypot(a.x - c.x, a.y - c.y) ? b : a)); c = { x: tr.x, y: tr.y }; this.emit({ t: 'text', x: c.x, y: c.y - 18, text: '덫 위에 미끼', color: '#ffcf8a' }); } }
        const atk = ctx.atk * ctx.bonus * (op.scaleRes ? ctx.resMul : 1);
        if (op.max) { const mine = this.zones.filter((z) => z.kind === op.kind); while (mine.length >= op.max) { const old = mine.shift(); old.t = 0; } }
        if (op.wall) {
          const nx = -p.aimY, ny = p.aimX;
          for (let i = 0; i < op.wall; i++) { const k = (i - (op.wall - 1) / 2) * op.r * 1.6; this.zones.push({ kind: op.kind, x: c.x + nx * k, y: c.y + ny * k, r: op.r, t: op.dur, max: op.dur, tick: 0, atk }); }
        } else this.zones.push({ kind: op.kind, x: c.x, y: c.y, r: op.r, t: op.dur, max: op.dur, tick: 0, atk });
        this.emit({ t: 'zoneFx', x: c.x, y: c.y, r: op.r, kind: op.kind });
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
        const c = ctx.auto && ctx.point ? ctx.point : ctx.auto && ctx.target ? { x: ctx.target.x, y: ctx.target.y } : this.aimPoint(160);
        const elems = [...new Set(sp.map((a) => a.elem))];
        for (const a of sp) { if (!op.keep) a.t = 0; this.emit({ t: 'skillDash', x1: a.x, y1: a.y, x2: c.x, y2: c.y, elem: a.elem }); }
        this.emit({ t: 'skillAoe', x: c.x, y: c.y, r: op.r, elem: elems[0], fx: 'meteor' });
        for (const e of this.enemiesNear(c.x, c.y, op.r)) {
          this.skillHit(e, { mul: op.mul * (1 + 0.35 * (sp.length - 1)) }, { ...ctx, elem: elems[0] });
          for (const el of elems) this.applyStatus(e, ELEM[el].status, 2);
        }
        break;
      }
      case 'raiseSouls': {
        if (!p.souls.length) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '거둔 영혼이 없다', color: '#a8b0c0' }); p.cds[ctx.id] = 0.5; this.addRes(ctx.spent); break; }
        const living = this.allies.filter((a) => a.kind === 'soul').length;
        if (living >= 5) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '부하는 최대 5마리', color: '#a8b0c0' }); p.cds[ctx.id] = 0.5; this.addRes(ctx.spent); break; }
        p.souls.sort((a, b) => b.maxHp - a.maxHp);
        const raised = p.souls.splice(0, Math.min(op.n, 5 - living));
        raised.forEach((sv, i) => {
          const a = (i / raised.length) * Math.PI * 2 + 0.5;
          let x = p.x + Math.cos(a) * 20, y = p.y + Math.sin(a) * 20;
          if (this.blocked(x, y, 5)) { x = p.x; y = p.y; }
          const hp = sv.maxHp * 0.5;
          this.allies.push({ id: this.nextId++, kind: 'soul', perm: true, defId: sv.defId, hp, maxHp: hp, x, y, t: 40, max: 40,
            atk: sv.atk * 0.5 * ctx.bonus, cd: 0.3 + i * 0.15, phase: a, dir: 1, r: sv.r, scale: sv.scale });
          this.emit({ t: 'summonFx', x, y, kind: 'soul', big: i === 0 });
        });
        this.emit({ t: 'text', x: p.x, y: p.y - 24, text: `영혼 ${raised.length} 소환 · 남은 영혼 ${p.souls.length}`, color: '#7ae8ff' });
        break;
      }
      case 'taunt': {
        const mine = this.allies.filter((a) => a.hp > 0);
        if (!mine.length) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '부하가 없다', color: '#a8b0c0' }); break; }
        for (const al of mine) { al.tauntT = op.dur; this.emit({ t: 'skillAoe', x: al.x, y: al.y, r: 40, elem: 'dark', fx: 'taunt' }); }
        for (const e of this.enemies) {
          if (e.dead || e.hidden || e.def.ai === 'dummy') continue;
          let best = null, bd = op.r;
          for (const al of mine) { const dd = Math.hypot(al.x - e.x, al.y - e.y); if (dd < bd) { bd = dd; best = al; } }
          if (!best && Math.hypot(e.x - p.x, e.y - p.y) < op.r) best = mine.reduce((a, b) => (Math.hypot(a.x - e.x, a.y - e.y) < Math.hypot(b.x - e.x, b.y - e.y) ? a : b));
          if (best) { e.taunt = best; e.tauntT = op.dur; this.aggro(e); this.emit({ t: 'tauntLink', x1: best.x, y1: best.y, x2: e.x, y2: e.y }); }
        }
        break;
      }
      case 'line': {
        const x1 = p.x, y1 = p.y, ax = p.aimX, ay = p.aimY;
        let len = op.len;
        const run = () => {
          const x2 = x1 + ax * len, y2 = y1 + ay * len;
          this.emit({ t: 'skillLine', x1, y1, x2, y2, w: op.w, elem: ctx.elem, fx: op.fx || ctx.def.fx, ult: ctx.def.ult });
          countHits(this.enemies.filter((e) => !e.dead && !e.hidden && distToSeg(e.x, e.y, x1, y1, x2, y2) < e.r + op.w / 2));
        };
        if (op.delay) { this.emit({ t: 'lineTele', x1, y1, x2: x1 + ax * len, y2: y1 + ay * len, w: op.w, dur: op.delay }); this.delayed.push({ t: op.delay, run }); }
        else run();
        break;
      }
      case 'blastSummons': {
        let mine = this.allies.filter((a) => a.kind !== 'spirit' && a.kind !== 'spiritKing');
        if (op.n) mine = mine.sort((a, b) => (a.maxHp ? a.hp / a.maxHp : 1) - (b.maxHp ? b.hp / b.maxHp : 1)).slice(0, op.n);
        if (!mine.length) {
          const e = ctx.target && !ctx.target.dead ? ctx.target : this.nearestEnemy(160);
          if (!e) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '터뜨릴 대상이 없다', color: '#a8b0c0' }); break; }
          this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: op.r, elem: 'dark', fx: 'corpse' });
          for (const o of this.enemiesNear(e.x, e.y, op.r)) this.skillHit(o, { mul: op.mul * 0.8 }, ctx);
          break;
        }
        for (const a of mine) {
          a.t = 0;
          this.emit({ t: 'skillAoe', x: a.x, y: a.y, r: op.r, elem: 'dark', fx: 'corpse' });
          for (const o of this.enemiesNear(a.x, a.y, op.r)) { this.skillHit(o, { mul: op.mul * (a.kind === 'lich' ? 2 : 1) }, ctx); if (a.maxHp && !o.dead) this.damageEnemy(o, a.maxHp * 0.25, 'mag', { src: 'aoe', elem: 'dark' }); }
        }
        this.emit({ t: 'shake', v: 6 });
        break;
      }
      case 'rush': {
        // 대지 거수 돌격: 누르고 있는 동안 달린다 (updateSpecialMove 에서 진행)
        p.rush = { t: 0, dur: op.dur, speed: op.speed, mul: op.mul, ctx, slot: ctx.slot, hit: new Set() };
        this.emit({ t: 'rushStart', x: p.x, y: p.y });
        break;
      }
      case 'leap': {
        let tx, ty;
        if (ctx.auto && ctx.point) { tx = ctx.point.x; ty = ctx.point.y; }
        else if (ctx.auto && ctx.target) { tx = ctx.target.x; ty = ctx.target.y; }
        else { const ap = this.aimPoint(op.dist); tx = ap.x; ty = ap.y; }
        let vx = tx - p.x, vy = ty - p.y;
        const l = Math.hypot(vx, vy) || 1;
        let dist = Math.min(op.dist, l);
        vx /= l; vy /= l;
        while (dist > 0 && this.blocked(p.x + vx * dist, p.y + vy * dist, 5)) dist -= 6;
        p.leap = { t: 0, dur: op.air, x1: p.x, y1: p.y, x2: p.x + vx * Math.max(0, dist), y2: p.y + vy * Math.max(0, dist), op, ctx };
        this.motion('leap', op.air + 0.15);
        break;
      }
      case 'soar': {
        p.airT = op.dur; p.soar = { op, ctx, max: op.dur };
        p.invuln = Math.max(p.invuln, op.dur);
        this.emit({ t: 'soarUp', x: p.x, y: p.y });
        this.motion('soar', op.dur + 0.2);
        break;
      }
      case 'snatch': {
        const e = ctx.target && !ctx.target.dead && Math.hypot(ctx.target.x - p.x, ctx.target.y - p.y) < op.range + 30 ? ctx.target : this.nearestEnemy(op.range);
        if (!e) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '대상 없음', color: '#a8b0c0' }); break; }
        this.emit({ t: 'skillSingle', x: e.x, y: e.y, fx: 'claws', elem: ctx.elem });
        if (e.def.elite || e.champion || e.def.ai === 'dummy') { this.skillHit(e, { mul: op.mul * 0.6, stun: 0.5 }, ctx); break; }
        e.carried = op.dur; e.windT = 0;
        p.airT = op.dur; p.invuln = Math.max(p.invuln, op.dur);
        this.motion('soar', op.dur + 0.2);
        this.delayed.push({ t: op.dur, run: () => {
          p.airT = 0; e.carried = 0;
          if (e.dead) return;
          e.x = p.x + p.aimX * 10; e.y = p.y + p.aimY * 6;
          if (this.blocked(e.x, e.y, 4)) { e.x = p.x; e.y = p.y; }
          this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: op.r, elem: 'fire', fx: 'quake' });
          this.emit({ t: 'land', x: p.x, y: p.y, big: true });
          this.skillHit(e, { mul: op.mul, stun: 0.8 }, ctx);
          for (const o of this.enemiesNear(e.x, e.y, op.r)) if (o !== e) this.skillHit(o, { mul: op.mul * 0.5, stacks: 1 }, ctx);
        } });
        break;
      }
      case 'rewind': {
        const back = Math.round(op.sec * 10);
        const h = p.hist[Math.max(0, p.hist.length - 1 - back)];
        if (!h) break;
        const x1 = p.x, y1 = p.y;
        const pts = p.hist.slice(-back).map((q) => ({ x: q.x, y: q.y }));
        if (!this.blocked(h.x, h.y, 5)) { p.x = h.x; p.y = h.y; }
        const healed = Math.max(0, h.hp - p.hp);
        p.hp = Math.max(p.hp, Math.min(this.d.maxHp, h.hp));
        p.invuln = Math.max(p.invuln, 0.4);
        this.emit({ t: 'rewind', x1, y1, x2: p.x, y2: p.y, pts });
        if (healed > 0) this.emit({ t: 'text', x: p.x, y: p.y - 22, text: `+${Math.round(healed)}`, color: '#b98aff' });
        break;
      }
      case 'provoke': {
        let n = 0;
        for (const e of this.enemies) {
          if (e.dead || e.hidden || e.def.ai === 'dummy' || Math.hypot(e.x - p.x, e.y - p.y) > op.r) continue;
          e.provokeT = op.dur; e.provokeBy = null; e.taunt = null; e.tauntT = 0; e.loseT = 0; e.lureT = 0; this.aggro(e); n++;
          this.emit({ t: 'tauntLink', x1: p.x, y1: p.y, x2: e.x, y2: e.y, color: '#ffd84a' });
        }
        this.emit({ t: 'skillAoe', x: p.x, y: p.y, r: op.r, fx: 'provoke' });
        if (!n) this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '주변에 적이 없다', color: '#a8b0c0' });
        break;
      }
      case 'link': {
        const c = ctx.auto && ctx.point ? ctx.point : ctx.auto && ctx.target ? { x: ctx.target.x, y: ctx.target.y } : this.aimPoint(200);
        const list = this.enemiesNear(c.x, c.y, op.r).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, op.n);
        if (list.length < 2) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '이을 적이 부족하다', color: '#a8b0c0' }); if (list[0]) this.applyStatus(list[0], 'curse', 2); break; }
        const id = this.linkSeq++;
        for (const e of list) { e.link = { id, t: op.dur, share: op.share }; this.applyStatus(e, 'curse', 1); }
        this.emit({ t: 'skillAoe', x: c.x, y: c.y, r: op.r * 0.6, elem: 'dark', fx: 'rune' });
        break;
      }
      case 'spread': {
        const src = this.enemies.filter((e) => !e.dead && e.st[op.what]);
        if (!src.length) { this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '저주받은 적이 없다', color: '#a8b0c0' }); break; }
        const snap = src.map((e) => [e, e.st[op.what].n]);
        for (const [e, n] of snap) {
          this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: op.r, elem: 'dark', fx: 'spread' });
          for (const o of this.enemiesNear(e.x, e.y, op.r)) {
            if (o === e) continue;
            this.emit({ t: 'tauntLink', x1: e.x, y1: e.y, x2: o.x, y2: o.y, color: '#c45cff' });
            this.applyStatus(o, op.what, n * 2);
            this.skillHit(o, { mul: op.mul * Math.min(6, n) * 0.3 }, ctx);
          }
          this.skillHit(e, { mul: op.mul * Math.min(6, n) * 0.3 }, ctx);
        }
        break;
      }
      case 'stealth': {
        p.stealthT = op.dur; p.invuln = Math.max(p.invuln, 0.3);
        for (const e of this.enemies) if (!e.dead && e.state === 'chase') { e.loseT = op.dur; e.windT = 0; }
        this.emit({ t: 'stealthOn', x: p.x, y: p.y });
        break;
      }
      case 'danceStrike': {
        const cand = this.enemiesNear(p.x, p.y, op.r).filter((e) => e.def.ai !== 'dummy' || this.mode === 'plaza' || this.practice);
        if (!cand.length) break;
        let e = cand[this.rng.int(0, cand.length - 1)];
        if (cand.length > 1 && e.id === p.lastDance) e = cand.find((o) => o.id !== p.lastDance);
        p.lastDance = e.id;
        // 적을 꿰뚫고 지나가는 자리 (적 너머로): 달려가 지나가면서 벤다
        const ang0 = Math.atan2(e.y - p.y, e.x - p.x) + this.rng.range(-0.5, 0.5), over = e.r + 14;
        let tx = e.x + Math.cos(ang0) * over, ty = e.y + Math.sin(ang0) * over;
        if (this.blocked(tx, ty, 5)) { tx = e.x - Math.cos(ang0) * over; ty = e.y - Math.sin(ang0) * over; if (this.blocked(tx, ty, 5)) { tx = e.x; ty = e.y; } }
        this.emit({ t: 'danceDash', x1: p.x, y1: p.y, x2: tx, y2: ty });
        p.dance = { x0: p.x, y0: p.y, x1: tx, y1: ty, t: 0, dur: 0.13, e, op, ctx, ang: ang0 };
        this.faceTo(tx, ty);
        this.motion('stab', 0.3);
        break;
      }
      case 'bind': {
        if (p.spirits.length >= 3) { const old = p.spirits.shift(); this.emit({ t: 'spiritOut', x: p.x, y: p.y, elem: old.elem }); }
        p.spirits.push({ elem: op.elem, t: op.dur, max: op.dur, phase: this.rng.range(0, 6.28) });
        if (op.elem === 'forest') p.shield = Math.min(this.d.maxHp * 0.5, p.shield + this.d.maxHp * 0.06 * this.spiritCount('forest'));
        this.emit({ t: 'spiritIn', x: p.x, y: p.y, elem: op.elem, n: this.spiritCount(op.elem) });
        break;
      }
      case 'summonSpirit': this.summonFamiliar(op.dur, 0); break;
      case 'spiritEmpower': { if (!p.familiar) this.summonFamiliar(20, op.dur); else { p.familiar.emp = op.dur; this.emit({ t: 'spiritIn', x: p.familiar.x, y: p.familiar.y + 10, elem: p.familiar.elem, n: 3 }); } this.emit({ t: 'text', x: p.x, y: p.y - 30, text: '정령 강화!', color: SPIRIT_GRADES[SPIRITS[this.b.spirit.id].grade].color }); break; }
      case 'spiritGuard': { if (!p.familiar) this.summonFamiliar(20, 0); p.familiar.guard = op.dur; p.familiar.pushT = 0; this.emit({ t: 'buff', x: p.x, y: p.y, color: ELEM[SPIRIT_DMG_ELEM[p.familiar.elem]]?.color || '#9bffb0' }); break; }
      case 'spiritArrow': {
        const f = p.familiar, n = p.spirits.length;
        const cnt = (k) => this.spiritCount(k);
        const dom = f ? f.elem : ['fire', 'wind', 'forest'].reduce((a, b) => (cnt(b) > cnt(a) ? b : a));
        const elem = f ? SPIRIT_DMG_ELEM[f.elem] : dom === 'fire' ? 'fire' : dom === 'forest' ? 'poison' : null;
        const c2 = { ...ctx, elem, bonus: ctx.bonus * (f ? 1.5 * (1 + 0.1 * f.grade + 0.05 * (f.star - 1)) : 1 + op.per * Math.max(0, n - 1)) }; // 정령이 나와 있으면 그 속성 · 피해 +50%
        this.projs.push({ owner: 'p', x: p.x + p.aimX * 6, y: p.y - 4 + p.aimY * 6, vx: p.aimX * op.speed, vy: p.aimY * op.speed, life: op.range / op.speed, dmg: 0, type: 'mag', pierce: 99, hit: new Set(),
          color: (ELEM[elem] || ELEM[dom] || ELEM.wind).color, kind: 'skill', skind: 'spiritArrow', spiritElems: f ? [SPIRIT_DMG_ELEM[f.elem]] : p.spirits.map((q) => q.elem), big: true,
          skillHit: (e) => this.skillHit(e, { mul: op.mul, stacks: 2 }, c2) });
        this.emit({ t: 'shoot', type: 'mag', x: p.x, y: p.y });
        break;
      }
      case 'kingDescend': {
        const cnt = (k) => this.spiritCount(k);
        const cycle = ['fire', 'wind', 'forest'];
        const fe = p.familiar?.elem; // 함께하는 정령이 불 · 바람 · 숲이면 그 왕
        const dom = cycle.includes(fe) ? fe : p.spirits.length ? cycle.reduce((a, b) => (cnt(b) > cnt(a) ? b : a)) : cycle[(p.kingCycle = ((p.kingCycle ?? -1) + 1) % 3)];
        p.spirits = [0, 1, 2].map((i) => ({ elem: dom, t: op.dur, max: op.dur, phase: i * 2.1 }));
        p.kingT = op.dur;
        const elem = dom === 'fire' ? 'fire' : dom === 'wind' ? 'lightning' : 'poison';
        this.emit({ t: 'banner', text: `${ELEM[dom].name}의 정령왕 강림`, color: ELEM[dom].color });
        for (const a of this.allies) if (a.kind === 'spiritKing') a.t = 0;
        let kx = p.x + p.dir * 26, ky = p.y;
        if (this.blocked(kx, ky, 6)) kx = p.x;
        this.allies.push({ id: this.nextId++, kind: 'spiritKing', elem, spirit: dom, hp: 0, maxHp: 0, x: kx, y: ky, t: op.dur, max: op.dur,
          atk: ctx.atk * op.mul * (op.scaleRes ? ctx.resMul : 1) * ctx.bonus, cd: 0.6, phase: 0, dir: p.dir, punchT: 0 });
        this.emit({ t: 'summonFx', x: kx, y: ky - 24, kind: 'spiritKing', elem, big: true });
        break;
      }
      case 'shield': {
        p.shield = Math.min(this.d.maxHp * 0.6, p.shield + this.d.maxHp * op.v);
        this.emit({ t: 'buff', x: p.x, y: p.y, color: '#ffb066', bubble: true });
        break;
      }
      case 'fillWords': {
        while (p.words.length < 3) p.words.push(op.word);
        this.emit({ t: 'wordAdd', words: [...p.words] });
        this.sentence();
        break;
      }
      case 'orbit': {
        for (const al of this.allies) if (al.kind === 'orbitAxe') al.t = 0;
        for (let i = 0; i < op.n; i++) this.allies.push({ id: this.nextId++, kind: 'orbitAxe', x: p.x, y: p.y, t: op.dur, max: op.dur, phase: (i / op.n) * Math.PI * 2, r: op.r,
          atk: ctx.atk * op.mul * ctx.resMul * ctx.bonus, hitCd: {}, dir: 1, cd: 0 });
        break;
      }
      case 'silence': {
        const dur = op.dur * Math.min(2, ctx.resMul);
        let n = 0;
        for (const e of this.enemiesNear(p.x, p.y, op.r)) { if (e.def.ai === 'dummy') continue; e.silenceT = dur; e.windT = 0; e.fuse = 0; n++; }
        this.emit({ t: 'silence', x: p.x, y: p.y, r: op.r });
        if (!n) this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '주변에 적이 없다', color: '#a8b0c0' });
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

  // ═══════ 클래스 장치 ═══════
  // 정령사: 깃든 정령 (시간이 지나면 떠난다, 정령왕 강림 중에는 멈춘다)
  spiritCount(elem) { return this.player.spirits.reduce((n, s) => n + (s.elem === elem ? 1 : 0), 0); }
  updateSpirits() {
    const p = this.player;
    if (p.kingT > 0) p.kingT -= DT;
    if (!p.spirits.length) return;
    for (const s of p.spirits) { if (!(p.kingT > 0)) s.t -= DT; s.phase += DT * 2.4; }
    const gone = p.spirits.filter((s) => s.t <= 0);
    for (const s of gone) this.emit({ t: 'spiritOut', x: p.x, y: p.y, elem: s.elem });
    if (gone.length) p.spirits = p.spirits.filter((s) => s.t > 0);
    const forest = this.spiritCount('forest');
    if (forest) this.heal(this.d.maxHp * 0.008 * forest * DT, 'regen');
  }

  // 계약한 정령: 불러내면 어깨 위를 떠다니며 버프를 주고, 가까운 적을 그 속성으로 공격한다
  summonFamiliar(dur, emp = 0) {
    const p = this.player, sp = this.b.spirit, S = SPIRITS[sp?.id];
    if (!S) return;
    const old = p.familiar;
    p.familiar = { id: S.id, elem: S.elem, grade: S.grade, star: sp.star || 1, lv: sp.lv || 1, t: dur, max: dur, emp, guard: 0, cd: 0.4, x: old?.x ?? p.x - p.dir * 12, y: old?.y ?? p.y - 18, phase: old?.phase || 0 };
    this.emit({ t: 'spiritIn', x: p.familiar.x, y: p.familiar.y + 10, elem: SPIRIT_DMG_ELEM[S.elem], n: 1 + S.grade });
    if (!old) this.emit({ t: 'text', x: p.x, y: p.y - 34, text: `${S.name}${'★'.repeat(p.familiar.star)} Lv ${p.familiar.lv}`, color: SPIRIT_GRADES[S.grade].color });
  }
  updateFamiliar() {
    const p = this.player, f = p.familiar;
    if (!f) { if (p.buffs.spiritBond) delete p.buffs.spiritBond; if (p.buffs.spiritGuard) delete p.buffs.spiritGuard; return; }
    f.t -= DT; if (f.emp > 0) f.emp -= DT; if (f.guard > 0) f.guard -= DT;
    if (this.t - (p.lastFight ?? -99) < 5 && !this.practice) { f.xpAcc = (f.xpAcc || 0) + DT * (this.b.cls === 'spiritcaller' ? 1.5 : 1); if (f.xpAcc >= 5) { this.signals.push({ t: 'spiritXp', id: f.id, v: f.xpAcc }); f.xpAcc = 0; } } // 함께 싸운 시간 → 정령 레벨
    if (f.t <= 0 || this.state !== 'play') { this.emit({ t: 'spiritOut', x: f.x, y: f.y + 10, elem: SPIRIT_DMG_ELEM[f.elem] }); p.familiar = null; delete p.buffs.spiritBond; delete p.buffs.spiritGuard; return; }
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
    // 공격: 내 둘레 150 안의 가장 가까운 적에게 속성 탄 (강화 중이면 2배 빠르게 · 피해 +60%)
    f.cd -= DT * (f.emp > 0 ? 2 : 1);
    if (f.cd > 0) return;
    let tgt = null, td = 150;
    for (const e of this.enemies) { if (e.dead || e.hidden || e.def.ai === 'dummy' && !this.practice && this.mode !== 'plaza') continue; const d2 = Math.hypot(e.x - p.x, e.y - p.y); if (d2 < td) { td = d2; tgt = e; } }
    if (!tgt) { f.cd = 0.2; return; }
    f.cd = 1.15 - 0.08 * f.grade;
    const elem = SPIRIT_DMG_ELEM[f.elem], dmg = this.skillAtk('best') * 0.42 * E.atk * spiritPower(f.id, f.star, f.lv) * (f.emp > 0 ? 1.6 : 1);
    const ax = tgt.x - f.x, ay = tgt.y - 8 - f.y, al = Math.hypot(ax, ay) || 1, spd = 230;
    this.projs.push({ owner: 'p', x: f.x, y: f.y, vx: (ax / al) * spd, vy: (ay / al) * spd, life: 1.1, dmg: 0, type: 'mag', pierce: E.pierce ? 2 : 0, hit: new Set(), splash: 0,
      color: col, kind: 'skill', skind: 'spiritBolt', elem, big: false, rot: Math.atan2(ay, ax), homing: true,
      skillHit: (e) => {
        this.damageEnemy(e, dmg, 'mag', { src: 'spirit', elem, color: col });
        if (!e.dead && E.status) this.applyStatus(e, E.status, 1 + (f.grade >= 2 ? 1 : 0));
        if (E.chain) { let o = null, od = 70; for (const x of this.enemies) { if (x === e || x.dead || x.hidden) continue; const dd = Math.hypot(x.x - e.x, x.y - e.y); if (dd < od) { od = dd; o = x; } } if (o) { this.emit({ t: 'bolt', pts: [{ x: e.x, y: e.y - 6 }, { x: o.x, y: o.y - 6 }], color: col }); this.damageEnemy(o, dmg * 0.6, 'mag', { src: 'spirit', elem }); } }
      } });
    this.emit({ t: 'spiritShot', x: f.x, y: f.y, elem });
  }

  // 포식자: 출혈 걸린 적에게 다가갈 때 빨라진다
  predatorSpeed(mx, my, ml) {
    if (this.b.cls !== 'predator' || ml <= 0) return 1;
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead || !e.st.bleed) continue;
      const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy);
      if (l < 200 && (dx * mx + dy * my) / (l || 1) > 0.5) return 1.25;
    }
    return 1;
  }

  // 은신: 공격하거나 스킬을 쓰면 풀리고, 그 첫 공격은 3배
  breakStealth() {
    const p = this.player;
    if (p.stealthT <= 0) return;
    p.stealthT = 0; p.stealthStrike = true;
    for (const e of this.enemies) e.loseT = 0;
    this.emit({ t: 'stealthOff', x: p.x, y: p.y });
  }

  // 차지 · 돌격 · 도약 · 비상: 이 동작 중에는 일반 이동을 대신한다. 처리했으면 true
  // 절벽 끝: 바라보는 쪽(아래 · 옆)으로 2~4칸 너머에 더 낮은 땅이 있으면 그 자리
  ledgeTarget(mx, my) {
    const m = this.map, p = this.player;
    if (!m.outdoor || m.underwater || !m.level || p.swim || p.boat) return null;
    let dx = 0, dy = 0;
    if (my > 0.75) dy = 1; else if (Math.abs(mx) > 0.75) dx = Math.sign(mx); else return null;
    const tw = this.tw, th = this.th, tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE), here = m.level[ty * tw + tx];
    const fx = Math.floor((p.x + dx * (p.r + 2)) / TILE), fy = Math.floor((p.y + dy * (p.r + 2)) / TILE);
    if ((fx === tx && fy === ty) || this.tiles[fy * tw + fx] !== T_WALL) return null;
    for (let k = 1; k <= 4; k++) {
      const lx = tx + dx * k, ly = ty + dy * k;
      if (lx < 0 || ly < 0 || lx >= tw || ly >= th) return null;
      const tt = this.tiles[ly * tw + lx];
      if (tt === T_WALL) continue;
      if ((tt !== T_FLOOR && tt !== T_LIQUID) || m.level[ly * tw + lx] >= here) return null;
      const x = dx ? lx * TILE + 8 : p.x, y = dy ? ly * TILE + 8 : p.y;
      if (this.blocked(x, y, 4)) return null;
      return { x, y, k };
    }
    return null;
  }
  updateSpecialMove(inp, mx, my, ml) {
    const p = this.player, d = this.d;
    if (p.dance) { // 그림자 춤: 적을 스치며 지나간다 (지나가는 순간 벤다)
      const D = p.dance; D.t += DT;
      const k = Math.min(1, D.t / D.dur);
      p.x = D.x0 + (D.x1 - D.x0) * k; p.y = D.y0 + (D.y1 - D.y0) * k; p.invuln = Math.max(p.invuln, 0.15);
      if (!D.hit && k >= 0.55) { D.hit = true; if (!D.e.dead) { this.emit({ t: 'danceCut', x: D.e.x, y: D.e.y, ang: D.ang }); this.skillHit(D.e, D.op, D.ctx); } }
      if (k >= 1) { p.dance = null; if (!D.e.dead) this.faceTo(D.e.x, D.e.y); }
      return true;
    }
    if (p.combo) { // 연속베기: 한 바퀴마다 앞으로 한 걸음 나아가며 둘레를 벤다
      const C = p.combo, op = C.op;
      C.t -= DT;
      if (C.t <= 0) {
        if (C.i >= op.n) { p.combo = null; return false; }
        const last = C.i === op.n - 1, ux = Math.cos(C.ang), uy = Math.sin(C.ang);
        let step = op.step; while (step > 0 && this.blocked(p.x + ux * step, p.y + uy * step, 5)) step -= 4;
        p.dashT = 0.12; p.dvx = ux * step / 0.12; p.dvy = uy * step / 0.12;
        this.motion('spin', op.every + 0.05);
        this.emit({ t: 'spin', x: p.x + ux * step, y: p.y + uy * step, r: op.r, type: 'phys', ang: C.ang + C.i * 2.1, dir: C.i % 2 ? -1 : 1, heavy: last, follow: true });
        this.emit({ t: 'hitstop', v: last ? 0.06 : 0.025 });
        const cx = p.x + ux * step * 0.6, cy = p.y + uy * step * 0.6;
        for (const e of this.enemiesNear(cx, cy, op.r)) this.skillHit(e, { mul: last ? op.last : op.mul, knock: last ? op.knock * 1.8 : op.knock }, C.ctx);
        C.i++; C.t = op.every;
      }
      if (p.dashT > 0) { p.dashT -= DT; this.move(p, p.dvx * DT, p.dvy * DT); }
      return true;
    }
    if (p.fallInto) { // 구멍으로 뛰어든다: 가장자리로 한 번 뛰고, 작아지며 빨려 들어간다
      const F = p.fallInto; F.t += DT;
      const k = Math.min(1, F.t / F.dur), q = Math.min(1, k / 0.4), e = 1 - (1 - q) * (1 - q);
      p.x = F.x0 + (F.tx - F.x0) * e; p.y = F.y0 + (F.ty - F.y0) * e;
      p.air = k < 0.4 ? Math.sin(q * Math.PI) * 12 : 0;
      p.invuln = 1; p.moving = false;
      if (k >= 1 && !F.sent) { F.sent = true; this.signals.push({ t: 'enterZone', entrance: F.id, x: F.ox, y: F.oy }); }
      return true;
    }
    if (p.drop) { // 위에서 떨어져 내린다 (구멍 아래 · 천장에서)
      const D = p.drop; D.v += 900 * DT; D.h = Math.max(0, D.h - D.v * DT);
      p.air = D.h; p.invuln = Math.max(p.invuln, 0.3); p.moving = false;
      if (D.h <= 0) { p.drop = null; p.air = 0; p.landT = 0.32; this.emit({ t: 'thud', x: p.x, y: p.y, big: true }); }
      return true;
    }
    if (p.hop) { // 절벽에서 뛰어내린다: 살짝 뛰었다가 아래로 떨어져 착지
      const H = p.hop; H.t += DT;
      const k = Math.min(1, H.t / H.dur);
      p.x = H.x0 + (H.x1 - H.x0) * k; p.y = H.y0 + (H.y1 - H.y0) * (k * k * 0.65 + k * 0.35);
      p.air = Math.sin(k * Math.PI) * H.h;
      p.invuln = Math.max(p.invuln, 0.1);
      if (k >= 1) { p.hop = null; p.air = 0; p.landT = 0.22; this.emit({ t: 'thud', x: p.x, y: p.y }); }
      return true;
    }
    const lg = ml > 0 && !p.dashT && !p.charging && !p.rush && !p.leap && !(p.airT > 0) ? this.ledgeTarget(mx, my) : null;
    if (lg) {
      p.ledgeT = (p.ledgeT || 0) + DT;
      if (p.ledgeT > 0.14) { p.ledgeT = 0; p.hop = { t: 0, dur: 0.3 + 0.06 * lg.k, x0: p.x, y0: p.y, x1: lg.x, y1: lg.y, h: 9 + lg.k * 2 }; this.motion('leap', p.hop.dur); this.emit({ t: 'hopStart', x: p.x, y: p.y }); return true; }
    } else p.ledgeT = 0;
    if (p.charging) {
      const c = p.charging;
      c.t += DT;
      const lvl = Math.min(3, Math.floor(c.t / 0.4));
      if (lvl > c.lvl) { c.lvl = lvl; this.emit({ t: 'chargeLvl', x: p.x, y: p.y, lvl }); }
      const held = c.slot == null ? c.t < 0.8 : !!this.inpHold?.['h' + (c.slot + 1)];
      if (p.motion) p.motion.t = Math.min(p.motion.t, 0.2);
      if (!held || c.t >= 1.3) {
        p.charging = null;
        this.execSkill(c.def, c.spent, c.id, { charge: c.lvl, slot: c.slot });
      }
      return false; // 느리게 걷기는 일반 이동에서 처리
    }
    if (p.rush) {
      const r = p.rush;
      r.t += DT;
      const held = r.slot == null ? r.t < 1.2 : !!this.inpHold?.['h' + (r.slot + 1)];
      const dx = p.aimX, dy = p.aimY;
      const spd = r.speed * (0.7 + Math.min(1, r.t * 2) * 0.5);
      const bx = p.x, by = p.y;
      this.move(p, dx * spd * DT, dy * spd * DT);
      const stuck = Math.hypot(p.x - bx, p.y - by) < spd * DT * 0.3;
      p.walkT += DT * 2; p.moving = true;
      if (!this.motionIs('charge')) this.motion('charge', 9);
      // 앞의 적을 밀고 간다
      for (const e of this.enemiesNear(p.x + dx * 8, p.y + dy * 8, 12)) {
        if (e.def.ai === 'dummy') { if (!r.hit.has(e.id)) { r.hit.add(e.id); this.skillHit(e, { mul: r.mul }, r.ctx); } continue; }
        if (!r.hit.has(e.id)) { r.hit.add(e.id); this.skillHit(e, { mul: r.mul * (1 + r.t) }, r.ctx); }
        if (!e.def.elite) { e.kbx = dx * spd * 1.3; e.kby = dy * spd * 1.3; e.kbHot = 0.4; this.stunE(e, 0.2); }
      }
      if (Math.floor(r.t * 12) !== Math.floor((r.t - DT) * 12)) this.emit({ t: 'rushDust', x: p.x, y: p.y, dx, dy });
      if (!held || r.t >= r.dur || stuck) {
        p.rush = null;
        const cx = p.x + dx * 18, cy = p.y + dy * 18;
        this.emit({ t: 'skillAoe', x: cx, y: cy, r: 44, fx: 'quake' });
        this.emit({ t: 'shake', v: 4 + r.t * 3 });
        for (const e of this.enemiesNear(cx, cy, 44)) this.skillHit(e, { mul: r.mul * (1 + r.t * 1.5), knock: 280 }, r.ctx);
        p.motion = null; this.motion('headbutt', 0.3);
      }
      return true;
    }
    if (p.leap) {
      const L = p.leap;
      L.t += DT;
      const k = Math.min(1, L.t / L.dur);
      p.x = L.x1 + (L.x2 - L.x1) * k; p.y = L.y1 + (L.y2 - L.y1) * k;
      p.air = Math.sin(k * Math.PI) * 26;
      p.invuln = Math.max(p.invuln, 0.1);
      if (k >= 1) {
        p.leap = null; p.air = 0;
        const op = L.op;
        this.emit({ t: 'skillAoe', x: p.x, y: p.y, r: op.r, fx: 'slam' });
        this.emit({ t: 'land', x: p.x, y: p.y, big: true });
        for (const e of this.enemiesNear(p.x, p.y, op.r)) this.skillHit(e, op, L.ctx);
      }
      return true;
    }
    if (p.airT > 0) {
      p.airT -= DT;
      const sk = p.soar;
      const spd = d.moveSpeed * this.mod('moveSpeed') * 1.5;
      this.move(p, mx * spd * DT, my * spd * DT);
      p.moving = ml > 0; if (p.moving) p.walkT += DT;
      p.air = Math.min(30, (p.air || 0) + DT * 160);
      if (sk && p.airT <= 0) this.landSoar();
      return true;
    }
    if (p.air) p.air = Math.max(0, p.air - DT * 200);
    return false;
  }

  motionIs(kind) { return this.player.motion?.kind === kind; }

  landSoar() {
    const p = this.player, sk = p.soar;
    p.airT = 0; p.soar = null;
    if (!sk) return;
    const op = sk.op;
    p.invuln = Math.max(p.invuln, 0.25);
    this.emit({ t: 'skillAoe', x: p.x, y: p.y, r: op.r, elem: 'fire', fx: 'pillar' });
    this.emit({ t: 'land', x: p.x, y: p.y, big: true });
    for (const e of this.enemiesNear(p.x, p.y, op.r)) this.skillHit(e, op, sk.ctx);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; this.zones.push({ kind: 'fire', x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 14, r: 18, t: 3, max: 3, tick: 0, atk: sk.ctx.atk }); }
    p.motion = null; this.motion('stomp', 0.35);
  }

  // 용언 술사: 단어 3개가 차면 문장이 발동한다. 같은 단어를 겹칠수록 제곱으로 강해진다
  addWord(word) {
    const p = this.player;
    p.words.push(word);
    this.emit({ t: 'wordAdd', words: [...p.words] });
    if (p.words.length >= 3) this.sentence();
  }
  sentence() {
    const p = this.player, words = p.words.splice(0, 3);
    const cnt = {};
    for (const w of words) cnt[w] = (cnt[w] || 0) + 1;
    const ctx = { def: SKILLS.wordFire, id: 'sentence', spent: 0, elem: 'fire', bonus: 1, atk: this.skillAtk('mag'), resMul: 1 };
    const tg = this.pickTarget({ aim: 'cluster', do: [{ op: 'aoe', at: 'aim' }] });
    const c = tg ? { x: tg.x, y: tg.y } : this.aimPoint(120);
    this.emit({ t: 'sentence', words, x: p.x, y: p.y, tx: c.x, ty: c.y });
    this.motion('castBig', 0.5);
    // 허공에 세 글자를 쓰고, 하나로 합쳐진 글자가 목표에 닿는 순간 문장이 발동한다
    this.delayed.push({ t: 0.7, run: () => { if (this.state === 'play') this.sentenceHit(words, cnt, c, ctx); } });
  }
  sentenceHit(words, cnt, c, ctx) {
    // 언령: 첫 단어가 문장의 몸통(무엇이 일어나는가), 둘째 · 셋째 단어가 꾸민다. 순서가 바뀌면 다른 문장이 된다.
    // 마력 언령(불 · 하늘)은 마력으로 부수고, 정신 언령(비늘 · 대지 · 날개)은 정신으로 지키고 묶는다.
    // 같은 단어를 이으면 강세, 같은 계열은 합성, 다른 계열을 아무렇게나 이으면 말이 엇갈려 약해진다.
    const p = this.player, [w1, w2, w3] = words, fam = (w) => WORD_FAMILY[w];
    const race = this.b.race === 'dragon' ? 1.25 : 0.85; // 용족의 혀로 말해야 제 힘이 난다 (예전 저장으로 배운 다른 종족은 약하게)
    const spiK = 0.6 + Math.max(0, this.s.spi || 0) / 40; // 정신 언령의 힘
    const famK = (w) => (fam(w) === 'mind' ? spiK : 1) * race;
    let P = 1, combo = WORD_COMBO[`${w1}>${w2}`] || null, mood = '';
    const extras = [];
    if (combo) mood = combo.name;
    else if (w2 === w1) { P *= 1.4; mood = '강세'; }
    else if (fam(w2) === fam(w1)) { P *= 1.15; extras.push([w2, 0.5]); mood = '합성'; }
    else { P *= 0.7; extras.push([w2, 0.4]); mood = '말이 엇갈렸다'; }
    if (w3 === w1) { P *= 1.3; mood = mood === '강세' ? '완성된 말' : mood; }
    else if (fam(w3) === fam(w1)) { P *= 1.05; extras.push([w3, 0.4]); }
    else { P *= 0.85; extras.push([w3, 0.3]); if (!combo && mood !== '말이 엇갈렸다') mood = '흐트러진 말'; }
    const weak = mood === '말이 엇갈렸다' || mood === '흐트러진 말';
    this.emit({ t: 'text', x: p.x, y: p.y - 36, text: combo ? `「${combo.name}」` : mood, color: weak ? '#a8a0b8' : combo ? '#ffd27a' : '#ffb066' });
    if (combo) combo.run.call(this, P * famK(w1), c, ctx);
    else this.wordEffect(w1, P * famK(w1), c, ctx);
    for (const [w, k] of extras) this.wordEffect(w, k * famK(w), c, ctx);
  }
  // 단어 하나의 효과 (p: 힘)
  wordEffect(w, pw, c, ctx) {
    const p = this.player;
    if (w === 'fire') {
      const r = 34 + 16 * Math.min(2.4, pw);
      this.emit({ t: 'skillAoe', x: c.x, y: c.y, r, elem: 'fire', fx: 'pillar', ult: pw >= 2 });
      for (const e of this.enemiesNear(c.x, c.y, r)) this.skillHit(e, { mul: 2.2 * pw, stacks: Math.round(2 * pw) }, ctx);
    } else if (w === 'sky') {
      const near = this.enemiesNear(c.x, c.y, 120), n = Math.max(1, Math.round(1 + 2.2 * pw));
      for (let i = 0; i < n; i++) {
        const t = near.length ? near[i % near.length] : null, x = (t ? t.x : c.x) + this.rng.range(-14, 14), y = (t ? t.y : c.y) + this.rng.range(-10, 10), dl = 0.5 + i * 0.2;
        this.emit({ t: 'telegraphCircle', x, y, r: 36, dur: dl }); this.emit({ t: 'fall', x, y, r: 36, dur: dl, kind: 'meteor' });
        this.delayed.push({ t: dl, run: () => { this.emit({ t: 'skillAoe', x, y, r: 36, elem: 'fire', fx: 'meteor' }); for (const e of this.enemiesNear(x, y, 36)) this.skillHit(e, { mul: 1.4 * (0.6 + 0.4 * pw), stacks: 1 }, ctx); } });
      }
    } else if (w === 'scale') {
      p.shield = Math.min(this.d.maxHp * 0.6, p.shield + this.d.maxHp * 0.12 * pw * (this.pvp ? PVP.shield : 1));
      if (pw >= 1.8) { p.invuln = Math.max(p.invuln, 1.5); this.emit({ t: 'text', x: p.x, y: p.y - 26, text: '용린 무적', color: '#ffb066' }); }
      this.emit({ t: 'buff', x: p.x, y: p.y, color: '#ffb066', bubble: true });
    } else if (w === 'earth') {
      const r = 46 + 20 * Math.min(2.4, pw);
      this.emit({ t: 'skillAoe', x: p.x, y: p.y, r, fx: 'quake', ult: pw >= 2 });
      for (const e of this.enemiesNear(p.x, p.y, r)) this.skillHit(e, { mul: 0.8 * pw, stun: 0.5 + 0.5 * pw }, { ...ctx, elem: null });
    } else if (w === 'wing') {
      const k = Math.min(16, Math.round(5 + 4 * pw));
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2;
        this.projs.push({ owner: 'p', x: p.x, y: p.y - 4, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 0.7, dmg: 0, type: 'mag', pierce: 2, hit: new Set(), color: '#bfffd0', kind: 'skill', skind: 'windBlade', big: true,
          skillHit: (e) => this.skillHit(e, { mul: 0.6 * pw, knock: 140 }, { ...ctx, elem: null }) });
      }
    }
  }

  tickChannel() {
    const p = this.player, ch = p.channel;
    ch.t -= DT; ch.tick -= DT;
    if (ch.invuln) p.invuln = Math.max(p.invuln, 0.15);
    if (ch.tick <= 0) { ch.tick = ch.every; this.runOp(ch.sub, ch.ctx); }
    if (ch.t <= 0) p.channel = null;
  }

  // ═══════ 소환수 (정령·망령·분신·사령 군주) ═══════
  updateAllies() {
    if (!this.allies.length) return;
    const p = this.player;
    for (const al of this.allies) {
      if (!al.perm) al.t -= DT; // 사령술사의 부하는 쓰러질 때까지
      al.age = (al.age || 0) + DT;
      al.cd -= DT * (p.buffs.fusion && al.kind === 'spirit' ? 2 : 1);
      const near = (r) => { let best = null, bd = r; for (const e of this.enemies) { if (e.dead || e.hidden || e.def.ai === 'dummy' && this.mode !== 'plaza') continue; const dd = Math.hypot(e.x - al.x, e.y - al.y); if (dd < bd) { bd = dd; best = e; } } return best; };
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
          if (e.dead || e.hidden || (e.def.ai === 'dummy' && this.mode !== 'plaza' && !this.practice)) continue;
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
              if (e.dead || e.hidden || e.def.ai === 'dummy' && this.mode !== 'plaza') continue;
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
        if (l > (tgt ? tgt.r + 8 : 6)) {
          const [mx, my] = this.pathDir(al, tx, ty);
          al.r = al.r || 5;
          this.move(al, mx * spd * DT * (al.returning ? 1.4 : 1), my * spd * DT * (al.returning ? 1.4 : 1));
        }
        for (const o of this.allies) {
          if (o === al || o.kind === 'spirit' || o.kind === 'spiritKing') continue;
          const dx = al.x - o.x, dy = al.y - o.y, dd = Math.hypot(dx, dy);
          if (dd < 12 && dd > 0.01) { al.x += (dx / dd) * (12 - dd) * 0.25; al.y += (dy / dd) * (12 - dd) * 0.25; }
          else if (dd <= 0.01) al.x += (al.id % 2 ? 1 : -1);
        }
        if (this.blocked(al.x, al.y, 3)) { al.x = p.x; al.y = p.y; }
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
      if (z.kind === 'trap') {
        const e = this.enemiesNear(z.x, z.y, z.r)[0];
        if (e) {
          z.t = 0;
          this.emit({ t: 'skillAoe', x: z.x, y: z.y, r: 30, elem: 'poison', fx: 'trap' });
          this.stunE(e, e.def.elite ? 0.8 : 2); e.rooted = 2;
          this.damageEnemy(e, z.atk * 1.2, 'phys', { src: 'aoe' }); this.applyStatus(e, 'poison', 4);
        }
        continue;
      }
      if (z.kind === 'slow') for (const e of this.enemiesNear(z.x, z.y, z.r)) { e.st.slowZ = 0.3; e.st.weak = Math.max(e.st.weak || 0, 0.3); }
      if (z.kind === 'smoke') { // 연기 속에 있으면 적이 나를 놓친다 (바로 붙어 있으면 그래도 친다)
        if (Math.hypot(p.x - z.x, p.y - z.y) < z.r * 0.9) for (const e of this.enemies) { if (e.dead || e.def.ai === 'dummy') continue; const de = Math.hypot(e.x - p.x, e.y - p.y); if (de > e.r + p.r + 12 && (e.state === 'chase' || de < 200)) { e.loseT = Math.max(e.loseT || 0, 0.5); e.windT = 0; } }
        continue;
      }
      if (z.kind === 'bait') {
        z.rolled ||= new Map();
        for (const e of this.enemiesNear(z.x, z.y, z.r)) {
          if (e.def.ai === 'dummy' || e.provokeT > 0) continue;
          if (!z.rolled.has(e.id)) z.rolled.set(e.id, this.rng.chance(e.state === 'chase' ? 0.5 : 0.75)); // 나를 쫓던 적 50% · 아니면 75%
          if (!z.rolled.get(e.id)) continue;
          e.lureAcc = (e.lureAcc || 0) + DT;
          if (e.def.elite || e.champion ? e.lureAcc > 2 : false) continue;
          e.lureT = 0.2; e.lureX = z.x; e.lureY = z.y; e.windT = 0;
        }
        if (z.t <= DT) for (const e of this.enemies) e.lureAcc = 0;
        continue;
      }
      if (z.kind === 'blastTrap') {
        const e = this.enemiesNear(z.x, z.y, z.r)[0];
        if (e) {
          z.t = 0;
          this.emit({ t: 'skillAoe', x: z.x, y: z.y, r: 52, elem: 'poison', fx: 'burst' });
          this.emit({ t: 'shake', v: 4 });
          for (const o of this.enemiesNear(z.x, z.y, 52)) { this.damageEnemy(o, z.atk * 1.9, 'phys', { src: 'aoe', heavy: true }); this.applyStatus(o, 'poison', 3); }
        }
        continue;
      }
      if (z.kind === 'arrows') {
        z.arrowT = (z.arrowT || 0) - DT;
        if (z.arrowT <= 0) {
          z.arrowT = 0.08;
          const a = this.rng.range(0, Math.PI * 2), rr = Math.sqrt(this.rng.range(0, 1)) * z.r, ax = z.x + Math.cos(a) * rr, ay = z.y + Math.sin(a) * rr;
          this.emit({ t: 'arrowDrop', x: ax, y: ay });
          for (const e of this.enemiesNear(ax, ay, 18)) this.damageEnemy(e, z.atk * 0.55, 'phys', { src: 'aoe' });
        }
        continue;
      }
      if (z.kind === 'sanctuary' && Math.hypot(p.x - z.x, p.y - z.y) < z.r) this.heal(this.d.maxHp * 0.03 * DT, 'skill');
      if (z.tick > 0) continue;
      z.tick = 0.5;
      if (z.kind === 'sanctuary') continue;
      for (const e of this.enemiesNear(z.x, z.y, z.r)) {
        if (z.kind === 'fog') { this.damageEnemy(e, z.atk * 0.22, 'mag', { src: 'dot', elem: 'dark' }); this.applyStatus(e, 'curse', 1); e.st.weak = Math.max(e.st.weak || 0, 0.6); }
        else if (z.kind === 'poison') { this.damageEnemy(e, z.atk * 0.25, 'true', { src: 'dot', elem: 'poison' }); this.applyStatus(e, 'poison', 2); }
        else if (z.kind === 'fire') { this.damageEnemy(e, z.atk * 0.2, 'mag', { src: 'dot', elem: 'fire' }); this.applyStatus(e, 'burn', 1); }
        else if (z.kind === 'inferno') { this.damageEnemy(e, z.atk * 0.5, 'mag', { src: 'aoe', elem: 'fire' }); this.applyStatus(e, 'burn', 2); }
        else if (z.kind === 'frost') { this.damageEnemy(e, z.atk * 0.15, 'mag', { src: 'dot', elem: 'ice' }); this.applyStatus(e, 'chill', 2); }
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
    for (const e of this.enemiesNear(p.x, p.y, r)) this.hitEnemy(e, d.physAtk * w.mul * 0.7, 'phys', false, false, { weapon: true });
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
    let crit = this.rng.chance(d.crit + this.modAdd('crit'));
    if (p.dashCritReady) { crit = true; p.dashCritReady = false; }
    if (p.buffs.nextCrit) { crit = true; delete p.buffs.nextCrit; }
    if (crit && this.raceRes?.crit) this.addRes(this.raceRes.crit);
    this.aggro(e);
    let charge = 1;
    if (p.buffs.charged && !opt.skill) { charge = p.buffs.charged.power || 2.5; p.buffs.charged.t = Math.min(p.buffs.charged.t, 0.05); heavy = true; }
    if (p.stealthStrike) { charge *= 3; heavy = true; p.stealthStrike = false; this.emit({ t: 'text', x: e.x, y: e.y - 22, text: '기습!', color: '#b89aff' }); }
    let extra = 0;
    if (p.stored > 0) { extra = p.stored * 3; p.stored = 0; heavy = true; this.emit({ t: 'text', x: e.x, y: e.y - 24, text: '버틴 힘!', color: '#ffe080' }); }
    const bleeding = !!e.st.bleed;
    const sp = opt.weapon ? w.special : null;
    if (sp) { // 만든 무기: 밤 · 물속 · 얼어붙은 적에게 더 세다
      if (sp.night && this.night && this.map.outdoor) base *= sp.night;
      if (sp.aquatic && (this.map.underwater || p.swim)) base *= sp.aquatic;
      if (sp.frozen && (e.st.frozen > 0 || e.st.chill?.n >= 4)) base *= sp.frozen;
    }
    this.damageEnemy(e, base * (crit ? d.critDmg : 1) * charge + extra, type, { src: 'attack', crit, heavy, proj, dist: opt.dist, elem: opt.elem, pen: opt.pen });
    if (opt.weapon && !e.dead) this.weaponExtras(e, base, crit, bleeding);
    if (this.b.cls === 'predator' && bleeding) this.heal(d.maxHp * 0.006, 'steal');
    if (p.buffs.apex && !e.dead) this.applyStatus(e, 'bleed', 2);
    if (p.spirits.length && !e.dead) {
      const fire = this.spiritCount('fire'), forest = this.spiritCount('forest'), wind = this.spiritCount('wind');
      if (fire && this.rng.chance(0.3 * fire)) this.applyStatus(e, 'burn', 1);
      if (fire && forest && e.st.burn) this.heal(d.maxHp * 0.005, 'skill');
      if (fire && wind && proj && this.rng.chance(0.25)) this.zones.push({ kind: 'fire', x: e.x, y: e.y, r: 14, t: 2, max: 2, tick: 0, atk: this.skillAtk('best') });
    }
    if (opt.weapon && this.b.cls === 'elementalist' && !e.dead && ELEM[p.elem]?.status) this.applyStatus(e, ELEM[p.elem].status, 1);
    if (p.buffs.venom && !e.dead) this.applyStatus(e, 'poison', 2);
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
      if (e.puppet) this.coop.out.push({ k: 'int', id: e.id, to: e.owner }); // 파티 탑 (동료): 방장의 적도 공격을 끊는다
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

  // 무기로 친 것에만 붙는 것: 속성 부여 · 부산물 능력 · 조합 능력
  weaponExtras(e, base, crit, bleeding) {
    const p = this.player, w = this.b.weapon, sp = w.special || {}, d = this.d;
    const ench = p.buffs.enchant;
    if (ench) {
      if (ench.elem === 'fire') this.igniteArea(e.x, e.y, 9);
      this.damageEnemy(e, base * ench.pow, 'mag', { src: 'enchant', elem: ench.elem, color: ELEM[ench.elem].color });
      if (!e.dead && ELEM[ench.elem].status) this.applyStatus(e, ELEM[ench.elem].status, ench.stacks || 1);
      if (ench.elem === 'lightning' && this.rng.chance(0.3)) { // 가까운 적 하나에게 튄다
        let o = null, od = 70;
        for (const x of this.enemies) { if (x === e || x.dead || x.hidden) continue; const dd = Math.hypot(x.x - e.x, x.y - e.y); if (dd < od) { od = dd; o = x; } }
        if (o) { this.emit({ t: 'bolt', pts: [{ x: e.x, y: e.y - 6 }, { x: o.x, y: o.y - 6 }], color: ELEM.lightning.color }); this.damageEnemy(o, base * ench.pow * 1.5, 'mag', { src: 'enchant', elem: 'lightning' }); this.applyStatus(o, 'shock', 1); }
      }
    }
    if (e.dead) return;
    for (const oh of w.onHits || []) if (this.rng.chance(oh.chance)) this.applyStatus(e, oh.status, oh.stacks || 1);
    if (sp.breakChance && this.rng.chance(sp.breakChance)) { e.armorBreak = Math.min(5, (e.armorBreak || 0) + (sp.synergy === 'crush' ? 2 : 1)); e.armorBreakT = 6; }
    if (sp.boom && this.rng.chance(sp.boom.chance)) {
      const r = sp.boom.r * (sp.synergy === 'inferno' ? 1.4 : 1);
      this.emit({ t: 'skillAoe', x: e.x, y: e.y, r, elem: 'fire', fx: 'pop' });
      for (const o of this.enemiesNear(e.x, e.y, r)) { this.damageEnemy(o, base * sp.boom.mul, 'mag', { src: 'aoe', elem: 'fire' }); if (!o.dead && sp.boom.status) this.applyStatus(o, sp.boom.status, sp.synergy === 'inferno' ? 2 : 1); }
    }
    if (sp.cloud && this.rng.chance(sp.cloud.chance)) this.addCloud(e.x, e.y, sp.cloud.r * (1 + d.cloudSize), 4 + d.physAtk * 0.25, sp.cloud.dur, 'p');
    switch (sp.synergy) {
      case 'rot': if (bleeding && !e.dead) this.applyStatus(e, 'poison', 1); break;
      case 'thirst': if (bleeding) this.heal(d.maxHp * 0.01, 'steal'); break;
      case 'hunt': if (crit && !e.dead) this.applyStatus(e, 'bleed', 2); break;
    }
  }

  // 먹기: 요리 · 날로 먹을 수 있는 재료 (요리 효과는 하나만, 새로 먹으면 바뀐다). 먹었으면 true
  eat(id) {
    const p = this.player, life = this.life;
    if (!life || !id || !(life.bag[id] > 0)) return false;
    registerDish(id);
    const info = eatInfo(id);
    if (!info) return false;
    life.bag[id]--;
    p.hp = Math.min(this.d.maxHp, p.hp + this.d.maxHp * info.heal * (this.hasKnack('cook') ? 1.2 : 1)); // 숙련 「손맛」
    const eff = this.clock && mealEffect(info, absMin(this.clock));
    if (eff && this.persist) { const i = this.persist.findIndex((x) => x.id === 'meal'); if (i >= 0) this.persist.splice(i, 1); this.persist.push(eff); this.applyPersist(); }
    this.emit({ t: 'eat', x: p.x, y: p.y, id, heal: Math.round(this.d.maxHp * info.heal), eff: eff?.name, color: eff?.color });
    this.signals.push({ t: 'save' });
    return true;
  }
  // 물약 · 주문서 쓰기. 썼으면 true (귀환 · 이동은 main이 마을 · 포탈로 옮긴 뒤에 한 장 쓴다)
  useItem(id) {
    const p = this.player, bag = this.life?.bag, g = GOODS[id], u = g?.use, say = (text, color = '#c8b8a0') => this.emit({ t: 'text', x: p.x, y: p.y - 26, text, color });
    if (!u || !(bag?.[id] > 0) || this.state !== 'play') return false;
    if (u.kind === 'potion') {
      if (p.potionCd > 0) { say(`아직 마실 수 없다 (${Math.ceil(p.potionCd)}초)`); return false; }
      if (p.hp >= this.d.maxHp) { say('체력이 가득하다'); return false; }
      this.heal(this.d.maxHp * u.heal, 'potion'); p.potionCd = 8;
      this.emit({ t: 'potion', x: p.x, y: p.y, color: g.icon.c[0] });
    } else if (u.kind === 'buff') {
      p.buffs[u.buff] = { t: u.t, max: u.t, mods: u.mods || {}, color: u.color, name: u.name };
      this.emit({ t: 'buff', x: p.x, y: p.y, color: u.color });
    } else if (u.kind === 'reveal') {
      const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE), R = 45;
      for (let i = 0; i < this.explored.length; i++) {
        if (this.explored[i]) continue;
        if (this.map.outdoor) { const x = i % this.tw, y = (i / this.tw) | 0; if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue; }
        this.explored[i] = 1; this.revealed.push(i);
      }
      this.revealed.push(-1);
      say(this.map.outdoor ? '둘레의 땅이 지도에 드러났다' : '이 층의 지도가 드러났다', '#ffd8a0');
      this.emit({ t: 'buff', x: p.x, y: p.y, color: '#ffd8a0' });
    } else { this.signals.push({ t: 'scroll', kind: u.kind, id }); return true; } // 귀환 · 이동
    if (--bag[id] <= 0) delete bag[id];
    this.signals.push({ t: 'save' });
    return true;
  }
  // Z: 지금 잃은 체력에 맞는 가장 작은 물약 (모자라면 가장 큰 것)
  quickPotion() {
    const bag = this.life?.bag || {}, lost = 1 - this.player.hp / this.d.maxHp;
    const have = ['potion1', 'potion2', 'potion3'].filter((id) => bag[id] > 0);
    if (!have.length) { this.emit({ t: 'text', x: this.player.x, y: this.player.y - 26, text: '물약이 없다 (잡화점에서 판다)', color: '#c8b8a0' }); return false; }
    return this.useItem(have.find((id) => GOODS[id].use.heal >= lost - 0.05) || have[have.length - 1]);
  }

  // 숙련: 행동을 세고, 깨달으면 바깥(main)에 알린다
  knack(act, n = 1) { const k = this.life?.knack; if (!k || this.practice || this.training) return; for (const id of knackTick(k, act, () => this.rng.next(), n)) this.signals.push({ t: 'knack', id }); }
  hasKnack(id) { return hasKnack(this.life?.knack, id); }

  // CC 정리: 같은 적에게 6초 안에 기절 · 빙결 · 공포를 거듭 걸면 0.5배 → 0.25배, 세 번째 뒤엔 3초 동안 내성 (0.35초 미만의 짧은 경직은 세지 않는다)
  ccTime(e, dur) {
    if (!(dur > 0)) return 0;
    if (dur < 0.35) return dur;
    const now = this.t, r = (e.ccDR ||= { n: 0, t: -99, imm: -99 });
    if (now < r.imm) { this.emit({ t: 'text', x: e.x, y: e.y - 22, text: '내성', color: '#a8b0c0' }); return 0; }
    if (now - r.t > 6) r.n = 0;
    const k = [1, 0.5, 0.25][r.n] ?? 0.25;
    r.t = now; r.n++;
    if (r.n >= 3) { r.imm = now + 3; r.n = 0; }
    return dur * k * (this.pvp ? PVP.cc : 1);
  }
  stunE(e, dur) { if (e.puppet) { this.coop.out.push({ k: 'cc', to: e.owner, id: e.id, cc: 'stun', dur: Math.round(dur * 100) / 100 }); return dur; } const d = this.ccTime(e, dur); if (d > 0) { if (e.remote) this.pvp?.out.push({ t: 'dhit', dmg: 0, cc: 'stun', dur: d }); else e.st.stun = Math.max(e.st.stun || 0, d); } return d; }
  fearE(e, dur) { if (e.puppet) { this.coop.out.push({ k: 'cc', to: e.owner, id: e.id, cc: 'fear', dur: Math.round(dur * 100) / 100 }); return dur; } const d = this.ccTime(e, dur); if (d > 0) { if (e.remote) this.pvp?.out.push({ t: 'dhit', dmg: 0, cc: 'stun', dur: d * 0.7 }); else e.st.fear = Math.max(e.st.fear || 0, d); } return d; }
  // 결투: 상대 화면에서 온 공격을 내 몸으로 받는다 (내 방어 · 회피 · 받아치기 · 대전 보정)
  pvpHit(m) {
    const p = this.player, e = this.enemies.find((x) => x.remote);
    if (this.state !== 'play') return;
    if (m.dmg > 0) this.hurtPlayer(m.dmg * PVP.dmg, m.type === 'mag' ? 'mag' : 'phys', e, { fromX: e?.x, fromY: e?.y });
    if (m.cc === 'stun' && m.dur > 0 && !(p.invuln > 0)) { p.ccT = Math.max(p.ccT || 0, m.dur * (1 - this.d.statusRes * 0.5)); this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '기절', color: '#ffd060' }); }
    if (m.status && ['burn', 'poison', 'bleed', 'chill'].includes(m.status)) this.applyPlayerStatus(m.status, 8 + (m.stacks || 1) * 4);
  }
  // 결투 상대를 세운다 (화면의 적처럼 겨누고 때릴 수 있지만 체력은 상대가 알려 준다)
  addRemote(opp, x, y) {
    const e = this.makeEnemy('dummy', x, y, { noAffix: true });
    e.def = { ...e.def, name: opp.name, ai: 'remote', elite: false, pres: 0, mres: 0 };
    Object.assign(e, { defId: 'remote', remote: true, rp: opp, champion: `${opp.name} · Lv ${opp.lv || 1}`, state: 'chase', hp: opp.maxHp || 100, maxHp: opp.maxHp || 100, pres: 0, mres: 0, tx: x, ty: y, dir: x > this.player.x ? -1 : 1, r: 6 });
    this.enemies.push(e);
    return e;
  }

  damageEnemy(e, amount, type, opt = {}) {
    if (e.dead || e.hidden) return 0;
    const d = this.d, p = this.player;
    if (opt.linked) { // 사슬로 나눠 받는 피해: 이미 셈한 피해를 그대로 (배율 · 흡혈 없음)
      e.hp -= amount;
      if (this.practice) (this.dmgLog ||= []).push([this.t, amount]);
      // 지속 피해에서 넘어온 작은 몫은 모았다가 0.4초마다 한 번 보여 준다 (매 프레임 숫자 · 깜빡임이 쏟아지지 않게)
      e.linkAcc = (e.linkAcc || 0) + amount;
      if (!opt.fromDot) e.hitFlash = 0.08;
      if (!opt.fromDot || (e.linkAcc >= 1 && this.t - (e.linkShown ?? -9) >= 0.4)) {
        this.emit({ t: 'dmg', x: e.x, y: e.y - e.r - 10, v: e.linkAcc, src: 'linked', id: opt.fromDot ? null : e.id, small: true, color: '#d88aff' });
        e.linkAcc = 0; e.linkShown = this.t;
      }
      if (e.hp <= 0) this.killEnemy(e);
      return amount;
    }
    let mult = d.dmgMul;
    if (type === 'phys' || type === 'mag') {
      const pen = Math.min(1, (type === 'phys' ? d.physPen : d.magPen) + (this.s.pierce || 0) / 100);
      const broken = type === 'phys' && e.armorBreak ? 1 - e.armorBreak * 0.05 : 1;
      const res = (type === 'phys' ? e.pres : e.mres) * broken * (1 - pen);
      mult *= 1 - res / (res + 100);
    }
    if (opt.src === 'dot' || opt.src === 'reaction') mult *= d.statusDmgMul;
    if (e.def.shield && (opt.src === 'attack') && Math.sign(p.x - e.x) === e.dir && !(e.st.frozen > 0)) {
      mult *= 1 - e.def.shield;
      if (this.rng.chance(0.3)) this.emit({ t: 'text', x: e.x, y: e.y - 18, text: '막힘', color: '#a8b0c0' });
    }
    if (opt.src === 'attack' && !opt.fromDot) { // 숙련: 등 뒤 치기 · 원거리 명중
      if (this.b.weapon?.kind === 'proj') this.knack('rangedHit');
      else if (e.dir && Math.sign(p.x - e.x) === -e.dir && e.def.ai !== 'dummy') this.knack('backstab');
    }
    if (e.st.mark > 0) mult *= 1.2;
    if (e.st.curse && this.b.offItem?.offCurse) mult *= 1 + 0.02 * e.st.curse.n; // 저주 인형: 저주 중첩마다 받는 피해 +2%
    if (e.st.frozen > 0 && this.f.has('frozenVuln')) mult *= 1.5;
    if (d.lowHunt && e.hp < e.maxHp * 0.3) mult *= 1 + d.lowHunt; // 마무리: 체력 30% 밑의 적
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
    if (opt.src === 'reaction' && e.st.elemMark > 0) mult *= 1.5;
    if (this.b.cls === 'berserker' && type !== 'true') mult *= 1 + p.res * 0.004;
    if (this.b.cls === 'chronomancer' && (e.st.slowZ > 0 || e.st.chill || e.st.frozen > 0)) mult *= 1.2;
    mult *= this.mod('dmgMul');
    { const lh = this.modAdd('lowHpDmg'); if (lh) mult *= 1 + lh * (1 - p.hp / d.maxHp); }
    if (this.b.race === 'dragon' && e.st.burn) mult *= 1.15;
    if (this.b.race === 'assassin' && opt.src === 'attack' && Math.sign(p.x - e.x) !== e.dir) mult *= 1.3;
    if (this.b.race === 'undead' && type === 'mag') mult *= 1.12;
    if (this.b.race === 'elf' && opt.proj) mult *= 1 + 0.3 * Math.max(0, Math.min(1, ((opt.dist ?? 80) - 40) / 120));
    const dmg = amount * mult;
    if (e.remote) { // 결투 상대: 피해는 상대 쪽에서 상대의 방어로 다시 셈한다 (여기서는 숫자만 보인다)
      if (dmg > 0) this.pvp?.out.push({ t: 'dhit', dmg: Math.round(dmg * 10) / 10, type: type === 'mag' ? 'mag' : 'phys' });
      e.hitFlash = 0.1;
      if (dmg >= 1) this.emit({ t: 'dmg', x: e.x, y: e.y - e.r - 10, v: dmg, crit: opt.crit, heavy: opt.heavy, src: opt.src, id: e.id, color: type === 'mag' ? '#c9a8ff' : '#ffffff' });
      return dmg;
    }
    if (e.puppet) { // 파티 탑 (동료): 적의 체력은 방장의 세계가 깎는다 — 여기서는 피해를 보내고 숫자만 보인다
      if (dmg > 0) this.coop.out.push({ k: 'hit', to: e.owner, id: e.id, dmg: Math.round(dmg * 10) / 10, crit: opt.crit ? 1 : 0 });
      e.hitFlash = 0.1;
      if (dmg >= 0.5 && opt.src !== 'dot') this.emit({ t: 'dmg', x: e.x, y: e.y - e.r - 10, v: dmg, crit: opt.crit, heavy: opt.heavy, src: opt.src, id: e.id, color: opt.color || (type === 'mag' ? '#c9a8ff' : '#ffffff') });
    } else {
    e.hp -= dmg;
    if (this.practice) (this.dmgLog ||= []).push([this.t, dmg]); // 연습: 초당 피해 재기
    if (e.training && this.training) this.trainDamage(e, dmg); // 수련: 허수아비에 넣은 피해 · 화로에 붙인 불
    // 고통 연결: 받은 피해를 사슬로 이어진 적도 나눠 받는다
    if (e.link && e.link.t > 0 && !opt.linked && dmg > 0) {
      for (const o of this.enemies) if (o !== e && !o.dead && o.link && o.link.id === e.link.id) { this.damageEnemy(o, dmg * e.link.share, 'true', { linked: true, fromDot: opt.src === 'dot' }); if (opt.src !== 'dot') this.emit({ t: 'linkPulse', x1: e.x, y1: e.y - 8, x2: o.x, y2: o.y - 8 }); }
    }
    if (e.def.ai === 'dummy') { e.dmgLog.push([this.t, dmg]); e.lastHit = this.t; }
    else if (opt.src !== 'dot') this.aggro(e);

    if (opt.src === 'dot') { e.dotAcc += dmg; }
    else {
      e.hitFlash = 0.1;
      this.emit({ t: 'dmg', x: e.x, y: e.y - e.r - 10, v: dmg, crit: opt.crit, heavy: opt.heavy, src: opt.src, armored: (type === 'phys' ? e.pres : e.mres) >= 60, id: e.id, color: opt.color || (type === 'mag' ? '#c9a8ff' : '#ffffff') });
    }
    }
    if ((opt.src === 'attack' || opt.skill) && this.b.offItem?.offCurse && !e.dead && this.rng.chance(this.b.offItem.offCurse.chance)) this.applyStatus(e, 'curse', this.b.offItem.offCurse.stacks);
    if (opt.src === 'attack' || opt.src === 'aoe') {
      let ls = (this.s.lifesteal || 0) + this.modAdd('lifesteal');
      if (this.f.has('lowHpDrain') && p.hp < d.maxHp / 2) ls *= 2;
      if (ls > 0) this.heal(Math.min((dmg * ls) / 100 * (opt.src === 'aoe' ? 0.35 : 1), d.maxHp * 0.025), 'steal'); // 범위 공격 흡혈은 약하게, 한 번에 최대 체력 2.5%까지
    }
    if (opt.src === 'attack' && e.def.reflect) this.hurtPlayer(Math.min(dmg * e.def.reflect, d.maxHp * 0.08), 'phys', null, { direct: true });
    if (e.hp <= 0 && !e.puppet) this.killEnemy(e);
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
    if (e.puppet) { this.coop.out.push({ k: 'st', to: e.owner, id: e.id, kind, n: stacks }); return; }
    if (e.remote) { this.pvp?.out.push({ t: 'dhit', dmg: 0, status: kind, stacks }); return; }
    const st = e.st;
    if (kind === 'curse') { st.curse = { n: Math.min(12, (st.curse?.n || 0) + stacks), t: 8 }; return; }
    if (kind === 'shock') { st.shock = Math.max(st.shock || 0, 4); this.checkReactions(e); return; }
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
        st.chill = null; st.frozen = this.ccTime(e, (e.def.elite ? 0.6 : 1) * this.d.freezeTime);
        this.emit({ t: 'text', x: e.x, y: e.y - 16, text: '빙결', color: '#9fe3ff' });
      } else st.chill = { n, t: 3 };
    }
    this.checkReactions(e);
  }

  checkReactions(e) {
    if (e.dead || e.reactCd > 0) return;
    const st = e.st, d = this.d, s = this.s;
    const cold = st.chill || st.frozen > 0;
    if (st.burn && st.shock > 0) {
      const dmg = (14 + d.magAtk * 1.0 + st.burn.n * 4) * d.reactionMul;
      st.burn = null; st.shock = 0;
      this.react(e, 'overload', '#ffe060', 52);
      for (const o of this.enemiesNear(e.x, e.y, 52)) this.damageEnemy(o, dmg, 'mag', { src: 'reaction', color: '#ffe060' });
    } else if (st.chill && st.shock > 0 && !(st.frozen > 0)) {
      const dmg = (10 + d.magAtk * 0.7 + st.chill.n * 3) * d.reactionMul;
      st.chill = null; st.shock = 0; st.frozen = this.ccTime(e, (e.def.elite ? 0.6 : 1.2) * d.freezeTime);
      this.react(e, 'superconduct', '#bfe8ff', 0);
      this.damageEnemy(e, dmg, 'mag', { src: 'reaction', color: '#bfe8ff' });
    } else if (st.burn && cold) {
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
      st.bleed = null; st.chill = null; st.frozen = Math.max(st.frozen || 0, this.ccTime(e, e.def.elite ? 0.6 : 1.4));
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
    if (a.res) this.addRes(a.res);
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
    if (amount <= 0 || this.state === 'dead' || this.f.has('noHeal') || this.player.down) return;
    if (this.pvp) amount *= PVP.heal; // 대전: 회복 절반
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
    if (this.coTgt) { this.coHurtMate(this.coTgt, amount, type, attacker, opt); return; } // 파티 탑 (방장): 이 적이 노린 건 동료
    if (this.state !== 'play' || this.mode === 'plaza' || this.practice || p.down) return;
    if ((p.airT > 0 || p.leap) && !opt.direct) return;
    // 수호기사: 정면 공격은 25% 덜 받고 오러를 얻는다. 철벽 중에는 완전히 막는다
    let front = false;
    const fx = opt.fromX ?? attacker?.x, fy = opt.fromY ?? attacker?.y;
    if (this.b.cls === 'guardian' && fx != null && !opt.direct) {
      const vx = fx - p.x, vy = fy - p.y, l = Math.hypot(vx, vy) || 1;
      front = (vx * p.aimX + vy * p.aimY) / l > 0.25;
      if (front && p.buffs.ironWall && p.parryT <= 0) {
        this.addRes(8);
        this.emit({ t: 'block', x: p.x + p.aimX * 8, y: p.y - 6 + p.aimY * 8 });
        p.invuln = 0.2;
        return;
      }
    }
    if (p.parryT > 0 && !opt.direct) {
      // 받아치기 성공: 공격 무효 + 반격
      const pr = p.parry; p.parryT = 0;
      this.emit({ t: 'parry', x: p.x, y: p.y });
      this.emit({ t: 'hitstop', v: 0.12 });
      this.knack('block');
      this.addRes(pr.gain);
      for (const e of this.enemiesNear(p.x, p.y, pr.r)) { this.hitEnemy(e, this.skillAtk('phys') * pr.mul, 'phys', true); if (pr.stun && !e.dead) this.stunE(e, e.def.elite ? pr.stun * 0.35 : pr.stun); }
      this.motion('bash', 0.35);
      p.invuln = 0.4;
      return;
    }
    if (!opt.direct) {
      if (p.invuln > 0) return;
      if (this.rng.chance(d.dodge + this.modAdd('dodge'))) {
        if (this.raceRes?.dodge) this.addRes(this.raceRes.dodge);
        this.emit({ t: 'text', x: p.x, y: p.y - 14, text: '회피', color: '#bfe8d0' });
        p.invuln = 0.15;
        if (attacker) this.knack('dodge');
        for (const tr of this.b.triggers.dodge) if (this.rng.chance(tr.chance)) this.doAction(tr.action, attacker, p);
        return;
      }
      if ((type === 'phys' && f.has('blockPhys')) || (type === 'mag' && f.has('blockMag'))) {
        if (this.rng.chance(0.15)) { this.emit({ t: 'text', x: p.x, y: p.y - 14, text: '막기', color: '#ffe080' }); p.invuln = 0.15; return; }
      }
    }
    const dr = type === 'phys' ? d.physDR : d.magDR, raw = amount;
    let dmg = amount * (1 - dr) * d.dmgTakenMul * this.mod('dmgTakenMul');
    if (this.b.race === 'knight') dmg *= 0.9;
    if (this.f.has('resGuard') && p.res >= 50) dmg *= 0.9;
    if (front) { dmg *= 0.75; this.addRes(4); this.knack('block'); this.emit({ t: 'block', x: p.x + p.aimX * 8, y: p.y - 6 + p.aimY * 8, small: true }); }
    else if (this.b.weapon.guard && fx != null && !opt.direct) { // 방패를 든 무기: 앞에서 오는 피해를 줄인다
      const vx = fx - p.x, vy = fy - p.y, l = Math.hypot(vx, vy) || 1;
      if ((vx * p.aimX + vy * p.aimY) / l > 0.25) { dmg *= 1 - this.b.weapon.guard; this.emit({ t: 'block', x: p.x + p.aimX * 8, y: p.y - 6 + p.aimY * 8, small: true }); }
    }
    if (p.charging) dmg *= 0.75;
    if (this.b.race === 'golem' && type === 'phys') dmg *= 0.85;
    if (p.buffs.stoneSkin && type === 'phys') dmg *= 1 - 60 / (60 + 100 + Math.max(0, this.s.pres));
    if (this.zones.some((z) => z.kind === 'sanctuary' && Math.hypot(p.x - z.x, p.y - z.y) < z.r)) dmg *= 0.6;
    dmg = Math.max(dmg, raw * 0.3); // 방어 · 감소를 아무리 쌓아도 받는 피해는 30% 밑으로 내려가지 않는다
    if (this.raceRes?.hurt) this.addRes((dmg / d.maxHp) * this.raceRes.hurt * (1 + d.hurtRes) * (p.buffs.ironWall || p.buffs.brace ? 2 : 1));
    if (p.buffs.steadfast) { p.stored += dmg; p.storedT = 6; }
    if (p.buffs.scales && attacker && !attacker.dead) this.applyStatus(attacker, 'burn', 2);
    if (p.buffs.iceArmor && attacker && !attacker.dead) this.applyStatus(attacker, 'chill', 3);
    if (p.shield > 0) { const a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a; }
    p.hp -= dmg; p.hitFlash = 0.15;
    if (this.tower) this.tower.hurt += dmg;
    if (p.buffs.undying && p.hp < 1) { p.hp = 1; this.emit({ t: 'text', x: p.x, y: p.y - 22, text: '불굴', color: '#ffd84a' }); }
    if (p.buffs.undying) this.addRes((dmg / d.maxHp) * 100);
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
    if (this.mode === 'plaza' || p.down) return;
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
    p.hp = 0;
    if (this.coop) { // 파티 탑: 쓰러져도 세계는 돈다 (층을 깨면 다시 일어난다 · 모두 쓰러지면 끝)
      p.down = true; p.st = {}; p.buffs = {};
      this.signals.push({ t: 'coDown' }); this.emit({ t: 'death', x: p.x, y: p.y, color: '#ff4040', big: true });
      return;
    }
    if (this.pvp) { this.state = 'pvpDown'; this.signals.push({ t: 'pvpDown' }); this.emit({ t: 'death', x: p.x, y: p.y, color: '#ff4040', big: true }); return; } // 결투: 쓰러져도 잃는 것은 없다
    this.state = 'dead';
    this.emit({ t: 'death', x: p.x, y: p.y, color: '#ff4040', big: true });
  }

  // ───────────── 적 ─────────────
  makeEnemy(id, x, y, opt = {}) {
    const def = ALL_MONSTERS[id];
    const tm = this.tower ? towerMul(this.tower.f) : null; // 탑: 층마다 복리로 강해진다
    const dm = tm ? tm.hp : 1 + 0.4 * this.depth, am = 1.5 * (tm ? tm.atk : 1 + 0.25 * this.depth); // 몬스터는 아프게 때린다
    const e = {
      id: this.nextId++, defId: id, def, x, y, r: def.r, hp: def.hp * dm, maxHp: def.hp * dm, atk: def.atk * am, pres: def.pres, mres: def.mres,
      st: {}, atkCd: 0.5 + this.rng.range(0, 1), shotCd: 1 + this.rng.next() * 1.5, kbx: 0, kby: 0, hitFlash: 0, dead: false,
      dotAcc: 0, dotT: 0.5, reactCd: 0, ai: { mode: 'move', t: 2 + this.rng.range(0, 1) * 2, dx: 0, dy: 0 }, dir: 1, phase: this.rng.range(0, 6),
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
      e.camp = c; e.region = c.region; e.home = { x: c.x * TILE + 8, y: c.y * TILE + 8 };
      c.members.push(e);
      this.enemies.push(e);
    }
  }

  // 연습 모드: 비어 있는 야영지를 바로 다시 채운다
  respawnAll() { for (const c of this.camps) if (!c.members.some((m) => !m.dead)) this.spawnCamp(c); }

  updateCamps() {
    if (this.mode !== 'field') return;
    const p = this.player;
    for (const c of this.camps) {
      if (c.members.some((m) => !m.dead)) continue;
      if (this.tower) continue; // 탑의 층은 한 번 쓸면 끝 (다시 생기지 않는다)
      if (c.respawnT <= 0) { c.respawnT = this.practice ? 6 : 45; continue; }
      c.respawnT -= DT;
      if (c.respawnT <= 0) {
        if (this.practice || Math.hypot(c.x * TILE - p.x, c.y * TILE - p.y) > 360) this.spawnCamp(c);
        else c.respawnT = 3;
      }
    }
  }

  // 두 지점 사이가 벽에 막혔는지
  clearLine(x1, y1, x2, y2) {
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6);
    for (let i = 1; i < n; i++) if (this.wallAt(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n)) return false;
    return true;
  }

  // 소환수 길찾기: 곧장 갈 수 있으면 직진, 막히면 타일 단위 너비 우선 탐색으로 돌아간다 (0.4초마다 다시 계산)
  pathDir(o, tx, ty) {
    const dx = tx - o.x, dy = ty - o.y, l = Math.hypot(dx, dy) || 1;
    if (this.mode !== 'field' || this.clearLine(o.x, o.y, tx, ty)) { o.path = null; return [dx / l, dy / l]; }
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
        if (f[j] >= 0 || tt === T_WALL || tt === T_CRACK || tt === T_BUILD || tt === T_GATE || tt === T_DEEP) continue;
        f[j] = dv + 1; q.push(j);
      }
    }
  }

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
  }

  updateEnemies() {
    const P = this.player, d = this.d, s = this.s, host = !!this.coop; // 파티 탑: 내가 맡은 몬스터는 내 세계가 움직인다
    this.coRec = host;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.puppet) { this.updatePuppet(e); continue; }
      const p = host ? this.coPick(e) : P; // 이 적이 노리는 사람 (파티 탑이 아니면 언제나 나)
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
      for (const k of ['frozen', 'mark', 'septic', 'slowZ']) if (st[k] > 0) st[k] -= DT;
      if (e.rooted > 0) e.rooted -= DT;
      const dot = burn + poison + bleed + curse;
      if (dot > 0) this.damageEnemy(e, dot * DT, 'true', { src: 'dot' });
      if (e.dead) continue;
      if (e.trainFlee || e.bones > 0) continue; // 수련: 달아나는 랩터 · 뼈 무더기는 수련이 직접 다룬다
      if (e.reelT > 0) { // 작살에 끌려온다: 내 앞 (정예는 반쯤까지)
        e.reelT -= DT;
        const gap = P.r + e.r + 6, tx = P.x + (e.reelX0 - P.x) * (1 - e.reelK) + P.aimX * gap * e.reelK, ty = P.y + (e.reelY0 - P.y) * (1 - e.reelK) + P.aimY * gap * e.reelK;
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
            al.hp -= e.atk * (al.tauntT > 0 ? 0.7 : 1);
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
            if (def.ai === 'boss' && !frozen && e.shotCd <= 0 && dist < 220) { e.shotCd = 2.4; this.enemyShot(e, Math.atan2(dyp, dxp), def.proj.spread, 0.22); }
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
  }

  // 대지 거수: 날아간 적이 벽이나 다른 적에 부딪히면 피해 + 기절
  knockCollide(e, x0, y0, kbSpd) {
    e.kbHot -= DT;
    const want = kbSpd * DT, moved = Math.hypot(e.x - x0, e.y - y0);
    let hit = null;
    if (want > 2.5 && moved < want * 0.35) hit = 'wall';
    else if (kbSpd > 160) for (const o of this.enemies) if (o !== e && !o.dead && !o.hidden && Math.hypot(o.x - e.x, o.y - e.y) < o.r + e.r + 1) { hit = o; break; }
    if (!hit) return;
    e.kbHot = 0;
    const dmg = (e.kbAtk || this.skillAtk('phys')) * (0.6 + Math.min(1.2, kbSpd / 500));
    const stun = (o) => { if (!o.def.elite) { this.stunE(o, 1); o.windT = 0; } else this.stunE(o, 0.35); };
    this.damageEnemy(e, dmg, 'phys', { src: 'aoe', heavy: true }); stun(e);
    if (hit !== 'wall') {
      this.damageEnemy(hit, dmg * 0.8, 'phys', { src: 'aoe' }); stun(hit);
      if (!hit.def.elite) { hit.kbx += e.kbx * 0.6; hit.kby += e.kby * 0.6; hit.kbHot = 0.3; hit.kbAtk = e.kbAtk; }
    }
    e.kbx *= 0.2; e.kby *= 0.2;
    this.emit({ t: 'collide', x: e.x, y: e.y, wall: hit === 'wall' });
  }

  explode(e) {
    const b = e.def.boom, prev = this.coTgt;
    this.emit({ t: 'ring', x: e.x, y: e.y, r: b.r, color: b.color });
    this.emit({ t: 'shake', v: 4 });
    for (const t of this.coTargets()) if (Math.hypot(t.x - e.x, t.y - e.y) < b.r + (t.r || 5)) { this.coTgt = t === this.player ? null : t; this.hurtPlayer(e.atk, e.def.type, null, { status: b.status }); }
    this.coTgt = prev;
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
    if (this.coop) this.coop.deadIds.push(e.id);
    if (e.training) { // 수련 상대: 전리품 · 도감 · 의뢰 없이 수련만 센다
      if (this.training && !this.trainKill(e)) return;
      if (this.training) { this.training.got++; this.emit({ t: 'trainHit', x: e.x, y: e.y, look: e.look, n: this.training.got }); }
      if (e.trainee) this.emit({ t: 'death', x: e.x, y: e.y, color: e.def.pal.a, defId: e.defId, dir: e.dir });
      return;
    }
    if (!e.summoned && e.def.ai !== 'dummy' && !selfDestruct) { // 숙련: 어떤 상태의 적을 어떻게 쓰러뜨렸나
      const st = e.st;
      if (st.burn) this.knack('killBurning');
      if (st.chill || st.frozen > 0) this.knack('killChilled');
      if (st.poison) this.knack('killPoisoned');
      if (st.shock) this.knack('killShocked');
      if (this.b.weapon?.kind === 'proj') this.knack('rangedKill');
      if (BEASTS.test(e.defId)) this.knack('hunt');
    }
    if (this.b.cls === 'necromancer' && !e.summoned && e.def.ai !== 'dummy' && this.player.souls.length < 10 && this.rng.chance(0.5)) {
      this.player.souls.push({ defId: e.defId, maxHp: e.maxHp, atk: e.atk, r: e.r, scale: e.scale || 1 });
      this.emit({ t: 'soulGet', x: e.x, y: e.y, n: this.player.souls.length });
    }
    if (e.doom) {
      this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 90, elem: 'dark', fx: 'doom', ult: true });
      for (const o of this.enemiesNear(e.x, e.y, 90)) { this.applyStatus(o, 'curse', 6); this.damageEnemy(o, e.doom.atk * 1.8, 'mag', { src: 'aoe', elem: 'dark' }); }
    }
    const def = e.def, st = e.st, d = this.d;
    const bonus = (e.affix ? 2 : 1) * (e.champion ? 5 : 1) * (1 + 0.5 * this.depth);
    if (e.summoned) { this.emit({ t: 'death', x: e.x, y: e.y, color: def.pal.a, defId: e.defId, dir: e.dir }); return; }
    this.loot.xp += Math.round(def.xp * bonus);
    this.loot.kills[e.defId] = (this.loot.kills[e.defId] || 0) + 1;
    this.sanctKill(e);
    if (this.codex && MONSTERS[e.defId]) {
      const k = this.codex.kills ||= {}, before = monsterStage(e.defId, k[e.defId] || 0);
      k[e.defId] = (k[e.defId] || 0) + 1;
      const after = monsterStage(e.defId, k[e.defId]);
      if (after > before) { this.emit({ t: 'codexStage', name: def.name, stage: after, x: e.x, y: e.y, next: STAGE_KILLS[after] }); this.signals.push({ t: 'codex' }); }
    }
    if (this.story) {
      for (const [id, it] of Object.entries(STORY_ITEMS)) {
        const ch = it.from[e.defId];
        if (!ch || (it.done && this.story.flags[it.done])) continue;
        const onGround = this.drops.filter((d) => d.kind === 'story' && d.id === id).length;
        if ((this.story.items[id] || 0) + onGround >= it.max) continue;
        if (this.rng.chance(ch)) this.spawnDrop(e.x, e.y, 'story', id);
      }
    }
    this.emit({ t: 'death', x: e.x, y: e.y, color: def.pal.a, big: def.elite, defId: e.defId, dir: e.dir });
    if (def.elite || e.champion) { this.emit({ t: 'hitstop', v: 0.25 }); this.emit({ t: 'banner', text: `${e.champion || def.name} 처치!`, color: '#ffcf5a' }); }
    if (e.lair && this.zone?.relic && !this.depth) this.signals.push({ t: 'relic', race: this.zone.relic, rid: `${this.zone.relic}_boss` });
    // 성물 조각: 그 성지의 땅에서만 나온다 (바깥은 그 지역의 몬스터, 지하는 그 던전의 몬스터와 우두머리)
    const sr = this.map.outdoor ? BIOME_SANCTUM[BIOME_LIST[e.region]?.id] : this.zone?.relic;
    if (sr && !this.practice) {
      let n = 0;
      if (e.lair) n = !this.depth && !this.bossRelicTaken ? 0 : 3 + this.depth; // 처음 잡으면 성물 하나 통째로, 그다음부터는 조각
      else if (e.champion) n = 3;
      else if (this.rng.chance(this.map.outdoor ? 0.04 : 0.06 + 0.02 * this.depth)) n = 1;
      for (let i = 0; i < n; i++) this.spawnDrop(e.x, e.y, 'shard', sr);
    }
    if (e.affix && AFFIXES[e.affix].deathCloud) this.addCloud(e.x, e.y, 36, e.atk * 0.3, 3, 'e');
    const gold = Math.round(def.gold * d.goldMul * bonus * 0.55); // 돈은 쉽게 벌리지 않는다
    if (gold > 0) for (let i = 0, n = def.treasure || e.champion ? 6 : 1; i < n; i++) this.spawnDrop(e.x, e.y, 'gold', null, Math.ceil(gold / n));
    const echoTries = e.champion ? 3 : def.treasure ? 3 : e.affix ? 2 : 1;
    for (let i = 0; i < echoTries; i++) if (this.rng.chance(Math.min(1, def.echo.rate * (1 + 0.25 * this.depth)))) this.spawnDrop(e.x, e.y, 'echo', e.champion || def.treasure ? this.rng.pick(this.zone.pool.map((m) => MONSTERS[m].echo.id)) : def.echo.id);
    if (e.champion && this.rng.chance(0.3)) this.spawnDrop(e.x, e.y, 'echo', MONSTERS[this.zone.elite].echo.id);
    if (def.condEcho && def.condEcho.when === 'burning' && st.burn && this.rng.chance(def.condEcho.rate)) this.spawnDrop(e.x, e.y, 'echo', def.condEcho.id);
    if (def.onDeath?.cloud) { const c = def.onDeath.cloud; this.addCloud(e.x, e.y, c.r, c.dps, c.dur, 'e'); }
    if (this.life && !this.practice) {
      const luck = 1 + this.modAdd('luck'), extra = e.champion ? 2 : e.affix ? 1.5 : 1;
      for (const [gid, ch] of MONSTER_DROPS[e.defId] || []) {
        if (this.rng.chance(Math.min(1, ch * luck * extra))) this.spawnDrop(e.x, e.y, 'good', gid, 1);
        if (ch >= 1 && this.rng.chance(0.5 * luck)) this.spawnDrop(e.x, e.y, 'good', gid, 1); // 우두머리: 가끔 하나 더
      }
      // 정령석: 어디서나 가끔, 숲(이끼 숲 · 원시림 · 이끼 동굴)에서는 더 자주, 우두머리는 꼭
      const bi = this.map.biome?.[Math.floor(e.y / TILE) * this.tw + Math.floor(e.x / TILE)], green = this.zone?.id === 'cave' || [2, 10].includes(bi);
      if (def.elite || e.champion || this.rng.chance((green ? 0.05 : 0.018) * luck * extra)) this.spawnDrop(e.x, e.y, 'good', 'spiritStone', 1);
    }

    for (const tr of this.b.triggers.kill) if (this.rng.chance(tr.chance)) this.doAction(tr.action, null, e);
    if (st.poison && this.f.has('poisonSpread')) for (const o of this.enemiesNear(e.x, e.y, 60)) this.applyStatus(o, 'poison', Math.ceil(st.poison.n / 2));
    if (st.burn && this.f.has('burnSpread')) for (const o of this.enemiesNear(e.x, e.y, 60)) this.applyStatus(o, 'burn', 2);
    if (st.poison && this.f.has('poisonBurst')) this.addCloud(e.x, e.y, 34 * (1 + d.cloudSize), 4 + (this.s.toxicity || 0) * 0.8, 3, 'p');
    if (this.b.race === 'undead') this.heal(d.maxHp * 0.06, 'drain');
    if (this.raceRes?.kill) this.addRes(this.raceRes.kill);
    this.lastKills = (this.lastKills || 0) + 1;
  }

  addRage() { /* 오크 분노는 종족 자원(res)으로 통합 */ }

  // ───────────── 파티 탑 ─────────────
  // 방장: 적이 노릴 수 있는 사람 (나 + 같은 층의 동료, 쓰러진 사람은 빼고)
  coTargets() {
    const P = this.player, out = P.down ? [] : [P];
    if (this.coop) for (const m of this.coop.mates.values()) if (!m.dead) out.push(m);
    return out;
  }
  // 방장: 이 적이 노릴 사람 — 가장 가까운 사람, 한 번 고르면 잠깐은 그대로 (도발한 사람이 있으면 그 사람)
  coPick(e) {
    const P = this.player, mates = this.coop.mates;
    const alive = (t) => t && (t === P ? !P.down : !t.dead && mates.get(t.id) === t);
    if (e.provokeT > 0) {
      const pm = e.provokeBy ? mates.get(e.provokeBy) : null;
      if (pm && alive(pm)) return (e.tgt = pm);
      if (!e.provokeBy && !P.down) return (e.tgt = P);
    }
    if (alive(e.tgt) && (e.tgtT = (e.tgtT || 0) - DT) > 0) return e.tgt;
    e.tgtT = 0.7;
    let best = P.down ? null : P, bd = best ? Math.hypot(P.x - e.x, P.y - e.y) : 1e9;
    for (const m of mates.values()) { if (m.dead) continue; const dd = Math.hypot(m.x - e.x, m.y - e.y); if (dd < bd) { bd = dd; best = m; } }
    return (e.tgt = best || P);
  }
  // 방장: 같은 층의 인원수에 맞춰 몬스터를 세게 (1명 늘 때마다 체력 +60% · 공격 +10%) — 남은 체력 비율은 그대로
  coScale(n) {
    const c = this.coop; n = Math.max(1, Math.min(4, n));
    if (c.scale === n) return;
    const hk = (1 + 0.6 * (n - 1)) / (1 + 0.6 * ((c.scale || 1) - 1)), ak = (1 + 0.1 * (n - 1)) / (1 + 0.1 * ((c.scale || 1) - 1));
    c.scale = n;
    for (const e of this.enemies) { if (e.dead || e.training) continue; e.maxHp *= hk; e.hp *= hk; e.atk *= ak; }
    this.emit({ t: 'text', x: this.player.x, y: this.player.y - 30, text: `${n}명 · 몬스터가 ${n > 1 ? '강해졌다' : '돌아왔다'}`, color: '#9fe6ff' });
  }
  // 방장: 동료가 맞았다 → 그 동료의 세계가 자기 방어로 다시 셈한다
  coHurtMate(m, amount, type, attacker, opt = {}) {
    const fx = opt.fromX ?? attacker?.x ?? m.x, fy = opt.fromY ?? attacker?.y ?? m.y;
    this.coop.out.push({ k: 'hurt', to: m.id, dmg: Math.round(amount * 10) / 10, type, status: opt.status || null, src: attacker?.id || 0, fx: Math.round(fx), fy: Math.round(fy), direct: opt.direct ? 1 : 0 });
  }
  // 방장: 지금 적의 모습 (동료에게 0.1초마다) — 처음 보는 적은 종류 · 우두머리 같은 바뀌지 않는 정보도 함께
  coSnap() {
    const c = this.coop, list = [], info = {};
    for (const e of this.enemies) {
      if (e.dead || e.training || e.puppet) continue; // 내가 맡은 몬스터만 알린다
      const st = e.st;
      const bits = (st.burn ? 1 : 0) | (st.poison ? 2 : 0) | (st.chill ? 4 : 0) | (st.frozen > 0 ? 8 : 0) | (st.stun > 0 ? 16 : 0) | (e.hidden ? 32 : 0) | (e.state === 'chase' ? 64 : 0) | (st.bleed ? 128 : 0) | (st.curse ? 256 : 0) | (st.fear > 0 ? 512 : 0);
      list.push([e.id, Math.round(e.x), Math.round(e.y), Math.ceil(e.hp), Math.round(e.maxHp), bits, e.dir, Math.round(e.windT * 100), e.ai?.mode === 'dash' ? 2 : e.ai?.mode === 'wind' ? 1 : 0]);
      if (c.scale > 1 && !e.coScaled && e.summoned) { e.coScaled = true; e.maxHp *= 1 + 0.6 * (c.scale - 1); e.hp *= 1 + 0.6 * (c.scale - 1); }
      if (!c.known.has(e.id)) { c.known.add(e.id); info[e.id] = [e.defId, e.champion || '', e.affix || '', e.scale || 1, e.r, e === this.tower?.boss ? 1 : 0, e.summoned ? 1 : 0, e.lair ? 1 : 0, Math.round(e.atk)]; }
    }
    const pr = this.projs.filter((x) => x.owner === 'e' && !x.ghost).map((x) => [Math.round(x.x), Math.round(x.y), Math.round(x.vx), Math.round(x.vy), x.color]);
    return { k: 'snap', e: list, info, dead: c.deadIds.splice(0), pr, ev: c.ev.splice(0).map(({ t, id, x, y, r, dx, dy, ang, color, text, v }) => ({ t, id, x, y, r, dx, dy, ang, color, text, v })) };
  }
  // 방장: 동료 화면에서 온 것 (피해 · 상태이상 · CC · 밀치기 · 기술이 건 것)
  coRecv(m, from) {
    const e = m.id != null ? this.enemies.find((x) => x.id === m.id) : null;
    if (m.id != null && (!e || e.dead)) return;
    if (e?.puppet) { if (e.owner !== from) this.coop.out.push({ ...m, to: e.owner }); return; } // 주인이 바뀌었다 → 지금 주인에게
    switch (m.k) {
      case 'hit':
        if (!(m.dmg > 0)) break;
        e.hp -= m.dmg; e.hitFlash = 0.1; this.aggro(e);
        this.emit({ t: 'dmg', x: e.x, y: e.y - e.r - 10, v: m.dmg, crit: !!m.crit, id: e.id, color: '#9fe6ff', small: m.dmg < 8 });
        if (e.hp <= 0) this.killEnemy(e);
        break;
      case 'st': this.applyStatus(e, m.kind, m.n || 1); break;
      case 'cc': if (!e.def.elite || m.dur < 1) { if (m.cc === 'fear') this.fearE(e, m.dur); else this.stunE(e, m.dur); if (!e.def.elite) e.windT = 0; } else (m.cc === 'fear' ? this.fearE(e, m.dur * 0.35) : this.stunE(e, m.dur * 0.35)); break;
      case 'kb': if (!e.def.elite && e.def.ai !== 'dummy') { e.kbx += m.x; e.kby += m.y; } break;
      case 'int': if (!e.def.elite) { e.windT = 0; e.atkCd = Math.max(e.atkCd, 0.7); } break;
      case 'set':
        if (!CO_SET.includes(m.f) && m.f !== 'flee') break;
        if (m.f === 'flee') { e.st.flee = Math.max(e.st.flee || 0, m.v); e.windT = 0; break; }
        e[m.f] = Math.max(e[m.f] || 0, m.v);
        if (m.f === 'provokeT') { e.provokeBy = from; e.tgt = this.coop.mates.get(from) || e.tgt; e.taunt = null; e.tauntT = 0; this.aggro(e); }
        if (m.f === 'lureT') { e.lureX = m.x; e.lureY = m.y; }
        if (m.f === 'silenceT' || m.f === 'loseT') e.windT = 0;
        break;
    }
  }
  // 동료: 방장이 알려 준 적의 모습을 그대로 따른다
  coApplySnap(m, from = 0) {
    const c = this.coop, byId = new Map(this.enemies.map((e) => [e.id, e])), seen = new Set(), dead = new Set(m.dead || []);
    for (const [id, inf] of Object.entries(m.info || {})) c.info.set(+id, inf);
    for (const [id, x, y, hp, maxHp, bits, dir, wind, mode] of m.e || []) {
      let e = byId.get(id);
      if (e && !e.puppet) continue; // 내가 맡은 몬스터는 내 세계가 정한다
      if (!e) {
        const inf = c.info.get(id);
        if (!inf || !ALL_MONSTERS[inf[0]]) { c.need = true; continue; }
        e = this.makeEnemy(inf[0], x, y, { noAffix: true, summoned: !!inf[6] });
        Object.assign(e, { id, puppet: true, owner: from, atk: inf[8] || e.atk, champion: inf[1] || undefined, affix: inf[2] || undefined, scale: inf[3], r: inf[4], lair: !!inf[7], tx: x, ty: y });
        if (inf[5] && this.tower) this.tower.boss = e;
        if (e.champion && this.tower) (this.tower.bosses ||= []).push(e);
        this.enemies.push(e); byId.set(id, e);
      }
      seen.add(id); e.owner = from; e.handoff = 0;
      e.tx = x; e.ty = y; e.hp = hp; e.maxHp = maxHp; e.dir = dir; e.hidden = !!(bits & 32); e.state = bits & 64 ? 'chase' : 'idle';
      const w = wind / 100; if (w > e.windT + 0.05) e.windMax = w; e.windT = w;
      e.ai.mode = mode === 2 ? 'dash' : mode === 1 ? 'wind' : 'move';
      const st = e.st; // 상태이상은 보이기만 (피해는 방장의 세계가 넣는다)
      st.burn = bits & 1 ? st.burn || { n: 1, t: 1 } : null; st.poison = bits & 2 ? st.poison || { n: 1, t: 1 } : null; st.chill = bits & 4 ? st.chill || { n: 2, t: 1 } : null;
      st.bleed = bits & 128 ? st.bleed || { n: 1, t: 1 } : null; st.curse = bits & 256 ? st.curse || { n: 1, t: 1 } : null;
      st.frozen = bits & 8 ? 0.3 : 0; st.stun = bits & 16 ? 0.3 : 0; st.fear = bits & 512 ? 0.3 : 0;
    }
    for (const e of this.enemies) {
      if (!e.puppet || e.dead) continue;
      if (dead.has(e.id)) { e.hp = 0; this.killEnemy(e); } // 쓰러뜨렸다: 전리품 · 도감은 각자
      else if (e.owner === from && !seen.has(e.id) && !e.handoff) e.dead = true; // 사라졌다 (도망 등)
    }
    this.projs = this.projs.filter((x) => !x.ghost || x.from !== from);
    for (const [x, y, vx, vy, color] of m.pr || []) this.projs.push({ owner: 'e', ghost: true, from, x, y, vx, vy, life: 0.4, color, dmg: 0 });
    for (const ev of m.ev || []) this.events.push(ev);
  }
  // 동료: 방장이 알려 준 자리로 부드럽게 (스스로는 움직이지도 때리지도 않는다)
  updatePuppet(e) {
    e.hitFlash = Math.max(0, e.hitFlash - DT); e.wobble = Math.max(0, e.wobble - DT);
    const mx = e.tx - e.x, my = e.ty - e.y, ml = Math.hypot(mx, my);
    if (ml > 120) { e.x = e.tx; e.y = e.ty; } else { const k = Math.min(1, DT * 12); e.x += mx * k; e.y += my * k; }
    e.moving = ml > 0.8; if (e.moving) e.walkT += DT;
    if (Math.abs(mx) > 0.5) e.dir = mx > 0 ? 1 : -1;
    if (e.windT > 0) e.windT = Math.max(0, e.windT - DT);
    if (e.armorBreakT > 0 && (e.armorBreakT -= DT) <= 0) e.armorBreak = 0;
    if (e.st.mark > 0) e.st.mark -= DT;
  }
  // 동료: 이번 틱에 내 기술이 꼭두각시에 건 것(밀치기 · 도발 · 침묵 · 유인 · 속박 · 겁먹기)을 방장에게 넘기고 비운다
  coFlush() {
    const out = this.coop.out;
    for (const e of this.enemies) {
      if (!e.puppet || e.dead) continue;
      if (Math.abs(e.kbx) + Math.abs(e.kby) > 1) { out.push({ k: 'kb', to: e.owner, id: e.id, x: Math.round(e.kbx), y: Math.round(e.kby) }); }
      e.kbx = 0; e.kby = 0;
      for (const f of CO_SET) if (e[f] > 0) { out.push({ k: 'set', to: e.owner, id: e.id, f, v: Math.round(e[f] * 100) / 100, x: f === 'lureT' ? Math.round(e.lureX) : undefined, y: f === 'lureT' ? Math.round(e.lureY) : undefined }); e[f] = 0; }
      if (e.st.flee > 0) { out.push({ k: 'set', to: e.owner, id: e.id, f: 'flee', v: Math.round(e.st.flee * 100) / 100 }); e.st.flee = 0; }
    }
    return out.splice(0);
  }
  // 방장: 몬스터마다 맡을 사람 = 가장 가까운 사람 (한 번 맡으면 40 더 가까운 사람이 생겨야 넘긴다)
  coOwners(me) {
    const P = this.player, ppl = [...(P.down ? [] : [{ id: me, x: P.x, y: P.y }]), ...[...this.coop.mates.values()].filter((m) => !m.dead)];
    if (!ppl.length) return [];
    const out = [];
    for (const e of this.enemies) {
      if (e.dead || e.training) continue;
      const cur = e.owner || me, dist = (q) => Math.hypot(q.x - e.x, q.y - e.y);
      let best = ppl[0]; for (const q of ppl) if (dist(q) < dist(best)) best = q;
      const now = ppl.find((q) => q.id === cur);
      out.push([e.id, now && dist(now) < dist(best) + 40 ? cur : best.id]);
    }
    return out;
  }
  // 누가 어떤 몬스터를 맡는지 (내가 맡게 되면 내 세계가 그 몬스터를 움직인다)
  coSetOwners(list, me) {
    const byId = new Map(this.enemies.map((e) => [e.id, e]));
    for (const [id, o] of list) {
      const e = byId.get(id); if (!e || e.dead) continue;
      const mine = o === me;
      if (mine && e.puppet) { e.puppet = false; e.x = e.tx ?? e.x; e.y = e.ty ?? e.y; e.tgt = null; e.atkCd = Math.max(e.atkCd, 0.4); }
      else if (!mine && !e.puppet) { e.puppet = true; e.tx = e.x; e.ty = e.y; e.handoff = 1; }
      e.owner = o;
    }
  }
  // 방장의 적에게 맞았다 (내 방어 · 회피 · 막기로 셈한다)
  coHurt(m) {
    const src = m.src ? this.enemies.find((e) => e.id === m.src) : null;
    this.hurtPlayer(m.dmg, m.type === 'mag' ? 'mag' : m.type === 'true' ? 'true' : 'phys', src || null, { status: m.status || undefined, fromX: m.fx, fromY: m.fy, direct: !!m.direct });
  }
  // 파티 탑: 층을 깨면 쓰러졌던 사람이 일어난다
  coRevive(frac = 0.3) {
    const p = this.player;
    if (!p.down) return;
    p.down = false; p.hp = Math.max(1, this.d.maxHp * frac); p.invuln = 2;
    this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '다시 일어났다', color: '#9fe6ff' });
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
      const full = dr.kind === 'good' && this.life && !bagFits(this.life, dr.id);
      if (full && dist < 20 && this.t - (this.fullNoteT || -9) > 3) { this.fullNoteT = this.t; this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '가방이 가득 찼다 · 집 보관함에 넣거나 팔자', color: '#ffb0a0' }); }
      if (dr.t > 0.45 && dist < 80 && !full) {
        const pull = 260 + (80 - dist) * 6;
        dr.vx += (dx / dist) * pull * DT * 4; dr.vy += (dy / dist) * pull * DT * 4;
      }
      dr.vx *= 0.9; dr.vy *= 0.9;
      dr.x += dr.vx * DT; dr.y += dr.vy * DT;
      if (dr.t > 0.45 && dist < 9 && !full) {
        dr.taken = true;
        if (dr.kind === 'gold') { this.loot.gold += dr.amount; this.emit({ t: 'pickup', kind: 'gold', x: p.x, y: p.y }); }
        else if (dr.kind === 'good') {
          if (this.life && bagAdd(this.life, dr.id, dr.amount)) this.emit({ t: 'goodGet', id: dr.id, n: dr.amount, x: p.x, y: p.y });
        } else if (dr.kind === 'shard') { this.signals.push({ t: 'shard', race: dr.id }); this.emit({ t: 'shardGet', race: dr.id, x: p.x, y: p.y }); }
        else if (dr.kind === 'story') {
          const n = this.story.items[dr.id] = (this.story.items[dr.id] || 0) + 1;
          this.emit({ t: 'storyItem', id: dr.id, n, max: STORY_ITEMS[dr.id].max, x: p.x, y: p.y });
          this.signals.push({ t: 'save' });
        } else {
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
      let ps = 1;
      if (pr.owner !== 'p' && this.zones.length) for (const z of this.zones) if (z.kind === 'slow' && Math.hypot(pr.x - z.x, pr.y - z.y) < z.r) ps = 0.4;
      pr.x += pr.vx * DT * ps; pr.y += pr.vy * DT * ps; pr.life -= DT * ps;
      if (this.map.outdoor && pr.owner === 'p' && pr.elem === 'ice') {
        // 지나간 칸만 언다. 대각선으로 날아도 칸끼리 변으로 이어지게 (걸어서 건널 수 있게)
        let tx = Math.floor(pr.x / TILE), ty = Math.floor(pr.y / TILE);
        let lx = pr.iceTx ?? tx, ly = pr.iceTy ?? ty;
        while (lx !== tx || ly !== ty) {
          if (Math.abs(tx - lx) >= Math.abs(ty - ly)) lx += Math.sign(tx - lx); else ly += Math.sign(ty - ly);
          if (lx >= 0 && ly >= 0 && lx < this.tw && ly < this.th) this.freezeTile(ly * this.tw + lx);
        }
        if (tx >= 0 && ty >= 0 && tx < this.tw && ty < this.th) this.freezeTile(ty * this.tw + tx);
        pr.iceTx = tx; pr.iceTy = ty;
      }
      if (this.wallAt(pr.x, pr.y) && !pr.returning && pr.boomerang && pr.owner === 'p') { pr.returning = true; pr.hit.clear(); pr.x -= pr.vx * DT; pr.y -= pr.vy * DT; this.emit({ t: 'spark', x: pr.x, y: pr.y, color: '#e8e2cf' }); }
      else if (this.wallAt(pr.x, pr.y) && !pr.returning) {
        if (pr.owner === 'p' && this.tileAt(pr.x, pr.y) === T_CRACK) this.hitCrack(pr.x, pr.y, pr.dmg);
        this.emit({ t: 'spark', x: pr.x - pr.vx * DT, y: pr.y - pr.vy * DT, color: pr.color });
        pr.life = 0;
      }
      if (pr.life <= 0) continue;
      if (pr.owner === 'p') {
        for (const e of this.enemies) {
          if (e.dead || e.hidden || pr.hit.has(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - 4 - pr.y) > e.r + 5) continue; // 몸 가운데 (발밑보다 조금 위) 기준
          pr.hit.add(e.id);
          if (pr.skillHit) pr.skillHit(e, pr);
          else if (pr.noTrigger) this.damageEnemy(e, pr.dmg, pr.type, { src: 'aoe' });
          else {
            const dist = pr.ox != null ? Math.hypot(e.x - pr.ox, e.y - pr.oy) : 100;
            const range = pr.boomerang ? 1 : dist < 40 ? 0.7 : dist > 70 ? 1.1 : 1;
            this.hitEnemy(e, pr.dmg * range, pr.type, pr.heavy, true, { dist, weapon: pr.weaponHit });
          }
          if (pr.splash) { this.emit({ t: 'ring', x: pr.x, y: pr.y, r: pr.splash, color: pr.color }); for (const o of this.enemiesNear(pr.x, pr.y, pr.splash)) if (o !== e) this.damageEnemy(o, pr.dmg * 0.7, pr.type, { src: 'aoe' }); }
          if (pr.elem === 'fire' || pr.ench === 'fire') this.igniteArea(e.x, e.y, pr.splash ? Math.max(12, pr.splash * 0.6) : 10); // 맞은 적의 발밑에도 불
          if (pr.type === 'mag' && this.f.has('magicBurst') && !pr.noTrigger) this.doAction({ aoe: { r: 24, mul: 0.35, type: 'mag' } }, null, pr);
          if (pr.pierce-- <= 0) { pr.life = 0; break; }
        }
      } else if (!pr.ghost) {
        const hit = this.coTargets().find((t) => Math.hypot(t.x - pr.x, t.y - pr.y) < (t.r || 5) + 3);
        if (hit) {
          pr.life = 0;
          this.coTgt = hit === p ? null : hit;
          this.hurtPlayer(pr.dmg, pr.type, pr.src && !pr.src.dead ? pr.src : null, { status: pr.status, fromX: pr.x - pr.vx * 0.2, fromY: pr.y - pr.vy * 0.2 });
          this.coTgt = null;
        }
      }
    }
    for (const pr of this.projs) if (pr.life <= 0 && pr.owner === 'p' && !pr.burned && (pr.elem === 'fire' || pr.ench === 'fire') && this.map.outdoor) { // 날아가다 끝난 자리
      pr.burned = true;
      const r = pr.splash ? Math.max(14, pr.splash * 0.7) : pr.big ? 16 : 12;
      this.igniteArea(pr.x, pr.y, r);
      this.emit({ t: 'emberPop', x: pr.x, y: pr.y, r });
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
      } else {
        if (Math.hypot(p.x - c.x, p.y - c.y) < c.r + p.r) {
          this.damagePlayerDot(c.dps * 0.5 * (1 - this.d.magDR));
          this.applyPlayerStatus('poison', c.dps);
        }
        if (this.coop) for (const m of this.coop.mates.values()) if (!m.dead && Math.hypot(m.x - c.x, m.y - c.y) < c.r + 5) this.coHurtMate(m, c.dps * 0.5, 'mag', null, { direct: true, status: 'poison' });
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

export { ECHOES, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD, T_GATE, T_DEEP };

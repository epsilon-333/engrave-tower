// 전투·탐험 시뮬레이션. 고정 틱(60Hz) + 시드 난수 + 입력만으로 진행 → 서버 권한 방식으로 옮기기 쉽다.
// 렌더러는 world 상태와 world.events 만 읽고, main 은 world.signals 로 화면 전환을 한다.
import { MONSTERS, ALL_ZONES, DUMMIES, ECHOES, LORES, AFFIXES } from '../data/monsters.js';
import { zoneInit, zoneTick, zoneTakeMul, zoneHitMul, mirrorBounce, lightPillar, shiftShelves, arenaShift, shardHit, shardFakeDie, startIntro, introTick } from './towerzone.js';
import { REACTIONS } from '../data/engravings.js';
import { knackTick, hasKnack, BEASTS } from '../data/knacks.js';
import { towerMul, isBossFloor, bossKit, CLIMB_SIGS, BOSS_PASSIVES } from '../data/tower.js';
import { LOOT_RARITY } from '../data/crafting.js';
import { rollTowerWeapon, W_RARITY } from '../data/weapons.js';
import { rollTowerGear } from '../data/towergear.js'; // 탑의 방어구 · 장신구 · 왼손 장비도 떨어진다
import { ITEMS } from '../data/items.js';
import { LIFESTEAL_PER } from '../data/stats.js';
export const POTION_CD = 8; // 물약 · 회복 요리 대기시간 (함께 쓴다)
import { climbMul, setZoneRef, floorFoes, rollDoors, actOf, REWARDS, BOSS_HEAL, BOSS_HP, BOSS_ATK, BOSS_STYLE, levelGap, rollFloorMod } from '../data/climb.js';
import { RAID_BOSS } from '../data/raid.js';
import { initNpcLife, updateNpcLife, pokeNpcs, npcDown, isPerson } from './npclife.js';
import { SKILLS, ELEM, ZONE_ELEM, aimRule, PVP, WORD_FAMILY, WORD_COMBO, CLASS_BAL, CLASS_BAL_PVE } from '../data/skills.js';
import { SPIRITS, SPIRIT_ELEMS, SPIRIT_GRADES, spiritPower } from '../data/spirits.js';
export const SPIRIT_OPS = new Set(['summonSpirit', 'spiritEmpower', 'spiritGuard']);
export const SPIRIT_DMG_ELEM = { fire: 'fire', ice: 'ice', lightning: 'lightning', wind: 'wind', forest: 'poison', dark: 'dark' };
import { RACES } from '../data/races.js';
import { computeBuild } from './build.js';
const TEMP_MAX = 60; // 잠깐 오르는 스탯: 한 스탯에 합쳐서 +60까지
const STAT_SHORT = { str: '근력', mag: '마력', agi: '민첩', vit: '체력', sen: '감각', spi: '정신', pres: '물리 저항', mres: '마법 저항' };
// 스킬을 쓰면 잠깐 오르는 스탯 [스탯, 양, 초]
export const SKILL_TSTAT = {
  warCry: [['str', 20, 8]], eWarHorn: [['str', 15, 6]], berserkSkill: [['str', 20, 8], ['agi', 15, 8]], aimedShot: [['sen', 25, 6]], weakMark: [['sen', 10, 8]],
  hardenShell: [['pres', 30, 6]], stoneSkin: [['pres', 30, 6]], ironWall: [['pres', 25, 4]], iceArmor: [['mres', 20, 8], ['vit', 10, 8]], scales: [['pres', 15, 6], ['mres', 15, 6]],
  steadfast: [['vit', 20, 4]], braceForIt: [['vit', 15, 4]], elemMark: [['mag', 15, 8]], elemSurge: [['mag', 25, 6]], eBloodPact: [['str', 10, 8], ['mag', 10, 8]],
  windStep: [['agi', 15, 4]], shadowEvade: [['agi', 15, 3]], stealth: [['sen', 20, 6]], apexPredator: [['agi', 30, 12], ['str', 20, 12]], dragonForm: [['str', 30, 10], ['vit', 20, 10]],
  colossus: [['vit', 30, 12], ['pres', 30, 12]], extinction: [['vit', 30, 10], ['str', 20, 10]], wordScale: [['spi', 15, 6]], spiritEmpower: [['spi', 20, 8]],
};
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
// 플레이어에게 걸리는 상태이상의 길이(초)
const PLAYER_STATUS_DUR = { burn: 3, poison: 4, bleed: 3, chill: 2, curse: 4, shock: 2 };
// 스킬 예비 동작(초): 이만큼 몸을 움직인 뒤 효과가 나간다
export const WINDUP = { blow3: 0.08, throw: 0.12, throwBig: 0.2, shoot: 0.12, overhead: 0.3, sweep: 0.18, claw: 0.08, bite: 0.08, headbutt: 0.1, bash: 0.1, roar: 0.14, stomp: 0.2, point: 0.06, power: 0.15, stab: 0.06 };
// 스킬 몸 동작 길이(초)
export const MOTION_DUR = { blow3: 0.68, slash: 0.3, sweep: 0.42, overhead: 0.5, thrust: 0.3, spin: 0.38, dash: 0.25, leap: 0.45, cast: 0.3, castBig: 0.45, throw: 0.3, throwBig: 0.45, roar: 0.55, guard: 0.5, bite: 0.35, shoot: 0.3, power: 0.6, stomp: 0.45, claw: 0.3, breath: 1.2, headbutt: 0.35, charge: 0.4, bash: 0.4, chop: 0.6, stab: 0.4, point: 0.3, crouch: 0.4, channel: 1.2, aim: 0.5, dashSlash: 0.35 };
export const STATUS_COLOR = { burn: '#ff7a2a', poison: '#9be15d', bleed: '#e0445a', chill: '#9fe3ff', true: '#ffffff' };
export const ACTIVE_RANGE = 440;
// 몬스터 기술: 종류마다 2~3가지를 섞어 쓴다 (모두 빨간 예고가 먼저 나온다) · 몬스터 정의의 moves 로 바꿀 수 있다
export const AI_MOVES = { chase: ['combo', 'whirl', 'shove'], erratic: ['combo', 'shove'], burrow: ['combo', 'quake'], /* 뛰어들기는 몸에 맞는 몬스터만 (기본으로 다 뛰면 멀리서 내 발밑에 원이 쉴 새 없이 생겼다) */ ranged: ['fan', 'retreat', 'spiral', 'split'], summoner: ['pool', 'heal', 'blink', 'spiral'], charge: ['leap', 'combo', 'pool', 'whirl', 'quake'], boss: ['leap', 'pool', 'fan', 'combo', 'split', 'whirl'] };
export const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
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

import { EnemyAiMethods } from './enemyai.js';
import { SkillMethods } from './skillrun.js';
import { AllyMethods } from './allies.js';
export class World {
  // mode: 'field' | 'plaza'
  constructor({ build, mode, zoneId, zone = null, seed, map, memory, depth = 0, practice = null, story = null, codex = null, life = null, clock = null, persist = null, tower = null, pvp = null, coop = null, souls = null, raid = null, minions = null, npcMem = null, climb = null }) {
    this.npcMem = npcMem || {}; // NPC가 나를 기억하는 것 (호감 · 들은 소문) — 저장과 같은 객체
    this.minions = minions || []; // 사령술사: 쓰러질 때까지 남는 부하 (저장과 같은 배열 · 다른 곳에도 따라온다)
    this.raid = raid; // 보스 레이드: { id }
    this.depth = depth;
    // 파티 탑: 방장(host)은 적을 움직이고, 동료(member)는 방장이 알려 준 대로 적을 보여 주며 자기 공격을 방장에게 보낸다
    this.coop = coop ? { role: coop.role, mates: new Map(), out: [], ev: [], known: new Set(), deadIds: [], info: new Map() } : null;
    this.pvp = pvp ? { opp: pvp.opp, out: [] } : null; // 결투: 상대에게 보낼 것(피해 · CC · 상태 · 스킬)을 모아 둔다
    this.tower = tower ? { f: tower.f, t: 0, hurt: 0, boss: null } : null; // 각인의 탑: 층 · 걸린 시간 · 받은 피해
    // 탑 등반 (로그라이트): run = 이번 등반 · kind = 이 층의 문 종류 (fight · trial · guardian · lord · shop · altar · rest · 보상 종류)
    this.climb = climb ? { run: climb.run, f: climb.f, kind: climb.kind, reward: climb.reward || null, meta: climb.meta || {}, oath: climb.run?.oath || {}, phase: 'fight', waves: [], waveI: 0, waveT: 0, total: 0, boss: null, doorsOpen: false, hasteT: 0 } : null;
    this.clock = practice ? null : clock;     // 하루의 시간 { day, min } — 저장 데이터와 같은 객체
    this.persist = practice ? null : persist; // 오래가는 효과 (음식 · 잠) — 저장 데이터와 같은 배열
    this.story = practice ? null : story;   // { items, flags } — 저장 데이터와 같은 객체
    this.codex = practice ? null : codex;   // 도감 (처치 수 · 장소 · 일지)
    this.practice = practice; // { infRes, noCd }
    this.mode = mode;
    this.setBuild(build);
    this.zone = zone || (zoneId === 'world' ? WORLD_ZONE : zoneId ? ALL_ZONES.find((z) => z.id === zoneId) : null);
    this.zoneId = zoneId || this.zone?.id || null; // 지금 있는 곳 (바깥 세계 · 섬 · 지하 도시 · 배)
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
      res: pvp ? Math.max(50, RACES[this.b.race]?.res?.start || 0) : RACES[this.b.race]?.res?.start || 0, /* 결투는 자원 50으로 시작 */ elem: 'fire', elemBonusT: 0, buffs: {}, cds: {}, parryT: 0, parry: null,
      castT: 0, castMax: 0, castSkill: null, channel: null, souls: souls || [], // 사령술사: 거둔 영혼 (저장과 같은 배열 · 30개까지)
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
      if (!this.climb && (!this.tower || isBossFloor(this.tower.f))) { // 탑: 보스 층에만 층 수호자 (짧게)
        const elite = this.makeEnemy(this.zone.elite, m.lair.x * TILE + 8, m.lair.y * TILE + 8);
        elite.home = { x: elite.x, y: elite.y }; elite.lair = true;
        if (this.tower) { elite.hp = elite.maxHp = elite.maxHp * 4; elite.champion = `${this.tower.f}층 수호자`; elite.scale = 1.4; this.tower.boss = elite; this.giveBossKit(elite, this.tower.f); }
        this.enemies.push(elite);
      }
      // 구역 우두머리: 구역 몬스터의 강화판, 다시 생기지 않음
      for (const c of m.champions || []) {
        const e = this.makeEnemy(c.type, c.x * TILE + 8, c.y * TILE + 8, { champion: m.regionInfo[c.region].name });
        e.home = { x: e.x, y: e.y }; e.region = c.region; this.applyLevel(e, this.regionLevel(c.region, c.x, c.y) + 2); // 우두머리는 두 레벨 위
        this.enemies.push(e);
      }
      if (m.outdoor && this.zone?.id === 'world') (m.chests || []).forEach((c, i) => { // 미믹: 상자 아홉 개 중 하나 옆에 상자인 척 숨어 있다
        if (c.rich || i % 9 !== 4) return;
        const tx = c.x + 2, ty = c.y; if (this.blocked(tx * TILE + 8, ty * TILE + 8, 6)) return;
        const e = this.makeEnemy('mimic', tx * TILE + 8, ty * TILE + 8, { noAffix: true }); e.home = { x: e.x, y: e.y }; e.dormant = true;
        const r = m.regions?.[ty * this.tw + tx]; if (r >= 0) { e.region = r; this.applyLevel(e, this.regionLevel(r, tx, ty)); }
        this.enemies.push(e);
      });
      for (const g of m.goblins || []) {
        const e = this.makeEnemy('treasureGoblin', g.x * TILE + 8, g.y * TILE + 8, { noAffix: true });
        e.home = { x: e.x, y: e.y };
        this.enemies.push(e);
      }
      if (!m.outdoor && !m.ship && !m.nokt && !m.noPortal) this.objects.push({ kind: 'portal', x: sx, y: sy - 14, label: '귀환 포탈 (잔향 전부 보존)', color: this.zone.portal });
      for (const o of m.objects || []) this.objects.push({ ...o });
      for (const c of m.chests) this.objects.push({ kind: 'chest', x: c.x * TILE + 8, y: c.y * TILE + 8, rich: c.rich, trap: c.trap, hidden: !!(c.rich && m.outdoor), label: c.rich ? '숨겨진 보물 상자' : '보물 상자' });
      for (const c of m.camp || []) this.objects.push({ kind: 'camp', x: c.x * TILE + 8, y: c.y * TILE + 8, label: '야영지 · 잔향 맡기고 쉬기', reusable: true });
      for (const c of m.merchant || []) this.objects.push({ kind: 'merchant', x: c.x * TILE + 8, y: c.y * TILE + 8, label: '떠돌이 상인', reusable: true, npc: { name: '떠돌이 상인 오반' } });
      for (const c of m.shrines || []) this.objects.push({ kind: 'shrine', x: c.x * TILE + 8, y: c.y * TILE + 8, label: '낡은 제단 · 축복 받기' });
      if (m.stairs && this.tower) { const dp = this.towerDoorSpot(m); m.stairs = dp; } // 탑: 문은 걸어서 닿는 넓은 바닥 가운데에
      if (m.stairs) this.objects.push({ kind: 'stairs', door: !!this.tower, reach: this.tower ? 30 : undefined, x: m.stairs.x * TILE + 8, y: m.stairs.y * TILE + 8, label: this.tower ? `계단 · ${this.tower.f}층 클리어` : `아래층으로 (지하 ${depth + 2}층)`, reusable: true });
      for (const l of m.lores) this.objects.push({ kind: 'lore', x: l.x * TILE + 8, y: l.y * TILE + 8, label: l.text ? '찢어진 기록 읽기' : '고대 석판 읽기', text: l.text });
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
      // 내 종족 성지에서 가장 가까운 포탈은 처음부터 열려 있다
      const myS = m.objects?.find((o) => o.kind === 'sanctum' && o.race === this.b.race);
      const homeWp = myS && (m.waypoints || []).reduce((a, w) => (!a || Math.hypot(w.x - myS.x, w.y - myS.y) < Math.hypot(a.x - myS.x, a.y - myS.y) ? w : a), null);
      for (const wp of m.waypoints || []) { const on = !!wp.start || wp === homeWp || !!this.story?.flags[`wp:${wp.id}`]; this.objects.push({ kind: 'waypoint', ...wp, active: on, label: on ? '이동 포탈 · 다른 포탈로 가기' : '잠든 포탈 깨우기', reusable: true }); }
      // 성지 마을: 우두머리 · 주민 · 수련 안내판 (역시 기억 뒤에), 맡고 있는 '찾기' 의뢰의 물건
      for (const [race, v] of Object.entries(m.villages || {})) this.addVillage(race, v);
      if (!this.coop && !this.pvp && !this.tower && !this.raid) initNpcLife(this); // NPC 하루 일과
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
    this.minions.forEach((m, i) => { const a = i * 0.7; this.spawnMinion(m, this.player.x + Math.cos(a) * 18, this.player.y + Math.sin(a) * 18, i); }); // 나와 있던 부하가 따라온다
    if (this.tower) this.tower.bosses = this.enemies.filter((e) => e.champion); // 탑: 이 층의 우두머리 목록 (쓰러뜨리면 줄이 그어진다)
    if (this.climb) this.initClimb();
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


  // ───── 탑 등반: 층 시작 · 물결 · 층 돌파 · 보상 · 문 ─────
  initClimb() {
    const C = this.climb, mc = this.map.climb, k = C.kind;
    setZoneRef(this.zone.id, this.zone.pool);
    this.explored.fill(1); // 방 하나: 다 보인다
    C.center = { x: mc.center.x * TILE + 8, y: mc.center.y * TILE + 8 };
    C.doorSpots = mc.doors.map((d) => ({ x: d.x * TILE + 8, y: d.y * TILE + 8 }));
    C.spawns = mc.spawns.map((sp) => ({ x: sp.x * TILE + 8, y: sp.y * TILE + 8 }));
    zoneInit(this); // 51~100층 구역 장치 (돌풍 · 거울 · 톱니 · 책장 · 빛기둥)
    if (this.coop?.role === 'member') { C.remote = true; return; } // 파티 등반 (동료): 몬스터는 파티장이 알려 준다 · 층이 열리는 것도 파티장이
    if (k === 'guardian' || k === 'lord') {
      const act = actOf(C.f), id = k === 'lord' ? act.lord : act.guardian, lx = this.map.lair.x * TILE + 8, ly = this.map.lair.y * TILE + 8;
      C.waves = [[{ id, x: lx, y: ly, boss: true }]];
      C.waveT = 0.5; C.total = 1; // 곧바로 등장 연출 (towerzone.startIntro)
      return;
    }
    // 싸움터: 적을 물결 셋(낮은 층은 둘)으로 나눠 부른다 · 가끔 층의 특성
    C.mod = rollFloorMod(C.f, k, this.rng);
    if (C.mod === 'dark') this.zone = { ...this.zone, dark: Math.min(0.88, (this.zone.dark || 0.4) * 2.2) };
    const n = Math.round(floorFoes(C.f) * (C.mod === 'horde' ? 1.4 : 1)), pool = this.zone.pool;
    const parts = C.f <= 2 ? [0.55, 0.45] : [0.4, 0.33, 0.27];
    let left = n;
    C.waves = parts.map((q, i) => { const m = i === parts.length - 1 ? left : Math.max(1, Math.round(n * q)); left -= m; return m; }).map((m, wi) => {
      const list = [], centers = [];
      for (let c = 0; c < Math.max(1, Math.round(m / 3)); c++) centers.push(this.climbSpot(wi === 0 ? 200 : 90)); // 첫 물결은 멀리서 (들어오자마자 둘러싸이지 않게)
      for (let i = 0; i < m; i++) { const c = centers[i % centers.length], a = this.rng.range(0, Math.PI * 2), r = this.rng.range(0, 22); let x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (this.blocked(x, y, 7)) { x = c.x; y = c.y; } list.push({ id: this.rng.pick(pool), x, y }); }
      return list;
    });
    C.total = C.waves.reduce((a, w) => a + w.length, 0);
    C.waveT = 1.1;
    for (const sp of C.waves[0]) this.emit({ t: 'telegraphCircle', x: sp.x, y: sp.y, r: 12, dur: 1.1 });
  }
  // 적이 나올 자리: 나에게서 minD 이상 떨어진 트인 바닥
  climbSpot(minD) {
    const sp = this.climb.spawns, p = this.player;
    for (let a = 0; a < 40; a++) { const s = sp[this.rng.int(0, sp.length - 1)]; if (s && Math.hypot(s.x - p.x, s.y - p.y) >= minD) return { x: s.x, y: s.y }; }
    return sp[0] ? { ...sp[0] } : { x: p.x, y: p.y - 120 };
  }
  climbSpawn(list) {
    const C = this.climb;
    const affixP = Math.min(0.7, 0.1 + 0.05 * (actOf(C.f).n - 1) + 0.2 * (C.oath.elite || 0)); // 뒤 구역일수록 강화 개체가 많다
    for (const sp of list) {
      const e = this.makeEnemy(sp.id, sp.x, sp.y, { affixP, champion: sp.champ ? '시련' : null });
      if (e.def.raceLook) e.raceLook = this.rng.pick(['wizard', 'elf', 'knight', 'orc', 'undead', 'assassin', 'dino', 'dragon']); // 각인 망령: 8종족 옛 전사 중 하나
      e.home = { x: e.x, y: e.y }; e.hidden = false; e.climb = !sp.treasure;
      const lg = levelGap(C.f, this.b.level); if (lg.gap) { e.hp = e.maxHp = e.maxHp * lg.hp; e.atk *= lg.atk; } // 권장 레벨보다 낮으면 더 세다
      if (C.mod === 'swift') e.speedMul *= 1.25;
      if (C.mod === 'bloodmoon') e.atk *= 1.15;
      if (sp.boss) {
        const wr = C.oath.wrath || 0;
        { const sty = BOSS_STYLE[e.defId] || [1, 1]; e.hp = e.maxHp = e.maxHp * (BOSS_HP[C.kind] || 1) * sty[0] * (1 + 0.25 * wr); e.atk *= sty[1]; } { const gp = Math.min(1, levelGap(C.f, this.b.level).gap / 2); e.atk *= 1 + ((BOSS_ATK[C.kind] || 1) - 1) * gp; e.hp = e.maxHp = e.maxHp * (1 + 0.15 * gp); } // 레벨이 모자랄수록 수호자가 벽이 된다
        if (wr >= 2) { e.enraged = true; e.speedMul *= 1.3; e.atkRate *= 1.35; }
        e.lair = true; this.tower.boss = e; C.boss = e; e.scale = C.kind === 'lord' ? 1.4 : 1.2; // 수호자 · 주인은 더 크게
        this.giveClimbSig(e, C.f);
        startIntro(this, e, C.kind === 'lord' ? `${actOf(C.f).name}의 주인 · ${C.f}층` : `${C.f}층 수호자`, C.kind === 'lord' ? '#ff6a4a' : '#ffb07a'); // 등장 연출: 결투장을 비추고 이름 · 한마디
      }
      this.enemies.push(e);
      this.aggro(e);
      this.emit({ t: 'summon', x: e.x, y: e.y });
    }
  }
  updateClimb() {
    const C = this.climb, p = this.player;
    zoneTick(this); introTick(this);
    if (C.phase === 'fight' && !C.remote) {
      if (C.waveI < C.waves.length) {
        const alive = this.enemies.filter((e) => !e.dead && e.climb && !e.summoned).length;
        if (C.waveI === 0 || alive <= (C.waveI === C.waves.length - 1 ? 2 : 3)) { // 앞 물결이 거의 끝나면 다음 물결 (겹쳐서 밀려온다)
          if (C.waveT <= 0 && C.waveI > 0 && !C.teleT) { C.waveT = 0.9; C.teleT = true; for (const sp of C.waves[C.waveI]) this.emit({ t: 'telegraphCircle', x: sp.x, y: sp.y, r: sp.champ ? 18 : 12, dur: 0.9 }); }
          if ((C.waveT -= DT) <= 0) { if (C.waveI > 0) shiftShelves(this); this.climbSpawn(C.waves[C.waveI]); C.waveI++; C.teleT = false; C.waveT = 0; }
        }
      } else if (!this.enemies.some((e) => !e.dead && e.climb && !e.summoned)) this.climbCleared();
      // 조급한 탑: 한 층에 90초가 넘으면 초마다 최대 체력 2%
      if (C.oath.haste && this.tower.t > 90 && (C.hasteT -= DT) <= 0) { C.hasteT = 1; this.hurtPlayer(this.d.maxHp * 0.02, 'true', null, { direct: true }); this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '탑이 재촉한다', color: '#ff8a7a' }); }
    }
  }
  climbCleared() {
    const C = this.climb, run = C.run;
    C.phase = 'reward';
    for (const e of this.enemies) if (!e.dead && e.summoned) { e.dead = true; this.emit({ t: 'death', x: e.x, y: e.y, color: e.def.pal.a, defId: e.defId, dir: e.dir }); } // 남은 부하는 흩어진다
    for (const e of this.enemies) if (!e.dead && !e.climb && e.def.treasure) { e.dead = true; this.emit({ t: 'text', x: e.x, y: e.y - 18, text: '보물 고블린이 도망쳤다', color: '#ffcf3a' }); e.blinkAt = this.t; this.emit({ t: 'blink', x1: e.x, y1: e.y, x2: e.x, y2: e.y - 30 }); }
    for (const dr of this.drops) dr.magnet = true; // 떨어진 부산물을 놓치지 않게
    const big = C.kind === 'guardian' || C.kind === 'lord';
    if (big) this.heal(this.d.maxHp * BOSS_HEAL, 'spring');
    this.emit({ t: 'banner', text: big ? `${C.boss?.def.name || '수호자'} 처치!` : `${C.f}층 돌파`, sub: big ? `체력 ${Math.round(BOSS_HEAL * 100)}% 회복 · 문이 열렸다` : '문이 열렸다 · 떨어진 것을 모두 주웠다', color: big ? '#ffcf5a' : '#e8d8a8' });
    this.emit({ t: 'climbClear', x: C.center.x, y: C.center.y });
    this.openClimbDoors();
    this.signals.push({ t: 'climbCleared', f: C.f, kind: C.kind });
  }
  openClimbDoors() {
    const C = this.climb; if (!C || C.doorsOpen) return;
    C.doorsOpen = true;
    if (this.coop?.role === 'member') return; // 파티 등반: 문은 파티장이 고른다
    const doors = rollDoors({ ...C.run, f: C.f });
    if (!doors.length) { this.signals.push({ t: 'climbTop' }); return; } // 꼭대기
    const spots = doors.length === 1 ? [C.doorSpots[1]] : doors.length === 2 ? [C.doorSpots[0], C.doorSpots[2]] : C.doorSpots;
    doors.forEach((d, i) => {
      const R = REWARDS[d.kind] || { name: d.kind, desc: '' }, sp = spots[i];
      this.objects.push({ kind: 'climbDoor', next: d.kind, x: sp.x, y: sp.y, label: `${C.f + 1}층 · ${R.name} — ${R.desc}`, reach: 22, reusable: true, born: this.t });
    });
    this.emit({ t: 'doorsOpen', x: C.doorSpots[1].x, y: C.doorSpots[1].y });
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
    if (!m) return;
    if (m.tw !== this.tw || m.th !== this.th) {
      // 섬이 넓어진 예전 기록: 칸 위치를 옮겨 탐험한 곳만 살린다 (예전 자리는 그대로이므로)
      if (!(m.tw <= this.tw && m.th <= this.th)) return;
      try {
        const bin = atob(m.explored || '');
        for (let y = 0; y < m.th; y++) for (let x = 0; x < m.tw; x++) { const i = y * m.tw + x; if (bin.charCodeAt(i >> 3) & (1 << (i & 7))) this.explored[y * this.tw + x] = 1; }
      } catch { /* 손상된 기록은 무시 */ }
      this.regionSeen = new Set(m.regions || []); this.milestones = new Set(m.milestones || []);
      return;
    }
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
    const hpFrac = this.player && this.d ? this.player.hp / Math.max(1, this.d.maxHp) : null;
    this.b = build; this.d = build.derived; this.f = build.flags; this.s = build.stats;
    if (this.player?.tmp?.length && !build.lo?.tempStats) this.tmpDirty = true; // 밖에서 새로 만든 빌드: 잠깐 스탯을 다시 얹는다
    if (hpFrac != null && this.player && this.tmpRebuild) this.player.hp = Math.max(1, Math.min(this.d.maxHp, hpFrac * this.d.maxHp)); // 최대 체력이 바뀌어도 비율 그대로
    if (this.player) this.player.hp = Math.min(this.player.hp, this.d.maxHp);
    if (this.player && this.mode === 'plaza') this.player.hp = this.d.maxHp;
  }

  emit(e) {
    if ((e.t === 'lineTele' || e.t === 'beamFx') && this.map && e.x2 != null) { // 예고선 · 광선 그림은 벽 앞에서 끊는다 (끊긴 자리에 부딪히는 불꽃)
      const L = Math.hypot(e.x2 - e.x1, e.y2 - e.y1), a = Math.atan2(e.y2 - e.y1, e.x2 - e.x1), l2 = this.rayLen(e.x1, e.y1, a, L);
      if (l2 < L - 2) { e.x2 = e.x1 + Math.cos(a) * l2; e.y2 = e.y1 + Math.sin(a) * l2; e.wall = true; }
    }
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
    if (this.map.regionInfo?.[this.map.regions?.[k]]?.town) return; // 마을 안(밭 · 집 둘레)은 타지 않는다
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
  // 싸울 상대인가: 살아 있고 보이며, 허수아비는 광장 · 연습장에서만 (바깥의 허수아비는 스킬이 노리지 않는다)
  targetable(e) { return !e.dead && !e.hidden && (e.def.ai !== 'dummy' || this.mode === 'plaza' || !!this.practice); }
  // 기술이 떨어질 자리: 걸을 수 있는 바닥이면 그대로, 벽 · 물 · 맵 밖이면 가까운 바닥으로 (60px 안에 없으면 null)
  floorNear(x, y, r = 10) {
    if (!this.blocked(x, y, r)) return { x, y };
    for (let d = 12; d <= 60; d += 12) for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d; if (!this.blocked(tx, ty, r)) return { x: tx, y: ty }; }
    return null;
  }
  // (x, ang) 방향으로 max까지 가다가 벽에 닿는 거리 (광선 · 돌진 예고선이 벽을 뚫지 않게)
  rayLen(x, y, ang, max) {
    const c = Math.cos(ang), sn = Math.sin(ang);
    const wall = (px, py) => { const t = this.tileAt(px, py); return t === T_WALL || t === T_CRACK || t === T_BUILD || t === T_GATE; }; // 물 · 허공 위로는 지나간다
    for (let d = 8; d <= max; d += 6) if (wall(x + c * d, y + sn * d)) return Math.max(0, d - 6);
    return max;
  }
  // (x, y) 둘레의 탁 트인 땅: 벽 · 물건 · 사람과 떨어져 있고 걸어서 곧장 갈 수 있는 곳 (튜토리얼 허수아비 자리 등)
  openSpot(x, y) {
    for (const d of [48, 64, 36, 80]) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d * 0.7;
      if (this.blocked(tx, ty, 12) || this.objects.some((o) => Math.hypot(o.x - tx, o.y - ty) < 28)) continue;
      let clear = true;
      for (let s = 0.25; s < 1 && clear; s += 0.25) clear = !this.blocked(x + (tx - x) * s, y + (ty - y) * s, 6);
      if (clear) return { x: tx, y: ty };
    }
    return { x: x + 46, y };
  }
  blocked(x, y, r, mode = null) {
    const s = (px, py) => this.solid(px, py, mode);
    return s(x - r, y - r) || s(x + r, y - r) || s(x - r, y + r) || s(x + r, y + r) || s(x, y - r) || s(x, y + r) || s(x - r, y) || s(x + r, y);
  }
  // 해방되지 않은 바깥 지역이면 그 안내 (main이 world.locks를 넣는다 · data/unlocks.js)
  sealAt(x, y) {
    const L = this.locks?.regions; if (!L?.size || !this.map.regions) return null;
    if (this.locks.keep?.some((k) => Math.hypot(x - k.x, y - k.y) < k.r)) return null; // 잠긴 지역 안이라도 열어 둔 곳 (내 종족 성지 둘레)
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) return null;
    return L.get(this.map.regions[ty * this.tw + tx]) || null;
  }
  // 잠긴 것을 건드렸다: 머리 위에 안내 (1초에 한 번)
  sealed(text) {
    if (this.t - (this.sealT ?? -9) < 1) return; this.sealT = this.t;
    const p = this.player; this.emit({ t: 'text', x: p.x, y: p.y - 26, text, color: '#c8b0ff' }); this.emit({ t: 'locked', x: p.x, y: p.y });
  }
  move(ent, dx, dy) {
    const r = Math.max(3, ent.r - 1), p = this.player;
    if (ent === p && this.locks?.regions.size && !this.sealAt(p.x, p.y)) { // 봉인된 지역으로는 걸어 들어갈 수 없다 (이미 안에 있으면 나올 수 있다)
      const sx = this.sealAt(p.x + dx * 4, p.y), sy = this.sealAt(p.x, p.y + dy * 4);
      if (sx) { dx = 0; this.sealed(`${sx.name} — ${sx.text}`); }
      if (sy) { dy = 0; this.sealed(`${sy.name} — ${sy.text}`); }
    }
    const mode = ent === p && this.map.outdoor && !this.map.underwater ? (p.boat ? 'boat' : this.canSwim ? 'swim' : null) : null;
    const sky = this.voidZone && ent !== p && ent.def && ent.def.shape !== 'flyer' && !ent.pushT; // 하늘 정원: 걷는 적은 하늘(가장자리)로 스스로 걸어가지 않는다
    const off = (x, y) => sky && this.tileAt(x, y + 3) === T_LIQUID;
    if (!this.blocked(ent.x + dx, ent.y, r, mode) && !off(ent.x + dx, ent.y)) ent.x += dx;
    if (!this.blocked(ent.x, ent.y + dy, r, mode) && !off(ent.x, ent.y + dy)) ent.y += dy;
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
    this.tickTemp(); this.runChain(); this.tickKnock();
    if (this.player.ccT > 0 || this.player.down) { // 기절 (결투에서 상대의 CC를 맞았다) · 파티 탑에서 쓰러졌다: 아무것도 못 한다
      if (this.player.ccT > 0) this.player.ccT -= DT;
      input = { ...input, moveX: 0, moveY: 0, attack: false, dash: false, interact: false, skill: false, s1: false, s2: false, s3: false, s4: false, wskill: false };
    }
    { // 결투: 상대가 건 묶기 · 침묵 · 공포 (사람에게 걸리는 CC)
      const p = this.player;
      for (const k of ['rootT', 'silT', 'fearT', 'abT', 'slowT', 'tauntT', 'webT']) if (p[k] > 0) p[k] -= DT;
      if (p.slowT > 0) input = { ...input, moveX: input.moveX * 0.45, moveY: input.moveY * 0.45 };
      if (p.tauntT > 0) { const f = p.tauntAt || this.enemies.find((x) => x.remote); if (f) { const dx = f.x - p.x, dy = f.y - p.y, l = Math.hypot(dx, dy) || 1; input = { ...input, moveX: l > 20 ? dx / l : 0, moveY: l > 20 ? dy / l : 0, aimX: f.x, aimY: f.y }; } } // 도발: 도발한 사람에게 끌려간다
      if (p.abT <= 0) p.ab = 0;
      if (p.rootT > 0) input = { ...input, moveX: 0, moveY: 0, dash: false };
      if (p.silT > 0) input = { ...input, s1: false, s2: false, s3: false, s4: false, wskill: false, skill: false };
      if (p.fearT > 0) { const f = this.enemies.find((x) => x.remote), dx = p.x - (f?.x ?? p.x - 1), dy = p.y - (f?.y ?? p.y), l = Math.hypot(dx, dy) || 1; input = { ...input, moveX: dx / l, moveY: dy / l, attack: false, dash: false, s1: false, s2: false, s3: false, s4: false, wskill: false }; }
    }
    if (this.state !== 'play') return;
    if (this.climb?.intro) input = { ...input, moveX: 0, moveY: 0, attack: false, dash: false, interact: false, skill: false, s1: false, s2: false, s3: false, s4: false, wskill: false }; // 보스 등장 연출 동안
    this.t += DT;
    if (this.clock) { this.clock.min += DT * MIN_PER_SEC; if (this.clock.min >= 1440) { this.clock.min -= 1440; this.clock.day++; } }
    this.updatePlayer(input);
    updateLife(this, input);
    this.updateDelayed();
    this.updateAllies();
    if (this.voyage) this.updateVoyage();
    if (this.skirmish && !this.skirmish.done && this.skirmish.foes.every((e) => e.dead)) { this.skirmish.done = true; this.signals.push({ t: 'skirmishWon', id: this.skirmish.id }); }
    if (this.happenT === undefined || (this.happenT -= DT) <= 0) { this.happenT = 0.25; this.updateHappenings(); }
    updateNpcLife(this, DT);
    if (this.pit?.e?.dead) { this.signals.push({ t: 'pitWon', bet: this.pit.bet, tier: this.pit.tier }); this.pit = null; }
    this.updateZones();
    this.updateFlow();
    this.updateEnemies();
    if (this.climb) this.updateClimb();
    this.updateVillages();
    this.updateTraining();
    this.updateProjs();
    this.updateClouds();
    this.updateDrops();
    this.updateCamps();
    this.updateExplore();
    this.updateOutdoor();
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.pvp) this.pvpFlush();
    if (this.pvp || this.coop) { // 결투 · 파티: 내가 쏜 투사체를 상대 화면에도 (보이기만)
      for (const pr of this.projs) if (pr.owner === 'p' && !pr.ghost && !pr.sent) { pr.sent = 1; (this.projOut ||= []).push([Math.round(pr.x), Math.round(pr.y), Math.round(pr.vx), Math.round(pr.vy), Math.round(Math.min(pr.life, 3) * 100) / 100, pr.color || '', pr.kind || '', pr.big ? 1 : 0]); }
    }
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
        this.emit({ t: 'region', name: info.name, first, vista: info.vista, lv: this.zone?.id === 'world' && info.lvShow ? info.lv : null });
        if (info.vista && this.story && !this.story.flags.vistaSeen) { this.story.flags.vistaSeen = true; this.emit({ t: 'vista', name: info.name }); this.signals.push({ t: 'save' }); }
      }
    }
    this.mileT -= DT;
    if (this.mileT <= 0 && !this.practice && !this.voyage && !this.climb) {
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
    p.healBank = Math.min(d.maxHp * 0.05, (p.healBank ?? 0) + d.maxHp * 0.03 * DT); // 1초에 최대 체력 3%까지 (쌓아 둘 수 있는 몫 5%)
    if (p.markT > 0) p.markT -= DT;
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
    if (p.potionCd > 0) p.potionCd -= DT; // 물약 · 요리는 한 번 먹으면 POTION_CD초 뒤에 다시
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
      if (lq === 'water' || lq === 'oil' || lq === 'ink') slow = Math.max(slow, 0.35); // 기름 · 먹 웅덩이도 발이 묶인다
      if (lq === 'snow') slow = Math.max(slow, 0.25);
      if (lq === 'lava' && p.liquidT <= 0) { p.liquidT = 0.8; this.hurtPlayer(6 + this.zone.floor * 4, 'mag', null, { direct: true, status: 'burn' }); }
    }

    this.autoAim = inp.autoAim !== false;
    const locked = (p.motion && p.motion.lock) || p.windupT > 0 || p.castT > 0 || p.channel;
    if (!locked && Number.isFinite(inp.aimX) && Number.isFinite(inp.aimY)) {
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
      if (inp.mount) this.toggleMount();
      if (inp.dash && p.boat && this.canSwim) { p.boat.riding = false; p.boat = null; this.emit({ t: 'splash', x: p.x, y: p.y }); } // 배에서 물로 뛰어든다
      else if (inp.dash && (p.boat || p.swim)) { /* 물 위에서는 대시가 없다 */ }
      else if (inp.dash && p.dashCharges > 0 && p.dashCd <= 0) {
        const dx = ml > 0 ? mx : p.aimX, dy = ml > 0 ? my : p.aimY;
        p.dashT = 0.16; p.dvx = dx * 400 * (p.riding ? 1.5 : 1); p.dvy = dy * 400 * (p.riding ? 1.5 : 1); p.invuln = Math.max(p.invuln, 0.22);
        if (p.riding) this.emit({ t: 'raptorLeap', x: p.x, y: p.y });
        p.dashCharges--; if (p.dashRecharge <= 0) p.dashRecharge = d.dashCd * (1 - d.cdr);
        this.knack('dash');
        if (p.castT > 0) { p.castT = 0; p.castSkill = null; this.emit({ t: 'text', x: p.x, y: p.y - 20, text: '시전 취소', color: '#a8b0c0' }); }
        if (this.raceRes?.dash) this.addRes(this.raceRes.dash);
        p.dashCd = 0.25;
        if (f.has('dashCrit')) p.dashCritReady = true;
        this.emit({ t: 'dash', x: p.x, y: p.y, dx, dy });
        if (f.has('dashAfterimage')) this.afterimage(p.x, p.y, p.x + dx * 64, p.y + dy * 64);
        for (const tr of this.b.triggers.dash) if (this.trig(tr)) this.doAction(tr.action, null, { x: p.x, y: p.y, dir: Math.atan2(dy, dx) }); // 대시 방향을 함께 넘긴다
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
    if (inp.attack && p.riding) { this.dismount(); p.atkCd = Math.max(p.atkCd, 0.25); }
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
      if (o.noPrompt || o.riding || o.away || o.hostile) continue; // 기절 · 마차 안 · 화난 NPC에게는 말을 걸 수 없다
      const dd = Math.hypot(o.x - p.x, o.y - p.y);
      if (o.hidden && !o.found) { if (dd < (this.d.senseR || 30)) { o.found = true; this.emit({ t: 'text', x: o.x, y: o.y - 18, text: '숨겨진 상자를 찾았다!', color: '#ffe8a0' }); this.emit({ t: 'ring', x: o.x, y: o.y, r: 22, color: '#ffe8a0' }); } else continue; }
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

  // ═══════ 항해: 시간이 흘러 목적지에 닿는다. 싸우는 동안은 배가 멈춘다(항해가 길어진다) ═══════
  updateVoyage() {
    const v = this.voyage;
    if (v.fighting) {
      if (!this.enemies.some((e) => !e.dead)) { const kind = v.fighting; v.fighting = null; v.extra += this.t - v.fightT0; this.signals.push({ t: 'voyageWon', kind }); }
      return;
    }
    if (v.waiting) return; // 선택지 창이 떠 있다
    v.t += DT;
    if (!v.rolled && v.t >= v.eventAt) {
      v.rolled = true;
      const r = this.rng.next();
      let acc = 0;
      for (const [id, ev] of Object.entries(v.events)) { acc += ev.chance; if (r < acc) { v.approach = { id, t: 0, dur: 14 }; this.emit({ t: 'seaSight', id }); break; } } // 수평선에 보이고 다가온다
    }
    if (v.approach) { v.approach.t += DT; if (v.approach.t >= v.approach.dur) { const id = v.approach.id; v.approach = null; v.event = id; v.waiting = true; this.signals.push({ t: 'seaEvent', id }); } }
    if (v.t >= v.dur) { v.done = true; this.signals.push({ t: 'voyageEnd' }); }
  }
  // 무리를 불러 세운다 (벌어지는 일 · 경비병 · 고위 관계자의 호위): list = [[몬스터, 수, 이름표]]
  spawnGroup(list, x, y, lv, opt = {}) {
    const out = [];
    let k = 0;
    for (const [id, n, tag] of list) for (let i = 0; i < n; i++, k++) {
      const a = (k / Math.max(1, list.reduce((s, q) => s + q[1], 0))) * Math.PI * 2 + 0.4;
      let ex = x + Math.cos(a) * (opt.r || 40), ey = y + Math.sin(a) * (opt.r || 40) * 0.8;
      if (this.blocked(ex, ey, 6)) { ex = x + Math.cos(a) * 16; ey = y + Math.sin(a) * 12; }
      if (this.blocked(ex, ey, 6)) { ex = x; ey = y; }
      const e = this.makeEnemy(id, ex, ey, { noAffix: true });
      this.applyLevel(e, lv); if (tag) { e.tag = tag; if (e.def.elite) e.champion = tag; }
      e.state = opt.idle ? 'idle' : 'chase'; e.home = { x: ex, y: ey };
      this.enemies.push(e); out.push(e);
      this.emit({ t: 'summon', x: ex, y: ey, color: '#c8c0b0' });
    }
    return out;
  }
  // 벌어지는 일: 길을 따라 느릿느릿 움직이고, 시간이 다 되면 끝난다 (싸우는 중이면 기다린다)
  updateHappenings() {
    for (const o of this.objects) {
      if (o.kind !== 'happening' || o.gone) continue;
      if (o.engaged) continue;
      if (this.t > o.endT) { o.gone = true; o.reusable = false; this.signals.push({ t: 'happeningGone', id: o.hid }); continue; }
      if (o.dest) { const dx = o.dest.x - o.x, dy = o.dest.y - o.y, l = Math.hypot(dx, dy); if (l > 4) { const nx = o.x + dx / l * 3, ny = o.y + dy / l * 3; if (!this.blocked(nx, ny, 6)) { o.x = nx; o.y = ny; o.dir = dx > 0 ? 1 : -1; } } }
    }
    this.objects = this.objects.filter((o) => !(o.kind === 'happening' && o.gone && this.t > o.endT + 1));
  }

  // 해적 · 바다뱀이 갑판에 올라탄다
  spawnBoarders(kind, level) {
    const v = this.voyage, spots = this.map.board || [];
    const lv = Math.max(1, level);
    const list = kind === 'serpent' ? [['seaSerpent', 1, 2.4]] : kind === 'merchant' ? [['royalGuard', 3, 1], ['bandit', 1, 1.8]] : [['bandit', 3 + Math.min(3, Math.floor(lv / 12)), 1], ['darkArcher', 2, 1], ['bandit', 1, 2.2]];
    let k = 0;
    for (const [id, n, big] of list) for (let i = 0; i < n; i++, k++) {
      const s = spots[(k * 3 + 1) % spots.length] || { x: this.player.x + 60, y: this.player.y };
      const e = this.makeEnemy(id, s.x, s.y, { noAffix: true });
      const m = 0.7 + lv * 0.06;
      e.maxHp = e.hp = Math.round(e.maxHp * m * big); e.atk = Math.round(e.atk * (0.6 + lv * 0.03) * (big > 1 ? 1.3 : 1));
      if (big > 1) e.champion = kind === 'serpent' ? '거대 바다뱀' : kind === 'merchant' ? '상선 호위대장' : '해적 두목'; else e.tag = kind === 'merchant' ? '상선 호위병' : id === 'bandit' ? '해적' : '해적 궁수';
      e.state = 'chase'; e.home = { x: s.x, y: s.y };
      this.enemies.push(e);
      this.emit({ t: 'summon', x: s.x, y: s.y, color: kind === 'serpent' ? '#3ab8b0' : '#c8c0b0' });
    }
    v.fighting = kind; v.fightT0 = this.t; v.waiting = false;
    this.emit({ t: 'shake', v: 6 });
  }

  // 이동 포탈로 건너간다: 도착한 포탈 바로 앞(남쪽)에 선다. 부하 · 소환수도 함께 온다
  teleportTo(id) {
    const o = this.objects.find((q) => q.kind === 'waypoint' && q.id === id && q.active);
    return !!o && this.warpTo(o.x, o.y + 18, o);
  }
  // (x, y) 근처의 빈 땅으로 건너간다 (포탈 · 성지 길). o: 도착 연출의 기준 (없으면 그 자리)
  warpTo(x, y, o = { x, y }) {
    const p = this.player;
    if (p.boat || p.swim) return false;
    this.emit({ t: 'wpLeave', x: p.x, y: p.y });
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
    { // 해방되지 않은 체계 · 들어가는 곳
      const lock = this.locks && (o.kind === 'boat' ? this.locks.text('systems', 'sailing') : o.kind === 'sanctum' ? this.locks.text('systems', 'sanctum') : o.kind === 'spirit' || o.kind === 'spiritKing' ? this.locks.text('systems', 'spirit') : o.kind === 'entrance' ? this.locks.text('entrances', o.id) : null);
      if (lock) { this.sealed(lock); return; }
    }
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
    if (o.kind === 'happening') { this.signals.push({ t: 'happening', id: o.hid }); return; }
    if (o.kind === 'coach') { this.signals.push({ t: 'coach' }); return; } // 역마차 타기
    if (o.kind === 'npc' || o.kind === 'priceBoard' || o.kind === 'ladderUp' || o.kind === 'hiddenWay' || o.kind === 'chronicle') { this.signals.push({ t: 'npc', id: o.id }); return; }
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
    if (o.kind === 'lightPillar') { lightPillar(this, o); return; }
    if (o.kind === 'climbDoor') { if (this.t - (o.born || 0) < 0.4) return; this.signals.push({ t: 'climbDoor', next: o.next }); return; }
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
    if (o.kind === 'towerDoor') { this.signals.push({ t: 'tower' }); return; }
    if (o.kind === 'raidAltar') { this.signals.push({ t: 'raid' }); return; } // 레이드 제단 // 각인의 탑 100층 (예전 층 고르기는 보류)
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
      const gold = this.climb ? Math.round((o.rich ? 2 : 1) * (22 + this.climb.f * 3)) : Math.round(((o.rich ? 40 : 12) * this.zone.floor + this.rng.int(0, 10)) * 0.55); // 탑: 탑 금화
      for (let i = 0; i < 5; i++) this.spawnDrop(o.x, o.y, 'gold', null, Math.ceil(gold / 5));
      return;
    }
    if (o.kind === 'lore') {
      o.opened = true;
      const text = o.text || LORES[this.rng.int(0, LORES.length - 1)];
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

  attack(angOff) { // 내 공격: 닿은 곳의 NPC는 화가 난다 (설정에서 NPC 공격을 켰을 때)
    this.pHit = true; const tok = this.curTok = (this.tokN = (this.tokN || 0) + 1), n0 = this.projs.length;
    try { return this.attack0(angOff); } finally {
      for (let i = n0; i < this.projs.length; i++) if (this.projs[i].owner === 'p') this.projs[i].tok = tok; // 이 공격에서 나간 탄
      const p = this.player, rg = this.b.weapon?.range || 26; if (this.b.weapon?.kind !== 'proj') pokeNpcs(this, p.x + p.aimX * rg * 0.6, p.y + p.aimY * rg * 0.6, rg * 0.55, tok);
      this.pHit = false; this.curTok = null;
    }
  }
  attack0(angOff) {
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
    const atk = (type === 'phys' ? (w.scale === 'agi' ? d.dexAtk : d.physAtk) : d.magAtk) * (this.b.wScale?.dmg ?? 1); // 무기 스탯 계수
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
      { // 탄 쳐내기: 휘두른 범위 안의 적 탄은 사라진다 (근접이 원거리 몬스터에게 일방적으로 맞지 않게)
        const R = w.range + 10;
        for (const pr of this.projs) {
          if (pr.owner !== 'e' || pr.life <= 0) continue;
          const dx = pr.x - p.x, dy = pr.y - p.y, dd = Math.hypot(dx, dy); if (dd > R) continue;
          let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
          if (great || Math.abs(da) <= Math.max(thrust ? 0.5 : w.arc, 1.2) / 2 + 0.3 || dd < 14) { pr.life = 0; this.emit({ t: 'spark', x: pr.x, y: pr.y, color: pr.color || '#ffe8a0' }); this.emit({ t: 'deflect', x: pr.x, y: pr.y }); }
        }
      }
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
    if (key === 'moveSpeed' && p.riding) m *= 1.75;
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
  // 탈것 (공룡 수인 거대 둥지에서 길들인 랩터): 바깥 세계 · 섬에서만, 물 · 배 위는 안 된다
  toggleMount() {
    const p = this.player;
    if (p.riding) { this.dismount(); return; }
    { const lock = this.locks?.text('systems', 'mount'); if (lock) { this.sealed(`탈것 — ${lock}`); return; } }
    if (!this.mountKind) { this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '탈것이 없다 (거대 둥지에서 길들인다)', color: '#a8b0c0' }); return; }
    if (!this.map.outdoor || this.map.underwater || p.swim || p.boat || p.castT > 0 || p.channel) { this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '여기서는 탈 수 없다', color: '#a8b0c0' }); return; }
    p.riding = this.mountKind; this.emit({ t: 'mountOn', x: p.x, y: p.y });
  }
  dismount() { const p = this.player; if (!p.riding) return; p.riding = null; this.emit({ t: 'mountOff', x: p.x, y: p.y }); }

  castSkillId(id, slot) { this.pHit = true; const tok = this.curTok = (this.tokN = (this.tokN || 0) + 1), n0 = this.projs.length; try { return this.castSkillId0(id, slot); } finally { for (let i = n0; i < this.projs.length; i++) if (this.projs[i].owner === 'p') this.projs[i].tok = tok; this.pHit = false; this.curTok = null; } } // 조준해서 쓴 스킬 한 번 = 표 하나
  // 캐릭터 몸 동작 (렌더러가 읽는다): kind, 진행 시간, 길이
  motion(kind, dur, extra = {}) {
    if (!kind) return;
    const p = this.player;
    p.motion = { kind, t: 0, dur, ang: Math.atan2(p.aimY, p.aimX), dir: p.dir, lock: extra.lock !== false, ...extra };
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
    const list = this.enemies.filter((e) => this.targetable(e) && Math.hypot(e.x - p.x, e.y - p.y) < R);
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

  aimPoint(maxDist = 160) {
    const p = this.player, dist = Math.min(maxDist, this.aimDist || 100);
    return { x: p.x + p.aimX * dist, y: p.y + p.aimY * dist };
  }

  nearestEnemy(range, fromAim = true) {
    const p = this.player;
    let best = null, bd = range;
    for (const e of this.enemies) {
      if (!this.targetable(e)) continue;
      const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      let score = dist;
      if (fromAim) { const dot = (dx * p.aimX + dy * p.aimY) / (dist || 1); score -= dot * 40; }
      if (score < bd) { bd = score; best = e; }
    }
    return best;
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
    if (forest) this.heal(this.d.maxHp * 0.0028 * forest * DT, 'regen');
  }

  // 계약한 정령: 불러내면 어깨 위를 떠다니며 버프를 주고, 가까운 적을 그 속성으로 공격한다
  summonFamiliar(dur, emp = 0) {
    const p = this.player, sp = this.b.spirit, S = SPIRITS[sp?.id];
    if (!S) return;
    const old = p.familiar;
    p.familiar = { id: S.id, elem: S.elem, grade: S.grade, star: sp.star || 1, lv: sp.lv || 1, t: dur, max: dur, emp, guard: 0, cd: 0.4, x: old?.x ?? p.x - p.dir * 12, y: old?.y ?? p.y - 18, phase: old?.phase || 0 };
    this.emit({ t: 'spiritIn', x: p.familiar.x, y: p.familiar.y + 10, elem: SPIRIT_DMG_ELEM[S.elem], n: 1 + S.grade });
    // 정령사: 계약한 정령 둘을 더 데리고 다닌다 (버프 70% · 공격은 따로)
    p.famExtra = (this.b.spirits2 || []).filter((x) => SPIRITS[x.id]).map((x, i) => { const T = SPIRITS[x.id], o = p.famExtra?.[i]; return { id: T.id, elem: T.elem, grade: T.grade, star: x.star || 1, lv: x.lv || 1, slot: i + 1, cd: 0.6 + i * 0.3, x: o?.x ?? p.x, y: o?.y ?? p.y - 18, phase: (i + 1) * 2.1 }; });
    if (!old) this.emit({ t: 'text', x: p.x, y: p.y - 34, text: `${S.name}${'★'.repeat(p.familiar.star)} Lv ${p.familiar.lv}`, color: SPIRIT_GRADES[S.grade].color });
  }
  famShoot(f) {
    const p = this.player, E = SPIRIT_ELEMS[f.elem], col = ELEM[SPIRIT_DMG_ELEM[f.elem]]?.color || '#9bffb0';
    f.cd -= DT * (f.emp > 0 ? 2 : 1);
    if (f.cd > 0) return;
    let tgt = null, td = 150;
    for (const e of this.enemies) { if (!this.targetable(e)) continue; const d2 = Math.hypot(e.x - p.x, e.y - p.y); if (d2 < td) { td = d2; tgt = e; } }
    if (!tgt) { f.cd = 0.2; return; }
    f.cd = 1.15 - 0.08 * f.grade;
    const elem = SPIRIT_DMG_ELEM[f.elem], dmg = this.skillAtk('best') * 0.6 * E.atk * spiritPower(f.id, f.star, f.lv) * (f.emp > 0 ? 1.6 : 1);
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
  // 부하를 벽에서 빼낸다: 지금 자리 둘레의 가까운 빈자리 → 없으면 내 곁의 빈자리
  allyRescue(al) {
    const r = Math.max(3, (al.r || 5) - 1), p = this.player;
    for (const [cx, cy] of [[al.x, al.y], [p.x, p.y]]) for (let d = 4; d <= 40; d += 4) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (!this.blocked(x, y, r) && (cx === p.x || this.clearLine(x, y, p.x, p.y) || d <= 12)) { al.x = x; al.y = y; al.path = null; return; }
    }
    al.x = p.x; al.y = p.y; al.path = null;
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
      if (z.kind === 'sanctuary' && Math.hypot(p.x - z.x, p.y - z.y) < z.r) this.heal(this.d.maxHp * 0.012 * DT, 'skill');
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
    if (proj && e.wardT > this.t) base *= 0.6; // 보스 「화살 막이」: 투사체 피해 -40%
    let crit = this.rng.chance(d.crit + this.modAdd('crit'));
    if (p.dashCritReady) { crit = true; p.dashCritReady = false; }
    if (p.buffs.nextCrit) { crit = true; delete p.buffs.nextCrit; }
    if (crit && this.raceRes?.crit) this.addRes(this.raceRes.crit);
    this.aggro(e);
    let charge = 1;
    if (p.buffs.charged && !opt.skill) { charge = p.buffs.charged.power || 2.5; p.buffs.charged.t = Math.min(p.buffs.charged.t, 0.05); heavy = true; }
    if (p.stealthStrike) { charge *= 2; heavy = true; p.stealthStrike = false; this.emit({ t: 'text', x: e.x, y: e.y - 22, text: '기습!', color: '#b89aff' }); }
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
    if (this.b.cls === 'predator' && bleeding) this.heal(d.maxHp * 0.0006, 'steal');
    if (p.buffs.apex && !e.dead) this.applyStatus(e, 'bleed', 2);
    if (p.spirits.length && !e.dead) {
      const fire = this.spiritCount('fire'), forest = this.spiritCount('forest'), wind = this.spiritCount('wind');
      if (fire && this.rng.chance(0.3 * fire)) this.applyStatus(e, 'burn', 1);
      if (fire && forest && e.st.burn) this.heal(d.maxHp * 0.002, 'skill');
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
    for (const tr of this.b.triggers.hit) if (this.trig(tr)) this.doAction(tr.action, e, e);
    if (crit) {
      if (f.has('markOnCrit') && !e.dead) e.st.mark = 3;
      if (f.has('critBleed')) this.applyStatus(e, 'bleed', 2);
      for (const tr of this.b.triggers.crit) if (this.trig(tr)) this.doAction(tr.action, e, e);
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
      case 'thirst': if (bleeding) this.heal(d.maxHp * 0.003, 'steal'); break;
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
    if (info.heal > 0 && p.potionCd > 0) { this.emit({ t: 'text', x: p.x, y: p.y - 26, text: `아직 먹을 수 없다 (${Math.ceil(p.potionCd)}초)`, color: '#c8b8a0' }); return false; } // 요리 · 물약은 회복 대기시간을 함께 쓴다
    life.bag[id]--;
    if (info.heal > 0) p.potionCd = POTION_CD;
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
      this.heal(this.d.maxHp * u.heal, 'potion'); p.potionCd = POTION_CD;
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
    if (m.cc === 'stun' && m.dur > 0 && !(p.dashT > 0)) { /* 맞은 직후의 짧은 무적과는 상관없이 (구르는 중에만 피한다) */ p.ccT = Math.max(p.ccT || 0, m.dur * (1 - this.d.statusRes * 0.5)); this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '기절', color: '#ffd060' }); }
    if (m.status && ['burn', 'poison', 'bleed', 'chill'].includes(m.status)) this.applyPlayerStatus(m.status, 8 + (m.stacks || 1) * 4);
    const res = 1 - this.d.statusRes * 0.5, say = (text, color) => this.emit({ t: 'text', x: p.x, y: p.y - 24, text, color });
    if (m.cc === 'fear' && m.dur > 0 && !(p.dashT > 0)) { p.fearT = Math.max(p.fearT || 0, m.dur * res); say('공포', '#c45cff'); }
    if (m.root > 0) { p.rootT = Math.max(p.rootT || 0, m.root * res); say('속박', '#7be38a'); }
    if (m.sil > 0) { p.silT = Math.max(p.silT || 0, m.sil * res); say('침묵', '#c8b8ff'); }
    if (m.kx || m.ky) { const k = 0.14 * PVP.cc; this.move(p, Math.max(-60, Math.min(60, m.kx * k)), Math.max(-60, Math.min(60, m.ky * k))); }
    if (m.pull && !this.blocked(m.pull.x, m.pull.y, 5)) { p.x = m.pull.x; p.y = m.pull.y; say('끌려갔다', '#ffd060'); }
    if (m.ab > 0) { p.ab = Math.min(5, m.ab); p.abT = 5; }
    if (m.slow > 0) { p.slowT = Math.max(p.slowT || 0, m.slow * res); say('느려짐', '#9fe3ff'); }
    if (m.taunt > 0) { p.tauntT = Math.max(p.tauntT || 0, m.taunt * res); p.tauntAt = null; say('도발당함', '#ffd84a'); }
    if (m.lure) { p.tauntT = Math.max(p.tauntT || 0, m.lure.dur * res); p.tauntAt = { x: m.lure.x, y: m.lure.y }; say('미끼에 끌린다', '#ffd84a'); }
  }
  // 결투: 내 기술이 상대(화면 속 상대)에게 건 것(밀치기 · 얼림 · 공포 · 속박 · 침묵 · 끌어오기 · 갑옷 부수기)을 상대에게 넘기고 비운다
  pvpFlush() {
    const e = this.enemies.find((x) => x.remote && !x.dead); if (!e) return;
    const st = e.st, m = { t: 'dhit', dmg: 0 }, P = this.player, r1 = (v) => Math.round(v * 100) / 100;
    if (Math.abs(e.kbx) + Math.abs(e.kby) > 1) { m.kx = Math.round(e.kbx); m.ky = Math.round(e.kby); }
    e.kbx = 0; e.kby = 0;
    const frz = Math.max(st.frozen || 0, st.stun || 0); if (frz > 0) { m.cc = 'stun'; m.dur = r1(frz * PVP.cc); st.frozen = 0; st.stun = 0; }
    if (st.flee > 0) { m.cc = m.cc || 'fear'; m.dur = m.dur || r1(st.flee * PVP.cc); st.flee = 0; }
    if (e.rooted > 0) { m.root = r1(e.rooted * PVP.cc); e.rooted = 0; }
    if (e.silenceT > 0) { m.sil = r1(e.silenceT * PVP.cc); e.silenceT = 0; }
    if (e.reelT > 0) { const gap = P.r + 12; m.pull = { x: Math.round(P.x + P.aimX * gap), y: Math.round(P.y + P.aimY * gap) }; e.reelT = 0; }
    if (e.graspT > 0 && e.graspTo) { const G = e.graspTo; m.pull = { x: Math.round(G.x + (e.x > G.x ? 12 : -12)), y: Math.round(G.y) }; e.graspT = 0; } // 붙잡는 망령의 팔
    if (e.armorBreak > 0) { m.ab = e.armorBreak; e.armorBreak = 0; }
    if (st.slowZ > 0) { m.slow = r1(Math.min(3, st.slowZ) * PVP.cc); st.slowZ = 0; }
    if (e.provokeT > 0) { m.taunt = r1(e.provokeT * PVP.cc * 0.5); e.provokeT = 0; }
    if (e.lureT > 0) { m.lure = { x: Math.round(e.lureX), y: Math.round(e.lureY), dur: r1(Math.min(2, e.lureT) * PVP.cc) }; e.lureT = 0; } // 미끼: 미끼 쪽으로 끌린다
    if (e.loseT > 0) { m.sil = Math.max(m.sil || 0, r1(Math.min(3, e.loseT) * PVP.cc * 0.5)); e.loseT = 0; } // 연막: 앞이 안 보여 기술을 못 쓴다
    for (const k of ['burn', 'poison', 'bleed', 'chill', 'curse']) if (st[k] && (st[k].t -= DT) <= 0) st[k] = null;
    if (Object.keys(m).length > 2) this.pvp.out.push(m);
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
    if (e.dead || e.hidden || e.under || e.begging) return 0;
    if (e.mv?.k === 'channel' && !opt.fromDot) e.mv.taken = (e.mv.taken || 0) + amount; // 늪의 마녀: 의식 중 받은 피해 (대략)
    if (e.invulnT > 0) { if (!opt.fromDot) this.emit({ t: 'text', x: e.x, y: e.y - 18, text: '무적', color: '#c8a8ff' }); return 0; } // 망령: 순간이동 뒤 잠깐 무적
    if (e.dormant) { e.dormant = false; e.state = 'chase'; this.aggro(e); this.emit({ t: 'text', x: e.x, y: e.y - 20, text: '미믹!', color: '#ff5a3a' }); }
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
    if (e.mirrorT > 0) { // 미궁의 군주: 반사 방패 — 피해 대신 나에게 되돌아온다
      if (!opt.fromDot && this.t - (e.mirrorHitT ?? -9) > 0.25) { e.mirrorHitT = this.t; this.hurtPlayer(Math.min(amount * 0.5, this.d.maxHp * 0.12), 'mag', e, { fromX: e.x, fromY: e.y }); this.emit({ t: 'text', x: e.x, y: e.y - 22, text: '반사!', color: '#9fe8ff' }); this.emit({ t: 'parryFx', x: e.x, y: e.y - e.r }); }
      return 0;
    }
    e.lastHitT = this.t;
    if (e.def.veil) e.revealT = 4; // 지워진 기록: 맞으면 4초 동안 드러난다
    if (e.hiding && !opt.fromDot) shardHit(this, e); // 깨진 거울의 여왕: 진짜를 찾았다
    if (e.thornsT > this.t && !opt.fromDot && this.t - (e.thornT ?? -9) > 0.3) { /* 가시 세움 중: 거리 상관없이 */ e.thornT = this.t; this.hurtPlayer(Math.min(amount * 0.15, d.maxHp * 0.05), 'phys', e, { fromX: e.x, fromY: e.y }); this.emit({ t: 'text', x: p.x, y: p.y - 22, text: '가시!', color: '#ffb07a' }); }
    let mult = d.dmgMul * ((e.remote ? CLASS_BAL : CLASS_BAL_PVE)[this.b.cls] ?? 1) * (this.balMul ?? 1); // 클래스 밸런스 보정 (결투는 따로)
    if (e.exposedT > 0) mult *= e.exposeMul || 2; // 수호자의 빈틈: 기절 · 과열 · 의식 실패
    if (this.climb?.gz) mult *= zoneTakeMul(this, e); // 빛의 정상: 빛 안 +25% · 그림자 -30% · 별자리 위에서 +20%
    if (e.def.frontGuard && !opt.fromDot) mult *= (p.x - e.x) * (e.dir || 1) > 0 ? 0.4 : 1.3; // 철갑 딱정벌레: 정면은 단단하고 뒤가 약점
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
    if (e.guardT > 0) mult *= 0.6; // 몬스터 회복 · 보호: 잠깐 받는 피해 -40%
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
    let dmg = amount * mult;
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
    if (e.bshield > 0) { const ab = Math.min(e.bshield, dmg); e.bshield -= ab; dmg -= ab; if (e.bshield <= 0) { this.emit({ t: 'text', x: e.x, y: e.y - 34, text: '보호막이 깨졌다!', color: '#bfe8ff' }); this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 40, elem: 'ice', fx: 'shatter' }); } }
    if (e.bind && opt.src !== 'bind' && dmg > 0) e.bind.acc += dmg * 0.3; // 그림자 꿰기: 묶인 동안 받은 피해의 30%
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
      const more = p.lsT === this.t; p.lsT = this.t; // 한 번 휘둘러 여러 적을 맞히면 두 번째 적부터는 범위 공격처럼 약하게
      if (ls > 0) this.heal(Math.min(dmg * ls * LIFESTEAL_PER * (opt.src === 'aoe' || more ? 0.35 : 1), d.maxHp * 0.025), 'steal'); // 범위 공격 흡혈은 약하게, 한 번에 최대 체력 2.5%까지
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
    if (e.remote) { this.pvp?.out.push({ t: 'dhit', dmg: 0, status: kind, stacks }); const o = e.st[kind]; e.st[kind] = { n: Math.min(12, (o?.n || 0) + stacks), t: 5 }; return; } // 결투: 상태이상을 여기서도 적어 둔다 (중독 터뜨리기 · 전염 같은 스킬이 보도록)
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
      if (this.f.has('burnExplode') && st.burn && st.burn.n >= 5) { // (옮겨붙은 불이 터지며 이 적의 불을 먼저 꺼뜨렸을 수 있다)
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

  // ───── 싸우는 중에 잠깐 오르는 스탯 ─────
  // 스킬 · 각인이 잠깐 스탯을 올리면 빌드를 다시 계산한다 (0.2초에 한 번까지) → 각인 조건 · 각성 문턱이 그 자리에서 켜지고 꺼진다
  addTemp(stat, v, dur, name) {
    const p = this.player; p.tmp ||= [];
    const cur = p.tmp.filter((x) => x.stat === stat).reduce((a, x) => a + x.v, 0), room = TEMP_MAX - cur;
    if (room <= 0) { const old = p.tmp.find((x) => x.stat === stat); if (old) old.t = Math.max(old.t, dur); return; } // 한도: 시간만 늘린다
    p.tmp.push({ stat, v: Math.min(v, room), t: dur }); this.tmpDirty = true;
    this.emit({ t: 'text', x: p.x, y: p.y - 30, text: `${STAT_SHORT[stat] || stat} +${Math.min(v, room)}`, color: '#ffe08a' });
  }
  tickTemp() {
    const p = this.player; if (!p?.tmp?.length && !this.tmpDirty) return;
    if (p.tmp?.length) { for (const x of p.tmp) x.t -= DT; const n = p.tmp.length; p.tmp = p.tmp.filter((x) => x.t > 0); if (p.tmp.length !== n) this.tmpDirty = true; }
    this.tmpCd = (this.tmpCd || 0) - DT;
    if (!this.tmpDirty || this.tmpCd > 0 || !this.b?.lo) return;
    this.tmpDirty = false; this.tmpCd = 0.2;
    const tempStats = {}; for (const x of p.tmp || []) tempStats[x.stat] = (tempStats[x.stat] || 0) + x.v;
    const before = new Set(this.b.awakenings.filter((a) => a.on).map((a) => a.stat + a.at));
    this.tmpRebuild = true; this.setBuild(computeBuild({ ...this.b.lo, tempStats })); this.tmpRebuild = false;
    for (const a of this.b.awakenings) if (a.on && !before.has(a.stat + a.at)) { // 문턱을 넘었다: 그 순간을 알리고, 「각성하면」 효과가 깨어난다
      this.emit({ t: 'text', x: p.x, y: p.y - 42, text: `각성 · ${a.name}`, color: '#ffd060' });
      this.chainEvent('awaken', null, p);
    }
  }
  // ───── 연쇄: 효과가 만든 일이 다른 효과를 깨운다 (몇 단계든 이어진다) ─────
  // 지금 일어난 일은 다음 순간(다음 프레임)에 처리한다 → 끝없는 고리도 멈추지 않고 계속 돈다. 같은 효과가 같은 대상에게는 0.15초에 한 번까지만 다시 깨어난다
  chainEvent(ev, target, pos) { (this.chainNext ||= []).push({ ev, target, pos: pos && { x: pos.x, y: pos.y }, depth: (this.chainDepth || 0) + 1 }); }
  runChain() {
    const q = this.chainNext; if (!q?.length) return; this.chainNext = [];
    const wait = new Set(); // 아직 다시 깨어날 수 없는 일: 사라지지 않고 기다렸다가 이어진다 (같은 일 · 같은 대상은 하나만)
    for (const c of q) {
      const list = this.b.triggers[c.ev]; if (!list?.length) continue;
      if (c.target?.dead && c.ev === 'hit') continue;
      this.chainDepth = c.depth; const blocked = [];
      for (const tr of c.only || list) {
        const icdM = (this.icd ||= new WeakMap()), who = c.target || this.player, icd = icdM.get(tr) || (icdM.set(tr, new WeakMap()), icdM.get(tr)); // 같은 효과 · 같은 대상은 0.15초에 한 번
        if ((icd.get(who) || 0) > this.t) { blocked.push(tr); continue; }
        if (c.ev === 'hit' && c.target?.dead) continue;
        if (this.trig(tr)) { icd.set(who, this.t + 0.15); this.doAction(tr.action, c.target, c.target || c.pos || this.player); if (c.depth >= 2) this.chainShow(c.depth); }
      }
      this.chainDepth = 0;
      const key = c.ev + ':' + (c.target?.id ?? 'p');
      if (blocked.length && !wait.has(key)) { wait.add(key); this.chainNext.push({ ...c, only: blocked }); } // 막힌 효과만 기다렸다가 한 번 깨어난다
    }
  }
  chainShow(depth) { // 「연쇄 ×N」: 이어질수록 크고 붉게
    if ((this.chainShowT || 0) > this.t && depth <= (this.chainShown || 0)) return;
    this.chainShown = depth; this.chainShowT = this.t + 0.4;
    const p = this.player; this.emit({ t: 'text', x: p.x, y: p.y - 52, text: `연쇄 ×${depth}`, color: depth >= 8 ? '#ff5a5a' : depth >= 4 ? '#ffb040' : '#ffe08a' });
  }
  trig(tr) { // 각인 · 무기 효과가 일어날지: every면 N번째마다 꼭, 아니면 확률
    if (tr.every) { tr.n = (tr.n || 0) + 1; return tr.n % tr.every === 0; }
    return this.rng.chance(tr.chance ?? 1);
  }
  heal(amount, kind) {
    const p = this.player, d = this.d;
    if (amount <= 0 || this.state === 'dead' || this.f.has('noHeal') || this.player.down) return;
    if (this.pvp) amount *= PVP.heal; // 대전: 회복 절반
    if (this.b.race === 'undead' && kind !== 'drain' && !(kind === 'steal' && this.f.has('undeadLifesteal'))) amount *= 0.5;
    amount *= d.healMul ?? 1; // 서약 「메마른 샘」
    // 물약 · 샘 말고는 회복이 1초에 최대 체력 3%씩만 들어온다 (한꺼번에 쌓아 둘 수 있는 몫은 5%). 회복 수치는 적힌 그대로 (숨은 배율 없음)
    if (!this.pvp && kind !== 'potion' && kind !== 'spring' && kind !== 'room') {
      const bank = (p.healBank ??= d.maxHp * 0.05);
      amount = Math.min(amount, bank); p.healBank = bank - amount;
    }
    const room = d.maxHp - p.hp;
    if (amount <= room) p.hp += amount;
    else {
      p.hp = d.maxHp;
      if (this.f.has('overhealShield')) p.shield = Math.min(d.maxHp * 0.3, p.shield + (amount - room));
    }
  }

  hurtPlayer(amount, type, attacker, opt = {}) {
    const p = this.player, d = this.d, f = this.f;
    this.hurtLanded = false; // 이번 공격이 정말 맞았나 (회피 · 막기 · 무적이면 false) — 밀려남 같은 몸 효과는 맞았을 때만
    if (attacker?.def?.name && this.climb) this.climb.lastBy = attacker.champion || attacker.def.name; // 등반 결산: 누구에게 쓰러졌나
    if (this.coTgt?.kind) { const al = this.coTgt; if (al.shield1) { al.shield1 = false; this.emit({ t: 'text', x: al.x, y: al.y - 16, text: '막음', color: '#bfe8ff' }); } else { al.hp -= amount * (al.tauntT > 0 ? 0.7 : 1); this.emit({ t: 'allyHurt', x: al.x, y: al.y, v: amount }); } return; } // 소환체가 맞았다
    if (this.coTgt) { this.coHurtMate(this.coTgt, amount, type, attacker, opt); return; } // 파티 탑 (방장): 이 적이 노린 건 동료
    if (this.state !== 'play' || this.mode === 'plaza' || this.practice || p.down) return;
    if ((p.airT > 0 || p.leap) && !opt.direct) return;
    if (p.markT > 0 && !this.coTgt) amount *= 1.3; // 보스의 저주의 표식
    if (p.st.shock) amount *= 1.15; // 감전: 받는 피해 +15% (적과 같은 규칙)
    if (this.climb?.stars?.length) amount *= zoneHitMul(this, attacker); // 별의 서고: 별자리 위의 적은 +20%
    if (p.riding && amount > this.d.maxHp * 0.08 && !opt.direct) { this.dismount(); this.emit({ t: 'text', x: p.x, y: p.y - 24, text: '랩터에서 떨어졌다!', color: '#ffb0a0' }); }
    // 수호기사: 정면 공격은 25% 덜 받고 오러를 얻는다. 철벽 중에는 완전히 막는다
    let front = false;
    const fx = opt.fromX ?? attacker?.x, fy = opt.fromY ?? attacker?.y;
    if (this.b.cls === 'guardian' && fx != null && !opt.direct) {
      const vx = fx - p.x, vy = fy - p.y, l = Math.hypot(vx, vy) || 1;
      front = (vx * p.aimX + vy * p.aimY) / l > 0.25;
      if (front && p.buffs.ironWall && p.parryT <= 0) {
        this.addRes(8);
        if (attacker && !attacker.dead) this.damageEnemy(attacker, amount * 0.8, 'phys', { src: 'reflect', color: '#a8c8ff' }); // 철벽: 막은 피해를 되돌린다
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
        this.emit({ t: 'dodgeFx', x: p.x, y: p.y, fx: fx ?? attacker?.x ?? p.x - p.dir }); // 회피: 크게 보이게 (글씨 · 비켜서는 잔영)
        p.invuln = 0.15;
        if (attacker) this.knack('dodge');
        for (const tr of this.b.triggers.dodge) if (this.trig(tr)) this.doAction(tr.action, attacker, p);
        return;
      }
      if ((type === 'phys' && f.has('blockPhys')) || (type === 'mag' && f.has('blockMag'))) {
        if (this.rng.chance(0.15)) { this.emit({ t: 'text', x: p.x, y: p.y - 14, text: '막기', color: '#ffe080' }); p.invuln = 0.15; return; }
      }
    }
    const dr = type === 'phys' ? d.physDR : d.magDR, raw = amount;
    let dmg = amount * (1 - dr) * d.dmgTakenMul * this.mod('dmgTakenMul') * (1 + 0.05 * (p.ab || 0)); // 갑옷 부수기(결투)
    if (this.b.race === 'knight') dmg *= 0.9;
    if (this.f.has('resGuard') && p.res >= 50) dmg *= 0.9;
    if (front) { dmg *= 0.75; this.addRes(4); this.knack('block'); if (attacker && !attacker.dead) this.damageEnemy(attacker, raw * 0.25, 'phys', { src: 'reflect', color: '#a8c8ff' }); /* 수호기사: 정면으로 막으면 25%를 되갚는다 */ this.emit({ t: 'block', x: p.x + p.aimX * 8, y: p.y - 6 + p.aimY * 8, small: true }); }
    else if (this.b.weapon.guard && fx != null && !opt.direct) { // 방패를 든 무기: 앞에서 오는 피해를 줄인다
      const vx = fx - p.x, vy = fy - p.y, l = Math.hypot(vx, vy) || 1;
      if ((vx * p.aimX + vy * p.aimY) / l > 0.25) { dmg *= 1 - this.b.weapon.guard; this.emit({ t: 'block', x: p.x + p.aimX * 8, y: p.y - 6 + p.aimY * 8, small: true }); }
    }
    if (p.charging) dmg *= 0.75;
    if (p.buffs.stoneSkin && type === 'phys') dmg *= 1 - 60 / (60 + 100 + Math.max(0, this.s.pres));
    if (this.zones.some((z) => z.kind === 'sanctuary' && Math.hypot(p.x - z.x, p.y - z.y) < z.r)) dmg *= 0.6;
    dmg = Math.max(dmg, raw * 0.3); // 방어 · 감소를 아무리 쌓아도 받는 피해는 30% 밑으로 내려가지 않는다
    if (this.raceRes?.hurt) this.addRes((dmg / d.maxHp) * this.raceRes.hurt * (1 + d.hurtRes) * (p.buffs.ironWall || p.buffs.brace ? 2 : 1));
    if (p.buffs.steadfast) { p.stored += dmg; p.storedT = 6; }
    if (p.buffs.scales && attacker && !attacker.dead) this.applyStatus(attacker, 'burn', 2);
    if (p.buffs.iceArmor && attacker && !attacker.dead) this.applyStatus(attacker, 'chill', 3);
    let absorbed = 0;
    if (p.shield > 0) { absorbed = Math.min(p.shield, dmg); p.shield -= absorbed; dmg -= absorbed; }
    p.hp -= dmg; p.hitFlash = 0.15;
    if (this.tower) this.tower.hurt += dmg;
    if (p.buffs.undying && p.hp < 1) { p.hp = 1; this.emit({ t: 'text', x: p.x, y: p.y - 22, text: '불굴', color: '#ffd84a' }); }
    if (p.buffs.undying) this.addRes((dmg / d.maxHp) * 100);
    if (attacker && attacker.affix === 'vampiric' && !attacker.dead) attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * 0.25);
    if (this.b.race === 'orc') this.addRage((dmg / d.maxHp) * 160 * (f.has('rageFast') ? 1.5 : 1));
    p.lastFight = this.t;
    if (!opt.direct) p.invuln = 0.3;
    this.hurtLanded = true;
    if (dmg >= 0.5) this.emit({ t: 'dmg', x: p.x, y: p.y - 16, v: dmg, color: '#ff5a5a', who: 'p' });
    else if (absorbed > 0) this.emit({ t: 'text', x: p.x, y: p.y - 16, text: '보호막', color: '#a8d8ff' }); // 보호막이 다 막으면 0.0 대신
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
      for (const tr of this.b.triggers.hurt) if (this.trig(tr)) this.doAction(tr.action, attacker, attacker);
    }
    if (type === 'mag' && !opt.direct) for (const tr of this.b.triggers.hurtMag) if (this.trig(tr)) this.doAction(tr.action, attacker, p);
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
    const dur = (PLAYER_STATUS_DUR[kind] ?? 3) * (1 - this.d.statusRes); // 표에 없는 상태도 끝이 있다 (예전: 저주 · 감전은 NaN이라 영영 안 풀렸다)
    if (!(dur > 0.05)) return;
    const dps = kind === 'chill' || kind === 'shock' ? 0 : power * 0.18 * (1 - this.d.statusRes * 0.5);
    this.player.st[kind] = { t: dur, dps };
  }

  checkDeath() {
    const p = this.player;
    if (p.hp > 0 || this.state !== 'play') return;
    if (!p.skyDead && this.f.has('undying') && !p.undyingUsed) { // 하늘로 떨어진 것은 불사 · 불굴로도 버틸 수 없다
      p.undyingUsed = true; p.hp = this.d.maxHp * 0.3; p.invuln = 1;
      this.emit({ t: 'text', x: p.x, y: p.y - 18, text: '불사!', color: '#fff' });
      return;
    }
    if (!p.skyDead && this.f.has('lastStand') && p.lastStandCd <= 0) {
      p.lastStandCd = 90; p.hp = 1; p.invuln = 1;
      this.emit({ t: 'text', x: p.x, y: p.y - 18, text: '불굴!', color: '#ffd060' });
      return;
    }
    if (this.pit?.e && !this.pit.e.dead) {
      p.hp = Math.max(1, Math.round(this.d.maxHp * 0.2)); p.invuln = 2;
      const e = this.pit.e; e.dead = true; this.emit({ t: 'death', x: e.x, y: e.y, color: '#3a3a4a' });
      this.signals.push({ t: 'pitLost', bet: this.pit.bet }); this.pit = null;
      return;
    }
    if (this.voyage) {
      p.hp = Math.max(1, Math.round(this.d.maxHp * 0.15)); p.invuln = 2;
      const foes = this.enemies.filter((e) => !e.dead);
      for (const e of foes) { e.dead = true; this.emit({ t: 'death', x: e.x, y: e.y, color: '#3a3a4a' }); }
      if (this.voyage.fighting) this.voyage.extra += this.t - this.voyage.fightT0;
      this.voyage.fighting = null;
      this.signals.push({ t: 'voyageLost', kind: this.voyage.event });
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
    const tm = this.climb ? climbMul(this.climb.f, this.zone?.id, this.climb.oath) : this.tower ? towerMul(this.tower.f) : null; // 탑: 층마다 강해진다
    const soft = !tm && !def.elite && !def.raid && def.ai !== 'dummy' && def.ai !== 'target' ? 1.7 : 1; // 바깥 · 던전의 보통 몬스터: 한 대에 쓰러지지 않게 (두세 번은 때려야)
    // 등반: 난이도 표(data/curve.js)가 체력 · 공격력을 그대로 정한다 (예전엔 여기서 공격 ×3.8이 한 번 더 붙어 표보다 4배 아팠다)
    // 바깥 · 던전 · 예전 탑: 공격은 낮추고 체력은 높여 서로 덜 죽게 (예전 체력 ×0.8 · 공격 ×3.8)
    const dm = this.climb ? tm.hp : 1.4 * soft * (tm ? tm.hp : 1 + 0.4 * this.depth), am = this.climb ? tm.atk : 2.8 * (tm ? tm.atk : 1 + 0.25 * this.depth);
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
    } else if (this.mode === 'field' && !def.elite && !opt.noAffix && !opt.summoned && def.ai !== 'flee' && this.rng.chance(opt.affixP ?? 0.12)) {
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

  // 바깥 세계의 지역 레벨: 권장 레벨 안에서 시작 마을에서 멀수록 높다 · 레벨만큼 체력 · 공격력 · 보상이 커진다
  regionLevel(r, tx, ty) {
    const info = this.map.regionInfo?.[r]; if (!info?.lv || (this.zone?.id !== 'world' && this.zone?.id !== 'nokt' && !this.zone?.island)) return 0;
    const [lo, hi] = info.lv, st = this.map.start || { x: tx, y: ty }, f = Math.min(1, Math.hypot(tx - st.x, ty - st.y) / 260);
    return Math.round(lo + (hi - lo) * f);
  }
  applyLevel(e, lv) {
    if (!lv || e.lv) return;
    e.lv = lv; const k = lv - 1;
    e.hp = e.maxHp = Math.round(e.maxHp * (1 + 0.09 * k)); e.atk *= 1 + 0.05 * k; e.rewardMul = 1 + 0.06 * k;
  }
  spawnCamp(c) {
    c.members = [];
    for (let i = 0; i < c.n; i++) {
      let x, y, k = 0;
      do { x = c.x * TILE + 8 + this.rng.range(-28, 28); y = c.y * TILE + 8 + this.rng.range(-28, 28); k++; } while (this.blocked(x, y, 6) && k < 20);
      if (this.blocked(x, y, 6)) { x = c.x * TILE + 8; y = c.y * TILE + 8; }
      const e = this.makeEnemy(c.type, x, y);
      e.camp = c; e.region = c.region; e.home = { x: c.x * TILE + 8, y: c.y * TILE + 8 }; this.applyLevel(e, this.regionLevel(c.region, c.x, c.y));
      c.members.push(e);
      this.enemies.push(e);
    }
  }

  // 연습 모드: 비어 있는 야영지를 바로 다시 채운다

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
    if (e.decoyOf && !e.shardFake) this.emit({ t: 'text', x: e.x, y: e.y - 20, text: '가짜!', color: '#c8a8ff' });
    if (e.shardFake) shardFakeDie(this, e);
    if (e.passives?.includes('deathRattle')) { // 최후의 발악
      const x = e.x, y = e.y, atk = e.atk;
      this.emit({ t: 'telegraphCircle', x, y, r: 110, dur: 1.4 }); this.emit({ t: 'text', x, y: y - 40, text: '최후의 발악!', color: '#ff5a3a' });
      this.delayed.push({ t: 1.4, run: () => { this.enemyArea(e, x, y, 110, atk * 3, 'mag'); this.emit({ t: 'skillAoe', x, y, r: 110, elem: 'dark', fx: 'doom', ult: true }); } });
    }
    if (e.kit) for (const o of this.enemies) if ((o.decoyOf === e.id || o.ritualOf === e.id) && !o.dead) { o.dead = true; this.emit({ t: 'death', x: o.x, y: o.y, color: o.def.pal.a, defId: o.defId, dir: o.dir }); } // 수호자가 쓰러지면 분신 · 제물도 사라진다
    if (e.npcRef) { e.dead = true; this.emit({ t: 'death', x: e.x, y: e.y, color: '#c8a888', defId: e.defId, dir: e.dir }); npcDown(this, e); this.loot.gold += 5 + Math.floor(this.rng.next() * 20); return; } // 공격한 NPC는 기절했다 돌아온다
    if (e.official && !e.finish) {
      e.hp = 1; e.begging = true; e.st = { stun: 9999 }; e.windT = 0; e.state = 'idle';
      if (!e.beggedSent) { e.beggedSent = true; this.signals.push({ t: 'officialDown', id: e.official, eid: e.id }); this.emit({ t: 'text', x: e.x, y: e.y - 24, text: '살려 주시오!', color: '#ffe8a8' }); }
      return;
    }
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
    if (e.doom) {
      this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 90, elem: 'dark', fx: 'doom', ult: true });
      for (const o of this.enemiesNear(e.x, e.y, 90)) { this.applyStatus(o, 'curse', 6); this.damageEnemy(o, e.doom.atk * 1.8, 'mag', { src: 'aoe', elem: 'dark' }); }
    }
    const def = e.def, st = e.st, d = this.d;
    const bonus = (e.affix ? 2 : 1) * (e.champion ? 5 : 1) * (1 + 0.5 * this.depth);
    if (e.summoned) { this.emit({ t: 'death', x: e.x, y: e.y, color: def.pal.a, defId: e.defId, dir: e.dir }); return; }
    this.loot.xp += Math.round(def.xp * bonus * (e.rewardMul || 1));
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
    if (this.raid && RAID_BOSS.has(e.defId)) this.signals.push({ t: 'raidClear', id: this.raid.id }); // 레이드 보스를 쓰러뜨렸다
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
    const gold = Math.round(def.gold * d.goldMul * bonus * 0.55 * (e.rewardMul || 1)); // 돈은 쉽게 벌리지 않는다
    if (gold > 0) for (let i = 0, n = def.treasure || e.champion ? 6 : 1; i < n; i++) this.spawnDrop(e.x, e.y, 'gold', null, Math.ceil(gold / n));
    const echoTries = e.champion ? 3 : def.treasure ? 3 : e.affix ? 2 : 1;
    for (let i = 0; i < echoTries; i++) if (this.rng.chance(Math.min(1, def.echo.rate * (1 + 0.25 * this.depth)))) this.spawnDrop(e.x, e.y, 'echo', e.champion || def.treasure ? this.rng.pick(this.zone.pool.map((m) => MONSTERS[m].echo.id)) : def.echo.id);
    if (e.champion && this.rng.chance(0.3)) this.spawnDrop(e.x, e.y, 'echo', MONSTERS[this.zone.elite].echo.id);
    if (def.part && this.rng.chance(Math.min(1, def.echo.rate * 0.7 * (1 + 0.25 * this.depth) * (e.champion || def.elite ? 2 : 1)))) this.spawnDrop(e.x, e.y, 'echo', def.part); // 개체마다 다른 부산물
    if (this.tower && !e.summoned) { // 탑: 이름 붙은 무기가 아주 드물게 떨어진다 (드물게)
      const boss = e === this.tower.boss, rnd = () => this.rng.range(0, 1);
      const ch = boss ? (this.climb?.kind === 'lord' ? 0.125 : 0.06) : def.elite || e.champion ? 0.0125 : 0.0015; // 보통 0.15% · 정예 1.25% · 수호자 6% · 주인 12.5%
      if (this.rng.chance(ch)) this.spawnDrop(e.x, e.y, 'tweapon', rnd() < 0.45 ? rollTowerGear(this.tower.f, rnd) : rollTowerWeapon(this.tower.f, rnd)); // 45%는 방어구 · 장신구 · 왼손
    }
    if (def.condEcho && def.condEcho.when === 'burning' && st.burn && this.rng.chance(def.condEcho.rate)) this.spawnDrop(e.x, e.y, 'echo', def.condEcho.id);
    if (def.onDeath?.cloud) { const c = def.onDeath.cloud, x = e.x, y = e.y; this.emit({ t: 'telegraphCircle', x, y, r: c.r, dur: 0.6 }); this.delayed.push({ t: 0.6, run: () => this.addCloud(x, y, c.r, c.dps, c.dur, 'e') }); } // 독구름은 0.6초 예고 뒤에 피어난다 (쓰러뜨린 근접이 피할 틈)
    if (def.onDeath?.blast) { const b = def.onDeath.blast, x = e.x, y = e.y; this.emit({ t: 'telegraphCircle', x, y, r: b.r, dur: 0.7 }); this.emit({ t: 'text', x, y: y - 20, text: '증기가 샌다!', color: '#f0e8d8' }); this.delayed.push({ t: 0.7, run: () => { this.enemyArea(e, x, y, b.r, e.atk * b.mul, 'mag', null); this.emit({ t: 'skillAoe', x, y, r: b.r, fx: 'burst' }); } }); } // 증기 골렘: 쓰러지면 0.7초 뒤 터진다
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

    for (const tr of this.b.triggers.kill) if (this.trig(tr)) this.doAction(tr.action, null, e);
    if (st.poison && this.f.has('poisonSpread')) for (const o of this.enemiesNear(e.x, e.y, 60)) this.applyStatus(o, 'poison', Math.ceil(st.poison.n / 2));
    if (st.burn && this.f.has('burnSpread')) for (const o of this.enemiesNear(e.x, e.y, 60)) this.applyStatus(o, 'burn', 2);
    if (st.poison && this.f.has('poisonBurst')) this.addCloud(e.x, e.y, 34 * (1 + d.cloudSize), 4 + (this.s.toxicity || 0) * 0.8, 3, 'p');
    if (this.b.race === 'undead') this.heal(d.maxHp * 0.024, 'drain');
    if (this.raceRes?.kill) this.addRes(this.raceRes.kill);
    this.lastKills = (this.lastKills || 0) + 1;
    if (this.climb?.mod === 'bloodmoon' && e.climb) this.heal(d.maxHp * 0.008, 'drain'); // 피의 달
  }

  addRage() { /* 오크 분노는 종족 자원(res)으로 통합 */ }

  // ───────────── 몬스터 기술 ─────────────
  // 둘레의 사람 · 동료 · 소환체 모두에게 (장판 · 착지 충격)
  // ───── 층 수호자 기술 ─────
  giveBossKit(e, f) {
    const kit = bossKit(f); e.kit = kit;
    e.phaseMoves = kit.awake ? kit.phases.map((l, i) => [...l, ...kit.phases[Math.min(2, i + 1)].slice(0, 1)]) : kit.phases;
    e.skillNames = kit.names;
    e.champion = `${f}층 수호자 · ${kit.awake && !kit.final ? '각성한 ' : ''}${kit.title}`;
    if (kit.final) { e.hp = e.maxHp = e.maxHp * 1.6; e.scale = 1.6; }
    this.emit({ t: 'banner', text: e.champion, color: kit.final ? '#ffd84a' : '#ff8a5a' });
  }
  giveClimbSig(e, f) { // 등반 보스: 원래 기술 + 대표 기술 (55층부터 각성: 더 자주 · 다음 단계 기술 하나 더)
    const sig = CLIMB_SIGS[e.defId], base = e.def.phaseMoves; if (!sig || !base) return;
    const awake = f > 50 && !sig.fresh; // 51층 위로 같은 보스가 다시 나오면 각성 (새 구역의 보스는 처음부터 제 기술을 다 쓴다)
    e.kit = { title: e.def.name, hint: sig.hint, wallStun: sig.wallStun, vent: sig.vent, ventText: sig.ventText, awake, fast: f > 50 };
    e.phaseMoves = base.map((l, i) => [...l, ...sig.add[i], ...(awake ? sig.add[Math.min(2, i + 1)].slice(0, 1) : [])]);
    e.skillNames = { ...(e.def.skillNames || {}), ...(sig.names || {}) };
    if (awake) e.champion = `각성한 ${e.def.name}`;
    e.passives = [...(sig.passives || [])]; e.pv = {}; e.bornT = this.t;
    e.bphase = 0; e.forms = [null, sig.phase2, sig.phase3]; e.looks = sig.looks || [];
    if (e.passives.length) this.emit({ t: 'text', x: e.x, y: e.y - 46, text: '패시브 · ' + e.passives.map((k) => BOSS_PASSIVES[k].name).join(' · '), color: '#ffb07a' });
  }
  // 보스 변신: 더 세지고 · 새 패시브 · 새 기술 · 모습이 바뀐다. 변신하는 동안(0.9초) 잠깐 무적
  bossTransform(e, n) {
    const v = e.forms?.[n]; e.bphase = n; e.raidPhase = n;
    if (!v) return;
    e.atk *= v.atk || 1; e.speedMul *= v.speed || 1; e.atkRate *= v.speed || 1;
    if (v.passives) for (const k of v.passives) if (!e.passives.includes(k)) e.passives.push(k);
    if (v.add && e.phaseMoves) e.phaseMoves = e.phaseMoves.map((l, i) => (i >= n ? [...l, ...v.add] : l));
    e.tintX = e.looks[n - 1] || e.tintX; e.scale = (e.scale || 1) * 1.1; e.morphT = 0.9;
    if (this.climb) arenaShift(this, n); // 결투장이 바뀐다 (용암 균열이 넓어지고 · 물이 차오른다)
    if (v.dark && this.zone) this.zone.dark = Math.min(0.85, (this.zone.dark || 0.3) + v.dark); // 별을 읽는 자: 하늘의 별이 꺼진다
    e.invulnT = Math.max(e.invulnT || 0, 0.9); e.mv = null; e.windT = 0.9; e.windMax = 0.9; e.mvCd = Math.max(e.mvCd || 0, 1.2);
    const added = v.passives ? ' · ' + v.passives.map((k) => BOSS_PASSIVES[k].name).join(' · ') : '';
    this.emit({ t: 'banner', text: `${n + 1}단계 · ${v.text}`, sub: `체력 ${n === 1 ? 66 : 33}% · 공격 +${Math.round(((v.atk || 1) - 1) * 100)}%${added}`, color: n === 2 ? '#ff3a2a' : '#ff8a5a' });
    this.emit({ t: 'shake', v: n === 2 ? 10 : 7 }); this.emit({ t: 'hitstop', v: 0.12 });
    this.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 70 + n * 20, elem: n === 2 ? 'dark' : 'fire', fx: 'burst', ult: true });
    // 변신 충격파: 가까이 붙어 있으면 밀려난다
    const p = this.player, dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
    if (l < e.r + 50) { p.dashT = 0.18; p.dvx = (dx / l) * 260; p.dvy = (dy / l) * 260; }
  }
  // 보스 패시브
  bossPassiveTick(e) {
    const p = this.player, pv = e.pv, near = Math.hypot(p.x - e.x, p.y - e.y) < e.r + 60;
    const tick = (k, every) => { pv[k] = (pv[k] ?? every) - DT; if (pv[k] <= 0) { pv[k] = every; return true; } return false; };
    for (const k of e.passives) {
      if (k === 'frenzy' && tick(k, 15) && (pv.fr || 0) < 6) { pv.fr = (pv.fr || 0) + 1; e.atkRate *= 1.1; e.speedMul *= 1.03; this.emit({ t: 'text', x: e.x, y: e.y - 32, text: `광분 ${pv.fr}`, color: '#ff5a3a' }); }
      if (k === 'regrow' && this.t - (e.lastHitT ?? -9) > 3 && e.hp < e.maxHp) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.01 * DT); if (tick('regrowFx', 1)) { this.emit({ t: 'text', x: e.x, y: e.y - 28, text: '재생 +1%', color: '#7be38a' }); this.emit({ t: 'bossHeal', id: e.id, x: e.x, y: e.y, from: e.hp / e.maxHp - 0.01, to: e.hp / e.maxHp }); } }
      if (k === 'summonTimer' && tick(k, 18)) {
        for (let i = 0; i < 2; i++) { const a = this.rng.range(0, Math.PI * 2); let x = e.x + Math.cos(a) * 44, y = e.y + Math.sin(a) * 44; if (this.blocked(x, y, 6)) { x = e.x; y = e.y; } const m = this.makeEnemy(e.def.adds || this.zone.pool?.[0] || 'goblin', x, y, { summoned: true }); m.summoner = e.id; m.state = 'chase'; m.home = { ...e.home }; m.noLoot = true; this.enemies.push(m); this.emit({ t: 'summon', x, y }); }
        this.emit({ t: 'text', x: e.x, y: e.y - 36, text: '무리를 부른다', color: '#ffb07a' });
      }
      if (k === 'curseMark' && tick(k, 12)) { p.markT = 4; this.emit({ t: 'text', x: p.x, y: p.y - 30, text: '저주의 표식 · 받는 피해 +30%', color: '#c45cff' }); }
      if ((k === 'poisonAura' || k === 'frostAura' || k === 'burnAura') && tick(k, 5) && !e.mv) { // 기운의 맥동: 5초마다 0.8초 예고 원 → 터질 때 안에 있으면 피해 + 상태이상 (가까이 있기만 해도 깎이던 것 대신)
        const st = k === 'poisonAura' ? 'poison' : k === 'frostAura' ? 'chill' : 'burn', x = e.x, y = e.y, r = e.r + 34, atk = e.atk; // 한두 걸음이면 빠져나갈 크기
        this.emit({ t: 'telegraphCircle', x, y, r, dur: 1.1 });
        this.delayed.push({ t: 1.1, run: () => { if (e.dead) return; this.enemyArea(e, x, y, r, atk * 0.5, 'mag'); if (Math.hypot(p.x - x, p.y - y) < r + (p.r || 5)) this.applyPlayerStatus(st, atk * 0.25); /* 지속 피해는 큰 한 방이 아니라 예전 기운 세기로 */ this.emit({ t: 'skillAoe', x, y, r, elem: st === 'chill' ? 'ice' : st === 'burn' ? 'fire' : 'poison', fx: 'burst' }); } });
      }
      if (k === 'thorns' && tick(k, 12)) { e.thornsT = this.t + 3; this.emit({ t: 'text', x: e.x, y: e.y - 40, text: '가시 세움! 3초 · 때리면 15% 되돌아온다', color: '#e8c8a0' }); } // 보이는 3초 동안만 · 거리 상관없이
      if (k === 'hunt' && tick(k, 10) && !e.mv) { // 사냥 본능: 가장 멀리 있는 사람에게 뛰어든다
        const far = this.coTargets().filter((q) => Math.hypot(q.x - e.x, q.y - e.y) > 130).sort((a, b) => Math.hypot(b.x - e.x, b.y - e.y) - Math.hypot(a.x - e.x, a.y - e.y))[0];
        const at = far && this.floorNear(far.x, far.y, e.r);
        if (at) { e.mv = { k: 'leap', t: 0.9, max: 0.9, x0: e.x, y0: e.y, x: at.x, y: at.y }; this.emit({ t: 'telegraphCircle', x: at.x, y: at.y, r: 38, dur: 0.9 }); this.emit({ t: 'text', x: e.x, y: e.y - 40, text: '사냥 본능!', color: '#ffb07a' }); }
      }
      if (k === 'pull' && tick(k, 12)) { // 끌어당김: 7칸 밖에 있으면 사슬 예고선(0.8초) → 끌려온다 (구르면 끊긴다)
        const dd = Math.hypot(p.x - e.x, p.y - e.y);
        if (dd > 7 * TILE && !p.down) {
          this.emit({ t: 'lineTele', x1: e.x, y1: e.y, x2: p.x, y2: p.y, dur: 0.8, color: '#c8a0ff', w: 8 }); this.emit({ t: 'text', x: p.x, y: p.y - 26, text: '끌어당김 — 구르면 끊긴다', color: '#c8a0ff' });
          this.delayed.push({ t: 0.8, run: () => { if (e.dead || p.invuln > 0 || p.dashT > 0) return; const d2 = Math.hypot(p.x - e.x, p.y - e.y); if (d2 > e.r + 50) { this.knockPlayer(e.x, e.y, d2 - e.r - 40, { ang: Math.atan2(e.y - p.y, e.x - p.x) }); this.emit({ t: 'beamFx', x1: e.x, y1: e.y - 6, x2: p.x, y2: p.y, elem: 'dark' }); } } });
        }
      }
      if (k === 'ward' && tick(k, 15)) { e.wardT = this.t + 4; this.emit({ t: 'text', x: e.x, y: e.y - 40, text: '화살 막이 · 4초 동안 투사체 피해 -40%', color: '#9fd8ff' }); }
      if (k === 'shieldPulse' && tick(k, 20)) { e.bshield = e.maxHp * 0.12; this.emit({ t: 'text', x: e.x, y: e.y - 34, text: `보호막 ${Math.round(e.bshield)}`, color: '#bfe8ff' }); }
    }
    // 체력 66% · 33% 아래로 내려가면 다음 단계로 변신한다 (한 번에 많이 깎여도 단계를 건너뛰지 않고 차례로)
    if (e.forms) { const ph = e.hp > e.maxHp * 0.66 ? 0 : e.hp > e.maxHp * 0.33 ? 1 : 2; if ((e.bphase || 0) < ph) this.bossTransform(e, e.bphase + 1); }
  }
  // 몬스터의 몸 기술에 맞은 나: 밀려난다 (벽에 부딪히면 잠깐 기절) · 묶임 · 느려짐 · 기절
  knockPlayer(fx, fy, dist, opt = {}) {
    const p = this.player; if (p.down || p.leap || p.airT > 0) return;
    const a = opt.ang ?? Math.atan2(p.y - fy, p.x - fx), res = 1 - (this.d.statusRes || 0) * 0.5, T = 0.24;
    p.kb = { vx: Math.cos(a) * dist * res / T, vy: Math.sin(a) * dist * res / T, t: T, wall: opt.wallStun || 0 };
  }
  ccPlayer(m) {
    const p = this.player, res = 1 - (this.d.statusRes || 0) * 0.5, say = (text, color) => this.emit({ t: 'text', x: p.x, y: p.y - 24, text, color });
    if (m.root) { p.rootT = Math.max(p.rootT || 0, m.root * res); p.webT = m.say ? p.rootT : 0; say(m.say || '묶였다', '#e8e8d8'); }
    if (m.slow) { p.slowT = Math.max(p.slowT || 0, m.slow * res); say('느려짐', '#9fe3ff'); }
    if (m.stun) { p.ccT = Math.max(p.ccT || 0, m.stun * res); say('기절', '#ffd060'); }
  }
  tickKnock() { // 밀려나는 중: 벽에 막히면 그 자리에서 멈추고, 세게 부딪혔으면 기절
    const p = this.player, k = p.kb; if (!k) return;
    const x0 = p.x, y0 = p.y, dx = k.vx * DT, dy = k.vy * DT;
    this.move(p, dx, dy);
    const moved = Math.hypot(p.x - x0, p.y - y0), want = Math.hypot(dx, dy);
    if (want > 0.5 && moved < want * 0.3) {
      if (k.wall > 0) { p.ccT = Math.max(p.ccT || 0, k.wall); this.emit({ t: 'collide', x: p.x, y: p.y, wall: true }); this.emit({ t: 'text', x: p.x, y: p.y - 26, text: '벽에 부딪혔다!', color: '#ffd060' }); this.hurtPlayer(this.d.maxHp * 0.04, 'phys', null, { direct: true }); }
      p.kb = null; return;
    }
    if ((k.t -= DT) <= 0) p.kb = null;
  }
  // 사령술사: 영혼을 되살린다 — 공격력은 그대로, 체력은 절반, 첫 한 대는 보호막. 쓰러질 때까지 남고 다른 곳에 가도 따라온다
  // 사령술사의 부하를 세운다 (기록 m은 저장에 남아 다른 곳에서도 다시 선다) · 첫 한 대는 보호막
  spawnMinion(m, x, y, i = 0) {
    this.allies.push({ id: this.nextId++, kind: m.kind, perm: true, mref: m, defId: m.defId, hp: m.maxHp, maxHp: m.maxHp, x, y, t: 1e9, max: 1e9, shield1: true, atk: m.atk, cd: 0.3 + i * 0.15, phase: i, dir: 1, r: m.r || 6, scale: m.scale || 1 });
  }
  raiseSoul(sv, x, y, i = 0, bonus = 1) {
    sv.up = true;
    const hp = sv.maxHp * 0.5;
    this.allies.push({ id: this.nextId++, kind: 'soul', perm: true, sv, defId: sv.defId, hp, maxHp: hp, x, y, t: 1e9, max: 1e9, shield1: true,
      atk: sv.atk * bonus, cd: 0.3 + i * 0.15, phase: i, dir: 1, r: sv.r, scale: sv.scale });
  }

  // 다른 사람이 쏜 투사체 (보이기만 · 맞히지 않는다)
  addGhostProjs(l) {
    for (const [x, y, vx, vy, life, color, kind, big] of l || []) this.projs.push({ owner: 'p', ghost: true, x, y, vx, vy, life, maxLife: life, color: color || '#ffffff', kind: kind || undefined, big: !!big, hit: new Set(), pierce: 0, dmg: 0 });
  }
  // ───────────── 파티 탑 ─────────────
  // 방장: 적이 노릴 수 있는 사람 (나 + 같은 층의 동료, 쓰러진 사람은 빼고)
  coTargets() { // 적이 노릴 수 있는 것: 나 · 같은 층 동료 · 체력이 있는 소환체 (사령술사의 영혼 · 해골 · 리치 등) — 한 틱에 한 번만 모은다
    if (this._tgT === this.t && this._tgL) return this._tgL;
    const P = this.player, out = P.down ? [] : [P];
    this._tgT = this.t; this._tgL = out;
    if (this.coop) for (const m of this.coop.mates.values()) if (!m.dead) out.push(m);
    for (const a of this.allies) if (a.maxHp > 0 && a.hp > 0 && a.t > 0) { a.r ||= 6; out.push(a); }
    return out;
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
      if (dr.t > 0.45 && (dist < 80 || dr.magnet) && !full) { // magnet: 탑의 층을 깨면 그 층에 떨어진 것이 모두 나에게 날아온다
        const pull = 260 + Math.max(0, 80 - dist) * 6;
        dr.vx += (dx / dist) * pull * DT * 4; dr.vy += (dy / dist) * pull * DT * 4;
      }
      dr.vx *= 0.9; dr.vy *= 0.9;
      dr.x += dr.vx * DT; dr.y += dr.vy * DT;
      if (dr.t > 0.45 && dist < 9 && !full) {
        dr.taken = true;
        if (dr.kind === 'gold') { this.loot.gold += dr.amount; this.emit({ t: 'pickup', kind: 'gold', x: p.x, y: p.y }); }
        else if (dr.kind === 'good') {
          if (this.life && bagAdd(this.life, dr.id, dr.amount)) this.emit({ t: 'goodGet', id: dr.id, n: dr.amount, x: p.x, y: p.y });
        } else if (dr.kind === 'tweapon') {
          const it = ITEMS[dr.id], R = W_RARITY[it.rarity]; this.signals.push({ t: 'towerWeapon', id: dr.id });
          this.emit({ t: 'text', x: p.x, y: p.y - 28, text: `${R.name} ${it.towerGear ? '장비' : '무기'} · ${it.name}!`, color: R.color }); this.emit({ t: 'shake', v: 4 }); this.emit({ t: 'ring', x: p.x, y: p.y, r: 46, color: R.color });
        } else if (dr.kind === 'weapon') {
          const L = LOOT_RARITY[dr.id.loot.r]; this.signals.push({ t: 'lootWeapon', rec: dr.id });
          this.emit({ t: 'text', x: p.x, y: p.y - 28, text: `${L.name} 무기!`, color: L.color }); if (dr.id.loot.r >= 3) { this.emit({ t: 'shake', v: 3 }); this.emit({ t: 'ring', x: p.x, y: p.y, r: 40, color: L.color }); }
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
    if (this.pHit && this.npcAttack) pokeNpcs(this, x, y, r, this.curTok);
    return this.enemies.filter((o) => !o.dead && !o.hidden && !o.under && Math.hypot(o.x - x, o.y - y) <= r + o.r); // 땅속(땅굴 기습 중)은 맞지 않는다
  }

  // ───────────── 투사체 / 구름 ─────────────
  updateProjs() {
    const p = this.player;
    for (const pr of this.projs) {
      if (pr.owner === 'p' && !pr.fast && !pr.ghost && !pr.boomerang) { pr.fast = 1; pr.vx *= 1.6; pr.vy *= 1.6; pr.life /= 1.6; if (pr.maxLife) pr.maxLife /= 1.6; } // 내 탄(마법 · 저주 · 독 · 화살 · 투척)은 빠르게 (사거리는 그대로)
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
      if (pr.owner === 'e' && pr.curve) { const c = Math.cos(pr.curve * DT), sn = Math.sin(pr.curve * DT), vx = pr.vx; pr.vx = vx * c - pr.vy * sn; pr.vy = vx * sn + pr.vy * c; pr.curve *= 0.985; } // 빙글 휘며 날아간다
      if (pr.owner === 'e' && pr.splitT > 0 && (pr.splitT -= DT) <= 0) { // 날아가다 세 갈래로
        const a0 = Math.atan2(pr.vy, pr.vx), sp = Math.hypot(pr.vx, pr.vy);
        for (const da of [-0.5, 0, 0.5]) this.projs.push({ ...pr, vx: Math.cos(a0 + da) * sp, vy: Math.sin(a0 + da) * sp, splitT: 0, life: 1.2, dmg: pr.dmg * 0.6, big: false });
        pr.life = 0; this.emit({ t: 'spark', x: pr.x, y: pr.y, color: pr.color });
      }
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
      else if (this.wallAt(pr.x, pr.y) && !pr.returning && mirrorBounce(this, pr)) { /* 거울 미궁: 벽에서 한 번 튕긴다 */ }
      else if (this.wallAt(pr.x, pr.y) && !pr.returning) {
        if (pr.owner === 'p' && this.tileAt(pr.x, pr.y) === T_CRACK) this.hitCrack(pr.x, pr.y, pr.dmg);
        this.emit({ t: 'spark', x: pr.x - pr.vx * DT, y: pr.y - pr.vy * DT, color: pr.color });
        pr.life = 0;
      }
      if (pr.life <= 0) continue;
      if (pr.owner === 'p' && !pr.ghost) {
        if (this.npcAttack) for (const o of this.objects) if ((isPerson(o) && o.home && !o.hostile && !o.away && !o.knockedUntil && Math.hypot(o.x - pr.x, o.y - pr.y) < 9) || (o.kind === 'happening' && !o.gone && !o.engaged && Math.hypot(o.x - pr.x, o.y - pr.y) < 18)) { if (pr.tok == null || this.tokUsed?.has(pr.tok)) continue; pokeNpcs(this, o.x, o.y, 1, pr.tok); if (o.hostile || o.engaged) { if (!pr.pierce) pr.life = 0; break; } }
        for (const e of this.enemies) {
          if (e.dead || e.hidden || pr.hit.has(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - 4 - pr.y) > e.r + 5) continue; // 몸 가운데 (발밑보다 조금 위) 기준
          pr.hit.add(e.id);
          if (pr.skillHit) pr.skillHit(e, pr);
          else if (pr.noTrigger) this.damageEnemy(e, pr.dmg, pr.type, { src: 'aoe' });
          else {
            const dist = pr.ox != null ? Math.hypot(e.x - pr.ox, e.y - pr.oy) : 100;
            const range = pr.boomerang ? 1 : this.b.wcat === 'bow' ? 0.8 + 0.6 * Math.max(0, Math.min(1, (dist - 40) / 180)) /* 활: 멀리서 맞힐수록 세다 (40px 0.8배 → 220px 1.4배) */ : dist < 40 ? 0.7 : dist > 70 ? 1.1 : 1;
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
          if (pr.cc && hit === p && this.hurtLanded) this.ccPlayer(pr.cc); // 거미줄 같은 몸 효과
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

export function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export { ECHOES, T_FLOOR, T_WALL, T_LIQUID, T_CRACK, T_BUILD, T_GATE, T_DEEP };

// 나눠 둔 메서드를 World 에 붙인다
Object.assign(World.prototype, EnemyAiMethods, SkillMethods, AllyMethods);

// 빌드 계산: 로드아웃(종족·레벨·배분·각인·장비) → 최종 스탯, 파생 수치, 플래그, 트리거.
// DOM을 쓰지 않는 순수 함수라 서버에서도 그대로 돌릴 수 있다.
import { BASE_STATS, SPECIAL_INFO, AWAKENINGS, EXTREME, eff } from '../data/stats.js';
import { RACES, RACE_MIGRATE } from '../data/races.js';
import { ENGRAVINGS, TAGS, CANCELS } from '../data/engravings.js';
import { ITEMS } from '../data/items.js';
import { evalCond, condText } from './conditions.js';
import { SKILLS, ENGRAVING_SKILLS } from '../data/skills.js';

export const SLOTS = ['head', 'arm', 'heart', 'leg', 'back'];
export const GEAR_SLOTS = ['weapon', 'armor', 'acc1', 'acc2'];

// loadout: { race, level, alloc:{str..}, engravings:{slot:id}, gear:{slot:id} }
export function computeBuild(lo) {
  if (RACE_MIGRATE[lo.race]) lo = { ...lo, race: RACE_MIGRATE[lo.race] };
  const race = RACES[lo.race];
  const stats = {};
  for (const k of BASE_STATS) stats[k] = race.base[k] + (lo.alloc?.[k] || 0) + (race.growth[k] || 0) * (lo.level - 1);
  for (const k of Object.keys(SPECIAL_INFO)) stats[k] = 0;

  const notes = []; // UI에 보여줄 발동 내역
  const sources = [];
  for (const s of SLOTS) {
    const id = lo.engravings?.[s];
    if (id && ENGRAVINGS[id]) sources.push({ kind: 'engraving', id, def: ENGRAVINGS[id] });
  }
  for (const s of GEAR_SLOTS) {
    const id = lo.gear?.[s];
    if (id && ITEMS[id]) sources.push({ kind: 'item', id, def: ITEMS[id] });
  }

  // 1) 고정 스탯
  for (const src of sources) {
    for (const [k, v] of Object.entries(src.def.stats || {})) stats[k] = (stats[k] || 0) + v;
  }

  // 2) 태그
  const tags = {};
  for (const src of sources) for (const t of src.def.tags || []) tags[t] = (tags[t] || 0) + 1;

  // 장비 착용 조건 (조건 미달 장비는 효과 없음, 스탯만 반영 안 되게 되돌림)
  const disabled = new Set();
  for (const src of sources) {
    if (src.kind !== 'item' || !src.def.req) continue;
    for (const [k, v] of Object.entries(src.def.req)) {
      if (stats[k] < v) {
        disabled.add(src.id);
        notes.push({ kind: 'warn', text: `${src.def.name}: ${k === 'str' ? '근력' : '마력'} ${v} 필요 → 효과 없음` });
      }
    }
  }
  for (const src of sources) {
    if (!disabled.has(src.id)) continue;
    for (const [k, v] of Object.entries(src.def.stats || {})) stats[k] -= v;
    for (const t of src.def.tags || []) tags[t]--;
  }
  const active = sources.filter((s) => !disabled.has(s.id));

  // 3) 극한 판정 (기본 스탯 기준)
  const sorted = BASE_STATS.map((k) => [k, stats[k]]).sort((a, b) => b[1] - a[1]);
  const extreme = sorted[0][1] >= sorted[1][1] * EXTREME.ratio && sorted[0][1] > 0;
  if (extreme) {
    const [k] = sorted[0];
    stats[k] = Math.round(stats[k] * (1 + EXTREME.bonus));
    notes.push({ kind: 'extreme', text: `극한: 주력 스탯 +${Math.round(EXTREME.bonus * 100)}%` });
  }

  // 4) 조건부 효과 수집 (조건은 1차 스탯 기준으로 판정 → 순환 방지)
  const ctx = { stats: { ...stats }, tags, race: lo.race, extreme };
  const effects = [];
  for (const src of active) {
    for (const e of src.def.effects || []) {
      const ok = evalCond(e.when, ctx);
      if (e.when) notes.push({ kind: ok ? 'on' : 'off', text: `${src.def.name}: ${condText(e.when)} → ${e.text}` });
      if (ok) effects.push(e);
    }
  }

  // 5) 태그 시너지 (+ 상쇄)
  const cancelled = new Set();
  for (const c of CANCELS) {
    if ((tags[c.a] || 0) >= c.n && (tags[c.b] || 0) >= c.n) {
      cancelled.add(c.a); cancelled.add(c.b);
      notes.push({ kind: 'warn', text: `${c.name}: [${TAGS[c.a].name}]·[${TAGS[c.b].name}] 시너지 꺼짐` });
    }
  }
  const synergies = [];
  for (const [t, n] of Object.entries(tags)) {
    const def = TAGS[t];
    if (!def || n <= 0) continue;
    for (const tier of def.tiers) {
      const on = n >= tier.n && !cancelled.has(t);
      synergies.push({ tag: t, n, need: tier.n, text: tier.text, on });
      if (on) effects.push(...tier.effects);
    }
  }


  // 6) 2차 스탯 효과 반영
  for (const e of effects) {
    if (e.type === 'stat') stats[e.stat] = (stats[e.stat] || 0) + e.v;
    if (e.type === 'statPct') stats[e.stat] = Math.round(stats[e.stat] * (1 + e.v));
  }

  // 7) 각성 (최종 스탯 기준)
  const awakenings = [];
  for (const [k, list] of Object.entries(AWAKENINGS)) {
    for (const a of list) {
      const on = stats[k] >= a.at;
      awakenings.push({ stat: k, ...a, on });
      if (on) effects.push(...a.effects);
    }
  }

  // 8) 파생 수치
  const E = {}; for (const k of BASE_STATS) E[k] = eff(Math.max(0, stats[k]));
  const d = {
    maxHp: 70 + E.vit * 7,
    physAtk: 4 + E.str * 1.3,
    dexAtk: 4 + E.agi * 1.15 + E.str * 0.25,
    magAtk: 4 + E.mag * 1.3,
    atkSpeed: 1 + E.agi * 0.012,
    moveSpeed: 80 + E.agi * 0.7,
    dodge: E.agi / (E.agi + 220),
    crit: 0.05 + E.sen / (E.sen + 140),
    critDmg: 1.5 + E.sen * 0.006,
    statusRes: E.spi / (E.spi + 90),
    cdr: E.spi / (E.spi + 160),
    loadCap: 10 + Math.floor(stats.spi * 0.5),
    physDR: Math.max(0, stats.pres) / (Math.max(0, stats.pres) + 100),
    magDR: Math.max(0, stats.mres) / (Math.max(0, stats.mres) + 100),
    physPen: 0, magPen: 0, knockback: 30, regen: 0,
    dmgMul: 1, dmgTakenMul: 1, burnMul: 1, bleedMul: 1, chillMul: 1, reactionMul: 1, statusDmgMul: 1, reflectMul: 1,
    poisonCap: 10, freezeReduce: 0, cloudSize: 0, dashCd: 1.2, goldMul: 1, projMul: lo.race === 'elf' ? 1.3 : 1,
    maxMana: 50 + E.spi * 2, manaRegen: 3 + E.spi * 0.08, skillCdMul: 1, auraTime: 5, aimSlow: lo.race === 'elf' ? 0.82 : 0.65,
    freezeTime: 1.6,
  };
  // 종족 고유 수치
  if (lo.race === 'wizard') { d.maxMana *= 1.5; d.manaRegen *= 1.3; d.reactionMul *= 1.5; d.skillCdMul *= 0.75; }
  if (lo.race === 'knight') d.moveSpeed *= 0.92;
  if (lo.race === 'undead') d.moveSpeed *= 0.95;
  if (lo.race === 'golem') d.moveSpeed *= 0.85;
  const flags = new Set();
  const triggers = { hit: [], kill: [], hurt: [], hurtMag: [], dodge: [], crit: [], dash: [] };
  for (const e of effects) {
    if (e.type === 'add') d[e.key] = (d[e.key] || 0) + e.v;
    else if (e.type === 'mul') d[e.key] = (d[e.key] ?? 1) * e.v;
    else if (e.type === 'flag') flags.add(e.flag);
    else if (e.type === 'on') triggers[e.event].push(e);
  }
  d.maxHp = Math.round(d.maxHp);
  d.maxMana = Math.round(d.maxMana);
  d.dodge = Math.min(0.6, d.dodge);
  d.crit = Math.min(0.9, d.crit);
  d.statusRes = Math.min(0.85, d.statusRes);

  // 9) 각인 부하
  let load = 0;
  for (const src of active) if (src.kind === 'engraving') load += src.def.load;
  const overload = load > d.loadCap;
  if (overload) {
    d.atkSpeed *= 0.7; d.dmgTakenMul *= 1.3; d.moveSpeed *= 0.85;
    notes.push({ kind: 'warn', text: `과부하! 부하 ${load}/${d.loadCap}: 공격 속도 -30%, 받는 피해 +30%` });
  }

  const wid = lo.gear?.weapon && ITEMS[lo.gear.weapon] ? lo.gear.weapon : 'rustySword';
  const weaponId = disabled.has(wid) ? 'rustySword' : wid;
  const wpn = ITEMS[weaponId].weapon;
  if (wpn.crit) d.crit = Math.min(0.9, d.crit + wpn.crit);
  if (wpn.critDmg) d.critDmg += wpn.critDmg;
  if (flags.has('noAimSlow')) d.aimSlow = 1;
  if (lo.race === 'golem') d.dodge = 0;

  // 액티브 스킬: 종족 스킬(레벨 해금) + 장착한 각인의 스킬 + 무기 기술 → 최대 3개 장착
  const available = Object.entries(SKILLS).filter(([, sk]) => sk.race === lo.race && (sk.unlock || 1) <= lo.level).map(([id]) => id);
  for (const src of active) if (src.kind === 'engraving' && ENGRAVING_SKILLS[src.id] && !available.includes(ENGRAVING_SKILLS[src.id])) available.push(ENGRAVING_SKILLS[src.id]);
  available.push('weapon');
  let skills = (lo.skills || []).filter((id) => available.includes(id)).slice(0, 3);
  if (!lo.skills) {
    // 기본 장착: 준비/강화 → 공격 → 마무리 순으로 콤보가 되게
    const race = available.filter((id) => SKILLS[id]);
    const pick = (roles) => race.find((id) => roles.includes(SKILLS[id].role) && !skills.includes(id));
    for (const roles of [['준비', '강화', '전환', '방어'], ['공격', '이동', '연타', '제어', '소환'], ['마무리']]) { const id = pick(roles); if (id) skills.push(id); }
    for (const id of race) if (skills.length < 3 && !skills.includes(id)) skills.push(id);
  }
  // 무기 유형 보정: 근접은 붙어 싸우는 만큼 단단하고, 원거리는 쏘는 동안 느려진다
  if (wpn.kind === 'melee') { d.dmgTakenMul *= 0.8; flags.add('stagger'); }
  else flags.add('aimSlow');
  return { race: lo.race, stats, derived: d, flags, triggers, tags, synergies, awakenings, notes, load, overload, extreme, weapon: ITEMS[weaponId].weapon, weaponId, skills, available };
}

// 빌드 코드 (온라인 공유/고스트 대전용)
export function encodeLoadout(lo) {
  const json = JSON.stringify({ r: lo.race, l: lo.level, a: lo.alloc, e: lo.engravings, g: lo.gear, k: lo.skills });
  return btoa(unescape(encodeURIComponent(json)));
}
export function decodeLoadout(code) {
  const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  return { race: o.r, level: o.l, alloc: o.a || {}, engravings: o.e || {}, gear: o.g || {}, skills: o.k };
}

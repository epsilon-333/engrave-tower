// 빌드 계산: 로드아웃(종족·레벨·배분·각인·장비) → 최종 스탯, 파생 수치, 플래그, 트리거.
// DOM을 쓰지 않는 순수 함수라 서버에서도 그대로 돌릴 수 있다.
import { BASE_STATS, SPECIAL_INFO, AWAKENINGS, EXTREME, eff } from '../data/stats.js';
import { allSanctums, trainStats } from '../data/sanctums.js';
import { RACES, RACE_MIGRATE } from '../data/races.js';
import { ENGRAVINGS, TAGS, CANCELS } from '../data/engravings.js';
import { ITEMS, weaponCat, weaponHands } from '../data/items.js';
import { evalCond, condText } from './conditions.js';
import { SKILLS, ENGRAVING_SKILLS, CLASSES, RACE_CLASSES } from '../data/skills.js';

export const SLOTS = ['head', 'arm', 'heart', 'leg', 'back'];
export const AGI_DODGE_FROM = 25;
export const GEAR_SLOTS = ['weapon', 'off', 'armor', 'acc1', 'acc2'];

// loadout: { race, level, alloc:{str..}, engravings:{slot:id}, gear:{slot:id} }
export function computeBuild(lo) {
  if (RACE_MIGRATE[lo.race]) lo = { ...lo, race: RACE_MIGRATE[lo.race] };
  const race = RACES[lo.race];
  const stats = {};
  const sanct = allSanctums(lo); // 성지에서 받은 축복 (모든 성지, 내 종족의 성지는 1.5배)
  const train = trainStats(lo);  // 성지 수련 단계
  for (const k of BASE_STATS) stats[k] = race.base[k] + (lo.alloc?.[k] || 0) + (race.growth[k] || 0) * (lo.level - 1) + (sanct.stats[k] || 0) + (train[k] || 0);
  for (const k of Object.keys(SPECIAL_INFO)) stats[k] = 0;

  const notes = []; // UI에 보여줄 발동 내역
  const sources = [];
  for (const s of SLOTS) {
    const id = lo.engravings?.[s];
    if (id && ENGRAVINGS[id]) sources.push({ kind: 'engraving', id, def: ENGRAVINGS[id] });
  }
  const twoHand = weaponHands(ITEMS[lo.gear?.weapon]) >= 2; // 양손 무기면 왼손은 쉰다
  const offRaw = lo.gear?.off ? ITEMS[lo.gear.off] : null;
  const offIsWeapon = !!(offRaw && offRaw.slot === 'weapon' && weaponHands(offRaw) < 2 && lo.gear.off !== lo.gear.weapon); // 왼손에 한손 무기
  for (const s of GEAR_SLOTS) {
    const id = lo.gear?.[s];
    if (s === 'off' && (twoHand || !(ITEMS[id]?.slot === 'off' || offIsWeapon))) continue;
    // 능력치 배율: 양손 무기는 한손 둘을 합친 만큼(×1.8), 왼손에 든 무기는 절반
    if (id && ITEMS[id]) sources.push({ kind: 'item', id, def: ITEMS[id], mul: s === 'weapon' && twoHand ? 1.8 : s === 'off' && offIsWeapon ? 0.5 : 1 });
  }

  // 1) 고정 스탯
  for (const src of sources) {
    for (const [k, v] of Object.entries(src.def.stats || {})) stats[k] = (stats[k] || 0) + Math.round(v * (src.mul ?? 1));
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
    for (const [k, v] of Object.entries(src.def.stats || {})) stats[k] -= Math.round(v * (src.mul ?? 1));
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

  effects.push(...sanct.effects); // 3단계 은총
  // 강화한 무기: 단계마다 모든 피해 +6%
  const rf = lo.reinforce?.[lo.gear?.weapon] || 0;
  if (rf) effects.push({ type: 'mul', key: 'dmgMul', v: 1 + 0.06 * rf });

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
    physDR: Math.max(0, stats.pres) / (Math.max(0, stats.pres) + 160), // 방어 1점의 값을 낮췄다 (예전 +100)
    magDR: Math.max(0, stats.mres) / (Math.max(0, stats.mres) + 160),
    physPen: 0, magPen: 0, knockback: 30, regen: 0,
    dmgMul: 1, dmgTakenMul: 1, burnMul: 1, bleedMul: 1, chillMul: 1, reactionMul: 1, statusDmgMul: 1, reflectMul: 1,
    poisonCap: 10, freezeReduce: 0, cloudSize: 0, dashCd: 1.2, goldMul: 1, projMul: lo.race === 'elf' ? 1.3 : 1,
    resGain: 1, hurtRes: 0, lowHunt: 0, skillCdMul: 1, aimSlow: lo.race === 'elf' ? 0.82 : 0.65,
    freezeTime: 1.6, castMul: 1,
  };
  // 종족 고유 수치
  if (lo.race === 'wizard') { d.reactionMul *= 1.5; d.skillCdMul *= 0.75; }
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
  // 민첩 25부터는 1마다 회피 +0.3%가 더 붙는다 (최대 +15%)
  d.dodge += Math.min(0.15, Math.max(0, stats.agi - AGI_DODGE_FROM) * 0.003);
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

  // 액티브 스킬: 종족 스킬(레벨 해금) + 장착한 각인의 스킬 + 무기 기술 → 최대 4개 장착
  const cls = lo.cls && CLASSES[lo.cls]?.race === lo.race ? lo.cls : RACE_CLASSES(lo.race)[0];
  const available = CLASSES[cls].skills.filter((id) => (lo.allSkills || (SKILLS[id].unlock || 1) <= lo.level));
  for (const src of active) if (src.kind === 'engraving' && ENGRAVING_SKILLS[src.id] && !available.includes(ENGRAVING_SKILLS[src.id])) available.push(ENGRAVING_SKILLS[src.id]);
  for (const id of lo.learned || []) if (SKILLS[id] && !available.includes(id)) available.push(id); // 세상에서 배운 기술
  let skills = (lo.skills || []).filter((id) => available.includes(id)).slice(0, 4);
  if (!lo.skills) {
    // 기본 장착: 준비/강화 → 공격 → 마무리 순으로 콤보가 되게
    const race = available.filter((id) => SKILLS[id]);
    const pick = (roles) => race.find((id) => roles.includes(SKILLS[id].role) && !skills.includes(id));
    for (const roles of [['준비', '강화', '전환', '방어'], ['공격', '이동', '연타', '제어', '소환'], ['마무리']]) { const id = pick(roles); if (id) skills.push(id); }
    for (const id of race) if (skills.length < 4 && !skills.includes(id)) skills.push(id);
  }
  // 무기 유형 보정: 근접은 붙어 싸우는 만큼 단단하고, 원거리는 쏘는 동안 느려진다
  if (wpn.kind === 'melee') { d.dmgTakenMul *= 0.9; flags.add('stagger'); }
  else flags.add('aimSlow');
  // 손 보정: 양손 무기는 종류마다 장점 하나, 한손 둘을 같은 계열로 들면 살짝 더 강해진다
  const wcat = weaponCat(ITEMS[weaponId]), hands = weaponHands(ITEMS[weaponId]);
  const offSrc = active.find((s2) => s2.mul === 0.5 && s2.def.slot === 'weapon');
  if (hands >= 2) {
    const h = twoHandBonus(weaponId, ITEMS[weaponId]);
    if (h.atkSpeed) d.atkSpeed *= h.atkSpeed;
    if (h.dmgMul) d.dmgMul *= h.dmgMul;
    notes.push({ kind: 'on', text: h.text });
  } else if (offSrc) {
    const h = pairBonus(ITEMS[weaponId], offSrc.def);
    if (h) { if (h.atkSpeed) d.atkSpeed *= h.atkSpeed; if (h.dmgMul) d.dmgMul *= h.dmgMul; if (h.castMul) d.castMul *= h.castMul; notes.push({ kind: 'on', text: h.text }); }
  }
  const offA = active.find((s2) => s2.def.slot === 'off' || s2 === offSrc);
  const offItem = offA ? (offA === offSrc ? { ...offSrc.def, off: offWeaponPower(offSrc.def), odesc: '왼손에 든 무기' } : offA.def) : null;
  return { race: lo.race, stats, derived: d, flags, triggers, tags, synergies, awakenings, notes, load, overload, extreme, weapon: ITEMS[weaponId].weapon, weaponId, weaponItem: ITEMS[weaponId], wcat, hands, spirit: lo.spirit?.id ? lo.spirit : null, offId: offA?.id || null, offItem, offIsWeapon: !!offSrc, cls, skills, available, abilities: lo.abilities || {} };
}

// 무기 계열: 마법(마도서 · 완드 · 보주 · 인형) / 단검(민첩 칼) / 검 / 도끼 / 둔기 / 던지기 / 채찍
export function weaponFamily(it) {
  const c = weaponCat(it);
  if (it?.weapon?.dmg === 'mag' || ['tome', 'staff', 'orb'].includes(c)) return 'magic';
  if (c === 'blade') return it.weapon?.scale === 'agi' ? 'dagger' : 'sword';
  return c;
}
export const FAMILY_NAME = { magic: '마법 무기', dagger: '단검', sword: '검', axe: '도끼', blunt: '둔기', throw: '던지는 무기', whip: '채찍' };
// 양손 무기: 쌍검은 빠르게, 무거운 것은 세게, 활 · 지팡이는 조금 세게
export function twoHandBonus(id, it) {
  const c = weaponCat(it);
  if (/dual|twin/i.test(id) || it.weapon?.dual) return { atkSpeed: 1.15, text: '양손 쌍검: 공격 속도 +15%' };
  if (['bow', 'tube', 'staff'].includes(c)) return { dmgMul: 1.08, text: '양손 원거리 무기: 피해 +8%' };
  if (c === 'fist') return { atkSpeed: 1.08, dmgMul: 1.05, text: '양손 주먹: 공격 속도 +8% · 피해 +5%' };
  return { dmgMul: 1.12, text: '양손 무기: 피해 +12%' };
}
// 같은 계열 한손 무기 둘: 살짝만 강해진다
export function pairBonus(main, off) {
  const f = weaponFamily(main);
  if (f !== weaponFamily(off)) return null;
  if (f === 'magic') return { dmgMul: 1.06, castMul: 0.88, text: '마법 무기 둘: 피해 +6% · 시전 시간 -12%' };
  if (f === 'dagger') return { atkSpeed: 1.12, text: '쌍단검: 공격 속도 +12%' };
  if (f === 'sword') return { atkSpeed: 1.06, dmgMul: 1.04, text: '쌍검: 공격 속도 +6% · 피해 +4%' };
  if (f === 'axe' || f === 'blunt') return { dmgMul: 1.08, text: `${FAMILY_NAME[f]} 둘: 피해 +8%` };
  return { atkSpeed: 1.06, text: `${FAMILY_NAME[f] || '같은 무기'} 둘: 공격 속도 +6%` };
}
// 왼손 무기로 쓰는 스킬의 힘 (마검사 · 근접 마법사 같은 조합)
export function offWeaponPower(it) {
  const f = weaponFamily(it);
  if (f === 'magic') return { spell: 0.85 };
  if (f === 'throw') return { throw: 0.85 };
  if (f === 'whip') return { slash: 0.7 };
  return { slash: 0.8, smash: 0.8, thrust: 0.8, parry: 0.8, throw: f === 'dagger' || f === 'axe' ? 0.6 : 0 };
}

// 빌드 코드 (온라인 공유/고스트 대전용)
export function encodeLoadout(lo) {
  const json = JSON.stringify({ r: lo.race, l: lo.level, a: lo.alloc, e: lo.engravings, g: lo.gear, k: lo.skills, c: lo.cls });
  return btoa(unescape(encodeURIComponent(json)));
}
export function decodeLoadout(code) {
  const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  return { race: o.r, level: o.l, alloc: o.a || {}, engravings: o.e || {}, gear: o.g || {}, skills: o.k, cls: o.c };
}

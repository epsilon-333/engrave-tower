// 빌드 계산: 로드아웃(종족·레벨·배분·각인·장비) → 최종 스탯, 파생 수치, 플래그, 트리거.
// DOM을 쓰지 않는 순수 함수라 서버에서도 그대로 돌릴 수 있다.
import { BASE_STATS, SPECIAL_INFO, AWAKENINGS, EXTREME, eff } from '../data/stats.js';
import { allSanctums, trainStats } from '../data/sanctums.js';
import { RACES, RACE_MIGRATE, RACE_FX } from '../data/races.js';
import { ENGRAVINGS, TAGS, CANCELS } from '../data/engravings.js';
import { REINFORCE_STEP, REINFORCE_ARMOR, REINFORCE_GEAR, rfKey } from '../data/goods.js';
import { ITEMS, weaponCat, weaponHands } from '../data/items.js';
import { evalCond, condText } from './conditions.js';
export const STAT_MAX = 300;
import { GROWTH_MUL } from '../data/races.js';
import { weaponScale, CLASS_STATS } from '../data/statscale.js';
import { engravingSkillFor, SKILLS, CLASSES, RACE_CLASSES } from '../data/skills.js';

export const SLOTS = ['head', 'arm', 'heart', 'leg', 'back']; // 각인 칸 다섯: 앞 넷이 Q · E · R · F(스킬 + 패시브), 마지막은 패시브만 (부위 구분 없음 · 이름은 예전 저장 그대로)
export const SKILL_SLOTS = SLOTS.slice(0, 4), SLOT_KEYS = ['Q', 'E', 'R', 'F', '패시브'];
export const GEAR_SLOTS = ['weapon', 'off', 'armor', 'acc1', 'acc2'];

// 각인 강화 (용의 둥지): 단계마다 스탯 · 효과 수치 +12%
export const ENG_STEP = 0.12, ENG_MAX = 5;
function scaleEffect(e, m) {
  if (typeof e.v !== 'number') return e;
  if (e.type === 'mul') return { ...e, v: 1 + (e.v - 1) * m };
  if (e.type === 'add' || e.type === 'stat') return { ...e, v: e.type === 'stat' ? Math.round(e.v * m) : e.v * m };
  return e;
}
// loadout: { race, level, alloc:{str..}, engravings:{slot:id}, gear:{slot:id} }
export function computeBuild(lo) {
  if (RACE_MIGRATE[lo.race]) lo = { ...lo, race: RACE_MIGRATE[lo.race] };
  const race = RACES[lo.race];
  const stats = {};
  const sanct = allSanctums(lo); // 성지에서 받은 축복 (모든 성지, 내 종족의 성지는 1.5배)
  const train = trainStats(lo);  // 성지 수련 단계
  // 종족 · 성장 · 찍은 포인트에만 종족 비율 보정을 곱한다 (장비 · 각인 보너스는 부풀리지 않는다)
  const statSrc = {};
  for (const k of BASE_STATS) {
    const grow = Math.round(((race.growth[k] || 0) + (CLASS_STATS[lo.cls]?.[0] === k ? 0.5 : 0)) * GROWTH_MUL * (lo.level - 1)); // 종족 성장 +0.5 · 클래스 주력 스탯 +0.25 (레벨마다) — 나머지는 자유 포인트로
    const m = race.mult?.[k] || 1, own = race.base[k] + (lo.alloc?.[k] || 0) + grow;
    const sanctTrain = (sanct.stats[k] || 0) + (train[k] || 0);
    stats[k] = Math.round(own * m) + sanctTrain;
    statSrc[k] = { base: race.base[k], grow, alloc: lo.alloc?.[k] || 0, mult: m, race: Math.round(own * m) - own, sanct: sanctTrain };
  }
  for (const k of Object.keys(SPECIAL_INFO)) stats[k] = 0;

  const notes = []; // UI에 보여줄 발동 내역
  const sources = [];
  for (const s of SLOTS) {
    const id = lo.engravings?.[s];
    if (id && ENGRAVINGS[id]) { const elv = lo.engLv?.[id] || 0; sources.push({ kind: 'engraving', id, def: ENGRAVINGS[id], mul: 1 + ENG_STEP * elv, elv }); } // 용의 둥지에서 강화한 각인: 단계마다 +12%
  }
  // 탑 등반에서 새긴 각인: 부하를 차지하지 않는다 · 연마 단계마다 +12% (몸에 새긴 각인과 같은 것이면 겹친다)
  for (const re of lo.runEng || []) if (ENGRAVINGS[re.id]) sources.push({ kind: 'engraving', run: true, id: re.id, def: ENGRAVINGS[re.id], mul: 1 + ENG_STEP * (re.lv || 0), elv: re.lv || 0 });
  const twoHand = weaponHands(ITEMS[lo.gear?.weapon]) >= 2; // 양손 무기면 왼손은 쉰다
  const offRaw = lo.gear?.off ? ITEMS[lo.gear.off] : null;
  const offIsWeapon = !!(offRaw && offRaw.slot === 'weapon' && weaponHands(offRaw) < 2 && lo.gear.off !== lo.gear.weapon); // 왼손에 한손 무기
  for (const s of GEAR_SLOTS) {
    const id = lo.gear?.[s];
    if (s === 'off' && (twoHand || !(ITEMS[id]?.slot === 'off' || offIsWeapon))) continue;
    // 능력치 배율: 양손 무기는 ×1.3, 왼손에 든 무기는 절반
    const rfK = s === 'weapon' ? 1 : 1 + REINFORCE_GEAR * (lo.reinforce?.[rfKey(lo.gear, s)] || 0); // 강화한 왼손 · 장신구 · 갑옷: 능력치 +10%씩
    if (id && ITEMS[id]) sources.push({ kind: 'item', id, def: ITEMS[id], mul: (s === 'weapon' && twoHand ? 1.3 : s === 'off' && offIsWeapon ? 0.5 : 1) * rfK }); // 양손 무기 능력치 ×1.3 (예전 ×1.8 — 양손의 장점은 양손 보너스로)
  }

  // 1) 고정 스탯
  for (const src of sources) {
    for (const [k, v] of Object.entries(src.def.stats || {})) stats[k] = (stats[k] || 0) + Math.round(v * (src.mul ?? 1));
  }
  // 싸우는 중에 잠깐 오른 스탯 (스킬 · 각인이 준다) — 각인 조건 · 각성 문턱이 이 값으로 다시 판정된다
  for (const [k, v] of Object.entries(lo.tempStats || {})) stats[k] = (stats[k] || 0) + v;

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
      if (ok) effects.push(src.elv ? scaleEffect(e, src.mul) : e);
    }
  }

  effects.push(...sanct.effects); // 3단계 은총
  if (lo.extraEffects) effects.push(...lo.extraEffects); // 탑 등반의 축복 · 탑의 축복 · 제단의 대가
  // 강화한 무기: 단계마다 모든 피해 +6% (REINFORCE_STEP)
  const rf = lo.reinforce?.[lo.gear?.weapon] || 0;
  if (rf) effects.push({ type: 'mul', key: 'dmgMul', v: 1 + REINFORCE_STEP * rf });
  const ra = lo.gear?.armor ? lo.reinforce?.[lo.gear.armor] || 0 : 0; // 강화한 갑옷: 단계마다 받는 피해 -2%
  if (ra) effects.push({ type: 'mul', key: 'dmgTakenMul', v: 1 - REINFORCE_ARMOR * ra });

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
  // 스탯 바꾸기: 한 스탯이 오르면 다른 스탯도 따라 오른다 (예: 체력 3마다 근력 +1)
  const convBase = { ...stats };
  for (const e of effects) if (e.type === 'conv') stats[e.to] = (stats[e.to] || 0) + Math.floor(Math.max(0, convBase[e.from] || 0) / e.per) * (e.v || 1);

  // 6.5) 종족 비율 보정: 종족마다 잘 크는 능력치는 더, 못 크는 능력치는 덜

  for (const k of BASE_STATS) stats[k] = Math.min(STAT_MAX, stats[k]); // 기본 스탯 최대 300

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
    maxHp: 260 + 14 * ((lo.level || 1) - 1) + E.vit * 24, // 체력: 레벨마다 +14, 체력 스탯이 더 많이 (공격이 체력보다 빨리 크던 것)
    physAtk: 4 + E.str * 1.1,                  // 기본 공격력은 조금 낮게 (예전 × 1.3)
    dexAtk: 4 + E.agi * 1.0 + E.str * 0.2,
    magAtk: 4 + E.mag * 1.1,
    atkSpeed: 1 + 0.7 * E.agi / (E.agi + 110),       // 민첩: 공격 속도 (최대 +70%, 갈수록 덜 오른다)
    moveSpeed: 80 * (1 + 0.3 * E.agi / (E.agi + 90)), // 민첩: 이동 속도 (최대 +30% · 너무 빠르면 어지러워서 갈수록 덜 오른다)
    dodge: 0.45 * E.agi / (E.agi + 110),                // 민첩: 회피 (민첩 20 → 7% · 60 → 16% · 최대 45%)
    crit: 0.05 + E.sen / (E.sen + 140),
    critDmg: 1.5 + E.sen * 0.006,
    sensePen: 0.3 * E.sen / (E.sen + 120),               // 감각: 약점을 찔러 방어 무시 (최대 30%)
    senseR: 30 + E.sen * 0.8,                            // 감각: 숨은 상자 · 함정을 알아채는 거리
    statusRes: E.spi / (E.spi + 90),
    cdr: E.spi / (E.spi + 160),
    loadCap: 25 + Math.floor(stats.spi / 10), // 기본 25 · 정신 10마다 1 (넘치게는 장착할 수 없다)
    physDR: Math.max(0, stats.pres) / (Math.max(0, stats.pres) + 160), // 방어 1점의 값을 낮췄다 (예전 +100)
    magDR: Math.max(0, stats.mres) / (Math.max(0, stats.mres) + 160),
    physPen: 0, magPen: 0, knockback: 30, regen: 0,
    dmgMul: 1, dmgTakenMul: 1, burnMul: 1, bleedMul: 1, chillMul: 1, reactionMul: 1, statusDmgMul: 1, reflectMul: 1,
    poisonCap: 10, freezeReduce: 0, cloudSize: 0, dashCd: 1.2, goldMul: 1, projMul: 1,
    resGain: 1, hurtRes: 0, lowHunt: 0, curseMul: 1, skillCdMul: 1, aimSlow: 0.65,
    freezeTime: 1.6, castMul: 1, costMul: 1, healMul: 1,
  };
  // 종족 고유 수치
  if (lo.race === 'wizard') d.maxHp *= RACE_FX.wizardHp;
  if (lo.race === 'knight') d.maxHp *= RACE_FX.knightHp;
  if (lo.race === 'assassin') d.dodge += RACE_FX.assassinDodge;
  const flags = new Set();
  const triggers = { hit: [], kill: [], hurt: [], hurtMag: [], dodge: [], crit: [], dash: [], shield: [], awaken: [], cast: [] };
  // 공격 %는 곱하지 않고 더한다: 각성 · 각인 · 장비의 「공격력 +N%」 「모든 피해 +N%」가 서로 곱해져 높은 층에서 폭발하던 것 (+10%와 +15% = +25%)
  const ADDITIVE = { physAtk: 0, dexAtk: 0, magAtk: 0, dmgMul: 0 };
  for (const e of effects) {
    if (e.type === 'add') d[e.key] = (d[e.key] || 0) + e.v;
    else if (e.type === 'mul' && e.key in ADDITIVE) ADDITIVE[e.key] += e.v - 1;
    else if (e.type === 'mul') d[e.key] = (d[e.key] ?? 1) * e.v;
    else if (e.type === 'flag') flags.add(e.flag);
    else if (e.type === 'on') triggers[e.event].push(e);
  }
  for (const [k, v] of Object.entries(ADDITIVE)) if (v) d[k] = (d[k] ?? 1) * Math.max(0.1, 1 + v);
  d.maxHp = Math.round(d.maxHp);
  d.physPen += d.sensePen; d.magPen += d.sensePen;
  d.dodge = Math.min(0.6, d.dodge);
  d.crit = Math.min(0.9, d.crit);
  d.statusRes = Math.min(0.85, d.statusRes);

  // 9) 각인 부하
  let load = 0;
  for (const src of active) if (src.kind === 'engraving' && !src.run) load += src.def.load;
  const overload = load > d.loadCap; // 장착할 때 막는다 (정신이 줄어 넘치면 뒤 칸부터 빠진다: fitEngravings)
  if (overload) notes.push({ kind: 'warn', text: `부하 ${load}/${d.loadCap}: 한도를 넘었다 · 각인 하나를 빼야 한다` });

  const wid = lo.gear?.weapon && ITEMS[lo.gear.weapon] ? lo.gear.weapon : 'rustySword';
  const weaponId = disabled.has(wid) ? 'rustySword' : wid;
  const wpn = ITEMS[weaponId].weapon;
  if (wpn.crit) d.crit = Math.min(0.9, d.crit + wpn.crit);
  if (wpn.critDmg) d.critDmg += wpn.critDmg;
  if (flags.has('noAimSlow')) d.aimSlow = 1;

  // 액티브 스킬: 각인 칸 Q · E · R · F에 장착한 각인의 스킬 (빈 칸은 비워 둔다). 탑 등반에서 새긴 각인의 스킬은 빈 칸을 채운다
  // allSkills(연습 · 시뮬레이션)일 때만 예전처럼 클래스 스킬에서 고른다
  const cls = lo.cls && CLASSES[lo.cls]?.race === lo.race ? lo.cls : RACE_CLASSES(lo.race)[0];
  let skills, available, innateSkills = [];
  if (lo.allSkills) {
    available = CLASSES[cls].skills.slice();
    for (const src of active) { const sk = src.kind === 'engraving' && engravingSkillFor(src.id, lo.race); if (sk && !available.includes(sk)) available.push(sk); }
    skills = (lo.skills || []).filter((id) => available.includes(id)).slice(0, 4);
    if (!lo.skills) {
      const pick = (roles) => available.find((id) => roles.includes(SKILLS[id].role) && !skills.includes(id));
      for (const roles of [['준비', '강화', '전환', '방어'], ['공격', '이동', '연타', '제어', '소환'], ['마무리']]) { const id = pick(roles); if (id) skills.push(id); }
      for (const id of available) if (skills.length < 4 && !skills.includes(id)) skills.push(id);
    }
  } else {
    skills = SKILL_SLOTS.map((sl) => { const id = lo.engravings?.[sl]; return id && ENGRAVINGS[id] ? engravingSkillFor(id, lo.race) : null; });
    for (const re of lo.runEng || []) { const sk = engravingSkillFor(re.id, lo.race); const i = skills.indexOf(null); if (sk && i >= 0 && !skills.includes(sk)) skills[i] = sk; }
    // 종족 스킬은 처음부터 그 종족의 것: 각인이 없는 칸은 내 클래스 스킬(레벨에 맞게 열린 것)로 채운다. 각인을 넣으면 그 칸은 각인 스킬로 바뀐다
    const own = CLASSES[cls].skills.filter((id) => SKILLS[id] && (SKILLS[id].unlock || 1) <= (lo.level || 1) && !skills.includes(id));
    const pickOwn = (roles) => { const i = own.findIndex((id) => roles.includes(SKILLS[id].role)); return i >= 0 ? own.splice(i, 1)[0] : null; };
    const order = [['준비', '강화', '전환', '방어'], ['공격', '이동', '연타', '제어', '소환'], ['마무리'], ['궁극']];
    for (let i = 0; i < skills.length; i++) if (!skills[i]) skills[i] = pickOwn(order[i] || []) || own.shift() || null;
    innateSkills = skills.filter((id) => id && CLASSES[cls].skills.includes(id));
    available = skills.filter(Boolean);
  }
  // 무기 유형 보정: 근접은 붙어 싸우는 만큼 단단하고, 원거리는 쏘는 동안 느려진다
  if (wpn.kind === 'melee') { d.dmgTakenMul *= 0.8; flags.add('stagger'); } // 근접: 받는 피해 -20% (무기 설명과 같게 · 예전엔 -10%)
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
  // 무기 계열의 스탯 계수 · 개방 (평타 · 무기 기술 피해, 80 이상 공격 속도)
  const wScale = weaponScale({ weaponItem: ITEMS[weaponId], stats });
  d.atkSpeed *= wScale.spd;
  return { innateSkills, lo, statSrc, wScale, race: lo.race, level: lo.level || 1, stats, derived: d, flags, triggers, tags, synergies, awakenings, notes, load, overload, extreme, weapon: ITEMS[weaponId].weapon, weaponId, weaponItem: ITEMS[weaponId], wcat, hands, spirit: lo.spirit?.id ? lo.spirit : null, spirits2: lo.spirits2 || [], /* 정령사: 함께하는 정령 둘 더 */ offId: offA?.id || null, offItem, offIsWeapon: !!offSrc, cls, skills, available, abilities: lo.abilities || {} };
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
  if (c === 'bow') return { dmgMul: 1.08, text: '활: 피해 +8%' };
  if (['tube', 'staff'].includes(c)) return { dmgMul: 1.08, text: '양손 원거리 무기: 피해 +8%' };
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
  const json = JSON.stringify({ r: lo.race, l: lo.level, a: lo.alloc, e: lo.engravings, g: lo.gear, k: lo.skills, c: lo.cls, n: lo.engLv });
  return btoa(unescape(encodeURIComponent(json)));
}
export function decodeLoadout(code) {
  const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  return { race: o.r, level: o.l, alloc: o.a || {}, engravings: o.e || {}, gear: o.g || {}, skills: o.k, cls: o.c, engLv: o.n || {} };
}

// 부하 한도를 넘으면(정신이 줄었을 때 · 예전 저장) 뒤 칸(패시브 → F → R …)부터 뺀다. 뺀 각인 이름들을 돌려준다
export function fitEngravings(save, toLoadout) {
  const out = [];
  for (let i = SLOTS.length - 1; i >= 0; i--) {
    const b = computeBuild(toLoadout(save));
    if (b.load <= b.derived.loadCap) break;
    const sl = SLOTS[i];
    if (save.slots?.[sl]) { out.push(ENGRAVINGS[save.slots[sl]]?.name || save.slots[sl]); delete save.slots[sl]; }
  }
  return out;
}

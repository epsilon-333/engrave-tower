// 자원 각인 (2026-11-19) — 종족 자원을 얻는 방법을 각인이 준다. 종족 상관없이 누구나 쓴다.
// 규칙: 패시브로 자원을 주는 각인에는 딸린 스킬이 없고, 스킬로 자원을 얻는 각인에는 패시브 효과가 없다(능력치만).
// 예외 「자원의 불꽃」: 스킬(화염 부여)은 자원을 얻지 않고, 패시브가 불타는 적마다 자원을 준다.
// 기본 수입은 종족 공통: 처치 +5 · 초당 +2(보스와 싸우는 중엔 초당 +5) — data/races.js · RES_BASE.
export const RES_BASE = { regen: 2, bossRegen: 5, kill: 5 };

const on = (event, chance, action, text, extra = {}) => ({ type: 'on', event, chance, action, text, ...extra });
const add = (key, v, text) => ({ type: 'add', key, v, text });
const LOAD = { 1: 2, 2: 3, 3: 5, 4: 7, 5: 10 };

// [아이디, 이름, 부위, 등급, 능력치, 효과, 딸린 스킬(없으면 null), 재료(잔향)]
export const RES_ENGS = [
  // ── 패시브 (딸린 스킬 없음) ──
  ['rHurt', '맞은 숨', 'back', 2, { vit: 3, pres: 2 }, [on('hurt', 1, { res: 4 }, '맞으면 자원 +4 (3초에 한 번)', { cd: 3 })], null, { rust: 3, goo: 2 }],
  ['rDodge', '비껴가는 숨', 'leg', 2, { agi: 4, sen: 2 }, [on('dodge', 1, { res: 8 }, '회피하면 자원 +8')], null, { wing: 3, goo: 2 }],
  ['rCrit', '날 선 호흡', 'arm', 3, { sen: 4, agi: 3 }, [on('crit', 1, { res: 2 }, '치명타마다 자원 +2')], null, { wing: 4, rust: 3 }],
  ['rLow', '벼랑 끝의 숨', 'heart', 3, { vit: 5, str: 3 }, [add('lowRes', 3, '체력 30% 이하면 초당 자원 +3')], null, { blood: 4, bone: 3 }],
  // ── 액티브 (능력치만, 패시브 효과 없음) ──
  ['rQuiet', '고요한 호흡', 'head', 2, { spi: 4, vit: 2 }, [], 'quietBreath', { goo: 3, spore: 3 }],
  ['rMark', '공명의 표식', 'head', 3, { sen: 4, spi: 3 }, [], 'resMark', { mirror: 3, wing: 3 }],
  ['rArrow', '흡수의 화살', 'arm', 3, { agi: 4, sen: 3 }, [], 'absorbArrow', { feather: 3, venom: 3 }],
  ['rFlame', '자원의 불꽃', 'heart', 4, { mag: 6, spi: 4 }, [add('flameRes', 2, '불타는 적 한 마리당 초당 자원 +2 (소환수가 붙인 불도 센다)')], 'resFlame', { ember: 5, magma: 3, core: 1 }],
  ['rBlood', '피를 마시는 일격', 'arm', 4, { str: 7, vit: 3 }, [], 'bloodDraw', { blood: 5, rust: 4, chief: 1 }],
];

export const RES_SKILLS = {
  quietBreath: { engraving: true, name: '고요한 호흡', role: '준비', cd: 14, cost: 1, scale: 'best', fx: 'buff', mo: 'crouch',
    desc: '4초 동안 숨을 고른다(움직임 절반). 1초마다 자원 +8, 모두 32.', do: [{ op: 'channel', dur: 4, every: 1, sub: { op: 'resGain', n: 8 } }] },
  resMark: { engraving: true, name: '공명의 표식', role: '준비', cd: 10, cost: 1, scale: 'best', fx: 'rune', aim: 'near', mo: 'point',
    desc: '적 하나에 8초 동안 표식을 새긴다. 표식 맞은 적이 피해를 입을 때마다 자원 +2.', do: [{ op: 'resMark', dur: 8, n: 2 }] },
  absorbArrow: { engraving: true, name: '흡수의 화살', role: '공격', cd: 9, cost: 1, scale: 'phys', fx: 'arrow', mo: 'shoot',
    desc: '화살이 맞은 적에게 박혀 지속 피해(공격력 35%/초)를 주고, 그 적이 쓰러지거나 12초가 지날 때까지 1초마다 자원 +6.', do: [{ op: 'proj', n: 1, speed: 420, range: 280, mul: 1.0, kind: 'arrow', absorb: { dps: 0.35, rate: 6, max: 12 } }] },
  resFlame: { engraving: true, name: '화염 부여', role: '강화', cd: 16, cost: 1, scale: 'best', elem: 'fire', fx: 'enchant', aim: 'none', mo: 'power',
    desc: '10초 동안 내 공격에 불을 붙인다. 평타 · 무기 기술이 공격력 40%만큼 화염 피해를 더 주고 화상 1중첩.', do: [{ op: 'enchant', elem: 'fire', dur: 10, pow: 0.4 }] },
  bloodDraw: { engraving: true, name: '피를 마시는 일격', role: '마무리', cd: 10, cost: 1, scale: 'phys', fx: 'burst', mo: 'bash',
    desc: '앞의 적을 크게 벤다. 이 일격으로 쓰러진 적마다 자원 +20.', do: [{ op: 'aoe', at: 'self', r: 58, mul: 1.8, gainPerKill: 20 }] },
};

export function registerResEngravings(ENGRAVINGS) {
  for (const [id, name, slot, grade, stats, effects, , recipe] of RES_ENGS) ENGRAVINGS[id] = { name, slot, grade, load: LOAD[grade], tags: [], stats, effects, recipe, weapons: 'all', resEng: true };
}
export function registerResSkills(SKILLS, ENGRAVING_SKILLS) {
  Object.assign(SKILLS, RES_SKILLS);
  for (const e of RES_ENGS) if (e[6]) ENGRAVING_SKILLS[e[0]] = e[6];
}

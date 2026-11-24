// 패시브 각인 (2026-11-24): 스킬 없이 각인 칸만 쓰는 각인 (`passiveOnly: true` · ENGRAVING_SKILLS에 없다)
// 1) 스킬을 나눠 쓰던 각인 가운데 패시브가 뚜렷한 것을 패시브 각인으로 바꾼다 — 스킬 몫만큼 수치 ×PASSIVE_BOOST
// 2) 새 패시브 각인: 효과는 숫자로 분명하게 (실행: sim/build.js · sim/world.js · sim/towerzone.js)
// 재료(잔향)는 data/recipes.js 규칙이 다시 정한다 (여기 recipe는 주 잔향의 실마리만)
export const PASSIVE_BOOST = 1.3;

// 스킬을 떼고 패시브만 남기는 각인 (각 스킬은 다른 각인이 여전히 준다 · tools/tests/passive.mjs)
export const PASSIVE_CONVERT = [
  'stillStone', 'ironHide', 'windRead', 'hunterMark', 'batWing', 'chiefWill', 'leechFang', 'queenCrown', 'sAfterimage', 'mirrorShell',
  'meltCore', 'witchEye', 'sFrostRing', 'ghoulHunger', 'slimeArmor', 'kBrace', 'sWeakEye', 'rotSporeHeart', 'kAcidRain', 'leechLordMaw',
  'cinderGlove', 'demonHorn', 'sFireWord', 'impWings', 'mirrorPupil', 'ogreFist', 'freezeCrystal', 'sPainChain', 'necroHeart', 'kBoneSpear',
  'manaSpring', 'sSeeker', 'bloodMagic', 'steamEngine', 'kElemMark', 'bloodFrost', 'septicClaw', 'sPounce', 'balanceSigil', 'allroundSigil',
  'kTimeBlades', 'extremeSigil', 'berserkBlood', 'echoAmplifier', 'quickHands', 'sLunge', 'sWindShoe', 'kSoulRend', 'sBoilBreath', 'giantGrip',
  'shadowStrike', 'sBehind', 'slimeRebirth', 'riftCore', 'graveContract', 'giantHeart', 'witchCrown', 'm_skyWhale', 'm_shardQueen', 'm_archivist',
];
export const PASSIVE_CONVERT_SET = new Set(PASSIVE_CONVERT);

// 새 패시브 각인의 수치
export const PASSIVE_FX = {
  sniperRange: 200, sniperMax: 0.4,      // 저격수: 거리 200 이상에서 최대 +40% (선형)
  relentStep: 0.1, relentGap: 1.2,       // 몰아치기: 같은 적 맞힘마다 +10% · 1.2초가 지나거나 빗나가면 0
  oneShotCrit: 0.5, oneShotCritDmg: 1.2, // 일격필살: 치명타 확률 ½ · 치명타 피해 +120%p (150% → 270%)
  brimMul: 1.25, brimT: 0.6,             // 넘치는 힘: 자원 가득일 때 쓴 스킬 +25% (0.6초 동안 그 스킬의 피해)
  bloodPrice: 0.4,                       // 피의 대가: 체력이 낮을수록 최대 +40%
  burnBody: 1.3,                         // 불붙은 몸: 내가 화상 중이면 불 피해 +30%
  dodgeCounterT: 2,                      // 회피 반격: 피하면 2초 동안 치명타 확정
  poisonCarryR: 80,                      // 독 퍼뜨리기: 둘레 80
  heavyBody: 0.75,                       // 무거운 몸: 느려져 있으면 받는 피해 -25%
  curseCrit: 0.03,                       // 저주 사냥꾼: 저주 중첩마다 치명타 +3%
  featherHp: 0.2, featherN: 3,           // 깃털 발: 떨어지면 최대 체력 20% · 한 층에 3번
  gillsBreath: 2, gillsDrown: 0.5,       // 아가미: 숨 최대 +100% · 숨 막힘 피해 절반
  lavaWalk: 0.3,                         // 불의 발: 용암 피해 -70% · 화상 없음
};

const flag = (f, text) => ({ type: 'flag', flag: f, text });
const STAT_NAME = { str: '근력', agi: '민첩', mag: '마력', vit: '체력', sen: '감각', spi: '정신' };
const STAT_TAG = { str: 'brawl', agi: 'wind', mag: 'light', vit: 'giant', sen: 'bleed', spi: 'undying' };
const STAT_ECHO = { str: 'rust', agi: 'wing', mag: 'ember', vit: 'goo', sen: 'blood', spi: 'spore' };
const IMMUNE = [['burn', '화상', 'fire', 'ember'], ['poison', '독', 'poison', 'venom'], ['chill', '빙결(냉기)', 'ice', 'frost'], ['bleed', '출혈', 'bleed', 'blood'], ['stun', '기절', 'giant', 'rust'], ['slow', '둔화', 'wind', 'wing']];

// [id, 이름, 등급, 부하, 태그, 능력치, 효과, 재료 실마리]
const NEW = [
  ['pSniper', '저격수의 눈', 3, 5, ['wind'], { sen: 4 }, [flag('sniper', '맞힌 거리에 따라 피해 상승: 거리 200 이상에서 최대 +40% (가까울수록 선형으로 줄어든다)')], { wing: 6 }],
  ['pRelentless', '몰아치기', 4, 9, ['brawl'], { str: 4, agi: 4 }, [flag('relentless', '같은 적을 맞힐 때마다 피해 +10% 계속 쌓인다 (상한 없음) · 빗나가거나 1.2초 안에 다시 못 맞히면 0')], { rust: 8 }],
  ['pBreeze', '바람결', 2, 3, ['wind'], { agi: 2 }, [{ type: 'add', key: 'dodge', v: 0.1, text: '회피 +10%' }], { wing: 4 }],
  ...Object.keys(STAT_NAME).map((k) => ['pTrain_' + k, `${STAT_NAME[k]} 단련`, 1, 2, [STAT_TAG[k]], { [k]: 8 }, [{ type: 'note', text: `${STAT_NAME[k]} +8` }], { [STAT_ECHO[k]]: 4 }]),
  ...IMMUNE.map(([k, nm, tag, echo]) => ['pImmune_' + k, `${nm}면역`, 2, 3, [tag], {}, [flag('immune_' + k, `${nm}에 걸리지 않는다`)], { [echo]: 5 }]),
  ['pOneShot', '일격필살', 4, 9, ['bleed'], {}, [flag('oneShot', '치명타 확률 ½ · 치명타 피해 +120%p (150% → 270%)')], { blood: 8 }],
  ['pThrift', '절약', 2, 3, ['light'], { spi: 2 }, [{ type: 'mul', key: 'costMul', v: 0.85, text: '스킬 자원 소모 -15%' }], { spore: 4 }],
  ['pKillBreath', '처치의 숨', 2, 3, ['drain'], { spi: 2 }, [{ type: 'on', event: 'kill', chance: 1, action: { res: 10 }, text: '처치하면 자원 +10' }], { blood: 4 }],
  ['pBrim', '넘치는 힘', 3, 4, ['light'], { mag: 2, str: 2 }, [flag('brimPower', '자원이 가득일 때 쓴 첫 스킬의 피해 +25%')], { ember: 5 }],
  ['pBloodPrice', '피의 대가', 3, 5, ['drain', 'brawl'], { vit: 3 }, [flag('bloodPrice', '체력이 낮을수록 주는 피해 상승: 잃은 체력 비율 × 40% (체력 0에 가까우면 +40%)')], { blood: 6 }],
  ['pBurningBody', '불붙은 몸', 2, 3, ['fire'], { mag: 2 }, [flag('burnBody', '내가 화상 중이면 불 피해 +30%')], { ember: 4 }],
  ['pDodgeCounter', '회피 반격', 3, 5, ['wind', 'shadow'], { agi: 3 }, [flag('dodgeCounter', '공격을 피하면 2초 동안 치명타 확정')], { wing: 6 }],
  ['pPoisonCarry', '독 퍼뜨리기', 2, 3, ['poison'], { toxicity: 3 }, [flag('poisonCarry', '독 걸린 적이 죽으면 둘레 80 안의 적에게 그 독 중첩이 그대로 옮는다')], { venom: 4 }],
  ['pHeavyBody', '무거운 몸', 2, 3, ['giant'], { vit: 3 }, [flag('heavyBody', '내가 느려져 있으면(둔화 · 냉기 · 속박) 받는 피해 -25%')], { goo: 4 }],
  ['pCurseHunter', '저주 사냥꾼', 3, 4, ['curse'], { sen: 3 }, [flag('curseHunter', '적의 저주 중첩마다 그 적에게 내 치명타 확률 +3%')], { spore: 5 }],
  // 지형 (1~2등급 · 부하 작게)
  ['pFeather', '깃털 발', 1, 2, ['wind'], {}, [flag('featherFall', '하늘에서 떨어져도 죽지 않는다: 최대 체력 20%를 잃고 마지막으로 섰던 땅으로 (한 층에서 3번까지)')], { wing: 3 }],
  ['pGills', '아가미', 1, 2, ['slime'], {}, [flag('gills', '물속 숨 최대 +100% · 숨이 다해도 체력이 깎이는 속도 절반')], { goo: 3 }],
  ['pFireFeet', '불의 발', 2, 2, ['fire'], {}, [flag('lavaWalk', '용암 위 피해 -70% · 용암 화상 없음')], { ember: 4 }],
  ['pBogWalk', '늪 걸음', 1, 2, ['slime'], {}, [flag('bogWalk', '늪 · 물 · 기름 · 먹 웅덩이와 눈밭에서 느려지지 않는다 · 늪 독 없음')], { goo: 3 }],
];
export const PASSIVE_NEW_IDS = NEW.map((r) => r[0]);
const SLOTS5 = ['head', 'arm', 'heart', 'leg', 'back'];

export function registerPassiveEngravings(ENGRAVINGS) {
  NEW.forEach(([id, name, grade, load, tags, stats, effects, recipe], i) => {
    ENGRAVINGS[id] = { name, slot: SLOTS5[i % 5], grade, load, tags, stats, effects, recipe, passiveOnly: true };
  });
  for (const id of PASSIVE_CONVERT) {
    const e = ENGRAVINGS[id]; if (!e) continue;
    e.passiveOnly = true; e.passiveBoost = PASSIVE_BOOST; // 스킬 몫만큼: 능력치 · 수치 ×1.3 (sim/build.js)
  }
}
// 스킬 표에서 패시브 각인을 뺀다 (data/skills.js 끝)
export function stripPassiveSkills(ENGRAVING_SKILLS) { for (const id of PASSIVE_CONVERT) delete ENGRAVING_SKILLS[id]; }

// ── 스킬 표식 (2단계에서 스킬마다 붙인다): def.marks = ['crit', 'scale:agi', 'selfStatus:burn', 'ranged', 'multi']
// crit: 맞히면 치명타 확정 · scale:<스탯>: 그 스탯 1점마다 피해 +1% · selfStatus:<상태>: 쓰면 나도 그 상태 (화상 · 독 · 출혈 · 냉기 · 둔화 · 기절)
// ranged · multi: 원거리 · 여러 대 (지금은 이어지는 패시브를 보여 주는 데만 쓴다)
export const MARK_SCALE_PER = 0.01;
export const SELF_STATUS = { burn: 0.04, poison: 0.04, bleed: 0.04, chill: 0, slow: 2, stun: 0.5 }; // 지속 피해는 최대 체력 비율(3초 합) · 둔화 · 기절은 초
export function skillMarks(def) {
  const out = { crit: false, scale: [], selfStatus: [], ranged: false, multi: false };
  for (const m of def?.marks || []) {
    const [k, v] = m.split(':');
    if (k === 'crit') out.crit = true; else if (k === 'scale' && v) out.scale.push(v); else if (k === 'selfStatus' && v) out.selfStatus.push(v);
    else if (k === 'ranged') out.ranged = true; else if (k === 'multi') out.multi = true;
  }
  return out;
}
const STATUS_KO = { burn: '화상', poison: '독', bleed: '출혈', chill: '냉기', slow: '둔화', stun: '기절' };
const SCALE_KO = { str: '근력', agi: '민첩', mag: '마력', vit: '체력', sen: '감각', spi: '정신', pres: '물리 저항', mres: '마법 저항' };
// 표식 → 이어지는 패시브 각인 (제단의 「🔗」 줄)
const LINKS = {
  crit: ['pOneShot', 'pCurseHunter'], ranged: ['pSniper'], multi: ['pRelentless'],
  burn: ['pBurningBody', 'pImmune_burn'], slow: ['pHeavyBody', 'pImmune_slow'], chill: ['pHeavyBody', 'pImmune_chill'], poison: ['pImmune_poison'], bleed: ['pImmune_bleed'], stun: ['pImmune_stun'],
};
export function markLinks(def) {
  const M = skillMarks(def), parts = [], ids = [];
  if (M.crit) { parts.push('치명타 확정'); ids.push(...LINKS.crit); }
  for (const s of M.scale) { parts.push(`${SCALE_KO[s] || s} 비례 (1점마다 +1%)`); ids.push('pTrain_' + s); }
  for (const s of M.selfStatus) { parts.push(`쓰면 나도 ${STATUS_KO[s] || s}`); ids.push(...(LINKS[s] || [])); }
  if (M.ranged) { parts.push('원거리'); ids.push(...LINKS.ranged); }
  if (M.multi) { parts.push('여러 대'); ids.push(...LINKS.multi); }
  return { parts, ids: [...new Set(ids)] };
}
// 패시브 각인 → 어울리는 표식 · 스킬 (패시브 쪽 「🔗」 줄)
export const PASSIVE_LINK_TEXT = {
  pOneShot: '「치명타 확정」 표식 스킬', pCurseHunter: '「치명타 확정」 표식 · 저주 스킬', pSniper: '「원거리」 표식 스킬', pRelentless: '「여러 대」 표식 스킬',
  pBurningBody: '「쓰면 나도 화상」 표식 스킬', pHeavyBody: '「쓰면 나도 둔화 · 냉기」 표식 스킬', pDodgeCounter: '회피 각인 · 「치명타」 각인', pPoisonCarry: '독 스킬 · 독 각인',
  pBloodPrice: '체력으로 쓰는 스킬 · 흡혈 각인', pBrim: '자원을 크게 쓰는 스킬', pThrift: '자원을 많이 쓰는 스킬', pKillBreath: '여럿을 쓰러뜨리는 범위 스킬',
  ...Object.fromEntries(Object.keys(STAT_NAME).map((k) => ['pTrain_' + k, `「${STAT_NAME[k]} 비례」 표식 스킬`])),
  ...Object.fromEntries(IMMUNE.map(([k, nm]) => ['pImmune_' + k, `「쓰면 나도 ${nm.replace('(냉기)', '')}」 표식 스킬`])),
};

// 종족: 기본 스탯, 레벨당 자동 성장, 종족 자원(스킬 콤보의 연료), 고유 특성
// res: 자원 규칙 (max 100) — regen 초당, hit 적중당, kill 처치당, hurt 피격 시 (받은 피해/최대 HP)×값, dodge 회피당, decay 전투 밖 초당 감소
export const RACES = {
  dino: {
    name: '공룡 수인', origin: '원시림',
    desc: '사냥으로 살아남는다. 적을 쓰러뜨릴 때마다 최대 체력 2% 회복.',
    strong: '근력 · 민첩', weak: '마법 저항 낮음',
    base: { str: 15, mag: 3, agi: 15, vit: 12, sen: 10, spi: 5, pres: 6, mres: 4 },
    growth: { str: 1 },
    mult: { str: 1.1, agi: 1.1, mag: 0.7, spi: 0.85 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '사냥의 피',
    res: { key: 'instinct', name: '본능', color: '#ff9a3a', hit: 3, kill: 6, decay: 4 },
  },
  wizard: {
    name: '마법사', origin: '인간',
    desc: '마력으로 주문을 시전한다. 시전 중에는 움직일 수 없다. 마법 피해 +50%, 최대 체력 -20%.',
    strong: '마력 · 정신 · 마법 피해 +50%', weak: '최대 체력 -20% · 물리 저항이 가장 낮음',
    base: { str: 3, mag: 18, agi: 8, vit: 6, sen: 9, spi: 15, pres: 3, mres: 9 },
    growth: { mag: 1 },
    mult: { mag: 1.2, spi: 1.1, str: 0.7, vit: 0.85, pres: 0.8 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '주문 증폭',
    res: { key: 'mana', name: '마력', color: '#4a8aff', regen: 9, kill: 4, start: 100 },
  },
  knight: {
    name: '기사', origin: '인간',
    desc: '맞을수록 오러가 쌓이고, 오러를 실어 강타한다. 최대 체력 +40%, 받는 물리 피해 -15%.',
    strong: '최대 체력 +40% · 물리 피해 -15%', weak: '마력 낮음 · 마법 저항 낮음',
    base: { str: 13, mag: 3, agi: 6, vit: 16, sen: 6, spi: 7, pres: 15, mres: 7 },
    growth: { str: 1 },
    mult: { pres: 1.15, vit: 1.1, agi: 0.85, mag: 0.75 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '수호의 맹세',
    res: { key: 'grit', name: '오러', color: '#ffd84a', hit: 3, kill: 5, hurt: 120, decay: 1 },
  },
  orc: {
    name: '오크', origin: '황야',
    desc: '체력이 낮을수록 피해가 커진다(체력 10% 이하에서 +100%). 맞으면 2초 동안 분노: 피해 +10%.',
    strong: '근력 · 체력', weak: '마력 거의 없음 · 마법 저항 낮음',
    base: { str: 18, mag: 2, agi: 9, vit: 15, sen: 7, spi: 5, pres: 6, mres: 3 },
    growth: { vit: 1 },
    mult: { str: 1.2, vit: 1.1, mag: 0.6, mres: 0.8 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '피의 분노',
    res: { key: 'rage', name: '분노', color: '#ff4a3a', hit: 4, kill: 6, hurt: 160, decay: 6 },
  },
  undead: {
    name: '언데드', origin: '묘지',
    desc: '영혼을 거둬 저주를 터뜨린다. 물리 공격 회피 +20%. 독 · 저주 · 출혈에 면역.',
    strong: '물리 회피 +20% · 독 · 저주 · 출혈 면역', weak: '마법 저항 낮음 · 느림',
    base: { str: 6, mag: 15, agi: 6, vit: 11, sen: 6, spi: 10, pres: 15, mres: 6 },
    growth: { pres: 1 },
    mult: { pres: 1.15, mag: 1.1, agi: 0.85, vit: 0.9 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '썩은 몸',
    res: { key: 'soul', name: '영혼', color: '#c45cff', hit: 5, kill: 25 }, // 맞힐 때마다 · 쓰러뜨리면 많이 오르고, 저절로 줄지 않는다
  },
  assassin: {
    name: '암살자', origin: '뒷골목',
    desc: '피하고 파고들며 그림자를 모은다. 모든 공격 회피 +10%. 대시가 순간이동이다(벽은 넘지 못한다).',
    strong: '민첩 · 감각', weak: '체력 낮음 · 저항 낮음',
    base: { str: 9, mag: 4, agi: 17, vit: 8, sen: 16, spi: 6, pres: 4, mres: 5 },
    growth: { sen: 1 },
    mult: { agi: 1.15, sen: 1.2, vit: 0.85, pres: 0.8 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '그림자 사냥꾼',
    res: { key: 'shadow', name: '그림자', color: '#8a6aff', hit: 3, kill: 8, dodge: 15, crit: 5, dash: 8, decay: 1 },
  },
  elf: {
    name: '엘프', origin: '숲',
    desc: '정령과 함께 싸운다. 멀리서 맞힐수록 투사체 피해가 커진다(거리 260에서 +100%, 그 사이는 고르게).',
    strong: '민첩 · 마력', weak: '체력 낮음 · 가까이에서 약함',
    base: { str: 5, mag: 14, agi: 15, vit: 7, sen: 12, spi: 11, pres: 4, mres: 8 },
    growth: { agi: 1 },
    mult: { agi: 1.1, sen: 1.1, mag: 1.05, str: 0.75, vit: 0.85 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '먼 사격',
    res: { key: 'spirit', name: '정령력', color: '#7be38a', regen: 5, hit: 3, kill: 5 },
  },
  dragon: {
    name: '용족', origin: '화산',
    desc: '불을 다루는 고대 혈통. 화염 피해 +30%(화상 포함). 화상 · 냉기에 면역.',
    strong: '화염 피해 +30% · 화상 · 냉기 면역', weak: '느림 · 회피 낮음',
    base: { str: 13, mag: 13, agi: 7, vit: 11, sen: 6, spi: 7, pres: 7, mres: 9 },
    growth: { mres: 1 },
    mult: { str: 1.05, mag: 1.05, mres: 1.1, agi: 0.85 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '용의 피',
    res: { key: 'dragon', name: '용기', color: '#ff6a2a', hit: 3, kill: 6, burnTick: 1, decay: 1 },
  },
};

// 종족 특성 수치 (2026-11-10 개편: 종족마다 특성 하나 · 둘을 숫자로 분명하게, 예전 특성은 모두 뺐다)
export const RACE_FX = {
  assassinDodge: 0.10,   // 암살자: 모든 공격 회피 +10%
  assassinBlink: 64,     // 암살자: 대시 = 순간이동 (거리 · 벽과 하늘 낭떠러지는 넘지 않는다)
  undeadPhysDodge: 0.20, // 언데드: 물리 공격 회피 +20%
  wizardMag: 1.5,        // 마법사: 마법 피해 +50%
  wizardHp: 0.8,         //        최대 체력 -20%
  dragonFire: 1.3,       // 용족: 화염 피해 +30% (화상 포함)
  knightPhys: 0.85,      // 기사: 받는 물리 피해 -15%
  knightHp: 1.4,         //      최대 체력 +40%
  dinoKillHeal: 0.02,    // 공룡 수인: 처치마다 최대 체력 2% 회복
  elfFar: 1.0,           // 엘프: 맞힌 거리에 따라 투사체 피해 +0~100%
  elfFarRange: 260,      //      가장 긴 무기 사거리에서 최대
  orcLow: 1.0,           // 오크: 체력이 낮을수록 피해 +0~100% (체력 100% → 0 · 10% 이하 → 최대)
  orcLowAt: 0.1,
  orcHurtT: 2,           //      맞으면 2초 동안 분노: 피해 +10%
  orcHurtMul: 1.1,
};
// 종족 면역 상태이상
export const RACE_IMMUNE = { undead: ['poison', 'curse', 'bleed'], dragon: ['burn', 'chill'] };

// 예전 저장 데이터의 종족 이름 변환
export const RACE_MIGRATE = { human: 'knight', dwarf: 'knight', beast: 'dino' };

export const POINTS_PER_LEVEL = 1; // 레벨이 오르면 스탯 포인트 하나
// 자동 성장을 절반으로 줄인 만큼(레벨마다 0.75)을 자유 포인트로 돌려준다 → 레벨마다 1.75점
export const GROWTH_MUL = 0.5;
export const pointsAt = (level) => Math.floor(1.75 * Math.max(0, level - 1));

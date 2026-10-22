// 종족: 기본 스탯, 레벨당 자동 성장, 종족 자원(스킬 콤보의 연료), 고유 특성
// res: 자원 규칙 (max 100) — regen 초당, hit 적중당, kill 처치당, hurt 피격 시 (받은 피해/최대 HP)×값, dodge 회피당, decay 전투 밖 초당 감소
export const RACES = {
  dino: {
    name: '공룡 수인', origin: '원시림',
    desc: '사냥할수록 본능이 끓어오른다. 본능 50 이상이면 이동·공격 속도 +10%.',
    strong: '근력 · 민첩', weak: '마법 저항 낮음',
    base: { str: 15, mag: 3, agi: 15, vit: 12, sen: 10, spi: 5, pres: 6, mres: 4 },
    growth: { str: 1 },
    mult: { str: 1.1, agi: 1.1, mag: 0.7, spi: 0.85 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '원시 본능',
    res: { key: 'instinct', name: '본능', color: '#ff9a3a', hit: 3, kill: 6, decay: 4 },
  },
  wizard: {
    name: '마법사', origin: '인간',
    desc: '마력으로 주문을 시전한다. 시전 중에는 움직일 수 없고, 강한 주문일수록 오래 걸린다. 원소 반응 피해 +50%.',
    strong: '마력 · 정신', weak: '체력과 물리 저항이 가장 낮음',
    base: { str: 3, mag: 18, agi: 8, vit: 6, sen: 9, spi: 15, pres: 3, mres: 9 },
    growth: { mag: 1 },
    mult: { mag: 1.2, spi: 1.1, str: 0.7, vit: 0.85, pres: 0.8 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '주문 증폭',
    res: { key: 'mana', name: '마력', color: '#4a8aff', regen: 9, kill: 4, start: 100 },
  },
  knight: {
    name: '기사', origin: '인간',
    desc: '맞을수록 오러가 쌓이고, 오러를 실어 강타한다. 받는 피해 -10%.',
    strong: '체력 · 물리 저항', weak: '느림 · 마력 낮음',
    base: { str: 13, mag: 3, agi: 6, vit: 16, sen: 6, spi: 7, pres: 15, mres: 7 },
    growth: { pres: 1 },
    mult: { pres: 1.15, vit: 1.1, agi: 0.85, mag: 0.75 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '수호의 맹세',
    res: { key: 'grit', name: '오러', color: '#ffd84a', hit: 2, kill: 3, hurt: 120, decay: 2 },
  },
  orc: {
    name: '오크', origin: '황야',
    desc: '때리고 맞으며 분노가 차오른다. 분노로 광전사가 되거나 최후의 일격을 날린다.',
    strong: '근력 · 체력', weak: '마력 거의 없음 · 마법 저항 낮음',
    base: { str: 18, mag: 2, agi: 9, vit: 15, sen: 7, spi: 5, pres: 6, mres: 3 },
    growth: { vit: 1 },
    mult: { str: 1.2, vit: 1.1, mag: 0.6, mres: 0.8 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '피의 분노',
    res: { key: 'rage', name: '분노', color: '#ff4a3a', hit: 4, kill: 6, hurt: 160, decay: 6 },
  },
  undead: {
    name: '언데드', origin: '묘지',
    desc: '영혼을 거둬 저주를 터뜨린다. 독과 출혈에 면역, 마법 피해 +12%. 일반 회복은 절반이지만 처치마다 생명력 6% 흡수.',
    strong: '마력 · 물리 저항 · 독 면역', weak: '마법 저항 낮음 · 회복이 처치에 묶임 · 느림',
    base: { str: 6, mag: 15, agi: 6, vit: 11, sen: 6, spi: 10, pres: 15, mres: 6 },
    growth: { mag: 1 },
    mult: { pres: 1.15, mag: 1.1, agi: 0.85, vit: 0.9 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '썩은 몸',
    res: { key: 'soul', name: '영혼', color: '#c45cff', hit: 1, kill: 10, decay: 1 },
  },
  assassin: {
    name: '암살자', origin: '뒷골목',
    desc: '피하고 파고들며 그림자를 모은다. 회피·치명타·대시로 그림자가 쌓이고, 적의 등 뒤를 치면 피해 +30%.',
    strong: '민첩 · 감각', weak: '체력 낮음 · 저항 낮음',
    base: { str: 9, mag: 4, agi: 17, vit: 8, sen: 16, spi: 6, pres: 4, mres: 5 },
    growth: { sen: 1 },
    mult: { agi: 1.15, sen: 1.2, vit: 0.85, pres: 0.8 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '그림자 사냥꾼',
    res: { key: 'shadow', name: '그림자', color: '#8a6aff', hit: 1, kill: 5, dodge: 15, crit: 5, dash: 8, decay: 2 },
  },
  elf: {
    name: '엘프', origin: '숲',
    desc: '정령과 함께 싸운다. 정령력이 저절로 차오르고, 멀리서 맞힐수록 투사체 피해 증가(최대 +30%).',
    strong: '민첩 · 마력', weak: '체력 낮음 · 가까이에서 약함',
    base: { str: 5, mag: 14, agi: 15, vit: 7, sen: 12, spi: 11, pres: 4, mres: 8 },
    growth: { agi: 1 },
    mult: { agi: 1.1, sen: 1.1, mag: 1.05, str: 0.75, vit: 0.85 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '정령의 벗',
    res: { key: 'spirit', name: '정령력', color: '#7be38a', regen: 4, hit: 2, kill: 4 },
  },
  golem: {
    name: '골렘족', origin: '산맥',
    desc: '돌로 된 몸. 받는 물리 피해 -15%, 밀려나지 않는다. 맞을수록, 시간이 지날수록 암석 에너지가 쌓인다.',
    strong: '체력 · 물리 저항 · 근력', weak: '아주 느림 · 회피 없음',
    base: { str: 13, mag: 4, agi: 3, vit: 17, sen: 5, spi: 7, pres: 18, mres: 9 },
    growth: { vit: 1 },
    mult: {}, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '바위 몸',
    res: { key: 'stone', name: '암석 에너지', color: '#c8b088', regen: 2, hit: 2, kill: 4, hurt: 100 },
  },
  dragon: {
    name: '용족', origin: '화산',
    desc: '불을 다루는 고대 혈통. 화상에 면역이고, 불타는 적에게 주는 피해 +15%. 불타는 적이 있을 때 용기가 차오른다.',
    strong: '근력 · 마력 · 마법 저항', weak: '냉기에 약함 (받는 냉기 피해·둔화 증가)',
    base: { str: 13, mag: 13, agi: 7, vit: 11, sen: 6, spi: 7, pres: 7, mres: 9 },
    growth: { str: 1 },
    mult: { str: 1.05, mag: 1.05, mres: 1.1, agi: 0.85 }, // 능력치 비율 보정 (높아지는 것 · 낮아지는 것)
    passive: '용의 피',
    res: { key: 'dragon', name: '용기', color: '#ff6a2a', hit: 2, kill: 5, burnTick: 1, decay: 2 },
  },
};

// 예전 저장 데이터의 종족 이름 변환
export const RACE_MIGRATE = { human: 'knight', dwarf: 'knight', beast: 'dino' };

export const POINTS_PER_LEVEL = 3;
export function xpToNext(level) { return 20 + level * 18; }

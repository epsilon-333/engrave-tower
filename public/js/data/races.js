// 종족: 기본 스탯, 레벨당 자동 성장, 고유 메커니즘, 강점과 약점
export const RACES = {
  knight: {
    name: '기사', origin: '인간',
    desc: '오러를 모았다가 터뜨린다. 오러 게이지가 가득 차면 R로 발동해 5초간 모든 공격이 적의 물리 저항 50%를 무시한다. 단단하지만 느리다.',
    strong: '근력 · 체력 · 물리 저항', weak: '느림 · 마력 낮음',
    base: { str: 15, mag: 3, agi: 6, vit: 15, sen: 8, spi: 8, pres: 14, mres: 8 },
    growth: { pres: 1 },
    passive: '오러', resource: 'aura',
  },
  wizard: {
    name: '마법사', origin: '인간',
    desc: '주문을 증폭한다. 최대 마나 +50%, 마나 회복 +30%, 원소 반응 피해 +50%, 무기 스킬 쿨타임 -25%. 몸이 가장 약하다.',
    strong: '마력 · 정신 · 마나', weak: '체력과 물리 저항이 가장 낮음',
    base: { str: 3, mag: 18, agi: 8, vit: 6, sen: 9, spi: 14, pres: 3, mres: 10 },
    growth: { mag: 1 },
    passive: '주문 증폭', resource: 'mana',
  },
  elf: {
    name: '엘프', origin: '숲',
    desc: '정밀 사격. 멀리서 맞힐수록 투사체 피해가 커지고(최대 +30%), 쏘는 동안 느려지는 정도가 절반이다.',
    strong: '민첩 · 감각', weak: '체력 낮음 · 가까이에서 약함',
    base: { str: 7, mag: 11, agi: 16, vit: 7, sen: 14, spi: 9, pres: 4, mres: 8 },
    growth: { agi: 1 },
    passive: '정밀 사격',
  },
  orc: {
    name: '오크', origin: '황야',
    desc: '분노 게이지. 때리거나 맞으면 차오르고, 가득 차면 6초간 광폭화해 공격 속도 +30%, 흡혈 +8%.',
    strong: '근력 · 체력', weak: '마력 거의 없음 · 마법 저항 낮음',
    base: { str: 17, mag: 2, agi: 8, vit: 11, sen: 6, spi: 5, pres: 5, mres: 3 },
    growth: { vit: 1 },
    passive: '분노', resource: 'rage',
  },
  beast: {
    name: '수인', origin: '초원',
    desc: '사냥 본능. 연타할수록 공격 속도(최대 +40%)와 피해(최대 +15%)가 오르고, 대시를 2번 연속 쓸 수 있다.',
    strong: '민첩 · 감각', weak: '저항 전반이 낮음',
    base: { str: 11, mag: 4, agi: 17, vit: 9, sen: 14, spi: 6, pres: 5, mres: 5 },
    growth: { agi: 1 },
    passive: '사냥 본능',
  },
  undead: {
    name: '언데드', origin: '묘지',
    desc: '썩은 몸. 독과 출혈에 면역이다. 마법 피해 +12%. 일반 회복은 절반만 받지만, 적을 처치할 때마다 생명력 6%와 마나를 흡수한다.',
    strong: '정신 · 마력 · 독 면역', weak: '회복이 처치에 묶임 · 느림',
    base: { str: 8, mag: 14, agi: 6, vit: 12, sen: 6, spi: 14, pres: 8, mres: 12 },
    growth: { mag: 1 },
    passive: '썩은 몸',
  },
};

// 예전 저장 데이터의 종족 이름 변환
export const RACE_MIGRATE = { human: 'knight', dwarf: 'knight' };

export const POINTS_PER_LEVEL = 3;
export function xpToNext(level) { return 20 + level * 18; }

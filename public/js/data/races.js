// 종족: 기본 스탯, 레벨당 자동 성장, 고유 특성
export const RACES = {
  human: {
    name: '인간', desc: '모든 스탯이 평범하다. 보조 각인 슬롯을 하나 더 가지며, 레벨마다 스탯 포인트를 1 더 받는다. 서로 다른 태그를 5종 이상 모으면 모든 피해 +15%.',
    base: { str: 10, mag: 10, agi: 10, vit: 10, sen: 10, spi: 10, pres: 8, mres: 8 },
    growth: {}, bonusPoints: 1,
    passive: '다재다능',
    extraSlot: true,
    palette: { s: '#f2c39b', h: '#6b4026', a: '#3f6fd1', b: '#28437f', e: '#1a1a1a' },
  },
  elf: {
    name: '엘프', desc: '민첩과 마력이 높고 몸이 약하다. 투사체 사거리·속도 +30%, 투사체 피해 +20%.',
    base: { str: 6, mag: 16, agi: 14, vit: 8, sen: 12, spi: 10, pres: 4, mres: 10 },
    growth: { mag: 1 },
    passive: '바람의 눈',
    palette: { s: '#f6dcc0', h: '#f2d36b', a: '#3f9b5a', b: '#26603a', e: '#1f4f7a' },
  },
  dwarf: {
    name: '드워프', desc: '근력과 체력이 높고 느리다. 장비에서 얻는 스탯 1.5배.',
    base: { str: 16, mag: 6, agi: 5, vit: 16, sen: 8, spi: 10, pres: 14, mres: 10 },
    growth: { pres: 1 },
    passive: '대장장이의 피',
    palette: { s: '#e8b08a', h: '#c4612a', a: '#7a5a3a', b: '#4f3a26', e: '#1a1a1a' },
  },
  orc: {
    name: '오크', desc: '근력이 매우 높고 마력이 낮다. 잃은 HP에 비례해 피해 최대 +35%.',
    base: { str: 15, mag: 2, agi: 8, vit: 15, sen: 6, spi: 6, pres: 8, mres: 4 },
    growth: { vit: 1 },
    passive: '피의 분노',
    palette: { s: '#7fb24a', h: '#2d2d2d', a: '#8a3b2a', b: '#5a2418', e: '#ffdd44' },
  },
  beast: {
    name: '수인', desc: '민첩과 감각이 높다. 적을 연속으로 때릴수록 공격 속도와 피해가 오른다 (최대 +40% / +15%).',
    base: { str: 12, mag: 4, agi: 18, vit: 10, sen: 14, spi: 6, pres: 6, mres: 6 },
    growth: { agi: 1 },
    passive: '사냥 본능',
    palette: { s: '#c99a6b', h: '#8f8f96', a: '#5a4a3a', b: '#3a2e24', e: '#ffcc22' },
  },
  undead: {
    name: '언데드', desc: '일반 회복이 절반만 들어오지만 적을 처치할 때마다 최대 HP 6%를 흡수한다. 상태이상 저항 +25%, 마법 피해 +15%.',
    base: { str: 8, mag: 14, agi: 6, vit: 12, sen: 6, spi: 14, pres: 8, mres: 12 },
    growth: { mag: 1 },
    passive: '죽음의 굶주림',
    palette: { s: '#b8c4b0', h: '#3a3a4a', a: '#5b3a7a', b: '#3a2450', e: '#ff4a4a' },
  },
};

export const POINTS_PER_LEVEL = 3;
export function xpToNext(level) { return 20 + level * 18; }

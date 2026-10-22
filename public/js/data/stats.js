// 스탯 정의, 구간 효율, 각성. 서버와 클라이언트가 함께 쓰는 순수 데이터.

export const BASE_STATS = ['str', 'mag', 'agi', 'vit', 'sen', 'spi', 'pres', 'mres'];

export const STAT_INFO = {
  str: { name: '근력', short: '근', desc: '물리 공격력, 무거운 장비 착용' },
  mag: { name: '마력', short: '마', desc: '마법 공격력, 화상 피해' },
  agi: { name: '민첩', short: '민', desc: '회피 (20 → 7% · 60 → 16% · 최대 45%), 공격 속도 (최대 +70%), 이동 속도 (최대 +30% · 높을수록 덜 오른다)' },
  vit: { name: '체력', short: '체', desc: '최대 HP, 자연 회복' },
  sen: { name: '감각', short: '감', desc: '치명타 확률 · 피해, 약점 찌르기(방어 무시 최대 30%), 숨은 상자를 멀리서 알아챈다' },
  spi: { name: '정신', short: '정', desc: '상태이상 저항·지속 감소, 쿨타임, 각인 부하 한도 (10마다 +1)' },
  pres: { name: '물리 저항', short: '물저', desc: '받는 물리 피해 감소' },
  mres: { name: '마법 저항', short: '마저', desc: '받는 마법 피해 감소' },
};

export const SPECIAL_INFO = {
  lifesteal: { name: '흡혈', unit: '%' },
  reflect: { name: '반사', unit: '%' },
  toxicity: { name: '독성', unit: '' },
  fireAff: { name: '화염 친화', unit: '' },
  iceAff: { name: '냉기 친화', unit: '' },
  pierce: { name: '관통', unit: '%' },
  tenacity: { name: '강인함', unit: '' },
};

// 스탯이 높을수록 포인트당 가치가 커진다 → 한쪽으로 몰수록 강해짐
export const TIERS = [[20, 1.0], [40, 1.3], [60, 1.7], [Infinity, 2.2]];

export function eff(v) {
  let total = 0, prev = 0;
  for (const [cap, m] of TIERS) {
    if (v <= prev) break;
    total += (Math.min(v, cap) - prev) * m;
    prev = cap;
  }
  return Math.max(0, total);
}

// 스탯 각성: 30/50/70/90 도달 시 열림. 고르게 올리면 하나도 못 연다.
export const AWAKENINGS = {
  str: [
    { at: 30, name: '단련', desc: '물리 공격력 +10%', effects: [{ type: 'mul', key: 'physAtk', v: 1.1 }] },
    { at: 50, name: '강타', desc: '4번째 공격마다 피해 2배', effects: [{ type: 'flag', flag: 'heavyHit' }] },
    { at: 70, name: '괴력', desc: '물리 공격력 +15%, 넉백 강화', effects: [{ type: 'mul', key: 'physAtk', v: 1.15 }, { type: 'add', key: 'knockback', v: 80 }] },
    { at: 90, name: '파쇄', desc: '적 물리 저항 25% 무시', effects: [{ type: 'add', key: 'physPen', v: 0.25 }] },
  ],
  mag: [
    { at: 30, name: '마력 각성', desc: '마법 공격력 +10%', effects: [{ type: 'mul', key: 'magAtk', v: 1.1 }] },
    { at: 50, name: '원소 이해', desc: '원소 반응 피해 +50%', effects: [{ type: 'mul', key: 'reactionMul', v: 1.5 }] },
    { at: 70, name: '마력 폭주', desc: '마법 투사체가 작게 폭발', effects: [{ type: 'flag', flag: 'magicBurst' }] },
    { at: 90, name: '대마도', desc: '적 마법 저항 25% 무시, 마법 공격력 +10%', effects: [{ type: 'add', key: 'magPen', v: 0.25 }, { type: 'mul', key: 'magAtk', v: 1.1 }] },
  ],
  agi: [
    { at: 30, name: '경쾌', desc: '이동 속도 +15%, 대시 쿨타임 -10%', effects: [{ type: 'mul', key: 'moveSpeed', v: 1.15 }, { type: 'mul', key: 'dashCd', v: 0.9 }] },
    { at: 50, name: '날렵함', desc: '회피 +5%, 대시 쿨타임 -15%', effects: [{ type: 'add', key: 'dodge', v: 0.05 }, { type: 'mul', key: 'dashCd', v: 0.85 }] },
    { at: 70, name: '연격', desc: '공격 속도 +20%', effects: [{ type: 'mul', key: 'atkSpeed', v: 1.2 }] },
    { at: 90, name: '질풍', desc: '30% 확률로 한 번 더 공격', effects: [{ type: 'flag', flag: 'doubleAttack' }] },
  ],
  vit: [
    { at: 30, name: '재생', desc: '초당 최대 HP 0.5% 회복', effects: [{ type: 'add', key: 'regen', v: 0.005 }] },
    { at: 50, name: '거구', desc: '최대 HP +20%', effects: [{ type: 'mul', key: 'maxHp', v: 1.2 }] },
    { at: 70, name: '철혈', desc: '받는 피해 -10%', effects: [{ type: 'mul', key: 'dmgTakenMul', v: 0.9 }] },
    { at: 90, name: '불굴', desc: '치명상을 1 HP로 버팀 (90초마다)', effects: [{ type: 'flag', flag: 'lastStand' }] },
  ],
  sen: [
    { at: 30, name: '예리함', desc: '치명타 확률 +5%', effects: [{ type: 'add', key: 'crit', v: 0.05 }] },
    { at: 50, name: '약점 간파', desc: '치명타가 적에게 표식(+20% 피해)', effects: [{ type: 'flag', flag: 'markOnCrit' }] },
    { at: 70, name: '급소', desc: '치명타 피해 +50%', effects: [{ type: 'add', key: 'critDmg', v: 0.5 }] },
    { at: 90, name: '마무리', desc: 'HP 30% 이하인 적에게 주는 피해 +25%', effects: [{ type: 'add', key: 'lowHunt', v: 0.25 }] },
  ],
  spi: [
    { at: 30, name: '평정', desc: '받는 상태이상 지속 -30%, 얻는 종족 자원 +10%', effects: [{ type: 'add', key: 'statusRes', v: 0.3 }, { type: 'mul', key: 'resGain', v: 1.1 }] },
    { at: 50, name: '정화', desc: '8초마다 상태이상 해제', effects: [{ type: 'flag', flag: 'cleanse' }] },
    { at: 70, name: '절약', desc: '스킬에 쓰는 종족 자원 -30%', effects: [{ type: 'mul', key: 'costMul', v: 0.7 }] },
    { at: 90, name: '명경지수', desc: '상태이상 면역', effects: [{ type: 'flag', flag: 'statusImmune' }] },
  ],
  pres: [
    { at: 40, name: '철벽', desc: '물리 공격 15% 확률로 완전 방어', effects: [{ type: 'flag', flag: 'blockPhys' }] },
    { at: 70, name: '가시 갑주', desc: '반사 +10%', effects: [{ type: 'add', key: 'reflect', v: 10 }] },
  ],
  mres: [
    { at: 40, name: '마력 결계', desc: '마법 공격 15% 확률로 완전 방어', effects: [{ type: 'flag', flag: 'blockMag' }] },
    { at: 70, name: '역류', desc: '마법 피해를 받으면 주변에 냉기 파동', effects: [{ type: 'on', event: 'hurtMag', chance: 1, action: { aoe: { r: 50, mul: 0.5, type: 'mag', status: 'chill' } } }] },
  ],
};

// 극한: 가장 높은 기본 스탯이 두 번째의 2배 이상 → 주력 스탯 +20%
export const EXTREME = { ratio: 2, bonus: 0.15 };

export const SLOT_INFO = {
  head: '머리', arm: '팔', heart: '심장', leg: '다리', back: '등', extra: '보조',
};

export const GRADES = [
  null,
  { name: '회색', color: '#a0a4ab' },
  { name: '초록', color: '#6fd06a' },
  { name: '파랑', color: '#5aa8ff' },
  { name: '보라', color: '#c27bff' },
  { name: '금색', color: '#ffc84a' },
];

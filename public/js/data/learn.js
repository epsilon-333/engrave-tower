// 세상에서 배우는 기술: 클래스 스킬 말고도 누구나 배워서 Q·E·R·F에 넣는다. 무기에 따라 쓸 수 있는지는 skills.js FIT 를 따른다.
// where: dojo 수련장 교관(무기술 · 골드) · library 서고 사서(마법 · 골드) · tablet 옛 기술 석판(그 자리에서) · turtle 바닷가 자라 · spirit 물의 정령
// lv: 배울 수 있는 레벨 (도감 레벨)
export const LEARN = {
  // ── 수련장: 무기술 ──
  sweep: { where: 'dojo', gold: 300, lv: 4 }, dashSlash: { where: 'dojo', gold: 300, lv: 4 }, swordWave: { where: 'dojo', gold: 500, lv: 8 }, crushBlow: { where: 'dojo', gold: 600, lv: 10 },
  chargeSmash: { where: 'dojo', gold: 300, lv: 3 }, crushingBlows: { where: 'dojo', gold: 500, lv: 7 }, groundSmash: { where: 'dojo', gold: 500, lv: 8 },
  rapidThrow: { where: 'dojo', gold: 400, lv: 5 }, greatAxe: { where: 'dojo', gold: 600, lv: 9 },
  ambush: { where: 'dojo', gold: 400, lv: 5 }, weakMark: { where: 'dojo', gold: 300, lv: 3 }, stealth: { where: 'dojo', gold: 600, lv: 9 }, smokeBomb: { where: 'dojo', gold: 400, lv: 6 }, snare: { where: 'dojo', gold: 300, lv: 3 },
  dartFan: { where: 'dojo', gold: 500, lv: 7 }, pierceArrow: { where: 'dojo', gold: 400, lv: 4 }, pushArrow: { where: 'dojo', gold: 300, lv: 3 }, aimedShot: { where: 'dojo', gold: 500, lv: 7 },
  riposte: { where: 'dojo', gold: 400, lv: 5 }, shieldCharge: { where: 'dojo', gold: 300, lv: 3 }, provoke: { where: 'dojo', gold: 300, lv: 3 }, shieldBash: { where: 'dojo', gold: 500, lv: 7 }, ironWall: { where: 'dojo', gold: 500, lv: 8 },
  warCry: { where: 'dojo', gold: 300, lv: 3 }, braceForIt: { where: 'dojo', gold: 400, lv: 5 }, steadfast: { where: 'dojo', gold: 400, lv: 5 }, berserkSkill: { where: 'dojo', gold: 700, lv: 11 },
  // ── 서고: 마법 ──
  flameBurst: { where: 'library', gold: 400, lv: 3 }, frostChain: { where: 'library', gold: 500, lv: 5 }, lightningChain: { where: 'library', gold: 600, lv: 7 }, elemMark: { where: 'library', gold: 300, lv: 3 },
  arcaneBarrage: { where: 'library', gold: 500, lv: 5 }, blinkBlast: { where: 'library', gold: 600, lv: 7 }, slowField: { where: 'library', gold: 600, lv: 8 }, rewind: { where: 'library', gold: 800, lv: 10 }, gravityCollapse: { where: 'library', gold: 900, lv: 12 },
  curse: { where: 'library', gold: 300, lv: 3 }, painLink: { where: 'library', gold: 500, lv: 6 }, retribution: { where: 'library', gold: 500, lv: 6 }, deathFog: { where: 'library', gold: 600, lv: 8 },
  waterBreath: { where: 'library', gold: 700, lv: 6 },
  // ── 옛 기술 석판 (그 지역 깊은 곳에서 읽으면 배운다) ──
  enchantFire: { where: 'tablet', biome: 'volcano' }, enchantIce: { where: 'tablet', biome: 'snow' }, enchantLightning: { where: 'tablet', biome: 'mountains' }, enchantPoison: { where: 'tablet', biome: 'swamp' },
  windStep: { where: 'tablet', biome: 'meadow' }, shadowStep: { where: 'tablet', biome: 'ruins' }, vineSnare: { where: 'tablet', biome: 'forest' }, retreatShot: { where: 'tablet', biome: 'jungle' },
  harpoon: { where: 'tablet', biome: 'coast' }, leap: { where: 'tablet', biome: 'wasteland' },
  // ── 바닷가의 자라 (물고기 10종을 낚아 보면) ──
  dive: { where: 'turtle', fish: 10 },
};
export const WHERE_NAME = { dojo: '수련장 교관 가르', library: '서고 사서 에일', tablet: '옛 기술 석판', turtle: '바닷가의 자라', spirit: '거울 호수의 물의 정령' };
// 늘 켜져 있는 능력 (장착하지 않는다)
export const ABILITIES = {
  waterBlessing: { name: '물의 가호', where: 'spirit', desc: '깊은 물에서 헤엄치고, 헤엄치다 G로 바닷속에 들어간다. 물속 숨 45초 · 헤엄 속도 +40%.' },
};
export const TABLET_BIOME_NAME = { volcano: '화산 지대', snow: '서리 설원', mountains: '북쪽 바위산', swamp: '독늪', meadow: '꽃바람 들판', ruins: '폐허 도시', forest: '이끼 숲', jungle: '원시림', coast: '남쪽 해안', wasteland: '메마른 황야' };
// 물속 숨 (초): 잠수만 배웠으면 20초, 물의 가호가 있으면 45초. 음식 '긴 숨'은 곱한다. 수중 호흡 중에는 줄지 않는다
export const BREATH = { dive: 20, blessing: 45 };

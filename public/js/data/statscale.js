// 스탯 계수: 스킬 · 무기마다 따라가는 스탯이 하나 있다. 그 스탯이 높을수록 세지고, 일정 값을 넘으면 능력이 열린다.
// 클래스마다 주력 스탯이 달라서 종족 · 클래스마다 올리면 좋은 스탯이 다르다.
import { SKILLS, CLASSES } from './skills.js';

// 클래스 주력 스탯 [공격 스킬, 방어 · 준비 · 강화 · 제어 스킬]
export const CLASS_STATS = {
  predator: ['agi', 'str'], behemoth: ['vit', 'str'],
  elementalist: ['mag', 'spi'], chronomancer: ['spi', 'mag'],
  guardian: ['pres', 'vit'], greatsword: ['str', 'vit'],
  berserker: ['str', 'agi'], thrower: ['agi', 'str'],
  necromancer: ['spi', 'mag'], hexer: ['mag', 'sen'],
  shadowblade: ['agi', 'sen'], venomHunter: ['sen', 'agi'],
  spiritcaller: ['spi', 'agi'], ranger: ['sen', 'agi'],
  rockguard: ['pres', 'vit'], frostGolem: ['vit', 'mag'],
  dragoon: ['str', 'mres'], dragonSage: ['mag', 'vit'],
};
const SUPPORT = new Set(['방어', '준비', '강화', '제어', '소환']);
const SKILL_CLASS = {};
for (const [cid, c] of Object.entries(CLASSES)) for (const id of c.skills) SKILL_CLASS[id] ||= cid;

// 이 스킬이 따라가는 스탯
export function skillStat(id, cls) {
  const sk = SKILLS[id]; if (!sk) return null;
  const own = CLASS_STATS[SKILL_CLASS[id]] || CLASS_STATS[cls];
  if (own) return SUPPORT.has(sk.role) ? own[1] : own[0];
  return sk.scale === 'mag' ? 'mag' : sk.scale === 'phys' ? 'str' : (CLASS_STATS[cls]?.[0] || 'str');
}
// 무기 계열이 따라가는 스탯 (평타 · 우클릭 무기 기술)
const WEAPON_STAT = { blade: 'str', axe: 'str', polearm: 'agi', blunt: 'vit', great: 'str', bow: 'sen', throw: 'agi', staff: 'mag', tome: 'spi', fist: 'agi', shield: 'pres', tube: 'sen' };
export function weaponStat(it) {
  const w = it?.weapon; if (!w) return 'str';
  if (w.scale === 'agi') return 'agi';
  const cat = w.cat || it.cat || (w.kind === 'proj' ? (w.dmg === 'mag' ? 'staff' : 'bow') : 'blade');
  return WEAPON_STAT[cat] || (w.dmg === 'mag' ? 'mag' : 'str');
}

// 계수: 스탯 25에서 1배, 스탯 1마다 +0.6% (75 → 1.3배 · 100 → 1.45배)
export const statMul = (v) => Math.max(0.85, 0.85 + 0.006 * (v || 0));
// 스탯 개방: 40 이상 피해 +15% · 70 이상 재사용 -20% (무기는 50 이상 평타 피해 +15% · 80 이상 공격 속도 +10%)
export const SKILL_PERKS = [{ at: 40, dmg: 1.15, text: '피해 +15%' }, { at: 70, cd: 0.8, text: '재사용 -20%' }];
export const WEAPON_PERKS = [{ at: 50, dmg: 1.15, text: '평타 · 무기 기술 피해 +15%' }, { at: 80, spd: 1.1, text: '공격 속도 +10%' }];
export function skillScale(id, b) {
  const st = skillStat(id, b.cls), v = b.stats?.[st] || 0;
  let dmg = statMul(v), cd = 1;
  for (const pk of SKILL_PERKS) if (v >= pk.at) { if (pk.dmg) dmg *= pk.dmg; if (pk.cd) cd *= pk.cd; }
  return { stat: st, v, dmg, cd };
}
export function weaponScale(b) {
  const st = weaponStat(b.weaponItem), v = b.stats?.[st] || 0;
  let dmg = statMul(v), spd = 1;
  for (const pk of WEAPON_PERKS) if (v >= pk.at) { if (pk.dmg) dmg *= pk.dmg; if (pk.spd) spd *= pk.spd; }
  return { stat: st, v, dmg, spd };
}

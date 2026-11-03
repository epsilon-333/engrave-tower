// 각인을 무기 종류로 찾기: 한 각인이 여러 무기에 들어간다.
// ① 그 각인 스킬의 원래 주인 클래스가 드는 무기 ② 스킬이 베기 · 찌르기 · 쏘기처럼 무기를 타면 그 무기를 90% 이상 힘으로 쓰는 종류
// ③ 둘 다 없으면(몸으로 쓰는 각인 전용 스킬) 마법이면 지팡이 · 마도서, 물리면 각인 태그에 어울리는 무기
import { SKILLS, CLASSES, ENGRAVING_SKILLS, FIT } from './skills.js';
import { ITEMS, weaponCat } from './items.js';
import { ENGRAVINGS } from './engravings.js';

const CATS = ['blade', 'great', 'axe', 'blunt', 'polearm', 'scythe', 'whip', 'fist', 'shield', 'throw', 'bow', 'tube', 'staff', 'tome'];
const TAG_WEAPON = { fire: ['polearm', 'staff'], ice: ['blunt', 'staff'], poison: ['tube', 'blade'], bleed: ['blade', 'fist', 'axe'], drain: ['scythe', 'axe'], wind: ['bow', 'blade', 'throw'], giant: ['blunt', 'great', 'shield'], reflect: ['shield'], slime: ['blunt', 'shield'], shadow: ['blade', 'fist', 'tube'], curse: ['tome', 'scythe'], undying: ['scythe', 'shield'], brawl: ['axe', 'great', 'fist'] };
const cache = {};
export function engravingWeapons(eid) {
  if (cache[eid]) return cache[eid];
  const sid = ENGRAVING_SKILLS[eid], def = SKILLS[sid], out = new Set();
  if (!def) return (cache[eid] = []);
  for (const c of Object.values(CLASSES)) if (c.skills.includes(sid)) for (const w of c.weapons) out.add(weaponCat(ITEMS[w]));
  const kind = def.kind || 'body';
  if (kind !== 'body') { const t = FIT[kind] || {}; for (const c of CATS) if ((t[c] ?? t._ ?? 0) >= 0.9) out.add(c); }
  if (!out.size) {
    if (def.scale === 'mag' || def.scale === 'best') { out.add('staff'); out.add('tome'); }
    if (def.scale !== 'mag') for (const t of ENGRAVINGS[eid]?.tags || []) for (const c of TAG_WEAPON[t] || []) out.add(c);
    if (!out.size) for (const c of ['blade', 'great', 'axe', 'blunt']) out.add(c);
  }
  return (cache[eid] = CATS.filter((c) => out.has(c)));
}

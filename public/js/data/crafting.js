// 무기 만들기: 종류(검 · 도끼 · 망치 · 창 · 낫 · 채찍 · 활 · 석궁 · 부메랑 · 지팡이 …) + 재료(나무 · 돌 · 뼈 · 구리 · 철 …) + 몬스터 부산물 2개까지.
// 재료는 위력과 무게를, 부산물은 그 몬스터를 닮은 능력을 준다. 같은 부산물을 두 개 넣으면 능력이 깊어지고,
// 서로 다른 둘이 맞물리면 조합 능력이 하나 더 붙는다. 집 작업대는 나무 · 돌 · 뼈만, 대장간은 모든 재료를 다룬다.
import { GOODS } from './goods.js';

// cat: 스킬과 맞는지 보는 무기 갈래 (skills.js FIT) · art: 그림 · weapon: 기본 성능 · mats: 쓸 수 있는 재료 · need: 주재료 수 · handle: 손잡이 나무 수
const ALL = ['wood', 'stone', 'bone', 'hardwood', 'copper', 'iron', 'coral', 'silver', 'gold', 'crystal', 'obsidian'];
const METAL = ['stone', 'bone', 'copper', 'iron', 'coral', 'silver', 'gold', 'crystal', 'obsidian'];
export const WTYPES = {
  sword: { name: '검', cat: 'blade', art: { s: 'weapon_regular_sword' }, mats: ALL, need: 4, handle: 1, gold: 20, desc: '한 손으로 휘두르는 검. 무난하다.', weapon: { kind: 'melee', dmg: 'phys', mul: 1.0, speed: 1.6, range: 30, arc: 1.9, skill: 'spin' } },
  dagger: { name: '단검', cat: 'blade', art: { s: 'weapon_knife' }, mats: ALL, need: 2, handle: 1, gold: 15, desc: '빠르게 찌르고 벤다. 민첩으로 세진다.', weapon: { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.72, speed: 2.9, range: 24, arc: 1.5, skill: 'dashStab' } },
  greatsword: { name: '대검', cat: 'great', art: { s: 'weapon_greatsword', great: true }, mats: METAL, need: 7, handle: 2, gold: 40, desc: '몸 둘레를 크게 돌려 벤다. 느리지만 묵직하다.', weapon: { kind: 'melee', dmg: 'phys', mul: 1.45, speed: 0.9, range: 40, arc: 2.4, skill: 'slam', great: true } },
  axe: { name: '도끼', cat: 'axe', art: { s: 'weapon_axe' }, mats: ALL, need: 4, handle: 2, gold: 20, desc: '찍어 내리는 도끼. 던지는 기술과도 잘 맞는다.', weapon: { kind: 'melee', dmg: 'phys', mul: 1.2, speed: 1.3, range: 30, arc: 2.0, skill: 'spin' } },
  hammer: { name: '망치', cat: 'blunt', art: { s: 'weapon_hammer' }, mats: METAL, need: 6, handle: 2, gold: 30, desc: '맞힐 때마다 갑옷을 부순다 (방어 -5%씩, 최대 5중첩).', weapon: { kind: 'melee', dmg: 'phys', mul: 1.4, speed: 0.95, range: 32, arc: 2.2, armorBreak: true, skill: 'slam' } },
  club: { name: '곤봉', cat: 'blunt', art: { s: 'weapon_baton_with_spikes' }, mats: ['wood', 'hardwood', 'bone', 'stone', 'copper', 'iron'], need: 4, handle: 0, gold: 10, desc: '투박하지만 세게 때린다.', weapon: { kind: 'melee', dmg: 'phys', mul: 1.2, speed: 1.15, range: 30, arc: 2.0, skill: 'slam' } },
  spear: { name: '창', cat: 'polearm', art: { s: 'weapon_spear', spear: true }, mats: ALL, need: 3, handle: 3, gold: 25, desc: '멀리 곧게 찌른다. 던지는 기술도 쓸 수 있다.', weapon: { kind: 'melee', dmg: 'phys', mul: 1.15, speed: 1.35, range: 46, shape: 'thrust', width: 10, skill: 'dashStab' } },
  halberd: { name: '도끼창', cat: 'polearm', art: { s: 'cw_halberd', spear: true }, mats: METAL, need: 5, handle: 3, gold: 40, desc: '넓은 날로 길게 찌르고 갑옷을 부순다.', weapon: { kind: 'melee', dmg: 'phys', mul: 1.35, speed: 1.05, range: 48, shape: 'thrust', width: 14, armorBreak: true, skill: 'whirl' } },
  scythe: { name: '낫', cat: 'scythe', art: { s: 'cw_scythe', long: true }, mats: METAL, need: 5, handle: 3, gold: 35, desc: '긴 날로 앞쪽을 아주 넓게 베어 낸다.', weapon: { kind: 'melee', dmg: 'phys', mul: 1.25, speed: 1.1, range: 40, arc: 2.8, skill: 'whirl' } },
  whip: { name: '채찍', cat: 'whip', art: { s: 'cw_whip', whip: true }, mats: ['wood', 'bone', 'hardwood', 'copper', 'iron', 'silver'], need: 3, handle: 1, gold: 25, desc: '아주 멀리 닿는다. 채찍 끝(사거리 70% 너머)에 맞으면 피해 1.5배.', weapon: { kind: 'melee', dmg: 'phys', mul: 0.85, speed: 1.7, range: 74, shape: 'whip', width: 9, skill: 'lash' } },
  knuckle: { name: '너클', cat: 'fist', art: { s: 'cw_knuckle', fist: true }, mats: METAL, need: 3, handle: 0, gold: 20, desc: '주먹으로 두 번씩 빠르게 친다. 민첩으로 세진다.', weapon: { scale: 'agi', kind: 'melee', dmg: 'phys', mul: 0.5, hits: 2, speed: 2.6, range: 22, arc: 1.6, skill: 'flurry' } },
  swordShield: { name: '검과 방패', cat: 'shield', art: { s: 'weapon_regular_sword', shield: true }, mats: METAL, need: 6, handle: 2, gold: 40, desc: '방패를 든다: 앞에서 오는 피해 -20%, 방패 기술을 쓸 수 있다.', stats: { pres: 6 }, weapon: { kind: 'melee', dmg: 'phys', mul: 0.95, speed: 1.5, range: 30, arc: 1.9, skill: 'spin', guard: 0.2 } },
  bow: { name: '활', cat: 'bow', art: { s: 'weapon_bow', bow: true }, mats: ['wood', 'hardwood', 'bone'], need: 4, handle: 2, gold: 25, desc: '화살을 쏜다. 쏘기 기술을 쓸 수 있다.', weapon: { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 1.3, speed: 1.6, projSpeed: 300, range: 210, pierce: 1, skill: 'volley' } },
  crossbow: { name: '석궁', cat: 'bow', art: { s: 'cw_crossbow', crossbow: true }, mats: ['wood', 'hardwood', 'copper', 'iron', 'silver', 'obsidian'], need: 4, handle: 3, gold: 45, desc: '느리지만 강한 쇠살이 셋까지 꿰뚫는다.', weapon: { kind: 'proj', dmg: 'phys', mul: 2.1, speed: 0.75, projSpeed: 430, range: 250, pierce: 3, skill: 'rain', projKind: 'bolt' } },
  boomerang: { name: '부메랑', cat: 'throw', art: { s: 'cw_boomerang', thrown: true }, mats: ['wood', 'hardwood', 'bone', 'copper', 'iron'], need: 3, handle: 0, gold: 20, desc: '던지면 날아갔다 돌아오며 두 번 벤다.', weapon: { kind: 'proj', dmg: 'phys', mul: 1.05, speed: 1.4, projSpeed: 240, range: 130, boomerang: true, skill: 'boomStorm', projKind: 'boomerang' } },
  knives: { name: '투척 단검', cat: 'throw', art: { s: 'weapon_knife', thrown: true }, mats: METAL, need: 3, handle: 0, gold: 25, desc: '단검 세 자루를 부채꼴로 던진다.', weapon: { scale: 'agi', kind: 'proj', dmg: 'phys', mul: 0.48, count: 3, spread: 0.14, speed: 1.9, projSpeed: 380, range: 180, skill: 'knifeFan', projKind: 'knife' } },
  staff: { name: '지팡이', cat: 'staff', art: { s: 'weapon_green_magic_staff' }, mats: ['wood', 'hardwood', 'bone', 'crystal', 'silver', 'gold'], need: 3, handle: 2, gold: 30, desc: '마력 구슬을 쏜다 (마나). 마법 스킬과 잘 맞는다.', weapon: { kind: 'proj', dmg: 'mag', mul: 1.5, speed: 1.5, projSpeed: 250, range: 190, splash: 24, mana: 5, skill: 'nova' } },
  orb: { name: '마법 구슬', cat: 'staff', art: { s: 'cw_orb', orb: true }, mats: ['crystal', 'silver', 'gold', 'obsidian', 'coral', 'stone'], need: 3, handle: 0, gold: 40, desc: '적을 쫓아가는 마력탄을 쏜다 (마나).', weapon: { kind: 'proj', dmg: 'mag', mul: 1.1, speed: 1.7, projSpeed: 200, range: 200, homing: true, mana: 4, skill: 'meteor' } },
  tome: { name: '마도서', cat: 'tome', art: { s: 'cw_tome', tome: true }, mats: ['wood', 'hardwood', 'crystal', 'silver', 'gold'], need: 2, handle: 0, gold: 40, desc: '마력탄 세 발을 흩뿌린다 (마나). 마법 스킬과 잘 맞는다.', weapon: { kind: 'proj', dmg: 'mag', mul: 0.62, count: 3, spread: 0.2, splash: 18, speed: 1.4, projSpeed: 230, range: 180, mana: 6, skill: 'nova' } },
};
// 재료: tier 단계 · mul 위력 · speed 빠르기 · bench 집 작업대에서도 다룬다 · tint 그림 색
export const WMATS = {
  wood: { name: '나무', good: 'wood', tier: 1, mul: 0.82, speed: 1.06, bench: true, tint: 'sepia(0.95) saturate(1.3) hue-rotate(-14deg) brightness(0.9)' },
  stone: { name: '돌', good: 'stone', tier: 1, mul: 0.95, speed: 0.94, bench: true, tint: 'grayscale(1) brightness(0.86) contrast(1.1)' },
  bone: { name: '뼈', good: 'bone', tier: 1, mul: 0.9, speed: 1.02, crit: 0.03, bench: true, tint: 'grayscale(0.6) sepia(0.35) brightness(1.35)' },
  hardwood: { name: '단단한 나무', good: 'hardwood', tier: 2, mul: 1.0, speed: 1.04, bench: true, tint: 'sepia(1) saturate(1.5) hue-rotate(-20deg) brightness(0.7)' },
  copper: { name: '구리', good: 'copperOre', tier: 2, mul: 1.0, speed: 1, tint: 'sepia(1) saturate(2.3) hue-rotate(-12deg)' },
  iron: { name: '철', good: 'ironOre', tier: 3, mul: 1.16, speed: 1, coal: 2, tint: 'grayscale(0.5) brightness(1.08)' },
  coral: { name: '산호', good: 'coral', tier: 3, mul: 1.1, speed: 1.02, aquatic: 1.2, tint: 'hue-rotate(-40deg) saturate(2.2) brightness(1.25)' },
  silver: { name: '은', good: 'silverOre', tier: 4, mul: 1.26, speed: 1.02, mag: 1.1, coal: 2, tint: 'grayscale(0.85) brightness(1.4)' },
  gold: { name: '금', good: 'goldOre', tier: 4, mul: 1.2, speed: 1, gold: 1.15, coal: 2, tint: 'sepia(1) saturate(3) hue-rotate(5deg) brightness(1.2)' },
  crystal: { name: '마력 수정', good: 'manaCrystal', tier: 4, mul: 1.15, speed: 1, mag: 1.3, tint: 'hue-rotate(150deg) saturate(1.7) brightness(1.2)' },
  obsidian: { name: '흑요석', good: 'obsidian', tier: 5, mul: 1.42, speed: 0.97, crit: 0.05, coal: 3, tint: 'brightness(0.42) saturate(0.6) hue-rotate(220deg) contrast(1.5)' },
};

// ── 부산물 능력 (몬스터를 닮는다) ──
const S = (status, chance, stacks = 1) => ({ k: 'hit', status, chance, stacks });
export const PART_FX = {
  slimeGel: { adj: '끈적이는', fx: [S('chill', 0.25)] },
  batWing: { adj: '박쥐 날개', fx: [{ k: 'stat', stat: 'lifesteal', v: 3 }, { k: 'speed', v: 1.05 }] },
  goblinTooth: { adj: '이빨 박힌', fx: [{ k: 'crit', v: 0.05 }] },
  poisonGland: { adj: '독이 밴', fx: [S('poison', 0.3)] },
  leechFang: { adj: '피를 빠는', fx: [{ k: 'stat', stat: 'lifesteal', v: 4 }] },
  sporeSac: { adj: '포자 낀', fx: [{ k: 'cloud', chance: 0.12, r: 30, dur: 3 }] },
  salaTail: { adj: '불꽃', fx: [S('burn', 0.3)] },
  emberDust: { adj: '불씨', fx: [S('burn', 0.2), { k: 'boom', chance: 0.08, r: 28, mul: 0.5, status: 'burn' }] },
  magmaCore: { adj: '용암', fx: [{ k: 'boom', chance: 0.12, r: 36, mul: 0.7, status: 'burn' }] },
  demonHorn: { adj: '악귀', fx: [{ k: 'dmg', v: 1.06 }, { k: 'break', chance: 0.15 }] },
  frostFang: { adj: '서리', fx: [S('chill', 0.3), { k: 'move', v: 1.03 }] },
  iceCore: { adj: '빙결', fx: [S('chill', 0.4), { k: 'frozen', v: 1.25 }] },
  mirrorShard: { adj: '거울', fx: [{ k: 'stat', stat: 'reflect', v: 10 }] },
  boneShard: { adj: '뼈 박힌', fx: [{ k: 'break', chance: 0.2 }, { k: 'stat', stat: 'pres', v: 4 }] },
  soulDust: { adj: '망령', fx: [S('curse', 0.25), { k: 'night', v: 1.12 }] },
  rotFlesh: { adj: '썩은', fx: [S('poison', 0.2), { k: 'stat', stat: 'lifesteal', v: 2 }] },
  scorpionSting: { adj: '전갈', fx: [S('poison', 0.35), { k: 'crit', v: 0.04 }] },
  hyenaFang: { adj: '굶주린', fx: [S('bleed', 0.3)] },
  orcTusk: { adj: '오크', fx: [{ k: 'dmg', v: 1.08 }, { k: 'knock', v: 1.3 }] },
  raptorClaw: { adj: '사냥꾼의', fx: [S('bleed', 0.35), { k: 'speed', v: 1.04 }] },
  waspSting: { adj: '말벌', fx: [S('poison', 0.25), { k: 'speed', v: 1.06 }] },
  beetleShell: { adj: '단단한', fx: [{ k: 'stat', stat: 'pres', v: 8 }, { k: 'taken', v: 0.96 }] },
  banditCloth: { adj: '도적의', fx: [{ k: 'crit', v: 0.06 }, { k: 'gold', v: 1.1 }] },
  crabClaw: { adj: '집게 달린', fx: [{ k: 'break', chance: 0.2 }, { k: 'aquatic', v: 1.2 }] },
  jellyTentacle: { adj: '찌릿한', fx: [S('shock', 0.3)] },
  serpentScale: { adj: '바다뱀', fx: [S('chill', 0.2), { k: 'aquatic', v: 1.25 }] },
  wispEssence: { adj: '도깨비불', fx: [S('burn', 0.25), { k: 'night', v: 1.15 }] },
  chiefMask: { adj: '족장의', fx: [{ k: 'crit', v: 0.08 }, { k: 'gold', v: 1.15 }] },
  giantHeart: { adj: '늪 거인의', fx: [S('poison', 0.5), { k: 'regen', v: 0.003 }] },
  riftCore: { adj: '균열', fx: [{ k: 'boom', chance: 0.2, r: 44, mul: 0.9, status: 'burn' }] },
  witchCrown: { adj: '서리 마녀의', fx: [S('chill', 0.5), { k: 'cdr', v: 0.92 }] },
  graveLantern: { adj: '묘지기의', fx: [S('curse', 0.4), { k: 'stat', stat: 'lifesteal', v: 5 }] },
  dragonScale: { adj: '용궁', fx: [{ k: 'aquatic', v: 1.35 }, { k: 'taken', v: 0.94 }] },
  lordHorn: { adj: '군주의', fx: [{ k: 'dmg', v: 1.12 }, { k: 'break', chance: 0.25 }] },
  warlordTusk: { adj: '대족장의', fx: [{ k: 'dmg', v: 1.1 }, { k: 'knock', v: 1.5 }] },
  alphaClaw: { adj: '우두머리의', fx: [S('bleed', 0.5), { k: 'speed', v: 1.08 }] },
  fallenCrest: { adj: '타락한', fx: [S('curse', 0.3), { k: 'stat', stat: 'pres', v: 10 }] },
};
// 서로 다른 부산물 둘이 맞물리면 (각각 가진 성질로 판정)
export const SYNERGY = [ // 원소가 맞물리는 둘은 이 무기가 일으키는 원소 반응(증기 폭발 · 과부하 …)을 더 세게 한다
  { id: 'steam', name: '증기 폭발', need: ['burn', 'chill'], react: true, text: '원소 반응 피해 +40% (화상 + 냉기 → 증기 폭발)' },
  { id: 'smog', name: '독 연기', need: ['burn', 'poison'], react: true, text: '원소 반응 피해 +40% (화상 + 독 → 유독 연기)' },
  { id: 'overload', name: '과부하', need: ['burn', 'shock'], react: true, text: '원소 반응 피해 +40% (화상 + 감전 → 과부하)' },
  { id: 'frostShock', name: '얼음 전류', need: ['shock', 'chill'], react: true, text: '원소 반응 피해 +40% (냉기 + 감전 → 순간 빙결)' },
  { id: 'bloodIce', name: '혈빙', need: ['bleed', 'chill'], react: true, text: '원소 반응 피해 +40% (출혈 + 냉기 → 혈빙)' },
  { id: 'rot', name: '썩은 상처', need: ['poison', 'bleed'], text: '출혈 걸린 적을 때리면 독 1중첩이 더 걸린다 (독 + 출혈 → 패혈)' },
  { id: 'thirst', name: '피의 갈증', need: ['bleed', 'lifesteal'], text: '출혈 걸린 적을 때리면 최대 체력의 1% 회복' },
  { id: 'crush', name: '분쇄', need: ['break', 'dmg'], text: '갑옷 부수기가 한 번에 2중첩' },
  { id: 'inferno', name: '불바다', need: ['burn', 'boom'], text: '폭발 반경 +40%, 폭발에 맞은 적은 화상 2중첩' },
  { id: 'hunt', name: '급소 사냥', need: ['bleed', 'crit'], text: '치명타가 출혈 2중첩을 건다' },
];
const STATUS_NAME = { burn: '화상', chill: '냉기', poison: '독', bleed: '출혈', shock: '감전', curse: '저주' };
const pc = (v) => Math.round(v * 100);
function fxText(f) {
  switch (f.k) {
    case 'hit': return `공격 시 ${pc(f.chance)}% 확률로 ${STATUS_NAME[f.status]} ${f.stacks}중첩`;
    case 'stat': return `${{ lifesteal: '흡혈', reflect: '반사', pres: '물리 방어' }[f.stat]} +${f.v}${f.stat === 'pres' ? '' : '%'}`;
    case 'speed': return `공격 속도 +${pc(f.v - 1)}%`;
    case 'move': return `이동 속도 +${pc(f.v - 1)}%`;
    case 'crit': return `치명타 확률 +${pc(f.v)}%`;
    case 'dmg': return `모든 피해 +${pc(f.v - 1)}%`;
    case 'taken': return `받는 피해 -${pc(1 - f.v)}%`;
    case 'knock': return `밀쳐내기 +${pc(f.v - 1)}%`;
    case 'gold': return `골드 +${pc(f.v - 1)}%`;
    case 'regen': return `초당 체력 ${(f.v * 100).toFixed(1)}% 회복`;
    case 'cdr': return `스킬 재사용 대기 -${pc(1 - f.v)}%`;
    case 'break': return `공격 시 ${pc(f.chance)}% 확률로 갑옷 부수기 (방어 -5%)`;
    case 'boom': return `공격 시 ${pc(f.chance)}% 확률로 폭발 (반경 ${f.r} · 공격력 ${pc(f.mul)}%)`;
    case 'cloud': return `공격 시 ${pc(f.chance)}% 확률로 독 포자 구름 (반경 ${f.r} · ${f.dur}초)`;
    case 'frozen': return `얼어붙은 적에게 피해 +${pc(f.v - 1)}%`;
    case 'night': return `밤에 피해 +${pc(f.v - 1)}%`;
    case 'aquatic': return `물속에서 피해 +${pc(f.v - 1)}%`;
  }
  return '';
}
// 같은 부산물 둘: 확률 · 수치가 1.6배 깊어진다
function deepen(f) {
  const o = { ...f };
  if (o.chance) o.chance = Math.min(0.85, Math.round(o.chance * 1.6 * 100) / 100);
  if (o.k === 'stat') o.v = Math.round(o.v * 1.6);
  else if (['speed', 'move', 'dmg', 'knock', 'gold', 'frozen', 'night', 'aquatic'].includes(o.k)) o.v = Math.round((1 + (o.v - 1) * 1.6) * 100) / 100;
  else if (['taken', 'cdr'].includes(o.k)) o.v = Math.round((1 - (1 - o.v) * 1.6) * 100) / 100;
  else if (o.k === 'crit' || o.k === 'regen') o.v = Math.round(o.v * 1.6 * 1000) / 1000;
  return o;
}
const traits = (fx) => new Set(fx.flatMap((f) => (f.k === 'hit' ? [f.status] : f.k === 'stat' && f.stat === 'lifesteal' ? ['lifesteal'] : [f.k])));

// 재료값: 주재료 · 손잡이 나무 · 석탄 · 부산물 · 골드
export function craftCost(type, mat, parts = []) {
  const T = WTYPES[type], M = WMATS[mat];
  if (!T || !M) return null;
  const mats = {};
  const add = (id, n) => { if (n > 0) mats[id] = (mats[id] || 0) + n; };
  add(M.good, T.need + Math.max(0, M.tier - 2));
  add(M.tier >= 3 && M.good !== 'hardwood' ? 'hardwood' : 'wood', T.handle);
  add('coal', M.coal || 0);
  for (const p of parts) if (p) add(p, 1);
  return { mats, gold: T.gold + M.tier * M.tier * 12 };
}

const CRAFT_HANDS = { greatsword: 2, hammer: 2, spear: 2, halberd: 2, scythe: 2, knuckle: 2, swordShield: 2, bow: 2, crossbow: 2, staff: 2 }; // 양손 무기 (나머지는 한손)
// 만든 무기 정보 → 장비 (items.js 와 같은 모양)
export function craftItem(rec) {
  const T = WTYPES[rec.type], M = WMATS[rec.mat];
  if (!T || !M) return null;
  const parts = (rec.parts || []).filter((p) => PART_FX[p]);
  const w = { ...T.weapon, cat: T.cat };
  w.mul = Math.round(w.mul * M.mul * (w.dmg === 'mag' && M.mag ? M.mag : 1) * 100) / 100;
  w.speed = Math.round(w.speed * M.speed * 100) / 100;
  if (M.crit) w.crit = (w.crit || 0) + M.crit;
  const stats = { ...(T.stats || {}) }, effects = [], lines = [];
  // 같은 부산물 둘이면 깊어진 한 벌, 아니면 각각
  let fx = [];
  if (parts.length === 2 && parts[0] === parts[1]) fx = PART_FX[parts[0]].fx.map(deepen);
  else for (const p of parts) fx.push(...PART_FX[p].fx);
  if (M.aquatic) fx.push({ k: 'aquatic', v: M.aquatic });
  if (M.gold) fx.push({ k: 'gold', v: M.gold });
  w.onHits = []; w.special = {};
  for (const f of fx) {
    lines.push(fxText(f));
    switch (f.k) {
      case 'hit': w.onHits.push({ status: f.status, chance: f.chance, stacks: f.stacks }); break;
      case 'stat': stats[f.stat] = (stats[f.stat] || 0) + f.v; break;
      case 'speed': w.speed = Math.round(w.speed * f.v * 100) / 100; break;
      case 'move': effects.push({ type: 'mul', key: 'moveSpeed', v: f.v }); break;
      case 'crit': effects.push({ type: 'add', key: 'crit', v: f.v }); break;
      case 'dmg': effects.push({ type: 'mul', key: 'dmgMul', v: f.v }); break;
      case 'taken': effects.push({ type: 'mul', key: 'dmgTakenMul', v: f.v }); break;
      case 'knock': effects.push({ type: 'mul', key: 'knockback', v: f.v }); break;
      case 'gold': effects.push({ type: 'mul', key: 'goldMul', v: f.v }); break;
      case 'regen': effects.push({ type: 'add', key: 'regen', v: f.v }); break;
      case 'cdr': effects.push({ type: 'mul', key: 'skillCdMul', v: f.v }); break;
      case 'break': w.special.breakChance = Math.max(w.special.breakChance || 0, f.chance); break;
      case 'boom': w.special.boom = f; break;
      case 'cloud': w.special.cloud = f; break;
      case 'frozen': w.special.frozen = f.v; break;
      case 'night': w.special.night = f.v; break;
      case 'aquatic': w.special.aquatic = Math.max(w.special.aquatic || 1, f.v); break;
    }
  }
  // 조합 능력 (서로 다른 부산물 둘)
  let syn = null;
  if (parts.length === 2 && parts[0] !== parts[1]) {
    const A = traits(PART_FX[parts[0]].fx), B = traits(PART_FX[parts[1]].fx);
    syn = SYNERGY.find((s) => (A.has(s.need[0]) && B.has(s.need[1])) || (A.has(s.need[1]) && B.has(s.need[0])));
    if (syn) { w.special.synergy = syn.id; lines.push(`★ ${syn.name}: ${syn.text}`); if (syn.react) effects.push({ type: 'mul', key: 'reactionMul', v: 1.4 }); }
  }
  const adj = parts.length ? (syn ? syn.name : PART_FX[parts[0]].adj) : '';
  const name = rec.name || `${adj ? adj + ' ' : ''}${M.name} ${T.name}`;
  return {
    name, slot: 'weapon', price: 0, crafted: true, cat: T.cat, hands: CRAFT_HANDS[rec.type] || 1, weapon: w, stats, tags: [], effects: effects.map((e) => ({ ...e, text: '' })),
    lines, art: { ...T.art, tint: M.tint }, rec, desc: T.desc,
  };
}
// 저장에 남은 만든 무기를 장비 목록에 올린다
export function registerCrafted(ITEMS, crafted) { for (const [id, rec] of Object.entries(crafted || {})) { const it = craftItem(rec); if (it) ITEMS[id] = it; } }
export const partName = (id) => GOODS[id]?.name || id;

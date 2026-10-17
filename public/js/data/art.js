// 데이터 ↔ 스프라이트 연결 (렌더 전용). tint 는 CSS filter
export const RACE_ART = {
  human: { base: 'knight_m' },
  elf: { base: 'elf_m' },
  dwarf: { base: 'dwarf_m' },
  orc: { base: 'orc_warrior' },
  beast: { base: 'lizard_m' },
  undead: { base: 'wizzard_m', tint: 'grayscale(0.7) hue-rotate(80deg) brightness(0.9) contrast(1.15)' },
};

export const MONSTER_ART = {
  slime: { base: 'swampy' },
  bat: { base: 'wogol' },
  goblin: { base: 'goblin' },
  goblinChief: { base: 'masked_orc', scale: 1.6 },
  toad: { base: 'muddy' },
  leech: { base: 'slug', tint: 'hue-rotate(-60deg) saturate(1.3)' },
  shroom: { base: 'zombie', tint: 'hue-rotate(30deg)' },
  swampQueen: { base: 'big_zombie', tint: 'hue-rotate(20deg) saturate(1.3)', scale: 1.25 },
  salamander: { base: 'chort' },
  magmaGolem: { base: 'ogre', tint: 'hue-rotate(-70deg) saturate(1.6) brightness(1.05)' },
  imp: { base: 'imp' },
  riftGuard: { base: 'big_demon', scale: 1.35 },
  frostWolf: { base: 'ice_zombie' },
  glassSpider: { base: 'angel', tint: 'hue-rotate(160deg) saturate(1.5)' },
  iceGolem: { base: 'ogre', tint: 'hue-rotate(110deg) saturate(1.2) brightness(1.15)' },
  frostWitch: { base: 'wizzard_f', tint: 'hue-rotate(170deg) saturate(1.3) brightness(1.1)', scale: 1.7 },
  skeleton: { base: 'skelet' },
  wraith: { base: 'necromancer', ghost: true },
  ghoul: { base: 'orc_warrior', tint: 'grayscale(0.6) hue-rotate(40deg) brightness(0.85)' },
  graveKeeper: { base: 'big_demon', tint: 'hue-rotate(230deg) saturate(1.3) brightness(0.9)', scale: 1.5 },
};

export const NPC_ART = {
  altar: { base: 'wizzard_f' },
  shop: { base: 'dwarf_f' },
  library: { base: 'elf_f' },
  trainer: { base: 'knight_f' },
  board: { base: 'doc' },
};

export const WEAPON_ART = {
  rustySword: { s: 'weapon_rusty_sword' },
  huntBow: { s: 'weapon_bow', bow: true },
  apprenticeStaff: { s: 'weapon_green_magic_staff' },
  dagger: { s: 'weapon_knife' },
  battleAxe: { s: 'weapon_axe' },
  tome: { s: 'weapon_red_magic_staff' },
  rotDagger: { s: 'weapon_cleaver', tint: 'hue-rotate(80deg) saturate(1.5)' },
  riftGreatsword: { s: 'weapon_lavish_sword' },
  frostWand: { s: 'weapon_green_magic_staff', tint: 'hue-rotate(110deg) saturate(1.4)' },
};

// 지역별 색조 (맵 전체에 적용)
export const ZONE_TINT = {
  cave: 'hue-rotate(55deg) saturate(0.75) brightness(0.95)',
  swamp: 'hue-rotate(35deg) saturate(0.9) brightness(0.8)',
  rift: 'hue-rotate(-25deg) saturate(1.5) brightness(0.9)',
  frost: 'hue-rotate(170deg) saturate(0.55) brightness(1.2)',
  grave: 'hue-rotate(225deg) saturate(0.45) brightness(0.75)',
};

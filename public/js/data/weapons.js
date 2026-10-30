// 탑의 무기 100종: 하나하나 이름 · 능력치 · 효과 · 우클릭 고유 기술이 다르다.
// 단계(t) 1~10 = 탑 10층마다 한 단계. 등급(r) 0 일반 · 1 희귀 · 2 영웅 · 3 전설 · 4 신화.
// 위력은 종류의 기본값 × 단계 배율 × 등급 배율. 능력치도 단계만큼 커진다. 얻기 어렵다 (탑에서만 · 드물게).
import { SKILLS } from './skills.js';
import { ITEMS, WEAPON_SKILLS } from './items.js';
import { WTYPES } from './crafting.js';

export const W_RARITY = [
  { name: '일반', color: '#c8c0d0', mul: 1 },
  { name: '희귀', color: '#5ab0ff', mul: 1.08, glow: 1 },
  { name: '영웅', color: '#c070ff', mul: 1.16, glow: 2 },
  { name: '전설', color: '#ffb030', mul: 1.26, glow: 3 },
  { name: '신화', color: '#ff4a6a', mul: 1.38, glow: 4 },
];
export const tierPower = (t) => Math.pow(1.34, t - 1); // 10단계 ≈ 14배
const statScale = (t) => 1 + 0.3 * (t - 1);

// ── 효과 쓰기 도우미 ──
const onHit = (status, chance, stacks = 1) => ({ status, chance, stacks });
const every = (event, n, action, text) => ({ type: 'on', event, every: n, action, text });
const on = (event, chance, action, text) => ({ type: 'on', event, chance, action, text });
const mul = (key, v, text) => ({ type: 'mul', key, v, text });
const add = (key, v, text) => ({ type: 'add', key, v, text });
const flag = (f, text) => ({ type: 'flag', flag: f, text });
const strike = (r, m, elem, fx, extra = {}) => ({ strike: { r, mul: m, elem, fx, type: elem && elem !== 'phys' ? 'mag' : 'phys', ...extra } });
const buff = (id, dur, mods, name, color, extra = {}) => ({ buff: { id: 'w_' + id, dur, mods, name, color, ...extra } });

// 색 (그림 틴트)
const TINT = {
  moss: 'hue-rotate(70deg) saturate(1.3) brightness(0.95)', bone: 'grayscale(0.6) sepia(0.35) brightness(1.3)', ember: 'sepia(1) saturate(3) hue-rotate(-20deg) brightness(1.05)',
  reed: 'sepia(0.8) saturate(1.2) hue-rotate(20deg)', bog: 'hue-rotate(60deg) saturate(1.6) brightness(0.8)', blood: 'hue-rotate(-40deg) saturate(2) brightness(0.85)',
  hex: 'hue-rotate(230deg) saturate(1.6) brightness(0.9)', toad: 'hue-rotate(50deg) saturate(1.2) brightness(0.75)', shell: 'sepia(0.7) saturate(1.4) brightness(0.9)',
  queen: 'hue-rotate(110deg) saturate(2) brightness(1.05)', magma: 'sepia(1) saturate(4) hue-rotate(-25deg) brightness(0.95)', ash: 'grayscale(0.7) brightness(0.7) contrast(1.3)',
  rift: 'hue-rotate(250deg) saturate(2.2) brightness(1.1)', obsidian: 'brightness(0.42) saturate(0.6) hue-rotate(220deg) contrast(1.5)', flame: 'sepia(1) saturate(5) hue-rotate(-10deg) brightness(1.2)',
  frost: 'hue-rotate(170deg) saturate(1.6) brightness(1.25)', glacier: 'hue-rotate(180deg) saturate(0.8) brightness(1.45)', aurora: 'hue-rotate(120deg) saturate(2.4) brightness(1.3)',
  grave: 'grayscale(0.85) brightness(0.8) contrast(1.2)', wraith: 'hue-rotate(260deg) saturate(1.2) brightness(0.75)', soul: 'hue-rotate(200deg) saturate(2) brightness(1.2)',
  gold: 'sepia(1) saturate(3) hue-rotate(5deg) brightness(1.2)', thorn: 'hue-rotate(80deg) saturate(1.8) brightness(0.85)', spore: 'hue-rotate(40deg) saturate(1.5) brightness(1.05)',
  venom: 'hue-rotate(75deg) saturate(3) brightness(1.1)', mirror: 'grayscale(1) brightness(1.6) contrast(1.2)', infernal: 'hue-rotate(-30deg) saturate(3) brightness(0.9) contrast(1.3)',
  star: 'hue-rotate(200deg) saturate(1.4) brightness(1.5)', storm: 'sepia(1) saturate(2.5) hue-rotate(15deg) brightness(1.4)', void: 'brightness(0.35) saturate(2) hue-rotate(260deg) contrast(1.6)',
  light: 'brightness(1.7) saturate(0.6) sepia(0.3)', dragon: 'hue-rotate(-15deg) saturate(2.2) brightness(1.05)', world: 'hue-rotate(300deg) saturate(1.8) brightness(1.2)',
};

// 무기 목록: base(종류) · t(단계) · r(등급) · s(그림) · tint · name · lore · w(무기 값 덮어쓰기) · st(능력치) · fx(효과) · sk(우클릭 기술)
export const TOWER_WEAPONS = {
  // ═══ 1단계 · 1~10층 (이끼 굴) ═══
  mossFang: { base: 'dagger', t: 1, r: 0, tint: TINT.moss, name: '이끼 송곳니', lore: '이끼 굴 거미의 송곳니를 깎아 만든 단검. 독이 아직 마르지 않았다.',
    w: { onHit: onHit('poison', 0.3) }, st: { agi: 3 },
    sk: { name: '송곳니 찌르기', cd: 6, desc: '앞으로 미끄러지며 찔러 독 2중첩.', mo: 'stab', do: [{ op: 'dash', dist: 70, mul: 1.6, status: 'poison', stacks: 2 }] } },
  ironWarden: { base: 'swordShield', t: 1, r: 0, s: 'weapon_knight_sword', name: '견습 파수검', lore: '탑 문지기 견습생이 처음 받는 검과 방패.',
    st: { pres: 5, vit: 2 }, fx: [on('hurt', 0.25, { shield: 0.03 }, '맞으면 25% 확률로 보호막(최대 체력 3%)')],
    sk: { name: '방패 밀쳐내기', cd: 7, desc: '방패로 앞을 밀쳐 날려 보내고 0.4초 기절.', mo: 'bash', do: [{ op: 'cone', range: 44, angle: 1.6, mul: 1.3, knock: 180, stun: 0.4, fx: 'sweep' }] } },
  emberClub: { base: 'club', t: 1, r: 0, tint: TINT.ember, name: '불씨 몽둥이', lore: '모닥불 속에서 꺼낸 그대로 휘두르는 몽둥이. 끝이 아직 빨갛다.',
    w: { onHit: onHit('burn', 0.3) }, st: { str: 3 },
    sk: { name: '불씨 내려치기', cd: 7, elem: 'fire', desc: '앞을 내려쳐 불씨를 튀긴다. 화상 2중첩.', mo: 'overhead', do: [{ op: 'aoe', at: 'aim', r: 40, mul: 1.8, stacks: 2, fx: 'burst', delay: 0.15 }] } },
  reedBow: { base: 'bow', t: 1, r: 0, tint: TINT.reed, name: '갈대 활', lore: '가볍고 빠르다. 대신 화살이 멀리 가지 않는다.',
    w: { speed: 1.85, range: 180 }, st: { agi: 2, sen: 2 },
    sk: { name: '세 갈래 화살', cd: 5, desc: '꿰뚫는 화살 세 발을 부채꼴로 쏜다.', mo: 'shoot', do: [{ op: 'proj', n: 3, spread: 0.18, speed: 320, range: 200, mul: 1.0, pierce: 1, kind: 'arrow' }] } },
  sparkWand: { base: 'staff', t: 1, r: 0, s: 'weapon_red_magic_staff', name: '불티 지팡이', lore: '휘두를 때마다 불티가 흩날린다. 견습 마법사의 첫 지팡이.',
    w: { onHit: onHit('burn', 0.25) }, st: { mag: 3 },
    sk: { name: '불티 흩뿌리기', cd: 6, mana: 12, elem: 'fire', desc: '작은 불덩이 다섯 개를 부채꼴로 흩뿌린다.', mo: 'cast', do: [{ op: 'proj', n: 5, spread: 0.25, speed: 260, range: 170, mul: 0.6, splash: 16, stacks: 1, kind: 'fireball' }] } },
  boneCleaver: { base: 'axe', t: 1, r: 1, s: 'weapon_cleaver', tint: TINT.bone, name: '뼈 식칼', lore: '고블린 푸줏간의 식칼. 피 냄새를 맡으면 손이 빨라진다.',
    w: { crit: 0.05 }, st: { str: 3 }, fx: [on('kill', 1, buff('boneCleaver', 3, { atkSpeed: 1.2 }, '피 냄새', '#e0445a'), '처치하면 3초 동안 공격 속도 +20%')],
    sk: { name: '뼈 가르기', cd: 6, desc: '앞을 크게 갈라 출혈 2중첩.', mo: 'chop', do: [{ op: 'cone', range: 40, angle: 2.2, mul: 1.6, status: 'bleed', stacks: 2, fx: 'sweep' }] } },
  frogWhip: { base: 'whip', t: 1, r: 1, tint: TINT.bog, name: '개구리 혀 채찍', lore: '끈적하고 질기다. 휘감긴 것은 쉽게 빠져나가지 못한다.',
    st: { agi: 3 }, w: { onHit: onHit('poison', 0.2) },
    sk: { name: '끈적한 휘감기', cd: 7, desc: '길게 휘감아 0.8초 묶고 독 2중첩.', mo: 'lash', do: [{ op: 'line', len: 90, w: 18, mul: 1.4, stun: 0.8, status: 'poison', stacks: 2 }] } },
  caveKnuckle: { base: 'knuckle', t: 1, r: 1, tint: TINT.ash, name: '동굴 너클', lore: '동굴 바위를 손등에 덧댄 너클. 여섯 번째 주먹에 바위가 울린다.',
    st: { str: 2, agi: 2 }, fx: [every('hit', 6, strike(26, 0.9, 'phys', 'smash'), '6번째 타격마다 충격파')],
    sk: { name: '바위 주먹 연타', cd: 6, desc: '0.6초 동안 바위 주먹을 다섯 번 꽂는다.', mo: 'stab', do: [{ op: 'channel', dur: 0.6, every: 0.12, sub: { op: 'single', range: 32, mul: 0.6, fx: 'stab' } }] } },
  hunterSpear: { base: 'spear', t: 1, r: 1, name: '사냥꾼의 창', lore: '멧돼지를 한 번에 꿰는 사냥꾼의 창. 급소를 노리기 좋다.',
    w: { crit: 0.05, critDmg: 0.2 }, st: { str: 2, sen: 2 },
    sk: { name: '꿰뚫는 투창', cd: 7, desc: '일직선의 적을 모두 꿰뚫는 투창을 던진다.', mo: 'throw', do: [{ op: 'proj', n: 1, speed: 380, range: 220, mul: 2.2, pierce: 99, kind: 'harpoon' }] } },
  glowOrb: { base: 'orb', t: 1, r: 1, tint: TINT.aurora, name: '반딧불 구슬', lore: '이끼 굴 반딧불이 깃든 구슬. 부르면 주위를 맴돈다.',
    st: { mag: 2, spi: 2 },
    sk: { name: '반딧불 무리', cd: 9, mana: 15, desc: '반딧불 넷이 6초 동안 내 둘레를 돌며 닿는 적을 태운다.', mo: 'cast', do: [{ op: 'orbit', n: 4, dur: 6, r: 28, mul: 0.5 }] } },

  // ═══ 2단계 · 11~20층 (독늪) ═══
  bogReaper: { base: 'scythe', t: 2, r: 1, tint: TINT.bog, name: '늪지 낫', lore: '늪 갈대를 베던 낫. 날에 늪물이 배어 있다.',
    w: { onHit: onHit('poison', 0.4) }, st: { str: 3, toxicity: 3 },
    sk: { name: '독안개 베기', cd: 8, desc: '넓게 베어 독 3중첩, 벤 자리에 4초 독안개.', mo: 'spin', do: [{ op: 'cone', range: 54, angle: 2.8, mul: 1.4, status: 'poison', stacks: 3, fx: 'sweep' }, { op: 'zone', kind: 'fog', r: 50, dur: 4, at: 'aim' }] } },
  leechBlade: { base: 'sword', t: 2, r: 2, s: 'weapon_saw_sword', tint: TINT.blood, name: '거머리 검', lore: '톱니 사이로 피를 빨아들이는 검. 쓸수록 칼날이 붉어진다.',
    st: { lifesteal: 3, str: 2 }, fx: [on('kill', 1, { heal: 0.02 }, '처치하면 체력 2% 회복')],
    sk: { name: '흡혈 베기', cd: 8, desc: '한 적을 깊게 베고 체력 4% 회복.', mo: 'overhead', do: [{ op: 'single', range: 46, mul: 2.4, onHitHeal: 0.04, fx: 'stab' }] } },
  hexTome: { base: 'tome', t: 2, r: 1, tint: TINT.hex, name: '저주 마도서', lore: '읽는 사람에게도 조금씩 저주가 스민다는 책.',
    w: { onHit: onHit('curse', 0.25) }, st: { mag: 3 },
    sk: { name: '저주 낭독', cd: 8, mana: 18, elem: 'dark', desc: '조준한 곳의 적들에게 저주 2중첩과 피해.', mo: 'cast', do: [{ op: 'aoe', at: 'aim', r: 56, mul: 1.2, status: 'curse', stacks: 2, fx: 'doom' }] } },
  marshHarpoon: { base: 'spear', t: 2, r: 1, tint: TINT.moss, name: '늪 작살', lore: '늪 괴물을 끌어내던 작살. 미늘이 깊다.',
    w: { range: 52 }, st: { str: 3, agi: 1 },
    sk: { name: '늪 작살 던지기', cd: 7, desc: '작살을 던져 맞은 적을 1초 묶는다.', mo: 'throw', do: [{ op: 'proj', n: 1, speed: 360, range: 200, mul: 1.6, stun: 1.0, kind: 'harpoon' }] } },
  toadHammer: { base: 'hammer', t: 2, r: 2, tint: TINT.toad, name: '두꺼비 망치', lore: '늪 두꺼비 왕의 등딱지로 만든 망치. 세 번째마다 땅이 울린다.',
    w: { speed: 0.85 }, st: { str: 4, vit: 3 }, fx: [every('hit', 3, strike(40, 0.8, 'phys', 'quake'), '3번째 타격마다 땅울림')],
    sk: { name: '두꺼비 뜀', cd: 9, desc: '높이 뛰어 내리찍는다. 0.6초 기절.', mo: 'leap', do: [{ op: 'leap', dist: 110, air: 0.45, r: 56, mul: 2.2, stun: 0.6 }] } },
  mireCrossbow: { base: 'crossbow', t: 2, r: 1, tint: TINT.bog, name: '수렁 석궁', lore: '독침을 쏘는 석궁. 화살촉에 늪 독을 바른다.',
    w: { onHit: onHit('poison', 0.5, 2) }, st: { sen: 3 },
    sk: { name: '독침 연사', cd: 8, desc: '0.6초 동안 독침을 다섯 발 연달아 쏜다.', mo: 'shoot', do: [{ op: 'channel', dur: 0.6, every: 0.12, sub: { op: 'proj', n: 1, speed: 430, range: 240, mul: 0.7, status: 'poison', stacks: 1, kind: 'bolt' } }] } },
  willowStaff: { base: 'staff', t: 2, r: 1, tint: TINT.thorn, name: '버들 지팡이', lore: '늪가 버드나무 가지. 땅에 대면 뿌리가 솟는다.',
    st: { spi: 3, mag: 2 }, fx: [mul('resGain', 1.15, '자원 얻는 양 +15%')],
    sk: { name: '덩굴 올가미', cd: 9, mana: 18, desc: '조준한 곳에 덩굴이 솟아 1.4초 묶는다.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 60, mul: 1.0, stun: 1.4, fx: 'spikes' }] } },
  swampKnives: { base: 'knives', t: 2, r: 1, tint: TINT.venom, name: '늪지 투척 단검', lore: '아홉 자루가 한 벌. 모두 독에 담가 둔다.',
    w: { onHit: onHit('poison', 0.25) }, st: { agi: 3 },
    sk: { name: '독 단검 소나기', cd: 7, desc: '독 단검 아홉 자루를 앞으로 흩뿌린다.', mo: 'throw', do: [{ op: 'proj', n: 9, spread: 0.12, speed: 380, range: 190, mul: 0.45, status: 'poison', stacks: 1, kind: 'knife' }] } },
  shellShield: { base: 'swordShield', t: 2, r: 2, tint: TINT.shell, name: '등껍질 방패검', lore: '맞을수록 단단해지고, 단단해질수록 화가 난다.',
    st: { pres: 8, vit: 3, mres: 3 }, fx: [on('hurt', 1, buff('shellShield', 4, { dmgMul: 1.08 }, null, null, { stack: true, cap: { dmgMul: 1.4 } }), '맞을 때마다 4초 동안 피해 +8% (최대 +40%)')],
    sk: { name: '등껍질 돌진', cd: 9, desc: '방패를 앞세워 돌진해 0.6초 기절, 3초 동안 받는 피해 -30%.', mo: 'bash', do: [{ op: 'dash', dist: 90, mul: 1.5, stun: 0.6 }, { op: 'buff', id: 'wShell', dur: 3, mods: { dmgTakenMul: 0.7 }, color: '#c8b088' }] } },
  queenGlaive: { base: 'halberd', t: 2, r: 3, tint: TINT.queen, name: '늪 여왕의 도끼창', lore: '늪 여왕의 근위대가 들던 도끼창. 상처에서 독이 퍼진다.',
    st: { str: 5, toxicity: 4 }, fx: [flag('poisonSpread', '적이 쓰러지면 독이 둘레로 퍼진다')],
    sk: { name: '여왕의 원무', cd: 9, desc: '도끼창을 휘돌리며 세 번 벤다. 마지막이 가장 세다.', mo: 'spin', do: [{ op: 'comboSpin', n: 3, every: 0.25, step: 10, r: 58, mul: 1.0, last: 1.8, knock: 100 }] } },

  // ═══ 3단계 · 21~30층 (화산 균열) ═══
  magmaAxe: { base: 'axe', t: 3, r: 2, s: 'weapon_waraxe', tint: TINT.magma, name: '마그마 도끼', lore: '도끼날 속에서 마그마가 굳지 않고 흐른다.',
    w: { onHit: onHit('burn', 0.4) }, st: { str: 5 },
    sk: { name: '용암 내려찍기', cd: 8, elem: 'fire', desc: '내려찍은 자리부터 앞으로 용암이 갈라진다. 화상 2중첩.', mo: 'overhead', do: [{ op: 'line', len: 140, w: 30, mul: 2.4, stacks: 2, delay: 0.15, fx: 'skyfall' }] } },
  cinderBow: { base: 'bow', t: 3, r: 2, tint: TINT.ember, name: '잿불 활', lore: '시위에 걸면 화살촉이 저절로 달아오른다.',
    w: { onHit: onHit('burn', 0.35) }, st: { sen: 4, agi: 2 },
    sk: { name: '불화살 비', cd: 9, elem: 'fire', desc: '조준한 곳에 불화살이 세 번 쏟아진다.', mo: 'aim', do: [0.3, 0.5, 0.7].map((d) => ({ op: 'aoe', at: 'aim', r: 56, mul: 0.8, stacks: 1, fx: 'rain', delay: d })) } },
  riftDagger: { base: 'dagger', t: 3, r: 2, tint: TINT.rift, name: '균열 단검', lore: '공간에 생긴 틈을 잘라 만든 칼. 칼끝이 흐릿하다.',
    w: { crit: 0.08 }, st: { agi: 5 }, fx: [on('crit', 1, strike(24, 0.8, 'arcane', 'arcane'), '치명타면 균열이 터진다')],
    sk: { name: '차원 베기', cd: 8, elem: 'arcane', desc: '앞으로 순간이동해 둘레를 한 바퀴 벤다.', mo: 'stab', do: [{ op: 'teleport', dist: 110 }, { op: 'cone', range: 44, angle: 6.28, mul: 1.8, fx: 'sweep' }] } },
  obsidianGreat: { base: 'greatsword', t: 3, r: 2, tint: TINT.obsidian, name: '흑요석 대검', lore: '쓰러뜨린 자의 열기로 날이 더 검게 빛난다.',
    w: { critDmg: 0.3 }, st: { str: 6 }, fx: [on('kill', 1, buff('obsidian', 5, { dmgMul: 1.12 }, '흑요석의 날', '#9a7aff'), '처치하면 5초 동안 피해 +12%')],
    sk: { name: '흑요석 낙인', cd: 9, desc: '대검을 땅에 꽂아 둘레를 터뜨린다. 0.5초 기절.', mo: 'overhead', do: [{ op: 'aoe', at: 'self', r: 62, mul: 2.2, stun: 0.5, fx: 'quake' }] } },
  flameTongue: { base: 'whip', t: 3, r: 3, tint: TINT.flame, name: '불꽃 혀', lore: '불의 정령을 꼬아 만든 채찍. 휘두르면 공기가 탄다.',
    w: { onHit: onHit('burn', 0.5) }, st: { agi: 3, mag: 3 },
    sk: { name: '화염 채찍', cd: 7, elem: 'fire', desc: '불 채찍을 두 번 길게 휘갈긴다. 화상 2중첩씩.', mo: 'lash', do: [{ op: 'cone', range: 82, angle: 1.2, mul: 1.6, stacks: 2, fx: 'sweep' }, { op: 'cone', range: 82, angle: 1.2, mul: 1.6, stacks: 2, fx: 'sweep', delay: 0.2 }] } },
  demonFist: { base: 'knuckle', t: 3, r: 3, tint: TINT.infernal, name: '악귀의 주먹', lore: '칠수록 빨라진다. 멈추면 처음으로 돌아간다.',
    st: { str: 4, agi: 3 }, fx: [every('hit', 5, buff('demonFist', 3, { atkSpeed: 1.1 }, null, null, { stack: true, cap: { atkSpeed: 1.5 } }), '5번 칠 때마다 3초 동안 공격 속도 +10% (최대 +50%)')],
    sk: { name: '악귀 난타', cd: 8, elem: 'fire', desc: '0.8초 동안 불 주먹을 쏟아붓고 마지막에 둘레를 날려 버린다.', mo: 'stab', do: [{ op: 'channel', dur: 0.8, every: 0.1, sub: { op: 'single', range: 32, mul: 0.5, stacks: 1, fx: 'stab' } }, { op: 'aoe', at: 'self', r: 44, mul: 1.4, knock: 160, fx: 'burst', delay: 0.85 }] } },
  ashStaff: { base: 'staff', t: 3, r: 2, s: 'weapon_red_magic_staff', tint: TINT.ash, name: '재의 지팡이', lore: '화산재가 굳어 생긴 지팡이. 끝에서 불덩이가 자란다.',
    st: { mag: 5 },
    sk: { name: '화산탄', cd: 8, mana: 22, elem: 'fire', desc: '크게 터지는 화산탄을 쏜다. 화상 3중첩.', mo: 'castBig', do: [{ op: 'proj', n: 1, speed: 210, range: 220, mul: 2.4, splash: 50, stacks: 3, kind: 'meteor' }] } },
  emberChakram: { base: 'boomerang', t: 3, r: 2, tint: TINT.flame, name: '불꽃 원반', lore: '돌아올 때 더 뜨겁다.',
    w: { onHit: onHit('burn', 0.3) }, st: { agi: 3, str: 2 },
    sk: { name: '불꽃 원반 셋', cd: 7, elem: 'fire', desc: '모두 꿰뚫는 불꽃 원반 셋을 부채꼴로 던진다.', mo: 'throw', do: [{ op: 'proj', n: 3, spread: 0.45, speed: 280, range: 180, mul: 1.3, pierce: 99, stacks: 1, kind: 'axe' }] } },
  lavaTome: { base: 'tome', t: 3, r: 3, tint: TINT.magma, name: '용암 서판', lore: '돌판에 새긴 화산의 주문. 읽으면 땅이 끓는다.',
    st: { mag: 5, fireAff: 4 }, fx: [flag('burnSpread', '불타는 적이 쓰러지면 불이 옮겨 붙는다')],
    sk: { name: '용암 장막', cd: 10, mana: 26, elem: 'fire', desc: '조준한 곳에 용암이 터지고 4초 동안 느려지는 땅이 남는다.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 70, mul: 1.6, stacks: 3, fx: 'burst' }, { op: 'zone', kind: 'slow', r: 70, dur: 4, at: 'aim' }] } },
  riftWarden: { base: 'swordShield', t: 3, r: 3, s: 'weapon_red_gem_sword', tint: TINT.rift, name: '균열 수호검', lore: '균열을 지키던 수호자의 방패. 맞은 힘을 비전으로 되돌린다.',
    st: { pres: 8, mres: 6 }, fx: [on('hurt', 0.3, strike(40, 0.9, 'arcane', 'arcane'), '맞으면 30% 확률로 비전 반격')],
    sk: { name: '균열 방벽', cd: 11, elem: 'arcane', desc: '3초 동안 받는 피해 -45%, 둘레를 밀쳐 낸다.', mo: 'guard', do: [{ op: 'buff', id: 'wRift', dur: 3, mods: { dmgTakenMul: 0.55 }, color: '#b98aff' }, { op: 'aoe', at: 'self', r: 50, mul: 1.2, knock: 200, fx: 'arcane' }] } },

  // ═══ 4단계 · 31~40층 (서리 회랑) ═══
  rimeSword: { base: 'sword', t: 4, r: 2, s: 'weapon_knight_sword', tint: TINT.frost, name: '서리꽃 검', lore: '벤 자리에 서리꽃이 핀다.',
    w: { onHit: onHit('chill', 0.4) }, st: { agi: 3, iceAff: 4 },
    sk: { name: '서리꽃 베기', cd: 7, elem: 'ice', desc: '벤 뒤 서리꽃이 터진다. 냉기 2중첩.', mo: 'overhead', do: [{ op: 'cone', range: 46, angle: 2.0, mul: 1.8, stacks: 2, fx: 'sweep' }, { op: 'aoe', at: 'self', r: 44, mul: 0.6, stacks: 1, fx: 'ice', delay: 0.3 }] } },
  glacierMaul: { base: 'hammer', t: 4, r: 3, s: 'weapon_big_hammer', tint: TINT.glacier, name: '빙하 망치', lore: '빙하 한 덩이를 통째로 깎았다. 얼어붙은 적은 쉽게 부서진다.',
    w: { speed: 0.8 }, st: { str: 6, vit: 4 }, fx: [flag('frozenVuln', '얼어붙은 적에게 피해 증가')],
    sk: { name: '빙하 붕괴', cd: 10, elem: 'ice', desc: '빙하를 내리쳐 부순다. 1초 빙결.', mo: 'overhead', do: [{ op: 'aoe', at: 'aim', r: 64, mul: 2.6, stun: 1.0, stacks: 2, delay: 0.4, fx: 'shatter' }] } },
  snowfallBow: { base: 'bow', t: 4, r: 3, tint: TINT.frost, name: '눈송이 활', lore: '화살 대신 눈송이를 쏜다는 소문이 있다. 사실이다.',
    w: { pierce: 2 }, st: { sen: 5 },
    sk: { name: '눈보라 화살', cd: 7, elem: 'ice', desc: '얼음 화살 일곱 발을 촘촘히 쏜다.', mo: 'shoot', do: [{ op: 'proj', n: 7, spread: 0.1, speed: 330, range: 220, mul: 0.6, stacks: 1, kind: 'ice' }] } },
  frostFang: { base: 'dagger', t: 4, r: 3, tint: TINT.glacier, name: '서리 송곳니', lore: '등 뒤에서 찌를 때 가장 차갑다.',
    st: { agi: 5 }, fx: [on('crit', 1, { status: 'chill', stacks: 3 }, '치명타면 냉기 3중첩')],
    sk: { name: '얼음 그림자', cd: 8, elem: 'ice', desc: '적 뒤로 돌아가 깊게 찌른다. 냉기 2중첩.', mo: 'stab', do: [{ op: 'behind', range: 200 }, { op: 'single', range: 40, mul: 2.8, stacks: 2, fx: 'stab' }] } },
  auroraOrb: { base: 'orb', t: 4, r: 3, tint: TINT.aurora, name: '오로라 구슬', lore: '극지의 하늘을 담은 구슬. 빛이 물결친다.',
    st: { mag: 5, spi: 3 },
    sk: { name: '오로라 파동', cd: 10, mana: 25, elem: 'ice', desc: '내 둘레로 오로라가 퍼져 냉기 2중첩, 3초 동안 이동 속도 +20%.', mo: 'castBig', do: [{ op: 'aoe', at: 'self', r: 90, mul: 1.4, stacks: 2, fx: 'zero' }, { op: 'buff', id: 'wAurora', dur: 3, mods: { moveSpeed: 1.2 }, color: '#9fffd8' }] } },
  yetiClub: { base: 'club', t: 4, r: 2, tint: TINT.glacier, name: '설인의 몽둥이', lore: '설인이 뽑아 든 얼어붙은 통나무.',
    st: { str: 6 }, fx: [on('kill', 0.5, strike(46, 1.0, 'ice', 'shatter'), '처치하면 50% 확률로 얼음 파열')],
    sk: { name: '설인 포효', cd: 11, desc: '포효해 둘레를 1.2초 얼리고 5초 동안 피해 +15%.', mo: 'roar', do: [{ op: 'aoe', at: 'self', r: 70, mul: 1.0, stun: 1.2, fx: 'roar' }, { op: 'buff', id: 'wYeti', dur: 5, mods: { dmgMul: 1.15 }, color: '#e8f8ff' }] } },
  icicleKnives: { base: 'knives', t: 4, r: 3, tint: TINT.frost, name: '고드름 투척', lore: '처마 끝 고드름을 꺾어 던진다. 녹기 전에.',
    w: { onHit: onHit('chill', 0.35) }, st: { agi: 5, iceAff: 3 },
    sk: { name: '고드름 부채', cd: 7, elem: 'ice', desc: '고드름 열두 개를 넓은 부채꼴로 던진다.', mo: 'throw', do: [{ op: 'proj', n: 12, spread: 0.5, speed: 320, range: 170, mul: 0.45, stacks: 1, kind: 'ice' }] } },
  winterScythe: { base: 'scythe', t: 4, r: 3, tint: TINT.frost, name: '겨울 낫', lore: '휘두르는 동안 둘레가 겨울이 된다.',
    st: { str: 5, iceAff: 3 },
    sk: { name: '혹한의 원', cd: 9, elem: 'ice', desc: '1.2초 동안 낫을 휘돌려 둘레를 네 번 얼린다.', mo: 'spin', do: [{ op: 'channel', dur: 1.2, every: 0.3, sub: { op: 'aoe', at: 'self', r: 60, mul: 0.8, stacks: 1, fx: 'ice' } }] } },
  hailCrossbow: { base: 'crossbow', t: 4, r: 3, tint: TINT.glacier, name: '우박 석궁', lore: '하늘로 쏘면 우박이 되어 돌아온다.',
    st: { sen: 6 },
    sk: { name: '우박 포격', cd: 9, elem: 'ice', desc: '조준한 곳에 우박이 세 번 떨어진다.', mo: 'aim', do: [0.3, 0.45, 0.6].map((d) => ({ op: 'aoe', at: 'aim', r: 50, mul: 1.2, stacks: 1, fx: 'rocks', delay: d })) } },
  witchTome: { base: 'tome', t: 4, r: 4, tint: TINT.aurora, name: '서리 마녀의 서', lore: '서리 마녀가 남긴 주문서. 얼린 것을 오래 붙잡는다.',
    st: { mag: 7, iceAff: 5 }, fx: [add('freezeTime', 0.5, '얼리는 시간 +0.5초')],
    sk: { name: '절대 영도의 장', cd: 13, mana: 40, elem: 'ice', desc: '조준한 곳을 통째로 얼린다. 냉기 4중첩 · 1.5초 빙결.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 84, mul: 2.4, stacks: 4, stun: 1.5, delay: 0.6, fx: 'zero' }] } },

  // ═══ 5단계 · 41~50층 (그림자 묘지) ═══
  graveBlade: { base: 'sword', t: 5, r: 3, s: 'weapon_rusty_sword', tint: TINT.grave, name: '묘지기의 검', lore: '쓰러진 적은 이 검 앞에서 편히 잠들지 못한다.',
    st: { str: 5, mres: 4 }, fx: [on('kill', 1, strike(40, 1.0, 'dark', 'corpse'), '처치한 적이 터진다')],
    sk: { name: '묘지 가르기', cd: 8, elem: 'dark', desc: '땅을 갈라 앞으로 길게 저주를 흘린다.', mo: 'overhead', do: [{ op: 'line', len: 120, w: 34, mul: 2.6, stacks: 1, delay: 0.15, fx: 'skyfall' }] } },
  wraithScythe: { base: 'scythe', t: 5, r: 4, tint: TINT.wraith, name: '망령 낫', lore: '벤 것의 영혼을 거둔다. 손잡이가 늘 차갑다.',
    w: { onHit: onHit('curse', 0.3) }, st: { str: 6, agi: 3 },
    sk: { name: '영혼 수확', cd: 9, elem: 'dark', desc: '아주 넓게 베어 저주 2중첩.', mo: 'spin', do: [{ op: 'cone', range: 64, angle: 3.2, mul: 2.0, stacks: 2, fx: 'sweep' }] } },
  boneBow: { base: 'bow', t: 5, r: 3, tint: TINT.bone, name: '뼈 장궁', lore: '거인의 갈비뼈로 만든 활. 한 발이 무겁다.',
    w: { critDmg: 0.3, speed: 1.2 }, st: { sen: 6, agi: 3 },
    sk: { name: '해골 화살', cd: 8, elem: 'dark', desc: '모두 꿰뚫는 무거운 해골 화살을 쏜다.', mo: 'aim', do: [{ op: 'proj', n: 1, speed: 460, range: 300, mul: 3.2, pierce: 99, kind: 'soul' }] } },
  soulOrb: { base: 'orb', t: 5, r: 3, tint: TINT.soul, name: '혼백 구슬', lore: '묘지의 혼백이 모여 사는 구슬.',
    st: { mag: 6, spi: 4 },
    sk: { name: '혼백 무리', cd: 11, mana: 30, desc: '혼백 여섯이 8초 동안 둘레를 돌며 닿는 적을 할퀸다.', mo: 'cast', do: [{ op: 'orbit', n: 6, dur: 8, r: 34, mul: 0.7 }] } },
  coffinHammer: { base: 'hammer', t: 5, r: 3, tint: TINT.grave, name: '관 뚜껑 망치', lore: '관 뚜껑으로 만든 망치. 네 번째마다 무덤이 열린다.',
    w: { armorBreak: true }, st: { str: 7, vit: 5 }, fx: [every('hit', 4, strike(44, 1.2, 'dark', 'doom'), '4번째 타격마다 무덤의 손')],
    sk: { name: '관 뚜껑 닫기', cd: 10, desc: '뛰어올라 관 뚜껑을 닫듯 내리찍는다. 1초 기절.', mo: 'leap', do: [{ op: 'leap', dist: 130, air: 0.5, r: 66, mul: 2.8, stun: 1.0 }] } },
  nightKnives: { base: 'knives', t: 5, r: 3, tint: TINT.wraith, name: '밤그림자 단검', lore: '밤에만 보이는 단검. 낮에도 잘 꽂힌다.',
    w: { crit: 0.1 }, st: { agi: 7 },
    sk: { name: '그림자 칼날비', cd: 8, desc: '꿰뚫는 수리검 여섯 개를 두 번 연달아 던진다.', mo: 'throw', do: [{ op: 'proj', n: 6, spread: 0.08, speed: 420, range: 220, mul: 0.8, pierce: 2, kind: 'shuriken' }, { op: 'proj', n: 6, spread: 0.08, speed: 420, range: 220, mul: 0.8, pierce: 2, kind: 'shuriken', delay: 0.2 }] } },
  lichStaff: { base: 'staff', t: 5, r: 4, s: 'weapon_green_magic_staff', tint: TINT.wraith, name: '리치의 지팡이', lore: '죽지 않는 자의 지팡이. 끝의 보석이 맥박친다.',
    w: { onHit: onHit('curse', 0.4) }, st: { mag: 8 },
    sk: { name: '죽음의 손길', cd: 9, mana: 30, elem: 'dark', desc: '조준한 곳에서 망자의 손이 솟는다. 저주 2중첩.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 64, mul: 2.4, stacks: 2, delay: 0.3, fx: 'doom' }] } },
  hangmanWhip: { base: 'whip', t: 5, r: 3, tint: TINT.grave, name: '교수형 채찍', lore: '목을 감으면 놓지 않는다.',
    st: { agi: 5, str: 3 }, fx: [on('crit', 1, { status: 'bleed', stacks: 3 }, '치명타면 출혈 3중첩')],
    sk: { name: '목조르기', cd: 9, desc: '앞을 휘감아 1.6초 묶고 출혈 2중첩.', mo: 'lash', do: [{ op: 'line', len: 100, w: 16, mul: 2.2, stun: 1.6, status: 'bleed', stacks: 2 }] } },
  cryptShield: { base: 'swordShield', t: 5, r: 3, tint: TINT.grave, name: '납골당 방패검', lore: '납골당 문을 떼어 만든 방패. 망자들이 같이 막아 준다.',
    st: { pres: 10, mres: 8, vit: 4 }, fx: [on('hurt', 0.2, buff('crypt', 2, { dmgTakenMul: 0.7 }, '망자의 방패', '#c45cff'), '맞으면 20% 확률로 2초 동안 받는 피해 -30%')],
    sk: { name: '망자의 벽', cd: 12, elem: 'dark', desc: '4초 동안 받는 피해 -50%, 둘레에 저주.', mo: 'guard', do: [{ op: 'buff', id: 'wCrypt', dur: 4, mods: { dmgTakenMul: 0.5 }, color: '#c45cff' }, { op: 'aoe', at: 'self', r: 56, mul: 1.0, stacks: 1, fx: 'doom' }] } },
  kingsEdge: { base: 'greatsword', t: 5, r: 4, s: 'weapon_lavish_sword', tint: TINT.gold, name: '각인왕의 대검', lore: '50층의 왕이 들던 대검. 쓰러뜨린 자의 수만큼 무거워진다.',
    st: { str: 8, vit: 4 }, fx: [on('kill', 1, buff('kingsEdge', 8, { dmgMul: 1.06 }, null, null, { stack: true, cap: { dmgMul: 1.3 } }), '처치마다 8초 동안 피해 +6% (최대 +30%)')],
    sk: { name: '왕의 심판', cd: 11, desc: '조준한 곳에 빛의 일격. 1초 기절.', mo: 'overhead', do: [{ op: 'aoe', at: 'aim', r: 70, mul: 3.4, stun: 1.0, delay: 0.4, fx: 'holy' }] } },

  // ═══ 6단계 · 51~60층 (잠식된 이끼 굴) ═══
  thornSpear: { base: 'spear', t: 6, r: 3, tint: TINT.thorn, name: '가시덩굴 창', lore: '창대에 가시덩굴이 감겨 있다. 찌르면 덩굴이 남는다.',
    w: { onHit: onHit('bleed', 0.35) }, st: { str: 6, agi: 4 },
    sk: { name: '가시 창 돌진', cd: 8, desc: '길게 돌진하며 꿰뚫어 출혈 3중첩.', mo: 'stab', do: [{ op: 'dash', dist: 120, mul: 2.0, status: 'bleed', stacks: 3 }] } },
  sporeTome: { base: 'tome', t: 6, r: 3, tint: TINT.spore, name: '포자 서', lore: '책장 사이에서 버섯이 자란다. 숨을 참고 읽어야 한다.',
    st: { mag: 7, toxicity: 6 }, fx: [flag('poisonBurst', '독이 가득 찬 적은 터진다')],
    sk: { name: '포자 폭발', cd: 10, mana: 30, desc: '조준한 곳에 포자가 터져 독 4중첩, 5초 독안개.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 72, mul: 2.0, status: 'poison', stacks: 4, fx: 'fog' }, { op: 'zone', kind: 'fog', r: 72, dur: 5, at: 'aim' }] } },
  rootHammer: { base: 'hammer', t: 6, r: 3, tint: TINT.thorn, name: '뿌리 망치', lore: '고목의 뿌리 뭉치. 세 번째마다 땅에서 뿌리가 솟는다.',
    st: { str: 8, vit: 6 }, fx: [every('hit', 3, strike(50, 1.3, 'phys', 'spikes'), '3번째 타격마다 뿌리가 솟는다')],
    sk: { name: '대지의 분노', cd: 11, desc: '땅을 내리쳐 둘레를 크게 뒤흔든다. 1.2초 기절.', mo: 'overhead', do: [{ op: 'aoe', at: 'self', r: 90, mul: 2.6, stun: 1.2, fx: 'quake' }] } },
  mossKatana: { base: 'sword', t: 6, r: 4, s: 'weapon_katana', tint: TINT.moss, name: '이끼 카타나', lore: '이끼 속에 백 년을 묻혀 있던 칼. 뽑는 순간 끝난다.',
    w: { crit: 0.15, critDmg: 0.4, speed: 1.75 }, st: { agi: 7, sen: 4 },
    sk: { name: '일섬', cd: 8, desc: '번개처럼 앞으로 베고 지나간다.', mo: 'dashSlash', do: [{ op: 'dash', dist: 140, mul: 3.0 }] } },
  beetleKnuckle: { base: 'knuckle', t: 6, r: 3, tint: TINT.shell, name: '딱정벌레 너클', lore: '철갑 딱정벌레 껍질. 막는 손이 곧 치는 손이다.',
    st: { str: 5, agi: 5, pres: 6 }, fx: [on('hurt', 0.3, strike(30, 1.2, 'phys', 'smash'), '맞으면 30% 확률로 반격')],
    sk: { name: '갑충 연타', cd: 8, desc: '1초 동안 열 번 치고 마지막에 둘레를 날린다.', mo: 'stab', do: [{ op: 'channel', dur: 1.0, every: 0.1, sub: { op: 'single', range: 32, mul: 0.55, fx: 'stab' } }, { op: 'aoe', at: 'self', r: 46, mul: 1.6, knock: 180, fx: 'smash', delay: 1.05 }] } },
  goblinChakram: { base: 'boomerang', t: 6, r: 3, tint: TINT.gold, name: '족장의 원반', lore: '가면 족장이 아끼던 금 원반. 잡을 때마다 기분이 좋아진다.',
    st: { str: 5, agi: 4 }, fx: [on('kill', 1, buff('chakram', 3, { moveSpeed: 1.2 }, '신난다', '#ffd84a'), '처치하면 3초 동안 이동 속도 +20%')],
    sk: { name: '원반 폭풍', cd: 9, desc: '꿰뚫는 원반 여덟 개를 사방으로 던진다.', mo: 'throw', do: [{ op: 'proj', n: 8, spread: 0.785, speed: 260, range: 140, mul: 0.9, pierce: 99, kind: 'axe' }] } },
  hiveBow: { base: 'bow', t: 6, r: 3, tint: TINT.spore, name: '벌집 활', lore: '활 속에 벌집이 있다. 화살마다 벌이 붙어 간다.',
    w: { onHit: onHit('poison', 0.4) }, st: { sen: 7 },
    sk: { name: '벌떼 화살', cd: 8, desc: '독침 화살 다섯 발을 넓게 쏜다. 독 2중첩.', mo: 'shoot', do: [{ op: 'proj', n: 5, spread: 0.3, speed: 280, range: 230, mul: 0.9, status: 'poison', stacks: 2, kind: 'dart' }] } },
  lanternStaff: { base: 'staff', t: 6, r: 4, s: 'weapon_red_magic_staff', tint: TINT.ember, name: '등불 지팡이', lore: '길 잃은 이를 이끄는 등불. 적에게는 그렇지 않다.',
    w: { onHit: onHit('burn', 0.3) }, st: { mag: 8, spi: 5 },
    sk: { name: '등불 정령', cd: 12, mana: 30, elem: 'fire', desc: '등불 정령 셋이 10초 동안 둘레를 돌며 적을 태운다.', mo: 'castBig', do: [{ op: 'orbit', n: 3, dur: 10, r: 40, mul: 1.1 }] } },
  canopyScythe: { base: 'scythe', t: 6, r: 4, tint: TINT.thorn, name: '수관 낫', lore: '숲의 지붕을 베어 낸 낫. 휘두를수록 바람이 인다.',
    st: { str: 8, agi: 4 }, fx: [on('kill', 1, buff('canopy', 4, { atkSpeed: 1.25 }, '나뭇잎 바람', '#7be38a'), '처치하면 4초 동안 공격 속도 +25%')],
    sk: { name: '나뭇잎 회오리', cd: 10, desc: '네 번 휘돌며 나아간다. 마지막이 가장 세다.', mo: 'spin', do: [{ op: 'comboSpin', n: 4, every: 0.2, step: 14, r: 66, mul: 1.1, last: 2.4, knock: 120 }] } },
  elderGreat: { base: 'greatsword', t: 6, r: 4, tint: TINT.moss, name: '고목 대검', lore: '쓰러진 고목에서 깎아 낸 대검. 휘두르는 게 아니라 쓰러뜨린다.',
    w: { speed: 0.8, range: 46 }, st: { str: 10, vit: 6 }, fx: [flag('heavyHit', '묵직한 일격: 경직을 잘 건다')],
    sk: { name: '고목 쓰러뜨리기', cd: 11, desc: '대검을 나무처럼 앞으로 쓰러뜨린다. 1초 기절.', mo: 'overhead', do: [{ op: 'line', len: 180, w: 44, mul: 4.0, stun: 1.0, delay: 0.35, fx: 'skyfall' }] } },

  // ═══ 7단계 · 61~70층 (썩어 가는 늪) ═══
  venomFang: { base: 'dagger', t: 7, r: 4, tint: TINT.venom, name: '독사의 이빨', lore: '독사 여왕의 이빨. 한 번 물면 독이 깊이 스민다.',
    w: { onHit: onHit('poison', 0.6, 2) }, st: { agi: 9, toxicity: 6 }, fx: [flag('poisonDeep', '독이 더 깊이 쌓인다')],
    sk: { name: '독사 일격', cd: 8, desc: '적 뒤로 돌아가 세 번 물어뜯는다. 독 2중첩씩.', mo: 'stab', do: [{ op: 'behind', range: 220 }, { op: 'channel', dur: 0.36, every: 0.12, sub: { op: 'single', range: 40, mul: 1.1, status: 'poison', stacks: 2, fx: 'stab' } }] } },
  plagueStaff: { base: 'staff', t: 7, r: 4, s: 'weapon_green_magic_staff', tint: TINT.venom, name: '역병 군주의 지팡이', lore: '역병을 부르는 지팡이. 들고 있는 사람만 멀쩡하다.',
    st: { mag: 10, toxicity: 8 }, fx: [flag('poisonSpread', '적이 쓰러지면 독이 둘레로 퍼진다')],
    sk: { name: '역병의 비', cd: 11, mana: 35, desc: '조준한 곳에 독비가 네 번 내린다. 독 2중첩씩.', mo: 'castBig', do: [0.2, 0.4, 0.6, 0.8].map((d) => ({ op: 'aoe', at: 'aim', r: 60, mul: 1.0, status: 'poison', stacks: 2, fx: 'fog', delay: d })) } },
  hagWhip: { base: 'whip', t: 7, r: 4, tint: TINT.hex, name: '마녀 수장의 채찍', lore: '휘두를 때마다 환영이 따라 휘두른다.',
    w: { onHit: onHit('curse', 0.35) }, st: { agi: 6, mag: 6 },
    sk: { name: '환영 채찍', cd: 8, elem: 'dark', desc: '나와 환영이 세 번 휘갈긴다. 저주 1중첩씩.', mo: 'lash', do: [0, 0.15, 0.3].map((d) => ({ op: 'cone', range: 92, angle: 1.4, mul: 1.4, stacks: 1, fx: 'sweep', delay: d })) } },
  swampGiantClub: { base: 'club', t: 7, r: 4, s: 'weapon_mace', tint: TINT.toad, name: '늪 거인의 몽둥이', lore: '늪의 거인이 쓰던 몽둥이. 맞은 땅이 늪이 된다.',
    w: { speed: 0.75 }, st: { str: 11, vit: 8 }, fx: [every('hit', 4, strike(56, 1.6, 'poison', 'fog', { status: 'poison', stacks: 2 }), '4번째 타격마다 독늪이 터진다')],
    sk: { name: '늪 압살', cd: 11, desc: '뛰어올라 짓눌러 독 3중첩 · 0.8초 기절.', mo: 'leap', do: [{ op: 'leap', dist: 120, air: 0.55, r: 74, mul: 3.2, status: 'poison', stacks: 3, stun: 0.8 }] } },
  mirrorBlade: { base: 'sword', t: 7, r: 4, s: 'weapon_duel_sword', tint: TINT.mirror, name: '거울검', lore: '피한 공격을 비춰 되돌려 준다.',
    st: { agi: 7, str: 5 }, fx: [on('dodge', 1, strike(34, 2.0, 'arcane', 'arcane'), '피하면 둘레에 거울 반격')],
    sk: { name: '거울 베기', cd: 8, desc: '나와 거울상이 한 번씩 벤다.', mo: 'overhead', do: [{ op: 'cone', range: 48, angle: 2.0, mul: 2.0, fx: 'sweep' }, { op: 'cone', range: 48, angle: 2.0, mul: 2.0, fx: 'sweep', delay: 0.2 }] } },
  leechSpear: { base: 'spear', t: 7, r: 4, tint: TINT.blood, name: '흡혈 창', lore: '꿰뚫은 것의 피를 끌어 올린다.',
    st: { str: 8, lifesteal: 4 },
    sk: { name: '피의 작살', cd: 9, desc: '모두 꿰뚫는 작살을 던져 맞힐 때마다 체력 2% 회복.', mo: 'throw', do: [{ op: 'proj', n: 1, speed: 400, range: 240, mul: 3.0, pierce: 99, onHitHeal: 0.02, kind: 'harpoon' }] } },
  bubbleOrb: { base: 'orb', t: 7, r: 4, tint: TINT.aurora, name: '거품 구슬', lore: '거품 속에 가둔 것은 숨을 쉬지 못한다.',
    st: { mag: 9, spi: 6 },
    sk: { name: '거품 감옥', cd: 11, mana: 30, desc: '조준한 곳의 적을 거품에 가둬 2초 묶는다.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 60, mul: 1.6, stun: 2.0, fx: 'splash' }] } },
  reedCrossbow: { base: 'crossbow', t: 7, r: 4, tint: TINT.reed, name: '갈대 연발 석궁', lore: '쏘는 동안 장전된다. 멈추지 않는다.',
    w: { speed: 1.1 }, st: { sen: 9, agi: 5 },
    sk: { name: '연발 사격', cd: 9, desc: '1초 동안 볼트를 열 발 쏟아붓는다.', mo: 'shoot', do: [{ op: 'channel', dur: 1.0, every: 0.1, sub: { op: 'proj', n: 1, speed: 460, range: 260, mul: 0.6, kind: 'bolt' } }] } },
  mudShield: { base: 'swordShield', t: 7, r: 4, tint: TINT.toad, name: '진흙 방패검', lore: '맞으면 진흙이 튀고, 튄 진흙에는 독이 있다.',
    st: { pres: 12, vit: 8 }, fx: [on('hurt', 0.25, { cloud: { r: 40, dur: 3 } }, '맞으면 25% 확률로 독구름')],
    sk: { name: '진흙 방벽', cd: 12, desc: '3초 동안 받는 피해 -50%, 앞에 4초 동안 느려지는 진흙.', mo: 'guard', do: [{ op: 'buff', id: 'wMud', dur: 3, mods: { dmgTakenMul: 0.5 }, color: '#8a7a4a' }, { op: 'zone', kind: 'slow', r: 80, dur: 4, at: 'aim' }] } },
  queenScepter: { base: 'staff', t: 7, r: 4, s: 'weapon_green_magic_staff', tint: TINT.queen, name: '늪 여왕의 홀', lore: '늪 전체가 이 홀의 말을 듣는다.',
    st: { mag: 12, spi: 6, toxicity: 6 }, fx: [on('kill', 1, { cloud: { r: 44, dur: 4 } }, '처치한 자리에 독구름')],
    sk: { name: '여왕의 칙령', cd: 12, mana: 40, desc: '내 둘레에 독의 칙령. 독 4중첩 · 1초 기절.', mo: 'castBig', do: [{ op: 'aoe', at: 'self', r: 100, mul: 2.6, status: 'poison', stacks: 4, stun: 1.0, fx: 'doom' }] } },

  // ═══ 8단계 · 71~80층 (타오르는 심연) ═══
  infernoBlade: { base: 'sword', t: 8, r: 4, s: 'weapon_red_gem_sword', tint: TINT.infernal, name: '지옥불 검', lore: '심연의 불이 칼날 속에서 숨 쉰다.',
    w: { onHit: onHit('burn', 0.5) }, st: { str: 9, fireAff: 6 }, fx: [flag('burnExplode', '불타는 적이 쓰러지면 폭발한다')],
    sk: { name: '지옥불 참', cd: 9, elem: 'fire', desc: '크게 베고 이어서 지옥불이 앞으로 갈라진다. 화상 3중첩.', mo: 'overhead', do: [{ op: 'cone', range: 56, angle: 2.2, mul: 2.6, stacks: 3, fx: 'sweep' }, { op: 'line', len: 150, w: 30, mul: 2.0, stacks: 1, delay: 0.25, fx: 'skyfall' }] } },
  demonGreat: { base: 'greatsword', t: 8, r: 4, tint: TINT.infernal, name: '악귀 대장의 대검', lore: '맞을수록 강해진다. 악귀 대장은 그래서 피하지 않았다.',
    st: { str: 12, vit: 8 }, fx: [on('hurt', 1, buff('demonGreat', 5, { dmgMul: 1.05 }, null, null, { stack: true, cap: { dmgMul: 1.5 } }), '맞을 때마다 5초 동안 피해 +5% (최대 +50%)')],
    sk: { name: '악귀 회전', cd: 11, desc: '다섯 번 휘돌며 나아간다. 마지막 회전이 가장 세다.', mo: 'spin', do: [{ op: 'comboSpin', n: 5, every: 0.2, step: 16, r: 70, mul: 1.2, last: 3.0, knock: 140 }] } },
  magmaHammer: { base: 'hammer', t: 8, r: 4, s: 'weapon_big_hammer', tint: TINT.magma, name: '용암 심장 망치', lore: '망치 머리에 화산의 심장이 박혀 있다.',
    w: { armorBreak: true }, st: { str: 13 }, fx: [every('hit', 3, strike(60, 1.8, 'fire', 'burst', { status: 'burn', stacks: 1 }), '3번째 타격마다 분화')],
    sk: { name: '분화', cd: 11, elem: 'fire', desc: '땅을 내리쳐 두 번 분화시킨다. 두 번째가 더 넓다.', mo: 'overhead', do: [{ op: 'aoe', at: 'self', r: 70, mul: 2.0, stacks: 2, fx: 'burst' }, { op: 'aoe', at: 'self', r: 110, mul: 2.2, stacks: 1, delay: 0.4, fx: 'quake' }] } },
  phoenixBow: { base: 'bow', t: 8, r: 4, tint: TINT.flame, name: '불사조 활', lore: '쏜 화살은 불사조가 되어 날아간다.',
    st: { sen: 10, agi: 6, fireAff: 4 },
    sk: { name: '불사조 화살', cd: 10, elem: 'fire', desc: '모두 꿰뚫고 크게 터지는 불사조 화살. 화상 4중첩.', mo: 'aim', do: [{ op: 'proj', n: 1, speed: 300, range: 320, mul: 4.2, pierce: 99, splash: 40, stacks: 4, kind: 'fireball' }] } },
  riftGlaive: { base: 'halberd', t: 8, r: 4, tint: TINT.rift, name: '균열 도끼창', lore: '공간째 베어 버린다.',
    st: { str: 11, agi: 5 }, fx: [on('crit', 1, strike(36, 1.4, 'arcane', 'arcane'), '치명타면 균열이 터진다')],
    sk: { name: '차원 절단', cd: 10, elem: 'arcane', desc: '앞으로 아주 길게 공간을 가른다.', mo: 'overhead', do: [{ op: 'line', len: 220, w: 36, mul: 3.6, delay: 0.3, fx: 'skyfall' }] } },
  cinderKnuckle: { base: 'knuckle', t: 8, r: 4, tint: TINT.ember, name: '재의 너클', lore: '여덟 번째 주먹에서 화산이 터진다.',
    w: { onHit: onHit('burn', 0.3) }, st: { str: 7, agi: 8, fireAff: 4 }, fx: [every('hit', 8, strike(40, 2.0, 'fire', 'burst'), '8번째 타격마다 화산 폭발')],
    sk: { name: '화산 주먹', cd: 9, elem: 'fire', desc: '1초 동안 불 주먹을 퍼붓고 마지막에 크게 터뜨린다.', mo: 'stab', do: [{ op: 'channel', dur: 1.0, every: 0.1, sub: { op: 'single', range: 32, mul: 0.6, stacks: 1, fx: 'stab' } }, { op: 'aoe', at: 'self', r: 60, mul: 2.4, stacks: 2, fx: 'burst', delay: 1.05 }] } },
  starfallOrb: { base: 'orb', t: 8, r: 4, tint: TINT.star, name: '별똥 구슬', lore: '밤하늘의 별똥별을 부르는 구슬.',
    st: { mag: 12, spi: 6 },
    sk: { name: '별똥별', cd: 11, mana: 40, elem: 'arcane', desc: '조준한 곳에 별똥별이 네 번 떨어진다.', mo: 'castBig', do: [0.3, 0.45, 0.6, 0.75].map((d) => ({ op: 'aoe', at: 'aim', r: 54, mul: 1.6, fx: 'arcane', delay: d })) } },
  brimstoneTome: { base: 'tome', t: 8, r: 4, tint: TINT.magma, name: '유황 서', lore: '읽는 사이 책장이 탄다. 다 타기 전에 끝내야 한다.',
    st: { mag: 12, fireAff: 8 }, fx: [flag('burnSpread', '불타는 적이 쓰러지면 불이 옮겨 붙는다'), flag('burnCatch', '불이 더 잘 붙는다')],
    sk: { name: '유황 비', cd: 12, mana: 45, elem: 'fire', desc: '조준한 곳에 유황 덩이가 떨어진다. 화상 4중첩.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 90, mul: 2.8, stacks: 4, delay: 0.5, fx: 'burst' }] } },
  gateAxe: { base: 'axe', t: 8, r: 4, s: 'weapon_double_axe', tint: TINT.infernal, name: '관문 파괴 도끼', lore: '심연의 관문을 부순 도끼.',
    w: { armorBreak: true, critDmg: 0.3 }, st: { str: 12 },
    sk: { name: '관문 파괴', cd: 10, desc: '앞을 부숴 날려 보내고 0.8초 기절.', mo: 'chop', do: [{ op: 'cone', range: 52, angle: 2.4, mul: 3.4, stun: 0.8, knock: 200, fx: 'sweep' }] } },
  riftLordStaff: { base: 'staff', t: 8, r: 4, s: 'weapon_red_magic_staff', tint: TINT.rift, name: '균열 군주의 지팡이', lore: '공간을 접었다 펴는 지팡이.',
    st: { mag: 15, spi: 8 }, fx: [on('crit', 1, strike(40, 1.5, 'lightning', 'burst', { status: 'shock' }), '치명타면 번개가 떨어진다')],
    sk: { name: '균열 붕괴', cd: 13, mana: 50, elem: 'arcane', desc: '조준한 곳을 짓눌러 묶은 뒤 터뜨린다.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 80, mul: 1.0, stun: 0.8, fx: 'implode' }, { op: 'aoe', at: 'aim', r: 80, mul: 3.6, delay: 0.6, fx: 'arcane' }] } },

  // ═══ 9단계 · 81~90층 (영겁의 서리) ═══
  eternalFrost: { base: 'sword', t: 9, r: 4, s: 'weapon_anime_sword', tint: TINT.frost, name: '영겁 서리검', lore: '녹은 적이 없는 칼. 지나간 자리는 영원히 언다.',
    w: { onHit: onHit('chill', 0.5) }, st: { agi: 11, iceAff: 8 }, fx: [flag('frozenVuln', '얼어붙은 적에게 피해 증가')],
    sk: { name: '영겁의 일섬', cd: 10, elem: 'ice', desc: '번개처럼 베고 지나간 뒤 서리가 터진다. 1초 빙결.', mo: 'dashSlash', do: [{ op: 'dash', dist: 150, mul: 3.2, stacks: 3 }, { op: 'aoe', at: 'self', r: 60, mul: 1.8, stun: 1.0, delay: 0.2, fx: 'shatter' }] } },
  ogreKingMaul: { base: 'hammer', t: 9, r: 4, tint: TINT.glacier, name: '오우거 왕의 망치', lore: '숨을 고를 때마다 더 무거워진다.',
    w: { speed: 0.7 }, st: { str: 16, vit: 10 }, fx: [on('kill', 1, buff('ogre', 4, { dmgTakenMul: 0.9 }, '오우거의 가죽', '#e8f8ff'), '처치하면 4초 동안 받는 피해 -10%')],
    sk: { name: '눈사태', cd: 12, desc: '높이 뛰어 눈사태처럼 내리찍는다. 1.5초 기절.', mo: 'leap', do: [{ op: 'leap', dist: 150, air: 0.6, r: 90, mul: 4.0, stun: 1.5 }] } },
  blizzardBow: { base: 'bow', t: 9, r: 4, tint: TINT.glacier, name: '눈폭풍 활', lore: '쏘는 동안 눈폭풍이 인다.',
    st: { sen: 12, agi: 8 },
    sk: { name: '눈폭풍 사격', cd: 10, elem: 'ice', desc: '1.2초 동안 얼음 화살을 두 발씩 퍼붓는다.', mo: 'shoot', do: [{ op: 'channel', dur: 1.2, every: 0.1, sub: { op: 'proj', n: 2, spread: 0.2, speed: 400, range: 260, mul: 0.7, stacks: 1, kind: 'ice' } }] } },
  crystalOrb: { base: 'orb', t: 9, r: 4, tint: TINT.star, name: '수정 감옥 구슬', lore: '수정 속에 가둔 것은 시간이 멈춘다.',
    st: { mag: 14, spi: 8 },
    sk: { name: '수정 감옥', cd: 12, mana: 40, elem: 'ice', desc: '조준한 곳을 수정으로 가둬 2.4초 빙결. 냉기 4중첩.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 70, mul: 2.0, stacks: 4, stun: 2.4, fx: 'shatter' }] } },
  glacialGlaive: { base: 'halberd', t: 9, r: 4, tint: TINT.frost, name: '빙하 도끼창', lore: '찌른 자리부터 빙하가 자란다.',
    st: { str: 13, iceAff: 6 },
    sk: { name: '빙하 창진', cd: 10, elem: 'ice', desc: '앞으로 빙하가 길게 솟는다. 냉기 3중첩 · 1초 빙결.', mo: 'stab', do: [{ op: 'line', len: 200, w: 40, mul: 3.0, stacks: 3, stun: 1.0, delay: 0.2, fx: 'skyfall' }] } },
  frostWitchTome: { base: 'tome', t: 9, r: 4, tint: TINT.glacier, name: '서리 마녀 원본', lore: '서리 마녀가 직접 쓴 원본. 베낀 책과는 차원이 다르다.',
    st: { mag: 16, iceAff: 10 }, fx: [add('freezeTime', 0.8, '얼리는 시간 +0.8초')],
    sk: { name: '영구 동토', cd: 14, mana: 55, elem: 'ice', desc: '내 둘레를 영구 동토로. 냉기 5중첩 · 1.8초 빙결.', mo: 'castBig', do: [{ op: 'aoe', at: 'self', r: 120, mul: 3.0, stacks: 5, stun: 1.8, fx: 'zero' }] } },
  avalancheAxe: { base: 'axe', t: 9, r: 4, s: 'weapon_waraxe', tint: TINT.glacier, name: '눈사태 도끼', lore: '던지면 눈사태가 되어 굴러간다.',
    st: { str: 14 },
    sk: { name: '얼음 도끼 투척', cd: 9, elem: 'ice', desc: '모두 꿰뚫는 거대한 얼음 도끼 셋을 던진다.', mo: 'throwBig', do: [{ op: 'proj', n: 3, spread: 0.3, speed: 260, range: 220, mul: 2.2, pierce: 99, stacks: 2, kind: 'bigaxe' }] } },
  polarKnives: { base: 'knives', t: 9, r: 4, tint: TINT.aurora, name: '극지 투척 단검', lore: '오로라 빛으로 벼린 단검 열여섯 자루.',
    w: { crit: 0.12 }, st: { agi: 13 },
    sk: { name: '극광 칼날', cd: 9, elem: 'ice', desc: '단검 열여섯 자루를 넓게 흩뿌린다.', mo: 'throw', do: [{ op: 'proj', n: 16, spread: 0.39, speed: 380, range: 200, mul: 0.7, stacks: 1, kind: 'knife' }] } },
  shardWhip: { base: 'whip', t: 9, r: 4, tint: TINT.frost, name: '얼음 조각 채찍', lore: '마디마다 얼음 조각이 박혀 있다.',
    st: { agi: 10, iceAff: 6 },
    sk: { name: '얼음 조각 회오리', cd: 9, elem: 'ice', desc: '채찍을 한 바퀴 휘돌려 둘레를 모두 벤다.', mo: 'spin', do: [{ op: 'cone', range: 96, angle: 6.28, mul: 2.4, stacks: 2, fx: 'sweep' }] } },
  glacierShield: { base: 'swordShield', t: 9, r: 4, tint: TINT.glacier, name: '빙하 방패검', lore: '방패에 닿은 것은 얼어붙는다.',
    st: { pres: 18, mres: 14, vit: 10 }, fx: [on('hurt', 0.3, { status: 'chill', stacks: 2 }, '맞으면 30% 확률로 때린 적에게 냉기 2중첩')],
    sk: { name: '빙하 요새', cd: 13, elem: 'ice', desc: '4초 동안 받는 피해 -60%, 둘레를 얼린다.', mo: 'guard', do: [{ op: 'buff', id: 'wGlacier', dur: 4, mods: { dmgTakenMul: 0.4 }, color: '#e8f8ff' }, { op: 'aoe', at: 'self', r: 70, mul: 2.0, stacks: 3, fx: 'zero' }] } },

  // ═══ 10단계 · 91~100층 (탑의 꼭대기) ═══
  towerLight: { base: 'greatsword', t: 10, r: 4, s: 'weapon_golden_sword', tint: TINT.light, name: '탑의 빛', lore: '꼭대기의 꺼져 가던 빛을 칼로 벼렸다.',
    st: { str: 18, vit: 10, spi: 6 }, fx: [every('hit', 5, strike(70, 3.0, 'phys', 'holy'), '5번째 타격마다 빛기둥')],
    sk: { name: '꺼져 가던 빛', cd: 12, desc: '조준한 곳에 거대한 빛기둥. 1.5초 기절.', mo: 'overhead', do: [{ op: 'aoe', at: 'aim', r: 90, mul: 5.0, stun: 1.5, delay: 0.5, fx: 'holy' }] } },
  engraveKingBlade: { base: 'sword', t: 10, r: 4, s: 'weapon_lavish_sword', tint: TINT.gold, name: '각인왕의 각검', lore: '쓰러뜨린 적마다 각인이 하나씩 새겨진다.',
    st: { str: 14, agi: 10 }, fx: [on('kill', 1, buff('engraveKing', 10, { dmgMul: 1.08 }, null, null, { stack: true, cap: { dmgMul: 1.6 } }), '처치마다 10초 동안 피해 +8% (최대 +60%)')],
    sk: { name: '각인 새기기', cd: 10, desc: '세 번 연달아 크게 벤다.', mo: 'overhead', do: [0, 0.15, 0.3].map((d) => ({ op: 'cone', range: 58, angle: 2.4, mul: 3.0, fx: 'sweep', delay: d })) } },
  voidStaff: { base: 'staff', t: 10, r: 4, s: 'weapon_green_magic_staff', tint: TINT.void, name: '공허의 지팡이', lore: '빛도 빨아들이는 지팡이.',
    st: { mag: 20, spi: 10 }, fx: [on('crit', 1, strike(50, 2.0, 'dark', 'doom'), '치명타면 공허가 터진다')],
    sk: { name: '공허 붕괴', cd: 14, mana: 60, elem: 'dark', desc: '조준한 곳을 짓눌러 묶은 뒤 공허로 터뜨린다.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 110, mul: 1.0, stun: 1.0, fx: 'implode' }, { op: 'aoe', at: 'aim', r: 90, mul: 6.0, delay: 0.8, fx: 'doom' }] } },
  stormBow: { base: 'bow', t: 10, r: 4, tint: TINT.storm, name: '폭풍의 활', lore: '시위를 당기면 하늘이 흐려진다.',
    w: { onHit: onHit('shock', 0.4) }, st: { sen: 16, agi: 10 }, fx: [every('hit', 4, strike(40, 2.0, 'lightning', 'burst', { status: 'shock' }), '4번째 공격마다 벼락')],
    sk: { name: '폭풍 화살', cd: 11, elem: 'lightning', desc: '모두 꿰뚫는 번개 화살을 쏘고, 번개가 적 사이를 여섯 번 튄다.', mo: 'aim', do: [{ op: 'proj', n: 1, speed: 500, range: 340, mul: 6.0, pierce: 99, stacks: 3, kind: 'arrow' }, { op: 'chain', jumps: 6, range: 110, mul: 2.0, stacks: 1, delay: 0.2 }] } },
  reaperOfTower: { base: 'scythe', t: 10, r: 4, tint: TINT.void, name: '탑의 사신', lore: '탑에서 쓰러진 모든 이의 이름을 안다.',
    w: { onHit: onHit('curse', 0.4) }, st: { str: 16, agi: 8 }, fx: [on('kill', 1, strike(50, 1.6, 'dark', 'corpse'), '처치한 적이 터진다')],
    sk: { name: '사신의 원', cd: 12, desc: '여섯 번 휘돌며 나아간다. 마지막 회전이 가장 세다.', mo: 'spin', do: [{ op: 'comboSpin', n: 6, every: 0.18, step: 12, r: 76, mul: 1.4, last: 4.0, knock: 160 }] } },
  dragonSpearT: { base: 'spear', t: 10, r: 4, s: 'weapon_dragon_spear', tint: TINT.dragon, name: '용의 창', lore: '용의 뼈로 만든 창. 찌르면 용의 숨이 뿜어진다.',
    w: { onHit: onHit('burn', 0.4) }, st: { str: 15, agi: 9, fireAff: 6 },
    sk: { name: '용의 돌진', cd: 11, elem: 'fire', desc: '길게 돌진하며 꿰뚫고, 지나간 길에 불길이 솟는다. 화상 4중첩.', mo: 'stab', do: [{ op: 'dash', dist: 180, mul: 4.0, stacks: 4 }, { op: 'aoe', at: 'self', r: 64, mul: 2.4, stacks: 2, delay: 0.2, fx: 'burst' }] } },
  thunderGod: { base: 'hammer', t: 10, r: 4, s: 'weapon_big_hammer', tint: TINT.storm, name: '뇌신의 망치', lore: '들 수 있는 자만이 하늘을 부른다.',
    w: { onHit: onHit('shock', 0.5) }, st: { str: 20, vit: 12 }, fx: [every('hit', 3, strike(60, 2.5, 'lightning', 'burst', { status: 'shock' }), '3번째 타격마다 벼락')],
    sk: { name: '뇌신 강림', cd: 13, elem: 'lightning', desc: '뛰어올라 벼락처럼 내리꽂고, 번개가 적 사이를 여덟 번 튄다.', mo: 'leap', do: [{ op: 'leap', dist: 160, air: 0.6, r: 96, mul: 5.0, stun: 1.5, stacks: 3 }, { op: 'chain', jumps: 8, range: 120, mul: 2.0, stacks: 1, delay: 0.7 }] } },
  eclipseOrb: { base: 'orb', t: 10, r: 4, tint: TINT.void, name: '일식의 구슬', lore: '해를 가린 달을 담았다.',
    st: { mag: 22, spi: 12 },
    sk: { name: '일식', cd: 14, mana: 60, elem: 'dark', desc: '어둠의 구슬 여덟이 10초 동안 둘레를 돌고, 둘레가 한 번 크게 터진다.', mo: 'castBig', do: [{ op: 'orbit', n: 8, dur: 10, r: 44, mul: 1.4 }, { op: 'aoe', at: 'self', r: 100, mul: 3.0, fx: 'doom' }] } },
  worldTome: { base: 'tome', t: 10, r: 4, tint: TINT.world, name: '세계의 서', lore: '세상이 처음 쓰일 때의 책. 마지막 장은 아직 비어 있다.',
    st: { mag: 22, fireAff: 6, iceAff: 6, spi: 8 },
    sk: { name: '세 원소의 장', cd: 14, mana: 60, elem: 'arcane', desc: '조준한 곳에 화염 · 서리 · 비전이 차례로 터진다.', mo: 'castBig', do: [{ op: 'aoe', at: 'aim', r: 80, mul: 2.6, fx: 'burst', delay: 0.2 }, { op: 'aoe', at: 'aim', r: 80, mul: 2.6, fx: 'ice', delay: 0.45 }, { op: 'aoe', at: 'aim', r: 90, mul: 3.4, fx: 'arcane', delay: 0.7 }] } },
  lastEngraving: { base: 'sword', t: 10, r: 4, s: 'weapon_anime_sword', tint: TINT.world, name: '마지막 각인', lore: '탑을 다 오른 자에게만 모습을 보인다는 검.',
    w: { crit: 0.2, critDmg: 0.5, speed: 1.8 }, st: { str: 16, agi: 16, mag: 10 },
    fx: [every('hit', 3, strike(40, 2.2, 'arcane', 'arcane'), '3번째 타격마다 각인이 터진다'), on('kill', 1, buff('lastEng', 6, { moveSpeed: 1.15, atkSpeed: 1.15 }, '각인의 춤', '#ff9ad8'), '처치하면 6초 동안 이동 · 공격 속도 +15%')],
    sk: { name: '마지막 각인', cd: 14, desc: '1.6초 동안 무적으로 적 사이를 달려 지나가며 벤 뒤, 둘레에 거대한 각인이 터진다.', mo: 'stab', do: [{ op: 'channel', dur: 1.6, every: 0.2, invuln: true, sub: { op: 'danceStrike', r: 140, mul: 2.6 } }, { op: 'aoe', at: 'self', r: 120, mul: 4.0, delay: 1.7, fx: 'holy' }] } },
};

// ── 무기마다 어울리는 연출: 이름 · 색으로 계열을 정하고 터지는 모습을 그 계열로 맞춘다 ──
// 심연 · 공허 · 망령 → 어둠의 문과 촉수, 빛 · 별 · 황금 → 빛기둥, 폭풍 · 번개 → 벼락, 서리 · 얼음 → 얼음 가시, 불 · 용 · 용암 → 폭발,
// 숲 · 가시 · 이끼 → 덩굴, 늪 · 독 → 독구름, 균열 · 비전 → 비전 문양, 뼈 · 재 · 흑요석 → 땅이 갈라진다
const NERF = 0.85; // 탑의 무기 너프 (위력 · 능력치)
const THEMES = [
  ['blood', /피의|피 |핏|선혈|흡혈/, ['blood'], { fx: 'thorns', elem: 'phys' }],
  ['bone', /뼈|해골|송곳니/, ['bone'], { fx: 'bones', elem: 'phys' }],
  ['star', /별|유성|혜성/, ['star'], { fx: 'starfall', elem: 'holy' }],
  ['mirror', /거울|수정|유리/, ['mirror'], { fx: 'shards', elem: 'arcane' }],
  ['wind', /바람|돌풍|회오리|태풍/, [], { fx: 'gale', elem: 'wind' }],
  ['abyss', /심연|공허|망령|영혼|어둠|사신|일식|그림자/, ['void', 'wraith', 'soul', 'grave'], { fx: 'doom', elem: 'dark' }],
  ['light', /빛|성스|태양|황금|각인|신성/, ['light', 'gold'], { fx: 'holy', elem: 'holy' }],
  ['storm', /폭풍|번개|뇌|벼락|천둥/, ['storm'], { fx: 'burst', elem: 'lightning' }],
  ['frost', /서리|얼음|겨울|빙|눈보라|오로라/, ['frost', 'glacier', 'aurora'], { fx: 'ice', elem: 'ice' }],
  ['fire', /불|화염|용암|용의|지옥|불씨|마그마/, ['ember', 'magma', 'flame', 'infernal', 'dragon'], { fx: 'burst', elem: 'fire' }],
  ['nature', /숲|가시|이끼|덩굴|수관|포자/, ['moss', 'thorn', 'spore', 'reed'], { fx: 'vines', elem: 'forest' }],
  ['poison', /늪|독|두꺼비/, ['bog', 'venom', 'toad', 'queen'], { fx: 'miasma', elem: 'poison' }],
  ['arcane', /균열|비전|주술|세계|저주/, ['rift', 'hex', 'world'], { fx: 'arcane', elem: 'arcane' }],
  ['earth', /재|흑요석|껍질|바위|대지/, ['ash', 'obsidian', 'shell'], { fx: 'quake', elem: 'phys' }],
];
const TINT_KEY = Object.fromEntries(Object.entries(TINT).map(([k, v]) => [v, k]));
function themeOf(x, T) {
  const tk = TINT_KEY[x.tint];
  for (const [id, re, tints, look] of THEMES) if (re.test(x.name)) return { id, ...look };
  for (const [id, , tints, look] of THEMES) if (tints.includes(tk)) return { id, ...look };
  return null; // 계열이 없으면 원래 연출 그대로
}
// 터지는 연출만 바꾼다 (피해 종류는 그대로 — 번개 · 불처럼 원소로 그려지는 것만 원소도 맞춘다)
function retheme(list, th) {
  if (!th || !list) return;
  const fix = (o) => {
    if (!o || typeof o !== 'object') return;
    if (o.fx && o.fx !== 'sweep' && o.fx !== 'slashX' && o.fx !== 'claws') { o.fx = th.fx; if (th.id === 'storm' || th.id === 'fire') o.elem = th.elem; }
    for (const v of Object.values(o)) if (v && typeof v === 'object') fix(v);
  };
  for (const a of list) fix(a);
}

// ── 장비 목록 · 스킬 목록에 올린다 ──
const MO = { blade: 'overhead', great: 'overhead', axe: 'chop', blunt: 'overhead', polearm: 'stab', scythe: 'spin', whip: 'lash', fist: 'stab', shield: 'bash', bow: 'shoot', throw: 'throw', staff: 'castBig', tome: 'cast' };
const round = (v) => Math.round(v * 100) / 100;
for (const [id, x] of Object.entries(TOWER_WEAPONS)) {
  const T = WTYPES[x.base], R = W_RARITY[x.r];
  const sid = 'wx_' + id;
  const weapon = { ...T.weapon, ...(x.w || {}), cat: T.cat, skill: sid };
  weapon.mul = round((x.w?.mul ?? T.weapon.mul) * tierPower(x.t) * R.mul * NERF);
  const stats = { ...(T.stats || {}) };
  for (const [k, v] of Object.entries(x.st || {})) stats[k] = (stats[k] || 0) + (k === 'lifesteal' ? v : Math.round(v * statScale(x.t) * NERF));
  const theme = themeOf(x, T); retheme(x.fx, theme); retheme(x.sk?.do, theme);
  const fx = x.fx || [];
  ITEMS[id] = {
    name: x.name, slot: 'weapon', price: 0, towerWeapon: true, tier: x.t, rarity: x.r, rarityColor: R.color, cat: T.cat, weapon, stats, tags: x.tags || [],
    effects: fx, art: { ...T.art, s: x.s || T.art.s, tint: x.tint || '', glow: R.glow }, desc: x.lore,
    lines: [`${R.name} · ${x.t}단계 (${x.t * 10 - 9}~${x.t * 10}층) · 위력 ×${weapon.mul}`, ...fx.map((f) => f.text)],
  };
  const sk = x.sk;
  SKILLS[sid] = { ...sk, weaponSkill: true, role: '무기', scale: weapon.dmg === 'mag' ? 'mag' : 'phys', mo: sk.mo || MO[T.cat], kind: 'weapon', fx: sk.fx || (sk.elem === 'fire' ? 'bolt' : sk.elem === 'ice' ? 'ice' : 'slash') };
  WEAPON_SKILLS[sid] = { name: sk.name, desc: sk.desc, cd: sk.cd, mana: sk.mana };
}
export const TOWER_WEAPON_IDS = Object.keys(TOWER_WEAPONS);

// 떨어뜨릴 무기 고르기: 그 층의 단계 무기가 주로, 한 단계 아래가 가끔. 높은 등급일수록 드물다
const R_WEIGHT = [10, 6, 3, 1.4, 0.6];
export function rollTowerWeapon(f, rnd) {
  const band = Math.max(1, Math.min(10, Math.ceil(f / 10)));
  const tier = band > 1 && rnd() < 0.3 ? band - 1 : band;
  const pool = TOWER_WEAPON_IDS.filter((id) => TOWER_WEAPONS[id].t === tier);
  const total = pool.reduce((a, id) => a + R_WEIGHT[TOWER_WEAPONS[id].r], 0);
  let u = rnd() * total;
  for (const id of pool) { u -= R_WEIGHT[TOWER_WEAPONS[id].r]; if (u <= 0) return id; }
  return pool[pool.length - 1];
}

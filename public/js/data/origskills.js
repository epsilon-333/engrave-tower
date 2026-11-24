// 독창 스킬 (2026-11-24): 스킬을 나눠 쓰던 각인마다 동작부터 새로 만든 자기 스킬 (뼈대 + 덧붙는 효과가 아니다)
// 각인 하나 = 스킬 하나 = 실행 종류 하나(k). 실행은 sim/origrun.js(origOp) · 시험 tools/tests/variants.mjs
// 갈래 · 종족 · 자원 · 쿨타임은 그 각인이 원래 쓰던 스킬을 따른다(누가 쓸 수 있는가만). 동작 · 피해 · 연출은 모두 새것
// 대가(price)는 독창 스킬 전체에서 30개 이하 · 대가가 있으면 그만큼 세다. 수치는 desc에 그대로 적는다
// 밸런스: node tools/skillbal.mjs gen 이 독창 스킬도 재서 SKILL_BAL_GEN에 쓴다 (없으면 1)

const O = (k, o = {}) => [{ op: 'orig', k, ...o }];

// eid → 스킬. mo · fx · elem · marks · price(hp: 최대 체력 비율 · res: 자원 배수 · 나도 상태이상은 marks의 selfStatus)
export const ORIG_SKILLS = {
  m_slime: { id: 'o_stickyGlob', name: '끈적 방울', mo: 'throw', fx: 'splash', elem: 'poison',
    desc: '점액 방울을 던진다(공격력 60%). 맞은 적에 달라붙어 1.5초 뒤 둘레 70의 적을 그 자리로 끌어모으며 터진다(110% · 2초 둔화).', do: O('stickyGlob', { mul: 0.6, mul2: 1.1, r: 70 }), marks: ['ranged'] },
  m_bigBeetle: { id: 'o_rollBack', name: '등껍질 구르기', mo: 'dash', fx: 'dash',
    desc: '몸을 말아 앞으로 90 굴러가며 치고(80%), 0.35초 뒤 같은 길로 되굴러 온다(80%). 구르는 1.2초 동안 받는 피해 -30%.', do: O('rollBack', { mul: 0.8, dist: 90 }), marks: ['scale:vit', 'multi'] },
  m_coralCrab: { id: 'o_spineShell', name: '산호 가시 껍질', mo: 'guard', fx: 'bubble',
    desc: '2초 동안 껍질을 닫아 받는 피해 -40%. 그동안 맞은 횟수 하나마다 가시 2개(기본 4 · 최대 12)가 껍질이 열릴 때 사방으로 날아간다(가시마다 45%).', do: O('spineShell', { mul: 0.45, dur: 2 }), marks: ['multi'] },
  m_dgSlimeKing: { id: 'o_bounce3', name: '말랑 튀어 오르기', mo: 'leap', fx: 'slam',
    desc: '조준한 쪽으로 세 번 튀어 간다. 떨어질 때마다 둘레 40 · 32 · 26에 90% · 70% · 60% · 튀는 동안 맞지 않는다.', do: O('bounce3', { muls: [0.9, 0.7, 0.6], rs: [40, 32, 26] }), marks: ['multi'] },
  kShell: { id: 'o_absorbWave', name: '받아 넘기기', mo: 'guard', fx: 'parry',
    desc: '1.2초 막는 자세(받는 피해 -70%). 끝나면 앞쪽 90에 파동(80%) — 막는 동안 받은 피해의 3배가 더해진다(공격력 300%까지).', do: O('absorbWave', { mul: 0.8, dur: 1.2 }) },
  m_goblin: { id: 'o_sandStab', name: '모래 뿌리고 찌르기', mo: 'stab', fx: 'smoke',
    desc: '앞쪽 50에 모래를 뿌려(30%) 0.6초 기절시키고, 가장 가까운 적의 등 뒤로 돌아가 찌른다(100% · 등 뒤 1.5배).', do: O('sandStab', { mul: 0.3, mul2: 1.0 }), marks: ['crit'] },
  m_hyena: { id: 'o_packBite', name: '무리 몰이 물기', mo: 'bite', fx: 'bite',
    desc: '앞의 적 하나를 문다. 둘레 90의 적 하나마다 한 번 더(1 + 둘레 적 수 · 최대 6번) · 한 번에 45% · 출혈 1중첩.', do: O('packBite', { mul: 0.45 }), marks: ['multi'] },
  m_gearSpider: { id: 'o_sawOrbit', name: '톱니 바퀴 다리', mo: 'spin', fx: 'spin',
    desc: '톱날 셋이 2.5초 동안 나를 돈다(닿을 때 35% · 같은 적은 0.35초마다). 톱날이 맞힌 횟수 하나마다 6초 안에 쓰는 다음 스킬 +6%(최대 +60%). 대가: 자원 ×1.5.', do: O('sawOrbit', { mul: 0.35, dur: 2.5 }), price: { res: 1.5 }, marks: ['multi'] },
  sRake: { id: 'o_returnSlash', name: '되감기 발톱', mo: 'claw', fx: 'claws', elem: 'wind',
    desc: '선 자리에 바람 표식을 남기고 앞을 할퀸 뒤(60%) 뒤로 70 물러난다. 0.9초 뒤 표식 자리까지 바람처럼 되돌아가며 길 위의 적을 벤다(90%).', do: O('returnSlash', { mul: 0.6, mul2: 0.9 }), marks: ['multi'] },
  m_toad: { id: 'o_tongue', name: '혀 낚아채기', mo: 'point', fx: 'bite', elem: 'poison',
    desc: '혀를 130 뻗어 처음 닿은 적을 내 앞으로 끌어와(70% · 독 2중첩) 0.3초 뒤 한 번 더 문다(50%).', do: O('tongue', { mul: 0.7, mul2: 0.5, range: 130 }), marks: ['ranged'] },
  m_toxShroom: { id: 'o_sporeMines', name: '포자 버섯 심기', mo: 'crouch', fx: 'fog', elem: 'poison',
    desc: '조준한 자리에 포자 버섯 셋을 심는다(5초). 적이 22 안에 오면 터져 둘레 40에 90% · 독 2중첩 (5초가 지나면 저절로 터진다).', do: O('sporeMines', { mul: 0.9, life: 5 }), marks: ['multi'] },
  m_shroom: { id: 'o_rotSeed', name: '썩은 씨앗 화살', mo: 'shoot', fx: 'dart', elem: 'poison',
    desc: '씨앗이 박히는 화살(140%). 3초 안에 그 적이 쓰러지면 그 자리에서 둘레 50 독 폭발(100% · 독 2), 살아 있으면 3초 뒤 씨앗이 터져 50% · 독 3중첩.', do: O('rotSeed', { mul: 1.4, mul2: 1.0 }), marks: ['ranged'] },
  m_sandScorpion: { id: 'o_statusStab', name: '전갈 꼬리 연타', mo: 'stab', fx: 'stab', elem: 'poison',
    desc: '꼬리로 찌른다(50% · 첫 찌르기에 독 1). 그 적에게 걸린 상태이상 종류 하나마다 한 번 더 찌른다(최대 5번).', do: O('statusStab', { mul: 0.5 }), marks: ['multi'] },
  kToxicArrow: { id: 'o_growArrow', name: '멀수록 굵은 화살', mo: 'shoot', fx: 'arrow',
    desc: '날아간 거리만큼 커지는 화살: 맞힌 거리 0 → 240에 피해 90% → 250%, 맞은 자리 둘레 10 + 거리 15%의 다른 적도 절반 피해 · 독 1중첩.', do: O('growArrow', { mul: 0.9, far: 1.6 }), marks: ['ranged', 'scale:sen'] },
  m_salamander: { id: 'o_emberTrail', name: '불씨 뿌리며 달리기', mo: 'dash', fx: 'dash', elem: 'fire',
    desc: '앞으로 100 달리며 불씨 다섯을 떨어뜨린다. 1.2초 뒤 불씨가 차례로 터진다(하나마다 둘레 28에 55% · 화상 1).', do: O('emberTrail', { mul: 0.55, dist: 100 }), marks: ['multi'] },
  m_bogHag: { id: 'o_decoy', name: '환영 분신', mo: 'cast', fx: 'blink', elem: 'dark',
    desc: '선 자리에 환영을 남기고 옆으로 50 빠진다. 환영은 2.5초 동안 0.5초마다 둘레 70의 가장 가까운 적을 베고(55%) 끝에 터진다(둘레 50 · 120%). 대가: 최대 체력 5%.', do: O('decoy', { mul: 0.55, mul2: 1.2 }), price: { hp: 0.05 }, marks: ['multi'] },
  m_imp: { id: 'o_swap', name: '자리 바꾸기 장난', mo: 'cast', fx: 'blink', elem: 'fire',
    desc: '140 안의 적과 자리를 맞바꾼다. 0.25초 뒤 그 적이 선 자리(내가 있던 곳)에서 불꽃이 터진다(둘레 36 · 110% · 화상 1).', do: O('swap', { mul: 1.1, range: 140 }) },
  m_jellyfish: { id: 'o_tendrils', name: '촉수 다발', mo: 'cast', fx: 'ice', elem: 'ice',
    desc: '둘레 80의 적 넷까지 촉수를 꽂는다. 1.5초 동안 0.3초마다 촉수로 찌른다(30% · 냉기 1). 100보다 멀어지면 그 촉수는 끊긴다.', do: O('tendrils', { mul: 0.3 }), marks: ['multi'] },
  m_bogWitch: { id: 'o_hexShare', name: '저주 나눠 주기', mo: 'cast', fx: 'rune', elem: 'dark',
    desc: '적 하나에 낙인(80% · 저주 2). 3초 동안 그 적이 잃은 체력의 40%를 둘레 80의 다른 적들도 똑같이 잃는다.', do: O('hexShare', { mul: 0.8, share: 0.4 }), marks: ['ranged'] },
  sHexDoll: { id: 'o_moveHurt', name: '움직이면 찔리는 인형', mo: 'cast', fx: 'rune', elem: 'dark',
    desc: '적 하나를 인형에 묶는다(60% · 저주 2). 2.5초 동안 그 적이 10 움직일 때마다 바늘이 꽂히고(6%), 끝날 때 한 번 더 찌른다(40%).', do: O('moveHurt', { mul: 0.6, per: 0.06 }) },
  m_watcherEye: { id: 'o_gazeBeam', name: '꿰뚫는 응시', mo: 'point', fx: 'rune', elem: 'light',
    desc: '적 하나를 1.5초 노려본다: 0.25초마다 시선(25% → 한 번마다 +30%), 마지막엔 약화 2초. 200보다 멀어지면 끊긴다. 대가: 노려보는 동안 나도 2초 둔화.', do: O('gazeBeam', { mul: 0.25 }), marks: ['ranged', 'selfStatus:slow'] },
  m_thornSprite: { id: 'o_ricochet', name: '튕기는 가시', mo: 'stab', fx: 'dart',
    desc: '가시 하나를 쏜다. 맞을 때마다(60% · 출혈 1) 120 안의 아직 안 맞은 적에게 튕겨 간다(다섯 번까지).', do: O('ricochet', { mul: 0.6, n: 5 }), marks: ['ranged', 'multi'] },
  m_petalSprite: { id: 'o_vortex', name: '꽃잎 소용돌이', mo: 'cast', fx: 'wind', elem: 'wind',
    desc: '조준한 자리에 2.4초 꽃잎 소용돌이: 0.3초마다 둘레 70의 적을 안쪽으로 끌며 벤다(22%). 끝에 꽃잎이 흩어지며 바깥으로 밀쳐낸다(60%).', do: O('vortex', { mul: 0.22, mul2: 0.6, r: 70 }), marks: ['ranged', 'multi'] },
  m_mossSlug: { id: 'o_slimeTrap', name: '점액 덫', mo: 'crouch', fx: 'trap',
    desc: '조준한 자리에 점액 덫(4초). 적이 밟으면(또는 4초 뒤) 둘레 70의 적을 덫으로 끌어모은 뒤 터진다(둘레 40 · 130% · 2초 둔화).', do: O('slimeTrap', { mul: 1.3 }) },
  m_poisonSpider: { id: 'o_web', name: '거미줄 고치', mo: 'shoot', fx: 'trap', elem: 'poison',
    desc: '조준한 자리 둘레 46에 거미줄(30% · 독 1): 1.5초 묶는다. 풀릴 때 묶인 적 하나마다 모두에게 25%(다섯까지).', do: O('web', { mul: 0.3, per: 0.25 }), marks: ['ranged'] },
  sTrap: { id: 'o_launchTrap', name: '튕겨 올리는 덫', mo: 'crouch', fx: 'trap',
    desc: '조준한 자리에 덫(3초). 밟으면(또는 3초 뒤) 둘레 34의 적을 공중에 띄워 1초 굳히고(40%), 떨어질 때 그 둘레 30에 80%.', do: O('launchTrap', { mul: 0.4, mul2: 0.8 }) },
  sBackDart: { id: 'o_shotgun', name: '뒷걸음 산탄', mo: 'shoot', fx: 'dart', elem: 'poison',
    desc: '뒤로 60 뛰며 독침 다섯(하나 55%)을 쏜다. 가까운 적이 50 안이면 넓게, 100 너머면 좁게 모아 쏜다.', do: O('shotgun', { mul: 0.55, n: 5 }), marks: ['ranged', 'multi'] },
  m_magmaGolem: { id: 'o_lavaFlow', name: '흘러가는 용암', mo: 'stomp', fx: 'quake', elem: 'fire',
    desc: '조준한 쪽으로 용암이 0.22초에 한 칸씩 여섯 칸 흘러간다. 칸마다 둘레 22에 35% · 화상 1, 지나간 자리는 3초 불길.', do: O('lavaFlow', { mul: 0.35 }), marks: ['multi'] },
  kFlameLance: { id: 'o_pierceBlast', name: '꿰뚫고 터지는 창', mo: 'dash', fx: 'dash', elem: 'fire',
    desc: '앞으로 110 꿰뚫고 지나간다(80%). 1.5초 뒤 지나간 길이 다섯 군데 터진다(둘레 26 · 50% · 화상 1). 대가: 쓰면 나도 화상.', do: O('pierceBlast', { mul: 0.8, mul2: 0.5, dist: 110 }), marks: ['multi', 'selfStatus:burn'] },
  m_snowLurker: { id: 'o_burrow', name: '눈 속 잠행', mo: 'crouch', fx: 'ice', elem: 'ice',
    desc: '눈 속으로 가라앉아 0.9초 동안 숨고(맞지 않는다) 조준한 곳 110 안에서 솟구친다: 둘레 44에 140% · 냉기 2 · 0.4초 기절.', do: O('burrow', { mul: 1.4 }) },
  m_seaSerpent: { id: 'o_tide', name: '밀물과 썰물', mo: 'slash', fx: 'wave', elem: 'ice',
    desc: '앞쪽 80에 밀물(80% · 밀쳐냄 60), 0.8초 뒤 앞쪽 120에서 썰물이 되돌아오며(80%) 맞은 적을 내 앞으로 끌어온다.', do: O('tide', { mul: 0.8 }), marks: ['multi'] },
  m_dgIceMatron: { id: 'o_spiralIce', name: '얼음 실 감기', mo: 'cast', fx: 'ice', elem: 'ice',
    desc: '조준한 자리에 얼음 실이 바깥에서 안으로 세 번 감긴다(둘레 70 · 48 · 26 · 0.3초 간격 · 하나에 50% · 냉기 1). 가운데 적은 세 번 다 맞는다.', do: O('spiralIce', { mul: 0.5 }), marks: ['ranged', 'multi'] },
  m_shieldDemon: { id: 'o_shieldBounce', name: '튕겨 오는 방패', mo: 'throw', fx: 'parry',
    desc: '방패를 던져 110 안의 적 셋 사이를 튕긴다(하나 80%). 돌아온 방패가 맞힌 적 하나마다 최대 체력 4%의 보호막(최대 12%).', do: O('shieldBounce', { mul: 0.8, n: 3 }), marks: ['ranged', 'multi'] },
  m_archiveKeeper: { id: 'o_wall', name: '쇠 책갈피 벽', mo: 'stomp', fx: 'spikes',
    desc: '앞쪽 60에 너비 80의 쇠 벽을 2초 세운다. 앞쪽 적을 벽 쪽으로 밀쳐내고(70%), 벽에 부딪힌 적은 1초 기절 · 60%(한 번). 벽 너머로는 지나가지 못한다.', do: O('wall', { mul: 0.7, mul2: 0.6 }) },
  m_lightWarden: { id: 'o_lantern', name: '파수의 등불', mo: 'cast', fx: 'holy', elem: 'light',
    desc: '앞에 등불을 4초 세운다. 0.5초마다 둘레 60의 적에게 30% · 약화 0.6초. 등불 둘레 50 안에 서 있으면 초당 최대 체력 1.2% 회복.', do: O('lantern', { mul: 0.3 }), marks: ['multi'] },
  m_cultist: { id: 'o_prayer', name: '그림자 기도', mo: 'castBig', fx: 'ink', elem: 'dark',
    desc: '0.8초 기도한 뒤, 둘레 200의 모든 적의 그림자에서 손이 솟아 찌른다(160% · 0.6초 기절). 대가: 최대 체력 6%.', do: O('prayer', { mul: 1.6 }), price: { hp: 0.06 }, marks: ['scale:mag'] },
  m_cultShade: { id: 'o_sigilLine', name: '두 성표 잇기', mo: 'cast', fx: 'rune', elem: 'dark',
    desc: '내 발밑과 조준한 자리(140 안)에 검은 성표를 새기고 둘을 잇는다. 2초 동안 0.25초마다 그 줄 위의 적을 벤다(25% · 저주 1).', do: O('sigilLine', { mul: 0.25 }), marks: ['multi'] },
  m_jungleWasp: { id: 'o_swarm', name: '말벌 떼 풀기', mo: 'blow3', fx: 'dart', elem: 'poison',
    desc: '말벌 떼가 4초 동안 날아다니며(초당 150) 가장 가까운 적을 쫓아 0.3초마다 쏜다(18% · 독 1). 쫓던 적이 쓰러지면 다음 적으로.', do: O('swarm', { mul: 0.18, dur: 4 }), marks: ['ranged', 'multi'] },
  m_shardBird: { id: 'o_shardBurst', name: '유리 깃 깨뜨리기', mo: 'blow3', fx: 'dart',
    desc: '유리 깃 다섯을 부채꼴로 박는다(맞으면 30%). 1초 뒤 박힌 자리마다 깨지며 둘레 26에 50% · 출혈 2.', do: O('shardBurst', { mul: 0.3, mul2: 0.5 }), marks: ['ranged', 'multi'] },
  m_harpy: { id: 'o_hop3', name: '깃털 세 번 도약', mo: 'dash', fx: 'claws', elem: 'wind',
    desc: '100 안의 적 사이를 세 번 튕겨 다니며 할퀸다(한 번 55% · 출혈 1 · 0.18초 간격). 남은 적이 없으면 같은 적을 다시.', do: O('hop3', { mul: 0.55 }), marks: ['multi', 'scale:agi'] },
  m_harpyWarrior: { id: 'o_featherNova', name: '칼깃 내려앉기', mo: 'leap', fx: 'slam', elem: 'wind',
    desc: '날아올라(0.5초 · 맞지 않는다) 조준한 곳 90 안에 내려앉으며 둘레 30에 50%, 칼깃 여덟이 사방으로 날아간다(하나 45% · 출혈 1).', do: O('featherNova', { mul: 0.5, mul2: 0.45 }), marks: ['multi'] },
  m_stormHarpy: { id: 'o_stormEye', name: '폭풍의 눈', mo: 'castBig', fx: 'bolt', elem: 'lightning',
    desc: '3초 동안 나를 따라오는 폭풍: 0.3초마다 둘레 120의 적 하나에 벼락(둘레 26 · 55% · 감전), 둘레 적을 나에게로 끌어당긴다. 대가: 최대 체력 8%.', do: O('stormEye', { mul: 0.55, dur: 3 }), price: { hp: 0.08 }, marks: ['multi'] },
  m_wraith: { id: 'o_soulOrbs', name: '혼 구슬 거두기', mo: 'cast', fx: 'soul', elem: 'dark',
    desc: '둘레 120의 적 셋까지 혼을 뽑는다(40%). 뽑은 구슬은 1.2초 뒤 조준한 쪽으로 한꺼번에 날아간다(구슬마다 60% · 하나를 꿰뚫는다).', do: O('soulOrbs', { mul: 0.4, mul2: 0.6 }), marks: ['ranged', 'multi'] },
  m_fireSpirit: { id: 'o_burnHarvest', name: '불꽃 거두기', mo: 'breath', fx: 'breath', elem: 'fire',
    desc: '둘레 100 적의 화상을 모두 거둬, 거둔 중첩 하나마다 +25%(최대 +280%)의 불덩이를 앞으로 쏜다(80% · 셋을 꿰뚫는다). 거둘 화상이 없으면 둘레에 불을 붙인다(40% · 화상 2).', do: O('burnHarvest', { mul: 0.8, mul2: 0.4 }), marks: ['ranged'] },
  m_frostSlug: { id: 'o_iceSlide', name: '얼음길 미끄럼', mo: 'dash', fx: 'dash', elem: 'ice',
    desc: '앞으로 120 얼음길을 깔며 미끄러져 간다. 길 위의 적은 70% · 냉기 2를 받고 옆으로 밀려난다. 얼음길은 3초 남는다.', do: O('iceSlide', { mul: 0.7, dist: 120 }) },
};

// 원래 스킬에서 따라오는 것: 누가 · 무엇으로 쓰는가
const KEEP = ['race', 'cls', 'kind', 'scale', 'cost', 'gain', 'cd', 'cd0', 'unlock', 'role', 'aim', 'hand', 'off', 'need'];
export function registerOrigSkills(SKILLS, ENGRAVING_SKILLS, ENGRAVINGS, SKILL_BAL, SKILL_BAL_GEN = {}) {
  const made = [];
  for (const [eid, o] of Object.entries(ORIG_SKILLS)) {
    const bid = ENGRAVING_SKILLS[eid], base = SKILLS[bid]; if (!base || !ENGRAVINGS[eid]) continue;
    const def = {}; for (const k of KEEP) if (base[k] !== undefined) def[k] = base[k];
    if (base.cost && base.cost > 1) def.cost = base.cost; // 자원을 쓰던 스킬은 그대로 · 자원을 모으던 스킬(+)도 그대로
    Object.assign(def, { name: o.name, desc: `【${ENGRAVINGS[eid].name}】 ${o.desc}`, mo: o.mo, fx: o.fx, do: o.do, marks: o.marks || [], orig: true, fromEng: eid });
    if (o.elem) def.elem = o.elem;
    if (o.price) def.price = o.price;
    if (def.role === '준비' || def.role === '방어' && !['spineShell', 'absorbWave'].includes(o.do[0].k)) def.role = '공격';
    SKILLS[o.id] = def; ENGRAVING_SKILLS[eid] = o.id; made.push(o.id);
    SKILL_BAL[o.id] = SKILL_BAL_GEN[o.id] ?? 1;
  }
  return made;
}
export const hasPrice = (def) => !!(def?.price || def?.vx?.hp || def?.vx?.costK || (def?.marks || []).some((m) => m.startsWith('selfStatus:')));

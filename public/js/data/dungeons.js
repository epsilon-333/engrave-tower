// 탑 밖 던전 (2026-11-23): 탐험 → 사냥 → 각인 고리에서 「탑에 오르기 전 연습 · 재료 수집처」.
// 던전마다 가장 깊은 곳에 그곳에서만 사는 우두머리가 있고, 우두머리의 부산물(그 던전에서만 난다)로 각인 하나를 새긴다.
//   lv: 던전 몬스터의 레벨(입구가 있는 지역에 맞춘다 · 지하로 내려가면 층마다 +2) · boss: 우두머리 · blurb: 입구에서 보여 줄 한 줄
//   first: 처음 정복하면 받는 돈 · 부산물 수량(떨어지는 수 · 각인에 드는 수)은 원래 규칙 그대로 (밸런스 갈래가 정한다)
// 우두머리 몬스터는 있는 몬스터를 바탕으로 이름 · 체력 · 색만 바꿔 만든다 (새 그림 없이 · DUNGEON_BOSSES).
// 부산물 · 각인은 data/monsterparts.js 의 「탑 밖 던전 우두머리」 줄.

export const DUNGEONS = {
  plainsHole: { lv: 3, boss: 'dgSlimeKing', first: 80, blurb: '시작 평원 아래 굴. 슬라임이 모여 왕을 만들었다. 처음 해 보는 던전으로 알맞다.' },
  mossCave: { lv: 12, boss: 'dgMossChief', first: 150, blurb: '이끼 숲 아래 고블린 굴. 족장의 천막 안쪽에 이끼 가면을 쓴 족장이 산다.' },
  forestCave: { lv: 13, boss: 'dgGoblinSage', first: 150, blurb: '숲속 깊은 동굴. 고블린 대주술사가 해골 방울을 흔들며 부하를 부른다.' },
  sunkenTemple: { lv: 17, boss: 'dgTempleWitch', first: 180, blurb: '독늪에 반쯤 잠긴 옛 사원. 물에 젖은 종을 울리는 무녀가 제단을 지킨다.' },
  labyrinth: { lv: 22, boss: 'labyrinthLord', first: 220, blurb: '폐허 도시 아래 미로. 길을 잃은 자들의 군주가 한가운데 방에 있다.' },
  jungleHole: { lv: 22, boss: 'raptorAlpha', first: 220, blurb: '원시림 바닥의 큰 구멍. 랩터 무리의 우두머리가 둥지를 틀었다.' },
  riftCave: { lv: 27, boss: 'dgRiftWarden', first: 260, blurb: '화산 지대의 갈라진 굴. 식지 않는 쐐기를 박은 불꽃 문지기가 균열을 막고 있다.' },
  wasteHole: { lv: 30, boss: 'orcWarlord', first: 280, blurb: '메마른 황야의 구멍. 쫓겨난 오크 족장이 약탈자를 모은다.' },
  mtCave1: { lv: 32, boss: 'dgStoneChief', first: 300, blurb: '북쪽 바위산의 동굴. 돌 왕관을 쓴 고블린 왕이 산 밑을 다스린다.' },
  mtCave2: { lv: 34, boss: 'dgFrostGiant', first: 320, blurb: '바위산 깊은 굴. 언 심장으로 사는 서리 거인이 잠들어 있다.' },
  iceCave: { lv: 37, boss: 'dgIceMatron', first: 340, blurb: '서리 설원의 얼음 동굴. 얼음 물레를 돌리는 서리 노파가 동굴을 얼린다.' },
  crypt: { lv: 42, boss: 'dgCryptWarden', first: 380, blurb: '그림자 묘지 아래 지하 묘지. 녹슨 열쇠 꾸러미를 찬 파수꾼이 무덤을 지킨다.' },
  palace: { lv: 45, boss: 'dragonGuard', first: 420, blurb: '바닷속 소용돌이 아래 용궁. 용궁의 근위가 보물을 지킨다.' },
};

// 우두머리: from(바탕 몬스터) · name · hp · atk · scale(그림 크기 배율) · tint(그림 색, CSS filter) · 그 밖에 덮어쓸 것
export const DUNGEON_BOSSES = {
  dgSlimeKing: { from: 'spikeSlime', name: '왕 슬라임', hp: 320, atk: 9, scale: 1.9, r: 11, tint: 'hue-rotate(-60deg) saturate(1.4) brightness(1.1)', over: { elite: true, xp: 40, gold: 30, echo: { id: 'goo', rate: 1 } } },
  dgMossChief: { from: 'goblinChief', name: '이끼 가면 족장', hp: 380, atk: 15, scale: 1.05, tint: 'hue-rotate(55deg) saturate(1.25) brightness(0.95)', over: { xp: 60, gold: 40 } },
  dgGoblinSage: { from: 'goblinShaman', name: '고블린 대주술사', hp: 360, atk: 10, scale: 1.6, r: 9, tint: 'hue-rotate(-40deg) saturate(1.5) brightness(0.9)', over: { elite: true, xp: 60, gold: 40, echo: { id: 'rust', rate: 1 } } },
  dgTempleWitch: { from: 'bogWitch', name: '가라앉은 사원의 무녀', hp: 800, atk: 13, scale: 1.6, r: 9, tint: 'hue-rotate(140deg) saturate(1.2) brightness(1.05)', over: { elite: true, xp: 90, gold: 60, echo: { id: 'venom', rate: 1 } } },
  dgRiftWarden: { from: 'riftGuard', name: '불꽃 문지기', hp: 1600, atk: 24, scale: 0.9, tint: 'hue-rotate(-25deg) saturate(1.6) brightness(1.1)', over: { xp: 200, gold: 120 } },
  dgStoneChief: { from: 'goblinChief', name: '돌 왕관 고블린 왕', hp: 700, atk: 17, scale: 1.15, tint: 'grayscale(0.75) brightness(1.15) contrast(1.2)', over: { xp: 120, gold: 90, pres: 60 } },
  dgFrostGiant: { from: 'iceGolem', name: '서리 거인', hp: 1700, atk: 26, scale: 1.8, r: 13, tint: 'hue-rotate(20deg) saturate(1.3) brightness(1.15)', over: { elite: true, xp: 220, gold: 140, echo: { id: 'icecore', rate: 1 }, moves: ['maul', 'stomp'], condEcho: undefined } },
  dgIceMatron: { from: 'frostWitch', name: '서리 노파', hp: 2000, atk: 26, scale: 0.95, tint: 'hue-rotate(-30deg) saturate(0.7) brightness(1.2)', over: { xp: 260, gold: 160 } },
  dgCryptWarden: { from: 'graveKeeper', name: '묘지 파수꾼', hp: 3200, atk: 32, scale: 0.9, tint: 'hue-rotate(60deg) saturate(1.2) brightness(1.1)', over: { xp: 420, gold: 260 } },
};
// monsters.js 가 MONSTERS 를 다 적은 뒤 부른다 (부산물을 붙이기 전에)
export function registerDungeonBosses(MONSTERS) {
  for (const [id, B] of Object.entries(DUNGEON_BOSSES)) {
    const base = MONSTERS[B.from];
    MONSTERS[id] = { ...base, name: B.name, hp: B.hp, atk: B.atk, r: B.r || base.r, dungeonBoss: true, ...B.over };
  }
}
// 그림: 바탕 몬스터 그림에 색만 (art.js 가 부른다)
export function registerDungeonArt(MONSTER_ART) {
  for (const [id, B] of Object.entries(DUNGEON_BOSSES)) {
    const a = MONSTER_ART[B.from] || { base: 'goblin' };
    MONSTER_ART[id] = { ...a, scale: (a.scale || 1) * (B.scale || 1), tint: B.tint };
  }
}

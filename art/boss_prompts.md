# 탑 보스 20명 시트 프롬프트

보스마다 시트 한 장. 다 만든 시트는 `art/source/boss_<영문id>.png`로 넣어 주시면 제가 잘라서 게임에 넣습니다.

## 모든 시트에 똑같이 지킬 것 (중요)
- **칸 규칙**: 가로 4칸 × 세로 5줄, 칸 크기는 모두 같게. 칸 사이에 선 · 글자 · 숫자 없음
  - 1줄: 서기 (숨쉬기 4장)
  - 2줄: 걷기 또는 날기 (4장)
  - 3줄: 기본 공격 (치켜들기 → 내려치기 → 따라가기 → 돌아오기)
  - 4줄: 대표 기술 (아래 보스별 설명의 동작)
  - 5줄: 맞음 2장 + 쓰러짐 2장
- **배경**: 한 가지 색으로만 칠한 평평한 배경 (그라데이션 · 바닥 그림자 · 무늬 없음)
- **방향**: 모든 칸이 오른쪽을 본다. 몸 전체가 칸 안에 다 들어가고, 발끝은 모든 칸에서 같은 높이
- **같은 캐릭터**: 20칸 모두 같은 크기 · 같은 색 · 같은 디자인
- **그림체**: 참고 그림으로 `art/source/ref_style_2.webp`(게임 그림체)를 함께 넣는다

## 공통 프롬프트 (보스 설명 앞에 붙인다)
```
Pixel art boss sprite sheet for a top-down 3/4 view dungeon game, same style as the reference (chunky pixels, 1px dark outline, limited palette, strong light from top-left).
Grid: 4 columns x 5 rows, equal cells, no lines, no text, no numbers.
Row 1: idle breathing (4 frames). Row 2: walk/move (4 frames). Row 3: basic attack: wind-up, strike, follow-through, recover (4 frames).
Row 4: signature skill (4 frames, described below). Row 5: hurt (2 frames) then death (2 frames).
Every frame faces right, full body inside the cell, feet on the same baseline, identical character design, size and colors in every frame.
Plain flat single-color background, no gradient, no ground shadow.
The boss must feel huge, intimidating and menacing: big clear silhouette, glowing eyes, dramatic pose.
Boss:
```

## 보스별 (공통 프롬프트 뒤에 붙인다)

| 층 | 파일 이름 | 보스 | 보스 설명 (영문 프롬프트) |
|---|---|---|---|
| 5 | boss_climbChief | 가면 족장 | Massive goblin warlord, tribal bone skull mask, crown of red feathers, fur cape, red war paint, giant spiked bone club. Signature skill: charging shoulder rush with dust. |
| 10 | boss_mossLord | 이끼 군주 | Ancient treant golem of mossy stone and twisted roots, hollow trunk face with glowing green eyes, mushrooms growing on shoulders, long root arms. Signature skill: slams roots into the ground, roots erupt. |
| 15 | boss_bogHag | 늪 마녀 수장 | Tall hunched swamp witch floating above water, long tangled black hair, antlered skull headdress, ragged dripping green robes, staff with hanging charms, glowing green eyes. Signature skill: raises staff, swirling poison magic. |
| 20 | boss_climbQueen | 늪의 거인 | Colossal toxic sludge giant, bubbling green body with bones and skulls floating inside, huge gaping maw, glowing pink core. Signature skill: spews toxic bile upward. |
| 25 | boss_demonCaptain | 방패 악귀 대장 | Armored red demon captain, horned iron helm, massive tower shield with a burning demon face, flaming chains wrapped on arms. Signature skill: raises shield, it glows and reflects. |
| 30 | boss_climbRift | 균열 수호자 | Obsidian and magma golem colossus, cracked black body leaking lava, blazing yellow core in chest, crystal horns. Signature skill: chest core opens and fires a beam. |
| 35 | boss_frostOgre | 얼음 오우거 왕 | Giant white-furred frost ogre king, crown of ice, big tusks, icicle beard, enormous ice-crystal fists. Signature skill: jumps and smashes both fists into the ground. |
| 40 | boss_climbWitch | 서리 마녀 | Ice queen sorceress, tall crystal crown, flowing blue gown with snowflake patterns, ice shards orbiting her. Signature skill: spreads arms, ring of frost bursts out. |
| 45 | boss_wraithLord | 망령 기사단장 | Spectral death knight commander, blue ghost flames leaking from armor gaps, tattered banner cape, huge greatsword, single glowing eye slit. Signature skill: turns into ghost mist and rises. |
| 50 | boss_engraveKing | 각인의 왕 | Golden armored king covered in glowing engraved runes, rune halo behind head, royal cape, ornate rune greatsword. Signature skill: raises sword, runes flare into light. |
| 55 | boss_stormHarpy | 폭풍 하피 여왕 | Harpy queen with huge storm-blue wings, crown of feathers, sharp talons, lightning crackling between feathers. Flies in every frame. Signature skill: beats wings to make a gust. |
| 60 | boss_skyWhale | 하늘 고래 아에로 | Colossal flying sky whale, white and pale blue, fins like clouds, small floating islands with tiny trees on its back, glowing rune patterns. Wide, much bigger than the others. Signature skill: dives with mouth open. |
| 65 | boss_mirrorSelf | 거울에 비친 나 | Doppelganger knight made of cracked silver mirror glass, faceless reflective visor, mirror shards floating around. Signature skill: splits into reflections. |
| 70 | boss_shardQueen | 깨진 거울의 여왕 | Queen of shattered mirrors, gown made of mirror shards, crown of glass, cracked white porcelain face, holding a giant broken hand mirror. Signature skill: raises mirror, shards burst out. |
| 75 | boss_foreman | 공장 감독 | Huge steampunk clockwork foreman robot, brass boiler chest with fire inside, smokestacks on back, one giant wrench arm and one steam hammer arm. Signature skill: hammer slam with steam blast. |
| 80 | boss_clockKeeper | 시간을 멈춘 시계지기 | Tall robed clockmaker spirit, a glowing clock face for a head, golden gears orbiting, hour and minute hands used as blades. Signature skill: raises hands, time freezes (golden clock circle). |
| 85 | boss_archivist | 대서고관 | Towering librarian lich, four arms holding books and a quill staff, robe made of pages, floating tomes, purple glow. Signature skill: swings arm, bookshelf crashes down. |
| 90 | boss_starReader | 별을 읽는 자 | Ancient star sage wizard, robe like a night sky full of constellations, astrolabe staff, eyes of starlight, long white beard. Signature skill: draws a constellation in the air. |
| 95 | boss_highPriest | 교단 대사제 | Dark cult high priest, tall black miter, bone mask, layered black and purple robes, staff with an extinguished lantern, shadow tendrils from the hem. Signature skill: lantern swallows light, dark wave. |
| 100 | boss_lastKing | 마지막 왕 | Radiant tragic last king, white and gold armor, cracked chest showing a glowing light core, long flowing white cape, sword made of light, crown with a halo. Signature skill: light core flares, holy burst. |

## 넣은 뒤에 제가 하는 것
- 칸마다 잘라 배경을 지우고, 발끝을 맞추고, 게임 그림체에 맞게 색을 줄인다 (보스 키: 플레이어의 4~6배)
- 서기 · 걷기 · 공격 · 기술 · 맞음 · 쓰러짐을 보스가 실제로 하는 동작에 맞춰 튼다
- 위압 연출: 등장 때 화면이 어두워지고 보스만 밝게, 포효 · 땅 갈라짐 · 화면 흔들림, 3단계에서 모습이 바뀜

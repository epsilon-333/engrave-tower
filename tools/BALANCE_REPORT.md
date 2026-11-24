# 밸런스 보고 — 각인 재료(잔향) (2026-11-24)

## 규칙 (`public/js/data/recipes.js` · `retuneRecipes`, engravings.js 등록 끝에서 한 번)
- 숨은 각인(증표 하나)은 그대로. 나머지 353개 각인의 recipe를 규칙으로 다시 정한다(손으로 쓰지 않는다).
- 일반 각인: 원래 재료의 주 잔향(설계 의도) + 태그(성질)별 잔향 후보(`TAG_POOL`)에서 각인 id 해시로 1~3개 더 고른다. 등급이 낮으면 앞 지역 잔향만(`MAX_ZONE`).
- 양: 등급별 합계 `RECIPE_TOTAL` = 14 · 22 · 34 · 50 · 72 (±). 4등급 이상은 보스(희귀) 잔향 2~4.
- 몬스터 부산물 각인: 부산물 2×등급+1~2 · 계열 잔향 8/14/22/32/44 · 3등급부터 태그 잔향 하나. 계열이 보스 잔향이면 보스 잔향은 조금, 태그 잔향을 크게.
- 같은 조합 · 거의 같은 조합(같은 잔향들에 양 차이가 모두 1 이하)이 나오면 다시 고른다. 시험 `tools/tests/recipes.mjs`.
- 여정 보상(`grantRaceMats`)은 recipe를 그대로 주므로 첫 각인은 여정 1 보상으로 바로 새길 수 있다.

## 전 → 후 (일반 잔향 평균: 등급1 13.6 · 2 21.6 · 3 36.0 · 4 47.0 · 5 60.1)
| 각인 | 등급 | 전 | 후 |
|---|---|---|---|
| m_slime | 1 | p_slime 2 · goo 3 | p_slime 3 · goo 9 |
| eHerdRoar | 2 | blood 4 · rust 3 | blood 16 · spore 9 |
| eHeadbutt | 2 | bone 4 · goo 3 | bone 10 · magma 8 · icecore 6 |
| eThunderStorm | 4 | wing 6 · mirror 5 · core 1 | wing 17 · goo 15 · blood 17 · core 2 |
| rFlame | 4 | ember 5 · magma 3 · core 1 | ember 22 · goo 14 · wing 18 · core 3 |
| m_swampQueen | 5 | p 6 · queen 7 | p 12 · queen 3 · goo 45 |

같은 조합 0 · 거의 같은 조합 0.

## 남은 것
- 앞 사람의 종족 · 무기 · 몬스터 밸런스(작업 중 저장 커밋, tools/monbal.mjs · ttkclimb.mjs)는 손대지 않았다.
- 몬스터 부산물이 떨어지는 확률은 그대로 — 실제 사냥 횟수 체감은 플레이로 확인 필요.

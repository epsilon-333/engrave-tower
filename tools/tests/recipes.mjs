// 각인 재료 시험: 같은 조합 0 · 거의 같은 조합 0 · 등급이 오를수록 많이 · 숨은 각인은 증표 하나
import { ENGRAVINGS } from '../../public/js/data/engravings.js';
import { ECHOES } from '../../public/js/data/monsters.js';
import { recipeKey, recipesNear, TAG_POOL, Z, MAX_ZONE } from '../../public/js/data/recipes.js';
let fail = 0; const bad = (m) => { fail++; console.log('FAIL', m); };
const list = Object.entries(ENGRAVINGS).filter(([, e]) => !e.hidden && e.recipe);
const seen = new Map(); const sum = [0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0];
for (const [id, e] of list) {
  const k = recipeKey(e.recipe); if (seen.has(k)) bad(`같은 재료: ${id} = ${seen.get(k)}`); seen.set(k, id);
  for (const k2 of Object.keys(e.recipe)) if (!ECHOES[k2]) bad(`없는 잔향 ${id}:${k2}`);
  const n = Object.entries(e.recipe).filter(([k2]) => !ECHOES[k2]?.rare).reduce((a, [, v]) => a + v, 0);
  sum[e.grade] += n; cnt[e.grade]++; if (n < 10) bad(`너무 적다 ${id} ${n}`);
}
for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (recipesNear(list[i][1].recipe, list[j][1].recipe)) bad(`거의 같은 재료: ${list[i][0]} ~ ${list[j][0]}`);
const avg = sum.map((s, g) => (cnt[g] ? s / cnt[g] : 0)); console.log('등급별 평균 잔향', avg.map((a) => a.toFixed(1)).join(' '));
for (let g = 2; g <= 5; g++) if (cnt[g] && cnt[g - 1] && avg[g] <= avg[g - 1]) bad(`등급 ${g} 평균이 ${g - 1}보다 적다`);
for (const [id, e] of Object.entries(ENGRAVINGS)) if (e.hidden && Object.keys(e.recipe).length !== 1) bad(`숨은 각인 재료 ${id}`);
// 성질과 어긋난 잔향 비율 · 낮은 등급 지역 상한 (몬스터 부산물 각인은 부산물 · 계열이 정해져 있어 뺀다)
let off = 0, tot = 0;
for (const [id, e] of list) {
  if (e.from && Object.keys(e.recipe).some((k) => ECHOES[k]?.part)) continue;
  const tp = new Set((e.tags || []).flatMap((t) => TAG_POOL[t] || []));
  for (const k of Object.keys(e.recipe)) {
    if (ECHOES[k]?.rare) continue;
    tot++; if (tp.size && !tp.has(k)) off++;
    if ((Z[k] || 9) > MAX_ZONE[e.grade]) bad(`등급 ${e.grade} 지역 상한 넘음 ${id}:${k}`);
  }
}
console.log('성질과 어긋난 잔향 비율', (off / tot * 100).toFixed(1) + '%');
if (off / tot > 0.1) bad('성질과 어긋난 잔향이 10%를 넘는다');
console.log(fail ? `FAIL ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);

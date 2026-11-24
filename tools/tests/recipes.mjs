// 각인 재료 시험: 같은 조합 0 · 거의 같은 조합 0 · 등급이 오를수록 많이 · 숨은 각인은 증표 하나
import { ENGRAVINGS } from '../../public/js/data/engravings.js';
import { ECHOES } from '../../public/js/data/monsters.js';
import { recipeKey, recipesNear } from '../../public/js/data/recipes.js';
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
console.log(fail ? `FAIL ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);

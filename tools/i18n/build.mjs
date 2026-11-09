// 번역 묶기: ko.json + en/*.json + runtime.js → public/js/i18n.js (index.html이 main.js보다 먼저 읽는다)
// node tools/i18n/build.mjs · 게임 글을 고쳤으면 먼저 node tools/i18n/extract.mjs 로 ko.json을 다시 만들고 en/*.json에 번역을 더한다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './extract.mjs';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const ko = JSON.parse(fs.readFileSync(path.join(HERE, 'ko.json'), 'utf8'));
const en = fs.readdirSync(path.join(HERE, 'en')).sort().flatMap((f) => JSON.parse(fs.readFileSync(path.join(HERE, 'en', f), 'utf8')));
if (ko.length !== en.length) throw new Error(`ko ${ko.length} ≠ en ${en.length}`);
const dict = Object.fromEntries(ko.map((k, i) => [k, en[i]]));
// 태그와 함께 뽑힌 조각(placeholder="…" title="…")에서 글자만 따로 넣는다: 화면에는 속성 글자만 나오므로 통째 조각으로는 찾지 못했다
const ATTR = /(?:title|placeholder|aria-label|data-tip|value)="([^"]*)/g;
ko.forEach((k, i) => {
  if (!k.includes('="')) return;
  const a = [...k.matchAll(ATTR)].map((m) => m[1]), b = [...en[i].matchAll(ATTR)].map((m) => m[1]);
  a.forEach((t, j) => { if (/[가-힣]/.test(t) && b[j] != null && dict[t] == null) dict[t] = b[j]; });
});
// 문장 틀({0}의 보물 상자 열기 → Open the treasure chest of {0}): 이름 · 숫자가 낀 문장의 어순을 영어로 바꾼다
const tk = JSON.parse(fs.readFileSync(path.join(HERE, 'tpl.json'), 'utf8')), te = JSON.parse(fs.readFileSync(path.join(HERE, 'tpl_en.json'), 'utf8'));
if (tk.length !== te.length) throw new Error(`tpl ${tk.length} ≠ ${te.length}`);
const tpl = tk.map((k, i) => [k, te[i]]);
// 손으로 더한 틀 (같은 낱말이 자리마다 뜻이 다른 것): 칸 = 가방에서는 slot, 거리에서는 tile
tpl.push(['가방 {0}/{1}칸', 'Bag {0}/{1} slots'], ['{0}/{1}칸', '{0}/{1} slots']);
fs.writeFileSync(path.join(ROOT, 'js/i18n.js'), `const DICT = ${JSON.stringify(dict)};
const TPL = ${JSON.stringify(tpl)};
` + fs.readFileSync(path.join(HERE, 'runtime.js'), 'utf8'));
console.log(`public/js/i18n.js · 조각 ${ko.length}`);

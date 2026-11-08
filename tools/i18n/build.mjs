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
fs.writeFileSync(path.join(ROOT, 'js/i18n.js'), `const DICT = ${JSON.stringify(dict)};
` + fs.readFileSync(path.join(HERE, 'runtime.js'), 'utf8'));
console.log(`public/js/i18n.js · 조각 ${ko.length}`);

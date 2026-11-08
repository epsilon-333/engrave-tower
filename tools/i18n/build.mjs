// 영어판 만들기: public 을 dist/en 에 그대로 복사하고, 화면 글자를 영어로 바꾸는 js/i18n-en.js 하나를 더한다 (게임 코드는 손대지 않는다)
// node tools/i18n/build.mjs → dist/en (itch.io용 zip은 dist/arche-itch-en.zip)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './extract.mjs';
const HERE = fileURLToPath(new URL('.', import.meta.url)), OUT = path.join(HERE, '../../dist/en');
const ko = JSON.parse(fs.readFileSync(path.join(HERE, 'ko.json'), 'utf8'));
const en = fs.readdirSync(path.join(HERE, 'en')).sort().flatMap((f) => JSON.parse(fs.readFileSync(path.join(HERE, 'en', f), 'utf8')));
if (ko.length !== en.length) throw new Error(`ko ${ko.length} ≠ en ${en.length}`);
const dict = Object.fromEntries(ko.map((k, i) => [k, en[i]]));
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(ROOT, OUT, { recursive: true, filter: (p) => !p.includes(path.sep + 'compare-fx') });
fs.writeFileSync(path.join(OUT, 'js/i18n-en.js'), `const DICT = ${JSON.stringify(dict)};\n` + fs.readFileSync(path.join(HERE, 'runtime.js'), 'utf8'));
const idx = path.join(OUT, 'index.html');
let html = fs.readFileSync(idx, 'utf8').replace('<html lang="ko">', '<html lang="en">');
html = html.replace('<script type="module" src="js/main.js">', '<script src="js/i18n-en.js"></script>\n  <script type="module" src="js/main.js">');
fs.writeFileSync(idx, html);
console.log(`dist/en · 조각 ${ko.length}`);

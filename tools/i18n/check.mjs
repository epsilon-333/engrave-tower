// 번역 점검: 화면에서 모은 글자(json 배열 파일)를 번역해 한글이 남은 것 · 결과를 보여 준다
// node tools/i18n/check.mjs <keys.json> [all]
import fs from 'node:fs';
globalThis.window = {}; globalThis.document = { documentElement: null, addEventListener() {} };
globalThis.localStorage = { getItem: () => 'en' }; globalThis.CanvasRenderingContext2D = function () {}; CanvasRenderingContext2D.prototype = { fillText() {}, strokeText() {}, measureText() {} };
(0, eval)(fs.readFileSync(new URL('../../public/js/i18n.js', import.meta.url), 'utf8'));
const keys = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); let left = 0;
for (const k of keys) { const v = window.__tr(k); const bad = /[가-힣]/.test(v); if (bad) left++; if (bad || process.argv[3]) console.log((bad ? '✗ ' : '  ') + k.replace(/\s+/g, ' ').slice(0, 80) + ' ⇒ ' + v.replace(/\s+/g, ' ').slice(0, 110)); }
console.log(`한글 남음 ${left} / ${keys.length}`);

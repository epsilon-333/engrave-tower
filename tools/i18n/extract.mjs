// 영어판 1단계: 게임 코드의 글자(따옴표 · 템플릿 안)에서 한글 조각을 모은다 → tools/i18n/ko.json
// 주석 · 정규식 · 코드 이름은 건드리지 않는다. build.mjs가 같은 조각을 en.json으로 바꿔 dist/en 에 영어판을 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../../public/', import.meta.url));
export function files() {
  const out = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (f === 'vendor' || f === 'compare-fx') continue; if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|html)$/.test(f)) out.push(p); } })(ROOT);
  return out;
}
const HANGUL = /[가-힣]/;
// 글자 안의 한글 조각: 태그 · 따옴표 · 줄바꿈 표시(\n) 사이 (앞뒤 공백 · 문장 부호 일부는 조각에 넣지 않는다)
const PIECE = /[^<>\\]*[가-힣][^<>\\]*/g;
// JS 소스를 훑어 글자 부분만 [시작, 끝, 따옴표 종류]로 돌려준다 (템플릿은 ${ } 사이를 빼고 조각조각)
export function stringSpans(src) {
  const spans = [], stack = []; let i = 0, prev = ''; // prev: 마지막으로 본 의미 있는 코드 글자 (정규식 / 나눗셈 구분)
  const n = src.length;
  const regexOk = () => !prev || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\b(return|typeof|case|in|of|new|delete|void|throw)$/.test(src.slice(Math.max(0, i - 8), i).trimEnd());
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '/' && regexOk()) { i++; let cls = false; while (i < n && src[i] !== '\n') { const d = src[i]; if (d === '\\') i++; else if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; i++; } i++; while (/[a-z]/.test(src[i] || '')) i++; prev = 'x'; continue; }
    if (c === '"' || c === "'") { const s = ++i; while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; } spans.push([s, i, c]); i++; prev = 'x'; continue; }
    if (c === '`' || (c === '}' && stack.length && stack[stack.length - 1] === 0)) {
      if (c === '}') stack.pop();
      let s = ++i;
      for (;;) {
        if (i >= n) break;
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '`') { spans.push([s, i, '`']); i++; break; }
        if (src[i] === '$' && src[i + 1] === '{') { spans.push([s, i, '`']); i += 2; stack.push(0); break; }
        i++;
      }
      prev = 'x'; continue;
    }
    if (c === '{') { if (stack.length) stack[stack.length - 1]++; }
    else if (c === '}') { if (stack.length) stack[stack.length - 1]--; }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return spans;
}
// HTML: <script> 밖의 글자 전체를 한 덩어리로 (속성 값 · 본문)
export function htmlSpans(src) {
  const spans = []; let i = 0;
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(src))) { spans.push([i, m.index, 'html']); const s0 = m.index + m[0].indexOf('>') + 1; for (const [a, b, q] of stringSpans(m[1])) spans.push([s0 + a, s0 + b, q]); i = m.index + m[0].length; }
  spans.push([i, src.length, 'html']);
  return spans;
}
export const spansOf = (file, src) => (file.endsWith('.html') ? htmlSpans(src) : stringSpans(src));
// 글자 하나에서 바꿀 조각들 [시작, 끝, 조각]
export function pieces(text) {
  const out = [];
  for (const m of text.matchAll(PIECE)) {
    let a = m.index, b = a + m[0].length;
    while (a < b && /[\s·:,()\[\]—\-+/%=|]/.test(text[a]) && !HANGUL.test(text[a])) a++;
    while (b > a && /[\s·:,()\[\]—\-+/%=|.!?…]/.test(text[b - 1]) && !HANGUL.test(text[b - 1])) b--;
    if (b > a && HANGUL.test(text.slice(a, b))) out.push([a, b, text.slice(a, b)]);
  }
  return out;
}
if (process.argv[1]?.endsWith('extract.mjs')) {
  const set = new Set();
  for (const f of files()) { const src = fs.readFileSync(f, 'utf8'); for (const [a, b] of spansOf(f, src)) for (const [, , k] of pieces(src.slice(a, b))) set.add(k); }
  const list = [...set].sort();
  fs.writeFileSync(new URL('ko.json', import.meta.url), '[\n' + list.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n');
  console.log(list.length, 'chars', list.join('').length);
}

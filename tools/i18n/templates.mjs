// 영어판 2단계: ${ }가 낀 한국어 문장 틀을 모은다 → tools/i18n/tpl.json ("{0}의 보물 상자 열기" 처럼 · 영어는 어순을 바꿔 쓴다)
import fs from 'node:fs';
import { files, stringSpans } from './extract.mjs';
const out = new Set();
for (const f of files()) {
  if (f.endsWith('.html')) continue;
  const src = fs.readFileSync(f, 'utf8'), spans = stringSpans(src);
  // 템플릿 하나 = 연달아 붙은 ` 조각들 (조각 사이가 ${ … }) — 조각 끝이 ${ 이면 다음 조각과 이어진다
  for (let i = 0; i < spans.length; i++) {
    if (spans[i][2] !== '`') continue;
    const seq = [spans[i]]; let j = i;
    while (src.startsWith('${', spans[j][1]) && spans[j + 1]?.[2] === '`') { seq.push(spans[++j]); }
    if (seq.length < 2) continue;
    i = j;
    const parts = seq.map(([a, b]) => src.slice(a, b));
    if (!parts.some((p) => /[가-힣]/.test(p)) || parts.some((p) => /[<>]/.test(p))) continue; // 태그가 낀 틀은 페이지에서 조각으로 나뉘어 나오므로 뺀다
    const t = parts.map((p, k) => (k ? `{${k - 1}}` : '') + p).join('').trim();
    if (/[가-힣]/.test(t.replace(/\{\d+\}/g, '')) && t.length < 120) out.add(t);
  }
}
const list = [...out].sort();
fs.writeFileSync(new URL('tpl.json', import.meta.url), '[\n' + list.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n');
console.log(list.length);

// 게임 글을 고친 뒤: 한글 조각을 다시 모으고(ko.json · tpl.json), 이미 있는 번역은 그대로 옮겨 en/*.json · tpl_en.json 을 새 순서에 맞춘다
// 새로 생긴 조각은 빈 칸("")으로 남기고 목록을 보여 준다 → 채운 뒤 node tools/i18n/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('.', import.meta.url)), J = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const write = (f, a) => fs.writeFileSync(path.join(HERE, f), '[\n' + a.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n');
// 지금 번역을 기억해 두고
const oldKo = J('ko.json'), oldEn = fs.readdirSync(path.join(HERE, 'en')).sort().flatMap((f) => J('en/' + f));
const oldTk = J('tpl.json'), oldTe = J('tpl_en.json');
const dict = new Map(oldKo.map((k, i) => [k, oldEn[i]])), tdict = new Map(oldTk.map((k, i) => [k, oldTe[i]]));
// 다시 모은다
for (const s of ['extract.mjs', 'templates.mjs']) execFileSync(process.execPath, [path.join(HERE, s)], { stdio: 'ignore' });
const ko = J('ko.json'), tk = J('tpl.json');
const en = ko.map((k) => dict.get(k) ?? ''), te = tk.map((k) => tdict.get(k) ?? '');
for (const f of fs.readdirSync(path.join(HERE, 'en'))) fs.rmSync(path.join(HERE, 'en', f));
for (let i = 0; i < en.length; i += 400) write(`en/${String(i / 400).padStart(2, '0')}.json`, en.slice(i, i + 400));
write('tpl_en.json', te);
const miss = ko.filter((k, i) => en[i] === '' && dict.get(k) !== ''), tmiss = tk.filter((k, i) => te[i] === '');
console.log(`조각 ${ko.length} (새 것 ${miss.length}) · 문장 틀 ${tk.length} (새 것 ${tmiss.length})`);
for (const k of miss) console.log('  조각:', k);
for (const k of tmiss) console.log('  틀:', k);

// 시험 한꺼번에: 하나씩 돌려 「FAIL」 · 오류 · 종료 코드로 실패를 가린다. 하나라도 실패하면 종료 코드 1
// 사용: node tools/tests/all.mjs [이름 …]   (이름을 주면 그것만)
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['all.mjs', 'climbsim.mjs', 'knack.mjs']); // climbsim: 밸런스 측정(오래 걸림) · knack: 통계 출력
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !SKIP.has(f) && (!only.length || only.includes(f.replace('.mjs', ''))));
let bad = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, f)], { cwd: path.join(dir, '../..'), encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const fails = out.split('\n').filter((l) => /^FAIL|\bFAIL\b|Error:|TypeError|ReferenceError/.test(l));
  const ok = r.status === 0 && !r.signal && !fails.length;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${f.padEnd(16)} ${((Date.now() - t0) / 1000).toFixed(1)}초${ok ? '' : ` · ${r.signal ? '시간 초과' : `종료 ${r.status}`} · ${fails.slice(0, 2).join(' / ').slice(0, 200)}`}`);
}
console.log(bad ? `\n${bad}개 실패` : '\nALL OK');
process.exitCode = bad ? 1 : 0;

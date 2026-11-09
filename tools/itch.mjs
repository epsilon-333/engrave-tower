// itch.io용 zip: public 을 그대로 묶되 온라인(서버) 연결은 빼고 혼자 하는 게임으로 (저장소의 서버 코드는 그대로 둔다)
// node tools/itch.mjs → dist/arche-itch.zip (index.html이 맨 위)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)), OUT = path.join(ROOT, 'dist/itch');
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true, filter: (p) => !p.includes(path.sep + 'compare-fx') });
// 서버가 없으니 연결하지 않는다: net.js 를 같은 이름의 빈 함수들로 바꾼다
fs.writeFileSync(path.join(OUT, 'js/net.js'), `// itch.io판: 서버 없이 혼자 한다
export const net = { up: false, id: null, players: new Map(), map: undefined, online: 0, x: 0, y: 0, party: null, guild: null };
export const onNet = () => {};
export const netSend = () => {};
export function netConnect() {}
export function netMap(map, x = 0, y = 0) { net.map = map; net.x = x; net.y = y; }
export function netPos(x, y) { net.x = x; net.y = y; }
export function netLerp() {}
`);
const zip = path.join(ROOT, 'dist/arche-itch.zip');
fs.rmSync(zip, { force: true });
execFileSync('python', ['-c', `import zipfile,os,sys
z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED)
for r,d,f in os.walk(sys.argv[1]):
  for x in f:
    p=os.path.join(r,x); z.write(p,os.path.relpath(p,sys.argv[1]).replace(os.sep,'/'))
z.close()`, OUT, zip]);
console.log('dist/arche-itch.zip', (fs.statSync(zip).size / 1048576).toFixed(1), 'MB');

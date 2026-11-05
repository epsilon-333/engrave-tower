// 운영자 보상: 접속한 사람에게 바로 · 접속하지 않은 사람에게는 다음 접속 때 · 받았다고 하면 다시 오지 않는다 · 운영자가 아니면 못 준다
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 5198, root = new URL('../../', import.meta.url), DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'grant-'));
const start = () => spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), ADMIN_KEY: 'test-key', DATA_DIR: DATA }, stdio: 'ignore' });
let srv = start();
await new Promise((r) => setTimeout(r, 700));
const open = (name, uid, adminKey) => new Promise((res) => {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`), inbox = [];
  ws.onmessage = (e) => inbox.push(JSON.parse(e.data));
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', name, race: 'knight', cls: 'greatsword', lv: 7, uid, adminKey })); res({ ws, inbox, send: (o) => ws.send(JSON.stringify(o)) }); };
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const all = (c, t) => c.inbox.filter((m) => m.t === t);
const ok = (cond, text) => { console.log(cond ? 'OK ' : 'FAIL', text); if (!cond) process.exitCode = 1; };

const admin = await open('운영자', 'admin-uid-0001', 'test-key'), p = await open('가람', 'player-uid-0001');
await wait(200);
const idp = all(p, 'welcome')[0].id;
admin.send({ t: 'adminGrant', to: idp, item: 'mossFang', note: '이벤트 1등' }); await wait(150);
ok(all(p, 'grant')[0]?.item === 'mossFang' && all(p, 'grant')[0]?.note === '이벤트 1등', '접속한 사람은 바로 받는다');
ok(all(admin, 'adminGrantRes')[0]?.ok && all(admin, 'adminGrantRes')[0]?.now, '운영자에게 줬다고 알려 준다');
p.send({ t: 'grantOk', gid: all(p, 'grant')[0].gid }); await wait(100);
admin.send({ t: 'adminGrant', name: '나래', item: 'stormBow' }); await wait(150);
ok(all(admin, 'adminGrantRes')[1]?.ok && !all(admin, 'adminGrantRes')[1]?.now, '접속하지 않은 사람에게는 맡겨 둔다');
p.ws.close(); await wait(100);
const p2 = await open('가람', 'player-uid-0001'); await wait(200);
ok(all(p2, 'grant').length === 0, '받았다고 한 보상은 다시 오지 않는다');
await new Promise((r) => { srv.once('exit', r); srv.kill(); }); srv = start(); await wait(700); // 서버를 다시 띄워도 맡겨 둔 보상은 남는다
const q = await open('나래', 'player-uid-0002'); await wait(250);
ok(all(q, 'grant')[0]?.item === 'stormBow', '다음 접속 때 계정 이름으로 받는다 (서버를 다시 띄워도)');
q.send({ t: 'grantOk', gid: all(q, 'grant')[0].gid }); await wait(100); q.ws.close(); await wait(100);
const q2 = await open('나래', 'player-uid-0002'); await wait(200);
ok(all(q2, 'grant').length === 0, '받은 뒤에는 다시 오지 않는다');
const fake = await open('가짜', 'fake-uid-0001'); await wait(150);
fake.send({ t: 'adminGrant', name: '가짜', item: 'towerLight' }); await wait(150);
ok(all(fake, 'adminGrantRes').length === 0 && all(fake, 'grant').length === 0, '운영자가 아니면 줄 수 없다');
for (const c of [admin, p2, q2, fake]) c.ws.close();
await new Promise((r) => { srv.once('exit', r); srv.kill(); }); fs.rmSync(DATA, { recursive: true, force: true });

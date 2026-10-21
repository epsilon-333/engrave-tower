// 파티 · 길드 중계: 초대 · 수락 · 파티 채팅 · 탑 메시지 중계 · 파티장 넘기기, 길드 만들기 · 초대 · 직위 · 서버를 다시 띄워도 남는지
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PORT = 5198, root = new URL('../../', import.meta.url);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'arke-guild-'));
const start = () => spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), DATA_DIR }, stdio: 'ignore' });
let srv = start();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(600);
const open = (name, uid, guild = null) => new Promise((res) => {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`), inbox = [];
  ws.onmessage = (e) => inbox.push(JSON.parse(e.data));
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', name, race: 'orc', cls: 'berserker', lv: 9, uid, guild })); res({ ws, inbox, send: (o) => ws.send(JSON.stringify(o)), last: (t) => [...inbox].reverse().find((m) => m.t === t) }); };
});
const ok = (cond, text) => { console.log(cond ? 'OK ' : 'FAIL', text); if (!cond) process.exitCode = 1; };
const A = await open('가람', 'uid-garam-0001'), B = await open('나래', 'uid-narae-0002'), C = await open('다온', 'uid-daon-00003'), D = await open('라온', 'uid-raon-00004');
await wait(150);
const id = (x) => x.last('welcome').id;

// 파티
A.send({ t: 'partyInvite', to: id(B) }); await wait(100);
ok(B.last('partyInvite')?.from === id(A), '파티 초대가 상대에게 간다');
B.send({ t: 'partyAnswer', to: id(A), ok: true }); await wait(100);
ok(A.last('party')?.members.length === 2 && A.last('party').leader === id(A), '수락하면 둘이 한 파티 (초대한 사람이 파티장)');
await wait(1000); A.send({ t: 'partyInvite', to: id(C) }); await wait(80); C.send({ t: 'partyAnswer', to: id(A), ok: true }); await wait(100);
ok(B.last('party')?.members.length === 3, '셋째도 들어온다');
B.send({ t: 'partyInvite', to: id(D) }); await wait(100);
ok(B.last('partyNo')?.reason.includes('파티장'), '파티장이 아니면 초대할 수 없다');
B.send({ t: 'chat', text: '모여요', ch: 'party' }); await wait(100);
ok(C.last('chat')?.ch === 'party' && !D.inbox.some((m) => m.t === 'chat' && m.ch === 'party'), '파티 채팅은 파티에게만');
A.send({ t: 'co', k: 'snap', e: [[1, 'slime', 10, 10]] }); await wait(100);
ok(B.last('co')?.k === 'snap' && C.last('co')?.from === id(A) && !D.inbox.some((m) => m.t === 'co'), '탑 메시지는 파티 모두에게 (파티 밖은 못 받는다)');
const before = C.inbox.filter((m) => m.t === 'co').length;
B.send({ t: 'co', k: 'hit', to: id(A), dmg: 12 }); await wait(100);
ok(A.last('co')?.k === 'hit' && C.inbox.filter((m) => m.t === 'co').length === before, 'to가 있으면 그 사람에게만');
A.send({ t: 'partyLeave' }); await wait(100);
ok(B.last('party')?.leader === id(B) && B.last('party').members.length === 2 && A.last('party')?.id === null, '파티장이 나가면 다음 사람이 파티장');

// 길드
A.send({ t: 'guildCreate', name: '새벽별' }); await wait(120);
const gs = A.last('guild');
ok(gs?.name === '새벽별' && gs.members[0].rank === 'leader', '길드를 만들면 길드장');
C.send({ t: 'guildCreate', name: '새벽별' }); await wait(100);
ok(C.last('guildNo')?.reason.includes('같은 이름'), '같은 이름의 길드는 못 만든다');
A.send({ t: 'guildInvite', to: id(B) }); await wait(80); B.send({ t: 'guildAnswer', to: id(A), ok: true }); await wait(120);
ok(A.last('guild')?.members.length === 2 && B.last('guild')?.name === '새벽별', '길드 초대 · 수락');
B.send({ t: 'chat', text: '안녕하세요 길드', ch: 'guild' }); await wait(100);
ok(A.last('chat')?.ch === 'guild' && !C.inbox.some((m) => m.t === 'chat' && m.ch === 'guild'), '길드 채팅은 길드원에게만');
A.send({ t: 'guildRank', uid: 'uid-narae-0002', rank: 'officer' }); await wait(100);
ok(B.last('guild')?.members.find((m) => m.uid === 'uid-narae-0002')?.rank === 'officer', '길드장이 부길드장을 세운다');
B.send({ t: 'guildKick', uid: 'uid-garam-0001' }); await wait(100);
ok(A.last('guild')?.id, '부길드장은 길드장을 내보낼 수 없다');
const gid = gs.id;

// 서버를 다시 띄워도 길드는 남는다 (파일)
for (const x of [A, B, C, D]) x.ws.close();
await wait(300); srv.kill(); await wait(400); srv = start(); await wait(700);
const B2 = await open('나래', 'uid-narae-0002', { id: gid, name: '새벽별', rank: 'officer' }); await wait(150);
ok(B2.last('guild')?.members.length === 2, '서버를 다시 띄워도 길드가 남는다');
B2.ws.close();
// 파일까지 없어진 서버: 길드원의 저장으로 길드를 되살린다
srv.kill(); await wait(400); fs.rmSync(DATA_DIR, { recursive: true, force: true }); srv = start(); await wait(700);
const A3 = await open('가람', 'uid-garam-0001', { id: gid, name: '새벽별', rank: 'leader' }); await wait(150);
ok(A3.last('guild')?.name === '새벽별' && A3.last('guild').members[0].rank === 'leader', '기록이 사라진 서버에서도 길드원의 저장으로 되살린다');
A3.ws.close(); srv.kill();
fs.rmSync(DATA_DIR, { recursive: true, force: true });

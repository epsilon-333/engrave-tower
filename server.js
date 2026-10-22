// 정적 파일 서버 + 온라인 중계(WebSocket, /ws).
// 온라인: 같은 지도(바깥 세계 · 파티의 탑 층)에 있는 사람끼리 위치 · 채팅을 나누고, 1:1 결투 · 파티 · 길드를 중계한다.
// 싸움 계산은 각자의 브라우저가 하고 서버는 메시지를 상대에게 건네주기만 한다 (외부 패키지 없이 직접 만든 WebSocket).
// 길드는 server-data/guilds.json 에 남는다 (서버가 새로 떠서 파일이 없어져도 길드원의 저장에 남은 길드로 되살린다).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 5180;
const HOST = process.env.RENDER ? '0.0.0.0' : undefined;
const ROOT = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/online') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end(JSON.stringify({ online: clients.size })); }
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

// ───── WebSocket (RFC 6455): 손 맞잡기 · 글자 프레임 · 핑 · 닫기만 ─────
const clients = new Map(); // id → { sock, buf, name, race, cls, weapon, lv, map, x, y, dir, mo, duel }
let nextId = 1, nextDuel = 1;
const MAX_MSG = 64 * 1024; // 파티 탑의 몬스터 상황(방장 → 동료)이 가장 크다
function frame(op, data) {
  const n = data.length;
  const head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
  return Buffer.concat([head, data]);
}
function send(c, msg) { if (!c || c.closed) return; try { c.sock.write(frame(0x1, Buffer.from(JSON.stringify(msg)))); } catch { /* 끊긴 연결 */ } }
function drop(c) {
  if (c.closed) return;
  c.closed = true; clients.delete(c.id);
  if (c.map) toMap(c.map, { t: 'leave', id: c.id }, c);
  if (c.duel) { const o = clients.get(c.duel.opp); if (o) { send(o, { t: 'dend', reason: 'left' }); o.duel = null; } }
  if (c.trade) { const o = clients.get(c.trade); if (o) { send(o, { t: 'tradeCancel', from: c.id }); o.trade = null; } }
  partyLeave(c);
  const g = c.guild && guilds[c.guild];
  if (g) { if (g.members[c.uid]) g.members[c.uid].seen = Date.now(); saveGuilds(); guildSync(g); }
  try { c.sock.destroy(); } catch { /* 이미 닫힘 */ }
}

// ───── 파티 (최대 4명 · 서버가 켜져 있는 동안만) ─────
const parties = new Map();
let nextParty = 1;
const PARTY_MAX = 4;
const partyOf = (c) => (c.party ? parties.get(c.party) : null);
function partyCast(pt, msg, except) { for (const id of pt.members) { const o = clients.get(id); if (o && o !== except) send(o, msg); } }
function partySync(pt) {
  const list = pt.members.map((id) => clients.get(id)).filter(Boolean);
  partyCast(pt, { t: 'party', id: pt.id, leader: pt.leader, members: list.map((o) => ({ id: o.id, name: o.name, race: o.race, lv: o.lv, map: o.map })) });
  for (const o of list) pinfo(o);
}
function partyLeave(c, why) {
  const pt = partyOf(c); if (!pt) return;
  pt.members = pt.members.filter((id) => id !== c.id); c.party = null;
  if (!c.closed) { send(c, { t: 'party', id: null, why }); pinfo(c); }
  if (pt.members.length <= 1) { // 혼자 남으면 파티는 흩어진다
    for (const id of pt.members) { const o = clients.get(id); if (o) { o.party = null; send(o, { t: 'party', id: null, why: '파티가 흩어졌다' }); pinfo(o); } }
    parties.delete(pt.id); return;
  }
  if (pt.leader === c.id) pt.leader = pt.members[0];
  partySync(pt);
}

// ───── 길드 (파일에 남는다) ─────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'server-data'), GUILD_FILE = path.join(DATA_DIR, 'guilds.json');
let guilds = {};
try { guilds = JSON.parse(fs.readFileSync(GUILD_FILE, 'utf8')) || {}; } catch { guilds = {}; }
// 바뀌면 바로 쓴다 (쓰는 중에 또 바뀌면 끝난 뒤 한 번 더) · 서버가 꺼질 때도 한 번 쓴다
let guildWriting = false, guildDirty = false;
function saveGuilds() {
  guildDirty = true;
  if (guildWriting) return;
  guildWriting = true; guildDirty = false;
  fs.mkdir(DATA_DIR, { recursive: true }, () => fs.writeFile(GUILD_FILE, JSON.stringify(guilds), () => { guildWriting = false; if (guildDirty) saveGuilds(); }));
}
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(GUILD_FILE, JSON.stringify(guilds)); } catch { /* 무시 */ } process.exit(0); });
const RANKS = ['leader', 'officer', 'member'];
const guildByName = (name) => Object.values(guilds).find((g) => g.name.toLowerCase() === name.toLowerCase());
const canManage = (g, uid) => ['leader', 'officer'].includes(g?.members[uid]?.rank);
function guildState(g) {
  const on = new Set([...clients.values()].filter((o) => o.guild === g.id).map((o) => o.uid));
  const members = Object.entries(g.members).map(([uid, m]) => ({ uid, name: m.name, rank: m.rank, race: m.race, lv: m.lv, online: on.has(uid), seen: m.seen || 0 }))
    .sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank) || b.online - a.online || b.lv - a.lv);
  return { t: 'guild', id: g.id, name: g.name, notice: g.notice || '', members };
}
function guildSync(g) { const s = guildState(g); for (const o of clients.values()) if (o.guild === g.id) send(o, s); }
function guildJoin(c, g, rank) {
  g.members[c.uid] = { name: c.name, rank, race: c.race, lv: c.lv, seen: Date.now() };
  c.guild = g.id; saveGuilds(); guildSync(g); pinfo(c);
}
function guildRemove(g, uid, why) {
  const was = g.members[uid]; if (!was) return;
  delete g.members[uid];
  for (const o of clients.values()) if (o.uid === uid && o.guild === g.id) { o.guild = null; send(o, { t: 'guild', id: null, why }); pinfo(o); }
  const rest = Object.entries(g.members);
  if (!rest.length) { delete guilds[g.id]; saveGuilds(); return; }
  if (was.rank === 'leader') { // 길드장이 나가면 부길드장 → 가장 오래된 길드원이 잇는다
    const next = rest.find(([, m]) => m.rank === 'officer') || rest[0];
    next[1].rank = 'leader';
  }
  saveGuilds(); guildSync(g);
}
// 받침에 따라 이/가 (한글이 아니면 이(가))
const iga = (s) => { const c = String(s).charCodeAt(String(s).length - 1) - 0xac00; return c >= 0 && c < 11172 ? s + (c % 28 ? "이" : "가") : s + "이(가)"; };
const pub = (c) => ({ id: c.id, name: c.name, race: c.race, cls: c.cls, weapon: c.weapon, lv: c.lv, x: c.x, y: c.y, dir: c.dir, mo: c.mo, duel: !!c.duel, party: c.party || 0, gname: (c.guild && guilds[c.guild]?.name) || '' });
function toMap(map, msg, except) { for (const o of clients.values()) if (o.map === map && o !== except) send(o, msg); }
// 파티 · 길드가 바뀌면 같은 지도의 사람에게 (이름표 · 초대 버튼)
function pinfo(c) { if (c && !c.closed && c.map) toMap(c.map, { t: 'pinfo', id: c.id, party: c.party || 0, gname: (c.guild && guilds[c.guild]?.name) || '' }, c); }
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);

server.on('upgrade', (req, sock) => {
  if (req.url.split('?')[0] !== '/ws' || !req.headers['sec-websocket-key']) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
  sock.setNoDelay(true);
  const c = { id: nextId++, sock, buf: Buffer.alloc(0), name: '여행자', map: null, x: 0, y: 0, dir: 1, mo: '', duel: null, last: Date.now() };
  clients.set(c.id, c);
  sock.on('data', (d) => onData(c, d));
  sock.on('close', () => drop(c));
  sock.on('error', () => drop(c));
});
function onData(c, d) {
  c.buf = Buffer.concat([c.buf, d]);
  for (;;) {
    const b = c.buf;
    if (b.length < 2) return;
    const op = b[0] & 0x0f, masked = b[1] & 0x80;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (len > MAX_MSG) { drop(c); return; }
    if (b.length < off + (masked ? 4 : 0) + len) return;
    const mask = masked ? b.subarray(off, off + 4) : null; if (masked) off += 4;
    const data = Buffer.from(b.subarray(off, off + len));
    if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
    c.buf = b.subarray(off + len);
    c.last = Date.now();
    if (op === 0x8) { drop(c); return; }
    if (op === 0x9) { try { c.sock.write(frame(0xA, data)); } catch { /* 무시 */ } continue; }
    if (op !== 0x1) continue;
    let m; try { m = JSON.parse(data.toString('utf8')); } catch { continue; }
    handle(c, m);
  }
}
function handle(c, m) {
  switch (m.t) {
    case 'hello': { // 이름 · 종족 · 클래스 · 무기 · 레벨 · 저장마다 붙은 고유 번호(uid) · 저장에 남은 길드
      c.name = clean(m.name, 16) || '여행자'; c.race = clean(m.race, 12); c.cls = clean(m.cls, 20); c.weapon = clean(m.weapon, 30); c.lv = +m.lv || 1;
      const uid = clean(m.uid, 40);
      c.uid = uid.length >= 8 ? uid : null;
      send(c, { t: 'welcome', id: c.id, online: clients.size });
      if (c.party) partySync(partyOf(c));
      const mg = m.guild && typeof m.guild === 'object' ? m.guild : null, gid = mg && clean(mg.id, 24);
      if (!c.uid || !gid) { c.guild = null; break; }
      let g = guilds[gid];
      if (g && g.members[c.uid]) { Object.assign(g.members[c.uid], { name: c.name, race: c.race, lv: c.lv, seen: Date.now() }); c.guild = g.id; saveGuilds(); guildSync(g); pinfo(c); }
      else if (!g || g.recovered) { // 서버에 없는 길드(서버가 새로 떴다): 저장에 남은 길드로 되살린다
        const name = clean(mg.name, 12).trim();
        if (!g && (!name || guildByName(name))) { c.guild = null; send(c, { t: 'guild', id: null, why: '길드 기록을 찾을 수 없다' }); break; }
        if (!g) g = guilds[gid] = { id: gid, name, notice: '', created: Date.now(), members: {}, recovered: true };
        const hasLeader = Object.values(g.members).some((x) => x.rank === 'leader');
        guildJoin(c, g, mg.rank === 'leader' && !hasLeader ? 'leader' : mg.rank === 'officer' ? 'officer' : 'member');
      } else { c.guild = null; send(c, { t: 'guild', id: null, why: '길드에서 내보내졌다' }); }
      break;
    }
    case 'map': { // 다른 지도로 옮겼다 (null이면 혼자만의 곳: 집 · 던전 · 탑)
      const map = m.map ? clean(m.map, 20) : null;
      if (c.map === map) break;
      if (c.map) toMap(c.map, { t: 'leave', id: c.id }, c);
      c.map = map; c.x = +m.x || 0; c.y = +m.y || 0;
      if (map) { toMap(map, { t: 'join', p: pub(c) }, c); send(c, { t: 'players', list: [...clients.values()].filter((o) => o !== c && o.map === map).map(pub) }); }
      if (c.party) partySync(partyOf(c)); // 파티 창에 어디 있는지
      break;
    }
    case 'pos':
      c.x = +m.x || 0; c.y = +m.y || 0; c.dir = m.dir < 0 ? -1 : 1; c.mo = clean(m.mo, 16);
      if (c.map) toMap(c.map, { t: 'pos', id: c.id, x: c.x, y: c.y, dir: c.dir, mo: c.mo }, c);
      break;
    case 'chat': {
      const text = clean(m.text, 120).trim(); if (!text) break;
      const now = Date.now(); if (now - (c.chatT || 0) < 600) break; c.chatT = now; // 도배 막기
      const ch = m.ch === 'party' && c.party ? 'party' : m.ch === 'guild' && c.guild ? 'guild' : 'all';
      const msg = { t: 'chat', id: c.id, name: c.name, text, ch };
      if (ch === 'party') partyCast(partyOf(c), msg);
      else if (ch === 'guild') { for (const o of clients.values()) if (o.guild === c.guild) send(o, msg); }
      else for (const o of clients.values()) send(o, msg);
      break;
    }
    // ── 교환 (두 사람이 내놓을 것을 정하고 둘 다 확정하면 각자의 화면이 주고받는다) ──
    case 'tradeInvite': {
      const o = clients.get(+m.to), now = Date.now();
      if (now - (c.tInvT || 0) < 1000) break; c.tInvT = now;
      if (!o || o === c || o.trade || c.trade) { send(c, { t: 'tradeNo', reason: o?.trade ? '상대가 교환 중이다' : '상대를 찾을 수 없다' }); break; }
      c.tInv = o.id; send(o, { t: 'tradeInvite', from: c.id, name: c.name });
      break;
    }
    case 'tradeAnswer': {
      const o = clients.get(+m.to);
      if (!o || o.tInv !== c.id) break;
      o.tInv = null;
      if (!m.ok) { send(o, { t: 'tradeNo', reason: `${iga(c.name)} 거절했다` }); break; }
      if (o.trade || c.trade) break;
      o.trade = c.id; c.trade = o.id;
      send(o, { t: 'tradeStart', with: c.id, name: c.name }); send(c, { t: 'tradeStart', with: o.id, name: o.name });
      break;
    }
    case 'tradeOffer': case 'tradeConfirm': { const o = c.trade && clients.get(c.trade); if (o) send(o, { ...m, from: c.id }); break; }
    case 'tradeCancel': case 'tradeDone': { const o = c.trade && clients.get(c.trade); if (o) { send(o, { t: m.t, from: c.id }); o.trade = null; } c.trade = null; break; }
    // ── 파티 ──
    case 'partyInvite': {
      const o = clients.get(+m.to), pt = partyOf(c), now = Date.now();
      if (now - (c.pInvT || 0) < 1000) break; c.pInvT = now;
      const why = !o || o === c ? '상대를 찾을 수 없다' : o.party ? `${iga(o.name)} 이미 파티에 있다` : pt && pt.leader !== c.id ? '파티장만 초대할 수 있다' : pt && pt.members.length >= PARTY_MAX ? `파티는 ${PARTY_MAX}명까지` : null;
      if (why) { send(c, { t: 'partyNo', reason: why }); break; }
      c.pInv = o.id;
      send(o, { t: 'partyInvite', from: c.id, name: c.name, race: c.race, lv: c.lv });
      break;
    }
    case 'partyAnswer': {
      const o = clients.get(+m.to);
      if (!o || o.pInv !== c.id) break;
      o.pInv = null;
      if (!m.ok) { send(o, { t: 'partyNo', reason: `${iga(c.name)} 거절했다` }); break; }
      if (c.party) break;
      let pt = partyOf(o);
      if (!pt) { pt = { id: nextParty++, leader: o.id, members: [o.id] }; parties.set(pt.id, pt); o.party = pt.id; }
      if (pt.members.length >= PARTY_MAX) { send(c, { t: 'partyNo', reason: '파티가 가득 찼다' }); break; }
      pt.members.push(c.id); c.party = pt.id;
      partySync(pt);
      break;
    }
    case 'partyLeave': partyLeave(c); break;
    case 'partyKick': {
      const pt = partyOf(c), o = clients.get(+m.id);
      if (pt && pt.leader === c.id && o && o.party === pt.id && o !== c) partyLeave(o, '파티에서 내보내졌다');
      break;
    }
    case 'partyLead': {
      const pt = partyOf(c), o = clients.get(+m.id);
      if (pt && pt.leader === c.id && o && o.party === pt.id) { pt.leader = o.id; partySync(pt); }
      break;
    }
    case 'co': { // 파티끼리 함께 오르는 탑: 방장 ↔ 동료 (to가 있으면 그 사람에게만)
      const pt = partyOf(c); if (!pt) break;
      const out = { ...m, from: c.id };
      if (m.to) { const o = clients.get(+m.to); if (o && o.party === pt.id) send(o, out); }
      else partyCast(pt, out, c);
      break;
    }
    // ── 길드 ──
    case 'guildCreate': {
      const name = clean(m.name, 12).trim();
      if (!c.uid) { send(c, { t: 'guildNo', reason: '저장 정보가 없어 길드를 만들 수 없다' }); break; }
      if (c.guild) { send(c, { t: 'guildNo', reason: '이미 길드에 있다' }); break; }
      if (name.length < 2) { send(c, { t: 'guildNo', reason: '길드 이름은 두 글자 이상' }); break; }
      if (guildByName(name)) { send(c, { t: 'guildNo', reason: '같은 이름의 길드가 있다' }); break; }
      const g = { id: crypto.randomBytes(6).toString('hex'), name, notice: '', created: Date.now(), members: {} };
      guilds[g.id] = g;
      guildJoin(c, g, 'leader');
      send(c, { t: 'guildMade', name });
      break;
    }
    case 'guildInvite': {
      const g = c.guild && guilds[c.guild], o = clients.get(+m.to), now = Date.now();
      if (now - (c.gInvT || 0) < 1000) break; c.gInvT = now;
      const why = !g ? '길드가 없다' : !canManage(g, c.uid) ? '길드장 · 부길드장만 초대할 수 있다' : !o || o === c ? '상대를 찾을 수 없다' : !o.uid ? '상대가 길드에 들 수 없다' : o.guild ? `${iga(o.name)} 이미 길드에 있다` : null;
      if (why) { send(c, { t: 'guildNo', reason: why }); break; }
      c.gInv = o.id;
      send(o, { t: 'guildInvite', from: c.id, name: c.name, guild: g.name });
      break;
    }
    case 'guildAnswer': {
      const o = clients.get(+m.to), g = o?.guild && guilds[o.guild];
      if (!o || o.gInv !== c.id) break;
      o.gInv = null;
      if (!m.ok) { send(o, { t: 'guildNo', reason: `${iga(c.name)} 거절했다` }); break; }
      if (!g || c.guild || !c.uid) break;
      guildJoin(c, g, 'member');
      break;
    }
    case 'guildLeave': { const g = c.guild && guilds[c.guild]; if (g) guildRemove(g, c.uid, '길드에서 나왔다'); break; }
    case 'guildKick': {
      const g = c.guild && guilds[c.guild], uid = clean(m.uid, 40), t = g?.members[uid];
      if (!t || uid === c.uid || !canManage(g, c.uid) || t.rank === 'leader' || (t.rank === 'officer' && g.members[c.uid].rank !== 'leader')) break;
      guildRemove(g, uid, '길드에서 내보내졌다');
      break;
    }
    case 'guildRank': { // 길드장: 부길드장 세우기 · 내리기 · 길드장 넘기기
      const g = c.guild && guilds[c.guild], uid = clean(m.uid, 40), t = g?.members[uid];
      if (!t || uid === c.uid || g.members[c.uid]?.rank !== 'leader') break;
      if (m.rank === 'leader') { t.rank = 'leader'; g.members[c.uid].rank = 'officer'; }
      else if (m.rank === 'officer' || m.rank === 'member') t.rank = m.rank;
      saveGuilds(); guildSync(g);
      break;
    }
    case 'guildNotice': {
      const g = c.guild && guilds[c.guild];
      if (!g || !canManage(g, c.uid)) break;
      g.notice = clean(m.text, 80); saveGuilds(); guildSync(g);
      break;
    }
    case 'duelInvite': { // 결투 신청 → 상대에게
      const o = clients.get(+m.to);
      if (!o || o.duel || c.duel || o === c) { send(c, { t: 'duelNo', reason: o?.duel ? '상대가 결투 중이다' : '상대를 찾을 수 없다' }); break; }
      c.invited = o.id;
      send(o, { t: 'duelInvite', from: c.id, name: c.name, race: c.race, lv: c.lv });
      break;
    }
    case 'duelAnswer': {
      const o = clients.get(+m.to);
      if (!o || o.invited !== c.id || o.duel || c.duel) break;
      o.invited = null;
      if (!m.ok) { send(o, { t: 'duelNo', reason: `${iga(c.name)} 거절했다` }); break; }
      const id = nextDuel++;
      o.duel = { id, opp: c.id, side: 0 }; c.duel = { id, opp: o.id, side: 1 };
      send(o, { t: 'duelStart', id, side: 0, opp: { ...pub(c), maxHp: +m.maxHp || 100 } });
      send(c, { t: 'duelStart', id, side: 1, opp: { ...pub(o), maxHp: +m.oppHp || 100 } });
      break;
    }
    case 'duelHp': // 시작할 때 내 최대 체력을 상대에게
    case 'dstate': case 'dhit': case 'dskill': { // 결투 중: 상대에게 그대로
      if (!c.duel) break;
      const o = clients.get(c.duel.opp); if (!o) break;
      send(o, { ...m, from: c.id });
      break;
    }
    case 'dend': { // 졌다(또는 나갔다)
      if (!c.duel) break;
      const o = clients.get(c.duel.opp);
      if (o) { send(o, { t: 'dend', loser: m.win ? o.id : c.id, reason: String(m.reason || 'down').slice(0, 8) }); o.duel = null; }
      c.duel = null;
      break;
    }
  }
}
// 오래 말이 없는 연결은 정리한다
setInterval(() => { const now = Date.now(); for (const c of clients.values()) if (now - c.last > 60000) drop(c); }, 15000);

server.listen(PORT, HOST, () => console.log(`각인의 탑: http://localhost:${PORT}`));

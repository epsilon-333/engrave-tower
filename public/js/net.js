// 온라인: 서버(/ws)와 이어져 같은 지도의 다른 사람 · 채팅 · 결투 메시지를 주고받는다.
// 서버가 없는 곳(claude.ai 공유 페이지 등)에서는 조용히 혼자 한다.
export const net = { up: false, id: null, players: new Map(), map: undefined, online: 0, x: 0, y: 0, party: null, guild: null };
const H = {};
export const onNet = (t, f) => { (H[t] ||= []).push(f); };
const emit = (t, m) => { for (const f of H[t] || []) f(m); };
let ws = null, info = null, retry = 0;
// 내 정보는 보낼 때마다 새로 읽는다 (다시 이어질 때 예전 길드 · 이름을 보내지 않게)
const hello = () => raw({ t: 'hello', ...(typeof info === 'function' ? info() : info) });
const raw = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
export const netSend = raw;

export function netConnect(me) { // me: 내 정보 또는 내 정보를 돌려주는 함수
  info = me;
  if (ws || typeof WebSocket === 'undefined') { if (ws?.readyState === 1) hello(); return; }
  try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); } catch { return; }
  ws.onopen = () => {
    net.up = true; retry = 0;
    hello();
    if (net.map) raw({ t: 'map', map: net.map, x: Math.round(net.x), y: Math.round(net.y) });
    emit('up');
  };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } recv(m); };
  ws.onclose = () => { const was = net.up; net.up = false; ws = null; net.players.clear(); net.party = null; if (was) emit('down'); if (retry < 10) setTimeout(() => netConnect(info), 1500 * ++retry); };
  ws.onerror = () => {};
}
// 살아 있다는 신호 (서버는 1분 동안 말이 없으면 끊는다)
setInterval(() => raw({ t: 'ping' }), 25000);

function recv(m) {
  switch (m.t) {
    case 'welcome': net.id = m.id; net.online = m.online; break;
    case 'players': net.players.clear(); for (const p of m.list) net.players.set(p.id, { ...p, tx: p.x, ty: p.y }); break;
    case 'join': net.players.set(m.p.id, { ...m.p, tx: m.p.x, ty: m.p.y }); break;
    case 'leave': net.players.delete(m.id); break;
    case 'pos': { const p = net.players.get(m.id); if (p) { p.tx = m.x; p.ty = m.y; p.dir = m.dir; p.mo = m.mo; } break; }
    case 'chat': { const p = net.players.get(m.id); if (p && m.ch !== 'guild') p.say = { text: m.text, until: performance.now() + 4500, ch: m.ch }; break; }
    case 'pinfo': { const p = net.players.get(m.id); if (p) { p.party = m.party; p.gname = m.gname; } break; } // 그 사람의 파티 · 길드가 바뀌었다
    case 'party': net.party = m.id ? m : null; break; // 파티: { id, leader, members: [{ id, name, race, lv, map }] }
    case 'guild': net.guild = m.id ? m : null; break; // 길드: { id, name, notice, members: [{ uid, name, rank, online, … }] }
  }
  emit(m.t, m);
}
// 지금 있는 지도: 'world'(바깥 세계) · 파티 탑의 층이면 같은 곳의 사람이 보이고, null(집 · 던전 · 혼자 오르는 탑 · 결투)이면 아무에게도 안 보인다
export function netMap(map, x = 0, y = 0) {
  if (net.map === map) return;
  net.map = map; net.x = x; net.y = y; net.players.clear();
  raw({ t: 'map', map, x: Math.round(x), y: Math.round(y) });
}
let lastPos = 0, lp = null;
export function netPos(x, y, dir, mo) {
  const now = performance.now();
  if (now - lastPos < 110) return;
  if (lp && Math.abs(lp.x - x) < 0.5 && Math.abs(lp.y - y) < 0.5 && lp.mo === mo && lp.dir === dir && now - lastPos < 3000) return;
  lastPos = now; lp = { x, y, dir, mo }; net.x = x; net.y = y;
  raw({ t: 'pos', x: Math.round(x), y: Math.round(y), dir, mo });
}
// 남의 위치는 받은 곳으로 부드럽게 따라간다
export function netLerp(dt) {
  const k = Math.min(1, dt * 10);
  for (const p of net.players.values()) {
    const dx = p.tx - p.x, dy = p.ty - p.y;
    p.moving = Math.hypot(dx, dy) > 1.2;
    if (Math.abs(dx) > 0.5) p.dir = dx > 0 ? 1 : -1;
    if (Math.hypot(dx, dy) > 300) { p.x = p.tx; p.y = p.ty; } else { p.x += dx * k; p.y += dy * k; }
  }
}

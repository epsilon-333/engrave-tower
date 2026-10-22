// 진입점: 화면 전환(광장 ↔ 필드), 입력, 고정 틱 게임 루프
import { World, DT, overworldBase } from './sim/world.js';
import { SEABED_ZONE, seabedMap } from './data/maps/seabed.js';
import { ARENA_ZONE, ARENA_SETS, buildArena, spawnArenaSet, DUEL_ZONE, buildDuelArena } from './data/maps/arena.js';
import { computeBuild } from './sim/build.js';
import { Renderer } from './render/renderer.js';
import { loadAssets, sprite, frames } from './render/assets.js';
import { Hub, renderRaceSelect } from './ui/hub.js';
import { createIntro } from './intro/intro.js';
import { newSave, newLife, loadSave, writeSave, clearSave, toLoadout, applyRun, refreshQuests, progressQuests, setSaveHook, syncLevel } from './save.js';
import { JOURNALS, STORY_ITEMS, pinoTalk, pinoPlazaTalk, newStory } from './data/story.js';
import { codexPoints, levelFor } from './data/codex.js';
import { TILE, generateField } from './sim/mapgen.js';
import { ENTRANCES } from './data/maps/overworld.js';
import { LABY_ZONE, PALACE_ZONE, buildLabyrinth, buildPalace } from './data/maps/interiors.js';
import { HOUSES, buildHouse } from './data/maps/houses.js';
import { cycleSeed, growPlot } from './sim/life.js';
import { newClock, canSleep, sleepUntilMorning, absMin, clockText } from './sim/time.js';
import { registerCrafted } from './data/crafting.js';
import { registerAllDishes, registerDish } from './data/cooking.js';
import { LEARN, ABILITIES } from './data/learn.js';
import { CROPS } from './data/goods.js';
import { GOODS, SELL_BONUS } from './data/goods.js';
import { KNACKS, knackTick, hasKnack, newKnack } from './data/knacks.js';
import { net, onNet, netSend, netConnect, netMap, netPos, netLerp } from './net.js';
import { TOWER_TOP, towerZoneId, towerSize, isBossFloor, towerGrade, towerReward, GRADE_COLOR, betterGrade, towerStarts, parTime } from './data/tower.js';
import { SANCTUMS, SANCTUM_MAX, TIER_COST, PERK_TIER, TREASURE_TIER, SHARDS_PER_RELIC, sanctumBonusText, SANCT_LIFE, sanctState, affLevel, AFF_LV, AFF_NAME, AFF_REWARD, trainCap, trainSpec, OWN_TRAIN_CAP, OWN_TRAIN_EASE, GIFT_AFF, GIFTS_PER_DAY, TRAIN_AFF, TRAINS_PER_DAY, sanctQuestDef, FIND_NAME, RACE_SHOP } from './data/sanctums.js';
import { initCloud, cloudSave, cloudSaveNow, cloudDelete, onCloud, cloudLabel, cloud, isClaudePage, login, register, logout, errorText } from './cloud.js';
import { ECHOES, ZONES, MONSTERS } from './data/monsters.js';
import { RACES, RACE_MIGRATE } from './data/races.js';
import { RACE_STORY, relation, allies, ALLY_AFF, REL_NAME, REL_COLOR } from './data/lore.js';
import { ITEMS, STYLES } from './data/items.js';
import { CC_EXTRA, CLASSES, RACE_CLASSES, SKILLS, crossReq, crossOk, handFit, fitText, KIND_NAME, plainDesc } from './data/skills.js';
import { STAT_INFO } from './data/stats.js';
import { bagAdd, SCROLL_SHOP, buyPrice } from './data/goods.js';
import { SPIRITS, SPIRIT_GRADES, SPIRIT_ELEMS, SPIRIT_STAR_MAX, STONE_PRICE, rollSpirit, addSpirit, spiritBuffText, STONE_PRICE_CALLER, CALLER_RATES, spiritLevel, SPIRIT_LV_XP } from './data/spirits.js';
import { spiritIconURL } from './render/spirits.js';
import { getAutoAim, setAutoAim } from './settings.js';
import { ENGRAVINGS } from './data/engravings.js';
import { RACE_ART } from './data/art.js';
import { buildPlaza } from './data/plaza.js';
import { unlockAudio, sfx, startMusic, getVolume, setVolume } from './audio.js';
import { setupTouch, isTouch } from './touch.js';

let save = loadSave();
const titleEl = document.getElementById('title');
const gameEl = document.getElementById('game');
const canvas = document.getElementById('canvas');
const panelEl = document.getElementById('panel');
const overlay = document.getElementById('overlay');
const renderer = new Renderer(canvas);
const plazaMap = buildPlaza();
const hub = new Hub(panelEl, () => save, (zone) => { closePanel(); if (zone === '__practice') enterPractice(); else enterZone(zone); }, resetGame, closePanel);
hub.getWorld = () => world;
// ───── 온라인: 바깥 세계에서 다른 사람이 보이고, 채팅하고, 결투하고, 파티 · 길드를 맺는다 ─────
const onlineInfo = () => ({ name: cloud.name || `${RACES[save.race]?.name || ''} 여행자`, race: save.race, cls: save.cls, weapon: save.gear?.weapon, lv: save.level, uid: save.uid, guild: save.guild || null });
function goOnline() { if (isClaudePage() || !save) return; netConnect(onlineInfo); }
// 채팅 창 (Enter로 열고 보낸다)
const chatEl = document.createElement('div');
chatEl.id = 'chat'; chatEl.hidden = true;
chatEl.innerHTML = '<div id="netinfo"></div><div id="chatlog"></div><input id="chatin" maxlength="120" placeholder="말하기 · /p 파티 · /g 길드 · Enter 보내기 · Esc 닫기" hidden>';
document.body.appendChild(chatEl);
const chatLog = chatEl.querySelector('#chatlog'), chatIn = chatEl.querySelector('#chatin'), netInfo = chatEl.querySelector('#netinfo');
function openChat() { chatIn.hidden = false; chatIn.focus(); }
function closeChat() { chatIn.value = ''; chatIn.hidden = true; chatIn.blur(); }
chatIn.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') {
    let t = chatIn.value.trim(), ch = 'all';
    const mm = t.match(/^\/(p|g|파|길)\s+/i); // /p 파티 · /g 길드
    if (mm) { ch = /p|파/i.test(mm[1]) ? 'party' : 'guild'; t = t.slice(mm[0].length); }
    if (ch === 'party' && !net.party) renderer.banner = { text: '파티가 없다', t: 1.4, color: '#c8b8a0' };
    else if (ch === 'guild' && !net.guild) renderer.banner = { text: '길드가 없다', t: 1.4, color: '#c8b8a0' };
    else if (t) netSend({ t: 'chat', text: t, ch });
    closeChat();
  }
  else if (e.key === 'Escape') closeChat();
});
onNet('chat', (m) => {
  const el = document.createElement('p');
  el.className = m.ch && m.ch !== 'all' ? 'ch-' + m.ch : '';
  el.innerHTML = `${m.ch === 'party' ? '<i>[파티]</i> ' : m.ch === 'guild' ? '<i>[길드]</i> ' : ''}<b>${esc(m.name)}</b> ${esc(m.text)}`;
  chatLog.appendChild(el);
  while (chatLog.children.length > 7) chatLog.firstChild.remove();
  setTimeout(() => el.classList.add('old'), 15000);
});
function onlineBadge() {
  chatEl.hidden = !net.up || gameEl.hidden;
  if (!chatEl.hidden) netInfo.textContent = world?.pvp ? '⚔ 결투 중' : coRun ? `파티 탑 · 같은 층 동료 ${net.players.size}명 · Enter 채팅 (/p 파티)` : world?.zone?.id === 'world' ? `온라인 · 근처 ${net.players.size}명 · Enter 채팅 · O 파티 · 길드` : '온라인 · 바깥 세계에서만 서로 보인다 · O 파티 · 길드';
}
let lastPP = null;
function onlineTick(dt) {
  if (!world || world.practice) { onlineBadge(); return; }
  const p = world.player, inWorld = world.zone?.id === 'world' && !world.pvp && world.state === 'play';
  const key = inWorld ? 'world' : coKey(); // 바깥 세계 · 파티 탑의 같은 층에서만 서로 보인다
  netMap(key, p.x, p.y);
  if (key) {
    netLerp(dt);
    const moving = !!lastPP && Math.hypot(p.x - lastPP.x, p.y - lastPP.y) > 0.3; lastPP = { x: p.x, y: p.y };
    netPos(p.x, p.y, p.dir, p.swingT > 0 || p.motion ? 'atk' : moving ? 'run' : '');
    world.remotes = [...net.players.values()];
    for (const rp of world.remotes) rp.down = !!coState.get(rp.id)?.down && !!coRun;
    world.myParty = net.party?.id || 0;
    let best = null, bd = 28;
    if (inWorld) for (const rp of world.remotes) { const dd = Math.hypot(rp.x - p.x, rp.y - p.y); if (dd < bd) { bd = dd; best = rp; } }
    world.nearRemote = world.near || world.act ? null : best;
  } else { world.remotes = null; world.nearRemote = null; }
  coTick(dt);
  if ((onlineTick.hudT = (onlineTick.hudT || 0) - dt) <= 0) { onlineTick.hudT = 0.25; partyHudTick(); }
  if (world.pvp && duel) { duelTick(dt); if (world.state === 'pvpDown') { netSend({ t: 'dend', reason: 'down' }); duelOver(false); } } // 쓰러지면 상대에게 알리고 끝
  onlineBadge();
}
// 결투: 신청 → 수락 → 투기장 → 한쪽이 쓰러지면 끝 (잃는 것은 없다)
let duel = null, duelBack = null;
const DUEL_TIME = 180; // 결투 시간 제한 (초)
function inviteDuel(rp) {
  if (rp.duel) return;
  netSend({ t: 'duelInvite', to: rp.id });
  renderer.banner = { text: `${rp.name}에게 결투를 신청했다`, sub: '상대가 받아들이면 투기장으로 간다', t: 2.4, color: '#ff9a7a' };
}
onNet('duelInvite', (m) => {
  if (!world || paused || world.pvp || world.zone?.id !== 'world' || world.state !== 'play') { netSend({ t: 'duelAnswer', to: m.from, ok: false }); return; }
  const close = () => { overlay.hidden = true; paused = false; modal = null; clearTimeout(t); };
  showModal(`<h2>결투 신청</h2><p><b>${esc(m.name)}</b> (${RACES[m.race]?.name || '?'} · Lv ${m.lv || 1}) — 결투 신청이 왔다.</p>
    <p class="muted">투기장에서 1:1로 싸운다. 대전에서는 피해 60% · 회복 50% · 보호막 60% · CC 60%로 줄어든다. 져도 잃는 것은 없다.</p>
    <div class="actions"><button id="dAcc">받아들인다</button><button id="dDec" class="ghost">거절한다</button></div>`, () => { close(); netSend({ t: 'duelAnswer', to: m.from, ok: false }); });
  const t = setTimeout(() => { if (document.getElementById('dDec')) { close(); netSend({ t: 'duelAnswer', to: m.from, ok: false }); } }, 15000);
  document.getElementById('dAcc').onclick = () => { close(); netSend({ t: 'duelAnswer', to: m.from, ok: true, maxHp: world.d.maxHp }); };
  document.getElementById('dDec').onclick = () => { close(); netSend({ t: 'duelAnswer', to: m.from, ok: false }); };
});
onNet('duelNo', (m) => { renderer.banner = { text: '결투가 열리지 않았다', sub: m.reason, t: 2.4, color: '#c8b8a0' }; });
onNet('duelStart', (m) => enterDuel(m));
const duelFoe = () => (world?.pvp ? world.enemies.find((x) => x.remote) : null);
onNet('duelHp', (m) => { const e = duelFoe(); if (e) { e.maxHp = m.maxHp; e.hp = Math.min(e.hp, m.maxHp); } });
onNet('dstate', (m) => { const e = duelFoe(); if (e) { e.tx = m.x; e.ty = m.y; e.dir = m.dir; e.hp = m.hp; e.maxHp = m.maxHp; } });
onNet('dhit', (m) => { if (world?.pvp && duel) world.pvpHit(m); });
onNet('dskill', (m) => { const e = duelFoe(); if (e && SKILLS[m.id]) world.emit({ t: 'text', x: e.x, y: e.y - 30, text: SKILLS[m.id].name, color: '#ffb0a0' }); });
onNet('dend', (m) => { if (duel) duelOver(m.reason === 'draw' ? null : m.loser !== net.id, m.reason); });
onNet('down', () => { if (duel) duelOver(false, 'net'); });
function enterDuel(m) {
  if (world?.zone?.id === 'world') { save.zoneMemory.world = world.exportMemory(); duelBack = { x: world.player.x, y: world.player.y }; }
  overlay.hidden = true; paused = false; modal = null; closeChat();
  world = new World({ build: buildNow(), mode: 'field', zone: DUEL_ZONE, zoneId: 'duel', seed: 900 + m.id, map: buildDuelArena(), pvp: { opp: m.opp }, story: save.story, codex: save.codex, ...shared() });
  world.enemies = []; world.camps = []; world.objects = []; world.explored.fill(1); world.milestones = new Set([50, 80, 100]); world.regionSeen.add(0); // 결투장: 탐험 달성 · 보상이 뜨지 않게 // 결투장: 상대만 남긴다 (포탈 · 상자 없음)
  const cx = (world.tw * TILE) / 2, cy = (world.th * TILE) / 2, L = cx - 90, R = cx + 90;
  world.player.x = m.side === 0 ? L : R; world.player.y = cy; world.player.dir = m.side === 0 ? 1 : -1;
  world.addRemote(m.opp, m.side === 0 ? R : L, cy);
  world.player.ccT = 3; // 3초 뒤 시작
  duel = { id: m.id, opp: m.opp, sendT: 0, t: 0 };
  world.pvp.left = DUEL_TIME;
  renderer.setWorld(world);
  renderer.banner = { text: `${josa(m.opp.name, "과", "와")}의 결투`, sub: '3초 뒤 시작 · 대전: 피해 60% · 회복 50% · 보호막 60% · CC 60%', t: 3, color: '#ff9a7a' };
  netSend({ t: 'duelHp', maxHp: world.d.maxHp });
  startMusic('cave'); sfx('open'); startLoop();
}
function duelTick(dt) {
  const p = world.player;
  duel.sendT -= dt;
  if (duel.sendT <= 0) { duel.sendT = 0.066; netSend({ t: 'dstate', x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, hp: Math.max(0, Math.round(p.hp)), maxHp: world.d.maxHp }); }
  for (const o of world.pvp.out.splice(0)) netSend(o);
  // 시간 제한: 끝나면 남은 체력 비율이 낮은 쪽이 진다 (진 쪽이 알린다 · 상대가 말이 없으면 이긴 쪽이 알린다)
  if (p.ccT > 0 && duel.t === 0) return; // 시작 전 3초는 세지 않는다
  duel.t += dt; world.pvp.left = Math.max(0, DUEL_TIME - duel.t);
  if (world.pvp.left > 0) return;
  const e = duelFoe(), mine = p.hp / world.d.maxHp, theirs = e ? e.hp / (e.maxHp || 1) : 0;
  if (Math.abs(mine - theirs) < 0.01) { netSend({ t: 'dend', reason: 'draw' }); duelOver(null, 'draw'); }
  else if (mine < theirs) { netSend({ t: 'dend', reason: 'time' }); duelOver(false, 'time'); }
  else if (duel.t > DUEL_TIME + 3) { netSend({ t: 'dend', reason: 'time', win: true }); duelOver(true, 'time'); }
}
function duelOver(win, reason) {
  if (!duel) return;
  const d = duel; duel = null;
  world.state = 'over';
  save.pvp ||= { win: 0, lose: 0 };
  if (reason !== 'net' && win !== null) save.pvp[win ? 'win' : 'lose']++;
  checkCcMissions();
  writeSave(save);
  sfx(win ? 'levelup' : 'error', { vol: 0.6 });
  const why = win === null ? '시간이 다 됐다. 남은 체력이 같다.'
    : reason === 'left' ? (win ? '상대가 결투를 떠났다.' : '결투를 떠났다.')
    : reason === 'net' ? '연결이 끊겼다.'
    : reason === 'time' ? (win ? '시간이 다 됐다. 체력이 더 많이 남았다.' : '시간이 다 됐다. 체력이 더 적게 남았다.')
    : win ? `${esc(josa(d.opp.name, '을', '를'))} 쓰러뜨렸다.` : `${esc(d.opp.name)}에게 졌다.`;
  showModal(`<h2>${win === null ? '무승부' : win ? '승리!' : '패배…'}</h2><p>${why}</p>
    <p class="muted">대전 기록 ${save.pvp.win}승 ${save.pvp.lose}패</p><button data-close>마을로 돌아간다</button>`, () => { overlay.hidden = true; paused = false; modal = null; enterWorld(duelBack); });
}

// ───── 파티 · 길드: 초대는 화면 오른쪽 위 카드로 (게임을 멈추지 않는다) ─────
const GUILD_COST = 300;
const invitesEl = document.createElement('div'); invitesEl.id = 'invites'; document.body.appendChild(invitesEl);
function inviteCard(html, onYes, onNo, sec = 20) {
  const el = document.createElement('div'); el.className = 'inv';
  el.innerHTML = `${html}<div class="actions"><button data-y>받아들인다</button><button data-n class="ghost">거절한다</button></div>`;
  let done = false;
  const fin = (yes) => { if (done) return; done = true; el.remove(); (yes ? onYes : onNo)?.(); };
  el.querySelector('[data-y]').onclick = () => fin(true);
  el.querySelector('[data-n]').onclick = () => fin(false);
  setTimeout(() => fin(false), sec * 1000);
  invitesEl.appendChild(el); sfx('open', { vol: 0.5, rate: 1.2 });
}
const MAP_NAME = (m) => (!m ? '혼자 있는 곳' : m === 'world' ? '바깥 세계' : m.startsWith('tw') ? `각인의 탑 ${m.split('f')[1]}층` : m);
const RANK_NAME = { leader: '길드장', officer: '부길드장', member: '길드원' };
const myRank = () => net.guild?.members.find((x) => x.uid === save.uid)?.rank;
const isPartyLeader = () => !!net.party && net.party.leader === net.id;
const seenText = (t) => { if (!t) return '오래전'; const m = (Date.now() - t) / 60000; return m < 60 ? `${Math.max(1, Math.round(m))}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };
onNet('partyInvite', (m) => inviteCard(`<b>파티 초대</b><p>${esc(m.name)} <small>${RACES[m.race]?.name || ''} · Lv ${m.lv || 1}</small></p>`, () => netSend({ t: 'partyAnswer', to: m.from, ok: true }), () => netSend({ t: 'partyAnswer', to: m.from, ok: false })));
onNet('guildInvite', (m) => inviteCard(`<b>길드 초대</b><p>${esc(m.name)} — 길드 「${esc(m.guild)}」</p>`, () => netSend({ t: 'guildAnswer', to: m.from, ok: true }), () => netSend({ t: 'guildAnswer', to: m.from, ok: false })));
onNet('partyNo', (m) => { renderer.banner = { text: '파티', sub: m.reason, t: 2.2, color: '#c8b8a0' }; });
onNet('guildNo', (m) => { renderer.banner = { text: '길드', sub: m.reason, t: 2.2, color: '#c8b8a0' }; });
onNet('guildMade', (m) => { save.gold = Math.max(0, save.gold - GUILD_COST); writeSave(save); renderer.banner = { text: `길드 「${m.name}」`, sub: '길드를 세웠다 · O 창에서 근처 사람을 초대한다', t: 3, color: '#ffd27a' }; sfx('levelup', { vol: 0.5 }); });
onNet('party', (m) => {
  if (!m.id && m.why) renderer.banner = { text: '파티', sub: m.why, t: 2.2, color: '#c8b8a0' };
  if (coRun?.role === 'member' && (!net.party || net.party.leader !== coRun.host)) coSolo('파티장이 파티를 떠났다 — 혼자 이어 오른다');
  refreshSocial();
});
onNet('guild', (m) => {
  const g = m.id ? { id: m.id, name: m.name, rank: m.members.find((x) => x.uid === save.uid)?.rank || 'member' } : null;
  if (JSON.stringify(g) !== JSON.stringify(save.guild || null)) { save.guild = g; writeSave(save); }
  if (!m.id && m.why) renderer.banner = { text: '길드', sub: m.why, t: 2.2, color: '#c8b8a0' };
  refreshSocial();
});
onNet('down', () => { if (coRun?.role === 'member') coSolo('서버와 연결이 끊겼다 — 혼자 이어 오른다'); });

// 가까운 사람 앞에서 G: 결투 · 파티 · 길드
function openMeet(rp) {
  if (rp.duel) { renderer.banner = { text: rp.name, sub: '결투 중이다', t: 1.6, color: '#c8b8a0' }; return; }
  const inParty = !!net.party?.members.some((x) => x.id === rp.id);
  const canParty = !inParty && !rp.party && (!net.party || (isPartyLeader() && net.party.members.length < 4));
  const r = myRank(), canGuild = !!net.guild && (r === 'leader' || r === 'officer') && !rp.gname;
  showModal(`<h2>${esc(rp.name)}</h2><p class="muted">${RACES[rp.race]?.name || ''} · Lv ${rp.lv || 1}${rp.gname ? ` · 길드 「${esc(rp.gname)}」` : ''}${inParty ? ' · 같은 파티' : rp.party ? ' · 다른 파티에 있다' : ''}</p>
    <div class="actions col"><button id="mDuel">결투 신청</button><button id="mTrade">교환 신청</button>${canParty ? '<button id="mParty">파티 초대</button>' : ''}${canGuild ? '<button id="mGuild">길드 초대</button>' : ''}<button data-close class="ghost">닫기</button></div>`);
  const close = () => { overlay.hidden = true; paused = false; modal = null; };
  document.getElementById('mDuel').onclick = () => { close(); inviteDuel(rp); };
  document.getElementById('mTrade').onclick = () => { close(); netSend({ t: 'tradeInvite', to: rp.id }); renderer.banner = { text: `${rp.name}에게 교환을 신청했다`, t: 2, color: '#ffd27a' }; };
  const bp = document.getElementById('mParty'); if (bp) bp.onclick = () => { close(); netSend({ t: 'partyInvite', to: rp.id }); renderer.banner = { text: `${rp.name}에게 파티 초대를 보냈다`, t: 2, color: '#9fe6a0' }; };
  const bg = document.getElementById('mGuild'); if (bg) bg.onclick = () => { close(); netSend({ t: 'guildInvite', to: rp.id }); renderer.banner = { text: `${rp.name}에게 길드 초대를 보냈다`, t: 2, color: '#ffd27a' }; };
}

// ───── 교환: 서로 내놓을 것(골드 · 가방의 물건 · 장비)을 정하고, 둘 다 확정하면 주고받는다 ─────
let trade = null;
const emptyOffer = () => ({ gold: 0, goods: {}, items: [] });
onNet('tradeInvite', (m) => inviteCard(`<b>교환 신청</b><p>${esc(m.name)}</p>`, () => netSend({ t: 'tradeAnswer', to: m.from, ok: true }), () => netSend({ t: 'tradeAnswer', to: m.from, ok: false })));
onNet('tradeNo', (m) => { renderer.banner = { text: '교환', sub: m.reason, t: 2.2, color: '#c8b8a0' }; });
onNet('tradeStart', (m) => { trade = { with: m.with, name: m.name, mine: emptyOffer(), theirs: emptyOffer(), myOk: false, theirOk: false }; showTrade(); });
onNet('tradeOffer', (m) => { if (!trade) return; trade.theirs = m.offer; trade.myOk = false; trade.theirOk = false; showTrade(); });
onNet('tradeConfirm', (m) => { if (!trade) return; trade.theirOk = true; tradeCheck(); });
onNet('tradeCancel', () => { if (!trade) return; trade = null; if (modal) { overlay.hidden = true; paused = false; modal = null; } renderer.banner = { text: '교환이 취소됐다', t: 2, color: '#c8b8a0' }; });
onNet('tradeDone', () => {});
const tradeable = () => ({ goods: Object.entries(save.bag || {}).filter(([id, n]) => n > 0 && GOODS[id]), items: (save.items || []).filter((id) => ITEMS[id] && !Object.values(save.gear || {}).includes(id) && id !== 'rustySword' && !ITEMS[id].starter) });
const offerText = (o) => [o.gold ? `◆ ${o.gold} 골드` : '', ...Object.entries(o.goods || {}).filter(([, n]) => n > 0).map(([id, n]) => `${GOODS[id]?.name || id} ×${n}`), ...(o.items || []).map((id) => ITEMS[id]?.name || id)].filter(Boolean);
function sendOffer() { trade.myOk = false; trade.theirOk = false; netSend({ t: 'tradeOffer', offer: trade.mine }); showTrade(); }
function showTrade() {
  if (!trade) return;
  const T = trade, have = tradeable();
  const goodsRows = have.goods.map(([id, n]) => { const k = T.mine.goods[id] || 0; return `<div class="soc-row"><span class="nm">${esc(GOODS[id].name)} <small class="muted">${n}개</small></span><span class="btns"><button class="sm ghost" data-tg="${id}" data-d="-1" ${k ? '' : 'disabled'}>−</button><b>${k}</b><button class="sm ghost" data-tg="${id}" data-d="1" ${k < n ? '' : 'disabled'}>+</button></span></div>`; }).join('');
  const itemRows = have.items.map((id) => { const on = T.mine.items.includes(id); return `<div class="soc-row ${on ? 'on' : ''}"><span class="nm">${esc(ITEMS[id].name)}</span><span class="btns"><button class="sm ${on ? '' : 'ghost'}" data-ti="${id}">${on ? '넣었다' : '넣기'}</button></span></div>`; }).join('');
  const theirs = offerText(T.theirs), mine = offerText(T.mine);
  showModal(`<div class="social" id="tradeBox"><h2>교환 · ${esc(T.name)}</h2>
    <div class="trade-cols"><div><h4>내가 줄 것 ${T.myOk ? '<span class="up">✔ 확정</span>' : ''}</h4><p>${mine.length ? mine.map(esc).join(' · ') : '<span class="muted">아직 없다</span>'}</p>
      <div class="soc-make"><input id="tgold" type="number" min="0" max="${save.gold}" value="${T.mine.gold}" placeholder="골드"><button class="sm" data-tgold>골드 정하기</button></div><small class="muted">가진 골드 ${save.gold}</small>
      <h4>가방</h4><div class="soc-list trade-list">${goodsRows || '<p class="muted">없음</p>'}</div><h4>장비 (들고 있지 않은 것)</h4><div class="soc-list trade-list">${itemRows || '<p class="muted">없음</p>'}</div></div>
    <div><h4>받을 것 ${T.theirOk ? '<span class="up">✔ 확정</span>' : ''}</h4><p>${theirs.length ? theirs.map(esc).join(' · ') : '<span class="muted">아직 없다</span>'}</p></div></div>
    <p class="muted">어느 쪽이든 내놓을 것을 바꾸면 확정이 풀린다. 둘 다 확정하면 바로 주고받는다.</p>
    <div class="actions"><button id="tOk" ${T.myOk ? 'disabled' : ''}>확정</button><button id="tNo" class="ghost">그만두기</button></div></div>`, () => tradeCancel());
  const box = document.getElementById('tradeBox');
  box.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
  box.onclick = (e) => {
    const b = e.target.closest('button'); if (!b || !trade) return;
    if (b.id === 'tOk') { trade.myOk = true; netSend({ t: 'tradeConfirm' }); tradeCheck(); return; }
    if (b.id === 'tNo') { tradeCancel(); return; }
    if (b.dataset.tgold != null) { trade.mine.gold = Math.max(0, Math.min(save.gold, Math.floor(+document.getElementById('tgold').value || 0))); sendOffer(); return; }
    if (b.dataset.tg) { const id = b.dataset.tg; trade.mine.goods[id] = Math.max(0, Math.min(save.bag[id] || 0, (trade.mine.goods[id] || 0) + +b.dataset.d)); sendOffer(); return; }
    if (b.dataset.ti) { const id = b.dataset.ti, L = trade.mine.items; trade.mine.items = L.includes(id) ? L.filter((x) => x !== id) : [...L, id]; sendOffer(); }
  };
}
function tradeCancel() { if (trade) netSend({ t: 'tradeCancel' }); trade = null; overlay.hidden = true; paused = false; modal = null; }
// 둘 다 확정: 내 것을 내주고 상대 것을 받는다 (각자의 화면이 똑같이 한다)
function tradeCheck() {
  if (!trade) return;
  if (!(trade.myOk && trade.theirOk)) { showTrade(); return; }
  const { mine, theirs, name } = trade;
  const okMine = mine.gold <= save.gold && Object.entries(mine.goods).every(([id, n]) => (save.bag[id] || 0) >= n) && mine.items.every((id) => save.items.includes(id));
  if (!okMine) { tradeCancel(); renderer.banner = { text: '교환 실패', sub: '내놓은 물건이 모자라다', t: 2, color: '#ff9a7a' }; return; }
  save.gold += (theirs.gold || 0) - mine.gold;
  for (const [id, n] of Object.entries(mine.goods)) { save.bag[id] -= n; if (save.bag[id] <= 0) delete save.bag[id]; }
  for (const [id, n] of Object.entries(theirs.goods || {})) if (n > 0 && GOODS[id]) save.bag[id] = (save.bag[id] || 0) + n;
  save.items = save.items.filter((id) => !mine.items.includes(id));
  for (const id of theirs.items || []) if (ITEMS[id] && !save.items.includes(id)) save.items.push(id);
  writeSave(save); cloudSaveNow(save);
  netSend({ t: 'tradeDone' }); trade = null;
  overlay.hidden = true; paused = false; modal = null;
  renderer.banner = { text: `${josa(name, '과', '와')} 교환했다`, sub: offerText(theirs).join(' · ') || '받은 것 없음', t: 3, color: '#ffd27a' }; sfx('coin', { vol: 0.7 });
}

// 동료 창 (O): 파티 · 길드
let socialTab = 'party', socialOpen = false;
function showSocial(tab) {
  if (tab) socialTab = tab;
  if (!net.up) { renderer.banner = { text: '온라인이 아니다', sub: '서버와 이어져야 파티 · 길드를 쓸 수 있다', t: 2.2, color: '#c8b8a0' }; return; }
  showModal(`<div id="social" class="social">${socialHtml()}</div>`, () => { overlay.hidden = true; paused = false; modal = null; socialOpen = false; sfx('close', { vol: 0.4 }); });
  socialOpen = true; bindSocial();
}
function refreshSocial() {
  if (!socialOpen) return;
  const el = document.getElementById('social'); if (!el) { socialOpen = false; return; }
  const keep = {}; el.querySelectorAll('input').forEach((i) => (keep[i.id] = i.value)); // 쓰던 글은 그대로
  el.innerHTML = socialHtml(); bindSocial();
  for (const [id, v] of Object.entries(keep)) { const i = document.getElementById(id); if (i) i.value = v; }
}
function socialHtml() {
  const tabs = `<nav class="soc-tabs"><button data-soc="party" class="${socialTab === 'party' ? 'on' : ''}">파티${net.party ? ` ${net.party.members.length}` : ''}</button><button data-soc="guild" class="${socialTab === 'guild' ? 'on' : ''}">길드</button></nav>`;
  const p = world?.player, near = world?.zone?.id === 'world' && p ? [...net.players.values()].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 6) : [];
  return `<h2>동료</h2>${tabs}${socialTab === 'party' ? partyHtml(near) : guildHtml(near)}<div class="actions"><button data-close class="ghost">닫기</button></div>`;
}
function nearHtml(near, kind) {
  if (!kind) return '';
  near = near.filter((rp) => (kind === 'party' ? !rp.party : !rp.gname)); // 이미 파티 · 길드에 있는 사람은 초대할 수 없다
  if (!near.length) return '<p class="muted">근처에 다른 사람이 없다 (바깥 세계에서만 서로 보인다).</p>';
  return `<h4>근처 사람</h4><div class="soc-list">${near.map((rp) => `<div class="soc-row"><span class="nm"><b>${esc(rp.name)}</b>${rp.gname ? ` <small class="gtag">[${esc(rp.gname)}]</small>` : ''}</span><span class="muted">${RACES[rp.race]?.name || ''} · Lv ${rp.lv || 1}</span><span class="btns"><button class="sm" data-inv="${kind}" data-id="${rp.id}">${kind === 'party' ? '파티 초대' : '길드 초대'}</button></span></div>`).join('')}</div>`;
}
function partyHtml(near) {
  const pt = net.party, lead = isPartyLeader();
  let h = '';
  if (!pt) h += '<p class="muted">파티가 없다. 바깥 세계에서 다른 사람에게 다가가 G를 누르거나 아래 근처 사람에게 초대를 보낸다. 파티는 4명까지.</p>';
  else {
    h += `<div class="soc-list">${pt.members.map((x) => {
      const me = x.id === net.id;
      const btn = me ? '<button class="sm ghost" data-pact="leave">나가기</button>' : lead ? `<button class="sm ghost" data-pact="lead" data-id="${x.id}">파티장 넘기기</button><button class="sm ghost" data-pact="kick" data-id="${x.id}">내보내기</button>` : '';
      return `<div class="soc-row on"><span class="nm">${x.id === pt.leader ? '<em class="lead">파티장</em> ' : ''}<b>${esc(x.name)}</b>${me ? ' (나)' : ''}</span><span class="muted">${RACES[x.race]?.name || ''} · Lv ${x.lv || 1} · ${MAP_NAME(x.map)}</span><span class="btns">${btn}</span></div>`;
    }).join('')}</div>
      <p class="muted">파티장이 각인의 탑 입구에서 「파티와 함께 오르기」를 고르면 같은 층을 함께 오른다. 몬스터를 쓰러뜨리면 모두가 전리품 · 도감을 얻고, 쓰러져도 동료가 층을 깨면 다시 일어난다. 파티 채팅은 /p.</p>`;
  }
  return h + nearHtml(near, !pt || (lead && pt.members.length < 4) ? 'party' : null);
}
function guildHtml(near) {
  const g = net.guild;
  if (!g) return `<p class="muted">길드에 들지 않았다. 길드를 세우면 길드원끼리 채팅(/g)하고 이름 앞에 길드 이름이 붙는다. 길드는 서버에 남는다.</p>
    <div class="soc-make"><input id="gname" maxlength="12" placeholder="길드 이름 (2~12글자)"><button data-gact="create" ${save.gold >= GUILD_COST ? '' : 'disabled'}>세우기 · ${GUILD_COST} 골드</button></div>
    <p class="muted">초대를 받으면 화면 오른쪽 위에 카드가 뜬다.</p>`;
  const r = myRank(), mng = r === 'leader' || r === 'officer';
  const rows = g.members.map((x) => {
    const me = x.uid === save.uid;
    const btn = me ? '<button class="sm ghost" data-gact="leave">나가기</button>'
      : r === 'leader' ? `${x.rank === 'member' ? `<button class="sm ghost" data-gact="officer" data-uid="${x.uid}">부길드장으로</button>` : `<button class="sm ghost" data-gact="member" data-uid="${x.uid}">길드원으로</button>`}<button class="sm ghost" data-gact="leader" data-uid="${x.uid}">길드장 넘기기</button><button class="sm ghost" data-gact="kick" data-uid="${x.uid}">내보내기</button>`
      : r === 'officer' && x.rank === 'member' ? `<button class="sm ghost" data-gact="kick" data-uid="${x.uid}">내보내기</button>` : '';
    return `<div class="soc-row ${x.online ? 'on' : ''}"><span class="nm"><i class="dot"></i><b>${esc(x.name)}</b>${me ? ' (나)' : ''}</span><span class="muted">${RANK_NAME[x.rank]} · ${RACES[x.race]?.name || ''} · Lv ${x.lv || 1}${x.online ? '' : ' · ' + seenText(x.seen)}</span><span class="btns">${btn}</span></div>`;
  }).join('');
  return `<h3 class="gname">「${esc(g.name)}」 <small>${g.members.length}명 · 접속 ${g.members.filter((x) => x.online).length}명</small></h3>
    ${mng ? `<div class="soc-make"><input id="gnotice" maxlength="80" value="${esc(g.notice)}" placeholder="길드 공지"><button class="sm" data-gact="notice">공지 바꾸기</button></div>` : g.notice ? `<p class="gnotice">${esc(g.notice)}</p>` : ''}
    <div class="soc-list">${rows}</div><p class="muted">길드 채팅: 채팅 창(Enter)에서 앞에 /g 를 붙인다.</p>${nearHtml(near, mng ? 'guild' : null)}`;
}
function bindSocial() {
  const el = document.getElementById('social'); if (!el) return;
  el.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') el.querySelector(i.id === 'gname' ? '[data-gact="create"]' : '[data-gact="notice"]')?.click(); }));
  el.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => modal?.()));
  el.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.soc) { socialTab = d.soc; refreshSocial(); return; }
    if (d.pact === 'leave') netSend({ t: 'partyLeave' });
    else if (d.pact === 'kick') netSend({ t: 'partyKick', id: +d.id });
    else if (d.pact === 'lead') netSend({ t: 'partyLead', id: +d.id });
    else if (d.inv) { netSend({ t: d.inv === 'party' ? 'partyInvite' : 'guildInvite', to: +d.id }); b.disabled = true; b.textContent = '보냈다'; }
    else if (d.gact === 'create') {
      const name = document.getElementById('gname')?.value.trim() || '';
      if (name.length < 2) { renderer.banner = { text: '길드 이름은 두 글자 이상', t: 1.6, color: '#c8b8a0' }; return; }
      if (save.gold < GUILD_COST) { renderer.banner = { text: `골드가 모자라다 (${GUILD_COST})`, t: 1.6, color: '#c8b8a0' }; return; }
      netSend({ t: 'guildCreate', name });
    } else if (d.gact === 'leave') netSend({ t: 'guildLeave' });
    else if (d.gact === 'kick') netSend({ t: 'guildKick', uid: d.uid });
    else if (d.gact === 'officer' || d.gact === 'member' || d.gact === 'leader') netSend({ t: 'guildRank', uid: d.uid, rank: d.gact });
    else if (d.gact === 'notice') { netSend({ t: 'guildNotice', text: document.getElementById('gnotice')?.value || '' }); renderer.banner = { text: '길드 공지를 바꿨다', t: 1.4, color: '#ffd27a' }; }
  };
}

// 파티 체력 (화면 왼쪽): 파티 탑에서는 동료의 체력, 밖에서는 어디 있는지
const partyHud = document.createElement('div'); partyHud.id = 'partyHud'; partyHud.hidden = true; document.body.appendChild(partyHud);
function partyHudTick() {
  const pt = net.party;
  if (!pt || gameEl.hidden || !world) { partyHud.hidden = true; return; }
  partyHud.hidden = false;
  const now = performance.now();
  partyHud.innerHTML = pt.members.filter((x) => x.id !== net.id).map((x) => {
    const cs = coState.get(x.id), live = coRun && cs && now - cs.t < 3000;
    const hp = live ? Math.max(0, Math.min(1, cs.hp / Math.max(1, cs.maxHp))) : null;
    return `<div class="ph ${live && cs.down ? 'down' : ''}"><b>${x.id === pt.leader ? '★ ' : ''}${esc(x.name)}</b>${hp != null ? `<i><s style="width:${Math.round(hp * 100)}%"></s></i>${cs.down ? '<small>쓰러짐</small>' : ''}` : `<small>${MAP_NAME(x.map)}</small>`}</div>`;
  }).join('');
}

// ───── 파티 탑: 파티장의 세계가 몬스터를 움직이고, 동료의 세계는 그 모습을 보여 주며 자기 공격을 보낸다 ─────
let coRun = null;           // { role: 'host' | 'member', host, party, snapT, flushT, meT, lastSnap }
const coState = new Map();  // 동료의 체력 · 쓰러짐 (id → { hp, maxHp, down, f, t })
const coKey = () => (coRun && world?.coop ? (coRun.key || (world.tower ? `tw${coRun.party}f${world.tower.f}` : null)) : null);
const coF = () => coRun?.key || world?.tower?.f; // 같은 곳인지 맞춰 보는 표 (탑은 층 · 던전은 열쇠)
const IDLE_INPUT = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dash: false, interact: false, skill: false, s1: false, s2: false, s3: false, s4: false, wskill: false };
function startCoZone(id) {
  save.zoneSeeds ||= {};
  if (save.zoneSeeds[id] == null) save.zoneSeeds[id] = (Math.random() * 1e9) >>> 0;
  const seed = save.zoneSeeds[id];
  enterInterior(id, 0, null, { role: 'host', seed });
  netSend({ t: 'co', k: 'zstart', id, seed });
  renderer.banner = { text: `${ENTRANCES[id].name} · 파티`, sub: '동료가 받아들이면 같은 던전에 나타난다 · 몬스터는 함께, 상자 · 채집은 각자', t: 3, color: '#9fe6ff' };
}
function startCoTower(f) {
  const seed = (Math.random() * 1e9) >>> 0;
  enterTower(f, null, { role: 'host', seed });
  netSend({ t: 'co', k: 'start', f, seed });
  renderer.banner = { text: `각인의 탑 ${f}층 · 파티`, sub: '동료가 받아들이면 같은 층에 나타난다', t: 3, color: '#9fe6ff' };
}
onNet('co', (m) => {
  if (!world) return;
  const fromName = net.party?.members.find((x) => x.id === m.from)?.name || '동료';
  switch (m.k) {
    case 'start': { // 파티장이 탑에 오른다 → 함께 갈지 묻는다
      if (net.party?.leader !== m.from) break;
      const busy = coRun || world.pvp || duel || world.zone?.id !== 'world' || world.state !== 'play';
      if (busy) { netSend({ t: 'co', to: m.from, k: 'no', why: world.zone?.id !== 'world' ? '바깥 세계에 없다' : '다른 일을 하는 중' }); break; }
      inviteCard(`<b>파티 탑</b><p>${esc(josa(fromName, "이", "가"))} 각인의 탑 <b>${m.f}층</b>에 오른다</p>`, () => {
        if (world.zone?.id !== 'world' || world.state !== 'play' || coRun) return;
        if (modal) { overlay.hidden = true; paused = false; modal = null; }
        if (!panelEl.hidden) closePanel();
        enterTower(m.f, null, { role: 'member', seed: m.seed, host: m.from });
      }, () => netSend({ t: 'co', to: m.from, k: 'no', why: '거절했다' }), 25);
      break;
    }
    case 'zstart': { // 파티장이 던전에 들어간다
      if (net.party?.leader !== m.from || !ENTRANCES[m.id]) break;
      const busy = coRun || world.pvp || duel || world.zone?.id !== 'world' || world.state !== 'play';
      if (busy) { netSend({ t: 'co', to: m.from, k: 'no', why: world.zone?.id !== 'world' ? '바깥 세계에 없다' : '다른 일을 하는 중' }); break; }
      inviteCard(`<b>파티 던전</b><p>${esc(josa(fromName, '이', '가'))} <b>${esc(ENTRANCES[m.id].name)}</b>에 들어간다</p>`, () => {
        if (world.zone?.id !== 'world' || world.state !== 'play' || coRun) return;
        if (modal) { overlay.hidden = true; paused = false; modal = null; }
        if (!panelEl.hidden) closePanel();
        curInterior = { id: m.id, x: world.player.x, y: world.player.y };
        enterInterior(m.id, 0, null, { role: 'member', seed: m.seed, host: m.from });
      }, () => netSend({ t: 'co', to: m.from, k: 'no', why: '거절했다' }), 25);
      break;
    }
    case 'zdown': // 파티장이 아래층으로 → 함께
      if (coRun?.role === 'member' && m.from === coRun.host) {
        if (modal) { overlay.hidden = true; paused = false; modal = null; }
        enterInterior(m.id, m.depth, { loot: world.loot, discovered: world.discovered, hp: Math.max(world.player.hp, world.d.maxHp * 0.3), codexStart: world.codexStart, rootMemory: world.rootMemory }, { role: 'member', seed: m.seed, host: m.from });
      }
      break;
    case 'no': renderer.banner = { text: `${fromName} — 함께 오르지 않는다`, sub: m.why, t: 2.4, color: '#c8b8a0' }; break;
    case 'me': coState.set(m.from, { hp: m.hp, maxHp: m.maxHp, down: !!m.down, f: m.f, t: performance.now() }); break;
    case 'snap':
      if (coRun && coF() === m.f && world.coop) { world.coApplySnap(m, m.from); if (m.from === coRun.host) coRun.lastSnap = performance.now(); }
      break;
    case 'b': // 묶음: 동료 → 파티장(피해 · 상태이상 · CC …) · 파티장 → 동료(맞았다)
      if (!world.coop || !coRun) break;
      for (const x of m.l || []) { if (x.k === 'hurt') world.coHurt(x); else world.coRecv(x, m.from); } // 누구든: 맞았다 · 내가 맡은 몬스터에 들어온 공격
      break;
    case 'own': if (coRun?.role === 'member' && m.from === coRun.host && coF() === m.f && world.coop) { world.coSetOwners(m.l || [], net.id); coRun.lastSnap = performance.now(); } break; // 내가 맡을 몬스터
    case 'sync': if (world.coop) world.coop.known.clear(); break; // 늦게 온 동료: 적의 종류부터 다시
    case 'next': if (coRun?.role === 'host') document.getElementById('twNext')?.click(); break; // 동료가 다음 층으로 가자고 했다
    case 'stairs': // 동료가 계단에 닿았다 (파티장이 쓰러져 있어도 층을 깰 수 있게)
      if (coRun?.role === 'host' && world.state === 'play' && world.tower && (!world.tower.boss || world.tower.boss.dead)) {
        renderer.banner = { text: `${josa(fromName, '이', '가')} 계단에 닿았다`, t: 2, color: '#9fe6ff' };
        world.signals.push({ t: 'towerClear', f: world.tower.f, time: world.tower.t, hurt: world.tower.hurt, maxHp: world.d.maxHp }); handleSignals();
      }
      break;
    case 'clear': if (coRun?.role === 'member' && m.from === coRun.host && world.tower?.f === m.f) { world.coRevive(1); world.signals.push({ t: 'towerClear', f: world.tower.f, time: world.tower.t, hurt: world.tower.hurt, maxHp: world.d.maxHp }); handleSignals(); } break;
    case 'floor': // 파티장이 다음 층으로 → 함께
      if (coRun?.role === 'member' && m.from === coRun.host) {
        if (modal) { overlay.hidden = true; paused = false; modal = null; }
        enterTower(m.f, { loot: world.loot, discovered: world.discovered, hp: Math.max(world.player.hp, world.d.maxHp * 0.3), codexStart: world.codexStart }, { role: 'member', seed: m.seed, host: m.from });
      }
      break;
    case 'end': if (coRun?.role === 'member' && m.from === coRun.host) { coRun = null; if (modal) { overlay.hidden = true; paused = false; modal = null; } world.state = 'play'; renderer.banner = { text: '파티장이 탑을 나갔다', t: 2.4, color: '#c8b8a0' }; endRun('clear'); } break;
    case 'wipe': if (coRun && m.from === coRun.host) coWipe(); break;
    case 'bye': if (coRun?.role === 'host') { world.coop?.mates.delete(m.from); renderer.banner = { text: `${josa(fromName, "이", "가")} 탑을 나갔다`, t: 2, color: '#c8b8a0' }; } break;
  }
});
function coTick(dt) {
  if (!coRun || !world?.coop) return;
  const w = world, p = w.player, now = performance.now(), host = coRun.role === 'host', F = coF();
  if ((coRun.meT -= dt) <= 0) { coRun.meT = 0.25; netSend({ t: 'co', k: 'me', hp: Math.round(p.hp), maxHp: w.d.maxHp, down: p.down ? 1 : 0, f: F }); }
  // 같은 층의 동료 (자리는 지도 중계 · 쓰러짐은 me) — 파티장도 동료도 똑같이: 내가 맡은 몬스터는 내 세계가 움직이고 가까운 사람을 노린다
  const mates = w.coop.mates;
  for (const rp of net.players.values()) {
    if (!net.party?.members.some((x) => x.id === rp.id)) continue;
    let mt = mates.get(rp.id);
    if (!mt) { mt = { id: rp.id, name: rp.name, r: 5, dead: false }; mates.set(rp.id, mt); }
    const cs = coState.get(rp.id);
    mt.x = rp.x; mt.y = rp.y; mt.dead = !!(cs && cs.down && cs.f === F);
  }
  for (const id of [...mates.keys()]) if (!net.players.has(id)) mates.delete(id);
  if (host) {
    w.coScale(1 + mates.size); // 인원수에 따라 난이도
    if ((coRun.ownT -= dt) <= 0 || coRun.ownT == null) { coRun.ownT = 0.5; const l = w.coOwners(net.id); w.coSetOwners(l, net.id); if (mates.size) netSend({ t: 'co', k: 'own', f: F, l }); } // 몬스터마다 가장 가까운 사람이 맡는다
  }
  if ((coRun.knownT -= dt) <= 0 || coRun.knownT == null) { coRun.knownT = 3; w.coop.known.clear(); } // 늦게 온 동료도 몬스터 종류를 알게
  if ((coRun.snapT -= dt) <= 0) { coRun.snapT = 0.1; const s = w.coSnap(); if (mates.size && (s.e.length || s.dead.length || s.ev.length)) netSend({ t: 'co', f: F, ...s }); }
  const by = new Map();
  for (const o of w.coFlush()) { const to = o.to || coRun.host; if (!by.has(to)) by.set(to, []); by.get(to).push(o); }
  for (const [to, l] of by) netSend({ t: 'co', to, k: 'b', l });
  if (host && p.down && w.state === 'play' && [...mates.values()].every((mt) => mt.dead)) { netSend({ t: 'co', k: 'wipe', f: F }); coWipe(); } // 모두 쓰러졌다
  if (!host && now - coRun.lastSnap > 6000 && w.state === 'play') coSolo('파티장의 소식이 끊겼다 — 혼자 이어 오른다');
}
// 파티장을 잃은 동료: 꼭두각시였던 몬스터가 스스로 움직이고, 혼자 이어 오른다
function coSolo(why) {
  if (!coRun || !world) return;
  coRun = null;
  if (world.coop) {
    world.coop = null;
    world.player.down = false;
    if (world.player.hp <= 0) world.player.hp = world.d.maxHp * 0.3;
    for (const e of world.enemies) if (e.puppet) { e.puppet = false; e.state = 'chase'; }
    world.projs = world.projs.filter((x) => !x.ghost);
  }
  renderer.banner = { text: '파티 탑이 끝났다', sub: why, t: 3, color: '#c8b8a0' };
}
// 모두 쓰러졌다: 다 같이 탑 밖으로 (쓰러진 것과 같다)
function coWipe() {
  if (!coRun || !world) return;
  coRun = null;
  if (modal) { overlay.hidden = true; paused = false; modal = null; }
  world.coop = null; world.player.down = false; world.player.hp = 0;
  world.state = 'dead';
  renderer.banner = { text: '파티가 모두 쓰러졌다', t: 3, color: '#ff8a7a' };
}

// ───── 튜토리얼: 마을 광장에서 조작을 하나씩 따라 한다 (건너뛸 수 있다) ─────
const tutFlags = { interact: false, panel: false };
const TUT = [
  { text: 'WASD로 걸어 보세요', done: (w, t) => Math.hypot(w.player.x - t.x0, w.player.y - t.y0) > 70 },
  { text: 'Space로 굴러 보세요 — 구르는 동안은 공격을 피한다', done: (w, t) => w.player.dashCharges < t.dash0 },
  { text: '좌클릭으로 허수아비를 세 번 때리세요 (마우스 쪽으로 휘두른다)', setup: (w, t) => { const e = w.makeEnemy('dummy', w.player.x + 46, w.player.y); e.home = { x: e.x, y: e.y }; e.tut = true; w.enemies.push(e); t.dummy = e; t.hp = e.hp; t.hits = 0; },
    done: (w, t) => { if (!t.dummy) return true; if (t.dummy.hp < t.hp) { t.hits++; t.hp = t.dummy.hp; } return t.hits >= 3; } },
  { text: 'Q · E로 스킬을 써 보세요 — 아래 칸에 남은 시간이 숫자로 보인다', done: (w) => Object.values(w.player.cds || {}).some((v) => v > 0.45) },
  { text: '우클릭으로 무기 기술을 써 보세요', done: (w) => w.player.skillCd > 0 || !!w.player.charging },
  { text: '무언가 앞에서 G — 표지판을 읽고, 사람에게 말을 걸고, 모닥불에서 쉰다', done: () => tutFlags.interact },
  { text: 'I 장비 · B 가방 · J 퀘스트 · C 캐릭터 — 하나를 열어 보세요', done: () => tutFlags.panel },
];
let tutEl = null;
function tutorialTick() {
  const T = save?.tutorial;
  if (!T || T.done || !world || world.zone?.id !== 'world' || world.state !== 'play' || paused) { if (tutEl) tutEl.hidden = true; return; }
  const step = TUT[T.step];
  if (!step) { finishTutorial(true); return; }
  const rt = (tutorialTick.rt ||= {});
  if (rt.step !== T.step || rt.world !== world) { rt.step = T.step; rt.world = world; rt.x0 = world.player.x; rt.y0 = world.player.y; rt.dash0 = world.player.dashCharges; tutFlags.interact = false; tutFlags.panel = false; step.setup?.(world, rt); }
  if (!tutEl) {
    tutEl = document.createElement('div'); tutEl.id = 'tut'; document.body.appendChild(tutEl);
    tutEl.addEventListener('click', (e) => { if (e.target.dataset.tutskip != null) finishTutorial(false); });
  }
  tutEl.hidden = false;
  tutEl.innerHTML = `<small>튜토리얼 ${T.step + 1} / ${TUT.length}</small><b>${step.text}</b><button data-tutskip>건너뛰기</button>`;
  if (step.done(world, rt)) { T.step++; sfx('open', { vol: 0.5, rate: 1.4 }); writeSave(save); }
}
function finishTutorial(done) {
  save.tutorial = { done: true };
  const d = tutorialTick.rt?.dummy; if (d) { d.dead = true; world.enemies = world.enemies.filter((e) => e !== d); }
  tutorialTick.rt = null;
  if (tutEl) tutEl.hidden = true;
  if (done) renderer.banner = { text: '튜토리얼 끝!', sub: '북쪽 각인의 탑 · 섬 곳곳의 종족 성지 · 마을 의뢰 게시판에서 모험을 시작하세요', t: 4.5, color: '#ffe8a8' };
  writeSave(save);
}

// ───── 각인의 탑 50층 ─────
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function showTower() {
  const T = (save.tower ||= { best: {}, max: 0 }), starts = towerStarts(T.max);
  const floors = Array.from({ length: Math.min(TOWER_TOP, T.max + 1) }, (_, i) => i + 1).map((f) => `<span class="tw-f ${isBossFloor(f) ? 'boss' : ''}" style="--c:${GRADE_COLOR[T.best[f]] || '#5a5068'}">${f}<b>${T.best[f] || '·'}</b></span>`).join('');
  showModal(`<h2>각인의 탑</h2>
    <p class="muted">층마다 짧은 던전이다. 계단에 닿으면 클리어 — 걸린 시간과 받은 피해로 등급(S · A · B · C)과 보상을 받는다. 5층마다 층 수호자를 쓰러뜨려야 계단이 열린다. 오를수록 몬스터가 크게 강해진다. 쓰러지면 탑 밖으로 밀려난다.</p>
    <p>최고 기록 <b>${T.max}층</b> / ${TOWER_TOP}층</p><div class="tw-floors">${floors}</div>
    <div class="actions">${starts.map((f) => `<button data-tw="${f}">${f}층부터 오르기</button>`).join('')}<button data-close class="ghost">돌아간다</button></div>
    ${isPartyLeader() && net.party.members.length > 1 ? `<h4>파티와 함께 <small>${net.party.members.length}명 · 동료에게 함께 갈지 묻는다 (바깥 세계에 있는 동료만)</small></h4><div class="actions">${starts.map((f) => `<button data-twp="${f}">${f}층부터 파티와 오르기</button>`).join('')}</div>` : net.party && !isPartyLeader() ? '<p class="muted">파티에 있다 — 파티장이 파티와 함께 오르기를 고르면 함께 오른다.</p>' : ''}`);
  overlay.querySelectorAll('[data-tw]').forEach((b) => (b.onclick = () => { overlay.hidden = true; paused = false; modal = null; enterTower(+b.dataset.tw); }));
  overlay.querySelectorAll('[data-twp]').forEach((b) => (b.onclick = () => { overlay.hidden = true; paused = false; modal = null; startCoTower(+b.dataset.twp); }));
}
function enterTower(f, carry = null, co = null) {
  if (world?.zone?.id === 'world') { returnTo = 'tower'; save.zoneMemory.world = world.exportMemory(); }
  const zid = towerZoneId(f), z = ZONES.find((x) => x.id === zid), seed = co?.seed ?? ((Math.random() * 1e9) >>> 0); // 파티 탑: 파티장이 정한 씨앗 → 모두 같은 층
  world = new World({ build: buildNow(), mode: 'field', zoneId: zid, seed, map: generateField(z, seed, Math.floor(f / 6), towerSize(f)), tower: { f }, coop: co ? { role: co.role } : null, story: save.story, codex: save.codex, ...shared() });
  if (co?.role === 'member') { world.enemies = []; world.camps = []; world.tower.boss = null; world.tower.bosses = []; } // 몬스터는 파티장이 알려 준다
  coRun = co ? { role: co.role, host: co.role === 'host' ? net.id : co.host, party: net.party?.id || 0, snapT: 0, flushT: 0, meT: 0, lastSnap: performance.now() } : null;
  world.codexStart = carry?.codexStart ?? codexPoints(save);
  if (carry) { world.loot = carry.loot; world.discovered = carry.discovered; world.player.hp = Math.min(carry.hp, world.d.maxHp); }
  world.goalNeeds = [];
  renderer.setWorld(world);
  renderer.banner = { text: `각인의 탑 ${f}층`, sub: isBossFloor(f) ? '층 수호자가 계단을 지킨다' : `기준 시간 ${mmss(parTime(f))} · 계단을 찾아라`, t: 3, color: isBossFloor(f) ? '#ff9a7a' : '#e8d8a8' };
  startMusic(zid); sfx('open'); startLoop();
}
function towerClear(s) {
  const T = (save.tower ||= { best: {}, max: 0 }), f = s.f, grade = towerGrade(s), first = !T.best[f], rw = towerReward(f, grade, first);
  T.best[f] = first ? grade : betterGrade(grade, T.best[f]); T.max = Math.max(T.max, f);
  save.gold += rw.gold;
  const extra = [];
  if (rw.stones && bagAdd(lifeOf(), 'spiritStone', rw.stones)) extra.push(`정령석 ×${rw.stones}`);
  if (rw.potion && bagAdd(lifeOf(), rw.potion, 1)) extra.push(GOODS[rw.potion].name);
  writeSave(save); cloudSaveNow(save); checkCcMissions();
  world.state = 'over';
  sfx(grade === 'S' ? 'levelup' : 'open', { vol: 0.7 });
  const top = f >= TOWER_TOP, coHost = coRun?.role === 'host', coMember = coRun?.role === 'member';
  if (coHost) { world.coRevive(1); netSend({ t: 'co', k: 'clear', f }); } // 동료도 각자 등급 · 보상을 받는다
  showModal(`<h2>${top ? '탑의 꼭대기에 닿았다' : `${f}층 클리어`}</h2>
    <div class="tw-grade" style="--c:${GRADE_COLOR[grade]}">${grade}</div>
    <p>걸린 시간 <b>${mmss(s.time)}</b> <span class="muted">(기준 ${mmss(parTime(f))})</span> · 받은 피해 <b>${Math.round((s.hurt / Math.max(1, s.maxHp)) * 100)}%</b> <span class="muted">(최대 체력 대비)</span></p>
    <p class="lvup">◆ ${rw.gold} 골드${first ? ' (처음 깬 층 ×2)' : ''}${extra.length ? ' · ' + extra.join(' · ') : ''}</p>
    <div class="actions">${top ? '' : coMember ? `<button id="twNextCo">${f + 1}층으로 오르자 (파티 모두)</button>` : `<button id="twNext">${f + 1}층으로 오른다${coHost ? ' (파티와 함께)' : ''}</button>`}<button id="twOut" class="ghost">탑에서 나간다</button></div>`, () => {});
  const carry = () => ({ loot: world.loot, discovered: world.discovered, hp: Math.max(world.player.hp, world.d.maxHp * 0.3), codexStart: world.codexStart });
  const nx = document.getElementById('twNext'); if (nx) nx.onclick = () => {
    overlay.hidden = true; paused = false; modal = null;
    if (coHost) { const seed = (Math.random() * 1e9) >>> 0; enterTower(f + 1, carry(), { role: 'host', seed }); netSend({ t: 'co', k: 'floor', f: f + 1, seed }); }
    else enterTower(f + 1, carry());
  };
  const nc = document.getElementById('twNextCo'); if (nc) nc.onclick = () => { netSend({ t: 'co', to: coRun?.host, k: 'next' }); nc.disabled = true; nc.textContent = '다 같이 오른다…'; }; // 동료도 다음 층을 고를 수 있다
  document.getElementById('twOut').onclick = () => { overlay.hidden = true; paused = false; modal = null; world.state = 'play'; endRun('clear'); };
}

// 숙련: 깨달은 순간 (전투 · 생활은 세계가, 요리 · 팔기는 창에서 알린다)
function onKnackLearned(id) {
  const k = KNACKS[id]; if (!k) return;
  if (k.kind === 'skill') learnSkill(k.skill, `문득 깨달았다 — ${k.hint}`);
  else { renderer.banner = { text: `생활 기술 「${k.name}」을 깨달았다`, sub: `${k.desc} · 따로 누르지 않아도 저절로`, t: 4.5, color: '#c8e8a0' }; sfx('levelup', { vol: 0.6 }); }
  SELL_BONUS.v = hasKnack(save.knack, 'haggler') ? 1.1 : 1;
  writeSave(save);
}
hub.onQuest = () => checkCcMissions();
hub.onKnack = (act, n = 1) => { for (const id of knackTick((save.knack ||= newKnack()), act, Math.random, n)) onKnackLearned(id); };
hub.onCodex = () => { const ups = syncLevel(save); if (ups && world) { world.setBuild(buildNow()); renderer.levelUp(world, save.level, ups * 3); } };

let world = null, paused = false, endTimer = 0, last = 0, acc = 0, modal = null;

function resetGame() { clearSave(); cloudDelete(); save = null; world = null; showRaceSelect(); }

function showRaceSelect() {
  gameEl.hidden = true; titleEl.hidden = false;
  renderRaceSelect(titleEl, (race) => { unlockAudio(); sfx('select'); showStyleSelect(race); }, () => playIntro(showRaceSelect));
  // 종족 카드 미리보기 애니메이션
  const cards = [...titleEl.querySelectorAll('canvas[data-race]')];
  let t = 0;
  const anim = () => {
    if (titleEl.hidden) return;
    t += 1 / 60;
    for (const c of cards) {
      const art = RACE_ART[c.dataset.race];
      const hover = c.closest('.race').matches(':hover');
      const fr = frames(art.base, hover ? 'run' : 'idle');
      const img = sprite(fr[Math.floor(t * (hover ? 10 : 6)) % fr.length], art.tint || '');
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, c.width, c.height);
      if (img) g.drawImage(img, (c.width - img.width * 4) / 2, c.height - img.height * 4, img.width * 4, img.height * 4);
    }
    requestAnimationFrame(anim);
  };
  anim();
}

// 플레이 스타일 선택: 시작 무기를 받는다 (나중에 언제든 바꿀 수 있음)
function showStyleSelect(race) {
  const R = RACES[race];
  titleEl.innerHTML = `<div class="race-select">
    <h1>${R.name}</h1>
    <p class="muted">클래스를 고르세요. 클래스마다 스킬 6개와 전용 무기가 있습니다. 광장의 공명 제단에서 언제든 바꿀 수 있어요.</p>
    <div class="styles">${RACE_CLASSES(race).map((id) => {
      const c = CLASSES[id];
      return `<button class="style" data-style="${id}">
        <b>${c.name}</b>
        <p>${c.desc}</p>
        <p class="sk-list">${c.skills.map((sid, i) => `<span${i === 5 ? ' class="ult"' : ''}>${SKILLS[sid].name}</span>`).join(' · ')}</p>
        <small>시작 무기: ${ITEMS[c.weapons[0]].name}</small>
      </button>`;
    }).join('')}</div>
    <button class="ghost" id="backRace">← 종족 다시 고르기</button></div>`;
  titleEl.querySelectorAll('[data-style]').forEach((b) => (b.onclick = () => {
    const c = CLASSES[b.dataset.style];
    sfx('levelup');
    save = newSave(race);
    save.cls = b.dataset.style; save.style = c.style;
    save.items = ['rustySword', c.weapons[0]];
    save.gear = { weapon: c.weapons[0] };
    save.tutorial = { step: 0 }; // 처음 시작하는 사람은 튜토리얼부터
    refreshQuests(save); writeSave(save); titleEl.hidden = true; enterWorld(null, true);
  }));
  document.getElementById('backRace').onclick = () => showRaceSelect();
}

// ───── 로그인 화면 (일반 웹 배포용) ─────
function showLogin(onDone) {
  gameEl.hidden = true; titleEl.hidden = false;
  titleEl.innerHTML = `<div class="login">
    <h1>아르케</h1>
    <p class="muted">계정으로 로그인하면 어느 기기에서든 이어서 할 수 있습니다.</p>
    <form id="loginForm" class="login-box" autocomplete="on">
      <label for="lgId">아이디</label>
      <input id="lgId" name="username" autocomplete="username" maxlength="16" placeholder="2~16자 한글·영문·숫자" required>
      <label for="lgPw">비밀번호</label>
      <input id="lgPw" name="password" type="password" autocomplete="current-password" minlength="4" placeholder="4자 이상" required>
      <p id="lgErr" class="err" role="alert"></p>
      <div class="row"><button type="submit" id="lgLogin">로그인</button><button type="button" id="lgReg" class="ghost">회원가입</button></div>
      <button type="button" id="lgGuest" class="link">로그인 없이 하기 (이 브라우저에만 저장)</button>
    </form></div>`;
  const $ = (id) => document.getElementById(id);
  const go = async (fn) => {
    const u = $('lgId').value, p = $('lgPw').value;
    if (!u || !p) { $('lgErr').textContent = '아이디와 비밀번호를 입력하세요.'; return; }
    $('lgErr').textContent = ''; $('lgLogin').disabled = $('lgReg').disabled = true;
    try {
      unlockAudio();
      const remote = await fn(u, p);
      sfx('levelup', { vol: 0.5 });
      onDone(remote);
    } catch (e) { $('lgErr').textContent = errorText(e); sfx('error', { vol: 0.5 }); }
    finally { $('lgLogin').disabled = $('lgReg').disabled = false; }
  };
  $('loginForm').onsubmit = (e) => { e.preventDefault(); go(login); };
  $('lgReg').onclick = () => go(register);
  $('lgGuest').onclick = () => { try { localStorage.setItem('et-guest', '1'); } catch { /* 무시 */ } onDone(null); };
  $('lgId').focus();
}

// 퀘스트 창 (J): 의뢰 게시판 · 성지 의뢰를 한눈에
function showQuestLog() {
  tutFlags.panel = true;
  const zoneName = (id) => ZONES.find((z) => z.id === id)?.name || '';
  const bar = (v, n) => `<span class="qbar"><i style="width:${Math.min(100, Math.round((v / Math.max(1, n)) * 100))}%"></i></span><small>${Math.min(v, n)} / ${n}</small>`;
  const board = (save.quests || []).map((q) => `<div class="qrow ${q.done ? 'done' : ''}"><b>${q.text}</b> <small class="muted">${zoneName(q.zone)}</small>
    <div class="qmeta">${bar(q.progress || 0, q.n)}<small>${q.done ? '<em class="up">완료 · 마을 의뢰 게시판에서 보상 받기</em>' : `보상 ◆ ${q.reward.gold}`}</small></div></div>`).join('') || '<p class="muted">받은 의뢰가 없다. 바람결 마을 의뢰 게시판에서 받을 수 있다.</p>';
  const sanct = Object.keys(SANCTUMS).map((race) => {
    const st = save.story?.sanct?.[race], cur = st?.cur; if (!cur) return '';
    const d = sanctQuestDef(race, cur.id); if (!d) return '';
    const have = d.kind === 'bring' ? (save.bag?.[d.item] || 0) : d.kind === 'find' ? (cur.found?.length || 0) : (cur.progress || 0);
    const what = d.kind === 'kill' ? `${d.n}마리 처치` : d.kind === 'bring' ? `${GOODS[d.item]?.name} ${d.n}개 가져가기` : `${FIND_NAME[d.look]} ${d.n}개 찾기 (작은 지도에 ◆)`;
    return `<div class="qrow ${have >= d.n ? 'done' : ''}"><b style="color:${SANCTUMS[race].color}">${d.title}</b> <small class="muted">${SANCTUMS[race].name}</small>
      <p class="muted">${d.text}</p><small>${what}</small><div class="qmeta">${bar(have, d.n)}${have >= d.n ? '<small><em class="up">다 했다 · 성지에 돌아가 알리기</em></small>' : ''}</div></div>`;
  }).join('') || '<p class="muted">받은 성지 의뢰가 없다. 종족 성지의 주민에게 말을 걸어 보자.</p>';
  showModal(`<h2>퀘스트</h2><div class="qlog"><h3>의뢰 게시판</h3>${board}<h3>성지 의뢰</h3>${sanct}</div><div class="actions"><button data-close>닫기 (J)</button></div>`);
}

// 소개 영상: 화면 전체를 덮고, 끝나거나 건너뛰면 then()
function playIntro(then) {
  const wrap = document.createElement('div'), cv = document.createElement('canvas');
  wrap.className = 'intro-wrap'; wrap.appendChild(cv); document.body.appendChild(wrap);
  try { localStorage.setItem('et-intro-seen', '1'); } catch { /* 무시 */ }
  createIntro(cv, { onDone: () => { wrap.remove(); then(); } }).start();
}
// 처음 온 사람은 소개 영상부터, 본 적이 있으면 바로 종족 고르기
function firstStart() {
  let seen = false; try { seen = !!localStorage.getItem('et-intro-seen'); } catch { /* 무시 */ }
  if (seen) showRaceSelect(); else playIntro(showRaceSelect);
}

// 로그인 직후: 서버 저장이 있으면 그것, 없으면 지금 브라우저의 진행을 계정으로 올린다
function afterLogin(remote) {
  if (remote) save = migrateSave(remote);
  else if (save && cloud.mode !== 'local') cloudSaveNow(save);
  if (save) { refreshQuests(save); writeSave(save); enterWorld(); } else firstStart();
}

// 예전 저장 데이터를 새 구조로 옮긴다 (인간·드워프 → 기사, 없어진 슬롯·무기 정리)
function migrateSave(sv) {
  if (!sv) return sv;
  registerCrafted(ITEMS, sv.crafted);
  registerAllDishes(sv.bag, sv.chest);
  if (RACE_MIGRATE[sv.race]) sv.race = RACE_MIGRATE[sv.race];
  if (!RACES[sv.race]) sv.race = 'knight';
  sv.knack ||= newKnack(); // 숙련 (같은 행동을 세어 두었다가 우연히 깨닫는다)
  sv.uid ||= Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, '0')).join(''); // 온라인: 길드가 나를 알아보는 번호
  SELL_BONUS.v = hasKnack(sv.knack, 'haggler') ? 1.1 : 1;
  if (sv.slots?.extra) delete sv.slots.extra;
  for (const [old, nw] of [['spiritBranch', 'spiritBow'], ['worldTreeStaff', 'worldTreeBow']]) { // 정령사는 이제 활을 쓴다
    if (sv.items?.includes(old)) sv.items = sv.items.map((id) => (id === old ? nw : id));
    if (sv.gear?.weapon === old) sv.gear.weapon = nw;
    if (sv.reinforce?.[old] != null) { sv.reinforce[nw] = sv.reinforce[old]; delete sv.reinforce[old]; }
  }
  sv.items = (sv.items || []).filter((id) => ITEMS[id]);
  if (!sv.items.includes('rustySword')) sv.items.push('rustySword');
  if (!sv.gear?.weapon || !ITEMS[sv.gear.weapon]) sv.gear = { ...(sv.gear || {}), weapon: 'rustySword' };
  for (const k of Object.keys(sv.gear)) if (sv.gear[k] && !ITEMS[sv.gear[k]]) delete sv.gear[k];
  if (!sv.cls || CLASSES[sv.cls]?.race !== sv.race) {
    sv.cls = RACE_CLASSES(sv.race)[0];
    const st = CLASSES[sv.cls].weapons[0];
    if (!sv.items.includes(st)) sv.items.push(st);
  }
  if (sv.skills) sv.skills = sv.skills.filter((id) => id === 'weapon' || SKILLS[id]);
  if (sv.cls === 'greatsword' && sv.skills) sv.skills = sv.skills.map((id) => (id === 'sweep' && !(sv.learned || []).includes('sweep') ? 'comboSlash' : id)); // 횡베기 → 연속베기
  sv.story ||= newStory(); sv.story.items ||= {}; sv.story.flags ||= {};
  sv.codex ||= {}; sv.codex.kills ||= {}; sv.codex.places ||= {}; sv.codex.journals ||= {}; sv.codex.lore ||= [];
  sv.sanctum ||= {}; sv.relics ||= {}; sv.relicSrc ||= {}; sv.shards ||= {}; sv.reinforce ||= {};
  for (const [k, v] of Object.entries(newLife())) sv[k] ||= v;
  sv.time ||= newClock(); sv.effects ||= []; sv.learned ||= []; sv.abilities ||= {}; sv.crafted ||= {}; sv.chest ||= {}; sv.bagCap ||= 30; sv.dishLog ||= {};
  syncLevel(sv);
  return sv;
}

const buildNow = () => computeBuild(toLoadout(save));
// 생활 데이터: 저장의 같은 객체를 세계에 넘긴다 (캐고 · 베고 · 낚고 · 키운 것이 곧바로 저장에 남는다)
const lifeOf = () => ({ get knack() { return (save.knack ||= newKnack()); }, bag: save.bag, tools: save.tools, nodes: save.nodes, chopped: save.chopped, farm: save.farm, fishLog: save.fishLog, artifacts: save.artifacts, farmOpts: save.farmOpts, chest: save.chest, get cap() { return save.bagCap || 30; }, get quickFood() { return save.quickFood; } });
// 세계마다 함께 넘기는 저장 객체: 생활 · 하루의 시간 · 오래가는 효과(음식 · 잠)
const shared = () => ({ life: lifeOf(), clock: save.time, persist: save.effects });

function enterPlaza(first) {
  { const el = document.getElementById('practicePanel'); if (el) el.hidden = true; }
  world = new World({ build: buildNow(), mode: 'plaza', seed: 1, map: plazaMap, clock: save.time, persist: save.effects });
  world.questReady = (save.quests || []).some((q) => q.done);
  if (save.story?.flags.pinoDone) world.objects.push({ kind: 'npc', id: 'pinoPlaza', art: 'pino', x: 16 * TILE + 8, y: 13 * TILE + 8, label: '지도 제작자 피노와 이야기', reusable: true });
  renderer.setWorld(world);
  startMusic('plaza');
  startLoop();
  if (first || !save.tutorial) showTutorial();
}

// 바깥 세계 (2D 오픈월드): 마을에서 시작해 어디로든 간다. at: 'cave' · 'tower'면 그 입구 앞에서
let returnTo = null, curInterior = null; // curInterior: 지금 들어가 있는 입구 { id, x, y }
let stash = null; // 집 안에 있는 동안 바깥 세계를 그대로 보관해 둔다 { world, door }
function enterWorld(at = null, first = false) {
  goOnline();
  { const el = document.getElementById('practicePanel'); if (el) el.hidden = true; }
  save.zoneMemory ||= {};
  world = new World({ build: buildNow(), mode: 'field', zoneId: 'world', seed: 77, memory: save.zoneMemory.world, story: save.story, codex: save.codex, ...shared() });
  world.codexStart = codexPoints(save);
  const door = at && typeof at === 'object' ? at : at === 'tower' ? world.objects.find((o) => o.kind === 'towerDoor') : null;
  if (door) { world.player.x = door.x; world.player.y = door.y + 24; world.reveal(true); }
  for (const o of world.objects) if (o.kind === 'relic' && save.relicSrc?.[o.rid]) o.opened = true; // 이미 주운 성물
  curInterior = null; stash = null;
  world.questReady = (save.quests || []).some((q) => q.done);
  returnTo = null;
  renderer.setWorld(world);
  startMusic('plaza');
  startLoop();
  if (first || !save.owTutorial) showWorldIntro();
  else if (!save.lifeIntro) showLifeIntro();
}
// 마을의 집: 문으로 들어가면 방 안 (바깥 세계는 그대로 멈춰 둔다)
function enterHouse(id, door) {
  stash = { world, door };
  world = new World({ build: buildNow(), mode: 'plaza', seed: 1, map: buildHouse(id), ...shared() });
  world.questReady = (save.quests || []).some((q) => q.done);
  renderer.setWorld(world);
  renderer.banner = { text: HOUSES[id].name, sub: `${HOUSES[id].owner}의 집 · 아래쪽 문으로 나간다`, t: 2.2, color: '#ffe8a8' };
  sfx('open', { vol: 0.5 });
  startLoop();
}
// 바닷속: 물 위의 그 자리에서 내려가고, 떠오르면 그 자리 물 위로 (바깥 세계는 그대로 두고 다녀온다)
let seaStash = null, seaChunks = null;
function enterSeabed(x, y) {
  const ow = world;
  save.zoneMemory ||= {};
  save.zoneMemory.world = ow.exportMemory();
  seaStash = { world: ow };
  world = new World({ build: buildNow(), mode: 'field', zone: SEABED_ZONE, zoneId: 'seabed', seed: 91, map: seabedMap(overworldBase()), memory: save.zoneMemory.seabed, story: save.story, codex: save.codex, ...shared() });
  world.player.x = x; world.player.y = y; world.player.hp = ow.player.hp; world.player.res = ow.player.res;
  world.loot = ow.loot; world.discovered = ow.discovered; world.codexStart = ow.codexStart;
  world.reveal(true);
  if (seaChunks) { world._chunks = seaChunks.c; world._decoBuckets = seaChunks.d; }
  renderer.setWorld(world);
  seaChunks = { c: world._chunks, d: world._decoBuckets };
  renderer.banner = { text: '바닷속', sub: world.player.buffs.waterBreath ? '수중 호흡: 숨이 줄지 않는다 · G로 떠오른다' : '숨이 다 떨어지기 전에 G로 떠오른다 · 거품 구멍에서 숨을 채운다', t: 3.4, color: '#7ad8ff' };
  startMusic('palace');
  sfx('drop', { vol: 0.7, rate: 0.6 });
  startLoop();
}
function exitSeabed(x, y, forced) {
  save.zoneMemory.seabed = world.exportMemory();
  const sea = world, ow = seaStash?.world;
  seaStash = null;
  if (!ow) { enterWorld({ x, y: y - 24 }); return; }
  world = ow;
  world.player.x = x; world.player.y = y; world.player.hp = sea.player.hp; world.player.res = sea.player.res; world.player.dashT = 0;
  world.signals.length = 0; world.events.length = 0;
  world.setBuild(buildNow()); world.applyPersist();
  renderer.setWorld(world);
  renderer.banner = forced ? { text: '숨이 차서 물 위로 올라왔다', sub: '거품 구멍 가까이에 있으면 숨이 다시 찬다', t: 3, color: '#9fd8ff' } : null;
  startMusic('plaza');
  sfx('drop', { vol: 0.6, rate: 1.3 });
  startLoop();
}
function exitHouse() {
  if (!stash) { enterWorld(); return; }
  const { world: ow, door } = stash;
  stash = null;
  world = ow;
  world.player.x = door.x; world.player.y = door.y + 6; world.player.dashT = 0;
  world.signals.length = 0; world.events.length = 0;
  world.setBuild(buildNow());
  world.applyPersist();
  world.questReady = (save.quests || []).some((q) => q.done);
  renderer.setWorld(world);
  renderer.banner = null;
  sfx('close', { vol: 0.5 });
  startLoop();
}
function showWorldIntro() {
  save.owTutorial = 1; writeSave(save);
  showModal(`<h2>바람결의 섬</h2>
    <div class="tut">
      <p>탑의 층을 오르내리는 대신, 이제 <b>하나로 이어진 넓은 땅</b>을 걸어 다닙니다.</p>
      <p><b>바람결 마을</b>에 각인사 · 대장장이 · 사서 · 교관 · 의뢰 게시판이 있어요. <b>마을 모닥불</b>에서 쉬면 모은 잔향과 골드가 저장됩니다.</p>
      <p>숲 · 늪 · 폐허 도시 · 묘지 · 설원 · 바위산 · 화산 · 황야 · 원시림… 어디로든 가 보세요. 동굴 · 구멍 · 던전 · 미궁, 그리고 바다 밑 <b>용궁</b>도 있어요.</p>
      <p>섬 곳곳에 <b>종족 성지</b>가 8곳 있어요. 그 땅에서 성물(조각 5개 = 성물 1개)을 모아 바치면 축복이 쌓여요. 어느 성지든 받을 수 있고, 내 종족의 성지는 1.5배예요. 한 곳에 집중할수록 강해집니다. <b>M</b>으로 지도를 볼 수 있어요.</p>
      <p><b>불</b> 스킬은 키 큰 풀을 태우고, <b>얼음</b> 스킬은 물을 얼려 길을 만듭니다. 호수 가운데 섬에는 어떻게 갈까요?</p>
      <p><b>마을의 집</b>에 들어가 각인사 · 대장장이 · 사서 · 교관 · 의뢰인 · 잡화점 주인을 만나요. 바위를 캐고, 나무를 베고, 반짝이는 흙을 파고, 물가에서 <b>낚시</b>하고, 마을 동쪽 <b>텃밭</b>에서 농사를 지을 수 있어요. 캔 것은 잡화점에서 팔고, 대장간에서 도구와 장비를 만들어요.</p>
      <p class="keys">WASD 이동 · 좌클릭 공격 · Q·E·R·F 스킬 · Space 대시 · G 상호작용(누르고 있으면 계속 캐기) · I 장비 · B 가방 · J 퀘스트 · X 씨앗 바꾸기 · C 캐릭터 · M 지도 · O 파티 · 길드 · Enter 채팅 · Esc 메뉴</p>
    </div>
    <button data-close>모험 시작</button>`);
  save.lifeIntro = 1;
}
// 생활 기능 안내 (이미 바깥 세계 안내를 본 저장에 한 번)
function showLifeIntro() {
  save.lifeIntro = 1; writeSave(save);
  showModal(`<h2>바람결 마을의 새 소식</h2>
    <div class="tut">
      <p><b>집에 들어갈 수 있어요.</b> 각인사 · 대장장이 · 사서 · 교관 · 의뢰인은 이제 자기 집 안에 있어요. 마을 왼쪽 아래에는 <b>잡화점</b>이 새로 생겼어요.</p>
      <p><b>캐고 · 베고 · 파기</b>: 바위와 광맥, 나무, 반짝이는 흙 앞에서 <b>G</b> (누르고 있으면 계속). 처음부터 낡은 도구 한 벌을 가지고 있어요.</p>
      <p><b>낚시</b>: 물가에서 물을 바라보고 G → 찌가 가라앉으면 G → <b>박자 게임</b>: 흘러오는 박이 원에 닿을 때 G · Space · 클릭. 물고기마다 박자가 달라요(51종). 박을 잘 맞출수록 큰 물고기가 잡혀요.</p>
      <p><b>농사</b>: 마을 동쪽 텃밭에서 괭이로 갈고 → 씨앗 심고 → 물 주기. 단계마다 물을 주면 자라요. X로 심을 씨앗을 바꿔요.</p>
      <p><b>거래 · 제작</b>: 잡화점에서 씨앗 · 미끼를 사고 캔 것을 팔아요 (시세가 1시간마다 바뀌어요). 대장간에서 도구를 바꾸고, 장비를 만들고, 무기를 강화해요.</p>
      <p><b>성지</b>는 이제 어느 종족이든 축복을 받을 수 있고(내 종족은 1.5배), 5단계까지 올라요. 단계가 높을수록 성물이 많이 들지만 훨씬 강해져요. <b>낡은 제단</b>의 축복에는 더 이상 대가가 없어요.</p>
      <p class="keys">I 장비 · B 가방 · J 퀘스트 · X 씨앗 바꾸기 · 새 물고기와 땅속 유물도 도감에 남아요</p>
    </div>
    <button data-close>좋아요</button>`);
}

const memKeyOf = (id) => (id === 'mossCave' ? 'cave' : id); // 이끼 동굴은 탑의 1층과 같은 곳 (기억을 함께 쓴다)
function interiorZone(id) {
  const def = ENTRANCES[id];
  const base = def.theme === 'labyrinth' ? LABY_ZONE : def.theme === 'palace' ? PALACE_ZONE : ZONES.find((z) => z.id === def.theme);
  return { base, zone: { ...base, name: def.name, key: id, relic: def.relic, elite: def.elite || base.elite, pool: def.pool || base.pool } };
}
function enterInterior(id, depth = 0, carry = null, co = null) { // co: 파티 던전 { role, seed, host }
  const def = ENTRANCES[id], { base, zone } = interiorZone(id);
  save.zoneSeeds ||= {}; save.zoneMemory ||= {};
  if (save.zoneSeeds[id] == null) { save.zoneSeeds[id] = ((save.seed >>> 0) + [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + Math.floor(Math.random() * 1e6)) >>> 0; writeSave(save); }
  const seed = co?.seed ?? (depth ? (save.zoneSeeds[id] + depth * 104729 + Math.floor(Math.random() * 1e6)) >>> 0 : save.zoneSeeds[id]);
  let map = null;                                                     // 이끼 동굴 1층은 직접 설계한 맵 (World가 만든다)
  if (!(id === 'mossCave' && !depth)) map = !depth && def.theme === 'labyrinth' ? buildLabyrinth(zone, seed) : !depth && def.theme === 'palace' ? buildPalace(zone, seed) : generateField(zone, seed, depth, def.size || null);
  world = new World({ build: buildNow(), mode: 'field', zone, zoneId: base.id, seed, depth, map, memory: depth || co ? null : save.zoneMemory[memKeyOf(id)], coop: co ? { role: co.role } : null, story: save.story, codex: save.codex, ...shared() });
  if (co?.role === 'member') { world.enemies = []; world.camps = []; } // 몬스터는 파티가 함께 본다 (상자 · 채집은 각자)
  coRun = co ? { role: co.role, host: co.role === 'host' ? net.id : co.host, party: net.party?.id || 0, key: `d${net.party?.id || 0}${id.slice(0, 10)}${depth}`, zone: id, depth, snapT: 0, flushT: 0, meT: 0, lastSnap: performance.now() } : null;
  world.mapKnown = id === 'mossCave' && !depth && !!save.story.flags.pinoMap;
  world.bossRelicTaken = !!(def.relic && save.relicSrc?.[`${def.relic}_boss`]);
  world.codexStart = carry?.codexStart ?? codexPoints(save);
  if (carry) {
    world.loot = carry.loot; world.discovered = carry.discovered;
    world.player.hp = Math.min(carry.hp, world.d.maxHp);
  }
  world.rootMemory = carry?.rootMemory;
  world.goalNeeds = [];
  renderer.setWorld(world);
  renderer.banner = { text: depth ? `${def.name} · 지하 ${depth + 1}층` : def.name, sub: def.relic && !depth ? `가장 깊은 곳의 우두머리가 ${josa(SANCTUMS[def.relic].relic, '을', '를')} 지니고 있다` : depth ? '더 강한 적, 더 많은 보상' : '시작 지점의 포탈로 언제든 밖에 나갈 수 있다', t: 3.4, color: '#ffe8a8' };
  startMusic(base.id);
  sfx('open');
  startLoop();
}

// 종족 성지: 수호자의 이야기 · 성물을 바쳐 축복을 쌓는다 (어느 종족이든, 내 종족의 성지는 1.5배)
// 성지 창: 축복(성물) · 의뢰 · 친밀도 · 수련. 수호자는 축복, 우두머리는 의뢰, 수련장 안내판은 수련 쪽으로 연다
const SANCT_TABS = [['bless', '축복'], ['quest', '의뢰'], ['aff', '친밀도'], ['train', '수련'], ['story', '이야기']];
const today = () => save.time?.day || 1;
const bagTake = (id, n) => { save.bag[id] = (save.bag[id] || 0) - n; if (save.bag[id] <= 0) delete save.bag[id]; };
function showSanctum(race, tab = 'bless') {
  const S = SANCTUMS[race], L = SANCT_LIFE[race], st = sanctState(save.story, race);
  const lv = affLevel(st.aff), q = st.cur, def = q && sanctQuestDef(race, q.id);
  const dot = (k) => (k === 'quest' && (q?.done || (!q && st.step < L.quests.length)) ? ' <b class="dot">!</b>' : '');
  // 다른 종족의 성지에서는 그 종족의 기술을 배울 수 있다 · 마탑에서는 주문서를 판다
  const tabs = [...SANCT_TABS, ...(save.race !== race ? [['learn', '기술 배우기']] : []), ...(race === 'wizard' ? [['scroll', '주문서']] : []), ...(race === 'elf' ? [['spirit', '정령 계약']] : []), ['shop', '종족 상점']];
  let html = `<h2>${S.name}</h2><p class="muted">${tab === 'bless' ? S.keeper : L.leader.name} · 친밀도 <b style="color:${S.color}">${AFF_NAME[lv]}</b>${save.race === race ? ` · <b style="color:${S.color}">내 종족의 성지</b>` : ''}</p>
    <div class="tabs sanct-tabs">${tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-st="${k}">${n}${dot(k)}</button>`).join('')}</div>`;
  if (tab === 'bless') html += blessHtml(race);
  else if (tab === 'quest') html += questHtml(race, st, q, def);
  else if (tab === 'aff') html += affHtml(race, st, lv);
  else if (tab === 'story') html += storyHtml(race);
  else if (tab === 'learn') html += sanctLearnHtml(race, lv);
  else if (tab === 'scroll') html += scrollShopHtml();
  else if (tab === 'spirit') html += spiritHtml();
  else if (tab === 'shop') html += raceShopHtml(race, lv);
  else html += trainHtml(race, st, lv);
  html += '<button data-close class="ghost">떠난다</button>';
  showModal(html);
  overlay.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => showSanctum(race, b.dataset.st)));
  const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
  // 축복
  on('offerRelic', () => offerRelic(race));
  // 의뢰
  on('sqAccept', () => { acceptSanctQuest(race, st.step < L.quests.length ? L.quests[st.step].id : 'daily'); showSanctum(race, 'quest'); });
  on('sqDaily', () => { acceptSanctQuest(race, 'daily'); showSanctum(race, 'quest'); });
  on('sqClaim', () => { claimSanctQuest(race); showSanctum(race, 'quest'); });
  on('sqDrop', () => { st.cur = null; world.syncQuestThings?.(); writeSave(save); showSanctum(race, 'quest'); });
  // 친밀도: 선물 · 오늘의 조각
  overlay.querySelectorAll('[data-gift]').forEach((b) => (b.onclick = () => { giveGift(race, b.dataset.gift); showSanctum(race, 'aff'); }));
  on('dailyShard', () => { st.shardDay = today(); gainShard(race); writeSave(save); renderer.banner = { text: `${L.leader.name}의 선물`, sub: `${S.relic} 조각 1개 (${save.shards?.[race] || 0} / ${SHARDS_PER_RELIC})`, t: 2.6, color: S.color }; showSanctum(race, 'aff'); });
  // 다른 종족 기술 배우기 · 주문서 사기
  overlay.querySelectorAll('[data-learnx]').forEach((b) => (b.onclick = () => { learnCross(race, b.dataset.learnx); showSanctum(race, 'learn'); }));
  overlay.querySelectorAll('[data-scroll]').forEach((b) => (b.onclick = () => { buyScroll(b.dataset.scroll, +b.dataset.n || 1); showSanctum(race, 'scroll'); }));
  // 정령 계약: 정령석 사기 · 계약 1회 / 10회 · 함께하는 정령 고르기
  overlay.querySelectorAll('[data-stone]').forEach((b) => (b.onclick = () => { buyStones(+b.dataset.stone); showSanctum(race, 'spirit'); }));
  overlay.querySelectorAll('[data-pull]').forEach((b) => (b.onclick = () => { pullSpirits(+b.dataset.pull); showSanctum(race, 'spirit'); }));
  overlay.querySelectorAll('[data-spmain]').forEach((b) => (b.onclick = () => { save.spirits.main = b.dataset.spmain; writeSave(save); world.setBuild(buildNow()); showSanctum(race, 'spirit'); }));
  // 종족 상점
  overlay.querySelectorAll('[data-rgood]').forEach((b) => (b.onclick = () => { buyRaceGood(race, b.dataset.rgood, +b.dataset.n || 1); showSanctum(race, 'shop'); }));
  overlay.querySelectorAll('[data-ritem]').forEach((b) => (b.onclick = () => { buyRaceItem(race, b.dataset.ritem, lv); showSanctum(race, 'shop'); }));
  overlay.querySelectorAll('[data-ccbuy]').forEach((b) => (b.onclick = () => { const c = CC_EXTRA[b.dataset.ccbuy]; if (c?.buy && save.gold >= c.buy && !(save.learned || []).includes(b.dataset.ccbuy)) { save.gold -= c.buy; sfx('coin', { vol: 0.6 }); learnSkill(b.dataset.ccbuy, '기술서를 읽었다'); } showSanctum(race, 'shop'); }));
  // 수련
  on('trainGo', () => { overlay.hidden = true; paused = false; modal = null; if (!world.startTraining?.(race)) renderer.banner = { text: '지금은 수련할 수 없다', t: 1.6, color: '#c8b8a0' }; });
}
// 종족 상점: 그 종족의 물건 + 그 종족 클래스의 무기 (다른 종족은 「친구」부터, 30% 비싸게)
const raceWeapons = (race) => Object.keys(ITEMS).filter((id) => ITEMS[id].cls && CLASSES[ITEMS[id].cls]?.race === race && ITEMS[id].price > 0);
const raceItemPrice = (race, id) => Math.round(ITEMS[id].price * (save.race === race ? 1 : 1.3));
function raceShopHtml(race, lv) {
  const S = SANCTUMS[race], own = save.race === race, canW = own || lv >= 2;
  const goods = (RACE_SHOP[race] || []).filter((id) => GOODS[id]).map((id) => {
    const g = GOODS[id], p = buyPrice(id), have = save.bag?.[id] || 0;
    return `<div class="skc"><div class="c-head"><b>${g.name}</b><span class="role">${have}개 있음</span></div><div class="c-sum">${esc(g.desc || '')}</div>
      <div class="c-act"><button class="sm" data-rgood="${id}" data-n="1" ${save.gold >= p ? '' : 'disabled'}>1개 ◆ ${p}</button><button class="sm" data-rgood="${id}" data-n="5" ${save.gold >= p * 5 ? '' : 'disabled'}>5개 ◆ ${p * 5}</button></div></div>`;
  }).join('');
  const weapons = raceWeapons(race).map((id) => {
    const it = ITEMS[id], p = raceItemPrice(race, id), has = save.items.includes(id);
    return `<div class="skc"><div class="c-head"><b>${it.name}</b><span class="role">${CLASSES[it.cls].name}</span></div><div class="c-sum">${esc(it.bdesc || '')}${it.cls !== save.cls ? ' <span class="muted">(그 클래스가 아니면 무기의 특별한 힘은 없다)</span>' : ''}</div>
      <div class="c-act">${has ? '<span class="muted">가지고 있다 · 장비 창(I)에서 바꾼다</span>' : `<button class="sm" data-ritem="${id}" ${canW && save.gold >= p ? '' : 'disabled'}>◆ ${p}</button>`}</div></div>`;
  }).join('');
  return `<div class="talk"><p>「${S.name}의 물건이오. 이 땅에서만 구할 수 있지.」</p>${own ? '' : `<p class="muted">무기는 친밀도 「${AFF_NAME[2]}」부터 살 수 있고, 다른 종족에게는 30% 비싸다.</p>`}</div>
    <h4>이 땅의 물건</h4><div class="skill-row">${goods}</div>
    <h4>${S.name}의 무기</h4><div class="skill-row">${weapons || '<p class="muted">없음</p>'}</div>
    <h4>CC 기술서 <small>누구나 · 어떤 무기로든 · 내 종족의 자원으로 쓴다</small></h4><div class="skill-row">${ccBooksHtml()}</div>`;
}
// CC 기술서: 돈으로 사는 것 · 미션으로 얻는 것
function ccBooksHtml() {
  return Object.entries(CC_EXTRA).map(([id, c]) => {
    const sk = SKILLS[id], has = (save.learned || []).includes(id), prog = c.mission ? ccMissionProgress(c) : null;
    const act = has ? '<span class="muted">배웠다 · 캐릭터 창(C)에서 넣는다</span>' : c.buy ? `<button class="sm" data-ccbuy="${id}" ${save.gold >= c.buy ? '' : 'disabled'}>◆ ${c.buy}</button>` : `<span class="muted">미션 · ${c.how} (${Math.min(prog, c.need)}/${c.need})</span>`;
    return `<div class="skc"><div class="c-head"><b>${sk.name}</b><span class="role">${c.buy ? '기술서' : '미션'}</span></div><div class="c-sum">${esc(sk.desc)} · 재사용 ${sk.cd}초</div><div class="c-act">${act}</div></div>`;
  }).join('');
}
const ccMissionProgress = (c) => c.mission === 'quests' ? save.questsDone || 0 : c.mission === 'tower' ? save.tower?.max || 0 : c.mission === 'duel' ? save.pvp?.win || 0 : 0;
function checkCcMissions() {
  if (!save) return;
  for (const [id, c] of Object.entries(CC_EXTRA)) if (c.mission && !(save.learned || []).includes(id) && ccMissionProgress(c) >= c.need) learnSkill(id, `미션 달성 — ${c.how}`);
}
function buyRaceGood(race, id, n) {
  if (!(RACE_SHOP[race] || []).includes(id)) return;
  const price = buyPrice(id) * n;
  if (save.gold < price) return;
  if (!bagAdd(lifeOf(), id, n)) { renderer.banner = { text: '가방이 가득 찼다', t: 1.6, color: '#ffb0a0' }; return; }
  save.gold -= price; writeSave(save); sfx('coin', { vol: 0.6 });
}
function buyRaceItem(race, id, lv) {
  const p = raceItemPrice(race, id);
  if (!raceWeapons(race).includes(id) || save.items.includes(id) || save.gold < p || (save.race !== race && lv < 2)) return;
  save.gold -= p; save.items.push(id); writeSave(save); sfx('coin', { vol: 0.6 });
  renderer.banner = { text: `${josa(ITEMS[id].name, '을', '를')} 샀다`, sub: '장비 창(I)에서 바꿔 든다', t: 2.4, color: SANCTUMS[race].color };
}
// 다른 종족의 기술: 스킬 종류에 맞는 능력치(마법 = 마력 · 활 · 던지기 = 민첩 · 나머지 = 근력) + 이 성지의 친밀도 「친구」 + 골드
function sanctLearnHtml(race, lv) {
  const S = SANCTUMS[race], b = buildNow(), resName = RACES[save.race].res.name;
  const groups = Object.entries(CLASSES).filter(([, c]) => c.race === race).map(([cid, c]) => {
    const cards = c.skills.filter(crossOk).map((id) => {
      const sk = SKILLS[id], r = crossReq(sk), have = b.stats[r.stat] || 0, known = (save.learned || []).includes(id);
      const okLv = (sk.unlock || 1) <= save.level, okStat = have >= r.need, okAff = lv >= r.aff, ok = okLv && okStat && okAff && save.gold >= r.gold;
      const fit = handFit(sk, b).fit, cost = sk.costAll ? `${resName} ${sk.costAll.min}+ 전부` : sk.cost ? `${resName} ${sk.cost}` : sk.gain ? `${resName} +${sk.gain}` : '';
      const cond = (good, text) => `<span class="${good ? '' : 'warn'}">${text}</span>`;
      return `<div class="skc ${known ? 'on' : ''}"><div class="c-head"><b>${sk.name}</b>${sk.ult ? ' <span class="warn">궁극</span>' : ''}<span class="role">${KIND_NAME[sk.kind || 'body']}</span></div>
        <div class="muted">재사용 ${sk.cd}초${cost ? ' · ' + cost : ''} · 지금 손에 든 것으로: <b class="${fit <= 0 ? 'warn' : ''}">${fitText(fit)}</b></div>
        <div class="c-sum">${esc(plainDesc(sk))}</div>
        <div class="muted">조건: ${cond(okStat, `${STAT_INFO[r.stat].name} ${have} / ${r.need}`)} · ${cond(okAff, `친밀도 「${AFF_NAME[r.aff]}」`)} · ${cond(okLv, `레벨 ${sk.unlock || 1}`)} · ${STAT_INFO[r.stat].name} ${r.full} 이상이면 온전한 힘 (아니면 85%)</div>
        <div class="c-act">${known ? '<span class="muted">배움 ✔ · 캐릭터 창(C)에서 Q·E·R·F에 넣는다</span>' : `<button class="sm" data-learnx="${id}" ${ok ? '' : 'disabled'}>배우기 ◆ ${r.gold}</button>`}</div></div>`;
    }).join('');
    return cards ? `<h4>${esc(c.name)} <small>${esc(c.desc)}</small></h4><div class="skill-row">${cards}</div>` : '';
  }).join('');
  return `<div class="talk"><p>${esc(RACES[race].name)}의 기술을 배운다. 배운 기술은 <b>내 종족의 자원(${resName})</b>으로 쓴다 — 쓰는 기술이면 ${josa(resName, '을', '를')} 쓰고, 모으는 기술이면 ${josa(resName, '이', '가')} 찬다.</p>
    <p class="muted">무기가 맞지 않으면 약해진다. 한손 무기라면 왼손 도구(마법 부적 · 손쇠뇌 · 작은 방패 · 투척 주머니)를 대장간에서 사서 들자.</p></div>${groups}`;
}
function learnCross(race, id) {
  const sk = SKILLS[id], r = crossReq(sk), b = buildNow(), st = sanctState(save.story, race);
  if (!crossOk(id) || (save.learned || []).includes(id) || (b.stats[r.stat] || 0) < r.need || affLevel(st.aff) < r.aff || (sk.unlock || 1) > save.level || save.gold < r.gold) return;
  save.gold -= r.gold; (save.learned ||= []).push(id);
  writeSave(save); world.setBuild(buildNow());
  renderer.banner = { text: `새 기술 「${sk.name}」`, sub: `${SANCTUMS[race].name}에서 배웠다 · 캐릭터 창(C)에서 Q·E·R·F에 넣는다`, t: 4, color: SANCTUMS[race].color };
  sfx('levelup', { vol: 0.7 });
}
// 마탑의 주문서: 물속 숨 · 귀환 · 이동 · 빛 · 바람 · 탐색 (1회용, 가방에서 읽는다)
function scrollShopHtml() {
  const cards = SCROLL_SHOP.map((id) => {
    const g = GOODS[id], price = buyPrice(id), have = save.bag?.[id] || 0;
    return `<div class="skc"><div class="c-head"><b>${g.name}</b><span class="role">${have}장 있음</span></div><div class="c-sum">${esc(g.desc)}</div>
      <div class="c-act"><button class="sm" data-scroll="${id}" data-n="1" ${save.gold >= price ? '' : 'disabled'}>1장 ◆ ${price}</button><button class="sm" data-scroll="${id}" data-n="5" ${save.gold >= price * 5 ? '' : 'disabled'}>5장 ◆ ${price * 5}</button></div></div>`;
  }).join('');
  return `<div class="talk"><p>「마법사가 아니어도 좋네. 종이에 담긴 별빛은 읽는 자를 가리지 않으니.」</p>
    <p class="muted">주문서는 한 번 읽으면 사라진다. 가방(B)에서 「읽기」를 누른다.</p></div><div class="skill-row">${cards}</div>`;
}
function buyScroll(id, n) {
  const price = buyPrice(id) * n;
  if (!GOODS[id] || save.gold < price) return;
  if (!bagAdd(lifeOf(), id, n)) { renderer.banner = { text: '가방이 가득 찼다', t: 1.6, color: '#ffb0a0' }; return; }
  save.gold -= price; writeSave(save);
  sfx('coin', { vol: 0.6 });
}
// 정령 계약 (뽑기): 정령석 하나 = 계약 한 번. 등급 일반 55% · 희귀 30% · 영웅 12% · 전설 3%. 10회는 희귀 이상 하나를 보장
let lastPull = null;
function spiritCard(id, owned, main, badge = '') {
  const s = SPIRITS[id], G = SPIRIT_GRADES[s.grade], o = owned?.[id];
  return `<div class="spc ${o ? '' : 'off'} ${main === id ? 'main' : ''}" style="--c:${G.color}">
    <img src="${spiritIconURL(id)}" alt="">${badge ? `<i class="sp-badge">${badge}</i>` : ''}
    <b>${o ? esc(s.name) : '???'}</b><small style="color:${G.color}">${G.name} · ${SPIRIT_ELEMS[s.elem].name}${o ? ` · ${'★'.repeat(o.star)}${'☆'.repeat(SPIRIT_STAR_MAX - o.star)}` : ''}</small>
    ${o ? (() => { const lv = spiritLevel(o.xp), nx = SPIRIT_LV_XP[lv], pv = SPIRIT_LV_XP[lv - 1]; return `<small>Lv ${lv}${nx ? ` <span class="qbar"><i style="width:${Math.round(((o.xp || 0) - pv) / (nx - pv) * 100)}%"></i></span>` : ' (최고)'}</small>`; })() : ''}
    ${o ? `<small>${esc(spiritBuffText(id, o.star, spiritLevel(o.xp)))}</small>${main === id ? '<em>함께하는 정령</em>' : `<button class="sm" data-spmain="${id}">함께하기</button>`}` : ''}</div>`;
}
function spiritHtml() {
  const sv = save.spirits || { owned: {}, main: null }, stones = save.bag?.spiritStone || 0, got = Object.keys(sv.owned || {}).length;
  const res = lastPull ? `<h4>계약 결과</h4><div class="sp-grid">${lastPull.map((r) => spiritCard(r.id, sv.owned, sv.main, r.r === 'new' ? 'NEW' : r.r === 'star' ? '결속 ★+1' : '정령석 +1')).join('')}</div>` : '';
  const all = Object.keys(SPIRITS).sort((a, b) => SPIRITS[b].grade - SPIRITS[a].grade);
  return `<div class="talk"><p>「정령은 부른다고 오지 않아. 마음이 맞는 정령이 스스로 손을 내밀지.」</p>
    <p class="muted">정령석 하나를 바치면 정령 하나와 계약한다. 같은 정령과 또 계약하면 결속(★)이 올라 힘이 15%씩 세진다 (최대 ★${SPIRIT_STAR_MAX}). 싸울 때는 「정령 부르기」 스킬로 함께하는 정령을 꺼낸다 — 정령사가 아니어도 이 성지의 「기술 배우기」에서 배울 수 있다.</p>
    <p class="muted">${save.cls === 'spiritcaller' ? '<b class="up">정령사: 정령석이 싸고 좋은 정령이 더 잘 온다 · 함께 싸우면 정령 레벨이 1.5배 빨리 오른다</b><br>' : ''}확률: ${SPIRIT_GRADES.map((G, i) => `<b style="color:${G.color}">${G.name} ${Math.round((save.cls === 'spiritcaller' ? CALLER_RATES[i] : G.rate) * 100)}%</b>`).join(' · ')} · 10회 계약은 희귀 이상 하나 보장 · 정령석은 몬스터가 가끔 떨어뜨린다 (이끼 숲 · 원시림 · 이끼 동굴에서 더 자주, 우두머리는 꼭)</p></div>
    <div class="sp-bar"><span>정령석 <b>${stones}</b>개 · ◆ ${save.gold}</span>
      <button class="sm" data-stone="1" ${save.gold >= stonePrice() ? '' : 'disabled'}>정령석 1개 ◆ ${stonePrice()}</button><button class="sm" data-stone="10" ${save.gold >= stonePrice() * 10 ? '' : 'disabled'}>10개 ◆ ${stonePrice() * 10}</button>
      <button data-pull="1" ${stones >= 1 ? '' : 'disabled'}>계약 1회</button><button data-pull="10" ${stones >= 10 ? '' : 'disabled'}>계약 10회</button></div>
    ${res}
    <h4>내 정령 <small>${got} / ${all.length}</small></h4><div class="sp-grid">${all.map((id) => spiritCard(id, sv.owned, sv.main)).join('')}</div>`;
}
const stonePrice = () => (save.cls === 'spiritcaller' ? STONE_PRICE_CALLER : STONE_PRICE); // 정령사는 정령석이 싸다
function buyStones(n) {
  const price = stonePrice() * n;
  if (save.gold < price) return;
  if (!bagAdd(lifeOf(), 'spiritStone', n)) { renderer.banner = { text: '가방이 가득 찼다', t: 1.6, color: '#ffb0a0' }; return; }
  save.gold -= price; writeSave(save); sfx('coin', { vol: 0.6 });
}
function pullSpirits(n) {
  if ((save.bag?.spiritStone || 0) < n) return;
  save.bag.spiritStone -= n; if (save.bag.spiritStone <= 0) delete save.bag.spiritStone;
  const res = [];
  for (let i = 0; i < n; i++) {
    const guarantee = n >= 10 && i === n - 1 && !res.some((r) => SPIRITS[r.id].grade >= 1);
    const id = rollSpirit(Math.random, guarantee ? 1 : 0, save.cls === 'spiritcaller' ? CALLER_RATES : null); // 정령사는 좋은 정령이 조금 더 잘 온다
    res.push({ id, r: addSpirit(save, id) });
  }
  save.spirits.pulls = (save.spirits.pulls || 0) + n;
  lastPull = res.sort((a, b) => SPIRITS[b.id].grade - SPIRITS[a.id].grade);
  writeSave(save); cloudSaveNow(save); world.setBuild(buildNow());
  const top = SPIRITS[lastPull[0].id];
  if (top.grade >= 2) renderer.banner = { text: `${SPIRIT_GRADES[top.grade].name}의 정령!`, sub: `${top.name}과(와) 계약했다`, t: 3, color: SPIRIT_GRADES[top.grade].color };
  sfx(top.grade >= 2 ? 'levelup' : 'echo', { vol: 0.6, rate: top.grade >= 3 ? 0.8 : 1.2 });
}
// 이야기: 이 종족의 사연과 다른 종족과의 사이 (원한 · 동맹)
function storyHtml(race) {
  const RS = RACE_STORY[race];
  if (!RS) return '';
  const rel = Object.keys(SANCTUMS).filter((r) => r !== race).map((r) => ({ r, ...relation(race, r) })).sort((a, b) => b.v - a.v);
  const al = allies(race);
  return `<div class="talk">${RS.history.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <h4>다른 종족과의 사이</h4>
    <div class="rel-list">${rel.map(({ r, v, why }) => `<div class="rel"><b style="color:${SANCTUMS[r].color}">${RACES[r]?.name || r}</b> <span class="rel-tag" style="--c:${REL_COLOR[v]}">${REL_NAME[v]}</span><small>${esc(why)}</small></div>`).join('')}</div>
    ${al.length ? `<p class="muted">이곳의 의뢰를 끝내면 동맹인 ${al.map((r) => SANCTUMS[r].name).join(' · ')}에도 소문이 퍼져 친밀도가 +${ALLY_AFF} 오른다.</p>` : ''}`;
}
function blessHtml(race) {
  const S = SANCTUMS[race], own = save.race === race;
  const tier = save.sanctum?.[race] || 0, have = save.relics?.[race] || 0, shards = save.shards?.[race] || 0;
  const cost = TIER_COST[tier], max = tier >= SANCTUM_MAX;
  const pips = Array.from({ length: SANCTUM_MAX }, (_, i) => `<i class="${i < tier ? 'on' : ''}${i + 1 === PERK_TIER || i + 1 === TREASURE_TIER ? ' star' : ''}" style="--c:${S.color}">${i + 1}</i>`).join('');
  let html = `<div class="talk"><p>${esc(S.lore[0])}</p><p>${esc(S.lore[1])}</p></div>
    <div class="sanct-pips">${pips}</div>
    <div class="sanct-info">
      <p>지금 받은 축복: <b>${tier ? sanctumBonusText(race, tier, own) : '없음'}</b>${own ? ' (내 종족: 1.5배)' : ''}</p>
      ${max ? '<p class="lvup">이 성지의 모든 힘을 받았다.</p>' : `<p>${tier + 1}단계: <b>${sanctumBonusText(race, tier + 1, own)}</b> · 성물 <b>${cost}</b>개</p>`}
      <p>${PERK_TIER}단계 은총: <b>${S.perk.text}</b>${tier >= PERK_TIER ? ' ✔' : ''}<br>${TREASURE_TIER}단계 보물: <b>${ITEMS[S.treasure].name}</b>${tier >= TREASURE_TIER ? ' ✔' : ''}</p>
      <p>가진 ${S.relic} <b>${have}</b>개 · 조각 <b>${shards}</b> / ${SHARDS_PER_RELIC}</p>
    </div>
    <p class="muted">${S.relic} 조각은 <b>${S.place}</b>의 몬스터와 <b>${S.dungeon}</b>에서만 나온다. 단계가 오를수록 성물이 더 들지만 축복은 훨씬 크게 오른다 — 여러 성지를 조금씩보다 한 곳을 끝까지 파는 쪽이 강하다.</p>`;
  if (!max) html += `<button id="offerRelic" ${have >= cost ? '' : 'disabled'}>${josa(S.relic, '을', '를')} ${cost}개 바친다 → ${tier + 1}단계</button>`;
  return html;
}
function offerRelic(race) {
  const S = SANCTUMS[race], own = save.race === race, tier = save.sanctum?.[race] || 0, cost = TIER_COST[tier];
  if ((save.relics[race] || 0) < cost) return;
  save.relics[race] -= cost; save.sanctum[race] = tier + 1;
  const nt = tier + 1;
  let sub = `${sanctumBonusText(race, nt, own)}`;
  if (nt === PERK_TIER) sub += ` · 은총: ${S.perk.text}`;
  if (nt === TREASURE_TIER && !save.items.includes(S.treasure)) { save.items.push(S.treasure); sub += ` · 보물 「${ITEMS[S.treasure].name}」을 받았다 (대장간에서 장착)`; }
  addAff(race, 10);
  writeSave(save); cloudSaveNow(save);
  world.setBuild(buildNow());
  overlay.hidden = true; paused = false; modal = null;
  renderer.banner = { text: `${S.name}의 축복 · ${nt}단계`, sub, t: 4.5, color: S.color };
  world.emit({ t: 'buff', x: world.player.x, y: world.player.y, color: S.color });
  sfx('levelup');
}
// 의뢰: 이야기 의뢰 셋을 차례로, 다 하면 매일 의뢰
function questHtml(race, st, q, def) {
  const S = SANCTUMS[race], L = SANCT_LIFE[race];
  // 우두머리의 말: 사이가 나쁜 종족이면 처음엔 차갑게, 아니면 날마다 다른 말 (다른 종족을 두고 하는 말도 섞인다)
  const RS = RACE_STORY[race], alv = affLevel(st.aff), cold = RS?.cold?.[save.race];
  const pool = [...L.leader.lines.slice(0, alv + 1), ...(RS?.rival || [])];
  const say = `<div class="talk"><p>「${esc(cold && alv < 2 ? cold : pool[(today() + (st.step || 0)) % pool.length])}」</p></div>`;
  const prog = (d, q2) => d.kind === 'bring' ? `${GOODS[d.item]?.name || d.item} ${Math.min(d.n, save.bag[d.item] || 0)} / ${d.n} (가방)` : d.kind === 'find' ? `${FIND_NAME[d.look]} ${q2.progress || 0} / ${d.n}` : `${q2.progress || 0} / ${d.n}`;
  const rew = (d) => [`골드 ${d.reward.gold}`, `친밀도 +${d.reward.aff}`, ...Object.entries(d.reward.goods || {}).map(([id, n]) => `${GOODS[id]?.name || id} ${n}개`)].join(' · ');
  if (q && def) {
    const ready = q.done || (def.kind === 'bring' && (save.bag[def.item] || 0) >= def.n);
    return `${say}<div class="sq ${ready ? 'ready' : ''}" style="--c:${S.color}"><b>${esc(def.title)}</b><p>${esc(def.text)}</p><p class="muted">진행: <b>${prog(def, q)}</b> · 보상: ${rew(def)}</p>
      ${def.kind === 'find' ? `<p class="muted">${S.place} 곳곳에 빛나는 ${josa(FIND_NAME[def.look], '이', '가')} 있다. 작은 지도(오른쪽 위)에 ◆로 보인다.</p>` : ''}</div>
      ${ready ? `<button id="sqClaim">${def.kind === 'bring' ? '건네고 보고하기' : '보고하기'}</button>` : '<button id="sqDrop" class="ghost">의뢰 그만두기</button>'}`;
  }
  if (st.step < L.quests.length) {
    const d = L.quests[st.step];
    return `${say}<div class="sq" style="--c:${S.color}"><b>${st.step + 1}. ${esc(d.title)}</b><p>${esc(d.text)}</p><p class="muted">보상: ${rew(d)}</p></div><button id="sqAccept">맡는다</button>`;
  }
  const d = L.daily, doneToday = st.dailyDay === today();
  return `${say}<p class="lvup">${S.name}의 이야기 의뢰를 모두 마쳤다.</p>
    <div class="sq" style="--c:${S.color}"><b>매일 의뢰 · ${esc(d.title)}</b><p>${esc(d.text)}</p><p class="muted">보상: ${rew(d)}</p></div>
    ${doneToday ? '<p class="muted">오늘의 의뢰는 끝냈다. 내일(잠을 자고 나면) 다시 온다.</p>' : '<button id="sqDaily">오늘의 의뢰를 맡는다</button>'}`;
}
function acceptSanctQuest(race, id) {
  const st = sanctState(save.story, race), d = sanctQuestDef(race, id);
  if (!d || st.cur) return;
  st.cur = { id, progress: 0 };
  if (d.kind === 'find') {
    st.cur.spots = world.pickQuestSpots?.(race, d.n) || [];
    st.cur.found = [];
    world.syncQuestThings?.();
  }
  writeSave(save);
  renderer.banner = { text: `의뢰: ${d.title}`, sub: d.kind === 'kill' ? `${d.n}마리 · 잡을 때마다 센다` : d.kind === 'bring' ? `${GOODS[d.item]?.name} ${d.n}개를 가져온다` : `${FIND_NAME[d.look]} ${d.n}개를 찾는다 · 작은 지도에 ◆`, t: 2.8, color: SANCTUMS[race].color };
  sfx('open', { vol: 0.5 });
}
function claimSanctQuest(race) {
  const st = sanctState(save.story, race), q = st.cur, d = q && sanctQuestDef(race, q.id);
  if (!d) return;
  if (d.kind === 'bring') { if ((save.bag[d.item] || 0) < d.n) return; bagTake(d.item, d.n); }
  else if (!q.done) return;
  save.gold += d.reward.gold;
  for (const [id, n] of Object.entries(d.reward.goods || {})) save.bag[id] = (save.bag[id] || 0) + n;
  if (q.id === 'daily') st.dailyDay = today(); else st.step++;
  st.cur = null;
  world.syncQuestThings?.();
  addAff(race, d.reward.aff);
  const al = allies(race); // 동맹 성지에도 소문이 퍼진다
  for (const r of al) addAff(r, ALLY_AFF);
  writeSave(save); cloudSaveNow(save);
  save.questsDone = (save.questsDone || 0) + 1; checkCcMissions(); // CC 기술 미션
  renderer.banner = { text: `의뢰 완료 · ${d.title}`, sub: `골드 +${d.reward.gold} · 친밀도 +${d.reward.aff}${al.length ? ` · 소문이 퍼졌다: ${al.map((r) => SANCTUMS[r].name).join(' · ')} +${ALLY_AFF}` : ''}${Object.keys(d.reward.goods || {}).length ? ' · ' + Object.entries(d.reward.goods).map(([id, n]) => `${GOODS[id]?.name} ${n}`).join(' · ') : ''}`, t: 3.4, color: SANCTUMS[race].color };
  sfx('levelup', { vol: 0.6 });
}
// 친밀도: 오를 때마다 단계 보상
function addAff(race, n) {
  const st = sanctState(save.story, race), S = SANCTUMS[race], L = SANCT_LIFE[race];
  const before = affLevel(st.aff);
  st.aff = (st.aff || 0) + n;
  const after = affLevel(st.aff);
  for (let l = before + 1; l <= after; l++) {
    let sub = AFF_REWARD[l];
    if (l === 1 && !st.welcome) { st.welcome = true; save.gold += 150; for (const id of L.likes.slice(0, 2)) save.bag[id] = (save.bag[id] || 0) + 2; }
    if (l === 4 && !st.token) { st.token = true; if (!save.items.includes(L.token)) save.items.push(L.token); sub = `종족의 증표 「${ITEMS[L.token].name}」 (대장간에서 장착)`; }
    renderer.banner = { text: `${S.name} · ${AFF_NAME[l]}`, sub, t: 4, color: S.color };
    sfx('levelup', { vol: 0.7 });
  }
}
function affHtml(race, st, lv) {
  const S = SANCTUMS[race], L = SANCT_LIFE[race];
  const next = AFF_LV[lv + 1], pct = next ? Math.round(((st.aff - AFF_LV[lv]) / (next - AFF_LV[lv])) * 100) : 100;
  const giftsLeft = st.giftDay === today() ? GIFTS_PER_DAY - st.gifts : GIFTS_PER_DAY;
  const gifts = L.likes.map((id) => `<button class="sm" data-gift="${id}" ${(save.bag[id] || 0) > 0 && giftsLeft > 0 ? '' : 'disabled'}>${GOODS[id]?.name || id} <small>${save.bag[id] || 0}개</small></button>`).join('');
  return `<div class="aff"><div class="aff-bar" style="--c:${S.color}"><i style="width:${pct}%"></i></div>
      <p><b style="color:${S.color}">${AFF_NAME[lv]}</b> · ${st.aff}${next ? ` / ${next} (다음: ${AFF_NAME[lv + 1]})` : ' (가장 높은 단계)'}</p></div>
    <ul class="c-eff" style="text-align:left">${AFF_REWARD.slice(1).map((r, i) => `<li class="${lv >= i + 1 ? 'got' : ''}">${AFF_NAME[i + 1]}: ${i + 1 === 4 ? `종족의 증표 「${ITEMS[L.token].name}」` : r}${lv >= i + 1 ? ' ✔' : ''}</li>`).join('')}</ul>
    <p class="muted">친밀도는 의뢰(+15~20) · 매일 의뢰(+8) · 수련(+${TRAIN_AFF}, 하루 ${TRAINS_PER_DAY}번까지) · 성물 바치기(+10) · 선물(+${GIFT_AFF})로 오른다.</p>
    <h4>좋아하는 것을 선물한다 <small>오늘 ${Math.max(0, giftsLeft)}번 남음</small></h4><div class="gift-row">${gifts}</div>
    ${lv >= 3 ? (st.shardDay === today() ? '<p class="muted">오늘의 성물 조각은 받았다.</p>' : `<button id="dailyShard">${L.leader.name}에게 오늘의 성물 조각 받기</button>`) : ''}`;
}
function giveGift(race, id) {
  const st = sanctState(save.story, race), S = SANCTUMS[race];
  if (st.giftDay !== today()) { st.giftDay = today(); st.gifts = 0; }
  if (st.gifts >= GIFTS_PER_DAY || !(save.bag[id] > 0)) return;
  bagTake(id, 1); st.gifts++;
  addAff(race, GIFT_AFF);
  writeSave(save);
  if (!renderer.banner || renderer.banner.t < 1) renderer.banner = { text: `${josa(GOODS[id]?.name || '', '을', '를')} 선물했다`, sub: `${josa(SANCT_LIFE[race].leader.name, '이', '가')} 기뻐한다 · 친밀도 +${GIFT_AFF}`, t: 2.2, color: S.color };
  sfx('open', { vol: 0.5, rate: 1.3 });
}
// 수련: 종족마다 방식이 다른 도전. 이기면 그 종족의 능력치가 한 단계 오르고, 다음 단계는 더 빡빡해진다
const trainGold = (rank) => 20 + rank * 10;
function trainHtml(race, st, lv) {
  const S = SANCTUMS[race], own = save.race === race, cap = trainCap(lv, own), rank = st.train || 0, T = trainSpec(race, rank, own);
  const stat = Object.keys(S.unit).map((k) => ({ str: '근력', mag: '마력', agi: '민첩', vit: '체력', sen: '감각', spi: '정신', pres: '물리 저항', mres: '마법 저항' }[k])).join(' · ');
  const left = st.trainDay === today() ? TRAINS_PER_DAY - st.trainToday : TRAINS_PER_DAY;
  const capNote = [lv < 2 ? '친밀도 「친구」가 되면 +5' : '', own ? `같은 종족이라 +${OWN_TRAIN_CAP}` : ''].filter(Boolean).join(' · ');
  return `<div class="sq" style="--c:${S.color}"><b>${T.name} · ${rank + 1}단계 도전</b><p>${esc(T.desc)}</p>
      ${own ? `<p class="lvup">같은 종족: ${OWN_TRAIN_EASE}단계 쉬운 난이도로 치르고, 한도가 ${OWN_TRAIN_CAP}단계 높다.</p>` : ''}
      <p>수련 단계 <b>${rank}</b> / ${cap}${capNote ? ` (${capNote})` : ''} · 단계마다 <b>${stat} +1</b> · 단계가 오를수록 어려워진다</p>
      <p class="muted">이기면: 수련 단계 +1${rank >= cap ? ' (한도에 닿았다)' : ''} · 골드 +${trainGold(rank)} · 친밀도 +${TRAIN_AFF} (오늘 ${Math.max(0, left)}번 남음)</p></div>
    <button id="trainGo">수련장으로 가서 시작</button>`;
}
function finishTraining(s) {
  const race = s.race, st = sanctState(save.story, race), S = SANCTUMS[race], L = SANCT_LIFE[race];
  if (!s.ok) { renderer.banner = { text: '수련 실패', sub: `${s.why || ''} · ${L.train.kind === 'damage' ? `${s.dealt} / ${s.need}` : L.train.kind === 'keep' ? `타오른 화로 ${s.got} / ${s.n}` : `${s.got} / ${s.n}`} · 안내판에서 다시 도전할 수 있다`, t: 3, color: '#c8b8a0' }; return; }
  const cap = trainCap(affLevel(st.aff), save.race === race), gold = trainGold(st.train || 0);
  if (st.trainDay !== today()) { st.trainDay = today(); st.trainToday = 0; }
  const rankUp = (st.train || 0) < cap;
  if (rankUp) st.train = (st.train || 0) + 1;
  save.gold += gold;
  const affOk = st.trainToday < TRAINS_PER_DAY;
  st.trainToday++;
  if (affOk) addAff(race, TRAIN_AFF);
  writeSave(save);
  world.setBuild(buildNow());
  const stat = Object.keys(S.unit).map((k) => ({ str: '근력', mag: '마력', agi: '민첩', vit: '체력', sen: '감각', spi: '정신', pres: '물리 저항', mres: '마법 저항' }[k])).join(' · ');
  renderer.banner = { text: `수련 성공 · ${L.train.name}`, sub: `${rankUp ? `수련 ${st.train}단계 · ${stat} +1 · 다음 단계는 더 어렵다` : '수련 한도에 닿았다'} · 골드 +${gold}${affOk ? ` · 친밀도 +${TRAIN_AFF}` : ''}`, t: 3.6, color: S.color };
  sfx('levelup');
}
// 성물 조각: 5개가 모이면 성물 하나가 된다
function gainShard(race) {
  save.shards ||= {}; save.relics ||= {};
  save.shards[race] = (save.shards[race] || 0) + 1;
  const S = SANCTUMS[race];
  if (save.shards[race] >= SHARDS_PER_RELIC) {
    save.shards[race] -= SHARDS_PER_RELIC; save.relics[race] = (save.relics[race] || 0) + 1;
    renderer.banner = { text: `조각이 모여 ${S.relic}이 되었다`, sub: `${S.place}의 ${S.name}에 바치면 축복을 받는다 (가진 ${S.relic} ${save.relics[race]}개)`, t: 3.6, color: S.color };
    sfx('levelup', { vol: 0.6 });
  }
  writeSave(save);
}
const josa = (word, a, b) => { const c = word.charCodeAt(word.length - 1) - 0xac00; return word + (c >= 0 && c < 11172 && c % 28 ? a : b); };
function gainRelic(race, rid) {
  save.relicSrc ||= {}; save.relics ||= {};
  if (save.relicSrc[rid]) return;
  save.relicSrc[rid] = true; save.relics[race] = (save.relics[race] || 0) + 1;
  writeSave(save);
  const S = SANCTUMS[race];
  renderer.banner = { text: `${josa(S.relic, '을', '를')} 얻었다`, sub: `${S.place}의 ${S.name}에 바치면 축복을 받는다${save.race === race ? ' (내 종족의 성지: 1.5배)' : ''}`, t: 4, color: S.color };
  sfx('levelup', { vol: 0.7 });
}

// 쉬기: 지금까지 모은 것을 저장한다 (바깥 세계에는 '귀환'이 없다)
function bankWorld(ow) {
  const res = applyRun(save, ow.loot, 1, ow.discovered);
  save.zoneMemory.world = ow.exportMemory();
  save.codex.lore = [...new Set([...(save.codex.lore || []), ...ow.loot.lores])];
  progressQuests(save, { zone: 'world', kills: ow.loot.kills, kept: res.kept, chests: ow.loot.chests, explored: ow.exploredPct() });
  ow.loot = { echoes: {}, gold: 0, xp: 0, kills: {}, chests: 0, lores: [], banked: null };
  ow.questReady = (save.quests || []).some((q) => q.done);
  return res;
}
function restAndSave() {
  const res = bankWorld(world);
  writeSave(save); cloudSaveNow(save);
  renderer.banner = { text: '모닥불 곁에서 쉬었다', sub: `체력 회복 · 잔향 ${Object.values(res.kept).reduce((a, b) => a + b, 0)}개와 골드 ${res.gold}를 저장했다`, t: 3.2, color: '#ffd88a' };
  sfx('levelup', { vol: 0.5 });
}
// 잠: 침대에서 저녁 5시 ~ 새벽 5시. 아침 6시에 일어나고, 물 준 작물이 한 단계 자라고, '개운함'이 붙는다
// 이동 포탈: 깨운 포탈 목록에서 골라 건너간다
function showWaypoints(here) {
  const all = world.objects.filter((o) => o.kind === 'waypoint'), open = all.filter((o) => o.active), shut = all.length - open.length;
  showModal(`<h2>이동 포탈</h2><p class="muted">깨운 포탈 ${open.length} / ${all.length}${shut ? ` · 아직 잠든 포탈 ${shut}곳이 섬 곳곳에 있다` : ''}</p>
    <div class="wp-list">${open.map((o) => `<button class="wp ${o.id === here ? 'here' : ''}" data-wp="${o.id}" ${o.id === here ? 'disabled' : ''}>${esc(o.name)}${o.id === here ? '<small>지금 여기</small>' : ''}</button>`).join('')}</div>
    <button data-close class="ghost">닫기</button>`);
  overlay.querySelectorAll('[data-wp]').forEach((b) => (b.onclick = () => { overlay.hidden = true; paused = false; modal = null; travelTo(b.dataset.wp); }));
}
// 귀환 · 이동 주문서: 실제로 옮겨 간 뒤에 한 장 쓴다
function useScroll(kind, id) {
  const spend = () => { if (--save.bag[id] <= 0) delete save.bag[id]; writeSave(save); };
  const outdoor = world.zone?.id === 'world', p = world.player;
  if (p.boat || p.swim) { renderer.banner = { text: '물 위에서는 읽을 수 없다', t: 1.8, color: '#c8b8a0' }; return; }
  if (kind === 'return') {
    if (world.mode === 'plaza') { renderer.banner = { text: '이미 마을이다', t: 1.6, color: '#c8b8a0' }; return; }
    spend();
    if (outdoor) { if (world.teleportTo('wp_village')) renderer.banner = { text: '바람결 마을', sub: '귀환 주문서를 읽었다', t: 2, color: '#ffe8a8' }; return; }
    endRun('clear'); // 던전 · 궁전: 얻은 것을 모두 지키고 밖으로
    return;
  }
  if (kind === 'teleport') {
    if (!outdoor) { renderer.banner = { text: '바깥 세계에서만 읽을 수 있다', t: 1.8, color: '#c8b8a0' }; return; }
    const open = world.objects.filter((o) => o.kind === 'waypoint' && o.active);
    showModal(`<h2>이동 주문서</h2><p class="muted">깨운 포탈 가운데 한 곳으로 바로 간다 (주문서 한 장)</p>
      <div class="wp-list">${open.map((o) => `<button class="wp" data-wp="${o.id}">${esc(o.name)}</button>`).join('')}</div><button data-close class="ghost">읽지 않는다</button>`);
    overlay.querySelectorAll('[data-wp]').forEach((b) => (b.onclick = () => { overlay.hidden = true; paused = false; modal = null; if (world.teleportTo(b.dataset.wp)) { spend(); const o = world.objects.find((q) => q.id === b.dataset.wp); renderer.banner = { text: o?.name || '', sub: '이동 주문서를 읽었다', t: 1.8, color: '#bfefff' }; } }));
  }
}
function travelTo(id) {
  if (!world.teleportTo(id)) return;
  const o = world.objects.find((q) => q.id === id);
  renderer.banner = { text: o?.name || '', sub: '포탈을 건너왔다', t: 1.8, color: '#bfefff' };
}

function showSleep() {
  if (!canSleep(save.time.min)) { renderer.banner = { text: '아직 잠이 오지 않는다', sub: `지금 ${clockText(save.time)} · 저녁 5시부터 잘 수 있다`, t: 2.2, color: '#c8d0ff' }; return; }
  showModal(`<h2>잠자리에 들까?</h2><p>아침 6시에 일어난다.</p><ul class="c-eff"><li>체력 모두 회복</li><li>물을 준 작물이 한 단계 자란다</li><li>아침 6시 ~ 저녁 6시: <b>개운함</b> (이동 속도 +8% · 받는 피해 -5%)</li><li>지금까지 모은 것을 저장한다</li></ul>
    <button id="doSleep">잔다</button><button data-close class="ghost">아직</button>`);
  document.getElementById('doSleep').onclick = () => { overlay.hidden = true; paused = false; modal = null; doSleep(); };
}
function doSleep() {
  sleepUntilMorning(save.time);
  for (const pl of Object.values(save.farm || {})) if (pl.crop && pl.wateredAt && CROPS[pl.crop]) { pl.wateredAt = Date.now() - CROPS[pl.crop].stageSec * 1000 - 1; growPlot(pl); }
  const now = absMin(save.time), eff = save.effects;
  for (let i = eff.length - 1; i >= 0; i--) if (eff[i].until <= now || eff[i].id === 'rested') eff.splice(i, 1);
  eff.push({ id: 'rested', name: '개운함', mods: { moveSpeed: 1.08, dmgTakenMul: 0.95 }, color: '#ffe8a8', until: now + 12 * 60, dur: 12 * 60, src: 'sleep' });
  world.player.hp = world.d.maxHp;
  world.applyPersist();
  if (stash?.world) { stash.world.player.hp = stash.world.d.maxHp; bankWorld(stash.world); }
  writeSave(save); cloudSaveNow(save);
  renderer.fade = 2.6;
  renderer.banner = { text: `${save.time.day}일째 아침`, sub: '푹 잤다 · 체력 회복 · 개운함 (저녁 6시까지 이동 +8% · 받는 피해 -5%)', t: 4, color: '#ffe8a8' };
  sfx('levelup', { vol: 0.4 });
}
// 빠른 칸 음식 (H)
function eatQuick() {
  const id = save.quickFood;
  if (!id || !(save.bag[id] > 0)) { renderer.banner = { text: '빠른 칸에 음식이 없다', sub: '가방(B)에서 요리 옆의 H를 눌러 빠른 칸에 둔다', t: 2, color: '#c8b8a0' }; return; }
  world.eat(id);
}
// 옛 기술 석판 · 물의 정령 · 자라: 기술 배우기
function learnSkill(id, from) {
  if ((save.learned ||= []).includes(id)) return false;
  save.learned.push(id); writeSave(save);
  world.setBuild(buildNow());
  renderer.banner = { text: `새 기술 「${SKILLS[id].name}」`, sub: `${from} · 캐릭터 창(C)에서 Q·E·R·F에 넣는다`, t: 4.5, color: '#9fe3ff' };
  sfx('levelup', { vol: 0.7 });
  return true;
}

function enterZone(id, depth = 0, carry = null) {
  const z = ZONES.find((x) => x.id === id);
  save.zoneSeeds ||= {}; save.zoneMemory ||= {};
  if (save.zoneSeeds[id] == null) { save.zoneSeeds[id] = ((save.seed >>> 0) + z.floor * 7919 + Math.floor(Math.random() * 1e6)) >>> 0; writeSave(save); }
  // 지하층은 매번 새로 생성 (기억은 1층만)
  const seed = depth ? (save.zoneSeeds[id] + depth * 104729 + Math.floor(Math.random() * 1e6)) >>> 0 : save.zoneSeeds[id];
  world = new World({ build: buildNow(), mode: 'field', zoneId: id, seed, depth, memory: depth ? null : save.zoneMemory[id], story: save.story, codex: save.codex, ...shared() });
  world.mapKnown = id === 'cave' && !depth && !!save.story.flags.pinoMap;
  world.codexStart = carry?.codexStart ?? codexPoints(save);
  if (carry) {
    world.loot = carry.loot; world.discovered = carry.discovered;
    world.player.hp = Math.min(carry.hp, world.d.maxHp);
  }
  world.rootMemory = carry?.rootMemory;
  // 찜한 각인에 아직 모자란 잔향 (필드 화면에 표시)
  const need = {};
  for (const gid of save.goals || []) { const e = ENGRAVINGS[gid]; if (e) for (const [eid, n] of Object.entries(e.recipe)) need[eid] = (need[eid] || 0) + n; }
  world.goalNeeds = Object.entries(need).map(([id, n]) => ({ id, need: n, have: save.echoes[id] || 0 })).filter((g) => g.have < g.need);
  renderer.setWorld(world);
  if (depth) renderer.banner = { text: `${z.name} · 지하 ${depth + 1}층`, sub: '더 강한 적, 더 많은 보상. 계단은 가장 깊은 곳에 있다.', t: 3.2, color: '#ff9a7a' };
  startMusic(id);
  sfx('open');
  startLoop();
}

// ───── 연습 모드: 모든 클래스의 모든 스킬을 자원·체력 걱정 없이 써 본다 (저장 안 됨) ─────
const practice = { cls: null, skills: null, infRes: true, noCd: false, arena: 'weak', refill: true };
function practiceBuild() {
  const c = CLASSES[practice.cls];
  const sp = save.spirits?.main ? { id: save.spirits.main, star: save.spirits.owned[save.spirits.main]?.star || 1 } : { id: 'fire2', star: 1 }; // 연습장: 계약한 정령이 없으면 화염 여우를 빌려 준다
  return computeBuild({ race: c.race, cls: practice.cls, level: 20, allSkills: true, alloc: { str: 18, mag: 18, agi: 10, vit: 10 }, engravings: {}, gear: { weapon: c.weapons[1] }, skills: practice.skills, spirit: sp });
}
function enterPractice() {
  practice.cls ||= save.cls; practice.skills ||= CLASSES[practice.cls].skills.slice(0, 4);
  world = new World({ build: practiceBuild(), mode: 'field', zone: ARENA_ZONE, zoneId: 'arena', seed: 4242, map: buildArena(), practice });
  world.explored.fill(1);
  spawnArena(practice.arena);
  renderer.setWorld(world);
  renderer.banner = { text: '연습 실험장', sub: '왼쪽 위에서 클래스 · 스킬 · 상대를 고르세요. 죽지 않고, 기록도 남지 않아요.', t: 3.5, color: '#7ad8ff' };
  startMusic('cave');
  showPracticePanel();
  startLoop();
}
// 실험 상대 부르기: 고른 묶음을 내 둘레에 세운다 (먼저 있던 적은 치운다)
function spawnArena(kind) { spawnArenaSet(world, kind); practice.arena = ARENA_SETS[kind] ? kind : 'weak'; }
function refreshPractice() {
  world.setBuild(practiceBuild());
  const p = world.player;
  p.cds = {}; p.buffs = {}; p.res = 100; world.allies = []; p.channel = null; p.castT = 0; p.castSkill = null;
  showPracticePanel();
}
function showPracticePanel() {
  let el = document.getElementById('practicePanel');
  if (!el) { el = document.createElement('div'); el.id = 'practicePanel'; gameEl.appendChild(el); }
  el.hidden = false;
  const c = CLASSES[practice.cls];
  const races = [...new Set(Object.values(CLASSES).map((x) => x.race))];
  el.innerHTML = `<details open><summary>연습 모드 · ${c.name}</summary>
    <select data-pr="cls">${races.map((r) => `<optgroup label="${RACES[r].name}">${RACE_CLASSES(r).map((id) => `<option value="${id}" ${id === practice.cls ? 'selected' : ''}>${CLASSES[id].name}</option>`).join('')}</optgroup>`).join('')}</select>
    ${[0, 1, 2, 3].map((i) => `<label>${'QERF'[i]} <select data-pr="s${i}">${c.skills.map((sid) => `<option value="${sid}" ${practice.skills[i] === sid ? 'selected' : ''}>${SKILLS[sid].name}</option>`).join('')}</select></label>`).join('')}
    <label class="wide">상대 <select data-pr="arena">${Object.entries(ARENA_SETS).map(([k, v]) => `<option value="${k}" ${practice.arena === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
    <p class="muted" id="arenaNote">${ARENA_SETS[practice.arena]?.note || ''}</p>
    <p class="dps" id="practiceDps">최근 5초 피해 0 · 초당 0</p>
    <label class="ck"><input type="checkbox" data-pr="refill" ${practice.refill ? 'checked' : ''}> 다 잡으면 다시 부르기</label>
    <label class="ck"><input type="checkbox" data-pr="infRes" ${practice.infRes ? 'checked' : ''}> 자원 무한</label>
    <label class="ck"><input type="checkbox" data-pr="noCd" ${practice.noCd ? 'checked' : ''}> 재사용 대기 없음</label>
    <label class="ck"><input type="checkbox" data-pr="auto" ${getAutoAim() ? 'checked' : ''}> 자동 조준 (T)</label>
    <button class="sm" data-pr="respawn">적 다시 부르기</button>
    <button class="sm ghost" data-pr="exit">연습 끝내기</button></details>`;
  el.onchange = (e) => {
    const k = e.target.dataset.pr;
    if (k === 'cls') { practice.cls = e.target.value; practice.skills = CLASSES[practice.cls].skills.slice(0, 4); }
    else if (k?.[0] === 's') practice.skills[+k[1]] = e.target.value;
    else if (k === 'infRes' || k === 'noCd') practice[k] = e.target.checked;
    else if (k === 'auto') setAutoAim(e.target.checked);
    else if (k === 'refill') { practice.refill = e.target.checked; e.target.blur(); return; }
    else if (k === 'arena') { spawnArena(e.target.value); e.target.blur(); showPracticePanel(); renderer.banner = { text: ARENA_SETS[e.target.value].name, sub: ARENA_SETS[e.target.value].note, t: 2, color: '#7ad8ff' }; return; }
    e.target.blur();
    refreshPractice();
  };
  el.onclick = (e) => {
    const k = e.target.dataset.pr;
    if (k === 'respawn') { spawnArena(practice.arena); renderer.banner = { text: '상대를 다시 불렀다', t: 1.2, color: '#ffcf5a' }; }
    if (k === 'exit') exitPractice();
  };
}
function exitPractice() {
  const el = document.getElementById('practicePanel');
  if (el) el.hidden = true;
  enterWorld();
}

function startLoop() {
  paused = false; endTimer = 0; acc = 0; modal = null;
  titleEl.hidden = true; gameEl.hidden = false; overlay.hidden = true; panelEl.hidden = true;
  requestAnimationFrame(fitCanvas);
}

function showTutorial() {
  save.tutorial = 1; writeSave(save);
  showModal(`<h2>아르케에 온 것을 환영한다</h2>
    <div class="tut">
      <p><b>1.</b> 북쪽 <b>관문</b>으로 들어가 필드를 탐험하고, 몬스터가 남기는 <b>잔향</b>을 모으세요.</p>
      <p><b>2.</b> 어떤 몬스터가 어떤 잔향을 주는지는 지역마다 다릅니다. 원하는 각인이 있으면 그 몬스터를 찾아가세요.</p>
      <p><b>3.</b> 광장의 <b>공명 제단</b>(왼쪽 위)에서 잔향으로 각인을 새기고, <b>수련 교관</b>(오른쪽 아래)에게 스탯을 배분하세요.</p>
      <p><b>4.</b> 강한 각인보다 <b>맞물리는 조합</b>이 이깁니다. 스탯 하나를 높이 올리면 각성이 열려요.</p>
      <p><b>5.</b> 뭘 할지 모르겠다면 가운데 <b>의뢰 게시판</b>을 확인하세요.</p>
      <p><b>★</b> 종족마다 스킬 6개 중 <b>4개</b>를 공명 제단에서 골라 Q·E·R·F로 씁니다. 스킬마다 쓰는 자원이 다르니 계산하며 쓰세요. <b>준비 → 강화 → 마무리</b> 순서로 이으면 강해져요.</p>
      <p><b>6.</b> 필드에는 <b>야영지</b>(잔향 맡기기), <b>떠돌이 상인</b>, <b>낡은 제단</b>(대가 없는 축복), 가장 깊은 곳의 <b>아래층 계단</b>이 있어요.</p>
      <p class="keys">WASD 이동 · 마우스 조준 · 좌클릭 공격 · Q·E·R·F(1·2·3·4) 스킬 · T 자동 조준 · 우클릭 무기 기술 · Space 대시(무적) · G 상호작용 · C 캐릭터 · Esc 메뉴</p>
      ${touch ? '<p class="keys">모바일: 왼쪽 조이스틱 이동 · 오른쪽 조이스틱을 누르면 공격(밀면 그 방향 조준, 그냥 누르면 가까운 적 자동 조준) · 버튼으로 스킬·대시·상호작용</p>' : ''}
      <p class="muted">빨갛게 번쩍이는 적은 곧 공격합니다. 대시로 피하세요!</p>
    </div>
    <button data-close>시작하기</button>`);
}

// ───── 패널 (마을 시설) ─────
// 그 시설(집)에서 열면 그 시설의 탭까지, 키로 열면 캐릭터 · 가방 · 도감만
const ALWAYS_TABS = ['char', 'gear', 'bag', 'codex'];
const STATION_TABS = { altar: ['altar'], shop: ['shop', 'forge', 'craft'], forge: ['forge', 'shop', 'craft'], codex: ['codex', 'learn'], char: ['char', 'learn'], quest: ['quest'], trade: ['trade'], hunt: ['hunt'], cook: ['cook', 'storage'], storage: ['storage', 'cook'], craft: ['craft', 'storage'] };
function openPanel(tab, fromStation = false) {
  touch?.reset();
  tutFlags.panel = true;
  hub.station = fromStation ? tab : null;
  hub.allowed = fromStation ? [...new Set([...(STATION_TABS[tab] || [tab]), ...ALWAYS_TABS])] : ALWAYS_TABS;
  hub.tab = tab; hub.render();
  panelEl.hidden = false; paused = true;
  input.attack = false;
  sfx('open', { vol: 0.5 });
}
function closePanel() {
  if (panelEl.hidden) return;
  panelEl.hidden = true; paused = false;
  sfx('close', { vol: 0.5 });
  if (world) { world.setBuild(buildNow()); world.questReady = (save.quests || []).some((q) => q.done); }
}

function showModal(html, onClose) {
  touch?.reset();
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.hidden = false; paused = true;
  modal = onClose || (() => { overlay.hidden = true; paused = false; modal = null; sfx('close', { vol: 0.4 }); });
  overlay.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => modal?.()));
}

function endRun(kind) {
  if (world.practice) { exitPractice(); return; }
  if (coRun) { netSend(coRun.role === 'host' ? { t: 'co', k: 'end' } : { t: 'co', to: coRun.host, k: 'bye' }); coRun = null; } // 파티 탑에서 나간다
  if (world.pvp) { netSend({ t: 'dend', reason: 'left' }); duelOver(false, 'left'); return; } // 결투 중 나가기
  const keep = kind === 'clear' ? 1 : kind === 'retreat' ? 0.7 : 0.5;
  // 야영지에 맡긴 몫은 그대로, 나머지만 비율대로 잃는다
  const loot = { ...world.loot, echoes: { ...world.loot.echoes } };
  const bank = world.loot.banked;
  if (keep < 1) {
    for (const id of Object.keys(loot.echoes)) {
      const safe = Math.min(bank?.echoes[id] || 0, loot.echoes[id]);
      loot.echoes[id] = safe + Math.floor((loot.echoes[id] - safe) * keep);
    }
    const sg = Math.min(bank?.gold || 0, loot.gold);
    loot.gold = sg + Math.floor((loot.gold - sg) * keep);
  }
  const res = applyRun(save, loot, 1, world.discovered);
  const memKey = world.zone.key ? memKeyOf(world.zone.key) : world.zone.id;
  if (!world.tower) (save.zoneMemory ||= {})[memKey] = world.depth ? world.rootMemory || save.zoneMemory[memKey] : world.exportMemory(); // 탑의 층은 기억하지 않는다
  save.codex.lore = [...new Set([...(save.codex.lore || []), ...world.loot.lores])];
  progressQuests(save, { zone: world.zone.id, kills: world.loot.kills, kept: res.kept, chests: world.loot.chests, explored: world.exploredPct() });
  refreshQuests(save);
  writeSave(save);
  cloudSaveNow(save);
  const done = (save.quests || []).filter((q) => q.done).length;
  const title = { clear: '무사히 귀환했다', retreat: '긴급 귀환', dead: '쓰러졌다…' }[kind];
  const echoes = Object.entries(res.kept).map(([id, n]) => `<span class="echo" style="--c:${ECHOES[id].color}">◆ ${ECHOES[id].name} ×${n}</span>`).join('') || '<span class="muted">얻은 잔향 없음</span>';
  world.state = 'over';
  sfx(kind === 'dead' ? 'error' : 'levelup', { vol: 0.6 });
  showModal(`
    <h2>${title}</h2>
    <p class="muted">${kind === 'clear' ? '잔향을 모두 가져왔다.' : kind === 'retreat' ? '잔향의 70%만 지켰다.' : '잔향의 절반을 잃었다.'}${bank && kind !== 'clear' ? ' (야영지에 맡긴 몫은 지켰다)' : ''}${world.depth ? ` · 도달: 지하 ${world.depth + 1}층` : ''}</p>
    <div class="echoes">${echoes}</div>
    <p>골드 +${res.gold} · 도감 +${Math.max(0, codexPoints(save) - (world.codexStart ?? codexPoints(save)))}점 · 상자 ${world.loot.chests}개 · 탐험 ${Math.round(world.exploredPct() * 100)}%</p>
    ${res.ups ? `<p class="lvup">레벨 업! Lv ${save.level} · 스탯 포인트 +${res.ups * 3} (수련 교관에게 가세요)</p>` : ''}
    ${world.discovered.size ? '<p class="lvup">새로 발견한 원소 반응이 서고에 기록되었습니다.</p>' : ''}
    ${done ? `<p class="lvup">완료한 의뢰 ${done}개! 게시판에서 보상을 받으세요.</p>` : ''}
    <button data-close>${world.zone.id === 'world' ? '마을에서 다시 일어난다' : '밖으로 나간다'}</button>`, () => { overlay.hidden = true; const back = world.zone.id === 'world' || kind === 'dead' ? null : curInterior ? { x: curInterior.x, y: curInterior.y } : returnTo || 'tower'; enterWorld(back); });
}

function volumeHtml() {
  const v = getVolume();
  return `<div class="vol"><label>효과음 <input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-vol="sfx"></label>
    <label>배경음 <input type="range" min="0" max="1" step="0.05" value="${v.music}" data-vol="music"></label></div>`;
}
function bindVolume() {
  overlay.querySelectorAll('[data-vol]').forEach((r) => (r.oninput = () => setVolume(r.dataset.vol, +r.value)));
}

function showPause() {
  const field = world.mode === 'field';
  showModal(`<h2>일시정지</h2>
    <button data-close>계속하기</button>
    ${net.up && !world.practice ? '<button id="socialBtn" class="ghost">동료 (파티 · 길드) · O</button>' : ''}
    ${world.practice ? '<button id="exitPractice" class="ghost">연습 끝내기</button>' : ''}<label class="ck"><input type="checkbox" id="autoAimCk" ${getAutoAim() ? 'checked' : ''}> 자동 조준 (T)</label>
    ${world.pvp ? '<button id="retreat" class="ghost">결투 포기 (패배로 기록)</button><p class="muted">결투에서는 잃는 것이 없다. 포기하면 상대의 승리가 된다.</p>' : field && !world.practice ? '<button id="retreat" class="ghost">긴급 귀환 (잔향 70% 보존)</button><p class="muted">시작 지점의 귀환 포탈로 돌아가면 잔향을 전부 지킬 수 있습니다. 야영지에 맡긴 잔향은 죽어도 잃지 않아요.</p>' : '<button id="howto" class="ghost">조작법 보기</button>'}
    ${volumeHtml()}
    ${isClaudePage() ? '' : cloud.mode === 'account' ? `<p class="muted">${esc(cloud.name)} 계정으로 로그인 중</p><button id="logoutBtn" class="ghost">로그아웃</button>` : '<button id="loginBtn" class="ghost">로그인 / 회원가입</button>'}`);
  bindVolume();
  const lo = document.getElementById('logoutBtn'), li = document.getElementById('loginBtn');
  if (lo) lo.onclick = async () => { await logout(); clearSave(); save = null; world = null; overlay.hidden = true; paused = false; modal = null; showLogin(afterLogin); };
  if (li) li.onclick = () => { overlay.hidden = true; paused = false; modal = null; world = null; showLogin(afterLogin); };
  document.getElementById('autoAimCk').onchange = (e) => setAutoAim(e.target.checked);
  const sb = document.getElementById('socialBtn'); if (sb) sb.onclick = () => showSocial();
  if (world.practice) document.getElementById('exitPractice').onclick = () => { overlay.hidden = true; paused = false; modal = null; exitPractice(); };
  else if (field) document.getElementById('retreat').onclick = () => { overlay.hidden = true; endRun('retreat'); };
  else document.getElementById('howto').onclick = () => showTutorial();
}

function escAction() {
  if (!world || gameEl.hidden) return;
  if (!panelEl.hidden) return closePanel();
  if (modal) return modal();
  if (world.state === 'play') showPause();
}

// ───── 입력 ─────
const keys = new Set();
const input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dash: false, interact: false, skill: false, s1: false, s2: false, s3: false, s4: false, wskill: false };
let mouseCX = innerWidth / 2, mouseCY = innerHeight / 2;
addEventListener('keydown', (e) => {
  unlockAudio();
  if (!world || gameEl.hidden) return;
  if (e.code === 'Escape') { e.preventDefault(); return escAction(); }
  if (!panelEl.hidden && (e.code === 'KeyG' || e.code === 'KeyC' || e.code === 'KeyI' || e.code === 'KeyB' || e.code === 'KeyK')) return closePanel();
  if (modal && (e.code === 'KeyG' || e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ')) { e.preventDefault(); return modal(); }
  if (paused) return;
  keys.add(e.code);
  if (e.code === 'Space') { input.dash = true; e.preventDefault(); }
  if (e.code === 'KeyG' && (world.near || world.act)) tutFlags.interact = true;
  if (e.code === 'KeyG' && world.nearRemote && !world.near && !world.act) openMeet(world.nearRemote);
  if (e.code === 'KeyO' && !world.practice) showSocial();
  if (e.code === 'Enter' && net.up && !world.pvp) { e.preventDefault(); openChat(); }
  if (e.code === 'KeyG') input.interact = true;
  if (e.code === 'KeyQ' || e.code === 'Digit1') input.s1 = true;
  if (e.code === 'KeyE' || e.code === 'Digit2') input.s2 = true;
  if (e.code === 'KeyR' || e.code === 'Digit3') input.s3 = true;
  if (e.code === 'KeyF' || e.code === 'Digit4') input.s4 = true;
  if (e.code === 'KeyT') { setAutoAim(!getAutoAim()); renderer.banner = { text: getAutoAim() ? '자동 조준 켜짐' : '자동 조준 꺼짐', t: 1.2, color: '#7ad8ff' }; if (world.practice) showPracticePanel(); }
  if (e.code === 'KeyC' && (world.mode === 'plaza' || world.state === 'play') && !world.practice) openPanel('char'); // 던전 안에서도 스킬 · 스탯을 바꿀 수 있다 (재사용 대기는 스킬마다 그대로)
  if (e.code === 'KeyB' && world.state === 'play') openPanel('bag');
  if ((e.code === 'KeyI' || e.code === 'KeyK') && world.state === 'play') openPanel('gear'); // 장비: 대장간에 가지 않아도 바로 바꾼다
  if (e.code === 'KeyX' && world.life && world.farmRect) { const sd = cycleSeed(world); renderer.banner = { text: sd ? `${GOODS[sd].name} (${save.bag[sd]}개)` : '씨앗이 없다', sub: sd ? '이 씨앗을 심는다 · X로 바꾸기' : '잡화점에서 씨앗을 산다', t: 1.6, color: '#c8e8a0' }; }
  if (e.code === 'KeyM' && world.map?.outdoor) renderer.bigMap = !renderer.bigMap;
  if (e.code === 'KeyJ' && world.state === 'play' && !world.practice) showQuestLog();
  if (e.code === 'KeyH' && world.state === 'play') eatQuick();
  if (e.code === 'KeyZ' && world.state === 'play') world.quickPotion(); // 물약 빨리 마시기
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); input.attack = false; });
canvas.addEventListener('mousemove', (e) => { mouseCX = e.clientX; mouseCY = e.clientY; });
canvas.addEventListener('mousedown', (e) => { unlockAudio(); if (touch) return; if (e.button === 0 && !paused) input.attack = true; if (e.button === 2 && !paused) input.wskill = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) input.attack = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointerdown', () => unlockAudio(), { once: true });

let touch = null;
function readInput() {
  input.autoAim = getAutoAim();
  if (touch) { touch.apply(); return; }
  input.moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  input.moveY = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  input.gHeld = keys.has('KeyG'); // G를 누르고 있으면 계속 캔다
  // 스킬 키를 누르고 있는지 (차지·돌격)
  input.h1 = keys.has('KeyQ') || keys.has('Digit1'); input.h2 = keys.has('KeyE') || keys.has('Digit2');
  input.h3 = keys.has('KeyR') || keys.has('Digit3'); input.h4 = keys.has('KeyF') || keys.has('Digit4');
  const p = renderer.toWorld(mouseCX, mouseCY);
  input.aimX = p.x; input.aimY = p.y;
}

// 화면 크기: 게임 영역의 실제 크기에 맞춘다 (모바일 주소창·회전 대응)
function fitCanvas() {
  const r = canvas.getBoundingClientRect();
  const w = Math.round(r.width) || document.documentElement.clientWidth || innerWidth;
  const h = Math.round(r.height) || document.documentElement.clientHeight || innerHeight;
  if (w && h && (w !== fitCanvas.w || h !== fitCanvas.h || devicePixelRatio !== fitCanvas.d)) { fitCanvas.w = w; fitCanvas.h = h; fitCanvas.d = devicePixelRatio; renderer.resize(w, h, devicePixelRatio || 1); }
}
addEventListener('resize', fitCanvas);
addEventListener('orientationchange', () => setTimeout(fitCanvas, 200));
window.visualViewport?.addEventListener('resize', fitCanvas);

// 떠돌이 상인: 이 층 몬스터의 잔향을 골드로 판다 (산 것은 바로 안전하게 보관)
function showMerchant(zoneId) {
  const z0 = ZONES.find((x) => x.id === zoneId) || world.zone, z = z0?.pool && z0.elite && MONSTERS[z0.elite] ? { ...z0, floor: z0.floor || 1 } : ZONES[0]; // 바깥 세계 광장: 동굴 상인의 물건
  const ids = [...new Set(z.pool.map((m) => MONSTERS[m].echo.id))];
  const rare = MONSTERS[z.elite].echo.id;
  world.merchantStock ||= [...ids.slice(0, 4).map((id) => ({ id, price: 18 * z.floor + 10, left: 3 })), { id: rare, price: 160 * z.floor, left: 1 }];
  const render = () => {
    showModal(`<h2>떠돌이 상인 오반</h2>
      <p class="muted">"잔향이 필요하오? 값만 맞으면 드리지." · 보유 골드 ${save.gold}</p>
      <div class="shop-list">${world.merchantStock.map((it, i) => `<div class="shop-row" style="--c:${ECHOES[it.id].color}">
        <span>◆ ${ECHOES[it.id].name}</span><span class="muted">남은 수량 ${it.left}</span>
        <button data-buy="${i}" ${it.left && save.gold >= it.price ? '' : 'disabled'}>${it.price} 골드</button></div>`).join('')}</div>
      <p class="muted">산 잔향은 바로 보관되어, 쓰러져도 잃지 않습니다.</p>
      <button data-close>닫기</button>`);
    overlay.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
      const it = world.merchantStock[+b.dataset.buy];
      if (!it.left || save.gold < it.price) return;
      save.gold -= it.price; it.left--;
      save.echoes[it.id] = (save.echoes[it.id] || 0) + 1;
      save.codex.echoes[it.id] = true;
      writeSave(save); sfx('coin');
      render();
    }));
  };
  render();
}

// 거울 호수의 물의 정령: 진주 하나를 바치면 물의 가호 (깊은 물에서 헤엄 · 잠수 · 긴 숨)
function showWaterSpirit() {
  const has = !!save.abilities?.waterBlessing, pearls = save.bag?.pearl || 0;
  showModal(`<div class="talk"><div class="who">거울 호수의 물의 정령</div>
    <p>${has ? '…물이 너를 기억한다. 깊은 곳도 두려워하지 마라.' : '…맑은 것을 지닌 자여. 바다가 품은 진주 하나를 내게 다오. 그러면 물이 너를 밀어내지 않으리라.'}</p></div>
    ${has ? '' : `<p class="muted">${ABILITIES.waterBlessing.desc}</p><button id="givePearl" ${pearls ? '' : 'disabled'}>진주를 바친다 (가진 진주 ${pearls}개)</button>`}
    <button data-close class="ghost">떠난다</button>`);
  const b = document.getElementById('givePearl');
  if (b) b.onclick = () => {
    if (!(save.bag.pearl > 0)) return;
    save.bag.pearl--; (save.abilities ||= {}).waterBlessing = true; writeSave(save);
    overlay.hidden = true; paused = false; modal = null;
    world.setBuild(buildNow());
    renderer.banner = { text: '물의 가호', sub: '깊은 물에서 헤엄치고, 헤엄치다 G로 바닷속에 들어간다 · 물속 숨 45초', t: 4.5, color: '#7ad8ff' };
    world.emit({ t: 'waterBreath', x: world.player.x, y: world.player.y });
    sfx('levelup', { vol: 0.7 });
  };
}

// 사람과 이야기: 대사를 한 줄씩 넘기고, 끝나면 물건을 주고받고 사연이 나아간다
function talkTo(id) {
  const st = save.story;
  const talk = id === 'pinoPlaza' ? pinoPlazaTalk() : pinoTalk(st);
  let i = 0;
  const finish = () => {
    for (const [k, n] of Object.entries(talk.take || {})) st.items[k] = Math.max(0, (st.items[k] || 0) - n);
    for (const [k, n] of Object.entries(talk.give || {})) st.items[k] = (st.items[k] || 0) + n;
    if (talk.set) {
      st.flags[talk.set] = true;
      if (talk.set === 'pinoMap') { world.mapKnown = true; renderer.knowMap(world); }
      if (talk.set === 'pinoDone') { const o = world.objects.find((x) => x.kind === 'npc' && x.id === 'pino'); if (o) { o.leaving = 1; o.reusable = false; o.opened = true; } }
      for (const k of Object.keys(talk.give || {})) renderer.banner = { text: `${josa(STORY_ITEMS[k].name, '을', '를')} 받았다`, sub: STORY_ITEMS[k].desc, t: 3.5, color: STORY_ITEMS[k].color };
      world.signals.push({ t: 'codex' });
    }
    writeSave(save);
  };
  const show = () => {
    const last = i >= talk.lines.length - 1;
    sfx('select', { vol: 0.4 });
    showModal(`<div class="talk"><div class="who">지도 제작자 피노</div><p>${esc(talk.lines[i])}</p></div>
      <button data-next>${last ? (talk.take ? '건네준다' : '알겠다') : '계속 ▸'}</button>`, () => { if (!last) { i++; show(); } else { overlay.hidden = true; paused = false; modal = null; finish(); } });
    overlay.querySelector('[data-next]').onclick = () => modal();
  };
  show();
}

function handleSignals() {
  // 먼저 비워 둔다: 창을 띄우고 중간에 돌아가도 같은 신호가 다시 처리되지 않게
  for (const s of world.signals.splice(0)) {
    if (s.t === 'openPanel') openPanel(s.panel, true);
    if (s.t === 'tower') { showTower(); return; }
    if (s.t === 'coStairs') { if (coRun) netSend({ t: 'co', to: coRun.host, k: 'stairs' }); continue; }
    if (s.t === 'coDown') { renderer.banner = { text: '쓰러졌다', sub: '동료가 이 층을 깨면 다시 일어난다 · 모두 쓰러지면 탑 밖으로', t: 3.5, color: '#ff8a7a' }; sfx('error', { vol: 0.5 }); continue; }
    if (s.t === 'towerClear') { towerClear(s); return; }
    else if (s.t === 'dive') { enterSeabed(s.x, s.y); return; }
    else if (s.t === 'surface') { exitSeabed(s.x, s.y, s.forced); return; }
    else if (s.t === 'enterHouse') { enterHouse(s.house, { x: s.x, y: s.y }); return; }
    else if (s.t === 'exitHouse') { exitHouse(); return; }
    else if (s.t === 'enterZone' && s.entrance) {
      // 입구: 안쪽 세계로 (권장 레벨보다 많이 낮으면 한 번 묻는다)
      if (world.zone?.id === 'world') save.zoneMemory.world = world.exportMemory();
      if (world.zone?.id === 'seabed') { save.zoneMemory.seabed = world.exportMemory(); seaStash = null; }
      const { base } = interiorZone(s.entrance), go = () => { curInterior = { id: s.entrance, x: s.x, y: s.y }; if (isPartyLeader() && net.party.members.length > 1 && ENTRANCES[s.entrance]?.theme !== 'palace') startCoZone(s.entrance); else enterInterior(s.entrance); if (ENTRANCES[s.entrance]?.prop === 'hole') world.player.drop = { h: 170, v: 0 }; }; // 구멍: 위에서 떨어져 내린다
      if (save.level < base.rec - 2) {
        showModal(`<h2>${ENTRANCES[s.entrance].name}</h2><p>권장 레벨은 ${base.rec}입니다. (현재 Lv ${save.level})</p><p class="muted">위험하지만 들어갈 수 있습니다.</p>
          <button id="goAnyway">그래도 들어간다</button><button data-close class="ghost">돌아간다</button>`);
        document.getElementById('goAnyway').onclick = () => { overlay.hidden = true; paused = false; modal = null; go(); };
      } else go();
      return;
    } else if (s.t === 'sanctum') { showSanctum(s.race); return; }
    else if (s.t === 'sanctLeader') { showSanctum(s.race, 'quest'); return; }
    else if (s.t === 'sanctTrain') { showSanctum(s.race, 'train'); return; }
    else if (s.t === 'sanctQuestDone') { const L = SANCT_LIFE[s.race], d = sanctQuestDef(s.race, sanctState(save.story, s.race).cur?.id); writeSave(save); renderer.banner = { text: `의뢰를 마쳤다 · ${d?.title || ''}`, sub: `${SANCTUMS[s.race].name}의 ${L.leader.name}에게 알리자`, t: 3.2, color: SANCTUMS[s.race].color }; sfx('levelup', { vol: 0.5, rate: 1.2 }); }
    else if (s.t === 'trainingDone') finishTraining(s);
    else if (s.t === 'rebuild') { world.setBuild(buildNow()); writeSave(save); }
    else if (s.t === 'scroll') { useScroll(s.kind, s.id); world.signals.length = 0; return; } // 귀환 · 이동 주문서
    else if (s.t === 'sleep') { showSleep(); return; }
    else if (s.t === 'knack') { onKnackLearned(s.id); }
    else if (s.t === 'spiritXp') { // 함께 싸운 시간만큼 정령이 자란다
      const o = save.spirits?.owned?.[s.id];
      const lv0 = spiritLevel(o?.xp); if (o) o.xp = (o.xp || 0) + s.v;
      const lv1 = spiritLevel(o?.xp);
      if (o && lv1 > lv0) { world.setBuild(buildNow()); renderer.banner = { text: `${SPIRITS[s.id].name} Lv ${lv1}`, sub: '함께 싸운 정령이 자랐다 · 힘 +6%', t: 3, color: SPIRIT_GRADES[SPIRITS[s.id].grade].color }; sfx('levelup', { vol: 0.5, rate: 1.3 }); writeSave(save); }
    }
    else if (s.t === 'skillStone') {
      const sk = SKILLS[s.skill];
      if (!learnSkill(s.skill, '옛 기술 석판을 읽었다')) showModal(`<h2>옛 기술 석판</h2><p class="lore">돌에 새겨진 기술: <b>${sk.name}</b></p><p>${esc(sk.desc)}</p><p class="muted">이미 배운 기술이다.</p><button data-close>닫기</button>`);
      return;
    }
    else if (s.t === 'waterSpirit') { showWaterSpirit(); return; }
    else if (s.t === 'waypointOpen') {
      const all = world.objects.filter((o) => o.kind === 'waypoint'), on = all.filter((o) => o.active).length;
      writeSave(save);
      renderer.banner = { text: '포탈이 깨어났다', sub: `${s.name} · 깨운 포탈 ${on} / ${all.length} · 깨어난 포탈끼리는 언제든 오갈 수 있다`, t: 3, color: '#8ad8ff' };
    }
    else if (s.t === 'waypoint') { showWaypoints(s.id); return; }
    else if (s.t === 'relic') { gainRelic(s.race, s.rid); }
    else if (s.t === 'shard') { gainShard(s.race); }
    else if (s.t === 'sign') { showModal(`<h2>표지판</h2><p class="lore">${esc(s.text)}</p><button data-close>닫기</button>`); return; }
    else if (s.t === 'turtle') {
      showModal(`<div class="talk"><div class="who">바닷가의 자라</div><p>허허, 뭍의 손님이로군. 저 바다 밑에 용왕님의 궁전, 용궁이 있다오.</p><p>내 등에 타시겠소? 깊은 곳이라 만만치 않을 게요.</p></div>
        ${(save.learned || []).includes('dive') ? '' : Object.keys(save.fishLog || {}).length >= LEARN.dive.fish ? '<p>…오호, 물고기를 꽤 아는 손님이구먼. 내가 숨 참고 물속에 드는 법을 알려 주지.</p><button id="learnDive">잠수를 배운다</button>' : `<p class="muted">"물고기를 ${LEARN.dive.fish}종쯤 낚아 본 손님이라면 물속에 드는 법을 알려 주겠소." (지금 ${Object.keys(save.fishLog || {}).length}종)</p>`}
        <button id="rideTurtle">등에 탄다 (용궁으로)</button><button data-close class="ghost">다음에</button>`);
      const ld = document.getElementById('learnDive');
      if (ld) ld.onclick = () => { overlay.hidden = true; paused = false; modal = null; learnSkill('dive', '바닷가의 자라에게 배웠다 · 깊은 물에서 헤엄치고 G로 잠수'); };
      document.getElementById('rideTurtle').onclick = () => {
        overlay.hidden = true; paused = false; modal = null;
        const t = world.objects.find((o) => o.kind === 'turtle');
        save.zoneMemory.world = world.exportMemory();
        curInterior = { id: 'palace', x: t.x, y: t.y }; enterInterior('palace');
      };
      return;
    }
    else if (s.t === 'enterZone') {
      if (world.zone?.id === 'world') { returnTo = s.from || 'tower'; save.zoneMemory.world = world.exportMemory(); }
      const z = ZONES.find((x) => x.id === s.zone);
      if (save.level < z.rec - 2) {
        showModal(`<h2>${z.name}</h2><p>권장 레벨은 ${z.rec}입니다. (현재 Lv ${save.level})</p><p class="muted">위험하지만 들어갈 수 있습니다.</p>
          <button id="goAnyway">그래도 들어간다</button><button data-close class="ghost">돌아간다</button>`);
        document.getElementById('goAnyway').onclick = () => { overlay.hidden = true; enterZone(z.id); };
      } else enterZone(z.id);
      return;
    } else if (s.t === 'descend') {
      showModal(`<h2>아래층으로 내려갈까요?</h2>
        <p>지하 ${world.depth + 2}층: 적이 더 강하고, 경험치·골드·잔향이 더 많이 나옵니다.</p>
        <p class="muted">지금까지 모은 잔향은 그대로 가지고 갑니다. 귀환하려면 아래층의 귀환 포탈이나 긴급 귀환을 쓰세요.</p>
        <button id="goDown">내려간다</button><button data-close class="ghost">아직 아니다</button>`);
      document.getElementById('goDown').onclick = () => {
        overlay.hidden = true;
        const carry = { loot: world.loot, discovered: world.discovered, hp: world.player.hp, codexStart: world.codexStart,
          rootMemory: world.depth ? world.rootMemory : world.exportMemory() };
        if (world.zone.key && coRun?.role === 'host') { const seed = (Math.random() * 1e9) >>> 0, zid = world.zone.key, dp = world.depth + 1; carry.hp = Math.max(carry.hp, world.d.maxHp * 0.3); enterInterior(zid, dp, carry, { role: 'host', seed }); netSend({ t: 'co', k: 'zdown', id: zid, depth: dp, seed }); }
        else if (world.zone.key) enterInterior(world.zone.key, world.depth + 1, carry); else enterZone(world.zone.id, world.depth + 1, carry);
      };
      return;
    } else if (s.t === 'merchant') {
      showMerchant(s.zone);
      return;
    } else if (s.t === 'rest') {
      restAndSave();
    } else if (s.t === 'save') {
      writeSave(save);
    } else if (s.t === 'codex') {
      const ups = syncLevel(save);
      writeSave(save);
      if (ups) {
        world.setBuild(buildNow());
        world.player.hp = world.d.maxHp;
        renderer.levelUp(world, save.level, ups * 3);
      }
    } else if (s.t === 'journal') {
      const j = JOURNALS[s.id];
      sfx('lore');
      showModal(`<h2>${j.title}</h2><p class="muted">${j.where}</p><div class="journal">${esc(j.text).replace(/\n/g, '<br>')}</div><button data-close>덮는다</button>`);
      return;
    } else if (s.t === 'npc') {
      talkTo(s.id);
      return;
    } else if (s.t === 'lore') {
      sfx('lore');
      showModal(`<h2>${s.bottle ? '유리병 편지' : '고대 석판'}</h2>${s.bottle ? '<p class="muted">낚싯바늘에 걸린 유리병 안에 오래된 편지가 들어 있다.</p>' : ''}<p class="lore">${s.text}</p><p class="muted">(서고에 기록됨)</p><button data-close>닫기</button>`);
    }
  }
  world.signals.length = 0;
}

let autosaveT = 0;
function frame(ts) {
  try { tick(ts); } catch (err) { if (!frame.warned) { frame.warned = true; console.error(err); } } // 한 번의 오류로 게임이 멈추지 않게
  requestAnimationFrame(frame);
}
function tick(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000 || 0);
  last = ts;
  if (world && !gameEl.hidden) {
    if (renderer.hitstop > 0) renderer.hitstop -= dt;
    else if ((!paused || coRun) && world.state === 'play') { // 파티 탑: 창을 열어도 세계는 돈다 (동료가 기다리지 않게)
      acc += dt;
      if (!paused) readInput();
      while (acc >= DT) {
        world.step(paused ? IDLE_INPUT : input);
        input.dash = false; input.interact = false; input.skill = false; input.s1 = false; input.s2 = false; input.s3 = false; input.s4 = false; input.wskill = false;
        acc -= DT;
        if (world.signals.length) { handleSignals(); break; }
      }
    }
    if (!paused && world.state === 'play' && !world.practice) { autosaveT += dt; if (autosaveT > 45) { autosaveT = 0; writeSave(save); } } // 시간 · 생활 기록을 가끔 저장
    if (world.practice && (frame.dpsT = (frame.dpsT || 0) + dt) > 0.4) { // 연습: 최근 5초 동안 준 피해
      frame.dpsT = 0;
      const el = document.getElementById('practiceDps'), log = world.dmgLog || [];
      while (log.length && world.t - log[0][0] > 5) log.shift();
      const sum = log.reduce((a, [, v]) => a + v, 0), span = log.length ? Math.max(1, world.t - log[0][0]) : 1;
      if (el) el.textContent = `최근 5초 피해 ${Math.round(sum)} · 초당 ${Math.round(sum / span)}`;
      // 다 잡으면 2초 뒤 같은 상대를 다시 부른다
      const set = ARENA_SETS[practice.arena];
      if (practice.refill && set?.list.length && world.enemies.every((e) => e.dead)) { frame.refillT = (frame.refillT || 0) + 0.4; if (frame.refillT >= 2) { frame.refillT = 0; spawnArena(practice.arena); } }
      else frame.refillT = 0;
    }
    tutorialTick();
    onlineTick(dt);
    if (world.state === 'dead' || world.state === 'done') {
      endTimer += dt;
      if (endTimer > (world.state === 'dead' ? 1.4 : 0.3)) endRun(world.state === 'dead' ? 'dead' : 'clear');
    }
    renderer.consume(world);
    renderer.draw(world, paused ? 0 : dt);
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
window.__game = { get world() { return world; }, renderer, hub }; // 디버그용

// 로그인·저장 상태 표시
const chip = document.createElement('div');
chip.id = 'cloudChip';
document.body.appendChild(chip);
onCloud(() => {
  chip.className = 'st-' + cloud.state;
  chip.replaceChildren();
  if (cloud.avatar && cloud.id) { const img = document.createElement('img'); img.src = cloud.avatar; img.alt = ''; chip.appendChild(img); }
  const t = document.createElement('span');
  t.textContent = (cloud.id ? (cloud.name || '내 계정') + ' · ' : '') + cloudLabel();
  chip.appendChild(t);
});

// 모바일: 터치 조작 화면 켜기
if (isTouch()) {
  document.body.classList.add('touch');
  touch = setupTouch({ input, getWorld: () => world, onMenu: () => { unlockAudio(); escAction(); }, onBag: () => openPanel('char') });
  addEventListener('pointerdown', () => { try { if (!document.fullscreenElement && innerHeight < 600) document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* 무시 */ } }, { once: true });
}

(async () => {
  const [, , , remote] = await Promise.all([loadAssets(), document.fonts?.load('11px Galmuri11').catch(() => {}), document.fonts?.load('bold 11px Galmuri11').catch(() => {}), initCloud()]);
  // 서버 저장과 브라우저 저장 중 더 최근 것을 사용
  if (remote && (!save || (remote.updatedAt || 0) >= (save.updatedAt || 0))) save = remote;
  save = migrateSave(save);
  setSaveHook(cloudSave);
  if (save && remote !== save) cloudSave(save);
  let guest = false; try { guest = !!localStorage.getItem('et-guest'); } catch { /* 무시 */ }
  if (!isClaudePage() && cloud.mode === 'local' && !guest) { showLogin(afterLogin); requestAnimationFrame(frame); return; }
  if (save) { refreshQuests(save); writeSave(save); enterWorld(); } else firstStart();
  requestAnimationFrame(frame);
})();

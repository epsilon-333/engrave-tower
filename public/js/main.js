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
import { RAIDS, raidWeek, buildRaidArena } from './data/raid.js';
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
import { PORTS, CARGO, CARGO_CAP, destName, buyPrice as portBuy, sellPrice as portSell, noteTrade, rememberPrices, cargoCount, SEA_EVENTS } from './data/trade.js';
import { SHIP_ZONE, buildShipDeck } from './data/maps/ship.js';
import { NOKT_ZONE, buildNoktHaven } from './data/maps/nokt.js';
import { ISLAND_DEFS, islandZone, islandMap } from './data/maps/islands.js';
import { FACTIONS, RANKS, LOYALTY, newPol, titleOf, bounty, OFFICIALS, officialNow, HAPPENINGS, FOES, CULT_LORE, mistClues, MIST_NEED } from './data/politics.js';
import { SHIPS, cargoCap, GUILD_RANKS, guildRank } from './data/trade.js';
import { ENG_STEP, ENG_MAX } from './sim/build.js';

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
const onlineInfo = () => ({ name: cloud.name || `${RACES[save.race]?.name || ''} 여행자`, race: save.race, cls: save.cls, weapon: save.gear?.weapon, lv: save.level, uid: save.uid, guild: save.guild || null, adminKey: (() => { try { return localStorage.getItem('adminKey') || ''; } catch { return ''; } })() });
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
// ───── 랭킹 · 운영자 ─────
const RANK_RAID = { golem: '고대 골렘', queen: '서리 여왕', dragon: '화룡왕' };
const fmtTime = (s) => `${Math.floor(s / 60)}분 ${String(Math.round(s % 60)).padStart(2, '0')}초`;
function rankSend() { if (!net.up || !save) return; netSend({ t: 'rankSet', gold: save.gold | 0, tower: save.tower?.max || 0, raid: save.raid?.best || {} }); }
onNet('up', () => setTimeout(rankSend, 800));
setInterval(rankSend, 60000);
let rankTab = 'gold';
function showRank() { if (!net.up) { renderer.banner = { text: '랭킹', sub: '서버와 이어져 있을 때만 볼 수 있다', t: 2.2, color: '#c8b8a0' }; return; } rankSend(); netSend({ t: 'rankGet' }); }
onNet('rank', (m) => {
  const tabs = [['gold', '돈'], ['tower', '각인의 탑'], ...Object.entries(RANK_RAID).map(([k, n]) => [k, `레이드 · ${n}`])];
  const list = rankTab === 'gold' ? m.gold : rankTab === 'tower' ? m.tower : m.raid[rankTab] || [];
  const fmt = (v) => rankTab === 'gold' ? `◆ ${v.toLocaleString()}` : rankTab === 'tower' ? `${v}층` : fmtTime(v);
  const rows = list.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td class="muted">${RACES[r.race]?.name || ''}</td><td style="text-align:right">${fmt(r.v)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">아직 기록이 없다</td></tr>';
  showModal(`<h2>랭킹</h2><div class="actions">${tabs.map(([k, n]) => `<button class="sm ${k === rankTab ? '' : 'ghost'}" data-rk="${k}">${n}</button>`).join('')}</div>
    <p class="muted">${rankTab in RANK_RAID ? '레이드에 들어간 때부터 보스를 쓰러뜨릴 때까지 — 짧을수록 위' : rankTab === 'tower' ? '혼자 · 파티로 오른 가장 높은 층' : '지금 가진 돈'} · 결투 점수는 나중에</p>
    <table style="width:100%">${rows}</table><div class="actions"><button data-close class="ghost">닫기</button></div>`);
  overlay.querySelectorAll('[data-rk]').forEach((b) => (b.onclick = () => { rankTab = b.dataset.rk; netSend({ t: 'rankGet' }); }));
});
onNet('welcome', (m) => { net.admin = !!m.admin; renderer.admin = net.admin; });
function showAdmin() { if (net.admin) netSend({ t: 'adminList' }); }
onNet('adminList', (m) => {
  const rows = m.list.map((o) => `<tr><td>${esc(o.name)}${o.admin ? ' ★' : ''}</td><td>${RACES[o.race]?.name || ''} Lv ${o.lv || 1}</td><td class="muted">${esc(o.map || '-')}${o.map ? ` (${Math.round((o.x || 0) / 16)}, ${Math.round((o.y || 0) / 16)})` : ''}</td><td class="muted">${esc(o.guild)}${o.partyN ? ` · 파티 ${o.partyN}` : ''}</td><td>${o.rank ? `◆${(o.rank.gold || 0).toLocaleString()} · 탑 ${o.rank.tower || 0}` : ''}</td><td><button class="sm ghost" data-ai="${o.id}">자세히</button></td></tr>`).join('');
  showModal(`<h2>운영자 · 접속한 사람</h2><p class="muted">지금 ${m.online}명 · 길드 ${m.guilds} · 랭킹 기록 ${m.ranked}</p><table style="width:100%;font-size:0.9em">${rows}</table><div id="adminInfo"></div>
    <div class="actions"><button id="adRe" class="ghost">새로고침</button><button data-close class="ghost">닫기</button></div>`);
  document.getElementById('adRe').onclick = showAdmin;
  overlay.querySelectorAll('[data-ai]').forEach((b) => (b.onclick = () => netSend({ t: 'adminInfo', id: +b.dataset.ai })));
});
onNet('adminAsk', (m) => { // 운영자가 내 정보를 본다 (보여 주기만 한다)
  if (!save) return;
  netSend({ t: 'adminReply', to: m.from, info: { level: save.level, race: save.race, cls: save.cls, gold: save.gold, stats: world?.b?.stats || null, gear: Object.fromEntries(Object.entries(save.gear || {}).map(([k, v]) => [k, ITEMS[v]?.name || v])), skills: (world?.b?.skills || []).map((id) => SKILLS[id]?.name || id), tower: save.tower?.max || 0, raid: save.raid?.best || {}, zone: world?.zone?.name || '' } });
});
onNet('adminInfo', (m) => {
  const el = document.getElementById('adminInfo'); if (!el) return; const i = m.info || {};
  el.innerHTML = `<div class="skc"><b>${RACES[i.race]?.name || ''} Lv ${i.level}</b> · ${esc(i.zone || '')} · ◆ ${(i.gold || 0).toLocaleString()} · 탑 ${i.tower}층<div class="muted">장비: ${esc(Object.entries(i.gear || {}).map(([k, v]) => `${k} ${v}`).join(' · ') || '-')}</div><div class="muted">스킬: ${esc((i.skills || []).join(' · ') || '-')}</div>${i.stats ? `<div class="muted">스탯: ${esc(Object.entries(i.stats).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · '))}</div>` : ''}${Object.keys(i.raid || {}).length ? `<div class="muted">레이드: ${Object.entries(i.raid).map(([k, v]) => `${RANK_RAID[k]} ${fmtTime(v)}`).join(' · ')}</div>` : ''}</div>`;
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
  if (!chatEl.hidden && isTouch()) netInfo.textContent = world?.pvp ? '⚔ 결투 중' : coRun ? `파티 · 동료 ${net.players.size}명` : `온라인 · 근처 ${net.players.size}명`; // 모바일: 키 안내는 빼고 짧게
  else if (!chatEl.hidden) netInfo.textContent = world?.pvp ? '⚔ 결투 중' : coRun ? `파티 탑 · 같은 층 동료 ${net.players.size}명 · Enter 채팅 (/p 파티)` : world?.zone?.id === 'world' ? `온라인 · 근처 ${net.players.size}명 · Enter 채팅 · O 파티 · 길드` : '온라인 · 바깥 세계에서만 서로 보인다 · O 파티 · 길드';
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
onNet('dproj', (m) => { if (world?.pvp && duel) world.addGhostProjs(m.l); });
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
  if (world.projOut?.length) netSend({ t: 'dproj', l: world.projOut.splice(0) }); // 내 투사체를 상대 화면에도
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

// ───── 사령술사: 거둔 영혼 (30개까지 모아 두고, 소환 목록에 넣은 것부터 한 번에 10개까지 되살린다) ─────
function showSouls() {
  const S = (save.souls ||= []);
  const groups = new Map();
  S.forEach((sv, i) => { if (sv.up) return; const k = sv.defId; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  const rows = [...groups.entries()].map(([id, idx]) => {
    const def = MONSTERS[id], picked = idx.filter((i) => S[i].pick).length, sv = S[idx[0]];
    return `<div class="soc-row ${picked ? 'on' : ''}"><span class="nm"><b>${esc(def?.name || id)}</b> <small class="muted">×${idx.length}</small></span><span class="muted">체력 ${Math.round(sv.maxHp * 0.5)} · 공격 ${Math.round(sv.atk * 0.5)} · 소환 목록 ${picked}</span>
      <span class="btns"><button class="sm ghost" data-sp="${id}" data-d="-1" ${picked ? '' : 'disabled'}>−</button><button class="sm" data-sp="${id}" data-d="1" ${picked < idx.length ? '' : 'disabled'}>목록 +</button><button class="sm ghost" data-sx="${id}">하나 버리기</button></span></div>`;
  }).join('');
  const upN = S.filter((s) => s.up).length;
  showModal(`<div class="social" id="soulBox"><h2>거둔 영혼 <small>${S.length} / 30 · 나와 있음 ${upN}/10</small></h2>
    <p class="muted">「영혼 소환」은 소환 목록에 넣은 영혼부터, 남으면 강한 영혼 순으로 10마리까지 되살린다. 되살린 영혼은 공격력 그대로 · 체력 절반 · 첫 한 대는 막고, 쓰러질 때까지 다른 곳에도 따라온다. 영혼은 30개까지 모이고 저절로 줄지 않는다.</p>
    <div class="soc-list">${rows || '<p class="muted">아직 거둔 영혼이 없다. 쓰러뜨린 몬스터에게서 절반쯤 영혼을 거둔다.</p>'}</div>
    <div class="actions"><button id="soulAll" class="ghost">목록 비우기</button><button data-close>닫기</button></div></div>`);
  const box = document.getElementById('soulBox');
  box.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'soulAll') S.forEach((s) => delete s.pick);
    else if (b.dataset.sp) { const list = S.filter((s) => s.defId === b.dataset.sp && !s.up); if (+b.dataset.d > 0) { const f = list.find((s) => !s.pick); if (f) f.pick = true; } else { const f = list.find((s) => s.pick); if (f) delete f.pick; } }
    else if (b.dataset.sx) { const i = S.findIndex((s) => s.defId === b.dataset.sx && !s.pick && !s.up); const j = i >= 0 ? i : S.findIndex((s) => s.defId === b.dataset.sx && !s.up); if (j >= 0) S.splice(j, 1); }
    else return;
    writeSave(save); showSouls();
  };
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
// ───── 보스 레이드 ─────
function showRaid() {
  const R = (save.raid ||= { clears: {}, week: {} }), wk = raidWeek(), lead = isPartyLeader() && net.party.members.length > 1;
  const cards = Object.entries(RAIDS).map(([id, r]) => `<div class="skc"><div class="c-head"><b style="color:${r.color}">${r.name}</b><span class="role">권장 Lv ${r.rec}</span></div><div class="c-sum">${esc(r.desc)}</div>
    <div class="muted">깬 횟수 ${R.clears[id] || 0}${R.week[id] === wk ? ' · 이번 주 보물상자 받음' : ' · 이번 주 보물상자 남음'}</div>
    <div class="c-act"><button class="sm" data-raid="${id}">${lead ? '파티와 들어가기' : '들어가기'}</button></div></div>`).join('');
  showModal(`<h2>레이드 제단</h2><p class="muted">거대한 보스와 싸우는 둥근 방. 체력이 셋으로 나뉘어 단계마다 패턴이 바뀐다 — 빨간 예고를 보고 피하고, 「표식」이 붙으면 동료에게서 떨어진다. 파티(최대 4명)로 오면 함께 싸운다 (인원수만큼 보스가 단단해진다).</p>
    ${net.party && !isPartyLeader() ? '<p class="muted">파티에 있다 — 파티장이 들어가면 함께 갈지 묻는다.</p>' : ''}<div class="skill-row">${cards}</div><div class="actions"><button data-close class="ghost">돌아간다</button></div>`);
  overlay.querySelectorAll('[data-raid]').forEach((b) => (b.onclick = () => { overlay.hidden = true; paused = false; modal = null; const id = b.dataset.raid; if (lead) startCoRaid(id); else enterRaid(id); }));
}
let raidT0 = 0;
function enterRaid(id, co = null) {
  const r = RAIDS[id]; if (!r) return;
  if (world?.zone?.id === 'world') { curInterior = { id: 'raid', x: world.player.x, y: world.player.y }; save.zoneMemory.world = world.exportMemory(); }
  const seed = co?.seed ?? ((Math.random() * 1e9) >>> 0);
  raidT0 = performance.now(); // 처치 시간을 잰다
  world = new World({ build: buildNow(), mode: 'field', zone: r.zone, zoneId: r.zone.id, seed, map: buildRaidArena(), raid: { id }, coop: co ? { role: co.role } : null, story: save.story, codex: save.codex, ...shared() });
  world.enemies = []; world.camps = []; world.objects = []; world.explored.fill(1); world.milestones = new Set([50, 80, 100]);
  if (co?.role !== 'member') { const b = world.makeEnemy(r.boss, world.map.lair.x * 16 + 8, world.map.lair.y * 16 + 8, { noAffix: true }); b.champion = r.name; b.home = { x: b.x, y: b.y }; world.enemies.push(b); }
  coRun = co ? { role: co.role, host: co.role === 'host' ? net.id : co.host, party: net.party?.id || 0, key: `r${net.party?.id || 0}${id}`, snapT: 0, flushT: 0, meT: 0, lastSnap: performance.now() } : null;
  world.codexStart = codexPoints(save); world.goalNeeds = [];
  renderer.setWorld(world);
  renderer.banner = { text: r.name, sub: '빨간 예고를 보고 피하라 · 「표식」이 붙으면 동료에게서 떨어져라', t: 3.5, color: r.color };
  startMusic(r.zone.id.includes('dragon') ? 'rift' : r.zone.id.includes('queen') ? 'frost' : 'cave'); sfx('open'); startLoop();
}
function startCoRaid(id) {
  const seed = (Math.random() * 1e9) >>> 0;
  enterRaid(id, { role: 'host', seed });
  netSend({ t: 'co', k: 'rstart', id, seed });
}
function raidClear(s) {
  const r = RAIDS[s.id], R = (save.raid ||= { clears: {}, week: {} }), wk = raidWeek();
  R.clears[s.id] = (R.clears[s.id] || 0) + 1;
  const took = (performance.now() - raidT0) / 1000, best = (R.best ||= {}); let rec = '';
  if (raidT0 && took > 5) { if (!best[s.id] || took < best[s.id]) { best[s.id] = Math.round(took); rec = ' · 새 기록!'; } rankSend(); }
  const gold = 300 + r.rec * 20, chest = R.week[s.id] !== wk, extra = [];
  save.gold += gold;
  if (chest) { R.week[s.id] = wk; const g2 = 600 + r.rec * 40; save.gold += g2; extra.push(`주간 보물상자: ◆ ${g2}`); if (bagAdd(lifeOf(), 'spiritStone', 3)) extra.push('정령석 ×3'); }
  writeSave(save); cloudSaveNow(save);
  renderer.banner = { text: `${r.name} 쓰러뜨림!`, sub: `${fmtTime(took)}${rec} · ◆ ${gold}${extra.length ? ' · ' + extra.join(' · ') : ''} · 떨어진 「${GOODS[{ raidGolem: 'golemHeart', raidQueen: 'queenTear', raidDragon: 'dragonCrest' }[r.boss]]?.name}」를 줍자 · 귀환 포탈이 열렸다`, t: 6, color: r.color };
  sfx('levelup', { vol: 0.8 });
  const p = world.player; world.objects.push({ kind: 'portal', x: p.x, y: p.y - 30, label: '귀환 포탈', color: r.color });
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
    case 'rstart': { // 파티장이 레이드에 들어간다
      if (net.party?.leader !== m.from || !RAIDS[m.id]) break;
      const busy = coRun || world.pvp || duel || world.zone?.id !== 'world' || world.state !== 'play';
      if (busy) { netSend({ t: 'co', to: m.from, k: 'no', why: world.zone?.id !== 'world' ? '바깥 세계에 없다' : '다른 일을 하는 중' }); break; }
      inviteCard(`<b>보스 레이드</b><p>${esc(josa(fromName, '이', '가'))} <b>${esc(RAIDS[m.id].name)}</b>에게 간다</p>`, () => {
        if (world.zone?.id !== 'world' || world.state !== 'play' || coRun) return;
        if (modal) { overlay.hidden = true; paused = false; modal = null; }
        if (!panelEl.hidden) closePanel();
        enterRaid(m.id, { role: 'member', seed: m.seed, host: m.from });
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
    case 'pj': if (coRun && coF() === m.f && world.coop) world.addGhostProjs(m.l); break;
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
  if (w.projOut?.length) netSend({ t: 'co', k: 'pj', f: F, l: w.projOut.splice(0) }); // 내 투사체를 동료 화면에도
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
  const T = (save.tower ||= { best: {}, max: 0 }), next = Math.min(TOWER_TOP, T.max + 1), starts = [...new Set([next, ...towerStarts(T.max)])].sort((a, b) => b - a); // 이어서: 깬 층 다음 층부터
  const floors = Array.from({ length: Math.min(TOWER_TOP, T.max + 1) }, (_, i) => i + 1).map((f) => `<span class="tw-f ${isBossFloor(f) ? 'boss' : ''}" style="--c:${GRADE_COLOR[T.best[f]] || '#5a5068'}">${f}<b>${T.best[f] || '·'}</b></span>`).join('');
  showModal(`<h2>각인의 탑</h2>
    <p class="muted">층마다 짧은 던전이다. 계단에 닿으면 클리어 — 걸린 시간과 받은 피해로 등급(S · A · B · C)과 보상을 받는다. 5층마다 층 수호자를 쓰러뜨려야 계단이 열린다. 오를수록 몬스터가 크게 강해진다. 쓰러지면 탑 밖으로 밀려난다.</p>
    <p>최고 기록 <b>${T.max}층</b> / ${TOWER_TOP}층</p><div class="tw-floors">${floors}</div>
    <div class="actions">${starts.map((f) => `<button data-tw="${f}" class="${f === next ? '' : 'ghost'}">${f === next && T.max ? `이어서 · ${f}층부터` : `${f}층부터 오르기`}</button>`).join('')}<button data-close class="ghost">돌아간다</button></div>
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
hub.onCodex = () => { const ups = syncLevel(save); if (ups && world) { world.setBuild(buildNow()); renderer.levelUp(world, save.level, ups); } };

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
    ${reGolem ? '<p class="lvup">골렘족은 이제 몬스터가 되었어요. 새 종족과 클래스를 골라 주세요 — 레벨 · 장비 · 돈 · 도감은 그대로예요.</p>' : ''}<p class="muted">클래스를 고르세요. 클래스마다 스킬 6개와 전용 무기가 있습니다. 광장의 공명 제단에서 언제든 바꿀 수 있어요.</p>
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
    if (reGolem) { // 예전 골렘 저장: 종족 · 클래스만 바꾼다
      reGolem = false; save.race = race; save.cls = b.dataset.style; save.style = c.style;
      if (!(save.items ||= []).includes(c.weapons[0])) save.items.push(c.weapons[0]);
      (save.gear ||= {}).weapon = c.weapons[0];
      refreshQuests(save); writeSave(save); cloudSaveNow(save); titleEl.hidden = true; enterWorld();
      return;
    }
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
  if (save?.race === 'golem') { reGolem = true; titleEl.hidden = false; showRaceSelect(); return; } // 골렘족은 이제 몬스터: 다른 종족을 고른다 (레벨 · 장비 · 돈은 그대로)
  if (save) { refreshQuests(save); writeSave(save); enterWorld(); } else firstStart();
}
let reGolem = false;

// 예전 저장 데이터를 새 구조로 옮긴다 (인간·드워프 → 기사, 없어진 슬롯·무기 정리)
function migrateSave(sv) {
  if (!sv) return sv;
  registerCrafted(ITEMS, sv.crafted);
  registerAllDishes(sv.bag, sv.chest);
  if (RACE_MIGRATE[sv.race]) sv.race = RACE_MIGRATE[sv.race];
  if (!RACES[sv.race]) sv.race = 'knight';
  if (!sv.statFix2) { // 스탯을 새 규칙으로 다시 센다: 레벨마다 1점
    sv.statFix2 = true;
    const total = Math.max(0, (sv.level || 1) - 1), spent = Object.values(sv.alloc || {}).reduce((a, v) => a + (v || 0), 0);
    if (spent > total) { sv.alloc = {}; sv.points = total; } else sv.points = total - spent;
  }
  if (!sv.statFix3) { // 지금까지 여러 성지에서 쌓은 수련 단계는 모두 내 종족 성지의 수련으로 옮겨 남긴다
    sv.statFix3 = true;
    const S2 = (sv.story ||= {}).sanct ||= {};
    const total = Object.values(S2).reduce((a, x) => a + (x?.train || 0), 0);
    for (const x of Object.values(S2)) if (x) x.train = 0;
    if (total) sanctState(sv.story, sv.race).train = total;
  }
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
const shared = () => ({ life: lifeOf(), clock: save.time, persist: save.effects, minions: (save.minions ||= []) });

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
  if (!at && save.atIsland && ISLAND_DEFS[save.atIsland]) { enterIsland(save.atIsland); return; }
  goOnline();
  { const el = document.getElementById('practicePanel'); if (el) el.hidden = true; }
  save.zoneMemory ||= {};
  world = new World({ build: buildNow(), mode: 'field', zoneId: 'world', seed: 77, memory: save.zoneMemory.world, story: save.story, codex: save.codex, ...shared() });
  world.respawnPending = !at && !first;
  worldExtras(world);
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
  overlay.querySelectorAll('[data-spmain]').forEach((b) => (b.onclick = () => { save.spirits.main = b.dataset.spmain; save.spirits.extra = (save.spirits.extra || []).filter((x) => x !== b.dataset.spmain); writeSave(save); world.setBuild(buildNow()); showSanctum(race, 'spirit'); }));
  overlay.querySelectorAll('[data-spx]').forEach((b) => (b.onclick = () => { const id = b.dataset.spx, L = (save.spirits.extra ||= []); save.spirits.extra = L.includes(id) ? L.filter((x) => x !== id) : [...L, id].slice(0, 2); writeSave(save); world.setBuild(buildNow()); showSanctum(race, 'spirit'); })); // 정령사: 셋까지 함께
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
    ${o ? `<small>${esc(spiritBuffText(id, o.star, spiritLevel(o.xp)))}</small>${main === id ? '<em>함께하는 정령</em>' : `<button class="sm" data-spmain="${id}">함께하기</button>${save.cls === 'spiritcaller' ? ((save.spirits.extra || []).includes(id) ? `<button class="sm" data-spx="${id}">함께 · 빼기</button>` : `<button class="sm ghost" data-spx="${id}" ${(save.spirits.extra || []).length >= 2 ? 'disabled' : ''}>같이 데려가기</button>`) : ''}`}` : ''}</div>`;
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
  if (save.blessDayAll === today()) { renderer.banner = { text: '오늘은 이미 축복을 받았다', sub: '성지의 축복 · 수련으로 강해지는 것은 하루 한 번씩 (어느 성지든)', t: 2.6, color: '#c8b8a0' }; return; }
  save.blessDayAll = today();
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
  const doneToday = save.trainDayAll === today(); // 수련으로 강해지는 것은 하루 한 번 (어느 성지든)
  const rankUp = (st.train || 0) < cap && !doneToday;
  if (rankUp) { st.train = (st.train || 0) + 1; save.trainDayAll = today(); }
  save.gold += gold;
  const affOk = st.trainToday < TRAINS_PER_DAY;
  st.trainToday++;
  if (affOk) addAff(race, TRAIN_AFF);
  writeSave(save);
  world.setBuild(buildNow());
  const stat = Object.keys(S.unit).map((k) => ({ str: '근력', mag: '마력', agi: '민첩', vit: '체력', sen: '감각', spi: '정신', pres: '물리 저항', mres: '마법 저항' }[k])).join(' · ');
  renderer.banner = { text: `수련 성공 · ${L.train.name}`, sub: `${rankUp ? `수련 ${st.train}단계 · ${stat} +1 · 다음 단계는 더 어렵다` : doneToday ? '오늘은 이미 수련으로 강해졌다 (하루 한 번 · 어느 성지든)' : '수련 한도에 닿았다'} · 골드 +${gold}${affOk ? ` · 친밀도 +${TRAIN_AFF}` : ''}`, t: 3.6, color: S.color };
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
const ALWAYS_TABS = ['char', 'gear', 'where', 'bag', 'codex'];
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
  if (!world.tower && !world.raid) (save.zoneMemory ||= {})[memKey] = world.depth ? world.rootMemory || save.zoneMemory[memKey] : world.exportMemory(); // 탑의 층은 기억하지 않는다
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
    ${res.ups ? `<p class="lvup">레벨 업! Lv ${save.level} · 스탯 포인트 +${res.ups}</p>` : ''}
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
  const field = world.mode === 'field' && !world.voyage;
  showModal(`<h2>일시정지</h2>
    <button data-close>계속하기</button>
    ${net.up && !world.practice ? '<button id="socialBtn" class="ghost">동료 (파티 · 길드) · O</button><button id="rankBtn" class="ghost">랭킹 · N</button>' : ''}
    ${net.admin ? '<button id="adminBtn" class="ghost">운영자 · 접속한 사람</button>' : cloud.name === '운영자' && net.up ? '<p class="muted">운영자 열쇠 (서버의 ADMIN_KEY) <input id="adminKeyIn" type="password" style="width:9em"> <button id="adminKeyGo" class="sm ghost">확인</button></p>' : ''}
    ${isTouch() ? `<div class="actions col"><button id="tChar" class="ghost">캐릭터 · 스킬 · 스탯</button><button id="tMap" class="ghost">지도</button><button id="tQuest" class="ghost">퀘스트</button><button id="tGear" class="ghost">장비 · 어디서 얻나</button>${net.up ? '<button id="tChat" class="ghost">채팅</button>' : ''}</div>` : ''}
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
  const rb = document.getElementById('rankBtn'); if (rb) rb.onclick = () => showRank();
  const ab = document.getElementById('adminBtn'); if (ab) ab.onclick = () => showAdmin();
  const ak = document.getElementById('adminKeyGo'); if (ak) ak.onclick = () => { try { localStorage.setItem('adminKey', document.getElementById('adminKeyIn').value); } catch {} netConnect(onlineInfo); setTimeout(() => { if (modal) showPause(); }, 700); };
  const close0 = () => { overlay.hidden = true; paused = false; modal = null; };
  const tm = document.getElementById('tMap'); if (tm) tm.onclick = () => { close0(); if (world.map?.outdoor) renderer.bigMap = !renderer.bigMap; };
  const tq = document.getElementById('tQuest'); if (tq) tq.onclick = () => { close0(); showQuestLog(); };
  const tg = document.getElementById('tGear'); if (tg) tg.onclick = () => { close0(); openPanel('gear'); };
  const tc = document.getElementById('tChat'); if (tc) tc.onclick = () => { close0(); openChat(); };
  const tch = document.getElementById('tChar'); if (tch) tch.onclick = () => { close0(); if (!world.practice) openPanel('char'); };
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
  if (e.code === 'KeyN') showRank(); // 랭킹
  if (e.code === 'KeyJ' && world.state === 'play' && !world.practice) showQuestLog();
  if (e.code === 'KeyH' && world.state === 'play') eatQuick();
  if (e.code === 'KeyV' && world.state === 'play') input.mount = true; // 탈것 타기 · 내리기
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
    if (s.t === 'raid') { showRaid(); return; }
    if (s.t === 'raidClear') { raidClear(s); return; }
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
        renderer.levelUp(world, save.level, ups);
      }
    } else if (s.t === 'journal') {
      const j = JOURNALS[s.id];
      sfx('lore');
      showModal(`<h2>${j.title}</h2><p class="muted">${j.where}</p><div class="journal">${esc(j.text).replace(/\n/g, '<br>')}</div><button data-close>덮는다</button>`);
      return;
    } else if (s.t === 'npc') {
      if (arcTalk(s.id) || portTalk(s.id) || noktTalk(s.id)) return;
      talkTo(s.id);
      return;
    } else if (s.t === 'seaEvent') {
      showSeaEvent(s.id);
      return;
    } else if (s.t === 'happening') {
      happeningTalk(s.id);
      return;
    } else if (s.t === 'skirmishWon') {
      skirmishWon(s);
    } else if (s.t === 'officialDown') {
      officialDown(s);
      return;
    } else if (s.t === 'pitWon' || s.t === 'pitLost') {
      pitResult(s);
    } else if (s.t === 'voyageWon' || s.t === 'voyageLost') {
      voyageResult(s);
    } else if (s.t === 'voyageEnd') {
      world.signals.length = 0;
      arriveVoyage();
      return;
    } else if (s.t === 'lore') {
      sfx('lore');
      showModal(`<h2>${s.bottle ? '유리병 편지' : '고대 석판'}</h2>${s.bottle ? '<p class="muted">낚싯바늘에 걸린 유리병 안에 오래된 편지가 들어 있다.</p>' : ''}<p class="lore">${s.text}</p><p class="muted">(서고에 기록됨)</p><button data-close>닫기</button>`);
    }
  }
  world.signals.length = 0;
}

// ═══════ 항구 · 배 · 교역 ═══════
// 항구지기(배편) · 교역상(사고팔기) · 시세판, 배 위의 선장 · 선원 · 상인 정보원. 처리했으면 true
const SEA_RUMORS = [
  '녹타리스라는 이름 들어 봤소? 왕도 뒷골목에 중개인이 숨어 산다더군. 날마다 자리를 옮긴다지.',
  '에드릭 왕이 빛을 되살린다며 성지 조각을 걷어 간다오. 세금도 또 올랐고… 쉿, 크게 말하지 마시오.',
  '황금 돛 섬에는 경매장이 있소. 언젠가 뱃길이 열리면 비단을 한 짐 실어 와야지.',
  '하얀 왕관 공국이 녹타리스에 몰래 칼을 대 준다는 소문이 있소. 그러니 왕국이랑 사이가 나쁘지.',
  '해골 군도에선 현상금 붙은 놈도 술 한잔 얻어먹는다오. 경비병이 하나도 없거든.',
  '안개 너머에 섬이 하나 더 있다는 뱃사람 이야기, 믿소? 기록을 모으면 뱃길이 보인다던데.',
  '바닷바람이 동쪽으로 불 땐 해적이 잘 나오오. 짐을 많이 실었으면 칼을 가까이 두시오.',
  '안개 부두 소금을 남쪽 항구에 가져가면 값이 곱절이오. 남쪽 밀은 그 반대고.',
];
const repOf = () => (save.rep ||= { fame: 0, infamy: 0 });
const portGoldRow = () => `<p class="muted">가진 돈 <b>◆ ${save.gold}</b> · 교역품 짐 <b>${cargoCount(save.bag)} / ${cargoCap(save)}</b>${save.ship ? ` (내 배 짐칸 포함)` : ''}</p>`;
function portTalk(id) {
  const [pid, role] = id.split('_');
  if (pid === 'ship' && world.voyage) { shipTalk(role); return true; }
  const P = PORTS[pid];
  if (!P) return false;
  if (role === 'master') portShowRoutes(pid);
  else if (role === 'trade') portShowTrade(pid);
  else if (role === 'board') portShowBoard(pid);
  return true;
}
function portShowRoutes(pid) {
  const P = PORTS[pid];
  const clues = mistClues(save);
  const rows = P.routes.map((r, i) => r.hidden && clues < MIST_NEED
    ? `<div class="soc-row"><span class="nm"><b>??? (안개)</b></span><span class="muted">안개가 길을 감춘다 — 교단의 기록 ${clues} / ${MIST_NEED}</span><span class="btns"><button class="sm ghost" disabled>?</button></span></div>`
    : r.closed
    ? `<div class="soc-row"><span class="nm"><b>${esc(destName(r.to))}</b></span><span class="muted">아직 뱃길이 열리지 않았다 (준비 중)</span><span class="btns"><button class="sm ghost" disabled>배삯 ◆ ${r.fare}</button></span></div>`
    : `<div class="soc-row on"><span class="nm"><b>${esc(destName(r.to))}</b></span><span class="muted">${esc(r.desc)} · 배 위에서 약 1분</span><span class="btns"><button class="sm" data-route="${i}" ${save.gold >= r.fare ? '' : 'disabled'}>배 타기 · ◆ ${r.fare}</button></span></div>`).join('');
  showModal(`<h2>${esc(P.name)} · ${esc(P.master)}</h2>
    <p>"어디로 가시오? 배삯만 내면 바로 띄우오. 바다에선 무슨 일이 생길지 모르니 각오는 하고."</p>
    ${portGoldRow()}<div class="soc-list">${rows}</div>
    ${save.ship ? `<h4>내 배 「${SHIPS[save.ship.tier].name}」로 출항 <small class="muted">배삯 없이 · 더 빨리</small></h4><div class="soc-list">${Object.keys(PORTS).filter((k) => k !== pid && PORTS[k].routes.length && ((save.visitedPorts || {})[k] || k === 'portS' || k === 'portE') && (k !== 'mist' || clues >= MIST_NEED)).map((k) => `<div class="soc-row on"><span class="nm"><b>${esc(PORTS[k].name)}</b></span><span class="btns"><button class="sm" data-own="${k}">출항</button></span></div>`).join('')}</div>` : ''}
    <p class="muted">배 위에서는 걸어 다니며 선장 · 선원 · 상인 정보원과 이야기할 수 있다. 해적이 올라타면 싸우는 동안 배가 멈춘다.</p>
    <div class="actions"><button data-close class="ghost">돌아간다</button></div>`);
  overlay.querySelectorAll('[data-route]').forEach((b) => (b.onclick = () => {
    const r = P.routes[+b.dataset.route];
    if (save.gold < r.fare) return;
    save.gold -= r.fare;
    overlay.hidden = true; paused = false; modal = null;
    startVoyage(pid, r.to, r);
  }));
  overlay.querySelectorAll('[data-own]').forEach((b) => (b.onclick = () => { overlay.hidden = true; paused = false; modal = null; (save.visitedPorts ||= {})[pid] = true; startVoyage(pid, b.dataset.own, { to: b.dataset.own, time: 12, own: true }); }));
}
function portShowTrade(pid) {
  const P = PORTS[pid];
  const draw = () => {
    rememberPrices(save, pid);
    const rows = Object.keys(P.market).filter((id) => P.market[id] < 1 || (save.bag[id] || 0) > 0 || !CARGO[id].island).map((id) => {
      const have = save.bag[id] || 0, bp = portBuy(save, pid, id), sp = portSell(save, pid, id), local = P.market[id] < 1;
      return `<div class="soc-row ${local ? 'on' : ''}"><span class="nm"><b>${esc(CARGO[id].name)}</b> <small class="muted">${local ? '이 항구 특산품' : P.market[id] >= 1.3 ? '여기서 귀하다' : ''} · 가진 것 ${have}</small></span>
        <span class="btns">${bp != null ? `<button class="sm" data-buy="${id}" data-n="1" ${save.gold >= bp ? '' : 'disabled'}>사기 ◆${bp}</button><button class="sm ghost" data-buy="${id}" data-n="5" ${save.gold >= bp * 5 ? '' : 'disabled'}>5개</button>` : ''}
        <button class="sm ${have ? '' : 'ghost'}" data-sell="${id}" data-n="1" ${have ? '' : 'disabled'}>팔기 ◆${sp}</button><button class="sm ghost" data-sell="${id}" data-n="${have}" ${have > 1 ? '' : 'disabled'}>모두</button></span></div>`;
    }).join('');
    showModal(`<h2>${esc(P.name)} 교역소 · ${esc(P.trader)}</h2>
      <p>"이 항구에서 나는 건 싸게 팔고, 다른 데서 나는 건 비싸게 사 주지. 많이 사 가면 값이 오르고, 많이 팔면 내려가오. 시간이 지나면 제자리로 돌아오고."</p>
      ${portGoldRow()}<div class="soc-list">${rows}</div>
      <p class="muted">몸에 지고 다닐 수 있는 교역품은 ${CARGO_CAP}개까지. 짐수레 · 내 배는 나중에 생긴다.</p>
      <div class="actions"><button data-close class="ghost">돌아간다</button></div>`);
    overlay.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.buy; let n = +b.dataset.n, got = 0;
      while (n-- > 0) {
        const p = portBuy(save, pid, id);
        if (save.gold < p || cargoCount(save.bag) >= cargoCap(save) || !bagAdd(lifeOf(), id, 1)) break;
        save.gold -= p; noteTrade(save, pid, id, 'buy', 1); got++;
      }
      if (!got) renderer.banner = { text: cargoCount(save.bag) >= cargoCap(save) ? '짐이 너무 많다' : '살 수 없다', t: 1.4, color: '#ffb0a0' };
      else sfx('coin', { vol: 0.5 });
      writeSave(save); draw();
    }));
    overlay.querySelectorAll('[data-sell]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.sell; let n = +b.dataset.n, earn = 0;
      while (n-- > 0 && (save.bag[id] || 0) > 0) { const p = portSell(save, pid, id); save.bag[id]--; save.gold += p; earn += p; noteTrade(save, pid, id, 'sell', 1); }
      (save.trade ||= { revenue: 0, joined: false }).revenue += earn;
      if (!save.bag[id]) delete save.bag[id];
      if (earn) { sfx('coin', { vol: 0.6 }); renderer.banner = { text: `◆ ${earn} 받았다`, t: 1.2, color: '#ffd27a' }; }
      writeSave(save); draw();
    }));
  };
  draw();
}
const portAgo = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : `${Math.round(m / 60)}시간 전`; };
function portBoardHtml(pid) {
  const P = PORTS[pid], other = Object.keys(PORTS).filter((k) => k !== pid && PORTS[k].routes.length);
  const seen = save.market?.seen || {};
  const head = `<tr><th>물건</th><th>여기서 사기</th><th>여기서 팔기</th>${other.map((o) => `<th>${esc(PORTS[o].name)}에서 팔기<br><small>${seen[o] ? portAgo(seen[o].t) + ' 본 값' : '모름'}</small></th>`).join('')}</tr>`;
  const rows = Object.keys(P.market).filter((id) => !CARGO[id].island).map((id) => `<tr><td>${esc(CARGO[id].name)}</td><td>${portBuy(save, pid, id) ?? '—'}</td><td>${portSell(save, pid, id) ?? '—'}</td>${other.map((o) => `<td>${seen[o]?.prices?.[id]?.sell ?? '?'}</td>`).join('')}</tr>`).join('');
  return `<table class="price-board">${head}${rows}</table>`;
}
function portShowBoard(pid) {
  rememberPrices(save, pid);
  showModal(`<h2>${esc(PORTS[pid].name)} 시세판</h2><p class="muted">다른 항구 값은 마지막으로 거기 갔을 때 본 값이다. 배 위의 상인 정보원에게 돈을 내면 지금 값을 들을 수 있다.</p>${portBoardHtml(pid)}<div class="actions"><button data-close>닫는다</button></div>`);
}
// ── 항해: 배 갑판 위를 걸어 다니며 간다 (약 1분, 사건이 나면 길어진다) ──
let voyStash = null;
function startVoyage(from, to, route) {
  const ow = world;
  save.zoneMemory ||= {};
  if (ow.zoneId === 'world' || ow.zone?.id === 'world') save.zoneMemory.world = ow.exportMemory();
  if (ISLAND_DEFS[ow.zoneId]) save.zoneMemory[ow.zoneId] = ow.exportMemory();
  save.atIsland = null;
  voyStash = { world: ow, from, to };
  world = new World({ build: buildNow(), mode: 'field', zone: SHIP_ZONE, zoneId: 'ship', seed: (Date.now() % 1e6) | 0, map: buildShipDeck(), story: save.story, codex: save.codex, ...shared() });
  world.player.hp = ow.player.hp; world.player.res = ow.player.res;
  world.loot = ow.loot; world.discovered = ow.discovered; world.codexStart = ow.codexStart;
  world.explored.fill(1);
  const evs = { ...SEA_EVENTS }; if (route.own) evs.merchantShip = { ...SEA_EVENTS.merchantShip, chance: SEA_EVENTS.merchantShip.own };
  world.voyage = { from, to, t: 0, dur: (route.time || 12) * 5 * (route.own ? SHIPS[save.ship.tier].speed : 1), eventAt: 10 + Math.random() * 20, events: evs, rolled: false, extra: 0, own: !!route.own };
  worldExtras(world);
  renderer.setWorld(world);
  renderer.banner = { text: `${destName(to)}(으)로`, sub: '배 위를 걸어 다닐 수 있다 · 선장 · 선원 · 상인 정보원과 이야기해 보자', t: 3.4, color: '#9fd8ff' };
  startMusic('palace');
  sfx('open', { vol: 0.6, rate: 0.7 });
  writeSave(save);
  startLoop();
}
function shipTalk(role) {
  const v = world.voyage, left = Math.max(0, Math.ceil(v.dur - v.t));
  if (role === 'captain') {
    showModal(`<h2>선장</h2><p>"${esc(destName(v.to))}까지 ${v.fighting ? '— 지금은 배가 멈췄소! 갑판의 놈들부터 치워 주시오!' : `대략 ${left}초면 닿겠소.`} ${v.extra > 0 ? `소동 탓에 ${Math.round(v.extra)}초쯤 늦어졌소.` : '바다가 조용하길 빕시다.'}"</p><div class="actions"><button data-close>알겠다</button></div>`);
  } else if (role === 'sailor') {
    const k = Math.random() < 0.4 ? learnNoktWay() : null;
    const r = k ? NOKT_WAYS[k].rumor : SEA_RUMORS[Math.floor(Math.random() * SEA_RUMORS.length)];
    showModal(`<h2>선원</h2><p>"${esc(r)}"</p>${k ? `<p class="muted">새로 안 곳: ${esc(NOKT_WAYS[k].name)}</p>` : ''}<div class="actions"><button data-close>고개를 끄덕인다</button></div>`);
  } else if (role === 'info') {
    const to = v.to, can = PORTS[to];
    showModal(`<h2>상인 정보원</h2><p>"${can ? `${esc(PORTS[to].name)} 시세가 궁금하시오? ◆ 10이면 오늘 아침 소식을 알려 드리지.` : '그 섬 시세는 나도 모르오.'}"</p>${portGoldRow()}
      <div class="actions">${can ? `<button id="buyInfo" ${save.gold >= 10 ? '' : 'disabled'}>◆ 10 내고 듣는다</button>` : ''}<button data-close class="ghost">됐다</button></div>`);
    const b = document.getElementById('buyInfo');
    if (b) b.onclick = () => {
      save.gold -= 10; rememberPrices(save, to); writeSave(save); sfx('coin', { vol: 0.5 });
      showModal(`<h2>${esc(PORTS[to].name)} 시세 (지금)</h2>${portBoardHtml(to)}<div class="actions"><button data-close>고맙소</button></div>`);
    };
  }
}
function showSeaEvent(id) {
  const ev = SEA_EVENTS[id], v = world.voyage;
  showModal(`<h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p><div class="soc-list">${ev.choices.map((c) => `<div class="soc-row"><span class="nm"><b>${esc(c.label)}</b></span><span class="muted">${esc(c.hint)}</span><span class="btns"><button class="sm" data-ch="${c.id}">고른다</button></span></div>`).join('')}</div>`, () => {});
  const done = (msg, color = '#ffe8a8') => { overlay.hidden = true; paused = false; modal = null; v.waiting = false; if (msg) renderer.banner = { text: msg.text, sub: msg.sub, t: 3.4, color }; writeSave(save); };
  overlay.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => {
    const c = b.dataset.ch, lv = save.level || 1;
    if (c === 'fight') { done({ text: id === 'serpent' ? '바다뱀이 갑판으로 기어오른다!' : '해적이 갑판에 올라탔다!', sub: '모두 쓰러뜨려야 배가 다시 나아간다' }, '#ff9a7a'); world.spawnBoarders(id === 'serpent' ? 'serpent' : 'pirates', lv); return; }
    if (c === 'join') { const g = 40 + lv * 3; save.gold += g; repOf().infamy += 8; done({ text: `해적과 함께 승객들의 짐을 털었다 · ◆ ${g}`, sub: `악명 +8 (지금 ${repOf().infamy}) — 언젠가 이 일이 소문날지도 모른다` }, '#ff7a7a'); return; }
    if (c === 'pay') { let lost = 0; for (const k of Object.keys(CARGO)) { const n = save.bag[k] || 0, l = Math.ceil(n / 2); if (l) { save.bag[k] = n - l; lost += l; if (!save.bag[k]) delete save.bag[k]; } } done({ text: lost ? `교역품 ${lost}개를 내주었다` : '내줄 짐이 없다는 걸 알자 해적이 침을 뱉고 떠났다', sub: '해적선이 멀어진다' }); return; }
    if (c === 'raid') { done({ text: '상선에 갈고리를 걸었다!', sub: '호위병을 모두 쓰러뜨리자' }, '#ff9a7a'); world.spawnBoarders('merchant', lv); return; }
    if (c === 'flee') { v.dur += 8; done({ text: '돛을 펴고 멀리 돌아갔다', sub: '뱃길이 8초 길어졌다' }); return; }
    if (c === 'save') {
      repOf().fame += 3; v.dur += 5;
      const gift = ['windWheat', 'woolBale', 'mistSalt', 'driedFish'][Math.floor(Math.random() * 4)];
      const gave = Math.random() < 0.5 && cargoCount(save.bag) + 2 <= CARGO_CAP && bagAdd(lifeOf(), gift, 2);
      if (!gave) save.gold += 25;
      done({ text: '표류자를 건져 올렸다', sub: `명성 +3 · 고맙다며 ${gave ? `${CARGO[gift].name} 2개` : '◆ 25'}를 건넸다` }, '#9fe8b0');
      return;
    }
    done(null);
  }));
}
function voyageResult(s) {
  const lv = save.level || 1;
  if (s.t === 'voyageWon' && s.kind === 'merchant') { const g = 120 + lv * 6; let n = 0; for (let i = 0; i < 6; i++) if (cargoCount(save.bag) < cargoCap(save) && bagAdd(lifeOf(), ['goldSilk', 'redSpice', 'iceCrystal', 'windWheat'][Math.floor(Math.random() * 4)], 1)) n++; polGain({ gold: g, infamy: 10, raid: 1 }); addChronicle(`바다에서 황금 돛 상선이 털렸다 — ${heroName()}`); renderer.banner = { text: `상선을 털었다 · ◆ ${g}`, sub: `교역품 ${n}개 · 악명 +10`, t: 3.6, color: '#ff9a7a' }; writeSave(save); return; }
  if (s.t === 'voyageWon') {
    if (s.kind === 'serpent') { const g = 40 + lv * 3; save.gold += g; repOf().fame += 4; const sc = bagAdd(lifeOf(), 'serpentScale', 2); renderer.banner = { text: `거대 바다뱀을 물리쳤다 · ◆ ${g}`, sub: `명성 +4${sc ? ' · 바다뱀 비늘 2개' : ''} · 배가 다시 나아간다`, t: 3.6, color: '#9fe8b0' }; }
    else { const g = 50 + lv * 4; save.gold += g; repOf().fame += 5; const rum = cargoCount(save.bag) + 2 <= CARGO_CAP && bagAdd(lifeOf(), 'pirateRum', 2); renderer.banner = { text: `해적을 물리쳤다 · ◆ ${g}`, sub: `명성 +5${rum ? ' · 해적 럼주 2병' : ''} · 배가 다시 나아간다`, t: 3.6, color: '#9fe8b0' }; }
  } else {
    if (s.kind === 'serpent') renderer.banner = { text: '바다뱀에게 밀려 쓰러졌다', sub: '선원들이 작살로 쫓아냈다 · 배가 다시 나아간다', t: 3.6, color: '#ffb0a0' };
    else {
      let lost = 0; for (const k of Object.keys(CARGO)) { const n = save.bag[k] || 0, l = Math.ceil(n / 2); if (l) { save.bag[k] = n - l; lost += l; if (!save.bag[k]) delete save.bag[k]; } }
      const g = Math.floor(save.gold * 0.1); save.gold -= g;
      renderer.banner = { text: '해적에게 졌다', sub: `교역품 ${lost}개와 ◆ ${g}를 빼앗겼다 · 해적은 떠났다`, t: 3.8, color: '#ffb0a0' };
    }
  }
  writeSave(save);
}
function arriveVoyage() {
  const ship = world, st = voyStash, P = overworldBase().ports?.[st?.to];
  voyStash = null;
  if (st && PORTS[st.to]?.island) { const took = Math.round(ship.voyage.t + ship.voyage.extra); enterIsland(st.to, { hp: ship.player.hp, res: ship.player.res, loot: ship.loot }); rememberPrices(save, st.to); renderer.banner = { text: `${PORTS[st.to].name}에 닿았다`, sub: `뱃길 ${took}초`, t: 3.4, color: '#9fd8ff' }; return; }
  if (!st || !P) { enterWorld(); return; }
  const took = Math.round(ship.voyage.t + ship.voyage.extra);
  if (PORTS[st.to]?.island) { enterIsland(st.to, { hp: ship.player.hp, res: ship.player.res, loot: ship.loot }); rememberPrices(save, st.to); return; }
  if (!st.world || st.world.zoneId !== 'world') enterWorld({ x: P.arrive.x, y: P.arrive.y - 24 });
  else {
    world = st.world;
    world.player.x = P.arrive.x; world.player.y = P.arrive.y; world.player.dashT = 0;
    world.signals.length = 0; world.events.length = 0;
    world.setBuild(buildNow()); world.applyPersist();
    for (const al of world.allies) { al.x = P.arrive.x + (Math.random() - 0.5) * 30; al.y = P.arrive.y + 10; }
    renderer.setWorld(world);
    startMusic('plaza'); startLoop();
  }
  world.player.hp = Math.min(world.d.maxHp, ship.player.hp); world.player.res = ship.player.res;
  world.reveal(true);
  rememberPrices(save, st.to);
  renderer.banner = { text: `${PORTS[st.to].name}에 닿았다`, sub: `뱃길 ${took}초 · 교역소에서 짐을 팔아 보자`, t: 3.6, color: '#9fd8ff' };
  sfx('open', { vol: 0.6 });
  writeSave(save);
}
function updateVoyBar() {
  let el = document.getElementById('voyBar');
  const v = world?.voyage;
  if (!v || gameEl.hidden) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement('div'); el.id = 'voyBar'; gameEl.appendChild(el); }
  el.hidden = false;
  const k = Math.min(1, v.t / v.dur), txt = v.fighting ? '⚓ 배가 멈췄다 — 갑판의 적을 모두 쓰러뜨리자' : `⛵ ${destName(v.to)}까지 약 ${Math.max(0, Math.ceil(v.dur - v.t))}초`;
  if (el.dataset.txt !== txt) { el.dataset.txt = txt; el.innerHTML = `<span>${esc(txt)}</span><i style="width:${Math.round(k * 100)}%"></i>`; }
  else el.querySelector('i').style.width = `${Math.round(k * 100)}%`;
}

// ═══════ 녹트 하벤 (반란 세력 녹타리스의 지하 도시) ═══════
// 숨은 입구 셋은 처음엔 모른다. 소문꾼 · 배 위 선원 · 녹트 하벤 사람들에게서 들어야 들어갈 수 있다.
const NOKT_WAYS = {
  well: { name: '폐허 도시의 무너진 우물', look: '돌 테두리가 무너진 오래된 우물이다. 밑에서 서늘한 바람과 함께 희미한 횃불 냄새가 올라온다.', rumor: '폐허 도시 한가운데 무너진 우물 말이오, 밧줄을 타고 내려가면 바닥이 아니라 굴이 나온다더군. 밤의 사람들이 드나든다오.' },
  sewer: { name: '왕도 하수구', look: '무너진 왕성 남쪽 들판의 녹슨 하수구 철창. 창살 하나가 유난히 매끈하다. 누군가 자주 열고 닫은 것처럼.', rumor: '왕성 남쪽 하수구 철창, 셋째 창살이 빠진다오. 왕국 수로를 따라가면 녹트 하벤이지. 경비병들 코앞이라 대담한 놈들만 쓰지만.' },
  mine: { name: '황야의 옛 광산', look: '황야 바위에 박힌 버려진 광산 입구. 「위험 · 출입 금지」 팻말 뒤로 새 발자국이 나 있다.', rumor: '황야의 버려진 광산은 진짜로 버려진 게 아니오. 드워프가 파던 갱도가 지하 도시까지 이어져 있지. 안쪽엔 괴물도 산다더군.' },
};
const noktOf = () => (save.nokt ||= { known: {} });
// 아직 모르는 입구 하나를 알려 준다 (없으면 null)
function learnNoktWay() {
  const N = noktOf(), left = Object.keys(NOKT_WAYS).filter((k) => !N.known[k]);
  if (!left.length) return null;
  const k = left[Math.floor(Math.random() * left.length)];
  N.known[k] = true; writeSave(save);
  return k;
}
let noktStash = null;
function noktTalk(id) {
  if (id.startsWith('noktIn_')) {
    const k = id.slice(7), W = NOKT_WAYS[k];
    if (!noktOf().known[k]) { showModal(`<h2>${esc(W.name)}</h2><p>${esc(W.look)}</p><p class="muted">무엇인가 있는 것 같지만, 어떻게 들어가는지 모른다. 소문을 들어 보자.</p><div class="actions"><button data-close>돌아선다</button></div>`); return true; }
    showModal(`<h2>${esc(W.name)}</h2><p>${esc(W.look)}</p><p>소문대로라면 이 아래가 녹트 하벤이다.</p><div class="actions"><button id="noktGo">내려간다</button><button data-close class="ghost">그만둔다</button></div>`);
    document.getElementById('noktGo').onclick = () => { overlay.hidden = true; paused = false; modal = null; enterNokt(k); };
    return true;
  }
  if (id === 'rumor_village') {
    const left = Object.keys(NOKT_WAYS).filter((k) => !noktOf().known[k]);
    showModal(`<h2>뒷골목 소문꾼 테오</h2><p>"정보는 공짜가 아니오. ◆ 15면 쓸 만한 이야기 하나 해 드리지. ${left.length ? '요즘 밤에 사람들이 사라지는 곳들 얘기라든가…' : '…라고 하고 싶은데, 당신은 이미 다 아는 눈치구려.'}"</p>${portGoldRow()}
      <div class="actions"><button id="buyRumor" ${save.gold >= 15 ? '' : 'disabled'}>◆ 15 내고 듣는다</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('buyRumor').onclick = () => {
      save.gold -= 15; sfx('coin', { vol: 0.5 });
      const k = learnNoktWay();
      const text = k ? NOKT_WAYS[k].rumor : SEA_RUMORS[Math.floor(Math.random() * SEA_RUMORS.length)];
      showModal(`<h2>소문</h2><p>"${esc(text)}"</p>${k ? `<p class="muted">새로 안 곳: ${esc(NOKT_WAYS[k].name)} — 지도에서 찾아가 보자</p>` : ''}<div class="actions"><button data-close>고개를 끄덕인다</button></div>`);
      writeSave(save);
    };
    return true;
  }
  if (!id.startsWith('nokt_')) return false;
  const role = id.slice(5);
  const say = (title, text, extra = '') => showModal(`<h2>${esc(title)}</h2><p>"${esc(text)}"</p>${extra}<div class="actions"><button data-close>돌아선다</button></div>`);
  if (role.startsWith('exit_')) { exitNokt(role.slice(5)); return true; }
  if (role === 'broker') {
    const k = learnNoktWay();
    say('중개인 벡', `녹타리스? 그런 이름은 처음 듣는군… 하고 시치미를 떼야 하는데, 여기까지 내려온 걸 보니 눈치는 있는 사람이구려. 아직 당신을 믿을 수는 없소. 밖에서 무슨 일을 하고 다니는지 지켜보겠소.${k ? ` 아, 그리고 — ${NOKT_WAYS[k].rumor}` : ''}`, k ? `<p class="muted">새로 안 곳: ${esc(NOKT_WAYS[k].name)}</p>` : '');
    return true;
  }
  if (role === 'black') { portShowTrade('noktBlack'); return true; }
  if (role === 'rebel1' || role === 'rebel2') {
    const lines = ['카일라 단장님은 옛 기사단장이었소. 왕이 성지 조각을 빼앗아 가는 걸 보다 못해 나오셨지.', '여기선 칼집에서 칼 빼지 마시오. 시비는 투기장에서나 거는 거요.', '동쪽 갱도 깊은 곳에 이상한 표식이 늘고 있소. 교단이라나… 왕국보다 그쪽이 더 무섭소.', '안개 부두에 화약 통을 가져가면 값을 잘 쳐주는 사람이 있소. 경비병만 조심하면.'];
    say('녹타리스 반란군', lines[Math.floor(Math.random() * lines.length)]);
    return true;
  }
  if (role === 'guard') { say('갱도 파수꾼', '이 너머가 깊은 갱도요. 들어갈수록 험하오 — 무너진 갱 Lv 15~22, 버려진 채굴장 Lv 22~30, 맨 안쪽 교단의 흔적은 Lv 32~40. 거기서 나는 소리는 들은 척도 하지 마시오.'); return true; }
  if (role === 'healer') {
    world.player.hp = world.d.maxHp; world.player.st = {};
    save.zoneMemory ||= {}; save.zoneMemory.nokt = world.exportMemory(); writeSave(save);
    say('치료사 엘레', '여긴 다친 반란군이 쉬어 가는 곳이오. 상처는 다 싸맸소. 몸 성히 다니시오.', '<p class="muted">체력을 모두 되찾았다 · 저장했다</p>');
    sfx('levelup', { vol: 0.4 });
    return true;
  }
  if (role === 'forge') {
    const R = repOf(), cost = 15;
    showModal(`<h2>위조꾼 몰</h2><p>"장부에 적힌 이름 한 줄 지우는 데 ◆ ${cost}씩. 소문이란 게 돈 앞에선 금방 잊히거든. 현상금이 붙으면 그것도 여기서 지워 드리지."</p>
      <p class="muted">지금 악명 <b>${R.infamy}</b> · 명성 <b>${R.fame}</b></p>${portGoldRow()}
      <div class="actions"><button id="wipe5" ${R.infamy > 0 && save.gold >= cost * Math.min(5, R.infamy) ? '' : 'disabled'}>악명 5 지우기 · ◆ ${cost * Math.min(5, R.infamy || 5)}</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('wipe5').onclick = () => { const n = Math.min(5, R.infamy); save.gold -= cost * n; R.infamy -= n; writeSave(save); sfx('coin', { vol: 0.5 }); noktTalk('nokt_forge'); };
    return true;
  }
  if (role === 'pit') { showPit(); return true; }
  return false;
}
// 지하 투기장: 돈을 걸고 싸운다. 이기면 건 돈의 두 배, 지면 건 돈을 잃는다 (쓰러지지는 않는다)
const PIT_TIERS = [
  { id: 'low', name: '하급 · 떠돌이 칼잡이', bet: 30, foe: 'bandit', lv: 15, hp: 2.2 },
  { id: 'mid', name: '중급 · 황야의 약탈자', bet: 80, foe: 'orcRaider', lv: 25, hp: 3 },
  { id: 'high', name: '상급 · 도마뱀 투사', bet: 200, foe: 'lizardWarrior', lv: 35, hp: 4 },
];
function showPit() {
  if (world.pit) { showModal('<h2>지하 투기장</h2><p>"싸움 중이오! 구경꾼들이 소리를 지른다."</p><div class="actions"><button data-close>알겠다</button></div>'); return; }
  showModal(`<h2>지하 투기장 · 주인 그롬</h2><p>"돈을 걸고 모래판에 들어가시오. 이기면 두 배, 지면 그 돈은 내 거요. 죽진 않소 — 쓰러지면 끌어내 주지."</p>${portGoldRow()}
    <div class="soc-list">${PIT_TIERS.map((T, i) => `<div class="soc-row"><span class="nm"><b>${esc(T.name)}</b></span><span class="muted">상대 Lv ${T.lv} · 이기면 ◆ ${T.bet * 2}</span><span class="btns"><button class="sm" data-pit="${i}" ${save.gold >= T.bet ? '' : 'disabled'}>◆ ${T.bet} 건다</button></span></div>`).join('')}</div>
    <div class="actions"><button data-close class="ghost">됐다</button></div>`);
  overlay.querySelectorAll('[data-pit]').forEach((b) => (b.onclick = () => {
    const T = PIT_TIERS[+b.dataset.pit];
    if (save.gold < T.bet) return;
    save.gold -= T.bet; writeSave(save);
    overlay.hidden = true; paused = false; modal = null;
    const P = world.map.pit, p = world.player;
    p.x = P.x * TILE + 8 - 40; p.y = P.y * TILE + 8; p.invuln = 1;
    const e = world.makeEnemy(T.foe, P.x * TILE + 8 + 40, P.y * TILE + 8, { noAffix: true });
    world.applyLevel(e, T.lv); e.hp = e.maxHp = Math.round(e.maxHp * T.hp); e.champion = T.name.split('· ')[1];
    e.state = 'chase'; e.home = { x: e.x, y: e.y };
    world.enemies.push(e);
    world.pit = { e, bet: T.bet, tier: T.id };
    renderer.banner = { text: '싸워라!', sub: `${T.name} · 걸린 돈 ◆ ${T.bet}`, t: 2.4, color: '#ff9a7a' };
    sfx('hitHeavy', { vol: 0.8, rate: 0.7 });
  }));
}
function pitResult(s) {
  if (s.tier === 'duel' && duelCb) { const cb = duelCb; duelCb = null; cb(s.t === 'pitWon'); writeSave(save); return; }
  if (s.t === 'pitWon') { save.gold += s.bet * 2; repOf().fame += 1; renderer.banner = { text: `이겼다! ◆ ${s.bet * 2}`, sub: '구경꾼들이 발을 구른다 · 명성 +1', t: 3, color: '#ffd27a' }; sfx('levelup', { vol: 0.6 }); }
  else renderer.banner = { text: '모래판에 쓰러졌다', sub: `건 돈 ◆ ${s.bet}을 잃었다`, t: 3, color: '#ffb0a0' };
  writeSave(save);
}
function enterNokt(way) {
  const ow = world;
  save.zoneMemory ||= {};
  if (ow.zoneId === 'world') save.zoneMemory.world = ow.exportMemory();
  noktStash = { world: ow, way };
  world = new World({ build: buildNow(), mode: 'field', zone: NOKT_ZONE, zoneId: 'nokt', seed: 333, map: buildNoktHaven(), memory: save.zoneMemory.nokt, story: save.story, codex: save.codex, ...shared() });
  const ex = world.map.exits[way];
  world.player.x = ex.x * TILE + 8; world.player.y = ex.y * TILE + 8 + 10;
  world.player.hp = ow.player.hp; world.player.res = ow.player.res;
  world.loot = ow.loot; world.discovered = ow.discovered; world.codexStart = ow.codexStart;
  world.reveal(true);
  renderer.setWorld(world);
  renderer.banner = { text: '녹트 하벤', sub: '밤의 항구 — 반란 세력 녹타리스의 지하 도시', t: 3.6, color: '#c8a0ff' };
  noktOf().visited = true;
  worldExtras(world);
  startMusic('cave'); sfx('drop', { vol: 0.6, rate: 0.7 });
  writeSave(save);
  startLoop();
}
function exitNokt(way) {
  save.zoneMemory ||= {}; save.zoneMemory.nokt = world.exportMemory();
  noktOf().known[way] = true; // 나가 본 길은 안다
  const city = world, st = noktStash; noktStash = null;
  const pos = overworldBase().hidden?.[way];
  const at = pos ? { x: pos.x * TILE + 8, y: pos.y * TILE + 8 } : null;
  if (!st?.world || st.world.zoneId !== 'world') { enterWorld(at ? { x: at.x, y: at.y - 24 + 30 } : null); }
  else {
    world = st.world;
    if (at) { world.player.x = at.x; world.player.y = at.y + 26; }
    world.signals.length = 0; world.events.length = 0;
    world.setBuild(buildNow()); world.applyPersist();
    for (const al of world.allies) { al.x = world.player.x + (Math.random() - 0.5) * 30; al.y = world.player.y + 10; }
    renderer.setWorld(world);
    startMusic('plaza'); startLoop();
  }
  world.player.hp = Math.min(world.d.maxHp, city.player.hp); world.player.res = city.player.res;
  world.reveal(true);
  renderer.banner = { text: NOKT_WAYS[way].name, sub: '땅 위로 나왔다', t: 2.6, color: '#ffe8a8' };
  writeSave(save);
}

// ═══════ 바다 건너 섬 · 황금 돛 연맹(상인 길드 · 경매장 · 조선소 · 내 가게) · 섬의 일 · 성지의 새 시설 ═══════
// 사람 · 물건을 세울 자리: 마른 땅(물 · 건물 칸 아님) · 막히지 않음 · 다른 사람과 겹치지 않음 — 가까운 곳부터 넓혀 가며 찾는다
const freeSpot = (w, x, y) => {
  const dry = (tx, ty) => { const k = Math.floor(ty / TILE) * w.tw + Math.floor(tx / TILE); return w.tiles ? w.tiles[k] === 0 : true; };
  const crowd = (tx, ty) => w.objects.some((o) => o.kind !== 'door' && Math.abs(o.x - tx) < 18 && Math.abs(o.y - ty) < 14);
  for (let r = 0; r < 200; r += 4) for (let a = 0; a < 16; a++) { const tx = x + Math.cos(a / 16 * Math.PI * 2) * r, ty = y + Math.sin(a / 16 * Math.PI * 2) * r; if (!w.blocked(tx, ty, 6) && dry(tx, ty) && dry(tx, ty + 6) && !crowd(tx, ty)) return { x: tx, y: ty, ok: r < 72 }; }
  for (let r = 0; r < 60; r += 4) for (let a = 0; a < 12; a++) { const tx = x + Math.cos(a / 12 * Math.PI * 2) * r, ty = y + Math.sin(a / 12 * Math.PI * 2) * r; if (!w.blocked(tx, ty, 6)) return { x: tx, y: ty }; }
  return { x, y };
};
// 섬마다 따로 벤 나무 기록 (본섬 기록이 지워지지 않게)
function islandLife(id) { const L = lifeOf(); L.chopped = ((save.islandChop ||= {})[id] ||= {}); return L; }
function enterIsland(id, carry = null) {
  save.zoneMemory ||= {};
  world = new World({ build: buildNow(), mode: 'field', zone: islandZone(id), zoneId: id, seed: 700 + id.length * 13, map: islandMap(id), memory: save.zoneMemory[id], story: save.story, codex: save.codex, ...shared(), life: islandLife(id) });
  const m = world.map;
  world.player.x = m.arrive.x; world.player.y = m.arrive.y;
  if (carry) { world.player.hp = Math.min(world.d.maxHp, carry.hp); world.player.res = carry.res; world.loot = carry.loot || world.loot; }
  world.reveal(true);
  save.atIsland = id; (save.visitedPorts ||= {})[id] = true;
  worldExtras(world);
  renderer.setWorld(world);
  const D = ISLAND_DEFS[id];
  renderer.banner = { text: D.name, sub: `${D.nation} · ${D.mood} · 권장 Lv ${D.lv[0]}~${D.lv[1]}`, t: 4, color: '#9fd8ff' };
  startMusic(id === 'frost' ? 'frost' : id === 'sand' ? 'rift' : id === 'mist' ? 'cave' : 'plaza'); startLoop();
  writeSave(save);
}
// 세계에 들어갈 때마다 붙이는 것: 이름 위 지위 · 탈것 · 아기 용 · 연대기 비석 · 고위 관계자 · 성지의 새 시설
function worldExtras(w) {
  w.title = titleOf(save); lastTitle = w.title.text;
  w.mountKind = save.mount ? 'raptor' : null;
  if (save.whelp && !w.allies.some((a) => a.whelp)) w.allies.push({ id: w.nextId++, kind: 'spirit', elem: 'fire', whelp: true, x: w.player.x + 12, y: w.player.y - 10, t: 1e9, max: 1e9, atk: w.skillAtk('best') * 0.35, cd: 1, phase: 0, dir: 1 });
  if (w.zoneId === 'world') {
    const ow = overworldBase(), kd = ow.villages?.knight?.door || (ow.sanctums?.knight && { x: ow.sanctums.knight.x * TILE + 8, y: ow.sanctums.knight.y * TILE + 8 });
    if (kd) {
      const put = (o, dx, dy) => { const s = freeSpot(w, kd.x + dx * TILE, kd.y + dy * TILE); w.objects.push({ ...o, x: s.x, y: s.y, reusable: true }); };
      put({ kind: 'npc', id: 'pol_recruiter', art: 'recruiter', label: '아우렐리온 모병관과 이야기 · 입단' }, -15, 2);
      put({ kind: 'chronicle', id: 'chronicle', label: '연대기 비석 읽기' }, 15, 2);
      for (const id of Object.keys(OFFICIALS)) { const O = OFFICIALS[id]; if (O.where !== 'castle') continue; const now = officialNow(save, id); if (now) put({ kind: 'npc', id: 'official_' + id, art: O.king ? 'king' : id, label: `${O.title} ${now.name}${now.gen > 1 ? ` (${now.gen}대째)` : ''}` }, O.at[0], O.at[1] + 8); }
    }
    // 성지마다 숙소(부활 지점) · 종족 대장간 · 고유 콘텐츠
    for (const [race, v] of Object.entries(ow.villages || {})) {
      const d = v.door; if (!d) continue;
      // 문 앞이 바다 · 호수면 반대쪽 · 옆쪽으로 (바닷가 성지에서 사람이 물 위에 서지 않게)
      const put = (o, dx, dy) => {
        let s = null;
        for (const [a, b] of [[dx, dy], [dx, -dy], [dy, dx], [-dy, -dx]]) { const c = freeSpot(w, d.x + a * TILE, d.y + b * TILE); if (c.ok) { s = c; break; } }
        if (!s) { // 네 방향 다 물이면: 문 둘레 마른 땅 중 원래 자리에 가장 가까운 곳
          const tx0 = d.x + dx * TILE, ty0 = d.y + dy * TILE; let bd = 1e9;
          for (let y = -18; y <= 18; y++) for (let x = -18; x <= 18; x++) {
            const px = d.x + x * TILE, py = d.y + y * TILE, k = Math.floor(py / TILE) * w.tw + Math.floor(px / TILE);
            if (w.tiles[k] !== 0 || w.blocked(px, py, 6) || w.objects.some((q) => Math.abs(q.x - px) < 18 && Math.abs(q.y - py) < 14)) continue;
            const dd = Math.hypot(px - tx0, py - ty0); if (dd < bd) { bd = dd; s = { x: px, y: py }; }
          }
          s ||= freeSpot(w, tx0, ty0);
        }
        w.objects.push({ ...o, x: s.x, y: s.y, reusable: true });
      };
      put({ kind: 'npc', id: 'sanct_inn_' + race, art: 'innkeeper', label: `${SANCTUMS[race].name} 숙소 · 쉬기 · 부활 지점` }, -9, 14);
      put({ kind: 'npc', id: 'sanct_forge_' + race, art: 'smith', label: `${SANCTUMS[race].name} 종족 대장간` }, 9, 14);
      put({ kind: 'npc', id: 'sanct_uniq_' + race, art: UNIQ[race].art, label: UNIQ[race].label }, 0, 17);
      if (race === 'dragon') put({ kind: 'npc', id: 'sanct_egg_dragon', art: 'dragonElder', label: '용알 부화장 · 작은 용 동료' }, 6, 19);
    }
    if (save.respawnAt && w.respawnPending) { const v = ow.villages?.[save.respawnAt]; if (v?.door) { const s = freeSpot(w, v.door.x - 9 * TILE, v.door.y + 16 * TILE); w.player.x = s.x; w.player.y = s.y; w.reveal(true); } }
  }
  if (w.zoneId === 'nokt') {
    const put = (o, tx, ty) => { const s = freeSpot(w, tx * TILE + 8, ty * TILE + 8); w.objects.push({ ...o, x: s.x, y: s.y, reusable: true }); };
    put({ kind: 'chronicle', id: 'chronicle', label: '연대기 비석 읽기' }, 56, 46);
    for (const id of Object.keys(OFFICIALS)) { const O = OFFICIALS[id]; if (O.where !== 'nokt') continue; const now = officialNow(save, id); if (now) put({ kind: 'npc', id: 'official_' + id, art: O.king ? 'kaila' : id, label: `${O.title} ${now.name}${now.gen > 1 ? ` (${now.gen}대째)` : ''}` }, O.at[0], O.at[1]); }
  }
  // 비밀 의뢰 표적 · 용병 의뢰 대상이 이 세계에 있으면 세운다
  const C = save.contract;
  if (C && !C.done && C.zone === w.zoneId) {
    const [e] = w.spawnGroup([[C.foe, 1, null]], C.x, C.y, C.lv, { idle: true });
    e.champion = C.name; e.contract = true; e.hp = e.maxHp = e.maxHp * 4;
    w.track = { x: C.x, y: C.y, name: C.name };
  }
}
let lastTitle = null;

// ── 일반 결투 (모래판 · 창 시합 · 투기 대회): 쓰러지지 않고 진다 ──
let duelCb = null;
function startDuel({ foe, lv, hp = 3, name, at, onEnd }) {
  const p = world.player, c = at || { x: p.x + 50, y: p.y };
  const e = world.makeEnemy(foe, c.x, c.y, { noAffix: true });
  world.applyLevel(e, lv); e.hp = e.maxHp = Math.round(e.maxHp * hp); e.champion = name; e.state = 'chase'; e.home = { x: c.x, y: c.y };
  world.enemies.push(e); world.pit = { e, bet: 0, tier: 'duel' }; duelCb = onEnd;
  renderer.banner = { text: '결투!', sub: name, t: 2.2, color: '#ff9a7a' }; sfx('hitHeavy', { vol: 0.8, rate: 0.7 });
}
// ── 처치 의뢰 (용병 · 유령 · 현상금 · 교단): 받은 뒤 그 몬스터를 n마리 ──
const killsOf = (types) => types.reduce((s, t) => s + (save.codex?.kills?.[t] || 0), 0);
function killQuest(key, def) { // def: { types, n, title, reward:{gold, fame, infamy, cult, aff} }
  const Q = (save.kq ||= {}), q = Q[key];
  if (q) {
    const got = killsOf(q.types) - q.base;
    if (got >= q.n) {
      delete Q[key]; save.gold += q.reward.gold || 0; const R = repOf(); R.fame += q.reward.fame || 0; R.infamy += q.reward.infamy || 0; if (q.reward.cult) polOf().cult += q.reward.cult;
      writeSave(save); sfx('levelup', { vol: 0.6 });
      return `<p><b>의뢰 완료: ${esc(q.title)}</b> — ◆ ${q.reward.gold || 0}${q.reward.fame ? ` · 명성 +${q.reward.fame}` : ''}${q.reward.infamy ? ` · 악명 +${q.reward.infamy}` : ''}</p>`;
    }
    return `<p class="muted">맡은 의뢰: ${esc(q.title)} — ${Math.max(0, got)} / ${q.n}</p>`;
  }
  return null;
}
const takeQuest = (key, def) => { (save.kq ||= {})[key] = { ...def, base: killsOf(def.types) }; writeSave(save); };
const questBtn = (key, def) => `<button id="kq_${key}">받는다: ${esc(def.title)} (${def.n}마리 · ◆ ${def.reward.gold})</button>`;
function bindQuest(key, def, after) { const b = document.getElementById('kq_' + key); if (b) b.onclick = () => { takeQuest(key, def); renderer.banner = { text: '의뢰를 받았다', sub: def.title, t: 2.4, color: '#ffe8a8' }; after?.(); }; }

// ── 성지 고유 콘텐츠 ──
const UNIQ = {
  wizard: { art: 'altar', label: '주문 연구실 · 주문서 만들기' }, elf: { art: 'library', label: '정령 교감소 · 정령석 바꾸기' },
  knight: { art: 'trainer', label: '마상 창 시합장 · 기사 서임식' }, orc: { art: 'pitBoss', label: '투기 대회 등급전' },
  undead: { art: 'healer', label: '강령 의식 · 떠도는 영혼의 사연' }, assassin: { art: 'broker', label: '그림자 길드 · 비밀 의뢰' },
  dino: { art: 'dinoTamer', label: '공룡 길들이기 · 탈것' }, dragon: { art: 'res_dragon_0', label: '용족 대장장이 카스 · 각인 강화' },
};
function sanctTalk(id) {
  const [, kind, race] = id.split('_');
  const own = save.race === race, S = SANCTUMS[race];
  const done = (msg) => { renderer.banner = { text: msg, t: 2.6, color: '#ffe8a8' }; writeSave(save); };
  if (kind === 'inn') {
    const cost = own ? 0 : 20;
    showModal(`<h2>${esc(S.name)} 숙소</h2><p>"쉬어 가시오. 여기서 묵으면 쓰러져도 이 숙소에서 깨어나게 해 드리지."</p><p class="muted">${own ? '같은 종족은 공짜' : `하룻밤 ◆ ${cost}`}${save.respawnAt === race ? ' · 지금 이곳이 부활 지점' : ''}</p>${portGoldRow()}<div class="actions"><button id="innRest" ${save.gold >= cost ? '' : 'disabled'}>묵는다</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('innRest').onclick = () => { save.gold -= cost; save.respawnAt = race; world.player.hp = world.d.maxHp; save.zoneMemory.world = world.exportMemory(); overlay.hidden = true; paused = false; modal = null; done(`${S.name} 숙소에서 쉬었다 · 부활 지점이 되었다`); sfx('levelup', { vol: 0.4 }); };
    return;
  }
  if (kind === 'forge') { openPanel('shop', true); return; }
  // 고유
  if (race === 'wizard') {
    const cost = own ? 20 : 40;
    showModal(`<h2>마탑 주문 연구실</h2><p>"마력 수정 하나와 연구비면 주문서 한 장을 써 주지. 한 번 쓰면 사라지는 강한 마법이야."</p><p class="muted">마력 수정 ${save.bag.manaCrystal || 0}개 · 연구비 ◆ ${cost}${own ? ' (마법사 할인)' : ''}</p>${portGoldRow()}
      <div class="soc-list">${SCROLL_SHOP.map((sid) => `<div class="soc-row"><span class="nm"><b>${esc(GOODS[sid].name)}</b></span><span class="muted">${esc(GOODS[sid].desc)}</span><span class="btns"><button class="sm" data-scroll="${sid}" ${(save.bag.manaCrystal || 0) >= 1 && save.gold >= cost ? '' : 'disabled'}>만든다</button></span></div>`).join('')}</div><div class="actions"><button data-close class="ghost">됐다</button></div>`);
    overlay.querySelectorAll('[data-scroll]').forEach((b) => (b.onclick = () => { if (!bagAdd(lifeOf(), b.dataset.scroll, 1)) return; save.bag.manaCrystal--; if (!save.bag.manaCrystal) delete save.bag.manaCrystal; save.gold -= cost; sfx('reaction', { vol: 0.5 }); writeSave(save); sanctTalk(id); }));
    return;
  }
  if (race === 'elf') {
    const need = own ? 6 : 8, day = new Date().toDateString(), E = (save.elfDew ||= {}); if (E.day !== day) { E.day = day; E.n = 0; }
    showModal(`<h2>세계수 정령 교감소</h2><p>"정령들은 약초 향을 좋아해요. 약초 ${need}포기를 바치면 정령석 하나를 내어 준답니다. 하루 두 번까지요."</p><p class="muted">약초 ${save.bag.herb || 0}개 · 오늘 ${E.n}/2</p><div class="actions"><button id="dew" ${(save.bag.herb || 0) >= need && E.n < 2 ? '' : 'disabled'}>약초 ${need}포기를 바친다</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('dew').onclick = () => { if (!bagAdd(lifeOf(), 'spiritStone', 1)) return; save.bag.herb -= need; if (!save.bag.herb) delete save.bag.herb; E.n++; sfx('reaction', { vol: 0.5 }); done('정령석 하나를 받았다'); sanctTalk(id); };
    return;
  }
  if (race === 'knight') {
    const P = polOf(), dub = P.faction === 'aurelion' && P.rank >= 2 && !P.dubbed;
    showModal(`<h2>마상 창 시합장</h2><p>"말 위에서 창을 겨루는 오래된 시합이오. 이기면 상금과 명예를!"${dub ? ' 그리고… 당신은 서임식을 받을 자격이 있구려.' : ''}</p>
      <div class="actions"><button id="joust">시합에 나간다 (상대 Lv ${Math.max(10, save.level)})</button>${dub ? '<button id="dubbing">기사 서임식을 받는다</button>' : ''}<button data-close class="ghost">됐다</button></div>`);
    document.getElementById('joust').onclick = () => { overlay.hidden = true; paused = false; modal = null; startDuel({ foe: 'royalGuard', lv: Math.max(10, save.level), hp: 4, name: '창 시합 기사', onEnd: (win) => { if (win) { const g = 60 + save.level * 4; save.gold += g; repOf().fame += 2; if (P.faction === 'aurelion') P.merit += 15; done(`창 시합에서 이겼다 · ◆ ${g}`); } else done('말에서 떨어졌다'); } }); };
    if (dub) document.getElementById('dubbing').onclick = () => { P.dubbed = true; P.merit += 50; addChronicle(`${heroName()}이(가) 왕성에서 기사 서임식을 받았다`); overlay.hidden = true; paused = false; modal = null; done('기사로 서임되었다 · 공훈 +50'); };
    return;
  }
  if (race === 'orc') {
    const A = (save.arena ||= { pts: 0, week: 0 }), wk = Math.floor(Date.now() / 6048e5); if (A.week !== wk) { A.week = wk; A.pts = 0; }
    const tierName = A.pts >= 300 ? '전설' : A.pts >= 150 ? '금' : A.pts >= 60 ? '은' : '동';
    showModal(`<h2>황야 투기 대회 · 이번 주 등급전</h2><p>"싸우고, 이기고, 점수를 쌓아라! 주마다 처음부터다."</p><p class="muted">이번 주 점수 <b>${A.pts}</b> · 등급 <b>${tierName}</b></p>
      <div class="actions"><button id="arenaFight">다음 상대 (Lv ${15 + Math.floor(A.pts / 10)})</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('arenaFight').onclick = () => { overlay.hidden = true; paused = false; modal = null; const lv = 15 + Math.floor(A.pts / 10); startDuel({ foe: ['orcRaider', 'lizardWarrior', 'bandit', 'swampTroll'][A.pts % 4], lv, hp: 3, name: `${tierName} 등급 도전자`, onEnd: (win) => { if (win) { A.pts += 20; save.gold += 40 + lv * 2; done(`이겼다! 등급전 점수 +20 (${A.pts})`); } else { A.pts = Math.max(0, A.pts - 10); done('졌다 · 점수 -10'); } } }); };
    return;
  }
  if (race === 'undead') {
    const def = { types: ['wraith', 'shadeWraith', 'ghoul', 'skeleton'], n: 10, title: '떠도는 영혼을 괴롭히는 것들', reward: { gold: 180, fame: 3 } };
    const st = killQuest('ghost', def);
    showModal(`<h2>강령 의식</h2><p>"떠도는 영혼 하나가 묘지를 떠나지 못하고 있소. 그를 괴롭히던 망령 · 그림자 · 구울 · 해골을 쓰러뜨려 주면 편히 잠들 수 있을 거요."</p>${st || ''}<div class="actions">${st ? '' : questBtn('ghost', def)}<button data-close class="ghost">돌아선다</button></div>`);
    bindQuest('ghost', def, () => { overlay.hidden = true; paused = false; modal = null; });
    return;
  }
  if (race === 'assassin') {
    const C = save.contract;
    if (C && !C.done) { showModal(`<h2>그림자 길드 · 비밀 의뢰</h2><p>"표적은 아직 살아 있다. ${esc(C.name)} — ${esc(C.where)}. 화살표를 따라가라."</p><div class="actions"><button id="dropC" class="ghost">의뢰를 포기한다</button><button data-close>알겠다</button></div>`); document.getElementById('dropC').onclick = () => { save.contract = null; world.track = null; writeSave(save); overlay.hidden = true; paused = false; modal = null; }; return; }
    showModal(`<h2>그림자 길드 · 비밀 의뢰</h2><p>"무소속 일감이 하나 있다. 섬 어딘가 숨어 있는 현상금 붙은 도적 두목. 죽여서 오면 넉넉히 주지. 왕국은 모르는 일이다."</p><div class="actions"><button id="takeC">받는다 (◆ ${150 + save.level * 6})</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('takeC').onclick = () => {
      const ow = overworldBase(), regs = ow.regionInfo.filter((r) => r.lv && r.lv[0] <= save.level + 5), r = regs[Math.floor(Math.random() * regs.length)] || ow.regionInfo[0];
      const s = freeSpot(world, r.x * TILE + 8 || world.player.x + 300, r.y * TILE + 8 || world.player.y);
      save.contract = { zone: 'world', x: s.x, y: s.y, foe: 'bandit', lv: Math.max(5, save.level + 2), name: `현상금 표적 「${['붉은 손', '외눈 그락', '독사 벨', '칼날 미르'][Math.floor(Math.random() * 4)]}」`, where: r.name, reward: 150 + save.level * 6 };
      writeSave(save); overlay.hidden = true; paused = false; modal = null;
      const [e] = world.spawnGroup([[save.contract.foe, 1, null]], s.x, s.y, save.contract.lv, { idle: true }); e.champion = save.contract.name; e.contract = true; e.hp = e.maxHp = e.maxHp * 4;
      world.track = { x: s.x, y: s.y, name: save.contract.name };
      done(`표적: ${save.contract.name} · ${r.name}`);
    };
    return;
  }
  if (race === 'dino') {
    const need = own ? 6 : 10;
    if (save.mount) { showModal(`<h2>공룡 길들이기</h2><p>"네 랩터는 잘 지내지? 등에 올라타면 바람처럼 달린다."</p><p class="muted">탈것: 길들인 랩터 — V(모바일 「탈것」)로 올라타면 1.75배 빠르게 달리고, 대시는 멀리 뛰어오른다. 공격하거나 세게 맞으면 내린다.</p><div class="actions"><button data-close>고맙다</button></div>`); return; }
    showModal(`<h2>공룡 길들이기</h2><p>"새끼 랩터 한 마리가 사람을 잘 따른다. 짐승 고기 ${need}덩이로 배를 채워 주면 너를 태워 줄 거다."</p><p class="muted">짐승 고기 ${save.bag.beastMeat || 0}개</p><div class="actions"><button id="tame" ${(save.bag.beastMeat || 0) >= need ? '' : 'disabled'}>고기를 준다</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('tame').onclick = () => { save.bag.beastMeat -= need; if (!save.bag.beastMeat) delete save.bag.beastMeat; save.mount = true; world.mountKind = 'raptor'; overlay.hidden = true; paused = false; modal = null; done('랩터를 길들였다 · V(모바일은 「탈것」 버튼)로 타고 내린다'); };
    return;
  }
  if (race === 'dragon' && kind === 'uniq') { // 각인 강화: 용암 화로에 각인을 다시 달군다
    const owned = Object.keys(save.owned || {}).filter((k) => save.owned[k] > 0 && ENGRAVINGS[k]);
    const L = (save.engLv ||= {}), disc = own ? 0.7 : 1;
    const cost = (lv) => ({ gold: Math.round(150 * (lv + 1) * (lv + 1) * disc), obsidian: lv + 1, fireBloom: lv });
    const rows = owned.map((k) => { const lv = L[k] || 0, c = cost(lv), can = lv < ENG_MAX && save.gold >= c.gold && (save.bag.obsidian || 0) >= c.obsidian && (save.bag.fireBloom || 0) >= c.fireBloom;
      return `<div class="soc-row ${lv ? 'on' : ''}"><span class="nm"><b>${esc(ENGRAVINGS[k].name)}</b> <small class="muted">+${lv} / ${ENG_MAX} · 수치 +${Math.round(lv * ENG_STEP * 100)}%</small></span><span class="muted">${lv >= ENG_MAX ? '가장 높은 단계' : `◆ ${c.gold} · 흑요석 ${c.obsidian}${c.fireBloom ? ` · 불꽃 꽃 ${c.fireBloom}` : ''}`}</span><span class="btns">${lv < ENG_MAX ? `<button class="sm" data-elv="${k}" ${can ? '' : 'disabled'}>+${lv + 1}로 강화</button>` : ''}</span></div>`; }).join('');
    showModal(`<h2>용족 대장장이 카스 · 각인 강화</h2><p>"용암 화로에 각인을 다시 달구면 문양이 깊어진다. 단계마다 각인의 능력치와 효과가 12%씩 강해지지. 흑요석과 불꽃 꽃을 가져와라."${own ? ' (용족은 30% 싸게)' : ''}</p>${portGoldRow()}<p class="muted">흑요석 ${save.bag.obsidian || 0} · 불꽃 꽃 ${save.bag.fireBloom || 0}</p>
      <div class="soc-list">${rows || '<p class="muted">새긴 각인이 없다. 공명 제단에서 먼저 새기자.</p>'}</div><div class="actions"><button data-close class="ghost">돌아간다</button></div>`);
    overlay.querySelectorAll('[data-elv]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.elv, lv = L[k] || 0, c = cost(lv);
      save.gold -= c.gold; save.bag.obsidian -= c.obsidian; if (!save.bag.obsidian) delete save.bag.obsidian; if (c.fireBloom) { save.bag.fireBloom -= c.fireBloom; if (!save.bag.fireBloom) delete save.bag.fireBloom; }
      L[k] = lv + 1; world.setBuild(buildNow()); writeSave(save); sfx('reaction', { vol: 0.7, rate: 0.8 });
      renderer.banner = { text: `${ENGRAVINGS[k].name} +${lv + 1}`, sub: `각인 수치 +${Math.round((lv + 1) * ENG_STEP * 100)}%`, t: 2.8, color: '#ff9a3a' };
      if (lv + 1 === ENG_MAX) addChronicle(`${heroName()}이(가) 용의 둥지에서 「${ENGRAVINGS[k].name}」을(를) 끝까지 달궜다`);
      sanctTalk(id);
    }));
    return;
  }
  if (race === 'dragon') {
    const cost = own ? 250 : 400, EG = save.egg;
    if (save.whelp) { showModal('<h2>용알 부화장</h2><p>"네 작은 용이 무럭무럭 자라는구나. 불을 뿜어 너를 돕겠지."</p><div class="actions"><button data-close>고맙다</button></div>'); return; }
    if (EG) {
      const left = Math.max(0, EG.t + 20 * 60e3 - Date.now());
      if (!left) { save.whelp = true; save.egg = null; overlay.hidden = true; paused = false; modal = null; worldExtras(world); done('알이 깨어났다! 작은 용이 너를 따른다'); addChronicle(`${heroName()}의 용알에서 작은 용이 깨어났다`); return; }
      showModal(`<h2>용알 부화장</h2><p>"용암에 데워지는 중이다. 서두르지 마라."</p><p class="muted">깨어나기까지 약 ${Math.ceil(left / 60000)}분</p><div class="actions"><button data-close>기다린다</button></div>`); return;
    }
    showModal(`<h2>용알 부화장</h2><p>"주인 잃은 용알이 하나 있다. ◆ ${cost}와 불꽃 꽃 3송이를 바치면 너에게 맡기지. 20분쯤 데우면 깨어난다."</p><p class="muted">불꽃 꽃 ${save.bag.fireBloom || 0}송이</p>${portGoldRow()}<div class="actions"><button id="egg" ${save.gold >= cost && (save.bag.fireBloom || 0) >= 3 ? '' : 'disabled'}>알을 맡는다</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('egg').onclick = () => { save.gold -= cost; save.bag.fireBloom -= 3; if (!save.bag.fireBloom) delete save.bag.fireBloom; save.egg = { t: Date.now() }; overlay.hidden = true; paused = false; modal = null; done('용알을 맡았다 · 20분 뒤 다시 오자'); };
  }
}

// ── 황금 돛 섬: 상인 길드 · 납품 계약 · 경매장 · 조선소 · 내 가게 ──
const tradeOf = () => (save.trade ||= { revenue: 0, joined: false });
function guildTalk() {
  const T = tradeOf(), r = guildRank(save);
  if (!T.joined) {
    showModal(`<h2>황금 돛 상인 길드 · 길드장 벨루아</h2><p>"황금 돛 연맹은 깃발을 묻지 않아요. 아우렐리온이든 녹타리스든 은화는 은화죠. 가입비 ◆ 100이면 행상 패를 드리죠. 교역으로 번 만큼 계급이 오르고, 오를수록 교역소에서 더 받아요."</p>${portGoldRow()}<div class="actions"><button id="gjoin" ${save.gold >= 100 ? '' : 'disabled'}>가입한다 (◆ 100)</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('gjoin').onclick = () => { save.gold -= 100; T.joined = true; writeSave(save); sfx('levelup', { vol: 0.5 }); guildTalk(); };
    return;
  }
  const next = GUILD_RANKS[r + 1], C = T.contract;
  let ctext = '';
  if (C) {
    const have = save.bag[C.good] || 0, left = C.until - Date.now();
    if (left <= 0) { T.contract = null; ctext = '<p class="muted">납품 계약 기한이 지나 계약이 깨졌다.</p>'; }
    else ctext = `<p><b>납품 계약</b>: ${esc(CARGO[C.good].name)} ${C.n}개 · 가진 것 ${have} · 남은 시간 ${Math.ceil(left / 3600e3)}시간 · 보수 ◆ ${C.pay}</p>${have >= C.n ? '<button id="cdeliver">납품한다</button>' : ''}`;
  }
  showModal(`<h2>황금 돛 상인 길드</h2><p class="muted">계급 <b>${GUILD_RANKS[r].name}</b> · 교역으로 번 돈 ◆ ${T.revenue}${next ? ` · 다음 「${next.name}」까지 ◆ ${next.need - T.revenue}` : ' · 가장 높은 계급'} · 교역소에서 더 받는 몫 +${Math.round(GUILD_RANKS[r].bonus * 100)}%</p>
    <p class="muted">상인부터 경매장 · 대상인부터 내 가게를 쓸 수 있다.</p>${ctext}
    <div class="actions">${!T.contract ? '<button id="cnew">납품 계약을 받는다</button>' : ''}<button data-close class="ghost">돌아간다</button></div>`);
  const nb = document.getElementById('cnew');
  if (nb) nb.onclick = () => { const goods = ['iceCrystal', 'redSpice', 'pirateRum', 'windWheat', 'mistSalt', 'woolBale'], g = goods[Math.floor(Math.random() * goods.length)], n = 8 + Math.floor(Math.random() * 10); T.contract = { good: g, n, until: Date.now() + 48 * 3600e3, pay: Math.round(CARGO[g].price * n * 1.7) }; writeSave(save); guildTalk(); };
  const db = document.getElementById('cdeliver');
  if (db) db.onclick = () => { save.bag[C.good] -= C.n; if (!save.bag[C.good]) delete save.bag[C.good]; save.gold += C.pay; T.revenue += C.pay; T.contract = null; writeSave(save); sfx('coin', { vol: 0.7 }); renderer.banner = { text: `납품 완료 · ◆ ${C.pay}`, t: 2.4, color: '#ffd27a' }; guildTalk(); };
}
const AUCTION_POOL = ['ruby', 'sapphire', 'emerald', 'pearl', 'serpentScale', 'spiritStone', 'truffle', 'obsidian', 'manaCrystal'];
function auctionState() {
  const A = (save.auction ||= { lots: [], sales: [], t: 0 }), now = Date.now();
  // 끝난 경매 정리
  const msgs = [];
  for (const L of A.lots) if (L.ends <= now && !L.closed) {
    L.closed = true;
    if (L.lead === 'me') { if (save.gold >= L.price && bagAdd(lifeOf(), L.good, L.n)) { save.gold -= L.price; msgs.push(`낙찰: ${GOODS[L.good].name} ×${L.n} (◆ ${L.price})`); } else msgs.push(`낙찰했지만 돈 · 가방이 모자라 무효: ${GOODS[L.good].name}`); }
  }
  for (const S of A.sales) if (S.ends <= now && !S.done) { S.done = true; const p = Math.round(GOODS[S.good].price * S.n * (0.9 + Math.random() * 0.8)); if (p >= S.min) { save.gold += p; tradeOf().revenue += p; msgs.push(`팔림: ${GOODS[S.good].name} ×${S.n} → ◆ ${p}`); } else { bagAdd(lifeOf(), S.good, S.n); msgs.push(`안 팔려서 돌아왔다: ${GOODS[S.good].name}`); } }
  A.lots = A.lots.filter((L) => !L.closed); A.sales = A.sales.filter((S) => !S.done);
  while (A.lots.length < 3) { const g = AUCTION_POOL[Math.floor(Math.random() * AUCTION_POOL.length)], n = 1 + Math.floor(Math.random() * 3), base = GOODS[g].price * n; A.lots.push({ good: g, n, price: Math.round(base * 0.6), rival: Math.round(base * (1.0 + Math.random() * 0.7)), lead: 'rival', ends: now + (8 + Math.random() * 8) * 60e3 }); }
  return msgs;
}
function auctionTalk() {
  if (guildRank(save) < 1) { showModal('<h2>황금 돛 경매장 · 경매사 오토</h2><p>"경매장은 길드 「상인」부터요. 상인 길드에서 계급을 올려 오시오."</p><div class="actions"><button data-close>알겠다</button></div>'); return; }
  const msgs = auctionState(), A = save.auction, now = Date.now();
  const lots = A.lots.map((L, i) => `<div class="soc-row ${L.lead === 'me' ? 'on' : ''}"><span class="nm"><b>${esc(GOODS[L.good].name)} ×${L.n}</b> <small class="muted">${L.lead === 'me' ? '내가 최고가' : '다른 사람이 최고가'} · ${Math.ceil((L.ends - now) / 60000)}분 남음</small></span><span class="btns"><button class="sm" data-bid="${i}" ${save.gold >= Math.ceil(L.price * 1.1) ? '' : 'disabled'}>◆ ${Math.ceil(L.price * 1.1)} 부른다</button></span></div>`).join('');
  const sellable = Object.entries(save.bag).filter(([id, n]) => n > 0 && GOODS[id] && GOODS[id].cat !== 'cargo' && GOODS[id].price >= 20).slice(0, 12);
  showModal(`<h2>황금 돛 경매장</h2>${msgs.map((m) => `<p><b>${esc(m)}</b></p>`).join('')}<p class="muted">경매가 끝날 때 최고가를 부른 사람이 가져간다. 다른 상인들도 값을 올린다. 끝난 뒤 여기 다시 오면 정산된다.</p>
    <h4>지금 경매 중</h4><div class="soc-list">${lots}</div>
    <h4>내 물건 내놓기 <small class="muted">10분 뒤 시세의 0.9~1.7배 사이로 팔린다 (최저가 아래면 돌아온다)</small></h4>
    <div class="soc-list">${A.sales.map((S) => `<div class="soc-row"><span class="nm">${esc(GOODS[S.good].name)} ×${S.n}</span><span class="muted">${Math.ceil((S.ends - now) / 60000)}분 남음</span></div>`).join('')}${sellable.map(([id, n]) => `<div class="soc-row"><span class="nm">${esc(GOODS[id].name)} <small class="muted">${n}개 · 시세 ◆ ${GOODS[id].price}</small></span><span class="btns"><button class="sm ghost" data-list="${id}">1개 내놓기</button></span></div>`).join('')}</div>
    <div class="actions"><button data-close class="ghost">돌아간다</button></div>`);
  writeSave(save);
  overlay.querySelectorAll('[data-bid]').forEach((b) => (b.onclick = () => { const L = A.lots[+b.dataset.bid]; const bid = Math.ceil(L.price * 1.1); if (bid > L.rival) { L.price = bid; L.lead = 'me'; } else { L.price = Math.min(L.rival, Math.ceil(bid * 1.08)); L.lead = 'rival'; renderer.banner = { text: '누군가 더 높게 불렀다', t: 1.4, color: '#ffb0a0' }; } writeSave(save); auctionTalk(); }));
  overlay.querySelectorAll('[data-list]').forEach((b) => (b.onclick = () => { const id = b.dataset.list; save.bag[id]--; if (!save.bag[id]) delete save.bag[id]; A.sales.push({ good: id, n: 1, min: Math.round(GOODS[id].price * 0.8), ends: Date.now() + 10 * 60e3 }); writeSave(save); auctionTalk(); }));
}
function yardTalk() {
  const r = guildRank(save), cur = save.ship ? save.ship.tier : -1;
  const rows = SHIPS.map((S, i) => { const need = i === 0 ? 0 : i === 1 ? 1 : 2, owned = cur >= i; return `<div class="soc-row ${owned ? 'on' : ''}"><span class="nm"><b>${esc(S.name)}</b></span><span class="muted">${esc(S.desc)}${need && r < need ? ` · 길드 「${GUILD_RANKS[need].name}」 이상` : ''}</span><span class="btns">${owned ? '<b>가졌다</b>' : `<button class="sm" data-ship="${i}" ${save.gold >= S.price && r >= need && i === cur + 1 ? '' : 'disabled'}>◆ ${S.price}</button>`}</span></div>`; }).join('');
  showModal(`<h2>황금 돛 조선소 · 조선공 드레크</h2><p>"배 한 척 있으면 바다가 네 길이 되지. 배삯 없이 가 본 항구 어디로든 빨리 가고, 짐칸만큼 더 싣고, 마음만 먹으면… 남의 배도 털 수 있고."</p>${portGoldRow()}<div class="soc-list">${rows}</div><div class="actions"><button data-close class="ghost">돌아간다</button></div>`);
  overlay.querySelectorAll('[data-ship]').forEach((b) => (b.onclick = () => { const i = +b.dataset.ship; save.gold -= SHIPS[i].price; save.ship = { tier: i }; addChronicle(`${heroName()}이(가) 황금 돛 조선소에서 「${SHIPS[i].name}」을(를) 샀다`); writeSave(save); sfx('levelup', { vol: 0.6 }); yardTalk(); }));
}
function shopTalk() {
  if (guildRank(save) < 2) { showModal('<h2>점포 거리</h2><p>"내 가게는 길드 「대상인」부터 빌릴 수 있소."</p><div class="actions"><button data-close>알겠다</button></div>'); return; }
  const S = (save.shop ||= { rentUntil: 0, items: {}, last: Date.now(), earned: 0 }), now = Date.now();
  if (S.rentUntil > now) { // 10분마다 하나씩 팔린다 (접속하지 않아도)
    let n = Math.floor((now - S.last) / 600e3);
    while (n-- > 0) { const ids = Object.keys(S.items).filter((k) => S.items[k] > 0); if (!ids.length) break; const id = ids[Math.floor(Math.random() * ids.length)]; S.items[id]--; const p = Math.round(GOODS[id].price * 1.15); S.earned += p; tradeOf().revenue += p; S.last += 600e3; }
    if (!Object.values(S.items).some((v) => v > 0)) S.last = now;
  }
  const rented = S.rentUntil > now;
  const stock = Object.entries(S.items).filter(([, n]) => n > 0).map(([id, n]) => `${GOODS[id].name} ×${n}`).join(' · ') || '비어 있다';
  const can = Object.entries(save.bag).filter(([id, n]) => n > 0 && GOODS[id] && GOODS[id].price >= 5).slice(0, 12);
  showModal(`<h2>내 가게</h2><p class="muted">${rented ? `빌린 기간 ${Math.ceil((S.rentUntil - now) / 864e5)}일 남음 · 10분마다 하나씩 시세의 1.15배로 팔린다 (접속하지 않아도)` : '7일 빌리는 데 ◆ 300'}</p>
    <p>진열: ${esc(stock)}</p><p>모인 돈: ◆ ${S.earned}</p>
    <div class="actions">${rented ? `<button id="collect" ${S.earned ? '' : 'disabled'}>돈을 걷는다</button>` : `<button id="rent" ${save.gold >= 300 ? '' : 'disabled'}>빌린다 (◆ 300)</button>`}<button data-close class="ghost">돌아간다</button></div>
    ${rented ? `<h4>가방에서 진열하기</h4><div class="soc-list">${can.map(([id, n]) => `<div class="soc-row"><span class="nm">${esc(GOODS[id].name)} <small class="muted">${n}개</small></span><span class="btns"><button class="sm ghost" data-stock="${id}">1개</button></span></div>`).join('')}</div>` : ''}`);
  const rb = document.getElementById('rent'); if (rb) rb.onclick = () => { save.gold -= 300; S.rentUntil = Date.now() + 7 * 864e5; S.last = Date.now(); writeSave(save); shopTalk(); };
  const cb = document.getElementById('collect'); if (cb) cb.onclick = () => { save.gold += S.earned; S.earned = 0; writeSave(save); sfx('coin', { vol: 0.7 }); shopTalk(); };
  overlay.querySelectorAll('[data-stock]').forEach((b) => (b.onclick = () => { const id = b.dataset.stock; save.bag[id]--; if (!save.bag[id]) delete save.bag[id]; S.items[id] = (S.items[id] || 0) + 1; if (S.last < Date.now() - 600e3) S.last = Date.now(); writeSave(save); shopTalk(); }));
}
// ── 다른 섬의 일 ──
function islandTalk(id) {
  const say = (title, text, extra = '') => showModal(`<h2>${esc(title)}</h2><p>"${esc(text)}"</p>${extra}<div class="actions"><button data-close>돌아선다</button></div>`);
  if (id === 'gold_guild') { guildTalk(); return true; }
  if (id === 'gold_auction') { auctionTalk(); return true; }
  if (id === 'gold_yard') { yardTalk(); return true; }
  if (id === 'gold_shop') { shopTalk(); return true; }
  if (id === 'frost_merc') {
    const def = { types: ['iceWolf', 'frostWolf', 'yeti', 'iceGolem'], n: 12, title: '국경의 짐승 사냥', reward: { gold: 400, fame: 3 } };
    const st = killQuest('frostMerc', def);
    showModal(`<h2>용병대장 하르크</h2><p>"공국은 칼 잘 쓰는 사람을 늘 산다. 출신은 안 묻지. 얼음 늑대 · 서리 늑대 · 설인 · 얼음 골렘 12마리. 국경이 조용해지면 돈을 주지."</p>${st || ''}<p class="muted">하얀 왕관 공국은 에드릭 왕국과 사이가 나쁘다… 공국 창고에 「녹타리스」라고 적힌 상자가 쌓여 있다.</p><div class="actions">${st ? '' : questBtn('frostMerc', def)}<button data-close class="ghost">돌아선다</button></div>`);
    bindQuest('frostMerc', def, () => { overlay.hidden = true; paused = false; modal = null; });
    return true;
  }
  if (id === 'sand_arena') {
    const A = (save.sultan ||= { wins: 0 });
    showModal(`<h2>술탄의 투기장 · 진행자 말리크</h2><p>"모래바람 술탄께서 보고 계신다! 세 판을 내리 이기면 술탄의 금잔을 주지!"</p><p class="muted">연승 ${A.wins} / 3</p><div class="actions"><button id="sfight">모래판에 선다 (Lv ${30 + A.wins * 5})</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('sfight').onclick = () => { overlay.hidden = true; paused = false; modal = null; const lv = 30 + A.wins * 5; startDuel({ foe: ['sandScorpion', 'lizardWarrior', 'orcRaider'][A.wins % 3], lv, hp: 3.5, name: `${A.wins + 1}번째 상대`, onEnd: (win) => { if (win) { A.wins++; save.gold += 100 + lv * 3; if (A.wins >= 3) { A.wins = 0; save.gold += 800; repOf().fame += 8; addChronicle(`${heroName()}이(가) 술탄의 투기장에서 세 판을 내리 이겨 금잔을 받았다`); renderer.banner = { text: '술탄의 금잔!', sub: '◆ 800 · 명성 +8', t: 3.5, color: '#ffd27a' }; } else renderer.banner = { text: `이겼다 (${A.wins}연승)`, t: 2.4, color: '#ffd27a' }; } else { A.wins = 0; renderer.banner = { text: '졌다 · 연승이 끊겼다', t: 2.4, color: '#ffb0a0' }; } writeSave(save); } }); };
    return true;
  }
  if (id === 'sand_caravan') {
    showModal(`<h2>대상 대장 오마르</h2><p>"사구를 건너는 낙타 행렬을 지켜 줄 사람이 필요하오. 전갈 떼가 습격해 오면 막아 주시오."</p><div class="actions"><button id="cesc">호위한다</button><button data-close class="ghost">됐다</button></div>`);
    document.getElementById('cesc').onclick = () => { overlay.hidden = true; paused = false; modal = null; const p = world.player; const foes = world.spawnGroup([['desertScorpion', 3, '사막 전갈'], ['sandScorpion', 2, '모래 전갈']], p.x + 60, p.y, Math.max(25, save.level), {}); world.skirmish = { id: 'sandCaravan', foes }; renderer.banner = { text: '전갈 떼가 몰려온다!', sub: '모두 물리치면 대상이 사례한다', t: 2.6, color: '#ff9a7a' }; };
    return true;
  }
  if (id === 'skull_captain') {
    const P = polOf();
    showModal(`<h2>해적왕 레드 메리</h2><p>"여기선 왕도 반란도 없어. 바다와 금화뿐이지. ${save.ship ? '배가 있네? 바다에서 연맹 상선을 털어 오면 술 한 잔 사지.' : '배가 없으면 황금 돛 조선소에서 한 척 사 와. 그럼 같이 놀아 주지.'}"</p><p class="muted">해적질 ${P.raids || 0}번 · 15번이면 「전설의 약탈자」</p><div class="actions"><button data-close>웃어 넘긴다</button></div>`);
    return true;
  }
  if (id === 'skull_bounty') {
    const b = bounty(save), def = { types: ['bandit', 'darkArcher', 'orcRaider'], n: 10, title: '수배된 도적 사냥', reward: { gold: 300, fame: 2 } };
    const st = killQuest('bountyHunt', def);
    showModal(`<h2>현상금 게시판 · 사냥꾼 브래그</h2><p>"${b ? `여기 네 얼굴도 붙어 있군 — ◆ ${b}. 걱정 마, 해골 군도에선 아무도 안 잡아.` : '깨끗한 얼굴이네. 그럼 남의 현상금을 따 보겠나?'}"</p>${st || ''}<p class="muted">다른 사람의 현상금은 서버가 이어질 때 이곳에 붙는다.</p><div class="actions">${st ? '' : questBtn('bountyHunt', def)}<button data-close class="ghost">돌아선다</button></div>`);
    bindQuest('bountyHunt', def, () => { overlay.hidden = true; paused = false; modal = null; });
    return true;
  }
  if (id === 'mist_cult') {
    const P = polOf(), def = { types: ['watcherEye', 'ruinSentinel', 'wraithKnight'], n: 8, title: '등불지기 쓰러뜨리기', reward: { gold: 250, cult: 1, infamy: 3 } };
    const st = killQuest('cultTask', def);
    showModal(`<h2>안개 속의 신도</h2><p>"여기까지 왔다면 너도 등불이 꺼지는 소리를 들었겠지. 빛은 끝나야 다시 시작된다. 유적을 지키는 등불지기들을 쓰러뜨려 다오. 그러면 스승님께 너를 알리겠다."</p>${st || ''}<p class="muted">교단을 도운 횟수 ${P.cult} / 3 (숨겨진 길)</p><div class="actions">${st ? '' : questBtn('cultTask', def)}<button data-close class="ghost">돌아선다</button></div>`);
    bindQuest('cultTask', def, () => { overlay.hidden = true; paused = false; modal = null; });
    return true;
  }
  return false;
}

// ═══════ 정치: 세력 가입 · 계급 · 지위 · 고위 관계자 · 벌어지는 일 · 현상금 · 연대기 ═══════
function polOf() {
  if (!save.pol) { save.pol = newPol(save.race); const L = LOYALTY[save.race]?.lv || 0; if (L > 0) save.pol.merit = Math.round(L * 15); }
  save.pol.kills ||= {};
  return save.pol;
}
const heroName = () => cloud?.name || `${RACES[save.race]?.name || ''} 여행자`;
function addChronicle(text) { (save.chronicle ||= []).unshift({ t: Date.now(), text }); save.chronicle.length = Math.min(save.chronicle.length, 60); }
// 점수 · 평판을 더하고 계급 · 지위 변화를 알린다
function polGain(r = {}, aligned = false) {
  const P = polOf(), R = repOf(), mul = aligned ? 1.5 : 1;
  if (r.merit) P.merit = Math.max(0, P.merit + Math.round(r.merit * (r.merit > 0 ? mul : 1)));
  if (r.struggle) P.struggle = Math.max(0, P.struggle + Math.round(r.struggle * mul));
  if (r.fame) R.fame += r.fame; if (r.infamy) R.infamy += r.infamy;
  if (r.raid) P.raids = (P.raids || 0) + r.raid; if (r.cult) P.cult += r.cult;
  if (r.gold) save.gold += r.gold;
  // 아우렐리온 기사가 악명이 높아지면 계급을 빼앗긴다
  if (P.faction === 'aurelion' && R.infamy >= 40) { P.faction = null; P.rank = 0; P.left = Date.now(); addChronicle(`${heroName()}이(가) 악행이 드러나 아우렐리온에서 쫓겨났다`); renderer.banner = { text: '아우렐리온에서 쫓겨났다', sub: '악명이 너무 높아 계급을 빼앗겼다', t: 4, color: '#ff7a5a' }; }
  writeSave(save);
}
const rewardText = (r) => [r.gold ? `◆ ${r.gold}` : '', r.fame ? `명성 +${r.fame}` : '', r.infamy ? `악명 +${r.infamy}` : '', r.merit ? `공훈 ${r.merit > 0 ? '+' : ''}${r.merit}` : '', r.struggle ? `투쟁 +${r.struggle}` : ''].filter(Boolean).join(' · ');
function rankInfo(P) {
  const list = RANKS[P.faction], cur = list[P.rank], nx = list[P.rank + 1], pts = P[FACTIONS[P.faction].point];
  return { cur, nx, pts, can: nx && pts >= nx.need && (!nx.cond || P.kills[nx.cond]) };
}
function factionPanel(P) {
  const F = FACTIONS[P.faction], { cur, nx, pts, can } = rankInfo(P);
  const acts = HAPPEN_LIST.filter((h) => !h.o.gone && !h.o.engaged).map((h) => `<li>${esc(HAPPENINGS[h.type].name)} — ${esc(h.where)} <small class="muted">(${P.faction === 'aurelion' ? (h.type === 'caravan' ? '호위' : h.type === 'taxWagon' ? '지키기' : h.type === 'cult' ? '막기' : '순찰대 편') : (h.type === 'caravan' ? '습격' : h.type === 'taxWagon' ? '털기 · 장부' : h.type === 'patrol' ? '말리기' : '막기')}하면 ${F.pointName} 1.5배)</small></li>`).join('');
  return `<p class="muted">${F.name} <b>${cur.name}</b> · ${F.pointName} ${pts}${nx ? ` · 다음 「${nx.name}」: ${F.pointName} ${nx.need}${nx.cond ? ` + ${nx.condText}${P.kills[nx.cond] ? ' ✔' : ''}` : ''}` : ' · 가장 높은 계급'}</p>
    <h4>세력 의뢰 게시판</h4>${acts ? `<ul>${acts}</ul>` : '<p class="muted">지금 섬에 벌어지는 일이 없다. 조금 뒤 다시 보자.</p>'}
    <div class="actions">${can ? '<button id="promote">승진한다</button>' : ''}<button id="leaveF" class="ghost">${F.name}을(를) 떠난다</button><button data-close class="ghost">돌아간다</button></div>`;
}
function bindFaction(P, again) {
  const pb = document.getElementById('promote');
  if (pb) pb.onclick = () => { P.rank++; const nm = RANKS[P.faction][P.rank].name; addChronicle(`${heroName()}이(가) ${FACTIONS[P.faction].name}의 ${nm}이(가) 되었다`); polGain({}); sfx('levelup', { vol: 0.7 }); renderer.banner = { text: `${FACTIONS[P.faction].name} ${nm}`, sub: '계급이 올랐다', t: 4, color: FACTIONS[P.faction].color }; again(); };
  const lb = document.getElementById('leaveF');
  if (lb) lb.onclick = () => { const F = FACTIONS[P.faction]; addChronicle(`${heroName()}이(가) ${F.name}을(를) 떠났다`); P.left = Date.now(); P.faction = null; P.rank = 0; writeSave(save); overlay.hidden = true; paused = false; modal = null; renderer.banner = { text: `${F.name}을(를) 떠났다`, sub: '이제 무소속이다', t: 3, color: '#bfe8ff' }; };
}
function joinFaction(fid) {
  const P = polOf(), was = P.faction;
  if (was && was !== fid && P.rank >= 2) { P.traitor = Date.now(); addChronicle(`${RANKS[was][P.rank].name} ${heroName()}이(가) ${FACTIONS[was].name}을(를) 배신하고 ${FACTIONS[fid].name}(으)로 넘어갔다`); }
  P.faction = fid; P.rank = was && was !== fid && P.rank >= 2 ? Math.min(2, RANKS[fid].length - 1) : 0;
  addChronicle(`${heroName()}이(가) ${FACTIONS[fid].name}에 들어갔다`);
  writeSave(save); sfx('levelup', { vol: 0.7 });
  renderer.banner = { text: `${FACTIONS[fid].name} ${RANKS[fid][P.rank].name}`, sub: P.traitor && Date.now() - P.traitor < 1e4 ? '배신자 — 원래 집단이 쫓는다' : FACTIONS[fid].desc, t: 4, color: FACTIONS[fid].color };
}
function recruiterTalk() {
  const P = polOf(), L = LOYALTY[save.race] || LOYALTY.elf, R = repOf();
  if (P.faction === 'aurelion') { showModal(`<h2>아우렐리온 모병관</h2>${factionPanel(P)}`); bindFaction(P, recruiterTalk); return; }
  const tone = L.lv >= 1 ? '"오, 왕성의 피를 이은 분이군요! 아우렐리온은 당신 같은 분을 기다려 왔습니다."' : L.lv >= 0 ? '"입단을 원하시오? 맹세만 지킨다면 출신은 묻지 않소."' : L.lv >= -1 ? `"${RACES[save.race].name}이라… 솔직히 말하지. 위에선 당신네를 좋게 보지 않소. 시험 임무 하나는 해 내야 하오."` : '"언데드가 왕의 기사가 되겠다고? …농담이 아니라면, 남보다 두 배는 증명해야 할 거요."';
  const block = R.infamy >= 20 || bounty(save) ? '악명이 너무 높다 — 입단을 거절당한다' : P.faction === 'noctaris' ? '녹타리스에 몸담고 있다 — 넘어오면 배신자가 된다' : '';
  const test = !P.tested ? '<p class="muted">시험 임무: 섬에서 벌어지는 일 하나를 왕국 편으로 해결한다 (상단 호위 · 세금 마차 지키기 · 교단 의식 막기 · 순찰대 편들기)</p>' : '';
  showModal(`<h2>아우렐리온 모병관</h2><p>${tone}</p><p class="muted">${esc(RACES[save.race].name)}의 왕실 충성도: <b>${L.name}</b> (${esc(L.why)}) · 명성 ${R.fame} · 악명 ${R.infamy}</p>${test}${block ? `<p class="warn">${block}</p>` : ''}
    <div class="actions"><button id="joinA" ${R.infamy >= 20 || bounty(save) || !P.tested ? 'disabled' : ''}>${P.faction === 'noctaris' ? '배신하고 입단한다' : '입단한다'}</button><button data-close class="ghost">돌아간다</button></div>`);
  document.getElementById('joinA').onclick = () => { joinFaction('aurelion'); overlay.hidden = true; paused = false; modal = null; };
}
function brokerJoin() {
  const P = polOf();
  if (P.faction === 'noctaris') { showModal(`<h2>중개인 벡</h2>${factionPanel(P)}`); bindFaction(P, brokerJoin); return; }
  const wary = P.merit >= 100, hasProof = (save.bag.taxLedger || 0) > 0 || (save.bag.officialSeal || 0) > 0;
  showModal(`<h2>중개인 벡</h2><p>"${wary ? '당신 이름은 왕국 장부에서 많이 봤소. 그냥은 못 믿지. 왕국 물건 — 세금 장부나 관리의 인장 — 을 가져오면 믿어 주겠소.' : '여기까지 내려와 날 찾았으면 쓸 만한 사람이오. 녹타리스에 들겠소? 밤에 움직이고, 왕의 마차를 털고, 언젠가는 왕좌를 엎는 일이오.'}"</p>
    <p class="muted">녹타리스 계급: ${RANKS.noctaris.map((r) => r.name).join(' → ')}</p>
    <div class="actions"><button id="joinN" ${wary && !hasProof ? 'disabled' : ''}>${P.faction === 'aurelion' ? '배신하고 들어간다' : '들어간다'}${wary ? ' (증거를 넘긴다)' : ''}</button>${(save.bag.taxLedger || 0) > 0 && !wary ? '<button id="sellLedger">세금 장부를 판다 (◆ 120)</button>' : ''}<button data-close class="ghost">돌아간다</button></div>`);
  document.getElementById('joinN').onclick = () => { if (wary) { const k = (save.bag.taxLedger || 0) > 0 ? 'taxLedger' : 'officialSeal'; save.bag[k]--; if (!save.bag[k]) delete save.bag[k]; } joinFaction('noctaris'); overlay.hidden = true; paused = false; modal = null; };
  const sl = document.getElementById('sellLedger'); if (sl) sl.onclick = () => { save.bag.taxLedger--; if (!save.bag.taxLedger) delete save.bag.taxLedger; save.gold += 120; polGain({ struggle: 10 }); brokerJoin(); };
}
// ── 고위 관계자 ──
function officialTalk(oid) {
  const now = officialNow(save, oid); if (!now) return;
  const P = polOf(), mine = P.faction === now.side, enemy = P.faction && !mine;
  const label = `${now.title} ${now.name}${now.gen > 1 ? ` (${now.gen}대째)` : ''}`;
  const line = now.king ? (now.side === 'aurelion' ? '"빛은 다시 켜질 것이다. 조각만 모인다면… 그대는 무엇을 원하는가?"' : '"녹타리스의 칼은 왕좌를 향한다. 그대의 칼은 어디를 향하지?"') : mine ? '"동지여, 오늘도 수고가 많소."' : enemy ? '"…적의 냄새가 나는군. 호위병들, 눈 떼지 마라."' : '"무슨 볼일이오? 바쁜 몸이오."';
  showModal(`<h2>${esc(label)}</h2><p>${line}</p><p class="muted">호위 ${now.guards.reduce((s, g) => s + g[1], 0)}명 · Lv ${now.lv}${now.king ? ' · 여럿이 힘을 모아야 닿는 상대' : ''}</p>
    <div class="actions">${!mine ? `<button id="bribe" ${save.gold >= 100 ? '' : 'disabled'}>뇌물을 바친다 (◆ 100)</button>` : '<button id="salute">예를 갖춘다</button>'}<button id="attackO" class="warn">${mine ? '배신하고 공격한다' : '공격한다'}</button><button data-close class="ghost">물러난다</button></div>`);
  const close = () => { overlay.hidden = true; paused = false; modal = null; };
  const bb = document.getElementById('bribe'); if (bb) bb.onclick = () => { save.gold -= 100; polGain(now.side === 'aurelion' ? { merit: 15, infamy: 1 } : { struggle: 15, infamy: 1 }); close(); renderer.banner = { text: '뇌물을 받았다', sub: `${label}이(가) 당신 이름을 기억한다`, t: 2.6, color: '#ffe8a8' }; };
  const sb = document.getElementById('salute'); if (sb) sb.onclick = close;
  document.getElementById('attackO').onclick = () => {
    close();
    if (mine) { P.faction = null; P.rank = 0; P.traitor = Date.now(); addChronicle(`${heroName()}이(가) 자기 세력의 ${now.title}에게 칼을 겨눴다`); }
    const o = world.objects.find((q) => q.id === 'official_' + oid); if (o) { o.reusable = false; o.opened = true; o.gone = true; world.objects.splice(world.objects.indexOf(o), 1); }
    const x = o?.x ?? world.player.x + 40, y = o?.y ?? world.player.y;
    const [boss] = world.spawnGroup([[now.monster, 1, null]], x, y, now.lv, { r: 1 });
    boss.hp = boss.maxHp = Math.round(boss.maxHp * now.hp); boss.champion = label; boss.official = oid; boss.scale = now.king ? 1.5 : 1.2;
    const gl = now.guards.map(([m, n]) => [m, n, now.side === 'aurelion' ? '왕국 근위병' : '녹타리스 호위']);
    world.spawnGroup(gl, x, y, now.lv - 2, { r: 46 });
    renderer.banner = { text: `${label}을(를) 공격했다!`, sub: '호위병이 달려든다', t: 3, color: '#ff7a5a' };
  };
}
function officialDown(s) {
  const now = officialNow(save, s.id), e = world.enemies.find((q) => q.id === s.eid); if (!now || !e) return;
  const label = `${now.title} ${now.name}`;
  showModal(`<h2>${esc(label)}이(가) 쓰러졌다</h2><p>"${now.king ? '…왕을 죽이면 섬이 뒤집힐 것이다. 그래도 하겠느냐?' : '살, 살려 주시오! 원하는 건 무엇이든…'}"</p>
    <div class="soc-list"><div class="soc-row"><span class="nm"><b>살린다</b></span><span class="muted">명성 · 그는 달아난다 (자리는 그대로)</span><span class="btns"><button class="sm" data-of="spare">고른다</button></span></div>
    <div class="soc-row"><span class="nm"><b>처형한다</b></span><span class="muted">자리가 빈다 · 지위가 크게 바뀐다 · 악명 · 현상금</span><span class="btns"><button class="sm" data-of="kill">고른다</button></span></div>
    <div class="soc-row"><span class="nm"><b>인장만 빼앗는다</b></span><span class="muted">관리의 인장 (녹타리스 증거 · 팔 수 있다) · 그는 달아난다</span><span class="btns"><button class="sm" data-of="seal">고른다</button></span></div></div>`, () => {});
  overlay.querySelectorAll('[data-of]').forEach((b) => (b.onclick = () => {
    overlay.hidden = true; paused = false; modal = null;
    const c = b.dataset.of, P = polOf();
    if (c === 'kill') {
      e.finish = true; e.begging = false; world.killEnemy(e);
      (save.officials[s.id] ||= { gen: 1 }).deadAt = Date.now();
      P.kills[now.cond] = true; if (now.cond === 'aurCore') P.kills.aurOfficer = true;
      const big = now.king ? 1000 : now.cond === 'aurCore' || now.cond === 'nocOfficer' ? 300 : 120;
      polGain(now.side === 'aurelion' ? { struggle: big, infamy: now.king ? 40 : 15, gold: big } : { merit: big, fame: now.king ? 20 : 5, infamy: 5, gold: big });
      addChronicle(`${now.gen}대째 ${now.title} ${now.name} 피살 — 범인 ${heroName()}${now.side === 'aurelion' ? ', 현상금 걸림' : ''}`);
      if (now.king) { addChronicle(now.side === 'aurelion' ? '에드릭 왕이 쓰러졌다. 하루 뒤 새 왕이 즉위한다' : '녹타리스의 수장이 쓰러졌다. 봉기군이 흩어진다'); renderer.banner = { text: now.side === 'aurelion' ? '왕이 쓰러졌다' : '녹타리스의 수장이 쓰러졌다', sub: '섬이 술렁인다 · 하루 뒤 새 사람이 자리에 앉는다', t: 5, color: '#ff5a5a' }; }
      else renderer.banner = { text: `${label} 처형`, sub: `자리가 비었다 · ${OFFICIALS[s.id].respawnH}시간 뒤 후임이 온다`, t: 4, color: '#ff7a5a' };
      // 군단장 · 공작 · 왕 시해자 같은 큰 지위는 계급 조건과 함께 열린다
    } else {
      e.finish = true; e.dead = true; world.emit({ t: 'death', x: e.x, y: e.y, color: '#8a8478' });
      for (const q of world.enemies) if (!q.dead && (q.tag === '왕국 근위병' || q.tag === '녹타리스 호위')) { q.dead = true; world.emit({ t: 'death', x: q.x, y: q.y, color: '#8a8478' }); }
      if (c === 'spare') { polGain({ fame: 6 }); addChronicle(`${heroName()}이(가) 쓰러진 ${now.title} ${now.name}의 목숨을 살려 주었다`); renderer.banner = { text: `${label}을(를) 살려 주었다`, sub: '명성 +6 · 그는 달아났다', t: 3, color: '#9fe8b0' }; }
      else { bagAdd(lifeOf(), 'officialSeal', 1); polGain(now.side === 'aurelion' ? { struggle: 40, infamy: 4 } : { merit: 40 }); addChronicle(`${now.title} ${now.name}의 인장을 누군가 빼앗았다`); renderer.banner = { text: '관리의 인장을 빼앗았다', sub: '녹타리스 가입 증거로 쓸 수 있다', t: 3, color: '#ffe8a8' }; }
    }
    writeSave(save);
  }));
}
// ── 벌어지는 일: 바깥 세계(본섬 · 섬)에서 2~3분마다 생긴다 ──
let HAPPEN_LIST = [], happenClock = 0, hunterClock = 0, titleClock = 0, happenSeq = 0;
function spawnHappening() {
  const w = world, m = w.map, p = w.player;
  if (!m.outdoor || !m.onPath || w.voyage || w.pvp || w.raid) return;
  const kinds = ['caravan', 'caravan', 'patrol', 'cult', ...(officialNow(save, 'taxChief') && w.zoneId === 'world' ? ['taxWagon', 'taxWagon'] : [])];
  const type = kinds[Math.floor(Math.random() * kinds.length)];
  let at = null;
  for (let a = 0; a < 200 && !at; a++) { const r = 30 + Math.random() * 50, ang = Math.random() * Math.PI * 2, tx = Math.floor(p.x / TILE + Math.cos(ang) * r), ty = Math.floor(p.y / TILE + Math.sin(ang) * r); if (tx < 2 || ty < 2 || tx >= w.tw - 2 || ty >= w.th - 2) continue; const k = ty * w.tw + tx; if (m.onPath[k] && !w.blocked(tx * TILE + 8, ty * TILE + 8, 8)) at = { x: tx * TILE + 8, y: ty * TILE + 8 }; }
  if (!at) return;
  let dest = null;
  if (type === 'caravan' || type === 'taxWagon') for (let a = 0; a < 200 && !dest; a++) { const ang = Math.random() * Math.PI * 2, tx = Math.floor(at.x / TILE + Math.cos(ang) * 40), ty = Math.floor(at.y / TILE + Math.sin(ang) * 40); if (tx > 1 && ty > 1 && tx < w.tw - 2 && ty < w.th - 2 && m.onPath[ty * w.tw + tx]) dest = { x: tx * TILE + 8, y: ty * TILE + 8 }; }
  const H = HAPPENINGS[type], hid = `h${++happenSeq}`;
  const r = m.regions?.[Math.floor(at.y / TILE) * w.tw + Math.floor(at.x / TILE)], where = m.regionInfo?.[r]?.name || '근처';
  const o = { kind: 'happening', hid, etype: type, x: at.x, y: at.y, dest, dir: 1, endT: w.t + H.minutes * 60, label: `${H.name} · 다가가서 살펴본다`, reusable: true };
  w.objects.push(o);
  HAPPEN_LIST.push({ id: hid, type, o, where });
  w.emit({ t: 'text', x: p.x, y: p.y - 30, text: `근처에서 ${H.name}`, color: '#ffe8a8' });
}
const ALIGN = { aurelion: { caravan: 'escort', taxWagon: 'guard', cult: 'stop', patrol: 'side' }, noctaris: { caravan: 'raid', taxWagon: 'rob', patrol: 'stop', cult: 'stop' } };
function happeningTalk(hid) {
  const h = HAPPEN_LIST.find((q) => q.id === hid); if (!h || h.o.engaged || h.o.gone) return;
  const H = HAPPENINGS[h.type], P = polOf();
  showModal(`<h2>${esc(H.name)}</h2><p>${esc(H.text)}</p><div class="soc-list">${H.choices.map((c) => `<div class="soc-row ${P.faction && ALIGN[P.faction][h.type] === c.id ? 'on' : ''}"><span class="nm"><b>${esc(c.label)}</b></span><span class="muted">${esc(c.hint)}${P.faction && ALIGN[P.faction][h.type] === c.id ? ` · ${FACTIONS[P.faction].name} 의뢰 (×1.5)` : ''}</span><span class="btns"><button class="sm" data-hc="${c.id}">고른다</button></span></div>`).join('')}</div>`);
  overlay.querySelectorAll('[data-hc]').forEach((b) => (b.onclick = () => {
    overlay.hidden = true; paused = false; modal = null;
    const c = H.choices.find((q) => q.id === b.dataset.hc);
    if (c.id === 'leave') return;
    const aligned = !!(P.faction && ALIGN[P.faction][h.type] === c.id);
    const finish = () => happeningDone(h, c, aligned);
    if (c.sneak && Math.random() < c.sneak) { finish(); return; }
    if (c.fight) {
      h.o.engaged = true; h.choice = c; h.aligned = aligned;
      const foes = world.spawnGroup(FOES[c.fight], h.o.x + 30, h.o.y, Math.max(5, Math.min(60, save.level + 1)), { r: 50 });
      world.skirmish = { id: h.id, foes };
      renderer.banner = { text: c.sneak ? '들켰다!' : c.label, sub: '모두 쓰러뜨리자', t: 2.4, color: '#ff9a7a' };
      return;
    }
    finish();
  }));
}
function happeningDone(h, c, aligned) {
  const r = { ...c.reward }, P = polOf();
  if (r.cargo) { for (let i = 0; i < r.cargo; i++) bagAdd(lifeOf(), ['windWheat', 'woolBale', 'mistSalt', 'driedFish'][Math.floor(Math.random() * 4)], 1); }
  if (r.item) bagAdd(lifeOf(), r.item, 1);
  if (r.lore) { const t = CULT_LORE[Math.floor(Math.random() * CULT_LORE.length)]; save.codex.lore ||= []; if (!save.codex.lore.includes(t)) save.codex.lore.push(t); renderer.banner = { text: '교단의 기록을 엿들었다', sub: t.slice(0, 60) + '…', t: 4.5, color: '#b98aff' }; }
  if (!P.tested && P.faction !== 'noctaris' && ALIGN.aurelion[h.type] === c.id) P.tested = true;
  polGain(r, aligned);
  if (c.id === 'raid' || c.id === 'rob') addChronicle(`${h.where}에서 ${h.type === 'taxWagon' ? '세금 마차' : '상단'}이(가) 털렸다 — ${heroName()}`);
  if (!r.lore) renderer.banner = { text: c.label + (aligned ? ' · 세력 의뢰 완료' : ''), sub: rewardText(c.reward), t: 3.2, color: '#ffe8a8' };
  h.o.gone = true; h.o.reusable = false; h.o.endT = world.t;
  HAPPEN_LIST = HAPPEN_LIST.filter((q) => q !== h);
  writeSave(save);
}
function skirmishWon(s) {
  if (s.id === 'hunt') { polGain({ infamy: 2 }); renderer.banner = { text: '쫓아온 경비병을 물리쳤다', sub: '악명 +2', t: 2.4, color: '#ffb0a0' }; return; }
  if (s.id === 'sandCaravan') { const g = 150 + save.level * 4; polGain({ fame: 4, gold: g }); renderer.banner = { text: '대상을 지켜 냈다', sub: `◆ ${g} · 명성 +4`, t: 3, color: '#9fe8b0' }; return; }
  const h = HAPPEN_LIST.find((q) => q.id === s.id); if (h) happeningDone(h, h.choice, h.aligned);
}
// 매 프레임: 벌어지는 일 · 쫓아오는 경비병 · 지위 · 오른쪽 패널 · 비밀 의뢰
function politicsTick(dt) {
  if (!world || !save || gameEl.hidden || paused) return;
  const w = world;
  if (w.map.outdoor && !w.voyage && w.state === 'play') {
    happenClock -= dt;
    HAPPEN_LIST = HAPPEN_LIST.filter((h) => w.objects.includes(h.o) && !h.o.gone);
    if (happenClock <= 0) { happenClock = 100 + Math.random() * 60; if (HAPPEN_LIST.length < 3) spawnHappening(); }
    // 현상금이 붙었으면 (해골 군도 빼고) 경비병이 쫓아온다, 배신자는 원래 집단이 쫓는다
    hunterClock -= dt;
    const P = polOf(), wanted = bounty(save) > 0 && !ISLAND_DEFS[w.zoneId]?.lawless && w.zoneId !== 'mist', hunted = P.traitor && Date.now() - P.traitor < 3 * 864e5;
    if (hunterClock <= 0) {
      hunterClock = 150 + Math.random() * 60;
      if ((wanted || hunted) && !w.skirmish?.foes?.some((e) => !e.dead) && w.zoneId === 'world') {
        const foes = w.spawnGroup([['royalGuard', 2, wanted ? '왕국 경비병' : '추격자']], w.player.x + 120, w.player.y + 40, Math.max(5, save.level + 2), {});
        w.skirmish = { id: 'hunt', foes };
        renderer.banner = { text: wanted ? `현상금 ◆ ${bounty(save)} — 경비병이 쫓아온다!` : '배신자를 쫓는 자들이 왔다!', t: 3, color: '#ff7a5a' };
      }
    }
  }
  // 비밀 의뢰 표적을 쓰러뜨렸나
  const C = save.contract;
  if (C && !C.done && C.zone === w.zoneId && w.enemies.some((e) => e.contract && e.dead)) { C.done = true; save.contract = null; w.track = null; polGain({ gold: C.reward, infamy: 2 }); addChronicle(`${C.where}에 숨어 있던 ${C.name}이(가) 누군가에게 쓰러졌다`); renderer.banner = { text: '비밀 의뢰 완료', sub: `◆ ${C.reward} · 악명 +2`, t: 3, color: '#b89aff' }; }
  // 지위가 바뀌면 크게 알린다
  titleClock -= dt;
  if (titleClock <= 0) {
    titleClock = 1;
    const T = titleOf(save); w.title = T;
    if (lastTitle && T.text !== lastTitle) { renderer.banner = { text: T.text, sub: '지위가 바뀌었다', t: 4, color: T.color }; sfx('levelup', { vol: 0.6 }); addChronicle(`${heroName()}의 지위: ${T.text}`); writeSave(save); }
    lastTitle = T.text;
    updateHappenPanel();
  }
}
function updateHappenPanel() {
  let el = document.getElementById('happenPanel');
  const w = world, show = w?.map?.outdoor && !w.voyage && HAPPEN_LIST.length;
  if (!show) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement('div'); el.id = 'happenPanel'; gameEl.appendChild(el); el.onclick = (e) => { const id = e.target.closest('[data-tr]')?.dataset.tr; if (!id) return; if (id === 'off') { world.track = null; return; } const h = HAPPEN_LIST.find((q) => q.id === id); if (h) world.track = { x: h.o.x, y: h.o.y, name: HAPPENINGS[h.type].name, hid: id }; }; }
  el.hidden = false;
  const p = w.player;
  if (w.track?.hid) { const h = HAPPEN_LIST.find((q) => q.id === w.track.hid); if (h) { w.track.x = h.o.x; w.track.y = h.o.y; } else w.track = null; }
  el.innerHTML = `<b>근처에서 벌어지는 일</b>${HAPPEN_LIST.slice(0, 3).map((h) => { const d = Math.round(Math.hypot(h.o.x - p.x, h.o.y - p.y) / TILE), left = Math.max(0, Math.ceil((h.o.endT - w.t) / 60)); return `<div class="hp-row ${w.track?.hid === h.id ? 'on' : ''}" data-tr="${h.id}">${esc(HAPPENINGS[h.type].name)}<small>${esc(h.where)} · ${d}칸 · ${left}분</small></div>`; }).join('')}${w.track ? '<div class="hp-row off" data-tr="off">안내 끄기</div>' : ''}`;
}
function chronicleTalk() {
  const C = save.chronicle || [];
  const fmt = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const offs = Object.keys(OFFICIALS).map((id) => { const n = officialNow(save, id), O = OFFICIALS[id]; return `<li>${esc(O.title)}: ${n ? `${esc(n.name)}${n.gen > 1 ? ` (${n.gen}대째)` : ''}` : '<b>공석</b>'}</li>`; }).join('');
  showModal(`<h2>연대기 비석</h2><p class="muted">누가 무엇을 했는지 섬의 역사가 새겨진다. (서버가 이어지면 친구들의 일도 함께 새겨진다)</p>
    <h4>지금 자리에 있는 사람</h4><ul>${offs}</ul><h4>최근 일</h4>${C.length ? `<ul>${C.slice(0, 20).map((e) => `<li><small class="muted">${fmt(e.t)}</small> ${esc(e.text)}</li>`).join('')}</ul>` : '<p class="muted">아직 새겨진 일이 없다.</p>'}
    <div class="actions"><button data-close>돌아선다</button></div>`);
}
function arcTalk(id) {
  if (id === 'pol_recruiter') { recruiterTalk(); return true; }
  if (id === 'chronicle') { chronicleTalk(); return true; }
  if (id.startsWith('official_')) { officialTalk(id.slice(9)); return true; }
  if (id.startsWith('sanct_')) { sanctTalk(id); return true; }
  if (id === 'nokt_broker') { brokerJoin(); return true; }
  return islandTalk(id);
}

let autosaveT = 0;
function frame(ts) {
  try { tick(ts); updateVoyBar(); const pnow = performance.now(); politicsTick(Math.min(0.1, (pnow - (frame.pt || pnow)) / 1000)); frame.pt = pnow; } catch (err) { if (!frame.warned) { frame.warned = true; console.error(err); } } // 한 번의 오류로 게임이 멈추지 않게
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
        input.dash = false; input.interact = false; input.skill = false; input.s1 = false; input.s2 = false; input.s3 = false; input.s4 = false; input.wskill = false; input.mount = false;
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
window.__game = { get world() { return world; }, renderer, hub, dbg: { spawnHappening: () => spawnHappening(), enterIsland: (id) => enterIsland(id), save: () => save, talk: (id) => sanctTalk(id) } }; // 디버그용

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

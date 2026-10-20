// 진입점: 화면 전환(광장 ↔ 필드), 입력, 고정 틱 게임 루프
import { World, DT, overworldBase } from './sim/world.js';
import { SEABED_ZONE, seabedMap } from './data/maps/seabed.js';
import { ARENA_ZONE, ARENA_SETS, buildArena, spawnArenaSet } from './data/maps/arena.js';
import { computeBuild } from './sim/build.js';
import { Renderer } from './render/renderer.js';
import { loadAssets, sprite, frames } from './render/assets.js';
import { Hub, renderRaceSelect } from './ui/hub.js';
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
import { GOODS } from './data/goods.js';
import { SANCTUMS, SANCTUM_MAX, TIER_COST, PERK_TIER, TREASURE_TIER, SHARDS_PER_RELIC, sanctumBonusText, SANCT_LIFE, sanctState, affLevel, AFF_LV, AFF_NAME, AFF_REWARD, trainCap, trainSpec, OWN_TRAIN_CAP, OWN_TRAIN_EASE, GIFT_AFF, GIFTS_PER_DAY, TRAIN_AFF, TRAINS_PER_DAY, sanctQuestDef, FIND_NAME } from './data/sanctums.js';
import { initCloud, cloudSave, cloudSaveNow, cloudDelete, onCloud, cloudLabel, cloud, isClaudePage, login, register, logout, errorText } from './cloud.js';
import { ECHOES, ZONES, MONSTERS } from './data/monsters.js';
import { RACES, RACE_MIGRATE } from './data/races.js';
import { RACE_STORY, relation, allies, ALLY_AFF, REL_NAME, REL_COLOR } from './data/lore.js';
import { ITEMS, STYLES } from './data/items.js';
import { CLASSES, RACE_CLASSES, SKILLS } from './data/skills.js';
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
hub.onCodex = () => { const ups = syncLevel(save); if (ups && world) { world.setBuild(buildNow()); renderer.levelUp(world, save.level, ups * 3); } };

let world = null, paused = false, endTimer = 0, last = 0, acc = 0, modal = null;

function resetGame() { clearSave(); cloudDelete(); save = null; world = null; showRaceSelect(); }

function showRaceSelect() {
  gameEl.hidden = true; titleEl.hidden = false;
  renderRaceSelect(titleEl, (race) => { unlockAudio(); sfx('select'); showStyleSelect(race); });
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
    refreshQuests(save); writeSave(save); titleEl.hidden = true; enterWorld(null, true);
  }));
  document.getElementById('backRace').onclick = () => showRaceSelect();
}

// ───── 로그인 화면 (일반 웹 배포용) ─────
function showLogin(onDone) {
  gameEl.hidden = true; titleEl.hidden = false;
  titleEl.innerHTML = `<div class="login">
    <h1>각인의 탑</h1>
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

// 로그인 직후: 서버 저장이 있으면 그것, 없으면 지금 브라우저의 진행을 계정으로 올린다
function afterLogin(remote) {
  if (remote) save = migrateSave(remote);
  else if (save && cloud.mode !== 'local') cloudSaveNow(save);
  if (save) { refreshQuests(save); writeSave(save); enterWorld(); } else showRaceSelect();
}

// 예전 저장 데이터를 새 구조로 옮긴다 (인간·드워프 → 기사, 없어진 슬롯·무기 정리)
function migrateSave(sv) {
  if (!sv) return sv;
  registerCrafted(ITEMS, sv.crafted);
  registerAllDishes(sv.bag, sv.chest);
  if (RACE_MIGRATE[sv.race]) sv.race = RACE_MIGRATE[sv.race];
  if (!RACES[sv.race]) sv.race = 'knight';
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
const lifeOf = () => ({ bag: save.bag, tools: save.tools, nodes: save.nodes, chopped: save.chopped, farm: save.farm, fishLog: save.fishLog, artifacts: save.artifacts, farmOpts: save.farmOpts, chest: save.chest, get cap() { return save.bagCap || 30; }, get quickFood() { return save.quickFood; } });
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
  world.player.x = x; world.player.y = y; world.player.hp = ow.player.hp; world.player.mana = ow.player.mana; world.player.res = ow.player.res;
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
  world.player.x = x; world.player.y = y; world.player.hp = sea.player.hp; world.player.mana = sea.player.mana; world.player.res = sea.player.res; world.player.dashT = 0;
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
      <p class="keys">WASD 이동 · 좌클릭 공격 · Q·E·R·F 스킬 · Space 대시 · G 상호작용(누르고 있으면 계속 캐기) · I 가방 · X 씨앗 바꾸기 · C 캐릭터 · M 지도 · Esc 메뉴</p>
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
      <p class="keys">I 가방 · X 씨앗 바꾸기 · 새 물고기와 땅속 유물도 도감에 남아요</p>
    </div>
    <button data-close>좋아요</button>`);
}

const memKeyOf = (id) => (id === 'mossCave' ? 'cave' : id); // 이끼 동굴은 탑의 1층과 같은 곳 (기억을 함께 쓴다)
function interiorZone(id) {
  const def = ENTRANCES[id];
  const base = def.theme === 'labyrinth' ? LABY_ZONE : def.theme === 'palace' ? PALACE_ZONE : ZONES.find((z) => z.id === def.theme);
  return { base, zone: { ...base, name: def.name, key: id, relic: def.relic, elite: def.elite || base.elite, pool: def.pool || base.pool } };
}
function enterInterior(id, depth = 0, carry = null) {
  const def = ENTRANCES[id], { base, zone } = interiorZone(id);
  save.zoneSeeds ||= {}; save.zoneMemory ||= {};
  if (save.zoneSeeds[id] == null) { save.zoneSeeds[id] = ((save.seed >>> 0) + [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + Math.floor(Math.random() * 1e6)) >>> 0; writeSave(save); }
  const seed = depth ? (save.zoneSeeds[id] + depth * 104729 + Math.floor(Math.random() * 1e6)) >>> 0 : save.zoneSeeds[id];
  let map = null;                                                     // 이끼 동굴 1층은 직접 설계한 맵 (World가 만든다)
  if (!(id === 'mossCave' && !depth)) map = !depth && def.theme === 'labyrinth' ? buildLabyrinth(zone, seed) : !depth && def.theme === 'palace' ? buildPalace(zone, seed) : generateField(zone, seed, depth, def.size || null);
  world = new World({ build: buildNow(), mode: 'field', zone, zoneId: base.id, seed, depth, map, memory: depth ? null : save.zoneMemory[memKeyOf(id)], story: save.story, codex: save.codex, ...shared() });
  world.mapKnown = id === 'mossCave' && !depth && !!save.story.flags.pinoMap;
  world.bossRelicTaken = !!(def.relic && save.relicSrc?.[`${def.relic}_boss`]);
  world.codexStart = carry?.codexStart ?? codexPoints(save);
  if (carry) {
    world.loot = carry.loot; world.discovered = carry.discovered;
    world.player.hp = Math.min(carry.hp, world.d.maxHp); world.player.mana = carry.mana; world.player.aura = carry.aura;
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
  let html = `<h2>${S.name}</h2><p class="muted">${tab === 'bless' ? S.keeper : L.leader.name} · 친밀도 <b style="color:${S.color}">${AFF_NAME[lv]}</b>${save.race === race ? ` · <b style="color:${S.color}">내 종족의 성지</b>` : ''}</p>
    <div class="tabs sanct-tabs">${SANCT_TABS.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-st="${k}">${n}${dot(k)}</button>`).join('')}</div>`;
  if (tab === 'bless') html += blessHtml(race);
  else if (tab === 'quest') html += questHtml(race, st, q, def);
  else if (tab === 'aff') html += affHtml(race, st, lv);
  else if (tab === 'story') html += storyHtml(race);
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
  // 수련
  on('trainGo', () => { overlay.hidden = true; paused = false; modal = null; if (!world.startTraining?.(race)) renderer.banner = { text: '지금은 수련할 수 없다', t: 1.6, color: '#c8b8a0' }; });
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
function travelTo(id) {
  if (!world.teleportTo(id)) return;
  const o = world.objects.find((q) => q.id === id);
  renderer.banner = { text: o?.name || '', sub: '포탈을 건너왔다', t: 1.8, color: '#bfefff' };
}

function showSleep() {
  if (!canSleep(save.time.min)) { renderer.banner = { text: '아직 잠이 오지 않는다', sub: `지금 ${clockText(save.time)} · 저녁 5시부터 잘 수 있다`, t: 2.2, color: '#c8d0ff' }; return; }
  showModal(`<h2>잠자리에 들까?</h2><p>아침 6시에 일어난다.</p><ul class="c-eff"><li>체력 · 마나 모두 회복</li><li>물을 준 작물이 한 단계 자란다</li><li>아침 6시 ~ 저녁 6시: <b>개운함</b> (이동 속도 +8% · 받는 피해 -5%)</li><li>지금까지 모은 것을 저장한다</li></ul>
    <button id="doSleep">잔다</button><button data-close class="ghost">아직</button>`);
  document.getElementById('doSleep').onclick = () => { overlay.hidden = true; paused = false; modal = null; doSleep(); };
}
function doSleep() {
  sleepUntilMorning(save.time);
  for (const pl of Object.values(save.farm || {})) if (pl.crop && pl.wateredAt && CROPS[pl.crop]) { pl.wateredAt = Date.now() - CROPS[pl.crop].stageSec * 1000 - 1; growPlot(pl); }
  const now = absMin(save.time), eff = save.effects;
  for (let i = eff.length - 1; i >= 0; i--) if (eff[i].until <= now || eff[i].id === 'rested') eff.splice(i, 1);
  eff.push({ id: 'rested', name: '개운함', mods: { moveSpeed: 1.08, dmgTakenMul: 0.95 }, color: '#ffe8a8', until: now + 12 * 60, dur: 12 * 60, src: 'sleep' });
  world.player.hp = world.d.maxHp; world.player.mana = world.d.maxMana;
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
  if (!id || !(save.bag[id] > 0)) { renderer.banner = { text: '빠른 칸에 음식이 없다', sub: '가방(I)에서 요리 옆의 H를 눌러 빠른 칸에 둔다', t: 2, color: '#c8b8a0' }; return; }
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
    world.player.hp = Math.min(carry.hp, world.d.maxHp); world.player.mana = carry.mana; world.player.aura = carry.aura;
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
  return computeBuild({ race: c.race, cls: practice.cls, level: 20, allSkills: true, alloc: { str: 18, mag: 18, agi: 10, vit: 10 }, engravings: {}, gear: { weapon: c.weapons[1] }, skills: practice.skills });
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
  showModal(`<h2>각인의 탑에 온 것을 환영한다</h2>
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
const ALWAYS_TABS = ['char', 'bag', 'codex'];
const STATION_TABS = { altar: ['altar'], shop: ['shop', 'forge', 'craft'], forge: ['forge', 'shop', 'craft'], codex: ['codex', 'learn'], char: ['char', 'learn'], quest: ['quest'], trade: ['trade'], hunt: ['hunt'], cook: ['cook', 'storage'], storage: ['storage', 'cook'], craft: ['craft', 'storage'] };
function openPanel(tab, fromStation = false) {
  touch?.reset();
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
  (save.zoneMemory ||= {})[memKey] = world.depth ? world.rootMemory || save.zoneMemory[memKey] : world.exportMemory();
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
    ${world.practice ? '<button id="exitPractice" class="ghost">연습 끝내기</button>' : ''}<label class="ck"><input type="checkbox" id="autoAimCk" ${getAutoAim() ? 'checked' : ''}> 자동 조준 (T)</label>
    ${field && !world.practice ? '<button id="retreat" class="ghost">긴급 귀환 (잔향 70% 보존)</button><p class="muted">시작 지점의 귀환 포탈로 돌아가면 잔향을 전부 지킬 수 있습니다. 야영지에 맡긴 잔향은 죽어도 잃지 않아요.</p>' : '<button id="howto" class="ghost">조작법 보기</button>'}
    ${volumeHtml()}
    ${isClaudePage() ? '' : cloud.mode === 'account' ? `<p class="muted">${esc(cloud.name)} 계정으로 로그인 중</p><button id="logoutBtn" class="ghost">로그아웃</button>` : '<button id="loginBtn" class="ghost">로그인 / 회원가입</button>'}`);
  bindVolume();
  const lo = document.getElementById('logoutBtn'), li = document.getElementById('loginBtn');
  if (lo) lo.onclick = async () => { await logout(); clearSave(); save = null; world = null; overlay.hidden = true; paused = false; modal = null; showLogin(afterLogin); };
  if (li) li.onclick = () => { overlay.hidden = true; paused = false; modal = null; world = null; showLogin(afterLogin); };
  document.getElementById('autoAimCk').onchange = (e) => setAutoAim(e.target.checked);
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
  if (!panelEl.hidden && (e.code === 'KeyG' || e.code === 'KeyC' || e.code === 'KeyI' || e.code === 'KeyB')) return closePanel();
  if (modal && (e.code === 'KeyG' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); return modal(); }
  if (paused) return;
  keys.add(e.code);
  if (e.code === 'Space') { input.dash = true; e.preventDefault(); }
  if (e.code === 'KeyG') input.interact = true;
  if (e.code === 'KeyQ' || e.code === 'Digit1') input.s1 = true;
  if (e.code === 'KeyE' || e.code === 'Digit2') input.s2 = true;
  if (e.code === 'KeyR' || e.code === 'Digit3') input.s3 = true;
  if (e.code === 'KeyF' || e.code === 'Digit4') input.s4 = true;
  if (e.code === 'KeyT') { setAutoAim(!getAutoAim()); renderer.banner = { text: getAutoAim() ? '자동 조준 켜짐' : '자동 조준 꺼짐', t: 1.2, color: '#7ad8ff' }; if (world.practice) showPracticePanel(); }
  if (e.code === 'KeyC' && (world.mode === 'plaza' || world.state === 'play') && !world.practice) openPanel('char'); // 던전 안에서도 스킬 · 스탯을 바꿀 수 있다 (재사용 대기는 스킬마다 그대로)
  if ((e.code === 'KeyI' || e.code === 'KeyB') && world.state === 'play') openPanel('bag');
  if (e.code === 'KeyX' && world.life && world.farmRect) { const sd = cycleSeed(world); renderer.banner = { text: sd ? `${GOODS[sd].name} (${save.bag[sd]}개)` : '씨앗이 없다', sub: sd ? '이 씨앗을 심는다 · X로 바꾸기' : '잡화점에서 씨앗을 산다', t: 1.6, color: '#c8e8a0' }; }
  if (e.code === 'KeyM' && world.map?.outdoor) renderer.bigMap = !renderer.bigMap;
  if (e.code === 'KeyH' && world.state === 'play') eatQuick();
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
  const z = ZONES.find((x) => x.id === zoneId);
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
    else if (s.t === 'dive') { enterSeabed(s.x, s.y); return; }
    else if (s.t === 'surface') { exitSeabed(s.x, s.y, s.forced); return; }
    else if (s.t === 'enterHouse') { enterHouse(s.house, { x: s.x, y: s.y }); return; }
    else if (s.t === 'exitHouse') { exitHouse(); return; }
    else if (s.t === 'enterZone' && s.entrance) {
      // 입구: 안쪽 세계로 (권장 레벨보다 많이 낮으면 한 번 묻는다)
      if (world.zone?.id === 'world') save.zoneMemory.world = world.exportMemory();
      if (world.zone?.id === 'seabed') { save.zoneMemory.seabed = world.exportMemory(); seaStash = null; }
      const { base } = interiorZone(s.entrance), go = () => { curInterior = { id: s.entrance, x: s.x, y: s.y }; enterInterior(s.entrance); if (ENTRANCES[s.entrance]?.prop === 'hole') world.player.drop = { h: 170, v: 0 }; }; // 구멍: 위에서 떨어져 내린다
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
    else if (s.t === 'sleep') { showSleep(); return; }
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
        const carry = { loot: world.loot, discovered: world.discovered, hp: world.player.hp, mana: world.player.mana, aura: world.player.aura, codexStart: world.codexStart,
          rootMemory: world.depth ? world.rootMemory : world.exportMemory() };
        if (world.zone.key) enterInterior(world.zone.key, world.depth + 1, carry); else enterZone(world.zone.id, world.depth + 1, carry);
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
        world.player.hp = world.d.maxHp; world.player.mana = world.d.maxMana;
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
    else if (!paused && world.state === 'play') {
      acc += dt;
      readInput();
      while (acc >= DT) {
        world.step(input);
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
  if (save) { refreshQuests(save); writeSave(save); enterWorld(); } else showRaceSelect();
  requestAnimationFrame(frame);
})();

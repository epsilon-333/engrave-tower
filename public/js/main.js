// 진입점: 화면 전환(광장 ↔ 필드), 입력, 고정 틱 게임 루프
import { World, DT } from './sim/world.js';
import { computeBuild } from './sim/build.js';
import { Renderer } from './render/renderer.js';
import { loadAssets, sprite, frames } from './render/assets.js';
import { Hub, renderRaceSelect } from './ui/hub.js';
import { newSave, loadSave, writeSave, clearSave, toLoadout, applyRun, refreshQuests, progressQuests, setSaveHook } from './save.js';
import { initCloud, cloudSave, cloudSaveNow, cloudDelete, onCloud, cloudLabel, cloud, isClaudePage, login, register, logout, errorText } from './cloud.js';
import { ECHOES, ZONES, MONSTERS } from './data/monsters.js';
import { RACES, RACE_MIGRATE } from './data/races.js';
import { ITEMS, STYLES } from './data/items.js';
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
const hub = new Hub(panelEl, () => save, (zone) => { closePanel(); enterZone(zone); }, resetGame, closePanel);

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
    <p class="muted">어떤 방식으로 싸울까요? 스타일에 맞는 시작 무기를 받습니다. 나중에 대장간에서 언제든 바꿀 수 있어요.</p>
    <div class="styles">${Object.entries(STYLES).map(([id, st]) => {
      const fit = st.races[race] || 0;
      return `<button class="style ${fit === 2 ? 'best' : fit ? 'good' : ''}" data-style="${id}">
        <b>${st.name}</b>${fit ? `<span class="fit">${fit === 2 ? '◎ 잘 맞음' : '○ 어울림'}</span>` : ''}
        <p>${st.desc}</p>
        <small>시작 무기: ${ITEMS[st.weapon].name}</small>
      </button>`;
    }).join('')}</div>
    <button class="ghost" id="backRace">← 종족 다시 고르기</button></div>`;
  titleEl.querySelectorAll('[data-style]').forEach((b) => (b.onclick = () => {
    const st = STYLES[b.dataset.style];
    sfx('levelup');
    save = newSave(race);
    save.style = b.dataset.style;
    save.items = ['rustySword', st.weapon];
    save.gear = { weapon: st.weapon };
    refreshQuests(save); writeSave(save); titleEl.hidden = true; enterPlaza(true);
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
  if (save) { refreshQuests(save); writeSave(save); enterPlaza(); } else showRaceSelect();
}

// 예전 저장 데이터를 새 구조로 옮긴다 (인간·드워프 → 기사, 없어진 슬롯·무기 정리)
function migrateSave(sv) {
  if (!sv) return sv;
  if (RACE_MIGRATE[sv.race]) sv.race = RACE_MIGRATE[sv.race];
  if (!RACES[sv.race]) sv.race = 'knight';
  if (sv.slots?.extra) delete sv.slots.extra;
  sv.items = (sv.items || []).filter((id) => ITEMS[id]);
  if (!sv.items.includes('rustySword')) sv.items.push('rustySword');
  if (!sv.gear?.weapon || !ITEMS[sv.gear.weapon]) sv.gear = { ...(sv.gear || {}), weapon: 'rustySword' };
  for (const k of Object.keys(sv.gear)) if (sv.gear[k] && !ITEMS[sv.gear[k]]) delete sv.gear[k];
  return sv;
}

const buildNow = () => computeBuild(toLoadout(save));

function enterPlaza(first) {
  world = new World({ build: buildNow(), mode: 'plaza', seed: 1, map: plazaMap });
  world.questReady = (save.quests || []).some((q) => q.done);
  renderer.setWorld(world);
  startMusic('plaza');
  startLoop();
  if (first || !save.tutorial) showTutorial();
}

function enterZone(id, depth = 0, carry = null) {
  const z = ZONES.find((x) => x.id === id);
  save.zoneSeeds ||= {}; save.zoneMemory ||= {};
  if (save.zoneSeeds[id] == null) { save.zoneSeeds[id] = ((save.seed >>> 0) + z.floor * 7919 + Math.floor(Math.random() * 1e6)) >>> 0; writeSave(save); }
  // 지하층은 매번 새로 생성 (기억은 1층만)
  const seed = depth ? (save.zoneSeeds[id] + depth * 104729 + Math.floor(Math.random() * 1e6)) >>> 0 : save.zoneSeeds[id];
  world = new World({ build: buildNow(), mode: 'field', zoneId: id, seed, depth, memory: depth ? null : save.zoneMemory[id] });
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
      <p><b>6.</b> 필드에는 <b>야영지</b>(잔향 맡기기), <b>떠돌이 상인</b>, <b>낡은 제단</b>(축복과 대가), 가장 깊은 곳의 <b>아래층 계단</b>이 있어요.</p>
      <p class="keys">WASD 이동 · 마우스 조준 · 좌클릭 공격 · Q/우클릭 무기 스킬 · Space 대시(무적) · R 오러(기사) · E 상호작용 · C 캐릭터 · Esc 메뉴</p>
      ${touch ? '<p class="keys">모바일: 왼쪽 조이스틱 이동 · 오른쪽 조이스틱을 누르면 공격(밀면 그 방향 조준, 그냥 누르면 가까운 적 자동 조준) · 버튼으로 스킬·대시·상호작용</p>' : ''}
      <p class="muted">빨갛게 번쩍이는 적은 곧 공격합니다. 대시로 피하세요!</p>
    </div>
    <button data-close>시작하기</button>`);
}

// ───── 패널 (광장 시설) ─────
function openPanel(tab) {
  touch?.reset();
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
  overlay.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => modal()));
}

function endRun(kind) {
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
  (save.zoneMemory ||= {})[world.zone.id] = world.depth ? world.rootMemory || save.zoneMemory[world.zone.id] : world.exportMemory();
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
    <p>골드 +${res.gold} · 경험치 +${res.xp} · 상자 ${world.loot.chests}개 · 탐험 ${Math.round(world.exploredPct() * 100)}%</p>
    ${res.ups ? `<p class="lvup">레벨 업! Lv ${save.level} · 스탯 포인트 +${res.ups * 3} (수련 교관에게 가세요)</p>` : ''}
    ${world.discovered.size ? '<p class="lvup">새로 발견한 원소 반응이 서고에 기록되었습니다.</p>' : ''}
    ${done ? `<p class="lvup">완료한 의뢰 ${done}개! 게시판에서 보상을 받으세요.</p>` : ''}
    <button data-close>광장으로</button>`, () => { overlay.hidden = true; enterPlaza(); });
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
    ${field ? '<button id="retreat" class="ghost">긴급 귀환 (잔향 70% 보존)</button><p class="muted">시작 지점의 귀환 포탈로 돌아가면 잔향을 전부 지킬 수 있습니다. 야영지에 맡긴 잔향은 죽어도 잃지 않아요.</p>' : '<button id="howto" class="ghost">조작법 보기</button>'}
    ${volumeHtml()}
    ${isClaudePage() ? '' : cloud.mode === 'account' ? `<p class="muted">${esc(cloud.name)} 계정으로 로그인 중</p><button id="logoutBtn" class="ghost">로그아웃</button>` : '<button id="loginBtn" class="ghost">로그인 / 회원가입</button>'}`);
  bindVolume();
  const lo = document.getElementById('logoutBtn'), li = document.getElementById('loginBtn');
  if (lo) lo.onclick = async () => { await logout(); clearSave(); save = null; world = null; overlay.hidden = true; paused = false; modal = null; showLogin(afterLogin); };
  if (li) li.onclick = () => { overlay.hidden = true; paused = false; modal = null; world = null; showLogin(afterLogin); };
  if (field) document.getElementById('retreat').onclick = () => { overlay.hidden = true; endRun('retreat'); };
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
const input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dash: false, interact: false, skill: false, aura: false };
let mouseCX = innerWidth / 2, mouseCY = innerHeight / 2;
addEventListener('keydown', (e) => {
  unlockAudio();
  if (!world || gameEl.hidden) return;
  if (e.code === 'Escape') { e.preventDefault(); return escAction(); }
  if (!panelEl.hidden && (e.code === 'KeyE' || e.code === 'KeyC')) return closePanel();
  if (modal && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); return modal(); }
  if (paused) return;
  keys.add(e.code);
  if (e.code === 'Space') { input.dash = true; e.preventDefault(); }
  if (e.code === 'KeyE') input.interact = true;
  if (e.code === 'KeyQ') input.skill = true;
  if (e.code === 'KeyR') input.aura = true;
  if (e.code === 'KeyC' && world.mode === 'plaza') openPanel('char');
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); input.attack = false; });
canvas.addEventListener('mousemove', (e) => { mouseCX = e.clientX; mouseCY = e.clientY; });
canvas.addEventListener('mousedown', (e) => { unlockAudio(); if (touch) return; if (e.button === 0 && !paused) input.attack = true; if (e.button === 2 && !paused) input.skill = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) input.attack = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointerdown', () => unlockAudio(), { once: true });

let touch = null;
function readInput() {
  if (touch) { touch.apply(); return; }
  input.moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  input.moveY = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
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

function handleSignals() {
  for (const s of world.signals) {
    if (s.t === 'openPanel') openPanel(s.panel);
    else if (s.t === 'enterZone') {
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
        const carry = { loot: world.loot, discovered: world.discovered, hp: world.player.hp, mana: world.player.mana, aura: world.player.aura,
          rootMemory: world.depth ? world.rootMemory : world.exportMemory() };
        enterZone(world.zone.id, world.depth + 1, carry);
      };
      return;
    } else if (s.t === 'merchant') {
      showMerchant(s.zone);
      return;
    } else if (s.t === 'lore') {
      sfx('lore');
      showModal(`<h2>고대 석판</h2><p class="lore">${s.text}</p><p class="muted">(서고에 기록됨)</p><button data-close>닫기</button>`);
    }
  }
  world.signals.length = 0;
}

function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000 || 0);
  last = ts;
  if (world && !gameEl.hidden) {
    if (renderer.hitstop > 0) renderer.hitstop -= dt;
    else if (!paused && world.state === 'play') {
      acc += dt;
      readInput();
      while (acc >= DT) {
        world.step(input);
        input.dash = false; input.interact = false; input.skill = false; input.aura = false;
        acc -= DT;
        if (world.signals.length) { handleSignals(); break; }
      }
    }
    if (world.state === 'dead' || world.state === 'done') {
      endTimer += dt;
      if (endTimer > (world.state === 'dead' ? 1.4 : 0.3)) endRun(world.state === 'dead' ? 'dead' : 'clear');
    }
    renderer.consume(world);
    renderer.draw(world, paused ? 0 : dt);
  }
  requestAnimationFrame(frame);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
window.__game = { get world() { return world; }, renderer }; // 디버그용

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
  if (save) { refreshQuests(save); writeSave(save); enterPlaza(); } else showRaceSelect();
  requestAnimationFrame(frame);
})();

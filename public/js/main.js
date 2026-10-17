// 진입점: 화면 전환(광장 ↔ 필드), 입력, 고정 틱 게임 루프
import { World, DT } from './sim/world.js';
import { computeBuild } from './sim/build.js';
import { Renderer } from './render/renderer.js';
import { loadAssets, sprite, frames } from './render/assets.js';
import { Hub, renderRaceSelect } from './ui/hub.js';
import { newSave, loadSave, writeSave, clearSave, toLoadout, applyRun, refreshQuests, progressQuests, setSaveHook } from './save.js';
import { initCloud, cloudSave, cloudSaveNow, cloudDelete, onCloud, cloudLabel, cloud, isClaudePage, login, register, logout, errorText } from './cloud.js';
import { ECHOES, ZONES } from './data/monsters.js';
import { RACE_ART } from './data/art.js';
import { buildPlaza } from './data/plaza.js';
import { unlockAudio, sfx, startMusic, getVolume, setVolume } from './audio.js';

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
  renderRaceSelect(titleEl, (race) => {
    unlockAudio(); sfx('levelup');
    save = newSave(race); refreshQuests(save); writeSave(save); titleEl.hidden = true; enterPlaza(true);
  });
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
  if (remote) save = remote;
  else if (save && cloud.mode !== 'local') cloudSaveNow(save);
  if (save) { refreshQuests(save); writeSave(save); enterPlaza(); } else showRaceSelect();
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

function enterZone(id) {
  const z = ZONES.find((x) => x.id === id);
  world = new World({ build: buildNow(), mode: 'field', zoneId: id, seed: save.seed + z.floor * 7919 });
  renderer.setWorld(world);
  startMusic(id);
  sfx('open');
  startLoop();
}

function startLoop() {
  paused = false; endTimer = 0; acc = 0; modal = null;
  titleEl.hidden = true; gameEl.hidden = false; overlay.hidden = true; panelEl.hidden = true;
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
      <p class="keys">WASD 이동 · 마우스 조준 · 좌클릭 공격 · Q 스킬 · Space 대시(무적) · E 상호작용 · C 캐릭터 · Esc 메뉴</p>
      <p class="muted">빨갛게 번쩍이는 적은 곧 공격합니다. 대시로 피하세요!</p>
    </div>
    <button data-close>시작하기</button>`);
}

// ───── 패널 (광장 시설) ─────
function openPanel(tab) {
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
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.hidden = false; paused = true;
  modal = onClose || (() => { overlay.hidden = true; paused = false; modal = null; sfx('close', { vol: 0.4 }); });
  overlay.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => modal()));
}

function endRun(kind) {
  const keep = kind === 'clear' ? 1 : kind === 'retreat' ? 0.7 : 0.5;
  const res = applyRun(save, world.loot, keep, world.discovered);
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
    <p class="muted">${kind === 'clear' ? '잔향을 모두 가져왔다.' : kind === 'retreat' ? '잔향의 70%만 지켰다.' : '잔향의 절반을 잃었다.'}</p>
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
    ${field ? '<button id="retreat" class="ghost">긴급 귀환 (잔향 70% 보존)</button><p class="muted">시작 지점의 계단으로 돌아가면 잔향을 전부 지킬 수 있습니다.</p>' : '<button id="howto" class="ghost">조작법 보기</button>'}
    ${volumeHtml()}
    ${isClaudePage() ? '' : cloud.mode === 'account' ? `<p class="muted">${esc(cloud.name)} 계정으로 로그인 중</p><button id="logoutBtn" class="ghost">로그아웃</button>` : '<button id="loginBtn" class="ghost">로그인 / 회원가입</button>'}`);
  bindVolume();
  const lo = document.getElementById('logoutBtn'), li = document.getElementById('loginBtn');
  if (lo) lo.onclick = async () => { await logout(); clearSave(); save = null; world = null; overlay.hidden = true; paused = false; modal = null; showLogin(afterLogin); };
  if (li) li.onclick = () => { overlay.hidden = true; paused = false; modal = null; world = null; showLogin(afterLogin); };
  if (field) document.getElementById('retreat').onclick = () => { overlay.hidden = true; endRun('retreat'); };
  else document.getElementById('howto').onclick = () => showTutorial();
}

// ───── 입력 ─────
const keys = new Set();
const input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, attack: false, dash: false, interact: false, skill: false };
let mouseCX = innerWidth / 2, mouseCY = innerHeight / 2;
addEventListener('keydown', (e) => {
  unlockAudio();
  if (!world || gameEl.hidden) return;
  if (e.code === 'Escape') {
    e.preventDefault();
    if (!panelEl.hidden) return closePanel();
    if (modal) return modal();
    if (world.state === 'play') showPause();
    return;
  }
  if (!panelEl.hidden && (e.code === 'KeyE' || e.code === 'KeyC')) return closePanel();
  if (modal && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); return modal(); }
  if (paused) return;
  keys.add(e.code);
  if (e.code === 'Space') { input.dash = true; e.preventDefault(); }
  if (e.code === 'KeyE') input.interact = true;
  if (e.code === 'KeyQ') input.skill = true;
  if (e.code === 'KeyC' && world.mode === 'plaza') openPanel('char');
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); input.attack = false; });
canvas.addEventListener('mousemove', (e) => { mouseCX = e.clientX; mouseCY = e.clientY; });
canvas.addEventListener('mousedown', (e) => { unlockAudio(); if (e.button === 0 && !paused) input.attack = true; if (e.button === 2 && !paused) input.skill = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) input.attack = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointerdown', () => unlockAudio(), { once: true });

function readInput() {
  input.moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  input.moveY = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  const p = renderer.toWorld(mouseCX, mouseCY);
  input.aimX = p.x; input.aimY = p.y;
}

addEventListener('resize', () => renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1));

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
        input.dash = false; input.interact = false; input.skill = false;
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

(async () => {
  const [, , , remote] = await Promise.all([loadAssets(), document.fonts?.load('11px Galmuri11').catch(() => {}), document.fonts?.load('bold 11px Galmuri11').catch(() => {}), initCloud()]);
  // 서버 저장과 브라우저 저장 중 더 최근 것을 사용
  if (remote && (!save || (remote.updatedAt || 0) >= (save.updatedAt || 0))) save = remote;
  setSaveHook(cloudSave);
  if (save && remote !== save) cloudSave(save);
  let guest = false; try { guest = !!localStorage.getItem('et-guest'); } catch { /* 무시 */ }
  if (!isClaudePage() && cloud.mode === 'local' && !guest) { showLogin(afterLogin); requestAnimationFrame(frame); return; }
  if (save) { refreshQuests(save); writeSave(save); enterPlaza(); } else showRaceSelect();
  requestAnimationFrame(frame);
})();

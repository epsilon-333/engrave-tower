// 체험실 — 게임과 따로 열리는 페이지(lab.html). 캐릭터를 꾸미고 스승 · 보스 · 층 · 지역 · 몬스터를 바로 연다.
// 저장은 체험실 전용(진짜 저장 · 서버를 건드리지 않는다). 게임 본체(main.js)의 window.__lab · window.__game 을 쓴다.
import './main.js';
import { RACES } from './data/races.js';
import { ITEMS, WCAT_NAME } from './data/items.js';
import './data/weapons.js';
import './data/towergear.js';
import { ENGRAVINGS } from './data/engravings.js';
import { SLOTS } from './sim/build.js';
import { TEACHERS, HIDDEN } from './data/hidden.js';
import { ZONES, MONSTERS } from './data/monsters.js';
import { floorKind, actOf, CLIMB_TOP } from './data/climb.js';
import { SERIN_FLOORS } from './data/story.js';
import { DUNGEONS } from './data/dungeons.js';
import { ENTRANCES } from './data/maps/overworld.js';

const $ = (s, r = document) => r.querySelector(s);
const root = $('#lab');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = (t) => { const el = $('#toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (el.style.display = 'none'), 2200); };
const lab = () => window.__lab;
const SLOT_NAME = { head: '머리', arm: '팔', heart: '심장', leg: '다리', back: '등' };
const KIND_LABEL = { guardian: '수호자', lord: '주인' };

const weapons = Object.entries(ITEMS).filter(([, it]) => it.weapon && it.slot === 'weapon').sort((a, b) => (WCAT_NAME[a[1].cat] || '').localeCompare(WCAT_NAME[b[1].cat] || '', 'ko'));
const offs = Object.entries(ITEMS).filter(([, it]) => it.slot === 'off');
// 패시브 칸(등)에서는 패시브 각인을 모두 고를 수 있다
const engBySlot = (sl) => Object.entries(ENGRAVINGS).filter(([, e]) => e.slot === sl || (sl === 'back' && e.passiveOnly)).sort((a, b) => a[1].grade - b[1].grade || a[1].name.localeCompare(b[1].name, 'ko'));
const bossFloors = []; for (let f = 1; f <= CLIMB_TOP; f++) { const k = floorKind(f); if (k === 'guardian' || k === 'lord') bossFloors.push(f); }
const mons = Object.entries(MONSTERS).sort((a, b) => (b[1].boss ? 1 : 0) - (a[1].boss ? 1 : 0) || a[1].name.localeCompare(b[1].name, 'ko'));

const PRESETS = {
  none: ['없음', {}],
  res: ['자원 각인 (패시브 + 액티브)', { head: 'rQuiet', arm: 'rArrow', heart: 'rFlame', leg: 'rDodge', back: 'rHurt' }],
  hidden: ['숨은 각인 (마력 폭주 · 발도 …)', {}],
};
const hiddenSlots = () => { const out = {}; HIDDEN.slice(0, SLOTS.length).forEach((h, i) => (out[SLOTS[i]] = 'h_' + h.id)); return out; };

root.innerHTML = `
<div class="bar"><h1>체험실</h1><button data-a="min">접기</button></div>
<div class="muted">게임과 따로 저장돼요. 진짜 저장 · 서버는 건드리지 않아요.</div>

<h2>1. 캐릭터 꾸미기</h2>
<div class="row"><label>종족</label><select id="race">${Object.entries(RACES).map(([id, r]) => `<option value="${id}">${esc(r.name)}</option>`).join('')}</select>
  <label style="min-width:0">레벨</label><select id="level">${[10, 20, 30, 50, 80, 100].map((l) => `<option ${l === 50 ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
<div class="row"><label>무기</label><select id="weapon"><option value="">(종족 기본)</option>${weapons.map(([id, it]) => `<option value="${id}">[${esc(WCAT_NAME[it.cat] || it.cat || '')}] ${esc(it.name)}</option>`).join('')}</select></div>
<div class="row"><label>왼손</label><select id="off"><option value="">(자동)</option>${offs.map(([id, it]) => `<option value="${id}">${esc(it.name)}</option>`).join('')}</select></div>
<div class="row"><label>세트</label><select id="preset">${Object.entries(PRESETS).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join('')}</select></div>
${SLOTS.map((sl) => `<div class="row"><label>${SLOT_NAME[sl] || sl}</label><select data-slot="${sl}"><option value="">(비움)</option>${engBySlot(sl).map(([id, e]) => `<option value="${id}">★${e.grade} ${esc(e.name)}${e.passiveOnly ? " · 패시브" : ""}</option>`).join('')}</select></div>`).join('')}
<label class="chk"><input type="checkbox" id="allHidden"> 숨은 각인 24개 전부 얻은 상태</label>
<div class="muted" id="cur"></div>
<div class="row"><button class="go" data-a="build">이 캐릭터로 마을에 서기</button><button data-a="home">마을로</button></div>
<div class="muted">각인은 모두 5개씩 가지고 있어서, 게임 안 공명 제단에서도 바꿔 끼울 수 있어요.</div>

<h2>2. 스승과 결투 (숨은 스승의 방)</h2>
<div class="row">${Object.entries(TEACHERS).map(([fam, t]) => `<button data-a="trial" data-v="${fam}">${esc(t.name)}</button>`).join('')}</div>
<div class="muted">이기면 그 스승의 숨은 각인을 얻어요. 체력이 다하면 실패(죽지 않음).</div>

<h2>3. 탑 · 보스와 대결</h2>
<div class="row"><label>층</label><input type="number" id="floor" min="1" max="${CLIMB_TOP}" value="5" style="width:64px"><button class="go" data-a="tower">이 층으로</button></div>
<div class="row">${bossFloors.map((f) => `<button data-a="tower" data-v="${f}" title="${esc(actOf(f).name)}">${f}층 ${KIND_LABEL[floorKind(f)]}</button>`).join('')}</div>
<div class="muted">세린의 일지 층(금 간 벽 너머):</div>
<div class="row">${Object.keys(SERIN_FLOORS).map((f) => `<button data-a="tower" data-v="${f}">${f}층</button>`).join('')}</div>

<h2>4. 지역 · 던전 · 연습장 · 새 게임</h2>
<div class="row"><select id="zone">${ZONES.map((z) => `<option value="${z.id}">${esc(z.name)}</option>`).join('')}</select><button data-a="zone">들어가기</button></div>
<div class="row"><select id="dungeon">${Object.entries(DUNGEONS).sort((a, b) => a[1].lv - b[1].lv).map(([id, d]) => `<option value="${id}">Lv ${d.lv} ${esc(ENTRANCES[id]?.name || id)} · ${esc(MONSTERS[d.boss]?.name || '')}</option>`).join('')}</select><button data-a="dungeon">던전 들어가기</button></div>
<div class="row"><button data-a="practice">연습장(허수아비 · 무리)</button><button data-a="dream">새 게임 처음부터(꿈 → 집 → 촌장)</button></div>

<h2>5. 몬스터 부르기 (지금 있는 곳에)</h2>
<div class="row"><select id="mon">${mons.map(([id, m]) => `<option value="${id}">${m.boss ? '★ ' : ''}${esc(m.name)}</option>`).join('')}</select><input type="number" id="monN" min="1" max="12" value="1" style="width:50px"><button data-a="spawn">부르기</button></div>

<h2>6. 치트 (켜 두는 것)</h2>
<label class="chk"><input type="checkbox" data-cheat="god"> 무적(체력 항상 가득)</label>
<label class="chk"><input type="checkbox" data-cheat="res"> 자원 항상 가득</label>
<label class="chk"><input type="checkbox" data-cheat="cd"> 스킬 쿨타임 없음</label>
<div class="muted">조작: WASD 이동 · 좌클릭 공격 · 우클릭 무기 능력 · Q E R F 스킬 · G 상호작용 · Esc 메뉴</div>
`;

const selVal = (id) => $('#' + id).value;
const fillSlots = (m) => { for (const el of root.querySelectorAll('[data-slot]')) el.value = m[el.dataset.slot] || ''; };
$('#preset').onchange = () => { const k = selVal('preset'); fillSlots(k === 'hidden' ? hiddenSlots() : PRESETS[k][1]); if (k === 'hidden') $('#allHidden').checked = true; };
const cfg = () => ({ race: selVal('race'), level: +selVal('level'), weapon: selVal('weapon'), off: selVal('off') || null, hidden: $('#allHidden').checked, slots: Object.fromEntries([...root.querySelectorAll('[data-slot]')].map((el) => [el.dataset.slot, el.value])) });
// 장면 버튼을 누를 때: 캐릭터가 없거나 위에서 고른 설정(종족 · 레벨 · 무기 · 각인)이 지금 캐릭터와 다르면 새로 만든 뒤 연다
let built = null;
const status = () => { const el = $('#cur'); if (!el) return; const c = built; el.textContent = c ? `지금 캐릭터: ${RACES[c.race]?.name || c.race} · Lv ${c.level} · ${ITEMS[c.weapon]?.name || '종족 기본 무기'}` : '아직 캐릭터가 없어요 (장면 버튼을 누르면 위 설정으로 만들어요)'; };
const needSave = () => {
  const c = cfg();
  if (!lab()?.save || !built || JSON.stringify(c) !== JSON.stringify(built)) { lab().build(c); built = JSON.parse(JSON.stringify(c)); status(); }
  return true;
};
const A = {
  min: () => { root.classList.toggle('min'); $('[data-a=min]').textContent = root.classList.contains('min') ? '체험실 열기' : '접기'; },
  build: () => { const c = cfg(); lab().build(c); built = JSON.parse(JSON.stringify(c)); status(); toast('마을에 섰어요'); },
  home: () => { if (needSave()) lab().home(); },
  trial: (v) => { if (needSave()) { lab().trial(v); toast('스승의 방'); } },
  tower: (v) => { if (!needSave()) return; const f = +(v || selVal('floor')); lab().tower(f); toast(`탑 ${f}층`); },
  zone: () => { if (needSave()) lab().zone(selVal('zone')); },
  dungeon: () => { if (needSave()) { lab().dungeon(selVal('dungeon')); toast('던전'); } },
  practice: () => { if (needSave()) lab().practice(); },
  dream: () => { lab().dream(selVal('race')); toast('새 게임'); },
  spawn: () => { if (needSave()) lab().spawn(selVal('mon'), +selVal('monN') || 1); },
};
const SCENES = new Set(['build', 'home', 'trial', 'tower', 'zone', 'dungeon', 'practice', 'dream']); // 장면이 열리면 패널을 접어 화면을 가리지 않게
root.addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (!b) return; e.preventDefault(); const a = b.dataset.a; A[a]?.(b.dataset.v); if (SCENES.has(a) && !root.classList.contains('min')) A.min(); b.blur(); });
// 키보드로 꾸미는 중에 게임이 키를 가져가지 않게
root.addEventListener('keydown', (e) => e.stopPropagation());

const cheat = {};
root.addEventListener('change', (e) => { const c = e.target.dataset?.cheat; if (c) cheat[c] = e.target.checked; });
setInterval(() => {
  const w = window.__game?.world; if (!w?.player || w.state === 'dead') return;
  const p = w.player;
  if (cheat.god) { p.hp = w.d.maxHp; p.invuln = Math.max(p.invuln || 0, 0.2); }
  if (cheat.res) p.res = 100;
  if (cheat.cd) p.cds = {};
}, 100);

status();

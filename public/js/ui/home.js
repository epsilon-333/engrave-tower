// 집 · 생활 화면: 보관함(가방 ↔ 보관함) · 부엌(요리) · 작업대/대장간(무기 만들기) · 기술 배우기 · 먹기
import { GOODS, GOOD_CATS, BAG_START, BAG_UPGRADES, bagUsed, bagFits } from '../data/goods.js';
import { FOOD, FOOD_EFFECTS, KIND_NAME, cookPreview, registerDish, parseDish, dishName, dishEffectText, eatInfo, rawEdible, RECIPES } from '../data/cooking.js';
import { WTYPES, WMATS, PART_FX, SYNERGY, craftCost, craftItem } from '../data/crafting.js';
import { ITEMS, WEAPON_SKILLS, WCAT_NAME, weaponCat } from '../data/items.js';
import { SKILLS, ROLE_COLOR, KIND_NAME as SKILL_KIND, skillFit, handFit, crossMul, crossReq, fitText, plainDesc, skillLoad } from '../data/skills.js';
import { STAT_INFO } from '../data/stats.js';
import { SPIRITS, SPIRIT_GRADES, spiritBuffText } from '../data/spirits.js';
import { spiritIconURL } from '../render/spirits.js';
import { LEARN, WHERE_NAME, TABLET_BIOME_NAME } from '../data/learn.js';
import { RACES } from '../data/races.js';
import { iconURL } from '../render/icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const josa = (word, a, b) => { const c = word.charCodeAt(word.length - 1) - 0xac00; return word + (c >= 0 && c < 11172 && c % 28 ? a : b); };
const ico = (key, cls = '') => `<img class="gi ${cls}" src="${iconURL(key)}" alt="">`;
const cap = (s) => s.bagCap || BAG_START;
export const bagLine = (s) => { const u = bagUsed(s.bag || {}), c = cap(s); return `<span class="${u >= c ? 'warn' : ''}">가방 ${u}/${c}칸</span>`; };
const lifeOfSave = (s) => ({ bag: s.bag, cap: cap(s) });
// 물건 설명 (부산물이면 무기에 넣었을 때 붙는 능력까지)
export function goodTitle(id) {
  const g = GOODS[id] || registerDish(id);
  if (!g) return id;
  let t = `${g.name} — ${g.desc || ''}`;
  if (PART_FX[id]) t += '\n무기에 넣으면: ' + craftItem({ type: 'sword', mat: 'iron', parts: [id] }).lines.join(' · ');
  if (FOOD[id]) { const f = FOOD[id]; t += `\n요리 재료: ${KIND_NAME[f.kind]} · 회복 ${f.heal}%${f.eff ? ` · ${FOOD_EFFECTS[f.eff].name} ${'★'.repeat(f.p)}` : ''}`; }
  return t;
}

// ───── 보관함: 가방과 집 보관함 사이에서 옮긴다 (보관함은 칸 제한 없음) ─────
export function storageTab(s) {
  s.chest ||= {};
  const row = (id, n, from) => {
    const g = GOODS[id] || registerDish(id);
    if (!g) return '';
    return `<div class="good mv" title="${esc(goodTitle(id))}">${ico(id)}<b>${n}</b><span>${g.name}</span>
      <div class="mvb"><button class="sm" data-act="${from === 'bag' ? 'store' : 'take'}" data-id="${id}" data-n="1">1</button><button class="sm" data-act="${from === 'bag' ? 'store' : 'take'}" data-id="${id}" data-n="${n}">모두</button></div></div>`;
  };
  const list = (obj, from) => {
    const groups = {};
    for (const [id, n] of Object.entries(obj)) { if (!(n > 0)) continue; const g = GOODS[id] || registerDish(id); if (g) (groups[g.cat] ||= []).push([id, n]); }
    return Object.keys(GOOD_CATS).filter((c) => groups[c]).map((c) => `<h4>${GOOD_CATS[c]}</h4><div class="goods">${groups[c].map(([id, n]) => row(id, n, from)).join('')}</div>`).join('') || '<p class="muted">비어 있다.</p>';
  };
  const quick = Object.entries(GOOD_CATS).filter(([c]) => Object.entries(s.bag || {}).some(([id, n]) => n > 0 && GOODS[id]?.cat === c));
  return `<section class="panel"><h3>보관함 <small>집에 두고 다니는 물건 · 칸 제한 없음</small></h3>
      <p class="muted">${bagLine(s)} · 물건 종류마다 한 칸 (같은 물건은 몇 개든 한 칸). 가방이 가득 차면 새 물건을 주울 수 없다. 잡화점에서 가방을 늘릴 수 있다.</p>
      <div class="qbtns">${quick.map(([c, n]) => `<button class="sm ghost" data-act="storeCat" data-id="${c}">${n} 모두 넣기</button>`).join('')}</div></section>
    <div class="cols"><section class="panel"><h3>가방</h3>${list(s.bag || {}, 'bag')}</section>
    <section class="panel"><h3>보관함</h3>${list(s.chest, 'chest')}</section></div>`;
}

// ───── 부엌: 재료 5개까지 → 요리 ─────
export function cookTab(s, ui) {
  s.chest ||= {};
  const pot = ui.pot ||= [];
  const have = (id) => (s.bag?.[id] || 0) + (s.chest?.[id] || 0) - pot.filter((x) => x === id).length;
  const pv = cookPreview(pot);
  const slots = Array.from({ length: 5 }, (_, i) => pot[i]
    ? `<button class="potslot on" data-act="potOut" data-n="${i}" title="${esc(GOODS[pot[i]].name)}">${ico(pot[i])}</button>`
    : '<span class="potslot"></span>').join('');
  let result = '<p class="muted">재료를 넣어 보세요. 무엇을 넣느냐에 따라 요리 이름과 효과가 달라진다.</p>';
  if (pv) {
    const d = { recipe: pv.recipe, eff: pv.eff, lvl: pv.lvl, heal: pv.heal };
    result = `<div class="cookres">${ico(pv.key, 'big')}<div><b>${dishName(d)}${pv.lvl ? ' ' + '★'.repeat(pv.lvl) : ''}</b><br>
      <small>회복: 최대 체력의 ${pv.heal}%${pv.eff ? ` · <span style="color:${FOOD_EFFECTS[pv.eff].color}">${dishEffectText(d)}</span>` : pv.mixed ? ' · <span class="warn">효과가 다른 재료가 섞여 효과는 사라졌다 (회복만)</span>' : ''} · 팔면 ◆ ${pv.price}</small></div>
      <button data-act="cook" ${bagFits(lifeOfSave(s), pv.key) || true ? '' : 'disabled'}>요리하기</button></div>`;
  }
  const ing = Object.keys(FOOD).filter((id) => have(id) > 0 && GOODS[id]);
  const byKind = {};
  for (const id of ing) (byKind[FOOD[id].kind] ||= []).push(id);
  const ingHtml = Object.keys(KIND_NAME).filter((k) => byKind[k]).map((k) => `<h4>${KIND_NAME[k]}</h4><div class="goods">${byKind[k].map((id) => {
    const f = FOOD[id];
    return `<button class="good ing" data-act="potIn" data-id="${id}" title="${esc(goodTitle(id))}" ${pot.length >= 5 ? 'disabled' : ''}>${ico(id)}<b>${have(id)}</b><span>${GOODS[id].name}</span><em>${f.heal}%${f.eff ? ` · <i style="color:${FOOD_EFFECTS[f.eff].color}">${FOOD_EFFECTS[f.eff].name}${'★'.repeat(f.p)}</i>` : ''}</em></button>`;
  }).join('')}</div>`).join('') || '<p class="muted">요리할 재료가 없다. 물고기를 낚고, 채소를 키우고, 약초 · 버섯 · 산딸기를 따고, 짐승을 잡아 고기를 얻자.</p>';
  const known = Object.keys(s.dishLog || {}).length;
  const book = RECIPES.filter((r) => r.id !== 'stew').map((r) => s.dishLog?.[r.id] ? `<span class="chip on">${r.name}</span>` : '<span class="chip off">???</span>').join('');
  return `<section class="panel"><h3>부엌 <small>재료를 5개까지 넣는다 · 가방과 보관함의 재료를 함께 쓴다</small></h3>
      <div class="pot">${slots}</div>${result}
      <p class="muted">같은 효과의 재료끼리 모을수록 강하고(★~★★★) 오래간다. 효과가 다른 재료를 섞으면 효과는 사라진다. 요리는 가방에서 먹거나, 빠른 칸에 두고 <b>H</b>로 먹는다. 효과는 하나만 걸리고 새로 먹으면 바뀐다.</p></section>
    <section class="panel"><h3>재료</h3>${ingHtml}</section>
    <section class="panel"><h3>요리책 <small>${known}/${RECIPES.length - 1} · 새 요리를 만들 때마다 도감 +1</small></h3><div class="chips">${book}</div></section>`;
}

// ───── 무기 만들기 (집 작업대: 나무 · 돌 · 뼈 / 대장간: 모든 재료) ─────
export function craftTab(s, ui) {
  const forge = ui.station === 'shop';
  const cs = ui.craft ||= { type: 'sword', mat: 'wood', parts: [] };
  const T = WTYPES[cs.type];
  const mats = T.mats.filter((m) => forge || WMATS[m].bench);
  if (!mats.includes(cs.mat)) cs.mat = mats[0];
  const types = Object.entries(WTYPES).map(([id, t]) => `<button class="sm ${cs.type === id ? 'on' : 'ghost'}" data-act="cType" data-id="${id}">${t.name}</button>`).join('');
  const matBtns = mats.map((m) => { const M = WMATS[m]; return `<button class="sm ${cs.mat === m ? 'on' : 'ghost'}" data-act="cMat" data-id="${m}" title="${M.name}: 위력 ×${M.mul}">${ico(M.good)} ${M.name}</button>`; }).join('');
  const ownParts = Object.entries(s.bag || {}).filter(([id, n]) => n > 0 && PART_FX[id]);
  const partBtns = ownParts.map(([id, n]) => { const used = cs.parts.filter((x) => x === id).length; return `<button class="good ing" data-act="cPart" data-id="${id}" title="${esc(goodTitle(id))}" ${n - used <= 0 || cs.parts.length >= 2 ? 'disabled' : ''}>${ico(id)}<b>${n - used}</b><span>${GOODS[id].name}</span></button>`; }).join('') || '<p class="muted">몬스터 부산물이 없다. 몬스터를 잡으면 가끔 떨어뜨린다 (우두머리는 반드시).</p>';
  const chosen = [0, 1].map((i) => cs.parts[i] ? `<button class="potslot on" data-act="cPartOut" data-n="${i}" title="${esc(GOODS[cs.parts[i]].name)}">${ico(cs.parts[i])}<small>${esc(GOODS[cs.parts[i]].name)}</small></button>` : '<span class="potslot"></span>').join('');
  const it = craftItem({ type: cs.type, mat: cs.mat, parts: cs.parts }), cost = craftCost(cs.type, cs.mat, cs.parts);
  const ok = s.gold >= cost.gold && Object.entries(cost.mats).every(([id, n]) => (s.bag?.[id] || 0) >= n);
  const w = it.weapon, sk = WEAPON_SKILLS[w.skill];
  const matsHtml = Object.entries(cost.mats).map(([id, n]) => { const h = s.bag?.[id] || 0; return `<span class="mat ${h >= n ? 'ok' : 'no'}" title="${esc(GOODS[id]?.name || id)}">${ico(id)}<em>${esc(GOODS[id]?.name || id)}</em> ${h}/${n}</span>`; }).join('') + `<span class="mat ${s.gold >= cost.gold ? 'ok' : 'no'}">◆ ${cost.gold}</span>`;
  const crafted = s.items.filter((id) => ITEMS[id]?.crafted);
  const own = crafted.map((id) => { const c = ITEMS[id], eq = s.gear?.weapon === id; return `<div class="trow r3"><span><b${c.rarityColor ? ` style="color:${c.rarityColor}"` : ''}>${c.name}</b><small>${WCAT_NAME[c.cat]} · 피해 ×${c.weapon.mul} · 속도 ${c.weapon.speed}${c.lines.length ? ' · ' + c.lines.join(' · ') : ''}</small></span>
    <button class="sm" data-act="equipG" data-id="${id}" data-slot="weapon" ${eq ? 'disabled' : ''}>${eq ? '장착 중' : '장착'}</button><button class="sm ghost" data-act="scrap" data-id="${id}" ${eq ? 'disabled' : ''}>버리기</button></div>`; }).join('');
  return `<section class="panel"><h3>${forge ? '대장간 · 무기 만들기' : '작업대 · 무기 만들기'} <small>${forge ? '모든 재료를 다룬다' : '나무 · 돌 · 뼈 · 단단한 나무만 (광석 · 수정은 대장간에서)'}</small></h3>
      <h4>종류</h4><div class="chips">${types}</div><p class="muted">${T.desc} · 스킬 갈래: <b>${WCAT_NAME[T.cat]}</b></p>
      <h4>재료</h4><div class="chips">${matBtns}</div>
      <h4>몬스터 부산물 <small>2개까지 · 그 몬스터를 닮은 능력이 붙는다. 같은 것 둘은 능력이 깊어지고, 서로 다른 둘이 맞물리면 조합 능력</small></h4>
      <div class="pot">${chosen}</div><div class="goods">${partBtns}</div></section>
    <section class="panel"><h3>${esc(it.name)}</h3>
      <p>${w.kind === 'melee' ? '근접' : '원거리'} · ${w.dmg === 'phys' ? '물리' : '마법'} · 피해 ×${w.mul} · 속도 ${w.speed}${w.count ? ` · ${w.count}발` : ''}${w.pierce ? ` · 관통 ${w.pierce}` : ''}${w.mana && s.race === 'wizard' ? ` · 한 발에 마력 ${w.mana}` : ''}${sk ? ` · 우클릭: ${sk.name}` : ''}</p>
      <ul class="c-eff">${it.lines.map((l) => `<li>${esc(l)}</li>`).join('') || '<li class="muted">부산물을 넣으면 능력이 붙는다</li>'}</ul>
      <div class="mats">${matsHtml}</div><button data-act="craftW" ${ok ? '' : 'disabled'}>만들기</button></section>
    ${own ? `<section class="panel"><h3>만든 무기</h3><div class="tlist">${own}</div></section>` : ''}
    <section class="panel"><h3>조합 능력</h3><div class="list">${SYNERGY.map((x) => `<div class="li"><b>${x.name}</b> <small>${x.text}</small></div>`).join('')}</div></section>`;
}

// ───── 기술 배우기 (수련장: 무기술 · 서고: 마법) ─────
export function learnTab(s, ui, b) {
  const where = ui.station === 'codex' ? 'library' : 'dojo';
  const ids = Object.keys(LEARN).filter((id) => LEARN[id].where === where && SKILLS[id]);
  const resName = RACES[s.race].res.name;
  const cards = ids.map((id) => {
    const sk = SKILLS[id], L = LEARN[id], known = (s.learned || []).includes(id) || b.available.includes(id);
    const fit = handFit(sk, b).fit, cost = sk.costAll ? `${resName} ${sk.costAll.min}+ 전부` : sk.cost ? `${resName} ${sk.cost}` : sk.gain ? `${resName} +${sk.gain}` : '';
    const btn = known ? '<span class="muted">배움 ✔</span>' : s.level < L.lv ? `<span class="muted">Lv ${L.lv}부터</span>` : `<button class="sm" data-act="learn" data-id="${id}" ${s.gold >= L.gold ? '' : 'disabled'}>배우기 ◆ ${L.gold}</button>`;
    return `<div class="skc ${known ? 'on' : ''}" style="--c:${ROLE_COLOR[sk.role]}"><div class="c-head"><b>${sk.name}</b><span class="role">${SKILL_KIND[sk.kind]}</span></div>
      <div class="muted">재사용 ${sk.cd}초${cost ? ' · ' + cost : ''} · 지금 무기로: <b class="${fit <= 0 ? 'warn' : ''}">${fitText(fit)}</b></div><div class="c-sum">${esc(sk.desc)}</div><div class="c-act">${btn}</div></div>`;
  }).join('');
  const tablets = Object.entries(LEARN).filter(([, L]) => L.where === 'tablet').map(([id, L]) => `<span class="chip ${(s.learned || []).includes(id) ? 'on' : 'off'}">${(s.learned || []).includes(id) ? SKILLS[id].name : '???'} · ${TABLET_BIOME_NAME[L.biome]}</span>`).join('');
  return `<section class="panel"><h3>${where === 'dojo' ? '교관 가르의 무기술' : '사서 에일의 마법'} <small>클래스와 상관없이 누구나 배운다 · 배운 기술은 캐릭터 창(C)에서 Q·E·R·F에 넣는다</small></h3>
      <p class="muted">${where === 'dojo' ? '"무기를 바꾸면 쓸 수 있는 기술도 바뀐다네. 지팡이로는 제대로 못 베고, 활 없이는 못 쏘지."' : '"마법은 지팡이나 마도서가 있으면 온전히 나오지만, 맨손이면 힘이 덜 실려요."'}</p>
      <div class="skill-row">${cards}</div></section>
    ${where === 'dojo' ? `<section class="panel"><h3>옛 기술 석판 <small>섬 곳곳의 깊은 곳에 새겨진 기술 · 읽으면 바로 배운다</small></h3><div class="chips">${tablets}</div></section>` : ''}`;
}

// ───── 스킬 고르기 (캐릭터 창): 클래스 스킬 + 배운 기술 + 각인 스킬, 지금 무기와 맞는지 ─────
export function skillPickHtml(s, b) {
  const keys = ['Q', 'E', 'R', 'F'], resName = RACES[s.race].res.name;
  const card = (id, locked) => {
    const sk = SKILLS[id], i = b.skills.indexOf(id), on = i >= 0, hf = handFit(sk, b), fit = hf.fit;
    const cost = sk.costAll ? `${resName} ${sk.costAll.min}+` : sk.cost ? `${resName} ${sk.cost}` : sk.gain ? `${resName} +${sk.gain}` : '';
    const cm = crossMul(sk, b), cr = sk.race && sk.race !== s.race && !sk.scroll ? crossReq(sk) : null; // 다른 종족 기술
    const note = [hf.hand === 'off' && fit > 0 ? `왼손 ${b.offItem.name}으로` : '', cr ? `다른 종족 기술 · ${STAT_INFO[cr.stat].name} ${cr.full} 이상이면 온전히 (지금 ${Math.round(cm * 100)}%)` : ''].filter(Boolean).join(' · ');
    const btn = locked ? `<span class="muted">${sk.unlock}레벨에 배움</span>` : on ? `<button class="sm ghost" data-act="skillOff" data-id="${id}">빼기</button>${i > 0 ? `<button class="sm ghost" data-act="skillUp" data-id="${id}">앞으로</button>` : ''}` : `<button class="sm" data-act="skillOn" data-id="${id}">장착</button>`;
    return `<div class="skc ${on ? 'on' : ''} ${locked ? 'locked' : ''} ${fit <= 0 ? 'cant' : ''}" style="--c:${ROLE_COLOR[sk.role]}"><div class="c-head"><b>${on ? `[${keys[i]}] ` : ''}${sk.name}</b><span class="role">${SKILL_KIND[sk.kind]}</span></div>
      <div class="muted"><b class="sk-load">부하 ${skillLoad(id)}</b> · 재사용 ${sk.cd}초${cost ? ' · ' + cost : ''} · <b class="${fit <= 0 ? 'warn' : fit < 0.99 ? 'dim' : ''}">${fitText(fit)}</b>${note ? ` · ${note}` : ''}</div><div class="c-sum">${esc(cr ? plainDesc(sk) : sk.desc)}</div><div class="c-act">${btn}</div></div>`;
  };
  const cls = (b.available || []).filter((id) => SKILLS[id] && SKILLS[id].cls === b.cls);
  const locked = Object.keys(SKILLS).filter((id) => SKILLS[id].cls === b.cls && !cls.includes(id));
  const learned = (b.available || []).filter((id) => SKILLS[id] && (SKILLS[id].cls !== b.cls) && !SKILLS[id].engraving);
  const eng = (b.available || []).filter((id) => SKILLS[id]?.engraving);
  return `<section class="panel"><h3>스킬 <small>최대 4개 · Q / E / R / F · 무기: ${ITEMS[b.weaponId].name} (${WCAT_NAME[b.wcat] || b.wcat})</small></h3>
      <p class="sk-cap">스킬 부하 <b>${b.skillLoad} / ${b.skillCap}</b> <small>센 스킬일수록 무겁다 · 4레벨마다 한도 +1 · 센 스킬 하나와 가벼운 스킬 여럿 중에서 고른다</small></p>
      <p class="muted">무기에 맞지 않는 스킬은 약해지고(지팡이로 베기 → 30%), 아예 못 쓰는 것도 있다(활 없이 쏘기 · 방패 없이 방패 기술). <b>한손 무기</b>라면 왼손 도구(마법 부적 · 손쇠뇌 · 작은 방패 · 투척 주머니)를 함께 들어 모든 스킬을 쓸 수 있다 — 스킬은 두 손 중 더 맞는 쪽으로 나간다. 마법은 든 무기에 따라 모양이 바뀐다 (근접 무기: 앞을 휩쓰는 짧고 센 마법 · 활: 빠르고 멀리 가는 마법 화살).</p>
      <div class="skill-row">${cls.map((id) => card(id, false)).join('')}${locked.map((id) => card(id, true)).join('')}</div>
      <h4>배운 기술 <small>수련장 교관 · 서고 사서에게 배우거나, 섬의 옛 기술 석판을 읽는다</small></h4>
      <div class="skill-row">${learned.map((id) => card(id, false)).join('') || '<p class="muted">아직 없다. 마을 수련장 · 서고에 가 보자.</p>'}</div>
      ${eng.length ? `<h4>각인 스킬</h4><div class="skill-row">${eng.map((id) => card(id, false)).join('')}</div>` : ''}
      ${spiritPickHtml(s)}</section>`;
}
// 함께하는 정령 고르기 (계약은 세계수 성지에서)
function spiritPickHtml(s) {
  const own = Object.entries(s.spirits?.owned || {});
  if (!own.length) return '';
  own.sort((a, b) => SPIRITS[b[0]].grade - SPIRITS[a[0]].grade || b[1].star - a[1].star);
  return `<h4>함께하는 정령 <small>「정령 부르기」로 꺼낸다 · 계약은 세계수 성지의 「정령 계약」</small></h4><div class="sp-grid">${own.map(([id, o]) => {
    const sp = SPIRITS[id], G = SPIRIT_GRADES[sp.grade], on = s.spirits.main === id;
    return `<div class="spc ${on ? 'main' : ''}" style="--c:${G.color}"><img src="${spiritIconURL(id)}" alt=""><b>${esc(sp.name)}</b><small style="color:${G.color}">${G.name} · ${'★'.repeat(o.star)}</small><small>${esc(spiritBuffText(id, o.star))}</small>${on ? '<em>함께하는 중</em>' : `<button class="sm" data-act="spiritMain" data-id="${id}">함께하기</button>`}</div>`;
  }).join('')}</div>`;
}

// ───── 버튼 처리 (처리했으면 true) ─────
export function homeClick(hub, act, t) {
  const s = hub.s, id = t.dataset.id, n = +t.dataset.n || 1;
  s.bag ||= {}; s.chest ||= {};
  const life = lifeOfSave(s);
  switch (act) {
    case 'store': { const k = Math.min(n, s.bag[id] || 0); if (k > 0) { s.bag[id] -= k; s.chest[id] = (s.chest[id] || 0) + k; } return true; }
    case 'take': {
      const k = Math.min(n, s.chest[id] || 0);
      if (k > 0 && !bagFits(life, id)) { hub.toast('가방이 가득 찼다'); return true; }
      if (k > 0) { s.chest[id] -= k; s.bag[id] = (s.bag[id] || 0) + k; }
      return true;
    }
    case 'storeCat': { let c = 0; for (const [gid, k] of Object.entries(s.bag)) if (k > 0 && (GOODS[gid] || registerDish(gid))?.cat === id) { s.chest[gid] = (s.chest[gid] || 0) + k; s.bag[gid] = 0; c += k; } hub.toast(`${c}개를 보관함에 넣었다`); return true; }
    case 'potIn': { const pot = hub.pot ||= []; if (pot.length < 5) pot.push(id); return true; }
    case 'potOut': { hub.pot?.splice(n, 1); return true; }
    case 'cook': {
      const pot = hub.pot || [], pv = cookPreview(pot);
      if (!pv) return true;
      // 재료는 가방에서 먼저, 모자라면 보관함에서
      for (const gid of pot) { if (s.bag[gid] > 0) s.bag[gid]--; else if (s.chest[gid] > 0) s.chest[gid]--; }
      registerDish(pv.key);
      const toBag = bagFits(life, pv.key);
      if (toBag) s.bag[pv.key] = (s.bag[pv.key] || 0) + 1; else s.chest[pv.key] = (s.chest[pv.key] || 0) + 1;
      const first = !s.dishLog?.[pv.recipe];
      (s.dishLog ||= {})[pv.recipe] = (s.dishLog[pv.recipe] || 0) + 1;
      hub.pot = [];
      hub.onKnack?.('cook');
      hub.toast(`${GOODS[pv.key].name} 완성!${toBag ? '' : ' (가방이 가득 차서 보관함에 넣었다)'}${first ? ' · 새 요리 · 도감 +1' : ''}`);
      if (first) hub.onCodex?.();
      return true;
    }
    case 'eat': {
      const w = hub.getWorld?.();
      if (w && w.eat(id)) { const info = eatInfo(id); hub.toast(`${info.name}을(를) 먹었다 · 회복 ${Math.round(info.heal * 100)}%${info.eff ? ` · ${FOOD_EFFECTS[info.eff].name}` : ''}`); }
      else if (s.bag[id] > 0 && eatInfo(id)) { s.bag[id]--; hub.toast('먹었다'); }
      return true;
    }
    case 'spiritMain': if (s.spirits?.owned?.[id]) { s.spirits.main = id; hub.toast(`${SPIRITS[id].name}과(와) 함께한다`); } return true;
    case 'useItem': { // 물약 · 주문서: 귀환 · 이동은 창을 닫고 바로 옮겨 간다
      const w = hub.getWorld?.(), u = GOODS[id]?.use;
      if (!w || !u) return true;
      if (w.useItem(id)) { if (u.kind === 'return' || u.kind === 'teleport') hub.onClose(); else hub.toast(`${GOODS[id].name}${u.kind === 'potion' ? '을(를) 마셨다' : '을(를) 읽었다'}`); }
      else hub.toast(w.player.potionCd > 0 && u.kind === 'potion' ? `아직 마실 수 없다 (${Math.ceil(w.player.potionCd)}초)` : '지금은 쓸 수 없다');
      return true;
    }
    case 'quick': s.quickFood = s.quickFood === id ? null : id; hub.toast(s.quickFood ? `${GOODS[id].name} → 빠른 칸 (H로 먹기)` : '빠른 칸을 비웠다'); return true;
    case 'bagUp': {
      const cur = cap(s), nx = BAG_UPGRADES.find(([c]) => c > cur);
      if (nx && s.gold >= nx[1]) { s.gold -= nx[1]; s.bagCap = nx[0]; hub.toast(`가방이 ${nx[0]}칸으로 늘었다!`); }
      return true;
    }
    case 'cType': hub.craft = { ...(hub.craft || {}), type: id, parts: hub.craft?.parts || [] }; return true;
    case 'cMat': hub.craft.mat = id; return true;
    case 'cPart': { const c = hub.craft; if (c.parts.length < 2) c.parts.push(id); return true; }
    case 'cPartOut': hub.craft.parts.splice(n, 1); return true;
    case 'craftW': {
      const c = hub.craft, cost = craftCost(c.type, c.mat, c.parts);
      if (!(s.gold >= cost.gold && Object.entries(cost.mats).every(([gid, k]) => (s.bag[gid] || 0) >= k))) return true;
      s.gold -= cost.gold; for (const [gid, k] of Object.entries(cost.mats)) s.bag[gid] -= k;
      s.crafted ||= {}; s.craftSeq = (s.craftSeq || 0) + 1;
      const wid = `cw${s.craftSeq}`;
      s.crafted[wid] = { type: c.type, mat: c.mat, parts: [...c.parts] };
      ITEMS[wid] = craftItem(s.crafted[wid]);
      s.items.push(wid);
      hub.craft.parts = [];
      hub.toast(`${josa(ITEMS[wid].name, '을', '를')} 만들었다! 아래 '만든 무기'에서 장착한다`);
      return true;
    }
    case 'scrap': {
      if (!ITEMS[id]?.crafted || s.gear?.weapon === id) return true;
      const rec = s.crafted?.[id]; s.items = s.items.filter((x) => x !== id); delete s.crafted[id];
      if (rec) { const g = WMATS[rec.mat].good; s.bag[g] = (s.bag[g] || 0) + 1; }
      hub.toast('무기를 녹여 재료 1개를 돌려받았다');
      return true;
    }
    case 'learn': {
      const L = LEARN[id];
      if (!L || (s.learned || []).includes(id) || s.gold < L.gold || s.level < (L.lv || 1)) return true;
      s.gold -= L.gold; (s.learned ||= []).push(id);
      hub.toast(`「${SKILLS[id].name}」을(를) 배웠다! 캐릭터 창에서 장착한다`);
      return true;
    }
  }
  return false;
}

// 가방 칸의 '먹기' · '빠른 칸' 버튼
export function foodButtons(s, id) {
  const u = GOODS[id]?.use;
  if (u) return `<div class="mvb"><button class="sm" data-act="useItem" data-id="${id}">${u.kind === 'potion' ? '마시기' : '읽기'}</button></div>`; // 물약 · 주문서
  if (!eatInfo(id)) return '';
  return `<div class="mvb"><button class="sm" data-act="eat" data-id="${id}">먹기</button>${parseDish(id) ? `<button class="sm ${s.quickFood === id ? 'on' : 'ghost'}" data-act="quick" data-id="${id}">H</button>` : ''}</div>`;
}
// 잡화점: 가방 늘리기
export function bagUpgradeHtml(s) {
  const cur = cap(s), nx = BAG_UPGRADES.find(([c]) => c > cur);
  return `<section class="panel"><h3>가방 늘리기 <small>지금 ${cur}칸 · ${bagUsed(s.bag || {})}칸 사용 중</small></h3>
    ${nx ? `<div class="trow r3"><span><b>${cur}칸 → ${nx[0]}칸</b><small>"튼튼한 가죽으로 덧대 드리죠."</small></span><span class="price">◆ ${nx[1]}</span><button class="sm" data-act="bagUp" ${s.gold >= nx[1] ? '' : 'disabled'}>늘리기</button></div>` : '<p class="muted">더 늘릴 수 없다 (최대).</p>'}</section>`;
}

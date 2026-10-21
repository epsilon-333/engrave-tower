// 생활 화면: 가방 · 잡화점(사고팔기, 시세) · 대장간 제작(도구 강화 · 장비 만들기 · 무기 강화)
import { GOODS, GOOD_CATS, TOOLS, FORGE, REINFORCE, REINFORCE_MAX, SHOP_STOCK, buyPrice, sellPrice, market, toolUpgradeCost, FISH, ARTIFACTS } from '../data/goods.js';
import { ITEMS, WEAPON_SKILLS } from '../data/items.js';
import { STAT_INFO, SPECIAL_INFO } from '../data/stats.js';
import { iconURL, toolKey, toolName } from '../render/icons.js';
import { registerDish } from '../data/cooking.js';
import { bagLine, foodButtons, goodTitle, bagUpgradeHtml } from './home.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const josa = (word, a, b) => { const c = word.charCodeAt(word.length - 1) - 0xac00; return word + (c >= 0 && c < 11172 && c % 28 ? a : b); };
const ico = (key, cls = '') => `<img class="gi ${cls}" src="${iconURL(key)}" alt="">`;
const TOOL_ORDER = ['pickaxe', 'axe', 'shovel', 'hoe', 'can', 'rod'];
const statText = (st) => Object.entries(st || {}).map(([k, v]) => `${(STAT_INFO[k] || SPECIAL_INFO[k])?.name || k} ${v > 0 ? '+' : ''}${v}`).join(', ');
function weaponText(w) {
  if (!w) return '';
  const sk = WEAPON_SKILLS[w.skill];
  return `${w.kind === 'melee' ? '근접' : '원거리'} · ${w.dmg === 'phys' ? '물리' : '마법'} · 피해 ×${w.mul} · 속도 ${w.speed}${w.count ? ` · ${w.count}발` : ''}${w.pierce ? ` · 관통 ${w.pierce}` : ''}${sk ? ` · 우클릭: ${sk.name}` : ''}`;
}
// 재료 목록: 가진 수 / 필요한 수
function matsHtml(s, mats, gold) {
  const parts = Object.entries(mats).map(([id, n]) => { const have = s.bag?.[id] || 0; return `<span class="mat ${have >= n ? 'ok' : 'no'}" title="${esc(GOODS[id].name)}">${ico(id)}${have}/${n}</span>`; });
  if (gold) parts.push(`<span class="mat ${s.gold >= gold ? 'ok' : 'no'}">◆ ${gold}</span>`);
  return parts.join('');
}
const canPay = (s, mats, gold) => s.gold >= (gold || 0) && Object.entries(mats).every(([id, n]) => (s.bag?.[id] || 0) >= n);
function pay(s, mats, gold) { s.gold -= gold || 0; for (const [id, n] of Object.entries(mats)) s.bag[id] -= n; }

// ───── 가방 ─────
export function bagTab(s) {
  const tools = TOOL_ORDER.map((k) => {
    const t = s.tools?.[k] || 0;
    return `<div class="tool ${t ? '' : 'off'}">${t ? ico(toolKey(k, t)) : '<span class="gi"></span>'}<div><b>${t ? toolName(k, t) : TOOLS[k].name + ' 없음'}</b><small>${t ? TOOLS[k].what[t - 1] : ''}</small></div></div>`;
  }).join('');
  const groups = {};
  for (const [id, n] of Object.entries(s.bag || {})) { if (!(n > 0)) continue; const g = GOODS[id] || registerDish(id); if (g) (groups[g.cat] ||= []).push([id, n]); }
  const body = Object.keys(GOOD_CATS).filter((c) => groups[c]).map((c) => `<h4>${GOOD_CATS[c]}</h4><div class="goods">${groups[c].map(([id, n]) =>
    `<div class="good ${s.quickFood === id ? 'quick' : ''}" title="${esc(goodTitle(id))}">${ico(id)}<b>${n}</b><span>${GOODS[id].name}</span>${foodButtons(s, id)}</div>`).join('')}</div>`).join('')
    || '<p class="muted">가방이 비어 있다. 바위를 캐고, 나무를 베고, 반짝이는 흙을 파고, 물가에서 낚시를 해 보자.</p>';
  const fishN = Object.keys(s.fishLog || {}).length, artN = Object.keys(s.artifacts || {}).length;
  return `<section class="panel"><h3>도구 <small>대장간에서 더 좋은 도구로 바꿀 수 있다</small></h3><div class="tools">${tools}</div>
      <p class="muted">물건 가까이에서 <b>G</b>: 바위 · 광맥 캐기 / 나무 베기 / 반짝이는 흙 파기 / 물가에서 낚시(찌가 가라앉으면 G, 그다음 흘러오는 박에 맞춰 G · Space · 클릭) / 마을 텃밭에서 밭 갈기 · 씨앗 심기 · 물 주기 · 수확. <b>G를 누르고 있으면</b> 계속 캔다.</p></section>
    <section class="panel"><h3>가방 <small>${bagLine(s)} · ◆ ${s.gold} 골드 · 잡은 물고기 ${fishN}/${Object.keys(FISH).length}종 · 찾은 유물 ${artN}/${Object.keys(ARTIFACTS).length}</small></h3>
      <p class="muted">물건 종류마다 한 칸. 요리 · 열매 · 채소 · 약초는 <b>먹기</b>로 먹는다. 요리를 빠른 칸(<b>H</b>)에 두면 싸우는 중에도 H로 먹는다. 남는 물건은 집 보관함에 두자.</p>${body}</section>`;
}

// ───── 잡화점 ─────
export function tradeTab(s, ui) {
  const mk = market(), mins = Math.ceil(mk.nextIn / 60000);
  const arrow = (c) => (mk.mul[c] >= 1.08 ? '<em class="up">▲</em>' : mk.mul[c] <= 0.92 ? '<em class="down">▼</em>' : '');
  const buy = SHOP_STOCK.map((id) => { const p = buyPrice(id); return `<div class="trow">${ico(id)}<span><b>${GOODS[id].name}</b><small>${esc(GOODS[id].desc || '')}</small></span><span class="price">◆ ${p}</span>
    <button class="sm" data-act="tbuy" data-id="${id}" data-n="1" ${s.gold >= p ? '' : 'disabled'}>1개</button><button class="sm" data-act="tbuy" data-id="${id}" data-n="5" ${s.gold >= p * 5 ? '' : 'disabled'}>5개</button></div>`; }).join('');
  for (const id of Object.keys(s.bag || {})) if (id.startsWith('dish:')) registerDish(id);
  const own = Object.entries(s.bag || {}).filter(([id, n]) => n > 0 && GOODS[id] && GOODS[id].price > 0).sort((a, b) => sellPrice(b[0], mk) - sellPrice(a[0], mk));
  const sell = own.map(([id, n]) => { const p = sellPrice(id, mk), hot = mk.hot.includes(id); return `<div class="trow ${hot ? 'hot' : ''}">${ico(id)}<span><b>${GOODS[id].name}</b> <small>${n}개${hot ? ' · <em class="up">인기 상품 ×1.8</em>' : ''}</small></span><span class="price">◆ ${p} ${arrow(GOODS[id].cat)}</span>
    <button class="sm" data-act="tsell" data-id="${id}" data-n="1">1개</button><button class="sm" data-act="tsell" data-id="${id}" data-n="${n}">모두 (◆ ${p * n})</button></div>`; }).join('') || '<p class="muted">팔 물건이 없다.</p>';
  const quick = own.filter(([id]) => ['fish', 'crop', 'junk'].includes(GOODS[id].cat));
  const quickGold = quick.reduce((a, [id, n]) => a + sellPrice(id, mk) * n, 0);
  return `<section class="panel"><h3>잡화점 <small>◆ ${s.gold} 골드</small></h3>
      <p class="muted">"어서 오세요! 씨앗이랑 미끼는 여기서, 캐고 잡고 키운 건 뭐든 사 드려요." · 시세는 1시간마다 바뀐다 (다음 변동까지 ${mins}분)</p>
      <p>오늘의 인기 상품: ${mk.hot.map((id) => `${ico(id)}<b>${GOODS[id].name}</b>`).join(' · ')} — 평소의 1.8배에 산다</p>
      <h4>사기</h4><div class="tlist">${buy}</div></section>
    ${bagUpgradeHtml(s)}
    <section class="panel"><h3>팔기 ${quick.length ? `<button class="sm" data-act="tsellQuick">물고기 · 작물 · 잡동사니 모두 팔기 (◆ ${quickGold})</button>` : ''}</h3><div class="tlist">${sell}</div></section>`;
}

// ───── 대장간 제작 ─────
export function forgeTab(s) {
  const tools = TOOL_ORDER.map((k) => {
    const t = s.tools?.[k] || 0, next = t + 1, cost = t < 4 ? toolUpgradeCost(k, next) : null;
    return `<div class="trow">${ico(toolKey(k, Math.max(1, t)))}<span><b>${toolName(k, Math.max(1, t))}</b><small>${t ? TOOLS[k].what[t - 1] : ''}</small></span>
      ${cost ? `<span class="mats">→ ${ico(toolKey(k, next))} <b>${toolName(k, next)}</b> <small>${TOOLS[k].what[next - 1]}</small><br>${matsHtml(s, cost.mats, cost.gold)}</span>
      <button class="sm" data-act="toolUp" data-id="${k}" ${canPay(s, cost.mats, cost.gold) ? '' : 'disabled'}>바꾸기</button>` : '<span class="muted">최고 단계</span>'}</div>`;
  }).join('');
  const gear = FORGE.map((r) => {
    const it = ITEMS[r.id], has = s.items.includes(r.id), slot = { weapon: '무기', armor: '방어구', acc: '장신구' }[it.slot];
    const eff = (it.effects || []).map((e) => e.text).join(' · ');
    return `<div class="fcard ${has ? 'owned' : ''}"><div class="c-head"><b>${it.name}</b><small>${slot}</small></div>
      ${it.weapon ? `<div class="c-meta">${weaponText(it.weapon)}</div>` : ''}<div class="c-stats">${statText(it.stats)}${eff ? ` · ${eff}` : ''}</div>
      <div class="mats">${matsHtml(s, r.mats, r.gold)}</div>
      <button class="sm" data-act="forge" data-id="${r.id}" ${!has && canPay(s, r.mats, r.gold) ? '' : 'disabled'}>${has ? '가지고 있음' : '만들기'}</button></div>`;
  }).join('');
  const wid = s.gear?.weapon, lv = s.reinforce?.[wid] || 0, rc = lv < REINFORCE_MAX ? REINFORCE[lv] : null;
  return `<section class="panel"><h3>도구 바꾸기 <small>"광석만 가져오면 뭐든 두드려 주지."</small></h3><div class="tlist">${tools}</div></section>
    <section class="panel"><h3>무기 강화 <small>단계마다 모든 피해 +6% (최대 ${REINFORCE_MAX}단계)</small></h3>
      <div class="trow r3"><span><b>${ITEMS[wid]?.name || '무기'} ${lv ? `+${lv}` : ''}</b><small>지금: 피해 +${lv * 6}% · 장착한 무기를 강화한다</small></span>
      ${rc ? `<span class="mats">→ +${lv + 1} (피해 +${(lv + 1) * 6}%)<br>${matsHtml(s, rc.mats, rc.gold)}</span><button class="sm" data-act="reinforce" ${canPay(s, rc.mats, rc.gold) ? '' : 'disabled'}>강화</button>` : '<span class="muted">최고 단계</span>'}</div></section>
    <section class="panel"><h3>장비 만들기 <small>만든 장비는 '대장간' 탭에서 장착한다</small></h3><div class="fcards">${gear}</div></section>`;
}

// 버튼 처리 (처리했으면 true)
export function lifeClick(hub, act, t) {
  const s = hub.s, id = t.dataset.id, n = +t.dataset.n || 1;
  s.bag ||= {};
  switch (act) {
    case 'tbuy': {
      const p = buyPrice(id), k = Math.min(n, Math.floor(s.gold / p));
      if (k > 0 && !((s.bag[id] || 0) > 0) && Object.values(s.bag).filter((x) => x > 0).length >= (s.bagCap || 30)) { hub.toast('가방이 가득 찼다'); return true; }
      if (k > 0) { s.gold -= p * k; s.bag[id] = (s.bag[id] || 0) + k; hub.toast(`${GOODS[id].name} ${k}개를 샀다 (◆ ${p * k})`); }
      return true;
    }
    case 'tsell': {
      const k = Math.min(n, s.bag[id] || 0), p = sellPrice(id);
      if (k > 0) { s.bag[id] -= k; s.gold += p * k; hub.toast(`${GOODS[id].name} ${k}개를 팔았다 (+◆ ${p * k})`); hub.onKnack?.('sell', k); }
      return true;
    }
    case 'tsellQuick': {
      const mk = market(); let total = 0, cnt = 0;
      for (const [gid, k] of Object.entries(s.bag)) if (k > 0 && GOODS[gid] && ['fish', 'crop', 'junk'].includes(GOODS[gid].cat)) { total += sellPrice(gid, mk) * k; cnt += k; s.bag[gid] = 0; }
      s.gold += total; hub.toast(`${cnt}개를 팔았다 (+◆ ${total})`); if (cnt) hub.onKnack?.('sell', cnt);
      return true;
    }
    case 'toolUp': {
      const t0 = s.tools?.[id] || 0, cost = toolUpgradeCost(id, t0 + 1);
      if (t0 < 4 && cost && canPay(s, cost.mats, cost.gold)) { pay(s, cost.mats, cost.gold); s.tools[id] = t0 + 1; hub.toast(`${josa(toolName(id, t0 + 1), '을', '를')} 받았다!`); }
      return true;
    }
    case 'forge': {
      const r = FORGE.find((x) => x.id === id);
      if (r && !s.items.includes(id) && canPay(s, r.mats, r.gold)) { pay(s, r.mats, r.gold); s.items.push(id); hub.toast(`${josa(ITEMS[id].name, '을', '를')} 만들었다! '대장간' 탭에서 장착하세요`); }
      return true;
    }
    case 'reinforce': {
      const wid = s.gear?.weapon, lv = s.reinforce?.[wid] || 0, rc = REINFORCE[lv];
      if (wid && lv < REINFORCE_MAX && canPay(s, rc.mats, rc.gold)) { pay(s, rc.mats, rc.gold); (s.reinforce ||= {})[wid] = lv + 1; hub.toast(`${ITEMS[wid].name} +${lv + 1} 강화 성공!`); }
      return true;
    }
  }
  return false;
}

// ───── 도감: 물고기 · 유물 ─────
const WATER_NAME = { fresh: '호수 · 연못', river: '강', sea: '바다', bog: '늪', lava: '용암 (화염 낚싯대)', cave: '동굴 물', palace: '용궁' };
const BIOME_NAME = { plains: '시작 평원', meadow: '꽃바람 들판', forest: '이끼 숲', swamp: '독늪', ruins: '폐허 도시', graveyard: '그림자 묘지', snow: '서리 설원', mountains: '북쪽 바위산', volcano: '화산 지대', wasteland: '메마른 황야', jungle: '원시림', lake: '거울 호수', tower: '각인의 탑 둘레', coast: '바닷가' };
export function fishCodex(s) {
  const rows = Object.entries(FISH).map(([id, f]) => {
    const log = s.fishLog?.[id], where = `${f.water.map((w) => WATER_NAME[w]).join(' · ')}${f.biome ? ` (${f.biome.map((b) => BIOME_NAME[b]).join(' · ')})` : ''}${f.near === 'palace' ? ' · 용궁 가까이' : ''}`;
    if (!log) return `<div class="li off fishrow"><span class="gi"></span><span>??? <small>박자 ${'★'.repeat(f.beat)}${'☆'.repeat(5 - f.beat)} · 사는 곳: ${where}</small></span></div>`;
    return `<div class="li on fishrow">${ico(id)}<span><b>${f.name}</b>${f.legend ? ' <em class="up">전설</em>' : ''} <small>박자 ${'★'.repeat(f.beat)}${'☆'.repeat(5 - f.beat)} · 잡은 수 ${log.n} · 최대 ${log.best}cm (${f.size[0]}~${f.size[1]}cm) · ${where} · ◆ ${f.price}</small></span></div>`;
  }).join('');
  return `<h4>물고기 <small>새 물고기를 낚을 때마다 도감 +1</small></h4><div class="list">${rows}</div><p class="muted">찌가 가라앉으면 G, 그다음 흘러오는 박이 원에 닿을 때 G · Space · 클릭. ★이 많을수록 박자가 빠르고 복잡하다. 다 '완벽'이면 더 큰 물고기가 잡힌다. 지렁이 미끼는 빨리 물게 하고, 좋은 낚싯대는 판정을 넉넉하게 하고 낚싯줄(목숨)을 늘려 준다.</p>`;
}
export function artifactCodex(s) {
  const rows = Object.entries(ARTIFACTS).map(([id, a]) => s.artifacts?.[id]
    ? `<div class="li on fishrow">${ico('art:' + id)}<span><b>${a.name}</b> <small>${BIOME_NAME[a.biome]}</small><br><small>${esc(a.text)}</small></span></div>`
    : `<div class="li off fishrow"><span class="gi"></span><span>??? <small>단서: ${BIOME_NAME[a.biome]}의 반짝이는 흙 속</small></span></div>`).join('');
  return `<h4>유물 <small>찾을 때마다 도감 +2</small></h4><div class="list">${rows}</div><p class="muted">반짝이는 흙을 삽으로 파면 가끔 그 지역의 유물이 나온다. 삽이 좋을수록 자주 나온다.</p>`;
}

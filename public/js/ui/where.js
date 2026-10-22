// 어디서 얻나: 모든 물건 · 장비가 어디서 나오는지 (몬스터 · 캐기 · 땅 파기 · 낚시 · 가게 · 성지 · 대장간)
import { GOODS, MONSTER_DROPS, NODES, BIOME_NODES, DIG_BASE, DIG_BIOME, SHOP_STOCK, SCROLL_SHOP, FISH } from '../data/goods.js';
import { ITEMS } from '../data/items.js';
import { MONSTERS, ZONES } from '../data/monsters.js';
import { ENTRANCES } from '../data/maps/overworld.js';
import { RACE_SHOP, SANCTUMS } from '../data/sanctums.js';
import { CLASSES } from '../data/skills.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BIOME_NAME = { plains: '평원', meadow: '초원', forest: '숲', swamp: '늪', snow: '설원', volcano: '화산', coast: '해안', graveyard: '묘지', wasteland: '황야', jungle: '원시림', lake: '호수', mountain: '바위산', mountains: '바위산', desert: '사막', ruins: '폐허', river: '강', tower: '탑 근처', cave: '동굴', frost: '얼음 동굴', grave: '지하 묘지', rift: '균열 동굴', labyrinth: '잊힌 미궁', palace: '용궁' };

// 몬스터가 사는 곳 (탑 · 던전의 몬스터 목록)
function homesOf(mid) {
  const out = new Set();
  for (const z of ZONES) if (z.pool.includes(mid) || z.elite === mid) out.add(`각인의 탑 · ${z.name}`);
  for (const en of Object.values(ENTRANCES)) {
    const base = ZONES.find((z) => z.id === en.theme);
    if ((en.pool || base?.pool || []).includes(mid) || (en.elite || base?.elite) === mid) out.add(en.name);
  }
  return [...out].slice(0, 3);
}

export function sourcesOf(id) {
  const out = [];
  const g = GOODS[id];
  if (g) {
    const mons = Object.entries(MONSTER_DROPS).filter(([, l]) => l.some(([gid]) => gid === id)).map(([mid, l]) => {
      const ch = l.find(([gid]) => gid === id)[1], m = MONSTERS[mid];
      const home = homesOf(mid);
      return `${m?.name || mid} (${Math.round(ch * 100)}%)${home.length ? ' — ' + home.join(', ') : ' — 바깥 세계'}`;
    });
    if (mons.length) out.push(['몬스터', mons]);
    const nodes = Object.entries(NODES).filter(([, n]) => n.drops.some(([gid]) => gid === id) || (n.extra || []).some(([gid]) => gid === id)).map(([nid, n]) => {
      const where = Object.entries(BIOME_NODES).filter(([, l]) => l.some(([k]) => k === nid)).map(([b]) => BIOME_NAME[b] || b);
      return `${n.name}${n.tool ? ` (곡괭이${n.tier > 1 ? ` ${n.tier}단계` : ''})` : ''}${where.length ? ' — ' + where.slice(0, 4).join(', ') : ''}`;
    });
    if (nodes.length) out.push(['캐기 · 채집', nodes]);
    const digs = [...(DIG_BASE.some(([k]) => k === id) ? ['어디서나 반짝이는 흙'] : []), ...Object.entries(DIG_BIOME).filter(([, l]) => l.some(([k]) => k === id)).map(([b]) => `${BIOME_NAME[b] || b}의 반짝이는 흙`)];
    if (digs.length) out.push(['땅 파기 (삽)', digs]);
    if (FISH[id]) out.push(['낚시', [`${(FISH[id].biome || []).map((b) => BIOME_NAME[b] || b).join(', ') || '물가'} · 미끼를 끼우고 물가에서 G`]]);
    if (g.cat === 'crop') out.push(['밭', ['마을 텃밭에 씨앗을 심고 물을 준다']]);
    const shops = [];
    if (SHOP_STOCK.includes(id)) shops.push('마을 잡화점');
    if (SCROLL_SHOP.includes(id)) shops.push('마탑 (마법사 성지)');
    for (const [race, list] of Object.entries(RACE_SHOP)) if (list.includes(id)) shops.push(`${SANCTUMS[race].name} 상점`);
    if (shops.length) out.push(['가게', shops]);
    if (g.biome) out.push(['그 땅', [`${BIOME_NAME[g.biome] || g.biome} 쪽에서 나온다`]]);
  }
  const it = ITEMS[id];
  if (it) {
    if (it.treasure) out.push(['성지의 보물', [`${SANCTUMS[it.treasure]?.name || it.treasure}의 축복을 5단계까지 받으면`]]);
    else if (it.cls) out.push(['종족 상점', [`${SANCTUMS[CLASSES[it.cls]?.race]?.name || ''} 상점 (그 종족이 아니면 친밀도 「친구」부터)`]]);
    else if (it.forged) out.push(['대장간', ['대장간 「제작」에서 재료로 만든다']]);
    else if (it.price > 0) out.push(['대장간', [`대장간에서 산다 · ◆ ${it.price}`]]);
    if (it.crafted) out.push(['무기 만들기', ['대장간 「무기 만들기」에서 재료와 몬스터 부산물로']]);
  }
  return out;
}

export function whereTab(s, q = '') {
  const all = [...Object.keys(GOODS).filter((id) => !id.startsWith('dish:')).map((id) => [id, GOODS[id].name, '물건']), ...Object.keys(ITEMS).filter((id) => !ITEMS[id].starter && id !== 'rustySword').map((id) => [id, ITEMS[id].name, '장비'])];
  const key = q.trim();
  const hits = key ? all.filter(([, n]) => n.includes(key)) : all.filter(([id]) => (s.bag?.[id] || 0) > 0 || (s.goals || []).includes(id)).slice(0, 30);
  const rows = hits.slice(0, 40).map(([id, n, kind]) => {
    const src = sourcesOf(id);
    return `<div class="card"><div class="c-head"><b>${esc(n)}</b><span class="role">${kind}</span></div>${src.length ? src.map(([h, l]) => `<div class="c-meta"><b>${h}</b> · ${l.map(esc).join(' / ')}</div>`).join('') : '<div class="muted">요리 · 제작으로 만든다</div>'}</div>`;
  }).join('');
  return `<section class="panel"><h3>어디서 얻나 <small>물건 · 장비 이름을 찾으면 나오는 곳을 알려 준다</small></h3>
    <div class="soc-make"><input id="whereQ" value="${esc(key)}" placeholder="이름으로 찾기 (예: 철, 발톱, 장궁)" onkeydown="event.stopPropagation(); if (event.key === 'Enter') this.nextElementSibling.click()"><button class="sm" data-act="whereGo">찾기</button></div>
    ${key ? '' : '<p class="muted">찾는 말이 없으면 가방에 든 물건이 보인다.</p>'}
    <div class="cards">${rows || '<p class="muted">찾는 것이 없다.</p>'}</div></section>`;
}

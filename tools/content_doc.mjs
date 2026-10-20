// 게임의 모든 내용을 한 장의 HTML 문서로 정리한다 (데이터 파일에서 바로 뽑으므로 게임이 바뀌면 다시 돌리면 된다)
//   node tools/content_doc.mjs  →  docs/game-content.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => pathToFileURL(join(ROOT, 'public/js', p)).href;
const { RACES, POINTS_PER_LEVEL } = await import(J('data/races.js'));
const { CLASSES, SKILLS, ELEM, ZONE_ELEM, UNLOCKS, KIND_NAME, ENGRAVING_SKILLS } = await import(J('data/skills.js'));
const { ITEMS, WEAPON_SKILLS, WCAT_NAME, STYLES } = await import(J('data/items.js'));
const { ENGRAVINGS, TAGS, REACTIONS, CANCELS } = await import(J('data/engravings.js'));
const { MONSTERS, ZONES, AFFIXES, ECHOES, LORES } = await import(J('data/monsters.js'));
const G = await import(J('data/goods.js'));
const CK = await import(J('data/cooking.js'));
const CR = await import(J('data/crafting.js'));
const { LEARN, WHERE_NAME, ABILITIES } = await import(J('data/learn.js'));
const ST = await import(J('data/stats.js'));
const SA = await import(J('data/sanctums.js'));
const CX = await import(J('data/codex.js'));
const STORY = await import(J('data/story.js'));
const LORE = await import(J('data/lore.js'));
const { BIOMES } = await import(J('data/maps/overworld.js'));
const { HOUSES } = await import(J('data/maps/houses.js'));
const { LABY_ZONE, PALACE_ZONE } = await import(J('data/maps/interiors.js'));
const { SEABED_ZONE } = await import(J('data/maps/seabed.js'));
const { ARENA_SETS } = await import(J('data/maps/arena.js'));

const RACE_IDS = Object.keys(RACES).filter((r) => r !== 'golem'); // 골렘족은 데이터에만 남아 있고 고를 수 없다
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const statName = (k) => ST.STAT_INFO[k]?.name || ST.SPECIAL_INFO[k]?.name || { pres: '물리 저항', mres: '마법 저항' }[k] || k;
const stats = (o) => Object.entries(o || {}).filter(([, v]) => v).map(([k, v]) => `${statName(k)} ${v > 0 ? '+' : ''}${v}`).join(' · ');
const good = (id) => G.GOODS[id]?.name || ITEMS[id]?.name || id;
const mats = (o) => Object.entries(o || {}).map(([id, n]) => `${good(id)} ${n}`).join(' · ');
const mon = (id) => MONSTERS[id]?.name || id;
const table = (head, rows, cls = '') => `<div class="tw"><table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const chip = (t, c) => `<span class="chip" style="--c:${c}">${esc(t)}</span>`;
const toc = [];
const sec = (id, title, body, sub = '') => { toc.push([id, title]); return `<section id="${id}"><h2>${esc(title)}</h2>${sub ? `<p class="lead">${sub}</p>` : ''}${body}</section>`; };
const h3 = (t, extra = '') => `<h3>${esc(t)}${extra ? ` <small>${extra}</small>` : ''}</h3>`;
const ROLE = (r) => chip(r, '#8a7ad8');
const WATER = { fresh: '호수 · 민물', river: '강', sea: '바다', bog: '늪', cave: '동굴 물', lava: '용암', palace: '해저 궁전' };
const STATUS = { burn: '화상', poison: '중독', bleed: '출혈', chill: '냉기', curse: '저주', shock: '감전', stun: '기절' };
const biomeName = Object.fromEntries(BIOMES.map((b) => [b.id, b.name]));

// ───── 1. 한눈에 보기 ─────
const overview = sec('overview', '한눈에 보기', `
  <div class="cols">
    <div><h3>무엇을 하는 게임인가</h3>
      <p>바람결의 섬 한가운데 솟은 <b>각인의 탑</b>을 오르는 도트 액션 RPG. 섬 위를 자유롭게 돌아다니며 몬스터를 잡고, 여덟 종족의 성지를 찾아 축복을 받고, 낚시 · 채집 · 농사 · 요리 · 제작으로 살림을 꾸린다. 탑과 던전 아래로 내려갈수록 강해진다.</p>
      <p>클래스마다 스킬 6개 중 4개를 Q · E · R · F에 넣어 쓴다. 몬스터를 잡으면 <b>잔향</b>이 떨어지고, 잔향으로 몸에 <b>각인</b>을 새겨 능력을 붙인다. 레벨은 <b>도감</b>을 채워서 오른다.</p></div>
    <div><h3>조작</h3>${table(['키', '하는 일'], [
      ['W A S D', '이동'], ['마우스', '조준'], ['좌클릭', '평타'], ['우클릭', '무기 능력'], ['Q · E · R · F (1 · 2 · 3 · 4)', '스킬'], ['Space', '구르기 · 대시'], ['G', '상호작용 (말 걸기 · 열기 · 채집 · 낚시)'],
      ['C', '캐릭터 창 (스킬 · 스탯) — 던전 안에서도 열린다'], ['I · B', '가방'], ['H', '빨리 먹기'], ['M', '큰 지도 (바깥 세계)'], ['T', '자동 조준 켜기 · 끄기'], ['X', '심을 씨앗 바꾸기 (밭)'], ['Esc', '메뉴 · 창 닫기'],
    ])}</div>
  </div>
  <h3>핵심 순환</h3>
  <p class="flow">몬스터 사냥 → 잔향 · 재료 · 이야기 물건 → 각인 새기기 · 장비 제작 · 성지 축복 → 더 깊은 던전 · 더 먼 지역 → 도감이 차서 레벨 업 → 다시 사냥</p>
  <h3>시간</h3>
  <p>게임 1분 = 실제 1초 (하루 = 실제 24분). 아침 6시 해가 뜨고 저녁 6시 노을이 진다. 밤에는 어두워지고 밤에만 무는 물고기가 있다. 침대에서는 저녁 5시 ~ 새벽 5시에 잘 수 있고, 자고 나면 아침 6시에 일어나며 체력 · 마나가 차고 물을 준 작물이 한 단계 자라고 <b>개운함</b>(저녁 6시까지 이동 속도 +8% · 받는 피해 -5%)이 붙는다.</p>`);

// ───── 2. 세계와 이야기 ─────
const relIds = Object.keys(SA.SANCTUMS);
const relMatrix = `<div class="tw"><table class="matrix"><thead><tr><th></th>${relIds.map((r) => `<th>${esc(RACES[r]?.name)}</th>`).join('')}</tr></thead><tbody>${relIds.map((a) => `<tr><th>${esc(RACES[a]?.name)}</th>${relIds.map((b) => { if (a === b) return '<td class="self">—</td>'; const r = LORE.relation(a, b); return `<td title="${esc(r.why)}">${chip(LORE.REL_NAME[r.v], LORE.REL_COLOR[r.v])}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
const relRows = []; for (let i = 0; i < relIds.length; i++) for (let j = i + 1; j < relIds.length; j++) { const r = LORE.relation(relIds[i], relIds[j]); relRows.push([relIds[i], relIds[j], r]); }
relRows.sort((p, q) => p[2].v - q[2].v);
const world = sec('world', '세계와 이야기', `
  ${h3('바람결의 섬의 역사')}
  <ol class="history">${LORE.WORLD_HISTORY.map((h) => `<li><b>${esc(h.title)}</b><p>${esc(h.text)}</p></li>`).join('')}</ol>
  ${h3('종족 사이', '숙적 · 냉랭 · 무관심 · 우호 · 동맹. 칸에 마우스를 올리면 이유')}
  ${relMatrix}
  ${table(['두 종족', '사이', '왜'], relRows.map(([a, b, r]) => [`${esc(RACES[a]?.name)} · ${esc(RACES[b]?.name)}`, chip(LORE.REL_NAME[r.v], LORE.REL_COLOR[r.v]), esc(r.why)]))}
  <p class="note">성지의 의뢰를 끝내면 그 종족의 <b>동맹</b> 성지에도 소문이 퍼져 친밀도 +${LORE.ALLY_AFF}. 사이가 나쁜 종족으로 찾아가면 우두머리가 처음엔 차갑게 맞는다 (친밀도 「친구」부터 풀린다).</p>
  ${h3('종족마다의 사연')}
  ${relIds.map((r) => { const s = LORE.RACE_STORY[r]; return `<details><summary><b style="color:${SA.SANCTUMS[r].color}">${esc(SA.SANCTUMS[r].name)}</b> · ${esc(RACES[r]?.name)}</summary>
    ${s.history.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="small"><b>우두머리 ${esc(SA.SANCT_LIFE[r].leader.name)}</b>: ${[...SA.SANCT_LIFE[r].leader.lines, ...s.rival].map((l) => `「${esc(l)}」`).join(' ')}</p>
    <p class="small"><b>주민들의 소문</b>: ${[...SA.SANCT_LIFE[r].talk, ...s.gossip].map((l) => `「${esc(l)}」`).join(' ')}</p>
    ${Object.keys(s.cold).length ? `<p class="small"><b>사이 나쁜 종족이 찾아오면</b>: ${Object.entries(s.cold).map(([k, l]) => `${esc(RACES[k]?.name)} — 「${esc(l)}」`).join(' / ')}</p>` : ''}</details>`; }).join('')}
  ${h3('1층 이끼 동굴: 피노와 세린', '몬스터가 떨어뜨린 물건으로 이야기가 나아간다')}
  ${table(['이야기 물건', '떨어뜨리는 몬스터 (확률)', '모으는 수', '설명'], Object.values(STORY.STORY_ITEMS).map((it) => [`<b style="color:${it.color}">${esc(it.name)}</b>`, Object.entries(it.from).map(([m, p]) => `${esc(mon(m))} ${Math.round(p * 100)}%`).join(' · ') || '피노가 만들어 준다', it.max, esc(it.desc)]))}
  ${table(['길을 막는 것', '여는 법', '막혀 있을 때', '열면'], Object.values(STORY.BARRIERS).map((b) => [esc(b.name), b.need ? esc(STORY.STORY_ITEMS[b.need]?.name) : '반대편에서 밀기', esc(b.locked), esc(b.open)]))}
  ${Object.values(STORY.PEOPLE).map((p) => `<p><b>${esc(p.name)}</b> (${esc(p.title)}): ${p.summary.map(esc).join(' → ')}</p>`).join('')}
  ${Object.values(STORY.JOURNALS).map((j) => `<details><summary><b>${esc(j.title)}</b> · ${esc(j.where)}</summary><p class="pre">${esc(j.text)}</p></details>`).join('')}
  ${h3('고대 석판', '필드에서 읽을 수 있는 옛 기록 · 낚시로 건지는 유리병 편지에도 같은 글이 있다')}
  <ul class="lore">${LORES.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`);

// ───── 3. 종족 ─────
const races = sec('races', '종족', `
  <p>종족은 8개. 종족마다 기본 능력치 · 레벨마다 자라는 능력치 · <b>종족 자원</b>(스킬의 연료)이 다르고, 고를 수 있는 클래스가 정해져 있다. 레벨마다 능력치 포인트 ${POINTS_PER_LEVEL}개를 받는다.</p>
  ${table(['종족', '출신', '특성', '강점 · 약점', '기본 능력치', '레벨마다', '자원'], RACE_IDS.map((r) => { const R = RACES[r], res = R.res;
    const rules = [res.regen && `초당 +${res.regen}`, res.hit && `적중 +${res.hit}`, res.kill && `처치 +${res.kill}`, res.hurt && '맞을 때 참', res.dodge && `회피 +${res.dodge}`, res.decay && `전투 밖 초당 -${res.decay}`].filter(Boolean).join(' · ');
    return [`<b>${esc(R.name)}</b>`, esc(R.origin), `<b>${esc(R.passive)}</b><br><small>${esc(R.desc)}</small>`, `${esc(R.strong || '')}<br><small>${esc(R.weak || '')}</small>`, `<small>${stats(R.base)}</small>`, `<small>${stats(R.growth)}</small>`, `<b style="color:${res.color}">${esc(res.name)}</b><br><small>${rules}</small>`]; }))}`);

// ───── 4. 클래스와 스킬 ─────
const skillRow = (id) => { const s = SKILLS[id]; if (!s) return [esc(id), '', '', '', '', '', ''];
  const cost = s.costAll ? `전부 (${s.costAll.min} 이상)` : s.cost ? `${s.cost} 소모` : s.gain ? `+${s.gain} 얻음` : '';
  return [`<b>${esc(s.name)}</b>${s.ult ? ' ' + chip('궁극', '#ff5ad0') : ''}`, ROLE(s.role), s.unlock ? `${s.unlock}레벨` : '', `${s.cd}초`, cost, [s.cast && `시전 ${s.cast}초`, s.elem && ELEM[s.elem]?.name, s.kind && KIND_NAME[s.kind]].filter(Boolean).join(' · '), esc(s.desc)]; };
const classes = sec('classes', '클래스와 스킬', `
  <p>클래스는 언제든 무료로 바꿀 수 있다 (바꾸면 그 클래스의 시작 무기를 받는다). 스킬은 레벨 ${UNLOCKS.join(' · ')}에 하나씩 열리고, 4개까지 Q · E · R · F에 넣는다. 스킬마다 쓰는 자원이 다르다. 무기 종류가 맞지 않으면 스킬이 약해지거나 쓸 수 없다.</p>
  ${RACE_IDS.map((r) => Object.entries(CLASSES).filter(([, c]) => c.race === r).map(([cid, c]) => `
    <div class="cls"><h3>${esc(c.name)} <small>${esc(RACES[r].name)} · ${esc(c.desc)}</small></h3>
    <p><b>클래스 특성</b>: ${esc(c.trait)} <br><b>무기</b>: ${c.weapons.map((w) => esc(ITEMS[w]?.name || w)).join(' → ')}</p>
    ${table(['스킬', '역할', '열림', '재사용', '자원', '성질', '효과'], c.skills.map(skillRow))}</div>`).join('')).join('')}
  ${h3('각인 · 배워서 얻는 스킬', '클래스와 상관없이 각인을 새기거나 배우면 생긴다')}
  ${table(['스킬', '역할', '열림', '재사용', '자원', '성질', '효과'], Object.entries(SKILLS).filter(([, s]) => !s.cls).map(([id]) => skillRow(id)))}
  ${h3('무기 능력 (우클릭)')}
  ${table(['능력', '재사용', '효과'], Object.values(WEAPON_SKILLS).map((w) => [`<b>${esc(w.name)}</b>`, w.cd ? `${w.cd}초` : '', esc(w.desc)]))}`);

// ───── 5. 능력치 ─────
const statsSec = sec('stats', '능력치 · 각성', `
  ${table(['능력치', '하는 일'], ST.BASE_STATS.map((k) => [`<b>${esc(ST.STAT_INFO[k].name)}</b>`, esc(ST.STAT_INFO[k].desc)]))}
  <p>포인트 효율: ${ST.TIERS.map(([cap, m], i) => `${i ? ST.TIERS[i - 1][0] + 1 : 0}~${cap === Infinity || cap > 900 ? '' : cap} ×${m}`).join(' · ')}. 한 능력치가 30 · 50 · 70 · 90에 닿으면 <b>각성</b>한다.</p>
  ${table(['능력치', '30', '50', '70', '90'], Object.entries(ST.AWAKENINGS).map(([k, list]) => [`<b>${esc(statName(k))}</b>`, ...[30, 50, 70, 90].map((at) => { const a = list.find((x) => x.at === at); return a ? `<b>${esc(a.name)}</b><br><small>${esc(a.desc)}</small>` : ''; })]))}
  <p class="small">특수 능력치: ${Object.values(ST.SPECIAL_INFO).map((s) => esc(s.name)).join(' · ')}</p>`);

// ───── 6. 장비 ─────
const wItems = Object.entries(ITEMS).filter(([, it]) => it.slot === 'weapon' && !it.forged);
const oItems = Object.entries(ITEMS).filter(([, it]) => it.slot !== 'weapon');
const eff = (it) => (it.effects || []).map((e) => e.text).filter(Boolean).join(' · ');
const gear = sec('gear', '장비 · 제작 · 강화', `
  ${h3('무기', `${wItems.length}종`)}
  ${table(['무기', '종류', '피해', '공격 속도', '사거리', '우클릭', '능력치', '조건 · 효과', '값'], wItems.map(([, it]) => { const w = it.weapon || {};
    return [`<b>${esc(it.name)}</b>${it.treasure ? ' ' + chip('성지 보물', '#ffd76a') : ''}${it.token ? ' ' + chip('증표', '#9fe3a8') : ''}`, esc(WCAT_NAME[it.cat || w.cat] || ''), `${w.dmg === 'mag' ? '마법' : '물리'} ×${w.mul ?? 1}`, w.speed ?? '', w.range ?? '', esc(WEAPON_SKILLS[w.skill]?.name || ''), `<small>${stats(it.stats)}</small>`, `<small>${[stats(it.req) && `필요 ${stats(it.req)}`, eff(it), it.bdesc].filter(Boolean).map(esc).join(' · ')}</small>`, it.price || '']; }))}
  ${h3('갑옷 · 장신구')}
  ${table(['장비', '자리', '능력치', '효과', '값'], oItems.map(([, it]) => [`<b>${esc(it.name)}</b>${it.treasure ? ' ' + chip('성지 보물', '#ffd76a') : ''}${it.token ? ' ' + chip('증표', '#9fe3a8') : ''}`, it.slot === 'armor' ? '갑옷' : '장신구', `<small>${stats(it.stats)}</small>`, `<small>${esc(eff(it) || it.bdesc || '')}</small>`, it.price || '']))}
  ${h3('전투 스타일', '처음 고르는 길잡이')}
  ${table(['스타일', '설명', '능력치', '첫 무기'], Object.values(STYLES).map((s) => [`<b>${esc(s.name)}</b>`, esc(s.desc), s.stats.map(statName).join(' · '), esc(ITEMS[s.weapon]?.name || s.weapon)]))}
  ${h3('대장간 제작', '재료 + 골드')}
  ${table(['만드는 것', '재료', '골드'], G.FORGE.map((f) => [esc(ITEMS[f.id]?.name || good(f.id)), mats(f.mats), f.gold]))}
  ${h3('강화', `최대 +${G.REINFORCE_MAX}`)}
  ${table(['단계', '재료', '골드'], G.REINFORCE.map((r, i) => [`+${i + 1}`, mats(r.mats), r.gold]))}
  ${h3('무기 만들기', '형태 + 재질 + 부품(몬스터 부산물)로 나만의 무기')}
  ${table(['형태', '종류', '필요 재료 수', '설명'], Object.values(CR.WTYPES).map((t) => [`<b>${esc(t.name)}</b>`, esc(WCAT_NAME[t.cat] || t.cat), t.need, esc(t.desc)]))}
  ${table(['재질', '단계', '피해 배율', '속도 배율'], Object.values(CR.WMATS).map((m) => [esc(m.name), m.tier, `×${m.mul}`, `×${m.speed}`]))}
  ${table(['부품', '붙는 말', '효과'], Object.entries(CR.PART_FX).map(([id, p]) => [esc(good(id)), esc(p.adj), esc((p.fx || []).map((f) => f.text || [f.k, f.status && STATUS[f.status], f.chance && `${Math.round(f.chance * 100)}%`].filter(Boolean).join(' ')).join(' · '))]))}
  ${table(['조합 효과', '조건', '효과'], CR.SYNERGY.map((s) => [`<b>${esc(s.name)}</b>`, (s.need || []).map((n) => STATUS[n] || n).join(' + '), esc(s.text)]))}`);

// ───── 7. 각인 ─────
const engr = sec('engravings', '각인 · 잔향', `
  <p>몬스터가 떨어뜨린 <b>잔향</b>을 모아 공명 제단에서 몸의 자리(머리 · 몸 · 팔 · 다리 등)에 <b>각인</b>을 새긴다. 각인마다 부하가 있고 부하가 한도를 넘으면 과부하. 같은 태그가 여럿 모이면 태그 효과가 열린다.</p>
  ${table(['잔향', '색'], Object.values(ECHOES).map((e) => [`<b style="color:${e.color}">${esc(e.name)}</b>`, e.color]))}
  ${table(['각인', '자리', '등급', '부하', '태그', '능력치', '효과', '만드는 잔향'], Object.values(ENGRAVINGS).map((e) => [`<b>${esc(e.name)}</b>`, esc(ST.SLOT_INFO[e.slot] || e.slot), e.grade, e.load, (e.tags || []).map((t) => chip(TAGS[t]?.name || t, TAGS[t]?.color || '#888')).join(' '), `<small>${stats(e.stats)}</small>`, `<small>${esc((e.effects || []).map((x) => x.text).filter(Boolean).join(' · '))}</small>`, `<small>${Object.entries(e.recipe || {}).map(([id, n]) => `${esc(ECHOES[id]?.name || id)} ${n}`).join(' · ')}</small>`]))}
  ${h3('태그 효과')}
  ${table(['태그', '단계', '효과'], Object.values(TAGS).flatMap((t) => t.tiers.map((x) => [chip(t.name, t.color), `${x.n}개`, esc(x.text)])))}
  ${h3('원소 반응')}
  ${table(['반응', '조합', '효과'], Object.values(REACTIONS).map((r) => [`<b>${esc(r.name)}</b>`, esc(r.recipe), esc(r.desc)]))}
  <p class="small">${CANCELS.map((c) => `${esc(c.name)}: ${ELEM[c.a]?.name} · ${ELEM[c.b]?.name}이 한 몸에 ${c.n}개씩 모이면 둘 다 꺼진다.`).join(' ')}</p>`);

// ───── 8. 몬스터 ─────
const where = {}; const add = (m, w) => (where[m] ||= new Set()).add(w);
for (const z of ZONES) { for (const m of z.pool) add(m, `${z.floor}층 ${z.name}`); if (z.elite) add(z.elite, `${z.name} 우두머리`); }
for (const b of BIOMES) for (const m of b.pool) add(m, b.name);
for (const z of [LABY_ZONE, PALACE_ZONE, SEABED_ZONE]) if (z) { for (const m of z.pool || []) add(m, z.name); if (z.elite) add(z.elite, `${z.name} 우두머리`); }
const monsters = sec('monsters', '몬스터', `
  <p>도감: 처치 ${CX.STAGE_KILLS.join(' · ')}마리마다 단계가 오르며 약점 · 떨어뜨리는 것이 기록된다. 바깥의 몬스터는 12% 확률로 특성(접두어)이 붙는다.</p>
  ${table(['몬스터', '체력', '공격', '저항 (물리 / 마법)', '거는 상태', '행동', '잔향', '부산물', '나오는 곳'], Object.entries(MONSTERS).map(([id, m]) => [
    `<b>${esc(m.name)}</b>${m.elite ? ' ' + chip('우두머리', '#ff8a5a') : ''}`, m.hp, `${m.atk} ${m.type === 'mag' ? '마법' : '물리'}`, `${m.pres} / ${m.mres}`, esc(STATUS[m.status] || ''), esc(m.ai), m.echo?.rate ? `${esc(ECHOES[m.echo.id]?.name)} ${Math.round(m.echo.rate * 100)}%` : '',
    `<small>${(G.MONSTER_DROPS[id] || []).map(([g, p]) => `${esc(good(g))} ${Math.round(p * 100)}%`).join(' · ')}${Object.values(STORY.STORY_ITEMS).filter((s) => s.from[id]).map((s) => ` · ${esc(s.name)}`).join('')}</small>`, `<small>${[...(where[id] || [])].map(esc).join(' · ')}</small>`]))}
  ${h3('특성 (접두어)')}
  ${table(['특성', '크기', '체력', '공격'], Object.values(AFFIXES).map((a) => [`<b style="color:${a.color}">${esc(a.name)}</b>`, a.scale ? `×${a.scale}` : '', a.hp ? `×${a.hp}` : '', a.atk ? `×${a.atk}` : '']))}`);

// ───── 9. 지역 ─────
const regions = sec('regions', '지역 · 던전', `
  ${h3('바깥 세계: 바람결의 섬', '지역마다 풍경 · 몬스터 · 성지가 다르다')}
  ${table(['지역', '몬스터', '성지', '이동 포탈'], BIOMES.map((b) => { const sr = SA.BIOME_SANCTUM[b.id]; return [`<b>${esc(b.name)}</b>`, b.pool.map(mon).map(esc).join(' · '), sr ? `${esc(SA.SANCTUMS[sr].name)} (${esc(RACES[sr]?.name)})` : '', b.id === 'tower' ? '탑 앞 (남쪽)' : '지역 가운데 길가']; }))}
  <p>바람결 마을: 처음 시작하는 마을. 공명 제단 · 서고 · 의뢰소 · 대장간 · 잡화점 · 수련장 · 내 집(밭 · 침대 · 부엌 · 보관함)이 있다. 이동 포탈은 처음 만지면 깨어나고, 깨어난 포탈끼리 오갈 수 있다.</p>
  ${table(['집', '주인', '하는 일'], Object.values(HOUSES).map((h) => [`<b>${esc(h.name)}</b>`, esc(h.owner), esc(h.label || (h.mine ? '잠 · 요리 · 보관 · 농사' : ''))]))}
  ${h3('던전')}
  ${table(['던전', '층', '몬스터', '우두머리', '구역', '약점 · 내성'], [...ZONES, LABY_ZONE, PALACE_ZONE, SEABED_ZONE].filter(Boolean).map((z) => { const ze = ZONE_ELEM[z.id]; return [`<b>${esc(z.name)}</b>`, z.floor ?? '', (z.pool || []).map(mon).map(esc).join(' · '), esc(mon(z.elite) || ''), esc((z.regions || []).join(' · ')), ze ? `약점 ${ELEM[ze.weak]?.name} · 내성 ${ELEM[ze.resist]?.name}` : '']; }))}
  <p>던전은 아래층으로 계속 내려갈 수 있고(지하층은 매번 새로 만들어진다), 한 층 내려갈 때마다 몬스터 체력 +40% · 공격 +25%. 죽으면 그 던전에서 얻은 잔향의 절반을 잃는다 (야영지에 맡긴 몫은 지킨다). 긴급 귀환은 70%를 지킨다.</p>
  ${h3('연습장', '수련장에서 · 모든 스킬을 써 볼 수 있다')}
  ${table(['상대', '설명'], Object.entries(ARENA_SETS).map(([, s]) => [esc(s.name), esc(s.desc || '')]))}`);

// ───── 10. 성지 ─────
const specAt = (race, rank) => SA.trainSpec(race, rank, false);
const sanct = sec('sanctums', '종족 성지', `
  <p>종족마다 성지가 있다. 어느 종족이든 모든 성지의 축복을 받을 수 있고, <b>내 종족의 성지는 축복이 ${SA.OWN_MUL}배</b>. 성물을 바쳐 5단계까지 오르며, 단계마다 드는 성물은 ${SA.TIER_COST.join(' · ')}개, 오르는 힘은 누적 ${SA.TIER_UNITS.slice(1).join(' · ')}단위(한 단위 = 그 종족 능력치 +1). ${SA.PERK_TIER}단계에 은총, ${SA.TREASURE_TIER}단계에 보물. 성물 조각 ${SA.SHARDS_PER_RELIC}개 = 성물 하나.</p>
  ${table(['성지', '땅', '지하 던전', '성물', '능력치', `${SA.PERK_TIER}단계 은총`, `${SA.TREASURE_TIER}단계 보물`], Object.entries(SA.SANCTUMS).map(([r, s]) => [`<b style="color:${s.color}">${esc(s.name)}</b><br><small>${esc(RACES[r]?.name)} · ${esc(s.keeper)}</small>`, esc(s.place), esc(s.dungeon), esc(s.relic), stats(s.unit), esc(s.perk.text), esc(ITEMS[s.treasure]?.name || s.treasure)]))}
  ${h3('친밀도', '의뢰 · 매일 의뢰 · 수련 · 성물 바치기 · 선물로 오른다')}
  ${table(['단계', '필요', '보상'], SA.AFF_NAME.map((n, i) => [`<b>${esc(n)}</b>`, SA.AFF_LV[i], esc(SA.AFF_REWARD[i] || '—')]))}
  <p class="small">선물 +${SA.GIFT_AFF} (하루 ${SA.GIFTS_PER_DAY}번) · 수련 +${SA.TRAIN_AFF} (하루 ${SA.TRAINS_PER_DAY}번) · 성물 바치기 +10 · 동맹 성지의 의뢰를 끝내면 소문으로 +${LORE.ALLY_AFF}</p>
  ${h3('수련', '이기면 그 종족 능력치 +1. 단계가 오를수록 어려워진다. 같은 종족은 2단계 쉬운 난이도 · 한도 +5')}
  <p>수련 한도: 처음 5단계, 친밀도 「친구」부터 10단계, 내 종족의 성지는 여기에 +${SA.OWN_TRAIN_CAP} (최대 15단계). 보상 골드 = 20 + 단계 × 10.</p>
  ${table(['성지', '수련', '1단계', '5단계', '10단계', '15단계'], Object.keys(SA.SANCT_LIFE).map((r) => [`<b style="color:${SA.SANCTUMS[r].color}">${esc(SA.SANCTUMS[r].name)}</b>`, `<b>${esc(SA.SANCT_LIFE[r].train.name)}</b>`, ...[0, 4, 9, 14].map((k) => `<small>${esc(specAt(r, k).desc)}</small>`)]))}
  ${h3('성지 마을과 의뢰')}
  ${Object.entries(SA.SANCT_LIFE).map(([r, L]) => `<details><summary><b style="color:${SA.SANCTUMS[r].color}">${esc(SA.SANCTUMS[r].name)}</b> · ${esc(L.leader.name)}</summary>
    <p class="small"><b>주민</b>: ${L.residents.map((x) => esc(x.name)).join(' · ')} · <b>좋아하는 선물</b>: ${L.likes.map(good).map(esc).join(' · ')} · <b>종족의 증표</b>: ${esc(ITEMS[L.token]?.name || L.token)}</p>
    ${table(['의뢰', '할 일', '보상'], [...L.quests, { ...L.daily, title: `${L.daily.title} (매일)` }].map((q) => [`<b>${esc(q.title)}</b>`, `<small>${esc(q.text)}</small>`, `<small>골드 ${q.reward.gold} · 친밀도 +${q.reward.aff}${q.reward.goods ? ' · ' + mats(q.reward.goods) : ''}</small>`]))}</details>`).join('')}`);

// ───── 11. 생활 ─────
const goodsByCat = {}; for (const [id, g] of Object.entries(G.GOODS)) (goodsByCat[g.cat] ||= []).push([id, g]);
const life = sec('life', '생활: 채집 · 낚시 · 농사 · 요리', `
  ${h3('도구', '대장간에서 단계를 올린다')}
  ${table(['도구', '단계', '다룰 수 있는 것'], Object.values(G.TOOLS).map((t) => [`<b>${esc(t.name)}</b>`, esc(t.tiers.join(' → ')), `<small>${esc((t.what || []).join(' / '))}</small>`]))}
  ${table(['도구 단계', '재료', '골드'], Object.entries(G.TOOL_UPGRADE).map(([k, u]) => [`${k}단계`, mats(u.mats), u.gold]))}
  ${h3('채집할 것')}
  ${table(['자원', '도구 · 단계', '나오는 것', '가끔', '다시 생김'], Object.values(G.NODES).map((n) => [`<b>${esc(n.name)}</b>`, `${esc(G.TOOLS[n.tool]?.name || n.tool || '손')} ${n.tier || ''}`, (n.drops || []).map(([g, a, b]) => `${esc(good(g))} ${a}${b && b !== a ? `~${b}` : ''}`).join(' · '), (n.extra || []).map(([g, p]) => `${esc(good(g))} ${Math.round(p * 100)}%`).join(' · '), n.respawn ? `${Math.round(n.respawn / 60)}분` : '']))}
  <p class="small">땅파기(삽): 어디서나 ${G.DIG_BASE.map(([g]) => good(g)).join(' · ')} · 지역마다 ${Object.entries(G.DIG_BIOME).map(([b, l]) => `${biomeName[b] || b}: ${l.map(([g]) => good(g)).join(' · ')}`).join(' / ')}</p>
  ${h3('유물', '땅속에서 · 도감에 기록된다')}
  ${table(['유물', '지역', '이야기'], Object.values(G.ARTIFACTS).map((a) => [`<b>${esc(a.name)}</b>`, esc(biomeName[a.biome] || a.biome), esc(a.text)]))}
  ${h3('낚시', '리듬 낚시: 둥근 박이 원에 닿을 때 G · Space · 클릭. 박자를 잘 맞출수록 크다')}
  <p>지렁이 미끼는 빨리 물고 잡동사니가 줄며 귀한 물고기가 더 문다. <b>먼바다</b>(뭍에서 멀리, 배를 타고)는 더 빨리 물고 귀한 물고기 · 큰 물고기가 잘 나오며 잡동사니가 적다. 음식 「행운」도 귀한 물고기를 부른다.</p>
  ${table(['물고기', '물', '지역 · 때', '난이도', '크기 (cm)', '값', '움직임'], Object.values(G.FISH).map((f) => [`<b>${esc(f.name)}</b>`, f.water.map((w) => WATER[w] || w).join(' · '), [f.biome && f.biome.map((b) => biomeName[b] || b).join(' · '), f.time === 'night' && '밤에만', f.near && '해저 궁전 근처'].filter(Boolean).join(' · '), '★'.repeat(f.beat || 1), `${f.size[0]}~${f.size[1]}`, f.price, esc(f.style || '')]))}
  <p class="small">잡동사니: ${G.FISH_JUNK.map(([g]) => good(g)).join(' · ')}</p>
  ${h3('농사', '내 집 밭 · 씨앗은 잡화점에서')}
  ${table(['작물', '씨앗 값', '자라는 단계', '단계마다', '팔 때', '수확'], Object.values(G.CROPS).map((c) => [`<b>${esc(c.name)}</b>`, c.seedPrice, c.stages, `${c.stageSec}초`, c.price, `${c.yield[0]}~${c.yield[1]}개`]))}
  ${h3('요리', '부엌에서 재료를 섞는다 · 먹으면 체력 회복 + 효과')}
  ${table(['음식 효과', '1단계', '2단계', '3단계'], Object.values(CK.FOOD_EFFECTS).map((e) => [`<b style="color:${e.color}">${esc(e.name)}</b>`, ...e.lv.map((v) => esc(e.text(v)))]))}
  <p class="small">효과 지속(게임 분): ${CK.EFFECT_DUR.slice(1).map((d, i) => `${i + 1}단계 ${d}분`).join(' · ')}. 새 음식을 먹으면 바뀐다.</p>
  ${table(['요리 이름', '그릇'], CK.RECIPES.map((r) => [`<b>${esc(r.name)}</b>`, esc(r.k)]))}
  ${table(['재료', '종류', '회복', '효과'], Object.entries(CK.FOOD).map(([id, f]) => [esc(good(id)), esc(CK.KIND_NAME[f.kind] || f.kind), `${f.heal}%`, f.eff ? `${esc(CK.FOOD_EFFECTS[f.eff]?.name)} ${'★'.repeat(f.p || 1)}` : '']))}
  ${h3('가방', `처음 ${G.BAG_START}칸`)}
  <p class="small">늘리기: ${G.BAG_UPGRADES.map(([n, g]) => `${n}칸 (${g}골드)`).join(' → ')}</p>
  ${h3('물건 목록', `${Object.keys(G.GOODS).length}종`)}
  ${Object.entries(goodsByCat).map(([cat, list]) => `<details><summary><b>${esc(G.GOOD_CATS[cat] || cat)}</b> · ${list.length}종</summary>${table(['물건', '값', '설명'], list.map(([, g]) => [esc(g.name), g.price ?? '', `<small>${esc(g.desc || '')}</small>`]))}</details>`).join('')}`);

// ───── 12. 배우기 · 도감 ─────
const learnSec = sec('learn', '기술 배우기 · 도감 · 레벨', `
  ${table(['기술', '어디서', '골드', '레벨'], Object.entries(LEARN).map(([id, l]) => [`<b>${esc(SKILLS[id]?.name || ABILITIES[id]?.name || id)}</b>`, esc(WHERE_NAME[l.where] || l.where), l.gold ?? '', l.lv ?? '']))}
  ${table(['특별한 힘', '어디서', '효과'], Object.values(ABILITIES).map((a) => [`<b>${esc(a.name)}</b>`, esc(WHERE_NAME[a.where] || a.where), esc(a.desc)]))}
  ${h3('도감으로 레벨 업')}
  <p>몬스터 처치 ${CX.STAGE_KILLS.join(' · ')}마리 (단계마다 ${CX.STAGE_POINTS.join(' · ')}점) · 장소 발견 ${CX.PLACE_POINTS}점 · 일지 ${CX.JOURNAL_POINTS}점 · 석판 ${CX.LORE_POINTS}점 · 사람의 사연 단계마다 ${CX.PERSON_POINTS.join(' · ')}점 · 새 물고기 ${CX.FISH_POINTS}점 · 유물 ${CX.ARTIFACT_POINTS}점. 레벨 L에서 다음 레벨까지 (3 + L)점.</p>`);

// ───── 문서 ─────
const font = readFileSync(join(ROOT, 'public/assets/fonts/Galmuri11-Bold.woff2')).toString('base64');
const body = [overview, world, races, classes, statsSec, gear, engr, monsters, regions, sanct, life, learnSec].join('\n');
const d0 = new Date(), now = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
const html = `<title>각인의 탑 전체 내용</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap">
<style>
@font-face { font-family: 'Galmuri11'; font-weight: 700; font-display: swap; src: url(data:font/woff2;base64,${font}) format('woff2'); }
/* 탑의 서고에 꽂힌 두꺼운 안내서: 왼쪽은 차례, 오른쪽은 표가 많은 본문. 탑 꼭대기의 박하빛을 강조색으로 */
:root {
  --bg: #eef0f4; --paper: #ffffff; --ink: #1c1a26; --muted: #5e5a70; --line: #d8d6e2; --accent: #13806e; --rune: #6a4fd0; --head: #f4f3f8;
  --display: 'Galmuri11', 'Noto Sans KR', system-ui, sans-serif; --body: 'Noto Sans KR', system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #13111b; --paper: #1b1826; --ink: #ebe8f4; --muted: #a49fb8; --line: #2f2b40; --accent: #6fe8c8; --rune: #b39cff; --head: #221e30; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #13111b; --paper: #1b1826; --ink: #ebe8f4; --muted: #a49fb8; --line: #2f2b40; --accent: #6fe8c8; --rune: #b39cff; --head: #221e30; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 15px/1.65 var(--body); }
.wrap { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 32px; max-width: 1280px; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
nav.toc { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 16px); align-self: start; max-height: calc(100vh - 32px); overflow: auto; }
nav.toc a { display: block; padding: 5px 10px; color: var(--muted); text-decoration: none; border-left: 2px solid var(--line); font-size: 14px; }
nav.toc a:hover, nav.toc a:focus-visible { color: var(--accent); border-left-color: var(--accent); outline: none; }
header.top h1 { font-family: var(--display); font-size: 34px; line-height: 1.2; margin: 0 0 6px; letter-spacing: 0.02em; text-wrap: balance; }
header.top p { margin: 0; color: var(--muted); max-width: 65ch; }
header.top .meta { font-size: 13px; margin-top: 8px; }
main { min-width: 0; display: grid; gap: 28px; }
section { background: var(--paper); border: 1px solid var(--line); padding: 22px 24px; min-width: 0; }
h2 { font-family: var(--display); font-size: 24px; margin: 0 0 12px; color: var(--accent); text-wrap: balance; }
h3 { font-size: 17px; margin: 22px 0 8px; text-wrap: balance; }
h3 small, .lead { color: var(--muted); font-weight: 400; font-size: 13px; }
p { max-width: 75ch; margin: 6px 0; }
.small, td small { font-size: 12.5px; color: var(--muted); }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.cols > * { min-width: 0; }
.flow { font-weight: 500; color: var(--rune); }
.note { background: var(--head); padding: 8px 12px; font-size: 14px; }
.tw { overflow-x: auto; margin: 8px 0 14px; }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; font-variant-numeric: tabular-nums; }
th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid var(--line); }
thead th { background: var(--head); font-weight: 700; white-space: nowrap; position: sticky; top: 0; }
tbody tr:hover td { background: color-mix(in srgb, var(--accent) 6%, transparent); }
table.matrix td, table.matrix th { text-align: center; white-space: nowrap; }
table.matrix td.self { color: var(--muted); }
.chip { display: inline-block; padding: 0 6px; font-size: 12px; line-height: 1.6; color: var(--c); box-shadow: inset 0 0 0 1px var(--c); white-space: nowrap; }
details { border-top: 1px solid var(--line); padding: 6px 0; }
details > summary { cursor: pointer; padding: 4px 0; }
details > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
ol.history { padding-left: 22px; display: grid; gap: 8px; }
ol.history p { margin: 2px 0 0; }
ul.lore { columns: 2 300px; padding-left: 18px; }
.pre { white-space: pre-line; }
.cls { border-top: 1px dashed var(--line); padding-top: 6px; }
@media (max-width: 860px) { .wrap { grid-template-columns: minmax(0, 1fr); } nav.toc { position: static; max-height: none; display: flex; flex-wrap: wrap; gap: 4px; } nav.toc a { border-left: 0; border-bottom: 2px solid var(--line); } }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
html { scroll-behavior: smooth; }
</style>
<div class="wrap">
  <nav class="toc" aria-label="차례">${toc.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join('')}</nav>
  <main>
    <header class="top"><h1>각인의 탑 전체 내용</h1>
      <p>게임 데이터에서 그대로 뽑은 정리본입니다. 종족 · 클래스 · 스킬 · 장비 · 각인 · 몬스터 · 지역 · 성지 · 수련 · 생활 · 이야기를 모두 담았습니다.</p>
      <p class="meta">${now} 기준 · 종족 ${RACE_IDS.length} · 클래스 ${Object.values(CLASSES).filter((c) => c.race !== 'golem').length} · 스킬 ${Object.keys(SKILLS).length} · 장비 ${Object.keys(ITEMS).length} · 각인 ${Object.keys(ENGRAVINGS).length} · 몬스터 ${Object.keys(MONSTERS).length} · 물고기 ${Object.keys(G.FISH).length} · 물건 ${Object.keys(G.GOODS).length}</p></header>
    ${body}
  </main>
</div>`;
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs/game-content.html'), html);
console.log('docs/game-content.html', Math.round(html.length / 1024) + 'KB', 'sections', toc.length);

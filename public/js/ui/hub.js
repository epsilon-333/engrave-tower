// 마을 화면 (DOM). 캐릭터 / 공명 제단 / 상점 / 사냥터 / 도감
import { KNACKS } from '../data/knacks.js';
import { BASE_STATS, STAT_INFO, SPECIAL_INFO, SLOT_INFO, GRADES, TIERS } from '../data/stats.js';
import { RACES } from '../data/races.js';
import { WORLD_HISTORY, relation, REL_NAME, REL_COLOR } from '../data/lore.js';
import { SANCTUMS as SANCT_ALL } from '../data/sanctums.js';
import { codexPoints, levelFor, codexTotals, monsterStage, STAGE_KILLS, STAGE_MAX, zonePlaces, placeKey, PLACE_ZONES } from '../data/codex.js';
import { JOURNALS, PEOPLE, STORY_ITEMS } from '../data/story.js';
import { ENGRAVINGS, TAGS, REACTIONS } from '../data/engravings.js';
import { ITEMS, STYLES, WEAPON_SKILLS, weaponHands } from '../data/items.js';
import { MONSTERS, ECHOES, ZONES } from '../data/monsters.js';
import { WORLD_ZONE, ENTRANCES } from '../data/maps/overworld.js';
import { LABY_ZONE, PALACE_ZONE } from '../data/maps/interiors.js';
import { computeBuild, encodeLoadout, decodeLoadout, SLOTS, twoHandBonus, weaponFamily, FAMILY_NAME } from '../sim/build.js';
import { condText, evalCond } from '../sim/conditions.js';
import { toLoadout, writeSave, refreshQuests, claimQuest } from '../save.js';
import { sfx } from '../audio.js';
import { SKILLS, ROLE_COLOR, ENGRAVING_SKILLS, CLASSES, RACE_CLASSES, CLASS_TAGS, skillLoad, skillCap } from '../data/skills.js';
import { getAutoAim, setAutoAim } from '../settings.js';
import { skillScale, weaponStat, SKILL_PERKS, WEAPON_PERKS, CLASS_STATS, statMul } from '../data/statscale.js';
import { bagTab, tradeTab, forgeTab, lifeClick, fishCodex, artifactCodex } from './life.js';
import { whereTab } from './where.js';
import { storageTab, cookTab, craftTab, learnTab, skillPickHtml, homeClick } from './home.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Hub {
  constructor(root, getSave, onStartRun, onReset, onClose) {
    this.root = root; this.getSave = getSave; this.onStartRun = onStartRun; this.onReset = onReset; this.onClose = onClose;
    this.tab = 'char';
    try { this.tab = localStorage.getItem('et-tab') || 'char'; } catch { /* 무시 */ }
    this.toastT = null;
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => { if (e.target.dataset?.act === 'autoAim') { setAutoAim(e.target.checked); this.toast(e.target.checked ? '자동 조준 켜짐' : '자동 조준 꺼짐'); } }); // autoAimChange
  }

  get s() { return this.getSave(); }
  save() { writeSave(this.s); }

  toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), 1800);
  }

  render() {
    const s = this.s, b = computeBuild(toLoadout(s));
    this.b = b;
    // 그 집(시설)에서 연 창이면 그 시설의 탭 + 언제나 쓸 수 있는 탭(캐릭터 · 가방 · 도감)만 보인다
    const tabs = [['char', '캐릭터'], ['gear', '장비'], ['where', '어디서 얻나'], ['altar', '공명 제단'], ['shop', '대장간'], ['forge', '제작'], ['craft', '무기 만들기'], ['trade', '잡화점'], ['learn', '기술 배우기'], ['cook', '부엌'], ['storage', '보관함'], ['quest', '의뢰'], ['hunt', '관문 정보'], ['bag', '가방'], ['codex', '도감']]
      .filter(([k]) => !this.allowed || this.allowed.includes(k));
    if (!tabs.some(([k]) => k === this.tab)) this.tab = tabs[0][0];
    this.root.innerHTML = `
      <header class="hub-top">
        <div class="title">아르케</div>
        <div class="who">${RACES[s.race].name} · Lv ${s.level} ${(() => { const lv = levelFor(codexPoints(s)); return `<span class="xp" title="도감 점수 ${lv.into}/${lv.need} — 다음 레벨까지"><i style="width:${(lv.into / lv.need) * 100}%"></i></span>`; })()} <span class="gold">◆ ${s.gold} 골드</span></div>
        <button class="close" data-act="close">닫기 ✕</button>
        <nav>${tabs.map(([k, n]) => `<button data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${n}${k === 'char' && s.points ? ` <b class="dot">${s.points}</b>` : ''}${k === 'quest' && (s.quests || []).some((q) => q.done) ? ' <b class="dot">!</b>' : ''}</button>`).join('')}</nav>
      </header>
      <main class="hub-body">${this['tab_' + this.tab](s, b)}</main>
      <div id="toast"></div>`;
  }

  tab_bag(s) { return bagTab(s); }
  tab_where(s) { return whereTab(s, this.whereQ || ''); }
  tab_storage(s) { return storageTab(s); }
  tab_cook(s) { return cookTab(s, this); }
  tab_craft(s) { return craftTab(s, this); }
  tab_learn(s, b) { return learnTab(s, this, b); }
  tab_trade(s) { return tradeTab(s); }
  tab_forge(s) { return forgeTab(s); }

  // ───── 캐릭터 ─────
  tab_char(s, b) {
    const race = RACES[s.race], d = b.derived;
    // 이 클래스 · 무기에 좋은 스탯: 스킬과 평타가 따라가는 스탯
    const rec = {}, cs = CLASS_STATS[b.cls] || [], ws = weaponStat(b.weaponItem);
    if (cs[0]) rec[cs[0]] = '공격 스킬이 이 스탯에 비례해 세진다 (40: 피해 +15% · 70: 재사용 -20%)';
    if (cs[1]) rec[cs[1]] = (rec[cs[1]] ? rec[cs[1]] + ' · ' : '') + '방어 · 준비 · 제어 스킬이 따라가는 스탯';
    rec[ws] = (rec[ws] ? rec[ws] + ' · ' : '') + '지금 무기의 평타 · 무기 기술이 따라가는 스탯 (50: 피해 +15% · 80: 공격 속도 +10%)';
    const statTip = (k, v) => {
      const o = b.statSrc?.[k]; if (!o) return '';
      const other = v - o.base - o.grow - o.alloc - o.race - o.sanct;
      return [`기본 ${o.base}`, o.grow && `레벨 성장 +${o.grow}`, o.alloc && `찍은 포인트 +${o.alloc}`, o.race && `종족 보정 ×${o.mult} (${o.race > 0 ? '+' : ''}${o.race})`, o.sanct && `성지 +${o.sanct}`, other && `장비 · 각인 · 기타 ${other > 0 ? '+' : ''}${other}`].filter(Boolean).join('\n');
    };
    const statRow = (k) => {
      const v = b.stats[k], alloc = s.alloc[k] || 0;
      const next = (b.awakenings.filter((a) => a.stat === k && !a.on)[0]);
      const tier = TIERS.findIndex(([cap]) => v <= cap);
      return `<div class="stat-row">
        <span class="sn" title="${esc(STAT_INFO[k].desc)}">${STAT_INFO[k].name}${rec[k] ? ` <b class="rec" title="${rec[k]}">추천</b>` : ''}</span>
        <span class="sv tier${tier}" title="${esc(statTip(k, v))}">${v}</span>
        <span class="bar"><i style="width:${Math.min(100, v / 3)}%"></i>${[30, 50, 70, 90].map((t) => `<em style="left:${t / 3}%"></em>`).join('')}</span>
        <span class="next">${next ? `${next.at}: ${next.name}` : '<b>모든 각성</b>'}</span>
        <button class="sm" data-act="unalloc" data-k="${k}" ${alloc ? '' : 'disabled'}>−</button>
        <button class="sm" data-act="alloc" data-k="${k}" ${s.points ? '' : 'disabled'}>+</button>
      </div>`;
    };
    const specials = Object.entries(SPECIAL_INFO).filter(([k]) => b.stats[k]).map(([k, i]) => `<span class="chip">${i.name} ${b.stats[k]}${i.unit}</span>`).join('') || '<span class="muted">없음</span>';
    const pct = (v) => Math.round(v * 100) + '%';
    const awOn = b.awakenings.filter((a) => a.on);
    return `${skillPickHtml(s, b)}
    <div class="cols">
      <section class="panel">
        <h3>${race.name} <small>${race.passive}</small></h3>
        <p class="muted">${race.desc}</p>
        <div class="points">남은 포인트 <b>${s.points}</b>
          <button class="sm" data-act="respec">배분 초기화 (무료)</button></div>
        <div class="tier-help">포인트 효율: 0~20 ×1.0 · 21~40 ×1.3 · 41~60 ×1.7 · 61+ ×2.2 &nbsp;|&nbsp; 30/50/70/90에서 각성</div>
        ${BASE_STATS.map(statRow).join('')}
        <h4>특수 스탯</h4><div class="chips">${specials}</div>
        <h4>숙련으로 깨달은 것 <small class="muted">같은 일을 오래 하다 보면 어느 날 문득 깨닫는다</small></h4>
        <div class="chips">${Object.keys(s.knack?.got || {}).filter((id) => KNACKS[id]).map((id) => KNACKS[id].kind === 'life' ? `<span class="chip" title="${esc(KNACKS[id].desc)}">${KNACKS[id].name}</span>` : `<span class="chip" title="${esc(KNACKS[id].hint)}">${SKILLS[KNACKS[id].skill]?.name || id}</span>`).join('') || '<span class="muted">아직 없음</span>'}</div>
      </section>
      <section class="panel">
        <h3>전투 수치</h3>
        <div class="derived">
          <div>최대 HP <b>${d.maxHp}</b></div><div>무기 <b>${ITEMS[b.weaponId].name}</b></div>
          <div>물리 공격력 <b>${Math.round(d.physAtk)}</b></div><div>마법 공격력 <b>${Math.round(d.magAtk)}</b></div>
          <div>공격 속도 <b>×${d.atkSpeed.toFixed(2)}</b></div><div>이동 속도 <b>${Math.round(d.moveSpeed)}</b></div>
          <div>치명타 <b>${pct(d.crit)}</b> · ×${d.critDmg.toFixed(2)}</div><div>회피 <b>${pct(d.dodge)}</b></div>
          <div>물리 피해 감소 <b>${pct(d.physDR)}</b></div><div>마법 피해 감소 <b>${pct(d.magDR)}</b></div>
          <div>상태이상 저항 <b>${pct(d.statusRes)}</b></div><div>쿨타임 감소 <b>${pct(d.cdr)}</b></div>
          <div>모든 피해 <b>×${d.dmgMul.toFixed(2)}</b></div><div>받는 피해 <b>×${d.dmgTakenMul.toFixed(2)}</b></div>
        </div>
        <div class="load ${b.overload ? 'over' : ''}">각인 부하 <b>${b.load} / ${d.loadCap}</b><span class="bar"><i style="width:${Math.min(100, (b.load / d.loadCap) * 100)}%"></i></span></div>
        ${b.extreme ? '<div class="badge extreme">극한 상태: 주력 스탯 +20%</div>' : ''}
        <h4>발동 중인 각성 (${awOn.length})</h4>
        <div class="list">${awOn.map((a) => `<div class="li on"><b>${STAT_INFO[a.stat].name} ${a.at}</b> ${a.name}: ${a.desc}</div>`).join('') || '<div class="muted">아직 없음. 한 스탯을 30까지 올려 보세요.</div>'}</div>
        <h4>태그 시너지</h4>
        <div class="list">${b.synergies.map((x) => `<div class="li ${x.on ? 'on' : 'off'}"><span class="tag" style="--c:${TAGS[x.tag].color}">${TAGS[x.tag].name} ${x.n}/${x.need}</span> ${x.text}</div>`).join('') || '<div class="muted">각인과 장비의 태그를 모아 보세요.</div>'}</div>
        <h4>조건 효과</h4>
        <div class="list">${b.notes.map((n) => `<div class="li ${n.kind}">${esc(n.text)}</div>`).join('') || '<div class="muted">없음</div>'}</div>
        <h4>빌드 코드 <small>(공유용 · 나중에 온라인 대전에 사용)</small></h4>
        <div class="code-row"><input id="buildCode" value="${encodeLoadout(toLoadout(s))}" readonly><button class="sm" data-act="copyCode">복사</button></div>
        <div class="code-row"><input id="peekCode" placeholder="다른 빌드 코드를 붙여 넣으면 수치를 미리 봅니다"><button class="sm" data-act="peek">보기</button></div>
        <div id="peekOut"></div>
        <p class="danger-zone"><button class="sm ghost" data-act="reset">처음부터 다시 시작</button></p>
      </section>
    </div>`;
  }

  // ───── 공명 제단 ─────
  tab_altar(s, b) {
    const race = RACES[s.race];
    const slots = SLOTS;
    const slotHtml = slots.map((sl) => {
      const id = s.slots[sl], e = id && ENGRAVINGS[id];
      return `<div class="slot ${e ? 'filled' : ''}" ${e ? `style="--g:${GRADES[e.grade].color}"` : ''}>
        <div class="sl-name">각인 칸 ${SLOTS.indexOf(sl) + 1}</div>
        ${e ? `<div class="sl-e">${e.name}</div><div class="sl-meta">부하 ${e.load}</div><button class="sm ghost" data-act="unequipE" data-slot="${sl}">빼기</button>` : '<div class="muted">비어 있음</div>'}
      </div>`;
    }).join('');

    const echoInv = Object.entries(s.echoes).filter(([, n]) => n > 0)
      .map(([id, n]) => `<span class="echo" style="--c:${ECHOES[id].color}">◆ ${ECHOES[id].name} <b>${n}</b></span>`).join('') || '<span class="muted">잔향이 없습니다. 사냥터에서 몬스터를 사냥하세요.</span>';

    const zonesOf = (id) => [...new Set(Object.keys(ENGRAVINGS[id].recipe).map(zoneOfEcho))];
    // 그 계열의 잔향을 주는 몬스터가 사는 바깥 세계의 던전들
    const placesOf = (zid) => { const ps = Object.values(ENTRANCES).filter((en) => en.theme === zid).map((en) => en.name); return ps.length ? ps.slice(0, 3).join(' · ') + (ps.length > 3 ? ' 등' : '') : '바깥 세계'; };
    // 거르기: 기본은 지금 클래스에 맞는 각인. 같은 종족의 다른 클래스 · 전체 · 찜 · 새길 수 있음도 고를 수 있다
    let filter = this.altarFilter || `cls:${b.cls}`;
    if (filter.startsWith('cls:') && !CLASS_TAGS[filter.slice(4)]) filter = `cls:${b.cls}`;
    const fcls = filter.startsWith('cls:') ? filter.slice(4) : null, ftags = fcls ? CLASS_TAGS[fcls] : null;
    const pass = (id) => {
      const e = ENGRAVINGS[id];
      if (filter === 'all') return true;
      if (filter === 'goal') return (s.goals || []).includes(id);
      if (filter === 'ready') return Object.entries(e.recipe).every(([eid, n]) => (s.echoes[eid] || 0) >= n) || (s.owned[id] || 0) > 0;
      return !!ftags && e.tags.some((t) => ftags.includes(t));
    };
    const clsBtns = RACE_CLASSES(s.race).filter((c) => CLASS_TAGS[c]).sort((a2, c2) => (c2 === b.cls) - (a2 === b.cls)).map((c) => [`cls:${c}`, c === b.cls ? `내 클래스 · ${CLASSES[c].name}` : CLASSES[c].name]);
    const filterBar = `<div class="filters">${[...clsBtns, ['all', '전체'], ['goal', '★ 찜'], ['ready', '새길 수 있음']]
      .map(([k, n]) => `<button class="sm ${filter === k ? 'on' : ''}" data-act="filter" data-id="${k}">${n}</button>`).join('')}</div>
      ${ftags ? `<p class="muted">${CLASSES[fcls].name}에게 잘 맞는 각인 · 핵심 태그 ${ftags.map((t) => `<span class="tag" style="--c:${TAGS[t].color}">${TAGS[t].name}</span>`).join(' ')}</p>` : ''}`;
    const goalHtml = this.goalPanel(s);
    const groups = ZONES.map((z) => {
      const ids = Object.keys(ENGRAVINGS).filter((id) => { const zs = zonesOf(id); return zs.length === 1 && zs[0] === z.id && pass(id); });
      if (!ids.length) return '';
      return `<h4>${z.name} 계열 <small>${placesOf(z.id)} · ${ids.length}종</small></h4><div class="cards">${ids.map((id) => this.engravingCard(id, s, b)).join('')}</div>`;
    }).join('') + (() => {
      const ids = Object.keys(ENGRAVINGS).filter((id) => zonesOf(id).length > 1 && pass(id));
      if (!ids.length) return '';
      return `<h4>혼합 문양 <small>여러 지역의 잔향 · ${ids.length}종</small></h4><div class="cards">${ids.map((id) => this.engravingCard(id, s, b)).join('')}</div>`;
    })();

    return `
      ${this.skillPanel(s, b)}
      <section class="panel">
        <h3>각인 <small>아무 칸에나 넣을 수 있어요 · 부하 ${b.load} / ${b.derived.loadCap}${b.overload ? ' · <span class="warn">과부하!</span>' : ''}</small></h3>
        <div class="slots">${slotHtml}</div>
        <h4>보유 잔향</h4><div class="echoes">${echoInv}</div>
      </section>
      <section class="panel">
        <h3>각인 목록 <small>처음에는 내 클래스에 맞는 각인만 보입니다 · ★로 찜하면 필요한 잔향과 사냥터를 알려 줘요</small></h3>
        ${filterBar}
        ${goalHtml}
        ${groups || '<p class="muted">조건에 맞는 각인이 없습니다.</p>'}
      </section>`;
  }

  curSkills() { return computeBuild(toLoadout(this.s)).skills; }

  skillPanel(s, b) {
    const keys = ['Q', 'E', 'R', 'F'];
    const resName = RACES[s.race].res.name;
    const all = CLASSES[b.cls].skills.map((id) => [id, SKILLS[id]]);
    const sn = (k) => STAT_INFO[k]?.name || k;
    // 스탯 계수: 이 스킬이 따라가는 스탯 · 지금 배율 · 개방
    const scaleLine = (id) => { const sc = skillScale(id, b); return `<div class="sk-scale">${sn(sc.stat)} 계수 <b>×${sc.dmg.toFixed(2)}</b> <small>(${sn(sc.stat)} ${Math.round(sc.v)} · 1마다 +0.6%)</small> ${SKILL_PERKS.map((pk) => `<span class="${sc.v >= pk.at ? 'on' : ''}">${sn(sc.stat)} ${pk.at}: ${pk.text}</span>`).join(' ')}</div>`; };
    const card = (id, sk, locked) => {
      const i = b.skills.indexOf(id), on = i >= 0;
      const cost = sk.costAll ? `${resName} ${sk.costAll.min}+ 전부` : sk.cost ? `${resName} ${sk.cost}` : sk.gain ? `${resName} +${sk.gain}` : '';
      const btn = locked ? `<span class="muted">${sk.unlock}레벨에 배움</span>`
        : on ? `<button class="sm ghost" data-act="skillOff" data-id="${id}">빼기</button>` + (i > 0 ? `<button class="sm ghost" data-act="skillUp" data-id="${id}">앞으로</button>` : '')
        : `<button class="sm" data-act="skillOn" data-id="${id}">장착</button>`;
      return `<div class="skc ${on ? 'on' : ''} ${locked ? 'locked' : ''}" style="--c:${ROLE_COLOR[sk.role]}">
        <div class="c-head"><b>${on ? `[${keys[i]}] ` : ''}${sk.name}</b><span class="role">${sk.role}</span></div>
        <div class="muted"><b class="sk-load">부하 ${skillLoad(id)}</b> · 재사용 ${sk.cd}초${cost ? ' · ' + cost : ''}${sk.cast ? ` · 시전 ${sk.cast}초` : ''}</div>
        <div class="c-sum">${esc(sk.desc)}</div>
        ${scaleLine(id)}
        <div class="c-act">${btn}</div>
      </div>`;
    };
    const race = all.map(([id, sk]) => card(id, sk, !b.available.includes(id))).join('');
    const eng = b.available.filter((id) => id !== 'weapon' && SKILLS[id].engraving).map((id) => card(id, SKILLS[id], false)).join('');
    const wsk = WEAPON_SKILLS[b.weapon.skill];
    let wcard = '';
    if (wsk) {
      const wi = b.skills.indexOf('weapon');
      const wbtn = '<span class="muted">우클릭(모바일은 「무기」 버튼)으로 언제나 사용</span>';
      const ws = b.wScale, wst = weaponStat(b.weaponItem);
      wcard = `<div class="skc on" style="--c:#aab0c0"><div class="c-head"><b>[우클릭] ${wsk.name}</b><span class="role">무기</span></div><div class="c-sum">${esc(wsk.desc || '')}</div><div class="sk-scale">평타 · 무기 기술: ${sn(wst)} 계수 <b>×${(ws?.dmg || 1).toFixed(2)}</b> ${WEAPON_PERKS.map((pk) => `<span class="${(ws?.v || 0) >= pk.at ? 'on' : ''}">${sn(wst)} ${pk.at}: ${pk.text}</span>`).join(' ')}</div><div class="c-act">${wbtn}</div></div>`;
    }
    const clsRow = RACE_CLASSES(s.race).map((cid) => {
      const c = CLASSES[cid], on = cid === b.cls;
      return `<button class="cls ${on ? 'on' : ''}" data-act="setCls" data-id="${cid}"><b>${c.name}</b><small>${c.desc}</small></button>`;
    }).join('');
    const auto = getAutoAim();
    return `<section class="panel">
      <h3>클래스 <small>언제든 무료로 바꿀 수 있어요 · 바꾸면 그 클래스의 시작 무기를 받습니다</small></h3>
      <div class="cls-row">${clsRow}</div>
      <h3>스킬 <small>최대 4개 · Q / E / R / F (모바일은 화면 버튼) · 스킬마다 자원 소모가 달라요</small></h3>
      <p class="sk-cap">스킬 부하 <b>${b.skillLoad} / ${b.skillCap}</b> <small>센 스킬일수록 무겁다 · 4레벨마다 한도 +1 · 센 스킬 하나와 가벼운 스킬 여럿 중에서 고른다</small></p>
      <div class="skill-tools">
        <label class="toggle"><input type="checkbox" data-act="autoAim" ${auto ? 'checked' : ''}> 자동 조준 <small>(T) 강한 스킬은 체력 높은 적, 범위 스킬은 적이 많은 곳, 마무리는 약한 적을 노립니다</small></label>
        <button class="sm" data-act="practice">연습 모드 · 모든 스킬 써 보기</button>
      </div>
      <div class="skill-row">${race}</div>
      <h4>각인·무기 스킬 <small>스킬이 붙은 각인을 장착하면 여기에 생겨요</small></h4><div class="skill-row">${eng}${wcard}</div>
    </section>`;
  }

  goalPanel(s) {
    const goals = (s.goals || []).filter((id) => ENGRAVINGS[id]);
    if (!goals.length) return '';
    const need = {};
    for (const id of goals) for (const [eid, n] of Object.entries(ENGRAVINGS[id].recipe)) need[eid] = (need[eid] || 0) + n;
    const rows = Object.entries(need).map(([eid, n]) => {
      const have = s.echoes[eid] || 0;
      const src = [];
      for (const z of ZONES) for (const m of [...z.pool, z.elite]) {
        const def = MONSTERS[m];
        if (def.echo.id === eid || def.condEcho?.id === eid) src.push(s.codex.kills[m] ? `${def.name}(${z.name})` : `???(${z.name})`);
      }
      return `<div class="li ${have >= n ? 'on' : ''}"><span style="color:${ECHOES[eid].color}">◆ ${s.codex.echoes[eid] ? ECHOES[eid].name : '???'}</span> ${Math.min(have, n)}/${n} · ${src.slice(0, 3).join(', ')}</div>`;
    }).join('');
    return `<div class="goal-box"><h4>★ 목표: ${goals.map((id) => ENGRAVINGS[id].name).join(', ')}</h4><div class="list">${rows}</div>
      <p class="muted">필드에서도 화면 오른쪽에 목표 잔향 진행이 표시됩니다.</p></div>`;
  }

  // 지금 빌드 기준 배지: 시너지 발동, 조건 충족, 스타일 일치
  badges(id, s, b) {
    const e = ENGRAVINGS[id], out = [];
    for (const t of e.tags) {
      const n = (b.tags[t] || 0) + 1;
      const tier = TAGS[t]?.tiers.find((x) => x.n === n);
      if (tier) out.push(`<span class="badge syn" style="--c:${TAGS[t].color}">▲ ${TAGS[t].name} ${n}개 발동</span>`);
    }
    const ctx = { stats: b.stats, tags: b.tags, race: s.race, extreme: b.extreme };
    const conds = e.effects.filter((x) => x.when);
    if (conds.length) {
      const ok = conds.filter((x) => evalCond(x.when, ctx)).length;
      out.push(`<span class="badge ${ok === conds.length ? 'ok' : ok ? 'part' : 'no'}">조건 ${ok}/${conds.length}</span>`);
    }
    const st = STYLES[s.style];
    if (st && e.tags.some((t) => st.tags.includes(t))) out.push(`<span class="badge style">${st.name}</span>`);
    return out.join('');
  }

  engravingCard(id, s, b) {
    const e = ENGRAVINGS[id];
    const known = Object.keys(e.recipe).some((eid) => s.codex.echoes[eid]);
    const owned = s.owned[id] || 0;
    const equipped = Object.values(s.slots).filter((x) => x === id).length;
    const can = Object.entries(e.recipe).every(([eid, n]) => (s.echoes[eid] || 0) >= n);
    const recipe = Object.entries(e.recipe).map(([eid, n]) => {
      const have = s.echoes[eid] || 0;
      const nm = s.codex.echoes[eid] ? ECHOES[eid].name : '???';
      return `<span class="rq ${have >= n ? 'ok' : ''}" style="--c:${ECHOES[eid].color}">◆ ${nm} ${have}/${n}</span>`;
    }).join('');
    if (!known) {
      return `<div class="card unknown"><div class="c-head"><b>??? 미확인 각인</b><span class="grade" style="--g:${GRADES[e.grade].color}">${GRADES[e.grade].name}</span></div>
        <div class="c-meta">각인</div><div class="recipe">${recipe}</div></div>`;
    }
    const stats = Object.entries(e.stats).map(([k, v]) => `${(STAT_INFO[k] || SPECIAL_INFO[k]).name} ${v > 0 ? '+' : ''}${v}`).join(', ');
    const effs = e.effects.map((x) => `<li>${x.when ? `<em>[${esc(condText(x.when))}]</em> ` : ''}${esc(x.text)}</li>`).join('');
    const canEquip = owned > equipped;
    const prev = canEquip || owned ? this.preview(s, (lo) => { const free = SLOTS.find((x) => !lo.engravings[x]) || SLOTS[0]; lo.engravings = { ...lo.engravings, [free]: id }; }) : '';
    const goal = (s.goals || []).includes(id);
    const summary = e.effects.map((x) => x.text).join(' · ');
    return `<div class="card ${goal ? 'goal' : ''}" style="--g:${GRADES[e.grade].color}">
      <div class="c-head"><b>${e.name}</b><span><button class="star ${goal ? 'on' : ''}" data-act="goal" data-id="${id}" title="목표로 찜">★</button> <span class="grade">${GRADES[e.grade].name}</span></span></div>
      <div class="c-meta">${ENGRAVING_SKILLS[id] ? `<b style="color:#ffd27a">스킬: ${SKILLS[ENGRAVING_SKILLS[id]].name}</b> · ` : ''}부하 ${e.load} · ${e.tags.map((t) => `<span class="tag" style="--c:${TAGS[t].color}">${TAGS[t].name}</span>`).join(' ')}</div>
      <div class="badges">${this.badges(id, s, b)}</div>
      <div class="c-sum">${esc(summary)}</div>
      <details><summary>자세히</summary><div class="c-stats">${stats}</div><ul class="c-eff">${effs}</ul></details>
      <div class="recipe">${recipe}</div>
      ${prev}
      <div class="c-act">
        <button class="sm" data-act="craft" data-id="${id}" ${can ? '' : 'disabled'}>새기기</button>
        <button class="sm" data-act="equipE" data-id="${id}" ${canEquip ? '' : 'disabled'}>장착</button>
        <span class="muted">보유 ${owned}</span>
      </div>
    </div>`;
  }

  // ───── 장비 (어디서나): 가진 장비만 보고 바로 바꾼다 ─────
  tab_gear(s, b) { return this.tab_shop(s, b, true); }

  // ───── 상점 ─────
  tab_shop(s, b, ownedOnly = false) {
    const gear = s.gear, twoHand = weaponHands(ITEMS[gear.weapon]) >= 2;
    const gearRow = [['weapon', '무기 (오른손)'], ['off', '왼손'], ['armor', '방어구'], ['acc1', '장신구 1'], ['acc2', '장신구 2']]
      .map(([k, n]) => `<div class="slot ${gear[k] ? 'filled' : ''} ${k === 'off' && twoHand && gear.off ? 'resting' : ''}"><div class="sl-name">${n}</div>${gear[k] && ITEMS[gear[k]] ? `<div class="sl-e">${ITEMS[gear[k]].name}</div>${k === 'off' && twoHand ? '<div class="muted">양손 무기라 쉬는 중</div>' : ''}${k !== 'weapon' ? `<button class="sm ghost" data-act="unequipG" data-slot="${k}">빼기</button>` : ''}` : `<div class="muted">${k === 'off' && twoHand ? '양손 무기를 들었다' : '비어 있음'}</div>`}</div>`).join('');
    const card = (id) => {
      const it = ITEMS[id], has = s.items.includes(id);
      const stats = Object.entries(it.stats).map(([k, v]) => `${(STAT_INFO[k] || SPECIAL_INFO[k]).name} ${v > 0 ? '+' : ''}${v}`).join(', ');
      const w = it.weapon ? `<div class="c-meta"><b>${weaponHands(it) >= 2 ? `양손 · ${twoHandBonus(id, it).text.replace(/^[^:]+: /, '')}` : `한손 · 왼손에 도구나 ${FAMILY_NAME[weaponFamily(it)] || '무기'}를 함께 든다`}</b> · ${w2t(it.weapon, s.race)}</div>` : it.off ? `<div class="c-meta"><b>왼손</b> · ${esc(it.odesc || '')} · 한손 무기와 함께 들 때만</div>` : '';
      const req = it.req ? `<div class="c-meta warn">착용 조건: ${Object.entries(it.req).map(([k, v]) => `${STAT_INFO[k].name} ${v}`).join(', ')}</div>` : '';
      const effs = (it.effects || []).map((x) => `<li>${x.when ? `<em>[${esc(condText(x.when))}]</em> ` : ''}${esc(x.text)}</li>`).join('');
      const equipped = Object.values(gear).includes(id);
      const btn = !has
        ? `<button class="sm" data-act="buy" data-id="${id}" ${s.gold >= it.price ? '' : 'disabled'}>구매 ${it.price}</button>`
        : it.slot === 'acc'
          ? `<button class="sm" data-act="equipG" data-id="${id}" data-slot="acc1" ${equipped ? 'disabled' : ''}>장신구1</button><button class="sm" data-act="equipG" data-id="${id}" data-slot="acc2" ${equipped ? 'disabled' : ''}>장신구2</button>`
          : `<button class="sm" data-act="equipG" data-id="${id}" data-slot="${it.slot}" ${gear[it.slot] === id ? 'disabled' : ''}>${gear[it.slot] === id ? '장착 중' : it.slot === 'weapon' ? '오른손' : '장착'}</button>${it.slot === 'weapon' && weaponHands(it) < 2 ? `<button class="sm" data-act="equipG" data-id="${id}" data-slot="off" ${gear.off === id || gear.weapon === id || twoHand ? 'disabled' : ''} title="${twoHand ? '양손 무기를 들고 있다' : '왼손에 든 무기는 능력치 절반 · 같은 계열 둘이면 보너스'}">${gear.off === id ? '왼손 중' : '왼손'}</button>` : ''}`;
      const prev = equipped ? '' : this.preview(s, (lo) => { lo.gear = { ...lo.gear, [it.slot === 'acc' ? (gear.acc1 ? 'acc2' : 'acc1') : it.slot]: id }; });
      return `<div class="card ${has ? 'owned' : ''}"><div class="c-head"><b>${it.name}</b>${it.tags.map((t) => `<span class="tag" style="--c:${TAGS[t].color}">${TAGS[t].name}</span>`).join(' ')}</div>
        ${it.cls ? `<div class="c-meta" style="color:${it.cls === s.cls ? '#ffd27a' : '#9a90b0'}">${CLASSES[it.cls].name} 전용${it.bdesc ? ' · ' + it.bdesc : ''}${it.cls !== s.cls && it.bdesc ? ' (클래스가 다르면 효과 없음)' : ''}</div>` : ''}${w}${req}<div class="c-stats">${stats || '&nbsp;'}</div><ul class="c-eff">${effs}</ul>${prev}<div class="c-act">${btn}</div></div>`;
    };
    const bySlot = (sl) => Object.keys(ITEMS).filter((id) => ITEMS[id].slot === sl && (!ownedOnly || s.items.includes(id)) && (!ITEMS[id].cls || CLASSES[ITEMS[id].cls].race === s.race) && (!ITEMS[id].starter && id !== 'rustySword' || s.items.includes(id)) && (!ITEMS[id].treasure && !ITEMS[id].forged || s.items.includes(id))).sort((a, b) => (ITEMS[b].cls === s.cls) - (ITEMS[a].cls === s.cls)).map(card).join('');
    return `
      <section class="panel"><h3>장착 장비 <small>${s.race === 'dwarf' ? '드워프: 장비 스탯 ×1.5' : ''}</small></h3><div class="slots">${gearRow}</div>
        ${b.notes.filter((n) => /^양손|둘:|^쌍/.test(n.text)).map((n) => `<p class="up">✦ ${esc(n.text)}</p>`).join('') || '<p class="muted">양손 무기는 한손 무기 둘을 합친 만큼의 능력치를 준다 · 한손 무기 둘을 같은 계열로 들면 살짝 강해진다</p>'}</section>
      <section class="panel">${ownedOnly ? '<p class="muted">가진 장비만 보인다. 새 장비는 대장간에서 사거나 만든다.</p>' : ''}<h3>무기</h3><div class="cards">${bySlot('weapon') || '<p class="muted">없음</p>'}</div>
        <h3>왼손 도구 <small>한손 무기를 들면 왼손에 하나 든다 · 스킬은 두 손 중 더 맞는 쪽으로 나간다 · 양손 무기를 들면 쉰다</small></h3><div class="cards">${bySlot('off') || '<p class="muted">없음</p>'}</div>
        <h3>방어구</h3><div class="cards">${bySlot('armor') || '<p class="muted">없음</p>'}</div>
        <h3>장신구</h3><div class="cards">${bySlot('acc') || '<p class="muted">없음</p>'}</div></section>`;
  }

  // ───── 사냥터 ─────
  tab_hunt(s) {
    return `<section class="panel"><h3>관문 정보 <small>원하는 잔향을 주는 몬스터가 사는 곳을 고르세요</small></h3>
      <div class="zones">${ZONES.map((z) => {
        const mons = [...z.pool, z.elite].map((m) => {
          const def = MONSTERS[m], seen = s.codex.kills[m];
          const ec = seen ? `<span style="color:${ECHOES[def.echo.id].color}">◆ ${ECHOES[def.echo.id].name}</span>` : '<span class="muted">◆ ???</span>';
          const cond = def.condEcho && seen ? `<div class="hint">숨겨진 잔향: ${def.condEcho.hint}하면 ${s.codex.echoes[def.condEcho.id] ? ECHOES[def.condEcho.id].name : '???'}</div>` : '';
          const res = seen ? `<span class="muted">물저 ${def.pres} · 마저 ${def.mres}${def.reflect ? ' · 반사' : ''}</span>` : '';
          return `<div class="mon ${def.elite ? 'elite' : ''}"><b>${seen ? def.name : '???'}</b>${def.elite ? ' <span class="warn">정예</span>' : ''} ${ec} ${res}${cond}</div>`;
        }).join('');
        const lvWarn = s.level < z.rec ? 'warn' : '';
        return `<div class="zone" style="--z:${z.pal[1]}">
          <div class="z-head"><b>${z.floor}층 · ${z.name}</b><span class="${lvWarn}">권장 Lv ${z.rec}</span></div>
          ${mons}
          <button data-act="hunt" data-id="${z.id}">바로 들어가기</button>
        </div>`;
      }).join('')}</div>
      <p class="muted">광장 북쪽의 관문으로도 들어갈 수 있습니다. 필드는 넓은 동굴 지형이며, 몬스터는 지역마다 무리지어 삽니다.<br>
      시작 지점의 귀환 포탈로 돌아오면 잔향 전부 · 긴급 귀환(Esc) 70% · 사망 50%</p></section>`;
  }

  // ───── 도감 ─────
  tab_codex(s) {
    const c = s.codex, f = s.story?.flags || {}, items = s.story?.items || {};
    const pts = codexPoints(s), lv = levelFor(pts), tot = codexTotals(s);
    const sec = this.codexSec ||= 'monsters';
    const head = `<div class="codex-head">
      <div><b>도감 점수 ${pts}</b> · 다음 레벨까지 ${lv.need - lv.into}점 <span class="bar"><i style="width:${(lv.into / lv.need) * 100}%"></i></span></div>
      <p class="muted">새 몬스터를 알아가고, 장소를 찾고, 기록을 읽고, 사람의 사연을 끝까지 듣고, 새 물고기를 낚고, 땅속 유물을 찾으면 도감이 채워지고 레벨이 오릅니다.</p>
      <nav class="codex-nav">${[['monsters', `몬스터 ${tot.monsters.done}/${tot.monsters.all}`], ['places', `장소 ${tot.places.done}/${tot.places.all}`], ['records', `기록 ${tot.records.done}/${tot.records.all}`], ['people', `사람 ${tot.people.done}/${tot.people.all}`], ['fish', `물고기 ${tot.fish.done}/${tot.fish.all}`], ['artifacts', `유물 ${tot.artifacts.done}/${tot.artifacts.all}`], ['etc', '원소 반응 · 태그']]
        .map(([k, n]) => `<button class="sm ${sec === k ? 'on' : 'ghost'}" data-act="codexSec" data-id="${k}">${n}</button>`).join('')}</nav></div>`;
    let body = '';
    if (sec === 'monsters') {
      const dropsOf = (id) => Object.values(STORY_ITEMS).filter((it) => it.from[id]).map((it) => it.name);
      body = codexGroups().map(({ name, ids }) => {
        return `<h4>${name}</h4><div class="list">${ids.map((id) => {
          const m = MONSTERS[id], n = c.kills?.[id] || 0, st = monsterStage(id, n);
          if (!st) return '<div class="li off">??? <small>아직 만나지 못했다</small></div>';
          const stars = '★'.repeat(st) + '☆'.repeat(Math.max(0, STAGE_MAX - st));
          const next = st < STAGE_MAX ? ` · 다음 단계까지 ${STAGE_KILLS[st] - n}마리` : ` · <b>완성</b> · 다음 1점까지 ${Math.max(200, (Math.floor(n / 100) + 1) * 100) - n}마리`;
          const info = [`HP ${m.hp} · ${m.type === 'mag' ? '마법' : '물리'} 공격 ${m.atk}`];
          if (st >= 2) info.push(`물리 저항 ${m.pres} / 마법 저항 ${m.mres}${m.status ? ` · ${({ burn: '화상', poison: '중독', bleed: '출혈', chill: '냉기' })[m.status]}을 건다` : ''}`, `떨어뜨림: ${[m.echo && ECHOES[m.echo.id]?.name, ...dropsOf(id)].filter(Boolean).join(', ')}`);
          else info.push('<span class="muted">5마리를 잡으면 약점과 떨어뜨리는 것이 기록된다</span>');
          return `<div class="li ${st >= STAGE_MAX ? 'on' : ''}"><b>${m.name}</b> <span class="stars">${stars}</span> <small>처치 ${n}${next}</small><br><small>${info.join('<br>')}</small></div>`;
        }).join('')}</div>`;
      }).join('');
    } else if (sec === 'places') {
      body = PLACE_ZONES.map((z) => `<h4>${z.id === 'world' ? '' : `${z.floor}층 · `}${z.name}</h4><div class="list">${zonePlaces(z).map((n) => c.places?.[placeKey(z.id, n)] ? `<div class="li on"><b>${n}</b></div>` : '<div class="li off">??? <small>아직 찾지 못한 장소</small></div>').join('')}</div>`).join('');
    } else if (sec === 'records') {
      const sr = Object.keys(SANCT_ALL), relRows = [];
      for (let i = 0; i < sr.length; i++) for (let j = i + 1; j < sr.length; j++) { const r = relation(sr[i], sr[j]); if (r.v) relRows.push([sr[i], sr[j], r]); }
      relRows.sort((p, q) => p[2].v - q[2].v);
      const story = `<h4>바람결의 섬 이야기</h4><div class="list">${WORLD_HISTORY.map((h) => `<details class="li on"><summary><b>${h.title}</b></summary><p>${esc(h.text)}</p></details>`).join('')}</div>
        <h4>종족 사이 <small>성지 창의 「이야기」에서 더 자세히</small></h4><div class="list">${relRows.map(([a2, b2, r]) => `<div class="li"><b style="color:${SANCT_ALL[a2].color}">${RACES[a2]?.name || a2}</b> · <b style="color:${SANCT_ALL[b2].color}">${RACES[b2]?.name || b2}</b> <span class="rel-tag" style="--c:${REL_COLOR[r.v]}">${REL_NAME[r.v]}</span><br><small>${esc(r.why)}</small></div>`).join('')}</div>`;
      body = story + `<h4>등반가 세린의 일지</h4><div class="list">${Object.entries(JOURNALS).map(([id, j]) => c.journals?.[id] ? `<details class="li on"><summary><b>${j.title}</b> <small>${j.where}</small></summary><p class="journal">${esc(j.text).replace(/\n/g, '<br>')}</p></details>` : '<div class="li off">??? <small>찢겨 나간 일지 한 장</small></div>').join('')}</div>
        <h4>고대 석판</h4><div class="list">${(c.lore || []).map((t) => `<div class="li lore">${esc(t)}</div>`).join('') || '<div class="li off">필드의 고대 석판을 찾아 읽어 보세요.</div>'}</div>
        <h4>가지고 있는 이야기 물건</h4><div class="list">${Object.entries(items).filter(([, n]) => n > 0).map(([id, n]) => `<div class="li"><b style="color:${STORY_ITEMS[id].color}">${STORY_ITEMS[id].name}</b>${n > 1 ? ` ×${n}` : ''} <small>${STORY_ITEMS[id].desc}</small></div>`).join('') || '<div class="li off">없음</div>'}</div>`;
    } else if (sec === 'fish') {
      body = fishCodex(s);
    } else if (sec === 'artifacts') {
      body = artifactCodex(s);
    } else if (sec === 'people') {
      body = `<div class="list">${Object.values(PEOPLE).map((p) => {
        const done = p.steps.filter((st) => f[st]).length;
        if (!done) return '<div class="li off">??? <small>아직 만나지 못한 사람</small></div>';
        return `<div class="li ${done === p.steps.length ? 'on' : ''}"><b>${p.name}</b> <small>${p.title} · 사연 ${done}/${p.steps.length}</small><br><small>${p.summary.slice(0, done).join('<br>')}</small></div>`;
      }).join('')}</div>`;
    } else {
      const reactions = Object.entries(REACTIONS).map(([id, r]) => s.codex.reactions?.[id]
        ? `<div class="li on"><b>${r.name}</b> (${r.recipe}) ${r.desc}</div>`
        : '<div class="li off">??? 아직 발견하지 못한 원소 반응</div>').join('');
      const tags = Object.values(TAGS).map((t) => `<div class="li"><span class="tag" style="--c:${t.color}">${t.name}</span> ${t.tiers.map((x) => `${x.n}개: ${x.text}`).join(' / ')}</div>`).join('');
      body = `<h4>원소 반응</h4><div class="list">${reactions}</div><p class="muted">상태이상이 겹치면 반응이 일어납니다. 지속 피해(화상·중독·출혈)는 적의 저항을 무시합니다.</p>
        <h4>태그 시너지</h4><div class="list">${tags}</div><p class="muted">화염과 냉기를 둘 다 4개 이상 모으면 서로 상쇄되어 둘 다 꺼집니다.</p>`;
    }
    return `<section class="panel codex">${head}${body}</section>`;
  }

  // 장착하면 수치가 어떻게 바뀌는지 미리보기
  preview(s, patch) {
    const base = this.b, lo = toLoadout(s);
    lo.engravings = { ...lo.engravings }; lo.gear = { ...lo.gear };
    patch(lo);
    const nb = computeBuild(lo), a = base.derived, b = nb.derived;
    const chips = [];
    const num = (label, k, digits = 0, mul = 1) => {
      const dv = (b[k] - a[k]) * mul;
      if (Math.abs(dv) < (digits ? 0.005 : 0.5)) return;
      chips.push(`<span class="pv ${dv > 0 ? 'up' : 'down'}">${label} ${dv > 0 ? '+' : ''}${digits ? dv.toFixed(digits) : Math.round(dv)}</span>`);
    };
    num('HP', 'maxHp'); num('물공', 'physAtk'); num('마공', 'magAtk'); num('공속', 'atkSpeed', 2);
    num('치명%', 'crit', 0, 100); num('물감%', 'physDR', 0, 100); num('마감%', 'magDR', 0, 100); num('피해×', 'dmgMul', 2);
    const synA = base.synergies.filter((x) => x.on).length, synB = nb.synergies.filter((x) => x.on).length;
    if (synB !== synA) chips.push(`<span class="pv ${synB > synA ? 'up' : 'down'}">시너지 ${synB > synA ? '+' : ''}${synB - synA}</span>`);
    const awA = base.awakenings.filter((x) => x.on).length, awB = nb.awakenings.filter((x) => x.on).length;
    if (awB !== awA) chips.push(`<span class="pv ${awB > awA ? 'up' : 'down'}">각성 ${awB > awA ? '+' : ''}${awB - awA}</span>`);
    if (nb.overload && !base.overload) chips.push('<span class="pv down">과부하!</span>');
    return chips.length ? `<div class="preview">장착 시 ${chips.join('')}</div>` : '<div class="preview muted">장착 시 변화 없음</div>';
  }

  tab_quest(s) {
    refreshQuests(s); this.save();
    const zn = (id) => ZONES.find((z) => z.id === id).name;
    const cards = s.quests.map((q) => `<div class="card quest ${q.done ? 'done' : ''}">
      <div class="c-head"><b>${q.text}</b><span class="grade">${zn(q.zone)}</span></div>
      <div class="qbar"><i style="width:${(q.progress / q.n) * 100}%"></i><span>${q.progress} / ${q.n}${q.kind === 'explore' ? '%' : ''}</span></div>
      <div class="c-meta">보상: 골드 ${q.reward.gold}</div>
      <div class="c-act"><button class="sm" data-act="claim" data-id="${q.id}" ${q.done ? '' : 'disabled'}>${q.done ? '보상 받기' : '진행 중'}</button></div>
    </div>`).join('');
    return `<section class="panel"><h3>의뢰 게시판 <small>의뢰인 마르코: "탑 아래 사람들이 부탁한 일들이오."</small></h3>
      <div class="cards">${cards}</div>
      <p class="muted">의뢰는 해당 지역에서 사냥을 마치고 돌아오면 진행됩니다. 완료하면 새 의뢰가 올라옵니다.</p></section>`;
  }

  onClick(ev) {
    const t = ev.target.closest('[data-tab],[data-act]');
    if (!t) return;
    const s = this.s;
    if (t.dataset.act === 'whereGo') { this.whereQ = this.root.querySelector('#whereQ')?.value || ''; return this.render(); }
    if (t.dataset.tab) {
      sfx('select', { vol: 0.4 });
      this.tab = t.dataset.tab;
      try { localStorage.setItem('et-tab', this.tab); } catch { /* 무시 */ }
      return this.render();
    }
    const { act, k, id, slot } = t.dataset;
    sfx(act === 'craft' || act === 'forge' || act === 'toolUp' || act === 'reinforce' ? 'reaction' : act === 'buy' || act === 'tbuy' || act === 'tsell' || act === 'tsellQuick' ? 'coin' : act === 'claim' ? 'levelup' : act === 'close' ? 'close' : 'click', { vol: 0.5 });
    if (lifeClick(this, act, t) || homeClick(this, act, t)) { this.save(); return this.render(); }
    switch (act) {
      case 'claim': { const r = claimQuest(s, id); if (r) { this.toast(`보상: 골드 ${r.q.reward.gold}`); this.onQuest?.(); } break; }
      case 'alloc': if (s.points > 0) { s.alloc[k] = (s.alloc[k] || 0) + (ev.shiftKey ? Math.min(5, s.points) : 1); s.points -= ev.shiftKey ? Math.min(5, s.points) : 1; } break;
      case 'unalloc': if (s.alloc[k]) { s.alloc[k]--; s.points++; } break;
      case 'respec': for (const v of Object.values(s.alloc)) s.points += v; s.alloc = {}; this.toast('스탯 배분을 초기화했습니다'); break;
      case 'craft': {
        const e = ENGRAVINGS[id];
        for (const [eid, n] of Object.entries(e.recipe)) s.echoes[eid] -= n;
        s.owned[id] = (s.owned[id] || 0) + 1;
        this.toast(`${e.name} 각인을 새겼습니다`);
        break;
      }
      case 'equipE': {
        const e = ENGRAVINGS[id];
        const target = SLOTS.find((x) => !s.slots[x]);
        if (!target) { this.toast('빈 각인 칸이 없습니다. 먼저 하나를 빼세요'); break; }
        s.slots[target] = id;
        this.toast(`${e.name} 장착${ENGRAVING_SKILLS[id] ? ` · 스킬 「${SKILLS[ENGRAVING_SKILLS[id]].name}」 사용 가능` : ''}`);
        break;
      }
      case 'unequipE': delete s.slots[slot]; break;
      case 'skillOn': {
        const cur = [...this.curSkills()];
        if (cur.includes(id)) break;
        if (cur.length >= 4) cur[3] = id; else cur.push(id);
        const used = cur.reduce((a, k) => a + skillLoad(k), 0), cap = skillCap(s.level || 1);
        if (used > cap) { this.toast(`스킬 부하가 넘친다 (${used} / ${cap}) · 다른 스킬을 빼거나 레벨을 올리자`); break; }
        s.skills = cur; break;
      }
      case 'setCls': {
        const c = CLASSES[id];
        if (!c || c.race !== s.race) break;
        s.cls = id; s.skills = undefined; s.style = c.style;
        const starter = c.weapons[0];
        if (!s.items.includes(starter)) { s.items.push(starter); this.toast(`${c.name} · 시작 무기 「${ITEMS[starter].name}」를 받았습니다`); }
        else this.toast(`${c.name}(으)로 바꿨습니다`);
        if (ITEMS[s.gear.weapon]?.cls && ITEMS[s.gear.weapon].cls !== id) s.gear.weapon = starter;
        break;
      }
      case 'practice': this.onClose(); return this.onStartRun('__practice');
      case 'skillOff': s.skills = this.curSkills().filter((x) => x !== id); break;
      case 'skillUp': { const cur = [...this.curSkills()], i = cur.indexOf(id); if (i > 0) { [cur[i - 1], cur[i]] = [cur[i], cur[i - 1]]; s.skills = cur; } break; }
      case 'buy': {
        const it = ITEMS[id];
        if (s.gold >= it.price) { s.gold -= it.price; s.items.push(id); this.toast(`${it.name} 구매`); }
        break;
      }
      case 'equipG':
        if (slot === 'off' && s.gear.weapon === id) break;
        if (slot === 'weapon' && s.gear.off === id) delete s.gear.off; // 왼손에 있던 무기를 오른손으로
        s.gear[slot] = id; break;
      case 'unequipG': delete s.gear[slot]; break;
      case 'filter': this.altarFilter = id; break;
      case 'codexSec': this.codexSec = id; break;
      case 'goal': {
        s.goals ||= [];
        const i = s.goals.indexOf(id);
        if (i >= 0) s.goals.splice(i, 1); else { s.goals.push(id); this.toast(`${ENGRAVINGS[id].name}을(를) 목표로 찜했습니다`); }
        break;
      }
      case 'hunt': return this.onStartRun(id);
      case 'close': return this.onClose();
      case 'copyCode': $('#buildCode').select(); try { navigator.clipboard.writeText($('#buildCode').value); } catch { /* 무시 */ } this.toast('빌드 코드를 복사했습니다'); return;
      case 'peek': {
        try {
          const lo = decodeLoadout($('#peekCode').value);
          const pb = computeBuild(lo), d = pb.derived;
          $('#peekOut').innerHTML = `<div class="peek">${RACES[lo.race].name} Lv${lo.level} · HP ${d.maxHp} · 물공 ${Math.round(d.physAtk)} · 마공 ${Math.round(d.magAtk)} · 각성 ${pb.awakenings.filter((a) => a.on).length}개 · 시너지 ${pb.synergies.filter((x) => x.on).length}개<br>
            각인: ${Object.values(lo.engravings).map((x) => ENGRAVINGS[x]?.name).join(', ') || '없음'}</div>`;
        } catch { this.toast('잘못된 빌드 코드입니다'); }
        return;
      }
      case 'reset':
        if (t.dataset.armed) return this.onReset();
        t.dataset.armed = '1'; t.textContent = '정말 지울까요? 한 번 더 누르면 초기화'; t.classList.add('danger');
        setTimeout(() => { if (t.isConnected) { delete t.dataset.armed; t.textContent = '처음부터 다시 시작'; t.classList.remove('danger'); } }, 4000);
        return;
    }
    this.save();
    this.render();
  }
}

// 도감의 몬스터 묶음: 탑의 층 → 섬 → 미궁 → 용궁 (몬스터마다 처음 나오는 곳 하나에만)
function codexGroups() {
  const groups = [
    ...ZONES.map((z) => ({ name: `${z.floor}층 · ${z.name}`, ids: [...z.pool, z.elite, ...(z.id === 'cave' ? ['treasureGoblin'] : [])] })),
    { name: `${WORLD_ZONE.name} · 들판과 동굴`, ids: [...WORLD_ZONE.pool, ...Object.values(ENTRANCES).map((d) => d.elite).filter(Boolean)] },
    { name: LABY_ZONE.name, ids: [...LABY_ZONE.pool, LABY_ZONE.elite] },
    { name: PALACE_ZONE.name, ids: [...PALACE_ZONE.pool, PALACE_ZONE.elite] },
  ];
  const seen = new Set();
  for (const g of groups) g.ids = g.ids.filter((id) => MONSTERS[id] && !seen.has(id) && seen.add(id));
  const rest = Object.keys(MONSTERS).filter((id) => !seen.has(id));
  if (rest.length) groups.push({ name: '그 밖의 것', ids: rest });
  return groups.filter((g) => g.ids.length);
}

function zoneOfEcho(eid) {
  for (const z of ZONES) for (const m of [...z.pool, z.elite]) {
    const def = MONSTERS[m];
    if (def.echo.id === eid || def.condEcho?.id === eid) return z.id;
  }
  return null;
}

// 무기 설명: 우클릭 무기 능력 · (마법사만) 한 번 쏠 때 드는 마력 · 근접/원거리 성질
function w2t(w, race) {
  const sk = WEAPON_SKILLS[w.skill];
  return `${sk ? `우클릭: ${sk.name} (${sk.desc}) · ` : ''}${w.mana && race === 'wizard' ? `한 발에 마력 ${w.mana} · ` : ''}${w.kind === 'melee' ? '근접 (받는 피해 -20%, 적중 시 적 공격 끊기)' : '원거리 (쏘는 동안 이동 -35%, 근거리 피해 -30%, 먼 거리 +10%)'} · ${w.dmg === 'phys' ? '물리' : '마법'} · 피해 ×${w.mul} · 속도 ${w.speed}${w.count ? ` · ${w.count}발` : ''}${w.pierce ? ` · 관통 ${w.pierce}` : ''}`;
}

// 종족 선택 화면
export function renderRaceSelect(root, onPick, onIntro) {
  // 골렘족은 새로 고를 수 없다 (예전 저장의 골렘은 그대로 쓸 수 있다)
  root.innerHTML = `<div class="race-select">
    <h1>아르케</h1>
    ${onIntro ? '<button class="intro-again" id="introAgain">▶ 인트로 다시 보기</button>' : ''}
    <p class="muted">탑에 잠든 고대 문양을 몸에 새겨라. 강한 각인보다 <b>맞물리는 조합</b>이 이긴다.</p>
    <div class="races">${Object.entries(RACES).filter(([id]) => id !== 'golem').map(([id, r]) => `
      <button class="race" data-race="${id}">
        <canvas width="96" height="120" data-race="${id}"></canvas>
        <b>${r.name}</b><small>${r.origin} · ${r.passive}</small>
        <div class="mini-stats">${BASE_STATS.map((k) => `<span><i>${STAT_INFO[k].short}</i><em style="width:${r.base[k] * 4}px"></em>${r.base[k]}</span>`).join('')}</div>
        <p>${r.desc}</p>
        <p class="sw"><span class="up">강점 ${r.strong}</span><span class="down">약점 ${r.weak}</span></p>
      </button>`).join('')}</div>
    <p class="muted credit">그래픽: 16x16 DungeonTileset II by 0x72 (CC0) · 효과음: Kenney (CC0) · 글꼴: 갈무리, Noto Sans KR (OFL)</p></div>`;
  root.querySelectorAll('.race').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.race)));
  root.querySelector('#introAgain')?.addEventListener('click', onIntro);
}

// 탑 등반 화면과 흐름: 탑 문 · 층 들어가기 · 보상 고르기(각인 · 연마 · 축복) · 상인 · 제단 · 쉼터 · 결산 · 탑의 축복 · 서약
// main.js 의 상태(저장 · 세계 · 창)는 ctx 로 받는다.
import { World } from '../sim/world.js';
import { computeBuild } from '../sim/build.js';
import { buildClimbFloor } from '../sim/climbmap.js';
import { createRng } from '../sim/rng.js';
import { evalCond, condText } from '../sim/conditions.js';
import { toLoadout, applyRun } from '../save.js';
import { ZONES } from '../data/monsters.js';
import { ENGRAVINGS, TAGS } from '../data/engravings.js';
import { SKILLS, ENGRAVING_SKILLS } from '../data/skills.js';
import { STAT_INFO, SPECIAL_INFO } from '../data/stats.js';
import {
  CLIMB_TOP, ACTS, actOf, floorKind, recLevel, REWARDS, newRun, offerEngravings, addEngraving, offerHone, BLESSINGS, offerBless,
  ALTARS, rollAltars, rollShop, ENG_PRICE, shopPrice, runEffects, shardGain, goldGain, goldReward, shardReward, clearReward,
  META, OATHS, oathScore, climbStarts, startBonus, newClimbSave, GRADE_NAME, GRADE_COLOR, runTags, FLOOR_MODS,
} from '../data/climb.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const statName = (k) => (STAT_INFO[k] || SPECIAL_INFO[k] || { name: k }).name;
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function createClimb(ctx) {
  const S = () => ctx.save();
  const CS = () => { const c = (S().climb ||= newClimbSave()); if (!c.meta) for (const [k, v] of Object.entries(newClimbSave())) if (c[k] === undefined) c[k] = v; return c; }; // 예전 · 반쯤 만든 기록도 빈칸을 채운다
  const meta = () => CS().meta;
  const run = () => S().run;
  let rng = createRng((Date.now() ^ 0x5eed) >>> 0);
  let keyPick = null; // 숫자 키로 고르기 (창이 떠 있을 때)

  function buildFor(r) {
    const lo = toLoadout(S());
    // 스킬 칸은 그대로: 각인이 준 스킬은 빈 칸에만 들어간다 (Q·E·R·F가 밀리지 않게)
    if (!lo.skills) lo.skills = computeBuild(lo).skills.slice();
    else lo.skills = lo.skills.slice();
    for (const e of r.eng) { const sk = ENGRAVING_SKILLS[e.id]; if (sk && lo.skills.length < 4 && !lo.skills.includes(sk)) lo.skills.push(sk); }
    lo.runEng = r.eng; lo.extraEffects = runEffects(r, meta());
    return computeBuild(lo);
  }
  // 빌드를 다시 계산해 세계에 넣는다 (체력 비율은 그대로)
  function rebuild() {
    const w = ctx.world(), r = run(); if (!w || !r) return;
    const k = w.player.hp / Math.max(1, w.d.maxHp);
    w.setBuild(buildFor(r));
    w.player.hp = Math.max(1, Math.min(w.d.maxHp, k * w.d.maxHp));
  }
  function close() { keyPick = null; ctx.closeModal(); }

  // ───── 탑 문 앞 ─────
  function showTowerMenu() {
    const c = CS(), r = run(), starts = climbStarts(c.best), sc = oathScore(c.oath);
    const lordsDone = Object.keys(c.lords || {}).length;
    const acts = ACTS.map((a) => `<span class="cl-act ${c.best >= a.to ? 'done' : c.best >= a.from - 1 ? 'now' : ''}" style="--c:${a.color}"><b>${a.from}~${a.to}층</b>${a.name}<small>권장 Lv ${a.rec}+</small></span>`).join('');
    ctx.showModal(`<h2>각인의 탑</h2>
      <p class="muted">층마다 적을 모두 쓰러뜨리고 → 보상을 고르고 → 다음 문을 고른다. 5층마다 수호자, 10층마다 구역의 주인.<br>쓰러져도 <b class="cl-star">✦ 별빛</b>은 남는다. 별빛으로 <b>탑의 축복</b>을 배워 더 높이.</p>
      <div class="cl-acts">${acts}</div>
      <p>최고 기록 <b>${c.best}층</b> / ${CLIMB_TOP} · 별빛 <b class="cl-star">✦ ${c.shards}</b>${lordsDone ? ` · 서약 <b>${sc}</b>` : ''} · 내 레벨 <b>Lv ${S().level}</b></p>
      ${r ? `<div class="cl-resume"><b>오르던 등반이 있다 — ${r.f}층</b> · 각인 ${r.eng.length}개 · 탑 금화 ${r.gold}<div class="actions"><button id="clResume">이어서 오르기</button><button id="clAbandon" class="ghost">포기한다 (별빛 ${r.shards}은 받는다)</button></div></div>`
        : `<div class="actions">${starts.map((f) => `<button data-clstart="${f}" class="${f === 1 ? '' : 'ghost'}">${f}층부터${f > 1 ? ` (각인 ${startBonus(f).eng} · 축복 ${startBonus(f).bless} 먼저)` : ''}</button>`).join('')}</div>`}
      <div class="actions"><button id="clMeta" class="ghost">탑의 축복 (영구 성장)</button>${lordsDone ? '<button id="clOath" class="ghost">서약 (난이도)</button>' : ''}${c.runs ? '<button id="clRec" class="ghost">기록</button>' : ''}<button data-close class="ghost">돌아간다</button></div>
      ${ctx.partyLeader?.() && !r ? '<p class="muted">파티장이다 — 파티와 함께 오르려면 「파티와 오르기」</p><div class="actions"><button id="clParty">1층부터 파티와 오르기</button></div>' : ''}`);
    document.querySelectorAll('[data-clstart]').forEach((b) => (b.onclick = () => { close(); startClimb(+b.dataset.clstart); }));
    const $ = (id) => document.getElementById(id);
    if ($('clResume')) $('clResume').onclick = () => { close(); resume(); };
    if ($('clAbandon')) $('clAbandon').onclick = () => { const r2 = run(); finish('retreat', r2, null); };
    $('clMeta').onclick = () => showMeta(showTowerMenu);
    if ($('clOath')) $('clOath').onclick = () => showOath(showTowerMenu);
    if ($('clRec')) $('clRec').onclick = () => showRecords(showTowerMenu);
    if ($('clParty')) $('clParty').onclick = () => { close(); ctx.startCoClimb?.(1); };
  }

  // ───── 등반 시작 · 층 들어가기 ─────
  function startClimb(startF = 1, co = null) {
    const c = CS(), m = meta();
    const r = newRun({ startF, seed: co?.seed ?? ((Math.random() * 1e9) >>> 0), meta: m, oath: c.oath });
    const sb = startBonus(startF);
    r.pending = [];
    for (let i = 0; i < (m.start || 0); i++) r.pending.push({ type: 'eng', why: '출발의 각인' });
    for (let i = 0; i < sb.eng; i++) r.pending.push({ type: 'eng', why: `${startF}층부터 · 출발 각인`, minGrade: 2 });
    for (let i = 0; i < sb.bless; i++) r.pending.push({ type: 'bless', why: `${startF}층부터 · 출발 축복` });
    S().run = r;
    ctx.beforeClimb?.();
    enterFloor('eng', co ? { role: co.role, host: co.host } : null);
  }
  function resume() {
    const r = run(); if (!r) return;
    r.f = Math.max(r.startF - 1, r.f - 1);
    ctx.beforeClimb?.();
    enterFloor(r.door || 'eng');
  }
  // door: 고른 문 (보상 종류 또는 방 종류)
  function enterFloor(door, co = ctx.coSpec?.() || null) {
    const r = run();
    r.f++; r.door = door;
    const f = r.f, act = actOf(f), zone = ZONES.find((z) => z.id === act.zone);
    const fk = floorKind(f);
    const room = fk !== 'fight' ? fk : REWARDS[door]?.room ? door : door === 'trial' ? 'trial' : 'fight';
    const seed = (r.seed + f * 7919) >>> 0;
    const map = buildClimbFloor(zone, seed, f, room);
    const prev = ctx.world();
    const w = new World({ build: buildFor(r), mode: 'field', zone: { ...zone, dark: zone.dark * 0.45 }, zoneId: zone.id, seed, map, tower: { f }, climb: { run: r, f, kind: room, reward: room === 'fight' ? door : null, meta: meta() }, story: S().story, codex: S().codex, ...ctx.shared(), coop: co ? { role: co.role } : null });
    const same = prev?.climb?.run === r; // 같은 등반의 다음 층이면 전리품을 이어서
    if (same && prev.loot) { w.loot = prev.loot; w.discovered = prev.discovered; }
    w.codexStart = same ? prev.codexStart : ctx.codexNow();
    w.player.hp = Math.max(1, Math.round((r.hpFrac ?? 1) * w.d.maxHp));
    if (r.res != null) w.player.res = r.res;
    ctx.setWorld(w, co);
    const rec = recLevel(f), low = S().level < rec;
    const R = REWARDS[door];
    const MOD = FLOOR_MODS[w.climb.mod];
    ctx.banner({ text: fk === 'lord' ? `${f}층 · ${act.name}의 주인` : fk === 'guardian' ? `${f}층 · 수호자` : MOD ? `${f}층 · ${MOD.name}` : `각인의 탑 ${f}층`, sub: `${MOD ? `${MOD.text} · ` : ''}${act.name}${R && fk === 'fight' ? ` · 보상: ${R.name}` : ''}${low ? ` · 권장 Lv ${rec} (지금 Lv ${S().level} · 적이 더 세다)` : ''}`, t: 2.6, color: fk === 'lord' ? '#ff7a5a' : fk === 'guardian' ? '#ffb07a' : act.color });
    ctx.music(zone.id); ctx.sfx('open'); ctx.startLoop();
    ctx.save0();
    ctx.onEvent?.('floor', { f });
    setTimeout(nextPending, 300);
  }
  function nextPending() {
    const r = run(); if (!r?.pending?.length || ctx.modalOpen()) return;
    const p = r.pending.shift();
    if (p.type === 'eng') pickEng({ minGrade: p.minGrade || 1, title: p.why }, nextPending);
    else if (p.type === 'bless') pickBless(p.why, nextPending);
    else if (p.type === 'hone') pickHone(p.why, nextPending);
  }

  // 파티 등반 (동료): 파티장이 고른 문으로 함께 간다
  function follow(door) {
    const w = ctx.world(), r = run(); if (!w || !r) return;
    const o = w.objects.find((x) => x.kind === 'climbReward' && !x.opened);
    if (o) (r.pending ||= []).push({ type: o.reward === 'eng' || o.reward === 'hone' || o.reward === 'bless' ? o.reward : 'eng', why: '지난 층의 보상', minGrade: o.minGrade });
    if (ctx.modalOpen()) close();
    r.hpFrac = Math.max(0.05, w.player.hp / w.d.maxHp); r.res = w.player.res; r.time += w.tower?.t || 0;
    if (door === 'shop') r.lastShop = r.f + 1;
    enterFloor(door);
  }

  // ───── 신호 (세계 → 화면) ─────
  function signal(s) {
    const w = ctx.world(), r = run();
    if (!r || !w?.climb) return false;
    if (s.t === 'climbCleared') {
      const rw = clearReward(w.climb.reward || w.climb.kind);
      const got = shardGain(1 + (rw.shards || 0) + (FLOOR_MODS[w.climb.mod]?.shards || 0), r, meta());
      r.shards += got;
      const c = CS();
      if (s.f > c.best) c.best = s.f;
      if (s.kind === 'lord') {
        const act = actOf(s.f), first = !c.lords[act.n];
        c.lords[act.n] = (c.lords[act.n] || 0) + 1;
        if (first && act.n === 1) ctx.banner({ text: '서약이 열렸다', sub: '탑 문 앞에서 서약을 걸면 별빛을 더 받는다', t: 4, color: '#c45cff' });
      }
      if (s.kind === 'guardian' || s.kind === 'lord') r.bosses.push(w.climb.boss?.def.name || '');
      r.hpFrac = w.player.hp / w.d.maxHp;
      ctx.floatText(`✦ +${got}`, '#b8a8ff');
      ctx.save0();
      ctx.onEvent?.('cleared', { f: s.f, kind: s.kind });
      return true;
    }
    if (s.t === 'climbReward') { openReward(s); return true; }
    if (s.t === 'climbDoor') {
      r.hpFrac = Math.max(0.05, w.player.hp / w.d.maxHp); r.res = w.player.res; r.time += w.tower?.t || 0;
      if (s.next === 'shop') r.lastShop = r.f + 1;
      ctx.onDoor?.(s.next);
      enterFloor(s.next);
      return true;
    }
    if (s.t === 'climbRoom') { openRoom(s.room); return true; }
    if (s.t === 'climbTop') { r.time += w.tower?.t || 0; finish('top', r, w); return true; }
    return false;
  }

  function openReward(s) {
    const r = run(), w = ctx.world();
    const done = () => { w.climbRewardTaken(); rebuild(); ctx.save0(); };
    if (s.reward === 'eng') return pickEng({ minGrade: s.minGrade, legendary: s.legendary, title: s.legendary ? '구역의 주인이 남긴 문양' : s.minGrade >= 4 ? '수호자가 남긴 문양' : s.minGrade >= 3 ? '시련의 보상' : '각인' }, done);
    if (s.reward === 'hone') return pickHone('연마', done);
    if (s.reward === 'bless') return pickBless('축복', done);
    if (s.reward === 'gold') { const g = goldGain(goldReward(r.f), r, meta()); r.gold += g; ctx.floatText(`탑 금화 +${g}`, '#ffd84a'); ctx.sfx('coin'); return done(); }
    if (s.reward === 'heal') { const before = w.player.hp; w.heal(w.d.maxHp * 0.25, 'spring'); ctx.floatText(`체력 +${Math.round(w.player.hp - before)}`, '#7be38a'); ctx.sfx('levelup', { vol: 0.5 }); return done(); }
    if (s.reward === 'shard') { const g = shardGain(shardReward(r.f), r, meta()); r.shards += g; ctx.floatText(`✦ 별빛 +${g}`, '#b8a8ff'); ctx.sfx('levelup', { vol: 0.5 }); return done(); }
    done();
  }

  // ───── 각인 카드 ─────
  function engCard(id, up, b, idx) {
    const e = ENGRAVINGS[id], r = run(), cur = r.eng.find((x) => x.id === id), tags = runTags(r);
    const ctxB = { stats: b.stats, tags: b.tags, race: b.race, extreme: b.extreme };
    const stats = Object.entries(e.stats || {}).map(([k, v]) => `${statName(k)} ${v > 0 ? '+' : ''}${v}`).join(' · ');
    const effs = (e.effects || []).map((x) => { const ok = !x.when || evalCond(x.when, ctxB); return `<li class="${ok ? '' : 'off'}">${x.when ? `<em>[${esc(condText(x.when))}]</em> ` : ''}${esc(x.text)}</li>`; }).join('');
    const syn = (e.tags || []).map((t) => {
      const n = (tags[t] || 0) + (up ? 0 : 1), T = TAGS[t];
      const tier = !up && T?.tiers.find((x) => x.n === n);
      return `<span class="tag" style="--c:${T?.color || '#aaa'}">${T?.name || t} ${n}${tier ? ' ▲발동' : ''}</span>`;
    }).join(' ');
    const sk = ENGRAVING_SKILLS[id] ? `<div class="cl-skill">스킬: ${SKILLS[ENGRAVING_SKILLS[id]]?.name || ''}</div>` : '';
    return `<button class="cl-card" data-pick="${idx}" style="--g:${GRADE_COLOR[e.grade]}">
      <span class="cl-key">${idx + 1}</span>
      <span class="cl-grade">${GRADE_NAME[e.grade]}${up ? ` · 연마 ${cur?.lv ?? 0} → ${(cur?.lv ?? 0) + 1}` : ''}</span>
      <b>${esc(e.name)}</b>
      <span class="cl-tags">${syn}</span>${sk}
      ${stats ? `<span class="cl-stats">${stats}</span>` : ''}
      <ul>${effs}</ul></button>`;
  }
  function pickModal(title, sub, cards, onPick, opts = {}) {
    const r = run();
    const reroll = opts.reroll && r.rerolls > 0;
    ctx.showModal(`<h2>${esc(title)}</h2>${sub ? `<p class="muted">${sub}</p>` : ''}<div class="cl-cards">${cards.join('')}</div>
      <div class="actions">${reroll ? `<button id="clReroll" class="ghost">다시 고르기 (남은 ${r.rerolls})</button>` : ''}${opts.skip ? `<button id="clSkip" class="ghost">${opts.skip}</button>` : ''}</div>
      <p class="muted cl-hint">숫자 키 1 · 2 · 3 으로도 고른다</p>`, () => {});
    const choose = (i) => { keyPick = null; onPick(i); };
    document.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => choose(+b.dataset.pick)));
    keyPick = (i) => { if (i < cards.length) choose(i); };
    const rb = document.getElementById('clReroll'); if (rb) rb.onclick = () => { r.rerolls--; opts.reroll(); };
    const sk = document.getElementById('clSkip'); if (sk) sk.onclick = () => { keyPick = null; opts.onSkip(); };
  }
  function pickEng(o, then) {
    const r = run(), b = ctx.world()?.b || buildFor(r);
    const offers = offerEngravings(r, rng, { n: 3, minGrade: o.minGrade || 1, legendary: o.legendary, luck: meta().luck || 0 });
    if (!offers.length) { then?.(); return; }
    const owned = r.eng.length;
    pickModal(o.title || '각인', `새긴 각인 ${owned} / 6 · 다 차면 가진 각인의 연마만 나온다${Object.keys(runTags(r)).length ? ` · ${Object.entries(runTags(r)).map(([t, n]) => `${TAGS[t]?.name} ${n}`).join(' · ')}` : ''}`,
      offers.map((x, i) => engCard(x.id, x.up, b, i)), (i) => {
        const x = offers[i]; addEngraving(r, x.id);
        ctx.sfx('levelup', { vol: 0.6 });
        close(); ctx.floatText(`${ENGRAVINGS[x.id].name}${x.up ? ' 연마' : ' 새김'}`, GRADE_COLOR[ENGRAVINGS[x.id].grade]);
        rebuild(); ctx.onEvent?.('eng', { n: r.eng.length });
        then?.();
      }, { reroll: () => pickEng(o, then), skip: '지나친다 (탑 금화 +15)', onSkip: () => { r.gold += 15; close(); then?.(); } });
  }
  function pickHone(title, then) {
    const r = run(), ids = offerHone(r, rng);
    if (!ids.length) { r.gold += goldGain(goldReward(r.f), r, meta()); ctx.floatText('연마할 각인이 없어 금화로 받았다', '#ffd84a'); then?.(); return; }
    const b = ctx.world()?.b || buildFor(r);
    pickModal(title || '연마', '각인 하나를 한 단계 연마한다 (단계마다 수치 +12% · 최대 5단계)', ids.map((id, i) => engCard(id, true, b, i)), (i) => {
      addEngraving(r, ids[i]); ctx.sfx('levelup', { vol: 0.6 }); close(); ctx.floatText(`${ENGRAVINGS[ids[i]].name} 연마`, '#7ad8ff'); rebuild(); then?.();
    }, { reroll: () => pickHone(title, then) });
  }
  function pickBless(title, then) {
    const r = run(), ids = offerBless(r, rng);
    pickModal(title || '축복', '같은 축복을 여러 번 받으면 그만큼 겹친다', ids.map((id, i) => {
      const B = BLESSINGS[id], n = r.bless[id] || 0;
      return `<button class="cl-card bless" data-pick="${i}" style="--g:${B.color}"><span class="cl-key">${i + 1}</span><span class="cl-grade">축복${n ? ` · 지금 ${n}번` : ''}</span><b>${B.name}</b><span class="cl-big">${B.text}</span></button>`;
    }), (i) => {
      r.bless[ids[i]] = (r.bless[ids[i]] || 0) + 1; ctx.sfx('levelup', { vol: 0.6 }); close(); ctx.floatText(`${BLESSINGS[ids[i]].name} · ${BLESSINGS[ids[i]].text}`, BLESSINGS[ids[i]].color); rebuild(); then?.();
    }, { reroll: () => pickBless(title, then) });
  }

  // ───── 싸움 없는 방 ─────
  function openRoom(room) {
    if (room === 'shop') return openShop();
    if (room === 'altar') return openAltar();
    if (room === 'rest') return openRest();
  }
  function openShop() {
    const w = ctx.world(), r = run();
    const items = (w.climb.shop ||= rollShop(r, rng, meta()));
    const row = (it, i) => {
      if (it.sold) return '';
      const can = r.gold >= it.price;
      let name = '', desc = '';
      if (it.kind === 'eng') { const e = ENGRAVINGS[it.id]; name = `<b style="color:${GRADE_COLOR[e.grade]}">${esc(e.name)}</b> <small>${GRADE_NAME[e.grade]}${it.up ? ' · 연마' : ''}</small>`; desc = (e.effects || []).map((x) => x.text).join(' · '); }
      else if (it.kind === 'bless') { const B = BLESSINGS[it.id]; name = `<b style="color:${B.color}">축복 · ${B.name}</b>`; desc = B.text; }
      else if (it.kind === 'heal') { name = '<b style="color:#7be38a">회복 물약</b>'; desc = '체력 35% 회복'; }
      else if (it.kind === 'hone') { name = '<b style="color:#7ad8ff">숫돌</b>'; desc = '가진 각인 하나 연마'; }
      else if (it.kind === 'reroll') { name = '<b style="color:#ffe8a8">다시 보는 눈</b>'; desc = '보상 다시 고르기 +1'; }
      return `<div class="cl-shop-row"><div>${name}<p class="muted">${esc(desc)}</p></div><button data-buy="${i}" ${can ? '' : 'disabled'}>◆ ${it.price}</button></div>`;
    };
    ctx.showModal(`<h2>탑의 상인</h2><p class="muted">"오르는 자여, 금화는 위에서 쓸모가 없지."</p><p>탑 금화 <b class="cl-gold">◆ ${r.gold}</b></p>
      <div class="cl-shop">${items.map(row).join('') || '<p class="muted">다 팔렸다</p>'}</div><div class="actions"><button data-close>나간다</button></div>`);
    document.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
      const it = items[+b.dataset.buy]; if (it.sold || r.gold < it.price) return;
      r.gold -= it.price; it.sold = true; ctx.sfx('coin');
      if (it.kind === 'eng') { addEngraving(r, it.id); rebuild(); ctx.onEvent?.('eng', { n: r.eng.length }); }
      else if (it.kind === 'bless') { r.bless[it.id] = (r.bless[it.id] || 0) + 1; rebuild(); }
      else if (it.kind === 'heal') w.heal(w.d.maxHp * 0.35, 'spring');
      else if (it.kind === 'reroll') r.rerolls++;
      else if (it.kind === 'hone') { close(); pickHone('숫돌 · 연마', () => openShop()); return; }
      ctx.save0(); openShop();
    }));
  }
  function openAltar() {
    const w = ctx.world(), r = run(), o = w.objects.find((x) => x.kind === 'climbRoom');
    if (o?.used) { ctx.showModal('<h2>낡은 제단</h2><p class="muted">제단의 빛이 꺼졌다.</p><button data-close>닫기</button>'); return; }
    const ids = (w.climb.altars ||= rollAltars(r, rng));
    ctx.showModal(`<h2>낡은 제단</h2><p class="muted">문양이 새겨진 돌판 둘. 하나만 고를 수 있다.</p>
      <div class="cl-cards">${ids.map((id, i) => `<button class="cl-card altar ${ALTARS[id].risk ? 'risk' : ''}" data-alt="${i}" style="--g:${ALTARS[id].risk ? '#ff6a5a' : '#c45cff'}"><span class="cl-key">${i + 1}</span><b>${ALTARS[id].name}</b><span class="cl-big">${ALTARS[id].text}</span></button>`).join('')}</div>
      <div class="actions"><button data-close class="ghost">그냥 지나간다</button></div>`);
    const use = (i) => {
      const id = ids[i]; if (o) { o.used = true; o.label = '꺼진 제단'; }
      keyPick = null; close();
      const after = () => { rebuild(); ctx.save0(); };
      if (id === 'bloodPact') { r.curse.maxHp = (r.curse.maxHp || 1) * 0.85; after(); pickEng({ minGrade: 4, title: '피의 계약' }, after); }
      else if (id === 'gamble') { const bet = Math.floor(r.gold / 2); if (rng.chance(0.5)) { r.gold += bet; ctx.floatText(`이겼다! 탑 금화 +${bet}`, '#ffd84a'); } else { r.gold -= bet; ctx.floatText(`잃었다… 탑 금화 -${bet}`, '#ff8a7a'); } after(); }
      else if (id === 'cursedPower') { r.curse.dmg = (r.curse.dmg || 1) * 1.2; r.curse.hurt = (r.curse.hurt || 1) * 1.2; ctx.floatText('저주받은 힘이 스며든다', '#ff6a5a'); after(); }
      else if (id === 'quietSpring') { w.heal(w.d.maxHp, 'spring'); r.forceTrial = true; ctx.floatText('체력을 모두 되찾았다 · 다음 층은 시련', '#7be38a'); after(); }
      else if (id === 'reforge') reforge();
      else if (id === 'starAltar') pickModal('별의 제단', '', [`<button class="cl-card" data-pick="0" style="--g:#b8a8ff"><span class="cl-key">1</span><b>별빛</b><span class="cl-big">✦ +${shardGain(6, r, meta())}</span></button>`, `<button class="cl-card" data-pick="1" style="--g:#ffd84a"><span class="cl-key">2</span><b>탑 금화</b><span class="cl-big">◆ +80</span></button>`], (k) => { if (k === 0) r.shards += shardGain(6, r, meta()); else r.gold += 80; close(); after(); });
    };
    document.querySelectorAll('[data-alt]').forEach((b) => (b.onclick = () => use(+b.dataset.alt)));
    keyPick = (i) => { if (i < ids.length) use(i); };
  }
  function reforge() {
    const r = run(), b = ctx.world().b;
    pickModal('잊힌 각인사 · 버릴 각인', '버린 각인보다 한 등급 높은 각인 둘 중 하나를 받는다', r.eng.slice(0, 9).map((x, i) => engCard(x.id, false, b, i)), (i) => {
      const gone = r.eng[i], g = Math.min(5, ENGRAVINGS[gone.id].grade + 1);
      r.eng.splice(i, 1); close();
      const offers = offerEngravings(r, rng, { n: 2, minGrade: g });
      pickModal('잊힌 각인사', `${ENGRAVINGS[gone.id].name}을(를) 버렸다`, offers.map((x, k) => engCard(x.id, x.up, b, k)), (k) => { addEngraving(r, offers[k].id); close(); rebuild(); ctx.save0(); });
    });
  }
  function openRest() {
    const w = ctx.world(), r = run(), o = w.objects.find((x) => x.kind === 'climbRoom');
    if (o?.used) { ctx.showModal('<h2>쉼터</h2><p class="muted">모닥불이 사그라들었다. 문으로 나아가자.</p><button data-close>닫기</button>'); return; }
    const use = (i) => {
      if (o) { o.used = true; o.label = '사그라든 모닥불'; }
      keyPick = null; close();
      if (i === 0) { const before = w.player.hp; w.heal(w.d.maxHp * 0.35, 'spring'); ctx.floatText(`체력 +${Math.round(w.player.hp - before)}`, '#7be38a'); ctx.save0(); }
      else pickHone('쉼터 · 연마', () => ctx.save0());
    };
    ctx.showModal(`<h2>쉼터</h2><p class="muted">다음 층에는 강한 것이 기다린다. 모닥불 곁에서 무엇을 할까?</p>
      <div class="cl-cards"><button class="cl-card" data-rest="0" style="--g:#7be38a"><span class="cl-key">1</span><b>쉰다</b><span class="cl-big">체력 35% 회복</span><small>지금 ${Math.round(w.player.hp)} / ${w.d.maxHp}</small></button>
      <button class="cl-card" data-rest="1" style="--g:#7ad8ff" ${r.eng.length ? '' : 'disabled'}><span class="cl-key">2</span><b>각인을 다듬는다</b><span class="cl-big">각인 하나 연마</span></button></div>
      <div class="actions"><button data-close class="ghost">나중에</button></div>`);
    document.querySelectorAll('[data-rest]').forEach((b) => (b.onclick = () => use(+b.dataset.rest)));
    keyPick = (i) => { if (i < 2 && (i === 0 || r.eng.length)) use(i); };
  }

  // ───── 등반 끝 (쓰러짐 · 포기 · 꼭대기) ─────
  function finish(kind, r, w) {
    const c = CS(), s = S();
    if (!r) return;
    c.runs++;
    if (kind === 'top') c.wins = (c.wins || 0) + 1;
    const reached = kind === 'top' ? CLIMB_TOP : Math.max(r.startF - 1, r.f - (w?.climb?.phase === 'fight' ? 1 : 0));
    if (reached > c.best) c.best = reached;
    const sc = oathScore(r.oath);
    if (kind === 'top') c.oathBest = Math.max(c.oathBest || 0, sc);
    c.shards += r.shards;
    const gold = Math.floor(r.gold * 0.5);
    s.gold += gold;
    let res = { kept: {}, ups: 0 };
    if (w?.loot) res = applyRun(s, w.loot, kind === 'dead' ? 0.6 : 1, w.discovered || new Set());
    const rec = { f: reached, kind, eng: r.eng.map((e) => [e.id, e.lv]), time: Math.round(r.time + (w?.tower?.t || 0)), oath: sc, date: Date.now(), startF: r.startF };
    (c.history ||= []).unshift(rec); c.history.length = Math.min(c.history.length, 12);
    if (!c.bestRun || reached > c.bestRun.f || (reached === c.bestRun.f && sc > (c.bestRun.oath || 0))) c.bestRun = rec;
    s.run = null;
    ctx.save0(true);
    ctx.onEvent?.('end', { kind, f: reached });
    if (w) w.state = 'over';
    const title = kind === 'top' ? '탑의 꼭대기에 닿았다!' : kind === 'dead' ? '쓰러졌다…' : '탑에서 물러났다';
    const by = kind === 'dead' && w?.climb?.lastBy ? `${w.climb.f}층에서 ${w.climb.lastBy}에게 쓰러졌다` : '';
    const engs = r.eng.map((e) => `<span class="cl-chip" style="--g:${GRADE_COLOR[ENGRAVINGS[e.id].grade]}">${esc(ENGRAVINGS[e.id].name)}${e.lv ? ` +${e.lv}` : ''}</span>`).join('') || '<span class="muted">없음</span>';
    ctx.sfx(kind === 'dead' ? 'error' : 'levelup', { vol: 0.7 });
    ctx.showModal(`<h2>${title}</h2>
      ${kind === 'top' ? '<p class="lvup">꺼져 가던 꼭대기의 빛이 다시 타오른다. 이제 서약을 걸고 다시 오를 수 있다.</p>' : ''}${by ? `<p class="muted">${esc(by)}</p>` : ''}
      <div class="cl-sum"><div><small>오른 층</small><b>${reached}층</b></div><div><small>걸린 시간</small><b>${fmtT(rec.time)}</b></div><div><small>별빛</small><b class="cl-star">✦ ${r.shards}</b></div><div><small>섬의 골드</small><b class="cl-gold">◆ ${gold}</b></div></div>
      ${sc ? `<p class="muted">서약 ${sc} · 별빛 +${sc * 10}%</p>` : ''}
      <p class="muted">이번 등반의 각인</p><div class="cl-chips">${engs}</div>
      ${Object.keys(res.kept || {}).length ? `<p class="muted">가져온 잔향 ${Object.values(res.kept).reduce((a, b) => a + b, 0)}개</p>` : ''}
      ${res.ups ? `<p class="lvup">레벨 업! Lv ${s.level}</p>` : ''}
      <p>모은 별빛 <b class="cl-star">✦ ${c.shards}</b> — 탑 문 앞에서 <b>탑의 축복</b>을 배울 수 있다.</p>
      <div class="actions"><button id="clAgain">다시 오르기</button><button id="clMetaNow" class="ghost">탑의 축복 보기</button><button data-close class="ghost">탑 밖으로</button></div>`, () => { close(); ctx.leave(); });
    const again = () => { close(); startClimb(1); }; // 바로 다시 1층부터 (마을로 걸어가지 않아도)
    const ab = document.getElementById('clAgain'); if (ab) ab.onclick = again;
    const mb = document.getElementById('clMetaNow'); if (mb) mb.onclick = () => showMeta(() => showAgainOrLeave());
    function showAgainOrLeave() { ctx.showModal(`<h2>탑의 축복</h2><p>모은 별빛 <b class="cl-star">✦ ${CS().shards}</b></p><div class="actions"><button id="clAgain2">다시 오르기</button><button data-close class="ghost">탑 밖으로</button></div>`, () => { close(); ctx.leave(); }); document.getElementById('clAgain2').onclick = again; }
  }
  function end(kind) { // 세계가 쓰러졌을 때 · 긴급 귀환
    const r = run(), w = ctx.world();
    if (!r) return false;
    r.time += 0;
    finish(kind === 'dead' ? 'dead' : 'retreat', r, w);
    return true;
  }

  // ───── 탑의 축복 · 서약 · 기록 ─────
  function showMeta(back) {
    const c = CS(), m = c.meta;
    const rows = Object.entries(META).map(([id, M]) => {
      const n = m[id] || 0, max = n >= M.max, cost = max ? 0 : M.cost(n);
      return `<div class="cl-meta"><div><b>${M.name}</b> <span class="cl-pips">${Array.from({ length: M.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>
        <p class="muted">${n ? `지금: ${M.text(n)}` : '아직 없음'}${max ? '' : ` → 다음: ${M.text(n + 1)}`}</p></div>
        ${max ? '<span class="muted">다 배웠다</span>' : `<button data-meta="${id}" ${c.shards >= cost ? '' : 'disabled'}>✦ ${cost}</button>`}</div>`;
    }).join('');
    ctx.showModal(`<h2>탑의 축복</h2><p class="muted">별빛으로 배우는 영구 성장 · 탑 안에서만 힘을 낸다</p><p>가진 별빛 <b class="cl-star">✦ ${c.shards}</b></p><div class="cl-metas">${rows}</div><div class="actions"><button id="clBack">돌아간다</button></div>`, () => {});
    document.querySelectorAll('[data-meta]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.meta, M = META[id], n = m[id] || 0, cost = M.cost(n);
      if (n >= M.max || c.shards < cost) return;
      c.shards -= cost; m[id] = n + 1; ctx.sfx('levelup', { vol: 0.6 }); ctx.save0(); ctx.onEvent?.('meta', { id }); showMeta(back);
    }));
    document.getElementById('clBack').onclick = () => { close(); back?.(); };
  }
  function showOath(back) {
    const c = CS(), o = c.oath;
    const rows = Object.entries(OATHS).map(([id, O]) => {
      const n = o[id] || 0;
      return `<div class="cl-meta"><div><b>${O.name}</b> <span class="cl-pips">${Array.from({ length: O.max }, (_, i) => `<i class="${i < n ? 'on red' : ''}"></i>`).join('')}</span><p class="muted">${n ? O.text(n) : `→ ${O.text(1)}`}</p></div>
        <span><button class="sm ghost" data-oath="${id}" data-d="-1" ${n ? '' : 'disabled'}>−</button> <button class="sm" data-oath="${id}" data-d="1" ${n < O.max ? '' : 'disabled'}>+</button></span></div>`;
    }).join('');
    const sc = oathScore(o);
    ctx.showModal(`<h2>서약</h2><p class="muted">탑을 더 어렵게 만드는 맹세. 서약 1마다 별빛 +10% · 기록에 서약 점수가 남는다.</p><p>지금 서약 <b>${sc}</b> · 별빛 <b class="cl-star">+${sc * 10}%</b>${c.oathBest ? ` · 꼭대기 최고 서약 ${c.oathBest}` : ''}</p><div class="cl-metas">${rows}</div><div class="actions"><button id="clBack">정했다</button></div>`, () => {});
    document.querySelectorAll('[data-oath]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.oath, d = +b.dataset.d; o[id] = Math.max(0, Math.min(OATHS[id].max, (o[id] || 0) + d)); if (!o[id]) delete o[id]; ctx.save0(); showOath(back);
    }));
    document.getElementById('clBack').onclick = () => { close(); back?.(); };
  }
  function showRecords(back) {
    const c = CS();
    const rows = (c.history || []).map((h) => `<tr><td>${h.f}층</td><td>${h.kind === 'top' ? '꼭대기!' : h.kind === 'dead' ? '쓰러짐' : '물러남'}</td><td>${fmtT(h.time)}</td><td>${h.oath ? `서약 ${h.oath}` : ''}</td><td class="muted">${h.eng.slice(0, 4).map(([id]) => ENGRAVINGS[id]?.name).join(', ')}${h.eng.length > 4 ? ` 외 ${h.eng.length - 4}` : ''}</td></tr>`).join('');
    ctx.showModal(`<h2>등반 기록</h2><p>오른 횟수 ${c.runs} · 꼭대기 ${c.wins || 0}번 · 최고 ${c.best}층</p><table class="cl-rec">${rows}</table><div class="actions"><button id="clBack">돌아간다</button></div>`, () => {});
    document.getElementById('clBack').onclick = () => { close(); back?.(); };
  }

  // HUD 에 보여 줄 이번 등반 요약
  function hud() {
    const r = run(); if (!r) return null;
    return { f: r.f, gold: r.gold, shards: r.shards, eng: r.eng, bless: r.bless, rerolls: r.rerolls, revives: r.revives, oath: oathScore(r.oath) };
  }
  function key(e) {
    if (!keyPick) return false;
    const m = /^Digit([1-9])$/.exec(e.code) || /^Numpad([1-9])$/.exec(e.code);
    if (m) { keyPick(+m[1] - 1); return true; }
    if (e.code === 'KeyG' || e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ') return true; // 고르는 창: 실수로 닫지 않게
    return false;
  }
  return { showTowerMenu, startClimb, enterFloor, follow, signal, end, hud, key, showMeta, showOath, buildFor, active: () => !!run() && !!ctx.world()?.climb };
}

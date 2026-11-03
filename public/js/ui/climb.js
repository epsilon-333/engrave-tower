// 탑 등반 화면과 흐름: 탑 문 · 층 들어가기 · 층 돌파 · 결산 · 서약 · 기록
// 규칙 (2026-11-03): 탑 안에서는 각인 · 축복 · 상인 · 제단이 없다. 층마다 몬스터만 나온다.
// 강해지는 것은 탑 밖(제단 각인 · 장비 · 성지 수련)에서. 탑에서는 몬스터 부산물을 얻는다.
// 세이브는 10층마다: 구역의 주인을 쓰러뜨리면 다음 구역 첫 층부터 시작할 수 있다. 중간에 쓰러지거나 나가면 그 등반은 끝난다.
// main.js 의 상태(저장 · 세계 · 창)는 ctx 로 받는다.
import { World } from '../sim/world.js';
import { computeBuild } from '../sim/build.js';
import { buildClimbFloor } from '../sim/climbmap.js';
import { toLoadout, applyRun } from '../save.js';
import { ZONES } from '../data/monsters.js';
import { CLIMB_TOP, ACTS, actOf, floorKind, recLevel, newRun, runEffects, OATHS, oathScore, climbStarts, newClimbSave, FLOOR_MODS } from '../data/climb.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function createClimb(ctx) {
  const S = () => ctx.save();
  const CS = () => { const c = (S().climb ||= newClimbSave()); for (const [k, v] of Object.entries(newClimbSave())) if (c[k] === undefined) c[k] = v; return c; }; // 예전 · 반쯤 만든 기록도 빈칸을 채운다
  const run = () => S().run;

  // 탑 안의 빌드: 탑 밖에서 갖춘 그대로 (+ 탑의 가호 · 서약)
  function buildFor(r) {
    const lo = toLoadout(S());
    lo.extraEffects = runEffects(r);
    return computeBuild(lo);
  }
  function close() { ctx.closeModal(); }

  // ───── 탑 문 앞 ─────
  function showTowerMenu() {
    const c = CS(), sc = oathScore(c.oath);
    if (run()) S().run = null; // 예전 저장에 남은 중간 등반: 세이브는 10층마다라서 이어 하지 않는다
    const starts = climbStarts(c.lords);
    const lordsDone = Object.keys(c.lords || {}).length;
    const acts = ACTS.map((a) => `<span class="cl-act ${c.lords?.[a.n] ? 'done' : c.best >= a.from - 1 ? 'now' : ''}" style="--c:${a.color}"><b>${a.from}~${a.to}층</b>${a.name}<small>권장 Lv ${a.rec}+</small></span>`).join('');
    ctx.showModal(`<h2>각인의 탑</h2>
      <p class="muted">층마다 몬스터 · 5층마다 수호자 · 10층마다 구역의 주인. 주인을 쓰러뜨리면 다음 구역부터 시작할 수 있다.</p>
      <div class="cl-acts">${acts}</div>
      <p>최고 기록 <b>${c.best}층</b> / ${CLIMB_TOP}${lordsDone ? ` · 서약 <b>${sc}</b>` : ''} · 내 레벨 <b>Lv ${S().level}</b></p>
      <div class="actions">${starts.map((f, i) => `<button data-clstart="${f}" class="${i === starts.length - 1 ? '' : 'ghost'}">${f}층부터</button>`).join('')}</div>
      <div class="actions">${lordsDone ? '<button id="clOath" class="ghost">서약 (난이도)</button>' : ''}${c.runs ? '<button id="clRec" class="ghost">기록</button>' : ''}<button data-close class="ghost">돌아간다</button></div>
      ${ctx.partyLeader?.() ? `<div class="actions">${starts.map((f) => `<button data-clparty="${f}" class="ghost">${f}층부터 파티와 오르기</button>`).join('')}</div>` : ''}`);
    document.querySelectorAll('[data-clstart]').forEach((b) => (b.onclick = () => { close(); startClimb(+b.dataset.clstart); }));
    document.querySelectorAll('[data-clparty]').forEach((b) => (b.onclick = () => { close(); ctx.startCoClimb?.(+b.dataset.clparty); }));
    const $ = (id) => document.getElementById(id);
    if ($('clOath')) $('clOath').onclick = () => showOath(showTowerMenu);
    if ($('clRec')) $('clRec').onclick = () => showRecords(showTowerMenu);
  }

  // ───── 등반 시작 · 층 들어가기 ─────
  function startClimb(startF = 1, co = null) {
    const c = CS();
    if (!climbStarts(c.lords).includes(startF) && !co) startF = 1;
    S().run = newRun({ startF, seed: co?.seed ?? ((Math.random() * 1e9) >>> 0), oath: c.oath });
    ctx.beforeClimb?.();
    enterFloor('fight', co ? { role: co.role, host: co.host } : null);
  }
  function enterFloor(door, co = ctx.coSpec?.() || null) {
    const r = run();
    r.f++; r.door = door;
    const f = r.f, act = actOf(f), zone = ZONES.find((z) => z.id === act.zone);
    const fk = floorKind(f);
    const seed = (r.seed + f * 7919) >>> 0;
    const map = buildClimbFloor(zone, seed, f, fk);
    const prev = ctx.world();
    const w = new World({ build: buildFor(r), mode: 'field', zone: { ...zone, dark: zone.dark * 0.45 }, zoneId: zone.id, seed, map, tower: { f }, climb: { run: r, f, kind: fk }, story: S().story, codex: S().codex, ...ctx.shared(), coop: co ? { role: co.role } : null });
    const same = prev?.climb?.run === r; // 같은 등반의 다음 층이면 주운 것을 이어서
    if (same && prev.loot) { w.loot = prev.loot; w.discovered = prev.discovered; }
    w.codexStart = same ? prev.codexStart : ctx.codexNow();
    w.player.hp = Math.max(1, Math.round((r.hpFrac ?? 1) * w.d.maxHp));
    if (r.res != null) w.player.res = r.res;
    ctx.setWorld(w, co);
    const rec = recLevel(f), low = S().level < rec;
    const MOD = FLOOR_MODS[w.climb.mod];
    ctx.banner({ text: fk === 'lord' ? `${f}층 · ${act.name}의 주인` : fk === 'guardian' ? `${f}층 · 수호자` : MOD ? `${f}층 · ${MOD.name}` : `각인의 탑 ${f}층`, sub: `${MOD ? `${MOD.text} · ` : ''}${act.name}${low ? ` · 권장 Lv ${rec} (지금 Lv ${S().level} · 적이 더 세다)` : ''}`, t: 2.6, color: fk === 'lord' ? '#ff7a5a' : fk === 'guardian' ? '#ffb07a' : act.color });
    ctx.music(zone.id); ctx.sfx('open'); ctx.startLoop();
    ctx.onEvent?.('floor', { f });
  }

  // 파티 등반 (동료): 파티장이 문을 지나면 함께 간다
  function follow(door) {
    const w = ctx.world(), r = run(); if (!w || !r) return;
    if (ctx.modalOpen()) close();
    r.hpFrac = Math.max(0.05, w.player.hp / w.d.maxHp); r.res = w.player.res; r.time += w.tower?.t || 0;
    enterFloor(door || 'fight');
  }

  // ───── 신호 (세계 → 화면) ─────
  function signal(s) {
    const w = ctx.world(), r = run();
    if (!r || !w?.climb) return false;
    if (s.t === 'climbCleared') {
      const c = CS();
      if (s.f > c.best) c.best = s.f;
      r.floorsCleared = (r.floorsCleared || 0) + 1;
      if (s.kind === 'lord') {
        const act = actOf(s.f), first = !c.lords[act.n];
        c.lords[act.n] = (c.lords[act.n] || 0) + 1;
        if (s.f < CLIMB_TOP) ctx.banner({ text: '기록이 남았다', sub: first ? `다음부터 ${s.f + 1}층에서 시작할 수 있다${act.n === 1 ? ' · 서약이 열렸다' : ''}` : `${s.f + 1}층부터 시작할 수 있다`, t: 4, color: '#8ad8ff' });
      }
      if (s.kind === 'guardian' || s.kind === 'lord') r.bosses.push(w.climb.boss?.def.name || '');
      r.hpFrac = w.player.hp / w.d.maxHp;
      ctx.save0();
      ctx.onEvent?.('cleared', { f: s.f, kind: s.kind });
      return true;
    }
    if (s.t === 'climbDoor') {
      r.hpFrac = Math.max(0.05, w.player.hp / w.d.maxHp); r.res = w.player.res; r.time += w.tower?.t || 0;
      ctx.onDoor?.(s.next);
      enterFloor(s.next);
      return true;
    }
    if (s.t === 'climbTop') { r.time += w.tower?.t || 0; finish('top', r, w); return true; }
    return false;
  }

  // ───── 등반 끝 (쓰러짐 · 물러남 · 꼭대기) ─────
  function finish(kind, r, w) {
    const c = CS(), s = S();
    if (!r) return;
    c.runs++;
    if (kind === 'top') c.wins = (c.wins || 0) + 1;
    const reached = kind === 'top' ? CLIMB_TOP : Math.max(r.startF - 1, r.f - (w?.climb?.phase === 'fight' ? 1 : 0));
    if (reached > c.best) c.best = reached;
    const sc = oathScore(r.oath);
    if (kind === 'top') c.oathBest = Math.max(c.oathBest || 0, sc);
    let res = { kept: {}, gold: 0, ups: 0 };
    if (w?.loot) res = applyRun(s, w.loot, kind === 'dead' ? 0.6 : 1, w.discovered || new Set());
    const rec = { f: reached, kind, time: Math.round(r.time + (w?.tower?.t || 0)), oath: sc, date: Date.now(), startF: r.startF };
    (c.history ||= []).unshift(rec); c.history.length = Math.min(c.history.length, 12);
    if (!c.bestRun || reached > c.bestRun.f || (reached === c.bestRun.f && sc > (c.bestRun.oath || 0))) c.bestRun = rec;
    s.run = null;
    ctx.save0(true);
    ctx.onEvent?.('end', { kind, f: reached });
    if (w) w.state = 'over';
    const title = kind === 'top' ? '탑의 꼭대기에 닿았다!' : kind === 'dead' ? '쓰러졌다…' : '탑에서 물러났다';
    const by = kind === 'dead' && w?.climb?.lastBy ? `${w.climb.f}층에서 ${w.climb.lastBy}에게 쓰러졌다` : '';
    const keptN = Object.values(res.kept || {}).reduce((a, b) => a + b, 0);
    const starts = climbStarts(c.lords), next = starts[starts.length - 1];
    ctx.sfx(kind === 'dead' ? 'error' : 'levelup', { vol: 0.7 });
    ctx.showModal(`<h2>${title}</h2>
      ${kind === 'top' ? '<p class="lvup">꺼져 가던 꼭대기의 빛이 다시 타오른다. 이제 서약을 걸고 다시 오를 수 있다.</p>' : ''}${by ? `<p class="muted">${esc(by)}</p>` : ''}
      <div class="cl-sum"><div><small>오른 층</small><b>${reached}층</b></div><div><small>걸린 시간</small><b>${fmtT(rec.time)}</b></div><div><small>가져온 부산물</small><b>${keptN}개</b></div><div><small>골드</small><b class="cl-gold">◆ ${res.gold || 0}</b></div></div>
      ${kind === 'dead' ? '<p class="muted">쓰러지면 주운 것의 60%만 가져온다.</p>' : ''}${sc ? `<p class="muted">서약 ${sc}</p>` : ''}
      ${res.ups ? `<p class="lvup">레벨 업! Lv ${s.level}</p>` : ''}
      <p class="muted">다음 등반은 <b>${next}층</b>부터 시작할 수 있다. 부산물로 공명 제단에서 각인을 새겨 강해지자.</p>
      <div class="actions"><button id="clAgain">${next}층부터 다시 오르기</button><button data-close class="ghost">탑 밖으로</button></div>`, () => { close(); ctx.leave(); });
    const ab = document.getElementById('clAgain'); if (ab) ab.onclick = () => { close(); startClimb(next); };
  }
  function end(kind) { // 세계가 쓰러졌을 때 · 긴급 귀환
    const r = run(), w = ctx.world();
    if (!r) return false;
    finish(kind === 'dead' ? 'dead' : 'retreat', r, w);
    return true;
  }

  // ───── 서약 · 기록 ─────
  function showOath(back) {
    const c = CS(), o = c.oath;
    const rows = Object.entries(OATHS).map(([id, O]) => {
      const n = o[id] || 0;
      return `<div class="cl-meta"><div><b>${O.name}</b> <span class="cl-pips">${Array.from({ length: O.max }, (_, i) => `<i class="${i < n ? 'on red' : ''}"></i>`).join('')}</span><p class="muted">${n ? O.text(n) : `→ ${O.text(1)}`}</p></div>
        <span><button class="sm ghost" data-oath="${id}" data-d="-1" ${n ? '' : 'disabled'}>−</button> <button class="sm" data-oath="${id}" data-d="1" ${n < O.max ? '' : 'disabled'}>+</button></span></div>`;
    }).join('');
    const sc = oathScore(o);
    ctx.showModal(`<h2>서약</h2><p class="muted">탑을 더 어렵게 만드는 맹세. 기록에 서약 점수가 남는다.</p><p>지금 서약 <b>${sc}</b>${c.oathBest ? ` · 꼭대기 최고 서약 ${c.oathBest}` : ''}</p><div class="cl-metas">${rows}</div><div class="actions"><button id="clBack">정했다</button></div>`, () => {});
    document.querySelectorAll('[data-oath]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.oath, d = +b.dataset.d; o[id] = Math.max(0, Math.min(OATHS[id].max, (o[id] || 0) + d)); if (!o[id]) delete o[id]; ctx.save0(); showOath(back);
    }));
    document.getElementById('clBack').onclick = () => { close(); back?.(); };
  }
  function showRecords(back) {
    const c = CS();
    const rows = (c.history || []).map((h) => `<tr><td>${h.startF || 1}→${h.f}층</td><td>${h.kind === 'top' ? '꼭대기!' : h.kind === 'dead' ? '쓰러짐' : '물러남'}</td><td>${fmtT(h.time)}</td><td>${h.oath ? `서약 ${h.oath}` : ''}</td></tr>`).join('');
    ctx.showModal(`<h2>등반 기록</h2><p>오른 횟수 ${c.runs} · 꼭대기 ${c.wins || 0}번 · 최고 ${c.best}층</p><table class="cl-rec">${rows}</table><div class="actions"><button id="clBack">돌아간다</button></div>`, () => {});
    document.getElementById('clBack').onclick = () => { close(); back?.(); };
  }

  function key() { return false; } // 고르는 창이 없어졌다
  return { showTowerMenu, startClimb, enterFloor, follow, signal, end, key, showOath, buildFor, active: () => !!run() && !!ctx.world()?.climb };
}

// 튜토리얼: 꿈에서 깨어 내 집 → 문 밖의 촌장 → 허수아비로 몸풀기 → 퀘스트 창(따라가기)까지, 조작을 하나씩 따라 한다 (건너뛸 수 있다).
// 끝난 뒤에도 처음 해 보는 조작(새긴 스킬 · 물약 · 스탯 점수 · 지도)은 그때 한 번씩 짧게 알려 준다 (save.tips).
// 세계(World)와 저장만 보고 판단하고, 화면에는 띠 하나(#tut)만 그린다. 키 이름은 키 바꾸기(settings.js)를 따른다.
import { keyFor, keyLabel } from '../settings.js';
import { journeyNow } from '../data/journey.js';
import { ENGRAVINGS } from '../data/engravings.js';
import { SKILLS, engravingSkillFor } from '../data/skills.js';
import { SLOTS } from '../sim/build.js';

// 창 열기 · 상호작용은 세계 밖(main.js)에서 일어나므로 여기에 표시해 둔다
export const tutFlags = { interact: false, panel: false, quest: false };

// 지금 키 이름 (바꾼 키를 따른다)
export const keyName = (def) => keyLabel(keyFor(def));
const moveKeys = () => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map(keyName).join('');
// 키 그림 (키캡): 바꾼 키를 따른다 · 휴대폰이면 버튼 이름
export const kc = (label) => `<kbd>${label}</kbd>`;
const K = (def) => kc(keyName(def));

// ───── 안내 줄 (2026-11-26): 안내는 한 번에 하나 ─────
// 넷이 따로 뜨던 것을 한 줄로: 첫 각인(forced) > 창 안내(guide) > 몸풀기(step) > 처음 알림(tip).
// 저마다 「띄우고 싶다」(want)를 적고, 앞선 것이 있으면 자기는 숨긴다(may). 처음 알림은 싸우는 중에도 미룬다.
export const TUT_ORDER = ['forced', 'guide', 'step', 'tip'];
export const tutQueue = {
  want: {},
  set(src, on) { this.want[src] = !!on; },
  top() { return TUT_ORDER.find((k) => this.want[k]) || null; },
  may(src) { const t = this.top(); return !t || TUT_ORDER.indexOf(src) <= TUT_ORDER.indexOf(t); },
  reset() { this.want = {}; },
};
// 싸우는 중: 가까이 살아 있는 적 (몸풀기 허수아비 제외)
export function inFight(w, r = 260) {
  const p = w?.player; if (!p) return false;
  return (w.enemies || []).some((e) => !e.dead && !e.tut && e.def?.ai !== 'dummy' && e.def?.ai !== 'target' && !e.ally && Math.hypot(e.x - p.x, e.y - p.y) < r);
}

// 안내 글 속 조작 이름을 이 기기에 맞게: 휴대폰이면 버튼 이름, PC면 바꾼 키 이름 (여정 · 배너 글에도 쓴다)
export function ctlText(text, touch) {
  if (!text) return text;
  if (touch) return text
    .replace(/평타\(좌클릭\)/g, '평타(오른쪽 조이스틱)').replace(/무기 기술\(우클릭\)/g, '무기 기술(「무기」 버튼)')
    .replace(/좌클릭/g, '오른쪽 조이스틱').replace(/우클릭/g, '「무기」 버튼')
    .replace(/Space로 구르/g, '「대시」로 구르').replace(/Space/g, '「대시」')
    .replace(/G로 말 걸기/g, '「확인」 버튼으로 말 걸기').replace(/\(G\)/g, '(「확인」 버튼)').replace(/\bG로\b/g, '「확인」 버튼으로')
    .replace(/\bJ\b/g, '≡ 메뉴 → 퀘스트').replace(/\bM\b/g, '≡ 메뉴 → 지도').replace(/\bH로 먹기/g, '「음식」 버튼으로 먹기')
    .replace(/\bQ 칸/g, '1번 칸');
  const k = (def) => keyName(def);
  return text
    .replace(/Space/g, k('Space'))
    .replace(/\bG(?=로|\)| →|$)/g, k('KeyG')).replace(/\(G\)/g, `(${k('KeyG')})`)
    .replace(/\bJ(?=[ ):로]|$)/g, k('KeyJ')).replace(/\bM\)/g, `${k('KeyM')})`).replace(/\bH로/g, `${k('KeyH')}로`)
    .replace(/\bQ 칸/g, `${k('KeyQ')} 칸`);
}

// 단계마다: 어디서(house: 내 집 안 · 아니면 바깥 세계) · 안내 글(휴대폰이면 터치 조작으로) · 준비(setup) · 끝났나(done)
function steps(touch) {
  const T = (pc, mobile) => () => (touch() ? mobile : pc());
  return [
    { id: 'door', house: true,
      text: T(() => `${kc(moveKeys())} 걸어서 <em>아래 문</em>으로 ↓`, `${kc('왼쪽 조이스틱')} <em>아래 문</em>으로 ↓`),
      more: '누군가 밖에서 부르고 있다',
      done: (w, t, c) => !c.inHouse() },
    { id: 'chief',
      text: T(() => `<em>「!」</em> 촌장에게 ${K('KeyG')} 말 걸기`, `<em>「!」</em> 촌장에게 ${kc('확인')} 말 걸기`),
      done: (w, t, c) => { const s = c.save(); return !s.npcJourney || !!s.jAccept?.hunt || !!s.journey?.hunt; } },
    { id: 'attack',
      text: T(() => `${kc('좌클릭')} 허수아비 치기`, `${kc('오른쪽 조이스틱')} 허수아비 치기`),
      more: '마우스 쪽으로 휘두른다',
      setup: (w, t) => {
        const at = w.openSpot(w.player.x, w.player.y), e = w.makeEnemy('dummy', at.x, at.y);
        e.home = { x: e.x, y: e.y }; e.tut = true; w.enemies.push(e);
        t.dummy = e; t.hp = e.hp; t.hits = 0;
      },
      done: (w, t) => { if (!t.dummy) return true; if (t.dummy.hp < t.hp) { t.hits++; t.hp = t.dummy.hp; } return t.hits >= 3; },
      count: (w, t) => `${Math.min(3, t.hits || 0)} / 3` },
    { id: 'weapon',
      text: T(() => `${kc('우클릭')} 무기 능력 써 보기`, `${kc('무기')} 무기 능력 써 보기`),
      more: '각인이 없어도 쓸 수 있다',
      done: (w) => w.player.skillCd > 0 || !!w.player.charging },
    { id: 'dash',
      text: T(() => `${K('Space')} 구르기 · 구를 땐 안 맞는다`, `${kc('대시')} 구르기 · 구를 땐 안 맞는다`),
      more: '빨간 예고를 보면 구르자',
      done: (w, t) => w.player.dashCharges < t.dash0 },
    { id: 'quest',
      text: T(() => `${K('KeyJ')} 퀘스트 창 열기`, `${kc('≡')} → <em>퀘스트</em> 열기`),
      more: '지금 할 일 · 「따라가기」(노란 화살표)',
      done: () => tutFlags.quest },
  ];
}

// 끝난 뒤 처음 한 번만: 그 조작을 처음 할 때가 된 순간 (when) 띠를 띄우고, 해 보면(done) 또는 시간이 지나면 닫는다
function tipsOf(touch) {
  const T = (pc, mobile) => () => (touch() ? mobile : pc());
  const sp = () => kc(touch() ? '대시' : keyName('Space'));
  return [
    { id: 'skill', t: 30,
      when: (w, s) => w.b?.skills?.some(Boolean) && w.state === 'play',
      text: T(() => `스킬: ${['KeyQ', 'KeyE', 'KeyR', 'KeyF'].map(K).join(' ')}`, `스킬: ${['1', '2', '3', '4'].map(kc).join(' ')}`),
      done: (w) => Object.keys(w.player.cdMax || {}).length > 0 },
    { id: 'potion', t: 7,
      when: (w) => w.state === 'play' && w.player.hp < w.d.maxHp * 0.4 && ['potion1', 'potion2', 'potion3'].some((id) => w.life?.bag?.[id] > 0),
      text: T(() => `체력 낮음! ${K('KeyZ')} 물약`, `체력 낮음! ${kc('물약')}`),
      more: '마시는 동안은 굼뜨다 · 물러나서',
      done: (w) => w.player.hp > w.d.maxHp * 0.7 },
    { id: 'points', t: 14,
      when: (w, s) => (s.points || 0) > 0 && w.state === 'play',
      text: T(() => `스탯 점수 → ${K('KeyC')} 캐릭터 창`, `스탯 점수 → ${kc('캐릭터')} 창`),
      done: (w, s) => !(s.points > 0) || tutFlags.panel },
    { id: 'map', t: 9,
      when: (w, s) => w.zone?.id === 'world' && !!s.journey?.hunt && w.state === 'play',
      text: T(() => `${K('KeyM')} 섬 지도`, `${kc('≡')} → <em>지도</em>`),
      done: () => false },
    { id: 'hurt', t: 7,
      when: (w) => w.state === 'play' && w.player.hp < w.d.maxHp * 0.85 && !w.practice,
      text: () => `빨간 예고 → ${sp()} 구르기`,
      more: '왼쪽 위 빨간 막대가 체력',
      done: () => false },
    { id: 'pickup', t: 7,
      when: (w) => w.state === 'play' && (w.drops || []).some((d) => Math.hypot(d.x - w.player.x, d.y - w.player.y) < 140),
      text: () => '떨어진 것: <em>걸어가면</em> 줍는다',
      more: '반짝이는 것이 잔향(몬스터 부산물)',
      done: () => false },
    { id: 'echo', t: 10,
      when: (w, s) => w.state === 'play' && Object.values(s.echoes || {}).some((n) => n > 0),
      text: () => '첫 <em>잔향</em>! → 공명 제단에서 각인',
      more: '각인 = 스킬',
      done: () => false },
    { id: 'talk', t: 9,
      when: (w) => w.state === 'play' && !!w.near,
      text: T(() => `${K('KeyG')} 말 걸기 · 줍기 · 열기`, `${kc('확인')} 말 걸기 · 줍기`),
      more: '<em>!</em> 맡길 일 · <em>?</em> 알리러 갈 차례',
      done: () => tutFlags.interact },
    { id: 'eat', t: 9,
      when: (w) => w.state === 'play' && w.player.hp < w.d.maxHp * 0.6 && !!hasFood(),
      text: T(() => `${K('KeyH')} 음식 먹기`, `${kc('음식')} 먹기`),
      more: '1.6초 · 맞으면 끊긴다 · 탑 안 회복은 요리뿐',
      done: (w) => w.player.hp > w.d.maxHp * 0.8 },
    { id: 'level', t: 9,
      when: (w, s) => w.state === 'play' && (s.level || 1) >= 2,
      text: () => '레벨 업! <em>도감</em>을 채우면 오른다',
      more: '처음 잡은 몬스터 · 가 본 곳 · 만난 사람',
      done: () => false },
    { id: 'tower', t: 10,
      when: (w) => w.state === 'play' && !!w.climb,
      text: () => '탑: 모두 쓰러뜨리면 <em>문</em>이 열린다',
      more: '회복은 요리뿐 · 저장은 10층마다',
      done: () => false },
    { id: 'boss', t: 9,
      when: (w) => w.state === 'play' && (w.enemies || []).some((e) => e.boss && !e.dead),
      text: () => `보스! 예고 → ${sp()} → 빈틈에 치기`,
      more: '쓰러뜨리면 체력 40% 회복',
      done: () => false },
  ];
}
let hasFood = () => false;

// ctx: { save(), world(), paused(), touch(), inHouse(), sfx(name, opt), writeSave(), banner(b), follow() }
export function createTutorial(ctx) {
  const STEPS = steps(ctx.touch), TIPS = tipsOf(ctx.touch);
  if (ctx.hasFood) hasFood = ctx.hasFood;
  let el = null, rt = null, shown = '', tip = null;
  const c = { save: ctx.save, inHouse: () => !!ctx.inHouse?.() };

  function finish(done) {
    const s = ctx.save(), w = ctx.world();
    s.tutorial = { done: true };
    if (rt?.dummy && w) { rt.dummy.dead = true; w.enemies = w.enemies.filter((e) => e !== rt.dummy); }
    rt = null;
    if (el) el.hidden = true;
    ctx.follow?.(); // 지금 여정을 따라가기 (화살표) — 건너뛰어도 길은 보인다
    if (done) ctx.banner({ text: '준비 끝!', sub: '노란 화살표를 따라가자', t: 5, color: '#f6dfae' });
    ctx.writeSave();
  }

  const moreBtn = (m) => (m ? `<button data-tutmore aria-label="덧말">?</button><span class="tut-more" hidden>${m}</span>` : '');
  function show(html, skip = true) {
    if (!el) {
      el = document.createElement('div'); el.id = 'tut'; document.body.appendChild(el);
      el.addEventListener('click', (e) => { if (e.target.dataset.tutskip != null) finish(false); if (e.target.dataset.tutmore != null) { const m = el.querySelector('.tut-more'); if (m) m.hidden = !m.hidden; } if (e.target.dataset.tipclose != null && tip) { (ctx.save().tips ||= {})[tip.def.id] = 1; tip = null; el.hidden = true; } });
    }
    el.hidden = false;
    html = skip ? `${html}<button data-tutskip>건너뛰기</button>` : `${html}<button data-tipclose aria-label="닫기">✕</button>`;
    if (html !== shown) { el.innerHTML = html; shown = html; } // 글이 바뀔 때만 다시 그린다 (매 프레임 다시 만들면 「건너뛰기」 누르기가 씹힌다)
  }
  const hide = () => { if (el) el.hidden = true; tutQueue.set('step', false); tutQueue.set('tip', false); };

  // 튜토리얼이 끝난 뒤: 처음 해 보는 조작 알림 (한 번에 하나 · 정해진 시간만)
  function tickTips(dt, w, s) {
    const fp = firstEngPhase(s, {}); // 첫 각인 안내가 곧 뜰 차례면 (창 안내 주기를 기다리지 않고) 미룬다
    const blocked = !tutQueue.may('tip') || inFight(w) || (fp && fp !== 'done');
    if (tip) {
      if (blocked) { // 앞선 안내 · 싸움: 미룬다 · 그동안 상황이 지나면 버린다 (다음에 또 그 상황이면 다시)
        if (el) el.hidden = true;
        if (!tip.def.when(w, s)) { tip = null; tutQueue.set('tip', false); }
        return;
      }
      tip.t -= dt;
      if (tip.def.done(w, s) || tip.t <= 0) { (s.tips ||= {})[tip.def.id] = 1; tip = null; hide(); ctx.writeSave(); return; }
      tutQueue.set('tip', true);
      show(`<b>${tip.def.text()}</b>${moreBtn(tip.def.more)}`, false);
      return;
    }
    hide();
    if (blocked) return;
    for (const d of TIPS) if (!s.tips?.[d.id] && d.when(w, s)) {
      if (d.done(w, s)) { (s.tips ||= {})[d.id] = 1; continue; } // 이미 해 봤다
      tip = { def: d, t: d.t }; tutFlags.panel = false; ctx.sfx('open', { vol: 0.4, rate: 1.5 });
      break;
    }
  }

  let last = 0;
  function tick() {
    const now = performance.now(), dt = Math.min(0.1, last ? (now - last) / 1000 : 0); last = now;
    const s = ctx.save(), T = s?.tutorial, w = ctx.world();
    if (!s || !w || w.state !== 'play' || ctx.paused()) { hide(); return; }
    if (!T || T.done) { if (T?.done && !w.pvp && !w.practice && !s.guideOff && !firstEngState.phase) tickTips(dt, w, s); else hide(); return; }
    let step = STEPS[T.step];
    if (!step) { finish(true); return; }
    if (step.house ? !c.inHouse() : w.zone?.id !== 'world') { // 이 단계를 할 곳이 아니다: 집 단계인데 이미 밖이면 넘어간다
      if (step.house) { T.step++; ctx.writeSave(); }
      hide(); return;
    }
    if (!rt || rt.step !== T.step || rt.world !== w) { // 새 단계 · 새 세계: 처음 자리를 기억하고 준비한다
      rt = { ...(rt?.world === w ? rt : {}), step: T.step, world: w, x0: w.player.x, y0: w.player.y, dash0: w.player.dashCharges };
      tutFlags.interact = false; tutFlags.panel = false; tutFlags.quest = false;
      step.setup?.(w, rt);
    }
    const cnt = step.count?.(w, rt);
    tutQueue.set('step', true);
    if (!tutQueue.may('step')) { if (el) el.hidden = true; } // 창 안내가 떠 있다: 몸풀기 띠는 잠깐 숨긴다
    else show(`<small>${T.step + 1}/${STEPS.length}</small><b>${step.text()}${cnt ? ` <i>${cnt}</i>` : ''}</b>${moreBtn(step.more)}`);
    if (step.done(w, rt, c)) { T.step++; ctx.sfx('open', { vol: 0.5, rate: 1.4 }); ctx.writeSave(); }
  }

  return { tick, finish };
}

// ───── 창을 처음 열 때의 안내 (그 창에서 할 일을 1~3단계로) ─────
// 창 안 구조는 건드리지 않고 위에 덮는다. g: data-guide 이름(있으면 우선) · sel: 없으면 찾을 선택자 — 둘 다 없으면 그 단계는 조용히 건너뛴다
const GUIDES = {
  'tab:altar': [
    { g: 'altar-list', sel: '#engList', text: '각인 목록 · 누르면 재료가 보인다' },
    { g: 'altar-detail', sel: '.eng-detail', text: '재료가 차면 <em>새기기</em>' },
    { g: 'altar-slots', sel: '.slots', text: '끼운 칸 = <em>Q E R F</em> 스킬' },
  ],
  'tab:skills': [
    { g: 'skill-slots', sel: '.slots, .skill-row', text: '새긴 각인을 <em>Q E R F</em> 칸에' },
    { text: '<em>부하</em> 합은 한도 안 (레벨로 는다)' },
  ],
  'tab:gear': [
    { g: 'gear-slots', sel: '.slots', text: '장비: 목록에서 눌러 바꿔 끼기' },
    { text: '무기마다 평타 · <em>우클릭</em> 능력이 다르다' },
  ],
  'tab:bag': [ { text: '음식 <em>H</em> · 물약 <em>Z</em>' } ],
  'tab:char': [
    { g: 'stats', sel: '[data-act="alloc"]', text: '<em>+</em>로 스탯 점수 나누기' },
    { text: '잘못 나눴으면 아래에서 되돌리기' },
  ],
  'tab:codex': [ { text: '도감을 채우면 <em>레벨</em>이 오른다' } ],
  'tab:shop': [ { text: '골드로 장비 사기 · <em>강화</em>' } ],
  'tab:forge': [ { text: '재료 + 골드로 장비 강화' } ],
  'tab:craft': [ { text: '재료를 모아 새 무기 만들기' } ],
  'tab:trade': [ { text: '낚싯대 · 씨앗 · 물약 사기 · 팔기' } ],
  'tab:cook': [ { text: '<em>요리</em> = 탑 안 유일한 회복' } ],
  'tab:storage': [ { text: '가방에서 넘치는 것을 맡긴다' } ],
  'tab:quest': [ { text: '의뢰 받기 → 해내고 → <em>보상 받기</em>' } ],
  'tab:where': [ { text: '잔향 · 재료가 나오는 곳 찾기' } ],
  quest: [
    { g: 'journey', sel: '.jlist', text: '맨 위 = 지금 할 일 · <em>따라가기</em>' },
  ],
  settings: [ { g: 'keys', sel: '.keys-set', text: '「키 바꾸기」 · 안내도 그 키로' } ],
  merchant: [ { text: '파는 것이 때마다 바뀐다' } ],
  map: [ { text: '어두운 곳 = 아직 안 가 본 곳' } ],
  fishing: [ { text: '<em>!</em> 뜨면 바로 <em>좌클릭</em>' } ],
};

// ctx: { save(), current() → 지금 열린 창 이름, touch(), writeSave(), sfx() }
export function createGuide(ctx) {
  let cur = null, box = null, card = null;
  const find = (st) => {
    const root = document;
    if (st.g) { const el = root.querySelector(`[data-guide="${st.g}"]`); if (el) return el; }
    if (st.sel) { for (const el of root.querySelectorAll(st.sel)) { const r = el.getBoundingClientRect(); if (r.width && r.height) return el; } return null; }
    return undefined; // 강조할 것이 없는 단계
  };
  const QERF = () => (ctx.touch() ? ['1', '2', '3', '4'] : ['KeyQ', 'KeyE', 'KeyR', 'KeyF'].map(keyName)).map(kc).join('');
  const keyText = (t) => (ctx.touch() ? t.replace(/<em>H<\/em>/g, kc('음식')).replace(/<em>Z<\/em>/g, kc('물약')).replace(/<em>좌클릭<\/em>/g, kc('조이스틱')).replace(/<em>우클릭<\/em>/g, kc('무기'))
    : t.replace(/<em>H<\/em>/g, K('KeyH')).replace(/<em>Z<\/em>/g, K('KeyZ')).replace(/<em>좌클릭<\/em>/g, kc('좌클릭')).replace(/<em>우클릭<\/em>/g, kc('우클릭'))).replace(/<em>Q E R F<\/em>/g, QERF());
  function close(done) {
    if (cur && done) { const s = ctx.save(); (s.guides ||= {})[cur.key] = 1; ctx.writeSave(); }
    cur = null; if (box) box.hidden = true; if (card) card.hidden = true; tutQueue.set('guide', false);
  }
  function ensure() {
    if (card) return;
    box = document.createElement('div'); box.id = 'guideHi'; box.hidden = true;
    card = document.createElement('div'); card.id = 'guide'; card.hidden = true;
    document.body.append(box, card);
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!cur) return; // 첫 각인 카드 (단추는 따로 듣는다)
      if (e.target.dataset.gnext != null) { cur.i++; draw(); }
      if (e.target.dataset.gskip != null) close(true);
    });
  }
  function draw() {
    for (;;) { // 강조할 것이 없어진 단계는 건너뛴다
      const st = cur.steps[cur.i];
      if (!st) { close(true); return; }
      cur.el = find(st);
      if (cur.el !== null) break;
      cur.i++;
    }
    const st = cur.steps[cur.i], last = !cur.steps.slice(cur.i + 1).some((x) => find(x) !== null);
    card.innerHTML = `<small>${cur.steps.length > 1 ? `${cur.i + 1}/${cur.steps.length}` : ''}</small><b>${keyText(st.text)}</b><span class="g-act">${last ? '' : '<button class="ghost sm" data-gskip>그만</button>'}<button class="sm" data-gnext>${last ? '확인' : '다음'}</button></span>`;
    card.hidden = false; place();
    ctx.sfx?.('open', { vol: 0.35, rate: 1.6 });
  }
  function place() {
    const el = cur?.el;
    if (!el || !el.isConnected) { box.hidden = true; card.classList.remove('near'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { box.hidden = true; return; }
    Object.assign(box.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${Math.min(r.height, innerHeight - r.top) + 8}px` });
    box.hidden = false;
  }
  // ── 첫 각인 안내 (건너뛸 수 없다 · 그 동작을 해야 넘어간다) ──
  let fe = null; // { phase, el, spec, nudgeT }
  function forced(s, key) {
    const w = ctx.world?.();
    const presses = ctx.skillPresses?.() || 0;
    const used = !!(w && Object.keys(w.player?.cdMax || {}).length) || (fe?.phase === 'use' && presses > fe.presses0); // 써 봤거나 · 키를 눌러 봤다 (자원이 모자라 안 나가도)
    let phase = firstEngPhase(s, { panel: key, altarSel: ctx.altarSel?.(), used });
    if (phase === 'done') { s.firstEngTut = { ...(s.firstEngTut || {}), used: 1, done: 1 }; (s.guides ||= {})['tab:altar'] = 1; ctx.writeSave(); ctx.banner?.({ text: '첫 각인을 새겼다!', sub: '노란 화살표 → 다음 할 일', t: 5, color: '#f6dfae' }); phase = null; }
    if (phase && !(w && (w.state === 'play' || key))) phase = null; // 싸움 밖 화면(죽음 등)에선 잠깐 숨긴다
    firstEngState.phase = phase; tutQueue.set('forced', !!phase);
    if (phase) { const t = document.getElementById('tut'); if (t) t.hidden = true; } // 아래 띠는 바로 내린다 (다음 프레임을 기다리지 않게)
    if (!phase) { if (fe) { fe = null; card.hidden = true; box.hidden = true; card.classList.remove('forced', 'raise'); } return false; }
    if (!fe || fe.phase !== phase) {
      fe = { phase, spec: firstEngSpec(phase, s, ctx.touch()), nudgeT: 0, presses0: presses };
      if (phase === 'select') ctx.prepAltar?.(s.flags.firstEng); // 목록을 「새길 수 있음」으로 · 그 각인이 보이게
      if (phase === 'rune' || phase === 'open') { if (!s.follow) s.follow = 'altarEng'; }
      ctx.sfx?.('open', { vol: 0.4, rate: 1.5 });
      fe.html = null;
    }
    const sp = fe.spec;
    fe.el = sp.sel ? document.querySelector(sp.sel) : null;
    if (fe.el && !fe.scrolled) { fe.el.scrollIntoView?.({ block: 'center' }); fe.scrolled = true; }
    const nudge = fe.nudgeT > Date.now();
    const html = `<small>첫 각인</small><b>${nudge ? '<span class="g-nudge">여기! → </span>' : ''}${sp.text}</b>${sp.btn ? `<span class="g-act"><button class="sm" data-gforce="${sp.act}">${sp.btn}</button></span>` : ''}`;
    if (html !== fe.html) { card.innerHTML = html; fe.html = html; }
    card.hidden = false; card.classList.add('forced'); card.classList.toggle('raise', !ALTAR_PHASES.has(phase)); card.classList.toggle('nudge', nudge);
    cur = null;
    const el = fe.el;
    if (el && el.isConnected && el.getBoundingClientRect().width) { const r = el.getBoundingClientRect(); Object.assign(box.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${Math.min(r.height, innerHeight - r.top) + 8}px` }); box.hidden = false; }
    else box.hidden = true;
    // 강조한 것을 가리지 않게: 그것이 아래쪽이면 카드는 위로
    const er = el?.isConnected ? el.getBoundingClientRect() : null;
    card.classList.toggle('top', !!(er && er.width && er.top + er.height / 2 > innerHeight * 0.5));
    return true;
  }
  // 이 구간엔 강조한 것 말고 다른 단추는 듣지 않고 짧게 다시 짚는다
  document.addEventListener('click', (e) => {
    if (!fe) return;
    const t = e.target;
    if (card?.contains(t)) {
      const a = t.dataset?.gforce; if (!a) return;
      const s = ctx.save(); s.firstEngTut ||= {};
      if (a === 'ack') s.firstEngTut.ack = 1;
      if (a === 'seenMats') s.firstEngTut.seenMats = 1;
      ctx.writeSave(); e.stopPropagation(); return;
    }
    if (!ALTAR_PHASES.has(fe.phase) && !fe.spec.btn) return;
    const hit = t.closest?.('button, [data-act], a, summary, input, select');
    if (!hit) return;
    if (fe.el && (fe.el === hit || fe.el.contains(hit))) return;
    e.preventDefault(); e.stopPropagation();
    fe.nudgeT = Date.now() + 1400; ctx.sfx?.('click', { vol: 0.3, rate: 0.7 });
  }, true);

  setInterval(() => {
    const s = ctx.save?.();
    if (!s) { if (cur) close(false); return; }
    let key = null; try { key = ctx.current(); } catch { key = null; }
    ensure();
    if (forced(s, key)) return;
    tutQueue.set('guide', !!cur);
    if (cur && cur.key !== key) close(false); // 창을 닫거나 다른 탭으로: 다음에 다시 열면 또 보인다
    if (cur) { if (!cur.el?.isConnected && cur.el) cur.el = find(cur.steps[cur.i]); place(); return; }
    if (!key || s.guideOff || s.guides?.[key] || !GUIDES[key]) { if (!cur) { card.hidden = true; box.hidden = true; } return; }
    if (s.tutorial && !s.tutorial.done && key !== 'quest') return; // 몸풀기 중에는 퀘스트 창만
    ensure(); cur = { key, steps: GUIDES[key], i: 0 }; tutQueue.set('guide', true); draw();
  }, 250);
  return { close };
}

// ───── 첫 각인 새기기 안내 (2026-11-25) ─────
// 사냥을 알리기 → 재료 → 루네 → 제단 → 목록에서 그 각인 → 재료 → 새기기 → 장착 → 창 닫기 → 스킬 써 보기.
// 건너뛸 수 없고 그 동작을 해야 넘어간다 (창 안내 끄기 save.guideOff 와 상관없이). 상태는 저장(s.firstEngTut: ack · seenMats · used · done)과 지금 창만 보고 정한다
export const firstEngState = { phase: null };
const ALTAR_PHASES = new Set(['select', 'full', 'engrave', 'equip', 'close']);
// ui: { panel: 지금 열린 창 이름('tab:altar' …) · altarSel: 제단에서 고른 각인 · used: 스킬을 써 봤나 }
export function firstEngPhase(s, ui = {}) {
  if (!s?.npcJourney || s.firstEngTut?.done) return null;
  if (s.tutorial && !s.tutorial.done) return null; // 몸풀기가 먼저
  const T = s.firstEngTut || {}, eid = s.flags?.firstEng, J = journeyNow(s);
  if (!eid || !ENGRAVINGS[eid]) return J?.step.id === 'hunt' && J.stage === 'report' ? 'report' : null;
  const altar = ui.panel === 'tab:altar';
  if (!T.ack) return 'mats';
  if (!((s.owned?.[eid] || 0) > 0)) {
    if (!altar) return J?.step.id === 'altarEng' && J.stage === 'talk' ? 'rune' : 'open';
    if (ui.altarSel !== eid) return 'select';
    return T.seenMats ? 'engrave' : 'full';
  }
  const slot = SLOTS.slice(0, 4).find((k) => s.slots?.[k] === eid);
  if (!slot) return altar ? 'equip' : 'open';
  if (T.used || ui.used) return 'done';
  return ui.panel ? 'close' : 'use';
}

// 단계마다: 글 · 강조할 것(선택자) · 누르는 단추(있으면 그것이 그 단계의 동작)
function firstEngSpec(phase, s, touch) {
  const eid = s.flags?.firstEng, E = ENGRAVINGS[eid], nm = E ? `「${E.name}」` : '첫 각인';
  const slot = SLOTS.slice(0, 4).findIndex((k) => s.slots?.[k] === eid), sk = E && SKILLS[engravingSkillFor(eid, s.race)];
  const key = touch ? `${Math.max(0, slot) + 1}` : keyName(['KeyQ', 'KeyE', 'KeyR', 'KeyF'][Math.max(0, slot)]);
  const G = touch ? '확인' : keyName('KeyG');
  switch (phase) {
    case 'report': return { text: `<em>「?」</em> 촌장에게 ${kc(G)} 알리기` };
    case 'mats': return { text: `${nm} 재료를 받았다!`, btn: '확인', act: 'ack' };
    case 'rune': return { text: `<em>「!」</em> 루네에게 ${kc(G)} → 화살표` };
    case 'open': return { text: `공명 제단 · 루네 앞 ${kc(G)}` };
    case 'select': return { sel: `[data-act="aselect"][data-id="${eid}"]`, text: `목록에서 ${nm} 누르기` };
    case 'full': return { sel: '[data-guide="altar-recipe"]', text: '재료 <em>◆</em> 다 찼다', btn: '다음', act: 'seenMats' };
    case 'engrave': return { sel: '[data-guide="altar-engrave"]', text: '<em>「새기기」</em> 누르기' };
    case 'equip': return { sel: '[data-guide="altar-equip"]', text: '<em>「장착」</em> 누르기' };
    case 'close': return { sel: '[data-guide="hub-close"]', text: `창 닫기 ${kc(touch ? '✕' : 'Esc')}` };
    case 'use': return { text: `${kc(key)} ${sk ? `「${sk.name}」` : '스킬'} 써 보기` };
  }
  return { text: '' };
}

// 시험용 (tools/tests/tutqueue.mjs): 모든 안내 글 (길이 검사)
export function tutTexts(touch = false) {
  const t = () => touch, out = [];
  for (const d of [...steps(t), ...tipsOf(t)]) out.push(d.text());
  for (const g of Object.values(GUIDES)) for (const st of g) out.push(st.text);
  const s = { flags: { firstEng: Object.keys(ENGRAVINGS)[0] }, race: 'human', slots: {} };
  for (const ph of ['report', 'mats', 'rune', 'open', 'select', 'full', 'engrave', 'equip', 'close', 'use']) out.push(firstEngSpec(ph, s, touch).text);
  return out;
}
